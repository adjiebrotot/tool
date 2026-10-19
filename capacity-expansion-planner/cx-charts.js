/* Capacity Expansion Planner: the charts (Chart.js), and their exports.

   Capacity     what is in service every year, by technology: the plant in
                service now hatched at the foot, what the plan builds solid
                above it, each decision year's new build marked over its
                bars, against the peak demand.
   Energy       every year's energy by source as a stacked area, any
                shortfall hatched in the demand's colour, against the demand.
   Typical days the hour-by-hour dispatch of one decision year over its
                typical days, a gap between one and the next, storage charging
                below zero, any shortfall hatched in the demand's colour,
                against the demand; under it, on the same hours, a pane of the
                sun and wind the plan had and did not use (curtailed),
                hatched in each one's colour, while there is any. Its axis
                follows the sampling:
                the hours of one day a season; a weekday and a weekend day
                under one season's name; or a week, by its days. It sits under
                Energy in the same card, folded until asked for.
   Cost         every year's costs by kind, and the levelised cost per MWh.

   The plan decides in its decision years, each standing for the years up to
   the next one, so the charts by year run over every calendar year, each at
   its decision year's figures: the bars meet, and step where a decision year
   starts. The decision years are bold on the axis, with a faint rule where
   each begins.

   A technology keeps its colour on every chart: the neutral sequence in the
   order the plan lists them, paler on each lap round it, filled as strongly
   on each (SHADE), and the demand keeps its dashed line in the text colour,
   any shortfall hatched in that colour under it. The exports follow
   the ED/UC Simulator's: a 3x PNG and an SVG around it, each with its title,
   its key and the watermark, drawn at the desktop size whatever the screen
   (SharedExport). */
