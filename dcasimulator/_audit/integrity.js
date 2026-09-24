/* DCA Simulator integrity audit.

   harness.js keeps hand copies of the two engines; this file does not. It lifts
   every engine function it runs straight out of the shipped page sources
   (../script.js and ../portfolio/script.js), so a check here is a check of the
   code users run. Four families of checks:

     A. Accounting: every number reconciles by arithmetic. The single-asset
        ledger is units x price; the portfolio ledger closes as
        value = top-ups + interest - fees + market gain, where the market gain is
        rebuilt independently from the day-to-day holdings and prices.
     B. Triggers: no decision depends on a price that has not happened yet. The
        future beyond a cut day is replaced by a different price path and every
        decision (and every ledger row) up to the cut must be unchanged. The
        Forward styles are expected to fail this, and are checked to.
     C. Parity: a scenario both tools can express gives the same numbers in
        both: buy dates, daily value, deposits, final value, and the four
        advanced metrics.
     D. Display: the percent formatter, and the shared date axis the main
        tool's charts index by.

   Run: node integrity.js                      (pure engine, no browser)
        node integrity.js --ui                 (also drives both real pages
                                                headless and compares tiles) */
'use strict';
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function ok(cond, msg, detail){
  if(cond){ passed++; if(process.env.VERBOSE && msg.startsWith('[ui]')) console.log('  PASS  ' + msg); }
  else { failed++; console.log('  FAIL  ' + msg + (detail ? '\n        ' + detail : '')); }
}
const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

/* ── shared.js (SharedTA) with browser stubs ─────────────────────────────── */
function loadShared(){
  const code = fs.readFileSync(path.join(__dirname, '..', '..', 'shared.js'), 'utf8');
  const noop = () => {};
  const fakeEl = new Proxy({}, { get: () => noop, set: () => true });
  const document = { readyState: 'complete', addEventListener: noop, removeEventListener: noop,
    querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
    createElement: () => fakeEl, body: fakeEl, documentElement: fakeEl };
  const window = { document, addEventListener: noop, navigator: { clipboard: {} },
    getComputedStyle: () => ({ getPropertyValue: () => '' }) };
  window.window = window;
  new Function('window', 'document', 'global', 'requestAnimationFrame', code)(window, document, window, f => f());
  return window;
}
const W = loadShared();
const SharedTA = W.SharedTA, SharedYF = W.SharedYF;

/* ── lift top-level declarations out of a page source ────────────────────── */
// Walks braces while skipping strings, template literals and comments, so a
// brace inside a string or a `${}` cannot end the function early.
function blockEnd(src, open){
  let depth = 0;
  for(let j = open; j < src.length; j++){
    const c = src[j], n = src[j + 1];
    if(c === '/' && n === '/'){ j = src.indexOf('\n', j); if(j < 0) return -1; continue; }
    if(c === '/' && n === '*'){ j = src.indexOf('*/', j + 2) + 1; continue; }
    if(c === '"' || c === "'"){ for(j++; j < src.length && src[j] !== c; j++) if(src[j] === '\\') j++; continue; }
    if(c === '`'){
      let tdepth = 0;
      for(j++; j < src.length; j++){
        if(src[j] === '\\'){ j++; continue; }
        if(src[j] === '$' && src[j + 1] === '{'){ tdepth++; j++; continue; }
        if(src[j] === '}' && tdepth){ tdepth--; continue; }
        if(src[j] === '`' && !tdepth) break;
      }
      continue;
    }
    if(c === '{') depth++;
    else if(c === '}'){ depth--; if(depth === 0) return j; }
  }
  return -1;
}
function lift(src, names, label){
  return names.map(name => {
    let m = new RegExp('^(?:async )?function ' + name + '\\(', 'm').exec(src);
    if(m){
      const bodyOpen = src.indexOf('{', blockParen(src, m.index + m[0].length - 1));
      return src.slice(m.index, blockEnd(src, bodyOpen) + 1);
    }
    m = new RegExp('^const ' + name + '\\s*=\\s*\\{', 'm').exec(src);
    if(!m) throw new Error(label + ': ' + name + ' not found');
    return src.slice(m.index, blockEnd(src, m.index + m[0].length - 1) + 1) + ';';
  }).join('\n');
}
function blockParen(src, open){
  let depth = 0;
  for(let j = open; j < src.length; j++){
    if(src[j] === '(') depth++;
    else if(src[j] === ')'){ depth--; if(depth === 0) return j; }
  }
  return -1;
}

const MAIN_SRC = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
const PF_SRC = fs.readFileSync(path.join(__dirname, '..', 'portfolio', 'script.js'), 'utf8');

const COMMON_FNS = ['sanitizeSeed', 'parseDate', 'isoDate', 'createSeededRng', 'deriveSeed', 'generateGBMPrices',
  'statMean', 'statStdev', 'downsideDev', 'xirr', 'computeMetrics', 'fmt'];

