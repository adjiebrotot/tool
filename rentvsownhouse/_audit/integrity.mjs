// Rent vs Own — cross-surface integrity audit (floating-rate schedules included).
//
// run.mjs checks that each cashflow table balances on its own. This one checks
// that every surface on the page tells the same story, and that the story is
// the documented mathematics, by replaying it here from first principles:
//
//   I1  mortgage: at every rate change the P&I repayment is the annuity on the
//       balance left over the term left; Σ principal == loan; balance 0 at term
//       (for the low, mid and high paths of a floating schedule)
//   I2  table (CSV) == independent replay, own and rent, every year
//   I3  chart lines == table, for all three graphs (net equity, cash, cost)
//   I4  chart band edges == the replay at the low and the high rate paths
//   I5  KPI cards == the rows they summarise (initial cash, budget range,
//       breakeven, equity difference)
//   I6  summary tiles == the final row, and the repayment tile spans the
//       repayments the band spans
//   I7  a floating rate touches only what the rate touches: with a budget you
//       set, Rent has no band at all; with the automatic budget Rent's band is
//       exactly the owner's extra repayment invested at the risk-free rate
//   I8  rent-then-buy on a floating schedule: table == replay, chart == table
//   I9  interest-only balance repaid at the end of its term
//   I10 the CAGR helper's figure is the one the model uses
//   I11 a later loan pays the schedule's rates for the calendar years it runs
//   I12 switching Rent-Then-Buy on changes nothing in Own or Rent
//   I13 net equity is after selling costs; I14 cash below zero is borrowed
//       at the mortgage rate
//
// Run: node integrity.mjs
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = pathToFileURL(join(HERE, '..', 'index.html')).href;

const CHART_STUB = `
window.__charts=[];
class Chart{constructor(c,g){this.config=g;this.data=(g&&g.data)||{datasets:[]};this.options=(g&&g.options)||{};window.__charts.push(this);}update(){}destroy(){}resetZoom(){}}
Chart.register=()=>{};window.Chart=Chart;`;

let pass=0, fail=0;
const check=(name,ok,detail)=>{ console.log((ok?'  PASS  ':'✗ FAIL  ')+name+(detail?'  — '+detail:'')); ok?pass++:fail++; };
const near=(a,b,tol=1)=>Math.abs(a-b)<=tol;
const rel=(a,b,abs=2,frac=1e-6)=>Math.abs(a-b)<=Math.max(abs, Math.abs(b)*frac);

/* ── Independent replay of the documented model ──────────────────────────
   Written from the page's tooltips and standard mortgage maths, not copied
   from script.js. Monthly steps; cash earns (1+rfr)^(1/12)−1 a month; the
   house appreciates at year end; ongoing % items use the start-of-year value. */
