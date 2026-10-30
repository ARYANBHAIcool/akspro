/**
 * Cloudflare Pages Function: 24/7 TV Channels API
 * Returns active 24/7 Sports TV channels with stream URLs
 */

export async function onRequest(context) {
    try {
        // Try live upstream first with short timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        try {
            const res = await fetch('https://bintvjson.lovable.app/api/public/bintvjson', {
                headers: { 'Accept': 'application/json' },
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (res.ok) {
                const json = await res.json();
                const channels = json['24/7 Channels'] || [];
                const live = json['Live Events'] || [];
                return new Response(JSON.stringify({ items: channels, live: live, counts: json.counts }), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': 'public, max-age=120, stale-while-revalidate=300'
                    }
                });
            }
        } catch (fetchErr) {
            clearTimeout(timeoutId);
        }

        // Fallback: fetch local static /assets/channels.json
        const origin = new URL(context.request.url).origin;
        const localRes = await fetch(`${origin}/assets/channels.json`);
        if (localRes.ok) {
            const localJson = await localRes.json();
            return new Response(JSON.stringify({ items: localJson['24/7 Channels'] || [], live: localJson['Live Events'] || [] }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'public, max-age=300'
                }
            });
        }

        return new Response(JSON.stringify({ items: [] }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (e) {
        return new Response(JSON.stringify({ items: [], error: e.message }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}
