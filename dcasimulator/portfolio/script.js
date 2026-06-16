(function(){
'use strict';

/* ─── WATERMARK LOGO (logos/logo.svg, for chart exports) ─── */
const WM_LOGO_SRC = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDY4MCA2ODAiIHJvbGU9ImltZyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8dGl0bGU+QXJjaGVkIEEgTG9nbzwvdGl0bGU+CiAgPGRlc2M+QSBzbGVlayB3aGl0ZSBsZXR0ZXIgQSB3aG9zZSBsZWdzIGZvbGxvdyB0aGUgY2lyY2xlIGN1cnZhdHVyZSwgc3Bhbm5pbmcgODAlIG9mIHRoZSBjaXJjbGUgaGVpZ2h0PC9kZXNjPgoKICA8Y2lyY2xlIGN4PSIzNDAiIGN5PSIzNDAiIHI9IjMwMCIgZmlsbD0iIzAwNTJjYyIvPgoKICA8IS0tIExlZnQgbGVnOiAxMTPCsCB0byAyNDXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyNDIsNTcwIEEgMjUwLDI1MCAwIDAgMSAyMzQsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFRvcCBhcmNoOiAyNDXCsCB0byAyOTXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyMzQsMTEzIEEgMjUwLDI1MCAwIDAgMSA0NDYsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFJpZ2h0IGxlZzogMjk1wrAgdG8gNjfCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSA0NDYsMTEzIEEgMjUwLDI1MCAwIDAgMSA0MzgsNTcwIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIENyb3NzYmFyIC0tPgogIDxsaW5lIHgxPSIxMTMiIHkxPSIzNTQiIHgyPSI1NjciIHkyPSIzNTQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNDIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K';
const wmLogoImg = new Image();
wmLogoImg.src = WM_LOGO_SRC;

/* ─── CONSTANTS ─── */
const LINE_COLOR_HEX = ['#3b82f6','#ef4444','#22c55e','#f59e0b','#a855f7','#06b6d4','#ec4899','#14b8a6'];
const PORTFOLIO_COLOR_HEX = ['#3b82f6','#ef4444','#22c55e','#f59e0b','#a855f7','#06b6d4','#ec4899','#14b8a6'];
const CASH_COLOR = '#94a3b8';
const WEEKDAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']; // 1..7
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; // 1..12
const DEFAULT_RANDOM_SEED = 25823952204;
const METHOD_LABEL = { 'towards-weight':'Towards Weight', 'constant-weight':'Constant Weight', 'constant-allocation':'Constant Allocation' };

/* ─── STATE ─── */
// Each portfolio is an independent strategy: its own assets, weights, top-ups,
// risk-free account and rebalancing. They are simulated on a shared date axis
// and compared against each other.
let portfolios = [];             // see makePortfolio() for shape
let portfolioIdCounter = 0;
let activePortfolioId = null;    // the portfolio currently being edited in the sidebar

let simResults = [];             // [{id,name,colorHex,rows,assets:[{id,name,colorHex,weight}]}]
let commonDates = [];            // shared date axis for the last run
let valueChart = null, compChart = null;
let currentCurrencySymbol = '$';
let currentRandomSeed = DEFAULT_RANDOM_SEED;
let showTopups = true;
let compViewMode = 'dollar';     // 'dollar' = absolute value · 'percent' = % of portfolio
let activeCompChartId = null;    // which portfolio the Composition Over Time chart shows
let activeCompTableId = null;    // which portfolio the Composition Table shows
let valueDsPairs = [];           // [{value, topup}] dataset indices per portfolio (value chart)
let hiddenPf = new Set();        // portfolio indices whose value line is hidden via the legend

let priceCache = {};
let tickerFetchInFlight = {};

/* ─── HELPERS ─── */
const $ = id => document.getElementById(id);
function cssVar(n){ return getComputedStyle(document.body).getPropertyValue(n).trim(); }
function showStatus(el, msg, type){ if(!el) return; el.className='status-bar status-'+type; el.innerHTML=(type==='loading'?'<span class="spinner"></span>':'')+msg; }
function hideStatus(el){ if(!el) return; el.className='status-bar'; el.textContent=''; }
function showWarning(msg){ const w=$('mainWarning'); w.textContent=msg; w.style.display='block'; }
function hideWarning(){ const w=$('mainWarning'); w.style.display='none'; }
function sanitizeSeed(v){ const n=Number(v); return Number.isFinite(n)?Math.floor(Math.abs(n)):DEFAULT_RANDOM_SEED; }

const fmt = {
  currency(v, compact=false){
    const sym=currentCurrencySymbol;
    const n=Number(v||0), abs=Math.abs(n), sign=n<0?'−':'';
    if(compact&&abs>=1e9) return sign+sym+(abs/1e9).toFixed(2)+'b';
    if(compact&&abs>=1e6) return sign+sym+(abs/1e6).toFixed(2)+'m';
    if(compact&&abs>=1e3) return sign+sym+(abs/1e3).toFixed(0)+'k';
    return sign+sym+Math.round(abs).toLocaleString('en-US');
  },
  pct(v,d=2){ const n=Number(v||0); return (Math.abs(n)<=1?n*100:n).toFixed(d)+'%'; },
  num(v,d=0){ return Number(v||0).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}); },
};

/* ─── DATE UTILS ─── */
function parseDate(s){ const [y,m,d]=s.split('-'); return new Date(+y,+m-1,+d); }
function addDays(d,n){ const r=new Date(d); r.setDate(r.getDate()+n); return r; }
function isoDate(d){ return d.toISOString().slice(0,10); }
function weekKey(d){
  const dt=parseDate(d), y=dt.getFullYear();
  const doy=Math.floor((dt-new Date(y,0,1))/86400000);
  const wk=Math.floor((doy+new Date(y,0,1).getDay())/7);
  return y+'-'+String(wk).padStart(2,'0');
}

/* ─── RNG + GBM (seeded, deterministic custom assets) ─── */
function createSeededRng(seed){
  let state=seed>>>0; if(state===0) state=0x6d2b79f5;
  return function(){
    state|=0; state=(state+0x6D2B79F5)|0;
    let t=Math.imul(state^state>>>15,1|state);
    t^=t+Math.imul(t^t>>>7,61|t);
    return ((t^t>>>14)>>>0)/4294967296;
  };
}
function deriveSeed(baseSeed, key=''){
  let h=(sanitizeSeed(baseSeed)>>>0)||0x811c9dc5;
  for(let i=0;i<key.length;i++){ h^=key.charCodeAt(i); h=Math.imul(h,16777619)>>>0; }
  return h>>>0;
}
function generateGBMPrices(startDate, endDate, annualReturn, annualStd, startPrice=100, randomFn=Math.random){
  const dates=[], prices=[];
  let d=new Date(startDate); const end=new Date(endDate);
  let price=startPrice; const dt=1/252, mu=annualReturn/100, sigma=annualStd/100;
  while(d<=end){
    const dow=d.getDay();
    if(dow!==0&&dow!==6){
      dates.push(isoDate(d)); prices.push(price);
      const z=(randomFn()*2-1)+(randomFn()*2-1)+(randomFn()*2-1);
      price=price*Math.exp((mu-0.5*sigma*sigma)*dt+sigma*Math.sqrt(dt)*z);
    }
    d=addDays(d,1);
  }
  return {dates, prices};
}

/* ─── YAHOO FINANCE FETCH (shared engine from ../../shared.js) ─── */
// Reliability engine (concurrent proxy race + retries + optional self-hosted
// proxy failsafe) lives in shared.js, shared with the main simulator. Deploy
// yf-proxy-worker.js and call SharedYF.setProxy(...) to bypass public proxies.
async function fetchYahooFinance(ticker, startDate, endDate){
  if(!window.SharedYF) throw new Error('Market data engine not loaded (shared.js)');
  return window.SharedYF.fetchPrices(ticker, startDate, endDate);
}
async function ensureTickerCached(ticker, reqStart, reqEnd){
  const tk=String(ticker||'').trim().toUpperCase();
  if(!tk) throw new Error('Invalid ticker');
  const entry=priceCache[tk];
  if(entry && entry.coverageStart<=reqStart && entry.coverageEnd>=reqEnd) return;
  if(tickerFetchInFlight[tk]){ await tickerFetchInFlight[tk]; return; }
  tickerFetchInFlight[tk]=(async()=>{
    const e=priceCache[tk];
    if(e && e.coverageStart<=reqStart && e.coverageEnd>=reqEnd) return;
    const fStart=e?(e.coverageStart<reqStart?e.coverageStart:reqStart):reqStart;
    const fEnd=e?(e.coverageEnd>reqEnd?e.coverageEnd:reqEnd):reqEnd;
    const data=await fetchYahooFinance(tk,fStart,fEnd);
    if(!data.dates.length) throw new Error('No price data in range');
    priceCache[tk]={dates:data.dates,prices:data.prices,coverageStart:fStart,coverageEnd:fEnd,source:data.source,kind:data.kind};
  })();
  try{ await tickerFetchInFlight[tk]; } finally{ delete tickerFetchInFlight[tk]; }
}
function getCachedPriceSlice(ticker, startDate, endDate){
  const tk=String(ticker||'').trim().toUpperCase();
  const e=priceCache[tk]; if(!e) return null;
  const si=e.dates.findIndex(d=>d>=startDate);
  const ei=e.dates.findLastIndex(d=>d<=endDate);
  if(si<0||ei<0||si>ei) return null;
  return {dates:e.dates.slice(si,ei+1), prices:e.prices.slice(si,ei+1)};
}
function isTickerRangeCovered(ticker, startDate, endDate){
  const tk=String(ticker||'').trim().toUpperCase();
  const e=priceCache[tk];
  return !!(e && e.coverageStart<=startDate && e.coverageEnd>=endDate);
}

