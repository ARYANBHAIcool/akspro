/**
 * Cloudflare Pages Function: /api/sports
 * Proxies, aggregates, and enriches real-time sports JSON feed with live verified parent streams:
 * - Multi-mirror upstream failover (GitHub Raw + JSDelivr CDN)
 * - Automatic injection of live Peacock TV, Sky Sports PL, Sky Sports 8, TNT, NBC, FanCode channels
 * - Edge caching via Cloudflare Cache API
 */

const UPSTREAM_MIRRORS = [
    "https://raw.githubusercontent.com/sm-monirulislam/Upcoming-and-Live-Sports-Data/main/Sports_data.json",
    "https://cdn.jsdelivr.net/gh/sm-monirulislam/Upcoming-and-Live-Sports-Data@main/Sports_data.json"
];

const PARENT_WORKER_URL = "https://still-king-1d1a.himanshuvalverde.workers.dev/";

const CHANNEL_METADATA = {
    PC1: { name: 'Peacock TV 1 HD', category: 'Football' },
    PC2: { name: 'Peacock TV 2 HD', category: 'Football' },
    PC3: { name: 'Peacock TV 3 HD', category: 'Football' },
    SKYPL: { name: 'Sky Sports Premier League', category: 'Football' },
    SKY8: { name: 'Sky Sports 8 HD', category: 'Football' },
    SKYF1: { name: 'Sky Sports F1 HD', category: 'Motorsports' },
    SKYTE: { name: 'Sky Sports Tennis', category: 'Tennis' },
    Tnt1: { name: 'TNT Sports 1 FHD', category: 'Football' },
    Tnt2: { name: 'TNT Sports 2 FHD', category: 'Football' },
    Tnt3: { name: 'TNT Sports 3 FHD', category: 'Football' },
    Tnt4: { name: 'TNT Sports 4 FHD', category: 'Football' },
    NBC: { name: 'NBC Sports USA', category: 'Football' },
    FC1: { name: 'FanCode 1 FHD', category: 'Cricket' },
    FC2: { name: 'FanCode 2 FHD', category: 'Cricket' },
    FUBO1: { name: 'Fubo Sports 1 FHD', category: 'Football' },
    FUBO2: { name: 'Fubo Sports 2 FHD', category: 'Football' },
    FUBO3: { name: 'Fubo Sports 3 CA', category: 'Football' },
    BEIN1: { name: 'beIN Sports 1 HD', category: 'Football' },
    BEIN3: { name: 'beIN Sports 3 HD', category: 'Football' },
    CBS: { name: 'CBS Sports Golazo', category: 'Football' },
    DS: { name: 'DAZN SuperSport HD', category: 'Football' },
    FOXD: { name: 'Fox Deportes USA', category: 'Football' },
    F1TV: { name: 'Formula 1 TV Pro', category: 'Motorsports' },
    SPORTV: { name: 'SporTV 1 HD', category: 'Football' },
    SPORTV3: { name: 'SporTV 3 HD', category: 'Football' },
    SPORTDIGI: { name: 'Sportklub / DigiSport', category: 'Football' },
    SPORT1: { name: 'Sport 1 HD', category: 'Football' },
    PM1: { name: 'Prime Video Sports 1', category: 'Football' },
    PM2: { name: 'Prime Video Sports 2', category: 'Football' },
    ATV: { name: 'Apple TV / Arena Sport', category: 'Football' },
    CAZETV: { name: 'CazeTV HD', category: 'Football' },
    Tsn5: { name: 'TSN 5 Canada', category: 'Football' },
    LPL: { name: 'Lanka Premier League', category: 'Cricket' },
    tapmad: { name: 'Tapmad Sports HD', category: 'Cricket' }
};

async function fetchParentChannels() {
    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Origin': 'https://footyfeedreal.pages.dev',
            'Referer': 'https://footyfeedreal.pages.dev/',
            'Sec-Fetch-Site': 'cross-site',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Dest': 'empty'
        };

        const res = await fetch(PARENT_WORKER_URL, {
            headers,
            cf: { cacheTtl: 60, cacheEverything: true }
        });

        if (res.ok) {
            return await res.json();
        }
    } catch (_) {}
    return null;
}

function channelToStream(id, ch) {
    if (!ch || !ch.url) return null;
    const keys = ch.keys || {};
    const firstKid = Object.keys(keys)[0] || '';
    const firstKey = keys[firstKid] || '';
    const meta = CHANNEL_METADATA[id] || {};
    return {
        channel_name: meta.name || id,
        stream_url: ch.url,
        kid: firstKid,
        key: firstKey,
        source_id: id,
        is_parent_source: true
    };
}

