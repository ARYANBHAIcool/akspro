# AKSPro — High-Speed Live Sports & 24/7 TV Streaming Platform

AKSPro is a zero-cost, zero-delay sports and television streaming application built with the ultra-fast edge architecture of **`bintv.cc`**.

---

## ⚡ Highlights

- **Unified Master Feed**: Live and upcoming matches across Football, Cricket, Basketball, MMA/UFC, NFL, F1, and Tennis, plus **217+ 24/7 TV channels** (Sky Sports, Willow HD, TNT, beIN, ESPN, ABC, NBC, Fox Sports).
- **Edge CDN Speed**: Response caching via Cloudflare Pages and Edge Stale-While-Revalidate headers with client-side dual-tier caching.
- **Integrated Live Chat**: Sport category chat rooms powered by BanterTalks.
- **Real-Time Viewers**: Live presence counters updated dynamically.
- **Embedded Sandbox**: Sandboxed base64 streaming engine with `referrerpolicy="no-referrer-when-downgrade"`.

---

## 📁 Routes

- `/` — Homepage: Featured matches carousel, category pills, live & upcoming matches grid, 24/7 TV channels grid, real-time search.
- `/match/?src={id}` — Match overview: 10-second auto-preview, stream source buttons, similar events.
- `/watch/?m={id}&i={streamIndex}` — Full player & live chat with instant stream switcher, embed code modal, theater mode.
- `/embed/?id={base64Url}` — Standalone base64-isolated stream sandbox.

---

## 🚀 Deployment

Deploy directly to Cloudflare Pages:
```bash
npx wrangler pages deploy . --project-name=akspro
```