/* ─── PORTFOLIO MODEL ─── */
function makePortfolio(name, colorHex){
  return {
    id:++portfolioIdCounter,
    name: name||('Portfolio '+(portfolios.length+1)),
    colorHex: colorHex||PORTFOLIO_COLOR_HEX[portfolios.length % PORTFOLIO_COLOR_HEX.length],
    assets:[], assetIdCounter:0,
    topup:{ amount:5000 },
    topupSched:{ period:'monthly', weekdays:[1], daysOfMonth:[1], dayOfMonth:1, month:1 },
    rf:{ mode:'rate', rate:0, ticker:'' },
    rebal:{ method:'towards-weight', cwTiming:'at-topup', buyFee:0.1, sellFee:0.1 },
    rebalSched:{ period:'quarterly', weekdays:[1], daysOfMonth:[1], dayOfMonth:1, month:1 }
  };
}
function getActive(){ return portfolios.find(p=>p.id===activePortfolioId)||null; }
function totalWeight(p){ return (p?p.assets:[]).reduce((s,a)=>s+(a.weight||0),0); }

function addPortfolio(name, colorHex){
  const p=makePortfolio(name, colorHex);
  portfolios.push(p);
  activePortfolioId=p.id;
  return p;
}
function removePortfolio(id){
  portfolios=portfolios.filter(p=>p.id!==id);
  if(activePortfolioId===id) activePortfolioId=portfolios.length?portfolios[0].id:null;
  loadControlsFromActive();
  renderPortfolioList(); renderPfSelectors();
}
function duplicatePortfolio(id){
  const src=portfolios.find(p=>p.id===id); if(!src) return;
  const copy=JSON.parse(JSON.stringify(src));
  copy.id=++portfolioIdCounter;
  copy.name=src.name+' (copy)';
  copy.colorHex=PORTFOLIO_COLOR_HEX[portfolios.length % PORTFOLIO_COLOR_HEX.length];
  // clear any cached price arrays carried by the deep copy
  copy.assets.forEach(a=>{ a.priceData=null; a.px=null; a.loaded=false; a.open=false; });
  const idx=portfolios.findIndex(p=>p.id===id);
  portfolios.splice(idx+1,0,copy);
  setActive(copy.id);
}
function setActive(id){
  activePortfolioId=id;
  loadControlsFromActive();
  renderPortfolioList();
  renderPfSelectors();
}

/* ─── PORTFOLIO TABS (Portfolios tab) ─── */
/* One compact tab per portfolio: click to edit it, double-click to rename. */
function renderPortfolioList(){
  const el=$('portfolioTabs'); if(!el) return;
  // Grab the + Add button before clearing — it lives inside this container after the
  // first render, so detach-and-reuse keeps its click listener intact across re-renders.
  const addBtn=$('addPortfolioBtn');
  el.innerHTML='';
  portfolios.forEach(p=>{
    const tab=document.createElement('div');
    tab.className='pf-tab'+(p.id===activePortfolioId?' active':'');
    tab.title=p.name;

    const dot=document.createElement('input');
    dot.type='color'; dot.className='pf-tab-dot'; dot.value=p.colorHex; dot.title='Pick colour';
    dot.addEventListener('click',e=>e.stopPropagation());
    dot.addEventListener('input',e=>{ p.colorHex=e.target.value; renderViewSelectors(); });
    tab.appendChild(dot);

    const name=document.createElement('span');
    name.className='pf-tab-name'; name.textContent=p.name;
    tab.appendChild(name);

    tab.addEventListener('click',()=>{ if(p.id!==activePortfolioId){ setActive(p.id); switchSubTab('assets'); } });
    tab.addEventListener('dblclick',()=>startRenamePortfolio(tab, p));
    el.appendChild(tab);
  });
  // Keep the + Add button directly beside the last portfolio so it flows (and wraps) with the tabs.
  if(addBtn) el.appendChild(addBtn);
}

/* Inline rename on the active tab (double-click), mirroring the scenario bar. */
function startRenamePortfolio(tab, p){
  const nameSpan=tab.querySelector('.pf-tab-name'); if(!nameSpan) return;
  const input=document.createElement('input');
  input.type='text'; input.className='pf-tab-rename'; input.value=p.name;
  input.addEventListener('click',e=>e.stopPropagation());
  input.addEventListener('dblclick',e=>e.stopPropagation());
  const commit=()=>{ p.name=input.value.trim()||p.name; renderPortfolioList(); renderViewSelectors(); };
  input.addEventListener('blur',commit);
  input.addEventListener('keydown',e=>{
    if(e.key==='Enter'){ e.preventDefault(); commit(); }
    if(e.key==='Escape'){ renderPortfolioList(); }
  });
  nameSpan.replaceWith(input);
  input.focus(); input.select();
}

/* The active tab is the portfolio being edited, so there is no separate selector to fill. */
function renderPfSelectors(){
  updateEditSectionVisibility();
}
function updateEditSectionVisibility(){
  const sec=$('pfEditSection'); if(sec) sec.style.display=portfolios.length?'':'none';
}

/* ─── LOAD ACTIVE PORTFOLIO INTO THE SIDEBAR CONTROLS ─── */
function selectRadio(name, value){
  document.querySelectorAll(`input[name="${name}"]`).forEach(r=>{
    const on=r.value===value; r.checked=on;
    const opt=r.closest('.radio-opt'); if(opt) opt.classList.toggle('selected',on);
  });
}
function loadControlsFromActive(){
  const p=getActive();
  const hasP=!!p;
  // disable/enable add-asset controls if there is no portfolio
  ['addAssetBtn','newAssetName','assetTickerInput'].forEach(id=>{ const e=$(id); if(e) e.disabled=!hasP; });
  if(!hasP){ renderAssetList(); return; }

  // Top-ups
  $('topupAmount').value=p.topup.amount;
  $('topupPeriod').value=p.topupSched.period;
  renderScheduleBox('topupScheduleBox','topupScheduleHint',p.topupSched);

  // Risk-free
  selectRadio('rfMode', p.rf.mode);
  $('rfRateRow').style.display=p.rf.mode==='ticker'?'none':'';
  $('rfTickerRow').style.display=p.rf.mode==='ticker'?'':'none';
  $('rfRate').value=p.rf.rate;
  $('rfTicker').value=p.rf.ticker;

  // Rebalancing
  selectRadio('rebalMethod', p.rebal.method);
  $('constantWeightOpts').style.display=p.rebal.method==='constant-weight'?'':'none';
  selectRadio('cwTiming', p.rebal.cwTiming);
  $('rebalScheduleWrap').style.display=(p.rebal.method==='constant-weight'&&p.rebal.cwTiming==='schedule')?'':'none';
  $('rebalPeriod').value=p.rebalSched.period;
  renderScheduleBox('rebalScheduleBox','rebalScheduleHint',p.rebalSched);
  $('buyFee').value=p.rebal.buyFee;
  $('sellFee').value=p.rebal.sellFee;

  renderAssetList();
}

/* ─── ASSET MANAGEMENT (operates on the active portfolio) ─── */
function addAsset(cfg){
  const p=getActive(); if(!p) return null;
  const id=++p.assetIdCounter;
  const colorIdx=p.assets.length % LINE_COLOR_HEX.length;
  p.assets.forEach(a=>a.open=false);
  const asset={
    id, type:cfg.type||'custom', ticker:cfg.ticker||'', name:cfg.name||cfg.ticker||'Asset',
    colorHex:cfg.colorHex||LINE_COLOR_HEX[colorIdx],
    weight:cfg.weight!=null?cfg.weight:0,
    returnPct:cfg.returnPct!=null?cfg.returnPct:8, stdPct:cfg.stdPct!=null?cfg.stdPct:15,
    loaded:false, open:true, priceData:null, px:null
  };
  p.assets.push(asset);
  renderAssetList();
  return asset;
}
function removeAsset(id){ const p=getActive(); if(!p) return; p.assets=p.assets.filter(a=>a.id!==id); renderAssetList(); renderPortfolioList(); }