function enrichLiveMatches(matches, channels) {
    if (!Array.isArray(matches) || !channels) return matches;

    const eplKeywords = [
        'leeds', 'tottenham', 'manchester', 'arsenal', 'chelsea', 'liverpool',
        'aston villa', 'newcastle', 'everton', 'premier league', 'epl', 'wolves',
        'wolverhampton', 'crystal palace', 'fulham', 'brighton', 'brentford',
        'nottingham', 'bournemouth', 'southampton', 'leicester', 'ipswich'
    ];

    const uefaKeywords = ['champions league', 'europa league', 'uefa', 'conference league'];
    const f1Keywords = ['formula 1', 'f1', 'motogp', 'motorsport'];

    return matches.map(match => {
        if (!match) return match;
        const status = String(match.status || '').toUpperCase().trim();
        const live = status === 'LIVE';

        // Only enrich active live matches (or matches starting now)
        if (!live) return match;

        const name = String(match.event_name || match.eventInfo?.eventName || '').toLowerCase();
        const cat = String(match.Category || '').toLowerCase();
        const streams = Array.isArray(match.streams) ? [...match.streams] : [];

        const toAdd = [];

        // 1. Premier League / English Football -> Peacock 2, Sky Sports PL, Sky Sports 8, Peacock 3, NBC, TNT 1
        if (cat === 'football' && eplKeywords.some(kw => name.includes(kw))) {
            toAdd.push('PC2', 'SKYPL', 'SKY8', 'PC3', 'NBC', 'Tnt1');
        }
        // 2. UEFA / European Football -> TNT 1, TNT 2, CBS Sports
        else if (cat === 'football' && uefaKeywords.some(kw => name.includes(kw))) {
            toAdd.push('Tnt1', 'Tnt2', 'CBS', 'DS');
        }
        // 3. Formula 1 / Motorsports -> Sky F1, F1TV
        else if (cat === 'motorsports' || f1Keywords.some(kw => name.includes(kw))) {
            toAdd.push('SKYF1', 'F1TV');
        }
        // 4. Cricket -> FanCode 1, FanCode 2, Tapmad
        else if (cat === 'cricket') {
            toAdd.push('FC1', 'FC2', 'tapmad');
        }
        // 5. Other general live football matches
        else if (cat === 'football') {
            toAdd.push('DS', 'BEIN1', 'BEIN3', 'FUBO3');
        }

        // Add streams ensuring no duplicate URLs or names
        for (const chId of toAdd) {
            const ch = channels[chId];
            if (ch) {
                const streamObj = channelToStream(chId, ch);
                if (streamObj && !streams.some(s => s.stream_url === streamObj.stream_url || s.channel_name === streamObj.channel_name)) {
                    streams.push(streamObj);
                }
            }
        }

        return {
            ...match,
            streams
        };
    });
}

export async function onRequest(context) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json; charset=utf-8'
    };

    if (context.request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const cache = caches.default;
        const cacheKey = new Request("https://aryanstreamspro.internal/cache/sports_data_v4.json");
        let cachedResponse = await cache.match(cacheKey);

        if (cachedResponse) {
            const resHeaders = new Headers(cachedResponse.headers);
            resHeaders.set('Access-Control-Allow-Origin', '*');
            resHeaders.set('X-Cache-Status', 'HIT');
            return new Response(cachedResponse.body, {
                status: cachedResponse.status,
                headers: resHeaders
            });
        }

        // Parallel fetch of matches feed and parent channel registry
        const [upstreamRes, channelsData] = await Promise.all([
            (async () => {
                for (const mirror of UPSTREAM_MIRRORS) {
                    try {
                        const r = await fetch(mirror, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                                'Accept': 'application/json'
                            },
                            cf: { cacheTtl: 45, cacheEverything: true }
                        });
                        if (r.ok) {
                            const txt = await r.text();
                            if (txt && txt.length > 500 && txt.includes('"matches"')) {
                                return JSON.parse(txt);
                            }
                        }
                    } catch (_) {}
                }
                return null;
            })(),
            fetchParentChannels()
        ]);

        if (!upstreamRes || !Array.isArray(upstreamRes.matches)) {
            throw new Error("Unable to fetch master sports feed from upstream mirrors");
        }

        // Automatically enrich live matches with verified Peacock and Sky Sports sources
        const enrichedMatches = enrichLiveMatches(upstreamRes.matches, channelsData);

        const responsePayload = {
            ...upstreamRes,
            matches: enrichedMatches,
            parent_channels_connected: !!channelsData,
            channels_count: channelsData ? Object.keys(channelsData).length : 0
        };

        const responseHeaders = {
            ...corsHeaders,
            'Cache-Control': 'public, max-age=45, stale-while-revalidate=90',
            'X-Cache-Status': 'MISS'
        };

        const edgeResponse = new Response(JSON.stringify(responsePayload), {
            status: 200,
            headers: responseHeaders
        });

        context.waitUntil(cache.put(cacheKey, edgeResponse.clone()));
        return edgeResponse;

    } catch (err) {
        return new Response(JSON.stringify({
            error: "Failed to fetch live sports data",
            message: err.message,
            fallback_urls: UPSTREAM_MIRRORS
        }), {
            status: 502,
            headers: corsHeaders
        });
    }
}
