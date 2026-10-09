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

const FALLBACK_CORE = "/**\n * StreamCorner Core Engine - Auto-generated from latest production bundle\n * Provides real-time token generation and stream decryption for Alpha, NBA, and Beta feeds\n */\n(function(root) {\n    'use strict';\n    const scope = (typeof window !== 'undefined') ? window : ((typeof self !== 'undefined') ? self : root);\n    \n    let capturedW = null;\n    (function(){\"use strict\";function F(r,e){const n=7&e;return 255&(r<<n|r>>>8-n)}function O(r,e){const n=7&e;return 255&(r>>>n|r<<8-n)}function C(r){const e=new Uint8Array(r[2].length);let n=r[0];for(let o=0;o<e.length;o+=1){const i=r[5][o],t=O(F(r[2][o],7&(n^r[1]))^r[3][i]+(n^13*o&255)&255^r[1]+17*o&255,7&(r[4][o]^n));e[o]=t,n=F(n,1)^t+r[4][o]+o&255}return e}function I(r){return r>=65&&r<=90?r-65:r>=97&&r<=122?r-97:r>=50&&r<=55?r-24:-1}function ft(r){return r<26?String.fromCharCode(65+r):String.fromCharCode(50+r-26)}function yt(r,e,n){return r[e%r.length]+tt+3*n+e*kt&31}function E(r){return pt.decode(r)}function M(r,e){return E((function(n,o){if(!o.length)return Uint8Array.from(n);const i=new Uint8Array(n.length);for(let t=0;t<n.length;t+=1)i[t]=n[t]^o[t%o.length];return i})((function(n){const o=new Uint8Array(n.length);for(let i=0;i<n.length;i+=1)o[i]=n[i]+181&255;return o})((function(n){let o=0,i=0;const t=[];for(let u=0;u<n.length;u+=1){const s=I(n.charCodeAt(u));if(!(s<0))for(i=i<<5|s,o+=5;o>=8;)t.push(i>>>o-8&255),o-=8}return Uint8Array.from(t)})((function(n,o){if(!n||!o.length)return n;let i=\"\",t=tt;for(let u=0;u<n.length;u+=1){const s=I(n.charCodeAt(u));s<0?i+=n[u]:(i+=ft(s+32-yt(o,u,t)&31),t=s)}return i})(r,e))),e))}function W(r,e,n){return H(P(r,e,n))}function gt(r,e,n){const o=new Uint32Array(16),i=[1634760805,857760878,2036477234,1797285236];o[0]=i[0],o[5]=i[1],o[10]=i[2],o[15]=i[3];for(let s=0;s<4;s+=1)o[1+s]=G(r,4*s),o[11+s]=G(r,16+4*s);o[6]=G(e,0),o[7]=G(e,4),o[8]=n>>>0,o[9]=Math.floor(n/4294967296)>>>0;const t=Uint32Array.from(o);for(let s=0;s<6;s+=1)t[4]^=a(t[0]+t[12]>>>0,7),t[8]^=a(t[4]+t[0]>>>0,9),t[12]^=a(t[8]+t[4]>>>0,13),t[0]^=a(t[12]+t[8]>>>0,18),t[9]^=a(t[5]+t[1]>>>0,7),t[13]^=a(t[9]+t[5]>>>0,9),t[1]^=a(t[13]+t[9]>>>0,13),t[5]^=a(t[1]+t[13]>>>0,18),t[14]^=a(t[10]+t[6]>>>0,7),t[2]^=a(t[14]+t[10]>>>0,9),t[6]^=a(t[2]+t[14]>>>0,13),t[10]^=a(t[6]+t[2]>>>0,18),t[3]^=a(t[15]+t[11]>>>0,7),t[7]^=a(t[3]+t[15]>>>0,9),t[11]^=a(t[7]+t[3]>>>0,13),t[15]^=a(t[11]+t[7]>>>0,18),t[1]^=a(t[0]+t[3]>>>0,7),t[2]^=a(t[1]+t[0]>>>0,9),t[3]^=a(t[2]+t[1]>>>0,13),t[0]^=a(t[3]+t[2]>>>0,18),t[6]^=a(t[5]+t[4]>>>0,7),t[7]^=a(t[6]+t[5]>>>0,9),t[4]^=a(t[7]+t[6]>>>0,13),t[5]^=a(t[4]+t[7]>>>0,18),t[11]^=a(t[10]+t[9]>>>0,7),t[8]^=a(t[11]+t[10]>>>0,9),t[9]^=a(t[8]+t[11]>>>0,13),t[10]^=a(t[9]+t[8]>>>0,18),t[12]^=a(t[15]+t[14]>>>0,7),t[13]^=a(t[12]+t[15]>>>0,9),t[14]^=a(t[13]+t[12]>>>0,13),t[15]^=a(t[14]+t[13]>>>0,18);const u=new Uint8Array(64);for(let s=0;s<16;s+=1)wt(u,4*s,t[s]+o[s]>>>0);return u}function v(r,e,n){const o=new Uint8Array(r.length);for(let i=0,t=0;i<r.length;i+=64,t+=1){const u=gt(e,n,t);for(let s=0;s<64&&i+s<r.length;s+=1)o[i+s]=r[i+s]^u[s]}return o}function Q(r,e,n,o){return H(P(r,e,n,o)).subarray(0,12)}function G(r,e){return(r[e]|r[e+1]<<8|r[e+2]<<16|r[e+3]<<24)>>>0}function wt(r,e,n){r[e]=255&n,r[e+1]=n>>>8&255,r[e+2]=n>>>16&255,r[e+3]=n>>>24&255}function dt(r,e){return(r[e]<<24|r[e+1]<<16|r[e+2]<<8|r[e+3])>>>0}function L(r,e,n){r[e]=n>>>24&255,r[e+1]=n>>>16&255,r[e+2]=n>>>8&255,r[e+3]=255&n}function a(r,e){return(r<<e|r>>>32-e)>>>0}function A(r,e){return(r>>>e|r<<32-e)>>>0}function P(...r){const e=r.reduce((i,t)=>i+t.length,0),n=new Uint8Array(e);let o=0;for(const i of r)n.set(i,o),o+=i.length;return n}function H(r){const e=8n*BigInt(r.length),n=r.length+9+63&-64,o=new Uint8Array(n),i=new Uint32Array(64),t=Uint32Array.from(Bt);o.set(r),o[r.length]=128;let u=e;for(let c=0;c<8;c+=1)o[o.length-1-c]=Number(0xffn&u),u>>=8n;for(let c=0;c<o.length;c+=64){for(let f=0;f<16;f+=1)i[f]=dt(o,c+4*f);for(let f=16;f<64;f+=1){const k=A(i[f-15],7)^A(i[f-15],18)^i[f-15]>>>3,B=A(i[f-2],17)^A(i[f-2],19)^i[f-2]>>>10;i[f]=i[f-16]+k+i[f-7]+B>>>0}let g=t[0],l=t[1],y=t[2],m=t[3],d=t[4],U=t[5],p=t[6],X=t[7];for(let f=0;f<64;f+=1){const k=X+(A(d,6)^A(d,11)^A(d,25))+(d&U^~d&p)+xt[f]+i[f]>>>0,B=g&l^g&y^l&y;X=p,p=U,U=d,d=m+k>>>0,m=y,y=l,l=g,g=k+((A(g,2)^A(g,13)^A(g,22))+B>>>0)>>>0}t[0]=t[0]+g>>>0,t[1]=t[1]+l>>>0,t[2]=t[2]+y>>>0,t[3]=t[3]+m>>>0,t[4]=t[4]+d>>>0,t[5]=t[5]+U>>>0,t[6]=t[6]+p>>>0,t[7]=t[7]+X>>>0}const s=new Uint8Array(32);for(let c=0;c<8;c+=1)L(s,4*c,t[c]);return s}function D(r,e){if(r.length!==e.length)return!1;let n=0;for(let o=0;o<r.length;o+=1)n|=r[o]^e[o];return n===0}function K(r){if(r instanceof ArrayBuffer)return new Uint8Array(r);if(ArrayBuffer.isView(r))return new Uint8Array(r.buffer,r.byteOffset,r.byteLength);throw new Error(\"E05\")}function J(r,e){try{return(function(n,o){const i=(function(u){const s=new Array(256);return s[u[0]]=c=>{c[1]=F(255&(61^c[1]^c[0]),1)},s[u[9]]=c=>{c[1]=O(c[1]+39+c[0]&255,1)},s[u[10]]=c=>{c[1]=255&(c[1]^c[3][0].length^85)},s[u[11]]=c=>{const g=c[3][11];c[3][11]=c[3][10],c[3][10]=g},s[u[1]]=c=>{c[3][1]=C(b)},s[u[2]]=c=>{c[3][2]=c[3][0]},s[u[3]]=c=>{c[1]=F(255&(c[1]^c[3][0].length^107),1)},s[u[4]]=c=>{c[3][4]=c[1]^c[3][0].length^49},s[u[5]]=c=>{c[3][5]=C(et)},s[u[6]]=c=>{c[3][6]=(function(g,l,y,m){const d=K(g);if(d.length<=21||d[0]!==4)throw new Error(\"E05\");const U=(function(B,q,j){try{const Y=K(B);if(Y.length<=21||Y[0]!==10)return null;const N=Y.subarray(1,9),Kt=Y.subarray(9,21),at=Y.subarray(21),lt=W(q,j,rt);if(!D(Kt,Q(lt,N,at,nt)))return null;const x=JSON.parse(E(v(at,lt,N)));if(!Array.isArray(x)||x.length!==3||typeof x[0]!=\"string\"||typeof x[1]!=\"string\")return null;const Z=x[2];if(!Number.isSafeInteger(Z)||Z<0||Z>4294967295||Math.abs(Math.floor(Date.now()/3e5)-Z)>1)return null;const ht=new Uint8Array(4);return L(ht,0,Z),[new TextEncoder().encode(x[0]),N,new TextEncoder().encode(x[1]),ht]}catch{return null}})(l,y,m);if(!U)throw new Error(\"E09\");const p=d.subarray(1,9),X=d.subarray(9,21),f=d.subarray(21),k=(function(B,q,j){return H(P(B,q,j,Et))})(y,m,P(U[0],U[1],U[2],U[3]));if(!D(X,Q(k,p,f,Tt)))throw new Error(\"E06\");return E(v(f,k,p))})(c[3][0],c[3][7],c[3][1],c[3][5])},s[u[7]]=c=>{c[2]=c[3][6]},s[u[8]]=()=>1,s})(C(Xt)),t=[0,90,\"\",new Array(12).fill(null)];for(t[3][0]=K(n),t[3][7]=o;t[0]<it.length;){const u=it[t[0]];t[0]+=1;const s=i[u];if(!s)throw new Error(\"E00\");if(s(t)===1)break}if(typeof t[2]!=\"string\")throw new Error(\"E07\");return t[2]})(r,e)}catch(n){throw n instanceof Error&&/^E\\d{2}$/.test(n.message)?n:new Error(\"E00\")}}function mt(r){const e=r.charCodeAt(0);return String.fromCharCode((e-33+75)%94+33)}function z(){const r=C(b),e=C(et),n=C(Pt),o=String(arguments[0]??\"\").trim().toLowerCase(),i=crypto.getRandomValues(new Uint8Array(8)),t=W(r,e,rt),u=Math.floor(Date.now()/3e5),s=v(new TextEncoder().encode(JSON.stringify([E(n),o,u])),t,i);return P(Uint8Array.of(10),i,Q(t,i,s,nt),s)}async function T(r,e,n){const o=e&&typeof e==\"object\"?e:{},i=await fetch(String(r),o);if(!i.ok){const u=n?String(n):\"request\";throw new Error(`Failed to fetch ${u}: ${i.status}`)}const t=await i.arrayBuffer();return JSON.parse(J(t,o.body))}function V(r){return{body:z(r),method:\"POST\",referrerPolicy:\"origin\",headers:{Accept:\"application/octet-stream\",\"Content-Type\":\"text/plain\"},cache:\"no-store\"}}const w = capturedW = [],Ct=[\"7A68s2HJ516Yog03m8oWWw==\"],At=[\"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\",\"cxsBhl8=\"],Ut=(r,e)=>{const n=7&e;return 255&(r<<n|r>>>8-n)},_=r=>{const e=(n=r.join(\"\"),typeof atob==\"function\"?atob(n):Buffer.from(n,\"base64\").toString(\"binary\"));var n;const o=new Uint8Array(e.length);for(let i=0;i<e.length;i+=1)o[i]=e.charCodeAt(i);return o},St=r=>r.t===\"n\"||r.t===\"s\"?r.v:r.t===\"bi\"?BigInt(r.v):r.t===\"u8\"?Uint8Array.from(r.v):r.t===\"u32\"?Uint32Array.from(r.v):r.v;let R=null;const $=()=>{if(R)return R;const r=_(Ct),e=((o,i,t)=>{const u=new Uint8Array(o.length),s=[90,40,132,4,144,165,82,35,238,182,117,92,148,18,62,8];let c=246,g=194^t[3];for(let l=0;l<o.length;l+=1){const y=255&(t[15&l]^s[15&l]^g^73*l&255^-138921480>>>8*(3&l)&255^c),m=o[l]^y;u[l]=m,g=o[l],c=Ut(255&(c^o[l]^t[l+7&15]),1)}return u})(_(At),0,r),n=JSON.parse(new TextDecoder().decode(e));return R={specs:[n.specs[0],n.specs[1],n.specs[2],n.specs[3],n.specs[4],n.specs[5],Uint8Array.from(n.k6)],consts:n.consts.map(St)},R},S=r=>$().specs[r],h=r=>$().consts[r],pt=new TextDecoder(\"utf-8\",{fatal:!0}),tt=h(0),kt=h(1),Bt=(h(2),h(3),h(4),h(5),h(6),h(7),h(8),h(9),h(10),h(11)),xt=h(12),rt=(h(13),h(14),h(15),h(16)),nt=(h(17),h(18),h(19),h(20)),Tt=(h(21),h(22)),Et=(h(23),h(24),h(25)),b=(h(26),S(0)),et=S(1),ot=S(2),Pt=S(3),Vt=S(4),Xt=S(5),it=S(6),ct=new Map;w[0]=function(r){return(function(e){return M(String(e??\"\").trim(),C(b))})(r)},w[1]=function(r,e){return J(r,e)},w[2]=function(r){return(function(e){const n=String(e??\"\").trim();return!n||n.startsWith(\"http\")||(function(o){return o.length===65&&o[32]===\":\"&&/^[a-f0-9]{32}:[a-f0-9]{32}$/i.test(o)})(n)||!/^[A-Z2-7]+$/i.test(n)?n:M(n,C(ot))})(r)},w[3]=function(r){return(function(e){const n=String(e??\"\").trim();if(!n)return\"\";const o=(function(t){const u=(function(l){let y=ct.get(l);if(y)return y;y=new Map;for(let m=0;m<l.length;m+=1)y.set(l[m],m);return ct.set(l,y),y})(E(C(Vt)).toLowerCase());let s=0,c=0;const g=[];for(let l=0;l<t.length;l+=1){const y=u.get(t[l].toLowerCase());if(y!==void 0)for(c=c<<5|y,s+=5;s>=8;)g.push(c>>>s-8&255),s-=8}return Uint8Array.from(g)})(n),i=(function(t,u){if(!u.length)return String.fromCharCode(...t);const s=new Uint8Array(t.length);for(let c=0;c<t.length;c+=1)s[c]=t[c]^u[c%u.length];return String.fromCharCode(...s)})(o,C(ot));return Array.from(i,mt).join(\"\")})(r)},w[4]=z,w[5]=T,w[6]=function(r,e,n){return T(r,V(String(e??\"\").trim().toLowerCase()),n)},w[7]=function(r){return T(r,V(\"admin_message\"),\"admin message\")},w[8]=function(r,e,n){return T(r,V(e?\"peacock_channels\":\"peacock_schedule\"),n)},w[9]=function(r,e,n){return T(r,V(e?\"paramount_hero\":\"paramount_schedule\"),n)},w[10]=function(r,e,n){return T(r,V(e?\"slingtv_channels\":\"slingtv_sports\"),n)};const Yt=(...r)=>w[6](...r),Zt=(...r)=>w[8](...r),Ft=(...r)=>w[9](...r),Gt=(...r)=>w[10](...r),st=3e4;function ut(r,e,n){let o;const i=new Promise((t,u)=>{o=setTimeout(()=>{u(new Error(`${n} timed out after ${e}ms`))},e)});return Promise.race([r,i]).finally(()=>{clearTimeout(o)})}function Rt(r){return Array.isArray(r)?r:Array.isArray(r?.channels)?r.channels:[]}async function vt({requestUrls:r,providerId:e,providerName:n}){let o=null;for(const i of r)try{const t=await ut(Yt(i,e,n),st,`${n} request`);return Rt(t)}catch(t){o=t,console.warn(`Request failed for ${n} via ${i}:`,t)}throw o||new Error(`Failed to fetch ${n}`)}function Qt(r){if(r===\"peacock\")return Zt;if(r===\"paramount\")return Ft;if(r===\"sling\")return Gt;throw new Error(`Unknown branded provider: ${r}`)}function Ht({url:r,provider:e,variant:n,label:o}){const i=Qt(e);return ut(i(r,!!n,o),st,o||`${e} request`)}\n})();\n\n\n    scope.StreamCornerCore = {\n        w: capturedW,\n        t: function(url, endpointOrM3u8, title) {\n            let endpoint = (typeof endpointOrM3u8 === 'string' && endpointOrM3u8.length > 0 && !endpointOrM3u8.startsWith('http')) \n                ? endpointOrM3u8 \n                : '';\n            if (!endpoint) {\n                try {\n                    const parsed = new URL(url, 'https://data.gigav.workers.dev');\n                    endpoint = parsed.searchParams.get('p') || 'alpha';\n                } catch(e) {\n                    endpoint = 'alpha';\n                }\n            }\n            return capturedW[6](url, endpoint, title);\n        },\n        j: function(url, endpointOrM3u8, title) {\n            let endpoint = (typeof endpointOrM3u8 === 'string' && endpointOrM3u8.length > 0 && !endpointOrM3u8.startsWith('http')) \n                ? endpointOrM3u8 \n                : '';\n            if (!endpoint) {\n                try {\n                    const parsed = new URL(url, 'https://data.gigav.workers.dev');\n                    endpoint = parsed.searchParams.get('p') || 'alpha';\n                } catch(e) {\n                    endpoint = 'alpha';\n                }\n            }\n            return capturedW[6](url, endpoint, title);\n        },\n        m: function(url, endpoint, title) {\n            return capturedW[6](url, endpoint || 'alpha', title);\n        },\n        fetch: function(url, endpoint, title) {\n            return capturedW[6](url, endpoint || 'alpha', title);\n        }\n    };\n})(typeof globalThis !== 'undefined' ? globalThis : this);\n";

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
        const mirrors = ['https://streamcorner.foo', 'https://streamcorner.fun'];
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

                patchedCode = `/**
 * StreamCorner Core Engine - Auto-generated from latest production bundle
 * Provides real-time token generation and stream decryption for Alpha, NBA, and Beta feeds
 */
(function(root) {
    'use strict';
    const scope = (typeof window !== 'undefined') ? window : ((typeof self !== 'undefined') ? self : root);
    
    let capturedW = null;
    ${coreLogic.replace('const w=[]', 'const w = capturedW = []')}

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
