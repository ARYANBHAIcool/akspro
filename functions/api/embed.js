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
    // automatically reconstruct the full pandecocogaming target URL preserving any subpath
    if (!targetUrl && requestUrl.searchParams.has('p')) {
        const sub = requestUrl.searchParams.get('subpath') || '';
        const targetFile = sub ? (sub.startsWith('/') ? sub : `/${sub}`) : '/';
        targetUrl = `https://amazon.com.pandecocogaming.sbs${targetFile}${requestUrl.search}`;
    }

    if (!targetUrl || targetUrl.includes('example.com') || targetUrl.includes('example.org')) {
        const errorHtml = `<!DOCTYPE html><html lang="en"><!-- embed-v10.9.13 --><head><meta charset="utf-8"><style>body{margin:0;background:#060a12;color:#94a3b8;font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center}.box{padding:24px;max-width:360px;border:1px solid #1e293b;border-radius:16px;background:#0c1322}.icon{font-size:32px;margin-bottom:8px}h3{color:#f8fafc;font-size:15px;margin:0 0 6px 0;font-weight:800}p{font-size:12px;margin:0;line-height:1.5;color:#64748b}</style></head><body><div class="box"><div class="icon">📡</div><h3>Broadcast Feed Unavailable</h3><p>Please switch to another server or reload the player.</p></div></body></html>`;
        return new Response(errorHtml, {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'X-Embed-Version': '10.9.13'
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
        const isPPV = parsedTarget.origin.includes('taifood') ||
                      parsedTarget.origin.includes('embedindia') ||
                      parsedTarget.origin.includes('embed.st') ||
                      parsedTarget.origin.includes('indianservers');
        const isSportsonline = parsedTarget.origin.includes('dynmeadow') ||
                               parsedTarget.origin.includes('sportsonline') ||
                               parsedTarget.origin.includes('sportsonnline');
        const isRocky = parsedTarget.origin.includes('rockyembed');

        let upstreamReferer = `${parsedTarget.origin}/`;
        let upstreamOrigin = parsedTarget.origin;

        if (isSportsonline) {
            upstreamReferer = 'https://ww1.sportsonnline.click/';
            upstreamOrigin = 'https://ww1.sportsonnline.click';
        } else if (isRocky) {
            upstreamReferer = 'https://embed.st/';
            upstreamOrigin = 'https://embed.st';
        } else if (isStreamCorner) {
            upstreamReferer = 'https://streamcorner.cloud/';
            upstreamOrigin = 'https://streamcorner.cloud';
        } else if (isPPV) {
            upstreamReferer = 'https://ppv.st/';
            upstreamOrigin = 'https://ppv.st';
        }

        const upstreamHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            'Referer': upstreamReferer,
            'Origin': upstreamOrigin,
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9'
        };

        const fetchInit = {
            method: context.request.method,
            headers: upstreamHeaders
        };
        if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
            fetchInit.body = context.request.body;
            fetchInit.duplex = 'half';
        }

        const upstreamResponse = await fetch(parsedTarget.toString(), fetchInit);

        if (!upstreamResponse.ok) {
            return new Response(`Upstream returned ${upstreamResponse.status}`, {
                status: upstreamResponse.status,
                headers: { 'Access-Control-Allow-Origin': '*' }
            });
        }

        // If target is a JavaScript file or provider plugin, return with application/javascript
        if (parsedTarget.pathname.endsWith('.js') || targetUrl.includes('.js') || parsedTarget.pathname.includes('/jwp/')) {
            const jsText = await upstreamResponse.text();
            return new Response(jsText, {
                status: 200,
                headers: {
                    'Content-Type': 'application/javascript; charset=utf-8',
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'public, max-age=3600',
                    'X-Embed-Version': '10.9.15'
                }
            });
        }

        // If target is a CSS stylesheet, return with text/css
        if (parsedTarget.pathname.endsWith('.css') || targetUrl.includes('.css')) {
            const cssText = await upstreamResponse.text();
            return new Response(cssText, {
                status: 200,
                headers: {
                    'Content-Type': 'text/css; charset=utf-8',
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'public, max-age=86400',
                    'X-Embed-Version': '10.9.15'
                }
            });
        }

        const upstreamContentType = upstreamResponse.headers.get('content-type') || '';

        // If target is an API response or JSON, return application/json
        if (upstreamContentType.includes('application/json') || parsedTarget.pathname.endsWith('.json') || parsedTarget.pathname.endsWith('/fetch')) {
            const jsonText = await upstreamResponse.text();
            return new Response(jsonText, {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'no-cache',
                    'X-Embed-Version': '10.9.15'
                }
            });
        }

        // If target is an image or font asset, stream binary with full CORS
        if (upstreamContentType.includes('image/') || upstreamContentType.includes('font/') ||
            parsedTarget.pathname.match(/\.(woff2?|ttf|eot|png|jpe?g|gif|svg|ico)$/i)) {
            return new Response(upstreamResponse.body, {
                status: 200,
                headers: {
                    'Content-Type': upstreamContentType || 'application/octet-stream',
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'public, max-age=86400',
                    'X-Embed-Version': '10.9.15'
                }
            });
        }

        // If target is a WebAssembly binary, return with application/wasm
        if (parsedTarget.pathname.endsWith('.wasm') || targetUrl.includes('.wasm')) {
            return new Response(upstreamResponse.body, {
                status: 200,
                headers: {
                    'Content-Type': 'application/wasm',
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'public, max-age=86400',
                    'X-Embed-Version': '10.9.14'
                }
            });
        }

        // If target is an HLS playlist (.m3u8), proxy with Apple MPEGURL MIME type and rewrite relative chunks
        if (parsedTarget.pathname.endsWith('.m3u8') || targetUrl.includes('.m3u8')) {
            let m3u8Text = await upstreamResponse.text();
            const baseUrl = parsedTarget.href.substring(0, parsedTarget.href.lastIndexOf('/') + 1);
            m3u8Text = m3u8Text.split('\n').map(line => {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
                    const absUrl = new URL(trimmed, baseUrl).href;
                    return `${requestUrl.origin}/api/embed?url=${encodeURIComponent(absUrl)}`;
                } else if (trimmed && (trimmed.startsWith('http://') || trimmed.startsWith('https://'))) {
                    return `${requestUrl.origin}/api/embed?url=${encodeURIComponent(trimmed)}`;
                }
                return line;
            }).join('\n');

            return new Response(m3u8Text, {
                status: 200,
                headers: {
                    'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                    'Cache-Control': 'no-cache',
                    'X-Embed-Version': '10.9.15'
                }
            });
        }

        // If target is a media segment (.ts, .m4s, .key), stream binary directly with full CORS
        if (parsedTarget.pathname.endsWith('.ts') || targetUrl.includes('.ts') ||
            parsedTarget.pathname.endsWith('.m4s') || targetUrl.includes('.m4s') ||
            parsedTarget.pathname.endsWith('.key') || targetUrl.includes('.key')) {
            return new Response(upstreamResponse.body, {
                status: 200,
                headers: {
                    'Content-Type': upstreamResponse.headers.get('content-type') || 'application/octet-stream',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                    'Cache-Control': 'public, max-age=86400',
                    'X-Embed-Version': '10.9.14'
                }
            });
        }

        let html = await upstreamResponse.text();

        // Safe storage check, player engine search sync, audio unmuting, and loading overlay dismiss
        const injectScript = `<script>
(function() {

    // 0. Disable DevTool traps & neutralize console inspection
    try {
        var dummyDevtool = function() {};
        dummyDevtool.isSuspend = true;
        dummyDevtool.isRunning = false;
        dummyDevtool.md5 = function() { return ''; };
        try {
            Object.defineProperty(window, 'DisableDevtool', { value: dummyDevtool, writable: false, configurable: true });
            Object.defineProperty(window, 'disableDevtool', { value: dummyDevtool, writable: false, configurable: true });
        } catch(e) {}
        console.clear = function() {};
        console.table = function() {};
    } catch(e) {}

    // Location guard: permanently prevent redirects to about:blank across all prototypes & frames
    try {
        var guardUrl = function(u) { return !u || u === 'about:blank' || (typeof u === 'string' && u.includes('about:blank')); };
        var origReplace = window.location.replace;
        window.location.replace = function(url) {
            if (guardUrl(url)) return;
            return origReplace.call(window.location, url);
        };
        var origAssign = window.location.assign;
        window.location.assign = function(url) {
            if (guardUrl(url)) return;
            return origAssign.call(window.location, url);
        };
        if (typeof Location !== 'undefined' && Location.prototype) {
            var origProtoReplace = Location.prototype.replace;
            Location.prototype.replace = function(url) {
                if (guardUrl(url)) return;
                return origProtoReplace.call(this, url);
            };
            var origProtoAssign = Location.prototype.assign;
            Location.prototype.assign = function(url) {
                if (guardUrl(url)) return;
                return origProtoAssign.call(this, url);
            };
            var hrefDesc = Object.getOwnPropertyDescriptor(Location.prototype, 'href');
            if (hrefDesc && hrefDesc.set) {
                var origHrefSet = hrefDesc.set;
                Object.defineProperty(Location.prototype, 'href', {
                    set: function(val) {
                        if (guardUrl(val)) return;
                        return origHrefSet.call(this, val);
                    }
                });
            }
        }
        // Protect body against wipeout
        var origBodyDesc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
        if (origBodyDesc && origBodyDesc.set && typeof HTMLBodyElement !== 'undefined') {
            var origInnerHTMLSet = origBodyDesc.set;
            Object.defineProperty(HTMLBodyElement.prototype, 'innerHTML', {
                set: function(val) {
                    if (val === "" && this.children && this.children.length > 0) return;
                    return origInnerHTMLSet.call(this, val);
                }
            });
        }
    } catch(e) {}

    // Universal CORS and stream proxy for WASM, IndianServers media streams, and root-relative endpoints
    try {
        var origFetch = window.fetch;
        window.fetch = function(input, init) {
            var urlStr = (typeof input === 'string') ? input : (input && input.url ? input.url : '');
            if (urlStr) {
                if (urlStr.includes('indianservers.st') && !urlStr.includes('/api/embed')) {
                    var proxied = (window.location.origin || '') + '/api/embed?url=' + encodeURIComponent(urlStr);
                    return origFetch.call(this, proxied, init);
                } else if ((urlStr.includes('/js/wasm/') || urlStr.includes('js/wasm/')) && !urlStr.includes('/api/embed')) {
                    var wasmFile = urlStr.split('/js/wasm/').pop().split('?')[0];
                    var localWasm = (window.location.origin || '') + '/js/wasm/' + wasmFile;
                    return origFetch.call(this, localWasm, init);
                } else if (urlStr.startsWith('/') && !urlStr.startsWith('/api/embed') && !urlStr.startsWith('/js/wasm/')) {
                    var proxied = (window.location.origin || '') + '/api/embed?url=' + encodeURIComponent("${parsedTarget.origin}" + urlStr);
                    return origFetch.call(this, proxied, init);
                }
            }
            return origFetch.apply(this, arguments);
        };

        var origXhrOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
            var target = String(url || '');
            if (target.includes('indianservers.st') && !target.includes('/api/embed')) {
                target = (window.location.origin || '') + '/api/embed?url=' + encodeURIComponent(target);
            } else if ((target.includes('/js/wasm/') || target.includes('js/wasm/')) && !target.includes('/api/embed')) {
                var wasmFile = target.split('/js/wasm/').pop().split('?')[0];
                target = (window.location.origin || '') + '/js/wasm/' + wasmFile;
            } else if (target.startsWith('/') && !target.startsWith('/api/embed') && !target.startsWith('/js/wasm/')) {
                target = (window.location.origin || '') + '/api/embed?url=' + encodeURIComponent("${parsedTarget.origin}" + target);
            }
            return origXhrOpen.call(this, method, target, async !== false, user, password);
        };
    } catch(e) {}

    // Dynamic nested iframe interception (e.g. dynmeadow or rockyembed)
    try {
        var origIframeSrc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
        if (origIframeSrc && origIframeSrc.set) {
            Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
                set: function(val) {
                    if (val && typeof val === 'string' && !val.includes('/api/embed') && (val.startsWith('http://') || val.startsWith('https://'))) {
                        val = (window.location.origin || '') + '/api/embed?url=' + encodeURIComponent(val);
                    }
                    return origIframeSrc.set.call(this, val);
                },
                get: origIframeSrc.get,
                configurable: true
            });
        }
        var origSetAttr = Element.prototype.setAttribute;
        Element.prototype.setAttribute = function(name, val) {
            if (this instanceof HTMLIFrameElement && String(name).toLowerCase() === 'src') {
                if (val && typeof val === 'string' && !val.includes('/api/embed') && (val.startsWith('http://') || val.startsWith('https://'))) {
                    val = (window.location.origin || '') + '/api/embed?url=' + encodeURIComponent(val);
                }
            }
            return origSetAttr.call(this, name, val);
        };
    } catch(e) {}

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
        var spoofPath = "${parsedTarget.pathname || '/'}";
        var spoofSearch = "${parsedTarget.search || ''}";
        var pVal = "${parsedTarget.searchParams.get('p') || requestUrl.searchParams.get('p') || ''}";
        var reqEngine = "${reqEngine || ''}";

        try {
            var targetSearch = window.location.search;
            if (pVal) {
                var finalParams = new URLSearchParams(targetSearch);
                finalParams.set('p', pVal);
                if (reqEngine && reqEngine !== 'bitmovin') finalParams.set('player', reqEngine);
                targetSearch = '?' + finalParams.toString();
            }
            if (window.location.pathname !== spoofPath && typeof history.replaceState === 'function') {
                history.replaceState(null, '', spoofPath + (spoofSearch || targetSearch || ''));
            }
        } catch(e) {}

        if (typeof Location !== 'undefined' && Location.prototype) {
            var origPathDesc = Object.getOwnPropertyDescriptor(Location.prototype, 'pathname');
            if (origPathDesc && origPathDesc.configurable) {
                Object.defineProperty(Location.prototype, 'pathname', {
                    get: function() {
                        var cur = origPathDesc.get ? origPathDesc.get.call(this) : window.location.pathname;
                        if (cur === '/api/embed' || cur === '/' || !cur) return spoofPath;
                        return cur;
                    },
                    set: origPathDesc.set,
                    configurable: true
                });
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
            try {
                v.muted = false;
                v.volume = 1.0;
                if (v.paused) {
                    v.play().catch(function() {
                        v.muted = true;
                        v.play().catch(function() {});
                    });
                }
            } catch(e) {}
        }
        var mutedElements = document.querySelectorAll('.bmpui-ui-volumetogglebutton.bmpui-muted, button.bmpui-muted, .op-volume--muted');
        for (var j = 0; j < mutedElements.length; j++) {
            mutedElements[j].classList.remove('bmpui-muted', 'op-volume--muted');
        }
    }

    function ensurePlayback(v) {
        if (!v) return;
        if (v.paused) {
            v.muted = true;
            var playPromise = v.play();
            if (playPromise !== undefined) {
                playPromise.catch(function() {
                    v.muted = true;
                    v.play().catch(function() {});
                });
            }
        }
    }

    // Audio unmuting is strictly triggered upon genuine user interaction
    // (Never on autoplay 'play' or 'playing' which causes browsers to pause playback with a black screen!)
    document.addEventListener('click', syncAndUnmuteAudio, true);
    document.addEventListener('touchstart', syncAndUnmuteAudio, true);

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

    // Safety fallback: auto-hide after 2 seconds once player initializes
    setTimeout(function() {
        var vids = document.querySelectorAll('video');
        if (vids.length > 0) hideStreamLoadingOverlay();
    }, 2000);
})();
</script>
<style>
/* Block third-party VPN promotional popups, ad overlays, and intrusive modals */
[class*="vpn"], [id*="vpn"],
[class*="popup"], [id*="popup"]:not(#player-modal),
[class*="promo"], [id*="promo"],
[class*="banner-ad"], [id*="banner-ad"],
#html1, #button1, [id*="html1"], [id*="button1"],
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
        html = html.replace(/<script[^>]*popa[^>]*><\/script>/gi, '<!-- ad popup removed -->');
        html = html.replace(/<script[^>]*cdn4ads[^>]*><\/script>/gi, '<!-- ad popup removed -->');
        html = html.replace(/<script[^>]*disable-devtool[^>]*><\/script>/gi, '<!-- devtool disabled -->');
        html = html.replace(/<iframe[^>]*src=["'][^"']*ad\.html[^"']*["'][^>]*><\/iframe>/gi, '<!-- ad iframe removed -->');
        html = html.replace(/<iframe[^>]*src=["'][^"']*ad\.html[^"']*["'][^>]*>/gi, '<!-- ad iframe removed -->');

        // Neutralize sportsonnline ad overlays
        html = html.replace(/<div[^>]*id=["']html1["'][\s\S]*?<\/div>/gi, '');
        html = html.replace(/<div[^>]*id=["']button1["'][\s\S]*?<\/div>/gi, '');

        // Rewrite static nested iframes (such as dynmeadow.net in sportsonnline or rockyembed.st in embed.st)
        html = html.replace(/<iframe([^>]*?)src=["'](https?:\/\/[^"']+)["']([^>]*)>/gi, (match, before, srcUrl, after) => {
            if (srcUrl.includes('ad.html')) return '<!-- ad iframe removed -->';
            return `<iframe${before}src="${requestUrl.origin}/api/embed?url=${encodeURIComponent(srcUrl)}"${after}>`;
        });

        // Rewrite root-relative scripts and stylesheets (e.g. dynmeadow.net /assets/stream.js) through /api/embed with full CORS
        html = html.replace(/<script([^>]*?)src=["'](\/[^"']+)["']([^>]*)>/gi, (match, before, srcPath, after) => {
            if (srcPath.startsWith('//')) {
                return `<script${before}src="https:${srcPath}"${after}>`;
            }
            return `<script${before}src="${requestUrl.origin}/api/embed?url=${encodeURIComponent(parsedTarget.origin + srcPath)}"${after}>`;
        });
        html = html.replace(/<link([^>]*?)href=["'](\/[^"']+)["']([^>]*)>/gi, (match, before, hrefPath, after) => {
            if (hrefPath.startsWith('//')) {
                return `<link${before}href="https:${hrefPath}"${after}>`;
            }
            return `<link${before}href="${requestUrl.origin}/api/embed?url=${encodeURIComponent(parsedTarget.origin + hrefPath)}"${after}>`;
        });

        // Neutralize domain checks and anti-iframe checks on StreamCorner / Getsugatensho feeds
        html = html.replace(/function\s+e\s*\(\)\s*\{var\s+e,t;/g, 'function e(){return;var e,t;');
        html = html.replace(/if\s*\(\s*-\s*__p_[a-zA-Z0-9_$]+\[0x1\]\s*===\s*\[/g, 'if(false&&-1===[');
        html = html.replace(/if\s*\(\s*-\s*__p_[a-zA-Z0-9_$]+_dlrArray\[0x1\]\s*===\s*\[/g, 'if(false&&-1===[');
        html = html.replace(/if\s*\(\s*!\s*g\s*\|\|\s*!\s*C\s*\)\s*\{/g, 'if(false){');

        // Neutralize any residual obfuscated location.replace("about:blank") calls
        html = html.replace(/\]\(__p_[a-zA-Z0-9_$]+_STR_\d+\(0x236[^)]*\)\)/g, '](null)');
        html = html.replace(/\]\(__p_[a-zA-Z0-9_$]+_STR_\d+\(0x214[^)]*\)\)/g, '](null)');
        html = html.replace(/\]\(__p_[a-zA-Z0-9_$]+_STR_\d+\(0x409[^)]*\)\)/g, '](null)');

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
        responseHeaders.set('X-Embed-Version', '10.9.13');

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
