/**
 * Cloudflare Pages Function: /api/v1/[[path]]
 * Edge Router for Live Sports Curated Matches, Match Details, and Unlocked Broadcast Streams
 */

import channelsData from '../../assets/channels.json';

const staticCatalog = channelsData['24/7 Channels'] || [];

function findCatalogStream(name) {
    if (!name || !staticCatalog.length) return null;
    const nLow = name.toLowerCase().trim();
    
    // 1. Direct or substring match
    for (const c of staticCatalog) {
        const cLow = (c.name || '').toLowerCase().trim();
        if (cLow === nLow || nLow.includes(cLow) || cLow.includes(nLow)) {
            const s = c.streams && c.streams[0];
            if (s && s.url) return { name: c.name, url: s.url, country: c.alpha2 || c.country || '' };
        }
    }
    
    // 2. Network keyword matching
    const keywords = ['canal', 'dazn', 'arena', 'sky', 'tnt', 'bein', 'espn', 'premier', 'willow', 'sony', 'ziggo', 'super'];
    for (const kw of keywords) {
        if (nLow.includes(kw)) {
            for (const c of staticCatalog) {
                const cLow = (c.name || '').toLowerCase();
                if (cLow.includes(kw)) {
                    const s = c.streams && c.streams[0];
                    if (s && s.url) return { name: c.name, url: s.url, country: c.alpha2 || c.country || '' };
                }
            }
        }
    }
    return null;
}

