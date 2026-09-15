// Borrowing Capacity — end-to-end audit harness.
//
// Drives the REAL page in headless Chromium (CDN libs stubbed; the Chart.js
// stub records every config so the plotted series can be inspected) and checks
// it against an INDEPENDENT replay of the documented mathematics:
//   - tax written in the ATO's "base amount plus cents in the dollar" form,
//     not as the page's bracket loop;
//   - the loan solved by BISECTION on the repayment, not by the closed-form
//     present-value annuity the page uses.
// Anything that agrees under both formulations is agreeing on the maths, not
// on a shared implementation.
//
// Run: node run.mjs
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = pathToFileURL(join(HERE, '..', 'index.html')).href;

const CHART_STUB = `
window.__charts = [];
class Chart {
  constructor(ctx, cfg){ this.config=cfg; this.data=(cfg&&cfg.data)||{datasets:[]}; this.options=(cfg&&cfg.options)||{}; window.__charts.push(this); }
  update(){} destroy(){ const i=window.__charts.indexOf(this); if(i>=0) window.__charts.splice(i,1); } resetZoom(){} setDatasetVisibility(){}
}
Chart.register=function(){};
window.Chart=Chart;`;

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  console.log((ok ? '  PASS  ' : '✗ FAIL  ') + name + (detail ? '  — ' + detail : ''));
  ok ? pass++ : fail++;
};
const money = s => parseFloat(String(s).replace(/[−–]/g, '-').replace(/[^0-9.\-]/g, ''));
const near = (a, b, tol) => Math.abs(a - b) <= tol;

/* ══════════════ Independent replay ══════════════ */

// ATO published form: base amount plus cents in the dollar over the threshold.
const REF_SCALE = {
  '2025-26': [[18200,0,0],[45000,0.16,0],[135000,0.30,4288],[190000,0.37,31288],[Infinity,0.45,51638]],
  '2026-27': [[18200,0,0],[45000,0.15,0],[135000,0.30,4020],[190000,0.37,31020],[Infinity,0.45,51370]],
  '2027-28': [[18200,0,0],[45000,0.14,0],[135000,0.30,3752],[190000,0.37,30752],[Infinity,0.45,51102]]
};
function refIncomeTax(ti, year){
  const scale = REF_SCALE[year];
  let lower = 0;
  for(const [upTo, rate, base] of scale){
    if(ti <= upTo) return base + rate * Math.max(0, ti - lower);
    lower = upTo;
  }
  return 0;
}
function refLito(ti){
  if(ti <= 37500) return 700;
  if(ti <= 45000) return 700 - 0.05*(ti - 37500);
  return Math.max(0, 325 - 0.015*(ti - 45000));
}
function refMedicare(ti, adults, deps){
  const family = adults >= 2 || deps > 0;
  const lower = family ? 45907 + 4216*deps : 27222;
  if(ti <= lower) return 0;
  if(ti < lower*1.25) return 0.10*(ti - lower);
  return 0.02*ti;
}
function refMlsRate(inc, adults, deps){
  const family = adults >= 2 || deps > 0;
  const lift = family ? 1500*Math.max(0, deps-1) : 0;
  const t = family ? [202000,236000,316000] : [101000,118000,158000];
  if(inc <= t[0]+lift) return 0;
  if(inc <= t[1]+lift) return 0.010;
  if(inc <= t[2]+lift) return 0.0125;
  return 0.015;
}
function refHelp(inc, threshold){
  if(inc <= threshold) return 0;
  const t2 = Math.max(threshold, 125000);
  if(inc <= t2) return 0.15*(inc - threshold);
  return 0.15*(t2 - threshold) + 0.17*(inc - t2);
}
const REF_CITY = { Sydney:102.0, Melbourne:98.8, Brisbane:102.7, Perth:100.0, Adelaide:109.2,
                   Canberra:106.1, Hobart:86.5, 'Gold Coast':84.3, Regional:95.0 };
