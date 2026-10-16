// Capacity Expansion Planner audit.
//
//   node capacityexpansion-planner/_audit/run.mjs
//
// The tool's answers are held to things it did not compute itself:
//
//   A0  A saved plan never breaks the tool: garbage, missing keys, unknown
//       kinds and out-of-range values all read back to something valid, and a
//       plan written and read again is the same plan.
//   A1  The typical days, rebuilt from their documented rules: every hour's
//       weight, demand and sun and wind shape, the weights add up to a year,
//       the year's peak is 1, and every solar and wind farm gives exactly its
//       capacity factor over the year with no hour above 1.
//   A2  Every plan replayed from its definition, by code that shares nothing
//       with PSA.js: what is in service in each decision year (build year and
//       lifetime), the demand met in every sampled hour, every output inside
//       its availability, storage that keeps its energy balance and ends each
//       year where it started, build limits, whole units, net zero, and the
//       costs (annuities, fixed and running costs, carbon, lost load,
//       discounting), which must add up to PyPSA's objective. Every Quick
//       Start in two samplings, and 24 seeded random plans.
//   A3  The plan is optimal. With firm plants only and one decision year, the
//       least-cost mix has a closed form, the screening curve: each slice of
//       the load duration curve is served by whichever plant (or lost load) is
//       cheapest for the hours it lasts. 20 seeded cases must cost exactly
//       that. Over two decision years, 12 seeded cases are solved again by
//       enumerating every build of two plants in each year on a grid, each
//       hour dispatched by merit order: the tool's plan must cost no more
//       than the best of them.
//   A4  The engine files are the ones their banners name (sha256): the
//       planner runs on the ED/UC Simulator's build of PSA.js.
//   B   The real page in headless Chromium: the solve runs in its worker and
//       gives the same numbers as this file's; the KPIs and the CSV tables say
//       what the results say; the Run gate is honest; hostile saved state
//       never breaks it.

import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TOOL = join(HERE, '..');
const ROOT = join(TOOL, '..');
const ENGINE = join(ROOT, 'ed-uc-simulator', 'engine');
let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  console.log((ok ? '  PASS  ' : '✗ FAIL  ') + name + (detail ? '  — ' + detail : ''));
  ok ? pass++ : fail++;
};
const e1 = x => (typeof x === 'number' ? x.toExponential(1) : String(x));

/* ── The engine and the core, as the worker loads them ── */
const psa = await import(pathToFileURL(join(ENGINE, 'psa-opt.min.js')).href);
psa.logger.handler = () => {};
await import(pathToFileURL(join(TOOL, 'cx-core.js')).href);
const CX = globalThis.CX;

// Seeded random numbers, so a failure can be replayed.
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/* ── The definition, written out again ──
   Only the data tables (the shapes, the climates, the stress day's factors)
   are read from the tool; every rule that turns them into numbers is here. */
function periodsOf(o) {
  const out = [];
  for (let y = o.start; y <= o.end; y += o.step) out.push({ year: y, years: Math.min(o.step, o.end + 1 - y) });
  return out;
}
function discountOf(o, P) {
  const r = o.rate / 100;
  return P.map(p => { let s = 0; for (let j = 0; j < p.years; j++) s += Math.pow(1 + r, -(p.year - o.start + j)); return s; });
}
function annuity(r, n) { return r === 0 ? 1 / n : r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1); }
// The year's sampled hours: per season, a weekday; a weekday and a weekend day;
// or Monday to Sunday; and the still, overcast day at the peak.
function sampleOf(model, o) {
  const seasons = CX.CLIMATES[o.climate].seasons;
  const shape = o.profile === 'custom' && Array.isArray(model.prof) ? { h: model.prof } : CX.PROFILES[o.profile === 'custom' ? 'sys' : o.profile];
  let peak = 0;
  seasons.forEach((s, i) => { if (s.dem > seasons[peak].dem) peak = i; });
  const days = [];
  seasons.forEach((s, i) => {
    const n = s.days - (o.stress && i === peak ? CX.STRESS.days : 0);
    if (o.sample === 'week') for (let d = 0; d < 7; d++) days.push({ s, d, we: d >= 5, w: n / 7, week: true });
    else if (o.sample === 'day2') { days.push({ s, d: 0, we: false, w: n * 5 / 7 }); days.push({ s, d: 5, we: true, w: n * 2 / 7 }); }
    else days.push({ s, d: 0, we: false, w: n });
  });
  if (o.stress) days.push({ s: seasons[peak], d: 0, we: false, w: CX.STRESS.days, stress: true });
  const w = [], load = [], sun = [], wind = [];
  for (const dy of days) for (let h = 0; h < 24; h++) {
    let v = (dy.we && shape.w ? shape.w[h] : shape.h[h]) * (dy.week && shape.d ? shape.d[dy.d] : 1) * dy.s.dem;
    load.push(Math.max(0, v));
    sun.push(CX.PROFILES[dy.s.sol].h[h] * dy.s.solf * (dy.stress ? CX.STRESS.sun : 1) * (dy.week ? CX.SUN_WEEK[dy.d] : 1));
    wind.push(CX.PROFILES.wnd.h[h] * dy.s.wind * (dy.stress ? CX.STRESS.wind : 1) * (dy.week ? CX.WIND_WEEK[dy.d] : 1));
    w.push(dy.w);
  }
  const top = Math.max(...load);
  return { H: w.length, w, load: load.map(v => v / top), sun, wind };
}

