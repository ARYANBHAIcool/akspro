/**
 * Cloudflare Pages Function: Proxy embedindia bundle.js
 * Route: /js/bundle.js
 */
export async function onRequest(context) {
    try {
        const res = await fetch('https://embedindia.st/js/bundle.js', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                'Referer': 'https://embedindia.st/'
            }
        });
        const js = await res.text();
        return new Response(js, {
            status: 200,
            headers: {
                'Content-Type': 'application/javascript; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=3600'
            }
        });
    } catch (e) {
        return new Response('console.error("bundle load error");', {
            status: 502,
            headers: { 'Content-Type': 'application/javascript' }
        });
    }
}
