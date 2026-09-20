/**
 * Cloudflare Pages Function: High-Speed Proxy for PPV.st Streams API
 * Route: /api/ppv
 * 
 * Bypasses local ISP blocks (Jio/Airtel/etc.) on .st domains
 * and delivers authentic PPV.st streams directly to mobile and PC users worldwide.
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
                        'Cache-Control': 'public, max-age=60'
                    }
                });
            }
        }
    } catch (err) {
        console.warn('api.ppv.st fetch failed in /api/ppv proxy:', err.message);
    }

    return new Response(JSON.stringify({ success: false, error: 'Could not retrieve feeds from ppv.st' }), {
        status: 502,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}
