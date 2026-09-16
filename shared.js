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

     Returns { save, schedule, collect, clear }.                                 */
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
      var saved = null;
      try { var raw = localStorage.getItem(KEY); if(raw) saved = JSON.parse(raw); } catch(e){}
      if(saved && typeof saved === 'object'){
        var touched = restore(scope, saved.__fields || saved);
        if(hasExtra && saved.__extra !== undefined){ try { opts.extra.restore(saved.__extra); } catch(e){} }
        if(typeof opts.onRestore === 'function'){ try { opts.onRestore(saved); } catch(e){} }
        else for(var i=0;i<touched.length;i++){
          touched[i].dispatchEvent(new Event('input', {bubbles:true}));
          touched[i].dispatchEvent(new Event('change', {bubbles:true}));
        }
      }
      var timer = null;
      function save(){
        var blob = { __fields: collect(scope) };
        if(hasExtra){ try { blob.__extra = opts.extra.save(); } catch(e){} }
        try { localStorage.setItem(KEY, JSON.stringify(blob)); } catch(e){}
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
        clear: function(){ try { localStorage.removeItem(KEY); } catch(e){} }
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
      CAGR: ['Compound Annual Growth Rate', 'the one yearly rate that turns the starting value into the ending value'],
      ETF:  ['Exchange-Traded Fund', 'a basket of assets that trades on an exchange like a single share'],
      ROI:  ['Return on Investment', 'profit measured as a share of what you put in']
    },

    /* ── Borrowing Capacity (Australian home lending) ── */
    borrowingcapacity: {
      APRA: ['Australian Prudential Regulation Authority', 'the regulator that sets the serviceability buffer lenders must add'],
      DSP:  ['Disability Support Pension', 'a Centrelink payment, counted in full as income'],
      DTI:  ['Debt-to-Income ratio', 'total debt divided by gross income. Past 6.0 the loan is reportable to APRA as high DTI'],
      HECS: ['Higher Education Contribution Scheme', 'the older name for the same study loan'],
      HELP: ['Higher Education Loan Program', 'the Australian study loan, repaid through the tax system'],
      HEM:  ['Household Expenditure Measure', 'the benchmark living cost a lender falls back on when your declared expenses look too low'],
      LMI:  ['Lenders Mortgage Insurance', 'a one-off premium that lets a lender go past 80% LVR. It protects the lender, not you'],
      LOC:  ['Line of Credit', 'a revolving facility, assessed on its limit rather than its balance'],
      LVR:  ['Loan-to-Value Ratio', 'the loan as a share of the property value, or of the bank valuation if that is lower'],
      NPAT: ['Net Profit After Tax', 'the business profit a lender counts as self-employed income'],
      NSR:  ['Net Service Ratio', 'assessed income divided by every outgoing. It has to clear 1.00'],
      PAYG: ['Pay As You Go', 'salary taxed at the source by your employer'],
      UMI:  ['Uncommitted Monthly Income', 'what is left each month after living costs, commitments and the new repayment']
    },

    /* ── DCA Scenario Explorer, Portfolio mode and the ticker reference ── */
    dcasimulator: {
      ADX:   ['Average Directional Index', 'how strong a trend is, whichever way it points'],
      DCA:   ['Dollar-Cost Averaging', 'investing a set amount on a set schedule instead of all at once'],
      ESG:   ['Environmental, Social and Governance', 'a screen some funds apply to what they are allowed to hold'],
      IRR:   ['Internal Rate of Return', 'the annual rate at which your deposits and the final value balance out'],
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

    /* ── Rent vs Own Home (and its Sensitivity page, EN + ID) ── */
    rentvsownhouse: {
      RPPI:  ['Residential Property Price Index', 'the official measure of how fast house prices move'],
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
      'TK/0':  { en: ['Tidak Kawin, 0 tanggungan', 'single, no dependants. The base PTKP'],
                 id: ['Tidak Kawin, 0 tanggungan', 'lajang tanpa tanggungan, PTKP dasar'] },
      'K/0':   { en: ['Kawin, 0 tanggungan', 'married, no dependants'],
                 id: ['Kawin, 0 tanggungan', 'kawin tanpa tanggungan'] },
      'K/I/0': { en: ['Kawin, Istri berpenghasilan, 0 tanggungan', 'married with the spouse income combined, no dependants'],
                 id: ['Kawin, penghasilan Istri digabung, 0 tanggungan', 'kawin dengan penghasilan istri digabung, tanpa tanggungan'] }
    },

    /* ── PowerFactory Scripter (and its samples page) ── */
    'powerfactory-scripter': {
      AC:   ['Alternating Current', 'the mains supply, where current reverses direction each cycle'],
      API:  ['Application Programming Interface', 'here, the PowerFactory Python folder a script imports from'],
      EMT:  ['Electromagnetic Transient', 'the instantaneous-value simulation. Slower than RMS, but it keeps switching and waveform detail'],
      HV:   ['High Voltage'],
      HVDC: ['High Voltage Direct Current', 'a DC link used to move bulk power or tie two AC systems together'],
      IEEE: ['Institute of Electrical and Electronics Engineers', 'the body whose published test systems these presets are built on'],
      /* MW is deliberately absent here: on the samples pages it is a unit next to
         a number ("163 MW", "0.61 MW per MW of G2"), and underlining every one
         would bury the terms that actually need explaining. */
      'N-1': ['N minus 1', 'the test that the network still holds with any single element out of service'],
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
