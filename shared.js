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

  /* ── Frequency conversion ───────────────────────────────────────────────
     A per-period amount only means something next to its period: $500 a month
     is $6,000 a year, not $500 a year. So when a frequency control moves, the
     amount beside it is rescaled to keep describing the same real-world money,
     instead of silently changing what was entered by a factor of twelve.

     The result is rounded back to the field's own precision, because the
     arithmetic does not always land on a round figure: $500 a week is
     2,166.6666666666665 a month, which nobody wants to read. It becomes
     2,166.67, or 2,167 in a field that takes no decimals.
     ───────────────────────────────────────────────────────────────────────── */
  var FREQ_PER_YEAR = {
    daily: 365, weekly: 52, fortnightly: 26, monthly: 12, quarterly: 4, yearly: 1
  };

  // null for a period this table does not know — a caller's "% of value" or
  // "fixed" basis, say, which is not a frequency and must not be rescaled.
  function convertFrequency(amount, from, to, maxDecimals){
    var f = FREQ_PER_YEAR[from], t = FREQ_PER_YEAR[to];
    if (!f || !t || !isFinite(amount)) return null;
    if (f === t) return amount;
    var p = Math.pow(10, maxDecimals == null ? 2 : maxDecimals);
    return Math.round(amount * f / t * p) / p;
  }

  /* Wires a <select> of periods to the amount input beside it.
       maxDecimals  the field's precision (default 2)
       format       value -> display string (default: the shared formatter)
       skip         () -> true when the amount is not money this period (a
                    percentage basis, say), so the value is left alone
       onChange     called with (value, input) after a conversion
     Both `input` and `change` are listened for, since a select fires input
     first: converting there puts the new amount in place before any listener
     the tool has already hung on the same events reads the form. The second
     event then finds nothing left to do. */
  function attachFrequencySelect(sel, input, opts){
    if (!sel || !input) return;
    opts = opts || {};
    var decimals = opts.maxDecimals == null ? 2 : opts.maxDecimals;
    var format = opts.format || function(v){
      return formatThousands(String(v), {maxDecimals: decimals, allowNegative: true});
    };
    var prev = sel.value;
    // A preset or a loaded config sets the control without firing an event, so
    // the period we convert FROM is re-read as the user reaches for the select.
    function syncPrev(){ prev = sel.value; }
    sel.addEventListener('focus', syncPrev);
    sel.addEventListener('mousedown', syncPrev);

    function onPeriodChange(){
      var from = prev, to = sel.value;
      prev = to;
      if (from === to) return;
      if (typeof opts.skip === 'function' && opts.skip()) return;
      var raw = String(input.value == null ? '' : input.value).trim();
      if (raw === '') return;
      var next = convertFrequency(parseFormatted(raw), from, to, decimals);
      if (next === null) return;
      input.value = format(next);
      if (typeof opts.onChange === 'function') opts.onChange(next, input);
    }
    sel.addEventListener('input', onPeriodChange);
    sel.addEventListener('change', onPeriodChange);
  }

  global.SharedFreq = {
    perYear: FREQ_PER_YEAR,
    convert: convertFrequency,
    attachSelect: attachFrequencySelect
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
    // Soft daily request cap (shared across both tools on this origin).
    getDailyLimit: function(){ return DAILY_REQUEST_LIMIT; },
    getDailyRemaining: rlRemaining
  };

  /* ── Persistent price cache (shared with the DCA tools) ───────────────────
     A past date's price never changes, so a fetched series is kept in
     localStorage and reused. The storage key and the entry shape are
     DELIBERATELY identical to the DCA simulator's, so a ticker loaded on
     either page is free on the other.

     Anything written here must keep every field the DCA tools read back:
     they use `source`/`kind` to flag unadjusted Stooq prices, and
     `coverageStart`/`coverageEnd` to decide whether a refetch is needed.

     There is no TTL, by design. `coverageEnd` is the last date we asked for,
     so on the next calendar day it stops reaching "today" and the caller
     refetches just the tail. Same-day reloads cost zero requests, which
     matters because the whole origin shares one small daily allowance. */
  var PRICE_CACHE_KEY = 'dca_priceCache_v2';
  var priceCache = {};
  var priceCacheLoaded = false;
  var pcInFlight = {};

  function pcMinIso(a, b){ return (a && a < b) ? a : b; }
  function pcMaxIso(a, b){ return (a && a > b) ? a : b; }
  function pcKey(t){ return String(t == null ? '' : t).trim().toUpperCase(); }

  function pcLoad(){
    if(priceCacheLoaded) return priceCache;
    priceCacheLoaded = true;
    try {
      var raw = localStorage.getItem(PRICE_CACHE_KEY);
      if(raw){
        var parsed = JSON.parse(raw);
        if(parsed && parsed.cache && typeof parsed.cache === 'object') priceCache = parsed.cache;
      }
    } catch(_e){ /* corrupt or unavailable storage - start empty */ }
    return priceCache;
  }

  function pcSave(){
    try { localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify({savedAt: Date.now(), cache: priceCache})); }
    catch(_e){ /* quota or private mode - caching is best-effort */ }
  }

  // Fold one Worker result into the cache. Merges rather than replaces, so an
  // incremental front/tail fetch never discards history we already hold.
  function pcStore(tk, r, fetchStart, fetchEnd){
    if(!(r && !r.error && r.dates && r.dates.length)) return false;
    var prev = priceCache[tk];
    var dates = r.dates, prices = r.prices, opens = r.opens, highs = r.highs, lows = r.lows;
    if(prev && prev.dates && prev.dates.length){
      var m = mergeSeries(
        {dates: prev.dates, prices: prev.prices, opens: prev.opens, highs: prev.highs, lows: prev.lows},
        {dates: r.dates,    prices: r.prices,    opens: r.opens,    highs: r.highs,    lows: r.lows});
      dates = m.dates; prices = m.prices; opens = m.opens; highs = m.highs; lows = m.lows;
    }
    var entry = {
      dates: dates,
      prices: prices,
      cachedStart: dates[0],
      cachedEnd: dates[dates.length - 1],
      coverageStart: prev ? pcMinIso(prev.coverageStart, fetchStart) : fetchStart,
      coverageEnd:   prev ? pcMaxIso(prev.coverageEnd, fetchEnd)     : fetchEnd,
      source: r.source,
      kind: r.kind
    };
    if(opens && highs && lows){ entry.opens = opens; entry.highs = highs; entry.lows = lows; }
    priceCache[tk] = entry;
    return true;
  }

  function pcCovered(ticker, start, end){
    pcLoad();
    var e = priceCache[pcKey(ticker)];
    return !!(e && e.coverageStart <= start && e.coverageEnd >= end);
  }

  // A {dates, prices, [opens, highs, lows], source, kind} slice of the cache,
  // filtered to [start, end]. Null when nothing cached covers that window.
  function pcSlice(ticker, start, end){
    pcLoad();
    var e = priceCache[pcKey(ticker)];
    if(!e || !e.dates || !e.dates.length) return null;
    var si = -1, ei = -1, i;
    for(i = 0; i < e.dates.length; i++){ if(e.dates[i] >= start){ si = i; break; } }
    for(i = e.dates.length - 1; i >= 0; i--){ if(e.dates[i] <= end){ ei = i; break; } }
    if(si < 0 || ei < 0 || si > ei) return null;
    var out = {
      dates: e.dates.slice(si, ei + 1),
      prices: e.prices.slice(si, ei + 1),
      source: e.source,
      kind: e.kind
    };
    if(e.opens && e.highs && e.lows){
      out.opens = e.opens.slice(si, ei + 1);
      out.highs = e.highs.slice(si, ei + 1);
      out.lows  = e.lows.slice(si, ei + 1);
    }
    return out;
  }

  // Guarantee [start, end] is covered, fetching ONLY the missing front/tail
  // segments. Concurrent callers for the same ticker share one fetch.
  async function pcEnsure(ticker, start, end){
    var tk = pcKey(ticker);
    if(!tk) throw new Error('Invalid ticker');
    pcLoad();
    if(pcCovered(tk, start, end)) return priceCache[tk];
    if(pcInFlight[tk]){ await pcInFlight[tk]; return priceCache[tk]; }
    pcInFlight[tk] = (async function(){
      var prev = priceCache[tk];
      var segments = [];
      if(!prev){
        segments.push([start, end]);
      } else {
        if(start < prev.coverageStart) segments.push([start, prev.coverageStart]);
        if(end   > prev.coverageEnd)   segments.push([prev.coverageEnd, end]);
      }
      var lastErr = null, i, seg, map, r;
      for(i = 0; i < segments.length; i++){
        seg = segments[i];
        map = await yfFetchPricesBatch([tk], seg[0], seg[1]);
        r = map[tk];
        if(!r || r.error){ lastErr = new Error((r && r.error) || 'fetch failed'); continue; }
        pcStore(tk, r, seg[0], seg[1]);
      }
      if(!priceCache[tk]) throw lastErr || new Error('No price data for ' + tk + ' in that range');
      // Only widen the recorded coverage when every segment came back clean.
      // A segment may legitimately hold no rows (a holiday tail) and past
      // prices are immutable, so that still counts as covered. A failed
      // request must not, or we would never retry it.
      if(!lastErr){
        priceCache[tk].coverageStart = pcMinIso(priceCache[tk].coverageStart, start);
        priceCache[tk].coverageEnd   = pcMaxIso(priceCache[tk].coverageEnd, end);
      }
      pcSave();
    })();
    try { await pcInFlight[tk]; } finally { delete pcInFlight[tk]; }
    return priceCache[tk];
  }

  global.SharedPriceCache = {
    key: PRICE_CACHE_KEY,
    load: pcLoad,
    save: pcSave,
    ensure: pcEnsure,
    slice: pcSlice,
    covers: pcCovered,
    entry: function(ticker){ pcLoad(); return priceCache[pcKey(ticker)] || null; },
    tickers: function(){ pcLoad(); return Object.keys(priceCache).sort(); },
    clear: function(){ priceCache = {}; priceCacheLoaded = true; pcSave(); }
  };

  /* ── Technical indicators (shared by the single-asset & portfolio tools) ──
     All operate on a close-price array and return same-length arrays padded
     with null until the indicator has enough history. Pure & side-effect free,
     so both tools compute them lazily on the price series they already hold. */
  function taParseDate(s){ var p=String(s).split('-'); return new Date(+p[0],+p[1]-1,+p[2]); }
  function smaSeries(p,n){
    const out=new Array(p.length).fill(null);
    if(n<1) return out;
    let sum=0;
    for(let i=0;i<p.length;i++){ sum+=p[i]; if(i>=n) sum-=p[i-n]; if(i>=n-1) out[i]=sum/n; }
    return out;
  }
  function emaSeries(p,n){
    const out=new Array(p.length).fill(null);
    if(n<1||p.length<n) return out;
    const k=2/(n+1);
    let seed=0;
    for(let i=0;i<n;i++) seed+=p[i];
    let prev=seed/n; out[n-1]=prev;
    for(let i=n;i<p.length;i++){ prev=p[i]*k+prev*(1-k); out[i]=prev; }
    return out;
  }
  function maSeries(p,type,n){ return type==='ema'?emaSeries(p,n):smaSeries(p,n); }
  function rsiSeries(p,n){
    const out=new Array(p.length).fill(null);
    if(p.length<n+1) return out;
    let gain=0,loss=0;
    for(let i=1;i<=n;i++){ const ch=p[i]-p[i-1]; if(ch>=0) gain+=ch; else loss-=ch; }
    let avgG=gain/n, avgL=loss/n;
    out[n]= avgL===0?100:100-100/(1+avgG/avgL);
    for(let i=n+1;i<p.length;i++){
      const ch=p[i]-p[i-1], g=ch>0?ch:0, l=ch<0?-ch:0;
      avgG=(avgG*(n-1)+g)/n; avgL=(avgL*(n-1)+l)/n;
      out[i]= avgL===0?100:100-100/(1+avgG/avgL);
    }
    return out;
  }
  function bollingerSeries(p,n,k){
    const mid=smaSeries(p,n);
    const upper=new Array(p.length).fill(null), lower=new Array(p.length).fill(null);
    for(let i=n-1;i<p.length;i++){
      let sq=0;
      for(let j=i-n+1;j<=i;j++){ const d=p[j]-mid[i]; sq+=d*d; }
      const sd=Math.sqrt(sq/n);
      upper[i]=mid[i]+k*sd; lower[i]=mid[i]-k*sd;
    }
    return {mid,upper,lower};
  }
  function macdSeries(p,fast,slow,signal){
    const ef=emaSeries(p,fast), es=emaSeries(p,slow);
    const macd=p.map((_,i)=> (ef[i]!=null&&es[i]!=null)? ef[i]-es[i] : null);
    const sig=new Array(p.length).fill(null);
    const k=2/(signal+1);
    let prev=null, count=0, seed=0;
    for(let i=0;i<p.length;i++){
      if(macd[i]==null) continue;
      count++;
      if(count<signal){ seed+=macd[i]; }
      else if(count===signal){ seed+=macd[i]; prev=seed/signal; sig[i]=prev; }
      else { prev=macd[i]*k+prev*(1-k); sig[i]=prev; }
    }
    const hist=p.map((_,i)=> (macd[i]!=null&&sig[i]!=null)? macd[i]-sig[i] : null);
    return {macd,signal:sig,hist};
  }
  // ADX from close prices only (high=low=close approximation), Wilder-smoothed.
  function adxSeries(p,n){
    const len=p.length;
    const out=new Array(len).fill(null);
    if(len<2*n+1) return out;
    const tr=new Array(len).fill(0), pdm=new Array(len).fill(0), ndm=new Array(len).fill(0);
    for(let i=1;i<len;i++){
      const up=p[i]-p[i-1], down=p[i-1]-p[i];
      pdm[i]=(up>down&&up>0)?up:0;
      ndm[i]=(down>up&&down>0)?down:0;
      tr[i]=Math.abs(p[i]-p[i-1]);
    }
    let atr=0,apdm=0,andm=0;
    for(let i=1;i<=n;i++){ atr+=tr[i]; apdm+=pdm[i]; andm+=ndm[i]; }
    const dx=new Array(len).fill(null);
    for(let i=n+1;i<len;i++){
      atr=atr-atr/n+tr[i]; apdm=apdm-apdm/n+pdm[i]; andm=andm-andm/n+ndm[i];
      const pdi=atr===0?0:100*apdm/atr, ndi=atr===0?0:100*andm/atr;
      const sum=pdi+ndi;
      dx[i]= sum===0?0:100*Math.abs(pdi-ndi)/sum;
    }
    let cnt=0, dsum=0, prev=null;
    for(let i=0;i<len;i++){
      if(dx[i]==null) continue;
      cnt++;
      if(cnt<=n){ dsum+=dx[i]; if(cnt===n){ prev=dsum/n; out[i]=prev; } }
      else { prev=(prev*(n-1)+dx[i])/n; out[i]=prev; }
    }
    return out;
  }
  // Build the per-day buy-signal array (and the overlay lines) for a technical
  // strategy. Returns { signal:[bool], lines:[{name,values,axis,dash,fade}] }.
  function buildTech(prices, style, tech){
    const t=tech||{};
    const n=prices.length;
    const sig=new Array(n).fill(false);
    const lines=[];
    const crossUp=(a,b,i)=> a[i]!=null&&b[i]!=null&&a[i-1]!=null&&b[i-1]!=null&&a[i-1]<=b[i-1]&&a[i]>b[i];
    if(style==='tech-ma-cross'){
      const fast=maSeries(prices,t.fastMaType||'ema',t.fastMaLen||50);
      const slow=maSeries(prices,t.slowMaType||'sma',t.slowMaLen||200);
      for(let i=1;i<n;i++) if(crossUp(fast,slow,i)) sig[i]=true;
      lines.push({name:`${(t.fastMaType||'ema').toUpperCase()} ${t.fastMaLen||50}`,values:fast,axis:'price',dash:'dash',fade:0.7});
      lines.push({name:`${(t.slowMaType||'sma').toUpperCase()} ${t.slowMaLen||200}`,values:slow,axis:'price',dash:'dot',fade:0.45});
    } else if(style==='tech-rsi'){
      const r=rsiSeries(prices,t.rsiPeriod||14); const thr=t.rsiOversold??35;
      for(let i=0;i<n;i++) if(r[i]!=null&&r[i]<thr) sig[i]=true;
      lines.push({name:`RSI ${t.rsiPeriod||14}`,values:r,axis:'osc',dash:'dash',fade:0.75});
      lines.push({name:`Oversold ${thr}`,values:new Array(n).fill(thr),axis:'osc',dash:'dot',fade:0.4});
    } else if(style==='tech-bollinger'){
      const {mid,upper,lower}=bollingerSeries(prices,t.bbPeriod||20,t.bbStd||2);
      if((t.bbTrigger||'below')==='reclaim'){
        for(let i=1;i<n;i++) if(lower[i]!=null&&lower[i-1]!=null&&prices[i]>=lower[i]&&prices[i-1]<lower[i-1]) sig[i]=true;
      } else {
        for(let i=0;i<n;i++) if(lower[i]!=null&&prices[i]<lower[i]) sig[i]=true;
      }
      lines.push({name:'BB Upper',values:upper,axis:'price',dash:'dot',fade:0.4});
      lines.push({name:`BB Mid ${t.bbPeriod||20}`,values:mid,axis:'price',dash:'dash',fade:0.6});
      lines.push({name:'BB Lower',values:lower,axis:'price',dash:'dot',fade:0.4,bandFill:true});
    } else if(style==='tech-macd-cross'){
      const {macd,signal}=macdSeries(prices,t.macdFast||12,t.macdSlow||26,t.macdSignal||9);
      for(let i=1;i<n;i++) if(crossUp(macd,signal,i)) sig[i]=true;
      lines.push({name:'MACD',values:macd,axis:'osc',dash:'dash',fade:0.75});
      lines.push({name:'Signal',values:signal,axis:'osc',dash:'dot',fade:0.45});
    } else if(style==='tech-macd-hist'){
      const {hist}=macdSeries(prices,t.macdFast||12,t.macdSlow||26,t.macdSignal||9);
      const thr=t.macdHistThreshold??0;
      for(let i=1;i<n;i++) if(hist[i]!=null&&hist[i-1]!=null&&hist[i]>thr&&hist[i-1]<=thr) sig[i]=true;
      lines.push({name:'MACD Hist',values:hist,axis:'osc',bar:true});
      lines.push({name:`Threshold ${thr}`,values:new Array(n).fill(thr),axis:'osc',dash:'dot',fade:0.4});
    } else if(style==='tech-adx'){
      const a=adxSeries(prices,t.adxPeriod||14); const thr=t.adxThreshold??25;
      for(let i=0;i<n;i++) if(a[i]!=null&&a[i]>thr) sig[i]=true;
      lines.push({name:`ADX ${t.adxPeriod||14}`,values:a,axis:'osc',dash:'dash',fade:0.75});
      lines.push({name:`Threshold ${thr}`,values:new Array(n).fill(thr),axis:'osc',dash:'dot',fade:0.4});
    }
    return {signal:sig, lines};
  }
  // A stable Sunday-aligned "year + week-of-year" key. NOTE: despite the name
  // this is NOT an ISO-8601 week number (ISO weeks are Monday-aligned and can
  // roll a late-December date into week 1 of the next year). It is a simple
  // local-time bucket that every "weekly" feature shares so they group
  // identically; the name is kept only because both tools import it by this name.
  function isoWeekBucket(dateStr){
    const dt=taParseDate(dateStr);
    const y=dt.getFullYear();
    const doy=Math.floor((dt-new Date(y,0,1))/86400000);
    const wk=Math.floor((doy+new Date(y,0,1).getDay())/7);
    return y+'-'+String(wk).padStart(2,'0');
  }
  function periodKey(dateStr, period){
    return period==='weekly' ? isoWeekBucket(dateStr) : dateStr.slice(0,7);
  }

  global.SharedTA = {
    smaSeries: smaSeries, emaSeries: emaSeries, maSeries: maSeries,
    rsiSeries: rsiSeries, bollingerSeries: bollingerSeries,
    macdSeries: macdSeries, adxSeries: adxSeries, buildTech: buildTech,
    isoWeekBucket: isoWeekBucket, periodKey: periodKey
  };

  /* ── Settings save/load (download/upload a config as JSON) ─────────────────
     Each tool builds its own plain-object snapshot and restores from it; these
     are just the transport helpers so a user can persist a configuration and
     resume it later instead of re-entering everything. */
  function downloadJson(filename, obj){
    var blob = new Blob([JSON.stringify(obj, null, 2)], {type:'application/json'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 0);
  }
  function uploadJson(onParsed, onError){
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'application/json,.json';
    inp.style.display = 'none';
    inp.addEventListener('change', function(){
      var f = inp.files && inp.files[0];
      if(!f){ inp.remove(); return; }
      var reader = new FileReader();
      reader.onload = function(){
        try { onParsed(JSON.parse(reader.result)); }
        catch(e){ if(typeof onError==='function') onError(e); else alert('Invalid JSON file: '+e.message); }
        inp.remove();
      };
      reader.onerror = function(){ if(typeof onError==='function') onError(new Error('Could not read file')); inp.remove(); };
      reader.readAsText(f);
    });
    document.body.appendChild(inp);
    inp.click();
  }

  global.SharedConfig = { download: downloadJson, upload: uploadJson };

  /* ── SharedScenario — save the scenario to a file, open it again tomorrow ──
     Two small icon buttons (a floppy disk and an open folder) that write every
     input on the page to a JSON file and read one back. The mini cache already
     knows how to snapshot a tool and put it back, so a tool that uses Persist
     needs one line, after its Persist.init:

         SharedScenario.mount('.quick-start-row', { tool: 'financingvscash', persist: persist });

     The file is { tool, kind: 'scenario', version, savedAt, state }, where state
     is the Persist blob. A file from another tool is refused rather than half
     applied. A tool whose state does not live in Persist (the DCA explorers,
     which already had their own settings format) passes save()/load(obj) in
     place of persist, and its file is whatever save() returns.

     target  — element or selector the buttons are appended to: the Quick Start
               row where the tool has one, else the header's button cluster.
     options — tool (file tag and default file name), persist | save+load,
               filename, onError(message), onLoaded().                        */
  function makeScenario(){
    var ICON_SAVE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3.5h11.2L20.5 7.8V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5z"/><path d="M7.5 3.5v5h8v-5"/><rect x="7" y="13" width="10" height="7.5" rx=".6"/></svg>';
    var ICON_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 19V6a1.5 1.5 0 0 1 1.5-1.5h4.2l2 2.2H18a1.5 1.5 0 0 1 1.5 1.5V10"/><path d="M3.5 19l2.6-7.4A1.5 1.5 0 0 1 7.5 10.6h13.1a1 1 0 0 1 .95 1.3L19.3 18.5a1.5 1.5 0 0 1-1.4 1H3.5"/></svg>';
    var TEXT = {
      en: { save: 'Save scenario to a file', load: 'Open a saved scenario file',
            wrong: 'That file is not a saved scenario for this tool.',
            bad: 'Could not open that file: ' },
      id: { save: 'Simpan skenario ke file', load: 'Buka file skenario tersimpan',
            wrong: 'File itu bukan skenario tersimpan untuk alat ini.',
            bad: 'File tidak bisa dibuka: ' }
    };
    function lang(){
      var l = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
      return l.indexOf('id') === 0 ? 'id' : 'en';
    }
    function stamp(){
      var d = new Date(), p = function(n){ return (n < 10 ? '0' : '') + n; };
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    }
    function button(cls, icon, label){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'scenario-io-btn ' + cls;
      b.innerHTML = icon;
      b.title = label;
      b.setAttribute('aria-label', label);
      return b;
    }
    function mount(target, opts){
      opts = opts || {};
      var host = typeof target === 'string' ? document.querySelector(target) : target;
      if(!host || !opts.tool) return null;
      var t = TEXT[lang()];
      var fail = function(msg){
        if(typeof opts.onError === 'function') opts.onError(msg); else alert(msg);
      };
      var custom = typeof opts.save === 'function' && typeof opts.load === 'function';
      if(!custom && !(opts.persist && typeof opts.persist.snapshot === 'function')) return null;

      function doSave(){
        var body = custom ? opts.save() : {
          tool: opts.tool, kind: 'scenario', version: 1,
          savedAt: new Date().toISOString(), state: opts.persist.snapshot()
        };
        downloadJson(opts.filename || (opts.tool + '-scenario-' + stamp() + '.json'), body);
      }
      function doLoad(obj){
        if(custom){ opts.load(obj); }
        else {
          if(!obj || obj.tool !== opts.tool || !obj.state || typeof obj.state !== 'object'){ fail(t.wrong); return; }
          opts.persist.load(obj.state);
        }
        // A loaded file is the user's own scenario, not one of the presets.
        document.querySelectorAll('.quick-start-btn.active').forEach(function(b){ b.classList.remove('active'); });
        if(typeof opts.onLoaded === 'function') opts.onLoaded(obj);
      }

      var wrap = document.createElement('div');
      wrap.className = 'scenario-io';
      wrap.setAttribute('data-no-abbr', '');
      // Beside the header's own buttons, look like them.
      var extra = host.classList.contains('header-right') ? ' btn-theme' : '';
      var bSave = button('scenario-save' + extra, ICON_SAVE, t.save);
      var bLoad = button('scenario-load' + extra, ICON_OPEN, t.load);
      bSave.addEventListener('click', doSave);
      bLoad.addEventListener('click', function(){
        uploadJson(doLoad, function(e){ fail(t.bad + (e && e.message ? e.message : e)); });
      });
      wrap.appendChild(bSave); wrap.appendChild(bLoad);
      host.appendChild(wrap);
      return { save: doSave, load: doLoad, el: wrap };
    }
    return { mount: mount };
  }
  global.SharedScenario = makeScenario();

  /* ── SharedLegend — swatches that look like the mark they stand for ────────
     A legend is a key, not a colour list: a dotted line on the chart has to be
     a dotted line in the legend, a shaded range a shaded block, a ring marker
     a ring. The swatch is therefore DERIVED from the Chart.js dataset that
     draws the series (`fromDataset`), so a change to the line can never leave
     a stale square behind in the key.

     One geometry function feeds all three renderers — the HTML swatch, the
     PNG export and the SVG export — so an exported chart carries exactly the
     key the page shows.

         var spec = SharedLegend.fromDataset(ds);          // or a literal spec
         SharedLegend.attach(itemEl, spec, 'Money deposited');

     Spec fields (all optional bar `color`):
       type    'line' (default) | 'area' | 'bar' | 'point' | 'candle'
       color   stroke colour;  colors  [a,b] for a line that changes colour
       dash    Chart.js borderDash, e.g. [2,3];   width  borderWidth
       fill    fill colour — under the line for an area line, the whole block
               for a band;  fill2  second fill, for a band filled either side
       point   {shape:'circle'|'ring'|'triangle'|'rect', fill, stroke, width,
                radius} — a marker drawn at the centre of the swatch
     ──────────────────────────────────────────────────────────────────────── */
  var LEG_W = 22, LEG_H = 12;

  function legFirst(v){ return Array.isArray(v) ? (v.find(function(x){ return !!x; }) || v[0]) : v; }

  function isTransparent(c){
    if(!c) return true;
    var s = String(c).trim().toLowerCase();
    if(s === 'transparent' || s === 'none') return true;
    var m = s.match(/^rgba?\([^)]*,\s*([\d.]+)\s*\)$/);
    if(m && parseFloat(m[1]) === 0) return true;
    return /^#[0-9a-f]{8}$/.test(s) && s.slice(7) === '00';
  }

  /* A swatch is drawn as SVG and as canvas, so only a CSS colour STRING can
     serve: a gradient object or a per-point callback read straight off a
     dataset would paint nothing and take the whole mark down with it. */
  function legCss(c){ return typeof c === 'string' && c.trim() ? c.trim() : null; }

  function normSpec(spec){
    var s = spec || {};
    var type = s.type || 'line';
    var colors = (s.colors && s.colors.length >= 2 && legCss(s.colors[0]) && legCss(s.colors[1]))
      ? [legCss(s.colors[0]), legCss(s.colors[1])] : null;
    var color = legCss(s.color) || (colors ? colors[0] : '#888888');
    var out = {
      type: type,
      color: color,
      colors: colors,
      dash: Array.isArray(s.dash) && s.dash.length ? s.dash.slice() : null,
      width: s.width == null ? 2 : s.width,
      fill: isTransparent(s.fill) ? null : legCss(s.fill),
      fill2: isTransparent(s.fill2) ? null : legCss(s.fill2),
      point: null
    };
    if(out.type === 'line' && out.width <= 0 && out.fill) out.type = 'area';
    if(s.point){
      var p = s.point === true ? {} : s.point;
      out.point = {
        shape: p.shape || 'circle',
        fill: p.shape === 'ring' ? (isTransparent(p.fill) ? null : legCss(p.fill)) : (legCss(p.fill) || out.color),
        stroke: legCss(p.stroke) || (p.shape === 'ring' ? out.color : null),
        width: p.width == null ? (p.shape === 'ring' ? 2 : 0) : p.width,
        radius: p.radius == null ? 3.6 : p.radius
      };
    }
    return out;
  }

  /* Read a swatch straight off the dataset that draws the series, so the key
     and the chart cannot disagree. `over` patches anything the dataset states
     as a callback (per-point radii and colours) or does not state at all. */
  function legFromDataset(ds, over){
    ds = ds || {};
    var spec = {
      color: typeof ds.borderColor === 'string' ? ds.borderColor : legFirst(ds.borderColor),
      dash: ds.borderDash,
      width: ds.borderWidth == null ? 2 : ds.borderWidth,
      type: ds.type === 'bar' ? 'bar' : 'line'
    };
    if(spec.type === 'bar') spec.fill = typeof ds.backgroundColor === 'string' ? ds.backgroundColor : legFirst(ds.backgroundColor);
    else if(ds.fill) spec.fill = typeof ds.backgroundColor === 'string' ? ds.backgroundColor : legFirst(ds.backgroundColor);
    if(ds.showLine === false){ spec.type = 'point'; spec.fill = null; }
    if(typeof ds.pointRadius === 'number' && ds.pointRadius > 0){
      // Chart.js falls back to the dataset's own background/border for a point
      // that states none of its own, which is how a ring marker is written: a
      // panel-coloured fill inside a thick border. The swatch is 12px tall, so
      // a marker sized for the plot is brought down to fit without losing its
      // shape or the hollow that makes it a ring.
      var pb = typeof ds.pointBorderWidth === 'number' ? ds.pointBorderWidth : ds.borderWidth;
      spec.point = {
        shape: ds.pointStyle === 'triangle' ? 'triangle' : (ds.pointStyle === 'rect' ? 'rect' : 'circle'),
        fill: typeof ds.pointBackgroundColor === 'string' ? ds.pointBackgroundColor
            : (typeof ds.backgroundColor === 'string' ? ds.backgroundColor : spec.color),
        stroke: typeof ds.pointBorderColor === 'string' ? ds.pointBorderColor : spec.color,
        width: Math.min(2.2, pb || 0),
        radius: Math.max(2.6, Math.min(4.6, ds.pointRadius * 0.7))
      };
    }
    if(over) for(var k in over) if(Object.prototype.hasOwnProperty.call(over, k)) spec[k] = over[k];
    return normSpec(spec);
  }

  /* The one spec a series is keyed by. A dataset can pin its own mark with
     `legendSpec` for the looks a dataset cannot state — a band that is two
     datasets, a marker a plugin draws — and everything else is read off the
     dataset. The legend and the hover card both come through here, so the two
     cannot drift apart.  `over` patches whichever of the two answers. */
  function legSpecOf(ds, over){
    ds = ds || {};
    if(!ds.legendSpec) return legFromDataset(ds, over);
    var s = {}, k;
    for(k in ds.legendSpec) if(Object.prototype.hasOwnProperty.call(ds.legendSpec, k)) s[k] = ds.legendSpec[k];
    if(over) for(k in over) if(Object.prototype.hasOwnProperty.call(over, k)) s[k] = over[k];
    return normSpec(s);
  }

  /* The one description of what a swatch looks like. Everything below draws
     these primitives; `k` scales the whole box for high-resolution exports. */
  function legMarks(spec, k){
    k = k || 1;
    var s = normSpec(spec), W = LEG_W * k, H = LEG_H * k, cy = H / 2, out = [];
    var lw = Math.max(1 * k, (s.width || 0) * k);
    var dash = s.dash ? s.dash.map(function(d){ return Math.max(0.5, d * k); }) : null;

    if(s.type === 'bar'){
      var bw = W * 0.56;
      out.push({t:'rect', x:(W - bw)/2, y:cy - 4.5*k, w:bw, h:9*k, r:1.5*k, fill:s.fill || s.color});
    } else if(s.type === 'candle'){
      // Body with a wick standing clear above and below it, so a candlestick
      // series reads as candles rather than as a block of colour.
      var cw = W * 0.38;
      out.push({t:'line', x1:W/2, y1:cy - 6*k, x2:W/2, y2:cy + 6*k, stroke:s.color, sw:1.2*k});
      out.push({t:'rect', x:(W - cw)/2, y:cy - 3.4*k, w:cw, h:6.8*k, r:1*k, fill:s.fill || s.color});
    } else if(s.type === 'area'){
      // A band or a filled region with no line of its own: the whole block is
      // the mark, in the two colours it is filled with when it has two.
      if(s.fill2){
        out.push({t:'rect', x:0, y:cy - 4.5*k, w:W/2, h:9*k, r:2*k, fill:s.fill || s.color});
        out.push({t:'rect', x:W/2, y:cy - 4.5*k, w:W/2, h:9*k, r:2*k, fill:s.fill2});
      } else {
        out.push({t:'rect', x:0, y:cy - 4.5*k, w:W, h:9*k, r:2*k, fill:s.fill || s.color});
      }
    } else if(s.type !== 'point'){
      // A line, with the area under it shaded when the series is filled.
      if(s.fill) out.push({t:'rect', x:0, y:cy, w:W, h:H/2, r:0, fill:s.fill});
      if(lw > 0){
        if(s.colors) {
          out.push({t:'line', x1:0, y1:cy, x2:W/2, y2:cy, stroke:s.colors[0], sw:lw, dash:dash});
          out.push({t:'line', x1:W/2, y1:cy, x2:W, y2:cy, stroke:s.colors[1], sw:lw, dash:dash});
        } else {
          out.push({t:'line', x1:0, y1:cy, x2:W, y2:cy, stroke:s.color, sw:lw, dash:dash});
        }
      }
    }
    if(s.point){
      var p = s.point, r = p.radius * k, pw = (p.width || 0) * k;
      if(p.shape === 'triangle'){
        out.push({t:'poly', pts:[[W/2, cy - r], [W/2 + r, cy + r * 0.85], [W/2 - r, cy + r * 0.85]],
                  fill:p.fill || s.color, stroke:p.stroke, sw:pw});
      } else if(p.shape === 'rect'){
        out.push({t:'rect', x:W/2 - r, y:cy - r, w:r*2, h:r*2, r:1*k, fill:p.fill || s.color, stroke:p.stroke, sw:pw});
      } else {
        out.push({t:'circle', cx:W/2, cy:cy, r:r, fill:p.fill, stroke:p.stroke, sw:pw});
      }
    }
    return out;
  }

  function legSvgMarkup(spec, k){
    k = k || 1;
    return legMarks(spec, k).map(function(m){
      var st = (m.stroke && m.sw > 0) ? ' stroke="' + m.stroke + '" stroke-width="' + m.sw + '"' : '';
      if(m.t === 'line') return '<line x1="' + m.x1 + '" y1="' + m.y1 + '" x2="' + m.x2 + '" y2="' + m.y2 +
        '" stroke="' + m.stroke + '" stroke-width="' + m.sw + '"' +
        (m.dash ? ' stroke-dasharray="' + m.dash.join(' ') + '"' : '') + ' stroke-linecap="butt"/>';
      if(m.t === 'rect') return '<rect x="' + m.x + '" y="' + m.y + '" width="' + m.w + '" height="' + m.h +
        '" rx="' + (m.r || 0) + '" fill="' + (m.fill || 'none') + '"' + st + '/>';
      if(m.t === 'circle') return '<circle cx="' + m.cx + '" cy="' + m.cy + '" r="' + m.r +
        '" fill="' + (m.fill || 'none') + '"' + st + '/>';
      return '<polygon points="' + m.pts.map(function(p){ return p[0] + ',' + p[1]; }).join(' ') +
        '" fill="' + (m.fill || 'none') + '"' + st + '/>';
    }).join('');
  }

  /* The HTML swatch: an inline SVG, so a dotted line is dotted at any zoom. */
  function legSwatchHtml(spec){
    return '<span class="legend-swatch" aria-hidden="true"><svg width="' + LEG_W + '" height="' + LEG_H +
      '" viewBox="0 0 ' + LEG_W + ' ' + LEG_H + '">' + legSvgMarkup(spec, 1) + '</svg></span>';
  }

  /* Fill a legend item: the swatch, the label, and the spec itself stashed on
     the element so the PNG/SVG exporters can redraw the very same mark. */
  function legAttach(el, spec, label){
    if(!el) return el;
    var s = normSpec(spec);
    el.dataset.swatch = JSON.stringify(s);
    el.innerHTML = legSwatchHtml(s) + '<span class="legend-label"></span>';
    el.lastChild.textContent = label == null ? '' : String(label);
    return el;
  }

  function legItem(spec, label, className){
    var el = document.createElement('div');
    el.className = className || 'legend-item';
    return legAttach(el, spec, label);
  }

  /* What the exporters read: every visible entry, with the mark it draws. */
  function legItemsOf(elOrId){
    var el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
    var out = [];
    if(!el) return out;
    el.querySelectorAll('.legend-item:not(.hidden)').forEach(function(item){
      var labelEl = item.querySelector('.legend-label');
      var label = (labelEl ? labelEl.textContent : item.textContent).trim();
      if(!label) return;
      var spec = null;
      if(item.dataset.swatch){ try { spec = JSON.parse(item.dataset.swatch); } catch(e){ spec = null; } }
      if(!spec){
        // An entry built without a spec still exports: fall back to the
        // colour of whatever swatch element it does carry.
        var sw = item.querySelector('.legend-swatch svg *, .dot');
        var col = sw ? (sw.getAttribute && sw.getAttribute('fill')) || window.getComputedStyle(sw).backgroundColor : '#888888';
        spec = normSpec({color: col, type:'point', point:{shape:'circle', radius:5}});
      }
      out.push({label: label, color: spec.color, swatch: spec});
    });
    return out;
  }

  /* Pack an exported legend into as many centred rows as it needs, reporting
     each row's measured width so the caller can centre it. A key wide enough
     to run off the canvas used to do exactly that, straight through the
     watermark. `measure` is the caller's own text measurement, so the same
     packing serves a 3x PNG and a 1x SVG.  `markW` is the swatch width at the
     caller's scale (SharedLegend.W * k). */
  function legLayout(items, measure, maxW, markW, gap, pad){
    var rows = [], row = [], w = 0, i, itemW;
    for(i = 0; i < items.length; i++){
      itemW = markW + gap + measure(items[i].label);
      if(row.length && w + pad + itemW > maxW){ rows.push({items: row, width: w}); row = []; w = 0; }
      w += (row.length ? pad : 0) + itemW;
      row.push(items[i]);
    }
    if(row.length) rows.push({items: row, width: w});
    return rows;
  }

  /* PNG export: the same primitives, painted on a canvas at scale `k`, with
     (x, cy) the left edge and vertical centre of the swatch box. */
  function legPaint(ctx, spec, x, cy, k){
    k = k || 1;
    var top = cy - (LEG_H * k) / 2;
    ctx.save();
    legMarks(spec, k).forEach(function(m){
      ctx.beginPath();
      if(m.t === 'line'){
        ctx.setLineDash(m.dash || []);
        ctx.lineWidth = m.sw; ctx.strokeStyle = m.stroke; ctx.lineCap = 'butt';
        ctx.moveTo(x + m.x1, top + m.y1); ctx.lineTo(x + m.x2, top + m.y2); ctx.stroke();
        ctx.setLineDash([]);
        return;
      }
      if(m.t === 'rect'){
        var r = Math.min(m.r || 0, m.h / 2, m.w / 2);
        if(ctx.roundRect) ctx.roundRect(x + m.x, top + m.y, m.w, m.h, r);
        else ctx.rect(x + m.x, top + m.y, m.w, m.h);
      } else if(m.t === 'circle'){
        ctx.arc(x + m.cx, top + m.cy, m.r, 0, Math.PI * 2);
      } else {
        m.pts.forEach(function(p, i){ i ? ctx.lineTo(x + p[0], top + p[1]) : ctx.moveTo(x + p[0], top + p[1]); });
        ctx.closePath();
      }
      if(m.fill){ ctx.fillStyle = m.fill; ctx.fill(); }
      if(m.stroke && m.sw > 0){ ctx.setLineDash([]); ctx.lineWidth = m.sw; ctx.strokeStyle = m.stroke; ctx.stroke(); }
    });
    ctx.restore();
  }

  /* SVG export: the same primitives as a <g>, ready to append to the export. */
  function legSvgNode(spec, x, cy, k){
    k = k || 1;
    var NS = 'http://www.w3.org/2000/svg';
    var g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', 'translate(' + x + ',' + (cy - (LEG_H * k) / 2) + ')');
    g.innerHTML = legSvgMarkup(spec, k);
    if(!g.childNodes.length){
      // innerHTML on an SVG element is unsupported in a few engines; parse it.
      var doc = new DOMParser().parseFromString('<svg xmlns="' + NS + '">' + legSvgMarkup(spec, k) + '</svg>', 'image/svg+xml');
      Array.prototype.slice.call(doc.documentElement.childNodes).forEach(function(n){ g.appendChild(n); });
    }
    return g;
  }

  global.SharedLegend = {
    W: LEG_W, H: LEG_H,
    spec: normSpec,
    fromDataset: legFromDataset,
    specOf: legSpecOf,
    swatchHtml: legSwatchHtml,
    attach: legAttach,
    item: legItem,
    itemsOf: legItemsOf,
    layout: legLayout,
    markup: legSvgMarkup,
    paint: legPaint,
    svgNode: legSvgNode
  };

  /* ── SharedChartTip — the chart hover card, keyed exactly like the legend ─
     Chart.js draws its own tooltip on the canvas, and every row of it gets the
     same mark: a small filled-or-outlined square. So a chart whose key is a
     dotted line, a shaded band and a ring marker answered the hover with three
     squares, and the reader had to match rows to series by colour alone — the
     very thing SharedLegend exists to stop.

     This replaces that card with an HTML one whose row marks come from the
     SAME spec the legend entry is built from, so the key, the chart and the
     hover all show one mark per series. Being an element rather than canvas
     pixels, it is also never clipped by a small canvas.

         tooltip: SharedChartTip.options({ callbacks: {...}, filter: ... })

     A series whose mark the dataset cannot state — a band that is two datasets,
     a marker a plugin draws — pins it with `legendSpec` on the dataset, which
     is the one spec the legend and the hover then share.
     ──────────────────────────────────────────────────────────────────────── */
  var TIP_ID = 'sharedChartTip';

  /* A sign belongs to the figure it signs. Now that a row wraps instead of
     running out through the side of the card, a line can break between a
     leading − and the $ that follows it, and the next line then reads as a
     positive number. A word joiner closes that one break opportunity and no
     other: the sign has to open the run (start of line, after a space or an
     opening bracket) and be followed by a figure, so a hyphenated word, a
     1990-2020 span and the spaced dash of a (−$491.9k – $31.9k) range all
     still break where they should. */
  var TIP_WJ = /(^|[\s(\[])([-\u2212+])(?=[\d$\u20ac\u00a3\u00a5\u20b9])/g;

  function tipEsc(s){
    return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){
      return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;';
    }).replace(TIP_WJ, '$1$2\u2060');
  }

  function tipHide(){
    var el = document.getElementById(TIP_ID);
    if(el) el.classList.remove('visible');
  }

  function tipEl(){
    var el = document.getElementById(TIP_ID);
    if(!el){
      el = document.createElement('div');
      el.id = TIP_ID;
      el.className = 'chart-tip';
      // The read-out box under every chart is the accessible copy of this, so
      // the card itself stays out of the a11y tree rather than doubling it.
      el.setAttribute('aria-hidden', 'true');
      document.body.appendChild(el);
      // A fixed card would otherwise hang in mid-air over a page that has
      // scrolled out from under the chart it belongs to.
      window.addEventListener('scroll', tipHide, true);
      window.addEventListener('resize', tipHide);
    }
    return el;
  }

  /* The mark a row carries is the mark its series is drawn with. `legendSpec`
     on the dataset wins, exactly as it does in the key; otherwise the spec is
     read off the dataset, with the per-element colours Chart.js resolved for
     this point filling in whatever the dataset states as an array or a
     callback (a pie slice, a bar in a coloured series). */
  function tipSpecOf(chart, item, colors){
    var ds = (item && item.dataset) || {};
    if(ds.legendSpec) return legSpecOf(ds);
    var lc = colors || {};
    var meta = (chart && chart.getDatasetMeta && item) ? chart.getDatasetMeta(item.datasetIndex) : null;
    var kind = ds.type || (meta && meta.type) ||
               (chart && chart.config && (chart.config.type || (chart.config._config && chart.config._config.type))) || 'line';
    var bg = legCss(lc.backgroundColor) || legFirst(ds.backgroundColor);
    var bc = legCss(lc.borderColor) || legFirst(ds.borderColor);
    if(kind === 'bar') return normSpec({type: 'bar', fill: bg, color: bc});
    if(kind === 'pie' || kind === 'doughnut' || kind === 'polarArea')
      return normSpec({type: 'bar', fill: bg || bc, color: bc});
    if(kind === 'candlestick' || kind === 'ohlc')
      return normSpec({type: 'candle', color: bc || bg, fill: bg || bc});
    // A line, a scatter or anything drawn from them: the key's own reader.
    return legSpecOf(ds, legCss(ds.borderColor) ? null : (bc ? {color: bc} : null));
  }

  function tipNote(line){ return '<div class="chart-tip-note">' + tipEsc(line) + '</div>'; }

  // A callback that has nothing to say returns an empty string, which would
  // otherwise open an empty line in the card.
  function tipLines(v){
    return (v || []).filter(function(line){ return String(line == null ? '' : line).trim() !== ''; });
  }

  function tipMarkup(chart, tooltip){
    var showMarks = !(tooltip.options && tooltip.options.displayColors === false);
    var html = '';
    tipLines(tooltip.title).forEach(function(line){
      html += '<div class="chart-tip-title">' + tipEsc(line) + '</div>';
    });
    tipLines(tooltip.beforeBody).forEach(function(line){ html += tipNote(line); });
    (tooltip.body || []).forEach(function(body, i){
      var mark = showMarks
        ? legSwatchHtml(tipSpecOf(chart, (tooltip.dataPoints || [])[i], (tooltip.labelColors || [])[i]))
        : '';
      tipLines(body.before).forEach(function(line){ html += tipNote(line); });
      tipLines(body.lines).forEach(function(line, k){
        // Only the first line of a multi-line entry carries the mark; the rest
        // line up under it, so one series still reads as one row.
        html += '<div class="chart-tip-row">' +
                (showMarks ? (k === 0 ? mark : '<span class="legend-swatch" aria-hidden="true"></span>') : '') +
                '<span class="chart-tip-label">' + tipEsc(String(line).replace(/^\s+/, '')) + '</span></div>';
      });
      tipLines(body.after).forEach(function(line){ html += tipNote(line); });
    });
    tipLines(tooltip.afterBody).forEach(function(line){ html += tipNote(line); });
    tipLines(tooltip.footer).forEach(function(line){
      html += '<div class="chart-tip-footer">' + tipEsc(line) + '</div>';
    });
    return html;
  }

  /* Beside the caret and centred on it, which is where the canvas tooltip sat,
     but clamped to the VIEWPORT rather than to the canvas: the card is an
     element, so a small chart no longer cuts it in half. */
  function tipPlace(el, chart, tooltip){
    var r = chart.canvas.getBoundingClientRect();
    var cx = r.left + tooltip.caretX, cy = r.top + tooltip.caretY;
    var w = el.offsetWidth, h = el.offsetHeight, pad = 8, gap = 14;
    var left = cx + gap;
    if(left + w > window.innerWidth - pad) left = cx - gap - w;
    el.style.left = Math.max(pad, Math.min(left, window.innerWidth - pad - w)) + 'px';
    el.style.top = Math.max(pad, Math.min(cy - h / 2, window.innerHeight - pad - h)) + 'px';
  }

  function tipHandler(ctx){
    var chart = ctx && ctx.chart, tooltip = ctx && ctx.tooltip;
    if(!chart || !chart.canvas || !tooltip || !tooltip.opacity){ tipHide(); return; }
    var html = tipMarkup(chart, tooltip);
    if(!html){ tipHide(); return; }
    var el = tipEl();
    el.innerHTML = html;
    el.classList.add('visible');
    tipPlace(el, chart, tooltip);
  }

  /* Wrap a tool's own tooltip options: same callbacks, same filter, drawn as
     the shared card instead of by Chart.js. */
  function tipOptions(opts){
    var o = opts || {};
    o.enabled = false;
    o.external = tipHandler;
    return o;
  }

  global.SharedChartTip = {
    id: TIP_ID,
    options: tipOptions,
    handler: tipHandler,
    spec: tipSpecOf,
    markup: tipMarkup,
    hide: tipHide
  };

  /* ══════════════════════════════════════════════════════════════════════
     CHART ZOOM (SharedZoom)

     Two rules every zoomable chart on the site obeys, in one place so they
     cannot drift apart tool by tool:

     1. A gesture can never leave the data. chartjs-plugin-zoom will happily
        pan a linear axis into empty space and pinch it down to a single
        pixel-wide sliver, so every chart hands it the extent of what it
        actually plotted as `limits`, plus a floor on how far in a pinch may
        go (a handful of points wide — past that there is nothing left to
        read). A category axis is bounded by its labels already, but not
        floored, so it gets the same treatment in index units.

     2. The y axis follows the x window. A linear y axis is sized once, from
        the whole series, so zooming into five years of a sixty-year plan
        leaves those five years as a flat smear against a scale built for the
        end of it. Refitting y to the slice on screen is what makes a zoom
        worth making.

     The refit is a Chart.js PLUGIN rather than a zoom callback, because it has
     to happen INSIDE the update the gesture already triggers. A second update
     chasing the first leaves the lines drawn against the old scale while the
     ticks already show the new one, which is worse than not refitting at all.
     The zoom plugin writes the window it is about to draw into the x scale's
     options and then calls update, so the window is readable from the moment
     that update starts, and the axis is sized to it in `afterDataLimits`,
     while the scale is working out its own range (see the hook below).

     3. A chart that is handed new data opens on it. `SharedZoom.resetView`
        drops the window a previous pan or pinch left in the axis options, so
        a recompute, a preset or a fresh simulate draws the whole of what was
        just computed rather than yesterday's zoom over today's numbers.

     A chart opts in by carrying, in its own options,
       plugins: {sharedYFit: {auto: {…}}}        or  {fit: {…}}
     — read on the very first update, so the chart OPENS on the fitted axis —
     or by hanging the same config on the instance as `chart.$autoFitY` /
     `chart.$fitY`, for a chart whose fitters are rebuilt when its data is
     replaced in place. Either way:

       fit  {scaleId: function(xMin, xMax){ return {min, max}; }}
            bespoke fitters, for a chart that sizes an axis to SOME of its
            series rather than all of them.
       auto {…}
            the generic fitter below, which reads the datasets the chart is
            actually showing. Options:
              axes        scale ids to fit (default ['y'])
              includeZero keep zero on the axis either way
              skip        function(dataset, i) -> true to ignore
              fixed       scale ids to leave alone, for an axis pinned to a
                          range of its own (a 0-100 percentage stack)
            A dataset may also opt itself out with `noAutoFit`, which is how a
            series that is deliberately allowed to run off the top of its axis
            says so.

     A fitted axis must NOT carry `min`/`max` in its own configuration. Those
     are USER bounds, and Chart.js pins the axis back to them after the refit
     has run: the chart would open on the right view and then never move again.
     Hand the opening view to the fitter instead — it is applied on the first
     update like any other.
     ══════════════════════════════════════════════════════════════════════ */

  /* The x window the chart is about to draw. The zoom plugin writes numeric
     bounds onto the scale's OPTIONS; before the first gesture they are absent,
     which means the whole of the data. */
  function xWindowOf(chart){
    var sc = chart.options && chart.options.scales && chart.options.scales.x;
    if(!sc) return null;
    var lo = typeof sc.min === 'number' && isFinite(sc.min) ? sc.min : -Infinity;
    var hi = typeof sc.max === 'number' && isFinite(sc.max) ? sc.max : Infinity;
    if(hi < lo) return null;
    return {min: lo, max: hi};
  }

  /* Pad a raw hi/lo into axis bounds. Ten per cent of the span, with a floor
     tied to the numbers themselves so a nearly flat series still gets air
     rather than a hairline box. */
  function padBounds(lo, hi, opts){
    opts = opts || {};
    if(opts.includeZero && lo > 0) lo = 0;
    if(opts.includeZero && hi < 0) hi = 0;
    var pad = Math.max((hi - lo) * 0.1, Math.abs(hi) * 0.02, Math.abs(lo) * 0.02);
    if(!(pad > 0)) pad = Math.max(Math.abs(hi), 1) * 0.1;
    var min = lo - pad * (opts.bottomPad == null ? 0.6 : opts.bottomPad);
    // Never open a gap below an empty pot: a series that never goes negative
    // reads against zero, not against some arbitrary padding below it.
    if(lo >= 0 && min < 0) min = 0;
    return {min: min, max: hi + pad * (opts.topPad == null ? 1 : opts.topPad)};
  }

  /* Scan the datasets the chart is SHOWING for the y extent inside an x
     window. Points are read in either shape Chart.js accepts: {x, y} pairs on
     a linear axis, or bare numbers on a category axis, where the index is the
     x. The nearest point on each side of the window counts too, so a segment
     that crosses an edge is scaled with the slice it is drawn in rather than
     clipped out of its own axis. */
  /* A stacked axis is sized by the TOP of the stack, not by any one series, so
     the values sharing an x are added up first — positives and negatives apart,
     the way Chart.js stacks them — and the extent is taken over those totals. */
  function scanStacked(chart, win, axisId, cfg){
    var up = {}, down = {}, any = false;
    var sets = (chart.data && chart.data.datasets) || [];
    sets.forEach(function(ds, i){
      if(!ds || ds.noAutoFit) return;
      if(cfg.skip && cfg.skip(ds, i)) return;
      if((ds.yAxisID || 'y') !== axisId) return;
      if(chart.isDatasetVisible && !chart.isDatasetVisible(i)) return;
      var data = ds.data || [];
      for(var k = 0; k < data.length; k++){
        var p = data[k], x, y;
        if(p && typeof p === 'object'){ x = p.x; y = p.y; } else { x = k; y = p; }
        if(typeof x !== 'number' || !isFinite(x)) x = k;
        if(y == null || typeof y !== 'number' || !isFinite(y)) continue;
        if(x < win.min || x > win.max) continue;
        var key = String(x);
        if(y >= 0) up[key] = (up[key] || 0) + y; else down[key] = (down[key] || 0) + y;
        any = true;
      }
    });
    if(!any) return null;
    var lo = 0, hi = 0;
    Object.keys(up).forEach(function(k){ if(up[k] > hi) hi = up[k]; });
    Object.keys(down).forEach(function(k){ if(down[k] < lo) lo = down[k]; });
    return {lo: lo, hi: hi};
  }

  function scanExtent(chart, win, axisId, cfg){
    var lo = null, hi = null;
    var sets = (chart.data && chart.data.datasets) || [];
    sets.forEach(function(ds, i){
      if(!ds || ds.noAutoFit) return;
      if(cfg.skip && cfg.skip(ds, i)) return;
      if((ds.yAxisID || 'y') !== axisId) return;
      if(chart.isDatasetVisible && !chart.isDatasetVisible(i)) return;
      var data = ds.data || [];
      var before = null, after = null, k, p, x, y;
      for(k = 0; k < data.length; k++){
        p = data[k];
        if(p && typeof p === 'object'){ x = p.x; y = p.y; } else { x = k; y = p; }
        if(typeof x !== 'number' || !isFinite(x)) x = k;
        if(y == null || typeof y !== 'number' || !isFinite(y)) continue;
        if(x < win.min){ before = y; continue; }
        if(x > win.max){ if(after === null) after = y; continue; }
        if(lo === null || y < lo) lo = y;
        if(hi === null || y > hi) hi = y;
      }
      [before, after].forEach(function(v){
        if(v === null) return;
        if(lo === null || v < lo) lo = v;
        if(hi === null || v > hi) hi = v;
      });
    });
    if(lo === null || hi === null) return null;
    return {lo: lo, hi: hi};
  }

  /* Write the fitted bounds onto the chart's own configuration, so they
     persist past this update, and onto the scale's resolver proxy, which is
     what the scale reads. */
  function writeBounds(chart, id, b){
    var opt = chart.options.scales && chart.options.scales[id];
    if(opt){ opt.min = b.min; opt.max = b.max; }
    var sc = chart.scales && chart.scales[id];
    if(sc && sc.options && sc.options !== opt){ sc.options.min = b.min; sc.options.max = b.max; }
  }

  /* The bounds one y scale should carry for the x window the chart is about to
     draw, or null if this scale is not one the chart asked to have fitted. */
  function boundsFor(chart, id, fits, auto){
    var win = xWindowOf(chart);
    if(!win) return null;
    if(fits && fits[id]) return fits[id](win.min, win.max) || null;
    if(!auto) return null;
    var axes = auto.axes || ['y'];
    if(axes.indexOf(id) < 0) return null;
    if(auto.fixed && auto.fixed.indexOf(id) >= 0) return null;
    var sc = (chart.options.scales || {})[id];
    var stacked = sc && sc.stacked;
    var ext = stacked ? scanStacked(chart, win, id, auto) : scanExtent(chart, win, id, auto);
    if(!ext) return null;
    return padBounds(ext.lo, ext.hi, {
      includeZero: auto.includeZero, topPad: auto.topPad, bottomPad: auto.bottomPad
    });
  }

  /* Write fitted bounds into the chart's own options. This is what `refit`
     does OUTSIDE an update; it is deliberately NOT done from `beforeUpdate`.
     Writing a y bound into the options while an update is already running
     makes Chart.js resolve every scale from the configuration it cached at
     the start of that update, so an x axis whose data has just been replaced
     is sized from the data it no longer holds and only catches up on the NEXT
     update — the stale "0 to 1" axis a reader used to have to clear by hand.
     Sizing the axis from `afterDataLimits` alone costs nothing: that hook
     runs on the very first update too, so a chart still OPENS on the fitted
     axis. */
  function writeFits(chart, popts){
    var fits = chart.$fitY || (popts && popts.fit);
    var auto = chart.$autoFitY || (popts && popts.auto);
    if(!fits && !auto) return;
    var scales = chart.options.scales || {};
    var ids = Object.keys(fits || {}).concat((auto && auto.axes) || []);
    ids.forEach(function(id, i){
      if(ids.indexOf(id) !== i) return;                 // named twice
      if(!scales[id]) return;
      var b = boundsFor(chart, id, fits, auto);
      if(b) writeBounds(chart, id, b);
    });
  }

  /* The bounds a chart's axes carried before any gesture touched them, kept so
     `resetView` can put them back. Read once, off the configuration the chart
     was built with: the zoom plugin writes a pan or a pinch into those same
     option slots, so anything read later is a window, not a baseline. */
  function captureBase(chart){
    if(chart.$zoomBase) return;
    var base = {}, scales = (chart.options && chart.options.scales) || {};
    Object.keys(scales).forEach(function(id){
      var sc = scales[id] || {};
      base[id] = {
        hasMin: typeof sc.min !== 'undefined', min: sc.min,
        hasMax: typeof sc.max !== 'undefined', max: sc.max
      };
    });
    chart.$zoomBase = base;
  }

  /* Put every axis back to the view the chart opened on, dropping whatever
     window a pan or a pinch left behind. Call it whenever the data underneath
     a chart is REPLACED — a recompute, a preset, a fresh simulate — because a
     zoom into year 3 of the run just discarded says nothing about the run that
     replaced it, and a reader should not have to press a reset button to see
     the numbers they just asked for. An axis the chart deliberately pinned in
     its own configuration is restored to that pin, not cleared.

     It only records the intent; the caller's own `update()` draws it, so a
     render still costs exactly one update. */
  function resetView(chart){
    if(!chart || !chart.options) return;
    captureBase(chart);
    var base = chart.$zoomBase || {}, scales = chart.options.scales || {};
    Object.keys(scales).forEach(function(id){
      var sc = scales[id], b = base[id];
      if(!sc) return;
      if(b && b.hasMin) sc.min = b.min; else delete sc.min;
      if(b && b.hasMax) sc.max = b.max; else delete sc.max;
    });
  }

  var FIT_PLUGIN = {
    id: 'sharedYFit',
    /* The baseline is taken before the chart's first update, which is the last
       moment it is certainly free of gesture state. */
    afterInit: captureBase,
    /* The config can arrive two ways. `options.plugins.sharedYFit` is read on
       every update, so a chart built once with a generic fit opens on the
       fitted axis rather than snapping to it on the first gesture;
       `chart.$fitY` / `chart.$autoFitY` are hung on the instance, for a chart
       whose fitters are rebuilt whenever its data is replaced in place. An
       instance property wins, because it is the later word.

       The fit happens here, on the scale itself, because a scale resolves its
       own range while it updates: this hook is the one point where the data
       limits for THIS update are known and can still be overridden.
       `args.scale` is the scale being sized, so each pane of a stacked pair is
       served in its own turn. */
    afterDataLimits: function(chart, args, popts){
      var scale = args && args.scale;
      if(!scale) return;
      var fits = chart.$fitY || (popts && popts.fit);
      var auto = chart.$autoFitY || (popts && popts.auto);
      if(!fits && !auto) return;
      var b = boundsFor(chart, scale.id, fits, auto);
      if(!b) return;
      scale.min = b.min; scale.max = b.max;
    }
  };

  /* The gesture block every zoomable chart passes to `plugins.zoom`, so pan,
     wheel and pinch feel the same everywhere. `min`/`max` are the extent of
     the plotted data in x units (indices on a category axis); `points` is how
     many of them there are, which sets how far in a pinch may go. */
  function zoomOptions(cfg){
    cfg = cfg || {};
    var o = {
      pan: {enabled: cfg.pan !== false, mode: cfg.mode || 'x'},
      zoom: {
        wheel: {enabled: cfg.wheel !== false, speed: cfg.speed || 0.08},
        pinch: {enabled: cfg.pinch !== false},
        mode: cfg.mode || 'x'
      }
    };
    var lim = zoomLimits(cfg);
    if(lim) o.limits = lim;
    return o;
  }

  /* `limits` for one or more x scales. A chart with a second x axis over the
     same numbers (a calendar year and the age it lands on, say) passes both
     ids, because the zoom plugin moves every x scale together and a limit on
     one of them alone would let the other drift out of step. */
  function zoomLimits(cfg){
    cfg = cfg || {};
    if(!isFinite(cfg.min) || !isFinite(cfg.max)) return null;
    var span = Math.max(cfg.max - cfg.min, 0);
    if(!(span > 0)) return null;
    var minRange = cfg.minRange;
    if(minRange == null){
      // Roughly five data points: past that a line chart is two points and a
      // lot of grid. A chart that knows nothing about its density gets a
      // fortieth of the span, the same ceiling by another route.
      var pts = cfg.points;
      minRange = (pts && pts > 1) ? (span / (pts - 1)) * 5 : span / 40;
    }
    minRange = Math.min(minRange, span);
    var bound = {min: cfg.min, max: cfg.max, minRange: minRange};
    var out = {};
    (cfg.axes || ['x']).forEach(function(id){ out[id] = bound; });
    return out;
  }

  /* Registering the refit globally is offered for a page that builds charts in
     many places, but the usual wiring is per chart — `plugins: [SharedZoom.plugin]`
     in the chart's own config — so it cannot depend on shared.js having loaded
     after Chart.js. Charts that carry neither $fitY nor $autoFitY never notice
     it either way. */
  function registerFit(){
    var C = global.Chart;
    if(!C || !C.register) return false;
    if(C.registry && C.registry.plugins && C.registry.plugins.get){
      try { if(C.registry.plugins.get(FIT_PLUGIN.id)) return true; } catch(e){ /* not registered yet */ }
    }
    C.register(FIT_PLUGIN);
    return true;
  }

  global.SharedZoom = {
    plugin: FIT_PLUGIN,
    register: registerFit,
    options: zoomOptions,
    limits: zoomLimits,
    /* Fit y to the current x window outside an update — used right after a
       chart's data is replaced in place, where the axis would otherwise keep
       the bounds of the data it no longer holds. */
    refit: function(chart){
      if(!chart) return;
      var popts = chart.options && chart.options.plugins && chart.options.plugins.sharedYFit;
      writeFits(chart, popts);
    },
    /* Back to the view the chart opened on — see `resetView` above. */
    resetView: resetView
  };

  /* ── Mini cache (autosave) ─────────────────────────────────────────────────
     Snapshots a tool's form controls to localStorage and restores them on the
     next visit, so a returning user keeps their previous work instead of a
     blank page. Best-effort: it silently no-ops in private mode or on quota
     errors — persistence is a convenience, never a dependency.

     Usage (call once, at the very end of the tool's setup so restored values
     land after any default/demo seeding):

         Persist.init('financingvscash', { onRestore: recompute });

     What it saves: every <input>/<textarea>/<select> that has a stable handle
     (data-persist attribute, else id, else name). Skips file/password/hidden/
     button inputs and anything marked data-no-persist (put that on transient
     controls like search boxes). Radios are keyed by group name.

     Options:
       onRestore(data) — called once after values are restored; pass the tool's
                         recompute/render entrypoint so the UI reflects the
                         restored state. When omitted, a bubbling input+change
                         event is fired on each restored control instead.
       extra           — { save():obj, restore(obj) } to piggyback state that
                         isn't in a form control (a JS array of scenarios, a
                         "mode" flag, editable tax brackets…) into the same blob
                         and lifecycle. Call the returned schedule() after such
                         state changes so it gets saved.
       scope           — root element to scan (default: document).
       debounce        — ms to coalesce rapid edits before saving (default 400).
       version         — bump to invalidate an old, incompatible snapshot.

     Returns { save, schedule, collect, clear, snapshot, load }. snapshot() is
     the same blob that goes to localStorage; load(blob) applies one to the live
     page exactly as a returning visit would, then saves it. SharedScenario
     below uses the pair to write a scenario to a file and read it back.      */
  function makePersist(){
    function keyFor(ns, ver){ return 'abt:save:' + ns + ':v' + (ver || 1); }
    function handle(el){ return el.getAttribute('data-persist') || el.id || el.name || ''; }
    function persistable(el){
      if(!el || !el.tagName) return false;
      if(el.closest('[data-no-persist]')) return false;
      var tag = el.tagName;
      if(tag === 'SELECT' || tag === 'TEXTAREA') return !!handle(el);
      if(tag !== 'INPUT') return false;
      var t = (el.type || 'text').toLowerCase();
      if(['file','password','submit','button','reset','image','hidden'].indexOf(t) >= 0) return false;
      return !!handle(el);
    }
    function collect(scope){
      var out = {}, els = scope.querySelectorAll('input, textarea, select');
      for(var i=0;i<els.length;i++){
        var el = els[i]; if(!persistable(el)) continue;
        var t = (el.type||'').toLowerCase(), id = handle(el);
        if(t === 'checkbox') out['c:'+id] = !!el.checked;
        else if(t === 'radio'){ if(el.checked) out['r:'+el.name] = el.value; }
        else out['v:'+id] = el.value;
      }
      return out;
    }
    function restore(scope, data){
      var els = scope.querySelectorAll('input, textarea, select'), touched = [];
      for(var i=0;i<els.length;i++){
        var el = els[i]; if(!persistable(el)) continue;
        var t = (el.type||'').toLowerCase(), id = handle(el), hit = false;
        if(t === 'checkbox'){
          if(Object.prototype.hasOwnProperty.call(data,'c:'+id)){ el.checked = !!data['c:'+id]; hit = true; }
        } else if(t === 'radio'){
          if(Object.prototype.hasOwnProperty.call(data,'r:'+el.name)){ el.checked = (el.value === data['r:'+el.name]); hit = true; }
        } else if(Object.prototype.hasOwnProperty.call(data,'v:'+id)){ el.value = data['v:'+id]; hit = true; }
        if(hit) touched.push(el);
      }
      return touched;
    }
    function init(ns, opts){
      opts = opts || {};
      var scope = opts.scope || document;
      var KEY = keyFor(ns, opts.version);
      var hasExtra = opts.extra && typeof opts.extra.restore === 'function' && opts.extra.save && typeof opts.extra.save === 'function';
      function apply(saved){
        var touched = restore(scope, saved.__fields || saved);
        if(hasExtra && saved.__extra !== undefined){ try { opts.extra.restore(saved.__extra); } catch(e){} }
        if(typeof opts.onRestore === 'function'){ try { opts.onRestore(saved); } catch(e){} }
        else for(var i=0;i<touched.length;i++){
          touched[i].dispatchEvent(new Event('input', {bubbles:true}));
          touched[i].dispatchEvent(new Event('change', {bubbles:true}));
        }
      }
      var saved = null;
      try { var raw = localStorage.getItem(KEY); if(raw) saved = JSON.parse(raw); } catch(e){}
      if(saved && typeof saved === 'object') apply(saved);
      var timer = null;
      function snapshot(){
        var blob = { __fields: collect(scope) };
        if(hasExtra){ try { blob.__extra = JSON.parse(JSON.stringify(opts.extra.save())); } catch(e){} }
        return blob;
      }
      function save(){
        try { localStorage.setItem(KEY, JSON.stringify(snapshot())); } catch(e){}
        if(typeof opts.onSave === 'function'){ try { opts.onSave(); } catch(e){} }
      }
      function schedule(){ if(timer) clearTimeout(timer); timer = setTimeout(save, opts.debounce == null ? 400 : opts.debounce); }
      scope.addEventListener('input', schedule, true);
      scope.addEventListener('change', schedule, true);
      // Always flush on unload so structural changes that didn't fire an input
      // event (a removed row, a cleared field) are still captured.
      window.addEventListener('beforeunload', function(){ if(timer) clearTimeout(timer); save(); });
      return {
        save: save,
        schedule: schedule,
        collect: function(){ return collect(scope); },
        clear: function(){ try { localStorage.removeItem(KEY); } catch(e){} },
        snapshot: snapshot,
        load: function(blob){
          if(!blob || typeof blob !== 'object') return;
          if(timer) clearTimeout(timer);
          apply(blob);
          save();
        }
      };
    }
    return { init: init };
  }
  global.Persist = makePersist();

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

  /* ══════════════════════════════════════════════════════════════════════
     ABBREVIATIONS: shared glossary + auto-decoration (SharedAbbr)

     Every tool explains its jargon the same way: any glossary term found in
     visible page text is wrapped in <abbr class="abbr" data-tip="…">, which
     shared.css draws with a soft dashed underline and the shared tooltip
     expands on hover (LVR → Loan-to-Value Ratio).

     GLOSSARY keys are scopes:
       '*'                 every page on the site,
       'borrowingcapacity' that tool's folder, sub-pages included,
       'dcasimulator/ticker'  one sub-page only.
     The scope is read from the URL path, or from data-abbr-scope on <body>.

     An entry is [expansion, optional one-line gloss], or { en: …, id: … }
     when the Indonesian page needs its own wording (<html lang="id">).

     Keeping it calm: skipped inside links, buttons, form controls, code, the
     page title, anything that already carries a data-tip, and any element (or
     subtree) marked data-no-abbr. Use that for user data such as an uploaded
     table, a rendered document or a JSON tree.

     A tool with terms of its own can add them at runtime:
       SharedAbbr.add({ WACC: ['Weighted Average Cost of Capital'] });
     ══════════════════════════════════════════════════════════════════════ */
  var ABBR_GLOSSARY = {

    /* ── Cross-tool subject-matter vocabulary ──
       Only terms a reader may not know from the field the tool works in. File
       formats and everyday computing words (CSV, PDF, PNG, SVG, JSON, URL)
       are deliberately absent: everyone meets them at the download button, and
       underlining them there would drown the terms that carry real meaning. */
    '*': {
      CAGR: { en: ['Compound Annual Growth Rate', 'the one yearly rate that turns the starting value into the ending value'],
              id: ['Compound Annual Growth Rate', 'satu tarif tahunan yang mengubah nilai awal menjadi nilai akhir'] },
      ETF:  { en: ['Exchange-Traded Fund', 'a basket of assets that trades on an exchange like a single share'],
              id: ['Exchange-Traded Fund', 'sekeranjang aset yang diperdagangkan di bursa layaknya satu saham'] },
      ROI:  { en: ['Return on Investment', 'profit measured as a share of what you put in'],
              id: ['Return on Investment', 'keuntungan diukur sebagai porsi dari modal yang ditanam'] },
      /* Not an acronym, but the same problem: it sits next to a rate on half the
         tools and is never spelled out anywhere on the page. */
      'p.a.': { en: ['per annum', 'per year, so the rate is stated on a yearly basis'],
                id: ['per annum', 'per tahun, tarif dinyatakan dalam basis tahunan'] }
    },

    /* ── Finance vs Cash (consumer and asset lending) ── */
    financingvscash: {
      APR:  ['Annual Percentage Rate', 'what a loan really costs a year once the shape of the repayments is taken into account. A 5% flat loan carries an APR near 9%'],
      EAR:  ['Effective Annual Rate', 'a rate that already allows for compounding within the year, so 1% a month is 12.68% EAR, not 12%'],
    },

    /* ── Loan Types Explained ──
       The explainer names the markets each structure is sold in, so it carries
       vocabulary the tool itself never has to: the local name for a lender, a
       product or a contract a reader outside that market will not know. */
    'financingvscash/loan-types': {
      Murabaha:      ['cost-plus sale', 'an Islamic finance contract: the bank buys the asset and resells it to you at an agreed markup, paid in instalments. The markup behaves exactly like a flat rate'],
      multifinance:  ['a non-bank consumer lender', 'the South-East Asian term for the vehicle and appliance credit companies that quote a flat rate per month'],
      KPR:           ['Kredit Pemilikan Rumah', 'the Indonesian home loan'],
      Lombard:       ['a loan secured against a securities portfolio', 'drawn and repaid in one lump, so it is usually a bullet']
    },

    /* ── Borrowing Capacity (Australian home lending) ── */
    borrowingcapacity: {
      APRA: ['Australian Prudential Regulation Authority', 'the regulator that sets the serviceability buffer lenders must add'],
      DSP:  ['Disability Support Pension', 'a Centrelink payment, counted in full as income'],
      DTI:  ['Debt-to-Income ratio', 'total debt divided by gross income. Past 6.0 the loan is reportable to APRA as high DTI'],
      HECS: ['Higher Education Contribution Scheme', 'the older name for the same study loan'],
      HELP: ['Higher Education Loan Program', 'the Australian study loan, repaid through the tax system'],
      HEM:  ['Household Expenditure Measure', 'the benchmark living cost a lender falls back on when your declared expenses look too low'],
      LITO: ['Low Income Tax Offset', 'a rebate that trims the tax bill on lower incomes and tapers away as income rises'],
      LMI:  ['Lenders Mortgage Insurance', 'a one-off premium that lets a lender go past 80% LVR. It protects the lender, not you'],
      LOC:  ['Line of Credit', 'a revolving facility, assessed on its limit rather than its balance'],
      LVR:  ['Loan-to-Value Ratio', 'the loan as a share of the property value, or of the bank valuation if that is lower'],
      NPAT: ['Net Profit After Tax', 'the business profit a lender counts as self-employed income'],
      NSR:  ['Net Service Ratio', 'assessed income divided by every outgoing. It has to clear 1.00'],
      PAYG: ['Pay As You Go', 'salary taxed at the source by your employer'],
      UMI:  ['Uncommitted Monthly Income', 'what is left each month after living costs, commitments and the new repayment']
    },

    /* ── Cost of Living Comparator ── */
    'costofliving-comparator': {
      FX: ['Foreign Exchange', 'the rate one currency converts into another at']
    },

    /* ── DCA Scenario Explorer, Portfolio mode and the ticker reference ── */
    dcasimulator: {
      ADX:   ['Average Directional Index', 'how strong a trend is, whichever way it points'],
      DCA:   ['Dollar-Cost Averaging', 'investing a set amount on a set schedule instead of all at once'],
      EMA:   ['Exponential Moving Average', 'a moving average that weights recent prices most, so it turns faster than a plain one'],
      ESG:   ['Environmental, Social and Governance', 'a screen some funds apply to what they are allowed to hold'],
      IRR:   ['Internal Rate of Return', 'the annual rate at which your deposits and the final value balance out'],
      MA:    ['Moving Average', 'the average price over a rolling window, which smooths the day-to-day noise out of a trend'],
      MACD:  ['Moving Average Convergence Divergence', 'the gap between two moving averages, read as a trend signal'],
      MWR:   ['Money-Weighted Return', 'the growth of your actual money, so the timing of every deposit counts'],
      OHLC:  ['Open, High, Low, Close', 'the four prices a candlestick shows for one period'],
      REIT:  ['Real Estate Investment Trust', 'a listed trust that owns income-producing property'],
      RSI:   ['Relative Strength Index', 'a 0 to 100 momentum gauge. Low readings read as oversold'],
      TWR:   ['Time-Weighted Return', 'the growth of the asset itself, ignoring when money went in'],
      UCITS: ['Undertakings for Collective Investment in Transferable Securities', 'the European fund standard, common on cross-border ETFs']
    },
    'dcasimulator/ticker': {
      ASX:    ['Australian Securities Exchange'],
      BSE:    ['Bombay Stock Exchange'],
      HKEX:   ['Hong Kong Exchanges and Clearing'],
      IDX:    ['Indonesia Stock Exchange', 'Bursa Efek Indonesia'],
      CAC:    ['Cotation Assistée en Continu', 'the CAC 40 is the headline index of the Paris exchange'],
      KOSDAQ: ['Korea Securities Dealers Automated Quotations', 'the Korea Exchange board for smaller and growth companies'],
      KOSPI:  ['Korea Composite Stock Price Index', 'the main board of the Korea Exchange'],
      LSE:    ['London Stock Exchange'],
      NASDAQ: ['National Association of Securities Dealers Automated Quotations', 'the US exchange where most technology names list'],
      NSE:    ['National Stock Exchange of India'],
      NYSE:   ['New York Stock Exchange'],
      SGX:    ['Singapore Exchange'],
      SIX:    ['Swiss Infrastructure and Exchange', 'the Swiss stock exchange'],
      TSE:    ['Tokyo Stock Exchange'],
      XETRA:  ['Exchange Electronic Trading', 'the electronic market of the Frankfurt Stock Exchange']
    },

    /* ── Financial Freedom Calculator ── */
    financialfreedom: {
      FIRE: ['Financial Independence, Retire Early', 'the idea this tool does the arithmetic for: save hard, invest, then live off the pot'],
      MDD:  ['Maximum Drawdown', 'the deepest peak-to-trough fall an asset has had, which is what the crash test lands on you'],
      SORR: ['Sequence-of-Returns Risk', 'the risk that the bad years arrive early in retirement, when the pot is largest and has the longest left to fund'],
      SWR:  ['Safe Withdrawal Rate', 'the share of the pot you can spend each year without running out']
    },

    /* ── Rent vs Own Home (and its Sensitivity page, EN + ID) ── */
    rentvsownhouse: {
      RTB:   { en: ['Rent-Then-Buy', 'the third scenario: rent first, then buy partway through the run'],
               id: ['Rent-Then-Buy', 'skenario ketiga: menyewa dulu, lalu membeli di tengah periode'] },
      RPPI:  { en: ['Residential Property Price Index', 'the official measure of how fast house prices move'],
               id: ['Residential Property Price Index', 'Indeks Harga Properti Residensial, ukuran resmi laju pergerakan harga rumah'] },
      DP:    { en: ['Down Payment', 'the deposit paid upfront, the rest is borrowed'],
               id: ['Down Payment', 'uang muka yang dibayar di depan, sisanya dipinjam'] },
      KPR:   { en: ['Kredit Pemilikan Rumah', 'the Indonesian home loan'],
               id: ['Kredit Pemilikan Rumah', 'pinjaman bank untuk membeli rumah'] },
      BPHTB: { en: ['Bea Perolehan Hak atas Tanah dan Bangunan', 'the Indonesian buyer duty on transferring property title'],
               id: ['Bea Perolehan Hak atas Tanah dan Bangunan', 'pajak pembeli saat hak atas properti dialihkan'] },
      PBB:   { en: ['Pajak Bumi dan Bangunan', 'the annual Indonesian land and building tax'],
               id: ['Pajak Bumi dan Bangunan', 'pajak tahunan atas tanah dan bangunan'] }
    },

    /* ── PPh 21 Pisah vs Gabung (Indonesian personal income tax) ── */
    pisahvsgabung: {
      PPh:   { en: ['Pajak Penghasilan', 'Indonesian income tax. PPh 21 is the tax on personal employment income'],
               id: ['Pajak Penghasilan', 'PPh 21 adalah pajak atas penghasilan orang pribadi dari pekerjaan'] },
      PTKP:  { en: ['Penghasilan Tidak Kena Pajak', 'the slice of yearly income that is not taxed at all'],
               id: ['Penghasilan Tidak Kena Pajak', 'bagian penghasilan setahun yang tidak dikenai pajak'] },
      PKP:   { en: ['Penghasilan Kena Pajak', 'income left after PTKP and deductions, the figure the brackets run on'],
               id: ['Penghasilan Kena Pajak', 'penghasilan setelah PTKP dan pengurang, dasar perhitungan lapisan tarif'] },
      SPT:   { en: ['Surat Pemberitahuan Tahunan', 'the annual tax return'],
               id: ['Surat Pemberitahuan Tahunan', 'laporan pajak yang disampaikan setiap tahun'] },
      /* The single letters the PTKP section spells its codes out of, and the
         ones the computed-PTKP line uses for each spouse. Both pages carry
         both sets, so a reader switching language still gets a definition. */
      TK: { en: ['Tidak Kawin', 'not married'],
            id: ['Tidak Kawin', 'belum atau tidak menikah'] },
      K:  { en: ['Kawin', 'married'],
            id: ['Kawin', 'menikah'] },
      I:  { en: ['Istri', 'the wife, whose income is combined into one filing'],
            id: ['Istri', 'penghasilan istri digabung dalam satu SPT'] },
      H:  { en: ['Husband', 'the husband\u2019s side of the Pisah Harta filing'],
            id: ['Husband', 'sisi suami dalam skema Pisah Harta'] },
      W:  { en: ['Wife', 'the wife\u2019s side of the Pisah Harta filing'],
            id: ['Wife', 'sisi istri dalam skema Pisah Harta'] },
      S:  { en: ['Suami', 'the husband\u2019s side of the Pisah Harta filing'],
            id: ['Suami', 'sisi suami dalam skema Pisah Harta'] }
      /* The numbered status codes (TK/0 … K/I/3) are added below: they only
         differ by the dependant count, so writing all twelve out by hand would
         be twelve chances to let one drift out of step with the others. */
    },

    /* ── PowerFactory Scripter (and its samples page) ── */
    'powerfactory-scripter': {
      AC:   ['Alternating Current', 'the mains supply, where current reverses direction each cycle'],
      API:  ['Application Programming Interface', 'here, the PowerFactory Python folder a script imports from'],
      EMT:  ['Electromagnetic Transient', 'the instantaneous-value simulation. Slower than RMS, but it keeps switching and waveform detail'],
      HV:   ['High Voltage'],
      LV:   ['Low Voltage'],
      HVDC: ['High Voltage Direct Current', 'a DC link used to move bulk power or tie two AC systems together'],
      IEEE: ['Institute of Electrical and Electronics Engineers', 'the body whose published test systems these presets are built on'],
      /* MW is deliberately absent here: on the samples pages it is a unit next to
         a number ("163 MW", "0.61 MW per MW of G2"), and underlining every one
         would bury the terms that actually need explaining. So are N-1 and N-2:
         the page names the element count next to them every time they appear. */
      Op:   ['Operator', 'the comparison the filter applies to the value, such as = or >'],
      'p.u.': ['per unit', 'a quantity scaled against its rated base, so 1.0 is nameplate'],
      PF:   ['PowerFactory', 'the DIgSILENT PowerFactory power system simulator'],
      RMS:  ['Root Mean Square', 'the phasor-domain dynamic simulation, fast enough for stability studies'],
      SG:   ['Synchronous Generator', 'the rotating machine most large power stations use'],
      THD:  ['Total Harmonic Distortion', 'how much harmonic content distorts a waveform, as a share of the fundamental']
    },

    /* ── WEM Constraint Checker (Western Australian electricity market) ── */
    'wemconstraint-checker': {
      LHS: ['Left-Hand Side', 'the flow side of the constraint equation, what is actually flowing'],
      MW:  ['Megawatt', 'a million watts of active power'],
      RHS: ['Right-Hand Side', 'the limit side of the constraint equation, what the flow has to stay under'],
      WEM: ['Wholesale Electricity Market', 'the Western Australian electricity market']
    }
  };

  /* PTKP status codes carry the dependant count, and the tool lets a reader pick
     0 to 3, so "K/I/2" has to define itself as readily as "K/I/0" does. One pass
     writes the whole ladder, which keeps the three families worded alike. */
  (function expandPtkpCodes(scope, max){
    var dep = {
      en: ['no dependants', 'one dependant', 'two dependants', 'three dependants'],
      id: ['tanpa tanggungan', 'satu tanggungan', 'dua tanggungan', 'tiga tanggungan']
    };
    var family = [
      { code: 'TK/', en: 'Tidak Kawin', id: 'Tidak Kawin',
        enGloss: 'single, ', idGloss: 'lajang, ' },
      { code: 'K/',  en: 'Kawin', id: 'Kawin',
        enGloss: 'married, ', idGloss: 'kawin, ' },
      { code: 'K/I/', en: 'Kawin, Istri berpenghasilan', id: 'Kawin, penghasilan Istri digabung',
        enGloss: 'married with the spouse income combined, ', idGloss: 'kawin dengan penghasilan istri digabung, ' }
    ];
    for (var f = 0; f < family.length; f++) {
      for (var n = 0; n <= max; n++) {
        scope[family[f].code + n] = {
          en: [family[f].en + ', ' + n + ' tanggungan', family[f].enGloss + dep.en[n]],
          id: [family[f].id + ', ' + n + ' tanggungan', family[f].idGloss + dep.id[n]]
        };
      }
    }
  })(ABBR_GLOSSARY.pisahvsgabung, 3);

  function makeAbbr(global){
    /* Regions that must never be decorated: interactive controls, code, an
       element that already owns a tooltip, and anything opted out. */
    var SKIP = 'a,button,input,select,textarea,option,optgroup,code,pre,kbd,samp,var,' +
               'script,style,noscript,template,svg,canvas,iframe,abbr,' +
               'h1,.logo,.header-title,' +                       /* the tool's own name stays clean */
               '[class*="btn"],' +                               /* label-buttons read as controls too */
               '[contenteditable],[data-no-abbr],[data-tip],.tip-icon,.pf-tour-tooltip,#globalTooltip';
    var MAX_NODES = 5000;        // safety valve on a single pass
    var WORDY  = /[A-Za-z0-9_&#]/;
    var JOINER = /[.\-\/]/;      // a ticker suffix, a path, a hyphenated compound
    var PLURAL = /^[A-Z0-9]{3,}$/;

    var extra = {};              // terms a tool registered at runtime
    var terms = null;            // TERM -> tooltip HTML, for the active page
    var pattern = null;
    var observer = null, pendingRoots = [], queued = false, started = false;

    function escapeRe(s){ return s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); }

    /* This module is DOM-only. Node-side harnesses load shared.js for its
       maths helpers against a stub document, so check before touching one. */
    function hasDom(){
      return typeof document !== 'undefined' && !!document.body &&
             typeof document.createTreeWalker === 'function' &&
             typeof document.createDocumentFragment === 'function';
    }

    function locale(){
      var el = document.documentElement,
          l = (el && typeof el.getAttribute === 'function' && el.getAttribute('lang')) || 'en';
      return String(l).toLowerCase().slice(0,2) === 'id' ? 'id' : 'en';
    }

    /* '*' plus the tool folder the page sits in, plus the sub-page when the
       glossary defines one. Works from any path depth, file:// included. */
    function scopeKeys(){
      var explicit = document.body && typeof document.body.getAttribute === 'function' &&
                     document.body.getAttribute('data-abbr-scope');
      var path = (global.location && global.location.pathname) || '';
      var parts = String(explicit || path).split('/');
      var keys = ['*'], clean = [], i;
      for (i = 0; i < parts.length; i++) if (parts[i]) clean.push(parts[i]);
      if (!explicit && clean.length && clean[clean.length-1].indexOf('.') > -1) clean.pop();
      for (i = clean.length - 1; i >= 0; i--) {
        if (ABBR_GLOSSARY[clean[i]]) {
          keys.push(clean[i]);
          if (clean[i+1] && ABBR_GLOSSARY[clean[i] + '/' + clean[i+1]]) keys.push(clean[i] + '/' + clean[i+1]);
          break;
        }
      }
      return keys;
    }

    function tipHtml(entry, loc){
      if (!entry) return '';
      if (!(entry instanceof Array)) entry = entry[loc] || entry.en;
      if (!entry) return '';
      if (typeof entry === 'string') entry = [entry];
      return '<strong>' + entry[0] + '</strong>' + (entry[1] ? '<br>' + entry[1] : '');
    }

    function build(){
      var loc = locale(), keys = scopeKeys(), map = {}, list = [], i, k, src;
      for (i = 0; i < keys.length; i++) {
        src = ABBR_GLOSSARY[keys[i]];
        for (k in src) if (Object.prototype.hasOwnProperty.call(src, k)) map[k] = tipHtml(src[k], loc);
      }
      for (k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) map[k] = tipHtml(extra[k], loc);
      terms = map;
      for (k in map) if (map[k]) list.push(k);
      list.sort(function(a,b){ return b.length - a.length; });   // longest match wins
      pattern = list.length ? new RegExp(list.map(escapeRe).join('|'), 'g') : null;
    }

    function okLeft(text, i){
      if (i === 0) return true;
      var c = text.charAt(i-1);
      return !WORDY.test(c) && !JOINER.test(c);
    }
    function okRight(text, i){
      if (i >= text.length) return true;
      var c = text.charAt(i);
      if (WORDY.test(c)) return false;
      return !(JOINER.test(c) && WORDY.test(text.charAt(i+1)));
    }

    /* A flex or grid parent turns each run of text into an anonymous item, so
       splitting one would add items, add gaps and collapse the space at the
       seam. Keep the run as a single item by wrapping it. */
    function needsRunWrapper(node){
      var parent = node.parentElement;
      if (!parent || typeof global.getComputedStyle !== 'function') return false;
      var display = global.getComputedStyle(parent).display || '';
      return display.indexOf('flex') > -1 || display.indexOf('grid') > -1;
    }

    /* Split one text node around every term it holds. Leftover text never
       contains a term, so re-scanning what this inserts is a no-op. */
    function decorateNode(node){
      if (!node.parentNode) return 0;
      var text = node.nodeValue, frag = null, last = 0, hits = 0, m, term, start, end, el, run;
      pattern.lastIndex = 0;
      while ((m = pattern.exec(text))) {
        term = m[0];
        start = m.index;
        end = start + term.length;
        if (PLURAL.test(term) && text.charAt(end) === 's') end++;       // ETFs, PNGs
        if (!okLeft(text, start) || !okRight(text, end)) { pattern.lastIndex = start + 1; continue; }
        if (!frag) frag = document.createDocumentFragment();
        if (start > last) frag.appendChild(document.createTextNode(text.slice(last, start)));
        el = document.createElement('abbr');
        el.className = 'abbr';
        el.setAttribute('data-abbr', term);
        el.setAttribute('data-tip', terms[term]);
        el.textContent = text.slice(start, end);
        frag.appendChild(el);
        last = end;
        hits++;
        pattern.lastIndex = end;
      }
      if (!frag) return 0;
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      if (needsRunWrapper(node)) {
        run = document.createElement('span');
        run.className = 'abbr-run';
        run.appendChild(frag);
        frag = run;
      }
      node.parentNode.replaceChild(frag, node);
      return hits;
    }

    function scan(root){
      if (!pattern) return 0;
      root = root || document.body;
      if (!root) return 0;
      if (root.nodeType === 3) {
        var owner = root.parentElement;
        if (!owner || owner.closest(SKIP)) return 0;
        pattern.lastIndex = 0;
        return pattern.test(root.nodeValue || '') ? decorateNode(root) : 0;
      }
      if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return 0;
      if (root.nodeType === 1 && root.closest(SKIP)) return 0;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null),
          found = [], hits = 0, node, value, parent, i;
      while ((node = walker.nextNode())) {
        value = node.nodeValue;
        if (!value || value.length < 2) continue;
        pattern.lastIndex = 0;
        if (!pattern.test(value)) continue;
        parent = node.parentElement;
        if (!parent || parent.closest(SKIP)) continue;
        found.push(node);
        if (found.length >= MAX_NODES) break;
      }
      for (i = 0; i < found.length; i++) hits += decorateNode(found[i]);
      return hits;
    }

    function flush(){
      queued = false;
      var roots = pendingRoots, i;
      pendingRoots = [];
      for (i = 0; i < roots.length; i++) if (roots[i] && roots[i].isConnected) scan(roots[i]);
    }

    function queue(root){
      if (!root) return;
      pendingRoots.push(root);
      if (queued) return;
      queued = true;
      if (global.requestAnimationFrame) global.requestAnimationFrame(flush);
      else setTimeout(flush, 16);
    }

    /* Tools rewrite their results constantly, so watch instead of re-running. */
    function onMutations(records){
      var i, j, rec, node;
      for (i = 0; i < records.length; i++) {
        rec = records[i];
        if (rec.type === 'characterData') { queue(rec.target); continue; }
        for (j = 0; j < rec.addedNodes.length; j++) {
          node = rec.addedNodes[j];
          if (node.nodeType === 1 || node.nodeType === 3) queue(node);
        }
      }
    }

    function init(){
      if (started || !hasDom()) return;
      started = true;
      build();
      scan(document.body);
      if (global.MutationObserver) {
        observer = new MutationObserver(onMutations);
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      }
    }

    return {
      GLOSSARY: ABBR_GLOSSARY,
      init: init,
      /* Register page-specific terms, same entry shape as the glossary. */
      add: function(map){
        if (!map) return;
        for (var k in map) if (Object.prototype.hasOwnProperty.call(map, k)) extra[k] = map[k];
        if (started && hasDom()) { build(); scan(document.body); }
      },
      /* Decorate a subtree now (rarely needed, the observer handles updates). */
      scan: function(root){ if (!hasDom()) return 0; if (!pattern) build(); return scan(root); },
      /* Re-read scope, locale and terms, then decorate the page again. */
      refresh: function(){ if (!hasDom()) return 0; build(); return scan(document.body); },
      /* Tooltip HTML for a term on this page, or '' when it is not defined. */
      define: function(term){ if (!terms) build(); return terms[term] || ''; },
      terms: function(){ if (!terms) build(); return Object.keys(terms); },
      /* Strip the decoration from a subtree, e.g. before exporting a clone. */
      undecorate: function(root){
        root = root || document.body;
        if (!root || !root.querySelectorAll) return 0;
        var els = root.querySelectorAll('abbr.abbr'), runs, i, run;
        for (i = 0; i < els.length; i++) els[i].parentNode.replaceChild(document.createTextNode(els[i].textContent), els[i]);
        runs = root.querySelectorAll('span.abbr-run');
        for (i = 0; i < runs.length; i++) {
          run = runs[i];
          while (run.firstChild) run.parentNode.insertBefore(run.firstChild, run);
          run.parentNode.removeChild(run);
        }
        if (root.normalize) root.normalize();
        return els.length;
      },
      stop: function(){ if (observer) { observer.disconnect(); observer = null; } started = false; }
    };
  }

  global.SharedAbbr = makeAbbr(global);

  function initShared(){
    initTooltip();
    global.SharedAbbr.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShared);
  } else {
    initShared();
  }
})(window);
