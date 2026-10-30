/**
 * Cloudflare Pages Function: /match/[[path]]
 * Serves match/index.html for any match route (e.g. /match/football/xdLoJd4b)
 */

export async function onRequest(context) {
    const url = new URL(context.request.url);
    return context.env.ASSETS.fetch(new Request(new URL('/match/index.html', url.origin), context.request));
}