(function(root){
  'use strict';
  var CX = root.CX;
  var CXCharts = root.CXCharts = {};
  var $ = function(id){ return document.getElementById(id); };
  function cssVar(n){ return getComputedStyle(document.body).getPropertyValue(n).trim(); }
  var F = CX.fmt;

  var charts = {};       // key -> Chart
  var ctx = null;        // the last render: { res, model, display }
  var CANVAS = { cap: 'capCanvas', energy: 'energyCanvas', day: 'dayCanvas', cost: 'costCanvas' };
  CXCharts.KEYS = Object.keys(CANVAS);

  /* ── Colour ── */
  function rgb(c){
    c = String(c || '').trim();
    var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
    if(m){
      var h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    m = /rgba?\(([^)]+)\)/.exec(c);
    if(m){ var p = m[1].split(/[ ,/]+/).map(Number); return [p[0], p[1], p[2]]; }
    return [128, 128, 128];
  }
  function mix(a, b, t){
    var x = rgb(a), y = rgb(b);
    return 'rgb(' + [0, 1, 2].map(function(i){ return Math.round(x[i] + (y[i] - x[i]) * t); }).join(',') + ')';
  }
  function alpha(c, a){ var v = rgb(c); return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + a + ')'; }
  // The i-th technology's colour: the neutral sequence, paler on each lap round it.
  function seriesColour(i){
    var list = SharedPalette.neutral();
    var base = list[i % list.length], lap = Math.floor(i / list.length);
    return lap ? mix(base, cssVar("--panel"), Math.min(0.7, 0.45 * lap)) : base;
  }
  CXCharts.colour = seriesColour;
  CXCharts.mix = mix;
  /* How strongly a technology's colour fills its areas (alpha(c, SHADE)) and
     its bars, which are opaque so no seam shows where two meet (mix(c, panel,
     1 - SHADE), the same colour over the chart's ground): one technology is
     one colour on every chart. */
  var SHADE = 0.55;

  /* ── Shared pieces ── */
  function techList(model, res){ return model.tech.filter(function(e){ return res.tech[e.id]; }); }
  function colourOf(model, e){ return seriesColour(model.tech.indexOf(e)); }
  function any(a){ for(var i = 0; i < a.length; i++) if(Math.abs(a[i]) > 1e-6) return true; return false; }
  function hover(id, txt){ var el = $(id); if(el) el.textContent = txt; }
  // An axis tick in MW: a whole one without the place F.mw keeps below 100 MW.
  function tickMw(v){ var t = F.mw(v); return Math.abs(v - Math.round(v)) < 1e-9 ? t.replace(/\.0$/, '') : t; }
  function axisTitle(text, muted){ return { display: true, text: text, color: muted, font: { size: 11 } }; }
  var FONT = '"DM Sans", sans-serif';
  function baseOptions(o){
    var grid = cssVar('--chart-grid'), muted = cssVar('--chart-text'), text = cssVar('--text');
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      interaction: { mode: 'index', intersect: false },
      onClick: o.onClick,
      plugins: {
        legend: { display: false },
        tooltip: SharedChartTip.options({
          backgroundColor: cssVar('--panel'), titleColor: text, bodyColor: muted,
          borderColor: grid, borderWidth: 1, padding: 10,
          filter: o.filter,
          callbacks: o.callbacks
        }),
        zoom: SharedZoom.options({ min: 0, max: Math.max(1, o.n - 1), points: o.n }),
        sharedYFit: { auto: { axes: o.fitAxes || ['y'], includeZero: true, skip: o.skip } }
      },
      scales: o.scales(grid, muted, text)
    };
  }
  /* The key. Entries that name a group are grouped: a row a group, led by its
     name, the groups in the order they first come. The group also rides in
     the entry's own text, hidden, so two entries of one name in two groups
     (Gas existing and Gas new) stay apart for a screen reader and for the
     legend a Share link carries, unless the entry says groupTag: false, as
     a key whose names never repeat does, so its links keep their names.
     A series with pairOf is keyed inside the entry of the series whose pair
     it names, under its pairLabel (the ED/UC Simulator's): the shortfall
     inside the demand's, "Demand (▨ Shortfall)", a farm's curtailment inside
     the farm's, "Wind (▨ Curtailed)", so the two wrap as one; a click on
     either shows or hides that one series, and chart.$cxPanes re-lays the
     panes. */
  function renderLegend(legendId, chart, datasets){
    var el = $(legendId);
    if(!el) return;
    el.innerHTML = '';
    var grouped = datasets.some(function(ds){ return !ds.noLegend && ds.group; }), rows = {}, order = [], hosts = {}, subs = [];
    var paren = function(s){ var p = document.createElement('span'); p.className = 'legend-paren'; p.textContent = s; return p; };
    el.classList.toggle('legend-grouped', grouped);
    // A group's entries wrap in a box of their own, so a second line of them
    // starts under the first entry rather than under the group's name.
    var rowOf = function(name){
      if(!grouped) return el;
      if(!rows[name]){
        var row = document.createElement('div'), box = document.createElement('div');
        row.className = 'legend-group';
        if(name){
          var head = document.createElement('span');
          head.className = 'legend-group-label';
          head.textContent = name + ':';
          row.appendChild(head);
        }
        box.className = 'legend-group-items';
        row.appendChild(box);
        rows[name] = box;
        order.push(row);
      }
      return rows[name];
    };
    datasets.forEach(function(ds, idx){
      if(ds.noLegend) return;
      var item = document.createElement('div');
      item.className = 'legend-item';
      if(ds.hidden) item.classList.add('hidden');
      item.addEventListener('click', function(){
        var hidden = !item.classList.contains('hidden');
        item.classList.toggle('hidden', hidden);
        chart.setDatasetVisibility(idx, !hidden);
        if(chart.$cxPanes) chart.$cxPanes();
        chart.update();
      });
      // Its host may come later (the demand comes after the shortfall), so it is keyed once all are in.
      if(ds.pairOf != null){ subs.push({ item: item, ds: ds }); return; }
      SharedLegend.attach(item, SharedLegend.specOf(ds), ds.legendLabel || ds.label);
      if(grouped && ds.group && ds.groupTag !== false){
        var tag = document.createElement('span');
        tag.className = 'vh';
        tag.textContent = ' (' + ds.group.toLowerCase() + ')';
        item.appendChild(tag);
      }
      if(ds.pair != null){ hosts[ds.pair] = item; item.setAttribute('data-pair', ds.pair); }
      rowOf(ds.group || '').appendChild(item);
    });
    subs.forEach(function(s){
      var item = s.item, ds = s.ds, host = hosts[ds.pairOf];
      SharedLegend.attach(item, SharedLegend.specOf(ds), host ? ds.pairLabel : ds.label);
      if(!host){ rowOf(ds.group || '').appendChild(item); return; }
      // The exports read data-of to key it the same way, and data-full when its host is not keyed.
      item.classList.add('legend-sub');
      item.setAttribute('data-of', ds.pairOf);
      item.setAttribute('data-full', ds.label);
      item.title = ds.label;
      item.insertBefore(paren('('), item.firstChild);
      item.appendChild(paren(')'));
      var pair = document.createElement('span');
      pair.className = 'legend-pair';
      host.parentNode.insertBefore(pair, host);
      pair.appendChild(host);
      pair.appendChild(item);
    });
    order.forEach(function(row){ el.appendChild(row); });
  }
  function make(key, cfg, legendId, extraPlugins){
    if(charts[key]) charts[key].destroy();
    cfg.plugins = [SharedZoom.plugin].concat(extraPlugins || []);
    var ch = charts[key] = new Chart($(CANVAS[key]), cfg);
    renderLegend(legendId, ch, cfg.data.datasets);
    return ch;
  }
  function lineSet(label, data, o){
    var d = { type: 'line', label: label, data: data, borderColor: cssVar('--text'), backgroundColor: 'transparent', borderWidth: 2,
              borderDash: [6, 4], pointRadius: 3, pointHoverRadius: 5, tension: 0, fill: false, order: 1, kind: 'ref' };
    for(var k in o) d[k] = o[k];
    return d;
  }
  /* The demand that goes unserved, on top of the stack up to the demand
     line: hatched in the line's own colour, with no edge of its own, so it
     reads as part of the demand and never as one more source. It keys
     inside the demand's entry, "Demand (▨ Shortfall)", its mark the demand
     line it runs up to over its hatch. */
  function shortfall(data, o){
    var ink = cssVar('--text'), wash = alpha(ink, 0.2);
    var d = { type: 'line', label: 'Shortfall (load shed)', data: data, borderColor: ink, backgroundColor: hatchFill(wash, ink), borderWidth: 0,
              pointRadius: 0, pointHoverRadius: 4, tension: 0, order: 2, kind: 'shed', pairOf: 'load', pairLabel: 'Shortfall',
              legendSpec: SharedLegend.spec({ color: ink, dash: [6, 4], width: 2, fill: wash, hatch: ink }) };
    for(var k in o) d[k] = o[k];
    return d;
  }

  /* ── The years on the axis ──
     Every calendar year of the plan, each at the figures of the decision
     year it falls in: at[i] is that decision year's index, dec the indices
     of the decision years themselves. */
  function calendar(res){
    var years = [], at = [], dec = [];
    res.periods.forEach(function(y, k){
      for(var j = 0; j < res.years[k]; j++){
        if(!j) dec.push(years.length);
        years.push(y + j);
        at.push(k);
      }
    });
    return {
      years: years, at: at, dec: dec, n: years.length,
      isDec: function(i){ return i === 0 || at[i] !== at[i - 1]; },
      spread: function(a){ return at.map(function(k){ return a[k]; }); }
    };
  }
  // The years a decision year stands for: "2031 to 2035".
  function spanOf(res, k){ var y = res.periods[k], n = res.years[k]; return n > 1 ? y + ' to ' + (y + n - 1) : String(y); }
  // A year's title: a decision year says so, any other names the decision year it falls in.
  function yearTitle(res, cal, i){ return cal.years[i] + (cal.isDec(i) ? ' (decision year)' : ' (' + res.periods[cal.at[i]] + ' decision)'); }
  /* As many years as fit the axis and the part in view: every year, else the
     decision years, else every other (third…) decision year, so the labels
     never run into each other on a phone. */
  function yearTicks(cal){
    return function(scale){
      var lo = Math.max(0, Math.ceil(scale.min)), hi = Math.min(cal.n - 1, Math.floor(scale.max)), pick = [], i, m = 1;
      var g = scale.ctx;
      g.save(); g.font = '700 11px ' + FONT;
      var each = g.measureText(String(cal.years[cal.n - 1])).width + 10;
      g.restore();
      var room = Math.max(2, Math.floor((scale.width || 600) / Math.max(24, each)));
      if(hi - lo + 1 <= room) for(i = lo; i <= hi; i++) pick.push(i);
      else {
        var dec = cal.dec.filter(function(v){ return v >= lo && v <= hi; });
        while(Math.ceil(dec.length / m) > room) m++;
        cal.dec.forEach(function(v, j){ if(v >= lo && v <= hi && j % m === 0) pick.push(v); });
        // Zoomed in between two decision years far apart: the years themselves.
        if(pick.length < 2){
          pick = [];
          m = Math.ceil((hi - lo + 1) / room);
          for(i = lo; i <= hi; i += m) pick.push(i);
        }
      }
      scale.ticks = pick.map(function(v){ return { value: v }; });
    };
  }
  // The x axis of a chart by year: the decision years bold and in the text colour.
  function yearScale(cal, muted, text, o){
    var dec = function(c){ return !!(c.tick && cal.isDec(c.tick.value)); };
    return {
      stacked: !!(o && o.stacked), offset: !(o && o.offset === false),
      title: axisTitle('Year', muted),
      grid: { display: false },
      ticks: { autoSkip: false, maxRotation: 0,
               color: function(c){ return dec(c) ? text : muted; },
               font: function(c){ return { size: 11, weight: dec(c) ? '700' : '400' }; },
               callback: function(v){ return String(cal.years[v]); } },
      afterBuildTicks: yearTicks(cal)
    };
  }
  // A faint rule where each decision year starts, behind the data.
  var PERIOD_PLUGIN = {
    id: 'cxPeriods',
    beforeDatasetsDraw: function(chart){
      var o = chart.config.options.plugins.cxPeriods;
      if(!o) return;
      var x = chart.scales.x, area = chart.chartArea, g = chart.ctx;
      g.save();
      g.strokeStyle = o.rule; g.lineWidth = 1;
      o.cal.dec.forEach(function(i){
        if(!i) return;
        var px = Math.round(x.getPixelForValue(i + o.shift)) + 0.5;
        if(px <= area.left + 1 || px >= area.right - 1) return;
        g.beginPath(); g.moveTo(px, area.top); g.lineTo(px, area.bottom); g.stroke();
      });
      g.restore();
    }
  };
  function periods(cal, shift){ return { cal: cal, shift: shift, rule: cssVar('--chart-grid') }; }
  /* Hatching: 45° lines in the colour over a pale fill of it, a tile the
     bars and areas repeat, so the lines run on unbroken from one bar into
     the next. They rise left to right (curtailment, the shortfall), or fall
     with down (the plant in service now), so the two never read as one.
     Drawn at the screen's pixel ratio, like the dots. */
  function hatchFill(fill, line, down){
    var n = 6, k = Math.max(1, Math.ceil(window.devicePixelRatio || 1)), cv = document.createElement('canvas'), g = cv.getContext('2d');
    cv.width = cv.height = n * k;
    g.scale(k, k);
    g.fillStyle = fill; g.fillRect(0, 0, n, n);
    g.strokeStyle = line; g.lineWidth = 1;
    g.beginPath();
    [-n, 0, n].forEach(function(o){ g.moveTo(o, down ? 0 : n); g.lineTo(o + n, down ? n : 0); });
    g.stroke();
    var pat = g.createPattern(cv, 'repeat');
    if(pat && pat.setTransform && root.DOMMatrix) pat.setTransform(new DOMMatrix().scale(1 / k));
    return pat;
  }
  /* A dotted fill: dots of the colour over a pale wash of it, so storage
     never reads as one more generator. The tile is drawn at the screen's
     pixel ratio, so the dots stay round and sharp. */
  function dotFill(fill, dot){
    var n = 5, k = Math.max(1, Math.ceil(window.devicePixelRatio || 1)), cv = document.createElement('canvas'), g = cv.getContext('2d');
    cv.width = cv.height = n * k;
    g.scale(k, k);
    g.fillStyle = fill; g.fillRect(0, 0, n, n);
    g.fillStyle = dot;
    [[1.25, 1.25], [3.75, 3.75]].forEach(function(p){ g.beginPath(); g.arc(p[0], p[1], 0.95, 0, Math.PI * 2); g.fill(); });
    var pat = g.createPattern(cv, 'repeat');
    if(pat && pat.setTransform && root.DOMMatrix) pat.setTransform(new DOMMatrix().scale(1 / k));
    return pat;
  }
  /* A year's bars, each meeting the next: an opaque fill a little wider
     than its bar, so no sliver shows where two meet, and a top edge only
     (EDGE_PLUGIN), so a decision year's years read as one block. hatch is
     the plant in service now: hatched, falling left to right, so it is never
     taken for a paler colour, or for curtailment, whose hatching rises. */
  function histSet(label, data, c, o){
    var hatch = o && o.hatch, fill = mix(c, cssVar('--panel'), hatch ? 0.72 : 1 - SHADE), line = alpha(c, 0.7);
    var d = { type: 'bar', label: label, data: data, backgroundColor: hatch ? hatchFill(fill, line, true) : fill, borderColor: c, edge: c,
              borderWidth: 0, inflateAmount: 0.6, stack: 's', order: 2, categoryPercentage: 1, barPercentage: 1,
              legendSpec: { type: 'bar', color: c, fill: fill, hatch: hatch ? line : null, hatchDir: 'down', width: 1.2 } };
    for(var k in o) if(k !== 'hatch') d[k] = o[k];
    return d;
  }
  /* The top edge of each bar, drawn just after its own bars. A Chart.js
     border would clip the fill to the border's box, and the overlap that
     hides the seams with it. */
  var EDGE_PLUGIN = {
    id: 'cxEdges',
    afterDatasetDraw: function(chart, args){
      var ds = chart.data.datasets[args.index], area = chart.chartArea, g = chart.ctx;
      if(!ds.edge || args.meta.type !== 'bar') return;
      g.save();
      g.beginPath(); g.rect(area.left, area.top - 2, area.right - area.left, area.bottom - area.top + 2); g.clip();
      g.strokeStyle = ds.edge; g.lineWidth = 1.2;
      g.beginPath();
      args.meta.data.forEach(function(el, i){
        if(!(Math.abs(ds.data[i]) > 1e-9)) return;
        var p = el.getProps(['x', 'y', 'width']);
        g.moveTo(p.x - p.width / 2, p.y + 0.6); g.lineTo(p.x + p.width / 2, p.y + 0.6);
      });
      g.stroke();
      g.restore();
    }
  };
  // A reference line by year with a point on each decision year only.
  function decLine(label, data, cal, o){
    var d = lineSet(label, data, o);
    d.legendSpec = SharedLegend.fromDataset(d);
    d.pointRadius = function(c){ return cal.isDec(c.dataIndex) ? 3 : 0; };
    d.pointHitRadius = 6;
    return d;
  }
  // The same over bars: flat across a decision year's years, stepping where the bars do.
  function stepLine(label, data, cal, o){
    var d = decLine(label, data, cal, o);
    d.stepped = 'middle';
    return d;
  }
  // A click on a year opens its decision year's typical days.
  function yearClick(cal){
    return function(evt, els, chart){
      if(!ctx || !ctx.onYear) return;
      var v = chart.scales.x.getValueForPixel(evt.x);
      if(!isFinite(v)) return;
      ctx.onYear(cal.at[Math.max(0, Math.min(cal.n - 1, Math.round(v)))]);
    };
  }
  // What a decision year builds or retires, largest first: "800 MW of Wind, 400 MW of Battery".
  function changes(res, model, k, key){
    return techList(model, res).filter(function(e){ return res.tech[e.id][key][k] >= 0.05; })
      .sort(function(a, b){ return res.tech[b.id][key][k] - res.tech[a.id][key][k]; })
      .map(function(e){ return F.mw(res.tech[e.id][key][k]) + ' MW of ' + CX.nameOf(e); }).join(', ');
  }

  /* ── Capacity, and when to build ── */
  /* Each decision year's new build over its bars ("+800 MW"), from the
     entries still showing, where the years it stands for leave room. */
  var BUILT_PLUGIN = {
    id: 'cxBuilt',
    afterDatasetsDraw: function(chart){
      var o = chart.config.options.plugins.cxBuilt;
      if(!o) return;
      var x = chart.scales.x, area = chart.chartArea, g = chart.ctx, cal = o.cal, sets = chart.data.datasets;
      g.save();
      g.beginPath(); g.rect(area.left, 0, area.right - area.left, area.bottom); g.clip();
      g.font = '600 10.5px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'bottom';
      g.lineJoin = 'round'; g.lineWidth = 3; g.strokeStyle = o.halo; g.fillStyle = o.text;
      cal.dec.forEach(function(i){
        var k = cal.at[i], mw = 0, top = area.bottom;
        sets.forEach(function(ds, di){
          if(ds.type !== 'bar' || !chart.isDatasetVisible(di)) return;
          var el = chart.getDatasetMeta(di).data[i];
          if(el && ds.data[i] > 1e-6) top = Math.min(top, el.y);
          if(ds.kind === 'new') mw += o.res.tech[ds.id].built[k];
        });
        if(!(mw >= 0.05)) return;
        var l = Math.max(area.left, x.getPixelForValue(i - 0.5)), r = Math.min(area.right, x.getPixelForValue(i + o.res.years[k] - 0.5));
        var txt = '+' + F.mw(mw) + ' MW';
        if(g.measureText(txt).width > r - l - 4) txt = '+' + F.mw(mw);
        if(g.measureText(txt).width > r - l - 4) return;
        g.strokeText(txt, (l + r) / 2, top - 3);
        g.fillText(txt, (l + r) / 2, top - 3);
      });
      g.restore();
    }
  };
  function capChart(res, model, d){
    var cal = calendar(res), labels = cal.years.map(String), ds = [], T = res.totals, techs = techList(model, res);
    // The plant in service now at the foot, what the plan builds above it.
    techs.forEach(function(e){
      var t = res.tech[e.id], c = colourOf(model, e);
      if(any(t.exist)) ds.push(histSet(CX.nameOf(e) + ', existing', cal.spread(t.exist), c, { id: e.id, kind: 'exist', hatch: true, group: 'Existing', legendLabel: CX.nameOf(e) }));
    });
    techs.forEach(function(e){
      var t = res.tech[e.id], c = colourOf(model, e), nw = t.cap.map(function(v, k){ return Math.max(0, v - t.exist[k]); });
      if(any(nw)) ds.push(histSet(CX.nameOf(e) + ', new build', cal.spread(nw), c, { id: e.id, kind: 'new', group: 'New build', legendLabel: CX.nameOf(e) }));
    });
    ds.push(stepLine('Peak demand', cal.spread(T.peak), cal, { group: 'Demand' }));
    var op = baseOptions({ n: cal.n, onClick: yearClick(cal),
      filter: function(item){ return Math.abs(item.parsed.y) > 1e-6 || item.dataset.kind === 'ref'; },
      skip: function(x){ return x.kind === 'ref'; },
      callbacks: {
        title: function(items){ return items.length ? yearTitle(res, cal, items[0].dataIndex) : ''; },
        label: function(c){ return '  ' + c.dataset.label + ': ' + F.mw(c.parsed.y) + ' MW'; },
        afterBody: function(items){
          if(!items.length) return;
          var k = cal.at[items[0].dataIndex], tot = 0;
          res.order.forEach(function(id){ tot += res.tech[id].cap[k]; });
          var built = changes(res, model, k, 'built'), gone = changes(res, model, k, 'retired');
          hover('capHover', spanOf(res, k) + '  |  ' + F.mw(tot) + ' MW in service for a ' + F.mw(T.peak[k]) + ' MW peak, ' +
            F.mw(T.firm[k]) + ' MW of it firm or storage.' + (built ? ' ' + res.periods[k] + ' builds ' + built + '.' : '') +
            (gone ? ' Retired by then: ' + gone + '.' : ''));
        }
      },
      scales: function(grid, muted, text){
        return { x: yearScale(cal, muted, text, { stacked: true }),
                 y: { stacked: true, beginAtZero: true, title: axisTitle('Capacity (MW)', muted), ticks: { color: muted, font: { size: 11 }, callback: function(v){ return F.mw(v); } }, grid: { color: grid } } };
      } });
    op.plugins.cxPeriods = periods(cal, -0.5);
    op.plugins.cxBuilt = { cal: cal, res: res, text: cssVar('--text'), halo: cssVar('--panel') };
    op.layout = { padding: { top: 16 } };
    make('cap', { type: 'bar', data: { labels: labels, datasets: ds }, options: op }, 'capLegend', [PERIOD_PLUGIN, EDGE_PLUGIN, BUILT_PLUGIN]);
    $('capSub').textContent = 'What is in service each year, storage at its power rating. The plan builds in the decision years, in bold, each standing for the years up to the next' +
      (T.built >= 0.05 ? ', with what each builds over its bars' : ', and here builds nothing') + '. Click a year for its typical days.';
  }

  /* ── Energy by source ── */
  function energyChart(res, model, d){
    var cal = calendar(res), labels = cal.years.map(String), ds = [], T = res.totals;
    var gwh = function(a){ return cal.spread(a).map(function(v){ return v / 1000; }); };
    var area = function(label, data, c, o){
      var x = { type: 'line', label: label, data: data, borderColor: c, backgroundColor: alpha(c, SHADE), borderWidth: 1.2,
                pointRadius: 0, pointHoverRadius: 4, pointHitRadius: 6, tension: 0, stack: 'e', order: 2 };
      for(var k in o) x[k] = o[k];
      return x;
    };
    techList(model, res).forEach(function(e){
      var t = res.tech[e.id];
      if(!any(t.gen)) return;
      ds.push(area(CX.nameOf(e) + (e.kind === 'store' ? ' (discharge)' : ''), gwh(t.gen), colourOf(model, e), { id: e.id }));
    });
    if(any(T.shedEnergy)) ds.push(shortfall(gwh(T.shedEnergy), { stack: 'e', pointHitRadius: 6 }));
    // Each layer fills down to the one under it; its key shows it as a block.
    ds.forEach(function(x, i){
      x.fill = i ? i - 1 : 'origin';
      var shown = {}; for(var key in x) shown[key] = x[key];
      shown.fill = 'origin';
      x.legendSpec = x.legendSpec || SharedLegend.fromDataset(shown);
    });
    ds.push(decLine('Demand', gwh(T.energy), cal, { stack: 'load', pair: 'load' }));
    var op = baseOptions({ n: cal.n, onClick: yearClick(cal),
      filter: function(item){ return Math.abs(item.parsed.y) > 1e-9 || item.dataset.kind === 'ref'; },
      skip: function(x){ return x.kind === 'ref'; },
      callbacks: {
        title: function(items){ return items.length ? yearTitle(res, cal, items[0].dataIndex) : ''; },
        label: function(c){ return '  ' + c.dataset.label + ': ' + F.gwh(c.parsed.y * 1000) + ' GWh'; },
        afterBody: function(items){
          if(!items.length) return;
          var k = cal.at[items[0].dataIndex];
          hover('energyHover', spanOf(res, k) + '  |  demand ' + F.gwh(T.energy[k]) + ' GWh a year, ' + F.pct(T.gen[k] > 0 ? 100 * T.cleanGen[k] / T.gen[k] : NaN) + '% of generation free of CO2, ' +
            F.co2(T.emis[k]) + ' of CO2' + (T.curtail[k] > 1 ? ', ' + F.gwh(T.curtail[k]) + ' GWh of sun and wind spilled' : '') + (T.shedEnergy[k] > 1e-3 ? ', ' + F.gwh(T.shedEnergy[k]) + ' GWh shed' : ''));
        }
      },
      scales: function(grid, muted, text){
        return { x: yearScale(cal, muted, text, { offset: false }),
                 y: { stacked: true, beginAtZero: true, title: axisTitle('Energy (GWh a year)', muted), ticks: { color: muted, font: { size: 11 }, callback: function(v){ return F.gwh(v * 1000); } }, grid: { color: grid } } };
      } });
    op.plugins.cxPeriods = periods(cal, 0);
    make('energy', { type: 'line', data: { labels: labels, datasets: ds }, options: op }, 'energyLegend', [PERIOD_PLUGIN]);
    var stores = model.tech.some(function(e){ return e.kind === 'store' && res.tech[e.id] && any(res.tech[e.id].gen); });
    $('energySub').textContent = 'Each year’s energy by source, a decision year standing for the years up to the next.' +
      (stores ? ' Storage counts what it gives back, so its losses stand the area a little above demand.' : '') + ' Click a year to see its typical days below.';
  }

  /* ── Typical days: one decision year, hour by hour ── */
  function two(n){ return (n < 10 ? '0' : '') + n; }
  function dayLabels(res){
    var out = [];
    res.blocks.forEach(function(b){
      for(var i = 0; i < b.len; i++){
        var day = Math.floor(i / 24), h = i % 24;
        out.push(b.name + (b.len > 24 ? ', ' + CX.DAYS[day] : '') + ' ' + two(h) + ':00');
      }
    });
    return out;
  }
  /* Where each sampled hour stands on the axis. The typical days are days
     apart, not one run of time, so a gap stands between them, about as wide
     whatever the sampling (a week runs on unbroken inside itself): hourAt[p]
     is the hour at place p, or -1 in a gap, and from[i] where block i starts. */
  function dayAxis(res){
    var gap = Math.max(1, Math.round(res.H / 60)), hourAt = [], from = [];
    res.blocks.forEach(function(b, i){
      if(i) for(var g = 0; g < gap; g++) hourAt.push(-1);
      from.push(hourAt.length);
      for(var t = b.from; t < b.from + b.len; t++) hourAt.push(t);
    });
    return { n: hourAt.length, gap: gap, hourAt: hourAt, from: from,
             spread: function(a, f){ return hourAt.map(function(t){ return t < 0 ? null : f ? f(a[t]) : a[t]; }); } };
  }
  /* The hours of the day on the axis, as many as fit its width and the part
     in view: every hour up to every other day, always on the clock's hours,
     so the labels never run into each other on a phone. */
  var STEPS = [1, 2, 3, 6, 12, 24, 48];
  function clockTicks(ax){
    return function(scale){
      var lo = Math.max(0, Math.ceil(scale.min)), hi = Math.min(ax.n - 1, Math.floor(scale.max));
      var room = Math.max(2, Math.floor((scale.width || 600) / 56)), step = STEPS[STEPS.length - 1];
      for(var i = 0; i < STEPS.length; i++) if((hi - lo) / STEPS[i] <= room){ step = STEPS[i]; break; }
      var ticks = [];
      for(var v = lo; v <= hi; v++){
        var t = ax.hourAt[v];
        if(t >= 0 && (step < 24 ? (t % 24) % step === 0 : t % step === 0)) ticks.push({ value: v });
      }
      // A label that would stand past the right end of the axis is left off.
      var px = (scale.width || 600) / Math.max(1, hi - lo);
      while(ticks.length > 1 && (hi - ticks[ticks.length - 1].value) * px < 18) ticks.pop();
      if(ticks.length) scale.ticks = ticks;
    };
  }
  /* The axis of a sampling. One day a season: the clock. A weekday and a
     weekend day: each named under its middle. A week: each day's name at its
     00:00. Zoomed in to a day or two, any of them shows the clock again (a
     week's midnights by their day). text holds each tick's label, centre the
     ticks that sit mid-block, which draw no grid line. */
  function dayTicks(ax, res){
    var mode = res.sample || 'day', clock = clockTicks(ax), st = { text: {}, centre: {} }, wdAt = [];
    res.blocks.forEach(function(b){ for(var t = b.from; t < b.from + b.len; t++) wdAt[t] = ((b.wd || 0) + Math.floor((t - b.from) / 24)) % 7; });
    st.build = function(scale){
      var lo = Math.max(0, Math.ceil(scale.min)), hi = Math.min(ax.n - 1, Math.floor(scale.max)), width = scale.width || 600, ticks = [], v, t;
      st.text = {}; st.centre = {}; st.small = false;
      if(mode === 'week' && hi - lo > 60){
        var room = Math.max(2, Math.floor(width / 28)), days = 0;
        for(v = lo; v <= hi; v++){ t = ax.hourAt[v]; if(t >= 0 && t % 24 === 0) days++; }
        var step = days <= room ? 1 : days / 2 <= room ? 2 : 7;
        for(v = lo; v <= hi; v++){
          t = ax.hourAt[v];
          if(t >= 0 && t % 24 === 0 && wdAt[t] % step === 0){ ticks.push({ value: v }); st.text[v] = CX.DAYS[wdAt[t]]; }
        }
      } else if(mode === 'day2' && hi - lo > 36){
        res.blocks.forEach(function(b, i){
          v = ax.from[i] + 12;
          if(v < lo || v > hi) return;
          ticks.push({ value: v }); st.text[v] = b.day; st.centre[v] = 1;
        });
        // Narrower than the names: shortened, never left out, so a weekend is never read as a weekday.
        var each = width / Math.max(1, ticks.length);
        if(each < 58) ticks.forEach(function(k){ st.text[k.value] = each < 34 ? (st.text[k.value] === 'Weekend' ? 'WE' : 'WD') : st.text[k.value] === 'Weekend' ? 'Wkend' : 'Wkday'; });
        st.small = each < 58;
      } else {
        clock(scale);
        scale.ticks.forEach(function(k){ var h = ax.hourAt[k.value]; st.text[k.value] = mode === 'week' && h % 24 === 0 ? CX.DAYS[wdAt[h]] : two(h % 24) + ':00'; });
        return;
      }
      if(ticks.length) scale.ticks = ticks;
    };
    return st;
  }
  // The typical days named over the plot, one name over the days of a season, with a rule down each gap between seasons.
  var BLOCK_PLUGIN = {
    id: 'cxBlocks',
    afterDatasetsDraw: function(chart){
      var b = chart.config.options.plugins.cxBlocks;
      if(!b) return;
      var x = chart.scales.x, area = chart.chartArea, g = chart.ctx, groups = [];
      b.blocks.forEach(function(bl, i){
        var last = groups[groups.length - 1];
        if(last && last.name === bl.group){ last.to = bl.from + bl.len; return; }
        groups.push({ name: bl.group, short: bl.short, from: bl.from, to: bl.from + bl.len, first: i });
      });
      g.save();
      g.font = '600 11px "DM Sans", sans-serif';
      g.textBaseline = 'top';
      groups.forEach(function(gr, i){
        var x0 = x.getPixelForValue(gr.from - 0.5), x1 = x.getPixelForValue(gr.to - 0.5);
        var mid = x.getPixelForValue(gr.from - (b.gap + 1) / 2);
        if(i > 0 && mid >= area.left && mid <= area.right){
          g.strokeStyle = b.rule; g.lineWidth = 1; g.setLineDash([3, 3]);
          g.beginPath(); g.moveTo(mid, area.top); g.lineTo(mid, area.bottom); g.stroke();
        }
        if(x1 < area.left || x0 > area.right) return;
        var l = Math.max(area.left, x0), r = Math.min(area.right, x1), w = r - l, txt = gr.name;
        g.fillStyle = b.text;
        if(g.measureText(txt).width > w - 8) txt = gr.short;
        if(g.measureText(txt).width <= w - 8){ g.textAlign = 'center'; g.fillText(txt, (l + r) / 2, area.top + 4); }
      });
      g.restore();
    }
  };
  /* The curtailment pane sits under the typical days, on the same hours,
     while any farm's curtailment is showing in the key (the ED/UC
     Simulator's Dispatch); hide every one and the dispatch has the whole
     chart back. The caller updates the chart. */
  var CURT_SUB = ' Under them, the sun and wind the plan had and did not use (curtailed).';
  function dayPanes(chart){
    var sc = chart.options.scales, wrap = chart.canvas && chart.canvas.parentElement;
    if(!sc.yCurt) return;
    var curt = chart.data.datasets.some(function(d, i){ return d.kind === 'curt' && chart.isDatasetVisible(i); });
    sc.y.stack = sc.yCurt.stack = sc.yCurtGap.stack = curt ? 'cxDay' : undefined;
    // Chart.js scales an axis by its weight in a stack or out of one, so it only has one in it.
    sc.y.stackWeight = curt ? 3 : 1;
    sc.yCurt.display = curt;
    $('daySub').textContent = chart.$cxSub[0] + (curt ? CURT_SUB : '') + chart.$cxSub[1];
    if(wrap && wrap.classList.contains('has-curt') !== curt){
      wrap.classList.toggle('has-curt', curt);
      chart.resize();
    }
  }
  function dayChart(res, model, d){
    var k = Math.max(0, Math.min(res.periods.length - 1, d.year | 0)), ax = dayAxis(res), ds = [], T = res.totals, o = res.report.opts;
    var year = res.periods[k], hourLabels = dayLabels(res), labels = ax.spread(hourLabels).map(function(l){ return l || ''; });
    var pos = function(v){ return Math.max(0, v); }, neg = function(v){ return Math.min(0, v); };
    // Cheapest to run at the bottom, as a merit order.
    var merit = function(a, b){ return CX.runCost(a, o, year) - CX.runCost(b, o, year) || model.tech.indexOf(a) - model.tech.indexOf(b); };
    var gens = techList(model, res).filter(function(e){ return e.kind !== 'store' && any(res.tech[e.id].p[k]); });
    gens.sort(merit);
    var stores = techList(model, res).filter(function(e){ return e.kind === 'store' && any(res.tech[e.id].p[k]); });
    gens.forEach(function(e){
      var c = colourOf(model, e);
      ds.push({ label: CX.nameOf(e), data: ax.spread(res.tech[e.id].p[k], pos), borderColor: c, backgroundColor: alpha(c, SHADE),
                borderWidth: 1.2, pointRadius: 0, pointHoverRadius: 4, tension: 0, stack: 'gen', order: 2, kind: 'gen', id: e.id, group: 'Generator', groupTag: false, pair: e.id });
    });
    stores.forEach(function(e){
      var c = colourOf(model, e);
      ds.push({ label: CX.nameOf(e) + ' discharging', data: ax.spread(res.tech[e.id].p[k], pos), borderColor: c, backgroundColor: dotFill(alpha(c, 0.3), c),
                borderWidth: 1.2, pointRadius: 0, pointHoverRadius: 4, tension: 0, stack: 'gen', order: 2, kind: 'dis', id: e.id, group: 'Storage', groupTag: false,
                dots: { fill: alpha(c, 0.3), dot: c } });
      ds.push({ label: CX.nameOf(e) + ' charging', data: ax.spread(res.tech[e.id].p[k], neg), borderColor: c, backgroundColor: dotFill(alpha(c, 0.12), alpha(c, 0.6)),
                borderWidth: 1.2, borderDash: [4, 3], pointRadius: 0, pointHoverRadius: 4, tension: 0, stack: 'store', order: 2, kind: 'chg', id: e.id, group: 'Storage', groupTag: false,
                dots: { fill: alpha(c, 0.12), dot: alpha(c, 0.6) } });
    });
    if(any(res.shed[k])) ds.push(shortfall(ax.spread(res.shed[k]), { stack: 'gen', group: 'Demand', groupTag: false }));
    /* What each farm had and did not use, the way the totals count it (sun
       and wind only), stacked in merit order in the pane under the dispatch,
       in the farm's own colour, hatched. Only farms curtailed at all. */
    var curts = 0, curtAt = res.load[k].map(function(){ return 0; });
    techList(model, res).filter(function(e){ return e.kind === 'pv' || e.kind === 'wind'; }).sort(merit).forEach(function(e){
      var t = res.tech[e.id], cap = t.cap[k], sum = 0;
      if(!t.avail || !(cap > 0)) return;
      // A thousandth of a MW is the solver's tolerance, not power left unused.
      var spill = t.avail.map(function(a, h){ var v = a * cap - t.p[k][h]; return v > 1e-3 ? v : 0; });
      spill.forEach(function(v){ sum += v; });
      if(!(sum > 0)) return;
      spill.forEach(function(v, h){ curtAt[h] += v; });
      var c = colourOf(model, e), wash = alpha(c, 0.25);
      ds.push({ label: CX.nameOf(e) + ' curtailed', data: ax.spread(spill), borderColor: c, backgroundColor: hatchFill(wash, c),
                borderWidth: 1.2, pointRadius: 0, pointHoverRadius: 4, tension: 0, stack: 'curt', yAxisID: 'yCurt', order: 2, kind: 'curt', id: e.id,
                group: 'Generator', groupTag: false, pairOf: e.id, pairLabel: 'Curtailed', hatch: { fill: wash, line: c } });
      curts++;
    });
    // Each layer fills down to the layer under it in its own stack.
    var lastIn = {};
    ds.forEach(function(x, i){
      x.fill = lastIn[x.stack] === undefined ? 'origin' : lastIn[x.stack];
      lastIn[x.stack] = i;
      var shown = {}; for(var key in x) shown[key] = x[key];
      shown.fill = 'origin';
      // A pattern is no colour a swatch can read: a dotted or hatched fill keys as one.
      x.legendSpec = x.legendSpec || SharedLegend.fromDataset(shown, x.dots ? { fill: x.dots.fill, dots: x.dots.dot } : x.hatch ? { fill: x.hatch.fill, hatch: x.hatch.line } : null);
    });
    ds.push({ label: 'Demand', data: ax.spread(res.load[k]), borderColor: cssVar('--text'), backgroundColor: 'transparent',
              borderWidth: 2, borderDash: [6, 4], pointRadius: 0, pointHoverRadius: 4, tension: 0, fill: false, stack: 'load', order: 1, kind: 'load', group: 'Demand', groupTag: false, pair: 'load' });
    // Named, because Chart.js puts a series that names no axis on the first one defined, which is the curtailment's.
    ds.forEach(function(x){ if(x.kind !== 'curt') x.yAxisID = 'y'; });
    // The chart opens on its panes (dayPanes keeps them after), its box already the height they take.
    $(CANVAS.day).parentElement.classList.toggle('has-curt', curts > 0);
    var short = function(b){ return b.stress ? 'Still day' : (b.group || b.name).replace(' season', ''); };
    var mode = res.sample || 'day', ticks = dayTicks(ax, res);
    var AXIS = { day: 'Typical days, hour by hour', day2: 'A weekday and a weekend day a season, hour by hour', week: 'Typical weeks, day by day' };
    // SharedPane keeps each pane's axis text inside it, the curtailment pane's under the dispatch.
    var ch = make('day', {
      type: 'line', data: { labels: labels, datasets: ds },
      options: (function(){
        var op = baseOptions({ n: ax.n, fitAxes: ['y', 'yCurt'],
          filter: function(item){ return Math.abs(item.parsed.y) > 1e-9 || item.dataset.kind === 'load'; },
          skip: function(x){ return x.kind === 'load'; },
          callbacks: {
            title: function(items){ return items.length ? labels[items[0].dataIndex] : ''; },
            label: function(c){ return '  ' + c.dataset.label + ': ' + F.mw(c.parsed.y) + ' MW'; },
            afterBody: function(items){
              var t = items.length ? ax.hourAt[items[0].dataIndex] : -1, gsum = 0, ssum = 0;
              if(t < 0) return;
              gens.forEach(function(e){ gsum += Math.max(0, res.tech[e.id].p[k][t]); });
              stores.forEach(function(e){ ssum += res.tech[e.id].p[k][t]; });
              hover('dayHover', year + ', ' + hourLabels[t] + '  |  demand ' + F.mw(res.load[k][t]) + ' MW, generation ' + F.mw(gsum) + ' MW' +
                (Math.abs(ssum) > 1e-6 ? ', storage ' + F.mw(ssum) + ' MW' : '') + (res.shed[k][t] > 1e-6 ? ', shed ' + F.mw(res.shed[k][t]) + ' MW' : '') +
                (curtAt[t] > 0 ? ', curtailed ' + F.mw(curtAt[t]) + ' MW' : '') +
                '. Each hour stands for ' + F.pct(res.w[t]) + ' hours of the year.');
            }
          },
          scales: function(grid, muted){
            var s = {
              x: { title: axisTitle(AXIS[mode] || AXIS.day, muted),
                   ticks: { color: muted, maxRotation: 0, autoSkip: false, font: function(){ return { size: ticks.small ? 10 : 11 }; },
                            callback: function(v){ return ticks.text[v] !== undefined ? ticks.text[v] : two(ax.hourAt[v] % 24) + ':00'; } },
                   afterBuildTicks: ticks.build,
                   grid: { color: function(c){ return c.tick && ticks.centre[c.tick.value] ? 'transparent' : grid; } } }
            };
            /* The curtailment pane stacks under the dispatch on one canvas:
               Chart.js stacks a group's axes in the order they are defined,
               the bottom one first, then a spacer so the two read as two
               pictures. dayPanes() puts them in the stack only while there
               is curtailment to show. */
            if(curts){
              s.yCurt = { position: 'left', stack: 'cxDay', stacked: true, stackWeight: 1, title: axisTitle('Curtailed (MW)', muted),
                          // Few ticks, and no label on the top one (the axis rounds its top to a
                          // tick), so its labels never meet the dispatch's across the join on a phone.
                          ticks: { color: muted, font: { size: 11 }, maxTicksLimit: 4, includeBounds: false,
                                   callback: function(v, i, all){ return i === all.length - 1 && all.length > 2 ? '' : tickMw(v); } }, grid: { color: grid } };
              s.yCurtGap = { position: 'left', stack: 'cxDay', stackWeight: 0.12, min: 0, max: 1, display: false,
                             ticks: { display: false }, grid: { display: false, drawTicks: false }, border: { display: false } };
            }
            s.y = { stack: curts ? 'cxDay' : undefined, stacked: true, stackWeight: curts ? 3 : 1, title: axisTitle('Power (MW)', muted),
                    ticks: { color: muted, font: { size: 11 }, callback: tickMw }, grid: { color: grid } };
            return s;
          } });
        op.plugins.cxBlocks = { blocks: res.blocks.map(function(b, i){ return { from: ax.from[i], len: b.len, name: b.name, group: b.group || b.name, short: short(b) }; }),
                                gap: ax.gap, text: cssVar('--chart-text'), rule: cssVar('--chart-grid') };
        op.layout = { padding: { top: 18 } };
        return op;
      })()
    }, 'dayLegend', [BLOCK_PLUGIN, SharedPane.plugin]);
    ch.options.scales.y.stacked = true;
    var over = { day: 'its typical days', day2: 'a weekday and a weekend day of each season', week: 'a typical week of each season' }[mode] || 'its typical days';
    ch.$cxSub = [year + ' hour by hour over ' + over + ', cheapest to run at the bottom' + (stores.length ? ', storage charging below zero' : '') + '.', ' Pick another year above the chart.'];
    $('daySub').textContent = ch.$cxSub[0] + (curts ? CURT_SUB : '') + ch.$cxSub[1];
    ch.$cxPanes = function(){ dayPanes(ch); };
  }

  /* ── Cost by year ── */
  function costChart(res, model, d){
    var cal = calendar(res), labels = cal.years.map(String), T = res.totals, cur = d.cur, pal = SharedPalette.neutral(), ds = [];
    var m = function(a){ return cal.spread(a).map(function(v){ return v / 1e6; }); };
    var parts = [['Capital (annuities)', T.capex, pal[0]], ['Fixed O&M', T.fom, pal[1 % pal.length]], ['Fuel and running', T.vom, pal[2 % pal.length]],
                 ['Carbon', T.co2cost, pal[3 % pal.length]]];
    parts.forEach(function(p){ if(any(p[1])) ds.push(histSet(p[0], m(p[1]), p[2], {})); });
    if(any(T.shedCost)) ds.push(histSet('Lost load cost', m(T.shedCost), cssVar('--negative'), { kind: 'shed' }));
    var avg = T.cost.map(function(c, k){ return T.served[k] > 0 ? c / T.served[k] : NaN; });
    ds.push(stepLine('Levelised cost', cal.spread(avg), cal, { yAxisID: 'y2', borderDash: [], kind: 'ref' }));
    var u = cur ? cur + ' m' : 'millions';
    var op = baseOptions({ n: cal.n, onClick: yearClick(cal), fitAxes: ['y', 'y2'],
      filter: function(item){ return Math.abs(item.parsed.y) > 1e-9 || item.dataset.kind === 'ref'; },
      skip: function(x){ return x.kind === 'ref'; },
      callbacks: {
        title: function(items){ return items.length ? yearTitle(res, cal, items[0].dataIndex) : ''; },
        label: function(c){ return c.dataset.yAxisID === 'y2' ? '  ' + c.dataset.label + ': ' + F.price(c.parsed.y, cur) + '/MWh' : '  ' + c.dataset.label + ': ' + F.big(c.parsed.y * 1e6, cur); },
        afterBody: function(items){
          if(!items.length) return;
          var k = cal.at[items[0].dataIndex];
          hover('costHover', spanOf(res, k) + '  |  ' + F.big(T.cost[k], cur) + ' a year, ' + F.price(avg[k], cur) + ' per MWh served');
        }
      },
      scales: function(grid, muted, text){
        return { x: yearScale(cal, muted, text, { stacked: true }),
                 y: { stacked: true, beginAtZero: true, title: axisTitle('Cost (' + u + ' a year)', muted), ticks: { color: muted, font: { size: 11 }, callback: function(v){ return F.big(v * 1e6, ''); } }, grid: { color: grid } },
                 y2: { position: 'right', beginAtZero: true, title: axisTitle('Levelised cost (' + (cur || '') + '/MWh)', muted), ticks: { color: muted, font: { size: 11 }, callback: function(v){ return F.money(v, cur); } }, grid: { drawOnChartArea: false } } };
      } });
    op.plugins.cxPeriods = periods(cal, -0.5);
    make('cost', { type: 'bar', data: { labels: labels, datasets: ds }, options: op }, 'costLegend', [PERIOD_PLUGIN, EDGE_PLUGIN]);
    $('costSub').textContent = 'Each year’s costs at today’s prices and not discounted, a decision year standing for the years up to the next, with the levelised cost per MWh served on the right (capital as its annuity at the discount rate).';
  }

  /* ── Render all, or clear ── */
  CXCharts.ok = function(){ return typeof Chart !== 'undefined'; };
  CXCharts.render = function(res, model, d, onYear){
    var show = {};
    if(!res || !res.report || !res.report.ok){ CXCharts.clear(); return show; }
    if(!CXCharts.ok()) return show;
    ctx = { res: res, model: model, display: d, onYear: onYear };
    capChart(res, model, d); show.cap = true;
    energyChart(res, model, d); show.energy = true;
    dayChart(res, model, d); show.day = true;
    costChart(res, model, d); show.cost = true;
    return show;
  };
  // The typical days of another year, without redrawing the rest.
  CXCharts.year = function(k){
    if(!ctx) return;
    ctx.display.year = k;
    dayChart(ctx.res, ctx.model, ctx.display);
  };
  CXCharts.clear = function(){ Object.keys(charts).forEach(function(k){ charts[k].destroy(); delete charts[k]; }); ctx = null; };
  CXCharts.get = function(k){ return charts[k] || null; };
  CXCharts.resetZoom = function(k){ var c = charts[k]; if(c && c.resetZoom) c.resetZoom(); };

  /* ── Exports ── */
  function exportTokens(){
    var light = document.body.classList.contains('light');
    return { bg: light ? '#ffffff' : '#0F1728', fg: light ? '#2D3436' : '#EAF1FF' };
  }
  function saveBlob(blob, filename){
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
  }
  /* The exported key, packed into rows. A grouped key exports the way it
     reads on the page: each group starts a row of its own, led by its name,
     with only the entries still showing (financialfreedom's). A row carries
     head (the name, or null where it continues a group) and headW, which is
     inside its width; grouped rows share one left edge, so the names line up. */
  function legendRows(legendId, measure, maxW, markW, gap, pad){
    var el = $(legendId), out = [];
    if(!el) return out;
    var groups = el.querySelectorAll('.legend-group');
    if(!groups.length){
      var items = keyItems(el);
      return items.length ? packKey(items, measure, maxW, markW, gap, pad) : [];
    }
    var headOf = function(g){ var lab = g.querySelector('.legend-group-label'); return lab ? lab.textContent.trim() : ''; };
    // One column for the names, as wide as the widest, so every row's entries start in line.
    var headW = Math.max.apply(null, Array.prototype.map.call(groups, function(g){ var h = headOf(g); return h ? measure(h, true) + pad / 2 : 0; }));
    Array.prototype.forEach.call(groups, function(g){
      var items = keyItems(g), head = headOf(g);
      if(!items.length) return;
      packKey(items, measure, maxW - headW, markW, gap, pad).forEach(function(row, i){
        out.push({ items: row.items, head: i === 0 ? head : null, headW: headW, width: row.width + headW });
      });
    });
    var widest = Math.max.apply(null, out.map(function(r){ return r.width; }));
    out.forEach(function(r){ r.width = widest; });
    return out;
  }
  /* A key's visible entries, with the mark each draws. An entry keyed inside
     another's (the shortfall, a farm's curtailment) rides in it as sub, so it
     exports as it reads on the page, "Demand (▨ Shortfall)"; with its host
     not exported it is an entry of its own under its whole name. */
  function keyItems(box){
    var out = [];
    Array.prototype.forEach.call(box.querySelectorAll('.legend-item:not(.hidden)'), function(el){
      var lab = el.querySelector('.legend-label'), spec = null;
      try { spec = JSON.parse(el.getAttribute('data-swatch')); } catch(e){ spec = null; }
      var label = (lab ? lab.textContent : el.textContent).trim(), prev = out[out.length - 1], of = el.getAttribute('data-of');
      if(!spec || !label) return;
      if(of != null && prev && prev.pair === of && !prev.sub){ prev.sub = { swatch: spec, label: label }; return; }
      out.push({ label: el.getAttribute('data-full') || label, swatch: spec, pair: el.getAttribute('data-pair') });
    });
    return out;
  }
  /* One exported entry from x: its swatch and label, and the entry keyed
     inside it after them, " (▨ Shortfall)". swatch(spec, x) and text(s, x)
     draw it; without them it is only measured. Returns its width. */
  function keyEntry(item, x, measure, markW, gap, swatch, text){
    var x0 = x, lab = item.sub ? item.label + ' (' : item.label;
    if(swatch) swatch(item.swatch, x);
    x += markW + gap;
    if(text) text(lab, x);
    x += measure(lab);
    if(item.sub){
      x += gap / 2;
      if(swatch) swatch(item.sub.swatch, x);
      x += markW + gap;
      if(text) text(item.sub.label + ')', x);
      x += measure(item.sub.label + ')');
    }
    return x - x0;
  }
  // SharedLegend.layout for these entries: as many centred rows as they need.
  function packKey(items, measure, maxW, markW, gap, pad){
    var rows = [], row = [], w = 0;
    items.forEach(function(it){
      var iw = keyEntry(it, 0, measure, markW, gap);
      if(row.length && w + pad + iw > maxW){ rows.push({ items: row, width: w }); row = []; w = 0; }
      w += (row.length ? pad : 0) + iw;
      row.push(it);
    });
    if(row.length) rows.push({ items: row, width: w });
    return rows;
  }
  var wmLogoImg = new Image();
  CX.WM_PATH_W = 330.01;
  CX.WM_LOGO_SRC = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 680 680"><circle cx="340" cy="340" r="300" fill="#0052cc"/><g fill="none" stroke="#fff" stroke-width="46"><path d="M242 570A250 250 0 0 1 234 113"/><path d="M234 113A250 250 0 0 1 446 113"/><path d="M446 113A250 250 0 0 1 438 570"/></g><line x1="113" y1="354" x2="567" y2="354" stroke="#fff" stroke-width="42" stroke-linecap="round"/></svg>');
  wmLogoImg.src = CX.WM_LOGO_SRC;
  // A 3x PNG of the chart at its desktop size, with its title, key and watermark.
  function chartPng(key, chartTitle){
    var canvasId = CANVAS[key], legendId = key + 'Legend';
    return SharedExport.atDesktopSize(canvasId, function(){
      var src = $(canvasId);
      var dpr = window.devicePixelRatio || 1, OUT = 3;
      var chartW = Math.round(src.width / dpr * OUT), chartH = Math.round(src.height / dpr * OUT);
      var tone = exportTokens(), FONT = '"DM Sans", sans-serif';
      var titleH = Math.round(40 * OUT), markW = SharedLegend.W * OUT, gap = Math.round(7 * OUT), pad = Math.round(20 * OUT);
      var margin = Math.round(16 * OUT), rowH = Math.round(22 * OUT), wmH = Math.round(26 * OUT);
      var mc = document.createElement('canvas').getContext('2d');
      var keyFont = '500 ' + Math.round(11 * OUT) + 'px ' + FONT, headFont = '600 ' + Math.round(11 * OUT) + 'px ' + FONT;
      var measure = function(s, head){ mc.font = head ? headFont : keyFont; return mc.measureText(s).width; };
      var rows = legendRows(legendId, measure, chartW - margin * 2, markW, gap, pad);
      var legendH = rows.length ? rows.length * rowH + Math.round(8 * OUT) : 0;
      var c = document.createElement('canvas');
      c.width = chartW; c.height = chartH + titleH + legendH + wmH;
      var g = c.getContext('2d');
      g.fillStyle = tone.bg; g.fillRect(0, 0, c.width, c.height);
      g.font = '700 ' + Math.round(14 * OUT) + 'px ' + FONT; g.fillStyle = tone.fg; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(chartTitle, c.width / 2, titleH / 2);
      g.drawImage(src, 0, titleH, chartW, chartH);
      g.font = keyFont;
      rows.forEach(function(row, ri){
        var x = Math.max(margin, (c.width - row.width) / 2), cy = titleH + chartH + Math.round(4 * OUT) + rowH * ri + rowH / 2;
        if(row.head){ g.font = headFont; g.fillStyle = tone.fg; g.textAlign = 'left'; g.fillText(row.head, x, cy); g.font = keyFont; }
        x += row.headW || 0;
        row.items.forEach(function(item){
          x += keyEntry(item, x, measure, markW, gap, function(spec, at){ SharedLegend.paint(g, spec, at, cy, OUT); },
                        function(t, at){ g.fillStyle = tone.fg; g.textAlign = 'left'; g.fillText(t, at, cy); }) + pad;
        });
      });
      g.save();
      g.globalAlpha = 0.22;
      var wmX = c.width - Math.round(12 * OUT) - CX.WM_PATH_W * OUT, wmY = c.height - Math.round(12 * OUT);
      g.translate(wmX, wmY); g.scale(OUT, OUT); g.fillStyle = '#1a1a1a'; g.fill(new Path2D(CX.WM_PATH));
      g.restore();
      if(wmLogoImg.complete && wmLogoImg.naturalWidth){
        g.save(); g.globalAlpha = 0.22;
        var ls = Math.round(13 * OUT);
        g.drawImage(wmLogoImg, wmX - Math.round(4 * OUT) - ls, wmY - ls + Math.round(2 * OUT), ls, ls);
        g.restore();
      }
      return new Promise(function(resolve, reject){ c.toBlob(function(b){ if(b) resolve(b); else reject(new Error('The image could not be made.')); }, 'image/png'); });
    });
  }
  // An SVG around the chart's bitmap, with live text for the title and key.
  function chartSvg(key, chartTitle){
    var canvasId = CANVAS[key], legendId = key + 'Legend';
    return SharedExport.atDesktopSize(canvasId, function(){
      var src = $(canvasId);
      var dpr = window.devicePixelRatio || 1;
      var chartW = Math.round(src.width / dpr), chartH = Math.round(src.height / dpr);
      var tone = exportTokens(), FONT = 'DM Sans, sans-serif';
      var titleH = 40, markW = SharedLegend.W, gap = 7, pad = 20, margin = 16, rowH = 22, wmH = 26;
      var mc = document.createElement('canvas').getContext('2d');
      var measure = function(s, head){ mc.font = (head ? '600' : '500') + ' 11px DM Sans, sans-serif'; return mc.measureText(s).width; };
      var rows = legendRows(legendId, measure, chartW - margin * 2, markW, gap, pad);
      var legendH = rows.length ? rows.length * rowH + 8 : 0;
      var W = chartW, Hh = chartH + titleH + legendH + wmH;
      var NS = 'http://www.w3.org/2000/svg', xl = 'http://www.w3.org/1999/xlink';
      var svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('xmlns', NS); svg.setAttribute('xmlns:xlink', xl);
      svg.setAttribute('width', W); svg.setAttribute('height', Hh); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + Hh);
      var bg = document.createElementNS(NS, 'rect'); bg.setAttribute('width', W); bg.setAttribute('height', Hh); bg.setAttribute('fill', tone.bg); svg.appendChild(bg);
      var text = function(str, x, y, o){
        var t = document.createElementNS(NS, 'text');
        t.setAttribute('x', x); t.setAttribute('y', y); t.setAttribute('dominant-baseline', 'middle'); t.setAttribute('font-family', FONT);
        t.setAttribute('font-size', o.size); t.setAttribute('font-weight', o.weight); t.setAttribute('fill', tone.fg);
        if(o.anchor) t.setAttribute('text-anchor', o.anchor);
        t.textContent = str; svg.appendChild(t);
      };
      text(chartTitle, W / 2, titleH / 2, { size: '14', weight: '700', anchor: 'middle' });
      var img = document.createElementNS(NS, 'image');
      img.setAttribute('x', 0); img.setAttribute('y', titleH); img.setAttribute('width', chartW); img.setAttribute('height', chartH);
      var href = src.toDataURL('image/png');
      img.setAttribute('href', href); img.setAttributeNS(xl, 'href', href);
      svg.appendChild(img);
      rows.forEach(function(row, ri){
        var x = Math.max(margin, (W - row.width) / 2), cy = titleH + chartH + 4 + rowH * ri + rowH / 2;
        if(row.head) text(row.head, x, cy, { size: '11', weight: '600' });
        x += row.headW || 0;
        row.items.forEach(function(item){
          x += keyEntry(item, x, measure, markW, gap, function(spec, at){ svg.appendChild(SharedLegend.svgNode(spec, at, cy, 1)); },
                        function(t, at){ text(t, at, cy, { size: '11', weight: '500' }); }) + pad;
        });
      });
      var wm = document.createElementNS(NS, 'path');
      wm.setAttribute('d', CX.WM_PATH);
      wm.setAttribute('transform', 'translate(' + (W - 12 - CX.WM_PATH_W) + ',' + (Hh - 12) + ')');
      wm.setAttribute('fill', '#1a1a1a'); wm.setAttribute('opacity', '0.22');
      svg.appendChild(wm);
      var logo = document.createElementNS(NS, 'image');
      logo.setAttribute('href', CX.WM_LOGO_SRC); logo.setAttributeNS(xl, 'href', CX.WM_LOGO_SRC);
      logo.setAttribute('width', 13); logo.setAttribute('height', 13);
      logo.setAttribute('x', W - 12 - CX.WM_PATH_W - 4 - 13); logo.setAttribute('y', Hh - 12 - 13 + 2); logo.setAttribute('opacity', '0.22');
      svg.appendChild(logo);
      return new Blob(['<?xml version="1.0" encoding="utf-8"?>\n' + new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' });
    });
  }
  CXCharts.png = chartPng;
  CXCharts.svg = chartSvg;
  CXCharts.save = saveBlob;
  // The watermark, "Made using tool.adjiebrotots.com/capacity-expansion-planner" baked to DM Sans 500
  // glyph outlines by _ref/bake-watermark.py. Edit there and re-run, not here.
  CX.WM_PATH = "M0.82 0V-7.7H2.12L4.66 -2.48L7.19 -7.7H8.49V0H7.39V-5.76L5.08 -1.04H4.24L1.92 -5.74V0ZM11.9 0.13Q11.24 0.13 10.79 -0.11Q10.35 -0.35 10.13 -0.75Q9.91 -1.15 9.91 -1.62Q9.91 -2.17 10.19 -2.56Q10.47 -2.96 11 -3.17Q11.53 -3.38 12.26 -3.38H13.68Q13.68 -3.89 13.55 -4.23Q13.43 -4.57 13.15 -4.74Q12.87 -4.9 12.42 -4.9Q11.94 -4.9 11.61 -4.68Q11.27 -4.45 11.19 -4H10.09Q10.15 -4.58 10.48 -4.98Q10.8 -5.39 11.31 -5.6Q11.82 -5.82 12.42 -5.82Q13.2 -5.82 13.73 -5.54Q14.25 -5.27 14.52 -4.77Q14.78 -4.27 14.78 -3.58V0H13.82L13.73 -0.94Q13.62 -0.72 13.45 -0.52Q13.28 -0.33 13.05 -0.18Q12.83 -0.03 12.54 0.05Q12.25 0.13 11.9 0.13ZM12.11 -0.76Q12.45 -0.76 12.73 -0.91Q13.01 -1.05 13.22 -1.31Q13.42 -1.56 13.54 -1.87Q13.65 -2.19 13.66 -2.54V-2.6H12.37Q11.9 -2.6 11.61 -2.49Q11.32 -2.37 11.19 -2.16Q11.06 -1.95 11.06 -1.69Q11.06 -1.4 11.19 -1.2Q11.31 -0.99 11.55 -0.88Q11.78 -0.76 12.11 -0.76ZM18.67 0.13Q17.9 0.13 17.3 -0.25Q16.71 -0.64 16.38 -1.31Q16.05 -1.99 16.05 -2.84Q16.05 -3.71 16.38 -4.38Q16.72 -5.05 17.32 -5.43Q17.92 -5.82 18.71 -5.82Q19.35 -5.82 19.83 -5.56Q20.31 -5.31 20.59 -4.84V-7.92H21.69V0H20.7L20.6 -0.87Q20.43 -0.61 20.17 -0.38Q19.91 -0.15 19.54 -0.01Q19.17 0.13 18.67 0.13ZM18.87 -0.82Q19.39 -0.82 19.77 -1.07Q20.16 -1.32 20.37 -1.78Q20.58 -2.23 20.58 -2.84Q20.58 -3.46 20.37 -3.91Q20.16 -4.37 19.77 -4.61Q19.39 -4.86 18.87 -4.86Q18.38 -4.86 18 -4.61Q17.61 -4.37 17.39 -3.91Q17.17 -3.46 17.17 -2.85Q17.17 -2.23 17.39 -1.78Q17.61 -1.32 18 -1.07Q18.38 -0.82 18.87 -0.82ZM25.7 0.13Q24.91 0.13 24.3 -0.24Q23.69 -0.61 23.35 -1.27Q23 -1.94 23 -2.83Q23 -3.72 23.34 -4.4Q23.68 -5.07 24.3 -5.44Q24.91 -5.82 25.71 -5.82Q26.55 -5.82 27.12 -5.45Q27.7 -5.08 28.01 -4.46Q28.31 -3.84 28.31 -3.09Q28.31 -2.98 28.31 -2.86Q28.31 -2.74 28.3 -2.59H23.81V-3.36H27.22Q27.2 -4.1 26.77 -4.5Q26.34 -4.91 25.7 -4.91Q25.26 -4.91 24.89 -4.7Q24.53 -4.49 24.3 -4.08Q24.08 -3.67 24.08 -3.05V-2.74Q24.08 -2.11 24.3 -1.67Q24.52 -1.23 24.88 -1.01Q25.25 -0.78 25.69 -0.78Q26.24 -0.78 26.57 -1Q26.9 -1.22 27.05 -1.61H28.16Q28.01 -1.11 27.68 -0.72Q27.34 -0.32 26.84 -0.1Q26.34 0.13 25.7 0.13ZM34.49 0.13Q33.84 0.13 33.36 -0.12Q32.89 -0.37 32.63 -0.88Q32.37 -1.4 32.37 -2.16V-5.69H33.47V-2.29Q33.47 -1.54 33.81 -1.17Q34.16 -0.8 34.78 -0.8Q35.2 -0.8 35.54 -1Q35.87 -1.19 36.07 -1.56Q36.27 -1.94 36.27 -2.48V-5.69H37.37V0H36.39L36.31 -0.92Q36.08 -0.43 35.6 -0.15Q35.12 0.13 34.49 0.13ZM41.04 0.13Q40.28 0.13 39.75 -0.11Q39.22 -0.34 38.94 -0.77Q38.66 -1.19 38.6 -1.75H39.72Q39.76 -1.48 39.92 -1.26Q40.07 -1.03 40.35 -0.9Q40.63 -0.76 41.04 -0.76Q41.4 -0.76 41.64 -0.87Q41.88 -0.97 42 -1.16Q42.12 -1.34 42.12 -1.58Q42.12 -1.9 41.97 -2.07Q41.82 -2.25 41.53 -2.35Q41.24 -2.44 40.82 -2.5Q40.37 -2.58 40 -2.69Q39.63 -2.81 39.36 -3Q39.08 -3.19 38.94 -3.48Q38.79 -3.77 38.79 -4.17Q38.79 -4.65 39.04 -5.02Q39.3 -5.4 39.78 -5.61Q40.26 -5.82 40.91 -5.82Q41.87 -5.82 42.42 -5.38Q42.98 -4.95 43.08 -4.16H42.02Q41.96 -4.52 41.67 -4.72Q41.38 -4.92 40.9 -4.92Q40.4 -4.92 40.14 -4.74Q39.88 -4.55 39.88 -4.24Q39.88 -4.02 40.01 -3.85Q40.14 -3.68 40.42 -3.56Q40.71 -3.44 41.17 -3.37Q41.82 -3.27 42.28 -3.1Q42.74 -2.93 42.99 -2.59Q43.25 -2.26 43.24 -1.66Q43.24 -1.1 42.97 -0.7Q42.69 -0.3 42.2 -0.08Q41.71 0.13 41.04 0.13ZM44.65 0V-5.69H45.75V0ZM45.2 -6.69Q44.89 -6.69 44.68 -6.89Q44.48 -7.09 44.48 -7.39Q44.48 -7.69 44.68 -7.88Q44.89 -8.07 45.2 -8.07Q45.51 -8.07 45.72 -7.88Q45.93 -7.69 45.93 -7.39Q45.93 -7.09 45.72 -6.89Q45.51 -6.69 45.2 -6.69ZM47.35 0V-5.69H48.33L48.4 -4.77Q48.65 -5.26 49.13 -5.54Q49.61 -5.82 50.24 -5.82Q50.89 -5.82 51.37 -5.56Q51.84 -5.31 52.1 -4.79Q52.36 -4.28 52.36 -3.51V0H51.26V-3.4Q51.26 -4.13 50.91 -4.51Q50.57 -4.88 49.94 -4.88Q49.53 -4.88 49.19 -4.69Q48.85 -4.49 48.65 -4.12Q48.45 -3.74 48.45 -3.2V0ZM56.14 2.55Q55.35 2.55 54.77 2.36Q54.18 2.17 53.85 1.77Q53.53 1.38 53.53 0.8Q53.53 0.49 53.66 0.18Q53.8 -0.13 54.09 -0.41Q54.39 -0.68 54.89 -0.9L55.55 -0.41Q54.96 -0.19 54.77 0.1Q54.57 0.4 54.57 0.69Q54.57 1.02 54.77 1.24Q54.97 1.46 55.32 1.57Q55.67 1.68 56.13 1.68Q56.58 1.68 56.91 1.56Q57.23 1.45 57.41 1.23Q57.59 1.01 57.59 0.72Q57.59 0.32 57.32 0.08Q57.06 -0.15 56.27 -0.19Q55.64 -0.24 55.19 -0.32Q54.75 -0.4 54.45 -0.5Q54.14 -0.61 53.94 -0.75Q53.73 -0.88 53.58 -1.02V-1.28L54.7 -2.39L55.62 -2.09L54.38 -0.99L54.61 -1.5Q54.73 -1.42 54.84 -1.35Q54.96 -1.28 55.15 -1.22Q55.33 -1.16 55.66 -1.11Q55.99 -1.06 56.52 -1.02Q57.29 -0.96 57.75 -0.76Q58.22 -0.55 58.43 -0.19Q58.64 0.17 58.64 0.68Q58.64 1.16 58.38 1.58Q58.12 2.01 57.56 2.28Q57.01 2.55 56.14 2.55ZM56.13 -1.75Q55.43 -1.75 54.94 -2.01Q54.45 -2.28 54.19 -2.75Q53.93 -3.21 53.93 -3.78Q53.93 -4.36 54.19 -4.81Q54.45 -5.27 54.94 -5.55Q55.44 -5.82 56.13 -5.82Q56.84 -5.82 57.33 -5.55Q57.82 -5.27 58.08 -4.81Q58.33 -4.36 58.33 -3.78Q58.33 -3.21 58.08 -2.75Q57.82 -2.28 57.33 -2.01Q56.84 -1.75 56.13 -1.75ZM56.13 -2.62Q56.69 -2.62 57 -2.91Q57.32 -3.2 57.32 -3.78Q57.32 -4.35 57 -4.64Q56.69 -4.93 56.13 -4.93Q55.6 -4.93 55.26 -4.64Q54.93 -4.35 54.93 -3.78Q54.93 -3.2 55.25 -2.91Q55.58 -2.62 56.13 -2.62ZM57.08 -4.82 56.81 -5.69H59.08V-4.94ZM65.36 0Q64.84 0 64.45 -0.16Q64.06 -0.33 63.85 -0.71Q63.65 -1.1 63.65 -1.76V-4.76H62.66V-5.69H63.65L63.78 -7.14H64.75V-5.69H66.33V-4.76H64.75V-1.75Q64.75 -1.28 64.94 -1.11Q65.14 -0.94 65.62 -0.94H66.3V0ZM70.12 0.13Q69.32 0.13 68.7 -0.24Q68.08 -0.61 67.73 -1.28Q67.38 -1.95 67.38 -2.84Q67.38 -3.74 67.73 -4.41Q68.08 -5.08 68.71 -5.45Q69.34 -5.82 70.13 -5.82Q70.94 -5.82 71.56 -5.45Q72.18 -5.08 72.53 -4.41Q72.88 -3.74 72.88 -2.84Q72.88 -1.95 72.53 -1.28Q72.17 -0.61 71.55 -0.24Q70.93 0.13 70.12 0.13ZM70.12 -0.81Q70.58 -0.81 70.95 -1.04Q71.32 -1.27 71.54 -1.72Q71.76 -2.17 71.76 -2.84Q71.76 -3.52 71.54 -3.97Q71.33 -4.42 70.96 -4.65Q70.59 -4.87 70.14 -4.87Q69.69 -4.87 69.31 -4.65Q68.94 -4.42 68.72 -3.97Q68.5 -3.52 68.5 -2.84Q68.5 -2.17 68.72 -1.72Q68.94 -1.27 69.3 -1.04Q69.67 -0.81 70.12 -0.81ZM76.73 0.13Q75.93 0.13 75.31 -0.24Q74.69 -0.61 74.34 -1.28Q73.99 -1.95 73.99 -2.84Q73.99 -3.74 74.34 -4.41Q74.7 -5.08 75.32 -5.45Q75.95 -5.82 76.75 -5.82Q77.55 -5.82 78.17 -5.45Q78.79 -5.08 79.14 -4.41Q79.49 -3.74 79.49 -2.84Q79.49 -1.95 79.14 -1.28Q78.78 -0.61 78.16 -0.24Q77.54 0.13 76.73 0.13ZM76.73 -0.81Q77.19 -0.81 77.56 -1.04Q77.93 -1.27 78.15 -1.72Q78.37 -2.17 78.37 -2.84Q78.37 -3.52 78.15 -3.97Q77.94 -4.42 77.57 -4.65Q77.21 -4.87 76.75 -4.87Q76.3 -4.87 75.93 -4.65Q75.55 -4.42 75.33 -3.97Q75.11 -3.52 75.11 -2.84Q75.11 -2.17 75.33 -1.72Q75.55 -1.27 75.91 -1.04Q76.28 -0.81 76.73 -0.81ZM80.81 0V-7.92H81.91V0ZM83.9 0.05Q83.59 0.05 83.39 -0.15Q83.18 -0.35 83.18 -0.64Q83.18 -0.94 83.39 -1.14Q83.59 -1.34 83.9 -1.34Q84.22 -1.34 84.42 -1.14Q84.62 -0.94 84.62 -0.64Q84.62 -0.35 84.42 -0.15Q84.22 0.05 83.9 0.05ZM87.71 0.13Q87.04 0.13 86.59 -0.11Q86.15 -0.35 85.93 -0.75Q85.71 -1.15 85.71 -1.62Q85.71 -2.17 85.99 -2.56Q86.27 -2.96 86.8 -3.17Q87.33 -3.38 88.06 -3.38H89.48Q89.48 -3.89 89.35 -4.23Q89.23 -4.57 88.95 -4.74Q88.67 -4.9 88.22 -4.9Q87.74 -4.9 87.41 -4.68Q87.07 -4.45 86.99 -4H85.89Q85.95 -4.58 86.28 -4.98Q86.6 -5.39 87.11 -5.6Q87.62 -5.82 88.22 -5.82Q89 -5.82 89.53 -5.54Q90.05 -5.27 90.32 -4.77Q90.58 -4.27 90.58 -3.58V0H89.62L89.53 -0.94Q89.42 -0.72 89.25 -0.52Q89.08 -0.33 88.85 -0.18Q88.63 -0.03 88.34 0.05Q88.05 0.13 87.71 0.13ZM87.91 -0.76Q88.25 -0.76 88.53 -0.91Q88.81 -1.05 89.02 -1.31Q89.23 -1.56 89.34 -1.87Q89.45 -2.19 89.46 -2.54V-2.6H88.17Q87.7 -2.6 87.41 -2.49Q87.12 -2.37 86.99 -2.16Q86.87 -1.95 86.87 -1.69Q86.87 -1.4 86.99 -1.2Q87.11 -0.99 87.35 -0.88Q87.58 -0.76 87.91 -0.76ZM94.47 0.13Q93.7 0.13 93.1 -0.25Q92.51 -0.64 92.18 -1.31Q91.85 -1.99 91.85 -2.84Q91.85 -3.71 92.18 -4.38Q92.52 -5.05 93.12 -5.43Q93.72 -5.82 94.51 -5.82Q95.15 -5.82 95.63 -5.56Q96.11 -5.31 96.39 -4.84V-7.92H97.49V0H96.5L96.4 -0.87Q96.23 -0.61 95.97 -0.38Q95.71 -0.15 95.34 -0.01Q94.97 0.13 94.47 0.13ZM94.67 -0.82Q95.19 -0.82 95.57 -1.07Q95.96 -1.32 96.17 -1.78Q96.38 -2.23 96.38 -2.84Q96.38 -3.46 96.17 -3.91Q95.96 -4.37 95.57 -4.61Q95.19 -4.86 94.67 -4.86Q94.18 -4.86 93.8 -4.61Q93.41 -4.37 93.19 -3.91Q92.97 -3.46 92.97 -2.85Q92.97 -2.23 93.19 -1.78Q93.41 -1.32 93.8 -1.07Q94.18 -0.82 94.67 -0.82ZM97.96 2.42V1.48H98.39Q98.79 1.48 98.96 1.32Q99.12 1.16 99.12 0.77V-5.69H100.22V0.79Q100.22 1.37 100.03 1.73Q99.83 2.08 99.46 2.25Q99.09 2.42 98.56 2.42ZM99.68 -6.69Q99.37 -6.69 99.16 -6.89Q98.96 -7.09 98.96 -7.39Q98.96 -7.69 99.16 -7.88Q99.37 -8.07 99.68 -8.07Q99.99 -8.07 100.2 -7.88Q100.4 -7.69 100.4 -7.39Q100.4 -7.09 100.2 -6.89Q99.99 -6.69 99.68 -6.69ZM101.88 0V-5.69H102.98V0ZM102.44 -6.69Q102.12 -6.69 101.92 -6.89Q101.71 -7.09 101.71 -7.39Q101.71 -7.69 101.92 -7.88Q102.12 -8.07 102.44 -8.07Q102.74 -8.07 102.95 -7.88Q103.16 -7.69 103.16 -7.39Q103.16 -7.09 102.95 -6.89Q102.74 -6.69 102.44 -6.69ZM107.06 0.13Q106.27 0.13 105.66 -0.24Q105.06 -0.61 104.71 -1.27Q104.37 -1.94 104.37 -2.83Q104.37 -3.72 104.71 -4.4Q105.05 -5.07 105.66 -5.44Q106.28 -5.82 107.08 -5.82Q107.91 -5.82 108.49 -5.45Q109.07 -5.08 109.37 -4.46Q109.68 -3.84 109.68 -3.09Q109.68 -2.98 109.68 -2.86Q109.68 -2.74 109.66 -2.59H105.18V-3.36H108.59Q108.56 -4.1 108.13 -4.5Q107.71 -4.91 107.07 -4.91Q106.63 -4.91 106.26 -4.7Q105.89 -4.49 105.67 -4.08Q105.45 -3.67 105.45 -3.05V-2.74Q105.45 -2.11 105.67 -1.67Q105.89 -1.23 106.25 -1.01Q106.62 -0.78 107.06 -0.78Q107.61 -0.78 107.94 -1Q108.26 -1.22 108.42 -1.61H109.52Q109.38 -1.11 109.05 -0.72Q108.71 -0.32 108.21 -0.1Q107.71 0.13 107.06 0.13ZM113.95 0.13Q113.46 0.13 113.09 -0.01Q112.73 -0.15 112.47 -0.37Q112.2 -0.6 112.04 -0.84L111.93 0H110.94V-7.92H112.04V-4.82Q112.31 -5.29 112.8 -5.55Q113.29 -5.82 113.93 -5.82Q114.72 -5.82 115.32 -5.44Q115.92 -5.05 116.25 -4.39Q116.58 -3.72 116.58 -2.86Q116.58 -2 116.25 -1.32Q115.92 -0.64 115.33 -0.26Q114.74 0.13 113.95 0.13ZM113.76 -0.82Q114.25 -0.82 114.63 -1.07Q115.02 -1.32 115.24 -1.77Q115.46 -2.23 115.46 -2.84Q115.46 -3.46 115.24 -3.91Q115.02 -4.37 114.63 -4.61Q114.25 -4.86 113.76 -4.86Q113.25 -4.86 112.86 -4.61Q112.47 -4.37 112.26 -3.91Q112.05 -3.46 112.05 -2.84Q112.05 -2.23 112.26 -1.77Q112.47 -1.32 112.86 -1.07Q113.25 -0.82 113.76 -0.82ZM117.9 0V-5.69H118.89L118.98 -4.65Q119.18 -5.03 119.49 -5.29Q119.8 -5.55 120.24 -5.68Q120.67 -5.82 121.2 -5.82V-4.66H120.66Q120.33 -4.66 120.03 -4.58Q119.74 -4.5 119.5 -4.3Q119.27 -4.11 119.14 -3.79Q119 -3.46 119 -2.96V0ZM124.78 0.13Q123.98 0.13 123.36 -0.24Q122.73 -0.61 122.38 -1.28Q122.03 -1.95 122.03 -2.84Q122.03 -3.74 122.39 -4.41Q122.74 -5.08 123.37 -5.45Q124 -5.82 124.79 -5.82Q125.6 -5.82 126.22 -5.45Q126.84 -5.08 127.19 -4.41Q127.54 -3.74 127.54 -2.84Q127.54 -1.95 127.18 -1.28Q126.83 -0.61 126.21 -0.24Q125.58 0.13 124.78 0.13ZM124.78 -0.81Q125.24 -0.81 125.61 -1.04Q125.98 -1.27 126.2 -1.72Q126.41 -2.17 126.41 -2.84Q126.41 -3.52 126.2 -3.97Q125.99 -4.42 125.62 -4.65Q125.25 -4.87 124.79 -4.87Q124.35 -4.87 123.97 -4.65Q123.6 -4.42 123.38 -3.97Q123.16 -3.52 123.16 -2.84Q123.16 -2.17 123.38 -1.72Q123.59 -1.27 123.96 -1.04Q124.33 -0.81 124.78 -0.81ZM131.18 0Q130.66 0 130.27 -0.16Q129.89 -0.33 129.68 -0.71Q129.47 -1.1 129.47 -1.76V-4.76H128.48V-5.69H129.47L129.61 -7.14H130.57V-5.69H132.15V-4.76H130.57V-1.75Q130.57 -1.28 130.77 -1.11Q130.96 -0.94 131.45 -0.94H132.13V0ZM135.94 0.13Q135.14 0.13 134.52 -0.24Q133.9 -0.61 133.55 -1.28Q133.2 -1.95 133.2 -2.84Q133.2 -3.74 133.55 -4.41Q133.91 -5.08 134.53 -5.45Q135.16 -5.82 135.96 -5.82Q136.77 -5.82 137.39 -5.45Q138 -5.08 138.35 -4.41Q138.7 -3.74 138.7 -2.84Q138.7 -1.95 138.35 -1.28Q137.99 -0.61 137.37 -0.24Q136.75 0.13 135.94 0.13ZM135.94 -0.81Q136.4 -0.81 136.77 -1.04Q137.14 -1.27 137.36 -1.72Q137.58 -2.17 137.58 -2.84Q137.58 -3.52 137.37 -3.97Q137.15 -4.42 136.79 -4.65Q136.42 -4.87 135.96 -4.87Q135.51 -4.87 135.14 -4.65Q134.77 -4.42 134.54 -3.97Q134.32 -3.52 134.32 -2.84Q134.32 -2.17 134.54 -1.72Q134.76 -1.27 135.13 -1.04Q135.49 -0.81 135.94 -0.81ZM142.35 0Q141.82 0 141.44 -0.16Q141.05 -0.33 140.84 -0.71Q140.64 -1.1 140.64 -1.76V-4.76H139.65V-5.69H140.64L140.77 -7.14H141.74V-5.69H143.32V-4.76H141.74V-1.75Q141.74 -1.28 141.93 -1.11Q142.13 -0.94 142.61 -0.94H143.29V0ZM146.72 0.13Q145.95 0.13 145.43 -0.11Q144.9 -0.34 144.62 -0.77Q144.34 -1.19 144.28 -1.75H145.39Q145.44 -1.48 145.59 -1.26Q145.75 -1.03 146.03 -0.9Q146.31 -0.76 146.72 -0.76Q147.07 -0.76 147.31 -0.87Q147.55 -0.97 147.68 -1.16Q147.8 -1.34 147.8 -1.58Q147.8 -1.9 147.65 -2.07Q147.5 -2.25 147.21 -2.35Q146.92 -2.44 146.5 -2.5Q146.05 -2.58 145.68 -2.69Q145.31 -2.81 145.03 -3Q144.76 -3.19 144.61 -3.48Q144.46 -3.77 144.46 -4.17Q144.46 -4.65 144.72 -5.02Q144.98 -5.4 145.46 -5.61Q145.93 -5.82 146.59 -5.82Q147.54 -5.82 148.1 -5.38Q148.66 -4.95 148.76 -4.16H147.7Q147.64 -4.52 147.35 -4.72Q147.06 -4.92 146.58 -4.92Q146.08 -4.92 145.82 -4.74Q145.56 -4.55 145.56 -4.24Q145.56 -4.02 145.68 -3.85Q145.81 -3.68 146.1 -3.56Q146.39 -3.44 146.85 -3.37Q147.49 -3.27 147.96 -3.1Q148.42 -2.93 148.67 -2.59Q148.92 -2.26 148.92 -1.66Q148.92 -1.1 148.64 -0.7Q148.37 -0.3 147.88 -0.08Q147.39 0.13 146.72 0.13ZM150.72 0.05Q150.4 0.05 150.2 -0.15Q150 -0.35 150 -0.64Q150 -0.94 150.2 -1.14Q150.4 -1.34 150.72 -1.34Q151.04 -1.34 151.23 -1.14Q151.43 -0.94 151.43 -0.64Q151.43 -0.35 151.23 -0.15Q151.04 0.05 150.72 0.05ZM155.25 0.13Q154.45 0.13 153.82 -0.24Q153.19 -0.62 152.84 -1.29Q152.48 -1.95 152.48 -2.83Q152.48 -3.73 152.84 -4.4Q153.19 -5.07 153.82 -5.44Q154.45 -5.82 155.25 -5.82Q156.27 -5.82 156.95 -5.28Q157.63 -4.75 157.82 -3.83H156.68Q156.57 -4.33 156.17 -4.6Q155.78 -4.88 155.24 -4.88Q154.78 -4.88 154.4 -4.64Q154.03 -4.41 153.82 -3.96Q153.61 -3.51 153.61 -2.84Q153.61 -2.35 153.73 -1.97Q153.85 -1.58 154.07 -1.32Q154.29 -1.07 154.59 -0.93Q154.89 -0.8 155.24 -0.8Q155.6 -0.8 155.9 -0.92Q156.19 -1.05 156.4 -1.29Q156.61 -1.53 156.68 -1.86H157.82Q157.64 -0.96 156.95 -0.41Q156.26 0.13 155.25 0.13ZM161.67 0.13Q160.87 0.13 160.25 -0.24Q159.63 -0.61 159.28 -1.28Q158.93 -1.95 158.93 -2.84Q158.93 -3.74 159.28 -4.41Q159.64 -5.08 160.26 -5.45Q160.89 -5.82 161.69 -5.82Q162.5 -5.82 163.11 -5.45Q163.73 -5.08 164.08 -4.41Q164.43 -3.74 164.43 -2.84Q164.43 -1.95 164.08 -1.28Q163.72 -0.61 163.1 -0.24Q162.48 0.13 161.67 0.13ZM161.67 -0.81Q162.13 -0.81 162.5 -1.04Q162.87 -1.27 163.09 -1.72Q163.31 -2.17 163.31 -2.84Q163.31 -3.52 163.1 -3.97Q162.88 -4.42 162.52 -4.65Q162.15 -4.87 161.69 -4.87Q161.24 -4.87 160.87 -4.65Q160.49 -4.42 160.27 -3.97Q160.05 -3.52 160.05 -2.84Q160.05 -2.17 160.27 -1.72Q160.49 -1.27 160.86 -1.04Q161.22 -0.81 161.67 -0.81ZM165.75 0V-5.69H166.74L166.81 -4.91Q167.07 -5.33 167.52 -5.58Q167.96 -5.82 168.49 -5.82Q168.9 -5.82 169.24 -5.71Q169.57 -5.59 169.83 -5.37Q170.08 -5.14 170.24 -4.8Q170.54 -5.29 171.03 -5.55Q171.52 -5.82 172.08 -5.82Q172.74 -5.82 173.21 -5.56Q173.68 -5.3 173.92 -4.78Q174.17 -4.27 174.17 -3.5V0H173.08V-3.39Q173.08 -4.13 172.77 -4.51Q172.45 -4.88 171.88 -4.88Q171.49 -4.88 171.18 -4.68Q170.87 -4.49 170.69 -4.1Q170.51 -3.72 170.51 -3.17V0H169.42V-3.39Q169.42 -4.13 169.1 -4.51Q168.78 -4.88 168.21 -4.88Q167.84 -4.88 167.53 -4.68Q167.22 -4.49 167.04 -4.1Q166.85 -3.72 166.85 -3.17V0ZM175.19 1.11 177.95 -8.46H179.02L176.27 1.11ZM182.65 0.13Q181.85 0.13 181.22 -0.24Q180.6 -0.62 180.24 -1.29Q179.88 -1.95 179.88 -2.83Q179.88 -3.73 180.24 -4.4Q180.6 -5.07 181.22 -5.44Q181.85 -5.82 182.65 -5.82Q183.67 -5.82 184.35 -5.28Q185.03 -4.75 185.22 -3.83H184.08Q183.97 -4.33 183.57 -4.6Q183.18 -4.88 182.64 -4.88Q182.18 -4.88 181.81 -4.64Q181.43 -4.41 181.22 -3.96Q181.01 -3.51 181.01 -2.84Q181.01 -2.35 181.13 -1.97Q181.25 -1.58 181.47 -1.32Q181.69 -1.07 181.99 -0.93Q182.29 -0.8 182.64 -0.8Q183.01 -0.8 183.3 -0.92Q183.6 -1.05 183.8 -1.29Q184.01 -1.53 184.08 -1.86H185.22Q185.04 -0.96 184.35 -0.41Q183.66 0.13 182.65 0.13ZM188.37 0.13Q187.7 0.13 187.25 -0.11Q186.81 -0.35 186.59 -0.75Q186.37 -1.15 186.37 -1.62Q186.37 -2.17 186.65 -2.56Q186.93 -2.96 187.46 -3.17Q187.99 -3.38 188.72 -3.38H190.14Q190.14 -3.89 190.01 -4.23Q189.89 -4.57 189.61 -4.74Q189.33 -4.9 188.88 -4.9Q188.4 -4.9 188.07 -4.68Q187.73 -4.45 187.65 -4H186.55Q186.61 -4.58 186.94 -4.98Q187.26 -5.39 187.77 -5.6Q188.29 -5.82 188.88 -5.82Q189.66 -5.82 190.19 -5.54Q190.71 -5.27 190.98 -4.77Q191.24 -4.27 191.24 -3.58V0H190.28L190.19 -0.94Q190.08 -0.72 189.91 -0.52Q189.74 -0.33 189.51 -0.18Q189.29 -0.03 189 0.05Q188.71 0.13 188.37 0.13ZM188.57 -0.76Q188.91 -0.76 189.19 -0.91Q189.48 -1.05 189.68 -1.31Q189.89 -1.56 190 -1.87Q190.11 -2.19 190.12 -2.54V-2.6H188.83Q188.36 -2.6 188.07 -2.49Q187.78 -2.37 187.66 -2.16Q187.53 -1.95 187.53 -1.69Q187.53 -1.4 187.65 -1.2Q187.77 -0.99 188.01 -0.88Q188.24 -0.76 188.57 -0.76ZM192.73 2.42V-5.69H193.71L193.82 -4.83Q194 -5.1 194.26 -5.32Q194.52 -5.55 194.89 -5.68Q195.25 -5.82 195.73 -5.82Q196.52 -5.82 197.12 -5.43Q197.71 -5.04 198.04 -4.37Q198.37 -3.7 198.37 -2.83Q198.37 -1.98 198.03 -1.31Q197.7 -0.64 197.1 -0.25Q196.51 0.13 195.73 0.13Q195.08 0.13 194.59 -0.13Q194.1 -0.39 193.83 -0.85V2.42ZM195.54 -0.82Q196.04 -0.82 196.42 -1.07Q196.8 -1.32 197.02 -1.77Q197.25 -2.23 197.25 -2.84Q197.25 -3.46 197.02 -3.91Q196.8 -4.37 196.42 -4.61Q196.04 -4.86 195.54 -4.86Q195.03 -4.86 194.65 -4.61Q194.26 -4.37 194.05 -3.91Q193.83 -3.46 193.83 -2.84Q193.83 -2.23 194.05 -1.77Q194.26 -1.32 194.65 -1.07Q195.03 -0.82 195.54 -0.82ZM201.51 0.13Q200.84 0.13 200.4 -0.11Q199.95 -0.35 199.73 -0.75Q199.52 -1.15 199.52 -1.62Q199.52 -2.17 199.8 -2.56Q200.08 -2.96 200.61 -3.17Q201.13 -3.38 201.87 -3.38H203.29Q203.29 -3.89 203.16 -4.23Q203.03 -4.57 202.76 -4.74Q202.48 -4.9 202.02 -4.9Q201.55 -4.9 201.21 -4.68Q200.88 -4.45 200.8 -4H199.7Q199.76 -4.58 200.08 -4.98Q200.41 -5.39 200.92 -5.6Q201.43 -5.82 202.03 -5.82Q202.81 -5.82 203.33 -5.54Q203.86 -5.27 204.12 -4.77Q204.39 -4.27 204.39 -3.58V0H203.43L203.34 -0.94Q203.23 -0.72 203.06 -0.52Q202.89 -0.33 202.66 -0.18Q202.43 -0.03 202.15 0.05Q201.86 0.13 201.51 0.13ZM201.72 -0.76Q202.06 -0.76 202.34 -0.91Q202.62 -1.05 202.83 -1.31Q203.03 -1.56 203.14 -1.87Q203.26 -2.19 203.27 -2.54V-2.6H201.97Q201.51 -2.6 201.22 -2.49Q200.93 -2.37 200.8 -2.16Q200.67 -1.95 200.67 -1.69Q200.67 -1.4 200.79 -1.2Q200.92 -0.99 201.15 -0.88Q201.39 -0.76 201.72 -0.76ZM208.43 0.13Q207.62 0.13 206.99 -0.24Q206.37 -0.62 206.01 -1.29Q205.66 -1.95 205.66 -2.83Q205.66 -3.73 206.01 -4.4Q206.37 -5.07 206.99 -5.44Q207.62 -5.82 208.43 -5.82Q209.44 -5.82 210.12 -5.28Q210.81 -4.75 211 -3.83H209.85Q209.74 -4.33 209.35 -4.6Q208.95 -4.88 208.41 -4.88Q207.95 -4.88 207.58 -4.64Q207.21 -4.41 206.99 -3.96Q206.78 -3.51 206.78 -2.84Q206.78 -2.35 206.9 -1.97Q207.03 -1.58 207.24 -1.32Q207.46 -1.07 207.76 -0.93Q208.06 -0.8 208.41 -0.8Q208.78 -0.8 209.07 -0.92Q209.37 -1.05 209.57 -1.29Q209.78 -1.53 209.85 -1.86H211Q210.81 -0.96 210.12 -0.41Q209.43 0.13 208.43 0.13ZM212.39 0V-5.69H213.49V0ZM212.94 -6.69Q212.63 -6.69 212.42 -6.89Q212.22 -7.09 212.22 -7.39Q212.22 -7.69 212.42 -7.88Q212.63 -8.07 212.94 -8.07Q213.25 -8.07 213.46 -7.88Q213.67 -7.69 213.67 -7.39Q213.67 -7.09 213.46 -6.89Q213.25 -6.69 212.94 -6.69ZM217.41 0Q216.89 0 216.5 -0.16Q216.12 -0.33 215.91 -0.71Q215.7 -1.1 215.7 -1.76V-4.76H214.71V-5.69H215.7L215.84 -7.14H216.8V-5.69H218.38V-4.76H216.8V-1.75Q216.8 -1.28 217 -1.11Q217.19 -0.94 217.68 -0.94H218.36V0ZM220.31 2.42 221.63 -0.62H221.3L219.12 -5.69H220.31L222.04 -1.53L223.78 -5.69H224.93L221.46 2.42ZM225.97 -2.88V-3.81H230.42V-2.88ZM234.47 0.13Q233.68 0.13 233.07 -0.24Q232.46 -0.61 232.11 -1.27Q231.77 -1.94 231.77 -2.83Q231.77 -3.72 232.11 -4.4Q232.45 -5.07 233.07 -5.44Q233.68 -5.82 234.48 -5.82Q235.31 -5.82 235.89 -5.45Q236.47 -5.08 236.77 -4.46Q237.08 -3.84 237.08 -3.09Q237.08 -2.98 237.08 -2.86Q237.08 -2.74 237.06 -2.59H232.58V-3.36H235.99Q235.97 -4.1 235.54 -4.5Q235.11 -4.91 234.47 -4.91Q234.03 -4.91 233.66 -4.7Q233.3 -4.49 233.07 -4.08Q232.85 -3.67 232.85 -3.05V-2.74Q232.85 -2.11 233.07 -1.67Q233.29 -1.23 233.65 -1.01Q234.02 -0.78 234.46 -0.78Q235.01 -0.78 235.34 -1Q235.67 -1.22 235.82 -1.61H236.92Q236.78 -1.11 236.45 -0.72Q236.11 -0.32 235.61 -0.1Q235.11 0.13 234.47 0.13ZM237.83 0 239.72 -2.85 237.83 -5.69H239.02L240.43 -3.52L241.84 -5.69H243.03L241.13 -2.85L243.03 0H241.84L240.43 -2.21L239.03 0ZM244.04 2.42V-5.69H245.03L245.14 -4.83Q245.31 -5.1 245.57 -5.32Q245.83 -5.55 246.2 -5.68Q246.57 -5.82 247.05 -5.82Q247.84 -5.82 248.43 -5.43Q249.02 -5.04 249.35 -4.37Q249.68 -3.7 249.68 -2.83Q249.68 -1.98 249.35 -1.31Q249.01 -0.64 248.42 -0.25Q247.82 0.13 247.05 0.13Q246.39 0.13 245.9 -0.13Q245.41 -0.39 245.14 -0.85V2.42ZM246.86 -0.82Q247.35 -0.82 247.73 -1.07Q248.12 -1.32 248.34 -1.77Q248.56 -2.23 248.56 -2.84Q248.56 -3.46 248.34 -3.91Q248.12 -4.37 247.73 -4.61Q247.35 -4.86 246.86 -4.86Q246.35 -4.86 245.96 -4.61Q245.57 -4.37 245.36 -3.91Q245.15 -3.46 245.15 -2.84Q245.15 -2.23 245.36 -1.77Q245.57 -1.32 245.96 -1.07Q246.35 -0.82 246.86 -0.82ZM252.83 0.13Q252.16 0.13 251.71 -0.11Q251.27 -0.35 251.05 -0.75Q250.83 -1.15 250.83 -1.62Q250.83 -2.17 251.11 -2.56Q251.39 -2.96 251.92 -3.17Q252.45 -3.38 253.18 -3.38H254.6Q254.6 -3.89 254.47 -4.23Q254.35 -4.57 254.07 -4.74Q253.79 -4.9 253.34 -4.9Q252.86 -4.9 252.53 -4.68Q252.19 -4.45 252.11 -4H251.01Q251.07 -4.58 251.4 -4.98Q251.72 -5.39 252.23 -5.6Q252.75 -5.82 253.34 -5.82Q254.12 -5.82 254.65 -5.54Q255.17 -5.27 255.44 -4.77Q255.7 -4.27 255.7 -3.58V0H254.74L254.65 -0.94Q254.54 -0.72 254.37 -0.52Q254.2 -0.33 253.97 -0.18Q253.75 -0.03 253.46 0.05Q253.17 0.13 252.83 0.13ZM253.03 -0.76Q253.37 -0.76 253.65 -0.91Q253.94 -1.05 254.14 -1.31Q254.35 -1.56 254.46 -1.87Q254.57 -2.19 254.58 -2.54V-2.6H253.29Q252.82 -2.6 252.53 -2.49Q252.24 -2.37 252.12 -2.16Q251.99 -1.95 251.99 -1.69Q251.99 -1.4 252.11 -1.2Q252.23 -0.99 252.47 -0.88Q252.7 -0.76 253.03 -0.76ZM257.19 0V-5.69H258.17L258.24 -4.77Q258.49 -5.26 258.97 -5.54Q259.44 -5.82 260.08 -5.82Q260.73 -5.82 261.2 -5.56Q261.68 -5.31 261.94 -4.79Q262.2 -4.28 262.2 -3.51V0H261.1V-3.4Q261.1 -4.13 260.75 -4.51Q260.4 -4.88 259.78 -4.88Q259.37 -4.88 259.03 -4.69Q258.69 -4.49 258.49 -4.12Q258.29 -3.74 258.29 -3.2V0ZM265.83 0.13Q265.06 0.13 264.54 -0.11Q264.01 -0.34 263.73 -0.77Q263.44 -1.19 263.39 -1.75H264.5Q264.55 -1.48 264.7 -1.26Q264.85 -1.03 265.13 -0.9Q265.41 -0.76 265.83 -0.76Q266.18 -0.76 266.42 -0.87Q266.66 -0.97 266.78 -1.16Q266.91 -1.34 266.91 -1.58Q266.91 -1.9 266.76 -2.07Q266.6 -2.25 266.32 -2.35Q266.03 -2.44 265.61 -2.5Q265.16 -2.58 264.79 -2.69Q264.41 -2.81 264.14 -3Q263.87 -3.19 263.72 -3.48Q263.57 -3.77 263.57 -4.17Q263.57 -4.65 263.83 -5.02Q264.09 -5.4 264.56 -5.61Q265.04 -5.82 265.7 -5.82Q266.65 -5.82 267.21 -5.38Q267.77 -4.95 267.87 -4.16H266.8Q266.75 -4.52 266.46 -4.72Q266.17 -4.92 265.69 -4.92Q265.18 -4.92 264.92 -4.74Q264.67 -4.55 264.67 -4.24Q264.67 -4.02 264.79 -3.85Q264.92 -3.68 265.21 -3.56Q265.49 -3.44 265.95 -3.37Q266.6 -3.27 267.06 -3.1Q267.53 -2.93 267.78 -2.59Q268.03 -2.26 268.02 -1.66Q268.03 -1.1 267.75 -0.7Q267.48 -0.3 266.99 -0.08Q266.49 0.13 265.83 0.13ZM269.44 0V-5.69H270.54V0ZM269.99 -6.69Q269.67 -6.69 269.47 -6.89Q269.26 -7.09 269.26 -7.39Q269.26 -7.69 269.47 -7.88Q269.67 -8.07 269.99 -8.07Q270.3 -8.07 270.51 -7.88Q270.72 -7.69 270.72 -7.39Q270.72 -7.09 270.51 -6.89Q270.3 -6.69 269.99 -6.69ZM274.66 0.13Q273.86 0.13 273.24 -0.24Q272.62 -0.61 272.27 -1.28Q271.92 -1.95 271.92 -2.84Q271.92 -3.74 272.27 -4.41Q272.63 -5.08 273.26 -5.45Q273.88 -5.82 274.68 -5.82Q275.49 -5.82 276.11 -5.45Q276.72 -5.08 277.07 -4.41Q277.42 -3.74 277.42 -2.84Q277.42 -1.95 277.07 -1.28Q276.72 -0.61 276.09 -0.24Q275.47 0.13 274.66 0.13ZM274.66 -0.81Q275.12 -0.81 275.49 -1.04Q275.86 -1.27 276.08 -1.72Q276.3 -2.17 276.3 -2.84Q276.3 -3.52 276.09 -3.97Q275.87 -4.42 275.51 -4.65Q275.14 -4.87 274.68 -4.87Q274.23 -4.87 273.86 -4.65Q273.49 -4.42 273.27 -3.97Q273.04 -3.52 273.04 -2.84Q273.04 -2.17 273.26 -1.72Q273.48 -1.27 273.85 -1.04Q274.21 -0.81 274.66 -0.81ZM278.75 0V-5.69H279.73L279.8 -4.77Q280.05 -5.26 280.53 -5.54Q281 -5.82 281.64 -5.82Q282.29 -5.82 282.76 -5.56Q283.24 -5.31 283.5 -4.79Q283.76 -4.28 283.76 -3.51V0H282.66V-3.4Q282.66 -4.13 282.31 -4.51Q281.96 -4.88 281.34 -4.88Q280.93 -4.88 280.59 -4.69Q280.25 -4.49 280.05 -4.12Q279.85 -3.74 279.85 -3.2V0ZM285.29 -2.88V-3.81H289.73V-2.88ZM291.3 2.42V-5.69H292.29L292.39 -4.83Q292.57 -5.1 292.83 -5.32Q293.09 -5.55 293.46 -5.68Q293.82 -5.82 294.3 -5.82Q295.1 -5.82 295.69 -5.43Q296.28 -5.04 296.61 -4.37Q296.94 -3.7 296.94 -2.83Q296.94 -1.98 296.6 -1.31Q296.27 -0.64 295.67 -0.25Q295.08 0.13 294.31 0.13Q293.65 0.13 293.16 -0.13Q292.67 -0.39 292.4 -0.85V2.42ZM294.11 -0.82Q294.61 -0.82 294.99 -1.07Q295.37 -1.32 295.6 -1.77Q295.82 -2.23 295.82 -2.84Q295.82 -3.46 295.6 -3.91Q295.37 -4.37 294.99 -4.61Q294.61 -4.86 294.11 -4.86Q293.6 -4.86 293.22 -4.61Q292.83 -4.37 292.62 -3.91Q292.41 -3.46 292.41 -2.84Q292.41 -2.23 292.62 -1.77Q292.83 -1.32 293.22 -1.07Q293.6 -0.82 294.11 -0.82ZM298.26 0V-7.92H299.36V0ZM302.71 0.13Q302.04 0.13 301.6 -0.11Q301.15 -0.35 300.93 -0.75Q300.72 -1.15 300.72 -1.62Q300.72 -2.17 301 -2.56Q301.28 -2.96 301.81 -3.17Q302.33 -3.38 303.07 -3.38H304.49Q304.49 -3.89 304.36 -4.23Q304.23 -4.57 303.96 -4.74Q303.68 -4.9 303.22 -4.9Q302.75 -4.9 302.41 -4.68Q302.08 -4.45 302 -4H300.9Q300.96 -4.58 301.28 -4.98Q301.61 -5.39 302.12 -5.6Q302.63 -5.82 303.23 -5.82Q304.01 -5.82 304.53 -5.54Q305.06 -5.27 305.32 -4.77Q305.59 -4.27 305.59 -3.58V0H304.63L304.54 -0.94Q304.43 -0.72 304.26 -0.52Q304.09 -0.33 303.86 -0.18Q303.63 -0.03 303.35 0.05Q303.06 0.13 302.71 0.13ZM302.92 -0.76Q303.26 -0.76 303.54 -0.91Q303.82 -1.05 304.03 -1.31Q304.23 -1.56 304.34 -1.87Q304.46 -2.19 304.47 -2.54V-2.6H303.17Q302.71 -2.6 302.42 -2.49Q302.13 -2.37 302 -2.16Q301.87 -1.95 301.87 -1.69Q301.87 -1.4 301.99 -1.2Q302.12 -0.99 302.35 -0.88Q302.59 -0.76 302.92 -0.76ZM307.07 0V-5.69H308.06L308.12 -4.77Q308.37 -5.26 308.85 -5.54Q309.33 -5.82 309.96 -5.82Q310.62 -5.82 311.09 -5.56Q311.56 -5.31 311.82 -4.79Q312.08 -4.28 312.08 -3.51V0H310.98V-3.4Q310.98 -4.13 310.64 -4.51Q310.29 -4.88 309.67 -4.88Q309.25 -4.88 308.91 -4.69Q308.57 -4.49 308.37 -4.12Q308.17 -3.74 308.17 -3.2V0ZM313.57 0V-5.69H314.56L314.62 -4.77Q314.87 -5.26 315.35 -5.54Q315.83 -5.82 316.46 -5.82Q317.12 -5.82 317.59 -5.56Q318.06 -5.31 318.32 -4.79Q318.58 -4.28 318.58 -3.51V0H317.48V-3.4Q317.48 -4.13 317.14 -4.51Q316.79 -4.88 316.17 -4.88Q315.75 -4.88 315.41 -4.69Q315.07 -4.49 314.87 -4.12Q314.67 -3.74 314.67 -3.2V0ZM322.55 0.13Q321.76 0.13 321.15 -0.24Q320.55 -0.61 320.2 -1.27Q319.86 -1.94 319.86 -2.83Q319.86 -3.72 320.2 -4.4Q320.54 -5.07 321.15 -5.44Q321.77 -5.82 322.57 -5.82Q323.4 -5.82 323.98 -5.45Q324.56 -5.08 324.86 -4.46Q325.17 -3.84 325.17 -3.09Q325.17 -2.98 325.17 -2.86Q325.17 -2.74 325.15 -2.59H320.67V-3.36H324.08Q324.05 -4.1 323.62 -4.5Q323.2 -4.91 322.56 -4.91Q322.12 -4.91 321.75 -4.7Q321.38 -4.49 321.16 -4.08Q320.94 -3.67 320.94 -3.05V-2.74Q320.94 -2.11 321.16 -1.67Q321.38 -1.23 321.74 -1.01Q322.11 -0.78 322.55 -0.78Q323.1 -0.78 323.43 -1Q323.75 -1.22 323.91 -1.61H325.01Q324.87 -1.11 324.54 -0.72Q324.2 -0.32 323.7 -0.1Q323.2 0.13 322.55 0.13ZM326.43 0V-5.69H327.42L327.51 -4.65Q327.71 -5.03 328.02 -5.29Q328.33 -5.55 328.76 -5.68Q329.19 -5.82 329.73 -5.82V-4.66H329.19Q328.86 -4.66 328.56 -4.58Q328.26 -4.5 328.03 -4.3Q327.8 -4.11 327.66 -3.79Q327.53 -3.46 327.53 -2.96V0Z";
})(typeof globalThis !== 'undefined' ? globalThis : this);
