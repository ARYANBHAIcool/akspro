export async function onRequest(context) {
    const url = new URL(context.request.url);
    return context.env.ASSETS.fetch(new Request(new URL('/player/index.html', url.origin), context.request));
}