function annuity(P, ratePct, months){
  const r = ratePct/100/12;
  return r===0 ? P/months : P*r/(1-Math.pow(1+r,-months));
}
// periods: [{from,to,min,max}] in mortgage years; variant picks the rate
function rateAt(periods, my, variant){
  const p = periods.find(q=>my>=q.from && my<=q.to) || periods[periods.length-1];
  return variant==='low'?p.min : variant==='high'?p.max : (p.min+p.max)/2;
}
// One loan, year by year: {rate, pay, begBal, endBal, interest, principal}.
// The schedule is rates by calendar year, so a loan taken out at the end of
// year `start` pays in its year my the rate of year start+my.
function loanYears(loan, term, periods, variant, years, io, start=0){
  const out=[]; let bal=loan;
  for(let my=1; my<=years; my++){
    const rate = rateAt(periods, my+start, variant);
    const r = rate/100/12;
    let pay = 0, interest=0, principal=0; const beg=bal;
    // Interest-only: interest for the term, then the balance falls due at its end
    if(bal>0.01 && my<=term) pay = io ? bal*r : annuity(bal, rate, (term-my+1)*12);
    for(let m=0;m<12 && pay>0;m++){
      const i = bal*r; interest += i;
      if(!io){ const p = Math.min(pay-i, bal); principal += p; bal -= p; }
    }
    out.push({rate, pay, begBal:beg, endBal:bal, interest, principal});
  }
  return out;
}
function replay(inp, variant){
  const {P, dpPct, term, periods, H, h, rfr, rentM0, ri, ownOngoing, ownOngoingInfl, rentOngoing,
         setup, budget, budgetGrowth, initialCash, rtb, buyYear} = inp;
  const loan = P*(1-dpPct/100), dp = P*dpPct/100;
  const own = loanYears(loan, term, periods, variant, H, inp.io);
  const rtbPrice = P*Math.pow(1+h, buyYear), rtbDp = rtbPrice*dpPct/100;
  const rtbLoan = rtb ? loanYears(rtbPrice-rtbDp, term, periods, variant, H, inp.io, buyYear) : null;
  const rtbSetup = setup*rtbPrice/P;          // $ setup in today's money, scaled to the later price
  const net = (V, bal) => V*(1-inp.sell/100) - bal; // equity if sold: price less selling costs, less loan
  const rfm = Math.pow(1+rfr,1/12)-1;
  const ownOng = y => ownOngoing*Math.pow(1+ownOngoingInfl, y-1);
  const rentAt = y => rentM0*Math.pow(1+ri, y-1);
  const ownReq = y => own[y-1].pay + ownOng(y)/12;
  const rentReq = y => rentAt(y) + rentOngoing/12;
  // Budget and starting cash come from Own and Rent only (Rent-Then-Buy never moves them)
  const budgetAt = y => budget>0 ? budget*Math.pow(1+budgetGrowth, y-1) : Math.max(ownReq(y), rentReq(y));
  const start = initialCash>0 ? initialCash : Math.max(dp+setup, rentM0*12+rentOngoing);
  // Cash earns the risk-free rate; below zero it is borrowed at that year's mortgage rate
  const grow = (c, y) => 1 + (c>=0 ? rfm : own[y-1].rate/100/12);
  let oc = start-dp-setup, rc = start, tc = start, bal = loan, tBal = 0, V = P, tV = 0;
  let oCost = setup, rCost = 0, tCost = 0;
  const rows=[{year:0, ownNet:net(V,bal)+oc, rentNet:rc, ownCash:oc, rentCash:rc, ownCost:oCost, rentCost:0,
               rtbNet:tc, rtbCash:tc, rtbCost:0, budgetM:0}];
  for(let y=1; y<=H; y++){
    const b = budgetAt(y), L = own[y-1];
    for(let m=0;m<12;m++){
      const pay = bal>0.01 ? L.pay : 0;
      const i = bal*L.rate/100/12*(pay>0?1:0);
      if(!inp.io && pay>0) bal -= Math.min(pay-i, bal);
      oc = oc*grow(oc,y) + b - pay - ownOng(y)/12;
      rc = rc*grow(rc,y) + b - rentReq(y);
      oCost += i + ownOng(y)/12;
      rCost += rentReq(y);
      if(rtb){
        if(y<=buyYear){ tc = tc*grow(tc,y) + b - rentReq(y); tCost += rentReq(y); }
        else {
          const TL = rtbLoan[y-buyYear-1];
          const tp = tBal>0.01 ? TL.pay : 0;
          const ti = tBal*TL.rate/100/12*(tp>0?1:0);
          if(!inp.io && tp>0) tBal -= Math.min(tp-ti, tBal);
          tc = tc*grow(tc,y) + b - tp - ownOng(y)/12;
          tCost += ti + ownOng(y)/12;
        }
      }
    }
    if(inp.io && y===inp.term && bal>0.01){ oc -= bal; bal = 0; }
    if(inp.io && rtb && y-buyYear===inp.term && tBal>0.01){ tc -= tBal; tBal = 0; }
    if(rtb && y===buyYear){ tc -= rtbDp+rtbSetup; tCost += rtbSetup; tBal = rtbPrice-rtbDp; tV = rtbPrice; }
    else if(rtb && y>buyYear){ tV *= 1+h; }
    V *= 1+h;
    rows.push({year:y, ownNet:net(V,bal)+oc, rentNet:rc, ownCash:oc, rentCash:rc, ownCost:oCost, rentCost:rCost,
               ownBal:bal, ownPay:L.pay, rate:L.rate,
               rtbNet: rtb ? (y>=buyYear ? net(tV,tBal)+tc : tc) : null, rtbCash: rtb?tc:null, rtbCost: rtb?tCost:null,
               budgetM:b});
  }
  return {rows, own, rtbLoan, start};
}

/* ── Page plumbing ── */
const browser = await chromium.launch({args:['--allow-file-access-from-files']});
const page = await browser.newPage();
page.on('pageerror', e=>console.log('PAGEERROR:', e.message));
await page.route('**/*', route=>{
  const url=route.request().url();
  if(url.startsWith('file://')) return route.continue();
  if(/chart\.umd/.test(url)) return route.fulfill({contentType:'application/javascript', body:CHART_STUB});
  return route.fulfill({contentType:'application/javascript', body:'/* stub */'});
});
await page.goto(PAGE, {waitUntil:'load'});
await page.waitForTimeout(400);
await page.evaluate(()=>{ window.__csv=null; RVOExport.downloadCSV=(fn,txt)=>{ window.__csv=txt; }; });

