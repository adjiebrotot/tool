/* DCA Simulator audit harness.
   Loads SharedTA from ../../shared.js (stubbing browser globals), then replays the
   two engines VERBATIM against the supplied real CSV data and checks accounting
   integrity invariants. Pure logic only — no DOM. */
'use strict';
const fs = require('fs');
const path = require('path');

/* ── 1. Load SharedTA from shared.js with browser stubs ── */
function loadShared(){
  const code = fs.readFileSync(path.join(__dirname,'..','..','shared.js'),'utf8');
  const noop = ()=>{};
  const fakeEl = new Proxy({}, { get:()=>noop, set:()=>true });
  const document = {
    readyState:'complete',
    addEventListener:noop, removeEventListener:noop,
    querySelector:()=>null, querySelectorAll:()=>[],
    getElementById:()=>null, createElement:()=>fakeEl, body:fakeEl,
    documentElement:fakeEl
  };
  const window = {};
  window.window = window;
  window.document = document;
  window.addEventListener = noop;
  window.navigator = { clipboard:{} };
  window.getComputedStyle = ()=>({ getPropertyValue:()=>'' });
  const fn = new Function('window','document','global', code + '\n;return window;');
  return fn(window, document, window);
}
const SharedTA = loadShared().SharedTA;
if(!SharedTA || !SharedTA.buildTech) throw new Error('SharedTA failed to load');

/* ── 2. CSV loader (uses Adj.Close, matching the worker's `prices`) ── */
function loadCsv(file){
  const lines = fs.readFileSync(file,'utf8').trim().split(/\r?\n/);
  const header = lines[0].split(',');
  const di = header.indexOf('Date');
  const ai = header.indexOf('Adj.Close');
  const dates=[], prices=[];
  for(let i=1;i<lines.length;i++){
    const c = lines[i].split(',');
    const p = parseFloat(c[ai]);
    if(!isFinite(p) || p<=0) continue;
    dates.push(c[di]); prices.push(p);
  }
  return { dates, prices };
}

/* Align multiple series to common dates (intersection), like the tools do. */
function alignCommon(seriesMap){
  const names = Object.keys(seriesMap);
  const sets = names.map(n=>new Set(seriesMap[n].dates));
  const common = seriesMap[names[0]].dates.filter(d=>sets.every(s=>s.has(d)));
  const out = { dates: common };
  names.forEach(n=>{
    const idx={}; seriesMap[n].dates.forEach((d,i)=>idx[d]=i);
    out[n] = common.map(d=>seriesMap[n].prices[idx[d]]);
  });
  return out;
}

/* ════════════════════════════════════════════════════════════════════
   MAIN TOOL ENGINE (verbatim from dcasimulator/script.js)
   ════════════════════════════════════════════════════════════════════ */
const DATE_BASED_STYLES = ['monthly-date','weekly-day'];
const FORWARD_STYLES    = ['monthly-top','monthly-bottom','weekly-top','weekly-bottom'];
const MOMENTUM_STYLES   = ['momentum-peak','momentum-dip'];
const TECH_STYLES       = ['tech-ma-cross','tech-rsi','tech-bollinger','tech-macd-cross','tech-macd-hist','tech-adx'];
const periodKey = SharedTA.periodKey;
const buildTech = SharedTA.buildTech;
function parseDateM(s){ const [y,m,d]=s.split('-'); return new Date(+y,+m-1,+d); }

