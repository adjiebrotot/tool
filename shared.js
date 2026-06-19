/* ──────────────────────────────────────────────────────────────────────────
   Shared Design System — common formatting helpers
   Included by tools via <script src="../shared.js"></script>
   (load before the tool's own script.js)
   ────────────────────────────────────────────────────────────────────────── */
(function(global){
  function formatThousands(value, opts){
    opts = opts || {};
    var maxDecimals = opts.maxDecimals || 0;
    var allowNegative = !!opts.allowNegative;
    var s = String(value == null ? '' : value);
    var neg = allowNegative && /^\s*-/.test(s);
    if (maxDecimals <= 0) {
      var n = parseInt(s.replace(/[^0-9]/g,''), 10) || 0;
      var out = n.toLocaleString('en-US');
      return (neg && n !== 0) ? '-' + out : out;
    }
    s = s.replace(/[^0-9.]/g,'');
    var dot = s.indexOf('.');
    var intPart, decPart;
    if (dot === -1) { intPart = s; decPart = null; }
    else {
      intPart = s.slice(0, dot);
      decPart = s.slice(dot+1).replace(/\./g,'').slice(0, maxDecimals);
    }
    intPart = intPart.replace(/^0+(?=\d)/, '');
    if (intPart === '') intPart = '0';
    intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    var out = intPart + (decPart !== null ? '.' + decPart : '');
    if (neg && !/^0(\.0*)?$/.test(out)) out = '-' + out;
    return out;
  }

  function parseFormatted(value){
    var cleaned = String(value == null ? '' : value).replace(/,/g,'').trim();
    var n = parseFloat(cleaned);
    return isFinite(n) ? n : 0;
  }

  function liveFormat(el, opts){
    var pos = el.selectionStart;
    var oldLen = el.value.length;
    el.value = formatThousands(el.value, opts);
    var newLen = el.value.length;
    var newPos = Math.max(0, pos + (newLen - oldLen));
    if (document.activeElement === el) el.setSelectionRange(newPos, newPos);
  }

  function attachCurrencyInput(el, opts){
    opts = opts || {};
    el.addEventListener('input', function(){
      liveFormat(this, opts);
      if (typeof opts.onChange === 'function') opts.onChange(this);
    });
    el.addEventListener('blur', function(){
      liveFormat(this, opts);
      if (typeof opts.onChange === 'function') opts.onChange(this);
    });
  }

  global.SharedFmt = {
    formatThousands: formatThousands,
    parseFormatted: parseFormatted,
    liveFormat: liveFormat,
    attachCurrencyInput: attachCurrencyInput
  };

  /* ── Market data fetch — batched, self-hosted Worker only ──────────────────
     The simulator runs in the browser; Yahoo's chart endpoint
     (query1/query2.finance.yahoo.com/v8/finance/chart — what the Python
     `yfinance` library wraps) and Stooq's CSV endpoint send no CORS headers, so
     the page cannot call them directly. We relay through ONE self-hosted
     Cloudflare Worker (dcasimulator/yf-proxy-worker.js). The old public CORS
     proxies (allorigins/corsproxy/codetabs) were the unreliable part and have
     been removed entirely.

     REQUEST-MINIMISING DESIGN (Worker free tier = 100k requests/day):
       • BATCHING — fetchPricesBatch() sends every ticker in ONE request
         (?tickers=A,B,C). The Worker fans out to Yahoo/Stooq server-side, so N
         tickers cost ONE invocation instead of N.
       • NO PREFLIGHT — a GET with no custom headers is a "simple request", so
         the browser sends no OPTIONS preflight (no doubled invocation).
       • Source selection (Yahoo vs Stooq, FX/metal detection, exchange-suffix
         mapping) now lives in the Worker; the client just passes ticker strings.

     SETUP: deploy the Worker, then set WORKER_ENDPOINT below (or call
     SharedYF.setEndpoint('https://NAME.SUBDOMAIN.workers.dev') once at startup).
     ──────────────────────────────────────────────────────────────────────── */

  // ▼▼▼ Deployed market-data Worker (dcasimulator/yf-proxy-worker.js) ▼▼▼
  var WORKER_ENDPOINT = 'https://yfinance.adjiebrotots.workers.dev';
  // ▲▲▲ change here if the Worker is ever redeployed under a new name ▲▲▲

  var MAX_PER_REQUEST = 25; // must match the Worker's MAX_TICKERS cap

  /* ── SOFT DAILY REQUEST CAP (per device, via a 1-day cookie) ───────────────
     The Worker free tier is finite, so we nudge users to batch their loads. A
     "request" here is one Worker invocation (one batch of up to 25 tickers).
     Tickers already in the cache, and same-day reloads, cost nothing. The cap
     lives in a cookie that expires at the end of the local day; clearing cookies
     resets it — accepted friction, not a hard wall. The cookie is shared across
     the whole origin, so the single-asset and portfolio tools draw on the SAME
     daily allowance. */
  var DAILY_REQUEST_LIMIT = 5;
  var RATE_COOKIE = 'yf_req';

  function rlToday(){ return new Date().toISOString().slice(0,10); }
  function rlRead(){
    var jar = (typeof document !== 'undefined' ? document.cookie : '') || '';
    var m = jar.match(new RegExp('(?:^|;\\s*)' + RATE_COOKIE + '=([^;]+)'));
    if(!m) return { day: rlToday(), n: 0 };
    var parts = decodeURIComponent(m[1]).split('|');
    if(parts[0] !== rlToday()) return { day: rlToday(), n: 0 }; // new day → reset
    return { day: parts[0], n: parseInt(parts[1], 10) || 0 };
  }
  function rlWrite(n){
    if(typeof document === 'undefined') return;
    var exp = new Date(); exp.setHours(23, 59, 59, 999); // end of the local day
    document.cookie = RATE_COOKIE + '=' + encodeURIComponent(rlToday() + '|' + n) +
      '; expires=' + exp.toUTCString() + '; path=/; SameSite=Lax';
  }
  function rlRemaining(){ return Math.max(0, DAILY_REQUEST_LIMIT - rlRead().n); }
  function rlConsume(){ var c = rlRead(); rlWrite(c.n + 1); return Math.max(0, DAILY_REQUEST_LIMIT - (c.n + 1)); }

  // Merge two {dates, prices [, opens, highs, lows]} series (ascending ISO
  // dates), deduping by date so a freshly-fetched tail/front can be folded into
  // the cached history without re-downloading what we already hold. `b` wins on
  // overlapping dates. OHLC arrays are merged only when present on either input.
  function mergeSeries(a, b){
    var map = Object.create(null), i;
    function absorb(s){
      if(!s || !s.dates) return;
      for(i=0;i<s.dates.length;i++){
        map[s.dates[i]] = {
          p: s.prices ? s.prices[i] : undefined,
          o: s.opens ? s.opens[i] : undefined,
          h: s.highs ? s.highs[i] : undefined,
          l: s.lows  ? s.lows[i]  : undefined
        };
      }
    }
    absorb(a); absorb(b); // b wins on overlapping dates
    var dates = Object.keys(map).sort();
    var prices = dates.map(function(d){ return map[d].p; });
    var out = { dates: dates, prices: prices };
    var hasOHLC = (a && a.opens && a.highs && a.lows) || (b && b.opens && b.highs && b.lows);
    if(hasOHLC){
      out.opens = dates.map(function(d){ return map[d].o; });
      out.highs = dates.map(function(d){ return map[d].h; });
      out.lows  = dates.map(function(d){ return map[d].l; });
    }
    return out;
  }

  function yfIso(d){ return d.toISOString().slice(0,10); }

  async function workerFetchJson(url, timeoutMs){
    var controller = new AbortController();
    var timeoutId = setTimeout(function(){ controller.abort(); }, timeoutMs);
    try {
      var resp = await fetch(url, {signal: controller.signal, cache:'no-store'});
      if (!resp.ok) {
        // Prefer the Worker's own JSON error (e.g. the per-IP daily-limit
        // message on a 429) over a bare status code.
        var msg = 'Worker HTTP ' + resp.status;
        try { var j = await resp.json(); if (j && j.error) msg = j.error; } catch(_e){}
        throw new Error(msg);
      }
      return await resp.json();
    } catch(err){
      if (err && err.name === 'AbortError') throw new Error('timed out');
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function chunk(arr, size){
    var out = [];
    for (var i=0; i<arr.length; i+=size) out.push(arr.slice(i, i+size));
    return out;
  }

  // Fetch many tickers in as few Worker calls as possible. Returns a map
  // { TICKER: {dates, prices, source, kind} | {error} }. Never throws for an
  // individual bad ticker — only for a total transport failure of a batch.
  async function yfFetchPricesBatch(tickers, startDate, endDate){
    if (!WORKER_ENDPOINT || /REPLACE-WITH-YOUR-WORKER/.test(WORKER_ENDPOINT)){
      throw new Error('Market-data Worker endpoint not configured (set WORKER_ENDPOINT / SharedYF.setEndpoint)');
    }
    var list = (tickers || [])
      .map(function(t){ return String(t||'').trim().toUpperCase(); })
      .filter(Boolean);
    list = list.filter(function(t, i){ return list.indexOf(t) === i; }); // dedupe
    if (!list.length) return {};

    var start = String(startDate).slice(0,10);
    var end = String(endDate).slice(0,10);
    var base = WORKER_ENDPOINT.replace(/\/+$/, '');
    var enc = encodeURIComponent;

    var batches = chunk(list, MAX_PER_REQUEST);
    var merged = {};
    // Batches run in parallel; with ≤25 tickers (the common case) this is one call.
    // Each batch that actually reaches the Worker consumes one of the device's
    // daily requests. The .map() callbacks run synchronously in order, so the
    // remaining-count check and the consume happen deterministically per batch.
    var responses = await Promise.all(batches.map(function(group){
      if (rlRemaining() <= 0) {
        var blocked = {};
        group.forEach(function(t){
          blocked[t] = { error: 'daily data-request limit reached (' + DAILY_REQUEST_LIMIT + '/device/day)' };
        });
        return Promise.resolve(blocked);
      }
      rlConsume();
      var url = base + '/?tickers=' + enc(group.join(',')) +
                '&start=' + enc(start) + '&end=' + enc(end);
      return workerFetchJson(url, 20000).then(function(data){
        if (data && data.error && !data.results) throw new Error(data.error);
        return data && data.results ? data.results : {};
      }).catch(function(err){
        // Mark every ticker in a failed batch so callers can report it.
        var out = {};
        group.forEach(function(t){ out[t] = { error: (err && err.message) || 'fetch failed' }; });
        return out;
      });
    }));
    responses.forEach(function(r){ Object.assign(merged, r); });
    return merged;
  }

  // Single-ticker convenience wrapper (kept for the portfolio tool and any
  // caller that wants one series). Throws on failure like the old API.
  async function yfFetchPrices(ticker, startDate, endDate){
    var tk = String(ticker||'').trim().toUpperCase();
    var map = await yfFetchPricesBatch([tk], startDate, endDate);
    var r = map[tk];
    if (!r || r.error || !r.dates || !r.dates.length){
      throw new Error('Unable to fetch market data for ' + ticker +
        ' (' + ((r && r.error) || 'no data') + ')');
    }
    return r;
  }

  global.SharedYF = {
    fetchPrices: yfFetchPrices,
    fetchPricesBatch: yfFetchPricesBatch,
    mergeSeries: mergeSeries,
    setEndpoint: function(url){ WORKER_ENDPOINT = url || ''; },
    getEndpoint: function(){ return WORKER_ENDPOINT; },
    // Soft daily request cap (shared across both tools on this origin).
    getDailyLimit: function(){ return DAILY_REQUEST_LIMIT; },
    getDailyUsed: function(){ return rlRead().n; },
    getDailyRemaining: rlRemaining,
    // Back-compat aliases for the old self-proxy API.
    setProxy: function(url){ WORKER_ENDPOINT = url || ''; },
    getProxy: function(){ return WORKER_ENDPOINT; }
  };

  /* ── Global Tooltip ── */
  function initTooltip(){
    if (global.__sharedTooltipInit) return;
    global.__sharedTooltipInit = true;

    var tt = document.getElementById('globalTooltip');
    if (!tt) {
      tt = document.createElement('div');
      tt.id = 'globalTooltip';
      document.body.appendChild(tt);
    }
    if (!tt.querySelector('.tt-text')) {
      tt.innerHTML = '<div class="tt-text"></div><div class="tt-arrow"></div>';
    }
    var ttText = tt.querySelector('.tt-text');
    var ttArrow = tt.querySelector('.tt-arrow');
    var PAD = 8;
    var activeIcon = null;

    function hide(){
      activeIcon = null;
      tt.classList.remove('visible');
      tt.style.display = 'none';
    }

    // Position the tooltip against the currently-hovered icon. Called on
    // hover and re-called on scroll/resize so the bubble stays glued to the
    // trigger instead of drifting when the page moves underneath it.
    function position(){
      if (!activeIcon || !activeIcon.isConnected) { hide(); return; }

      tt.classList.remove('flip-below');

      var rect = activeIcon.getBoundingClientRect();
      // If the trigger has scrolled out of view, hide rather than float.
      if (rect.bottom < 0 || rect.top > window.innerHeight ||
          rect.right < 0 || rect.left > window.innerWidth) {
        tt.style.opacity = '0';
        return;
      }

      var ttW = tt.offsetWidth;
      var ttH = tt.offsetHeight;
      var iconCX = rect.left + rect.width / 2;

      var top = rect.top - ttH - 10;
      var left = iconCX - ttW / 2;

      if (top < PAD) {
        top = rect.bottom + 10;
        tt.classList.add('flip-below');
      }

      left = Math.max(PAD, Math.min(left, window.innerWidth - ttW - PAD));
      top = Math.max(PAD, Math.min(top, window.innerHeight - ttH - PAD));

      tt.style.left = left + 'px';
      tt.style.top = top + 'px';
      tt.style.opacity = '1';

      var arrowX = Math.max(10, Math.min(iconCX - left, ttW - 10));
      ttArrow.style.left = arrowX + 'px';
    }

    document.addEventListener('mouseover', function(e){
      var icon = e.target.closest('[data-tip]');
      if (!icon) { hide(); return; }
      var tip = icon.getAttribute('data-tip');
      if (!tip) { hide(); return; }

      activeIcon = icon;
      ttText.innerHTML = tip;
      tt.classList.add('visible');
      tt.style.display = 'block';
      tt.style.opacity = '0';
      position();
    });

    document.addEventListener('mouseout', function(e){
      var icon = e.target.closest('[data-tip]');
      if (!icon) return;
      if (!e.relatedTarget || !icon.contains(e.relatedTarget)) hide();
    });

    // Keep the bubble anchored to its trigger as the page scrolls or resizes.
    window.addEventListener('scroll', function(){
      if (activeIcon) position();
    }, true);
    window.addEventListener('resize', function(){
      if (activeIcon) position();
    });
  }

  global.SharedTooltip = { init: initTooltip };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTooltip);
  } else {
    initTooltip();
  }
})(window);
