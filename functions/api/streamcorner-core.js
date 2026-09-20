/**
 * Cloudflare Pages Function: Dynamic Self-Healing StreamCorner Core Engine
 * Route: /api/streamcorner-core
 * 
 * Automatically probes https://streamcorner.foo/ for the latest bundle,
 * extracts the active crypto decryption routine, patches window.StreamCornerCore,
 * and caches it on the edge.
 */

let memoryCache = {
    code: null,
    timestamp: 0
};

export async function onRequest(context) {
    if (context.request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': '*'
            }
        });
    }

    const url = new URL(context.request.url);
    const forceRefresh = url.searchParams.has('refresh') || url.searchParams.has('bust');
    const now = Date.now();

    // Serve from memory cache if fresh (within 3 hours) and refresh not forced
    if (!forceRefresh && memoryCache.code && (now - memoryCache.timestamp < 10800000)) {
        return new Response(memoryCache.code, {
            status: 200,
            headers: {
                'Content-Type': 'application/javascript; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=3600'
            }
        });
    }

    try {
        const htmlRes = await fetch('https://streamcorner.fun/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });
        if (!htmlRes.ok) throw new Error('StreamCorner HTML fetch failed: ' + htmlRes.status);
        const html = await htmlRes.text();

        const mainScriptMatch = html.match(/src=["'](\/assets\/[^"']+\.js)["']/i);
        if (!mainScriptMatch) throw new Error('Main script not found in HTML');
        const mainScriptUrl = 'https://streamcorner.fun' + mainScriptMatch[1];

        const mainRes = await fetch(mainScriptUrl);
        if (!mainRes.ok) throw new Error('Failed to fetch main script: ' + mainScriptUrl);
        const mainCode = await mainRes.text();

        const candidateUrls = [];
        const manifestMatch = mainCode.match(/m\.f\s*=\s*\[([^\]]+)\]/);

        if (manifestMatch) {
            const assetFiles = JSON.parse('[' + manifestMatch[1] + ']');
            for (const file of assetFiles) {
                if (file.endsWith('.js')) {
                    candidateUrls.push('https://streamcorner.fun/' + (file.startsWith('/') ? file.slice(1) : file));
                }
            }
        } else {
            candidateUrls.push(mainScriptUrl);
        }

        const cryptoRegex = /export\s*\{([^}]*?\b([a-zA-Z0-9_$]+)\s+as\s+j\b[^}]*)\};?/;
        let found = null;

        // Scan candidate chunks in parallel batches of 6
        for (let i = 0; i < candidateUrls.length; i += 6) {
            const batch = candidateUrls.slice(i, i + 6);
            const results = await Promise.all(batch.map(async chunkUrl => {
                try {
                    const res = await fetch(chunkUrl);
                    if (!res.ok) return null;
                    const text = await res.text();
                    // Self-contained core is > 100KB and does NOT start with import statements
                    if (text.length < 100000) return null;
                    if (text.startsWith('import') || text.slice(0, 100).includes('import')) return null;
                    const m = text.match(cryptoRegex);
                    if (m) {
                        const jVar = m[2];
                        const tMatch = m[1].match(/\b([a-zA-Z0-9_$]+)\s+as\s+t\b/);
                        const tVar = tMatch ? tMatch[1] : jVar;
                        const mMatch = m[1].match(/\b([a-zA-Z0-9_$]+)\s+as\s+m\b/);
                        const mVar = mMatch ? mMatch[1] : jVar;
                        return { url: chunkUrl, code: text, fullExport: m[0], jVar, tVar, mVar };
                    }
                } catch (e) {}
                return null;
            }));

            found = results.find(Boolean);
            if (found) break;
        }

        if (!found) throw new Error('Could not locate crypto core chunk in assets');

        const replacement = `window.StreamCornerCore = { j: ${found.jVar}, t: ${found.tVar}, m: ${found.mVar} };`;
        const patchedCode = found.code.replace(found.fullExport, replacement);

        memoryCache = {
            code: patchedCode,
            timestamp: now
        };

        return new Response(patchedCode, {
            status: 200,
            headers: {
                'Content-Type': 'application/javascript; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=3600'
            }
        });
    } catch (err) {
        if (memoryCache.code) {
            return new Response(memoryCache.code, {
                status: 200,
                headers: {
                    'Content-Type': 'application/javascript; charset=utf-8',
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'no-cache'
                }
            });
        }
        return new Response('console.error("StreamCorner core auto-discovery failed: ' + err.message + '");', {
            status: 500,
            headers: {
                'Content-Type': 'application/javascript',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}
