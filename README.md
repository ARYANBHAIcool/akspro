# AKSPro — High-Speed Live Sports & 24/7 TV Streaming Platform (Dzeko11 Architecture)

AKSPro is an ultra-fast, zero-delay sports and television streaming application modeled after **`dzeko11.pk`**.

---

## ⚡ Highlights

- **Dzeko11 UI & Dark Layout**: Top sports navigation bar with vector SVG icons (`sport.svg`), date navigation (`dayPrev`, `dayCenter`, `dayNext`), status filters (`All`, `Live` with live counter, `Finished`, `Upcoming`), and instant search (`matchSearch`).
- **Live Match Scores & Minute Ticker**: Real-time minute ticker, scores, team crests, and tournament grouping powered by Flashscore feeds.
- **Edge API Proxies**: Zero-CORS Cloudflare Pages function proxying Flashscore feeds (`/api/feed`) and 24/7 TV channels (`/api/channels`).
- **200+ 24/7 TV Channels**: Dedicated TV mode (`/tv`) rendering 219+ live sports channels (Sky Sports, Willow, ESPN, TNT Sports, beIN Sports, DAZN, NBC, ABC) with instant modal player playback.
- **Match Details Page (`/match/{sport}/{id}`)**: Match header with live score cards, breadcrumbs, overview, venue/referee details, and TV broadcast tab with working stream links.
- **Instant Search**: Real-time client-side filter across teams, leagues, and TV channels.

---

## 📁 Routes

- `/` — Homepage: Sports bar, date selector, match status filters, tournament match cards with live scores.
- `/tv` — 24/7 TV Channels Directory: 219 live channels with stream switcher & embedded player modal.
- `/match/{sport}/{id}` — Match Details: Live score updates, lineups, venue/referee info, broadcast channels & streams.

---

## 🚀 Deployment

Deploy directly to Cloudflare Pages:
```bash
npx wrangler pages deploy . --project-name=akspro
```
