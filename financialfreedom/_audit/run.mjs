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
    // The page reads chart.scales to decide which axes exist before moving them.
    this.scales = this.options.scales || {};
    this._hidden = {};
    window.__charts.push(this);
  }
  update(){}
  destroy(){ const i = window.__charts.indexOf(this); if(i >= 0) window.__charts.splice(i, 1); }
  resetZoom(){}
  zoomScale(id, range){
    const s = this.options.scales && this.options.scales[id];
    if(s){ s.min = range.min; s.max = range.max; }
  }
  isDatasetVisible(i){ return !this._hidden[i]; }
  setDatasetVisibility(i, v){ this._hidden[i] = !v; }
}
Chart.register = function(){};
// Enough of the real interaction surface for the page's own x-value tooltip
// mode to register and be driven against hand-built metas.
Chart.Interaction = {modes: {}};
Chart.helpers = {getRelativePosition: function(e){ return e; }};
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
    pIndexed: ui.pensionIndexed !== false,
    pMonthly: ui.pensionOn ? perMo(ui.pensionAmount, ui.pensionPeriod || 'yearly') : 0
  };
}
/* Step 3b, written as a discount factor rather than as the page's branch. An
   unindexed pension is a fixed figure in the money of the day, so its real
   value is deflated from TODAY — the amount entered is what it pays now, and
   the years before it starts erode it just as the years after do. */
const refPension = (p, age) => {
  if(!(p.pensionOn && age >= p.pStart - 1e-9)) return 0;
  return p.pIndexed ? p.pMonthly : p.pMonthly * Math.pow(1 + p.infl, -(age - p.ageNow));
};
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
   The forward balance is rebuilt here too, from the replay's own savings. It
   is the SECTION 1 line, so nothing is ever withdrawn from it: the clamp bites
   only when the market has the pot below what was paid into it, or when an
   income smaller than the spending is draining it. */
function refDeposited(p){
  const total = Math.max(1, mo(p.ageNow, p.ageDie));
  const out = [Math.max(0, p.A0)];
  let W = p.A0, C = 0, best = p.A0;             // best = min over k of W(k) - C(k)
  for(let t = 0; t < total; t++){
    const f = refSavings(p, t);
    W = W * (1 + p.rm) + f;
    C += Math.max(0, f);
    if(W - C < best) best = W - C;
    out.push(Math.max(0, best + C));
  }
  return out;
}

/* The section 2 balance: accumulate to the retirement age, then draw down.
   Written from step 4 and step 5 directly, so the page's own lifetimeSeries is
   never consulted. */
function refLifetime(p){
  const accM = refAccMonths(p), total = Math.max(1, mo(p.ageNow, p.ageDie));
  const out = [p.A0];
  let W = p.A0;
  for(let t = 0; t < total; t++){
    const f = refIncome(p, t) - refSpend(p, t);
    if(t < accM) W = W * (1 + p.rm) + f;
    else { W += f; W *= (1 + p.rm); }
    out.push(W);
  }
  return out;
}

// Textbook annuity-due / perpetuity-due, the third formulation. Used on plans
// with no pension, so the net draw is the full retirement expense throughout.
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
  try { localStorage.setItem('ff-tour-v3-seen', '1'); } catch(_e){}
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

