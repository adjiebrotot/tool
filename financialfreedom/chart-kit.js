/* Financial Freedom Calculator: the chart pieces (FFKit)

   What its two charts are drawn with beyond Chart.js and chart-kit.js: the y
   fitters, the clip that keeps each stacked pane's series in its pane, the
   life-stage ribbon, the vertical rules and the hover that matches points by
   year. Loaded by the tool before script.js, and by the embed viewer
   (embed/), which draws a shared chart from its link with these and nothing
   else of the tool, so everything here reads its data from its arguments or
   the chart's own options. */
(function(global){
  var K = global.ChartKit;

  /* Keep the y axis on the slice of the plan that is actually on screen. A
     linear y axis is sized once, from the whole series, so zooming into ten
     years of a sixty-year plan leaves those ten years as a flat smear against a
     scale built for the end of it. Every zoom and every pan re-fits y to the x
     window, so the shape under the reader's nose is the shape they can read.

     `hiSeries` are the series the TOP of the axis is sized to, `loSeries` those
     the bottom is. The band's upper edge is deliberately in neither:
     sixty years of compounding put its best decile so far above the lines that
     decide the answer that the answer becomes an unreadable sliver, so the band
     is allowed to run off the top instead and the subtitle says it does. Points
     one year either side of the window count too, so the segments that cross the
     edges are not clipped out of their own scale. */
  function makeYFit(y0, hiSeries, loSeries, opts){
    opts = opts || {};
    function edge(list, xMin, xMax, better){
      var best = null;
      list.forEach(function(arr){
        for(var i = 0; i < arr.length; i++){
          var v = arr[i], x = y0 + i;
          if(v == null || !isFinite(v)) continue;
          if(x < xMin - 1 || x > xMax + 1) continue;
          if(best === null || better(v, best)) best = v;
        }
      });
      return best;
    }
    return function(xMin, xMax){
      var hi = edge(hiSeries, xMin, xMax, function(v, b){ return v > b; });
      var lo = edge(loSeries, xMin, xMax, function(v, b){ return v < b; });
      if(hi === null || lo === null) return null;
      // A cash flow, and a balance that can go under, are both read against
      // zero, so zero stays on the axis whichever side of it the window sits.
      if(opts.includeZero && lo > 0) lo = 0;
      if(opts.includeZero && hi < 0) hi = 0;
      var pad = Math.max((hi - lo) * 0.1, Math.abs(hi) * 0.02, 1);
      var min = lo - pad * 0.6;
      if(lo >= 0 && min < 0) min = 0;   // never open a gap below an empty pot
      /* `topPad` buys extra headroom for a pane that has another one sitting on
         top of it: without it the highest tick of the lower pane and the lowest
         tick of the upper one are both drawn at the join, one on the other. */
      return {min: min, max: hi + pad * (opts.topPad || 1)};
    };
  }


  /* Chart.js clips every dataset to the whole plot area, which on a chart of
     stacked panes is all of them: a series allowed off the top of the balance
     pane would be drawn on over the flows. So a dataset on a stacked axis is
     clipped to its own pane. Both exports copy the canvas, so they inherit it.

     A fill is painted by Chart.js's own Filler plugin in the same hook, and
     registered plugins run before a chart's inline ones, so this one is
     registered globally and AHEAD of Filler: the clip is then in place before
     the fill is drawn. It touches nothing on a chart without stacked axes. */
  function registerPaneClip(){
    if(!window.Chart || !Chart.register || !Chart.registry || !Chart.registry.plugins) return false;
    if(Chart.registry.plugins.get('ffPaneClip')) return true;
    var filler = Chart.Filler || Chart.registry.plugins.get('filler');
    if(filler && Chart.unregister) Chart.unregister(filler);
    Chart.register(PANE_CLIP_PLUGIN);
    if(filler) Chart.register(filler);
    return true;
  }
  var PANE_CLIP_PLUGIN = {
    id: 'ffPaneClip',
    beforeDatasetDraw: function(chart, args){
      var ds = chart.data.datasets[args.index];
      var sc = ds && ds.yAxisID ? chart.scales[ds.yAxisID] : null;
      if(!sc || !sc.options || !sc.options.stack || !chart.chartArea) return;
      var a = chart.chartArea, ctx = chart.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.rect(a.left, sc.top, a.right - a.left, sc.bottom - sc.top);
      ctx.clip();
      args.meta.$ffPaneClip = true;
    },
    afterDatasetDraw: function(chart, args){
      if(!args.meta.$ffPaneClip) return;
      args.meta.$ffPaneClip = false;
      chart.ctx.restore();
    }
  };

  /* The life stages as sections of the x axis. Each stage is a rounded chip in
     a ribbon above the plot, spanning its ages, with its name inside; behind
     the plot its years carry a faint tint, alternating between two strengths so
     two stages that meet still read as two. No rules are drawn down the plot:
     the gridlines and the "Retire at" rule are already there, and more lines
     would only compete with the data.

     The names go on the chart rather than in the key because a stage is a
     stretch of years, not a series: there is nothing in it to hide or show.
     Drawn by a plugin, not by datasets, so no stage turns up in the hover card
     or the key, and positions are read off the x scale on every draw, so the
     sections follow a zoom or a pan. `sections` is [{x0, x1, label}] in plotted
     x (calendar years). A name too long for its chip is shortened to fit, and
     a chip with no room for a name is drawn bare. Both exports copy the canvas,
     so they carry the sections too. */
  var STAGE_RIBBON_H = 20, STAGE_RIBBON_GAP = 6;
  var STAGE_LABEL_ROOM = STAGE_RIBBON_H + STAGE_RIBBON_GAP + 6;
  // A section's on-screen left and right edges, or null when it is off screen.
  function stageSpan(sx, a, s){
    var l = Math.max(a.left, sx.getPixelForValue(s.x0));
    var r = Math.min(a.right, sx.getPixelForValue(s.x1));
    return r - l >= 1 ? {l: l, r: r} : null;
  }
  var STAGE_SECTIONS_PLUGIN = {
    id: 'ffStageSections',
    // The tint goes under the data, one block per pane so the seam between the
    // two panes stays clear.
    beforeDatasetsDraw: function(chart, args, opts){
      var list = opts && opts.sections, sx = chart.scales.x, a = chart.chartArea;
      if(!list || !list.length || !sx || !a) return;
      var panes = (opts.panes || []).map(function(id){ return chart.scales[id]; })
        .filter(function(sc){ return sc; });
      if(!panes.length) panes = [{top: a.top, bottom: a.bottom}];
      var ctx = chart.ctx;
      ctx.save();
      list.forEach(function(s, i){
        var sp = stageSpan(sx, a, s);
        if(!sp) return;
        ctx.fillStyle = i % 2 ? opts.tint2 : opts.tint;
        panes.forEach(function(p){ ctx.fillRect(sp.l, p.top, sp.r - sp.l, p.bottom - p.top); });
      });
      ctx.restore();
    },
    afterDatasetsDraw: function(chart, args, opts){
      var list = opts && opts.sections, sx = chart.scales.x, a = chart.chartArea;
      if(!list || !list.length || !sx || !a) return;
      var ctx = chart.ctx, top = a.top - STAGE_RIBBON_GAP - STAGE_RIBBON_H;
      ctx.save();
      // A phone-width chart gets a size smaller, so more of the names fit.
      ctx.font = '600 ' + (a.right - a.left < 400 ? 10 : 11) + 'px DM Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      list.forEach(function(s){
        var sp = stageSpan(sx, a, s);
        if(!sp) return;
        // One pixel off each end, so two stages that meet leave a 2px gap.
        var l = sp.l + 1, w = sp.r - sp.l - 2;
        if(w < 2) return;
        var rad = Math.min(6, w / 2);
        ctx.beginPath();
        if(ctx.roundRect) ctx.roundRect(l, top, w, STAGE_RIBBON_H, rad);
        else ctx.rect(l, top, w, STAGE_RIBBON_H);
        ctx.fillStyle = opts.chip;
        ctx.fill();
        var room = w - 10, text = s.label;
        if(room < 14) return;
        if(ctx.measureText(text).width > room){
          while(text.length > 1 && ctx.measureText(text + '…').width > room) text = text.slice(0, -1);
          text = text.trimEnd() + '…';
          if(ctx.measureText(text).width > room) return;
        }
        ctx.fillStyle = opts.textColor;
        ctx.fillText(text, l + w / 2, top + STAGE_RIBBON_H / 2 + 0.5);
      });
      ctx.restore();
    }
  };

  /* Vertical rules the full height of the plot, through every pane and the
     seam between them, at a plotted x. Each rule is drawn in the look of the
     dataset it names and only while that dataset is visible, so the key hides
     and shows it like any series. `rules` is [{x, dataset}]. */
  var RULES_PLUGIN = {
    id: 'ffRules',
    afterDatasetsDraw: function(chart, args, opts){
      var list = opts && opts.rules, sx = chart.scales.x, a = chart.chartArea;
      if(!list || !list.length || !sx || !a) return;
      var ctx = chart.ctx;
      list.forEach(function(r){
        var ds = chart.data.datasets[r.dataset];
        if(!ds || !chart.isDatasetVisible(r.dataset)) return;
        var px = sx.getPixelForValue(r.x);
        if(!(px >= a.left && px <= a.right)) return;
        ctx.save();
        ctx.strokeStyle = ds.borderColor;
        ctx.lineWidth = ds.borderWidth || 1;
        ctx.setLineDash(ds.borderDash || []);
        ctx.beginPath();
        ctx.moveTo(px, a.top);
        ctx.lineTo(px, a.bottom);
        ctx.stroke();
        ctx.restore();
      });
    }
  };

  /* Chart.js resolves an `index` tooltip by DATA INDEX: it takes the nearest
     element, reads its index, and pulls that index out of every other dataset.
     Every series here is one point per year EXCEPT the droplines, which are two
     points, and the crossing marker, which is one. Hovering either of those
     therefore asked for index 0 or 1 of the yearly series, and the tooltip
     reported the FIRST YEAR of the plan under the hovered year's heading — the
     crossing dot showing "Money deposited: $100k" in 2061.

     Matching by x VALUE is the fix, and it is the right rule anyway: these are
     linear axes where x is a calendar year, so two points belong in the same
     tooltip when they sit at the same year, whatever index they hold inside
     their own dataset. A marker between two yearly samples then answers for
     itself instead of borrowing someone else's row. */
  function registerXValueMode(){
    if(!window.Chart || !Chart.Interaction || !Chart.Interaction.modes) return false;
    if(Chart.Interaction.modes.ffXValue) return true;
    var parsedAt = function(meta, i){
      if(meta.controller && meta.controller.getParsed) return meta.controller.getParsed(i);
      return meta._parsed ? meta._parsed[i] : null;
    };
    Chart.Interaction.modes.ffXValue = function(chart, e, options, useFinalPosition){
      var pos = (Chart.helpers && Chart.helpers.getRelativePosition)
        ? Chart.helpers.getRelativePosition(e, chart) : e;
      var metas = chart.getSortedVisibleDatasetMetas();
      var anchor = null, bestPx = Infinity;
      metas.forEach(function(meta){
        meta.data.forEach(function(el, i){
          if(!el || el.skip) return;
          var parsed = parsedAt(meta, i);
          if(!parsed) return;
          var d = Math.abs(el.getProps(['x'], useFinalPosition).x - pos.x);
          if(d < bestPx){ bestPx = d; anchor = parsed.x; }
        });
      });
      if(anchor === null) return [];
      var out = [];
      metas.forEach(function(meta){
        meta.data.forEach(function(el, i){
          if(!el || el.skip) return;
          var parsed = parsedAt(meta, i);
          if(!parsed || Math.abs(parsed.x - anchor) > 1e-9) return;
          out.push({element: el, datasetIndex: meta.index, index: i});
        });
      });
      return out;
    };
    return true;
  }

  // A fitter made here travels in a shared chart by name and its series.
  makeYFit = K.make('ff.yFit', makeYFit);
  /* The balance pane: sized to the expected balance (and the bequest), with
     the band of outcomes allowed `room` of that span either side and clipped
     past it, so a band that dips under zero is still seen to. */
  var balanceFit = K.make('ff.balFit', function(y0, lines, p90, p10, dd, room){
    var fitLine = makeYFit(y0, lines, lines, {includeZero: true, topPad: 2.2});
    var fitFan = makeYFit(y0, [p90], [p10], {includeZero: true, topPad: 2.2});
    return function(xMin, xMax){
      var l = fitLine(xMin, xMax), f = dd ? fitFan(xMin, xMax) : null;
      if(!l || !f) return l || f;
      var r = room * (l.max - l.min);
      return {min: Math.min(l.min, Math.max(f.min, l.min - r)),
              max: Math.max(l.max, Math.min(f.max, l.max + r))};
    };
  });
  K.plugin(STAGE_SECTIONS_PLUGIN);
  K.plugin(RULES_PLUGIN);
  // The clip and the hover mode are Chart.js's own registrations, made as soon as it is here.
  if(global.Chart){ registerPaneClip(); registerXValueMode(); }

  global.FFKit = {
    makeYFit: makeYFit, balanceFit: balanceFit, registerPaneClip: registerPaneClip, registerXValueMode: registerXValueMode,
    STAGE_SECTIONS_PLUGIN: STAGE_SECTIONS_PLUGIN, RULES_PLUGIN: RULES_PLUGIN, STAGE_LABEL_ROOM: STAGE_LABEL_ROOM
  };
})(window);
