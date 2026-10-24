/**
 * Cloudflare Pages Function: Universal Stream Embed Proxy
 * Eliminates CSP 'frame-ancestors' and 'X-Frame-Options' restrictions
 * Allows StreamCorner, SportsEmbed, and Amazon stream players to embed and play seamlessly
 * Route: /api/embed
 */

export async function onRequest(context) {
    const requestUrl = new URL(context.request.url);
    let targetUrl = requestUrl.searchParams.get('url');

    // If 'url' parameter is missing, but 'p' parameter exists (e.g. on player engine reload or refresh),
    // automatically reconstruct the full pandecocogaming target URL
    if (!targetUrl && requestUrl.searchParams.has('p')) {
        targetUrl = `https://amazon.com.pandecocogaming.sbs/${requestUrl.search}`;
    }

    if (!targetUrl || targetUrl.includes('example.com') || targetUrl.includes('example.org')) {
        const errorHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><style>body{margin:0;background:#060a12;color:#94a3b8;font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center}.box{padding:24px;max-width:360px;border:1px solid #1e293b;border-radius:16px;background:#0c1322}.icon{font-size:32px;margin-bottom:8px}h3{color:#f8fafc;font-size:15px;margin:0 0 6px 0;font-weight:800}p{font-size:12px;margin:0;line-height:1.5;color:#64748b}</style></head><body><div class="box"><div class="icon">📡</div><h3>Broadcast Feed Unavailable</h3><p>Please switch to another server or reload the player.</p></div></body></html>`;
        return new Response(errorHtml, {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }

    try {
        const parsedTarget = new URL(targetUrl);

        // Sync requested player parameter to upstream target if specified
        const reqEngine = requestUrl.searchParams.get('player') || parsedTarget.searchParams.get('player');
        if (reqEngine) {
            if (reqEngine === 'bitmovin') {
                parsedTarget.searchParams.delete('player');
            } else {
                parsedTarget.searchParams.set('player', reqEngine);
            }
        }

        if (requestUrl.searchParams.has('subpath')) {
            const sub = requestUrl.searchParams.get('subpath');
            parsedTarget.pathname = sub.startsWith('/') ? sub : `/${sub}`;
        }

        const isStreamCorner = parsedTarget.origin.includes('pandecocogaming') ||
                               parsedTarget.origin.includes('getsugatensho') ||
                               parsedTarget.origin.includes('streamcorner');

        const upstreamHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            'Referer': isStreamCorner ? 'https://streamcorner.cloud/' : `${parsedTarget.origin}/`,
            'Origin': isStreamCorner ? 'https://streamcorner.cloud' : parsedTarget.origin,
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9'
        };

        const upstreamResponse = await fetch(parsedTarget.toString(), {
            method: context.request.method,
            headers: upstreamHeaders
        });

        if (!upstreamResponse.ok) {
            return new Response(`Upstream returned ${upstreamResponse.status}`, {
                status: upstreamResponse.status,
                headers: { 'Access-Control-Allow-Origin': '*' }
            });
        }

        // If target is a JavaScript file, return with application/javascript
        if (parsedTarget.pathname.endsWith('.js') || targetUrl.includes('.js')) {
            const jsText = await upstreamResponse.text();
            return new Response(jsText, {
                status: 200,
                headers: {
                    'Content-Type': 'application/javascript; charset=utf-8',
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'public, max-age=3600'
                }
            });
        }

        let html = await upstreamResponse.text();

        // Safe storage check, player engine search sync, audio unmuting, and loading overlay dismiss
        const injectScript = `<script>
(function() {

    // 1. Bitmovin & DOM removeChild / insertBefore protective wrapper
    try {
        var origRemoveChild = Node.prototype.removeChild;
        Node.prototype.removeChild = function(child) {
            if (!child) return child;
            if (child.parentNode !== this) {
                return child;
            }
            try {
                return origRemoveChild.call(this, child);
            } catch(e) {
                return child;
            }
        };

        var origInsertBefore = Node.prototype.insertBefore;
        Node.prototype.insertBefore = function(newNode, referenceNode) {
            if (!newNode) return newNode;
            try {
                return origInsertBefore.call(this, newNode, referenceNode);
            } catch(e) {
                return newNode;
            }
        };
    } catch (e) {}

    // 2. Third-party script error silencer for null.appendChild / removeChild
    window.addEventListener('error', function(e) {
        if (e.message && (e.message.indexOf('appendChild') !== -1 || e.message.indexOf('removeChild') !== -1 || e.message.indexOf('insertBefore') !== -1)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            return true;
        }
    }, true);

    // 3. Purge third-party VPN promotional popups and ad overlays
    function purgePromoOverlays() {
        var elements = document.querySelectorAll('div, section, aside, a, p, span');
        for (var i = 0; i < elements.length; i++) {
            var el = elements[i];
            if (el.id === 'loading-overlay' || el.id === 'loading-message' || el.closest('#loading-overlay') || el.closest('.bmpui-ui-container')) continue;
            var text = (el.innerText || el.textContent || '').trim().toLowerCase();
            if (text.includes('vpn') && (text.includes('learn more') || text.includes('hide') || text.includes('protect your privacy') || text.includes('recommended'))) {
                el.style.setProperty('display', 'none', 'important');
                el.style.setProperty('visibility', 'hidden', 'important');
                el.style.setProperty('pointer-events', 'none', 'important');
                try { el.remove(); } catch(err) {}
            }
        }
    }
    setInterval(purgePromoOverlays, 300);

    // Only polyfill storage if running in a restricted sandbox where access throws SecurityError
    try {
        window.localStorage.getItem('_test');
    } catch (e) {
        var mem = {};
        var fakeStorage = {
            getItem: function(k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
            setItem: function(k, v) { mem[k] = String(v); },
            removeItem: function(k) { delete mem[k]; },
            clear: function() { for (var k in mem) delete mem[k]; }
        };
        try {
            Object.defineProperty(window, 'localStorage', { value: fakeStorage, writable: true, configurable: true });
            Object.defineProperty(window, 'sessionStorage', { value: fakeStorage, writable: true, configurable: true });
        } catch (e2) {}
    }

    try {
        var pVal = "${parsedTarget.searchParams.get('p') || requestUrl.searchParams.get('p') || ''}";
        var reqEngine = "${reqEngine || ''}";
        var curPath = window.location.pathname;
        if (pVal) {
            var finalParams = new URLSearchParams();
            finalParams.set('p', pVal);
            if (reqEngine && reqEngine !== 'bitmovin') {
                finalParams.set('player', reqEngine);
            }
            var targetQuery = '?' + finalParams.toString();
            if (window.location.search !== targetQuery) {
                window.history.replaceState(null, '', curPath + targetQuery);
            }
        }
    } catch (e) {}

    // Genuine sound restoration: ensure sound icon accurately reflects active audio and unmuted status
    var userToggledMute = false;
    document.addEventListener('click', function(e) {
        if (e.target && e.target.closest && e.target.closest('.bmpui-ui-volumetogglebutton, .op-volume, .shaka-mute-button, .jw-icon-volume, [class*="volume"], [class*="mute"]')) {
            userToggledMute = true;
        }
    }, true);

    function syncAndUnmuteAudio() {
        if (userToggledMute) return;
        var vids = document.querySelectorAll('video');
        for (var i = 0; i < vids.length; i++) {
            var v = vids[i];
            if (!v.paused && v.currentTime > 0) {
                if (v.muted) v.muted = false;
                if (v.volume === 0) v.volume = 1.0;
            }
        }
        var mutedElements = document.querySelectorAll('.bmpui-ui-volumetogglebutton.bmpui-muted, button.bmpui-muted, .op-volume--muted');
        for (var j = 0; j < mutedElements.length; j++) {
            mutedElements[j].classList.remove('bmpui-muted', 'op-volume--muted');
        }
    }

    function ensurePlayback(v) {
        if (!v) return;
        if (v.paused && v.readyState >= 2) {
            var playPromise = v.play();
            if (playPromise !== undefined) {
                playPromise.catch(function() {
                    v.muted = true;
                    v.play().catch(function() {});
                });
            }
        }
    }

    document.addEventListener('click', syncAndUnmuteAudio, true);
    document.addEventListener('touchstart', syncAndUnmuteAudio, true);
    document.addEventListener('play', syncAndUnmuteAudio, true);
    document.addEventListener('playing', syncAndUnmuteAudio, true);

    // Force hide 'Loading up the stream...' overlay once video stream starts playback
    function hideStreamLoadingOverlay() {
        var overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden', 'force-hide');
            overlay.style.setProperty('display', 'none', 'important');
            overlay.style.setProperty('opacity', '0', 'important');
            overlay.style.setProperty('visibility', 'hidden', 'important');
            overlay.style.setProperty('pointer-events', 'none', 'important');
        }
        var msg = document.getElementById('loading-message');
        if (msg) msg.innerText = '';
    }

    document.addEventListener('play', hideStreamLoadingOverlay, true);
    document.addEventListener('playing', hideStreamLoadingOverlay, true);
    document.addEventListener('timeupdate', function(e) {
        if (e.target && (e.target.currentTime > 0.05 || !e.target.paused)) {
            hideStreamLoadingOverlay();
        }
    }, true);

    // Watch video status periodically
    var checkInterval = setInterval(function() {
        var vids = document.querySelectorAll('video');
        for (var i = 0; i < vids.length; i++) {
            var v = vids[i];
            ensurePlayback(v);
            if (!v.paused || v.currentTime > 0 || v.readyState >= 2) {
                hideStreamLoadingOverlay();
                break;
            }
        }
    }, 300);

    // Safety fallback: auto-hide after 5 seconds once player initializes
    setTimeout(function() {
        var vids = document.querySelectorAll('video');
        if (vids.length > 0) hideStreamLoadingOverlay();
    }, 5000);
})();
</script>
<style>
/* Block third-party VPN promotional popups, ad overlays, and intrusive modals */
[class*="vpn"], [id*="vpn"],
[class*="popup"], [id*="popup"]:not(#player-modal),
[class*="promo"], [id*="promo"],
[class*="banner-ad"], [id*="banner-ad"],
.ad-overlay, .advertisement {
    display: none !important;
    opacity: 0 !important;
    visibility: hidden !important;
    pointer-events: none !important;
}

#loading-overlay.hidden,
#loading-overlay.force-hide,
#loading-overlay[style*="display: none"] {
    display: none !important;
    opacity: 0 !important;
    visibility: hidden !important;
    pointer-events: none !important;
}
</style>`;
        const baseHref = parsedTarget.origin ? `${parsedTarget.origin}/` : 'https://amazon.com.pandecocogaming.sbs/';
        if (html.includes('<head>')) {
            html = html.replace('<head>', `<head>\n    <base href="${baseHref}">\n    ${injectScript}`);
        } else if (html.includes('<html')) {
            html = html.replace(/<html[^>]*>/i, `$&<head><base href="${baseHref}">${injectScript}</head>`);
        } else {
            html = `<base href="${baseHref}">${injectScript}` + html;
        }

        // Neutralize annoying popup and anti-devtool scripts
        html = html.replace(/aclib\.runPop\([^)]*\)/g, '/* ad popup removed */');
        html = html.replace(/<script[^>]*disable-devtool[^>]*><\/script>/gi, '<!-- devtool disabled -->');

        // Neutralize Cloudflare Turnstile / Challenge platform script which blocks sandboxed iframes
        html = html.replace(/<script[^>]*__CF\$cv\$params[\s\S]*?<\/script>/gi, '<!-- cf challenge removed -->');
        html = html.replace(/<script[^>]*\/cdn-cgi\/challenge-platform\/[^>]*><\/script>/gi, '<!-- cf challenge removed -->');

        // Neutralize anti-framing and domain guard checks in StreamCorner admin/fubo/peacock players
        html = html.replace(/function\s+G\s*\(\)\s*\{return\s+[a-zA-Z0-9_$]+\(\)\|\|[a-zA-Z0-9_$]+\(\)\}/g, 'function G(){return true;}');
        html = html.replace(/function\s*\(\)\s*\{return\s+[a-zA-Z0-9_$]+\(\)\|\|[a-zA-Z0-9_$]+\(\)\}/g, 'function(){return true;}');

        // Rewrite dynamic script location in embedindia so bundle loads through /api/embed with valid SSL
        if (html.includes('location.protocol+"//"+location.host')) {
            html = html.replace('var a=location.protocol+"//"+location.host', `var a=(window.location.origin||"") + "/api/embed?url=" + encodeURIComponent("${parsedTarget.origin}") + "&subpath="`);
        }
        html = html.replace(/e\.setAttribute\(["']src["'],\s*a\s*\+\s*\(["']clappr["']\s*===\s*t\s*\?\s*["']\/js\/bundle\.js["']\s*:\s*["']\/js\/bundle-jw\.js["']\)\)/g,
            `e.setAttribute("src", (window.location.origin||"") + "/api/embed?url=" + encodeURIComponent("${parsedTarget.origin}") + "&subpath=" + ("clappr"===t?"/js/bundle.js":"/js/bundle-jw.js"))`);

        // Build clean response headers removing all framing restrictions
        const responseHeaders = new Headers();
        responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
        responseHeaders.set('Access-Control-Allow-Origin', '*');
        responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        responseHeaders.set('Cache-Control', 'public, max-age=60');

        return new Response(html, {
            status: 200,
            headers: responseHeaders
        });
    } catch (err) {
        return new Response('Stream proxy error: ' + err.message, {
            status: 502,
            headers: {
                'Content-Type': 'text/plain',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}
