/**
 * Cloudflare Pages Function: /api/debug
 */
export async function onRequest(context) {
    const url = new URL(context.request.url);
    const targetMatch = url.searchParams.get('match') || 'xdLoJd4b';
    const dzekoUrl = `https://dzeko11.pk/api/v1/match/FS:${targetMatch}`;

    let status = 0;
    let headers = {};
    let body = '';
    let error = null;

    try {
        const resp = await fetch(dzekoUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': 'https://dzeko11.pk/',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin'
            }
        });
        status = resp.status;
        resp.headers.forEach((v, k) => { headers[k] = v; });
        body = await resp.text();
    } catch (e) {
        error = e.message || String(e);
    }

    return new Response(JSON.stringify({
        targetMatch,
        dzekoUrl,
        status,
        headers,
        bodyPreview: body.slice(0, 500),
        bodyLength: body.length,
        error
    }, null, 2), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}
