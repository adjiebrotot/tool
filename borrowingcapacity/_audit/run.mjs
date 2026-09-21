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
  // Two applicants are two taxpayers. The page sums a reduce() over an array of
  // shares; this side names the two people explicitly and adds them, so the
  // agreement is on the arithmetic rather than on a shared shape.
  const share2   = p.adults >= 2 ? Math.min(50, Math.max(0, p.incSplit))/100 : 0;
  const taxable2 = taxable * share2;
  const taxable1 = taxable - taxable2;
  const perHead  = ti => Math.max(0, refIncomeTax(ti, p.taxYear) - refLito(ti));
  const incTax   = share2 > 0 ? perHead(taxable1) + perHead(taxable2) : perHead(taxable);
  const medicare = refMedicare(taxable, p.adults, p.deps);
  const mls      = p.privHealth ? 0 : refMlsRate(adjusted, p.adults, p.deps) * taxable;
  const helpAll  = p.helpMode === 'none' ? 0 : refHelp(adjusted, p.helpThreshold);
  const helpTax  = p.helpMode === 'tax' ? helpAll : 0;
  const helpComm = p.helpMode === 'commitment' ? helpAll : 0;
  const totalTax = incTax + medicare + mls + helpTax;   // the gross-up already puts the credit in income
  // The higher earner's rate: applicant 1 holds the geared property.
  const negGear  = p.negGear ? refMarginal(share2 > 0 ? taxable1 : taxable, p.taxYear, p.adults, p.deps) * rentalLoss : 0;
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
  const costs = duty + p.otherCosts;
  const funds = p.depositMode === 'pct' ? p.price*p.depositPct/100 : p.savings - costs;
  const Ldep = Math.max(0, funds/(1 - lvr)*lvr);
  const maxLoan = Math.min(Lserv, Ldti, Llvr, Ldep);

  // Step 8
  const repayAtMax = refPayment(maxLoan*lmiFactor, i, n);
  const outgoings  = living + commitments + repayAtMax;
  return { grossAssessable, grossUnshaded, taxable, taxable1, taxable2, totalTax, netMonthly, hem, living,
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
// Clearing storage would also clear the tour's seen flag, and the tour then
// auto-opens 700ms into every reload. The checks below drive the page through
// page.evaluate(), which a backdrop cannot block, but a step that seeds a Quick
// Start scenario would still land on top of a test's own inputs. Mark the tour
// as already seen so the run is deterministic.
await page.evaluate(() => { try { localStorage.clear(); localStorage.setItem('bc-tour-v1-seen','1'); } catch(e){} });
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
// The page ships with progressive disclosure on: Simple mode everywhere, and
// only the debts the user ticks. The maths tests below want every stream and
// every knob live, so reset() puts the page into the fully-disclosed state,
// which is numerically the same scenario the tool used to open on.
async function setModes(m){
  await page.evaluate(mm => {
    Object.entries(mm).forEach(([group, val]) => {
      const g = document.getElementById(group);
      if(!g) throw new Error('no such segmented control: ' + group);
      const b = g.querySelector('.seg-btn[data-val="' + val + '"]');
      if(!b) throw new Error('no such option: ' + group + '/' + val);
      b.click();
    });
  }, m);
  await page.waitForTimeout(90);
}
const modes = () => page.evaluate(() => ({ ...window.__BC.UI }));
const shown = id => page.evaluate(i => {
  const el = document.getElementById(i);
  return !!el && el.style.display !== 'none' && el.offsetParent !== null;
}, id);
// shown() needs the row's own tab on screen, since a dormant panel is display:none.
const openTab = name => page.evaluate(n => {
  document.querySelector('.ctrl-tab[data-tab="' + n + '"]').click();
}, name).then(() => page.waitForTimeout(60));

const ALL_DETAILED = { incWhoGroup:'employee', incModeGroup:'detailed', debtsModeGroup:'detailed',
                       loanModeGroup:'detailed', capsModeGroup:'detailed' };
const ALL_TICKED = { hasInvest:true, hasGov:true, hasHomeLoan:true, hasCard:true, hasPersonal:true,
                     hasBnpl:true, hasSupport:true, hasRefi:true };

async function reset(){
  await page.evaluate(() => document.getElementById('resetBtn').click());
  await page.waitForTimeout(120);
  await setModes(ALL_DETAILED);
  await setInputs(ALL_TICKED);
}

/* ══════════════ B0 — the shipped default, before anything is disclosed ══════════════ */
{
  const d = await modes(), p = await inputs(), ref = replay(p);
  const oneNumber = p.payg === 140000 && p.shdPayg === 100
        && p.overtime === 0 && p.bonus === 0 && p.allow === 0 && p.casual === 0 && p.seNpat === 0;
  check('B0 the page opens Simple, on the employee side, with one income counted in full',
    d.incMode === 'simple' && d.incWho === 'employee' && oneNumber
      && d.debtsMode === 'simple' && d.loanMode === 'simple' && d.capsMode === 'simple',
    `modes ${JSON.stringify(d)}, payg ${p.payg} @ ${p.shdPayg}%`);
  check('B0b an unticked checklist keeps its group off the screen and out of the maths',
    p.rent === 0 && p.div === 0 && p.ftb === 0 && p.pension === 0 && p.olBal === 0
      && p.persBal === 0 && p.bnplLimit === 0
      && !(await shown('incRent')) && !(await shown('olBal')),
    `capacity ${ref.maxLoan.toFixed(0)} from salary and the card limit alone`);
  await reset();
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
  await setInputs({ hasIo:true, newIo:5 });
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
  await setInputs({ savings:180000, dutyMode:'amount', dutyAmt:30000,
                    otherCosts:4000, lvrMax:90 });
  const dep = await engine();
  const funds = 180000-34000;
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
  // The add-back is at the HIGHER earner's marginal rate, so the expectation is
  // built on applicant 1's share, not on the pooled figure.
  const expected = refMarginal(ref.taxable1, p.taxYear, p.adults, p.deps) * 14000;
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

/* ══════════════ B11c — franking credits are counted once, not twice ══════════════ */
{
  await reset();
  await setInputs({ incPayg:0, incOvertime:0, incBonus:0, incAllow:0, incCasual:0, incSeNpat:0,
                    incSeAdd:0, incRent:0, incFtb:0, incPension:0, incCsIn:0,
                    incDiv:50000, shdDiv:100, frankPct:100, adults:'1', deps:0,
                    privHealth:true, helpMode:'none', taxYear:'2026-27' });
  const got = await engine();
  // Economics from first principles: a resident's excess franking credits are
  // refunded, so the cash in hand is the dividend plus the refund.
  const grossUp = 50000*(0.30/0.70), grossed = 50000 + grossUp;
  const fullTax = (4020 + 0.30*(grossed - 45000)) + 0.02*grossed;
  const trueCash = 50000 + (grossUp - fullTax);
  check('B11c a fully franked dividend nets the real after-tax cash, with the credit counted once',
    near(got.netMonthly*12, trueCash, 0.02) && near(got.totalTax, fullTax, 0.02),
    `net ${(got.netMonthly*12).toFixed(2)} vs ${trueCash.toFixed(2)}; tax ${got.totalTax.toFixed(2)} vs ${fullTax.toFixed(2)}`);

  // Unfranked dividends must not be grossed up at all.
  await setInputs({ frankPct:0 });
  const un = await engine();
  check('B11cb an unfranked dividend is not grossed up',
    near(un.grossAssessable, 50000, 0.01) && near(un.taxable, 50000, 0.01),
    `assessable ${un.grossAssessable.toFixed(2)}, taxable ${un.taxable.toFixed(2)}`);
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
  await setInputs({ incPayg:222000, city:'Hobart', deps:3, lvrMax:85, hasIo:true });
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
  const restoredModes = await modes();
  check('B15 the mini cache restores inputs and the conditional rows they control',
    near(before.maxLoan, after.maxLoan, 1) && restored.city === 'Hobart' && restored.ioShown,
    `capacity ${before.maxLoan.toFixed(0)} → ${after.maxLoan.toFixed(0)}, payg "${restored.payg}", city ${restored.city}`);
  check('B15b the segmented controls survive the round trip too, buttons and all',
    restoredModes.incMode === 'detailed' && restoredModes.debtsMode === 'detailed'
      && restoredModes.capsMode === 'detailed'
      && await page.evaluate(() => document.querySelector('#incModeGroup .seg-btn[data-val="detailed"]').classList.contains('active')),
    `restored ${JSON.stringify(restoredModes)}`);
  await page.evaluate(() => { try { localStorage.clear(); localStorage.setItem('bc-tour-v1-seen','1'); } catch(e){} });
}

/* ══════════════ B17 — Simple and Detailed describe the same person ══════════════ */
{
  await reset();
  await setInputs({ incPayg:120000, incOvertime:20000, shdOvertime:80 });
  const detailed = await engine();

  // Detailed → Simple carries the headline across, and counts it in full, so
  // the shaded overtime is the entire difference between the two views.
  await setModes({ incModeGroup:'simple' });
  const p = await inputs(), simple = await engine();
  check('B17 Simple carries the detailed total across and assesses every dollar of it',
    p.payg === 140000 && p.shdPayg === 100 && p.overtime === 0
      && near(simple.grossAssessable, 140000, 0.01),
    `simple ${simple.grossAssessable.toFixed(0)} assessable on 140,000 entered `
    + `vs detailed ${detailed.grossAssessable.toFixed(0)} on ${detailed.grossUnshaded.toFixed(0)}`);
  check('B17b the shade boxes are gone in Simple and back in Detailed',
    !(await shown('shdPayg')) && (await setModes({ incModeGroup:'detailed' }), await shown('shdPayg')),
    'shdPayg hidden in Simple, shown in Detailed');

  // Simple → Detailed hands the number to the primary field of whichever side
  // of the Employee / Self-employed switch is showing.
  await reset();
  await setModes({ incModeGroup:'simple' });
  await setInputs({ incSimple:'90,000' });
  await setModes({ incWhoGroup:'self' });
  const seSimple = await inputs();
  await setModes({ incModeGroup:'detailed' });
  const seDetailed = await inputs();
  check('B17c the self-employed side reads the same figure as business profit, not salary',
    seSimple.seNpat === 90000 && seSimple.payg === 0 && seSimple.shdSe === 100
      && seDetailed.seNpat === 90000 && seDetailed.payg === 0,
    `simple NPAT ${seSimple.seNpat} @ ${seSimple.shdSe}%, detailed NPAT ${seDetailed.seNpat}`);
  check('B17d picking one side of the switch silences the other side entirely',
    !(await shown('incPayg')) && (await shown('incSeNpat')),
    'employment group hidden on the self-employed side');
  await reset();
}

/* ══════════════ B18 — the checklists gate the maths, not just the view ══════════════ */
{
  await reset();
  await setInputs({ incRent:30000, incFtb:8000, olBal:300000, cardLimit:25000,
                    persBal:15000, persRepay:600, bnplRepay:120, bnplLimit:2000 });
  const on = await engine();

  await setInputs({ hasInvest:false, hasGov:false, hasHomeLoan:false, hasCard:false,
                    hasPersonal:false, hasBnpl:false });
  const off = await inputs(), offR = await engine();
  check('B18 unticking a checklist box zeroes its inputs instead of leaving them live',
    off.rent === 0 && off.ftb === 0 && off.olBal === 0 && off.cardLimit === 0
      && off.persBal === 0 && off.persRepay === 0 && off.bnplRepay === 0 && off.bnplLimit === 0,
    `assessable ${on.grossAssessable.toFixed(0)} → ${offR.grossAssessable.toFixed(0)}, `
    + `commitments ${on.commitments.toFixed(0)} → ${offR.commitments.toFixed(0)}`);
  check('B18b re-ticking a box brings the same numbers back untouched',
    await (async () => {
      await setInputs({ hasInvest:true, hasGov:true, hasHomeLoan:true, hasCard:true,
                        hasPersonal:true, hasBnpl:true });
      const back = await engine();
      return near(back.maxLoan, on.maxLoan, 1);
    })(),
    `capacity returns to ${on.maxLoan.toFixed(0)}`);
  await reset();
}

/* ══════════════ B19 — HEM is stated where it is entered ══════════════ */
{
  await reset();
  await setInputs({ declaredExp:500, city:'Sydney' });
  const low = await engine();
  const noteLow = await page.evaluate(() => document.getElementById('hemNote').textContent.trim());
  const warnLow = (await kpis()).warn;
  check('B19 a declared figure under HEM says which benchmark is used, and where',
    /HEM of \$[\d,]+\/mo in Sydney will be used/.test(noteLow)
      && noteLow.includes(Math.round(low.hem).toLocaleString('en-AU')),
    `"${noteLow}"`);
  check('B19b the old "sits well under HEM" warning is gone from the banner',
    !/well under HEM/i.test(warnLow) && !/benchmark is doing all the work/i.test(warnLow),
    warnLow ? `banner now reads "${warnLow.slice(0,60)}"` : 'banner empty');

  await setInputs({ declaredExp:12000 });
  const noteHigh = await page.evaluate(() => document.getElementById('hemNote').textContent.trim());
  check('B19c a declared figure above HEM says so, and names the benchmark it beat',
    /Used as declared/.test(noteHigh) && /HEM for Sydney/.test(noteHigh), `"${noteHigh}"`);
  await reset();
}

/* ══════════════ B20 — the chart tells its five series apart ══════════════ */
{
  await reset();
  const style = await page.evaluate(() => {
    const c = window.__charts[window.__charts.length - 1];
    const ds = c.data.datasets;
    const labelColor = c.options.plugins.tooltip.callbacks.labelColor;
    return {
      labels:  ds.map(d => d.label),
      border:  ds.map(d => d.borderColor),
      point:   ds.map(d => d.pointBackgroundColor),
      swatch:  ds.map(d => labelColor({ dataset:d }).backgroundColor),
      dashes:  ds.map(d => JSON.stringify(d.borderDash))
    };
  });
  const distinct = a => new Set(a.map(v => String(v).toLowerCase())).size === a.length;
  check('B20 every series carries its own line colour, marker colour and dash',
    distinct(style.border) && distinct(style.point) && distinct(style.dashes),
    `borders ${style.border.join(' ')}`);
  check('B20b the tooltip swatch follows the line, so five rows no longer read as one colour',
    distinct(style.swatch) && style.swatch.every((c, i) => c === style.border[i]),
    `swatches ${style.swatch.join(' ')}`);
}


/* ══════════════ B21 — Simple takes the LVR ceiling and the valuation from
                        what it already knows, rather than asking ══════════════ */
{
  await reset();
  await setModes({ capsModeGroup:'simple' });
  await setInputs({ price:750000, valuation:900000, lvrMax:60, lmiCap:false });
  await openTab('caps');
  const plain = await inputs();
  await setInputs({ lmiCap:true });
  const withLmi = await inputs();
  check('B21 Simple holds the ceiling at 80% LVR, and at 95% once LMI is switched on',
    plain.lvrMax === 80 && withLmi.lvrMax === 95 && !(await shown('lvrMax')),
    `ceiling ${plain.lvrMax}% → ${withLmi.lvrMax}% with the dial itself hidden and left at 60`);
  check('B21b Simple values the property at the price, so a stale valuation cannot bind',
    plain.valuation === 750000 && !(await shown('valuation')),
    `valuation ${plain.valuation} against a price of 750,000, with 900,000 still in the hidden box`);

  await setModes({ capsModeGroup:'detailed' });
  const det = await inputs();
  check('B21c Detailed hands both controls back, opened on what Simple was using',
    det.lvrMax === 95 && det.valuation === 750000 && (await shown('lvrMax')) && (await shown('valuation')),
    `ceiling ${det.lvrMax}% and valuation ${det.valuation} carried across, rather than the 60% and 900,000 left in the boxes`);
  await openTab('income');
  await reset();
}

/* ══════════════ B22 — the deposit reads the same stated either way ══════════════ */
{
  await reset();
  await setInputs({ price:900000, valuation:900000, lvrMax:80, incPayg:400000,
                    dutyMode:'amount', dutyAmt:36000, otherCosts:4000,
                    depositMode:'amount', savings:220000 });
  const asAmount = await engine();
  const refAmount = replay(await inputs());

  // 220,000 in the bank less 40,000 of costs is a 180,000 deposit, which is the
  // same 20% of the price the percentage mode states directly.
  await setInputs({ depositMode:'pct', depositPct:20 });
  const asPct = await engine();
  const refPct = replay(await inputs());
  check('B22 an amount net of costs and the equivalent percentage give the same deposit',
    near(asAmount.funds, 180000, 0.01) && near(asPct.funds, 180000, 0.01)
      && near(asAmount.Ldep, asPct.Ldep, 0.01)
      && near(asAmount.funds, refAmount.funds, 0.01) && near(asPct.funds, refPct.funds, 0.01),
    `amount ${asAmount.funds.toFixed(0)} vs percentage ${asPct.funds.toFixed(0)}, `
    + `deposit cap ${asAmount.Ldep.toFixed(0)} vs ${asPct.Ldep.toFixed(0)}`);

  await openTab('caps');
  const noteFields = await page.evaluate(() => ({
    note: document.getElementById('depositNote').textContent.trim(),
    label: document.getElementById('depositLabel').textContent.trim(),
    pctShown: document.getElementById('depPctWrap').style.display !== 'none',
    amtShown: document.getElementById('depAmtWrap').style.display !== 'none'
  }));
  check('B22b the percentage mode shows the percentage box, and says what it costs in cash',
    noteFields.pctShown && !noteFields.amtShown
      && /20\.0% of \$900,000 is \$180,000/.test(noteFields.note)
      && /\$220,000 in the bank/.test(noteFields.note),
    `"${noteFields.note}"`);

  await setInputs({ depositMode:'amount' });
  const amtNote = await page.evaluate(() => document.getElementById('depositNote').textContent.trim());
  check('B22c the amount mode spells out the costs it absorbs and the LVR that leaves',
    /\$220,000 less \$40,000 of stamp duty and costs leaves \$180,000 as the deposit, 20\.0%/.test(amtNote),
    `"${amtNote}"`);
  await openTab('income');
  await reset();
}

/* ══════════════ B23 — the banner is a list only when there is a list ══════════════ */
{
  await reset();
  await setInputs({ refiRepay:100000 });   // exactly one point: commitments floored
  const one = await page.evaluate(() => {
    const el = document.getElementById('warnBanner');
    return { tags:[...el.children].map(c => c.tagName), bullets:/•/.test(el.textContent) };
  });
  check('B23 a single point is a plain sentence, with no bullet glyph in sight',
    one.tags.length === 1 && one.tags[0] === 'P' && !one.bullets,
    `banner children ${one.tags.join(',') || 'none'}`);

  await setInputs({ incPayg:0, incOvertime:0, incBonus:0, incAllow:0, incCasual:0,
                    incRent:0, incDiv:0, incFtb:0, incPension:0, incCsIn:0, incSeNpat:0,
                    lvrMax:90, lmiCap:false });
  const many = await page.evaluate(() => {
    const el = document.getElementById('warnBanner');
    return { tags:[...el.children].map(c => c.tagName),
             items:el.querySelectorAll('li').length, bullets:/•/.test(el.textContent) };
  });
  check('B23b several points become a real list, one <li> each',
    many.tags.length === 1 && many.tags[0] === 'UL' && many.items >= 2 && !many.bullets,
    `${many.items} list items`);
  await reset();
}

/* ══════════════ B24 — the chart cannot be panned or zoomed off the sweep ══════════════ */
{
  await reset();
  const axis = await page.evaluate(() => {
    const c = window.__charts[window.__charts.length - 1];
    const xs = c.data.datasets[0].data.map(d => d.x);
    return { min:c.options.scales.x.min, max:c.options.scales.x.max,
             limits:c.options.plugins.zoom.limits,
             dataMin:Math.min(...xs), dataMax:Math.max(...xs) };
  });
  check('B24 the x axis starts and ends on the swept range, not on rounder numbers outside it',
    near(axis.min, axis.dataMin, 1e-6) && near(axis.max, axis.dataMax, 1e-6),
    `axis ${axis.min} – ${axis.max} against data ${axis.dataMin} – ${axis.dataMax}`);
  check('B24b zoom and pan are held to the same range',
    axis.limits && axis.limits.x && near(axis.limits.x.min, axis.dataMin, 1e-6)
      && near(axis.limits.x.max, axis.dataMax, 1e-6) && axis.limits.x.minRange > 0,
    `limits ${JSON.stringify(axis.limits)}`);
}

/* ══════════════ B25 — a separator only ever sits between two visible rows ══════════════ */
{
  // The invariant: inside every card, the first row still showing opens clean
  // and every row after it carries exactly one hairline. It has to survive any
  // combination of modes and checklists, because those are what decide which
  // row is first.
  const auditRules = () => page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('.field-group, .ctrl-panel').forEach(block => {
      let seen = 0;
      block.querySelectorAll(':scope > .field-row, :scope > .toggle-row, :scope > .slider-block')
        .forEach(row => {
          if(row.style.display === 'none') return;
          const w = parseFloat(getComputedStyle(row).borderTopWidth) || 0;
          const title = block.querySelector(':scope > .group-title');
          const where = (title ? title.textContent : block.id) + ' / ' + (row.textContent.trim().slice(0,24));
          if(seen === 0 && w > 0) bad.push('rule under the card edge: ' + where);
          if(seen > 0 && w === 0) bad.push('no rule between rows: ' + where);
          seen++;
        });
    });
    return bad;
  });
  const ALL_SIMPLE = { incModeGroup:'simple', debtsModeGroup:'simple',
                       loanModeGroup:'simple', capsModeGroup:'simple' };
  const states = [
    ['everything disclosed',        async () => { await reset(); }],
    ['everything folded away',      async () => { await reset(); await setModes(ALL_SIMPLE);
                                                  await setInputs({ hasInvest:false, hasGov:false, hasHomeLoan:false,
                                                                    hasCard:false, hasPersonal:false, hasBnpl:false,
                                                                    hasSupport:false, hasRefi:false, lmiCap:false }); }],
    ['self-employed, LMI, IO loan', async () => { await reset(); await setModes({ incWhoGroup:'self' });
                                                  await setInputs({ lmiCap:true, hasIo:true, occupancy:'investor',
                                                                    helpMode:'commitment', olType:'io' }); }]
  ];
  const broken = [];
  for(const [name, apply] of states){
    await apply();
    for(const tab of ['income','house','debts','loan','caps']){
      await openTab(tab);
      (await auditRules()).forEach(b => broken.push(`${name} / ${tab}: ${b}`));
    }
  }
  check('B25 no hairline doubles a card border or underlines a group title, in any state',
    broken.length === 0,
    broken.length ? broken.slice(0,3).join(' | ')
                  : 'every card opens clean and separates its rows across all five tabs and three form states');
  await openTab('income');
  await reset();
}