/* ── A0: reading a saved plan ── */
console.log('\n── A0 saved plans ──');
{
  let threw = 0, bad = 0;
  const junk = [null, 1, 'x', [], { tech: 'no' }, { tech: [null, 3, 'a', { id: 'x' }] }, { tech: [{ id: 1, kind: 'fusion', capex: 'cheap', life: -4, cf: 9, retire: 1700 }] },
    { tech: [{ id: 2 }, { id: 2 }, { id: -5 }], next: 'z', prof: [1, 2] }, { v: 99, tech: [{ id: 1, kind: 'PV', build: 'yes', max: 1e12, learn: -5 }] }];
  for (const j of junk) {
    try {
      const m = CX.load(j);
      const ids = new Set(m.tech.map(t => t.id));
      if (ids.size !== m.tech.length || m.tech.some(t => !(t.id > 0) || CX.KINDS.indexOf(t.kind) < 0 || !(t.life >= 1) || !(t.cf <= 0.95) || (t.retire && t.retire < 1900)) || !(m.next > Math.max(0, ...m.tech.map(t => t.id)))) bad++;
    } catch (e) { threw++; }
  }
  check('A0 garbage never throws and always reads back to a valid plan', threw === 0 && bad === 0, junk.length + ' inputs, ' + threw + ' threw, ' + bad + ' invalid');
  const m = CX.load({ tech: [{ id: 1, kind: 'PV', build: 'yes', learn: -5 }] });
  check('A0 a kind in other case is the kind, a flag in words is read, a value past its range is held to it', m.tech[0].kind === 'pv' && m.tech[0].learn === -0.2, JSON.stringify(m.tech[0]).slice(0, 80));
  let same = 0;
  for (const k of Object.keys(CX.PRESETS)) {
    const a = CX.load(CX.PRESETS[k].plan), b = CX.load(JSON.parse(JSON.stringify(CX.compact(a))));
    if (JSON.stringify(a) === JSON.stringify(b)) same++;
  }
  check('A0 every Quick Start written and read again is the same plan', same === Object.keys(CX.PRESETS).length, same + ' of ' + Object.keys(CX.PRESETS).length);
  const empty = CX.compact(CX.load({ tech: [{ id: 4 }] }));
  check('A0 only what differs from the defaults is written', JSON.stringify(empty.tech[0]) === '{"id":4}', JSON.stringify(empty));
}

