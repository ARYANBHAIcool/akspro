/**
 * AryanStreams Global Sports Scraper & Aggregator
 * Compiles sports events and live streams from:
 * - SonyLiv Events API
 * - FanCode Live Events API
 * - Tapmad Sports API
 * - Sonu Football & Cricket Networks
 * - Trendy48 Sports Matches
 * - Primary Mirror (sm-monirulislam when active)
 *
 * Saves normalized output to data/Sports_data.json
 */

const fs = require('fs');
const path = require('path');

function sanitizeStreamUrl(url) {
  if (!url || typeof url !== 'string') return url;
  if (url.includes('.live.fly.ww.aiv-cdn.net')) {
    return url.replace('.live.fly.ww.aiv-cdn.net', '.cache.aiv-cdn.net');
  }
  return url;
}

function parseKidKey(api) {
  if (!api || typeof api !== 'string') return { kid: '', key: '' };
  const parts = api.split(':');
  if (parts.length === 2) {
    return { kid: parts[0].trim(), key: parts[1].trim() };
  }
  return { kid: '', key: '' };
}

async function fetchWithTimeout(url, timeoutMs = 7000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeMatchKey(title, teamA, teamB) {
  if (teamA && teamB) {
    const a = teamA.trim().toLowerCase();
    const b = teamB.trim().toLowerCase();
    return [a, b].sort().join(' vs ');
  }
  const clean = (title || '')
    .toLowerCase()
    .replace(/\s+-\s+\d{1,2}\s+[a-z]{3}\s+\d{4}.*$/i, '')
    .replace(/\[[a-z]{2,4}\]/gi, '')
    .replace(/\(.*?\)/g, '')
    .trim();
  const parts = clean.split(/\s+(?:vs|v)\s+/i);
  if (parts.length >= 2) {
    return [parts[0].trim(), parts[1].trim()].sort().join(' vs ');
  }
  return clean;
}

async function runScraper() {
  console.log('[AryanStreams Scraper] Fetching all upstream sources in parallel...');

  const [
    primaryFeed,
    sonyData,
    fancodeData,
    tapmadData,
    sonuFb,
    sonuCric,
    trendyData
  ] = await Promise.all([
    fetchWithTimeout('https://raw.githubusercontent.com/sm-monirulislam/Upcoming-and-Live-Sports-Data/main/Sports_data.json', 8000),
    fetchWithTimeout('https://raw.githubusercontent.com/sm-monirulislam/SonyLiv_Event_Playlist/main/sonyLiv_data.json', 8000),
    fetchWithTimeout('https://raw.githubusercontent.com/drmlive/fancode-live-events/main/fancode.json', 8000),
    fetchWithTimeout('https://raw.githubusercontent.com/sm-monirulislam/Tapmad_Auto_Update_Playlist/main/tapmad_data.json', 8000),
    fetchWithTimeout('https://sonujson-v6.pages.dev/Data/events/football.json', 8000),
    fetchWithTimeout('https://sonujson-v6.pages.dev/Data/events/cricket.json', 8000),
    fetchWithTimeout('https://trendy48.online/api/matches/all-today', 8000)
  ]);

  const matchesMap = new Map();

  function getOrCreateMatch(key, baseMatch) {
    if (!matchesMap.has(key)) {
      matchesMap.set(key, {
        event_name: baseMatch.event_name,
        Category: baseMatch.Category || 'Other',
        status: baseMatch.status || 'upcoming',
        start_time: baseMatch.start_time || '',
        eventInfo: {
          eventName: baseMatch.eventInfo?.eventName || baseMatch.event_name,
          teamA: baseMatch.eventInfo?.teamA || '',
          teamB: baseMatch.eventInfo?.teamB || '',
          teamAFlag: baseMatch.eventInfo?.teamAFlag || '',
          teamBFlag: baseMatch.eventInfo?.teamBFlag || '',
          logo: baseMatch.eventInfo?.logo || ''
        },
        streams: []
      });
    }
    const match = matchesMap.get(key);
    // Upgrade status to live if any source reports it live
    if (String(baseMatch.status).toLowerCase() === 'live') {
      match.status = 'live';
    }
    // Fill missing metadata if available
    if (!match.eventInfo.teamA && baseMatch.eventInfo?.teamA) match.eventInfo.teamA = baseMatch.eventInfo.teamA;
    if (!match.eventInfo.teamB && baseMatch.eventInfo?.teamB) match.eventInfo.teamB = baseMatch.eventInfo.teamB;
    if (!match.eventInfo.teamAFlag && baseMatch.eventInfo?.teamAFlag) match.eventInfo.teamAFlag = baseMatch.eventInfo.teamAFlag;
    if (!match.eventInfo.teamBFlag && baseMatch.eventInfo?.teamBFlag) match.eventInfo.teamBFlag = baseMatch.eventInfo.teamBFlag;
    if (!match.eventInfo.logo && baseMatch.eventInfo?.logo) match.eventInfo.logo = baseMatch.eventInfo.logo;
    return match;
  }

  function addStream(match, streamObj) {
    if (!streamObj || !streamObj.stream_url) return;
    const url = sanitizeStreamUrl(streamObj.stream_url);
    if (!url) return;
    if (match.streams.some(s => s.stream_url === url)) return;
    match.streams.push({
      channel_name: streamObj.channel_name || `Server ${match.streams.length + 1}`,
      stream_url: url,
      kid: streamObj.kid || '',
      key: streamObj.key || ''
    });
  }

  // 1. Process Primary Feed (sm-monirulislam) if available
  if (primaryFeed && Array.isArray(primaryFeed.matches) && primaryFeed.matches.length > 0) {
    console.log(`[Primary Feed] Ingesting ${primaryFeed.matches.length} matches...`);
    for (const m of primaryFeed.matches) {
      if (!m || !m.event_name) continue;
      const tA = m.eventInfo?.teamA || '';
      const tB = m.eventInfo?.teamB || '';
      const key = normalizeMatchKey(m.event_name, tA, tB);
      const match = getOrCreateMatch(key, m);
      if (Array.isArray(m.streams)) {
        for (const s of m.streams) addStream(match, s);
      }
    }
  }

  // 2. Process SonyLiv Events
  if (sonyData && Array.isArray(sonyData.matches)) {
    console.log(`[SonyLiv] Ingesting ${sonyData.matches.length} events...`);
    for (const ev of sonyData.matches) {
      if (!ev || !ev.match_name) continue;
      const cleanTitle = ev.match_name.replace(/\s+-\s+\d{1,2}\s+[a-z]{3}\s+\d{4}.*$/i, '').trim();
      const parts = cleanTitle.split(/\s+(?:vs|v)\s+/i);
      const tA = parts[0]?.trim() || '';
      const tB = parts[1]?.trim() || '';
      const key = normalizeMatchKey(cleanTitle, tA, tB);

      const match = getOrCreateMatch(key, {
        event_name: cleanTitle,
        Category: ev.event_category || 'Cricket',
        status: String(ev.status).toLowerCase() === 'live' ? 'live' : 'upcoming',
        eventInfo: {
          eventName: ev.event_name || cleanTitle,
          teamA: tA,
          teamB: tB,
          logo: ev.src || ''
        }
      });

      if (ev.stream_link) {
        addStream(match, {
          channel_name: `${ev.broadcast_channel || 'SonyLiv'} (${ev.audioLanguageName || 'HD'})`,
          stream_url: ev.stream_link
        });
      }
    }
  }

  // 3. Process FanCode Events
  if (fancodeData && Array.isArray(fancodeData.matches)) {
    console.log(`[FanCode] Ingesting ${fancodeData.matches.length} events...`);
    for (const ev of fancodeData.matches) {
      if (!ev || !ev.match_name) continue;
      const key = normalizeMatchKey(ev.match_name, ev.team_1, ev.team_2);
      const isLive = String(ev.status).toUpperCase() === 'LIVE';

      getOrCreateMatch(key, {
        event_name: ev.match_name,
        Category: ev.event_category || 'Cricket',
        status: isLive ? 'live' : 'upcoming',
        start_time: ev.startTime || '',
        eventInfo: {
          eventName: ev.event_name || ev.title || ev.match_name,
          teamA: ev.team_1 || '',
          teamB: ev.team_2 || '',
          logo: ev.src || ''
        }
      });
    }
  }

  // 4. Process Tapmad Events
  if (tapmadData && Array.isArray(tapmadData.matches)) {
    console.log(`[Tapmad] Ingesting ${tapmadData.matches.length} events...`);
    for (const ev of tapmadData.matches) {
      if (!ev || !ev.title) continue;
      const parts = ev.title.split(/\s+(?:vs|v)\s+/i);
      const tA = parts[0]?.trim() || '';
      const tB = parts[1]?.trim() || '';
      const key = normalizeMatchKey(ev.title, tA, tB);
      const isLive = String(ev.status).toUpperCase() === 'LIVE';

      const match = getOrCreateMatch(key, {
        event_name: ev.title,
        Category: 'Football',
        status: isLive ? 'live' : 'upcoming',
        start_time: ev.start_time_bd || '',
        eventInfo: {
          eventName: ev.header_name || ev.title,
          teamA: tA,
          teamB: tB,
          logo: ev.thumbnail || ev.tv_image || ''
        }
      });

      if (ev.stream_url) {
        addStream(match, {
          channel_name: 'Tapmad HD',
          stream_url: ev.stream_url
        });
      }
    }
  }

  // 5. Process Sonu Cricket & Football
  const processSonu = (obj, cat) => {
    if (!obj || !Array.isArray(obj.events)) return;
    console.log(`[Sonu ${cat}] Ingesting ${obj.events.length} events...`);
    for (const ev of obj.events) {
      if (!ev || !ev.title) continue;
      const eventObj = ev.event || {};
      const key = normalizeMatchKey(ev.title, eventObj.teamA, eventObj.teamB);
      const isLive = ev.status === 'live' || (eventObj.startTimeIST && new Date(eventObj.startTimeIST.replace(' IST', '')) <= new Date());

      const match = getOrCreateMatch(key, {
        event_name: ev.title,
        Category: ev.cat || eventObj.category || cat,
        status: isLive ? 'live' : 'upcoming',
        start_time: eventObj.startTimeIST || '',
        eventInfo: {
          eventName: ev.title,
          teamA: eventObj.teamA || '',
          teamB: eventObj.teamB || '',
          teamAFlag: eventObj.teamAFlag || '',
          teamBFlag: eventObj.teamBFlag || '',
          logo: eventObj.logo || ''
        }
      });

      if (Array.isArray(ev.streams)) {
        for (const s of ev.streams) {
          const { kid, key: decKey } = parseKidKey(s.api);
          addStream(match, {
            channel_name: s.title || `Server ${match.streams.length + 1}`,
            stream_url: s.link || s.url,
            kid: kid || s.kid || '',
            key: decKey || s.key || ''
          });
        }
      }
    }
  };

  processSonu(sonuCric, 'Cricket');
  processSonu(sonuFb, 'Football');

  // 6. Process Trendy48
  if (Array.isArray(trendyData)) {
    console.log(`[Trendy48] Ingesting ${trendyData.length} matches...`);
    for (const m of trendyData) {
      if (!m || !m.title) continue;
      const parts = m.title.split(/\s+(?:vs|v)\s+/i);
      const key = normalizeMatchKey(m.title, parts[0], parts[1]);
      const isLive = m.date && m.date <= Date.now();

      const match = getOrCreateMatch(key, {
        event_name: m.title,
        Category: m.category ? (m.category.charAt(0).toUpperCase() + m.category.slice(1)) : 'Football',
        status: isLive ? 'live' : 'upcoming',
        start_time: m.date ? new Date(m.date).toISOString() : '',
        eventInfo: {
          eventName: m.title,
          teamA: parts[0] || '',
          teamB: parts[1] || ''
        }
      });

      if (Array.isArray(m.sources)) {
        for (const s of m.sources) {
          addStream(match, {
            channel_name: s.source ? `${s.source.toUpperCase()}` : 'Server',
            stream_url: s.url || (s.id ? `https://trendy48.site/embed/${s.id}` : m.watch_url)
          });
        }
      } else if (m.watch_url) {
        addStream(match, { channel_name: 'Trendy HD', stream_url: m.watch_url });
      }
    }
  }

  const allMatches = Array.from(matchesMap.values());
  const liveCount = allMatches.filter(m => m.status === 'live' || m.status === 'LIVE').length;
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US') + ' ' + now.toLocaleDateString('en-GB');

  const finalPayload = {
    name: "AryanStreams Master Sports Feed",
    owner: "AryanStreams Global",
    last_update_time: timeStr,
    total_matches: allMatches.length,
    live_match: liveCount,
    matches: allMatches
  };

  // Ensure data directory exists
  const outDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, 'Sports_data.json');
  fs.writeFileSync(outPath, JSON.stringify(finalPayload, null, 2), 'utf8');

  console.log(`[AryanStreams Scraper] Successfully compiled ${allMatches.length} matches (${liveCount} live) to ${outPath}`);
  return finalPayload;
}

if (require.main === module) {
  runScraper().catch(err => {
    console.error('[AryanStreams Scraper Error]:', err);
    process.exit(1);
  });
}

module.exports = { runScraper };