async function setInputs(vals){
  await page.evaluate((vals)=>{
    const set=(id,v)=>{ const el=document.getElementById(id); el.value=String(v); ['input','change'].forEach(t=>el.dispatchEvent(new Event(t,{bubbles:true}))); };
    Object.entries(vals).forEach(([k,v])=>{
      if(k==='rtbEnabled'){ const el=document.getElementById(k); el.checked=!!v; el.dispatchEvent(new Event('change',{bubbles:true})); }
      else set(k,v);
    });
  }, vals);
  await page.waitForTimeout(120);
}
// Detailed mortgage with the given periods, typed into the page's own rows
async function setSchedule(periods, io){
  await page.evaluate(({periods, io})=>{
    document.querySelector('#mortgageModeGroup .seg-btn[data-val="detailed"]').click();
    if(io){ const r=document.querySelector('#radioIO input'); r.checked=true; r.dispatchEvent(new Event('change',{bubbles:true})); }
    const rows=()=>document.querySelectorAll('#ratePeriodRows .rate-period-row');
    while(rows().length<periods.length) document.getElementById('addRatePeriod').click();
    while(rows().length>periods.length) rows()[rows().length-1].querySelector('.rp-delete').click();
    periods.forEach((p,i)=>{
      const row=rows()[i];
      const set=(sel,v)=>{ const el=row.querySelector(sel); if(!el) return; el.value=String(v); el.dispatchEvent(new Event('change',{bubbles:true})); };
      set('.rp-type',p.type); set('.rp-to',p.toYear); set('.rp-rate',p.rate); set('.rp-min',p.rateMin); set('.rp-max',p.rateMax);
    });
  }, {periods, io});
  await page.waitForTimeout(150);
}
async function grabCsv(table){
  await page.evaluate((table)=>{
    window.__csv=null;
    document.querySelector('.tab-btn[data-table="'+table+'"]')?.click();
    document.getElementById('downloadBtn').click();
  }, table);
  const txt = await page.evaluate(()=>window.__csv);
  const lines = txt.trim().split('\n').filter(l=>!l.startsWith('#'));
  const head = lines[0].split(',');
  return lines.slice(1).map(l=>{ const c=l.split(','); const o={}; head.forEach((h,i)=>o[h]=c[i]===''?null:(isNaN(+c[i])?c[i]:parseFloat(c[i]))); return o; });
}
// Chart datasets for one graph: {label → data[]}, band datasets kept apart
async function grabChart(graph){
  return page.evaluate((graph)=>{
    document.querySelector('.graph-btn[data-graph="'+graph+'"]')?.click();
    const ch = window.__charts[window.__charts.length-1];
    const lines={}, bands={}, labels={};
    ch.data.datasets.forEach(d=>{
      if(d.isBand){ (bands[d.label] = bands[d.label]||[]).push(d.data.slice()); }
      else { lines[d.rvoKey]=d.data.slice(); labels[d.rvoKey]=d.label; }
    });
    return {lines, bands, labels};
  }, graph);
}
async function grabCards(){
  return page.evaluate(()=>({
    initialCash: document.getElementById('kpiInitialCash').textContent,
    budget: document.getElementById('kpiBudgetRange').textContent,
    breakeven: document.getElementById('kpiBreakeven').textContent,
    diff: document.getElementById('kpiDiff').textContent,
    own: [...document.querySelectorAll('#ownSummary .tile')].map(t=>[t.querySelector('.label').textContent, t.querySelector('.value').textContent]),
    rent: [...document.querySelectorAll('#rentSummary .tile')].map(t=>[t.querySelector('.label').textContent, t.querySelector('.value').textContent]),
    rtb: [...document.querySelectorAll('#rtbSummary .tile')].map(t=>[t.querySelector('.label').textContent, t.querySelector('.value').textContent]),
    fmt: (v)=>0,
  }));
}
// The page's card format: compact k/m/b above 1,000, whole dollars below
const fmtFull = async (v)=>(v<=-0.5?'−':'')+'$'+Math.round(Math.abs(v)).toLocaleString('en-AU');
const fmtC = async (v)=>{ const a=Math.abs(v), s=v<=-0.5?'−':'';
  if(a>=1e9) return s+'$'+(a/1e9).toFixed(2)+'b'; if(a>=1e6) return s+'$'+(a/1e6).toFixed(2)+'m';
  if(a>=1e3) return s+'$'+(a/1e3).toFixed(0)+'k'; return fmtFull(v); };
// The model's inputs, read back from the form the way a reader sees them
const state = ()=>page.evaluate(()=>{
  const v=id=>document.getElementById(id).value, n=id=>parseFloat(String(v(id)).replace(/,/g,''))||0;
  const detailed = document.querySelector('#mortgageModeGroup .seg-btn.active').dataset.val==='detailed';
  return {S:{
    propertyPrice:n('propertyPrice'), downPaymentPct:n('downPaymentPct'), mortgageTerm:n('mortgageTerm'), horizon:n('horizon'),
    mortgageRate:n('mortgageRate'), mortgageMode: detailed?'detailed':'simple',
    mortgageType: document.querySelector('input[name="mortgageType"]:checked').value,
    ratePeriods: [...document.querySelectorAll('#ratePeriodRows .rate-period-row')].map(r=>({
      type:r.querySelector('.rp-type').value, toYear: r.querySelector('.rp-to')? +r.querySelector('.rp-to').value : 999,
      rate:+r.querySelector('.rp-rate').value, rateMin:+r.querySelector('.rp-min').value, rateMax:+r.querySelector('.rp-max').value})),
    houseGrowth:n('houseGrowth'), sellingCostPct:n('sellingCostPct'), riskFreeRate:n('riskFreeRate'), rentAmount:n('rentAmount'), rentFreq:v('rentFreq'),
    rentInflation:n('rentInflation'), ownOngoingCost:n('ownOngoingCost'), ownOngoingCostFreq:v('ownOngoingCostFreq'),
    ownOngoingInflation:n('ownOngoingInflation'), rentOngoingCost:n('rentOngoingCost'), rentOngoingCostFreq:v('rentOngoingCostFreq'),
    setupCost:n('setupCost'), monthlyBudget:n('monthlyBudget'), monthlyBudgetIncrease:n('monthlyBudgetIncrease'),
    initialCash:n('initialCash'), rtbEnabled:document.getElementById('rtbEnabled').checked, rtbBuyYear:n('rtbBuyYear'),
    _types:[v('setupCostType'),v('ownOngoingCostType'),v('rentOngoingCostType')],
  }};
});

