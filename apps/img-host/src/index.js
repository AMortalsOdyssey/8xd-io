export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if ((path === "/" || path === "/index.html") && request.method === "GET") {
      return new Response(renderHomePage(), {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=300",
        },
      });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {
        status: 405,
        headers: {
          allow: "GET, HEAD, OPTIONS",
          ...corsHeaders(),
        },
      });
    }

    const key = objectKeyFromPath(path);
    if (!key) {
      return new Response("Object not found", { status: 404, headers: corsHeaders() });
    }

    const object = await env.IMAGES.get(key);
    if (!object) {
      return new Response("Object not found", {
        status: 404,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
          ...corsHeaders(),
        },
      });
    }

    const headers = new Headers(corsHeaders());
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    if (!headers.has("cache-control")) {
      headers.set("cache-control", "public, max-age=31536000, immutable");
    }

    return new Response(request.method === "HEAD" ? null : object.body, { headers });
  },
};

function objectKeyFromPath(pathname) {
  const raw = pathname.replace(/^\/+/, "");
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, HEAD, OPTIONS",
    "access-control-allow-headers": "*",
    "access-control-expose-headers": "ETag, Content-Type, Content-Length, Cache-Control",
    vary: "Origin",
  };
}

function renderHomePage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>img.8xd.io - R2 Image Host</title>
  <meta name="description" content="Cloudflare R2 image hosting on img.8xd.io.">
  <style>
    :root {
      --ink: #15212f;
      --muted: #657386;
      --paper: #fbfaf7;
      --line: #dfe7ee;
      --accent: #0f8f8c;
      --warm: #f4b860;
    }

    * {
      box-sizing: border-box;
    }

    html {
      min-height: 100%;
      color: var(--ink);
      background:
        linear-gradient(90deg, rgba(21, 33, 47, 0.055) 1px, transparent 1px),
        linear-gradient(180deg, rgba(21, 33, 47, 0.045) 1px, transparent 1px),
        var(--paper);
      background-size: 72px 72px, 72px 72px, auto;
      letter-spacing: 0;
    }

    body {
      min-height: 100vh;
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.5;
      overflow-x: hidden;
    }

    body::before {
      position: fixed;
      inset: 0;
      z-index: -1;
      content: "";
      background:
        radial-gradient(circle at 15% 20%, rgba(15, 143, 140, 0.12), transparent 32%),
        radial-gradient(circle at 85% 10%, rgba(244, 184, 96, 0.16), transparent 28%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.62), rgba(255, 255, 255, 0.22));
      animation: atmosphere 14s ease-in-out infinite alternate;
    }

    .shell {
      width: min(1120px, calc(100% - 40px));
      min-height: 100vh;
      margin: 0 auto;
      padding: 32px 0 44px;
      display: grid;
      grid-template-rows: auto 1fr;
      gap: 34px;
    }

    .nav {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 18px;
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      font-weight: 720;
      color: var(--ink);
    }

    .mark {
      width: 38px;
      height: 38px;
      border: 1px solid var(--line);
      border-radius: 10px;
      display: grid;
      place-items: center;
      background: rgba(255, 255, 255, 0.72);
      box-shadow: 0 12px 28px rgba(21, 33, 47, 0.08);
      position: relative;
      overflow: hidden;
    }

    .mark::before {
      width: 18px;
      height: 18px;
      border: 2px solid var(--accent);
      border-radius: 6px;
      content: "";
      transform: rotate(8deg);
    }

    main {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(320px, 460px);
      align-items: center;
      gap: 54px;
    }

    .hero {
      display: grid;
      gap: 26px;
      max-width: 670px;
    }

    .kicker {
      width: max-content;
      max-width: 100%;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: var(--accent);
      font-weight: 680;
      font-size: 14px;
    }

    .pulse {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 0 0 rgba(15, 143, 140, 0.34);
      animation: pulse 2.4s ease-out infinite;
    }

    h1 {
      margin: 0;
      color: var(--ink);
      font-size: clamp(46px, 9vw, 108px);
      line-height: 0.92;
      letter-spacing: 0;
      text-wrap: balance;
    }

    .lead {
      max-width: 650px;
      margin: 0;
      color: var(--muted);
      font-size: 18px;
    }

    .capabilities {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      max-width: 620px;
    }

    .capability {
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.68);
      box-shadow: 0 14px 32px rgba(21, 33, 47, 0.05);
    }

    .capability strong {
      display: block;
      color: var(--ink);
      font-size: 14px;
      margin-bottom: 5px;
    }

    .capability span {
      display: block;
      color: var(--muted);
      font-size: 13px;
    }

    .preview {
      position: relative;
      min-height: 500px;
      display: grid;
      place-items: center;
    }

    .stage {
      width: min(100%, 430px);
      aspect-ratio: 4 / 5;
      border: 1px solid var(--line);
      border-radius: 28px;
      padding: 18px;
      background: rgba(255, 255, 255, 0.66);
      box-shadow: 0 28px 80px rgba(21, 33, 47, 0.12);
      position: relative;
      overflow: hidden;
      animation: lift 7s ease-in-out infinite;
    }

    .stage::before {
      position: absolute;
      inset: 0;
      content: "";
      background: linear-gradient(120deg, transparent 10%, rgba(255, 255, 255, 0.72) 38%, transparent 62%);
      transform: translateX(-120%);
      animation: sheen 5.8s ease-in-out infinite;
      pointer-events: none;
    }

    .glass {
      border: 1px solid var(--line);
      border-radius: 22px;
      min-height: 194px;
      padding: 28px;
      background:
        linear-gradient(135deg, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.68)),
        linear-gradient(90deg, rgba(15, 143, 140, 0.10), transparent);
      display: grid;
      align-content: center;
      gap: 18px;
      position: relative;
      overflow: hidden;
    }

    .glass::after {
      position: absolute;
      inset: auto 22px 22px auto;
      width: 86px;
      height: 86px;
      border: 1px solid rgba(15, 143, 140, 0.24);
      border-radius: 24px;
      content: "";
      transform: rotate(8deg);
      background: rgba(15, 143, 140, 0.06);
    }

    .glass-title {
      margin: 0;
      color: var(--ink);
      font-size: 28px;
      line-height: 1.05;
    }

    .glass-copy {
      margin: 0;
      color: var(--muted);
      max-width: 285px;
    }

    .details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 14px;
    }

    .tile {
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 14px;
      background: rgba(255, 255, 255, 0.7);
    }

    .tile strong {
      display: block;
      font-size: 13px;
      color: var(--ink);
      margin-bottom: 4px;
    }

    .tile span {
      display: block;
      color: var(--muted);
      font-size: 13px;
    }

    .rail {
      position: absolute;
      right: 18px;
      bottom: 18px;
      left: 18px;
      height: 6px;
      border-radius: 999px;
      background: rgba(21, 33, 47, 0.08);
      overflow: hidden;
    }

    .rail::before {
      display: block;
      width: 38%;
      height: 100%;
      border-radius: inherit;
      background: var(--accent);
      content: "";
      animation: transfer 3.5s ease-in-out infinite;
    }

    @keyframes atmosphere {
      from { opacity: 0.74; transform: translateY(0); }
      to { opacity: 1; transform: translateY(-12px); }
    }

    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(15, 143, 140, 0.34); }
      72% { box-shadow: 0 0 0 14px rgba(15, 143, 140, 0); }
      100% { box-shadow: 0 0 0 0 rgba(15, 143, 140, 0); }
    }

    @keyframes lift {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }

    @keyframes sheen {
      0%, 18% { transform: translateX(-120%); }
      52%, 100% { transform: translateX(120%); }
    }

    @keyframes transfer {
      0% { transform: translateX(-110%); }
      50%, 100% { transform: translateX(275%); }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 1ms !important;
        animation-iteration-count: 1 !important;
        scroll-behavior: auto !important;
      }
    }

    @media (max-width: 860px) {
      .shell {
        width: min(100% - 28px, 680px);
        padding-top: 24px;
      }

      main {
        grid-template-columns: 1fr;
        gap: 34px;
        align-items: start;
      }

      .preview {
        min-height: auto;
      }

      .stage {
        width: 100%;
        aspect-ratio: auto;
      }

    }

    @media (max-width: 520px) {
      .nav {
        align-items: flex-start;
        flex-direction: column;
      }

      h1 {
        font-size: 54px;
      }

      .lead {
        font-size: 16px;
      }

      .capabilities {
        grid-template-columns: 1fr;
      }

      .details {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header class="nav" aria-label="Site header">
      <div class="brand" aria-label="img.8xd.io">
        <span class="mark" aria-hidden="true"></span>
        <span>img.8xd.io</span>
      </div>
    </header>

    <main>
      <section class="hero" aria-labelledby="title">
        <div class="kicker"><span class="pulse" aria-hidden="true"></span>R2 image host is online</div>
        <h1 id="title">img.8xd.io</h1>
        <p class="lead">Public image delivery on Cloudflare R2 with edge routing, browser-safe reads, and durable object storage.</p>

        <div class="capabilities" aria-label="Image host capabilities">
          <div class="capability">
            <strong>Public delivery</strong>
            <span>Direct object access</span>
          </div>
          <div class="capability">
            <strong>Edge routing</strong>
            <span>Cloudflare Worker front door</span>
          </div>
          <div class="capability">
            <strong>Browser reads</strong>
            <span>CORS for GET and HEAD</span>
          </div>
        </div>
      </section>

      <aside class="preview" aria-label="Image host capability panel">
        <div class="stage">
          <div class="glass">
            <h2 class="glass-title">R2 image host</h2>
            <p class="glass-copy">Stable storage, public reads, and lightweight edge handling for hosted media.</p>
          </div>
          <div class="details">
            <div class="tile">
              <strong>Storage</strong>
              <span>Cloudflare R2</span>
            </div>
            <div class="tile">
              <strong>Access</strong>
              <span>Public object URLs</span>
            </div>
            <div class="tile">
              <strong>CORS</strong>
              <span>GET and HEAD</span>
            </div>
            <div class="tile">
              <strong>Format</strong>
              <span>Object key routing</span>
            </div>
          </div>
          <div class="rail" aria-hidden="true"></div>
        </div>
      </aside>
    </main>
  </div>
</body>
</html>`;
}
