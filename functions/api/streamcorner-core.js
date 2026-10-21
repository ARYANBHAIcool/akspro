/**
 * Cloudflare Pages Function: StreamCorner Core Proxy
 * Route: /api/streamcorner-core
 */
export async function onRequest(context) {
    if (context.request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': '*'
            }
        });
    }

    try {
        const assetUrl = new URL('/js/paramount-core.js', context.request.url);
        const assetRes = await context.env.ASSETS.fetch(new Request(assetUrl));
        const resHeaders = new Headers(assetRes.headers);
        resHeaders.set('Access-Control-Allow-Origin', '*');
        resHeaders.set('Content-Type', 'application/javascript; charset=utf-8');
        return new Response(assetRes.body, {
            status: assetRes.status,
            headers: resHeaders
        });
    } catch(e) {
        return new Response('/* core asset fetch error */', { status: 500 });
    }
}
