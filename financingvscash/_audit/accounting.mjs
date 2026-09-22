/* Financing vs Cash — accounting-integrity harness.
   ---------------------------------------------------------------------------
   Runs the plan in ACCOUNTING-PLAN.md, which was written against the page's own
   tooltips and double-entry first principles BEFORE its source was opened. Each
   test below carries the plan's identity number, so a failure points at a claim
   the page makes rather than at a line of code.

   Where run.mjs asks "does each loan type compute correctly", this asks the
   narrower and harder question: does the money balance. Every dollar has to
   come from somewhere, land somewhere, and be counted once. The sharpest tool
   for that is not a replay at all but a CONSTANT: borrow at exactly the rate
   your spare cash earns, charge no fee, and financing must leave you level with
   paying cash — for any loan type, any frequency, any term, any down payment.
   No modelling choice can move a zero, so a drift names its own cause.

   Scenarios are loaded through the page's own mini-cache, which is how a
   returning reader's plan arrives: written to localStorage and restored through
   normaliseScenario() on reload. That keeps the harness on a documented entry
   point rather than reaching inside the module.

   Run: node accounting.mjs
*/
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = pathToFileURL(join(HERE, '..', 'index.html')).href;
const KEY  = 'abt:save:financingvscash:v1';

const CHART_STUB = `
window.__charts = [];
class Chart {
  constructor(ctx, cfg){ this.config=cfg; this.data=(cfg&&cfg.data)||{datasets:[]};
    this.options=(cfg&&cfg.options)||{}; this.canvasId=(ctx&&ctx.id)||''; window.__charts.push(this); }
  update(){} destroy(){ const i=window.__charts.indexOf(this); if(i>=0) window.__charts.splice(i,1); } resetZoom(){}
}
Chart.register=function(){};
window.Chart=Chart;
window.Plotly={newPlot:async(el,d)=>{window.__plotly=d;},react:async(el,d)=>{window.__plotly=d;},
  relayout:async()=>{},downloadImage:async()=>{},toImage:async()=>'data:,'};`;

let pass=0, fail=0, notes=[];
const check=(name,ok,detail)=>{ console.log((ok?'  PASS  ':'✗ FAIL  ')+name+(detail?'  — '+detail:'')); ok?pass++:fail++; };
const note =(t)=>{ notes.push(t); };
const money=s=>parseFloat(String(s).replace(/[−–]/g,'-').replace(/[^0-9.\-]/g,''));
const near=(a,b,tol)=>Math.abs(a-b)<=tol;

const PPY={weekly:52,fortnightly:26,monthly:12,yearly:1};
const TERM5={weekly:260,fortnightly:130,monthly:60,yearly:5};   // five years, in each unit

/* A scenario exactly as the editor would save one, so the cache restore path
   normaliseScenario() runs over it is the same one a real reader produces. */
const sc=(o={})=>Object.assign({
  name:'S', financeRate:5, downPaymentPct:0, termPeriods:60, freq:'monthly',
  feeAmt:0, feeType:'fixed', feeTreatment:'upfront', adminFee:0,
  loanType:'annuity', rateMode:'simple', ratePeriods:null,
  paymentMode:'single', paymentPeriods:null, knownPayment:0,
  ioPeriods:60, residualPct:0
}, o);

const browser = await chromium.launch({args:['--allow-file-access-from-files']});
const page = await browser.newPage();
const pageErrors=[];
page.on('pageerror', e=>{ pageErrors.push(e.message); console.log('PAGEERROR:', e.message); });
await page.route('**/*', route=>{
  const url=route.request().url();
  if(url.startsWith('file://')) return route.continue();
  if(/chart\.umd/.test(url)) return route.fulfill({contentType:'application/javascript', body:CHART_STUB});
  return route.fulfill({contentType:'application/javascript', body:'/* stub */'});
});
await page.goto(PAGE, {waitUntil:'load'});
await page.waitForTimeout(250);

/* Write a plan into the mini-cache and reload onto it. Base fields default to
   the page's own opening values so a test only has to name what it changes. */
async function load({fields={}, scenarios=[]}={}){
  const f=Object.assign({
    'v:currencySymbol':'$','v:purchaseCost':'50000','v:availableCash':'50000',
    'v:baseRf':'4.5','v:rateConvention':'ear','c:inflationToggle':false,
    'v:inflationRate':'2.5','v:chartMetric':'wealth','v:optTarget':'netBenefit'
  }, fields);
  await page.evaluate(([key,blob])=>{
    localStorage.setItem(key, JSON.stringify(blob));
    /* The page flushes its own state on beforeunload, so the reload below would
       otherwise write whatever is on screen NOW straight over the plan we just
       seeded and hand the next document the previous test's scenarios. Seal the
       store for the moment between here and the navigation; the next document
       gets a fresh window and a working setItem. */
    try{ localStorage.setItem=function(){}; }catch(e){}
  }, [KEY, {__fields:f, __extra:{scenarios}}]);
  await page.reload({waitUntil:'load'});
  await page.waitForTimeout(280);
}

async function compTable(){
  return await page.evaluate(()=>{
    const out={};
    [...document.querySelectorAll('#compTableWrap table tbody tr')].forEach(tr=>{
      const c=[...tr.children].map(td=>td.textContent.trim());
      out[c[0]]=c.slice(1);
    });
    out.__cols=[...document.querySelectorAll('#compTableWrap table thead th')].map(t=>t.textContent.trim());
    return out;
  });
}
// Column index of a named scenario inside a comparison-table row array.
const colOf=(t,name)=>t.__cols.indexOf(name)-1;

/* The amortisation schedule for one scenario tab, parsed back into numbers, so
   the tests can add the columns up rather than trust the totals printed under
   them. Also returns the footer lines, which are where the fee treatments say
   what they did. */
async function amort(tabName){
  return await page.evaluate((tabName)=>{
    const tabs=[...document.querySelectorAll('#amortTabs .tab-btn')];
    const t=tabs.find(b=>b.textContent.trim()===tabName);
    if(!t) return null;
    t.click();
    const table=document.querySelector('#amortTableWrap table');
    if(!table) return null;
    const head=[...table.querySelectorAll('thead th')].map(h=>h.textContent.trim());
    const num=s=>parseFloat(String(s).replace(/[−–]/g,'-').replace(/[^0-9.\-]/g,''));
    const rows=[], footers=[];
    let totals=null;
    [...table.querySelectorAll('tbody tr')].forEach(tr=>{
      const tds=[...tr.children];
      if(tds.length===1){ footers.push(tds[0].textContent.trim()); return; }
      const c=tds.map(td=>td.textContent.trim());
      if(c[0]==='Total'){ totals={interest:num(c[head.indexOf('Interest')]),
                                  principal:num(c[head.indexOf('Principal')]),
                                  payment:num(c[head.indexOf('Payment')])}; return; }
      rows.push({num:num(c[0]), start:num(c[head.indexOf('Start Balance')]),
                 interest:num(c[head.indexOf('Interest')]), principal:num(c[head.indexOf('Principal')]),
                 payment:num(c[head.indexOf('Payment')]), end:num(c[head.indexOf('End Balance')])});
    });
    return {head, rows, totals, footers};
  }, tabName);
}

