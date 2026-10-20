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
        'data.l0o1afmju0.workers.dev',
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

    const KNOWN_ALPHA_STREAMS = {};

    const MATCH_CACHE_LIMIT = 200;

    function getRandomAlphaWorker() {
        return ALPHA_WORKER_NODES[Math.floor(Math.random() * ALPHA_WORKER_NODES.length)];
    }

    function getCanonicalServerKey(rawUrl) {
        if (!rawUrl || typeof rawUrl !== 'string') return '';
        let u = rawUrl.trim();
        // If wrapped in /api/embed, unwrap it to find root stream identity
        if (u.includes('/api/embed')) {
            try {
                const dummy = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'https://asppv.pages.dev';
                const parsed = new URL(u, dummy);
                const target = parsed.searchParams.get('url');
                if (target) u = target;
            } catch (e) {}
        }
        try {
            const parsed = new URL(u);
            const p = parsed.searchParams.get('p');
            if (p) {
                return `pandeco:${p}`;
            }
            parsed.searchParams.delete('backup');
            parsed.searchParams.delete('bk');
            parsed.searchParams.delete('b');
            parsed.searchParams.delete('player');
            let path = parsed.pathname.replace(/\/+$/, '');
            return `${parsed.hostname.toLowerCase()}${path}${parsed.search ? parsed.search : ''}`;
        } catch (e) {
            return u.replace(/[?&](?:backup|bk|b|player)=[^&]*/gi, '').replace(/\/+$/, '').toLowerCase();
        }
    }

    const INTERNAL_SERVER_NAMES = /^(?:hotel|alpha|beta|golf|admin|delta|echo|streamcorner|internal|node\d*|server\d*|stream\d*|feed\d*|hd|sd|fhd|live|main|backup)\b/i;

    function extractCleanServerLabel(name, rawUrl, idx) {
        if (name && /^FX\s*\d*/i.test(name.trim())) {
            return name.trim();
        }
        let label = '';
        if (name) {
            const bracketMatch = name.match(/\[(.*?)\]/);
            if (bracketMatch && bracketMatch[1]) {
                label = bracketMatch[1].trim();
            } else {
                label = name.replace(/^server\s*\d*\s*[-:]*\s*/i, '')
                            .replace(/^stream\s*\d*\s*[-:]*\s*/i, '')
                            .replace(/^feed\s*\d*\s*[-:]*\s*/i, '')
                            .trim();
            }
        }

        // Clean redundant fake quality tags, brackets, and trailing hyphens
        label = label.replace(/[\(\[\{]?\s*(?:1080p|720p|480p|fhd|hd|sd|uhd|4k)\s*[\)\]\}]?/gi, '')
                     .replace(/\s*-\s*$/, '')
                     .trim();

        // Discard internal cluster names or pure quality labels
        const cleanNoPunct = label.replace(/^[^\w]+|[^\w]+$/g, '');
        if (!label || 
            /^[\(\[\{]?\s*(?:hotel|alpha|beta|golf|admin|delta|echo|streamcorner|hd|sd|fhd|uhd|4k|server\s*\d*|stream\s*\d*|feed\s*\d*|main|backup)?\s*[\)\]\}]?$/i.test(label) ||
            INTERNAL_SERVER_NAMES.test(cleanNoPunct) ||
            /^(?:hotel|alpha|beta|golf|admin|delta|echo|streamcorner)$/i.test(cleanNoPunct)) {
            label = '';
        }

        const lLower = label.toLowerCase();
        if (lLower.includes('fubo')) {
            label = 'Fubo Sports';
        } else if (lLower.includes('peacock')) {
            label = 'Peacock';
        } else if (lLower.includes('tsn')) {
            const num = label.match(/\b\d\b/);
            label = num ? `TSN ${num[0]}` : 'TSN Sports';
        } else if (lLower.includes('caze')) {
            label = 'Cazé TV';
        } else if (lLower.includes('willow')) {
            label = lLower.includes('alt') ? 'Willow Alt' : 'Willow Cricket';
        } else if (lLower.includes('bein')) {
            if (lLower.includes('eng')) label = 'beIN Sports (English)';
            else if (lLower.includes('esp') || lLower.includes('span')) label = 'beIN Sports (Spanish)';
            else if (lLower.includes('fr')) label = 'beIN Sports (French)';
            else if (lLower.includes('ar') && !lLower.includes('bar')) label = 'beIN Sports (Arabic)';
            else if (lLower.includes('3') && lLower.includes('au')) label = 'beIN Sports 3 AU';
            else if (lLower.includes('au')) label = 'beIN Sports AU';
            else if (/\b\d\b/.test(label)) label = `beIN Sports ${label.match(/\b\d\b/)[0]}`;
            else label = 'beIN Sports';
        } else if (lLower.includes('fox')) {
            if (lLower.includes('1') || lLower.includes('fs1')) label = 'FS1';
            else if (lLower.includes('2') || lLower.includes('fs2')) label = 'FS2';
            else label = 'FOX Sports';
        } else if (lLower.includes('sky')) {
            const itNum = label.match(/25\d/);
            if (itNum) {
                label = `Sky Sport ${itNum[0]} (Italy)`;
            } else if (lLower.includes('calcio')) {
                label = 'Sky Sport Calcio (Italy)';
            } else if (lLower.includes('arena')) {
                label = 'Sky Sport Arena (Italy)';
            } else if (lLower.includes('main')) {
                label = 'Sky Sports Main Event';
            } else if (lLower.includes('prem')) {
                label = 'Sky Sports Premier League';
            } else if (lLower.includes('f1')) {
                label = 'Sky Sports F1';
            } else if (lLower.includes('foot')) {
                label = 'Sky Sports Football';
            } else if (lLower.includes('crick')) {
                label = 'Sky Sports Cricket';
            } else if (lLower.includes('it') || lLower.includes('ital')) {
                label = 'Sky Sport (Italy)';
            } else {
                label = 'Sky Sports';
            }
        } else if (lLower.includes('tnt')) {
            const num = label.match(/\b\d\b/);
            const feed = label.match(/feed\s*(\d+)/i);
            const base = num ? `TNT Sports ${num[0]}` : 'TNT Sports';
            label = feed ? `${base} (Feed ${feed[1]})` : base;
        } else if (lLower.includes('vix')) {
            label = 'VIX Español';
        } else if (lLower.includes('champions league') || lLower.includes('ucl')) {
            label = 'Champions League (English)';
        } else if (lLower.includes('espn')) {
            if (lLower.includes('2')) label = 'ESPN 2';
            else if (lLower.includes('ar')) label = 'ESPN AR';
            else if (lLower.includes('dep') || lLower.includes('span')) label = 'ESPN Deportes';
            else if (lLower.includes('plus') || lLower.includes('+')) label = 'ESPN+';
            else label = 'ESPN';
        } else if (lLower.includes('fancode')) {
            label = 'FanCode';
        } else if (lLower.includes('cbs')) {
            label = 'CBS Sports';
        } else if (lLower.includes('paramount')) {
            const num = label.match(/\b\d\b/);
            label = num ? `Paramount+ ${num[0]}` : 'Paramount+';
        } else if (lLower.includes('sportv')) {
            const num = label.match(/\b\d\b/);
            label = num ? `SporTV ${num[0]}` : 'SporTV';
        } else if (lLower.includes('star sports') || lLower.includes('star')) {
            label = lLower.includes('hin') ? 'Star Sports Hindi' : 'Star Sports';
        } else if (lLower.includes('tve') || lLower.includes('la 1') || lLower.includes('la1')) {
            label = 'TVE La 1';
        } else if (lLower.includes('movistar')) {
            label = 'Movistar+';
        } else if (lLower.includes('dazn')) {
            label = 'DAZN';
        } else if (lLower.includes('optus')) {
            label = 'Optus Sport';
        } else if (lLower.includes('sony') || lLower.includes('ten')) {
            label = 'Sony Sports';
        } else if (lLower.includes('supersport')) {
            label = 'SuperSport';
        } else if (lLower.includes('canal')) {
            label = 'Canal+';
        } else if (lLower.includes('hotstar')) {
            label = 'Hotstar';
        } else if (lLower.includes('fandango')) {
            label = 'Fandango';
        }

        const u = (rawUrl || '').toLowerCase();
        if (!label || /^[\(\[\{]?\s*(?:hd|sd|fhd|server\s*\d*|stream\s*\d*|feed\s*\d*)\s*[\)\]\}]?$/i.test(label) || INTERNAL_SERVER_NAMES.test(cleanNoPunct)) {
            if (u.includes('willow')) label = u.includes('alt') ? 'Willow Alt' : 'Willow Cricket';
            else if (u.includes('sky')) label = 'Sky Sports';
            else if (u.includes('bein')) label = 'beIN Sports';
            else if (u.includes('tsn')) label = 'TSN Sports';
            else if (u.includes('fox')) label = 'FOX Sports';
            else if (u.includes('espn')) label = 'ESPN';
            else if (u.includes('tnt')) label = 'TNT Sports';
            else if (u.includes('paramount')) label = 'Paramount+';
            else if (u.includes('cbs')) label = 'CBS Sports';
            else if (u.includes('fancode')) label = 'FanCode';
            else if (u.includes('tve')) label = 'TVE';
            else if (u.includes('canal')) label = 'Canal+';
            else if (u.includes('hotstar')) label = 'Hotstar';
            else if (u.includes('star')) label = 'Star Sports';
            else if (u.includes('sony')) label = 'Sony Sports';
            else if (u.includes('optus')) label = 'Optus Sport';
            else if (u.includes('dazn')) label = 'DAZN';
            else if (u.includes('fandango')) label = 'Fandango';
            else if (idx === 0) label = 'Main Server';
            else if (idx === 1) label = 'Server 2';
            else label = `Server ${idx + 1}`;
        }

        return label;
    }

    function toProxiedEmbedUrl(rawUrl) {
        if (!rawUrl) return '';
        if (rawUrl.includes('shaka_player.html')) return rawUrl;
        if (rawUrl.startsWith('/api/embed') || rawUrl.includes('/api/embed')) return rawUrl;
        // Direct DASH stream with keys should use local static shaka_player with 0 Cloudflare requests
        if (rawUrl.includes('.mpd')) {
            let kid = '';
            let key = '';
            try {
                const u = new URL(rawUrl);
                kid = u.searchParams.get('kid') || '';
                key = u.searchParams.get('key') || '';
            } catch (e) {
                const mKid = rawUrl.match(/[?&]kid=([a-fA-F0-9]+)/i);
                const mKey = rawUrl.match(/[?&]key=([a-fA-F0-9]+)/i);
                if (mKid) kid = mKid[1];
                if (mKey) key = mKey[1];
            }
            if (kid && key) {
                return `shaka_player.html?mpd=${encodeURIComponent(rawUrl)}&kid=${encodeURIComponent(kid)}&key=${encodeURIComponent(key)}`;
            }
            return `shaka_player.html?mpd=${encodeURIComponent(rawUrl)}`;
        }
        if (rawUrl.includes('pandecocogaming.sbs') || rawUrl.includes('getsugatensho.sbs') || rawUrl.includes('sportsembed.')) {
            try {
                const u = new URL(rawUrl);
                const p = u.searchParams.get('p');
                if (p) {
                    return `/api/embed?p=${encodeURIComponent(p)}&url=${encodeURIComponent(rawUrl)}`;
                }
            } catch (e) {}
            return `/api/embed?url=${encodeURIComponent(rawUrl)}`;
        }
        return rawUrl;
    }

    function cleanMatchStr(str) {
        if (!str || typeof str !== 'string') return '';
        return str.normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[øØ]/g, 'o')
            .replace(/[æÆ]/g, 'ae')
            .replace(/[ß]/g, 'ss')
            .toLowerCase()
            .trim();
    }

    function sanitizePosterUrl(url) {
        if (!url || typeof url !== 'string') return '';
        url = url.trim();
        if (!url || url.includes('logo-icon.png') || url.includes('poocloud.in')) return '';
        if (url.includes('serveproxy.com') || url.includes('wsrv.nl/?url=')) return url;
        if (url.startsWith('/api/images') || url.startsWith('/images') || url.startsWith('api/images')) {
            url = 'https://streamed.pk/' + url.replace(/^\/+/, '');
        } else if (url.startsWith('/img/')) {
            url = 'https://damitv.st' + url;
        }
        if (url.includes('streamed.pk') || url.includes('static.ppvservices.st')) {
            return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=480&output=webp`;
        }
        return url;
    }

    function sanitizeLogoUrl(url) {
        if (!url || typeof url !== 'string') return '';
        url = url.trim();
        if (!url || url.includes('logo-icon.png') || url.includes('poocloud.in')) return '';
        if (url.includes('serveproxy.com') || url.includes('wsrv.nl/?url=')) return url;
        if (url.includes('sofascore.com')) {
            return `https://serveproxy.com/?url=${encodeURIComponent(url)}`;
        }
        if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('//') && !url.startsWith('assets/')) {
            if (url.startsWith('/api/images') || url.startsWith('/images')) {
                url = 'https://streamed.pk/' + url.replace(/^\/+/, '');
            } else if (url.startsWith('/img/')) {
                url = 'https://damitv.st' + url;
            } else if (/^[a-zA-Z0-9_\-=+]{20,}$/.test(url)) {
                url = `https://streamed.pk/api/images/proxy/${encodeURIComponent(url)}.webp`;
            }
        }
        if (url.includes('streamed.pk') || url.includes('static.ppvservices.st')) {
            return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=140&output=webp`;
        }
        return url;
    }

    function prioritizeFxServers(servers) {
        if (!Array.isArray(servers) || servers.length <= 1) return servers || [];
        const isFx = (s) => Boolean(s && (s.isFutbolX || /^FX\s*\d*/i.test(s.name || '') || (s.url && s.url.includes('futbolx')) || (s.rawUrl && s.rawUrl.includes('futbolx')) || (s.url && s.url.includes('ryzn.pro')) || (s.rawUrl && s.rawUrl.includes('ryzn.pro'))));
        const fxList = [];
        const otherList = [];
        for (const s of servers) {
            if (isFx(s)) fxList.push(s);
            else otherList.push(s);
        }
        return [...fxList, ...otherList];
    }

    function sanitizeMatchServers(match) {
        if (!match) return match;
        if (match.poster) {
            match.poster = sanitizePosterUrl(match.poster);
        }
        if (!Array.isArray(match.servers)) return match;
        const clean = [];
        const seenKeys = new Set();
        for (const s of match.servers) {
            if (!s || (!s.url && !s.rawUrl && !s.embedUrl)) continue;
            const targetUrl = s.rawUrl || s.url || s.embedUrl;
            // Drop any unwanted broadcast TV channel dumps (embedindia.st/embed/<numeric_id>)
            if (/embedindia\.st\/embed\/\d+$/i.test(targetUrl) && !targetUrl.includes('backup=')) {
                continue;
            }
            // Eliminate duplicate original, ?backup=1, and proxied variants
            const key = getCanonicalServerKey(targetUrl);
            if (key && seenKeys.has(key)) continue;
            if (key) seenKeys.add(key);

            clean.push(s);
        }

        // Re-index server names preserving genuine broadcaster and source labels
        clean.forEach((s, idx) => {
            const raw = s.rawUrl || s.url || '';
            const label = extractCleanServerLabel(s.name, raw, idx);
            s.name = label;
        });

        // Disambiguate duplicate names (e.g. multiple Paramount+, TNT Sports, etc.)
        const nameCounts = {};
        clean.forEach(s => {
            nameCounts[s.name] = (nameCounts[s.name] || 0) + 1;
        });
        const nameCurrent = {};
        clean.forEach(s => {
            if (nameCounts[s.name] > 1) {
                nameCurrent[s.name] = (nameCurrent[s.name] || 0) + 1;
                s.name = `${s.name} ${nameCurrent[s.name]}`;
            }
        });

        const sorted = prioritizeFxServers(clean);
        match.servers = sorted;
        match.sources = sorted;
        return match;
    }

    const STATIC_SPORT_GROUPS = {
        'FOOTBALL': ['FOOTBALL', 'SOCCER', 'UEFA', 'FIFA', 'LALIGA', 'PREMIER', 'BUNDESLIGA', 'SERIE', 'LIGUE', 'EREDIVISIE', 'BRASILEIRÃO', 'BRASILEIRAO', 'LIGA', 'CHAMPIONS', 'UCL', 'AFCON', 'COPA', 'ASIAN', 'CONCACAF', 'WOMENS', 'WOMEN', 'MLS', 'CPL', 'CANADIAN PREMIER LEAGUE', 'EFL', 'CHAMPIONSHIP'],
        'AMERICAN FOOTBALL': ['AMERICAN FOOTBALL', 'CFL', 'NFL', 'CFB', 'NCAA FOOTBALL'],
        'CRICKET': ['CRICKET', 'ASIAN GAMES', 'CPL', 'IPL', 'T20', 'ODI', 'TEST', 'BBL', 'PSL', 'THE HUNDRED', 'WCL', 'WORLD CHAMPIONSHIP OF LEGENDS'],
        'COMBAT SPORTS': ['COMBAT SPORTS', 'UFC', 'MMA', 'BOXING', 'FIGHTS', 'FIGHTING', 'FIGHT', 'WWE', 'AEW', 'WRESTLING', 'BELLATOR', 'ONE FC', 'RIZIN', 'BKFC', 'JUDO', 'BJJ'],
        'MOTORSPORTS': ['MOTORSPORTS', 'MOTORSPORT', 'F1', 'MOTOGP', 'FORMULA', 'FORMULA 1', 'NASCAR', 'RALLY', 'RACING', 'WORLDSBK', 'WORLDSSP', 'SUPERBIKE', 'INDYCAR', 'LE MANS'],
        'BASEBALL': ['BASEBALL', 'MLB', 'NPB', 'KBO'],
        'BASKETBALL': ['BASKETBALL', 'NBA', 'WNBA', 'NBL', 'EUROLEAGUE', 'NCAA BASKETBALL'],
        'HOCKEY': ['HOCKEY', 'ICE HOCKEY', 'NHL', 'KHL', 'SHL', 'IIHF'],
        'RUGBY': ['RUGBY', 'NRL', 'AFL', 'AUSTRALIAN FOOTBALL', 'SUPER RUGBY', 'SIX NATIONS'],
        'TENNIS': ['TENNIS', 'ATP', 'WTA', 'GRAND SLAM', 'WIMBLEDON', 'US OPEN', 'AUSTRALIAN OPEN', 'ROLAND GARROS', 'DAVIS CUP'],
        'CYCLING': ['CYCLING', 'BMX', 'CYCLO-CROSS', 'TOUR DE FRANCE', 'GIRO', 'VUELTA'],
        'SNOOKER': ['SNOOKER', 'POOL', 'DARTS'],
        '24/7 STREAMS': ['24/7', 'CHANNELS', 'LIVE TV', 'STREAM']
    };

    function normalizeSport(str) {
        if (!str || typeof str !== 'string') return '';
        const sUpper = str.trim().toUpperCase();
        for (const [canonical, aliases] of Object.entries(STATIC_SPORT_GROUPS)) {
            if (sUpper === canonical || sUpper.includes(canonical)) return canonical;
            if (aliases.some(a => sUpper === a || sUpper.includes(a) || a.includes(sUpper))) {
                return canonical;
            }
        }
        return (typeof SPORT_MAPPINGS !== 'undefined' && SPORT_MAPPINGS[str.toLowerCase()]) ? SPORT_MAPPINGS[str.toLowerCase()] : sUpper;
    }

    const GENERIC_TEAM_WORDS = new Set([
        'fc', 'cf', 'sc', 'cd', 'ud', 'sk', 'sv', 'rb', 'afc', 'ac', 'as', 'ss',
        'fk', 'rc', 'cp', 'fem', 'feminine', 'feminin', 'damen',
        'united', 'city', 'town', 'county', 'club', 'athletic', 'athletics',
        'state', 'tech', 'st', 'univ', 'university', 'college',
        'women', 'womens', 'men', 'mens', 'u17', 'u18', 'u19', 'u20', 'u21', 'u23', 'reserves',
        'hawks', 'tigers', 'wildcats', 'bulldogs', 'panthers', 'eagles', 'lions', 'bears',
        'cougars', 'warriors', 'knights', 'cardinals', 'rams', 'falcons', 'hornets', 'saxons',
        'vs', 'v', 'at', 'the', 'and', 'de', 'la', 'san', 'south', 'north', 'east', 'west',
        'red', 'blue', 'green', 'white', 'black', 'gold', 'yellow'
    ]);

    const TEAM_ALIASES = {
        'czech republic': 'czechia',
        'czech': 'czechia',
        'praha': 'prague',
        'slavia praha': 'slavia prague',
        'sporting cp': 'sporting',
        'sporting lisbon': 'sporting',
        'rc lens': 'lens',
        'sabah fk': 'sabah',
        'wien': 'vienna',
        'austria wien': 'austria vienna',
        'man utd': 'manchester united',
        'manchester utd': 'manchester united',
        'spurs': 'tottenham',
        'wolves': 'wolverhampton',
        'bayern munchen': 'bayern munich',
        'bayern muenchen': 'bayern munich',
        'inter milan': 'internazionale',
        'inter': 'internazionale',
        'ac milan': 'milan',
        'psg': 'paris saint germain',
        'paris sg': 'paris saint germain',
        'atletico': 'atletico madrid',
        'real': 'real madrid',
        'barca': 'barcelona',
        'brighton': 'brighton hove albion',
        'newcastle': 'newcastle united',
        'sheffield': 'sheffield united',
        'west ham': 'west ham united',
        'la lakers': 'los angeles lakers',
        'la clippers': 'los angeles clippers',
        'gs warriors': 'golden state warriors',
        'ny knicks': 'new york knicks',
        'okc thunder': 'oklahoma city thunder'
    };

    function normalizeTeamName(str) {
        if (!str) return '';
        let s = cleanMatchStr(str).replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
        for (const [k, v] of Object.entries(TEAM_ALIASES)) {
            const re = new RegExp('\\b' + k + '\\b', 'g');
            s = s.replace(re, v);
        }
        return s.trim();
    }

    function getDistinctiveTokens(name) {
        return normalizeTeamName(name)
            .split(/\s+/)
            .filter(w => w.length >= 3 && !GENERIC_TEAM_WORDS.has(w));
    }

    function matchTeams(teamA, teamB) {
        if (!teamA || !teamB) return false;
        const cA = normalizeTeamName(teamA).replace(/\s+/g, '');
        const cB = normalizeTeamName(teamB).replace(/\s+/g, '');
        if (cA && cB && cA === cB) return true;
        if (cA.length >= 5 && cB.length >= 5 && (cA.includes(cB) || cB.includes(cA))) return true;

        const toksA = getDistinctiveTokens(teamA);
        const toksB = getDistinctiveTokens(teamB);
        if (toksA.length === 0 || toksB.length === 0) return false;

        return toksA.some(a => toksB.includes(a));
    }

    function isSameMatch(ppv, alpha) {
        if (!ppv || !alpha) return false;

        const pTitle = ppv.title || ppv.name || '';
        const aTitle = alpha.event_name || alpha.title || '';

        // Immediate direct clean string match
        const cleanP = (pTitle.split(/[|\[]/)[0] || pTitle).trim();
        const cleanA = (aTitle.split(/[|\[]/)[0] || aTitle).trim();
        const cP = cleanMatchStr(cleanP).replace(/[^a-z0-9]/g, '');
        const cA = cleanMatchStr(cleanA).replace(/[^a-z0-9]/g, '');
        if (cP && cA && cP === cA) return true;
        if (cP.length >= 8 && cA.length >= 8 && (cP.includes(cA) || cA.includes(cP))) return true;

        // 1. Sport & Category compatibility check
        const pSport = normalizeSport(ppv.sport || ppv.category || ppv.catName || ppv.league || '');
        const aSport = normalizeSport(alpha.sport || alpha.category || alpha.league || '');

        if (pSport && aSport && pSport !== 'OTHERS' && aSport !== 'OTHERS' && pSport !== aSport) {
            return false;
        }

        // 2. Start time proximity check (within 8 hours)
        const ppvTime = ppv.startTime || (typeof ppv.date === 'number' ? ppv.date : (new Date(ppv.date).getTime() || 0));
        const alphaTime = (alpha.timestamp ? alpha.timestamp * 1000 : 0) || alpha.startTime || (typeof alpha.date === 'number' ? alpha.date : (new Date(alpha.date).getTime() || 0));
        if (ppvTime && alphaTime) {
            const diffHours = Math.abs(ppvTime - alphaTime) / (1000 * 60 * 60);
            if (diffHours > 8) return false;
        }

        const pParts = cleanP.split(/\s+(?:vs\.?|@|v\.?|-|x)\s+/i);
        const aParts = cleanA.split(/\s+(?:vs\.?|@|v\.?|-|x)\s+/i);

        let pHome = (ppv.team1 && ppv.team1.name) || (ppv.teams && ppv.teams.home && ppv.teams.home.name) || ppv.home_team || (pParts.length >= 2 ? pParts[0] : '');
        let pAway = (ppv.team2 && ppv.team2.name) || (ppv.teams && ppv.teams.away && ppv.teams.away.name) || ppv.away_team || (pParts.length >= 2 ? pParts[1] : '');

        let aHome = alpha.home_team || (alpha.team1 && alpha.team1.name) || (alpha.teams && alpha.teams.home && alpha.teams.home.name) || (aParts.length >= 2 ? aParts[0] : '');
        let aAway = alpha.away_team || (alpha.team2 && alpha.team2.name) || (alpha.teams && alpha.teams.away && alpha.teams.away.name) || (aParts.length >= 2 ? aParts[1] : '');

        pHome = (pHome.split(/[|\[]/)[0] || pHome).trim();
        pAway = (pAway.split(/[|\[]/)[0] || pAway).trim();
        aHome = (aHome.split(/[|\[]/)[0] || aHome).trim();
        aAway = (aAway.split(/[|\[]/)[0] || aAway).trim();

        // If BOTH fixtures have opposing teams, BOTH TEAMS MUST MATCH!
        if (pHome && pAway && aHome && aAway) {
            const homeHome = matchTeams(pHome, aHome);
            const awayAway = matchTeams(pAway, aAway);
            const homeAway = matchTeams(pHome, aAway);
            const awayHome = matchTeams(pAway, aHome);
            if ((homeHome && awayAway) || (homeAway && awayHome)) return true;
            return false;
        }

        // Only for non-team single-entity events (Formula 1, MotoGP, UFC fight cards)
        const isSingleEntity = /grand\s*prix|qualifying|practice|race|ufc|bellator|fight\s*night|rally|motogp|nascar|marathon|tour\s*de/i.test(pTitle) ||
                               /grand\s*prix|qualifying|practice|race|ufc|bellator|fight\s*night|rally|motogp|nascar|marathon|tour\s*de/i.test(aTitle);
        if (isSingleEntity) {
            const pToks = getDistinctiveTokens(pTitle);
            const aToks = getDistinctiveTokens(aTitle);
            const common = aToks.filter(t => pToks.includes(t));
            if (common.length >= 2) return true;
        }

        return false;
    }

    const SPORT_MAPPINGS = {
        'football': 'FOOTBALL',
        'soccer': 'FOOTBALL',
        'uefa': 'FOOTBALL',
        'uefa nations': 'FOOTBALL',
        'uefa-nations': 'FOOTBALL',
        'ucl womens': 'FOOTBALL',
        'ucl-womens': 'FOOTBALL',
        'uefa-womens-champions-league': 'FOOTBALL',
        'uefa womens champions league': 'FOOTBALL',
        'champions league': 'FOOTBALL',
        'champions-league': 'FOOTBALL',
        'europa league': 'FOOTBALL',
        'europa-league': 'FOOTBALL',
        'conference league': 'FOOTBALL',
        'conference-league': 'FOOTBALL',
        'afcon': 'FOOTBALL',
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
        futbolxCatalog: [],
        listeners: [],
        refreshInterval: null,
        _preFetching: false,
        _alphaLoadingPromise: null,

        async init() {
            const CACHE_KEY = 'aryan_cached_matches_v39';
            // 1. Explicitly purge any bloated legacy caches (v1 through v35) dynamically
            try {
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith('aryan_cached_matches_') && k !== CACHE_KEY) {
                        localStorage.removeItem(k);
                    }
                }
            } catch (e) {}

            // 2. Immediately hydrate from fresh localStorage cache so fixtures appear with 0ms delay on reload/back
            try {
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        const now = Date.now();
                        this.matches = parsed.filter(m => {
                            if (!m || !m.title) return false;
                            if (m.isAlwaysLive || m.always_live === 1 || m.sport === '24/7 STREAMS' || m.rawCategory === '24/7-streams' || m.tag === '24/7 channel' || m.tag === '24/7 streams') return false;
                            if (m.title.toLowerCase().includes('family guy')) return false;
                            // Expire games that started > 4 hours ago or ended > 15 minutes ago
                            if (m.endTime && now > (m.endTime + 900000)) return false;
                            if (m.startTime && now > (m.startTime + 14400000)) return false;
                            // Must have valid startTime
                            if (!m.startTime || m.startTime <= 0) return false;
                            return true;
                        }).map(m => {
                            if (m.poster) m.poster = sanitizePosterUrl(m.poster);
                            m.isLive = Boolean(m.startTime && m.startTime <= now && (!m.endTime || now <= m.endTime) && !this.isExcludedFromLiveNow(m));
                            return sanitizeMatchServers(m);
                        });
                        if (this.matches.length > 0) {
                            this.isLoading = false;
                            this.sortMatches();
                            this.emitUpdate();
                        }
                    }
                }
            } catch (e) {}

            if (this.matches.length === 0) {
                this.isLoading = true;
                this.emitUpdate();
            }

            // 1. Load authoritative PPV fixtures first via Cloudflare edge proxy
            await this.loadPPVFeeds();
            this.isLoading = false;
            this.sortMatches();
            this.emitUpdate();

            // 2. Concurrently enrich with StreamCorner feeds, FutbolX feeds, and channels
            this._alphaLoadingPromise = this.loadStreamCornerAlphaFeeds();
            this._futbolxLoadingPromise = this.loadFutbolXFeeds();
            await Promise.allSettled([
                this._alphaLoadingPromise,
                this._futbolxLoadingPromise,
                this.loadChannelsCatalog()
            ]);

            this.sortMatches();
            this.emitUpdate();

            // Auto-refresh match feeds, Alpha channels & statuses every 90 seconds
            if (!this.refreshInterval) {
                this.refreshInterval = setInterval(async () => {
                    await this.loadPPVFeeds();
                    this._alphaLoadingPromise = this.loadStreamCornerAlphaFeeds();
                    this._futbolxLoadingPromise = this.loadFutbolXFeeds();
                    await Promise.allSettled([
                        this._alphaLoadingPromise,
                        this._futbolxLoadingPromise
                    ]);
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
            const CACHE_KEY = 'aryan_cached_matches_v39';
            try {
                const rawItems = [];
                const seenRawIds = new Set();

                // 1. Fetch official PPV Live Streams
                const ppvEndpoints = [
                    '/api/ppv',
                    'https://api.ppv.st/api/streams'
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
                                            const mainIframe = s.iframe || s.embedUrl || '';
                                            if (mainIframe.includes('taifood-blog.asia') && (!Array.isArray(s.substreams) || s.substreams.length === 0)) {
                                                return; // Skip dead taifood ghost fixture
                                            }
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

                // 2. Fetch Complete Fixtures Schedule (Fast Cloudflare edge proxy first)
                const scheduleEndpoints = [
                    '/api/ppv?endpoint=all',
                    'https://streamed.pk/api/matches/all',
                    'https://damitv.st/papi/matches/all-today'
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
                                        // Filter out synthetic / manual / fake DamiTV CMS test fixtures & phantom matches
                                        const sIdLower = String(s.id || '').toLowerCase();
                                        const sTitleLower = String(s.name || s.title || '').toLowerCase();
                                        if (s.isManual || s.auto === 'own' || sIdLower.startsWith('mm-own') || sIdLower.startsWith('mm-yl') || sIdLower.startsWith('mm-cric')) {
                                            return;
                                        }
                                        if (sTitleLower.includes('diriyah') && sTitleLower.includes('riyadh')) {
                                            return;
                                        }
                                        if (sTitleLower.includes('wolverhampton') && (sTitleLower.includes('portsmouth') || sTitleLower.includes('pompey'))) {
                                            return;
                                        }
                                        if (Array.isArray(s.sources) && s.sources.length === 1 && String(s.sources[0].source || '').toLowerCase() === 'manual') {
                                            return;
                                        }
                                        const mainIframe = s.iframe || s.embedUrl || '';
                                        if (mainIframe.includes('taifood-blog.asia') && (!Array.isArray(s.substreams) || s.substreams.length === 0) && (!Array.isArray(s.sources) || s.sources.length === 0)) {
                                            return;
                                        }
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
                    const newMatchesById = new Map();
                    const existingMatchesById = new Map();

                    if (Array.isArray(this.matches)) {
                        for (let i = 0; i < this.matches.length; i++) {
                            const m = this.matches[i];
                            if (m.id) existingMatchesById.set(m.id, m);
                            if (m.rawId) existingMatchesById.set(m.rawId, m);
                        }
                    }

                    for (let i = 0; i < rawItems.length; i++) {
                        if (i > 0 && i % 80 === 0) {
                            await new Promise(r => setTimeout(r, 0));
                        }
                        const item = rawItems[i];
                        const s = item.stream;
                        const catName = item.category;
                        const is247Cat = item.is247;
                        const sTitle = (s.name || s.title || '').trim();
                        if (!s || !s.id || !sTitle) continue;

                        const norm = this.normalizePPVStreamItem(s, catName, is247Cat);
                        if (!norm) continue;

                        // 1. Check if this fixture already exists in newMatches (deduplicate PPV & Streamed.pk)
                        let existingInNew = newMatchesById.get(norm.id) || (norm.rawId ? newMatchesById.get(norm.rawId) : null);
                        if (!existingInNew) {
                            existingInNew = newMatches.find(m => {
                                if (m.sport && norm.sport && m.sport !== 'OTHERS' && norm.sport !== 'OTHERS' && m.sport !== norm.sport) return false;
                                return isSameMatch(m, norm);
                            });
                        }
                        if (existingInNew) {
                            // Merge authentic poster
                            if ((!existingInNew.poster || existingInNew.poster.includes('logo-icon.png')) && norm.poster && !norm.poster.includes('logo-icon.png')) {
                                existingInNew.poster = norm.poster;
                            }
                            // Merge team logos
                            if ((!existingInNew.team1 || !existingInNew.team1.logo) && (norm.team1 && norm.team1.logo)) {
                                existingInNew.team1 = norm.team1;
                            }
                            if ((!existingInNew.team2 || !existingInNew.team2.logo) && (norm.team2 && norm.team2.logo)) {
                                existingInNew.team2 = norm.team2;
                            }
                            // Merge category logo
                            if (!existingInNew.categoryLogo && norm.categoryLogo) {
                                existingInNew.categoryLogo = norm.categoryLogo;
                            }
                            // Merge unique servers cleanly using canonical key deduplication
                            existingInNew.servers = sanitizeMatchServers({ servers: [...existingInNew.servers, ...norm.servers] }).servers;
                            existingInNew.sources = existingInNew.servers;

                            // Inherit Alpha stream ID and type if present
                            if (!existingInNew.alphaStreamId && norm.alphaStreamId) {
                                existingInNew.alphaStreamId = norm.alphaStreamId;
                                existingInNew.alphaStreamType = norm.alphaStreamType || (norm.alphaItem && norm.alphaItem.stream_type) || 'alpha';
                                existingInNew.alphaItem = norm.alphaItem;
                            }
                            continue;
                        }

                        // 2. Check against previous matches state to preserve resolved alpha feeds
                        let existing = existingMatchesById.get(norm.id) || (norm.rawId ? existingMatchesById.get(norm.rawId) : null);
                        if (!existing) {
                            existing = this.matches.find(m => {
                                if (m.sport && norm.sport && m.sport !== 'OTHERS' && norm.sport !== 'OTHERS' && m.sport !== norm.sport) return false;
                                return isSameMatch(m, norm);
                            });
                        }

                        if (existing && existing._alphaResolved) {
                            norm.alphaStreamId = existing.alphaStreamId;
                            norm.alphaStreamType = existing.alphaStreamType || (existing.alphaItem && existing.alphaItem.stream_type) || 'alpha';
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
                            norm.alphaStreamType = existing.alphaStreamType || (existing.alphaItem && existing.alphaItem.stream_type) || 'alpha';
                            norm.alphaItem = existing.alphaItem;
                        } else if (Array.isArray(this.alphaCatalog) && this.alphaCatalog.length > 0) {
                            const matchedAlpha = this.alphaCatalog.find(a => {
                                const aCat = (a.category || a.league || '').toUpperCase();
                                if (norm.sport && aCat && norm.sport !== 'OTHERS' && aCat !== 'OTHERS' && norm.sport !== aCat) {
                                    let comp = false;
                                    for (const group in STATIC_SPORT_GROUPS) {
                                        const members = STATIC_SPORT_GROUPS[group];
                                        if ((norm.sport.includes(group) || members.some(m => norm.sport.includes(m))) &&
                                            (aCat.includes(group) || members.some(m => aCat.includes(m)))) {
                                            comp = true;
                                            break;
                                        }
                                    }
                                    if (!comp) return false;
                                }
                                return isSameMatch(norm, a);
                            });
                            if (matchedAlpha) {
                                norm.alphaStreamId = matchedAlpha.stream_id;
                                norm.alphaStreamType = matchedAlpha.stream_type || 'alpha';
                                norm.alphaItem = matchedAlpha;
                                if (matchedAlpha.home_team_logo && (!norm.team1 || !norm.team1.logo || norm.team1.logo.includes('logo-icon.png'))) {
                                    norm.team1 = { name: matchedAlpha.home_team || (norm.team1 && norm.team1.name) || '', logo: sanitizeLogoUrl(matchedAlpha.home_team_logo) };
                                }
                                if (matchedAlpha.away_team_logo && (!norm.team2 || !norm.team2.logo || norm.team2.logo.includes('logo-icon.png'))) {
                                    norm.team2 = { name: matchedAlpha.away_team || (norm.team2 && norm.team2.name) || '', logo: sanitizeLogoUrl(matchedAlpha.away_team_logo) };
                                }
                                if (matchedAlpha.poster && (!norm.poster || norm.poster.includes('logo-icon.png'))) {
                                    norm.poster = sanitizePosterUrl(matchedAlpha.poster);
                                }
                            }
                        }

                        // Preserve previous poster/logos if existing had them
                        if (existing) {
                            if ((!norm.poster || norm.poster.includes('logo-icon.png')) && existing.poster && !existing.poster.includes('logo-icon.png')) {
                                norm.poster = existing.poster;
                            }
                            if ((!norm.team1 || !norm.team1.logo) && (existing.team1 && existing.team1.logo)) {
                                norm.team1 = existing.team1;
                            }
                            if ((!norm.team2 || !norm.team2.logo) && (existing.team2 && existing.team2.logo)) {
                                norm.team2 = existing.team2;
                            }
                        }

                        newMatches.push(norm);
                        newMatchesById.set(norm.id, norm);
                        if (norm.rawId) newMatchesById.set(norm.rawId, norm);
                    }

                    if (newMatches.length > 0) {
                        // Also preserve any independent StreamCorner fixtures that were added or are in alphaCatalog
                        if (Array.isArray(this.alphaCatalog) && this.alphaCatalog.length > 0) {
                            const ppvById = new Map();
                            const ppvByTok = new Map();
                            for (const m of newMatches) {
                                if (m.id) ppvById.set(m.id, m);
                                if (m.rawId) ppvById.set(String(m.rawId), m);
                                if (m.alphaStreamId) ppvById.set(m.alphaStreamId, m);
                                if (Array.isArray(m.streamCornerSources)) {
                                    for (const sc of m.streamCornerSources) {
                                        if (sc && sc.id) ppvById.set(sc.id, m);
                                    }
                                }
                                const toks = getDistinctiveTokens(m.title || '');
                                for (const t of toks) {
                                    let l = ppvByTok.get(t);
                                    if (!l) { l = []; ppvByTok.set(t, l); }
                                    l.push(m);
                                }
                            }

                            for (const alpha of this.alphaCatalog) {
                                if (!alpha || !alpha.stream_id) continue;
                                let matched = ppvById.get(alpha.stream_id) || ppvById.get(`alpha-${alpha.stream_id}`);
                                if (!matched) {
                                    const aTitle = alpha.event_name || (alpha.home_team && alpha.away_team ? `${alpha.home_team} vs. ${alpha.away_team}` : alpha.home_team || '');
                                    const aToks = getDistinctiveTokens(aTitle);
                                    if (aToks.length >= 2) {
                                        const cands = new Set();
                                        for (const t of aToks) {
                                            const l = ppvByTok.get(t);
                                            if (l) { for (const c of l) cands.add(c); }
                                        }
                                        for (const c of cands) {
                                            if (isSameMatch(c, alpha)) {
                                                matched = c;
                                                break;
                                            }
                                        }
                                    }
                                }
                                if (matched) {
                                    ppvById.set(alpha.stream_id, matched);
                                    matched.streamCornerSources = matched.streamCornerSources || [];
                                    if (!matched.streamCornerSources.some(sc => sc.id === alpha.stream_id)) {
                                        matched.streamCornerSources.push({
                                            id: alpha.stream_id,
                                            type: alpha.stream_type || 'alpha',
                                            item: alpha
                                        });
                                    }
                                    if (!matched.alphaStreamId || alpha.stream_type === 'alpha' || alpha.stream_type === 'admin') {
                                        matched.alphaStreamId = alpha.stream_id;
                                        matched.alphaStreamType = alpha.stream_type || 'alpha';
                                        matched.alphaItem = alpha;
                                    }
                                } else {
                                    const normAlpha = this.normalizeAlphaMatch(alpha);
                                    if (normAlpha) {
                                        normAlpha.streamCornerSources = [{
                                            id: alpha.stream_id,
                                            type: alpha.stream_type || 'alpha',
                                            item: alpha
                                        }];
                                        newMatches.push(normAlpha);
                                        ppvById.set(alpha.stream_id, normAlpha);
                                        ppvById.set(normAlpha.id, normAlpha);
                                        const nToks = getDistinctiveTokens(normAlpha.title || '');
                                        for (const t of nToks) {
                                            let l = ppvByTok.get(t);
                                            if (!l) { l = []; ppvByTok.set(t, l); }
                                            l.push(normAlpha);
                                        }
                                    }
                                }
                            }
                        }

                        this.matches = newMatches;
                        this.isLoading = false;
                        this.sortMatches();
                        this.emitUpdate();
                        // Alpha sources resolved on-demand per match without freezing UI
                        try {
                            localStorage.setItem(CACHE_KEY, JSON.stringify(this.matches.slice(0, MATCH_CACHE_LIMIT)));
                        } catch (e) {}
                    }
                }
            } catch (err) {
                console.warn('PPV feeds load failed:', err);
            }
        },

        /**
         * Load 24/7 TV channels with StreamCorner premier Zero-CF channels and DaddyLive catalog
         */
        /**
         * Load all active FutbolX matches and streams
         * Integrates channels into matching fixtures as "FX 1 - ...", "FX 2 - ..."
         * and adds exclusive FutbolX matches to the live schedule.
         */
        async loadFutbolXFeeds() {
            try {
                let fxMatches = [];
                const endpoints = [
                    '/api/futbolx?endpoint=futbolx',
                    '/api/futbolx',
                    '/api/ppv?endpoint=futbolx'
                ];

                for (const ep of endpoints) {
                    try {
                        const res = await fetch(ep, {
                            signal: AbortSignal.timeout(6000),
                            headers: { 'Accept': 'application/json' }
                        });
                        if (res.ok) {
                            const json = await res.json();
                            if (json && Array.isArray(json.matches) && json.matches.length > 0) {
                                fxMatches = json.matches;
                                break;
                            }
                        }
                    } catch (e) {}
                }

                // Client-side fallback directly to FutbolX public API if edge proxy was unavailable
                if (fxMatches.length === 0 && typeof window !== 'undefined') {
                    try {
                        const streamRes = await fetch('https://www.futbol-x.xyz/api/stream', {
                            signal: AbortSignal.timeout(5000),
                            headers: { 'Accept': 'application/json' }
                        });
                        if (streamRes.ok) {
                            const { categories } = await streamRes.json();
                            const validCats = Array.isArray(categories) ? categories.filter(c => typeof c === 'string' && c.trim().length > 0) : [];
                            const now = Date.now();
                            const promises = validCats.map(async cat => {
                                try {
                                    const cRes = await fetch(`https://www.futbol-x.xyz/api/${cat}.json`, {
                                        signal: AbortSignal.timeout(4000),
                                        headers: { 'Accept': 'application/json' }
                                    });
                                    if (!cRes.ok) return [];
                                    const cData = await cRes.json();
                                    const events = [];
                                    if (cData && Array.isArray(cData.streams)) {
                                        for (const g of cData.streams) {
                                            if (g && Array.isArray(g.streams)) {
                                                for (const ev of g.streams) {
                                                    if (!ev || !ev.name) continue;
                                                    const start = ev.starts_at ? new Date(ev.starts_at).getTime() : 0;
                                                    const end = ev.ends_at ? new Date(ev.ends_at).getTime() : (start ? start + 10800000 : 0);
                                                    if (end > 0 && now > (end + 900000) && !ev.always_live) continue;

                                                    const activeStreams = (ev.streams || []).filter(s => s && s.url && s.url.trim().length > 0);
                                                    events.push({
                                                        id: `fx-${ev.uri_name || Math.random().toString(36).slice(2, 8)}`,
                                                        uri_name: ev.uri_name,
                                                        title: (ev.name || '').trim(),
                                                        tag: (ev.tag || '').trim(),
                                                        category: cat,
                                                        poster: ev.poster || '',
                                                        starts_at: ev.starts_at || '',
                                                        ends_at: ev.ends_at || '',
                                                        always_live: ev.always_live || 0,
                                                        streams: activeStreams
                                                    });
                                                }
                                            }
                                        }
                                    }
                                    return events;
                                } catch (e) { return []; }
                            });
                            const results = await Promise.all(promises);
                            fxMatches = results.flat();
                        }
                    } catch (e) {}
                }

                if (fxMatches.length === 0) return;
                this.futbolxCatalog = fxMatches;

                const getTokens = (str) => {
                    if (!str) return [];
                    return str.toLowerCase()
                        .replace(/[^a-z0-9\s]/g, ' ')
                        .split(/\s+/)
                        .filter(w => w.length >= 3 && !['vs', 'the', 'and', 'live', 'game', 'cup'].includes(w));
                };

                const matchByTok = new Map();
                for (const m of this.matches) {
                    const toks = getTokens(m.title || '');
                    for (const t of toks) {
                        let l = matchByTok.get(t);
                        if (!l) { l = []; matchByTok.set(t, l); }
                        l.push(m);
                    }
                }

                let addedNew = false;
                const now = Date.now();

                for (const fx of fxMatches) {
                    const fxStreams = (fx.streams || []).filter(s => s && s.url && s.url.trim().length > 0).map((s, idx) => ({
                        name: `FX ${idx + 1} - ${s.title || 'Feed'}`,
                        url: `shaka_player.html?hls=${encodeURIComponent(s.url)}`,
                        rawUrl: s.url,
                        type: 'iframe',
                        isFutbolX: true,
                        hd: true
                    }));

                    const fxStart = fx.starts_at ? new Date(fx.starts_at).getTime() : 0;
                    const fxToks = getTokens(fx.title || '');
                    let matchedFixture = null;

                    if (this._matchById && (this._matchById.has(fx.id) || this._matchById.has(fx.uri_name))) {
                        matchedFixture = this._matchById.get(fx.id) || this._matchById.get(fx.uri_name);
                    }

                    if (!matchedFixture && fxToks.length > 0) {
                        const candidates = new Map();
                        for (const t of fxToks) {
                            const list = matchByTok.get(t);
                            if (list) {
                                for (const cand of list) {
                                    candidates.set(cand, (candidates.get(cand) || 0) + 1);
                                }
                            }
                        }
                        for (const [cand, count] of candidates.entries()) {
                            const fxCatUpper = (SPORT_MAPPINGS[(fx.category || '').toLowerCase()] || (fx.category || '').toUpperCase());
                            if (cand.sport && fxCatUpper && cand.sport !== 'OTHERS' && fxCatUpper !== 'OTHERS' && cand.sport !== fxCatUpper) {
                                continue;
                            }
                            if (cand.startTime && fxStart && Math.abs(cand.startTime - fxStart) > 43200000) {
                                continue;
                            }
                            if (count >= 2 || (fxToks.length === 1 && count >= 1)) {
                                matchedFixture = cand;
                                break;
                            }
                        }
                    }

                    if (matchedFixture) {
                        // Attach FX streams to existing fixture at the very top
                        if (fxStreams.length > 0) {
                            const existingUrls = new Set((matchedFixture.servers || []).map(srv => srv.rawUrl || srv.url));
                            const newFxServers = fxStreams.filter(s => !existingUrls.has(s.rawUrl || s.url));
                            if (newFxServers.length > 0) {
                                matchedFixture.servers = prioritizeFxServers([...newFxServers, ...(matchedFixture.servers || [])]);
                                matchedFixture.sources = matchedFixture.servers;
                            }
                        }
                        matchedFixture.isFutbolX = true;
                        if (fx.uri_name) {
                            matchedFixture.uriName = fx.uri_name;
                            if (this._matchById) {
                                this._matchById.set(fx.uri_name, matchedFixture);
                                this._matchById.set(`fx-${fx.uri_name}`, matchedFixture);
                            }
                        }
                        if (fx.poster && (!matchedFixture.poster || matchedFixture.poster.includes('logo-icon.png'))) {
                            matchedFixture.poster = sanitizePosterUrl(fx.poster);
                        }
                        if (!matchedFixture.isLive && matchedFixture.startTime && matchedFixture.startTime <= now && (!matchedFixture.endTime || now <= matchedFixture.endTime) && fxStreams.length > 0) {
                            matchedFixture.isLive = true;
                            matchedFixture.status = 'live';
                        }
                    } else {
                        // Exclusive FutbolX match (both live and upcoming future events!)
                        const newMatch = this.normalizeFutbolXMatch(fx, fxStreams);
                        if (newMatch) {
                            this.matches.push(newMatch);
                            addedNew = true;
                            if (this._matchById) {
                                this._matchById.set(newMatch.id, newMatch);
                                if (newMatch.rawId) this._matchById.set(String(newMatch.rawId), newMatch);
                                if (newMatch.uriName) {
                                    this._matchById.set(newMatch.uriName, newMatch);
                                    this._matchById.set(`fx-${newMatch.uriName}`, newMatch);
                                }
                            }
                        }
                    }
                }

                if (addedNew || fxMatches.length > 0) {
                    this.sortMatches();
                    this.emitUpdate();
                    try {
                        const CACHE_KEY = 'aryan_cached_matches_v39';
                        localStorage.setItem(CACHE_KEY, JSON.stringify(this.matches.slice(0, MATCH_CACHE_LIMIT)));
                    } catch (e) {}
                }
            } catch (err) {
                console.warn('loadFutbolXFeeds error:', err);
            }
        },

        normalizeFutbolXMatch(fx, fxStreams) {
            if (!fx || !fx.title) return null;
            const startTs = fx.starts_at ? new Date(fx.starts_at).getTime() : Date.now();
            const endTs = fx.ends_at ? new Date(fx.ends_at).getTime() : (startTs ? startTs + 10800000 : 0);
            const now = Date.now();

            if (endTs > 0 && now > (endTs + 900000)) return null;

            const isLive = Boolean(startTs > 0 && now >= startTs && (!endTs || now <= endTs));
            const rawCat = (fx.category || 'football').toLowerCase();
            const sport = SPORT_MAPPINGS[rawCat] || (fx.category ? fx.category.toUpperCase() : 'FOOTBALL');

            const parts = fx.title.split(/\s+(?:vs\.?|@|-|x)\s+/i);
            const team1Name = parts[0] ? parts[0].trim() : fx.title;
            const team2Name = parts[1] ? parts[1].trim() : '';

            return sanitizeMatchServers({
                id: fx.id || `fx-${fx.uri_name}`,
                rawId: fx.uri_name || fx.id,
                uriName: fx.uri_name,
                title: fx.title,
                name: fx.title,
                sport: sport,
                league: fx.tag || sport,
                tag: fx.tag || 'Live Match',
                status: isLive ? 'live' : 'upcoming',
                isLive: isLive,
                startTime: startTs,
                endTime: endTs,
                time: fx.starts_at ? new Date(fx.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live',
                poster: sanitizePosterUrl(fx.poster || ''),
                categoryLogo: '',
                colors: [],
                team1: { name: team1Name, logo: '' },
                team2: { name: team2Name, logo: '' },
                rawCategory: rawCat,
                servers: fxStreams || [],
                sources: fxStreams || [],
                isFutbolX: true
            });
        },

        async loadChannelsCatalog() {
            const STREAMCORNER_PREMIER_CHANNELS = [
                {
                    id: "sc-tnt1",
                    channelId: "sc-tnt1",
                    name: "TNT Sports 1 (SC)",
                    country: "UK",
                    category: "24/7 STREAMS",
                    logo: "https://raw.githubusercontent.com/tv-logo/tv-logos/refs/heads/main/countries/united-kingdom/tnt-sports-1-uk.png",
                    servers: [
                        { name: "Direct HD (Zero-CF)", url: "shaka_player.html?mpd=https://otte.cache.aiv-cdn.net/iad-nitro/live/clients/dash/enc/rhf2dwosdt/out/v1/ee550d2a68d846c797e6ce4de2e8b76d/cenc.mpd&kid=69a5aa835a061ce64a630d1046727e40&key=d02feac8a999bd06bf4059bf33411749", type: "iframe", hd: true },
                        { name: "Server 2 (Backup)", url: "shaka_player.html?mpd=https://otte.live.fly.ww.aiv-cdn.net/iad-nitro/live/clients/dash/enc/rhf2dwosdt/out/v1/ee550d2a68d846c797e6ce4de2e8b76d/cenc.mpd&kid=69a5aa835a061ce64a630d1046727e40&key=d02feac8a999bd06bf4059bf33411749", type: "iframe", hd: true }
                    ]
                },
                {
                    id: "sc-tnt2",
                    channelId: "sc-tnt2",
                    name: "TNT Sports 2 (SC)",
                    country: "UK",
                    category: "24/7 STREAMS",
                    logo: "https://raw.githubusercontent.com/tv-logo/tv-logos/refs/heads/main/countries/united-kingdom/tnt-sports-2-uk.png",
                    servers: [
                        { name: "Direct HD (Zero-CF)", url: "shaka_player.html?mpd=https://otte.cache.aiv-cdn.net/bom-nitro/live/clients/dash/enc/puehlftk5j/out/v1/f7f0da1ee112481ca0024e6d4dd97f4a/cenc.mpd&kid=f3df7843080ae743bf865dc5fdf64c68&key=567c863bc12eb74788ea74888c042e1b", type: "iframe", hd: true },
                        { name: "Server 2 (Backup)", url: "shaka_player.html?mpd=https://otte.live.fly.ww.aiv-cdn.net/bom-nitro/live/clients/dash/enc/puehlftk5j/out/v1/f7f0da1ee112481ca0024e6d4dd97f4a/cenc.mpd&kid=f3df7843080ae743bf865dc5fdf64c68&key=567c863bc12eb74788ea74888c042e1b", type: "iframe", hd: true }
                    ]
                },
                {
                    id: "sc-tnt3",
                    channelId: "sc-tnt3",
                    name: "TNT Sports 3 HD (SC)",
                    country: "UK",
                    category: "24/7 STREAMS",
                    logo: "https://raw.githubusercontent.com/tv-logo/tv-logos/refs/heads/main/countries/united-kingdom/tnt-sports-3-uk.png",
                    servers: [
                        { name: "Direct HD (Zero-CF)", url: "shaka_player.html?mpd=https://otte.cache.aiv-cdn.net/bom-nitro/live/clients/dash/enc/dev1hjwzh9/out/v1/a5f0ee7ad7b24906b14f43bebbbe4678/cenc.mpd&kid=cc91508324ce9dcaf425a43d58f1d9d4&key=643e5474d9edd87c7d9091c8c97994ca", type: "iframe", hd: true }
                    ]
                },
                {
                    id: "sc-tnt4",
                    channelId: "sc-tnt4",
                    name: "TNT Sports 4 HD (SC)",
                    country: "UK",
                    category: "24/7 STREAMS",
                    logo: "https://raw.githubusercontent.com/tv-logo/tv-logos/refs/heads/main/countries/united-kingdom/tnt-sports-4-uk.png",
                    servers: [
                        { name: "Direct HD (Zero-CF)", url: "shaka_player.html?mpd=https://otte.live.fly.ww.aiv-cdn.net/iad-nitro/live/clients/dash/enc/tdijwiga2k/out/v1/f5fde318678f4f7583bf27b7231bde1f/cenc.mpd&kid=fa34fa8c90336dd528c7a23871cad1fe&key=552a78d1aeb74f1650d68255c5749408", type: "iframe", hd: true }
                    ]
                },
                {
                    id: "sc-bein1",
                    channelId: "sc-bein1",
                    name: "beIN Sports 1 AU (SC)",
                    country: "AU",
                    category: "24/7 STREAMS",
                    logo: "https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/australia/bein-sports-1-au.png",
                    servers: [
                        { name: "Direct HD (Zero-CF)", url: "shaka_player.html?mpd=https://otte.cache.aiv-cdn.net/bom-nitro/live/clients/dash/enc/ghwcl6hv68/out/v1/83536910d8034e9b9895a20fbe1c1687/cenc.mpd&kid=335dad778109954503dcbb21dc92015f&key=24bfd75d436cbf73168a2a2dccd40281", type: "iframe", hd: true },
                        { name: "Server 2 (Backup)", url: "shaka_player.html?mpd=https://otte.live.fly.ww.aiv-cdn.net/syd-nitro/live/clients/dash/enc/ghwcl6hv68/out/v1/83536910d8034e9b9895a20fbe1c1687/cenc.mpd&kid=335dad778109954503dcbb21dc92015f&key=24bfd75d436cbf73168a2a2dccd40281", type: "iframe", hd: true }
                    ]
                },
                {
                    id: "sc-bein2",
                    channelId: "sc-bein2",
                    name: "beIN Sports 2 AU (SC)",
                    country: "AU",
                    category: "24/7 STREAMS",
                    logo: "https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/australia/bein-sports-2-au.png",
                    servers: [
                        { name: "Direct HD (Zero-CF)", url: "shaka_player.html?mpd=https://otte.cache.aiv-cdn.net/bom-nitro/live/clients/dash/enc/8m8cd46i1t/out/v1/83985c68e4174e90a58a1f2c024be4c9/cenc.mpd&kid=0b42be2664d7e811d04f3e504e0924c5&key=ae24090123b8c72ac5404dc152847cb8", type: "iframe", hd: true },
                        { name: "Server 2 (Backup)", url: "shaka_player.html?mpd=https://otte.live.fly.ww.aiv-cdn.net/syd-nitro/live/clients/dash/enc/8m8cd46i1t/out/v1/83985c68e4174e90a58a1f2c024be4c9/cenc.mpd&kid=0b42be2664d7e811d04f3e504e0924c5&key=ae24090123b8c72ac5404dc152847cb8", type: "iframe", hd: true }
                    ]
                },
                {
                    id: "sc-bein3",
                    channelId: "sc-bein3",
                    name: "beIN Sports 3 AU (SC)",
                    country: "AU",
                    category: "24/7 STREAMS",
                    logo: "https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/australia/bein-sports-3-au.png",
                    servers: [
                        { name: "Direct HD (Zero-CF)", url: "shaka_player.html?mpd=https://otte.cache.aiv-cdn.net/bom-nitro/live/clients/dash/enc/q4u5nwaogz/out/v1/18de6d3e65934f3a8de4358e69eab86c/cenc.mpd&kid=7995c724a13748ed970840a8ab5bb9b3&key=67bdaf1e2175b9ff682fcdf0e2354b1e", type: "iframe", hd: true }
                    ]
                },
                {
                    id: "sc-fubo",
                    channelId: "sc-fubo",
                    name: "FUBO Sports - Premier League (SC)",
                    country: "US",
                    category: "24/7 STREAMS",
                    logo: "https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-states/fubo-sports-network-us.png",
                    servers: [
                        { name: "Direct HD (Zero-CF)", url: "shaka_player.html?mpd=https://otte.cache.aiv-cdn.net/bom-nitro/live/clients/dash/enc/u3yyxpyqxr/out/v1/63f0844e26d046ab88a2b07df145e87c/cenc.mpd&kid=c387c5521edf61057dbdda6bcfa7b6d0&key=24738f6cc7f70b5c7bf94b2667ba35fc", type: "iframe", hd: true }
                    ]
                },
                {
                    id: "sc-fox",
                    channelId: "sc-fox",
                    name: "Fox Sports (SC)",
                    country: "US",
                    category: "24/7 STREAMS",
                    logo: "https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-states/fox-sports-1-us.png",
                    servers: [
                        { name: "Direct HD (Zero-CF)", url: "shaka_player.html?mpd=https://otte.cache.aiv-cdn.net/bom-nitro/live/clients/dash/enc/awxnrqkbo5/out/v1/716529a4091947b0877e6cb80dbd6ccb/cenc.mpd&kid=09453ce820d65fbc675de3185f9e454c&key=98cff9600995fa381c76fdacf3c7edae", type: "iframe", hd: true }
                    ]
                },
                {
                    id: "sc-foxdep",
                    channelId: "sc-foxdep",
                    name: "Fox Deportes (SC)",
                    country: "US",
                    category: "24/7 STREAMS",
                    logo: "https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-states/fox-deportes-us.png",
                    servers: [
                        { name: "Direct HD (Zero-CF)", url: "shaka_player.html?mpd=https://otte.cache.aiv-cdn.net/bom-nitro/live/clients/dash/enc/vkpoljjpkj/out/v1/502bcf68b3514cd28a220e6f0a43816f/cenc.mpd&kid=d1a163914db8ffad2c3e94f979896a0d&key=9728800a3959aafdd5b0bcfbf3768811", type: "iframe", hd: true }
                    ]
                },
                {
                    id: "sc-sportdigital",
                    channelId: "sc-sportdigital",
                    name: "Sportdigital Fussball (SC)",
                    country: "DE",
                    category: "24/7 STREAMS",
                    logo: "https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/germany/sportdigital-fussball-de.png",
                    servers: [
                        { name: "Direct HD (Zero-CF)", url: "shaka_player.html?mpd=https://otte.cache.aiv-cdn.net/bom-nitro/live/clients/dash/enc/ssdefyhkkr/out/v1/cf01290cb7f64525bdf861580a016ca8/cenc.mpd&kid=0ad4080cdff8c60b1233b22087f0b340&key=285f129c5eca01dd08a5d5a14ad801c8", type: "iframe", hd: true }
                    ]
                },
                {
                    id: "sc-tsn",
                    channelId: "sc-tsn",
                    name: "TSN Sports (SC)",
                    country: "CA",
                    category: "24/7 STREAMS",
                    logo: "https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/canada/tsn-1-ca.png",
                    servers: [
                        { name: "Direct HD (Zero-CF)", url: "shaka_player.html?mpd=https://otte.cache.aiv-cdn.net/bom-nitro/live/clients/dash/enc/cscevwljkq/out/v1/972185041b244140860b7d56398e9aaf/cenc.mpd&kid=385ceb9714b75e0cef61254f80b31002&key=18dce92a2891fee68d21ede5173230f8", type: "iframe", hd: true }
                    ]
                },
                {
                    id: "sc-premier",
                    channelId: "sc-premier",
                    name: "Premier Sports (SC)",
                    country: "UK",
                    category: "24/7 STREAMS",
                    logo: "https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-kingdom/premier-sports-1-uk.png",
                    servers: [
                        { name: "Direct HD (Zero-CF)", url: "shaka_player.html?mpd=https://otte.cache.aiv-cdn.net/bom-nitro/live/clients/dash/enc/m6sqanvm2m/out/v1/f6beb46c6e9a4132ad739f3ca27df6aa/cenc.mpd&kid=1444f4235529f183f0a5a486befe9cdb&key=e5e3fec67a1bb3472a2089c8a0a2557f", type: "iframe", hd: true }
                    ]
                },
                {
                    id: "sc-fancode",
                    channelId: "sc-fancode",
                    name: "Fancode (SC)",
                    country: "IN",
                    category: "24/7 STREAMS",
                    logo: "https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/india/fancode-in.png",
                    servers: [
                        { name: "Direct HD (Zero-CF)", url: "shaka_player.html?mpd=https://otte.cache.aiv-cdn.net/iad-nitro/live/clients/dash/enc/b3b3fkmrbl/out/v1/1084d5c9a97a4c5b9f9554c88f486646/cenc.mpd&kid=82dfca238e8c4b430a3269db71965db9&key=a00b28caf4ac628e77a553d440c0ddca", type: "iframe", hd: true }
                    ]
                },
                {
                    id: "sc-sky-f1",
                    channelId: "sc-sky-f1",
                    name: "Sky Sports F1 HD (SC)",
                    country: "UK",
                    category: "24/7 STREAMS",
                    logo: "https://raw.githubusercontent.com/tv-logo/tv-logos/refs/heads/main/countries/united-kingdom/sky-sports-f1-uk.png",
                    servers: [
                        { name: "Direct HD (Zero-CF)", url: "shaka_player.html?mpd=https://a96aivottlinear-a.akamaihd.net/OTTB/pdx-nitro/live/clients/dash/enc/iryr4nfnvz/out/v1/56a65d76a55e49ffa4ac4669a8f9cf26/cenc.mpd&kid=5734bfc9aca5e8e478c98f0617ae56f7&key=b24ed75de070e35c154feeb68fc21e57", type: "iframe", hd: true }
                    ]
                },
                {
                    id: "sc-cbs-sports",
                    channelId: "sc-cbs-sports",
                    name: "CBS Sports HD (SC)",
                    country: "US",
                    category: "24/7 STREAMS",
                    logo: "https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-states/cbs-sports-network-us.png",
                    servers: [
                        { name: "Direct HD (Zero-CF)", url: "shaka_player.html?mpd=https://a166aivottlinear-a.akamaihd.net/OTTB/iad-nitro/live/clients/dash/enc/rbem8rorcw/out/v1/5318821e2c3c44c2a439681b9aa86e9b/cenc.mpd&kid=d9623774ac5c8c351aafe97c5fe70267&key=5164e6d05164a2d65fa8fcc962aa4861", type: "iframe", hd: true }
                    ]
                },
                {
                    id: "sc-vix-tudn",
                    channelId: "sc-vix-tudn",
                    name: "ViX TUDN HD (SC)",
                    country: "US",
                    category: "24/7 STREAMS",
                    logo: "https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-states/tudn-us.png",
                    servers: [
                        { name: "Direct HD (Zero-CF)", url: "shaka_player.html?mpd=https://a166aivottlinear-a.akamaihd.net/OTTB/iad-nitro/live/clients/dash/enc/mitr07scim/out/v1/4fb1073240a549479fd2f343e6cad4ba/cenc.mpd&kid=f45d1fecebca3a1aa154943fcf3e8276&key=4dbef5d8ed2a4bfbaecdbfe319e7a83d", type: "iframe", hd: true }
                    ]
                }
            ];

            let externalChannels = [];
            try {
                const url = `${DAMITV_API_BASE}/data/dlhd-channels.json`;
                const res = await fetch(url, { signal: AbortSignal.timeout(5000) }).catch(() => null);
                if (res && res.ok && (res.headers.get('content-type') || '').includes('json')) {
                    const data = await res.json();
                    if (data && Array.isArray(data.channels)) {
                        externalChannels = data.channels.map(ch => ({
                            id: `dlhd-${ch.id}`,
                            channelId: ch.id,
                            name: ch.name,
                            logo: (ch.image && ch.image.startsWith('/img/')) ? ('https://damitv.st' + ch.image) : (ch.image || 'assets/img/logo-icon.png'),
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

            // Always combine StreamCorner Zero-CF premier channels with external channels
            this.channels = [...STREAMCORNER_PREMIER_CHANNELS, ...externalChannels];

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
         * Load StreamCorner Alpha, NBA & Beta live sports fixtures
         * Pairs with PPV fixtures and introduces independent StreamCorner matches
         */
        async loadStreamCornerAlphaFeeds() {
            if (typeof window === 'undefined') return;
            if (!window.StreamCornerCore || !window.StreamCornerCore.w || typeof window.StreamCornerCore.w[6] !== 'function') {
                if (!this._hasAttemptedAutoHeal) {
                    this._hasAttemptedAutoHeal = true;
                    console.warn('StreamCornerCore missing or outdated. Auto-healing core engine...');
                    await this.reloadLatestStreamCornerCore();
                }
            }
            if (!window.StreamCornerCore || typeof window.StreamCornerCore.t !== 'function') {
                return;
            }
            try {
                const fetchEndpoint = async (endpoint) => {
                    const candidateWorkers = [...ALPHA_WORKER_NODES].sort(() => Math.random() - 0.5).slice(0, 4);
                    try {
                        const batchPromises = candidateWorkers.map(worker => {
                            return new Promise((resolve, reject) => {
                                const timer = setTimeout(() => reject(new Error('timeout')), 2500);
                                window.StreamCornerCore.t(`https://${worker}/corner?p=${endpoint}`, false, `corner ${endpoint}`)
                                    .then(res => {
                                        clearTimeout(timer);
                                        if (Array.isArray(res) && res.length > 0) resolve(res);
                                        else reject(new Error('empty'));
                                    })
                                    .catch(err => {
                                        clearTimeout(timer);
                                        reject(err);
                                    });
                            });
                        });
                        const res = await Promise.any(batchPromises);
                        if (Array.isArray(res) && res.length > 0) return res;
                    } catch (e) {}
                    return [];
                };

                const [alphaRes, adminRes, betaRes, nbaRes, ex3Res, ex4Res, cfRes, bbRes] = await Promise.allSettled([
                    fetchEndpoint('alpha'),
                    fetchEndpoint('admin'),
                    fetchEndpoint('beta'),
                    fetchEndpoint('nba'),
                    fetchEndpoint('extra003'),
                    fetchEndpoint('extra004'),
                    fetchEndpoint('001'),
                    fetchEndpoint('003')
                ]);

                const rawAlpha = (alphaRes.status === 'fulfilled' && Array.isArray(alphaRes.value)) ? alphaRes.value : [];
                const rawAdmin = (adminRes.status === 'fulfilled' && Array.isArray(adminRes.value)) ? adminRes.value : [];
                const rawBeta = (betaRes.status === 'fulfilled' && Array.isArray(betaRes.value)) ? betaRes.value : [];
                const rawNba = (nbaRes.status === 'fulfilled' && Array.isArray(nbaRes.value)) ? nbaRes.value : [];
                const rawEx3 = (ex3Res.status === 'fulfilled' && Array.isArray(ex3Res.value)) ? ex3Res.value : [];
                const rawEx4 = (ex4Res.status === 'fulfilled' && Array.isArray(ex4Res.value)) ? ex4Res.value : [];
                const rawCf = (cfRes.status === 'fulfilled' && Array.isArray(cfRes.value)) ? cfRes.value : [];
                const rawBb = (bbRes.status === 'fulfilled' && Array.isArray(bbRes.value)) ? bbRes.value : [];

                if (rawAlpha.length === 0 && rawAdmin.length === 0 && rawBeta.length === 0 && rawNba.length === 0) {
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

                // Normalize NBA games into unified catalog structure
                const normNba = rawNba.map(g => ({
                    stream_id: g.game_id || g.stream_id,
                    stream_type: 'nba',
                    event_name: g.event_name || (g.home_team && g.away_team ? `${g.home_team} vs. ${g.away_team}` : (g.home_team || g.away_team || 'NBA Game')),
                    category: 'BASKETBALL',
                    league: 'NBA',
                    home_team: g.home_team,
                    away_team: g.away_team,
                    home_team_logo: g.home_logo || g.home_team_logo,
                    away_team_logo: g.away_logo || g.away_team_logo,
                    poster: g.poster,
                    timestamp: g.timestamp,
                    time: g.time,
                    home_score: g.home_score,
                    away_score: g.away_score
                }));

                const normAlpha = rawAlpha.map(a => ({ ...a, stream_type: a.stream_type || 'alpha' }));
                const normAdmin = rawAdmin.map(a => ({ ...a, stream_type: a.stream_type || 'admin' }));
                const normBeta = rawBeta.map(b => ({ ...b, stream_type: b.stream_type || 'beta' }));
                const normEx3 = rawEx3.map(a => ({ ...a, stream_type: a.stream_type || 'extra003' }));
                const normEx4 = rawEx4.map(a => ({ ...a, stream_type: a.stream_type || 'extra004' }));
                const normCf = rawCf.map(a => ({ ...a, stream_type: a.stream_type || '001' }));
                const normBb = rawBb.map(a => ({ ...a, stream_type: a.stream_type || '003' }));

                const seenStreamIds = new Set();
                const combinedCatalog = [];
                for (const item of [...normAlpha, ...normAdmin, ...normBeta, ...normNba, ...normEx3, ...normEx4, ...normCf, ...normBb]) {
                    if (item && item.stream_id && !seenStreamIds.has(item.stream_id)) {
                        seenStreamIds.add(item.stream_id);
                        combinedCatalog.push(item);
                    }
                }

                this.alphaCatalog = combinedCatalog;
                const matchedAlphaIds = new Set();
                let addedIndependent = false;

                // Build fast lookup index for this.matches
                const matchById = new Map();
                const matchByTok = new Map();
                for (const m of this.matches) {
                    if (!m) continue;
                    if (m.id) matchById.set(m.id, m);
                    if (m.rawId) matchById.set(String(m.rawId), m);
                    if (m.alphaStreamId) matchById.set(m.alphaStreamId, m);
                    if (Array.isArray(m.streamCornerSources)) {
                        for (const sc of m.streamCornerSources) {
                            if (sc && sc.id) matchById.set(sc.id, m);
                        }
                    }
                    const toks = getDistinctiveTokens(m.title || '');
                    for (const t of toks) {
                        let l = matchByTok.get(t);
                        if (!l) { l = []; matchByTok.set(t, l); }
                        l.push(m);
                    }
                }

                // Merge and pair all catalog items into single match cards
                for (const alpha of this.alphaCatalog) {
                    if (!alpha || !alpha.stream_id) continue;
                    let matchedMatch = matchById.get(alpha.stream_id) || matchById.get(`alpha-${alpha.stream_id}`);
                    if (!matchedMatch) {
                        const aTitle = alpha.event_name || (alpha.home_team && alpha.away_team ? `${alpha.home_team} vs. ${alpha.away_team}` : alpha.home_team || '');
                        const aToks = getDistinctiveTokens(aTitle);
                        if (aToks.length >= 2) {
                            const candidates = new Set();
                            for (const t of aToks) {
                                const list = matchByTok.get(t);
                                if (list) {
                                    for (const c of list) candidates.add(c);
                                }
                            }
                            for (const cand of candidates) {
                                if (isSameMatch(cand, alpha)) {
                                    matchedMatch = cand;
                                    break;
                                }
                            }
                        }
                    }
                    if (matchedMatch) {
                        matchedAlphaIds.add(alpha.stream_id);
                        matchById.set(alpha.stream_id, matchedMatch);
                        matchedMatch.streamCornerSources = matchedMatch.streamCornerSources || [];
                        if (!matchedMatch.streamCornerSources.some(sc => sc.id === alpha.stream_id)) {
                            matchedMatch.streamCornerSources.push({
                                id: alpha.stream_id,
                                type: alpha.stream_type || 'alpha',
                                item: alpha
                            });
                        }
                        // Prioritize primary alphaStreamId
                        if (!matchedMatch.alphaStreamId || alpha.stream_type === 'alpha' || alpha.stream_type === 'admin') {
                            matchedMatch.alphaStreamId = alpha.stream_id;
                            matchedMatch.alphaStreamType = alpha.stream_type || 'alpha';
                            matchedMatch.alphaItem = alpha;
                        }
                        if (alpha.home_team_logo && (!matchedMatch.team1 || !matchedMatch.team1.logo || matchedMatch.team1.logo.includes('logo-icon.png'))) {
                            matchedMatch.team1 = { name: alpha.home_team || (matchedMatch.team1 && matchedMatch.team1.name) || '', logo: sanitizeLogoUrl(alpha.home_team_logo) };
                        }
                        if (alpha.away_team_logo && (!matchedMatch.team2 || !matchedMatch.team2.logo || matchedMatch.team2.logo.includes('logo-icon.png'))) {
                            matchedMatch.team2 = { name: alpha.away_team || (matchedMatch.team2 && matchedMatch.team2.name) || '', logo: sanitizeLogoUrl(alpha.away_team_logo) };
                        }
                        if (alpha.poster && (!matchedMatch.poster || matchedMatch.poster.includes('logo-icon.png'))) {
                            matchedMatch.poster = sanitizePosterUrl(alpha.poster);
                        }
                    } else {
                        const newMatch = this.normalizeAlphaMatch(alpha);
                        if (newMatch) {
                            newMatch.streamCornerSources = [{
                                id: alpha.stream_id,
                                type: alpha.stream_type || 'alpha',
                                item: alpha
                            }];
                            this.matches.push(newMatch);
                            addedIndependent = true;
                            matchedAlphaIds.add(alpha.stream_id);
                            matchById.set(alpha.stream_id, newMatch);
                            matchById.set(newMatch.id, newMatch);
                            const nToks = getDistinctiveTokens(newMatch.title || '');
                            for (const t of nToks) {
                                let l = matchByTok.get(t);
                                if (!l) { l = []; matchByTok.set(t, l); }
                                l.push(newMatch);
                            }
                        }
                    }
                }

                if (addedIndependent || this.matches.length > 0) {
                    this.isLoading = false;
                    this.sortMatches();
                    this.emitUpdate();
                    try {
                        const CACHE_KEY = 'aryan_cached_matches_v38';
                        localStorage.setItem(CACHE_KEY, JSON.stringify(this.matches.slice(0, MATCH_CACHE_LIMIT)));
                    } catch (e) {}
                }

                // If user is already in watch view, immediately resolve extra channels and update sources UI!
                if (typeof currentWatchItem !== 'undefined' && currentWatchItem && !currentWatchItem._alphaResolved) {
                    const matchedAlpha = currentWatchItem.alphaStreamId
                        ? this.alphaCatalog.find(a => a.stream_id === currentWatchItem.alphaStreamId)
                        : this.alphaCatalog.find(a => isSameMatch(currentWatchItem, a));
                    if (matchedAlpha) {
                        currentWatchItem.alphaStreamId = matchedAlpha.stream_id;
                        currentWatchItem.alphaStreamType = matchedAlpha.stream_type || 'alpha';
                        currentWatchItem.alphaItem = matchedAlpha;
                        this.resolveAlphaSourcesForMatch(currentWatchItem);
                    }
                }

                // Alpha sources resolved on-demand per match without background CPU contention
            } catch (err) {
                console.warn('StreamCorner Alpha feeds load failed:', err);
            }
        },

        /**
         * Directly pair StreamCorner ID to a match
         */
        attachStreamCornerServersToMatch(match, alphaStreamId) {
            if (!match || !alphaStreamId) return;
            match.alphaStreamId = alphaStreamId;
        },

        /**
         * Ensure extra broadcast channels are paired and resolved for a match
         * Handles cases where Alpha catalog is still loading or match has not yet paired.
         */
        async ensureAlphaSourcesForMatch(match) {
            if (!match) return false;

            // 0. Auto-pair with known stream IDs if mapped
            if (!match.alphaStreamId) {
                if (KNOWN_ALPHA_STREAMS[match.id] || KNOWN_ALPHA_STREAMS[match.rawId]) {
                    match.alphaStreamId = KNOWN_ALPHA_STREAMS[match.id] || KNOWN_ALPHA_STREAMS[match.rawId];
                }
            }

            if (match._alphaResolved) return true;

            // 1. If not already paired and Alpha feeds are currently loading in background, await with a fast timeout
            const hasExistingTargets = match.alphaStreamId || (match.streamCornerSources && match.streamCornerSources.length > 0);
            if (!hasExistingTargets && this._alphaLoadingPromise) {
                try {
                    await Promise.race([
                        this._alphaLoadingPromise,
                        new Promise(resolve => setTimeout(resolve, 2000))
                    ]);
                } catch (e) {}
            }

            // 2. Discover and link matching items in alphaCatalog only if not already paired
            match.streamCornerSources = match.streamCornerSources || [];
            if (match.streamCornerSources.length === 0 && Array.isArray(this.alphaCatalog) && this.alphaCatalog.length > 0) {
                for (const a of this.alphaCatalog) {
                    if (!a || !a.stream_id) continue;
                    if (a.stream_id === match.alphaStreamId || isSameMatch(match, a)) {
                        if (!match.streamCornerSources.some(sc => sc.id === a.stream_id)) {
                            match.streamCornerSources.push({
                                id: a.stream_id,
                                type: a.stream_type || 'alpha',
                                item: a
                            });
                        }
                        if (!match.alphaStreamId || a.stream_type === 'alpha' || a.stream_type === 'admin') {
                            match.alphaStreamId = a.stream_id;
                            match.alphaStreamType = a.stream_type || 'alpha';
                            match.alphaItem = a;
                        }
                    }
                }
            }

            // 3. Resolve extra broadcaster channels across all streamCornerSources
            if (match.streamCornerSources.length > 0 || match.alphaStreamId) {
                return await this.resolveAlphaSourcesForMatch(match);
            }

            return false;
        },

        /**
         * Resolve extra broadcast channels for a match from StreamCorner Alpha/Beta/NBA feeds
         * e.g. Fox Sports, TNT Sports, Sky Sports, Fancode, TSN, Caze TV, beIN Sports, etc.
         */
        async resolveAlphaSourcesForMatch(match) {
            if (!match) return false;
            if (match._alphaResolved) return true;
            if (match._alphaPromise) return await match._alphaPromise;
            if (typeof window === 'undefined') return false;

            // Instant 0ms Cache Check: check localStorage for previously decrypted streams
            const targetKey = match.alphaStreamId || (match.streamCornerSources && match.streamCornerSources[0] && match.streamCornerSources[0].id) || match.id;
            try {
                const cachedRaw = localStorage.getItem('sc_enriched_' + targetKey);
                if (cachedRaw) {
                    const parsed = JSON.parse(cachedRaw);
                    if (parsed && Array.isArray(parsed.servers) && parsed.servers.length > 0 && (Date.now() - (parsed.ts || 0) < 1800000)) {
                        match.servers = parsed.servers;
                        match.sources = parsed.servers;
                        match._alphaResolved = true;
                        return true;
                    }
                }
            } catch (e) {}

            if (!window.StreamCornerCore || !window.StreamCornerCore.w || typeof window.StreamCornerCore.w[6] !== 'function') {
                if (!this._hasAttemptedAutoHeal) {
                    this._hasAttemptedAutoHeal = true;
                    await this.reloadLatestStreamCornerCore();
                }
            }
            if (!window.StreamCornerCore || typeof window.StreamCornerCore.t !== 'function') return false;

            match._alphaPromise = (async () => {
                try {
                    // Yield main thread to allow instant click animations & UI response
                    await new Promise(r => setTimeout(r, 0));

                    // Gather distinct StreamCorner targets to query
                    const targets = [];
                    const seenTargetIds = new Set();
                    const addTarget = (id, type, item) => {
                        if (!id || seenTargetIds.has(id)) return;
                        seenTargetIds.add(id);
                        targets.push({
                            id: id,
                            type: type || (item && item.stream_type) || 'alpha',
                            item: item
                        });
                    };

                    if (Array.isArray(match.streamCornerSources)) {
                        match.streamCornerSources.forEach(sc => addTarget(sc.id, sc.type, sc.item));
                    }
                    if (match.alphaStreamId) {
                        addTarget(match.alphaStreamId, match.alphaStreamType, match.alphaItem);
                    }

                    if (targets.length === 0) return false;

                    // Query at most 2 candidate workers with tight 2500ms timeout
                    const candidateWorkers = [...ALPHA_WORKER_NODES].sort(() => Math.random() - 0.5).slice(0, 2);

                    const fetchTarget = async (t) => {
                        let pType = t.type || 'alpha';
                        if (t.id && String(t.id).startsWith('GRNT')) {
                            pType = 'beta';
                        } else if (!pType) {
                            if (/^00\d+/.test(String(t.id)) || match.sport === 'BASKETBALL') {
                                pType = 'nba';
                            } else {
                                pType = 'alpha';
                            }
                        }

                        for (const worker of candidateWorkers) {
                            try {
                                const fetchPromise = new Promise((resolve, reject) => {
                                    const timer = setTimeout(() => reject(new Error('timeout')), 2500);
                                    window.StreamCornerCore.t(`https://${worker}/corner?p=${pType}&id=${t.id}`, false, match.title || 'corner detail')
                                        .then(res => {
                                            clearTimeout(timer);
                                            const hasStreams = res && ((Array.isArray(res.streams) && res.streams.length > 0) || (Array.isArray(res.live) && res.live.length > 0));
                                            if (hasStreams) resolve(res);
                                            else reject(new Error('empty'));
                                        })
                                        .catch(err => {
                                            clearTimeout(timer);
                                            reject(err);
                                        });
                                });
                                const res = await fetchPromise;
                                if (res) return res;
                            } catch (e) {
                                await new Promise(r => setTimeout(r, 0));
                            }
                        }
                        return null;
                    };

                    const results = await Promise.allSettled(targets.map(fetchTarget));

                    let rawStreams = [];
                    const seenRawUrls = new Set();
                    results.forEach(r => {
                        if (r.status === 'fulfilled' && r.value) {
                            const d = r.value;
                            const list = Array.isArray(d.streams) ? d.streams : (Array.isArray(d.live) ? d.live : []);
                            list.forEach(s => {
                                const u = (s.embed_url || s.stream_url || '').trim();
                                if (u && !seenRawUrls.has(u)) {
                                    seenRawUrls.add(u);
                                    rawStreams.push(s);
                                }
                            });
                        }
                    });

                    if (rawStreams.length === 0 && typeof window !== 'undefined' && !this._hasAttemptedAutoHeal) {
                        this._hasAttemptedAutoHeal = true;
                        const healed = await this.reloadLatestStreamCornerCore();
                        if (healed) {
                            return await this.resolveAlphaSourcesForMatch(match);
                        }
                    }

                    if (rawStreams.length > 0) {
                        // 1. Keep base PPV servers, filtering out any stray or duplicate channels
                        const baseServers = (match.servers || []).filter(s => {
                            const u = s.url || '';
                            if (/embedindia\.st\/embed\/\d+$/i.test(u) && !u.includes('backup=')) return false;
                            if (u.includes('pandecocogaming') || u.includes('/api/embed') || u.includes('getsugatensho')) return false;
                            return true;
                        });

                        const seenKeys = new Set();
                        baseServers.forEach(s => {
                            const k = getCanonicalServerKey(s.rawUrl || s.url);
                            if (k) seenKeys.add(k);
                        });

                        const newServers = [];

                        rawStreams.forEach((s) => {
                            const rawUrl = (s.embed_url || s.stream_url || '').trim();
                            if (!rawUrl) return;

                            let label = (s.source_name || s.name || 'Feed').trim().replace(/\s*-\s*$/, '');

                            // Drop generic unwanted branding
                            if (/streamcorner/i.test(label) || /streamcorner/i.test(rawUrl)) return;
                            if (/embedindia|damitv|ppv/i.test(rawUrl) || /embedindia|damitv|ppv/i.test(label)) return;

                            const key = getCanonicalServerKey(rawUrl);
                            if (key && seenKeys.has(key)) return;
                            if (key) seenKeys.add(key);

                            const isDirectHls = !rawUrl.includes('.mpd') && !rawUrl.includes('cenc') && rawUrl.includes('.m3u8');
                            const srvUrl = isDirectHls ? rawUrl : toProxiedEmbedUrl(rawUrl);
                            const cleanLabel = extractCleanServerLabel(label, rawUrl, newServers.length);

                            newServers.push({
                                name: cleanLabel,
                                url: srvUrl,
                                rawUrl: rawUrl,
                                type: isDirectHls ? 'video' : 'iframe',
                                hd: true
                            });
                        });

                        // Place StreamCorner feeds first, followed by base PPV feeds, and sanitize
                        const combined = sanitizeMatchServers({ servers: [...newServers, ...baseServers] }).servers;

                        match.servers = combined;
                        match.sources = combined;
                        match._alphaResolved = true;

                        // Real-time update if user is currently viewing this match
                        if (typeof currentWatchItem !== 'undefined' && currentWatchItem && (currentWatchItem.id === match.id || currentWatchItem.alphaStreamId === match.alphaStreamId || (currentWatchItem.streamCornerSources && currentWatchItem.streamCornerSources.some(sc => seenTargetIds.has(sc.id))))) {
                            const prevActiveIdx = (window.AryanPlayerEngine && window.AryanPlayerEngine.activeServerIdx) || 0;
                            const currentPlayingServer = currentWatchItem.servers && currentWatchItem.servers[prevActiveIdx];
                            const currentPlayingUrl = currentPlayingServer ? (currentPlayingServer.rawUrl || currentPlayingServer.url) : null;
                            const wasUninitialized = !currentPlayingUrl || (baseServers.length === 0) || !window.AryanPlayerEngine || !window.AryanPlayerEngine.getServers().length;

                            currentWatchItem.servers = match.servers;
                            currentWatchItem.sources = match.servers;
                            currentWatchItem._alphaResolved = true;

                            let newActiveIdx = 0;
                            if (window.AryanPlayerEngine) {
                                window.AryanPlayerEngine.currentStream = currentWatchItem;
                                if (wasUninitialized) {
                                    newActiveIdx = 0;
                                    window.AryanPlayerEngine.activeServerIdx = 0;
                                    if (typeof window.AryanPlayerEngine.reloadPlayer === 'function') {
                                        window.AryanPlayerEngine.reloadPlayer();
                                    }
                                } else if (currentPlayingUrl) {
                                    const matchIdx = match.servers.findIndex(srv => (srv.rawUrl || srv.url) === currentPlayingUrl);
                                    if (matchIdx !== -1) {
                                        newActiveIdx = matchIdx;
                                        window.AryanPlayerEngine.activeServerIdx = newActiveIdx;
                                    } else {
                                        newActiveIdx = prevActiveIdx;
                                    }
                                }
                            }

                            if (typeof renderWatchSources === 'function') {
                                renderWatchSources(currentWatchItem, newActiveIdx);
                            }
                        }

                        // Persist enriched servers into localStorage cache so repeat visits have 0ms latency
                        try {
                            const CACHE_KEY = `sc_enriched_${match.alphaStreamId || match.id}`;
                            localStorage.setItem(CACHE_KEY, JSON.stringify({ servers: match.servers, ts: Date.now() }));
                        } catch (e) {}

                        return true;
                    }

                    return false;
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
            if (typeof currentView !== 'undefined' && currentView === 'watch') return;
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
                if (!scriptText || !scriptText.includes('StreamCornerCore')) return false;

                // Execute updated script to refresh window.StreamCornerCore on the fly
                const scriptEl = document.createElement('script');
                scriptEl.textContent = scriptText;
                document.head.appendChild(scriptEl);
                this._hasAttemptedAutoHeal = false;
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

        parseTimeET(str) {
            if (!str || typeof str !== 'string') return 0;
            const s = str.trim();
            if (s.toUpperCase().includes('LIVE')) return Date.now();
            const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)?\s*(?:ET|EDT|EST)?/i);
            if (m) {
                let [_, month, day, year, hour, min, ampm] = m;
                if (year.length === 2) year = '20' + year;
                let h = parseInt(hour, 10);
                if (ampm) {
                    if (ampm.toUpperCase() === 'PM' && h < 12) h += 12;
                    if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
                }
                const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${String(h).padStart(2, '0')}:${min.padStart(2, '0')}:00-04:00`;
                const ts = new Date(iso).getTime();
                return isNaN(ts) ? 0 : ts;
            }
            return 0;
        },

        /**
         * Normalize a fixture item from StreamCorner Alpha feeds
         * For independent fixtures (e.g. CPL, UFC, Formula 1, MotoGP, etc.)
         */
        normalizeAlphaMatch(alpha) {
            if (!alpha) return null;

            const catUpper = (alpha.category || '').toUpperCase();
            const rawTitle = (alpha.event_name || (alpha.home_team && alpha.away_team ? `${alpha.home_team} vs. ${alpha.away_team}` : alpha.home_team || alpha.away_team) || '').trim();
            const titleLower = rawTitle.toLowerCase();

            // Strictly reject non-sports 24/7 linear channels or entertainment loops (e.g. Family Guy, South Park)
            if (catUpper.includes('24/7') || titleLower.includes('family guy') || titleLower.includes('south park')) {
                return null;
            }

            // Discard Alpha/NBA matches that have already ended (ended more than 15 minutes ago or marked Final)
            if (alpha.time && alpha.time.toLowerCase() === 'final') {
                return null;
            }

            let startTs = alpha.timestamp ? (alpha.timestamp * 1000) : 0;
            if (!startTs && alpha.time_utc) {
                startTs = new Date(alpha.time_utc + ' UTC').getTime() || 0;
            }
            if (!startTs && alpha.time_et) {
                startTs = this.parseTimeET(alpha.time_et);
            }
            if (!startTs && alpha.start_time) {
                startTs = new Date(alpha.start_time).getTime() || 0;
            }

            const now = Date.now();
            const endTs = (alpha.end_time ? new Date(alpha.end_time).getTime() : 0) || (startTs ? startTs + 10800000 : 0);

            // Filter out finished / expired matches
            if (endTs > 0 && now > (endTs + 900000)) {
                return null;
            }

            const timeStr = (alpha.time || alpha.time_et || '').toLowerCase();
            // Strictly match in-game quarter/half/set indicators without falsely matching "1st Round", "2nd Leg", "1st T20I"
            const isExplicitLive = Boolean(
                /\b(?:live|ht|halftime|half-time|overtime|ot)\b/i.test(timeStr) ||
                /\b(?:1st|2nd|3rd|4th)\s*(?:qtr|quarter|half|period|set)\b/i.test(timeStr) ||
                /\b(?:q[1-4]|set\s*\d)\b/i.test(timeStr)
            );
            const isTimeLive = Boolean(startTs > 0 && now >= startTs && (!endTs || now <= endTs));
            const isLive = Boolean((isExplicitLive || isTimeLive) && (!endTs || now <= endTs));

            const rawCat = (alpha.category || '').toLowerCase().replace(/[\s_]+/g, '-');
            const league = (alpha.league || alpha.category || 'Sports').trim();
            const sport = SPORT_MAPPINGS[rawCat] || SPORT_MAPPINGS[league.toLowerCase()] || (alpha.category ? alpha.category.toUpperCase() : 'OTHERS');

            const team1Name = alpha.home_team || rawTitle.split(/ vs\.? | @ | x /i)[0] || rawTitle;
            const team2Name = alpha.away_team || rawTitle.split(/ vs\.? | @ | x /i)[1] || '';

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
                poster: sanitizePosterUrl(alpha.poster || ''),
                categoryLogo: sanitizeLogoUrl(alpha.category_logo || ''),
                colors: [],
                team1: { name: team1Name, logo: sanitizeLogoUrl(alpha.home_team_logo || '') },
                team2: { name: team2Name, logo: sanitizeLogoUrl(alpha.away_team_logo || '') },
                rawCategory: rawCat,
                servers: [],
                sources: [],
                alphaStreamId: alpha.stream_id,
                alphaStreamType: alpha.stream_type || 'alpha',
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

            // Exclude synthetic / manual / phantom CMS test fixtures & non-existent matches
            const sIdLower = String(s.id || '').toLowerCase();
            const sTitleLower = String(s.name || s.title || '').toLowerCase();
            if (s.isManual || s.auto === 'own' || sIdLower.startsWith('mm-own') || sIdLower.startsWith('mm-yl') || sIdLower.startsWith('mm-cric')) {
                return null;
            }
            if (sTitleLower.includes('diriyah') && sTitleLower.includes('riyadh')) {
                return null;
            }
            if (sTitleLower.includes('wolverhampton') && (sTitleLower.includes('portsmouth') || sTitleLower.includes('pompey'))) {
                return null;
            }
            if (Array.isArray(s.sources) && s.sources.length === 1 && String(s.sources[0].source || '').toLowerCase() === 'manual') {
                return null;
            }
            if (Array.isArray(s.sources) && s.sources.length === 1 && String(s.sources[0].source || '').toLowerCase() === 'manual') {
                return null;
            }

            const isLive = !isAlwaysLive && (startTs > 0 && now >= startTs && now <= endTs);

            const title = (s.name || s.title || 'Live Event').trim();
            const rawCat = (s.category || catName || '').toLowerCase().replace(/[\s_]+/g, '-');
            const catKey = (catName || '').toLowerCase().replace(/[\s_]+/g, '-');
            const sport = SPORT_MAPPINGS[rawCat] || SPORT_MAPPINGS[catKey] || SPORT_MAPPINGS[tag.toLowerCase()] || (catName ? catName.toUpperCase() : 'OTHERS');

            const homeObj = s.teams && s.teams.home ? s.teams.home : null;
            const awayObj = s.teams && s.teams.away ? s.teams.away : null;

            const team1Name = (homeObj && homeObj.name ? homeObj.name : (title.split(/ vs\.? | @ /)[0] || title)).trim();
            const team2Name = (awayObj && awayObj.name ? awayObj.name : (title.split(/ vs\.? | @ /)[1] || '')).trim();

            const team1Logo = homeObj && homeObj.badge ? sanitizeLogoUrl(homeObj.badge) : (s.team1 && s.team1.logo ? sanitizeLogoUrl(s.team1.logo) : '');
            const team2Logo = awayObj && awayObj.badge ? sanitizeLogoUrl(awayObj.badge) : (s.team2 && s.team2.logo ? sanitizeLogoUrl(s.team2.logo) : '');

            const servers = [];
            const seenUrls = new Set();
            const addServer = (name, url, isHd = true) => {
                if (!url || seenUrls.has(url)) return;
                if (url.includes('taifood-blog.asia') || url.includes('/embed/manual/')) return;
                seenUrls.add(url);
                servers.push({
                    name: name,
                    url: url,
                    type: url.includes('.m3u8') ? 'video' : 'iframe',
                    hd: isHd
                });
            };

            // 0. Match with Alpha catalog if present
            let matchedAlphaId = null;
            let matchedAlphaType = null;
            let matchedAlphaItem = null;
            if (KNOWN_ALPHA_STREAMS[s.id] || KNOWN_ALPHA_STREAMS[s.rawId]) {
                matchedAlphaId = KNOWN_ALPHA_STREAMS[s.id] || KNOWN_ALPHA_STREAMS[s.rawId];
            } else if (Array.isArray(this.alphaCatalog) && this.alphaCatalog.length > 0) {
                const matched = this.alphaCatalog.find(a => isSameMatch(s, a));
                if (matched) {
                    matchedAlphaId = matched.stream_id;
                    matchedAlphaType = matched.stream_type || 'alpha';
                    matchedAlphaItem = matched;
                }
            }

            // 1. Authenticate and build stream servers without artificial duplicate backups
            const mainEmbed = s.iframe || s.embedUrl || s.url || '';
            const mainLabel = (s.source_tag || '').trim() || 'Main Feed';

            if (Array.isArray(s.substreams) && s.substreams.length > 0) {
                s.substreams.forEach((sub, sIdx) => {
                    const subUrl = sub.url || sub.iframe || sub.embedUrl;
                    if (subUrl) {
                        let label = (sub.source_tag || sub.source || sub.name || '').trim();
                        if (sub.locale && !label.toLowerCase().includes(sub.locale.toLowerCase())) {
                            label += ` (${sub.locale.toUpperCase()})`;
                        }
                        const finalLabel = extractCleanServerLabel(label, subUrl, sIdx);
                        addServer(finalLabel, subUrl);
                    }
                });
            }
            if (Array.isArray(s.sources) && s.sources.length > 0) {
                s.sources.forEach((srcItem, sIdx) => {
                    if (srcItem && srcItem.source && srcItem.id) {
                        const rawSrc = String(srcItem.source || '').trim();
                        if (rawSrc.toLowerCase() === 'manual') return; // Skip non-existent manual CMS sources
                        const embedUrl = `https://embed.st/embed/${srcItem.source}/${srcItem.id}/1`;
                        const isInternal = INTERNAL_SERVER_NAMES.test(rawSrc) || /^(?:hotel|alpha|beta|golf|admin|delta|echo|streamcorner)$/i.test(rawSrc);
                        const cleanLabel = isInternal ? (servers.length === 0 ? 'Main Server' : `Server ${servers.length + 1}`) : extractCleanServerLabel(rawSrc, embedUrl, servers.length);
                        addServer(cleanLabel, embedUrl);
                    }
                });
            }
            if (servers.length === 0) {
                if (mainEmbed && !mainEmbed.includes('taifood-blog.asia')) {
                    const finalLabel = extractCleanServerLabel(mainLabel, mainEmbed, 0);
                    addServer(finalLabel, mainEmbed);
                }
            }

            // Clean, deduplicate against canonical keys, and re-index server names
            const cleanServers = sanitizeMatchServers({ servers: servers }).servers;

            // Discard ghost match if it has NO valid servers and NO matched StreamCorner Alpha feed
            if (cleanServers.length === 0 && !matchedAlphaId) {
                return null;
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
                categoryLogo: sanitizeLogoUrl(s.category_logo || ''),
                colors: s.colors || [],
                team1: { name: team1Name, logo: team1Logo },
                team2: { name: team2Name, logo: team2Logo },
                rawCategory: catKey,
                servers: cleanServers,
                sources: cleanServers,
                alphaStreamId: matchedAlphaId || null,
                alphaStreamType: matchedAlphaType || null,
                alphaItem: matchedAlphaItem || null,
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

        deduplicateMatchesList() {
            if (!Array.isArray(this.matches) || this.matches.length === 0) return;
            const unique = [];
            const seenIds = new Set();
            const tokenMap = new Map();

            for (let i = 0; i < this.matches.length; i++) {
                const m = this.matches[i];
                if (!m) continue;
                if (m.id && seenIds.has(m.id)) continue;

                let dup = null;

                // 1. Direct ID / Stream ID match
                if (m.rawId && seenIds.has(String(m.rawId))) {
                    dup = unique.find(u => u.rawId && String(u.rawId) === String(m.rawId));
                } else if (m.alphaStreamId && seenIds.has(m.alphaStreamId)) {
                    dup = unique.find(u => u.alphaStreamId && u.alphaStreamId === m.alphaStreamId);
                } else if (m.uriName && seenIds.has(m.uriName)) {
                    dup = unique.find(u => u.uriName && u.uriName === m.uriName);
                }

                // 2. Distinctive token index lookup
                if (!dup) {
                    const mToks = getDistinctiveTokens(m.title || '');
                    if (mToks.length >= 2) {
                        const candidates = new Set();
                        for (const t of mToks) {
                            const list = tokenMap.get(t);
                            if (list) {
                                for (const cand of list) candidates.add(cand);
                            }
                        }
                        for (const cand of candidates) {
                            if (isSameMatch(cand, m)) {
                                dup = cand;
                                break;
                            }
                        }
                    }
                }

                if (dup) {
                    if (m.id) seenIds.add(m.id);
                    if (m.rawId) seenIds.add(String(m.rawId));
                    if (m.alphaStreamId) seenIds.add(m.alphaStreamId);
                    if (m.uriName) {
                        seenIds.add(m.uriName);
                        if (!dup.uriName) dup.uriName = m.uriName;
                    }
                    if (m.isFutbolX) dup.isFutbolX = true;

                    // Merge servers cleanly using canonical key deduplication
                    const combinedServers = [...(dup.servers || []), ...(m.servers || [])];
                    dup.servers = sanitizeMatchServers({ servers: combinedServers }).servers;
                    dup.sources = dup.servers;

                    // Link all StreamCorner streams
                    dup.streamCornerSources = dup.streamCornerSources || [];
                    if (dup.alphaStreamId && !dup.streamCornerSources.some(sc => sc.id === dup.alphaStreamId)) {
                        dup.streamCornerSources.push({
                            id: dup.alphaStreamId,
                            type: dup.alphaStreamType || 'alpha',
                            item: dup.alphaItem
                        });
                    }
                    if (Array.isArray(m.streamCornerSources)) {
                        m.streamCornerSources.forEach(sc => {
                            if (!dup.streamCornerSources.some(s => s.id === sc.id)) {
                                dup.streamCornerSources.push(sc);
                            }
                        });
                    } else if (m.alphaStreamId) {
                        if (!dup.streamCornerSources.some(s => s.id === m.alphaStreamId)) {
                            dup.streamCornerSources.push({
                                id: m.alphaStreamId,
                                type: m.alphaStreamType || 'alpha',
                                item: m.alphaItem
                            });
                        }
                    }

                    if (!dup.alphaStreamId || (m.alphaStreamType === 'alpha' && dup.alphaStreamType !== 'alpha')) {
                        dup.alphaStreamId = m.alphaStreamId || dup.alphaStreamId;
                        dup.alphaStreamType = m.alphaStreamType || dup.alphaStreamType || 'alpha';
                        dup.alphaItem = m.alphaItem || dup.alphaItem;
                    }
                    dup._alphaResolved = dup._alphaResolved || m._alphaResolved;

                    // Prefer authentic poster / logos
                    if ((!dup.poster || dup.poster.includes('logo-icon.png')) && m.poster && !m.poster.includes('logo-icon.png')) {
                        dup.poster = m.poster;
                    }
                    if ((!dup.team1 || !dup.team1.logo) && (m.team1 && m.team1.logo)) {
                        dup.team1 = m.team1;
                    }
                    if ((!dup.team2 || !dup.team2.logo) && (m.team2 && m.team2.logo)) {
                        dup.team2 = m.team2;
                    }
                    if (!dup.categoryLogo && m.categoryLogo) {
                        dup.categoryLogo = m.categoryLogo;
                    }
                    if (m.isLive) dup.isLive = true;
                } else {
                    if (m.id) seenIds.add(m.id);
                    if (m.rawId) seenIds.add(String(m.rawId));
                    if (m.alphaStreamId) seenIds.add(m.alphaStreamId);
                    if (m.uriName) seenIds.add(m.uriName);
                    unique.push(m);

                    const toks = getDistinctiveTokens(m.title || '');
                    for (const t of toks) {
                        let l = tokenMap.get(t);
                        if (!l) { l = []; tokenMap.set(t, l); }
                        l.push(m);
                    }
                }
            }
            this.matches = unique;
        },

        rebuildMatchIndex() {
            const map = new Map();
            for (const m of this.matches) {
                if (!m) continue;
                if (m.id) map.set(m.id, m);
                if (m.rawId) {
                    const rawStr = String(m.rawId);
                    map.set(rawStr, m);
                    map.set(`ppv-${rawStr}`, m);
                    map.set(`dami-${rawStr}`, m);
                    map.set(`alpha-${rawStr}`, m);
                }
                if (m.alphaStreamId) {
                    map.set(m.alphaStreamId, m);
                    map.set(`alpha-${m.alphaStreamId}`, m);
                }
                if (m.uriName) {
                    map.set(m.uriName, m);
                    map.set(`fx-${m.uriName}`, m);
                }
                if (Array.isArray(m.streamCornerSources)) {
                    for (const sc of m.streamCornerSources) {
                        if (sc && sc.id) {
                            map.set(sc.id, m);
                            map.set(`alpha-${sc.id}`, m);
                        }
                    }
                }
            }
            this._matchById = map;
        },

        sortMatches() {
            this.deduplicateMatchesList();
            this.matches.sort((a, b) => {
                const aLive = a.isLive && !this.isExcludedFromLiveNow(a);
                const bLive = b.isLive && !this.isExcludedFromLiveNow(b);
                // Live matches always on top
                if (aLive && !bLive) return -1;
                if (!aLive && bLive) return 1;
                // Upcoming fixtures sorted chronologically; non-timestamped items go to bottom (Infinity)
                const aTime = (a.startTime && a.startTime > 0) ? a.startTime : Infinity;
                const bTime = (b.startTime && b.startTime > 0) ? b.startTime : Infinity;
                return aTime - bTime;
            });
            this.rebuildMatchIndex();
        },

        updateLiveStatuses() {
            const now = Date.now();
            // Strictly remove matches that ended more than 15 minutes ago or started > 4h ago
            this.matches = this.matches.filter(m => {
                if (m.isAlwaysLive || m.always_live === 1 || !m.endTime) return true;
                if (m.startTime && now > (m.startTime + 14400000)) return false;
                return now <= (m.endTime + 900000);
            });
            this.matches.forEach(m => {
                if (m.isAlwaysLive || m.always_live === 1 || m.tag === '24/7 channel' || m.tag === '24/7 streams' || !m.startTime || this.isExcludedFromLiveNow(m)) {
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

            // 1. Instant O(1) indexed lookup
            if (this._matchById && this._matchById.has(decoded)) {
                return this._matchById.get(decoded);
            }
            const stripped = decoded.replace(/^(ppv|dami|alpha|fx)-/i, '');
            if (this._matchById && this._matchById.has(stripped)) {
                return this._matchById.get(stripped);
            }

            // 2. Hex stream ID or NBA game ID lookup
            const hexMatch = decoded.match(/([a-f0-9]{32})/i) || stripped.match(/([a-f0-9]{32})/i);
            const nbaMatch = decoded.match(/\b(00\d{8})\b/) || stripped.match(/\b(00\d{8})\b/);
            const streamId = hexMatch ? hexMatch[1] : (nbaMatch ? nbaMatch[1] : null);
            if (streamId && this._matchById && this._matchById.has(streamId)) {
                return this._matchById.get(streamId);
            }

            const slug = decoded.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

            // 3. Fallback search by ID, slug, and path tokens
            let found = this.matches.find(m => {
                if (m.id === decoded || m.id === stripped || m.rawId === decoded || m.rawId === stripped) return true;
                if (m.slug && m.slug === slug) return true;
                const mSlug = (m.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                return mSlug && (mSlug === slug || mSlug.includes(slug) || (slug.length > 5 && slug.includes(mSlug)));
            });

            if (!found) {
                found = this.matches.find(m => {
                    const uStr = JSON.stringify(m.servers || []).toLowerCase();
                    if (uStr.includes(stripped.toLowerCase())) return true;
                    const slugParts = stripped.toLowerCase().split(/[\/\-_]/).filter(p => p.length >= 3 && !['2026', '2025', '2024', 'ppv', 'embed', 'live'].includes(p));
                    if (slugParts.length >= 2) {
                        const mTitleLower = (m.title || '').toLowerCase();
                        if (slugParts.every(p => mTitleLower.includes(p))) return true;
                    }
                    return false;
                });
            }

            // 3.5. Search futbolxCatalog directly for independent FutbolX links
            if (!found && Array.isArray(this.futbolxCatalog) && this.futbolxCatalog.length > 0) {
                const fx = this.futbolxCatalog.find(f => f.uri_name === stripped || f.uri_name === decoded || f.id === decoded || f.id === ('fx-' + stripped));
                if (fx) {
                    const fxStreams = (fx.streams || []).map((s, idx) => ({
                        name: `FX ${idx + 1} - ${s.title || 'Feed'}`,
                        url: `shaka_player.html?hls=${encodeURIComponent(s.url)}`,
                        rawUrl: s.url,
                        type: 'iframe',
                        isFutbolX: true,
                        hd: true
                    }));
                    found = this.normalizeFutbolXMatch(fx, fxStreams);
                    if (found) {
                        this.matches.push(found);
                        if (this._matchById) {
                            this._matchById.set(found.id, found);
                            if (found.rawId) this._matchById.set(String(found.rawId), found);
                            if (found.uriName) this._matchById.set(found.uriName, found);
                        }
                    }
                }
            }

            // 4. Search alphaCatalog directly for independent stream links
            if (!found && Array.isArray(this.alphaCatalog) && this.alphaCatalog.length > 0) {
                const targetId = streamId || stripped || decoded;
                const alpha = this.alphaCatalog.find(a => a.stream_id === targetId || a.stream_id === stripped || a.stream_id === decoded);
                if (alpha) {
                    found = this.normalizeAlphaMatch(alpha);
                    if (found) {
                        this.matches.push(found);
                        if (this._matchById) {
                            this._matchById.set(found.id, found);
                            if (found.alphaStreamId) this._matchById.set(found.alphaStreamId, found);
                        }
                    }
                }
            }

            if (!found && hexMatch) {
                found = {
                    id: `alpha-${streamId}`,
                    rawId: streamId,
                    alphaStreamId: streamId,
                    source: 'streamcorner',
                    title: 'Live Stream Event',
                    sport: 'OTHERS',
                    league: 'LIVE STREAM',
                    rawLeague: 'Live Stream',
                    category: 'Sports',
                    startTime: Date.now() - 1800000,
                    endTime: Date.now() + 7200000,
                    isLive: true,
                    always_live: 0,
                    isAlwaysLive: false,
                    tag: 'Live Stream',
                    status: 'live',
                    poster: '',
                    categoryLogo: '',
                    colors: [],
                    team1: { name: 'Live Stream', logo: '' },
                    team2: { name: '', logo: '' },
                    rawCategory: 'sports',
                    servers: [],
                    sources: [],
                    _alphaResolved: false
                };
                this.matches.push(found);
                if (this._matchById) {
                    this._matchById.set(found.id, found);
                    this._matchById.set(streamId, found);
                }
            }

            if (found && !found.alphaStreamId) {
                if (KNOWN_ALPHA_STREAMS[found.id] || KNOWN_ALPHA_STREAMS[found.rawId]) {
                    found.alphaStreamId = KNOWN_ALPHA_STREAMS[found.id] || KNOWN_ALPHA_STREAMS[found.rawId];
                }
            }

            if (found && !found._alphaResolved) {
                try {
                    const cacheKey = `sc_enriched_${found.alphaStreamId || found.id}`;
                    const raw = localStorage.getItem(cacheKey);
                    if (raw) {
                        const parsed = JSON.parse(raw);
                        if (parsed && Array.isArray(parsed.servers) && parsed.servers.length > 0 && (Date.now() - parsed.ts < 1800000)) {
                            found.servers = parsed.servers;
                            found.sources = parsed.servers;
                            found._alphaResolved = true;
                        }
                    }
                } catch (e) {}
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
            // Never include future fixtures in Live Now
            if (m.startTime && m.startTime > Date.now()) return true;

            const t = (m.title || '').toLowerCase();
            const l = (m.league || '').toLowerCase();
            const s = (m.sport || '').toLowerCase();
            const c = (m.rawCategory || '').toLowerCase();

            // Exclude Golf ("gold")
            if (s === 'golf' || c === 'golf' || t.includes('golf') || l.includes('golf')) {
                return true;
            }

            // Exclude 24/7 streams / network loops / cartoons
            if (s === '24/7 streams' || c === '24/7-streams' || t.includes('24/7') || l.includes('24/7') || t.includes('family guy')) {
                return true;
            }

            // Exclude Red Zone / Multi-feed channels
            if (t.includes('red zone') || t.includes('redzone') || l.includes('red zone') || l.includes('redzone') || t.includes('multi feed') || t.includes('multifeed')) {
                return true;
            }

            // Exclude 24/7 linear sports network channels from live match showcase
            const linearChannels = ['nfl network', 'fox footy', 'fox cricket', 'fox league', 'willow', 'rally tv', 'sky sports golf', 'sky sports news', 'tennis channel'];
            if (linearChannels.some(ch => t === ch || t.startsWith(ch + ' '))) {
                return true;
            }

            return false;
        },

        getLiveMatches() {
            const now = Date.now();
            return this.matches.filter(m => {
                if (!m.isLive || this.isExcludedFromLiveNow(m)) return false;
                if (m.startTime && m.startTime > now) return false;
                if (m.endTime && now > (m.endTime + 900000)) return false;
                return true;
            });
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
