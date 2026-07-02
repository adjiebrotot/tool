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
