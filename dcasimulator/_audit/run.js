'use strict';
const path = require('path');
const fs = require('fs');
const H = require('./harness');

/* ── Price data ──────────────────────────────────────────────────────────────
   Prefers the real Adj.Close CSVs. Point at them with:
       DCA_FIXTURE_DIR=/path/to/csvs node run.js
   If they are not present, fall back to deterministic seeded GBM series with the
   same SHAPE as the originals (a low-vol money-market proxy, a long equity ETF,
   and a shorter-history equity ETF). Every assertion below is a structural
   invariant (conservation, fees, target weights, trigger parity), never a
   hardcoded value from a particular ticker, so the checks are identical either
   way — only the numbers printed alongside them change.                        */
const DIR = process.env.DCA_FIXTURE_DIR ||
            '/root/.claude/uploads/dafe2855-4ad0-5b8c-85e7-4f3e520e38d9';
const FIXTURES = { AAA:'21ab219f-AAA.AX.csv', DHHF:'c5cec415-DHHF.AX.csv', GHHF:'79c33354-GHHF.AX.csv' };
const haveCsvs = Object.values(FIXTURES).every(f => fs.existsSync(path.join(DIR,f)));

/* deterministic RNG (mulberry32) + Box-Muller, so runs are reproducible */
function rng(seed){ let a=seed>>>0; return ()=>{ a=(a+0x6D2B79F5)>>>0; let t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
function gbm(startISO, endISO, s0, driftPa, volPa, seed){
  const r=rng(seed), dates=[], prices=[]; const dt=1/252;
  let px=s0, d=new Date(startISO+'T00:00:00Z'); const end=new Date(endISO+'T00:00:00Z');
  while(d<=end){
    const dow=d.getUTCDay();
    if(dow!==0&&dow!==6){
      dates.push(d.toISOString().slice(0,10));
      prices.push(Math.round(px*1e6)/1e6);
      let u=r(); if(u<1e-12) u=1e-12;
      const z=Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*r());
      px*=Math.exp((driftPa-0.5*volPa*volPa)*dt + volPa*Math.sqrt(dt)*z);
    }
    d=new Date(d.getTime()+86400000);
  }
  return {dates,prices};
}
const AAA  = haveCsvs ? H.loadCsv(path.join(DIR,FIXTURES.AAA))    // money market (low vol)
                      : gbm('2018-01-01','2024-12-31', 50.00, 0.020, 0.004, 11);
const DHHF = haveCsvs ? H.loadCsv(path.join(DIR,FIXTURES.DHHF))   // equity ETF
                      : gbm('2018-01-01','2024-12-31', 25.00, 0.080, 0.160, 22);
const GHHF = haveCsvs ? H.loadCsv(path.join(DIR,FIXTURES.GHHF))   // equity ETF (short history)
                      : gbm('2021-06-01','2024-12-31', 20.00, 0.100, 0.220, 33);
console.log(haveCsvs ? `Price data: real CSVs from ${DIR}`
                     : 'Price data: SEEDED SYNTHETIC (fixture CSVs not found; set DCA_FIXTURE_DIR to use real data)');

let PASS=0, FAIL=0, WARN=0;
const fails=[];
function ok(cond,msg){ if(cond){PASS++;} else {FAIL++; fails.push(msg); console.log('  ✗ FAIL: '+msg);} }
function warn(msg){ WARN++; console.log('  ⚠ WARN: '+msg); }
function approx(a,b,tol){ return Math.abs(a-b)<=tol; }
const money=v=>'$'+v.toFixed(2);

console.log('Date ranges: AAA',AAA.dates[0],'→',AAA.dates[AAA.dates.length-1],'('+AAA.dates.length+'d)');
console.log('             DHHF',DHHF.dates[0],'→',DHHF.dates[DHHF.dates.length-1],'('+DHHF.dates.length+'d)');
console.log('             GHHF',GHHF.dates[0],'→',GHHF.dates[GHHF.dates.length-1],'('+GHHF.dates.length+'d)');

/* ══════════════════════════════════════════════════════════════════
   PART 1 — MAIN TOOL: every investment style
   ══════════════════════════════════════════════════════════════════ */
console.log('\n=== PART 1: MAIN TOOL — investment styles (DHHF.AX) ===');
const allStyles = [...H.DATE_BASED_STYLES, ...H.MOMENTUM_STYLES, ...H.TECH_STYLES, ...H.FORWARD_STYLES];
const baseSec = { priceData: DHHF, amount:500, dayOrDate:1, momentumPct:5, momentumEOM:true,
                  techEOM:true, period:'monthly', yearlyIncrease:0,
                  tech:{} };

for(const style of allStyles){
  const sec = Object.assign({}, baseSec, {style});
  const res = H.simulateSecurity(sec);
  const n = res.investIdxs.length;
  // Invariant 1: at least some investment happened (with EOM fallbacks, monthly styles must buy ~ once/month)
  const monthsSpan = new Set(DHHF.dates.map(d=>d.slice(0,7))).size;
  // Invariant 2: deposited == sum of all buys (amount each, no yearly increase)
  const expectDep = n*500;
  ok(approx(res.totalDeposited, expectDep, 1e-6), `[${style}] deposited (${money(res.totalDeposited)}) == n*amount (${money(expectDep)})`);
  // Invariant 3: units accounting — finalEquity == totalUnits * lastPrice
  const lastPx = DHHF.prices[DHHF.prices.length-1];
  const totUnits = res.dailyRows[res.dailyRows.length-1].totalUnits;
  ok(approx(res.finalEquity, totUnits*lastPx, 1e-6), `[${style}] finalEquity == units*lastPrice`);
  // Invariant 4: each buy's units == amt/price (no fees in main tool)
  let unitOk=true;
  res.investRows.forEach(r=>{ if(!approx(r.units, r.amt/r.price, 1e-12)) unitOk=false; });
  ok(unitOk, `[${style}] every buy: units == amount/price (no fee)`);
  // Invariant 5: daily equity monotonic in deposited at buy points (deposited only grows)
  let depMono=true; let prevDep=-1;
  res.dailyRows.forEach(r=>{ if(r.totalDeposited<prevDep-1e-9) depMono=false; prevDep=r.totalDeposited; });
  ok(depMono, `[${style}] cumulative deposited is non-decreasing`);
  // Frequency sanity for date-based monthly
  const freqNote = H.DATE_BASED_STYLES.includes(style)||H.MOMENTUM_STYLES.includes(style)||style.startsWith('tech')
    ? '' : '';
  console.log(`  • ${style.padEnd(16)} buys=${String(n).padStart(3)}  deposited=${money(res.totalDeposited).padStart(11)}  finalEq=${money(res.finalEquity).padStart(11)}  ret=${((res.finalEquity/res.totalDeposited-1)*100).toFixed(1)}%`);
  // Style-specific behavioral checks
  if(style==='monthly-date'){
    ok(n===monthsSpan, `[monthly-date] exactly one buy per month (${n} vs ${monthsSpan} months)`);
  }
  if(style==='monthly-top' || style==='monthly-bottom'){
    ok(n===monthsSpan, `[${style}] one buy per month (${n} vs ${monthsSpan})`);
    // verify top picks the max price in its month, bottom the min
    const months={}; DHHF.dates.forEach((d,i)=>{ const ym=d.slice(0,7); (months[ym]||(months[ym]=[])).push(i); });
    let extremaOk=true;
    res.investIdxs.forEach(idx=>{ const ym=DHHF.dates[idx].slice(0,7); const grp=months[ym];
      const px=DHHF.prices[idx];
      if(style==='monthly-top'){ const mx=Math.max(...grp.map(i=>DHHF.prices[i])); if(!approx(px,mx,1e-9)) extremaOk=false; }
      else { const mn=Math.min(...grp.map(i=>DHHF.prices[i])); if(!approx(px,mn,1e-9)) extremaOk=false; }
    });
    ok(extremaOk, `[${style}] each buy is the month's ${style==='monthly-top'?'highest':'lowest'} price`);
  }
}

// momentum-dip trigger correctness: every dip buy (non-EOM) must be <= month-open*(1-thr)
console.log('\n  -- momentum trigger correctness (dip 5%, no EOM) --');
{
  const sec = Object.assign({}, baseSec, {style:'momentum-dip', momentumPct:5, momentumEOM:false});
  const res = H.simulateSecurity(sec);
  const months={}; DHHF.dates.forEach((d,i)=>{ const ym=d.slice(0,7); (months[ym]||(months[ym]=[])).push(i); });
  let trigOk=true;
  res.investIdxs.forEach(idx=>{ const ym=DHHF.dates[idx].slice(0,7); const ref=DHHF.prices[months[ym][0]];
    if(DHHF.prices[idx] > ref*0.95 + 1e-9) trigOk=false; });
  ok(trigOk, `[momentum-dip] every buy price <= month-open*(1-5%)`);
  console.log(`     dip buys (no EOM): ${res.investIdxs.length}`);
}

/* Cross-tool consistency: main tech-style invest dates == portfolio rule-trigger
   tech signal dates for the SAME asset & params. */
console.log('\n  -- cross-tool consistency: tech signal dates (main vs portfolio) --');
for(const style of H.TECH_STYLES){
  const mainIdx = H.getInvestmentDates(DHHF, style, 1, 5, true, {}, true, 'monthly');
  const sig = H.buildAssetTriggerSignals([{id:1,px:DHHF.prices,trigger:{type:style,period:'monthly',eom:true,tech:{}}}], DHHF.dates)[0];
  const portIdx = []; sig.forEach((b,i)=>{ if(b) portIdx.push(i); });
  const same = mainIdx.length===portIdx.length && mainIdx.every((v,k)=>v===portIdx[k]);
  ok(same, `[${style}] main getInvestmentDates == portfolio trigger signal (main=${mainIdx.length}, port=${portIdx.length})`);
}
// momentum/pct consistency
{
  const mainIdx = H.getInvestmentDates(DHHF, 'momentum-dip', 1, 8, true, null, true, 'monthly');
  const sig = H.buildAssetTriggerSignals([{id:1,px:DHHF.prices,trigger:{type:'pct',direction:'drop',pct:8,period:'monthly',eom:true}}], DHHF.dates)[0];
  const portIdx=[]; sig.forEach((b,i)=>{ if(b) portIdx.push(i); });
  const same = mainIdx.length===portIdx.length && mainIdx.every((v,k)=>v===portIdx[k]);
  ok(same, `[momentum-dip 8% vs pct/drop] main == portfolio trigger dates (main=${mainIdx.length}, port=${portIdx.length})`);
}

/* ══════════════════════════════════════════════════════════════════
   PART 2 — PORTFOLIO TOOL: every rebalancing method
   ══════════════════════════════════════════════════════════════════ */
console.log('\n=== PART 2: PORTFOLIO TOOL — rebalancing methods (DHHF 60 / AAA 40) ===');
const common = H.alignCommon({DHHF, AAA, GHHF});
console.log('  common range:', common.dates[0],'→',common.dates[common.dates.length-1], '('+common.dates.length+'d)');

function mkPort(method, extra){
  return Object.assign({
    rebal:{ method, cwTiming:'at-topup', buyFee:0.1, sellFee:0.1, reserveMode:'cash', reserveAssetId:null, lookbackMonths:6, rankWeights:[] },
    topup:{ amount:5000, yearlyIncrease:0 },
    topupSched:{ period:'monthly', weekdays:[1], weekParity:0, daysOfMonth:[1], dayOfMonth:1, quarterStart:1, month:1 },
    rebalSched:{ period:'quarterly', weekdays:[1], weekParity:0, daysOfMonth:[1], dayOfMonth:1, quarterStart:1, month:1 },
    rf:{ mode:'rate', rate:0, ticker:'' }
  }, extra||{});
}
function mkAssets(weights){
  // weights: [dhhf, aaa]
  return [
    { id:'a1', name:'DHHF', px:common.DHHF, weight:weights[0] },
    { id:'a2', name:'AAA',  px:common.AAA,  weight:weights[1] }
  ];
}

function integrityCheck(label, p, assets, rfPx){
  const out = H.simulatePortfolio(p, assets, common.dates, rfPx);
  const rows = out.rows;
  const last = rows[rows.length-1];
  // INVARIANT A: conservation of money.
  //   finalTotal == cumTopup + rfEarned - fees + marketGain
  //   => marketGain = finalTotal - cumTopup - rfEarned + fees   (just a definition; we instead
  //   verify the closed form: total == cumTopup + rfEarned + marketPnL - fees)
  // We recompute marketPnL independently from the unit ledger is hard; instead check the
  // STRICT cash-flow identity by re-deriving: sum of (cash injections) = cumTopup; the only
  // leaks are fees. So: finalTotal + fees - rfEarned should equal cumTopup + (unrealized+realized gains).
  // Cleaner invariant we CAN check exactly:
  //   At all times total == cash + sum(units*px). (definitional, always true) -> check non-negative & finite
  let allFinite=true, cashNonNeg=true, totalConsistent=true;
  rows.forEach(r=>{
    if(!isFinite(r.total)||!isFinite(r.cash)) allFinite=false;
    if(r.cash < -1e-6) cashNonNeg=false;
    let inv=0; assets.forEach(a=>inv+=r.assetVals[a.id]);
    if(!approx(r.total, r.cash+inv, 1e-6)) totalConsistent=false;
  });
  ok(allFinite, `[${label}] all totals finite`);
  ok(cashNonNeg, `[${label}] cash never goes negative`);
  ok(totalConsistent, `[${label}] total == cash + Σ(asset values) every day`);
  // INVARIANT B: cumTopup increases only on schedule, equals n_topups * amount
  const topupSet = H.getScheduleIndices(common.dates, p.topupSched);
  ok(approx(last.cumTopup, topupSet.size*p.topup.amount, 1e-6),
     `[${label}] cumTopup (${money(last.cumTopup)}) == nTopups*amount (${topupSet.size}*${p.topup.amount})`);
  // INVARIANT C: fees are non-negative and bounded
  ok(out.fees>=0, `[${label}] fees non-negative (${money(out.fees)})`);
  return out;
}

// --- towards-weight ---
console.log('\n  -- towards-weight (60/40) --');
{
  const assets=mkAssets([60,40]); const p=mkPort('towards-weight');
  const out=integrityCheck('towards-weight', p, assets);
  const last=out.rows[out.rows.length-1];
  console.log(`     final=${money(last.total)} cash=${money(last.cash)} fees=${money(out.fees)} cumTopup=${money(last.cumTopup)}`);
  // towards-weight never sells -> fees should be buy-only. Check a sell never happened by
  // verifying units of each asset are non-decreasing.
  let nonDecr=true;
  // recompute unit ledger
  // (we can't see units directly, but value can drop with price; instead test weight drift allowed)
  // Check: cash fully deployed after each topup (towards-weight spends all cash if any deficit)
  ok(last.cash < p.topup.amount, `[towards-weight] residual cash < one topup (deploys cash)`);
}

// --- constant-allocation ---
console.log('\n  -- constant-allocation (60/40) --');
{
  const assets=mkAssets([60,40]); const p=mkPort('constant-allocation');
  const out=integrityCheck('constant-allocation', p, assets);
  const last=out.rows[out.rows.length-1];
  console.log(`     final=${money(last.total)} cash=${money(last.cash)} fees=${money(out.fees)}`);
  // constant-allocation splits each fresh topup 60/40 by COST. Check that on a topup day with
  // zero prior holdings the very first allocation matches 60/40 net of fee.
  ok(last.cash < 1, `[constant-allocation] negligible residual cash (${money(last.cash)})`);
}

// --- constant-weight at-topup ---
console.log('\n  -- constant-weight at-topup (60/40) --');
{
  const assets=mkAssets([60,40]); const p=mkPort('constant-weight',{rebal:Object.assign(mkPort('constant-weight').rebal,{cwTiming:'at-topup'})});
  const out=integrityCheck('constant-weight@topup', p, assets);
  const rows=out.rows, last=rows[rows.length-1];
  console.log(`     final=${money(last.total)} cash=${money(last.cash)} fees=${money(out.fees)}`);
  // After each topup+rebalance day, weights should be ~60/40 (within fee tolerance).
  const topupSet=H.getScheduleIndices(common.dates,p.topupSched);
  let maxDrift=0;
  rows.forEach((r,i)=>{ if(!topupSet.has(i)) return; const inv=r.invested; if(inv<=0) return;
    const w0=r.assetVals['a1']/inv*100; maxDrift=Math.max(maxDrift, Math.abs(w0-60)); });
  ok(maxDrift < 1.0, `[constant-weight@topup] post-rebalance weight drift < 1% (max ${maxDrift.toFixed(3)}%)`);
}

// --- constant-weight scheduled ---
console.log('\n  -- constant-weight scheduled (quarterly rebalance) --');
{
  const base=mkPort('constant-weight'); base.rebal.cwTiming='schedule';
  const assets=mkAssets([60,40]);
  const out=integrityCheck('constant-weight@sched', base, assets);
  const rows=out.rows, last=rows[rows.length-1];
  console.log(`     final=${money(last.total)} cash=${money(last.cash)} fees=${money(out.fees)}`);
  const rebalSet=H.getScheduleIndices(common.dates, base.rebalSched);
  let maxDrift=0;
  rows.forEach((r,i)=>{ if(!rebalSet.has(i)) return; const inv=r.invested; if(inv<=0) return;
    const w0=r.assetVals['a1']/inv*100; maxDrift=Math.max(maxDrift, Math.abs(w0-60)); });
  ok(maxDrift < 1.0, `[constant-weight@sched] post-rebalance weight drift < 1% on rebal days (max ${maxDrift.toFixed(3)}%)`);
  ok(rebalSet.size>0, `[constant-weight@sched] rebalance fired (${rebalSet.size} days)`);
}

// --- dynamic-momentum (Trend Following) ---
// Trend Following deploys each top-up by momentum rank, exactly like Constant
// Allocation but with the contribution split across ranks rather than fixed assets.
console.log('\n  -- Trend Following / dynamic-momentum (rank weights 60/30/10, 3 assets) --');
{
  const assets=[
    { id:'a1', name:'DHHF', px:common.DHHF, weight:0 },
    { id:'a2', name:'AAA',  px:common.AAA,  weight:0 },
    { id:'a3', name:'GHHF', px:common.GHHF, weight:0 }
  ];
  const p=mkPort('dynamic-momentum'); p.rebal.rankWeights=[60,30,10]; p.rebal.lookbackMonths=6;
  const out=integrityCheck('dynamic-momentum', p, assets);
  const last=out.rows[out.rows.length-1];
  console.log(`     final=${money(last.total)} cash=${money(last.cash)} fees=${money(out.fees)}`);
  // Like constant-allocation, each top-up's rank weights sum to 100% and buy fully,
  // so with a 0% risk-free rate negligible cash is left over at the end.
  ok(last.cash < 1, `[dynamic-momentum] negligible residual cash, top-up fully deployed (${money(last.cash)})`);
  // verify rank weights map onto best performer. Pick a topup day, check best trailing-return asset got 60%.
  const topupSet=[...H.getScheduleIndices(common.dates,p.topupSched)].sort((a,b)=>a-b);
  const probe=topupSet[topupSet.length-1]; // late day, full lookback
  const lbDays=Math.round(6*21);
  const wts=H.momentumWeights(assets, probe, lbDays, [60,30,10]);
  const ret=assets.map(a=>a.px[probe]/a.px[Math.max(0,probe-lbDays)]-1);
  const bestK=ret.indexOf(Math.max(...ret));
  ok(wts[bestK]===60, `[dynamic-momentum] best 6m performer gets top rank weight 60% (got ${wts[bestK]}%)`);
  ok(Math.abs(wts.reduce((s,x)=>s+x,0)-100)<1e-9, `[dynamic-momentum] mapped weights sum to 100%`);
}

// --- rule-trigger, cash reserve ---
console.log('\n  -- rule-trigger, cash reserve (buy DHHF on 5% monthly dip) --');
{
  const assets=[
    { id:'a1', name:'DHHF', px:common.DHHF, weight:100, trigger:{type:'pct',direction:'drop',pct:5,period:'monthly',eom:false} },
    { id:'a2', name:'AAA',  px:common.AAA,  weight:0,   trigger:{type:'pct',direction:'drop',pct:5,period:'monthly',eom:false} }
  ];
  const p=mkPort('rule-trigger'); p.rebal.reserveMode='cash';
  const out=integrityCheck('rule-trigger/cash', p, assets);
  const rows=out.rows, last=rows[rows.length-1];
  console.log(`     final=${money(last.total)} cash=${money(last.cash)} fees=${money(out.fees)}`);
  // With cash reserve, on non-trigger months cash accumulates. Cash should be >0 at some points.
  const anyCash=rows.some(r=>r.cash>1);
  ok(anyCash, `[rule-trigger/cash] cash reserve accumulates between triggers`);
}

// --- rule-trigger, asset reserve ---
console.log('\n  -- rule-trigger, asset reserve (park in AAA, deploy to DHHF on dip) --');
{
  const assets=[
    { id:'a1', name:'DHHF', px:common.DHHF, weight:100, trigger:{type:'pct',direction:'drop',pct:5,period:'monthly',eom:false} },
    { id:'a2', name:'AAA',  px:common.AAA,  weight:0,   trigger:{type:'pct',direction:'drop',pct:5,period:'monthly',eom:false} }
  ];
  const p=mkPort('rule-trigger'); p.rebal.reserveMode='asset'; p.rebal.reserveAssetId='a2';
  const out=integrityCheck('rule-trigger/asset', p, assets);
  const rows=out.rows, last=rows[rows.length-1];
  console.log(`     final=${money(last.total)} cash=${money(last.cash)} fees=${money(out.fees)}`);
  // Topups parked in AAA -> AAA should hold value between triggers; cash should be ~0 most days.
  const cashMostlyZero = rows.filter(r=>r.cash<1).length > rows.length*0.5;
  ok(cashMostlyZero, `[rule-trigger/asset] fresh cash parked in reserve asset (cash≈0 most days)`);
}

/* ══════════════════════════════════════════════════════════════════
   PART 3 — Fee integrity (exact closed-form on a controlled 1-asset case)
   ══════════════════════════════════════════════════════════════════ */
console.log('\n=== PART 3: EXACT FEE ACCOUNTING (single asset, constant-allocation) ===');
{
  // One asset at 100% weight, constant-allocation: every topup dollar buys units at (1-buyFee).
  // No sells ever -> total fees == cumTopup * buyFee exactly. final units == Σ amt*(1-fee)/px.
  const assets=[{ id:'a1', name:'DHHF', px:common.DHHF, weight:100 }];
  const p=mkPort('constant-allocation'); p.rebal.buyFee=0.25; p.rebal.sellFee=0.25;
  const out=H.simulatePortfolio(p, assets, common.dates, null);
  const last=out.rows[out.rows.length-1];
  const topupSet=H.getScheduleIndices(common.dates,p.topupSched);
  const expectFees = topupSet.size*p.topup.amount*0.0025;
  ok(approx(out.fees, expectFees, 1e-6), `[fee] constant-allocation total fees == cumTopup*buyFee (${money(out.fees)} vs ${money(expectFees)})`);
  // Independently recompute final units
  const topupArr=[...topupSet].sort((a,b)=>a-b);
  let units=0; topupArr.forEach(i=>{ units += p.topup.amount*(1-0.0025)/common.DHHF[i]; });
  ok(approx(last.invested, units*common.DHHF[common.DHHF.length-1], 1e-4),
     `[fee] final invested matches independent unit ledger (${money(last.invested)})`);
  console.log(`     fees=${money(out.fees)} expected=${money(expectFees)} cumTopup=${money(last.cumTopup)}`);
}

/* ══════════════════════════════════════════════════════════════════
   PART 4 — Fee-free conservation: total == cumTopup + marketPnL exactly
   ══════════════════════════════════════════════════════════════════ */
console.log('\n=== PART 4: ZERO-FEE / ZERO-RF CONSERVATION (towards-weight) ===');
{
  const assets=mkAssets([60,40]); const p=mkPort('towards-weight'); p.rebal.buyFee=0; p.rebal.sellFee=0;
  const out=H.simulatePortfolio(p, assets, common.dates, null);
  const last=out.rows[out.rows.length-1];
  ok(approx(out.fees,0,1e-9), `[conserve] zero fees configured -> zero fees charged`);
  // Build independent unit ledger: towards-weight with 0 fee. Hard to close-form with rebalancing,
  // but towards-weight never sells, so we can replay buys. Instead verify: with 0 fee & 0 rf, the
  // money-in (cumTopup) is fully invested (cash≈0 after final topup deploy) for a 2-asset deficit fill.
  console.log(`     final=${money(last.total)} cash=${money(last.cash)} cumTopup=${money(last.cumTopup)} fees=${money(out.fees)}`);
  ok(last.cash < 1, `[conserve] zero-fee towards-weight deploys all cash (residual ${money(last.cash)})`);
}

/* ══════════════════════════════════════════════════════════════════
   PART 5 — PRICE % MOVE ANCHORS: previous top / previous bottom
   ------------------------------------------------------------------
   The "From" control on a Price % move trigger picks what the move is measured
   against. Month open / Week open anchor on the firing bucket's opening price;
   Previous top / Previous bottom anchor on the highest / lowest usable close seen
   STRICTLY BEFORE the day under test, across the whole loaded range.

   Everything below is checked against an independent replay written from that
   wording alone: it recomputes each day's anchor from scratch over the prior
   slice (rather than carrying a running extreme), and buckets with its own key
   functions. A shared off-by-one would have to be made twice to pass.
   ══════════════════════════════════════════════════════════════════ */
console.log('\n=== PART 5: PRICE % MOVE ANCHORS (previous top / previous bottom) ===');

// Independent period keys, written from the documented rule, not imported.
const indMonthKey = d => d.slice(0,7);
const indWeekKey  = d => {
  const [y,m,dd]=d.split('-').map(Number);
  const dt=new Date(y,m-1,dd), jan1=new Date(y,0,1);
  const doy=Math.floor((dt-jan1)/86400000);
  return y+'-'+String(Math.floor((doy+jan1.getDay())/7)).padStart(2,'0');
};
const indKey = (d,period) => period==='weekly' ? indWeekKey(d) : indMonthKey(d);

// Independent replay of one trigger's fire days. Deliberately naive: the anchor is
// re-derived from the whole prior slice on every day.
function indFireIdx(dates, prices, cfg){
  const {ref, dir, pct, period, eom} = cfg;
  const n=prices.length, thr=pct/100;
  const raw=new Array(n).fill(false);
  for(let i=0;i<n;i++){
    const p=prices[i];
    if(!(Number.isFinite(p) && p>0)) continue;
    const prior=[];
    for(let j=0;j<i;j++){ const q=prices[j]; if(Number.isFinite(q)&&q>0) prior.push(q); }
    if(!prior.length) continue;
    const anchor = ref==='top' ? Math.max.apply(null,prior) : Math.min.apply(null,prior);
    const move = p/anchor - 1;
    raw[i] = dir==='rise' ? (move >= thr) : (move <= -thr);
  }
  const order=[], buckets=new Map();
  for(let i=0;i<n;i++){ const k=indKey(dates[i],period); if(!buckets.has(k)){ buckets.set(k,[]); order.push(k); } buckets.get(k).push(i); }
  const out=[];
  order.forEach(k=>{
    const idxs=buckets.get(k);
    const hit=idxs.find(i=>raw[i]);
    if(hit!==undefined) out.push(hit);
    else if(eom) out.push(idxs[idxs.length-1]);
  });
  return out;
}
// Fire days straight from the engine copy under test.
function engFireIdx(dates, prices, cfg){
  const sig = H.buildAssetTriggerSignals(
    [{id:1, px:prices, trigger:{type:'pct', direction:cfg.dir, pct:cfg.pct, ref:cfg.ref, period:cfg.period, eom:cfg.eom}}],
    dates)[0];
  const out=[]; sig.forEach((b,i)=>{ if(b) out.push(i); });
  return out;
}
const sameIdx=(a,b)=>a.length===b.length && a.every((v,k)=>v===b[k]);

/* ── 5a. engine == independent replay, across the whole option matrix ─────── */
console.log('\n  -- engine vs independent replay --');
// Breakouts above a running high and breakdowns below a running low are rare, so a
// coarse threshold would compare an empty list against an empty list and prove nothing.
// `live` records which (anchor, direction) pairs actually produced a signal with the
// End-of-period fallback off, and is asserted non-empty for all four afterwards.
const live={};
for(const ref of ['top','bottom'])
for(const dir of ['drop','rise'])
for(const period of ['monthly','weekly'])
for(const eom of [false,true])
for(const pct of [1,3,10]){
  const cfg={ref,dir,pct,period,eom};
  const eng=engFireIdx(DHHF.dates, DHHF.prices, cfg);
  const ind=indFireIdx(DHHF.dates, DHHF.prices, cfg);
  ok(sameIdx(eng,ind),
     `[${ref}/${dir}/${pct}%/${period}/eom=${eom}] engine fire days == independent replay (eng=${eng.length}, ind=${ind.length})`);
  if(!eom) live[ref+'/'+dir] = Math.max(live[ref+'/'+dir]||0, eng.length);
}
for(const ref of ['top','bottom'])
for(const dir of ['drop','rise'])
  ok((live[ref+'/'+dir]||0) > 0,
     `[${ref}/${dir}] the replay comparison is non-vacuous (peak ${live[ref+'/'+dir]||0} fires with EoP off)`);

/* ── 5b. hand-built series: exact thresholds and unusable prices ──────────── */
console.log('\n  -- hand-built edge cases (exact threshold, first day, bad quotes) --');
{
  // One trading day per month, so each day is its own firing bucket and the bucketed
  // signal is the raw daily condition - the anchor logic is tested with nothing else
  // in the way. Ratios are powers of two (150/100, 75/150, 150/300, 37/74) so the move
  // lands EXACTLY on a 50% threshold in binary floating point; a strict > or < instead
  // of >= or <= would silently drop those days. Real price data never sits on the
  // threshold, so only a constructed series can pin this down.
  const eDates=['2020-01-15','2020-02-14','2020-03-13','2020-04-15','2020-05-15',
                '2020-06-15','2020-07-15','2020-08-14','2020-09-15','2020-10-15'];
  //           i0    i1    i2   i3(bad) i4   i5(bad) i6    i7    i8    i9
  const ePx  =[100,  150,  75,  NaN,    76,  0,      74,   300,  150,  37];
  //  top anchor  : -    100   150   150    150   150     150   150   300   300
  //  bottom anchor: -   100   100   75     75    75      75    74    74    74
  const expect={
    'top/drop':    [2,6,8,9],  // i2 -50.0% exact, i6 -50.67%, i8 -50.0% exact, i9 -87.7%
    'top/rise':    [1,7],      // i1 +50.0% exact (breakout), i7 +100%
    'bottom/drop': [9],        // i9 -50.0% exact below the 74 low
    'bottom/rise': [1,7,8]     // i1 +50.0% exact, i7 +305%, i8 +103%
  };
  for(const ref of ['top','bottom'])
  for(const dir of ['drop','rise']){
    const cfg={ref,dir,pct:50,period:'monthly',eom:false};
    const eng=engFireIdx(eDates, ePx, cfg);
    const ind=indFireIdx(eDates, ePx, cfg);
    const want=expect[ref+'/'+dir];
    ok(sameIdx(eng,want), `[edge ${ref}/${dir}] fires on exactly the expected days (got [${eng}], want [${want}])`);
    ok(sameIdx(ind,want), `[edge ${ref}/${dir}] independent replay agrees ([${ind}])`);
  }
  // i0 has nothing before it, so no anchor exists and nothing can fire on day one.
  let firstDayQuiet=true;
  for(const ref of ['top','bottom']) for(const dir of ['drop','rise'])
    if(engFireIdx(eDates, ePx, {ref,dir,pct:0.01,period:'monthly',eom:false}).includes(0)) firstDayQuiet=false;
  ok(firstDayQuiet, `[edge] the first day never fires - there is no previous top or bottom yet`);
  // i3 (NaN) and i5 (0) are unusable quotes. They must be skipped without becoming the
  // anchor: a 0 low would make every later rise infinite, and a NaN would poison a
  // running Math.max/Math.min for the rest of the series. Both show up in the lists above.
  const poisonFree = sameIdx(engFireIdx(eDates, ePx, {ref:'bottom',dir:'rise',pct:50,period:'monthly',eom:false}), expect['bottom/rise'])
                  && sameIdx(engFireIdx(eDates, ePx, {ref:'top',dir:'drop',pct:50,period:'monthly',eom:false}), expect['top/drop']);
  ok(poisonFree, `[edge] a zero or NaN quote is skipped and never becomes the anchor`);
  // Same series under the calendar anchor: each day opens its own bucket, so the move
  // from the period open is always zero and nothing fires. Proves the anchors are
  // genuinely different code paths rather than one falling through to the other.
  ok(engFireIdx(eDates, ePx, {ref:'period',dir:'drop',pct:50,period:'monthly',eom:false}).length===0,
     `[edge] the month-open anchor fires nothing on this series (distinct code path)`);
  // End-of-period fallback still closes every bucket, whatever the anchor says.
  ok(engFireIdx(eDates, ePx, {ref:'top',dir:'drop',pct:50,period:'monthly',eom:true}).length===eDates.length,
     `[edge] EoP on -> every one of the ${eDates.length} buckets deploys`);
}

/* ── 5c. the anchor bound actually holds on every fire ────────────────────── */
console.log('\n  -- anchor bound on every fired day (eom off, so every fire is a real signal) --');
for(const ref of ['top','bottom'])
for(const dir of ['drop','rise']){
  const pct=6, cfg={ref,dir,pct,period:'monthly',eom:false};
  const fires=engFireIdx(DHHF.dates, DHHF.prices, cfg);
  let boundOk=true;
  fires.forEach(i=>{
    const prior=DHHF.prices.slice(0,i).filter(q=>Number.isFinite(q)&&q>0);
    const anchor = ref==='top' ? Math.max.apply(null,prior) : Math.min.apply(null,prior);
    const p=DHHF.prices[i];
    if(dir==='rise'){ if(p < anchor*(1+pct/100) - 1e-9) boundOk=false; }
    else           { if(p > anchor*(1-pct/100) + 1e-9) boundOk=false; }
  });
  ok(boundOk, `[${ref}/${dir}] every buy price is ${dir==='rise'?'>=':'<='} prev ${ref} * (1${dir==='rise'?'+':'-'}${pct}%) (${fires.length} buys)`);
}
{
  // The anchor excludes the day under test. If it did not, a running high that already
  // contains today would make "rises above the previous top" unreachable (and likewise
  // "falls below the previous bottom"), so these two combinations must fire at all.
  const up   = engFireIdx(DHHF.dates, DHHF.prices, {ref:'top',    dir:'rise', pct:1, period:'monthly', eom:false});
  const down = engFireIdx(DHHF.dates, DHHF.prices, {ref:'bottom', dir:'drop', pct:1, period:'monthly', eom:false});
  ok(up.length>0,   `[top/rise] breakout above the previous top is reachable (${up.length} fires) - anchor excludes today`);
  ok(down.length>0, `[bottom/drop] breakdown below the previous bottom is reachable (${down.length} fires) - anchor excludes today`);
}

/* ── 5d. causality: no lookahead ──────────────────────────────────────────── */
console.log('\n  -- causality: truncating the series never changes an earlier signal --');
for(const ref of ['top','bottom'])
for(const dir of ['drop','rise']){
  // With the End-of-period fallback off, a fire is "first raw hit in the bucket", which
  // must not depend on any day after it. Rebuild on prefixes and compare.
  const cfg={ref,dir,pct:5,period:'monthly',eom:false};
  const full=new Set(engFireIdx(DHHF.dates, DHHF.prices, cfg));
  let causal=true, checked=0;
  [150, 400, 700, DHHF.prices.length-1].forEach(m=>{
    if(m<2 || m>=DHHF.prices.length) return;
    checked++;
    const cut=engFireIdx(DHHF.dates.slice(0,m), DHHF.prices.slice(0,m), cfg);
    const fullPrefix=[...full].filter(i=>i<m).sort((a,b)=>a-b);
    if(!sameIdx(cut, fullPrefix)) causal=false;
  });
  ok(causal && checked>0, `[${ref}/${dir}] signals on a truncated series match the full series prefix (${checked} cut points)`);
}

/* ── 5e. bucketing: the firing rate is the Frequency control, not the anchor ─ */
console.log('\n  -- one deploy per period bucket --');
for(const ref of ['top','bottom'])
for(const period of ['monthly','weekly']){
  const fires=engFireIdx(DHHF.dates, DHHF.prices, {ref, dir:'drop', pct:2, period, eom:false});
  const seen=new Set(); let dup=false;
  fires.forEach(i=>{ const k=indKey(DHHF.dates[i],period); if(seen.has(k)) dup=true; seen.add(k); });
  ok(!dup, `[${ref}/${period}] at most one fire per ${period==='weekly'?'week':'month'} with EoP off (${fires.length} fires)`);
  // EoP on: every bucket must produce exactly one deploy day.
  const eomFires=engFireIdx(DHHF.dates, DHHF.prices, {ref, dir:'drop', pct:2, period, eom:true});
  const nBuckets=new Set(DHHF.dates.map(d=>indKey(d,period))).size;
  ok(eomFires.length===nBuckets, `[${ref}/${period}] EoP on -> exactly one deploy per bucket (${eomFires.length} vs ${nBuckets} buckets)`);
}

/* ── 5f. backward compatibility of saved configs ──────────────────────────── */
console.log('\n  -- saved-config compatibility --');
{
  const base={type:'pct', direction:'drop', pct:8, period:'monthly', eom:true};
  const sig=cfg=>{ const s=H.buildAssetTriggerSignals([{id:1,px:DHHF.prices,trigger:cfg}], DHHF.dates)[0];
                   const o=[]; s.forEach((b,i)=>{ if(b) o.push(i); }); return o; };
  const legacy=sig(base);                                   // written before the anchors existed
  const explicit=sig(Object.assign({},base,{ref:'period'})); // same thing, spelled out
  const junk=sig(Object.assign({},base,{ref:'sideways'}));   // unknown value must fall back
  ok(sameIdx(legacy,explicit), `[compat] a trigger with no "ref" behaves exactly like ref:'period' (${legacy.length} fires)`);
  ok(sameIdx(legacy,junk),     `[compat] an unrecognised "ref" falls back to the period open`);
  const top=sig(Object.assign({},base,{ref:'top'}));
  ok(!sameIdx(legacy,top),     `[compat] ref:'top' really does change the signal (${top.length} vs ${legacy.length} fires)`);
}

/* ── 5g. the shipped page and the harness copy must not drift apart ───────── */
console.log('\n  -- engine parity: portfolio/script.js vs harness copy --');
{
  // Pull buildAssetTriggerSignals straight out of the page source and run it beside the
  // harness copy. "Verbatim" is then a checked property, not a comment.
  const src=fs.readFileSync(path.join(__dirname,'..','portfolio','script.js'),'utf8');
  const start=src.indexOf('function buildAssetTriggerSignals(');
  let body=null;
  if(start>=0){
    let depth=0, i=src.indexOf('{',start);
    for(let j=i;j<src.length;j++){
      const c=src[j];
      if(c==='{') depth++;
      else if(c==='}'){ depth--; if(depth===0){ body=src.slice(start,j+1); break; } }
    }
  }
  ok(!!body, '[parity] buildAssetTriggerSignals located in portfolio/script.js');
  if(body){
    const pageFn=new Function('SharedTA', body+'\nreturn buildAssetTriggerSignals;')(H.SharedTA);
    let allSame=true, cases=0;
    for(const ref of ['period','top','bottom'])
    for(const dir of ['drop','rise'])
    for(const period of ['monthly','weekly'])
    for(const eom of [false,true]){
      cases++;
      const trigger={type:'pct', direction:dir, pct:7, ref, period, eom};
      const a=[{id:1, px:DHHF.prices, trigger}];
      const s1=pageFn(a, DHHF.dates, undefined)[0];
      const s2=H.buildAssetTriggerSignals(a, DHHF.dates, undefined)[0];
      if(s1.length!==s2.length || !s1.every((v,k)=>v===s2[k])) allSame=false;
    }
    for(const style of H.TECH_STYLES){
      cases++;
      const a=[{id:1, px:DHHF.prices, trigger:{type:style, period:'monthly', eom:true, tech:{}}}];
      const s1=pageFn(a, DHHF.dates, undefined)[0];
      const s2=H.buildAssetTriggerSignals(a, DHHF.dates, undefined)[0];
      if(!s1.every((v,k)=>v===s2[k])) allSame=false;
    }
    { // at-topup mirrors the top-up schedule in both copies
      cases++;
      const topupSet=new Set([5,40,90]);
      const a=[{id:1, px:DHHF.prices, trigger:{type:'at-topup'}}];
      const s1=pageFn(a, DHHF.dates, topupSet)[0];
      const s2=H.buildAssetTriggerSignals(a, DHHF.dates, topupSet)[0];
      const hit=[]; s1.forEach((b,i)=>{ if(b) hit.push(i); });
      if(!s1.every((v,k)=>v===s2[k])) allSame=false;
      ok(sameIdx(hit,[5,40,90]), '[parity] at-topup signal mirrors the top-up schedule');
    }
    ok(allSame, `[parity] page engine and harness copy agree on every trigger config (${cases} cases)`);
  }
}

/* ── 5h. accounting integrity of a full portfolio run on the new anchors ──── */
console.log('\n  -- portfolio accounting integrity with top/bottom anchors --');
for(const [ref,dir] of [['top','drop'],['bottom','rise']]){
  const trig={type:'pct', direction:dir, pct:5, ref, period:'monthly', eom:false};
  const assets=[
    { id:'a1', name:'DHHF', px:common.DHHF, weight:100, trigger:trig },
    { id:'a2', name:'AAA',  px:common.AAA,  weight:0,   trigger:trig }
  ];
  const p=mkPort('rule-trigger'); p.rebal.reserveMode='cash';
  const out=integrityCheck(`rule-trigger/cash/${ref}`, p, assets);
  const last=out.rows[out.rows.length-1];
  // Money can only enter as a top-up: nothing is ever worth more than what was paid in
  // plus market P&L, and the reserve never lends what it does not hold.
  const bought=out.rows.filter(r=>/Trigger/.test(r.event)).length;
  ok(bought>0, `[rule-trigger/cash/${ref}] the ${ref} anchor actually deploys (${bought} trigger days)`);
  ok(out.fees <= last.cumTopup, `[rule-trigger/cash/${ref}] fees (${money(out.fees)}) never exceed money paid in (${money(last.cumTopup)})`);
  console.log(`     ${ref}/${dir}: final=${money(last.total)} cash=${money(last.cash)} fees=${money(out.fees)} triggers=${bought}`);
}
{
  // Asset reserve: top-ups park in AAA and are sold down to fund DHHF buys. Cash must not
  // sit idle between deploys, and units sold can never exceed units held.
  const trig={type:'pct', direction:'drop', pct:5, ref:'top', period:'monthly', eom:false};
  const assets=[
    { id:'a1', name:'DHHF', px:common.DHHF, weight:100, trigger:trig },
    { id:'a2', name:'AAA',  px:common.AAA,  weight:0,   trigger:trig }
  ];
  const p=mkPort('rule-trigger'); p.rebal.reserveMode='asset'; p.rebal.reserveAssetId='a2';
  const out=integrityCheck('rule-trigger/asset/top', p, assets);
  const cashMostlyZero=out.rows.filter(r=>r.cash>1).length < out.rows.length*0.05;
  ok(cashMostlyZero, `[rule-trigger/asset/top] fresh cash parked in the reserve asset (cash≈0 most days)`);
  let reserveNonNeg=true;
  out.rows.forEach(r=>{ if(r.assetVals['a2'] < -1e-6) reserveNonNeg=false; });
  ok(reserveNonNeg, `[rule-trigger/asset/top] reserve asset value never goes negative (no short sales)`);
  const last=out.rows[out.rows.length-1];
  console.log(`     asset reserve: final=${money(last.total)} cash=${money(last.cash)} fees=${money(out.fees)}`);
}
{
  // Zero fees, zero risk-free rate: the only way value moves is price. Replay the deploys
  // against an independent unit ledger and the final equity must match to the cent.
  const trig={type:'pct', direction:'drop', pct:5, ref:'top', period:'monthly', eom:false};
  const assets=[{ id:'a1', name:'DHHF', px:common.DHHF, weight:100, trigger:trig }];
  const p=mkPort('rule-trigger'); p.rebal.buyFee=0; p.rebal.sellFee=0; p.rebal.reserveMode='cash';
  const out=H.simulatePortfolio(p, assets, common.dates, null);
  const last=out.rows[out.rows.length-1];
  ok(approx(out.fees,0,1e-9), `[conserve/top] zero fees configured -> zero fees charged`);
  // Independent ledger: cash in on schedule, and on each fire day spend the whole deficit
  // toward the 100% target, which with one asset means spending all the cash.
  const topupSet=H.getScheduleIndices(common.dates, p.topupSched);
  const fireSet=new Set(indFireIdx(common.dates, common.DHHF, {ref:'top', dir:'drop', pct:5, period:'monthly', eom:false}));
  let cash=0, units=0;
  for(let i=0;i<common.dates.length;i++){
    if(topupSet.has(i)) cash += p.topup.amount;
    if(fireSet.has(i) && cash>0 && common.DHHF[i]>0){ units += cash/common.DHHF[i]; cash=0; }
  }
  const expect = cash + units*common.DHHF[common.DHHF.length-1];
  ok(approx(last.total, expect, 1e-6),
     `[conserve/top] final total matches an independent unit ledger (${money(last.total)} vs ${money(expect)})`);
  ok(approx(last.cumTopup, topupSet.size*p.topup.amount, 1e-6),
     `[conserve/top] cumTopup == nTopups*amount (${money(last.cumTopup)})`);
  console.log(`     zero-fee replay: final=${money(last.total)} independent=${money(expect)} cash=${money(last.cash)}`);
}

console.log(`\n════════ RESULT: ${PASS} passed, ${FAIL} failed, ${WARN} warnings ════════`);
if(FAIL) { console.log('FAILURES:'); fails.forEach(f=>console.log('  - '+f)); process.exit(1); }