function refHem(city, adults, deps, gross){
  const base = (adults >= 2 ? 2750 : 1850) + 480*deps;
  const bands = [[60000,1.00],[90000,1.08],[130000,1.18],[180000,1.30],[250000,1.45],[Infinity,1.62]];
  let f = 1.62;
  for(const [upTo, v] of bands){ if(gross <= upTo){ f = v; break; } }
  return base * (REF_CITY[city]/100) * f;
}
// Repayment that amortises P over n months at monthly rate i.
function refPayment(P, i, n){ return i === 0 ? P/n : P*i/(1 - Math.pow(1+i, -n)); }
// The loan a repayment supports, found by BISECTION rather than the closed form.
function refLoanByBisection(pmt, i, n){
  if(pmt <= 0 || n <= 0) return 0;
  let lo = 0, hi = 1;
  while(refPayment(hi, i, n) < pmt && hi < 1e12) hi *= 2;
  for(let k = 0; k < 200; k++){
    const mid = (lo + hi)/2;
    if(refPayment(mid, i, n) < pmt) lo = mid; else hi = mid;
  }
  return (lo + hi)/2;
}
// Marginal rate measured by finite difference over the reference functions.
function refMarginal(ti, year, adults, deps){
  const f = x => Math.max(0, refIncomeTax(x, year) - refLito(x)) + refMedicare(x, adults, deps);
  return f(ti + 1) - f(ti);
}

// Full replay of the eight steps, from the documented algorithm only.
function replay(p){
  const grossUp    = p.div * (p.frankPct/100) * (0.30/0.70);
  const divGrossed = p.div + grossUp;

  // Step 1
  const pairs = [
    [p.payg, p.shdPayg], [p.overtime, p.shdOvertime], [p.bonus, p.shdBonus],
    [p.allow, p.shdAllow], [p.casual, p.shdCasual], [p.seNpat + p.seAdd, p.shdSe],
    [p.rent, p.shdRent], [divGrossed, p.shdDiv], [p.ftb, p.shdFtb],
    [p.pension, p.shdPension], [p.csIn, p.shdCsIn]
  ];
  const grossAssessable = pairs.reduce((a, [amt, sh]) => a + amt*sh/100, 0);
  const grossUnshaded   = pairs.reduce((a, [amt]) => a + amt, 0);

  // Step 2
  const rentalNet  = p.rent - p.ipCash - p.ipDep;
  const rentalLoss = Math.max(0, -rentalNet);
  const taxable = p.payg + p.overtime + p.bonus + p.allow + p.casual + p.seNpat
                + Math.max(0, rentalNet) + divGrossed + (p.pensionTaxable ? p.pension : 0);
  const adjusted = taxable + rentalLoss;
  const incTax   = Math.max(0, refIncomeTax(taxable, p.taxYear) - refLito(taxable));
  const medicare = refMedicare(taxable, p.adults, p.deps);
  const mls      = p.privHealth ? 0 : refMlsRate(adjusted, p.adults, p.deps) * taxable;
  const helpAll  = p.helpMode === 'none' ? 0 : refHelp(adjusted, p.helpThreshold);
  const helpTax  = p.helpMode === 'tax' ? helpAll : 0;
  const helpComm = p.helpMode === 'commitment' ? helpAll : 0;
  const totalTax = incTax + medicare + mls + helpTax - grossUp;
  const negGear  = p.negGear ? refMarginal(taxable, p.taxYear, p.adults, p.deps) * rentalLoss : 0;
  const netMonthly = (grossAssessable - totalTax + negGear)/12;

  // Step 3
  const hem    = refHem(p.city, p.adults, p.deps, grossUnshaded);
  const living = Math.max(p.declaredExp, hem);

  // Step 4
  const otherRate   = Math.max(p.olRate + p.buffer, p.floorRate);
  const otherMonths = (p.olType === 'io' ? Math.max(1, p.olTerm - p.olIo) : Math.max(1, p.olTerm)) * 12;
  const otherRepay  = p.olBal > 0 ? refPayment(p.olBal, otherRate/1200, otherMonths) : 0;
  const commitments = Math.max(0,
      otherRepay + p.cardLimit*p.cardPct/100 + p.persRepay + p.bnplRepay + helpComm/12
    + p.csOut + (p.occupancy === 'investor' ? p.rentBoard : 0) + p.ipOut + p.newPropCosts - p.refiRepay);

  // Step 5
  const assessRate = Math.max(p.prodRate + p.buffer, p.floorRate);
  const i = assessRate/1200;
  const n = (p.newType === 'io' ? Math.max(1, p.termYears - p.newIo) : Math.max(1, p.termYears)) * 12;

  // Step 6
  const maxRepay  = netMonthly - living - commitments - p.umiReq;
  const lmiFactor = p.lmiCap ? 1 + p.lmiRate/100 : 1;
  const Lserv = Math.max(0, refLoanByBisection(Math.max(0, maxRepay), i, n) / lmiFactor);

  // Step 7
  const dtiIncome = p.dtiBasis === 'assessable' ? grossAssessable : grossUnshaded;
  const debt = Math.max(0, p.olBal + p.cardLimit + p.persBal + p.bnplLimit - p.refiBal);
  const Ldti = Math.max(0, p.dtiCap*dtiIncome - debt);
  const lvr  = p.lvrMax/100;
  const Llvr = lvr * Math.min(p.price, p.valuation);
  const duty = p.dutyMode === 'pct' ? p.price*p.dutyPct/100 : p.dutyAmt;
  const funds = p.savings + p.gift + p.grant - (duty + p.legalFees + p.transferFees + p.inspections);
  const Ldep = Math.max(0, funds/(1 - lvr)*lvr);
  const maxLoan = Math.min(Lserv, Ldti, Llvr, Ldep);

  // Step 8
  const repayAtMax = refPayment(maxLoan*lmiFactor, i, n);
  const outgoings  = living + commitments + repayAtMax;
  return { grossAssessable, grossUnshaded, taxable, totalTax, netMonthly, hem, living,
           commitments, assessRate, n, maxRepay, Lserv, Ldti, Llvr, Ldep, maxLoan,
           repayAtMax, funds, nsr: netMonthly/outgoings, umi: netMonthly - outgoings,
           maxPrice: maxLoan + funds };
}

