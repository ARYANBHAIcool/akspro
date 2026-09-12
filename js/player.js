/**
 * AryanStreams Global - Universal Multi-Server Player Engine
 * Automatically attaches and switches between single or multiple stream sources:
 * - Native HLS.js video engine for direct .m3u8 feeds with quality & audio track selection
 * - Sandboxed, secure iframe embeds for PPV / Web embeds
 * - Fullscreen, Theater Mode, Reload, and Next Server auto-fallback
 */

window.AryanPlayerEngine = {
    currentStream: null,
    activeServerIdx: 0,
    hls: null,
    isTheater: false,

    init(containerId, streamItem) {
        const container = document.getElementById(containerId);
        if (!container) return;

        this.destroy();
        this.currentStream = streamItem;
        this.activeServerIdx = 0;
        this.render(container);
    },

    destroy() {
        if (this.hls) {
            try {
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
        return Array.isArray(list) && list.length > 0 ? list : [this.currentStream];
    },

    currentPlayerEngine: 'bitmovin',

    getProxiedUrl(serverOrUrl, engineOverride) {
        if (!serverOrUrl) return '';

        const engine = engineOverride || this.currentPlayerEngine || 'bitmovin';
        let rawUrl = '';

        if (typeof serverOrUrl === 'object' && serverOrUrl !== null) {
            rawUrl = serverOrUrl.rawUrl || serverOrUrl.url || '';
        } else {
            rawUrl = String(serverOrUrl);
        }

        if (!rawUrl) return '';
        if (rawUrl.includes('.m3u8')) return rawUrl;

        // If rawUrl is already wrapped in /api/embed, unwrap it to get clean upstream URL
        if (rawUrl.includes('/api/embed')) {
            try {
                const u = new URL(rawUrl, window.location.origin);
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
                if (engine && engine !== 'bitmovin') {
                    parsed.searchParams.set('player', engine);
                } else {
                    parsed.searchParams.delete('player');
                }
                return `/api/embed?url=${encodeURIComponent(parsed.toString())}`;
            } catch (e) {
                return `/api/embed?url=${encodeURIComponent(rawUrl)}`;
            }
        }

        return rawUrl;
    },

    switchServer(idx) {
        const servers = this.getServers();
        if (idx < 0 || idx >= servers.length) return;
        this.destroy();
        this.activeServerIdx = idx;
        const watchContainer = document.getElementById('watch-player-container');
        if (watchContainer && (typeof currentView !== 'undefined' && currentView === 'watch')) {
            this.render(watchContainer);
            if (typeof renderWatchSources === 'function' && this.currentStream) {
                renderWatchSources(this.currentStream, idx);
            }
            return;
        }
        const container = document.getElementById('player-viewport-container');
        if (container) {
            this.render(container);
        }
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
        const servers = this.getServers();
        const currentServer = servers[this.activeServerIdx] || servers[0];
        if (currentServer) {
            currentServer.url = this.getProxiedUrl(currentServer, this.currentPlayerEngine);
        }
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
        const currentServer = servers[this.activeServerIdx] || servers[0] || { name: "Server 1", url: "", type: "iframe" };
        const isHls = currentServer.type === 'video' || currentServer.url.includes('.m3u8');

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
            html += `<div class="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">`;
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
            const finalIframeUrl = this.getProxiedUrl(currentServer, this.currentPlayerEngine);
            html += `<iframe id="global-iframe-element" src="${finalIframeUrl}" class="w-full h-full border-0" allowfullscreen allow="autoplay *; encrypted-media *; picture-in-picture *; fullscreen *; display-capture *" referrerpolicy="no-referrer"></iframe>`;
        }

        html += `</div>`;

        container.innerHTML = html;

        // Connect media
        const loader = document.getElementById('player-loading-overlay');
        const errorOverlay = document.getElementById('player-error-overlay');

        if (isHls) {
            const video = document.getElementById('global-video-element');
            if (!video) return;

            if (window.Hls && Hls.isSupported() && currentServer.url.includes('.m3u8')) {
                const hls = new Hls({
                    enableWorker: true,
                    lowLatencyMode: true,
                    backBufferLength: 60
                });
                hls.loadSource(currentServer.url);
                hls.attachMedia(video);
                this.hls = hls;

                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    video.play().catch(() => {});
                    if (loader) loader.style.opacity = '0', setTimeout(() => loader.remove(), 300);
                });

                hls.on(Hls.Events.ERROR, (event, data) => {
                    if (data.fatal) {
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                hls.startLoad();
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                hls.recoverMediaError();
                                break;
                            default:
                                if (loader) loader.remove();
                                if (errorOverlay) errorOverlay.classList.remove('hidden');
                                break;
                        }
                    }
                });
            } else {
                video.src = currentServer.url;
                video.onloadeddata = () => {
                    video.play().catch(() => {});
                    if (loader) loader.style.opacity = '0', setTimeout(() => loader.remove(), 300);
                };
                video.onerror = () => {
                    if (loader) loader.remove();
                    if (errorOverlay) errorOverlay.classList.remove('hidden');
                };
            }
        } else {
            const iframe = document.getElementById('global-iframe-element');
            if (iframe) {
                iframe.onload = () => {
                    if (loader) loader.style.opacity = '0', setTimeout(() => loader.remove(), 300);
                };
                // Fallback hide loader after 2.5s for iframe players
                setTimeout(() => {
                    if (loader) loader.style.opacity = '0', setTimeout(() => loader.remove(), 300);
                }, 2500);
            }
        }
    }
};
