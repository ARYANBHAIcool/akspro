/**
 * Cloudflare Pages Function: /api/ws
 * Edge WebSocket Reverse Proxy to l1.strims24.st with Origin: https://iplayer24.me
 */

export async function onRequest(context) {
    const upgradeHeader = context.request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
        return new Response('Expected WebSocket connection', { status: 426 });
    }

    const headers = new Headers();
    headers.set('Host', 'l1.strims24.st');
    headers.set('Origin', 'https://iplayer24.me');
    headers.set('User-Agent', context.request.headers.get('User-Agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    headers.set('Upgrade', 'websocket');
    headers.set('Connection', 'Upgrade');

    const secKey = context.request.headers.get('Sec-WebSocket-Key');
    if (secKey) headers.set('Sec-WebSocket-Key', secKey);
    const secVersion = context.request.headers.get('Sec-WebSocket-Version');
    if (secVersion) headers.set('Sec-WebSocket-Version', secVersion);
    const secProtocols = context.request.headers.get('Sec-WebSocket-Protocol');
    if (secProtocols) headers.set('Sec-WebSocket-Protocol', secProtocols);

    return fetch('https://l1.strims24.st/ws', {
        headers: headers
    });
}
