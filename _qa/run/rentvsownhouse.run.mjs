// Phase 2 — drive the REAL Rent vs Own pages and record what they produce.
//
// Series come from the page's OWN CSV export, which carries full precision
// where the on-screen table is compact ("$1.2M"). The export is intercepted at
// delivery only: RVOExport.downloadCSV is replaced with a collector, so the CSV
// text is still built by the page's own code from the page's own rows.
//
// Nothing here re-implements the model. Residual observables are arithmetic on
// figures already read back, exactly as the contract defines them.
import { boot, fileUrl, contract, money, emit, runCase } from './_driver.mjs';

const C = contract('rentvsownhouse');
const byId = Object.fromEntries(C.cases.map(c => [c.id, c]));
const BASE = C.baseline;
const RF = 0.045;                      // the baseline risk-free rate, as entered

const { browser, page, errors } = await boot();

/* ── driving the form ───────────────────────────────────────────────────── */

async function goto(rel) {
  await page.goto(fileUrl(rel), { waitUntil: 'load' });
  await page.evaluate(() => { try { localStorage.clear(); } catch (_) { } });
  await page.addInitScript(() => { });
  await page.waitForTimeout(250);
  // Collect CSV exports instead of downloading them.
  await page.evaluate(() => {
    window.__csv = {};
    if (window.RVOExport) {
      window.__origDownloadCSV = window.RVOExport.downloadCSV;
      window.RVOExport.downloadCSV = (name, csv) => { window.__csv[name] = csv; };
    }
  });
}

async function set(id, value) {
  return page.evaluate(({ id, value }) => {
    const el = document.getElementById(id);
    if (!el) return 'missing:' + id;
    if (el.type === 'checkbox') {
      if (el.checked !== !!value) el.click();
      return el.checked;
    }
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    return el.value;
  }, { id, value });
}

async function seg(groupId, dataVal) {
  return page.evaluate(({ groupId, dataVal }) => {
    const g = document.getElementById(groupId);
    if (!g) return 'missing:' + groupId;
    const b = [...g.querySelectorAll('.seg-btn')].find(x => x.dataset.val === dataVal);
    if (!b) return 'no-btn:' + dataVal;
    b.click();
    return b.classList.contains('active');
  }, { groupId, dataVal });
}

/** Apply the contract's baseline block, field by field. */
async function baseline() {
  await page.evaluate(() => document.getElementById('resetBtn')?.click());
  await page.waitForTimeout(200);
  await set('currencySymbol', '$');
  await set('riskFreeRate', 4.5);
  await set('initialCash', '');
  await set('monthlyBudget', '');
  await set('horizon', 30);
  await set('rtbEnabled', false);
  await set('propertyPrice', 800000);
  await set('downPaymentPct', 20);
  await seg('mortgageModeGroup', 'simple');
  await set('mortgageRate', 6.0);
  await set('mortgageTerm', 30);
  await set('houseGrowth', 5.0);
  await seg('ownCostsModeGroup', 'simple');
  await set('setupCost', 32000);
  await set('setupCostType', 'dollar');
  await set('ownOngoingCost', 6000);
  await set('ownOngoingCostFreq', 'yearly');
  await set('ownOngoingCostType', 'dollar');
  await set('ownOngoingInflation', 0);
  await set('rentAmount', 2800);
  await set('rentFreq', 'monthly');
  await set('rentInflation', 3.0);
  await seg('rentCostsModeGroup', 'simple');
  await set('rentOngoingCost', 1200);
  await set('rentOngoingCostFreq', 'yearly');
  await set('rentOngoingCostType', 'dollar');
  await set('rentOngoingInflation', 0);
  await page.waitForTimeout(300);
}

