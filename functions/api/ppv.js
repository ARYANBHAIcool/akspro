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

    const reqUrl = new URL(context.request.url);
    const endpointParam = (reqUrl.searchParams.get('endpoint') || reqUrl.searchParams.get('type') || '').toLowerCase();

    // Route: /api/ppv?endpoint=all (Complete fixtures schedule proxy with edge caching)
    if (endpointParam === 'all' || endpointParam === 'schedule' || endpointParam === 'matches') {
        const scheduleMirrors = [
            'https://streamed.pk/api/matches/all',
            'https://damitv.st/papi/matches/all-today'
        ];
        for (const mirror of scheduleMirrors) {
            try {
                const sResp = await fetch(mirror, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                        'Accept': 'application/json'
                    }
                });
                if (sResp.ok) {
                    const data = await sResp.json();
                    if (Array.isArray(data) && data.length > 0) {
                        return new Response(JSON.stringify(data), {
                            status: 200,
                            headers: {
                                'Content-Type': 'application/json; charset=utf-8',
                                'Access-Control-Allow-Origin': '*',
                                'Cache-Control': 'public, max-age=60, s-maxage=60'
                            }
                        });
                    }
                }
            } catch (e) {}
        }
    }

    // Route: /api/ppv?endpoint=futbolx (FutbolX active streams proxy with edge caching)
    if (reqUrl.pathname.includes('/api/futbolx') || endpointParam === 'futbolx' || endpointParam === 'fx') {
        const isTokenReq = reqUrl.searchParams.get('token') === '1' || reqUrl.searchParams.has('path');
        if (isTokenReq) {
            let streamUrl = reqUrl.searchParams.get('url') || '';
            let path = reqUrl.searchParams.get('path') || '';
            let sourceHost = reqUrl.searchParams.get('sourceHost') || '';
            if (streamUrl && !path) {
                try {
                    const u = new URL(streamUrl);
                    path = u.pathname;
                    sourceHost = u.hostname;
                } catch (e) {}
            }
            if (path && sourceHost) {
                try {
                    const tokenApiUrl = `https://www.futbol-x.xyz/api/token.js?path=${encodeURIComponent(path)}&sourceHost=${encodeURIComponent(sourceHost)}&expires=900`;
                    const tResp = await fetch(tokenApiUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                            'Referer': 'https://www.futbol-x.xyz/'
                        }
                    });
                    if (tResp.ok) {
                        const data = await tResp.json();
                        return new Response(JSON.stringify(data), {
                            status: 200,
                            headers: {
                                'Content-Type': 'application/json; charset=utf-8',
                                'Access-Control-Allow-Origin': '*',
                                'Cache-Control': 'public, max-age=300'
                            }
                        });
                    }
                } catch (e) {}
            }
            return new Response(JSON.stringify({ success: false, error: 'Token generation failed' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
            });
        }

        try {
            const streamRes = await fetch('https://www.futbol-x.xyz/api/stream', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                    'Referer': 'https://www.futbol-x.xyz/'
                }
            });
            if (streamRes.ok) {
                const { categories } = await streamRes.json();
                const validCats = Array.isArray(categories) ? categories.filter(c => typeof c === 'string' && c.trim().length > 0) : [];
                const now = Date.now();

                const catPromises = validCats.map(async cat => {
                    try {
                        const cResp = await fetch(`https://www.futbol-x.xyz/api/${cat}.json`, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                                'Referer': 'https://www.futbol-x.xyz/'
                            }
                        });
                        if (!cResp.ok) return [];
                        const cData = await cResp.json();
                        const events = [];
                        if (cData && Array.isArray(cData.streams)) {
                            for (const group of cData.streams) {
                                if (group && Array.isArray(group.streams)) {
                                    for (const ev of group.streams) {
                                        if (!ev || !ev.name) continue;
                                        const start = ev.starts_at ? new Date(ev.starts_at).getTime() : 0;
                                        const end = ev.ends_at ? new Date(ev.ends_at).getTime() : (start ? start + 10800000 : 0);
                                        // Filter out matches that ended more than 15 minutes ago
                                        if (end > 0 && now > (end + 900000) && !ev.always_live) continue;

                                        const activeStreams = (ev.streams || []).filter(s => s && s.url && s.url.trim().length > 0);
                                        events.push({
                                            id: `fx-${ev.uri_name || Math.random().toString(36).slice(2, 8)}`,
                                            uri_name: ev.uri_name,
                                            title: (ev.name || '').trim(),
                                            tag: (ev.tag || '').trim(),
                                            category: cat,
                                            poster: ev.poster || '',
                                            starts_at: ev.starts_at || '',
                                            ends_at: ev.ends_at || '',
                                            always_live: ev.always_live || 0,
                                            streams: activeStreams
                                        });
                                    }
                                }
                            }
                        }
                        return events;
                    } catch (e) {
                        return [];
                    }
                });
                const allResults = await Promise.all(catPromises);
                const matches = allResults.flat();
                return new Response(JSON.stringify({ success: true, count: matches.length, matches }), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8',
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': 'public, max-age=60, s-maxage=60'
                    }
                });
            }
        } catch (e) {}
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

            let rawPoster = item.poster || item.image || '';
            if (rawPoster.startsWith('/api/images') || rawPoster.startsWith('/images') || rawPoster.startsWith('api/images')) {
                rawPoster = 'https://streamed.pk/' + rawPoster.replace(/^\/+/, '');
            }
            const cleanPoster = (rawPoster && (rawPoster.includes('streamed.pk') || rawPoster.includes('static.ppvservices.st')))
                ? `https://wsrv.nl/?url=${encodeURIComponent(rawPoster)}&w=480&output=webp`
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
                substreams: Array.isArray(item.substreams) ? item.substreams : [],
                teams: item.teams || (item.team1 && item.team2 ? { home: item.team1, away: item.team2 } : null)
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