function renderAssetList(){
  const el=$('assetList'); if(!el) return;
  const p=getActive();
  if(!p || !p.assets.length){
    el.innerHTML='<div style="color:var(--muted);font-size:.82rem;padding:8px 0">'+(p?'No assets added yet.':'Add a portfolio first.')+'</div>';
    updateWeightSummary();
    return;
  }
  el.innerHTML='';
  p.assets.forEach(a=>{
    const card=document.createElement('div');
    card.className='sec-card';
    card.innerHTML=`
      <div class="sec-header" data-id="${a.id}">
        <span class="color-dot" style="background:${a.colorHex}"></span>
        <span class="sec-name">${a.name}</span>
        <span class="sec-badge ${a.type==='ticker'?'badge-ticker':'badge-custom'}">${a.type==='ticker'?'📊 Ticker':'⚙️ Custom'}</span>
        <span class="asset-weight-pill">${fmt.num(a.weight,1)}%</span>
        <span style="color:var(--muted);font-size:.9rem">${a.open?'▲':'▼'}</span>
      </div>
      <div class="sec-body ${a.open?'open':''}" id="assetBody${a.id}">
        ${a.type==='custom'?`
        <div class="sec-row">
          <label>Return (% p.a.) <span class="tip-icon" data-tip="Expected annual return for the simulated price path (Geometric Brownian Motion).">?</span></label>
          <input class="num-input" id="aRet${a.id}" type="number" min="-50" max="200" step="0.5" value="${a.returnPct}" style="max-width:80px"/>
        </div>
        <div class="sec-row">
          <label>Std deviation (%) <span class="tip-icon" data-tip="Annual volatility. Higher = more volatile simulated path.">?</span></label>
          <input class="num-input" id="aStd${a.id}" type="number" min="0" max="200" step="0.5" value="${a.stdPct}" style="max-width:80px"/>
        </div>`:`
        <div class="sec-row" style="align-items:center">
          <span style="font-size:.8rem;color:var(--muted)">Ticker: <strong style="color:var(--text)">${a.ticker}</strong></span>
          <span class="status-bar ${a.loaded?'status-ok':''}" style="display:inline-block;font-size:.75rem;padding:2px 8px;margin-left:4px" id="aLoad${a.id}">${a.loaded?'✓ Loaded':'Not loaded'}</span>
        </div>`}
        <div class="asset-weight-row">
          <label>Target weight (%) <span class="tip-icon" data-tip="Target portfolio weight (or top-up allocation for Constant Allocation). All weights in this portfolio must sum to 100%.">?</span></label>
          <input class="num-input" id="aWeight${a.id}" type="number" min="0" max="100" step="1" value="${a.weight}"/>
        </div>
        <button class="sec-del" id="aDel${a.id}" style="margin-top:8px">🗑 Remove</button>
      </div>`;
    el.appendChild(card);

    card.querySelector('.sec-header').addEventListener('click',()=>{
      const willOpen=!a.open;
      if(willOpen) p.assets.forEach(o=>{ if(o.id!==a.id) o.open=false; });
      a.open=willOpen; renderAssetList();
    });
    $(`aDel${a.id}`).addEventListener('click',e=>{ e.stopPropagation(); removeAsset(a.id); });
    $(`aWeight${a.id}`).addEventListener('input',e=>{ a.weight=parseFloat(e.target.value)||0; updateWeightSummary(); const pill=card.querySelector('.asset-weight-pill'); if(pill) pill.textContent=fmt.num(a.weight,1)+'%'; renderPortfolioList(); });
    if(a.type==='custom'){
      $(`aRet${a.id}`).addEventListener('input',e=>{ a.returnPct=parseFloat(e.target.value)||0; });
      $(`aStd${a.id}`).addEventListener('input',e=>{ a.stdPct=parseFloat(e.target.value)||0; });
    }
  });
  const cp=$('newAssetColor'); if(cp) cp.value=LINE_COLOR_HEX[p.assets.length % LINE_COLOR_HEX.length];
  updateWeightSummary();
}
function updateWeightSummary(){
  const el=$('weightSummary'); if(!el) return;
  const p=getActive();
  if(!p || !p.assets.length){ el.style.display='none'; return; }
  el.style.display='flex';
  const t=totalWeight(p);
  const ok=Math.abs(t-100)<0.5;
  el.className='weight-summary '+(ok?'ok':'bad');
  el.innerHTML=`<span>Total weight</span><span>${fmt.num(t,1)}% ${ok?'✓':'· must equal 100%'}</span>`;
}

/* ─── PORTFOLIO BAR ACTIONS (act on the active portfolio) ─── */
$('addPortfolioBtn').addEventListener('click',()=>{
  addPortfolio();   // auto-named "Portfolio N" with an auto colour — rename by double-click
  loadControlsFromActive(); renderPortfolioList(); renderPfSelectors();
  switchSubTab('assets');
});
$('dupPortfolioBtn').addEventListener('click',()=>{ if(activePortfolioId!=null) duplicatePortfolio(activePortfolioId); });
$('delPortfolioBtn').addEventListener('click',()=>{ if(activePortfolioId!=null) removePortfolio(activePortfolioId); });

/* ─── ADD ASSET BUTTON ─── */
$('addAssetBtn').addEventListener('click', async()=>{
  if(!getActive()){ showStatus($('assetFetchStatus'),'Add a portfolio first.','error'); return; }
  const name=$('newAssetName').value.trim();
  const type=document.querySelector('input[name="newAssetType"]:checked')?.value||'custom';
  const colorHex=$('newAssetColor').value;
  if(type==='ticker'){
    const ticker=$('assetTickerInput').value.trim().toUpperCase();
    if(!ticker){ showStatus($('assetFetchStatus'),'Please enter a ticker symbol.','error'); return; }
    const asset=addAsset({type:'ticker', ticker, name:name||ticker, colorHex});
    $('newAssetName').value=''; $('assetTickerInput').value='';
    const sd=$('startDate').value||'2020-01-01', ed=$('endDate').value||isoDate(new Date());
    showStatus($('assetFetchStatus'),'Fetching '+ticker+'...','loading');
    try{ await ensureTickerCached(ticker,sd,ed); asset.loaded=true; const e=priceCache[ticker.toUpperCase()]; if(e.kind==='stock'&&e.source==='stooq'){ showStatus($('assetFetchStatus'),'⚠️ '+ticker+' loaded from Stooq (Yahoo Finance was unavailable): '+e.dates.length+' trading days. Stooq stock prices are <strong>not</strong> adjusted for splits/dividends, so returns across those events may differ slightly.','warn'); } else { showStatus($('assetFetchStatus'),ticker+' cached: '+e.dates.length+' trading days','ok'); } }
    catch(err){ asset.loaded=false; showStatus($('assetFetchStatus'),'Failed to load '+ticker+': '+err.message,'error'); }
    renderAssetList(); renderPortfolioList();
  } else {
    if(!name){ showStatus($('assetFetchStatus'),'Please enter an asset name.','error'); return; }
    addAsset({type:'custom', name, colorHex});
    $('newAssetName').value=''; hideStatus($('assetFetchStatus')); renderPortfolioList();
  }
});
$('assetTickerInput').addEventListener('keydown',e=>{ if(e.key==='Enter') $('addAssetBtn').click(); });
$('newAssetName').addEventListener('keydown',e=>{ if(e.key==='Enter') $('addAssetBtn').click(); });
document.querySelectorAll('input[name="newAssetType"]').forEach(r=>{
  r.addEventListener('change',()=>{
    $('assetTickerRow').style.display=r.value==='ticker'?'':'none';
    document.querySelectorAll('#atypeOptCustom,#atypeOptTicker').forEach(o=>o.classList.remove('selected'));
    r.closest('.radio-opt').classList.add('selected');
  });
});

/* ─── SCHEDULE EDITOR ─── */
function renderScheduleBox(boxId, hintId, sched){
  const box=$(boxId), hint=$(hintId); if(!box||!hint) return;
  const p=sched.period;
  if(p==='weekly'||p==='fortnightly'){
    box.innerHTML='<div class="weekday-grid">'+WEEKDAYS.map((w,i)=>{
      const v=i+1, on=sched.weekdays.includes(v);
      return `<div class="weekday-chip${on?' active':''}" data-wd="${v}">${w}</div>`;
    }).join('')+'</div>';
    box.querySelectorAll('.weekday-chip').forEach(chip=>{
      chip.addEventListener('click',()=>{
        const v=+chip.dataset.wd;
        const idx=sched.weekdays.indexOf(v);
        if(idx>=0){ if(sched.weekdays.length>1) sched.weekdays.splice(idx,1); }
        else sched.weekdays.push(v);
        chip.classList.toggle('active', sched.weekdays.includes(v));
      });
    });
    hint.textContent=p==='weekly'?'Top-up on each selected weekday, every week.':'Top-up on each selected weekday, every second week.';
  } else if(p==='monthly'){
    box.innerHTML=`<div class="sched-inline"><label>Day(s) of month</label><input class="txt-input" id="${boxId}_dom" value="${sched.daysOfMonth.join(', ')}" placeholder="e.g. 1 or 1, 15"/></div>`;
    $(boxId+'_dom').addEventListener('input',e=>{
      const arr=e.target.value.split(',').map(s=>parseInt(s.trim(),10)).filter(n=>n>=1&&n<=31);
      sched.daysOfMonth=arr.length?arr:[1];
    });
    hint.textContent='Top-up on the closest trading day to each listed day, every month.';
  } else if(p==='quarterly'){
    box.innerHTML=`<div class="sched-inline"><label>Day of month</label><input class="num-input" id="${boxId}_dom" type="number" min="1" max="31" value="${sched.dayOfMonth}"/></div>`;
    $(boxId+'_dom').addEventListener('input',e=>{ sched.dayOfMonth=Math.min(31,Math.max(1,parseInt(e.target.value,10)||1)); });
    hint.textContent='Top-up on that day in January, April, July and October.';
  } else if(p==='yearly'){
    box.innerHTML=`<div class="sched-inline">
      <label>Month</label>
      <select class="num-input" id="${boxId}_mon" style="max-width:90px">${MONTHS.map((m,i)=>`<option value="${i+1}" ${sched.month===i+1?'selected':''}>${m}</option>`).join('')}</select>
      <label>Day</label>
      <input class="num-input" id="${boxId}_dom" type="number" min="1" max="31" value="${sched.dayOfMonth}" style="max-width:70px"/>
    </div>`;
    $(boxId+'_mon').addEventListener('change',e=>{ sched.month=parseInt(e.target.value,10)||1; });
    $(boxId+'_dom').addEventListener('input',e=>{ sched.dayOfMonth=Math.min(31,Math.max(1,parseInt(e.target.value,10)||1)); });
    hint.textContent='One top-up per year on the chosen month and day.';
  }
}

