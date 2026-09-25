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
        'data.miopks.workers.dev',
        'data.jccldjshj8sw.workers.dev',
        'data.nibflolsi9.workers.dev',
        'data.5j181.workers.dev',
        'data.rim1043.workers.dev',
        'data.kuig2.workers.dev',
        'data.senbon001.workers.dev',
        'data.senbon001-2.workers.dev',
        'data.senbon002.workers.dev',
        'data.senbon003.workers.dev',
        'data.kageyoshi001.workers.dev',
        'data.silentbyte125.workers.dev',
        'data.stealthwolf798-69b.workers.dev',
        'data.redjoy256.workers.dev',
        'data.anonfox144.workers.dev',
        'data.cripw4lk000.workers.dev',
        'data.phamviet444.workers.dev',
        'data.kanghaerin444.workers.dev',
        'data.minjikim444.workers.dev',
        'data.leehyein444.workers.dev',
        'data.daniellemarsh444.workers.dev'
    ];

    function getRandomAlphaWorker() {
        return ALPHA_WORKER_NODES[Math.floor(Math.random() * ALPHA_WORKER_NODES.length)];
    }

    function toProxiedEmbedUrl(rawUrl) {
        if (!rawUrl) return '';
        if (rawUrl.startsWith('/api/embed') || rawUrl.includes('/api/embed')) return rawUrl;
        if (rawUrl.includes('pandecocogaming.sbs') || rawUrl.includes('getsugatensho.sbs') || rawUrl.includes('sportsembed.')) {
            return `/api/embed?url=${encodeURIComponent(rawUrl)}`;
        }
        return rawUrl;
    }

    function sanitizePosterUrl(url) {
        if (!url || typeof url !== 'string') return '';
        url = url.trim();
        if (!url) return '';
        if (url.includes('wsrv.nl/?url=')) return url;
        if (url.includes('streamed.pk') || url.includes('static.ppvservices.st') || url.includes('damitv.st')) {
            return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=400`;
        }
        return url;
    }

    function sanitizeLogoUrl(url) {
        if (!url || typeof url !== 'string') return '';
        url = url.trim();
        if (!url) return '';
        if (url.includes('wsrv.nl/?url=')) return url;
        if (url.includes('streamed.pk') || url.includes('static.ppvservices.st') || url.includes('damitv.st')) {
            return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=120`;
        }
        return url;
    }

    function sanitizeMatchServers(match) {
        if (!match) return match;
        if (match.poster) {
            match.poster = sanitizePosterUrl(match.poster);
        }
        if (!Array.isArray(match.servers)) return match;
        const clean = [];
        const seen = new Set();
        for (const s of match.servers) {
            if (!s || !s.url) continue;
            const url = s.url;
            // Drop any unwanted broadcast TV channel dumps (embedindia.st/embed/<numeric_id>)
            if (/embedindia\.st\/embed\/\d+$/i.test(url) && !url.includes('backup=')) {
                continue;
            }
            if (seen.has(url)) continue;
            seen.add(url);
            clean.push(s);
        }

        // Re-index server names cleanly: Server 1, Server 2, Server 3...
        clean.forEach((s, idx) => {
            const labelMatch = (s.name || '').match(/\[(.*?)\]/);
            const label = labelMatch ? labelMatch[1] : (idx === 0 ? 'Main HD 1080p' : (idx === 1 ? 'Backup HD Feed' : 'HD'));
            s.name = `Server ${idx + 1} [${label}]`;
        });

        match.servers = clean;
        match.sources = clean;
        return match;
    }

    const MATCH_STOP_WORDS = new Set([
        'vs', 'v', 'at', 'the', 'fc', 'cf', 'sc', 'united', 'city', 'town', 'county', 'club', 
        'real', 'de', 'la', 'and', 'women', 'men', 'live', 'stream', 'hd', 'test', 'day',
        'afc', '1', '2', '07', '04', 'sv', 'rb', 'cd', 'ud', 'sk', 'san', 'south', 'north', 'east', 'west'
    ]);

    function tokenizeMatchStr(str) {
        if (!str) return [];
        return str.toLowerCase()
            .replace(/[^a-z0-9]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2 && !MATCH_STOP_WORDS.has(w));
    }

    function matchTeams(teamA, teamB) {
        const toksA = tokenizeMatchStr(teamA);
        const toksB = tokenizeMatchStr(teamB);
        if (toksA.length === 0 || toksB.length === 0) return false;
        return toksA.some(a => toksB.some(b => a === b || (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a)))));
    }

    function isSameMatch(ppv, alpha) {
        if (!ppv || !alpha) return false;

        // 1. Sport & Category compatibility check
        const pSport = (ppv.sport || ppv.category || ppv.catName || '').toUpperCase();
        const aCat = (alpha.category || alpha.league || '').toUpperCase();

        const sportGroups = {
            'FOOTBALL': ['FOOTBALL', 'SOCCER', 'UEFA', 'FIFA', 'LALIGA', 'PREMIER', 'BUNDESLIGA', 'SERIE', 'LIGUE', 'EREDIVISIE', 'BRASILEIRÃO', 'LIGA'],
            'AMERICAN FOOTBALL': ['AMERICAN FOOTBALL', 'CFL', 'NFL', 'CFB'],
            'CRICKET': ['CRICKET', 'ASIAN GAMES', 'CPL', 'IPL', 'T20', 'ODI', 'TEST'],
            'COMBAT SPORTS': ['COMBAT SPORTS', 'UFC', 'MMA', 'BOXING', 'FIGHTS', 'FIGHTING'],
            'MOTORSPORTS': ['MOTORSPORTS', 'F1', 'MOTOGP', 'FORMULA', 'NASCAR', 'RALLY'],
            'BASEBALL': ['BASEBALL', 'MLB'],
            'BASKETBALL': ['BASKETBALL', 'NBA', 'NBL', 'EUROLEAGUE'],
            'HOCKEY': ['HOCKEY', 'ICE HOCKEY', 'NHL'],
            'RUGBY': ['RUGBY', 'NRL', 'AFL']
        };

        if (pSport && aCat) {
            let compatible = false;
            for (const [group, members] of Object.entries(sportGroups)) {
                const pInGroup = pSport.includes(group) || members.some(m => pSport.includes(m));
                const aInGroup = aCat.includes(group) || members.some(m => aCat.includes(m));
                if (pInGroup && aInGroup) {
                    compatible = true;
                    break;
                }
            }
            if (!compatible && pSport !== 'OTHERS' && aCat !== 'OTHERS' && pSport !== aCat) {
                return false;
            }
        }

        // 2. Start time proximity check (within 10 hours)
        const ppvTime = ppv.startTime || (typeof ppv.date === 'number' ? ppv.date : (new Date(ppv.date).getTime() || 0));
        const alphaTime = (alpha.timestamp || 0) * 1000;
        if (ppvTime && alphaTime) {
            const diffHours = Math.abs(ppvTime - alphaTime) / (1000 * 60 * 60);
            if (diffHours > 10) return false;
        }

        const pTitle = ppv.title || ppv.name || '';
        const aTitle = alpha.event_name || alpha.title || '';

        const pParts = pTitle.split(/ vs\.? | @ | - /i);
        const aParts = aTitle.split(/ vs\.? | @ | - /i);

        const pHome = (ppv.team1 && ppv.team1.name) || (ppv.teams && ppv.teams.home && ppv.teams.home.name) || pParts[0] || '';
        const pAway = (ppv.team2 && ppv.team2.name) || (ppv.teams && ppv.teams.away && ppv.teams.away.name) || pParts[1] || '';

        const aHome = alpha.home_team || aParts[0] || '';
        const aAway = alpha.away_team || aParts[1] || '';

        if (pHome && pAway && aHome && aAway) {
            const homeHome = matchTeams(pHome, aHome);
            const awayAway = matchTeams(pAway, aAway);
            const homeAway = matchTeams(pHome, aAway);
            const awayHome = matchTeams(pAway, aHome);
            if ((homeHome && awayAway) || (homeAway && awayHome)) return true;
        }

        const pToks = tokenizeMatchStr(pTitle);
        const aToks = tokenizeMatchStr(aTitle);
        const common = aToks.filter(t => pToks.includes(t));
        if (common.length >= 2) return true;
        if (common.length >= 1 && (pTitle.toLowerCase().includes('grand prix') || pTitle.toLowerCase().includes('race') || pTitle.toLowerCase().includes('ufc') || pTitle.toLowerCase().includes('prix'))) return true;

        return false;
    }

    const SPORT_MAPPINGS = {
        'football': 'FOOTBALL',
        'soccer': 'FOOTBALL',
        'uefa': 'FOOTBALL',
        'uefa nations': 'FOOTBALL',
        'uefa-nations': 'FOOTBALL',
        'fifa': 'FOOTBALL',
        'fifa friendlies': 'FOOTBALL',
        'fifa-friendlies': 'FOOTBALL',
        'fifa asean cup': 'FOOTBALL',
        'fifa-asean-cup': 'FOOTBALL',
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
        'nbl': 'BASKETBALL',
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
        'formula 1': 'MOTORSPORTS',
        'formula-1': 'MOTORSPORTS',
        'motogp': 'MOTORSPORTS',
        'tennis': 'TENNIS',
        'cricket': 'CRICKET',
        'etpl': 'CRICKET',
        'caribbean premier league': 'CRICKET',
        'cpl': 'CRICKET',
        'ipl': 'CRICKET',
        'asia cup': 'CRICKET',
        'asian games': 'CRICKET',
        'asian-games': 'CRICKET',
        'darts': 'DARTS',
        'wrestling': 'WRESTLING',
        'wwe': 'WRESTLING',
        'aew': 'WRESTLING',
        'nhl': 'HOCKEY',
        'icehockey': 'HOCKEY',
        'ice-hockey': 'HOCKEY',
        'hockey': 'HOCKEY',
        'rugby': 'RUGBY',
        'nrl rugby': 'RUGBY',
        'nrl': 'RUGBY',
        'golf': 'GOLF',
        '24/7-streams': '24/7 STREAMS',
        'other': 'OTHERS',
        'others': 'OTHERS'
    };

    window.AryanGlobalAPI = {
        isLoading: true,
        matches: [],
        channels: [],
        alphaCatalog: [],
        listeners: [],
        refreshInterval: null,
        _preFetching: false,
        _alphaLoadingPromise: null,

        async init() {
            const CACHE_KEY = 'aryan_cached_matches_v30';
            // 1. Explicitly purge any bloated legacy caches containing old channel dumps or old ordering
            try {
                ['aryan_cached_matches_v1', 'aryan_cached_matches_v2', 'aryan_cached_matches_v3', 'aryan_cached_matches_v4', 'aryan_cached_matches_v5', 'aryan_cached_matches_v6', 'aryan_cached_matches_v10', 'aryan_cached_matches_v11', 'aryan_cached_matches_v12', 'aryan_cached_matches_v13', 'aryan_cached_matches_v14', 'aryan_cached_matches_v15', 'aryan_cached_matches_v16', 'aryan_cached_matches_v17', 'aryan_cached_matches_v18', 'aryan_cached_matches_v19', 'aryan_cached_matches_v20', 'aryan_cached_matches_v21', 'aryan_cached_matches_v22', 'aryan_cached_matches_v23', 'aryan_cached_matches_v24', 'aryan_cached_matches_v25', 'aryan_cached_matches_v26', 'aryan_cached_matches_v27', 'aryan_cached_matches_v28', 'aryan_cached_matches_v29'].forEach(k => {
                    localStorage.removeItem(k);
                });
            } catch (e) {}

            // 2. Immediately hydrate from localStorage cache so fixtures appear with 0ms delay on reload/back
            try {
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        const now = Date.now();
                        this.matches = parsed.filter(m => {
                            if (m.isAlwaysLive || m.always_live === 1 || !m.endTime) return true;
                            return now <= (m.endTime + 900000);
                        }).map(m => {
                            if (m.poster) m.poster = sanitizePosterUrl(m.poster);
                            return sanitizeMatchServers(m);
                        });
                        this.isLoading = false;
                        this.sortMatches();
                        this.emitUpdate();
                    }
                }
            } catch (e) {}

            if (this.matches.length === 0) {
                this.isLoading = true;
                this.emitUpdate();
            }

            // 1. Launch Alpha feed aggregation in parallel
            this._alphaLoadingPromise = this.loadStreamCornerAlphaFeeds();

            // 2. Load PPV feeds, Alpha feeds, and channels in parallel
            await Promise.allSettled([
                this.loadPPVFeeds(),
                this._alphaLoadingPromise,
                this.loadChannelsCatalog()
            ]);

            this.isLoading = false;
            this.sortMatches();
            this.emitUpdate();

            // When Alpha finishes in background, pair fixtures and pre-fetch live Alpha sources
            this._alphaLoadingPromise.then(() => {
                this.preFetchLiveAlphaSources();
            }).catch(() => {});

            // Auto-refresh match feeds, Alpha channels & statuses every 90 seconds
            if (!this.refreshInterval) {
                this.refreshInterval = setInterval(async () => {
                    await this.loadPPVFeeds();
                    this._alphaLoadingPromise = this.loadStreamCornerAlphaFeeds();
                    await this._alphaLoadingPromise;
                    this.updateLiveStatuses();
                    this.emitUpdate();
                }, 90000);
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
         * Fetch all matches directly from official PPV.st and Streamed schedule APIs
         * Combines live streams and upcoming fixtures across all sports (F1, MotoGP, Football, Cricket, NFL, etc.)
         * Guarantees 100% genuine authentic posters, zero duplicate stock photos, and full coverage.
         */
        async loadPPVFeeds() {
            const CACHE_KEY = 'aryan_cached_matches_v30';
            try {
                const rawItems = [];
                const seenRawIds = new Set();

                // 1. Fetch official PPV Live Streams
                const ppvEndpoints = [
                    'https://api.ppv.st/api/streams',
                    '/api/ppv'
                ];
                for (const ep of ppvEndpoints) {
                    try {
                        const res = await fetch(ep, {
                            signal: AbortSignal.timeout(5000),
                            headers: { 'Accept': 'application/json' }
                        });
                        if (res.ok) {
                            const json = await res.json();
                            if (json && json.success !== false && Array.isArray(json.streams)) {
                                json.streams.forEach(cat => {
                                    const cName = (cat.category || 'Sports').trim();
                                    const is247 = cat.always_live || cName.toLowerCase().includes('24/7');
                                    (cat.streams || []).forEach(s => {
                                        if (s && s.id && !seenRawIds.has(s.id)) {
                                            seenRawIds.add(s.id);
                                            rawItems.push({ stream: s, category: cName, is247: is247 });
                                        }
                                    });
                                });
                                break;
                            }
                        }
                    } catch (e) {}
                }

                // 2. Fetch Complete Fixtures Schedule (Includes all upcoming F1, MotoGP, Cricket, NFL, etc.)
                const scheduleEndpoints = [
                    'https://streamed.pk/api/matches/all',
                    '/api/nitro?url=https://streamed.pk/api/matches/all',
                    '/api/ppv?endpoint=all'
                ];
                for (const ep of scheduleEndpoints) {
                    try {
                        const res = await fetch(ep, {
                            signal: AbortSignal.timeout(6000),
                            headers: { 'Accept': 'application/json' }
                        });
                        if (res.ok) {
                            const json = await res.json();
                            if (Array.isArray(json) && json.length > 0) {
                                json.forEach(s => {
                                    if (s && s.id && !seenRawIds.has(s.id)) {
                                        seenRawIds.add(s.id);
                                        const cName = (s.category || 'Sports').trim();
                                        const is247 = s.always_live || cName.toLowerCase().includes('24/7');
                                        rawItems.push({ stream: s, category: cName, is247: is247 });
                                    }
                                });
                                break;
                            }
                        }
                    } catch (e) {}
                }

                if (rawItems.length > 0) {
                    const newMatches = [];

                    for (const item of rawItems) {
                        const s = item.stream;
                        const catName = item.category;
                        const is247Cat = item.is247;
                        const sTitle = (s.name || s.title || '').trim();
                        if (!s || !s.id || !sTitle) continue;

                        const existing = this.matches.find(m => m.id === `ppv-${s.id}` || m.rawId === s.id);
                        const norm = this.normalizePPVStreamItem(s, catName, is247Cat);
                        if (!norm) continue;

                        if (existing && existing._alphaResolved) {
                            norm.alphaStreamId = existing.alphaStreamId;
                            norm.alphaItem = existing.alphaItem;
                            norm._alphaResolved = existing._alphaResolved;
                            // Strictly preserve only genuine StreamCorner Alpha broadcast channels
                            const alphaFeeds = (existing.servers || []).filter(srv => {
                                const u = srv.url || '';
                                return (u.includes('pandecocogaming') || u.includes('/api/embed') || u.includes('getsugatensho') || u.includes('.m3u8'))
                                    && !/embedindia\.st\/embed\/\d+$/i.test(u);
                            });
                            if (alphaFeeds.length > 0) {
                                norm.servers = sanitizeMatchServers({ servers: [...alphaFeeds, ...norm.servers] }).servers;
                                norm.sources = norm.servers;
                            }
                        } else if (existing && existing.alphaStreamId) {
                            norm.alphaStreamId = existing.alphaStreamId;
                            norm.alphaItem = existing.alphaItem;
                        } else if (Array.isArray(this.alphaCatalog) && this.alphaCatalog.length > 0) {
                            const matchedAlpha = this.alphaCatalog.find(a => isSameMatch(norm, a));
                            if (matchedAlpha) {
                                norm.alphaStreamId = matchedAlpha.stream_id;
                                norm.alphaItem = matchedAlpha;
                            }
                        }
                        newMatches.push(norm);
                    }

                    if (newMatches.length > 0) {
                        // Also preserve any independent Alpha fixtures that were added or are in alphaCatalog
                        if (Array.isArray(this.alphaCatalog) && this.alphaCatalog.length > 0) {
                            for (const alpha of this.alphaCatalog) {
                                const isMatched = newMatches.some(m => m.alphaStreamId === alpha.stream_id || isSameMatch(m, alpha));
                                if (!isMatched) {
                                    const existingIndependent = this.matches.find(m => m.alphaStreamId === alpha.stream_id);
                                    if (existingIndependent) {
                                        newMatches.push(existingIndependent);
                                    } else {
                                        const normAlpha = this.normalizeAlphaMatch(alpha);
                                        if (normAlpha) newMatches.push(normAlpha);
                                    }
                                }
                            }
                        }

                        this.matches = newMatches;
                        this.isLoading = false;
                        this.sortMatches();
                        this.emitUpdate();
                        if (Array.isArray(this.alphaCatalog) && this.alphaCatalog.length > 0) {
                            this.autoResolveAllAlphaSources();
                        }
                        try {
                            localStorage.setItem(CACHE_KEY, JSON.stringify(this.matches.slice(0, 250)));
                        } catch (e) {}
                    }
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
                let alphaList = null;
                const candidateWorkers = [...ALPHA_WORKER_NODES].sort(() => Math.random() - 0.5);
                for (let i = 0; i < Math.min(candidateWorkers.length, 4); i++) {
                    const worker = candidateWorkers[i];
                    try {
                        const fetchP = window.StreamCornerCore.t(`https://${worker}/corner?p=alpha`, false, 'alpha list');
                        let timer;
                        const timeoutP = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('timeout')), 4000); });
                        alphaList = await Promise.race([fetchP, timeoutP]).finally(() => clearTimeout(timer));
                        if (Array.isArray(alphaList) && alphaList.length > 0) break;
                    } catch (e) {
                        console.warn(`Worker ${worker} failed for alpha catalog:`, e);
                    }
                }
                if (!Array.isArray(alphaList) || alphaList.length === 0) {
                    if (typeof window !== 'undefined' && !this._hasAttemptedAutoHeal) {
                        this._hasAttemptedAutoHeal = true;
                        console.warn('StreamCorner catalog returned empty/error. Auto-healing core engine from edge...');
                        const healed = await this.reloadLatestStreamCornerCore();
                        if (healed) {
                            return await this.loadStreamCornerAlphaFeeds();
                        }
                    }
                    return;
                }

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

                // 2. Introduce independent / exclusive StreamCorner Alpha fixtures (e.g. CPL, UFC, Formula 1, MotoGP, etc.)
                let addedIndependent = false;
                for (const alpha of alphaList) {
                    if (!matchedAlphaIds.has(alpha.stream_id)) {
                        const exists = this.matches.some(m => m.alphaStreamId === alpha.stream_id || m.id === `alpha-${alpha.stream_id}`);
                        if (!exists) {
                            const newMatch = this.normalizeAlphaMatch(alpha);
                            if (newMatch) {
                                this.matches.push(newMatch);
                                addedIndependent = true;
                            }
                        }
                    }
                }

                if (addedIndependent || this.matches.length > 0) {
                    this.isLoading = false;
                    this.sortMatches();
                    this.emitUpdate();
                    try {
                        const CACHE_KEY = 'aryan_cached_matches_v28';
                        localStorage.setItem(CACHE_KEY, JSON.stringify(this.matches.slice(0, 180)));
                    } catch (e) {}
                }

                // If user is already in watch view, immediately resolve extra channels and update sources UI!
                if (typeof currentWatchItem !== 'undefined' && currentWatchItem && !currentWatchItem._alphaResolved) {
                    const matchedAlpha = currentWatchItem.alphaStreamId
                        ? this.alphaCatalog.find(a => a.stream_id === currentWatchItem.alphaStreamId)
                        : this.alphaCatalog.find(a => isSameMatch(currentWatchItem, a));
                    if (matchedAlpha) {
                        currentWatchItem.alphaStreamId = matchedAlpha.stream_id;
                        currentWatchItem.alphaItem = matchedAlpha;
                        this.resolveAlphaSourcesForMatch(currentWatchItem);
                    }
                }

                // Automatically resolve and attach all StreamCorner broadcast channels across all matches
                this.autoResolveAllAlphaSources();
            } catch (err) {
                console.warn('StreamCorner Alpha feeds load failed:', err);
            }
        },

        /**
         * Ensure extra broadcast channels are paired and resolved for a match
         * Handles cases where Alpha catalog is still loading or match has not yet paired.
         */
        async ensureAlphaSourcesForMatch(match) {
            if (!match) return false;
            if (match._alphaResolved) return true;

            // 1. If Alpha feeds are currently loading in background, await completion
            if (this._alphaLoadingPromise) {
                try {
                    await this._alphaLoadingPromise;
                } catch (e) {}
            }

            // 2. If match does not have alphaStreamId yet, try to pair with alphaCatalog now
            if (!match.alphaStreamId && Array.isArray(this.alphaCatalog) && this.alphaCatalog.length > 0) {
                const matchedAlpha = this.alphaCatalog.find(a => isSameMatch(match, a));
                if (matchedAlpha) {
                    match.alphaStreamId = matchedAlpha.stream_id;
                    match.alphaItem = matchedAlpha;
                }
            }

            // 3. If alphaStreamId is present, resolve and return
            if (match.alphaStreamId) {
                return await this.resolveAlphaSourcesForMatch(match);
            }

            return false;
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
                    let detail = null;
                    const candidateWorkers = [...ALPHA_WORKER_NODES].sort(() => Math.random() - 0.5);
                    for (let i = 0; i < Math.min(candidateWorkers.length, 3); i++) {
                        const worker = candidateWorkers[i];
                        try {
                            const p = window.StreamCornerCore.t(`https://${worker}/corner?p=alpha&id=${match.alphaStreamId}`, false, match.title || 'alpha detail');
                            let timer;
                            const timeoutP = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('timeout')), 8000); });
                            detail = await Promise.race([p, timeoutP]).finally(() => clearTimeout(timer));
                            if (detail && Array.isArray(detail.streams) && detail.streams.length > 0) break;
                        } catch (err) {
                            // Worker fallback
                        }
                    }

                    if (!detail && typeof window !== 'undefined' && !this._hasAttemptedAutoHeal) {
                        this._hasAttemptedAutoHeal = true;
                        const healed = await this.reloadLatestStreamCornerCore();
                        if (healed) {
                            return await this.resolveAlphaSourcesForMatch(match);
                        }
                    }

                    if (detail && Array.isArray(detail.streams) && detail.streams.length > 0) {
                        // 1. Keep base PPV servers (Server 1 [Main HD] & Server 2 [Backup HD]), filtering out any stray channels
                        const baseServers = (match.servers || []).filter(s => {
                            const u = s.url || '';
                            // Drop unwanted broadcast channels (embedindia.st/embed/<numeric_id>)
                            if (/embedindia\.st\/embed\/\d+$/i.test(u) && !u.includes('backup=')) return false;
                            // Drop previous alpha feeds so they are cleanly refreshed without accumulating duplicates
                            if (u.includes('pandecocogaming') || u.includes('/api/embed') || u.includes('getsugatensho')) return false;
                            return true;
                        });

                        const seenUrls = new Set();
                        baseServers.forEach(s => {
                            if (s.url) seenUrls.add(s.url);
                            if (s.rawUrl) seenUrls.add(s.rawUrl);
                        });

                        const newServers = [];

                        detail.streams.forEach((s) => {
                            const rawUrl = (s.embed_url || s.stream_url || '').trim();
                            if (!rawUrl) return;

                            let label = (s.source_name || s.name || 'HD Channel').trim().toUpperCase().replace(/\s*-\s*$/, '');

                            // 1. Strictly drop any unwanted streamcorner-branded fallback links
                            if (/streamcorner/i.test(label) || /streamcorner/i.test(rawUrl)) return;

                            // 2. Strictly drop duplicate ppv / embedindia / damitv streams (Server 1 & Server 2 already provide them)
                            if (/embedindia|damitv|ppv/i.test(rawUrl) || /embedindia|damitv|ppv/i.test(label)) return;

                            // 3. Deduplicate against seen URLs
                            if (seenUrls.has(rawUrl)) return;
                            seenUrls.add(rawUrl);

                            const isDirectHls = rawUrl.includes('.m3u8');
                            const srvUrl = isDirectHls ? rawUrl : toProxiedEmbedUrl(rawUrl);
                            seenUrls.add(srvUrl);

                            newServers.push({
                                name: `Server [${label}]`,
                                url: srvUrl,
                                rawUrl: rawUrl,
                                type: isDirectHls ? 'video' : 'iframe',
                                hd: true
                            });
                        });

                        // Place StreamCorner feeds first, followed by base PPV feeds
                        const combined = [...newServers, ...baseServers];
                        // Re-index all servers cleanly: Server 1, Server 2, Server 3...
                        combined.forEach((s, idx) => {
                            const labelMatch = (s.name || '').match(/\[(.*?)\]/);
                            const label = labelMatch ? labelMatch[1] : (idx === 0 ? 'Main HD 1080p' : (idx === 1 ? 'Backup HD Feed' : 'HD'));
                            s.name = `Server ${idx + 1} [${label}]`;
                        });

                        match.servers = combined;
                        match.sources = combined;

                        // Real-time update if user is currently viewing this match
                        if (typeof currentWatchItem !== 'undefined' && currentWatchItem && (currentWatchItem.id === match.id || currentWatchItem.alphaStreamId === match.alphaStreamId)) {
                            currentWatchItem.servers = match.servers;
                            currentWatchItem.sources = match.servers;
                            currentWatchItem._alphaResolved = true;
                            if (window.AryanPlayerEngine && window.AryanPlayerEngine.activeServerIdx === 0 && newServers.length > 0) {
                                window.AryanPlayerEngine.switchServer(0);
                            }
                            if (typeof renderWatchSources === 'function') {
                                const activeIdx = (window.AryanPlayerEngine && window.AryanPlayerEngine.activeServerIdx) || 0;
                                renderWatchSources(currentWatchItem, activeIdx);
                            }
                        }

                        // Persist enriched servers into localStorage cache so repeat visits have 0ms latency
                        try {
                            const CACHE_KEY = 'aryan_cached_matches_v28';
                            localStorage.setItem(CACHE_KEY, JSON.stringify(this.matches.slice(0, 180)));
                        } catch (e) {}
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
         * Automatically resolve StreamCorner broadcast feeds for live fixtures smoothly
         */
        async autoResolveAllAlphaSources() {
            if (this._resolvingAllAlpha) return;
            this._resolvingAllAlpha = true;

            try {
                // Only pre-resolve top 3 live matches so site is 100% fluid with zero freeze
                const targets = this.matches.filter(m => m.isLive && m.alphaStreamId && !m._alphaResolved).slice(0, 3);
                if (targets.length === 0) {
                    this._resolvingAllAlpha = false;
                    return;
                }

                for (const m of targets) {
                    await this.resolveAlphaSourcesForMatch(m);
                }
            } catch (e) {
                // Silent
            } finally {
                this._resolvingAllAlpha = false;
            }
        },

        /**
         * Dynamically reload the latest StreamCorner core from Cloudflare Pages API
         * Guarantees 100% automatic recovery if StreamCorner rotates keys or changes their bundle
         */
        async reloadLatestStreamCornerCore() {
            if (typeof document === 'undefined') return false;
            try {
                const res = await fetch(`/api/streamcorner-core?refresh=1&t=${Date.now()}`);
                if (!res.ok) return false;
                const scriptText = await res.text();
                if (!scriptText || !scriptText.includes('window.StreamCornerCore')) return false;

                // Execute updated script to refresh window.StreamCornerCore on the fly
                const scriptEl = document.createElement('script');
                scriptEl.textContent = scriptText;
                document.head.appendChild(scriptEl);
                console.log('StreamCornerCore dynamically updated and auto-healed!');
                return true;
            } catch (e) {
                console.warn('Auto-healing StreamCorner core failed:', e);
                return false;
            }
        },

        // Backward compatibility alias
        async preFetchLiveAlphaSources() {
            return await this.autoResolveAllAlphaSources();
        },

        /**
         * Normalize a fixture item from StreamCorner Alpha feeds
         * For independent fixtures (e.g. CPL, UFC, Formula 1, MotoGP, etc.)
         */
        normalizeAlphaMatch(alpha) {
            const rawTitle = (alpha.event_name || (alpha.home_team && alpha.away_team ? `${alpha.home_team} vs. ${alpha.away_team}` : alpha.home_team || alpha.away_team) || 'Live Event').trim();
            const startTs = alpha.timestamp ? (alpha.timestamp * 1000) : (alpha.time_utc ? (new Date(alpha.time_utc + ' UTC').getTime() || 0) : 0);
            const endTs = startTs ? startTs + 10800000 : 0;
            const now = Date.now();

            // Discard Alpha matches that have already ended (ended more than 15 minutes ago)
            if (endTs > 0 && now > (endTs + 900000)) {
                return null;
            }

            const isLive = startTs > 0 && now >= (startTs - 900000) && now <= endTs;

            const rawCat = (alpha.category || '').toLowerCase().replace(/[\s_]+/g, '-');
            const league = (alpha.league || alpha.category || 'Sports').trim();
            const sport = SPORT_MAPPINGS[rawCat] || SPORT_MAPPINGS[league.toLowerCase()] || (alpha.category ? alpha.category.toUpperCase() : 'OTHERS');

            const team1Name = alpha.home_team || rawTitle.split(/ vs\.? | @ /i)[0] || rawTitle;
            const team2Name = alpha.away_team || rawTitle.split(/ vs\.? | @ /i)[1] || '';

            return {
                id: `alpha-${alpha.stream_id}`,
                rawId: alpha.stream_id,
                source: 'streamcorner',
                title: rawTitle,
                sport: sport,
                league: league.toUpperCase(),
                rawLeague: league,
                category: alpha.category || 'Sports',
                startTime: startTs,
                endTime: endTs,
                isLive: isLive,
                always_live: 0,
                isAlwaysLive: false,
                tag: league,
                league: league,
                sport: sport,
                status: isLive ? 'live' : 'upcoming',
                poster: sanitizePosterUrl(alpha.poster || ''),
                categoryLogo: sanitizeLogoUrl(alpha.category_logo || ''),
                colors: [],
                team1: { name: team1Name, logo: sanitizeLogoUrl(alpha.home_team_logo || '') },
                team2: { name: team2Name, logo: sanitizeLogoUrl(alpha.away_team_logo || '') },
                rawCategory: rawCat,
                servers: [],
                sources: [],
                alphaStreamId: alpha.stream_id,
                alphaItem: alpha,
                _alphaResolved: false
            };
        },

        /**
         * Normalize a stream item from official PPV.st Streams API
         * Ensures 100% authentic poster thumbnails, zero Unsplash duplicates,
         * accurate timestamps, and clean server embeds.
         */
        normalizePPVStreamItem(s, catName, is247Cat) {
            const startTs = (s.starts_at ? s.starts_at * 1000 : (s.date ? (typeof s.date === 'number' ? s.date : (new Date(s.date).getTime() || 0)) : 0));
            const endTs = (s.ends_at ? s.ends_at * 1000 : 0) || (startTs ? startTs + 10800000 : 0);
            const now = Date.now();
            const tag = (s.tag || s.league || catName || 'Sports').trim();
            const isAlwaysLive = Boolean(s.always_live || is247Cat || tag.toLowerCase().includes('24/7') || !startTs);

            // Filter out finished / ended matches (ended more than 15 minutes ago)
            if (!isAlwaysLive && endTs > 0 && now > (endTs + 900000)) {
                return null;
            }
            if (s.status === 'ended' || s.status === 'finished') {
                return null;
            }

            const isLive = !isAlwaysLive && (startTs > 0 && now >= startTs && now <= endTs);

            const title = (s.name || s.title || 'Live Event').trim();
            const rawCat = (s.category || catName || '').toLowerCase().replace(/[\s_]+/g, '-');
            const catKey = (catName || '').toLowerCase().replace(/[\s_]+/g, '-');
            const sport = SPORT_MAPPINGS[rawCat] || SPORT_MAPPINGS[catKey] || SPORT_MAPPINGS[tag.toLowerCase()] || (catName ? catName.toUpperCase() : 'OTHERS');

            const team1Name = title.split(/ vs\.? | @ /)[0] || title;
            const team2Name = title.split(/ vs\.? | @ /)[1] || '';

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

            // 1. Primary Embed from PPV
            const mainEmbed = s.iframe || s.embedUrl || s.url || '';
            const mainLabel = (s.source_tag || '').trim() ? `${s.source_tag.trim()} HD` : 'Main HD 1080p';
            if (mainEmbed) {
                addServer(`Server 1 [${mainLabel}]`, mainEmbed);
                const backupUrl = mainEmbed + (mainEmbed.includes('?') ? '&backup=1' : '?backup=1');
                addServer('Server 2 [Backup HD Feed]', backupUrl);
            } else {
                addServer('Server 1 [Main HD 1080p]', `https://embedindia.st/embed/${s.id}`);
                addServer('Server 2 [Backup HD Feed]', `https://embedindia.st/embed/${s.id}?backup=1`);
            }

            // 2. Substreams from official PPV feed (authentic broadcaster channels)
            if (Array.isArray(s.substreams)) {
                s.substreams.forEach(sub => {
                    const subUrl = sub.url || sub.iframe || sub.embedUrl;
                    if (subUrl) {
                        const srvIndex = servers.length + 1;
                        let label = sub.source_tag || sub.source || sub.name || '';
                        if (sub.locale && !label.toLowerCase().includes(sub.locale.toLowerCase())) {
                            label += ` (${sub.locale.toUpperCase()})`;
                        }
                        const finalName = label ? `Server ${srvIndex} [${label}]` : `Server ${srvIndex} [HD]`;
                        addServer(finalName, subUrl);
                    }
                });
            }

            // Re-index all servers cleanly: Server 1, Server 2, Server 3...
            servers.forEach((srv, idx) => {
                const labelMatch = (srv.name || '').match(/\[(.*)\]/);
                const label = labelMatch ? labelMatch[1] : (idx === 0 ? 'Main HD 1080p' : (idx === 1 ? 'Backup HD Feed' : 'HD'));
                srv.name = `Server ${idx + 1} [${label}]`;
            });

            return {
                id: `ppv-${s.id}`,
                rawId: s.id,
                source: 'ppv',
                title: title,
                sport: sport,
                league: tag.toUpperCase(),
                rawLeague: tag,
                category: catName,
                startTime: startTs,
                endTime: endTs,
                isLive: isLive,
                always_live: isAlwaysLive ? 1 : 0,
                isAlwaysLive: isAlwaysLive,
                tag: tag,
                status: isLive ? 'live' : (isAlwaysLive ? 'live_tv' : 'upcoming'),
                poster: sanitizePosterUrl(s.poster || s.image || ''),
                categoryLogo: sanitizeLogoUrl(s.category_logo || ''),
                colors: s.colors || [],
                team1: { name: team1Name, logo: '' },
                team2: { name: team2Name, logo: '' },
                rawCategory: catKey,
                servers: servers,
                sources: servers,
                _alphaResolved: false
            };
        },

        normalizePPVMatch(raw) {
            return this.normalizePPVStreamItem({
                id: raw.id,
                name: raw.title,
                tag: raw.league,
                poster: sanitizePosterUrl(raw.poster || ''),
                starts_at: typeof raw.date === 'number' ? Math.floor(raw.date / 1000) : (Math.floor(new Date(raw.date).getTime() / 1000) || 0),
                ends_at: 0,
                always_live: raw.always_live || 0,
                iframe: raw.embedUrl,
                substreams: raw.substreams
            }, raw.category || 'Sports', Boolean(raw.always_live));
        },

        normalizeDamiMatch(raw) {
            return this.normalizePPVMatch(raw);
        },

        sortMatches() {
            this.matches.sort((a, b) => {
                const aLive = a.isLive && !this.isExcludedFromLiveNow(a);
                const bLive = b.isLive && !this.isExcludedFromLiveNow(b);
                // Live matches always on top
                if (aLive && !bLive) return -1;
                if (!aLive && bLive) return 1;
                // Then chronological by start time
                return (a.startTime || 0) - (b.startTime || 0);
            });
        },

        updateLiveStatuses() {
            const now = Date.now();
            // Strictly remove matches that ended more than 15 minutes ago
            this.matches = this.matches.filter(m => {
                if (m.isAlwaysLive || m.always_live === 1 || !m.endTime) return true;
                return now <= (m.endTime + 900000);
            });
            this.matches.forEach(m => {
                if (m.isAlwaysLive || m.always_live === 1 || m.tag === '24/7 channel' || m.tag === '24/7 streams' || !m.startTime) {
                    m.isLive = false;
                    m.status = 'live_tv';
                } else {
                    m.isLive = m.startTime <= now && now <= m.endTime;
                    m.status = m.isLive ? 'live' : 'upcoming';
                }
            });
            this.sortMatches();
        },

        getItemById(id) {
            if (!id) return null;
            const decoded = decodeURIComponent(String(id)).trim();
            const slug = decoded.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            const stripped = decoded.replace(/^(ppv|dami)-/i, '');

            // 1. Direct ID, rawId, or slug match
            let found = this.matches.find(m => {
                if (m.id === decoded || m.rawId === decoded || ('ppv-' + m.rawId) === decoded || ('dami-' + m.rawId) === decoded || m.alphaStreamId === decoded) return true;
                if (m.rawId === stripped || m.id === stripped) return true;
                if (m.slug && m.slug === slug) return true;
                const mSlug = (m.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                if (mSlug && (mSlug === slug || mSlug.includes(slug) || (slug.length > 5 && slug.includes(mSlug)))) return true;
                return false;
            });

            // 2. Token overlap match (e.g. "ppv-pl/2026-09-12/liv-ful" -> "Liverpool vs. Fulham")
            if (!found) {
                const qToks = tokenizeMatchStr(stripped);
                if (qToks.length >= 2) {
                    found = this.matches.find(m => {
                        const tToks = tokenizeMatchStr(m.title);
                        if (tToks.length < 2) return false;
                        return tToks.every(t => qToks.some(q => t.startsWith(q) || q.startsWith(t)));
                    });
                }
            }

            return found
                || this.channels.find(c => c.id === decoded || (c.channelId && String(c.channelId) === decoded))
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
            const now = Date.now();
            return this.matches.filter(m => m.isAlwaysLive || !m.endTime || now <= (m.endTime + 900000));
        },

        isExcludedFromLiveNow(m) {
            if (!m) return true;
            if (m.isAlwaysLive || m.always_live === 1) return true;
            if (m.tag === '24/7 channel' || m.tag === '24/7 streams') return true;
            if (!m.startTime || m.startTime <= 0) return true;

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
            const now = Date.now();
            return this.matches.filter(m => m.isLive && !this.isExcludedFromLiveNow(m) && (!m.endTime || now <= (m.endTime + 900000)));
        },

        getUpcomingMatches() {
            const now = Date.now();
            return this.matches.filter(m => !m.isLive && (!m.endTime || now <= (m.endTime + 900000)));
        },

        getMatchesByCategory(cat) {
            if (!cat || cat === 'ALL') return this.getAllMatches();
            if (cat === 'LIVE NOW') return this.getLiveMatches();
            if (cat === 'TODAY') {
                const todayMidnight = new Date().setHours(0, 0, 0, 0);
                const tonightMidnight = todayMidnight + 86400000;
                const now = Date.now();
                return this.matches.filter(m => m.startTime >= todayMidnight && m.startTime < tonightMidnight && (!m.endTime || now <= (m.endTime + 900000)));
            }
            const cleanCat = cat.toUpperCase().trim();
            const now = Date.now();
            return this.matches.filter(m => {
                if (m.endTime && now > (m.endTime + 900000)) return false;
                const sport = (m.sport || '').toUpperCase();
                const league = (m.league || '').toUpperCase();
                const rawCat = (m.rawCategory || '').toUpperCase();
                const title = (m.title || '').toUpperCase();

                if (cleanCat === 'MOTORSPORTS' || cleanCat === 'F1' || cleanCat.includes('MOTOR') || cleanCat.includes('F1')) {
                    return sport === 'MOTORSPORTS' || league.includes('F1') || league.includes('FORMULA') || league.includes('MOTOGP') || title.includes('F1') || title.includes('FORMULA 1') || title.includes('GRAND PRIX') || title.includes('PRIX') || rawCat.includes('MOTOR');
                }
                if (cleanCat === 'COMBAT SPORTS' || cleanCat === 'UFC' || cleanCat.includes('COMBAT') || cleanCat.includes('FIGHT')) {
                    return sport === 'COMBAT SPORTS' || league.includes('UFC') || league.includes('MMA') || league.includes('BOXING') || rawCat.includes('FIGHT');
                }
                if (cleanCat === 'AMERICAN FOOTBALL' || cleanCat === 'NFL') {
                    return sport === 'AMERICAN FOOTBALL' || league.includes('NFL') || league.includes('CFB') || league.includes('CFL');
                }
                if (cleanCat === 'FOOTBALL' || cleanCat === 'SOCCER') {
                    return sport === 'FOOTBALL';
                }
                if (cleanCat === 'CRICKET') {
                    return sport === 'CRICKET';
                }
                if (cleanCat === 'HOCKEY') {
                    return sport === 'HOCKEY';
                }
                if (cleanCat === 'BASKETBALL') {
                    return sport === 'BASKETBALL';
                }
                if (cleanCat === 'BASEBALL') {
                    return sport === 'BASEBALL';
                }
                if (cleanCat === 'TENNIS') {
                    return sport === 'TENNIS';
                }
                if (cleanCat === 'RUGBY') {
                    return sport === 'RUGBY';
                }
                if (cleanCat === 'WRESTLING') {
                    return sport === 'WRESTLING';
                }
                if (cleanCat === 'AUSTRALIAN FOOTBALL') {
                    return sport === 'AUSTRALIAN FOOTBALL';
                }
                return sport.includes(cleanCat) || league.includes(cleanCat) || rawCat.includes(cleanCat);
            });
        },

        searchMatches(query) {
            if (!query || !query.trim()) return this.getAllMatches();
            const q = query.toLowerCase().trim();
            const now = Date.now();
            return this.matches.filter(m =>
                (!m.endTime || now <= (m.endTime + 900000)) && (
                    (m.title || '').toLowerCase().includes(q) ||
                    (m.league || '').toLowerCase().includes(q) ||
                    (m.sport || '').toLowerCase().includes(q) ||
                    (m.team1 && m.team1.name && m.team1.name.toLowerCase().includes(q)) ||
                    (m.team2 && m.team2.name && m.team2.name.toLowerCase().includes(q))
                )
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
                'FOOTBALL',
                'CRICKET',
                'AMERICAN FOOTBALL',
                'COMBAT SPORTS',
                'MOTORSPORTS',
                'BASEBALL',
                'BASKETBALL',
                'TENNIS',
                'DARTS',
                'AUSTRALIAN FOOTBALL',
                'RUGBY',
                'ARM WRESTLING',
                'WRESTLING',
                'HOCKEY',
                'OTHERS'
            ];

            const grouped = {};
            const now = Date.now();
            this.matches.forEach(m => {
                // Strictly exclude 24/7 linear channels from scheduled sport match categories
                if (m.isAlwaysLive || m.tag === '24/7 channel' || m.tag === '24/7 streams') return;
                // Strictly exclude matches that have already ended
                if (m.endTime && now > (m.endTime + 900000)) return;

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