function groupIndicesByPeriod(dates, period){
  const groups={};
  dates.forEach((d,i)=>{ const k=periodKey(d,period); (groups[k]||(groups[k]=[])).push(i); });
  return Object.values(groups);
}
function periodSignalDates(dates, signal, eom, period){
  const out=[];
  groupIndicesByPeriod(dates, period).forEach(idxs=>{
    let picked=-1;
    for(const i of idxs){ if(signal[i]){ picked=i; break; } }
    if(picked>=0) out.push(picked);
    else if(eom) out.push(idxs[idxs.length-1]);
  });
  return out;
}
function getInvestmentDates(priceData, style, dayOrDate, momentumPct=5, momentumEOM=true, tech=null, techEOM=true, period='monthly'){
  const {dates, prices} = priceData;
  const result=[];
  if(style==='monthly-date'){
    const months={};
    dates.forEach((d,i)=>{ const ym=d.slice(0,7); if(!months[ym])months[ym]=[]; months[ym].push(i); });
    Object.values(months).forEach(idxs=>{
      const target=dayOrDate; let best=idxs[0];
      idxs.forEach(i=>{ const day=parseInt(dates[i].slice(8,10));
        if(Math.abs(day-target)<Math.abs(parseInt(dates[best].slice(8,10))-target)) best=i; });
      result.push(best);
    });
  } else if(style==='monthly-top'){
    const months={};
    dates.forEach((d,i)=>{ const ym=d.slice(0,7); if(!months[ym])months[ym]=[]; months[ym].push(i); });
    Object.values(months).forEach(idxs=>{ let best=idxs[0]; idxs.forEach(i=>{ if(prices[i]>prices[best]) best=i; }); result.push(best); });
  } else if(style==='monthly-bottom'){
    const months={};
    dates.forEach((d,i)=>{ const ym=d.slice(0,7); if(!months[ym])months[ym]=[]; months[ym].push(i); });
    Object.values(months).forEach(idxs=>{ let best=idxs[0]; idxs.forEach(i=>{ if(prices[i]<prices[best]) best=i; }); result.push(best); });
  } else if(style==='weekly-day'){
    const targetDow=Math.min(7,Math.max(1,dayOrDate));
    groupIndicesByPeriod(dates,'weekly').forEach(idxs=>{
      let best=idxs[0];
      idxs.forEach(i=>{ const dow=parseDateM(dates[i]).getDay()||7; const bestDow=parseDateM(dates[best]).getDay()||7;
        if(Math.abs(dow-targetDow)<Math.abs(bestDow-targetDow)) best=i; });
      result.push(best);
    });
  } else if(style==='weekly-top'){
    groupIndicesByPeriod(dates,'weekly').forEach(idxs=>{ let best=idxs[0]; idxs.forEach(i=>{ if(prices[i]>prices[best]) best=i; }); result.push(best); });
  } else if(style==='weekly-bottom'){
    groupIndicesByPeriod(dates,'weekly').forEach(idxs=>{ let best=idxs[0]; idxs.forEach(i=>{ if(prices[i]<prices[best]) best=i; }); result.push(best); });
  } else if(style==='momentum-peak'||style==='momentum-dip'){
    const threshold=(momentumPct||5)/100;
    groupIndicesByPeriod(dates, period).forEach(idxs=>{
      const refPrice=prices[idxs[0]]; let invested=false;
      for(const i of idxs){ const p=prices[i];
        if(style==='momentum-peak'&&p>=refPrice*(1+threshold)){ result.push(i); invested=true; break; }
        else if(style==='momentum-dip'&&p<=refPrice*(1-threshold)){ result.push(i); invested=true; break; } }
      if(!invested&&momentumEOM) result.push(idxs[idxs.length-1]);
    });
  } else if(TECH_STYLES.includes(style)){
    const {signal}=buildTech(prices, style, tech||{});
    periodSignalDates(dates, signal, techEOM, period).forEach(i=>result.push(i));
  }
  return [...new Set(result)].sort((a,b)=>a-b);
}
function investAmountAt(base, yearlyIncreasePct, startStr, dateStr){
  const r=(yearlyIncreasePct||0)/100;
  if(!r) return base;
  const yrs=Math.floor((parseDateM(dateStr)-parseDateM(startStr))/(365.25*86400000));
  return base*Math.pow(1+r, Math.max(0,yrs));
}
function simulateSecurity(sec){
  const {dates, prices} = sec.priceData;
  const investIdxs = getInvestmentDates(sec.priceData, sec.style, sec.dayOrDate, sec.momentumPct, sec.momentumEOM, sec.tech, sec.techEOM, sec.period||'monthly');
  const investSet = new Set(investIdxs);
  const startStr = dates[0];
  const yinc = sec.yearlyIncrease||0;
  let runUnits=0, runDeposited=0;
  const dailyRows=[];
  const investRows=[];
  for(let i=0;i<dates.length;i++){
    if(investSet.has(i)){
      const amt=investAmountAt(sec.amount, yinc, startStr, dates[i]);
      runUnits+=amt/prices[i]; runDeposited+=amt;
      investRows.push({date:dates[i], price:prices[i], amt, units:amt/prices[i], totalUnits:runUnits, totalDeposited:runDeposited});
    }
    dailyRows.push({date:dates[i], price:prices[i], totalUnits:runUnits, totalDeposited:runDeposited, equity:runUnits*prices[i]});
  }
  return { investRows, dailyRows, finalEquity: runUnits*(prices[prices.length-1]||1), totalDeposited:runDeposited, investIdxs };
}

/* ════════════════════════════════════════════════════════════════════
   PORTFOLIO ENGINE (verbatim from dcasimulator/portfolio/script.js)
   — instrumented to also return total fees paid for integrity checks.
   ════════════════════════════════════════════════════════════════════ */
