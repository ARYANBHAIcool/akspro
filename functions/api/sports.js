/**
 * Cloudflare Pages Function: /api/sports
 * Proxies, caches, and delivers real-time sports JSON feed.
 * Delivers authentic match streams without indiscriminate channel dumping.
 * Parent channels registry is preserved separately in /api/channels.
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
        const cacheKey = new Request("https://aryanstreamspro.internal/cache/sports_data_v5.json");
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

        // Fetch upstream sports feed
        let upstreamRes = null;
        for (const mirror of UPSTREAM_MIRRORS) {
            try {
                const r = await fetch(mirror, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                        'Accept': 'application/json'
                    },
                    cf: { cacheTtl: 45, cacheEverything: true }
                });
                if (r.ok) {
                    const txt = await r.text();
                    if (txt && txt.length > 500 && txt.includes('"matches"')) {
                        upstreamRes = JSON.parse(txt);
                        break;
                    }
                }
            } catch (_) {}
        }

        if (!upstreamRes || !Array.isArray(upstreamRes.matches)) {
            throw new Error("Unable to fetch master sports feed from upstream mirrors");
        }

        // Return authentic matches directly without dumping unverified channels across matches
        const responsePayload = {
            ...upstreamRes,
            matches: upstreamRes.matches
        };

        const responseHeaders = {
            ...corsHeaders,
            'Cache-Control': 'public, max-age=45, stale-while-revalidate=90',
            'X-Cache-Status': 'MISS'
        };

        const edgeResponse = new Response(JSON.stringify(responsePayload), {
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