function inputsFromS(S){
  const toM = (v,f)=> f==='weekly'? v*52/12 : f==='yearly'? v/12 : v;
  const toY = (v,f)=> f==='weekly'? v*52 : f==='monthly'? v*12 : v;
  const norm=[]; let from=1;
  (S.ratePeriods||[]).forEach((p,i,a)=>{
    let to = i===a.length-1 ? S.mortgageTerm : Math.min(S.mortgageTerm, Math.max(from, p.toYear));
    const lo = p.type==='floating'?Math.min(p.rateMin,p.rateMax):p.rate, hi = p.type==='floating'?Math.max(p.rateMin,p.rateMax):p.rate;
    norm.push({from,to,min:lo,max:hi}); from=to+1;
  });
  return {
    P:S.propertyPrice, dpPct:S.downPaymentPct, term:S.mortgageTerm, H:S.horizon,
    periods: S.mortgageMode==='detailed' ? norm : [{from:1,to:S.mortgageTerm,min:S.mortgageRate,max:S.mortgageRate}],
    io: S.mortgageMode==='detailed' && S.mortgageType==='io',
    h:S.houseGrowth/100, rfr:S.riskFreeRate/100, rentM0:toM(S.rentAmount,S.rentFreq), ri:S.rentInflation/100,
    ownOngoing: toY(S.ownOngoingCost,S.ownOngoingCostFreq), ownOngoingInfl:S.ownOngoingInflation/100,
    rentOngoing: toY(S.rentOngoingCost,S.rentOngoingCostFreq),
    setup:S.setupCost, sell:S.sellingCostPct, budget:S.monthlyBudget, budgetGrowth:S.monthlyBudgetIncrease/100,
    initialCash:S.initialCash, rtb:S.rtbEnabled, buyYear:S.rtbBuyYear,
  };
}

// Default page + detailed schedule: yr1–5 fixed 6%, yr6–30 floating 5–9%
const SCHED = [
  {toYear:5,  type:'fixed',    rate:6, rateMin:6, rateMax:6},
  {toYear:30, type:'floating', rate:7, rateMin:5, rateMax:9},
];

