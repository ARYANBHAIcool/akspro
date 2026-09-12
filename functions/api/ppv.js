/**
 * Cloudflare Pages Function: High-Speed Proxy for PPV.st Streams API
 * Route: /api/ppv
 * 
 * Bypasses local ISP blocks (Jio/Airtel/etc.) on .st domains
 * and delivers authentic PPV streams to mobile and PC users worldwide.
 */

export async function onRequest(context) {
    if (context.request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': '*',
                'Access-Control-Max-Age': '86400'
            }
        });
    }

    try {
        const upstreamResponse = await fetch('https://api.ppv.st/api/streams', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Referer': 'https://ppv.st/'
            }
        });

        if (!upstreamResponse.ok) {
            throw new Error(`Upstream returned ${upstreamResponse.status}`);
        }

        const data = await upstreamResponse.text();
        return new Response(data, {
            status: 200,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=60'
            }
        });
    } catch (err) {
        // Fallback to damitv if api.ppv.st fails
        try {
            const fallbackResp = await fetch('https://damitv.st/papi/matches/all-today', {
                headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
            });
            const raw = await fallbackResp.text();
            return new Response(raw, {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'public, max-age=60'
                }
            });
        } catch (e2) {
            return new Response(JSON.stringify({ error: err.message }), {
                status: 502,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }
    }
}
