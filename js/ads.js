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

        // Feature toggles - ALL DISABLED per user request for pure speed and clean performance
        enabled: false,
        enableDirectLinks: false,
        enablePlayerOverlay: false,

        // State tracking
        lastTriggerTime: 0,
        clickCount: 0,
        hasPlayedCurrentStream: false,

        /**
         * Initialize ad systems (Disabled)
         */
        init() {
            console.log('[AryanAds] Ads disabled. Pure high-speed mode active.');
        },

        /**
         * Trigger Direct Link Ad (Disabled)
         */
        trigger(source = 'player_play', force = false) {
            return false;
        },

        /**
         * Stream Player Click-to-Play Overlay (Disabled)
         */
        attachPlayerOverlay(containerId = 'watch-player-container') {
            return;
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
