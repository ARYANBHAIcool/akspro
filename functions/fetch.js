/**
 * Cloudflare Pages Function: Universal /fetch Proxy
 * Route: /fetch
 * 
 * Solves the HTTP 405 error when stream players (embed.st, embedindia.st, streamed.pk)
 * send their stream initialization requests via POST /fetch.
 * Seamlessly forwards the payload to the upstream streaming gateway and returns
 * full CORS and decryption headers (e.g. 'goat').
 */

export async function onRequest(context) {
    if (context.request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': '*',
                'Access-Control-Expose-Headers': '*',
                'Access-Control-Max-Age': '86400'
            }
        });
    }

    try {
        const body = await context.request.arrayBuffer();
        const clientHeaders = context.request.headers;

        const forwardHeaders = {
            'User-Agent': clientHeaders.get('User-Agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            'Referer': 'https://embed.st/',
            'Origin': 'https://embed.st',
            'Content-Type': clientHeaders.get('Content-Type') || 'application/octet-stream',
            'Accept': '*/*'
        };

        let upstream = await fetch('https://embed.st/fetch', {
            method: 'POST',
            headers: forwardHeaders,
            body: body
        });

        if (!upstream.ok) {
            forwardHeaders['Referer'] = 'https://embedindia.st/';
            forwardHeaders['Origin'] = 'https://embedindia.st';
            upstream = await fetch('https://embedindia.st/fetch', {
                method: 'POST',
                headers: forwardHeaders,
                body: body
            });
        }

        const resHeaders = new Headers(upstream.headers);
        resHeaders.set('Access-Control-Allow-Origin', '*');
        resHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        resHeaders.set('Access-Control-Allow-Headers', '*');
        resHeaders.set('Access-Control-Expose-Headers', '*');
        resHeaders.delete('Content-Security-Policy');
        resHeaders.delete('X-Frame-Options');

        return new Response(upstream.body, {
            status: upstream.status,
            statusText: upstream.statusText,
            headers: resHeaders
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
            status: 502,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}
