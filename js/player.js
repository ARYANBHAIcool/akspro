/**
 * AryanStreams Global - Universal Multi-Server Player Engine
 * High-Performance, Instant-Switching Video Engine:
 * - Direct HLS.js video engine with multi-quality resolution selector (Auto, 1080p, 720p, 480p)
 * - Seamless in-place server switching without DOM destruction or canvas reflows
 * - Memory token caching & parallel pre-fetching for instant 0ms source switching
 * - Sandboxed, secure iframe embeds for PPV / Web embeds
 * - Fullscreen, Theater Mode, Reload, and Next Server auto-fallback
 */

window.AryanPlayerEngine = {
    currentStream: null,
    activeServerIdx: 0,
    hls: null,
    isTheater: false,
    qualityLevels: [],
    currentQuality: -1,
    currentPlayerEngine: 'bitmovin',
    _tokenCache: new Map(),

    init(containerId, streamItem) {
        const container = document.getElementById(containerId);
        if (!container) return;

        this.destroy();
        this.currentStream = streamItem;
        this.activeServerIdx = 0;
        this.preloadMatchTokens(streamItem);
        this.render(container);
    },

    destroy() {
        this.qualityLevels = [];
        this.currentQuality = -1;
        this.updateQualityUI();
        if (this.hls) {
            try {
                this.hls.stopLoad();
                this.hls.detachMedia();
                this.hls.destroy();
            } catch (e) {}
            this.hls = null;
        }
        const video = document.getElementById('global-video-element');
        if (video) {
            video.pause();
            video.removeAttribute('src');
            video.load();
        }
        const iframe = document.getElementById('global-iframe-element');
        if (iframe) {
            iframe.src = 'about:blank';
        }
    },

    getServers() {
        if (!this.currentStream) return [];
        const list = this.currentStream.servers || this.currentStream.sources || [];
        const validList = Array.isArray(list) ? list.filter(s => s && (s.url || s.embedUrl || s.rawUrl)) : [];
        if (validList.length > 0) return validList;
        if (this.currentStream.url || this.currentStream.embedUrl || this.currentStream.rawUrl) {
            return [this.currentStream];
        }
        return [];
    },

    preloadMatchTokens(streamItem) {
        if (!streamItem) return;
        const list = streamItem.servers || streamItem.sources || [];
        if (!Array.isArray(list)) return;
        list.forEach(s => {
            const u = s && (s.rawUrl || s.url);
            if (u && u.includes('ryzn.pro') && !u.includes('token=')) {
                this.resolvePlayableStreamUrl(u);
            }
        });
    },

    async resolvePlayableStreamUrl(serverOrUrl) {
        let streamEndpoint = typeof serverOrUrl === 'object' ? (serverOrUrl.url || serverOrUrl.rawUrl || '') : String(serverOrUrl);
        if (streamEndpoint.includes('shaka_player.html')) {
            try {
                const dummy = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'https://asppv.pages.dev';
                const uDummy = new URL(streamEndpoint, dummy);
                streamEndpoint = uDummy.searchParams.get('hls') || uDummy.searchParams.get('m3u8') || uDummy.searchParams.get('url') || streamEndpoint;
            } catch(e) {}
        }

        if (!streamEndpoint.includes('ryzn.pro') || streamEndpoint.includes('token=')) {
            return streamEndpoint;
        }

        if (!this._tokenCache) this._tokenCache = new Map();
        
        // 1. In-memory check (0ms)
        const cached = this._tokenCache.get(streamEndpoint);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.url;
        }

        // 2. SessionStorage check (0ms)
        try {
            const ssKey = 'fx_tok_' + btoa(streamEndpoint).slice(0, 32);
            const rawSS = sessionStorage.getItem(ssKey);
            if (rawSS) {
                const parsed = JSON.parse(rawSS);
                if (parsed && parsed.url && parsed.expiresAt > Date.now()) {
                    this._tokenCache.set(streamEndpoint, parsed);
                    return parsed.url;
                }
            }
        } catch(e) {}

        // 3. Fast parallel network race with tight 1200ms timeout
        try {
            const u = new URL(streamEndpoint);
            const params = new URLSearchParams({ path: u.pathname, sourceHost: u.hostname, expires: '900' });
            
            const pDirect = fetch(`https://www.futbol-x.xyz/api/token.js?${params.toString()}`, { signal: AbortSignal.timeout(1200) })
                .then(r => r.json())
                .then(d => (d && d.url) ? d.url : null)
                .catch(() => null);

            const pEdge = fetch(`/api/futbolx?token=1&url=${encodeURIComponent(streamEndpoint)}`, { signal: AbortSignal.timeout(1200) })
                .then(r => r.json())
                .then(d => (d && d.url) ? d.url : null)
                .catch(() => null);

            const tokenized = await Promise.race([
                pDirect.then(res => res || pEdge),
                pEdge.then(res => res || pDirect)
            ]);

            if (tokenized) {
                const val = { url: tokenized, expiresAt: Date.now() + 600000 };
                this._tokenCache.set(streamEndpoint, val);
                try {
                    const ssKey = 'fx_tok_' + btoa(streamEndpoint).slice(0, 32);
                    sessionStorage.setItem(ssKey, JSON.stringify(val));
                } catch(e) {}
                return tokenized;
            }
        } catch (e) {}

        return streamEndpoint;
    },

    getQualityLevels() {
        return this.qualityLevels || [];
    },

    setQuality(idx) {
        this.currentQuality = idx;
        if (this.hls) {
            this.hls.nextLevel = idx; // Smooth non-blocking transition without buffer flush or pause!
        }
        this.updateQualityUI();
    },

    showUnmutePrompt(video) {
        const canvas = document.getElementById('player-canvas-wrapper');
        if (!canvas) return;
        const existing = document.getElementById('player-unmute-badge');
        if (existing) existing.remove();

        const badge = document.createElement('div');
        badge.id = 'player-unmute-badge';
        badge.className = 'absolute top-4 right-4 z-30 bg-green-500 hover:bg-green-400 text-black px-3.5 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-2xl cursor-pointer animate-pulse select-none transition-all';
        badge.innerHTML = `
            <svg class="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
            <span>Tap to Unmute</span>
        `;
        badge.onclick = (e) => {
            e.stopPropagation();
            video.muted = false;
            video.volume = 1.0;
            badge.remove();
        };
        canvas.appendChild(badge);
    },

    unmuteVideo() {
        const video = document.getElementById('global-video-element');
        if (video) {
            video.muted = false;
            video.volume = 1.0;
        }
        const badge = document.getElementById('player-unmute-badge');
        if (badge) badge.remove();
    },

    updateQualityUI() {
        // 1. Update watch view CONTROLS section container
        const watchQualityContainer = document.getElementById('player-quality-selector-container');
        if (watchQualityContainer) {
            if (!this.qualityLevels || this.qualityLevels.length <= 1) {
                watchQualityContainer.innerHTML = `<span class="text-[10px] text-gray-500 font-bold uppercase">Auto (Adaptive)</span>`;
            } else {
                watchQualityContainer.innerHTML = this.qualityLevels.map(q => {
                    const isSelected = this.currentQuality === q.id;
                    return `
                        <button type="button" data-quality="${q.id}" onclick="AryanPlayerEngine.setQuality(${q.id})"
                                class="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                    isSelected
                                        ? 'bg-green-500 text-black shadow-md shadow-green-500/20 ring-1 ring-green-400 font-extrabold'
                                        : 'bg-gray-800/80 hover:bg-gray-700 text-gray-300 border border-gray-700/60'
                                }">
                            ${q.label}
                        </button>
                    `;
                }).join('');
            }
        }

        // 2. Update modal header quality selector if present
        const modalQualityContainer = document.getElementById('modal-quality-selector');
        if (modalQualityContainer) {
            if (!this.qualityLevels || this.qualityLevels.length <= 1) {
                modalQualityContainer.innerHTML = '';
            } else {
                modalQualityContainer.innerHTML = `
                    <div class="flex items-center gap-1 bg-[#101728] border border-gray-800 px-2 py-0.5 rounded-lg">
                        <span class="text-[10px] text-gray-400 font-bold uppercase">Quality:</span>
                        <select onchange="AryanPlayerEngine.setQuality(parseInt(this.value, 10))" class="bg-transparent text-[11px] font-black text-green-400 border-0 focus:ring-0 cursor-pointer p-0">
                            ${this.qualityLevels.map(q => `<option value="${q.id}" class="bg-[#0e131f] text-white" ${q.id === this.currentQuality ? 'selected' : ''}>${q.label}</option>`).join('')}
                        </select>
                    </div>
                `;
            }
        }
    },

    getProxiedUrl(serverOrUrl, engineOverride) {
        if (!serverOrUrl) return '';

        const engine = engineOverride || this.currentPlayerEngine || 'bitmovin';
        let rawUrl = '';

        if (typeof serverOrUrl === 'object' && serverOrUrl !== null) {
            if (serverOrUrl.url && serverOrUrl.url.includes('shaka_player.html')) {
                return serverOrUrl.url;
            }
            rawUrl = serverOrUrl.rawUrl || serverOrUrl.url || '';
        } else {
            rawUrl = String(serverOrUrl);
        }

        if (!rawUrl) return '';
        if (rawUrl.includes('shaka_player.html')) {
            try {
                const dummy = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'https://asppv.pages.dev';
                const u = new URL(rawUrl, dummy);
                const target = u.searchParams.get('hls') || u.searchParams.get('m3u8') || u.searchParams.get('mpd') || u.searchParams.get('url');
                if (target) rawUrl = target;
            } catch (e) {}
        }
        if (rawUrl.includes('shaka_player.html')) return rawUrl;

        // Route FutbolX match sources to Shaka Player engine
        const isFx = (typeof serverOrUrl === 'object' && serverOrUrl !== null && (serverOrUrl.isFutbolX || (serverOrUrl.name && /^FX\s*\d*/i.test(serverOrUrl.name)))) || rawUrl.includes('ryzn.pro') || rawUrl.includes('futbolx');
        if (isFx) {
            return `shaka_player.html?hls=${encodeURIComponent(rawUrl)}`;
        }

        if (rawUrl.includes('.m3u8')) return rawUrl;

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

        // If rawUrl is already wrapped in /api/embed, unwrap it to get clean upstream URL
        if (rawUrl.includes('/api/embed')) {
            try {
                const dummy = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'https://asppv.pages.dev';
                const u = new URL(rawUrl, dummy);
                const target = u.searchParams.get('url');
                if (target) {
                    rawUrl = target;
                }
            } catch (e) {}
        }

        // Route any domains with frame-ancestors restrictions through the Cloudflare Pages embed proxy
        if (rawUrl.includes('pandecocogaming.sbs') || rawUrl.includes('getsugatensho.sbs') || rawUrl.includes('sportsembed.')) {
            try {
                const parsed = new URL(rawUrl);
                const p = parsed.searchParams.get('p') || '';
                if (engine && engine !== 'bitmovin') {
                    parsed.searchParams.set('player', engine);
                } else {
                    parsed.searchParams.delete('player');
                }
                const pParam = p ? `p=${encodeURIComponent(p)}&` : '';
                return `/api/embed?${pParam}url=${encodeURIComponent(parsed.toString())}`;
            } catch (e) {
                return `/api/embed?url=${encodeURIComponent(rawUrl)}`;
            }
        }

        return rawUrl;
    },

    switchServer(idx) {
        const servers = this.getServers();
        if (idx < 0 || idx >= servers.length) return;
        if (this.activeServerIdx === idx && (this.hls || document.getElementById('global-iframe-element'))) {
            return;
        }

        this.activeServerIdx = idx;
        const targetServer = servers[idx];

        // 1. Instant 0ms visual feedback on source rows
        if (typeof highlightWatchSourceUI === 'function') {
            highlightWatchSourceUI(idx);
        }

        // 2. Seamless media switch without destroying outer canvas
        const canvas = document.getElementById('player-canvas-wrapper');
        const watchContainer = document.getElementById('watch-player-container');
        const modalContainer = document.getElementById('player-viewport-container');
        const container = watchContainer || modalContainer;

        if (canvas && container && (canvas.parentElement === container || container.contains(canvas))) {
            this.switchMediaSource(targetServer, idx);
        } else if (container) {
            this.destroy();
            this.render(container);
        }
    },

    async switchMediaSource(targetServer, idx) {
        const canvas = document.getElementById('player-canvas-wrapper');
        if (!canvas) return;

        const serverUrl = targetServer.url || targetServer.rawUrl || targetServer.embedUrl || '';
        const isHls = (targetServer.type === 'video' || serverUrl.includes('.m3u8')) &&
                      !serverUrl.includes('.mpd') &&
                      !serverUrl.includes('cenc') &&
                      !serverUrl.includes('shaka_player.html');

        // Show loading spinner
        const loader = document.getElementById('player-loading-overlay');
        if (loader) {
            loader.style.display = 'flex';
            loader.style.opacity = '1';
            const label = loader.querySelector('.text-xs');
            if (label) label.textContent = `Connecting ${targetServer.name || 'Server'}...`;
        }
        const errorOverlay = document.getElementById('player-error-overlay');
        if (errorOverlay) errorOverlay.classList.add('hidden');

        // Reset quality selector
        this.qualityLevels = [];
        this.currentQuality = -1;
        this.updateQualityUI();

        if (isHls) {
            // Remove iframe if present
            const oldIframe = document.getElementById('global-iframe-element');
            if (oldIframe) {
                oldIframe.src = 'about:blank';
                oldIframe.remove();
            }

            let video = document.getElementById('global-video-element');
            if (!video) {
                video = document.createElement('video');
                video.id = 'global-video-element';
                video.className = 'w-full h-full object-contain';
                video.controls = true;
                video.autoplay = true;
                video.playsInline = true;
                canvas.appendChild(video);
            }

            // Tear down old HLS instance cleanly
            if (this.hls) {
                try {
                    this.hls.stopLoad();
                    this.hls.detachMedia();
                    this.hls.destroy();
                } catch(e) {}
                this.hls = null;
            }

            // High-speed token resolution (cached in memory)
            const playableUrl = await this.resolvePlayableStreamUrl(serverUrl);
            this.attachHlsPlayback(playableUrl, video, loader, errorOverlay);
        } else {
            // Teardown HLS and video
            if (this.hls) {
                try {
                    this.hls.stopLoad();
                    this.hls.detachMedia();
                    this.hls.destroy();
                } catch(e) {}
                this.hls = null;
            }
            const oldVideo = document.getElementById('global-video-element');
            if (oldVideo) {
                oldVideo.pause();
                oldVideo.removeAttribute('src');
                oldVideo.load();
                oldVideo.remove();
            }

            let iframe = document.getElementById('global-iframe-element');
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = 'global-iframe-element';
                iframe.className = 'w-full h-full border-0';
                iframe.allowFullscreen = true;
                iframe.setAttribute('allow', 'autoplay *; encrypted-media *; picture-in-picture *; fullscreen *; display-capture *');
                canvas.appendChild(iframe);
            } else {
                // Immediately mute and blank old stream to eliminate sound overlap
                iframe.src = 'about:blank';
            }

            const initialSrc = this.getProxiedUrl(targetServer, this.currentPlayerEngine);
            iframe.onload = () => {
                if (loader) {
                    loader.style.opacity = '0';
                    setTimeout(() => { if (loader) loader.style.display = 'none'; }, 100);
                }
            };
            setTimeout(() => {
                if (loader) {
                    loader.style.opacity = '0';
                    setTimeout(() => { if (loader) loader.style.display = 'none'; }, 100);
                }
            }, 800);

            requestAnimationFrame(() => {
                iframe.src = initialSrc;
            });
        }

        this.updateModalServerTabs();
    },

    updateModalServerTabs() {
        const tabs = document.querySelectorAll('#modal-server-tabs button');
        tabs.forEach((tab, i) => {
            const isActive = i === this.activeServerIdx;
            if (isActive) {
                tab.className = 'px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all flex-shrink-0 bg-green-500 text-black shadow-lg shadow-green-500/25 ring-2 ring-green-400';
                const dot = tab.querySelector('span');
                if (dot) dot.className = 'w-2 h-2 rounded-full bg-black animate-pulse';
            } else {
                tab.className = 'px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all flex-shrink-0 bg-[#182030] text-gray-300 hover:bg-gray-800 border border-gray-800';
                const dot = tab.querySelector('span');
                if (dot) dot.className = 'w-2 h-2 rounded-full bg-green-400';
            }
        });
    },

    reloadPlayer() {
        const watchContainer = document.getElementById('watch-player-container');
        if (watchContainer && (typeof currentView !== 'undefined' && currentView === 'watch')) {
            this.destroy();
            this.render(watchContainer);
            return;
        }
        const container = document.getElementById('player-viewport-container');
        if (container) {
            this.destroy();
            this.render(container);
        }
    },

    changePlayerEngine(engine) {
        this.currentPlayerEngine = engine || 'bitmovin';
        this.reloadPlayer();
        if (typeof updatePlayerDropdownUI === 'function') {
            updatePlayerDropdownUI(this.currentPlayerEngine);
        }
    },

    toggleTheater() {
        this.isTheater = !this.isTheater;
        const modalDialog = document.querySelector('#player-modal > div');
        if (modalDialog) {
            if (this.isTheater) {
                modalDialog.classList.remove('max-w-5xl');
                modalDialog.classList.add('max-w-[98vw]', 'h-[95vh]');
            } else {
                modalDialog.classList.remove('max-w-[98vw]', 'h-[95vh]');
                modalDialog.classList.add('max-w-5xl');
            }
        }
    },

    toggleFullscreen() {
        const viewport = document.getElementById('player-canvas-wrapper');
        if (!viewport) return;

        if (!document.fullscreenElement) {
            if (viewport.requestFullscreen) {
                viewport.requestFullscreen();
            } else if (viewport.webkitRequestFullscreen) {
                viewport.webkitRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    },

    copyStreamLink() {
        const servers = this.getServers();
        const currentServer = servers[this.activeServerIdx] || servers[0];
        if (currentServer && currentServer.url) {
            navigator.clipboard.writeText(currentServer.url).then(() => {
                alert('Stream URL copied to clipboard!\n\n' + currentServer.url);
            }).catch(() => {
                prompt('Copy stream URL:', currentServer.url);
            });
        }
    },

    openExternal() {
        const servers = this.getServers();
        const currentServer = servers[this.activeServerIdx] || servers[0];
        if (currentServer && currentServer.url) {
            window.open(currentServer.url, '_blank');
        }
    },

    render(container) {
        const servers = this.getServers();
        const currentServer = servers[this.activeServerIdx] || servers[0] || null;

        if (!currentServer || (!currentServer.url && !currentServer.embedUrl && !currentServer.rawUrl)) {
            container.innerHTML = `
                <div id="player-canvas-wrapper" class="relative aspect-video w-full bg-black overflow-hidden flex flex-col items-center justify-center p-6 text-center space-y-3">
                    <div class="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                    <div class="text-xs font-bold text-white tracking-widest uppercase">Connecting to broadcast channels...</div>
                    <div class="text-[11px] text-gray-400">Fetching live streams from satellite feed</div>
                </div>
            `;
            return;
        }

        const serverUrl = currentServer.url || currentServer.rawUrl || currentServer.embedUrl || '';
        const isHls = (currentServer.type === 'video' || serverUrl.includes('.m3u8')) &&
                      !serverUrl.includes('.mpd') &&
                      !serverUrl.includes('cenc') &&
                      !serverUrl.includes('shaka_player.html');

        let html = '';

        // HEADER CONTROLS & SERVER TABS (Only shown in modal mode, omitted in watch view)
        if (container.id !== 'watch-player-container') {
            html += `<div class="bg-[#0e131f] border-b border-gray-800 p-3 space-y-2.5">`;

            // Action Toolbar
            html += `
                <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800/60 pb-2.5">
                    <div class="flex items-center gap-2">
                        <span class="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
                        <span class="text-xs font-black text-white uppercase tracking-wider">
                            STREAM SERVERS (${servers.length})
                        </span>
                        <span class="text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded font-bold uppercase">
                            ${isHls ? 'Direct HLS' : 'Secure Embed'}
                        </span>
                        <div id="modal-quality-selector" class="flex items-center"></div>
                    </div>
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <button onclick="AryanPlayerEngine.reloadPlayer()" title="Reload Player" class="px-2.5 py-1 bg-gray-800/90 hover:bg-gray-700 text-gray-200 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                            Reload
                        </button>
                        ${servers.length > 1 ? `
                        <button onclick="AryanPlayerEngine.switchServer((AryanPlayerEngine.activeServerIdx + 1) % ${servers.length})" class="px-2.5 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>
                            Next Server
                        </button>
                        ` : ''}
                        <button onclick="AryanPlayerEngine.toggleTheater()" title="Toggle Theater Mode" class="px-2.5 py-1 bg-gray-800/90 hover:bg-gray-700 text-gray-200 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
                            Theater
                        </button>
                        <button onclick="AryanPlayerEngine.toggleFullscreen()" title="Fullscreen" class="px-2.5 py-1 bg-gray-800/90 hover:bg-gray-700 text-gray-200 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h7v2H5v5H3V3zm18 0v7h-2V5h-5V3h7zM3 21v-7h2v5h5v2H3zm18 0h-7v-2h5v-5h2v7z"/></svg>
                        </button>
                        <button onclick="AryanPlayerEngine.openExternal()" title="Open Stream in New Window" class="px-2.5 py-1 bg-gray-800/90 hover:bg-gray-700 text-gray-200 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                        </button>
                    </div>
                </div>
            `;

            // Multi-Server Tabs
            html += `<div id="modal-server-tabs" class="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">`;
            servers.forEach((srv, i) => {
                const isActive = i === this.activeServerIdx;
                const btnName = srv.name || `Server ${i + 1}`;
                html += `
                    <button onclick="AryanPlayerEngine.switchServer(${i})"
                            class="px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all flex-shrink-0 ${isActive ? 'bg-green-500 text-black shadow-lg shadow-green-500/25 ring-2 ring-green-400' : 'bg-[#182030] text-gray-300 hover:bg-gray-800 border border-gray-800'}">
                        <span class="w-2 h-2 rounded-full ${isActive ? 'bg-black animate-pulse' : 'bg-green-400'}"></span>
                        ${btnName}
                    </button>
                `;
            });
            html += `</div>`;
            html += `</div>`;
        }

        // PLAYER CANVAS VIEWPORT
        html += `<div id="player-canvas-wrapper" class="relative aspect-video w-full bg-black overflow-hidden flex items-center justify-center">`;

        // Loader overlay
        html += `
            <div id="player-loading-overlay" class="absolute inset-0 z-20 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center transition-opacity duration-300">
                <div class="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <div class="text-xs font-bold text-white tracking-widest uppercase">Connecting ${currentServer.name || 'Server'}...</div>
                <div class="text-[11px] text-gray-400 mt-1">Please wait while the stream initializes</div>
            </div>
        `;

        // Error message placeholder
        html += `
            <div id="player-error-overlay" class="absolute inset-0 z-10 bg-black/95 flex flex-col items-center justify-center p-6 text-center space-y-3 hidden">
                <div class="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-500">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                </div>
                <div class="text-sm font-black text-white uppercase tracking-wider">Stream Connection Failed on This Server</div>
                <p class="text-xs text-gray-400 max-w-md">This stream may have ended or is temporarily unavailable. Please switch to another server or reload.</p>
                <div class="flex items-center gap-3 pt-2">
                    ${servers.length > 1 ? `
                    <button onclick="AryanPlayerEngine.switchServer((AryanPlayerEngine.activeServerIdx + 1) % ${servers.length})" class="px-4 py-2 bg-green-500 hover:bg-green-400 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg">
                        Try Next Server
                    </button>
                    ` : ''}
                    <button onclick="AryanPlayerEngine.reloadPlayer()" class="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all border border-gray-700">
                        Reload Stream
                    </button>
                </div>
            </div>
        `;

        if (isHls) {
            html += `<video id="global-video-element" class="w-full h-full object-contain" controls autoplay playsinline></video>`;
        } else {
            const initialSrc = this.getProxiedUrl(currentServer, this.currentPlayerEngine);
            html += `<iframe id="global-iframe-element" src="${initialSrc}" class="w-full h-full border-0" allowfullscreen allow="autoplay *; encrypted-media *; picture-in-picture *; fullscreen *; display-capture *"></iframe>`;
        }

        html += `</div>`;
        container.innerHTML = html;

        const loader = document.getElementById('player-loading-overlay');
        const errorOverlay = document.getElementById('player-error-overlay');

        if (isHls) {
            const video = document.getElementById('global-video-element');
            if (video) {
                this.resolvePlayableStreamUrl(serverUrl).then(playableUrl => {
                    this.attachHlsPlayback(playableUrl, video, loader, errorOverlay);
                });
            }
        } else {
            const iframe = document.getElementById('global-iframe-element');
            if (iframe) {
                iframe.onload = () => {
                    if (loader) {
                        loader.style.opacity = '0';
                        setTimeout(() => { if (loader) loader.style.display = 'none'; }, 200);
                    }
                };
                setTimeout(() => {
                    if (loader) {
                        loader.style.opacity = '0';
                        setTimeout(() => { if (loader) loader.style.display = 'none'; }, 200);
                    }
                }, 2000);
            }
        }
    },

    attachHlsPlayback(playableUrl, video, loader, errorOverlay) {
        if (!video) return;

        // Auto-configure volume and sound
        video.volume = 1.0;
        video.muted = false;

        if (window.Hls && Hls.isSupported() && playableUrl.includes('.m3u8')) {
            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: false,
                liveSyncDurationCount: 5,        // 5 segments buffer ahead = rock-solid, zero pause!
                liveMaxLatencyDurationCount: 12, // High tolerance before drift
                maxBufferLength: 60,             // Buffer up to 60s
                maxMaxBufferLength: 120,         // Headroom up to 120s
                backBufferLength: 60,
                maxBufferHole: 0.8,              // Skip tiny audio/video drift holes
                highBufferWatchdogPeriod: 2,
                nudgeOffset: 0.2,
                nudgeMaxRetry: 10,               // Nudge through tiny stutters instead of pausing!
                maxFragLookUpTolerance: 0.3,
                manifestLoadingTimeOut: 20000,
                manifestLoadingMaxRetry: 5,
                levelLoadingTimeOut: 20000,
                levelLoadingMaxRetry: 5,
                fragLoadingTimeOut: 20000,
                fragLoadingMaxRetry: 6,
                startLevel: -1
            });
            hls.loadSource(playableUrl);
            hls.attachMedia(video);
            this.hls = hls;

            hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                const playPromise = video.play();
                if (playPromise !== undefined) {
                    playPromise.catch(() => {
                        // If browser blocks unmuted autoplay, play muted and display quick tap-to-unmute badge
                        video.muted = true;
                        video.play().catch(() => {});
                        this.showUnmutePrompt(video);
                    });
                }
                if (loader) {
                    loader.style.opacity = '0';
                    setTimeout(() => { if (loader) loader.style.display = 'none'; }, 200);
                }

                // Register quality levels
                try {
                    const rawLevels = hls.levels || (data && data.levels) || [];
                    if (Array.isArray(rawLevels) && rawLevels.length > 0) {
                        const qLevels = [{ id: -1, label: 'Auto' }];
                        rawLevels.forEach((lvl, idx) => {
                            const height = lvl.height || (lvl.attrs && lvl.attrs.RESOLUTION && lvl.attrs.RESOLUTION.height);
                            const label = height ? `${height}p` : `Level ${idx + 1}`;
                            qLevels.push({ id: idx, label: label, height: height || 0, bitrate: lvl.bitrate || 0 });
                        });
                        const autoOpt = qLevels[0];
                        const manualOpts = qLevels.slice(1).sort((a, b) => (b.height || b.bitrate) - (a.height || a.bitrate));
                        this.qualityLevels = [autoOpt, ...manualOpts];
                        this.currentQuality = -1;
                        this.updateQualityUI();
                    } else {
                        this.qualityLevels = [{ id: -1, label: 'Auto' }];
                        this.currentQuality = -1;
                        this.updateQualityUI();
                    }
                } catch (qe) {
                    console.warn('Quality parse error:', qe);
                }
            });

            // Auto-unmute when user clicks or touches anywhere on player canvas
            const canvas = document.getElementById('player-canvas-wrapper');
            if (canvas && !canvas._hasUnmuteListener) {
                canvas._hasUnmuteListener = true;
                const unmuteHandler = () => {
                    const v = document.getElementById('global-video-element');
                    if (v && v.muted) {
                        v.muted = false;
                        v.volume = 1.0;
                        const badge = document.getElementById('player-unmute-badge');
                        if (badge) badge.remove();
                    }
                };
                canvas.addEventListener('click', unmuteHandler, { passive: true });
                canvas.addEventListener('touchstart', unmuteHandler, { passive: true });
            }

            hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
                if (this.currentQuality === -1 && data && typeof data.level === 'number' && hls.levels) {
                    const activeLvl = hls.levels[data.level];
                    if (activeLvl && activeLvl.height) {
                        const autoBtn = document.querySelector('#player-quality-selector-container button[data-quality="-1"]');
                        if (autoBtn) {
                            autoBtn.textContent = `Auto (${activeLvl.height}p)`;
                        }
                    }
                }
            });

            let networkRetries = 0;
            hls.on(Hls.Events.ERROR, async (event, data) => {
                // 1. Recover buffer stall automatically (prevents stream from stopping/pausing mid-match)
                if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
                    console.warn('[HLS] Buffer stall detected, auto-nudging playback...');
                    if (video.paused && !video.ended) {
                        video.play().catch(() => {});
                    }
                    return;
                }

                // 2. Token expiration recovery (HTTP 403 on ryzn.pro)
                const isAuthError = data.response && (data.response.code === 403 || data.response.code === 401);
                if (isAuthError && playableUrl.includes('ryzn.pro')) {
                    console.warn('[HLS] Token expired, refreshing stream token in background...');
                    const rawBase = playableUrl.split('?')[0];
                    if (this._tokenCache) this._tokenCache.delete(rawBase);
                    try {
                        const ssKey = 'fx_tok_' + btoa(rawBase).slice(0, 32);
                        sessionStorage.removeItem(ssKey);
                    } catch(e) {}
                    
                    const refreshedUrl = await this.resolvePlayableStreamUrl(rawBase);
                    if (refreshedUrl && refreshedUrl !== playableUrl) {
                        const curTime = video.currentTime;
                        hls.loadSource(refreshedUrl);
                        video.currentTime = curTime;
                        video.play().catch(() => {});
                        return;
                    }
                }

                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            networkRetries++;
                            if (networkRetries <= 3) {
                                console.warn('[HLS] Network error retry:', networkRetries);
                                hls.startLoad();
                            } else {
                                hls.destroy();
                                if (loader) { loader.style.opacity = '0'; loader.style.display = 'none'; }
                                const servers = this.getServers();
                                if (servers.length > 1) {
                                    const nextIdx = (this.activeServerIdx + 1) % servers.length;
                                    console.warn('HLS network error, switching to next server:', nextIdx);
                                    this.switchServer(nextIdx);
                                } else if (errorOverlay) {
                                    errorOverlay.classList.remove('hidden');
                                }
                            }
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.warn('[HLS] Media error, recovering...');
                            hls.recoverMediaError();
                            if (video.paused) {
                                video.play().catch(() => {});
                            }
                            break;
                        default:
                            hls.destroy();
                            if (loader) { loader.style.opacity = '0'; loader.style.display = 'none'; }
                            if (errorOverlay) errorOverlay.classList.remove('hidden');
                            break;
                    }
                }
            });
        } else if (playableUrl) {
            video.src = playableUrl;
            video.onloadeddata = () => {
                const playPromise = video.play();
                if (playPromise !== undefined) {
                    playPromise.catch(() => {
                        video.muted = true;
                        video.play().catch(() => {});
                    });
                }
                if (loader) {
                    loader.style.opacity = '0';
                    setTimeout(() => { if (loader) loader.style.display = 'none'; }, 200);
                }
            };
            video.onerror = () => {
                if (loader) { loader.style.opacity = '0'; loader.style.display = 'none'; }
                if (errorOverlay) errorOverlay.classList.remove('hidden');
            };
        }
    }
};