/* ══════════════ Drive the page ══════════════ */

const browser = await chromium.launch({ args:['--allow-file-access-from-files'] });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
page.on('console', m => { if(m.type() === 'error') pageErrors.push('console: ' + m.text()); });
await page.route('**/*', route => {
  const url = route.request().url();
  if(url.startsWith('file://')) return route.continue();
  if(/chart\.umd/.test(url)) return route.fulfill({ contentType:'application/javascript', body: CHART_STUB });
  return route.fulfill({ contentType:'application/javascript', body:'/* stub */' });
});
await page.goto(PAGE, { waitUntil:'load' });
await page.evaluate(() => { try { localStorage.clear(); } catch(e){} });
await page.reload({ waitUntil:'load' });
await page.waitForTimeout(250);

async function setInputs(vals){
  await page.evaluate(v => {
    Object.entries(v).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if(!el) throw new Error('no such control: ' + id);
      if(el.type === 'checkbox') el.checked = !!val; else el.value = String(val);
      el.dispatchEvent(new Event('input',  { bubbles:true }));
      el.dispatchEvent(new Event('change', { bubbles:true }));
    });
  }, vals);
  await page.waitForTimeout(90);
}
const inputs  = () => page.evaluate(() => window.__BC.readInputs());
const engine  = () => page.evaluate(() => {
  const r = window.__BC.compute(window.__BC.readInputs());
  return { grossAssessable:r.grossAssessable, grossUnshaded:r.grossUnshaded, taxable:r.taxableIncome,
           totalTax:r.totalTax, netMonthly:r.netMonthly, hem:r.hem, living:r.living,
           commitments:r.commitments, assessRate:r.assessRate, n:r.nMonths, maxRepay:r.maxRepay,
           Lserv:r.Lserv, Ldti:r.Ldti, Llvr:r.Llvr, Ldep:r.Ldep, maxLoan:r.maxLoan,
           repayAtMax:r.repayAtMax, funds:r.availFunds, nsr:r.nsr, umi:r.umi, maxPrice:r.maxPrice,
           binding:r.binding.label, negGear:r.negGear, mRate:r.mRate, help:r.helpAmt };
});
const kpis = () => page.evaluate(() => {
  const t = id => document.getElementById(id).textContent.trim();
  return { loan:t('kpiLoan'), bind:t('kpiBind'), price:t('kpiPrice'), repay:t('kpiRepay'),
           nsr:t('kpiNsr'), umi:t('kpiUmi'), warn:document.getElementById('warnBanner').textContent.trim() };
});
async function reset(){
  await page.evaluate(() => document.getElementById('resetBtn').click());
  await page.waitForTimeout(120);
}