function mainModule(riskFreeRate){
  const code = lift(MAIN_SRC, COMMON_FNS.concat(['dailyReturns', 'groupIndicesByPeriod', 'periodSignalDates',
    'getInvestmentDates', 'investAmountAt', 'simulateSecurity', 'alignToCommonDates']), 'script.js');
  return new Function('SharedTA', 'currentRiskFreeRate', `
    const DEFAULT_RANDOM_SEED = 25823952204, TRADING_DAYS = 252;
    let currentCurrencySymbol = '$';
    const TECH_STYLES = ['tech-ma-cross','tech-rsi','tech-bollinger','tech-macd-cross','tech-macd-hist','tech-adx'];
    const buildTech = SharedTA.buildTech, periodKey = SharedTA.periodKey;
    ${code}
    return { generateGBMPrices, createSeededRng, deriveSeed, getInvestmentDates, simulateSecurity,
             alignToCommonDates, computeMetrics, xirr, fmt, investAmountAt };`)(SharedTA, riskFreeRate);
}
function pfModule(){
  const code = lift(PF_SRC, COMMON_FNS.concat(['portfolioReturns', 'rfReturns', 'weekKey', 'closestByDom', 'closestByDow',
    'getScheduleIndices', 'pxOk', 'normWeights', 'investedValue', 'buyByWeights', 'buyUnderweight', 'fullRebalance',
    'trailingReturn', 'momentumWeights', 'buildAssetTriggerSignals', 'deployTriggered', 'simulatePortfolio']), 'portfolio/script.js');
  return new Function('SharedTA', `
    const DEFAULT_RANDOM_SEED = 25823952204, TRADING_DAYS = 252;
    let currentCurrencySymbol = '$';
    ${code}
    return { generateGBMPrices, createSeededRng, deriveSeed, simulatePortfolio, getScheduleIndices,
             buildAssetTriggerSignals, computeMetrics, xirr, fmt };`)(SharedTA);
}
const M = mainModule(4);
const P = pfModule();

/* ── price data: seeded GBM from the pages' own generator, plus calendars ── */
const SEED = 25823952204;
function gbm(mod, name, ret, std, start = '2012-01-01', end = '2024-12-31'){
  return mod.generateGBMPrices(start, end, ret, std, 100, mod.createSeededRng(mod.deriveSeed(SEED, `${name}|${ret}|${std}`)));
}
// A holiday calendar: drop a deterministic handful of weekdays per year.
function withHolidays(pd, salt){
  const keep = pd.dates.map((d, i) => { const h = (i * 2654435761 + salt) >>> 0; return (h % 97) !== 0; });
  const f = arr => arr && arr.filter((_, i) => keep[i]);
  return { dates: f(pd.dates), prices: f(pd.prices), opens: f(pd.opens), highs: f(pd.highs), lows: f(pd.lows) };
}
// Replace everything after `cut` with a different path (same dates).
function perturbAfter(prices, cut, salt){
  const rng = M.createSeededRng(salt);
  const out = prices.slice();
  for(let i = cut + 1; i < out.length; i++) out[i] = out[i - 1] * Math.exp((rng() - 0.5) * 0.12);
  return out;
}

const EQ = gbm(M, 'Equity', 9, 18);          // long equity-like path
const BD = gbm(M, 'Bonds', 3, 5);            // low-vol path
const EQ_US = withHolidays(EQ, 11);          // two calendars of the same asset
const BD_AU = withHolidays(BD, 37);

const ALL_STYLES = ['monthly-date', 'weekly-day', 'momentum-peak', 'momentum-dip',
  'tech-ma-cross', 'tech-rsi', 'tech-bollinger', 'tech-macd-cross', 'tech-macd-hist', 'tech-adx',
  'monthly-top', 'monthly-bottom', 'weekly-top', 'weekly-bottom'];
const FORWARD = new Set(['monthly-top', 'monthly-bottom', 'weekly-top', 'weekly-bottom']);
const TECH = { fastMaType: 'ema', fastMaLen: 20, slowMaType: 'sma', slowMaLen: 60, rsiPeriod: 14, rsiOversold: 40,
  bbPeriod: 20, bbStd: 2, bbTrigger: 'below', macdFast: 12, macdSlow: 26, macdSignal: 9, macdHistThreshold: 0,
  adxPeriod: 14, adxThreshold: 20 };
function secOf(style, pd, extra = {}){
  return Object.assign({ name: 'S', style, priceData: pd, amount: 500, yearlyIncrease: 0,
    dayOrDate: style === 'weekly-day' ? 3 : 15, momentumPct: 4, momentumEOM: true, tech: TECH, techEOM: true,
    period: 'monthly' }, extra);
}

