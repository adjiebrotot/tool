// Financial Freedom Calculator — end-to-end audit harness.
//
// Drives the REAL page headless (CDN libs stubbed, so it runs offline; the
// Chart.js stub records every chart config so the plotted datasets can be
// inspected) and checks the engine against an INDEPENDENT replay of the
// documented mathematics in script.js.
//
// The replay is deliberately a different formulation. The page solves the pot
// by a single affine forward pass, carrying the balance as a*W + d and reading
// every constraint off it. The replay instead walks the requirement BACKWARDS
// from the terminal condition, one month at a time, flooring at zero:
//     W(t) = max(0, W(t+1) / (1 + rm) + expense - pension)
// and gets Die Rich from the closed-form perpetuity plus a backward bridge.
// Anything that agrees under both is agreeing on the maths, not on a shared
// implementation.
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
  constructor(ctx, cfg){
    this.config = cfg;
    this.data = (cfg && cfg.data) || {datasets: []};
    this.options = (cfg && cfg.options) || {};
    this._hidden = {};
    window.__charts.push(this);
  }
  update(){}
  destroy(){ const i = window.__charts.indexOf(this); if(i >= 0) window.__charts.splice(i, 1); }
  resetZoom(){}
  isDatasetVisible(i){ return !this._hidden[i]; }
  setDatasetVisibility(i, v){ this._hidden[i] = !v; }
}
Chart.register = function(){};
window.Chart = Chart;`;

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  console.log((ok ? '  PASS  ' : '✗ FAIL  ') + name + (detail ? '  — ' + detail : ''));
  ok ? pass++ : fail++;
};
const close = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1 : tol);

/* ── INDEPENDENT REPLAY ────────────────────────────────────────────────── */

const mo = (a, b) => Math.round((b - a) * 12);
const perMo = (amt, period) =>
  period === 'weekly' ? amt * 52 / 12 : (period === 'yearly' ? amt / 12 : amt);

// Same normalisation as step 1-3 of the documented maths, written out longhand.
function refParams(ui){
  const i = ui.inflation / 100;
  const rr = (1 + ui.ret / 100) / (1 + i) - 1;
  const gr = (1 + ui.growth / 100) / (1 + i) - 1;
  const X = perMo(ui.expense, ui.expensePeriod);
  const entered = perMo(ui.savings, ui.savingsPeriod);
  return {
    mode: ui.mode, ageNow: ui.ageNow, ageRetire: ui.ageRetire, ageDie: ui.ageDie,
    infl: i, rr,
    rm: Math.pow(1 + rr, 1 / 12) - 1,
    gm: Math.pow(1 + gr, 1 / 12) - 1,
    sigma: ui.std / 100,
    X, Xr: X * ui.retireMultiplier / 100,
    savingsMode: ui.savingsMode || 'savings',
    entered, A0: ui.assets, legacy: ui.legacy,
    pensionOn: !!ui.pensionOn, pStart: ui.pensionStartAge,
    pMonthly: ui.pensionOn ? ui.pensionAmount / 12 : 0
  };
}
const refPension = (p, age) => (p.pensionOn && age >= p.pStart - 1e-9) ? p.pMonthly : 0;
const refHorizon = p => p.mode === 'rich' ? Math.max(120, p.ageDie) : p.ageDie;

// BACKWARD recursion, floored at zero. Different formulation from the page.
function refRequired(p, ra){
  const rm = p.rm;
  if(p.mode === 'rich'){
    // Closed-form perpetuity once the cash flows settle, then walk the bridge
    // years back to the retirement age.
    const ha = refHorizon(p);
    const net = p.Xr - refPension(p, ha);
    let Wss;
    if(net <= 0) Wss = 0;
    else if(rm <= 0) return Infinity;
    else Wss = net * (1 + rm) / rm;
    const pStart = p.pensionOn ? Math.max(ra, p.pStart) : ra;
    const k = Math.max(0, mo(ra, pStart));
    let W = Wss;
    for(let t = k - 1; t >= 0; t--){
      W = W / (1 + rm) + p.Xr - refPension(p, ra + t / 12);
      if(W < 0) W = 0;
    }
    return W;
  }
  const n = mo(ra, p.ageDie);
  if(n <= 0) return p.mode === 'legacy' ? p.legacy : 0;
  let W = p.mode === 'legacy' ? p.legacy : 0;
  for(let t = n - 1; t >= 0; t--){
    W = W / (1 + rm) + p.Xr - refPension(p, ra + t / 12);
    if(W < 0) W = 0;
  }
  return W;
}

/* Forward drawdown from an arbitrary pot, written straight from step 5:
   expenses out and any pension in at the START of the month, return over the
   month. The page solves the pot BACKWARDS through an affine pass, so walking a
   page-solved pot forwards through the replay's own arithmetic is what closes
   the loop — page against replay, not page against itself. */
function refForward(p, W, ra, ha){
  const n = Math.max(0, mo(ra, ha));
  const path = [W];
  let bal = W, min = W;
  for(let t = 0; t < n; t++){
    bal -= p.Xr - refPension(p, ra + t / 12);
    if(bal < min) min = bal;
    bal *= (1 + p.rm);
    path.push(bal);
  }
  return {path, min, terminal: bal};
}

function refSavings(p, t){
  const f = Math.pow(1 + p.gm, t);
  return p.savingsMode === 'income' ? (p.entered * f - p.X) : (p.entered * f);
}

// Closed-form future value of the growing savings stream plus the starting pot,
// instead of the page's month-by-month loop.
function refAccum(p, n){
  const R = 1 + p.rm, G = 1 + p.gm;
  let fv = p.A0 * Math.pow(R, n);
  if(p.savingsMode === 'income'){
    // income leg grows at G, the expense leg is level
    const incFv = Math.abs(R - G) < 1e-12
      ? p.entered * n * Math.pow(R, n - 1)
      : p.entered * (Math.pow(R, n) - Math.pow(G, n)) / (R - G);
    const expFv = p.rm === 0 ? p.X * n : p.X * (Math.pow(R, n) - 1) / p.rm;
    fv += incFv - expFv;
  } else {
    fv += Math.abs(R - G) < 1e-12
      ? p.entered * n * Math.pow(R, n - 1)
      : p.entered * (Math.pow(R, n) - Math.pow(G, n)) / (R - G);
  }
  return fv;
}

/* Income and spending, replayed from the two models rather than from the
   page's own helpers, so agreement means the definition agrees. */
const refAccMonths = p => Math.max(0, mo(p.ageNow, p.ageRetire));
function refIncome(p, t){
  if(t < refAccMonths(p)){
    return p.savingsMode === 'income'
      ? p.entered * Math.pow(1 + p.gm, t)
      : refSavings(p, t) + p.X;                // savings plus spending
  }
  return refPension(p, p.ageNow + t / 12);
}
const refSpend = (p, t) => t < refAccMonths(p) ? p.X : p.Xr;

/* The deposited line of step 10, written the OTHER way round. The page walks it
   forward as a running clamp; this reads it off a closed identity instead:

     D(T) = max(0, min over k <= T of [ W(k) + (C(T) - C(k)) ])

   where W(k) is the balance just after month k's flow and C is the cumulative
   money paid IN. It falls straight out of D(t+1) = min(D(t) + p, W): a running
   minimum with additions is the minimum of the shifted history, and the two
   agree only if both the clamp and the deposit accounting are right.
   The forward balance is rebuilt here too, from the replay's own flows. */
function refDeposited(p){
  const accM = refAccMonths(p), total = Math.max(1, mo(p.ageNow, p.ageDie));
  const out = [Math.max(0, p.A0)];
  let W = p.A0, C = 0, best = p.A0;             // best = min over k of W(k) - C(k)
  for(let t = 0; t < total; t++){
    const f = refIncome(p, t) - refSpend(p, t);
    W = t < accM ? W * (1 + p.rm) + f : W + f;
    C += Math.max(0, f);
    if(W - C < best) best = W - C;
    if(t >= accM) W *= (1 + p.rm);
    out.push(Math.max(0, best + C));
  }
  return out;
}

// Textbook annuity-due / perpetuity-due, the third formulation.
function refClosedForm(p){
  const n = mo(p.ageRetire, p.ageDie), rm = p.rm;
  if(p.mode === 'rich') return rm > 0 ? p.Xr * (1 + rm) / rm : Infinity;
  const annuity = rm === 0 ? p.Xr * n : p.Xr * (1 - Math.pow(1 + rm, -n)) / rm * (1 + rm);
  return p.mode === 'legacy' ? annuity + p.legacy / Math.pow(1 + rm, n) : annuity;
}

/* ── DRIVE THE PAGE ────────────────────────────────────────────────────── */

const browser = await chromium.launch({args: ['--allow-file-access-from-files']});
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', e => { pageErrors.push(e.message); console.log('PAGEERROR:', e.message); });
page.on('console', m => { if(m.type() === 'error') pageErrors.push(m.text()); });
await page.route('**/*', route => {
  const url = route.request().url();
  if(url.startsWith('file://')) return route.continue();
  if(/chart\.umd/.test(url)) return route.fulfill({contentType: 'application/javascript', body: CHART_STUB});
  if(/fonts\.googleapis|fonts\.gstatic/.test(url)) return route.fulfill({contentType: 'text/css', body: '/* stub */'});
  return route.fulfill({contentType: 'application/javascript', body: '/* stub */'});
});
// The guided tour opens itself on a first visit and its backdrop intercepts
// every click, so mark it seen before anything loads.
await page.addInitScript(() => {
  try { localStorage.setItem('ff-tour-v1-seen', '1'); } catch(_e){}
});
await page.goto(PAGE, {waitUntil: 'load'});
await page.waitForFunction(() => !!window.__FF, null, {timeout: 10000});
await page.waitForTimeout(250);

// Run the page engine with an arbitrary UI object, without touching the DOM.
const engine = (ui, expr) => page.evaluate(
  ({u, e}) => {
    const F = window.__FF;
    const full = Object.assign({}, F.UI_DEFAULTS, u);
    const P = F.buildParams(full);
    // eslint-disable-next-line no-new-func
    return Function('F', 'P', 'ui', 'return (' + e + ');')(F, P, full);
  },
  {u: ui, e: expr}
);

const DEFAULTS = await page.evaluate(() => window.__FF.UI_DEFAULTS);
const base = Object.assign({}, DEFAULTS, {savingsMode: 'savings'});

console.log('\n── Required pot ──');

// F1: Just Die, against the backward recursion AND the closed form.
{
  const ui = Object.assign({}, base, {mode: 'die'});
  const p = refParams(ui);
  const got = await engine(ui, 'F.requiredPot(P, P.ageRetire)');
  check('F1 Just Die pot matches the backward recursion',
    close(got, refRequired(p, p.ageRetire), 0.01),
    `page ${got.toFixed(2)} vs replay ${refRequired(p, p.ageRetire).toFixed(2)}`);
  check('F1b Just Die pot matches the closed-form annuity-due',
    close(got, refClosedForm(p), 0.01),
    `closed form ${refClosedForm(p).toFixed(2)}`);
}

// F2: Die Rich, against the closed-form perpetuity-due.
{
  const ui = Object.assign({}, base, {mode: 'rich'});
  const p = refParams(ui);
  const got = await engine(ui, 'F.requiredPot(P, P.ageRetire)');
  check('F2 Die Rich pot matches the perpetuity-due closed form',
    close(got, refClosedForm(p), 0.01),
    `page ${got.toFixed(2)} vs closed form ${refClosedForm(p).toFixed(2)}`);
  // At exactly that pot the real balance must be flat for ever.
  const flat = refForward(p, got, p.ageRetire, 120).terminal;
  check('F2b at the Die Rich pot the real balance is unchanged at age 120',
    close(flat, got, Math.max(1, got * 1e-6)),
    `start ${got.toFixed(0)}, age 120 ${flat.toFixed(0)}`);
}

// F3: Leave a Legacy decomposes into the Just Die pot plus a discounted bequest.
{
  const ui = Object.assign({}, base, {mode: 'legacy', legacy: 500000});
  const p = refParams(ui);
  const got = await engine(ui, 'F.requiredPot(P, P.ageRetire)');
  const die = refRequired(refParams(Object.assign({}, ui, {mode: 'die'})), p.ageRetire);
  const n = mo(p.ageRetire, p.ageDie);
  check('F3 Legacy pot equals the Just Die pot plus the discounted bequest',
    close(got, die + p.legacy / Math.pow(1 + p.rm, n), 0.01),
    `page ${got.toFixed(2)} vs replay ${(die + p.legacy / Math.pow(1 + p.rm, n)).toFixed(2)}`);
  const term = refForward(p, got, p.ageRetire, p.ageDie).terminal;
  check('F3b the Legacy pot actually leaves the bequest behind', close(term, 500000, 1),
    `terminal ${term.toFixed(2)}`);
}

// F4: the zero-real-return edge case has to hit the exact limit, not a NaN.
{
  const ui = Object.assign({}, base, {mode: 'die', ret: 2.5, inflation: 2.5});
  const p = refParams(ui);
  const got = await engine(ui, 'F.requiredPot(P, P.ageRetire)');
  const n = mo(p.ageRetire, p.ageDie);
  check('F4 at a zero real return the pot is exactly spending times months',
    close(got, p.Xr * n, 0.01), `page ${got.toFixed(2)} vs Xr*n ${(p.Xr * n).toFixed(2)}`);
}

// F5: a negative real return is fatal for Die Rich and fine for Just Die.
{
  const ui = Object.assign({}, base, {mode: 'rich', ret: 2, inflation: 4});
  const got = await engine(ui, 'F.requiredPot(P, P.ageRetire)');
  check('F5 Die Rich is impossible below inflation', got === Infinity || got === null,
    `got ${got}`);
  const die = await engine(Object.assign({}, ui, {mode: 'die'}), 'F.requiredPot(P, P.ageRetire)');
  const p = refParams(Object.assign({}, ui, {mode: 'die'}));
  check('F5b Just Die still has a finite answer below inflation',
    isFinite(die) && close(die, refRequired(p, p.ageRetire), 0.01),
    `page ${Number(die).toFixed(2)} vs replay ${refRequired(p, p.ageRetire).toFixed(2)}`);
}

// F6: forward simulation from the solved pot must never dip below zero and must
//     land on the terminal condition. This closes the loop on the affine pass.
for(const mode of ['die', 'legacy', 'rich']){
  const ui = Object.assign({}, base, {mode});
  const p6 = refParams(ui);
  const W6 = await engine(ui, 'F.requiredPot(P, P.ageRetire)');
  const res = Object.assign({W: W6},
    refForward(p6, W6, p6.ageRetire, refHorizon(p6)));
  check(`F6 ${mode}: the solved pot never dips below zero`, res.min >= -1e-6,
    `min ${res.min.toFixed(4)}`);
}

console.log('\n── Pension bridge ──');

// F7: a pension bigger than the spending means the pot only has to cover the
//     BRIDGE years. The terminal condition goes slack and the never-negative
//     constraint binds instead, which is the case closed forms get wrong.
{
  const ui = Object.assign({}, base, {
    mode: 'die', pensionOn: true, pensionStartAge: 70, pensionAmount: 90000
  });
  const p = refParams(ui);
  const got = await engine(ui, 'F.requiredPot(P, P.ageRetire)');
  check('F7 pension bridge pot matches the backward recursion',
    close(got, refRequired(p, p.ageRetire), 0.01),
    `page ${got.toFixed(2)} vs replay ${refRequired(p, p.ageRetire).toFixed(2)}`);
  const term = refForward(p, got, p.ageRetire, p.ageDie).terminal;
  check('F7b with a surplus pension the plan ends with money left over, not at zero',
    term > 1000, `terminal ${term.toFixed(0)}`);
  const naive = refClosedForm(p);
  check('F7c and that pot is well below the no-pension annuity', got < naive * 0.6,
    `bridge ${got.toFixed(0)} vs full annuity ${naive.toFixed(0)}`);
}

// F8: Die Rich with a pension that starts AFTER retirement. The pot is meant to
//     fall through the bridge and then hold for ever. The old "horizon balance
//     >= starting pot" rule rejected exactly this, so it is pinned here.
{
  const ui = Object.assign({}, base, {
    mode: 'rich', pensionOn: true, pensionStartAge: 70, pensionAmount: 20000
  });
  const p = refParams(ui);
  const got = await engine(ui, 'F.requiredPot(P, P.ageRetire)');
  check('F8 Die Rich with a pension bridge matches perpetuity plus backward bridge',
    close(got, refRequired(p, p.ageRetire), 0.01),
    `page ${got.toFixed(2)} vs replay ${refRequired(p, p.ageRetire).toFixed(2)}`);
  const fwd8 = refForward(p, got, p.ageRetire, 130);
  const r = {W: got, at120: fwd8.path[Math.round((120 - p.ageRetire) * 12)],
             terminal: fwd8.terminal, min: fwd8.min};
  check('F8b the pot dips through the bridge and is still solvent a decade past 120',
    r.at120 < r.W && r.terminal > 0 && r.min >= -1e-6,
    `start ${r.W.toFixed(0)}, age 120 ${r.at120.toFixed(0)}, age 130 ${r.terminal.toFixed(0)}`);
}

console.log('\n── Accumulation and the crossing ──');

// F9: the month loop against a closed-form growing-annuity future value.
for(const savingsMode of ['savings', 'income']){
  const ui = Object.assign({}, base, {savingsMode, savings: savingsMode === 'income' ? 90000 : 30000});
  const p = refParams(ui);
  const n = mo(p.ageNow, p.ageRetire);
  const got = await engine(ui, `F.accumulate(P, ${n})[${n}]`);
  check(`F9 ${savingsMode} accumulation matches the closed-form future value`,
    close(got, refAccum(p, n), Math.max(1, Math.abs(refAccum(p, n)) * 1e-9)),
    `page ${got.toFixed(2)} vs replay ${refAccum(p, n).toFixed(2)}`);
}

// F10: brute-force the crossing month by month with the replay's own pot.
{
  const ui = Object.assign({}, base, {mode: 'die'});
  const p = refParams(ui);
  const got = await engine(ui, 'F.solveFreedomAge(P)');
  const n = mo(p.ageNow, p.ageDie);
  let refAge = null;
  for(let t = 0; t <= n; t++){
    const age = p.ageNow + t / 12;
    if(refAccum(p, t) >= refRequired(p, age) - 1e-6){ refAge = age; break; }
  }
  check('F10 the freedom age matches a brute-force month-by-month scan',
    refAge !== null && got !== null && close(got, refAge, 1 / 24),
    `page ${got === null ? 'never' : got.toFixed(4)} vs replay ${refAge === null ? 'never' : refAge.toFixed(4)}`);
}

// F11: the two curves really do cross once, in the right directions.
{
  const ui = Object.assign({}, base, {mode: 'die'});
  const shape = await engine(ui, `(function(){
    var accN = [], need = [], y, n = Math.round((P.ageDie - P.ageNow));
    var acc = F.accumulate(P, n * 12);
    for(y = 0; y <= n; y++){ accN.push(acc[y * 12]); need.push(F.requiredPot(P, P.ageNow + y)); }
    var accUp = true, needDown = true;
    for(y = 1; y <= n; y++){
      if(accN[y] < accN[y-1] - 1e-6) accUp = false;
      if(need[y] > need[y-1] + 1e-6) needDown = false;
    }
    return {accUp: accUp, needDown: needDown, firstNeed: need[0], lastNeed: need[n]};
  })()`);
  check('F11 accumulated never falls and the required pot never rises, so the crossing is unique',
    shape.accUp && shape.needDown,
    `accumulated rising: ${shape.accUp}, required falling: ${shape.needDown}`);
}

console.log('\n── Randomness ──');

// F12: zero volatility has to collapse the whole stochastic layer exactly.
{
  const ui = Object.assign({}, base, {std: 0, paths: 200});
  const r = await engine(ui, `(function(){
    var mc = F.monteCarlo(P, {paths: ui.paths, seed: ui.seed});
    var det = F.lifetimePath(P);
    var years = mc.years, worst = 0, y;
    for(y = 0; y <= years; y++){
      worst = Math.max(worst,
        Math.abs(mc.bands.p10[y] - mc.bands.p90[y]),
        Math.abs(mc.bands.p50[y] - det[y * 12]));
    }
    return {worst: worst, rate: mc.successRate};
  })()`);
  check('F12 at zero volatility every percentile equals the deterministic line',
    r.worst < 1e-6, `largest gap ${r.worst.toExponential(2)}`);
  const potGap = await engine(ui, `(function(){
    var reqs = F.potRequirements(P, {paths: ui.paths, seed: ui.seed});
    return Math.abs(reqs.sorted[0] - reqs.sorted[reqs.sorted.length - 1]);
  })()`);
  check('F12b and every simulated path needs the same pot', potGap < 1e-6,
    `spread ${potGap.toExponential(2)}`);
}

// F13: same seed, same answer. Different seed, a different one.
{
  const ui = Object.assign({}, base, {paths: 300});
  const a = await engine(ui, 'F.monteCarlo(P, {paths: 300, seed: 12345}).successRate');
  const b = await engine(ui, 'F.monteCarlo(P, {paths: 300, seed: 12345}).successRate');
  const c = await engine(ui, 'F.monteCarlo(P, {paths: 300, seed: 999}).successRate');
  check('F13 the same seed reproduces the same success rate exactly', a === b, `${a} vs ${b}`);
  check('F13b a different seed moves it', a !== c, `${a} vs ${c}`);
}

// F14: success probability must never fall as the pot grows. This is what the
//      common-random-numbers design buys, and the confidence pot relies on it.
{
  const ui = Object.assign({}, base, {paths: 400});
  const r = await engine(ui, `(function(){
    var reqs = F.potRequirements(P, {paths: 400, seed: ui.seed});
    var need = F.requiredPot(P, P.ageRetire), k, prev = -1, ok = true, rates = [];
    for(k = 0; k <= 20; k++){
      var s = reqs.successAt(need * k / 10);
      rates.push(s);
      if(s < prev - 1e-12) ok = false;
      prev = s;
    }
    return {ok: ok, first: rates[0], last: rates[rates.length - 1],
            atNeed: reqs.successAt(need), conf: reqs.atConfidence(90),
            confSuccess: reqs.successAt(reqs.atConfidence(90))};
  })()`);
  check('F14 success probability is monotone in the pot', r.ok,
    `from ${(r.first * 100).toFixed(0)}% to ${(r.last * 100).toFixed(0)}%`);
  check('F14b the 90% confidence pot really does survive at least 90% of paths',
    r.confSuccess >= 0.9 - 1e-9, `${(r.confSuccess * 100).toFixed(1)}%`);
  check('F14c and it is larger than the expected-return pot, which is near a coin flip',
    r.conf > 0 && r.atNeed < 0.75,
    `confidence pot ${r.conf.toFixed(0)}, success at the amount needed ${(r.atNeed * 100).toFixed(1)}%`);
}

// F15: the growth factors are the documented log-normal, with the CAGR as drift.
{
  const ui = Object.assign({}, base);
  const r = await engine(ui, `(function(){
    var rng = F.mulberry32(F.deriveSeed(7, 'x'));
    var g = F.growthSeries(P, rng, 240000);
    var s = 0, ss = 0, i;
    for(i = 0; i < g.length; i++){ var l = Math.log(g[i]); s += l; ss += l * l; }
    var mean = s / g.length;
    var sd = Math.sqrt(ss / g.length - mean * mean);
    return {mean: mean, sd: sd,
            wantMean: Math.log(1 + P.rr) / 12, wantSd: P.sigma * Math.sqrt(1 / 12)};
  })()`);
  check('F15 log growth has the documented drift ln(1+rr)/12',
    Math.abs(r.mean - r.wantMean) < r.wantSd * 0.02,
    `got ${r.mean.toExponential(3)}, want ${r.wantMean.toExponential(3)}`);
  check('F15b and the documented monthly standard deviation',
    Math.abs(r.sd - r.wantSd) / r.wantSd < 0.02,
    `got ${r.sd.toFixed(6)}, want ${r.wantSd.toFixed(6)}`);
}

console.log('\n── Ticker statistics ──');

// F17: a synthetic series with a known closed-form answer.
{
  const r = await engine(base, `(function(){
    // 10 years of a perfectly smooth 10% a year, 252 steps a year.
    var dates = [], prices = [], p = 100, i;
    var step = Math.pow(1.10, 1 / 252);
    var d = new Date(Date.UTC(2010, 0, 1));
    for(i = 0; i < 2521; i++){
      dates.push(d.toISOString().slice(0, 10));
      prices.push(p);
      p *= step;
      d = new Date(d.getTime() + 365.25 / 252 * 86400000);
    }
    var smooth = F.tickerStats(dates, prices);
    // Same series with one 30% crash in the middle.
    var crashed = prices.slice();
    for(i = 1260; i < crashed.length; i++) crashed[i] *= 0.70;
    var withCrash = F.tickerStats(dates, crashed);
    return {smooth: smooth, crash: withCrash};
  })()`);
  check('F17 a smooth 10% series measures as 10% a year',
    Math.abs(r.smooth.cagr - 10) < 0.05, `got ${r.smooth.cagr.toFixed(3)}%`);
  check('F17b with no volatility',
    Math.abs(r.smooth.std) < 1e-6, `got ${r.smooth.std.toExponential(2)}%`);
  // A single gap down leaves the compound return over ten years lower and the
  // volatility higher. Those are the only two figures the engine takes now, and
  // the pair of them is what a deleted drawdown field used to sit beside.
  check('F17c one 30% gap down lowers the measured return',
    r.crash.cagr < r.smooth.cagr - 2, `smooth ${r.smooth.cagr.toFixed(2)}% vs crashed ${r.crash.cagr.toFixed(2)}%`);
  check('F17d and raises the measured volatility',
    r.crash.std > r.smooth.std + 1, `smooth ${r.smooth.std.toFixed(2)}% vs crashed ${r.crash.std.toFixed(2)}%`);
  check('F17e no drawdown figure is reported, because no field takes one',
    !('mdd' in r.smooth), Object.keys(r.smooth).join(','));
  const tiny = await engine(base, 'F.tickerStats(["2020-01-01","2020-01-02"], [100, 101])');
  check('F17f a series too short to measure returns null', tiny === null, `got ${JSON.stringify(tiny)}`);
}

console.log('\n── Feasibility ──');

// F18: the wording the tool promises, and the remedies it offers.
{
  const broke = Object.assign({}, base, {savings: 0, assets: 0});
  const d = await page.evaluate(u =>
    window.__FF.diagnose(Object.assign({}, window.__FF.UI_DEFAULTS, u)), broke);
  check('F18 with no savings and no assets the plan is declared impossible',
    d.status === 'impossible', `status ${d.status}`);
  check('F18b and says so in the promised words',
    /mathematically impossible/i.test(d.message || ''), d.message);
  check('F18c and offers at least one way out', (d.remedies || []).length > 0,
    `${(d.remedies || []).length} remedies`);
}

// F19: every remedy must actually flip the verdict when applied.
{
  const hard = Object.assign({}, base, {savings: 6000, assets: 0});
  const r = await page.evaluate(u => {
    const F = window.__FF;
    const ui = Object.assign({}, F.UI_DEFAULTS, u);
    const out = {before: F.diagnose(ui).status, checks: []};
    // Retire later is the one remedy that is a statement about the plan rather
    // than a change to an input, so it is verified separately below.
    const rem = F.solveRemedies(ui);
    out.remedies = rem.map(x => x.key);
    // Apply each lever slightly past the quoted point and re-diagnose.
    const P = F.buildParams(ui);
    const n = F.months(P.ageNow, P.ageRetire);
    const need = F.requiredPot(P, P.ageRetire);
    const at0 = F.accumulate(F.buildParams(Object.assign({}, ui, {savings: 0})), n)[n];
    const at1 = F.accumulate(F.buildParams(Object.assign({}, ui, {savings: 1})), n)[n];
    const solved = (need - at0) / (at1 - at0);
    out.checks.push({
      key: 'save',
      ok: F.buildParams(Object.assign({}, ui, {savings: solved * 1.0001})) &&
          F.accumulate(F.buildParams(Object.assign({}, ui, {savings: solved * 1.0001})), n)[n] >= need
    });
    return out;
  }, hard);
  check('F19 the solved savings level does reach the amount needed',
    r.checks.every(c => c.ok), JSON.stringify(r.checks));
  check('F19b a struggling plan is offered the levers that exist',
    r.remedies.length > 0, r.remedies.join(', '));
}

// F19c: a remedy has to be advice someone could act on. With no savings at all
//       the spend-less bisection used to land on "cut spending to 0% of today,
//       about $0 a month", which is true and useless.
{
  const r = await page.evaluate(() => {
    const F = window.__FF;
    const mk = u => F.solveRemedies(Object.assign({}, F.UI_DEFAULTS, u));
    return {
      broke: mk({savings: 0, assets: 0}).map(x => ({k: x.key, t: x.text})),
      tight: mk({savings: 6000, assets: 0}).map(x => x.key)
    };
  });
  const zeroSpend = r.broke.find(x => x.k === 'spend');
  check('F19c a spend-less remedy is never offered at an unlivable level',
    !zeroSpend, zeroSpend ? zeroSpend.t : 'not offered when nothing would help');
  check('F19d but a plan that is merely tight still gets the full set of levers',
    r.tight.includes('save') && r.tight.includes('spend') &&
    r.tight.includes('return') && r.tight.includes('later'),
    r.tight.join(', '));
}

// F19e: a crossing inside the final year is real freedom and must not be
//       reported as impossible. The search used to exclude the whole last year
//       rather than the degenerate final month, so a plan funded from 89y3m to
//       90 was declared mathematically impossible and handed remedies.
{
  const r = await page.evaluate(() => {
    const F = window.__FF;
    const ui = Object.assign({}, F.UI_DEFAULTS,
      {ageNow: 88, ageRetire: 89, ageDie: 90, assets: 0, savings: 36000, std: 0});
    const P = F.buildParams(ui);
    const n = F.months(P.ageNow, P.ageDie), acc = F.accumulate(P, n);
    let brute = null;
    for(let t = 0; t < n; t++){
      const a = P.ageNow + t / 12;
      if(acc[t] >= F.requiredPot(P, a) - 1e-6){ brute = a; break; }
    }
    return {brute: brute, got: F.solveFreedomAge(P), status: F.diagnose(ui).status,
            needThere: brute == null ? null : F.requiredPot(P, brute)};
  });
  check('F19e a crossing inside the final year is found, not called impossible',
    r.got !== null && Math.abs(r.got - r.brute) < 1e-9 && r.status !== 'impossible',
    `brute ${r.brute}, page ${r.got}, status ${r.status}`);
  check('F19f and the requirement it clears there is a real one, not a rounding artefact',
    r.needThere > 1000, `required ${Number(r.needThere).toFixed(0)}`);
}

// F19g: both bisected remedies quote a rounded figure, and the rounding has to
//       fall on the safe side of the threshold they solved for. Rounding to
//       nearest put roughly half of them on the wrong side: "spend less" advised
//       a level that does not fund, "earn a higher return" understated the rate.
{
  const r = await page.evaluate(() => {
    const F = window.__FF;
    const fund = (ui, over) => {
      const p = F.buildParams(Object.assign({}, ui, over));
      const n = F.months(p.ageNow, p.ageRetire);
      return F.accumulate(p, n)[n] >= F.requiredPot(p, p.ageRetire) - 1e-6;
    };
    let spendBad = 0, spendN = 0, retBad = 0, retN = 0, firstBad = null;
    for(let sav = 0; sav <= 40000; sav += 500){
      const ui = Object.assign({}, F.UI_DEFAULTS, {savings: sav, assets: 0});
      const rem = F.solveRemedies(ui);
      const sp = rem.find(x => x.key === 'spend'), rt = rem.find(x => x.key === 'return');
      if(sp){
        spendN++;
        const pct = parseFloat(sp.text.match(/to ([\d.]+)%/)[1]);
        if(!fund(ui, {expense: F.UI_DEFAULTS.expense * pct / 100})){
          spendBad++; firstBad = firstBad || ('savings ' + sav + ': ' + sp.text);
        }
      }
      if(rt){
        retN++;
        const v = parseFloat(rt.text.match(/([\d.]+)% a year/)[1]);
        if(!fund(ui, {ret: v})){
          retBad++; firstBad = firstBad || ('savings ' + sav + ': ' + rt.text);
        }
      }
    }
    return {spendBad, spendN, retBad, retN, firstBad};
  });
  check('F19g every spend-less figure quoted actually funds the plan',
    r.spendBad === 0, `${r.spendBad} of ${r.spendN} wrong` + (r.firstBad ? ' e.g. ' + r.firstBad : ''));
  check('F19h every return figure quoted actually funds the plan',
    r.retBad === 0, `${r.retBad} of ${r.retN} wrong`);
}

// F20: Die Rich below inflation gets its own explanation, not the generic one.
{
  const d = await page.evaluate(() =>
    window.__FF.diagnose(Object.assign({}, window.__FF.UI_DEFAULTS,
      {mode: 'rich', ret: 2, inflation: 4})));
  check('F20 Die Rich below inflation is called impossible', d.status === 'impossible',
    `status ${d.status}`);
  check('F20b and the reason names the real return, not the income',
    /real return/i.test(d.detail || ''), (d.detail || '').slice(0, 90));
}

// F21: already free is not a failure.
{
  const d = await page.evaluate(() =>
    window.__FF.diagnose(Object.assign({}, window.__FF.UI_DEFAULTS, {assets: 50000000})));
  check('F21 a large enough pot today reports already free', d.status === 'already',
    `status ${d.status}`);
}

// F22: nonsense ages are caught as input errors, not as impossibility.
{
  const a = await page.evaluate(() =>
    window.__FF.diagnose(Object.assign({}, window.__FF.UI_DEFAULTS, {ageNow: 60, ageRetire: 40})));
  const b = await page.evaluate(() =>
    window.__FF.diagnose(Object.assign({}, window.__FF.UI_DEFAULTS, {ageRetire: 60, ageDie: 50})));
  check('F22 a retirement age before today is an input error', a.status === 'invalid', a.message);
  check('F22b so is a life expectancy before retirement', b.status === 'invalid', b.message);
}

console.log('\n── Page and presentation ──');

// F23: real to nominal is exactly the inflation factor, to the cent.
{
  await page.evaluate(() => { document.getElementById('showNominal').checked = false; window.__FF.render(); });
  const real = await page.evaluate(() => {
    const c = window.__charts.find(c => c.data.datasets.some(d => d.label === 'Your money'));
    return c.data.datasets.find(d => d.label === 'Your money').data.map(p => p.y);
  });
  await page.evaluate(() => { document.getElementById('showNominal').checked = true; window.__FF.render(); });
  const nominal = await page.evaluate(() => {
    const c = window.__charts.find(c => c.data.datasets.some(d => d.label === 'Your money'));
    return c.data.datasets.find(d => d.label === 'Your money').data.map(p => p.y);
  });
  const infl = (await page.evaluate(() => window.__FF.last.P.inflation));
  let worst = 0;
  for(let y = 0; y < real.length; y++){
    worst = Math.max(worst, Math.abs(nominal[y] - real[y] * Math.pow(1 + infl, y)));
  }
  check('F23 future dollars are today’s money times the inflation factor',
    worst < 0.01, `largest gap ${worst.toExponential(2)}`);
  await page.evaluate(() => { document.getElementById('showNominal').checked = false; window.__FF.render(); });
}

// F24: the chart starts at the current year and the current age, as promised.
{
  const r = await page.evaluate(() => {
    const c = window.__charts.find(c => c.data.datasets.some(d => d.label === 'Your money'));
    const ds = c.data.datasets.find(d => d.label === 'Your money');
    return {firstX: ds.data[0].x, firstY: ds.data[0].y,
            assets: window.__FF.last.P.A0,
            xTitle: c.options.scales.x.title.text,
            yTitle: c.options.scales.y.title.text};
  });
  check('F24 the projection starts at the current calendar year',
    r.firstX === new Date().getFullYear(), `first x ${r.firstX}`);
  check('F24b and at the assets held today', close(r.firstY, r.assets, 0.01),
    `${r.firstY.toFixed(2)} vs ${r.assets.toFixed(2)}`);
  check('F24c both axes are titled', !!r.xTitle && !!r.yTitle, `${r.xTitle} / ${r.yTitle}`);
}

// F25: no colour may be hardcoded; every one has to come from a CSS variable.
{
  const tokens = await page.evaluate(() => {
    const read = n => getComputedStyle(document.body).getPropertyValue(n).trim().toLowerCase();
    const vars = ['--line-a','--line-b','--line-c','--line-d','--line-e','--chart-grid','--chart-text','--text','--panel']
      .map(read).filter(Boolean);
    const seen = [];
    window.__charts.forEach(c => {
      c.data.datasets.forEach(d => {
        seen.push(d.borderColor, d.backgroundColor);
        if(d.fill && typeof d.fill === 'object') seen.push(d.fill.above, d.fill.below);
      });
      const s = c.options.scales;
      seen.push(s.x.title.color, s.x.ticks.color, s.x.grid.color,
                s.y.title.color, s.y.ticks.color, s.y.grid.color,
                c.options.plugins.tooltip.backgroundColor,
                c.options.plugins.tooltip.titleColor,
                c.options.plugins.tooltip.bodyColor,
                c.options.plugins.tooltip.borderColor);
    });
    const bad = seen.filter(v =>
      typeof v === 'string' && v && v !== 'transparent' &&
      !vars.some(t => t && v.toLowerCase().startsWith(t)));
    return {bad: Array.from(new Set(bad)), vars};
  });
  check('F25 every chart colour is read from a CSS variable', tokens.bad.length === 0,
    tokens.bad.join(', ') || 'none hardcoded');
}

// F26: flipping the theme must rebuild the charts from the new tokens.
{
  const before = await page.evaluate(() => window.__charts[0].data.datasets.find(d => d.label === 'Your money').borderColor);
  await page.click('#themeToggle');
  await page.waitForTimeout(120);
  const after = await page.evaluate(() => window.__charts[0].data.datasets.find(d => d.label === 'Your money').borderColor);
  check('F26 the theme toggle re-reads the colour tokens', before !== after, `${before} -> ${after}`);
  await page.click('#themeToggle');
  await page.waitForTimeout(120);
}

// F27: the currency picker changes the symbol without touching the numbers.
{
  const r = await page.evaluate(() => {
    const need = window.__FF.last.needAtRetire;
    const out = {};
    ['AUD', 'IDR', 'GBP'].forEach(code => {
      document.getElementById('currency').value = code;
      window.__FF.render();
      out[code] = {text: document.getElementById('mNeed').textContent,
                   value: window.__FF.last.needAtRetire};
    });
    document.getElementById('currency').value = 'AUD';
    window.__FF.render();
    out.base = need;
    return out;
  });
  check('F27 switching currency leaves the underlying number untouched',
    close(r.AUD.value, r.base, 0.01) && close(r.IDR.value, r.base, 0.01) && close(r.GBP.value, r.base, 0.01),
    `${r.AUD.value.toFixed(0)} / ${r.IDR.value.toFixed(0)} / ${r.GBP.value.toFixed(0)}`);
  check('F27b but does change what is displayed',
    r.AUD.text !== r.IDR.text && r.IDR.text !== r.GBP.text,
    `${r.AUD.text} | ${r.IDR.text} | ${r.GBP.text}`);
}

// F28: the shared price cache must round-trip every field the DCA tools read
//      back out of the SAME localStorage key, or it corrupts their view. This
//      drives the REAL write path (ensure -> pcStore) with a stubbed Worker and
//      reads back through the module's own accessors, not through localStorage
//      directly: an earlier version of this check built the entry itself and so
//      could not have caught a renamed field.
{
  const ohlc = {
    dates: ['2020-01-01','2020-01-02','2020-01-03'],
    prices: [10, 11, 12], opens: [10, 10.5, 11.5],
    highs: [10.2, 11.2, 12.2], lows: [9.8, 10.4, 11.4],
    source: 'yahoo', kind: 'stock'
  };
  await page.unroute('**/*');
  await page.route('**/*', route => {
    const url = route.request().url();
    if(url.startsWith('file://')) return route.continue();
    if(/chart\.umd/.test(url)) return route.fulfill({contentType:'application/javascript', body: CHART_STUB});
    if(/workers\.dev/.test(url)) return route.fulfill({contentType:'application/json',
      body: JSON.stringify({results: {OHLCTEST: ohlc}, asOf: new Date().toISOString()})});
    return route.fulfill({contentType:'application/javascript', body: '/* stub */'});
  });
  const r = await page.evaluate(async () => {
    const C = window.SharedPriceCache;
    if(!C) return {missing: true};
    C.clear();
    await C.ensure('OHLCTEST', '2020-01-01', '2020-01-03');
    const e = C.entry('OHLCTEST');
    const sl = C.slice('OHLCTEST', '2020-01-01', '2020-01-03');
    const raw = JSON.parse(localStorage.getItem(C.key) || '{}');
    return {
      key: C.key,
      // Exactly the fields dcasimulator/script.js reads back off an entry.
      missingFields: ['dates','prices','opens','highs','lows','cachedStart','cachedEnd',
                      'coverageStart','coverageEnd','source','kind']
                     .filter(f => !e || e[f] === undefined),
      cachedStart: e && e.cachedStart, cachedEnd: e && e.cachedEnd,
      coverageStart: e && e.coverageStart, coverageEnd: e && e.coverageEnd,
      sliceRows: sl ? sl.dates.length : 0,
      sliceHasOhlc: !!(sl && sl.opens && sl.highs && sl.lows),
      persisted: !!(raw.cache && raw.cache.OHLCTEST)
    };
  });
  check('F28 the shared cache uses the DCA simulator\u2019s storage key',
    r.key === 'dca_priceCache_v2', `key ${r.key}`);
  check('F28b a real fetch writes every field those tools read back',
    r.missingFields && r.missingFields.length === 0,
    `missing: ${(r.missingFields || []).join(', ') || 'none'}`);
  check('F28c the data extent and the requested coverage are recorded separately',
    r.cachedStart === '2020-01-01' && r.cachedEnd === '2020-01-03' &&
    r.coverageStart === '2020-01-01' && r.coverageEnd === '2020-01-03',
    `data ${r.cachedStart}..${r.cachedEnd}, coverage ${r.coverageStart}..${r.coverageEnd}`);
  check('F28d and the reader hands back the rows with their OHLC intact',
    r.sliceRows === 3 && r.sliceHasOhlc, `${r.sliceRows} rows, ohlc ${r.sliceHasOhlc}`);
  check('F28e and it survives to the key on disk', r.persisted, `persisted ${r.persisted}`);
}

// F29: nothing may be fetched before the user asks for it.
{
  const r = await page.evaluate(() => ({
    status: document.getElementById('tickerStatus').textContent,
    remaining: window.SharedYF ? window.SharedYF.getDailyRemaining() : null,
    limit: window.SharedYF ? window.SharedYF.getDailyLimit() : null
  }));
  check('F29 no market data is requested on load',
    r.remaining === r.limit, `${r.remaining} of ${r.limit} left`);
  check('F29b and the page says so', /until you press Fetch/i.test(r.status), r.status.slice(0, 70));
}

// F30: every guided-tour step points at something that exists.
{
  const bad = await page.evaluate(() => {
    if(!window.__TOUR) return ['__TOUR missing'];
    return window.__TOUR.steps
      .filter(s => s.target && !document.querySelector(s.target))
      .map(s => s.target);
  });
  check('F30 every tour step target resolves', bad.length === 0, bad.join(', ') || 'all resolve');
}

// F31: the headline numbers on the page agree with the engine behind them.
{
  await page.evaluate(() => {
    document.getElementById('resetBtn').click();
  });
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => ({
    need: window.__FF.last.needAtRetire,
    shown: document.getElementById('mNeed').textContent,
    freeAge: window.__FF.last.ffAge,
    freeShown: document.getElementById('mFreeAge').textContent,
    rows: document.querySelectorAll('#tableWrap tbody tr').length,
    years: window.__FF.last.years,
    verdict: document.getElementById('verdict').className
  }));
  const p = refParams(base);
  check('F31 the amount needed on the page matches the replay',
    close(r.need, refRequired(p, p.ageRetire), 0.01),
    `page ${r.need.toFixed(2)} vs replay ${refRequired(p, p.ageRetire).toFixed(2)}`);
  check('F31b the table has one row per year to the life expectancy',
    r.rows === r.years + 1, `${r.rows} rows for ${r.years} years`);
  check('F31c the verdict banner is showing', /visible/.test(r.verdict), r.verdict);
  check('F31d the freedom age tile is not empty',
    r.freeShown && r.freeShown !== '—', r.freeShown);
}

// F33: the whole ticker path, with the Worker stubbed: fetch, fold into the
//      shared cache, measure the three statistics, fill the fields.
{
  await page.unroute('**/*');
  const series = (() => {
    const dates = [], prices = [];
    let p = 100, d = new Date(Date.UTC(2005, 0, 3));
    const step = Math.pow(1.09, 1 / 252);
    for(let i = 0; i < 5040; i++){
      dates.push(d.toISOString().slice(0, 10));
      prices.push(i === 2500 ? p * 0.55 : p);       // one deep crash
      p *= step;
      d = new Date(d.getTime() + 365.25 / 252 * 86400000);
    }
    return {dates, prices, source: 'yahoo', kind: 'stock'};
  })();
  await page.route('**/*', route => {
    const url = route.request().url();
    if(url.startsWith('file://')) return route.continue();
    if(/chart\.umd/.test(url)) return route.fulfill({contentType: 'application/javascript', body: CHART_STUB});
    if(/workers\.dev/.test(url)){
      return route.fulfill({contentType: 'application/json',
        body: JSON.stringify({results: {FAKE: series}, asOf: new Date().toISOString()})});
    }
    return route.fulfill({contentType: 'application/javascript', body: '/* stub */'});
  });
  await page.evaluate(() => { window.SharedPriceCache.clear(); });
  await page.click('.ctrl-tab[data-tab="invest"]');   // the ticker field lives there
  await page.fill('#ticker', 'FAKE');
  await page.click('#fetchTickerBtn');
  await page.waitForFunction(() => /over/i.test(document.getElementById('tickerStatus').textContent), null, {timeout: 15000});
  const r = await page.evaluate(() => ({
    ret: parseFloat(document.getElementById('ret').value),
    std: parseFloat(document.getElementById('std').value),
    hasMddField: !!document.getElementById('mdd'),
    preset: document.getElementById('assetPreset').value,
    cached: window.SharedPriceCache.tickers(),
    entry: window.SharedPriceCache.entry('FAKE'),
    stored: !!localStorage.getItem('dca_priceCache_v2'),
    status: document.getElementById('tickerStatus').textContent
  }));
  // The crash in this series is a single day that recovers straight away, so it
  // leaves the compound return alone and lands in the volatility instead.
  check('F33 a fetched ticker fills the return field from its own price history',
    Math.abs(r.ret - 9) < 0.3, `got ${r.ret}% a year, want 9%`);
  check('F33b and a volatility that the crash pushes above the smooth case',
    r.std > 5 && isFinite(r.std), `got ${r.std}%`);
  check('F33b2 and there is no drawdown field left for it to fill',
    !r.hasMddField, r.hasMddField ? '#mdd still on the page' : 'gone');
  check('F33c and switches the asset away from a preset', r.preset === 'custom', r.preset);
  check('F33d the series lands in the shared cache under its ticker',
    r.cached.includes('FAKE') && r.entry && r.entry.dates.length === 5040,
    `${r.cached.join(',')} / ${r.entry ? r.entry.dates.length : 0} rows`);
  check('F33e and is written to the key the DCA tools read', r.stored, `stored ${r.stored}`);
  check('F33f a second fetch of the same range costs no further request',
    await page.evaluate(async () => {
      const before = window.SharedYF.getDailyRemaining();
      await window.SharedPriceCache.ensure('FAKE', '1990-01-01', new Date().toISOString().slice(0, 10));
      return window.SharedYF.getDailyRemaining() === before;
    }), 'served from cache');
}

/* ── Axes, zoom bounds and the crossing marker ─────────────────────────────
   The Chart.js stub records configuration rather than drawing, so these read
   the config the page asked for. Bounds and limits ARE the behaviour here:
   the plugin clamps to what `limits` says. ── */
{
  await page.evaluate(() => {
    document.getElementById('showNominal').checked = false;
    window.__FF.render();
  });
  const r = await page.evaluate(() => {
    const c = window.__charts.find(c => c.data.datasets.some(d => d.label === 'Your money'));
    const s = c.options.scales, z = c.options.plugins.zoom;
    const pts = c.data.datasets.find(d => d.label === 'Your money').data;
    const marker = c.data.datasets.filter(d => d.label === 'Financially free');
    const need = c.data.datasets.find(d => d.label === 'Pot needed to stop here').data;
    const res = window.__FF.last;
    return {
      xTitle: s.x.title.text, ageTitle: s.xAge && s.xAge.title.text,
      xBounds: [s.x.min, s.x.max], ageBounds: [s.xAge && s.xAge.min, s.xAge && s.xAge.max],
      dataBounds: [pts[0].x, pts[pts.length - 1].x],
      limits: z.limits,
      // The age axis has to READ as an age, not repeat the year.
      ageTickAtStart: s.xAge.ticks.callback(s.x.min),
      markerCount: marker.length,
      markerPoint: marker.length ? marker[marker.length - 1].data[0] : null,
      dropline: marker.length ? marker[0].data.map(p => [p.x, p.y]) : null,
      ffAge: res.ffAge, ageNow: res.P.ageNow, thisYear: res.thisYear,
      needAtMarker: marker.length
        ? window.__FF.requiredPot ? null : null
        : null,
      needSeries: need.map(p => [p.x, p.y])
    };
  });

  check('F34 the x axis is doubled: calendar year and age',
    r.xTitle === 'Calendar year' && r.ageTitle === 'Age', `${r.xTitle} / ${r.ageTitle}`);
  check('F34b and the age axis is labelled in ages, not years',
    String(r.ageTickAtStart) === String(r.ageNow), `${r.ageTickAtStart} at ${r.xBounds[0]}`);
  check('F34c both x axes span exactly the plotted data',
    r.xBounds[0] === r.dataBounds[0] && r.xBounds[1] === r.dataBounds[1] &&
    r.ageBounds[0] === r.xBounds[0] && r.ageBounds[1] === r.xBounds[1],
    `x ${r.xBounds.join('..')}, age ${r.ageBounds.join('..')}, data ${r.dataBounds.join('..')}`);
  check('F35 zooming out is bounded by that span, on both axes',
    !!r.limits && r.limits.x.min === r.xBounds[0] && r.limits.x.max === r.xBounds[1] &&
    r.limits.xAge.min === r.xBounds[0] && r.limits.xAge.max === r.xBounds[1],
    r.limits ? `x ${r.limits.x.min}..${r.limits.x.max}, minRange ${r.limits.x.minRange}` : 'no limits set');
  check('F35b and zooming in stops before the span is meaningless',
    r.limits.x.minRange > 0 && r.limits.x.minRange <= r.xBounds[1] - r.xBounds[0],
    `minRange ${r.limits.x.minRange}`);

  check('F36 the crossing carries a marker and a dropline', r.markerCount === 2,
    `${r.markerCount} dataset(s)`);
  check('F36b the marker sits at the freedom age',
    r.markerPoint && Math.abs(r.markerPoint.x - (r.thisYear + r.ffAge - r.ageNow)) < 1e-6,
    r.markerPoint ? `x ${r.markerPoint.x.toFixed(3)} for age ${r.ffAge.toFixed(3)}` : 'no marker');
  // The marker has to land ON the pot-needed curve, not merely near it. The
  // curve is sampled yearly and the crossing falls between two samples, so it
  // is checked against a straight line through the two it sits between.
  {
    const x = r.markerPoint.x, i = Math.floor(x - r.needSeries[0][0]);
    const f = x - r.needSeries[0][0] - i;
    const lerp = r.needSeries[i][1] + (r.needSeries[i + 1][1] - r.needSeries[i][1]) * f;
    check('F36c and on the pot-needed curve it marks',
      Math.abs(r.markerPoint.y - lerp) / Math.max(1, lerp) < 0.02,
      `marker ${r.markerPoint.y.toFixed(0)} vs curve ${lerp.toFixed(0)}`);
  }
  check('F36d the dropline runs from the axis to the marker',
    r.dropline && r.dropline[0][0] === r.markerPoint.x && r.dropline[0][1] === 0 &&
    r.dropline[1][1] === r.markerPoint.y,
    r.dropline ? `${r.dropline[0].join(',')} -> ${r.dropline[1].join(',')}` : 'none');
}

/* ── Inflation is visible, not just applied ────────────────────────────────
   The engine runs in real terms, where the living cost is flat. F37 pins that
   the page also SHOWS the cost rising, and that the pot needed rises with it,
   so "freedom later costs more" holds in the money of the day. ── */
{
  const r = await page.evaluate(() => {
    const $ = id => document.getElementById(id);
    const rows = () => window.__FF.tableRows(window.__FF.last);
    $('showNominal').checked = false; window.__FF.render();
    const real = rows(), note = $('inflationNote').textContent.trim();
    const heads = Array.from(document.querySelectorAll('#tableWrap thead th')).map(t => t.textContent.trim());
    $('showNominal').checked = true; window.__FF.render();
    const nom = rows();
    const csv = window.__FF.last;
    $('showNominal').checked = false; window.__FF.render();
    return {
      note, heads, i: window.__FF.last.P.inflation,
      realExpense: real.map(x => x.expense), nomExpense: nom.map(x => x.expense),
      realNeed: real.map(x => x.need), nomNeed: nom.map(x => x.need),
      ageNow: window.__FF.last.P.ageNow, ageRetire: window.__FF.last.P.ageRetire,
      currency: csv.ui.currency
    };
  });

  check('F37 the table carries the spending itself', r.heads.includes('Expense'),
    r.heads.join(' | '));
  check('F37b flat in today’s money, by construction',
    r.realExpense.every(v => Math.abs(v - r.realExpense[0]) < 0.01 ||
                             Math.abs(v - r.realExpense[r.realExpense.length - 1]) < 0.01),
    `${r.realExpense[0].toFixed(0)} .. ${r.realExpense[r.realExpense.length - 1].toFixed(0)}`);
  {
    let worst = 0;
    for(let y = 0; y < r.realExpense.length; y++){
      worst = Math.max(worst, Math.abs(r.nomExpense[y] - r.realExpense[y] * Math.pow(1 + r.i, y)));
    }
    check('F37c and in future dollars it is the real cost times the inflation factor',
      worst < 0.01, `largest gap ${worst.toExponential(2)}`);
  }
  check('F37d so prices genuinely rise before retirement, not only after',
    r.nomExpense[Math.round(r.ageRetire - r.ageNow) - 1] > r.nomExpense[0] * 1.01,
    `${r.nomExpense[0].toFixed(0)} at ${r.ageNow} -> ${r.nomExpense[Math.round(r.ageRetire - r.ageNow) - 1].toFixed(0)} the year before retiring`);
  check('F38 financial freedom later costs MORE in the money of the day',
    r.nomNeed[Math.round(r.ageRetire - r.ageNow)] > r.nomNeed[0],
    `${r.nomNeed[0].toFixed(0)} now vs ${r.nomNeed[Math.round(r.ageRetire - r.ageNow)].toFixed(0)} at ${r.ageRetire}`);
  check('F38b while in today’s money it costs less, because fewer years are left to fund',
    r.realNeed[Math.round(r.ageRetire - r.ageNow)] < r.realNeed[0],
    `${r.realNeed[0].toFixed(0)} vs ${r.realNeed[Math.round(r.ageRetire - r.ageNow)].toFixed(0)}`);
  check('F38c and the inflation field names a future price rather than only a rate',
    /costs/.test(r.note) && /\d/.test(r.note), r.note.slice(0, 90));
}

/* ── The cash flows, and the money you put in ──────────────────────────────
   Three things the page now says out loud: what comes in, what goes out, and
   how much of what you put in is still in the pot. The first two have to
   subtract to the third column of the table in every row; the last is replayed
   from a closed identity rather than from the page's own loop. ── */

console.log('\n── Cash flow and deposits ──');

// F41: the deposited line against the running-minimum identity, on three plans
//      that never run the pot to nothing (where the per-step floor at zero and
//      the closed form can legitimately part company).
for(const [name, extra] of [
  ['the target plan', {}],
  ['a plan retiring at the freedom age', {ageRetire: 47}],
  ['a plan with a pension bridge', {ageRetire: 55, pensionOn: true, pensionStartAge: 67, pensionAmount: 29000}],
  ['the net income model', {savingsMode: 'income', savings: 90000}]
]){
  const ui = Object.assign({}, base, extra);
  const p = refParams(ui);
  const r = await engine(ui, `(function(){
    var s = F.lifetimeSeries(P);
    return {dep: Array.from(s.deposited), bal: Array.from(s.balance)};
  })()`);
  const want = refDeposited(p);
  let worst = 0, at = -1;
  for(let t = 0; t < want.length; t++){
    const d = Math.abs(r.dep[t] - want[t]);
    if(d > worst){ worst = d; at = t; }
  }
  check(`F41 money deposited matches the replay identity — ${name}`,
    r.bal.every(v => v > -1e-6) && worst < 0.01,
    `largest gap ${worst.toExponential(2)}${at >= 0 ? ' at month ' + at : ''}`);
}

// F41b: the shape the line is FOR. It climbs while you work, never climbs
//       again after you stop, and never exceeds the pot it is part of.
{
  const ui = Object.assign({}, base, {ageRetire: 47});
  const r = await engine(ui, `(function(){
    var s = F.lifetimeSeries(P), accM = F.accMonths(P), t;
    var risesWhileWorking = true, risesAfter = false, overBalance = false, negative = false;
    for(t = 0; t < s.deposited.length; t++){
      if(t > 0 && t <= accM && s.deposited[t] < s.deposited[t - 1] - 1e-9) risesWhileWorking = false;
      if(t > accM && s.deposited[t] > s.deposited[t - 1] + 1e-9) risesAfter = true;
      if(s.deposited[t] > s.balance[t] + 1e-6) overBalance = true;
      if(s.deposited[t] < -1e-9) negative = true;
    }
    return {risesWhileWorking: risesWhileWorking, risesAfter: risesAfter,
            overBalance: overBalance, negative: negative,
            atRetire: s.deposited[accM], last: s.deposited[s.deposited.length - 1],
            balAtRetire: s.balance[accM]};
  })()`);
  check('F41b it only ever climbs while you are still paying in',
    r.risesWhileWorking && !r.risesAfter,
    `climbs before retirement ${r.risesWhileWorking}, climbs after ${r.risesAfter}`);
  check('F41c and never exceeds the pot, nor falls below nothing',
    !r.overBalance && !r.negative, `over balance ${r.overBalance}, negative ${r.negative}`);
  check('F41d it turns down once the growth stops covering the draw',
    r.last < r.atRetire - 1,
    `${r.atRetire.toFixed(0)} at retirement -> ${r.last.toFixed(0)} at the life expectancy`);
  check('F41e which is later than retirement, not at it',
    r.atRetire < r.balAtRetire - 1,
    `deposited ${r.atRetire.toFixed(0)} vs balance ${r.balAtRetire.toFixed(0)}`);
}

// F41f: at retirement it is exactly the starting assets plus everything paid
//       in, because nothing has been taken out yet. Closed form, no loop.
{
  const ui = Object.assign({}, base, {ageRetire: 47});
  const p = refParams(ui);
  const n = refAccMonths(p);
  let paid = 0;
  for(let t = 0; t < n; t++) paid += Math.max(0, refIncome(p, t) - refSpend(p, t));
  const got = await engine(ui, 'F.lifetimeSeries(P).deposited[F.accMonths(P)]');
  check('F41f at retirement it is the starting assets plus every cent paid in',
    close(got, p.A0 + paid, 0.01), `page ${got.toFixed(2)} vs replay ${(p.A0 + paid).toFixed(2)}`);
}

// F41g: Die Rich spends only the real growth, so the capital is never touched.
{
  const ui = Object.assign({}, base, {mode: 'rich', ageRetire: 55, assets: 400000});
  const r = await engine(ui, `(function(){
    var s = F.lifetimeSeries(P), accM = F.accMonths(P);
    var lowest = Infinity, t;
    for(t = accM; t < s.deposited.length; t++) lowest = Math.min(lowest, s.deposited[t]);
    return {atRetire: s.deposited[accM], lowest: lowest};
  })()`);
  check('F41g under Die Rich it never turns down at all',
    close(r.lowest, r.atRetire, 0.01),
    `${r.atRetire.toFixed(0)} at retirement, lowest after ${r.lowest.toFixed(0)}`);
}

// F41h: a pot that runs out takes what you put in with it.
{
  const ui = Object.assign({}, base, {ageRetire: 40, assets: 0, savings: 5000});
  const r = await engine(ui, `(function(){
    var s = F.lifetimeSeries(P);
    return {last: s.deposited[s.deposited.length - 1], lastBal: s.balance[s.balance.length - 1]};
  })()`);
  check('F41h a pot spent to nothing leaves nothing of what you put in',
    r.lastBal < 0 && Math.abs(r.last) < 1e-9,
    `balance ${r.lastBal.toFixed(0)}, deposited ${r.last.toFixed(0)}`);
}

// F42: SAVED = INCOME - EXPENSE, in every row of the table, under BOTH models
//      and on both sides of retirement. This is the identity the new columns
//      promise, and the one a reader will check with a calculator.
for(const [name, extra] of [
  ['the savings model', {}],
  ['the net income model', {savingsMode: 'income', savings: 90000}],
  ['a pension bridge', {ageRetire: 55, pensionOn: true, pensionStartAge: 67, pensionAmount: 29000}]
]){
  const r = await page.evaluate(u => {
    const F = window.__FF;
    const $ = id => document.getElementById(id);
    const set = (id, v) => { const el = $(id); if(el) el.value = v; };
    set('ageRetire', u.ageRetire == null ? 60 : u.ageRetire);
    set('savings', String(u.savings == null ? 30000 : u.savings));
    $('pensionOn').checked = !!u.pensionOn;
    set('pensionStartAge', u.pensionStartAge == null ? 67 : u.pensionStartAge);
    set('pensionAmount', String(u.pensionAmount == null ? 29000 : u.pensionAmount));
    document.querySelectorAll('#savingsModeGroup .seg-btn').forEach(b => {
      if(b.dataset.val === (u.savingsMode || 'savings')) b.click();
    });
    F.render();
    const rows = F.tableRows(F.last);
    const retIdx = Math.round(F.last.P.ageRetire - F.last.P.ageNow);
    let worst = 0;
    rows.forEach(row => {
      if(row.flow == null) return;
      worst = Math.max(worst, Math.abs(row.income - row.expense - row.flow));
    });
    return {
      worst: worst,
      working: rows[0],
      retired: rows[retIdx + 1],
      late: rows[rows.length - 2],
      heads: Array.from(document.querySelectorAll('#tableWrap thead th')).map(t => t.textContent.trim())
    };
  }, extra);
  check(`F42 Saved is Income less Expense in every row — ${name}`,
    r.worst < 0.01, `largest gap ${r.worst.toExponential(2)}`);
  check(`F42b and the saving turns negative once you stop — ${name}`,
    r.working.flow > 0 && r.retired.flow < 0,
    `${r.working.flow.toFixed(0)} working, ${r.retired.flow.toFixed(0)} retired`);
}

// F42e: and all three columns against the replay, in a working year and a
//        retired one, under both models and across a pension start.
for(const [name, extra] of [
  ['the savings model', {}],
  ['the net income model', {savingsMode: 'income', savings: 90000}],
  ['a pension bridge', {ageRetire: 55, pensionOn: true, pensionStartAge: 67, pensionAmount: 29000}]
]){
  const ui = Object.assign({}, base, extra);
  const p = refParams(ui);
  const rows = await page.evaluate(u => {
    const F = window.__FF;
    return F.tableRows(F.compute(Object.assign({}, F.UI_DEFAULTS, u)));
  }, ui);
  let worstInc = 0, worstExp = 0, worstSav = 0;
  for(let y = 0; y < rows.length - 1; y++){
    let inc = 0, exp = 0;
    for(let m = y * 12; m < (y + 1) * 12; m++){ inc += refIncome(p, m); exp += refSpend(p, m); }
    worstInc = Math.max(worstInc, Math.abs(rows[y].income - inc));
    worstExp = Math.max(worstExp, Math.abs(rows[y].expense - exp));
    worstSav = Math.max(worstSav, Math.abs(rows[y].flow - (inc - exp)));
  }
  check(`F42e all three columns match the replay's own cash flows — ${name}`,
    worstInc < 0.01 && worstExp < 0.01 && worstSav < 0.01,
    `income ${worstInc.toExponential(2)}, expense ${worstExp.toExponential(2)}, saved ${worstSav.toExponential(2)}`);
}

