var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// _worker.js
var __defProp2 = Object.defineProperty;
var __name2 = /* @__PURE__ */ __name((target, value) => __defProp2(target, "name", { value, configurable: true }), "__name");
var __defProp22 = Object.defineProperty;
var __name22 = /* @__PURE__ */ __name2((target, value) => __defProp22(target, "name", { value, configurable: true }), "__name");
var __defProp222 = Object.defineProperty;
var __name222 = /* @__PURE__ */ __name22((target, value) => __defProp222(target, "name", { value, configurable: true }), "__name");
var __defProp2222 = Object.defineProperty;
var __name2222 = /* @__PURE__ */ __name222((target, value) => __defProp2222(target, "name", { value, configurable: true }), "__name");
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
__name2222(onRequest, "onRequest");
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
    if (requestUrl.searchParams.has("subpath")) {
      const sub = requestUrl.searchParams.get("subpath");
      parsedTarget.pathname = sub.startsWith("/") ? sub : `/${sub}`;
    }
    const isStreamCorner = parsedTarget.origin.includes("pandecocogaming") ||
                           parsedTarget.origin.includes("getsugatensho") ||
                           parsedTarget.origin.includes("streamcorner");
    const upstreamHeaders = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      "Referer": isStreamCorner ? "https://streamcorner.foo/" : `${parsedTarget.origin}/`,
      "Origin": isStreamCorner ? "https://streamcorner.foo" : parsedTarget.origin,
      "Accept": "*/*",
      "Accept-Language": "en-US,en;q=0.9"
    };
    const upstreamResponse = await fetch(parsedTarget.toString(), {
      method: context.request.method,
      headers: upstreamHeaders
    });
    if (!upstreamResponse.ok) {
      return new Response(`Upstream returned ${upstreamResponse.status}`, {
        status: upstreamResponse.status,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }
    if (parsedTarget.pathname.endsWith(".js") || targetUrl.includes(".js")) {
      const jsText = await upstreamResponse.text();
      return new Response(jsText, {
        status: 200,
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600"
        }
      });
    }
    let html = await upstreamResponse.text();
    const injectScript = `<script>
(function() {

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
    if (html.includes("<head>")) {
      html = html.replace("<head>", `<head>
    <base href="${baseHref}">
    ${injectScript}`);
    } else if (html.includes("<html")) {
      html = html.replace(/<html[^>]*>/i, `$&<head><base href="${baseHref}">${injectScript}</head>`);
    } else {
      html = `<base href="${baseHref}">${injectScript}` + html;
    }
    html = html.replace(/aclib\.runPop\([^)]*\)/g, "/* ad popup removed */");
    html = html.replace(/<script[^>]*disable-devtool[^>]*><\/script>/gi, "<!-- devtool disabled -->");
    if (html.includes('location.protocol+"//"+location.host')) {
      html = html.replace('var a=location.protocol+"//"+location.host', `var a=(window.location.origin||"") + "/api/embed?url=" + encodeURIComponent("${parsedTarget.origin}") + "&subpath="`);
    }
    html = html.replace(/e\.setAttribute\(["']src["'],\s*a\s*\+\s*\(["']clappr["']\s*===\s*t\s*\?\s*["']\/js\/bundle\.js["']\s*:\s*["']\/js\/bundle-jw\.js["']\)\)/g,
      `e.setAttribute("src", (window.location.origin||"") + "/api/embed?url=" + encodeURIComponent("${parsedTarget.origin}") + "&subpath=" + ("clappr"===t?"/js/bundle.js":"/js/bundle-jw.js"))`);
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
__name222(onRequest2, "onRequest2");
__name2222(onRequest2, "onRequest");
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
      "Origin": "https://streamcorner.foo",
      "Referer": "https://streamcorner.foo/",
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
__name222(onRequest3, "onRequest3");
__name2222(onRequest3, "onRequest");
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
  const reqUrl = new URL(context.request.url);
  const endpointParam = (reqUrl.searchParams.get("endpoint") || reqUrl.searchParams.get("type") || "").toLowerCase();
  if (endpointParam === "all" || endpointParam === "schedule" || endpointParam === "matches") {
    const scheduleMirrors = [
      "https://streamed.pk/api/matches/all",
      "https://damitv.st/papi/matches/all-today"
    ];
    for (const mirror of scheduleMirrors) {
      try {
        const sResp = await fetch(mirror, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            "Accept": "application/json"
          }
        });
        if (sResp.ok) {
          const data = await sResp.json();
          if (Array.isArray(data) && data.length > 0) {
            return new Response(JSON.stringify(data), {
              status: 200,
              headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=60, s-maxage=60"
              }
            });
          }
        }
      } catch (e) {
      }
    }
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
      let rawPoster = item.poster || item.image || "";
      if (rawPoster.startsWith("/api/images") || rawPoster.startsWith("/images") || rawPoster.startsWith("api/images")) {
        rawPoster = "https://streamed.pk/" + rawPoster.replace(/^\/+/, "");
      }
      const cleanPoster = rawPoster && (rawPoster.includes("streamed.pk") || rawPoster.includes("static.ppvservices.st")) ? `https://wsrv.nl/?url=${encodeURIComponent(rawPoster)}&w=480&output=webp` : rawPoster;
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
        substreams: Array.isArray(item.substreams) ? item.substreams : [],
        teams: item.teams || (item.team1 && item.team2 ? { home: item.team1, away: item.team2 } : null)
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
  __name2222(transformDamiListToCategories, "transformDamiListToCategories");
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
__name222(onRequest4, "onRequest4");
__name2222(onRequest4, "onRequest");

/**
 * Cloudflare Pages Function: Dynamic Self-Healing StreamCorner Core Engine
 * Route: /api/streamcorner-core
 * 
 * Automatically probes https://streamcorner.foo/ for the latest bundle,
 * extracts the active crypto decryption worker/routine, patches window.StreamCornerCore,
 * and caches it on the edge.
 */

const FALLBACK_CORE = "/**\n * StreamCorner Core Engine - Auto-generated from latest production bundle\n * Provides real-time token generation and stream decryption for Alpha, Admin, NBA, and Beta feeds\n */\n(function(root) {\n    'use strict';\n    const scope = (typeof window !== 'undefined') ? window : ((typeof self !== 'undefined') ? self : root);\n    \n    let capturedW = null;\n    (function(){\"use strict\";function K(r,e){const n=7&e;return 255&(r<<n|r>>>8-n)}function I(r,e){const n=7&e;return 255&(r>>>n|r<<8-n)}function d(r){const e=new Uint8Array(r[2].length);let n=r[0];for(let o=0;o<e.length;o+=1){const u=r[5][o],t=I(K(r[2][o],7&(n^r[1]))^r[3][u]+(n^13*o&255)&255^r[1]+17*o&255,7&(r[4][o]^n));e[o]=t,n=K(n,1)^t+r[4][o]+o&255}return e}function D(r){return r>=65&&r<=90?r-65:r>=97&&r<=122?r-97:r>=50&&r<=55?r-24:-1}function ht(r){return r<26?String.fromCharCode(65+r):String.fromCharCode(50+r-26)}function gt(r,e,n){return r[e%r.length]+tt+3*n+e*xt&31}function M(r){return Ot.decode(r)}function W(r,e){return M((function(n,o){if(!o.length)return Uint8Array.from(n);const u=new Uint8Array(n.length);for(let t=0;t<n.length;t+=1)u[t]=n[t]^o[t%o.length];return u})((function(n){const o=new Uint8Array(n.length);for(let u=0;u<n.length;u+=1)o[u]=n[u]+181&255;return o})((function(n){let o=0,u=0;const t=[];for(let i=0;i<n.length;i+=1){const s=D(n.charCodeAt(i));if(!(s<0))for(u=u<<5|s,o+=5;o>=8;)t.push(u>>>o-8&255),o-=8}return Uint8Array.from(t)})((function(n,o){if(!n||!o.length)return n;let u=\"\",t=tt;for(let i=0;i<n.length;i+=1){const s=D(n.charCodeAt(i));s<0?u+=n[i]:(u+=ht(s+32-gt(o,i,t)&31),t=s)}return u})(r,e))),e))}function P(r,e,n){return J(L(r,e,n))}function mt(r,e,n){const o=new Uint32Array(16),u=[1634760805,857760878,2036477234,1797285236];o[0]=u[0],o[5]=u[1],o[10]=u[2],o[15]=u[3];for(let s=0;s<4;s+=1)o[1+s]=Q(r,4*s),o[11+s]=Q(r,16+4*s);o[6]=Q(e,0),o[7]=Q(e,4),o[8]=n>>>0,o[9]=Math.floor(n/4294967296)>>>0;const t=Uint32Array.from(o);for(let s=0;s<6;s+=1)t[4]^=f(t[0]+t[12]>>>0,7),t[8]^=f(t[4]+t[0]>>>0,9),t[12]^=f(t[8]+t[4]>>>0,13),t[0]^=f(t[12]+t[8]>>>0,18),t[9]^=f(t[5]+t[1]>>>0,7),t[13]^=f(t[9]+t[5]>>>0,9),t[1]^=f(t[13]+t[9]>>>0,13),t[5]^=f(t[1]+t[13]>>>0,18),t[14]^=f(t[10]+t[6]>>>0,7),t[2]^=f(t[14]+t[10]>>>0,9),t[6]^=f(t[2]+t[14]>>>0,13),t[10]^=f(t[6]+t[2]>>>0,18),t[3]^=f(t[15]+t[11]>>>0,7),t[7]^=f(t[3]+t[15]>>>0,9),t[11]^=f(t[7]+t[3]>>>0,13),t[15]^=f(t[11]+t[7]>>>0,18),t[1]^=f(t[0]+t[3]>>>0,7),t[2]^=f(t[1]+t[0]>>>0,9),t[3]^=f(t[2]+t[1]>>>0,13),t[0]^=f(t[3]+t[2]>>>0,18),t[6]^=f(t[5]+t[4]>>>0,7),t[7]^=f(t[6]+t[5]>>>0,9),t[4]^=f(t[7]+t[6]>>>0,13),t[5]^=f(t[4]+t[7]>>>0,18),t[11]^=f(t[10]+t[9]>>>0,7),t[8]^=f(t[11]+t[10]>>>0,9),t[9]^=f(t[8]+t[11]>>>0,13),t[10]^=f(t[9]+t[8]>>>0,18),t[12]^=f(t[15]+t[14]>>>0,7),t[13]^=f(t[12]+t[15]>>>0,9),t[14]^=f(t[13]+t[12]>>>0,13),t[15]^=f(t[14]+t[13]>>>0,18);const i=new Uint8Array(64);for(let s=0;s<16;s+=1)yt(i,4*s,t[s]+o[s]>>>0);return i}function Y(r,e,n){const o=new Uint8Array(r.length);for(let u=0,t=0;u<r.length;u+=64,t+=1){const i=mt(e,n,t);for(let s=0;s<64&&u+s<r.length;s+=1)o[u+s]=r[u+s]^i[s]}return o}function q(r,e,n,o){return J(L(r,e,n,o)).subarray(0,12)}function Q(r,e){return(r[e]|r[e+1]<<8|r[e+2]<<16|r[e+3]<<24)>>>0}function yt(r,e,n){r[e]=255&n,r[e+1]=n>>>8&255,r[e+2]=n>>>16&255,r[e+3]=n>>>24&255}function Ut(r,e){return(r[e]<<24|r[e+1]<<16|r[e+2]<<8|r[e+3])>>>0}function B(r,e,n){r[e]=n>>>24&255,r[e+1]=n>>>16&255,r[e+2]=n>>>8&255,r[e+3]=255&n}function f(r,e){return(r<<e|r>>>32-e)>>>0}function p(r,e){return(r>>>e|r<<32-e)>>>0}function L(...r){const e=r.reduce((u,t)=>u+t.length,0),n=new Uint8Array(e);let o=0;for(const u of r)n.set(u,o),o+=u.length;return n}function J(r){const e=8n*BigInt(r.length),n=r.length+9+63&-64,o=new Uint8Array(n),u=new Uint32Array(64),t=Uint32Array.from(Et);o.set(r),o[r.length]=128;let i=e;for(let c=0;c<8;c+=1)o[o.length-1-c]=Number(0xffn&i),i>>=8n;for(let c=0;c<o.length;c+=64){for(let h=0;h<16;h+=1)u[h]=Ut(o,c+4*h);for(let h=16;h<64;h+=1){const x=p(u[h-15],7)^p(u[h-15],18)^u[h-15]>>>3,E=p(u[h-2],17)^p(u[h-2],19)^u[h-2]>>>10;u[h]=u[h-16]+x+u[h-7]+E>>>0}let m=t[0],a=t[1],g=t[2],w=t[3],U=t[4],A=t[5],O=t[6],k=t[7];for(let h=0;h<64;h+=1){const x=k+(p(U,6)^p(U,11)^p(U,25))+(U&A^~U&O)+Xt[h]+u[h]>>>0,E=m&a^m&g^a&g;k=O,O=A,A=U,U=w+x>>>0,w=g,g=a,a=m,m=x+((p(m,2)^p(m,13)^p(m,22))+E>>>0)>>>0}t[0]=t[0]+m>>>0,t[1]=t[1]+a>>>0,t[2]=t[2]+g>>>0,t[3]=t[3]+w>>>0,t[4]=t[4]+U>>>0,t[5]=t[5]+A>>>0,t[6]=t[6]+O>>>0,t[7]=t[7]+k>>>0}const s=new Uint8Array(32);for(let c=0;c<8;c+=1)B(s,4*c,t[c]);return s}function Z(r,e){if(r.length!==e.length)return!1;let n=0;for(let o=0;o<r.length;o+=1)n|=r[o]^e[o];return n===0}function b(r){if(r instanceof ArrayBuffer)return new Uint8Array(r);if(ArrayBuffer.isView(r))return new Uint8Array(r.buffer,r.byteOffset,r.byteLength);throw new Error(\"E05\")}function G(r,e){try{return(function(n,o){const u=(function(i){const s=new Array(256);return s[i[0]]=c=>{c[1]=K(255&(61^c[1]^c[0]),1)},s[i[9]]=c=>{c[1]=I(c[1]+39+c[0]&255,1)},s[i[10]]=c=>{c[1]=255&(c[1]^c[3][0].length^85)},s[i[11]]=c=>{const m=c[3][11];c[3][11]=c[3][10],c[3][10]=m},s[i[1]]=c=>{c[3][1]=d(H)},s[i[2]]=c=>{c[3][2]=c[3][0]},s[i[3]]=c=>{c[1]=K(255&(c[1]^c[3][0].length^107),1)},s[i[4]]=c=>{c[3][4]=c[1]^c[3][0].length^49},s[i[5]]=c=>{c[3][5]=d(et)},s[i[6]]=c=>{c[3][6]=(function(m,a,g,w){const U=b(m);if(U.length<=21||U[0]!==4)throw new Error(\"E05\");const A=(function(E,T,z){try{const j=b(E);if(j.length<=21||j[0]!==10)return null;const F=j.subarray(1,9),bt=j.subarray(9,21),ft=j.subarray(21),at=P(T,z,rt);if(!Z(bt,q(at,F,ft,nt)))return null;const X=JSON.parse(M(Y(ft,at,F)));if(!Array.isArray(X)||X.length!==3||typeof X[0]!=\"string\"||typeof X[1]!=\"string\")return null;const V=X[2];if(!Number.isSafeInteger(V)||V<0||V>4294967295||Math.abs(Math.floor(Date.now()/3e5)-V)>1)return null;const lt=new Uint8Array(4);return B(lt,0,V),[new TextEncoder().encode(X[0]),F,new TextEncoder().encode(X[1]),lt]}catch{return null}})(a,g,w);if(!A)throw new Error(\"E09\");const O=U.subarray(1,9),k=U.subarray(9,21),h=U.subarray(21),x=(function(E,T,z){return J(L(E,T,z,Mt))})(g,w,L(A[0],A[1],A[2],A[3]));if(!Z(k,q(x,O,h,Ct)))throw new Error(\"E06\");return M(Y(h,x,O))})(c[3][0],c[3][7],c[3][1],c[3][5])},s[i[7]]=c=>{c[2]=c[3][6]},s[i[8]]=()=>1,s})(d(kt)),t=[0,90,\"\",new Array(12).fill(null)];for(t[3][0]=b(n),t[3][7]=o;t[0]<ut.length;){const i=ut[t[0]];t[0]+=1;const s=u[i];if(!s)throw new Error(\"E00\");if(s(t)===1)break}if(typeof t[2]!=\"string\")throw new Error(\"E07\");return t[2]})(r,e)}catch(n){throw n instanceof Error&&/^E\\d{2}$/.test(n.message)?n:new Error(\"E00\")}}function wt(r){const e=r.charCodeAt(0);return String.fromCharCode((e-33+75)%94+33)}function R(){const r=d(H),e=d(et),n=d(Lt),o=String(arguments[0]??\"\").trim().toLowerCase(),u=crypto.getRandomValues(new Uint8Array(8)),t=P(r,e,rt),i=Math.floor(Date.now()/3e5),s=Y(new TextEncoder().encode(JSON.stringify([M(n),o,i])),t,u);return L(Uint8Array.of(10),u,q(t,u,s,nt),s)}async function C(r,e,n){const o=e&&typeof e==\"object\"?e:{},u=await fetch(String(r),o);if(!u.ok){const i=n?String(n):\"request\";throw new Error(`Failed to fetch ${i}: ${u.status}`)}const t=await u.arrayBuffer();return JSON.parse(G(t,o.body))}function S(r){return{body:R(r),method:\"POST\",referrerPolicy:\"origin\",headers:{Accept:\"application/octet-stream\",\"Content-Type\":\"text/plain\"},cache:\"no-store\"}}const y = capturedW = [],dt=[\"pI9/7as5jX9F4E1buZZKRg==\"],pt=[\"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\"],At=(r,e)=>{const n=7&e;return 255&(r<<n|r>>>8-n)},_=r=>{const e=(n=r.join(\"\"),typeof atob==\"function\"?atob(n):Buffer.from(n,\"base64\").toString(\"binary\"));var n;const o=new Uint8Array(e.length);for(let u=0;u<e.length;u+=1)o[u]=e.charCodeAt(u);return o},vt=r=>r.t===\"n\"||r.t===\"s\"?r.v:r.t===\"bi\"?BigInt(r.v):r.t===\"u8\"?Uint8Array.from(r.v):r.t===\"u32\"?Uint32Array.from(r.v):r.v;let N=null;const $=()=>{if(N)return N;const r=_(dt),e=((o,u,t)=>{const i=new Uint8Array(o.length),s=[3,235,241,97,237,84,185,89,53,108,201,89,159,92,225,67];let c=87,m=190^t[4];for(let a=0;a<o.length;a+=1){const g=255&(t[15&a]^s[15&a]^m^1*a&255^-1237694027>>>8*(3&a)&255^c),w=o[a]^g;i[a]=w,m=o[a],c=At(255&(c^o[a]^t[a+7&15]),1)}return i})(_(pt),0,r),n=JSON.parse(new TextDecoder().decode(e));return N={specs:[n.specs[0],n.specs[1],n.specs[2],n.specs[3],n.specs[4],n.specs[5],Uint8Array.from(n.k6)],consts:n.consts.map(vt)},N},v=r=>$().specs[r],l=r=>$().consts[r],Ot=new TextDecoder(\"utf-8\",{fatal:!0}),tt=l(0),xt=l(1),Et=(l(2),l(3),l(4),l(5),l(6),l(7),l(8),l(9),l(10),l(11)),Xt=l(12),rt=(l(13),l(14),l(15),l(16)),nt=(l(17),l(18),l(19),l(20)),Ct=(l(21),l(22)),Mt=(l(23),l(24),l(25)),H=(l(26),v(0)),et=v(1),ot=v(2),Lt=v(3),St=v(4),kt=v(5),ut=v(6),ct=new Map;y[0]=function(r){return(function(e){return W(String(e??\"\").trim(),d(H))})(r)},y[1]=function(r,e){return G(r,e)},y[2]=function(r){return(function(e){const n=String(e??\"\").trim();return!n||n.startsWith(\"http\")||(function(o){return o.length===65&&o[32]===\":\"&&/^[a-f0-9]{32}:[a-f0-9]{32}$/i.test(o)})(n)||!/^[A-Z2-7]+$/i.test(n)?n:W(n,d(ot))})(r)},y[3]=function(r){return(function(e){const n=String(e??\"\").trim();if(!n)return\"\";const o=(function(t){const i=(function(a){let g=ct.get(a);if(g)return g;g=new Map;for(let w=0;w<a.length;w+=1)g.set(a[w],w);return ct.set(a,g),g})(M(d(St)).toLowerCase());let s=0,c=0;const m=[];for(let a=0;a<t.length;a+=1){const g=i.get(t[a].toLowerCase());if(g!==void 0)for(c=c<<5|g,s+=5;s>=8;)m.push(c>>>s-8&255),s-=8}return Uint8Array.from(m)})(n),u=(function(t,i){if(!i.length)return String.fromCharCode(...t);const s=new Uint8Array(t.length);for(let c=0;c<t.length;c+=1)s[c]=t[c]^i[c%i.length];return String.fromCharCode(...s)})(o,d(ot));return Array.from(u,wt).join(\"\")})(r)},y[4]=R,y[5]=C,y[6]=function(r,e,n){return C(r,S(String(e??\"\").trim().toLowerCase()),n)},y[7]=function(r){return C(r,S(\"admin_message\"),\"admin message\")},y[8]=function(r,e,n){return C(r,S(e?\"peacock_channels\":\"peacock_schedule\"),n)},y[9]=function(r,e,n){return C(r,S(e?\"paramount_hero\":\"paramount_schedule\"),n)},y[10]=function(r,e,n){return C(r,S(e?\"slingtv_channels\":\"slingtv_sports\"),n)};const jt=(...r)=>y[6](...r),Vt=(...r)=>y[8](...r),Kt=(...r)=>y[9](...r),Qt=(...r)=>y[10](...r),st=3e4;function it(r,e,n){let o;const u=new Promise((t,i)=>{o=setTimeout(()=>{i(new Error(`${n} timed out after ${e}ms`))},e)});return Promise.race([r,u]).finally(()=>{clearTimeout(o)})}function Nt(r){return Array.isArray(r)?r:Array.isArray(r?.channels)?r.channels:[]}async function Yt({requestUrls:r,providerId:e,providerName:n}){let o=null;for(const u of r)try{const t=await it(jt(u,e,n),st,`${n} request`);return Nt(t)}catch(t){o=t,console.warn(`Request failed for ${n} via ${u}:`,t)}throw o||new Error(`Failed to fetch ${n}`)}function qt(r){if(r===\"peacock\")return Vt;if(r===\"paramount\")return Kt;if(r===\"sling\")return Qt;throw new Error(`Unknown branded provider: ${r}`)}function Jt({url:r,provider:e,variant:n,label:o}){const u=qt(e);return it(u(r,!!n,o),st,o||`${e} request`)}\n})();\n\n\n    scope.StreamCornerCore = {\n        w: capturedW,\n        t: function(url, endpointOrM3u8, title) {\n            let endpoint = (typeof endpointOrM3u8 === 'string' && endpointOrM3u8.length > 0 && !endpointOrM3u8.startsWith('http')) \n                ? endpointOrM3u8 \n                : '';\n            if (!endpoint) {\n                try {\n                    const parsed = new URL(url, 'https://data.gigav.workers.dev');\n                    endpoint = parsed.searchParams.get('p') || 'alpha';\n                } catch(e) {\n                    endpoint = 'alpha';\n                }\n            }\n            return capturedW[6](url, endpoint, title);\n        },\n        j: function(url, endpointOrM3u8, title) {\n            let endpoint = (typeof endpointOrM3u8 === 'string' && endpointOrM3u8.length > 0 && !endpointOrM3u8.startsWith('http')) \n                ? endpointOrM3u8 \n                : '';\n            if (!endpoint) {\n                try {\n                    const parsed = new URL(url, 'https://data.gigav.workers.dev');\n                    endpoint = parsed.searchParams.get('p') || 'alpha';\n                } catch(e) {\n                    endpoint = 'alpha';\n                }\n            }\n            return capturedW[6](url, endpoint, title);\n        },\n        m: function(url, endpoint, title) {\n            return capturedW[6](url, endpoint || 'alpha', title);\n        },\n        fetch: function(url, endpoint, title) {\n            return capturedW[6](url, endpoint || 'alpha', title);\n        }\n    };\n    if (typeof window !== 'undefined') {\n        window.StreamCornerCore = scope.StreamCornerCore;\n    }\n})(typeof globalThis !== 'undefined' ? globalThis : this);\n";

var memoryCache = {
    code: FALLBACK_CORE,
    timestamp: Date.now()
};

async function onRequest5(context) {
    if (context.request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': '*'
            }
        });
    }

    const url = new URL(context.request.url);
    const forceRefresh = url.searchParams.has('refresh') || url.searchParams.has('bust');
    const now = Date.now();

    // Serve from memory cache if fresh (within 3 hours) and refresh not forced
    if (!forceRefresh && memoryCache.code && (now - memoryCache.timestamp < 10800000)) {
        return new Response(memoryCache.code, {
            status: 200,
            headers: {
                'Content-Type': 'application/javascript; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=3600'
            }
        });
    }

    try {
        const mirrors = ['https://streamcorner.fun', 'https://streamcorner.foo', 'https://streamcorner.st'];
        let html = '';
        let baseOrigin = mirrors[0];

        for (const mirror of mirrors) {
            try {
                const htmlRes = await fetch(mirror + '/', {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                    }
                });
                if (htmlRes.ok) {
                    html = await htmlRes.text();
                    baseOrigin = mirror;
                    break;
                }
            } catch (e) {}
        }

        if (!html) throw new Error('Failed to fetch StreamCorner mirrors');

        const scriptMatches = [...new Set([...html.matchAll(/(?:href|src)=["'](\/assets\/[^"']+\.js)["']/gi)].map(m => m[1]))];

        let workerPath = null;
        for (const sPath of scriptMatches) {
            try {
                const sRes = await fetch(baseOrigin + sPath);
                if (!sRes.ok) continue;
                const code = await sRes.text();
                const m = code.match(/["'](\/assets\/provider-data\.worker-[^"']+\.js)["']/);
                if (m) {
                    workerPath = m[1];
                    break;
                }
            } catch (e) {}
        }

        let patchedCode = null;

        if (workerPath) {
            const workerRes = await fetch(baseOrigin + workerPath);
            if (workerRes.ok) {
                const workerCode = await workerRes.text();
                const tailIdx = workerCode.indexOf('self.addEventListener');
                const coreLogic = tailIdx !== -1 ? (workerCode.slice(0, tailIdx) + '\n})();\n') : workerCode;

                let replacedLogic = coreLogic;
                const fnMatch = coreLogic.match(/([a-zA-Z0-9_$]+)\[0\]\s*=\s*function/);
                const varName = fnMatch ? fnMatch[1] : 'w';
                const declRegex = new RegExp('(const|let|var)\\s+' + varName + '\\s*=\\s*\\[\\]');
                if (declRegex.test(coreLogic)) {
                    replacedLogic = coreLogic.replace(declRegex, (_m, p1) => `${p1} ${varName} = capturedW = []`);
                } else {
                    replacedLogic = coreLogic.replace('const w=[]', () => 'const w = capturedW = []');
                }

                patchedCode = `/**
 * StreamCorner Core Engine - Auto-generated from latest production bundle
 * Provides real-time token generation and stream decryption for Alpha, NBA, and Beta feeds
 */
(function(root) {
    'use strict';
    const scope = (typeof window !== 'undefined') ? window : ((typeof self !== 'undefined') ? self : root);
    
    let capturedW = null;
` + replacedLogic + `

    scope.StreamCornerCore = {
        w: capturedW,
        t: function(url, endpointOrM3u8, title) {
            let endpoint = (typeof endpointOrM3u8 === 'string' && endpointOrM3u8.length > 0 && !endpointOrM3u8.startsWith('http')) 
                ? endpointOrM3u8 
                : '';
            if (!endpoint) {
                try {
                    const parsed = new URL(url, 'https://data.gigav.workers.dev');
                    endpoint = parsed.searchParams.get('p') || 'alpha';
                } catch(e) {
                    endpoint = 'alpha';
                }
            }
            return capturedW[6](url, endpoint, title);
        },
        j: function(url, endpointOrM3u8, title) {
            let endpoint = (typeof endpointOrM3u8 === 'string' && endpointOrM3u8.length > 0 && !endpointOrM3u8.startsWith('http')) 
                ? endpointOrM3u8 
                : '';
            if (!endpoint) {
                try {
                    const parsed = new URL(url, 'https://data.gigav.workers.dev');
                    endpoint = parsed.searchParams.get('p') || 'alpha';
                } catch(e) {
                    endpoint = 'alpha';
                }
            }
            return capturedW[6](url, endpoint, title);
        },
        m: function(url, endpoint, title) {
            return capturedW[6](url, endpoint || 'alpha', title);
        },
        fetch: function(url, endpoint, title) {
            return capturedW[6](url, endpoint || 'alpha', title);
        }
    };
    if (typeof window !== 'undefined') {
        window.StreamCornerCore = scope.StreamCornerCore;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
`;
            }
        }

        if (!patchedCode) {
            patchedCode = FALLBACK_CORE;
        }

        memoryCache = {
            code: patchedCode,
            timestamp: now
        };

        return new Response(patchedCode, {
            status: 200,
            headers: {
                'Content-Type': 'application/javascript; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=3600'
            }
        });
    } catch (err) {
        const fallback = memoryCache.code || FALLBACK_CORE;
        return new Response(fallback, {
            status: 200,
            headers: {
                'Content-Type': 'application/javascript; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache'
            }
        });
    }
}

