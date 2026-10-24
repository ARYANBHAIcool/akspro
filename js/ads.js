/**
 * AryanStreams Global - Advanced Monetization & Ad Experience Engine
 * Path: js/ads.js
 * 
 * Monetization Flow:
 * - Direct Match Links & Match Cards open directly with ZERO ads on load or navigation.
 * - When the user clicks the Player ("Click to Play Stream"), the Smartlink is opened once in a new tab.
 * - The overlay disappears and video playback starts seamlessly.
 * - Switching servers or navigating back does NOT re-trigger ads or trap the user.
 * - ZERO popunders, ZERO full-window click traps, ZERO DOM blocking.
 */

(function () {
    'use strict';

    // Global protection against third-party ad script MutationObserver "parameter 1 is not of type Node" exceptions
    if (typeof window !== 'undefined' && typeof window.MutationObserver !== 'undefined' && window.MutationObserver.prototype && window.MutationObserver.prototype.observe) {
        const _origObserve = window.MutationObserver.prototype.observe;
        window.MutationObserver.prototype.observe = function (target, options) {
            if (!target || !(target instanceof Node)) {
                return;
            }
            return _origObserve.call(this, target, options);
        };
    }

    // Global protection against Bitmovin and third-party player NotFoundError on removeChild
    if (typeof window !== 'undefined' && typeof Node !== 'undefined' && Node.prototype) {
        const _origRemoveChild = Node.prototype.removeChild;
        Node.prototype.removeChild = function (child) {
            if (!child) return child;
            if (child.parentNode !== this) {
                return child;
            }
            try {
                return _origRemoveChild.call(this, child);
            } catch (e) {
                return child;
            }
        };

        const _origInsertBefore = Node.prototype.insertBefore;
        Node.prototype.insertBefore = function (newNode, refNode) {
            if (!newNode) return newNode;
            try {
                return _origInsertBefore.call(this, newNode, refNode);
            } catch (e) {
                return newNode;
            }
        };
    }

    const AryanAds = {
        // ==========================================
        // ⚙️ AD CONFIGURATION
        // ==========================================
        DIRECT_LINK: 'https://budgetezy.org/4/6da983d7e115700ad4dc612c0e107ec8',
        
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
            console.log('[AryanAds] Monetization engine ready (Clean Smartlink mode).');
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
                // Open direct link in a new tab smoothly without freezing browser thread
                const adWin = window.open(this.DIRECT_LINK, '_blank', 'noopener,noreferrer');
                if (adWin) {
                    console.log(`[AryanAds] Smartlink opened (${source}). Total clicks: ${this.clickCount}`);
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

                // Trigger direct link ad cleanly once on genuine click
                this.trigger('player_play', true);

                // Unmute and play native video if HLS
                const videoEl = document.getElementById('global-video-element');
                if (videoEl) {
                    videoEl.muted = false;
                    videoEl.play().catch(() => {});
                }
            });

            if (container && container.appendChild) {
                container.appendChild(overlay);
            }
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
