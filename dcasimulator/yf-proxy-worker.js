/* ──────────────────────────────────────────────────────────────────────────
   yf-proxy-worker.js — your own Yahoo Finance proxy (the real failsafe)

   WHY: The DCA simulator runs entirely in the browser. Yahoo's chart endpoint
   (query1/query2.finance.yahoo.com/v8/finance/chart — the exact endpoint the
   Python `yfinance` library also uses) does not send CORS headers, so the page
   relays through free public proxies (allorigins, corsproxy, codetabs, jina).
   Those free proxies are the flaky part and cause the intermittent failures.

   This is a tiny Cloudflare Worker that does the relay itself: it fetches
   Yahoo with a real browser User-Agent, adds permissive CORS headers, and
   caches each response at Cloudflare's edge for a few minutes (so repeat loads
   and rate-limit pressure both drop sharply). Once deployed, point the page at
   it and you stop depending on third-party proxies entirely.

   DEPLOY (free tier — 100k requests/day is plenty):
     1. https://dash.cloudflare.com → Workers & Pages → Create → Worker.
     2. Replace the worker code with this file's contents and Deploy.
     3. (Optional) add a custom domain/route, e.g. yf.adjiebrotots.com.
     4. In the simulator, after shared.js loads, call once:
          SharedYF.setProxy('https://YOUR-WORKER-URL/?url=');
        e.g. SharedYF.setProxy('https://yf.adjiebrotots.com/?url=');
        With it set, your worker is tried FIRST and the public proxies remain
        as automatic fallbacks — so you get reliability without a single point
        of failure.

   SECURITY: the allowlist below restricts this proxy to Yahoo's finance hosts
   only, so it can't be abused as an open proxy.
   ────────────────────────────────────────────────────────────────────────── */

const ALLOWED_HOSTS = new Set([
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
  'stooq.com',
]);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, _env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    const target = new URL(request.url).searchParams.get('url');
    if (!target) {
      return json({ error: 'Missing ?url= parameter' }, 400);
    }

    let upstream;
    try {
      upstream = new URL(target);
    } catch {
      return json({ error: 'Invalid url' }, 400);
    }
    if (upstream.protocol !== 'https:' || !ALLOWED_HOSTS.has(upstream.hostname)) {
      return json({ error: 'Host not allowed' }, 403);
    }

    // Edge cache keyed by the upstream URL — collapses repeat loads and eases
    // Yahoo rate limiting. Drop the page's cache-buster from the cache key.
    const cache = caches.default;
    const cacheKey = new Request(upstream.toString(), { method: 'GET' });
    const cached = await cache.match(cacheKey);
    if (cached) return withCors(cached);

    let resp;
    try {
      resp = await fetch(upstream.toString(), {
        headers: {
          // A real browser UA avoids Yahoo's bot throttling.
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          'Accept': 'application/json,text/plain,*/*',
        },
        cf: { cacheTtl: 300, cacheEverything: true },
      });
    } catch (err) {
      return json({ error: 'Upstream fetch failed', detail: String(err) }, 502);
    }

    const body = await resp.text();
    const out = new Response(body, {
      status: resp.status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
    if (resp.ok) ctx.waitUntil(cache.put(cacheKey, out.clone()));
    return out;
  },
};

function withCors(resp) {
  const r = new Response(resp.body, resp);
  for (const [k, v] of Object.entries(CORS_HEADERS)) r.headers.set(k, v);
  return r;
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