async function fullCase(title, setup){
  console.log('\n── '+title+' ──');
  await page.evaluate(()=>window.__RVO.resetAll());
  await page.waitForTimeout(200);
  await setup();
  const {S} = await state();
  const inp = inputsFromS(S);
  const lo = replay(inp,'low'), mid = replay(inp,'mid'), hi = replay(inp,'high');

  // I1 mortgage schedule
  if(!inp.io){
    for(const [nm, R] of [['low',lo],['mid',mid],['high',hi]]){
      const Y = R.own; let bad=[];
      const loan = inp.P*(1-inp.dpPct/100);
      Y.slice(0, Math.min(inp.term, inp.H)).forEach((y,i)=>{
        const ref = annuity(y.begBal, y.rate, (inp.term-i)*12);
        if(!rel(y.pay, ref, 0.01)) bad.push(`yr${i+1} pay ${y.pay} vs ${ref}`);
      });
      if(inp.H>=inp.term){
        const sumP = Y.slice(0,inp.term).reduce((s,y)=>s+y.principal,0);
        if(!near(sumP, loan, 0.05)) bad.push(`Σprincipal ${sumP.toFixed(2)} vs loan ${loan}`);
        if(!near(Y[inp.term-1].endBal, 0, 0.05)) bad.push(`balance at term ${Y[inp.term-1].endBal}`);
      }
      check(`I1 ${nm} path: repayment re-amortises on each rate change; loan fully repaid`, bad.length===0, bad.slice(0,2).join('; '));
    }
  }

  // I2 table == replay (mid)
  const own = await grabCsv('own'), rent = await grabCsv('rent');
  let bad=[];
  own.forEach((r,i)=>{
    const m = mid.rows[i];
    if(!rel(r.Net_Equity, m.ownNet, 2, 1e-7)) bad.push(`own yr${r.Year} net ${r.Net_Equity} vs ${m.ownNet.toFixed(0)}`);
    if(!rel(r.End_Cash, m.ownCash, 2, 1e-7)) bad.push(`own yr${r.Year} cash ${r.End_Cash} vs ${m.ownCash.toFixed(0)}`);
    if(!rel(r.Accum_Cost, m.ownCost, 2, 1e-7)) bad.push(`own yr${r.Year} cost ${r.Accum_Cost} vs ${m.ownCost.toFixed(0)}`);
    if(i>0 && r.Rate_Pct!==null && !near(r.Rate_Pct, m.rate, 0.006)) bad.push(`own yr${r.Year} rate ${r.Rate_Pct} vs ${m.rate}`);
  });
  rent.forEach((r,i)=>{
    const m = mid.rows[i];
    if(!rel(r.Net_Equity, m.rentNet, 2, 1e-7)) bad.push(`rent yr${r.Year} net ${r.Net_Equity} vs ${m.rentNet.toFixed(0)}`);
    if(i>0 && !rel(r.Accum_Cost, m.rentCost, 2, 1e-7)) bad.push(`rent yr${r.Year} cost ${r.Accum_Cost} vs ${m.rentCost.toFixed(0)}`);
  });
  check('I2 own + rent tables == independent replay (mid path), every year', bad.length===0, bad.slice(0,3).join('; '));

  // I3/I4 chart == table; band == replay at low/high
  const map = {netEquity:[['netEquityOwn','Net_Equity',own,'ownNet'],['netEquityRent','Net_Equity',rent,'rentNet']],
               cash:[['cashOwn','End_Cash',own,'ownCash'],['cashRent','End_Cash',rent,'rentCash']],
               cost:[['costOwn','Accum_Cost',own,'ownCost'],['costRent','Accum_Cost',rent,'rentCost']]};
  const bands = {};
  for(const g of Object.keys(map)){
    const ch = await grabChart(g);
    bad=[];
    for(const [key,col,tbl] of map[g]){
      const line = ch.lines[key];
      if(!line){ bad.push(`${key} missing`); continue; }
      tbl.forEach((r,i)=>{ if(r[col]!==null && !near(line[i], r[col], 1)) bad.push(`${key} yr${i} chart ${line[i].toFixed(0)} vs table ${r[col]}`); });
    }
    check(`I3 ${g} chart lines == table`, bad.length===0, bad.slice(0,3).join('; '));
    bad=[];
    for(const [key,,,rk] of map[g]){
      const b = Object.entries(ch.bands).find(([l])=>l===ch.labels[key]+' (band)');
      const lov = lo.rows.map(r=>r[rk]), hiv = hi.rows.map(r=>r[rk]);
      const width = Math.max(...lov.map((v,i)=>Math.abs(hiv[i]-v)));
      bands[key] = {present: !!b, width};
      if(!b){ if(width>0.5) bad.push(`${key}: no band drawn but replay spread is ${width.toFixed(0)}`); continue; }
      const [top, bottom] = b[1];
      top.forEach((v,i)=>{ if(!rel(v, hiv[i], 2, 1e-7)) bad.push(`${key} yr${i} band-top ${v.toFixed(0)} vs high ${hiv[i].toFixed(0)}`); });
      bottom.forEach((v,i)=>{ if(!rel(v, lov[i], 2, 1e-7)) bad.push(`${key} yr${i} band-bottom ${v.toFixed(0)} vs low ${lov[i].toFixed(0)}`); });
    }
    check(`I4 ${g} band edges == replay at low / high rate paths`, bad.length===0, bad.slice(0,3).join('; '));
  }

  // I5 KPI cards
  const cards = await grabCards();
  const last = mid.rows[mid.rows.length-1];
  // Breakeven = the year owning moves ahead for good (ahead from then to the horizon)
  let be=null; for(let i=mid.rows.length-1;i>=1 && mid.rows[i].ownNet>=mid.rows[i].rentNet;i--) be=i;
  const budgets = mid.rows.slice(1).map(r=>r.budgetM);
  const bMin = Math.min(...budgets), bMax = Math.max(...budgets);
  const expBudget = bMax-bMin>0.5 ? `${await fmtC(bMin)}–${await fmtC(bMax)}` : await fmtC(bMin);
  const expDiff = (last.ownNet-last.rentNet>=0?'+':'')+await fmtC(last.ownNet-last.rentNet);
  check('I5 Initial Cash card == replay start cash', cards.initialCash===await fmtC(mid.start), `${cards.initialCash} vs ${await fmtC(mid.start)}`);
  check('I5 Budget card == min–max of the monthly budgets in the table', cards.budget===expBudget, `${cards.budget} vs ${expBudget}`);
  check('I5 Breakeven card == year own moves ahead for good', be===null ? cards.breakeven==='—' : cards.breakeven.endsWith(' '+be), `${cards.breakeven} vs ${be}`);
  check('I5 Breakeven and Equity Difference cards agree (a breakeven means Own ends ahead)',
    (cards.breakeven==='—') === (last.ownNet < last.rentNet), `${cards.breakeven} / ${cards.diff}`);
  check('I5 Equity Difference card == own − rent at horizon', cards.diff===expDiff, `${cards.diff} vs ${expDiff}`);

  // I6 tiles
  const tv = (arr,i)=>arr[i][1];
  bad=[];
  if(tv(cards.own,0)!==await fmtC(last.ownNet)) bad.push(`own net ${tv(cards.own,0)}`);
  if(tv(cards.own,1)!==await fmtC(last.ownCost)) bad.push(`own cost ${tv(cards.own,1)}`);
  if(tv(cards.own,3)!==await fmtC(last.ownCash)) bad.push(`own cash ${tv(cards.own,3)} vs ${last.ownCash}`);
  if(tv(cards.own,5)!==await fmtC(last.ownBal)) bad.push(`own balance ${tv(cards.own,5)}`);
  if(tv(cards.rent,0)!==await fmtC(last.rentNet)) bad.push(`rent net ${tv(cards.rent,0)}`);
  if(tv(cards.rent,1)!==await fmtC(last.rentCost)) bad.push(`rent cost ${tv(cards.rent,1)}`);
  check('I6 summary tiles == final-year row', bad.length===0, bad.join('; '));
  // Repayment tile: should cover every repayment the chart's band can reach
  const pays = R=>R.own.slice(0,Math.min(inp.term,inp.H)).map(y=>y.pay).filter(p=>p>0);
  const allPays = [...pays(lo),...pays(mid),...pays(hi)];
  const spanMin = Math.min(...allPays), spanMax = Math.max(...allPays);
  const tile = tv(cards.own,4);
  const expTile = (spanMax-spanMin)>0.5 ? `${await fmtFull(spanMin)}–${await fmtFull(spanMax)}` : await fmtFull(spanMin);
  check('I6 Monthly Mortgage tile spans every repayment the band reaches', tile.startsWith(expTile), `${tile} vs ${expTile}/mo`);

  return {inp, lo, mid, hi, bands, S};
}