/* ═══ A. ACCOUNTING ═════════════════════════════════════════════════════════ */
console.log('A. accounting');
for(const style of ALL_STYLES) for(const period of ['monthly', 'weekly']) for(const yinc of [0, 7]){
  const res = M.simulateSecurity(secOf(style, EQ, { period, yearlyIncrease: yinc, momentumEOM: period === 'monthly', techEOM: period === 'monthly' }));
  const tag = `[main ${style} ${period} +${yinc}%]`;
  let units = 0, dep = 0, rowsOk = true, amtOk = true;
  for(const r of res.investRows){
    units += r.unitsAdded; dep += r.amountInvested;
    if(!close(r.unitsAdded, r.amountInvested / r.price) || !close(r.totalUnits, units) || !close(r.totalDeposited, dep) ||
       !close(r.equity, r.totalUnits * r.price) ||
       !close(r.returnPct, (r.equity - r.totalDeposited) / r.totalDeposited * 100)) rowsOk = false;
    if(!close(r.amountInvested, M.investAmountAt(500, yinc, EQ.dates[0], r.date))) amtOk = false;
  }
  ok(rowsOk, `${tag} every buy row: units = amount / price, running totals, equity = units x price, return`);
  ok(amtOk, `${tag} every amount = base x (1 + r)^(whole years since the first day)`);
  // daily ledger: units move only on buy days, by exactly that day's units
  const buyUnits = new Map(res.investRows.map(r => [r.date, r.unitsAdded]));
  let prev = 0, dailyOk = true;
  for(const d of res.dailyRows){
    const step = d.totalUnits - prev;
    if(!(buyUnits.has(d.date) ? close(step, buyUnits.get(d.date)) : step === 0)) dailyOk = false;
    if(!close(d.equity, d.totalUnits * d.price)) dailyOk = false;
    prev = d.totalUnits;
  }
  ok(dailyOk, `${tag} daily rows: units change only on buy days, equity = units x price`);
  const last = res.dailyRows[res.dailyRows.length - 1];
  ok(close(res.finalEquity, last.equity) && close(res.totalDeposited, dep), `${tag} final equity and deposits match the ledger`);
  // MWR really is the rate that zeroes the NPV of the deposits against the final equity
  const m = M.computeMetrics(res);
  if(m.cagrMwr != null){
    const t0 = new Date(res.investRows[0].date);
    const npv = res.investRows.reduce((s, r) => s - r.amountInvested / Math.pow(1 + m.cagrMwr, (new Date(r.date) - t0) / (365.25 * 864e5)), 0)
      + res.finalEquity / Math.pow(1 + m.cagrMwr, (new Date(last.date) - t0) / (365.25 * 864e5));
    ok(Math.abs(npv) < 1e-3, `${tag} CAGR (MWR) zeroes the NPV of the real cash flows`, `npv=${npv}`);
  }
}

// Portfolio: rebuild the market gain from holdings and prices, independently.
function checkPortfolioBooks(tag, p, assets, dates, rfPx){
  const rows = P.simulatePortfolio(p, assets, dates, rfPx);
  const ledger = rows.every(r => r.units && Number.isFinite(r.fees) && Number.isFinite(r.interest));
  ok(ledger, `${tag} every row carries units, running fees and running interest`);
  if(!ledger) return rows;
  let gain = 0, rowOk = true, closeOk = true, signOk = true;
  for(let i = 0; i < rows.length; i++){
    const r = rows[i];
    const inv = assets.reduce((s, a) => s + r.units[a.id] * a.px[i], 0);
    if(!close(r.invested, inv, 1e-9) || !close(r.total, r.cash + inv, 1e-9)) rowOk = false;
    for(const a of assets) if(!close(r.assetVals[a.id], r.units[a.id] * a.px[i])) rowOk = false;
    if(i > 0){ const q = rows[i - 1]; for(const a of assets) gain += q.units[a.id] * (a.px[i] - a.px[i - 1]); }
    if(!close(r.total, r.cumTopup + r.interest - r.fees + gain, 1e-7)) closeOk = false;
    if(r.cash < -1e-9 || r.fees < -1e-12 || assets.some(a => r.units[a.id] < -1e-12)) signOk = false;
  }
  ok(rowOk, `${tag} every row: value = cash + units x price`);
  ok(closeOk, `${tag} every row closes: value = top-ups + interest - fees + market gain`);
  ok(signOk, `${tag} no negative cash, units or fees`);
  return rows;
}
function pf(method, extra = {}){
  return Object.assign({ topup: { amount: 1000, yearlyIncrease: 5 },
    topupSched: { period: 'monthly', weekdays: [1], weekParity: 0, daysOfMonth: [1], dayOfMonth: 1, quarterStart: 1, month: 1 },
    rf: { mode: 'rate', rate: 3, ticker: '' },
    rebal: { method, cwTiming: 'at-topup', buyFee: 0.25, sellFee: 0.4, reserveMode: 'cash', reserveAssetId: null, lookbackMonths: 6, rankWeights: [60, 40] },
    rebalSched: { period: 'quarterly', weekdays: [1], weekParity: 0, daysOfMonth: [1], dayOfMonth: 1, quarterStart: 1, month: 1 } }, extra);
}
const axis = EQ.dates;
const mkAssets = (w1, w2, t1, t2) => [
  { id: 1, weight: w1, px: EQ.prices.slice(), trigger: t1 },
  { id: 2, weight: w2, px: BD.prices.slice(), trigger: t2 }];
