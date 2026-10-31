/**
 * Cloudflare Pages Function: /api/stream
 * Edge Proxy for Sports Live Streams with Dual-Referer Bypass & Ad Removal
 */

export async function onRequest(context) {
    const url = new URL(context.request.url);
    const token = (url.searchParams.get('token') || url.searchParams.get('id') || '').trim();
    const rawUrl = url.searchParams.get('src') || url.searchParams.get('url');

    if (rawUrl && /^https?:\/\//i.test(rawUrl)) {
        try {
            const parsed = new URL(rawUrl);
            const origin = parsed.origin;
            const resp = await fetch(rawUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                    'Referer': 'https://dzeko11.pk/',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
            });
            if (resp.ok) {
                let html = await resp.text();
                // Insert base tag for relative assets
                html = html.replace('<head>', `<head><base href="${origin}/">`);
                // Strip anti-sandbox script completely
                html = html.replace(/<script[^>]*>(?:(?!<script)[\s\S])*?Remove sandbox attributes[\s\S]*?<\/script>/gi, '');
                html = html.replace(/<script[^>]*disable-devtool[^>]*>[\s\S]*?<\/script>/gi, '');
                // Strip intrusive popunders/ads
                html = html.replace(/<script[^>]*runtime\.js[^>]*>[\s\S]*?<\/script>/gi, '');
                html = html.replace(/<script[^>]*isim\.is[^>]*>[\s\S]*?<\/script>/gi, '');
                html = html.replace(/<script[^>]*aclib\.runPop[\s\S]*?<\/script>/gi, '');
                html = html.replace(/<script[^>]*popunder[\s\S]*?<\/script>/gi, '');

                return new Response(html, {
                    status: 200,
                    headers: {
                        'Content-Type': 'text/html; charset=utf-8',
                        'Cache-Control': 'no-store, no-cache, must-revalidate'
                    }
                });
            }
        } catch (e) {}

        return new Response(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{width:100%;height:100%;margin:0;padding:0;background:#000;overflow:hidden;}iframe{width:100%;height:100%;border:0;display:block;}</style></head><body><iframe src="${rawUrl}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe></body></html>`, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store, no-cache' }
        });
    }

    if (!token || !/^[a-f0-9]{32}$/i.test(token)) {
        return new Response('Invalid or missing stream token.', { status: 400 });
    }

    const upstreamUrl = `https://iplayer24.me/beta/${token}`;

    let html = '';
    for (const ref of ['https://dzeko11.pk/', 'https://strumyk.pk/']) {
        try {
            const resp = await fetch(upstreamUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Referer': ref,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
            });
            if (resp.ok) {
                const text = await resp.text();
                if (text.includes('jwplayer') || !text.includes('google.com')) {
                    html = text;
                    break;
                }
            }
        } catch (fetchErr) {}
    }

    if (!html || (html.includes('google.com') && !html.includes('jwplayer'))) {
        return new Response('Stream token expired or unavailable.', { status: 502 });
    }

    // 1. Rewrite WebSocket endpoint to our edge proxy
    html = html.replace('wss://l1.strims24.st/ws', '/api/ws');

    // 2. Fix relative script paths
    html = html.replace('src="/lib/tk.js"', 'src="https://iplayer24.me/lib/tk.js"');

    // 3. Strip intrusive ads/popups
    html = html.replace(/<script[^>]*runtime\.js[^>]*>[\s\S]*?<\/script>/gi, '');
    html = html.replace(/<script[^>]*isim\.is[^>]*>[\s\S]*?<\/script>/gi, '');
    html = html.replace(/<script[^>]*aclib\.runPop[\s\S]*?<\/script>/gi, '');

    // 4. Clean dark styling
    const customCss = `<style>
html, body { width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; background: #000 !important; overflow: hidden !important; }
body.beta { background: #000 !important; padding: 0 !important; }
body.beta .stage { width: 100% !important; height: 100% !important; max-width: 100% !important; border-radius: 0 !important; aspect-ratio: unset !important; }
body.beta .ad, body.beta .vpn-notice, body.beta footer, body.beta header, body.beta h1, body.beta p, .video-unmute { display: none !important; }
#player { width: 100% !important; height: 100% !important; }
#player video { width: 100% !important; height: 100% !important; object-fit: contain !important; }
</style>`;
    html = html.replace('</head>', customCss + '</head>');

    return new Response(html, {
        status: 200,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate'
        }
    });
}
