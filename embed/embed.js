/* ──────────────────────────────────────────────────────────────────────────
   Embed viewer — a shared chart, drawn from its link
   embed/index.html#t=<kind>&kit=<tool>&s=<snapshot>

   The page another site frames when a reader pastes Embed as HTML. The
   snapshot (share-snapshot.js) is the chart written down as data while the
   tool had it on screen, deflated into the #hash, which never reaches a
   server. This draws it with Chart.js, Plotly or plain SVG and chart-kit.js:
   no tool, no model and no market data is loaded in the other site's frame.

   What a reader can do here is what a chart is for: hover, zoom and pan,
   show and hide series from the key, and switch between the views the card
   offered (the controls the tool marks data-embed-mode). The inputs that
   produced the numbers stay on the tool, one click away: the line under the
   chart opens it on this very scenario.

   A link can be written by anyone, so nothing in it is ever read as markup:
   every string goes into the page as text, a diagram is rebuilt only from
   the tags and attributes a drawing is made of, a function is only ever one
   chart-kit.js registered by name, and the links out must point back at
   this site.
   ────────────────────────────────────────────────────────────────────────── */
(function(global){
  var doc = document, root = doc.documentElement;
  var SITE = location.origin + '/';
  var LOADING = { en: 'Loading data from ', id: 'Memuat data dari ' };
  var FAILED = { en: ['This chart could not be shown here.', 'Open it on '], id: ['Grafik ini tidak bisa ditampilkan di sini.', 'Buka di '] };
  var RESET = { en: 'Reset zoom', id: 'Atur ulang zoom' }, PLAY = { en: ['Play', 'Pause'], id: ['Putar', 'Jeda'] };
  var snap = null, lang = 'en', pool = [], card, stage, legendBox, modesBox, resetBox, current = null, frameAt = -1, picks = [];
  // What the reader hid in the key, by entry, so it stays hidden in every view.
  var legendOff = {};

  function el(tag, cls, text){
    var e = doc.createElement(tag);
    if(cls) e.className = cls;
    if(text != null) e.textContent = String(text);
    return e;
  }
  function arr(ref){ return ref && typeof ref === 'object' && typeof ref.$p === 'number' ? (pool[ref.$p] || []) : ref; }

  /* ── The link ── */
  function hashParam(k){
    var m = new RegExp('(?:^#|&)' + k + '=([^&]*)').exec(location.hash || '');
    return m ? decodeURIComponent(m[1]) : '';
  }
  function unb64(str){
    var s = atob(str.replace(/-/g, '+').replace(/_/g, '/')), out = new Uint8Array(s.length);
    for(var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  function unpack(str){
    var c = str.charAt(0), bytes = unb64(str.slice(1));
    var p = c === 'z' ? new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()
          : c === 'j' ? Promise.resolve(bytes.buffer) : Promise.reject(new Error('unknown format'));
    return p.then(function(b){ return JSON.parse(new TextDecoder().decode(b)); });
  }
  // A link out of the frame goes back to this site, or nowhere.
  function ownUrl(u){
    try { var x = new URL(u, SITE); return x.origin === location.origin ? x.href : null; } catch(e){ return null; }
  }

  /* ── Revive what the snapshot froze ──
     {$p: i} is a pooled array, {$k: ref} a ChartKit function, {$seg: [...]}
     a line's look segment by segment. */
  function revive(v){
    if(Array.isArray(v)) return v.map(revive);
    if(!v || typeof v !== 'object') return v;
    if(typeof v.$p === 'number') return arr(v).slice();
    if(v.$k) return global.ChartKit.revive({ n: v.$k.n, a: v.$k.a ? revive(v.$k.a) : undefined }) || undefined;
    if(Array.isArray(v.$tab) && v.$tab.length === 2){
      var lo = +v.$tab[0] || 0, tab = arr(v.$tab[1]) || [];
      return function(ctx){ var t = ctx && ctx.tick ? Math.round(ctx.tick.value) - lo : -1, r = tab[t]; return r == null ? undefined : r; };
    }
    if(Array.isArray(v.$z) && v.$z.length === 2){
      var z = v.$z;
      return function(ctx){ return ctx && ctx.tick && Math.abs(ctx.tick.value) < 1e-9 ? z[0] : z[1]; };
    }
    if(Array.isArray(v.$seg)){ var seg = v.$seg; return function(ctx){ var r = seg[ctx.p0DataIndex]; return r == null ? undefined : r; }; }
    var o = {};
    Object.keys(v).forEach(function(k){
      if(k === '__proto__' || k === 'constructor' || k === 'prototype') return;
      var r = revive(v[k]);
      if(r !== undefined) o[k] = r;
    });
    return o;
  }

  /* ── The card ── */
  var LOGO = 'M242 570A250 250 0 0 1 234 113M234 113A250 250 0 0 1 446 113M446 113A250 250 0 0 1 438 570';
  function logo(){
    var NS = 'http://www.w3.org/2000/svg', s = doc.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 680 680'); s.setAttribute('width', '12'); s.setAttribute('height', '12');
    s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', 'mark-logo');
    var c = doc.createElementNS(NS, 'circle');
    c.setAttribute('cx', '340'); c.setAttribute('cy', '340'); c.setAttribute('r', '300'); c.setAttribute('fill', '#0052cc');
    var p = doc.createElementNS(NS, 'path');
    p.setAttribute('d', LOGO); p.setAttribute('fill', 'none'); p.setAttribute('stroke', '#fff'); p.setAttribute('stroke-width', '46');
    var l = doc.createElementNS(NS, 'line');
    l.setAttribute('x1', '113'); l.setAttribute('y1', '354'); l.setAttribute('x2', '567'); l.setAttribute('y2', '354');
    l.setAttribute('stroke', '#fff'); l.setAttribute('stroke-width', '42'); l.setAttribute('stroke-linecap', 'round');
    s.appendChild(c); s.appendChild(p); s.appendChild(l);
    return s;
  }
  function build(){
    card = el('div', 'card');
    var head = el('div', 'head');
    if(snap.t) head.appendChild(el('h1', 'title', snap.t));
    modesBox = el('div', 'modes');
    head.appendChild(modesBox);
    resetBox = el('div', 'tools');
    head.appendChild(resetBox);
    card.appendChild(head);
    legendBox = el('div', 'legend');
    stage = el('div', 'stage');
    stage.style.setProperty('--h', Math.max(160, Math.min(1200, +snap.h || 430)) + 'px');
    var f0 = snap.frames[0] || {};
    if(f0.legendTop){ legendBox.classList.add('top'); card.appendChild(legendBox); card.appendChild(stage); }
    else { card.appendChild(stage); card.appendChild(legendBox); }
    var back = ownUrl(snap.back) || SITE, a = el('a', 'mark');
    a.href = back; a.target = '_blank'; a.rel = 'noopener';
    a.title = String(snap.n || '');
    a.appendChild(logo());
    a.appendChild(el('span', null, String(snap.w || '') + ' ' + back.split('#')[0].replace(/^https?:\/\//, '').replace(/\/$/, '')));
    card.appendChild(a);
    doc.body.appendChild(card);
    buildModes();
  }

  /* ── The views the card offers ── */
  function buildModes(){
    picks = (snap.modes || []).map(function(m){ return Math.max(0, m.at | 0); });
    (snap.modes || []).forEach(function(m, mi){
      var opts = m.o || [];
      if(m.k === 'check'){
        var b = el('button', 'chip', m.l);
        b.type = 'button';
        b.setAttribute('aria-pressed', picks[mi] ? 'true' : 'false');
        b.addEventListener('click', function(){
          picks[mi] = picks[mi] ? 0 : 1;
          b.setAttribute('aria-pressed', picks[mi] ? 'true' : 'false');
          show();
        });
        modesBox.appendChild(b);
        return;
      }
      if(m.k === 'range'){
        var wrap = el('div', 'range'), play = el('button', 'chip play', '▶'), out = el('span', 'range-at');
        var r = el('input');
        r.type = 'range'; r.min = 0; r.max = opts.length - 1; r.step = 1; r.value = picks[mi];
        if(m.l) r.setAttribute('aria-label', m.l);
        play.type = 'button'; play.setAttribute('aria-label', PLAY[lang][0]);
        var timer = null;
        var sync = function(){ out.textContent = (opts[picks[mi]] || {}).l || ''; };
        r.addEventListener('input', function(){ picks[mi] = +r.value; sync(); show(); });
        play.addEventListener('click', function(){
          if(timer){ clearInterval(timer); timer = null; play.textContent = '▶'; play.setAttribute('aria-label', PLAY[lang][0]); return; }
          play.textContent = '❚❚'; play.setAttribute('aria-label', PLAY[lang][1]);
          timer = setInterval(function(){ picks[mi] = (picks[mi] + 1) % opts.length; r.value = picks[mi]; sync(); show(); }, 700);
        });
        wrap.appendChild(play); wrap.appendChild(r); wrap.appendChild(out);
        sync();
        modesBox.appendChild(wrap);
        return;
      }
      if(m.k === 'select' && opts.length > 4){
        var sel = el('select', 'pick');
        if(m.l) sel.setAttribute('aria-label', m.l);
        opts.forEach(function(o, i){ var op = el('option', null, o.l); op.value = String(i); sel.appendChild(op); });
        sel.value = String(picks[mi]);
        sel.addEventListener('change', function(){ picks[mi] = +sel.value; show(); });
        modesBox.appendChild(sel);
        return;
      }
      var g = el('div', 'seg');
      g.setAttribute('role', 'radiogroup');
      if(m.l) g.setAttribute('aria-label', m.l);
      opts.forEach(function(o, i){
        var b = el('button', 'seg-btn');
        b.type = 'button';
        b.setAttribute('role', 'radio');
        b.appendChild(el('span', 'long', o.l));
        if(o.s){ b.appendChild(el('span', 'short', o.s)); b.classList.add('has-short'); }
        b.addEventListener('click', function(){ picks[mi] = i; syncSeg(); show(); });
        g.appendChild(b);
      });
      function syncSeg(){
        Array.prototype.forEach.call(g.children, function(b, i){
          b.classList.toggle('active', i === picks[mi]);
          b.setAttribute('aria-checked', i === picks[mi] ? 'true' : 'false');
        });
      }
      syncSeg();
      modesBox.appendChild(g);
    });
    if(!modesBox.children.length) modesBox.remove();
  }
  function frameIndex(){
    var key = picks.join(','), map = snap.map || {};
    return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : 0;
  }

  /* ── The key ── */
  // One entry of the key: its swatch and words, pressed to show or hide its series.
  function legendItem(e, onToggle){
    if(Object.prototype.hasOwnProperty.call(legendOff, e.l)) e.off = legendOff[e.l];
    var it = el('button', 'legend-item' + (e.off ? ' hidden' : ''));
    it.type = 'button';
    if(!(e.ds && e.ds.length)){ it.disabled = true; it.classList.add('static'); }
    if(e.pre) it.appendChild(el('span', 'legend-paren', e.pre));
    var sw = el('span');
    sw.innerHTML = global.SharedLegend.swatchHtml(global.SharedLegend.spec(e.sw || {}));
    it.appendChild(sw.firstChild);
    it.appendChild(el('span', 'legend-label', e.l));
    if(e.post) it.appendChild(el('span', 'legend-paren', e.post));
    if(e.sr) it.appendChild(el('span', 'vh', ' ' + e.sr));
    it.setAttribute('aria-pressed', e.off ? 'false' : 'true');
    it.addEventListener('click', function(){
      e.off = e.off ? 0 : 1;
      legendOff[e.l] = e.off;
      it.classList.toggle('hidden', !!e.off);
      it.setAttribute('aria-pressed', e.off ? 'false' : 'true');
      onToggle(e);
    });
    return it;
  }
  // The key laid out as the tool laid it out: its boxes by class, its words as text.
  function legendNode(t, entries, onToggle){
    if(typeof t === 'string') return doc.createTextNode(t + ' ');
    if(!t || typeof t !== 'object') return null;
    if(typeof t.i === 'number') return entries[t.i] ? legendItem(entries[t.i], onToggle) : null;
    var n = el('span', String(t.c || '').replace(/[^\w\s-]/g, ''));
    (Array.isArray(t.k) ? t.k : []).forEach(function(k){ var c = legendNode(k, entries, onToggle); if(c) n.appendChild(c); });
    return n;
  }
  function buildLegend(entries, onToggle, tree){
    legendBox.textContent = '';
    legendBox.classList.remove('grouped', 'tree');
    if(tree && entries && entries.length){
      var root = legendNode(tree, entries, onToggle);
      if(root){
        legendBox.classList.add('tree');
        Array.prototype.slice.call(root.childNodes).forEach(function(c){ legendBox.appendChild(c); });
        root.className.split(/\s+/).forEach(function(c){ if(c) legendBox.classList.add(c); });
        legendBox.hidden = false;
        return;
      }
    }
    var grouped = (entries || []).some(function(e){ return e.g; }), groups = {};
    legendBox.classList.toggle('grouped', grouped);
    function home(e){
      if(!grouped) return legendBox;
      var name = String(e.g || '');
      if(!groups.hasOwnProperty(name)){
        var g = groups[name] = el('div', 'legend-group');
        if(name) g.appendChild(el('span', 'legend-group-label', name));
        legendBox.appendChild(g);
      }
      return groups[name];
    }
    (entries || []).forEach(function(e){ home(e).appendChild(legendItem(e, onToggle)); });
    legendBox.hidden = !legendBox.children.length;
  }

  /* ── Chart.js ── */
  var chart = null;
  function tipCallbacks(T){
    if(!T) return null;
    var rows = {};
    Object.keys(T.r || {}).forEach(function(d){ rows[d] = arr(T.r[d]); });
    var byI = T.by === 'i';
    var keyOf = function(it){ return byI ? it.dataIndex : it.datasetIndex + ',' + it.dataIndex; };
    var group = function(src){
      var a = byI ? arr(src) : src;
      return function(items){
        if(!a || !items || !items.length) return '';
        var v = a[keyOf(items[0])];
        return v || '';
      };
    };
    var row = function(ctx){ var r = rows[ctx.datasetIndex]; return r ? r[ctx.dataIndex] : null; };
    var part = function(k){ return function(ctx){ var r = row(ctx); return r && !Array.isArray(r) ? r[k] : (k === 'l' ? r : ''); }; };
    return {
      callbacks: { title: group(T.t), beforeBody: group(T.bb), afterBody: group(T.ab), footer: group(T.f),
                   beforeLabel: part('b'), label: function(ctx){ var r = part('l')(ctx); return r || ''; }, afterLabel: part('a') },
      filter: function(it){ return !!row(it); }
    };
  }
  function drawChart(f){
    var C = global.Chart;
    var cfg = { type: f.type, data: { labels: revive(f.labels), datasets: revive(f.datasets) }, options: revive(f.options) || {} };
    var o = cfg.options;
    o.responsive = true;
    o.maintainAspectRatio = false;
    o.animation = false;
    o.plugins = o.plugins || {};
    var tip = tipCallbacks(f.tip);
    if(tip){
      o.plugins.tooltip = o.plugins.tooltip || {};
      o.plugins.tooltip.callbacks = tip.callbacks;
      o.plugins.tooltip.filter = tip.filter;
    }
    Object.keys(f.ticks || {}).forEach(function(id){
      o.scales = o.scales || {};
      var sc = o.scales[id] = o.scales[id] || {};
      sc.ticks = sc.ticks || {};
      sc.ticks.callback = global.ChartKit.tickCallback(f.ticks[id], arr);
    });
    cfg.plugins = (f.plugins || []).map(global.ChartKit.pluginOf).filter(Boolean);
    stage.textContent = '';
    var box = el('div', 'fill'), cv = el('canvas');
    cv.setAttribute('role', 'img');
    if(snap.t) cv.setAttribute('aria-label', snap.t);
    box.appendChild(cv);
    stage.appendChild(box);
    if(chart) chart.destroy();
    chart = new C(cv, cfg);
    var zoomable = !!(o.plugins.zoom && chart.resetZoom);
    resetButton(zoomable, function(){ chart.resetZoom(); });
    buildLegend(f.legend, function(e){
      e.ds.forEach(function(d){ if(d < chart.data.datasets.length) chart.setDatasetVisibility(d, !e.off); });
      chart.update();
    }, f.legendTree);
    (f.legend || []).forEach(function(e){
      if(e.off) (e.ds || []).forEach(function(d){ if(d < chart.data.datasets.length) chart.setDatasetVisibility(d, false); });
    });
    chart.update('none');
  }
  // The ⟳ beside the views, as on the tool's own card; one per drawing.
  function resetButton(on, fn){
    resetBox.textContent = '';
    var b = el('button', 'reset', '⟳');
    b.type = 'button';
    b.title = RESET[lang];
    b.setAttribute('aria-label', RESET[lang]);
    b.hidden = !on;
    b.addEventListener('click', fn);
    resetBox.appendChild(b);
    return b;
  }

  /* ── Plotly ── */
  var TAG_OK = /^(br|b|i|em|strong|sup|sub|span)$/i;
  // Plotly reads a little markup in its strings; only line breaks and plain
  // emphasis are let through, never a link or a style.
  function plotlyText(v){
    if(typeof v === 'string') return v.replace(/<\/?([a-z]+)\b[^>]*>/gi, function(t, tag){ return TAG_OK.test(tag) && !/=/.test(t) ? t : ''; });
    if(Array.isArray(v)) return v.map(plotlyText);
    if(v && typeof v === 'object'){ var o = {}; Object.keys(v).forEach(function(k){ o[k] = plotlyText(v[k]); }); return o; }
    return v;
  }
  function drawPlotly(f){
    var P = global.Plotly;
    stage.textContent = '';
    var box = el('div', 'fill plot');
    stage.appendChild(box);
    var data = plotlyText(revive(f.data)), layout = plotlyText(revive(f.layout)) || {};
    layout.autosize = true;
    var cfg = revive(f.cfg) || {};
    cfg.responsive = true;
    cfg.displaylogo = false;
    P.newPlot(box, data, layout, cfg);
    legendBox.hidden = true;
  }

  /* ── A diagram (SVG) ── */
  var NS = 'http://www.w3.org/2000/svg';
  var SVG_TAGS = /^(svg|g|path|line|polyline|polygon|rect|circle|ellipse|text|tspan|defs|marker|lineargradient|radialgradient|stop|clippath|pattern|title|use|symbol|mask)$/i;
  var SVG_ATTRS = /^(d|x|y|x1|x2|y1|y2|cx|cy|r|rx|ry|width|height|points|transform|viewbox|fill|stroke|stroke-width|stroke-dasharray|stroke-dashoffset|stroke-linecap|stroke-linejoin|stroke-opacity|fill-opacity|opacity|font-size|font-weight|font-family|font-style|text-anchor|dominant-baseline|alignment-baseline|letter-spacing|id|marker-start|marker-mid|marker-end|markerwidth|markerheight|refx|refy|orient|markerunits|offset|stop-color|stop-opacity|gradientunits|gradienttransform|clip-path|clippathunits|patternunits|preserveaspectratio|dx|dy|paint-order|vector-effect|visibility|display|mask|href|xlink:href|data-k)$/i;
  var CASE = { viewbox: 'viewBox', markerwidth: 'markerWidth', markerheight: 'markerHeight', refx: 'refX', refy: 'refY',
    markerunits: 'markerUnits', gradientunits: 'gradientUnits', gradienttransform: 'gradientTransform',
    clippathunits: 'clipPathUnits', patternunits: 'patternUnits', preserveaspectratio: 'preserveAspectRatio',
    lineargradient: 'linearGradient', radialgradient: 'radialGradient', clippath: 'clipPath' };
  function svgNode(t){
    if(typeof t === 'string') return doc.createTextNode(t);
    if(!Array.isArray(t) || typeof t[0] !== 'string' || !SVG_TAGS.test(t[0])) return null;
    var tag = CASE[t[0].toLowerCase()] || t[0], n = doc.createElementNS(NS, tag), a = t[1] || {};
    Object.keys(a).forEach(function(k){
      var lk = k.toLowerCase(), v = String(a[k]);
      if(!SVG_ATTRS.test(lk)) return;
      if((lk === 'href' || lk === 'xlink:href') && !/^#[\w-]+$/.test(v)) return;
      if(/url\(/i.test(v) && !/^url\(#[\w-]+\)$/.test(v.trim())) return;
      if(lk === 'xlink:href') n.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', v);
      else n.setAttribute(CASE[lk] || lk, v);
    });
    (t[2] || []).forEach(function(c){ var k = svgNode(c); if(k) n.appendChild(k); });
    return n;
  }
  function patched(base, diff){
    var t = JSON.parse(JSON.stringify(base));
    (diff || []).forEach(function(d){
      var path = d[0], val = d[1], node = t, i;
      if(!Array.isArray(path)) return;
      if(!path.length){ t = val; return; }
      for(i = 0; i < path.length - 1; i++){ node = node && node[2] ? node[2][path[i]] : null; }
      var last = path[path.length - 1];
      if(!node) return;
      if(last === '@') node[1] = val;
      else if(node[2]) node[2][last] = val;
    });
    return t;
  }
  var view = null;
  function drawSvg(f, first){
    var tree = f.svg || patched(first.svg, f.diff);
    var svg = svgNode(tree);
    if(!svg || svg.tagName.toLowerCase() !== 'svg') throw new Error('no diagram');
    svg.removeAttribute('width'); svg.removeAttribute('height');
    svg.setAttribute('class', 'diagram');
    var vb = (f.vb || first.vb || '').split(/[\s,]+/).map(Number);
    var keep = view;
    stage.textContent = '';
    var box = el('div', 'fill dia');
    box.appendChild(svg);
    stage.appendChild(box);
    if(vb.length === 4 && vb.every(isFinite)){
      var home = vb.slice();
      view = keep && keep.home.join() === home.join() ? keep : { home: home, at: home.slice() };
      var apply = function(){ svg.setAttribute('viewBox', view.at.join(' ')); };
      apply();
      panZoom(box, svg, apply);
      resetButton(true, function(){ view.at = view.home.slice(); apply(); });
    }
    legendBox.hidden = true;
  }
  // Wheel and pinch zoom about the pointer, drag to pan, inside 1/8 to 8x.
  function panZoom(box, svg, apply){
    function toView(cx, cy){
      var r = svg.getBoundingClientRect(), a = view.at;
      var s = Math.max(a[2] / r.width, a[3] / r.height);
      var ox = a[0] - (r.width * s - a[2]) / 2, oy = a[1] - (r.height * s - a[3]) / 2;
      return [ox + (cx - r.left) * s, oy + (cy - r.top) * s, s];
    }
    function zoom(k, cx, cy){
      var a = view.at, p = toView(cx, cy), h = view.home;
      var w = Math.max(h[2] / 8, Math.min(h[2] * 8, a[2] * k)), f = w / a[2];
      view.at = [p[0] - (p[0] - a[0]) * f, p[1] - (p[1] - a[1]) * f, a[2] * f, a[3] * f];
      apply();
    }
    box.addEventListener('wheel', function(e){ e.preventDefault(); zoom(Math.exp(e.deltaY * 0.0015), e.clientX, e.clientY); }, { passive: false });
    var pts = {}, last = null;
    box.addEventListener('pointerdown', function(e){ pts[e.pointerId] = [e.clientX, e.clientY]; box.setPointerCapture(e.pointerId); last = null; });
    box.addEventListener('pointermove', function(e){
      if(!pts[e.pointerId]) return;
      var ids = Object.keys(pts);
      if(ids.length === 1){
        var p = pts[e.pointerId], s = toView(0, 0)[2];
        view.at = [view.at[0] - (e.clientX - p[0]) * s, view.at[1] - (e.clientY - p[1]) * s, view.at[2], view.at[3]];
        apply();
      } else if(ids.length === 2){
        var o = pts[ids[0] === String(e.pointerId) ? ids[1] : ids[0]];
        var d = Math.hypot(e.clientX - o[0], e.clientY - o[1]);
        if(last) zoom(last / d, (e.clientX + o[0]) / 2, (e.clientY + o[1]) / 2);
        last = d;
      }
      pts[e.pointerId] = [e.clientX, e.clientY];
    });
    var up = function(e){ delete pts[e.pointerId]; last = null; };
    box.addEventListener('pointerup', up);
    box.addEventListener('pointercancel', up);
  }

  /* ── Drawing a view ── */
  function show(){
    var i = frameIndex(), f = (snap.frames || [])[i];
    if(!f || i === frameAt) return;
    frameAt = i;
    if(snap.kind === 'chartjs') drawChart(f);
    else if(snap.kind === 'plotly') drawPlotly(f);
    else drawSvg(f, snap.frames[0]);
    current = f;
    queueSize();
  }

  /* ── The frame is as tall as what it shows ──
     The card laid out at its own height, the chart at the height the tool
     gives it on a desktop, posted to the page that frames this one; the
     one-line listener in the embed code sets it on the iframe. */
  var sent = 0, queued = false;
  function measure(){
    var h = stage.style.getPropertyValue('--h');
    card.classList.add('measuring');
    var out = Math.ceil(card.getBoundingClientRect().height) + 1;
    card.classList.remove('measuring');
    return out || parseInt(h, 10) || 430;
  }
  function post(){
    queued = false;
    if(global.parent === global) return;
    var h = measure();
    if(Math.abs(h - sent) < 2) return;
    sent = h;
    try { global.parent.postMessage({ abtEmbed: 'height', height: h }, '*'); } catch(e){}
  }
  function queueSize(){ if(!queued){ queued = true; global.requestAnimationFrame(post); } }

  /* ── Start ── */
  function fail(){
    root.classList.remove('wait');
    root.classList.add('failed');
    doc.body.textContent = '';
    var t = FAILED[lang], box = el('div', 'fail');
    box.appendChild(el('p', null, t[0]));
    var p = el('p'), a = el('a', null, snap && snap.n ? snap.n : 'tool.adjiebrotots.com');
    a.href = (snap && ownUrl(snap.back)) || SITE; a.target = '_blank'; a.rel = 'noopener';
    p.appendChild(doc.createTextNode(t[1])); p.appendChild(a);
    box.appendChild(p);
    doc.body.appendChild(box);
  }
  function fonts(){
    var f = doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve();
    return Promise.race([f, new Promise(function(r){ setTimeout(r, 400); })]);
  }
  var ready = new Promise(function(r){
    if(doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', r); else r();
  });
  function start(){
    var s = hashParam('s');
    if(!s) return ready.then(fail);
    Promise.all([unpack(s), ready]).then(function(r){
      snap = r[0];
      if(!snap || snap.v !== 1 || !Array.isArray(snap.frames) || !snap.frames.length) throw new Error('not a chart');
      pool = Array.isArray(snap.pool) ? snap.pool : [];
      lang = snap.l === 'id' ? 'id' : 'en';
      root.lang = lang;
      if(snap.th === 'light') doc.body.classList.add('light');
      if(snap.kind === 'chartjs' && !global.Chart) throw new Error('Chart.js did not load');
      if(snap.kind === 'plotly' && !global.Plotly) throw new Error('Plotly did not load');
      return fonts();
    }).then(function(){
      build();
      show();
      root.classList.remove('wait');
      if(global.ResizeObserver) new ResizeObserver(queueSize).observe(card);
      else global.addEventListener('resize', queueSize);
      queueSize();
    }).catch(function(e){
      if(global.console) console.warn('Embed:', e);
      ready.then(fail);
    });
  }
  global.addEventListener('hashchange', function(){ location.reload(); });
  start();
})(window);