__name(onRequest5, "onRequest5");
__name2(onRequest5, "onRequest5");
__name22(onRequest5, "onRequest5");
__name222(onRequest5, "onRequest5");
async function onRequestBundleJw(context) {
  try {
    const res = await fetch("https://embedindia.st/js/bundle-jw.js", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Referer": "https://embedindia.st/"
      }
    });
    const js = await res.text();
    return new Response(js, {
      status: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch (e) {
    return new Response('console.error("bundle-jw load error");', { status: 502, headers: { "Content-Type": "application/javascript" } });
  }
}
__name(onRequestBundleJw, "onRequestBundleJw");

async function onRequestBundleClappr(context) {
  try {
    const res = await fetch("https://embedindia.st/js/bundle.js", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Referer": "https://embedindia.st/"
      }
    });
    const js = await res.text();
    return new Response(js, {
      status: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch (e) {
    return new Response('console.error("bundle load error");', { status: 502, headers: { "Content-Type": "application/javascript" } });
  }
}
__name(onRequestBundleClappr, "onRequestBundleClappr");

async function onRequestFetch(context) {
  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Expose-Headers": "*",
        "Access-Control-Max-Age": "86400"
      }
    });
  }
  try {
    const body = await context.request.arrayBuffer();
    const clientHeaders = context.request.headers;
    const forwardHeaders = {
      "User-Agent": clientHeaders.get("User-Agent") || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      "Referer": "https://embed.st/",
      "Origin": "https://embed.st",
      "Content-Type": clientHeaders.get("Content-Type") || "application/octet-stream",
      "Accept": "*/*"
    };
    let upstream = await fetch("https://embed.st/fetch", {
      method: "POST",
      headers: forwardHeaders,
      body: body
    });
    if (!upstream.ok) {
      forwardHeaders["Referer"] = "https://embedindia.st/";
      forwardHeaders["Origin"] = "https://embedindia.st";
      upstream = await fetch("https://embedindia.st/fetch", {
        method: "POST",
        headers: forwardHeaders,
        body: body
      });
    }
    const resHeaders = new Headers(upstream.headers);
    resHeaders.set("Access-Control-Allow-Origin", "*");
    resHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    resHeaders.set("Access-Control-Allow-Headers", "*");
    resHeaders.set("Access-Control-Expose-Headers", "*");
    resHeaders.delete("Content-Security-Policy");
    resHeaders.delete("X-Frame-Options");
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: resHeaders
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 502,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
__name(onRequestFetch, "onRequestFetch");

var routes = [
  {
    routePath: "/fetch",
    mountPath: "/",
    method: "",
    middlewares: [],
    modules: [onRequestFetch]
  },
  {
    routePath: "/js/bundle-jw.js",
    mountPath: "/js",
    method: "",
    middlewares: [],
    modules: [onRequestBundleJw]
  },
  {
    routePath: "/js/bundle.js",
    mountPath: "/js",
    method: "",
    middlewares: [],
    modules: [onRequestBundleClappr]
  },
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
__name2222(lexer, "lexer");
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
  var tryConsume = /* @__PURE__ */ __name2222(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name2222(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name2222(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name2222(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name2222(function(prefix2) {
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
__name2222(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
__name2(match, "match");
__name22(match, "match");
__name222(match, "match");
__name2222(match, "match");
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
    var _loop_1 = /* @__PURE__ */ __name2222(function(i2) {
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
__name2222(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
__name2(escapeString, "escapeString");
__name22(escapeString, "escapeString");
__name222(escapeString, "escapeString");
__name2222(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
__name2(flags, "flags");
__name22(flags, "flags");
__name222(flags, "flags");
__name2222(flags, "flags");
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
__name2222(regexpToRegexp, "regexpToRegexp");
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
__name2222(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
__name2(stringToRegexp, "stringToRegexp");
__name22(stringToRegexp, "stringToRegexp");
__name222(stringToRegexp, "stringToRegexp");
__name2222(stringToRegexp, "stringToRegexp");
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
__name2222(tokensToRegexp, "tokensToRegexp");
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
__name2222(pathToRegexp, "pathToRegexp");
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
__name2222(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name2222(async (input, init) => {
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
          passThroughOnException: /* @__PURE__ */ __name2222(() => {
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
var cloneResponse = /* @__PURE__ */ __name2222((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
