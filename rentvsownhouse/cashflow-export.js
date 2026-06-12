/* ────────────────────────────────────────────────────────────────────────────
   Shared cashflow CSV + chart export utilities for the Rent vs Own tools.

   Loaded by BOTH the main calculator (rentvsownhouse/) and the sensitivity tool
   (rentvsownhouse/sensitivity/) so that the Own/Rent cashflow CSVs and the chart
   PNG/SVG exports are produced by exactly the same code — guaranteeing identical
   output for identical inputs and avoiding drift between the two pages.

   Exposes window.RVOExport.
   ──────────────────────────────────────────────────────────────────────────── */
(function(global){
'use strict';

/* Watermark logo (logos/logo.svg), preloaded for use in canvas/SVG exports. */
const WM_LOGO_SRC = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDY4MCA2ODAiIHJvbGU9ImltZyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8dGl0bGU+QXJjaGVkIEEgTG9nbzwvdGl0bGU+CiAgPGRlc2M+QSBzbGVlayB3aGl0ZSBsZXR0ZXIgQSB3aG9zZSBsZWdzIGZvbGxvdyB0aGUgY2lyY2xlIGN1cnZhdHVyZSwgc3Bhbm5pbmcgODAlIG9mIHRoZSBjaXJjbGUgaGVpZ2h0PC9kZXNjPgoKICA8Y2lyY2xlIGN4PSIzNDAiIGN5PSIzNDAiIHI9IjMwMCIgZmlsbD0iIzAwNTJjYyIvPgoKICA8IS0tIExlZnQgbGVnOiAxMTPCsCB0byAyNDXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyNDIsNTcwIEEgMjUwLDI1MCAwIDAgMSAyMzQsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFRvcCBhcmNoOiAyNDXCsCB0byAyOTXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyMzQsMTEzIEEgMjUwLDI1MCAwIDAgMSA0NDYsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFJpZ2h0IGxlZzogMjk1wrAgdG8gNjfCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSA0NDYsMTEzIEEgMjUwLDI1MCAwIDAgMSA0MzgsNTcwIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIENyb3NzYmFyIC0tPgogIDxsaW5lIHgxPSIxMTMiIHkxPSIzNTQiIHgyPSI1NjciIHkyPSIzNTQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNDIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K';
const WM_TEXT = 'Made using tool.adjiebrotots.com/rentvsownhouse';
const wmLogoImg = new Image();
wmLogoImg.src = WM_LOGO_SRC;
const _wmMeasureCtx = document.createElement('canvas').getContext('2d');
function measureWmText(text, font){ _wmMeasureCtx.font = font; return _wmMeasureCtx.measureText(text).width; }

const cssVar = n => getComputedStyle(document.body).getPropertyValue(n).trim();
const isLightTheme = () => document.body.classList.contains('light');

/* ──────────────────────────────────────────────────────────────────────────
   CSV BUILDERS — produce plain CSV text with NO icons/emojis.
   Operate on the row objects produced by computeModel (identical field schema
   in both the main tool and the sensitivity tool).
   ────────────────────────────────────────────────────────────────────────── */
const CSV_PREFIX = '# ' + WM_TEXT + '\n';

function ownCashflowCSV(rows){
  const na = '';
  const headers = ['Year','Beg_Cash','Ann_Budget','Principal_Exp','Interest_Exp','Ongoing_Exp','Interest_Inc','Surplus','End_Cash','Rate_Pct','Prop_Value','Principal_Left','House_Equity','Net_Equity','Accum_Cost'];
  const lines = rows.map(r=>{
    const y0 = r.year===0;
    const hasLoanYr = !y0 && ((r.ownYearInterest||0)>0 || (r.ownYearPrincipal||0)>0);
    return [
      r.year,
      y0?na:(r.ownBegCash||0).toFixed(0),
      y0?na:(r.ownYearBudget||0).toFixed(0),
      y0?na:(r.ownYearPrincipal||0).toFixed(0),
      y0?na:(r.ownYearInterest||0).toFixed(0),
      y0?na:(r.ownYearOngoing||0).toFixed(0),
      y0?na:(r.ownYearInterestInc||0).toFixed(0),
      y0?na:(r.ownYearSurplus||0).toFixed(0),
      (r.ownCash||0).toFixed(0),
      (hasLoanYr && r.ownRateYr!==undefined)?r.ownRateYr.toFixed(2):na,
      (r.ownPropValue||0).toFixed(0),
      (r.ownPrincipal||0).toFixed(0),
      (r.ownHouseEquity||0).toFixed(0),
      (r.ownNetEquity||0).toFixed(0),
      (r.ownAccumCost||0).toFixed(0),
    ].join(',');
  });
  return CSV_PREFIX + [headers.join(','), ...lines].join('\n');
}

function rentCashflowCSV(rows){
  const na = '';
  const headers = ['Year','Beg_Cash','Ann_Budget','Rent_Exp','Ongoing_Exp','Interest_Inc','Surplus','End_Cash','Net_Equity','Accum_Cost'];
  const lines = rows.map(r=>{
    const y0 = r.year===0;
    return [
      r.year,
      y0?na:(r.rentBegCash||0).toFixed(0),
      y0?na:(r.ownYearBudget||0).toFixed(0),
      y0?na:(r.rentRent||0).toFixed(0),
      y0?na:(r.rentYearOngoing||0).toFixed(0),
      y0?na:(r.rentYearInterestInc||0).toFixed(0),
      y0?na:(r.rentYearSurplus||0).toFixed(0),
      (r.rentCash||0).toFixed(0),
      (r.rentNetEquity||0).toFixed(0),
      y0?na:(r.rentAccumCost||0).toFixed(0),
    ].join(',');
  });
  return CSV_PREFIX + [headers.join(','), ...lines].join('\n');
}

function rtbCashflowCSV(rows){
  const na = '';
  const headers = ['Year','Phase','Beg_Cash','Ann_Budget','Total_Exp','Principal_Exp','Interest_Exp','Ongoing_Exp','Interest_Inc','Surplus','End_Cash','Rate_Pct','Prop_Value','Principal_Left','House_Equity','Net_Equity','Accum_Cost'];
  const lines = rows.map(r=>{
    const y0 = r.year===0, own = r.phase!=='rent';
    const cash = r.phase==='rent' ? (r.rtbCash||0) : (r.rtbCash2||0);
    const tot = (r.rtbYearPrincipal||0)+(r.rtbYearInterest||0)+(r.rtbYearOngoing||0);
    const rtbHasLoanYr = own && r.rtbRateYr!==undefined && ((r.rtbYearInterest||0)>0 || (r.rtbYearPrincipal||0)>0);
    return [
      r.year, r.phase,
      y0?na:(r.rtbBegCash||0).toFixed(0),
      y0?na:(r.rtbYearBudget||0).toFixed(0),
      y0?na:tot.toFixed(0),
      (y0||!own)?na:(r.rtbYearPrincipal||0).toFixed(0),
      (y0||!own)?na:(r.rtbYearInterest||0).toFixed(0),
      y0?na:(r.rtbYearOngoing||0).toFixed(0),
      y0?na:(r.rtbYearInterestInc||0).toFixed(0),
      y0?na:(r.rtbYearSurplus||0).toFixed(0),
      cash.toFixed(0),
      rtbHasLoanYr?r.rtbRateYr.toFixed(2):na,
      (y0||!own)?na:(r.rtbPropValue||0).toFixed(0),
      (y0||!own)?na:(r.rtbPrincipal||0).toFixed(0),
      (y0||!own)?na:(r.rtbHouseEquity||0).toFixed(0),
      (r.rtbNetEquity||0).toFixed(0),
      y0?na:(r.rtbAccumCost||0).toFixed(0),
    ].join(',');
  });
  return CSV_PREFIX + [headers.join(','), ...lines].join('\n');
}

function downloadCSV(filename, csvText){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csvText], {type:'text/csv;charset=utf-8;'}));
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(a.href);
}

