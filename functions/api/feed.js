/**
 * Cloudflare Pages Function: Live Flashscore Feed & TV Channels Proxy
 * Proxies Flashscore live scores and fixtures with x-fsign and CORS headers
 */

export async function onRequest(context) {
    const url = new URL(context.request.url);
    const path = url.searchParams.get('path') || 'f_1_0_2_en_1';
    const targetUrl = `https://1.newsoccers.one/2/x/feed/${path}`;

    try {
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                'X-Fsign': 'SW9D1eZo',
                'Origin': 'https://dzeko11.pk',
                'Referer': 'https://dzeko11.pk/',
                'Accept': '*/*'
            }
        });

        if (!response.ok) {
            return new Response(`Feed error: ${response.status}`, {
                status: response.status,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'text/plain'
                }
            });
        }

        const data = await response.text();
        return new Response(data, {
            status: 200,
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=15, stale-while-revalidate=30'
            }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}