const dip = { type: 'pct', direction: 'drop', pct: 5, ref: 'period', period: 'monthly', eom: false };
for(const [tag, p, assets] of [
  ['constant-allocation', pf('constant-allocation'), mkAssets(60, 40)],
  ['towards-weight', pf('towards-weight'), mkAssets(60, 40)],
  ['constant-weight at top-up', pf('constant-weight'), mkAssets(60, 40)],
  ['constant-weight on schedule', pf('constant-weight', { rebal: Object.assign(pf('x').rebal, { method: 'constant-weight', cwTiming: 'schedule' }) }), mkAssets(60, 40)],
  ['dynamic-momentum', pf('dynamic-momentum'), mkAssets(50, 50)],
  ['rule-trigger cash reserve', pf('rule-trigger'), mkAssets(70, 30, dip, { type: 'tech-rsi', period: 'weekly', eom: false, tech: TECH })],
  ['rule-trigger asset reserve', pf('rule-trigger', { rebal: Object.assign(pf('x').rebal, { method: 'rule-trigger', reserveMode: 'asset', reserveAssetId: 2 }) }), mkAssets(80, 20, dip, dip)],
  ['rule-trigger rolling top', pf('rule-trigger'), mkAssets(100, 0, { type: 'pct', direction: 'drop', pct: 6, ref: 'top', lookback: 40 }, dip)],
  ['weights within tolerance (99.6%)', pf('rule-trigger'), mkAssets(59.8, 39.8, dip, dip)],
]){
  checkPortfolioBooks(`[pf ${tag}]`, p, assets, axis, null);
}
{ // rf ticker instead of a fixed rate: interest follows the ticker, books still close
  const rfPx = gbm(M, 'Cash', 2, 1).prices;
  checkPortfolioBooks('[pf rf ticker]', pf('rule-trigger', { rf: { mode: 'ticker', rate: 0, ticker: 'X' } }), mkAssets(70, 30, dip, dip), axis, rfPx);
}
{ // closed forms: fees = f x every dollar bought; idle cash compounds at the rate
  const rows = P.simulatePortfolio(pf('constant-allocation'), mkAssets(60, 40), axis, null);
  const last = rows[rows.length - 1];
  ok(Number.isFinite(last.fees) && close(last.fees, last.cumTopup * 0.0025), '[pf closed form] constant allocation pays exactly buy fee x top-ups', `${last.fees} vs ${last.cumTopup * 0.0025}`);
  ok(last.interest === 0, '[pf closed form] fully invested at every top-up: no idle cash, no interest');
  const never = { type: 'pct', direction: 'drop', pct: 99, ref: 'period', period: 'monthly', eom: false };
  const r2 = P.simulatePortfolio(pf('rule-trigger'), mkAssets(50, 50, never, never), axis, null);
  const f = Math.pow(1.03, 1 / 252); let cash = 0; const tops = P.getScheduleIndices(axis, pf('x').topupSched);
  r2.forEach((r, i) => { if(i) cash *= f; if(tops.has(i)) cash += r.cumTopup - (i ? r2[i - 1].cumTopup : 0); });
  const l2 = r2[r2.length - 1];
  ok(close(l2.cash, cash) && close(l2.interest, l2.total - l2.cumTopup), '[pf closed form] a trigger that never fires leaves every top-up compounding at the cash rate');
}
{ // weights the run accepts within its 0.5% tolerance deploy fully on a trigger
  const at = { type: 'at-topup' };
  const rows = P.simulatePortfolio(pf('rule-trigger', { rf: { mode: 'rate', rate: 0 } }), mkAssets(59.8, 39.8, at, at), axis, null);
  ok(rows.every(r => r.cash < 1e-6), '[pf] rule-trigger with weights summing to 99.6% leaves no stray cash (targets normalised)');
}

/* ═══ B. TRIGGER CAUSALITY ══════════════════════════════════════════════════ */
console.log('B. trigger causality (future replaced after each cut)');
const CUTS = [300, 777, 1500, 2600];
for(const style of ALL_STYLES) for(const period of ['monthly', 'weekly']){
  if((style === 'monthly-date' || style === 'weekly-day' || FORWARD.has(style)) && period === 'weekly') continue;
  let causal = true, where = '';
  for(const cut of CUTS){
    const alt = { dates: EQ.dates, prices: perturbAfter(EQ.prices, cut, cut * 7 + 1) };
    const a = M.simulateSecurity(secOf(style, EQ, { period }));
    const b = M.simulateSecurity(secOf(style, alt, { period }));
    const pre = rows => rows.filter(r => r.date <= EQ.dates[cut]).map(r => r.date + ':' + r.totalUnits.toFixed(12)).join('|');
    if(pre(a.investRows) !== pre(b.investRows) || pre(a.dailyRows) !== pre(b.dailyRows)){ causal = false; where = 'cut ' + EQ.dates[cut]; }
  }
  if(FORWARD.has(style)) ok(!causal, `[main ${style}] Forward style is flagged as needing the future, and does`);
  else ok(causal, `[main ${style} ${period}] no buy or ledger row up to a day depends on a later price`, where);
}
const PF_CASES = [
  ['constant-allocation', pf('constant-allocation'), () => mkAssets(60, 40)],
  ['towards-weight', pf('towards-weight'), () => mkAssets(60, 40)],
  ['constant-weight at top-up', pf('constant-weight'), () => mkAssets(60, 40)],
  ['constant-weight on schedule', pf('constant-weight', { rebal: Object.assign(pf('x').rebal, { method: 'constant-weight', cwTiming: 'schedule' }) }), () => mkAssets(60, 40)],
  ['dynamic-momentum', pf('dynamic-momentum'), () => mkAssets(50, 50)],
  ['rule pct period drop', pf('rule-trigger'), () => mkAssets(70, 30, dip, { type: 'pct', direction: 'rise', pct: 2, ref: 'period', period: 'weekly', eom: true })],
  ['rule pct rolling top/bottom', pf('rule-trigger'), () => mkAssets(70, 30, { type: 'pct', direction: 'drop', pct: 5, ref: 'top', lookback: 30 }, { type: 'pct', direction: 'rise', pct: 3, ref: 'bottom', lookback: 30 })],
  ...['tech-ma-cross', 'tech-rsi', 'tech-bollinger', 'tech-macd-cross', 'tech-macd-hist', 'tech-adx'].map(t =>
    ['rule ' + t, pf('rule-trigger'), () => mkAssets(70, 30, { type: t, period: 'monthly', eom: true, tech: TECH }, { type: 'at-topup' })]),
  ['rule asset reserve', pf('rule-trigger', { rebal: Object.assign(pf('x').rebal, { method: 'rule-trigger', reserveMode: 'asset', reserveAssetId: 2 }) }), () => mkAssets(80, 20, dip, dip)],
];
for(const [tag, p, mk] of PF_CASES){
  let causal = true, where = '';
  for(const cut of CUTS){
    const A = mk(), B = mk();
    B.forEach((a, k) => { a.px = perturbAfter(a.px, cut, cut * 13 + k); });
    const ra = P.simulatePortfolio(p, A, axis, null), rb = P.simulatePortfolio(p, B, axis, null);
    for(let i = 0; i <= cut; i++){
      const x = ra[i], y = rb[i];
      if(x.total !== y.total || x.cash !== y.cash || x.fees !== y.fees || x.event !== y.event || x.bought.join() !== y.bought.join()){ causal = false; where = 'cut ' + axis[cut] + ', diverged ' + axis[i]; break; }
    }
  }
  ok(causal, `[pf ${tag}] no ledger row, event or buy up to a day depends on a later price`, where);
}