/* ── A1: the typical days ── */
console.log('\n── A1 the typical days ──');
{
  let worst = 0, sums = 0, peaks = 0, cfBad = 0, shapeBad = 0, n = 0;
  const model = CX.load(CX.PRESETS.grow.plan);
  for (const climate of Object.keys(CX.CLIMATES)) for (const sample of CX.SAMPLES) for (const stress of [true, false]) for (const profile of CX.LOAD_KEYS) {
    const o = CX.options({ climate, sample, stress, profile });
    const S = CX.sample(model, o), R = sampleOf(model, o);
    n++;
    if (S.H !== R.H) { worst = Infinity; continue; }
    for (let t = 0; t < R.H; t++) worst = Math.max(worst, Math.abs(S.w[t] - R.w[t]), Math.abs(S.load[t] - R.load[t]), Math.abs(S.sun[t] - R.sun[t]), Math.abs(S.wind[t] - R.wind[t]));
    if (Math.abs(R.w.reduce((a, b) => a + b, 0) - 8760) > 1e-9) sums++;
    if (Math.abs(Math.max(...S.load) - 1) > 1e-12) peaks++;
    for (const cf of [0.12, 0.22, 0.35, 0.5]) for (const kind of ['pv', 'wind']) {
      const av = CX.avail({ kind, cf }, S);
      if (!av.reach) continue;
      let e = 0;
      for (let t = 0; t < S.H; t++) e += S.w[t] * av.a[t];
      if (Math.abs(e / 8760 - cf) > 1e-6 || av.a.some(v => v > 1 + 1e-12 || v < 0)) cfBad++;
      // Below its cap, every hour is the same multiple of the raw shape.
      const raw = kind === 'pv' ? R.sun : R.wind;
      let k = null;
      for (let t = 0; t < S.H; t++) if (av.a[t] < 1 - 1e-9 && raw[t] > 1e-9) { const r = av.a[t] / raw[t]; if (k === null) k = r; else if (Math.abs(r / k - 1) > 1e-9) shapeBad++; }
    }
  }
  check('A1 every sampled hour has the weight, demand, sun and wind its rules give', worst < 1e-12, n + ' samplings, worst ' + e1(worst));
  check('A1 the typical days stand for exactly a year, 8,760 hours', sums === 0, sums + ' off');
  check('A1 the highest hour of demand is the year\'s peak', peaks === 0, peaks + ' off');
  check('A1 solar and wind give their capacity factor over the year, no hour above their rating', cfBad === 0, cfBad + ' off');
  check('A1 solar and wind keep their shape below the rating', shapeBad === 0, shapeBad + ' hours off shape');
}

