/**
 * Cloudflare Pages Function: /api/stream
 * Edge Proxy for Sports Live Streams with Dual-Referer Bypass & Ad Removal
 */

export async function onRequest(context) {
    const url = new URL(context.request.url);
    const token = (url.searchParams.get('token') || url.searchParams.get('id') || '').trim();
    const rawUrl = url.searchParams.get('src') || url.searchParams.get('url');

    if (rawUrl && /^https?:\/\//i.test(rawUrl)) {
        return Response.redirect(rawUrl, 302);
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

    // 1. Direct upstream WebSocket (no proxy needed - browsers connect directly without CORS)
    // html = html.replace('wss://l1.strims24.st/ws', '/api/ws');

    // 2. Fix relative script paths
    html = html.replace('src="/lib/tk.js"', 'src="https://iplayer24.me/lib/tk.js"');

    // 3. Strip intrusive ads/popups/runtime
    html = html.replace(/<script[^>]*>(?:(?!<script)[\s\S])*?runtime\.js[\s\S]*?<\/script>/gi, '');
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