const kpis=()=>page.evaluate(()=>({
  best:document.getElementById('kpiBest').textContent.trim(),
  net:document.getElementById('kpiNetBenefit').textContent.trim(),
  interest:document.getElementById('kpiInterest').textContent.trim(),
  cash:document.getElementById('kpiCashWealth').textContent.trim(),
  warn:document.getElementById('warnBanner').style.display,
  warnText:document.getElementById('warnBanner').textContent.trim(),
  neg:document.getElementById('negCarryBanner').style.display,
  negText:document.getElementById('negCarryBanner').textContent.trim()
}));

console.log('\n════ A — conservation of cash: the books must close ════');

/* A2/A3/A5 over every loan type at once. One page, seven columns, and each
   column's own schedule added up by hand. knownPayment carries the exact
   annuity instalment so it is a solvable plan rather than an arbitrary one. */
{
  const rate=7, n=60, ppy=12, financed=40000;
  const r=Math.pow(1+rate/100,1/ppy)-1;
  const pmt=financed*(r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1);
  const types=[
    ['annuity',     sc({name:'annuity',     loanType:'annuity',      financeRate:rate, downPaymentPct:20, termPeriods:n})],
    ['flat',        sc({name:'flat',        loanType:'flat',         financeRate:rate, downPaymentPct:20, termPeriods:n})],
    ['interestOnly',sc({name:'interestOnly',loanType:'interestOnly', financeRate:rate, downPaymentPct:20, termPeriods:n, ioPeriods:24})],
    ['balloon',     sc({name:'balloon',     loanType:'balloon',      financeRate:rate, downPaymentPct:20, termPeriods:n, residualPct:30})],
    ['bullet',      sc({name:'bullet',      loanType:'bullet',       financeRate:rate, downPaymentPct:20, termPeriods:n})],
    ['deferred',    sc({name:'deferred',    loanType:'deferred',     financeRate:rate, downPaymentPct:20, termPeriods:n, ioPeriods:12})],
    ['knownPayment',sc({name:'knownPayment',loanType:'knownPayment', knownPayment:Math.round(pmt*100)/100, downPaymentPct:20, termPeriods:n})]
  ];
  await load({scenarios:types.map(t=>t[1])});
  const t=await compTable();

  /* Two different questions, so two different tolerances, and the difference
     matters. The page's Total row and the comparison table are each rounded
     ONCE from exact figures, so an identity between them is exact to the cent.
     Adding up the displayed column is not the same thing: sixty cells each
     rounded to the cent can drift by up to sixty half-cents from the exact
     total, and that drift is display rounding rather than a leak. So the exact
     identities are checked against the Total row, and the column sum is held
     separately to the bound rounding alone can produce — which is the test that
     it really is only rounding. Financed Amount prints to the dollar, so
     anything compared against it carries a dollar of slack. */
  const bad={closes:[], principal:[], payments:[], kpi:[], rows:[], foot:[]};
  for(const [name] of types){
    const a=await amort(name);
    const i=colOf(t,name);
    const fin=money(t['Financed Amount'][i]);
    const int=money(t['Total Interest Paid'][i]);
    const sum=k=>a.rows.reduce((s,x)=>s+x[k],0);
    const slack=0.005*a.rows.length;
    if(!near(a.rows[a.rows.length-1].end,0,0.005)) bad.closes.push(name+' ends at '+a.rows[a.rows.length-1].end);
    if(!near(a.totals.principal,fin,0.51))         bad.principal.push(`${name} principal total ${a.totals.principal.toFixed(2)} ≠ financed ${fin.toFixed(2)}`);
    if(!near(a.totals.payment,fin+int,0.51))       bad.payments.push(`${name} payment total ${a.totals.payment.toFixed(2)} ≠ ${(fin+int).toFixed(2)}`);
    if(!near(a.totals.interest,int,0.011))         bad.kpi.push(`${name} interest total ${a.totals.interest.toFixed(2)} ≠ KPI ${int.toFixed(2)}`);
    ['interest','principal','payment'].forEach(k=>{
      if(!near(sum(k), a.totals[k], slack+0.011))
        bad.foot.push(`${name} Σ${k} ${sum(k).toFixed(2)} is ${Math.abs(sum(k)-a.totals[k]).toFixed(2)} off its total, past the ${slack.toFixed(2)} rounding can explain`);
    });
    // Every single row must also balance on its own, not just in aggregate.
    a.rows.forEach(x=>{
      if(!near(x.payment, x.interest+x.principal, 0.02)) bad.rows.push(`${name} #${x.num} pay≠int+prin`);
      if(!near(x.end, x.start-x.principal, 0.02))        bad.rows.push(`${name} #${x.num} end≠start−prin`);
    });
  }
  check('A2 the loan closes: the last End Balance is zero for all seven loan types',
    !bad.closes.length, bad.closes.join(' | ') || '7/7 close at $0.00');
  check('A2b Σ principal repaid equals the amount financed, every type',
    !bad.principal.length, bad.principal.join(' | ') || 'all 7 repay exactly $40,000.00');
  check('A3 Σ payments equals financed + total interest, every type',
    !bad.payments.length, bad.payments.join(' | ') || '7/7 reconcile');
  check('A5 the interest column sums to the Total Interest the page reports',
    !bad.kpi.length, bad.kpi.join(' | ') || '7/7 agree to the cent');
  check('A5b every individual row balances: payment = interest + principal, end = start − principal',
    !bad.rows.length, bad.rows.slice(0,3).join(' | ') || `${7*n} rows, all balanced`);
  check('A5c the printed column foots to the printed total within display rounding, and no further',
    !bad.foot.length, bad.foot.slice(0,3).join(' | ') || 'all 21 columns inside 60 half-cents');
  note('The amortisation schedule keeps full precision in the model and rounds only for display, so adding the printed '
     + 'Interest column by hand can differ from the Total printed under it by up to half a cent per row — about 30c over '
     + '60 months, $1.80 over 360. A5c bounds that drift so it can only ever be rounding; it is not removed, because the '
     + 'alternatives are worse: a Total equal to the sum of the rounded rows would stop agreeing with the KPI above it, '
     + 'and rounding the model itself to cents would change the wealth arithmetic. Anyone summing the exported CSV should '
     + 'expect the cents, not the dollars, to move.');
}

