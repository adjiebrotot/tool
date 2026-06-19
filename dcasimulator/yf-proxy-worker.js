/* ──────────────────────────────────────────────────────────────────────────
   yf-proxy-worker.js — batched market-data Worker for the DCA simulator

   WHY THIS EXISTS
   The simulator runs entirely in the browser. Yahoo's chart endpoint
   (query1/query2.finance.yahoo.com/v8/finance/chart — the same endpoint the
   Python `yfinance` library wraps) and Stooq's CSV endpoint do not send CORS
   headers, so a page cannot call them directly. The old design relayed through
   flaky public CORS proxies (allorigins / corsproxy / codetabs). Those were the
   unreliable part. This Worker replaces them entirely.

   PRIME DIRECTIVE: MINIMISE WORKER INVOCATIONS (free tier = 100k/day).
   The levers baked in here:
     1. BATCHING — one request carries every ticker the user wants
        (?tickers=AAPL,SPY,USDIDR). The browser makes ONE call instead of one
        per ticker. The fan-out to Yahoo/Stooq happens here as subrequests
        (free tier allows 50 subrequests per invocation), so a packed request
        costs exactly one invocation regardless of how many tickers it carries.
     2. NO CORS PREFLIGHT — this is a GET with no custom request headers, which
        is a "simple request": the browser does NOT send an OPTIONS preflight,
        so we are not charged a second invocation per call.
     3. EDGE CACHE — each (ticker, range) upstream response is cached at the
        edge (caches.default), collapsing repeat loads and easing Yahoo's rate
        limiting.
     4. ORIGIN LOCK — requests whose Origin/Referer is not tool.adjiebrotots.com
        are rejected, and CORS is pinned to that exact origin so other websites'
        browsers cannot read responses. (A static site cannot hold a real
        secret, so this is "friction + browser-level lock", not 100% private.)

   DEPLOY (workers.dev — adjiebrotots.com is NOT on Cloudflare DNS, so no custom
   domain / WAF / zone cache is available; all protection lives in this file):
     1. https://dash.cloudflare.com → Workers & Pages → Create → Worker.
     2. Replace the worker code with this file's contents and Deploy.
     3. Copy the deployed URL (https://NAME.SUBDOMAIN.workers.dev) and set it as
        WORKER_ENDPOINT in shared.js (SharedYF). That single edit wires the apps.
     4. Bind a KV namespace as RATE_KV to switch on the per-IP daily cap — see
        the IP_DAILY_LIMIT block below for the 3-step dashboard setup. Without
        it the Worker still runs; only the server-side backstop is disabled.
     5. Optional hardening in the dashboard: Settings → enable "Bot Fight Mode"
        is zone-only and unavailable here, but you CAN reduce blast radius by
        keeping ALLOWED_ORIGINS tight (below) and the per-request ticker cap.
   ────────────────────────────────────────────────────────────────────────── */

// Only these origins may use the Worker. Keep this tight — it is the main lock.
const ALLOWED_ORIGINS = [
  'https://tool.adjiebrotots.com',
  // Local development. Remove these two lines if you want production-only access.
  'http://localhost',
  'http://127.0.0.1',
];

// Safety rails. Each ticker costs up to ~2 subrequests (Yahoo then Stooq); the
// free tier allows 50 subrequests/invocation, so 25 tickers is a safe ceiling.
const MAX_TICKERS = 25;
const UPSTREAM_TIMEOUT_MS = 12000;
const EDGE_CACHE_TTL = 600; // seconds the edge keeps an upstream price response

/* ── PER-IP DAILY LIMIT (the real backstop) ────────────────────────────────
   The client also keeps a per-device cookie (5/day) as a UX nudge, but cookies
   are trivially cleared. This server-side cap is the hard limit: one COUNT per
   Worker invocation (a request carries up to 25 tickers, so batching is still
   rewarded), keyed by the visitor's IP and the UTC date, stored in Workers KV.

   It is deliberately MORE generous than the cookie because many people share a
   public IP (mobile carriers, offices, schools via CGNAT/NAT) — a tight per-IP
   cap would punish them. The cookie nudges individuals to ~5/day; this catches
   a single source hammering hundreds of requests.

   SETUP (Workers KV, dashboard-friendly):
     1. Cloudflare dashboard → Storage & Databases → KV → Create namespace
        (e.g. "yf_rate").
     2. Your Worker → Settings → Bindings → Add → KV namespace. Set the
        Variable name to exactly RATE_KV and pick the namespace.
     3. Redeploy. With no binding present the Worker FAILS OPEN (no IP cap), so
        it keeps working before/without KV — only the backstop is disabled.
   Free KV allows 1k writes/day; we write at most IP_DAILY_LIMIT times per IP
   per day. If traffic ever outgrows that, move this counter to a Durable
   Object (strongly consistent) — the call sites below stay the same. */