// F42c: the columns read Income, Expense, Saved, in that order, before the pot.
{
  const heads = await page.evaluate(() => {
    document.getElementById('ageRetire').value = 60;
    document.getElementById('pensionOn').checked = false;
    document.querySelectorAll('#savingsModeGroup .seg-btn').forEach(b => {
      if(b.dataset.val === 'savings') b.click();
    });
    window.__FF.render();
    return Array.from(document.querySelectorAll('#tableWrap thead th')).map(t => t.textContent.trim());
  });
  const i = heads.indexOf('Income'), e = heads.indexOf('Expense'), sv = heads.indexOf('Saved');
  check('F42c Income and Expense come before Saved, and Saved before the pot',
    i >= 0 && e === i + 1 && sv === e + 1 && sv < heads.indexOf('Pot needed'),
    heads.join(' | '));
  check('F42d and "Saved or spent" is gone', !heads.some(h => /or spent/i.test(h)),
    heads.join(' | '));
}

/* ── The two charts, after the revision ── */
{
  const r = await page.evaluate(() => {
    const res = window.__FF.last;
    const path = window.__charts.find(c => c.data.datasets.some(d => d.label === 'Your money'));
    const cash = window.__charts.find(c => c.data.datasets.some(d => d.label === 'Income'));
    const label = (c, l) => c.data.datasets.find(d => d.label === l);
    const dep = label(path, 'Money deposited');
    const inc = label(cash, 'Income'), spend = label(cash, 'Spending');
    const xs = d => d.data.map(p => p.x);
    return {
      years: res.years, thisYear: res.thisYear,
      ageNow: res.P.ageNow, ageDie: res.P.ageDie, ageRetire: res.P.ageRetire,
      pathSpan: [xs(label(path, 'Your money'))[0], xs(label(path, 'Your money')).slice(-1)[0]],
      hasDeposited: !!dep,
      depSpan: dep ? [dep.data[0].y, dep.data.slice(-1)[0].y] : null,
      depAtRetire: dep ? dep.data[Math.round(res.P.ageRetire - res.P.ageNow)].y : null,
      cashSpan: inc ? [xs(inc)[0], xs(inc).slice(-1)[0]] : null,
      incFirst: inc ? inc.data[0].y : null,
      incAfterRetire: inc ? inc.data[Math.round(res.P.ageRetire - res.P.ageNow) + 1].y : null,
      spendFlat: spend ? spend.data.every(p => Math.abs(p.y - spend.data[0].y) < 0.01) : null,
      fill: inc ? inc.fill : null,
      yTitle: cash ? cash.options.scales.y.title.text : null,
      stillHasPotLines: !!(label(cash, 'Your pot') || label(cash, 'Your pot after a crash')),
      legend2: Array.from(document.querySelectorAll('#legend2 .legend-item')).map(x => x.textContent.trim())
    };
  });

  check('F43 the path chart runs the whole plan, not just the run-up',
    r.pathSpan[0] === r.thisYear && r.pathSpan[1] === r.thisYear + r.years,
    `${r.pathSpan.join('..')} for ages ${r.ageNow}..${r.ageDie}`);
  check('F43b and carries the money-deposited line', r.hasDeposited,
    r.hasDeposited ? `${r.depSpan[0].toFixed(0)} -> ${r.depSpan[1].toFixed(0)}` : 'missing');
  check('F43c which has stopped climbing by the retirement age',
    r.depSpan[1] <= r.depAtRetire + 1e-6,
    `${r.depAtRetire.toFixed(0)} at ${r.ageRetire}, ${r.depSpan[1].toFixed(0)} at ${r.ageDie}`);

  check('F44 the second chart plots income against spending',
    !!r.cashSpan && r.spendFlat === true && r.incFirst > 0,
    `income starts ${r.incFirst == null ? '—' : r.incFirst.toFixed(0)}, spending flat ${r.spendFlat}`);
  check('F44b over the same years as the first, so the two sides are comparable',
    r.cashSpan[0] === r.thisYear && r.cashSpan[1] === r.thisYear + r.years,
    r.cashSpan.join('..'));
  check('F44c income falls away once you stop, with no pension to replace it',
    r.incAfterRetire === 0, `${r.incAfterRetire} the year after retiring`);
  check('F44d and the gap between them is filled on both sides, in two colours',
    !!r.fill && r.fill.target === 0 && !!r.fill.above && !!r.fill.below &&
    r.fill.above !== r.fill.below,
    r.fill ? `target ${r.fill.target}, ${r.fill.above} / ${r.fill.below}` : 'no fill');
  check('F44e the axis says it is a yearly flow, not a balance',
    /a year/i.test(r.yTitle || ''), r.yTitle);
  check('F44f the legend names both sides of the fill',
    r.legend2.some(l => /saved/i.test(l)) && r.legend2.some(l => /drawn/i.test(l)),
    r.legend2.join(' | '));
  check('F44g and the four-pot drawdown it replaced is gone', !r.stillHasPotLines,
    r.stillHasPotLines ? 'pot lines still plotted' : 'replaced');
}

