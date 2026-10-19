/* Capacity Expansion Planner: the chart pieces (CXKit)

   What its charts are drawn with beyond Chart.js and chart-kit.js: the rule
   where each decision year starts, the top edge of each year's bars, each
   decision year's new build over its bars, the typical days named over
   their hours, and the axes by year and by hour. Loaded by the tool before
   cx-charts.js, and by the embed viewer (embed/), which draws a shared chart
   with these and nothing else of the tool, so each reads its data from its
   arguments or the chart's own options. */
(function(global){
  var K = global.ChartKit;
  var FONT = '"DM Sans", sans-serif';
  function two(n){ return (n < 10 ? '0' : '') + n; }
  // MW as the planner writes it (CX.fmt.mw): whole above 100, one place below.
  function fmtMw(x){
    if(!isFinite(x)) return '\u2013';
    var a = Math.abs(x);
    if(a < 0.05) return '0';
    var s = a >= 100 ? (Math.round(a)).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : (Math.round(a * 10) / 10).toFixed(1);
    return (x < 0 ? '\u2212' : '') + s;
  }

  /* As many years as fit the axis and the part in view: every year, else the
     decision years, else every other (third…) decision year, so the labels
     never run into each other on a phone. starts: the calendar years that
     start a decision year, by index; n: how many years; last: the last year. */
  var yearTicks = K.make('cx.yearTicks', function(starts, n, last){
    return function(scale){
      var lo = Math.max(0, Math.ceil(scale.min)), hi = Math.min(n - 1, Math.floor(scale.max)), pick = [], i, m = 1;
      var g = scale.ctx;
      g.save(); g.font = '700 11px ' + FONT;
      var each = g.measureText(String(last)).width + 10;
      g.restore();
      var room = Math.max(2, Math.floor((scale.width || 600) / Math.max(24, each)));
      if(hi - lo + 1 <= room) for(i = lo; i <= hi; i++) pick.push(i);
      else {
        var dec = starts.filter(function(v){ return v >= lo && v <= hi; });
        while(Math.ceil(dec.length / m) > room) m++;
        starts.forEach(function(v, j){ if(v >= lo && v <= hi && j % m === 0) pick.push(v); });
        // Zoomed in between two decision years far apart: the years themselves.
        if(pick.length < 2){
          pick = [];
          m = Math.ceil((hi - lo + 1) / room);
          for(i = lo; i <= hi; i += m) pick.push(i);
        }
      }
      scale.ticks = pick.map(function(v){ return { value: v }; });
    };
  });

  // A faint rule where each decision year starts (dec, by index), behind the data.
  var PERIOD_PLUGIN = {
    id: 'cxPeriods',
    beforeDatasetsDraw: function(chart){
      var o = chart.config.options.plugins.cxPeriods;
      if(!o) return;
      var x = chart.scales.x, area = chart.chartArea, g = chart.ctx;
      g.save();
      g.strokeStyle = o.rule; g.lineWidth = 1;
      o.dec.forEach(function(i){
        if(!i) return;
        var px = Math.round(x.getPixelForValue(i + o.shift)) + 0.5;
        if(px <= area.left + 1 || px >= area.right - 1) return;
        g.beginPath(); g.moveTo(px, area.top); g.lineTo(px, area.bottom); g.stroke();
      });
      g.restore();
    }
  };

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

  /* Each decision year's new build over its bars ("+800 MW"), from the
     entries still showing, where the years it stands for leave room.
     built[id][k] is what technology id builds in decision year k, years[k]
     how many years decision year k stands for, at[i] the decision year
     calendar year i falls in, dec the calendar years that start one. */
  var BUILT_PLUGIN = {
    id: 'cxBuilt',
    afterDatasetsDraw: function(chart){
      var o = chart.config.options.plugins.cxBuilt;
      if(!o) return;
      var x = chart.scales.x, area = chart.chartArea, g = chart.ctx, sets = chart.data.datasets;
      g.save();
      g.beginPath(); g.rect(area.left, 0, area.right - area.left, area.bottom); g.clip();
      g.font = '600 10.5px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'bottom';
      g.lineJoin = 'round'; g.lineWidth = 3; g.strokeStyle = o.halo; g.fillStyle = o.text;
      o.dec.forEach(function(i){
        var k = o.at[i], mw = 0, top = area.bottom;
        sets.forEach(function(ds, di){
          if(ds.type !== 'bar' || !chart.isDatasetVisible(di)) return;
          var el = chart.getDatasetMeta(di).data[i];
          if(el && ds.data[i] > 1e-6) top = Math.min(top, el.y);
          if(ds.kind === 'new') mw += o.built[ds.id] ? o.built[ds.id][k] || 0 : 0;
        });
        if(!(mw >= 0.05)) return;
        var l = Math.max(area.left, x.getPixelForValue(i - 0.5)), r = Math.min(area.right, x.getPixelForValue(i + o.years[k] - 0.5));
        var txt = '+' + fmtMw(mw) + ' MW';
        if(g.measureText(txt).width > r - l - 4) txt = '+' + fmtMw(mw);
        if(g.measureText(txt).width > r - l - 4) return;
        g.strokeText(txt, (l + r) / 2, top - 3);
        g.fillText(txt, (l + r) / 2, top - 3);
      });
      g.restore();
    }
  };

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
     week's midnights by their day). The scale keeps, as $cx, each tick's
     label (text), the ticks that sit mid-block and draw no grid line
     (centre), and whether the labels are set a size smaller (small), for
     the callbacks below. ax: { hourAt, from, n, mode, wdAt, days, names }. */
  var dayTicks = K.make('cx.dayTicks', function(ax){
    var mode = ax.mode || 'day', clock = clockTicks(ax), wdAt = ax.wdAt;
    return function(scale){
      var lo = Math.max(0, Math.ceil(scale.min)), hi = Math.min(ax.n - 1, Math.floor(scale.max)), width = scale.width || 600, ticks = [], v, t;
      var st = scale.$cx = { text: {}, centre: {}, small: false };
      if(mode === 'week' && hi - lo > 60){
        var room = Math.max(2, Math.floor(width / 28)), days = 0;
        for(v = lo; v <= hi; v++){ t = ax.hourAt[v]; if(t >= 0 && t % 24 === 0) days++; }
        var step = days <= room ? 1 : days / 2 <= room ? 2 : 7;
        for(v = lo; v <= hi; v++){
          t = ax.hourAt[v];
          if(t >= 0 && t % 24 === 0 && wdAt[t] % step === 0){ ticks.push({ value: v }); st.text[v] = ax.days[wdAt[t]]; }
        }
      } else if(mode === 'day2' && hi - lo > 36){
        ax.names.forEach(function(name, i){
          v = ax.from[i] + 12;
          if(v < lo || v > hi) return;
          ticks.push({ value: v }); st.text[v] = name; st.centre[v] = 1;
        });
        // Narrower than the names: shortened, never left out, so a weekend is never read as a weekday.
        var each = width / Math.max(1, ticks.length);
        if(each < 58) ticks.forEach(function(k){ st.text[k.value] = each < 34 ? (st.text[k.value] === 'Weekend' ? 'WE' : 'WD') : st.text[k.value] === 'Weekend' ? 'Wkend' : 'Wkday'; });
        st.small = each < 58;
      } else {
        clock(scale);
        scale.ticks.forEach(function(k){ var h = ax.hourAt[k.value]; st.text[k.value] = mode === 'week' && h % 24 === 0 ? ax.days[wdAt[h]] : two(h % 24) + ':00'; });
        return;
      }
      if(ticks.length) scale.ticks = ticks;
    };
  });
  // The label, size and grid line of a tick on the day axis, from what dayTicks kept.
  var dayText = K.make('cx.dayText', function(hourAt){
    return function(v){ var st = this && this.$cx; return st && st.text[v] !== undefined ? st.text[v] : two(hourAt[v] % 24) + ':00'; };
  });
  var dayFont = K.fn('cx.dayFont', function(c){ var st = c && c.scale && c.scale.$cx; return { size: st && st.small ? 10 : 11 }; });
  var dayGrid = K.make('cx.dayGrid', function(grid){
    return function(c){ var st = c && c.scale && c.scale.$cx; return c.tick && st && st.centre[c.tick.value] ? 'transparent' : grid; };
  });

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

  // The lines a stack is read against are not part of it when the axis is fitted.
  var skipRef = K.fn('cx.skipRef', function(x){ return x.kind === 'ref'; });
  var skipLoad = K.fn('cx.skipLoad', function(x){ return x.kind === 'load'; });

  [PERIOD_PLUGIN, EDGE_PLUGIN, BUILT_PLUGIN, BLOCK_PLUGIN].forEach(K.plugin);
  global.CXKit = {
    PERIOD_PLUGIN: PERIOD_PLUGIN, EDGE_PLUGIN: EDGE_PLUGIN, BUILT_PLUGIN: BUILT_PLUGIN, BLOCK_PLUGIN: BLOCK_PLUGIN,
    yearTicks: yearTicks, dayTicks: dayTicks, dayText: dayText, dayFont: dayFont, dayGrid: dayGrid,
    skipRef: skipRef, skipLoad: skipLoad
  };
})(window);
