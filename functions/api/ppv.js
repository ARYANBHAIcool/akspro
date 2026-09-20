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

    function transformDamiListToCategories(items) {
        if (!Array.isArray(items)) return [];
        const catMap = new Map();
        
        for (const item of items) {
            if (!item || (!item.id && !item.title)) continue;
            const rawCat = (item.category || 'sports').trim().toLowerCase();
            const catName = rawCat
                .split('-')
                .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ');

            if (!catMap.has(catName)) {
                catMap.set(catName, []);
            }

            const startSec = item.date ? (typeof item.date === 'number' ? Math.floor(item.date / 1000) : Math.floor(new Date(item.date).getTime() / 1000)) : 0;
            const endSec = startSec ? startSec + 10800 : 0;

            const rawPoster = item.poster || item.image || '';
            const cleanPoster = (rawPoster && rawPoster.includes('streamed.pk'))
                ? `https://wsrv.nl/?url=${encodeURIComponent(rawPoster)}`
                : rawPoster;

            catMap.get(catName).push({
                id: item.id,
                name: item.title,
                tag: item.league || catName,
                starts_at: startSec,
                ends_at: endSec,
                iframe: item.embedUrl || (item.id ? `https://embedindia.st/embed/${item.id}` : ''),
                poster: cleanPoster,
                popular: Boolean(item.popular),
                status: item.status || 'upcoming',
                category: rawCat,
                substreams: Array.isArray(item.substreams) ? item.substreams : []
            });
        }

        const streams = [];
        for (const [cat, streamList] of catMap.entries()) {
            streams.push({
                category: cat,
                streams: streamList
            });
        }
        return streams;
    }

    try {
        // Priority 1: Fetch authentic matches from damitv.st (works 100% on Cloudflare without datacenter IP blocks)
        const damitvResp = await fetch('https://damitv.st/papi/matches/all-today', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                'Referer': 'https://damitv.st/',
                'Accept': 'application/json'
            }
        });

        if (damitvResp.ok) {
            const rawList = await damitvResp.json();
            if (Array.isArray(rawList) && rawList.length > 0) {
                const categories = transformDamiListToCategories(rawList);
                return new Response(JSON.stringify({ success: true, streams: categories }), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8',
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': 'public, max-age=60'
                    }
                });
            }
        }
    } catch (err) {
        console.warn('damitv fetch failed in /api/ppv proxy:', err.message);
    }

    // Priority 2: Fallback to api.ppv.st
    try {
        const ppvResp = await fetch('https://api.ppv.st/api/streams', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Referer': 'https://ppv.st/'
            }
        });

        if (ppvResp.ok) {
            const json = await ppvResp.json();
            if (json && json.success !== false && Array.isArray(json.streams)) {
                return new Response(JSON.stringify(json), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8',
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': 'public, max-age=60'
                    }
                });
            }
        }
    } catch (e2) {
        console.warn('api.ppv.st fetch failed in /api/ppv proxy:', e2.message);
    }

    return new Response(JSON.stringify({ success: false, error: 'Could not retrieve feeds from upstream' }), {
        status: 502,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}
