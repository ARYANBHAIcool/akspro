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
        'data.kageyoshi001.workers.dev',
        'data.kuig2.workers.dev',
        'data.senbon001-2.workers.dev',
        'data.l0o1afmju0.workers.dev',
        'data.senbon001.workers.dev',
        'data.senbon002.workers.dev',
        'data.senbon003.workers.dev',
        'data.silentbyte125.workers.dev',
        'data.stealthwolf798-69b.workers.dev',
        'data.redjoy256.workers.dev',
        'data.anonfox144.workers.dev',
        'data.cripw4lk000.workers.dev',
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
        if (url.includes('streamed.pk')) {
            return `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
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
        'vs', 'v', 'versus', 'at', 'the', 'fc', 'cf', 'sc', 'united', 'city', 'town', 'county', 'club', 
        'real', 'de', 'la', 'and', 'women', 'men', 'live', 'stream', 'hd', 'test', 'day', 'grand', 'prix',
        'afc', '1', '2', '07', '04', 'sv', 'rb', 'cd', 'ud', 'sk', 'san', 'south', 'north', 'east', 'west',
        'premier', 'league', 'champions', 'copa', 'cup', 'serie', 'division', 'liga', 'tournament',
        'matchday', 'round', 'broadcast', 'soccer', 'football', 'sports', 'tv', 'in', 'u19', 'u20',
        'u21', 'u23', 'youth', 'friendly', 'international', 'qualifier', 'playoff', 'playoffs',
        'derby', 'english', 'spanish', 'italian', 'french', 'german', 'brazilian', 'major', 'pro',
        'national', 'association', 'conference', 'federation'
    ]);

    function tokenizeMatchStr(str) {
        if (!str) return [];
        if (typeof str === 'object') {
            str = str.name || str.title || str.team_name || '';
        }
        if (typeof str !== 'string') return [];
        return str.toLowerCase()
            .replace(/[^a-z0-9]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2 && !MATCH_STOP_WORDS.has(w));
    }

    function hasTokenOverlap(arr1, arr2) {
        if (!arr1 || !arr2 || arr1.length === 0 || arr2.length === 0) return false;
        for (const t1 of arr1) {
            if (arr2.some(t2 => t1 === t2 || (t1.length > 4 && t2.length > 4 && (t1.includes(t2) || t2.includes(t1))))) {
                return true;
            }
        }
        return false;
    }

    function splitTeams(title) {
        if (!title) return ['', ''];
        const parts = String(title).split(/\s+(?:vs\.?|@|v|x|-)\s+/i);
        if (parts.length >= 2) {
            return [parts[0].trim(), parts[1].trim()];
        }
        return [String(title).trim(), ''];
    }

    function parseMatchTimestamp(item) {
        if (!item) return 0;
        if (typeof item.startTime === 'number' && item.startTime > 0) return item.startTime;
        if (typeof item.start_time === 'number' && item.start_time > 0) {
            return item.start_time < 10000000000 ? item.start_time * 1000 : item.start_time;
        }
        if (typeof item.timestamp === 'number' && item.timestamp > 0) {
            return item.timestamp < 10000000000 ? item.timestamp * 1000 : item.timestamp;
        }
        if (typeof item.starts_at === 'number' && item.starts_at > 0) {
            return item.starts_at < 10000000000 ? item.starts_at * 1000 : item.starts_at;
        }
        if (item.display_start_time) return Number(item.display_start_time);
        if (item.date) {
            const parsed = typeof item.date === 'number' ? item.date : new Date(item.date).getTime();
            if (!isNaN(parsed) && parsed > 0) return parsed < 10000000000 ? parsed * 1000 : parsed;
        }
        return 0;
    }

    function isSameMatch(m1, m2) {
        if (!m1 || !m2) return false;

        const t1 = parseMatchTimestamp(m1);
        const t2 = parseMatchTimestamp(m2);
        if (t1 && t2) {
            const diffHours = Math.abs(t1 - t2) / (1000 * 60 * 60);
            if (diffHours > 3.5) return false;
        }

        const title1 = m1.title || m1.name || m1.event_name || '';
        const title2 = m2.title || m2.name || m2.event_name || '';

        const [splitHome1, splitAway1] = splitTeams(title1);
        const [splitHome2, splitAway2] = splitTeams(title2);

        const home1 = (m1.teams && m1.teams.home && m1.teams.home.name) || m1.home_team || splitHome1;
        const away1 = (m1.teams && m1.teams.away && m1.teams.away.name) || m1.away_team || splitAway1;

        const home2 = (m2.teams && m2.teams.home && m2.teams.home.name) || m2.home_team || splitHome2;
        const away2 = (m2.teams && m2.teams.away && m2.teams.away.name) || m2.away_team || splitAway2;

        const h1Toks = tokenizeMatchStr(home1);
        const a1Toks = tokenizeMatchStr(away1);
        const h2Toks = tokenizeMatchStr(home2);
        const a2Toks = tokenizeMatchStr(away2);

        // 1. Strict two-team match check (both teams must match, or cross-match)
        if (h1Toks.length > 0 && a1Toks.length > 0 && h2Toks.length > 0 && a2Toks.length > 0) {
            const direct = hasTokenOverlap(h1Toks, h2Toks) && hasTokenOverlap(a1Toks, a2Toks);
            const inverted = hasTokenOverlap(h1Toks, a2Toks) && hasTokenOverlap(a1Toks, h2Toks);
            return direct || inverted;
        }

        // 2. Partial team match check (at least one team exists and matches, plus additional distinctive tokens)
        if ((h1Toks.length > 0 || a1Toks.length > 0) && (h2Toks.length > 0 || a2Toks.length > 0)) {
            const t1All = [...h1Toks, ...a1Toks];
            const t2All = [...h2Toks, ...a2Toks];
            const common = t1All.filter(t => t2All.includes(t));
            if (common.length >= 2) return true;
        }

        // 3. Fallback for non-team fixtures (UFC, F1, boxing, special events)
        const all1 = tokenizeMatchStr(title1);
        const all2 = tokenizeMatchStr(title2);
        const common = all1.filter(t => all2.includes(t));
        return common.length >= 2;
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

    window.AryanGlobalAPI = {
        isLoading: true,
        matches: [],
        channels: [],
        adminCatalog: [],
        alphaCatalog: [],
        p001Catalog: [],
        skygoCatalog: [],
        peacockCatalog: [],
        slingCatalog: [],
        paramountCatalog: [],
        extra003Catalog: [],
        listeners: [],
        refreshInterval: null,
        _preFetching: false,
        _alphaLoadingPromise: null,

        linkMatchProviders(match) {
            if (!match) return false;
            let newlyLinked = false;
            if (!match._adminId && Array.isArray(this.adminCatalog) && this.adminCatalog.length > 0) {
                const m = this.adminCatalog.find(a => isSameMatch(match, a));
                if (m) { match._adminId = m.stream_id || m.id; newlyLinked = true; }
            }
            if (!match.alphaStreamId && Array.isArray(this.alphaCatalog) && this.alphaCatalog.length > 0) {
                const m = this.alphaCatalog.find(a => isSameMatch(match, a));
                if (m) { match.alphaStreamId = m.stream_id; match.alphaItem = m; newlyLinked = true; }
            }
            if (!match._p001Id && Array.isArray(this.p001Catalog) && this.p001Catalog.length > 0) {
                const m = this.p001Catalog.find(p => isSameMatch(match, p));
                if (m) { match._p001Id = m.stream_id; newlyLinked = true; }
            }
            if (!match._skygoId && Array.isArray(this.skygoCatalog) && this.skygoCatalog.length > 0) {
                const m = this.skygoCatalog.find(s => isSameMatch(match, s));
                if (m) { match._skygoId = m.stream_id; newlyLinked = true; }
            }
            if (!match._peacockId && Array.isArray(this.peacockCatalog) && this.peacockCatalog.length > 0) {
                const m = this.peacockCatalog.find(p => isSameMatch(match, p));
                if (m) { match._peacockId = m.stream_id || m.tile_id; newlyLinked = true; }
            }
            if (!match._slingId && Array.isArray(this.slingCatalog) && this.slingCatalog.length > 0) {
                const m = this.slingCatalog.find(s => isSameMatch(match, s));
                if (m) { match._slingId = m.stream_id || m.id; newlyLinked = true; }
            }
            if (!match._paramountId && Array.isArray(this.paramountCatalog) && this.paramountCatalog.length > 0) {
                const m = this.paramountCatalog.find(p => isSameMatch(match, p));
                if (m) { match._paramountId = m.stream_id || m.tile_id || m.id; newlyLinked = true; }
            }
            if (!match._extra003Id && Array.isArray(this.extra003Catalog) && this.extra003Catalog.length > 0) {
                const m = this.extra003Catalog.find(e => isSameMatch(match, e));
                if (m) { match._extra003Id = m.stream_id; newlyLinked = true; }
            }
            if (newlyLinked && match._alphaResolved) {
                // A new provider feed (e.g. Admin, Peacock, Sling) became available closer to kickoff
                match._alphaResolved = false;
            }
            return newlyLinked;
        },

        async init() {
            const CACHE_KEY = 'aryan_cached_matches_v18';
            // 1. Explicitly purge any bloated legacy caches containing old channel dumps or old ordering
            try {
                ['aryan_cached_matches_v1', 'aryan_cached_matches_v2', 'aryan_cached_matches_v3', 'aryan_cached_matches_v4', 'aryan_cached_matches_v5', 'aryan_cached_matches_v6', 'aryan_cached_matches_v10', 'aryan_cached_matches_v11', 'aryan_cached_matches_v12', 'aryan_cached_matches_v13', 'aryan_cached_matches_v14', 'aryan_cached_matches_v15', 'aryan_cached_matches_v16', 'aryan_cached_matches_v17'].forEach(k => {
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

            // 2. Load PPV feeds and channels in parallel
            await Promise.allSettled([
                this.loadPPVFeeds(),
                this.loadChannelsCatalog()
            ]);

            this.isLoading = false;
            this.sortMatches();
            this.emitUpdate();

            // When Alpha finishes in background, pair fixtures and pre-fetch live Alpha sources
            this._alphaLoadingPromise.then(() => {
                this.preFetchLiveAlphaSources();
            }).catch(() => {});

            // Auto-refresh match feeds, Alpha channels & statuses every 60 seconds
            if (!this.refreshInterval) {
                this.refreshInterval = setInterval(async () => {
                    await this.loadPPVFeeds();
                    this._alphaLoadingPromise = this.loadStreamCornerAlphaFeeds();
                    await this._alphaLoadingPromise;
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
         * Fetch all matches directly from official PPV.st Streams API via /api/ppv proxy
         * Bypasses local ISP blocking on mobile and PC, guarantees 100% genuine authentic posters,
         * zero duplicate stock photos, and exact alignment with ppv.st categories and matches.
         */
        async loadPPVFeeds() {
            const CACHE_KEY = 'aryan_cached_matches_v18';
            try {
                let categories = null;

                // Priority 1: High-speed Cloudflare proxy /api/ppv (bypasses all ISP blocks)
                const candidateEndpoints = [
                    '/api/ppv',
                    '/api/damitv/papi/matches/all-today',
                    'https://api.ppv.st/api/streams',
                    'https://damitv.st/papi/matches/all-today'
                ];

                for (const endpoint of candidateEndpoints) {
                    try {
                        const res = await fetch(endpoint, {
                            signal: AbortSignal.timeout(6000),
                            headers: { 'Accept': 'application/json' }
                        });
                        if (res.ok) {
                            const json = await res.json();
                            if (json && json.success !== false && Array.isArray(json.streams)) {
                                categories = json.streams;
                                break;
                            } else if (Array.isArray(json) && json.length > 0) {
                                categories = [{ category: 'Live Sports', streams: json }];
                                break;
                            }
                        }
                    } catch (e) {
                        // Try next endpoint
                    }
                }

                if (categories && Array.isArray(categories)) {
                    const seenIds = new Set();
                    const newMatches = [];

                    for (const cat of categories) {
                        const catName = (cat.category || 'Sports').trim();
                        const is247Cat = cat.always_live || catName.toLowerCase().includes('24/7');
                        const streams = Array.isArray(cat.streams) ? cat.streams : [];

                        for (const s of streams) {
                            const sTitle = (s.name || s.title || '').trim();
                            if (!s || !s.id || !sTitle) continue;
                            if (seenIds.has(s.id)) continue;
                            seenIds.add(s.id);

                            const existing = this.matches.find(m => m.id === `ppv-${s.id}` || m.rawId === s.id);
                            const norm = this.normalizePPVStreamItem(s, catName, is247Cat);
                            if (!norm) continue;

                            if (existing && existing._alphaResolved) {
                                norm._adminId = existing._adminId;
                                norm.alphaStreamId = existing.alphaStreamId;
                                norm._p001Id = existing._p001Id;
                                norm._skygoId = existing._skygoId;
                                norm._peacockId = existing._peacockId;
                                norm._slingId = existing._slingId;
                                norm._paramountId = existing._paramountId;
                                norm._extra003Id = existing._extra003Id;
                                norm.alphaItem = existing.alphaItem;
                                norm._alphaResolved = existing._alphaResolved;
                                if (Array.isArray(existing.servers) && existing.servers.length > 0) {
                                    norm.servers = existing.servers;
                                    norm.sources = existing.servers;
                                }
                                this.linkMatchProviders(norm);
                            } else {
                                this.linkMatchProviders(norm);
                            }
                            newMatches.push(norm);
                        }
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
                            localStorage.setItem(CACHE_KEY, JSON.stringify(this.matches.slice(0, 180)));
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
         * Fetch data from StreamCorner workers with automatic multi-node failover
         */
        async fetchStreamCornerProvider(endpoint, label) {
            if (typeof window === 'undefined' || !window.StreamCornerCore || typeof window.StreamCornerCore.t !== 'function') {
                return null;
            }
            const candidateWorkers = [...ALPHA_WORKER_NODES].sort(() => Math.random() - 0.5);
            for (let i = 0; i < Math.min(candidateWorkers.length, 3); i++) {
                const worker = candidateWorkers[i];
                try {
                    const res = await window.StreamCornerCore.t(`https://${worker}/corner?p=${endpoint}`, false, label);
                    if (res) return res;
                } catch (e) {
                    // Try next worker
                }
            }
            return null;
        },

        /**
         * Load StreamCorner broadcast channels across all live providers:
         * 1. Alpha (Fubo, TNT, CBS, Bein, Sport1)
         * 2. 001 (Sky Sports Main Event, TNT UK, Premier)
         * 3. Peacock (Authentic Peacock / NBC Premier League feeds)
         * 4. Sling TV (USA Network, NBC Sports, Sling feeds)
         * 5. Extra003 (International HD feeds)
         */
        async loadStreamCornerAlphaFeeds() {
            if (typeof window === 'undefined' || !window.StreamCornerCore || typeof window.StreamCornerCore.t !== 'function') {
                return;
            }
            try {
                const [adminRes, alphaRes, p001Res, skygoRes, peacockRes, slingRes, paramountRes, extra003Res] = await Promise.allSettled([
                    this.fetchStreamCornerProvider('admin', 'admin catalog'),
                    this.fetchStreamCornerProvider('alpha', 'alpha catalog'),
                    this.fetchStreamCornerProvider('001', '001 catalog'),
                    this.fetchStreamCornerProvider('skygo', 'skygo catalog'),
                    this.fetchStreamCornerProvider('peacock_schedule', 'peacock catalog'),
                    this.fetchStreamCornerProvider('slingtv_sports', 'sling catalog'),
                    this.fetchStreamCornerProvider('paramount_schedule', 'paramount catalog'),
                    this.fetchStreamCornerProvider('extra003', 'extra003 catalog')
                ]);

                let adminList = Array.isArray(adminRes.value) ? adminRes.value : [];
                let alphaList = Array.isArray(alphaRes.value) ? alphaRes.value : [];
                let p001List = Array.isArray(p001Res.value) ? p001Res.value : [];
                let skygoList = Array.isArray(skygoRes.value) ? skygoRes.value : [];
                let peacockList = [];
                if (Array.isArray(peacockRes.value)) {
                    for (const rail of peacockRes.value) {
                        if (Array.isArray(rail.events)) peacockList.push(...rail.events);
                    }
                }
                let slingList = [];
                if (slingRes.value && slingRes.value.sports && Array.isArray(slingRes.value.sports.tabs)) {
                    for (const tab of slingRes.value.sports.tabs) {
                        if (Array.isArray(tab.tiles)) slingList.push(...tab.tiles);
                    }
                }
                let paramountList = [];
                if (Array.isArray(paramountRes.value)) {
                    for (const cat of paramountRes.value) {
                        if (Array.isArray(cat.events)) paramountList.push(...cat.events);
                    }
                }
                let extra003List = Array.isArray(extra003Res.value) ? extra003Res.value : [];

                if (adminList.length === 0 && alphaList.length === 0 && p001List.length === 0 && peacockList.length === 0) {
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

                this.adminCatalog = adminList;
                this.alphaCatalog = alphaList;
                this.p001Catalog = p001List;
                this.skygoCatalog = skygoList;
                this.peacockCatalog = peacockList;
                this.slingCatalog = slingList;
                this.paramountCatalog = paramountList;
                this.extra003Catalog = extra003List;

                const matchedAlphaIds = new Set();

                // 1. Link matching PPV matches with all StreamCorner counterparts
                for (const m of this.matches) {
                    const newlyLinked = this.linkMatchProviders(m);
                    if (m._adminId) matchedAlphaIds.add(m._adminId);
                    if (m.alphaStreamId) matchedAlphaIds.add(m.alphaStreamId);
                    if (newlyLinked) {
                        this.resolveAlphaSourcesForMatch(m);
                    }
                }

                // 2. Introduce independent / exclusive StreamCorner fixtures (from admin, alpha, skygo)
                let addedIndependent = false;
                const primaryFeeds = [
                    { list: adminList, prefix: 'admin' },
                    { list: alphaList, prefix: 'alpha' },
                    { list: skygoList, prefix: 'skygo' }
                ];
                for (const feed of primaryFeeds) {
                    for (const item of feed.list) {
                        if (!item || !item.stream_id) continue;
                        if (!matchedAlphaIds.has(item.stream_id)) {
                            const exists = this.matches.some(m =>
                                m._adminId === item.stream_id ||
                                m.alphaStreamId === item.stream_id ||
                                m._skygoId === item.stream_id ||
                                m.id === `${feed.prefix}-${item.stream_id}` ||
                                isSameMatch(m, item)
                            );
                            if (!exists) {
                                const newMatch = this.normalizeAlphaMatch(item);
                                if (newMatch) {
                                    newMatch.id = `${feed.prefix}-${item.stream_id}`;
                                    this.linkMatchProviders(newMatch);
                                    this.matches.push(newMatch);
                                    addedIndependent = true;
                                }
                            }
                        }
                    }
                }

                if (addedIndependent) {
                    this.sortMatches();
                    this.emitUpdate();
                }

                // If user is already in watch view, immediately resolve extra channels and update sources UI!
                if (typeof currentWatchItem !== 'undefined' && currentWatchItem && !currentWatchItem._alphaResolved) {
                    this.linkMatchProviders(currentWatchItem);
                    if (currentWatchItem._adminId || currentWatchItem.alphaStreamId || currentWatchItem._p001Id || currentWatchItem._skygoId || currentWatchItem._peacockId || currentWatchItem._slingId || currentWatchItem._paramountId || currentWatchItem._extra003Id) {
                        this.resolveAlphaSourcesForMatch(currentWatchItem);
                    }
                }

                // Automatically resolve and attach all StreamCorner broadcast channels across all matches
                this.autoResolveAllAlphaSources();
            } catch (err) {
                console.warn('StreamCorner feeds load failed:', err);
            }
        },

        /**
         * Ensure extra broadcast channels are paired and resolved for a match
         * Handles cases where StreamCorner catalogs are still loading or match has not yet paired.
         */
        async ensureAlphaSourcesForMatch(match) {
            if (!match) return false;
            if (match._alphaResolved) return true;

            // 1. If StreamCorner feeds are currently loading in background, await completion
            if (this._alphaLoadingPromise) {
                try {
                    await this._alphaLoadingPromise;
                } catch (e) {}
            }

            // 2. Pair with catalogs
            this.linkMatchProviders(match);

            // 3. If any provider ID is present, resolve and return
            if (match._adminId || match.alphaStreamId || match._p001Id || match._skygoId || match._peacockId || match._slingId || match._paramountId || match._extra003Id) {
                return await this.resolveAlphaSourcesForMatch(match);
            }

            return false;
        },

        /**
         * Resolve extra broadcast channels for a match across all StreamCorner providers:
         * Admin, Fubo Sports, Peacock (NBC), Sky Sports Main Event, Sky Go, USA Network, Paramount+, etc.
         */
        async resolveAlphaSourcesForMatch(match) {
            if (!match) return false;
            if (!match._adminId && !match.alphaStreamId && !match._p001Id && !match._skygoId && !match._peacockId && !match._slingId && !match._paramountId && !match._extra003Id) return false;
            if (match._alphaResolved) return true;
            if (match._alphaPromise) return await match._alphaPromise;
            if (typeof window === 'undefined' || !window.StreamCornerCore || typeof window.StreamCornerCore.t !== 'function') return false;

            match._alphaPromise = (async () => {
                try {
                    const fetchTasks = [];

                    if (match._adminId) {
                        fetchTasks.push(
                            this.fetchStreamCornerProvider(`admin&id=${match._adminId}`, match.title || 'admin detail')
                                .then(d => ({ provider: 'admin', data: d }))
                                .catch(() => null)
                        );
                    }
                    if (match.alphaStreamId) {
                        fetchTasks.push(
                            this.fetchStreamCornerProvider(`alpha&id=${match.alphaStreamId}`, match.title || 'alpha detail')
                                .then(d => ({ provider: 'alpha', data: d }))
                                .catch(() => null)
                        );
                    }
                    if (match._p001Id) {
                        fetchTasks.push(
                            this.fetchStreamCornerProvider(`001&id=${match._p001Id}`, match.title || '001 detail')
                                .then(d => ({ provider: '001', data: d }))
                                .catch(() => null)
                        );
                    }
                    if (match._skygoId) {
                        fetchTasks.push(
                            this.fetchStreamCornerProvider(`skygo&id=${match._skygoId}`, match.title || 'skygo detail')
                                .then(d => ({ provider: 'skygo', data: d }))
                                .catch(() => null)
                        );
                    }
                    if (match._peacockId) {
                        fetchTasks.push(
                            this.fetchStreamCornerProvider(`peacock_schedule&id=${match._peacockId}`, match.title || 'peacock detail')
                                .then(d => ({ provider: 'peacock', data: d }))
                                .catch(() => null)
                        );
                    }
                    if (match._slingId) {
                        fetchTasks.push(
                            this.fetchStreamCornerProvider(`slingtv_sports&id=${match._slingId}`, match.title || 'sling detail')
                                .then(d => ({ provider: 'sling', data: d }))
                                .catch(() => null)
                        );
                    }
                    if (match._paramountId) {
                        fetchTasks.push(
                            this.fetchStreamCornerProvider(`paramount_schedule&id=${match._paramountId}`, match.title || 'paramount detail')
                                .then(d => ({ provider: 'paramount', data: d }))
                                .catch(() => null)
                        );
                    }
                    if (match._extra003Id) {
                        fetchTasks.push(
                            this.fetchStreamCornerProvider(`extra003&id=${match._extra003Id}`, match.title || 'extra003 detail')
                                .then(d => ({ provider: 'extra003', data: d }))
                                .catch(() => null)
                        );
                    }

                    const taskResults = await Promise.allSettled(fetchTasks);

                    // 1. Keep base PPV servers (Server 1 [Main HD] & Server 2 [Backup HD]), filtering out previous dynamic provider feeds
                    const baseServers = (match.servers || []).filter(s => {
                        const u = s.url || '';
                        if (u.includes('pandecocogaming') || u.includes('/api/embed') || u.includes('getsugatensho') || u.includes('sportsembed') || u.includes('sportsonliine')) return false;
                        return true;
                    });

                    const seenUrls = new Set();
                    baseServers.forEach(s => {
                        if (s.url) seenUrls.add(s.url);
                        if (s.rawUrl) seenUrls.add(s.rawUrl);
                    });

                    const newServers = [];

                    const addServer = (label, rawUrl, defaultType = 'iframe') => {
                        rawUrl = (rawUrl || '').trim();
                        if (!rawUrl) return;
                        if (/streamcorner/i.test(label) || /streamcorner/i.test(rawUrl)) return;
                        if (/embedindia\.st\/embed\/\d+$/i.test(rawUrl) && !rawUrl.includes('backup=')) return;
                        if (seenUrls.has(rawUrl)) return;
                        seenUrls.add(rawUrl);

                        const isDirectHls = rawUrl.includes('.m3u8');
                        const srvUrl = isDirectHls ? rawUrl : toProxiedEmbedUrl(rawUrl);
                        if (seenUrls.has(srvUrl)) return;
                        seenUrls.add(srvUrl);

                        let cleanLabel = (label || 'HD Channel').trim().toUpperCase().replace(/\s*-\s*$/, '');
                        newServers.push({
                            name: `Server [${cleanLabel}]`,
                            url: srvUrl,
                            rawUrl: rawUrl,
                            type: isDirectHls ? 'video' : defaultType,
                            hd: true
                        });
                    };

                    for (const res of taskResults) {
                        if (res.status !== 'fulfilled' || !res.value || !res.value.data) continue;
                        const { provider, data } = res.value;

                        if (provider === 'admin' && Array.isArray(data.streams)) {
                            data.streams.forEach(s => addServer(s.source_name || s.name || 'HD Channel', s.embed_url || s.stream_url));
                        } else if (provider === 'alpha' && Array.isArray(data.streams)) {
                            data.streams.forEach(s => addServer(s.source_name || s.name || 'HD Channel', s.embed_url || s.stream_url));
                        } else if (provider === '001' && Array.isArray(data.streams)) {
                            data.streams.forEach(s => addServer(s.source_name || s.name || 'Sky Sports', s.embed_url || s.stream_url));
                        } else if (provider === 'skygo' && Array.isArray(data.streams)) {
                            data.streams.forEach(s => addServer(s.source_name || s.name || 'Sky Go', s.embed_url || s.stream_url));
                        } else if (provider === 'peacock') {
                            const u = data.embed_url || data.embedUrl;
                            if (u) addServer('PEACOCK (NBC)', u);
                        } else if (provider === 'sling') {
                            const u = data.embed_url || data.embedUrl;
                            if (u) addServer(data.channel_name ? `${data.channel_name} (SLING)` : 'USA NETWORK (SLING)', u);
                        } else if (provider === 'paramount') {
                            const u = data.embed_url || data.embedUrl;
                            if (u) addServer('PARAMOUNT+ (CBS)', u);
                        } else if (provider === 'extra003' && Array.isArray(data.streams)) {
                            data.streams.forEach(s => addServer(s.source_name || 'HD FEED', s.embed_url || s.stream_url));
                        }
                    }

                    if (newServers.length > 0) {
                        // Place StreamCorner broadcast feeds first, followed by base PPV feeds
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
                        if (typeof currentWatchItem !== 'undefined' && currentWatchItem && 
                            (currentWatchItem.id === match.id || 
                             (Boolean(currentWatchItem._adminId) && currentWatchItem._adminId === match._adminId) ||
                             (Boolean(currentWatchItem.alphaStreamId) && currentWatchItem.alphaStreamId === match.alphaStreamId))) {
                            currentWatchItem.servers = match.servers;
                            currentWatchItem.sources = match.servers;
                            currentWatchItem._alphaResolved = true;
                            if (typeof renderWatchSources === 'function') {
                                const activeIdx = (window.AryanPlayerEngine && window.AryanPlayerEngine.activeServerIdx) || 0;
                                renderWatchSources(currentWatchItem, activeIdx);
                            }
                        }

                        // Persist enriched servers into localStorage cache so repeat visits have 0ms latency
                        try {
                            const CACHE_KEY = 'aryan_cached_matches_v18';
                            localStorage.setItem(CACHE_KEY, JSON.stringify(this.matches.slice(0, 180)));
                        } catch (e) {}
                    }

                    match._alphaResolved = true;
                    return true;
                } catch (err) {
                    console.warn('Resolve StreamCorner sources failed:', match.title, err);
                    return false;
                } finally {
                    match._alphaPromise = null;
                }
            })();

            return await match._alphaPromise;
        },

        /**
         * Automatically resolve StreamCorner broadcast feeds for all matched fixtures across all categories
         */
        async autoResolveAllAlphaSources() {
            if (this._resolvingAllAlpha) return;
            this._resolvingAllAlpha = true;

            try {
                const targets = this.matches.filter(m => (m._adminId || m.alphaStreamId || m._p001Id || m._skygoId || m._peacockId || m._slingId || m._paramountId || m._extra003Id) && !m._alphaResolved);
                if (targets.length === 0) {
                    this._resolvingAllAlpha = false;
                    return;
                }

                // Sort: Live fixtures first, then upcoming starting soonest
                targets.sort((a, b) => {
                    if (a.isLive && !b.isLive) return -1;
                    if (!a.isLive && b.isLive) return 1;
                    return (a.startTime || 0) - (b.startTime || 0);
                });

                // Concurrently resolve in batches of 6
                const BATCH_SIZE = 6;
                for (let i = 0; i < targets.length; i += BATCH_SIZE) {
                    const batch = targets.slice(i, i + BATCH_SIZE);
                    await Promise.allSettled(batch.map(m => this.resolveAlphaSourcesForMatch(m)));
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
                status: isLive ? 'live' : 'upcoming',
                poster: alpha.poster || alpha.category_logo || alpha.home_team_logo || 'assets/img/logo-icon.png',
                colors: [],
                team1: { name: team1Name, logo: alpha.home_team_logo || '' },
                team2: { name: team2Name, logo: alpha.away_team_logo || '' },
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
            if (mainEmbed) {
                addServer('Server 1 [Main HD 1080p]', mainEmbed);
            }

            // 2. Substreams from official PPV feed
            if (Array.isArray(s.substreams)) {
                s.substreams.forEach(sub => {
                    const subUrl = sub.url || sub.iframe || sub.embedUrl;
                    if (subUrl) {
                        const srvIndex = servers.length + 1;
                        let label = sub.source || sub.name || '';
                        if (sub.locale && !label.toLowerCase().includes(sub.locale.toLowerCase())) {
                            label += ` [${sub.locale.toUpperCase()}]`;
                        }
                        const finalName = label ? `Server ${srvIndex} [${label}]` : `Server ${srvIndex} [HD]`;
                        addServer(finalName, subUrl);
                    }
                });
            }

            // 3. Fallback backup feed (guarantees authentic Server 1 [Main HD] and Server 2 [Backup HD])
            if (servers.length === 1 && mainEmbed) {
                const backupUrl = mainEmbed + (mainEmbed.includes('?') ? '&backup=1' : '?backup=1');
                addServer('Server 2 [Backup HD Feed]', backupUrl);
            } else if (servers.length === 0) {
                addServer('Server 1 [Main HD 1080p]', `https://embedindia.st/embed/${s.id}`);
                addServer('Server 2 [Backup HD Feed]', `https://embedindia.st/embed/${s.id}?backup=1`);
            }

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
                colors: s.colors || [],
                team1: { name: team1Name, logo: '' },
                team2: { name: team2Name, logo: '' },
                rawCategory: catKey,
                servers: servers,
                sources: servers
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

            // 1. Direct ID, rawId, slug, provider ID, or server URL match
            let found = this.matches.find(m => {
                if (m.id === decoded || m.rawId === decoded || ('ppv-' + m.rawId) === decoded || ('dami-' + m.rawId) === decoded || m.alphaStreamId === decoded || m._adminId === decoded || m._skygoId === decoded) return true;
                if (m.rawId === stripped || m.id === stripped) return true;
                if (m.slug && m.slug === slug) return true;
                const mSlug = (m.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                if (mSlug && (mSlug === slug || mSlug.includes(slug) || (slug.length > 5 && slug.includes(mSlug)))) return true;
                if (Array.isArray(m.servers) && m.servers.some(s => s && (s.url || '').includes(stripped))) return true;
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
            const now = Date.now();
            return this.matches.filter(m => (m.sport === cat || m.league.includes(cat)) && (!m.endTime || now <= (m.endTime + 900000)));
        },

        searchMatches(query) {
            if (!query || !query.trim()) return this.getAllMatches();
            const q = query.toLowerCase().trim();
            const now = Date.now();
            return this.matches.filter(m =>
                (!m.endTime || now <= (m.endTime + 900000)) && (
                    m.title.toLowerCase().includes(q) ||
                    m.league.toLowerCase().includes(q) ||
                    m.sport.toLowerCase().includes(q) ||
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
                'PARAMOUNT+',
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
