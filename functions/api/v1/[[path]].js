/**
 * Cloudflare Pages Function: Unified High-Performance Sports API Router
 * Supports:
 *   /api/v1/stream?token=:token      -> Edge player proxy with dual-referer bypass (dzeko11.pk / strumyk.pk)
 *   /api/v1/match/:matchId           -> Multi-source stream aggregation (dzeko11.pk + strumyk.pk + bintv + tim-streams)
 *   /api/v1/:sport/:date             -> Multi-host daily sports fixtures (including /api/v1/all/:date for All Live & Top)
 *   /api/v1/channels                 -> 24/7 Live TV channels catalog (tim-streams + fallback)
 */

export async function onRequest(context) {
    const url = new URL(context.request.url);
    const pathname = url.pathname.replace(/^\/api\/v1\/?/, '');
    const parts = pathname.split('/').filter(Boolean);

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Content-Type': 'application/json'
    };

    if (context.request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // ----------------------------------------------------
        // 0. STREAM PROXY: /api/v1/stream?token=:token OR ?src=:url
        // ----------------------------------------------------
        if (parts[0] === 'stream') {
            const token = (url.searchParams.get('token') || url.searchParams.get('id') || parts[1] || '').trim();
            const rawUrl = url.searchParams.get('src') || url.searchParams.get('url');

            // Direct iframe proxy
            if (rawUrl && /^https?:\/\//i.test(rawUrl)) {
                return new Response(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{width:100%;height:100%;margin:0;padding:0;background:#000;overflow:hidden;}iframe{width:100%;height:100%;border:0;display:block;}</style></head><body><iframe src="${rawUrl}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe></body></html>`, {
                    status: 200,
                    headers: { 'Content-Type': 'text/html; charset=utf-8' }
                });
            }

            if (!token || !/^[a-f0-9]{32}$/i.test(token)) {
                return new Response('Invalid or missing stream token.', { status: 400 });
            }

            const upstreamUrl = `https://iplayer24.me/beta/${token}`;

            // Try upstream with dzeko11.pk, fallback to strumyk.pk if needed
            let html = '';
            for (const ref of ['https://dzeko11.pk/', 'https://strumyk.pk/']) {
                try {
                    const resp = await fetch(upstreamUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                            'Referer': ref,
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                        }
                    });
                    if (resp.ok) {
                        const text = await resp.text();
                        if (text.includes('jwplayer') || !text.includes('google.com')) {
                            html = text;
                            break;
                        }
                    }
                } catch (fetchErr) {}
            }

            if (!html || (html.includes('google.com') && !html.includes('jwplayer'))) {
                return new Response('Stream token unavailable or expired.', { status: 502 });
            }

            // 1. Rewrite WebSocket endpoint to our proxy
            html = html.replace('wss://l1.strims24.st/ws', '/api/ws');
            html = html.replace('src="/lib/tk.js"', 'src="https://iplayer24.me/lib/tk.js"');

            // 2. Strip intrusive ads/popups completely
            html = html.replace(/<script[^>]*runtime\.js[^>]*>[\s\S]*?<\/script>/gi, '');
            html = html.replace(/<script[^>]*isim\.is[^>]*>[\s\S]*?<\/script>/gi, '');
            html = html.replace(/<script[^>]*aclib\.runPop[\s\S]*?<\/script>/gi, '');
            html = html.replace(/<script[^>]*popunder[\s\S]*?<\/script>/gi, '');

            // 3. Dark clean responsive styling
            const customCss = `<style>
html, body { width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; background: #000 !important; overflow: hidden !important; }
body.beta { background: #000 !important; padding: 0 !important; }
body.beta .stage { width: 100% !important; height: 100% !important; max-width: 100% !important; border-radius: 0 !important; aspect-ratio: unset !important; }
body.beta .ad, body.beta .vpn-notice, body.beta footer, body.beta header, body.beta h1, body.beta p, .video-unmute { display: none !important; }
#player { width: 100% !important; height: 100% !important; }
#player video { width: 100% !important; height: 100% !important; object-fit: contain !important; }
</style>`;
            html = html.replace('</head>', customCss + '</head>');

            return new Response(html, {
                status: 200,
                headers: {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Cache-Control': 'no-store, no-cache, must-revalidate'
                }
            });
        }

        // ----------------------------------------------------
        // 1. MATCH DETAILS & BROADCAST STREAMS: /api/v1/match/:matchId (ULTRA-FAST PARALLEL RESOLVER)
        if (parts[0] === 'match' && parts.length > 1) {
            const rawId = parts.slice(1).join('/');
            const cleanId = rawId.replace(/^(FS:|CUST:)/, '');
            const fsId = rawId.startsWith('CUST:') ? rawId : `FS:${cleanId}`;

            const customUrls = [];
            const seenUrls = new Set();
            const seenNames = new Set();

            function addStream(name, url, directUrl) {
                if (!url) return;
                let playUrl = url.trim();
                let direct = directUrl || playUrl;
                if (/^[a-f0-9]{32}$/i.test(playUrl)) {
                    direct = `https://iplayer24.me/beta/${playUrl}`;
                    playUrl = `/api/v1/stream?token=${playUrl}`;
                }
                const key = `${name.toLowerCase()}:${playUrl}`;
                if (!seenUrls.has(playUrl) && !seenNames.has(key)) {
                    seenUrls.add(playUrl);
                    seenNames.add(key);
                    customUrls.push({
                        id: `srv-${customUrls.length + 1}`,
                        name: name,
                        url: playUrl,
                        direct_url: direct,
                        enabled: true
                    });
                }
            }

            // Fast fetch helper with strict AbortController timeout
            async function fastFetch(url, headers = {}, timeoutMs = 2200) {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
                try {
                    const res = await fetch(url, { headers, signal: controller.signal });
                    clearTimeout(timeoutId);
                    return res;
                } catch (e) {
                    clearTimeout(timeoutId);
                    return null;
                }
            }

            // Concurrently query GraphQL, Dzeko, Strumyk, and BinTV in parallel (Sub-1s speed)
            const gqlUrl = `https://2.ds.lsapp.eu/pq_graphql?_hash=dsof&eventId=${cleanId}&projectId=2`;
            const dzekoUrl = `https://dzeko11.pk/api/v1/match/FS:${cleanId}`;
            const strumykUrl = `https://strumyk.pk/api/v1/match/FS:${cleanId}`;
            const bintvUrl = `https://bintvjson.lovable.app/api/public/bintvjson`;

            const [gqlRes, dzekoRes, strumykRes, bintvRes] = await Promise.allSettled([
                fastFetch(gqlUrl, { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, 2000),
                fastFetch(dzekoUrl, { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://dzeko11.pk/' }, 2200),
                fastFetch(strumykUrl, { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://strumyk.pk/' }, 2200),
                fastFetch(bintvUrl, { 'Accept': 'application/json' }, 1800)
            ]);

            // A. Parse team names from GraphQL
            let homeName = '';
            let awayName = '';
            if (gqlRes.status === 'fulfilled' && gqlRes.value && gqlRes.value.ok) {
                try {
                    const gqlData = await gqlRes.value.json();
                    const event = gqlData?.data?.findEventById;
                    for (const p of (event?.eventParticipants || [])) {
                        if (p?.type?.side === 'HOME') homeName = p?.name || '';
                        if (p?.type?.side === 'AWAY') awayName = p?.name || '';
                    }
                } catch (e) {}
            }

            // B. Parse Dzeko & Strumyk multi-mirror streams
            for (const r of [dzekoRes, strumykRes]) {
                if (r.status === 'fulfilled' && r.value && r.value.ok) {
                    try {
                        const data = await r.value.json();
                        for (const item of (data.custom_urls || [])) {
                            if (item && item.name && item.url) {
                                addStream(item.name, item.url);
                            }
                        }
                    } catch (e) {}
                }
            }

            // C. Match against BinTV events
            if (bintvRes.status === 'fulfilled' && bintvRes.value && bintvRes.value.ok) {
                try {
                    const bintvData = await bintvRes.value.json();
                    const allEvents = [
                        ...(bintvData['Live Events'] || []),
                        ...(bintvData['Upcoming Events'] || [])
                    ];
                    for (const ev of allEvents) {
                        const evName = (ev.name || '').toLowerCase();
                        let isMatch = false;
                        if (cleanId.length > 3 && evName.includes(cleanId.toLowerCase())) isMatch = true;
                        else if (homeName && homeName.length > 3 && evName.includes(homeName.toLowerCase())) isMatch = true;
                        else if (awayName && awayName.length > 3 && evName.includes(awayName.toLowerCase())) isMatch = true;

                        if (isMatch) {
                            for (const s of (ev.streams || [])) {
                                if (s.url) addStream(s.name || `Live Stream ${customUrls.length + 1}`, s.url);
                            }
                        }
                    }
                } catch (e) {}
            }

            // D. Smart Match: Cricket & Special Sport Channels (e.g. Australia vs South Africa)
            if (cleanId === 'OjOKEBcN' && !homeName) {
                homeName = 'Australia';
                awayName = 'South Africa';
            }
            const hLow = (homeName || '').toLowerCase();
            const aLow = (awayName || '').toLowerCase();
            const isAusVsSa = cleanId === 'OjOKEBcN' ||
                              ((hLow.includes('australia') || aLow.includes('australia')) &&
                               (hLow.includes('south africa') || aLow.includes('south africa')));

            if (isAusVsSa || hLow.includes('cricket') || aLow.includes('cricket')) {
                addStream('Fox Sports 501 (Cricket)', 'https://ehgembxe.cfd/imifneoj-1417', 'https://ehgembxe.cfd/imifneoj-1417');
                addStream('Sky Sports Cricket', 'https://ehgembxe.cfd/qfx4038p-95', 'https://ehgembxe.cfd/qfx4038p-95');
                addStream('Willow Cricket', 'https://ehgembxe.cfd/spd8gpoh-6586', 'https://ehgembxe.cfd/spd8gpoh-6586');
            }

            const matchHeaders = {
                ...corsHeaders,
                'Cache-Control': 'public, max-age=20, stale-while-revalidate=60'
            };

            return new Response(JSON.stringify({
                match_id: fsId,
                teams: { home: homeName, away: awayName },
                custom_urls: customUrls,
                channels: []
            }), { status: 200, headers: matchHeaders });
        }

        // 2. SPORT SCHEDULE / MATCHES LIST: /api/v1/:sport/:date
        // ----------------------------------------------------
        if (parts.length === 2) {
            const [sport, date] = parts;

            // SPECIAL: /api/v1/all/:date - Unified Live & Top Matches across all sports
            if (sport === 'all') {
                const allSports = ['football', 'cricket', 'basketball', 'motorsport', 'hockey', 'tennis', 'volleyball', 'american-football'];
                const allItems = [];
                const seenIds = new Set();
                seenIds.add('FS:OjOKEBcN');
                allItems.push({ match_id: 'FS:OjOKEBcN' });

                await Promise.allSettled(allSports.map(async (sp) => {
                    for (const host of ['dzeko11.pk', 'strumyk.pk']) {
                        try {
                            const hostUrl = `https://${host}/api/v1/${encodeURIComponent(sp)}/${encodeURIComponent(date)}`;
                            const resp = await fetch(hostUrl, {
                                headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': `https://${host}/` }
                            });
                            if (resp.ok) {
                                const data = await resp.json();
                                for (const it of (data.items || [])) {
                                    if (it.match_id && !seenIds.has(it.match_id)) {
                                        seenIds.add(it.match_id);
                                        allItems.push(it);
                                    }
                                }
                                break;
                            }
                        } catch (err) {}
                    }
                }));

                return new Response(JSON.stringify({ date: date, items: allItems }), {
                    status: 200,
                    headers: corsHeaders
                });
            }

            if (sport === 'cricket') {
                const cItems = [{ match_id: 'FS:OjOKEBcN' }];
                const cSeen = new Set(['FS:OjOKEBcN']);
                for (const host of ['dzeko11.pk', 'strumyk.pk']) {
                    try {
                        const hostUrl = https://System.Management.Automation.Internal.Host.InternalHost/api/v1/cricket/;
                        const resp = await fetch(hostUrl, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': https://System.Management.Automation.Internal.Host.InternalHost/ } });
                        if (resp.ok) {
                            const data = await resp.json();
                            for (const it of (data.items || [])) {
                                if (it.match_id && !cSeen.has(it.match_id)) {
                                    cSeen.add(it.match_id);
                                    cItems.push(it);
                                }
                            }
                        }
                    } catch (e) {}
                }
                return new Response(JSON.stringify({ date: date, items: cItems }), {
                    status: 200,
                    headers: corsHeaders
                });
            }

            // Try Dzeko and Strumyk daily sport API
            for (const host of ['dzeko11.pk', 'strumyk.pk']) {
                try {
                    const hostUrl = `https://${host}/api/v1/${encodeURIComponent(sport)}/${encodeURIComponent(date)}`;
                    const resp = await fetch(hostUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                            'Referer': `https://${host}/`,
                            'Accept': 'application/json'
                        }
                    });

                    if (resp.ok) {
                        const data = await resp.json();
                        if (data && Array.isArray(data.items) && data.items.length > 0) {
                            return new Response(JSON.stringify(data), { status: 200, headers: corsHeaders });
                        }
                    }
                } catch (err) {}
            }

            // Fallback: Flashscore feed for sport
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
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
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
                        if (ev.includes('AL÷') || ev.includes('AB÷2')) {
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
            } catch (fsFeedErr) {}

            return new Response(JSON.stringify({ date: date, items: [] }), { status: 200, headers: corsHeaders });
        }

        // ----------------------------------------------------
        // 3. CHANNELS: /api/v1/channels (TimStreams + Fallback)
        // ----------------------------------------------------
        if (parts[0] === 'channels') {
            try {
                const timRes = await fetch('https://tim-streams.com/api/channels', {
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                if (timRes.ok) {
                    const raw = await timRes.json();
                    const channels = raw.channels || [];
                    const genres = {};
                    for (const g of (raw.genres || [])) genres[g.id] = g.name;

                    const formatted = [];
                    for (const c of channels) {
                        const streams = [];
                        for (const s of (c.streams || [])) {
                            if (s.url) streams.push({ name: s.name || 'Live Feed', url: s.url });
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

            return new Response(JSON.stringify({ items: [] }), { status: 200, headers: corsHeaders });
        }

        return new Response(JSON.stringify({ error: 'Endpoint not found', parts }), { status: 404, headers: corsHeaders });

    } catch (globalErr) {
        return new Response(JSON.stringify({ error: globalErr.message || 'Internal edge error' }), {
            status: 500,
            headers: corsHeaders
        });
    }
}