/* ═══ C. PARITY: main tool vs portfolio tool ════════════════════════════════ */
console.log('C. parity (same scenario in both tools)');
{ // same seeded asset, same path and candles on both pages
  const a = gbm(M, 'Twin', 7, 16, '2015-03-01', '2024-06-30'), b = gbm(P, 'Twin', 7, 16, '2015-03-01', '2024-06-30');
  ok(JSON.stringify(a) === JSON.stringify(b), '[parity] a custom asset generates the identical close and OHLC path in both tools');
}
{ // both tools reduce a set of calendars to the same shared axis
  const series = [EQ_US, BD_AU, EQ];
  const aligned = M.alignToCommonDates(series);
  let common = series[0].dates.slice(); for(const s of series.slice(1)){ const h = new Set(s.dates); common = common.filter(d => h.has(d)); }
  ok(aligned.every(s => s.dates.join() === common.join()), '[parity] main tool keeps only the days every scenario shares, like the portfolio axis');
  ok(aligned.every((s, k) => s.dates.every((d, i) => s.prices[i] === series[k].prices[series[k].dates.indexOf(d)])), '[parity] aligned prices are the source prices of those days');
  ok(aligned.every(s => s.dates.length === aligned[0].dates.length), '[display] every main-tool series has one value per axis date (charts index by position)');
}
function metricsSame(tag, mm, pm){
  const keys = ['sharpe', 'sortino', 'cagrTwr', 'cagrMwr'];
  const bad = keys.filter(k => !((mm[k] == null && pm[k] == null) || close(mm[k], pm[k], 1e-9)));
  ok(!bad.length, `${tag} Sharpe, Sortino, CAGR (TWR) and CAGR (MWR) agree`, bad.map(k => `${k}: ${mm[k]} vs ${pm[k]}`).join('; '));
}
function compareRuns(tag, mainRes, rows, mainRf){
  const byDate = new Map(rows.map(r => [r.date, r]));
  let daily = true, first = '';
  for(const d of mainRes.dailyRows){
    const r = byDate.get(d.date);
    if(!r || !close(d.equity, r.total, 1e-9) || !close(d.totalDeposited, r.cumTopup, 1e-12)){ daily = false; first = d.date + ` ${d.equity} vs ${r && r.total}`; break; }
  }
  ok(daily && rows.length === mainRes.dailyRows.length, `${tag} daily value and deposits identical on every day`, first);
  const pBuys = rows.filter(r => r.bought.length).map(r => r.date).join();
  ok(pBuys === mainRes.investRows.map(r => r.date).join(), `${tag} identical buy dates`);
  const last = rows[rows.length - 1];
  ok(close(mainRes.finalEquity, last.total, 1e-12), `${tag} identical final value`, `${mainRes.finalEquity} vs ${last.total}`);
  metricsSame(tag, mainModule(mainRf).computeMetrics(mainRes), P.computeMetrics({ rows, rfPx: null, rfRate: mainRf }));
}
const one = (px, trigger) => [{ id: 1, weight: 100, px: px.slice(), trigger }];
const zeroFee = (method, sched, rate, extra = {}) => pf(method, Object.assign({
  topup: { amount: 500, yearlyIncrease: 6 }, topupSched: Object.assign({}, pf('x').topupSched, sched), rf: { mode: 'rate', rate, ticker: '' },
  rebal: Object.assign({}, pf('x').rebal, { method, buyFee: 0, sellFee: 0 }) }, extra));
