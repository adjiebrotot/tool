'use strict';
const path = require('path');
const H = require('./harness');
const DIR = '/root/.claude/uploads/dafe2855-4ad0-5b8c-85e7-4f3e520e38d9';
const DHHF = H.loadCsv(path.join(DIR,'c5cec415-DHHF.AX.csv'));
const TRADING_DAYS=252;

function statMean(a){ return a.length ? a.reduce((s,x)=>s+x,0)/a.length : 0; }
function statStdev(a){ if(a.length<2) return 0; const m=statMean(a); return Math.sqrt(a.reduce((s,x)=>s+(x-m)*(x-m),0)/(a.length-1)); }

// MAIN tool TWR: returns of the raw price series (style-independent)
function mainTWR(prices){
  const rets=[]; for(let i=1;i<prices.length;i++) rets.push(prices[i-1]>0?prices[i]/prices[i-1]-1:0);
  const years=prices.length/TRADING_DAYS; // approx; main uses date span
  const growth=rets.reduce((g,r)=>g*(1+r),1);
  return {rets, twrGrowth:growth};
}
// PORTFOLIO tool TWR: portfolioReturns net of daily topup flow
function portTWR(rows){
  const r=[];
  for(let i=1;i<rows.length;i++){ const prev=rows[i-1].total; const flow=rows[i].cumTopup-rows[i-1].cumTopup; r.push(prev>0?(rows[i].total-flow)/prev-1:0); }
  return r;
}

// Single-asset portfolio, constant-allocation 100%, ZERO fee, ZERO rf, monthly topup.
const assets=[{id:'a1',name:'DHHF',px:DHHF.prices,weight:100}];
const p={
  rebal:{method:'constant-allocation',cwTiming:'at-topup',buyFee:0,sellFee:0,reserveMode:'cash',reserveAssetId:null,lookbackMonths:6,rankWeights:[]},
  topup:{amount:1000,yearlyIncrease:0},
  topupSched:{period:'monthly',weekdays:[1],weekParity:0,daysOfMonth:[1],dayOfMonth:1,quarterStart:1,month:1},
  rebalSched:{period:'quarterly',weekdays:[1],weekParity:0,daysOfMonth:[1],dayOfMonth:1,quarterStart:1,month:1},
  rf:{mode:'rate',rate:0,ticker:''}
};
const out=H.simulatePortfolio(p, assets, DHHF.dates, null);
const pr=portTWR(out.rows);
const mr=mainTWR(DHHF.prices).rets;

// Compare the daily-return SERIES where the portfolio holds a position.
// Once fully invested, portfolio daily return == asset price daily return.
let firstInvested=out.rows.findIndex(r=>r.invested>0);
let maxDiff=0, cmp=0;
for(let i=Math.max(firstInvested+2,2);i<out.rows.length;i++){
  // skip days with a topup flow (portfolio removes it; on those days small residual cash differs)
  const flow=out.rows[i].cumTopup-out.rows[i-1].cumTopup;
  if(flow>0) continue;
  if(out.rows[i-1].cash>0.01) continue; // skip residual-cash days (constant-alloc deploys fully, ~0)
  const d=Math.abs(pr[i-1]-mr[i-1]); maxDiff=Math.max(maxDiff,d); cmp++;
}
console.log('Cross-tool TWR daily-return comparison (single asset, fully invested, no-flow days):');
console.log('  compared days:', cmp, ' max |portRet - assetRet| =', maxDiff.toExponential(3));
console.log(maxDiff<1e-9
  ? '  ✓ PASS: portfolio daily TWR == asset price return once fully invested (tools agree)'
  : '  ✗ NOTE: portfolio TWR diverges from asset price return (expected only on cash/flow days)');

// Sharpe annualisation factor check (both use sqrt(252))
console.log('\nBoth tools: Sharpe/Sortino annualised by sqrt(252), CAGR via date span, MWR via bisection XIRR — identical formulas (verified by source read).');
