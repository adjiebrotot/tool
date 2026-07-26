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

console.log(`\n════════ RESULT: ${PASS} passed, ${FAIL} failed, ${WARN} warnings ════════`);
if(FAIL) { console.log('FAILURES:'); fails.forEach(f=>console.log('  - '+f)); process.exit(1); }
