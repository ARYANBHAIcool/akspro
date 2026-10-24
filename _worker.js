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
  return new Response("Not Found", { status: 404 });
  const search = url.search;
  
  try {
    const response = await fetch(targetUrl, {
      method: context.request.method,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        
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
  if (!targetUrl || targetUrl.includes("example.com") || targetUrl.includes("example.org")) {
    const errorHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><style>body{margin:0;background:#060a12;color:#94a3b8;font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center}.box{padding:24px;max-width:360px;border:1px solid #1e293b;border-radius:16px;background:#0c1322}.icon{font-size:32px;margin-bottom:8px}h3{color:#f8fafc;font-size:15px;margin:0 0 6px 0;font-weight:800}p{font-size:12px;margin:0;line-height:1.5;color:#64748b}</style></head><body><div class="box"><div class="icon">📡</div><h3>Broadcast Feed Unavailable</h3><p>Please switch to another server or reload the player.</p></div></body></html>`;
    return new Response(errorHtml, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
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
                           parsedTarget.origin.includes("streamcorner") ||
                           parsedTarget.origin.includes("embed.st");
    const upstreamHeaders = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      "Referer": isStreamCorner ? "https://streamcorner.cloud/" : `${parsedTarget.origin}/`,
      "Origin": isStreamCorner ? "https://streamcorner.cloud" : parsedTarget.origin,
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

    // 1. Bitmovin & DOM removeChild / insertBefore protective wrapper
    try {
        var origRemoveChild = Node.prototype.removeChild;
        Node.prototype.removeChild = function(child) {
            if (!child) return child;
            if (child.parentNode !== this) {
                return child;
            }
            try {
                return origRemoveChild.call(this, child);
            } catch(e) {
                return child;
            }
        };

        var origInsertBefore = Node.prototype.insertBefore;
        Node.prototype.insertBefore = function(newNode, referenceNode) {
            if (!newNode) return newNode;
            try {
                return origInsertBefore.call(this, newNode, referenceNode);
            } catch(e) {
                return newNode;
            }
        };
    } catch (e) {}

    // 2. Third-party script error silencer for null.appendChild / removeChild
    window.addEventListener('error', function(e) {
        if (e.message && (e.message.indexOf('appendChild') !== -1 || e.message.indexOf('removeChild') !== -1 || e.message.indexOf('insertBefore') !== -1)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            return true;
        }
    }, true);

    // 3. Purge third-party VPN promotional popups and ad overlays
    function purgePromoOverlays() {
        var elements = document.querySelectorAll('div, section, aside, a, p, span');
        for (var i = 0; i < elements.length; i++) {
            var el = elements[i];
            if (el.id === 'loading-overlay' || el.id === 'loading-message' || el.closest('#loading-overlay') || el.closest('.bmpui-ui-container')) continue;
            var text = (el.innerText || el.textContent || '').trim().toLowerCase();
            if (text.includes('vpn') && (text.includes('learn more') || text.includes('hide') || text.includes('protect your privacy') || text.includes('recommended'))) {
                el.style.setProperty('display', 'none', 'important');
                el.style.setProperty('visibility', 'hidden', 'important');
                el.style.setProperty('pointer-events', 'none', 'important');
                try { el.remove(); } catch(err) {}
            }
        }
    }
    setInterval(purgePromoOverlays, 300);

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
/* Block third-party VPN promotional popups, ad overlays, and intrusive modals */
[class*="vpn"], [id*="vpn"],
[class*="popup"], [id*="popup"]:not(#player-modal),
[class*="promo"], [id*="promo"],
[class*="banner-ad"], [id*="banner-ad"],
.ad-overlay, .advertisement {
    display: none !important;
    opacity: 0 !important;
    visibility: hidden !important;
    pointer-events: none !important;
}

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

    // Neutralize Cloudflare Turnstile / Challenge platform script which blocks sandboxed iframes
    html = html.replace(/<script[^>]*__CF\$cv\$params[\s\S]*?<\/script>/gi, "<!-- cf challenge removed -->");
    html = html.replace(/<script[^>]*\/cdn-cgi\/challenge-platform\/[^>]*><\/script>/gi, "<!-- cf challenge removed -->");

    // Neutralize anti-framing and domain guard checks in StreamCorner admin/fubo/peacock players
    html = html.replace(/function\s+G\s*\(\)\s*\{return\s+[a-zA-Z0-9_$]+\(\)\|\|[a-zA-Z0-9_$]+\(\)\}/g, "function G(){return true;}");
    html = html.replace(/function\s*\(\)\s*\{return\s+[a-zA-Z0-9_$]+\(\)\|\|[a-zA-Z0-9_$]+\(\)\}/g, "function(){return true;}");
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
      "Origin": "https://streamcorner.cloud",
      "Referer": "https://streamcorner.cloud/",
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
      "https://streamed.pk/api/matches/all"
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
  if (reqUrl.pathname.includes('/api/futbolx') || endpointParam === "futbolx" || endpointParam === "fx") {
    const isTokenReq = reqUrl.searchParams.get("token") === "1" || reqUrl.searchParams.has("path");
    if (isTokenReq) {
      let streamUrl = reqUrl.searchParams.get("url") || "";
      let path = reqUrl.searchParams.get("path") || "";
      let sourceHost = reqUrl.searchParams.get("sourceHost") || "";
      if (streamUrl && !path) {
        try {
          const u = new URL(streamUrl);
          path = u.pathname;
          sourceHost = u.hostname;
        } catch (e) {}
      }
      if (path && sourceHost) {
        try {
          const tokenApiUrl = "https://www.futbol-x.xyz/api/token.js?path=" + encodeURIComponent(path) + "&sourceHost=" + encodeURIComponent(sourceHost) + "&expires=900";
          const tResp = await fetch(tokenApiUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
              "Referer": "https://www.futbol-x.xyz/"
            }
          });
          if (tResp.ok) {
            const data = await tResp.json();
            return new Response(JSON.stringify(data), {
              status: 200,
              headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=300"
              }
            });
          }
        } catch (e) {}
      }
      return new Response(JSON.stringify({ success: false, error: "Token generation failed" }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" }
      });
    }

    try {
      const streamRes = await fetch("https://www.futbol-x.xyz/api/stream", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
          "Referer": "https://www.futbol-x.xyz/"
        }
      });
      if (streamRes.ok) {
        const { categories } = await streamRes.json();
        const validCats = Array.isArray(categories) ? categories.filter(c => typeof c === "string" && c.trim().length > 0) : [];
        const now = Date.now();
        const catPromises = validCats.map(async cat => {
          try {
            const cResp = await fetch("https://www.futbol-x.xyz/api/" + cat + ".json", {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
                "Referer": "https://www.futbol-x.xyz/"
              }
            });
            if (!cResp.ok) return [];
            const cData = await cResp.json();
            const events = [];
            if (cData && Array.isArray(cData.streams)) {
              for (const group of cData.streams) {
                if (group && Array.isArray(group.streams)) {
                  for (const ev of group.streams) {
                    if (!ev || !ev.name) continue;
                    const titleLower = (ev.name || '').toLowerCase();
                    if ((titleLower.includes('wolves') || titleLower.includes('wolverhampton')) && (titleLower.includes('pompey') || titleLower.includes('portsmouth'))) continue;
                    if (titleLower.includes('diriyah') && titleLower.includes('riyadh')) continue;
                    const start = ev.starts_at ? new Date(ev.starts_at).getTime() : 0;
                    const end = ev.ends_at ? new Date(ev.ends_at).getTime() : (start ? start + 10800000 : 0);
                    if (end > 0 && now > (end + 1800000) && !ev.always_live) continue;

                    const activeStreams = (ev.streams || []).filter(s => s && s.url && s.url.trim().length > 0 && !s.url.includes('placeholder'));
                    if (activeStreams.length === 0) continue;
                    events.push({
                      id: "fx-" + (ev.uri_name || Math.random().toString(36).slice(2, 8)),
                      uri_name: ev.uri_name,
                      title: (ev.name || "").trim(),
                      tag: (ev.tag || "").trim(),
                      category: cat,
                      poster: ev.poster || "",
                      starts_at: ev.starts_at || "",
                      ends_at: ev.ends_at || "",
                      always_live: ev.always_live || 0,
                      streams: activeStreams
                    });
                  }
                }
              }
            }
            return events;
          } catch (e) {
            return [];
          }
        });
        const allResults = await Promise.all(catPromises);
        const matches = allResults.flat();
        return new Response(JSON.stringify({ success: true, count: matches.length, matches }), {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=60, s-maxage=60"
          }
        });
      }
    } catch (e) {}
  }
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
  return new Response(JSON.stringify({ success: true, streams: [] }), { status: 200,
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
 * Automatically probes https://streamcorner.cloud/ for the latest bundle,
 * extracts the active crypto decryption worker/routine, patches window.StreamCornerCore,
 * and caches it on the edge.
 */

const FALLBACK_CORE = "/**\n * StreamCorner Core Engine - Auto-generated from latest production bundle\n * Provides real-time token generation and stream decryption for Alpha, NBA, and Beta feeds\n */\n(function(root) {\n    'use strict';\n    const scope = (typeof window !== 'undefined') ? window : ((typeof self !== 'undefined') ? self : root);\n    \n    let capturedW = null;\n(function(){\"use strict\";function M(o,g){const O=7&g;return 255&(o<<O|o>>>8-O)}function b(o,g){const O=7&g;return 255&(o>>>O|o<<8-O)}function G(o){const g=new Uint8Array(o[2].length);let O=o[0];for(let I=0;I<g.length;I+=1){const j=o[5][I],A=b(M(o[2][I],7&(O^o[1]))^o[3][j]+(O^13*I&255)&255^o[1]+17*I&255,7&(o[4][I]^O));g[I]=A,O=M(O,1)^A+o[4][I]+I&255}return g}function Z(o){return o>=65&&o<=90?o-65:o>=97&&o<=122?o-97:o>=50&&o<=55?o-24:-1}function LA(o){return o<26?String.fromCharCode(65+o):String.fromCharCode(50+o-26)}function GA(o,g,O){return o[g%o.length]+jA+3*O+g*HA&31}function q(o){return qA.decode(o)}function P(o,g){return q((function(O,I){if(!I.length)return Uint8Array.from(O);const j=new Uint8Array(O.length);for(let A=0;A<O.length;A+=1)j[A]=O[A]^I[A%I.length];return j})((function(O){const I=new Uint8Array(O.length);for(let j=0;j<O.length;j+=1)I[j]=O[j]+181&255;return I})((function(O){let I=0,j=0;const A=[];for(let C=0;C<O.length;C+=1){const E=Z(O.charCodeAt(C));if(!(E<0))for(j=j<<5|E,I+=5;I>=8;)A.push(j>>>I-8&255),I-=8}return Uint8Array.from(A)})((function(O,I){if(!O||!I.length)return O;let j=\"\",A=jA;for(let C=0;C<O.length;C+=1){const E=Z(O.charCodeAt(C));E<0?j+=O[C]:(j+=LA(E+32-GA(I,C,A)&31),A=E)}return j})(o,g))),g))}function V(o,g,O){return u(c(o,g,O))}function yA(o,g,O){const I=new Uint32Array(16),j=[1634760805,857760878,2036477234,1797285236];I[0]=j[0],I[5]=j[1],I[10]=j[2],I[15]=j[3];for(let E=0;E<4;E+=1)I[1+E]=z(o,4*E),I[11+E]=z(o,16+4*E);I[6]=z(g,0),I[7]=z(g,4),I[8]=O>>>0,I[9]=Math.floor(O/4294967296)>>>0;const A=Uint32Array.from(I);for(let E=0;E<6;E+=1)A[4]^=n(A[0]+A[12]>>>0,7),A[8]^=n(A[4]+A[0]>>>0,9),A[12]^=n(A[8]+A[4]>>>0,13),A[0]^=n(A[12]+A[8]>>>0,18),A[9]^=n(A[5]+A[1]>>>0,7),A[13]^=n(A[9]+A[5]>>>0,9),A[1]^=n(A[13]+A[9]>>>0,13),A[5]^=n(A[1]+A[13]>>>0,18),A[14]^=n(A[10]+A[6]>>>0,7),A[2]^=n(A[14]+A[10]>>>0,9),A[6]^=n(A[2]+A[14]>>>0,13),A[10]^=n(A[6]+A[2]>>>0,18),A[3]^=n(A[15]+A[11]>>>0,7),A[7]^=n(A[3]+A[15]>>>0,9),A[11]^=n(A[7]+A[3]>>>0,13),A[15]^=n(A[11]+A[7]>>>0,18),A[1]^=n(A[0]+A[3]>>>0,7),A[2]^=n(A[1]+A[0]>>>0,9),A[3]^=n(A[2]+A[1]>>>0,13),A[0]^=n(A[3]+A[2]>>>0,18),A[6]^=n(A[5]+A[4]>>>0,7),A[7]^=n(A[6]+A[5]>>>0,9),A[4]^=n(A[7]+A[6]>>>0,13),A[5]^=n(A[4]+A[7]>>>0,18),A[11]^=n(A[10]+A[9]>>>0,7),A[8]^=n(A[11]+A[10]>>>0,9),A[9]^=n(A[8]+A[11]>>>0,13),A[10]^=n(A[9]+A[8]>>>0,18),A[12]^=n(A[15]+A[14]>>>0,7),A[13]^=n(A[12]+A[15]>>>0,9),A[14]^=n(A[13]+A[12]>>>0,13),A[15]^=n(A[14]+A[13]>>>0,18);const C=new Uint8Array(64);for(let E=0;E<16;E+=1)cA(C,4*E,A[E]+I[E]>>>0);return C}function v(o,g,O){const I=new Uint8Array(o.length);for(let j=0,A=0;j<o.length;j+=64,A+=1){const C=yA(g,O,A);for(let E=0;E<64&&j+E<o.length;E+=1)I[j+E]=o[j+E]^C[E]}return I}function Y(o,g,O,I){return u(c(o,g,O,I)).subarray(0,12)}function _(o,g,O,I,j){if(o.length>16777232||O.length!==32||g.length!==m)throw new Error(\"E20\");N||(N=new WebAssembly.Instance(new WebAssembly.Module((function(Q){if(typeof atob==\"function\"){const D=atob(Q),s=new Uint8Array(D.length);for(let i=0;i<D.length;i+=1)s[i]=D.charCodeAt(i);return s}return Uint8Array.from(Buffer.from(Q,\"base64\"))})(\"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DBwLIAAoAgAgAEEQay0AADoAACAAQSBrIQAgAUEBaiEBDBsLIAAgACgCADoAACABQQFqIQEMGgsgAEEQayICIAAoAgAgAigCAGo2AgAgAUEBaiEBIAIhAAwZCyAAQRBrIgIgACgCACACKAIAajYCACABQQFqIQEgAiEADBgLIABBEGsiAiACKAIAIAAoAgBsNgIAIAFBAWohASACIQAMFwsgAEEQayICIAAoAgAgAigCAGo2AgAgAUEBaiEBIAIhAAwWCyABQQFqIQEMFQsgACgCACAAQRBrKAIANgIAIABBIGshACABQQFqIQEMFAsgACgCACAAQRBrKAIANgIAIABBIGshACABQQFqIQEMEwsCQAJAAkACQAJAAkACQAJAIAEoAgFBAWsOBwMFAAEEAgYHCyAGKAKgAyEIIAYoAqQDIQkgBigCqAMhAyAGKAKsAyEEIAYoArADIQsgBigCtAMhCiAGKAK4AyEHQQAhBSMAQfAAayICJAAgAkGICSkAADcDOCACQYAJKQAANwMwIAIgAykAADcDQCACIAMpAAg3A0ggAiADKQAQNwNQIAIgAykAGDcDWCACIAQpAAA3A2AgAiAEKQAINwNoIAJBMGogAkEwahAGIAIgAikDODcDECACIAIpAzA3AwggAiACKQNgNwMYIAIgAikDaDcDIANAIAJBMGogBWoiA0EAOgAAIANBADoAASADQQA6AAIgA0EAOgADIANBADoABCADQQA6AAUgA0EAOgAGIANBADoAByAFQQhqIgVBwABHDQALIAIgBC0AEDoAKCACIAQtABE6ACkgAiAELQASOgAqIAIgBC0AEzoAKyACIAQtABQ6ACwgAiAELQAVOgAtIAIgBC0AFjoALiAELQAXIQMgAkIANwMAIAIgAzoALyMAQbABayIEJAAgBEEQakEAQcAAIAJBCGoiAyACQShqIgUgAikDACIMEAcgBCAHrTcDqAEgBELBADcDoAEgBEEANgKcASAEQgA3ApQBIARCADcCjAEgBEEANgJoIAQgBCgCIDYCfCAEIAQpAiQ3AoABIAQgBCgCLDYCiAEgBCAEKAIcQfz///8AcTYCeCAEIAQoAhhB/P///wBxNgJ0IAQgBCgCFEH8////AHE2AnAgBCAEKAIQQf////8AcTYCbCAEQdgAaiALQcEAEAggBEHYAGpBgAhBDxAIIARB2ABqIAogBxAIIARB2ABqQYAIQQAgB2tBD3EQCCAEQdgAaiAEQaABakEQEAggBEHYAGogBBAKIAQpAwggCSkACIUgBCkDACAJKQAAhYQiDUIgiCANQv////8Pg4RCAX1CIIinQQFxQQFrIglFBEAgCCAKIAcgAyAFIAxCAXwQByADIAQpA0g3AxggAyAEKQNANwMQIAMgBCkDODcDCCADIAQpAzA3AwALQQAhAwNAIARBEGogA2oiB0EAOgAAIAdBADoAASAHQQA6AAIgB0EAOgADIAdBADoABCAHQQA6AAUgB0EAOgAGIAdBADoAByADQQhqIgNBwABHDQALIARBADoAACAEQQA6AAEgBEEAOgACIARBADoAAyAEQQA6AAQgBEEAOgAFIARBADoABiAEQQA6AAcgBEEAOgAIIARBADoACSAEQQA6AAogBEEAOgALIARBADoADCAEQQA6AA0gBEEAOgAOIARBADoADyAEQbABaiQAIAkhAyACQQA6AAAgAkEAOgABIAJBADoAAiACQQA6AAMgAkEAOgAEIAJBADoABSACQQA6AAYgAkEAOgAHIAJBADoACCACQQA6AAkgAkEAOgAKIAJBADoACyACQQA6AAwgAkEAOgANIAJBADoADiACQQA6AA8gAkEAOgAQIAJBADoAESACQQA6ABIgAkEAOgATIAJBADoAFCACQQA6ABUgAkEAOgAWIAJBADoAFyACQQA6ABggAkEAOgAZIAJBADoAGiACQQA6ABsgAkEAOgAcIAJBADoAHSACQQA6AB4gAkEAOgAfIAJBADoAICACQQA6ACEgAkEAOgAiIAJBADoAIyACQQA6ACQgAkEAOgAlIAJBADoAJiACQQA6ACcgAkEAOgAoIAJBADoAKSACQQA6ACogAkEAOgArIAJBADoALCACQQA6AC0gAkEAOgAuIAJBADoALyACQfAAaiQAIAYgAzYCvAMMBgsgBigCwAMhCCAGKALEAyEJIAYoAsgDIQMgBigCzAMhBCAGKALQAyELIAYoAtQDIQogBigC2AMhB0EAIQUjAEHwAGsiAiQAIAJBiAkpAAA3AzggAkGACSkAADcDMCACIAMpAAA3A0AgAiADKQAINwNIIAIgAykAEDcDUCACIAMpABg3A1ggAiAEKQAANwNgIAIgBCkACDcDaCACQTBqIAJBMGoQBiACIAIpAzg3AxAgAiACKQMwNwMIIAIgAikDYDcDGCACIAIpA2g3AyADQCACQTBqIAVqIgNBADoAACADQQA6AAEgA0EAOgACIANBADoAAyADQQA6AAQgA0EAOgAFIANBADoABiADQQA6AAcgBUEIaiIFQcAARw0ACyACIAQtABA6ACggAiAELQAROgApIAIgBC0AEjoAKiACIAQtABM6ACsgAiAELQAUOgAsIAIgBC0AFToALSACIAQtABY6AC4gBC0AFyEDIAJCADcDACACIAM6AC8jAEGgAWsiBCQAIARBAEHAACACQQhqIgMgAkEoaiIFIAIpAwAiDBAHIAggCiAHIAMgBSAMQgF8EAcgBCAHrTcDmAEgBELBADcDkAEgBEEANgKMASAEQgA3AoQBIARCADcCfCAEQQA2AlggBCAEKAIQNgJsIAQgBCkCFDcCcCAEIAQoAhw2AnggBCAEKAIMQfz///8AcTYCaCAEIAQoAghB/P///wBxNgJkIAQgBCgCBEH8////AHE2AmAgBCAEKAIAQf////8AcTYCXCAEQcgAaiALQcEAEAggBEHIAGpBgAhBDxAIIARByABqIAggBxAIIARByABqQYAIQQAgB2tBD3EQCCAEQcgAaiAEQZABakEQEAggBEHIAGogCRAKIAIgBCkDODcDICACIAQpAzA3AxggAiAEKQMoNwMQIAIgBCkDIDcDCEEAIQcDQCAEIAdqIgNBADoAACADQQA6AAEgA0EAOgACIANBADoAAyADQQA6AAQgA0EAOgAFIANBADoABiADQQA6AAcgB0EIaiIHQcAARw0ACyAEQaABaiQAIAJBADoAACACQQA6AAEgAkEAOgACIAJBADoAAyACQQA6AAQgAkEAOgAFIAJBADoABiACQQA6AAcgAkEAOgAIIAJBADoACSACQQA6AAogAkEAOgALIAJBADoADCACQQA6AA0gAkEAOgAOIAJBADoADyACQQA6ABAgAkEAOgARIAJBADoAEiACQQA6ABMgAkEAOgAUIAJBADoAFSACQQA6ABYgAkEAOgAXIAJBADoAGCACQQA6ABkgAkEAOgAaIAJBADoAGyACQQA6ABwgAkEAOgAdIAJBADoAHiACQQA6AB8gAkEAOgAgIAJBADoAISACQQA6ACIgAkEAOgAjIAJBADoAJCACQQA6ACUgAkEAOgAmIAJBADoAJyACQQA6ACggAkEAOgApIAJBADoAKiACQQA6ACsgAkEAOgAsIAJBADoALSACQQA6AC4gAkEAOgAvIAJB8ABqJAAMBQsgBigC4AMiAkEAOgAAIAJBADoAASACQQA6AAIgAkEAOgADIAJBADoABCACQQA6AAUgAkEAOgAGIAJBADoAByACQQA6AAggAkEAOgAJIAJBADoACiACQQA6AAsgAkEAOgAMIAJBADoADSACQQA6AA4gAkEAOgAPIAJBADoAECACQQA6ABEgAkEAOgASIAJBADoAEyACQQA6ABQgAkEAOgAVIAJBADoAFiACQQA6ABcgAkEAOgAYIAJBADoAGSACQQA6ABogAkEAOgAbIAJBADoAHCACQQA6AB0gAkEAOgAeIAJBADoAHyACQQA6ACAgAkEAOgAhIAJBADoAIiACQQA6ACMgAkEAOgAkIAJBADoAJSACQQA6ACYgAkEAOgAnIAJBADoAKCACQQA6ACkgAkEAOgAqIAJBADoAKyACQQA6ACwgAkEAOgAtIAJBADoALiACQQA6AC8gAkEAOgAwIAJBADoAMSACQQA6ADIgAkEAOgAzIAJBADoANCACQQA6ADUgAkEAOgA2IAJBADoANyACQQA6ADggAkEAOgA5IAJBADoAOiACQQA6ADsgAkEAOgA8IAJBADoAPSACQQA6AD4gAkEAOgA/IAJBADoAQAwECyAGKAKsAiAGKALQAhADDAMLIAYoAtwDIgJBADoAACACQQA6AAEgAkEAOgACIAJBADoAAyACQQA6AAQgAkEAOgAFIAJBADoABiACQQA6AAcgAkEAOgAIIAJBADoACSACQQA6AAogAkEAOgALIAJBADoADCACQQA6AA0gAkEAOgAOIAJBADoADyACQQA6ABAgAkEAOgARIAJBADoAEiACQQA6ABMgAkEAOgAUIAJBADoAFSACQQA6ABYgAkEAOgAXIAJBADoAGCACQQA6ABkgAkEAOgAaIAJBADoAGyACQQA6ABwgAkEAOgAdIAJBADoAHiACQQA6AB8MAgsgBigC1AJBBBADDAELIAYoAugDIghFDQAgBigC5AMhAkEAIQQgCCIDQQdxIgUEQANAIAJBADoAACACQQFqIQIgA0EBayEDIARBAWoiBCAFRw0ACwsgCEEISQ0AA0AgAkEAOgAAIAJBADoAASACQQA6AAIg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\")),{env:{emscripten_notify_memory_growth(){}},wasi_snapshot_preview1:{proc_exit(){throw new Error(\"E20\")}}}).exports,N._initialize?.());const A=N,C=new Uint8Array(56+o.length);C.set(g),C.set(O,24),C.set(o,56);const E=Math.max(1,o.length+(j?-16:16));let B=0,r=0;try{if(B=A[rA](C.length)>>>0,r=A[rA](E)>>>0,!B||!r)throw new Error(\"E20\");new Uint8Array(A.memory.buffer).set(C,B);const Q=A[UA](B,C.length,r,E,I,j);if(Q<0)throw new Error(\"E21\");return new Uint8Array(A.memory.buffer,r,Q).slice()}finally{B&&A[DA](B,C.length),r&&A[DA](r,E),C.fill(0)}}function $(o,g,O=new Uint8Array(32)){const I=m,j=20+I;if(o.length<j||!H(o.subarray(0,4),a[3*g]))throw new Error(\"E21\");const A=4,C=4+I,E=o.subarray(A,A+I);return _(c(o.subarray(C,C+16),o.subarray(j)),E,O,g,1)}function z(o,g){return(o[g]|o[g+1]<<8|o[g+2]<<16|o[g+3]<<24)>>>0}function cA(o,g,O){o[g]=255&O,o[g+1]=O>>>8&255,o[g+2]=O>>>16&255,o[g+3]=O>>>24&255}function wA(o,g){return(o[g]<<24|o[g+1]<<16|o[g+2]<<8|o[g+3])>>>0}function AA(o,g,O){o[g]=O>>>24&255,o[g+1]=O>>>16&255,o[g+2]=O>>>8&255,o[g+3]=255&O}function n(o,g){return(o<<g|o>>>32-g)>>>0}function y(o,g){return(o>>>g|o<<32-g)>>>0}function c(...o){const g=o.reduce((j,A)=>j+A.length,0),O=new Uint8Array(g);let I=0;for(const j of o)O.set(j,I),I+=j.length;return O}function u(o){const g=8n*BigInt(o.length),O=o.length+9+63&-64,I=new Uint8Array(O),j=new Uint32Array(64),A=Uint32Array.from(kA);I.set(o),I[o.length]=128;let C=g;for(let B=0;B<8;B+=1)I[I.length-1-B]=Number(0xffn&C),C>>=8n;for(let B=0;B<I.length;B+=64){for(let t=0;t<16;t+=1)j[t]=wA(I,B+4*t);for(let t=16;t<64;t+=1){const p=y(j[t-15],7)^y(j[t-15],18)^j[t-15]>>>3,f=y(j[t-2],17)^y(j[t-2],19)^j[t-2]>>>10;j[t]=j[t-16]+p+j[t-7]+f>>>0}let r=A[0],Q=A[1],D=A[2],s=A[3],i=A[4],L=A[5],S=A[6],x=A[7];for(let t=0;t<64;t+=1){const p=x+(y(i,6)^y(i,11)^y(i,25))+(i&L^~i&S)+xA[t]+j[t]>>>0,f=r&Q^r&D^Q&D;x=S,S=L,L=i,i=s+p>>>0,s=D,D=Q,Q=r,r=p+((y(r,2)^y(r,13)^y(r,22))+f>>>0)>>>0}A[0]=A[0]+r>>>0,A[1]=A[1]+Q>>>0,A[2]=A[2]+D>>>0,A[3]=A[3]+s>>>0,A[4]=A[4]+i>>>0,A[5]=A[5]+L>>>0,A[6]=A[6]+S>>>0,A[7]=A[7]+x>>>0}const E=new Uint8Array(32);for(let B=0;B<8;B+=1)AA(E,4*B,A[B]);return E}function H(o,g){if(o.length!==g.length)return!1;let O=0;for(let I=0;I<o.length;I+=1)O|=o[I]^g[I];return O===0}function U(o){if(o instanceof ArrayBuffer)return new Uint8Array(o);if(ArrayBuffer.isView(o))return new Uint8Array(o.buffer,o.byteOffset,o.byteLength);throw new Error(\"E05\")}function oA(o,g){try{return(function(O,I){const j=(function(C){const E=new Array(256);return E[C[0]]=B=>{B[1]=M(255&(61^B[1]^B[0]),1)},E[C[9]]=B=>{B[1]=b(B[1]+39+B[0]&255,1)},E[C[10]]=B=>{B[1]=255&(B[1]^B[3][0].length^85)},E[C[11]]=B=>{const r=B[3][11];B[3][11]=B[3][10],B[3][10]=r},E[C[1]]=B=>{B[3][1]=G(X)},E[C[2]]=B=>{B[3][2]=B[3][0]},E[C[3]]=B=>{B[1]=M(255&(B[1]^B[3][0].length^107),1)},E[C[4]]=B=>{B[3][4]=B[1]^B[3][0].length^49},E[C[5]]=B=>{B[3][5]=G(CA)},E[C[6]]=B=>{B[3][6]=(function(r,Q,D,s){const i=$(U(r),1,u(U(Q)));if(i.length<=24||!H(i.subarray(0,4),a[3]))throw new Error(\"E05\");const L=(function(f,T,d){try{const R=$(U(f),0);if(R.length<=24||!H(R.subarray(0,4),a[0]))return null;const W=R.subarray(a[1],a[1]+8),WA=R.subarray(a[2],a[2]+12),sA=R.subarray(24),hA=V(T,d,BA);if(!H(WA,Y(hA,W,sA,EA)))return null;const K=JSON.parse(q(v(sA,hA,W)));if(!Array.isArray(K)||K.length!==3||typeof K[0]!=\"string\"||typeof K[1]!=\"string\")return null;const l=K[2];if(!Number.isSafeInteger(l)||l<0||l>4294967295||Math.abs(Math.floor(Date.now()/3e5)-l)>1)return null;const aA=new Uint8Array(4);return AA(aA,0,l),[new TextEncoder().encode(K[0]),W,new TextEncoder().encode(K[1]),aA]}catch{return null}})(Q,D,s);if(!L)throw new Error(\"E09\");const S=i.subarray(a[4],a[4]+8),x=i.subarray(a[5],a[5]+12),t=i.subarray(24),p=(function(f,T,d){return u(c(f,T,d,lA))})(D,s,c(L[0],L[1],L[2],L[3]));if(!H(x,Y(p,S,t,RA)))throw new Error(\"E06\");return q(v(t,p,S))})(B[3][0],B[3][7],B[3][1],B[3][5])},E[C[7]]=B=>{B[2]=B[3][6]},E[C[8]]=()=>1,E})(G(uA)),A=[0,90,\"\",new Array(12).fill(null)];for(A[3][0]=U(O),A[3][7]=I;A[0]<nA.length;){const C=nA[A[0]];A[0]+=1;const E=j[C];if(!E)throw new Error(\"E00\");if(E(A)===1)break}if(typeof A[2]!=\"string\")throw new Error(\"E07\");return A[2]})(o,g)}catch(O){throw O instanceof Error&&/^E\\d{2}$/.test(O.message)?O:new Error(\"E00\")}}function SA(o){const g=o.charCodeAt(0);return String.fromCharCode((g-33+75)%94+33)}function OA(){const o=G(X),g=G(CA),O=G(MA),I=String(arguments[0]??\"\").trim().toLowerCase(),j=crypto.getRandomValues(new Uint8Array(8)),A=V(o,g,BA),C=Math.floor(Date.now()/3e5),E=v(new TextEncoder().encode(JSON.stringify([q(O),I,C])),A,j),B=Y(A,j,E,EA);return(function(r,Q,D=new Uint8Array(32)){const s=crypto.getRandomValues(new Uint8Array(m)),i=_(r,s,D,Q,0),L=i.subarray(0,16);return c(Uint8Array.from(a[3*Q]),s,L,i.subarray(16))})(c(Uint8Array.from(a[0]),a[1]===4?j:B,a[1]===4?B:j,E),0)}async function F(o,g,O){const I=g&&typeof g==\"object\"?g:{},j=await fetch(String(o),I);if(!j.ok){const C=O?String(O):\"request\";throw new Error(`Failed to fetch ${C}: ${j.status}`)}const A=await j.arrayBuffer();return JSON.parse(oA(A,I.body))}function k(o){return{body:OA(o),method:\"POST\",referrerPolicy:\"origin\",headers:{Accept:\"application/octet-stream\",\"Content-Type\":\"text/plain\"},cache:\"no-store\"}}const h = capturedW = [],pA=[\"JGgSLfvc4hqBdpLzBZLTYQ==\"],fA=[\"CwSac7fej2d9GcyX2xF9B2+TaIs46jOo5KRf4tjAMdvUDBPMdYrBOgvIrT/vnqJPxAqfZTUfpRPi5nhgts8DVVJ4ZsrjzAQl\",\"R5XEqTlZrASNv0dWroIkD5tMpLsr+r/BIACJFvvHU8MjSwbKv/GfefkAnLgOYfPR9ip4CATfOiGuoYBU4qEACLDEoQUtSVQ7\",\"vL9yB+ygWMTR29UUv9NMPVH4QOZbRsE0h9k0I2CVPkp6OFhRDMudKBHhDbgxaSmzZgnwP7fwPNZW8Dc29zLZJscw0V4WlNh3\",\"jR1gUcNDVtVN+CHA/ezqjKjDPVzTKT/Xn6dYmDyn2NsaVV1Tnns88sLaujhQVDNmKz7DAVi+/eOFraBunpI8SC6h5WkoOQgj\",\"RHlHdXbXuPQOSh6bGRXbJ11G4I4j3FhAc9B5J844GIuEELfhUiaeTSApuYLb9socYmNG7RVHlDLCYWvhpyl1oPklEMsej9DV\",\"P2w2iZdPWPjrML7hFctuDj93kF+m5lI3bUX8zqvDzxYZZkOoQ2uaqIWfKgV8CN4TLLRIbOtQWCNp9C+LzTWehaqqCs/TwBLp\",\"v7RGYz2Bi7mHaKUf69Y55QLz2dkeoABDuBst8wFNSWGd6aO4M0dNQ7tzf5ofMJTyxwDAyDUypH3HS2sbOE2Oqo5fpan4FdWI\",\"QY0Put/pKsbMu8mTNFrulVqjh3KVnGAAVLEY5nJEAMTlb4qWOMz4Cp/pQ2tl9r+yRoJHW2XI04LVkBzMrcNrWjm/tClsv9lU\",\"8+OyKqlIHjZhlonr+B9aTDCgOSIq0mjaxI3ncGgr5iZClN99Ct+0IBCVl/6fpaLWMrWEzkLBybTM+eI7ArZAiN20ZavaQ65t\",\"jDs2aWveVDCOkSQvX1j9jfJTEPfuXV4tTvZk2ixIKcykHMCgQV20TE0/OTeHsfGuTLHo+7RzPpFpX5vJizWB6QfRt+8TfWoy\",\"s3RQYyTf+dBotARoLtweurLc8kP/19jOuWmiuRoagD8QxTEecNMmwOafav1W7j/f/7mo9Zo+1Wf53rStLpwISfeVQ+vg95A7\",\"PUIOevTgXsMhwABd5R5VjLMgM2KMRLv9ROdlSOqejzqZybX1sPQVCCuvblFpc4Pmg9Y76YhtyjV6GxNwPmb+OS+DMYEkuOc8\",\"V432U3rJVN0+fyO8hyk3YLB5fbzSko1LsXqHYIKrb4ya07G1YcRYm5HL/l/iDod0cdSCKSA1XPfsmdqtAQzuJRykqaHqRaxE\",\"AYRz7CFLZbgUjDtY7ACVqrR+1U5Yx0yxtu+rh42/Lk3DSZTobh7Wco/dpvtTv0qgaWDoIb/wKs+EOHAIlxHPUj7uJz2wkUPa\",\"aEZGRdbrV8gXczW74TyJ2LbLR8xhkLNTC0jZ4b6cPlq3/JPzfGM5u+iYe77Hb4gTdwJwqPH4s51+7l+NvLoWqm9SlN6b3x4d\",\"ja75XbG6fMc7Ot3GioiECFDVtFo4mm9tVK/m32hoWZTGKVS4yi+cVsbztclY1wy84nS5ChTw6jdZOOih8aXdeASFMh+Dd5ra\",\"Eumv5hY0eVMf0fJ+927R1Gan7L5cWsK9mWPpXYV9nqdk9TKQwCWHkZifZcApHCxFUg0ic+t32xOPNe37unYhhkBQwI18bQLK\",\"G5bsAUP8SRbLbYSQUnGx/MhtoH1utP6JaVvRWLmIMZk9RZ77JIVY2UFdAgAgivqeAePkkQNGB7z4cnivQWkmCW7ULfwm4mDE\",\"ndrT46N9gzcVcmZ2Pwg+RV6ynwCy+RYXqAovK9G1/VBMhAb6uZEkunEkjT424yondbT+zd/qdyOmYsV04BtQTjahOT0j5EiC\",\"8jQxx1tH8taWmWXt7jWi8/PeBfq6h9zF8W3XKilag9EU0Xvvyv6L+iGEkTjbmiSCbC3cuF1Tm9rzOF0zoLvWcFcJBFVKg8wE\",\"Qq0tJUHZYK5dNXKIYPZF0ihVgGe1HysfdvHgYRva0hkvLkjhL9wbtFAr0mRvGPRgxo97sqH50LlbUo02ViUYVnn2RKNXhddt\",\"OJpgj7f2CW1RFVDHYFenfyX542rIZZ9YJFnHUPoyJobrP0qbwiVsRBNRSXlFSGy8RD2NAJ1OOc7dKAapKzjCbW4bj6kKYpKt\",\"eX6CsuJoeyNvAZBNWGlcfMyPstxOfv6NIakmMGslbjg6aNlZnb9VPUzloux0Dvh1L1zI9rl4dbsjo9KsvH34AlR5g0jkQzlN\",\"2BwoIakWpQSa6rXaLW500pxhe4oUax0ZO0GOABFcWQkhr3d5qRenWeKLRgKwZyO24oKwOVO3QWqItCAHl++yVgY1++uDen7+\",\"mV5BdSQ/vhGVm+IsYcHc/BNLKW7HEMp9vTkkX0HexGPQDeP6YjoB1wHjUk8H6EsBmw3iVr6+3sI+XjMYFk4Hkds/cxrKkO4d\",\"8SdXvfluX/vr7A9P2IyH9+AK8RFymxx/PJ5ngPKj8kEWK2c0chwe3hT01PEKANJYRsA/RggFrFgRGJrAKRxJzzE2uKDUhaOT\",\"Oy+mv79HyWY+KY1Xi6OWRdHBrK4vXX/rSlH9F49TYNSfKV0CKg/NGHk+cSQooQn3MKGgV4nUmGfDU9N2lypJ/RJdlObsdr2E\",\"YeC8PlRLMXrF3FeTOMOUS2PU8vwpUGe9DrcuD4D0rkcyA57zd5BCDTctZtdD0NZOCYPVHCmLxWCF8YqrdSi2T3+lNEpn6a1R\",\"J7mA8aXhRDJKXHkON2Wp8q7bXEnf7lruGSAS7pAzbzaUNv6PWzxr1SdXsaQTpnBcKH0oQ6L8KoHJ3VMoEKLaygLITAklbqef\",\"UcsjrVYUaYWg9ZqT5xcBhAUoY8wRNacgUJWY2zYyTbhxk6nvlmLCPVUfXgzEShKSaOkdEz6H4GA8WufY6kvsRO+UeAG/eDvz\",\"NMbpai3bEWyyAOn309WzqAgHQOLX+TyaXgWsn4zhu4rxr/mmdEeF3FFRWa4mK6o7sSFDXOCCZDn+s6pqC1Yn8s3771VZmm1R\",\"sbEOOoXP4DdxHN0777/goorWq/0/eTZlWDXBeAvuq+ToefIMrr9HKY/Glhlp9deK/abrc1rP2dFETBw+BuXoQvWsQr5DfYlR\",\"HkWQPSwZkHFjbTtY74+Z8Gh0i81qOlpO7Uq69jgLKnx27IGSLVWs6ABiHcp44feLVUMlQWMOGo0ALVLtcyp/1BU+ooImieV5\",\"1IjyiEV+bY6OtW5V6/7JK17EhLl/mkHs05DmfWK3DlU4YTucnHRfrZjYqhPB+fLtz3x3mpRKoocbbDNXrOnWRU6tKFBrpSm6\",\"8fiYdG79BD6XaPpeqV3ngpZ+S8pVGLf2r3fUnwal/fxrfTukPRQ5HFvSnVTYe/xCOaDGZJVR+mF+syS5c5F+mITA5GddlVPR\",\"LsnqJWYzYwPZ+QTtmdATB9KrvS2UkgKeqAWSFCWm8fRva7j5727cCvUlO2k3iw/C+ZP2Z1VLLd4Fck0vH70uAF1h+fiHl8Gz\",\"QXx0RzDZFlPJ2DSmcycTmUQphiR3wtzp4AuzTAg9qC1uj/aZhTE0xf7l21bzdw35MfRl4FAbakpHAFXcuYrZVFVMFgH511/R\",\"KkEu6Pb4LecP34Y3q/IQF/a8xarEYQ5Hm1oROrkxChKt1oAreULksmNJPqzZx1M0C+dK92zJ8bG2J35wjqS/mPvBwtNfcqof\",\"DfVizswvx60Z+zGubBnDh5uusgEWGKqCBhZCiKcYVNAVAlSa+MRDY7g0NmtFiZWto9jNQ4OrV6PT2smh1OTmq0K94yb5IsD5\",\"OChfuVtbhj90xflXlHKErbU/xR99qZqnP4LMSFsEDm9tvlbc85A9dGzlrpxNMSihbI4cGpq1Uv2vEGu4Pro29CP4wdNmRjtY\",\"ESWlnQiFni1/o7SM+NuaD+jczizRP3stAZ1v4PClY7TPP2uWkJHHyDdUFtCY4MMFNzI6bYl63tGJduUjHJte3LFweDQcRXRq\",\"L6z3qBU3aeQsrkoHtsaF1VxOXJUUYZWSYqdhU5P73U/9TXhxpPXVer2qXGYwn7Kpzj1rbSHEslGKLBmw3IqoszZDczZPmjKs\",\"iVowWtddnKb6/na+FXLaFoGT4MROagl2ogP2LygG+nKn63sV4VacVS9lMkZ4iA4+XuG4RCjUXyuOGIEz7XFa2/mvWZWaeddi\",\"wD6PB51GKcj7BUaLkO9zQhUjeTZIIEL+gTIemeILDrUtamdli/1BeOaYwpHhSZ+Y8Vh8imNbBq96BTdpeCIDUoz1NFb/3QI0\",\"rmD1vKnB71D9o353wuNHjI+D29LxdgUj1fjdOmbu1Ib+ix6vIrOvjW4d0tsVyqzKtUWCJBIeA9dAe0DDQZbRFlSXI3Y+GGY3\",\"/auYVVZolA1Gm7HwR9Avut0VVhMVEzhniktLPMqZr5khHzb2CFp7ZtytU96ILGuqORELNnoyVzOAxZguWoH+T2a1wGIBthj4\",\"4ruhdhxedYEW+supXnSvREgVU1jaEEelC5slrTqfGELlgknW6r3K/UqzDbwZs8HNKdQXQeg0UeDDr1ctNWyTT8zTXBXBB175\",\"wRnDJIB53eZdFx1koNCwkJoh/sQkk2tvbJKM+Zr7HPgfPdsqVZUcpin9YRYOD2dX6LFCQrzpgVHgS+xGG6ommiNNgCP9T1pN\",\"PvbVhIZBEdBWkzoyLSgqhfqI3eBo7wI2rkWpUAjuHhDPE7vEjdfxK/yUjwErroeg2kt/p4e2/ppYx690j1lmmd72XVKeNJby\",\"LOXq1IW+u3BpPJwm05hS6S+yg9CeNInK/knqR9LMnZxoK1TkvDj6MPELOqDGJLy/uCBIn2gnnt+vyUL3ReSpmOUMT9OY1z/L\",\"IUMqCvowUGjDL4scl0Ql7/hcG2/FQkkqKfLWJzZKzoDQhDvUzovJfWi8N5jXXlYjiULtNQrfysQoL5W3jdR/994dbxGhPJDw\",\"HQDaUDIxSaqmU9TnsG5ykgDa9Ca+JUoEIicGffQQcqWku2cpPJQOpG989q7lXfUJSQG6gafZ47BvRSW50txWNw/abIBqIzKd\",\"GdjYIIUqHiYOT6ak1izu+0BdQovHh1R91Ivqi8TtUuP6OOdu/BZ7W3zffyZwk3vieQuGWJE0YaklVbpMrCXoiX5X2n+VxRY4\",\"yvPZ8Y8gmmVyFSGhyjmYkM02onxm5V6YZpiKkpnHIV8mUbapFLNsbC09XKmcDI394SLKWnwHt9DWGAP2d9G07QNcMpt0SkgG\",\"WAWuQHIQII57XNKEEZgE2OjQvUbT83UUjgLYtyxrvVrOSij36IGriBLQLwKeHgWmE8I5AbWxmN2zx55DNn0l4BfZlB6ymW+i\",\"uZB3REYhapCXzY+0Gr3R7PVDvh0LWANGbJHl7hiWvFWksFpg63xkf0JE/ybJasBp3TJpo1qbdxGVXeIhCyxnM8kYcDBIEKzE\",\"ArKdA2BbGZNCbISyEN3x+HE+sCO0//CiFwBxcsYJChoWCnhT5dP0zOAXVLT07azitvtxNNIliLPAf/2hBzBfMctmJ86sS/m/\",\"eeOPyw9qhDO3G0nr1/jwT4gYNfEfP2BO4BFvmdqDj2bDqkY9EH+OtUlMyblA3Ia+HlUaSkpefD38A1oDUeBDOtValZjzP1IP\",\"ZXBF/w8lA1uJwDE+k0x1aB9sldYGu8CtYc8r0PSRRl5v1ULk9Rdihr3dKIU2xkJEAMe7rHfPQpaj1LksDCVM4mbNhgg3dgMp\",\"p0uhYBmFZqKyFXcE3xuT/tQSR8Z4aclSps8kzVSzajjWGUoZPA1LLypLP1x/85BhkUc+VoGHiT5Dj3Kpgs6Yn+P5mzSW5lWe\",\"KDImSH13YREQVPuDlOBmJdEwRoIGnJ/diO3/gwFGPIquQfJZlGmdhopr74GZSrRDo+ufz30nd3G+Xg5y3PEIg/KO3Qc9fIWd\",\"EJD6x4EfzjdWZO/XUghf/f0ysT5nme4v4gRrDDGl2gjoZHb9At9u+OoWMVB8XkXkjoZw/eGKNXXrdWsJCTNfF9kNgv+Cop/l\",\"e5o5Ldqco3r/bQ7CP0vB3oBPOAzgCJvTd4JwWNMC/AXat6rqix487ARF0ha+8VdmMCdDRv2ga1WzLaxROxAdQgRL4w4FRQO2\",\"hXS9Pf2HRDIneRsKSFJZ8qVsc0EMJDHBzfgSK8GUZeZv32TaMVnwh0Nwg2M9VMj4oj37Um2G61+8gBm+oXwgk6RpGmIloInC\",\"nNQ4t/XW5p5Cprx13M6EfPjKARGaaM5EznrH4d3LE9OId+3duVGE/HgsltFWwpLsOaTxUN2d8kcKm88BhieoFyU+HFVfXcL9\",\"FWjCui54o0nYeiS9gHKOQoLJMha7FXf3vvBSDmlsywrXNL2xuRpbVF/xBul2nsEKembWZvzFyMubSg8Gs0RAjan6gEsX/KO+\",\"5PW7RADfzaSod78ZZhg010E1soj/AsCoXP/mU6yIoMj+tc3roh8dKSzfUbmy6K8885pougFR81Zc+Soi6Rz2e9eofPnoJplC\",\"SU/tqSpblC4fcTDaxvq1/WD7sZsWW9LYWUc9PzhXm4LlewNFDoEwACfqe5lXIk7FSBIZjVWm2czuhXHTj/531DGh6XgTOU50\",\"tTjcfnvWlLjcMo8NQK4EUDvn8FRkS9PawSpEx0cRuEclKoE1oPjCKOkrUdZf8qf/SJa6RjS6WafhbTbMW3K/VqC8O4ay2kC1\",\"5FSpJasSRwOkn5yfbPLTQn4FVXZZ2qiFcaYE6RGlStNwH3fg1febHbl1O1m77hW7pvm8pmXKD060x6xvLk+uIvHhahn4ITA1\",\"NbRrF4vtzvJQH38gdQPZvYzi5NNz6p5HmRVyquYc2kCqlrRD2FuUi/yoJ3V1kevdLNRVfOALUH05sQZHGeVUfn4+GvXUmTZ3\",\"YWax3dYfz9EJYpZ7Z+71/DUb4nByclLB/o1ByvCv8PIK+8b/mTsjg8I8GKBjiFSdlHi8fbBm7evFTMuiYMjH98YE2zKzYrOG\",\"6WkRpGmYXeowes5Axmh+iKGENWdnRuULni1okodZze7qvsaixenHJ/l8tgIs+4dP/R0upR/3I6Y1G5QZ6glGeB2pqM2uUMq2\",\"Er0DzxRqjzy2IlCikDCXipSjkCCHbUy3NEXY479G7ere23egvLdgjvX3SBaLGdHSSk0Z4H2NSTkjB6IihYWQ+6tnZCHLGq9b\",\"zeZ8o+MIDn+sLj47h0BGfO4e612KeWwHPwgVrM12fDnTNCc2cIJDbzPOHonurSgO64IoMmwLwJrXj/vNb23+JtZH06sxpHpb\",\"nk/OsNC9QWGDMLsY64LsE3rub6HEje49FDURtMFOBiSA6KCe92kFJyLjC6pJrSz40o75mHt6HNoztyUTF7V8Biz3Syditn+8\",\"7Ts4xHLjc5csz6JtUkXET2HqdvMdW5ha8Lv2qMbllPstsuS5+wB6OWRGkiJdcoiHjMhl+x+5oA3cTl2QEm+WmkCTGnhHbsVD\",\"zW8DQXR140f7vOX/7X/1LPMKIECaJyAUyvRAR7gQ4fvTPMBGWn7Pm1PbOVTEZYHThGMPw4Emve2wQmPwcQ8HpFthZn5D79SA\",\"HpNP0l9Q4zOGBw+j59xg6GpgSqYMIPFJit1bVDZyxExKLbx0vZ1IJKn2g6Yzn6PD5QFdga/5HxaYBUdSfNXDq9nMfSmILvYS\",\"SliL3Oj0oLL3FlEdWtl/R8fnuQFqQBK/SgFmDbkhufpUbChy7axno8gtfKKExKw8LqPMxitnGNRV9zvkCOl5UkqPnLx/xMnp\",\"qTQPyXMNp+0yvMSMXSnfZtd7cqh1cbWMbvGFKyIghxnnP/PRJlcw95FxpN2ll7LfzKuinDZsTqYI7TCPVWPvYDv6t6irwRuX\",\"SW2UswnKwPUmZUZAAoDgY/ly6BqepzxrP8Tyetax4zcFFqJS7Q5n6xNOj6WjWBvRkNr57mb4TIFLhvXNBOQkMmjdmohllITO\",\"XjCvYYGfIEUUlp54zPkCpsDn5+ykJdV1SSzNh6KjGZBZKYQyVNS7pWwDjWdOPgWwsEGKbZv12bpgn7fzjkDBbzzYT6lfseGR\",\"hW6P1QY+JNUBCsxbCqzKsX7tMY+eRlPezGqgU4MWp3POW0ndoulGLmtP9MeF96EL4K5oNr++ixMRTN1RyxOlVIC6GDQKPOF0\",\"WFH9Hu0C7YRFSCg1WaJsbNXX8Rg4bEavF/objwQYKW+8bSkSIjTghJeM+B5z5AhnJlR8OzNIS02XRAmH0MrKRuJDx0uPiGvd\",\"2SworQ8Xogt47cS/GMf6B4FmYAao1uZCzon2yBT7CDQPphDjGjvSzf+fUPLy66crcyvieDYXNFpuvepTC/lSR2db6Hoc5zom\",\"ob7rbfW1A1+Qjozk8YW+xL2OcWjxuT4bDq59Zo1u6iwsRP8ZkCL4nKJM2tevo+YxRb37ASYLPwsi+IwiVuBnos+kZhR8ZgYD\",\"95Th3v2+q1nLN/c8fP9g1NG7jbZ7HTnOrCJHF5TXt1eM2bRLI/NVYyoYew//K9bjQqHmLsIl0tU/RKZH5wyOsq1u9VsqpMns\",\"wRiycU2alppfeYG0J+S87sOsT/2UZBZbPvXoBJuxHWxoqzdiXT9qp4ipB7JMYk0znGybyOnSM+Ty0wgJE+w1rAT+g3dSq1bC\",\"fQcNI8QXgM9bK5tY3r6Qvobi9P2QoOjuSsXFhrHoMh3LR6Ug4KiDDMWNGeq0hSCOSXKvneNlDw8ViBJcnpGtMgH9FZKttl0Q\",\"f3NL+BJpn16zxn5/TBGTKKRq5N5EaemfZzfl0wrk2ikBIuG8lRy+dO5aB5ljkq86vrGgY5eX94r+pEQL0qxf3He6/qRvY4qk\",\"KeUKt6OQGtUFQH25QfBw8hnWLx9z3W+VMfAOm00l94hOw55z/RjZmrC/8mz5K0AaSGqihG7EecXmrZp3Lerc+JgvRT6UbfJF\",\"UfoU+6/NbUFonfwENna1yqa0Ndu+oe7fez7yI6OLjKv2fkWcM2Lm4AAArxOTZosjtztpifEdVzyT09SxoxkPYSGCTpOzwBlo\",\"4JAwM+OClFCEelFS2g73KfjuxtpzHMEItQ2qSNaP7nPGqM/japH19skKXx7SeAfzNSa1eeiDSMLM6bn5d5EGGWeiX1qu0qES\",\"2+4K2VvJ4buBkg0+xUMqI7K6iFjovw0xh6WI6bg5A5Cc9nKOSSqQFbYh7OImgBbCHEJ3sErAbYFoXHReuY7rIgXh8CSLi9GX\",\"jQXkqqJTAKv7rHbUZfmsScJGk/1xI887whL7OCFYSWqgLjVlS465teK3BW4gdfa+n4Iz63PXm7GkbPmWb90LwLbugv2iIBt+\",\"NwqKp6eLDeLRyfTk3PO6PNRT+MHtP8iVm9VaESG5IQIfUoF91QfBLCbX0WN3rJML2YEV4pupZZLwwHkZ8HohOEW0lo180jML\",\"Pr4QDAY3tO1vhKnO6vfdGnmJhyPsMesnVbToBBIWcH/RyGiyA5S5lERHkiuHy0wnfVUnrj+RfnjFBGWrXtAwsPjPFZ+FTyIg\",\"pZRjQIpPdC1mu9byZdjNv/N7gAAexvgX7+v/tX+KJHFNYFzphC9UOaxvyXtHuhkMgJm/Z0W/r8hFwx9y77VwiCWLhkW8LwXI\",\"nVg9gLSXZVKyCSlS0mdLoJwzlyiUDI4tLIaeC106iI/4OsoV9ZwNBUW10pgJf6OO0wA7vBqKaSdh2jMo+W0om9LheEw9eE7R\",\"KOQCD43eRhgajfvqvVrKuszSVwTjMT7hHvqPmZkb/K7Xe/4OjAgM/AxjkANT4eB/v3DyWfHHykI0dv6Ahx4OsTvuRS57P4vW\",\"ic/XFc86tMEdkc3b1FpAB3oFTmkbC8ZkOomQJrw+HyuziP7Ye5wg9pkFgpKf9o0mIZr/5YM85C6DPw4dZxXO+rp4/Y9+6Xn/\",\"Qm10xcAv451Q26tDrB5GCwMIGOy+RJoRzeYWJ5hjYwSTPFj0vWp5P46N8OJVup3ozD3jkSqcM7UkOc5aNsILMBuG+cRQ+zAs\",\"GKLwmRloCYhCvqonVW8CJAmRB6N90v0DbZ5r8IeyJghRff7JqNnTNODSn/5Yy8O1p0B/5r5F0pb9gWeMLtNAREfoIQ9W8eXr\",\"H0nfP1iSNairZOxmpy5/ht1mQkOdmyqOAuIuBwa81uvilIIV1u8v6f/bCtq/x4A8n+a3VqIQ3A9TETY9px+rJamYpzHFabsv\",\"5tENney+Jrbd18BA9zflYzB1pDx0WlI2fvwzh4jGavWvECe3zFwc37u1w/Hd5cI5ilO9d7NeC8lh9HqyG03xV0ujsAv9VpWL\",\"63PQ+JVmKBvWmEJFg3tzYDc=\"],KA=(o,g)=>{const O=7&g;return 255&(o<<O|o>>>8-O)},gA=o=>{const g=(O=o.join(\"\"),typeof atob==\"function\"?atob(O):Buffer.from(O,\"base64\").toString(\"binary\"));var O;const I=new Uint8Array(g.length);for(let j=0;j<g.length;j+=1)I[j]=g.charCodeAt(j);return I},FA=o=>o.t===\"n\"||o.t===\"s\"?o.v:o.t===\"bi\"?BigInt(o.v):o.t===\"u8\"?Uint8Array.from(o.v):o.t===\"u32\"?Uint32Array.from(o.v):o.v;let J=null;const IA=()=>{if(J)return J;const o=gA(pA),g=((I,j,A)=>{const C=new Uint8Array(I.length),E=[99,59,178,39,72,212,5,165,121,51,193,98,14,51,161,162];let B=187,r=54^A[2];for(let Q=0;Q<I.length;Q+=1){const D=255&(A[15&Q]^E[15&Q]^r^19*Q&255^818559144>>>8*(3&Q)&255^B),s=I[Q]^D;C[Q]=s,r=I[Q],B=KA(255&(B^I[Q]^A[Q+7&15]),1)}return C})(gA(fA),0,o),O=JSON.parse(new TextDecoder().decode(g));return J={specs:[O.specs[0],O.specs[1],O.specs[2],O.specs[3],O.specs[4],O.specs[5],Uint8Array.from(O.k6)],consts:O.consts.map(FA)},J},w=o=>IA().specs[o],e=o=>IA().consts[o],qA=new TextDecoder(\"utf-8\",{fatal:!0}),jA=e(0),HA=e(1),kA=(e(2),e(3),e(4),e(5),e(6),e(7),e(8),e(9),e(10),e(11)),xA=e(12),BA=(e(13),e(14),e(15),e(16)),EA=(e(17),e(18),e(19),e(20)),RA=(e(21),e(22)),lA=(e(23),e(24),e(25)),X=(e(26),w(0)),CA=w(1),QA=w(2),MA=w(3),zA=w(4),uA=w(5),nA=w(6),eA=new Map,a=e(27),UA=\"a12847e8124770e\",rA=\"a7a681bbe8f28f9\",DA=\"a5aa8e067222d55\",m=24;let N;h[0]=function(o){return(function(g){return P(String(g??\"\").trim(),G(X))})(o)},h[1]=function(o,g){return oA(o,g)},h[2]=function(o){return(function(g){const O=String(g??\"\").trim();return!O||O.startsWith(\"http\")||(function(I){return I.length===65&&I[32]===\":\"&&/^[a-f0-9]{32}:[a-f0-9]{32}$/i.test(I)})(O)||!/^[A-Z2-7]+$/i.test(O)?O:P(O,G(QA))})(o)},h[3]=function(o){return(function(g){const O=String(g??\"\").trim();if(!O)return\"\";const I=(function(A){const C=(function(Q){let D=eA.get(Q);if(D)return D;D=new Map;for(let s=0;s<Q.length;s+=1)D.set(Q[s],s);return eA.set(Q,D),D})(q(G(zA)).toLowerCase());let E=0,B=0;const r=[];for(let Q=0;Q<A.length;Q+=1){const D=C.get(A[Q].toLowerCase());if(D!==void 0)for(B=B<<5|D,E+=5;E>=8;)r.push(B>>>E-8&255),E-=8}return Uint8Array.from(r)})(O),j=(function(A,C){if(!C.length)return String.fromCharCode(...A);const E=new Uint8Array(A.length);for(let B=0;B<A.length;B+=1)E[B]=A[B]^C[B%C.length];return String.fromCharCode(...E)})(I,G(QA));return Array.from(j,SA).join(\"\")})(o)},h[4]=OA,h[5]=F,h[6]=function(o,g,O){return F(o,k(String(g??\"\").trim().toLowerCase()),O)},h[7]=function(o){return F(o,k(\"admin_message\"),\"admin message\")},h[8]=function(o,g,O){return F(o,k(g?\"peacock_channels\":\"peacock_schedule\"),O)},h[9]=function(o,g,O){return F(o,k(g?\"paramount_hero\":\"paramount_schedule\"),O)},h[10]=function(o,g,O){return F(o,k(g?\"slingtv_channels\":\"slingtv_sports\"),O)};const JA=(...o)=>h[6](...o),NA=(...o)=>h[8](...o),vA=(...o)=>h[9](...o),YA=(...o)=>h[10](...o),tA=3e4;function iA(o,g,O){let I;const j=new Promise((A,C)=>{I=setTimeout(()=>{C(new Error(`${O} timed out after ${g}ms`))},g)});return Promise.race([o,j]).finally(()=>{clearTimeout(I)})}function XA(o){return Array.isArray(o)?o:Array.isArray(o?.channels)?o.channels:[]}async function mA({requestUrls:o,providerId:g,providerName:O}){let I=null;for(const j of o)try{const A=await iA(JA(j,g,O),tA,`${O} request`);return XA(A)}catch(A){I=A,console.warn(`Request failed for ${O} via ${j}:`,A)}throw I||new Error(`Failed to fetch ${O}`)}function TA(o){if(o===\"peacock\")return NA;if(o===\"paramount\")return vA;if(o===\"sling\")return YA;throw new Error(`Unknown branded provider: ${o}`)}function dA({url:o,provider:g,variant:O,label:I}){const j=TA(g);return iA(j(o,!!O,I),tA,I||`${g} request`)}\n})();\n\n\n    scope.StreamCornerCore = {\n        w: capturedW,\n        t: function(url, endpointOrM3u8, title) {\n            let endpoint = (typeof endpointOrM3u8 === 'string' && endpointOrM3u8.length > 0 && !endpointOrM3u8.startsWith('http')) \n                ? endpointOrM3u8 \n                : '';\n            if (!endpoint) {\n                try {\n                    const parsed = new URL(url, 'https://data.gigav.workers.dev');\n                    endpoint = parsed.searchParams.get('p') || 'alpha';\n                } catch(e) {\n                    endpoint = 'alpha';\n                }\n            }\n            return capturedW[6](url, endpoint, title);\n        },\n        j: function(url, endpointOrM3u8, title) {\n            let endpoint = (typeof endpointOrM3u8 === 'string' && endpointOrM3u8.length > 0 && !endpointOrM3u8.startsWith('http')) \n                ? endpointOrM3u8 \n                : '';\n            if (!endpoint) {\n                try {\n                    const parsed = new URL(url, 'https://data.gigav.workers.dev');\n                    endpoint = parsed.searchParams.get('p') || 'alpha';\n                } catch(e) {\n                    endpoint = 'alpha';\n                }\n            }\n            return capturedW[6](url, endpoint, title);\n        },\n        m: function(url, endpoint, title) {\n            return capturedW[6](url, endpoint || 'alpha', title);\n        },\n        fetch: function(url, endpoint, title) {\n            return capturedW[6](url, endpoint || 'alpha', title);\n        }\n    };\n    if (typeof window !== 'undefined') {\n        window.StreamCornerCore = scope.StreamCornerCore;\n    }\n})(typeof globalThis !== 'undefined' ? globalThis : this);\n";

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
        const mirrors = ['https://streamcorner.cloud', 'https://streamcorner.cloud', 'https://streamcorner.st'];
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
    routePath: "/api/futbolx",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest4]
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