function parseDateP(s){ const [y,m,d]=s.split('-'); return new Date(+y,+m-1,+d); }
function weekKey(d){
  const dt=parseDateP(d), y=dt.getFullYear();
  const doy=Math.floor((dt-new Date(y,0,1))/86400000);
  const wk=Math.floor((doy+new Date(y,0,1).getDay())/7);
  return y+'-'+String(wk).padStart(2,'0');
}
function closestByDom(idxs, dates, targetDom){
  let best=idxs[0];
  for(const i of idxs){ const day=parseInt(dates[i].slice(8,10),10);
    if(Math.abs(day-targetDom)<Math.abs(parseInt(dates[best].slice(8,10),10)-targetDom)) best=i; }
  return best;
}
function closestByDow(idxs, dates, targetDow){
  let best=idxs[0];
  for(const i of idxs){ const dow=parseDateP(dates[i]).getDay()||7, bd=parseDateP(dates[best]).getDay()||7;
    if(Math.abs(dow-targetDow)<Math.abs(bd-targetDow)) best=i; }
  return best;
}
function getScheduleIndices(dates, sched){
  const res=new Set(); const p=sched.period;
  if(p==='weekly'||p==='fortnightly'){
    const groups=new Map();
    dates.forEach((d,i)=>{ const k=weekKey(d); if(!groups.has(k))groups.set(k,[]); groups.get(k).push(i); });
    const wds=(sched.weekdays&&sched.weekdays.length)?sched.weekdays:[1];
    const parity=(sched.weekParity===1)?1:0;
    [...groups.values()].forEach((idxs,gi)=>{ if(p==='fortnightly' && gi%2!==parity) return; wds.forEach(wd=>res.add(closestByDow(idxs,dates,wd))); });
  } else if(p==='monthly'){
    const months=new Map();
    dates.forEach((d,i)=>{ const ym=d.slice(0,7); if(!months.has(ym))months.set(ym,[]); months.get(ym).push(i); });
    const doms=(sched.daysOfMonth&&sched.daysOfMonth.length)?sched.daysOfMonth:[1];
    months.forEach(idxs=>doms.forEach(dom=>res.add(closestByDom(idxs,dates,dom))));
  } else if(p==='quarterly'){
    const months=new Map();
    dates.forEach((d,i)=>{ const ym=d.slice(0,7); if(!months.has(ym))months.set(ym,[]); months.get(ym).push(i); });
    const qStart=[1,2,3].includes(sched.quarterStart)?sched.quarterStart:1;
    months.forEach((idxs,ym)=>{ const m=parseInt(ym.slice(5,7),10); if(((m-1)%3)+1===qStart) res.add(closestByDom(idxs,dates,sched.dayOfMonth||1)); });
  } else if(p==='yearly'){
    const years=new Map();
    dates.forEach((d,i)=>{ const y=d.slice(0,4); if(!years.has(y))years.set(y,[]); years.get(y).push(i); });
    years.forEach(idxs=>{ const inMonth=idxs.filter(i=>parseInt(dates[i].slice(5,7),10)===(sched.month||1)); if(inMonth.length) res.add(closestByDom(inMonth,dates,sched.dayOfMonth||1)); });
  }
  return res;
}

