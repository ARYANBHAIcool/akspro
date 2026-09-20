/**
 * Cloudflare Pages Function: Proxy for damitv.st & ppv services
 * Route: /api/damitv/*
 */

export async function onRequest(context) {
    const url = new URL(context.request.url);
    // Extract target path after /api/damitv/
    const targetPath = url.pathname.replace(/^\/api\/damitv\//, '');
    const search = url.search;
    
    const targetUrl = `https://damitv.st/${targetPath}${search}`;

    try {
        const response = await fetch(targetUrl, {
            method: context.request.method,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://damitv.st/',
                'Accept': 'application/json, text/plain, */*'
            }
        });

        const newHeaders = new Headers(response.headers);
        newHeaders.set('Access-Control-Allow-Origin', '*');
        newHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        newHeaders.set('Access-Control-Allow-Headers', '*');
        newHeaders.set('Cache-Control', 'public, max-age=60');

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 502,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}