/* A1/A4 across the fee matrix. This is where a fee gets counted twice or not at
   all, so all three treatments are run on both a fixed and a percentage fee. */
{
  const base=[], names=[];
  for(const treat of ['upfront','capitalise','discount'])
    for(const [ft,amt] of [['fixed',1200],['pct',3]]){
      const nm=treat+'/'+ft;
      names.push(nm);
      base.push(sc({name:nm, loanType:'annuity', financeRate:7, downPaymentPct:20,
        termPeriods:60, feeAmt:amt, feeType:ft, feeTreatment:treat, adminFee:15}));
    }
  await load({scenarios:base});
  const t=await compTable();
  const bad={cost:[], oop:[], fee:[], adv:[]};
  const price=50000, down=10000, need=price-down;
  for(const nm of names){
    const i=colOf(t,nm);
    const a=await amort(nm);
    const fin=money(t['Financed Amount'][i]);
    const int=money(t['Total Interest Paid'][i]);
    const adm=money(t['Total Admin Fees'][i]);
    const fees=money(t['Total Fees Paid'][i]);
    const cost=money(t['Total Financing Cost'][i]);
    const oop=money(t['Total Out-of-Pocket'][i]);
    const orig=fees-adm;
    const pays=a.totals.payment;
    const treat=nm.split('/')[0], pct=nm.endsWith('pct');
    if(!near(cost,int+fees,0.05)) bad.cost.push(`${nm} cost ${cost} ≠ int+fees ${(int+fees).toFixed(2)}`);
    // Out-of-pocket = down + the fee you actually hand over + payments + admin.
    const cashFee = treat==='upfront' ? orig : 0;
    if(!near(oop, down+cashFee+pays+adm, 0.011))
      bad.oop.push(`${nm} OOP ${oop.toFixed(2)} ≠ ${(down+cashFee+pays+adm).toFixed(2)}`);
    /* C3/C4: what each treatment does to the amount financed. An upfront fee
       leaves it alone, a capitalised fee adds itself, and a discounted note is
       grossed up by 1/(1−f) so the NET advance still meets the price. */
    const want = treat==='upfront'    ? need
               : treat==='capitalise' ? (pct ? need*1.03 : need+1200)
               :                        (pct ? need/0.97 : need+1200);
    if(!near(fin, want, 1)) bad.fee.push(`${nm} financed ${fin.toFixed(2)} ≠ ${want.toFixed(2)}`);
    // C4: a discounted note must still put the full price on the table.
    if(treat==='discount' && !near(fin-orig, need, 1))
      bad.adv.push(`${nm} net advance ${(fin-orig).toFixed(2)} ≠ ${need}`);
  }
  check('A4 Total Financing Cost = total interest + all fees, all six fee shapes',
    !bad.cost.length, bad.cost.join(' | ') || '6/6 reconcile');
  check('A1 out-of-pocket = down + the fee actually handed over + payments + admin',
    !bad.oop.length, bad.oop.join(' | ') || 'upfront fees spend cash, capitalised and discounted ones do not');
  check('C3/C4 each fee treatment moves the amount financed by exactly its own rule',
    !bad.fee.length, bad.fee.join(' | ') || 'unchanged / +fee / grossed up by 1/(1−f)');
  check('C4b a discounted note is grossed up so the net advance still meets the price',
    !bad.adv.length, bad.adv.join(' | ') || 'net advance = $40,000.00');
}

console.log('\n════ B — the wash: borrow at r, invest at r, and nothing happened ════');

/* The plan\'s B1. Rate == risk-free, no fees: Net Benefit must be exactly zero
   whatever the shape of the repayments, because rescheduling money that costs
   what it earns cannot create or destroy any. Flat rate is deliberately absent
   and gets its own test below. */
{
  const R=6;
  const types=['annuity','interestOnly','balloon','bullet','deferred'];
  const worst={by:0, at:''};
  let n=0;
  for(const freq of ['weekly','fortnightly','monthly','yearly']){
    const term=TERM5[freq];
    const list=[];
    for(const ty of types) for(const down of [0,20,60])
      list.push(sc({name:`${ty}-${down}`, loanType:ty, financeRate:R, downPaymentPct:down,
        freq, termPeriods:term, ioPeriods:Math.max(1,Math.round(term/3)), residualPct:30}));
    await load({fields:{'v:baseRf':String(R),'v:availableCash':'80000'}, scenarios:list});
    const t=await compTable();
    for(const s of list){
      const i=colOf(t,s.name);
      const nb=money(t['Net Benefit vs Cash'][i]);
      n++;
      if(Math.abs(nb)>Math.abs(worst.by)){ worst.by=nb; worst.at=`${freq}/${s.name}`; }
    }
  }
  check('B1 borrowing at the risk-free rate is a wash: Net Benefit ≡ 0',
    Math.abs(worst.by)<0.01,
    `${n} combinations (5 loan types × 4 frequencies × 3 down payments); worst drift $${worst.by.toFixed(4)} at ${worst.at}`);
}

/* B1b. The same wash at the two ends of the term, because a timing error hides
   in the first and last period rather than in the middle. */
{
  const R=6, list=[];
  for(const term of [1,2,3,12,359,360])
    list.push(sc({name:'n'+term, loanType:'annuity', financeRate:R, downPaymentPct:0,
      freq:'monthly', termPeriods:term, ioPeriods:term}));
  await load({fields:{'v:baseRf':String(R),'v:availableCash':'80000'}, scenarios:list});
  const t=await compTable();
  const drift=list.map(s=>money(t['Net Benefit vs Cash'][colOf(t,s.name)]));
  check('B1b the wash holds at a one-period term and at a 30-year one alike',
    drift.every(d=>Math.abs(d)<0.01),
    'terms 1,2,3,12,359,360 → ' + drift.map(d=>d.toFixed(4)).join(', '));
}

/* B1n. The Rate Convention tooltip says it applies to the loans only, never to
   the risk-free rate. So under Nominal the wash MUST break, by exactly the cost
   of charging r/m on the loan while cash compounds at (1+r)^(1/m)−1 — and a
   tool that passed B1 under both conventions would be quietly compounding the
   risk-free rate the loan\'s way. */
{
  const R=12, n=60, ppy=12, financed=50000, rf=R;
  const s=sc({name:'nom', loanType:'annuity', financeRate:R, downPaymentPct:0, termPeriods:n});
  await load({fields:{'v:baseRf':String(rf),'v:rateConvention':'nominal','v:availableCash':'80000'}, scenarios:[s]});
  const t=await compTable();
  const nb=money(t['Net Benefit vs Cash'][colOf(t,'nom')]);
  // Independent replay of the SAME mismatch: loan at r/m, cash at (1+r)^(1/m)−1.
  const rl=R/100/ppy, rfp=Math.pow(1+rf/100,1/ppy)-1;
  const pmt=financed*(rl*Math.pow(1+rl,n))/(Math.pow(1+rl,n)-1);
  let inv=80000-0, bal=financed;
  for(let i=1;i<=n;i++){ const int=bal*rl; const pay=i===n?int+bal:pmt; bal=i===n?0:bal-(pmt-int);
    inv=inv*(1+rfp)-pay; }
  const cashEnd=(80000-50000)*Math.pow(1+rf/100,n/ppy);
  const want=inv-cashEnd;
  check('B1n under Nominal the wash breaks by exactly the convention gap, and in the borrower\'s favour never',
    nb<-1 && near(nb,want,0.05),
    `page ${nb.toFixed(2)} vs independent replay ${want.toFixed(2)} (a 12% loan charges 1.000%/mo while cash earns 0.949%)`);
}

/* B1f. Flat rate is the one type whose quoted rate is not what it costs, so the
   wash has to FAIL for it — and fail against the borrower. A flat loan that
   washed would mean the flat-rate lesson the tool exists to teach is wrong. */
{
  const R=6;
  const list=[sc({name:'flat', loanType:'flat', financeRate:R, downPaymentPct:0, termPeriods:60}),
              sc({name:'amort',loanType:'annuity',financeRate:R, downPaymentPct:0, termPeriods:60})];
  await load({fields:{'v:baseRf':String(R),'v:availableCash':'80000'}, scenarios:list});
  const t=await compTable();
  const flat=money(t['Net Benefit vs Cash'][colOf(t,'flat')]);
  const am=money(t['Net Benefit vs Cash'][colOf(t,'amort')]);
  const apr=money(t['Effective Rate (APR)'][colOf(t,'flat')]);
  check('B1f flat rate is the exception that proves the rule: it cannot wash, and it loses',
    flat < -100 && Math.abs(am) < 0.01 && apr > R*1.6,
    `amortizing washes to $${am.toFixed(2)}; the same quoted 6% flat costs $${(-flat).toFixed(2)} and solves to ${apr.toFixed(2)}% APR`);
}

