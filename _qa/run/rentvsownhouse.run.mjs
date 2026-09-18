/* ───────────────────────────────────────────────────────────────────────────
   PHASE 2 — EXECUTION.  Rent vs Own (rentvsownhouse/).

   Drives the REAL pages (main calculator, /sensitivity/, /id/) to each state
   named in _qa/contract/rentvsownhouse.contract.json and records what the page
   actually shows.  Nothing here has seen _qa/plan/ — no expected value exists
   in this file, and every figure below is read back off the page:

     • yearly series           → the page's own CSV export (#downloadBtn /
                                 the sensitivity page's per-scenario ⬇ buttons),
                                 captured by replacing RVOExport.downloadCSV
                                 with a recorder.  Same code path, same numbers
                                 as the on-screen detail table, but the table
                                 renders compact ("$1.23m") while the CSV keeps
                                 whole dollars.
     • KPIs / snapshot tiles   → their DOM text (compact — see notes per case).
     • floating-rate band      → the band datasets the page plots (window.__charts).

   Residuals and max-abs differences are arithmetic over those read-off
   figures only; the model is never re-implemented here.
   ─────────────────────────────────────────────────────────────────────────── */
import { boot, contract, emit, runCase, fileUrl, money, setById } from './_driver.mjs';

const C        = contract('rentvsownhouse');
const PAGE     = 'rentvsownhouse/index.html';
const ID_PAGE  = 'rentvsownhouse/id/index.html';
const SENS     = 'rentvsownhouse/sensitivity/index.html';
const RF       = 1.045;                 // read_rules.residuals: rf = 4.5% → 0.045

/* ── page plumbing ──────────────────────────────────────────────────────── */

async function open(rel) {
  const { browser, page, errors } = await boot();
  await page.goto(fileUrl(rel), { waitUntil: 'load' });
  await page.waitForTimeout(450);
  await page.evaluate(() => {
    window.__csv = null; window.__csvName = null;
    if (window.RVOExport) {
      RVOExport.downloadCSV = (fn, txt) => { window.__csvName = fn; window.__csv = txt; };
    }
  });
  return { browser, page, errors };
}

const shut = async b => { try { await b.close(); } catch { } };

/* ── CSV capture / parsing ──────────────────────────────────────────────── */

function parseCsv(txt) {
  const lines = String(txt).trim().split('\n').filter(l => l && !l.startsWith('#'));
  const head  = lines[0].split(',');
  const rows  = lines.slice(1).map(l => {
    const c = l.split(','), o = {};
    head.forEach((h, i) => {
      const v = c[i];
      o[h] = (v === undefined || v === '') ? null : (Number.isNaN(Number(v)) ? v : Number(v));
    });
    return o;
  });
  const by = new Map(rows.map(r => [Number(r.Year), r]));
  return { head, rows, y: yr => by.get(yr) || null };
}

/** Capture the main page's cashflow CSV for one of its three tables. */
async function csvOf(page, table) {
  const res = await page.evaluate(t => {
    window.__csv = null;
    const tab = document.querySelector('.tab-btn[data-table="' + t + '"]');
    if (!tab) return { err: 'no .tab-btn[data-table=' + t + ']' };
    if (tab.offsetParent === null && tab.style.display === 'none') return { err: 'table tab "' + t + '" is not visible' };
    tab.click();
    const btn = document.getElementById('downloadBtn');
    if (!btn) return { err: 'no #downloadBtn' };
    btn.click();
    return { txt: window.__csv };
  }, table);
  if (res.err) throw new Error(res.err);
  if (!res.txt) throw new Error('no CSV captured for the "' + table + '" table');
  return parseCsv(res.txt);
}

/* Column meanings, per read_rules (own/rent/rtb cashflow CSV headers). */
const ownOutflow  = r => n(r.Principal_Exp) + n(r.Interest_Exp) + n(r.Ongoing_Exp);
const ownMortgage = r => n(r.Principal_Exp) + n(r.Interest_Exp);
const rentOutflow = r => n(r.Rent_Exp) + n(r.Ongoing_Exp);
const rtbOutflow  = r => n(r.Total_Exp);          // principal + interest + ongoing, purchase outlay excluded
const n = v => (v === null || v === undefined || Number.isNaN(v)) ? 0 : Number(v);

/** max_t | cash_t − ( cash_(t−1)·rf + budget_t − outflow_t ) | over the given years. */
function cashIdentityMaxAbs(csv, years, cash, budget, outflow) {
  let mx = 0, worst = null;
  for (const t of years) {
    const r = csv.y(t), p = csv.y(t - 1);
    if (!r || !p) throw new Error('missing year ' + t + '/' + (t - 1) + ' in the table');
    const d = cash(r) - (cash(p) * RF + budget(r) - outflow(r));
    if (Math.abs(d) > Math.abs(mx)) { mx = d; worst = t; }
  }
  return { value: Math.abs(mx), signed: mx, year: worst };
}

/* ── KPI / DOM reading ──────────────────────────────────────────────────── */

/** Parse a KPI/tile figure as rendered, expanding the page's compact k/m/b suffix. */
function kpiNum(s) {
  if (s == null) return null;
  const t = String(s).replace(/[−–—]/g, '-').trim();
  if (!t || /^[-—]$/.test(t)) return null;
  const m = t.match(/([+-]?)\s*[^\d+-]*([\d.,]+)\s*([kmb])?/i);
  if (!m) return null;
  let v = money(m[2]);
  if (!Number.isFinite(v)) return null;
  const suf = (m[3] || '').toLowerCase();
  if (suf === 'k') v *= 1e3; else if (suf === 'm') v *= 1e6; else if (suf === 'b') v *= 1e9;
  return m[1] === '-' ? -v : v;
}

async function kpiText(page) {
  return page.evaluate(() => {
    const t = id => { const e = document.getElementById(id); return e ? e.textContent.trim() : null; };
    return {
      initialCash: t('kpiInitialCash'), budgetRange: t('kpiBudgetRange'),
      breakeven:   t('kpiBreakeven'),   diff:        t('kpiDiff'),
    };
  });
}