/* ──────────────────────────────────────────────────────────────────────────
   CHART IMAGE EXPORT — render a source <canvas> (a live Chart.js chart) to a
   titled, legended, watermarked PNG or SVG. Shared by the main chart-card and
   the sensitivity scenario popup.
     opts: { title, legendItems:[{label,color}], filename, download }
   ────────────────────────────────────────────────────────────────────────── */
function exportChartPNG(src, opts){
  opts = opts || {};
  if(!src) return null;
  const legendItems = opts.legendItems || [];
  const dpr = window.devicePixelRatio || 1;
  const OUT = 3;
  const chartW = Math.round(src.width / dpr * OUT);
  const chartH = Math.round(src.height / dpr * OUT);
  const isLight = isLightTheme();
  const bgColor = isLight ? '#ffffff' : '#0F1728';
  const fgColor = isLight ? '#2D3436' : '#EAF1FF';
  const FONT = '"DM Sans", sans-serif';

  const titleFontPx = Math.round(14 * OUT);
  const legendFontPx = Math.round(11 * OUT);
  const titleH = Math.round(40 * OUT);
  const legendH = legendItems.length ? Math.round(34 * OUT) : 0;

  const tmp = document.createElement('canvas');
  tmp.width = chartW;
  tmp.height = chartH + titleH + legendH;
  const ctx = tmp.getContext('2d');

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, tmp.width, tmp.height);

  ctx.font = `700 ${titleFontPx}px ${FONT}`;
  ctx.fillStyle = fgColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(opts.title || '', tmp.width / 2, titleH / 2);

  ctx.drawImage(src, 0, titleH, chartW, chartH);

  if(legendItems.length){
    const ly = titleH + chartH;
    const dotR = Math.round(5 * OUT);
    const gap = Math.round(7 * OUT);
    const pad = Math.round(20 * OUT);
    ctx.font = `500 ${legendFontPx}px ${FONT}`;
    ctx.textBaseline = 'middle';
    let totalW = 0;
    legendItems.forEach((item, i) => {
      totalW += dotR * 2 + gap + ctx.measureText(item.label).width + (i < legendItems.length - 1 ? pad : 0);
    });
    let x = Math.max(Math.round(16 * OUT), (tmp.width - totalW) / 2);
    const cy = ly + legendH / 2;
    legendItems.forEach(item => {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(x + dotR, cy, dotR, 0, Math.PI * 2);
      ctx.fill();
      x += dotR * 2 + gap;
      ctx.fillStyle = fgColor;
      ctx.textAlign = 'left';
      ctx.fillText(item.label, x, cy);
      x += ctx.measureText(item.label).width + pad;
    });
  }

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.font = `500 ${Math.round(11 * OUT)}px ${FONT}`;
  ctx.fillStyle = '#1a1a1a';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  {
    const wmX = tmp.width - Math.round(12 * OUT);
    const wmY = tmp.height - Math.round(12 * OUT);
    const wmTextW = ctx.measureText(WM_TEXT).width;
    const wmLogoSize = Math.round(13 * OUT);
    if(wmLogoImg.complete && wmLogoImg.naturalWidth){
      ctx.drawImage(wmLogoImg, wmX - wmTextW - Math.round(4 * OUT) - wmLogoSize, wmY - wmLogoSize + Math.round(2 * OUT), wmLogoSize, wmLogoSize);
    }
    ctx.fillText(WM_TEXT, wmX, wmY);
  }
  ctx.restore();

  if(opts.download !== false){
    const a = document.createElement('a');
    a.href = tmp.toDataURL('image/png');
    a.download = opts.filename || 'rent_vs_own_chart.png';
    document.body.appendChild(a); a.click(); a.remove();
  }
  return tmp;
}