/* ── A2: the replay ── */
function replay(model, opts, res) {
  const o = CX.options(opts), P = periodsOf(o), disc = discountOf(o, P), S = sampleOf(model, o), H = S.H, K = P.length, r = o.rate / 100;
  const w = { years: 0, disc: 0, cap: 0, balance: 0, load: 0, avail: 0, store: 0, soc: 0, limit: 0, unit: 0, netzero: 0, cost: 0, objective: 0, npv: 0 };
  const bump = (k, v) => { if (!(v <= w[k])) w[k] = v; };
  if (JSON.stringify(res.periods) !== JSON.stringify(P.map(p => p.year)) || JSON.stringify(res.years) !== JSON.stringify(P.map(p => p.years))) w.years = 1;
  disc.forEach((d, k) => bump('disc', Math.abs(d - res.disc[k])));
  const ann = { capex: Array(K).fill(0), fom: Array(K).fill(0), fomOld: Array(K).fill(0), vom: Array(K).fill(0), co2: Array(K).fill(0), shed: Array(K).fill(0) };
  const supply = P.map(() => new Array(H).fill(0));
  for (const e of model.tech) {
    const d = res.tech[e.id];
    // In service: the existing plant until it retires, each build from its year for its life.
    const exist = P.map(p => e.exist > 0 && (!e.retire || p.year < e.retire) ? e.exist : 0);
    const cap = P.map((p, k) => exist[k] + d.vint.filter(v => v.year <= p.year && p.year < v.year + e.life).reduce((s, v) => s + v.mw, 0));
    cap.forEach((c, k) => bump('cap', Math.abs(c - d.cap[k]) / Math.max(1, c)));
    // Builds only in decision years it may be built in, and in whole units.
    for (const v of d.vint) {
      if (!e.build || (e.from && v.year < e.from) || !P.some(p => p.year === v.year)) bump('cap', 1);
      if (e.unit > 0) bump('unit', Math.abs(v.mw / e.unit - Math.round(v.mw / e.unit)));
      bump('cost', Math.abs(v.capex - e.capex * Math.pow(1 + e.learn, v.year - o.start)) / Math.max(1, e.capex));
    }
    if (e.max > 0 && e.build) P.forEach((p, k) => { if (exist[k] <= e.max) bump('limit', (cap[k] - e.max) / e.max); });
    const avail = e.kind === 'firm' ? null : e.kind === 'store' ? null : (() => {
      const raw = e.kind === 'pv' ? S.sun : S.wind;
      // The scale that gives the capacity factor, found again here.
      let lo = 0, hi = 1;
      const en = k => { let s = 0; for (let t = 0; t < H; t++) s += S.w[t] * Math.min(1, k * raw[t]); return s / 8760; };
      while (en(hi) < e.cf && hi < 1e6) hi *= 2;
      for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (en(m) < e.cf) lo = m; else hi = m; }
      return raw.map(x => Math.min(1, hi * x));
    })();
    const eta = Math.sqrt(e.rte);
    P.forEach((p, k) => {
      const carbon = o.carbon * Math.pow(1 + o.carbonGrow / 100, p.year - o.start);
      // The annuity on every build in service, fixed O&M on everything in service.
      d.vint.forEach(v => { if (v.year <= p.year && p.year < v.year + e.life) ann.capex[k] += v.mw * v.capex * 1000 * annuity(r, e.life); });
      ann.fom[k] += cap[k] * e.fom * 1000;
      ann.fomOld[k] += exist[k] * e.fom * 1000;
      for (let t = 0; t < H; t++) {
        if (e.kind === 'store') {
          const pin = d.pin[k][t], pout = d.pout[k][t], soc = d.soc[k][t];
          bump('store', Math.max(-pin, -pout, pin - cap[k], pout - cap[k]) / Math.max(1, cap[k]));
          bump('soc', Math.max(-soc, soc - cap[k] * e.hours) / Math.max(1, cap[k] * e.hours));
          // Energy in at the square root of the round trip, out at the same, and round the year.
          const prev = d.soc[k][(t - 1 + H) % H];
          bump('soc', Math.abs(soc - (prev + eta * pin - pout / eta)) / Math.max(1, cap[k] * e.hours));
          supply[k][t] += pout - pin;
          ann.vom[k] += S.w[t] * pout * e.vom;
        } else {
          const pt = d.p[k][t], a = e.kind === 'firm' ? e.avail : avail[t];
          bump('avail', Math.max(-pt, pt - a * cap[k]) / Math.max(1, cap[k]));
          supply[k][t] += pt;
          ann.vom[k] += S.w[t] * pt * e.vom;
          if (e.kind === 'firm') {
            ann.co2[k] += S.w[t] * pt * e.co2 * carbon;
            if (o.netZero && p.year >= o.nzYear && e.co2 > 0) bump('netzero', S.w[t] * pt * e.co2);
          }
        }
      }
    });
  }
  P.forEach((p, k) => {
    const peak = o.peak * Math.pow(1 + o.growth / 100, p.year - o.start);
    for (let t = 0; t < H; t++) {
      const load = peak * S.load[t], shed = res.shed[k][t];
      bump('load', Math.abs(load - res.load[k][t]) / peak);
      if (!o.shed) bump('balance', shed);
      bump('balance', Math.max(-shed, Math.abs(supply[k][t] + shed - load) / peak));
      ann.shed[k] += S.w[t] * shed * o.voll;
    }
  });
  let npv = 0, objective = 0;
  P.forEach((p, k) => {
    const T = res.totals;
    [['capex', 'capex'], ['fom', 'fom'], ['vom', 'vom'], ['co2', 'co2cost'], ['shed', 'shedCost']].forEach(([a, b]) => bump('cost', Math.abs(ann[a][k] - T[b][k]) / Math.max(1e3, Math.abs(ann[a][k]))));
    const total = ann.capex[k] + ann.fom[k] + ann.vom[k] + ann.co2[k] + ann.shed[k];
    npv += disc[k] * total;
    objective += disc[k] * (total - ann.fomOld[k]);
  });
  bump('npv', Math.abs(npv - res.totals.npv) / Math.max(1, npv));
  bump('objective', Math.abs(objective - res.totals.objective) / Math.max(1, Math.abs(objective)));
  return w;
}
const TOL = { years: 0, disc: 1e-12, cap: 1e-6, balance: 1e-6, load: 1e-9, avail: 1e-6, store: 1e-6, soc: 1e-6, limit: 1e-6, unit: 1e-6, netzero: 1e-3, cost: 1e-6, objective: 1e-6, npv: 1e-9 };
function holds(w) { return Object.keys(TOL).filter(k => !(w[k] <= TOL[k])); }