/* ══════════════ B1 — every step of the default scenario ══════════════ */
{
  const p = await inputs(), got = await engine(), ref = replay(p), k = await kpis();
  const rows = [
    ['gross assessable', got.grossAssessable, ref.grossAssessable, 0.01],
    ['taxable income',   got.taxable,         ref.taxable,         0.01],
    ['total tax',        got.totalTax,        ref.totalTax,        0.01],
    ['net monthly',      got.netMonthly,      ref.netMonthly,      0.01],
    ['HEM',              got.hem,             ref.hem,             0.01],
    ['living expenses',  got.living,          ref.living,          0.01],
    ['commitments',      got.commitments,     ref.commitments,     0.01],
    ['assessment rate',  got.assessRate,      ref.assessRate,      1e-9],
    ['max repayment',    got.maxRepay,        ref.maxRepay,        0.01],
    ['serviceability',   got.Lserv,           ref.Lserv,           1],
    ['DTI cap',          got.Ldti,            ref.Ldti,            0.01],
    ['LVR cap',          got.Llvr,            ref.Llvr,            0.01],
    ['deposit cap',      got.Ldep,            ref.Ldep,            0.01],
    ['capacity',         got.maxLoan,         ref.maxLoan,         1],
    ['max price',        got.maxPrice,        ref.maxPrice,        1],
    ['NSR',              got.nsr,             ref.nsr,             1e-6],
    ['UMI',              got.umi,             ref.umi,             0.01]
  ];
  const bad = rows.filter(([, a, b, tol]) => !near(a, b, tol));
  check('B1 default scenario matches the independent replay at every step',
    bad.length === 0,
    bad.length ? bad.map(([n,a,b]) => `${n}: page ${a.toFixed(2)} vs replay ${b.toFixed(2)}`).join('; ')
               : `capacity ${ref.maxLoan.toFixed(0)}, ${rows.length} quantities agree`);
  check('B1b headline KPI matches the engine', near(money(k.loan), ref.maxLoan, 1),
    `KPI ${k.loan} vs replay ${ref.maxLoan.toFixed(0)}`);
}

/* ══════════════ B2 — tax scales across incomes and years ══════════════ */
{
  const cases = [];
  for(const year of ['2025-26','2026-27','2027-28']){
    for(const inc of [15000, 30000, 40000, 50000, 70000, 135000, 160000, 250000]){
      await setInputs({ taxYear:year, incPayg:inc, helpMode:'none', privHealth:true, adults:'1', deps:0 });
      const got = await engine();
      const ref = Math.max(0, refIncomeTax(inc, year) - refLito(inc)) + refMedicare(inc, 1, 0);
      if(!near(got.totalTax, ref, 0.01)) cases.push(`${year} @ ${inc}: page ${got.totalTax.toFixed(2)} vs ref ${ref.toFixed(2)}`);
    }
  }
  check('B2 income tax, LITO and Medicare levy match the ATO scales in all three years',
    cases.length === 0, cases.length ? cases.join('; ') : '24 income and year combinations agree');
  await reset();
}

/* ══════════════ B3 — Medicare levy phase-in and the surcharge ══════════════ */
{
  await setInputs({ adults:'1', deps:0, incPayg:30000, helpMode:'none', privHealth:true });
  const got = await engine();
  // 30,000 sits inside the single phase-in band (27,222 to 34,027.5): 10c in the dollar.
  const expected = 0.10*(30000 - 27222);
  const medicareOnPage = got.totalTax - Math.max(0, refIncomeTax(30000,'2026-27') - refLito(30000));
  check('B3 Medicare levy phases in at 10c in the dollar, not the flat 2%',
    near(medicareOnPage, expected, 0.01),
    `page ${medicareOnPage.toFixed(2)} vs ${expected.toFixed(2)} (flat 2% would be ${(0.02*30000).toFixed(2)})`);

  await setInputs({ adults:'1', deps:0, incPayg:150000, privHealth:false });
  const g2 = await engine(), p2 = await inputs(), r2 = replay(p2);
  check('B3b Medicare levy surcharge applies at the tier for the income',
    near(g2.totalTax, r2.totalTax, 0.01) && refMlsRate(150000,1,0) === 0.0125,
    `page ${g2.totalTax.toFixed(2)} vs replay ${r2.totalTax.toFixed(2)} at the 1.25% tier`);
  await reset();
}