/* ─── CONFIG INPUT BINDINGS (write to the active portfolio) ─── */
$('topupAmount').addEventListener('input',e=>{ const p=getActive(); if(p){ p.topup.amount=parseFloat(e.target.value)||0; renderPortfolioList(); } });
$('topupPeriod').addEventListener('change',e=>{ const p=getActive(); if(!p) return; p.topupSched.period=e.target.value; renderScheduleBox('topupScheduleBox','topupScheduleHint',p.topupSched); renderPortfolioList(); });
$('rebalPeriod').addEventListener('change',e=>{ const p=getActive(); if(!p) return; p.rebalSched.period=e.target.value; renderScheduleBox('rebalScheduleBox','rebalScheduleHint',p.rebalSched); });
$('rfRate').addEventListener('input',e=>{ const p=getActive(); if(p) p.rf.rate=parseFloat(e.target.value)||0; });
$('rfTicker').addEventListener('input',e=>{ const p=getActive(); if(p) p.rf.ticker=e.target.value.trim().toUpperCase(); });
$('buyFee').addEventListener('input',e=>{ const p=getActive(); if(p) p.rebal.buyFee=parseFloat(e.target.value)||0; });
$('sellFee').addEventListener('input',e=>{ const p=getActive(); if(p) p.rebal.sellFee=parseFloat(e.target.value)||0; });

document.querySelectorAll('input[name="rfMode"]').forEach(r=>{
  r.addEventListener('change',()=>{
    const ticker=r.value==='ticker';
    $('rfRateRow').style.display=ticker?'none':'';
    $('rfTickerRow').style.display=ticker?'':'none';
    document.querySelectorAll('#rfOptRate,#rfOptTicker').forEach(o=>o.classList.remove('selected'));
    r.closest('.radio-opt').classList.add('selected');
    const p=getActive(); if(p) p.rf.mode=r.value;
  });
});
document.querySelectorAll('input[name="rebalMethod"]').forEach(r=>{
  r.addEventListener('change',()=>{
    document.querySelectorAll('[data-method]').forEach(o=>o.classList.remove('selected'));
    r.closest('[data-method]').classList.add('selected');
    $('constantWeightOpts').style.display=r.value==='constant-weight'?'':'none';
    const p=getActive(); if(p) p.rebal.method=r.value;
    renderPortfolioList();
  });
});
document.querySelectorAll('input[name="cwTiming"]').forEach(r=>{
  r.addEventListener('change',()=>{
    document.querySelectorAll('[data-cwtiming]').forEach(o=>o.classList.remove('selected'));
    r.closest('[data-cwtiming]').classList.add('selected');
    $('rebalScheduleWrap').style.display=r.value==='schedule'?'':'none';
    const p=getActive(); if(p) p.rebal.cwTiming=r.value;
  });
});

/* ─── SCHEDULE INDEX GENERATION ─── */
function closestByDom(idxs, dates, targetDom){
  let best=idxs[0];
  for(const i of idxs){
    const day=parseInt(dates[i].slice(8,10),10);
    if(Math.abs(day-targetDom)<Math.abs(parseInt(dates[best].slice(8,10),10)-targetDom)) best=i;
  }
  return best;
}
function closestByDow(idxs, dates, targetDow){
  let best=idxs[0];
  for(const i of idxs){
    const dow=parseDate(dates[i]).getDay()||7, bd=parseDate(dates[best]).getDay()||7;
    if(Math.abs(dow-targetDow)<Math.abs(bd-targetDow)) best=i;
  }
  return best;
}
function getScheduleIndices(dates, sched){
  const res=new Set();
  const p=sched.period;
  if(p==='weekly'||p==='fortnightly'){
    const groups=new Map();
    dates.forEach((d,i)=>{ const k=weekKey(d); if(!groups.has(k))groups.set(k,[]); groups.get(k).push(i); });
    const wds=(sched.weekdays&&sched.weekdays.length)?sched.weekdays:[1];
    [...groups.values()].forEach((idxs,gi)=>{
      if(p==='fortnightly' && gi%2!==0) return;
      wds.forEach(wd=>res.add(closestByDow(idxs,dates,wd)));
    });
  } else if(p==='monthly'){
    const months=new Map();
    dates.forEach((d,i)=>{ const ym=d.slice(0,7); if(!months.has(ym))months.set(ym,[]); months.get(ym).push(i); });
    const doms=(sched.daysOfMonth&&sched.daysOfMonth.length)?sched.daysOfMonth:[1];
    months.forEach(idxs=>doms.forEach(dom=>res.add(closestByDom(idxs,dates,dom))));
  } else if(p==='quarterly'){
    const months=new Map();
    dates.forEach((d,i)=>{ const ym=d.slice(0,7); if(!months.has(ym))months.set(ym,[]); months.get(ym).push(i); });
    months.forEach((idxs,ym)=>{ const m=parseInt(ym.slice(5,7),10); if(m===1||m===4||m===7||m===10) res.add(closestByDom(idxs,dates,sched.dayOfMonth||1)); });
  } else if(p==='yearly'){
    const years=new Map();
    dates.forEach((d,i)=>{ const y=d.slice(0,4); if(!years.has(y))years.set(y,[]); years.get(y).push(i); });
    years.forEach(idxs=>{ const inMonth=idxs.filter(i=>parseInt(dates[i].slice(5,7),10)===(sched.month||1)); if(inMonth.length) res.add(closestByDom(inMonth,dates,sched.dayOfMonth||1)); });
  }
  return res;
}

/* ─── BUY / REBALANCE HELPERS (operate on a given asset set + state) ─── */
function investedValue(assets, state, i){ return assets.reduce((s,a)=>s+state.units[a.id]*a.px[i],0); }
function buyByWeights(assets, state, i, buyFee){
  const cash=state.cash; if(cash<=0) return;
  assets.forEach(a=>{
    const dollars=cash*(a.weight/100);
    if(dollars<=0) return;
    state.units[a.id]+=dollars*(1-buyFee)/a.px[i];
    state.cash-=dollars;
  });
  if(state.cash<1e-9) state.cash=0;
}
function buyUnderweight(assets, state, i, buyFee){
  const C=state.cash; if(C<=0) return;
  const total=investedValue(assets,state,i)+C;
  const deficits=assets.map(a=>Math.max(0, total*(a.weight/100)-state.units[a.id]*a.px[i]));
  const sum=deficits.reduce((s,d)=>s+d,0);
  if(sum<=0) return;
  const scale=Math.min(1, C/sum);
  assets.forEach((a,k)=>{
    const spend=deficits[k]*scale;
    if(spend<=0) return;
    state.units[a.id]+=spend*(1-buyFee)/a.px[i];
    state.cash-=spend;
  });
  if(state.cash<1e-9) state.cash=0;
}
function fullRebalance(assets, state, i, buyFee, sellFee){
  const T=state.cash+investedValue(assets,state,i);
  if(T<=0) return;
  // Sell overweight
  assets.forEach(a=>{
    const price=a.px[i], value=state.units[a.id]*price, target=T*(a.weight/100);
    if(value>target){
      const sellDollars=value-target;
      state.units[a.id]-=sellDollars/price;
      state.cash+=sellDollars*(1-sellFee);
    }
  });
  // Buy underweight with whatever cash is available (scaled to avoid overspend)
  const buys=assets.map(a=>{ const value=state.units[a.id]*a.px[i], target=T*(a.weight/100); return Math.max(0,target-value); });
  const totalBuy=buys.reduce((s,b)=>s+b,0);
  if(totalBuy>0){
    const scale=Math.min(1, state.cash/totalBuy);
    assets.forEach((a,k)=>{ const spend=buys[k]*scale; if(spend<=0) return; state.units[a.id]+=spend*(1-buyFee)/a.px[i]; state.cash-=spend; });
  }
  if(state.cash<1e-9) state.cash=0;
}