// Instrumented fee accumulator passed via state._fees
function investedValue(assets, state, i){ return assets.reduce((s,a)=>s+state.units[a.id]*a.px[i],0); }
function buyByWeights(assets, state, i, buyFee, wts){
  wts = wts || assets.map(a=>a.weight||0);
  const cash=state.cash; if(cash<=0) return;
  assets.forEach((a,k)=>{
    const dollars=cash*((wts[k]||0)/100);
    if(dollars<=0) return;
    state.units[a.id]+=dollars*(1-buyFee)/a.px[i];
    state._fees += dollars*buyFee;
    state.cash-=dollars;
  });
  if(state.cash<1e-9) state.cash=0;
}
function buyUnderweight(assets, state, i, buyFee, wts){
  wts = wts || assets.map(a=>a.weight||0);
  const C=state.cash; if(C<=0) return;
  const total=investedValue(assets,state,i)+C;
  const deficits=assets.map((a,k)=>Math.max(0, total*((wts[k]||0)/100)-state.units[a.id]*a.px[i]));
  const sum=deficits.reduce((s,d)=>s+d,0);
  if(sum<=0) return;
  const scale=Math.min(1, C/sum);
  assets.forEach((a,k)=>{
    const spend=deficits[k]*scale; if(spend<=0) return;
    state.units[a.id]+=spend*(1-buyFee)/a.px[i];
    state._fees += spend*buyFee;
    state.cash-=spend;
  });
  if(state.cash<1e-9) state.cash=0;
}
function fullRebalance(assets, state, i, buyFee, sellFee, wts){
  wts = wts || assets.map(a=>a.weight||0);
  const T=state.cash+investedValue(assets,state,i);
  if(T<=0) return;
  assets.forEach((a,k)=>{
    const price=a.px[i], value=state.units[a.id]*price, target=T*((wts[k]||0)/100);
    if(value>target){ const sellDollars=value-target; state.units[a.id]-=sellDollars/price; state.cash+=sellDollars*(1-sellFee); state._fees += sellDollars*sellFee; }
  });
  const buys=assets.map((a,k)=>{ const value=state.units[a.id]*a.px[i], target=T*((wts[k]||0)/100); return Math.max(0,target-value); });
  const totalBuy=buys.reduce((s,b)=>s+b,0);
  if(totalBuy>0){
    const scale=Math.min(1, state.cash/totalBuy);
    assets.forEach((a,k)=>{ const spend=buys[k]*scale; if(spend<=0) return; state.units[a.id]+=spend*(1-buyFee)/a.px[i]; state._fees += spend*buyFee; state.cash-=spend; });
  }
  if(state.cash<1e-9) state.cash=0;
}
function trailingReturn(px, i, lbDays){
  const j = Math.max(0, i - lbDays); const base = px[j];
  if(base==null || base<=0 || px[i]==null) return -Infinity;
  return px[i]/base - 1;
}
function momentumWeights(assets, i, lbDays, rankWeights){
  const order = assets.map((a,k)=>k).sort((x,y)=> trailingReturn(assets[y].px,i,lbDays) - trailingReturn(assets[x].px,i,lbDays));
  const wts = new Array(assets.length).fill(0);
  order.forEach((assetIdx, rank)=>{ wts[assetIdx] = rankWeights[rank]||0; });
  return wts;
}
function buildAssetTriggerSignals(assets, common){
  return assets.map(a=>{
    const tr = a.trigger || {}; const px = a.px, n = px.length;
    const period = tr.period || 'monthly'; const eom = !!tr.eom;
    let raw;
    if(tr.type && tr.type.indexOf('tech-')===0){
      raw = SharedTA.buildTech(px, tr.type, tr.tech||{}).signal;
    } else {
      raw = new Array(n).fill(false);
      const pct = (tr.pct!=null?tr.pct:10)/100; const dir = tr.direction || 'drop';
      let curKey=null, openPx=null;
      for(let i=0;i<n;i++){ const k = SharedTA.periodKey(common[i], period);
        if(k!==curKey){ curKey=k; openPx=px[i]; }
        if(openPx==null||openPx<=0) continue;
        const move = px[i]/openPx - 1;
        raw[i] = dir==='rise' ? (move >= pct) : (move <= -pct); }
    }
    const sig = new Array(n).fill(false); const groups = new Map();
    for(let i=0;i<n;i++){ const k=SharedTA.periodKey(common[i], period); if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(i); }
    groups.forEach(idxs=>{ let picked=-1; for(const i of idxs){ if(raw[i]){ picked=i; break; } } if(picked>=0) sig[picked]=true; else if(eom) sig[idxs[idxs.length-1]]=true; });
    return sig;
  });
}
function deployTriggered(assets, state, i, triggeredIdx, buyFee, sellFee, reserveIdx){
  if(!triggeredIdx.length) return;
  const T=state.cash+investedValue(assets,state,i); if(T<=0) return;
  const buys={}; let need=0;
  triggeredIdx.forEach(k=>{ const a=assets[k]; const def=Math.max(0, T*((a.weight||0)/100) - state.units[a.id]*a.px[i]); if(def>0){ buys[k]=def; need+=def; } });
  if(need<=0) return;
  if(reserveIdx!=null && reserveIdx>=0 && assets[reserveIdx]){
    const r=assets[reserveIdx]; const shortfall=Math.max(0, need - state.cash);
    if(shortfall>0 && sellFee<1){
      const wantValue=shortfall/(1-sellFee); const haveValue=state.units[r.id]*r.px[i];
      const sellValue=Math.min(wantValue, haveValue);
      state.units[r.id]-=sellValue/r.px[i]; state.cash+=sellValue*(1-sellFee); state._fees += sellValue*sellFee;
    }
  }
  const scale=Math.min(1, state.cash/need);
  triggeredIdx.forEach(k=>{ const spend=(buys[k]||0)*scale; if(spend<=0) return; const a=assets[k]; state.units[a.id]+=spend*(1-buyFee)/a.px[i]; state._fees += spend*buyFee; state.cash-=spend; });
  if(state.cash<1e-9) state.cash=0;
}
function simulatePortfolio(p, assets, common, rfPx){
  const method=p.rebal.method, cwTiming=p.rebal.cwTiming;
  const buyFee=(p.rebal.buyFee||0)/100, sellFee=(p.rebal.sellFee||0)/100;
  const baseAmount=p.topup.amount||0; const yinc=(p.topup.yearlyIncrease||0)/100;
  const startStr=common[0];
  const rfMode=p.rf.mode, rfRate=p.rf.rate||0;
  const rfDayFactor=Math.pow(1+rfRate/100, 1/252);
  const topupSet=getScheduleIndices(common, p.topupSched);
  let rebalSet=new Set();
  if(method==='constant-weight' && cwTiming==='schedule') rebalSet=getScheduleIndices(common, p.rebalSched);
  const lbDays=Math.max(1, Math.round((p.rebal.lookbackMonths||6)*21));
  let rankWeights=(p.rebal.rankWeights&&p.rebal.rankWeights.length)?p.rebal.rankWeights.slice():assets.map(()=>100/assets.length);
  while(rankWeights.length<assets.length) rankWeights.push(0);
  const dynWts=i=>momentumWeights(assets,i,lbDays,rankWeights);
  const isRule=method==='rule-trigger';
  const reserveIdx=(isRule && p.rebal.reserveMode==='asset') ? assets.findIndex(a=>a.id===p.rebal.reserveAssetId) : -1;
  const triggerSig=isRule ? buildAssetTriggerSignals(assets, common) : null;
  const reserveOnlyWts=(reserveIdx>=0) ? assets.map((a,k)=>k===reserveIdx?100:0) : null;
  const state={cash:0, units:{}, _fees:0, _rfEarned:0};
  assets.forEach(a=>state.units[a.id]=0);
  const rows=[]; let cumTopup=0;
  for(let i=0;i<common.length;i++){
    if(i>0){ const before=state.cash; state.cash *= (rfMode==='ticker' && rfPx ? (rfPx[i]/rfPx[i-1]) : rfDayFactor); state._rfEarned += state.cash-before; }
    if(topupSet.has(i)){
      const amount = yinc ? baseAmount*Math.pow(1+yinc, Math.max(0,Math.floor((parseDateP(common[i])-parseDateP(startStr))/(365.25*86400000)))) : baseAmount;
      state.cash+=amount; cumTopup+=amount;
      if(method==='constant-allocation') buyByWeights(assets,state,i,buyFee);
      else if(method==='towards-weight') buyUnderweight(assets,state,i,buyFee);
      else if(method==='constant-weight'){
        if(cwTiming==='at-topup'){ buyUnderweight(assets,state,i,buyFee); fullRebalance(assets,state,i,buyFee,sellFee); }
        else buyUnderweight(assets,state,i,buyFee);
      }
      else if(method==='dynamic-momentum'){ buyByWeights(assets,state,i,buyFee,dynWts(i)); }
      else if(isRule && reserveOnlyWts){ buyByWeights(assets,state,i,buyFee,reserveOnlyWts); }
    }
    let firedToday=false;
    if(isRule){
      const fired=[];
      for(let k=0;k<assets.length;k++){ if(k===reserveIdx) continue; if(triggerSig[k] && triggerSig[k][i]) fired.push(k); }
      if(fired.length){ deployTriggered(assets,state,i,fired,buyFee,sellFee,reserveIdx); firedToday=true; }
    }
    if(rebalSet.has(i)) fullRebalance(assets,state,i,buyFee,sellFee);
    const ev=[];
    if(topupSet.has(i)) ev.push('Top-up');
    if(isRule && firedToday) ev.push('Trigger');
    if(rebalSet.has(i)) ev.push('Rebalance');
    const assetVals={}; let invested=0;
    assets.forEach(a=>{ const v=state.units[a.id]*a.px[i]; assetVals[a.id]=v; invested+=v; });
    rows.push({date:common[i], cash:state.cash, assetVals, invested, total:state.cash+invested, cumTopup, event:ev.join(' + ')});
  }
  return { rows, fees: state._fees, rfEarned: state._rfEarned, finalState: state };
}

module.exports = {
  loadCsv, alignCommon,
  DATE_BASED_STYLES, FORWARD_STYLES, MOMENTUM_STYLES, TECH_STYLES,
  getInvestmentDates, simulateSecurity, groupIndicesByPeriod, periodSignalDates,
  simulatePortfolio, getScheduleIndices, buildAssetTriggerSignals, momentumWeights, weekKey,
  SharedTA
};