for(const [label, pd] of [['weekday calendar', EQ], ['holiday calendar', EQ_US]]){
  // Date-based DCA = a 100% single-asset portfolio topped up on the same day.
  for(const method of ['constant-allocation', 'towards-weight', 'constant-weight']){
    const m1 = M.simulateSecurity(secOf('monthly-date', pd, { amount: 500, yearlyIncrease: 6, dayOrDate: 15 }));
    compareRuns(`[parity ${label}] monthly day 15 vs ${method}`, m1, P.simulatePortfolio(zeroFee(method, { period: 'monthly', daysOfMonth: [15] }, 4), one(pd.prices), pd.dates, null), 4);
  }
  const w1 = M.simulateSecurity(secOf('weekly-day', pd, { amount: 500, yearlyIncrease: 6, dayOrDate: 3 }));
  compareRuns(`[parity ${label}] weekly Wednesday vs constant-allocation`, w1, P.simulatePortfolio(zeroFee('constant-allocation', { period: 'weekly', weekdays: [3] }, 4), one(pd.prices), pd.dates, null), 4);
  // Triggered DCA with End-of-period on = a rule-trigger portfolio whose top-up
  // lands on the period's first day and waits (at 0%) for the trigger.
  for(const period of ['monthly', 'weekly']){
    const sched = period === 'monthly' ? { period: 'monthly', daysOfMonth: [1] } : { period: 'weekly', weekdays: [1] };
    for(const [style, trig] of [
      ['momentum-peak', { type: 'pct', direction: 'rise', pct: 4, ref: 'period' }],
      ['momentum-dip', { type: 'pct', direction: 'drop', pct: 4, ref: 'period' }],
      ...['tech-ma-cross', 'tech-rsi', 'tech-bollinger', 'tech-macd-cross', 'tech-macd-hist', 'tech-adx'].map(t => [t, { type: t, tech: TECH }])]){
      // The two tools book the money at different moments by design: the main tool
      // deposits it on the day it buys, the portfolio on the top-up day, where it
      // idles as cash until the trigger. So the deposit line and the money-weighted
      // figures differ during the wait, while every purchase must not: same days,
      // same units, same final value. (A yearly step-up is left at 0: an
      // anniversary between top-up and trigger prices the two differently.)
      const m = M.simulateSecurity(secOf(style, pd, { amount: 500, yearlyIncrease: 0, period, momentumPct: 4 }));
      const p0 = zeroFee('rule-trigger', sched, 0); p0.topup.yearlyIncrease = 0;
      const rows = P.simulatePortfolio(p0, one(pd.prices, Object.assign({ period, eom: true }, trig)), pd.dates, null);
      const tag = `[parity ${label}] ${style} ${period} vs rule-trigger`;
      ok(rows.filter(r => r.bought.length).map(r => r.date).join() === m.investRows.map(r => r.date).join(), `${tag} identical buy dates`);
      const unitsSame = m.dailyRows.every((d, i) => rows[i].units && close(d.totalUnits, rows[i].units[1], 1e-12));
      ok(unitsSame && close(m.finalEquity, rows[rows.length - 1].total, 1e-12), `${tag} identical units every day and identical final value`,
        `${m.finalEquity} vs ${rows[rows.length - 1].total}`);
      ok(rows.every((r, i) => r.cumTopup >= m.dailyRows[i].totalDeposited - 1e-9), `${tag} the portfolio has never booked less than the main tool has invested`);
    }
  }
}
{ // a price sitting exactly on the threshold fires in both tools or in neither
  const dates = ['2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05', '2024-02-01', '2024-02-02', '2024-02-05'];
  // Round prices landing exactly on the line, where p >= open x (1 + t) and
  // p / open - 1 >= t round differently (3.00 to 3.15 at 5%, 10 to 9.8 at 2%...).
  for(const [px, pct] of [[[3, 3.1, 3.15, 3.2, 7, 7.1, 7.14], 5], [[10, 9.9, 9.8, 9.7, 13, 12.6, 12.48], 2],
                          [[7, 7.1, 7.14, 7, 13, 12.9, 12.48], 2], [[13, 12.9, 12.48, 13, 3, 3.1, 3.15], 4]]){
    for(const dir of ['rise', 'drop']){
      const m = M.getInvestmentDates({ dates, prices: px }, dir === 'rise' ? 'momentum-peak' : 'momentum-dip', 1, pct, false, null, false, 'monthly');
      const sig = P.buildAssetTriggerSignals([{ id: 1, px, trigger: { type: 'pct', direction: dir, pct, ref: 'period', period: 'monthly', eom: false } }], dates, null)[0];
      const pIdx = sig.map((b, i) => b ? i : -1).filter(i => i >= 0);
      ok(m.join() === pIdx.join(), `[parity] exact-threshold ${dir} ${pct}% on [${px}] fires on the same days (${m.join() || 'none'})`, `main ${m} vs portfolio ${pIdx}`);
    }
  }
}

/* ═══ D. DISPLAY ════════════════════════════════════════════════════════════ */
console.log('D. display');
for(const [label, F] of [['main', M.fmt], ['portfolio', P.fmt]]){
  ok(F.pct(1.5) === '150.00%', `[${label}] fmt.pct(1.5) prints 150.00% (an ROI above 100%)`, F.pct(1.5));
  ok(F.pct(0.05) === '5.00%' && F.pct(-0.2) === '-20.00%' && F.pct(1) === '100.00%' && F.pct(0) === '0.00%', `[${label}] fmt.pct reads every input as a fraction`);
}