function randomPlan(seed) {
  const R = rng(seed), pick = a => a[Math.floor(R() * a.length)], rnd = (a, b) => a + (b - a) * R();
  const start = 2025 + Math.floor(R() * 4), step = pick([1, 2, 3, 5, 10]);
  const end = start + Math.min(step * (2 + Math.floor(R() * 4)), 30) - 1;
  const o = { peak: Math.round(rnd(50, 3000)), growth: +rnd(-1, 6).toFixed(1), profile: pick(CX.LOAD_KEYS), start, end, step,
    shed: R() < 0.85, voll: pick([5000, 15000, 30000]), carbon: R() < 0.5 ? Math.round(rnd(10, 120)) : 0, carbonGrow: +rnd(0, 8).toFixed(1),
    netZero: R() < 0.25, nzYear: start + step * (1 + Math.floor(R() * 2)), rate: +rnd(0, 12).toFixed(1),
    climate: pick(Object.keys(CX.CLIMATES)), sample: pick(['day', 'day2']), stress: R() < 0.7, time: 60, gap: 0.001 };
  const keys = Object.keys(CX.NEW), tech = [];
  const n = 2 + Math.floor(R() * 5);
  for (let i = 0; i < n; i++) {
    const t = Object.assign({ id: i + 1 }, CX.NEW[pick(keys)]);
    if (R() < 0.45) { t.exist = Math.round(rnd(0.1, 0.8) * o.peak); if (R() < 0.6) t.retire = start + Math.floor(rnd(1, 20)); }
    if (R() < 0.2) t.build = 0;
    t.capex = Math.round(t.capex * rnd(0.6, 1.4));
    if (R() < 0.3) t.max = Math.round(rnd(0.2, 1.5) * o.peak);
    if (R() < 0.15 && t.kind !== 'pv') t.unit = Math.round(rnd(0.05, 0.3) * o.peak);
    if (R() < 0.3) t.from = start + step;
    if (t.kind === 'pv' || t.kind === 'wind') t.cf = +rnd(0.12, 0.45).toFixed(3);
    if (t.kind === 'firm') { t.avail = +rnd(0.8, 1).toFixed(2); t.vom = Math.round(t.vom * rnd(0.6, 1.4)); }
    if (t.kind === 'store') { t.hours = pick([1, 2, 4, 8]); t.rte = +rnd(0.7, 0.95).toFixed(2); }
    t.life = Math.round(rnd(8, 40));
    tech.push(t);
  }
  // A plan that may not shed has something it can always build.
  if (!o.shed) tech.push(Object.assign({ id: n + 1 }, CX.NEW.ocgt));
  return { model: CX.load({ tech }), opts: o };
}

console.log('\n── A2 every plan replayed from its definition ──');
{
  const cases = [];
  for (const k of Object.keys(CX.PRESETS)) for (const sample of ['day', 'day2'])
    cases.push({ name: 'Quick Start ' + k + ', ' + sample, model: CX.load(CX.PRESETS[k].plan), opts: Object.assign({}, CX.PRESETS[k].fields, { sample }) });
  for (let s = 1; s <= 24; s++) { const c = randomPlan(1000 + s); c.name = 'random plan ' + s; cases.push(c); }
  let solved = 0, refused = 0;
  for (const c of cases) {
    const v = CX.validate(c.model, c.opts);
    if (v.errors.length) { refused++; check('A2 ' + c.name + ' is refused with a reason', v.errors.every(e => e.msg), v.errors[0].msg.slice(0, 80)); continue; }
    const res = await CX.solve(psa, c.model, c.opts);
    if (!res.report.ok) { check('A2 ' + c.name + ' solves', false, res.report.error); continue; }
    solved++;
    const w = replay(c.model, c.opts, res), bad = holds(w);
    check('A2 ' + c.name + ' holds every promise', bad.length === 0,
      bad.length ? bad.map(k => k + ' ' + e1(w[k])).join(', ') : res.periods.length + ' years × ' + res.H + ' h, objective ' + e1(res.totals.objective) + ' to ' + e1(w.objective) + ', balance ' + e1(w.balance) + ', soc ' + e1(w.soc) + (res.report.milp ? ', mixed-integer' : ''));
  }
  check('A2 the plans solved', solved >= cases.length - refused && solved > 20, solved + ' solved, ' + refused + ' refused before solving');
}