/* ══════════════ B26 — two applicants are taxed as two people ══════════════ */
{
  await reset();

  // At one applicant the split is inert, whatever the slider says.
  await setInputs({ adults:'1', incSplit:0,  incPayg:140000 });
  const one0 = await engine();
  await setInputs({ incSplit:50 });
  const one50 = await engine();
  check('B26 the income split is inert at one applicant',
    near(one0.maxLoan, one50.maxLoan, 1e-6) && near(one0.totalTax, one50.totalTax, 1e-6),
    `capacity ${one0.maxLoan.toFixed(0)} at 0% and ${one50.maxLoan.toFixed(0)} at 50%`);

  // At two applicants, a split of 0 is the old single-taxpayer arithmetic.
  await setInputs({ adults:'2', incSplit:0 });
  const two0 = await engine(), p0 = await inputs();
  const single = Math.max(0, refIncomeTax(p0.payg, p0.taxYear) - refLito(p0.payg))
               + refMedicare(p0.payg, 2, 0);
  check('B26b a split of 0 reproduces the single-taxpayer figure exactly',
    near(two0.totalTax, single, 0.02) && near(two0.totalTax, one0.totalTax, 0.02),
    `pooled tax ${two0.totalTax.toFixed(2)} vs ${single.toFixed(2)}`);

  // And a real split agrees with the independent replay, and buys capacity.
  await setInputs({ incSplit:50 });
  const two50 = await engine(), p50 = await inputs(), ref50 = replay(p50);
  check('B26c a 50/50 split matches the replay and is worth real capacity',
    near(two50.totalTax, ref50.totalTax, 0.02) && near(two50.maxLoan, ref50.maxLoan, 1)
      && two50.maxLoan > two0.maxLoan,
    `tax ${two50.totalTax.toFixed(0)} vs replay ${ref50.totalTax.toFixed(0)}, capacity ${two0.maxLoan.toFixed(0)} → ${two50.maxLoan.toFixed(0)}`);

  // Splitting can only ever reduce tax, never raise it, at any income.
  const wrongWay = [];
  for(const inc of [40000, 60000, 90000, 140000, 200000, 400000]){
    await setInputs({ incPayg:inc, incSplit:0  });  const flat = (await engine()).totalTax;
    await setInputs({ incSplit:50 });               const spl  = (await engine()).totalTax;
    if(spl > flat + 0.02) wrongWay.push(`${inc}: ${flat.toFixed(0)} → ${spl.toFixed(0)}`);
  }
  check('B26d splitting never costs a couple more tax than pooling, at any income',
    wrongWay.length === 0,
    wrongWay.length ? wrongWay.join(' | ') : 'monotone across 40k to 400k');

  // The control only exists where it means something.
  await openTab('house');
  await setInputs({ adults:'2' });
  const shownAt2 = await shown('incSplitRow');
  await setInputs({ adults:'1' });
  const shownAt1 = await shown('incSplitRow');
  check('B26e the split slider appears for two applicants and not for one',
    shownAt2 && !shownAt1, `shown at 2: ${shownAt2}, shown at 1: ${shownAt1}`);
  await openTab('income');
  await reset();
}