// ═══ Case F1: floating schedule, automatic budget (the page default) ═══
const F1 = await fullCase('F1 floating 6% fixed → 5–9% floating, automatic budget', ()=>setSchedule(SCHED));
{
  // I7: with an automatic budget, Rent's band is the owner's extra repayment
  // (high path − low path) that the renter banks at the risk-free rate.
  const {inp, lo, hi} = F1;
  const rfm = Math.pow(1+inp.rfr,1/12)-1;
  let fv = 0;
  for(let y=1;y<=inp.H;y++) for(let m=0;m<12;m++) fv = fv*(1+rfm) + (hi.rows[y].budgetM - lo.rows[y].budgetM);
  const w = hi.rows[inp.H].rentNet - lo.rows[inp.H].rentNet;
  check('I7 auto budget: Rent band width == FV of the budget gap between the high and low paths',
    rel(w, fv, 2, 1e-7), `band ${w.toFixed(0)} vs FV of budget gap ${fv.toFixed(0)}`);
  console.log(`        (Rent band at yr ${inp.H}: ${lo.rows[inp.H].rentNet.toFixed(0)} – ${hi.rows[inp.H].rentNet.toFixed(0)}; `+
              `Own band: ${hi.rows[inp.H].ownNet.toFixed(0)} – ${lo.rows[inp.H].ownNet.toFixed(0)})`);
}

// ═══ Case F2: same schedule, a budget you set ═══
const F2 = await fullCase('F2 floating schedule, fixed $5,500/mo budget', async()=>{ await setSchedule(SCHED); await setInputs({monthlyBudget:5500}); });
check('I7 set budget: the floating rate leaves Rent with no band on any graph',
  !F2.bands.netEquityRent.present && !F2.bands.cashRent.present && !F2.bands.costRent.present
  && F2.bands.netEquityRent.width < 0.5,
  `rent band present: ${F2.bands.netEquityRent.present}/${F2.bands.cashRent.present}/${F2.bands.costRent.present}, replay spread ${F2.bands.netEquityRent.width.toFixed(2)}`);

// ═══ Case F3: horizon shorter than the fixed period's end, then 40y horizon > term ═══
await fullCase('F3 floating schedule, horizon 40 > term 30', async()=>{ await setSchedule(SCHED); await setInputs({horizon:40}); });
await fullCase('F4 simple mode, 6% flat (no band expected)', async()=>{});
await fullCase('F5 floating whole term 3–8%, 25y term, 15y horizon', async()=>{
  await setInputs({mortgageTerm:25, horizon:15});
  await setSchedule([{toYear:25,type:'floating',rate:5,rateMin:3,rateMax:8}]);
});