// F12: zero volatility has to collapse the whole stochastic layer exactly, and
//      the band has to wrap the line it is drawn around: the ACCUMULATION, not
//      the drawdown, because section 1 never withdraws.
{
  const ui = Object.assign({}, base, {std: 0, paths: 200});
  const r = await engine(ui, `(function(){
    var mc = F.accumBands(P, {paths: ui.paths, seed: ui.seed});
    var acc = F.accumulationSeries(P).balance;
    var years = mc.years, worst = 0, y;
    for(y = 0; y <= years; y++){
      worst = Math.max(worst,
        Math.abs(mc.bands.p10[y] - mc.bands.p90[y]),
        Math.abs(mc.bands.p50[y] - acc[y * 12]));
    }
    return {worst: worst};
  })()`);
  check('F12 at zero volatility every percentile equals the deterministic accumulation',
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
  const band = n => `F.accumBands(P, {paths: 300, seed: ${n}}).bands.p10.join(',')`;
  const a = await engine(ui, band(12345));
  const b = await engine(ui, band(12345));
  const c = await engine(ui, band(999));
  check('F13 the same seed reproduces the same band exactly', a === b);
  check('F13b a different seed moves it', a !== c);
  const s1 = await engine(ui, 'F.potRequirements(P, {paths: 300, seed: 12345}).successAt(F.requiredPot(P, P.ageRetire))');
  const s2 = await engine(ui, 'F.potRequirements(P, {paths: 300, seed: 12345}).successAt(F.requiredPot(P, P.ageRetire))');
  const s3 = await engine(ui, 'F.potRequirements(P, {paths: 300, seed: 999}).successAt(F.requiredPot(P, P.ageRetire))');
  check('F13c and the success rate with it', s1 === s2 && s1 !== s3, `${s1} / ${s3}`);
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

/* F22: the only nonsense age left. The retirement age is a slider pinned
   between the other two, so it can no longer be out of order; a life
   expectancy before today still can be, and is an input error rather than an
   impossible plan. Both ENDS of the slider have to be ordinary answers, not
   errors: stopping today and never stopping are exactly the questions a
   sensitivity control is for. */
{
  const bad = await page.evaluate(() =>
    window.__FF.diagnose(Object.assign({}, window.__FF.UI_DEFAULTS, {ageNow: 60, ageDie: 50, ageRetire: 55})));
  const today = await page.evaluate(() =>
    window.__FF.diagnose(Object.assign({}, window.__FF.UI_DEFAULTS, {ageNow: 30, ageRetire: 30, ageDie: 90})));
  const never = await page.evaluate(() =>
    window.__FF.diagnose(Object.assign({}, window.__FF.UI_DEFAULTS, {ageNow: 30, ageRetire: 90, ageDie: 90})));
  check('F22 a life expectancy before today is an input error', bad.status === 'invalid', bad.message);
  check('F22b retiring at your age now is a real answer, not an error',
    today.status !== 'invalid', today.status + ': ' + (today.message || ''));
  check('F22c and so is never retiring at all',
    never.status !== 'invalid', never.status + ': ' + (never.message || ''));
}

console.log('\n── Page and presentation ──');

/* F47: what the reader sees having touched nothing. Future dollars are the
   DEFAULT now, because they are the figures the account will actually read and
   a reader who has never met real terms takes them at face value; today's
   money is the opt-in behind Show Present Value. This block runs before
   anything below flips that toggle, so it reads the page as it loads. */
{
  const r = await page.evaluate(() => {
    const box = document.getElementById('showReal');
    const row = box && box.closest('.toggle-row');
    const path = window.__charts.find(c => c.data.datasets.some(d => d.label === 'Investment outcome'));
    const plotted = path.data.datasets.find(d => d.label === 'Investment outcome').data.map(p => p.y);
    const res = window.__FF.last;
    return {
      exists: !!box,
      oldGone: !document.getElementById('showNominal'),
      checked: box ? box.checked : null,
      defaulted: window.__FF.UI_DEFAULTS.showReal,
      label: row ? row.querySelector('.toggle-label').textContent.trim() : '',
      plottedLast: plotted[plotted.length - 1],
      realLast: res.acc[Math.min(res.years * 12, res.acc.length - 1)],
      infl: res.P.inflation, years: res.years,
      yTitle: path.options.scales.y.title.text
    };
  });
  check('F47 the money toggle asks for Present Value, not for the money of the day',
    r.exists && r.oldGone && /present value/i.test(r.label), r.label);
  check('F47b and it is off on arrival, so future\u2019s money is what you see first',
    r.checked === false && r.defaulted === false,
    `checked ${r.checked}, default ${r.defaulted}`);
  check('F47c so the plotted balance carries the inflation factor unasked',
    close(r.plottedLast, r.realLast * Math.pow(1 + r.infl, r.years), 0.01),
    `${r.plottedLast.toFixed(0)} plotted vs ${r.realLast.toFixed(0)} real`);
  /* The money mode is named in a currency-agnostic way: the tool draws in
     whatever currency the reader picked, so it cannot call it dollars. */
  check('F47d and the axis names which money that is, without naming a currency',
    /future['\u2019]s money/.test(r.yTitle) && !/dollar/i.test(r.yTitle), r.yTitle);
}

/* F48: the page is two boards now, and each figure has to sit with the
   question it answers. Section 1 never mentions a retirement age; section 2 is
   entirely about the one on the slider, and says which age that is on each of
   its cards. The confidence pot still has no card of its own but still rides
   under the probability it belongs to. */
{
  const r = await page.evaluate(() => {
    const lab = sel => Array.from(document.querySelectorAll(sel)).map(x => x.textContent.trim().replace(/\s*\?$/, ''));
    return {
      boards: Array.from(document.querySelectorAll('.board')).map(b => ({
        id: b.id,
        kicker: (b.querySelector('.board-kicker') || {}).textContent,
        heading: (b.querySelector('h2') || {}).textContent,
        cards: b.querySelectorAll('.metrics .metric').length,
        labels: lab('#' + b.id + ' .metrics .metric .label'),
        charts: b.querySelectorAll('.chart-card').length,
        tables: b.querySelectorAll('.detail-section').length
      })),
      card: !!document.getElementById('mConfPot'),
      succSub: document.getElementById('mSuccessSub').textContent,
      kickers: document.querySelectorAll('.board-kicker').length,
      ledes: document.querySelectorAll('.board-lede').length,
      sub1: document.getElementById('chart1Sub').textContent,
      sub2: document.getElementById('chart2Sub'),
      sub3: document.getElementById('chart3Sub'),
      canvases: Array.from(document.querySelectorAll('#boardCash canvas')).map(c => c.id),
      wraps: document.querySelectorAll('#boardCash .canvas-wrap').length
    };
  });
  const path = r.boards.find(b => b.id === 'boardPath') || {labels: []};
  const cash = r.boards.find(b => b.id === 'boardCash') || {labels: []};
  check('F48 the page is split into a Path to freedom board and a Cashflows board',
    r.boards.length === 2 && /path to freedom/i.test(path.heading || '') && /cashflows/i.test(cash.heading || ''),
    r.boards.map(b => b.id + ': ' + b.heading).join(' | '));
  check('F48b each board owns its own cards, and only one owns the table',
    path.cards === 3 && cash.cards === 4 && path.charts === 1 && cash.charts === 1 &&
    path.tables === 0 && cash.tables === 1,
    `path ${path.cards} cards / ${path.charts} charts / ${path.tables} tables, ` +
    `cash ${cash.cards} cards / ${cash.charts} charts / ${cash.tables} tables`);
  /* The flows and the balance they leave behind are ONE picture in one card,
     on one canvas: a separate balance card, with a second canvas and a second
     set of export buttons, is what used to let a year drift out of line
     between them. */
  check('F48b2 the cashflow flows and balance share one card, one wrap and one canvas',
    cash.charts === 1 && r.wraps === 1 && r.canvases.length === 1 && r.canvases[0] === 'ddChart' &&
    r.sub3 === null,
    `${r.wraps} wraps, canvases: ${r.canvases.join(', ') || 'none'}, old balance subtitle ${r.sub3 === null ? 'gone' : 'still there'}`);
  // The retirement age is seeded from the plan's freedom age, so read what the
  // slider actually holds rather than pinning the figure it used to default to.
  const ra = await page.evaluate(() => Math.round(window.__FF.UI.ageRetire));
  const namesAge = new RegExp('\\bat ' + ra + '\\b');
  check('F48c section 1 never names a retirement age, section 2 names it on every card that has one',
    !path.labels.some(l => namesAge.test(l)) && cash.labels.filter(l => namesAge.test(l)).length === 2,
    `age ${ra} — path: ${path.labels.join(' | ')}  ||  cash: ${cash.labels.join(' | ')}`);
  check('F48d the "Pot for that confidence" card is still gone, but not the figure',
    !r.card && /confidence (needs|is out of reach)/.test(r.succSub), r.succSub);
  /* The standing explanations are gone: the kicker that numbered each board,
     the lede under each heading, and the subtitle sentence that repeated what
     the legend and the cards already say. A subtitle now only carries what
     changes with the plan. */
  check('F48e the board kickers and ledes are gone',
    r.kickers === 0 && r.ledes === 0, `${r.kickers} kickers, ${r.ledes} ledes`);
  /* A subtitle now carries ONLY what the picture cannot show for itself: the
     retirement rule, the two shaded sides and the balance pane are all in the
     legend already, and "you can pinch out for the rest" is something a chart
     teaches by being draggable. The cashflow chart has no subtitle left at
     all — every sentence it carried restated the slider's own labels or the
     "Left at" card — so the element is gone rather than left empty, and the
     path chart keeps the one note the picture cannot show: a band running off
     an axis sized to the expected outcome. */
  check('F48f and no subtitle repeats what the legend or the chart already says',
    !/no withdrawal/i.test(r.sub1) && !/the view opens on/i.test(r.sub1) &&
    !/below zero/i.test(r.sub1) && r.sub2 === null,
    `1: "${r.sub1}" // 2: ${r.sub2 === null ? 'gone' : 'still there'}`);
}

/* F49: a point between two yearly samples is a DATE, not a decimal. The
   crossing lands mid-year, so its x is 2039.1666…, and every place that used
   to print that number now names the month it falls in. */
{
  const r = await page.evaluate(() => {
    const c = window.__charts.find(ch => ch.data.datasets.some(d => d.label === 'Investment outcome'));
    const marker = c.data.datasets.filter(d => d.label === 'Financially free');
    const x = marker.length ? marker[marker.length - 1].data[0].x : null;
    const cb = c.options.plugins.tooltip.callbacks;
    const whole = window.__FF.last.thisYear + 10;
    cb.afterBody([{parsed: {x}, dataset: {label: 'Investment outcome'}}]);
    return {
      x,
      fracTitle: x == null ? null : cb.title([{parsed: {x}}]),
      wholeTitle: cb.title([{parsed: {x: whole}}]),
      hover: document.getElementById('hover1').textContent,
      freeSub: document.getElementById('mFreeAgeSub').textContent,
      tick: c.options.scales.x.ticks.callback(x)
    };
  });
  check('F49 the crossing really does fall between two yearly samples',
    r.x != null && Math.abs(r.x - Math.round(r.x)) > 1e-6, String(r.x));
  check('F49b so the tooltip names the month instead of printing a decimal year',
    /^[A-Z][a-z]{2} \d{4},/.test(r.fracTitle || '') && !/\d\.\d/.test(r.fracTitle || ''),
    r.fracTitle);
  check('F49c while a whole year is still just the year', /^\d{4},/.test(r.wholeTitle || ''),
    r.wholeTitle);
  check('F49d the hover line under the chart says the same thing',
    /^[A-Z][a-z]{2} \d{4},/.test(r.hover) && !/\d\.\d/.test(r.hover.split('—')[0]),
    r.hover.split('—')[0].trim());
  check('F49e and so does the age you reach freedom in',
    /[A-Z][a-z]{2} \d{4}\.$/.test(r.freeSub) && !/in \d+\.\d/.test(r.freeSub), r.freeSub);
  check('F49f the axis tick itself stays a whole year', /^\d{4}$/.test(String(r.tick)), String(r.tick));
}

/* F50: zooming the x axis re-fits the y axis. Without it the window the reader
   asked for is drawn against a scale built for the other fifty years, which is
   a flat line however interesting the slice is. */
{
  const r = await page.evaluate(() => {
    const path = window.__charts.find(c => c.data.datasets.some(d => d.label === 'Investment outcome'));
    // One cashflow chart now, carrying both panes: the flows on `y` and the
    // balance they leave behind on `yBal`, stacked over one pair of x axes.
    const cash = window.__charts.find(c => c.data.datasets.some(d => d.label === 'Income'));
    const sx = path.options.scales.x;
    const openedAt = {min: sx.min, max: sx.max};
    // Each chart opens on its own window now, so the cashflow fitters are
    // probed against the cashflow chart's x scale, not the path chart's.
    const cxs = cash.options.scales.x;
    // $fitY is a MAP of scale id to fitter: one entry on the path chart, two
    // on the cashflow chart, one per stacked pane.
    const lim = path.options.plugins.zoom.limits.x;
    const full = path.$fitY.y(lim.min, lim.max);      // the whole plan, zoomed out
    const early = path.$fitY.y(sx.min, sx.min + 5);
    const mid = path.$fitY.y(sx.min, sx.min + 25);
    const cashFull = cash.$fitY.y(cxs.min, cxs.max);
    const cashEarly = cash.$fitY.y(cxs.min, cxs.min + 5);
    const balFull = cash.$fitY.yBal(cxs.min, cxs.max);
    const balEarly = cash.$fitY.yBal(cxs.min, cxs.min + 5);
    /* Drive the wiring, not just the arithmetic. The refit is a chart plugin
       rather than a zoom callback, because it has to run inside the update the
       gesture triggers: the zoom plugin writes the window it is about to draw
       into the x scale's options, so replaying that here is the real path.
       `SharedZoom.refit` is that same fitter, driven from outside an update. */
    const plug = (path.config.plugins || []).filter(p => p.id === 'sharedYFit');
    const refit = c => window.SharedZoom.refit(c);
    sx.min = openedAt.min; sx.max = openedAt.min + 5;
    refit(path);
    const zoomed = {min: path.options.scales.y.min, max: path.options.scales.y.max};
    sx.min = openedAt.min; sx.max = openedAt.max;
    refit(path);
    const restored = {min: path.options.scales.y.min, max: path.options.scales.y.max};
    // And pinching all the way out to the whole plan sizes the axis to it.
    sx.min = lim.min; sx.max = lim.max;
    refit(path);
    const widest = {min: path.options.scales.y.min, max: path.options.scales.y.max};
    sx.min = openedAt.min; sx.max = openedAt.max;
    refit(path);
    // BOTH panes of the cashflow chart are refitted in the one pass, so a zoom
    // cannot leave the balance scaled for a window it is no longer showing.
    const cashPlug = (cash.config.plugins || []).filter(p => p.id === 'sharedYFit');
    const cashOpened = {min: cxs.min, max: cxs.max};
    cxs.min = cashOpened.min; cxs.max = cashOpened.min + 5;
    refit(cash);
    const bothMoved = {y: cash.options.scales.y.max, y2: cash.options.scales.yBal.max};
    cxs.min = cashOpened.min; cxs.max = cashOpened.max;
    refit(cash);
    return {
      full, early, mid, cashFull, cashEarly, balFull, balEarly, bothMoved,
      zoomed, restored, widest, opened: path.$fitY.y(openedAt.min, openedAt.max), openedAt,
      plugged: plug.length === 1 && cashPlug.length === 1 &&
               Object.keys(cash.$fitY).sort().join(',') === 'y,yBal',
      /* A second update chasing the first is what leaves the lines drawn on
         the old scale, so the REFIT may not hang off the gesture. Neither
         chart has a zoom callback at all now: there is no second chart left to
         carry an x window across to, and the refit was never the gesture's job
         in the first place. */
      noCallbacks: !path.options.plugins.zoom.zoom.onZoom &&
                   !path.options.plugins.zoom.pan.onPan &&
                   !cash.options.plugins.zoom.zoom.onZoom &&
                   !cash.options.plugins.zoom.pan.onPan
    };
  });
  check('F50 both charts carry the y-axis refit as a plugin, the cashflow one for both its panes',
    r.plugged && r.noCallbacks,
    r.plugged ? 'sharedYFit on both, two panes fitted, nothing chasing the gesture' : 'missing');
  check('F50b a narrower window gets a narrower axis, never a wider one',
    r.early.max < r.mid.max && r.mid.max < r.full.max,
    `5y ${r.early.max.toFixed(0)} < 25y ${r.mid.max.toFixed(0)} < all ${r.full.max.toFixed(0)}`);
  check('F50c and the early years are no longer a smear along the bottom',
    r.early.max < r.full.max / 4,
    `${r.early.max.toFixed(0)} vs ${r.full.max.toFixed(0)}`);
  check('F50d a zoom writes those bounds onto the axis, inside its own update',
    close(r.zoomed.max, r.early.max, 1e-6) && close(r.zoomed.min, r.early.min, 1e-6),
    `${r.zoomed.min.toFixed(0)}..${r.zoomed.max.toFixed(0)}`);
  check('F50e and zooming back out restores the window the chart opened on',
    close(r.restored.max, r.opened.max, 1e-6), `${r.restored.max.toFixed(0)} vs ${r.opened.max.toFixed(0)}`);
  check('F50e2 while pinching all the way out sizes the axis to the whole plan',
    close(r.widest.max, r.full.max, 1e-6) && r.full.max > r.opened.max * 4,
    `${r.widest.max.toFixed(0)} across the whole plan vs ${r.opened.max.toFixed(0)} on the opening view`);
  /* The PATH chart's balance is floored at zero, because going under there
     means the pot is being eaten before retirement and a line compounding into
     the red would flatten everything real. The cashflow balance is not: see
     F44f3, where running out is the answer the chart is being asked for. */
  check('F50f the path balance axis never opens below an empty pot', r.full.min >= 0 && r.early.min >= 0,
    `${r.full.min.toFixed(0)} / ${r.early.min.toFixed(0)}`);
  check('F50g the cash flow axis keeps zero and drops its ceiling to the years shown',
    r.cashEarly.min === 0 && r.cashEarly.max < r.cashFull.max / 2,
    `first five years ${r.cashEarly.max.toFixed(0)} vs whole plan ${r.cashFull.max.toFixed(0)}`);
  check('F50i the balance pane is refitted in the same pass, not left behind',
    close(r.bothMoved.y, r.cashEarly.max, 1e-6) && close(r.bothMoved.y2, r.balEarly.max, 1e-6) &&
    r.balEarly.max < r.balFull.max && r.balEarly.min === 0,
    `flow ${r.bothMoved.y.toFixed(0)}, balance ${r.bothMoved.y2.toFixed(0)} (whole plan ${r.balFull.max.toFixed(0)})`);

  /* The reset button repaints a second time on purpose. resetZoom restores the
     window and the refit sizes y to it, but the tick set Chart.js builds on
     that pass is the zoomed one, and it is left stranded across an axis it no
     longer belongs to. The plain update afterwards is what rebuilds it. */
  const calls = await page.evaluate(() => {
    const spy = (label, btn) => {
      const out = [];
      const c = window.__charts.find(ch => ch.data.datasets.some(d => d.label === label));
      const keep = {reset: c.resetZoom, update: c.update};
      c.resetZoom = t => out.push(label + ' resetZoom(' + t + ')');
      c.update = t => out.push(label + ' update(' + t + ')');
      document.getElementById(btn).click();
      c.resetZoom = keep.reset; c.update = keep.update;
      return out;
    };
    const cash = window.__charts.find(ch => ch.data.datasets.some(d => d.label === 'Income'));
    return {
      path: spy('Investment outcome', 'resetZoom1'),
      cash: spy('Income', 'resetZoom2'),
      // The flows and the balance are datasets of the SAME chart, so one reset
      // is the whole picture: there is no second chart left to leave behind.
      oneChart: cash.data.datasets.some(d => d.label === 'Balance'),
      resets: document.querySelectorAll('#boardCash [id^="resetZoom"]').length
    };
  });
  const repaints = c => c.length === 2 && c.every(x => /\(none\)$/.test(x)) &&
                        /resetZoom/.test(c[0]) && /update/.test(c[1]);
  check('F50h resetting the zoom repaints once more, so the ticks are rebuilt too',
    repaints(calls.path), calls.path.join(', ') || 'nothing called');
  check('F50j the one cashflow reset puts both panes back, because they are one chart',
    repaints(calls.cash) && calls.oneChart && calls.resets === 1,
    `${calls.resets} reset button(s), flows and balance on one chart: ${calls.oneChart}, ` +
    `⟳: ${calls.cash.join(', ') || 'nothing called'}`);
}

/* Everything from here down reads the plan in today's money, because the
   replay is written in real terms. The default is pinned by F47 above, once,
   before this flips it. */
await page.evaluate(() => { document.getElementById('showReal').checked = true; window.__FF.render(); });

// F23: real to nominal is exactly the inflation factor, to the cent.
{
  await page.evaluate(() => { document.getElementById('showReal').checked = true; window.__FF.render(); });
  const real = await page.evaluate(() => {
    const c = window.__charts.find(c => c.data.datasets.some(d => d.label === 'Investment outcome'));
    return c.data.datasets.find(d => d.label === 'Investment outcome').data.map(p => p.y);
  });
  await page.evaluate(() => { document.getElementById('showReal').checked = false; window.__FF.render(); });
  const nominal = await page.evaluate(() => {
    const c = window.__charts.find(c => c.data.datasets.some(d => d.label === 'Investment outcome'));
    return c.data.datasets.find(d => d.label === 'Investment outcome').data.map(p => p.y);
  });
  const infl = (await page.evaluate(() => window.__FF.last.P.inflation));
  let worst = 0;
  for(let y = 0; y < real.length; y++){
    worst = Math.max(worst, Math.abs(nominal[y] - real[y] * Math.pow(1 + infl, y)));
  }
  check('F23 future’s money is today’s money times the inflation factor',
    worst < 0.01, `largest gap ${worst.toExponential(2)}`);
  await page.evaluate(() => { document.getElementById('showReal').checked = true; window.__FF.render(); });
}

// F24: the chart starts at the current year and the current age, as promised.
{
  const r = await page.evaluate(() => {
    const c = window.__charts.find(c => c.data.datasets.some(d => d.label === 'Investment outcome'));
    const ds = c.data.datasets.find(d => d.label === 'Investment outcome');
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
  const before = await page.evaluate(() => window.__charts[0].data.datasets.find(d => d.label === 'Investment outcome').borderColor);
  await page.click('#themeToggle');
  await page.waitForTimeout(120);
  const after = await page.evaluate(() => window.__charts[0].data.datasets.find(d => d.label === 'Investment outcome').borderColor);
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
  await page.evaluate(() => window.__FF.resetToDefaults());
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => ({
    ageRetire: window.__FF.UI.ageRetire,
    need: window.__FF.last.needAtRetire,
    shown: document.getElementById('mNeed').textContent,
    freeAge: window.__FF.last.ffAge,
    freeShown: document.getElementById('mFreeAge').textContent,
    rows: document.querySelectorAll('#tableWrap tbody tr').length,
    years: window.__FF.last.years,
    verdict: document.getElementById('verdict').className
  }));
  /* The defaults no longer carry a retirement age: it is seeded from the plan's
     own freedom age. Replay at the age the page landed on, or this would be
     comparing two different questions. */
  const p = refParams(Object.assign({}, base, {ageRetire: r.ageRetire}));
  check('F31 the amount needed on the page matches the replay',
    close(r.need, refRequired(p, p.ageRetire), 0.01),
    `at ${r.ageRetire}: page ${r.need.toFixed(2)} vs replay ${refRequired(p, p.ageRetire).toFixed(2)}`);
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
    document.getElementById('showReal').checked = true;
    window.__FF.render();
  });
  const r = await page.evaluate(() => {
    const c = window.__charts.find(c => c.data.datasets.some(d => d.label === 'Investment outcome'));
    const s = c.options.scales, z = c.options.plugins.zoom;
    const pts = c.data.datasets.find(d => d.label === 'Investment outcome').data;
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
  check('F34c the two x axes are always in step, whatever window they are on',
    r.ageBounds[0] === r.xBounds[0] && r.ageBounds[1] === r.xBounds[1],
    `x ${r.xBounds.join('..')}, age ${r.ageBounds.join('..')}`);
  /* The crossing lands in the first third of most plans while the investment
     keeps compounding for decades after it, so a path chart opened on all
     sixty years puts its own answer a pixel above the axis. It opens on the
     years that decide it instead, with the rest of the plan one pinch away —
     which is what makes the DATA span and the OPENING span two different
     things, and why `limits` is pinned to the data rather than to the view. */
  check('F34d the path chart opens on the years that decide the answer, not on all sixty',
    r.xBounds[0] === r.dataBounds[0] && r.xBounds[1] < r.dataBounds[1] &&
    r.xBounds[1] > r.thisYear + (r.ffAge - r.ageNow),
    `opens ${r.xBounds.join('..')} of ${r.dataBounds.join('..')}, crossing at ${(r.thisYear + r.ffAge - r.ageNow).toFixed(1)}`);
  check('F35 zooming out reaches the whole plan, and stops there, on both axes',
    !!r.limits && r.limits.x.min === r.dataBounds[0] && r.limits.x.max === r.dataBounds[1] &&
    r.limits.xAge.min === r.dataBounds[0] && r.limits.xAge.max === r.dataBounds[1],
    r.limits ? `x ${r.limits.x.min}..${r.limits.x.max}, minRange ${r.limits.x.minRange}` : 'no limits set');
  check('F35b and zooming in stops before the span is meaningless',
    r.limits.x.minRange > 0 && r.limits.x.minRange <= r.dataBounds[1] - r.dataBounds[0],
    `minRange ${r.limits.x.minRange}`);
  /* The cashflow chart has no such problem: income and spending are flows, not
     a compounding stock, so all sixty years of them fit on one scale. It opens
     on the whole plan, and has to, or the retirement would be off the page. */
  {
    const c2 = await page.evaluate(() => {
      const c = window.__charts.find(ch => ch.data.datasets.some(d => d.label === 'Income'));
      const pts = c.data.datasets.find(d => d.label === 'Income').data;
      return {view: [c.options.scales.x.min, c.options.scales.x.max],
              data: [pts[0].x, pts[pts.length - 1].x],
              lim: [c.options.plugins.zoom.limits.x.min, c.options.plugins.zoom.limits.x.max]};
    });
    check('F35c the cashflow chart opens on the whole plan, because a flow does not compound away',
      c2.view[0] === c2.data[0] && c2.view[1] === c2.data[1] &&
      c2.lim[0] === c2.data[0] && c2.lim[1] === c2.data[1],
      `opens ${c2.view.join('..')} of ${c2.data.join('..')}`);
  }

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
    $('showReal').checked = true; window.__FF.render();
    const real = rows(), note = $('inflationNote').textContent.trim();
    const heads = Array.from(document.querySelectorAll('#tableWrap thead th')).map(t => t.textContent.trim());
    $('showReal').checked = false; window.__FF.render();
    const nom = rows();
    // The pot needed lost its table column when the table became a pure cash
    // flow statement, so it is read off the curve the page actually plots,
    // which is the same figure in whatever money is on screen.
    const needLine = () => {
      const c = window.__charts.find(ch => ch.data.datasets.some(d => d.label === 'Pot needed to stop here'));
      return c.data.datasets.find(d => d.label === 'Pot needed to stop here').data.map(p => p.y);
    };
    const nomNeed = needLine();
    const csv = window.__FF.last;
    $('showReal').checked = true; window.__FF.render();
    const realNeed = needLine();
    return {
      note, heads, i: window.__FF.last.P.inflation,
      realExpense: real.map(x => x.expense), nomExpense: nom.map(x => x.expense),
      realNeed, nomNeed,
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
    check('F37c and in future’s money it is the real cost times the inflation factor',
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

/* F41: the deposited line against the running-minimum identity. It belongs to
   the SECTION 1 chart now, where nothing is ever withdrawn, so it is every cent
   paid in held down by the balance — and it is read off accumulationSeries,
   not off the drawdown, which no longer carries one at all. */
for(const [name, extra] of [
  ['the target plan', {}],
  ['a plan retiring at the freedom age', {ageRetire: 47}],
  ['a plan with a pension bridge', {ageRetire: 55, pensionOn: true, pensionStartAge: 67, pensionAmount: 29000}],
  ['the net income model', {savingsMode: 'income', savings: 90000}]
]){
  const ui = Object.assign({}, base, extra);
  const p = refParams(ui);
  const r = await engine(ui, `(function(){
    var s = F.accumulationSeries(P);
    return {dep: Array.from(s.deposited), bal: Array.from(s.balance)};
  })()`);
  const want = refDeposited(p);
  let worst = 0, at = -1;
  for(let t = 0; t < want.length; t++){
    const d = Math.abs(r.dep[t] - want[t]);
    if(d > worst){ worst = d; at = t; }
  }
  check(`F41 money deposited matches the replay identity — ${name}`,
    worst < 0.01, `largest gap ${worst.toExponential(2)}${at >= 0 ? ' at month ' + at : ''}`);
}

/* F41b: the line the section 1 chart actually needs. It is what you have put
   in, so it never exceeds the pot and never goes negative, and under the
   savings model it only ever climbs — there is no retirement on that chart to
   turn it down. The gap between it and the balance is the growth, which is the
   one thing the line exists to show. */
{
  const ui = Object.assign({}, base, {ageRetire: 47});
  const r = await engine(ui, `(function(){
    var s = F.accumulationSeries(P), t;
    var everFalls = false, overBalance = false, negative = false;
    for(t = 1; t < s.deposited.length; t++){
      if(s.deposited[t] < s.deposited[t - 1] - 1e-9) everFalls = true;
      if(s.deposited[t] > s.balance[t] + 1e-6) overBalance = true;
      if(s.deposited[t] < -1e-9) negative = true;
    }
    var last = s.deposited.length - 1;
    return {everFalls: everFalls, overBalance: overBalance, negative: negative,
            dep: s.deposited[last], bal: s.balance[last], A0: P.A0};
  })()`);
  check('F41b under the savings model it only ever climbs, because nothing is withdrawn',
    !r.everFalls, `falls somewhere: ${r.everFalls}`);
  check('F41c and never exceeds the pot, nor falls below nothing',
    !r.overBalance && !r.negative, `over balance ${r.overBalance}, negative ${r.negative}`);
  check('F41d the gap to the balance is the growth, and by the end it dwarfs the deposits',
    r.bal > r.dep * 3, `deposited ${r.dep.toFixed(0)} of a ${r.bal.toFixed(0)} balance`);
}

// F41e: at any month it is the starting assets plus everything paid in, as
//       long as the balance never dips below that. Closed form, no loop.
{
  const ui = Object.assign({}, base, {ageRetire: 47});
  const p = refParams(ui);
  for(const n of [0, 120, 360, 719]){
    let paid = 0;
    for(let t = 0; t < n; t++) paid += Math.max(0, refSavings(p, t));
    const got = await engine(ui, `F.accumulationSeries(P).deposited[${n}]`);
    check(`F41e at month ${n} it is the starting assets plus every cent paid in`,
      close(got, p.A0 + paid, 0.01), `page ${got.toFixed(2)} vs replay ${(p.A0 + paid).toFixed(2)}`);
  }
}

/* F41f: the net income model is the one case where the line can be held down,
   because a year that spends more than it earns takes money OUT of the pot.
   The deposits stop climbing there and the clamp against the balance bites. */
{
  // Earning less than you spend, but on a pot big enough to absorb it: not one
  // cent is ever paid IN, so the line is dead flat at the starting assets.
  const ui = Object.assign({}, base, {savingsMode: 'income', savings: 55000, expense: 60000,
                                     growth: 0, assets: 2000000, ret: 6, inflation: 2.5});
  const r = await engine(ui, `(function(){
    var s = F.accumulationSeries(P), t, flat = 0, over = false;
    for(t = 1; t < s.deposited.length; t++){
      if(Math.abs(s.deposited[t] - s.deposited[t - 1]) < 1e-9) flat++;
      if(s.deposited[t] > s.balance[t] + 1e-6) over = true;
    }
    var last = s.deposited.length - 1;
    return {flat: flat, over: over, dep: s.deposited[last], bal: s.balance[last],
            A0: P.A0, months: last, minBal: Math.min.apply(null, Array.from(s.balance))};
  })()`);
  check('F41f an income below the spending never adds a cent, so the line is flat',
    r.flat === r.months && close(r.dep, r.A0, 0.01),
    `${r.flat} of ${r.months} months flat, ending at ${r.dep.toFixed(0)} against ${r.A0.toFixed(0)} paid in`);
  check('F41g and it stays inside the pot it is part of',
    !r.over && r.minBal > 0, `deposited ${r.dep.toFixed(0)}, balance ${r.bal.toFixed(0)}`);
}

// F41i: a pot the spending has eaten takes what you put in with it. The floor
//       at zero is what says "once the pot is spent, so is every cent of it".
{
  const ui = Object.assign({}, base, {savingsMode: 'income', savings: 20000, expense: 60000, assets: 50000, ret: 4});
  const r = await engine(ui, `(function(){
    var s = F.accumulationSeries(P), last = s.deposited.length - 1;
    return {dep: s.deposited[last], bal: s.balance[last]};
  })()`);
  check('F41i a pot eaten to nothing leaves nothing of what you put in',
    r.bal < 0 && Math.abs(r.dep) < 1e-9,
    `balance ${r.bal.toFixed(0)}, deposited ${r.dep.toFixed(0)}`);
}

/* F41h: the drawdown carries NO deposited line any more. It was the one place
   the old single chart mixed the two questions, and the section it belonged to
   does not ask it. */
{
  const r = await engine(base, `(function(){
    var s = F.lifetimeSeries(P);
    return {keys: Object.keys(s), hasDep: s.deposited !== undefined};
  })()`);
  check('F41h the drawdown series carries no deposited line at all',
    !r.hasDep, r.keys.join(', '));
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
    // The replay is written in real terms, so the table is read there too. The
    // page's own default is future’s money; F47 pins that separately.
    return F.tableRows(F.compute(Object.assign({}, F.UI_DEFAULTS, u, {showReal: true})));
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
  const idx = re => heads.findIndex(h => re.test(h));
  const bal = idx(/^Balance$/), i = idx(/^Income$/), e = idx(/^Expense$/),
        sv = idx(/^Saved/), g = idx(/^Growth$/);
  check('F42c the row reads as a statement: Balance, then Income, Expense, Saved, Growth',
    bal >= 0 && i === bal + 1 && e === i + 1 && sv === e + 1 && g === sv + 1 &&
    heads.length === 7,
    heads.join(' | '));
  check('F42d and the pot and the gap are gone, because this table is the cash flow',
    !heads.some(h => /pot|gap|or spent/i.test(h)), heads.join(' | '));
}

/* ── The two charts, after the overhaul ──
   Path to freedom is three lines and a band and NEVER withdraws. Cashflows is
   income against spending, and underneath it in the same chart, on a stacked
   scale of its own, the balance they leave behind — both at the age on the
   slider. Everything below is read off the chart configs the page built. */
{
  const r = await page.evaluate(() => {
    const res = window.__FF.last;
    const path = window.__charts.find(c => c.data.datasets.some(d => d.label === 'Investment outcome'));
    const cash = window.__charts.find(c => c.data.datasets.some(d => d.label === 'Income'));
    const label = (c, l) => c.data.datasets.find(d => d.label === l);
    const dep = label(path, 'Money deposited');
    // The balance is a dataset of the cashflow chart now, on a stacked scale
    // under the flows rather than on a chart of its own.
    const inc = label(cash, 'Income'), spend = label(cash, 'Spending'), bal = label(cash, 'Balance');
    const xs = d => d.data.map(p => p.x);
    const acc = label(path, 'Investment outcome');
    const retIdx = Math.round(res.P.ageRetire - res.P.ageNow);
    return {
      years: res.years, thisYear: res.thisYear,
      ageNow: res.P.ageNow, ageDie: res.P.ageDie, ageRetire: res.P.ageRetire, retIdx,
      // Section 1
      pathLabels: path.data.datasets.map(d => d.label),
      pathSpan: [xs(acc)[0], xs(acc).slice(-1)[0]],
      accSeries: acc.data.map(p => p.y),
      hasDeposited: !!dep,
      depSpan: dep ? [dep.data[0].y, dep.data.slice(-1)[0].y] : null,
      depAtRetire: dep ? dep.data[retIdx].y : null,
      pathNeverDips: acc.data.every((p, k) => k === 0 || p.y >= acc.data[k - 1].y - 1e-6),
      pathHasBalanceAxis: !path.options.scales.y2,
      hasMedianLine: !!label(path, 'Median outcome'),
      legend1: Array.from(document.querySelectorAll('#legend1 .legend-item')).map(x => x.textContent.trim()),
      // Section 2
      cashLabels: cash.data.datasets.map(d => d.label),
      cashSpan: [xs(inc)[0], xs(inc).slice(-1)[0]],
      incFirst: inc.data[0].y,
      incAfterRetire: inc.data[retIdx + 1].y,
      spendFlat: spend.data.every(p => Math.abs(p.y - spend.data[0].y) < 0.01),
      fill: inc.fill,
      fillTargetLabel: cash.data.datasets[inc.fill.target] ? cash.data.datasets[inc.fill.target].label : null,
      yTitle: cash.options.scales.y.title.text,
      /* Two stacked panes on ONE chart: the flows on `y`, the balance on
         `yBal` below it. Neither is a second axis on the other's plot area,
         which is what a right-hand axis would be. */
      scaleIds: Object.keys(cash.options.scales),
      cashHasSecondAxis: !!cash.options.scales.y2,
      flowAxisOf: inc.yAxisID, balAxisOf: bal.yAxisID,
      flowStack: {stack: cash.options.scales.y.stack, weight: cash.options.scales.y.stackWeight},
      balStack: {stack: cash.options.scales.yBal.stack, weight: cash.options.scales.yBal.stackWeight},
      gapStack: cash.options.scales.yBalGap ? {
        stack: cash.options.scales.yBalGap.stack,
        weight: cash.options.scales.yBalGap.stackWeight,
        ticks: cash.options.scales.yBalGap.ticks.display,
        grid: cash.options.scales.yBalGap.grid.display,
        border: cash.options.scales.yBalGap.border.display
      } : null,
      balTitle: cash.options.scales.yBal.title.text,
      balSpan: [xs(bal)[0], xs(bal).slice(-1)[0]],
      balSeries: bal ? bal.data.map(p => p.y) : null,
      balPeakIdx: bal ? bal.data.reduce((best, p, k) => p.y > bal.data[best].y ? k : best, 0) : null,
      marker: !!label(cash, 'Retire at 60'),
      // One rule down the whole picture: the same entry, drawn once per pane.
      markerAxes: cash.data.datasets.filter(d => d.label === 'Retire at 60').map(d => d.yAxisID),
      stillHasPotLines: !!(label(cash, 'Your pot') || label(cash, 'Your pot after a crash')),
      legend2: Array.from(document.querySelectorAll('#legend2 .legend-item')).map(x => x.textContent.trim()),
      legend3: !!document.getElementById('legend3'),
      /* Every entry with the swatch it draws. SharedLegend stashes the spec on
         the element, which is both what the page draws the swatch from and
         what the exporters read back, so reading it here checks all three at
         once. */
      legend2Specs: Array.from(document.querySelectorAll('#legend2 .legend-item')).map(el => {
        const spec = JSON.parse(el.dataset.swatch);
        return {label: el.querySelector('.legend-label').textContent.trim(),
                type: spec.type, color: spec.color, fill: spec.fill, fill2: spec.fill2,
                rects: el.querySelectorAll('svg rect').length};
      })
    };
  });

  // ── Section 1 ──
  check('F43 the path chart runs the whole plan, not just the run-up',
    r.pathSpan[0] === r.thisYear && r.pathSpan[1] === r.thisYear + r.years,
    `${r.pathSpan.join('..')} for ages ${r.ageNow}..${r.ageDie}`);
  check('F43b it plots exactly three lines and a band: pot needed, investment outcome, money deposited',
    r.pathLabels.filter(l => /Worst 10%|Best 10%/.test(l)).length === 2 &&
    r.pathLabels.includes('Pot needed to stop here') &&
    r.pathLabels.includes('Investment outcome') &&
    r.pathLabels.includes('Money deposited') &&
    !r.hasMedianLine,
    r.pathLabels.join(' | '));
  check('F43c and it never withdraws: the investment line only ever climbs, retirement age or not',
    r.pathNeverDips && r.depSpan[1] > r.depAtRetire + 1,
    `deposits ${r.depAtRetire.toFixed(0)} at ${r.ageRetire} still climbing to ${r.depSpan[1].toFixed(0)} at ${r.ageDie}`);
  check('F43d the legend says which line is which, and that nothing is drawn on',
    r.legend1.some(l => /pot needed to stop here/i.test(l)) &&
    r.legend1.some(l => /never drawn on/i.test(l)) &&
    r.legend1.some(l => /money deposited/i.test(l)) &&
    r.legend1.some(l => /range of outcomes/i.test(l)),
    r.legend1.join(' | '));
  check('F43e and it carries one y axis, because everything on it is a balance',
    r.pathHasBalanceAxis, r.pathHasBalanceAxis ? 'single axis' : 'a second axis appeared');

  // ── Section 2 ──
  check('F44 the cashflow chart plots income against spending',
    r.spendFlat === true && r.incFirst > 0,
    `income starts ${r.incFirst.toFixed(0)}, spending flat ${r.spendFlat}`);
  check('F44b over the same years as the first, so the two sections line up',
    r.cashSpan[0] === r.thisYear && r.cashSpan[1] === r.thisYear + r.years,
    r.cashSpan.join('..'));
  check('F44c income falls away once you stop, with no pension to replace it',
    r.incAfterRetire === 0, `${r.incAfterRetire} the year after retiring`);
  check('F44d and the gap between them is filled on both sides, in two colours',
    !!r.fill && r.fillTargetLabel === 'Spending' && !!r.fill.above && !!r.fill.below &&
    r.fill.above !== r.fill.below,
    r.fill ? `to ${r.fillTargetLabel}, ${r.fill.above} / ${r.fill.below}` : 'no fill');
  check('F44e the flow axis says it is a yearly flow, not a balance',
    /a year/i.test(r.yTitle || ''), r.yTitle);
  /* A stock and a flow cannot share a scale: a balance in the millions drawn
     over a spending line in the tens of thousands leaves both against rules
     belonging to neither. They are one picture though, so the balance is a
     STACKED PANE under the flows in the same chart rather than a second axis
     across the same plot area — and rather than a second chart, which is what
     used to let a year drift out of line between them. */
  check('F44f the balance has a pane of its own under the flows, not an axis across them',
    !r.cashHasSecondAxis && r.flowAxisOf === 'y' && r.balAxisOf === 'yBal' &&
    r.flowStack.stack && r.flowStack.stack === r.balStack.stack &&
    r.balStack.weight < r.flowStack.weight && /^Balance/.test(r.balTitle || ''),
    `flows on ${r.flowAxisOf} (weight ${r.flowStack.weight}), balance on ${r.balAxisOf} ` +
    `(weight ${r.balStack.weight}), stack "${r.flowStack.stack}", titled "${r.balTitle}"`);
  /* Chart.js stacks the scales of a group in the order they are DEFINED,
     bottom one first, so the balance pane has to be written onto the options
     before the flow axis or the picture comes out upside down. */
  check('F44f2 and it is defined first, which is what puts it underneath',
    r.scaleIds.indexOf('yBal') < r.scaleIds.indexOf('y') && r.scaleIds.indexOf('yBal') > -1,
    r.scaleIds.join(', '));
  /* A seam between the two panes, so they read as two pictures rather than
     one picture with a line drawn through the middle of it. It is a third
     scale in the same stack, sitting between the two, that plots nothing and
     draws nothing: no ticks, no gridlines, no border, only its share of the
     height — and a small share, or it stops being a seam and starts being
     empty chart. */
  check('F44f4 a gap separates the two panes',
    !!r.gapStack && r.gapStack.stack === r.flowStack.stack &&
    r.gapStack.weight > 0 && r.gapStack.weight < r.balStack.weight / 2,
    r.gapStack ? `weight ${r.gapStack.weight} in stack "${r.gapStack.stack}" ` +
                 `against ${r.balStack.weight} for the balance` : 'no gap scale');
  check('F44f4b and the gap itself draws nothing at all',
    !!r.gapStack && r.gapStack.ticks === false && r.gapStack.grid === false &&
    r.gapStack.border === false,
    r.gapStack ? `ticks ${r.gapStack.ticks}, grid ${r.gapStack.grid}, border ${r.gapStack.border}` : 'no gap scale');
  check('F44f4c and it sits between the two panes, not above or below both',
    r.scaleIds.indexOf('yBal') < r.scaleIds.indexOf('yBalGap') &&
    r.scaleIds.indexOf('yBalGap') < r.scaleIds.indexOf('y'),
    r.scaleIds.join(', '));
  check('F44f2b and it spans exactly the same years, so a year lines up between the two',
    r.balSpan[0] === r.cashSpan[0] && r.balSpan[1] === r.cashSpan[1],
    `${r.balSpan.join('..')} vs ${r.cashSpan.join('..')}`);
  /* The shaded gap is ONE quantity — what income leaves over — and the two
     colours are its sign, so it is one legend entry with a swatch split down
     the middle rather than two entries a reader has to add up. */
  /* ONE ENTRY FOR THE FILL, and the check has to survive a rename. Banning
     the old wording would not: split it back into "Surplus" and "Deficit" and
     a label test passes while the key has two entries again. So the invariant
     is stated structurally instead: exactly one entry carries the colours the
     flows are filled with, it carries BOTH of them, and it is drawn as one
     block split in two. A split into two entries gives each of them one
     colour, and every clause here fails at once.

     The balance pane has a shaded block of its own now, the range of
     balances, so "one filled block in the key" is no longer the invariant:
     that one is pinned by F66 and set aside here by what it carries: the
     balance's hue, never either flow colour. */
  const fills = [r.fill && r.fill.above, r.fill && r.fill.below];
  const carries = c => r.legend2Specs.filter(x => x.fill === c || x.fill2 === c);
  const blocks = r.legend2Specs.filter(x => x.type === 'area' && fills.some(c => x.fill === c || x.fill2 === c));
  const bandBlocks = r.legend2Specs.filter(x => x.type === 'area' && !blocks.includes(x));
  check('F44g the key names each line once, the fill once, and the range of balances',
    r.legend2Specs.length === 6 &&
    r.legend2Specs.some(x => /^income$/i.test(x.label)) &&
    r.legend2Specs.some(x => /^spending$/i.test(x.label)) &&
    r.legend2Specs.some(x => /retire at/i.test(x.label)) &&
    r.legend2Specs.some(x => /^balance/i.test(x.label)) &&
    r.legend2Specs.some(x => /^savings\/withdrawal$/i.test(x.label)) &&
    bandBlocks.length === 1 && bandBlocks.every(x => /range of balances/i.test(x.label)),
    r.legend2Specs.map(x => x.label).join(' | '));
  check('F44g2 exactly one entry stands for the shaded gap, whatever it is called',
    blocks.length === 1 && blocks[0].rects === 2,
    blocks.length === 1
      ? `"${blocks[0].label}", drawn as ${blocks[0].rects} halves`
      : `${blocks.length} blocks carry the flow colours: ${blocks.map(x => x.label).join(', ')}`);
  /* And it is the chart's own two colours, read off the dataset's fill rather
     than restated, so recolouring the chart cannot leave a stale key behind —
     nor can either colour wander off into an entry of its own. */
  check('F44g2b and it carries both of the colours the chart actually fills with',
    blocks.length === 1 && fills.every(c => !!c) && fills[0] !== fills[1] &&
    fills.every(c => carries(c).length === 1 && carries(c)[0] === blocks[0]),
    `chart fills ${fills.join(' / ')}; key block has ${blocks.length === 1 ? blocks[0].fill + ' / ' + blocks[0].fill2 : 'n/a'}`);
  /* One card, one key: the balance rides in the same legend as the flows, and
     the retirement rule — drawn once in each pane — is ONE entry, so hiding it
     takes the whole rule down the picture rather than half of it. */
  check('F44g3 one key covers both panes, and the retirement rule is one entry drawn in each',
    !r.legend3 && r.legend2.some(l => /^balance/i.test(l)) &&
    r.legend2.filter(l => /retire at 60/i.test(l)).length === 1 &&
    r.markerAxes.length === 2 && r.markerAxes.includes('y') && r.markerAxes.includes('yBal') &&
    !r.legend2.some(l => /right axis/i.test(l)),
    `${r.legend2.join(' | ')}  ||  rule on ${r.markerAxes.join(' + ')}`);
  /* The key is grouped by pane rather than each label saying where to look:
     an "Upper panel:" row for the flows and the retirement rule, a "Lower
     panel:" row for the balance and everything read against it. The export
     carries the same rows, each led by its name, and a group whose entries
     are all hidden drops out of it whole. */
  {
    const g = await page.evaluate(() => {
      const F = window.__FF;
      const groups = [...document.querySelectorAll('#legend2 .legend-group')].map(el => ({
        head: el.querySelector('.legend-group-label').textContent.trim(),
        items: [...el.querySelectorAll('.legend-item')].map(i => i.textContent.trim())
      }));
      const measure = s => s.length * 6;
      const rows = () => F.legendRowsOf('legend2', measure, 4000, 22, 7, 20)
        .map(r => ({head: r.head, items: r.items.map(i => i.label), width: r.width, headW: r.headW}));
      const all = rows();
      // Hide every lower-panel entry and read the export rows again.
      const lower = [...document.querySelectorAll('#legend2 .legend-group')][1];
      const clicks = [...lower.querySelectorAll('.legend-item')];
      clicks.forEach(el => el.click());
      const upperOnly = rows();
      clicks.forEach(el => el.click());
      return {groups, all, upperOnly, grouped: document.getElementById('legend2').classList.contains('legend-grouped'),
              flat1: document.querySelectorAll('#legend1 .legend-group').length};
    });
    const up = g.groups[0], lo = g.groups[1];
    check('F44g4 the key is grouped by pane: the flows under "Upper panel", the balance under "Lower panel"',
      g.grouped && g.groups.length === 2 && up.head === 'Upper panel:' && lo.head === 'Lower panel:' &&
      ['Income', 'Spending', 'Savings/Withdrawal'].every(l => up.items.includes(l)) && up.items.some(l => /^retire at/i.test(l)) &&
      lo.items[0] === 'Balance' && lo.items.some(l => /^range of balances/i.test(l)) &&
      !g.groups.some(x => x.items.some(l => /panel/i.test(l))) && g.flat1 === 0,
      g.groups.map(x => `${x.head} ${x.items.join(', ')}`).join('  ||  '));
    check('F44g5 and the export carries the same rows, each led by its pane, with a hidden pane left out whole',
      g.all.length === 2 && g.all[0].head === 'Upper panel:' && g.all[1].head === 'Lower panel:' &&
      JSON.stringify(g.all[0].items) === JSON.stringify(up.items) &&
      JSON.stringify(g.all[1].items) === JSON.stringify(lo.items) &&
      g.all.every(r => r.headW > 0 && r.width > r.headW) &&
      g.upperOnly.length === 1 && g.upperOnly[0].head === 'Upper panel:',
      g.all.map(r => `${r.head} ${r.items.length} entries`).join(', ') + `; lower hidden: ${g.upperOnly.length} row`);
  }
  /* The shape the two sections exist for, and the one identity that ties them
     together: the cashflow balance IS the section 1 accumulation right up to
     the retirement month, and is strictly below it from the next month on,
     because one keeps paying in and the other has started taking out. They are
     two answers to two questions, and they agree exactly where they should. */
  {
    const same = await page.evaluate(() => {
      const res = window.__FF.last, accM = window.__FF.accMonths(res.P);
      let worstBefore = 0, minGapAfter = Infinity;
      for(let t = 0; t <= accM; t++) worstBefore = Math.max(worstBefore, Math.abs(res.acc[t] - res.det[t]));
      for(let t = accM + 1; t < res.det.length; t++) minGapAfter = Math.min(minGapAfter, res.acc[t] - res.det[t]);
      return {worstBefore, minGapAfter, accM};
    });
    check('F44h the cashflow balance is the section 1 line up to the retirement month, and below it after',
      same.worstBefore < 0.01 && same.minGapAfter > 0,
      `largest gap before ${same.worstBefore.toExponential(2)}, smallest gap after ${same.minGapAfter.toFixed(0)}`);
  }
  // And on a plan that is not overfunded, the balance really does top out the
  // year you stop, which is the picture the section is for.
  {
    const peak = await page.evaluate(() => {
      const F = window.__FF;
      const res = F.compute(Object.assign({}, F.UI_DEFAULTS, {ageRetire: 50, savings: 20000, assets: 50000, showReal: true}));
      const det = F.tableRows(res).map(x => x.balance);
      let best = 0;
      det.forEach((v, k) => { if(v > det[best]) best = k; });
      return {best, retIdx: Math.round(res.P.ageRetire - res.P.ageNow), last: det[det.length - 1], top: det[best]};
    });
    check('F44h2 and on a plan that is not overfunded it tops out the year you stop',
      peak.best === peak.retIdx && peak.last < peak.top,
      `peak at year ${peak.best}, retirement at ${peak.retIdx}`);
  }
  /* THE BALANCE IS PLOTTED AS IT COMES OUT. A plan that runs out does not stop
     at nothing: the engine keeps compounding the shortfall, which is what the
     table and the "Left at" card report, and the chart used to be the one
     place on the page that flattened it against the axis instead. So the
     plotted series is checked against the engine's own figures, negatives and
     all, and the axis has to open under zero to show it. No caption says so:
     a line drawn below the axis, with a negative "Left at", is the statement. */
  {
    const r2 = await page.evaluate(() => {
      const F = window.__FF;
      const $ = id => document.getElementById(id);
      const before = {sav: $('savings').value, ass: $('assets').value, ret: $('ageRetire').value};
      $('savings').value = '2,000'; $('assets').value = '0'; $('ageRetire').value = '45';
      F.render();
      const cash = window.__charts.find(c => c.data.datasets.some(d => d.label === 'Income'));
      const bal = cash.data.datasets.find(d => d.label === 'Balance');
      const res = F.last;
      const rows = F.tableRows(res).map(x => x.balance);
      const worst = bal.data.reduce((w, p, k) => Math.max(w, Math.abs(p.y - rows[k])), 0);
      const out = {
        lowest: Math.min.apply(null, bal.data.map(p => p.y)),
        tableLowest: Math.min.apply(null, rows),
        worst,
        /* The bound is no longer written into the configuration — a
           configured bound is a USER bound, which Chart.js restores after the
           refit has run. The fitter the chart hands the plugin IS the axis, so
           the opening bound is what it returns for the opening window. */
        axisMin: cash.options.plugins.sharedYFit.fit.yBal(
          cash.options.scales.x.min, cash.options.scales.x.max).min,
        left: $('mLeft').textContent,
        leftSub: $('mLeftSub').textContent
      };
      $('savings').value = before.sav; $('assets').value = before.ass; $('ageRetire').value = before.ret;
      F.render();
      return out;
    });
    check('F44f3 a pot that runs out is drawn below zero, exactly as the table reports it',
      r2.lowest < 0 && r2.worst < 0.01 && close(r2.lowest, r2.tableLowest, 0.01),
      `chart floor ${r2.lowest.toFixed(0)}, table floor ${r2.tableLowest.toFixed(0)}, ` +
      `largest disagreement ${r2.worst.toExponential(2)}`);
    check('F44f3b and the axis opens under zero to show it, with "Left at" reading the shortfall',
      r2.axisMin < 0 && /^−/.test(r2.left) && /ran out/i.test(r2.leftSub),
      `axis opens at ${r2.axisMin.toFixed(0)}, "Left at" reads ${r2.left} — "${r2.leftSub}"`);
  }
  check('F44i and the retirement year is marked, not left to be counted',
    r.marker, r.marker ? 'marked' : 'no marker');
  check('F44j the four-pot drawdown it replaced is still gone', !r.stillHasPotLines,
    r.stillHasPotLines ? 'pot lines still plotted' : 'replaced');
}

console.log('\n── The range of balances ──');

/* F66: the cashflow balance carries a shaded range now, from the worst tenth
   of the simulated futures to the best. It is the "Chance it works" card drawn
   out, so it is held to the card rather than to itself:

   - the band is REPLAYED here from the replay's own flows and its own
     recurrence (refLifetime for the pot, refIncome/refSpend for the draws),
     taking nothing from the page but the random draws themselves, which are
     the page's by definition;
   - the paths the replay finds funded (never below zero after a draw, and
     on the goal's terminal condition at the horizon) are counted, and that
     count has to BE the card's figure, path for path. The card is scored by
     the page's affine required-pot solve; the replay never solves a pot at
     all, it only walks the money forward, so agreement is two formulations
     agreeing on which futures work;
   - and the shading has to say what the card says: on a plan whose failed
     futures stay failed, the worst-tenth edge ends above zero (above the
     bequest, for Leave a Legacy) exactly when more than nine futures in ten
     work. */

// Nearest rank, the k-th smallest with k = ceil(q N), written from the
// definition rather than copied from the page.
const refRank = (sorted, q) => sorted[Math.min(sorted.length, Math.max(1, Math.ceil(q * sorted.length))) - 1];

/* Walk every simulated future through the replay's own arithmetic. `draws`
   are the page's growth factors, one array per path, long enough for both the
   chart (to the life expectancy) and the card (to the goal's horizon).
   Returns the four band edges per plotted year and how many futures work. */
function refFan(p, draws){
  const accM = refAccMonths(p), total = Math.max(1, mo(p.ageNow, p.ageDie));
  if(accM >= total) return null;
  const line = refLifetime(p);
  const years = Math.max(1, Math.round(total / 12)), start = Math.floor(accM / 12);
  const at = [];
  for(let y = start; y <= years; y++) at.push(Math.min(y * 12, total));
  const cols = at.map(() => []);
  const n = Math.max(0, mo(p.ageRetire, refHorizon(p)));
  // The goal's terminal condition, from the goal itself: nothing for Just Die,
  // the bequest for Leave a Legacy, and for Die Rich a perpetuity-due on
  // whatever the net draw has settled to by the horizon.
  let target = p.mode === 'legacy' ? Math.max(0, p.legacy) : 0;
  if(p.mode === 'rich'){
    const net = p.Xr - refPension(p, refHorizon(p));
    target = net <= 0 ? 0 : (p.rm > 0 ? net * (1 + p.rm) / p.rm : Infinity);
  }
  let funded = 0;
  const finals = [];
  draws.forEach(g => {
    // The chart's path: the expected balance up to the retirement month, then
    // this future's returns on what is left after each month's draw.
    const path = line.slice(0, accM + 1);
    let W = line[accM];
    for(let t = accM; t < total; t++){
      W += refIncome(p, t) - refSpend(p, t);
      W *= g[t - accM];
      path.push(W);
    }
    at.forEach((m, k) => cols[k].push(path[m]));
    finals.push(path[total]);
    // The card's question, asked forward: does the pot this plan reaches
    // cover this future? A pot is a sum of money, so it has to start at zero
    // or more, never dip under zero after a draw, and land on the target.
    const tol = 1e-9 * Math.max(1, Math.abs(line[accM]));
    let V = line[accM], ok = V >= -tol;
    for(let t = 0; t < n && ok; t++){
      V -= p.Xr - refPension(p, p.ageRetire + t / 12);
      if(V < -tol) ok = false;
      V *= g[t];
    }
    if(ok && !(V >= target - 1e-9 * Math.max(1, Math.abs(line[accM]), Math.abs(target)))) ok = false;
    if(ok) funded++;
  });
  const edges = {p10: [], p90: []};
  cols.forEach(c => {
    c.sort((a, b) => a - b);
    edges.p10.push(refRank(c, 0.10)); edges.p90.push(refRank(c, 0.90));
  });
  return {edges, start, years, funded, finals, line};
}

// The page's own band, its card, and the draws it scored the card on.
const pageFan = ui => page.evaluate(u => {
  const F = window.__FF;
  const full = Object.assign({}, F.UI_DEFAULTS, u);
  const res = F.compute(full), P = res.P;
  const accM = F.accMonths(P), total = res.det.length - 1;
  const h = P.mode === 'rich' ? Math.max(F.RICH_HORIZON_AGE, P.ageDie) : P.ageDie;
  const len = Math.max(1, F.months(P.ageRetire, h), total - accM);
  const draws = [];
  for(let k = 0; k < full.paths; k++){
    draws.push(Array.from(F.growthSeries(P, F.mulberry32(F.deriveSeed(full.seed, 'pot' + k)), len)));
  }
  const pot = res.potAtRetire, sorted = res.reqs.sorted;
  // Futures whose own required pot sits within a hair of the plan's pot: the
  // only ones on which two formulations may round to different answers.
  const hair = 1e-7 * Math.max(1, Math.abs(pot));
  return {
    dd: res.dd, draws, paths: full.paths,
    success: res.successAtPlan, borderline: sorted.filter(w => Math.abs(w - pot) <= hair).length,
    mode: P.mode, pensionOn: P.pensionOn
  };
}, ui);

const worstRel = (a, b) => {
  let w = 0;
  for(let k = 0; k < Math.max(a.length, b.length); k++){
    const x = a[k], y = b[k];
    if(typeof x !== 'number' || typeof y !== 'number') return Infinity;
    w = Math.max(w, Math.abs(x - y) / Math.max(1, Math.abs(y)));
  }
  return w;
};

{
  const plans = {
    'defaults, Just Die': {},
    'Leave a Legacy': {mode: 'legacy', legacy: 500000},
    'Die Rich on a frozen pension that starts after retirement':
      {mode: 'rich', pensionOn: true, pensionStartAge: 67, pensionAmount: 20000, pensionIndexed: false, ret: 8},
    'net income model, indexed pension from 60': {savingsMode: 'income', savings: 120000, savingsPeriod: 'yearly',
      pensionOn: true, pensionStartAge: 60, pensionAmount: 15000},
    'stopping today': {ageRetire: 30, assets: 2500000},
    'a volatile portfolio': {std: 30},
    'a plan that runs out': {savings: 2000, assets: 0, ageRetire: 45}
  };
  const bandBad = [], cardBad = [], lineBad = [], orderBad = [];
  const cardDetail = [];
  for(const [name, over] of Object.entries(plans)){
    const ui = Object.assign({}, base, {paths: 400}, over);
    const pg = await pageFan(ui);
    const rf = refFan(refParams(ui), pg.draws);
    if(!pg.dd || !rf){ bandBad.push(`${name}: no band`); continue; }
    const w = Math.max(...['p10', 'p90'].map(q => worstRel(pg.dd.bands[q], rf.edges[q])));
    if(!(w < 1e-9) || pg.dd.startYear !== rf.start) bandBad.push(`${name} (${w.toExponential(1)})`);
    const want = Math.round(pg.success * pg.paths);
    if(Math.abs(rf.funded - want) > pg.borderline) cardBad.push(`${name}: replay ${rf.funded}, card ${want}`);
    cardDetail.push(`${want}/${pg.paths}`);
    // The fan opens ON the expected line: every edge equals it at the first year.
    const y0 = rf.start, onLine = rf.line[Math.min(y0 * 12, rf.line.length - 1)];
    if(!['p10', 'p90'].every(q => Math.abs(pg.dd.bands[q][0] - onLine) <= 1e-6 * Math.max(1, Math.abs(onLine))))
      lineBad.push(name);
    for(let k = 0; k < pg.dd.bands.p10.length; k++){
      const b = pg.dd.bands;
      if(!(b.p10[k] <= b.p90[k])){ orderBad.push(`${name} year ${k}`); break; }
    }
  }
  const nPlans = Object.keys(plans).length;
  check(`F66 every edge of the band matches the replay, year by year, on ${nPlans} plans`,
    bandBad.length === 0, bandBad.join(', ') || 'agrees to 1e-9 everywhere');
  check('F66b the futures the replay finds funded ARE the "Chance it works" figure, path for path',
    cardBad.length === 0, cardBad.join(', ') || `agrees on every plan: ${cardDetail.join(', ')}`);
  check('F66c the fan opens on the expected balance, the year the draws begin',
    lineBad.length === 0, lineBad.join(', ') || 'every edge starts on the line');
  check('F66d and the edges never cross: the worst 10% always under the best 10%',
    orderBad.length === 0, orderBad.join(', ') || 'ordered every year');
}

// F66e: the shading says what the card says. With no pension a future that
// runs out stays out, so the share of futures under zero at the life
// expectancy is exactly the share the card says fail, and the worst-tenth edge
// ends above zero exactly when more than nine futures in ten work. Swept over
// the whole slider, so the chance runs from nothing to everything. Leave a
// Legacy is the same sweep against the bequest instead of zero: a future that
// never goes under ends on or above the bequest exactly when it is funded.
for(const [mode, over] of [['Just Die', {}], ['Leave a Legacy', {mode: 'legacy', legacy: 500000}]]){
  const bad = [], seen = [];
  for(let ar = 35; ar <= 75; ar += 1){
    const ui = Object.assign({}, base, {paths: 400, ageRetire: ar}, over);
    const pg = await pageFan(ui);
    if(!pg.dd) continue;
    const p = refParams(ui), rf = refFan(p, pg.draws);
    const floor = p.mode === 'legacy' ? p.legacy : 0;
    const failShare = rf.finals.filter(v => v < floor - 1e-6).length / pg.paths;
    const last = pg.dd.bands.p10[pg.dd.bands.p10.length - 1];
    const s = pg.success;
    seen.push(Math.round(s * 100));
    if(Math.abs(failShare - (1 - s)) > pg.borderline / pg.paths + 1e-12)
      bad.push(`retire ${ar}: ${(failShare * 100).toFixed(1)}% short vs ${((1 - s) * 100).toFixed(1)}% failing`);
    if((last >= floor - 1e-6) !== (s > 0.9)) bad.push(`retire ${ar}: worst 10% ends at ${last.toFixed(0)} on ${(s * 100).toFixed(1)}%`);
  }
  check(`F66e ${mode}: the band ends short in exactly the futures the card counts as failing`,
    bad.length === 0 && Math.min(...seen) === 0 && Math.max(...seen) === 100,
    bad.slice(0, 3).join(', ') || `swept ${seen.length} retirement ages, chance ${Math.min(...seen)}%..${Math.max(...seen)}%`);
}

// F66f: at zero volatility there is one future, so every edge IS the expected
// balance, to the cent, and so is what the chart plots.
{
  const r = await page.evaluate(() => {
    const F = window.__FF, $ = id => document.getElementById(id);
    const was = {std: $('std').value, real: $('showReal').checked};
    $('std').value = '0'; $('showReal').checked = false;
    F.render();
    const cash = F.charts.cashflows, get = l => cash.data.datasets.find(d => d.label === l);
    const bal = get('Balance');
    const byX = {}; bal.data.forEach(p => { byX[p.x] = p.y; });
    let worst = 0, n = 0;
    ['Balance, best 10%', 'Balance, worst 10%'].forEach(l => {
      get(l).data.forEach(p => { worst = Math.max(worst, Math.abs(p.y - byX[p.x])); n++; });
    });
    $('std').value = was.std; $('showReal').checked = was.real;
    F.render();
    return {worst, n};
  });
  check('F66f at zero volatility every plotted edge is the expected balance, to the cent',
    r.n > 0 && r.worst < 0.01, `${r.n} points, largest gap ${r.worst.toExponential(2)}`);
}

// F66g: what is plotted is the engine's band in the money on screen, in both
// moneys, on the balance pane, over the same years as the balance line.
for(const real of [false, true]){
  await page.evaluate(v => { document.getElementById('showReal').checked = v; window.__FF.render(); }, real);
  const ui = Object.assign({}, DEFAULTS, await page.evaluate(() => window.__FF.readInputs()));
  const pg = await pageFan(ui);
  const rf = refFan(refParams(ui), pg.draws);
  const r = await page.evaluate(() => {
    const F = window.__FF, cash = F.charts.cashflows;
    const get = l => cash.data.datasets.find(d => d.label === l);
    const pick = d => ({axis: d.yAxisID, xs: d.data.map(p => p.x), ys: d.data.map(p => p.y),
                        noAutoFit: !!d.noAutoFit, fill: d.fill, bg: d.backgroundColor, order: d.order});
    const bal = get('Balance');
    return {
      showReal: F.last.ui.showReal, infl: F.last.P.inflation, thisYear: F.last.thisYear,
      balXs: bal.data.map(p => p.x), balOrder: bal.order, balFill: bal.fill,
      b10: pick(get('Balance, best 10%')), w10: pick(get('Balance, worst 10%')),
      idx: ['Balance, best 10%', 'Balance, worst 10%'].map(l => cash.data.datasets.findIndex(d => d.label === l)),
      bands: cash.data.datasets.filter(d => /^Balance, (best|worst)/.test(d.label)).length
    };
  });
  const scaleOf = x => r.showReal ? 1 : Math.pow(1 + r.infl, x - r.thisYear);
  const want = (edges, xs) => xs.map((x, k) => edges[k] * scaleOf(x));
  const err = Math.max(worstRel(r.b10.ys, want(rf.edges.p90, r.b10.xs)), worstRel(r.w10.ys, want(rf.edges.p10, r.w10.xs)));
  check(`F66g the plotted band is the replay in ${real ? 'today\u2019s' : 'future\u2019s'} money`,
    r.showReal === real && err < 1e-9, `largest relative gap ${err.toExponential(2)}`);
  if(real) continue;   // the rest reads the same structure in either money
  const sameYears = [r.b10, r.w10].every(d =>
    d.axis === 'yBal' && d.xs[0] === r.thisYear + rf.start && d.xs[d.xs.length - 1] === r.balXs[r.balXs.length - 1]);
  check('F66h one band, on the balance pane, from the retirement year to the last year the balance is drawn',
    r.bands === 2 && sameYears, `${r.bands} edges, ${r.b10.xs[0]}..${r.b10.xs[r.b10.xs.length - 1]} on ${r.b10.axis}, balance ends ${r.balXs[r.balXs.length - 1]}`);
  /* One fill, from the upper edge down to the lower, and the line drawn over
     it. The shading replaces the line's old fill to zero, which would have
     laid a second shade of the same blue under the band. */
  check('F66i the band is filled from its upper edge to its lower one, under the line',
    r.b10.fill === r.idx[1] && r.w10.fill === false && r.b10.order > r.balOrder && r.w10.order > r.balOrder &&
    r.balFill === false, `best 10% fills to #${r.b10.fill}, line fill ${r.balFill}`);
}

/* F66j: what the balance pane is sized to. The line and zero are what it is
   read against, so the axis always holds both, on the opening view and zoomed;
   the band only earns a margin of BAND_ROOM (30%) of that span on either side
   and is clipped past it, so a band ten times wider than the line cannot
   flatten it. The margin is what shows a failing tail: a band that dips under
   zero has to open the axis under zero even when the line never goes there. */
{
  const r = await page.evaluate(() => {
    const F = window.__FF, $ = id => document.getElementById(id);
    const was = $('ageRetire').value;
    const out = [];
    for(const ar of [40, 47, 55, 65]){
      $('ageRetire').value = String(ar); F.render();
      const cash = F.charts.cashflows, get = l => cash.data.datasets.find(d => d.label === l);
      const bal = get('Balance').data, lo = get('Balance, worst 10%').data, hi = get('Balance, best 10%').data;
      const x0 = cash.options.scales.x.min, x1 = cash.options.scales.x.max;
      for(const [a, b] of [[x0, x1], [x0 + (x1 - x0) / 2, x1]]){
        const fit = cash.$fitY.yBal(a, b);
        const inWin = arr => arr.filter(p => p.x >= a - 1 && p.x <= b + 1).map(p => p.y);
        const lineLo = Math.min(0, ...inWin(bal)), lineHi = Math.max(0, ...inWin(bal));
        out.push({ar, a, fit, lineLo, lineHi, bandLo: Math.min(...inWin(lo)), bandHi: Math.max(...inWin(hi)),
                  noAuto: get('Balance, worst 10%').noAutoFit && get('Balance, best 10%').noAutoFit});
      }
    }
    $('ageRetire').value = was; F.render();
    return out;
  });
  const bad = [];
  let dips = 0, clipped = 0;
  r.forEach(w => {
    const span = w.lineHi - w.lineLo, eps = 1e-6 * Math.max(1, span);
    const tag = `retire ${w.ar} from ${w.a.toFixed(0)}`;
    if(!(w.fit.min <= w.lineLo + eps && w.fit.max >= w.lineHi - eps)) bad.push(`${tag}: line or zero off the axis`);
    // No further than the line's own padded axis plus the band's margin,
    // replayed from the documented padding: a tenth of the span, 0.6 of it
    // below (never under an empty pot), 2.2 of it above.
    const pad = Math.max(span * 0.1, Math.abs(w.lineHi) * 0.02, 1);
    let lMin = w.lineLo - 0.6 * pad;
    if(w.lineLo >= 0 && lMin < 0) lMin = 0;
    const lMax = w.lineHi + 2.2 * pad, room = 0.3 * (lMax - lMin);
    if(w.fit.min < lMin - room - eps) bad.push(`${tag}: opens too far under (${w.fit.min.toFixed(0)} < ${(lMin - room).toFixed(0)})`);
    if(w.fit.max > lMax + room + eps) bad.push(`${tag}: opens too far over (${w.fit.max.toFixed(0)} > ${(lMax + room).toFixed(0)})`);
    if(w.bandLo < -eps){ dips++; if(!(w.fit.min < 0)) bad.push(`${tag}: band dips under zero but the axis does not`); }
    if(w.bandHi > w.fit.max || w.bandLo < w.fit.min) clipped++;
    if(!w.noAuto) bad.push(`${tag}: band edges not marked noAutoFit`);
  });
  check('F66j the balance pane always holds the line and zero, and the band only a clipped margin past them',
    bad.length === 0 && dips > 0 && clipped > 0,
    bad.slice(0, 3).join(', ') || `${r.length} windows, band under zero in ${dips} and shown under zero in all of them, clipped in ${clipped}`);
}

// F66k: the key. One shaded block in the balance's own hue, and it hides the
// pair of datasets it stands for.
{
  const r = await page.evaluate(() => {
    const F = window.__FF, cash = F.charts.cashflows;
    const items = [...document.querySelectorAll('#legend2 .legend-item')];
    const range = items.find(el => /range of balances, worst 10% to best 10%/i.test(el.textContent));
    const bal = cash.data.datasets.find(d => d.label === 'Balance');
    const vis = () => ['Balance, best 10%', 'Balance, worst 10%']
      .map(l => cash.isDatasetVisible(cash.data.datasets.findIndex(d => d.label === l)));
    const out = {range: range && JSON.parse(range.dataset.swatch), balColor: bal.borderColor,
                 middle: items.some(el => /middle half/i.test(el.textContent))};
    if(range){ range.click(); out.off = vis(); range.click(); }
    out.after = vis();
    return out;
  });
  const hue = c => String(c).slice(0, 7).toLowerCase();
  check('F66k the key carries the band as one block in the balance\u2019s hue',
    !!r.range && r.range.type === 'area' && hue(r.range.fill) === hue(r.balColor) && !r.middle,
    r.range ? `range ${r.range.fill}, line ${r.balColor}` : 'missing');
  check('F66l and the entry hides both edges together',
    JSON.stringify(r.off) === '[false,false]' && JSON.stringify(r.after) === '[true,true]',
    `off ${JSON.stringify(r.off)}, back ${JSON.stringify(r.after)}`);
}

// F66m: the two ends of the slider. Never stopping draws nothing, so there is
// no band and no key for one; stopping today opens the fan on today's assets.
{
  const r = await page.evaluate(() => {
    const F = window.__FF, $ = id => document.getElementById(id);
    const was = $('ageRetire').value;
    const bands = () => F.charts.cashflows.data.datasets.filter(d => /^Balance, (best|worst)/.test(d.label));
    const keys = () => [...document.querySelectorAll('#legend2 .legend-item')].filter(el => /balances/i.test(el.textContent)).length;
    $('ageRetire').value = String(F.last.P.ageDie); F.render();
    const never = {bands: bands().length, keys: keys(), dd: F.last.dd};
    $('ageRetire').value = String(F.last.P.ageNow); F.render();
    const b = bands();
    const today = {bands: b.length, keys: keys(), firstX: b.length ? b[0].data[0].x : null,
                   firstYs: b.map(d => d.data[0].y), assets: F.last.P.A0, thisYear: F.last.thisYear};
    $('ageRetire').value = was; F.render();
    return {never, today};
  });
  check('F66m never stopping draws no range, and keys none',
    r.never.bands === 0 && r.never.keys === 0 && r.never.dd === null,
    `${r.never.bands} band datasets, ${r.never.keys} key entries`);
  check('F66n stopping today opens the fan this year, on the assets you hold today',
    r.today.bands === 2 && r.today.keys === 1 && r.today.firstX === r.today.thisYear &&
    r.today.firstYs.every(v => Math.abs(v - r.today.assets) < 0.01),
    `opens ${r.today.firstX} at ${r.today.firstYs.map(v => v.toFixed(0)).join(' / ')}, assets ${r.today.assets}`);
}

// F66o: the same seed draws the same band, a different one moves it, and the
// draws the band is built on are a prefix of any longer run of them: the band
// takes the card's full horizon so its paths are the card's, and that is only
// true if asking for more months changes none of the ones before.
{
  const ui = Object.assign({}, base, {paths: 200});
  const band = s => `JSON.stringify(F.drawdownBands(P, F.lifetimeSeries(P).balance, {paths: 200, seed: ${s}}).bands)`;
  const a = await engine(ui, band(4242)), b = await engine(ui, band(4242)), c = await engine(ui, band(77));
  const prefix = await engine(ui, `(function(){
    var s = F.growthSeries(P, F.mulberry32(F.deriveSeed(9, 'pot3')), 480);
    var l = F.growthSeries(P, F.mulberry32(F.deriveSeed(9, 'pot3')), 1441);
    for(var i = 0; i < s.length; i++) if(s[i] !== l[i]) return false;
    return true;
  })()`);
  check('F66o the same seed reproduces the band, a different seed moves it, and longer draws share every earlier month',
    a === b && a !== c && prefix === true, `reproducible ${a === b}, moves ${a !== c}, prefix ${prefix}`);
}


/* F66p: Leave a Legacy is funded only if the balance ends on the bequest, so
   the bequest is drawn across the balance pane as a dashed line: in today's
   money it is flat, in future's money it is the bequest in each year's money,
   the way the table and the "Left at" card state it. It is on the axis, it is
   keyed, and the other two goals, which have no bequest, draw none. */
{
  const r = await page.evaluate(() => {
    const F = window.__FF, $ = id => document.getElementById(id);
    const was = {mode: F.UI.mode, real: $('showReal').checked};
    const out = {};
    const setMode = m => { document.querySelector('input[name="ffmode"][value="' + m + '"]').checked = true; };
    for(const [key, mode, real] of [['legacyNom', 'legacy', false], ['legacyReal', 'legacy', true], ['die', 'die', false], ['rich', 'rich', false]]){
      $('showReal').checked = real; setMode(mode); F.render();
      const cash = F.charts.cashflows, d = cash.data.datasets.find(x => x.label === 'Target legacy');
      const bal = cash.data.datasets.find(x => x.label === 'Balance');
      out[key] = {
        mode: F.last.ui.mode, legacy: F.last.P.legacy, infl: F.last.P.inflation, thisYear: F.last.thisYear,
        present: !!d, keyed: [...document.querySelectorAll('#legend2 .legend-item')].some(el => /target legacy/i.test(el.textContent)),
        axis: d && d.yAxisID, dash: d && d.borderDash, color: d && d.borderColor,
        xs: d ? d.data.map(p => p.x) : [], ys: d ? d.data.map(p => p.y) : [], balXs: bal.data.map(p => p.x),
        onAxis: d ? (function(){
          const f = cash.$fitY.yBal(cash.options.scales.x.min, cash.options.scales.x.max);
          return d.data.every(p => p.y >= f.min && p.y <= f.max);
        })() : null
      };
    }
    $('showReal').checked = was.real; setMode(was.mode); F.render();
    return out;
  });
  const L = r.legacyNom, R = r.legacyReal;
  const nomErr = L.ys.reduce((w, y, k) => Math.max(w, Math.abs(y - L.legacy * Math.pow(1 + L.infl, L.xs[k] - L.thisYear))), 0);
  const realErr = R.ys.reduce((w, y) => Math.max(w, Math.abs(y - R.legacy)), 0);
  check('F66p Leave a Legacy draws the bequest as a dashed line on the balance pane, keyed and on the axis',
    L.mode === 'legacy' && L.present && L.keyed && L.axis === 'yBal' && Array.isArray(L.dash) && L.dash.length === 2 &&
    L.onAxis && JSON.stringify(L.xs) === JSON.stringify(L.balXs),
    `${L.present ? 'drawn' : 'missing'} on ${L.axis}, dash ${JSON.stringify(L.dash)}, ${L.xs[0]}..${L.xs[L.xs.length - 1]}`);
  check('F66q at the bequest in each year\u2019s money, and flat in today\u2019s',
    L.present && R.present && nomErr < 0.01 && realErr < 0.01 && L.ys[L.ys.length - 1] > L.ys[0],
    `future's money off by ${nomErr.toExponential(2)}, today's by ${realErr.toExponential(2)}`);
  check('F66r and Just Die and Die Rich, which leave no bequest, draw none',
    r.die.mode === 'die' && r.rich.mode === 'rich' && !r.die.present && !r.rich.present && !r.die.keyed && !r.rich.keyed,
    `die ${r.die.present}, rich ${r.rich.present}`);
}

/* F66s: zero is the line a balance is read against, so the balance pane draws
   it heavier than its other gridlines, in the axis text colour, and every
   other gridline is left as it was. */
{
  const r = await page.evaluate(() => {
    const cash = window.__FF.charts.cashflows, g = cash.options.scales.yBal.grid;
    const at = v => ({tick: {value: v}});
    const tok = n => getComputedStyle(document.body).getPropertyValue(n).trim();
    return {zeroColor: g.color(at(0)), otherColor: g.color(at(1e6)), zeroWidth: g.lineWidth(at(0)),
            otherWidth: g.lineWidth(at(-5e5)), text: tok('--chart-text'), grid: tok('--chart-grid')};
  });
  check('F66s the balance pane draws its zero line heavier, in the axis text colour',
    r.zeroColor === r.text && r.otherColor === r.grid && r.zeroWidth > r.otherWidth,
    `zero ${r.zeroColor} at ${r.zeroWidth}px, others ${r.otherColor} at ${r.otherWidth}px`);
}

console.log('\n── Two sections, one slider ──');

/* ── What the tooltip is pointing at ──
   Chart.js resolves an `index` tooltip by DATA INDEX: nearest element, then
   read that index out of every other dataset. Every series here is one point
   per year EXCEPT the droplines (two points) and the crossing marker (one), so
   hovering either of those asked for index 0 or 1 of the yearly series and the
   tooltip reported the FIRST YEAR of the plan under the hovered year's
   heading — the crossing dot in 2061 showing "Money deposited: $100k", which
   is the balance today. Matching by x VALUE is the fix. */
{
  const r = await page.evaluate(() => {
    const mode = window.Chart.Interaction.modes.ffXValue;
    const path = window.__charts.find(c => c.data.datasets.some(d => d.label === 'Investment outcome'));
    const opts = path.options;
    /* Hand-built metas in exactly the shape that broke: a yearly series, and a
       one-point marker sitting BETWEEN two of its samples. Indices 0 and 1 of
       the yearly series carry deliberately unmistakable values. */
    const years = [{x: 2026, y: 100}, {x: 2027, y: 200}, {x: 2028, y: 300}];
    const marker = [{x: 2027.3, y: 250}];
    const meta = (index, parsed, px) => ({
      index,
      data: parsed.map((p, i) => ({skip: false, getProps: () => ({x: px[i]})})),
      controller: {getParsed: i => parsed[i]}
    });
    const metas = [meta(0, years, [0, 100, 200]), meta(1, marker, [130])];
    const chart = {getSortedVisibleDatasetMetas: () => metas};
    const at = x => mode(chart, {x, y: 0}, {}, false).map(it => it.datasetIndex + ':' + it.index);
    const filter = opts.plugins.tooltip.filter;
    const drop = path.data.datasets.filter(d => d.label === 'Financially free');
    return {
      onYear: at(101),
      onMarker: at(128),
      mode: opts.interaction.mode,
      tipMode: opts.plugins.tooltip.mode,
      filtersDroplines: filter({dataset: {ffTipHide: true}}) === false &&
                        filter({dataset: {label: 'Investment outcome'}}) === true,
      // Two datasets share the crossing's label: the dot, and the rule that
      // drops from it to the axis. Only the dot is a reading.
      dropFlags: drop.map(d => !!d.ffTipHide)
    };
  });
  check('F58 the tooltip is resolved by x value, not by data index',
    r.mode === 'ffXValue' && r.tipMode === 'ffXValue', `${r.mode} / ${r.tipMode}`);
  check('F58b hovering a year reads that year out of the yearly series, and nothing else',
    r.onYear.length === 1 && r.onYear[0] === '0:1', r.onYear.join(', ') || 'nothing');
  check('F58c and hovering the marker between two samples answers for the marker',
    r.onMarker.length === 1 && r.onMarker[0] === '1:0', r.onMarker.join(', ') || 'nothing');
  check('F58d a dropline is a rule, not a reading, so it is filtered out of the tooltip',
    r.filtersDroplines && r.dropFlags.length === 2 &&
    r.dropFlags.filter(Boolean).length === 1,
    `filter ${r.filtersDroplines}, crossing datasets hidden: ${r.dropFlags.join(',')}`);
}

/* ── The hover card is keyed like the chart ──
   Chart.js paints one coloured square per tooltip row whatever the series is
   drawn with, so a dotted line, a shaded band and a ring marker all answered
   the hover as three identical squares while the key beside them showed three
   different marks. The card is the shared one now, and every row's mark comes
   from the SAME spec the key entry is built from, so the two cannot disagree.
   Both are read here: the spec the hover resolves for a dataset against the
   spec stashed on the legend entry that stands for it. */
{
  const r = await page.evaluate(() => {
    const path = window.__charts.find(c => c.data.datasets.some(d => d.label === 'Investment outcome'));
    const tip = path.options.plugins.tooltip;
    const ds = l => path.data.datasets.filter(d => d.label === l && !d.ffTipHide)[0];
    const rowSpec = l => JSON.stringify(window.SharedChartTip.spec(path, {dataset: ds(l), datasetIndex: 0}));
    const keySpec = l => {
      const el = [...document.querySelectorAll('#legend1 .legend-item')]
        .find(e => e.querySelector('.legend-label').textContent.trim().startsWith(l));
      return el ? el.dataset.swatch : null;
    };
    // Nothing the hover can list may resolve to a mark that draws nothing.
    const blank = path.data.datasets
      .filter(d => !d.ffTipHide)
      .filter(d => !window.SharedLegend.markup(window.SharedChartTip.spec(path, {dataset: d, datasetIndex: 0}), 1))
      .map(d => d.label);
    return {
      shared: tip.enabled === false && typeof tip.external === 'function',
      deposited: rowSpec('Money deposited'), depositedKey: keySpec('Money deposited'),
      worst: rowSpec('Worst 10%'), best: rowSpec('Best 10%'), rangeKey: keySpec('Range of outcomes'),
      free: rowSpec('Financially free'), freeKey: keySpec('Financially free at'),
      blank
    };
  });
  check('F62 the hover card is the shared one, not Chart.js\'s row of squares',
    r.shared, r.shared ? 'enabled:false with an external renderer' : 'still the canvas tooltip');
  check('F62b the deposited row is the dotted line the chart draws, exactly as the key shows it',
    r.deposited === r.depositedKey && /"dash":\[2,3\]/.test(r.deposited || ''), r.deposited);
  check('F62c both edges of the band answer with the band itself, not with nothing',
    r.worst === r.rangeKey && r.best === r.rangeKey, `worst ${r.worst} / best ${r.best}`);
  check('F62d and the crossing answers with its ring',
    r.free === r.freeKey && /"shape":"circle"/.test(r.free || ''), r.free);
  check('F62e no series the hover can list draws an empty mark',
    r.blank.length === 0, r.blank.join(', ') || 'every row carries its mark');
}

/* ── One x window, by construction ──
   The flows and the balance they leave behind are one picture, and now one
   chart: a year sits in the same place on both because there is a single pair
   of x axes underneath them. Nothing is carried across between charts any
   more, so nothing can fall out of step — the callbacks that used to mirror
   the window are gone with the second chart, and the path chart, which answers
   a different question on a different opening view, was never in the link. */
{
  const r = await page.evaluate(() => {
    const cash = window.__charts.find(c => c.data.datasets.some(d => d.label === 'Income'));
    const path = window.__charts.find(c => c.data.datasets.some(d => d.label === 'Investment outcome'));
    const win = c => ({x: [c.options.scales.x.min, c.options.scales.x.max],
                       xAge: [c.options.scales.xAge.min, c.options.scales.xAge.max]});
    const home = win(cash), pathHome = win(path);
    // The axes are sized by the refit, not by a configured bound, so the view
    // the chart opens on is read by driving it over the opening window.
    window.SharedZoom.refit(cash);
    const opened = {y: cash.options.scales.y.max, yBal: cash.options.scales.yBal.max};
    // The reader pinches the cashflow chart down to five years mid-plan. Both
    // panes are sized to that window in the one update the gesture triggers.
    ['x', 'xAge'].forEach(id => {
      cash.options.scales[id].min = home.x[0] + 10;
      cash.options.scales[id].max = home.x[0] + 15;
    });
    // The fitter is driven straight, the way a chart refits outside an update.
    window.SharedZoom.refit(cash);
    return {
      charts: window.__charts.length,
      oneChart: !!cash.data.datasets.find(d => d.label === 'Balance'),
      xScales: Object.keys(cash.options.scales).filter(id => /^x/.test(id)).sort(),
      noCallbacks: !cash.options.plugins.zoom.zoom.onZoom && !cash.options.plugins.zoom.pan.onPan &&
                   !path.options.plugins.zoom.zoom.onZoom && !path.options.plugins.zoom.pan.onPan,
      opened, zoomed: {y: cash.options.scales.y.max, yBal: cash.options.scales.yBal.max},
      pathAfter: win(path), pathHome
    };
  });
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  check('F59 the flows and the balance are one chart, so the window is shared by construction',
    r.charts === 2 && r.oneChart && r.noCallbacks,
    `${r.charts} charts, balance on the flow chart ${r.oneChart}, nothing mirroring a window ${r.noCallbacks}`);
  check('F59b and one pair of x axes serves both panes, the calendar year and the age',
    r.xScales.join(',') === 'x,xAge', r.xScales.join(', '));
  check('F59c zooming it sizes BOTH panes to the years shown, in the one update',
    r.zoomed.y < r.opened.y && r.zoomed.yBal < r.opened.yBal,
    `flows ${r.opened.y.toFixed(0)} → ${r.zoomed.y.toFixed(0)}, ` +
    `balance ${r.opened.yBal.toFixed(0)} → ${r.zoomed.yBal.toFixed(0)}`);
  check('F59d while the path chart, which answers the other question, does not move',
    same(r.pathAfter.x, r.pathHome.x), r.pathAfter.x.join('..'));
  // Put the opening window back before anything downstream reads a chart.
  await page.evaluate(() => window.__FF.render());
}

/* ── The marked row in the year-by-year table ──
   The table belongs to Cashflows, where everything is measured at the age on
   the slider, so the row it picks out is the RETIREMENT year. It used to
   highlight the freedom age, which is Path to freedom's answer and cannot be
   read off a table the slider redraws. */
{
  const r = await page.evaluate(() => {
    const res = window.__FF.last;
    const rows = Array.from(document.querySelectorAll('#tableWrap tbody tr'));
    const marked = rows.map((tr, i) => tr.classList.contains('free') ? i : -1).filter(i => i >= 0);
    return {
      marked,
      retIdx: Math.round(res.P.ageRetire - res.P.ageNow),
      freeIdx: res.ffAge == null ? -1 : Math.ceil(res.ffAge - res.P.ageNow),
      markedAge: marked.length === 1 ? rows[marked[0]].children[1].textContent.trim() : null,
      strays: document.querySelectorAll('#tableWrap tr.retire').length,
      sub: document.getElementById('tableSub').textContent,
      // The detail rides in the (i) tip beside the one-line summary.
      subTip: (document.querySelector('#tableSub [data-tip]') || {getAttribute: () => ''})
                .getAttribute('data-tip')
    };
  });
  check('F60 exactly one row is marked, and it is the retirement year',
    r.marked.length === 1 && r.marked[0] === r.retIdx && r.strays === 0,
    `row ${r.marked.join(',')} of retIdx ${r.retIdx}, age ${r.markedAge}`);
  check('F60b which is a different row from the freedom age, so the move is real',
    r.freeIdx >= 0 && r.freeIdx !== r.retIdx,
    `freedom at row ${r.freeIdx}, retirement at row ${r.retIdx}`);
  check('F60c and the note under the table says so',
    /highlighted row is the year you retire/i.test(r.subTip) &&
    !/financially free/i.test(r.subTip), r.subTip.slice(-90));
}

/* ── Nothing on the page explains itself at length ──
   The board kickers, the ledes and the standing subtitle sentences are gone,
   and a tip that runs past a couple of lines is one nobody reads. */
{
  const r = await page.evaluate(() => {
    const tips = Array.from(document.querySelectorAll('[data-tip]'))
      .map(el => el.getAttribute('data-tip'));
    const longest = tips.reduce((a, b) => b.length > a.length ? b : a, '');
    return {count: tips.length, max: longest.length, longest: longest.slice(0, 70),
            over: tips.filter(t => t.length > 300).length};
  });
  check('F61 every tip is short enough to be read where it pops up',
    r.count > 20 && r.over === 0, `${r.count} tips, longest ${r.max} chars: "${r.longest}…"`);
}

/* F51: the two questions are independent, and the page has to prove it. How
   EARLY you could stop cannot depend on when you CHOOSE to stop, so dragging
   the slider from one end of its range to the other must leave section 1
   untouched — the freedom age, the pot-needed curve and the investment line
   alike — while moving every figure in section 2. */
{
  const r = await page.evaluate(() => {
    const F = window.__FF, $ = id => document.getElementById(id);
    const snap = () => {
      const res = F.last;
      const path = window.__charts.find(c => c.data.datasets.some(d => d.label === 'Investment outcome'));
      const line = l => path.data.datasets.find(d => d.label === l).data.map(p => Math.round(p.y));
      return {
        ff: res.ffAge,
        acc: line('Investment outcome').join(','),
        need: line('Pot needed to stop here').join(','),
        dep: line('Money deposited').join(','),
        freePot: $('mFreePot').textContent,
        // section 2
        needAt: res.needAtRetire, have: res.potAtRetire, left: res.leftAtDeath,
        succ: $('mSuccess').textContent,
        balRow30: F.tableRows(res)[40].balance
      };
    };
    const at = age => { $('ageRetire').value = age; F.render(); return snap(); };
    const out = [40, 55, 60, 75, 89].map(at);
    $('ageRetire').value = 60; F.render();
    return out;
  });
  const first = r[0];
  check('F51 the freedom age does not move when the retirement slider does',
    r.every(x => x.ff === first.ff), r.map(x => x.ff.toFixed(3)).join(' '));
  check('F51b nor does one pixel of the section 1 chart',
    r.every(x => x.acc === first.acc && x.need === first.need && x.dep === first.dep),
    r.every(x => x.acc === first.acc) ? 'all three lines identical at every slider position' : 'a line moved');
  check('F51c nor the pot the crossing happens at', r.every(x => x.freePot === first.freePot),
    r.map(x => x.freePot).join(' '));
  check('F51d while every figure in section 2 moves with it',
    new Set(r.map(x => x.needAt)).size === r.length &&
    new Set(r.map(x => x.have)).size === r.length &&
    new Set(r.map(x => x.left)).size === r.length &&
    new Set(r.map(x => x.balRow30)).size > 1,
    r.map(x => Math.round(x.needAt)).join(' / '));
}

/* F52: the retirement age is a SLIDER, capped by the two ages it sits between,
   and the number input it replaced is gone. Both ends have to be reachable and
   meaningful: the left is "stop today", the right is "never stop". */
{
  const r = await page.evaluate(() => {
    const F = window.__FF, $ = id => document.getElementById(id);
    const el = $('ageRetire');
    const inYouTab = !!document.querySelector('#tab-you #ageRetire');
    const before = {type: el.type, min: el.min, max: el.max, val: el.value,
                    readout: $('ageRetireVal').textContent,
                    inSection: !!document.querySelector('#boardCash #ageRetire'),
                    scale: [$('retireScaleMin').textContent, $('retireScaleMax').textContent]};
    // Move both ends and the slider has to follow them.
    $('ageNow').value = 45; $('ageDie').value = 70; F.render();
    const moved = {min: el.min, max: el.max, val: el.value, ui: F.UI.ageRetire};
    // A life expectancy dragged below the handle pulls the handle down with it.
    $('ageDie').value = 55; F.render();
    const squeezed = {max: el.max, val: el.value, ui: F.UI.ageRetire};
    // Both ends of the range are ordinary answers. The bounds are rewritten
    // during a render, so restore the ages first and only then grab the end.
    $('ageNow').value = 30; $('ageDie').value = 90; F.render();
    el.value = el.min; F.render();
    const today = {ui: F.UI.ageRetire, accM: F.accMonths(F.last.P), verdict: $('verdict').className,
                   left: F.last.leftAtDeath, scale: $('retireScaleMin').textContent,
                   note: $('mLeftSub').textContent};
    el.value = el.max; F.render();
    const never = {ui: F.UI.ageRetire, accM: F.accMonths(F.last.P), verdict: $('verdict').className,
                   left: F.last.leftAtDeath, scale: $('retireScaleMax').textContent,
                   note: $('mLeftSub').textContent};
    el.value = 60; F.render();
    return {before, moved, squeezed, today, never, inYouTab};
  });
  check('F52 the retirement age is a range slider, and the number input is gone from the panel',
    r.before.type === 'range' && !r.inYouTab && r.before.inSection,
    `${r.before.type}, in the You tab: ${r.inYouTab}, in the Cashflows board: ${r.before.inSection}`);
  check('F52b capped from age now to the life expectancy',
    r.before.min === '30' && r.before.max === '90', `${r.before.min}..${r.before.max}`);
  check('F52c and the cap follows both ages when they change',
    r.moved.min === '45' && r.moved.max === '70' && Number(r.moved.ui) === 60,
    `${r.moved.min}..${r.moved.max}, handle at ${r.moved.ui}`);
  check('F52d a life expectancy dragged under the handle pulls the handle down with it',
    r.squeezed.max === '55' && Number(r.squeezed.ui) <= 55,
    `max ${r.squeezed.max}, handle at ${r.squeezed.ui}`);
  check('F52e the readout and the two end labels name the ages, not raw numbers',
    /^\d/.test(r.before.readout) && /stop today/i.test(r.before.scale[0]) &&
    /never stop/i.test(r.before.scale[1]), r.before.scale.join(' … '));
  /* Both ends are named by the slider's own scale labels, so neither needs a
     caption under the chart saying the handle is where the reader just put
     it. What the end DOES to the plan is on the "Left at" card. */
  check('F52f the left end means stop today: no accumulation at all, and the page still works',
    r.today.ui === 30 && r.today.accM === 0 && /visible/.test(r.today.verdict) &&
    /stop today/i.test(r.today.scale),
    `accM ${r.today.accM}, left at 90 ${r.today.left.toFixed(0)}`);
  check('F52g the right end means never stop: nothing is ever drawn, and the page says so',
    r.never.ui === 90 && r.never.accM === 720 && /visible/.test(r.never.verdict) &&
    /never stop/i.test(r.never.scale) && /nothing is ever drawn/i.test(r.never.note),
    `accM ${r.never.accM}, left at 90 ${r.never.left.toFixed(0)}, "${r.never.note}"`);
}

/* F63: TWO verdicts, one per question. The banner at the top of the page
   carries what the slider cannot move — a broken pair of ages, a plan no pot
   of any size funds, and the age the crossing happens at. The verdict on the
   SLIDER'S OWN AGE hangs under the slider, because it is an answer about that
   control and it changes on every drag; the remedies that close the gap go
   with it. A slider-age verdict three screens above the hand doing the
   dragging is what this split exists to prevent. */
{
  const r = await page.evaluate(() => {
    const F = window.__FF, $ = id => document.getElementById(id);
    const read = () => ({
      top: {cls: $('verdict').className,
            head: ($('verdict').querySelector('h2') || {textContent: ''}).textContent.trim(),
            body: $('verdict').textContent.trim(),
            remedies: $('verdict').querySelectorAll('.remedies li').length},
      slider: {cls: $('verdictSlider').className,
               head: ($('verdictSlider').querySelector('h2') || {textContent: ''}).textContent.trim(),
               remedies: $('verdictSlider').querySelectorAll('.remedies li').length}
    });
    const set = o => { Object.keys(o).forEach(k => { $(k).value = o[k]; }); F.render(); };
    const el = $('verdictSlider');
    const where = {
      // Directly under the slider, inside the board header it belongs to.
      afterSlider: el.previousElementSibling === $('retireSlider'),
      inCashHead: !!document.querySelector('#boardCash .board-head #verdictSlider'),
      // And the banner is still the first thing in the main column.
      bannerOnTop: document.querySelector('main > .verdict') === $('verdict')
    };
    const out = {where};
    out.ok = read();
    set({savings: '6,000', assets: '0', ageRetire: '45'});
    out.late = read();
    set({savings: '0', assets: '0'});
    out.impossible = read();
    set({savings: '30,000', assets: '100,000', ageRetire: '60'});
    return out;
  });
  check('F63 the slider verdict is drawn directly under the slider, the banner still on top',
    r.where.afterSlider && r.where.inCashHead && r.where.bannerOnTop,
    `after the slider ${r.where.afterSlider}, in the Cashflows header ${r.where.inCashHead}, ` +
    `banner first in the column ${r.where.bannerOnTop}`);
  check('F63b "not by this age" is the slider’s verdict, with the remedies that close it',
    /warn/.test(r.late.slider.cls) && /^Not by 45\./.test(r.late.slider.head) &&
    r.late.slider.remedies > 0 && r.late.top.remedies === 0,
    `slider: "${r.late.slider.head}" (${r.late.slider.remedies} remedies) || banner: "${r.late.top.head}"`);
  check('F63c while the banner keeps the age the crossing happens at, and never names the slider',
    /good/.test(r.late.top.cls) && /financially free at/i.test(r.late.top.head) &&
    !/\b45\b/.test(r.late.top.body) && !/slider/i.test(r.late.top.head) &&
    !/\b60\b/.test(r.ok.top.head),
    `late: "${r.late.top.head}" || default: "${r.ok.top.head}"`);
  /* The one verdict that is NOT about the slider stays where a first-time
     reader meets it: no pot of any size funds this plan, whatever age the
     handle is on. The slider card says nothing at all, because a second red
     card under the handle would read as a second, different failure. */
  check('F63d but universal impossibility stays on top, and the slider card goes quiet',
    /bad/.test(r.impossible.top.cls) &&
    /mathematically impossible/.test(r.impossible.top.head) &&
    !/visible/.test(r.impossible.slider.cls) && r.impossible.slider.head === '',
    `banner: "${r.impossible.top.head}" || slider card: "${r.impossible.slider.cls}"`);
  check('F63e and when the slider age does clear it, that is what the slider card says',
    /good/.test(r.ok.slider.cls) && /stopping at 60 works/i.test(r.ok.slider.head),
    r.ok.slider.head);
}

/* F64: the money you already hold is an investment figure, so it lives on the
   Investment tab beside the return it earns, not on the Goal tab with what you
   want the money to do. */
{
  const r = await page.evaluate(() => {
    const el = document.getElementById('assets');
    const panel = el.closest('.ctrl-panel');
    const row = el.closest('.field-row');
    const invest = document.getElementById('tab-invest');
    const rows = Array.from(invest.querySelectorAll('.field-row'));
    return {
      panel: panel ? panel.id : null,
      first: rows.indexOf(row) === 0,
      label: (row.querySelector('.field-label') || {textContent: ''}).textContent.trim().replace(/\s*\?$/, ''),
      tip: (row.querySelector('.tip-icon') || {}).dataset.tip || '',
      withReturn: !!invest.querySelector('#ret') && !!invest.querySelector('#std'),
      notInGoal: !document.querySelector('#tab-goal #assets'),
      prefix: !!document.getElementById('assetsPrefix')
    };
  });
  check('F64 invested assets today sits on the Investment tab, first, beside the return it earns',
    r.panel === 'tab-invest' && r.first && r.withReturn && r.notInGoal,
    `panel ${r.panel}, first row ${r.first}, return fields alongside ${r.withReturn}, off the Goal tab ${r.notInGoal}`);
  check('F64b and it kept its label, its currency prefix and a tip that points at the return below',
    /invested assets today/i.test(r.label) && r.prefix && /return below/i.test(r.tip),
    `"${r.label}", tip: "${r.tip}"`);
}

console.log('\n── The pension: rate, and whether it keeps its value ──');

/* F53: the pension can be entered per week, per month or per year, and either
   indexed to inflation or frozen. The period is pure arithmetic and has to be
   exact; the indexation is a real modelling choice and changes the answer. */
{
  const pots = {};
  for(const [amount, pensionPeriod] of [[52000, 'yearly'], [52000 / 12, 'monthly'], [1000, 'weekly']]){
    pots[pensionPeriod] = await engine(
      Object.assign({}, base, {pensionOn: true, amount, pensionAmount: amount, pensionPeriod}),
      'F.requiredPot(P, P.ageRetire)');
  }
  check('F53 the same pension entered per week, per month or per year gives the same pot',
    close(pots.yearly, pots.monthly, 1e-6) && close(pots.yearly, pots.weekly, 1e-6),
    `y ${pots.yearly.toFixed(4)} | m ${pots.monthly.toFixed(4)} | w ${pots.weekly.toFixed(4)}`);

  const peri = await engine(Object.assign({}, base, {pensionOn: true, pensionAmount: 1000, pensionPeriod: 'weekly'}),
    'P.pensionMonthly');
  check('F53b and a weekly figure is 52/12 of a month, not a quarter of one',
    close(peri, 1000 * 52 / 12, 1e-9), `${peri.toFixed(4)} a month`);

  // Indexation, against the replay's own discount-factor formulation.
  const idxUi = Object.assign({}, base, {pensionOn: true, pensionStartAge: 67, pensionAmount: 29000, pensionIndexed: true});
  const froUi = Object.assign({}, idxUi, {pensionIndexed: false});
  const pIdx = refParams(idxUi), pFro = refParams(froUi);
  const ages = [66, 67, 70, 80, 90];
  const gotIdx = await engine(idxUi, `[${ages.join(',')}].map(function(a){ return F.pensionAt(P, a); })`);
  const gotFro = await engine(froUi, `[${ages.join(',')}].map(function(a){ return F.pensionAt(P, a); })`);
  check('F53c an indexed pension is flat in today’s money, and zero before it starts',
    gotIdx[0] === 0 && ages.slice(1).every((a, k) => close(gotIdx[k + 1], refPension(pIdx, a), 1e-9)),
    gotIdx.map(v => v.toFixed(0)).join(' '));
  check('F53d a frozen one decays by exactly the inflation factor, measured from TODAY',
    gotFro[0] === 0 && ages.slice(1).every((a, k) =>
      close(gotFro[k + 1], 29000 / 12 * Math.pow(1.025, -(a - 30)), 1e-9) &&
      close(gotFro[k + 1], refPension(pFro, a), 1e-9)),
    gotFro.map(v => v.toFixed(0)).join(' '));

  const needIdx = await engine(idxUi, 'F.requiredPot(P, P.ageRetire)');
  const needFro = await engine(froUi, 'F.requiredPot(P, P.ageRetire)');
  const needNone = await engine(base, 'F.requiredPot(P, P.ageRetire)');
  check('F53e the page’s pot for a frozen pension matches the replay',
    close(needFro, refRequired(pFro, pFro.ageRetire), 0.01),
    `page ${needFro.toFixed(2)} vs replay ${refRequired(pFro, pFro.ageRetire).toFixed(2)}`);
  check('F53f and an indexed one is worth more than a frozen one, which is worth more than none',
    needIdx < needFro && needFro < needNone,
    `indexed ${needIdx.toFixed(0)} < frozen ${needFro.toFixed(0)} < none ${needNone.toFixed(0)}`);
  check('F53g the page’s pot for an indexed pension matches the replay too',
    close(needIdx, refRequired(pIdx, pIdx.ageRetire), 0.01),
    `page ${needIdx.toFixed(2)} vs replay ${refRequired(pIdx, pIdx.ageRetire).toFixed(2)}`);

  // With no inflation the distinction cannot exist, and must not.
  const z1 = await engine(Object.assign({}, idxUi, {inflation: 0}), 'F.requiredPot(P, P.ageRetire)');
  const z2 = await engine(Object.assign({}, froUi, {inflation: 0}), 'F.requiredPot(P, P.ageRetire)');
  check('F53h at zero inflation the two are the same plan, to the cent',
    close(z1, z2, 1e-9), `${z1.toFixed(4)} vs ${z2.toFixed(4)}`);

  // Die Rich takes its perpetuity on the net draw at the horizon, which a
  // frozen pension has eroded almost entirely by age 120.
  const richFro = await engine(Object.assign({}, froUi, {mode: 'rich'}), `(function(){
    return {pot: F.requiredPot(P, P.ageRetire), atHorizon: F.pensionAt(P, 120),
            atStart: F.pensionAt(P, 67), expense: P.Xr};
  })()`);
  const richIdx = await engine(Object.assign({}, idxUi, {mode: 'rich'}),
    'F.requiredPot(P, P.ageRetire)');
  check('F53i under Die Rich a frozen pension has all but faded by the horizon',
    richFro.atHorizon < richFro.expense * 0.1 && richFro.atHorizon < richFro.atStart / 3,
    `${richFro.atHorizon.toFixed(2)} a month at 120, from ${richFro.atStart.toFixed(2)} at 67, against spending of ${richFro.expense.toFixed(2)}`);
  check('F53i2 so forever costs more with a frozen pension than with an indexed one',
    richFro.pot > richIdx && isFinite(richFro.pot),
    `frozen ${richFro.pot.toFixed(0)} vs indexed ${Number(richIdx).toFixed(0)}`);

  // The page has to say what the switch does, in money, not only in words.
  const ui = await page.evaluate(() => {
    const F = window.__FF, $ = id => document.getElementById(id);
    const set = () => { $('pensionOn').checked = true; $('pensionAmount').value = '29,000';
                        $('pensionPeriod').value = 'yearly'; };
    set(); $('pensionIndexed').checked = true; F.render();
    const on = $('pensionNote').textContent;
    $('pensionIndexed').checked = false; F.render();
    const off = $('pensionNote').textContent;
    $('pensionOn').checked = false; $('pensionIndexed').checked = true; F.render();
    const none = $('pensionNote').textContent;
    return {on, off, none, hasPeriod: !!document.getElementById('pensionPeriod'),
            periods: Array.from(document.querySelectorAll('#pensionPeriod option')).map(o => o.value),
            defaultIndexed: F.UI_DEFAULTS.pensionIndexed, defaultPeriod: F.UI_DEFAULTS.pensionPeriod};
  });
  check('F53j the amount takes a week, a month or a year, and defaults to a year',
    ui.hasPeriod && ui.periods.join(',') === 'weekly,monthly,yearly' && ui.defaultPeriod === 'yearly',
    ui.periods.join(','));
  check('F53k indexation is a checkbox, on by default, and the note names a real figure either way',
    ui.defaultIndexed === true && /keeps buying/.test(ui.on) && /never a cent more/.test(ui.off) &&
    /\d/.test(ui.on) && /\d/.test(ui.off) && ui.none === '',
    ui.off.slice(0, 90));
}

console.log('\n── Accounting integrity: the table adds up ──');

/* F54: the year-by-year table is a cash flow statement, so it has to behave
   like one. Four things, on every plan and in both moneys:
     1. Saved  = Income - Expense                    (the flows agree)
     2. Balance + Saved + Growth = next Balance      (the row closes)
     3. the first Balance is what you hold today     (it starts where you are)
     4. the last Balance is the engine's own terminal (it ends where the engine does)
   The balance column is checked against the REPLAY's forward recurrence, not
   against the page's own series, so agreement means the arithmetic agrees. */
{
  const plans = [
    ['the target plan', {}],
    ['in today’s money', {showReal: true}],
    ['the net income model', {savingsMode: 'income', savings: 95000}],
    ['a frozen weekly pension', {pensionOn: true, pensionAmount: 600, pensionPeriod: 'weekly', pensionIndexed: false}],
    ['an indexed pension bridge', {ageRetire: 55, pensionOn: true, pensionStartAge: 67, pensionAmount: 29000}],
    ['stopping today', {ageRetire: 30}],
    ['never stopping', {ageRetire: 90}],
    ['a plan that runs out', {savings: 2000, assets: 0, ageRetire: 45}],
    ['Leave a Legacy', {mode: 'legacy'}],
    ['Die Rich', {mode: 'rich', ageRetire: 70}],
    ['zero inflation', {inflation: 0}],
    ['zero return', {ret: 2.5}]
  ];
  for(const [name, extra] of plans){
    const ui = Object.assign({}, base, extra);
    const p = refParams(ui);
    const r = await page.evaluate(u => {
      const F = window.__FF;
      const res = F.compute(Object.assign({}, F.UI_DEFAULTS, u));
      const rows = F.tableRows(res);
      return {rows, i: res.P.inflation, showReal: !!u.showReal,
              A0: res.P.A0, terminal: res.leftAtDeath, years: res.years};
    }, ui);
    const rows = r.rows;
    let savedErr = 0, closeErr = 0, worstRow = -1;
    for(let y = 0; y < rows.length; y++){
      if(rows[y].flow == null) continue;
      savedErr = Math.max(savedErr, Math.abs(rows[y].income - rows[y].expense - rows[y].flow));
      const d = Math.abs(rows[y].balance + rows[y].flow + rows[y].growth - rows[y + 1].balance);
      if(d > closeErr){ closeErr = d; worstRow = y; }
    }
    const scale = y => r.showReal ? 1 : Math.pow(1 + r.i, y);
    // The replay's own forward balance, in the money the table is showing.
    const ref = refLifetime(p);
    let balErr = 0;
    for(let y = 0; y < rows.length; y++) balErr = Math.max(balErr, Math.abs(rows[y].balance - ref[y * 12] * scale(y)));
    const tol = Math.max(0.01, Math.abs(rows[rows.length - 1].balance) * 1e-9);
    check(`F54 Saved is Income less Expense in every row — ${name}`,
      savedErr < 0.01, `largest gap ${savedErr.toExponential(2)}`);
    check(`F54b every row closes: Balance + Saved + Growth is next year’s Balance — ${name}`,
      closeErr < tol, `largest gap ${closeErr.toExponential(2)}${worstRow >= 0 ? ' at row ' + worstRow : ''}`);
    check(`F54c and the balance column matches the replay's own forward recurrence — ${name}`,
      balErr < Math.max(0.05, tol), `largest gap ${balErr.toExponential(2)}`);
    check(`F54d it starts at today's assets and ends at the engine's own terminal — ${name}`,
      close(rows[0].balance, r.A0, 0.01) &&
      close(rows[rows.length - 1].balance, r.terminal * scale(r.years), Math.max(0.05, tol)) &&
      rows[rows.length - 1].flow === null && rows[rows.length - 1].growth === null,
      `${rows[0].balance.toFixed(0)} .. ${rows[rows.length - 1].balance.toFixed(0)}`);
  }
}

/* F54e: the whole plan in one line. Telescoping every row has to leave
   A0 + everything saved + everything earned = the final balance, which is the
   same identity the rows carry, stated once for the plan as a whole. */
{
  const r = await page.evaluate(() => {
    const F = window.__FF;
    const res = F.compute(Object.assign({}, F.UI_DEFAULTS, {showReal: true}));
    const rows = F.tableRows(res);
    let saved = 0, grown = 0;
    rows.forEach(x => { if(x.flow != null){ saved += x.flow; grown += x.growth; } });
    return {A0: rows[0].balance, saved, grown, last: rows[rows.length - 1].balance};
  });
  check('F54e the whole plan telescopes: assets today plus all saving plus all growth is the final balance',
    close(r.A0 + r.saved + r.grown, r.last, 0.05),
    `${r.A0.toFixed(0)} + ${r.saved.toFixed(0)} saved + ${r.grown.toFixed(0)} grown = ${(r.A0 + r.saved + r.grown).toFixed(0)} vs ${r.last.toFixed(0)}`);
}

/* F54f: Growth is a residual, so it has to MEAN something in both moneys. In
   today's money it is the real return on the pot. In the money of the day it
   is the nominal return, which is the same earnings plus the inflation uplift
   on the balance and on that year's flows — the decomposition written out. */
{
  const r = await page.evaluate(() => {
    const F = window.__FF;
    const real = F.tableRows(F.compute(Object.assign({}, F.UI_DEFAULTS, {showReal: true})));
    const nom = F.tableRows(F.compute(Object.assign({}, F.UI_DEFAULTS, {showReal: false})));
    const i = F.compute(Object.assign({}, F.UI_DEFAULTS, {})).P.inflation;
    let worst = 0, negatives = 0;
    for(let y = 0; y < real.length - 1; y++){
      // nominal growth = real growth inflated one more year, plus i times the
      // balance and the flows that year, all in that year's money.
      const want = real[y].growth * Math.pow(1 + i, y + 1) +
                   (real[y].balance + real[y].flow) * i * Math.pow(1 + i, y);
      worst = Math.max(worst, Math.abs(nom[y].growth - want));
      if(real[y].growth < 0) negatives++;
    }
    return {worst, negatives, i};
  });
  check('F54f nominal growth decomposes into the real return plus the inflation uplift, exactly',
    r.worst < 0.05, `largest gap ${r.worst.toExponential(2)}`);
  check('F54g and a pot that is still growing never reports a negative real return',
    r.negatives === 0, `${r.negatives} negative years`);
}

/* F54h: the cards over the table have to say the same thing the table does.
   A figure that disagrees with the row it summarises is worse than no figure. */
{
  const r = await page.evaluate(() => {
    const F = window.__FF, $ = id => document.getElementById(id);
    $('ageRetire').value = 55; $('showReal').checked = true; F.render();
    const res = F.last, rows = F.tableRows(res);
    const retIdx = Math.round(res.P.ageRetire - res.P.ageNow);
    const cur = s => Number(String(s).replace(/[^0-9.\-]/g, '')) * (/m$/.test(s) ? 1e6 : (/k$/.test(s) ? 1e3 : 1));
    const out = {
      haveCard: cur($('mHave').textContent), haveRow: rows[retIdx].balance,
      leftCard: cur($('mLeft').textContent), leftRow: rows[rows.length - 1].balance,
      needCard: cur($('mNeed').textContent), needEngine: res.needAtRetire,
      succ: $('mSuccess').textContent,
      succEngine: res.successAtPlan,
      ages: [$('mNeedAge').textContent, $('mHaveAge').textContent, $('mLeftAge').textContent]
    };
    $('ageRetire').value = 60; $('showReal').checked = false; F.render();
    return out;
  });
  const near = (a, b) => Math.abs(a - b) <= Math.max(Math.abs(b) * 0.01, 1);
  check('F54h the "Balance at" card is the table row for that age',
    near(r.haveCard, r.haveRow), `card ${r.haveCard} vs row ${r.haveRow.toFixed(0)}`);
  check('F54i the "Left at" card is the last row of the table',
    near(r.leftCard, r.leftRow), `card ${r.leftCard} vs row ${r.leftRow.toFixed(0)}`);
  check('F54j the "Pot needed at" card is the engine’s own requirement',
    near(r.needCard, r.needEngine), `card ${r.needCard} vs engine ${r.needEngine.toFixed(0)}`);
  check('F54k and the chance shown is the one the pot scores',
    r.succ === Math.round(r.succEngine * 100) + '%', `${r.succ} vs ${(r.succEngine * 100).toFixed(1)}%`);
  check('F54l each card names the age it is measured at',
    r.ages[0] === '55' && r.ages[1] === '55' && r.ages[2] === '90', r.ages.join(' / '));
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
      const h2 = head.querySelector('h2, h3');
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
  check('F46b and any subtitle sits below that row, so it cannot push them off it',
    r.every(x => x.subIsSibling),
    `longest subtitle ${Math.max.apply(null, r.map(x => x.subLen))} chars, none inside the row`);
}

/* ── Exports ── */
{
  const r = await page.evaluate(() => {
    /* One cluster per card. The balance has no cluster of its own any more:
       it shares the cashflow card, so the cashflow export carries both panes
       in one image rather than handing the reader half a picture. */
    const ids = ['ffSvgBtn', 'ffPngBtn', 'ffCopyBtn', 'ddSvgBtn', 'ddPngBtn', 'ddCopyBtn', 'csvBtn'];
    const missing = ids.filter(i => !document.getElementById(i));
    const gone = ['balSvgBtn', 'balPngBtn', 'balCopyBtn'].filter(i => !!document.getElementById(i));
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
    return captured ? captured.text().then(text => ({missing, gone, text})) : {missing, gone, text: null};
  });
  check('F39 every export control is on the page, and the balance no longer has one of its own',
    r.missing.length === 0 && r.gone.length === 0,
    (r.missing.length ? 'missing ' + r.missing.join(',') : 'SVG, PNG, copy on both charts, CSV on the table') +
    (r.gone.length ? '; stale ' + r.gone.join(',') : ''));
  const lines = (r.text || '').trim().split('\n');
  {
    // Same columns, same order, same meaning as the table on screen. The CSV
    // spells "Saved / drawn" without the spaces, and nothing else differs.
    const heads = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#tableWrap thead th')).map(t => t.textContent.trim()));
    const expect = heads.map(h => h.replace(/\s*\/\s*/g, '_or_').replace(/\s+/g, '_')).join(',');
    check('F39b the CSV carries the same columns as the table, in the same order',
      lines.length > 2 && lines[2] === expect, `${lines[2] || 'no header'}  vs table  ${expect}`);
    check('F39b2 and the pot and the gap are gone from it too',
      !/pot|gap/i.test(lines[2] || ''), lines[2] || '');
  }
  check('F39c one row per year, matching the table',
    lines.length - 3 === (await page.evaluate(() => window.__FF.tableRows(window.__FF.last).length)),
    `${lines.length - 3} rows`);
  check('F39d and says which money and which currency it is in',
    /today's money|future['\u2019]s money/.test(lines[1] || ''), (lines[1] || '').replace('# ', ''));

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
    const sim = document.getElementById('simBtn');
    const row = sim && sim.parentElement, aside = document.querySelector('.controls');
    return {
      hasSim: !!sim, pinned: !!(aside && aside.lastElementChild === row),
      hasReset: !!document.getElementById('resetBtn'),
      note: !!document.getElementById('staleNote')
    };
  });
  check('F40 Simulate is a pinned action row of its own',
    r.hasSim && r.pinned && r.note, `sim ${r.hasSim}, pinned ${r.pinned}, stale note ${r.note}`);
  check('F40b and there is no Reset button, because every Quick Start is one',
    !r.hasReset, '');
}

// F32: the page must not have thrown anywhere along the way.
console.log('\n── Fuzz: 200 random plans, every invariant at once ──');

/* F56: the checks above each pin one thing on a plan chosen to expose it. This
   one takes 200 plans nobody chose — random ages, rates, periods, goals,
   pensions, both savings models, both moneys — and asserts everything that has
   to hold on all of them at once. It is the net under the rest: a combination
   no hand-written case thought of has to either satisfy every invariant or
   show up here.

   Seeded, so a failure is reproducible and the seed names the plan. */
{
  const rnd = (seed => () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  })(20260921);
  const pick = a => a[Math.floor(rnd() * a.length)];
  const between = (lo, hi) => lo + rnd() * (hi - lo);

  const plans = [];
  for(let k = 0; k < 200; k++){
    const ageNow = Math.round(between(18, 70));
    const ageDie = ageNow + Math.round(between(1, 50));
    plans.push({
      ageNow, ageDie,
      ageRetire: Math.round(between(ageNow, ageDie)),
      expense: Math.round(between(0, 200000)), expensePeriod: pick(['weekly', 'monthly', 'yearly']),
      savingsMode: pick(['savings', 'income']),
      savings: Math.round(between(0, 250000)), savingsPeriod: pick(['weekly', 'monthly', 'yearly']),
      growth: Number(between(-5, 12).toFixed(1)),
      inflation: Number(between(0, 15).toFixed(1)),
      ret: Number(between(-3, 20).toFixed(1)),
      std: Number(between(0, 40).toFixed(1)),
      assets: Math.round(between(0, 3000000)),
      mode: pick(['die', 'legacy', 'rich']),
      legacy: Math.round(between(0, 2000000)),
      retireMultiplier: Math.round(between(10, 200)),
      pensionOn: rnd() < 0.5,
      pensionStartAge: Math.round(between(40, 90)),
      pensionAmount: Math.round(between(0, 80000)),
      pensionPeriod: pick(['weekly', 'monthly', 'yearly']),
      pensionIndexed: rnd() < 0.5,
      showReal: rnd() < 0.5,
      paths: 60, seed: 1 + Math.floor(rnd() * 1e6), confidence: Math.round(between(50, 99))
    });
  }

  const bad = {finite: [], saved: [], closes: [], replay: [], ff: [], ffTight: [], prob: [], chart: [],
               band: [], card: []};
  let banded = 0;
  for(let k = 0; k < plans.length; k++){
    const ui = Object.assign({}, DEFAULTS, plans[k]);
    const p = refParams(ui);
    const r = await page.evaluate(u => {
      const F = window.__FF;
      const res = F.compute(Object.assign({}, F.UI_DEFAULTS, u));
      const rows = F.tableRows(res);
      const ok = v => v === null || (typeof v === 'number' && isFinite(v));
      let finite = true;
      rows.forEach(x => {
        if(!ok(x.balance) || !ok(x.income) || !ok(x.expense) || !ok(x.flow) || !ok(x.growth)) finite = false;
      });
      let savedErr = 0, closeErr = 0;
      for(let y = 0; y < rows.length; y++){
        if(rows[y].flow == null) continue;
        savedErr = Math.max(savedErr, Math.abs(rows[y].income - rows[y].expense - rows[y].flow));
        closeErr = Math.max(closeErr, Math.abs(rows[y].balance + rows[y].flow + rows[y].growth - rows[y + 1].balance));
      }
      // The crossing has to be a real crossing: funded at it, and NOT funded
      // the month before, or it is not the EARLIEST age and the headline lies.
      const ff = res.ffAge;
      let ffOk = true, ffTight = true;
      if(ff !== null){
        if(!(ff >= res.P.ageNow - 1e-9 && ff <= res.P.ageDie + 1e-9)) ffOk = false;
        const n = F.months(res.P.ageNow, res.P.ageDie);
        const acc = F.accumulate(res.P, n);
        const t = Math.round((ff - res.P.ageNow) * 12);
        if(!(acc[t] >= F.requiredPot(res.P, ff) - 1e-6)) ffOk = false;
        if(t > 0){
          const prev = res.P.ageNow + (t - 1) / 12;
          if(acc[t - 1] >= F.requiredPot(res.P, prev) - 1e-6) ffTight = false;
        }
      }
      // Nothing plotted may be NaN, on either chart.
      let chartOk = true;
      window.__charts.forEach(c => c.data.datasets.forEach(d => d.data.forEach(pt => {
        if(pt && (Number.isNaN(pt.x) || Number.isNaN(pt.y))) chartOk = false;
      })));
      const need = res.needAtRetire, conf = res.confPot, sr = res.successAtPlan;
      return {
        finite, savedErr, closeErr, ffOk, ffTight, chartOk,
        scale: rows.map((x, y) => u.showReal ? 1 : Math.pow(1 + res.P.inflation, y)),
        balances: rows.map(x => x.balance),
        mag: Math.max.apply(null, rows.map(x => Math.abs(x.balance)).concat([1])),
        probOk: sr >= 0 && sr <= 1 && (conf >= 0 || conf === Infinity) &&
                (isFinite(need) || (need === Infinity && u.mode === 'rich'))
      };
    }, ui);

    const tol = Math.max(0.01, r.mag * 1e-9);
    const ref = refLifetime(p);
    let balErr = 0;
    for(let y = 0; y < r.balances.length; y++){
      balErr = Math.max(balErr, Math.abs(r.balances[y] - ref[y * 12] * r.scale[y]));
    }
    const tag = `#${k} seed ${plans[k].seed}`;
    if(!r.finite) bad.finite.push(tag);
    if(!(r.savedErr < 0.01)) bad.saved.push(`${tag} (${r.savedErr.toExponential(1)})`);
    if(!(r.closeErr < tol)) bad.closes.push(`${tag} (${r.closeErr.toExponential(1)})`);
    if(!(balErr < Math.max(0.05, tol))) bad.replay.push(`${tag} (${balErr.toExponential(1)})`);
    if(!r.ffOk) bad.ff.push(tag);
    if(!r.ffTight) bad.ffTight.push(tag);
    if(!r.probOk) bad.prob.push(tag);
    if(!r.chartOk) bad.chart.push(tag);
    // The range of balances, replayed and held to the card on every plan
    // that retires before its life expectancy (F66 on plans nobody chose).
    const pg = await pageFan(ui);
    const rf = refFan(p, pg.draws);
    if(!!pg.dd !== !!rf) bad.band.push(`${tag} (band ${!!pg.dd}, replay ${!!rf})`);
    else if(rf){
      banded++;
      const w = Math.max(...['p10', 'p90'].map(q => worstRel(pg.dd.bands[q], rf.edges[q])));
      const flat = ['p10', 'p90'].every(q => pg.dd.bands[q].every(v => typeof v === 'number' && isFinite(v)));
      if(!(w < 1e-8) || !flat || pg.dd.startYear !== rf.start) bad.band.push(`${tag} (${w.toExponential(1)})`);
      const want = Math.round(pg.success * pg.paths);
      if(Math.abs(rf.funded - want) > pg.borderline) bad.card.push(`${tag} (replay ${rf.funded}, card ${want})`);
    }
  }
  const n = plans.length;
  check(`F56 every figure on ${n} random plans is a number, never a NaN or an Infinity`,
    bad.finite.length === 0, bad.finite.slice(0, 3).join(', ') || 'all finite');
  check('F56b Saved is Income less Expense on every one of them',
    bad.saved.length === 0, bad.saved.slice(0, 3).join(', ') || 'exact everywhere');
  check('F56c and every row closes into the next year\u2019s balance',
    bad.closes.length === 0, bad.closes.slice(0, 3).join(', ') || 'exact everywhere');
  check('F56d the balance column matches the replay on every one of them',
    bad.replay.length === 0, bad.replay.slice(0, 3).join(', ') || 'agrees everywhere');
  check('F56e where a freedom age is reported, the plan really is funded at it',
    bad.ff.length === 0, bad.ff.slice(0, 3).join(', ') || 'funded at every crossing');
  check('F56f and it is the EARLIEST such age, not merely one of them',
    bad.ffTight.length === 0, bad.ffTight.slice(0, 3).join(', ') || 'no earlier month qualifies');
  check('F56g probabilities stay in [0,1] and only Die Rich may need an infinite pot',
    bad.prob.length === 0, bad.prob.slice(0, 3).join(', ') || 'all in range');
  check('F56h and nothing NaN is ever handed to a chart',
    bad.chart.length === 0, bad.chart.slice(0, 3).join(', ') || 'clean');
  check('F56i the range of balances matches the replay on every plan that draws one',
    bad.band.length === 0 && banded > 100, bad.band.slice(0, 3).join(', ') || `agrees on all ${banded}`);
  check('F56j and the futures it shades as funded are the "Chance it works" figure on every one',
    bad.card.length === 0, bad.card.slice(0, 3).join(', ') || `path for path on all ${banded}`);
}

console.log('\n── Quick Start scenarios ──');

/* F65: the Quick Start buttons. Each one is a claim that the whole form now
   describes a named saver, so the harness reads the CONTROLS back rather than
   readInputs(): a scenario writing to an id that no longer exists would
   otherwise be papered over by the engine's own defaults and the button would
   quietly load somebody else.

   The lesson each scenario teaches is checked too, because the tooltips promise
   one. A geoarbitrage plan that frees no earlier than the same saver staying
   home, or a late starter the pension does nothing for, is a button that lies. */
{
  const SCEN = await page.evaluate(() => window.__FF.QUICK_START_SCENARIOS);
  const PRESETS = await page.evaluate(() => window.__FF.PRESET_ASSETS);
  const keys = Object.keys(SCEN);

  // The plan a scenario means, derived here rather than read off the page: the
  // named preset owns the return and the volatility, everything else falls back
  // to the shipped defaults.
  const freeAge = async ui => (await engine(ui, 'F.diagnose(ui)')).ffAge;
  /* A scenario no longer carries a retirement age: the page seeds the slider
     from the plan's own freedom age. Resolve it here the same way, or every
     check below would be measuring the generic default instead of the scenario
     the reader is actually looking at. The freedom age does not depend on the
     retirement age, so there is nothing circular in solving for it first. */
  const seedRetire = (plan, ff) => {
    const lo = Math.round(plan.ageNow), hi = Math.max(lo, Math.round(plan.ageDie));
    const want = ff == null ? hi : Math.ceil(ff - 1e-9);
    return Math.min(hi, Math.max(lo, want));
  };
  const planCache = {};
  const planOf = async key => {
    if(planCache[key]) return planCache[key];
    const plan = Object.assign({}, DEFAULTS, SCEN[key].vals);
    const pre = PRESETS[plan.assetPreset];
    if(pre && plan.assetPreset !== 'custom'){ plan.ret = pre.ret; plan.std = pre.std; }
    plan.ageRetire = seedRetire(plan, await freeAge(plan));
    planCache[key] = plan;
    return plan;
  };

  const apply = key => page.evaluate(k => {
    document.querySelector('.quick-start-btn[data-preset="' + k + '"]').click();
  }, key).then(() => page.waitForTimeout(150));

  const btns = await page.evaluate(() => Array.from(document.querySelectorAll('.quick-start-btn'))
    .map(b => ({preset: b.dataset.preset, label: b.textContent.trim(),
                tip: (b.getAttribute('data-tip') || '').length})));
  check('F65 every scenario has a button and every button a scenario, each with its own tip',
    btns.length === keys.length &&
    btns.every(b => SCEN[b.preset] && SCEN[b.preset].label === b.label && b.tip > 40),
    btns.map(b => b.label).join(' | ') || 'no buttons');

  /* Every field the scenario names has to land on its own control. savingsMode
     and the goal are not inputs with ids, so they are read where the user
     reads them: the highlighted segment and the checked radio. */
  const landed = [], unmarked = [], presetDrift = [];
  for(const key of keys){
    await apply(key);
    const vals = SCEN[key].vals;
    const got = await page.evaluate(ids => {
      const out = {};
      const seg = document.querySelector('#savingsModeGroup .seg-btn.active');
      out.savingsMode = seg ? seg.dataset.val : null;
      const radio = document.querySelector('input[name="ffmode"]:checked');
      out.mode = radio ? radio.value : null;
      ids.forEach(id => {
        if(id === 'savingsMode' || id === 'mode') return;
        const el = document.getElementById(id);
        out[id] = el ? (el.type === 'checkbox' ? el.checked : el.value) : null;
      });
      return out;
    }, Object.keys(vals));

    Object.entries(vals).forEach(([id, want]) => {
      const live = got[id];
      if(live === null){ landed.push(`${key}.${id}: no such control`); return; }
      const ok = typeof want === 'number'
        ? close(parseFloat(String(live).replace(/,/g, '')), want, 1e-9)
        : (typeof want === 'boolean' ? live === want : String(live) === String(want));
      if(!ok) landed.push(`${key}.${id}: ${live} want ${want}`);
    });

    // The return and the volatility are the preset's, not a second copy of it.
    const plan = await planOf(key);
    const shown = await page.evaluate(() => ({
      ret: parseFloat(document.getElementById('ret').value),
      std: parseFloat(document.getElementById('std').value),
      preset: document.getElementById('assetPreset').value
    }));
    if(!(close(shown.ret, plan.ret, 1e-9) && close(shown.std, plan.std, 1e-9)))
      presetDrift.push(`${key}: ${shown.preset} shows ${shown.ret}/${shown.std}, preset says ${plan.ret}/${plan.std}`);

    if(!(await page.evaluate(k => {
      const on = document.querySelectorAll('.quick-start-btn.active');
      return on.length === 1 && on[0].dataset.preset === k;
    }, key))) unmarked.push(key);
  }
  check('F65b every scenario lands every figure it names, on the control the reader sees',
    landed.length === 0, landed.slice(0, 4).join(' | ') || `${keys.length} scenarios, every field landed`);
  check('F65c the chosen scenario is the only one highlighted',
    unmarked.length === 0, unmarked.join(' | ') || 'exactly one active button each time');
  check('F65d the return and volatility shown are the named preset’s, never a second copy',
    presetDrift.length === 0, presetDrift.join(' | ') || 'every scenario agrees with its asset preset');

  /* A scenario nobody can reach teaches nothing, and a slider parked short of
     the crossing opens Cashflows on a shortfall the reader has to fix first.
     Every button therefore has to clear its own goal at its own slider age —
     which, since the slider is seeded from the crossing, means landing ON it. */
  const unreachable = [], unfunded = [];
  const ages = {};
  for(const key of keys){
    const plan = await planOf(key);
    const ff = await freeAge(plan);
    ages[key] = ff;
    if(ff == null || !isFinite(ff)){ unreachable.push(key); continue; }
    if(ff > plan.ageRetire + 1e-9) unfunded.push(`${key}: free at ${ff.toFixed(1)}, slider on ${plan.ageRetire}`);
    const r = await engine(plan, '({need: F.requiredPot(P, P.ageRetire), pot: F.accumulate(P, F.accMonths(P))})');
    if(r.pot < r.need) unfunded.push(`${key}: pot ${r.pot.toFixed(0)} under need ${r.need.toFixed(0)}`);
  }
  check('F65e every scenario reaches financial freedom',
    unreachable.length === 0,
    unreachable.join(' | ') || keys.map(k => `${SCEN[k].label} at ${ages[k].toFixed(1)}`).join(', '));
  check('F65f and the slider opens on that age, so Cashflows starts on a funded plan',
    unfunded.length === 0, unfunded.slice(0, 3).join(' | ') || 'every scenario funded at its own slider age');

  /* Landing exactly on the crossing has a price, and the page has to be honest
     about it rather than hide it. The crossing is solved on the expected return
     alone, so opening on it is close to a coin flip once volatility is allowed
     for — never the near-certainty a slider parked a decade later would imply.
     Two things are pinned: the odds sit where the rule says they should, and
     the margin is one drag to the right, which is the board's whole lesson. */
  const odds = [];
  for(const key of keys){
    const plan = await planOf(key);
    const r = await engine(plan, 'F.compute(ui)');
    const later = await engine(Object.assign({}, plan, {ageRetire: Math.min(plan.ageDie, plan.ageRetire + 5)}),
      'F.compute(ui)');
    odds.push({key, p: r.successAtPlan, later: later.successAtPlan,
               gap: ages[key] == null ? null : plan.ageRetire - ages[key]});
  }
  check('F65g every scenario opens on the crossing, at the coin-flip odds that implies',
    odds.every(o => o.gap >= 0 && o.gap < 1 && o.p >= 0.35 && o.p <= 0.7),
    odds.map(o => `${o.key} ${(o.p * 100).toFixed(0)}% (+${o.gap.toFixed(1)}y)`).join(', '));
  check('F65g2 and five more years of work is what buys the certainty back',
    odds.every(o => o.later > o.p + 0.1),
    odds.map(o => `${o.key} ${(o.p * 100).toFixed(0)}% → ${(o.later * 100).toFixed(0)}%`).join(', '));

  // Frugal Living is the whole argument for spending less: it does both jobs at
  // once, so it must free a saver earlier than the moderate plan does, in years
  // of work and not merely in age.
  const mod = await planOf('moderate'), fru = await planOf('frugal');
  check('F65h Frugal Living frees a saver in fewer years of work than Moderate FIRE',
    (ages.frugal - fru.ageNow) < (ages.moderate - mod.ageNow) && ages.frugal < ages.moderate,
    `frugal ${(ages.frugal - fru.ageNow).toFixed(1)} years to age ${ages.frugal.toFixed(1)}, ` +
    `moderate ${(ages.moderate - mod.ageNow).toFixed(1)} years to age ${ages.moderate.toFixed(1)}`);

  /* Geoarbitrage is the retirement multiplier and nothing else, so the same
     saver told to keep spending Australian money has to wait years longer.
     Everything else about the two plans is identical by construction. */
  const geo = await planOf('geoarbitrage');
  const geoHome = await freeAge(Object.assign({}, geo, {retireMultiplier: 100}));
  check('F65i Geoarbitrage is the retirement multiplier: staying home costs the same saver years',
    geoHome != null && geoHome > ages.geoarbitrage + 3,
    `Bali at 40% frees at ${ages.geoarbitrage.toFixed(1)}, home at 100% ` +
    (geoHome == null ? 'never' : `at ${geoHome.toFixed(1)}`));

  // The late starter's tip points at the pension switch. It has to be worth
  // real years, or the tip is pointing at nothing.
  const late = await planOf('latestart');
  const noPension = await freeAge(Object.assign({}, late, {pensionOn: false}));
  check('F65j the late starter’s pension is worth years, which is what its tip claims',
    noPension != null && noPension > ages.latestart + 3,
    `with the pension ${ages.latestart.toFixed(1)}, without it ` +
    (noPension == null ? 'never' : noPension.toFixed(1)));

  // Each scenario is built on the DEFAULTS, not on what the last one left
  // behind. The late starter is the one that ticks the pension, so following it
  // with a scenario that does not is the test.
  await apply('latestart');
  await apply('moderate');
  const carried = await page.evaluate(() => ({
    pensionOn: document.getElementById('pensionOn').checked,
    ret: document.getElementById('ret').value,
    preset: document.getElementById('assetPreset').value,
    legacyShown: document.getElementById('legacyRow').style.display
  }));
  check('F65k a scenario inherits nothing from the one before it',
    carried.pensionOn === false && carried.preset === 'world' && carried.legacyShown === 'none',
    `pension ${carried.pensionOn}, preset ${carried.preset} at ${carried.ret}%`);

  /* A scenario has to land on its own retirement age whatever the reader was
     looking at before. Frugal Living frees a saver at 34.2, so the slider opens
     on 35 — and it has to get there from Late start, whose span (52 to 92) does
     not reach down to it. A range input clamps against the min and max it is
     carrying when you write to it, so this is the check that says the span is
     opened first. */
  await apply('latestart');
  await apply('frugal');
  const fru65l = await planOf('frugal');
  check('F65l a scenario lands on its own seeded age, not inside the last one\'s span',
    await page.evaluate(want => document.getElementById('ageRetire').value === String(want)
      && document.getElementById('ageNow').value === '28', fru65l.ageRetire),
    await page.evaluate(() => 'slider at ' + document.getElementById('ageRetire').value
      + ' with min ' + document.getElementById('ageRetire').min) + `, want ${fru65l.ageRetire}`);
}

console.log('\n── Coming back tomorrow ──');

/* F57: the mini cache has to bring back what it saved, and the slider is the
   awkward one. A range input clamps whatever you assign it to the min and max
   ATTRIBUTES it currently carries, and those are only rewritten by a render —
   so a handle restored before the ages that widen its range would silently
   land on the old ceiling. The static pair in the markup is therefore the
   widest either age can ever be, and this check is what says so. */
{
  await page.evaluate(() => {
    const $ = id => document.getElementById(id);
    $('ageNow').value = 50; $('ageDie').value = 100;
    $('pensionOn').checked = true; $('pensionIndexed').checked = false;
    $('pensionAmount').value = '600'; $('pensionPeriod').value = 'weekly';
    $('pensionStartAge').value = 70;
    window.__FF.render();
    $('ageRetire').value = 95;
    window.__FF.render();
    return null;
  });
  const before = await page.evaluate(() => {
    const u = window.__FF.UI;
    return {ageNow: u.ageNow, ageDie: u.ageDie, ageRetire: u.ageRetire,
            pensionPeriod: u.pensionPeriod, pensionIndexed: u.pensionIndexed,
            pensionAmount: u.pensionAmount, need: window.__FF.last.needAtRetire};
  });
  // Persist debounces, so give it room to land before the reload throws it away.
  await page.waitForTimeout(700);
  await page.reload({waitUntil: 'load'});
  await page.waitForFunction(() => !!window.__FF, null, {timeout: 10000});
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => {
    const u = window.__FF.UI, el = document.getElementById('ageRetire');
    return {ageNow: u.ageNow, ageDie: u.ageDie, ageRetire: u.ageRetire,
            pensionPeriod: u.pensionPeriod, pensionIndexed: u.pensionIndexed,
            pensionAmount: u.pensionAmount, need: window.__FF.last.needAtRetire,
            min: el.min, max: el.max};
  });
  check('F57 a retirement age past the markup\u2019s own ceiling survives a reload',
    after.ageRetire === before.ageRetire && after.ageRetire === 95 &&
    after.min === '50' && after.max === '100',
    `${before.ageRetire} -> ${after.ageRetire}, slider ${after.min}..${after.max}`);
  check('F57b and so do the ages either side of it',
    after.ageNow === before.ageNow && after.ageDie === before.ageDie,
    `${after.ageNow}..${after.ageDie}`);
  check('F57c the pension comes back with its rate and its indexation intact',
    after.pensionPeriod === 'weekly' && after.pensionIndexed === false &&
    after.pensionAmount === before.pensionAmount,
    `${after.pensionAmount} ${after.pensionPeriod}, indexed ${after.pensionIndexed}`);
  check('F57d so the plan reloads to the same answer, to the cent',
    close(after.need, before.need, 0.01),
    `${before.need.toFixed(2)} -> ${after.need.toFixed(2)}`);
  await page.evaluate(() => { try { localStorage.removeItem('abt:save:financialfreedom:v1'); } catch(e){} });
}

check('F32 no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | ') || 'clean');

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
