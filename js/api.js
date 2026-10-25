/**
 * AryanStreams Global - Automated Live Sports & Stream Aggregation Engine
 * Real-time integration with:
 * 1. Futbol-X Public API (https://www.futbol-x.xyz/api)
 * 2. PPV Services (https://ppv.st)
 * 3. 24/7 Live TV Channels Catalog (DaddyHD & TimStreams)
 */

(function () {
    'use strict';

    const FUTBOLX_API_BASE = 'https://www.futbol-x.xyz/api';
    const isBrowser = typeof window !== 'undefined' && typeof window.location !== 'undefined';
    const hostname = isBrowser ? (window.location.hostname || '') : '';
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
        let langSuffix = '';
        if (name) {
            const bracketMatch = name.match(/\[(.*?)\]/);
            if (bracketMatch && bracketMatch[1]) {
                const bLower = bracketMatch[1].trim().toLowerCase();
                if (bLower === 'en' || bLower === 'eng' || bLower === 'english' || bLower === 'en-gb' || bLower === 'en-us') langSuffix = ' (English)';
                else if (bLower === 'es' || bLower === 'esp' || bLower === 'español' || bLower === 'spanish') langSuffix = ' (Español)';
                else if (bLower === 'pt' || bLower === 'por' || bLower === 'português' || bLower === 'portuguese') langSuffix = ' (Português)';
                else if (bLower === 'fr' || bLower === 'fra' || bLower === 'french') langSuffix = ' (Français)';
                else if (bLower === 'de' || bLower === 'ger' || bLower === 'german') langSuffix = ' (Deutsch)';
                else if (bLower === 'it' || bLower === 'ita' || bLower === 'italian') langSuffix = ' (Italiano)';
                else if (bLower === 'hi' || bLower === 'hin' || bLower === 'hindi') langSuffix = ' (Hindi)';
                else if (bLower === 'sv' || bLower === 'swe') langSuffix = ' (Svenska)';
                else langSuffix = ` (${bracketMatch[1].trim().toUpperCase()})`;
            }
            label = name.replace(/\[.*?\]/g, '')
                        .replace(/^server\s*\d*\s*[-:]*\s*/i, '')
                        .replace(/^stream\s*\d*\s*[-:]*\s*/i, '')
                        .replace(/^feed\s*\d*\s*[-:]*\s*/i, '')
                        .trim();
            if (!label && langSuffix) {
                label = langSuffix.replace(/^[ \(\[]+|[ \)\/\]]+$/g, '');
                langSuffix = '';
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

        if (langSuffix && !label.includes(langSuffix) && !label.toLowerCase().includes(langSuffix.toLowerCase().replace(/[()]/g, '').trim())) {
            label = `${label} ${langSuffix}`.trim();
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
        if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
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

    function getMatchCanonicalKey(title) {
        if (!title || typeof title !== 'string') return '';
        const clean = cleanMatchStr(title);
        const parts = clean.split(/\s+(?:vs\.?|@|-|x)\s+/i);
        if (parts.length >= 2) {
            const p1 = parts[0].replace(/[^a-z0-9]/g, '');
            const p2 = parts[1].replace(/[^a-z0-9]/g, '');
            return p1 < p2 ? `${p1}_vs_${p2}` : `${p2}_vs_${p1}`;
        }
        return clean.replace(/[^a-z0-9]/g, '');
    }

    function generateUniversalMatchSlug(title) {
        if (!title || typeof title !== 'string') return '';
        let s = cleanMatchStr(title);
        s = s.replace(/\|.*$/g, '');
        s = s.replace(/\[.*?\]/g, '');
        s = s.replace(/\(.*?\)/g, '');
        s = s.replace(/\s+(?:vs\.?|@|x|v\.?)\s+/gi, ' vs ');
        s = s.toLowerCase()
            .replace(/['"’`]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return s;
    }

    function sanitizePosterUrl(url) {
        if (!url || typeof url !== 'string') return '';
        url = url.trim();
        if (!url || url.includes('logo-icon.png') || url.includes('poocloud.in')) return '';
        if (url.includes('serveproxy.com') || url.includes('wsrv.nl/?url=')) return url;
        if (url.startsWith('/api/images') || url.startsWith('/images') || url.startsWith('api/images')) {
            url = 'https://streamed.pk/' + url.replace(/^\/+/, '');
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
            } else if (/^[a-zA-Z0-9_\-=+]{20,}$/.test(url)) {
                url = `https://streamed.pk/api/images/proxy/${encodeURIComponent(url)}.webp`;
            }
        }
        if (url.includes('streamed.pk') || url.includes('static.ppvservices.st')) {
            return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=140&output=webp`;
        }
        return url;
    }

    function prioritizeFxServers(servers, isLive) {
        if (!Array.isArray(servers) || servers.length <= 1) return servers || [];
        const isFx = (s) => Boolean(s && (s.isFutbolX || /^FX\s*\d*/i.test(s.name || '') || (s.url && (s.url.includes('futbolx') || s.url.includes('ryzn.pro'))) || (s.rawUrl && (s.rawUrl.includes('futbolx') || s.rawUrl.includes('ryzn.pro')))));
        const isTaifood = (s) => Boolean(s && ((s.url || '').includes('taifood-blog.asia') || (s.rawUrl || '').includes('taifood-blog.asia')));

        const fxList = [];
        const taifoodList = [];
        const otherList = [];
        for (const s of servers) {
            if (isTaifood(s)) taifoodList.push(s);
            else if (isFx(s)) fxList.push(s);
            else otherList.push(s);
        }
        return [...fxList, ...otherList, ...taifoodList];
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

        const sorted = prioritizeFxServers(clean, match ? match.isLive : false);
        match.servers = sorted;
        match.sources = sorted;
        return match;
    }

    function isUnwantedMatch(item) {
        if (!item) return true;
        const title = (item.title || item.name || item.event_name || '').toLowerCase().trim();
        const home = (item.home_team || (item.team1 && item.team1.name) || '').toLowerCase().trim();
        const away = (item.away_team || (item.team2 && item.team2.name) || '').toLowerCase().trim();
        const id = String(item.id || item.rawId || item.stream_id || '').toLowerCase();

        // 1. Phantom / Fake / Test fixtures (Diriyah, Pompey, Placeholder, Test)
        if (title.includes('diriyah') || home.includes('diriyah') || away.includes('diriyah') || id.includes('diriyah')) return true;
        if (title.includes('pompey') || home.includes('pompey') || away.includes('pompey')) return true;
        if (title.includes('placeholder') || (title.includes('test match') && !title.includes('cricket') && !(item.sport && item.sport.includes('CRICKET'))) || title.includes('sample match') || title.includes('demo match')) return true;
        if (id.startsWith('mm-own') || id.startsWith('mm-yl') || id.startsWith('mm-cric') || item.isManual || item.auto === 'own') return true;

        // 2. Non-match studio broadcast talk shows (Morning Footy, Just Football, Box to Box, Attacking Third)
        const studioShows = ['morning footy', 'just football', 'box to box', 'attacking third'];
        if (studioShows.some(show => title === show || title.startsWith(show + ' ') || title.includes(show))) return true;

        return false;
    }

    function isLinearChannel(item) {
        if (!item) return true;
        if (item.isAlwaysLive || item.always_live === 1) return true;
        const tag = (item.tag || item.league || '').toLowerCase();
        if (tag === '24/7 channel' || tag === '24/7 streams' || tag.includes('24/7')) return true;
        const sport = (item.sport || item.category || '').toUpperCase();
        if (sport === '24/7 STREAMS' || sport === 'CHANNELS') return true;

        const title = (item.title || item.name || item.event_name || '').toLowerCase().trim();
        const linearChannels = [
            'sky sports golf', 'sky sports news', 'tennis channel', 'rally tv',
            'nhl network', 'nfl network', 'fox footy', 'fox cricket', 'fox league',
            'willow', 'red zone', 'redzone'
        ];
        if (linearChannels.some(ch => title === ch || title.startsWith(ch + ' '))) return true;
        return false;
    }

    function getEstimatedMatchDuration(m) {
        if (!m) return 14400000;
        const titleLower = String(m.title || m.name || '').toLowerCase();
        const sport = normalizeSport(m.sport || m.category || m.rawCategory || m.league || '');

        // Title-based keyword detection (detects major event types regardless of generic provider category)
        if (titleLower.includes('ufc') || titleLower.includes('mma') || titleLower.includes('boxing') ||
            titleLower.includes('wrestlemania') || titleLower.includes('wwe') || titleLower.includes('aew') ||
            titleLower.includes('bellator') || titleLower.includes('pfl') || titleLower.includes('bkfc') ||
            titleLower.includes('fight night') || titleLower.includes('main card') || titleLower.includes('prelims') ||
            titleLower.includes('volkanovski') || titleLower.includes('evloev')) {
            return 28800000; // 8 hours for combat sports & wrestling PPV cards (Early Prelims + Prelims + Main Card)
        }
        if (titleLower.includes('test match') || titleLower.includes('odi') || titleLower.includes('ipl') || titleLower.includes('cricket')) {
            return 28800000; // 8 hours for full cricket matches / test sessions
        }
        if (titleLower.includes('24h') || titleLower.includes('24 hours') || titleLower.includes('lemans') || titleLower.includes('daytona')) {
            return 90000000; // 25 hours for endurance racing
        }
        if (titleLower.includes('grand prix') || titleLower.includes('f1') || titleLower.includes('formula 1') || titleLower.includes('motogp')) {
            return 14400000; // 4 hours for race + pre-race + post-race podium
        }

        switch (sport) {
            case 'COMBAT SPORTS':
            case 'WRESTLING': return 28800000;          // 8h (UFC, Boxing, WWE/AEW PPVs)
            case 'CRICKET': return 28800000;            // 8h (T20/ODI/Test matches)
            case 'GOLF': return 32400000;               // 9h (Full tournament rounds)
            case 'MOTORSPORTS': return 14400000;        // 4h (Races)
            case 'BASEBALL': return 14400000;           // 4h (MLB + extra innings)
            case 'AMERICAN FOOTBALL': return 14400000;  // 4h (NFL, CFB + overtime)
            case 'TENNIS': return 18000000;             // 5h (Grand Slam 5-setters)
            case 'BASKETBALL': return 12600000;         // 3.5h (NBA, NCAA + overtime)
            case 'HOCKEY': return 10800000;             // 3h (NHL, KHL + OT/shootout)
            case 'FOOTBALL': return 10800000;           // 3h (Soccer + extra time + penalties)
            case 'RUGBY': return 9000000;               // 2.5h
            case 'AUSTRALIAN FOOTBALL': return 12600000;// 3.5h
            case 'DARTS': return 10800000;              // 3h
            default: return 14400000;                   // 4h default safe buffer
        }
    }

    function isExpiredMatch(m, now = Date.now()) {
        if (!m) return true;
        if (m.isAlwaysLive || m.always_live === 1 || m.tag === '24/7 channel' || m.tag === '24/7 streams') return false;

        const start = m.startTime || (typeof m.date === 'number' ? m.date : (new Date(m.date || 0).getTime() || 0));
        if (!start || start <= 0) {
            return !(Array.isArray(m.servers) && m.servers.length > 0);
        }

        const duration = getEstimatedMatchDuration(m);
        const titleLower = String(m.title || m.name || '').toLowerCase();
        const sport = normalizeSport(m.sport || m.category || m.rawCategory || m.league || '');
        const isCombat = sport === 'COMBAT SPORTS' || titleLower.includes('ufc') || titleLower.includes('boxing') || titleLower.includes('mma') || titleLower.includes('fight');

        // Generous post-event retention buffer:
        // Combat sports / UFC / Boxing / PPVs stay accessible for at least 16 hours total
        // Other sports stay accessible for at least 6 hours past estimated duration
        const retentionBuffer = isCombat ? 28800000 : 21600000; // 8h combat buffer, 6h other
        const totalLifecycle = duration + retentionBuffer;

        // Hard upper boundary: event started more than totalLifecycle ago
        if (now > (start + totalLifecycle)) {
            return true;
        }

        const status = String(m.status || '').toLowerCase().trim();
        const timeStr = String(m.time || '').toLowerCase().trim();
        const isExplicitFinished = ['ended', 'finished', 'completed', 'final', 'ft', 'postponed', 'cancelled'].includes(status) ||
                                   ['final', 'ft', 'ended', 'completed'].includes(timeStr);

        // Retain finished events for 6h (combat) or 3h (others) so users can watch post-fight / replay / see results
        if (isExplicitFinished) {
            const finishedRetention = isCombat ? 21600000 : 10800000;
            if (now > (start + duration) && (now - (start + duration) > finishedRetention)) {
                return true;
            }
        }

        return false;
    }

    function isMatchLive(m, now = Date.now()) {
        if (!m) return false;
        if (isUnwantedMatch(m) || isLinearChannel(m)) return false;
        if (isExpiredMatch(m, now)) return false;

        const start = m.startTime || (typeof m.date === 'number' ? m.date : (new Date(m.date || 0).getTime() || 0));
        if (!start || start <= 0) return false;

        const duration = getEstimatedMatchDuration(m);
        const end = (m.endTime && m.endTime > start && m.endTime <= start + duration + 7200000) ? m.endTime : (start + duration);

        const status = String(m.status || '').toLowerCase().trim();
        const timeStr = String(m.time || '').toLowerCase().trim();
        const isExplicitFinished = ['ended', 'finished', 'completed', 'final', 'ft', 'postponed', 'cancelled'].includes(status) ||
                                   ['final', 'ft', 'ended', 'completed'].includes(timeStr);

        if (isExplicitFinished) return false;

        const isExplicitLive = status === 'live' || status === 'in_progress';

        // Live window: starts 30 mins before scheduled start through end of match + 15 min buffer
        if (now >= (start - 1800000) && now <= (end + 900000)) {
            return true;
        }

        if (isExplicitLive && now <= (end + 1800000)) {
            return true;
        }

        return false;
    }

    const STATIC_SPORT_GROUPS = {
        'AMERICAN FOOTBALL': ['AMERICAN FOOTBALL', 'CFL', 'NFL', 'CFB', 'NCAA FOOTBALL'],
        'AUSTRALIAN FOOTBALL': ['AUSTRALIAN FOOTBALL', 'AFL'],
        'RUGBY': ['RUGBY', 'NRL', 'SUPER RUGBY', 'SIX NATIONS'],
        'FOOTBALL': ['FOOTBALL', 'SOCCER', 'UEFA', 'FIFA', 'LALIGA', 'PREMIER', 'BUNDESLIGA', 'SERIE', 'LIGUE', 'EREDIVISIE', 'BRASILEIRÃO', 'BRASILEIRAO', 'LIGA', 'CHAMPIONS', 'UCL', 'AFCON', 'COPA', 'ASIAN', 'CONCACAF', 'WOMENS', 'WOMEN', 'MLS', 'CPL', 'CANADIAN PREMIER LEAGUE', 'EFL', 'CHAMPIONSHIP'],
        'CRICKET': ['CRICKET', 'ASIAN GAMES', 'CPL', 'IPL', 'T20', 'ODI', 'TEST', 'BBL', 'PSL', 'THE HUNDRED', 'WCL', 'WORLD CHAMPIONSHIP OF LEGENDS'],
        'COMBAT SPORTS': ['COMBAT SPORTS', 'UFC', 'MMA', 'BOXING', 'FIGHTS', 'FIGHTING', 'FIGHT', 'WWE', 'AEW', 'WRESTLING', 'BELLATOR', 'ONE FC', 'RIZIN', 'BKFC', 'JUDO', 'BJJ'],
        'MOTORSPORTS': ['MOTORSPORTS', 'MOTORSPORT', 'F1', 'MOTOGP', 'FORMULA', 'FORMULA 1', 'NASCAR', 'RALLY', 'RACING', 'WORLDSBK', 'WORLDSSP', 'SUPERBIKE', 'INDYCAR', 'LE MANS'],
        'BASEBALL': ['BASEBALL', 'MLB', 'NPB', 'KBO'],
        'BASKETBALL': ['BASKETBALL', 'NBA', 'WNBA', 'NBL', 'EUROLEAGUE', 'NCAA BASKETBALL'],
        'HOCKEY': ['HOCKEY', 'ICE HOCKEY', 'NHL', 'KHL', 'SHL', 'IIHF'],
        'TENNIS': ['TENNIS', 'ATP', 'WTA', 'GRAND SLAM', 'WIMBLEDON', 'US OPEN', 'AUSTRALIAN OPEN', 'ROLAND GARROS', 'DAVIS CUP'],
        'CYCLING': ['CYCLING', 'BMX', 'CYCLO-CROSS', 'TOUR DE FRANCE', 'GIRO', 'VUELTA'],
        'SNOOKER': ['SNOOKER', 'POOL', 'DARTS'],
        '24/7 STREAMS': ['24/7', 'CHANNELS', 'LIVE TV', 'STREAM']
    };

    function normalizeSport(str) {
        if (!str || typeof str !== 'string') return '';
        const sUpper = str.trim().toUpperCase();
        // 1. Direct exact canonical or alias match
        for (const [canonical, aliases] of Object.entries(STATIC_SPORT_GROUPS)) {
            if (sUpper === canonical || aliases.includes(sUpper)) return canonical;
        }
        // 2. Exact word boundary match with priority for compound sports
        for (const [canonical, aliases] of Object.entries(STATIC_SPORT_GROUPS)) {
            const reCanonical = new RegExp('\\b' + canonical + '\\b', 'i');
            if (reCanonical.test(sUpper)) return canonical;
            if (aliases.some(a => new RegExp('\\b' + a + '\\b', 'i').test(sUpper))) {
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
        'red', 'blue', 'green', 'white', 'black', 'gold', 'yellow',
        'game', 'day', 'round', 'stage', 'session', 'practice', 'qualifying', 's1', 's2', 's3', 's4', 's5'
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
        'okc thunder': 'oklahoma city thunder',
        'n.y.': 'new york',
        'ny': 'new york',
        'n y': 'new york',
        'l.a.': 'los angeles',
        'la': 'los angeles',
        'l a': 'los angeles',
        'd.c.': 'washington dc',
        'dc': 'washington dc',
        'd c': 'washington dc',
        'okc': 'oklahoma city',
        'kc': 'kansas city',
        'tb': 'tampa bay',
        'gb': 'green bay',
        'ne': 'new england',
        'no': 'new orleans',
        'sf': 'san francisco',
        'circuit of the americas': 'united states grand prix',
        'cota': 'united states grand prix'
    };

    function normalizeTeamName(str) {
        if (!str) return '';
        let s = cleanMatchStr(str).replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
        for (const [k, v] of Object.entries(TEAM_ALIASES)) {
            const re = new RegExp('\\b' + k.replace(/\./g, '\\.') + '\\b', 'g');
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

    function areSportsCompatible(s1, s2) {
        if (!s1 || !s2 || s1 === 'OTHERS' || s2 === 'OTHERS') return true;
        if (s1 === s2) return true;
        const combat = new Set(['COMBAT SPORTS', 'WRESTLING', 'MMA', 'BOXING', 'UFC']);
        if (combat.has(s1) && combat.has(s2)) return true;
        const motorsport = new Set(['MOTORSPORTS', 'F1', 'FORMULA 1', 'MOTOGP', 'RACING']);
        if (motorsport.has(s1) && motorsport.has(s2)) return true;
        return false;
    }

    function isSameMatch(ppv, alpha) {
        if (!ppv || !alpha) return false;

        const pTitle = ppv.title || ppv.name || '';
        const aTitle = alpha.event_name || alpha.title || '';

        // Immediate canonical slug match
        const ppvSlug = ppv.canonicalSlug || generateUniversalMatchSlug(pTitle);
        const alphaSlug = alpha.canonicalSlug || generateUniversalMatchSlug(aTitle);
        if (ppvSlug && alphaSlug && ppvSlug === alphaSlug) return true;

        // Immediate direct clean string match
        const cleanSuffix = (s) => (s || '').replace(/\|\s*(?:game\s*\d+|day\s*\d+\s*s\d+|leg\s*\d+)/gi, '').replace(/\|/g, ' ').replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();
        const cleanP = cleanSuffix(pTitle);
        const cleanA = cleanSuffix(aTitle);
        const cP = cleanMatchStr(cleanP).replace(/[^a-z0-9]/g, '');
        const cA = cleanMatchStr(cleanA).replace(/[^a-z0-9]/g, '');
        if (cP && cA && cP === cA) return true;
        if (cP.length >= 8 && cA.length >= 8 && (cP.includes(cA) || cA.includes(cP))) return true;

        // 1. Sport & Category compatibility check
        const pSport = normalizeSport(ppv.sport || ppv.category || ppv.catName || ppv.league || '');
        const aSport = normalizeSport(alpha.sport || alpha.category || alpha.league || '');

        const isFootballCross = (pSport === 'FOOTBALL' && aSport === 'AMERICAN FOOTBALL') || (pSport === 'AMERICAN FOOTBALL' && aSport === 'FOOTBALL');
        if (!areSportsCompatible(pSport, aSport) && !isFootballCross) {
            return false;
        }

        // 2. Start time proximity check (within 8 hours)
        const ppvTime = ppv.startTime || (typeof ppv.date === 'number' ? ppv.date : (new Date(ppv.date).getTime() || 0));
        const alphaTime = (alpha.timestamp ? alpha.timestamp * 1000 : 0) || alpha.startTime || (typeof alpha.date === 'number' ? alpha.date : (new Date(alpha.date).getTime() || 0));
        if (ppvTime && alphaTime) {
            const diffHours = Math.abs(ppvTime - alphaTime) / (1000 * 60 * 60);
            if (diffHours > 8) return false;
        }

        // Single-entity events check FIRST before team splitting (Formula 1, MotoGP, UFC fight cards, WWE)
        const isSingleEntity = /grand\s*prix|qualifying|practice|race|circuit|ufc|bellator|fight\s*night|smackdown|raw|collision|wrestlemania|rally|motogp|nascar|marathon|tour\s*de|darts|championship/i.test(cleanP) ||
                               /grand\s*prix|qualifying|practice|race|circuit|ufc|bellator|fight\s*night|smackdown|raw|collision|wrestlemania|rally|motogp|nascar|marathon|tour\s*de|darts|championship/i.test(cleanA);
        
        if (isSingleEntity) {
            // Disambiguate different sessions (e.g. Practice 1 vs Practice 2 vs Race)
            const getSession = (s) => {
                const m = (s || '').match(/\b(?:1st|2nd|3rd|\d(?:st|nd|rd)?)\s*practice\b|\bpractice\s*\d\b|\bqualifying\s*\d?\b|\bsprint\b|\brace\b/i);
                if (!m) return null;
                let str = m[0].toLowerCase().replace(/\s+/g, '');
                if (str.includes('1stpractice') || str.includes('practice1')) return 'practice1';
                if (str.includes('2ndpractice') || str.includes('practice2')) return 'practice2';
                if (str.includes('3rdpractice') || str.includes('practice3')) return 'practice3';
                return str;
            };
            const pSess = getSession(cleanP);
            const aSess = getSession(cleanA);
            if (pSess && aSess && pSess !== aSess) {
                return false;
            }

            const pToks = getDistinctiveTokens(cleanP);
            const aToks = getDistinctiveTokens(cleanA);
            const common = aToks.filter(t => pToks.includes(t));
            if (common.length >= 2) {
                if (ppvTime && alphaTime) {
                    const diffHours = Math.abs(ppvTime - alphaTime) / (1000 * 60 * 60);
                    if (diffHours <= 8) return true;
                } else {
                    return true;
                }
            }
            if (ppvTime && alphaTime && Math.abs(ppvTime - alphaTime) <= 3600000) {
                if (common.length >= 1 && (pToks.includes('prix') || pToks.includes('grand') || pToks.includes('f1') || pToks.includes('formula') || pToks.includes('motogp') || pToks.includes('rally'))) {
                    return true;
                }
            }
        }

        const teamSepRegex = /\s+(?:vs\.?|@|at|v\.?|x)\s+/i;
        const pParts = cleanP.split(teamSepRegex);
        const aParts = cleanA.split(teamSepRegex);

        let pHome = (ppv.team1 && ppv.team1.name) || (ppv.teams && ppv.teams.home && ppv.teams.home.name) || ppv.home_team || (pParts.length >= 2 ? pParts[0] : '');
        let pAway = (ppv.team2 && ppv.team2.name) || (ppv.teams && ppv.teams.away && ppv.teams.away.name) || ppv.away_team || (pParts.length >= 2 ? pParts[1] : '');

        let aHome = alpha.home_team || (alpha.team1 && alpha.team1.name) || (alpha.teams && alpha.teams.home && alpha.teams.home.name) || (aParts.length >= 2 ? aParts[0] : '');
        let aAway = alpha.away_team || (alpha.team2 && alpha.team2.name) || (alpha.teams && alpha.teams.away && alpha.teams.away.name) || (aParts.length >= 2 ? aParts[1] : '');

        if ((!pHome || !pAway) && !isSingleEntity && cleanP.includes(' - ')) {
            const dashParts = cleanP.split(/\s+-\s+/);
            if (dashParts.length >= 2) { pHome = dashParts[0]; pAway = dashParts[1]; }
        }
        if ((!aHome || !aAway) && !isSingleEntity && cleanA.includes(' - ')) {
            const dashParts = cleanA.split(/\s+-\s+/);
            if (dashParts.length >= 2) { aHome = dashParts[0]; aAway = dashParts[1]; }
        }

        pHome = cleanSuffix(pHome).trim();
        pAway = cleanSuffix(pAway).trim();
        aHome = cleanSuffix(aHome).trim();
        aAway = cleanSuffix(aAway).trim();

        // If BOTH fixtures have opposing teams, BOTH TEAMS MUST MATCH!
        if (pHome && pAway && aHome && aAway) {
            const homeHome = matchTeams(pHome, aHome);
            const awayAway = matchTeams(pAway, aAway);
            const homeHome2 = matchTeams(pHome, aAway);
            const awayHome2 = matchTeams(pAway, aHome);
            if ((homeHome && awayAway) || (homeHome2 && awayHome2)) return true;
            return false;
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
        'wrestling': 'COMBAT SPORTS',
        'wwe': 'COMBAT SPORTS',
        'aew': 'COMBAT SPORTS',
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
            const CACHE_KEY = 'aryan_cached_matches_v42';
            // 1. Explicitly purge any bloated legacy caches (v1 through v35) dynamically
            try {
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith('aryan_cached_matches_') && k !== CACHE_KEY) {
                        localStorage.removeItem(k);
                    }
                }
            } catch (e) {}

            // 2. Immediately hydrate from fresh localStorage cache ONLY if under 5 minutes old
            try {
                const cachedRaw = localStorage.getItem(CACHE_KEY);
                if (cachedRaw) {
                    const parsed = JSON.parse(cachedRaw);
                    const now = Date.now();
                    const cacheAge = parsed.savedAt ? (now - parsed.savedAt) : Infinity;
                    const items = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.matches) ? parsed.matches : []);
                    
                    // Discard stale cache from old sessions (> 5 min) to prevent ghost matches flickering
                    if (cacheAge < 300000 && items.length > 0) {
                        this.matches = items.filter(m => {
                            if (!m || !m.title) return false;
                            if (isUnwantedMatch(m) || isLinearChannel(m)) return false;
                            if (isExpiredMatch(m, now)) return false;
                            return true;
                        }).map(m => {
                            if (m.poster) m.poster = sanitizePosterUrl(m.poster);
                            m.isLive = isMatchLive(m, now);
                            m.status = m.isLive ? 'live' : 'upcoming';
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

            // 3. Ultra-fast initial render: Load authoritative core match schedule & 24/7 channels in parallel (<400ms)
            this._futbolxLoadingPromise = this.loadFutbolXFeeds(true);
            this._ppvLoadingPromise = this.loadPPVFeeds(true);
            const channelsPromise = this.loadChannelsCatalog();
            this._alphaLoadingPromise = (async () => {
                try {
                    await this.loadStreamCornerAlphaFeeds();
                    this.updateLiveStatuses();
                } catch(e) {}
            })();

            await Promise.allSettled([
                this._ppvLoadingPromise,
                this._futbolxLoadingPromise,
                channelsPromise
            ]);

            this.updateLiveStatuses();
            this.isLoading = false;
            this.sortMatches();
            this.emitUpdate();

            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), matches: this.matches.slice(0, MATCH_CACHE_LIMIT) }));
            } catch (e) {}

            // Auto-refresh match feeds quietly every 3 minutes
            if (!this.refreshInterval) {
                this.refreshInterval = setInterval(async () => {
                    await this.loadPPVFeeds(true);
                    this._futbolxLoadingPromise = this.loadFutbolXFeeds(true);
                    await this._futbolxLoadingPromise;
                    this.updateLiveStatuses();
                    if (typeof currentView !== 'undefined' && currentView === 'home' && typeof searchQuery !== 'undefined' && !searchQuery) {
                        this.emitUpdate();
                    }
                }, 180000);
            }
        },

        onUpdate(callback) {
            if (typeof callback === 'function') {
                this.listeners.push(callback);
            }
        },

        emitUpdate() {
            if (this._emitTimeout) clearTimeout(this._emitTimeout);
            this._emitTimeout = setTimeout(() => {
                for (const cb of this.listeners) {
                    try { cb(); } catch (e) { console.error('Listener error:', e); }
                }
            }, 30);
        },

        /**
         * Fetch all matches directly from official PPV.st and Streamed schedule APIs
         * Combines live streams and upcoming fixtures across all sports (F1, MotoGP, Football, Cricket, NFL, etc.)
         * Guarantees 100% genuine authentic posters, zero duplicate stock photos, and full coverage.
         */
        async loadPPVFeeds(isInitial = false) {
            const CACHE_KEY = 'aryan_cached_matches_v42';
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
                            if (json && json.success !== false && Array.isArray(json.streams) && json.streams.length > 0) {
                                let addedAny = false;
                                json.streams.forEach(cat => {
                                    const cName = (cat.category || 'Sports').trim();
                                    const is247 = cat.always_live || cName.toLowerCase().includes('24/7');
                                    (cat.streams || []).forEach(s => {
                                        if (s && s.id && !seenRawIds.has(s.id)) {
                                            seenRawIds.add(s.id);
                                            rawItems.push({ stream: s, category: cName, is247: is247 });
                                            addedAny = true;
                                        }
                                    });
                                });
                                if (addedAny) break;
                            }
                        }
                    } catch (e) {}
                }

                // 2. Fetch Complete Fixtures Schedule (Fast Cloudflare edge proxy first)
                const scheduleEndpoints = [
                    '/api/ppv?endpoint=all',
                    'https://streamed.pk/api/matches/all'
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
                                        // Filter out synthetic / manual / fake phantom matches
                                        const sIdLower = String(s.id || '').toLowerCase();
                                        const sTitleLower = String(s.name || s.title || '').toLowerCase();
                                        if (s.isManual || s.auto === 'own' || sIdLower.startsWith('mm-own') || sIdLower.startsWith('mm-yl') || sIdLower.startsWith('mm-cric')) {
                                            return;
                                        }
                                        if (sTitleLower.includes('diriyah') && sTitleLower.includes('riyadh')) {
                                            return;
                                        }
                                        if ((sTitleLower.includes('wolves') || sTitleLower.includes('wolverhampton')) && (sTitleLower.includes('portsmouth') || sTitleLower.includes('pompey'))) {
                                            return;
                                        }
                                        if (Array.isArray(s.sources) && s.sources.length === 1 && String(s.sources[0].source || '').toLowerCase() === 'manual') {
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
                    const newMatchesByCanonKey = new Map();
                    const existingMatchesById = new Map();
                    const existingMatchesByCanonKey = new Map();

                    if (Array.isArray(this.matches)) {
                        for (let i = 0; i < this.matches.length; i++) {
                            const m = this.matches[i];
                            if (m.id) existingMatchesById.set(m.id, m);
                            if (m.rawId) existingMatchesById.set(m.rawId, m);
                            const k = getMatchCanonicalKey(m.title || m.name);
                            if (k) existingMatchesByCanonKey.set(k, m);
                        }
                    }

                    for (let i = 0; i < rawItems.length; i++) {
                        const item = rawItems[i];
                        const s = item.stream;
                        const catName = item.category;
                        const is247Cat = item.is247;
                        const sTitle = (s.name || s.title || '').trim();
                        if (!s || !s.id || !sTitle) continue;

                        const norm = this.normalizePPVStreamItem(s, catName, is247Cat);
                        if (!norm) continue;

                        const canonKey = getMatchCanonicalKey(norm.title);

                        // 1. Instant O(1) deduplication check across PPV & Streamed.pk
                        let existingInNew = newMatchesById.get(norm.id) || (norm.rawId ? newMatchesById.get(norm.rawId) : null) || (canonKey ? newMatchesByCanonKey.get(canonKey) : null);
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

                        // 2. Instant O(1) check against previous matches state to preserve resolved alpha feeds
                        let existing = existingMatchesById.get(norm.id) || (norm.rawId ? existingMatchesById.get(norm.rawId) : null) || (canonKey ? existingMatchesByCanonKey.get(canonKey) : null);

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
                        if (canonKey) newMatchesByCanonKey.set(canonKey, norm);
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

                        const now = Date.now();
                        const cleanNewMatches = newMatches.filter(m => !isExpiredMatch(m, now) && !isUnwantedMatch(m) && !isLinearChannel(m));
                        if (Array.isArray(this.matches)) {
                            const existingFx = this.matches.filter(m => m && m.isFutbolX && !isExpiredMatch(m, now));
                            for (const fx of existingFx) {
                                const fxSlug = fx.canonicalSlug || generateUniversalMatchSlug(fx.title || fx.name || '');
                                const matchedPpv = cleanNewMatches.find(m => {
                                    if (m.id === fx.id || (m.uriName && fx.uriName && m.uriName === fx.uriName)) return true;
                                    const mSlug = m.canonicalSlug || generateUniversalMatchSlug(m.title || m.name || '');
                                    if (fxSlug && mSlug && fxSlug === mSlug) return true;
                                    return isSameMatch(m, fx);
                                });
                                if (matchedPpv) {
                                    // Merge FX streams directly into canonical PPV match
                                    const existingUrls = new Set((matchedPpv.servers || []).map(s => s.rawUrl || s.url));
                                    const newServers = (fx.servers || []).filter(s => !existingUrls.has(s.rawUrl || s.url));
                                    if (newServers.length > 0) {
                                        matchedPpv.servers = prioritizeFxServers([...newServers, ...(matchedPpv.servers || [])]);
                                        matchedPpv.sources = matchedPpv.servers;
                                    }
                                    matchedPpv.isFutbolX = true;
                                    if (fx.uriName) matchedPpv.uriName = fx.uriName;
                                } else {
                                    cleanNewMatches.push(fx);
                                }
                            }
                        }

                        this.matches = cleanNewMatches;
                        this.isLoading = false;
                        this.sortMatches();
                        if (!isInitial) {
                            this.emitUpdate();
                        }
                        try {
                            localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), matches: this.matches.slice(0, MATCH_CACHE_LIMIT) }));
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
        async loadFutbolXFeeds(isInitial = false) {
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
                            const list = (json && (json.events || json.matches || (Array.isArray(json) ? json : null))) || [];
                            if (Array.isArray(list) && list.length > 0) {
                                fxMatches = list;
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
                        url: s.url,
                        rawUrl: s.url,
                        type: 'video',
                        isFutbolX: true,
                        hd: true
                    }));

                    const parseFxDate = (d) => {
                        if (!d) return 0;
                        const str = String(d).trim();
                        const iso = (str.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(str)) ? str : str + '+03:00';
                        return new Date(iso).getTime() || 0;
                    };
                    const fxStart = parseFxDate(fx.starts_at);
                    const fxToks = getTokens(fx.title || '');
                    const fxSlug = generateUniversalMatchSlug(fx.title || '');
                    let matchedFixture = null;

                    if (this._matchById) {
                        if (fx.id && this._matchById.has(fx.id)) matchedFixture = this._matchById.get(fx.id);
                        else if (fx.uri_name && this._matchById.has(fx.uri_name)) matchedFixture = this._matchById.get(fx.uri_name);
                        else if (fxSlug && this._matchById.has(fxSlug)) matchedFixture = this._matchById.get(fxSlug);
                    }
                    if (!matchedFixture && fxSlug && Array.isArray(this.matches)) {
                        matchedFixture = this.matches.find(m => {
                            if (m.id === fx.id || (m.uriName && fx.uri_name && m.uriName === fx.uri_name)) return true;
                            const mSlug = m.canonicalSlug || generateUniversalMatchSlug(m.title || m.name || '');
                            if (fxSlug && mSlug && fxSlug === mSlug) return true;
                            return isSameMatch(m, fx);
                        });
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
                        let addedServers = [];
                        if (fxStreams.length > 0) {
                            const existingUrls = new Set((matchedFixture.servers || []).map(srv => srv.rawUrl || srv.url));
                            const newFxServers = fxStreams.filter(s => !existingUrls.has(s.rawUrl || s.url));
                            if (newFxServers.length > 0) {
                                matchedFixture.servers = prioritizeFxServers([...newFxServers, ...(matchedFixture.servers || [])]);
                                matchedFixture.sources = matchedFixture.servers;
                                addedServers = newFxServers;
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

                        // Real-time update if user is currently viewing this fixture
                        const activeWatch = window.currentWatchItem || (typeof currentWatchItem !== 'undefined' ? currentWatchItem : null);
                        if (activeWatch && addedServers.length > 0 &&
                            (activeWatch.id === matchedFixture.id || 
                             (activeWatch.canonicalSlug && matchedFixture.canonicalSlug && activeWatch.canonicalSlug === matchedFixture.canonicalSlug) ||
                             (activeWatch.rawId && matchedFixture.rawId && activeWatch.rawId === matchedFixture.rawId) ||
                             (activeWatch.uriName && matchedFixture.uriName && activeWatch.uriName === matchedFixture.uriName))) {
                            const prevActiveIdx = (window.AryanPlayerEngine && window.AryanPlayerEngine.activeServerIdx) || 0;
                            const currentPlayingServer = activeWatch.servers && activeWatch.servers[prevActiveIdx];
                            const currentPlayingUrl = currentPlayingServer ? (currentPlayingServer.rawUrl || currentPlayingServer.url) : null;

                            activeWatch.servers = matchedFixture.servers;
                            activeWatch.sources = matchedFixture.servers;
                            activeWatch.isFutbolX = true;

                            if (window.AryanPlayerEngine) {
                                window.AryanPlayerEngine.currentStream = activeWatch;
                                if (currentPlayingUrl) {
                                    const matchIdx = activeWatch.servers.findIndex(srv => (srv.rawUrl || srv.url) === currentPlayingUrl);
                                    if (matchIdx !== -1) {
                                        window.AryanPlayerEngine.activeServerIdx = matchIdx;
                                    }
                                }
                            }
                            if (typeof renderWatchSources === 'function') {
                                const activeIdx = (window.AryanPlayerEngine && window.AryanPlayerEngine.activeServerIdx) || 0;
                                renderWatchSources(activeWatch, activeIdx);
                            }
                        }
                    } else {
                        // Exclusive FutbolX match (both live and upcoming future events!)
                        if (!Array.isArray(fxStreams) || fxStreams.length === 0) continue;
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
                    if (!this.isLoading && !isInitial) this.emitUpdate();
                    try {
                        const CACHE_KEY = 'aryan_cached_matches_v42';
                        localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), matches: this.matches.slice(0, MATCH_CACHE_LIMIT) }));
                    } catch (e) {}
                }
            } catch (err) {
                console.warn('loadFutbolXFeeds error:', err);
            }
        },

        normalizeFutbolXMatch(fx, fxStreams) {
            if (!fx || !fx.title) return null;
            if (isUnwantedMatch(fx) || isLinearChannel(fx)) {
                return null;
            }
            if (!fx || !fx.title) return null;
            const fxTitleLower = (fx.title || fx.name || '').toLowerCase();
            if ((fxTitleLower.includes('wolves') || fxTitleLower.includes('wolverhampton')) && (fxTitleLower.includes('pompey') || fxTitleLower.includes('portsmouth'))) {
                return null;
            }
            if (fxTitleLower.includes('diriyah') && fxTitleLower.includes('riyadh')) {
                return null;
            }
            if (!Array.isArray(fxStreams) || fxStreams.length === 0) {
                return null;
            }

            const parseFxDate = (d) => {
                if (!d) return 0;
                const str = String(d).trim();
                const iso = (str.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(str)) ? str : str + '+03:00';
                return new Date(iso).getTime() || 0;
            };
            const startTs = parseFxDate(fx.starts_at) || Date.now();
            const rawCat = (fx.category || 'football').toLowerCase();
            const sport = normalizeSport(rawCat || fx.category || 'FOOTBALL');
            const defaultDuration = getEstimatedMatchDuration({ title: fx.title, name: fx.title, sport, category: fx.category, tag: fx.tag });
            const endTs = parseFxDate(fx.ends_at) || (startTs ? startTs + defaultDuration : 0);
            const now = Date.now();

            if (isExpiredMatch({ startTime: startTs, endTime: endTs, status: fx.status, sport }, now)) return null;

            const isLive = isMatchLive({ status: fx.status, startTime: startTs, endTime: endTs, sport }, now);

            const parts = fx.title.split(/\s+(?:vs\.?|@|-|x)\s+/i);
            const team1Name = parts[0] ? parts[0].trim() : fx.title;
            const team2Name = parts[1] ? parts[1].trim() : '';
            const universalSlug = generateUniversalMatchSlug(fx.title);

            return sanitizeMatchServers({
                id: fx.id || `fx-${fx.uri_name}`,
                rawId: fx.uri_name || fx.id,
                uriName: fx.uri_name,
                canonicalSlug: universalSlug,
                slug: universalSlug,
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
                const url = 'data/channels.json';
                const res = await fetch(url, { signal: AbortSignal.timeout(5000) }).catch(() => null);
                if (res && res.ok && (res.headers.get('content-type') || '').includes('json')) {
                    const data = await res.json();
                    if (data && Array.isArray(data.channels)) {
                        externalChannels = data.channels.map(ch => ({
                            id: `dlhd-${ch.id}`,
                            channelId: ch.id,
                            name: ch.name,
                            logo: ch.image || 'assets/img/logo-icon.png',
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
            if (!window.StreamCornerCore || typeof window.StreamCornerCore.t !== 'function') {
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
                    const candidateWorkers = [...ALPHA_WORKER_NODES].sort(() => Math.random() - 0.5).slice(0, 2);
                    try {
                        const batchPromises = candidateWorkers.map(worker => {
                            return new Promise((resolve, reject) => {
                                const timer = setTimeout(() => reject(new Error('timeout')), 4000);
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

                const [alphaRes, adminRes, betaRes, nbaRes, mlbRes, nflRes, ex3Res, ex4Res, cfRes, bbRes, paramRes] = await Promise.allSettled([
                    fetchEndpoint('alpha'),
                    fetchEndpoint('admin'),
                    fetchEndpoint('beta'),
                    fetchEndpoint('nba'),
                    fetchEndpoint('mlb'),
                    fetchEndpoint('nfl'),
                    fetchEndpoint('extra003'),
                    fetchEndpoint('extra004'),
                    fetchEndpoint('001'),
                    fetchEndpoint('003'),
                    fetchEndpoint('paramount_schedule')
                ]);

                const rawAlpha = (alphaRes.status === 'fulfilled' && Array.isArray(alphaRes.value)) ? alphaRes.value : [];
                const rawAdmin = (adminRes.status === 'fulfilled' && Array.isArray(adminRes.value)) ? adminRes.value : [];
                const rawBeta = (betaRes.status === 'fulfilled' && Array.isArray(betaRes.value)) ? betaRes.value : [];
                const rawNba = (nbaRes.status === 'fulfilled' && Array.isArray(nbaRes.value)) ? nbaRes.value : [];
                const rawMlb = (mlbRes.status === 'fulfilled' && Array.isArray(mlbRes.value)) ? mlbRes.value : [];
                const rawNfl = (nflRes.status === 'fulfilled' && Array.isArray(nflRes.value)) ? nflRes.value : [];
                const rawEx3 = (ex3Res.status === 'fulfilled' && Array.isArray(ex3Res.value)) ? ex3Res.value : [];
                const rawEx4 = (ex4Res.status === 'fulfilled' && Array.isArray(ex4Res.value)) ? ex4Res.value : [];
                const rawCf = (cfRes.status === 'fulfilled' && Array.isArray(cfRes.value)) ? cfRes.value : [];
                const rawBb = (bbRes.status === 'fulfilled' && Array.isArray(bbRes.value)) ? bbRes.value : [];

                const normParam = [];
                if (paramRes && paramRes.status === 'fulfilled' && Array.isArray(paramRes.value)) {
                    paramRes.value.forEach(cat => {
                        if (cat && Array.isArray(cat.events)) {
                            cat.events.forEach(ev => {
                                if (ev && ev.stream_id && (ev.is_live || ev.is_listing_live || ev.media_type === 'Live')) {
                                    normParam.push({
                                        stream_id: ev.stream_id,
                                        stream_type: 'paramount',
                                        event_name: ev.title || ev.on_now_title,
                                        category: 'FOOTBALL',
                                        league: 'UEFA',
                                        poster: ev.poster || ev.thumbnail || '',
                                        timestamp: ev.start_timestamp ? Math.floor(ev.start_timestamp / 1000) : 0,
                                        is_live: true,
                                        isLive: true
                                    });
                                }
                            });
                        }
                    });
                }

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
                const normMlb = rawMlb.map(m => ({ ...m, stream_type: m.stream_type || 'mlb', sport: 'BASEBALL' }));
                const normNfl = rawNfl.map(n => ({ ...n, stream_type: n.stream_type || 'nfl', sport: 'AMERICAN FOOTBALL' }));
                const normEx3 = rawEx3.map(a => ({ ...a, stream_type: a.stream_type || 'extra003' }));
                const normEx4 = rawEx4.map(a => ({ ...a, stream_type: a.stream_type || 'extra004' }));
                const normCf = rawCf.map(a => ({ ...a, stream_type: a.stream_type || '001' }));
                const normBb = rawBb.map(a => ({ ...a, stream_type: a.stream_type || '003' }));

                const seenStreamIds = new Set();
                const combinedCatalog = [];
                for (const item of [...normAlpha, ...normAdmin, ...normBeta, ...normNba, ...normMlb, ...normNfl, ...normEx3, ...normEx4, ...normCf, ...normBb, ...normParam]) {
                    if (item && item.stream_id && !seenStreamIds.has(item.stream_id)) {
                        seenStreamIds.add(item.stream_id);
                        combinedCatalog.push(item);
                    }
                }

                this.alphaCatalog = combinedCatalog;
                this._hasAttemptedAutoHeal = false;
                const matchedAlphaIds = new Set();
                let addedIndependent = false;

                // Build fast lookup index for this.matches
                const matchById = new Map();
                const matchByTok = new Map();
                for (const m of this.matches) {
                    if (!m) continue;
                    if (m.id) matchById.set(m.id, m);
                    if (m.rawId) matchById.set(String(m.rawId), m);
                    if (m.canonicalSlug) matchById.set(m.canonicalSlug, m);
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
                        const aSlug = alpha.canonicalSlug || generateUniversalMatchSlug(aTitle);
                        if (aSlug && matchById.has(aSlug)) {
                            matchedMatch = matchById.get(aSlug);
                        }
                    }
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
                    try {
                        const CACHE_KEY = 'aryan_cached_matches_v42';
                        localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), matches: this.matches.slice(0, MATCH_CACHE_LIMIT) }));
                    } catch (e) {}
                }

                // If user is already in watch view, immediately resolve extra channels and update sources UI!
                const activeWatchAlpha = window.currentWatchItem || (typeof currentWatchItem !== 'undefined' ? currentWatchItem : null);
                if (activeWatchAlpha) {
                    const updated = this.getItemById(activeWatchAlpha.canonicalSlug || activeWatchAlpha.slug || activeWatchAlpha.id);
                    if (updated && updated !== activeWatchAlpha) {
                        if (Array.isArray(updated.streamCornerSources) && updated.streamCornerSources.length > 0) {
                            activeWatchAlpha.streamCornerSources = updated.streamCornerSources;
                        }
                        if (updated.alphaStreamId) {
                            activeWatchAlpha.alphaStreamId = updated.alphaStreamId;
                            activeWatchAlpha.alphaStreamType = updated.alphaStreamType;
                            activeWatchAlpha.alphaItem = updated.alphaItem;
                        }
                    }
                    if (activeWatchAlpha.alphaStreamId || (activeWatchAlpha.streamCornerSources && activeWatchAlpha.streamCornerSources.length > 0)) {
                        activeWatchAlpha._alphaResolved = false;
                        this.ensureAlphaSourcesForMatch(activeWatchAlpha);
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
         * Ensure all sources (FutbolX, StreamCorner, PPV) are fully loaded and merged for a match
         * in ONE shot before rendering watch view or during direct refresh.
         */
        async ensureAllSourcesForMatch(match) {
            if (!match) return false;

            const matchSlug = match.canonicalSlug || generateUniversalMatchSlug(match.title || match.name || '');

            // 1. Ensure PPV core schedule feeds are awaited if match has few or no servers
            if (this._ppvLoadingPromise && (!match.servers || match.servers.length <= 1)) {
                try {
                    await Promise.race([
                        this._ppvLoadingPromise,
                        new Promise(resolve => setTimeout(resolve, 2500))
                    ]);
                } catch (e) {}
            }

            // If match is an isolated FutbolX or independent card, merge partner PPV fixture servers
            if (Array.isArray(this.matches)) {
                const partnerMatch = this.matches.find(m => {
                    if (m === match) return false;
                    if (m.id === match.id || (m.rawId && match.rawId && m.rawId === match.rawId)) return true;
                    const mSlug = m.canonicalSlug || generateUniversalMatchSlug(m.title || m.name || '');
                    if (mSlug && matchSlug && mSlug === matchSlug) return true;
                    return isSameMatch(m, match);
                });
                if (partnerMatch) {
                    const existingUrls = new Set((match.servers || []).map(s => s.rawUrl || s.url));
                    const newServers = (partnerMatch.servers || []).filter(s => !existingUrls.has(s.rawUrl || s.url));
                    if (newServers.length > 0) {
                        match.servers = prioritizeFxServers([...(match.servers || []), ...newServers]);
                        match.sources = match.servers;
                    }
                    if (Array.isArray(partnerMatch.streamCornerSources) && partnerMatch.streamCornerSources.length > 0) {
                        match.streamCornerSources = match.streamCornerSources || [];
                        partnerMatch.streamCornerSources.forEach(sc => {
                            if (!match.streamCornerSources.some(s => s.id === sc.id)) {
                                match.streamCornerSources.push(sc);
                            }
                        });
                    }
                    if (partnerMatch.alphaStreamId && !match.alphaStreamId) {
                        match.alphaStreamId = partnerMatch.alphaStreamId;
                        match.alphaStreamType = partnerMatch.alphaStreamType;
                        match.alphaItem = partnerMatch.alphaItem;
                    }
                }
            }

            // 2. Ensure FutbolX feeds are started and awaited
            if (!this._futbolxLoadingPromise) {
                this._futbolxLoadingPromise = this.loadFutbolXFeeds(true);
            }
            if (!Array.isArray(this.futbolxCatalog) || this.futbolxCatalog.length === 0) {
                try {
                    await Promise.race([
                        this._futbolxLoadingPromise,
                        new Promise(resolve => setTimeout(resolve, 2000))
                    ]);
                } catch (e) {}
            }

            // Merge FX sources if catalog available and match doesn't have them yet
            if (Array.isArray(this.futbolxCatalog) && this.futbolxCatalog.length > 0) {
                const fx = this.futbolxCatalog.find(f => {
                    if (f.id === match.id || f.uri_name === match.uriName) return true;
                    const fSlug = generateUniversalMatchSlug(f.title || '');
                    return fSlug && matchSlug && fSlug === matchSlug;
                });
                if (fx && Array.isArray(fx.streams) && fx.streams.length > 0) {
                    const fxStreams = fx.streams.filter(s => s && s.url && s.url.trim().length > 0).map((s, idx) => ({
                        name: `FX ${idx + 1} - ${s.title || 'Feed'}`,
                        url: s.url,
                        rawUrl: s.url,
                        type: 'video',
                        isFutbolX: true,
                        hd: true
                    }));
                    const existingUrls = new Set((match.servers || []).map(srv => srv.rawUrl || srv.url));
                    const newFxServers = fxStreams.filter(s => !existingUrls.has(s.rawUrl || s.url));
                    if (newFxServers.length > 0) {
                        match.servers = prioritizeFxServers([...newFxServers, ...(match.servers || [])]);
                        match.sources = match.servers;
                        match.isFutbolX = true;
                    }
                }
            }

            // 3. Ensure StreamCorner Alpha feeds are started and awaited
            if (!this._alphaLoadingPromise) {
                this._alphaLoadingPromise = this.loadStreamCornerAlphaFeeds();
            }
            if (!Array.isArray(this.alphaCatalog) || this.alphaCatalog.length === 0) {
                try {
                    await Promise.race([
                        this._alphaLoadingPromise,
                        new Promise(resolve => setTimeout(resolve, 3500))
                    ]);
                } catch (e) {}
            }

            // 4. Resolve StreamCorner satellite sources
            try {
                await this.ensureAlphaSourcesForMatch(match);
            } catch (e) {}

            // Real-time update watch view UI if user is actively watching this match
            const activeWatch = window.currentWatchItem || (typeof currentWatchItem !== 'undefined' ? currentWatchItem : null);
            if (activeWatch && (activeWatch.id === match.id || (activeWatch.canonicalSlug && match.canonicalSlug && activeWatch.canonicalSlug === match.canonicalSlug))) {
                activeWatch.servers = match.servers;
                activeWatch.sources = match.servers;
                activeWatch.streamCornerSources = match.streamCornerSources;
                activeWatch._alphaResolved = true;
                if (typeof renderWatchSources === 'function') {
                    const activeIdx = (window.AryanPlayerEngine && window.AryanPlayerEngine.activeServerIdx) || 0;
                    renderWatchSources(activeWatch, activeIdx);
                }
            }

            return true;
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

            // 1. If not already paired or catalog still loading in background, await with a fast timeout
            const needsCatalog = (!Array.isArray(this.alphaCatalog) || this.alphaCatalog.length === 0) || (!match.alphaStreamId && (!match.streamCornerSources || match.streamCornerSources.length === 0));
            if (needsCatalog) {
                if (!this._alphaLoadingPromise) {
                    this._alphaLoadingPromise = this.loadStreamCornerAlphaFeeds();
                }
                try {
                    await Promise.race([
                        this._alphaLoadingPromise,
                        new Promise(resolve => setTimeout(resolve, 3000))
                    ]);
                } catch (e) {}
            }

            // 2. Discover and link matching items in alphaCatalog (both primary and multi-angle/multiview feeds)
            match.streamCornerSources = match.streamCornerSources || [];
            if (Array.isArray(this.alphaCatalog) && this.alphaCatalog.length > 0) {
                const matchSlug = match.canonicalSlug || generateUniversalMatchSlug(match.title || match.name);
                for (const a of this.alphaCatalog) {
                    if (!a || !a.stream_id) continue;
                    const aSlug = a.canonicalSlug || generateUniversalMatchSlug(a.event_name || a.title || '');
                    const isMatched = (match.alphaStreamId && a.stream_id === match.alphaStreamId) || 
                                      (matchSlug && aSlug && matchSlug === aSlug) || 
                                      isSameMatch(match, a);
                    if (isMatched) {
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
                        if (pType === 'paramount') {
                            pType = 'paramount_schedule';
                        } else if (t.id && String(t.id).startsWith('GRNT')) {
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
                                    const timer = setTimeout(() => reject(new Error('timeout')), 4000);
                                    window.StreamCornerCore.t(`https://${worker}/corner?p=${pType}&id=${t.id}`, false, match.title || 'corner detail')
                                        .then(res => {
                                            clearTimeout(timer);
                                            const hasStreams = res && ((Array.isArray(res.streams) && res.streams.length > 0) || (Array.isArray(res.live) && res.live.length > 0) || res.embed_url || res.stream_url);
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
                            const list = Array.isArray(d.streams) ? [...d.streams] : (Array.isArray(d.live) ? [...d.live] : []);
                            if (d.embed_url || d.stream_url) {
                                list.push({ source_name: d.channel_name || 'Paramount+', embed_url: d.embed_url || d.stream_url });
                            }
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
                            if (/embedindia|ppv/i.test(rawUrl) || /embedindia|ppv/i.test(label)) return;

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
                        const combined = prioritizeFxServers(sanitizeMatchServers({ servers: [...newServers, ...baseServers] }).servers);

                        match.servers = combined;
                        match.sources = combined;
                        match._alphaResolved = true;

                        // Real-time update if user is currently viewing this match
                        const activeWatch = window.currentWatchItem || (typeof currentWatchItem !== 'undefined' ? currentWatchItem : null);
                        if (activeWatch && 
                            (activeWatch.id === match.id || 
                             (activeWatch.canonicalSlug && match.canonicalSlug && activeWatch.canonicalSlug === match.canonicalSlug) ||
                             activeWatch.alphaStreamId === match.alphaStreamId || 
                             (activeWatch.streamCornerSources && activeWatch.streamCornerSources.some(sc => seenTargetIds.has(sc.id))))) {
                            const prevActiveIdx = (window.AryanPlayerEngine && window.AryanPlayerEngine.activeServerIdx) || 0;
                            const currentPlayingServer = activeWatch.servers && activeWatch.servers[prevActiveIdx];
                            const currentPlayingUrl = currentPlayingServer ? (currentPlayingServer.rawUrl || currentPlayingServer.url) : null;
                            const wasUninitialized = !currentPlayingUrl || (baseServers.length === 0) || !window.AryanPlayerEngine || !window.AryanPlayerEngine.getServers().length;

                            activeWatch.servers = match.servers;
                            activeWatch.sources = match.servers;
                            activeWatch.streamCornerSources = match.streamCornerSources;
                            activeWatch._alphaResolved = true;

                            let newActiveIdx = 0;
                            if (window.AryanPlayerEngine) {
                                window.AryanPlayerEngine.currentStream = activeWatch;
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
                                renderWatchSources(activeWatch, newActiveIdx);
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
            if (isUnwantedMatch(alpha) || isLinearChannel(alpha)) {
                return null;
            }
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

            const rawCat = (alpha.category || '').toLowerCase().replace(/[\s_]+/g, '-');
            const league = (alpha.league || alpha.category || 'Sports').trim();
            const sport = normalizeSport(rawCat || league || alpha.category || 'OTHERS');
            const duration = getEstimatedMatchDuration({ title: rawTitle, name: rawTitle, sport, category: alpha.category, league });
            const now = Date.now();
            const endTs = (alpha.end_time ? new Date(alpha.end_time).getTime() : 0) || (startTs ? startTs + duration : 0);

            // Strict expiration check upfront to prevent finished ghost matches from flickering
            if (isExpiredMatch({ startTime: startTs, endTime: endTs, status: alpha.status, time: alpha.time || alpha.time_et, sport, isAlwaysLive: false }, now)) {
                return null;
            }

            const isLive = isMatchLive({ startTime: startTs, endTime: endTs, status: alpha.status, time: alpha.time || alpha.time_et, sport }, now);

            const team1Name = alpha.home_team || rawTitle.split(/ vs\.? | @ | x /i)[0] || rawTitle;
            const team2Name = alpha.away_team || rawTitle.split(/ vs\.? | @ | x /i)[1] || '';
            const universalSlug = generateUniversalMatchSlug(rawTitle);

            return {
                id: `alpha-${alpha.stream_id}`,
                rawId: alpha.stream_id,
                canonicalSlug: universalSlug,
                slug: universalSlug,
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
            if (isUnwantedMatch(s)) {
                return null;
            }
            if (isLinearChannel(s) || is247Cat) {
                // Route linear channel to this.channels if it has sources
                if (Array.isArray(s.sources) && s.sources.length > 0) {
                    const chId = 'ch-' + s.id;
                    const sName = s.name || s.title || '';
                    if (!this.channels.some(c => c.id === chId || c.name.toLowerCase() === sName.toLowerCase())) {
                        this.channels.push({
                            id: chId,
                            name: sName,
                            category: '24/7 STREAMS',
                            logo: sanitizeLogoUrl(s.poster || s.badge || ''),
                            country: 'GLOBAL',
                            servers: (s.sources || []).map((src, idx) => ({
                                name: src.name || ('Server ' + (idx + 1)),
                                url: src.source || src.url || '',
                                type: (src.source || '').includes('.m3u8') ? 'video' : 'iframe',
                                hd: true
                            }))
                        });
                    }
                }
                return null;
            }
            const title = (s.name || s.title || 'Live Event').trim();
            const rawCat = (s.category || catName || '').toLowerCase().replace(/[\s_]+/g, '-');
            const catKey = (catName || '').toLowerCase().replace(/[\s_]+/g, '-');
            const tag = (s.tag || s.league || catName || 'Sports').trim();
            const sport = SPORT_MAPPINGS[rawCat] || SPORT_MAPPINGS[catKey] || SPORT_MAPPINGS[tag.toLowerCase()] || (catName ? catName.toUpperCase() : 'OTHERS');

            const startTs = (s.starts_at ? s.starts_at * 1000 : (s.date ? (typeof s.date === 'number' ? s.date : (new Date(s.date).getTime() || 0)) : 0));
            const duration = getEstimatedMatchDuration({ title, name: title, sport, category: catName, tag });
            const endTs = (s.ends_at ? s.ends_at * 1000 : 0) || (startTs ? startTs + duration : 0);
            const now = Date.now();
            const isAlwaysLive = Boolean(s.always_live || is247Cat || tag.toLowerCase().includes('24/7') || !startTs);

            // Strict expiration check upfront to prevent finished ghost matches from flickering
            if (isExpiredMatch({ startTime: startTs, endTime: endTs, status: s.status, time: s.time, sport, isAlwaysLive }, now)) {
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
            if ((sTitleLower.includes('wolves') || sTitleLower.includes('wolverhampton')) && (sTitleLower.includes('portsmouth') || sTitleLower.includes('pompey'))) {
                return null;
            }
            if (Array.isArray(s.sources) && s.sources.length === 1 && String(s.sources[0].source || '').toLowerCase() === 'manual') {
                return null;
            }
            if (Array.isArray(s.sources) && s.sources.length === 1 && String(s.sources[0].source || '').toLowerCase() === 'manual') {
                return null;
            }

            const isLive = isMatchLive({ startTime: startTs, endTime: endTs, status: s.status, time: s.time, sport, isAlwaysLive }, now);

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
                if (url.includes('/embed/manual/')) return;
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
            let mainLabel = (s.source_tag || s.source || '').trim() || 'Main Feed';
            if (s.locale && !mainLabel.toLowerCase().includes(s.locale.toLowerCase())) {
                mainLabel += ` [${s.locale.toUpperCase()}]`;
            }

            // Always add primary official broadcast stream first if present
            if (mainEmbed) {
                const finalLabel = extractCleanServerLabel(mainLabel, mainEmbed, 0);
                addServer(finalLabel, mainEmbed);
            }

            if (Array.isArray(s.substreams) && s.substreams.length > 0) {
                s.substreams.forEach((sub, sIdx) => {
                    const subUrl = sub.url || sub.iframe || sub.embedUrl;
                    if (subUrl) {
                        let label = (sub.source_tag || sub.source || sub.name || '').trim();
                        if (sub.locale && !label.toLowerCase().includes(sub.locale.toLowerCase())) {
                            label += ` [${sub.locale.toUpperCase()}]`;
                        }
                        const finalLabel = extractCleanServerLabel(label, subUrl, servers.length);
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

            // Clean, deduplicate against canonical keys, and re-index server names
            const cleanServers = sanitizeMatchServers({ servers: servers }).servers;

            // Discard ghost match if it has NO valid servers and NO matched StreamCorner Alpha feed
            if (cleanServers.length === 0 && !matchedAlphaId) {
                return null;
            }

            const universalSlug = generateUniversalMatchSlug(title);

            return {
                id: `ppv-${s.id}`,
                rawId: s.id,
                canonicalSlug: universalSlug,
                slug: universalSlug,
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

        

        deduplicateMatchesList() {
            if (!Array.isArray(this.matches) || this.matches.length === 0) return;
            const unique = [];
            const seenIds = new Set();
            const tokenMap = new Map();

            for (let i = 0; i < this.matches.length; i++) {
                const m = this.matches[i];
                if (!m) continue;
                if (isUnwantedMatch(m) || isLinearChannel(m)) continue;
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
                    if (mToks.length >= 1) {
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

                // Start time proximity candidate check (within 3.5 hours)
                if (!dup && m.startTime) {
                    for (const cand of unique) {
                        if (cand.startTime && Math.abs(cand.startTime - m.startTime) <= 12600000) {
                            if (isSameMatch(cand, m)) {
                                dup = cand;
                                break;
                            }
                        }
                    }
                }

                if (dup) {
                    dup.mergedIds = dup.mergedIds || new Set();
                    if (m.id) { seenIds.add(m.id); dup.mergedIds.add(m.id); }
                    if (m.rawId) { seenIds.add(String(m.rawId)); dup.mergedIds.add(String(m.rawId)); }
                    if (m.alphaStreamId) { seenIds.add(m.alphaStreamId); dup.mergedIds.add(m.alphaStreamId); }
                    if (m.uriName) {
                        seenIds.add(m.uriName);
                        dup.mergedIds.add(m.uriName);
                        if (!dup.uriName) dup.uriName = m.uriName;
                    }
                    if (m.canonicalSlug) {
                        dup.mergedIds.add(m.canonicalSlug);
                        if (!dup.canonicalSlug) {
                            dup.canonicalSlug = m.canonicalSlug;
                            dup.slug = m.canonicalSlug;
                        }
                    }
                    if (m.mergedIds && m.mergedIds.size > 0) {
                        for (const mid of m.mergedIds) dup.mergedIds.add(mid);
                    }
                    if (!dup.canonicalSlug) {
                        dup.canonicalSlug = generateUniversalMatchSlug(dup.title || dup.name || '');
                        dup.slug = dup.canonicalSlug;
                    }
                    if (m.isFutbolX) dup.isFutbolX = true;
                    if (m.sport === 'AMERICAN FOOTBALL' || dup.sport === 'AMERICAN FOOTBALL') {
                        dup.sport = 'AMERICAN FOOTBALL';
                    }
                    if (m.sport === 'COMBAT SPORTS' || dup.sport === 'COMBAT SPORTS') {
                        dup.sport = 'COMBAT SPORTS';
                    }

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
                if (m.id) {
                    map.set(m.id, m);
                    map.set(m.id.toLowerCase(), m);
                }
                if (m.canonicalSlug) {
                    map.set(m.canonicalSlug, m);
                    map.set(m.canonicalSlug.toLowerCase(), m);
                    if (m.canonicalSlug.includes('-vs-')) {
                        const parts = m.canonicalSlug.split('-vs-');
                        if (parts.length === 2 && parts[0] && parts[1]) {
                            map.set(`${parts[1]}-vs-${parts[0]}`, m);
                        }
                    }
                }
                if (m.slug) {
                    map.set(m.slug, m);
                    map.set(m.slug.toLowerCase(), m);
                }
                const cKey = getMatchCanonicalKey(m.title || m.name);
                if (cKey) {
                    map.set(cKey, m);
                    map.set(cKey.toLowerCase(), m);
                }
                if (m.rawId) {
                    const rawStr = String(m.rawId);
                    const cleanRawStr = rawStr.replace(/^(ppv|fx|alpha|sc|dami)-/i, '');
                    map.set(rawStr, m);
                    map.set(cleanRawStr, m);
                    map.set(`ppv-${cleanRawStr}`, m);
                    map.set(`dami-${cleanRawStr}`, m);
                    map.set(`alpha-${cleanRawStr}`, m);
                    map.set(`sc-${cleanRawStr}`, m);
                    map.set(`fx-${cleanRawStr}`, m);
                }
                if (m.alphaStreamId) {
                    const cleanAlphaId = String(m.alphaStreamId).replace(/^alpha-/i, '');
                    map.set(m.alphaStreamId, m);
                    map.set(cleanAlphaId, m);
                    map.set(`alpha-${cleanAlphaId}`, m);
                    map.set(`sc-${cleanAlphaId}`, m);
                }
                if (m.uriName) {
                    map.set(m.uriName, m);
                    map.set(`fx-${m.uriName}`, m);
                }
                if (m.mergedIds && m.mergedIds.size > 0) {
                    for (const mid of m.mergedIds) {
                        map.set(mid, m);
                        map.set(String(mid).toLowerCase(), m);
                    }
                }
                if (Array.isArray(m.streamCornerSources)) {
                    for (const sc of m.streamCornerSources) {
                        if (sc && sc.id) {
                            map.set(sc.id, m);
                            map.set(`alpha-${sc.id}`, m);
                            map.set(`sc-${sc.id}`, m);
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
            this.matches = this.matches.filter(m => !isUnwantedMatch(m) && !isLinearChannel(m) && !isExpiredMatch(m, now));
            this.matches.forEach(m => {
                if (m.isAlwaysLive || m.always_live === 1 || m.tag === '24/7 channel' || m.tag === '24/7 streams' || !m.startTime || this.isExcludedFromLiveNow(m)) {
                    m.isLive = false;
                    m.status = 'live_tv';
                } else {
                    m.isLive = isMatchLive(m, now);
                    m.status = m.isLive ? 'live' : 'upcoming';
                }
            });
            this.sortMatches();
        },

        getItemById(id) {
            if (!id) return null;
            const decoded = decodeURIComponent(String(id)).trim();

            // 1. Instant O(1) indexed lookup
            if (this._matchById) {
                if (this._matchById.has(decoded)) return this._matchById.get(decoded);
                const lower = decoded.toLowerCase();
                if (this._matchById.has(lower)) return this._matchById.get(lower);
            }

            const stripped = decoded.replace(/^(ppv|dami|alpha|fx|sc)-/i, '');
            if (this._matchById) {
                if (this._matchById.has(stripped)) return this._matchById.get(stripped);
                if (this._matchById.has(stripped.toLowerCase())) return this._matchById.get(stripped.toLowerCase());
            }

            // Universal canonical slug lookup
            const inputSlug = generateUniversalMatchSlug(decoded);
            if (inputSlug && this._matchById) {
                if (this._matchById.has(inputSlug)) return this._matchById.get(inputSlug);
            }
            const strippedSlug = generateUniversalMatchSlug(stripped);
            if (strippedSlug && this._matchById) {
                if (this._matchById.has(strippedSlug)) return this._matchById.get(strippedSlug);
            }

            // Canonical key lookup
            const inputCanonKey = getMatchCanonicalKey(decoded);
            if (inputCanonKey && this._matchById) {
                if (this._matchById.has(inputCanonKey)) return this._matchById.get(inputCanonKey);
            }

            // 2. Hex stream ID or NBA game ID lookup
            const hexMatch = decoded.match(/([a-f0-9]{32})/i) || stripped.match(/([a-f0-9]{32})/i);
            const nbaMatch = decoded.match(/\b(00\d{8})\b/) || stripped.match(/\b(00\d{8})\b/);
            const streamId = hexMatch ? hexMatch[1] : (nbaMatch ? nbaMatch[1] : null);
            if (streamId && this._matchById && this._matchById.has(streamId)) {
                return this._matchById.get(streamId);
            }

            const slug = decoded.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

            // 3. Fallback search by ID, slug, canonical key, and path tokens
            let found = this.matches.find(m => {
                if (m.id === decoded || m.id === stripped || m.rawId === decoded || m.rawId === stripped) return true;
                if (m.canonicalSlug && (m.canonicalSlug === inputSlug || m.canonicalSlug === strippedSlug || m.canonicalSlug === slug)) return true;
                if (m.slug && (m.slug === inputSlug || m.slug === strippedSlug || m.slug === slug)) return true;
                if (inputCanonKey && getMatchCanonicalKey(m.title || m.name) === inputCanonKey) return true;
                const mSlug = (m.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                return mSlug && (mSlug === slug || (slug.length > 5 && (mSlug.includes(slug) || slug.includes(mSlug))));
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

            // 3.2. Fuzzy token overlap fallback
            if (!found && inputSlug && inputSlug.length > 5) {
                const queryTokens = inputSlug.split('-').filter(t => t.length > 2 && !['vs', 'the', 'and', 'live'].includes(t));
                if (queryTokens.length >= 2) {
                    found = this.matches.find(m => {
                        const mSlug = m.canonicalSlug || generateUniversalMatchSlug(m.title || m.name || '');
                        return queryTokens.every(t => mSlug.includes(t));
                    });
                }
            }

            // 3.5. Search futbolxCatalog directly for independent FutbolX links
            if (!found && Array.isArray(this.futbolxCatalog) && this.futbolxCatalog.length > 0) {
                const fx = this.futbolxCatalog.find(f => f.uri_name === stripped || f.uri_name === decoded || f.id === decoded || f.id === ('fx-' + stripped));
                if (fx) {
                    const fxStreams = (fx.streams || []).map((s, idx) => ({
                        name: `FX ${idx + 1} - ${s.title || 'Feed'}`,
                        url: s.url,
                        rawUrl: s.url,
                        type: 'video',
                        isFutbolX: true,
                        hd: true
                    }));
                    found = this.normalizeFutbolXMatch(fx, fxStreams);
                    if (found) {
                        this.matches.push(found);
                        this.rebuildMatchIndex();
                    }
                }
            }

            // 3.8. Search 24/7 channels catalog
            if (!found && Array.isArray(this.channels)) {
                found = this.channels.find(c => c && (c.id === decoded || c.id === stripped || c.channelId === decoded || c.channelId === stripped || (c.name && c.name.toLowerCase() === decoded.toLowerCase())));
            }

            // 4. Search alphaCatalog directly for independent stream links
            if (!found && Array.isArray(this.alphaCatalog) && this.alphaCatalog.length > 0) {
                const targetId = streamId || stripped || decoded;
                const alpha = this.alphaCatalog.find(a => a.stream_id === targetId || a.stream_id === stripped || a.stream_id === decoded);
                if (alpha) {
                    found = this.normalizeAlphaMatch(alpha);
                    if (found) {
                        this.matches.push(found);
                        this.rebuildMatchIndex();
                    }
                }
            }

            // 4.5. Fallback: Search in localStorage cached matches
            if (!found && typeof localStorage !== 'undefined') {
                try {
                    const CACHE_KEY = 'aryan_cached_matches_v42';
                    const raw = localStorage.getItem(CACHE_KEY);
                    if (raw) {
                        const parsed = JSON.parse(raw);
                        const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.matches) ? parsed.matches : []);
                        const cached = list.find(c => {
                            if (!c) return false;
                            if (c.id === decoded || c.id === stripped || c.rawId === decoded || c.rawId === stripped) return true;
                            if (c.canonicalSlug && (c.canonicalSlug === inputSlug || c.canonicalSlug === strippedSlug)) return true;
                            if (c.slug && (c.slug === inputSlug || c.slug === strippedSlug)) return true;
                            const cKey = getMatchCanonicalKey(c.title || c.name);
                            if (cKey && (cKey === inputCanonKey || cKey === decoded || cKey === stripped)) return true;
                            return false;
                        });
                        if (cached) {
                            found = cached;
                            this.matches.push(found);
                            this.rebuildMatchIndex();
                        }
                    }
                } catch (e) {}
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
            return this.matches.filter(m => !isUnwantedMatch(m) && !isLinearChannel(m) && !isExpiredMatch(m, now));
        },

        isExcludedFromLiveNow(m) {
            if (!m) return true;
            if (m.isAlwaysLive || m.always_live === 1) return true;
            if (m.tag === '24/7 channel' || m.tag === '24/7 streams') return true;
            if (!m.startTime || m.startTime <= 0) return true;
            const now = Date.now();

            if (isExpiredMatch(m, now)) return true;
            if (!isMatchLive(m, now)) return true;

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
                if (isUnwantedMatch(m) || isLinearChannel(m) || this.isExcludedFromLiveNow(m)) return false;
                return isMatchLive(m, now);
            });
        },

        getUpcomingMatches() {
            const now = Date.now();
            return this.matches.filter(m => !isUnwantedMatch(m) && !isLinearChannel(m) && !isExpiredMatch(m, now) && !isMatchLive(m, now) && (!m.startTime || m.startTime > (now - 900000)));
        },

        getMatchesByCategory(cat) {
            if (!cat || cat === 'ALL') return this.getAllMatches();
            if (cat === 'LIVE NOW') return this.getLiveMatches();
            if (cat === 'TODAY') {
                const todayMidnight = new Date().setHours(0, 0, 0, 0);
                const tonightMidnight = todayMidnight + 86400000;
                const now = Date.now();
                return this.matches.filter(m => !isUnwantedMatch(m) && !isLinearChannel(m) && !isExpiredMatch(m, now) && m.startTime >= todayMidnight && m.startTime < tonightMidnight);
            }
            const cleanCat = cat.toUpperCase().trim();
            const now = Date.now();
            return this.matches.filter(m => {
                if (isUnwantedMatch(m) || isLinearChannel(m) || isExpiredMatch(m, now)) return false;
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
                    return sport === 'CRICKET' || league.includes('CRICKET') || rawCat.includes('CRICKET') || title.includes('CRICKET') || league.includes('IPL') || league.includes('T20') || league.includes('ODI') || league.includes('TEST');
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
                if (isUnwantedMatch(m) || isLinearChannel(m) || isExpiredMatch(m, now)) return;

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
