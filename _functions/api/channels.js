/**
 * Cloudflare Pages Function: 24/7 Channels Catalog Proxy
 * Route: /api/channels
 * 
 * Delivers 24/7 sports & TV channels catalog directly from ppv.st
 * Bypasses local ISP blocks on .st domains
 */

export async function onRequest(context) {
    if (context.request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                'Access-Control-Allow-Headers': '*'
            }
        });
    }

    try {
        const resp = await fetch('https://ppv.st/data/dlhd-channels.json', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                'Referer': 'https://ppv.st/',
                'Accept': 'application/json, text/plain, */*'
            }
        });

        if (resp.ok) {
            const data = await resp.json();
            return new Response(JSON.stringify(data), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'public, max-age=300'
                }
            });
        }
    } catch (e) {
        console.warn('Failed to fetch channels from ppv.st:', e.message);
    }

    return new Response(JSON.stringify({ channels: [] }), {
        status: 502,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}
