/**
 * Cloudflare Pages Function: /match/[[path]]
 * Serves match/index.html for any match route (e.g. /match/football/xdLoJd4b)
 */

export async function onRequest(context) {
    const url = new URL(context.request.url);
    const origin = url.origin;
    const res = await fetch(`${origin}/match/index.html`);
    if (res.ok) {
        const html = await res.text();
        return new Response(html, {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'public, max-age=60, stale-while-revalidate=120'
            }
        });
    }
    return context.next();
}
