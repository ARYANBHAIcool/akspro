/**
 * Cloudflare Pages Function: 24/7 TV Channels API
 * Merges active 24/7 Live Channels from Tim-Streams + BinTV + local fallback
 */

export async function onRequest(context) {
    const corsHeaders = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=180, stale-while-revalidate=600'
    };

    try {
        // 1. Try Live Tim-Streams API (219 high-quality TV channels)
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);

            const timRes = await fetch('https://tim-streams.com/api/channels', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json'
                },
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (timRes.ok) {
                const raw = await timRes.json();
                const channels = raw.channels || [];
                const genres = {};
                for (const g of (raw.genres || [])) genres[g.id] = g.name;

                const formatted = [];
                for (const c of channels) {
                    const streams = [];
                    for (const s of (c.streams || [])) {
                        if (s.url) {
                            let playUrl = s.url;
                            if (/^https?:\/\/ehgembxe\.cfd\//i.test(playUrl)) {
                                playUrl = `/api/v1/stream?src=${encodeURIComponent(playUrl)}`;
                            }
                            streams.push({
                                name: s.name || 'Live Stream',
                                url: playUrl,
                                direct_url: s.url
                            });
                        }
                    }
                    if (streams.length > 0) {
                        formatted.push({
                            id: c.url || `ch-${formatted.length + 1}`,
                            name: c.name,
                            poster: c.logo || '/assets/favicon-96x96.png',
                            category: genres[c.genre] || 'Sports',
                            status: '24/7',
                            flag: c.flag || '',
                            streams: streams
                        });
                    }
                }

                if (formatted.length > 0) {
                    return new Response(JSON.stringify({ items: formatted, counts: { channels: formatted.length } }), {
                        status: 200,
                        headers: corsHeaders
                    });
                }
            }
        } catch (timErr) {}

        // 2. Try bintvjson fallback
        try {
            const controller2 = new AbortController();
            const timeoutId2 = setTimeout(() => controller2.abort(), 3000);

            const bintvRes = await fetch('https://bintvjson.lovable.app/api/public/bintvjson', {
                headers: { 'Accept': 'application/json' },
                signal: controller2.signal
            });
            clearTimeout(timeoutId2);

            if (bintvRes.ok) {
                const json = await bintvRes.json();
                const channels = json['24/7 Channels'] || [];
                const live = json['Live Events'] || [];
                return new Response(JSON.stringify({ items: channels, live: live, counts: json.counts }), {
                    status: 200,
                    headers: corsHeaders
                });
            }
        } catch (bErr) {}

        // 3. Fallback: fetch local static /assets/channels.json
        const origin = new URL(context.request.url).origin;
        const localRes = await fetch(`${origin}/assets/channels.json`);
        if (localRes.ok) {
            const localJson = await localRes.json();
            return new Response(JSON.stringify({ items: localJson['24/7 Channels'] || [], live: localJson['Live Events'] || [] }), {
                status: 200,
                headers: corsHeaders
            });
        }

        return new Response(JSON.stringify({ items: [] }), { status: 200, headers: corsHeaders });
    } catch (e) {
        return new Response(JSON.stringify({ items: [], error: e.message }), { status: 500, headers: corsHeaders });
    }
}