/* ═══ E. SHARED PRICE CACHE ═════════════════════════════════════════════════ */
console.log('E. shared price cache');
{
  const old = { dates: ['2024-06-03', '2024-06-04', '2024-06-05', '2024-06-06', '2024-06-07'], prices: [1000, 1010, 1020, 1030, 1035], opens: [990, 1000, 1010, 1020, 1030], highs: [1005, 1015, 1025, 1035, 1040], lows: [985, 995, 1005, 1015, 1025] };
  const fresh = { dates: ['2024-05-24', '2024-06-05', '2024-06-06', '2024-06-07', '2024-06-10'], prices: [99, 102, 103, 104, 121], opens: [98, 101, 102, 103, 120], highs: [100, 103, 104, 105, 122], lows: [97, 100, 101, 102, 119] };
  const m = SharedYF.mergeSeries(old, fresh);
  const rets = m.prices.slice(1).map((p, i) => p / m.prices[i] - 1);
  ok(Math.min(...rets) > -0.2, '[cache] a 10:1 split between two fetches does not stitch into a 90% crash', rets.map(r => r.toFixed(3)).join(' '));
  ok(close(m.prices[1], 100) && close(m.opens[1], 99) && m.prices[m.prices.length - 1] === 121, '[cache] older history is rebased onto the fresh fetch, OHLC with it; fresh values win');
  const same = SharedYF.mergeSeries({ dates: ['a', 'b'], prices: [1, 2] }, { dates: ['b', 'c'], prices: [2, 3] });
  ok(same.prices.join() === '1,2,3', '[cache] series already on one basis merge unchanged');
  ok(SharedYF.tailStart({ coverageEnd: '2024-06-08', dates: ['2024-06-07'] }) < '2024-06-07', '[cache] a tail refresh starts before the last cached bar, so the two overlap');
}
{ // the Worker dates bars by the exchange day, not the UTC day
  const src = fs.readFileSync(path.join(__dirname, '..', 'yf-proxy-worker.js'), 'utf8');
  const parseYahoo = new Function(src.match(/const DATE_BASIS[\s\S]*?\n}\n/)[0] + 'return parseYahoo;')();
  // DHHF.AX, first sessions of 2024 (AEDT, UTC+11): stamped 23:00 UTC the day before
  const ts = [1704150000, 1704236400, 1704668400];
  const body = JSON.stringify({ chart: { result: [{ meta: { gmtoffset: 36000 }, timestamp: ts,
    indicators: { quote: [{ open: [1, 1, 1], high: [1, 1, 1], low: [1, 1, 1], close: [1, 1, 1] }], adjclose: [{ adjclose: [1, 1, 1] }] } }] } });
  ok(parseYahoo(body).dates.join() === '2024-01-02,2024-01-03,2024-01-08', '[worker] ASX bars in daylight saving keep their own trading day (Tue 2 Jan, not Mon 1 Jan)', parseYahoo(body).dates.join());
}

