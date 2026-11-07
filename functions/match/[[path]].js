/**
 * Cloudflare Pages Function: /match/[[path]]
 * Legacy route handler: redirects to home or player page
 */

export async function onRequest(context) {
    const url = new URL(context.request.url);
    const origin = url.origin;
    const streamUrl = url.searchParams.get('url') || url.searchParams.get('src');
    if (streamUrl) {
        return Response.redirect(`${origin}/player.html?${url.searchParams.toString()}`, 302);
    }
    return Response.redirect(`${origin}/`, 302);
}
