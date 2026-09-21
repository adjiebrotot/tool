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
    mdd: ui.mdd / 100,
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
  const flat = await engine(ui,
    'F.drawdownPath(P, F.requiredPot(P, P.ageRetire), P.ageRetire, 120).terminal');
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
  const term = await engine(ui,
    'F.drawdownPath(P, F.requiredPot(P, P.ageRetire), P.ageRetire, P.ageDie).terminal');
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
  const res = await engine(ui, `(function(){
    var W = F.requiredPot(P, P.ageRetire);
    var ha = P.mode === 'rich' ? Math.max(120, P.ageDie) : P.ageDie;
    var d = F.drawdownPath(P, W, P.ageRetire, ha);
    return {W: W, min: d.min, terminal: d.terminal};
  })()`);
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
  const term = await engine(ui,
    'F.drawdownPath(P, F.requiredPot(P, P.ageRetire), P.ageRetire, P.ageDie).terminal');
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
  const r = await engine(ui, `(function(){
    var W = F.requiredPot(P, P.ageRetire);
    var d = F.drawdownPath(P, W, P.ageRetire, 130);
    return {W: W, at120: d.path[Math.round((120 - P.ageRetire) * 12)], terminal: d.terminal, min: d.min};
  })()`);
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
    var det = F.lifetimePath(P, 0);
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

console.log('\n── Stress test ──');

// F16: the shock is a scalar multiplier at the retirement month, and the pot
//      that survives it is the ordinary pot grossed back up by it.
{
  const ui = Object.assign({}, base, {mdd: -50});
  const r = await engine(ui, `(function(){
    var W = 1000000;
    var d = F.drawdownPath(P, W, P.ageRetire, P.ageDie, {shock: P.mdd});
    return {first: d.path[0], need: F.requiredPot(P, P.ageRetire), stress: F.stressRequiredPot(P)};
  })()`);
  check('F16 the crash multiplies the pot the month retirement starts',
    close(r.first, 1000000 * 0.5, 1e-6), `after the shock ${r.first.toFixed(2)}`);
  check('F16b the pot that survives a crash is the ordinary pot divided by what survives it',
    close(r.stress, r.need / 0.5, 0.01),
    `page ${r.stress.toFixed(2)} vs ${(r.need / 0.5).toFixed(2)}`);
  const surv = await engine(ui,
    'F.drawdownPath(P, F.stressRequiredPot(P), P.ageRetire, P.ageDie, {shock: P.mdd}).min');
  check('F16c and a pot that size really does survive it', surv >= -1e-6, `min ${surv.toFixed(4)}`);
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
  check('F17c and no drawdown', Math.abs(r.smooth.mdd) < 1e-9, `got ${r.smooth.mdd}%`);
  // The series keeps compounding through the gap, so the trough sits one
  // daily step above the peak: the true depth is 0.70 * step - 1, not -30%.
  const wantMdd = (0.70 * Math.pow(1.10, 1 / 252) - 1) * 100;
  check('F17d a single 30% gap down is measured peak-to-trough',
    Math.abs(r.crash.mdd - wantMdd) < 0.005,
    `got ${r.crash.mdd.toFixed(4)}%, want ${wantMdd.toFixed(4)}%`);
  const tiny = await engine(base, 'F.tickerStats(["2020-01-01","2020-01-02"], [100, 101])');
  check('F17e a series too short to measure returns null', tiny === null, `got ${JSON.stringify(tiny)}`);
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
      c.data.datasets.forEach(d => { seen.push(d.borderColor, d.backgroundColor); });
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
    mdd: parseFloat(document.getElementById('mdd').value),
    preset: document.getElementById('assetPreset').value,
    cached: window.SharedPriceCache.tickers(),
    entry: window.SharedPriceCache.entry('FAKE'),
    stored: !!localStorage.getItem('dca_priceCache_v2'),
    status: document.getElementById('tickerStatus').textContent
  }));
  // The crash in this series is a single day that recovers straight away, so it
  // belongs in the drawdown and NOT in the compound return. The two statistics
  // measure different things and this pins that apart.
  check('F33 a fetched ticker fills the return field from its own price history',
    Math.abs(r.ret - 9) < 0.3, `got ${r.ret}% a year, want 9%`);
  check('F33b and the drawdown field from its worst fall, which the return ignores',
    Math.abs(r.mdd + 45) < 1, `got ${r.mdd}%`);
  check('F33b2 and a volatility that the crash pushes above the smooth case',
    r.std > 5 && isFinite(r.std), `got ${r.std}%`);
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

  check('F37 the table carries the living cost itself', r.heads.includes('Living cost'),
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
    lines.length > 2 && lines[2] === 'Year,Age,Living_cost,Saved_or_spent,Balance,Pot_needed,Gap',
    lines[2] || 'no header');
  check('F39c one row per year, matching the table',
    lines.length - 3 === (await page.evaluate(() => window.__FF.tableRows(window.__FF.last).length)),
    `${lines.length - 3} rows`);
  check('F39d and says which money and which currency it is in',
    /today's money|future dollars/.test(lines[1] || ''), (lines[1] || '').replace('# ', ''));
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
