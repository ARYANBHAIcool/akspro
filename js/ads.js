/**
 * AryanStreams Global - Advanced Monetization & Ad Experience Engine
 * Path: js/ads.js
 * 
 * Integrated Adsterra Units:
 * 1. Adsterra Popunder (pl31503790)
 * 2. Adsterra Social Bar (pl31503799)
 * 3. Adsterra Smartlink (https://www.profitableratecpmnetwork.com/t8e8e5yh?key=6da983d7e115700ad4dc612c0e107ec8)
 * 
 * Monetization Flow:
 * - User clicks a match card, server button, channel card, or player -> triggers Adsterra Smartlink in background tab
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
        DIRECT_LINK: 'https://www.profitableratecpmnetwork.com/t8e8e5yh?key=6da983d7e115700ad4dc612c0e107ec8',
        
        // Cooldown between direct link triggers in milliseconds (e.g. 20 seconds)
        // Set to 0 to trigger on every qualified button click
        cooldownMs: 20000,

        // Feature toggles
        enabled: true,
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

            // Setup Back-button / Popstate handler ("work on back types")
            if (this.enableBackAd) {
                this.setupBackHandler();
            }

            console.log('[AryanAds] Adsterra monetization engine ready.');
        },

        /**
         * Trigger Direct Link Ad
         * Must be invoked synchronously inside a genuine user click handler
         * so modern browser popup blockers allow the new tab.
         * 
         * @param {string} source - Origin of the click (e.g., 'match_card', 'server_button', 'back_button', 'player_overlay')
         * @param {boolean} force - If true, ignores the cooldown window
         * @returns {boolean} - True if ad opened, false otherwise
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
                // Open direct link in a new tab
                const adWin = window.open(this.DIRECT_LINK, '_blank');
                if (adWin) {
                    // Retain main tab focus so stream or page action continues smoothly
                    try { adWin.blur(); } catch (e) {}
                    try { window.focus(); } catch (e) {}
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