const IP_DAILY_LIMIT = 40;
const IP_KV_TTL = 60 * 60 * 36; // counter auto-expires ~1.5 days after last write

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/* ── FX / market mapping (mirrors classify() in shared.js) ─────────────────── */
const FX_CODES = {
  USD:1,EUR:1,GBP:1,JPY:1,AUD:1,NZD:1,CAD:1,CHF:1,CNY:1,CNH:1,HKD:1,SGD:1,
  IDR:1,INR:1,MYR:1,KRW:1,THB:1,PHP:1,VND:1,TWD:1,ZAR:1,BRL:1,MXN:1,RUB:1,
  TRY:1,SEK:1,NOK:1,DKK:1,PLN:1,CZK:1,HUF:1,AED:1,SAR:1,ILS:1,
  XAU:1,XAG:1,XPT:1,XPD:1,
};
const STOOQ_SUFFIX = {
  AX:'au', L:'uk', DE:'de', PA:'fr', AS:'nl', BR:'be', LS:'pt', MC:'es',
  MI:'it', SW:'ch', VI:'at', ST:'se', HE:'fi', OL:'no', CO:'dk', HK:'hk',
  T:'jp', SS:'cn', SZ:'cn', TO:'ca', V:'ca',
};
// Precious metals have no spot "<METAL>USD=X" symbol on Yahoo (that path 404s),
// so when Stooq's spot series is unavailable we fall back to the COMEX/NYMEX
// continuous futures contract, which Yahoo's chart endpoint does serve.
const METAL_FUTURES = { XAU:'GC=F', XAG:'SI=F', XPT:'PL=F', XPD:'PA=F' };

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const referer = request.headers.get('Referer') || '';
    const allowedOrigin = resolveAllowedOrigin(origin, referer);

    // Preflight should never happen for a simple GET, but answer it cheaply if
    // some client sends one anyway.
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(allowedOrigin) });
    }
    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405, allowedOrigin);
    }

    // ORIGIN LOCK: reject anything not coming from an allowed origin. Browsers
    // always send Origin on cross-origin fetch and cannot forge it; non-browser
    // clients can spoof it, which is the accepted "friction, not fortress".
    if (!allowedOrigin) {
      return json({ error: 'Forbidden' }, 403, null);
    }

    const params = new URL(request.url).searchParams;
    const start = (params.get('start') || '').slice(0, 10);
    const end = (params.get('end') || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      return json({ error: 'start and end must be YYYY-MM-DD' }, 400, allowedOrigin);
    }

    const raw = (params.get('tickers') || '').split(',')
      .map(t => t.trim().toUpperCase()).filter(Boolean);
    const tickers = [...new Set(raw)].slice(0, MAX_TICKERS);
    if (!tickers.length) {
      return json({ error: 'Missing tickers parameter' }, 400, allowedOrigin);
    }

    // PER-IP DAILY CAP — the hard backstop. Checked after validation so bad
    // requests don't burn quota, and before fan-out so a blocked caller never
    // touches Yahoo/Stooq. Fails open if KV isn't bound.
    const ipCheck = await checkIpDailyLimit(request, env, ctx);
    if (ipCheck.blocked) {
      return json({
        error: 'Daily request limit reached for your network (' + IP_DAILY_LIMIT +
               '/day). It resets at 00:00 UTC. Tip: load all tickers in one request.',
      }, 429, allowedOrigin, { 'Retry-After': '3600' });
    }

    // Fan out — one subrequest chain per ticker, all in parallel.
    const settled = await Promise.all(
      tickers.map(t => fetchOneTicker(t, start, end, ctx)
        .then(data => [t, data])
        .catch(err => [t, { error: String(err && err.message || err) }]))
    );

    const results = {};
    for (const [t, data] of settled) results[t] = data;

    return json({ results, asOf: new Date().toISOString() }, 200, allowedOrigin, {
      // Let the browser cache the batched answer briefly too.
      'Cache-Control': 'public, max-age=120',
    });
  },
};

/* ── Per-IP daily cap via Workers KV ────────────────────────────────────────
   Counts one per Worker invocation. Returns { blocked } — fails OPEN on any
   missing binding or KV error so data fetching never breaks because of the cap.
   KV is eventually consistent, so racing requests from one IP may under-count
   slightly; that's acceptable for a soft backstop. */
