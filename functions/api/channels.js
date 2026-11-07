/**
 * Cloudflare Pages Function: /api/channels
 * Returns the latest 34+ live sports channels (Peacock, Sky Sports, TNT, NBC, Fubo, FanCode, etc.)
 * with their DASH stream URLs and ClearKey DRM keys.
 */

const CHANNEL_WORKER_URL = "https://still-king-1d1a.himanshuvalverde.workers.dev/";

export const CHANNEL_METADATA = {
  PC1: { name: 'Peacock TV 1 HD', category: 'Football', icon: '⚽' },
  PC2: { name: 'Peacock TV 2 HD', category: 'Football', icon: '⚽' },
  PC3: { name: 'Peacock TV 3 HD', category: 'Football', icon: '⚽' },
  SKYPL: { name: 'Sky Sports Premier League', category: 'Football', icon: '⚽' },
  SKY8: { name: 'Sky Sports 8 HD', category: 'Football', icon: '⚽' },
  SKYF1: { name: 'Sky Sports F1 HD', category: 'Motorsports', icon: '🏎️' },
  SKYTE: { name: 'Sky Sports Tennis', category: 'Tennis', icon: '🎾' },
  Tnt1: { name: 'TNT Sports 1 FHD', category: 'Football', icon: '⚽' },
  Tnt2: { name: 'TNT Sports 2 FHD', category: 'Football', icon: '⚽' },
  Tnt3: { name: 'TNT Sports 3 FHD', category: 'Football', icon: '⚽' },
  Tnt4: { name: 'TNT Sports 4 FHD', category: 'Football', icon: '⚽' },
  NBC: { name: 'NBC Sports USA', category: 'Football', icon: '⚽' },
  FC1: { name: 'FanCode 1 FHD', category: 'Cricket', icon: '🏏' },
  FC2: { name: 'FanCode 2 FHD', category: 'Cricket', icon: '🏏' },
  FUBO1: { name: 'Fubo Sports 1 FHD', category: 'Football', icon: '⚽' },
  FUBO2: { name: 'Fubo Sports 2 FHD', category: 'Football', icon: '⚽' },
  FUBO3: { name: 'Fubo Sports 3 CA', category: 'Football', icon: '⚽' },
  BEIN1: { name: 'beIN Sports 1 HD', category: 'Football', icon: '⚽' },
  BEIN3: { name: 'beIN Sports 3 HD', category: 'Football', icon: '⚽' },
  CBS: { name: 'CBS Sports Golazo', category: 'Football', icon: '⚽' },
  DS: { name: 'DAZN SuperSport HD', category: 'Football', icon: '⚽' },
  FOXD: { name: 'Fox Deportes USA', category: 'Football', icon: '⚽' },
  F1TV: { name: 'Formula 1 TV Pro', category: 'Motorsports', icon: '🏎️' },
  SPORTV: { name: 'SporTV 1 HD', category: 'Football', icon: '⚽' },
  SPORTV3: { name: 'SporTV 3 HD', category: 'Football', icon: '⚽' },
  SPORTDIGI: { name: 'Sportklub / DigiSport', category: 'Football', icon: '⚽' },
  SPORT1: { name: 'Sport 1 HD', category: 'Football', icon: '⚽' },
  PM1: { name: 'Prime Video Sports 1', category: 'Football', icon: '⚽' },
  PM2: { name: 'Prime Video Sports 2', category: 'Football', icon: '⚽' },
  ATV: { name: 'Apple TV / Arena Sport', category: 'Football', icon: '⚽' },
  CAZETV: { name: 'CazeTV HD', category: 'Football', icon: '⚽' },
  Tsn5: { name: 'TSN 5 Canada', category: 'Football', icon: '⚽' },
  LPL: { name: 'Lanka Premier League', category: 'Cricket', icon: '🏏' },
  tapmad: { name: 'Tapmad Sports HD', category: 'Cricket', icon: '🏏' }
};

export async function fetchUpstreamChannels() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Origin': 'https://footyfeedreal.pages.dev',
    'Referer': 'https://footyfeedreal.pages.dev/',
    'Sec-Fetch-Site': 'cross-site',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty'
  };

  const res = await fetch(CHANNEL_WORKER_URL, {
    headers,
    cf: {
      cacheTtl: 60,
      cacheEverything: true
    }
  });

  if (!res.ok) throw new Error(`Upstream returned ${res.status}`);
  return await res.json();
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

  const url = new URL(context.request.url);
  const targetId = (url.searchParams.get('id') || url.searchParams.get('channel') || '').trim();

  try {
    const rawChannels = await fetchUpstreamChannels();

    if (targetId) {
      const ch = rawChannels[targetId];
      if (!ch) {
        return new Response(JSON.stringify({ error: `Channel '${targetId}' not found` }), {
          status: 404,
          headers: corsHeaders
        });
      }

      const meta = CHANNEL_METADATA[targetId] || { name: targetId, category: 'Sports', icon: '📺' };
      const keys = ch.keys || {};
      const firstKid = Object.keys(keys)[0] || '';
      const firstKey = keys[firstKid] || '';

      return new Response(JSON.stringify({
        id: targetId,
        name: meta.name,
        category: meta.category,
        url: ch.url,
        kid: firstKid,
        key: firstKey,
        keys: ch.keys
      }), {
        headers: {
          ...corsHeaders,
          'Cache-Control': 'public, max-age=60'
        }
      });
    }

    // Format all channels with metadata
    const formatted = {};
    for (const [id, data] of Object.entries(rawChannels)) {
      const meta = CHANNEL_METADATA[id] || { name: id, category: 'Sports', icon: '📺' };
      const keys = data.keys || {};
      const firstKid = Object.keys(keys)[0] || '';
      const firstKey = keys[firstKid] || '';

      formatted[id] = {
        id,
        name: meta.name,
        category: meta.category,
        icon: meta.icon,
        poster: `/assets/channels/${id.toLowerCase()}.png`,
        url: data.url,
        kid: firstKid,
        key: firstKey,
        keys: data.keys
      };
    }

    const items = Object.values(formatted);

    return new Response(JSON.stringify({
      count: items.length,
      items: items,
      channels: formatted
    }), {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=120'
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({
      error: "Failed to fetch live parent channels",
      message: err.message
    }), {
      status: 502,
      headers: corsHeaders
    });
  }
}
