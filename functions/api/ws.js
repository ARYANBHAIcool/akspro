/**
 * Cloudflare Pages Function: /api/ws
 * Edge WebSocket Reverse Proxy to l1.strims24.st with Origin: https://iplayer24.me
 */

export async function onRequest(context) {
    const upgradeHeader = context.request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
        return new Response('Expected WebSocket connection', { status: 426 });
    }

    try {
        const [client, server] = Object.values(new WebSocketPair());
        server.accept();

        const headers = new Headers();
        headers.set('Upgrade', 'websocket');
        headers.set('Origin', 'https://iplayer24.me');
        headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36');

        const backendResponse = await fetch('https://l1.strims24.st/ws', {
            headers: headers
        });

        const backendWs = backendResponse.webSocket;
        if (!backendWs) {
            return new Response(`Upstream WS failed: status=${backendResponse.status} text=${backendResponse.statusText}`, { status: 502 });
        }
        backendWs.accept();

        server.addEventListener('message', event => {
            try { backendWs.send(event.data); } catch (e) {}
        });
        backendWs.addEventListener('message', event => {
            try { server.send(event.data); } catch (e) {}
        });

        server.addEventListener('close', event => {
            try { backendWs.close(event.code, event.reason); } catch (e) {}
        });
        backendWs.addEventListener('close', event => {
            try { server.close(event.code, event.reason); } catch (e) {}
        });

        server.addEventListener('error', () => {
            try { backendWs.close(); } catch (e) {}
        });
        backendWs.addEventListener('error', () => {
            try { server.close(); } catch (e) {}
        });

        return new Response(null, {
            status: 101,
            webSocket: client
        });
    } catch (err) {
        return new Response('WebSocket Proxy Error: ' + err.message, { status: 500 });
    }
}
