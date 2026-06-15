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

  /* ── Market data fetch (Yahoo Finance + Stooq) ─────────────────────────────
     NOTE: "yfinance" is not a separate API — the Python library is just a
     wrapper around Yahoo's public chart endpoint
     (query1/query2.finance.yahoo.com/v8/finance/chart), which is exactly what
     we call here. A browser can't hit it directly (no CORS headers), so we
     relay through public CORS proxies. Those free proxies are the flaky part,
     NOT Yahoo — so this engine:
       1. races several proxies (and both Yahoo hosts) concurrently — first
          valid response wins, the rest are aborted immediately;
       2. falls back to a second, fully independent data source (Stooq) so a
          fetch can still succeed when every Yahoo proxy is down;
       3. retries the whole sequence a few times with backoff; and
       4. lets you put your OWN proxy in front (the real failsafe) via
          SharedYF.setProxy('https://your-worker.example.com/?url=') — a tiny
          Cloudflare Worker removes the dependence on third-party proxies.
          See dcasimulator/yf-proxy-worker.js.

     Stooq also unlocks instruments Yahoo handles awkwardly: spot FX such as
     USDIDR and precious metals such as XAUUSD / XAGUSD. For those, Stooq is
     tried FIRST and Yahoo (USDIDR=X form) is the fallback.
     ──────────────────────────────────────────────────────────────────────── */
  var YF_SELF_PROXY = ''; // e.g. 'https://yf.adjiebrotots.com/?url=' (see setProxy)

  // 3-letter codes treated as FX/metal legs. Metals (XAU/XAG/XPT/XPD) trade as
  // currency pairs on Stooq (e.g. xauusd), so they ride the same FX path.
  var FX_CODES = {
    USD:1,EUR:1,GBP:1,JPY:1,AUD:1,NZD:1,CAD:1,CHF:1,CNY:1,CNH:1,HKD:1,SGD:1,
    IDR:1,INR:1,MYR:1,KRW:1,THB:1,PHP:1,VND:1,TWD:1,ZAR:1,BRL:1,MXN:1,RUB:1,
    TRY:1,SEK:1,NOK:1,DKK:1,PLN:1,CZK:1,HUF:1,AED:1,SAR:1,ILS:1,
    XAU:1,XAG:1,XPT:1,XPD:1
  };
  // Yahoo exchange suffix → Stooq market suffix, for stocks/ETFs we can map
  // with confidence. Markets not listed (e.g. .JK, .SI, .KS, .NS) stay
  // Yahoo-only — Stooq's coverage there is unreliable, so we don't risk it.
  var STOOQ_SUFFIX = {
    AX:'au', L:'uk', DE:'de', PA:'fr', AS:'nl', BR:'be', LS:'pt', MC:'es',
    MI:'it', SW:'ch', VI:'at', ST:'se', HE:'fi', OL:'no', CO:'dk', HK:'hk',
    T:'jp', SS:'cn', SZ:'cn', TO:'ca', V:'ca'
  };

  function yfIso(d){ return d.toISOString().slice(0,10); }
  function compactDate(isoStr){ return String(isoStr).slice(0,10).replace(/-/g,''); }

  async function yfFetchText(url, timeoutMs, externalSignal, unwrap){
    var controller = new AbortController();
    var timeoutId = setTimeout(function(){ controller.abort(); }, timeoutMs);
    var onAbort = function(){ controller.abort(); };
    if (externalSignal){
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener('abort', onAbort, {once:true});
    }
    try {
      var resp = await fetch(url, {signal: controller.signal, cache:'no-store'});
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      if (unwrap === 'allorigins-get'){
        var w = await resp.json();
        return w && w.contents != null ? String(w.contents) : '';
      }
      return await resp.text();
    } catch(err){
      if (err && err.name === 'AbortError') throw new Error('timed out');
      throw err;
    } finally {
      clearTimeout(timeoutId);
      if (externalSignal) externalSignal.removeEventListener('abort', onAbort);
    }
  }

  // Wrap a target URL in every available CORS proxy (self-hosted first).
  function proxyWrap(targetUrl){
    var enc = encodeURIComponent;
    var out = [];
    if (YF_SELF_PROXY) out.push({url: YF_SELF_PROXY + enc(targetUrl), unwrap:'raw'});
    out.push({url: 'https://api.allorigins.win/raw?url=' + enc(targetUrl), unwrap:'raw'});
    out.push({url: 'https://corsproxy.io/?url=' + enc(targetUrl), unwrap:'raw'});
    out.push({url: 'https://api.codetabs.com/v1/proxy/?quest=' + enc(targetUrl), unwrap:'raw'});
    out.push({url: 'https://api.allorigins.win/get?url=' + enc(targetUrl), unwrap:'allorigins-get'});
    return out;
  }

  // Parse Yahoo chart JSON text → {dates, prices} (adjusted close preferred).
  function parseYahoo(text){
    var jsonStart = text.indexOf('{');
    var data = JSON.parse(jsonStart > 0 ? text.slice(jsonStart) : text);
    var result = data && data.chart && data.chart.result && data.chart.result[0];
    if (!result) throw new Error('No chart result');
    var ts = result.timestamp;
    var ind = result.indicators || {};
    var closes = (ind.adjclose && ind.adjclose[0] && ind.adjclose[0].adjclose) ||
                 (ind.quote && ind.quote[0] && ind.quote[0].close);
    if (!ts || !closes) throw new Error('No price series');
    var dates = [], prices = [];
    for (var i=0; i<ts.length; i++){
      if (closes[i] == null) continue;
      dates.push(yfIso(new Date(ts[i]*1000)));
      prices.push(closes[i]);
    }
    if (!dates.length) throw new Error('Empty price series');
    return {dates: dates, prices: prices};
  }

  // Parse Stooq CSV text → {dates, prices} using the Close column.
  function parseStooq(text){
    var t = (text || '').trim();
    // Stooq returns plain-text errors like "No data" or a rate-limit notice.
    if (!/^Date,/i.test(t)) throw new Error(t.slice(0, 60) || 'No CSV');
    var lines = t.split(/\r?\n/);
    var header = lines[0].split(',');
    var di = header.indexOf('Date'), ci = header.indexOf('Close');
    if (di < 0 || ci < 0) throw new Error('Unexpected CSV columns');
    var dates = [], prices = [];
    for (var i=1; i<lines.length; i++){
      if (!lines[i]) continue;
      var cols = lines[i].split(',');
      var px = parseFloat(cols[ci]);
      if (!isFinite(px)) continue;
      dates.push(cols[di].slice(0,10));
      prices.push(px);
    }
    if (!dates.length) throw new Error('Empty CSV');
    return {dates: dates, prices: prices};
  }

  // Race all proxy-wrapped candidates for one provider; first valid wins.
  async function raceCandidates(candidates, parse, timeoutMs){
    var lastError = null;
    var abortAll = new AbortController();
    var attempts = candidates.map(function(c){
      return (async function(){
        try {
          var text = await yfFetchText(c.url, timeoutMs, abortAll.signal, c.unwrap);
          return parse(text);
        } catch(err){ lastError = err; throw err; }
      })();
    });
    try {
      return await Promise.any(attempts);
    } catch(_){
      throw new Error(lastError && lastError.message ? lastError.message : 'all sources failed');
    } finally {
      abortAll.abort();
    }
  }

  // Classify a ticker into an ordered list of providers to try.
  function classify(ticker, startDate, endDate){
    var t = String(ticker || '').trim().toUpperCase();
    if (!t) throw new Error('Invalid ticker');
    var s = Math.floor(new Date(startDate).getTime()/1000);
    var e = Math.floor(new Date(endDate).getTime()/1000 + 86400);
    var cb = yfIso(new Date());
    var enc = encodeURIComponent;

    function yahooProvider(sym){
      var p = 'period1=' + s + '&period2=' + e + '&interval=1d&events=history&_cb=' + cb;
      return {
        name: 'yahoo:' + sym, source: 'yahoo', parse: parseYahoo,
        candidates: proxyWrap('https://query1.finance.yahoo.com/v8/finance/chart/' + enc(sym) + '?' + p)
                .concat(proxyWrap('https://query2.finance.yahoo.com/v8/finance/chart/' + enc(sym) + '?' + p))
      };
    }
    function stooqProvider(sym){
      var url = 'https://stooq.com/q/d/l/?s=' + enc(sym) + '&i=d' +
                '&d1=' + compactDate(startDate) + '&d2=' + compactDate(endDate);
      return { name: 'stooq:' + sym, source: 'stooq', parse: parseStooq, candidates: proxyWrap(url) };
    }

    // Spot FX / metals: 'USDIDR', 'XAUUSD', or Yahoo's 'USDIDR=X' form.
    var core = t.replace(/=X$/, '');
    var isFx = /^[A-Z]{6}$/.test(core) && FX_CODES[core.slice(0,3)] && FX_CODES[core.slice(3,6)];
    if (/=X$/.test(t) || isFx){
      // Stooq is the better source for spot FX/metals → try it first.
      return { kind: 'fx', providers: [ stooqProvider(core.toLowerCase()), yahooProvider(core + '=X') ] };
    }

    // Stocks / ETFs / indices: Yahoo first (adjusted close), Stooq as fallback.
    var providers = [ yahooProvider(t) ];
    var stooqSym = null;
    var dot = t.indexOf('.');
    if (dot < 0){
      stooqSym = t.toLowerCase() + '.us';            // US listing
    } else {
      var suffix = STOOQ_SUFFIX[t.slice(dot + 1)];
      if (suffix) stooqSym = t.slice(0, dot).toLowerCase() + '.' + suffix;
    }
    if (stooqSym) providers.push(stooqProvider(stooqSym));
    return { kind: 'stock', providers: providers };
  }

  // Fetch daily closes for `ticker` between two ISO dates. Returns
  // {dates, prices, source:'yahoo'|'stooq', kind:'stock'|'fx'} or throws.
  // NOTE: for kind==='stock', a 'stooq' source means Yahoo was unreachable and
  // we fell back to Stooq, whose stock closes are UNADJUSTED (no split/dividend
  // adjustment) — callers should warn the user. FX/metals need no adjustment.
  async function yfFetchPrices(ticker, startDate, endDate){
    var cls = classify(ticker, startDate, endDate);
    var providers = cls.providers;
    var lastError = null;
    var ROUNDS = 2;
    for (var attempt = 0; attempt < ROUNDS; attempt++){
      for (var p = 0; p < providers.length; p++){
        try {
          var out = await raceCandidates(providers[p].candidates, providers[p].parse, 12000);
          out.source = providers[p].source;
          out.kind = cls.kind;
          return out;
        } catch(err){ lastError = err; }
      }
      if (attempt < ROUNDS - 1){
        await new Promise(function(res){ setTimeout(res, 800 * Math.pow(2, attempt)); });
      }
    }
    throw new Error('Unable to fetch market data for ' + ticker +
      ' (' + (lastError && lastError.message ? lastError.message : 'unknown error') + ')');
  }

  global.SharedYF = {
    fetchPrices: yfFetchPrices,
    setProxy: function(baseUrl){ YF_SELF_PROXY = baseUrl || ''; },
    getProxy: function(){ return YF_SELF_PROXY; }
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