// ═══ Case F6: rent-then-buy on a floating schedule ═══
{
  const R = await fullCase('F6 floating schedule + rent-then-buy at year 5', async()=>{ await setSchedule(SCHED); await setInputs({rtbEnabled:true, rtbBuyYear:5}); });
  const rtb = await grabCsv('rtb');
  let bad=[];
  rtb.forEach((r,i)=>{ const m=R.mid.rows[i]; if(!rel(r.Net_Equity, m.rtbNet, 2, 1e-7)) bad.push(`yr${r.Year} net ${r.Net_Equity} vs ${m.rtbNet.toFixed(0)}`); });
  check('I8 RTB table == replay (mid path)', bad.length===0, bad.slice(0,3).join('; '));
  const ch = await grabChart('netEquity');
  bad=[];
  rtb.forEach((r,i)=>{ if(!near(ch.lines.netEquityRTB[i], r.Net_Equity, 1)) bad.push(`yr${i} chart ${ch.lines.netEquityRTB[i]} vs ${r.Net_Equity}`); });
  check('I8 RTB chart line == RTB table', bad.length===0, bad.slice(0,3).join('; '));
  const b = Object.entries(ch.bands).find(([l])=>l===ch.labels.netEquityRTB+' (band)');
  bad=[];
  if(b){ b[1][0].forEach((v,i)=>{ if(!rel(v,R.hi.rows[i].rtbNet,2,1e-7)) bad.push(`yr${i} top ${v.toFixed(0)} vs ${R.hi.rows[i].rtbNet.toFixed(0)}`); });
         b[1][1].forEach((v,i)=>{ if(!rel(v,R.lo.rows[i].rtbNet,2,1e-7)) bad.push(`yr${i} bottom ${v.toFixed(0)} vs ${R.lo.rows[i].rtbNet.toFixed(0)}`); }); }
  else bad.push('no RTB band');
  check('I8 RTB band edges == replay at low / high', bad.length===0, bad.slice(0,3).join('; '));
  const inp=R.inp, yrs=Math.min(inp.term, inp.H-inp.buyYear);
  const pays=[R.lo,R.mid,R.hi].flatMap(x=>x.rtbLoan.slice(0,yrs).map(y=>y.pay)).filter(p=>p>0);
  const cards = await grabCards();
  const exp = `${await fmtFull(Math.min(...pays))}–${await fmtFull(Math.max(...pays))}`;
  const y6 = rtb.find(r=>r.Year===6);
  check('I11 RTB loan (bought end of yr 5) pays the schedule\'s yr-6 rate, not its yr-1 fixed rate',
    y6 && near(y6.Rate_Pct, 7, 0.001), `yr6 rate ${y6 && y6.Rate_Pct}% (schedule: yr1–5 fixed 6%, then floating 5–9%, mid 7%)`);
  check('I8 RTB Monthly Mortgage tile spans every repayment the band reaches', cards.rtb[5][1].startsWith(exp), `${cards.rtb[5][1]} vs ${exp}/mo`);
}

// ═══ Case F7: interest-only past the term ═══
{
  const R = await fullCase('F7 interest-only, 6% fixed, term 30, horizon 40', async()=>{
    await setInputs({horizon:40});
    await setSchedule([{toYear:30,type:'fixed',rate:6,rateMin:6,rateMax:6}], true);
  });
  const own = await grabCsv('own');
  const y30 = own.find(r=>r.Year===30), y31 = own.find(r=>r.Year===31);
  check('I9 interest-only: balance repaid from cash with the last payment of the term',
    near(y30.Principal_Left,0,1) && near(y30.Principal_Exp,640000,1) && near(y31.Interest_Exp,0,1) && own[29].Principal_Left===640000,
    `yr29 left ${own[29].Principal_Left}; yr30 principal ${y30.Principal_Exp}, left ${y30.Principal_Left}; yr31 interest ${y31.Interest_Exp}`);
  let bad=[];
  own.slice(1).forEach(r=>{ const rhs=r.Beg_Cash+r.Ann_Budget+r.Interest_Inc-(r.Principal_Exp+r.Interest_Exp+r.Ongoing_Exp);
    if(!near(r.End_Cash,rhs,5)) bad.push(`yr${r.Year}: ${r.End_Cash} vs ${rhs.toFixed(0)}`); });
  check('I9 interest-only: own cash identity holds every year, balloon year included', bad.length===0, bad.slice(0,3).join('; '));
}

// ═══ Case F11: switching Rent-Then-Buy on leaves Own and Rent untouched ═══
{
  console.log('\n── F11 Rent-Then-Buy on/off vs Own and Rent ──');
  for(const [lbl, extra] of [['automatic budget and cash', {}], ['floating schedule', 'float'], ['set budget, set cash', {monthlyBudget:4200, initialCash:150000}]]){
    await page.evaluate(()=>window.__RVO.resetAll());
    if(extra==='float') await setSchedule(SCHED); else await setInputs(extra);
    const offOwn = await grabCsv('own'), offRent = await grabCsv('rent');
    const offCards = await grabCards();
    await setInputs({rtbEnabled:true, rtbBuyYear:8});
    const onOwn = await grabCsv('own'), onRent = await grabCsv('rent');
    const onCards = await grabCards();
    const same = JSON.stringify(offOwn)===JSON.stringify(onOwn) && JSON.stringify(offRent)===JSON.stringify(onRent)
      && offCards.initialCash===onCards.initialCash && offCards.budget===onCards.budget && offCards.breakeven===onCards.breakeven && offCards.diff===onCards.diff;
    check(`I12 ${lbl}: Own + Rent tables and the KPI cards are identical with Rent-Then-Buy on`, same,
      `cash ${offCards.initialCash}→${onCards.initialCash}, budget ${offCards.budget}→${onCards.budget}, own yr30 ${offOwn[offOwn.length-1].Net_Equity}→${onOwn[onOwn.length-1].Net_Equity}`);
  }
}