/* ══════════════ B4 — HELP: marginal repayment, and where it lands ══════════════ */
{
  await setInputs({ incPayg:150000, helpMode:'tax', helpThreshold:67000 });
  const tax = await engine();
  const expected = 0.15*(125000-67000) + 0.17*(150000-125000);
  check('B4 HELP repayment uses the marginal system, not a flat rate of total income',
    near(tax.help, expected, 0.01),
    `page ${tax.help.toFixed(2)} vs ${expected.toFixed(2)}`);

  await setInputs({ helpMode:'commitment' });
  const comm = await engine();
  check('B4b moving HELP to commitments leaves capacity unchanged but lowers the NSR',
    near(tax.maxLoan, comm.maxLoan, 1) && comm.nsr < tax.nsr,
    `capacity ${tax.maxLoan.toFixed(0)} vs ${comm.maxLoan.toFixed(0)}; NSR ${tax.nsr.toFixed(4)} → ${comm.nsr.toFixed(4)}`);
  await reset();
}

/* ══════════════ B5 — HEM overrides low declared expenses ══════════════ */
{
  await setInputs({ city:'Sydney', adults:'2', deps:2, declaredExp:500, incPayg:140000 });
  const low = await engine();
  const refHemVal = refHem('Sydney', 2, 2, 140000);
  check('B5 a declared figure below HEM is overridden by the benchmark',
    near(low.living, refHemVal, 0.01) && low.living > 500,
    `living ${low.living.toFixed(2)} vs HEM ${refHemVal.toFixed(2)} (declared 500)`);

  await setInputs({ declaredExp:9000 });
  const high = await engine();
  check('B5b a declared figure above HEM is used as declared',
    near(high.living, 9000, 0.01) && high.maxLoan < low.maxLoan,
    `living ${high.living.toFixed(2)}, capacity fell ${low.maxLoan.toFixed(0)} → ${high.maxLoan.toFixed(0)}`);

  // City scaling must track the cost-of-living index, not be a flat number.
  await setInputs({ declaredExp:0, city:'Hobart' });
  const hob = await engine();
  await setInputs({ city:'Adelaide' });
  const adl = await engine();
  const ratio = adl.hem/hob.hem, refRatio = REF_CITY['Adelaide']/REF_CITY['Hobart'];
  check('B5c HEM scales by the city cost-of-living index cross-fed from the comparator',
    near(ratio, refRatio, 1e-9),
    `Adelaide/Hobart ${ratio.toFixed(5)} vs index ratio ${refRatio.toFixed(5)}`);
  await reset();
}

/* ══════════════ B6 — cards are assessed on the LIMIT ══════════════ */
{
  const before = await engine();
  await setInputs({ cardLimit:30000 });
  const after = await engine();
  const p = await inputs();
  const i = after.assessRate/1200;
  const extraRepay = (30000 - 10000) * p.cardPct/100;
  const expectedDrop = refLoanByBisection(before.maxRepay, i, after.n)
                     - refLoanByBisection(before.maxRepay - extraRepay, i, after.n);
  check('B6 a higher card limit cuts capacity by exactly limit × rate, discounted',
    near(before.maxLoan - after.maxLoan, expectedDrop, 2),
    `drop ${(before.maxLoan-after.maxLoan).toFixed(0)} vs expected ${expectedDrop.toFixed(0)}`);
  await reset();
}

/* ══════════════ B7 — interest only shortens the amortisation window ══════════════ */
{
  const pi = await engine();
  await setInputs({ newType:'io', newIo:5 });
  const io = await engine();
  const i = io.assessRate/1200;
  check('B7 interest only amortises over term minus the IO period, lowering capacity',
    io.n === 300 && io.maxLoan < pi.maxLoan
      && near(io.maxLoan, refLoanByBisection(io.maxRepay, i, 300), 1),
    `n ${pi.n} → ${io.n} months; capacity ${pi.maxLoan.toFixed(0)} → ${io.maxLoan.toFixed(0)}`);
  await reset();
}

