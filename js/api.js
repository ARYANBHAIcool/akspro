/**
 * AryanStreams Global - Automated Live Sports & Stream Aggregation Engine
 * Real-time integration with:
 * 1. Futbol-X Public API (https://www.futbol-x.xyz/api)
 * 2. DamiTV & PPV Services (https://damitv.st/papi & https://ppv.st)
 * 3. 24/7 Live TV Channels Catalog (DaddyHD & TimStreams)
 */

(function () {
    'use strict';

    const FUTBOLX_API_BASE = 'https://www.futbol-x.xyz/api';
    const isBrowser = typeof window !== 'undefined' && typeof window.location !== 'undefined';
    const hostname = isBrowser ? (window.location.hostname || '') : '';
    const DAMITV_API_BASE = hostname.includes('pages.dev') || hostname === 'localhost' || hostname === '127.0.0.1'
        ? '/api/damitv'
        : 'https://damitv.st';

    const SPORT_MAPPINGS = {
        'football': 'FOOTBALL',
        'soccer': 'FOOTBALL',
        'laliga': 'FOOTBALL',
        'premier-league': 'FOOTBALL',
        'basketball': 'BASKETBALL',
        'nba': 'BASKETBALL',
        'americanfootball': 'AMERICAN FOOTBALL',
        'american-football': 'AMERICAN FOOTBALL',
        'nfl': 'AMERICAN FOOTBALL',
        'cfb': 'AMERICAN FOOTBALL',
        'baseball': 'BASEBALL',
        'mlb': 'BASEBALL',
        'fights': 'FIGHTING',
        'fight': 'FIGHTING',
        'mma': 'FIGHTING',
        'ufc': 'FIGHTING',
        'boxing': 'FIGHTING',
        'motorsports': 'MOTORSPORTS',
        'motor-sports': 'MOTORSPORTS',
        'f1': 'MOTORSPORTS',
        'tennis': 'TENNIS',
        'cricket': 'CRICKET',
        'darts': 'DARTS',
        'wrestling': 'WRESTLING',
        'nhl': 'HOCKEY',
        'icehockey': 'HOCKEY',
        'hockey': 'HOCKEY',
        'rugby': 'RUGBY',
        'golf': 'GOLF',
        '24/7-streams': '24/7 STREAMS',
        'others': 'OTHERS'
    };

    const DEFAULT_POSTERS = {
        'FOOTBALL': 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&auto=format&fit=crop&q=60',
        'BASKETBALL': 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&auto=format&fit=crop&q=60',
        'AMERICAN FOOTBALL': 'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=800&auto=format&fit=crop&q=60',
        'BASEBALL': 'https://images.unsplash.com/photo-1508344928928-7165b67de128?w=800&auto=format&fit=crop&q=60',
        'FIGHTING': 'https://images.unsplash.com/photo-1517438322307-e67111335449?w=800&auto=format&fit=crop&q=60',
        'MOTORSPORTS': 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&auto=format&fit=crop&q=60',
        'TENNIS': 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=800&auto=format&fit=crop&q=60',
        'CRICKET': 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&auto=format&fit=crop&q=60',
        'DEFAULT': 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&auto=format&fit=crop&q=60'
    };

    window.AryanGlobalAPI = {
        isLoading: true,
        matches: [],
        channels: [],
        listeners: [],
        refreshInterval: null,

        providers: [
            { name: "Paramount+", logo: "https://m.media-amazon.com/images/G/01/digital/video/Linear_Clean_Slate/ParamountPlus_White_1920x1080._SL500_FMpng_.png", bg: "bg-blue-600" },
            { name: "Peacock", logo: "https://m.media-amazon.com/images/G/01/digital/video/Linear_Clean_Slate/Peacock_White_1920x1080._SL500_FMpng_.png", bg: "bg-zinc-800" },
            { name: "Sky Go", logo: "https://raw.githubusercontent.com/tv-logo/tv-logos/refs/heads/main/countries/united-kingdom/sky-sports-main-event-uk.png", bg: "bg-white" },
            { name: "Sling TV", logo: "https://m.media-amazon.com/images/G/01/digital/video/Linear_Clean_Slate/Sling_White_1920x1080._SL500_FMpng_.png", bg: "bg-sky-600" }
        ],

        async init() {
            this.isLoading = true;
            this.emitUpdate();

            await Promise.allSettled([
                this.loadFutbolXFeeds(),
                this.loadDamiTVFeeds(),
                this.loadChannelsCatalog()
            ]);

            this.isLoading = false;
            this.sortMatches();
            this.emitUpdate();

            // Auto-refresh match feeds & statuses every 60 seconds
            if (!this.refreshInterval) {
                this.refreshInterval = setInterval(async () => {
                    await Promise.allSettled([
                        this.loadFutbolXFeeds(),
                        this.loadDamiTVFeeds()
                    ]);
                    this.updateLiveStatuses();
                    this.emitUpdate();
                }, 60000);
            }
        },

        onUpdate(callback) {
            if (typeof callback === 'function') {
                this.listeners.push(callback);
            }
        },

        emitUpdate() {
            for (const cb of this.listeners) {
                try { cb(); } catch (e) { console.error('Listener error:', e); }
            }
        },

        /**
         * Fetch all categories and matches from Futbol-X API
         */
        async loadFutbolXFeeds() {
            try {
                const streamMeta = await fetch(`${FUTBOLX_API_BASE}/stream`, { signal: AbortSignal.timeout(6000) })
                    .then(r => r.ok ? r.json() : null)
                    .catch(() => null);

                const categories = streamMeta && Array.isArray(streamMeta.categories)
                    ? streamMeta.categories
                    : ['football', 'tennis', 'basketball', 'fights', 'motorsports', 'americanfootball', 'nhl', 'baseball', 'rugby', 'golf', 'others', 'wrestling', 'darts'];

                const categoryPromises = categories.map(async (cat) => {
                    try {
                        const res = await fetch(`${FUTBOLX_API_BASE}/${cat}.json`, { signal: AbortSignal.timeout(6000) });
                        if (!res.ok) return [];
                        const data = await res.json();
                        if (!data || !data.success || !Array.isArray(data.streams)) return [];

                        const events = [];
                        data.streams.forEach(item => {
                            if (item && typeof item === 'object' && Array.isArray(item.streams)) {
                                item.streams.forEach(subItem => {
                                    events.push(this.normalizeFutbolXMatch(subItem, cat, item.category));
                                });
                            } else if (item && typeof item === 'object') {
                                events.push(this.normalizeFutbolXMatch(item, cat));
                            }
                        });
                        return events;
                    } catch (e) {
                        return [];
                    }
                });

                const results = await Promise.all(categoryPromises);
                const allFutbolXMatches = results.flat().filter(Boolean);

                // Add non-duplicate matches to master catalog
                allFutbolXMatches.forEach(fxMatch => {
                    const existingIndex = this.matches.findIndex(m => m.id === fxMatch.id || (m.title.toLowerCase() === fxMatch.title.toLowerCase() && Math.abs(m.startTime - fxMatch.startTime) < 3600000));
                    if (existingIndex >= 0) {
                        // Merge stream servers into existing match
                        const existing = this.matches[existingIndex];
                        fxMatch.servers.forEach(srv => {
                            if (!existing.servers.some(s => s.url === srv.url)) {
                                existing.servers.push(srv);
                            }
                        });
                    } else {
                        this.matches.push(fxMatch);
                    }
                });
            } catch (err) {
                console.warn('Futbol-X load failed:', err);
            }
        },

        /**
         * Fetch live and today schedule from DamiTV / PPV.st APIs
         */
        async loadDamiTVFeeds() {
            try {
                // Try today matches and live matches
                const endpoints = [
                    `${DAMITV_API_BASE}/papi/matches/all-today`,
                    `${DAMITV_API_BASE}/papi/matches/live`
                ];

                const fetches = endpoints.map(url =>
                    fetch(url, {
                        signal: AbortSignal.timeout(5000),
                        headers: { 'Accept': 'application/json' }
                    })
                    .then(r => r.ok ? r.json() : [])
                    .catch(() => [])
                );

                const [todayMatches, liveMatches] = await Promise.all(fetches);
                const rawList = [...(Array.isArray(todayMatches) ? todayMatches : []), ...(Array.isArray(liveMatches) ? liveMatches : [])];

                rawList.forEach(raw => {
                    if (!raw || !raw.id || !raw.title) return;
                    const normalized = this.normalizeDamiMatch(raw);
                    const existingIndex = this.matches.findIndex(m => m.id === normalized.id || (m.title.toLowerCase() === normalized.title.toLowerCase() && Math.abs(m.startTime - normalized.startTime) < 3600000));
                    if (existingIndex >= 0) {
                        const existing = this.matches[existingIndex];
                        // Merge any missing servers
                        normalized.servers.forEach(srv => {
                            if (!existing.servers.some(s => s.url === srv.url)) {
                                existing.servers.push(srv);
                            }
                        });
                        // Prefer high-res badge if present
                        if (normalized.teams.team1.logo && !existing.teams.team1.logo) existing.teams.team1.logo = normalized.teams.team1.logo;
                        if (normalized.teams.team2.logo && !existing.teams.team2.logo) existing.teams.team2.logo = normalized.teams.team2.logo;
                    } else {
                        this.matches.push(normalized);
                    }
                });
            } catch (err) {
                console.warn('DamiTV load failed:', err);
            }
        },

        /**
         * Load 24/7 TV channels from DaddyHD and TimStreams
         */
        async loadChannelsCatalog() {
            try {
                const url = `${DAMITV_API_BASE}/data/dlhd-channels.json`;
                const res = await fetch(url, { signal: AbortSignal.timeout(5000) }).catch(() => null);
                if (res && res.ok) {
                    const data = await res.json();
                    if (data && Array.isArray(data.channels)) {
                        this.channels = data.channels.map(ch => ({
                            id: `dlhd-${ch.id}`,
                            channelId: ch.id,
                            name: ch.name,
                            logo: ch.image || `https://wsrv.nl/?url=https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/${ch.country || 'united-states'}/${encodeURIComponent(ch.name.toLowerCase().replace(/\s+/g, '-'))}.png&w=120&h=120&fit=contain&default=https://via.placeholder.com/120?text=TV`,
                            country: (ch.country || 'GLOBAL').toUpperCase(),
                            category: '24/7 STREAMS',
                            servers: [
                                {
                                    name: 'Server 1 [DaddyHD HD]',
                                    url: `https://embedindia.st/embed/channel/${ch.id}`,
                                    type: 'iframe',
                                    hd: true
                                },
                                {
                                    name: 'Server 2 [DLHD Embed]',
                                    url: `https://dlhd.sx/embed/stream-${ch.id}.php`,
                                    type: 'iframe',
                                    hd: true
                                }
                            ]
                        }));
                    }
                }
            } catch (err) {
                console.warn('Channels catalog load failed:', err);
            }

            // Fallback popular sports channels if empty
            if (this.channels.length === 0) {
                this.channels = [
                    {
                        id: "ch-sky-main",
                        name: "Sky Sports Main Event",
                        country: "UK",
                        category: "24/7 STREAMS",
                        logo: "https://raw.githubusercontent.com/tv-logo/tv-logos/refs/heads/main/countries/united-kingdom/sky-sports-main-event-uk.png",
                        servers: [
                            { name: "Server 1 [UK HD]", url: "https://embedindia.st/embed/channel/1", type: "iframe", hd: true },
                            { name: "Server 2 [Alt]", url: "https://embedindia.st/embed/channel/sky-sports-main-event", type: "iframe", hd: true }
                        ]
                    },
                    {
                        id: "ch-tnt-1",
                        name: "TNT Sports 1",
                        country: "UK",
                        category: "24/7 STREAMS",
                        logo: "https://raw.githubusercontent.com/tv-logo/tv-logos/refs/heads/main/countries/united-kingdom/tnt-sports-1-uk.png",
                        servers: [
                            { name: "Server 1 [TNT HD]", url: "https://hotel.fut.ryzn.pro/ucl/index.m3u8", type: "video", hd: true },
                            { name: "Server 2 [Embed]", url: "https://embedindia.st/embed/channel/tnt-sports-1", type: "iframe", hd: true }
                        ]
                    },
                    {
                        id: "ch-espn-us",
                        name: "ESPN USA",
                        country: "US",
                        category: "24/7 STREAMS",
                        logo: "https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-states/espn-us.png",
                        servers: [
                            { name: "Server 1 [ESPN HLS]", url: "https://india.futtv.nx.kg/espn/index.m3u8", type: "video", hd: true },
                            { name: "Server 2 [ESPN 2]", url: "https://india.futtv.nx.kg/espn2/index.m3u8", type: "video", hd: true }
                        ]
                    },
                    {
                        id: "ch-f1-sky",
                        name: "Sky Sports F1",
                        country: "UK",
                        category: "24/7 STREAMS",
                        logo: "https://raw.githubusercontent.com/tv-logo/tv-logos/refs/heads/main/countries/united-kingdom/sky-sports-f1-uk.png",
                        servers: [
                            { name: "Server 1 [Sky F1 En]", url: "https://sweden.futtv.nx.kg/f1-en/index.m3u8", type: "video", hd: true },
                            { name: "Server 2 [Sky F1 It]", url: "https://sweden.futtv.nx.kg/f1-It/index.m3u8", type: "video", hd: true }
                        ]
                    }
                ];
            }
        },

        /**
         * Normalize a match object from Futbol-X API
         */
        normalizeFutbolXMatch(item, rawCat, subCategoryName) {
            const title = item.name || item.title || 'Live Match';
            const uriName = item.uri_name || item.uri || item.slug || item.id || '';
            const tag = item.tag || subCategoryName || rawCat || 'Live';
            const sport = SPORT_MAPPINGS[rawCat.toLowerCase()] || SPORT_MAPPINGS[(item.category || '').toLowerCase()] || 'OTHERS';

            // Parse start timestamp
            let startTime = 0;
            if (item.starts_at) {
                const s = String(item.starts_at);
                startTime = new Date(s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s) ? s : s + '+03:00').getTime();
            }
            if (!startTime || isNaN(startTime)) {
                startTime = Date.now();
            }

            let endTime = startTime + 10800000; // 3 hours default duration
            if (item.ends_at) {
                const e = String(item.ends_at);
                const parsedEnd = new Date(e.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(e) ? e : e + '+03:00').getTime();
                if (!isNaN(parsedEnd)) endTime = parsedEnd;
            }

            const now = Date.now();
            const isAlwaysLive = item.always_live === 1 || item.always_live === '1' || item.always_live === true;
            const isLive = isAlwaysLive || (startTime <= now && now <= endTime);

            // Parse teams
            const teamParts = title.includes(' vs. ') ? title.split(' vs. ') : title.includes(' vs ') ? title.split(' vs ') : title.includes(' @ ') ? title.split(' @ ') : [title, ''];
            const team1Name = (teamParts[0] || title).trim();
            const team2Name = (teamParts[1] || '').trim();

            const poster = item.poster && item.poster.trim() !== ''
                ? item.poster
                : (DEFAULT_POSTERS[sport] || DEFAULT_POSTERS['DEFAULT']);

            // Parse attached stream feeds
            const rawStreams = Array.isArray(item.streams) ? item.streams : [];
            const servers = [];

            rawStreams.forEach((s, idx) => {
                const url = typeof s === 'string' ? s : (s.url || '');
                if (url) {
                    const isM3U8 = url.includes('.m3u8');
                    const serverTitle = (typeof s === 'object' && s.title) ? s.title : `Server ${idx + 1}`;
                    servers.push({
                        name: `${serverTitle} ${isM3U8 ? '[HLS 60FPS]' : '[HD]'}`,
                        url: url,
                        type: isM3U8 ? 'video' : 'iframe',
                        hd: true
                    });
                }
            });

            // If no stream URL was present yet (upcoming game or placeholder), attach primary player servers
            if (servers.length === 0) {
                servers.push({
                    name: `Server 1 [Main Player]`,
                    url: `https://embedindia.st/embed/${rawCat}/${uriName || encodeURIComponent(title)}`,
                    type: 'iframe',
                    hd: true
                });
                servers.push({
                    name: `Server 2 [Direct Web Feed]`,
                    url: `https://www.futbol-x.xyz/live/${uriName}`,
                    type: 'iframe',
                    hd: true
                });
            }

            return {
                id: `fx-${uriName || Math.random().toString(36).substring(2, 9)}`,
                source: 'futbolx',
                title: title,
                sport: sport,
                league: tag.toUpperCase(),
                startTime: startTime,
                endTime: endTime,
                isLive: isLive,
                status: isLive ? 'live' : 'upcoming',
                poster: poster,
                team1: {
                    name: team1Name,
                    logo: `https://wsrv.nl/?url=https://avatar.vercel.sh/${encodeURIComponent(team1Name)}.png&w=96&h=96&fit=contain`
                },
                team2: {
                    name: team2Name || 'Opponent',
                    logo: team2Name ? `https://wsrv.nl/?url=https://avatar.vercel.sh/${encodeURIComponent(team2Name)}.png&w=96&h=96&fit=contain` : ''
                },
                servers: servers,
                sources: servers
            };
        },

        /**
         * Normalize a match object from DamiTV / PPV API
         */
        normalizeDamiMatch(raw) {
            const title = raw.title || 'Live Match';
            const catKey = (raw.category || '').toLowerCase();
            const sport = SPORT_MAPPINGS[catKey] || SPORT_MAPPINGS[raw.league ? raw.league.toLowerCase() : ''] || 'OTHERS';

            const startTime = typeof raw.date === 'number' ? raw.date : (new Date(raw.date).getTime() || Date.now());
            const endTime = startTime + 10800000;
            const now = Date.now();
            const isLive = raw.status === 'live' || (startTime <= now && now <= endTime);

            const team1Name = (raw.teams && raw.teams.home && raw.teams.home.name) || title.split(/ vs\.? | @ /)[0] || title;
            const team2Name = (raw.teams && raw.teams.away && raw.teams.away.name) || title.split(/ vs\.? | @ /)[1] || '';

            const team1Badge = (raw.teams && raw.teams.home && raw.teams.home.badge) || `https://wsrv.nl/?url=https://avatar.vercel.sh/${encodeURIComponent(team1Name)}.png&w=96&h=96&fit=contain`;
            const team2Badge = (raw.teams && raw.teams.away && raw.teams.away.badge) || (team2Name ? `https://wsrv.nl/?url=https://avatar.vercel.sh/${encodeURIComponent(team2Name)}.png&w=96&h=96&fit=contain` : '');

            const poster = raw.poster || DEFAULT_POSTERS[sport] || DEFAULT_POSTERS['DEFAULT'];

            const servers = [];
            if (raw.embedUrl) {
                servers.push({
                    name: 'Server 1 [Main Feed HD]',
                    url: raw.embedUrl,
                    type: 'iframe',
                    hd: true
                });
            }

            // Attached substreams or alternate feeds
            if (Array.isArray(raw.substreams)) {
                raw.substreams.forEach((sub, i) => {
                    if (sub.embedUrl || sub.url) {
                        servers.push({
                            name: `Server ${servers.length + 1} [${sub.language || sub.title || 'Alt ' + (i + 1)}]`,
                            url: sub.embedUrl || sub.url,
                            type: (sub.embedUrl || sub.url).includes('.m3u8') ? 'video' : 'iframe',
                            hd: true
                        });
                    }
                });
            }

            if (servers.length === 0) {
                servers.push({
                    name: 'Server 1 [HD Stream]',
                    url: `https://embedindia.st/embed/${raw.id}`,
                    type: 'iframe',
                    hd: true
                });
            }

            return {
                id: `dami-${raw.id}`,
                source: 'damitv',
                title: title,
                sport: sport,
                league: (raw.league || raw.category || 'Live Sports').toUpperCase(),
                startTime: startTime,
                endTime: endTime,
                isLive: isLive,
                status: isLive ? 'live' : 'upcoming',
                poster: poster,
                team1: { name: team1Name, logo: team1Badge },
                team2: { name: team2Name || 'Opponent', logo: team2Badge },
                servers: servers,
                sources: servers
            };
        },

        sortMatches() {
            this.matches.sort((a, b) => {
                // Live matches always on top
                if (a.isLive && !b.isLive) return -1;
                if (!a.isLive && b.isLive) return 1;
                // Then chronological by start time
                return a.startTime - b.startTime;
            });
        },

        updateLiveStatuses() {
            const now = Date.now();
            this.matches.forEach(m => {
                m.isLive = m.startTime <= now && now <= m.endTime;
                m.status = m.isLive ? 'live' : 'upcoming';
            });
            this.sortMatches();
        },

        getItemById(id) {
            return this.matches.find(m => m.id === id) || this.channels.find(c => c.id === id) || null;
        },

        formatTime(ts) {
            if (!ts) return 'LIVE';
            try {
                return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
            } catch (e) {
                return 'LIVE';
            }
        },

        formatDate(ts) {
            if (!ts) return 'Today';
            try {
                const d = new Date(ts);
                const now = new Date();
                if (d.toDateString() === now.toDateString()) {
                    return 'Today ' + this.formatTime(ts);
                }
                const tomorrow = new Date(now);
                tomorrow.setDate(now.getDate() + 1);
                if (d.toDateString() === tomorrow.toDateString()) {
                    return 'Tomorrow ' + this.formatTime(ts);
                }
                return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + this.formatTime(ts);
            } catch (e) {
                return 'Today';
            }
        },

        getCountdownText(startTs) {
            const now = Date.now();
            const diff = startTs - now;
            if (diff <= 0) return 'LIVE';
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const secs = Math.floor((diff % (1000 * 60)) / 1000);
            if (hours >= 24) {
                const days = Math.floor(hours / 24);
                return `${days}d ${hours % 24}h (${this.formatTime(startTs)})`;
            }
            return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        },

        getAllMatches() {
            return this.matches;
        },

        getLiveMatches() {
            return this.matches.filter(m => m.isLive);
        },

        getUpcomingMatches() {
            return this.matches.filter(m => !m.isLive);
        },

        getMatchesByCategory(cat) {
            if (!cat || cat === 'ALL') return this.getAllMatches();
            if (cat === 'LIVE NOW') return this.getLiveMatches();
            if (cat === 'TODAY') {
                const todayMidnight = new Date().setHours(0, 0, 0, 0);
                const tonightMidnight = todayMidnight + 86400000;
                return this.matches.filter(m => m.startTime >= todayMidnight && m.startTime < tonightMidnight);
            }
            return this.matches.filter(m => m.sport === cat || m.league.includes(cat));
        },

        searchMatches(query) {
            if (!query || !query.trim()) return this.getAllMatches();
            const q = query.toLowerCase().trim();
            return this.matches.filter(m =>
                m.title.toLowerCase().includes(q) ||
                m.league.toLowerCase().includes(q) ||
                m.sport.toLowerCase().includes(q) ||
                m.team1.name.toLowerCase().includes(q) ||
                m.team2.name.toLowerCase().includes(q)
            );
        },

        getChannels(query) {
            if (!query || !query.trim()) return this.channels;
            const q = query.toLowerCase().trim();
            return this.channels.filter(c =>
                c.name.toLowerCase().includes(q) ||
                c.country.toLowerCase().includes(q)
            );
        }
    };

    // Auto-initialize when script loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.AryanGlobalAPI.init());
    } else {
        window.AryanGlobalAPI.init();
    }
})();
