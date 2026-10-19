/* ──────────────────────────────────────────────────────────────────────────
   Share snapshot — a chart written down as data, for the embed viewer
   Loaded by shared.js the first time a reader opens Embed as HTML.

   The embed viewer (embed/) draws a shared chart with Chart.js and
   chart-kit.js alone: no tool script, no model, nothing computed in the
   other site's frame. So everything the chart shows is written down here,
   while the tool is open and has computed it:

     - the datasets and their looks, with every per-point callback resolved
       to the values it gave;
     - the options, with each function carried by its ChartKit name
       (chart-kit.js) or dropped where the snapshot carries its output;
     - the hover card, baked: the tool's own tooltip callbacks are run for
       every point, and the viewer hands back their lines;
     - the axis labels: a category axis's labels one by one, a numeric
       axis's as a table over its whole numbers where it is short, and a
       format learned from the tool's own callback for everything else;
     - the key (legend entries, their swatches and the datasets each one
       shows and hides, found by pressing it);
     - every view the card offers (the controls marked data-embed-mode):
       each combination is set, drawn and written down as its own frame,
       and the reader's own view is put back after.

   A Plotly chart is written down as its figure; a diagram the tool draws
   itself (data-share-chart) as its SVG, element by element, with only the
   tags and attributes a drawing needs.

   Everything here reads the page and puts it back as it found it: a mode
   pressed to be written down is pressed back, and whatever a tooltip
   callback writes into the page while it is run is undone.
   ────────────────────────────────────────────────────────────────────────── */
