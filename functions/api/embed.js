/**
 * Cloudflare Pages Function: Universal Stream Embed Proxy
 * Eliminates CSP 'frame-ancestors' and 'X-Frame-Options' restrictions
 * Allows StreamCorner, SportsEmbed, and Amazon stream players to embed and play seamlessly
 * Route: /api/embed
 */

export async function onRequest(context) {
    const requestUrl = new URL(context.request.url);
    const targetUrl = requestUrl.searchParams.get('url');

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

        // Forward any extra query parameters like ?player=shaka/bitmovin if not in target
        for (const [key, value] of requestUrl.searchParams.entries()) {
            if (key !== 'url' && !parsedTarget.searchParams.has(key)) {
                parsedTarget.searchParams.set(key, value);
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

        // Inject <base href="..."> so relative fonts, images, or assets load cleanly from upstream origin
        if (!html.includes('<base ') && html.includes('<head>')) {
            html = html.replace('<head>', `<head>\n    <base href="${parsedTarget.origin}/">`);
        }

        // Inject in-memory storage polyfills, cookie polyfill, and history search sync
        // This ensures the sandboxed opaque origin (Origin: null) never throws SecurityErrors
        // and enables Amazon AIV-CDN to return HTTP 200 without CORS/Manifest rejections
        const injectScript = `<script>
(function() {
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
        Object.defineProperty(document, 'cookie', { get: function() { return ''; }, set: function() {}, configurable: true });
    } catch (e) {}

    try {
        if (!window.location.search || window.location.search.indexOf('url=') !== -1) {
            window.history.replaceState(null, '', '${parsedTarget.search || ""}');
        }
    } catch (e) {}
})();
</script>`;
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
