/**
 * AryanStreams Global - Self-Healing StreamCorner Core Engine (v10.9.13)
 * Runs official StreamCorner cryptographic token generation and stream decryption
 * safely inside a sandboxed Web Worker with execution context isolation.
 */
(function(window) {
    'use strict';

    if (window.StreamCornerCore && window.StreamCornerCore._isModern) {
        return;
    }

    const KNOWN_BLX_CHUNK = 'https://streamcorner.cloud/assets/BLxP5FsB.js';
    let workerInstance = null;
    let workerReadyPromise = null;
    let requestIdCounter = 0;
    const pendingRequests = new Map();

    function initWorker() {
        if (workerReadyPromise) return workerReadyPromise;

        workerReadyPromise = new Promise((resolve) => {
            try {
                const workerCode = `
                    // 1. Isolate location to streamcorner.cloud to pass anti-tamper domain checks
                    try {
                        const fakeLoc = {
                            hostname: "streamcorner.cloud",
                            origin: "https://streamcorner.cloud",
                            host: "streamcorner.cloud",
                            protocol: "https:",
                            pathname: "/",
                            href: "https://streamcorner.cloud/"
                        };
                        try { Object.defineProperty(self, "location", { value: fakeLoc, writable: true, configurable: true }); } catch(e) {}
                        try { Object.defineProperty(globalThis, "location", { value: fakeLoc, writable: true, configurable: true }); } catch(e) {}
                    } catch(e) {}

                    // 2. Dynamically import latest StreamCorner crypto bundle with mirror fallback
                    async function loadCryptoModule() {
                        try {
                            return await import("https://streamcorner.cloud/assets/BLxP5FsB.js");
                        } catch(e1) {
                            return await import("https://streamcorner.st/assets/BLxP5FsB.js");
                        }
                    }

                    loadCryptoModule()
                        .then(mod => {
                            self.onmessage = async (e) => {
                                const { requestId, url, providerId, providerName } = e.data;
                                try {
                                    const data = await mod.j(url, providerId, providerName);
                                    self.postMessage({ requestId, success: true, data });
                                } catch (err) {
                                    self.postMessage({ requestId, success: false, error: err.message, stack: err.stack });
                                }
                            };
                            self.postMessage({ ready: true });
                        })
                        .catch(err => {
                            self.postMessage({ ready: false, error: err.message });
                        });
                `;

                const blob = new Blob([workerCode], { type: 'application/javascript' });
                workerInstance = new Worker(URL.createObjectURL(blob), { type: 'module' });

                workerInstance.onmessage = (e) => {
                    const msg = e.data;
                    if (msg.ready !== undefined) {
                        if (msg.ready) {
                            console.log('StreamCornerCore Worker initialized and ready!');
                            resolve(true);
                        } else {
                            console.warn('StreamCornerCore Worker failed to load module:', msg.error);
                            resolve(false);
                        }
                        return;
                    }

                    const pending = pendingRequests.get(msg.requestId);
                    if (pending) {
                        pendingRequests.delete(msg.requestId);
                        if (msg.success) {
                            pending.resolve(msg.data);
                        } else {
                            pending.reject(new Error(msg.error || 'StreamCorner request failed'));
                        }
                    }
                };

                workerInstance.onerror = (e) => {
                    console.error('StreamCornerCore Worker runtime error:', e);
                    resolve(false);
                };

                // Fallback timeout if worker takes too long
                setTimeout(() => resolve(false), 5000);

            } catch (err) {
                console.error('Failed to instantiate StreamCorner Worker:', err);
                resolve(false);
            }
        });

        return workerReadyPromise;
    }

    async function dispatchStreamCornerRequest(url, endpoint, title) {
        let pType = (typeof endpoint === 'string' && endpoint.length > 0 && !endpoint.startsWith('http')) 
            ? endpoint 
            : '';
        if (!pType) {
            try {
                const parsed = new URL(url, 'https://data.minjikim444.workers.dev');
                pType = parsed.searchParams.get('p') || 'alpha';
            } catch(e) {
                pType = 'alpha';
            }
        }

        const isReady = await initWorker();
        if (!isReady || !workerInstance) {
            throw new Error('StreamCornerCore Worker unavailable');
        }

        const requestId = ++requestIdCounter;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                pendingRequests.delete(requestId);
                reject(new Error('StreamCorner fetch timeout'));
            }, 8000);

            pendingRequests.set(requestId, {
                resolve: (data) => {
                    clearTimeout(timer);
                    resolve(data);
                },
                reject: (err) => {
                    clearTimeout(timer);
                    reject(err);
                }
            });

            workerInstance.postMessage({
                requestId: requestId,
                url: url,
                providerId: pType,
                providerName: title || pType.toUpperCase()
            });
        });
    }

    const capturedW = [];
    capturedW[6] = dispatchStreamCornerRequest;
    capturedW[7] = function(url) {
        return dispatchStreamCornerRequest(url, 'admin_message', 'Admin');
    };

    window.StreamCornerCore = {
        _isModern: true,
        w: capturedW,
        t: dispatchStreamCornerRequest,
        j: dispatchStreamCornerRequest,
        m: function(url) {
            return dispatchStreamCornerRequest(url, 'admin_message', 'Admin');
        },
        fetch: dispatchStreamCornerRequest
    };

    // Pre-initialize worker in background
    if (typeof window !== 'undefined' && typeof window.Worker !== 'undefined') {
        setTimeout(initWorker, 100);
    }

})(typeof window !== 'undefined' ? window : globalThis);