/* ── A3: optimality ── */
console.log('\n── A3 the plan is the cheapest ──');
// The screening curve: firm plants only, one year. Each slice of the load
// duration curve between two load levels lasts the hours the load is above
// it, and is served by whatever costs least for that many hours: a plant's
// annual fixed cost over its availability plus its running cost, or lost load.
{
  let worst = 0, n = 0;
  for (let s = 1; s <= 20; s++) {
    const R = rng(77 + s), pick = a => a[Math.floor(R() * a.length)], rnd = (a, b) => a + (b - a) * R();
    const o = CX.options({ peak: Math.round(rnd(100, 2000)), start: 2030, end: 2030, step: 1, rate: +rnd(1, 12).toFixed(1), profile: pick(CX.LOAD_KEYS),
      climate: pick(Object.keys(CX.CLIMATES)), sample: pick(CX.SAMPLES), stress: R() < 0.5, voll: pick([3000, 10000, 30000]), carbon: Math.round(rnd(0, 80)), shed: true });
    const tech = [];
    const m = 2 + Math.floor(R() * 3);
    for (let i = 0; i < m; i++) tech.push(Object.assign({ id: i + 1 }, CX.NEW[pick(['ccgt', 'ocgt', 'coal', 'nuclear', 'diesel', 'geo'])],
      { capex: Math.round(rnd(300, 6000)), fom: Math.round(rnd(5, 120)), vom: Math.round(rnd(5, 250)), avail: +rnd(0.75, 1).toFixed(2), life: Math.round(rnd(10, 50)) }));
    const model = CX.load({ tech });
    const res = await CX.solve(psa, model, o);
    if (!res.report.ok) { check('A3 screening case ' + s + ' solves', false, res.report.error); continue; }
    const S = sampleOf(model, o), r = o.rate / 100;
    const levels = [...new Set(S.load.map(v => v * o.peak))].sort((a, b) => b - a).concat([0]);
    const per = model.tech.map(e => ({ F: (e.capex * 1000 * annuity(r, e.life) + e.fom * 1000) / e.avail, c: e.vom + e.co2 * o.carbon }));
    let cost = 0;
    for (let i = 0; i < levels.length - 1; i++) {
      const top = levels[i], h = top - levels[i + 1];
      let D = 0;
      for (let t = 0; t < S.H; t++) if (S.load[t] * o.peak >= top - 1e-9) D += S.w[t];
      cost += h * Math.min(o.voll * D, ...per.map(p => p.F + p.c * D));
    }
    worst = Math.max(worst, Math.abs(cost - res.totals.npv) / cost);
    n++;
  }
  check('A3 with firm plants only, every mix is the screening curve\'s, to the dollar', worst < 1e-7, n + ' cases, worst ' + e1(worst));
}
// Two decision years and two plants, enumerated. A build in the first year
// may still run in the second (its life decides); each hour is served by
// merit order, any shortfall shed at the value of lost load.
{
  let worse = 0, n = 0, gapSum = 0;
  for (let s = 1; s <= 12; s++) {
    const R = rng(500 + s), pick = a => a[Math.floor(R() * a.length)], rnd = (a, b) => a + (b - a) * R();
    const o = CX.options({ peak: 1000, growth: +rnd(1, 9).toFixed(1), start: 2030, end: 2039, step: 5, rate: +rnd(2, 10).toFixed(1), profile: pick(CX.LOAD_KEYS),
      climate: pick(Object.keys(CX.CLIMATES)), sample: 'day', stress: R() < 0.5, voll: 8000, shed: true });
    const tech = [
      Object.assign({ id: 1 }, CX.NEW.coal, { capex: Math.round(rnd(1500, 3500)), vom: Math.round(rnd(20, 40)), avail: 1, life: pick([4, 8, 30]), learn: -rnd(0, 0.06) }),
      Object.assign({ id: 2 }, CX.NEW.ocgt, { capex: Math.round(rnd(500, 900)), vom: Math.round(rnd(80, 140)), avail: 1, life: pick([4, 8, 30]), learn: -rnd(0, 0.06) })
    ];
    const model = CX.load({ tech }), res = await CX.solve(psa, model, o);
    if (!res.report.ok) { check('A3 two-year case ' + s + ' solves', false, res.report.error); continue; }
    const P = periodsOf(o), disc = discountOf(o, P), S = sampleOf(model, o), r = o.rate / 100;
    const peaks = P.map(p => o.peak * Math.pow(1 + o.growth / 100, p.year - o.start));
    const STEP = 20, top = Math.ceil(peaks[1] / STEP) * STEP, nG = top / STEP + 1;
    const unit = model.tech.map(e => P.map(p => e.capex * Math.pow(1 + e.learn, p.year - o.start) * 1000 * annuity(r, e.life) + e.fom * 1000));
    const order = [0, 1].sort((a, b) => model.tech[a].vom - model.tech[b].vom);
    // The running cost of a year for a pair of capacities, by merit order.
    const runCost = (k, caps) => {
      let c = 0;
      for (let t = 0; t < S.H; t++) {
        let left = peaks[k] * S.load[t];
        for (const i of order) { const g = Math.min(left, caps[i]); c += S.w[t] * g * model.tech[i].vom; left -= g; }
        c += S.w[t] * left * o.voll;
      }
      return c;
    };
    // Every capacity pair a year can hold, a build of each year and what lives on from the first.
    const rc = [0, 1].map(k => { const m = []; for (let a = 0; a < 2 * nG; a++){ m.push([]); for (let b = 0; b < 2 * nG; b++) m[a].push(runCost(k, [a * STEP, b * STEP])); } return m; });
    const live = [0, 1].map(i => P[0].year + model.tech[i].life > P[1].year);
    let best = Infinity;
    for (let a1 = 0; a1 < nG; a1++) for (let b1 = 0; b1 < nG; b1++) {
      const year1 = disc[0] * (a1 * STEP * unit[0][0] + b1 * STEP * unit[1][0] + rc[0][a1][b1]);
      if (year1 >= best) continue;
      // An annuity is paid for every decision year the build is in service.
      const carried = (live[0] ? a1 * STEP * unit[0][0] : 0) + (live[1] ? b1 * STEP * unit[1][0] : 0);
      for (let a2 = 0; a2 < nG; a2++) for (let b2 = 0; b2 < nG; b2++) {
        const A = a2 + (live[0] ? a1 : 0), B = b2 + (live[1] ? b1 : 0);
        const total = year1 + disc[1] * (a2 * STEP * unit[0][1] + b2 * STEP * unit[1][1] + carried + rc[1][A][B]);
        if (total < best) best = total;
      }
    }
    if (res.totals.npv > best * (1 + 1e-7)) worse++;
    gapSum += (best - res.totals.npv) / best;
    n++;
  }
  check('A3 over two decision years, no enumerated plan is cheaper than the tool\'s', worse === 0, n + ' cases, the best grid plan averages ' + (100 * gapSum / Math.max(1, n)).toFixed(3) + '% dearer');
}

