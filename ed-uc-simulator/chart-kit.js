/* ED/UC Simulator: the chart pieces (EDKit)

   What the charts under the diagram are drawn with beyond Chart.js and
   chart-kit.js: the marker at the hour the diagram shows, the clock the time
   axis ticks on, the labels of its hours, and the fitter's rule that the
   demand line is not part of the stack. Loaded by the tool before
   ed-charts.js, and by the embed viewer (embed/), which draws a shared chart
   with these and nothing else of the tool, so each reads its data from its
   arguments or the chart's own options. */
(function(global){
  var K = global.ChartKit;
  var EDKit = { quiet: false };
  function cssVar(n){ return getComputedStyle(document.body).getPropertyValue(n).trim(); }

  /* Where hour h sits on a chart, or null when it is off the axis. Every chart
     puts hour t at x = t (the commitment's bars are centred on it), so one
     hour is at one place on all of them. */
  function hourPx(chart, h){
    var x = chart.scales.x, area = chart.chartArea;
    if(!x || !area) return null;
    var px = x.getPixelForValue(h);
    return isFinite(px) && px >= area.left - 0.5 && px <= area.right + 0.5 ? px : null;
  }
  /* The hour marker: a dashed rule at plugins.edHour.hour. EDKit.quiet hides
     it while a GIF takes a still, which draws the marker itself. */
  var HOUR_PLUGIN = {
    id: 'edHour',
    afterDatasetsDraw: function(chart){
      var o = chart.config.options.plugins && chart.config.options.plugins.edHour;
      if(EDKit.quiet || !o || typeof o.hour !== 'number') return;
      var area = chart.chartArea, px = hourPx(chart, o.hour);
      if(px == null) return;
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

  /* Past a day, the time axis ticks on whole hours or whole days of the clock,
     as many as fit its width and the part of the horizon in view, so the
     labels never run into each other on a phone or over 30 days. h0 is the
     hour of the clock the horizon starts at. */
  var STEPS = [1, 2, 3, 6, 12, 24, 48, 72, 168, 336];
  var clockTicks = K.make('ed.clockTicks', function(H, h0){
    return function(scale){
      if(H <= 24) return;
      var lo = Math.max(0, Math.ceil(scale.min)), hi = Math.min(H, Math.floor(scale.max));
      var room = Math.max(2, Math.floor((scale.width || 600) / 84)), step = STEPS[STEPS.length - 1];
      for(var i = 0; i < STEPS.length; i++) if((hi - lo) / STEPS[i] <= room){ step = STEPS[i]; break; }
      var ticks = [];
      for(var v = lo; v <= hi; v++){
        var abs = h0 + v;
        if(step < 24 ? abs % step === 0 : abs % 24 === 0 && (abs / 24) % (step / 24) === 0) ticks.push({ value: v });
      }
      if(ticks.length) scale.ticks = ticks;
      scale.edStep = step;
    };
  });
  /* An hour's label, labels[t] for hour t; a tick on a day boundary, with
     the axis ticking by days, needs only its date. frac: a value between two
     hours is left blank (the commitment's linear axis). */
  var tickText = K.make('ed.tickText', function(labels, H, frac){
    return function(v){
      if(frac && Math.abs(v - Math.round(v)) > 1e-9) return '';
      var t = labels[Math.round(v)];
      if(t == null) return '';
      return H > 24 && this && this.edStep >= 24 ? t.slice(0, 5) : t;
    };
  });
  // The stack's top meets the demand line (plus any charging), so the line is not fitted with it.
  var skipLoad = K.fn('ed.skipLoad', function(ds){ return ds.kind === 'load'; });

  K.plugin(HOUR_PLUGIN);
  EDKit.HOUR_PLUGIN = HOUR_PLUGIN;
  EDKit.hourPx = hourPx;
  EDKit.clockTicks = clockTicks;
  EDKit.tickText = tickText;
  EDKit.skipLoad = skipLoad;
  global.EDKit = EDKit;
})(window);