/* ─── SIMULATE A SINGLE PORTFOLIO OVER THE COMMON AXIS ─── */
function simulatePortfolio(p, assets, common, rfPx){
  const method=p.rebal.method, cwTiming=p.rebal.cwTiming;
  const buyFee=(p.rebal.buyFee||0)/100, sellFee=(p.rebal.sellFee||0)/100;
  const amount=p.topup.amount||0;
  const rfMode=p.rf.mode, rfRate=p.rf.rate||0;
  const rfDayFactor=Math.pow(1+rfRate/100, 1/252);
  const topupSet=getScheduleIndices(common, p.topupSched);
  let rebalSet=new Set();
  if(method==='constant-weight' && cwTiming==='schedule') rebalSet=getScheduleIndices(common, p.rebalSched);

  const state={cash:0, units:{}};
  assets.forEach(a=>state.units[a.id]=0);
  const rows=[]; let cumTopup=0;
  for(let i=0;i<common.length;i++){
    if(i>0){ state.cash *= (rfMode==='ticker' && rfPx ? (rfPx[i]/rfPx[i-1]) : rfDayFactor); }
    if(topupSet.has(i)){
      state.cash+=amount; cumTopup+=amount;
      if(method==='constant-allocation') buyByWeights(assets,state,i,buyFee);
      else if(method==='towards-weight') buyUnderweight(assets,state,i,buyFee);
      else if(method==='constant-weight'){
        if(cwTiming==='at-topup'){ buyUnderweight(assets,state,i,buyFee); fullRebalance(assets,state,i,buyFee,sellFee); }
        else buyUnderweight(assets,state,i,buyFee);
      }
    }
    if(rebalSet.has(i)) fullRebalance(assets,state,i,buyFee,sellFee);
    const assetVals={}; let invested=0;
    assets.forEach(a=>{ const v=state.units[a.id]*a.px[i]; assetVals[a.id]=v; invested+=v; });
    rows.push({date:common[i], cash:state.cash, assetVals, invested, total:state.cash+invested, cumTopup});
  }
  return rows;
}

/* ─── RUN SIMULATION (all portfolios on a shared date axis) ─── */
async function runSimulation(){
  hideWarning();
  if(!portfolios.length){ showWarning('Add at least one portfolio to run a comparison.'); return; }
  const startDate=$('startDate').value, endDate=$('endDate').value;
  if(!startDate||!endDate){ showWarning('Please set start and end dates.'); return; }
  if(startDate>=endDate){ showWarning('Start date must be before end date.'); return; }
  for(const p of portfolios){
    if(!p.assets.length){ showWarning(`Portfolio "${p.name}" has no assets — add some or remove the portfolio.`); return; }
    if(Math.abs(totalWeight(p)-100)>0.5){ showWarning(`Asset weights in "${p.name}" must sum to 100% (currently ${fmt.num(totalWeight(p),1)}%).`); return; }
    if((p.topup.amount||0)<=0){ showWarning(`Top-up amount in "${p.name}" must be greater than zero.`); return; }
    if(p.rf.mode==='ticker' && !p.rf.ticker){ showWarning(`Enter a risk-free ticker for "${p.name}" or switch it to a fixed rate.`); return; }
  }

  const simBtn=$('simBtn'); simBtn.disabled=true; simBtn.innerHTML='<span class="spinner"></span>Running…';
  try{
    showStatus($('assetFetchStatus'),'Preparing simulation...','loading');

    // Gather every ticker referenced across all portfolios (assets + risk-free).
    const tickers=new Set();
    portfolios.forEach(p=>{
      p.assets.forEach(a=>{ if(a.type==='ticker'&&a.ticker) tickers.add(a.ticker.toUpperCase()); });
      if(p.rf.mode==='ticker'&&p.rf.ticker) tickers.add(p.rf.ticker.toUpperCase());
    });
    // Fetch every uncovered ticker in ONE batched request (not one-by-one) to
    // keep Worker invocations to a minimum.
    const missing=[...tickers].filter(tk=>!isTickerRangeCovered(tk,startDate,endDate));
    if(missing.length){
      showStatus($('assetFetchStatus'),'Fetching '+missing.length+' ticker(s) in one request…','loading');
      try{
        const map=await window.SharedYF.fetchPricesBatch(missing,startDate,endDate);
        for(const tk of missing){
          const r=map[tk];
          if(r && !r.error && r.dates && r.dates.length){
            priceCache[tk]={dates:r.dates,prices:r.prices,coverageStart:startDate,coverageEnd:endDate,source:r.source,kind:r.kind};
          } else {
            showWarning('Could not load data for '+tk+(r&&r.error?': '+r.error:'')+'.');
          }
        }
      }catch(err){ showWarning('Could not load ticker data: '+err.message); }
    }

    // Build raw price series for every asset; collect date series for intersection.
    // Custom assets are seeded purely from their own characteristics so an identical
    // asset follows the same price path in every portfolio — a fair comparison.
    const seriesDates=[];
    portfolios.forEach(p=>{
      p.assets.forEach(a=>{
        if(a.type==='custom'){
          const seed=deriveSeed(currentRandomSeed, `${a.name}|${a.returnPct}|${a.stdPct}`);
          a.priceData=generateGBMPrices(startDate,endDate,a.returnPct,a.stdPct,100,createSeededRng(seed));
          a.loaded=true;
        } else {
          const slice=getCachedPriceSlice(a.ticker,startDate,endDate);
          a.priceData=slice||null; a.loaded=!!slice;
          if(!slice) showWarning('No data in selected range for '+a.ticker+'.');
        }
        if(a.priceData&&a.priceData.dates.length) seriesDates.push(a.priceData.dates);
      });
      if(p.rf.mode==='ticker'){
        const slice=getCachedPriceSlice(p.rf.ticker,startDate,endDate);
        p._rfData=slice||null;
        if(!slice){ showWarning('No data in selected range for risk-free ticker '+p.rf.ticker+'.'); }
        else seriesDates.push(slice.dates);
      } else p._rfData=null;
    });
    if(!seriesDates.length){ showWarning('No assets with data loaded.'); return; }

    // Intersection of trading days across every series in every portfolio.
    let common=seriesDates[0].slice();
    for(let k=1;k<seriesDates.length;k++){ const s=new Set(seriesDates[k]); common=common.filter(d=>s.has(d)); }
    common.sort();
    if(common.length<2){ showWarning('No overlapping trading days across all portfolios/assets.'); return; }
    commonDates=common;

    // Run each portfolio independently on the shared axis.
    const results=[];
    portfolios.forEach(p=>{
      const active=p.assets.filter(a=>a.priceData&&a.priceData.dates.length);
      if(!active.length) return;
      active.forEach(a=>{ const m=new Map(); a.priceData.dates.forEach((d,i)=>m.set(d,a.priceData.prices[i])); a.px=common.map(d=>m.get(d)); });
      let rfPx=null;
      if(p._rfData){ const m=new Map(); p._rfData.dates.forEach((d,i)=>m.set(d,p._rfData.prices[i])); rfPx=common.map(d=>m.get(d)); }
      const rows=simulatePortfolio(p, active, common, rfPx);
      results.push({ id:p.id, name:p.name, colorHex:p.colorHex, rows, assets:active.map(a=>({id:a.id,name:a.name,colorHex:a.colorHex,weight:a.weight})) });
      // reflect "loaded" badges for tickers in the active portfolio's asset list
      if(p.id===activePortfolioId){ active.forEach(a=>{ const el=$('aLoad'+a.id); if(el&&a.type==='ticker'){ el.className='status-bar status-ok'; el.textContent='✓ Loaded'; } }); }
    });
    if(!results.length){ showWarning('No portfolios produced results.'); return; }

    simResults=results;
    if(!simResults.some(r=>r.id===activeCompChartId)) activeCompChartId=simResults[0].id;
    if(!simResults.some(r=>r.id===activeCompTableId)) activeCompTableId=simResults[0].id;

    showStatus($('dateRangeStatus'),`Date range: ${common[0]} → ${common[common.length-1]} (${common.length} days)`,'ok');
    hideStatus($('assetFetchStatus'));
    renderViewSelectors();
    updateValueChart();
    updateCompChart();
    updateSummary();
    updateTable();
  } finally {
    simBtn.disabled=false; simBtn.textContent='▶ Simulate';
  }
}

/* ─── VIEW SELECTORS (composition chart + table) ─── */
function renderViewSelectors(){
  const opts=selId=>simResults.map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
  const cc=$('compChartPfSelect'); if(cc){ cc.innerHTML=opts(); cc.value=String(activeCompChartId); }
  const ct=$('compTablePfSelect'); if(ct){ ct.innerHTML=opts(); ct.value=String(activeCompTableId); }
}

