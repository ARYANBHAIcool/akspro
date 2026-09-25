var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// _worker.js
var __defProp2 = Object.defineProperty;
var __name2 = /* @__PURE__ */ __name((target, value) => __defProp2(target, "name", { value, configurable: true }), "__name");
var __defProp22 = Object.defineProperty;
var __name22 = /* @__PURE__ */ __name2((target, value) => __defProp22(target, "name", { value, configurable: true }), "__name");
var __defProp222 = Object.defineProperty;
var __name222 = /* @__PURE__ */ __name22((target, value) => __defProp222(target, "name", { value, configurable: true }), "__name");
async function onRequest(context) {
  const url = new URL(context.request.url);
  const targetPath = url.pathname.replace(/^\/api\/damitv\//, "");
  const search = url.search;
  const targetUrl = `https://damitv.st/${targetPath}${search}`;
  try {
    const response = await fetch(targetUrl, {
      method: context.request.method,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://damitv.st/",
        "Accept": "application/json, text/plain, */*"
      }
    });
    const newHeaders = new Headers(response.headers);
    newHeaders.set("Access-Control-Allow-Origin", "*");
    newHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    newHeaders.set("Access-Control-Allow-Headers", "*");
    newHeaders.set("Cache-Control", "public, max-age=60");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
__name(onRequest, "onRequest");
__name2(onRequest, "onRequest");
__name22(onRequest, "onRequest");
__name222(onRequest, "onRequest");
async function onRequest2(context) {
  const requestUrl = new URL(context.request.url);
  let targetUrl = requestUrl.searchParams.get("url");
  if (!targetUrl && requestUrl.searchParams.has("p")) {
    targetUrl = `https://amazon.com.pandecocogaming.sbs/${requestUrl.search}`;
  }
  if (!targetUrl) {
    return new Response("Missing target url parameter", {
      status: 400,
      headers: {
        "Content-Type": "text/plain",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
  try {
    const parsedTarget = new URL(targetUrl);
    const reqEngine = requestUrl.searchParams.get("player") || parsedTarget.searchParams.get("player");
    if (reqEngine) {
      if (reqEngine === "bitmovin") {
        parsedTarget.searchParams.delete("player");
      } else {
        parsedTarget.searchParams.set("player", reqEngine);
      }
    }
    const upstreamResponse = await fetch(parsedTarget.toString(), {
      method: context.request.method,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Referer": "https://streamcorner.fun/",
        "Origin": "https://streamcorner.fun",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });
    if (!upstreamResponse.ok) {
      return new Response(`Upstream returned ${upstreamResponse.status}`, {
        status: upstreamResponse.status,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }
    let html = await upstreamResponse.text();
    const injectScript = `<script>
(function() {
    // Route Amazon Nitro/CloudFront CDN requests via /api/nitro with allowed origin
    var nitroBase = (window.location.origin || '') + '/api/nitro?url=';
    var origFetch = window.fetch;
    window.fetch = function(input, init) {
        var args = Array.prototype.slice.call(arguments);
        try {
            var urlStr = '';
            if (typeof input === 'string') {
                urlStr = input;
            } else if (input && input.url) {
                urlStr = input.url;
            } else if (input && input.href) {
                urlStr = input.href;
            } else if (input) {
                urlStr = String(input);
            }
            if (urlStr && !urlStr.startsWith(nitroBase) && (urlStr.includes('aiv-cdn.net') || urlStr.includes('cenc.mpd') || urlStr.includes('pv-cdn.net') || urlStr.includes('cloudfront.net') || (urlStr.includes('.mpd') && !urlStr.includes('akamaized')))) {
                var proxied = nitroBase + encodeURIComponent(urlStr);
                if (typeof input === 'string') {
                    input = proxied;
                } else if (input && input.url) {
                    input = new Request(proxied, input);
                } else {
                    input = proxied;
                }
                args[0] = input;
            }
        } catch (e) {}
        return origFetch.apply(this, args);
    };

    var origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, async, user, pass) {
        var args = Array.prototype.slice.call(arguments);
        try {
            var urlStr = '';
            if (typeof url === 'string') {
                urlStr = url;
            } else if (url && url.href) {
                urlStr = url.href;
            } else if (url) {
                urlStr = String(url);
            }
            if (urlStr && !urlStr.startsWith(nitroBase) && (urlStr.includes('aiv-cdn.net') || urlStr.includes('cenc.mpd') || urlStr.includes('pv-cdn.net') || urlStr.includes('cloudfront.net') || (urlStr.includes('.mpd') && !urlStr.includes('akamaized')))) {
                url = nitroBase + encodeURIComponent(urlStr);
                args[1] = url;
            }
        } catch (e) {}
        return origOpen.apply(this, args);
    };

    // Only polyfill storage if running in a restricted sandbox where access throws SecurityError
    try {
        window.localStorage.getItem('_test');
    } catch (e) {
        var mem = {};
        var fakeStorage = {
            getItem: function(k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
            setItem: function(k, v) { mem[k] = String(v); },
            removeItem: function(k) { delete mem[k]; },
            clear: function() { for (var k in mem) delete mem[k]; }
        };
        try {
            Object.defineProperty(window, 'localStorage', { value: fakeStorage, writable: true, configurable: true });
            Object.defineProperty(window, 'sessionStorage', { value: fakeStorage, writable: true, configurable: true });
        } catch (e2) {}
    }

    try {
        var targetSearch = '${parsedTarget.search || ""}';
        var curUrl = new URL(window.location.href);
        var modified = false;

        // 1. Sync all parameters from upstream target URL into window.location
        if (targetSearch) {
            var targetParams = new URLSearchParams(targetSearch);
            targetParams.forEach(function(val, key) {
                if (curUrl.searchParams.get(key) !== val) {
                    curUrl.searchParams.set(key, val);
                    modified = true;
                }
            });
        }

        // 2. Explicitly ensure requested player engine is synced to window.location
        var reqEngine = '${reqEngine || ""}';
        if (reqEngine) {
            if (reqEngine === 'bitmovin') {
                if (curUrl.searchParams.has('player')) {
                    curUrl.searchParams.delete('player');
                    modified = true;
                }
            } else {
                if (curUrl.searchParams.get('player') !== reqEngine) {
                    curUrl.searchParams.set('player', reqEngine);
                    modified = true;
                }
            }
        }

        if (modified) {
            window.history.replaceState(null, '', curUrl.pathname + curUrl.search);
        }
    } catch (e) {}

    // Genuine sound restoration: ensure sound icon accurately reflects active audio and unmuted status
    var userToggledMute = false;
    document.addEventListener('click', function(e) {
        if (e.target && e.target.closest && e.target.closest('.bmpui-ui-volumetogglebutton, .op-volume, .shaka-mute-button, .jw-icon-volume, [class*="volume"], [class*="mute"]')) {
            userToggledMute = true;
        }
    }, true);

    function syncAndUnmuteAudio() {
        if (userToggledMute) return;
        var vids = document.querySelectorAll('video');
        for (var i = 0; i < vids.length; i++) {
            var v = vids[i];
            if (v.muted) v.muted = false;
            if (v.volume === 0) v.volume = 1.0;
        }
        var mutedElements = document.querySelectorAll('.bmpui-ui-volumetogglebutton.bmpui-muted, button.bmpui-muted, .op-volume--muted');
        for (var j = 0; j < mutedElements.length; j++) {
            mutedElements[j].classList.remove('bmpui-muted', 'op-volume--muted');
        }
    }

    document.addEventListener('click', syncAndUnmuteAudio, true);
    document.addEventListener('touchstart', syncAndUnmuteAudio, true);
    document.addEventListener('play', syncAndUnmuteAudio, true);
    document.addEventListener('playing', syncAndUnmuteAudio, true);

    // Force hide 'Loading up the stream...' overlay once video stream starts playback
    function hideStreamLoadingOverlay() {
        var overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden', 'force-hide');
            overlay.style.setProperty('display', 'none', 'important');
            overlay.style.setProperty('opacity', '0', 'important');
            overlay.style.setProperty('visibility', 'hidden', 'important');
            overlay.style.setProperty('pointer-events', 'none', 'important');
        }
        var msg = document.getElementById('loading-message');
        if (msg) msg.innerText = '';
    }

    document.addEventListener('play', hideStreamLoadingOverlay, true);
    document.addEventListener('playing', hideStreamLoadingOverlay, true);
    document.addEventListener('timeupdate', function(e) {
        if (e.target && (e.target.currentTime > 0.05 || !e.target.paused)) {
            hideStreamLoadingOverlay();
        }
    }, true);

    // Watch video status periodically
    var checkInterval = setInterval(function() {
        var vids = document.querySelectorAll('video');
        for (var i = 0; i < vids.length; i++) {
            var v = vids[i];
            if (!v.paused || v.currentTime > 0 || v.readyState >= 2) {
                hideStreamLoadingOverlay();
                syncAndUnmuteAudio();
                break;
            }
        }
    }, 300);

    // Safety fallback: auto-hide after 5 seconds once player initializes
    setTimeout(function() {
        var vids = document.querySelectorAll('video');
        if (vids.length > 0) hideStreamLoadingOverlay();
    }, 5000);
})();
<\/script>
<style>
#loading-overlay.hidden,
#loading-overlay.force-hide,
#loading-overlay[style*="display: none"] {
    display: none !important;
    opacity: 0 !important;
    visibility: hidden !important;
    pointer-events: none !important;
}
</style>`;
    const baseHref = parsedTarget.origin ? `${parsedTarget.origin}/` : "https://amazon.com.pandecocogaming.sbs/";
    html = html.replace("<head>", `<head>
    <base href="${baseHref}">
    ${injectScript}`);
    html = html.replace(/aclib\.runPop\([^)]*\)/g, "/* ad popup removed */");
    html = html.replace(/<script[^>]*disable-devtool[^>]*><\/script>/gi, "<!-- devtool disabled -->");
    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", "text/html; charset=utf-8");
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    responseHeaders.set("Cache-Control", "public, max-age=60");
    return new Response(html, {
      status: 200,
      headers: responseHeaders
    });
  } catch (err) {
    return new Response("Stream proxy error: " + err.message, {
      status: 502,
      headers: {
        "Content-Type": "text/plain",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
__name(onRequest2, "onRequest2");
__name2(onRequest2, "onRequest2");
__name22(onRequest2, "onRequest2");
__name222(onRequest2, "onRequest");
async function onRequest3(context) {
  const url = new URL(context.request.url);
  const targetUrl = url.searchParams.get("url");
  if (!targetUrl) {
    return new Response("Missing url parameter", {
      status: 400,
      headers: {
        "Content-Type": "text/plain",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Max-Age": "86400"
      }
    });
  }
  try {
    const parsedTarget = new URL(targetUrl);
    const reqHeaders = {
      "Origin": "https://streamcorner.fun",
      "Referer": "https://streamcorner.fun/",
      "User-Agent": context.request.headers.get("User-Agent") || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      "Accept": context.request.headers.get("Accept") || "*/*"
    };
    const range = context.request.headers.get("Range");
    if (range) {
      reqHeaders["Range"] = range;
    }
    const upstreamResponse = await fetch(parsedTarget.toString(), {
      method: context.request.method,
      headers: reqHeaders,
      redirect: "follow"
    });
    const contentType = upstreamResponse.headers.get("content-type") || "";
    const isMpd = targetUrl.includes(".mpd") || contentType.includes("dash+xml") || contentType.includes("xml");
    const newHeaders = new Headers(upstreamResponse.headers);
    newHeaders.set("Access-Control-Allow-Origin", "*");
    newHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    newHeaders.set("Access-Control-Allow-Headers", "*");
    newHeaders.set("Access-Control-Expose-Headers", "*");
    newHeaders.delete("Content-Security-Policy");
    newHeaders.delete("X-Frame-Options");
    if (isMpd) {
      let mpdText = await upstreamResponse.text();
      const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf("/") + 1);
      if (!mpdText.includes("<BaseURL>") && baseUrl) {
        mpdText = mpdText.replace(/<MPD([^>]*)>/i, `<MPD$1>
  <BaseURL>${baseUrl}</BaseURL>`);
      }
      newHeaders.set("Content-Type", "application/dash+xml; charset=utf-8");
      newHeaders.set("Cache-Control", "public, max-age=5");
      return new Response(mpdText, {
        status: upstreamResponse.status,
        headers: newHeaders
      });
    }
    newHeaders.set("Cache-Control", "public, max-age=300");
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: newHeaders
    });
  } catch (err) {
    return new Response("Nitro proxy error: " + err.message, {
      status: 502,
      headers: {
        "Content-Type": "text/plain",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
__name(onRequest3, "onRequest3");
__name2(onRequest3, "onRequest3");
__name22(onRequest3, "onRequest3");
__name222(onRequest3, "onRequest");
async function onRequest4(context) {
  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Max-Age": "86400"
      }
    });
  }
  function transformDamiListToCategories(items) {
    if (!Array.isArray(items)) return [];
    const catMap = /* @__PURE__ */ new Map();
    for (const item of items) {
      if (!item || !item.id && !item.title) continue;
      const rawCat = (item.category || "sports").trim().toLowerCase();
      const catName = rawCat.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      if (!catMap.has(catName)) {
        catMap.set(catName, []);
      }
      const nowSec = Math.floor(Date.now() / 1e3);
      const startSec = item.date ? typeof item.date === "number" ? Math.floor(item.date / 1e3) : Math.floor(new Date(item.date).getTime() / 1e3) : 0;
      const endSec = startSec ? startSec + 10800 : 0;
      if (item.status === "ended" || item.status === "finished") {
        continue;
      }
      if (endSec > 0 && nowSec > endSec + 900 && !item.always_live) {
        continue;
      }
      const rawPoster = item.poster || item.image || "";
      const cleanPoster = rawPoster && rawPoster.includes("streamed.pk") ? `https://wsrv.nl/?url=${encodeURIComponent(rawPoster)}` : rawPoster;
      catMap.get(catName).push({
        id: item.id,
        name: item.title,
        tag: item.league || catName,
        starts_at: startSec,
        ends_at: endSec,
        iframe: item.embedUrl || (item.id ? `https://embedindia.st/embed/${item.id}` : ""),
        poster: cleanPoster,
        popular: Boolean(item.popular),
        status: item.status || "upcoming",
        category: rawCat,
        substreams: Array.isArray(item.substreams) ? item.substreams : []
      });
    }
    const streams = [];
    for (const [cat, streamList] of catMap.entries()) {
      streams.push({
        category: cat,
        streams: streamList
      });
    }
    return streams;
  }
  __name(transformDamiListToCategories, "transformDamiListToCategories");
  __name2(transformDamiListToCategories, "transformDamiListToCategories");
  __name22(transformDamiListToCategories, "transformDamiListToCategories");
  __name222(transformDamiListToCategories, "transformDamiListToCategories");
  try {
    const ppvResp = await fetch("https://api.ppv.st/api/streams", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Referer": "https://ppv.st/"
      }
    });
    if (ppvResp.ok) {
      const json = await ppvResp.json();
      if (json && json.success !== false && Array.isArray(json.streams)) {
        const nowSec = Math.floor(Date.now() / 1e3);
        const activeStreams = json.streams.map((cat) => ({
          ...cat,
          streams: (cat.streams || []).filter((s) => {
            const start = s.starts_at || 0;
            const end = s.ends_at || (start ? start + 10800 : 0);
            if (s.status === "ended" || s.status === "finished") return false;
            if (end > 0 && nowSec > end + 900 && !s.always_live) return false;
            return true;
          })
        })).filter((cat) => cat.streams.length > 0);
        return new Response(JSON.stringify({ success: true, streams: activeStreams }), {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=300, s-maxage=300"
          }
        });
      }
    }
  } catch (e1) {
    console.warn("api.ppv.st fetch failed in /api/ppv proxy:", e1.message);
  }
  try {
    const damitvResp = await fetch("https://damitv.st/papi/matches/all-today", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Referer": "https://damitv.st/",
        "Accept": "application/json"
      }
    });
    if (damitvResp.ok) {
      const rawList = await damitvResp.json();
      if (Array.isArray(rawList) && rawList.length > 0) {
        const categories = transformDamiListToCategories(rawList);
        return new Response(JSON.stringify({ success: true, streams: categories }), {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=300, s-maxage=300"
          }
        });
      }
    }
  } catch (err) {
    console.warn("damitv fetch failed in /api/ppv proxy:", err.message);
  }
  return new Response(JSON.stringify({ success: false, error: "Could not retrieve feeds from upstream" }), {
    status: 502,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(onRequest4, "onRequest4");
__name2(onRequest4, "onRequest4");
__name22(onRequest4, "onRequest4");
__name222(onRequest4, "onRequest");
var memoryCache = {
  code: null,
  timestamp: 0
};
async function onRequest5(context) {
  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*"
      }
    });
  }
  const url = new URL(context.request.url);
  const forceRefresh = url.searchParams.has("refresh") || url.searchParams.has("bust");
  const now = Date.now();
  if (!forceRefresh && memoryCache.code && now - memoryCache.timestamp < 108e5) {
    return new Response(memoryCache.code, {
      status: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600"
      }
    });
  }
  try {
    const htmlRes = await fetch("https://streamcorner.fun/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });
    if (!htmlRes.ok) throw new Error("StreamCorner HTML fetch failed: " + htmlRes.status);
    const html = await htmlRes.text();
    const mainScriptMatch = html.match(/src=["'](\/assets\/[^"']+\.js)["']/i);
    if (!mainScriptMatch) throw new Error("Main script not found in HTML");
    const mainScriptUrl = "https://streamcorner.fun" + mainScriptMatch[1];
    const mainRes = await fetch(mainScriptUrl);
    if (!mainRes.ok) throw new Error("Failed to fetch main script: " + mainScriptUrl);
    const mainCode = await mainRes.text();
    const candidateUrls = [];
    const manifestMatch = mainCode.match(/m\.f\s*=\s*\[([^\]]+)\]/);
    if (manifestMatch) {
      const assetFiles = JSON.parse("[" + manifestMatch[1] + "]");
      for (const file of assetFiles) {
        if (file.endsWith(".js")) {
          candidateUrls.push("https://streamcorner.fun/" + (file.startsWith("/") ? file.slice(1) : file));
        }
      }
    } else {
      candidateUrls.push(mainScriptUrl);
    }
    const cryptoRegex = /export\s*\{([^}]*?\b([a-zA-Z0-9_$]+)\s+as\s+j\b[^}]*)\};?/;
    let found = null;
    for (let i = 0; i < candidateUrls.length; i += 6) {
      const batch = candidateUrls.slice(i, i + 6);
      const results = await Promise.all(batch.map(async (chunkUrl) => {
        try {
          const res = await fetch(chunkUrl);
          if (!res.ok) return null;
          const text = await res.text();
          if (text.length < 1e5) return null;
          if (text.startsWith("import") || text.slice(0, 100).includes("import")) return null;
          const m = text.match(cryptoRegex);
          if (m) {
            const jVar = m[2];
            const tMatch = m[1].match(/\b([a-zA-Z0-9_$]+)\s+as\s+t\b/);
            const tVar = tMatch ? tMatch[1] : jVar;
            const mMatch = m[1].match(/\b([a-zA-Z0-9_$]+)\s+as\s+m\b/);
            const mVar = mMatch ? mMatch[1] : jVar;
            return { url: chunkUrl, code: text, fullExport: m[0], jVar, tVar, mVar };
          }
        } catch (e) {
        }
        return null;
      }));
      found = results.find(Boolean);
      if (found) break;
    }
    if (!found) throw new Error("Could not locate crypto core chunk in assets");
    const replacement = `window.StreamCornerCore = { j: ${found.jVar}, t: ${found.tVar}, m: ${found.mVar} };`;
    const patchedCode = found.code.replace(found.fullExport, replacement);
    memoryCache = {
      code: patchedCode,
      timestamp: now
    };
    return new Response(patchedCode, {
      status: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch (err) {
    if (memoryCache.code) {
      return new Response(memoryCache.code, {
        status: 200,
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache"
        }
      });
    }
    return new Response('console.error("StreamCorner core auto-discovery failed: ' + err.message + '");', {
      status: 500,
      headers: {
        "Content-Type": "application/javascript",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
__name(onRequest5, "onRequest5");
__name2(onRequest5, "onRequest5");
__name22(onRequest5, "onRequest5");
__name222(onRequest5, "onRequest");
var routes = [
  {
    routePath: "/api/damitv/:path*",
    mountPath: "/api/damitv",
    method: "",
    middlewares: [],
    modules: [onRequest]
  },
  {
    routePath: "/api/embed",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest2]
  },
  {
    routePath: "/api/nitro",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest3]
  },
  {
    routePath: "/api/ppv",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest4]
  },
  {
    routePath: "/api/streamcorner-core",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest5]
  }
];
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
__name2(lexer, "lexer");
__name22(lexer, "lexer");
__name222(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name222(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name222(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name222(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name222(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name222(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
__name2(parse, "parse");
__name22(parse, "parse");
__name222(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
__name2(match, "match");
__name22(match, "match");
__name222(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name222(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
__name2(regexpToFunction, "regexpToFunction");
__name22(regexpToFunction, "regexpToFunction");
__name222(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
__name2(escapeString, "escapeString");
__name22(escapeString, "escapeString");
__name222(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
__name2(flags, "flags");
__name22(flags, "flags");
__name222(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
__name2(regexpToRegexp, "regexpToRegexp");
__name22(regexpToRegexp, "regexpToRegexp");
__name222(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
__name2(arrayToRegexp, "arrayToRegexp");
__name22(arrayToRegexp, "arrayToRegexp");
__name222(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
__name2(stringToRegexp, "stringToRegexp");
__name22(stringToRegexp, "stringToRegexp");
__name222(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
__name2(tokensToRegexp, "tokensToRegexp");
__name22(tokensToRegexp, "tokensToRegexp");
__name222(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");
__name2(pathToRegexp, "pathToRegexp");
__name22(pathToRegexp, "pathToRegexp");
__name222(pathToRegexp, "pathToRegexp");
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
__name2(executeRequest, "executeRequest");
__name22(executeRequest, "executeRequest");
__name222(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name222(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name222(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name222((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
