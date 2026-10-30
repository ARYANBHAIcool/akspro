self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

const byId = Object.create(null);
const TTL_MS = 600000;
setInterval(() => {
  const now = Date.now();
  for (const k in byId) if (now - byId[k].ts > TTL_MS) delete byId[k];
}, 30000);

self.addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.type !== "playlist") return;
  const id = String(d.id || "").trim();
  const text = typeof d.text === "string" ? d.text : "";
  if (!id || !text || text.indexOf("#EXTINF") === -1) return;
  byId[id] = { text, ts: Date.now() };
});

function manH() {
  return {
    "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

function waitingPlaylist() {
  return ["#EXTM3U", "#EXT-X-VERSION:3", "#EXT-X-TARGETDURATION:6", "#EXT-X-MEDIA-SEQUENCE:0", "#EXT-X-ENDLIST", ""].join("\n");
}

function stripPNG(ab) {
  const u = new Uint8Array(ab), lim = Math.min(u.length - 376, 60000);
  for (let i = 0; i < lim; i++)
    if (u[i] === 0x47 && u[i + 188] === 0x47 && u[i + 376] === 0x47) return i === 0 ? ab : ab.slice(i);
  return ab;
}

function isSegment(u) { return /tiktokcdn|\.image(\?|$)|\.ts(\?|$)/i.test(u); }

const BLOOP = /^\/bloop\/([^\/]+)\.m3u8$/;

self.addEventListener("fetch", (event) => {
  const req = event.request, url = new URL(req.url);
  if (url.origin === self.location.origin) {
    const m = url.pathname.match(BLOOP);
    if (m) {
      const id = decodeURIComponent(m[1]);
      event.respondWith((async () => {
        const rec = byId[id];
        return new Response(rec && rec.text ? rec.text : waitingPlaylist(), { status: 200, headers: manH() });
      })());
      return;
    }
  }
  if (isSegment(req.url)) {
    event.respondWith((async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const r = await fetch(req.url, { mode: "cors", credentials: "omit" });
          if (!r.ok) throw new Error("cdn " + r.status);
          const ab = await r.arrayBuffer();
          return new Response(stripPNG(ab), {
            status: 200,
            headers: {
              "Content-Type": "video/mp2t",
              "Cache-Control": "no-store",
              "Access-Control-Allow-Origin": "*"
            }
          });
        } catch (err) {
          if (attempt === 1) return new Response("seg fail: " + err, { status: 502 });
        }
      }
    })());
    return;
  }
});