/* ══════════════ B8 — each cap binds in turn ══════════════ */
{
  const scenarios = [
    { name:'Serviceability', set:{ incPayg:140000, savings:900000, price:3000000, valuation:3000000, dtiCap:9 } },
    { name:'Debt to income', set:{ incPayg:140000, savings:900000, price:3000000, valuation:3000000, dtiCap:3 } },
    { name:'Loan to value',  set:{ incPayg:600000, savings:900000, price:500000,  valuation:500000,  dtiCap:9 } },
    { name:'Deposit',        set:{ incPayg:600000, savings:120000, price:3000000, valuation:3000000, dtiCap:9 } }
  ];
  const wrong = [];
  for(const s of scenarios){
    await reset();
    await setInputs(s.set);
    const got = await engine(), ref = replay(await inputs()), k = await kpis();
    if(got.binding !== s.name || !near(got.maxLoan, ref.maxLoan, 1) || k.bind !== s.name)
      wrong.push(`${s.name}: engine "${got.binding}", KPI "${k.bind}", capacity ${got.maxLoan.toFixed(0)} vs replay ${ref.maxLoan.toFixed(0)}`);
  }
  check('B8 the binding constraint is identified correctly for all four caps',
    wrong.length === 0, wrong.length ? wrong.join('; ') : 'serviceability, DTI, LVR and deposit each bind when forced');
  await reset();
}

/* ══════════════ B9 — the DTI and deposit formulae ══════════════ */
{
  await setInputs({ dtiCap:4, incPayg:140000, cardLimit:20000, persBal:15000, savings:900000, price:3000000, valuation:3000000 });
  const got = await engine(), p = await inputs();
  check('B9 DTI cap = cap × gross income − existing debt (limits, not balances, for cards)',
    near(got.Ldti, 4*140000 - (20000+15000), 0.01),
    `page ${got.Ldti.toFixed(0)} vs ${(4*140000-35000).toFixed(0)}`);

  await setInputs({ dtiBasis:'assessable', incOvertime:40000, shdOvertime:80 });
  const sh = await engine();
  check('B9b switching the DTI basis to assessable income uses the shaded figure',
    near(sh.Ldti, 4*(140000 + 40000*0.8) - 35000, 0.01),
    `page ${sh.Ldti.toFixed(0)} vs ${(4*172000-35000).toFixed(0)}`);

  await reset();
  await setInputs({ savings:150000, gift:20000, grant:10000, dutyMode:'amount', dutyAmt:30000,
                    legalFees:2000, transferFees:1000, inspections:1000, lvrMax:90 });
  const dep = await engine();
  const funds = 150000+20000+10000-34000;
  check('B9c deposit cap = funds after costs ÷ (1 − LVR) × LVR',
    near(dep.Ldep, funds/0.10*0.90, 0.01) && near(dep.funds, funds, 0.01),
    `page ${dep.Ldep.toFixed(0)} vs ${(funds/0.10*0.90).toFixed(0)} on ${funds} of funds`);
  await reset();
}

/* ══════════════ B10 — capitalised LMI feeds back into serviceability ══════════════ */
{
  await setInputs({ lvrMax:90, price:3000000, valuation:3000000, savings:900000 });
  const noLmi = await engine();
  await setInputs({ lmiCap:true, lmiRate:2.5 });
  const lmi = await engine(), p = await inputs();
  const i = lmi.assessRate/1200;
  check('B10 capitalised LMI divides serviceability by 1 + premium',
    near(lmi.Lserv, refLoanByBisection(lmi.maxRepay, i, lmi.n)/1.025, 1),
    `page ${lmi.Lserv.toFixed(0)} vs ${(refLoanByBisection(lmi.maxRepay,i,lmi.n)/1.025).toFixed(0)}; without LMI ${noLmi.Lserv.toFixed(0)}`);
  check('B10b the assessed repayment is charged on the grossed-up balance',
    near(lmi.repayAtMax, refPayment(lmi.maxLoan*1.025, i, lmi.n), 0.02),
    `page ${lmi.repayAtMax.toFixed(2)} vs ${refPayment(lmi.maxLoan*1.025,i,lmi.n).toFixed(2)}`);
  await reset();
}

