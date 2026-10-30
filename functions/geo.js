/**
 * Cloudflare Pages Function: /geo
 * Returns client country code from Cloudflare CF-IPCountry header
 */

export async function onRequest(context) {
    const country = context.request.cf?.country || context.request.headers.get('cf-ipcountry') || 'US';
    return new Response(JSON.stringify({ country: country, cc: country }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600'
        }
    });
}