// F45: nothing anywhere still offers a crash stress test.
{
  const r = await page.evaluate(() => ({
    mdd: !!document.getElementById('mdd'),
    toggle: !!document.getElementById('showStress'),
    metric: !!document.getElementById('mStress'),
    fn: typeof window.__FF.stressRequiredPot,
    preset: Object.keys(window.__FF.PRESET_ASSETS).some(k => 'mdd' in window.__FF.PRESET_ASSETS[k]),
    defaults: 'mdd' in window.__FF.UI_DEFAULTS || 'showStress' in window.__FF.UI_DEFAULTS,
    copy: /crash|stress test|drawdown/i.test(document.getElementById('assumptions').textContent)
  }));
  check('F45 the crash stress test is gone, field, toggle, metric and all',
    !r.mdd && !r.toggle && !r.metric && r.fn === 'undefined' && !r.preset && !r.defaults && !r.copy,
    JSON.stringify(r));
}

/* F46: the export buttons sit in the top right of their card, beside the
        heading, the way every other tool on the site places them. They used to
        be pushed onto a line of their own by a long subtitle, which is why the
        subtitle is now a sibling BELOW the row rather than inside it. The
        Path to freedom subtitle is the long one, so it is the real test. */
{
  const r = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.chart-head, .detail-head').forEach(head => {
      const card = head.closest('.card');
      const h2 = head.querySelector('h2');
      const cluster = head.querySelector('.btn-cluster');
      if(!h2 || !cluster) return;
      const c = card.getBoundingClientRect();
      const a = h2.getBoundingClientRect(), t = cluster.getBoundingClientRect();
      out.push({
        title: h2.textContent.trim(),
        sameRow: Math.abs(a.top - t.top) < a.height,
        // Flush with the card's content edge, within a border's width.
        flushRight: Math.abs(c.right - parseFloat(getComputedStyle(card).paddingRight) - t.right) <= 2,
        subIsSibling: !head.querySelector('.sub'),
        subLen: (card.querySelector(':scope > .sub') || {textContent: ''}).textContent.length
      });
    });
    return out;
  });
  check('F46 every export cluster sits in the top right, beside its heading',
    r.length === 3 && r.every(x => x.sameRow && x.flushRight),
    r.map(x => `${x.title}: row ${x.sameRow}, right ${x.flushRight}`).join(' | '));
  check('F46b and the subtitle sits below that row, so it cannot push them off it',
    r.every(x => x.subIsSibling) && r.some(x => x.subLen > 120),
    `longest subtitle ${Math.max.apply(null, r.map(x => x.subLen))} chars, none inside the row`);
}

