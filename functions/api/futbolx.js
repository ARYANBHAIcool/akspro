/**
 * FutbolX API Proxy & Aggregator
 * Provides high-speed edge caching for FutbolX sports fixtures, active live stream channels,
 * and Flussonic token signing for direct HLS playback.
 */
export async function onRequest(context) {
    if (context.request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': '*',
                'Access-Control-Max-Age': '86400',
            }
        });
    }

    const reqUrl = new URL(context.request.url);
    const isTokenReq = reqUrl.searchParams.get('token') === '1' || reqUrl.searchParams.has('path');

    // Route 1: Token signing proxy for Flussonic stream URLs
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

    // Route 2: Complete fixtures & stream channels aggregation with edge caching
    try {
        const streamRes = await fetch('https://www.futbol-x.xyz/api/stream', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                'Referer': 'https://www.futbol-x.xyz/'
            }
        });
        if (!streamRes.ok) {
            return new Response(JSON.stringify({ success: false, error: 'Upstream stream list failed' }), {
                status: 502,
                headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
            });
        }
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
            } catch (err) {
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
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
        });
    }
}
