/* Capacity Expansion Planner: the charts (Chart.js), and their exports.

   Capacity     what is in service in each decision year, by technology,
                against the peak demand.
   When to build  new capacity in each decision year above the line, and
                what retires (existing plant or plant at the end of its
                life) below it.
   Energy       a year's energy by source, any shortfall in red, against the
                demand.
   Typical days the hour-by-hour dispatch of one decision year over its
                typical days, storage charging below zero, against the demand.
   Cost         each year's costs by kind, and the average cost per MWh.

   A technology keeps its colour on every chart: the neutral sequence in the
   order the plan lists them, paler on each lap round it. The exports follow
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
  var CANVAS = { cap: 'capCanvas', build: 'buildCanvas', energy: 'energyCanvas', day: 'dayCanvas', cost: 'costCanvas' };
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

  /* ── Shared pieces ── */
  function techList(model, res){ return model.tech.filter(function(e){ return res.tech[e.id]; }); }
  function colourOf(model, e){ return seriesColour(model.tech.indexOf(e)); }
  function any(a){ for(var i = 0; i < a.length; i++) if(Math.abs(a[i]) > 1e-6) return true; return false; }
  function hover(id, txt){ var el = $(id); if(el) el.textContent = txt; }
  function yearLabels(res){ return res.periods.map(String); }
  function axisTitle(text, muted){ return { display: true, text: text, color: muted, font: { size: 11 } }; }
  function curWord(cur){ return cur || 'money'; }
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
      scales: o.scales(grid, muted)
    };
  }
  function renderLegend(legendId, chart, datasets){
    var el = $(legendId);
    if(!el) return;
    el.innerHTML = '';
    datasets.forEach(function(ds, idx){
      if(ds.noLegend) return;
      var item = document.createElement('div');
      item.className = 'legend-item';
      SharedLegend.attach(item, SharedLegend.specOf(ds), ds.label);
      if(ds.hidden) item.classList.add('hidden');
      item.addEventListener('click', function(){
        var hidden = !item.classList.contains('hidden');
        item.classList.toggle('hidden', hidden);
        chart.setDatasetVisibility(idx, !hidden);
        chart.update();
      });
      el.appendChild(item);
    });
  }
  function make(key, cfg, legendId, extraPlugins){
    if(charts[key]) charts[key].destroy();
    cfg.plugins = [SharedZoom.plugin].concat(extraPlugins || []);
    var ch = charts[key] = new Chart($(CANVAS[key]), cfg);
    renderLegend(legendId, ch, cfg.data.datasets);
    return ch;
  }
  function barSet(label, data, c, o){
    var d = { type: 'bar', label: label, data: data, backgroundColor: alpha(c, o && o.faint ? 0.28 : 0.78), borderColor: c, borderWidth: 1.2,
              stack: o && o.stack || 's', order: 2, categoryPercentage: 0.72, barPercentage: 0.92 };
    for(var k in o) if(k !== 'faint') d[k] = o[k];
    return d;
  }
  function lineSet(label, data, o){
    var d = { type: 'line', label: label, data: data, borderColor: cssVar('--text'), backgroundColor: 'transparent', borderWidth: 2,
              borderDash: [6, 4], pointRadius: 3, pointHoverRadius: 5, tension: 0, fill: false, order: 1, kind: 'ref' };
    for(var k in o) d[k] = o[k];
    return d;
  }
  // A year's index from a click on a bar chart.
  function yearClick(evt, els, chart){
    if(!ctx || !ctx.onYear) return;
    var x = chart.scales.x, v = x.getValueForPixel(evt.x);
    if(!isFinite(v)) return;
    ctx.onYear(Math.max(0, Math.min(ctx.res.periods.length - 1, Math.round(v))));
  }

  /* ── Capacity in service ── */
  function capChart(res, model, d){
    var labels = yearLabels(res), ds = [], K = labels.length;
    techList(model, res).forEach(function(e){
      var t = res.tech[e.id];
      if(!any(t.cap)) return;
      ds.push(barSet(CX.nameOf(e), t.cap.slice(), colourOf(model, e), { id: e.id }));
    });
    ds.push(lineSet('Peak demand', res.totals.peak.slice()));
    make('cap', {
      type: 'bar', data: { labels: labels, datasets: ds },
      options: baseOptions({ n: K, onClick: yearClick,
        filter: function(item){ return Math.abs(item.parsed.y) > 1e-6 || item.dataset.kind === 'ref'; },
        skip: function(ds){ return ds.kind === 'ref'; },
        callbacks: {
          label: function(c){ return '  ' + c.dataset.label + ': ' + F.mw(c.parsed.y) + ' MW'; },
          afterBody: function(items){
            if(!items.length) return;
            var k = items[0].dataIndex, tot = 0;
            res.order.forEach(function(id){ tot += res.tech[id].cap[k]; });
            hover('capHover', labels[k] + '  |  ' + F.mw(tot) + ' MW in service for a ' + F.mw(res.totals.peak[k]) + ' MW peak, ' +
              F.mw(res.totals.firm[k]) + ' MW of it firm or storage');
          }
        },
        scales: function(grid, muted){
          return { x: { stacked: true, title: axisTitle('Decision year', muted), ticks: { color: muted, font: { size: 11 } }, grid: { color: grid } },
                   y: { stacked: true, beginAtZero: true, title: axisTitle('Capacity (MW)', muted), ticks: { color: muted, font: { size: 11 }, callback: function(v){ return F.mw(v); } }, grid: { color: grid } } };
        } })
    }, 'capLegend');
    $('capSub').textContent = 'Every plant in service in each decision year, storage at its power rating. Click a year to see its typical days.';
  }

  /* ── When to build ── */
  function buildChart(res, model, d){
    var labels = yearLabels(res), ds = [], K = labels.length;
    techList(model, res).forEach(function(e){
      var t = res.tech[e.id], c = colourOf(model, e);
      if(any(t.built)) ds.push(barSet(CX.nameOf(e), t.built.slice(), c, { stack: 'b', id: e.id, kind: 'built' }));
    });
    techList(model, res).forEach(function(e){
      var t = res.tech[e.id], c = colourOf(model, e);
      if(any(t.retired)) ds.push(barSet(CX.nameOf(e) + ' retired', t.retired.map(function(v){ return -v; }), c, { stack: 'b', id: e.id, kind: 'retired', faint: true }));
    });
    make('build', {
      type: 'bar', data: { labels: labels, datasets: ds },
      options: baseOptions({ n: K, onClick: yearClick,
        filter: function(item){ return Math.abs(item.parsed.y) > 1e-6; },
        callbacks: {
          label: function(c){ return '  ' + c.dataset.label + ': ' + F.mw(Math.abs(c.parsed.y)) + ' MW'; },
          afterBody: function(items){
            if(!items.length) return;
            var k = items[0].dataIndex, b = 0, r = 0;
            res.order.forEach(function(id){ b += res.tech[id].built[k]; r += res.tech[id].retired[k]; });
            hover('buildHover', labels[k] + '  |  ' + F.mw(b) + ' MW built' + (r > 1e-6 ? ', ' + F.mw(r) + ' MW retired' : ''));
          }
        },
        scales: function(grid, muted){
          return { x: { stacked: true, title: axisTitle('Decision year', muted), ticks: { color: muted, font: { size: 11 } }, grid: { color: grid } },
                   y: { stacked: true, title: axisTitle('Capacity (MW)', muted), ticks: { color: muted, font: { size: 11 }, callback: function(v){ return F.mw(v); } }, grid: { color: grid } } };
        } })
    }, 'buildLegend');
    $('buildSub').textContent = ds.length ? 'New capacity in service from each decision year above the line; what retires by then below it, paler.' : 'Nothing is built or retired over the plan.';
  }

  /* ── Energy by source ── */
  function energyChart(res, model, d){
    var labels = yearLabels(res), ds = [], K = labels.length, T = res.totals;
    techList(model, res).forEach(function(e){
      var t = res.tech[e.id];
      if(!any(t.gen)) return;
      ds.push(barSet(CX.nameOf(e) + (e.kind === 'store' ? ' (discharge)' : ''), t.gen.map(function(v){ return v / 1000; }), colourOf(model, e), { id: e.id }));
    });
    if(any(T.shedEnergy)) ds.push(barSet('Shortfall (load shed)', T.shedEnergy.map(function(v){ return v / 1000; }), cssVar('--negative'), { kind: 'shed' }));
    ds.push(lineSet('Demand', T.energy.map(function(v){ return v / 1000; })));
    make('energy', {
      type: 'bar', data: { labels: labels, datasets: ds },
      options: baseOptions({ n: K, onClick: yearClick,
        filter: function(item){ return Math.abs(item.parsed.y) > 1e-9 || item.dataset.kind === 'ref'; },
        skip: function(ds){ return ds.kind === 'ref'; },
        callbacks: {
          label: function(c){ return '  ' + c.dataset.label + ': ' + F.gwh(c.parsed.y * 1000) + ' GWh'; },
          afterBody: function(items){
            if(!items.length) return;
            var k = items[0].dataIndex;
            hover('energyHover', labels[k] + '  |  demand ' + F.gwh(T.energy[k]) + ' GWh, ' + F.pct(T.gen[k] > 0 ? 100 * T.cleanGen[k] / T.gen[k] : NaN) + '% of generation free of CO2, ' +
              F.co2(T.emis[k]) + ' of CO2' + (T.curtail[k] > 1 ? ', ' + F.gwh(T.curtail[k]) + ' GWh of sun and wind spilled' : '') + (T.shedEnergy[k] > 1e-3 ? ', ' + F.gwh(T.shedEnergy[k]) + ' GWh shed' : ''));
          }
        },
        scales: function(grid, muted){
          return { x: { stacked: true, title: axisTitle('Decision year', muted), ticks: { color: muted, font: { size: 11 } }, grid: { color: grid } },
                   y: { stacked: true, beginAtZero: true, title: axisTitle('Energy (GWh a year)', muted), ticks: { color: muted, font: { size: 11 }, callback: function(v){ return F.gwh(v * 1000); } }, grid: { color: grid } } };
        } })
    }, 'energyLegend');
    var stores = model.tech.some(function(e){ return e.kind === 'store' && res.tech[e.id] && any(res.tech[e.id].gen); });
    $('energySub').textContent = 'A year of each decision year’s energy by source.' + (stores ? ' Storage counts what it gives back, so its losses stand the bars a little above demand.' : '');
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
  /* The hours of the day on the axis, as many as fit its width and the part
     in view: every hour up to every other day, always on the clock's hours,
     so the labels never run into each other on a phone. */
  var STEPS = [1, 2, 3, 6, 12, 24, 48];
  function clockTicks(H){
    return function(scale){
      var lo = Math.max(0, Math.ceil(scale.min)), hi = Math.min(H - 1, Math.floor(scale.max));
      var room = Math.max(2, Math.floor((scale.width || 600) / 56)), step = STEPS[STEPS.length - 1];
      for(var i = 0; i < STEPS.length; i++) if((hi - lo) / STEPS[i] <= room){ step = STEPS[i]; break; }
      var ticks = [];
      for(var v = lo; v <= hi; v++) if(step < 24 ? (v % 24) % step === 0 : v % step === 0) ticks.push({ value: v });
      // A label that would stand past the right end of the axis is left off.
      var px = (scale.width || 600) / Math.max(1, hi - lo);
      while(ticks.length > 1 && (hi - ticks[ticks.length - 1].value) * px < 18) ticks.pop();
      if(ticks.length) scale.ticks = ticks;
    };
  }
  // The typical days named over the plot, with a rule between them.
  var BLOCK_PLUGIN = {
    id: 'cxBlocks',
    afterDatasetsDraw: function(chart){
      var b = chart.config.options.plugins.cxBlocks;
      if(!b) return;
      var x = chart.scales.x, area = chart.chartArea, g = chart.ctx;
      g.save();
      g.font = '600 11px "DM Sans", sans-serif';
      g.textBaseline = 'top';
      b.blocks.forEach(function(bl, i){
        var x0 = x.getPixelForValue(bl.from - 0.5), x1 = x.getPixelForValue(bl.from + bl.len - 0.5);
        if(x1 < area.left || x0 > area.right) return;
        if(i > 0 && x0 >= area.left && x0 <= area.right){
          g.strokeStyle = b.rule; g.lineWidth = 1; g.setLineDash([3, 3]);
          g.beginPath(); g.moveTo(x0, area.top); g.lineTo(x0, area.bottom); g.stroke();
        }
        var l = Math.max(area.left, x0), r = Math.min(area.right, x1), w = r - l, txt = bl.name;
        g.fillStyle = b.text;
        if(g.measureText(txt).width > w - 8) txt = bl.short;
        if(g.measureText(txt).width <= w - 8){ g.textAlign = 'center'; g.fillText(txt, (l + r) / 2, area.top + 4); }
      });
      g.restore();
    }
  };
  function dayChart(res, model, d){
    var k = Math.max(0, Math.min(res.periods.length - 1, d.year | 0)), H = res.H, labels = dayLabels(res), ds = [], T = res.totals, o = res.report.opts;
    var year = res.periods[k];
    // Cheapest to run at the bottom, as a merit order.
    var gens = techList(model, res).filter(function(e){ return e.kind !== 'store' && any(res.tech[e.id].p[k]); });
    gens.sort(function(a, b){ return CX.runCost(a, o, year) - CX.runCost(b, o, year) || model.tech.indexOf(a) - model.tech.indexOf(b); });
    var stores = techList(model, res).filter(function(e){ return e.kind === 'store' && any(res.tech[e.id].p[k]); });
    gens.forEach(function(e){
      var c = colourOf(model, e);
      ds.push({ label: CX.nameOf(e), data: res.tech[e.id].p[k].map(function(v){ return Math.max(0, v); }), borderColor: c, backgroundColor: alpha(c, 0.55),
                borderWidth: 1.2, pointRadius: 0, pointHoverRadius: 4, tension: 0, stack: 'gen', order: 2, kind: 'gen', id: e.id });
    });
    stores.forEach(function(e){
      var c = colourOf(model, e);
      ds.push({ label: CX.nameOf(e) + ' discharging', data: res.tech[e.id].p[k].map(function(v){ return Math.max(0, v); }), borderColor: c, backgroundColor: alpha(c, 0.55),
                borderWidth: 1.2, pointRadius: 0, pointHoverRadius: 4, tension: 0, stack: 'gen', order: 2, kind: 'dis', id: e.id });
      ds.push({ label: CX.nameOf(e) + ' charging', data: res.tech[e.id].p[k].map(function(v){ return Math.min(0, v); }), borderColor: c, backgroundColor: alpha(c, 0.22),
                borderWidth: 1.2, borderDash: [4, 3], pointRadius: 0, pointHoverRadius: 4, tension: 0, stack: 'store', order: 2, kind: 'chg', id: e.id });
    });
    if(any(res.shed[k])){
      var neg = cssVar('--negative');
      ds.push({ label: 'Shortfall (load shed)', data: res.shed[k].slice(), borderColor: neg, backgroundColor: alpha(neg, 0.45),
                borderWidth: 1.2, pointRadius: 0, tension: 0, stack: 'gen', order: 2, kind: 'shed' });
    }
    // Each layer fills down to the layer under it in its own stack.
    var lastIn = {};
    ds.forEach(function(x, i){
      x.fill = lastIn[x.stack] === undefined ? 'origin' : lastIn[x.stack];
      lastIn[x.stack] = i;
      var shown = {}; for(var key in x) shown[key] = x[key];
      shown.fill = 'origin';
      x.legendSpec = SharedLegend.fromDataset(shown);
    });
    ds.push({ label: 'Demand', data: res.load[k].slice(), borderColor: cssVar('--text'), backgroundColor: 'transparent',
              borderWidth: 2, borderDash: [6, 4], pointRadius: 0, pointHoverRadius: 4, tension: 0, fill: false, stack: 'load', order: 1, kind: 'load' });
    var short = function(b){ return b.stress ? 'Still day' : b.name.replace(' weekday', ' wkday').replace(' weekend', ' wkend').replace(' season', ''); };
    var ch = make('day', {
      type: 'line', data: { labels: labels, datasets: ds },
      options: (function(){
        var op = baseOptions({ n: H,
          filter: function(item){ return Math.abs(item.parsed.y) > 1e-9 || item.dataset.kind === 'load'; },
          skip: function(x){ return x.kind === 'load'; },
          callbacks: {
            title: function(items){ return items.length ? labels[items[0].dataIndex] : ''; },
            label: function(c){ return '  ' + c.dataset.label + ': ' + F.mw(c.parsed.y) + ' MW'; },
            afterBody: function(items){
              if(!items.length) return;
              var t = items[0].dataIndex, gsum = 0, ssum = 0;
              gens.forEach(function(e){ gsum += Math.max(0, res.tech[e.id].p[k][t]); });
              stores.forEach(function(e){ ssum += res.tech[e.id].p[k][t]; });
              hover('dayHover', year + ', ' + labels[t] + '  |  demand ' + F.mw(res.load[k][t]) + ' MW, generation ' + F.mw(gsum) + ' MW' +
                (Math.abs(ssum) > 1e-6 ? ', storage ' + F.mw(ssum) + ' MW' : '') + (res.shed[k][t] > 1e-6 ? ', shed ' + F.mw(res.shed[k][t]) + ' MW' : '') +
                '. Each hour stands for ' + F.pct(res.w[t]) + ' hours of the year.');
            }
          },
          scales: function(grid, muted){
            return {
              x: { title: axisTitle('Typical days, hour by hour', muted),
                   ticks: { color: muted, maxRotation: 0, autoSkip: false, font: { size: 11 },
                            callback: function(v){ return two((+v) % 24) + ':00'; } },
                   afterBuildTicks: clockTicks(H),
                   grid: { color: grid } },
              y: { stacked: true, title: axisTitle('Power (MW)', muted), ticks: { color: muted, font: { size: 11 }, callback: function(v){ return F.mw(v); } }, grid: { color: grid } }
            };
          } });
        op.plugins.cxBlocks = { blocks: res.blocks.map(function(b){ return { from: b.from, len: b.len, name: b.name, short: short(b) }; }),
                                text: cssVar('--chart-text'), rule: cssVar('--chart-grid') };
        op.layout = { padding: { top: 18 } };
        return op;
      })()
    }, 'dayLegend', [BLOCK_PLUGIN]);
    ch.options.scales.y.stacked = true;
    $('daySub').textContent = year + ' hour by hour over its typical days, cheapest to run at the bottom' + (stores.length ? ', storage charging below zero' : '') + '. Pick another year beside the chart.';
  }

  /* ── Cost by year ── */
  function costChart(res, model, d){
    var labels = yearLabels(res), K = labels.length, T = res.totals, cur = d.cur, pal = SharedPalette.neutral(), ds = [];
    var m = function(a){ return a.map(function(v){ return v / 1e6; }); };
    var parts = [['Capital (annuities)', T.capex, pal[0]], ['Fixed O&M', T.fom, pal[1 % pal.length]], ['Fuel and running', T.vom, pal[2 % pal.length]],
                 ['Carbon', T.co2cost, pal[3 % pal.length]]];
    parts.forEach(function(p){ if(any(p[1])) ds.push(barSet(p[0], m(p[1]), p[2], {})); });
    if(any(T.shedCost)) ds.push(barSet('Lost load cost', m(T.shedCost), cssVar('--negative'), { kind: 'shed' }));
    var avg = T.cost.map(function(c, k){ return T.served[k] > 0 ? c / T.served[k] : NaN; });
    ds.push(lineSet('Average cost', avg, { yAxisID: 'y2', borderDash: [], kind: 'ref' }));
    var u = cur ? cur + ' m' : 'millions';
    make('cost', {
      type: 'bar', data: { labels: labels, datasets: ds },
      options: baseOptions({ n: K, onClick: yearClick, fitAxes: ['y', 'y2'],
        filter: function(item){ return Math.abs(item.parsed.y) > 1e-9 || item.dataset.kind === 'ref'; },
        skip: function(x){ return x.kind === 'ref'; },
        callbacks: {
          label: function(c){ return c.dataset.yAxisID === 'y2' ? '  ' + c.dataset.label + ': ' + F.price(c.parsed.y, cur) + '/MWh' : '  ' + c.dataset.label + ': ' + F.big(c.parsed.y * 1e6, cur); },
          afterBody: function(items){
            if(!items.length) return;
            var k = items[0].dataIndex;
            hover('costHover', labels[k] + '  |  ' + F.big(T.cost[k], cur) + ' a year, ' + F.price(avg[k], cur) + ' per MWh served');
          }
        },
        scales: function(grid, muted){
          return { x: { stacked: true, title: axisTitle('Decision year', muted), ticks: { color: muted, font: { size: 11 } }, grid: { color: grid } },
                   y: { stacked: true, beginAtZero: true, title: axisTitle('Cost (' + u + ' a year)', muted), ticks: { color: muted, font: { size: 11 }, callback: function(v){ return F.big(v * 1e6, ''); } }, grid: { color: grid } },
                   y2: { position: 'right', beginAtZero: true, title: axisTitle('Average cost (' + (cur || '') + '/MWh)', muted), ticks: { color: muted, font: { size: 11 }, callback: function(v){ return F.money(v, cur); } }, grid: { drawOnChartArea: false } } };
        } })
    }, 'costLegend');
    $('costSub').textContent = 'A year’s costs in each decision year, at today’s prices and not discounted, with the average cost per MWh served on the right.';
  }

  /* ── Render all, or clear ── */
  CXCharts.ok = function(){ return typeof Chart !== 'undefined'; };
  CXCharts.render = function(res, model, d, onYear){
    var show = {};
    if(!res || !res.report || !res.report.ok){ CXCharts.clear(); return show; }
    if(!CXCharts.ok()) return show;
    ctx = { res: res, model: model, display: d, onYear: onYear };
    capChart(res, model, d); show.cap = true;
    buildChart(res, model, d); show.build = true;
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
  function legendRows(legendId, measure, maxW, markW, gap, pad){
    var items = SharedLegend.itemsOf(legendId);
    return items.length ? SharedLegend.layout(items, measure, maxW, markW, gap, pad) : [];
  }
  var wmLogoImg = new Image();
  CX.WM_PATH_W = 323.96;
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
      mc.font = '500 ' + Math.round(11 * OUT) + 'px ' + FONT;
      var rows = legendRows(legendId, function(s){ return mc.measureText(s).width; }, chartW - margin * 2, markW, gap, pad);
      var legendH = rows.length ? rows.length * rowH + Math.round(8 * OUT) : 0;
      var c = document.createElement('canvas');
      c.width = chartW; c.height = chartH + titleH + legendH + wmH;
      var g = c.getContext('2d');
      g.fillStyle = tone.bg; g.fillRect(0, 0, c.width, c.height);
      g.font = '700 ' + Math.round(14 * OUT) + 'px ' + FONT; g.fillStyle = tone.fg; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(chartTitle, c.width / 2, titleH / 2);
      g.drawImage(src, 0, titleH, chartW, chartH);
      g.font = '500 ' + Math.round(11 * OUT) + 'px ' + FONT;
      rows.forEach(function(row, ri){
        var x = Math.max(margin, (c.width - row.width) / 2), cy = titleH + chartH + Math.round(4 * OUT) + rowH * ri + rowH / 2;
        row.items.forEach(function(item){
          SharedLegend.paint(g, item.swatch, x, cy, OUT);
          x += markW + gap;
          g.fillStyle = tone.fg; g.textAlign = 'left';
          g.fillText(item.label, x, cy);
          x += g.measureText(item.label).width + pad;
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
      mc.font = '500 11px DM Sans, sans-serif';
      var rows = legendRows(legendId, function(s){ return mc.measureText(s).width; }, chartW - margin * 2, markW, gap, pad);
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
        row.items.forEach(function(item){
          svg.appendChild(SharedLegend.svgNode(item.swatch, x, cy, 1));
          x += markW + gap;
          text(item.label, x, cy, { size: '11', weight: '500' });
          x += mc.measureText(item.label).width + pad;
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
  // The watermark, "Made using tool.adjiebrotots.com/capacityexpansion-planner" baked to DM Sans 500
  // glyph outlines by _ref/bake-watermark.py. Edit there and re-run, not here.
  CX.WM_PATH = "M0.82 0V-7.7H2.12L4.66 -2.48L7.19 -7.7H8.49V0H7.39V-5.76L5.08 -1.04H4.24L1.92 -5.74V0ZM11.9 0.13Q11.24 0.13 10.79 -0.11Q10.35 -0.35 10.13 -0.75Q9.91 -1.15 9.91 -1.62Q9.91 -2.17 10.19 -2.56Q10.47 -2.96 11 -3.17Q11.53 -3.38 12.26 -3.38H13.68Q13.68 -3.89 13.55 -4.23Q13.43 -4.57 13.15 -4.74Q12.87 -4.9 12.42 -4.9Q11.94 -4.9 11.61 -4.68Q11.27 -4.45 11.19 -4H10.09Q10.15 -4.58 10.48 -4.98Q10.8 -5.39 11.31 -5.6Q11.82 -5.82 12.42 -5.82Q13.2 -5.82 13.73 -5.54Q14.25 -5.27 14.52 -4.77Q14.78 -4.27 14.78 -3.58V0H13.82L13.73 -0.94Q13.62 -0.72 13.45 -0.52Q13.28 -0.33 13.05 -0.18Q12.83 -0.03 12.54 0.05Q12.25 0.13 11.9 0.13ZM12.11 -0.76Q12.45 -0.76 12.73 -0.91Q13.01 -1.05 13.22 -1.31Q13.42 -1.56 13.54 -1.87Q13.65 -2.19 13.66 -2.54V-2.6H12.37Q11.9 -2.6 11.61 -2.49Q11.32 -2.37 11.19 -2.16Q11.06 -1.95 11.06 -1.69Q11.06 -1.4 11.19 -1.2Q11.31 -0.99 11.55 -0.88Q11.78 -0.76 12.11 -0.76ZM18.67 0.13Q17.9 0.13 17.3 -0.25Q16.71 -0.64 16.38 -1.31Q16.05 -1.99 16.05 -2.84Q16.05 -3.71 16.38 -4.38Q16.72 -5.05 17.32 -5.43Q17.92 -5.82 18.71 -5.82Q19.35 -5.82 19.83 -5.56Q20.31 -5.31 20.59 -4.84V-7.92H21.69V0H20.7L20.6 -0.87Q20.43 -0.61 20.17 -0.38Q19.91 -0.15 19.54 -0.01Q19.17 0.13 18.67 0.13ZM18.87 -0.82Q19.39 -0.82 19.77 -1.07Q20.16 -1.32 20.37 -1.78Q20.58 -2.23 20.58 -2.84Q20.58 -3.46 20.37 -3.91Q20.16 -4.37 19.77 -4.61Q19.39 -4.86 18.87 -4.86Q18.38 -4.86 18 -4.61Q17.61 -4.37 17.39 -3.91Q17.17 -3.46 17.17 -2.85Q17.17 -2.23 17.39 -1.78Q17.61 -1.32 18 -1.07Q18.38 -0.82 18.87 -0.82ZM25.7 0.13Q24.91 0.13 24.3 -0.24Q23.69 -0.61 23.35 -1.27Q23 -1.94 23 -2.83Q23 -3.72 23.34 -4.4Q23.68 -5.07 24.3 -5.44Q24.91 -5.82 25.71 -5.82Q26.55 -5.82 27.12 -5.45Q27.7 -5.08 28.01 -4.46Q28.31 -3.84 28.31 -3.09Q28.31 -2.98 28.31 -2.86Q28.31 -2.74 28.3 -2.59H23.81V-3.36H27.22Q27.2 -4.1 26.77 -4.5Q26.34 -4.91 25.7 -4.91Q25.26 -4.91 24.89 -4.7Q24.53 -4.49 24.3 -4.08Q24.08 -3.67 24.08 -3.05V-2.74Q24.08 -2.11 24.3 -1.67Q24.52 -1.23 24.88 -1.01Q25.25 -0.78 25.69 -0.78Q26.24 -0.78 26.57 -1Q26.9 -1.22 27.05 -1.61H28.16Q28.01 -1.11 27.68 -0.72Q27.34 -0.32 26.84 -0.1Q26.34 0.13 25.7 0.13ZM34.49 0.13Q33.84 0.13 33.36 -0.12Q32.89 -0.37 32.63 -0.88Q32.37 -1.4 32.37 -2.16V-5.69H33.47V-2.29Q33.47 -1.54 33.81 -1.17Q34.16 -0.8 34.78 -0.8Q35.2 -0.8 35.54 -1Q35.87 -1.19 36.07 -1.56Q36.27 -1.94 36.27 -2.48V-5.69H37.37V0H36.39L36.31 -0.92Q36.08 -0.43 35.6 -0.15Q35.12 0.13 34.49 0.13ZM41.04 0.13Q40.28 0.13 39.75 -0.11Q39.22 -0.34 38.94 -0.77Q38.66 -1.19 38.6 -1.75H39.72Q39.76 -1.48 39.92 -1.26Q40.07 -1.03 40.35 -0.9Q40.63 -0.76 41.04 -0.76Q41.4 -0.76 41.64 -0.87Q41.88 -0.97 42 -1.16Q42.12 -1.34 42.12 -1.58Q42.12 -1.9 41.97 -2.07Q41.82 -2.25 41.53 -2.35Q41.24 -2.44 40.82 -2.5Q40.37 -2.58 40 -2.69Q39.63 -2.81 39.36 -3Q39.08 -3.19 38.94 -3.48Q38.79 -3.77 38.79 -4.17Q38.79 -4.65 39.04 -5.02Q39.3 -5.4 39.78 -5.61Q40.26 -5.82 40.91 -5.82Q41.87 -5.82 42.42 -5.38Q42.98 -4.95 43.08 -4.16H42.02Q41.96 -4.52 41.67 -4.72Q41.38 -4.92 40.9 -4.92Q40.4 -4.92 40.14 -4.74Q39.88 -4.55 39.88 -4.24Q39.88 -4.02 40.01 -3.85Q40.14 -3.68 40.42 -3.56Q40.71 -3.44 41.17 -3.37Q41.82 -3.27 42.28 -3.1Q42.74 -2.93 42.99 -2.59Q43.25 -2.26 43.24 -1.66Q43.24 -1.1 42.97 -0.7Q42.69 -0.3 42.2 -0.08Q41.71 0.13 41.04 0.13ZM44.65 0V-5.69H45.75V0ZM45.2 -6.69Q44.89 -6.69 44.68 -6.89Q44.48 -7.09 44.48 -7.39Q44.48 -7.69 44.68 -7.88Q44.89 -8.07 45.2 -8.07Q45.51 -8.07 45.72 -7.88Q45.93 -7.69 45.93 -7.39Q45.93 -7.09 45.72 -6.89Q45.51 -6.69 45.2 -6.69ZM47.35 0V-5.69H48.33L48.4 -4.77Q48.65 -5.26 49.13 -5.54Q49.61 -5.82 50.24 -5.82Q50.89 -5.82 51.37 -5.56Q51.84 -5.31 52.1 -4.79Q52.36 -4.28 52.36 -3.51V0H51.26V-3.4Q51.26 -4.13 50.91 -4.51Q50.57 -4.88 49.94 -4.88Q49.53 -4.88 49.19 -4.69Q48.85 -4.49 48.65 -4.12Q48.45 -3.74 48.45 -3.2V0ZM56.14 2.55Q55.35 2.55 54.77 2.36Q54.18 2.17 53.85 1.77Q53.53 1.38 53.53 0.8Q53.53 0.49 53.66 0.18Q53.8 -0.13 54.09 -0.41Q54.39 -0.68 54.89 -0.9L55.55 -0.41Q54.96 -0.19 54.77 0.1Q54.57 0.4 54.57 0.69Q54.57 1.02 54.77 1.24Q54.97 1.46 55.32 1.57Q55.67 1.68 56.13 1.68Q56.58 1.68 56.91 1.56Q57.23 1.45 57.41 1.23Q57.59 1.01 57.59 0.72Q57.59 0.32 57.32 0.08Q57.06 -0.15 56.27 -0.19Q55.64 -0.24 55.19 -0.32Q54.75 -0.4 54.45 -0.5Q54.14 -0.61 53.94 -0.75Q53.73 -0.88 53.58 -1.02V-1.28L54.7 -2.39L55.62 -2.09L54.38 -0.99L54.61 -1.5Q54.73 -1.42 54.84 -1.35Q54.96 -1.28 55.15 -1.22Q55.33 -1.16 55.66 -1.11Q55.99 -1.06 56.52 -1.02Q57.29 -0.96 57.75 -0.76Q58.22 -0.55 58.43 -0.19Q58.64 0.17 58.64 0.68Q58.64 1.16 58.38 1.58Q58.12 2.01 57.56 2.28Q57.01 2.55 56.14 2.55ZM56.13 -1.75Q55.43 -1.75 54.94 -2.01Q54.45 -2.28 54.19 -2.75Q53.93 -3.21 53.93 -3.78Q53.93 -4.36 54.19 -4.81Q54.45 -5.27 54.94 -5.55Q55.44 -5.82 56.13 -5.82Q56.84 -5.82 57.33 -5.55Q57.82 -5.27 58.08 -4.81Q58.33 -4.36 58.33 -3.78Q58.33 -3.21 58.08 -2.75Q57.82 -2.28 57.33 -2.01Q56.84 -1.75 56.13 -1.75ZM56.13 -2.62Q56.69 -2.62 57 -2.91Q57.32 -3.2 57.32 -3.78Q57.32 -4.35 57 -4.64Q56.69 -4.93 56.13 -4.93Q55.6 -4.93 55.26 -4.64Q54.93 -4.35 54.93 -3.78Q54.93 -3.2 55.25 -2.91Q55.58 -2.62 56.13 -2.62ZM57.08 -4.82 56.81 -5.69H59.08V-4.94ZM65.36 0Q64.84 0 64.45 -0.16Q64.06 -0.33 63.85 -0.71Q63.65 -1.1 63.65 -1.76V-4.76H62.66V-5.69H63.65L63.78 -7.14H64.75V-5.69H66.33V-4.76H64.75V-1.75Q64.75 -1.28 64.94 -1.11Q65.14 -0.94 65.62 -0.94H66.3V0ZM70.12 0.13Q69.32 0.13 68.7 -0.24Q68.08 -0.61 67.73 -1.28Q67.38 -1.95 67.38 -2.84Q67.38 -3.74 67.73 -4.41Q68.08 -5.08 68.71 -5.45Q69.34 -5.82 70.13 -5.82Q70.94 -5.82 71.56 -5.45Q72.18 -5.08 72.53 -4.41Q72.88 -3.74 72.88 -2.84Q72.88 -1.95 72.53 -1.28Q72.17 -0.61 71.55 -0.24Q70.93 0.13 70.12 0.13ZM70.12 -0.81Q70.58 -0.81 70.95 -1.04Q71.32 -1.27 71.54 -1.72Q71.76 -2.17 71.76 -2.84Q71.76 -3.52 71.54 -3.97Q71.33 -4.42 70.96 -4.65Q70.59 -4.87 70.14 -4.87Q69.69 -4.87 69.31 -4.65Q68.94 -4.42 68.72 -3.97Q68.5 -3.52 68.5 -2.84Q68.5 -2.17 68.72 -1.72Q68.94 -1.27 69.3 -1.04Q69.67 -0.81 70.12 -0.81ZM76.73 0.13Q75.93 0.13 75.31 -0.24Q74.69 -0.61 74.34 -1.28Q73.99 -1.95 73.99 -2.84Q73.99 -3.74 74.34 -4.41Q74.7 -5.08 75.32 -5.45Q75.95 -5.82 76.75 -5.82Q77.55 -5.82 78.17 -5.45Q78.79 -5.08 79.14 -4.41Q79.49 -3.74 79.49 -2.84Q79.49 -1.95 79.14 -1.28Q78.78 -0.61 78.16 -0.24Q77.54 0.13 76.73 0.13ZM76.73 -0.81Q77.19 -0.81 77.56 -1.04Q77.93 -1.27 78.15 -1.72Q78.37 -2.17 78.37 -2.84Q78.37 -3.52 78.15 -3.97Q77.94 -4.42 77.57 -4.65Q77.21 -4.87 76.75 -4.87Q76.3 -4.87 75.93 -4.65Q75.55 -4.42 75.33 -3.97Q75.11 -3.52 75.11 -2.84Q75.11 -2.17 75.33 -1.72Q75.55 -1.27 75.91 -1.04Q76.28 -0.81 76.73 -0.81ZM80.81 0V-7.92H81.91V0ZM83.9 0.05Q83.59 0.05 83.39 -0.15Q83.18 -0.35 83.18 -0.64Q83.18 -0.94 83.39 -1.14Q83.59 -1.34 83.9 -1.34Q84.22 -1.34 84.42 -1.14Q84.62 -0.94 84.62 -0.64Q84.62 -0.35 84.42 -0.15Q84.22 0.05 83.9 0.05ZM87.71 0.13Q87.04 0.13 86.59 -0.11Q86.15 -0.35 85.93 -0.75Q85.71 -1.15 85.71 -1.62Q85.71 -2.17 85.99 -2.56Q86.27 -2.96 86.8 -3.17Q87.33 -3.38 88.06 -3.38H89.48Q89.48 -3.89 89.35 -4.23Q89.23 -4.57 88.95 -4.74Q88.67 -4.9 88.22 -4.9Q87.74 -4.9 87.41 -4.68Q87.07 -4.45 86.99 -4H85.89Q85.95 -4.58 86.28 -4.98Q86.6 -5.39 87.11 -5.6Q87.62 -5.82 88.22 -5.82Q89 -5.82 89.53 -5.54Q90.05 -5.27 90.32 -4.77Q90.58 -4.27 90.58 -3.58V0H89.62L89.53 -0.94Q89.42 -0.72 89.25 -0.52Q89.08 -0.33 88.85 -0.18Q88.63 -0.03 88.34 0.05Q88.05 0.13 87.71 0.13ZM87.91 -0.76Q88.25 -0.76 88.53 -0.91Q88.81 -1.05 89.02 -1.31Q89.23 -1.56 89.34 -1.87Q89.45 -2.19 89.46 -2.54V-2.6H88.17Q87.7 -2.6 87.41 -2.49Q87.12 -2.37 86.99 -2.16Q86.87 -1.95 86.87 -1.69Q86.87 -1.4 86.99 -1.2Q87.11 -0.99 87.35 -0.88Q87.58 -0.76 87.91 -0.76ZM94.47 0.13Q93.7 0.13 93.1 -0.25Q92.51 -0.64 92.18 -1.31Q91.85 -1.99 91.85 -2.84Q91.85 -3.71 92.18 -4.38Q92.52 -5.05 93.12 -5.43Q93.72 -5.82 94.51 -5.82Q95.15 -5.82 95.63 -5.56Q96.11 -5.31 96.39 -4.84V-7.92H97.49V0H96.5L96.4 -0.87Q96.23 -0.61 95.97 -0.38Q95.71 -0.15 95.34 -0.01Q94.97 0.13 94.47 0.13ZM94.67 -0.82Q95.19 -0.82 95.57 -1.07Q95.96 -1.32 96.17 -1.78Q96.38 -2.23 96.38 -2.84Q96.38 -3.46 96.17 -3.91Q95.96 -4.37 95.57 -4.61Q95.19 -4.86 94.67 -4.86Q94.18 -4.86 93.8 -4.61Q93.41 -4.37 93.19 -3.91Q92.97 -3.46 92.97 -2.85Q92.97 -2.23 93.19 -1.78Q93.41 -1.32 93.8 -1.07Q94.18 -0.82 94.67 -0.82ZM97.96 2.42V1.48H98.39Q98.79 1.48 98.96 1.32Q99.12 1.16 99.12 0.77V-5.69H100.22V0.79Q100.22 1.37 100.03 1.73Q99.83 2.08 99.46 2.25Q99.09 2.42 98.56 2.42ZM99.68 -6.69Q99.37 -6.69 99.16 -6.89Q98.96 -7.09 98.96 -7.39Q98.96 -7.69 99.16 -7.88Q99.37 -8.07 99.68 -8.07Q99.99 -8.07 100.2 -7.88Q100.4 -7.69 100.4 -7.39Q100.4 -7.09 100.2 -6.89Q99.99 -6.69 99.68 -6.69ZM101.88 0V-5.69H102.98V0ZM102.44 -6.69Q102.12 -6.69 101.92 -6.89Q101.71 -7.09 101.71 -7.39Q101.71 -7.69 101.92 -7.88Q102.12 -8.07 102.44 -8.07Q102.74 -8.07 102.95 -7.88Q103.16 -7.69 103.16 -7.39Q103.16 -7.09 102.95 -6.89Q102.74 -6.69 102.44 -6.69ZM107.06 0.13Q106.27 0.13 105.66 -0.24Q105.06 -0.61 104.71 -1.27Q104.37 -1.94 104.37 -2.83Q104.37 -3.72 104.71 -4.4Q105.05 -5.07 105.66 -5.44Q106.28 -5.82 107.08 -5.82Q107.91 -5.82 108.49 -5.45Q109.07 -5.08 109.37 -4.46Q109.68 -3.84 109.68 -3.09Q109.68 -2.98 109.68 -2.86Q109.68 -2.74 109.66 -2.59H105.18V-3.36H108.59Q108.56 -4.1 108.13 -4.5Q107.71 -4.91 107.07 -4.91Q106.63 -4.91 106.26 -4.7Q105.89 -4.49 105.67 -4.08Q105.45 -3.67 105.45 -3.05V-2.74Q105.45 -2.11 105.67 -1.67Q105.89 -1.23 106.25 -1.01Q106.62 -0.78 107.06 -0.78Q107.61 -0.78 107.94 -1Q108.26 -1.22 108.42 -1.61H109.52Q109.38 -1.11 109.05 -0.72Q108.71 -0.32 108.21 -0.1Q107.71 0.13 107.06 0.13ZM113.95 0.13Q113.46 0.13 113.09 -0.01Q112.73 -0.15 112.47 -0.37Q112.2 -0.6 112.04 -0.84L111.93 0H110.94V-7.92H112.04V-4.82Q112.31 -5.29 112.8 -5.55Q113.29 -5.82 113.93 -5.82Q114.72 -5.82 115.32 -5.44Q115.92 -5.05 116.25 -4.39Q116.58 -3.72 116.58 -2.86Q116.58 -2 116.25 -1.32Q115.92 -0.64 115.33 -0.26Q114.74 0.13 113.95 0.13ZM113.76 -0.82Q114.25 -0.82 114.63 -1.07Q115.02 -1.32 115.24 -1.77Q115.46 -2.23 115.46 -2.84Q115.46 -3.46 115.24 -3.91Q115.02 -4.37 114.63 -4.61Q114.25 -4.86 113.76 -4.86Q113.25 -4.86 112.86 -4.61Q112.47 -4.37 112.26 -3.91Q112.05 -3.46 112.05 -2.84Q112.05 -2.23 112.26 -1.77Q112.47 -1.32 112.86 -1.07Q113.25 -0.82 113.76 -0.82ZM117.9 0V-5.69H118.89L118.98 -4.65Q119.18 -5.03 119.49 -5.29Q119.8 -5.55 120.24 -5.68Q120.67 -5.82 121.2 -5.82V-4.66H120.66Q120.33 -4.66 120.03 -4.58Q119.74 -4.5 119.5 -4.3Q119.27 -4.11 119.14 -3.79Q119 -3.46 119 -2.96V0ZM124.78 0.13Q123.98 0.13 123.36 -0.24Q122.73 -0.61 122.38 -1.28Q122.03 -1.95 122.03 -2.84Q122.03 -3.74 122.39 -4.41Q122.74 -5.08 123.37 -5.45Q124 -5.82 124.79 -5.82Q125.6 -5.82 126.22 -5.45Q126.84 -5.08 127.19 -4.41Q127.54 -3.74 127.54 -2.84Q127.54 -1.95 127.18 -1.28Q126.83 -0.61 126.21 -0.24Q125.58 0.13 124.78 0.13ZM124.78 -0.81Q125.24 -0.81 125.61 -1.04Q125.98 -1.27 126.2 -1.72Q126.41 -2.17 126.41 -2.84Q126.41 -3.52 126.2 -3.97Q125.99 -4.42 125.62 -4.65Q125.25 -4.87 124.79 -4.87Q124.35 -4.87 123.97 -4.65Q123.6 -4.42 123.38 -3.97Q123.16 -3.52 123.16 -2.84Q123.16 -2.17 123.38 -1.72Q123.59 -1.27 123.96 -1.04Q124.33 -0.81 124.78 -0.81ZM131.18 0Q130.66 0 130.27 -0.16Q129.89 -0.33 129.68 -0.71Q129.47 -1.1 129.47 -1.76V-4.76H128.48V-5.69H129.47L129.61 -7.14H130.57V-5.69H132.15V-4.76H130.57V-1.75Q130.57 -1.28 130.77 -1.11Q130.96 -0.94 131.45 -0.94H132.13V0ZM135.94 0.13Q135.14 0.13 134.52 -0.24Q133.9 -0.61 133.55 -1.28Q133.2 -1.95 133.2 -2.84Q133.2 -3.74 133.55 -4.41Q133.91 -5.08 134.53 -5.45Q135.16 -5.82 135.96 -5.82Q136.77 -5.82 137.39 -5.45Q138 -5.08 138.35 -4.41Q138.7 -3.74 138.7 -2.84Q138.7 -1.95 138.35 -1.28Q137.99 -0.61 137.37 -0.24Q136.75 0.13 135.94 0.13ZM135.94 -0.81Q136.4 -0.81 136.77 -1.04Q137.14 -1.27 137.36 -1.72Q137.58 -2.17 137.58 -2.84Q137.58 -3.52 137.37 -3.97Q137.15 -4.42 136.79 -4.65Q136.42 -4.87 135.96 -4.87Q135.51 -4.87 135.14 -4.65Q134.77 -4.42 134.54 -3.97Q134.32 -3.52 134.32 -2.84Q134.32 -2.17 134.54 -1.72Q134.76 -1.27 135.13 -1.04Q135.49 -0.81 135.94 -0.81ZM142.35 0Q141.82 0 141.44 -0.16Q141.05 -0.33 140.84 -0.71Q140.64 -1.1 140.64 -1.76V-4.76H139.65V-5.69H140.64L140.77 -7.14H141.74V-5.69H143.32V-4.76H141.74V-1.75Q141.74 -1.28 141.93 -1.11Q142.13 -0.94 142.61 -0.94H143.29V0ZM146.72 0.13Q145.95 0.13 145.43 -0.11Q144.9 -0.34 144.62 -0.77Q144.34 -1.19 144.28 -1.75H145.39Q145.44 -1.48 145.59 -1.26Q145.75 -1.03 146.03 -0.9Q146.31 -0.76 146.72 -0.76Q147.07 -0.76 147.31 -0.87Q147.55 -0.97 147.68 -1.16Q147.8 -1.34 147.8 -1.58Q147.8 -1.9 147.65 -2.07Q147.5 -2.25 147.21 -2.35Q146.92 -2.44 146.5 -2.5Q146.05 -2.58 145.68 -2.69Q145.31 -2.81 145.03 -3Q144.76 -3.19 144.61 -3.48Q144.46 -3.77 144.46 -4.17Q144.46 -4.65 144.72 -5.02Q144.98 -5.4 145.46 -5.61Q145.93 -5.82 146.59 -5.82Q147.54 -5.82 148.1 -5.38Q148.66 -4.95 148.76 -4.16H147.7Q147.64 -4.52 147.35 -4.72Q147.06 -4.92 146.58 -4.92Q146.08 -4.92 145.82 -4.74Q145.56 -4.55 145.56 -4.24Q145.56 -4.02 145.68 -3.85Q145.81 -3.68 146.1 -3.56Q146.39 -3.44 146.85 -3.37Q147.49 -3.27 147.96 -3.1Q148.42 -2.93 148.67 -2.59Q148.92 -2.26 148.92 -1.66Q148.92 -1.1 148.64 -0.7Q148.37 -0.3 147.88 -0.08Q147.39 0.13 146.72 0.13ZM150.72 0.05Q150.4 0.05 150.2 -0.15Q150 -0.35 150 -0.64Q150 -0.94 150.2 -1.14Q150.4 -1.34 150.72 -1.34Q151.04 -1.34 151.23 -1.14Q151.43 -0.94 151.43 -0.64Q151.43 -0.35 151.23 -0.15Q151.04 0.05 150.72 0.05ZM155.25 0.13Q154.45 0.13 153.82 -0.24Q153.19 -0.62 152.84 -1.29Q152.48 -1.95 152.48 -2.83Q152.48 -3.73 152.84 -4.4Q153.19 -5.07 153.82 -5.44Q154.45 -5.82 155.25 -5.82Q156.27 -5.82 156.95 -5.28Q157.63 -4.75 157.82 -3.83H156.68Q156.57 -4.33 156.17 -4.6Q155.78 -4.88 155.24 -4.88Q154.78 -4.88 154.4 -4.64Q154.03 -4.41 153.82 -3.96Q153.61 -3.51 153.61 -2.84Q153.61 -2.35 153.73 -1.97Q153.85 -1.58 154.07 -1.32Q154.29 -1.07 154.59 -0.93Q154.89 -0.8 155.24 -0.8Q155.6 -0.8 155.9 -0.92Q156.19 -1.05 156.4 -1.29Q156.61 -1.53 156.68 -1.86H157.82Q157.64 -0.96 156.95 -0.41Q156.26 0.13 155.25 0.13ZM161.67 0.13Q160.87 0.13 160.25 -0.24Q159.63 -0.61 159.28 -1.28Q158.93 -1.95 158.93 -2.84Q158.93 -3.74 159.28 -4.41Q159.64 -5.08 160.26 -5.45Q160.89 -5.82 161.69 -5.82Q162.5 -5.82 163.11 -5.45Q163.73 -5.08 164.08 -4.41Q164.43 -3.74 164.43 -2.84Q164.43 -1.95 164.08 -1.28Q163.72 -0.61 163.1 -0.24Q162.48 0.13 161.67 0.13ZM161.67 -0.81Q162.13 -0.81 162.5 -1.04Q162.87 -1.27 163.09 -1.72Q163.31 -2.17 163.31 -2.84Q163.31 -3.52 163.1 -3.97Q162.88 -4.42 162.52 -4.65Q162.15 -4.87 161.69 -4.87Q161.24 -4.87 160.87 -4.65Q160.49 -4.42 160.27 -3.97Q160.05 -3.52 160.05 -2.84Q160.05 -2.17 160.27 -1.72Q160.49 -1.27 160.86 -1.04Q161.22 -0.81 161.67 -0.81ZM165.75 0V-5.69H166.74L166.81 -4.91Q167.07 -5.33 167.52 -5.58Q167.96 -5.82 168.49 -5.82Q168.9 -5.82 169.24 -5.71Q169.57 -5.59 169.83 -5.37Q170.08 -5.14 170.24 -4.8Q170.54 -5.29 171.03 -5.55Q171.52 -5.82 172.08 -5.82Q172.74 -5.82 173.21 -5.56Q173.68 -5.3 173.92 -4.78Q174.17 -4.27 174.17 -3.5V0H173.08V-3.39Q173.08 -4.13 172.77 -4.51Q172.45 -4.88 171.88 -4.88Q171.49 -4.88 171.18 -4.68Q170.87 -4.49 170.69 -4.1Q170.51 -3.72 170.51 -3.17V0H169.42V-3.39Q169.42 -4.13 169.1 -4.51Q168.78 -4.88 168.21 -4.88Q167.84 -4.88 167.53 -4.68Q167.22 -4.49 167.04 -4.1Q166.85 -3.72 166.85 -3.17V0ZM175.19 1.11 177.95 -8.46H179.02L176.27 1.11ZM182.65 0.13Q181.85 0.13 181.22 -0.24Q180.6 -0.62 180.24 -1.29Q179.88 -1.95 179.88 -2.83Q179.88 -3.73 180.24 -4.4Q180.6 -5.07 181.22 -5.44Q181.85 -5.82 182.65 -5.82Q183.67 -5.82 184.35 -5.28Q185.03 -4.75 185.22 -3.83H184.08Q183.97 -4.33 183.57 -4.6Q183.18 -4.88 182.64 -4.88Q182.18 -4.88 181.81 -4.64Q181.43 -4.41 181.22 -3.96Q181.01 -3.51 181.01 -2.84Q181.01 -2.35 181.13 -1.97Q181.25 -1.58 181.47 -1.32Q181.69 -1.07 181.99 -0.93Q182.29 -0.8 182.64 -0.8Q183.01 -0.8 183.3 -0.92Q183.6 -1.05 183.8 -1.29Q184.01 -1.53 184.08 -1.86H185.22Q185.04 -0.96 184.35 -0.41Q183.66 0.13 182.65 0.13ZM188.37 0.13Q187.7 0.13 187.25 -0.11Q186.81 -0.35 186.59 -0.75Q186.37 -1.15 186.37 -1.62Q186.37 -2.17 186.65 -2.56Q186.93 -2.96 187.46 -3.17Q187.99 -3.38 188.72 -3.38H190.14Q190.14 -3.89 190.01 -4.23Q189.89 -4.57 189.61 -4.74Q189.33 -4.9 188.88 -4.9Q188.4 -4.9 188.07 -4.68Q187.73 -4.45 187.65 -4H186.55Q186.61 -4.58 186.94 -4.98Q187.26 -5.39 187.77 -5.6Q188.29 -5.82 188.88 -5.82Q189.66 -5.82 190.19 -5.54Q190.71 -5.27 190.98 -4.77Q191.24 -4.27 191.24 -3.58V0H190.28L190.19 -0.94Q190.08 -0.72 189.91 -0.52Q189.74 -0.33 189.51 -0.18Q189.29 -0.03 189 0.05Q188.71 0.13 188.37 0.13ZM188.57 -0.76Q188.91 -0.76 189.19 -0.91Q189.48 -1.05 189.68 -1.31Q189.89 -1.56 190 -1.87Q190.11 -2.19 190.12 -2.54V-2.6H188.83Q188.36 -2.6 188.07 -2.49Q187.78 -2.37 187.66 -2.16Q187.53 -1.95 187.53 -1.69Q187.53 -1.4 187.65 -1.2Q187.77 -0.99 188.01 -0.88Q188.24 -0.76 188.57 -0.76ZM192.73 2.42V-5.69H193.71L193.82 -4.83Q194 -5.1 194.26 -5.32Q194.52 -5.55 194.89 -5.68Q195.25 -5.82 195.73 -5.82Q196.52 -5.82 197.12 -5.43Q197.71 -5.04 198.04 -4.37Q198.37 -3.7 198.37 -2.83Q198.37 -1.98 198.03 -1.31Q197.7 -0.64 197.1 -0.25Q196.51 0.13 195.73 0.13Q195.08 0.13 194.59 -0.13Q194.1 -0.39 193.83 -0.85V2.42ZM195.54 -0.82Q196.04 -0.82 196.42 -1.07Q196.8 -1.32 197.02 -1.77Q197.25 -2.23 197.25 -2.84Q197.25 -3.46 197.02 -3.91Q196.8 -4.37 196.42 -4.61Q196.04 -4.86 195.54 -4.86Q195.03 -4.86 194.65 -4.61Q194.26 -4.37 194.05 -3.91Q193.83 -3.46 193.83 -2.84Q193.83 -2.23 194.05 -1.77Q194.26 -1.32 194.65 -1.07Q195.03 -0.82 195.54 -0.82ZM201.51 0.13Q200.84 0.13 200.4 -0.11Q199.95 -0.35 199.73 -0.75Q199.52 -1.15 199.52 -1.62Q199.52 -2.17 199.8 -2.56Q200.08 -2.96 200.61 -3.17Q201.13 -3.38 201.87 -3.38H203.29Q203.29 -3.89 203.16 -4.23Q203.03 -4.57 202.76 -4.74Q202.48 -4.9 202.02 -4.9Q201.55 -4.9 201.21 -4.68Q200.88 -4.45 200.8 -4H199.7Q199.76 -4.58 200.08 -4.98Q200.41 -5.39 200.92 -5.6Q201.43 -5.82 202.03 -5.82Q202.81 -5.82 203.33 -5.54Q203.86 -5.27 204.12 -4.77Q204.39 -4.27 204.39 -3.58V0H203.43L203.34 -0.94Q203.23 -0.72 203.06 -0.52Q202.89 -0.33 202.66 -0.18Q202.43 -0.03 202.15 0.05Q201.86 0.13 201.51 0.13ZM201.72 -0.76Q202.06 -0.76 202.34 -0.91Q202.62 -1.05 202.83 -1.31Q203.03 -1.56 203.14 -1.87Q203.26 -2.19 203.27 -2.54V-2.6H201.97Q201.51 -2.6 201.22 -2.49Q200.93 -2.37 200.8 -2.16Q200.67 -1.95 200.67 -1.69Q200.67 -1.4 200.79 -1.2Q200.92 -0.99 201.15 -0.88Q201.39 -0.76 201.72 -0.76ZM208.43 0.13Q207.62 0.13 206.99 -0.24Q206.37 -0.62 206.01 -1.29Q205.66 -1.95 205.66 -2.83Q205.66 -3.73 206.01 -4.4Q206.37 -5.07 206.99 -5.44Q207.62 -5.82 208.43 -5.82Q209.44 -5.82 210.12 -5.28Q210.81 -4.75 211 -3.83H209.85Q209.74 -4.33 209.35 -4.6Q208.95 -4.88 208.41 -4.88Q207.95 -4.88 207.58 -4.64Q207.21 -4.41 206.99 -3.96Q206.78 -3.51 206.78 -2.84Q206.78 -2.35 206.9 -1.97Q207.03 -1.58 207.24 -1.32Q207.46 -1.07 207.76 -0.93Q208.06 -0.8 208.41 -0.8Q208.78 -0.8 209.07 -0.92Q209.37 -1.05 209.57 -1.29Q209.78 -1.53 209.85 -1.86H211Q210.81 -0.96 210.12 -0.41Q209.43 0.13 208.43 0.13ZM212.39 0V-5.69H213.49V0ZM212.94 -6.69Q212.63 -6.69 212.42 -6.89Q212.22 -7.09 212.22 -7.39Q212.22 -7.69 212.42 -7.88Q212.63 -8.07 212.94 -8.07Q213.25 -8.07 213.46 -7.88Q213.67 -7.69 213.67 -7.39Q213.67 -7.09 213.46 -6.89Q213.25 -6.69 212.94 -6.69ZM217.41 0Q216.89 0 216.5 -0.16Q216.12 -0.33 215.91 -0.71Q215.7 -1.1 215.7 -1.76V-4.76H214.71V-5.69H215.7L215.84 -7.14H216.8V-5.69H218.38V-4.76H216.8V-1.75Q216.8 -1.28 217 -1.11Q217.19 -0.94 217.68 -0.94H218.36V0ZM220.31 2.42 221.63 -0.62H221.3L219.12 -5.69H220.31L222.04 -1.53L223.78 -5.69H224.93L221.46 2.42ZM228.42 0.13Q227.63 0.13 227.02 -0.24Q226.41 -0.61 226.06 -1.27Q225.72 -1.94 225.72 -2.83Q225.72 -3.72 226.06 -4.4Q226.4 -5.07 227.02 -5.44Q227.63 -5.82 228.43 -5.82Q229.26 -5.82 229.84 -5.45Q230.42 -5.08 230.72 -4.46Q231.03 -3.84 231.03 -3.09Q231.03 -2.98 231.03 -2.86Q231.03 -2.74 231.01 -2.59H226.53V-3.36H229.94Q229.92 -4.1 229.49 -4.5Q229.06 -4.91 228.42 -4.91Q227.98 -4.91 227.61 -4.7Q227.25 -4.49 227.02 -4.08Q226.8 -3.67 226.8 -3.05V-2.74Q226.8 -2.11 227.02 -1.67Q227.24 -1.23 227.6 -1.01Q227.97 -0.78 228.41 -0.78Q228.96 -0.78 229.29 -1Q229.62 -1.22 229.77 -1.61H230.87Q230.73 -1.11 230.4 -0.72Q230.06 -0.32 229.56 -0.1Q229.06 0.13 228.42 0.13ZM231.78 0 233.67 -2.85 231.78 -5.69H232.97L234.38 -3.52L235.79 -5.69H236.98L235.08 -2.85L236.98 0H235.79L234.38 -2.21L232.98 0ZM237.99 2.42V-5.69H238.98L239.09 -4.83Q239.26 -5.1 239.52 -5.32Q239.78 -5.55 240.15 -5.68Q240.52 -5.82 241 -5.82Q241.79 -5.82 242.38 -5.43Q242.97 -5.04 243.3 -4.37Q243.63 -3.7 243.63 -2.83Q243.63 -1.98 243.3 -1.31Q242.96 -0.64 242.37 -0.25Q241.77 0.13 241 0.13Q240.34 0.13 239.85 -0.13Q239.36 -0.39 239.09 -0.85V2.42ZM240.81 -0.82Q241.3 -0.82 241.68 -1.07Q242.07 -1.32 242.29 -1.77Q242.51 -2.23 242.51 -2.84Q242.51 -3.46 242.29 -3.91Q242.07 -4.37 241.68 -4.61Q241.3 -4.86 240.81 -4.86Q240.3 -4.86 239.91 -4.61Q239.52 -4.37 239.31 -3.91Q239.1 -3.46 239.1 -2.84Q239.1 -2.23 239.31 -1.77Q239.52 -1.32 239.91 -1.07Q240.3 -0.82 240.81 -0.82ZM246.78 0.13Q246.11 0.13 245.66 -0.11Q245.22 -0.35 245 -0.75Q244.78 -1.15 244.78 -1.62Q244.78 -2.17 245.06 -2.56Q245.34 -2.96 245.87 -3.17Q246.4 -3.38 247.13 -3.38H248.55Q248.55 -3.89 248.42 -4.23Q248.3 -4.57 248.02 -4.74Q247.74 -4.9 247.29 -4.9Q246.81 -4.9 246.48 -4.68Q246.14 -4.45 246.06 -4H244.96Q245.02 -4.58 245.35 -4.98Q245.67 -5.39 246.18 -5.6Q246.7 -5.82 247.29 -5.82Q248.07 -5.82 248.6 -5.54Q249.12 -5.27 249.39 -4.77Q249.65 -4.27 249.65 -3.58V0H248.69L248.6 -0.94Q248.49 -0.72 248.32 -0.52Q248.15 -0.33 247.92 -0.18Q247.7 -0.03 247.41 0.05Q247.12 0.13 246.78 0.13ZM246.98 -0.76Q247.32 -0.76 247.6 -0.91Q247.89 -1.05 248.09 -1.31Q248.3 -1.56 248.41 -1.87Q248.52 -2.19 248.53 -2.54V-2.6H247.24Q246.77 -2.6 246.48 -2.49Q246.19 -2.37 246.07 -2.16Q245.94 -1.95 245.94 -1.69Q245.94 -1.4 246.06 -1.2Q246.18 -0.99 246.42 -0.88Q246.65 -0.76 246.98 -0.76ZM251.14 0V-5.69H252.12L252.19 -4.77Q252.44 -5.26 252.92 -5.54Q253.39 -5.82 254.03 -5.82Q254.68 -5.82 255.15 -5.56Q255.63 -5.31 255.89 -4.79Q256.15 -4.28 256.15 -3.51V0H255.05V-3.4Q255.05 -4.13 254.7 -4.51Q254.35 -4.88 253.73 -4.88Q253.32 -4.88 252.98 -4.69Q252.64 -4.49 252.44 -4.12Q252.24 -3.74 252.24 -3.2V0ZM259.78 0.13Q259.01 0.13 258.49 -0.11Q257.96 -0.34 257.68 -0.77Q257.39 -1.19 257.34 -1.75H258.45Q258.5 -1.48 258.65 -1.26Q258.8 -1.03 259.08 -0.9Q259.36 -0.76 259.78 -0.76Q260.13 -0.76 260.37 -0.87Q260.61 -0.97 260.73 -1.16Q260.86 -1.34 260.86 -1.58Q260.86 -1.9 260.71 -2.07Q260.55 -2.25 260.27 -2.35Q259.98 -2.44 259.56 -2.5Q259.11 -2.58 258.74 -2.69Q258.36 -2.81 258.09 -3Q257.82 -3.19 257.67 -3.48Q257.52 -3.77 257.52 -4.17Q257.52 -4.65 257.78 -5.02Q258.04 -5.4 258.51 -5.61Q258.99 -5.82 259.65 -5.82Q260.6 -5.82 261.16 -5.38Q261.72 -4.95 261.82 -4.16H260.75Q260.7 -4.52 260.41 -4.72Q260.12 -4.92 259.64 -4.92Q259.13 -4.92 258.87 -4.74Q258.62 -4.55 258.62 -4.24Q258.62 -4.02 258.74 -3.85Q258.87 -3.68 259.16 -3.56Q259.44 -3.44 259.9 -3.37Q260.55 -3.27 261.01 -3.1Q261.48 -2.93 261.73 -2.59Q261.98 -2.26 261.97 -1.66Q261.98 -1.1 261.7 -0.7Q261.43 -0.3 260.94 -0.08Q260.44 0.13 259.78 0.13ZM263.39 0V-5.69H264.49V0ZM263.94 -6.69Q263.62 -6.69 263.42 -6.89Q263.21 -7.09 263.21 -7.39Q263.21 -7.69 263.42 -7.88Q263.62 -8.07 263.94 -8.07Q264.25 -8.07 264.46 -7.88Q264.67 -7.69 264.67 -7.39Q264.67 -7.09 264.46 -6.89Q264.25 -6.69 263.94 -6.69ZM268.61 0.13Q267.81 0.13 267.19 -0.24Q266.57 -0.61 266.22 -1.28Q265.87 -1.95 265.87 -2.84Q265.87 -3.74 266.22 -4.41Q266.58 -5.08 267.21 -5.45Q267.83 -5.82 268.63 -5.82Q269.44 -5.82 270.06 -5.45Q270.67 -5.08 271.02 -4.41Q271.37 -3.74 271.37 -2.84Q271.37 -1.95 271.02 -1.28Q270.67 -0.61 270.04 -0.24Q269.42 0.13 268.61 0.13ZM268.61 -0.81Q269.07 -0.81 269.44 -1.04Q269.81 -1.27 270.03 -1.72Q270.25 -2.17 270.25 -2.84Q270.25 -3.52 270.04 -3.97Q269.82 -4.42 269.46 -4.65Q269.09 -4.87 268.63 -4.87Q268.18 -4.87 267.81 -4.65Q267.44 -4.42 267.22 -3.97Q266.99 -3.52 266.99 -2.84Q266.99 -2.17 267.21 -1.72Q267.43 -1.27 267.8 -1.04Q268.16 -0.81 268.61 -0.81ZM272.7 0V-5.69H273.68L273.75 -4.77Q274 -5.26 274.48 -5.54Q274.95 -5.82 275.59 -5.82Q276.24 -5.82 276.71 -5.56Q277.19 -5.31 277.45 -4.79Q277.71 -4.28 277.71 -3.51V0H276.61V-3.4Q276.61 -4.13 276.26 -4.51Q275.91 -4.88 275.29 -4.88Q274.88 -4.88 274.54 -4.69Q274.2 -4.49 274 -4.12Q273.8 -3.74 273.8 -3.2V0ZM279.24 -2.88V-3.81H283.68V-2.88ZM285.25 2.42V-5.69H286.24L286.34 -4.83Q286.52 -5.1 286.78 -5.32Q287.04 -5.55 287.41 -5.68Q287.77 -5.82 288.25 -5.82Q289.05 -5.82 289.64 -5.43Q290.23 -5.04 290.56 -4.37Q290.89 -3.7 290.89 -2.83Q290.89 -1.98 290.55 -1.31Q290.22 -0.64 289.62 -0.25Q289.03 0.13 288.26 0.13Q287.6 0.13 287.11 -0.13Q286.62 -0.39 286.35 -0.85V2.42ZM288.06 -0.82Q288.56 -0.82 288.94 -1.07Q289.32 -1.32 289.55 -1.77Q289.77 -2.23 289.77 -2.84Q289.77 -3.46 289.55 -3.91Q289.32 -4.37 288.94 -4.61Q288.56 -4.86 288.06 -4.86Q287.55 -4.86 287.17 -4.61Q286.78 -4.37 286.57 -3.91Q286.36 -3.46 286.36 -2.84Q286.36 -2.23 286.57 -1.77Q286.78 -1.32 287.17 -1.07Q287.55 -0.82 288.06 -0.82ZM292.21 0V-7.92H293.31V0ZM296.66 0.13Q295.99 0.13 295.55 -0.11Q295.1 -0.35 294.88 -0.75Q294.67 -1.15 294.67 -1.62Q294.67 -2.17 294.95 -2.56Q295.23 -2.96 295.76 -3.17Q296.28 -3.38 297.02 -3.38H298.44Q298.44 -3.89 298.31 -4.23Q298.18 -4.57 297.91 -4.74Q297.63 -4.9 297.17 -4.9Q296.7 -4.9 296.36 -4.68Q296.03 -4.45 295.95 -4H294.85Q294.91 -4.58 295.23 -4.98Q295.56 -5.39 296.07 -5.6Q296.58 -5.82 297.18 -5.82Q297.96 -5.82 298.48 -5.54Q299.01 -5.27 299.27 -4.77Q299.54 -4.27 299.54 -3.58V0H298.58L298.49 -0.94Q298.38 -0.72 298.21 -0.52Q298.04 -0.33 297.81 -0.18Q297.58 -0.03 297.3 0.05Q297.01 0.13 296.66 0.13ZM296.87 -0.76Q297.21 -0.76 297.49 -0.91Q297.77 -1.05 297.98 -1.31Q298.18 -1.56 298.29 -1.87Q298.41 -2.19 298.42 -2.54V-2.6H297.12Q296.66 -2.6 296.37 -2.49Q296.08 -2.37 295.95 -2.16Q295.82 -1.95 295.82 -1.69Q295.82 -1.4 295.94 -1.2Q296.07 -0.99 296.3 -0.88Q296.54 -0.76 296.87 -0.76ZM301.02 0V-5.69H302.01L302.07 -4.77Q302.32 -5.26 302.8 -5.54Q303.28 -5.82 303.91 -5.82Q304.57 -5.82 305.04 -5.56Q305.51 -5.31 305.77 -4.79Q306.03 -4.28 306.03 -3.51V0H304.93V-3.4Q304.93 -4.13 304.59 -4.51Q304.24 -4.88 303.62 -4.88Q303.2 -4.88 302.86 -4.69Q302.52 -4.49 302.32 -4.12Q302.12 -3.74 302.12 -3.2V0ZM307.52 0V-5.69H308.51L308.57 -4.77Q308.82 -5.26 309.3 -5.54Q309.78 -5.82 310.41 -5.82Q311.07 -5.82 311.54 -5.56Q312.01 -5.31 312.27 -4.79Q312.53 -4.28 312.53 -3.51V0H311.43V-3.4Q311.43 -4.13 311.09 -4.51Q310.74 -4.88 310.12 -4.88Q309.7 -4.88 309.36 -4.69Q309.02 -4.49 308.82 -4.12Q308.62 -3.74 308.62 -3.2V0ZM316.5 0.13Q315.71 0.13 315.1 -0.24Q314.5 -0.61 314.15 -1.27Q313.81 -1.94 313.81 -2.83Q313.81 -3.72 314.15 -4.4Q314.49 -5.07 315.1 -5.44Q315.72 -5.82 316.52 -5.82Q317.35 -5.82 317.93 -5.45Q318.51 -5.08 318.81 -4.46Q319.12 -3.84 319.12 -3.09Q319.12 -2.98 319.12 -2.86Q319.12 -2.74 319.1 -2.59H314.62V-3.36H318.03Q318 -4.1 317.57 -4.5Q317.15 -4.91 316.51 -4.91Q316.07 -4.91 315.7 -4.7Q315.33 -4.49 315.11 -4.08Q314.89 -3.67 314.89 -3.05V-2.74Q314.89 -2.11 315.11 -1.67Q315.33 -1.23 315.69 -1.01Q316.06 -0.78 316.5 -0.78Q317.05 -0.78 317.38 -1Q317.7 -1.22 317.86 -1.61H318.96Q318.82 -1.11 318.49 -0.72Q318.15 -0.32 317.65 -0.1Q317.15 0.13 316.5 0.13ZM320.38 0V-5.69H321.37L321.46 -4.65Q321.66 -5.03 321.97 -5.29Q322.28 -5.55 322.71 -5.68Q323.14 -5.82 323.68 -5.82V-4.66H323.14Q322.81 -4.66 322.51 -4.58Q322.21 -4.5 321.98 -4.3Q321.75 -4.11 321.61 -3.79Q321.48 -3.46 321.48 -2.96V0Z";
})(typeof globalThis !== 'undefined' ? globalThis : this);
