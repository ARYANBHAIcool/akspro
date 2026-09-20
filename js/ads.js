/**
 * AryanStreams Global - Advanced Monetization & Ad Experience Engine
 * Path: js/ads.js
 * 
 * Integrated Networks:
 * 1. Adcash Pop-Under (Zone ID: 12179858)
 * 2. BuzzOnClick Direct Link (ID: 12179846)
 * 
 * Monetization Flow:
 * - User clicks a match card, server button, channel card, or player -> triggers direct ad in background tab
 * - User closes ad tab -> original site is already playing the match
 * - Back-button navigation trigger: smoothly returns to match list while monetizing exit/return
 * - Built-in cooldown prevents tab spamming and protects user engagement
 */

(function () {
    'use strict';

    const AryanAds = {
        // ==========================================
        // ⚙️ EASY-TO-MANAGE AD CONFIGURATION
        // ==========================================
        DIRECT_LINK: 'https://buzzonclick.com/jump/next.php?r=12179846',
        POPUNDER_ZONE_ID: '12179858',
        
        // Cooldown between direct link triggers in milliseconds (e.g. 45 seconds)
        // Protects against multi-popup browser lockups and prevents mobile UI lag
        cooldownMs: 45000,

        // Feature toggles
        enabled: true,
        enablePopUnder: true,
        enableDirectLinks: true,
        enablePlayerOverlay: true,
        enableBackAd: true,

        // Runtime state tracking
        lastTriggerTime: 0,
        clickCount: 0,
        hasTriggeredOnFirstVisit: false,

        /**
         * Initialize all ad systems
         */
        init() {
            if (!this.enabled) return;

            // 1. Initialize Adcash Pop-under
            if (this.enablePopUnder) {
                this.initPopUnder();
            }

            // 2. Setup Back-button / Popstate handler ("work on back types")
            if (this.enableBackAd) {
                this.setupBackHandler();
            }

            console.log('[AryanAds] Ad monetization engine ready.');
        },

        /**
         * Initialize Adcash Pop-under via aclib
         */
        initPopUnder() {
            let attempts = 0;
            const maxAttempts = 10;

            const checkAndRun = () => {
                attempts++;
                if (typeof window.aclib !== 'undefined' && typeof window.aclib.runPop === 'function') {
                    try {
                        window.aclib.runPop({
                            zoneId: this.POPUNDER_ZONE_ID
                        });
                        console.log('[AryanAds] Adcash Pop-under initialized for zone:', this.POPUNDER_ZONE_ID);
                        return;
                    } catch (e) {
                        console.warn('[AryanAds] Adcash runPop error:', e);
                    }
                }
                if (attempts < maxAttempts) {
                    setTimeout(checkAndRun, 500);
                }
            };

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', checkAndRun);
            } else {
                checkAndRun();
            }
        },

        /**
         * Trigger Direct Link Ad
         * Must be invoked inside a genuine user click handler.
         * 
         * @param {string} source - Origin of the click
         * @param {boolean} force - If true, ignores cooldown
         * @returns {boolean}
         */
        trigger(source = 'button', force = false) {
            if (!this.enabled || !this.enableDirectLinks) return false;

            const now = Date.now();
            if (!force && (now - this.lastTriggerTime < this.cooldownMs)) {
                return false;
            }

            this.lastTriggerTime = now;
            this.clickCount++;

            try {
                // Open direct link in a new tab smoothly without window blur/focus locks
                const adWin = window.open(this.DIRECT_LINK, '_blank');
                if (adWin) {
                    console.log(`[AryanAds] Direct link triggered (${source}). Total clicks: ${this.clickCount}`);
                    return true;
                }
            } catch (err) {
                console.warn('[AryanAds] Direct link trigger exception:', err);
            }
            return false;
        },

        /**
         * Setup browser back-button & popstate interception ("work on back types")
         * When user hits back button while on the watch page or leaves,
         * triggers the ad in a new tab while allowing the current page to navigate smoothly.
         */
        setupBackHandler() {
            window.addEventListener('popstate', () => {
                // When navigating back from watch view
                if (typeof window.currentView !== 'undefined' && window.currentView === 'watch') {
                    this.trigger('browser_back');
                }
            });
        },

        /**
         * StreamCorner-style Player Click-to-Play Overlay
         * Places a sleek interactive overlay over the player container.
         * On first click: opens the direct link ad in a new tab, removes the overlay,
         * and unmutes/plays the video.
         * 
         * @param {string} containerId - DOM ID of player container ('watch-player-container')
         */
        attachPlayerOverlay(containerId = 'watch-player-container') {
            if (!this.enabled || !this.enablePlayerOverlay) return;

            const container = document.getElementById(containerId);
            if (!container) return;

            // Remove existing overlay if any
            const existing = container.querySelector('#aryan-ad-player-overlay');
            if (existing) existing.remove();

            // Check if cooldown is currently active and user has already clicked once
            const now = Date.now();
            if (now - this.lastTriggerTime < this.cooldownMs && this.clickCount > 0) {
                return;
            }

            const overlay = document.createElement('div');
            overlay.id = 'aryan-ad-player-overlay';
            overlay.className = 'absolute inset-0 z-30 cursor-pointer flex items-center justify-center bg-black/20 hover:bg-black/10 transition-all select-none';
            overlay.innerHTML = `
                <div class="pointer-events-none px-4 py-2.5 rounded-2xl bg-black/80 backdrop-blur-md border border-white/20 text-white font-extrabold text-xs uppercase tracking-wider flex items-center gap-2.5 shadow-2xl group transform hover:scale-105 transition-transform">
                    <span class="w-3 h-3 rounded-full bg-green-500 animate-ping"></span>
                    <span>Click to Play / Unmute Stream</span>
                    <svg class="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </div>
            `;

            overlay.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                overlay.remove();

                // Trigger direct link ad synchronously
                this.trigger('player_overlay', true);

                // Unmute and play native video if HLS
                const videoEl = document.getElementById('global-video-element');
                if (videoEl) {
                    videoEl.muted = false;
                    videoEl.play().catch(() => {});
                }
            });

            container.appendChild(overlay);
        }
    };

    // Expose globally for access across UI components
    window.AryanAds = AryanAds;
    AryanAds.init();
})();
