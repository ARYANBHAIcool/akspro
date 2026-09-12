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

        // Safe storage check, player engine search sync, audio unmuting, and loading overlay dismiss
        const injectScript = `<script>
(function() {
    // Route Amazon Nitro/CloudFront CDN requests via /api/nitro with allowed origin
    var nitroBase = (window.location.origin || '') + '/api/nitro?url=';
    var origFetch = window.fetch;
    window.fetch = function(input, init) {
        var args = Array.prototype.slice.call(arguments);
        try {
            var urlStr = '';
            if (typeof input === 'string') {
                urlStr = input;
            } else if (input && input.url) {
                urlStr = input.url;
            } else if (input && input.href) {
                urlStr = input.href;
            } else if (input) {
                urlStr = String(input);
            }
            if (urlStr && !urlStr.startsWith(nitroBase) && (urlStr.includes('aiv-cdn.net') || urlStr.includes('cenc.mpd') || urlStr.includes('pv-cdn.net') || (urlStr.includes('.mpd') && !urlStr.includes('akamaized')))) {
                var proxied = nitroBase + encodeURIComponent(urlStr);
                if (typeof input === 'string') {
                    input = proxied;
                } else if (input && input.url) {
                    input = new Request(proxied, input);
                } else {
                    input = proxied;
                }
                args[0] = input;
            }
        } catch (e) {}
        return origFetch.apply(this, args);
    };

    var origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, async, user, pass) {
        var args = Array.prototype.slice.call(arguments);
        try {
            var urlStr = '';
            if (typeof url === 'string') {
                urlStr = url;
            } else if (url && url.href) {
                urlStr = url.href;
            } else if (url) {
                urlStr = String(url);
            }
            if (urlStr && !urlStr.startsWith(nitroBase) && (urlStr.includes('aiv-cdn.net') || urlStr.includes('cenc.mpd') || urlStr.includes('pv-cdn.net') || (urlStr.includes('.mpd') && !urlStr.includes('akamaized')))) {
                url = nitroBase + encodeURIComponent(urlStr);
                args[1] = url;
            }
        } catch (e) {}
        return origOpen.apply(this, args);
    };

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
        var targetSearch = '${parsedTarget.search || ""}';
        if (targetSearch) {
            var curUrl = new URL(window.location.href);
            var pVal = new URLSearchParams(targetSearch).get('p');
            if (pVal && !curUrl.searchParams.has('p')) {
                curUrl.searchParams.set('p', pVal);
                window.history.replaceState(null, '', curUrl.pathname + curUrl.search);
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
