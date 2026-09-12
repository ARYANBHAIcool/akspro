/**
 * AryanStreams Global - Paramount+ (PRMTV) Section Engine
 * Integrated directly with StreamCorner Paramount API:
 * - Live Hero Marquee Carousel & Peek Cards
 * - Full UEFA Champions League, NFL on CBS, UFC, Zuffa Boxing & CBS Sports Schedule
 * - Multi-Server Player resolution with SportsEmbed, Shaka, Bitmovin & JWPlayer
 */

(function () {
    'use strict';

    const WORKER_NODES = [
        'data.gigav.workers.dev',
        'data.yedmzoa.workers.dev',
        'data.ngagzipx.workers.dev',
        'data.senbon001.workers.dev',
        'data.senbon002.workers.dev',
        'data.phamviet444.workers.dev',
        'data.kanghaerin444.workers.dev',
        'data.minjikim444.workers.dev'
    ];

    function getRandomWorker() {
        return WORKER_NODES[Math.floor(Math.random() * WORKER_NODES.length)];
    }

    window.AryanParamountAPI = {
        isLoading: true,
        heroData: null,
        scheduleData: [],
        currentFilter: 'All',
        currentSlideIdx: 0,
        refreshInterval: null,
        listeners: [],

        async init() {
            this.isLoading = true;
            this.emitUpdate();

            await this.refresh();

            this.isLoading = false;
            this.emitUpdate();
            this.startHeroTimer();
            this.startAutoRefresh(60000);
        },

        async refresh() {
            const worker = getRandomWorker();
            try {
                if (window.StreamCornerCore && typeof window.StreamCornerCore.t === 'function') {
                    const [hero, schedule] = await Promise.allSettled([
                        window.StreamCornerCore.t(`https://${worker}/corner?p=paramount_hero`, true, 'Paramount carousel'),
                        window.StreamCornerCore.t(`https://${worker}/corner?p=paramount_schedule`, false, 'Paramount schedule')
                    ]);

                    if (hero.status === 'fulfilled' && hero.value) {
                        this.heroData = hero.value;
                    }
                    if (schedule.status === 'fulfilled' && Array.isArray(schedule.value)) {
                        this.scheduleData = schedule.value;
                        this.integrateIntoGlobalCatalog();
                    }
                }
            } catch (err) {
                console.warn('Paramount auto-refresh error:', err);
            }
            this.emitUpdate();
        },

        startAutoRefresh(intervalMs = 60000) {
            if (this.refreshInterval) clearInterval(this.refreshInterval);
            this.refreshInterval = setInterval(() => {
                this.refresh();
            }, intervalMs);
        },

        onUpdate(fn) {
            if (typeof fn === 'function') this.listeners.push(fn);
        },

        emitUpdate() {
            for (const cb of this.listeners) {
                try { cb(); } catch (e) {}
            }
        },

        getEventById(id) {
            if (!Array.isArray(this.scheduleData)) return null;
            for (const cat of this.scheduleData) {
                const events = Array.isArray(cat.events) ? cat.events : [];
                for (const ev of events) {
                    const norm = this.normalizeEvent(ev, cat.category);
                    if (norm && norm.id === id) return norm;
                }
            }
            return null;
        },

        integrateIntoGlobalCatalog() {
            // Paramount matches stay exclusively in the PRMTV section to keep the main PPV catalog pure and uncluttered
            return;
        },

        normalizeEvent(ev, categoryName) {
            if (ev._normalized) return ev._normalized;
            const contentId = ev.content_id || ev.stream_id || ev.id || (ev.url ? ev.url.replace(/[^a-zA-Z0-9_-]/g, '_') : Math.random().toString(36).substring(2, 9));
            const title = ev.title || ev.on_now_title || 'Paramount+ Event';
            const poster = ev.poster || ev.thumb || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800';
            const streamUrl = ev.url || `/live-tv/stream/${contentId}`;
            const isLive = Boolean(ev.live_badge_text || ev.liveBadgeText || ev.is_live || String(categoryName).toLowerCase().includes('live'));

            const rawEmbedBase = `https://sportsembed.su.getsugatensho.sbs/para?page=${encodeURI(streamUrl)}`;
            const embedBase = `/api/embed?page=${encodeURIComponent(streamUrl)}&url=${encodeURIComponent(rawEmbedBase)}`;

            const servers = [
                {
                    name: 'Server 1: Paramount Direct [HD]',
                    url: embedBase,
                    type: 'iframe',
                    hd: true
                },
                {
                    name: 'Server 2: Shaka Player [60FPS]',
                    url: `${embedBase}&player=shaka`,
                    type: 'iframe',
                    hd: true
                },
                {
                    name: 'Server 3: Bitmovin Player',
                    url: `${embedBase}&player=bitmovin`,
                    type: 'iframe',
                    hd: true
                },
                {
                    name: 'Server 4: JWPlayer',
                    url: `${embedBase}&player=jwplayer`,
                    type: 'iframe',
                    hd: true
                }
            ];

            const norm = {
                id: `prmtv-${contentId}`,
                source: 'paramount',
                title: title,
                sport: 'PARAMOUNT+',
                league: (categoryName || 'Paramount+ Sports').toUpperCase(),
                startTime: ev.start_timestamp || Date.now(),
                endTime: (ev.start_timestamp || Date.now()) + 10800000,
                isLive: isLive,
                status: isLive ? 'live' : 'upcoming',
                poster: poster,
                team1: {
                    name: title.split(/ vs\.? | @ /)[0] || title,
                    logo: ev.logo || ev.channel_logo || ''
                },
                team2: {
                    name: title.split(/ vs\.? | @ /)[1] || '',
                    logo: ''
                },
                servers: servers,
                sources: servers
            };
            ev._normalized = norm;
            return norm;
        },

        startHeroTimer() {
            if (this.carouselInterval) clearInterval(this.carouselInterval);
            this.carouselInterval = setInterval(() => {
                const slides = this.heroData?.hero?.slides || [];
                if (slides.length > 1) {
                    this.currentSlideIdx = (this.currentSlideIdx + 1) % slides.length;
                    this.renderHeroSlide();
                }
            }, 6000);
        },

        setSlide(idx) {
            const slides = this.heroData?.hero?.slides || [];
            if (idx >= 0 && idx < slides.length) {
                this.currentSlideIdx = idx;
                this.renderHeroSlide();
            }
        },

        renderHeroSlide() {
            const slides = this.heroData?.hero?.slides || [];
            if (slides.length === 0) return;

            const slide = slides[this.currentSlideIdx] || slides[0];
            const bgEl = document.getElementById('prmtv-hero-bg');
            const titleEl = document.getElementById('prmtv-hero-title');
            const tuneEl = document.getElementById('prmtv-hero-tune');
            const descEl = document.getElementById('prmtv-hero-desc');
            const logoEl = document.getElementById('prmtv-hero-logo');

            if (bgEl && slide.image) {
                bgEl.style.backgroundImage = `url(${slide.image})`;
            }
            if (tuneEl) {
                tuneEl.innerText = slide.tuneIn || 'NOW STREAMING';
            }
            if (descEl) {
                descEl.innerText = slide.description || '';
            }
            if (logoEl && slide.logo) {
                logoEl.src = slide.logo;
                logoEl.style.display = 'block';
                if (titleEl) titleEl.style.display = 'none';
            } else if (titleEl) {
                titleEl.innerText = slide.logoAlt || slide.title || 'Paramount+ Sports';
                titleEl.style.display = 'block';
                if (logoEl) logoEl.style.display = 'none';
            }

            // Update peek active states
            document.querySelectorAll('.prmtv-peek-card').forEach((el, i) => {
                if (i === this.currentSlideIdx) {
                    el.className = 'prmtv-peek-card relative h-[140px] w-[100px] sm:h-[156px] sm:w-[112px] cursor-pointer overflow-hidden rounded-xl border-2 border-white bg-black shadow-2xl transition-all duration-300 transform -translate-y-1';
                } else {
                    el.className = 'prmtv-peek-card relative h-[140px] w-[100px] sm:h-[156px] sm:w-[112px] cursor-pointer overflow-hidden rounded-xl border-2 border-transparent bg-black/80 shadow-lg opacity-70 hover:opacity-100 transition-all duration-300';
                }
            });
        },

        filterCategory(categoryTitle) {
            this.currentFilter = categoryTitle;
            this.renderSchedule();

            // Update pill styling
            document.querySelectorAll('.prmtv-cat-pill').forEach(btn => {
                if (btn.getAttribute('data-cat') === categoryTitle) {
                    btn.className = 'prmtv-cat-pill px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-blue-600 text-white border border-blue-400 shadow-md transition-all';
                } else {
                    btn.className = 'prmtv-cat-pill px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-white/10 text-white/70 hover:text-white border border-white/10 transition-all';
                }
            });
        },

        renderPrmtvView() {
            const container = document.getElementById('view-prmtv');
            if (!container) return;

            const existingSchedule = document.getElementById('prmtv-schedule-container');
            if (existingSchedule && container.children.length > 2) {
                this.renderSchedule();
                return;
            }

            const slides = this.heroData?.hero?.slides || [];
            const firstSlide = slides[0] || {
                image: 'https://wwwimage-us.pplusstatic.com/thumbnails/photos/w3200-q80/marquee/1060014/54/15/21/asset_marquee_b1f3a123-d2bf-4e72-bd91-b9dc1d5b65c7.jpg?format=webp',
                tuneIn: 'NOW STREAMING',
                title: 'Paramount+ Sports Hub',
                description: 'Catch UEFA Champions League, NFL on CBS, UFC, and live sports on Paramount+.'
            };

            const categories = ['All', ...(this.scheduleData || []).map(c => c.category)];

            let html = `
                <!-- PARAMOUNT NOTICE BANNER -->
                <div class="bg-blue-600/15 border border-blue-500/30 rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3 text-xs">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400 flex-shrink-0">
                            <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                        </div>
                        <div>
                            <span class="font-extrabold text-white uppercase tracking-wider">PRMTV / Paramount+ Streams:</span>
                            <span class="text-blue-200 ml-1">Direct live multi-server feeds for UEFA Champions League, NFL on CBS, UFC, and Serie A.</span>
                        </div>
                    </div>
                    <span class="hidden sm:inline-block px-2.5 py-1 bg-blue-600/30 text-blue-300 font-extrabold text-[10px] rounded-md uppercase border border-blue-400/30">
                        HD 60FPS
                    </span>
                </div>

                <!-- HERO MARQUEE BANNER (Exact StreamCorner Showcase) -->
                <div class="relative w-full rounded-3xl overflow-hidden min-h-[380px] sm:min-h-[440px] bg-[#0c0f16] border border-gray-800 shadow-2xl flex items-end">
                    <!-- Background Image -->
                    <div id="prmtv-hero-bg" class="absolute inset-0 bg-cover bg-center transition-all duration-700 brightness-75"
                         style="background-image: url('${firstSlide.image}');"></div>
                    
                    <!-- Gradient Overlays -->
                    <div class="absolute inset-0 bg-gradient-to-t from-[#080c14] via-[#080c14]/40 to-transparent"></div>
                    <div class="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent"></div>

                    <!-- Slide Content -->
                    <div class="relative z-10 p-6 sm:p-10 max-w-xl space-y-3">
                        <span id="prmtv-hero-tune" class="inline-block px-3 py-1 bg-[#00e676] text-black font-black text-xs uppercase tracking-widest rounded shadow">
                            ${firstSlide.tuneIn || 'NOW STREAMING'}
                        </span>
                        <img id="prmtv-hero-logo" src="${firstSlide.logo || ''}" class="max-h-16 w-auto object-contain ${firstSlide.logo ? '' : 'hidden'}" alt="Paramount+">
                        <h2 id="prmtv-hero-title" class="text-2xl sm:text-3xl font-black text-white uppercase tracking-wide drop-shadow-md ${firstSlide.logo ? 'hidden' : ''}">
                            ${firstSlide.logoAlt || firstSlide.title || 'Paramount+ Sports'}
                        </h2>
                        <p id="prmtv-hero-desc" class="text-xs sm:text-sm text-gray-200 line-clamp-3 leading-relaxed drop-shadow">
                            ${firstSlide.description || ''}
                        </p>
                    </div>

                    <!-- Peek Cards (Thumbnails in bottom right) -->
                    <div class="absolute bottom-6 right-6 z-10 hidden lg:flex items-center gap-3">
                        ${slides.slice(0, 4).map((s, i) => `
                            <div onclick="AryanParamountAPI.setSlide(${i})" class="prmtv-peek-card relative h-[140px] w-[100px] sm:h-[156px] sm:w-[112px] cursor-pointer overflow-hidden rounded-xl border-2 ${i === 0 ? 'border-white -translate-y-1' : 'border-transparent opacity-70'} bg-black shadow-xl transition-all duration-300">
                                <img src="${s.peek || s.image}" class="w-full h-full object-cover" alt="" loading="lazy">
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- CATEGORY SUB-TABS -->
                <div class="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2 pt-2">
                    ${categories.map((c, i) => `
                        <button onclick="AryanParamountAPI.filterCategory('${c}')" data-cat="${c}"
                                class="prmtv-cat-pill px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all flex-shrink-0 ${i === 0 ? 'bg-blue-600 text-white border border-blue-400 shadow-md font-black' : 'bg-white/10 text-white/70 hover:text-white border border-white/10'}">
                            ${c.toLowerCase().includes('live') ? '🔴 ' : ''}${c}
                        </button>
                    `).join('')}
                </div>

                <!-- SCHEDULE SECTIONS -->
                <div id="prmtv-schedule-container" class="space-y-8">
                    <!-- Populated by renderSchedule() -->
                </div>
            `;

            container.innerHTML = html;
            this.renderSchedule();
        },

        renderSchedule() {
            const container = document.getElementById('prmtv-schedule-container');
            if (!container) return;

            let sections = this.scheduleData || [];
            if (this.currentFilter !== 'All') {
                sections = sections.filter(s => s.category === this.currentFilter);
            }

            if (sections.length === 0) {
                container.innerHTML = `
                    <div class="py-12 text-center text-xs text-gray-400 bg-[#0f1726] rounded-2xl border border-gray-800">
                        No Paramount+ events found for this filter.
                    </div>
                `;
                return;
            }

            container.innerHTML = sections.map(sec => {
                const events = Array.isArray(sec.events) ? sec.events : [];
                if (events.length === 0) return '';

                const isLiveSection = String(sec.category).toLowerCase().includes('live');

                return `
                    <div class="space-y-3">
                        <div class="flex items-center justify-between border-b border-gray-800/80 pb-2">
                            <div class="flex items-center gap-2">
                                <span class="w-2 h-2 rounded-full ${isLiveSection ? 'bg-red-500 animate-ping' : 'bg-blue-500'}"></span>
                                <h3 class="text-base sm:text-lg font-black uppercase tracking-wider text-white">
                                    ${sec.category}
                                </h3>
                                <span class="text-[11px] text-gray-500 font-bold">(${events.length})</span>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            ${events.map(ev => {
                                const norm = this.normalizeEvent(ev, sec.category);
                                const isEvLive = norm.isLive;
                                const timeBadge = ev.live_badge_text || ev.liveBadgeText || ev.schedule_badge_text || ev.scheduleBadgeText || '';

                                return `
                                    <div onclick="openPlayerModal('${norm.id}')" class="card-hover bg-[#0f1726] border border-gray-800/90 rounded-2xl overflow-hidden cursor-pointer flex flex-col justify-between group shadow-xl">
                                        
                                        <!-- Card Thumbnail -->
                                        <div class="h-[145px] relative overflow-hidden bg-[#131b2c] border-b border-gray-800/80">
                                            <img src="${norm.poster}" class="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-all duration-300" alt="${norm.title}" loading="lazy">
                                            <div class="absolute inset-0 bg-gradient-to-t from-[#0f1726] via-transparent to-black/40"></div>
                                            
                                            <!-- Top Badges -->
                                            <div class="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10">
                                                ${isEvLive ? `
                                                    <span class="bg-red-600 text-white font-black text-[10px] px-2.5 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-red-600/30">
                                                        <span class="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                                                        LIVE
                                                    </span>
                                                ` : (timeBadge ? `
                                                    <span class="bg-black/80 backdrop-blur-md text-gray-200 border border-white/15 font-extrabold text-[10px] px-2.5 py-0.5 rounded-md tracking-wider">
                                                        ${timeBadge}
                                                    </span>
                                                ` : `<span></span>`)}
                                                
                                                <span class="bg-blue-600 text-white font-extrabold text-[9px] uppercase px-2 py-0.5 rounded-md shadow">
                                                    4 Servers
                                                </span>
                                            </div>
                                        </div>

                                        <!-- Card Title & Info -->
                                        <div class="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                                            <div>
                                                <span class="text-[10px] font-extrabold text-blue-400 uppercase tracking-wider block mb-1">
                                                    ${sec.category}
                                                </span>
                                                <h4 class="font-extrabold text-xs text-white uppercase tracking-wide line-clamp-2 leading-snug group-hover:text-blue-400 transition-colors">
                                                    ${norm.title}
                                                </h4>
                                            </div>

                                            <div class="pt-2 border-t border-gray-800/80 flex items-center justify-between text-[11px]">
                                                <span class="text-gray-400 font-bold text-[10px]">Paramount+</span>
                                                <span class="text-blue-400 font-bold flex items-center gap-1 text-[11px]">
                                                    <span>Watch</span>
                                                    <svg class="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                                </span>
                                            </div>
                                        </div>

                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }).join('');
        }
    };

    // Auto-init when script loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.AryanParamountAPI.init());
    } else {
        window.AryanParamountAPI.init();
    }
})();
