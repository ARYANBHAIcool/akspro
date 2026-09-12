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

    const ALPHA_WORKER_NODES = [
        'data.gigav.workers.dev',
        'data.yedmzoa.workers.dev',
        'data.ngagzipx.workers.dev',
        'data.senbon001.workers.dev',
        'data.senbon002.workers.dev',
        'data.phamviet444.workers.dev',
        'data.kanghaerin444.workers.dev',
        'data.minjikim444.workers.dev'
    ];

    function getRandomAlphaWorker() {
        return ALPHA_WORKER_NODES[Math.floor(Math.random() * ALPHA_WORKER_NODES.length)];
    }

    function toProxiedEmbedUrl(rawUrl) {
        if (!rawUrl) return '';
        if (rawUrl.startsWith('/api/embed') || rawUrl.includes('/api/embed')) return rawUrl;
        if (rawUrl.includes('pandecocogaming.sbs') || rawUrl.includes('getsugatensho.sbs') || rawUrl.includes('sportsembed.')) {
            try {
                const parsed = new URL(rawUrl);
                const search = parsed.search ? parsed.search.replace(/^\?/, '') + '&' : '';
                return `/api/embed?${search}url=${encodeURIComponent(rawUrl)}`;
            } catch (e) {
                return `/api/embed?url=${encodeURIComponent(rawUrl)}`;
            }
        }
        return rawUrl;
    }

    const MATCH_STOP_WORDS = new Set([
        'vs', 'v', 'at', 'the', 'fc', 'cf', 'sc', 'united', 'city', 'town', 'county', 'club', 
        'real', 'de', 'la', 'and', 'women', 'men', 'live', 'stream', 'hd', 'test', 'day', 'grand', 'prix',
        'afc', '1', '2', '07', '04', 'sv', 'rb', 'cd', 'ud', 'sk', 'san', 'south', 'north', 'east', 'west'
    ]);

    function tokenizeMatchStr(str) {
        if (!str) return [];
        return str.toLowerCase()
            .replace(/[^a-z0-9]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2 && !MATCH_STOP_WORDS.has(w));
    }

    function hasTokenOverlap(arr1, arr2) {
        for (const t1 of arr1) {
            if (arr2.some(t2 => t1 === t2 || (t1.length > 4 && t2.length > 4 && (t1.includes(t2) || t2.includes(t1))))) {
                return true;
            }
        }
        return false;
    }

    function isSameMatch(ppv, alpha) {
        const ppvTime = typeof ppv.date === 'number' ? ppv.date : (new Date(ppv.date).getTime() || 0);
        const alphaTime = (alpha.timestamp || 0) * 1000;
        if (ppvTime && alphaTime) {
            const diffHours = Math.abs(ppvTime - alphaTime) / (1000 * 60 * 60);
            if (diffHours > 14) return false;
        }

        const pHomeName = (ppv.teams && ppv.teams.home && ppv.teams.home.name) || (ppv.title || '').split(/ vs\.? | @ /)[0] || '';
        const pAwayName = (ppv.teams && ppv.teams.away && ppv.teams.away.name) || (ppv.title || '').split(/ vs\.? | @ /)[1] || '';

        const aHomeName = alpha.home_team || (alpha.event_name || '').split(/ vs\.? | @ /)[0] || '';
        const aAwayName = alpha.away_team || (alpha.event_name || '').split(/ vs\.? | @ /)[1] || '';

        const pHomeToks = tokenizeMatchStr(pHomeName);
        const pAwayToks = tokenizeMatchStr(pAwayName);
        const aHomeToks = tokenizeMatchStr(aHomeName);
        const aAwayToks = tokenizeMatchStr(aAwayName);

        const homeMatchesHome = hasTokenOverlap(pHomeToks, aHomeToks);
        const awayMatchesAway = hasTokenOverlap(pAwayToks, aAwayToks);
        const homeMatchesAway = hasTokenOverlap(pHomeToks, aAwayToks);
        const awayMatchesHome = hasTokenOverlap(pAwayToks, aHomeToks);

        if ((homeMatchesHome && awayMatchesAway) || (homeMatchesAway && awayMatchesHome)) {
            return true;
        }

        const pAll = tokenizeMatchStr(ppv.title);
        const aAll = tokenizeMatchStr(alpha.event_name);
        const common = aAll.filter(t => pAll.includes(t));
        if (common.length >= 2) return true;

        return false;
    }

    const SPORT_MAPPINGS = {
        'football': 'FOOTBALL',
        'soccer': 'FOOTBALL',
        'laliga': 'FOOTBALL',
        'laliga 2': 'FOOTBALL',
        'laliga-2': 'FOOTBALL',
        'premier-league': 'FOOTBALL',
        'epl': 'FOOTBALL',
        'championship': 'FOOTBALL',
        'bundesliga': 'FOOTBALL',
        '2. bundesliga': 'FOOTBALL',
        'serie a': 'FOOTBALL',
        'serie-a': 'FOOTBALL',
        'eredivisie': 'FOOTBALL',
        'brasileirão': 'FOOTBALL',
        'brasileirao': 'FOOTBALL',
        'liga mx': 'FOOTBALL',
        'liga-mx': 'FOOTBALL',
        'liga portugal': 'FOOTBALL',
        'liga-portugal': 'FOOTBALL',
        'basketball': 'BASKETBALL',
        'nba': 'BASKETBALL',
        'americanfootball': 'AMERICAN FOOTBALL',
        'american-football': 'AMERICAN FOOTBALL',
        'nfl': 'AMERICAN FOOTBALL',
        'cfb': 'AMERICAN FOOTBALL',
        'cfl': 'AMERICAN FOOTBALL',
        'arm-wrestling': 'ARM WRESTLING',
        'armwrestling': 'ARM WRESTLING',
        'afl': 'AUSTRALIAN FOOTBALL',
        'australian-football': 'AUSTRALIAN FOOTBALL',
        'baseball': 'BASEBALL',
        'mlb': 'BASEBALL',
        'fights': 'COMBAT SPORTS',
        'fight': 'COMBAT SPORTS',
        'mma': 'COMBAT SPORTS',
        'ufc': 'COMBAT SPORTS',
        'boxing': 'COMBAT SPORTS',
        'combat-sports': 'COMBAT SPORTS',
        'combatsports': 'COMBAT SPORTS',
        'fighting': 'COMBAT SPORTS',
        'motorsports': 'MOTORSPORTS',
        'motor-sports': 'MOTORSPORTS',
        'f1': 'MOTORSPORTS',
        'motogp': 'MOTORSPORTS',
        'tennis': 'TENNIS',
        'cricket': 'CRICKET',
        'etpl': 'CRICKET',
        'caribbean premier league': 'CRICKET',
        'asia cup': 'CRICKET',
        'darts': 'DARTS',
        'wrestling': 'WRESTLING',
        'nhl': 'HOCKEY',
        'icehockey': 'HOCKEY',
        'hockey': 'HOCKEY',
        'rugby': 'RUGBY',
        'nrl rugby': 'RUGBY',
        'nrl': 'RUGBY',
        'golf': 'GOLF',
        '24/7-streams': '24/7 STREAMS',
        'others': 'OTHERS'
    };

    const DEFAULT_POSTERS = {
        'FOOTBALL': 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&auto=format&fit=crop&q=60',
        'BASKETBALL': 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&auto=format&fit=crop&q=60',
        'AMERICAN FOOTBALL': 'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=800&auto=format&fit=crop&q=60',
        'BASEBALL': 'https://images.unsplash.com/photo-1508344928928-7165b67de128?w=800&auto=format&fit=crop&q=60',
        'COMBAT SPORTS': 'https://images.unsplash.com/photo-1517438322307-e67111335449?w=800&auto=format&fit=crop&q=60',
        'FIGHTING': 'https://images.unsplash.com/photo-1517438322307-e67111335449?w=800&auto=format&fit=crop&q=60',
        'MOTORSPORTS': 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&auto=format&fit=crop&q=60',
        'TENNIS': 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=800&auto=format&fit=crop&q=60',
        'CRICKET': 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&auto=format&fit=crop&q=60',
        'RUGBY': 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&auto=format&fit=crop&q=60',
        'DEFAULT': 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&auto=format&fit=crop&q=60'
    };

    window.AryanGlobalAPI = {
        isLoading: true,
        matches: [],
        channels: [],
        alphaCatalog: [],
        listeners: [],
        refreshInterval: null,
        _preFetching: false,

        async init() {
            this.isLoading = true;
            this.emitUpdate();

            await Promise.allSettled([
                this.loadPPVFeeds(),
                this.loadChannelsCatalog()
            ]);

            await this.loadStreamCornerAlphaFeeds();

            this.isLoading = false;
            this.sortMatches();
            this.emitUpdate();

            // Auto-refresh match feeds, Alpha channels & statuses every 60 seconds
            if (!this.refreshInterval) {
                this.refreshInterval = setInterval(async () => {
                    await this.loadPPVFeeds();
                    await this.loadStreamCornerAlphaFeeds();
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
         * Fetch all matches directly from official PPV API
         * Deduplicates strictly by raw.id to eliminate duplicate matches
         */
        async loadPPVFeeds() {
            try {
                const endpoints = [
                    `${DAMITV_API_BASE}/papi/matches/all-today`,
                    `${DAMITV_API_BASE}/papi/matches/live`
                ];

                const fetches = endpoints.map(async (url) => {
                    try {
                        const res = await fetch(url, {
                            signal: AbortSignal.timeout(6000),
                            headers: { 'Accept': 'application/json' }
                        });
                        if (res.ok) return await res.json();
                    } catch (e) {
                        try {
                            const directUrl = url.replace('/api/damitv', 'https://damitv.st');
                            const res2 = await fetch(directUrl, {
                                signal: AbortSignal.timeout(6000),
                                headers: { 'Accept': 'application/json' }
                            });
                            if (res2.ok) return await res2.json();
                        } catch (e2) {}
                    }
                    return [];
                });

                const [todayMatches, liveMatches] = await Promise.all(fetches);
                const rawList = [
                    ...(Array.isArray(liveMatches) ? liveMatches : []),
                    ...(Array.isArray(todayMatches) ? todayMatches : [])
                ];

                const seenIds = new Set();
                const newPpvMatches = [];

                for (const raw of rawList) {
                    if (!raw || !raw.id || !raw.title) continue;
                    if (seenIds.has(raw.id)) continue;
                    seenIds.add(raw.id);

                    const existing = this.matches.find(m => m.id === raw.id || m.rawId === raw.id);
                    if (existing && existing._alphaResolved) {
                        const norm = this.normalizePPVMatch(raw);
                        norm.alphaStreamId = existing.alphaStreamId;
                        norm.alphaItem = existing.alphaItem;
                        norm._alphaResolved = existing._alphaResolved;
                        norm.servers = existing.servers;
                        norm.sources = existing.servers;
                        newPpvMatches.push(norm);
                    } else if (existing && existing.alphaStreamId) {
                        const norm = this.normalizePPVMatch(raw);
                        norm.alphaStreamId = existing.alphaStreamId;
                        norm.alphaItem = existing.alphaItem;
                        newPpvMatches.push(norm);
                    } else {
                        newPpvMatches.push(this.normalizePPVMatch(raw));
                    }
                }

                // Master catalog remains strictly authentic PPV fixtures with genuine posters
                if (newPpvMatches.length > 0) {
                    this.matches = newPpvMatches;
                    this.sortMatches();
                }
            } catch (err) {
                console.warn('PPV feeds load failed:', err);
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
         * Load StreamCorner Alpha live & sports fixtures
         * Pairs with PPV fixtures and introduces independent Alpha matches
         */
        async loadStreamCornerAlphaFeeds() {
            if (typeof window === 'undefined' || !window.StreamCornerCore || typeof window.StreamCornerCore.t !== 'function') {
                return;
            }
            try {
                const worker = getRandomAlphaWorker();
                const alphaList = await window.StreamCornerCore.t(`https://${worker}/corner?p=alpha`, false, 'alpha list');
                if (!Array.isArray(alphaList) || alphaList.length === 0) return;

                this.alphaCatalog = alphaList;
                const matchedAlphaIds = new Set();

                // 1. Link matching PPV matches with their Alpha counterparts
                for (const alpha of alphaList) {
                    const matchedPPV = this.matches.find(m => isSameMatch(m, alpha));
                    if (matchedPPV) {
                        matchedAlphaIds.add(alpha.stream_id);
                        matchedPPV.alphaStreamId = alpha.stream_id;
                        matchedPPV.alphaItem = alpha;
                    }
                }

                // Alpha feeds solely enrich matching PPV fixtures with extra broadcast channels
                this.preFetchLiveAlphaSources();
            } catch (err) {
                console.warn('StreamCorner Alpha feeds load failed:', err);
            }
        },

        /**
         * Normalize a standalone StreamCorner Alpha event
         */
        normalizeAlphaMatch(alpha) {
            if (!alpha || !alpha.stream_id) return null;
            const title = alpha.event_name || 'Live Sports';
            const catKey = (alpha.category || '').toLowerCase().trim();
            const sport = SPORT_MAPPINGS[catKey] || SPORT_MAPPINGS[(alpha.league || '').toLowerCase().trim()] || 'OTHERS';

            const startTime = alpha.timestamp ? (alpha.timestamp * 1000) : Date.now();
            const endTime = startTime + 10800000;
            const now = Date.now();
            const isLive = startTime <= now && now <= endTime;

            const homeTeam = alpha.home_team || title.split(/ vs\.? | @ /)[0] || title;
            const awayTeam = alpha.away_team || title.split(/ vs\.? | @ /)[1] || '';

            const poster = alpha.poster || DEFAULT_POSTERS[sport] || DEFAULT_POSTERS['DEFAULT'];
            const scEmbedUrl = toProxiedEmbedUrl(`https://sportsembed.su.getsugatensho.sbs/stream?id=${alpha.stream_id}`);

            const servers = [
                {
                    name: 'Server 1 [StreamCorner HD]',
                    url: scEmbedUrl,
                    type: 'iframe',
                    hd: true
                }
            ];

            return {
                id: `alpha-${alpha.stream_id}`,
                rawId: alpha.stream_id,
                alphaStreamId: alpha.stream_id,
                alphaItem: alpha,
                _alphaResolved: false,
                source: 'streamcorner',
                title: title,
                sport: sport,
                league: (alpha.league || alpha.category || 'Live Sports').toUpperCase(),
                startTime: startTime,
                endTime: endTime,
                isLive: isLive,
                status: isLive ? 'live' : 'upcoming',
                poster: poster,
                team1: { name: homeTeam, logo: alpha.home_team_logo || '' },
                team2: { name: awayTeam, logo: alpha.away_team_logo || '' },
                rawCategory: catKey,
                servers: servers,
                sources: servers
            };
        },

        /**
         * Resolve extra broadcast channels for a match from StreamCorner Alpha
         * e.g. Fox Sports, TNT Sports, Sky Sports, Fancode, Apple TV, Willow, etc.
         */
        async resolveAlphaSourcesForMatch(match) {
            if (!match || !match.alphaStreamId) return false;
            if (match._alphaResolved) return true;
            if (match._alphaPromise) return await match._alphaPromise;
            if (typeof window === 'undefined' || !window.StreamCornerCore || typeof window.StreamCornerCore.t !== 'function') return false;

            match._alphaPromise = (async () => {
                try {
                    const worker = getRandomAlphaWorker();
                    const detail = await window.StreamCornerCore.t(`https://${worker}/corner?p=alpha&id=${match.alphaStreamId}`, false, match.title || 'alpha detail');

                    if (detail && Array.isArray(detail.streams) && detail.streams.length > 0) {
                        const seenUrls = new Set();
                        (match.servers || []).forEach(s => {
                            if (s.url) {
                                seenUrls.add(s.url);
                                try {
                                    const u = new URL(s.url, 'https://dummy.local');
                                    seenUrls.add(u.origin + u.pathname);
                                } catch (e) {}
                            }
                        });

                        const newServers = [];

                        detail.streams.forEach((s) => {
                            const rawUrl = s.embed_url || s.stream_url;
                            if (!rawUrl) return;

                            let label = (s.source_name || s.name || 'HD Channel').trim().toUpperCase().replace(/\s*-\s*$/, '');

                            // 1. Strictly drop any unwanted streamcorner-branded fallback links
                            if (/streamcorner/i.test(label) || /streamcorner/i.test(rawUrl)) return;

                            // 2. Strictly drop duplicate ppv / embedindia / damitv streams (Server 1 & Server 2 already provide them)
                            if (/embedindia|damitv|ppv/i.test(rawUrl) || /embedindia|damitv|ppv/i.test(label)) return;

                            // 3. Deduplicate against seen URLs
                            if (seenUrls.has(rawUrl)) return;
                            let pathnameOnly = '';
                            try {
                                const u = new URL(rawUrl, 'https://dummy.local');
                                pathnameOnly = u.origin + u.pathname;
                                if (seenUrls.has(pathnameOnly)) return;
                            } catch (e) {}

                            const isDirectHls = rawUrl.includes('.m3u8');
                            const srvUrl = isDirectHls ? rawUrl : toProxiedEmbedUrl(rawUrl);
                            if (seenUrls.has(srvUrl)) return;

                            seenUrls.add(rawUrl);
                            if (pathnameOnly) seenUrls.add(pathnameOnly);
                            seenUrls.add(srvUrl);

                            const srvIndex = match.servers.length + newServers.length + 1;
                            newServers.push({
                                name: `Server ${srvIndex} [${label}]`,
                                url: srvUrl,
                                type: isDirectHls ? 'video' : 'iframe',
                                hd: true
                            });
                        });

                        if (newServers.length > 0) {
                            match.servers = [...match.servers, ...newServers];
                            match.sources = match.servers;
                        }
                    }

                    match._alphaResolved = true;
                    return true;
                } catch (err) {
                    console.warn('Resolve Alpha sources failed:', match.title, err);
                    return false;
                } finally {
                    match._alphaPromise = null;
                }
            })();

            return await match._alphaPromise;
        },

        /**
         * Pre-fetch broadcast channels in the background for active/upcoming games
         */
        async preFetchLiveAlphaSources() {
            if (this._preFetching) return;
            this._preFetching = true;

            try {
                const targets = this.matches
                    .filter(m => m.alphaStreamId && !m._alphaResolved && !m._resolvingAlpha && (m.isLive || (m.startTime - Date.now()) < 7200000))
                    .slice(0, 10);

                if (targets.length === 0) {
                    this._preFetching = false;
                    return;
                }

                await Promise.allSettled(targets.map(t => this.resolveAlphaSourcesForMatch(t)));
            } catch (e) {
                // Silent
            } finally {
                this._preFetching = false;
            }
        },

        /**
         * Normalize a match object from PPV.st API
         * Attaches primary embed + all authentic substreams + backup HD feed
         * Excludes viewer numbers and random emojis
         */
        normalizePPVMatch(raw) {
            const title = raw.title || 'Live Match';
            const catKey = (raw.category || '').toLowerCase();
            const sport = SPORT_MAPPINGS[catKey] || SPORT_MAPPINGS[raw.league ? raw.league.toLowerCase() : ''] || 'OTHERS';

            const startTime = typeof raw.date === 'number' ? raw.date : (new Date(raw.date).getTime() || Date.now());
            const endTime = startTime + 10800000;
            const now = Date.now();
            const isLive = raw.status === 'live' || (startTime <= now && now <= endTime);

            const team1Name = (raw.teams && raw.teams.home && raw.teams.home.name) || title.split(/ vs\.? | @ /)[0] || title;
            const team2Name = (raw.teams && raw.teams.away && raw.teams.away.name) || title.split(/ vs\.? | @ /)[1] || '';

            const team1Badge = (raw.teams && raw.teams.home && raw.teams.home.badge) ? raw.teams.home.badge : '';
            const team2Badge = (raw.teams && raw.teams.away && raw.teams.away.badge) ? raw.teams.away.badge : '';

            const poster = raw.poster || DEFAULT_POSTERS[sport] || DEFAULT_POSTERS['DEFAULT'];

            const servers = [];
            const seenUrls = new Set();

            const addServer = (name, url, isHd = true) => {
                if (!url || seenUrls.has(url)) return;
                seenUrls.add(url);
                servers.push({
                    name: name,
                    url: url,
                    type: url.includes('.m3u8') ? 'video' : 'iframe',
                    hd: isHd
                });
            };

            // 1. Primary Embed URL
            if (raw.embedUrl) {
                addServer('Server 1 [Main HD 1080p]', raw.embedUrl);
            }

            // 2. Substreams from official PPV feed (e.g. F1 Apple TV, Sky F1, DAZN, ESPN2)
            if (Array.isArray(raw.substreams)) {
                raw.substreams.forEach((sub) => {
                    const subUrl = sub.iframe || sub.embedUrl || sub.url;
                    if (subUrl) {
                        const srvIndex = servers.length + 1;
                        let label = sub.name || '';
                        if (sub.locale && !label.toLowerCase().includes(sub.locale.toLowerCase())) {
                            label += ` [${sub.locale.toUpperCase()}]`;
                        }
                        const finalName = label ? `Server ${srvIndex} [${label}]` : `Server ${srvIndex} [HD]`;
                        addServer(finalName, subUrl);
                    }
                });
            }

            // 3. Fallback backup feed so every match has at least 2 servers
            if (servers.length === 1 && raw.embedUrl) {
                const backupUrl = raw.embedUrl + (raw.embedUrl.includes('?') ? '&backup=1' : '?backup=1');
                addServer('Server 2 [Backup HD Feed]', backupUrl);
            } else if (servers.length === 0) {
                const streamId = (raw.sources && raw.sources[0] && raw.sources[0].id) || raw.id;
                addServer('Server 1 [Main HD 1080p]', `https://embedindia.st/embed/${streamId}`);
                addServer('Server 2 [Backup HD Feed]', `https://embedindia.st/embed/${streamId}?backup=1`);
            }

            return {
                id: raw.id,
                rawId: raw.id,
                source: 'ppv',
                title: title,
                sport: sport,
                league: (raw.league || raw.category || 'Live Sports').toUpperCase(),
                startTime: startTime,
                endTime: endTime,
                isLive: isLive,
                status: isLive ? 'live' : 'upcoming',
                poster: poster,
                team1: { name: team1Name, logo: team1Badge },
                team2: { name: team2Name || '', logo: team2Badge },
                rawCategory: (raw.category || '').toLowerCase(),
                servers: servers,
                sources: servers
            };
        },

        normalizeDamiMatch(raw) {
            return this.normalizePPVMatch(raw);
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
            if (!id) return null;
            return this.matches.find(m => m.id === id || m.rawId === id || ('ppv-' + m.rawId) === id || ('dami-' + m.rawId) === id || m.alphaStreamId === id)
                || this.channels.find(c => c.id === id)
                || null;
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

        isExcludedFromLiveNow(m) {
            if (!m) return true;
            const t = (m.title || '').toLowerCase();
            const l = (m.league || '').toLowerCase();
            const s = (m.sport || '').toLowerCase();
            const c = (m.rawCategory || '').toLowerCase();

            // Exclude Golf ("gold")
            if (s === 'golf' || c === 'golf' || t.includes('golf') || l.includes('golf')) {
                return true;
            }

            // Exclude 24/7 streams / network loops
            if (s === '24/7 streams' || c === '24/7-streams' || t.includes('24/7') || l.includes('24/7')) {
                return true;
            }

            // Exclude Red Zone / Multi-feed channels
            if (t.includes('red zone') || t.includes('redzone') || l.includes('red zone') || l.includes('redzone') || t.includes('multi feed') || t.includes('multifeed')) {
                return true;
            }

            // Exclude 24/7 linear sports network channels from live match showcase
            const linearChannels = ['nfl network', 'fox footy', 'fox cricket', 'fox league', 'willow', 'rally tv'];
            if (linearChannels.some(ch => t === ch || t.startsWith(ch + ' '))) {
                return true;
            }

            return false;
        },

        getLiveMatches() {
            return this.matches.filter(m => m.isLive && !this.isExcludedFromLiveNow(m));
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
        },

        getMatchesGroupedByCategory() {
            const categoryOrder = [
                'AMERICAN FOOTBALL',
                'ARM WRESTLING',
                'AUSTRALIAN FOOTBALL',
                'BASEBALL',
                'COMBAT SPORTS',
                'CRICKET',
                'FOOTBALL',
                'MOTORSPORTS',
                'RUGBY',
                'TENNIS',
                'WRESTLING',
                'BASKETBALL',
                'HOCKEY',
                'PARAMOUNT+',
                'OTHERS'
            ];

            const grouped = {};
            this.matches.forEach(m => {
                const sport = m.sport || 'OTHERS';
                if (!grouped[sport]) grouped[sport] = [];
                grouped[sport].push(m);
            });

            const result = [];
            categoryOrder.forEach(cat => {
                if (grouped[cat] && grouped[cat].length > 0) {
                    result.push({
                        category: cat,
                        matches: grouped[cat]
                    });
                }
            });

            Object.keys(grouped).forEach(cat => {
                if (!categoryOrder.includes(cat) && grouped[cat].length > 0) {
                    result.push({
                        category: cat,
                        matches: grouped[cat]
                    });
                }
            });

            return result;
        }
    };

    // Auto-initialize when script loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.AryanGlobalAPI.init());
    } else {
        window.AryanGlobalAPI.init();
    }
})();