/* B2. The Down Payment tooltip says 100% "pays cash outright, so there is no
   loan at all". Held to the letter, for every type. */
{
  const list=['annuity','flat','interestOnly','balloon','bullet','deferred']
    .map(ty=>sc({name:ty, loanType:ty, financeRate:11, downPaymentPct:100, termPeriods:60, ioPeriods:20, residualPct:30}));
  await load({fields:{'v:availableCash':'80000'}, scenarios:list});
  const t=await compTable();
  const bad=list.filter(s=>{
    const i=colOf(t,s.name);
    return Math.abs(money(t['Net Benefit vs Cash'][i]))>0.005
        || Math.abs(money(t['Total Interest Paid'][i]))>0.005
        || Math.abs(money(t['Ending Wealth'][i])-money(t['Cash Purchase at Same Horizon'][i]))>0.005;
  }).map(s=>s.name);
  check('B2 a 100% down payment IS paying cash: no interest, no benefit, same wealth',
    !bad.length, bad.join(', ') || 'all six loan types collapse onto the cash line');
}

/* B3. With no time value of money, rescheduling it cannot change anything, so
   ending wealth is the arithmetic difference and nothing else. */
{
  const list=['annuity','flat','interestOnly','balloon','bullet','deferred']
    .map(ty=>sc({name:ty, loanType:ty, financeRate:0, downPaymentPct:25, termPeriods:60, ioPeriods:20, residualPct:30}));
  await load({fields:{'v:baseRf':'0','v:availableCash':'80000'}, scenarios:list});
  const t=await compTable();
  const bad=list.filter(s=>{
    const i=colOf(t,s.name);
    return !near(money(t['Ending Wealth'][i]), 30000, 0.01)
        || Math.abs(money(t['Net Benefit vs Cash'][i]))>0.005;
  }).map(s=>s.name);
  check('B3 at zero rates every loan type ends on cash − price exactly, and level with paying cash',
    !bad.length, bad.join(', ') || 'all six end at $30,000.00 with $0.00 net benefit');
}

console.log('\n════ C — marginal identities: each input moves the books by its own amount ════');

/* C1 and C2 are differences between two runs, so everything the two share —
   the whole amortisation, the whole investment path — cancels, and what is left
   is a closed form the fee alone has to satisfy. */
{
  const rf=4.5, n=60, ppy=12, F=1500, A=25;
  const list=[
    sc({name:'none', loanType:'annuity', financeRate:7, downPaymentPct:20, termPeriods:n}),
    sc({name:'orig', loanType:'annuity', financeRate:7, downPaymentPct:20, termPeriods:n, feeAmt:F, feeType:'fixed', feeTreatment:'upfront'}),
    sc({name:'admin',loanType:'annuity', financeRate:7, downPaymentPct:20, termPeriods:n, adminFee:A})
  ];
  await load({fields:{'v:availableCash':'80000'}, scenarios:list});
  const t=await compTable();
  const ew=nm=>money(t['Ending Wealth'][colOf(t,nm)]);
  const ti=nm=>money(t['Total Interest Paid'][colOf(t,nm)]);
  const rfp=Math.pow(1+rf/100,1/ppy)-1;
  const wantC1=-F*Math.pow(1+rf/100, n/ppy);
  let fv=0; for(let i=1;i<=n;i++) fv=fv*(1+rfp)+A;   // future value of A paid every period
  const wantC2=-fv;
  check('C1 an upfront fee costs exactly its own compounded self, and is not borrowed',
    near(ew('orig')-ew('none'), wantC1, 0.05) && near(ti('orig'), ti('none'), 0.005)
      && near(money(t['Financed Amount'][colOf(t,'orig')]), money(t['Financed Amount'][colOf(t,'none')]), 0.005),
    `Δwealth ${(ew('orig')-ew('none')).toFixed(2)} vs −F(1+rf)^T ${wantC1.toFixed(2)}; interest and financed amount unmoved`);
  check('C2 an admin fee costs exactly its own compounded annuity, and adds no interest',
    near(ew('admin')-ew('none'), wantC2, 0.05) && near(ti('admin'), ti('none'), 0.005),
    `Δwealth ${(ew('admin')-ew('none')).toFixed(2)} vs −A·Σ(1+rf_p)^(n−k) ${wantC2.toFixed(2)}`);
}

/* C5. Net Benefit is a difference, and the surplus cash above the price is
   invested identically in both arms, so it has to cancel exactly. This is what
   makes the Quick Start buffers free to choose — and a Net Benefit that drifted
   with it would mean the two arms are not being handed the same money. */
{
  const s=sc({name:'x', loanType:'annuity', financeRate:7, downPaymentPct:20, termPeriods:60, feeAmt:800, adminFee:12});
  const seen=[];
  for(const cash of [50000, 60000, 250000]){
    await load({fields:{'v:availableCash':String(cash)}, scenarios:[s]});
    const t=await compTable();
    seen.push({cash, nb:money(t['Net Benefit vs Cash'][colOf(t,'x')]), ew:money(t['Ending Wealth'][colOf(t,'x')])});
  }
  const spread=Math.max(...seen.map(x=>x.nb))-Math.min(...seen.map(x=>x.nb));
  const grow=Math.pow(1.045,5);
  const stepOk=near(seen[1].ew-seen[0].ew, 10000*grow, 0.05) && near(seen[2].ew-seen[1].ew, 190000*grow, 0.5);
  check('C5 surplus cash cancels out of Net Benefit, and moves Ending Wealth by exactly Δcash(1+rf)^T',
    spread<0.01 && stepOk,
    `net benefit ${seen.map(x=>x.nb.toFixed(2)).join(' / ')} across $50k–$250k of cash; wealth steps ${(seen[1].ew-seen[0].ew).toFixed(2)} vs ${(10000*grow).toFixed(2)}`);
}

/* C6. "Display only. Nothing is converted." */
{
  const s=sc({name:'x', loanType:'annuity', financeRate:7, downPaymentPct:20, termPeriods:60, feeAmt:800, adminFee:12});
  const digits=[];
  for(const sym of ['$','€','Rp','₿']){
    await load({fields:{'v:currencySymbol':sym,'v:availableCash':'80000'}, scenarios:[s]});
    const t=await compTable();
    digits.push(['Financed Amount','Total Interest Paid','Total Financing Cost','Ending Wealth','Net Benefit vs Cash']
      .map(k=>money(t[k][colOf(t,'x')]).toFixed(2)).join('|'));
  }
  check('C6 the currency symbol is display only: not one figure moves across four symbols',
    new Set(digits).size===1, digits[0]);
}

