/* ED/UC Simulator: the charts under the diagram (Chart.js), and their exports.

   Dispatch     each unit's output stacked in merit order (cheapest at the
                bottom), storage charging below zero, load shed in red, and
                the demand line over them.
   Nodal prices one line per bus, or one system price when every bus has the
                same price all the time.
   Commitment   which committable unit runs in which hour (a relaxed run's
                fractions shade the hour), and where each one starts.
   Storage      each store's energy, against the price at its bus.

   Every chart marks the hour on the diagram and moves it on a click. The
   exports follow the site's: a 3x PNG and an SVG around it, each with its
   title, its key and the watermark, drawn at the desktop size whatever the
   screen (SharedExport). */
(function(root){
  'use strict';
  var ED = root.ED;
  var $ = function(id){ return document.getElementById(id); };
  function cssVar(n){ return getComputedStyle(document.body).getPropertyValue(n).trim(); }

  var charts = {};       // canvas id -> Chart
  var ctx = null;        // the last render: { res, model, display, onHour }
  var CANVAS = { disp: 'dispCanvas', price: 'priceCanvas', commit: 'commitCanvas', store: 'storeCanvas' };

  // A colour for the i-th series: the neutral sequence, paler on each lap round it.
  function seriesColour(i){
    var list = SharedPalette.neutral();
    var base = list[i % list.length], lap = Math.floor(i / list.length);
    return lap ? ED.mix(base, cssVar('--panel'), Math.min(0.6, 0.32 * lap)) : base;
  }
  function alpha(c, a){
    var m = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(String(c).replace(/\s/g, ''));
    if(m) return 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',' + a + ')';
    var h = /^#([0-9a-f]{6})$/i.exec(String(c).trim());
    if(h) return 'rgba(' + parseInt(h[1].slice(0, 2), 16) + ',' + parseInt(h[1].slice(2, 4), 16) + ',' + parseInt(h[1].slice(4, 6), 16) + ',' + a + ')';
    return c;
  }

  /* ── The hour marker, and a click that moves it ── */
  var HOUR_PLUGIN = {
    id: 'edHour',
    afterDatasetsDraw: function(chart){
      if(!ctx || chart.config.options.plugins.edHour === false) return;
      var x = chart.scales.x, area = chart.chartArea;
      if(!x || !area) return;
      var h = ctx.display.hour, px = chart.config.type === 'bar' ? x.getPixelForValue(h + 0.5) : x.getPixelForValue(h);
      if(!isFinite(px) || px < area.left - 0.5 || px > area.right + 0.5) return;
      var g = chart.ctx;
      g.save();
      g.strokeStyle = cssVar('--accent');
      g.globalAlpha = 0.75;
      g.lineWidth = 1.5;
      g.setLineDash([4, 3]);
      g.beginPath(); g.moveTo(px, area.top); g.lineTo(px, area.bottom); g.stroke();
      g.restore();
    }
  };
  function clickHour(evt, els, chart){
    if(!ctx || !ctx.onHour) return;
    var x = chart.scales.x, v = x.getValueForPixel(evt.x);
    if(!isFinite(v)) return;
    var h = chart.config.type === 'bar' ? Math.floor(v) : Math.round(v);
    ctx.onHour(Math.max(0, Math.min(ctx.res.T - 1, h)));
  }

  // An axis tick: whole prices without the cents.
  function tickPrice(v, cur){ return Math.abs(v - Math.round(v)) < 1e-9 ? ED.fmt.money(v, cur) : ED.fmt.price(v, cur); }
  function hourLabels(H){ var a = []; for(var t = 0; t < H; t++) a.push(ED.hourLabel(t, H)); return a; }
  function baseOptions(o){
    var grid = cssVar('--chart-grid'), muted = cssVar('--chart-text'), text = cssVar('--text');
    var H = o.H;
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      interaction: { mode: o.mode || 'index', intersect: false },
      onClick: clickHour,
      plugins: {
        legend: { display: false },
        tooltip: SharedChartTip.options({
          backgroundColor: cssVar('--panel'), titleColor: text, bodyColor: muted,
          borderColor: grid, borderWidth: 1, padding: 10,
          filter: o.filter,
          callbacks: o.callbacks
        }),
        zoom: SharedZoom.options(o.zoom || { min: 0, max: Math.max(1, H - 1), points: H }),
        // A y axis of names (the commitment chart's units) keeps its own range.
        sharedYFit: o.fit === false ? { auto: { axes: ['y'], fixed: ['y'] } } : { auto: { axes: o.fitAxes || ['y'], includeZero: true, skip: o.skip } }
      },
      scales: o.scales(grid, muted)
    };
  }
  function xAxis(H, grid, muted, extra){
    var x = {
      title: { display: true, text: H > 24 ? 'Day and hour' : 'Hour of the day', color: muted, font: { size: 11 } },
      ticks: { color: muted, maxTicksLimit: H > 24 ? 8 : 12, autoSkip: true, maxRotation: 0, font: { size: 11 } },
      grid: { color: grid }
    };
    for(var k in extra) x[k] = extra[k];
    return x;
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
  function make(key, cfg, legendId){
    var id = CANVAS[key];
    if(charts[id]) charts[id].destroy();
    cfg.plugins = [SharedZoom.plugin, HOUR_PLUGIN];
    var ch = charts[id] = new Chart($(id), cfg);
    if(legendId) renderLegend(legendId, ch, cfg.data.datasets);
    return ch;
  }
  function hover(id, txt){ var el = $(id); if(el) el.textContent = txt; }

  /* ── Who generates what, in merit order ── */
  function units(model, res){
    var gens = model.el.filter(function(e){ return e.c === 'Generator' && res.dev[e.id]; });
    gens.sort(function(a, b){ return a.marginal_cost - b.marginal_cost || a.id - b.id; });
    return gens;
  }

  function dispatchChart(res, model, d){
    var H = res.T, F = ED.fmt, cur = d.cur;
    var labels = hourLabels(H), ds = [];
    var gens = units(model, res);
    var stores = model.el.filter(function(e){ return e.c === 'StorageUnit' && res.dev[e.id]; });
    var pts = H <= 1 ? 4 : 0;
    gens.forEach(function(e, i){
      var c = seriesColour(i);
      ds.push({ label: ED.nameOf(e), data: res.dev[e.id].p.map(function(v){ return Math.max(0, v); }), borderColor: c, backgroundColor: alpha(c, 0.55),
                borderWidth: 1.2, pointRadius: pts, pointHoverRadius: 4, tension: 0, fill: 'origin', stack: 'gen', order: 2, kind: 'gen', id: e.id });
    });
    stores.forEach(function(e, j){
      var c = seriesColour(gens.length + j);
      ds.push({ label: ED.nameOf(e) + ' discharging', data: res.dev[e.id].p.map(function(v){ return Math.max(0, v); }), borderColor: c, backgroundColor: alpha(c, 0.55),
                borderWidth: 1.2, pointRadius: pts, pointHoverRadius: 4, tension: 0, fill: 'origin', stack: 'gen', order: 2, kind: 'dis', id: e.id });
      ds.push({ label: ED.nameOf(e) + ' charging', data: res.dev[e.id].p.map(function(v){ return Math.min(0, v); }), borderColor: c, backgroundColor: alpha(c, 0.22),
                borderWidth: 1.2, borderDash: [4, 3], pointRadius: pts, pointHoverRadius: 4, tension: 0, fill: 'origin', stack: 'store', order: 2, kind: 'chg', id: e.id });
    });
    if(res.totals.shedEnergy > 1e-6){
      var neg = cssVar('--negative');
      ds.push({ label: 'Load shed', data: res.totals.shed.slice(), borderColor: neg, backgroundColor: alpha(neg, 0.45),
                borderWidth: 1.2, pointRadius: pts, tension: 0, fill: 'origin', stack: 'gen', order: 2, kind: 'shed' });
    }
    // Each layer fills down to the layer under it in its own stack (Chart.js's
    // 'stack' fill can reach past an empty layer to the wrong one).
    var lastIn = {};
    ds.forEach(function(d, i){
      d.fill = lastIn[d.stack] === undefined ? 'origin' : lastIn[d.stack];
      lastIn[d.stack] = i;
      // The key and the hover show it filled, whatever it fills down to.
      var shown = {}; for(var k in d) shown[k] = d[k];
      shown.fill = 'origin';
      d.legendSpec = SharedLegend.fromDataset(shown);
    });
    ds.push({ label: 'Demand', data: res.totals.load.slice(), borderColor: cssVar('--text'), backgroundColor: 'transparent',
              borderWidth: 2, borderDash: [6, 4], pointRadius: pts, pointHoverRadius: 4, tension: 0, fill: false, stack: 'load', order: 1, kind: 'load' });
    var ch = make('disp', {
      type: 'line', data: { labels: labels, datasets: ds },
      options: baseOptions({ H: H,
        callbacks: {
          title: function(items){ return items.length ? labels[items[0].dataIndex] : ''; },
          label: function(c){ return '  ' + c.dataset.label + ': ' + F.mw(c.parsed.y) + ' MW'; },
          afterBody: function(items){
            if(!items.length) return;
            var t = items[0].dataIndex, T = res.totals;
            hover('dispHover', labels[t] + '  |  demand ' + F.mw(T.load[t]) + ' MW, generation ' + F.mw(T.gen[t]) + ' MW' +
              (Math.abs(T.store[t]) > 1e-6 ? ', storage ' + F.mw(T.store[t]) + ' MW' : '') +
              (T.shed[t] > 1e-6 ? ', shed ' + F.mw(T.shed[t]) + ' MW' : '') +
              (T.curtail[t] > 1e-6 ? ', curtailed ' + F.mw(T.curtail[t]) + ' MW' : ''));
          }
        },
        filter: function(item){ return Math.abs(item.parsed.y) > 1e-9 || item.dataset.kind === 'load'; },
        // The stack's top meets the demand line (plus any charging), so the line is not added to it.
        skip: function(ds){ return ds.kind === 'load'; },
        scales: function(grid, muted){
          return { x: xAxis(H, grid, muted),
                   y: { stacked: true, title: { display: true, text: 'Power (MW)', color: muted, font: { size: 11 } },
                        ticks: { color: muted, font: { size: 11 }, callback: function(v){ return F.mwr(v); } }, grid: { color: grid } } };
        } })
    }, 'dispLegend');
    // The demand line is not stacked with the units.
    ch.options.scales.y.stacked = true;
    $('dispSub').textContent = 'Units stacked in merit order, cheapest at the bottom' + (stores.length ? ', with storage charging below zero' : '') + '.';
    return ch;
  }

  function priceChart(res, model, d){
    var H = res.T, F = ED.fmt, cur = d.cur;
    var labels = hourLabels(H), ds = [];
    var buses = model.el.filter(function(e){ return e.c === 'Bus' && res.bus[e.id]; });
    var pts = H <= 1 ? 4 : 0;
    var noPrice = res.report.pricing === 'none';
    // One price everywhere (no congestion, no lossy link between them): one line.
    var uniform = buses.length > 1 && buses.every(function(b){
      var a = res.bus[b.id].price, r = res.bus[buses[0].id].price;
      for(var t = 0; t < H; t++) if(Math.abs(a[t] - r[t]) > 1e-4) return false;
      return true;
    });
    var list = uniform ? [buses[0]] : buses;
    list.forEach(function(b, i){
      var c = seriesColour(i);
      ds.push({ label: uniform ? 'System price, every bus' : ED.nameOf(b), data: res.bus[b.id].price.map(function(v){ return isFinite(v) ? v : null; }),
                borderColor: c, backgroundColor: alpha(c, 0.12), borderWidth: 2.2, pointRadius: pts, pointHoverRadius: 4, stepped: 'middle', fill: false });
    });
    var ch = make('price', {
      type: 'line', data: { labels: labels, datasets: ds },
      options: baseOptions({ H: H,
        callbacks: {
          title: function(items){ return items.length ? labels[items[0].dataIndex] : ''; },
          label: function(c){ return '  ' + c.dataset.label + ': ' + F.price(c.parsed.y, cur) + '/MWh'; },
          afterBody: function(items){
            if(!items.length) return;
            var t = items[0].dataIndex;
            hover('priceHover', labels[t] + '  |  ' + items.map(function(it){ return it.dataset.label + ' ' + F.price(it.parsed.y, cur); }).join(', ') + ' per MWh');
          }
        },
        scales: function(grid, muted){
          return { x: xAxis(H, grid, muted),
                   y: { title: { display: true, text: 'Price (' + (cur || '') + '/MWh)', color: muted, font: { size: 11 } },
                        ticks: { color: muted, font: { size: 11 }, callback: function(v){ return tickPrice(v, cur); } }, grid: { color: grid } } };
        } })
    }, 'priceLegend');
    var sub = noPrice ? 'No prices: the run with the commitment fixed could not be solved.'
      : res.report.pricing === 'lp' ? 'The cost of one more MW at each bus, the dual of its power balance.'
      : 'The cost of one more MW at each bus with the commitment held as found, the way markets price a unit commitment.';
    if(uniform) sub += ' Every bus has the same price: no branch limit binds.';
    $('priceSub').textContent = sub;
    return ch;
  }

  function commitChart(res, model, d){
    var H = res.T, F = ED.fmt;
    var gens = units(model, res).filter(function(e){ return res.dev[e.id].status; });
    var names = gens.map(function(e){ return ED.nameOf(e); });
    var on = [], onColour = [], starts = [];
    gens.forEach(function(e, i){
      var r = res.dev[e.id], c = seriesColour(units(model, res).indexOf(e));
      for(var t = 0; t < H; t++){
        var s = r.status[t];
        if(s > 1e-3){ on.push({ x: [t, t + 1], y: names[i], t: t, id: e.id, s: s }); onColour.push(alpha(c, 0.25 + 0.6 * Math.min(1, s))); }
        if(r.su[t] > 0.5) starts.push({ x: t, y: names[i], t: t, id: e.id });
      }
    });
    var accent = cssVar('--text');
    var ds = [
      { type: 'bar', label: 'Running', data: on, backgroundColor: onColour, borderWidth: 0, borderSkipped: false, barPercentage: 0.7, categoryPercentage: 1, grouped: false,
        legendSpec: { type: 'area', fill: alpha(seriesColour(0), 0.7) } },
      { type: 'scatter', label: 'Starts', data: starts, pointStyle: 'triangle', pointRadius: 5, pointHoverRadius: 7, backgroundColor: accent, borderColor: accent, rotation: 90,
        legendSpec: { type: 'point', point: { shape: 'triangle', fill: accent, stroke: accent, radius: 4 } } }
    ];
    var ch = make('commit', {
      type: 'bar', data: { labels: names, datasets: ds },
      options: (function(){
        var o = baseOptions({ H: H + 1, mode: 'nearest', fit: false, zoom: { min: 0, max: H, points: H },
          callbacks: {
            title: function(items){ return items.length ? items[0].raw.y + ', ' + ED.hourLabel(items[0].raw.t, H) : ''; },
            label: function(c){
              var r = res.dev[c.raw.id], t = c.raw.t;
              return c.dataset.type === 'scatter' ? '  Starts' : '  ' + (r.status[t] > 0.999 ? 'Running' : 'Running ' + Math.round(r.status[t] * 100) + '%') + ', ' + F.mw(r.p[t]) + ' MW';
            },
            afterBody: function(items){
              if(!items.length) return;
              var raw = items[0].raw, r = res.dev[raw.id];
              hover('commitHover', raw.y + ' at ' + ED.hourLabel(raw.t, H) + '  |  ' + (r.status[raw.t] > 0.999 ? 'running' : r.status[raw.t] < 0.001 ? 'off' : 'running ' + Math.round(r.status[raw.t] * 100) + '%') + ', ' + F.mw(r.p[raw.t]) + ' MW');
            }
          },
          scales: function(grid, muted){
            return {
              x: xAxis(H, grid, muted, { type: 'linear', min: 0, max: H,
                   ticks: { color: muted, maxTicksLimit: H > 24 ? 8 : 12, font: { size: 11 }, stepSize: H > 24 ? 24 : 3,
                            callback: function(v){ return v === H ? '' : ED.hourLabel(Math.round(v), H); } } }),
              y: { type: 'category', title: { display: true, text: 'Unit', color: muted, font: { size: 11 } }, ticks: { color: muted, font: { size: 11 } }, grid: { color: grid, offset: true } }
            };
          } });
        o.indexAxis = 'y';
        return o;
      })()
    }, 'commitLegend');
    var su = res.totals.starts;
    $('commitSub').textContent = (res.report.milp ? 'Each committable unit’s hours on' : 'Each committable unit’s share of the hour it is on, from the relaxation') +
      ', and its ' + (Math.round(su * 10) / 10) + ' start' + (Math.abs(su - 1) < 1e-9 ? '' : 's') + ' over the horizon.';
    return ch;
  }

  function storeChart(res, model, d){
    var H = res.T, F = ED.fmt, cur = d.cur;
    var labels = hourLabels(H), ds = [];
    var stores = model.el.filter(function(e){ return e.c === 'StorageUnit' && res.dev[e.id]; });
    var pts = H <= 1 ? 4 : 0;
    var nGen = units(model, res).length;
    stores.forEach(function(e, j){
      var c = seriesColour(nGen + j);
      ds.push({ label: ED.nameOf(e) + ' energy', data: res.dev[e.id].soc.slice(), borderColor: c, backgroundColor: alpha(c, 0.25),
                borderWidth: 2.2, pointRadius: pts, pointHoverRadius: 4, tension: 0, fill: 'origin', yAxisID: 'y' });
    });
    var first = stores[0], bus = first ? res.bus[first.bus] : null;
    if(bus){
      var pc = cssVar('--muted');
      ds.push({ label: 'Price at ' + ED.nameOf(ED.byId(model)[first.bus]), data: bus.price.map(function(v){ return isFinite(v) ? v : null; }), borderColor: pc,
                backgroundColor: 'transparent', borderWidth: 1.6, borderDash: [5, 4], pointRadius: pts, stepped: 'middle', fill: false, yAxisID: 'y2' });
    }
    var ch = make('store', {
      type: 'line', data: { labels: labels, datasets: ds },
      options: baseOptions({ H: H, fitAxes: ['y', 'y2'],
        callbacks: {
          title: function(items){ return items.length ? labels[items[0].dataIndex] : ''; },
          label: function(c){ return '  ' + c.dataset.label + ': ' + (c.dataset.yAxisID === 'y2' ? F.price(c.parsed.y, cur) + '/MWh' : F.mwh(c.parsed.y) + ' MWh'); },
          afterBody: function(items){
            if(!items.length) return;
            var t = items[0].dataIndex;
            hover('storeHover', labels[t] + '  |  ' + stores.map(function(e){
              var r = res.dev[e.id];
              return ED.nameOf(e) + ' ' + F.mwh(r.soc[t]) + ' MWh, ' + (r.p[t] > 1e-6 ? 'discharging ' + F.mw(r.p[t]) + ' MW' : r.p[t] < -1e-6 ? 'charging ' + F.mw(-r.p[t]) + ' MW' : 'idle');
            }).join('; '));
          }
        },
        scales: function(grid, muted){
          return { x: xAxis(H, grid, muted),
                   y: { position: 'left', title: { display: true, text: 'Energy stored (MWh)', color: muted, font: { size: 11 } },
                        ticks: { color: muted, font: { size: 11 }, callback: function(v){ return ED.fmt.mwr(v); } }, grid: { color: grid } },
                   y2: { position: 'right', title: { display: true, text: 'Price (' + (cur || '') + '/MWh)', color: muted, font: { size: 11 } },
                         ticks: { color: muted, font: { size: 11 }, callback: function(v){ return tickPrice(v, cur); } }, grid: { drawOnChartArea: false } } };
        } })
    }, 'storeLegend');
    $('storeSub').textContent = 'Energy held at the end of each hour, against the price where ' + (stores.length > 1 ? 'the first store' : 'it') + ' sits: it charges when power is cheap and discharges when it is dear.';
    return ch;
  }

  /* ── Public ── */
  var EDCharts = root.EDCharts = {
    ok: function(){ return typeof root.Chart !== 'undefined'; },
    /* Draw every chart the result has. Returns which cards are shown. */
    render: function(res, model, display, onHour){
      ctx = { res: res, model: model, display: display, onHour: onHour };
      var show = { disp: false, price: false, commit: false, store: false };
      if(!res || !res.report || !res.report.ok){ EDCharts.clear(); return show; }
      if(!EDCharts.ok()){
        hover('dispHover', 'The chart library could not be loaded, so the charts are unavailable. Every number on this page is still correct.');
        show.disp = true;
        return show;
      }
      show.disp = true; dispatchChart(res, model, display);
      show.price = true; priceChart(res, model, display);
      var hasCom = Object.keys(res.dev).some(function(id){ return res.dev[id].status; });
      if(hasCom){ show.commit = true; commitChart(res, model, display); } else destroy(CANVAS.commit);
      var hasStore = model.el.some(function(e){ return e.c === 'StorageUnit' && res.dev[e.id]; });
      if(hasStore){ show.store = true; storeChart(res, model, display); } else destroy(CANVAS.store);
      return show;
    },
    // The hour moved: only the markers redraw.
    hour: function(h){
      if(!ctx) return;
      ctx.display.hour = h;
      Object.keys(charts).forEach(function(id){ if(charts[id]) charts[id].draw(); });
    },
    clear: function(){ Object.keys(charts).forEach(destroy); },
    get: function(key){ return charts[CANVAS[key]] || null; },
    resetZoom: function(key){ var c = charts[CANVAS[key]]; if(c) c.resetZoom(); },
    png: chartPng,
    svg: chartSvg
  };
  function destroy(id){ if(charts[id]){ charts[id].destroy(); delete charts[id]; } }

  /* ── Exports ── */
  // The watermark, "Made using tool.adjiebrotots.com/educ-simulator" baked to DM Sans 500
  // glyph outlines by _ref/bake-watermark.py. Edit there and re-run, not here.
  ED.WM_PATH = "M0.82 0V-7.7H2.12L4.66 -2.48L7.19 -7.7H8.49V0H7.39V-5.76L5.08 -1.04H4.24L1.92 -5.74V0ZM11.9 0.13Q11.24 0.13 10.79 -0.11Q10.35 -0.35 10.13 -0.75Q9.91 -1.15 9.91 -1.62Q9.91 -2.17 10.19 -2.56Q10.47 -2.96 11 -3.17Q11.53 -3.38 12.26 -3.38H13.68Q13.68 -3.89 13.55 -4.23Q13.43 -4.57 13.15 -4.74Q12.87 -4.9 12.42 -4.9Q11.94 -4.9 11.61 -4.68Q11.27 -4.45 11.19 -4H10.09Q10.15 -4.58 10.48 -4.98Q10.8 -5.39 11.31 -5.6Q11.82 -5.82 12.42 -5.82Q13.2 -5.82 13.73 -5.54Q14.25 -5.27 14.52 -4.77Q14.78 -4.27 14.78 -3.58V0H13.82L13.73 -0.94Q13.62 -0.72 13.45 -0.52Q13.28 -0.33 13.05 -0.18Q12.83 -0.03 12.54 0.05Q12.25 0.13 11.9 0.13ZM12.11 -0.76Q12.45 -0.76 12.73 -0.91Q13.01 -1.05 13.22 -1.31Q13.42 -1.56 13.54 -1.87Q13.65 -2.19 13.66 -2.54V-2.6H12.37Q11.9 -2.6 11.61 -2.49Q11.32 -2.37 11.19 -2.16Q11.06 -1.95 11.06 -1.69Q11.06 -1.4 11.19 -1.2Q11.31 -0.99 11.55 -0.88Q11.78 -0.76 12.11 -0.76ZM18.67 0.13Q17.9 0.13 17.3 -0.25Q16.71 -0.64 16.38 -1.31Q16.05 -1.99 16.05 -2.84Q16.05 -3.71 16.38 -4.38Q16.72 -5.05 17.32 -5.43Q17.92 -5.82 18.71 -5.82Q19.35 -5.82 19.83 -5.56Q20.31 -5.31 20.59 -4.84V-7.92H21.69V0H20.7L20.6 -0.87Q20.43 -0.61 20.17 -0.38Q19.91 -0.15 19.54 -0.01Q19.17 0.13 18.67 0.13ZM18.87 -0.82Q19.39 -0.82 19.77 -1.07Q20.16 -1.32 20.37 -1.78Q20.58 -2.23 20.58 -2.84Q20.58 -3.46 20.37 -3.91Q20.16 -4.37 19.77 -4.61Q19.39 -4.86 18.87 -4.86Q18.38 -4.86 18 -4.61Q17.61 -4.37 17.39 -3.91Q17.17 -3.46 17.17 -2.85Q17.17 -2.23 17.39 -1.78Q17.61 -1.32 18 -1.07Q18.38 -0.82 18.87 -0.82ZM25.7 0.13Q24.91 0.13 24.3 -0.24Q23.69 -0.61 23.35 -1.27Q23 -1.94 23 -2.83Q23 -3.72 23.34 -4.4Q23.68 -5.07 24.3 -5.44Q24.91 -5.82 25.71 -5.82Q26.55 -5.82 27.12 -5.45Q27.7 -5.08 28.01 -4.46Q28.31 -3.84 28.31 -3.09Q28.31 -2.98 28.31 -2.86Q28.31 -2.74 28.3 -2.59H23.81V-3.36H27.22Q27.2 -4.1 26.77 -4.5Q26.34 -4.91 25.7 -4.91Q25.26 -4.91 24.89 -4.7Q24.53 -4.49 24.3 -4.08Q24.08 -3.67 24.08 -3.05V-2.74Q24.08 -2.11 24.3 -1.67Q24.52 -1.23 24.88 -1.01Q25.25 -0.78 25.69 -0.78Q26.24 -0.78 26.57 -1Q26.9 -1.22 27.05 -1.61H28.16Q28.01 -1.11 27.68 -0.72Q27.34 -0.32 26.84 -0.1Q26.34 0.13 25.7 0.13ZM34.49 0.13Q33.84 0.13 33.36 -0.12Q32.89 -0.37 32.63 -0.88Q32.37 -1.4 32.37 -2.16V-5.69H33.47V-2.29Q33.47 -1.54 33.81 -1.17Q34.16 -0.8 34.78 -0.8Q35.2 -0.8 35.54 -1Q35.87 -1.19 36.07 -1.56Q36.27 -1.94 36.27 -2.48V-5.69H37.37V0H36.39L36.31 -0.92Q36.08 -0.43 35.6 -0.15Q35.12 0.13 34.49 0.13ZM41.04 0.13Q40.28 0.13 39.75 -0.11Q39.22 -0.34 38.94 -0.77Q38.66 -1.19 38.6 -1.75H39.72Q39.76 -1.48 39.92 -1.26Q40.07 -1.03 40.35 -0.9Q40.63 -0.76 41.04 -0.76Q41.4 -0.76 41.64 -0.87Q41.88 -0.97 42 -1.16Q42.12 -1.34 42.12 -1.58Q42.12 -1.9 41.97 -2.07Q41.82 -2.25 41.53 -2.35Q41.24 -2.44 40.82 -2.5Q40.37 -2.58 40 -2.69Q39.63 -2.81 39.36 -3Q39.08 -3.19 38.94 -3.48Q38.79 -3.77 38.79 -4.17Q38.79 -4.65 39.04 -5.02Q39.3 -5.4 39.78 -5.61Q40.26 -5.82 40.91 -5.82Q41.87 -5.82 42.42 -5.38Q42.98 -4.95 43.08 -4.16H42.02Q41.96 -4.52 41.67 -4.72Q41.38 -4.92 40.9 -4.92Q40.4 -4.92 40.14 -4.74Q39.88 -4.55 39.88 -4.24Q39.88 -4.02 40.01 -3.85Q40.14 -3.68 40.42 -3.56Q40.71 -3.44 41.17 -3.37Q41.82 -3.27 42.28 -3.1Q42.74 -2.93 42.99 -2.59Q43.25 -2.26 43.24 -1.66Q43.24 -1.1 42.97 -0.7Q42.69 -0.3 42.2 -0.08Q41.71 0.13 41.04 0.13ZM44.65 0V-5.69H45.75V0ZM45.2 -6.69Q44.89 -6.69 44.68 -6.89Q44.48 -7.09 44.48 -7.39Q44.48 -7.69 44.68 -7.88Q44.89 -8.07 45.2 -8.07Q45.51 -8.07 45.72 -7.88Q45.93 -7.69 45.93 -7.39Q45.93 -7.09 45.72 -6.89Q45.51 -6.69 45.2 -6.69ZM47.35 0V-5.69H48.33L48.4 -4.77Q48.65 -5.26 49.13 -5.54Q49.61 -5.82 50.24 -5.82Q50.89 -5.82 51.37 -5.56Q51.84 -5.31 52.1 -4.79Q52.36 -4.28 52.36 -3.51V0H51.26V-3.4Q51.26 -4.13 50.91 -4.51Q50.57 -4.88 49.94 -4.88Q49.53 -4.88 49.19 -4.69Q48.85 -4.49 48.65 -4.12Q48.45 -3.74 48.45 -3.2V0ZM56.14 2.55Q55.35 2.55 54.77 2.36Q54.18 2.17 53.85 1.77Q53.53 1.38 53.53 0.8Q53.53 0.49 53.66 0.18Q53.8 -0.13 54.09 -0.41Q54.39 -0.68 54.89 -0.9L55.55 -0.41Q54.96 -0.19 54.77 0.1Q54.57 0.4 54.57 0.69Q54.57 1.02 54.77 1.24Q54.97 1.46 55.32 1.57Q55.67 1.68 56.13 1.68Q56.58 1.68 56.91 1.56Q57.23 1.45 57.41 1.23Q57.59 1.01 57.59 0.72Q57.59 0.32 57.32 0.08Q57.06 -0.15 56.27 -0.19Q55.64 -0.24 55.19 -0.32Q54.75 -0.4 54.45 -0.5Q54.14 -0.61 53.94 -0.75Q53.73 -0.88 53.58 -1.02V-1.28L54.7 -2.39L55.62 -2.09L54.38 -0.99L54.61 -1.5Q54.73 -1.42 54.84 -1.35Q54.96 -1.28 55.15 -1.22Q55.33 -1.16 55.66 -1.11Q55.99 -1.06 56.52 -1.02Q57.29 -0.96 57.75 -0.76Q58.22 -0.55 58.43 -0.19Q58.64 0.17 58.64 0.68Q58.64 1.16 58.38 1.58Q58.12 2.01 57.56 2.28Q57.01 2.55 56.14 2.55ZM56.13 -1.75Q55.43 -1.75 54.94 -2.01Q54.45 -2.28 54.19 -2.75Q53.93 -3.21 53.93 -3.78Q53.93 -4.36 54.19 -4.81Q54.45 -5.27 54.94 -5.55Q55.44 -5.82 56.13 -5.82Q56.84 -5.82 57.33 -5.55Q57.82 -5.27 58.08 -4.81Q58.33 -4.36 58.33 -3.78Q58.33 -3.21 58.08 -2.75Q57.82 -2.28 57.33 -2.01Q56.84 -1.75 56.13 -1.75ZM56.13 -2.62Q56.69 -2.62 57 -2.91Q57.32 -3.2 57.32 -3.78Q57.32 -4.35 57 -4.64Q56.69 -4.93 56.13 -4.93Q55.6 -4.93 55.26 -4.64Q54.93 -4.35 54.93 -3.78Q54.93 -3.2 55.25 -2.91Q55.58 -2.62 56.13 -2.62ZM57.08 -4.82 56.81 -5.69H59.08V-4.94ZM65.36 0Q64.84 0 64.45 -0.16Q64.06 -0.33 63.85 -0.71Q63.65 -1.1 63.65 -1.76V-4.76H62.66V-5.69H63.65L63.78 -7.14H64.75V-5.69H66.33V-4.76H64.75V-1.75Q64.75 -1.28 64.94 -1.11Q65.14 -0.94 65.62 -0.94H66.3V0ZM70.12 0.13Q69.32 0.13 68.7 -0.24Q68.08 -0.61 67.73 -1.28Q67.38 -1.95 67.38 -2.84Q67.38 -3.74 67.73 -4.41Q68.08 -5.08 68.71 -5.45Q69.34 -5.82 70.13 -5.82Q70.94 -5.82 71.56 -5.45Q72.18 -5.08 72.53 -4.41Q72.88 -3.74 72.88 -2.84Q72.88 -1.95 72.53 -1.28Q72.17 -0.61 71.55 -0.24Q70.93 0.13 70.12 0.13ZM70.12 -0.81Q70.58 -0.81 70.95 -1.04Q71.32 -1.27 71.54 -1.72Q71.76 -2.17 71.76 -2.84Q71.76 -3.52 71.54 -3.97Q71.33 -4.42 70.96 -4.65Q70.59 -4.87 70.14 -4.87Q69.69 -4.87 69.31 -4.65Q68.94 -4.42 68.72 -3.97Q68.5 -3.52 68.5 -2.84Q68.5 -2.17 68.72 -1.72Q68.94 -1.27 69.3 -1.04Q69.67 -0.81 70.12 -0.81ZM76.73 0.13Q75.93 0.13 75.31 -0.24Q74.69 -0.61 74.34 -1.28Q73.99 -1.95 73.99 -2.84Q73.99 -3.74 74.34 -4.41Q74.7 -5.08 75.32 -5.45Q75.95 -5.82 76.75 -5.82Q77.55 -5.82 78.17 -5.45Q78.79 -5.08 79.14 -4.41Q79.49 -3.74 79.49 -2.84Q79.49 -1.95 79.14 -1.28Q78.78 -0.61 78.16 -0.24Q77.54 0.13 76.73 0.13ZM76.73 -0.81Q77.19 -0.81 77.56 -1.04Q77.93 -1.27 78.15 -1.72Q78.37 -2.17 78.37 -2.84Q78.37 -3.52 78.15 -3.97Q77.94 -4.42 77.57 -4.65Q77.21 -4.87 76.75 -4.87Q76.3 -4.87 75.93 -4.65Q75.55 -4.42 75.33 -3.97Q75.11 -3.52 75.11 -2.84Q75.11 -2.17 75.33 -1.72Q75.55 -1.27 75.91 -1.04Q76.28 -0.81 76.73 -0.81ZM80.81 0V-7.92H81.91V0ZM83.9 0.05Q83.59 0.05 83.39 -0.15Q83.18 -0.35 83.18 -0.64Q83.18 -0.94 83.39 -1.14Q83.59 -1.34 83.9 -1.34Q84.22 -1.34 84.42 -1.14Q84.62 -0.94 84.62 -0.64Q84.62 -0.35 84.42 -0.15Q84.22 0.05 83.9 0.05ZM87.71 0.13Q87.04 0.13 86.59 -0.11Q86.15 -0.35 85.93 -0.75Q85.71 -1.15 85.71 -1.62Q85.71 -2.17 85.99 -2.56Q86.27 -2.96 86.8 -3.17Q87.33 -3.38 88.06 -3.38H89.48Q89.48 -3.89 89.35 -4.23Q89.23 -4.57 88.95 -4.74Q88.67 -4.9 88.22 -4.9Q87.74 -4.9 87.41 -4.68Q87.07 -4.45 86.99 -4H85.89Q85.95 -4.58 86.28 -4.98Q86.6 -5.39 87.11 -5.6Q87.62 -5.82 88.22 -5.82Q89 -5.82 89.53 -5.54Q90.05 -5.27 90.32 -4.77Q90.58 -4.27 90.58 -3.58V0H89.62L89.53 -0.94Q89.42 -0.72 89.25 -0.52Q89.08 -0.33 88.85 -0.18Q88.63 -0.03 88.34 0.05Q88.05 0.13 87.71 0.13ZM87.91 -0.76Q88.25 -0.76 88.53 -0.91Q88.81 -1.05 89.02 -1.31Q89.23 -1.56 89.34 -1.87Q89.45 -2.19 89.46 -2.54V-2.6H88.17Q87.7 -2.6 87.41 -2.49Q87.12 -2.37 86.99 -2.16Q86.87 -1.95 86.87 -1.69Q86.87 -1.4 86.99 -1.2Q87.11 -0.99 87.35 -0.88Q87.58 -0.76 87.91 -0.76ZM94.47 0.13Q93.7 0.13 93.1 -0.25Q92.51 -0.64 92.18 -1.31Q91.85 -1.99 91.85 -2.84Q91.85 -3.71 92.18 -4.38Q92.52 -5.05 93.12 -5.43Q93.72 -5.82 94.51 -5.82Q95.15 -5.82 95.63 -5.56Q96.11 -5.31 96.39 -4.84V-7.92H97.49V0H96.5L96.4 -0.87Q96.23 -0.61 95.97 -0.38Q95.71 -0.15 95.34 -0.01Q94.97 0.13 94.47 0.13ZM94.67 -0.82Q95.19 -0.82 95.57 -1.07Q95.96 -1.32 96.17 -1.78Q96.38 -2.23 96.38 -2.84Q96.38 -3.46 96.17 -3.91Q95.96 -4.37 95.57 -4.61Q95.19 -4.86 94.67 -4.86Q94.18 -4.86 93.8 -4.61Q93.41 -4.37 93.19 -3.91Q92.97 -3.46 92.97 -2.85Q92.97 -2.23 93.19 -1.78Q93.41 -1.32 93.8 -1.07Q94.18 -0.82 94.67 -0.82ZM97.96 2.42V1.48H98.39Q98.79 1.48 98.96 1.32Q99.12 1.16 99.12 0.77V-5.69H100.22V0.79Q100.22 1.37 100.03 1.73Q99.83 2.08 99.46 2.25Q99.09 2.42 98.56 2.42ZM99.68 -6.69Q99.37 -6.69 99.16 -6.89Q98.96 -7.09 98.96 -7.39Q98.96 -7.69 99.16 -7.88Q99.37 -8.07 99.68 -8.07Q99.99 -8.07 100.2 -7.88Q100.4 -7.69 100.4 -7.39Q100.4 -7.09 100.2 -6.89Q99.99 -6.69 99.68 -6.69ZM101.88 0V-5.69H102.98V0ZM102.44 -6.69Q102.12 -6.69 101.92 -6.89Q101.71 -7.09 101.71 -7.39Q101.71 -7.69 101.92 -7.88Q102.12 -8.07 102.44 -8.07Q102.74 -8.07 102.95 -7.88Q103.16 -7.69 103.16 -7.39Q103.16 -7.09 102.95 -6.89Q102.74 -6.69 102.44 -6.69ZM107.06 0.13Q106.27 0.13 105.66 -0.24Q105.06 -0.61 104.71 -1.27Q104.37 -1.94 104.37 -2.83Q104.37 -3.72 104.71 -4.4Q105.05 -5.07 105.66 -5.44Q106.28 -5.82 107.08 -5.82Q107.91 -5.82 108.49 -5.45Q109.07 -5.08 109.37 -4.46Q109.68 -3.84 109.68 -3.09Q109.68 -2.98 109.68 -2.86Q109.68 -2.74 109.66 -2.59H105.18V-3.36H108.59Q108.56 -4.1 108.13 -4.5Q107.71 -4.91 107.07 -4.91Q106.63 -4.91 106.26 -4.7Q105.89 -4.49 105.67 -4.08Q105.45 -3.67 105.45 -3.05V-2.74Q105.45 -2.11 105.67 -1.67Q105.89 -1.23 106.25 -1.01Q106.62 -0.78 107.06 -0.78Q107.61 -0.78 107.94 -1Q108.26 -1.22 108.42 -1.61H109.52Q109.38 -1.11 109.05 -0.72Q108.71 -0.32 108.21 -0.1Q107.71 0.13 107.06 0.13ZM113.95 0.13Q113.46 0.13 113.09 -0.01Q112.73 -0.15 112.47 -0.37Q112.2 -0.6 112.04 -0.84L111.93 0H110.94V-7.92H112.04V-4.82Q112.31 -5.29 112.8 -5.55Q113.29 -5.82 113.93 -5.82Q114.72 -5.82 115.32 -5.44Q115.92 -5.05 116.25 -4.39Q116.58 -3.72 116.58 -2.86Q116.58 -2 116.25 -1.32Q115.92 -0.64 115.33 -0.26Q114.74 0.13 113.95 0.13ZM113.76 -0.82Q114.25 -0.82 114.63 -1.07Q115.02 -1.32 115.24 -1.77Q115.46 -2.23 115.46 -2.84Q115.46 -3.46 115.24 -3.91Q115.02 -4.37 114.63 -4.61Q114.25 -4.86 113.76 -4.86Q113.25 -4.86 112.86 -4.61Q112.47 -4.37 112.26 -3.91Q112.05 -3.46 112.05 -2.84Q112.05 -2.23 112.26 -1.77Q112.47 -1.32 112.86 -1.07Q113.25 -0.82 113.76 -0.82ZM117.9 0V-5.69H118.89L118.98 -4.65Q119.18 -5.03 119.49 -5.29Q119.8 -5.55 120.24 -5.68Q120.67 -5.82 121.2 -5.82V-4.66H120.66Q120.33 -4.66 120.03 -4.58Q119.74 -4.5 119.5 -4.3Q119.27 -4.11 119.14 -3.79Q119 -3.46 119 -2.96V0ZM124.78 0.13Q123.98 0.13 123.36 -0.24Q122.73 -0.61 122.38 -1.28Q122.03 -1.95 122.03 -2.84Q122.03 -3.74 122.39 -4.41Q122.74 -5.08 123.37 -5.45Q124 -5.82 124.79 -5.82Q125.6 -5.82 126.22 -5.45Q126.84 -5.08 127.19 -4.41Q127.54 -3.74 127.54 -2.84Q127.54 -1.95 127.18 -1.28Q126.83 -0.61 126.21 -0.24Q125.58 0.13 124.78 0.13ZM124.78 -0.81Q125.24 -0.81 125.61 -1.04Q125.98 -1.27 126.2 -1.72Q126.41 -2.17 126.41 -2.84Q126.41 -3.52 126.2 -3.97Q125.99 -4.42 125.62 -4.65Q125.25 -4.87 124.79 -4.87Q124.35 -4.87 123.97 -4.65Q123.6 -4.42 123.38 -3.97Q123.16 -3.52 123.16 -2.84Q123.16 -2.17 123.38 -1.72Q123.59 -1.27 123.96 -1.04Q124.33 -0.81 124.78 -0.81ZM131.18 0Q130.66 0 130.27 -0.16Q129.89 -0.33 129.68 -0.71Q129.47 -1.1 129.47 -1.76V-4.76H128.48V-5.69H129.47L129.61 -7.14H130.57V-5.69H132.15V-4.76H130.57V-1.75Q130.57 -1.28 130.77 -1.11Q130.96 -0.94 131.45 -0.94H132.13V0ZM135.94 0.13Q135.14 0.13 134.52 -0.24Q133.9 -0.61 133.55 -1.28Q133.2 -1.95 133.2 -2.84Q133.2 -3.74 133.55 -4.41Q133.91 -5.08 134.53 -5.45Q135.16 -5.82 135.96 -5.82Q136.77 -5.82 137.39 -5.45Q138 -5.08 138.35 -4.41Q138.7 -3.74 138.7 -2.84Q138.7 -1.95 138.35 -1.28Q137.99 -0.61 137.37 -0.24Q136.75 0.13 135.94 0.13ZM135.94 -0.81Q136.4 -0.81 136.77 -1.04Q137.14 -1.27 137.36 -1.72Q137.58 -2.17 137.58 -2.84Q137.58 -3.52 137.37 -3.97Q137.15 -4.42 136.79 -4.65Q136.42 -4.87 135.96 -4.87Q135.51 -4.87 135.14 -4.65Q134.77 -4.42 134.54 -3.97Q134.32 -3.52 134.32 -2.84Q134.32 -2.17 134.54 -1.72Q134.76 -1.27 135.13 -1.04Q135.49 -0.81 135.94 -0.81ZM142.35 0Q141.82 0 141.44 -0.16Q141.05 -0.33 140.84 -0.71Q140.64 -1.1 140.64 -1.76V-4.76H139.65V-5.69H140.64L140.77 -7.14H141.74V-5.69H143.32V-4.76H141.74V-1.75Q141.74 -1.28 141.93 -1.11Q142.13 -0.94 142.61 -0.94H143.29V0ZM146.72 0.13Q145.95 0.13 145.43 -0.11Q144.9 -0.34 144.62 -0.77Q144.34 -1.19 144.28 -1.75H145.39Q145.44 -1.48 145.59 -1.26Q145.75 -1.03 146.03 -0.9Q146.31 -0.76 146.72 -0.76Q147.07 -0.76 147.31 -0.87Q147.55 -0.97 147.68 -1.16Q147.8 -1.34 147.8 -1.58Q147.8 -1.9 147.65 -2.07Q147.5 -2.25 147.21 -2.35Q146.92 -2.44 146.5 -2.5Q146.05 -2.58 145.68 -2.69Q145.31 -2.81 145.03 -3Q144.76 -3.19 144.61 -3.48Q144.46 -3.77 144.46 -4.17Q144.46 -4.65 144.72 -5.02Q144.98 -5.4 145.46 -5.61Q145.93 -5.82 146.59 -5.82Q147.54 -5.82 148.1 -5.38Q148.66 -4.95 148.76 -4.16H147.7Q147.64 -4.52 147.35 -4.72Q147.06 -4.92 146.58 -4.92Q146.08 -4.92 145.82 -4.74Q145.56 -4.55 145.56 -4.24Q145.56 -4.02 145.68 -3.85Q145.81 -3.68 146.1 -3.56Q146.39 -3.44 146.85 -3.37Q147.49 -3.27 147.96 -3.1Q148.42 -2.93 148.67 -2.59Q148.92 -2.26 148.92 -1.66Q148.92 -1.1 148.64 -0.7Q148.37 -0.3 147.88 -0.08Q147.39 0.13 146.72 0.13ZM150.72 0.05Q150.4 0.05 150.2 -0.15Q150 -0.35 150 -0.64Q150 -0.94 150.2 -1.14Q150.4 -1.34 150.72 -1.34Q151.04 -1.34 151.23 -1.14Q151.43 -0.94 151.43 -0.64Q151.43 -0.35 151.23 -0.15Q151.04 0.05 150.72 0.05ZM155.25 0.13Q154.45 0.13 153.82 -0.24Q153.19 -0.62 152.84 -1.29Q152.48 -1.95 152.48 -2.83Q152.48 -3.73 152.84 -4.4Q153.19 -5.07 153.82 -5.44Q154.45 -5.82 155.25 -5.82Q156.27 -5.82 156.95 -5.28Q157.63 -4.75 157.82 -3.83H156.68Q156.57 -4.33 156.17 -4.6Q155.78 -4.88 155.24 -4.88Q154.78 -4.88 154.4 -4.64Q154.03 -4.41 153.82 -3.96Q153.61 -3.51 153.61 -2.84Q153.61 -2.35 153.73 -1.97Q153.85 -1.58 154.07 -1.32Q154.29 -1.07 154.59 -0.93Q154.89 -0.8 155.24 -0.8Q155.6 -0.8 155.9 -0.92Q156.19 -1.05 156.4 -1.29Q156.61 -1.53 156.68 -1.86H157.82Q157.64 -0.96 156.95 -0.41Q156.26 0.13 155.25 0.13ZM161.67 0.13Q160.87 0.13 160.25 -0.24Q159.63 -0.61 159.28 -1.28Q158.93 -1.95 158.93 -2.84Q158.93 -3.74 159.28 -4.41Q159.64 -5.08 160.26 -5.45Q160.89 -5.82 161.69 -5.82Q162.5 -5.82 163.11 -5.45Q163.73 -5.08 164.08 -4.41Q164.43 -3.74 164.43 -2.84Q164.43 -1.95 164.08 -1.28Q163.72 -0.61 163.1 -0.24Q162.48 0.13 161.67 0.13ZM161.67 -0.81Q162.13 -0.81 162.5 -1.04Q162.87 -1.27 163.09 -1.72Q163.31 -2.17 163.31 -2.84Q163.31 -3.52 163.1 -3.97Q162.88 -4.42 162.52 -4.65Q162.15 -4.87 161.69 -4.87Q161.24 -4.87 160.87 -4.65Q160.49 -4.42 160.27 -3.97Q160.05 -3.52 160.05 -2.84Q160.05 -2.17 160.27 -1.72Q160.49 -1.27 160.86 -1.04Q161.22 -0.81 161.67 -0.81ZM165.75 0V-5.69H166.74L166.81 -4.91Q167.07 -5.33 167.52 -5.58Q167.96 -5.82 168.49 -5.82Q168.9 -5.82 169.24 -5.71Q169.57 -5.59 169.83 -5.37Q170.08 -5.14 170.24 -4.8Q170.54 -5.29 171.03 -5.55Q171.52 -5.82 172.08 -5.82Q172.74 -5.82 173.21 -5.56Q173.68 -5.3 173.92 -4.78Q174.17 -4.27 174.17 -3.5V0H173.08V-3.39Q173.08 -4.13 172.77 -4.51Q172.45 -4.88 171.88 -4.88Q171.49 -4.88 171.18 -4.68Q170.87 -4.49 170.69 -4.1Q170.51 -3.72 170.51 -3.17V0H169.42V-3.39Q169.42 -4.13 169.1 -4.51Q168.78 -4.88 168.21 -4.88Q167.84 -4.88 167.53 -4.68Q167.22 -4.49 167.04 -4.1Q166.85 -3.72 166.85 -3.17V0ZM175.19 1.11 177.95 -8.46H179.02L176.27 1.11ZM182.58 0.13Q181.79 0.13 181.18 -0.24Q180.57 -0.61 180.23 -1.27Q179.88 -1.94 179.88 -2.83Q179.88 -3.72 180.22 -4.4Q180.57 -5.07 181.18 -5.44Q181.79 -5.82 182.6 -5.82Q183.43 -5.82 184.01 -5.45Q184.58 -5.08 184.89 -4.46Q185.19 -3.84 185.19 -3.09Q185.19 -2.98 185.19 -2.86Q185.19 -2.74 185.18 -2.59H180.69V-3.36H184.1Q184.08 -4.1 183.65 -4.5Q183.22 -4.91 182.58 -4.91Q182.14 -4.91 181.78 -4.7Q181.41 -4.49 181.18 -4.08Q180.96 -3.67 180.96 -3.05V-2.74Q180.96 -2.11 181.18 -1.67Q181.4 -1.23 181.77 -1.01Q182.13 -0.78 182.58 -0.78Q183.13 -0.78 183.45 -1Q183.78 -1.22 183.94 -1.61H185.04Q184.9 -1.11 184.56 -0.72Q184.22 -0.32 183.72 -0.1Q183.22 0.13 182.58 0.13ZM188.86 0.13Q188.09 0.13 187.5 -0.25Q186.9 -0.64 186.57 -1.31Q186.24 -1.99 186.24 -2.84Q186.24 -3.71 186.57 -4.38Q186.91 -5.05 187.51 -5.43Q188.11 -5.82 188.9 -5.82Q189.55 -5.82 190.03 -5.56Q190.51 -5.31 190.78 -4.84V-7.92H191.88V0H190.89L190.79 -0.87Q190.62 -0.61 190.36 -0.38Q190.1 -0.15 189.73 -0.01Q189.36 0.13 188.86 0.13ZM189.06 -0.82Q189.58 -0.82 189.96 -1.07Q190.35 -1.32 190.56 -1.78Q190.77 -2.23 190.77 -2.84Q190.77 -3.46 190.56 -3.91Q190.35 -4.37 189.96 -4.61Q189.58 -4.86 189.06 -4.86Q188.57 -4.86 188.19 -4.61Q187.8 -4.37 187.58 -3.91Q187.36 -3.46 187.36 -2.85Q187.36 -2.23 187.58 -1.78Q187.8 -1.32 188.19 -1.07Q188.57 -0.82 189.06 -0.82ZM195.48 0.13Q194.83 0.13 194.36 -0.12Q193.88 -0.37 193.62 -0.88Q193.36 -1.4 193.36 -2.16V-5.69H194.46V-2.29Q194.46 -1.54 194.81 -1.17Q195.16 -0.8 195.78 -0.8Q196.2 -0.8 196.53 -1Q196.87 -1.19 197.07 -1.56Q197.27 -1.94 197.27 -2.48V-5.69H198.37V0H197.38L197.31 -0.92Q197.07 -0.43 196.59 -0.15Q196.12 0.13 195.48 0.13ZM202.45 0.13Q201.65 0.13 201.02 -0.24Q200.4 -0.62 200.04 -1.29Q199.68 -1.95 199.68 -2.83Q199.68 -3.73 200.04 -4.4Q200.4 -5.07 201.02 -5.44Q201.65 -5.82 202.45 -5.82Q203.47 -5.82 204.15 -5.28Q204.83 -4.75 205.02 -3.83H203.88Q203.77 -4.33 203.37 -4.6Q202.98 -4.88 202.44 -4.88Q201.98 -4.88 201.61 -4.64Q201.23 -4.41 201.02 -3.96Q200.81 -3.51 200.81 -2.84Q200.81 -2.35 200.93 -1.97Q201.05 -1.58 201.27 -1.32Q201.49 -1.07 201.79 -0.93Q202.09 -0.8 202.44 -0.8Q202.81 -0.8 203.1 -0.92Q203.4 -1.05 203.6 -1.29Q203.81 -1.53 203.88 -1.86H205.02Q204.84 -0.96 204.15 -0.41Q203.46 0.13 202.45 0.13ZM206.38 -2.88V-3.81H210.83V-2.88ZM214.53 0.13Q213.77 0.13 213.24 -0.11Q212.72 -0.34 212.43 -0.77Q212.15 -1.19 212.1 -1.75H213.21Q213.26 -1.48 213.41 -1.26Q213.56 -1.03 213.84 -0.9Q214.12 -0.76 214.54 -0.76Q214.89 -0.76 215.13 -0.87Q215.37 -0.97 215.49 -1.16Q215.61 -1.34 215.61 -1.58Q215.61 -1.9 215.46 -2.07Q215.31 -2.25 215.02 -2.35Q214.73 -2.44 214.31 -2.5Q213.87 -2.58 213.49 -2.69Q213.12 -2.81 212.85 -3Q212.58 -3.19 212.43 -3.48Q212.28 -3.77 212.28 -4.17Q212.28 -4.65 212.54 -5.02Q212.79 -5.4 213.27 -5.61Q213.75 -5.82 214.4 -5.82Q215.36 -5.82 215.92 -5.38Q216.48 -4.95 216.58 -4.16H215.51Q215.45 -4.52 215.16 -4.72Q214.87 -4.92 214.39 -4.92Q213.89 -4.92 213.63 -4.74Q213.37 -4.55 213.37 -4.24Q213.37 -4.02 213.5 -3.85Q213.63 -3.68 213.91 -3.56Q214.2 -3.44 214.66 -3.37Q215.31 -3.27 215.77 -3.1Q216.23 -2.93 216.49 -2.59Q216.74 -2.26 216.73 -1.66Q216.73 -1.1 216.46 -0.7Q216.19 -0.3 215.69 -0.08Q215.2 0.13 214.53 0.13ZM218.14 0V-5.69H219.24V0ZM218.7 -6.69Q218.38 -6.69 218.17 -6.89Q217.97 -7.09 217.97 -7.39Q217.97 -7.69 218.17 -7.88Q218.38 -8.07 218.7 -8.07Q219 -8.07 219.21 -7.88Q219.42 -7.69 219.42 -7.39Q219.42 -7.09 219.21 -6.89Q219 -6.69 218.7 -6.69ZM220.84 0V-5.69H221.83L221.9 -4.91Q222.16 -5.33 222.61 -5.58Q223.05 -5.82 223.57 -5.82Q223.99 -5.82 224.33 -5.71Q224.66 -5.59 224.92 -5.37Q225.17 -5.14 225.33 -4.8Q225.62 -5.29 226.12 -5.55Q226.61 -5.82 227.16 -5.82Q227.83 -5.82 228.3 -5.56Q228.76 -5.3 229.01 -4.78Q229.26 -4.27 229.26 -3.5V0H228.17V-3.39Q228.17 -4.13 227.85 -4.51Q227.54 -4.88 226.97 -4.88Q226.58 -4.88 226.27 -4.68Q225.96 -4.49 225.78 -4.1Q225.6 -3.72 225.6 -3.17V0H224.5V-3.39Q224.5 -4.13 224.19 -4.51Q223.87 -4.88 223.3 -4.88Q222.92 -4.88 222.62 -4.68Q222.31 -4.49 222.13 -4.1Q221.94 -3.72 221.94 -3.17V0ZM232.82 0.13Q232.17 0.13 231.69 -0.12Q231.22 -0.37 230.96 -0.88Q230.7 -1.4 230.7 -2.16V-5.69H231.8V-2.29Q231.8 -1.54 232.14 -1.17Q232.49 -0.8 233.11 -0.8Q233.53 -0.8 233.87 -1Q234.2 -1.19 234.4 -1.56Q234.6 -1.94 234.6 -2.48V-5.69H235.7V0H234.72L234.64 -0.92Q234.41 -0.43 233.93 -0.15Q233.45 0.13 232.82 0.13ZM237.23 0V-7.92H238.33V0ZM241.68 0.13Q241.01 0.13 240.57 -0.11Q240.13 -0.35 239.91 -0.75Q239.69 -1.15 239.69 -1.62Q239.69 -2.17 239.97 -2.56Q240.25 -2.96 240.78 -3.17Q241.31 -3.38 242.04 -3.38H243.46Q243.46 -3.89 243.33 -4.23Q243.21 -4.57 242.93 -4.74Q242.65 -4.9 242.2 -4.9Q241.72 -4.9 241.39 -4.68Q241.05 -4.45 240.97 -4H239.87Q239.93 -4.58 240.26 -4.98Q240.58 -5.39 241.09 -5.6Q241.6 -5.82 242.2 -5.82Q242.98 -5.82 243.5 -5.54Q244.03 -5.27 244.29 -4.77Q244.56 -4.27 244.56 -3.58V0H243.6L243.51 -0.94Q243.4 -0.72 243.23 -0.52Q243.06 -0.33 242.83 -0.18Q242.61 -0.03 242.32 0.05Q242.03 0.13 241.68 0.13ZM241.89 -0.76Q242.23 -0.76 242.51 -0.91Q242.79 -1.05 243 -1.31Q243.2 -1.56 243.32 -1.87Q243.43 -2.19 243.44 -2.54V-2.6H242.14Q241.68 -2.6 241.39 -2.49Q241.1 -2.37 240.97 -2.16Q240.84 -1.95 240.84 -1.69Q240.84 -1.4 240.97 -1.2Q241.09 -0.99 241.32 -0.88Q241.56 -0.76 241.89 -0.76ZM248.36 0Q247.84 0 247.46 -0.16Q247.07 -0.33 246.86 -0.71Q246.65 -1.1 246.65 -1.76V-4.76H245.67V-5.69H246.65L246.79 -7.14H247.75V-5.69H249.34V-4.76H247.75V-1.75Q247.75 -1.28 247.95 -1.11Q248.14 -0.94 248.63 -0.94H249.31V0ZM253.12 0.13Q252.33 0.13 251.7 -0.24Q251.08 -0.61 250.73 -1.28Q250.38 -1.95 250.38 -2.84Q250.38 -3.74 250.74 -4.41Q251.09 -5.08 251.72 -5.45Q252.34 -5.82 253.14 -5.82Q253.95 -5.82 254.57 -5.45Q255.19 -5.08 255.54 -4.41Q255.89 -3.74 255.89 -2.84Q255.89 -1.95 255.53 -1.28Q255.18 -0.61 254.56 -0.24Q253.93 0.13 253.12 0.13ZM253.13 -0.81Q253.59 -0.81 253.96 -1.04Q254.33 -1.27 254.54 -1.72Q254.76 -2.17 254.76 -2.84Q254.76 -3.52 254.55 -3.97Q254.34 -4.42 253.97 -4.65Q253.6 -4.87 253.14 -4.87Q252.69 -4.87 252.32 -4.65Q251.95 -4.42 251.73 -3.97Q251.51 -3.52 251.51 -2.84Q251.51 -2.17 251.72 -1.72Q251.94 -1.27 252.31 -1.04Q252.68 -0.81 253.13 -0.81ZM257.21 0V-5.69H258.2L258.29 -4.65Q258.49 -5.03 258.8 -5.29Q259.11 -5.55 259.54 -5.68Q259.97 -5.82 260.51 -5.82V-4.66H259.97Q259.64 -4.66 259.34 -4.58Q259.04 -4.5 258.81 -4.3Q258.57 -4.11 258.44 -3.79Q258.31 -3.46 258.31 -2.96V0Z";
  ED.WM_PATH_W = 260.79;
  ED.WM_LOGO_SRC = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 680 680"><circle cx="340" cy="340" r="300" fill="#0052cc"/><g fill="none" stroke="#fff" stroke-width="46"><path d="M242 570A250 250 0 0 1 234 113"/><path d="M234 113A250 250 0 0 1 446 113"/><path d="M446 113A250 250 0 0 1 438 570"/></g><line x1="113" y1="354" x2="567" y2="354" stroke="#fff" stroke-width="42" stroke-linecap="round"/></svg>');
  var wmLogoImg = new Image();
  wmLogoImg.src = ED.WM_LOGO_SRC;
  function exportTokens(){
    var light = document.body.classList.contains('light');
    return { bg: light ? '#ffffff' : '#0F1728', fg: light ? '#2D3436' : '#EAF1FF' };
  }
  function saveBlob(blob, filename){
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  }
  function legendRows(legendId, measure, maxW, markW, gap, pad){
    var items = SharedLegend.itemsOf(legendId);
    return items.length ? SharedLegend.layout(items, measure, maxW, markW, gap, pad) : [];
  }
  // A 3x PNG of the chart at its desktop size, with its title, key and watermark.
  function chartPng(canvasId, chartTitle, legendId){
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
      var wmX = c.width - Math.round(12 * OUT) - ED.WM_PATH_W * OUT, wmY = c.height - Math.round(12 * OUT);
      g.translate(wmX, wmY); g.scale(OUT, OUT); g.fillStyle = '#1a1a1a'; g.fill(new Path2D(ED.WM_PATH));
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
  function chartSvg(canvasId, chartTitle, legendId){
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
      wm.setAttribute('d', ED.WM_PATH);
      wm.setAttribute('transform', 'translate(' + (W - 12 - ED.WM_PATH_W) + ',' + (Hh - 12) + ')');
      wm.setAttribute('fill', '#1a1a1a'); wm.setAttribute('opacity', '0.22');
      svg.appendChild(wm);
      var logo = document.createElementNS(NS, 'image');
      logo.setAttribute('href', ED.WM_LOGO_SRC); logo.setAttributeNS(xl, 'href', ED.WM_LOGO_SRC);
      logo.setAttribute('width', 13); logo.setAttribute('height', 13);
      logo.setAttribute('x', W - 12 - ED.WM_PATH_W - 4 - 13); logo.setAttribute('y', Hh - 12 - 13 + 2); logo.setAttribute('opacity', '0.22');
      svg.appendChild(logo);
      return new Blob(['<?xml version="1.0" encoding="utf-8"?>\n' + new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' });
    });
  }
  EDCharts.save = saveBlob;
})(typeof globalThis !== 'undefined' ? globalThis : this);
