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

  /* ── Market data fetch (Yahoo Finance chart endpoint) ──────────────────────
     NOTE: "yfinance" is not a separate API — the Python library is just a
     wrapper around Yahoo's public chart endpoint
     (query1/query2.finance.yahoo.com/v8/finance/chart), which is exactly what
     we call here. A browser can't hit it directly (no CORS headers), so we
     relay through public CORS proxies. Those free proxies are the flaky part,
     NOT Yahoo — so this engine:
       1. races several proxies AND both Yahoo hosts concurrently (first valid
          response wins, the rest are aborted immediately),
       2. retries the whole race a couple of times with backoff, and
       3. lets you put your OWN proxy in front (the real failsafe) via
          SharedYF.setProxy('https://your-worker.example.com/?url=') — a tiny
          Cloudflare Worker / serverless function removes the dependence on
          third-party proxies entirely. See dcasimulator/yf-proxy-worker.js.
     ──────────────────────────────────────────────────────────────────────── */
  var YF_SELF_PROXY = ''; // e.g. 'https://yf.adjiebrotots.com/?url=' (see setProxy)

  function yfIso(d){ return d.toISOString().slice(0,10); }

  async function yfFetchWithTimeout(url, timeoutMs, externalSignal){
    var controller = new AbortController();
    var timeoutId = setTimeout(function(){ controller.abort(); }, timeoutMs);
    var onAbort = function(){ controller.abort(); };
    if (externalSignal){
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener('abort', onAbort, {once:true});
    }
    try {
      return await fetch(url, {signal: controller.signal, cache:'no-store'});
    } catch(err){
      if (err && err.name === 'AbortError') throw new Error('timed out');
      throw err;
    } finally {
      clearTimeout(timeoutId);
      if (externalSignal) externalSignal.removeEventListener('abort', onAbort);
    }
  }

  function yfBuildCandidates(ticker, yfParams){
    var enc = encodeURIComponent;
    var yf1 = 'https://query1.finance.yahoo.com/v8/finance/chart/' + enc(ticker) + '?' + yfParams;
    var yf2 = 'https://query2.finance.yahoo.com/v8/finance/chart/' + enc(ticker) + '?' + yfParams;
    var jsonParse = function(r){ return r.json(); };
    var list = [];
    // Your own proxy first — fastest and most reliable when configured.
    if (YF_SELF_PROXY){
      list.push({url: YF_SELF_PROXY + enc(yf1), parse: jsonParse});
      list.push({url: YF_SELF_PROXY + enc(yf2), parse: jsonParse});
    }
    // Public CORS proxies, raced concurrently across both Yahoo hosts.
    list.push({url: 'https://api.allorigins.win/raw?url=' + enc(yf1), parse: jsonParse});
    list.push({url: 'https://corsproxy.io/?url=' + enc(yf1), parse: jsonParse});
    list.push({url: 'https://api.codetabs.com/v1/proxy/?quest=' + enc(yf1), parse: jsonParse});
    list.push({url: 'https://api.allorigins.win/raw?url=' + enc(yf2), parse: jsonParse});
    list.push({url: 'https://corsproxy.io/?url=' + enc(yf2), parse: jsonParse});
    list.push({url: 'https://api.codetabs.com/v1/proxy/?quest=' + enc(yf2), parse: jsonParse});
    list.push({url: 'https://api.allorigins.win/get?url=' + enc(yf1), parse: async function(r){
      var w = await r.json(); return JSON.parse(w.contents);
    }});
    list.push({url: 'https://r.jina.ai/http://query1.finance.yahoo.com/v8/finance/chart/' + enc(ticker) + '?' + yfParams, parse: async function(r){
      var t = await r.text(); var s = t.indexOf('{'); return JSON.parse(s>=0 ? t.slice(s) : t);
    }});
    return list;
  }

  async function yfRaceOnce(candidates, timeoutMs){
    var lastError = null;
    var abortAll = new AbortController();
    var attempts = candidates.map(function(c){
      return (async function(){
        try {
          var resp = await yfFetchWithTimeout(c.url, timeoutMs, abortAll.signal);
          if (!resp.ok) throw new Error('HTTP ' + resp.status);
          var parsed = await c.parse(resp);
          if (!parsed || !parsed.chart || !parsed.chart.result || !parsed.chart.result[0]){
            throw new Error('No chart result');
          }
          return parsed;
        } catch(err){ lastError = err; throw err; }
      })();
    });
    try {
      return await Promise.any(attempts);
    } catch(_){
      var e = new Error(lastError && lastError.message ? lastError.message : 'all sources failed');
      e.isRaceFailure = true;
      throw e;
    } finally {
      abortAll.abort();
    }
  }

  // Fetch adjusted daily closes for `ticker` between two ISO dates.
  // Returns {dates:[ISO...], prices:[Number...]} or throws after all retries.
  async function yfFetchPrices(ticker, startDate, endDate){
    var start = Math.floor(new Date(startDate).getTime()/1000);
    var end = Math.floor(new Date(endDate).getTime()/1000 + 86400);
    var cb = yfIso(new Date());
    var yfParams = 'period1=' + start + '&period2=' + end + '&interval=1d&events=history&_cb=' + cb;
    var candidates = yfBuildCandidates(ticker, yfParams);

    var data = null, lastError = null;
    var ROUNDS = 3;
    for (var attempt = 0; attempt < ROUNDS; attempt++){
      try {
        data = await yfRaceOnce(candidates, 12000);
        break;
      } catch(err){
        lastError = err;
        if (attempt < ROUNDS - 1){
          await new Promise(function(res){ setTimeout(res, 700 * Math.pow(2, attempt)); });
        }
      }
    }
    if (!data) throw new Error('Unable to fetch market data (' + (lastError && lastError.message ? lastError.message : 'unknown error') + ')');

    var result = data.chart.result[0];
    var ts = result.timestamp;
    var ind = result.indicators || {};
    var closes = (ind.adjclose && ind.adjclose[0] && ind.adjclose[0].adjclose) ||
                 (ind.quote && ind.quote[0] && ind.quote[0].close);
    if (!ts || !closes) throw new Error('Invalid data structure for ' + ticker);
    var dates = [], prices = [];
    for (var i=0; i<ts.length; i++){
      if (closes[i] == null) continue;
      dates.push(yfIso(new Date(ts[i]*1000)));
      prices.push(closes[i]);
    }
    if (!dates.length) throw new Error('No price data in range for ' + ticker);
    return {dates: dates, prices: prices};
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