/** Apply an override map whose keys are "#id" (values may be '' to clear). */
async function overrides(map = {}) {
  for (const [k, v] of Object.entries(map)) {
    if (!k.startsWith('#')) continue;
    if (typeof v === 'string' && /^\(|leave|checked|blank|auto/i.test(v) && !/^\d/.test(v)) {
      if (/^checked$/i.test(v)) await set(k.slice(1), true);
      continue;
    }
    await set(k.slice(1), v);
  }
  await page.waitForTimeout(300);
}

/* ── reading the page ───────────────────────────────────────────────────── */

/** Select a detail table tab and pull the page's own CSV for it. */
async function csv(which) {
  const ok = await page.evaluate(w => {
    const b = [...document.querySelectorAll('.tab-btn[data-table]')].find(x => x.dataset.table === w);
    if (!b || b.offsetParent === null) return false;
    b.click();
    return true;
  }, which);
  if (!ok) return null;
  await page.waitForTimeout(200);
  const text = await page.evaluate(() => {
    window.__csv = {};
    document.getElementById('downloadBtn')?.click();
    return Object.values(window.__csv)[0] || null;
  });
  if (!text) return null;
  // Strip the export's comment prefix, then parse.
  const lines = text.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
  const head = lines[0].split(',').map(s => s.trim());
  return lines.slice(1).map(l => {
    const cols = l.split(',');
    const o = {};
    head.forEach((h, i) => {
      const raw = (cols[i] ?? '').trim();
      o[h] = (raw === '' || raw === '—' || raw === 'na') ? null : (isNaN(Number(raw)) ? raw : Number(raw));
    });
    return o;
  });
}

const rowAt = (rows, y) => (rows || []).find(r => Number(r.Year) === y) || null;
const col = (rows, key) => (rows || []).map(r => r[key]);

async function kpis() {
  return page.evaluate(() => {
    const g = id => { const e = document.getElementById(id); return e ? e.textContent.trim() : null; };
    return {
      initialCash: g('kpiInitialCash'), budgetRange: g('kpiBudgetRange'),
      breakeven: g('kpiBreakeven'), diff: g('kpiDiff'),
      warn: (() => { const e = document.getElementById('warningBanner'); return e && e.style.display !== 'none' ? e.textContent.trim() : ''; })(),
      cashWarn: (() => { const e = document.getElementById('initialCashWarn'); return e && e.style.display !== 'none' ? e.textContent.trim() : ''; })(),
      rentMonthlyDisplay: g('rentMonthlyDisplay'),
      bodyNaN: ((document.body.innerText || '').match(/NaN|Infinity|undefined|null/g) || []).length,
    };
  });
}

function breakevenYear(k) {
  const t = String(k.breakeven || '');
  if (/never|n\/a|beyond|^—|^-$/i.test(t)) return null;
  const n = money(t);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function budgetRange(k) {
  const parts = String(k.budgetRange || '').split(/[–—-]|to/).map(s => money(s)).filter(Number.isFinite);
  return { min: parts[0] ?? null, max: parts[parts.length - 1] ?? null };
}

/** max |end − (begin·(1+rf) + budget − outflow)| over the years present. */
function cashIdentityMaxAbs(rows, { begin, budget, outflows, end }, skipYears = []) {
  let worst = 0;
  for (const r of rows) {
    const y = Number(r.Year);
    if (y === 0 || skipYears.includes(y)) continue;
    if (r[begin] === null || r[end] === null) continue;
    const out = outflows.reduce((a, k) => a + (r[k] || 0), 0);
    const pred = r[begin] * (1 + RF) + (r[budget] || 0) - out;
    worst = Math.max(worst, Math.abs(r[end] - pred));
  }
  return worst;
}

const OWN_OUT = ['Principal_Exp', 'Interest_Exp', 'Ongoing_Exp'];
const RENT_OUT = ['Rent_Exp', 'Ongoing_Exp'];

/* ── cases ──────────────────────────────────────────────────────────────── */

const cases = {};
await goto('rentvsownhouse/index.html');

await runCase(cases, 'N1', async () => {
  await baseline();
  const own = await csv('own'), rent = await csv('rent'), k = await kpis();
  if (!own || !rent) throw new Error('CSV export produced nothing for own/rent');
  const y = n => rowAt(own, n), ry = n => rowAt(rent, n);
  const bal = n => { const r = y(n); return r ? r.Principal_Left : null; };
  const mortY1 = (y(1)?.Principal_Exp || 0) + (y(1)?.Interest_Exp || 0);
  const out = {
    kpiInitialCash: money(k.initialCash),
    budgetMonthlyMin: budgetRange(k).min,
    loanAtStart: bal(0),
    mortgagePaymentMonthly: mortY1 / 12,
    mortgagePaidYear1: mortY1,
    mortgagePaidYear30: (y(30)?.Principal_Exp || 0) + (y(30)?.Interest_Exp || 0),
    loanBalanceEndY1: bal(1), loanBalanceEndY5: bal(5), loanBalanceEndY10: bal(10),
    loanBalanceEndY15: bal(15), loanBalanceEndY20: bal(20), loanBalanceEndY25: bal(25),
    loanBalanceEndY29: bal(29), loanBalanceEndY30: bal(30),
    principalPaidTotal: own.reduce((a, r) => a + (r.Principal_Exp || 0), 0),
    interestPaidTotal: own.reduce((a, r) => a + (r.Interest_Exp || 0), 0),
    propertyValueY1: y(1)?.Prop_Value, propertyValueY10: y(10)?.Prop_Value, propertyValueY30: y(30)?.Prop_Value,
    ownOngoingYear1: y(1)?.Ongoing_Exp, ownOngoingYear30: y(30)?.Ongoing_Exp,
    ownOutflowYear1: OWN_OUT.reduce((a, c2) => a + (y(1)?.[c2] || 0), 0),
    ownOutflowYear30: OWN_OUT.reduce((a, c2) => a + (y(30)?.[c2] || 0), 0),
    rentOutflowYear1: RENT_OUT.reduce((a, c2) => a + (ry(1)?.[c2] || 0), 0),
    rentOutflowYear2: RENT_OUT.reduce((a, c2) => a + (ry(2)?.[c2] || 0), 0),
    rentOutflowYear30: RENT_OUT.reduce((a, c2) => a + (ry(30)?.[c2] || 0), 0),
    budgetYear1: y(1)?.Ann_Budget,
    ownCashEndY0: y(0)?.End_Cash, rentCashEndY0: ry(0)?.End_Cash,
    ownCashEndY1: y(1)?.End_Cash, rentCashEndY1: ry(1)?.End_Cash,
    ownCashIdentityResidualMaxAbs: cashIdentityMaxAbs(own, { begin: 'Beg_Cash', budget: 'Ann_Budget', outflows: OWN_OUT, end: 'End_Cash' }),
    rentCashIdentityResidualMaxAbs: cashIdentityMaxAbs(rent, { begin: 'Beg_Cash', budget: 'Ann_Budget', outflows: RENT_OUT, end: 'End_Cash' }),
    nanCount: k.bodyNaN,
  };
  out.ownTerminalResidual = (y(30)?.Net_Equity ?? 0) - ((y(30)?.Prop_Value ?? 0) - (y(30)?.Principal_Left ?? 0) + (y(30)?.End_Cash ?? 0));
  out.rentTerminalResidual = (ry(30)?.Net_Equity ?? 0) - (ry(30)?.End_Cash ?? 0);
  return out;
});
cases['N1'].notes = "Series from the page's own CSV export (integer precision); the on-screen table is compact so it cannot carry the residual checks.";

await runCase(cases, 'R1', async () => {
  const o = byId.R1.setup.overrides, out = {};
  for (const st of ['A', 'B', 'C', 'D']) {
    await baseline();
    if (st === 'B') { await set('monthlyBudget', 5000); await set('monthlyBudgetIncrease', 2.0); }
    if (st === 'C') { await set('rtbEnabled', true); await set('rtbBuyYear', 5); }
    if (st === 'D') { await set('rtbEnabled', true); await set('rtbBuyYear', 5); await set('monthlyBudget', 5000); await set('monthlyBudgetIncrease', 2.0); }
    await page.waitForTimeout(300);
    const own = await csv('own'), rent = await csv('rent');
    const rtb = (st === 'C' || st === 'D') ? await csv('rtb') : null;
    const k = await kpis();
    const budgets = [col(own, 'Ann_Budget'), col(rent, 'Ann_Budget')];
    if (rtb) budgets.push(col(rtb, 'Ann_Budget'));
    let worst = 0;
    for (let i = 0; i < budgets[0].length; i++) {
      const vals = budgets.map(b => b[i]).filter(v => v !== null && v !== undefined);
      if (vals.length > 1) worst = Math.max(worst, Math.max(...vals) - Math.min(...vals));
    }
    out[`${st}_budgetDiffMaxAbs`] = worst;
    if (st === 'A') {
      out.A_budgetYear1 = rowAt(own, 1)?.Ann_Budget;
      // auto budget should equal max(own outflow, rent outflow) each year
      let w2 = 0;
      for (const r of own) {
        const yv = Number(r.Year); if (yv === 0) continue;
        const rr = rowAt(rent, yv); if (!rr) continue;
        const oOut = OWN_OUT.reduce((a, c2) => a + (r[c2] || 0), 0);
        const rOut = RENT_OUT.reduce((a, c2) => a + (rr[c2] || 0), 0);
        w2 = Math.max(w2, Math.abs((r.Ann_Budget || 0) - Math.max(oOut, rOut)));
      }
      out.A_budgetEqualsMaxOfOutflowsMaxAbs = w2;
    }
    if (st === 'B') {
      out.B_budgetYear1 = rowAt(own, 1)?.Ann_Budget;
      out.B_budgetYear2 = rowAt(own, 2)?.Ann_Budget;
      out.B_budgetYear3 = rowAt(own, 3)?.Ann_Budget;
      out.B_budgetYear30 = rowAt(own, 30)?.Ann_Budget;
      const br = budgetRange(k);
      out.B_kpiBudgetMonthlyMin = br.min; out.B_kpiBudgetMonthlyMax = br.max;
    }
    if (st === 'D') out.D_budgetYear30 = rowAt(own, 30)?.Ann_Budget;
  }
  return out;
});
cases['R1'].notes = "IMPORTANT: the page's rent CSV writes the Own budget field into the Rent budget column, so an own-vs-rent budget difference read from the export is 0 by construction and cannot independently confirm parity. The RTB comparison in states C and D is the part that carries information.";

await runCase(cases, 'R2', async () => {
  const out = {};
  for (const [st, budget] of [['A', 3500], ['B', 2000]]) {
    await baseline();
    await set('monthlyBudget', budget); await set('monthlyBudgetIncrease', 0);
    await page.waitForTimeout(300);
    const own = await csv('own'), rent = await csv('rent'), k = await kpis();
    if (st === 'A') {
      out.A_ownCashEndY1 = rowAt(own, 1)?.End_Cash;
      out.A_ownCashEndY2 = rowAt(own, 2)?.End_Cash;
      out.A_ownCashEndY5 = rowAt(own, 5)?.End_Cash;
      out.A_ownCashEndY30 = rowAt(own, 30)?.End_Cash;
      out.A_ownCashYears1to5 = [1, 2, 3, 4, 5].map(y => rowAt(own, y)?.End_Cash);
      out.A_ownCashIdentityResidualMaxAbs = cashIdentityMaxAbs(own, { begin: 'Beg_Cash', budget: 'Ann_Budget', outflows: OWN_OUT, end: 'End_Cash' });
      out.A_rentCashEndY1 = rowAt(rent, 1)?.End_Cash;
      out.A_rentCashEndY30 = rowAt(rent, 30)?.End_Cash;
      out.A_warningBannerText = k.warn;
    } else {
      out.B_ownCashEndY1 = rowAt(own, 1)?.End_Cash;
      out.B_rentCashEndY1 = rowAt(rent, 1)?.End_Cash;
      out.B_warningBannerText = k.warn;
    }
  }
  return out;
});

await runCase(cases, 'R3', async () => {
  await baseline();
  const own = await csv('own'), rent = await csv('rent'), k = await kpis();
  const o30 = rowAt(own, 30), r30 = rowAt(rent, 30);
  const out = {
    propertyValueFinal: o30?.Prop_Value, loanBalanceFinal: o30?.Principal_Left,
    ownCashFinal: o30?.End_Cash, ownNetEquityFinal: o30?.Net_Equity,
    rentCashFinal: r30?.End_Cash, rentNetEquityFinal: r30?.Net_Equity,
    ownEquityExCashFinal: o30?.House_Equity,
  };
  out.ownTerminalResidual = (o30?.Net_Equity ?? 0) - ((o30?.Prop_Value ?? 0) - (o30?.Principal_Left ?? 0) + (o30?.End_Cash ?? 0));
  out.rentTerminalResidual = (r30?.Net_Equity ?? 0) - (r30?.End_Cash ?? 0);
  out.kpiDiffMinusFinalDelta = money(k.diff) - ((o30?.Net_Equity ?? 0) - (r30?.Net_Equity ?? 0));
  return out;
});

await runCase(cases, 'R8', async () => {
  const out = {};
  // A: strong growth -> owner ahead from year 1
  await baseline(); await set('houseGrowth', 10.0); await page.waitForTimeout(300);
  let own = await csv('own'), rent = await csv('rent'), k = await kpis();
  out.A_breakevenYear = breakevenYear(k);
  out.A_ownMinusRentNetEquityY1 = (rowAt(own, 1)?.Net_Equity ?? 0) - (rowAt(rent, 1)?.Net_Equity ?? 0);
  // B: falling prices, flat rent -> never crosses
  await baseline(); await set('houseGrowth', -5.0); await set('rentInflation', 0.0); await page.waitForTimeout(300);
  own = await csv('own'); rent = await csv('rent'); k = await kpis();
  out.B_breakevenYear = breakevenYear(k);
  out.B_ownMinusRentNetEquityY30 = (rowAt(own, 30)?.Net_Equity ?? 0) - (rowAt(rent, 30)?.Net_Equity ?? 0);
  // C: double crossing fixture
  await baseline();
  await set('houseGrowth', 1.0); await set('riskFreeRate', 4.5);
  await set('rentAmount', 5500); await set('rentFreq', 'monthly'); await set('rentInflation', -6.0);
  await set('monthlyBudget', 5000); await set('monthlyBudgetIncrease', 0);
  await page.waitForTimeout(300);
  own = await csv('own'); rent = await csv('rent'); k = await kpis();
  const delta = [];
  for (const r of own) {
    const y = Number(r.Year); const rr = rowAt(rent, y);
    if (!rr) continue;
    delta.push({ y, d: (r.Net_Equity ?? 0) - (rr.Net_Equity ?? 0) });
  }
  const series = delta.filter(x => x.y >= 1);
  out.C_ownMinusRentNetEquityByYear = series.map(x => x.d);
  let crossings = 0, firstOvertake = null;
  for (let i = 1; i < series.length; i++) {
    const a = series[i - 1].d, b = series[i].d;
    if ((a < 0 && b >= 0) || (a >= 0 && b < 0)) crossings++;
    if (firstOvertake === null && b >= 0 && a < 0) firstOvertake = series[i].y;
  }
  if (firstOvertake === null && series.length && series[0].d >= 0) firstOvertake = series[0].y;
  out.C_crossingCount = crossings;
  out.C_firstOvertakeYearFromSeries = firstOvertake;
  out.C_breakevenYear = breakevenYear(k);
  out.C_breakevenMinusFirstOvertake = (out.C_breakevenYear ?? 0) - (firstOvertake ?? 0);
  out.C_ownMinusRentNetEquityY8 = series.find(x => x.y === 8)?.d ?? null;
  out.C_ownMinusRentNetEquityY30 = series.find(x => x.y === 30)?.d ?? null;
  return out;
});

await runCase(cases, 'R10', async () => {
  const out = {};
  const ownOngoing = async ys => { const own = await csv('own'); return ys.map(y => rowAt(own, y)?.Ongoing_Exp); };
  const rentOngoing = async ys => { const rent = await csv('rent'); return ys.map(y => rowAt(rent, y)?.Ongoing_Exp); };
  // A: % of property value
  await baseline(); await set('ownOngoingCostType', 'pct'); await set('ownOngoingCost', 1);
  await set('ownOngoingCostFreq', 'yearly');
  await page.waitForTimeout(300);
  out.A_inflationControlState = await page.evaluate(() => {
    const r = document.getElementById('ownOngoingInflationRow');
    return r ? (r.offsetParent === null ? 'hidden' : 'visible') : 'absent';
  });
  [out.A_ownOngoingYear1, out.A_ownOngoingYear2, out.A_ownOngoingYear30] = await ownOngoing([1, 2, 30]);
  // B: $ with inflation
  await baseline(); await set('ownOngoingCostType', 'dollar'); await set('ownOngoingCost', 6000);
  await set('ownOngoingCostFreq', 'yearly'); await set('ownOngoingInflation', 10.0);
  await page.waitForTimeout(300);
  [out.B_ownOngoingYear1, out.B_ownOngoingYear2, out.B_ownOngoingYear5, out.B_ownOngoingYear30] = await ownOngoing([1, 2, 5, 30]);
  // C: % of rent
  await baseline(); await set('rentOngoingCostType', 'pct'); await set('rentOngoingCost', 10);
  await set('rentOngoingCostFreq', 'yearly');
  await page.waitForTimeout(300);
  [out.C_rentOngoingYear1, out.C_rentOngoingYear2, out.C_rentOngoingYear30] = await rentOngoing([1, 2, 30]);
  // D: setup as % vs $
  await baseline(); await set('setupCostType', 'pct'); await set('setupCost', 4);
  await page.waitForTimeout(300);
  let k = await kpis(); const pctCash = money(k.initialCash), pctDiff = money(k.diff);
  await baseline(); await set('setupCostType', 'dollar'); await set('setupCost', 32000);
  await page.waitForTimeout(300);
  k = await kpis();
  out.D_kpiInitialCash = pctCash;
  out.D_kpiDiffPctSetupMinusDollarSetup = pctDiff - money(k.diff);
  // E: mode round trip
  await baseline(); await page.waitForTimeout(200);
  const before = money((await kpis()).diff);
  await seg('ownCostsModeGroup', 'detailed'); await page.waitForTimeout(200);
  await seg('ownCostsModeGroup', 'simple');
  await seg('rentCostsModeGroup', 'detailed'); await page.waitForTimeout(200);
  await seg('rentCostsModeGroup', 'simple');
  await page.waitForTimeout(300);
  out.E_kpiDiffRoundTripMinusBefore = money((await kpis()).diff) - before;
  out.E_kpiDiffDetailedEquivalentMinusSimple = null;   // see notes
  return out;
});
cases['R10'].notes = "E's detailed-equivalent comparison is reported null: building the detailed cost lists needs the dynamic .cost-item-row editor, which this runner does not drive. The round-trip half of E is measured.";

await runCase(cases, 'R11', async () => {
  const out = {};
  const disp = async () => (await kpis()).rentMonthlyDisplay;
  // A: weekly 700
  await baseline(); await set('rentFreq', 'weekly'); await set('rentAmount', 700); await page.waitForTimeout(300);
  out.A_rentMonthlyDisplayValue = money(await disp());
  let rent = await csv('rent');
  out.A_rentPaidYear1 = rowAt(rent, 1)?.Rent_Exp; out.A_rentPaidYear2 = rowAt(rent, 2)?.Rent_Exp;
  // B: yearly 36000
  await baseline(); await set('rentFreq', 'yearly'); await set('rentAmount', 36000); await page.waitForTimeout(300);
  out.B_rentMonthlyDisplayValue = money(await disp());
  rent = await csv('rent'); out.B_rentPaidYear1 = rowAt(rent, 1)?.Rent_Exp;
  // C/D: own ongoing weekly / monthly
  await baseline(); await set('ownOngoingCostFreq', 'weekly'); await set('ownOngoingCost', 100);
  await set('ownOngoingCostType', 'dollar'); await page.waitForTimeout(300);
  out.C_ownOngoingYear1 = rowAt(await csv('own'), 1)?.Ongoing_Exp;
  await baseline(); await set('ownOngoingCostFreq', 'monthly'); await set('ownOngoingCost', 500);
  await set('ownOngoingCostType', 'dollar'); await page.waitForTimeout(300);
  out.D_ownOngoingYear1 = rowAt(await csv('own'), 1)?.Ongoing_Exp;
  // E: rent ongoing weekly
  await baseline(); await set('rentOngoingCostFreq', 'weekly'); await set('rentOngoingCost', 20);
  await set('rentOngoingCostType', 'dollar'); await page.waitForTimeout(300);
  out.E_rentOngoingYear1 = rowAt(await csv('rent'), 1)?.Ongoing_Exp;
  // F: baseline monthly
  await baseline(); await page.waitForTimeout(200);
  out.F_rentMonthlyDisplayValue = money(await disp());
  return out;
});

await runCase(cases, 'R7', async () => {
  const out = {};
  const applyRtb = async (buyYear, extra = {}) => {
    await baseline();
    await set('rtbEnabled', true);
    await set('rtbBuyYear', buyYear);
    for (const [k, v] of Object.entries(extra)) await set(k, v);
    await page.waitForTimeout(350);
  };
  // A
  await applyRtb(5, { monthlyBudget: 5000, monthlyBudgetIncrease: 0 });
  let rtb = await csv('rtb'), rent = await csv('rent'), own = await csv('own');
  if (!rtb) throw new Error('RTB table tab produced no CSV (is #rtbTableTab visible?)');
  const rtbCol = k => (rtb.find(r => Object.keys(r).some(x => x === k)) ? k : null);
  const pick = (r, names) => { for (const n of names) if (r && r[n] !== undefined) return r[n]; return null; };
  let worst = 0;
  for (let y = 1; y <= 5; y++) {
    const a = pick(rowAt(rtb, y), ['End_Cash']), b = pick(rowAt(rent, y), ['End_Cash']);
    if (a !== null && b !== null) worst = Math.max(worst, Math.abs(a - b));
  }
  out.A_rtbMinusRentCashMaxAbsY1to5 = worst;
  const r6 = rowAt(rtb, 6), r5 = rowAt(rtb, 5);
  out.A_rtbPurchasePrice = pick(r6, ['Prop_Value']);
  out.A_rtbLoanAtPurchase = pick(rowAt(rtb, 5), ['Principal_Left']) ?? pick(r6, ['Principal_Left']);
  out.A_rtbMortgagePaidYear6 = (pick(r6, ['Principal_Exp']) || 0) + (pick(r6, ['Interest_Exp']) || 0);
  out.A_rtbPropertyValueY6 = pick(r6, ['Prop_Value']);
  out.A_rtbLoanBalanceEndY6 = pick(r6, ['Principal_Left']);
  out.A_rtbCashEndY6 = pick(r6, ['End_Cash']);
  out.A_rtbNetEquityResidualY6 = (pick(r6, ['Net_Equity']) ?? 0) -
    ((pick(r6, ['Prop_Value']) ?? 0) - (pick(r6, ['Principal_Left']) ?? 0) + (pick(r6, ['End_Cash']) ?? 0));
  out.A_rtbConservationResidualY6 = null;   // see notes
  out.A_rtbCashIdentityResidualMaxAbsY7toEnd = (() => {
    let w = 0;
    for (const r of rtb) {
      const y = Number(r.Year); if (y < 7) continue;
      if (r.Beg_Cash === null || r.End_Cash === null) continue;
      const outflow = ['Principal_Exp', 'Interest_Exp', 'Ongoing_Exp', 'Rent_Exp']
        .reduce((a, k2) => a + (r[k2] || 0), 0);
      w = Math.max(w, Math.abs(r.End_Cash - (r.Beg_Cash * (1 + RF) + (r.Ann_Budget || 0) - outflow)));
    }
    return w;
  })();
  // B: thin initial cash
  await applyRtb(5, { initialCash: 10000, monthlyBudget: 3000, monthlyBudgetIncrease: 0 });
  rtb = await csv('rtb'); rent = await csv('rent');
  out.B_rentCashEndY5 = rowAt(rent, 5)?.End_Cash;
  out.B_rtbCashEndY6 = rowAt(rtb, 6)?.End_Cash;
  out.B_rtbLoanAtPurchase = rowAt(rtb, 6)?.Principal_Left;
  out.B_rtbConservationResidualY6 = null;
  // C: cash above the whole house
  await applyRtb(5, { initialCash: 2000000, monthlyBudget: 5000, monthlyBudgetIncrease: 0 });
  rtb = await csv('rtb'); own = await csv('own');
  let k2 = await kpis();
  out.C_kpiInitialCash = money(k2.initialCash);
  out.C_ownCashEndY0 = rowAt(own, 0)?.End_Cash;
  out.C_ownCashEndY1 = rowAt(own, 1)?.End_Cash;
  out.C_rtbLoanAtPurchase = rowAt(rtb, 6)?.Principal_Left;
  out.C_rtbCashEndY6 = rowAt(rtb, 6)?.End_Cash;
  out.C_rtbConservationResidualY6 = null;
  // D: buy in year 1
  await applyRtb(1, { monthlyBudget: 5000, monthlyBudgetIncrease: 0 });
  rtb = await csv('rtb'); rent = await csv('rent');
  out.D_rtbPurchasePrice = rowAt(rtb, 2)?.Prop_Value;
  out.D_rtbLoanAtPurchase = rowAt(rtb, 1)?.Principal_Left ?? rowAt(rtb, 2)?.Principal_Left;
  out.D_rtbMortgagePaidYear2 = (rowAt(rtb, 2)?.Principal_Exp || 0) + (rowAt(rtb, 2)?.Interest_Exp || 0);
  out.D_rtbMinusRentCashY1 = (rowAt(rtb, 1)?.End_Cash ?? 0) - (rowAt(rent, 1)?.End_Cash ?? 0);
  out.D_rtbCashEndY2 = rowAt(rtb, 2)?.End_Cash;
  out.D_rtbConservationResidualY2 = null;
  // E: buy at the horizon
  await applyRtb(30, { horizon: 30, monthlyBudget: 5000, monthlyBudgetIncrease: 0 });
  rtb = await csv('rtb'); rent = await csv('rent'); k2 = await kpis();
  let we = 0;
  for (let y = 1; y <= 29; y++) {
    const a = rowAt(rtb, y)?.End_Cash, b = rowAt(rent, y)?.End_Cash;
    if (a != null && b != null) we = Math.max(we, Math.abs(a - b));
  }
  out.E_rtbMinusRentCashMaxAbsY1to29 = we;
  out.E_rtbNetEquityY30MinusRent = (rowAt(rtb, 30)?.Net_Equity ?? 0) - (rowAt(rent, 30)?.Net_Equity ?? 0);
  out.E_nanCount = k2.bodyNaN;
  // F: RTB on vs off must not move Own or Rent
  await baseline(); await set('monthlyBudget', 5000); await set('monthlyBudgetIncrease', 0);
  await set('rtbEnabled', true); await set('rtbBuyYear', 5); await page.waitForTimeout(300);
  const onOwn = rowAt(await csv('own'), 30)?.Net_Equity, onRent = rowAt(await csv('rent'), 30)?.Net_Equity;
  await set('rtbEnabled', false); await page.waitForTimeout(300);
  const offOwn = rowAt(await csv('own'), 30)?.Net_Equity, offRent = rowAt(await csv('rent'), 30)?.Net_Equity;
  out.F_ownNetEquityY30RtbOnMinusOff = (onOwn ?? 0) - (offOwn ?? 0);
  out.F_rentNetEquityY30RtbOnMinusOff = (onRent ?? 0) - (offRent ?? 0);
  return out;
});
cases['R7'].notes = "The RTB conservation residuals are reported null: the export does not expose the purchase-year deposit and setup outlay as its own column, so the residual cannot be assembled from page figures without assuming the transition formula, which the contract forbids. Every other RTB observable is read from the page's RTB CSV.";

// R4, R5, R6, R9, R12 need machinery this runner does not implement.
for (const [id, why] of [
  ['R4', 'Needs detailed mortgage mode plus a constructed rate-period row (interest-only radio, #ratePeriodRows editing). Not implemented by this runner; state B alone would be misleading without A.'],
  ['R5', 'Needs a floating rate band (low/mid/high) built in #ratePeriodRows, and a per-path verdict readout the runner could not locate on the page. Not executed.'],
  ['R6', 'Needs repeated construction and mutation of .rate-period-row entries (past-term, overlapping, reversed bounds, shortened term, backwards band). Not implemented by this runner.'],
  ['R9', 'Needs the /sensitivity/ page driven to mirror the baseline field by field through its dynamic table.dt scenario column. Not implemented by this runner.'],
  ['R12', 'Needs the /id/ page driven through the same baseline and compared field by field. Not implemented by this runner.'],
]) cases[id] = { error: why };

emit('rentvsownhouse', cases, { page_errors: errors.slice(0, 20) });
await browser.close();