/* ══════════════ B11 — negative gearing add-back ══════════════ */
{
  await setInputs({ incRent:30000, ipCash:38000, ipDep:6000, negGear:true });
  const on = await engine(), p = await inputs(), ref = replay(p);
  const expected = refMarginal(ref.taxable, p.taxYear, p.adults, p.deps) * 14000;
  check('B11 the negative gearing benefit is the marginal rate on the taxable rental loss',
    near(on.negGear, expected, 0.02) && near(on.maxLoan, ref.maxLoan, 1),
    `page ${on.negGear.toFixed(2)} vs ${expected.toFixed(2)} on a 14,000 loss`);

  await setInputs({ negGear:false });
  const off = await engine();
  check('B11b turning the add-back off lowers what income can service',
    off.Lserv < on.Lserv && near(off.negGear, 0, 1e-9),
    `serviceability ${on.Lserv.toFixed(0)} → ${off.Lserv.toFixed(0)}`);
  await reset();
}

/* ══════════════ B12 — the surplus tests close exactly ══════════════ */
{
  const got = await engine(), p = await inputs();
  const servBinds = got.binding === 'Serviceability';
  check('B12 when serviceability binds, UMI lands exactly on the required buffer',
    servBinds && near(got.umi, p.umiReq, 0.02),
    `binding "${got.binding}", UMI ${got.umi.toFixed(2)} vs required ${p.umiReq}`);
  check('B12b NSR equals net income ÷ (living + commitments + new repayment)',
    near(got.nsr, got.netMonthly/(got.living + got.commitments + got.repayAtMax), 1e-9),
    `page ${got.nsr.toFixed(6)}`);
}

/* ══════════════ B13 — the chart ══════════════ */
{
  await reset();
  const got = await engine();
  const chart = await page.evaluate(() => {
    const c = window.__charts[window.__charts.length-1];
    return {
      xTitle: c.options.scales.x.title.text, yTitle: c.options.scales.y.title.text,
      xType: c.options.scales.x.type,
      labels: c.data.datasets.map(d => d.label),
      cap: c.data.datasets[0].data,
      serv: c.data.datasets[1].data,
      dti: c.data.datasets[2].data,
      lvr: c.data.datasets[3].data,
      dep: c.data.datasets[4].data,
      userIdx: window.__BC.USER_INDEX
    };
  });
  const mid = chart.cap[chart.userIdx];
  check('B13 x is gross income, y is borrowing capacity, and the scenario sits in the middle',
    /Gross income/i.test(chart.xTitle) && /Borrowing capacity/i.test(chart.yTitle)
      && chart.xType === 'linear' && chart.userIdx === (chart.cap.length-1)/2
      && near(mid.x, got.grossUnshaded, 1) && near(mid.y, got.maxLoan, 1),
    `axes "${chart.xTitle}" / "${chart.yTitle}"; middle point (${mid.x.toFixed(0)}, ${mid.y.toFixed(0)}) vs scenario (${got.grossUnshaded.toFixed(0)}, ${got.maxLoan.toFixed(0)})`);

  const monotonic = chart.cap.every((pt, j) => j === 0 || pt.x > chart.cap[j-1].x);
  const isMin = chart.cap.every((pt, j) =>
    near(pt.y, Math.min(chart.serv[j].y, chart.dti[j].y, chart.lvr[j].y, chart.dep[j].y), 1e-6));
  check('B13b the capacity line is the minimum of the four cap lines at every income',
    monotonic && isMin && chart.labels.length === 5,
    `${chart.cap.length} points, series ${JSON.stringify(chart.labels)}`);

  // The plotted caps must agree with a replay run at the same swept income.
  const p = await inputs();
  const k = 0.4 + 1.2*20/24;
  const q = { ...p };
  ['payg','overtime','bonus','allow','casual','seNpat','seAdd','rent','div'].forEach(key => { q[key] = p[key]*k; });
  const ref = replay(q);
  check('B13c a swept point matches a full replay at that income',
    near(chart.cap[20].x, ref.grossUnshaded, 1) && near(chart.cap[20].y, ref.maxLoan, 1)
      && near(chart.serv[20].y, ref.Lserv, 1),
    `point 20: x ${chart.cap[20].x.toFixed(0)}/${ref.grossUnshaded.toFixed(0)}, capacity ${chart.cap[20].y.toFixed(0)}/${ref.maxLoan.toFixed(0)}`);
}

