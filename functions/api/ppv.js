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

            const nowSec = Math.floor(Date.now() / 1000);
            const startSec = item.date ? (typeof item.date === 'number' ? Math.floor(item.date / 1000) : Math.floor(new Date(item.date).getTime() / 1000)) : 0;
            const endSec = startSec ? startSec + 10800 : 0;

            // Filter out matches that have already finished / ended
            if (item.status === 'ended' || item.status === 'finished') {
                continue;
            }
            if (endSec > 0 && nowSec > (endSec + 900) && !item.always_live) {
                continue;
            }

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

    // Priority 1: Fetch authentic live matches directly from official api.ppv.st
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
                const nowSec = Math.floor(Date.now() / 1000);
                const activeStreams = json.streams.map(cat => ({
                    ...cat,
                    streams: (cat.streams || []).filter(s => {
                        const start = s.starts_at || 0;
                        const end = s.ends_at || (start ? start + 10800 : 0);
                        if (s.status === 'ended' || s.status === 'finished') return false;
                        if (end > 0 && nowSec > (end + 900) && !s.always_live) return false;
                        return true;
                    })
                })).filter(cat => cat.streams.length > 0);

                return new Response(JSON.stringify({ success: true, streams: activeStreams }), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8',
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': 'public, max-age=300, s-maxage=300'
                    }
                });
            }
        }
    } catch (e1) {
        console.warn('api.ppv.st fetch failed in /api/ppv proxy:', e1.message);
    }

    // Priority 2: Fallback to damitv.st if available
    try {
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
                        'Cache-Control': 'public, max-age=300, s-maxage=300'
                    }
                });
            }
        }
    } catch (err) {
        console.warn('damitv fetch failed in /api/ppv proxy:', err.message);
    }

    return new Response(JSON.stringify({ success: false, error: 'Could not retrieve feeds from upstream' }), {
        status: 502,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}