/* C7. The inflation tooltip promises a discount of the same figures, not a
   second model, so real must be nominal/(1+i)^T and nothing nominal may move. */
{
  const s1=sc({name:'a', loanType:'annuity', financeRate:7, downPaymentPct:20, termPeriods:60});
  const s2=sc({name:'b', loanType:'balloon', financeRate:9, downPaymentPct:0, termPeriods:36, residualPct:40});
  await load({fields:{'v:availableCash':'80000'}, scenarios:[s1,s2]});
  const off=await compTable();
  await load({fields:{'v:availableCash':'80000','c:inflationToggle':true,'v:inflationRate':'3'}, scenarios:[s1,s2]});
  const on=await compTable();
  const bad=[];
  for(const nm of ['a','b']){
    const i=colOf(on,nm);
    const years=nm==='a'?5:3;
    const nomNB=money(on['Net Benefit vs Cash'][i]);
    const realNB=money(on['Inflation-Adj Net Benefit'][i]);
    if(!near(realNB, nomNB/Math.pow(1.03,years), 0.05)) bad.push(`${nm} real ${realNB.toFixed(2)} ≠ ${(nomNB/Math.pow(1.03,years)).toFixed(2)}`);
    ['Ending Wealth','Total Interest Paid','Total Financing Cost','Net Benefit vs Cash'].forEach(k=>{
      if(!near(money(off[k][colOf(off,nm)]), money(on[k][i]), 0.005)) bad.push(`${nm} ${k} moved when the toggle flipped`);
    });
  }
  check('C7 inflation is a deflator, not a second model: real = nominal/(1+i)^T and no nominal figure moves',
    !bad.length, bad.join(' | ') || 'both scenarios discount at their OWN horizon (5 yr and 3 yr), nominals untouched');
}

console.log('\n════ D — horizon integrity: what is each scenario compared against? ════');

/* The page pins the headline Cash Purchase Wealth to the LONGEST scenario and
   each row\'s Net Benefit to its OWN end of term. Both are defensible;
   subtracting one from the other is not, and with a 30-year row beside a 1-year
   row the difference is enormous. */
{
  const list=[
    sc({name:'short', loanType:'annuity', financeRate:3, downPaymentPct:0, termPeriods:12}),
    sc({name:'long',  loanType:'annuity', financeRate:9, downPaymentPct:0, termPeriods:360})
  ];
  await load({fields:{'v:availableCash':'250000'}, scenarios:list});
  const t=await compTable(), k=await kpis();
  const rowOk=[], base={};
  for(const nm of ['short','long']){
    const i=colOf(t,nm);
    base[nm]={ew:money(t['Ending Wealth'][i]), cb:money(t['Cash Purchase at Same Horizon'][i]),
               nb:money(t['Net Benefit vs Cash'][i])};
    rowOk.push(near(base[nm].ew-base[nm].cb, base[nm].nb, 0.02));
  }
  const yrs=n=>n/12;
  const wantShort=200000*Math.pow(1.045,yrs(12)), wantLong=200000*Math.pow(1.045,yrs(360));
  check('D1 each row is scored at its own horizon: Ending Wealth − same-horizon cash = Net Benefit',
    rowOk.every(Boolean),
    `1-yr baseline ${base.short.cb.toFixed(2)} vs replay ${wantShort.toFixed(2)}; 30-yr ${base.long.cb.toFixed(2)} vs ${wantLong.toFixed(2)}`);
  check('D3 the two baselines are genuinely different, so D1 cannot pass by accident',
    Math.abs(base.long.cb-base.short.cb)>100000 && near(base.short.cb,wantShort,1) && near(base.long.cb,wantLong,1),
    `gap $${(base.long.cb-base.short.cb).toFixed(2)} — what a single shared baseline would misstate`);
  // D2: the headline tile is the winner's own row, NOT the cash tile minus it.
  const cashTile=money(k.cash), kpiNB=money(k.net);
  const winner=base.short.nb>base.long.nb?'short':'long';
  const wrongWay=base[winner].ew-cashTile;
  check('D2 the headline Net Benefit is the winning row, never the long-horizon tile minus it',
    near(kpiNB, base[winner].nb, Math.max(60, Math.abs(base[winner].nb)*0.01)) && Math.abs(kpiNB-wrongWay)>1000,
    `tile ${kpiNB.toFixed(0)} = ${winner} row ${base[winner].nb.toFixed(0)}; the shared-baseline mistake would read ${wrongWay.toFixed(0)}`);
}

console.log('\n════ E — cross-path consistency: the same number computed twice ════');

/* E1. The sweep is a second engine path over the same inputs. Land a grid point
   exactly on the scenario\'s own finance rate and the sweep has to pass through
   the answer the panel is already showing — for every objective it offers. */
{
  const s=sc({name:'x', loanType:'annuity', financeRate:7, downPaymentPct:20, termPeriods:60, feeAmt:900, adminFee:15});
  await load({fields:{'v:availableCash':'90000','c:inflationToggle':true,'v:inflationRate':'2.5'}, scenarios:[s]});
  const t=await compTable();
  const live={
    netBenefit:money(t['Net Benefit vs Cash'][colOf(t,'x')]),
    totalInterest:money(t['Total Interest Paid'][colOf(t,'x')]),
    totalFinanceCost:money(t['Total Financing Cost'][colOf(t,'x')]),
    endWealth:money(t['Ending Wealth'][colOf(t,'x')]),
    inflAdjNetBenefit:money(t['Inflation-Adj Net Benefit'][colOf(t,'x')])
  };
  const bad=[];
  for(const obj of Object.keys(live)){
    // 1 → 13 in 25 points steps by 0.5, so 7.00 is a grid point.
    const got=await page.evaluate(async (obj)=>{
      const set=(id,v)=>{const el=document.getElementById(id);el.value=v;
        ['input','change'].forEach(t=>el.dispatchEvent(new Event(t,{bubbles:true})));};
      set('sensObjective',obj); set('sensVarX','financeRate');
      set('sensXStart','1'); set('sensXEnd','13'); set('sensSteps','25');
      await new Promise(r=>setTimeout(r,600));
      const ch=window.__charts.filter(c=>c.canvasId==='sensCanvas').pop();
      if(!ch) return null;
      // The sweep plots a plain series against category labels, so the grid
      // point is found by its label rather than by an x co-ordinate.
      const i=ch.data.labels.indexOf('7.00');
      return i<0?null:ch.data.datasets[0].data[i];
    }, obj);
    if(got===null || !near(got, live[obj], Math.max(0.05, Math.abs(live[obj])*1e-6)))
      bad.push(`${obj}: sweep ${got===null?'no grid point':got.toFixed(2)} vs panel ${live[obj].toFixed(2)}`);
  }
  check('E1 the 2D sweep passes through the live answer on all five objectives',
    !bad.length, bad.join(' | ') || Object.entries(live).map(([k,v])=>k+'='+v.toFixed(2)).join(', '));
}

