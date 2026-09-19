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

    if (!targetUrl) {
        return new Response('Missing target url parameter', {
            status: 400,
            headers: {
                'Content-Type': 'text/plain',
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

        const upstreamResponse = await fetch(parsedTarget.toString(), {
            method: context.request.method,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                'Referer': 'https://streamcorner.foo/',
                'Origin': 'https://streamcorner.foo',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        if (!upstreamResponse.ok) {
            return new Response(`Upstream returned ${upstreamResponse.status}`, {
                status: upstreamResponse.status,
                headers: { 'Access-Control-Allow-Origin': '*' }
            });
        }

        let html = await upstreamResponse.text();

        // NOTE: Old static neutralization patterns (qP9EJg, s0TamperCheck) removed — 
        // upstream uses polymorphic obfuscation with variable names that change on each page load.
        // All anti-tamper neutralization is now done via runtime script injection below.

        // Comprehensive runtime anti-tamper neutralization
        const injectScript = `<script>
(function() {
    // === ANTI-IFRAME DETECTION BYPASS ===
    // The obfuscated code checks window.top !== window.self to detect iframe embedding.
    // We make window.top return window.self so the check always passes.
    try {
        Object.defineProperty(window, 'top', {
            get: function() { return window.self; },
            configurable: false
        });
    } catch(e) {}

    // Also fake parent to point to self
    try {
        Object.defineProperty(window, 'parent', {
            get: function() { return window.self; },
            configurable: false
        });
    } catch(e) {}

    // Fake frameElement to null (top-level windows have frameElement === null)
    try {
        Object.defineProperty(window, 'frameElement', {
            get: function() { return null; },
            configurable: false
        });
    } catch(e) {}

    // === DOM WIPE PROTECTION ===
    // Block any destructive innerHTML/outerHTML writes on html/body elements
    try {
        var origInnerSet = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML').set;
        var origInnerGet = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML').get;
        Object.defineProperty(Element.prototype, 'innerHTML', {
            set: function(val) {
                if (typeof val === 'string') {
                    var tag = this.tagName;
                    if (tag === 'HTML' || tag === 'BODY') {
                        // Block destructive wipes: empty string, very short content, or error messages
                        var trimmed = val.trim();
                        if (trimmed.length < 200 || 
                            trimmed.indexOf('Unable to play') !== -1 || 
                            trimmed.indexOf('Browser not supported') !== -1 ||
                            trimmed.indexOf('not supported') !== -1) {
                            return;
                        }
                    }
                }
                return origInnerSet.call(this, val);
            },
            get: function() { return origInnerGet.call(this); },
            configurable: true
        });
    } catch(e) {}

    // Guard outerHTML on html/body too
    try {
        var origOuterSet = Object.getOwnPropertyDescriptor(Element.prototype, 'outerHTML').set;
        var origOuterGet = Object.getOwnPropertyDescriptor(Element.prototype, 'outerHTML').get;
        Object.defineProperty(Element.prototype, 'outerHTML', {
            set: function(val) {
                var tag = this.tagName;
                if ((tag === 'HTML' || tag === 'BODY') && typeof val === 'string' && val.trim().length < 200) return;
                return origOuterSet.call(this, val);
            },
            get: function() { return origOuterGet.call(this); },
            configurable: true
        });
    } catch(e) {}

    // Block document.write from wiping the page after load
    try {
        var origWrite = document.write;
        document.write = function(s) {
            if (document.readyState === 'complete' || document.readyState === 'interactive') {
                if (typeof s === 'string' && (s.trim().length < 200 || s.indexOf('not supported') !== -1)) return;
            }
            return origWrite.apply(this, arguments);
        };
        document.writeln = document.write;
    } catch(e) {}

    // Block document.open from clearing the page after load
    try {
        var origOpen = document.open;
        document.open = function() {
            if (document.readyState === 'complete' || document.readyState === 'interactive') return document;
            return origOpen.apply(this, arguments);
        };
    } catch(e) {}

    // === URL SYNC ===
    // Sync parameters from upstream target URL into window.location
    try {
        var targetSearch = '${parsedTarget.search || ""}';
        var curUrl = new URL(window.location.href);
        var modified = false;

        if (targetSearch) {
            var targetParams = new URLSearchParams(targetSearch);
            targetParams.forEach(function(val, key) {
                if (curUrl.searchParams.get(key) !== val) {
                    curUrl.searchParams.set(key, val);
                    modified = true;
                }
            });
        }

        var reqEngine = '${reqEngine || ""}';
        if (reqEngine) {
            if (reqEngine === 'bitmovin') {
                if (curUrl.searchParams.has('player')) {
                    curUrl.searchParams.delete('player');
                    modified = true;
                }
            } else {
                if (curUrl.searchParams.get('player') !== reqEngine) {
                    curUrl.searchParams.set('player', reqEngine);
                    modified = true;
                }
            }
        }

        if (modified) {
            window.history.replaceState(null, '', curUrl.pathname + curUrl.search);
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
            if (v.muted) v.muted = false;
            if (v.volume === 0) v.volume = 1.0;
        }
        var mutedElements = document.querySelectorAll('.bmpui-ui-volumetogglebutton.bmpui-muted, button.bmpui-muted, .op-volume--muted');
        for (var j = 0; j < mutedElements.length; j++) {
            mutedElements[j].classList.remove('bmpui-muted', 'op-volume--muted');
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
            if (!v.paused || v.currentTime > 0 || v.readyState >= 2) {
                hideStreamLoadingOverlay();
                syncAndUnmuteAudio();
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
#loading-overlay.hidden,
#loading-overlay.force-hide,
#loading-overlay[style*="display: none"] {
    display: none !important;
    opacity: 0 !important;
    visibility: hidden !important;
    pointer-events: none !important;
}
</style>`;
        html = html.replace('<head>', `<head>\n    ${injectScript}`);

        // Neutralize annoying popup scripts
        html = html.replace(/aclib\.runPop\([^)]*\)/g, '/* ad popup removed */');

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
