# AryanStreams Global (`AryanStreamsGlobal`)

Standalone, automated live sports and 24/7 TV streaming web application modeled directly after **`ppv.st`**, **`streamcorner.fun`**, and **`www.futbol-x.xyz`**.

## ✨ Features

- **Real-Time Automated Match Aggregator (`js/api.js`)**:
  - Automatically fetches live and upcoming schedules across **Football, Basketball, NFL/CFB, Baseball, UFC/Boxing, F1/Motorsports, Tennis, Cricket, Darts, Wrestling, and Hockey**.
  - Powered by open, public APIs from `futbol-x.xyz`, `ppv.st`, and `streamcorner.fun`.
  - Zero hardcoding: continuously updates live games, start countdowns, and stream sources.
- **Universal Multi-Server Player Engine (`js/player.js`)**:
  - 1-click tab switching (`Server 1`, `Server 2`, `Server 3`, etc.) with labeled stream providers (e.g. `FUBO SPORTS`, `SKY SPORTS`, `PEACOCK`, `DAZN`).
  - Automatically attaches single or multiple stream feeds.
  - Native **HLS.js** video player for direct `.m3u8` feeds (60FPS, adaptive bitrate) + sandboxed player for embed sources.
  - Controls: Theater Mode, Fullscreen, Reload Player, Next Server shortcut, and External Player link.
- **800+ 24/7 Sports TV Channels**:
  - Dedicated TV directory pulling live channels with country flags, channel logos, and instant playback.
- **4-Screen Multiviewer**:
  - Watch up to 4 concurrent live games side-by-side.
- **Cloudflare Pages Backend Proxy (`functions/api/`)**:
  - Serverless proxy functions (`/api/ppv`, `/api/channels`, `/api/embed`, `/api/nitro`) enabling seamless CORS and anti-ISP blocking worldwide.

## 🚀 Local Development & Preview

Run a local web server:
```bash
npx serve . -l 3000
```
Open `http://localhost:3000` in your browser.

## 🌐 Deployment

Deploy to Cloudflare Pages:
```bash
npx wrangler pages deploy . --project-name=aryanstreams-global
```
