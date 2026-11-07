/**
 * Cloudflare Pages Function: /api/sports
 * Proxies and caches the automated real-time sports JSON feed.
 * Provides instant global edge caching with automatic refresh.
 */

const UPSTREAM_URL = "https://raw.githubusercontent.com/sm-monirulislam/Upcoming-and-Live-Sports-Data/main/Sports_data.json";

export async function onRequest(context) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json; charset=utf-8'
    };

    if (context.request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const cache = caches.default;
        const cacheKey = new Request("https://aryanstreamspro.internal/cache/sports_data_v2.json");
        let cachedResponse = await cache.match(cacheKey);

        if (cachedResponse) {
            const resHeaders = new Headers(cachedResponse.headers);
            resHeaders.set('Access-Control-Allow-Origin', '*');
            resHeaders.set('X-Cache-Status', 'HIT');
            return new Response(cachedResponse.body, {
                status: cachedResponse.status,
                headers: resHeaders
            });
        }

        const upstreamRes = await fetch(UPSTREAM_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            },
            cf: {
                cacheTtl: 45,
                cacheEverything: true
            }
        });

        if (!upstreamRes.ok) {
            throw new Error(`Upstream returned ${upstreamRes.status}`);
        }

        const dataText = await upstreamRes.text();
        const responseHeaders = {
            ...corsHeaders,
            'Cache-Control': 'public, max-age=45, stale-while-revalidate=90',
            'X-Cache-Status': 'MISS'
        };

        const edgeResponse = new Response(dataText, {
            status: 200,
            headers: responseHeaders
        });

        context.waitUntil(cache.put(cacheKey, edgeResponse.clone()));
        return edgeResponse;
    } catch (err) {
        return new Response(JSON.stringify({
            error: "Failed to fetch live sports data",
            message: err.message,
            fallback_url: UPSTREAM_URL
        }), {
            status: 502,
            headers: corsHeaders
        });
    }
}