async function checkIpDailyLimit(request, env, ctx) {
  if (!env || !env.RATE_KV) return { blocked: false, disabled: true };
  const ip = request.headers.get('CF-Connecting-IP') ||
             (request.headers.get('X-Forwarded-For') || '').split(',')[0].trim() ||
             'unknown';
  const day = new Date().toISOString().slice(0, 10); // UTC date
  const key = 'ip:' + day + ':' + ip;
  let count = 0;
  try {
    const v = await env.RATE_KV.get(key);
    count = v ? (parseInt(v, 10) || 0) : 0;
  } catch (_) {
    return { blocked: false }; // KV read failed → fail open
  }
  if (count >= IP_DAILY_LIMIT) return { blocked: true, count };
  // Best-effort increment; don't block the response on the write.
  ctx.waitUntil(
    env.RATE_KV.put(key, String(count + 1), { expirationTtl: IP_KV_TTL }).catch(() => {})
  );
  return { blocked: false, count: count + 1 };
}

/* ── Per-ticker fetch: pick sources, try in order, parse, return series ─────── */
async function fetchOneTicker(ticker, start, end, ctx) {
  const providers = classify(ticker, start, end);
  let lastError = null;
  for (const p of providers) {
    try {
      const text = await edgeFetch(p.url, ctx);
      const series = p.parse(text);
      return {
        dates: series.dates,
        prices: series.prices,
        // OHLC for candlestick view (split/dividend-adjusted to match `prices`).
        ...(series.opens && series.highs && series.lows
          ? { opens: series.opens, highs: series.highs, lows: series.lows } : {}),
        source: p.source,
        kind: p.kind,
      };
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(lastError && lastError.message ? lastError.message : 'all sources failed');
}

// Fetch with an edge cache keyed on the upstream URL. A cache hit still counts
// as an invocation (the worker ran), but it spares Yahoo/Stooq the load and
// dodges their rate limits, which keeps the batched calls succeeding.
async function edgeFetch(url, ctx) {
  const cache = caches.default;
  const cacheKey = new Request(url, { method: 'GET' });
  const hit = await cache.match(cacheKey);
  if (hit) return await hit.text();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  let resp;
  try {
    resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': BROWSER_UA, 'Accept': 'application/json,text/csv,text/plain,*/*' },
      cf: { cacheTtl: EDGE_CACHE_TTL, cacheEverything: true },
    });
  } finally {
    clearTimeout(timer);
  }
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const body = await resp.text();
  if (resp.ok) {
    const toCache = new Response(body, {
      headers: { 'Cache-Control': 'public, max-age=' + EDGE_CACHE_TTL },
    });
    ctx.waitUntil(cache.put(cacheKey, toCache));
  }
  return body;
}

/* ── Source classification (server-side port of shared.js classify) ────────── */
function classify(ticker, startDate, endDate) {
  const t = String(ticker || '').trim().toUpperCase();
  if (!t) throw new Error('Invalid ticker');
  const enc = encodeURIComponent;
  const s = Math.floor(new Date(startDate).getTime() / 1000);
  const e = Math.floor(new Date(endDate).getTime() / 1000 + 86400);
  const cb = new Date().toISOString().slice(0, 10);
  const d1 = compactDate(startDate), d2 = compactDate(endDate);

  function yahoo(sym, kind) {
    const p = 'period1=' + s + '&period2=' + e + '&interval=1d&events=history&_cb=' + cb;
    return [
      { source: 'yahoo', kind, parse: parseYahoo, url: 'https://query1.finance.yahoo.com/v8/finance/chart/' + enc(sym) + '?' + p },
      { source: 'yahoo', kind, parse: parseYahoo, url: 'https://query2.finance.yahoo.com/v8/finance/chart/' + enc(sym) + '?' + p },
    ];
  }
  function stooq(sym, kind) {
    return { source: 'stooq', kind, parse: parseStooq,
      url: 'https://stooq.com/q/d/l/?s=' + enc(sym) + '&i=d&d1=' + d1 + '&d2=' + d2 };
  }

  // Spot FX / metals: 'USDIDR', 'XAUUSD', or Yahoo's 'USDIDR=X' form.
  const core = t.replace(/=X$/, '');
  const isFx = /^[A-Z]{6}$/.test(core) && FX_CODES[core.slice(0, 3)] && FX_CODES[core.slice(3, 6)];
  if (/=X$/.test(t) || isFx) {
    // Stooq is the better source for spot FX/metals → try it first.
    const providers = [stooq(core.toLowerCase(), 'fx')];
    // For metals quoted in USD (XAUUSD, XAGUSD, …) Yahoo has no '=X' spot symbol,
    // so add the futures contract as a working fallback BEFORE the '=X' attempt.
    const metalFut = METAL_FUTURES[core.slice(0, 3)];
    if (metalFut && core.slice(3, 6) === 'USD') providers.push(...yahoo(metalFut, 'fx'));
    providers.push(...yahoo(core + '=X', 'fx'));
    return providers;
  }

  // Stocks / ETFs / indices: Yahoo first (adjusted close), Stooq fallback.
  const providers = [...yahoo(t, 'stock')];
  const dot = t.indexOf('.');
  if (dot < 0) {
    providers.push(stooq(t.toLowerCase() + '.us', 'stock'));
  } else {
    const suffix = STOOQ_SUFFIX[t.slice(dot + 1)];
    if (suffix) providers.push(stooq(t.slice(0, dot).toLowerCase() + '.' + suffix, 'stock'));
  }
  return providers;
}

function parseYahoo(text) {
  const jsonStart = text.indexOf('{');
  const data = JSON.parse(jsonStart > 0 ? text.slice(jsonStart) : text);
  const result = data && data.chart && data.chart.result && data.chart.result[0];
  if (!result) throw new Error('No chart result');
  const ts = result.timestamp;
  const ind = result.indicators || {};
  const quote = (ind.quote && ind.quote[0]) || {};
  const adj = (ind.adjclose && ind.adjclose[0] && ind.adjclose[0].adjclose) || null;
  const closes = adj || quote.close;              // adjusted close preferred for returns
  const rawCloses = quote.close || adj;           // unadjusted close, for the OHLC ratio
  if (!ts || !closes) throw new Error('No price series');
  const opensR = quote.open, highsR = quote.high, lowsR = quote.low;
  const dates = [], prices = [], opens = [], highs = [], lows = [];
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (c == null) continue;
    dates.push(new Date(ts[i] * 1000).toISOString().slice(0, 10));
    prices.push(c);
    // Scale O/H/L by the same split/dividend factor as the adjusted close so the
    // candles line up with the price series the simulator uses everywhere else.
    const rawC = rawCloses && rawCloses[i];
    const ratio = (rawC != null && isFinite(rawC) && rawC !== 0) ? c / rawC : 1;
    const o = (opensR && opensR[i] != null) ? opensR[i] * ratio : c;
    const h = (highsR && highsR[i] != null) ? highsR[i] * ratio : c;
    const l = (lowsR && lowsR[i] != null) ? lowsR[i] * ratio : c;
    opens.push(o); highs.push(Math.max(o, h, c)); lows.push(Math.min(o, l, c));
  }
  if (!dates.length) throw new Error('Empty price series');
  return { dates, prices, opens, highs, lows };
}

function parseStooq(text) {
  const t = (text || '').trim();
  if (!/^Date,/i.test(t)) throw new Error(t.slice(0, 60) || 'No CSV');
  const lines = t.split(/\r?\n/);
  const header = lines[0].split(',');
  const di = header.indexOf('Date'), ci = header.indexOf('Close');
  const oi = header.indexOf('Open'), hi = header.indexOf('High'), li = header.indexOf('Low');
  if (di < 0 || ci < 0) throw new Error('Unexpected CSV columns');
  const dates = [], prices = [], opens = [], highs = [], lows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const cols = lines[i].split(',');
    const px = parseFloat(cols[ci]);
    if (!isFinite(px)) continue;
    dates.push(cols[di].slice(0, 10));
    prices.push(px);
    // Stooq OHLC is unadjusted but internally consistent (same scale as Close).
    const o = oi >= 0 ? parseFloat(cols[oi]) : NaN;
    const h = hi >= 0 ? parseFloat(cols[hi]) : NaN;
    const l = li >= 0 ? parseFloat(cols[li]) : NaN;
    const oo = isFinite(o) ? o : px, hh = isFinite(h) ? h : px, ll = isFinite(l) ? l : px;
    opens.push(oo); highs.push(Math.max(oo, hh, px)); lows.push(Math.min(oo, ll, px));
  }
  if (!dates.length) throw new Error('Empty CSV');
  return { dates, prices, opens, highs, lows };
}

function compactDate(isoStr) { return String(isoStr).slice(0, 10).replace(/-/g, ''); }

/* ── CORS / origin helpers ─────────────────────────────────────────────────── */
// Returns the EXACT request origin to echo in Access-Control-Allow-Origin
// (CORS requires an exact match, so we never substitute the allowlist base), or
// null if the origin is not allowed. localhost/127.0.0.1 are allowed on any port.
function resolveAllowedOrigin(origin, referer) {
  const candidate = origin || refererOrigin(referer);
  if (!candidate) return null;
  for (const a of ALLOWED_ORIGINS) {
    if (candidate === a) return candidate;
    const devHost = (a === 'http://localhost' || a === 'http://127.0.0.1');
    if (devHost && candidate.startsWith(a + ':')) return candidate; // dev with port
  }
  return null;
}
function refererOrigin(referer) {
  try { return new URL(referer).origin; } catch { return ''; }
}
function corsHeaders(allowedOrigin) {
  const h = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
  if (allowedOrigin) h['Access-Control-Allow-Origin'] = allowedOrigin;
  return h;
}
function json(obj, status, allowedOrigin, extra) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders(allowedOrigin), 'Content-Type': 'application/json; charset=utf-8', ...(extra || {}) },
  });
}