/* ═══ F. THE REAL PAGES (optional) ══════════════════════════════════════════ */
async function uiChecks(){
  console.log('F. real pages, headless');
  // Global install, as _ref/chart-check.mjs uses.
  let pw; try { pw = require('playwright'); } catch(_){ pw = require('/opt/node22/lib/node_modules/playwright'); }
  const { chromium } = pw;
  const http = require('http');
  const root = path.join(__dirname, '..', '..');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
  const server = http.createServer((q, r) => {
    let f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
    if(fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if(!fs.existsSync(f)){ r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  }).listen(0);
  const port = server.address().port;
  // The chart libraries come from _ref/.libcache (shared with chart-check.mjs),
  // fetched once if missing; every other outside request is refused.
  const libDir = path.join(root, '_ref', '.libcache');
  fs.mkdirSync(libDir, { recursive: true });
  const LIBS = ['Chart.js/4.4.1/chart.umd.min.js', 'hammer.js/2.0.8/hammer.min.js', 'chartjs-plugin-zoom/2.0.1/chartjs-plugin-zoom.min.js'];
  for(const lib of LIBS){
    const f = path.join(libDir, path.basename(lib));
    if(!fs.existsSync(f)) fs.writeFileSync(f, require('child_process').execFileSync('curl', ['-sSfL', 'https://cdnjs.cloudflare.com/ajax/libs/' + lib]));
  }
  const browser = await chromium.launch();
  const page = async (url) => {
    const pg = await browser.newPage();
    // A first visit opens the guided tour over the page; mark it seen.
    await pg.addInitScript(() => { try { localStorage.setItem('dca-tour-v1-seen', '1'); localStorage.setItem('dcapf-tour-v1-seen', '1'); } catch(_){} });
    await pg.route(u => !u.href.startsWith(`http://127.0.0.1:${port}`), route => {
      const lib = LIBS.find(l => route.request().url().endsWith(l));
      return lib ? route.fulfill({ path: path.join(libDir, path.basename(lib)), contentType: 'text/javascript' }) : route.abort();
    });
    await pg.goto(`http://127.0.0.1:${port}${url}`, { waitUntil: 'load' });
    return pg;
  };
  // Open a scenario the way a person does: the folder button in the Quick Start
  // row, then a file. Both scripts live in an IIFE, so the screen is the only
  // interface there is, and it is also what this check is about.
  const open = async (pg, obj) => {
    const [chooser] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('.scenario-load')]);
    await chooser.setFiles({ name: 's.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(obj)) });
    await pg.waitForFunction(() => document.querySelector('#summaryGrid .tile .value'));
    // The checkbox is a styled switch; its label is what a person clicks.
    await pg.click('label:has(#showAdvancedToggle)');
    await pg.waitForFunction(() => document.getElementById('showAdvancedToggle').checked);
    return pg.evaluate(() => {
      const tile = document.querySelector('#summaryGrid .tile');
      const t = sel => [...document.querySelectorAll(sel)];
      const lastRow = t('#detailBody tr, #compBody tr').pop();
      return { value: tile.querySelector('.value').textContent.trim(), text: tile.textContent.replace(/\s+/g, ' '),
        adv: t('#summaryGrid .adv-metrics b').map(b => b.textContent.trim()),
        last: [...lastRow.cells].map(c => c.textContent.trim()), head: t('#detailHead th, #compHead th').map(th => th.textContent.trim()),
        range: (document.getElementById('dateRangeStatus') || {}).textContent || '' };
    });
  };
  const sim = { name: 'Twin', returnPct: 7, stdPct: 16 };
  const glob = { currencySymbol: '$', randomSeed: SEED, startDate: '2014-01-01', endDate: '2024-06-30', simPool: [sim] };
  const mainPg = await page('/dcasimulator/');
  const m = await open(mainPg, { app: 'dca-single', version: 1, global: Object.assign({ riskFreeRate: 4 }, glob),
    securities: [{ type: 'custom', name: 'Twin', returnPct: 7, stdPct: 16, amount: 500, yearlyIncrease: 6, style: 'monthly-date', dayOrDate: 15 }] });
  const pfPg = await page('/dcasimulator/portfolio/');
  const p = await open(pfPg, { app: 'dca-portfolio', version: 1, global: glob, activePortfolioId: 1, portfolios: [{
    id: 1, name: 'Twin 100%', colorHex: '#3b82f6', assetIdCounter: 1, topup: { amount: 500, yearlyIncrease: 6 },
    topupSched: { period: 'monthly', weekdays: [1], weekParity: 0, daysOfMonth: [15], dayOfMonth: 15, quarterStart: 1, month: 1 },
    rf: { mode: 'rate', rate: 4, ticker: '' },
    rebal: { method: 'constant-allocation', cwTiming: 'at-topup', buyFee: 0, sellFee: 0, reserveMode: 'cash', reserveAssetId: null, lookbackMonths: 6, rankWeights: [] },
    assets: [{ id: 1, type: 'custom', name: 'Twin', returnPct: 7, stdPct: 16, weight: 100 }] }] });
  // The same scenario, independently: the page's own generator, both engines.
  const px = gbm(M, 'Twin', 7, 16, '2014-01-01', '2024-06-30');
  const ref = M.simulateSecurity(secOf('monthly-date', px, { amount: 500, yearlyIncrease: 6, dayOrDate: 15 }));
  const money = v => '$' + Math.round(v).toLocaleString('en-US');
  const roi = ((ref.finalEquity - ref.totalDeposited) / ref.totalDeposited * 100).toFixed(2) + '%';
  ok(m.value === p.value && m.value === money(ref.finalEquity), `[ui] both pages show the same final value (${m.value} / ${p.value}, engine ${money(ref.finalEquity)})`);
  ok(m.text.includes('ROI: ' + roi) && p.text.includes('ROI ' + roi), `[ui] both pages print the ROI (final - deposited) / deposited = ${roi}`, m.text + ' | ' + p.text);
  ok(m.text.includes('Topped up: ' + money(ref.totalDeposited)) && p.text.includes('Topped up ' + money(ref.totalDeposited)), '[ui] both pages print the same total topped up');
  ok(m.adv.length === 4 && m.adv.join() === p.adv.join(), `[ui] the four advanced metrics read the same (${m.adv.join(' ')} / ${p.adv.join(' ')})`);
  ok(m.last.includes(m.value) && p.last[p.last.length - 1] === p.value, '[ui] each breakdown table ends on the final value its summary tile shows', m.last.join('|') + ' / ' + p.last.join('|'));
  const col = name => m.head.indexOf(name);
  ok(m.last[col('Total Deposited')] === money(ref.totalDeposited) && m.last[col('Invested')] === '—',
    '[ui] main table: the final row shows the running total under Total Deposited, and no per-buy amount', m.head.join('|') + ' / ' + m.last.join('|'));
  const pc = name => p.head.indexOf(name);
  ok(pc('Interest') > 0 && pc('Fees') > 0 && p.last[pc('Fees')] === '$0' && p.last[pc('Deposited')] === money(ref.totalDeposited),
    '[ui] portfolio table carries Interest and Fees, and they are nil for a fee-free fully invested plan', p.head.join('|') + ' / ' + p.last.join('|'));
  ok(m.range.includes(px.dates[0]) && m.range.includes(px.dates[px.dates.length - 1]), '[ui] main tool reports the shared axis it ran on', m.range);
  await browser.close(); server.close();
}

(async () => {
  if(process.argv.includes('--ui')){
    try { await uiChecks(); }
    catch(e){ failed++; console.log('  FAIL  [ui] could not drive the pages: ' + e.message); }
  }
  console.log(`\ndcasimulator integrity: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
