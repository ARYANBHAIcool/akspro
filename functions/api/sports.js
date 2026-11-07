/**
 * Cloudflare Pages Function: /api/sports
 * Proxies and caches the automated real-time sports JSON feed.
 * Features multi-mirror failover (GitHub Raw + JSDelivr CDN) with global edge caching.
 */

const UPSTREAM_MIRRORS = [
    "https://raw.githubusercontent.com/sm-monirulislam/Upcoming-and-Live-Sports-Data/main/Sports_data.json",
    "https://cdn.jsdelivr.net/gh/sm-monirulislam/Upcoming-and-Live-Sports-Data@main/Sports_data.json"
];

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
        const cacheKey = new Request("https://aryanstreamspro.internal/cache/sports_data_v3.json");
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

        let dataText = null;
        let lastError = null;

        for (const mirror of UPSTREAM_MIRRORS) {
            try {
                const upstreamRes = await fetch(mirror, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                        'Accept': 'application/json'
                    },
                    cf: {
                        cacheTtl: 45,
                        cacheEverything: true
                    }
                });

                if (upstreamRes.ok) {
                    const text = await upstreamRes.text();
                    if (text && text.length > 500 && text.includes('"matches"')) {
                        dataText = text;
                        break;
                    }
                }
            } catch (err) {
                lastError = err;
            }
        }

        if (!dataText) {
            throw new Error(lastError ? lastError.message : "All upstream mirrors unavailable");
        }

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
            fallback_urls: UPSTREAM_MIRRORS
        }), {
            status: 502,
            headers: corsHeaders
        });
    }
}