/* ══════════════ B27 — the Quick Start scenarios ══════════════ */
{
  // Each button must land the whole form, not most of it. A typo'd element id
  // would otherwise fail silently and leave the scenario describing someone else.
  const EXPECTED = {
    'finance-bro': { modes:{ incWho:'employee', incMode:'detailed', debtsMode:'detailed', loanMode:'simple', capsMode:'simple' },
                     vals:{ city:'Sydney', adults:'1', incPayg:230000, incBonus:90000, shdBonus:80,
                            cardLimit:25000, persRepay:950, price:1700000, savings:550000 },
                     binds:'serv' },
    'couple':      { modes:{ incWho:'employee', incMode:'simple', debtsMode:'simple', loanMode:'simple', capsMode:'simple' },
                     vals:{ city:'Melbourne', adults:'2', incSplit:50, deps:2, declaredExp:4800,
                            cardLimit:15000, price:950000, savings:250000 },
                     binds:'serv' },
    'geoff':       { modes:{ incWho:'employee', incMode:'simple', debtsMode:'simple', loanMode:'simple', capsMode:'simple' },
                     vals:{ city:'Perth', adults:'1', declaredExp:2800, cardLimit:8000,
                            price:650000, savings:150000 },
                     binds:'serv' },
    'first-home':  { modes:{ incWho:'employee', incMode:'simple', debtsMode:'simple', loanMode:'simple', capsMode:'simple' },
                     vals:{ city:'Brisbane', adults:'1', declaredExp:2600, cardLimit:5000,
                            price:650000, savings:70000, dutyPct:0 },
                     binds:'dep' },
    'tradie':      { modes:{ incWho:'self', incMode:'simple', debtsMode:'simple', loanMode:'simple', capsMode:'simple' },
                     vals:{ city:'Adelaide', adults:'1', deps:1, cardLimit:20000,
                            persRepay:950, price:850000, savings:300000 },
                     binds:'serv' }
  };

  const applyPreset = key => page.evaluate(k => {
    document.querySelector('.quick-start-btn[data-preset="' + k + '"]').click();
  }, key).then(() => page.waitForTimeout(120));

  const wrong = [], mismatched = [], unmarked = [];
  for(const [key, want] of Object.entries(EXPECTED)){
    await applyPreset(key);
    const ui = await modes(), r = await engine();
    // Read the controls themselves rather than readInputs(), which renames and
    // derives. This is what catches a scenario writing to an id that no longer
    // exists, which readInputs() would quietly paper over.
    const got = await page.evaluate(ids => Object.fromEntries(ids.map(id => {
      const el = document.getElementById(id);
      return [id, el ? (el.type === 'checkbox' ? el.checked : el.value) : null];
    })), Object.keys(want.vals));

    Object.entries(want.modes).forEach(([k, v]) => {
      if(ui[k] !== v) wrong.push(`${key}.${k}: ${ui[k]} want ${v}`);
    });
    Object.entries(want.vals).forEach(([id, v]) => {
      const live = got[id];
      if(live === null){ mismatched.push(`${key}.${id}: no such control`); return; }
      const ok = typeof v === 'number'
        ? near(parseFloat(String(live).replace(/,/g, '')), v, 0.01)
        : String(live) === v;
      if(!ok) mismatched.push(`${key}.${id}: ${live} want ${v}`);
    });
    if(!(await page.evaluate(k => {
      const on = document.querySelectorAll('.quick-start-btn.active');
      return on.length === 1 && on[0].dataset.preset === k;
    }, key))) unmarked.push(key);
    if(r.binding !== ({ serv:'Serviceability', dti:'Debt to income', lvr:'Loan to value', dep:'Deposit' })[want.binds])
      wrong.push(`${key} binds on ${r.binding}, want ${want.binds}`);
  }
  check('B27 every Quick Start scenario applies its modes in full',
    wrong.length === 0, wrong.length ? wrong.slice(0,4).join(' | ') : 'five scenarios, modes and binding cap as specified');
  check('B27b every Quick Start scenario applies its figures in full',
    mismatched.length === 0, mismatched.length ? mismatched.slice(0,4).join(' | ') : 'every checked field landed');
  check('B27c the chosen scenario is the only one highlighted',
    unmarked.length === 0, unmarked.length ? unmarked.join(' | ') : 'exactly one active button each time');

  // The first home buyer is the one scenario that binds on the deposit, and
  // capitalising LMI is the lever its tooltip points at. If a later tweak to
  // duty or HEM quietly moves that, this is what says so.
  await applyPreset('first-home');
  const fhBefore = await engine();
  await setInputs({ lmiCap:true });
  const fhAfter = await engine();
  // Changing the binding cap is not enough. Capitalising the premium divides
  // serviceability by 1 + the rate, so on a deposit that is only just the
  // tightest cap, LMI makes the borrower WORSE off and the tooltip becomes a
  // lie. Capacity has to go UP.
  check('B27d the first home buyer binds on the deposit, and capitalising LMI lifts capacity',
    fhBefore.binding === 'Deposit' && fhAfter.binding !== 'Deposit'
      && fhAfter.maxLoan > fhBefore.maxLoan,
    `${fhBefore.binding} $${fhBefore.maxLoan.toFixed(0)} → ${fhAfter.binding} $${fhAfter.maxLoan.toFixed(0)}, ` +
    `${fhAfter.maxLoan > fhBefore.maxLoan ? '+' : ''}$${(fhAfter.maxLoan - fhBefore.maxLoan).toFixed(0)} with LMI capitalised`);

  // No scenario should ship on a knife edge. A binding cap sitting within a few
  // percent of the next one means a small change to duty, HEM or a tax scale
  // silently rewrites which lesson the button teaches.
  const thin = [];
  for(const key of Object.keys(EXPECTED)){
    await applyPreset(key);
    const r = await engine();
    const caps = [r.Lserv, r.Ldti, r.Llvr, r.Ldep].sort((a, b) => a - b);
    const margin = (caps[1] - caps[0]) / caps[0];
    if(margin < 0.05) thin.push(`${key}: ${(margin*100).toFixed(1)}% over ${r.binding}`);
  }
  check('B27g no scenario binds within 5% of the next cap',
    thin.length === 0,
    thin.length ? thin.join(' | ') : 'every scenario clears its second cap by more than 5%');

  // Reset has to clear the highlight, or the page claims a scenario it no
  // longer shows.
  await applyPreset('geoff');
  await page.evaluate(() => document.getElementById('resetBtn').click());
  await page.waitForTimeout(120);
  check('B27e Reset drops the scenario highlight along with the figures',
    await page.evaluate(() => !document.querySelector('.quick-start-btn.active')
      && document.getElementById('incSimple').value === '140,000'),
    'no active button and the default income back');

  // A scenario must not inherit the last one's checklist boxes.
  await applyPreset('tradie');          // ticks hasPersonal
  await applyPreset('geoff');           // does not
  const carried = await inputs();
  check('B27f a scenario does not inherit the previous one\'s commitments',
    near(carried.persRepay, 0, 1e-9) && near(carried.persBal, 0, 1e-9),
    `personal repayment ${carried.persRepay}, balance ${carried.persBal} after switching from the tradie`);
  await reset();
}