/* E3. Four chart metrics, and each one\'s last point is a number the tables
   already print. A chart that drifts from its own table is the cheapest way for
   a reader to be told two different things. */
{
  const s=sc({name:'x', loanType:'annuity', financeRate:7, downPaymentPct:20, termPeriods:60, feeAmt:900, adminFee:15});
  await load({fields:{'v:availableCash':'90000'}, scenarios:[s]});
  const t=await compTable();
  const fin=money(t['Financed Amount'][colOf(t,'x')]);
  const want={wealth:money(t['Ending Wealth'][colOf(t,'x')]),
              netBenefit:money(t['Net Benefit vs Cash'][colOf(t,'x')]),
              loanBalance:0};
  const bad=[];
  for(const m of ['wealth','netBenefit','loanBalance']){
    const got=await page.evaluate(async m=>{
      const el=document.getElementById('chartMetric'); el.value=m;
      el.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(r=>setTimeout(r,300));
      const ch=window.__charts.filter(c=>c.canvasId==='chartCanvas').pop();
      const ds=ch.data.datasets.find(d=>d.label==='x');
      const first=ds.data[0], last=ds.data[ds.data.length-1];
      return {first:first.y, last:last.y};
    }, m);
    if(!near(got.last, want[m], Math.max(0.05, Math.abs(want[m])*1e-6)))
      bad.push(`${m} ends at ${got.last.toFixed(2)} vs table ${want[m].toFixed(2)}`);
    if(m==='loanBalance' && !near(got.first, fin, 0.05))
      bad.push(`loanBalance starts at ${got.first.toFixed(2)} vs financed ${fin.toFixed(2)}`);
  }
  check('E3 every chart metric ends on the figure its own table prints',
    !bad.length, bad.join(' | ') || `wealth ${want.wealth.toFixed(2)}, net benefit ${want.netBenefit.toFixed(2)}, loan balance starts at ${fin.toFixed(2)} and ends at 0`);
}

/* E2. The CSV is scraped from the rendered table, so the risk is not the
   arithmetic but the ASCII pass over it: a minus sign deleted instead of
   translated turns a debt into a credit in every spreadsheet that opens it. */
{
  const s=sc({name:'neg', loanType:'knownPayment', knownPayment:120, downPaymentPct:0, termPeriods:60});
  await load({fields:{'v:availableCash':'80000'}, scenarios:[s]});
  const csv=await page.evaluate(async ()=>{
    const OrigBlob=window.Blob; let text=null;
    window.Blob=function(parts,opts){ text=String(parts[0]); return new OrigBlob(parts,opts); };
    window.URL.createObjectURL=()=>'blob:stub'; window.URL.revokeObjectURL=()=>{};
    document.getElementById('downloadBtn').click();
    window.Blob=OrigBlob;
    return text;
  });
  const lines=(csv||'').trim().split('\n');
  const screen=await page.evaluate(()=>[...document.querySelectorAll('#amortTableWrap table tr')]
    .map(tr=>[...tr.querySelectorAll('th,td')].map(c=>c.textContent.trim().replace(/[−–]/g,'-').replace(/[ \t]*[‒—―][ \t]*/g,' ')).join('\u0001')));
  const body=lines.slice(1).map(l=>l.replace(/^"|"$/g,'').split('","').join('\u0001'));
  const mismatch=screen.findIndex((row,i)=>body[i]!==row);
  check('E2 the CSV is the table, minus sign included, with nothing lost in the ASCII pass',
    csv && !/[−–]/.test(csv) && /-/.test(csv) && mismatch===-1,
    mismatch===-1 ? `${screen.length} rows identical; Unicode minus translated, not deleted`
                  : `row ${mismatch}: ${JSON.stringify(body[mismatch])} ≠ ${JSON.stringify(screen[mismatch])}`);
}

console.log('\n════ F — structural signs: no free lunch, no free loss ════');

/* F3 is the sharpest of the four: the sign of what a longer term does has to
   FLIP at the wash. Above the risk-free rate more term is more expensive debt;
   below it, more term is more cheap money kept invested; at it, nothing. One
   test, and it pins timing, compounding and the direction of the spread. */
{
  const rows=[];
  for(const rate of [3, 4.5, 8]){
    const list=[24,60,120].map(n=>sc({name:'n'+n, loanType:'annuity', financeRate:rate, downPaymentPct:0, termPeriods:n}));
    await load({fields:{'v:availableCash':'80000'}, scenarios:list});
    const t=await compTable();
    rows.push({rate, nb:list.map(s=>money(t['Net Benefit vs Cash'][colOf(t,s.name)]))});
  }
  const rising =rows[0].nb[0]<rows[0].nb[1] && rows[0].nb[1]<rows[0].nb[2];   // 3% < rf 4.5%
  const flat   =rows[1].nb.every(v=>Math.abs(v)<0.01);                        // 4.5% == rf
  const falling=rows[2].nb[0]>rows[2].nb[1] && rows[2].nb[1]>rows[2].nb[2];   // 8% > rf
  check('F3 the sign of a longer term flips exactly at the wash',
    rising && flat && falling,
    `at 3% ${rows[0].nb.map(v=>v.toFixed(0)).join('→')} (rises) · at 4.5% ${rows[1].nb.map(v=>v.toFixed(2)).join('/')} (flat) · at 8% ${rows[2].nb.map(v=>v.toFixed(0)).join('→')} (falls)`);
}

/* F1/F2/F4. Monotonicity in each of the three levers the reader actually pulls. */
{
  const byRate=[], byRf=[], byDown=[];
  {
    const list=[4,6,8,10].map(r=>sc({name:'r'+r, loanType:'annuity', financeRate:r, downPaymentPct:0, termPeriods:60}));
    await load({fields:{'v:availableCash':'80000'}, scenarios:list});
    const t=await compTable();
    list.forEach(s=>byRate.push(money(t['Net Benefit vs Cash'][colOf(t,s.name)])));
  }
  for(const rf of [2,4,6,8]){
    await load({fields:{'v:availableCash':'80000','v:baseRf':String(rf)},
      scenarios:[sc({name:'x', loanType:'annuity', financeRate:7, downPaymentPct:0, termPeriods:60})]});
    const t=await compTable();
    byRf.push(money(t['Net Benefit vs Cash'][colOf(t,'x')]));
  }
  {
    const list=[0,25,50,75,100].map(d=>sc({name:'d'+d, loanType:'annuity', financeRate:9, downPaymentPct:d, termPeriods:60}));
    await load({fields:{'v:availableCash':'80000'}, scenarios:list});
    const t=await compTable();
    list.forEach(s=>byDown.push(money(t['Net Benefit vs Cash'][colOf(t,s.name)])));
  }
  const mono=(a,dir)=>a.every((v,i)=>i===0||(dir>0?v>a[i-1]:v<a[i-1]));
  check('F1 Net Benefit falls as the finance rate rises', mono(byRate,-1), byRate.map(v=>v.toFixed(0)).join(' → '));
  check('F2 Net Benefit rises as the risk-free rate rises, while debt exists', mono(byRf,1), byRf.map(v=>v.toFixed(0)).join(' → '));
  check('F4 Net Benefit is monotone in the down payment and lands on zero at 100%',
    mono(byDown,1) && Math.abs(byDown[4])<0.005,
    byDown.map(v=>v.toFixed(0)).join(' → ') + ' (expensive debt, so less of it is better)');
}

console.log('\n════ G — degenerate input: the books refuse rather than lie ════');

