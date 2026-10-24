/**
 * Cloudflare Pages Function: Universal WASM & Dynamic Module Proxy
 * Proxies /js/wasm/* assets from embedindia.st with CORS and correct MIME types
 * Route: /js/wasm/*
 */

export async function onRequest(context) {
    try {
        const subpath = Array.isArray(context.params.path) ? context.params.path.join('/') : (context.params.path || '');
        const targetUrl = `https://embedindia.st/js/wasm/${subpath}`;
        
        const res = await fetch(targetUrl, {
            method: context.request.method,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                'Referer': 'https://embedindia.st/',
                'Origin': 'https://embedindia.st',
                'Accept': '*/*'
            }
        });

        if (!res.ok) {
            return new Response(`Upstream returned ${res.status}`, { status: res.status });
        }

        const isWasm = subpath.endsWith('.wasm');
        const contentType = isWasm ? 'application/wasm' : 'application/javascript; charset=utf-8';
        const headers = new Headers();
        headers.set('Content-Type', contentType);
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        headers.set('Cache-Control', 'public, max-age=86400');

        return new Response(res.body, {
            status: 200,
            headers
        });
    } catch (e) {
        return new Response(`console.error("wasm load error: ${e.message}");`, {
            status: 502,
            headers: { 
                'Content-Type': 'application/javascript; charset=utf-8',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}
