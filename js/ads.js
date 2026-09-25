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
 * - Shared links and match cards open directly to the match page with ZERO ads on load or navigation.
 * - When the user clicks the Player ("Click to Play Stream"), the Adsterra Smartlink is triggered ONCE.
 * - The overlay disappears and video playback starts seamlessly.
 * - Switching servers or navigating back does NOT re-trigger ads or trap the user.
 */

(function () {
    'use strict';

    const AryanAds = {
        // ==========================================
        // ⚙️ AD CONFIGURATION
        // ==========================================
        DIRECT_LINK: 'https://www.profitableratecpmnetwork.com/t8e8e5yh?key=6da983d7e115700ad4dc612c0e107ec8',
        
        // Cooldown between direct link triggers in milliseconds (60 seconds)
        cooldownMs: 60000,

        // Feature toggles
        enabled: true,
        enableDirectLinks: true,
        enablePlayerOverlay: true,

        // State tracking
        lastTriggerTime: 0,
        clickCount: 0,
        hasPlayedCurrentStream: false,

        /**
         * Initialize ad systems
         */
        init() {
            if (!this.enabled) return;
            console.log('[AryanAds] Adsterra monetization engine ready (Play-to-Redirect mode).');
        },

        /**
         * Trigger Direct Link Ad
         * Must be invoked synchronously inside a genuine user click handler
         * so modern browser popup blockers allow the new tab.
         * 
         * @param {string} source - Origin of the click ('player_play')
         * @param {boolean} force - If true, ignores the cooldown window
         * @returns {boolean} - True if ad opened, false otherwise
         */
        trigger(source = 'player_play', force = false) {
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
                    try { adWin.blur(); } catch (e) {}
                    try { window.focus(); } catch (e) {}
                    console.log(`[AryanAds] Adsterra Smartlink opened (${source}). Total clicks: ${this.clickCount}`);
                    return true;
                } else {
                    // Fallback for strict mobile popup blockers: programmatically dispatch anchor click
                    const a = document.createElement('a');
                    a.href = this.DIRECT_LINK;
                    a.target = '_blank';
                    a.rel = 'noopener noreferrer';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    return true;
                }
            } catch (err) {
                console.warn('[AryanAds] Direct link trigger exception:', err);
            }
            return false;
        },

        /**
         * Stream Player Click-to-Play Overlay
         * Places a sleek interactive overlay over the player container.
         * On first click: triggers the Smartlink ad in a new tab, removes the overlay,
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

            // If user already clicked to play this match stream, do not block them again
            if (this.hasPlayedCurrentStream) {
                return;
            }

            const overlay = document.createElement('div');
            overlay.id = 'aryan-ad-player-overlay';
            overlay.className = 'absolute inset-0 z-30 cursor-pointer flex items-center justify-center bg-black/45 hover:bg-black/30 backdrop-blur-[2px] transition-all select-none';
            overlay.innerHTML = `
                <div class="pointer-events-none px-6 py-3.5 rounded-2xl bg-black/85 backdrop-blur-md border border-green-500/50 text-white font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-3 shadow-2xl group transform hover:scale-105 transition-transform">
                    <span class="w-3.5 h-3.5 rounded-full bg-green-500 animate-ping"></span>
                    <svg class="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    <span>Click to Play Stream</span>
                </div>
            `;

            overlay.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                overlay.remove();
                this.hasPlayedCurrentStream = true;

                // Trigger direct link ad synchronously once on play
                this.trigger('player_play', true);

                // Unmute and play native video if HLS
                const videoEl = document.getElementById('global-video-element');
                if (videoEl) {
                    videoEl.muted = false;
                    videoEl.play().catch(() => {});
                }
            });

            container.appendChild(overlay);
        },

        /**
         * Reset play state when loading a new match fixture
         */
        resetStreamState() {
            this.hasPlayedCurrentStream = false;
        }
    };

    // Expose globally for access across UI components
    window.AryanAds = AryanAds;
    AryanAds.init();
})();
