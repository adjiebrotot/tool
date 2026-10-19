/* DCA Scenario Explorer: the chart pieces (both pages, simulator and
   portfolio)

   The candlesticks, drawn for any visible price dataset carrying _ohlc
   ({o, h, l, c}, one value per date), with the price axis fitted to the
   candles in view so no wick is clipped. A chart without _ohlc is never
   touched, so line mode is as Chart.js draws it. The up and down colours are
   the theme's (--line-c, --line-b) at the moment of drawing.

   Loaded by both pages before their scripts, and by the embed viewer
   (embed/), which draws a shared price chart with this and Chart.js alone. */
(function(global){
  function cssVar(n){ return getComputedStyle(document.body).getPropertyValue(n).trim(); }
  function upDown(){ return { up: cssVar('--line-c') || '#2E8B57', down: cssVar('--line-b') || '#E63939' }; }

  var CANDLES = {
    id:'dcaCandles',
    afterDataLimits(chart, args){
      const scale=args.scale;
      if(!scale || scale.id!=='y') return;
      // Only the price chart carries _ohlc datasets - leave the equity chart untouched.
      if(!chart.data.datasets.some(ds=>ds._ohlc)) return;
      // Fit the y-axis to whatever is inside the currently visible x-window rather
      // than the whole history, so the candles autoscale (fill the panel) as you
      // zoom or pan instead of staying pinned to the full range's high/low.
      const xs=chart.scales.x;
      const iMin = xs ? Math.floor(xs.min) : 0;
      const iMax = xs ? Math.ceil(xs.max) : Infinity;
      let lo=Infinity, hi=-Infinity;
      chart.data.datasets.forEach((ds,di)=>{
        if(!chart.isDatasetVisible(di)) return;
        // Oscillator overlays (RSI/MACD/ADX) live on their own axes - never fold
        // them into the price scale or they'd flatten the candles.
        if(typeof ds.yAxisID==='string' && ds.yAxisID.indexOf('yOsc_')===0) return;
        if(ds._ohlc){
          const {h,l}=ds._ohlc;
          const end=Math.min(h.length-1,iMax);
          for(let i=Math.max(0,iMin);i<=end;i++){ if(h[i]!=null&&h[i]>hi)hi=h[i]; if(l[i]!=null&&l[i]<lo)lo=l[i]; }
        } else {
          // Price-axis overlays/markers (moving averages, Bollinger bands, buy
          // triangles) - keep them in view too.
          const data=ds.data; const end=Math.min(data.length-1,iMax);
          for(let i=Math.max(0,iMin);i<=end;i++){ const v=data[i]; if(v==null) continue; if(v>hi)hi=v; if(v<lo)lo=v; }
        }
      });
      if(hi>lo){ const pad=(hi-lo)*0.04; scale.min=lo-pad; scale.max=hi+pad; }
    },
    afterDatasetsDraw(chart){
      if(!chart.data.datasets.some(ds=>ds._ohlc)) return; // not the price chart
      const x=chart.scales.x, y=chart.scales.y;
      if(!x||!y) return;
      const ctx=chart.ctx, area=chart.chartArea;
      const step=Math.abs(x.getPixelForValue(1)-x.getPixelForValue(0))||6;
      const w=Math.max(1, Math.min(step*0.7, 16));
      ctx.save();
      ctx.beginPath(); ctx.rect(area.left,area.top,area.right-area.left,area.bottom-area.top); ctx.clip();
      chart.data.datasets.forEach((ds,di)=>{
        if(!ds._ohlc || !chart.isDatasetVisible(di)) return;
        const {o,h,l,c}=ds._ohlc;
        const ud=upDown();
        for(let i=0;i<c.length;i++){
          if(c[i]==null||o[i]==null) continue;
          const px=x.getPixelForValue(i);
          if(px<area.left-w||px>area.right+w) continue;
          const up=c[i]>=o[i], col=up?ud.up:ud.down;
          ctx.strokeStyle=col; ctx.fillStyle=col; ctx.lineWidth=1;
          ctx.beginPath(); ctx.moveTo(px,y.getPixelForValue(h[i])); ctx.lineTo(px,y.getPixelForValue(l[i])); ctx.stroke();
          const yO=y.getPixelForValue(o[i]), yC=y.getPixelForValue(c[i]);
          const top=Math.min(yO,yC), bot=Math.max(yO,yC);
          ctx.fillRect(px-w/2, top, w, Math.max(1,bot-top));
        }
      });
      ctx.restore();
    }
  };
  global.ChartKit.plugin(CANDLES);
  if(global.Chart && global.Chart.register) global.Chart.register(CANDLES);
})(window);