/* ══════════════ B14 — edge cases ══════════════ */
{
  await reset();
  await setInputs({ incPayg:0, incOvertime:0, incBonus:0, incAllow:0, incCasual:0,
                    incSeNpat:0, incSeAdd:0, incRent:0, incDiv:0, incFtb:0, incPension:0, incCsIn:0 });
  const zero = await engine(), k0 = await kpis();
  check('B14 zero income gives zero capacity, with a warning rather than a broken number',
    zero.maxLoan === 0 && isFinite(zero.netMonthly) && k0.warn.length > 0,
    `capacity ${zero.maxLoan}, warning "${k0.warn.slice(0,70)}"`);

  await reset();
  await setInputs({ buffer:0, floorRate:0, prodRate:0 });
  const zeroRate = await engine();
  check('B14b a zero assessment rate falls back to a straight-line loan, not a divide by zero',
    isFinite(zeroRate.maxLoan) && near(zeroRate.Lserv, zeroRate.maxRepay*zeroRate.n, 1),
    `serviceability ${zeroRate.Lserv.toFixed(0)} vs repayment × ${zeroRate.n} = ${(zeroRate.maxRepay*zeroRate.n).toFixed(0)}`);

  await reset();
  await setInputs({ refiRepay:100000 });
  const refi = await engine(), kr = await kpis();
  check('B14c commitments floored at zero when the closures exceed them, and it is disclosed',
    refi.commitments === 0 && /floored at zero/i.test(kr.warn),
    `commitments ${refi.commitments}, warning "${kr.warn.slice(0,80)}"`);

  await reset();
  await setInputs({ olBal:400000, olType:'io', olIo:3, olTerm:25 });
  const io = await engine(), p = await inputs();
  const rate = Math.max(p.olRate + p.buffer, p.floorRate);
  check('B14d an existing interest only loan is reassessed as P&I over the post-IO term',
    near(io.commitments - (p.cardLimit*p.cardPct/100 + p.newPropCosts),
         refPayment(400000, rate/1200, 22*12), 0.02),
    `assessed repayment ${(io.commitments - (p.cardLimit*p.cardPct/100 + p.newPropCosts)).toFixed(2)} vs ${refPayment(400000, rate/1200, 22*12).toFixed(2)} over 22 years at ${rate.toFixed(2)}%`);
  await reset();
}

/* ══════════════ B15 — the mini cache round-trips ══════════════ */
{
  await setInputs({ incPayg:222000, city:'Hobart', deps:3, lvrMax:85, newType:'io' });
  const before = await engine();
  await page.waitForTimeout(600);   // the mini cache debounces saves by 400ms
  await page.reload({ waitUntil:'load' });
  await page.waitForTimeout(350);
  const after = await engine();
  const restored = await page.evaluate(() => ({
    payg: document.getElementById('incPayg').value,
    city: document.getElementById('city').value,
    ioShown: document.getElementById('newIoRow').style.display !== 'none'
  }));
  check('B15 the mini cache restores inputs and the conditional rows they control',
    near(before.maxLoan, after.maxLoan, 1) && restored.city === 'Hobart' && restored.ioShown,
    `capacity ${before.maxLoan.toFixed(0)} → ${after.maxLoan.toFixed(0)}, payg "${restored.payg}", city ${restored.city}`);
  await page.evaluate(() => { try { localStorage.clear(); } catch(e){} });
}

/* ══════════════ B16 — nothing threw along the way ══════════════ */
check('B16 no page errors across the whole run', pageErrors.length === 0,
  pageErrors.length ? pageErrors.slice(0,4).join(' | ') : 'clean');

await browser.close();
console.log(`\nborrowingcapacity audit: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