(function(global){
  var K = global.ChartKit;
  var MAX_FRAMES = 24;

  function each(list, fn){ Array.prototype.forEach.call(list || [], fn); }
  function norm(s){ return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

  /* ── A pool of arrays, so a series that several frames share is written once ── */
  function Pool(){ this.list = []; this.at = {}; }
  Pool.prototype.ref = function(arr){
    var s = JSON.stringify(arr);
    if(!Object.prototype.hasOwnProperty.call(this.at, s)){ this.at[s] = this.list.length; this.list.push(arr); }
    return { $p: this.at[s] };
  };

  /* ── Plain data out of a configuration ──
     Numbers, strings, booleans, arrays and plain objects pass; a function
     passes as its ChartKit name, or goes to `onFn`, which returns what to
     write in its place (undefined drops it). Keys starting $ or _ are
     Chart.js's own bookkeeping and stay behind. */
  var POOL = null;
  function freeze(v, path, onFn, seen){
    if(v === null || typeof v === 'boolean' || typeof v === 'string') return v;
    if(typeof v === 'number') return isFinite(v) ? v : undefined;
    if(typeof v === 'function'){
      var r = K.refOf(v);
      return r ? { $k: kitRef(r) } : (onFn ? onFn(v, path) : undefined);
    }
    if(v === undefined) return undefined;
    if(ArrayBuffer.isView(v)) return Array.prototype.slice.call(v);
    if(K.refOf(v)) return { $k: kitRef(K.refOf(v)) };
    seen = seen || [];
    if(typeof v !== 'object' || seen.indexOf(v) >= 0) return undefined;
    var proto = Object.getPrototypeOf(v);
    if(!Array.isArray(v) && proto !== Object.prototype && proto !== null) return undefined;
    seen.push(v);
    var out;
    if(Array.isArray(v)){
      out = v.map(function(x, i){ var f = freeze(x, path + '.' + i, onFn, seen); return f === undefined ? null : f; });
    } else {
      out = {};
      Object.keys(v).forEach(function(k){
        if(k.charAt(0) === '$' || k.charAt(0) === '_') return;
        var f = freeze(v[k], path + '.' + k, onFn, seen);
        if(f !== undefined) out[k] = f;
      });
    }
    seen.pop();
    return out;
  }

  // A ChartKit name, with a factory's arguments as data (long ones pooled).
  function kitRef(r){
    if(!r.a) return { n: r.n };
    return { n: r.n, a: r.a.map(function(x){ return pooled(freeze(x, '', null)); }) };
  }

  /* A drawn value to eight significant figures: a part in a hundred
     million, far under a pixel, and half the digits of a double. */
  function fig(v){ return typeof v === 'number' && isFinite(v) && v % 1 ? +v.toPrecision(8) : v; }
  function figs(v){
    if(typeof v === 'number') return fig(v);
    if(Array.isArray(v)) return v.map(figs);
    if(v && typeof v === 'object' && !v.$p && !v.$k){ var o = {}; Object.keys(v).forEach(function(k){ o[k] = figs(v[k]); }); return o; }
    return v;
  }
  // Long runs of numbers anywhere in a value go to the pool.
  function pooled(v){
    if(Array.isArray(v)){
      if(v.length > 8 && POOL && v.every(function(x){ return typeof x === 'number' || x === null; })) return POOL.ref(v.map(fig));
      return v.map(pooled);
    }
    if(v && typeof v === 'object' && !v.$p && !v.$k){
      var o = {};
      Object.keys(v).forEach(function(k){ o[k] = pooled(v[k]); });
      return o;
    }
    return v;
  }

  /* ── Undo what the page does while it is read ──
     A tooltip callback may write a read-out into the page (the line under a
     chart), and pressing a legend entry rebuilds the key. Every change to
     the document while `fn` runs is recorded and taken back after, in
     reverse, so the reader's page is left exactly as it was. */
  function untouched(fn){
    var log = [], mo = new MutationObserver(function(r){ log.push.apply(log, r); });
    mo.observe(document.body, { subtree: true, childList: true, characterData: true, characterDataOldValue: true,
                                attributes: true, attributeOldValue: true });
    var out;
    try { out = fn(); }
    finally {
      log.push.apply(log, mo.takeRecords());
      mo.disconnect();
      for(var i = log.length - 1; i >= 0; i--){
        var r = log[i];
        try {
          if(r.type === 'characterData') r.target.data = r.oldValue;
          else if(r.type === 'attributes'){
            if(r.oldValue === null) r.target.removeAttribute(r.attributeName);
            else r.target.setAttribute(r.attributeName, r.oldValue);
          } else {
            each(r.addedNodes, function(n){ if(n.parentNode === r.target) r.target.removeChild(n); });
            for(var j = r.removedNodes.length - 1; j >= 0; j--){
              var before = r.nextSibling && r.nextSibling.parentNode === r.target ? r.nextSibling : null;
              r.target.insertBefore(r.removedNodes[j], before);
            }
          }
        } catch(e){}
      }
    }
    return out;
  }

  /* ══ Chart.js ═══════════════════════════════════════════════════════════ */

  // A scale's own default label, which needs nothing written down.
  function defaultTick(chart, scale, cb){
    var C = global.Chart, def = null;
    try { def = C.registry.getScale(scale.type).defaults.ticks.callback; } catch(e){}
    var F = C.Ticks && C.Ticks.formatters;
    return cb === def || (F && (cb === F.values || cb === F.numeric || cb === F.logarithmic)) ||
      (C.defaults.scale && C.defaults.scale.ticks && cb === C.defaults.scale.ticks.callback);
  }
  function tickOut(v){
    if(v == null) return null;
    if(Array.isArray(v)) return v.map(function(x){ return x == null ? '' : String(x); });
    return String(v);
  }
  function callTick(cb, scale, v, i, all){
    try { return tickOut(cb.call(scale, v, i, all)); } catch(e){ return null; }
  }
  function ticksOf(n){ var t = []; for(var i = 0; i < n; i++) t.push({ value: i }); return t; }

  /* A numeric axis's labels, learned from its callback. Labels on this site
     are a number with words around it ("$1.2M", "Rp 2,5 jt", "950 MW"), and
     the words, the unit and the decimals change with the size of the number.
     So the callback is asked for numbers of every size, each answer is read
     as prefix, figure and suffix, and every decade of each sign keeps its
     own: the prefix and suffix, the power of ten the figure is in, its
     decimals and its separators. The viewer formats any value the same way.
     Answers the format gets wrong are kept as they are. */
  function learnFormat(cb, scale, lo, hi){
    var probes = [], seen = {};
    function add(v){ v = +(+v).toPrecision(12); if(isFinite(v) && !seen[v]){ seen[v] = 1; probes.push(v); } }
    add(0);
    var M = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 9.5];
    for(var e = -3; e <= 13; e++) M.forEach(function(m){ add(m * Math.pow(10, e)); add(-m * Math.pow(10, e)); });
    var span = hi - lo;
    if(isFinite(span) && span > 0){
      for(var s = 0; s < 8; s++){
        var step = niceStep(span / (6 * Math.pow(2.2, s)));
        for(var v = Math.ceil(lo / step) * step, n = 0; v <= hi && n < 60; v += step, n++) add(v);
      }
    }
    /* The axis's own ticks go with every value asked, as Chart.js passes
       them: a callback that picks its decimals from the spacing of the ticks
       answers as it does on the view the chart opens on. */
    var real = scale.ticks && scale.ticks.length > 2 ? scale.ticks.map(function(t){ return { value: t.value }; }) : null;
    var three = real || [{ value: 0 }, { value: 1 }, { value: 2 }], last = three.length - 1;
    var outs = probes.map(function(v){ return callTick(cb, scale, v, 0, three); });
    // A callback that blanks the last label of the axis (so it never runs
    // into the axis title) does it for every value.
    var hideLast = probes.slice(0, 12).every(function(v, i){ return outs[i] === null || callTick(cb, scale, v, last, three) === ''; }) &&
                   outs.some(function(o){ return o; });
    var parsed = probes.map(function(v, i){ return readLabel(v, outs[i]); });
    var buckets = {}, zero = null;
    probes.forEach(function(v, i){
      var p = parsed[i];
      if(v === 0){ zero = outs[i]; return; }
      var key = bucketOf(v);
      if(!p){ buckets[key] = buckets[key] || { bad: true }; buckets[key].bad = true; return; }
      var b = buckets[key];
      if(!b){ buckets[key] = { pre: p.pre, suf: p.suf, j: p.j, d: p.d, dmin: p.d, g: p.g, ds: p.ds }; return; }
      if(b.bad) return;
      if(b.pre !== p.pre || b.suf !== p.suf || b.j !== p.j){ b.bad = true; return; }
      b.d = Math.max(b.d, p.d); b.dmin = Math.min(b.dmin, p.d);
      if(p.g) b.g = p.g;
      if(p.ds) b.ds = p.ds;
    });
    var fmt = { b: {}, z: zero };
    Object.keys(buckets).forEach(function(k){
      var b = buckets[k];
      if(b.bad) return;
      fmt.b[k] = [b.pre, b.suf, b.j, b.d, b.dmin < b.d ? 1 : 0, b.g || '', b.ds || '.'];
    });
    if(hideLast) fmt.hl = 1;
    var miss = {}, nmiss = 0, keys = Object.keys(fmt.b).length;
    probes.forEach(function(v, i){
      var mine = K.formatTick ? K.formatTick(fmt, v) : null;
      if(mine !== outs[i]){ miss[v] = outs[i]; nmiss++; }
    });
    if(!keys) return null;
    if(nmiss) fmt.x = miss;
    return fmt;
  }
  function bucketOf(v){ return (v < 0 ? '-' : '+') + Math.floor(Math.log10(Math.abs(v)) + 1e-9); }
  function niceStep(x){
    if(!(x > 0)) return 1;
    var e = Math.pow(10, Math.floor(Math.log10(x))), f = x / e;
    return (f < 1.5 ? 1 : f < 2.25 ? 2 : f < 3.5 ? 2.5 : f < 7.5 ? 5 : 10) * e;
  }
  /* "−$1,234.5k" for 1,234,500 → prefix "−$", figure 1234.5 in thousands,
     one decimal, "," between thousands, suffix "k". null if the figure is
     not the value in some power of ten. */
  function readLabel(v, s){
    if(typeof s !== 'string') return null;
    var m = /\d(?:[\d.,  ' ]*\d)?/.exec(s);
    if(!m) return null;
    var tok = m[0], pre = s.slice(0, m.index), suf = s.slice(m.index + tok.length);
    var av = Math.abs(v), best = null;
    ['.', ','].forEach(function(ds){
      if(best) return;
      var gs = ds === '.' ? /[,  ' ]/g : /[.  ' ]/g;
      var parts = tok.split(ds);
      if(parts.length > 2) return;
      var whole = parts[0], frac = parts[1] || '';
      if(/[^\d]/.test(frac)) return;
      var g = (whole.match(gs) || [])[0] || '';
      var digits = whole.replace(gs, '');
      if(/[^\d]/.test(digits)) return;
      if(g && !/^\d{1,3}(?:[,.  ' ]\d{3})*$/.test(whole)) return;
      var num = parseFloat(digits + (frac ? '.' + frac : ''));
      if(!(num > 0)) return;
      var d = frac.length, half = 0.5 * Math.pow(10, -d) + 1e-9;
      for(var j = -6; j <= 15; j++){
        var x = av / Math.pow(10, j);
        if(Math.abs(x - num) <= half * 1.0001 || Math.abs(x - num) / num < 1e-9){
          best = { pre: pre, suf: suf, j: j, d: d, g: g, ds: frac ? ds : '' };
          return;
        }
      }
    });
    return best;
  }

  /* An axis's labels: null when the chart's own default draws them, a
     ChartKit name when the callback has one, else a table and a format. */
  function bakeTicks(chart, scale, pool){
    var cb = scale.options && scale.options.ticks && scale.options.ticks.callback;
    if(typeof cb !== 'function' || defaultTick(chart, scale, cb) || K.refOf(cb)) return null;
    if(scale.type === 'category'){
      var labels = scale.getLabels ? scale.getLabels() : (chart.data.labels || []);
      var all = ticksOf(labels.length);
      return { cat: pool.ref(labels.map(function(l, i){ return callTick(cb, scale, i, i, all); })) };
    }
    var lim = baseRange(chart, scale), out = {};
    // A short run of whole numbers (years, hours, an index into dates) is
    // written out label by label: those are the labels such an axis shows.
    if(isFinite(lim.lo) && isFinite(lim.hi) && lim.hi - lim.lo <= 6000){
      var lo = Math.floor(lim.lo), tab = [], three = [{ value: 0 }, { value: 1 }, { value: 2 }];
      for(var v = lo; v <= Math.ceil(lim.hi); v++) tab.push(callTick(cb, scale, v, 0, three));
      out.int = [lo, pool.ref(tab)];
      // Between them: what the callback says for a half (often nothing).
      var halves = [lo + 0.5, lo + 1.25, Math.floor((lim.lo + lim.hi) / 2) + 0.5].map(function(h){ return callTick(cb, scale, h, 0, three); });
      if(halves.every(function(h){ return h === '' || h === null; })) out.frac = '';
    }
    var fmt = learnFormat(cb, scale, lim.lo, lim.hi);
    if(fmt) out.fmt = fmt;
    return out;
  }
  // The widest the axis goes: the zoom limits, or what it shows unzoomed.
  function baseRange(chart, scale){
    var lim = chart.options.plugins && chart.options.plugins.zoom && chart.options.plugins.zoom.limits;
    var l = lim && lim[scale.id];
    var lo = l && isFinite(l.min) ? l.min : scale.min, hi = l && isFinite(l.max) ? l.max : scale.max;
    return { lo: lo, hi: hi };
  }

  /* A tick's look as a callback (a decision year bold, the zero line
     stronger): its answer for every tick the axis can show, as a table by
     tick value. */
  function bakeTickStyles(chart, scale, opts, pool, warn){
    var raw = chart.config._config.options && chart.config._config.options.scales && chart.config._config.options.scales[scale.id];
    if(!raw) return;
    var lim = scale.type === 'category' ? { lo: 0, hi: (scale.getLabels ? scale.getLabels().length : 0) - 1 } : baseRange(chart, scale);
    ['ticks', 'grid'].forEach(function(part){
      var o = raw[part];
      if(!o) return;
      Object.keys(o).forEach(function(k){
        var f = o[k];
        if(typeof f !== 'function' || K.refOf(f) || (part === 'ticks' && k === 'callback') || (part === 'grid' && /^tick(Width|Color)$/.test(k))) return;
        var target0 = opts.scales && opts.scales[scale.id];
        if(!(isFinite(lim.lo) && isFinite(lim.hi) && lim.hi - lim.lo <= 6000)){
          // A wide numeric axis: a look that only changes at zero (the zero
          // line drawn stronger) is kept as that; anything else is reported.
          var z = zeroOnly(f, chart, scale, lim);
          if(z && target0){ target0[part] = target0[part] || {}; target0[part][k] = { $z: z }; }
          else warn.push('options.scales.' + scale.id + '.' + part + '.' + k);
          return;
        }
        var lo = Math.floor(lim.lo), tab = [];
        for(var v = lo, i = 0; v <= Math.ceil(lim.hi); v++, i++){
          var r;
          try { r = f({ chart: chart, scale: scale, tick: { value: v }, index: i, type: 'tick' }, scale.options); } catch(e){ r = undefined; }
          r = freeze(r, '', null);
          tab.push(r === undefined ? null : r);
        }
        var target = opts.scales && opts.scales[scale.id];
        if(!target) return;
        target[part] = target[part] || {};
        target[part][k] = { $tab: [lo, pool.ref(tab)] };
      });
    });
  }

  function zeroOnly(f, chart, scale, lim){
    var call = function(v){
      try { return JSON.stringify(freeze(f({ chart: chart, scale: scale, tick: { value: v }, index: 0, type: 'tick' }, scale.options), '', null)); }
      catch(e){ return 'x'; }
    };
    var at0 = call(0), rest = null, ok = true, span = lim.hi - lim.lo;
    for(var i = 0; i <= 40 && ok; i++){
      [lim.lo + span * i / 40, -(i + 1) * Math.pow(10, i % 9), (i + 1) * Math.pow(10, i % 9)].forEach(function(v){
        if(!ok || Math.abs(v) < 1e-12) return;
        var r = call(v);
        if(rest === null) rest = r; else if(r !== rest) ok = false;
      });
    }
    if(!ok || rest === null || at0 === 'x' || rest === 'x' || at0 === undefined) return null;
    return [JSON.parse(at0), JSON.parse(rest)];
  }

  // Which data-element options a scriptable dataset property stands for.
  var PER_POINT = /^(point|hover)|Radius$|^radius$|^rotation$/;
  function perElement(chart, ds){
    var t = ds.type || chart.config.type;
    return /^(bar|pie|doughnut|polarArea|bubble|scatter)$/.test(t);
  }
  function resolveScriptable(chart, d, ds, key, f){
    var meta = chart.getDatasetMeta(d), ctl = meta && meta.controller;
    if(!ctl || !ctl.getContext) return undefined;
    try {
      if(PER_POINT.test(key) || perElement(chart, ds)){
        var n = (ds.data || []).length, arr = [], same = true;
        for(var i = 0; i < n; i++){
          var v = freeze(f(ctl.getContext(i, false, 'default'), ctl.chart && ctl.chart.options), '', null);
          arr.push(v === undefined ? null : v);
          if(i && JSON.stringify(v) !== JSON.stringify(arr[0])) same = false;
        }
        return same ? arr[0] : arr;
      }
      return freeze(f(ctl.getContext(), ctl.chart && ctl.chart.options), '', null);
    } catch(e){ return undefined; }
  }
  /* A line's look segment by segment (a colour that changes at the year a
     house is bought): each segment's answer, by the index it starts at. */
  function bakeSegment(chart, d, ds, seg){
    var out = {}, n = (ds.data || []).length;
    Object.keys(seg).forEach(function(k){
      var f = seg[k];
      if(typeof f !== 'function'){ var v = freeze(f, '', null); if(v !== undefined) out[k] = v; return; }
      var arr = [];
      for(var i = 0; i < n - 1; i++){
        var r;
        try { r = f({ type: 'segment', chart: chart, datasetIndex: d, p0DataIndex: i, p1DataIndex: i + 1,
                      p0: { parsed: chart.getDatasetMeta(d)._parsed ? chart.getDatasetMeta(d)._parsed[i] : null },
                      p1: { parsed: chart.getDatasetMeta(d)._parsed ? chart.getDatasetMeta(d)._parsed[i + 1] : null } }); }
        catch(e){ r = undefined; }
        r = freeze(r, '', null);
        arr.push(r === undefined ? null : r);
      }
      out[k] = { $seg: arr };
    });
    return out;
  }

  function freezeDatasets(chart, vis, pool, warn){
    return chart.data.datasets.map(function(ds, d){
      var o = {};
      Object.keys(ds).forEach(function(k){
        // A tool may keep its own data on a dataset (_ohlc for the candles);
        // only Chart.js's own bookkeeping stays behind.
        if(k === 'data' || k === '_chartjs' || k === '_meta' || k.charAt(0) === '$') return;
        var v = ds[k];
        if(k === 'segment' && v && typeof v === 'object'){ o.segment = bakeSegment(chart, d, ds, v); return; }
        if(typeof v === 'function' && !K.refOf(v)){
          var r = resolveScriptable(chart, d, ds, k, v);
          if(r !== undefined) o[k] = r; else warn.push('datasets.' + d + '.' + k);
          return;
        }
        var f = pooled(freeze(v, 'datasets.' + d + '.' + k, function(fn, path){ warn.push(path); }));
        if(f === undefined) return;
        /* A tool's own record hung on a dataset (the scenario a line was
           drawn from) is not drawn: past a few KB, once its runs of numbers
           are pooled, it stays behind. */
        if(f && typeof f === 'object' && JSON.stringify(f).length > 4096){ warn.push('datasets.' + d + '.' + k + ' (too big)'); return; }
        o[k] = f;
      });
      o.data = pool.ref(figs(freeze(ds.data || [], '', null) || []));
      if(vis[d]) delete o.hidden; else o.hidden = true;
      return o;
    });
  }

  // Functions in the options whose output the snapshot carries instead.
  var BAKED = /\.sharedYFit\.fit\.[^.]+$|^options\.scales\.[^.]+\.(ticks|grid)\.[^.]+$|\.plugins\.tooltip\..*$|^options\.on(Click|Hover|Resize)$|\.grid\.(tickWidth|tickColor)$/;
  function freezeOptions(chart, warn){
    var o = freeze(chart.config._config.options || {}, 'options', function(fn, path){
      if(!BAKED.test(path)) warn.push(path);
    });
    o.animation = false;
    // The view the chart opens on: the zoom it was built with, not the
    // reader's pan or pinch.
    var base = chart.$zoomBase || {};
    Object.keys(o.scales || {}).forEach(function(id){
      var sc = o.scales[id], b = base[id];
      if(!b) return;
      if(b.hasMin && isFinite(b.min)) sc.min = b.min; else delete sc.min;
      if(b.hasMax && isFinite(b.max)) sc.max = b.max; else delete sc.max;
    });
    // A title SharedPane shortened to fit its pane goes whole: the viewer's
    // pane is its own height.
    var raw = chart.config._config.options && chart.config._config.options.scales;
    Object.keys(raw || {}).forEach(function(id){
      var t = raw[id] && raw[id].title;
      if(t && t.$full != null && o.scales && o.scales[id] && o.scales[id].title) o.scales[id].title.text = t.$full;
    });
    /* Fitters hung on the instance win, as they do in SharedZoom. A bespoke
       fitter travels by its ChartKit name (a tool kit's factory and the
       series it fits); one with no name is fitted generically over the same
       axes, which is near but not exact, and reported. */
    var y = o.plugins && o.plugins.sharedYFit || {};
    var rawFit = chart.$fitY || (chart.config._config.options.plugins && chart.config._config.options.plugins.sharedYFit &&
                 chart.config._config.options.plugins.sharedYFit.fit);
    var auto = chart.$autoFitY ? freeze(chart.$autoFitY, 'fit', function(fn, path){ warn.push(path); }) : y.auto;
    var fit = null, loose = [];
    Object.keys(rawFit || {}).forEach(function(id){
      var r = K.refOf(rawFit[id]);
      if(r){ fit = fit || {}; fit[id] = { $k: kitRef(r) }; }
      else loose.push(id);
    });
    if(loose.length){
      warn.push('fitted generically: ' + loose.join(', '));
      auto = Object.assign({}, auto || {}, { axes: ((auto && auto.axes) || []).concat(loose) });
    }
    if(fit || auto){
      o.plugins = o.plugins || {};
      o.plugins.sharedYFit = {};
      if(fit) o.plugins.sharedYFit.fit = fit;
      if(auto) o.plugins.sharedYFit.auto = auto;
    }
    return o;
  }

  /* ── The hover card, baked ──
     Chart.js builds the card from the tool's callbacks for the points under
     the pointer. Here every point is put under it in turn, with the card's
     drawing switched off, and the lines it would show are kept: the title
     and the notes by the point the card is anchored on, each series' row by
     its point. The viewer's callbacks hand them back. */
  function bakeTips(chart, pool){
    var tip = chart.tooltip, topt = chart.options.plugins && chart.options.plugins.tooltip;
    if(!tip || !topt || topt.enabled === false && !topt.external) return null;
    var mode = (topt.mode || (chart.options.interaction && chart.options.interaction.mode) || 'nearest');
    var byIndex = mode === 'index' || mode === 'x';
    var sets = chart.data.datasets, n = 0;
    sets.forEach(function(ds){ n = Math.max(n, (ds.data || []).length); });
    var out = { by: byIndex ? 'i' : 'el', t: {}, bb: {}, ab: {}, f: {}, r: {} };
    function lines(v){ return (v || []).filter(function(x){ return x != null && String(x) !== ''; }).map(String); }
    function keep(key, model){
      var t = lines(model.title), bb = lines(model.beforeBody), ab = lines(model.afterBody), f = lines(model.footer);
      if(t.length) out.t[key] = t;
      if(bb.length) out.bb[key] = bb;
      if(ab.length) out.ab[key] = ab;
      if(f.length) out.f[key] = f;
      (model.dataPoints || []).forEach(function(p, k){
        var body = (model.body || [])[k] || {}, row = lines(body.lines);
        var b = lines(body.before), a = lines(body.after);
        var rows = out.r[p.datasetIndex] || (out.r[p.datasetIndex] = []);
        rows[p.dataIndex] = b.length || a.length ? { b: b, l: row, a: a } : row;
      });
    }
    function show(active){
      try { tip.setActiveElements(active, { x: active[0].element.x, y: active[0].element.y }); }
      catch(e){ return null; }
      return tip;
    }
    var metas = sets.map(function(ds, d){ return chart.getDatasetMeta(d); });
    if(byIndex){
      for(var i = 0; i < n; i++){
        var act = [];
        metas.forEach(function(meta, d){ if(meta.data && meta.data[i]) act.push({ datasetIndex: d, index: i, element: meta.data[i] }); });
        if(act.length && show(act)) keep(i, tip);
      }
    } else {
      metas.forEach(function(meta, d){
        (meta.data || []).forEach(function(el, i){
          if(el && show([{ datasetIndex: d, index: i, element: el }])) keep(d + ',' + i, tip);
        });
      });
    }
    try { tip.setActiveElements([], { x: 0, y: 0 }); } catch(e){}
    Object.keys(out.r).forEach(function(d){
      var rows = out.r[d];
      for(var i = 0; i < rows.length; i++) if(rows[i] === undefined) rows[i] = null;
      // Learned from the values the viewer will have, to the same figures.
      out.r[d] = compactRows(rows, sets[d] && figs(freeze(sets[d].data || [], '', null)), pool);
    });
    if(byIndex){
      var labels = (chart.data.labels || []).map(function(l){ return l == null ? '' : String(l); });
      ['t', 'bb', 'ab', 'f'].forEach(function(k){
        var arr = [], any = false, asLabels = true;
        for(var i = 0; i < n; i++){
          var v = out[k][i] || null;
          arr.push(v);
          if(v) any = true;
          if(!(v ? v.length === 1 && v[0] === labels[i] : !labels[i])) asLabels = false;
        }
        // A title that is the point's own label is written as that.
        out[k] = !any ? null : k === 't' && asLabels && labels.length >= n ? 'L' : pool.ref(arr);
      });
    }
    return out;
  }

  /* A series' rows on the hover card, written short. A row is nearly
     always the same words around the point's value ("  SPY - ETF: $271"),
     so where it is, the rows are kept as those words and the format the
     value is written in (learned as an axis's labels are), and only the
     rows that format gets wrong are written out. Exactly the same rows,
     for a fraction of the length on a long daily series. */
  function compactRows(rows, data, pool){
    var idx = [], vals = [], text = [], raw = function(){ return pool.ref(rows); };
    if(!data) return raw();
    for(var i = 0; i < rows.length; i++){
      var r = rows[i];
      if(r === null) continue;
      if(!Array.isArray(r) || r.length !== 1) return raw();
      var p = data[i], v = p && typeof p === 'object' ? p.y : p;
      if(typeof v !== 'number' || !isFinite(v)) return raw();
      idx.push(i); vals.push(v); text.push(r[0]);
    }
    if(idx.length < 24) return raw();
    // The words around the value: the longest run every row starts and ends
    // with, cut back to a space so a figure is never split.
    var pre = text[0], suf = text[0];
    text.forEach(function(t){
      while(pre && t.indexOf(pre) !== 0) pre = pre.slice(0, -1);
      while(suf && t.slice(-suf.length) !== suf) suf = suf.slice(1);
    });
    pre = pre.slice(0, pre.lastIndexOf(' ') + 1);
    var sp = suf.indexOf(' ');
    suf = sp < 0 ? '' : suf.slice(sp);
    var mids = text.map(function(t){ return t.slice(pre.length, t.length - suf.length); });
    var fmt = learnRows(vals, mids);
    if(!fmt) return raw();
    var miss = {}, n = 0;
    idx.forEach(function(at, k){
      if(K.formatTick(fmt, vals[k]) !== mids[k]){ miss[at] = mids[k]; n++; }
    });
    if(n > idx.length * 0.2) return raw();
    // Where the rows are: every point with a value, but these.
    var gaps = [];
    for(var j = 0, k = 0; j < data.length; j++){
      if(idx[k] === j){ k++; continue; }
      var q = data[j], w = q && typeof q === 'object' ? q.y : q;
      if(typeof w === 'number' && isFinite(w)) gaps.push(j);
    }
    return { $rows: { p: pre, s: suf, f: fmt, x: n ? miss : undefined, z: gaps.length ? gaps : undefined, n: rows.length } };
  }
  function learnRows(vals, mids){
    var buckets = {}, zero = null;
    vals.forEach(function(v, i){
      if(v === 0){ if(zero === null) zero = mids[i]; return; }
      var p = readLabel(v, mids[i]), key = bucketOf(v), b = buckets[key];
      if(!p) return;
      if(!b){ buckets[key] = { pre: p.pre, suf: p.suf, j: p.j, d: p.d, dmin: p.d, g: p.g, ds: p.ds, n: 1 }; return; }
      if(b.bad) return;
      if(b.pre !== p.pre || b.suf !== p.suf || b.j !== p.j){ b.bad = true; return; }
      b.d = Math.max(b.d, p.d); b.dmin = Math.min(b.dmin, p.d);
      if(p.g) b.g = p.g;
      if(p.ds) b.ds = p.ds;
    });
    var fmt = { b: {}, z: zero }, any = false;
    Object.keys(buckets).forEach(function(k){
      var b = buckets[k];
      if(b.bad) return;
      fmt.b[k] = [b.pre, b.suf, b.j, b.d, b.dmin < b.d ? 1 : 0, b.g || '', b.ds || '.'];
      any = true;
    });
    return any ? fmt : null;
  }

  /* The chart at the view it opens on, with every dataset shown, while `fn`
     reads it; then the reader's own view and choices put back. */
  function opened(chart, fn){
    var vis = chart.data.datasets.map(function(ds, d){ return chart.isDatasetVisible(d); });
    var scales = chart.options.scales || {}, zoom = {}, base = chart.$zoomBase || {};
    Object.keys(scales).forEach(function(id){
      zoom[id] = { min: scales[id].min, max: scales[id].max };
      var b = base[id];
      if(b){ if(b.hasMin) scales[id].min = b.min; else delete scales[id].min;
             if(b.hasMax) scales[id].max = b.max; else delete scales[id].max; }
    });
    var topt = chart.options.plugins && chart.options.plugins.tooltip, ext = topt && topt.external;
    if(topt) topt.external = function(){};
    vis.forEach(function(v, d){ if(!v) chart.setDatasetVisibility(d, true); });
    chart.update('none');
    try { return fn(vis, ext); }
    finally {
      if(topt) topt.external = ext;
      vis.forEach(function(v, d){ if(!v) chart.setDatasetVisibility(d, false); });
      Object.keys(zoom).forEach(function(id){
        if(zoom[id].min === undefined) delete scales[id].min; else scales[id].min = zoom[id].min;
        if(zoom[id].max === undefined) delete scales[id].max; else scales[id].max = zoom[id].max;
      });
      chart.update('none');
    }
  }

  function chartjsFrame(el, pool, warn){
    var chart = global.Chart.getChart(el);
    if(!chart) throw new Error('the chart is not drawn yet');
    return untouched(function(){
      return opened(chart, function(vis, ext){
        var f = {
          type: chart.config.type,
          labels: pool.ref(freeze(chart.data.labels || [], '', null) || []),
          datasets: freezeDatasets(chart, vis, pool, warn),
          options: freezeOptions(chart, warn),
          plugins: (chart.config.plugins || []).map(function(p){ return p && p.id; }).filter(function(id){
            if(K.pluginOf(id)) return true;
            warn.push('plugin ' + id);
            return false;
          }),
          ticks: {},
          tip: null
        };
        Object.keys(chart.scales).forEach(function(id){
          var t = bakeTicks(chart, chart.scales[id], pool);
          if(t) f.ticks[id] = t;
          bakeTickStyles(chart, chart.scales[id], f.options, pool, warn);
        });
        f.tip = bakeTips(chart, pool);
        // The card's own drawing was switched off while the tips were read.
        var tipOpts = f.options.plugins && f.options.plugins.tooltip;
        if(tipOpts && K.refOf(ext)) tipOpts.external = { $k: K.refOf(ext) };
        return f;
      });
    });
  }

  /* ══ The key ═══════════════════════════════════════════════════════════
     Each entry is pressed and pressed again: the datasets it hides are the
     ones it shows and hides. An entry that hides nothing is a plain key. */
  function legendOf(roots, el, legendKey){
    var items = [];
    roots.forEach(function(r){ each(r.querySelectorAll('.legend-item'), function(it){ items.push(it); }); });
    if(!items.length) return null;
    var chart = function(){ return global.Chart && global.Chart.getChart ? global.Chart.getChart(el) : null; };
    var visible = function(){ var c = chart(); return c ? c.data.datasets.map(function(ds, d){ return c.isDatasetVisible(d); }) : []; };
    var find = function(key){
      var hit = null;
      roots.forEach(function(r){ each(r.querySelectorAll('.legend-item'), function(it){ if(!hit && legendKey(it) === key) hit = it; }); });
      return hit;
    };
    return untouched(function(){
      return items.map(function(it){
        var key = legendKey(it), labelEl = it.querySelector('.legend-label');
        var entry = { l: norm(labelEl ? labelEl.textContent : it.textContent), off: it.classList.contains('hidden') ? 1 : 0, ds: [] };
        // Words the entry carries beside its swatch and label (a bracket).
        var sw0 = it.querySelector('.legend-swatch'), pre = '', post = '', sr = '';
        each(it.childNodes, function(n){
          if(n === sw0 || n === labelEl || (n.contains && (n.contains(sw0) || n.contains(labelEl)))) return;
          var t = n.textContent || '';
          // Words for a screen reader only ("(existing)") stay for one.
          if(n.nodeType === 1 && n.getBoundingClientRect().width <= 1){ sr += t; return; }
          if(labelEl && (labelEl.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING)) post += t; else pre += t;
        });
        if(norm(pre)) entry.pre = norm(pre);
        if(norm(post)) entry.post = norm(post);
        if(norm(sr)) entry.sr = norm(sr);
        // A key in groups (flows, balances) keeps its group's name.
        var grp = it.closest('.legend-group'), gl = grp && grp.querySelector('.legend-group-label');
        if(gl) entry.g = norm(gl.textContent);
        try { entry.sw = JSON.parse(it.getAttribute('data-swatch') || 'null'); } catch(e){ entry.sw = null; }
        if(!entry.sw){
          var dot = it.querySelector('.dot, .legend-swatch');
          var col = dot ? global.getComputedStyle(dot).backgroundColor : '';
          entry.sw = { type: 'point', color: col || '#888888', point: { shape: 'circle', radius: 5 } };
        }
        var before = visible();
        it.click();
        var after = visible();
        before.forEach(function(v, d){ if(v !== after[d]) entry.ds.push(d); });
        var again = find(key);
        if(again) again.click();
        if(!entry.ds.length){
          // Nothing moved: the entry names its series by label, or none.
          var c = chart();
          if(c) c.data.datasets.forEach(function(ds, d){ if(norm(ds.label) === entry.l) entry.ds.push(d); });
        }
        return entry;
      });
    });
  }

  /* The key's layout: the box that holds every entry, written as a tree of
     its divs and spans (their classes and words), each entry by its place
     in the list. Groups, pairs and brackets come through as the tool laid
     them out; the viewer styles them by class. */
  function legendTree(roots){
    var items = [];
    roots.forEach(function(r){ each(r.querySelectorAll('.legend-item'), function(it){ items.push(it); }); });
    if(!items.length) return null;
    var box = items[0].parentElement;
    while(box && !items.every(function(it){ return box.contains(it); })) box = box.parentElement;
    if(!box) return null;
    var up = box.closest('.legend');
    if(up) box = up;
    function walk(n){
      if(n.nodeType === 3) return /\S/.test(n.data) ? norm(n.data) : null;
      if(n.nodeType !== 1 || !/^(DIV|SPAN|P)$/.test(n.tagName) || n.hidden) return null;
      var at = items.indexOf(n);
      if(at >= 0) return { i: at };
      var c = Array.prototype.filter.call(n.classList, function(k){ return /^[a-z][\w-]{0,40}$/.test(k); }).join(' ');
      var kids = [];
      each(n.childNodes, function(k){ var t = walk(k); if(t != null) kids.push(t); });
      return kids.length ? { c: c, k: kids } : null;
    }
    return walk(box);
  }

  /* ══ Views the card offers ══════════════════════════════════════════════
     A control the tool marks data-embed-mode="<label>" (a select, a
     checkbox, or a group of buttons) is offered in the viewer as the same
     choice; every other control in the card stays as the reader left it and
     is not shown. */
  function textOf(b){
    var long = b.querySelector('.lbl-long');
    var c = b.cloneNode(true);
    each(c.querySelectorAll('.lbl-short, .tip-icon, [aria-hidden="true"]'), function(x){ x.remove(); });
    return norm(long ? long.textContent : c.textContent);
  }
  function shortOf(b){ var s = b.querySelector('.lbl-short'); return s ? norm(s.textContent) : ''; }
  function shown(el){
    if(!el) return false;
    if(el.tagName === 'SELECT' && el.classList.contains('seg-source')){
      var seg = el.parentElement && el.parentElement.querySelector('.seg-group');
      return !!(seg && seg.offsetParent);
    }
    return el.offsetParent !== null || (el.getClientRects && el.getClientRects().length > 0);
  }
  // A label's words without the field inside it or its tip.
  function words(l){
    var c = l.cloneNode(true);
    each(c.querySelectorAll('select, option, input, textarea, .tip-icon, .vh'), function(x){ x.remove(); });
    return norm(c.textContent);
  }
  function labelFor(el){
    var v = el.getAttribute('data-embed-mode');
    if(v) return v;
    if(el.id){ var l = document.querySelector('label[for="' + el.id + '"]'); if(l) return words(l); }
    var wrap = el.closest('label');
    return wrap ? words(wrap) : (el.getAttribute('aria-label') || el.getAttribute('title') || '');
  }
  function fire(el){
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function isOn(b){ return b.classList.contains('active') || b.getAttribute('aria-pressed') === 'true' || b.getAttribute('aria-checked') === 'true'; }
  /* The mark can sit on a select, a checkbox, a range, a box of buttons
     (one of them pressed), or on buttons themselves: buttons that carry the
     same label are one choice between them, and a button alone is a switch
     (the Rent and Own lines beside a metric choice in one row). */
  function modesOf(roots){
    var out = [], seen = [], groups = {};
    roots.forEach(function(r){
      var list = r.matches('[data-embed-mode]') ? [r] : [];
      each(r.querySelectorAll('[data-embed-mode]'), function(x){ list.push(x); });
      list.forEach(function(el){
        if(seen.indexOf(el) >= 0 || !shown(el)) return;
        seen.push(el);
        if(el.tagName === 'BUTTON'){
          var name = el.getAttribute('data-embed-mode') || '';
          var key = name ? 'n:' + name : 'b:' + seen.length;
          if(!groups[key]){ groups[key] = { label: name, btns: [] }; out.push(groups[key]); }
          groups[key].btns.push(el);
          return;
        }
        out.push(el);
      });
    });
    return out.map(function(x){ return x.btns ? buttonsMode(x.label, x.btns) : modeOf(x); })
              .filter(function(m){ return m && m.opts.length > 1; });
  }
  function modeOf(el){
    var label = labelFor(el);
    if(el.tagName === 'SELECT'){
      var opts = Array.prototype.filter.call(el.options, function(o){ return !o.disabled && !o.hidden; });
      return { label: label, kind: 'select', opts: opts.map(function(o){ return { l: norm(o.textContent) }; }),
        get: function(){ return Math.max(0, opts.map(function(o){ return o.value; }).indexOf(el.value)); },
        set: function(i){ if(el.value !== opts[i].value){ el.value = opts[i].value; fire(el); } } };
    }
    if(el.tagName === 'INPUT' && el.type === 'checkbox'){
      return { label: label, kind: 'check', opts: [{ l: 'off' }, { l: 'on' }],
        get: function(){ return el.checked ? 1 : 0; },
        set: function(i){ if(el.checked !== !!i){ el.checked = !!i; fire(el); } } };
    }
    // A slider: every step a view, named by what its read-out says there.
    if(el.tagName === 'INPUT' && el.type === 'range'){
      var lo = +el.min || 0, hi = +el.max, step = +el.step || 1, vals = [];
      for(var v = lo; v <= hi + 1e-9 && vals.length < 400; v += step) vals.push(String(+v.toFixed(6)));
      var out = el.getAttribute('aria-describedby') && document.getElementById(el.getAttribute('aria-describedby'));
      return { label: label, kind: 'range', opts: vals.map(function(){ return { l: '' }; }),
        get: function(){ return Math.max(0, vals.indexOf(String(+(+el.value).toFixed(6)))); },
        set: function(i){ if(el.value !== vals[i]){ el.value = vals[i]; fire(el); } },
        read: function(){ return out ? norm(out.textContent) : el.value; } };
    }
    // A box of buttons, one pressed.
    var btns = Array.prototype.filter.call(el.querySelectorAll('button'), shown);
    return buttonsMode(label, btns);
  }
  function buttonsMode(label, btns){
    if(!btns.length) return null;
    if(btns.length === 1){
      var b = btns[0];
      return { label: label || textOf(b), kind: 'check', opts: [{ l: 'off' }, { l: 'on' }],
        get: function(){ return isOn(b) ? 1 : 0; },
        set: function(i){ if(isOn(b) !== !!i) b.click(); } };
    }
    return { label: label, kind: 'seg', opts: btns.map(function(b){ var o = { l: textOf(b) }, s = shortOf(b); if(s) o.s = s; return o; }),
      get: function(){ for(var i = 0; i < btns.length; i++) if(isOn(btns[i])) return i; return 0; },
      set: function(i){ if(!isOn(btns[i])) btns[i].click(); } };
  }
  /* Every combination, the reader's own first: up to MAX_FRAMES, or every
     step of a slider (a day of hours) with the other views as they are. */
  function combos(modes){
    var slide = modes.filter(function(m){ return m.kind === 'range'; });
    if(slide.length){
      var own0 = modes.map(function(m){ return m.get(); }), out0 = [];
      modes.forEach(function(m, i){
        if(m.kind !== 'range') return;
        m.opts.forEach(function(o, k){ var c = own0.slice(); c[i] = k; out0.push(c); });
      });
      modes.forEach(function(m){ if(m.kind !== 'range') m.fixed = true; });
      var ownKey = own0.join(',');
      out0.sort(function(a, b){ return (b.join(',') === ownKey) - (a.join(',') === ownKey); });
      return out0.slice(0, 400);
    }
    var out = [[]];
    modes.forEach(function(m){
      var next = [];
      out.forEach(function(c){ m.opts.forEach(function(o, i){ next.push(c.concat(i)); }); });
      out = next;
    });
    var own = modes.map(function(m){ return m.get(); }).join(',');
    out.sort(function(a, b){ return (b.join(',') === own) - (a.join(',') === own); });
    return out.slice(0, MAX_FRAMES);
  }

  /* ══ Plotly ═════════════════════════════════════════════════════════════ */
  function plotlyFrame(el, pool, warn){
    if(!el.data || !el.layout) throw new Error('the chart is not drawn yet');
    var data = el.data.map(function(tr, i){
      var t = freeze(tr, 'data.' + i, function(fn, path){ warn.push(path); });
      ['x', 'y', 'z', 'text', 'customdata', 'hovertext'].forEach(function(k){ if(Array.isArray(t[k]) && t[k].length > 8) t[k] = pool.ref(t[k]); });
      return t;
    });
    var layout = freeze(el.layout, 'layout', function(fn, path){ warn.push(path); });
    delete layout.width; delete layout.height;
    var traces = {};
    data.forEach(function(t){ traces[t.type || 'scatter'] = 1; });
    return { data: data, layout: layout, cfg: freeze(el._context ? { displaylogo: el._context.displaylogo, displayModeBar: el._context.displayModeBar, scrollZoom: el._context.scrollZoom, modeBarButtonsToRemove: el._context.modeBarButtonsToRemove, responsive: true } : { responsive: true }, 'cfg', null), traces: Object.keys(traces) };
  }

  /* ══ A diagram the tool draws (SVG) ═════════════════════════════════════
     Written down as a tree of [tag, attributes, children or text], only the
     tags and attributes a drawing is made of: no script, no event handler,
     no link out, no foreign content. Classes become the styles they resolve
     to here, so the diagram needs none of the tool's stylesheets. */
  var SVG_TAGS = K.svgTags;
  var STYLE_PROPS = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'opacity',
    'fill-opacity', 'stroke-opacity', 'font-size', 'font-weight', 'font-family', 'text-anchor', 'dominant-baseline', 'paint-order', 'display', 'visibility'];
  function svgTree(node, root, defaults){
    if(node.nodeType === 3) return node.data;
    if(node.nodeType !== 1 || !SVG_TAGS.test(node.tagName)) return null;
    var tag = node.tagName, attrs = {};
    each(node.attributes, function(a){
      var n = a.name.toLowerCase();
      if(K.svgAttrOk(tag, n, a.value)) attrs[n] = a.value;
    });
    if(node !== root && !/^(tspan|animate|animatemotion|animatetransform|set|mpath)$/i.test(tag)){
      var cs = global.getComputedStyle(node), st = {};
      STYLE_PROPS.forEach(function(p){
        var v = cs.getPropertyValue(p);
        if(!v || v === defaults[p] || attrs[p] != null) return;
        if(/url\(/i.test(v) && !/^url\("?#[\w-]+"?\)$/.test(v.trim())) return;
        st[p] = v.replace(/url\("?(#[\w-]+)"?\)/, 'url($1)');
      });
      Object.keys(st).forEach(function(p){ attrs[p] = st[p]; });
    }
    var kids = [];
    each(node.childNodes, function(c){
      if(c.nodeType === 3 && !/\S/.test(c.data)) return;
      var t = svgTree(c, root, defaults);
      if(t != null) kids.push(t);
    });
    return [tag, attrs, kids];
  }
  function svgFrame(el, warn){
    var svg = el.tagName && el.tagName.toLowerCase() === 'svg' ? el : el.querySelector('svg');
    if(!svg) throw new Error('the diagram is not drawn yet');
    var probe = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(probe);
    var cs = global.getComputedStyle(probe), defaults = {};
    STYLE_PROPS.forEach(function(p){ defaults[p] = cs.getPropertyValue(p); });
    svg.removeChild(probe);
    var tree = svgTree(svg, svg, defaults);
    return { svg: tree, vb: drawnBox(svg) || svg.getAttribute('viewBox'), sig: el.getAttribute('data-share-sig') || '' };
  }
  /* The drawing's own extent, with the 28-unit margin a diagram is framed
     in, not the view the tool's stage happens to show: a background that
     runs on for ever (the grid of dots) is left out of the measure. */
  function drawnBox(svg){
    var hid = [];
    each(svg.querySelectorAll('*'), function(n){
      try { var b = n.getBBox && n.getBBox(); if(b && (b.width > 20000 || b.height > 20000)){ hid.push([n, n.style.display]); n.style.display = 'none'; } } catch(e){}
    });
    var bb = null;
    try { bb = svg.getBBox(); } catch(e){}
    hid.forEach(function(h){ h[0].style.display = h[1]; });
    if(!bb || !(bb.width > 0) || !(bb.height > 0)) return null;
    var pad = 28;
    return [bb.x - pad, bb.y - pad, bb.width + 2 * pad, bb.height + 2 * pad].map(function(v){ return Math.round(v * 10) / 10; }).join(' ');
  }
  /* Two frames of one diagram differ in a few labels and colours, so a
     frame after the first is written as the changes to it: the path to each
     node that differs, and what it now is. */
  function svgDiff(a, b, path, out){
    if(JSON.stringify(a) === JSON.stringify(b)) return out;
    if(!Array.isArray(a) || !Array.isArray(b) || a[0] !== b[0] || a[2].length !== b[2].length){
      out.push([path, b]);
      return out;
    }
    if(JSON.stringify(a[1]) !== JSON.stringify(b[1])) out.push([path.concat('@'), b[1]]);
    for(var i = 0; i < a[2].length; i++) svgDiff(a[2][i], b[2][i], path.concat(i), out);
    return out;
  }

  /* ══ The snapshot ═══════════════════════════════════════════════════════ */
  function kindOf(el){
    if(el.hasAttribute('data-share-chart')) return 'svg';
    if(global.Chart && global.Chart.getChart && global.Chart.getChart(el)) return 'chartjs';
    if(el.classList.contains('js-plotly-plot')) return 'plotly';
    return null;
  }
  /* o: { card, el, key, roots, legendKey, settle(key) → Promise } from shared.js.
     Resolves to the snapshot, the views put back as they were. */
  function take(o){
    var el = o.el, kind = kindOf(el), pool = new Pool(), warn = [];
    POOL = pool;
    if(!kind) return Promise.reject(new Error('this chart cannot be embedded'));
    var modes = modesOf(o.roots), list = combos(modes), own = modes.map(function(m){ return m.get(); });
    var frames = [], map = {}, first = null;
    function capture(){
      var cur = o.find(o.key) || el;
      if(kind === 'chartjs'){
        var f = chartjsFrame(cur, pool, warn);
        f.legend = legendOf(o.roots, cur, o.legendKey);
        if(f.legend) f.legendTree = legendTree(o.roots);
        // Above the chart or under it, where the tool has it.
        var first = null;
        o.roots.forEach(function(r){ if(!first) first = r.querySelector('.legend-item'); });
        if(first && (first.compareDocumentPosition(cur) & Node.DOCUMENT_POSITION_FOLLOWING)) f.legendTop = 1;
        return f;
      }
      if(kind === 'plotly') return plotlyFrame(cur, pool, warn);
      var s = svgFrame(cur, warn);
      if(!first){ first = s; return s; }
      // One frame for every view: the first one's.
      return { diff: svgDiff(first.svg, s.svg, [], []) };
    }
    /* Charts under this one (o.extras): each written down once, with the
       first view; after that only what its options change with the view
       (the hour marker that follows the diagram's slider). */
    var extras = (o.extras || []).map(function(x){ return { x: x, base: null }; });
    function captureExtras(f){
      extras.forEach(function(e, j){
        var ch = global.Chart && global.Chart.getChart(o.find(e.x.key) || e.x.el);
        if(!ch) return;
        if(!e.base){
          var p = chartjsFrame(o.find(e.x.key) || e.x.el, pool, warn);
          p.legend = legendOf(e.x.roots, o.find(e.x.key) || e.x.el, o.legendKey);
          if(p.legend) p.legendTree = legendTree(e.x.roots);
          p.t = e.x.title;
          var it0 = null;
          e.x.roots.forEach(function(r){ if(!it0) it0 = r.querySelector('.legend-item'); });
          if(it0 && (it0.compareDocumentPosition(ch.canvas) & Node.DOCUMENT_POSITION_FOLLOWING)) p.legendTop = 1;
          p.h = Math.round((ch.canvas.parentElement && ch.canvas.parentElement.offsetHeight) || 300);
          e.base = freeze(ch.config._config.options.plugins || {}, '', null) || {};
          e.panel = p;
          return;
        }
        // Only the plugins whose options moved, each whole.
        var now = freeze(ch.config._config.options.plugins || {}, '', null) || {}, moved = {}, any = false;
        Object.keys(now).forEach(function(id){
          if(id === 'tooltip' || JSON.stringify(now[id]) === JSON.stringify(e.base[id])) return;
          moved[id] = now[id]; any = true;
        });
        if(any){ f.px = f.px || {}; f.px[j] = moved; }
      });
    }
    function setAll(c){ modes.forEach(function(m, i){ m.set(c[i]); }); }
    var chain = Promise.resolve();
    list.forEach(function(c){
      chain = chain.then(function(){
        setAll(c);
        return o.settle(o.key);
      }).then(function(){
        // A slider's step is named by its read-out once it is set.
        modes.forEach(function(m, i){ if(m.read && !m.opts[c[i]].l) m.opts[c[i]].l = m.read(); });
        map[c.join(',')] = frames.length;
        var f = capture();
        captureExtras(f);
        frames.push(f);
      });
    });
    function restore(){ setAll(own); return o.settle(o.key); }
    return chain.then(restore, function(e){ return restore().then(function(){ throw e; }); }).then(function(){
      var snap = {
        v: 1, kind: kind,
        // A view held fixed (beside a slider) is not offered.
        modes: modes.map(function(m, i){ return m.fixed ? { l: m.label, k: 'fixed', o: [m.opts[own[i]]], at: own[i] } : { l: m.label, k: m.kind, o: m.opts, at: own[i] }; }),
        map: map, frames: frames, pool: pool.list
      };
      var panels = extras.map(function(e){ return e.panel; }).filter(Boolean);
      if(panels.length) snap.panels = panels;
      if(warn.length && global.console) console.info('Embed snapshot left out:', warn.filter(function(w, i){ return warn.indexOf(w) === i; }).join(', '));
      return snap;
    });
  }

  // modes: the views a card offers, for _ref/share-check.mjs to set one by one.
  global.SharedSnapshot = { take: take, learnFormat: learnFormat, modes: modesOf };
})(window);