export async function onRequest(context) {
    const url = new URL(context.request.url);
    const rawPath = url.pathname.replace(/^\/api\/v1\/?/, '');
    const parts = context.params.path || rawPath.split('/').filter(Boolean);

    const corsHeaders = {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60'
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

            const customUrls = [];
            const seenUrls = new Set();
            const channels = [];
            const seenChannels = new Set();

            // A. Fetch Team Names dynamically via GraphQL
            let homeName = '';
            let awayName = '';
            try {
                const gqlUrl = `https://2.ds.lsapp.eu/pq_graphql?_hash=dsof&eventId=${cleanId}&projectId=2`;
                const gqlRes = await fetch(gqlUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
                });
                if (gqlRes.ok) {
                    const gqlData = await gqlRes.json();
                    const event = gqlData?.data?.findEventById;
                    for (const p of (event?.eventParticipants || [])) {
                        if (p?.type?.side === 'HOME') homeName = p?.name || '';
                        if (p?.type?.side === 'AWAY') awayName = p?.name || '';
                    }
                }
            } catch (gqlErr) {}

            // B. Fetch Live Events from bintvjson
            try {
                const bintvResp = await fetch('https://bintvjson.lovable.app/api/public/bintvjson', {
                    headers: { 'Accept': 'application/json' }
                });
                if (bintvResp.ok) {
                    const bintvData = await bintvResp.json();
                    const allEvents = [
                        ...(bintvData['Live Events'] || []),
                        ...(bintvData['Upcoming Events'] || [])
                    ];

                    for (const ev of allEvents) {
                        const evName = (ev.name || '').toLowerCase();
                        let isMatch = false;

                        if (cleanId.length > 3 && evName.includes(cleanId.toLowerCase())) {
                            isMatch = true;
                        } else if (homeName && homeName.length > 3 && evName.includes(homeName.toLowerCase())) {
                            isMatch = true;
                        } else if (awayName && awayName.length > 3 && evName.includes(awayName.toLowerCase())) {
                            isMatch = true;
                        }

                        if (isMatch) {
                            for (const s of (ev.streams || [])) {
                                if (s.url && !seenUrls.has(s.url)) {
                                    seenUrls.add(s.url);
                                    customUrls.push({
                                        id: `srv-${customUrls.length + 1}`,
                                        name: `Server ${customUrls.length + 1}: ${s.name || 'Live Feed'}`,
                                        url: s.url,
                                        enabled: true
                                    });
                                }
                            }
                        }
                    }
                }
            } catch (bErr) {}

            // C. Query Dzeko Override API and convert broadcaster names to direct unlocked streams
            try {
                const dzekoUrl = `https://dzeko11.pk/api/v1/match/FS:${cleanId}`;
                const dzekoResp = await fetch(dzekoUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                        'Referer': 'https://dzeko11.pk/',
                        'Accept': 'application/json'
                    }
                });
                if (dzekoResp.ok) {
                    const dData = await dzekoResp.json();
                    for (const item of (dData.custom_urls || [])) {
                        if (!item || !item.name) continue;
                        
                        // If it's already a full direct stream URL (not a 32-char hex token)
                        if (item.url && /^https?:\/\//i.test(item.url) && !item.url.includes('iplayer24.me')) {
                            if (!seenUrls.has(item.url)) {
                                seenUrls.add(item.url);
                                customUrls.push({
                                    id: `srv-${customUrls.length + 1}`,
                                    name: `Server ${customUrls.length + 1}: ${item.name}`,
                                    url: item.url,
                                    enabled: true
                                });
                            }
                        } else {
                            // Map broadcaster name to our unlocked catalog streams
                            const catMatch = findCatalogStream(item.name);
                            if (catMatch && !seenUrls.has(catMatch.url)) {
                                seenUrls.add(catMatch.url);
                                customUrls.push({
                                    id: `srv-${customUrls.length + 1}`,
                                    name: `Server ${customUrls.length + 1}: ${catMatch.name}`,
                                    url: catMatch.url,
                                    enabled: true
                                });
                            }
                        }
                    }
                }
            } catch (dErr) {}

            // D. Query Flashscore TVI Broadcasters feed & map to catalog
            try {
                const fsUrl = `https://1.newsoccers.one/2/x/feed/df_dos_1_${cleanId}_`;
                const fsResp = await fetch(fsUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
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

                        for (const b of broadcasters) {
                            if (!b || !b.BN) continue;
                            const bName = b.BN;
                            const catMatch = findCatalogStream(bName);

                            if (catMatch) {
                                if (!seenUrls.has(catMatch.url) && customUrls.length < 8) {
                                    seenUrls.add(catMatch.url);
                                    customUrls.push({
                                        id: `srv-${customUrls.length + 1}`,
                                        name: `Server ${customUrls.length + 1}: ${catMatch.name}`,
                                        url: catMatch.url,
                                        enabled: true
                                    });
                                }

                                if (!seenChannels.has(catMatch.name)) {
                                    seenChannels.add(catMatch.name);
                                    channels.push({
                                        id: `ch-${channels.length + 1}`,
                                        name: catMatch.name,
                                        country: catMatch.country || b.CC || '',
                                        streamUrl: catMatch.url,
                                        source: 'catalog'
                                    });
                                }
                            } else {
                                if (!seenChannels.has(bName)) {
                                    seenChannels.add(bName);
                                    channels.push({
                                        id: `ch-${channels.length + 1}`,
                                        name: bName,
                                        country: b.CC || '',
                                        streamUrl: null,
                                        source: 'flashscore'
                                    });
                                }
                            }
                        }
                    }
                }
            } catch (fsErr) {}

            // E. Fallback: Always ensure at least 4 top sports stream servers
            if (customUrls.length < 4 && staticCatalog.length > 0) {
                const topSports = [
                    'Premier Sports 1 IE',
                    'CANAL+ Sport 6 PL',
                    'DAZN 1 Germany',
                    'ARENA SPORT 1 BiH',
                    'beIN Sports',
                    'Sky Sports Premier League',
                    'TNT'
                ];
                for (const targetName of topSports) {
                    const match = findCatalogStream(targetName);
                    if (match && !seenUrls.has(match.url)) {
                        seenUrls.add(match.url);
                        customUrls.push({
                            id: `srv-${customUrls.length + 1}`,
                            name: `Server ${customUrls.length + 1}: ${match.name}`,
                            url: match.url,
                            enabled: true
                        });
                        if (customUrls.length >= 6) break;
                    }
                }
            }

            return new Response(JSON.stringify({
                match_id: fsId,
                teams: { home: homeName, away: awayName },
                custom_urls: customUrls,
                channels: channels
            }), { status: 200, headers: corsHeaders });
        }

        // ----------------------------------------------------
        // 2. CURATED DAILY MATCH LIST: /api/v1/:sport/:date
        // ----------------------------------------------------
        if (parts.length >= 2) {
            const [sport, date] = parts;

            // Try Dzeko daily sport API for curated high-profile matches
            try {
                const dzekoUrl = `https://dzeko11.pk/api/v1/${encodeURIComponent(sport)}/${encodeURIComponent(date)}`;
                const dzekoResp = await fetch(dzekoUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
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
            return new Response(JSON.stringify({ items: staticCatalog }), {
                status: 200,
                headers: corsHeaders
            });
        }

        return new Response(JSON.stringify({ error: 'Route not found' }), { status: 404, headers: corsHeaders });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
}
