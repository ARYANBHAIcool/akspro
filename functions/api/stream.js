/**
 * Cloudflare Pages Function: /api/stream
 * Edge Proxy for Sports Live Streams with Dual-Referer Bypass & Ad Removal
 */

export async function onRequest(context) {
    const url = new URL(context.request.url);
    const token = (url.searchParams.get('token') || url.searchParams.get('id') || '').trim();
    const rawUrl = url.searchParams.get('src') || url.searchParams.get('url');

    // Handle ehgembxe / Tim-Streams / BinTV embeds (strip anti-sandbox & ads, spoof Referer)
    if (rawUrl && (/^https?:\/\/ehgembxe\.cfd\//i.test(rawUrl) || /^https?:\/\/bintv-sources\.pages\.dev\//i.test(rawUrl))) {
        let targetUrl = rawUrl;
        let referer = 'https://tim-streams.com/';
        if (/bintv/i.test(rawUrl)) {
            referer = 'https://bintv-sources.pages.dev/';
        }
        if (/bintv-sources\.pages\.dev/i.test(rawUrl)) {
            try {
                const u = new URL(rawUrl);
                const idParam = u.searchParams.get('id');
                if (idParam) {
                    const decoded = atob(idParam.replace(/-/g, '+').replace(/_/g, '/'));
                    if (/^https?:\/\//i.test(decoded)) targetUrl = decoded;
                }
            } catch (e) {}
        }
        if (targetUrl.includes('/bintv/')) {
            referer = 'https://bintv-sources.pages.dev/';
        }
        try {
            const resp = await fetch(targetUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                    'Referer': referer
                }
            });
            if (resp.ok) {
                let html = await resp.text();
                // Strip the anti-sandbox probe script cleanly!
                html = html.replace(/<script[^>]*>(?:(?!<\/script>)[\s\S])*?Remove sandbox attributes[\s\S]*?<\/script>/gi, '');
                html = html.replace(/<script[^>]*>(?:(?!<\/script>)[\s\S])*?__sb_probe[\s\S]*?<\/script>/gi, '');
                html = html.replace(/<script[^>]*disable-devtool[^>]*>[\s\S]*?<\/script>/gi, '');
                html = html.replace(/<script[^>]*aclib\.runPop[\s\S]*?<\/script>/gi, '');
                html = html.replace('<head>', '<head><base href="https://ehgembxe.cfd/">');
                const darkCss = `<style>
html, body { width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; background: #000 !important; overflow: hidden !important; }
#player, .jwplayer { width: 100% !important; height: 100% !important; }
video { width: 100% !important; height: 100% !important; object-fit: contain !important; }
</style>`;
                html = html.replace('</head>', darkCss + '</head>');
                return new Response(html, {
                    status: 200,
                    headers: {
                        'Content-Type': 'text/html; charset=utf-8',
                        'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
                        'Access-Control-Allow-Origin': '*'
                    }
                });
            }
        } catch (e) {}
        return Response.redirect(targetUrl, 302);
    }

    // TopStreamer proxy: strip X-Frame-Options and CSP frame-ancestors
    if (rawUrl && /^https?:\/\/(?:www\.)?topstreamer\.site\//i.test(rawUrl)) {
        try {
            const topResp = await fetch(rawUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                    'Referer': 'https://topstreamer.site/'
                }
            });
            if (topResp.ok) {
                let topHtml = await topResp.text();
                topHtml = topHtml.replace('<head>', '<head><base href="https://topstreamer.site/">');
                topHtml = topHtml.replace(/<script[^>]*popunder[^>]*>[\s\S]*?<\/script>/gi, '');
                topHtml = topHtml.replace(/<script[^>]*aclib\.runPop[^>]*>[\s\S]*?<\/script>/gi, '');
                const customCss = `<style>
html, body { width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; background: #000 !important; overflow: hidden !important; }
#container, .container { display: none !important; }
#main-video, #playerContainer, .playerContainer { position: fixed !important; inset: 0 !important; width: 100% !important; height: 100% !important; max-width: 100% !important; border-radius: 0 !important; background: #000 !important; z-index: 10 !important; }
video { width: 100% !important; height: 100% !important; object-fit: contain !important; }
#dialog, .ui-dialog, .ui-widget-overlay, .banner, [class*="ad-"] { display: none !important; }
.stream-picker { position: fixed !important; bottom: 12px !important; left: 50% !important; transform: translateX(-50%) !important; z-index: 99 !important; background: rgba(0,0,0,0.7) !important; padding: 6px 12px !important; border-radius: 20px !important; display: flex !important; gap: 8px !important; }
.stream-btn { font-size: 11px !important; height: 26px !important; line-height: 26px !important; padding: 0 10px !important; border-radius: 13px !important; }
</style>`;
                topHtml = topHtml.replace('</head>', customCss + '</head>');
                return new Response(topHtml, {
                    status: 200,
                    headers: {
                        'Content-Type': 'text/html; charset=utf-8',
                        'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
                        'Access-Control-Allow-Origin': '*'
                    }
                });
            }
        } catch (e) {}
        return Response.redirect(rawUrl, 302);
    }

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

    // 1. Edge WebSocket proxy (forwards with Origin: https://iplayer24.me to bypass 403)
    html = html.replace('wss://l1.strims24.st/ws', '/api/ws');

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
