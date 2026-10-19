/* ──────────────────────────────────────────────────────────────────────────
   Chart kit — what a chart needs to be drawn, and nothing else
   Included by every page with a chart, just before shared.js:
     <script src="../chart-kit.js"></script>
   and by the embed viewer (embed/), which draws a shared chart from its link
   with this file and Chart.js alone, never the tool's own scripts.

   It holds the four pieces a chart on this site is drawn with:
     SharedLegend    the key's swatches, read off the datasets
     SharedChartTip  the hover card, keyed like the legend
     SharedZoom      pan and pinch inside the data, y refitted to the window
     SharedPane      axis text on a chart of stacked panes
   and ChartKit, the names a chart's functions travel under. A shared chart
   is sent as data (SharedShare.snapshot in shared.js), and a function is not
   data: a plugin, an interaction mode or a scale hook a chart needs is
   registered here by name, in this file or in a tool's own kit file
   (<tool>/chart-kit.js), and the snapshot carries the name.

       ChartKit.plugin(PLUGIN)                 // a Chart.js plugin, by its id
       ChartKit.fn('ff.age', fn)               // a function, by name
       var f = ChartKit.make('cx.tick', make); // a factory: f(args…) returns
                                               // make(args…), tagged so the
                                               // snapshot carries name and args
   ────────────────────────────────────────────────────────────────────────── */