/* ─── VALUE CHART (one line per portfolio + per-portfolio top-ups) ─── */
function updateValueChart(){
  if(!simResults.length) return;
  const dates=commonDates;
  const grid=cssVar('--chart-grid'), muted=cssVar('--chart-text'), text=cssVar('--text');
  const legendEl=$('valueLegend'); legendEl.innerHTML='';
  const datasets=[];
  valueDsPairs=[]; hiddenPf.clear();

  simResults.forEach((res,idx)=>{
    const color=res.colorHex;
    const valueIdx=datasets.length;
    datasets.push({label:res.name, data:res.rows.map(r=>r.total), borderColor:color, backgroundColor:color+'22', borderWidth:2.6, pointRadius:0, pointHoverRadius:5, tension:0.15, fill:false, _type:'value'});
    const topupIdx=datasets.length;
    datasets.push({label:res.name+' Top-Ups', data:res.rows.map(r=>r.cumTopup), borderColor:color, backgroundColor:'transparent', borderWidth:1.5, borderDash:[6,4], pointRadius:0, pointHoverRadius:4, tension:0, fill:false, _type:'topup'});
    valueDsPairs[idx]={value:valueIdx, topup:topupIdx};

    const item=document.createElement('div'); item.className='legend-item';
    item.innerHTML=`<span class="dot" style="background:${color}"></span><span>${res.name}</span>`;
    item.addEventListener('click',()=>{
      if(!valueChart) return;
      // Hiding a portfolio's value line also hides its top-ups line; showing it
      // restores the top-ups line only when the global "Show Top-Ups" toggle is on.
      const nowHidden=!hiddenPf.has(idx);
      if(nowHidden) hiddenPf.add(idx); else hiddenPf.delete(idx);
      valueChart.setDatasetVisibility(valueIdx, !nowHidden);
      valueChart.setDatasetVisibility(topupIdx, !nowHidden && showTopups);
      item.classList.toggle('hidden',nowHidden);
      valueChart.update();
    });
    legendEl.appendChild(item);
  });

  const yCb=v=>fmt.currency(v,true);
  const opts={
    responsive:true, maintainAspectRatio:false, animation:{duration:300}, interaction:{mode:'index',intersect:false},
    plugins:{ legend:{display:false}, tooltip:{
      filter:item=>valueChart?valueChart.isDatasetVisible(item.datasetIndex):true,
      callbacks:{ title:ctx=>ctx[0]?.label||'', label:ctx=>`  ${ctx.dataset.label}: ${fmt.currency(ctx.parsed.y,true)}`,
        afterBody(items){ if(items.length) $('valueHoverBox').textContent=`${items[0].label}  —  `+items.map(i=>`${i.dataset.label}: ${fmt.currency(i.parsed.y,true)}`).join('  |  '); }},
      backgroundColor:cssVar('--panel')||'#11172a', titleColor:text, bodyColor:muted, borderColor:grid, borderWidth:1, padding:10},
      zoom:{pan:{enabled:true,mode:'x'},zoom:{wheel:{enabled:true,speed:.08},pinch:{enabled:true},mode:'x'}}},
    scales:{
      x:{title:{display:true,text:'Date',color:muted,font:{size:11}},ticks:{color:muted,maxTicksLimit:12,font:{size:11},callback:v=>dates[Number(v)]?.slice(0,7)||''},grid:{color:grid}},
      y:{title:{display:true,text:'Value ('+currentCurrencySymbol+')',color:muted,font:{size:11}},ticks:{color:muted,font:{size:11},callback:yCb},grid:{color:grid}}}
  };
  if(valueChart) valueChart.destroy();
  valueChart=new Chart($('valueCanvas'),{type:'line',data:{labels:dates,datasets},options:opts});
  datasets.forEach((ds,i)=>{ if(ds._type==='topup') valueChart.setDatasetVisibility(i,showTopups); });
  valueChart.update();
}

/* ─── COMPOSITION CHART (stacked area for the selected portfolio) ─── */
function updateCompChart(){
  if(!simResults.length) return;
  const res=simResults.find(r=>r.id===activeCompChartId)||simResults[0];
  const dates=res.rows.map(r=>r.date);
  const grid=cssVar('--chart-grid'), muted=cssVar('--chart-text'), text=cssVar('--text');
  const legendEl=$('compLegend'); legendEl.innerHTML='';
  const hidden=new Set();
  const isPct=compViewMode==='percent';
  const asVal=(v,total)=> isPct ? (total>0 ? v/total*100 : 0) : v;

  const series=[{label:'Cash', color:CASH_COLOR, data:res.rows.map(r=>asVal(r.cash,r.total))}];
  res.assets.forEach(a=>series.push({label:a.name, color:a.colorHex, data:res.rows.map(r=>asVal(r.assetVals[a.id]||0, r.total))}));

  const datasets=series.map(s=>({
    label:s.label, data:s.data, borderColor:s.color, backgroundColor:s.color+'66',
    borderWidth:1.2, pointRadius:0, pointHoverRadius:4, tension:0.15, fill:true, stack:'comp'
  }));
  series.forEach((s,idx)=>{
    const item=document.createElement('div'); item.className='legend-item';
    item.innerHTML=`<span class="dot" style="background:${s.color}"></span><span>${s.label}</span>`;
    item.addEventListener('click',()=>{
      if(hidden.has(idx)) hidden.delete(idx); else hidden.add(idx);
      item.classList.toggle('hidden',hidden.has(idx));
      if(compChart){ compChart.setDatasetVisibility(idx,!hidden.has(idx)); compChart.update(); }
    });
    legendEl.appendChild(item);
  });

  const yCb = isPct ? (v=>fmt.num(v,0)+'%') : (v=>fmt.currency(v,true));
  const valFmt = isPct ? (v=>fmt.num(v,1)+'%') : (v=>fmt.currency(v,true));
  const totFmt = isPct ? (v=>fmt.num(v,0)+'%') : (v=>fmt.currency(v,true));
  const opts={
    responsive:true, maintainAspectRatio:false, animation:{duration:300}, interaction:{mode:'index',intersect:false},
    plugins:{ legend:{display:false}, tooltip:{
      filter:item=>compChart?compChart.isDatasetVisible(item.datasetIndex):true,
      callbacks:{ title:ctx=>ctx[0]?.label||'', label:ctx=>`  ${ctx.dataset.label}: ${valFmt(ctx.parsed.y)}`,
        afterBody(items){ if(items.length){ const tot=items.reduce((s,i)=>s+i.parsed.y,0); $('compHoverBox').textContent=`${items[0].label}  —  Total: ${totFmt(tot)}  |  `+items.map(i=>`${i.dataset.label}: ${valFmt(i.parsed.y)}`).join('  |  '); } }},
      backgroundColor:cssVar('--panel')||'#11172a', titleColor:text, bodyColor:muted, borderColor:grid, borderWidth:1, padding:10},
      zoom:{pan:{enabled:true,mode:'x'},zoom:{wheel:{enabled:true,speed:.08},pinch:{enabled:true},mode:'x'}}},
    scales:{
      x:{title:{display:true,text:'Date',color:muted,font:{size:11}},ticks:{color:muted,maxTicksLimit:12,font:{size:11},callback:v=>dates[Number(v)]?.slice(0,7)||''},grid:{color:grid}},
      y:{stacked:true,min:0,max:isPct?100:undefined,title:{display:true,text:isPct?'% of Portfolio':'Value ('+currentCurrencySymbol+')',color:muted,font:{size:11}},ticks:{color:muted,font:{size:11},callback:yCb},grid:{color:grid}}}
  };
  if(compChart) compChart.destroy();
  compChart=new Chart($('compCanvas'),{type:'line',data:{labels:dates,datasets},options:opts});
  compChart.update();
}

/* ─── SUMMARY TILES (one per portfolio, for comparison) ─── */
function updateSummary(){
  const sg=$('summaryGrid'); sg.innerHTML='';
  if(!simResults.length){ return; }
  // Identify the best final value to highlight the winner.
  let bestId=null, bestVal=-Infinity;
  simResults.forEach(res=>{ const v=res.rows[res.rows.length-1].total; if(v>bestVal){ bestVal=v; bestId=res.id; } });

  simResults.forEach(res=>{
    const last=res.rows[res.rows.length-1];
    const gain=last.total-last.cumTopup;
    const roi=last.cumTopup>0?gain/last.cumTopup:0;
    const cashPct=last.total>0?last.cash/last.total:0;
    const isBest=res.id===bestId && simResults.length>1;
    sg.innerHTML+=`<div class="tile" style="border-left:3px solid ${res.colorHex}">
      <div class="label">${res.name}${isBest?' <span style="color:#22c55e;font-weight:700">★</span>':''}</div>
      <div class="value">${fmt.currency(last.total,true)}</div>
      <div style="font-size:.75rem;color:var(--muted);margin-top:3px">Net ${fmt.currency(gain,true)} · ROI ${fmt.pct(roi)}</div>
      <div style="font-size:.72rem;color:var(--muted);margin-top:2px">Topped up ${fmt.currency(last.cumTopup,true)} · Cash ${fmt.pct(cashPct)}</div>
    </div>`;
  });
}

