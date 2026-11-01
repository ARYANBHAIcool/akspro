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

            // Handle ehgembxe / Tim-Streams / BinTV embeds (strip anti-sandbox & ads, spoof Referer)
            if (rawUrl && (/^https?:\/\/ehgembxe\.cfd\//i.test(rawUrl) || /^https?:\/\/bintv-sources\.pages\.dev\//i.test(rawUrl))) {
                let targetUrl = rawUrl;
                if (/bintv-sources\.pages\.dev/i.test(rawUrl)) {
                    try {
                        const u = new URL(rawUrl);
                        const idParam = u.searchParams.get('id');
                        if (idParam) {
                            const decoded = atob(idParam.replace(/-/g, '+').replace(/_/g, '/'));
                            if (/^https?:\/\//i.test(decoded)) targetUrl = decoded;
                        }
                    } catch (e) {}
                }
                try {
                    const resp = await fetch(targetUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                            'Referer': 'https://tim-streams.com/'
                        }
                    });
                    if (resp.ok) {
                        let html = await resp.text();
                        // Strip the anti-sandbox probe script cleanly!
                        html = html.replace(/<script[^>]*>(?:(?!<\/script>)[\s\S])*?Remove sandbox attributes[\s\S]*?<\/script>/gi, '');
                        html = html.replace(/<script[^>]*>(?:(?!<\/script>)[\s\S])*?__sb_probe[\s\S]*?<\/script>/gi, '');
                        html = html.replace(/<script[^>]*disable-devtool[^>]*>[\s\S]*?<\/script>/gi, '');
                        html = html.replace(/<script[^>]*aclib\.runPop[\s\S]*?<\/script>/gi, '');
                        html = html.replace('<head>', '<head><base href="https://ehgembxe.cfd/">');
                        const darkCss = `<style>
html, body { width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; background: #000 !important; overflow: hidden !important; }
#player, .jwplayer { width: 100% !important; height: 100% !important; }
video { width: 100% !important; height: 100% !important; object-fit: contain !important; }
</style>`;
                        html = html.replace('</head>', darkCss + '</head>');
                        return new Response(html, {
                            status: 200,
                            headers: {
                                'Content-Type': 'text/html; charset=utf-8',
                                'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
                                'Access-Control-Allow-Origin': '*'
                            }
                        });
                    }
                } catch (e) {}
                return Response.redirect(targetUrl, 302);
            }

            // Handle TopStreamer proxy (strip X-Frame-Options and CSP frame-ancestors)
            if (rawUrl && /^https?:\/\/(?:www\.)?topstreamer\.site\//i.test(rawUrl)) {
                try {
                    const topResp = await fetch(rawUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                            'Referer': 'https://topstreamer.site/'
                        }
                    });
                    if (topResp.ok) {
                        let topHtml = await topResp.text();
                        topHtml = topHtml.replace('<head>', '<head><base href="https://topstreamer.site/">');
                        topHtml = topHtml.replace(/<script[^>]*popunder[^>]*>[\s\S]*?<\/script>/gi, '');
                        topHtml = topHtml.replace(/<script[^>]*aclib\.runPop[^>]*>[\s\S]*?<\/script>/gi, '');
                        const customCss = `<style>
html, body { width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; background: #000 !important; overflow: hidden !important; }
#container, .container { display: none !important; }
#main-video, #playerContainer, .playerContainer { position: fixed !important; inset: 0 !important; width: 100% !important; height: 100% !important; max-width: 100% !important; border-radius: 0 !important; background: #000 !important; z-index: 10 !important; }
video { width: 100% !important; height: 100% !important; object-fit: contain !important; }
#dialog, .ui-dialog, .ui-widget-overlay, .banner, [class*="ad-"] { display: none !important; }
.stream-picker { position: fixed !important; bottom: 12px !important; left: 50% !important; transform: translateX(-50%) !important; z-index: 99 !important; background: rgba(0,0,0,0.7) !important; padding: 6px 12px !important; border-radius: 20px !important; display: flex !important; gap: 8px !important; }
.stream-btn { font-size: 11px !important; height: 26px !important; line-height: 26px !important; padding: 0 10px !important; border-radius: 13px !important; }
</style>`;
                        topHtml = topHtml.replace('</head>', customCss + '</head>');
                        return new Response(topHtml, {
                            status: 200,
                            headers: {
                                'Content-Type': 'text/html; charset=utf-8',
                                'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
                                'Access-Control-Allow-Origin': '*'
                            }
                        });
                    }
                } catch (e) {}
                return Response.redirect(rawUrl, 302);
            }

            // Direct iframe proxy with upstream referer bypass
            if (rawUrl && /^https?:\/\//i.test(rawUrl)) {
                return Response.redirect(rawUrl, 302);
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

            // 1. Edge WebSocket proxy (forwards with Origin: https://iplayer24.me to bypass 403)
            html = html.replace('wss://l1.strims24.st/ws', '/api/ws');
            html = html.replace('src="/lib/tk.js"', 'src="https://iplayer24.me/lib/tk.js"');

            // 2. Strip intrusive ads/popups/runtime completely
            html = html.replace(/<script[^>]*>(?:(?!<script)[\s\S])*?runtime\.js[\s\S]*?<\/script>/gi, '');
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
            let rawId = parts.slice(1).join('/');
            try { rawId = decodeURIComponent(rawId); } catch (e) {}
            let cleanId = rawId.replace(/^(FS:|CUST:|TIM:|TOP:|BIN:)/, '');
            try { cleanId = decodeURIComponent(cleanId); } catch (e) {}
            const fsId = rawId.startsWith('CUST:') || rawId.startsWith('TIM:') || rawId.startsWith('TOP:') || rawId.startsWith('BIN:') ? rawId : `FS:${cleanId}`;

            const urlObj = new URL(request.url);
            const qSport = (urlObj.searchParams.get('sport') || '').toLowerCase();
            const qHome = urlObj.searchParams.get('home') || '';
            const qAway = urlObj.searchParams.get('away') || '';

            const customUrls = [];
            const seenUrls = new Set();
            const seenNames = new Set();

            function normalizeTeam(t) {
                if (!t) return '';
                return t.toLowerCase()
                    .replace(/\b(fc|cf|sc|afc|ssc|ac|as|rc|sk|cd|ca|bv|sv|fk|vfb|tsg|rb)\b/g, '')
                    .replace(/\b(united|city|town|wanderers|albion|rovers|county|athletic|hotspur|wednesday)\b/g, '')
                    .replace(/[^a-z0-9]/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
            }

            function matchTeams(h, a, text) {
                if (!text) return false;
                const txt = text.toLowerCase().replace(/[^a-z0-9]/g, ' ');
                const hNorm = normalizeTeam(h);
                const aNorm = normalizeTeam(a);
                if (hNorm.length >= 3 && aNorm.length >= 3) {
                    if (txt.includes(hNorm) && txt.includes(aNorm)) return true;
                }
                const hClean = (h || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
                const aClean = (a || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
                if (hClean.length >= 4 && aClean.length >= 4) {
                    if (txt.includes(hClean) && txt.includes(aClean)) return true;
                }
                return false;
            }

            function addStream(name, url, directUrl) {
                if (!url) return;
                let playUrl = url.trim();
                let direct = directUrl || playUrl;

                // Route anti-sandbox/cors hosts through edge stream proxy
                if (/ehgembxe\.cfd/i.test(playUrl) || /bintv-sources\.pages\.dev/i.test(playUrl)) {
                    direct = playUrl;
                    playUrl = `/api/v1/stream?src=${encodeURIComponent(playUrl)}`;
                } else if (/^[a-f0-9]{32}$/i.test(playUrl)) {
                    direct = `https://iplayer24.me/beta/${playUrl}`;
                    playUrl = `/api/v1/stream?token=${playUrl}`;
                } else if (/^https?:\/\/(?:www\.)?topstreamer\.site\//i.test(playUrl)) {
                    direct = playUrl;
                    playUrl = `/api/v1/stream?src=${encodeURIComponent(playUrl)}`;
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

            // Concurrently query GraphQL, Dzeko, Strumyk, BinTV, Tim-Streams, and Footy4u
            const gqlUrl = `https://2.ds.lsapp.eu/pq_graphql?_hash=dsof&eventId=${cleanId}&projectId=2`;
            const dzekoUrl = `https://dzeko11.pk/api/v1/match/FS:${cleanId}`;
            const strumykUrl = `https://strumyk.pk/api/v1/match/FS:${cleanId}`;
            const bintvUrl = `https://bintvjson.lovable.app/api/public/bintvjson`;
            const timLiveUrl = `https://tim-streams.com/api/live-upcoming`;
            const timChanUrl = `https://tim-streams.com/api/channels`;
            const footy4uUrl = `https://footy4u.st/`;

            const [gqlRes, dzekoRes, strumykRes, bintvRes, timLiveRes, timChanRes, footyRes] = await Promise.allSettled([
                fastFetch(gqlUrl, { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, 2000),
                fastFetch(dzekoUrl, { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://dzeko11.pk/' }, 2200),
                fastFetch(strumykUrl, { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://strumyk.pk/' }, 2200),
                fastFetch(bintvUrl, { 'Accept': 'application/json' }, 2000),
                fastFetch(timLiveUrl, { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }, 2000),
                fastFetch(timChanUrl, { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }, 1800),
                fastFetch(footy4uUrl, { 'User-Agent': 'Mozilla/5.0' }, 2200)
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

            // Fallback to query params or known match IDs
            if (!homeName && qHome) homeName = qHome;
            if (!awayName && qAway) awayName = qAway;
            if (cleanId === 'OjOKEBcN' && !homeName) { homeName = 'Australia'; awayName = 'South Africa'; }
            if (cleanId === 'Sf1w7jsR' && !homeName) { homeName = 'Pakistan'; awayName = 'Sri Lanka'; }
            if (cleanId === 'f3Cirdak' && !homeName) { homeName = 'Bangladesh'; awayName = 'West Indies'; }
            if (cleanId === 'OWc65atm' && !homeName) { homeName = 'Chelsea'; awayName = 'Manchester Utd'; }

            // Special handle for TIM:, BIN:, or TOP: IDs
            function parseCustomTeams(str) {
                if (!str) return { home: '', away: '' };
                if (str.includes('-v-') || str.includes('-vs-')) {
                    const vParts = str.split(/-vs?-/i);
                    const h = vParts[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim();
                    const a = (vParts[1] || '').replace(/-\d+$/, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim();
                    return { home: h, away: a };
                } else if (str.includes('@')) {
                    const atParts = str.split(/\s*@\s*/);
                    return { home: atParts[0]?.trim() || '', away: atParts[1]?.trim() || '' };
                } else if (/\s+vs\.?\s+/i.test(str)) {
                    const vsParts = str.split(/\s+vs\.?\s+/i);
                    return { home: vsParts[0]?.trim() || '', away: vsParts[1]?.trim() || '' };
                } else if (/\s+-\s+/.test(str)) {
                    const dashParts = str.split(/\s+-\s+/);
                    return { home: dashParts[0]?.trim() || '', away: dashParts[1]?.trim() || '' };
                }
                return { home: str.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim(), away: '' };
            }

            if (rawId.startsWith('TIM:')) {
                const parsed = parseCustomTeams(cleanId);
                homeName = parsed.home;
                awayName = parsed.away;
            } else if (rawId.startsWith('BIN:')) {
                const parsed = parseCustomTeams(cleanId);
                homeName = parsed.home;
                awayName = parsed.away;
            } else if (rawId.startsWith('TOP:')) {
                const isNba = cleanId.startsWith('nba_');
                const isNfl = cleanId.startsWith('nfl_');
                const team = cleanId.replace(/^(nba_|nfl_)/, '').toLowerCase().trim();

                const nbaMap = {
                    bucks: { name: 'Milwaukee Bucks', opp: 'Cleveland Cavaliers' },
                    cavaliers: { name: 'Cleveland Cavaliers', opp: 'Milwaukee Bucks' },
                    spurs: { name: 'San Antonio Spurs', opp: 'Minnesota Timberwolves' },
                    timberwolves: { name: 'Minnesota Timberwolves', opp: 'San Antonio Spurs' },
                    grizzlies: { name: 'Memphis Grizzlies', opp: 'Sacramento Kings' },
                    kings: { name: 'Sacramento Kings', opp: 'Memphis Grizzlies' },
                    rockets: { name: 'Houston Rockets', opp: 'Oklahoma City Thunder' },
                    thunder: { name: 'Oklahoma City Thunder', opp: 'Houston Rockets' },
                    jazz: { name: 'Utah Jazz', opp: 'Portland Trail Blazers' },
                    trailblazers: { name: 'Portland Trail Blazers', opp: 'Utah Jazz' },
                    blazers: { name: 'Portland Trail Blazers', opp: 'Utah Jazz' },
                    hornets: { name: 'Charlotte Hornets', opp: 'Philadelphia 76ers' },
                    '76ers': { name: 'Philadelphia 76ers', opp: 'Charlotte Hornets' },
                    pelicans: { name: 'New Orleans Pelicans', opp: 'Atlanta Hawks' },
                    hawks: { name: 'Atlanta Hawks', opp: 'New Orleans Pelicans' }
                };

                if (isNba) {
                    const matchInfo = nbaMap[team];
                    if (matchInfo) {
                        if (!homeName) homeName = matchInfo.name;
                        if (!awayName) awayName = matchInfo.opp;
                    } else {
                        if (!homeName) homeName = team.toUpperCase();
                    }
                    addStream(`TopStreamer HD (NBA)`, `https://topstreamer.site/nba/${team}`, `https://topstreamer.site/nba/${team}`);
                } else if (isNfl) {
                    if (!homeName) homeName = team.toUpperCase();
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
                    const cLow = cleanId.toLowerCase();

                    for (const ev of allEvents) {
                        const evName = ev.name || '';
                        const evId = ev.id || '';
                        let isMatch = false;
                        if (rawId.startsWith('BIN:') && (evId.toLowerCase().includes(cLow) || cLow.includes(evId.toLowerCase()) || evName.toLowerCase().includes(cLow))) {
                            isMatch = true;
                        } else if (matchTeams(homeName, awayName, evName) || matchTeams(homeName, awayName, evId)) {
                            isMatch = true;
                        }

                        if (isMatch) {
                            for (const s of (ev.streams || [])) {
                                if (s.url) addStream(s.name || `BinTV Live Stream ${customUrls.length + 1}`, s.url, s.url);
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
                    const cLow = cleanId.toLowerCase();

                    for (const ev of tEvents) {
                        const evName = ev.name || '';
                        const evUrl = ev.url || '';
                        let isMatch = false;
                        if (rawId.startsWith('TIM:') && (evName.toLowerCase().includes(cLow) || cLow.includes(evName.toLowerCase()) || evUrl.toLowerCase().includes(cLow))) {
                            isMatch = true;
                        } else if (matchTeams(homeName, awayName, evName) || matchTeams(homeName, awayName, evUrl.replace(/-/g, ' '))) {
                            isMatch = true;
                        }

                        if (isMatch) {
                            for (const s of (ev.streams || [])) {
                                if (s.url) addStream(`TimStreams (${s.name || 'HD Feed'})`, s.url, s.url);
                            }
                        }
                    }
                } catch (e) {}
            }

            // E. Match against Footy4U events directory
            if (footyRes.status === 'fulfilled' && footyRes.value && footyRes.value.ok) {
                try {
                    const fHtml = await footyRes.value.text();
                    const matches = Array.from(fHtml.matchAll(/href=["'](\/events\/[a-z0-9-]+)["']/gi));
                    for (const m of matches) {
                        const slug = m[1];
                        const slugText = slug.replace('/events/', '').replace(/-/g, ' ');
                        if (matchTeams(homeName, awayName, slugText)) {
                            const evRes = await fastFetch(`https://footy4u.st${slug}`, { 'User-Agent': 'Mozilla/5.0' }, 2000);
                            if (evRes && evRes.ok) {
                                const evHtml = await evRes.text();
                                const embedLinks = evHtml.match(/https?:\/\/[^\s"'<>]+/g) || [];
                                const validEmbeds = embedLinks.filter(u => 
                                    (u.includes('hitcast.st') || u.includes('streamec.st') || u.includes('rockyembed.st') || u.includes('flyembed.cfd') || u.includes('daddylive1') || u.includes('taifood-blog') || u.includes('trendy48') || u.includes('vivtops') || u.includes('vertex') || u.includes('embedcenter') || u.includes('gblog')) &&
                                    !u.endsWith('.png') && !u.endsWith('.jpg') && !u.endsWith('.js') && !u.endsWith('.css')
                                );
                                let idx = 1;
                                for (const emb of new Set(validEmbeds)) {
                                    let cleanUrl = emb;
                                    const srcMatch = emb.match(/[?&]src=([^&]+)/);
                                    if (srcMatch) cleanUrl = decodeURIComponent(srcMatch[1]);
                                    addStream(`Footy4U Server ${idx++}`, cleanUrl, cleanUrl);
                                }
                            }
                            break;
                        }
                    }
                } catch (e) {}
            }

            // F. Parse Tim-Streams 24/7 Channels
            let timChannels = [];
            if (timChanRes.status === 'fulfilled' && timChanRes.value && timChanRes.value.ok) {
                try {
                    const tChanData = await timChanRes.value.json();
                    timChannels = tChanData.channels || [];
                } catch (e) {}
            }

            if (timChannels.length > 0) {
                try {
                    const hNorm = normalizeTeam(homeName);
                    const aNorm = normalizeTeam(awayName);

                    for (const ch of timChannels) {
                        const chName = (ch.name || '').toLowerCase();
                        let matchesChannel = false;
                        if (hNorm.length >= 4 && chName.includes(hNorm)) matchesChannel = true;
                        if (aNorm.length >= 4 && chName.includes(aNorm)) matchesChannel = true;

                        if (matchesChannel) {
                            for (const s of (ch.streams || [])) {
                                if (s.url) addStream(`${ch.name} (TV Feed)`, s.url, s.url);
                            }
                        }
                    }
                } catch (e) {}
            }

            // G. Cricket match broadcaster channels (Sky Sports Cricket, Willow, Sony Sports, Fox Sports, Ten Sports)
            const isCricket = qSport === 'cricket' ||
                ['Sf1w7jsR', 'OjOKEBcN', 'f3Cirdak', 'l2XddLp9'].includes(cleanId) ||
                /cricket|pakistan|sri lanka|south africa|australia|india|new zealand|bangladesh|west indies/i.test(`${homeName} ${awayName} ${cleanId}`);

            if (isCricket && timChannels.length > 0) {
                try {
                    for (const ch of timChannels) {
                        const chName = (ch.name || '').toLowerCase();
                        if (chName.includes('cricket') || chName.includes('willow') || chName.includes('sony sports') || chName.includes('ptv') || chName.includes('ten sports')) {
                            for (const s of (ch.streams || [])) {
                                if (s.url) addStream(`${ch.name} (Live TV)`, s.url, s.url);
                            }
                        }
                    }
                } catch (e) {}
            }

            // Prioritize reliable embeddable match streams:
            // 1. Direct embed streams without iframe restrictions (streamec, rockyembed, flyembed, vivtops, trendy48, taifood, vertex, daddylive, hitcast)
            // 2. Proxied streams (/api/v1/stream?src=)
            // 3. Dzeko/Strumyk proxied match streams (/api/v1/stream?token=)
            // 4. TopStreamer streams (which work directly via pop-out)
            customUrls.sort((a, b) => {
                const aEmbed = Boolean(a.url && (a.url.includes('streamec') || a.url.includes('rockyembed') || a.url.includes('flyembed') || a.url.includes('daddylive') || a.url.includes('vivtops') || a.url.includes('trendy48') || a.url.includes('taifood') || a.url.includes('hitcast') || a.url.includes('vertex')));
                const bEmbed = Boolean(b.url && (b.url.includes('streamec') || b.url.includes('rockyembed') || b.url.includes('flyembed') || b.url.includes('daddylive') || b.url.includes('vivtops') || b.url.includes('trendy48') || b.url.includes('taifood') || b.url.includes('hitcast') || b.url.includes('vertex')));
                if (aEmbed && !bEmbed) return -1;
                if (!aEmbed && bEmbed) return 1;

                const aSrc = Boolean(a.url && a.url.startsWith('/api/v1/stream?src='));
                const bSrc = Boolean(b.url && b.url.startsWith('/api/v1/stream?src='));
                if (aSrc && !bSrc) return -1;
                if (!aSrc && bSrc) return 1;

                const aToken = Boolean(a.url && a.url.startsWith('/api/v1/stream?token='));
                const bToken = Boolean(b.url && b.url.startsWith('/api/v1/stream?token='));
                if (aToken && !bToken) return -1;
                if (!aToken && bToken) return 1;

                const aTop = Boolean(a.url && a.url.includes('topstreamer.site'));
                const bTop = Boolean(b.url && b.url.includes('topstreamer.site'));
                if (aTop && !bTop) return 1;
                if (!aTop && bTop) return -1;

                return 0;
            });
            customUrls.forEach((u, i) => {
                u.id = `srv-${i + 1}`;
            });

            const matchHeaders = {
                ...corsHeaders,
                'Cache-Control': 'public, max-age=20, stale-while-revalidate=60'
            };

            const matchName = (homeName && awayName) ? `${homeName} - ${awayName}` : (homeName || cleanId);
            return new Response(JSON.stringify({
                match_id: rawId,
                name: matchName,
                sport: qSport || 'football',
                start_ts: Math.floor(Date.now() / 1000) - 1800,
                status: '2',
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
                                            allItems.push({
                                                ...it,
                                                sport: sp
                                            });
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
                                const genreToSport = {
                                    1: 'football',
                                    2: 'motorsport',
                                    3: 'basketball',
                                    7: 'basketball',
                                    5: 'mma',
                                    8: 'american-football',
                                    11: 'hockey',
                                    16: 'boxing',
                                    28: 'mma'
                                };
                                for (const ev of (tData.events || [])) {
                                    const tId = `TIM:${encodeURIComponent(ev.name || 'Event')}`;
                                    if (!seenIds.has(tId)) {
                                        seenIds.add(tId);
                                        const sp = genreToSport[ev.genre] || 'football';
                                        allItems.push({
                                            match_id: tId,
                                            name: ev.name,
                                            sport: sp,
                                            start_ts: Math.floor(Date.now() / 1000)
                                        });
                                    }
                                }
                            }
                        } catch (e) {}
                    })(),
                    // B2. Query BinTV Live & Upcoming Events
                    (async () => {
                        try {
                            const bRes = await fastFetch2('https://bintvjson.lovable.app/api/public/bintvjson', { 'Accept': 'application/json' }, 2000);
                            if (bRes && bRes.ok) {
                                const bData = await bRes.json();
                                const bEvents = [
                                    ...(bData['Live Events'] || []),
                                    ...(bData['Upcoming Events'] || [])
                                ];
                                for (const ev of bEvents) {
                                    const bId = `BIN:${encodeURIComponent(ev.id || ev.name || 'Event')}`;
                                    if (!seenIds.has(bId)) {
                                        seenIds.add(bId);
                                        let sp = 'football';
                                        const cat = (ev.category || '').toLowerCase();
                                        if (cat.includes('cricket')) sp = 'cricket';
                                        else if (cat.includes('basket') || cat.includes('nba')) sp = 'basketball';
                                        else if (cat.includes('motor') || cat.includes('racing') || cat.includes('f1')) sp = 'motorsport';
                                        else if (cat.includes('nfl') || cat.includes('american')) sp = 'american-football';
                                        else if (cat.includes('hockey') || cat.includes('nhl')) sp = 'hockey';
                                        else if (cat.includes('tennis')) sp = 'tennis';
                                        else if (cat.includes('mma') || cat.includes('ufc') || cat.includes('fight')) sp = 'mma';

                                        allItems.push({
                                            match_id: bId,
                                            name: ev.name,
                                            sport: sp,
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
                                fastFetch2('https://topstreamer.site/nba/schedule', { 'User-Agent': 'Mozilla/5.0' }, 3500),
                                fastFetch2('https://topstreamer.site/nfl/schedule', { 'User-Agent': 'Mozilla/5.0' }, 3500)
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

            // Sport: Basketball (Unified NBA Schedule: TopStreamer + BinTV + Tim-Streams + Dzeko)
            if (sport === 'basketball') {
                const bItems = [];
                const bSeen = new Set();

                const [topRes, bintvRes, timRes, dzekoRes, strumykRes] = await Promise.allSettled([
                    fastFetch2('https://topstreamer.site/nba/schedule', { 'User-Agent': 'Mozilla/5.0' }, 3500),
                    fastFetch2('https://bintvjson.lovable.app/api/public/bintvjson', { 'Accept': 'application/json' }, 2500),
                    fastFetch2('https://tim-streams.com/api/live-upcoming', { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }, 2500),
                    fastFetch2(`https://dzeko11.pk/api/v1/basketball/${encodeURIComponent(date)}`, { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://dzeko11.pk/' }, 2500),
                    fastFetch2(`https://strumyk.pk/api/v1/basketball/${encodeURIComponent(date)}`, { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://strumyk.pk/' }, 2500)
                ]);

                // 1. TopStreamer Live NBA Games
                if (topRes.status === 'fulfilled' && topRes.value && topRes.value.ok) {
                    try {
                        const html = await topRes.value.text();
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
                                    bItems.push({
                                        match_id: tId,
                                        name: `${names[0]} vs ${names[1]}`,
                                        sport: 'basketball',
                                        start_ts: Math.floor(Date.now() / 1000)
                                    });
                                }
                            }
                        }
                    } catch (e) {}
                }

                // 2. BinTV Live NBA Games
                if (bintvRes.status === 'fulfilled' && bintvRes.value && bintvRes.value.ok) {
                    try {
                        const bData = await bintvRes.value.json();
                        const allEvents = [...(bData['Live Events'] || []), ...(bData['Upcoming Events'] || [])];
                        for (const ev of allEvents) {
                            if ((ev.category || '').toLowerCase().includes('basket') || (ev.name || '').toLowerCase().includes('nba')) {
                                const bId = `BIN:${ev.id}`;
                                if (!bSeen.has(bId)) {
                                    bSeen.add(bId);
                                    bItems.push({
                                        match_id: bId,
                                        name: ev.name,
                                        sport: 'basketball',
                                        start_ts: Math.floor(Date.now() / 1000)
                                    });
                                }
                            }
                        }
                    } catch (e) {}
                }

                // 3. Tim-Streams Live NBA Games
                if (timRes.status === 'fulfilled' && timRes.value && timRes.value.ok) {
                    try {
                        const tData = await timRes.value.json();
                        for (const ev of (tData.events || [])) {
                            if (ev.genre === 7 || (ev.sport || '').toLowerCase().includes('basket') || (ev.name || '').toLowerCase().includes('nba')) {
                                const tId = `TIM:${encodeURIComponent(ev.name || ev.url || 'Event')}`;
                                if (!bSeen.has(tId)) {
                                    bSeen.add(tId);
                                    bItems.push({
                                        match_id: tId,
                                        name: ev.name,
                                        sport: 'basketball',
                                        start_ts: Math.floor(Date.now() / 1000)
                                    });
                                }
                            }
                        }
                    } catch (e) {}
                }

                // 4. Dzeko & Strumyk Basketball Fixtures
                for (const r of [dzekoRes, strumykRes]) {
                    if (r.status === 'fulfilled' && r.value && r.value.ok) {
                        try {
                            const data = await r.value.json();
                            for (const it of (data.items || [])) {
                                if (it.match_id && !bSeen.has(it.match_id)) {
                                    bSeen.add(it.match_id);
                                    bItems.push(it);
                                }
                            }
                            break;
                        } catch (e) {}
                    }
                }

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
                    const topRes = await fastFetch2('https://topstreamer.site/nfl/schedule', { 'User-Agent': 'Mozilla/5.0' }, 3500);
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
                                    nflItems.push({ match_id: tId, name: `${names[0]} vs ${names[1]}`, sport: 'american-football', start_ts: Math.floor(Date.now() / 1000) });
                                }
                            }
                        }
                    }
                } catch (e) {}

                // Also fetch Dzeko & Strumyk for NFL
                for (const host of ['dzeko11.pk', 'strumyk.pk']) {
                    try {
                        const hostUrl = `https://${host}/api/v1/american-football/${encodeURIComponent(date)}`;
                        const resp = await fastFetch2(hostUrl, { 'User-Agent': 'Mozilla/5.0', 'Referer': `https://${host}/` }, 2500);
                        if (resp && resp.ok) {
                            const data = await resp.json();
                            for (const it of (data.items || [])) {
                                if (it.match_id && !nflSeen.has(it.match_id)) {
                                    nflSeen.add(it.match_id);
                                    nflItems.push(it);
                                }
                            }
                            break;
                        }
                    } catch (e) {}
                }

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