async function copyChartPNG(src, opts){
  if(!navigator.clipboard || !window.ClipboardItem) throw new Error('Clipboard image copy is not supported in this browser.');
  const canvas = exportChartPNG(src, Object.assign({}, opts, {download:false}));
  if(!canvas) throw new Error('Could not build chart image.');
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if(!blob) throw new Error('Could not create PNG blob.');
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

function exportChartSVG(src, opts){
  opts = opts || {};
  if(!src) return;
  const legendItems = opts.legendItems || [];
  const dpr = window.devicePixelRatio || 1;
  const chartW = Math.round(src.width / dpr);
  const chartH = Math.round(src.height / dpr);
  const isLight = isLightTheme();
  const bgColor = isLight ? '#ffffff' : '#0F1728';
  const fgColor = isLight ? '#2D3436' : '#EAF1FF';
  const FONT = 'DM Sans, sans-serif';
  const titleH = 40;
  const legendH = legendItems.length ? 34 : 0;
  const svgW = chartW, svgH = chartH + titleH + legendH;
  const NS = 'http://www.w3.org/2000/svg', xl = 'http://www.w3.org/1999/xlink';
  const svg = document.createElementNS(NS,'svg');
  svg.setAttribute('xmlns',NS); svg.setAttribute('xmlns:xlink',xl);
  svg.setAttribute('width',svgW); svg.setAttribute('height',svgH);
  svg.setAttribute('viewBox',`0 0 ${svgW} ${svgH}`);
  const bgRect = document.createElementNS(NS,'rect');
  bgRect.setAttribute('width',svgW); bgRect.setAttribute('height',svgH); bgRect.setAttribute('fill',bgColor);
  svg.appendChild(bgRect);
  const t = document.createElementNS(NS,'text');
  t.setAttribute('x',svgW/2); t.setAttribute('y',titleH/2);
  t.setAttribute('text-anchor','middle'); t.setAttribute('dominant-baseline','middle');
  t.setAttribute('font-family',FONT); t.setAttribute('font-size','14'); t.setAttribute('font-weight','700'); t.setAttribute('fill',fgColor);
  t.textContent = opts.title || ''; svg.appendChild(t);
  const img = document.createElementNS(NS,'image');
  img.setAttribute('x',0); img.setAttribute('y',titleH);
  img.setAttribute('width',chartW); img.setAttribute('height',chartH);
  img.setAttributeNS(xl,'href',src.toDataURL('image/png'));
  svg.appendChild(img);
  if(legendItems.length){
    const dotR=5, gap=7, pad=20;
    const cy = titleH + chartH + legendH/2;
    const mc = document.createElement('canvas').getContext('2d');
    mc.font = '500 11px DM Sans, sans-serif';
    const totalW = legendItems.reduce((s,item,i) => s + dotR*2 + gap + mc.measureText(item.label).width + (i<legendItems.length-1?pad:0), 0);
    let x = Math.max(16, (svgW - totalW) / 2);
    legendItems.forEach(item => {
      const c = document.createElementNS(NS,'circle');
      c.setAttribute('cx',x+dotR); c.setAttribute('cy',cy); c.setAttribute('r',dotR); c.setAttribute('fill',item.color);
      svg.appendChild(c); x += dotR*2 + gap;
      const lt = document.createElementNS(NS,'text');
      lt.setAttribute('x',x); lt.setAttribute('y',cy);
      lt.setAttribute('dominant-baseline','middle'); lt.setAttribute('font-family',FONT);
      lt.setAttribute('font-size','11'); lt.setAttribute('font-weight','500'); lt.setAttribute('fill',fgColor);
      lt.textContent = item.label; svg.appendChild(lt);
      x += mc.measureText(item.label).width + pad;
    });
  }
  const wm = document.createElementNS(NS,'text');
  wm.setAttribute('x',svgW-12); wm.setAttribute('y',svgH-12);
  wm.setAttribute('text-anchor','end'); wm.setAttribute('dominant-baseline','auto');
  wm.setAttribute('font-family',FONT); wm.setAttribute('font-size','11');
  wm.setAttribute('font-weight','500'); wm.setAttribute('fill','#1a1a1a'); wm.setAttribute('opacity','0.22');
  wm.textContent = WM_TEXT; svg.appendChild(wm);
  const wmLogoSize = 13;
  const wmTextW = measureWmText(WM_TEXT, '500 11px ' + FONT);
  const wmLogo = document.createElementNS(NS,'image');
  wmLogo.setAttribute('href', WM_LOGO_SRC);
  wmLogo.setAttributeNS(xl,'href', WM_LOGO_SRC);
  wmLogo.setAttribute('width', wmLogoSize);
  wmLogo.setAttribute('height', wmLogoSize);
  wmLogo.setAttribute('x', svgW - 12 - wmTextW - 4 - wmLogoSize);
  wmLogo.setAttribute('y', svgH - 12 - wmLogoSize + 2);
  wmLogo.setAttribute('opacity', '0.22');
  svg.appendChild(wmLogo);
  const xml = '<?xml version="1.0" encoding="utf-8"?>\n' + new XMLSerializer().serializeToString(svg);
  const blob = new Blob([xml],{type:'image/svg+xml;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download = opts.filename || 'rent_vs_own_chart.svg';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

/* ──────────────────────────────────────────────────────────────────────────
   COMPARISON CHART (Chart.js line chart of Own vs Rent over time). Used by the
   sensitivity scenario popup; mirrors the styling of the main tool's chart.
     opts: { labels:[year...], series:[{label,data,color}], yAxisTitle, sym }
   ────────────────────────────────────────────────────────────────────────── */
function chartCurrency(v, sym){
  sym = sym || '$';
  const n = Number(v||0), abs = Math.abs(n), sign = n<0 ? '−' : '';
  if(abs>=1e9) return sign+sym+(abs/1e9).toFixed(2)+'b';
  if(abs>=1e6) return sign+sym+(abs/1e6).toFixed(2)+'m';
  if(abs>=1000) return sign+sym+(abs/1000).toFixed(0)+'k';
  return sign+sym+Math.round(abs);
}

function renderComparisonChart(canvas, opts){
  opts = opts || {};
  if(!canvas || !global.Chart) return null;
  const sym = opts.sym || '$';
  const g = cssVar('--chart-grid'), m = cssVar('--chart-text'), t = cssVar('--text');
  const labels = opts.labels || [];
  const datasets = (opts.series || []).map(s=>({
    label: s.label,
    data: s.data,
    borderColor: s.color,
    backgroundColor: s.color + '22',
    borderWidth: 2.5,
    pointRadius: 0,
    pointHoverRadius: 6,
    tension: 0.3,
    fill: false,
  }));
  const xTickCallback = function(val, i){
    const lbl = this.chart.data.labels[i];
    return (lbl !== undefined && lbl !== null) ? `Yr ${lbl}` : '';
  };
  return new global.Chart(canvas.getContext('2d'), {
    type:'line', data:{labels, datasets},
    options:{
      responsive:true, maintainAspectRatio:false, animation:{duration:200},
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{display:false},
        tooltip:{
          callbacks:{
            title: ctx=>`Year ${ctx[0].label}`,
            label: ctx=>`  ${ctx.dataset.label}: ${chartCurrency(ctx.parsed.y, sym)}`,
          },
          backgroundColor:cssVar('--panel')||'#162033',
          titleColor:t, bodyColor:m, borderColor:cssVar('--border'), borderWidth:1, padding:10,
        },
        zoom: global.Chart.registry && global.Chart.registry.plugins.get('zoom') ? {
          pan:{enabled:true,mode:'x'},
          zoom:{wheel:{enabled:true,speed:.08},pinch:{enabled:true},mode:'x'},
        } : undefined,
      },
      scales:{
        x:{title:{display:true,text:'Year',color:m,font:{family:"'DM Mono', monospace",size:11}},ticks:{color:m,maxTicksLimit:12,font:{family:"'DM Mono', monospace",size:11},callback:xTickCallback},grid:{color:g}},
        y:{title:{display:true,text:opts.yAxisTitle||'',color:m,font:{family:"'DM Mono', monospace",size:11}},ticks:{color:m,font:{family:"'DM Mono', monospace",size:11},callback:v=>chartCurrency(v, sym)},grid:{color:g}},
      },
    },
  });
}

global.RVOExport = {
  ownCashflowCSV, rentCashflowCSV, rtbCashflowCSV, downloadCSV,
  exportChartPNG, exportChartSVG, copyChartPNG, renderComparisonChart,
};

})(window);