/* ─── COMPOSITION TABLE (month-end snapshots for the selected portfolio) ─── */
function monthEndRows(rows){
  const out=[]; const seen=new Map();
  rows.forEach((r,i)=>{ seen.set(r.date.slice(0,7), i); });
  seen.forEach(i=>out.push(rows[i]));
  out.sort((a,b)=>a.date<b.date?-1:1);
  return out;
}
function updateTable(){
  const head=$('compHead'), body=$('compBody');
  if(!simResults.length){ return; }
  const res=simResults.find(r=>r.id===activeCompTableId)||simResults[0];
  head.innerHTML=`<tr><th>Date</th><th class="cash-cell">Cash</th>${res.assets.map(a=>`<th>${a.name}</th>`).join('')}<th>Portfolio Value</th></tr>`;
  const rows=monthEndRows(res.rows);
  body.innerHTML=rows.map(r=>{
    return `<tr><td>${r.date}</td><td class="cash-cell">${fmt.currency(r.cash)}</td>${res.assets.map(a=>`<td>${fmt.currency(r.assetVals[a.id]||0)}</td>`).join('')}<td>${fmt.currency(r.total)}</td></tr>`;
  }).join('');
}

$('compChartPfSelect').addEventListener('change',e=>{ activeCompChartId=parseInt(e.target.value,10); updateCompChart(); });
$('compTablePfSelect').addEventListener('change',e=>{ activeCompTableId=parseInt(e.target.value,10); updateTable(); });

/* Composition chart view mode: dollar value vs % of portfolio */
document.querySelectorAll('#compViewToggle .seg-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    if(compViewMode===btn.dataset.cv) return;
    compViewMode=btn.dataset.cv;
    document.querySelectorAll('#compViewToggle .seg-btn').forEach(b=>b.classList.toggle('active', b===btn));
    if(simResults.length) updateCompChart();
  });
});

/* ─── CSV EXPORT (full daily, selected table portfolio) ─── */
$('downloadBtn').addEventListener('click',()=>{
  if(!simResults.length){ showWarning('Run a simulation first.'); return; }
  const res=simResults.find(r=>r.id===activeCompTableId)||simResults[0];
  const header=['Date','Cash',...res.assets.map(a=>a.name),'Invested','PortfolioValue','CumulativeTopups'];
  const lines=[header.join(',')];
  res.rows.forEach(r=>{
    const row=[r.date, r.cash.toFixed(2), ...res.assets.map(a=>(r.assetVals[a.id]||0).toFixed(2)), r.invested.toFixed(2), r.total.toFixed(2), r.cumTopup.toFixed(2)];
    lines.push(row.join(','));
  });
  const blob=new Blob([lines.join('\n')],{type:'text/csv'});
  const safe=res.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase();
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='portfolio-dca-'+safe+'.csv';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
});

/* ─── CHART PNG EXPORT ─── */
function exportChartPng(canvasId, filename, chartTitle, legendId, download=true){
  const src=$(canvasId); if(!src) return null;
  const dpr=window.devicePixelRatio||1, OUT=3;
  const chartW=Math.round(src.width/dpr*OUT), chartH=Math.round(src.height/dpr*OUT);
  const isLight=document.body.classList.contains('light');
  const bg=isLight?'#ffffff':'#0F1728', fg=isLight?'#2D3436':'#EAF1FF', FONT='"DM Sans", sans-serif';
  const items=[];
  if(legendId){ const le=$(legendId); if(le) le.querySelectorAll('.legend-item:not(.hidden)').forEach(it=>{ const dot=it.querySelector('.dot'); const label=it.textContent.trim(); const color=dot?getComputedStyle(dot).backgroundColor:'#888'; if(label) items.push({label,color}); }); }
  const titleH=chartTitle?Math.round(40*OUT):0, legendH=items.length?Math.round(34*OUT):0;
  const tmp=document.createElement('canvas'); tmp.width=chartW; tmp.height=chartH+titleH+legendH;
  const ctx=tmp.getContext('2d');
  ctx.fillStyle=bg; ctx.fillRect(0,0,tmp.width,tmp.height);
  if(chartTitle){ ctx.font=`700 ${Math.round(14*OUT)}px ${FONT}`; ctx.fillStyle=fg; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(chartTitle,tmp.width/2,titleH/2); }
  ctx.drawImage(src,0,titleH,chartW,chartH);
  if(items.length){
    const ly=titleH+chartH, dotR=Math.round(5*OUT), gap=Math.round(7*OUT), pad=Math.round(20*OUT);
    ctx.font=`500 ${Math.round(11*OUT)}px ${FONT}`; ctx.textBaseline='middle';
    let totalW=0; items.forEach((it,i)=>{ totalW+=dotR*2+gap+ctx.measureText(it.label).width+(i<items.length-1?pad:0); });
    let x=Math.max(Math.round(16*OUT),(tmp.width-totalW)/2); const cy=ly+legendH/2;
    items.forEach(it=>{ ctx.fillStyle=it.color; ctx.beginPath(); ctx.arc(x+dotR,cy,dotR,0,Math.PI*2); ctx.fill(); x+=dotR*2+gap; ctx.fillStyle=fg; ctx.textAlign='left'; ctx.fillText(it.label,x,cy); x+=ctx.measureText(it.label).width+pad; });
  }
  ctx.save(); ctx.globalAlpha=0.22; ctx.font=`500 ${Math.round(11*OUT)}px ${FONT}`; ctx.fillStyle='#1a1a1a'; ctx.textAlign='right'; ctx.textBaseline='bottom';
  const wmText='Made using tool.adjiebrotots.com/dcasimulator/portfolio';
  const wmX=tmp.width-Math.round(12*OUT), wmY=tmp.height-Math.round(12*OUT), wmTextW=ctx.measureText(wmText).width, wmLogoSize=Math.round(13*OUT);
  if(wmLogoImg.complete&&wmLogoImg.naturalWidth) ctx.drawImage(wmLogoImg, wmX-wmTextW-Math.round(4*OUT)-wmLogoSize, wmY-wmLogoSize+Math.round(2*OUT), wmLogoSize, wmLogoSize);
  ctx.fillText(wmText,wmX,wmY); ctx.restore();
  if(download){ const a=document.createElement('a'); a.href=tmp.toDataURL('image/png'); a.download=filename; document.body.appendChild(a); a.click(); a.remove(); }
  return tmp;
}
async function copyCanvasPng(canvas){
  if(!navigator.clipboard||!window.ClipboardItem) throw new Error('Clipboard image copy is not supported in this browser.');
  const blob=await new Promise(res=>canvas.toBlob(res,'image/png'));
  if(!blob) throw new Error('Could not create PNG.');
  await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
}
function compTitle(){ const res=simResults.find(r=>r.id===activeCompChartId); return 'Composition Over Time'+(res?' — '+res.name:''); }
$('valuePngBtn').addEventListener('click',()=>exportChartPng('valueCanvas','portfolio-value.png','Portfolio Value Over Time','valueLegend'));
$('compPngBtn').addEventListener('click',()=>exportChartPng('compCanvas','portfolio-composition.png',compTitle(),'compLegend'));
$('valueCopyBtn').addEventListener('click',async()=>{ const c=exportChartPng('valueCanvas','','Portfolio Value Over Time','valueLegend',false); if(c){ try{ await copyCanvasPng(c); showStatus($('assetFetchStatus'),'Copied value chart to clipboard.','ok'); }catch(e){ showStatus($('assetFetchStatus'),e.message,'error'); } } });
$('compCopyBtn').addEventListener('click',async()=>{ const c=exportChartPng('compCanvas','',compTitle(),'compLegend',false); if(c){ try{ await copyCanvasPng(c); showStatus($('assetFetchStatus'),'Copied composition chart to clipboard.','ok'); }catch(e){ showStatus($('assetFetchStatus'),e.message,'error'); } } });

$('valueResetZoom').addEventListener('click',()=>{ if(valueChart) valueChart.resetZoom(); });
$('compResetZoom').addEventListener('click',()=>{ if(compChart) compChart.resetZoom(); });
$('valueCanvas').addEventListener('mouseleave',()=>{ $('valueHoverBox').textContent='Hover to inspect data points.'; });
$('compCanvas').addEventListener('mouseleave',()=>{ $('compHoverBox').textContent='Hover to inspect data points.'; });

$('showTopupsToggle').addEventListener('change',e=>{
  showTopups=e.target.checked;
  if(valueChart){
    // Only reveal a top-ups line when its portfolio's value line is also visible.
    valueDsPairs.forEach((pair,idx)=>{ if(pair) valueChart.setDatasetVisibility(pair.topup, showTopups && !hiddenPf.has(idx)); });
    valueChart.update();
  }
});

/* ─── CURRENCY / SEED ─── */
$('currencySymbol').addEventListener('change',e=>{
  currentCurrencySymbol=e.target.value;
  if(simResults.length){ updateValueChart(); updateCompChart(); updateSummary(); updateTable(); }
});
$('randomSeed').addEventListener('input',e=>{ currentRandomSeed=sanitizeSeed(e.target.value); });