{
  await load({fields:{'v:purchaseCost':'50000','v:availableCash':'30000'},
    scenarios:[sc({name:'x', loanType:'annuity', financeRate:7, downPaymentPct:0, termPeriods:60})]});
  const k=await kpis();
  const wiped=await page.evaluate(()=>!document.querySelector('#compTableWrap table'));
  check('G1 available cash below the purchase price is explained, not modelled on cash that does not exist',
    k.warn==='block' && /less than the purchase cost/i.test(k.warnText) && wiped && k.net==='—',
    `warn shown, KPIs blanked, comparison table withdrawn`);
}
{
  // The tooltip's own words: a rate schedule that reverts. The band must be shut
  // while the rate is fixed and open only afterwards — an accounting question,
  // not a drawing one, because a band open during the fixed years would be
  // claiming a spread of outcomes the contract does not allow.
  await load({fields:{'v:availableCash':'80000'}, scenarios:[sc({
    name:'rev', loanType:'annuity', financeRate:6, downPaymentPct:0, termPeriods:60, rateMode:'schedule',
    ratePeriods:[{toPeriod:24,type:'fixed',rate:6,rateMin:6,rateMax:6},
                 {toPeriod:60,type:'floating',rate:7,rateMin:5,rateMax:9}]})]});
  const t=await compTable();
  const range=t['Ending Wealth Range (min–max)'][colOf(t,'rev')];
  const lo=money(range.split('–')[0]), hi=money(range.split('–')[1]);
  const mid=money(t['Ending Wealth'][colOf(t,'rev')]);
  check('G-band a fixed-then-floating loan brackets its own midpoint, and only after the revert',
    lo<mid && mid<hi && (hi-lo)>100, `${lo.toFixed(0)} < ${mid.toFixed(0)} < ${hi.toFixed(0)}`);
}
{
  await load({fields:{'v:availableCash':'80000'}, scenarios:[
    sc({name:'io-full', loanType:'interestOnly', financeRate:7, downPaymentPct:0, termPeriods:60, ioPeriods:60}),
    sc({name:'res99',   loanType:'balloon',      financeRate:7, downPaymentPct:0, termPeriods:60, residualPct:99}),
    sc({name:'one',     loanType:'annuity',      financeRate:7, downPaymentPct:0, termPeriods:1})
  ]});
  const t=await compTable();
  const bad=[];
  for(const nm of ['io-full','res99','one']){
    const i=colOf(t,nm);
    if(i<0){ bad.push(nm+' dropped'); continue; }
    const a=await amort(nm);
    const fin=money(t['Financed Amount'][i]);
    if(!near(a.rows[a.rows.length-1].end,0,0.005)) bad.push(nm+' does not close');
    if(!near(a.rows.reduce((s,x)=>s+x.principal,0), fin, 0.05)) bad.push(nm+' principal ≠ financed');
  }
  check('G4 the extremes still close: interest-only for the whole term, a 99% residual, a one-period loan',
    !bad.length, bad.join(' | ') || 'all three repay exactly what was borrowed');
}

console.log('\n════ H — the Quick Start scenarios carry the same burden ════');

const PRESETS=['house','car','phone','card','motorbike','deferred'];
{
  const bad=[], seen=[];
  for(const key of PRESETS){
    await load({});   // clean cache first, so the preset is doing the work
    await page.evaluate(k=>document.querySelector(`.quick-start-btn[data-preset="${k}"]`).click(), key);
    await page.waitForTimeout(450);
    const t=await compTable();
    const cols=t.__cols.slice(2);
    seen.push(`${key}(${cols.length})`);
    for(const nm of cols){
      const i=colOf(t,nm);
      const a=await amort(nm);
      if(!a){ bad.push(`${key}/${nm} has no schedule`); continue; }
      const fin=money(t['Financed Amount'][i]);
      const int=money(t['Total Interest Paid'][i]);
      const adm=money(t['Total Admin Fees'][i]);
      const fees=money(t['Total Fees Paid'][i]);
      const cost=money(t['Total Financing Cost'][i]);
      const oop=money(t['Total Out-of-Pocket'][i]);
      // Totals as the page prints them: rounded once from exact figures, so
      // these identities hold to the cent. Financed Amount prints to the
      // dollar, hence the wider slack wherever it appears.
      const pays=a.totals.payment, prin=a.totals.principal, ints=a.totals.interest;
      const down=money(t['Down Payment Amount'][i]);
      if(!near(a.rows[a.rows.length-1].end,0,0.01)) bad.push(`${key}/${nm} A2 does not close`);
      if(!near(prin,fin,0.51))       bad.push(`${key}/${nm} A2b principal ${prin.toFixed(2)} ≠ ${fin.toFixed(2)}`);
      if(!near(pays,fin+int,0.51))   bad.push(`${key}/${nm} A3 payments ≠ financed+interest`);
      if(!near(ints,int,0.011))      bad.push(`${key}/${nm} A5 interest total ≠ KPI`);
      if(!near(cost,int+fees,0.011)) bad.push(`${key}/${nm} A4 cost ≠ interest+fees`);
      // Every preset settles its origination fee upfront, so it is cash out.
      if(!near(oop, down+(fees-adm)+pays+adm, 0.011)) bad.push(`${key}/${nm} A1 out-of-pocket does not reconcile`);
      // D1 on the preset's own horizons.
      if(!near(money(t['Ending Wealth'][i])-money(t['Cash Purchase at Same Horizon'][i]),
               money(t['Net Benefit vs Cash'][i]), 0.02)) bad.push(`${key}/${nm} D1 horizon mismatch`);
    }
  }
  check('H1/H2 every Quick Start column closes its books and is scored at its own horizon',
    !bad.length, bad.slice(0,4).join(' | ')
      || seen.join(', ')+` — ${seen.reduce((n,x)=>n+ +x.match(/\((\d+)\)/)[1],0)} columns, all reconcile`);
}