/* ══════════════ B28 — the guided tour ══════════════ */
{
  await reset();
  const cfg = await page.evaluate(() => ({
    seenKey: window.__TOUR.seenKey,
    steps: window.__TOUR.steps.length,
    targets: window.__TOUR.steps.map(s => s.target),
    hasSave: typeof window.__TOUR.saveState === 'function',
    hasRestore: typeof window.__TOUR.restoreState === 'function'
  }));
  // Every selector a step names has to resolve to something with a real box,
  // or the spotlight punches a hole in an empty corner of the page.
  const unreachable = [];
  for(const t of cfg.targets){
    if(!t) continue;
    const ok = await page.evaluate(sel => {
      const el = document.querySelector(sel);
      if(!el) return false;
      const r = el.getBoundingClientRect();
      return r.width >= 4 && r.height >= 4;
    }, t);
    if(!ok) unreachable.push(t);
  }
  check('B28 every tour step points at an element that is really on screen',
    cfg.steps > 0 && unreachable.length === 0 && cfg.hasSave && cfg.hasRestore,
    unreachable.length ? unreachable.join(' | ')
                       : `${cfg.steps} steps, seenKey ${cfg.seenKey}, state handed back`);

  // saveState returns null on a page nobody has touched, so a first-time
  // visitor keeps the demo instead of being dumped back on the default.
  await page.evaluate(() => document.getElementById('resetBtn').click());
  await page.waitForTimeout(120);
  const pristine = await page.evaluate(() => window.__BC_TOUR.saveState());
  check('B28b a pristine page has nothing worth handing back',
    pristine === null, `saveState() returned ${JSON.stringify(pristine) === 'null' ? 'null' : 'a snapshot'}`);

  // And a page the user has worked on comes back exactly as they left it,
  // fields, checkboxes, segmented controls and all.
  await setModes({ loanModeGroup:'detailed' });
  await setInputs({ incSimple:172500, city:'Hobart', adults:'1', declaredExp:3150, hasBnpl:true });
  const before = await page.evaluate(() => ({
    inc:document.getElementById('incSimple').value, city:document.getElementById('city').value, adults:document.getElementById('adults').value, exp:document.getElementById('declaredExp').value,
    bnpl:document.getElementById('hasBnpl').checked, ui:{ ...window.__BC.UI }
  }));
  const snap = await page.evaluate(() => window.__BC_TOUR.saveState());
  await page.evaluate(() => window.__BC_TOUR.seedMan());
  await page.waitForTimeout(120);
  const seeded = await page.evaluate(() => document.getElementById('incSimple').value);
  await page.evaluate(s => window.__BC_TOUR.restoreState(s), snap);
  await page.waitForTimeout(120);
  const after = await page.evaluate(() => ({
    inc:document.getElementById('incSimple').value, city:document.getElementById('city').value, adults:document.getElementById('adults').value, exp:document.getElementById('declaredExp').value,
    bnpl:document.getElementById('hasBnpl').checked, ui:{ ...window.__BC.UI }
  }));
  check('B28c the tour seeds a scenario and hands the user their own work back',
    snap !== null && seeded === '105,000' && JSON.stringify(before) === JSON.stringify(after),
    `seeded ${seeded}, restored ${JSON.stringify(after.inc)} in ${after.city} with loan mode ${after.ui.loanMode}`);
  await reset();
}

/* ══════════════ B16 — nothing threw along the way ══════════════ */
check('B16 no page errors across the whole run', pageErrors.length === 0,
  pageErrors.length ? pageErrors.slice(0,4).join(' | ') : 'clean');

await browser.close();
console.log(`\nborrowingcapacity audit: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