/* ─── THEME ─── */
$('themeToggle').addEventListener('click',()=>{
  document.body.classList.toggle('light');
  $('themeToggle').textContent=document.body.classList.contains('light')?'🌙 Dark':'☀️ Light';
  if(simResults.length){ updateValueChart(); updateCompChart(); }
  renderAssetList(); renderPortfolioList();
});

/* ─── TABS ─── */
function switchTab(name){
  document.querySelectorAll('.ctrl-tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===name));
  document.querySelectorAll('.ctrl-panel').forEach(p=>p.classList.remove('active'));
  const panel=$('tab-'+name); if(panel) panel.classList.add('active');
}
document.querySelectorAll('.ctrl-tab').forEach(btn=>{
  btn.addEventListener('click',()=>switchTab(btn.dataset.tab));
});

/* Sub-tabs (Assets / Top-Ups / Rebalancing) live inside the Portfolios tab */
function switchSubTab(name){
  document.querySelectorAll('.sub-tab').forEach(b=>b.classList.toggle('active', b.dataset.sub===name));
  document.querySelectorAll('.sub-panel').forEach(p=>p.classList.toggle('active', p.id==='sub-'+name));
}
document.querySelectorAll('.sub-tab').forEach(btn=>{
  btn.addEventListener('click',()=>switchSubTab(btn.dataset.sub));
});

/* ─── SIMULATE / RESET ─── */
$('simBtn').addEventListener('click', runSimulation);
$('resetBtn').addEventListener('click',()=>{
  portfolios=[]; portfolioIdCounter=0; activePortfolioId=null;
  simResults=[]; commonDates=[]; activeCompChartId=null; activeCompTableId=null;
  priceCache={}; tickerFetchInFlight={};
  currentCurrencySymbol='$'; currentRandomSeed=DEFAULT_RANDOM_SEED; showTopups=true;
  compViewMode='dollar'; valueDsPairs=[]; hiddenPf.clear();
  document.querySelectorAll('#compViewToggle .seg-btn').forEach(b=>b.classList.toggle('active', b.dataset.cv==='dollar'));
  if(valueChart){ valueChart.destroy(); valueChart=null; }
  if(compChart){ compChart.destroy(); compChart=null; }
  $('currencySymbol').value='$'; $('randomSeed').value=DEFAULT_RANDOM_SEED;
  $('showTopupsToggle').checked=true;
  $('summaryGrid').innerHTML='';
  $('compHead').innerHTML='<tr><th>Date</th><th>Cash</th><th>Portfolio Value</th></tr>';
  $('compBody').innerHTML='<tr><td colspan="3" style="color:var(--muted);text-align:center;padding:20px">Add portfolios and run to see composition.</td></tr>';
  $('valueLegend').innerHTML=''; $('compLegend').innerHTML='';
  $('compChartPfSelect').innerHTML=''; $('compTablePfSelect').innerHTML='';
  $('valueHoverBox').textContent='Configure portfolios and run to compare value over time.';
  $('compHoverBox').textContent='Cash and each asset stack up to total portfolio value.';
  hideStatus($('assetFetchStatus')); hideStatus($('dateRangeStatus')); hideWarning();
  document.querySelectorAll('.quick-start-btn').forEach(b=>b.classList.remove('active'));
  initDefaults();
  loadControlsFromActive(); renderPortfolioList(); renderPfSelectors();
  switchTab('portfolios');
  runSimulation();
});

/* ─── QUICK START PRESETS ─── */
// One-click worked comparisons built from live-ticker assets. Each rebuilds the
// portfolio list, then runs the simulation so real Yahoo Finance prices are
// fetched (no simulated/custom data).
function qsAddPortfolio(name, colorIdx, assets, opts){
  const p = addPortfolio(name, PORTFOLIO_COLOR_HEX[colorIdx % PORTFOLIO_COLOR_HEX.length]);
  activePortfolioId = p.id;
  assets.forEach(a=> addAsset({type:'ticker', ticker:a.ticker, name:a.name||a.ticker, weight:a.weight}));
  opts = opts || {};
  if(opts.topup!=null)     p.topup.amount       = opts.topup;
  if(opts.topupPeriod)     p.topupSched.period   = opts.topupPeriod;
  if(opts.method)          p.rebal.method        = opts.method;
  if(opts.cwTiming)        p.rebal.cwTiming      = opts.cwTiming;
  if(opts.rebalPeriod)     p.rebalSched.period   = opts.rebalPeriod;
  return p;
}

const PORTFOLIO_QUICK_START = {
  // 80/20 vs 60/40 — growth vs conservative allocation, equity (DHHF.AX) vs cash (AAA.AX).
  'alloc'(){
    qsAddPortfolio('60/40 (DHHF/AAA)', 0,
      [{ticker:'DHHF.AX', name:'DHHF.AX — Equity', weight:60},{ticker:'AAA.AX', name:'AAA.AX — Cash', weight:40}],
      {topup:1000, topupPeriod:'monthly', method:'towards-weight'});
    qsAddPortfolio('80/20 (DHHF/AAA)', 1,
      [{ticker:'DHHF.AX', name:'DHHF.AX — Equity', weight:80},{ticker:'AAA.AX', name:'AAA.AX — Cash', weight:20}],
      {topup:1000, topupPeriod:'monthly', method:'towards-weight'});
  },
  // Rebalancing Monthly vs Quarterly — same 50:50 SPY/GOVT, different rebalance cadence.
  'rebal-freq'(){
    qsAddPortfolio('Rebalance Monthly', 0,
      [{ticker:'SPY', name:'SPY — Equity', weight:50},{ticker:'GOVT', name:'GOVT — Bonds', weight:50}],
      {topup:1000, topupPeriod:'monthly', method:'constant-weight', cwTiming:'schedule', rebalPeriod:'monthly'});
    qsAddPortfolio('Rebalance Quarterly', 1,
      [{ticker:'SPY', name:'SPY — Equity', weight:50},{ticker:'GOVT', name:'GOVT — Bonds', weight:50}],
      {topup:1000, topupPeriod:'monthly', method:'constant-weight', cwTiming:'schedule', rebalPeriod:'quarterly'});
  },
  // Rebalancing vs Constant Allocation — maintain SPY/GOVT 50:50 (constant weight)
  // vs always splitting each top-up 50:50 (constant allocation).
  'rebal-vs-alloc'(){
    qsAddPortfolio('Constant Weight (rebalanced)', 0,
      [{ticker:'SPY', name:'SPY — Equity', weight:50},{ticker:'GOVT', name:'GOVT — Bonds', weight:50}],
      {topup:1000, topupPeriod:'monthly', method:'constant-weight', cwTiming:'at-topup'});
    qsAddPortfolio('Constant Allocation (split 50:50)', 1,
      [{ticker:'SPY', name:'SPY — Equity', weight:50},{ticker:'GOVT', name:'GOVT — Bonds', weight:50}],
      {topup:1000, topupPeriod:'monthly', method:'constant-allocation'});
  },
};

async function applyPortfolioQuickStart(key){
  const build = PORTFOLIO_QUICK_START[key];
  if(!build) return;
  portfolios=[]; portfolioIdCounter=0; activePortfolioId=null;
  simResults=[]; commonDates=[];
  hideWarning();
  build();
  activePortfolioId = portfolios.length ? portfolios[0].id : null;
  loadControlsFromActive(); renderPortfolioList(); renderPfSelectors();
  switchTab('portfolios');
  document.querySelectorAll('.quick-start-btn').forEach(b=>b.classList.toggle('active', b.dataset.preset===key));
  await runSimulation();
}

document.querySelectorAll('.quick-start-btn').forEach(btn=>{
  btn.addEventListener('click', async()=>{
    if(btn.disabled) return;
    const all=[...document.querySelectorAll('.quick-start-btn')];
    all.forEach(b=>b.disabled=true);
    try { await applyPortfolioQuickStart(btn.dataset.preset); }
    finally { all.forEach(b=>b.disabled=false); }
  });
});

/* ─── INIT ─── */
function setDefaultDates(){
  const end=new Date();
  const start=new Date(); start.setFullYear(start.getFullYear()-5);
  $('startDate').value=isoDate(start); $('endDate').value=isoDate(end);
}
function initDefaults(){
  // Two contrasting strategies to demonstrate the comparison.
  const a=addPortfolio('60/40 Balanced', PORTFOLIO_COLOR_HEX[0]);
  activePortfolioId=a.id;
  addAsset({type:'custom', name:'Equities', returnPct:10, stdPct:18, weight:60});
  addAsset({type:'custom', name:'Bonds', returnPct:4, stdPct:6, weight:40});

  const b=addPortfolio('80/20 Growth', PORTFOLIO_COLOR_HEX[1]);
  activePortfolioId=b.id;
  addAsset({type:'custom', name:'Equities', returnPct:10, stdPct:18, weight:80});
  addAsset({type:'custom', name:'Bonds', returnPct:4, stdPct:6, weight:20});
  b.rebal.method='constant-weight'; b.rebal.cwTiming='at-topup';

  activePortfolioId=a.id;
}

setDefaultDates();
initDefaults();
loadControlsFromActive();
renderPortfolioList();
renderPfSelectors();
runSimulation();

})();