/** #kpiBreakeven → integer year, or null for "—"/never (read_rules.kpis). */
function breakevenYear(txt) {
  if (txt == null) return null;
  const s = String(txt).trim();
  if (!s || /^[—–-]$/.test(s) || /never|n\/?a|beyond/i.test(s)) return null;
  const m = s.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

/** #kpiBudgetRange → [lo, hi] as printed. */
function budgetRange(txt) {
  if (txt == null) return [null, null];
  const parts = String(txt).split(/[–—]/);           // the page joins with an en dash
  if (parts.length < 2) return [kpiNum(txt), kpiNum(txt)];
  return [kpiNum(parts[0]), kpiNum(parts[1])];
}

/** Decide whether #kpiBudgetRange prints monthly or yearly money, by comparing
 *  it with the Budget column of the cashflow table, then return per-month. */
function budgetKpiPerMonth(rangeTxt, annBudgets) {
  const [lo, hi] = budgetRange(rangeTxt);
  const minAnn = Math.min(...annBudgets), maxAnn = Math.max(...annBudgets);
  const rel = (a, b) => (b === 0 ? (a === 0 ? 0 : 1) : Math.abs(a - b) / Math.abs(b));
  const asYearly = lo === null ? 1 : rel(lo, minAnn);
  const asMonthly = lo === null ? 1 : rel(lo, minAnn / 12);
  const monthly = asMonthly <= asYearly;
  return {
    lo: lo === null ? null : (monthly ? lo : lo / 12),
    hi: hi === null ? null : (monthly ? hi : hi / 12),
    basis: monthly ? 'monthly' : 'yearly',
    raw: [lo, hi], tableAnnual: [minAnn, maxAnn],
  };
}

async function snapshotTiles(page, which) {
  return page.evaluate(id => {
    const el = document.getElementById(id);
    if (!el) return null;
    return [...el.querySelectorAll('.tile')].map(t => ({
      label: (t.querySelector('.label') || {}).textContent?.trim() || '',
      value: (t.querySelector('.value') || {}).textContent?.trim() || '',
    }));
  }, which);
}

const tileByLabel = (tiles, re) => (tiles || []).find(t => re.test(t.label)) || null;

/** read_rules.nan — visible KPI values, snapshot tiles, legend/hover entries, table cells. */
async function nanCount(page) {
  return page.evaluate(() => {
    const RE = /NaN|Infinity|undefined|null/i;
    const vis = el => !!el && (el.getClientRects().length > 0);
    let count = 0; const samples = [];
    const add = el => {
      if (!vis(el)) return;
      const t = (el.textContent || '').trim();
      if (RE.test(t)) { count++; if (samples.length < 6) samples.push(t.slice(0, 60)); }
    };
    ['kpiInitialCash', 'kpiBudgetRange', 'kpiBreakeven', 'kpiDiff'].forEach(id => add(document.getElementById(id)));
    document.querySelectorAll('#ownSummary .value, #rentSummary .value, #rtbSummary .value').forEach(add);
    document.querySelectorAll('#chartLegend .legend-item').forEach(add);
    add(document.getElementById('hoverBox'));
    add(document.getElementById('warningBanner'));
    document.querySelectorAll('#detailTableWrap td, #detailTableWrap th').forEach(add);
    return { count, samples };
  });
}

/* ── control driving (main page) ────────────────────────────────────────── */

const BASE = {
  currencySymbol: '$', riskFreeRate: 4.5, initialCash: '', monthlyBudget: '0', horizon: 30,
  rtbEnabled: false,
  propertyPrice: 800000, downPaymentPct: 20, mortgageRate: 6, mortgageTerm: 30, houseGrowth: 5,
  setupCost: 32000, setupCostType: 'dollar',
  ownOngoingCost: 6000, ownOngoingCostFreq: 'yearly', ownOngoingCostType: 'dollar', ownOngoingInflation: 0,
  rentAmount: 2800, rentFreq: 'monthly', rentInflation: 3,
  rentOngoingCost: 1200, rentOngoingCostFreq: 'yearly', rentOngoingCostType: 'dollar', rentOngoingInflation: 0,
};

async function segClick(page, groupId, val) {
  const ok = await page.evaluate(({ g, v }) => {
    const b = document.querySelector('#' + g + ' .seg-btn[data-val="' + v + '"]');
    if (!b) return false; b.click(); return true;
  }, { g: groupId, v: val });
  if (!ok) throw new Error('no .seg-btn[data-val=' + val + '] in #' + groupId);
  await page.waitForTimeout(40);
}

async function set(page, id, value) {
  const r = await setById(page, id, value);
  if (!r || !r.ok) throw new Error('could not set #' + id + ': ' + (r && r.reason));
  // Verify the control actually holds it (money inputs re-format with commas).
  const want = value, got = r.now;
  if (typeof want === 'boolean') { if (!!got !== want) throw new Error('#' + id + ' did not take ' + want); }
  else if (want === '' ) { /* blank is allowed to stay blank */ }
  else if (typeof want === 'number') {
    const g = money(got);
    if (!Number.isFinite(g) || Math.abs(g - want) > 1e-9) throw new Error('#' + id + ' shows ' + got + ', wanted ' + want);
  } else {
    const gn = money(got), wn = money(want);
    if (Number.isFinite(wn) && Number.isFinite(gn)) { if (Math.abs(gn - wn) > 1e-9) throw new Error('#' + id + ' shows ' + got + ', wanted ' + want); }
    else if (String(got) !== String(want)) throw new Error('#' + id + ' shows ' + got + ', wanted ' + want);
  }
  return r.now;
}

/** contract.baseline — reset, force simple modes, then set every listed control. */
async function baseline(page) {
  await page.evaluate(() => document.getElementById('resetBtn').click());
  await page.waitForTimeout(150);
  await segClick(page, 'mortgageModeGroup', 'simple');
  await segClick(page, 'ownCostsModeGroup', 'simple');
  await segClick(page, 'rentCostsModeGroup', 'simple');
  await page.evaluate(() => {
    const r = document.querySelector('input[name="mortgageType"][value="pi"]');
    if (r && !r.checked) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  for (const [id, v] of Object.entries(BASE)) await set(page, id, v);
  await page.waitForTimeout(80);
}

async function apply(page, overrides) {
  for (const [id, v] of Object.entries(overrides)) await set(page, id, v);
  await page.waitForTimeout(60);
}

/* ── detailed rate schedule (main page) ─────────────────────────────────── */
/* Row layout as actually built by the page (buildRatePeriodRow):
     .rp-years  — a LABEL "Yr <b.rp-from>–<b.rp-to-lbl>"; the from-year is derived
                  from the previous period's end and is NOT editable anywhere.
     .rp-to     — the only editable year bound; absent on the LAST row, which
                  always runs to the mortgage term.
     .rp-fixed-wrap → .rp-rate  (one fixed %)
     .rp-float-wrap → .rp-min / .rp-max  (TWO rates: a low–high band, no "mid").
*/
const rowCount = page => page.evaluate(() => document.querySelectorAll('#ratePeriodRows .rate-period-row').length);

async function setSchedule(page, periods) {
  await segClick(page, 'mortgageModeGroup', 'detailed');
  await page.waitForTimeout(60);
  for (let guard = 0; guard < 12; guard++) {
    const have = await rowCount(page);
    if (have === periods.length) break;
    if (have > periods.length) {
      await page.evaluate(() => {
        const rows = [...document.querySelectorAll('#ratePeriodRows .rate-period-row')];
        rows[rows.length - 1].querySelector('.rp-delete').click();
      });
    } else {
      await page.evaluate(() => document.getElementById('addRatePeriod').click());
    }
    await page.waitForTimeout(50);
  }
  if (await rowCount(page) !== periods.length) throw new Error('could not build ' + periods.length + ' rate period row(s)');

  // types first (toggles which rate inputs are live), then year bounds, then rates
  await page.evaluate(ps => {
    const rows = [...document.querySelectorAll('#ratePeriodRows .rate-period-row')];
    rows.forEach((row, i) => {
      const ty = row.querySelector('.rp-type');
      if (ty && ty.value !== ps[i].type) { ty.value = ps[i].type; ty.dispatchEvent(new Event('change', { bubbles: true })); }
    });
  }, periods);
  await page.waitForTimeout(60);
  await page.evaluate(ps => {
    const rows = [...document.querySelectorAll('#ratePeriodRows .rate-period-row')];
    rows.forEach((row, i) => {
      const to = row.querySelector('.rp-to');
      if (to && ps[i].to !== undefined && ps[i].to !== null) {
        to.value = String(ps[i].to);
        ['input', 'change'].forEach(e => to.dispatchEvent(new Event(e, { bubbles: true })));
      }
    });
  }, periods);
  await page.waitForTimeout(60);
  await page.evaluate(ps => {
    const rows = [...document.querySelectorAll('#ratePeriodRows .rate-period-row')];
    rows.forEach((row, i) => {
      const p = ps[i];
      const put = (sel, v) => {
        if (v === undefined || v === null) return;
        const el = row.querySelector(sel); if (!el) return;
        el.value = String(v);
        ['input', 'change'].forEach(e => el.dispatchEvent(new Event(e, { bubbles: true })));
      };
      if (p.type === 'floating') { put('.rp-min', p.min); put('.rp-max', p.max); }
      else put('.rp-rate', p.rate);
    });
  }, periods);
  await page.waitForTimeout(80);
}

const readSchedule = page => page.evaluate(() =>
  [...document.querySelectorAll('#ratePeriodRows .rate-period-row')].map(r => ({
    shownAs: (r.querySelector('.rp-years')?.textContent || '').replace(/\s+/g, ' ').trim(),
    toInput: r.querySelector('.rp-to') ? r.querySelector('.rp-to').value : '(last row: auto = term)',
    type: r.querySelector('.rp-type')?.value,
    fixedRate: r.querySelector('.rp-rate')?.value,
    band: [r.querySelector('.rp-min')?.value, r.querySelector('.rp-max')?.value],
    markedBeyondTerm: r.classList.contains('rp-beyond'),
  })));

/* ── floating band, as the page plots it ────────────────────────────────── */
/* renderChart pushes, per series and only when the band is wider than $0.50,
   two extra datasets: the HIGH path (fill:false) then the LOW path (fill:'-1').
   Those are the same numbers the chart's hover box prints as "(a – b)". */
async function chartBand(page) {
  return page.evaluate(() => {
    const ch = (window.__charts || [])[0];
    if (!ch) return { err: 'no Chart instance recorded' };
    const ds = ch.data.datasets || [];
    const main = {};
    ds.forEach(d => { if (d.rvoKey) main[d.rvoKey] = { label: d.label, data: d.data }; });
    const bands = {};
    ds.filter(d => d.isBand).forEach(d => {
      const key = String(d.label).replace(/ \(band\)$/, '');
      bands[key] = bands[key] || {};
      if (d.fill === '-1') bands[key].low = d.data; else bands[key].high = d.data;
    });
    return { main, bands };
  });
}

function bandVerdicts(band) {
  if (band.err) throw new Error(band.err);
  const own = band.main.netEquityOwn, rent = band.main.netEquityRent;
  if (!own || !rent) throw new Error('net-equity series not plotted');
  const i = own.data.length - 1;
  const ob = band.bands[own.label], rb = band.bands[rent.label];
  if (!ob) throw new Error('no Own net-equity band plotted');
  const rlow = rb ? rb.low[i] : rent.data[i], rhigh = rb ? rb.high[i] : rent.data[i];
  return {
    low:  ob.low[i]  - rlow,
    mid:  own.data[i] - rent.data[i],
    high: ob.high[i] - rhigh,
    rentBandPlotted: !!rb,
    lastYearIndex: i,
  };
}

/* ── main ───────────────────────────────────────────────────────────────── */

const bag = {};
const note = (r, ...lines) => { r.notes = (r.notes || []).concat(lines.filter(Boolean)); };

/* ═══ N1 ═════════════════════════════════════════════════════════════════ */
async function runN1(nb) {
  const { browser, page } = await open(PAGE);
  try {
    await baseline(page);
    const own = await csvOf(page, 'own'), rent = await csvOf(page, 'rent');
    const k = await kpiText(page);
    const ownTiles = await snapshotTiles(page, 'ownSummary');
    const payTile = tileByLabel(ownTiles, /Monthly Mortgage|Cicilan/i);
    const ann = []; for (let t = 1; t <= 30; t++) ann.push(n(own.y(t).Ann_Budget));
    const bk = budgetKpiPerMonth(k.budgetRange, ann);

    const ownCash = r => n(r.End_Cash), budget = r => n(r.Ann_Budget);
    const oid = cashIdentityMaxAbs(own, range(1, 30), ownCash, budget, ownOutflow);
    const rid = cashIdentityMaxAbs(rent, range(1, 30), r => n(r.End_Cash), budget, rentOutflow);

    let principalTotal = 0, interestTotal = 0;
    for (let t = 1; t <= 30; t++) { principalTotal += n(own.y(t).Principal_Exp); interestTotal += n(own.y(t).Interest_Exp); }

    const y30 = own.y(30), r30 = rent.y(30);
    const nc = await nanCount(page);

    nb.push(
      'Yearly figures read from the page\'s own CSV export (#downloadBtn → RVOExport.ownCashflowCSV/rentCashflowCSV), not the on-screen table: the table renders money compactly ($1.23m / $192k) while the CSV keeps whole dollars. The CSV is built from the same rows the table renders.',
      'outflow = Principal_Exp + Interest_Exp + Ongoing_Exp (Own) and Rent_Exp + Ongoing_Exp (Rent); budget = the Ann_Budget column; cash = End_Cash; loan balance = Principal_Left.',
      'A year-0 row exists in both tables, so year-0 cash/loan are read from it rather than reconstructed.',
      `#kpiBudgetRange reads "${k.budgetRange}"; the Budget column runs ${bk.tableAnnual[0]}–${bk.tableAnnual[1]} per year, so the KPI is ${bk.basis} money — reported per month accordingly.`,
      `mortgagePaymentMonthly is the Own snapshot tile "${payTile ? payTile.label : '?'}" = ${payTile ? payTile.value : '—'} (whole dollars); year-1 mortgage total / 12 = ${(ownMortgage(own.y(1)) / 12).toFixed(2)} as a cross-check.`,
      `All KPI figures are rendered compactly, so #kpiInitialCash ("${k.initialCash}") carries ±$500 of display rounding.`,
      `Worst cash-identity year: Own year ${oid.year} (signed ${oid.signed.toFixed(2)}), Rent year ${rid.year} (signed ${rid.signed.toFixed(2)}). Whole-dollar CSV rounding alone can move a residual by ~$2.`,
      nc.count ? `NaN-ish text found: ${JSON.stringify(nc.samples)}` : null,
    );

    return {
      kpiInitialCash: kpiNum(k.initialCash),
      budgetMonthlyMin: bk.lo,
      loanAtStart: n(own.y(0).Principal_Left),
      mortgagePaymentMonthly: payTile ? kpiNum(payTile.value) : null,
      mortgagePaidYear1: ownMortgage(own.y(1)),
      mortgagePaidYear30: ownMortgage(own.y(30)),
      loanBalanceEndY1: n(own.y(1).Principal_Left),
      loanBalanceEndY5: n(own.y(5).Principal_Left),
      loanBalanceEndY10: n(own.y(10).Principal_Left),
      loanBalanceEndY15: n(own.y(15).Principal_Left),
      loanBalanceEndY20: n(own.y(20).Principal_Left),
      loanBalanceEndY25: n(own.y(25).Principal_Left),
      loanBalanceEndY29: n(own.y(29).Principal_Left),
      loanBalanceEndY30: n(own.y(30).Principal_Left),
      principalPaidTotal: principalTotal,
      interestPaidTotal: interestTotal,
      propertyValueY1: n(own.y(1).Prop_Value),
      propertyValueY10: n(own.y(10).Prop_Value),
      propertyValueY30: n(own.y(30).Prop_Value),
      ownOngoingYear1: n(own.y(1).Ongoing_Exp),
      ownOngoingYear30: n(own.y(30).Ongoing_Exp),
      ownOutflowYear1: ownOutflow(own.y(1)),
      ownOutflowYear30: ownOutflow(own.y(30)),
      rentOutflowYear1: rentOutflow(rent.y(1)),
      rentOutflowYear2: rentOutflow(rent.y(2)),
      rentOutflowYear30: rentOutflow(rent.y(30)),
      budgetYear1: n(own.y(1).Ann_Budget),
      ownCashEndY0: n(own.y(0).End_Cash),
      rentCashEndY0: n(rent.y(0).End_Cash),
      ownCashEndY1: n(own.y(1).End_Cash),
      rentCashEndY1: n(rent.y(1).End_Cash),
      ownCashIdentityResidualMaxAbs: oid.value,
      rentCashIdentityResidualMaxAbs: rid.value,
      ownTerminalResidual: n(y30.Net_Equity) - (n(y30.Prop_Value) - n(y30.Principal_Left) + n(y30.End_Cash)),
      rentTerminalResidual: n(r30.Net_Equity) - n(r30.End_Cash),
      nanCount: nc.count,
    };
  } finally { await shut(browser); }
}

const range = (a, b) => { const o = []; for (let i = a; i <= b; i++) o.push(i); return o; };

/* ═══ R1 — budget parity ═════════════════════════════════════════════════ */
async function runR1(nb) {
  const { browser, page } = await open(PAGE);
  try {
    const out = {};

    // A — automatic budget, RTB off
    await baseline(page);
    let own = await csvOf(page, 'own'), rent = await csvOf(page, 'rent');
    let mx = 0;
    for (const t of range(1, 30)) mx = Math.max(mx, Math.abs(n(own.y(t).Ann_Budget) - n(rent.y(t).Ann_Budget)));
    out.A_budgetDiffMaxAbs = mx;
    out.A_budgetYear1 = n(own.y(1).Ann_Budget);
    let mx2 = 0, worst = null;
    for (const t of range(1, 30)) {
      const d = Math.abs(n(own.y(t).Ann_Budget) - Math.max(ownOutflow(own.y(t)), rentOutflow(rent.y(t))));
      if (d > mx2) { mx2 = d; worst = t; }
    }
    out.A_budgetEqualsMaxOfOutflowsMaxAbs = mx2;
    nb.push(`A: worst year for budget vs max(outflows) is year ${worst} (${mx2.toFixed(2)}).`);

    // B — explicit budget 5000 growing 2%/yr
    await baseline(page);
    await apply(page, { monthlyBudget: 5000, monthlyBudgetIncrease: 2 });
    const incVisible = await page.evaluate(() => getComputedStyle(document.getElementById('budgetIncreaseRow')).display !== 'none');
    own = await csvOf(page, 'own'); rent = await csvOf(page, 'rent');
    let bmx = 0;
    for (const t of range(1, 30)) bmx = Math.max(bmx, Math.abs(n(own.y(t).Ann_Budget) - n(rent.y(t).Ann_Budget)));
    out.B_budgetDiffMaxAbs = bmx;
    out.B_budgetYear1 = n(own.y(1).Ann_Budget);
    out.B_budgetYear2 = n(own.y(2).Ann_Budget);
    out.B_budgetYear3 = n(own.y(3).Ann_Budget);
    out.B_budgetYear30 = n(own.y(30).Ann_Budget);
    const kB = await kpiText(page);
    const annB = range(1, 30).map(t => n(own.y(t).Ann_Budget));
    const bkB = budgetKpiPerMonth(kB.budgetRange, annB);
    out.B_kpiBudgetMonthlyMin = bkB.lo;
    out.B_kpiBudgetMonthlyMax = bkB.hi;
    nb.push(`B: #budgetIncreaseRow visible = ${incVisible}; #kpiBudgetRange = "${kB.budgetRange}" (${bkB.basis} money, reported per month).`);

    // C — RTB on (buy year 5), auto budget
    await baseline(page);
    await apply(page, { rtbEnabled: true, rtbBuyYear: 5, monthlyBudget: '0' });
    own = await csvOf(page, 'own'); rent = await csvOf(page, 'rent');
    let rtb = await csvOf(page, 'rtb');
    out.C_budgetDiffMaxAbs = threeWayBudgetMax(own, rent, rtb, 30);

    // D — RTB on, explicit budget
    await baseline(page);
    await apply(page, { rtbEnabled: true, rtbBuyYear: 5, monthlyBudget: 5000, monthlyBudgetIncrease: 2 });
    own = await csvOf(page, 'own'); rent = await csvOf(page, 'rent'); rtb = await csvOf(page, 'rtb');
    out.D_budgetDiffMaxAbs = threeWayBudgetMax(own, rent, rtb, 30);
    out.D_budgetYear30 = n(rtb.y(30).Ann_Budget);

    nb.push('Budgets read from the Ann_Budget column of each table\'s CSV export (Own, Rent and, where the 🔄 tab is visible, Rent-Then-Buy). Whole-dollar rounding means an exact match shows as ≤ $1.');
    return out;
  } finally { await shut(browser); }
}

function threeWayBudgetMax(own, rent, rtb, H) {
  let mx = 0;
  for (const t of range(1, H)) {
    const v = [n(own.y(t).Ann_Budget), n(rent.y(t).Ann_Budget), n(rtb.y(t).Ann_Budget)];
    mx = Math.max(mx, Math.max(...v) - Math.min(...v));
  }
  return mx;
}

/* ═══ R2 — negative cash / warning banner ════════════════════════════════ */
async function runR2(nb) {
  const { browser, page } = await open(PAGE);
  try {
    const out = {};
    const bannerText = () => page.evaluate(() => {
      const el = document.getElementById('warningBanner');
      if (!el) return '';
      if (getComputedStyle(el).display === 'none' || el.getClientRects().length === 0) return '';
      return (el.textContent || '').trim();
    });

    await baseline(page);
    await apply(page, { monthlyBudget: 3500, monthlyBudgetIncrease: 0 });
    let own = await csvOf(page, 'own'), rent = await csvOf(page, 'rent');
    out.A_ownCashEndY1 = n(own.y(1).End_Cash);
    out.A_ownCashEndY2 = n(own.y(2).End_Cash);
    out.A_ownCashEndY5 = n(own.y(5).End_Cash);
    out.A_ownCashEndY30 = n(own.y(30).End_Cash);
    out.A_ownCashYears1to5 = range(1, 5).map(t => n(own.y(t).End_Cash));
    out.A_ownCashIdentityResidualMaxAbs = cashIdentityMaxAbs(own, range(1, 30), r => n(r.End_Cash), r => n(r.Ann_Budget), ownOutflow).value;
    out.A_rentCashEndY1 = n(rent.y(1).End_Cash);
    out.A_rentCashEndY30 = n(rent.y(30).End_Cash);
    out.A_warningBannerText = await bannerText();

    await baseline(page);
    await apply(page, { monthlyBudget: 2000, monthlyBudgetIncrease: 0 });
    own = await csvOf(page, 'own'); rent = await csvOf(page, 'rent');
    out.B_ownCashEndY1 = n(own.y(1).End_Cash);
    out.B_rentCashEndY1 = n(rent.y(1).End_Cash);
    out.B_warningBannerText = await bannerText();

    nb.push('#warningBanner is reported as the empty string when the element is hidden (the page leaves its text in place but sets display:none).');
    nb.push('Cash figures are End_Cash from the CSV export; negatives come through as negative numbers.');
    return out;
  } finally { await shut(browser); }
}

/* ═══ R3 — terminal value ════════════════════════════════════════════════ */
async function runR3(nb) {
  const { browser, page } = await open(PAGE);
  try {
    await baseline(page);
    const own = await csvOf(page, 'own'), rent = await csvOf(page, 'rent');
    const k = await kpiText(page);
    const o = own.y(30), r = rent.y(30);
    const ownNE = n(o.Net_Equity), rentNE = n(r.Net_Equity);
    nb.push(`#kpiDiff reads "${k.diff}" → ${kpiNum(k.diff)}; it is rendered compactly (2 dp of millions here), so kpiDiffMinusFinalDelta is dominated by that display rounding. The table's own final delta is ${(ownNE - rentNE).toFixed(0)}.`);
    return {
      propertyValueFinal: n(o.Prop_Value),
      loanBalanceFinal: n(o.Principal_Left),
      ownCashFinal: n(o.End_Cash),
      ownNetEquityFinal: ownNE,
      rentCashFinal: n(r.End_Cash),
      rentNetEquityFinal: rentNE,
      ownTerminalResidual: ownNE - (n(o.Prop_Value) - n(o.Principal_Left) + n(o.End_Cash)),
      rentTerminalResidual: rentNE - n(r.End_Cash),
      ownEquityExCashFinal: ownNE - n(o.End_Cash),
      kpiDiffMinusFinalDelta: kpiNum(k.diff) - (ownNE - rentNE),
    };
  } finally { await shut(browser); }
}

/* ═══ R4 — past the mortgage term ════════════════════════════════════════ */
async function runR4(nb) {
  const { browser, page } = await open(PAGE);
  try {
    const out = {};

    /* A — interest-only, 10-year term, 15-year horizon */
    await baseline(page);
    await apply(page, { horizon: 15, mortgageTerm: 10, monthlyBudget: 5000, monthlyBudgetIncrease: 0, mortgageRate: 6 });
    await setSchedule(page, [{ type: 'fixed', rate: 6 }]);
    await page.evaluate(() => {
      const io = document.querySelector('input[name="mortgageType"][value="io"]');
      io.checked = true; io.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(80);
    const schedA = await readSchedule(page);
    const ioOn = await page.evaluate(() => document.querySelector('input[name="mortgageType"]:checked').value);
    const costIO = await page.evaluate(() => document.getElementById('costInterestOnly').checked);
    let own = await csvOf(page, 'own');
    const tilesA = await snapshotTiles(page, 'ownSummary');
    const payA = tileByLabel(tilesA, /Monthly Mortgage|Cicilan/i);

    out.A_mortgagePaidYear5 = ownMortgage(own.y(5));
    out.A_loanBalanceEndY9 = n(own.y(9).Principal_Left);
    out.A_loanBalanceEndY10 = n(own.y(10).Principal_Left);
    out.A_loanBalanceEndY12 = n(own.y(12).Principal_Left);
    out.A_mortgagePaidYear12 = ownMortgage(own.y(12));
    out.A_ownOutflowYear12 = ownOutflow(own.y(12));
    out.A_ownCashEndY9 = n(own.y(9).End_Cash);
    out.A_ownCashEndY10 = n(own.y(10).End_Cash);

    const p10 = n(own.y(10).Principal_Exp);
    const regularY10 = p10 > 0.5 ? (payA ? kpiNum(payA.value) * 12 : NaN) : n(own.y(10).Interest_Exp);
    out.A_balloonResidualY10 = n(own.y(10).End_Cash) -
      (n(own.y(9).End_Cash) * RF + n(own.y(10).Ann_Budget) - (regularY10 + n(own.y(10).Ongoing_Exp)));
    out.A_ownNetEquityResidualY10 = n(own.y(10).Net_Equity) -
      (n(own.y(10).Prop_Value) - n(own.y(10).Principal_Left) + n(own.y(10).End_Cash));
    out.A_ownCashIdentityResidualMaxAbsExY10 = cashIdentityMaxAbs(
      own, range(1, 9).concat(range(11, 15)), r => n(r.End_Cash), r => n(r.Ann_Budget), ownOutflow).value;
    out.A_ownCashEndY15 = n(own.y(15).End_Cash);

    nb.push(
      `A: detailed mortgage mode, mortgageType radio = "${ioOn}", #costInterestOnly = ${costIO}. Rate schedule rows as the page shows them: ${JSON.stringify(schedA)}.`,
      'A: the page\'s rate-period row has no from-year field (the from-year is derived from the previous period) and the LAST row always runs to the mortgage term, so "one period covering loan years 1-10" was built as a single fixed row, which the page labels Yr 1–10.',
      `A: the year-10 Principal_Exp column shows ${p10}, so the year-10 "regular payments" used in A_balloonResidualY10 are the table's own Interest_Exp for year 10 (${n(own.y(10).Interest_Exp)}); no separate balloon/principal figure appears in the table.`,
      `A: Own snapshot "Monthly Mortgage" tile = ${payA ? payA.value : '—'}.`,
    );

    /* B — P&I, 10-year term, simple mode */
    await baseline(page);
    await apply(page, { horizon: 15, mortgageTerm: 10, monthlyBudget: 8000, monthlyBudgetIncrease: 0, mortgageRate: 6 });
    own = await csvOf(page, 'own');
    const tilesB = await snapshotTiles(page, 'ownSummary');
    const payB = tileByLabel(tilesB, /Monthly Mortgage|Cicilan/i);
    out.B_mortgagePaymentMonthly = payB ? kpiNum(payB.value) : null;
    out.B_mortgagePaidYear10 = ownMortgage(own.y(10));
    out.B_loanBalanceEndY10 = n(own.y(10).Principal_Left);
    out.B_mortgagePaidYear11 = ownMortgage(own.y(11));
    out.B_ownOutflowYear12 = ownOutflow(own.y(12));
    let pr = 0; for (const t of range(1, 15)) pr += n(own.y(t).Principal_Exp);
    out.B_principalPaidTotal = pr;
    out.B_ownCashEndY10 = n(own.y(10).End_Cash);
    out.B_ownCashY11MinusY10Compounded = n(own.y(11).End_Cash) - n(own.y(10).End_Cash) * RF;
    out.B_ownCashEndY15 = n(own.y(15).End_Cash);
    out.B_ownCashIdentityResidualMaxAbs = cashIdentityMaxAbs(own, range(1, 15), r => n(r.End_Cash), r => n(r.Ann_Budget), ownOutflow).value;
    nb.push(`B: monthly repayment read from the Own snapshot tile "${payB ? payB.value : '—'}"; year-1 mortgage total / 12 = ${(ownMortgage(own.y(1)) / 12).toFixed(2)}.`,
      `B: year-0 loan balance ${n(own.y(0).Principal_Left)}, year-15 balance ${n(own.y(15).Principal_Left)} (difference ${(n(own.y(0).Principal_Left) - n(own.y(15).Principal_Left)).toFixed(0)}) as a cross-check on B_principalPaidTotal.`);
    return out;
  } finally { await shut(browser); }
}

/* ═══ R5 — floating band monotonicity ════════════════════════════════════ */
async function runR5(nb) {
  const { browser, page } = await open(PAGE);
  try {
    await baseline(page);
    await apply(page, { mortgageRate: 6, monthlyBudget: '0' });
    await setSchedule(page, [{ type: 'floating', min: 5, max: 7 }]);
    await page.evaluate(() => {
      const pi = document.querySelector('input[name="mortgageType"][value="pi"]');
      if (!pi.checked) { pi.checked = true; pi.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    await page.waitForTimeout(100);
    const sched = await readSchedule(page);
    const band = await chartBand(page);
    const v = bandVerdicts(band);

    nb.push(
      'The page\'s floating rate period has only TWO rate inputs (.rp-min and .rp-max, shown as "5 – 7 % p.a."); there is no third "mid" box. Low 5.0 / high 7.0 were entered and the page derives the mid path itself.',
      `Rate schedule as the page shows it: ${JSON.stringify(sched)}.`,
      'The three verdicts were read from the band the page PLOTS on the Net Equity chart: renderChart appends, per series, a HIGH dataset and a LOW dataset (window.__charts[0].data.datasets, the same numbers the chart hover box prints as "(a – b)"). Verdict = Own net equity − Rent net equity at the last plotted year, per path. No fixed-rate re-runs were needed.',
      `Rent band plotted as well: ${v.rentBandPlotted} (so each verdict uses its own path's Rent figure); last plotted year index ${v.lastYearIndex}.`,
    );
    return { verdictBandLowMidHigh: [v.low, v.mid, v.high], verdictBandCount: 3 };
  } finally { await shut(browser); }
}

/* ═══ R6 — rate period editing ═══════════════════════════════════════════ */
async function runR6(nb) {
  const { browser, page } = await open(PAGE);
  try {
    const out = {};
    let nanSum = 0;
    const finalDelta = async () => {                       // full-dollar equivalent of #kpiDiff
      const own = await csvOf(page, 'own'), rent = await csvOf(page, 'rent');
      return n(own.y(30).Net_Equity) - n(rent.y(30).Net_Equity);
    };
    const baseSchedule = async () => {
      await baseline(page);
      await apply(page, { mortgageRate: 6, mortgageTerm: 30, horizon: 30, monthlyBudget: '0' });
      await setSchedule(page, [{ type: 'fixed', rate: 6 }]);
      await page.evaluate(() => {
        const pi = document.querySelector('input[name="mortgageType"][value="pi"]');
        if (!pi.checked) { pi.checked = true; pi.dispatchEvent(new Event('change', { bubbles: true })); }
      });
      await page.waitForTimeout(80);
    };
    const kpiDiff = async () => kpiNum((await kpiText(page)).diff);

    // base
    await baseSchedule();
    out.kpiDiffBase = await kpiDiff();
    const baseDelta = await finalDelta();
    const baseSchedShown = await readSchedule(page);

    // Edit 1 — a second fixed period for years 31-35 at 9%, term still 30
    await setSchedule(page, [{ to: 30, type: 'fixed', rate: 6 }, { type: 'fixed', rate: 9 }]);
    const e1Shown = await readSchedule(page);
    const e1Kpi = await kpiDiff(), e1Delta = await finalDelta();
    out.pastTermMinusBase = e1Kpi - out.kpiDiffBase;
    nanSum += (await nanCount(page)).count;

    // Edit 2 — overlapping periods
    await baseSchedule();
    await setSchedule(page, [{ to: 10, type: 'fixed', rate: 6 }, { to: 15, type: 'fixed', rate: 8 }, { type: 'fixed', rate: 6 }]);
    const e2Shown = await readSchedule(page);
    const e2Kpi = await kpiDiff(), e2Delta = await finalDelta();
    nanSum += (await nanCount(page)).count;
    await baseSchedule();
    await setSchedule(page, [{ to: 4, type: 'fixed', rate: 6 }, { to: 15, type: 'fixed', rate: 8 }, { type: 'fixed', rate: 6 }]);
    const laterKpi = await kpiDiff(), laterDelta = await finalDelta();
    await baseSchedule();
    await setSchedule(page, [{ to: 10, type: 'fixed', rate: 6 }, { to: 15, type: 'fixed', rate: 8 }, { type: 'fixed', rate: 6 }]);
    const firstKpi = await kpiDiff(), firstDelta = await finalDelta();
    out.overlapResolution =
      Math.abs(e2Delta - laterDelta) <= 1 && Math.abs(e2Delta - firstDelta) > 1 ? 'later-wins'
        : Math.abs(e2Delta - firstDelta) <= 1 && Math.abs(e2Delta - laterDelta) > 1 ? 'first-wins'
          : Math.abs(e2Delta - baseDelta) <= 1 ? 'rejected'
            : Math.abs(e2Delta - firstDelta) <= 1 ? 'first-wins'
              : 'other';

    // Edit 3 — a period entered with from-year 10 and to-year 5
    await baseSchedule();
    await setSchedule(page, [{ to: 9, type: 'fixed', rate: 6 }, { to: 5, type: 'fixed', rate: 8 }, { type: 'fixed', rate: 6 }]);
    const e3Shown = await readSchedule(page);
    const e3Kpi = await kpiDiff(), e3Delta = await finalDelta();
    nanSum += (await nanCount(page)).count;
    await baseSchedule();
    await setSchedule(page, [{ to: 4, type: 'fixed', rate: 6 }, { to: 10, type: 'fixed', rate: 8 }, { type: 'fixed', rate: 6 }]);
    const normKpi = await kpiDiff(), normDelta = await finalDelta();
    out.reversedResolution =
      Math.abs(e3Delta - normDelta) <= 1 ? 'normalised'
        : Math.abs(e3Delta - baseDelta) <= 1 ? 'rejected'
          : 'other';

    // Edit 4 — [1-15 @6],[16-30 @8] then shorten the term to 15
    await baseSchedule();
    await setSchedule(page, [{ to: 15, type: 'fixed', rate: 6 }, { type: 'fixed', rate: 8 }]);
    await set(page, 'mortgageTerm', 15);
    await page.waitForTimeout(80);
    const e4Shown = await readSchedule(page);
    const e4Kpi = await kpiDiff(), e4Delta = await finalDelta();
    nanSum += (await nanCount(page)).count;
    await baseline(page);
    await apply(page, { mortgageRate: 6, mortgageTerm: 15, horizon: 30, monthlyBudget: '0' });
    await setSchedule(page, [{ type: 'fixed', rate: 6 }]);
    const truncKpi = await kpiDiff(), truncDelta = await finalDelta();
    out.termShortenedMinusTruncated = e4Kpi - truncKpi;

    // Edit 5 — floating band entered backwards
    await baseSchedule();
    await setSchedule(page, [{ type: 'floating', min: 7, max: 5 }]);
    const e5Shown = await readSchedule(page);
    const back = bandVerdicts(await chartBand(page));
    nanSum += (await nanCount(page)).count;
    await baseSchedule();
    await setSchedule(page, [{ type: 'floating', min: 5, max: 7 }]);
    const fwd = bandVerdicts(await chartBand(page));
    const a = [back.low, back.mid, back.high].sort((x, y) => x - y);
    const b = [fwd.low, fwd.mid, fwd.high].sort((x, y) => x - y);
    out.bandBackwardsSortedDiffMaxAbs = Math.max(...a.map((v, i) => Math.abs(v - b[i])));
    out.nanCountAcrossEdits = nanSum;

    nb.push(
      'The page\'s rate-period rows expose only a to-year (.rp-to) — the from-year is always the previous period\'s end + 1, and the last row always ends at the mortgage term (no .rp-to at all). Every "years A-B" instruction below was therefore entered as the to-year that produces that range, and the resulting ranges the page prints are recorded.',
      `Base schedule: ${JSON.stringify(baseSchedShown)} → #kpiDiff "${out.kpiDiffBase}", table delta ${baseDelta.toFixed(0)}.`,
      `Edit 1 (period after the term): ${JSON.stringify(e1Shown)} — the appended row is labelled beyond the term. #kpiDiff ${e1Kpi} vs base ${out.kpiDiffBase}; exact table deltas ${e1Delta.toFixed(0)} vs ${baseDelta.toFixed(0)} (difference ${(e1Delta - baseDelta).toFixed(0)}).`,
      `Edit 2 (overlap): an overlap cannot be entered — with no from-year field, entering to-years 10 and 15 yields ${JSON.stringify(e2Shown)}. Classification therefore used the exact table deltas, not the compact #kpiDiff: attempt ${e2Delta.toFixed(0)}, "later-wins" reference [1-4],[5-15],[16-30] = ${laterDelta.toFixed(0)}, "first-wins" reference [1-10],[11-15],[16-30] = ${firstDelta.toFixed(0)}, base ${baseDelta.toFixed(0)}. (#kpiDiff: attempt ${e2Kpi}, later ${laterKpi}, first ${firstKpi}.) No validation message appeared.`,
      `Edit 3 (reversed bounds): entered as row 1 to-year 9 (so the next row's from-year is 10) and row 2 to-year 5 at 8.0% — i.e. a period whose from-year is 10 and to-year 5. The page shows ${JSON.stringify(e3Shown)}. Exact deltas: attempt ${e3Delta.toFixed(0)}, "normalised" reference [1-4],[5-10],[11-30] = ${normDelta.toFixed(0)}, base ${baseDelta.toFixed(0)}. (#kpiDiff: attempt ${e3Kpi}, normalised ${normKpi}.) Because the first period must run 1-9 to make the reversed row start at 10, this is the closest the UI allows to the contract's [1-4] + [10→5] + [11-30].`,
      `Edit 4 (term shortened to 15): ${JSON.stringify(e4Shown)}; #kpiDiff ${e4Kpi} vs the fresh term-15 single-period setup ${truncKpi}; exact table deltas ${e4Delta.toFixed(0)} vs ${truncDelta.toFixed(0)} (difference ${(e4Delta - truncDelta).toFixed(0)}).`,
      `Edit 5 (band backwards): entered 7.0 in the low box and 5.0 in the high box; the page shows ${JSON.stringify(e5Shown)}. Band verdicts backwards [${back.low.toFixed(0)}, ${back.mid.toFixed(0)}, ${back.high.toFixed(0)}] vs forwards [${fwd.low.toFixed(0)}, ${fwd.mid.toFixed(0)}, ${fwd.high.toFixed(0)}], compared after sorting.`,
      '#kpiDiff is rendered compactly (2 dp of millions ⇒ $10,000 granularity here), so kpiDiffBase / pastTermMinusBase / termShortenedMinusTruncated are quantised; the exact table-derived deltas are given above for each edit.',
      'nanCountAcrossEdits is the sum of one nanCount reading taken after each of the five edits (Own table visible in each).',
    );
    return out;
  } finally { await shut(browser); }
}

/* ═══ R7 — rent-then-buy ═════════════════════════════════════════════════ */
async function runR7(nb) {
  const { browser, page } = await open(PAGE);
  try {
    const out = {};
    const buy = async (over) => {
      await baseline(page);
      await apply(page, over);
      const actual = await page.evaluate(() => ({
        buyYear: document.getElementById('rtbBuyYear').value,
        max: document.getElementById('rtbBuyYear').max,
        label: document.getElementById('rtbBuyYearVal').textContent.trim(),
        initialCash: document.getElementById('initialCash').value,
      }));
      return actual;
    };

    /* A */
    let st = await buy({ rtbEnabled: true, rtbBuyYear: 5, monthlyBudget: 5000, monthlyBudgetIncrease: 0 });
    let own = await csvOf(page, 'own'), rent = await csvOf(page, 'rent'), rtb = await csvOf(page, 'rtb');
    let tiles = await snapshotTiles(page, 'rtbSummary');
    const priceTile = tileByLabel(tiles, /Property Price|Harga Properti/i);
    const preBuy = r => n(r.End_Cash) + n(r.Purchase_Outlay);   // the row's own columns reconcile to the pre-purchase cash
    let mx = 0;
    for (const t of range(1, 5)) {
      const c = t === 5 ? preBuy(rtb.y(t)) : n(rtb.y(t).End_Cash);
      mx = Math.max(mx, Math.abs(c - n(rent.y(t).End_Cash)));
    }
    out.A_rtbMinusRentCashMaxAbsY1to5 = mx;
    out.A_rtbPurchasePrice = n(rtb.y(5).Prop_Value);
    out.A_rtbLoanAtPurchase = n(rtb.y(5).Principal_Left);
    out.A_rtbMortgagePaidYear6 = n(rtb.y(6).Principal_Exp) + n(rtb.y(6).Interest_Exp);
    out.A_rtbPropertyValueY6 = n(rtb.y(6).Prop_Value);
    out.A_rtbLoanBalanceEndY6 = n(rtb.y(6).Principal_Left);
    out.A_rtbConservationResidualY6 = n(rtb.y(6).End_Cash) -
      (n(rent.y(5).End_Cash) * RF + n(rtb.y(6).Ann_Budget) - rtbOutflow(rtb.y(6)));
    out.A_rtbNetEquityResidualY6 = n(rtb.y(6).Net_Equity) -
      (n(rtb.y(6).Prop_Value) - n(rtb.y(6).Principal_Left) + n(rtb.y(6).End_Cash));
    out.A_rtbCashEndY6 = n(rtb.y(6).End_Cash);
    out.A_rtbCashIdentityResidualMaxAbsY7toEnd =
      cashIdentityMaxAbs(rtb, range(7, 30), r => n(r.End_Cash), r => n(r.Ann_Budget), rtbOutflow).value;
    nb.push(
      `A: RTB table phases — year 5 is "${rtb.y(5).Phase}", year 6 "${rtb.y(6).Phase}". The purchase lands in the buy-year row, whose End_Cash is already post-purchase; the same row carries a Purchase_Outlay column (${n(rtb.y(5).Purchase_Outlay)}) and the header comment states Beg+Budget+IntInc−Exp−Outlay = End_Cash, so the year-5 PRE-purchase cash was taken as End_Cash + Purchase_Outlay = ${preBuy(rtb.y(5)).toFixed(0)} (Rent year 5 = ${n(rent.y(5).End_Cash)}). Years 1–4 use End_Cash directly.`,
      `A: purchase price and loan read from the buy-year row of the RTB table (Prop_Value / Principal_Left before any repayment); the RTB snapshot tile "${priceTile ? priceTile.label : '?'}" shows ${priceTile ? priceTile.value : '—'} as a compact cross-check. The snapshot carries no loan figure.`,
      'A: rtbOutflow = the Total_Exp column (principal + interest + ongoing; the purchase outlay is a separate column and is excluded).',
    );

    /* B — not enough cash at the switch */
    st = await buy({ rtbEnabled: true, rtbBuyYear: 5, initialCash: 10000, monthlyBudget: 3000, monthlyBudgetIncrease: 0 });
    rent = await csvOf(page, 'rent'); rtb = await csvOf(page, 'rtb');
    out.B_rentCashEndY5 = n(rent.y(5).End_Cash);
    out.B_rtbCashEndY6 = n(rtb.y(6).End_Cash);
    out.B_rtbConservationResidualY6 = n(rtb.y(6).End_Cash) -
      (n(rent.y(5).End_Cash) * RF + n(rtb.y(6).Ann_Budget) - rtbOutflow(rtb.y(6)));
    out.B_rtbLoanAtPurchase = n(rtb.y(5).Principal_Left);
    const warnB = await page.evaluate(() => {
      const w = document.getElementById('initialCashWarn');
      return (w && getComputedStyle(w).display !== 'none') ? w.textContent.trim() : '';
    });
    nb.push(`B: #initialCash warning shown: ${warnB ? JSON.stringify(warnB) : '(none)'}; RTB year-5 End_Cash ${n(rtb.y(5).End_Cash)}, Purchase_Outlay ${n(rtb.y(5).Purchase_Outlay)}.`);

    /* C — cash above the whole house */
    st = await buy({ rtbEnabled: true, rtbBuyYear: 5, initialCash: 2000000, monthlyBudget: 5000, monthlyBudgetIncrease: 0 });
    own = await csvOf(page, 'own'); rent = await csvOf(page, 'rent'); rtb = await csvOf(page, 'rtb');
    const kC = await kpiText(page);
    out.C_kpiInitialCash = kpiNum(kC.initialCash);
    out.C_ownCashEndY0 = n(own.y(0).End_Cash);
    out.C_ownCashEndY1 = n(own.y(1).End_Cash);
    out.C_rtbLoanAtPurchase = n(rtb.y(5).Principal_Left);
    out.C_rtbCashEndY6 = n(rtb.y(6).End_Cash);
    out.C_rtbConservationResidualY6 = n(rtb.y(6).End_Cash) -
      (n(rent.y(5).End_Cash) * RF + n(rtb.y(6).Ann_Budget) - rtbOutflow(rtb.y(6)));
    nb.push(`C: #kpiInitialCash reads "${kC.initialCash}" (compact, ±$5,000 here).`);

    /* D — buy at year 1 */
    st = await buy({ rtbEnabled: true, rtbBuyYear: 1, monthlyBudget: 5000, monthlyBudgetIncrease: 0 });
    rent = await csvOf(page, 'rent'); rtb = await csvOf(page, 'rtb');
    out.D_rtbPurchasePrice = n(rtb.y(1).Prop_Value);
    out.D_rtbLoanAtPurchase = n(rtb.y(1).Principal_Left);
    out.D_rtbMortgagePaidYear2 = n(rtb.y(2).Principal_Exp) + n(rtb.y(2).Interest_Exp);
    out.D_rtbMinusRentCashY1 = preBuy(rtb.y(1)) - n(rent.y(1).End_Cash);
    out.D_rtbConservationResidualY2 = n(rtb.y(2).End_Cash) -
      (n(rent.y(1).End_Cash) * RF + n(rtb.y(2).Ann_Budget) - rtbOutflow(rtb.y(2)));
    out.D_rtbCashEndY2 = n(rtb.y(2).End_Cash);
    nb.push(`D: year 1 is the buy-transition row; its displayed End_Cash is post-purchase, so D_rtbMinusRentCashY1 uses End_Cash + Purchase_Outlay (${preBuy(rtb.y(1)).toFixed(0)}) against Rent year-1 cash ${n(rent.y(1).End_Cash)}. Purchase price taken from that row's Prop_Value (year-2 Prop_Value / 1.05 = ${(n(rtb.y(2).Prop_Value) / 1.05).toFixed(0)}).`);

    /* E — buy year = horizon */
    st = await buy({ rtbEnabled: true, rtbBuyYear: 30, horizon: 30, monthlyBudget: 5000, monthlyBudgetIncrease: 0 });
    rent = await csvOf(page, 'rent'); rtb = await csvOf(page, 'rtb');
    let emx = 0, eworst = null;
    for (const t of range(1, 29)) {
      const d = Math.abs(n(rtb.y(t).End_Cash) - n(rent.y(t).End_Cash));
      if (d > emx) { emx = d; eworst = t; }
    }
    out.E_rtbMinusRentCashMaxAbsY1to29 = emx;
    out.E_rtbNetEquityY30MinusRent = n(rtb.y(30).Net_Equity) - n(rent.y(30).Net_Equity);
    out.E_nanCount = (await nanCount(page)).count;
    let emx28 = 0;
    for (const t of range(1, 28)) emx28 = Math.max(emx28, Math.abs(n(rtb.y(t).End_Cash) - n(rent.y(t).End_Cash)));
    nb.push(
      `E: #rtbBuyYear could not be set to 30 — the page clamps the slider to horizon − 1, so it holds ${st.buyYear} (slider max ${st.max}, label "${st.label}") and the purchase falls in year ${st.buyYear}, not 30.`,
      `E: consequently the year-${st.buyYear} row is the buy-transition row and its displayed cash is post-purchase; the reported max over years 1–29 (worst at year ${eworst}) is driven by that. Over years 1–28 the max is ${emx28.toFixed(0)}; using End_Cash + Purchase_Outlay for year 29 gives |${(preBuy(rtb.y(29)) - n(rent.y(29).End_Cash)).toFixed(0)}|.`,
      `E: RTB phases at years 28/29/30 = ${rtb.y(28).Phase}/${rtb.y(29).Phase}/${rtb.y(30).Phase}.`,
    );

    /* F — RTB on vs off, explicit budget */
    await baseline(page);
    await apply(page, { monthlyBudget: 5000, monthlyBudgetIncrease: 0, rtbBuyYear: 5, rtbEnabled: true });
    let onOwn = await csvOf(page, 'own'), onRent = await csvOf(page, 'rent');
    const onIC = kpiNum((await kpiText(page)).initialCash);
    await apply(page, { rtbEnabled: false });
    const offOwn = await csvOf(page, 'own'), offRent = await csvOf(page, 'rent');
    const offIC = kpiNum((await kpiText(page)).initialCash);
    out.F_ownNetEquityY30RtbOnMinusOff = n(onOwn.y(30).Net_Equity) - n(offOwn.y(30).Net_Equity);
    out.F_rentNetEquityY30RtbOnMinusOff = n(onRent.y(30).Net_Equity) - n(offRent.y(30).Net_Equity);
    nb.push(`F: #kpiInitialCash with RTB on "${onIC}" vs off "${offIC}"; Own year-0 cash on/off ${n(onOwn.y(0).End_Cash)}/${n(offOwn.y(0).End_Cash)}.`);
    return out;
  } finally { await shut(browser); }
}

/* ═══ R8 — breakeven ═════════════════════════════════════════════════════ */
async function runR8(nb) {
  const { browser, page } = await open(PAGE);
  try {
    const out = {};

    await baseline(page);
    await apply(page, { houseGrowth: 10 });
    let own = await csvOf(page, 'own'), rent = await csvOf(page, 'rent');
    let k = await kpiText(page);
    out.A_breakevenYear = breakevenYear(k.breakeven);
    out.A_ownMinusRentNetEquityY1 = n(own.y(1).Net_Equity) - n(rent.y(1).Net_Equity);
    nb.push(`A: #kpiBreakeven text = "${k.breakeven}".`);

    await baseline(page);
    await apply(page, { houseGrowth: -5, rentInflation: 0 });
    own = await csvOf(page, 'own'); rent = await csvOf(page, 'rent');
    k = await kpiText(page);
    out.B_breakevenYear = breakevenYear(k.breakeven);
    out.B_ownMinusRentNetEquityY30 = n(own.y(30).Net_Equity) - n(rent.y(30).Net_Equity);
    nb.push(`B: #kpiBreakeven text = "${k.breakeven}" → ${out.B_breakevenYear === null ? 'null (no crossing within the horizon)' : out.B_breakevenYear}.`);

    await baseline(page);
    await apply(page, {
      houseGrowth: 1, riskFreeRate: 4.5, rentAmount: 5500, rentFreq: 'monthly',
      rentInflation: -6, monthlyBudget: 5000, monthlyBudgetIncrease: 0,
    });
    own = await csvOf(page, 'own'); rent = await csvOf(page, 'rent');
    k = await kpiText(page);
    const series = range(0, 30).map(t => n(own.y(t).Net_Equity) - n(rent.y(t).Net_Equity));
    let crossings = 0, firstOvertake = null;
    for (let i = 1; i < series.length; i++) {
      const a = series[i - 1], b = series[i];
      if ((a <= 0 && b > 0) || (a >= 0 && b < 0)) crossings++;
      if (firstOvertake === null && a <= 0 && b > 0) firstOvertake = i;   // index == year
    }
    out.C_ownMinusRentNetEquityByYear = series;
    out.C_crossingCount = crossings;
    out.C_firstOvertakeYearFromSeries = firstOvertake;
    out.C_breakevenYear = breakevenYear(k.breakeven);
    out.C_breakevenMinusFirstOvertake = (out.C_breakevenYear === null || firstOvertake === null)
      ? null : out.C_breakevenYear - firstOvertake;
    out.C_ownMinusRentNetEquityY8 = series[8];
    out.C_ownMinusRentNetEquityY30 = series[30];
    nb.push(
      `C: #kpiBreakeven text = "${k.breakeven}". Series read from the Net_Equity column of the Own and Rent CSV exports for years 0..30 (year 0 rows exist in both, so nothing was reconstructed).`,
      `C: sign of the series at years 0..12: ${series.slice(0, 13).map(v => v > 0 ? '+' : v < 0 ? '-' : '0').join('')}.`,
    );
    return out;
  } finally { await shut(browser); }
}

/* ═══ R9 — sensitivity page parity ═══════════════════════════════════════ */

const SENS_BASE = {
  horizon: 30, riskFreeRate: 4.5, initialCash: 0, monthlyBudget: 0, monthlyBudgetIncrease: 0,
  propertyPrice: 800000, downPaymentPct: 20, mortgageType: 'pi', mortgageRate: 6, mortgageTerm: 30,
  houseGrowth: 5, setupCost: 32000, setupCostType: 'dollar',
  ownOngoingCost: 6000, ownOngoingCostFreq: 'yearly', ownOngoingCostType: 'dollar', ownOngoingInflation: 0,
  costInterestOnly: true,
  rentAmount: 2800, rentFreq: 'monthly', rentInflation: 3,
  rentOngoingCost: 1200, rentOngoingCostFreq: 'yearly', rentOngoingCostType: 'dollar', rentOngoingInflation: 0,
};

async function sensSet(page, key, value) {
  const r = await page.evaluate(({ key, value }) => {
    const el = document.querySelector(
      `.param-input[data-si="0"][data-key="${key}"], .param-select[data-si="0"][data-key="${key}"], .param-bool[data-si="0"][data-key="${key}"]`);
    if (!el) return { ok: false, reason: 'no scenario control for ' + key };
    if (el.classList.contains('param-bool')) {
      el.checked = !!value; el.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true, now: el.checked };
    }
    if (el.tagName.toLowerCase() === 'select') {
      el.value = String(value); el.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true, now: el.value };
    }
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    return { ok: true, now: el.value };
  }, { key, value });
  if (!r.ok) throw new Error(r.reason);
  await page.waitForTimeout(25);
  return r.now;
}

async function sensRead(page) {
  return page.evaluate(() => {
    const cell = cls => {
      const tr = document.querySelector('#tableWrap tr.' + cls);
      if (!tr) return null;
      const td = tr.querySelector('td.scen-td');
      return td ? td.textContent.trim() : null;
    };
    return { own: cell('out-own'), rent: cell('out-rent'), delta: cell('out-delta') };
  });
}

async function sensMetric(page, metric) {
  const ok = await page.evaluate(m => {
    const b = document.querySelector('#metricGroup .seg-btn[data-metric="' + m + '"]');
    if (!b) return false; b.click(); return true;
  }, metric);
  if (!ok) throw new Error('no metric button ' + metric);
  await page.waitForTimeout(60);
}

async function sensYear(page, y) {
  const now = await page.evaluate(v => {
    const el = document.getElementById('yearInput');
    el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true }));
    return el.value;
  }, y);
  await page.waitForTimeout(80);
  return now;
}

async function sensCsv(page, which) {
  const txt = await page.evaluate(w => {
    window.__csv = null;
    const b = document.querySelector('.btn-scen-action.dl-' + w + '[data-si="0"]');
    if (!b) return null;
    b.click();
    return window.__csv;
  }, which);
  if (!txt) throw new Error('no sensitivity ' + which + ' cashflow captured');
  return parseCsv(txt);
}

async function runR9(nb) {
  const main = await open(PAGE);
  const sens = await open(SENS);
  try {
    const out = {};

    /* ---- main page, sub-case A ---- */
    await baseline(main.page);
    const mOwn = await csvOf(main.page, 'own'), mRent = await csvOf(main.page, 'rent');
    const mKpi = await kpiText(main.page);

    /* ---- sensitivity page, one scenario ---- */
    const scen0 = await sens.page.evaluate(() => {
      // keep exactly one scenario column
      let guard = 0;
      while (document.querySelectorAll('th.scen-th').length > 1 && guard++ < 10) {
        const b = document.querySelector('.rmv-scen[data-si="1"]') || document.querySelector('.rmv-scen');
        if (!b) break; b.click();
      }
      const sel = document.getElementById('currencySelect');
      if (sel) { sel.value = '$'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
      return document.querySelectorAll('th.scen-th').length;
    });
    await sens.page.waitForTimeout(120);
    if (scen0 !== 1) throw new Error('sensitivity page holds ' + scen0 + ' scenario columns, wanted 1');
    for (const [k, v] of Object.entries(SENS_BASE)) await sensSet(sens.page, k, v);
    await sens.page.waitForTimeout(120);

    const missingOnSens = await sens.page.evaluate(() => {
      const keys = [...document.querySelectorAll('[data-key]')].map(e => e.dataset.key);
      return ['rtbEnabled', 'rtbBuyYear', 'currencySymbol'].filter(k => !keys.includes(k));
    });
    const hasRtbRow = await sens.page.evaluate(() => {
      const txt = (document.getElementById('tableWrap') || {}).innerText || '';
      const keys = [...document.querySelectorAll('[data-key],[data-list],[data-mode-key]')]
        .map(e => e.dataset.key || e.dataset.list || e.dataset.modeKey).join(' ');
      return /rent[- ]?then[- ]?buy|\brtb\b/i.test(txt) || /rtb/i.test(keys);
    });

    await sensMetric(sens.page, 'netEquity');
    await sensYear(sens.page, 30);
    const cell30 = await sensRead(sens.page);
    const sOwn = await sensCsv(sens.page, 'own'), sRent = await sensCsv(sens.page, 'rent');

    out.A_sensOwnNetEquityY30 = kpiNum(cell30.own);
    out.A_ownNetEquityY30MainMinusSens = n(mOwn.y(30).Net_Equity) - n(sOwn.y(30).Net_Equity);
    out.A_rentNetEquityY30MainMinusSens = n(mRent.y(30).Net_Equity) - n(sRent.y(30).Net_Equity);
    out.A_deltaY30MainMinusSens = kpiNum(mKpi.diff) - kpiNum(cell30.delta);
    out.A_ownCashY30MainMinusSens = n(mOwn.y(30).End_Cash) - n(sOwn.y(30).End_Cash);
    out.A_rentCashY30MainMinusSens = n(mRent.y(30).End_Cash) - n(sRent.y(30).End_Cash);
    out.A_ownCostY30MainMinusSens = n(mOwn.y(30).Accum_Cost) - n(sOwn.y(30).Accum_Cost);
    out.A_rentCostY30MainMinusSens = n(mRent.y(30).Accum_Cost) - n(sRent.y(30).Accum_Cost);
    out.A_ownNetEquityY10MainMinusSens = n(mOwn.y(10).Net_Equity) - n(sOwn.y(10).Net_Equity);
    out.A_rentNetEquityY10MainMinusSens = n(mRent.y(10).Net_Equity) - n(sRent.y(10).Net_Equity);

    await sensMetric(sens.page, 'cash');
    const cellCash30 = await sensRead(sens.page);
    await sensMetric(sens.page, 'cost');
    const cellCost30 = await sensRead(sens.page);
    await sensMetric(sens.page, 'netEquity');
    await sensYear(sens.page, 10);
    const cell10 = await sensRead(sens.page);
    const y100 = await sensYear(sens.page, 100);
    const cell100 = await sensRead(sens.page);
    await sensYear(sens.page, 30);
    const cell30b = await sensRead(sens.page);
    out.A_sensYear100MinusYear30OwnNetEquity = kpiNum(cell100.own) - kpiNum(cell30b.own);

    nb.push(
      'Sensitivity page driven with exactly one scenario column (the second default scenario was removed with its ✕ button) and every parameter typed into it by its data-key, which matches the main page\'s control ids one-for-one.',
      `Main-page inputs with no counterpart on the sensitivity page: ${missingOnSens.join(', ') || '(none)'} — rent-then-buy and the per-page currency symbol. They were left at their baseline on the main page (RTB off, "$").`,
      `Output cells read from tr.out-own / tr.out-rent / tr.out-delta: year 30 net equity own=${cell30.own} rent=${cell30.rent} delta=${cell30.delta}; liquid cash own=${cellCash30.own} rent=${cellCash30.rent}; accum cost own=${cellCost30.own} rent=${cellCost30.rent}; year 10 own=${cell10.own} rent=${cell10.rent}; year 100 own=${cell100.own}.`,
      'Those cells are rendered compactly ($1.23m / $192k), so every "MainMinusSens" difference above was computed from the two pages\' CSV exports instead (main #downloadBtn vs the scenario\'s ⬇ Own/Rent buttons — both produced by the same shared RVOExport builder, whole dollars). A_sensOwnNetEquityY30 is the cell value as the key asks, so it will not exactly equal main − A_ownNetEquityY30MainMinusSens.',
      `A_deltaY30MainMinusSens is the only difference key that has to use two compact readings (#kpiDiff "${mKpi.diff}" and the delta cell "${cell30.delta}"); from the CSVs the same quantity is ${((n(mOwn.y(30).Net_Equity) - n(mRent.y(30).Net_Equity)) - (n(sOwn.y(30).Net_Equity) - n(sRent.y(30).Net_Equity))).toFixed(0)}.`,
      `#yearInput accepted ${y100} for the year-100 reading; the scenario column header notes the clamp to its horizon.`,
    );

    /* ---- sub-case B: floating band ---- */
    await baseline(main.page);
    await apply(main.page, { mortgageRate: 6, monthlyBudget: '0' });
    await setSchedule(main.page, [{ type: 'floating', min: 5, max: 7 }]);
    await main.page.waitForTimeout(100);
    const bandB = bandVerdicts(await chartBand(main.page));
    const mOwnB = await csvOf(main.page, 'own'), mRentB = await csvOf(main.page, 'rent');
    const bandRaw = await chartBand(main.page);
    const ownLbl = bandRaw.main.netEquityOwn.label, rentLbl = bandRaw.main.netEquityRent.label;
    const i = bandRaw.main.netEquityOwn.data.length - 1;
    const mainOwnLow = bandRaw.bands[ownLbl].low[i], mainOwnHigh = bandRaw.bands[ownLbl].high[i];

    const modeOk = await sens.page.evaluate(() => {
      const seg = document.querySelector('.mode-seg[data-mode-key="mortgageMode"] .seg-btn[data-val="detailed"]');
      if (!seg) return false; seg.click(); return true;
    });
    if (!modeOk) throw new Error('sensitivity page has no mortgage-mode Detailed toggle');
    await sens.page.waitForTimeout(120);
    const sensPeriods = await sens.page.evaluate(() => {
      const rows = [...document.querySelectorAll('.rp-type[data-si="0"]')];
      return rows.length;
    });
    await sens.page.evaluate(() => {
      const ty = document.querySelector('.rp-type[data-si="0"][data-idx="0"]');
      ty.value = 'floating'; ty.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await sens.page.waitForTimeout(120);
    await sens.page.evaluate(() => {
      const put = (cls, v) => {
        const el = document.querySelector('.' + cls + '[data-si="0"][data-idx="0"]');
        if (!el) return;
        el.value = String(v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
      };
      put('rp-min', 5); put('rp-max', 7);
    });
    await sens.page.waitForTimeout(150);
    await sensMetric(sens.page, 'netEquity');
    await sensYear(sens.page, 30);
    const cellB = await sensRead(sens.page);
    const sOwnB = await sensCsv(sens.page, 'own'), sRentB = await sensCsv(sens.page, 'rent');
    const sensPeriodShown = await sens.page.evaluate(() =>
      [...document.querySelectorAll('.dcell')].slice(0, 3).map(d => d.textContent.replace(/\s+/g, ' ').trim()));

    out.B_sensOwnNetEquityY30MinusMainMid = n(sOwnB.y(30).Net_Equity) - n(mOwnB.y(30).Net_Equity);
    out.B_sensRentNetEquityY30MinusMainMid = n(sRentB.y(30).Net_Equity) - n(mRentB.y(30).Net_Equity);
    out.B_sensOwnNetEquityY30MinusMainLowAbs = Math.abs(n(sOwnB.y(30).Net_Equity) - mainOwnLow);
    out.B_sensOwnNetEquityY30MinusMainHighAbs = Math.abs(n(sOwnB.y(30).Net_Equity) - mainOwnHigh);
    out.sensHasRtbRow = hasRtbRow;

    nb.push(
      `B: the sensitivity page's floating period also offers only a low–high pair (${sensPeriods} period row(s); shown as ${JSON.stringify(sensPeriodShown)}), so 5.0 / 7.0 were entered and no separate mid was needed. Sensitivity output cell at year 30: own=${cellB.own} rent=${cellB.rent} delta=${cellB.delta}.`,
      `B: main-page per-path Own net equity at year 30 — low ${mainOwnLow.toFixed(0)}, mid ${n(mOwnB.y(30).Net_Equity)}, high ${mainOwnHigh.toFixed(0)} (read from the plotted band; verdicts low/mid/high = ${bandB.low.toFixed(0)}/${bandB.mid.toFixed(0)}/${bandB.high.toFixed(0)}). No fixed-rate re-runs were needed.`,
      'B: sensitivity values taken from that scenario\'s Own/Rent cashflow download (whole dollars) so the comparison is not swamped by the cell\'s compact rounding.',
      `sensHasRtbRow: searched the rendered table's text and every data-key/data-list/data-mode-key for a rent-then-buy row → ${hasRtbRow}.`,
    );
    return out;
  } finally { await shut(main.browser); await shut(sens.browser); }
}

/* ═══ R10 — cost item bases ══════════════════════════════════════════════ */
async function runR10(nb) {
  const { browser, page } = await open(PAGE);
  try {
    const out = {};

    /* A — own ongoing as % of property value */
    await baseline(page);
    await apply(page, { ownOngoingCostType: 'pct', ownOngoingCost: 1, ownOngoingCostFreq: 'yearly' });
    const inflRowVisible = await page.evaluate(() =>
      getComputedStyle(document.getElementById('ownOngoingInflationRow')).display !== 'none');
    if (inflRowVisible) await set(page, 'ownOngoingInflation', 10);
    let own = await csvOf(page, 'own');
    out.A_ownOngoingYear1 = n(own.y(1).Ongoing_Exp);
    out.A_ownOngoingYear2 = n(own.y(2).Ongoing_Exp);
    out.A_ownOngoingYear30 = n(own.y(30).Ongoing_Exp);
    out.A_inflationControlState = inflRowVisible
      ? await page.evaluate(() => document.getElementById('ownOngoingInflation').value) : 'hidden';
    nb.push(`A: with the % option selected the page hides #ownOngoingInflationRow (visible = ${inflRowVisible}). Property value at the start of year 1 / 2 / 30 (previous year's Prop_Value): ${800000} / ${n(own.y(1).Prop_Value)} / ${n(own.y(29).Prop_Value)}.`);

    /* B — $ item with 10% inflation */
    await baseline(page);
    await apply(page, { ownOngoingCostType: 'dollar', ownOngoingCost: 6000, ownOngoingCostFreq: 'yearly', ownOngoingInflation: 10 });
    own = await csvOf(page, 'own');
    out.B_ownOngoingYear1 = n(own.y(1).Ongoing_Exp);
    out.B_ownOngoingYear2 = n(own.y(2).Ongoing_Exp);
    out.B_ownOngoingYear5 = n(own.y(5).Ongoing_Exp);
    out.B_ownOngoingYear30 = n(own.y(30).Ongoing_Exp);

    /* C — rent ongoing as % of annual rent */
    await baseline(page);
    await apply(page, { rentOngoingCostType: 'pct', rentOngoingCost: 10, rentOngoingCostFreq: 'yearly' });
    const rInfl = await page.evaluate(() => getComputedStyle(document.getElementById('rentOngoingInflationRow')).display !== 'none');
    if (rInfl) await set(page, 'rentOngoingInflation', 10);
    let rent = await csvOf(page, 'rent');
    out.C_rentOngoingYear1 = n(rent.y(1).Ongoing_Exp);
    out.C_rentOngoingYear2 = n(rent.y(2).Ongoing_Exp);
    out.C_rentOngoingYear30 = n(rent.y(30).Ongoing_Exp);
    nb.push(`C: #rentOngoingInflationRow visible with the % option = ${rInfl}. Rent charged in years 1/2/30: ${n(rent.y(1).Rent_Exp)}/${n(rent.y(2).Rent_Exp)}/${n(rent.y(30).Rent_Exp)}.`);

    /* D — setup cost as % */
    await baseline(page);
    const kDollar = await kpiText(page);
    const dollarOwn = await csvOf(page, 'own'), dollarRent = await csvOf(page, 'rent');
    await apply(page, { setupCostType: 'pct', setupCost: 4 });
    const kPct = await kpiText(page);
    const pctOwn = await csvOf(page, 'own'), pctRent = await csvOf(page, 'rent');
    out.D_kpiInitialCash = kpiNum(kPct.initialCash);
    out.D_kpiDiffPctSetupMinusDollarSetup = kpiNum(kPct.diff) - kpiNum(kDollar.diff);
    const dDelta = (n(pctOwn.y(30).Net_Equity) - n(pctRent.y(30).Net_Equity)) -
      (n(dollarOwn.y(30).Net_Equity) - n(dollarRent.y(30).Net_Equity));
    nb.push(`D: #kpiDiff "${kPct.diff}" (4 % setup) vs "${kDollar.diff}" ($32,000 setup); both KPIs are compact, so the exact table-derived difference is ${dDelta.toFixed(0)}. #kpiInitialCash "${kPct.initialCash}".`);

    /* E — mode round trip and detailed equivalent */
    await baseline(page);
    const kBefore = await kpiText(page);
    const beforeOwn = await csvOf(page, 'own'), beforeRent = await csvOf(page, 'rent');
    await segClick(page, 'ownCostsModeGroup', 'detailed');
    await segClick(page, 'rentCostsModeGroup', 'detailed');
    await page.waitForTimeout(80);
    const seeded = await page.evaluate(() => {
      const read = id => [...document.querySelectorAll('#' + id + ' .cost-item-row')].map(r => ({
        name: r.querySelector('.ci-name')?.value,
        amount: r.querySelector('.ci-amount')?.value,
        basis: r.querySelector('.ci-basis')?.value,
        infl: r.querySelector('.ci-infl')?.value ?? null,
      }));
      return { ownSetup: read('ownSetupCostRows'), ownOngoing: read('ownOngoingCostRows'), rentOngoing: read('rentOngoingCostRows') };
    });
    await segClick(page, 'ownCostsModeGroup', 'simple');
    await segClick(page, 'rentCostsModeGroup', 'simple');
    await page.waitForTimeout(80);
    const kRound = await kpiText(page);
    const roundOwn = await csvOf(page, 'own'), roundRent = await csvOf(page, 'rent');
    out.E_kpiDiffRoundTripMinusBefore = kpiNum(kRound.diff) - kpiNum(kBefore.diff);

    await segClick(page, 'ownCostsModeGroup', 'detailed');
    await segClick(page, 'rentCostsModeGroup', 'detailed');
    await page.waitForTimeout(80);
    await page.evaluate(() => {
      const fire = el => ['input', 'change', 'blur'].forEach(e => el.dispatchEvent(new Event(e, { bubbles: true })));
      const one = (rowsId, name, amount, basis, infl) => {
        const rows = [...document.querySelectorAll('#' + rowsId + ' .cost-item-row')];
        rows.slice(1).forEach(r => r.querySelector('.ci-delete')?.click());
        const r = document.querySelector('#' + rowsId + ' .cost-item-row');
        if (!r) return;
        const nm = r.querySelector('.ci-name'); nm.value = name; fire(nm);
        const b = r.querySelector('.ci-basis'); b.value = basis; b.dispatchEvent(new Event('change', { bubbles: true }));
        const a = r.querySelector('.ci-amount'); a.value = String(amount); fire(a);
        const inf = r.querySelector('.ci-infl'); if (inf && infl !== null) { inf.value = String(infl); fire(inf); }
      };
      one('ownSetupCostRows', 'Stamp duty', 32000, 'fixed', null);
      one('ownOngoingCostRows', 'Rates', 6000, 'yearly', 0);
      one('rentOngoingCostRows', 'Insurance', 1200, 'yearly', 0);
    });
    await page.waitForTimeout(120);
    const detailedItems = await page.evaluate(() => {
      const read = id => [...document.querySelectorAll('#' + id + ' .cost-item-row')].map(r => ({
        name: r.querySelector('.ci-name')?.value, amount: r.querySelector('.ci-amount')?.value,
        basis: r.querySelector('.ci-basis')?.value, infl: r.querySelector('.ci-infl')?.value ?? null,
      }));
      return { ownSetup: read('ownSetupCostRows'), ownOngoing: read('ownOngoingCostRows'), rentOngoing: read('rentOngoingCostRows') };
    });
    const kDetailed = await kpiText(page);
    const detOwn = await csvOf(page, 'own'), detRent = await csvOf(page, 'rent');
    out.E_kpiDiffDetailedEquivalentMinusSimple = kpiNum(kDetailed.diff) - kpiNum(kBefore.diff);

    nb.push(
      `E: cost items are .cost-item-row elements with .ci-name, .ci-amount plus a single .ci-basis select (yearly/monthly/weekly/% for ongoing, $/% for setup), .ci-infl and .ci-delete — as described in the contract except that unit, frequency and type share one select.`,
      `E: switching to detailed seeds the lists from the simple inputs: ${JSON.stringify(seeded)}; after typing the named items: ${JSON.stringify(detailedItems)}.`,
      `E: #kpiDiff before "${kBefore.diff}", after the detailed→simple round trip "${kRound.diff}", with the detailed equivalent "${kDetailed.diff}". Both KPI differences are quantised by compact rendering; exact table deltas — before ${(n(beforeOwn.y(30).Net_Equity) - n(beforeRent.y(30).Net_Equity)).toFixed(0)}, round trip ${(n(roundOwn.y(30).Net_Equity) - n(roundRent.y(30).Net_Equity)).toFixed(0)}, detailed ${(n(detOwn.y(30).Net_Equity) - n(detRent.y(30).Net_Equity)).toFixed(0)}.`,
    );
    return out;
  } finally { await shut(browser); }
}

/* ═══ R11 — frequency conversions ════════════════════════════════════════ */
async function runR11(nb) {
  const { browser, page } = await open(PAGE);
  try {
    const out = {};
    const disp = () => page.evaluate(() => document.getElementById('rentMonthlyDisplay').textContent.trim());

    await baseline(page);
    await apply(page, { rentFreq: 'weekly', rentAmount: 700 });
    let d = await disp(); let rent = await csvOf(page, 'rent');
    out.A_rentMonthlyDisplayValue = kpiNum(d);
    out.A_rentPaidYear1 = n(rent.y(1).Rent_Exp);
    out.A_rentPaidYear2 = n(rent.y(2).Rent_Exp);
    nb.push(`A: #rentMonthlyDisplay = "${d}".`);

    await baseline(page);
    await apply(page, { rentFreq: 'yearly', rentAmount: 36000 });
    d = await disp(); rent = await csvOf(page, 'rent');
    out.B_rentMonthlyDisplayValue = kpiNum(d);
    out.B_rentPaidYear1 = n(rent.y(1).Rent_Exp);
    nb.push(`B: #rentMonthlyDisplay = "${d}".`);

    await baseline(page);
    await apply(page, { ownOngoingCostType: 'dollar', ownOngoingCostFreq: 'weekly', ownOngoingCost: 100 });
    let own = await csvOf(page, 'own');
    out.C_ownOngoingYear1 = n(own.y(1).Ongoing_Exp);

    await baseline(page);
    await apply(page, { ownOngoingCostType: 'dollar', ownOngoingCostFreq: 'monthly', ownOngoingCost: 500 });
    own = await csvOf(page, 'own');
    out.D_ownOngoingYear1 = n(own.y(1).Ongoing_Exp);

    await baseline(page);
    await apply(page, { rentOngoingCostType: 'dollar', rentOngoingCostFreq: 'weekly', rentOngoingCost: 20 });
    rent = await csvOf(page, 'rent');
    out.E_rentOngoingYear1 = n(rent.y(1).Ongoing_Exp);

    await baseline(page);
    d = await disp();
    out.F_rentMonthlyDisplayValue = kpiNum(d);
    nb.push(`F: #rentMonthlyDisplay = "${d}". Rent/ongoing yearly totals read from the Rent_Exp and Ongoing_Exp columns of the CSV export (whole dollars).`);
    return out;
  } finally { await shut(browser); }
}

/* ═══ R12 — /id/ parity ══════════════════════════════════════════════════ */
async function runR12(nb) {
  const en = await open(PAGE);
  const id = await open(ID_PAGE);
  try {
    const out = {};
    const snap = async (p, H, withRtb) => {
      const own = await csvOf(p, 'own'), rent = await csvOf(p, 'rent');
      const k = await kpiText(p);
      const rtb = withRtb ? await csvOf(p, 'rtb') : null;
      return { own, rent, rtb, k };
    };

    /* A — baseline on both */
    await baseline(en.page); await baseline(id.page);
    const a1 = await snap(en.page, 30, false), a2 = await snap(id.page, 30, false);
    out.A_kpiDiffIdMinusEn = kpiNum(a2.k.diff) - kpiNum(a1.k.diff);
    out.A_kpiInitialCashIdMinusEn = kpiNum(a2.k.initialCash) - kpiNum(a1.k.initialCash);
    const beEn = breakevenYear(a1.k.breakeven), beId = breakevenYear(a2.k.breakeven);
    out.A_breakevenIdMinusEn = (beEn === null && beId === null) ? 0
      : (beEn === null || beId === null) ? null : beId - beEn;
    out.A_ownNetEquityY30IdMinusEn = n(a2.own.y(30).Net_Equity) - n(a1.own.y(30).Net_Equity);
    out.A_rentNetEquityY30IdMinusEn = n(a2.rent.y(30).Net_Equity) - n(a1.rent.y(30).Net_Equity);
    nb.push(`A: KPI texts — / : diff "${a1.k.diff}", initial cash "${a1.k.initialCash}", breakeven "${a1.k.breakeven}"; /id/ : diff "${a2.k.diff}", initial cash "${a2.k.initialCash}", breakeven "${a2.k.breakeven}".`);

    /* B — modified inputs on both */
    const OVER = {
      propertyPrice: 950000, downPaymentPct: 15, mortgageRate: 6.5, mortgageTerm: 25, houseGrowth: 4,
      setupCost: 40000, ownOngoingCost: 7500, rentAmount: 3100, rentFreq: 'monthly', rentInflation: 2.5,
      rentOngoingCost: 1000, riskFreeRate: 5, horizon: 25,
      monthlyBudget: 6000, monthlyBudgetIncrease: 2, rtbEnabled: true, rtbBuyYear: 7,
    };
    for (const p of [en.page, id.page]) { await baseline(p); await apply(p, OVER); }
    const b1 = await snap(en.page, 25, true), b2 = await snap(id.page, 25, true);
    out.B_kpiDiffIdMinusEn = kpiNum(b2.k.diff) - kpiNum(b1.k.diff);
    out.B_ownNetEquityY25IdMinusEn = n(b2.own.y(25).Net_Equity) - n(b1.own.y(25).Net_Equity);
    out.B_rentNetEquityY25IdMinusEn = n(b2.rent.y(25).Net_Equity) - n(b1.rent.y(25).Net_Equity);
    out.B_rtbNetEquityY25IdMinusEn = n(b2.rtb.y(25).Net_Equity) - n(b1.rtb.y(25).Net_Equity);
    out.B_mortgagePaidYear1En = ownMortgage(b1.own.y(1));
    out.B_mortgagePaidYear1Id = ownMortgage(b2.own.y(1));
    out.B_kpiInitialCashEn = kpiNum(b1.k.initialCash);
    nb.push(
      `B: KPI texts — / : "${b1.k.diff}" / "${b1.k.initialCash}"; /id/ : "${b2.k.diff}" / "${b2.k.initialCash}".`,
      'Both pages share ../script.js and the same DOM ids; money is formatted with the en-AU locale on both (the /id/ page translates labels only), so the driver\'s money() parse is unambiguous here. #currencySymbol left at "$" on both.',
      'Series read from each page\'s own CSV export; the /id/ CSV carries Indonesian phase words in the RTB table but identical numeric columns.',
    );
    return out;
  } finally { await shut(en.browser); await shut(id.browser); }
}

/* ── driver ─────────────────────────────────────────────────────────────── */
const CASES = {
  N1: runN1, R1: runR1, R2: runR2, R3: runR3, R4: runR4, R5: runR5,
  R6: runR6, R7: runR7, R8: runR8, R9: runR9, R10: runR10, R11: runR11, R12: runR12,
};

const only = process.argv.slice(2).filter(a => !a.startsWith('-'));
const ids = C.cases.map(c => c.id).filter(id => !only.length || only.includes(id));

console.log(`rentvsownhouse: driving ${ids.length} case(s) against ${C.page}`);
for (const id of ids) {
  const fn = CASES[id];
  const nb = [];
  const r = await runCase(bag, id, async () => {
    if (!fn) throw new Error('no runner implemented for case ' + id);
    return fn(nb);
  });
  if (nb.length) note(r, ...nb);
}
emit('rentvsownhouse', bag, {
  page: C.page,
  how: 'Playwright + _qa/run/_driver.mjs (CDN stubbed). Yearly series captured from the pages\' own CSV exports by replacing RVOExport.downloadCSV with a recorder; KPI/snapshot/legend figures read from the DOM as rendered (the page renders money compactly — "$1.23m"/"$192k" — so those carry display rounding, noted per case); floating-rate band read from the datasets the page plots.',
});