// ═══ Case F12: selling costs and borrowed cash, stated directly ═══
{
  console.log('\n── F12 selling costs; cash below zero ──');
  await page.evaluate(()=>window.__RVO.resetAll());
  const own = await grabCsv('own');
  const exp0 = 192000 - 32000 - 800000*0.025 ; // start cash − setup − selling cost on today's price
  check('I13 year-0 Own net equity = starting cash − setup − selling cost (buy and sell at once)',
    near(own[0].Net_Equity, exp0, 1) && near(own[0].House_Equity, 800000*0.975-640000, 1), `net ${own[0].Net_Equity} vs ${exp0}; house ${own[0].House_Equity}`);
  await setInputs({monthlyBudget:3000}); // below the ~$4,337 own cost: Own runs a shortfall
  const o2 = await grabCsv('own');
  const neg = o2.find(r=>r.Year>0 && r.Beg_Cash<0);
  // Replay that year month by month at each candidate rate
  const yearInterest = (r)=>{ const m=(neg.Ann_Budget-neg.Principal_Exp-neg.Interest_Exp-neg.Ongoing_Exp)/12; let c=neg.Beg_Cash, t=0; for(let i=0;i<12;i++){ t+=c*r; c=c*(1+r)+m; } return t; };
  const at6 = neg ? yearInterest(0.06/12) : 0, atRfr = neg ? yearInterest(Math.pow(1.045,1/12)-1) : 0;
  check('I14 cash below zero pays the mortgage rate (6%), not the 4.5% risk-free rate',
    neg && near(neg.Interest_Inc, at6, 2),
    neg ? `yr${neg.Year}: interest ${neg.Interest_Inc} vs ${at6.toFixed(0)} at 6% (${atRfr.toFixed(0)} at 4.5%)` : 'no shortfall year');
}

// ═══ Case F9: owning leads early, then renting pulls ahead ═══
await fullCase('F9 low growth, high cash return: Own ahead in year 1, behind at the horizon', async()=>{
  await setInputs({houseGrowth:2, riskFreeRate:6, mortgageRate:4, setupCost:0, rentInflation:0});
});

// ═══ Case F10: the CAGR helper's figure is the one the model runs on ═══
{
  console.log('\n── F10 CAGR helper → house growth ──');
  await page.evaluate(()=>window.__RVO.resetAll());
  const applied = await page.evaluate(()=>{
    const years=[...document.querySelectorAll('#cagrRows .cagr-year')], prices=[...document.querySelectorAll('#cagrRows .cagr-price')];
    years[0].value='2015'; prices[0].value='500000'; years[1].value='2025'; prices[1].value='779500';
    document.getElementById('cagrCalc').click();
    return {shown: document.getElementById('cagrResult').textContent, slider: document.getElementById('houseGrowth').value};
  });
  await page.waitForTimeout(120);
  const own = await grabCsv('own');
  const cagr = (Math.pow(779500/500000, 1/10)-1)*100;
  const g = +cagr.toFixed(2);
  check('I10 CAGR result is applied to the model unrounded by the slider',
    +applied.slider===g && near(own[1].Prop_Value, 800000*(1+g/100), 1),
    `CAGR ${cagr.toFixed(4)}%, shown "${applied.shown}", slider ${applied.slider}, yr1 value ${own[1].Prop_Value} vs ${(800000*(1+g/100)).toFixed(0)}`);
}

// ═══ Case F8: interest-only, 10y term, rent-then-buy at year 5, 20y horizon ═══
{
  const R = await fullCase('F8 interest-only 10y term, floating, rent-then-buy at year 5, horizon 20', async()=>{
    await setInputs({mortgageTerm:10, horizon:20, rtbEnabled:true, rtbBuyYear:5});
    await setSchedule([{toYear:3,type:'fixed',rate:6,rateMin:6,rateMax:6},{toYear:10,type:'floating',rate:7,rateMin:5,rateMax:9}], true);
  });
  const rtb = await grabCsv('rtb');
  let bad=[];
  rtb.forEach((r,i)=>{ const m=R.mid.rows[i]; if(!rel(r.Net_Equity, m.rtbNet, 2, 1e-7)) bad.push(`yr${r.Year} net ${r.Net_Equity} vs ${m.rtbNet.toFixed(0)}`); });
  check('I8 RTB table == replay (interest-only, balloon at yr 15)', bad.length===0, bad.slice(0,3).join('; '));
  const y15 = rtb.find(r=>r.Year===15);
  check('I9 RTB interest-only balance repaid at its own term end (yr 15)', near(y15.Principal_Left,0,1), `yr15 left ${y15.Principal_Left}`);
}

await browser.close();
console.log(`\nrentvsownhouse integrity audit: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