/* ── A4: the engine ── */
console.log('\n── A4 the engine ──');
{
  const text = readFileSync(join(ENGINE, 'psa-opt.min.js'), 'utf8');
  const m = /sha256 of the code below: ([0-9a-f]{64})/.exec(text);
  const body = text.slice(text.indexOf('*/\n') + 3);
  const got = createHash('sha256').update(body).digest('hex');
  check('A4 engine/psa-opt.min.js hashes to the sha256 in its banner', !!m && m[1] === got, got.slice(0, 16));
  const banner = readFileSync(join(ENGINE, 'highs.mjs'), 'utf8').split('\n')[0];
  const mw = /highs\.wasm sha256 ([0-9a-f]{64})/.exec(banner);
  const gw = createHash('sha256').update(readFileSync(join(ENGINE, 'highs.wasm'))).digest('hex');
  check('A4 engine/highs.wasm hashes to the sha256 named in highs.mjs', !!mw && mw[1] === gw, gw.slice(0, 16));
}

/* ── B: the real page ── */
console.log('\n── B the page ──');
{
  const LIBS = join(ROOT, '_ref', '.libcache');
  const haveLibs = ['chart.umd.min.js', 'chartjs-plugin-zoom.min.js', 'hammer.min.js'].every(f => existsSync(join(LIBS, f)));
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain' };
  const server = createServer((req, res) => {
    const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
    let file = join(ROOT, rel);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const ORIGIN = 'http://127.0.0.1:' + server.address().port;
  const browser = await pw.chromium.launch();
  const open = async (init) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', acceptDownloads: true });
    await ctx.addInitScript(() => { try { localStorage.setItem('abt:ctrl:' + location.pathname.replace(/index\.html?$/, ''), '1'); localStorage.setItem('capacityexpansion-planner-tour-v1-seen', '1'); } catch (e) {} });
    if (init) await ctx.addInitScript(init);
    await ctx.route('**', async route => {
      const url = route.request().url();
      if (url.startsWith(ORIGIN)) return route.continue();
      const lib = ['chart.umd.min.js', 'chartjs-plugin-zoom.min.js', 'hammer.min.js'].find(f => url.endsWith(f));
      if (lib && haveLibs) return route.fulfill({ status: 200, contentType: 'text/javascript', body: readFileSync(join(LIBS, lib), 'utf8') });
      const type = route.request().resourceType();
      if (type === 'script') return route.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
      if (type === 'stylesheet') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
      return route.abort();
    });
    const page = await ctx.newPage();
    page.__errors = [];
    page.on('pageerror', e => page.__errors.push(e.message));
    await page.goto(ORIGIN + '/capacityexpansion-planner/', { waitUntil: 'load' });
    return { ctx, page };
  };
  const solved = page => page.waitForFunction(() => window.__cx && __cx.app.res && __cx.app.res.report && !document.getElementById('runBtn').disabled, null, { timeout: 90000 });
  const { ctx, page } = await open();
  await solved(page);
  const marked = await page.evaluate(() => !!performance.getEntriesByName('cx-solved').length);
  check('B the first plan solves on arrival', marked && await page.evaluate(() => __cx.app.res.report.ok), await page.evaluate(() => __cx.app.res.report.ms + ' ms'));
  for (const key of Object.keys(CX.PRESETS)) {
    await page.click('.quick-start-btn[data-preset="' + key + '"]');
    await page.waitForFunction(k => document.querySelector('.quick-start-btn.active') && document.querySelector('.quick-start-btn.active').dataset.preset === k && __cx.app.res && __cx.app.res.report && !document.getElementById('runBtn').disabled && !document.body.classList.contains('is-stale'), key, { timeout: 90000 });
    const got = await page.evaluate(() => ({ raw: __cx.app.res.raw, npv: __cx.app.res.totals.npv, kpi: document.getElementById('mNpv').textContent, built: document.getElementById('mBuilt').textContent }));
    const p = CX.PRESETS[key], here = await CX.solve(psa, CX.load(p.plan), Object.assign({}, p.fields));
    const same = JSON.stringify(got.raw) === JSON.stringify(here.raw);
    check('B "' + key + '" solved in the page is the same plan as here, to the number', same, same ? got.built + ' built, ' + got.kpi : 'differs');
    check('B "' + key + '" Present cost reads the result', got.kpi === CX.fmt.big(here.totals.npv, '$') && got.built === CX.fmt.mw(here.totals.built) + ' MW', got.kpi + ' / ' + CX.fmt.big(here.totals.npv, '$'));
  }
  // The capacity table adds up to what the result says is in service.
  const table = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#tableWrap tbody tr')].map(tr => [...tr.cells].map(td => td.textContent));
    const res = __cx.app.res, total = rows.find(r => r[0] === 'Total');
    const want = res.periods.map((_, k) => res.order.reduce((s, id) => s + res.tech[id].cap[k], 0));
    return { total: total ? total.slice(1) : null, want: want.map(v => window.CX.fmt.mw(v)) };
  });
  check('B the Capacity table totals what is in service', JSON.stringify(table.total) === JSON.stringify(table.want), (table.total || []).join(' '));
  // The Run gate: a change dims the answer and lights the button; Run clears it.
  await page.evaluate(() => { const g = document.getElementById('cxGrowth'); g.value = '4.5'; g.dispatchEvent(new Event('input', { bubbles: true })); });
  const stale = await page.evaluate(() => document.body.classList.contains('is-stale') && document.getElementById('runBtn').classList.contains('needs-run'));
  await page.click('#runBtn');
  await page.waitForFunction(() => !document.getElementById('runBtn').disabled && !document.body.classList.contains('is-stale'), null, { timeout: 90000 });
  const fresh = await page.evaluate(() => __cx.app.res.report.opts.growth === 4.5);
  check('B the Run gate dims a changed plan until it is run, then solves what is on screen', stale && fresh);
  // A technology edited in its card changes the plan, and a duplicate is a new one.
  await page.evaluate(() => { document.querySelector('.ctrl-tab[data-tab="tech"]').click(); });
  await page.click('.tech-card[data-id="1"] .tech-toggle');
  await page.fill('.tech-card[data-id="1"] input[data-k="capex"]', '777');
  await page.click('.tech-card[data-id="1"] .tech-dup');
  const edited = await page.evaluate(() => { const t = __cx.app.model.tech; return { capex: t[0].capex, n: t.length, copy: t[1].capex, ids: new Set(t.map(x => x.id)).size === t.length }; });
  check('B a card edits its technology, and a duplicate is a technology of its own', edited.capex === 777 && edited.copy === 777 && edited.ids, JSON.stringify(edited));
  check('B no page errors', page.__errors.length === 0, page.__errors.join(' | ').slice(0, 200));
  await ctx.close();
  // Hostile saved state: the mini cache holds nonsense, and the page still opens and solves.
  const hostile = await open(() => {
    try { localStorage.setItem('abt:save:capacityexpansion-planner:v1', JSON.stringify({ __fields: { 'v:cxPeak': 'lots', 'v:cxStart': '1066', 'v:cxEnd': '-4', 'v:cxStep': '7', 'v:cxClimate': 'mars' },
      __extra: { tech: [{ id: 'one', kind: 'fusion', capex: -9 }, null, { id: 3, kind: 'pv', cf: 40 }] } })); } catch (e) {}
  });
  await solved(hostile.page);
  const h = await hostile.page.evaluate(() => ({ ok: __cx.app.res.report.ok || !!__cx.app.res.report.blocked, n: __cx.app.model.tech.length }));
  check('B hostile saved state opens, reads back to a valid plan and solves', h.ok && hostile.page.__errors.length === 0, JSON.stringify(h) + (hostile.page.__errors[0] || ''));
  await hostile.ctx.close();
  await browser.close();
  server.close();
}

console.log(`\nCapacity Expansion Planner audit: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
