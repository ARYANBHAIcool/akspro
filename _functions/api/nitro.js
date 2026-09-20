/**
 * Cloudflare Pages Function: High-Performance Stream & Manifest Proxy
 * Route: /api/nitro
 * 
 * Solves the Amazon CloudFront / Nitro CDN "Manifest load error" (HTTP 400 Bad Request)
 * by forwarding requests with the whitelisted 'https://streamcorner.foo' origin and 
 * returning proper CORS headers (Access-Control-Allow-Origin: *).
 */

export async function onRequest(context) {
    const url = new URL(context.request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
        return new Response('Missing url parameter', {
            status: 400,
            headers: {
                'Content-Type': 'text/plain',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }

    if (context.request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                'Access-Control-Allow-Headers': '*',
                'Access-Control-Max-Age': '86400'
            }
        });
    }

    try {
        const parsedTarget = new URL(targetUrl);

        // Fetch from upstream CDN with whitelisted streamcorner origin
        const reqHeaders = {
            'Origin': 'https://streamcorner.fun',
            'Referer': 'https://streamcorner.fun/',
            'User-Agent': context.request.headers.get('User-Agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            'Accept': context.request.headers.get('Accept') || '*/*'
        };

        const range = context.request.headers.get('Range');
        if (range) {
            reqHeaders['Range'] = range;
        }

        const upstreamResponse = await fetch(parsedTarget.toString(), {
            method: context.request.method,
            headers: reqHeaders,
            redirect: 'follow'
        });

        const contentType = upstreamResponse.headers.get('content-type') || '';
        const isMpd = targetUrl.includes('.mpd') || contentType.includes('dash+xml') || contentType.includes('xml');

        const newHeaders = new Headers(upstreamResponse.headers);
        newHeaders.set('Access-Control-Allow-Origin', '*');
        newHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        newHeaders.set('Access-Control-Allow-Headers', '*');
        newHeaders.set('Access-Control-Expose-Headers', '*');
        newHeaders.delete('Content-Security-Policy');
        newHeaders.delete('X-Frame-Options');

        if (isMpd) {
            let mpdText = await upstreamResponse.text();
            // Ensure relative media segment URLs resolve against the upstream CDN base path
            const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
            if (!mpdText.includes('<BaseURL>') && baseUrl) {
                mpdText = mpdText.replace(/<MPD([^>]*)>/i, `<MPD$1>\n  <BaseURL>${baseUrl}</BaseURL>`);
            }

            newHeaders.set('Content-Type', 'application/dash+xml; charset=utf-8');
            newHeaders.set('Cache-Control', 'public, max-age=5');

            return new Response(mpdText, {
                status: upstreamResponse.status,
                headers: newHeaders
            });
        }

        // For video segments (.m4s, .mp4, .ts, etc.) stream directly
        newHeaders.set('Cache-Control', 'public, max-age=300');
        return new Response(upstreamResponse.body, {
            status: upstreamResponse.status,
            statusText: upstreamResponse.statusText,
            headers: newHeaders
        });

    } catch (err) {
        return new Response('Nitro proxy error: ' + err.message, {
            status: 502,
            headers: {
                'Content-Type': 'text/plain',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}
