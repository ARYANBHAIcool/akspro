/**
 * Cloudflare Pages Function: /api/v1/[[path]]
 * Edge Router for Live Sports Curated Matches, Match Details, and Broadcast Stream Sources
 */

export async function onRequest(context) {
    const url = new URL(context.request.url);
    const rawPath = url.pathname.replace(/^\/api\/v1\/?/, '');
    const parts = context.params.path || rawPath.split('/').filter(Boolean);

    const corsHeaders = {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=120'
    };

    if (context.request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // ----------------------------------------------------
        // 1. MATCH DETAILS & BROADCAST STREAMS: /api/v1/match/:matchId
        // ----------------------------------------------------
        if (parts[0] === 'match' && parts.length > 1) {
            const rawId = parts.slice(1).join('/');
            const cleanId = rawId.replace(/^(FS:|CUST:)/, '');
            const fsId = rawId.startsWith('CUST:') ? rawId : `FS:${cleanId}`;

            // A. Try Dzeko match API first
            try {
                const dzekoResp = await fetch(`https://dzeko11.pk/api/v1/match/${encodeURIComponent(fsId)}`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                        'Referer': 'https://dzeko11.pk/',
                        'Accept': 'application/json'
                    }
                });

                if (dzekoResp.ok) {
                    const data = await dzekoResp.json();
                    if (data && Array.isArray(data.custom_urls) && data.custom_urls.length > 0) {
                        return new Response(JSON.stringify(data), { status: 200, headers: corsHeaders });
                    }
                }
            } catch (e) {
                // proceed to parent source fallback
            }

            // B. Parent Source Engine: Flashscore TV Broadcaster Feed
            try {
                const fsUrl = `https://1.newsoccers.one/2/x/feed/df_dos_1_${cleanId}_`;
                const fsResp = await fetch(fsUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'X-Fsign': 'SW9D1eZo',
                        'Origin': 'https://dzeko11.pk',
                        'Referer': 'https://dzeko11.pk/'
                    }
                });

                if (fsResp.ok) {
                    const text = await fsResp.text();
                    const alMatch = text.match(/AL÷(\{[^¬]+\})/);
                    if (alMatch) {
                        const parsed = JSON.parse(alMatch[1]);
                        const broadcasters = parsed['1'] || [];

                        // Load channels catalog to find matching live streams
                        let catalog = [];
                        try {
                            const catRes = await fetch(`${url.origin}/assets/channels.json`);
                            if (catRes.ok) {
                                const catJson = await catRes.json();
                                catalog = catJson['24/7 Channels'] || [];
                            }
                        } catch (catErr) {}

                        const customUrls = [];
                        for (let i = 0; i < Math.min(broadcasters.length, 12); i++) {
                            const b = broadcasters[i];
                            if (!b || !b.BN) continue;

                            const bName = b.BN;
                            const bLower = bName.toLowerCase();
                            let matchedUrl = null;

                            // Match against 24/7 channels
                            for (const ch of catalog) {
                                const cLower = (ch.name || '').toLowerCase();
                                if (bLower.includes(cLower) || cLower.includes(bLower)) {
                                    if (ch.streams && ch.streams[0] && ch.streams[0].url) {
                                        matchedUrl = ch.streams[0].url;
                                        break;
                                    }
                                }
                            }

                            // Match common sport networks
                            if (!matchedUrl) {
                                for (const kw of ['dazn', 'canal', 'sky', 'tnt', 'bein', 'espn', 'arena', 'willow', 'ziggo']) {
                                    if (bLower.includes(kw)) {
                                        const ch = catalog.find(c => (c.name || '').toLowerCase().includes(kw));
                                        if (ch && ch.streams && ch.streams[0] && ch.streams[0].url) {
                                            matchedUrl = ch.streams[0].url;
                                            break;
                                        }
                                    }
                                }
                            }

                            customUrls.push({
                                id: `src-${b.TVI || i}`,
                                name: bName,
                                url: matchedUrl || (b.BU && b.BU.startsWith('http') ? b.BU : '#'),
                                enabled: true
                            });
                        }

                        if (customUrls.length > 0) {
                            return new Response(JSON.stringify({
                                match_id: fsId,
                                custom_urls: customUrls,
                                channels: []
                            }), { status: 200, headers: corsHeaders });
                        }
                    }
                }
            } catch (fsErr) {}

            return new Response(JSON.stringify({ match_id: fsId, custom_urls: [], channels: [] }), {
                status: 200,
                headers: corsHeaders
            });
        }

        // ----------------------------------------------------
        // 2. CURATED DAILY MATCH LIST: /api/v1/:sport/:date
        // ----------------------------------------------------
        if (parts.length >= 2) {
            const [sport, date] = parts;

            // A. Try Dzeko daily sport API
            try {
                const dzekoUrl = `https://dzeko11.pk/api/v1/${encodeURIComponent(sport)}/${encodeURIComponent(date)}`;
                const dzekoResp = await fetch(dzekoUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Referer': 'https://dzeko11.pk/',
                        'Accept': 'application/json'
                    }
                });

                if (dzekoResp.ok) {
                    const data = await dzekoResp.json();
                    if (data && Array.isArray(data.items) && data.items.length > 0) {
                        return new Response(JSON.stringify(data), { status: 200, headers: corsHeaders });
                    }
                }
            } catch (err) {}

            // B. Parent Source Fallback: Flashscore feed
            const sportIdMap = {
                football: 1, tennis: 2, basketball: 3, hockey: 4,
                'american-football': 5, handball: 7, futsal: 11, volleyball: 12,
                cricket: 13, darts: 14, snooker: 15, boxing: 16, mma: 28, motorsport: 31
            };
            const sportId = sportIdMap[sport] || 1;

            try {
                const fsFeedUrl = `https://1.newsoccers.one/2/x/feed/f_${sportId}_0_2_en_1`;
                const fsResp = await fetch(fsFeedUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'X-Fsign': 'SW9D1eZo',
                        'Origin': 'https://dzeko11.pk',
                        'Referer': 'https://dzeko11.pk/'
                    }
                });

                if (fsResp.ok) {
                    const text = await fsResp.text();
                    const events = text.split('~AA÷');
                    const items = [];

                    for (let i = 1; i < events.length; i++) {
                        const ev = events[i];
                        const evId = ev.split('¬')[0];
                        // If match has AL (TV channels) or is live (AB÷2)
                        const hasAL = ev.includes('AL÷');
                        const isLive = ev.includes('AB÷2');
                        if (hasAL || isLive) {
                            items.push({ match_id: `FS:${evId}` });
                        }
                    }

                    if (items.length > 0) {
                        return new Response(JSON.stringify({ date: date, items: items }), {
                            status: 200,
                            headers: corsHeaders
                        });
                    }
                }
            } catch (fsErr) {}

            return new Response(JSON.stringify({ date: date, items: [] }), {
                status: 200,
                headers: corsHeaders
            });
        }

        // ----------------------------------------------------
        // 3. CHANNELS: /api/v1/channels
        // ----------------------------------------------------
        if (parts[0] === 'channels') {
            try {
                const localRes = await fetch(`${url.origin}/assets/channels.json`);
                if (localRes.ok) {
                    const localJson = await localRes.json();
                    return new Response(JSON.stringify({ items: localJson['24/7 Channels'] || [] }), {
                        status: 200,
                        headers: corsHeaders
                    });
                }
            } catch (e) {}
            return new Response(JSON.stringify({ items: [] }), { status: 200, headers: corsHeaders });
        }

        return new Response(JSON.stringify({ error: 'Route not found' }), { status: 404, headers: corsHeaders });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
}
