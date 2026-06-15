(function(){
'use strict';

/* ─── WATERMARK LOGO (logos/logo.svg, for chart exports) ─── */
const WM_LOGO_SRC = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDY4MCA2ODAiIHJvbGU9ImltZyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8dGl0bGU+QXJjaGVkIEEgTG9nbzwvdGl0bGU+CiAgPGRlc2M+QSBzbGVlayB3aGl0ZSBsZXR0ZXIgQSB3aG9zZSBsZWdzIGZvbGxvdyB0aGUgY2lyY2xlIGN1cnZhdHVyZSwgc3Bhbm5pbmcgODAlIG9mIHRoZSBjaXJjbGUgaGVpZ2h0PC9kZXNjPgoKICA8Y2lyY2xlIGN4PSIzNDAiIGN5PSIzNDAiIHI9IjMwMCIgZmlsbD0iIzAwNTJjYyIvPgoKICA8IS0tIExlZnQgbGVnOiAxMTPCsCB0byAyNDXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyNDIsNTcwIEEgMjUwLDI1MCAwIDAgMSAyMzQsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFRvcCBhcmNoOiAyNDXCsCB0byAyOTXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyMzQsMTEzIEEgMjUwLDI1MCAwIDAgMSA0NDYsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFJpZ2h0IGxlZzogMjk1wrAgdG8gNjfCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSA0NDYsMTEzIEEgMjUwLDI1MCAwIDAgMSA0MzgsNTcwIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIENyb3NzYmFyIC0tPgogIDxsaW5lIHgxPSIxMTMiIHkxPSIzNTQiIHgyPSI1NjciIHkyPSIzNTQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNDIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K';
const wmLogoImg = new Image();
wmLogoImg.src = WM_LOGO_SRC;

/* ─── CONSTANTS ─── */
const LINE_COLOR_HEX = ['#3b82f6','#ef4444','#22c55e','#f59e0b','#a855f7','#06b6d4','#ec4899','#14b8a6'];
const CASH_COLOR = '#94a3b8';
const WEEKDAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']; // 1..7
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; // 1..12
const DEFAULT_RANDOM_SEED = 25823952204;

/* ─── STATE ─── */
let assets = [];                 // {id,type,ticker,name,colorHex,weight,returnPct,stdPct,loaded,open,priceData,px}
let assetIdCounter = 0;
let simRows = [];                // daily rows from the last run
let simAssets = [];              // snapshot of assets used in last run (id,name,colorHex)
let valueChart = null, compChart = null;
let currentCurrencySymbol = '$';
let currentRandomSeed = DEFAULT_RANDOM_SEED;
let showTopups = true;

const topupSched = { period:'monthly', weekdays:[1], daysOfMonth:[1], dayOfMonth:1, month:1 };
const rebalSched = { period:'quarterly', weekdays:[1], daysOfMonth:[1], dayOfMonth:1, month:1 };

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

/* ─── YAHOO FINANCE FETCH (proxy fallbacks, copied workflow from ../) ─── */
async function fetchWithTimeout(url, timeoutMs=12000, externalSignal=null){
  const controller=new AbortController();
  const timeoutId=setTimeout(()=>controller.abort(), timeoutMs);
  const onAbort=()=>controller.abort();
  if(externalSignal){ if(externalSignal.aborted) controller.abort(); else externalSignal.addEventListener('abort',onAbort,{once:true}); }
  try{ return await fetch(url,{signal:controller.signal,cache:'no-store'}); }
  catch(err){ if(err?.name==='AbortError') throw new Error('signal timed out'); throw err; }
  finally{ clearTimeout(timeoutId); if(externalSignal) externalSignal.removeEventListener('abort',onAbort); }
}
async function fetchYahooFinance(ticker, startDate, endDate){
  const start=Math.floor(new Date(startDate).getTime()/1000);
  const end=Math.floor(new Date(endDate).getTime()/1000+86400);
  const cb=isoDate(new Date());
  const yfParams=`period1=${start}&period2=${end}&interval=1d&events=history&_cb=${cb}`;
  const yf1=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?${yfParams}`;
  const yf2=`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?${yfParams}`;
  const candidates=[
    {url:`https://api.allorigins.win/raw?url=${encodeURIComponent(yf1)}`, parse:r=>r.json()},
    {url:`https://corsproxy.io/?url=${encodeURIComponent(yf1)}`, parse:r=>r.json()},
    {url:`https://api.allorigins.win/raw?url=${encodeURIComponent(yf2)}`, parse:r=>r.json()},
    {url:`https://corsproxy.io/?url=${encodeURIComponent(yf2)}`, parse:r=>r.json()},
    {url:`https://api.allorigins.win/get?url=${encodeURIComponent(yf1)}`, parse:async r=>{ const w=await r.json(); return JSON.parse(w.contents); }},
    {url:`https://r.jina.ai/http://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?${yfParams}`, parse:async r=>{ const t=await r.text(); const s=t.indexOf('{'); return JSON.parse(s>=0?t.slice(s):t); }}
  ];
  let lastError=null;
  const abortAll=new AbortController();
  const attempts=candidates.map(c=>(async()=>{
    try{
      const resp=await fetchWithTimeout(c.url,12000,abortAll.signal);
      if(!resp.ok) throw new Error('HTTP '+resp.status);
      const parsed=await c.parse(resp);
      if(!parsed?.chart?.result?.[0]) throw new Error('No chart result');
      return parsed;
    }catch(err){ lastError=err; throw err; }
  })());
  let data=null;
  try{ data=await Promise.any(attempts); }
  catch{ throw new Error('Unable to fetch market data via proxy ('+(lastError?.message||'unknown')+')'); }
  finally{ abortAll.abort(); }
  const result=data?.chart?.result?.[0];
  if(!result) throw new Error('No data returned for '+ticker);
  const ts=result.timestamp;
  const closes=result.indicators?.adjclose?.[0]?.adjclose || result.indicators?.quote?.[0]?.close;
  if(!ts||!closes) throw new Error('Invalid data structure');
  const dates=[], prices=[];
  for(let i=0;i<ts.length;i++){ if(closes[i]==null) continue; dates.push(isoDate(new Date(ts[i]*1000))); prices.push(closes[i]); }
  if(!dates.length) throw new Error('No price data in range');
  return {dates, prices};
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
    priceCache[tk]={dates:data.dates,prices:data.prices,coverageStart:fStart,coverageEnd:fEnd};
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

/* ─── ASSET MANAGEMENT ─── */
function addAsset(cfg){
  const id=++assetIdCounter;
  const colorIdx=assets.length % LINE_COLOR_HEX.length;
  assets.forEach(a=>a.open=false);
  const asset={
    id, type:cfg.type||'custom', ticker:cfg.ticker||'', name:cfg.name||cfg.ticker||'Asset',
    colorHex:cfg.colorHex||LINE_COLOR_HEX[colorIdx],
    weight:cfg.weight!=null?cfg.weight:0,
    returnPct:cfg.returnPct!=null?cfg.returnPct:8, stdPct:cfg.stdPct!=null?cfg.stdPct:15,
    loaded:false, open:true, priceData:null, px:null
  };
  assets.push(asset);
  renderAssetList();
  return asset;
}
function removeAsset(id){ assets=assets.filter(a=>a.id!==id); renderAssetList(); }

function renderAssetList(){
  const el=$('assetList');
  if(!assets.length){
    el.innerHTML='<div style="color:var(--muted);font-size:.82rem;padding:8px 0">No assets added yet.</div>';
    updateWeightSummary();
    return;
  }
  el.innerHTML='';
  assets.forEach(a=>{
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
          <label>Target weight (%) <span class="tip-icon" data-tip="Target portfolio weight (or top-up allocation for Constant Allocation). All weights must sum to 100%.">?</span></label>
          <input class="num-input" id="aWeight${a.id}" type="number" min="0" max="100" step="1" value="${a.weight}"/>
        </div>
        <button class="sec-del" id="aDel${a.id}" style="margin-top:8px">🗑 Remove</button>
      </div>`;
    el.appendChild(card);

    card.querySelector('.sec-header').addEventListener('click',()=>{
      const willOpen=!a.open;
      if(willOpen) assets.forEach(o=>{ if(o.id!==a.id) o.open=false; });
      a.open=willOpen; renderAssetList();
    });
    $(`aDel${a.id}`).addEventListener('click',e=>{ e.stopPropagation(); removeAsset(a.id); });
    $(`aWeight${a.id}`).addEventListener('input',e=>{ a.weight=parseFloat(e.target.value)||0; updateWeightSummary(); const pill=card.querySelector('.asset-weight-pill'); if(pill) pill.textContent=fmt.num(a.weight,1)+'%'; });
    if(a.type==='custom'){
      $(`aRet${a.id}`).addEventListener('input',e=>{ a.returnPct=parseFloat(e.target.value)||0; });
      $(`aStd${a.id}`).addEventListener('input',e=>{ a.stdPct=parseFloat(e.target.value)||0; });
    }
  });
  const cp=$('newAssetColor'); if(cp) cp.value=LINE_COLOR_HEX[assets.length % LINE_COLOR_HEX.length];
  updateWeightSummary();
}
function totalWeight(){ return assets.reduce((s,a)=>s+(a.weight||0),0); }
function updateWeightSummary(){
  const el=$('weightSummary'); if(!el) return;
  if(!assets.length){ el.style.display='none'; return; }
  el.style.display='flex';
  const t=totalWeight();
  const ok=Math.abs(t-100)<0.5;
  el.className='weight-summary '+(ok?'ok':'bad');
  el.innerHTML=`<span>Total weight</span><span>${fmt.num(t,1)}% ${ok?'✓':'· must equal 100%'}</span>`;
}

/* ─── ADD ASSET BUTTON ─── */
$('addAssetBtn').addEventListener('click', async()=>{
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
    try{ await ensureTickerCached(ticker,sd,ed); asset.loaded=true; const e=priceCache[ticker.toUpperCase()]; showStatus($('assetFetchStatus'),ticker+' cached: '+e.dates.length+' trading days','ok'); }
    catch(err){ asset.loaded=false; showStatus($('assetFetchStatus'),'Failed to load '+ticker+': '+err.message,'error'); }
    renderAssetList();
  } else {
    if(!name){ showStatus($('assetFetchStatus'),'Please enter an asset name.','error'); return; }
    addAsset({type:'custom', name, colorHex});
    $('newAssetName').value=''; hideStatus($('assetFetchStatus'));
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
  const box=$(boxId), hint=$(hintId);
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
$('topupPeriod').addEventListener('change',e=>{ topupSched.period=e.target.value; renderScheduleBox('topupScheduleBox','topupScheduleHint',topupSched); });
$('rebalPeriod').addEventListener('change',e=>{ rebalSched.period=e.target.value; renderScheduleBox('rebalScheduleBox','rebalScheduleHint',rebalSched); });

/* ─── RISK-FREE MODE ─── */
document.querySelectorAll('input[name="rfMode"]').forEach(r=>{
  r.addEventListener('change',()=>{
    const ticker=r.value==='ticker';
    $('rfRateRow').style.display=ticker?'none':'';
    $('rfTickerRow').style.display=ticker?'':'none';
    document.querySelectorAll('#rfOptRate,#rfOptTicker').forEach(o=>o.classList.remove('selected'));
    r.closest('.radio-opt').classList.add('selected');
  });
});

/* ─── REBALANCE METHOD ─── */
document.querySelectorAll('input[name="rebalMethod"]').forEach(r=>{
  r.addEventListener('change',()=>{
    document.querySelectorAll('[data-method]').forEach(o=>o.classList.remove('selected'));
    r.closest('[data-method]').classList.add('selected');
    $('constantWeightOpts').style.display=r.value==='constant-weight'?'':'none';
  });
});
document.querySelectorAll('input[name="cwTiming"]').forEach(r=>{
  r.addEventListener('change',()=>{
    document.querySelectorAll('[data-cwtiming]').forEach(o=>o.classList.remove('selected'));
    r.closest('[data-cwtiming]').classList.add('selected');
    $('rebalScheduleWrap').style.display=r.value==='schedule'?'':'none';
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

/* ─── BUY / REBALANCE HELPERS (mutate state) ─── */
function investedValue(state, i){ return assets.reduce((s,a)=>s+state.units[a.id]*a.px[i],0); }
function buyByWeights(state, i, buyFee){
  const cash=state.cash; if(cash<=0) return;
  assets.forEach(a=>{
    const dollars=cash*(a.weight/100);
    if(dollars<=0) return;
    state.units[a.id]+=dollars*(1-buyFee)/a.px[i];
    state.cash-=dollars;
  });
  if(state.cash<1e-9) state.cash=0;
}
function buyUnderweight(state, i, buyFee){
  const C=state.cash; if(C<=0) return;
  const total=investedValue(state,i)+C;
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
function fullRebalance(state, i, buyFee, sellFee){
  const T=state.cash+investedValue(state,i);
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

/* ─── RUN SIMULATION ─── */
async function runSimulation(){
  hideWarning();
  if(!assets.length){ showWarning('Add at least one asset to run a simulation.'); return; }
  const startDate=$('startDate').value, endDate=$('endDate').value;
  if(!startDate||!endDate){ showWarning('Please set start and end dates.'); return; }
  if(startDate>=endDate){ showWarning('Start date must be before end date.'); return; }
  if(Math.abs(totalWeight()-100)>0.5){ showWarning('Asset weights must sum to 100% (currently '+fmt.num(totalWeight(),1)+'%).'); return; }

  const rfMode=document.querySelector('input[name="rfMode"]:checked')?.value||'rate';
  const rfRate=parseFloat($('rfRate').value)||0;
  const rfTicker=$('rfTicker').value.trim().toUpperCase();
  if(rfMode==='ticker' && !rfTicker){ showWarning('Enter a risk-free ticker or switch to a fixed rate.'); return; }

  const method=document.querySelector('input[name="rebalMethod"]:checked')?.value||'towards-weight';
  const cwTiming=document.querySelector('input[name="cwTiming"]:checked')?.value||'at-topup';
  const buyFee=(parseFloat($('buyFee').value)||0)/100;
  const sellFee=(parseFloat($('sellFee').value)||0)/100;
  const amount=parseFloat($('topupAmount').value)||0;
  if(amount<=0){ showWarning('Amount per top-up must be greater than zero.'); return; }

  const simBtn=$('simBtn'); simBtn.disabled=true; simBtn.innerHTML='<span class="spinner"></span>Running…';
  try{
    showStatus($('assetFetchStatus'),'Preparing simulation...','loading');

    // Fetch ticker data (assets + risk-free ticker)
    const tickers=new Set(assets.filter(a=>a.type==='ticker').map(a=>a.ticker.toUpperCase()).filter(Boolean));
    if(rfMode==='ticker') tickers.add(rfTicker);
    for(const tk of tickers){
      if(!isTickerRangeCovered(tk,startDate,endDate)) showStatus($('assetFetchStatus'),'Fetching '+tk+'...','loading');
      try{ await ensureTickerCached(tk,startDate,endDate); }
      catch(err){ showWarning('Could not load data for '+tk+': '+err.message); }
    }

    // Build raw price series for each asset
    for(const a of assets){
      if(a.type==='custom'){
        const seed=deriveSeed(currentRandomSeed, `${a.name}|${a.returnPct}|${a.stdPct}`);
        a.priceData=generateGBMPrices(startDate,endDate,a.returnPct,a.stdPct,100,createSeededRng(seed));
        a.loaded=true;
      } else {
        const slice=getCachedPriceSlice(a.ticker,startDate,endDate);
        if(!slice){ showWarning('No data in selected range for '+a.ticker+'.'); a.priceData=null; continue; }
        a.priceData=slice; a.loaded=true;
        const el=$('aLoad'+a.id); if(el){ el.className='status-bar status-ok'; el.textContent='✓ Loaded'; }
      }
    }
    let rfData=null;
    if(rfMode==='ticker'){
      rfData=getCachedPriceSlice(rfTicker,startDate,endDate);
      if(!rfData){ showWarning('No data in selected range for risk-free ticker '+rfTicker+'.'); return; }
    }

    const loaded=assets.filter(a=>a.priceData&&a.priceData.dates.length);
    if(!loaded.length){ showWarning('No assets with data loaded.'); return; }

    // Intersection of trading days across every series
    const seriesDates=loaded.map(a=>a.priceData.dates);
    if(rfData) seriesDates.push(rfData.dates);
    let common=seriesDates[0].slice();
    for(let k=1;k<seriesDates.length;k++){ const s=new Set(seriesDates[k]); common=common.filter(d=>s.has(d)); }
    common.sort();
    if(common.length<2){ showWarning('No overlapping trading days across all assets/tickers.'); return; }

    // Align price arrays to the common date axis
    loaded.forEach(a=>{ const m=new Map(); a.priceData.dates.forEach((d,i)=>m.set(d,a.priceData.prices[i])); a.px=common.map(d=>m.get(d)); });
    let rfPx=null;
    if(rfData){ const m=new Map(); rfData.dates.forEach((d,i)=>m.set(d,rfData.prices[i])); rfPx=common.map(d=>m.get(d)); }

    // Use only the loaded assets for this run
    const activeAssets=loaded;
    // (helpers read the global `assets`; point it at the active set for the run)
    const allAssetsBackup=assets; assets=activeAssets;

    const topupSet=getScheduleIndices(common, topupSched);
    let rebalSet=new Set();
    if(method==='constant-weight' && cwTiming==='schedule') rebalSet=getScheduleIndices(common, rebalSched);

    const rfDayFactor=Math.pow(1+rfRate/100, 1/252);
    const state={cash:0, units:{}};
    activeAssets.forEach(a=>state.units[a.id]=0);

    const rows=[];
    let cumTopup=0;
    for(let i=0;i<common.length;i++){
      if(i>0){ state.cash *= (rfMode==='ticker' ? (rfPx[i]/rfPx[i-1]) : rfDayFactor); }
      if(topupSet.has(i)){
        state.cash+=amount; cumTopup+=amount;
        if(method==='constant-allocation') buyByWeights(state,i,buyFee);
        else if(method==='towards-weight') buyUnderweight(state,i,buyFee);
        else if(method==='constant-weight'){
          if(cwTiming==='at-topup'){ buyUnderweight(state,i,buyFee); fullRebalance(state,i,buyFee,sellFee); }
          else buyUnderweight(state,i,buyFee);
        }
      }
      if(rebalSet.has(i)) fullRebalance(state,i,buyFee,sellFee);
      const assetVals={}; let invested=0;
      activeAssets.forEach(a=>{ const v=state.units[a.id]*a.px[i]; assetVals[a.id]=v; invested+=v; });
      rows.push({date:common[i], cash:state.cash, assetVals, invested, total:state.cash+invested, cumTopup});
    }

    assets=allAssetsBackup;

    simRows=rows;
    simAssets=activeAssets.map(a=>({id:a.id,name:a.name,colorHex:a.colorHex,weight:a.weight}));

    showStatus($('dateRangeStatus'),`Date range: ${common[0]} → ${common[common.length-1]} (${common.length} days)`,'ok');
    hideStatus($('assetFetchStatus'));
    updateValueChart();
    updateCompChart();
    updateSummary();
    updateTable();
  } finally {
    simBtn.disabled=false; simBtn.textContent='▶ Simulate';
  }
}

/* ─── VALUE CHART (line: portfolio value + cumulative top-ups) ─── */
function updateValueChart(){
  if(!simRows.length) return;
  const dates=simRows.map(r=>r.date);
  const grid=cssVar('--chart-grid'), muted=cssVar('--chart-text'), text=cssVar('--text');
  const accent=cssVar('--accent')||'#3b82f6';
  const legendEl=$('valueLegend'); legendEl.innerHTML='';
  const hidden=new Set();

  const datasets=[
    {label:'Portfolio Value', data:simRows.map(r=>r.total), borderColor:accent, backgroundColor:accent+'22', borderWidth:2.6, pointRadius:0, pointHoverRadius:5, tension:0.15, fill:false, _type:'value'},
    {label:'Total Top-Ups', data:simRows.map(r=>r.cumTopup), borderColor:CASH_COLOR, backgroundColor:'transparent', borderWidth:2, borderDash:[7,4], pointRadius:0, pointHoverRadius:4, tension:0, fill:false, _type:'topup'}
  ];
  datasets.forEach((ds,idx)=>{
    const item=document.createElement('div'); item.className='legend-item';
    item.innerHTML=`<span class="dot" style="background:${ds.borderColor}"></span><span>${ds.label}</span>`;
    item.addEventListener('click',()=>{
      if(hidden.has(idx)) hidden.delete(idx); else hidden.add(idx);
      item.classList.toggle('hidden',hidden.has(idx));
      if(valueChart){ valueChart.setDatasetVisibility(idx,!hidden.has(idx)); valueChart.update(); }
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
  valueChart.setDatasetVisibility(1, showTopups);
  valueChart.update();
}

/* ─── COMPOSITION CHART (stacked area: cash + each asset) ─── */
function updateCompChart(){
  if(!simRows.length) return;
  const dates=simRows.map(r=>r.date);
  const grid=cssVar('--chart-grid'), muted=cssVar('--chart-text'), text=cssVar('--text');
  const legendEl=$('compLegend'); legendEl.innerHTML='';
  const hidden=new Set();

  const series=[{label:'Cash', color:CASH_COLOR, data:simRows.map(r=>r.cash)}];
  simAssets.forEach(a=>series.push({label:a.name, color:a.colorHex, data:simRows.map(r=>r.assetVals[a.id]||0)}));

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

  const yCb=v=>fmt.currency(v,true);
  const opts={
    responsive:true, maintainAspectRatio:false, animation:{duration:300}, interaction:{mode:'index',intersect:false},
    plugins:{ legend:{display:false}, tooltip:{
      filter:item=>compChart?compChart.isDatasetVisible(item.datasetIndex):true,
      callbacks:{ title:ctx=>ctx[0]?.label||'', label:ctx=>`  ${ctx.dataset.label}: ${fmt.currency(ctx.parsed.y,true)}`,
        afterBody(items){ if(items.length){ const tot=items.reduce((s,i)=>s+i.parsed.y,0); $('compHoverBox').textContent=`${items[0].label}  —  Total: ${fmt.currency(tot,true)}  |  `+items.map(i=>`${i.dataset.label}: ${fmt.currency(i.parsed.y,true)}`).join('  |  '); } }},
      backgroundColor:cssVar('--panel')||'#11172a', titleColor:text, bodyColor:muted, borderColor:grid, borderWidth:1, padding:10},
      zoom:{pan:{enabled:true,mode:'x'},zoom:{wheel:{enabled:true,speed:.08},pinch:{enabled:true},mode:'x'}}},
    scales:{
      x:{title:{display:true,text:'Date',color:muted,font:{size:11}},ticks:{color:muted,maxTicksLimit:12,font:{size:11},callback:v=>dates[Number(v)]?.slice(0,7)||''},grid:{color:grid}},
      y:{stacked:true,title:{display:true,text:'Value ('+currentCurrencySymbol+')',color:muted,font:{size:11}},ticks:{color:muted,font:{size:11},callback:yCb},grid:{color:grid}}}
  };
  if(compChart) compChart.destroy();
  compChart=new Chart($('compCanvas'),{type:'line',data:{labels:dates,datasets},options:opts});
  compChart.update();
}

/* ─── SUMMARY TILES ─── */
function updateSummary(){
  const sg=$('summaryGrid'); sg.innerHTML='';
  if(!simRows.length){ return; }
  const last=simRows[simRows.length-1];
  const gain=last.total-last.cumTopup;
  const roi=last.cumTopup>0?gain/last.cumTopup:0;
  const cashPct=last.total>0?last.cash/last.total:0;
  const topupCount=simRows.filter((r,i)=>i===0?r.cumTopup>0:r.cumTopup>simRows[i-1].cumTopup).length;
  const tiles=[
    ['Final Portfolio Value', fmt.currency(last.total,true), ''],
    ['Total Topped Up', fmt.currency(last.cumTopup,true), topupCount+' top-ups'],
    ['Net Gain', fmt.currency(gain,true), 'ROI '+fmt.pct(roi)],
    ['Idle Cash', fmt.currency(last.cash,true), fmt.pct(cashPct)+' of portfolio']
  ];
  tiles.forEach(([label,value,sub])=>{
    sg.innerHTML+=`<div class="tile"><div class="label">${label}</div><div class="value">${value}</div>${sub?`<div style="font-size:.75rem;color:var(--muted);margin-top:3px">${sub}</div>`:''}</div>`;
  });
  simAssets.forEach(a=>{
    const v=last.assetVals[a.id]||0;
    const pct=last.total>0?v/last.total:0;
    sg.innerHTML+=`<div class="tile" style="border-left:3px solid ${a.colorHex}"><div class="label">${a.name}</div><div class="value">${fmt.currency(v,true)}</div><div style="font-size:.75rem;color:var(--muted);margin-top:3px">${fmt.pct(pct)} · target ${fmt.num(a.weight,0)}%</div></div>`;
  });
}

/* ─── COMPOSITION TABLE (month-end snapshots) ─── */
function monthEndRows(){
  const out=[]; const seen=new Map();
  simRows.forEach((r,i)=>{ seen.set(r.date.slice(0,7), i); });
  seen.forEach(i=>out.push(simRows[i]));
  out.sort((a,b)=>a.date<b.date?-1:1);
  return out;
}
function updateTable(){
  const head=$('compHead'), body=$('compBody');
  if(!simRows.length){ return; }
  head.innerHTML=`<tr><th>Date</th><th class="cash-cell">Cash</th>${simAssets.map(a=>`<th>${a.name}</th>`).join('')}<th>Portfolio Value</th></tr>`;
  const rows=monthEndRows();
  body.innerHTML=rows.map(r=>{
    return `<tr><td>${r.date}</td><td class="cash-cell">${fmt.currency(r.cash)}</td>${simAssets.map(a=>`<td>${fmt.currency(r.assetVals[a.id]||0)}</td>`).join('')}<td>${fmt.currency(r.total)}</td></tr>`;
  }).join('');
}

/* ─── CSV EXPORT (full daily) ─── */
$('downloadBtn').addEventListener('click',()=>{
  if(!simRows.length){ showWarning('Run a simulation first.'); return; }
  const header=['Date','Cash',...simAssets.map(a=>a.name),'Invested','PortfolioValue','CumulativeTopups'];
  const lines=[header.join(',')];
  simRows.forEach(r=>{
    const row=[r.date, r.cash.toFixed(2), ...simAssets.map(a=>(r.assetVals[a.id]||0).toFixed(2)), r.invested.toFixed(2), r.total.toFixed(2), r.cumTopup.toFixed(2)];
    lines.push(row.join(','));
  });
  const blob=new Blob([lines.join('\n')],{type:'text/csv'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='portfolio-dca.csv';
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
$('valuePngBtn').addEventListener('click',()=>exportChartPng('valueCanvas','portfolio-value.png','Portfolio Value Over Time','valueLegend'));
$('compPngBtn').addEventListener('click',()=>exportChartPng('compCanvas','portfolio-composition.png','Composition Over Time','compLegend'));
$('valueCopyBtn').addEventListener('click',async()=>{ const c=exportChartPng('valueCanvas','','Portfolio Value Over Time','valueLegend',false); if(c){ try{ await copyCanvasPng(c); showStatus($('assetFetchStatus'),'Copied value chart to clipboard.','ok'); }catch(e){ showStatus($('assetFetchStatus'),e.message,'error'); } } });
$('compCopyBtn').addEventListener('click',async()=>{ const c=exportChartPng('compCanvas','','Composition Over Time','compLegend',false); if(c){ try{ await copyCanvasPng(c); showStatus($('assetFetchStatus'),'Copied composition chart to clipboard.','ok'); }catch(e){ showStatus($('assetFetchStatus'),e.message,'error'); } } });

$('valueResetZoom').addEventListener('click',()=>{ if(valueChart) valueChart.resetZoom(); });
$('compResetZoom').addEventListener('click',()=>{ if(compChart) compChart.resetZoom(); });
$('valueCanvas').addEventListener('mouseleave',()=>{ $('valueHoverBox').textContent='Hover to inspect data points.'; });
$('compCanvas').addEventListener('mouseleave',()=>{ $('compHoverBox').textContent='Hover to inspect data points.'; });

$('showTopupsToggle').addEventListener('change',e=>{
  showTopups=e.target.checked;
  if(valueChart){ valueChart.setDatasetVisibility(1,showTopups); valueChart.update(); }
});

/* ─── CURRENCY ─── */
$('currencySymbol').addEventListener('change',e=>{
  currentCurrencySymbol=e.target.value;
  if(simRows.length){ updateValueChart(); updateCompChart(); updateSummary(); updateTable(); valueChart&&valueChart.setDatasetVisibility(1,showTopups); valueChart&&valueChart.update(); }
});
$('randomSeed').addEventListener('input',e=>{ currentRandomSeed=sanitizeSeed(e.target.value); });

/* ─── THEME ─── */
$('themeToggle').addEventListener('click',()=>{
  document.body.classList.toggle('light');
  $('themeToggle').textContent=document.body.classList.contains('light')?'🌙 Dark':'☀️ Light';
  if(simRows.length){ updateValueChart(); updateCompChart(); valueChart&&valueChart.setDatasetVisibility(1,showTopups); valueChart&&valueChart.update(); }
  renderAssetList();
});

/* ─── TABS ─── */
document.querySelectorAll('.ctrl-tab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.ctrl-tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.ctrl-panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    $('tab-'+btn.dataset.tab).classList.add('active');
  });
});

/* ─── SIMULATE / RESET ─── */
$('simBtn').addEventListener('click', runSimulation);
$('resetBtn').addEventListener('click',()=>{
  assets=[]; simRows=[]; simAssets=[]; assetIdCounter=0; priceCache={}; tickerFetchInFlight={};
  currentCurrencySymbol='$'; currentRandomSeed=DEFAULT_RANDOM_SEED; showTopups=true;
  if(valueChart){ valueChart.destroy(); valueChart=null; }
  if(compChart){ compChart.destroy(); compChart=null; }
  $('currencySymbol').value='$'; $('randomSeed').value=DEFAULT_RANDOM_SEED;
  $('topupAmount').value=5000; $('rfRate').value=0; $('rfTicker').value='';
  $('buyFee').value=0.1; $('sellFee').value=0.1;
  $('summaryGrid').innerHTML='';
  $('compBody').innerHTML='<tr><td colspan="3" style="color:var(--muted);text-align:center;padding:20px">Add assets and run to see composition.</td></tr>';
  $('valueLegend').innerHTML=''; $('compLegend').innerHTML='';
  $('valueHoverBox').textContent='Configure a portfolio and run to view value over time.';
  $('compHoverBox').textContent='Cash and each asset stack up to total portfolio value.';
  hideStatus($('assetFetchStatus')); hideStatus($('dateRangeStatus')); hideWarning();
  Object.assign(topupSched,{period:'monthly',weekdays:[1],daysOfMonth:[1],dayOfMonth:1,month:1});
  Object.assign(rebalSched,{period:'quarterly',weekdays:[1],daysOfMonth:[1],dayOfMonth:1,month:1});
  $('topupPeriod').value='monthly'; $('rebalPeriod').value='quarterly';
  renderScheduleBox('topupScheduleBox','topupScheduleHint',topupSched);
  renderScheduleBox('rebalScheduleBox','rebalScheduleHint',rebalSched);
  initDefaults();
  runSimulation();
});

/* ─── INIT ─── */
function setDefaultDates(){
  const end=new Date();
  const start=new Date(); start.setFullYear(start.getFullYear()-5);
  $('startDate').value=isoDate(start); $('endDate').value=isoDate(end);
}
function initDefaults(){
  addAsset({type:'custom', name:'Equities', returnPct:10, stdPct:18, weight:60});
  addAsset({type:'custom', name:'Bonds', returnPct:4, stdPct:6, weight:40});
}

setDefaultDates();
renderScheduleBox('topupScheduleBox','topupScheduleHint',topupSched);
renderScheduleBox('rebalScheduleBox','rebalScheduleHint',rebalSched);
initDefaults();
runSimulation();

})();
