/**
 * Cloudflare Pages Function: High-Speed Proxy for PPV.st Streams API
 * Route: /api/ppv
 * 
 * Bypasses local ISP blocks on .st domains
 * and delivers authentic PPV & FutbolX streams worldwide.
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
            'https://streamed.pk/api/matches/all'
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
                                        const titleLower = (ev.name || '').toLowerCase();
                                        if ((titleLower.includes('wolves') || titleLower.includes('wolverhampton')) && (titleLower.includes('pompey') || titleLower.includes('portsmouth'))) continue;
                                        if (titleLower.includes('diriyah') && titleLower.includes('riyadh')) continue;
                                        const start = ev.starts_at ? new Date(ev.starts_at).getTime() : 0;
                                        const end = ev.ends_at ? new Date(ev.ends_at).getTime() : (start ? start + 10800000 : 0);
                                        if (end > 0 && now > (end + 1800000) && !ev.always_live) continue;

                                        const activeStreams = (ev.streams || []).filter(s => s && s.url && s.url.trim().length > 0 && !s.url.includes('placeholder'));
                                        if (activeStreams.length === 0) continue;
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

                const allCatEvents = await Promise.all(catPromises);
                const flatEvents = allCatEvents.flat();
                return new Response(JSON.stringify({ success: true, count: flatEvents.length, events: flatEvents }), {
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

    return new Response(JSON.stringify({ success: true, streams: [] }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        }
    });
}
