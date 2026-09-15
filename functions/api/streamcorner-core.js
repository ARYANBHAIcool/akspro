/**
 * Cloudflare Pages Function: Dynamic Self-Healing StreamCorner Core Engine
 * Route: /api/streamcorner-core
 * 
 * Automatically probes https://streamcorner.foo/ for the latest bundle,
 * extracts the active crypto decryption routine, patches window.StreamCornerCore,
 * and caches it on the edge (refreshes on demand).
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

    // Serve from memory cache if fresh (within 2 hours) and refresh not forced
    if (!forceRefresh && memoryCache.code && (now - memoryCache.timestamp < 7200000)) {
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
        // 1. Fetch streamcorner.foo HTML
        const htmlRes = await fetch('https://streamcorner.foo/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });
        if (!htmlRes.ok) throw new Error('StreamCorner HTML fetch returned ' + htmlRes.status);
        const html = await htmlRes.text();

        const mainScriptMatch = html.match(/src=["'](\/assets\/[^"']+\.js)["']/i);
        if (!mainScriptMatch) throw new Error('Main script not found in HTML');
        const mainScriptUrl = 'https://streamcorner.foo' + mainScriptMatch[1];

        const mainRes = await fetch(mainScriptUrl);
        if (!mainRes.ok) throw new Error('Failed to fetch main script: ' + mainScriptUrl);
        const mainCode = await mainRes.text();

        const cryptoRegex = /export\s*\{\s*([a-zA-Z0-9_$]+)\s+as\s+j\s*,\s*([a-zA-Z0-9_$]+)\s+as\s+m\s*,\s*([a-zA-Z0-9_$]+)\s+as\s+q\s*,\s*([a-zA-Z0-9_$]+)\s+as\s+t\s*,\s*([a-zA-Z0-9_$]+)\s+as\s+x\s*\};?/;

        let coreCode = null;
        let m = mainCode.match(cryptoRegex);

        if (m) {
            coreCode = mainCode;
        } else {
            const manifestMatch = mainCode.match(/m\.f\s*=\s*\[([^\]]+)\]/);
            if (!manifestMatch) throw new Error('Vite manifest not found in main script');
            const assetFiles = JSON.parse('[' + manifestMatch[1] + ']');

            // Scan manifest asset files for crypto signature
            for (const file of assetFiles) {
                if (!file.endsWith('.js')) continue;
                const fileUrl = 'https://streamcorner.foo/' + (file.startsWith('/') ? file.slice(1) : file);
                try {
                    const res = await fetch(fileUrl);
                    if (!res.ok) continue;
                    const text = await res.text();
                    const match = text.match(cryptoRegex);
                    if (match) {
                        coreCode = text;
                        m = match;
                        break;
                    }
                } catch (e) {}
            }
        }

        if (!coreCode || !m) throw new Error('Could not locate crypto core in assets');

        const [fullExport, jName, mName, qName, tName, xName] = m;
        const patch = `window.StreamCornerCore = { j: ${jName}, m: ${mName}, q: ${qName}, t: ${tName}, x: ${xName} };`;
        const patchedCode = coreCode.replace(fullExport, patch);

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