(function(global){
  /* ── ChartKit — functions by name ── */
  var FNS = {}, PLUGINS = {};
  function fn(name, f){
    if(typeof f !== 'function') return f;
    FNS[name] = f;
    try { Object.defineProperty(f, '$kit', { value: { n: name }, configurable: true }); } catch(e){}
    return f;
  }
  function make(name, factory){
    FNS[name] = factory;
    return function(){
      var args = Array.prototype.slice.call(arguments), f = factory.apply(null, args);
      // A function, or an object a chart draws with (a fill pattern): either
      // carries the name and arguments it was made from.
      if(f && (typeof f === 'function' || typeof f === 'object')){
        try { Object.defineProperty(f, '$kit', { value: { n: name, a: args }, configurable: true }); } catch(e){}
      }
      return f;
    };
  }
  function plugin(p){ if(p && p.id) PLUGINS[p.id] = p; return p; }
  // A reference as the snapshot carries it, or null for a function with no name.
  function refOf(f){ return f && (typeof f === 'function' || typeof f === 'object') && f.$kit ? f.$kit : null; }
  // What a reference names: a named function itself, or a factory's product
  // for the arguments it was made with.
  function revive(ref){
    var f = ref && FNS.hasOwnProperty(ref.n) ? FNS[ref.n] : null;
    if(!f) return null;
    if(ref.a){ try { f = f.apply(null, ref.a); } catch(e){ return null; } }
    return f && (typeof f === 'function' || typeof f === 'object') ? f : null;
  }
  /* ── Axis labels a snapshot carries (share-snapshot.js) ──
     A category axis carries its labels; a numeric one a table over its whole
     numbers and a format learned from the tool's callback: for each sign and
     decade, [prefix, suffix, power of ten, decimals, trim zeros, thousands
     separator, decimal separator], plus the labels the format gets wrong. */
  function tickKey(v){ return String(+(+v).toPrecision(12)); }
  function formatTick(fmt, v){
    if(!fmt) return String(v);
    if(fmt.x && Object.prototype.hasOwnProperty.call(fmt.x, tickKey(v))) return fmt.x[tickKey(v)];
    if(v === 0 || Math.abs(v) < 1e-12) return fmt.z != null ? fmt.z : '0';
    var sign = v < 0 ? '-' : '+', dec = Math.floor(Math.log10(Math.abs(v)) + 1e-9);
    var b = fmt.b && fmt.b[sign + dec];
    if(!b){
      var best = null, gap = Infinity;
      Object.keys(fmt.b || {}).forEach(function(k){
        var g = Math.abs(parseInt(k.slice(1), 10) - dec);
        if(k.charAt(0) === sign && g < gap){ gap = g; best = k; }
      });
      if(!best) return String(v);
      b = fmt.b[best];
    }
    var s = (Math.abs(v) / Math.pow(10, b[2])).toFixed(Math.max(0, Math.min(20, b[3] | 0)));
    if(b[4] && s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    var parts = s.split('.');
    if(b[5]) parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, b[5]);
    return String(b[0]) + parts.join(b[6] || '.') + String(b[1]);
  }
  // The tick callback the viewer draws an axis with. `arr` reads a pooled array.
  function tickCallback(spec, arr){
    var cat = spec.cat ? arr(spec.cat) : null, lo = spec.int ? spec.int[0] : 0, tab = spec.int ? arr(spec.int[1]) : null;
    var fmt = spec.fmt || null, C = global.Chart;
    return function(v, i, ticks){
      if(cat) return v >= 0 && v < cat.length ? cat[v] : '';
      if(fmt && fmt.hl && ticks && i === ticks.length - 1 && ticks.length > 2) return '';
      if(tab){
        var r = Math.round(v);
        if(Math.abs(v - r) < 1e-9){ if(r - lo >= 0 && r - lo < tab.length) return tab[r - lo]; }
        else if(spec.frac === '') return '';
      }
      if(fmt) return formatTick(fmt, v);
      return C && C.Ticks ? C.Ticks.formatters.numeric.call(this, v, i, ticks) : String(v);
    };
  }

  /* ── Fills a key can name ──
     Two tiles a chart fills an area or a bar with, so that it never reads as
     one more solid series: 45° hatching (rising left to right, or falling
     with down) and staggered dots, each in a colour over a pale wash of it,
     drawn at the screen's pixel ratio so the lines stay crisp and the dots
     round. Made by name, so a shared chart carries the fill, not a picture. */
  function tile(n, paint){
    var k = Math.max(1, Math.ceil(global.devicePixelRatio || 1)), cv = document.createElement('canvas'), g = cv.getContext('2d');
    cv.width = cv.height = n * k;
    g.scale(k, k);
    paint(g, n);
    var pat = g.createPattern(cv, 'repeat');
    if(pat && pat.setTransform && global.DOMMatrix) pat.setTransform(new DOMMatrix().scale(1 / k));
    return pat;
  }
  var hatch = make('kit.hatch', function(fill, line, down){
    return tile(6, function(g, n){
      g.fillStyle = fill; g.fillRect(0, 0, n, n);
      g.strokeStyle = line; g.lineWidth = 1;
      g.beginPath();
      [-n, 0, n].forEach(function(o){ g.moveTo(o, down ? 0 : n); g.lineTo(o + n, down ? n : 0); });
      g.stroke();
    });
  });
  var dots = make('kit.dots', function(fill, dot){
    return tile(5, function(g, n){
      g.fillStyle = fill; g.fillRect(0, 0, n, n);
      g.fillStyle = dot;
      [[1.25, 1.25], [3.75, 3.75]].forEach(function(p){ g.beginPath(); g.arc(p[0], p[1], 0.95, 0, Math.PI * 2); g.fill(); });
    });
  });

  global.ChartKit = {
    hatch: hatch, dots: dots,
    fn: fn, make: make, plugin: plugin, refOf: refOf, revive: revive,
    formatTick: formatTick, tickCallback: tickCallback,
    pluginOf: function(id){ return PLUGINS.hasOwnProperty(id) ? PLUGINS[id] : null; },
    plugins: function(){ return Object.keys(PLUGINS); }
  };

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
       hatch   colour of 45° lines over a bar or area block, or the area under
               a line — a hatched fill (existing plant under new build,
               curtailed output under the output, say) keyed as hatched
       hatchDir 'down' for lines falling left to right, so a second hatched
               fill (existing plant, beside curtailment) keys apart from the
               first; they rise left to right otherwise
       dots    colour of a dotted fill over a block or the area under a line
               (storage among generators, say) keyed as dotted
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
      hatch: isTransparent(s.hatch) ? null : legCss(s.hatch),
      dots: isTransparent(s.dots) ? null : legCss(s.dots),
      point: null
    };
    if(out.hatch && s.hatchDir === 'down') out.hatchDir = 'down';
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
  /* 45° lines rising left to right across a block (falling, down), cut to its
     edges, so a hatched fill keys as hatched in the swatch, the PNG and the
     SVG alike. */
  function legHatch(out, x, y, w, h, color, k, down){
    var gap = 3.2 * k;
    for(var c = gap / 2 - h; c < w; c += gap){
      var x1 = x + c, y1 = y + h, x2 = x + c + h, y2 = y;
      if(x1 < x){ y1 -= x - x1; x1 = x; }
      if(x2 > x + w){ y2 += x2 - (x + w); x2 = x + w; }
      // Falling: the same line mirrored top to bottom in the block.
      if(down){ y1 = 2 * y + h - y1; y2 = 2 * y + h - y2; }
      if(x2 - x1 > 0.3 * k) out.push({t:'line', x1:x1, y1:y1, x2:x2, y2:y2, stroke:color, sw:1 * k});
    }
  }

  /* Dots in staggered rows across a block, kept inside its edges, so a
     dotted fill keys as dotted in the swatch, the PNG and the SVG alike. */
  function legDots(out, x, y, w, h, color, k){
    var gap = 3 * k, r = 0.75 * k, row = 0;
    for(var cy = y + gap / 2; cy <= y + h - r; cy += gap, row++)
      for(var cx = x + (row % 2 ? gap : gap / 2); cx <= x + w - r; cx += gap)
        out.push({t:'circle', cx:cx, cy:cy, r:r, fill:color});
  }

  function legMarks(spec, k){
    k = k || 1;
    var s = normSpec(spec), W = LEG_W * k, H = LEG_H * k, cy = H / 2, out = [];
    var lw = Math.max(1 * k, (s.width || 0) * k);
    var dash = s.dash ? s.dash.map(function(d){ return Math.max(0.5, d * k); }) : null;

    if(s.type === 'bar'){
      var bw = W * 0.56;
      out.push({t:'rect', x:(W - bw)/2, y:cy - 4.5*k, w:bw, h:9*k, r:1.5*k, fill:s.fill || s.color});
      if(s.hatch) legHatch(out, (W - bw)/2, cy - 4.5*k, bw, 9*k, s.hatch, k, s.hatchDir === 'down');
      if(s.dots) legDots(out, (W - bw)/2, cy - 4.5*k, bw, 9*k, s.dots, k);
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
      if(s.hatch) legHatch(out, 0, cy - 4.5*k, W, 9*k, s.hatch, k, s.hatchDir === 'down');
      if(s.dots) legDots(out, 0, cy - 4.5*k, W, 9*k, s.dots, k);
    } else if(s.type !== 'point'){
      // A line, with the area under it shaded when the series is filled.
      if(s.fill) out.push({t:'rect', x:0, y:cy, w:W, h:H/2, r:0, fill:s.fill});
      if(s.fill && s.hatch) legHatch(out, 0, cy, W, H/2, s.hatch, k, s.hatchDir === 'down');
      if(s.fill && s.dots) legDots(out, 0, cy, W, H/2, s.dots, k);
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

  // Every value is escaped: a spec can arrive in a shared link (embed/).
  function legAttr(v){ return String(v).replace(/[&<>"']/g, function(c){ return '&#' + c.charCodeAt(0) + ';'; }); }
  function legSvgMarkup(spec, k){
    k = k || 1;
    return legMarks(spec, k).map(function(m){
      m = legSafe(m);
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

  function legSafe(m){
    var o = {}, k;
    for(k in m) if(Object.prototype.hasOwnProperty.call(m, k)){
      var v = m[k];
      o[k] = typeof v === 'number' || Array.isArray(v) ? v : (v == null ? v : legAttr(v));
    }
    if(o.dash) o.dash = o.dash.map(function(d){ return +d || 0; });
    if(o.pts) o.pts = o.pts.map(function(p){ return [+p[0] || 0, +p[1] || 0]; });
    return o;
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

  /* ── SharedPane: axis text on a chart of stacked panes ───────────────────
     A chart that stacks several y axes on one canvas (Financial Freedom's flows
     over its balance, the DCA price chart over its oscillators) breaks two of
     Chart.js's assumptions about axis text, and on a phone both showed:

     1. Every left axis is capped at half the width over the number of left
        axes. With a price pane and three oscillators that is an eighth of a
        phone, narrower than a title plus "-$2.00m", so the labels were drawn
        under the title and off the canvas. A stacked axis is given the width
        its own text needs instead, up to two fifths of the canvas.
     2. A title is centred on its own pane and never clipped to it, so a title
        longer than its pane is tall ("Balance, future's money" on a pane 90px
        high) runs across the pane beside it. Each title gives way in steps
        once the panes are laid out: the whole title; the same words on two
        lines, broken at ", " or " ("; then the words before the break alone.

     Wiring is one plugin, `plugins: [SharedPane.plugin]`. It only acts on
     scales that carry `stack`, so a chart without stacked axes never notices
     it. The title steps down only within one pane height (a two-line title
     makes the axis wider and the pane no taller, so it can never argue for the
     longer one), which keeps it from flipping between two frames. */
  function paneTitleSteps(full){
    var at = full.indexOf(', '), keep = 1, skip = 2;
    if(at < 0){ at = full.indexOf(' ('); keep = 0; skip = 1; }
    if(at <= 0) return [full];
    return [full, [full.slice(0, at + keep), full.slice(at + skip)], full.slice(0, at)];
  }
  function paneAxisFit(scale){
    var H = global.Chart && global.Chart.helpers;
    if(!H || !scale._getLabelSizes || !scale.ticks || !scale.ticks.length || scale.isHorizontal()) return;
    var o = scale.options;
    // A pane hidden after it was fitted (Dispatch's curtailment) keeps the hook but takes no width.
    if(o.display === false) return;
    var lines = o.title && o.title.display ? (Array.isArray(o.title.text) ? o.title.text.length : 1) : 0;
    var title = lines ? H.toFont(o.title.font).lineHeight * lines + H.toPadding(o.title.padding).height : 0;
    var tick = o.grid && o.grid.display !== false && o.grid.drawTicks !== false ? (o.grid.tickLength || 0) : 0;
    var labels = o.ticks.display === false ? 0 : scale._getLabelSizes().widest.width + (o.ticks.padding || 0) * 2;
    var need = Math.ceil(title + tick + labels);
    scale.width = Math.max(scale.width, Math.min(need, scale.chart.width * 0.4));
  }
  var PANE_PLUGIN = {
    id: 'sharedPane',
    beforeUpdate: function(chart){
      var scales = chart.options && chart.options.scales;
      if(!scales) return;
      Object.keys(scales).forEach(function(id){
        var cfg = scales[id];
        if(!cfg || !cfg.stack || cfg.display === false || cfg.afterFit) return;
        cfg.afterFit = paneAxisFit;
      });
    },
    afterLayout: function(chart){
      var H = global.Chart && global.Chart.helpers;
      if(!H || !chart.ctx || !chart.scales || !chart.options.scales) return;
      var memo = chart.$sharedPane || (chart.$sharedPane = {});
      var relayout = false;
      var lineCount = function(v){ return Array.isArray(v) ? v.length : 1; };
      Object.keys(chart.scales).forEach(function(id){
        var sc = chart.scales[id], cfg = chart.options.scales[id];
        if(!sc.options || !sc.options.stack || sc.isHorizontal() || !cfg || !cfg.title || !cfg.title.display) return;
        // The whole title is remembered on the options it came in on, so a
        // chart given new options starts again from the whole of the new one.
        if(cfg.title.$full == null || (cfg.title.$shown != null &&
           JSON.stringify(cfg.title.$shown) !== JSON.stringify(cfg.title.text))){
          cfg.title.$full = String(cfg.title.text);
        }
        var full = cfg.title.$full;
        var steps = paneTitleSteps(full);
        var room = Math.round(sc.bottom - sc.top - 4);
        var ctx = chart.ctx;
        ctx.save();
        ctx.font = H.toFont(sc.options.title.font).string;
        var pick = steps.length - 1;
        for(var i = 0; i < steps.length; i++){
          var lines = Array.isArray(steps[i]) ? steps[i] : [steps[i]];
          var widest = Math.max.apply(null, lines.map(function(l){ return ctx.measureText(l).width; }));
          if(widest <= room){ pick = i; break; }
        }
        ctx.restore();
        var key = id + '|' + full, last = memo[key];
        if(last && last.room === room) pick = Math.max(pick, last.pick);
        memo[key] = {pick: pick, room: room};
        var want = steps[pick], had = cfg.title.text;
        cfg.title.$shown = want;
        if(JSON.stringify(had) === JSON.stringify(want)) return;
        cfg.title.text = want;
        // Same line count: the axis keeps its width, so this frame can simply
        // draw the new words. A different count needs the layout run again.
        if(lineCount(had) !== lineCount(want)) relayout = true;
        else sc.options.title.text = want;
      });
      if(relayout && !chart.$sharedPaneBusy){
        chart.$sharedPaneBusy = true;
        Promise.resolve().then(function(){
          /* Stopped first: a still-running animation from the update before
             would otherwise carry on to the positions of the OLD layout after
             this one has placed every point, leaving the lines drawn off their
             own x axis (three years early on a phone). */
          try { if(chart.canvas){ chart.stop(); chart.update('none'); } } finally { chart.$sharedPaneBusy = false; }
        });
      }
    }
  };
  global.SharedPane = { plugin: PANE_PLUGIN, axisFit: paneAxisFit, titleSteps: paneTitleSteps };

  fn('SharedChartTip.external', tipHandler);
  fn('SharedPane.axisFit', paneAxisFit);
  plugin(FIT_PLUGIN);
  plugin(PANE_PLUGIN);
})(window);
