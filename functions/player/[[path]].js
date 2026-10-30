/**
 * Cloudflare Pages Function: /player/[[path]]
 * Edge-rendered zero-latency live sports JWPlayer engine
 */

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Live Sports Player | AryanStreamsGlobal</title>
  <script src="//ssl.p.jwpcdn.com/player/v/8.51.13/jwplayer.js"></script>
  <script>jwplayer.key = 'ITWMv7t88JGzI0xPwW8I0+LveiXX9SWbfdmt0ArUSyc=';</script>
  <style>
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; background: #000; }
    #player { width: 100%; height: 100%; display: block; }
    #player video { width: 100% !important; height: 100% !important; object-fit: contain !important; }
    .jwplayer.jw-flag-fullscreen { width: 100vw !important; height: 100vh !important; }
    #msg { display: none; color: #fff; font: 14px system-ui, -apple-system, sans-serif; text-align: center; padding-top: 20%; }
    .loading-spinner {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #000;
      color: #94a3b8;
      font-size: 13px;
      gap: 12px;
      z-index: 10;
      transition: opacity 0.3s;
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid rgba(255,255,255,0.15);
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>

<div id="loader" class="loading-spinner">
  <div class="spinner"></div>
  <span>Connecting to live sports server...</span>
</div>

<div id="player"></div>
<div id="msg"></div>

<script>
(function(){
  var params = new URLSearchParams(window.location.search);
  var TOKEN = params.get('token') || params.get('id') || '';
  var rawUrl = params.get('src') || params.get('url') || '';

  // If already a full URL or not a token, redirect or embed directly
  if (rawUrl && /^https?:\\/\\//i.test(rawUrl)) {
    window.location.replace(rawUrl);
    return;
  }
  if (TOKEN && /^https?:\\/\\//i.test(TOKEN)) {
    window.location.replace(TOKEN);
    return;
  }

  if (!TOKEN) {
    document.getElementById('loader').style.display = 'none';
    var msg = document.getElementById('msg');
    msg.style.display = 'block';
    msg.textContent = 'No stream token specified.';
    return;
  }

  var WS_BASE = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/api/ws';
  var MANIFEST = '/bloop/' + TOKEN + '.m3u8';
  var AUTOPLAY = true;
  var player = null, ws = null;

  function connectWS(){
    try {
      ws = new WebSocket(WS_BASE);
    } catch(e){
      setTimeout(connectWS, 2000);
      return;
    }
    var dHdr = "", dSegs = [], dTop = -1;

    function toSW(text){
      var c = navigator.serviceWorker.controller;
      if (c) c.postMessage({ type: "playlist", id: TOKEN, text: text });
    }

    function parseFull(m){
      var lines = m.split("\\n"), i = 0, hdr = [], base = 0;
      for(; i < lines.length; i++){
        var ln = lines[i];
        if (ln.indexOf("#EXTINF") === 0 || ln === "#EXT-X-DISCONTINUITY") break;
        if (ln.indexOf("#EXT-X-MEDIA-SEQUENCE:") === 0) base = parseInt(ln.slice(22), 10) || 0;
        hdr.push(ln);
      }
      dHdr = hdr.join("\\n") + "\\n";
      dSegs = [];
      var cur = "";
      for(; i < lines.length; i++){
        var l = lines[i];
        if (l === "") continue;
        cur += l + "\\n";
        if (l.charAt(0) !== "#"){
          dSegs.push(cur);
          cur = "";
        }
      }
      dTop = base + dSegs.length;
    }

    function applyDelta(d){
      if (!d.add || dTop !== (d.seq + d.win - d.add.length)) return false;
      dHdr = d.hdr;
      for (var k = 0; k < d.add.length; k++) dSegs.push(d.add[k]);
      while (dSegs.length > d.win) dSegs.shift();
      dTop = d.seq + d.win;
      return true;
    }

    ws.onopen = function(){
      ws.send(JSON.stringify({ subscribe: TOKEN }));
    };

    ws.onmessage = function(ev){
      var data = ev.data;
      if (typeof data !== "string") return;
      if (data.charAt(0) === "{"){
        if (dTop < 0){ try{ ws.close(); }catch(e){} return; }
        var d;
        try { d = JSON.parse(data); } catch(e){ return; }
        if (!applyDelta(d)){ try{ ws.close(); }catch(e){} return; }
        toSW(dHdr + dSegs.join(""));
      } else {
        parseFull(data);
        toSW(data);
      }
    };

    ws.onclose = function(){ setTimeout(connectWS, 2000); };
    ws.onerror = function(){ try{ ws.close(); }catch(e){} };
  }

  function startPlayer(){
    var loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';

    player = jwplayer("player").setup({
      playlist: [{ sources: [{ file: MANIFEST, type: "hls" }] }],
      width: "100%",
      height: "100%",
      autostart: AUTOPLAY,
      mute: false,
      stretching: "fill",
      primary: "html5"
    });

    var recT = null, recN = 0, MAXR = 60;
    function recover(){
      if (recT || recN >= MAXR) return;
      recN++;
      recT = setTimeout(function(){
        recT = null;
        try {
          player.load([{ sources: [{ file: MANIFEST, type: "hls" }] }]);
          player.play(true);
        } catch(e){}
      }, 2000);
    }

    player.on("error", recover);
    player.on("setupError", recover);
    player.on("firstFrame", function(){ recN = 0; });
    player.on("play", function(){ recN = 0; });
  }

  function waitReady(tries){
    fetch(MANIFEST, { cache: "no-store" })
      .then(function(r){ return r.text(); })
      .then(function(t){
        if (t.indexOf("#EXTINF") !== -1 || tries > 40){
          startPlayer();
        } else {
          setTimeout(function(){ waitReady(tries + 1); }, 500);
        }
      })
      .catch(function(){
        if (tries > 40){
          startPlayer();
        } else {
          setTimeout(function(){ waitReady(tries + 1); }, 500);
        }
      });
  }

  function begin(){
    connectWS();
    waitReady(0);
  }

  if ("serviceWorker" in navigator){
    navigator.serviceWorker.register("/sw.js", { scope: "/" })
      .then(function(){ return navigator.serviceWorker.ready; })
      .then(function(){
        if (navigator.serviceWorker.controller){
          begin();
        } else {
          navigator.serviceWorker.addEventListener("controllerchange", begin, { once: true });
          setTimeout(function(){
            if (!navigator.serviceWorker.controller) location.reload();
          }, 2500);
        }
      })
      .catch(function(e){
        begin();
      });
  } else {
    begin();
  }
})();
</script>
</body>
</html>
`;

export async function onRequest(context) {
    return new Response(HTML, {
        status: 200,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=60, stale-while-revalidate=120'
        }
    });
}
