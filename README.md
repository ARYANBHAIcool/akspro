# AKSPro (`AryanStreams Global Pro`)

High-speed, zero-delay automated live sports & 24/7 TV streaming web application modeled after **`bintv.cc`**, **`ppv.st`**, **`damitv.st`**, and **`www.futbol-x.xyz`**.

---

## ⚡ Zero-Lag Architecture & BINTV Analysis

AKSPro incorporates the lightweight, edge-cached, zero-cost streaming model pioneered by **`bintv.cc`**:

1. **Free Edge Infrastructure ($0/mo Hosting Cost)**:
   - **Frontend / Player**: Hosted on Cloudflare Pages (instant worldwide distribution, zero egress fees).
   - **Unified API Feed**: Edge-cached master feed (`https://bintvjson.lovable.app/api/public/bintvjson`) with 60s CDN cache and 120s stale-while-revalidate.
   - **Stream Isolation**: Sandboxed iframe embedding with `referrerpolicy="no-referrer-when-downgrade"`, preventing referrer leaks and ad-blocker domain matching.

2. **Real-Time Data Aggregator (`js/api.js`)**:
   - Automated ingestion of **Live Events**, **Upcoming Events**, and **217+ 24/7 TV Channels**.
   - Zero hardcoding: continuously polls live status, countdown timers, and active broadcast feeds across Football, Cricket, Basketball, UFC, NFL, F1, and Baseball.

3. **Multi-Server Player Engine (`js/player.js`)**:
   - 1-click tab switching (`Server 1`, `Server 2`, `Server 3`, `BINTV HD`, etc.).
   - Support for HLS `.m3u8` feeds (HLS.js with adaptive bitrate), DASH `.mpd` feeds (Shaka Player), and secure sandboxed embeds.
   - Controls: Theater Mode, Fullscreen, Server Reload, and Shareable Links.

---

## 🚀 Local Development & Preview

Run a local web server:
```bash
npx serve . -l 3000
```
Open `http://localhost:3000` in your browser.

## 🌐 Deployment

Deploy directly to Cloudflare Pages:
```bash
npx wrangler pages deploy . --project-name=akspro
```

## 📦 Git Sync

Configured to push and track `akspro`:
```bash
git remote -v
# origin  https://github.com/ARYANBHAIcool/akspro.git (fetch)
# origin  https://ARYANBHAIcool@github.com/ARYANBHAIcool/akspro.git (push)
```