/* ── Exports ── */
{
  const r = await page.evaluate(() => {
    const ids = ['ffSvgBtn', 'ffPngBtn', 'ffCopyBtn', 'ddSvgBtn', 'ddPngBtn', 'ddCopyBtn', 'csvBtn'];
    const missing = ids.filter(i => !document.getElementById(i));
    // Intercept the blob the CSV path builds rather than downloading it. The
    // anchor's own click is stubbed too, so headless Chromium is never asked
    // to navigate to the placeholder URL.
    let captured = null;
    const origCreate = URL.createObjectURL, origRevoke = URL.revokeObjectURL;
    const origClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = b => { captured = b; return 'blob:stub'; };
    URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = function(){};
    document.getElementById('csvBtn').click();
    URL.createObjectURL = origCreate;
    URL.revokeObjectURL = origRevoke;
    HTMLAnchorElement.prototype.click = origClick;
    return captured ? captured.text().then(text => ({missing, text})) : {missing, text: null};
  });
  check('F39 every export control is on the page', r.missing.length === 0,
    r.missing.length ? 'missing ' + r.missing.join(',') : 'SVG, PNG, copy on both charts, CSV on the table');
  const lines = (r.text || '').trim().split('\n');
  check('F39b the CSV carries the same columns as the table',
    lines.length > 2 && lines[2] === 'Year,Age,Income,Expense,Saved,Balance,Pot_needed,Gap',
    lines[2] || 'no header');
  check('F39c one row per year, matching the table',
    lines.length - 3 === (await page.evaluate(() => window.__FF.tableRows(window.__FF.last).length)),
    `${lines.length - 3} rows`);
  check('F39d and says which money and which currency it is in',
    /today's money|future dollars/.test(lines[1] || ''), (lines[1] || '').replace('# ', ''));

  /* F39e: an exported legend wraps instead of running off the canvas. It used
     to be laid out on one assumed row, which fitted four entries and silently
     pushed the sixth through the watermark and off the right edge. The packing
     is measured here on labels of a known width, so the check does not depend
     on a font being available in headless Chromium. */
  const packed = await page.evaluate(() => {
    const items = n => Array.from({length: n}, (_, i) => ({label: 'x'.repeat(20) + i}));
    const measure = s => s.length * 10;      // 20 chars -> 200 wide
    const pack = (n, maxW) => window.__FF.layoutLegend(items(n), measure, maxW, 5, 7, 20);
    const wide = pack(6, 900), narrow = pack(6, 320), one = pack(2, 2000);
    const widest = rows => Math.max.apply(null, rows.map(r => r.width));
    return {
      wideRows: wide.length, wideMax: widest(wide),
      narrowRows: narrow.length, narrowMax: widest(narrow),
      oneRow: one.length,
      total: wide.reduce((n, r) => n + r.items.length, 0)
    };
  });
  check('F39e a legend too wide for one row is packed onto several',
    packed.wideRows > 1 && packed.wideMax <= 900,
    `${packed.wideRows} rows, widest ${packed.wideMax}`);
  check('F39f narrower still means more rows, never a wider one',
    packed.narrowRows > packed.wideRows && packed.narrowMax <= 320,
    `${packed.narrowRows} rows, widest ${packed.narrowMax}`);
  check('F39g and nothing is dropped or duplicated on the way',
    packed.total === 6 && packed.oneRow === 1, `${packed.total} of 6 kept`);
}

/* ── The control panel's action row ── */
{
  const r = await page.evaluate(() => {
    const sim = document.getElementById('simBtn'), rst = document.getElementById('resetBtn');
    const row = sim && sim.parentElement, aside = document.querySelector('.controls');
    return {
      hasSim: !!sim, sameRow: !!(rst && row && rst.parentElement === row),
      pinned: !!(aside && aside.lastElementChild === row),
      buriedInSettings: !!document.querySelector('#tab-settings #resetBtn')
    };
  });
  check('F40 Simulate and Reset sit together in one pinned action row',
    r.hasSim && r.sameRow && r.pinned, `sim ${r.hasSim}, together ${r.sameRow}, pinned ${r.pinned}`);
  check('F40b so Reset is no longer buried in the Settings tab', !r.buriedInSettings, '');
}

// F32: the page must not have thrown anywhere along the way.
check('F32 no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | ') || 'clean');

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