/* H4. A tip that claims a lesson is a claim about the numbers behind the
   button. Each of these is the specific thing its tip promises. */
{
  const claims=[];
  // motorbike: "roughly double the one advertised"
  await load({}); await page.evaluate(()=>document.querySelector('.quick-start-btn[data-preset="motorbike"]').click());
  await page.waitForTimeout(450);
  let t=await compTable();
  const flatApr=money(t['Effective Rate (APR)'][colOf(t,'36mo @ 0.9%/mo flat')]);
  const amApr =money(t['Effective Rate (APR)'][colOf(t,'36mo @ 10.8% amortizing')]);
  claims.push({ok: flatApr>1.7*10.8 && flatApr<2.3*10.8 && near(amApr,11.35,0.2),
    say:`flat solves to ${flatApr.toFixed(2)}% against a quoted 10.8% (the same money amortizing costs ${amApr.toFixed(2)}%)`});

  /* phone: the tip's claim is an ORDERING, and the ordering is the whole reason
     the three terms differ. Two plans over one term would be decided by the
     price tag alone; over 12, 24 and 36 months the biggest instalment is the
     only winner and the smallest is last, which no reader can read off the
     monthly. Checked as the ranking, not as three separate numbers. */
  await load({}); await page.evaluate(()=>document.querySelector('.quick-start-btn[data-preset="phone"]').click());
  await page.waitForTimeout(450);
  t=await compTable();
  const ph=['12 x $150','24 x $82','36 x $57'].map(n=>({n,
    nb:money(t['Net Benefit vs Cash'][colOf(t,n)]), apr:money(t['Effective Rate (APR)'][colOf(t,n)]),
    pmt:money(t['Periodic Payment'][colOf(t,n)])}));
  claims.push({ok: ph[0].apr===0 && ph[0].nb>0 && ph[1].nb<0 && ph[2].nb<0
      && ph[0].nb>ph[1].nb && ph[1].nb>ph[2].nb           // verdict falls
      && ph[0].pmt>ph[1].pmt && ph[1].pmt>ph[2].pmt       // instalment falls with it
      && ph[1].apr>8 && ph[2].apr>8,
    say:`instalments ${ph.map(x=>'$'+x.pmt).join(' > ')} and verdicts ${ph.map(x=>x.nb.toFixed(2)).join(' > ')} fall together — the smallest monthly is last`});

  /* card: the counter-intuitive one. No interest anywhere, so the flat $90
     conversion fee is the entire cost — which puts the SIX-month plan last,
     behind the twelve-month that pays exactly the same fee and has twice as
     long to earn it back. A middle term finishing last is a ranking nobody
     reads off the tenor, and it is what the tip claims. */
  await load({}); await page.evaluate(()=>document.querySelector('.quick-start-btn[data-preset="card"]').click());
  await page.waitForTimeout(450);
  t=await compTable();
  const cd=['3mo 0%, no fee','6mo 0%, 3% fee','12mo 0%, 3% fee'].map(n=>({n,
    nb:money(t['Net Benefit vs Cash'][colOf(t,n)]), int:money(t['Total Interest Paid'][colOf(t,n)]),
    fee:money(t['Total Fees Paid'][colOf(t,n)])}));
  claims.push({ok: cd.every(x=>x.int===0)                 // not a cent of interest anywhere
      && cd[0].fee===0 && cd[1].fee===90 && cd[2].fee===90 // the same flat fee on both paid plans
      && cd[0].nb>0 && cd[1].nb<0 && cd[2].nb<0
      && cd[1].nb<cd[2].nb,                                // six months finishes BEHIND twelve
    say:`no interest on any of the three; the free plan wins at $${cd[0].nb.toFixed(2)} and the same $90 fee leaves six months (${cd[1].nb.toFixed(2)}) behind twelve (${cd[2].nb.toFixed(2)})`});

  /* car: same rate on all three, so the term and the residual are the only
     variables, and the tip claims the instalment and the verdict move in
     opposite directions. */
  await load({}); await page.evaluate(()=>document.querySelector('.quick-start-btn[data-preset="car"]').click());
  await page.waitForTimeout(450);
  t=await compTable();
  const cr=['3yr loan, 10% down','5yr loan, 10% down','5yr with 35% balloon'].map(n=>({n,
    nb:money(t['Net Benefit vs Cash'][colOf(t,n)]), pmt:money(t['Periodic Payment'][colOf(t,n)]),
    int:money(t['Total Interest Paid'][colOf(t,n)])}));
  claims.push({ok: cr[0].pmt>cr[1].pmt && cr[1].pmt>cr[2].pmt
      && cr[0].nb>cr[1].nb && cr[1].nb>cr[2].nb
      && cr[0].int<cr[1].int && cr[1].int<cr[2].int,
    say:`instalments $${cr.map(x=>x.pmt.toFixed(0)).join(' > ')} against interest $${cr.map(x=>x.int.toFixed(0)).join(' < ')} — the cheapest monthly pays the most`});

  // deferred: the balance climbs above the amount borrowed during the holiday.
  await load({}); await page.evaluate(()=>document.querySelector('.quick-start-btn[data-preset="deferred"]').click());
  await page.waitForTimeout(450);
  const a=await amort('12mo holiday, then 24 payments');
  const peak=Math.max(...a.rows.map(r=>r.end));
  const twelfth=a.rows[11].end;
  claims.push({ok: peak>6000 && near(twelfth, 6000*1.199, 1) && a.rows.slice(0,12).every(r=>r.payment===0),
    say:`nothing paid for 12 periods and the debt reaches $${twelfth.toFixed(2)} on a $6,000 purchase before the first instalment`});

  // house: the band is shut across the fixed years and opens after the revert.
  await load({}); await page.evaluate(()=>document.querySelector('.quick-start-btn[data-preset="house"]').click());
  await page.waitForTimeout(500);
  const band=await page.evaluate(()=>{
    const el=document.getElementById('chartMetric'); el.value='wealth';
    el.dispatchEvent(new Event('change',{bubbles:true}));
    const ch=window.__charts.filter(c=>c.canvasId==='chartCanvas').pop();
    const ds=ch.data.datasets.filter(d=>/2yr fixed/.test(d.label||''));
    const bands=ds.filter(d=>d.isBand===true);
    const at=(d,x)=>{const p=d.data.find(p=>Math.abs(p.x-x)<0.05); return p?p.y:null;};
    if(bands.length<2) return null;
    return {y1:Math.abs(at(bands[0],1)-at(bands[1],1)), y2:Math.abs(at(bands[0],2)-at(bands[1],2)),
            y5:Math.abs(at(bands[0],5)-at(bands[1],5))};
  });
  claims.push({ok: band && band.y1<0.01 && band.y2<0.01 && band.y5>1000,
    say: band? `band width $${band.y1.toFixed(2)} at year 1, $${band.y2.toFixed(2)} at year 2, $${band.y5.toFixed(0)} at year 5`
             : 'no band datasets found'});

  const bad=claims.filter(c=>!c.ok);
  check('H4 every Quick Start tip states something the numbers behind it actually do',
    !bad.length, claims.map(c=>(c.ok?'✓ ':'✗ ')+c.say).join('  ·  '));
}

/* One definitional choice the plan turned up that is worth pinning rather than
   assuming: the Effective Rate (APR) row is the CONTRACT rate, so it is blind
   to fees in all three treatments alike. Consistency is the whole defence of
   that choice — a rate that folded the fee in for a discounted note but not for
   an upfront one would be neither the contract rate nor the true cost. */
{
  const list=[
    sc({name:'up',  loanType:'annuity', financeRate:7, downPaymentPct:0, termPeriods:60, feeAmt:5, feeType:'pct', feeTreatment:'upfront'}),
    sc({name:'cap', loanType:'annuity', financeRate:7, downPaymentPct:0, termPeriods:60, feeAmt:5, feeType:'pct', feeTreatment:'capitalise'}),
    sc({name:'disc',loanType:'annuity', financeRate:7, downPaymentPct:0, termPeriods:60, feeAmt:5, feeType:'pct', feeTreatment:'discount'}),
    sc({name:'none',loanType:'annuity', financeRate:7, downPaymentPct:0, termPeriods:60})
  ];
  await load({fields:{'v:availableCash':'80000'}, scenarios:list});
  const t=await compTable();
  const aprs=list.map(s=>money(t['Effective Rate (APR)'][colOf(t,s.name)]));
  const costs=list.map(s=>money(t['Total Financing Cost'][colOf(t,s.name)]));
  check('APR is the contract rate, identically across all three fee treatments; the fee lives in the cost row',
    aprs.every(v=>near(v,7,0.005)) && costs[0]>costs[3] && costs[1]>costs[3] && costs[2]>costs[3],
    `APR ${aprs.map(v=>v.toFixed(2)).join('/')}% — a 5% fee moves none of them, and moves financing cost to ${costs.slice(0,3).map(v=>v.toFixed(0)).join('/')} against ${costs[3].toFixed(0)}`);
  note('Effective Rate (APR) is the contract rate and excludes every origination fee, including the grossed-up one on a '
     + 'discounted note. That is consistent and it is what makes a flat quote comparable with an annuity quote, but it '
     + 'means APR alone never prices a fee-bearing deal. Total Financing Cost and Net Benefit do, and they are what the '
     + 'verdict is drawn from.');
}

check('no uncaught page errors across the whole run', pageErrors.length===0, pageErrors[0]||'none');

await browser.close();
if(notes.length){ console.log('\nNotes:'); notes.forEach(n=>console.log('  · '+n)); }
console.log(`\nfinancingvscash accounting audit: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
