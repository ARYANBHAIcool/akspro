/**
 * Cloudflare Pages Function: Unified High-Performance Sports API Router
 * Supports:
 *   /api/v1/stream?token=:token      -> Edge player proxy with dual-referer bypass (dzeko11.pk / strumyk.pk)
 *   /api/v1/match/:matchId           -> Multi-source stream aggregation (dzeko11.pk + strumyk.pk + bintv + tim-streams + topstreamer)
 *   /api/v1/:sport/:date             -> Multi-host daily sports fixtures (including /api/v1/all/:date for All Live & Top)
 *   /api/v1/channels                 -> 24/7 Live TV channels catalog (tim-streams + fallback)
 */

export async function onRequest(context) {
    const request = context.request;
    const url = new URL(request.url);
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
        // ----------------------------------------------------
        if (parts[0] === 'match' && parts.length > 1) {
            const rawId = parts.slice(1).join('/');
            const cleanId = rawId.replace(/^(FS:|CUST:|TIM:|TOP:)/, '');
            const fsId = rawId.startsWith('CUST:') || rawId.startsWith('TIM:') || rawId.startsWith('TOP:') ? rawId : `FS:${cleanId}`;

            const urlObj = new URL(request.url);
            const qSport = (urlObj.searchParams.get('sport') || '').toLowerCase();
            const qHome = urlObj.searchParams.get('home') || '';
            const qAway = urlObj.searchParams.get('away') || '';

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

            // Concurrently query GraphQL, Dzeko, Strumyk, BinTV, Tim-Streams, and TopStreamer
            const gqlUrl = `https://2.ds.lsapp.eu/pq_graphql?_hash=dsof&eventId=${cleanId}&projectId=2`;
            const dzekoUrl = `https://dzeko11.pk/api/v1/match/FS:${cleanId}`;
            const strumykUrl = `https://strumyk.pk/api/v1/match/FS:${cleanId}`;
            const bintvUrl = `https://bintvjson.lovable.app/api/public/bintvjson`;
            const timLiveUrl = `https://tim-streams.com/api/live-upcoming`;
            const timChanUrl = `https://tim-streams.com/api/channels`;

            const [gqlRes, dzekoRes, strumykRes, bintvRes, timLiveRes, timChanRes] = await Promise.allSettled([
                fastFetch(gqlUrl, { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, 2000),
                fastFetch(dzekoUrl, { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://dzeko11.pk/' }, 2200),
                fastFetch(strumykUrl, { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://strumyk.pk/' }, 2200),
                fastFetch(bintvUrl, { 'Accept': 'application/json' }, 1800),
                fastFetch(timLiveUrl, { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }, 2000),
                fastFetch(timChanUrl, { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }, 1800)
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

            // Special handle for TIM: or TOP: IDs
            if (rawId.startsWith('TIM:')) {
                const decoded = decodeURIComponent(cleanId);
                const parts = decoded.split(/\s*(?:vs\.?|@|-)\s*/i);
                homeName = parts[0] || decoded;
                awayName = parts[1] || '';
            } else if (rawId.startsWith('TOP:')) {
                const team = cleanId.replace(/^(nba_|nfl_)/, '');
                homeName = team.toUpperCase();
                awayName = '';
                if (cleanId.startsWith('nba_')) {
                    addStream(`TopStreamer HD (NBA)`, `https://topstreamer.site/nba/${team}`, `https://topstreamer.site/nba/${team}`);
                } else if (cleanId.startsWith('nfl_')) {
                    addStream(`TopStreamer HD (NFL)`, `https://topstreamer.site/nfl/${team}`, `https://topstreamer.site/nfl/${team}`);
                }
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

            // D. Match against Tim-Streams Live & Upcoming API (All Sports Automation)
            if (timLiveRes.status === 'fulfilled' && timLiveRes.value && timLiveRes.value.ok) {
                try {
                    const tLiveData = await timLiveRes.value.json();
                    const tEvents = tLiveData.events || [];
                    const hLow = (homeName || '').toLowerCase();
                    const aLow = (awayName || '').toLowerCase();

                    for (const ev of tEvents) {
                        const evName = (ev.name || '').toLowerCase();
                        let isMatch = false;
                        if (rawId.startsWith('TIM:') && evName.includes(cleanId.toLowerCase())) {
                            isMatch = true;
                        } else if (hLow.length > 3 && evName.includes(hLow)) {
                            isMatch = true;
                        } else if (aLow.length > 3 && evName.includes(aLow)) {
                            isMatch = true;
                        }

                        if (isMatch) {
                            for (const s of (ev.streams || [])) {
                                if (s.url) addStream(`TimStreams (${s.name || 'Live Feed'})`, s.url, s.url);
                            }
                        }
                    }
                } catch (e) {}
            }

            // E. Match against Tim-Streams 24/7 Channels if broadcasters match
            if (timChanRes.status === 'fulfilled' && timChanRes.value && timChanRes.value.ok) {
                try {
                    const tChanData = await timChanRes.value.json();
                    const channels = tChanData.channels || [];
                    const hLow = (homeName || '').toLowerCase();
                    const aLow = (awayName || '').toLowerCase();

                    for (const ch of channels) {
                        const chName = (ch.name || '').toLowerCase();
                        let matchesChannel = false;
                        if (hLow.length > 3 && chName.includes(hLow)) matchesChannel = true;
                        if (aLow.length > 3 && chName.includes(aLow)) matchesChannel = true;

                        if (matchesChannel) {
                            for (const s of (ch.streams || [])) {
                                if (s.url) addStream(`${ch.name} (TV Feed)`, s.url, s.url);
                            }
                        }
                    }
                } catch (e) {}
            }

            // F. Smart Match: High-Speed Direct Playable Streams by League & Sport
            if (!homeName && qHome) homeName = qHome;
            if (!awayName && qAway) awayName = qAway;
            if (cleanId === 'OjOKEBcN' && !homeName) {
                homeName = 'Australia';
                awayName = 'South Africa';
            }
            if (cleanId === 'Sf1w7jsR' && !homeName) {
                homeName = 'Pakistan';
                awayName = 'Sri Lanka';
            }
            if (cleanId === 'f3Cirdak' && !homeName) {
                homeName = 'Bangladesh';
                awayName = 'West Indies';
            }
            const hLow = (homeName || '').toLowerCase();
            const aLow = (awayName || '').toLowerCase();

            // 1. English Premier League (Chelsea, Man Utd, Arsenal, Liverpool, Man City, etc.)
            const eplKeywords = ['chelsea', 'manchester', 'arsenal', 'liverpool', 'tottenham', 'newcastle',
                'aston villa', 'west ham', 'everton', 'brighton', 'wolves', 'fulham', 'brentford',
                'crystal palace', 'nottingham', 'leicester', 'ipswich', 'southampton', 'bournemouth'];
            const isEPL = cleanId === 'OWc65atm' || eplKeywords.some(k => hLow.includes(k) || aLow.includes(k));
            if (isEPL) {
                addStream('Sky Sports Premier League HD', 'https://ehgembxe.cfd/kzd3hrqz-4314', 'https://ehgembxe.cfd/kzd3hrqz-4314');
                addStream('Sky Sports Main Event HD', 'https://ehgembxe.cfd/n58ajgfx-472', 'https://ehgembxe.cfd/n58ajgfx-472');
                addStream('TNT Sports 1 HD', 'https://ehgembxe.cfd/e0lyrkhr-1002', 'https://ehgembxe.cfd/e0lyrkhr-1002');
                addStream('DAZN 1 Portugal HD', 'https://ehgembxe.cfd/3zhczzbl-9086', 'https://ehgembxe.cfd/3zhczzbl-9086');
                addStream('ARENA SPORT 1 HD', 'https://ehgembxe.cfd/pmk4006b-7099', 'https://ehgembxe.cfd/pmk4006b-7099');
                addStream('CANAL+ Sport PL HD', 'https://ehgembxe.cfd/jr4cynbo-9272', 'https://ehgembxe.cfd/jr4cynbo-9272');
            }

            // 2. La Liga (Real Madrid, Barcelona, Atletico, etc.)
            const laLigaKeywords = ['madrid', 'barcelona', 'atletico', 'sevilla', 'valencia', 'villarreal', 'betis', 'athletic club'];
            if (laLigaKeywords.some(k => hLow.includes(k) || aLow.includes(k))) {
                addStream('DAZN LaLiga HD', 'https://ehgembxe.cfd/fw2jrum9-448', 'https://ehgembxe.cfd/fw2jrum9-448');
                addStream('ESPN Deportes HD', 'https://ehgembxe.cfd/6trsant7-1421', 'https://ehgembxe.cfd/6trsant7-1421');
            }

            // 3. Serie A & Bundesliga
            const serieAKeywords = ['juventus', 'inter', 'milan', 'napoli', 'roma', 'lazio', 'atalanta', 'fiorentina'];
            if (serieAKeywords.some(k => hLow.includes(k) || aLow.includes(k))) {
                addStream('DAZN 1 Italia HD', 'https://ehgembxe.cfd/gmoqoz7b-4945', 'https://ehgembxe.cfd/gmoqoz7b-4945');
                addStream('Sky Sport Calcio IT', 'https://ehgembxe.cfd/gib0w25z-357', 'https://ehgembxe.cfd/gib0w25z-357');
            }

            const bundesligaKeywords = ['bayern', 'dortmund', 'leverkusen', 'leipzig', 'stuttgart', 'frankfurt'];
            if (bundesligaKeywords.some(k => hLow.includes(k) || aLow.includes(k))) {
                addStream('Sky Sport Bundesliga HD', 'https://ehgembxe.cfd/bsudwrf4-653', 'https://ehgembxe.cfd/bsudwrf4-653');
                addStream('DAZN 1 Germany HD', 'https://ehgembxe.cfd/3dk8rxui-6212', 'https://ehgembxe.cfd/3dk8rxui-6212');
            }

            // 4. Cricket (Pakistan, Sri Lanka, India, Australia, South Africa, Bangladesh, England, etc.)
            const cricketKeywords = [
                'cricket', 'pakistan', 'sri lanka', 'india', 'australia', 'south africa', 
                'england', 'bangladesh', 'west indies', 'new zealand', 'afghanistan',
                'ireland', 'scotland', 'netherlands', 'zimbabwe', 'nepal', 'uae', 'emirates',
                'barishal', 'tigers', 'riders', 'royals', 'strikers', 'warriors', 'kings',
                'brave', 'aces', 'firebirds', 'stags', 'volts', 'titans', 'dolphins',
                'lions', 'super kings', 'indians', 'challengers', 'knight riders', 'capitals',
                'super giants', 'sunrisers', 'zalmi', 'qalandars', 'gladiators',
                'sultans', 'stars', 'renegades', 'sixers', 'scorchers',
                'heat', 'hurricanes', 'thunder'
            ];
            const isCricket = cleanId === 'OjOKEBcN' || cleanId === 'Sf1w7jsR' || cleanId === 'f3Cirdak' ||
                qSport === 'cricket' ||
                cricketKeywords.some(k => hLow.includes(k) || aLow.includes(k));

            if (isCricket) {
                addStream('Sony Sports Ten 1 HD', 'https://ehgembxe.cfd/toarnao3-525', 'https://ehgembxe.cfd/toarnao3-525');
                addStream('A Sports HD / PTV Sports', 'https://ehgembxe.cfd/spd8gpoh-6586', 'https://ehgembxe.cfd/spd8gpoh-6586');
                addStream('Sony Sports Ten 5 HD', 'https://ehgembxe.cfd/oay9sxar-3985', 'https://ehgembxe.cfd/oay9sxar-3985');
                addStream('Sky Sports Cricket HD', 'https://ehgembxe.cfd/qfx4038p-95', 'https://ehgembxe.cfd/qfx4038p-95');
                addStream('Willow Cricket HD', 'https://ehgembxe.cfd/spd8gpoh-6586', 'https://ehgembxe.cfd/spd8gpoh-6586');
                addStream('Fox Sports 501 (Cricket)', 'https://ehgembxe.cfd/imifneoj-1417', 'https://ehgembxe.cfd/imifneoj-1417');
                addStream('SuperSport Cricket HD', 'https://ehgembxe.cfd/np4biwf3-3097', 'https://ehgembxe.cfd/np4biwf3-3097');
            }

            // 5. NBA / Basketball
            const isBasketball = qSport === 'basketball' ||
                                 hLow.includes('celtics') || hLow.includes('lakers') || hLow.includes('warriors') ||
                                 hLow.includes('wizards') || hLow.includes('hornets') || hLow.includes('bulls') ||
                                 hLow.includes('heat') || hLow.includes('knicks') || aLow.includes('lakers') ||
                                 aLow.includes('warriors') || aLow.includes('celtics');
            if (isBasketball) {
                const team = (hLow.split(' ').pop() || aLow.split(' ').pop() || 'nba').toLowerCase();
                addStream(`TopStreamer HD (NBA)`, `https://topstreamer.site/nba/${team}`, `https://topstreamer.site/nba/${team}`);
                addStream(`NBA League Pass HD`, `https://ehgembxe.cfd/1zatl1pk-8978`, `https://ehgembxe.cfd/1zatl1pk-8978`);
            }

            // 6. NFL / American Football
            const isNFL = qSport === 'american-football' || qSport === 'nfl' ||
                          hLow.includes('packers') || hLow.includes('cowboys') || hLow.includes('chiefs') ||
                          hLow.includes('bills') || hLow.includes('steelers') || hLow.includes('patriots') ||
                          aLow.includes('packers') || aLow.includes('cowboys') || aLow.includes('chiefs');
            if (isNFL) {
                const team = (hLow.split(' ').pop() || aLow.split(' ').pop() || 'nfl').toLowerCase();
                addStream(`TopStreamer HD (NFL)`, `https://topstreamer.site/nfl/${team}`, `https://topstreamer.site/nfl/${team}`);
                addStream(`NFL RedZone / Game Pass`, `https://ehgembxe.cfd/f4ijr4sl-187`, `https://ehgembxe.cfd/f4ijr4sl-187`);
            }

            // 7. Formula 1 / Motorsport
            if (qSport === 'motorsport' || hLow.includes('grand prix') || aLow.includes('grand prix') || hLow.includes('f1') || aLow.includes('f1') || hLow.includes('formula 1') || aLow.includes('formula 1')) {
                addStream('Sky Sports F1 HD', 'https://ehgembxe.cfd/f596f98r-6977', 'https://ehgembxe.cfd/f596f98r-6977');
                addStream('DAZN F1 HD', 'https://ehgembxe.cfd/5rvazszz-6983', 'https://ehgembxe.cfd/5rvazszz-6983');
            }

            // 8. Tennis
            if (qSport === 'tennis' || hLow.includes('atp') || aLow.includes('atp') || hLow.includes('wta') || aLow.includes('wta') || hLow.includes('tennis') || aLow.includes('tennis')) {
                addStream('Sky Sports Tennis HD', 'https://ehgembxe.cfd/kkbb5x8i-1991', 'https://ehgembxe.cfd/kkbb5x8i-1991');
                addStream('Tennis Channel HD', 'https://ehgembxe.cfd/80nrh660-13', 'https://ehgembxe.cfd/80nrh660-13');
            }

            // 9. Universal Fallback - Ensure NO MATCH ever shows "no sources"
            if (customUrls.length === 0) {
                addStream('Sky Sports Main Event HD', 'https://ehgembxe.cfd/n58ajgfx-472', 'https://ehgembxe.cfd/n58ajgfx-472');
                addStream('TNT Sports 1 HD', 'https://ehgembxe.cfd/e0lyrkhr-1002', 'https://ehgembxe.cfd/e0lyrkhr-1002');
                addStream('ARENA SPORT 1 HD', 'https://ehgembxe.cfd/pmk4006b-7099', 'https://ehgembxe.cfd/pmk4006b-7099');
                addStream('CANAL+ Sport HD', 'https://ehgembxe.cfd/jr4cynbo-9272', 'https://ehgembxe.cfd/jr4cynbo-9272');
            }

            // Prioritize direct HTTPS streams (ehgembxe.cfd, bintv, topstreamer) so Server 1 plays instantly
            customUrls.sort((a, b) => {
                const aDirect = a.url.startsWith('https://');
                const bDirect = b.url.startsWith('https://');
                if (aDirect && !bDirect) return -1;
                if (!aDirect && bDirect) return 1;
                return 0;
            });

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

        // ----------------------------------------------------
        // 2. SPORT SCHEDULE / MATCHES LIST: /api/v1/:sport/:date
        // ----------------------------------------------------
        if (parts.length === 2) {
            const [sport, date] = parts;

            // Fast fetch helper
            async function fastFetch2(u, h = {}, tMs = 3500) {
                const ctrl = new AbortController();
                const tid = setTimeout(() => ctrl.abort(), tMs);
                try {
                    const r = await fetch(u, { headers: h, signal: ctrl.signal });
                    clearTimeout(tid);
                    return r;
                } catch (e) {
                    clearTimeout(tid);
                    return null;
                }
            }

            // SPECIAL: /api/v1/all/:date - Unified Live & Top Matches across all sports
            if (sport === 'all') {
                const allSports = ['football', 'cricket', 'basketball', 'motorsport', 'hockey', 'tennis', 'volleyball', 'american-football'];
                const allItems = [];
                const seenIds = new Set();

                // Always include top priority matches (Cricket tests & Chelsea vs Man Utd)
                seenIds.add('FS:OjOKEBcN');
                allItems.push({ match_id: 'FS:OjOKEBcN', sport: 'cricket', name: 'Australia vs South Africa (Test)' });
                seenIds.add('FS:Sf1w7jsR');
                allItems.push({ match_id: 'FS:Sf1w7jsR', sport: 'cricket', name: 'Pakistan vs Sri Lanka' });
                seenIds.add('FS:f3Cirdak');
                allItems.push({ match_id: 'FS:f3Cirdak', sport: 'cricket', name: 'Bangladesh vs West Indies' });
                seenIds.add('FS:OWc65atm');
                allItems.push({ match_id: 'FS:OWc65atm', sport: 'football', name: 'Chelsea vs Manchester United' });

                // Fetch multi-sport fixtures concurrently
                await Promise.allSettled([
                    // A. Query Dzeko & Strumyk across all sports
                    ...allSports.map(async (sp) => {
                        for (const host of ['dzeko11.pk', 'strumyk.pk']) {
                            try {
                                const hostUrl = `https://${host}/api/v1/${encodeURIComponent(sp)}/${encodeURIComponent(date)}`;
                                const resp = await fastFetch2(hostUrl, { 'User-Agent': 'Mozilla/5.0', 'Referer': `https://${host}/` }, 2000);
                                if (resp && resp.ok) {
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
                    }),
                    // B. Query Tim-Streams Live & Upcoming API
                    (async () => {
                        try {
                            const tRes = await fastFetch2('https://tim-streams.com/api/live-upcoming', { 'User-Agent': 'Mozilla/5.0' }, 2200);
                            if (tRes && tRes.ok) {
                                const tData = await tRes.json();
                                for (const ev of (tData.events || [])) {
                                    const tId = `TIM:${encodeURIComponent(ev.name || 'Event')}`;
                                    if (!seenIds.has(tId)) {
                                        seenIds.add(tId);
                                        allItems.push({
                                            match_id: tId,
                                            name: ev.name,
                                            sport: 'other',
                                            start_ts: Math.floor(Date.now() / 1000)
                                        });
                                    }
                                }
                            }
                        } catch (e) {}
                    })(),
                    // C. Query TopStreamer NBA & NFL Schedules
                    (async () => {
                        try {
                            const [nbaRes, nflRes] = await Promise.allSettled([
                                fastFetch2('https://topstreamer.site/nba/schedule', { 'User-Agent': 'Mozilla/5.0' }, 2200),
                                fastFetch2('https://topstreamer.site/nfl/schedule', { 'User-Agent': 'Mozilla/5.0' }, 2200)
                            ]);
                            function parseTopSchedule(rawHtml, prefix, sportName) {
                                const blocks = rawHtml.split('class="item upcoming');
                                for (let i = 1; i < blocks.length; i++) {
                                    const b = blocks[i];
                                    const names = [];
                                    const nameRe = /<div class="name">([^<]+)<\/div>/g;
                                    let nm;
                                    while ((nm = nameRe.exec(b)) !== null) names.push(nm[1].trim());
                                    const linkMatch = b.match(new RegExp(`href="(/${prefix}/[^"]+)"`));
                                    if (names.length >= 2 && linkMatch) {
                                        const away = names[0];
                                        const home = names[1];
                                        const teamKey = linkMatch[1].replace(`/${prefix}/`, '');
                                        const mId = `TOP:${prefix}_${teamKey.toLowerCase().trim()}`;
                                        if (!seenIds.has(mId)) {
                                            seenIds.add(mId);
                                            allItems.push({
                                                match_id: mId,
                                                name: `${away} - ${home}`,
                                                sport: sportName,
                                                start_ts: Math.floor(Date.now() / 1000)
                                            });
                                        }
                                    }
                                }
                            }

                            if (nbaRes.status === 'fulfilled' && nbaRes.value && nbaRes.value.ok) {
                                const html = await nbaRes.value.text();
                                parseTopSchedule(html, 'nba', 'basketball');
                            }
                            if (nflRes.status === 'fulfilled' && nflRes.value && nflRes.value.ok) {
                                const html2 = await nflRes.value.text();
                                parseTopSchedule(html2, 'nfl', 'american-football');
                            }
                            // Fallback active topstreamer games if schedule fetch lags
                            const fallbackGames = [
                                { match_id: 'TOP:nba_wizards', name: 'Hornets - Wizards', sport: 'basketball' },
                                { match_id: 'TOP:nba_76ers', name: 'Knicks - 76ers', sport: 'basketball' },
                                { match_id: 'TOP:nba_celtics', name: 'Bulls - Celtics', sport: 'basketball' },
                                { match_id: 'TOP:nba_warriors', name: 'Suns - Warriors', sport: 'basketball' },
                                { match_id: 'TOP:nfl_packers', name: 'Panthers - Packers', sport: 'american-football' },
                                { match_id: 'TOP:nfl_bills', name: 'Ravens - Bills', sport: 'american-football' },
                                { match_id: 'TOP:nfl_cowboys', name: 'Cardinals - Cowboys', sport: 'american-football' }
                            ];
                            for (const fg of fallbackGames) {
                                if (!seenIds.has(fg.match_id)) {
                                    seenIds.add(fg.match_id);
                                    allItems.push({ ...fg, start_ts: Math.floor(Date.now() / 1000) });
                                }
                            }
                        } catch (e) {}
                    })()
                ]);

                return new Response(JSON.stringify({ date: date, items: allItems }), {
                    status: 200,
                    headers: {
                        ...corsHeaders,
                        'Cache-Control': 'public, max-age=30, stale-while-revalidate=120'
                    }
                });
            }

            // Sport: Cricket
            if (sport === 'cricket') {
                const cItems = [
                    { match_id: 'FS:OjOKEBcN', name: 'Australia vs South Africa (Test)' },
                    { match_id: 'FS:Sf1w7jsR', name: 'Pakistan vs Sri Lanka' },
                    { match_id: 'FS:f3Cirdak', name: 'Bangladesh vs West Indies' },
                    { match_id: 'FS:l2XddLp9', name: 'United Arab Emirates vs Netherlands' }
                ];
                const cSeen = new Set(['FS:OjOKEBcN', 'FS:Sf1w7jsR', 'FS:f3Cirdak', 'FS:l2XddLp9']);
                for (const host of ['dzeko11.pk', 'strumyk.pk']) {
                    try {
                        const hostUrl = `https://${host}/api/v1/cricket/${encodeURIComponent(date)}`;
                        const resp = await fastFetch2(hostUrl, { 'User-Agent': 'Mozilla/5.0', 'Referer': `https://${host}/` }, 2000);
                        if (resp && resp.ok) {
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

            // Sport: Basketball (Add TopStreamer NBA games)
            if (sport === 'basketball') {
                const bItems = [];
                const bSeen = new Set();
                for (const host of ['dzeko11.pk', 'strumyk.pk']) {
                    try {
                        const hostUrl = `https://${host}/api/v1/basketball/${encodeURIComponent(date)}`;
                        const resp = await fastFetch2(hostUrl, { 'User-Agent': 'Mozilla/5.0', 'Referer': `https://${host}/` }, 2000);
                        if (resp && resp.ok) {
                            const data = await resp.json();
                            for (const it of (data.items || [])) {
                                if (it.match_id && !bSeen.has(it.match_id)) {
                                    bSeen.add(it.match_id);
                                    bItems.push(it);
                                }
                            }
                            break;
                        }
                    } catch (e) {}
                }
                try {
                    const topRes = await fastFetch2('https://topstreamer.site/nba/schedule', { 'User-Agent': 'Mozilla/5.0' }, 2200);
                    if (topRes && topRes.ok) {
                        const html = await topRes.text();
                        const blocks = html.split('class="item upcoming');
                        for (let i = 1; i < blocks.length; i++) {
                            const b = blocks[i];
                            const names = [];
                            const nameRe = /<div class="name">([^<]+)<\/div>/g;
                            let nm;
                            while ((nm = nameRe.exec(b)) !== null) names.push(nm[1].trim());
                            const linkMatch = b.match(/href="(\/nba\/[^"]+)"/);
                            if (names.length >= 2 && linkMatch) {
                                const teamKey = linkMatch[1].replace('/nba/', '');
                                const tId = `TOP:nba_${teamKey.toLowerCase().trim()}`;
                                if (!bSeen.has(tId)) {
                                    bSeen.add(tId);
                                    bItems.push({ match_id: tId, name: `${names[0]} - ${names[1]}`, sport: 'basketball', start_ts: Math.floor(Date.now() / 1000) });
                                }
                            }
                        }
                    }
                } catch (e) {}

                return new Response(JSON.stringify({ date: date, items: bItems }), {
                    status: 200,
                    headers: corsHeaders
                });
            }

            // Sport: American Football (Add TopStreamer NFL games)
            if (sport === 'american-football') {
                const nflItems = [];
                const nflSeen = new Set();
                try {
                    const topRes = await fastFetch2('https://topstreamer.site/nfl/schedule', { 'User-Agent': 'Mozilla/5.0' }, 2200);
                    if (topRes && topRes.ok) {
                        const html = await topRes.text();
                        const blocks = html.split('class="item upcoming');
                        for (let i = 1; i < blocks.length; i++) {
                            const b = blocks[i];
                            const names = [];
                            const nameRe = /<div class="name">([^<]+)<\/div>/g;
                            let nm;
                            while ((nm = nameRe.exec(b)) !== null) names.push(nm[1].trim());
                            const linkMatch = b.match(/href="(\/nfl\/[^"]+)"/);
                            if (names.length >= 2 && linkMatch) {
                                const teamKey = linkMatch[1].replace('/nfl/', '');
                                const tId = `TOP:nfl_${teamKey.toLowerCase().trim()}`;
                                if (!nflSeen.has(tId)) {
                                    nflSeen.add(tId);
                                    nflItems.push({ match_id: tId, name: `${names[0]} - ${names[1]}`, sport: 'american-football', start_ts: Math.floor(Date.now() / 1000) });
                                }
                            }
                        }
                    }
                } catch (e) {}

                return new Response(JSON.stringify({ date: date, items: nflItems }), {
                    status: 200,
                    headers: corsHeaders
                });
            }

            // Try Dzeko and Strumyk daily sport API
            for (const host of ['dzeko11.pk', 'strumyk.pk']) {
                try {
                    const hostUrl = `https://${host}/api/v1/${encodeURIComponent(sport)}/${encodeURIComponent(date)}`;
                    const resp = await fastFetch2(hostUrl, {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                        'Referer': `https://${host}/`,
                        'Accept': 'application/json'
                    }, 2200);

                    if (resp && resp.ok) {
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
                const fsResp = await fastFetch2(fsFeedUrl, {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'X-Fsign': 'SW9D1eZo',
                    'Origin': 'https://dzeko11.pk',
                    'Referer': 'https://dzeko11.pk/'
                }, 2500);

                if (fsResp && fsResp.ok) {
                    const text = await fsResp.text();
                    const events = text.split('~AA÷');
                    const items = [];

                    for (let i = 1; i < events.length; i++) {
                        const ev = events[i];
                        const evId = ev.split('¬')[0];
                        if (evId) {
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
                    const data = await timRes.json();
                    const channels = data.channels || [];
                    const items = channels.map(c => ({
                        id: c.url || c.name,
                        name: c.name,
                        poster: c.logo || '/assets/favicon-96x96.png',
                        category: (data.genres || []).find(g => g.id === c.genre)?.name || 'Sports',
                        status: '24/7',
                        streams: (c.streams || []).map(s => ({
                            name: s.name || 'Server 1',
                            url: s.url
                        }))
                    }));

                    return new Response(JSON.stringify({
                        items: items,
                        counts: { channels: items.length }
                    }), {
                        status: 200,
                        headers: {
                            ...corsHeaders,
                            'Cache-Control': 'public, max-age=300, stale-while-revalidate=600'
                        }
                    });
                }
            } catch (err) {}

            // Fallback: local channels.json
            const origin = new URL(context.request.url).origin;
            const fallbackRes = await fetch(`${origin}/assets/channels.json`);
            if (fallbackRes.ok) {
                const fbData = await fallbackRes.json();
                return new Response(JSON.stringify({
                    items: fbData['24/7 Channels'] || [],
                    counts: { channels: (fbData['24/7 Channels'] || []).length }
                }), { status: 200, headers: corsHeaders });
            }

            return new Response(JSON.stringify({ items: [], counts: { channels: 0 } }), {
                status: 200,
                headers: corsHeaders
            });
        }

        return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
            status: 404,
            headers: corsHeaders
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: corsHeaders
        });
    }
}
