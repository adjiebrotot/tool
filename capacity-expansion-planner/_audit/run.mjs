// Capacity Expansion Planner audit.
//
//   node capacity-expansion-planner/_audit/run.mjs
//
// The tool's answers are held to things it did not compute itself:
//
//   A0  A saved plan never breaks the tool: garbage, missing keys, unknown
//       kinds and out-of-range values all read back to something valid, and a
//       plan written and read again is the same plan.
//       A plan saved before the profiles (v1), upgraded with the form it was
//       saved with, samples the year exactly as the v1 rules did.
//   A1  The typical days, rebuilt from their documented rules: the sampling
//       the profiles ask for, every hour's weight, demand and sun and wind
//       (built in, edited, with daily variability, or from a file), the
//       weights add up to a year, the year's peak is 1, the still day, and
//       every solar and wind farm gives exactly its capacity factor over the
//       year with no hour above 1, or its file's hours as they are.
//   A5  Profiles from a file: every layout the reader promises (24, 48 or
//       168 rows, labelled or in order, days as columns, a season column,
//       dates, notes, units) reads to what it holds; a template read back is
//       the profile it was written from; a bad file is refused with a reason
//       and nothing in it is used; garbage never throws.
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
await import(pathToFileURL(join(TOOL, 'cx-profiles.js')).href);
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
/* The v1 rules, as they were: the load profile and the sampling were form
   fields ({ profile, sample }), a typical week carried the cloudier and
   calmer days of every farm, the still day was the weekday of the peak
   season (the highest season level). Kept to hold an upgraded v1 plan to. */
function sampleV1(prof, o) {
  const seasons = CX.CLIMATES[o.climate].seasons;
  const shape = o.profile === 'custom' && Array.isArray(prof) ? { h: prof } : CX.PROFILES[o.profile === 'custom' ? 'sys' : o.profile];
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
    sun.push(CX.PROFILES[dy.s.sol].h[h] * dy.s.solf * (dy.stress ? CX.STRESS.sun : 1) * (dy.week ? [1, 0.9, 0.6, 1, 0.95, 0.75, 1][dy.d] : 1));
    wind.push(CX.PROFILES.wnd.h[h] * dy.s.wind * (dy.stress ? CX.STRESS.wind : 1) * (dy.week ? [1, 0.75, 1.2, 0.55, 0.9, 1.25, 0.8][dy.d] : 1));
    w.push(dy.w);
  }
  const top = Math.max(...load);
  return { H: w.length, w, load: load.map(v => v / top), sun, wind };
}
// A capacity factor's scale over a raw shape, found again here.
function scaleTo(raw, w, cf) {
  const H = raw.length, en = k => { let s = 0; for (let t = 0; t < H; t++) s += w[t] * Math.min(1, k * raw[t]); return s / 8760; };
  let lo = 0, hi = 1;
  while (en(hi) < cf && hi < 1e6) hi *= 2;
  for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (en(m) < cf) lo = m; else hi = m; }
  return raw.map(x => Math.min(1, hi * x));
}

/* The v2 rules, written out again from their definition (cx-core.js): the
   sampling is the finest any profile in the plan asks for; a load's day is
   its bars at the season's level, its weekend the shape's own moved by its
   edits, each day at its factor, or a file's hours as they are; the still
   day is the peak season's highest day (sd 'bars': its weekday as drawn); a
   farm follows the climate with its week of weather, or its file, whose
   still day is its clearest. */
const FINE = { day: 0, day2: 1, week: 2 }, NDAYS = { day: 1, day2: 2, week: 7 };
const isFile = p => p.base === 'custom' && !!p.ts;
function needOf(p, kind) { return isFile(p) ? p.ts.r : !p.dv ? 'day' : kind === 'load' ? p.dm : 'week'; }
function samplingOf(model, o) {
  const P = periodsOf(o), last = P[P.length - 1].year;
  let r = needOf(model.load, 'load');
  for (const e of model.tech) {
    if (e.kind !== 'pv' && e.kind !== 'wind') continue;
    if ((e.exist > 0 && (!e.retire || e.retire > o.start)) || (e.build && (!e.from || e.from <= last))) { const q = needOf(e.prof, e.kind); if (FINE[q] > FINE[r]) r = q; }
  }
  return r;
}
function fileSeries(ts, name) {
  if (ts.s[name]) return ts.s[name];
  if (ts.s['*']) return ts.s['*'];
  const ks = Object.keys(ts.s);
  return ts.s[ks[0]].map((_, i) => { let t = 0; for (const k of ks) t += ts.s[k][i]; return t / ks.length; });
}
const fileDay = (r, wd) => r === 'week' ? wd : r === 'day2' ? (wd >= 5 ? 1 : 0) : 0;
function loadDayOf(L, s, wd, still) {
  const out = [];
  if (isFile(L)) { const v = fileSeries(L.ts, s.name), d = fileDay(L.ts.r, wd); for (let h = 0; h < 24; h++) out.push(Math.max(0, v[d * 24 + h])); return out; }
  const p = CX.PROFILES[L.base === 'custom' ? 'sys' : L.base], hv = Array.isArray(L.hrs) ? L.hrs : p.h, we = wd >= 5;
  for (let h = 0; h < 24; h++) {
    let v = hv[h];
    if (L.dv && !(still && L.sd === 'bars')) {
      if (we && p.w) v = p.w[h] + (hv[h] - p.h[h]);
      v *= L.dm === 'week' ? (Array.isArray(L.f7) ? L.f7 : p.d || [1, 1, 1, 1, 1, 1, 1])[wd] : (Array.isArray(L.f2) ? L.f2 : [1, 1])[we ? 1 : 0];
    }
    out.push(Math.max(0, v) * s.dem);
  }
  return out;
}
function sampleOf(model, o) {
  const seasons = CX.CLIMATES[o.climate].seasons, L = model.load, r = samplingOf(model, o);
  const wds = { day: [0], day2: [0, 5], week: [0, 1, 2, 3, 4, 5, 6] }[r];
  let peak = 0, pwd = 0, top0 = -1;
  seasons.forEach((s, i) => wds.forEach(wd => { const m = Math.max(...loadDayOf(L, s, wd, false)); if (m > top0) { top0 = m; peak = i; pwd = wd; } }));
  const swd = !isFile(L) && L.sd === 'bars' ? 0 : pwd;
  const days = [];
  seasons.forEach((s, i) => {
    const n = s.days - (o.stress && i === peak ? CX.STRESS.days : 0);
    if (r === 'week') for (let d = 0; d < 7; d++) days.push({ i, s, d, w: n / 7 });
    else if (r === 'day2') { days.push({ i, s, d: 0, w: n * 5 / 7 }); days.push({ i, s, d: 5, w: n * 2 / 7 }); }
    else days.push({ i, s, d: 0, w: n });
  });
  if (o.stress) days.push({ i: peak, s: seasons[peak], d: swd, w: CX.STRESS.days, stress: true });
  const w = [], load = [], gen = {};
  for (const dy of days) { const ld = loadDayOf(L, dy.s, dy.d, dy.stress); for (let h = 0; h < 24; h++) { load.push(ld[h]); w.push(dy.w); } }
  const top = Math.max(...load);
  for (const e of model.tech) {
    if (e.kind !== 'pv' && e.kind !== 'wind') continue;
    const pv = e.kind === 'pv', p = e.prof, still = pv ? CX.STRESS.sun : CX.STRESS.wind, out = [];
    let clear = 0;
    if (isFile(p)) { const v = fileSeries(p.ts, seasons[peak].name); let most = -1; for (let q = 0; q < NDAYS[p.ts.r]; q++) { let t = 0; for (let h = 0; h < 24; h++) t += v[q * 24 + h]; if (t > most) { most = t; clear = q; } } }
    const week = p.dv && r === 'week' ? (Array.isArray(p.f7) ? p.f7 : pv ? [1, 0.9, 0.6, 1, 0.95, 0.75, 1] : [1, 0.75, 1.2, 0.55, 0.9, 1.25, 0.8]) : null;
    for (const dy of days) for (let h = 0; h < 24; h++) {
      if (isFile(p)) { const v = fileSeries(p.ts, dy.s.name); out.push(Math.max(0, v[(dy.stress ? clear : fileDay(p.ts.r, dy.d)) * 24 + h]) * (dy.stress ? still : 1)); continue; }
      let x = (pv ? CX.PROFILES[dy.s.sol].h[h] * dy.s.solf : CX.PROFILES.wnd.h[h] * dy.s.wind) * (dy.stress ? still : 1);
      if (week && !dy.stress) x *= week[dy.d];
      out.push(x);
    }
    gen[e.id] = out;
  }
  return { H: w.length, w, load: load.map(v => v / top), gen, sample: r };
}
// A farm's availability in each sampled hour: its file's as it is, else scaled to its capacity factor.
function availOf(e, S) { return isFile(e.prof) ? S.gen[e.id].map(x => Math.min(1, x)) : scaleTo(S.gen[e.id], S.w, e.cf); }

// Seeded random profiles: built in, edited, with daily variability, or a file of any sampling and seasons.
function randomProfile(R, kind, climate) {
  const pick = a => a[Math.floor(R() * a.length)], p = {};
  if (kind === 'load') {
    p.base = pick([...CX.LOAD_KEYS, 'custom']);
    if (R() < 0.3) p.hrs = Array.from({ length: 24 }, () => +(R() * 1.2).toFixed(2));
    p.dv = R() < 0.6 ? 1 : 0; p.dm = pick(['day2', 'week']);
    if (R() < 0.5) p.f2 = [+(0.5 + R() * 0.7).toFixed(2), +(0.5 + R() * 0.7).toFixed(2)];
    if (R() < 0.5) p.f7 = Array.from({ length: 7 }, () => +(0.5 + R() * 0.7).toFixed(2));
    if (R() < 0.2) p.sd = 'bars';
  } else {
    p.base = R() < 0.4 ? 'custom' : ''; p.dv = R() < 0.4 ? 1 : 0;
    if (R() < 0.5) p.f7 = Array.from({ length: 7 }, () => +(0.3 + R() * 0.9).toFixed(2));
  }
  if (p.base === 'custom' && R() > 0.08) {
    const r = pick(['day', 'day2', 'week']), n = 24 * NDAYS[r];
    // One series for every season, the climate's, or another climate's (which the plan averages).
    const names = R() < 0.3 ? ['*'] : R() < 0.85 ? CX.CLIMATES[climate].seasons.map(s => s.name) : CX.CLIMATES[pick(Object.keys(CX.CLIMATES))].seasons.map(s => s.name).slice(0, 2);
    p.ts = { r, s: {} };
    for (const nm of names) p.ts.s[nm] = Array.from({ length: n }, (_, i) => kind === 'load' ? +(0.3 + R()).toFixed(4) : +(Math.max(0, Math.sin(Math.PI * ((i % 24) - 6) / 12)) * (0.3 + 0.7 * R())).toFixed(4));
  }
  return p;
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
  check('A0 only what differs from the defaults is written', JSON.stringify(empty.tech[0]) === '{"id":4}' && !('load' in empty) && empty.v === 2, JSON.stringify(empty));
  // Profiles that make no sense read back to profiles that do.
  const odd = [{ v: 2, load: { base: 'nope', hrs: [1, 2], dv: 'yes', dm: 'month', f2: [9, -1], f7: 'x', sd: 'q', ts: { r: 'year', s: {} } },
                 tech: [{ id: 1, kind: 'pv', prof: { base: 'custom', dv: 7, f7: [1, 2, 3], ts: { r: 'week', s: { Summer: [1, 2], __proto__: [1] } } } }] },
               { v: 2, load: { base: 'custom', ts: { r: 'day', s: { Summer: Array(24).fill('x'), Winter: Array(24).fill(-3), '*': Array(24).fill(500) } } } },
               { v: 2, load: 7, tech: [{ id: 2, kind: 'wind', prof: 'windy' }] }, { v: '2', load: { ts: { r: 'day2', s: [] } } }];
  let pthrew = 0, pbad = 0;
  for (const j of odd) {
    try {
      const m = CX.load(j), L = m.load;
      const ok = p => !p.ts || (Object.keys(p.ts.s).length && Object.values(p.ts.s).every(a => a.length === 24 * NDAYS[p.ts.r] && a.every(x => x >= 0 && isFinite(x))));
      if ((CX.LOAD_KEYS.concat('custom')).indexOf(L.base) < 0 || !ok(L) || (L.hrs && L.hrs.length !== 24) || ['day2', 'week'].indexOf(L.dm) < 0 || [0, 1].indexOf(L.dv) < 0 ||
          m.tech.some(e => !ok(e.prof) || [0, 1].indexOf(e.prof.dv) < 0 || (e.prof.f7 && e.prof.f7.length !== 7))) pbad++;
      CX.sample(m, CX.options({}));
    } catch (e) { pthrew++; }
  }
  check('A0 a profile that makes no sense never throws and reads back to one that does', pthrew === 0 && pbad === 0, odd.length + ' inputs, ' + pthrew + ' threw, ' + pbad + ' invalid');
  // A v1 plan with the form it was saved with samples the year exactly as v1 did.
  const drawn = Array.from({ length: 24 }, (_, h) => +(0.4 + 0.5 * Math.sin(h / 4) ** 2).toFixed(2));
  let worst = 0, n = 0, wrong = 0;
  for (const climate of Object.keys(CX.CLIMATES)) for (const sample of CX.SAMPLES) for (const stress of [true, false])
  for (const profile of [...CX.LOAD_KEYS.filter(k => k !== 'flat'), 'custom', 'drawn', 'mars']) {
    const prof = profile === 'drawn' ? drawn : '', form = profile === 'drawn' ? 'custom' : profile;
    const raw = { v: 1, tech: [{ id: 1, kind: 'pv', cf: 0.21 }, { id: 2, kind: 'wind', cf: 0.37 }, { id: 3, kind: 'firm' }], prof };
    const o = CX.options({ climate, stress });
    const m = CX.load(JSON.parse(JSON.stringify(CX.compact(CX.upgrade(CX.load(raw), { profile: form, sample })))));
    const S = CX.sample(m, o), R = sampleV1(prof, { climate, stress, sample, profile: CX.LOAD_KEYS.indexOf(form) >= 0 || form === 'custom' ? form : 'sys' });
    n++;
    if (S.H !== R.H || S.sample !== sample) { wrong++; continue; }
    for (let t = 0; t < R.H; t++) worst = Math.max(worst, Math.abs(S.w[t] - R.w[t]), Math.abs(S.load[t] - R.load[t]));
    for (const e of m.tech) if (e.kind !== 'firm') {
      const a = CX.avail(e, S).a, b = scaleTo(e.kind === 'pv' ? R.sun : R.wind, R.w, e.cf);
      for (let t = 0; t < R.H; t++) worst = Math.max(worst, Math.abs(a[t] - b[t]));
    }
  }
  check('A0 a v1 plan, upgraded with its form, samples the year exactly as v1 did', wrong === 0 && worst === 0, n + ' plans (every climate, sampling, still day and profile, one drawn by hand), worst ' + e1(worst) + (wrong ? ', ' + wrong + ' sampled otherwise' : ''));
}

/* ── A1: the typical days ── */
console.log('\n── A1 the typical days ──');
{
  let worst = 0, sums = 0, peaks = 0, cfBad = 0, shapeBad = 0, litBad = 0, sampBad = 0, n = 0;
  const seen = { day: 0, day2: 0, week: 0 }, kinds = { file: 0, edited: 0, daily: 0, mean: 0 };
  const cases = [];
  // Every climate, sampling, still day and load shape, built in.
  for (const climate of Object.keys(CX.CLIMATES)) for (const dm of ['', 'day2', 'week']) for (const stress of [true, false]) for (const base of CX.LOAD_KEYS)
    cases.push({ climate, stress, plan: { v: 2, load: { base, dv: dm ? 1 : 0, dm: dm || 'day2' }, tech: [{ id: 1, kind: 'pv', cf: 0.2 }, { id: 2, kind: 'wind', cf: 0.35 }] } });
  // And 400 seeded random plans: edited shapes, daily factors, weather, files of every sampling and seasons.
  for (let k = 0; k < 400; k++) {
    const R = rng(4000 + k), climate = Object.keys(CX.CLIMATES)[Math.floor(R() * 3)];
    cases.push({ climate, stress: R() < 0.7, plan: { v: 2, load: randomProfile(R, 'load', climate), tech: [
      { id: 1, kind: 'pv', cf: +(0.12 + R() * 0.25).toFixed(3), prof: randomProfile(R, 'pv', climate), exist: R() < 0.5 ? 100 : 0, build: R() < 0.8 ? 1 : 0 },
      { id: 2, kind: 'wind', cf: +(0.2 + R() * 0.3).toFixed(3), prof: randomProfile(R, 'wind', climate) }] } });
  }
  for (const c of cases) {
    const model = CX.load(c.plan), o = CX.options({ climate: c.climate, stress: c.stress });
    const S = CX.sample(model, o), R = sampleOf(model, o);
    n++; seen[R.sample]++;
    if (isFile(model.load)) { kinds.file++; if (CX.tsMissing(model.load.ts, CX.CLIMATES[c.climate].seasons).length) kinds.mean++; }
    if (Array.isArray(model.load.hrs)) kinds.edited++;
    if (model.load.dv) kinds.daily++;
    if (S.sample !== R.sample || S.H !== R.H) { sampBad++; continue; }
    for (let t = 0; t < R.H; t++) worst = Math.max(worst, Math.abs(S.w[t] - R.w[t]), Math.abs(S.load[t] - R.load[t]));
    if (Math.abs(R.w.reduce((a, b) => a + b, 0) - 8760) > 1e-9) sums++;
    if (Math.abs(Math.max(...S.load) - 1) > 1e-12) peaks++;
    for (const e of model.tech) {
      const a = CX.avail(e, S), b = availOf(e, R);
      for (let t = 0; t < R.H; t++) worst = Math.max(worst, Math.abs(a.a[t] - b[t]));
      let en = 0;
      for (let t = 0; t < S.H; t++) en += S.w[t] * a.a[t];
      if (isFile(e.prof)) { if (!a.literal || Math.abs(en / 8760 - a.cf) > 1e-9 || a.a.some((v, t) => Math.abs(v - Math.min(1, R.gen[e.id][t])) > 1e-12)) litBad++; continue; }
      if (!a.reach) continue;
      if (Math.abs(en / 8760 - e.cf) > 1e-6 || a.a.some(v => v > 1 + 1e-12 || v < 0)) cfBad++;
      // Below its cap, every hour is the same multiple of its raw shape.
      let k = null;
      for (let t = 0; t < S.H; t++) if (a.a[t] < 1 - 1e-9 && R.gen[e.id][t] > 1e-9) { const q = a.a[t] / R.gen[e.id][t]; if (k === null) k = q; else if (Math.abs(q / k - 1) > 1e-9) shapeBad++; }
    }
  }
  check('A1 the sampling is the finest any profile in the plan asks for', sampBad === 0, n + ' plans: ' + seen.day + ' one day, ' + seen.day2 + ' a weekday and a weekend day, ' + seen.week + ' a week a season' + (sampBad ? ', ' + sampBad + ' wrong' : ''));
  check('A1 every sampled hour has the weight, demand, sun and wind its rules give', worst < 1e-12, kinds.file + ' load files (' + kinds.mean + ' missing a season), ' + kinds.edited + ' edited shapes, ' + kinds.daily + ' with daily variability; worst ' + e1(worst));
  check('A1 the typical days stand for exactly a year, 8,760 hours', sums === 0, sums + ' off');
  check('A1 the highest hour of demand is the year\'s peak', peaks === 0, peaks + ' off');
  check('A1 solar and wind give their capacity factor over the year, no hour above their rating', cfBad === 0, cfBad + ' off');
  check('A1 solar and wind keep their shape below the rating', shapeBad === 0, shapeBad + ' hours off shape');
  check('A1 a farm from a file runs on its file\'s hours, as they are, and reports their capacity factor', litBad === 0, litBad + ' off');
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
    const avail = e.kind === 'pv' || e.kind === 'wind' ? availOf(e, S) : null;
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
  const o = { peak: Math.round(rnd(50, 3000)), growth: +rnd(-1, 6).toFixed(1), start, end, step,
    shed: R() < 0.85, voll: pick([5000, 15000, 30000]), carbon: R() < 0.5 ? Math.round(rnd(10, 120)) : 0, carbonGrow: +rnd(0, 8).toFixed(1),
    netZero: R() < 0.25, nzYear: start + step * (1 + Math.floor(R() * 2)), rate: +rnd(0, 12).toFixed(1),
    climate: pick(Object.keys(CX.CLIMATES)), stress: R() < 0.7, time: 60, gap: 0.001 };
  // A load profile of any kind but a week (a week of every plan is slow); farms' files of a day or two.
  const load = randomProfile(R, 'load', o.climate);
  if (load.dm === 'week') load.dm = 'day2';
  if (load.ts && load.ts.r === 'week') delete load.ts;
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
    if (t.kind === 'pv' || t.kind === 'wind'){
      t.cf = +rnd(0.12, 0.45).toFixed(3);
      t.prof = randomProfile(R, t.kind, o.climate);
      t.prof.dv = 0;
      if (t.prof.ts && t.prof.ts.r === 'week') {
        t.prof.ts.r = 'day';
        Object.keys(t.prof.ts.s).forEach(k => { t.prof.ts.s[k] = t.prof.ts.s[k].slice(0, 24); });
      }
    }
    if (t.kind === 'firm') { t.avail = +rnd(0.8, 1).toFixed(2); t.vom = Math.round(t.vom * rnd(0.6, 1.4)); }
    if (t.kind === 'store') { t.hours = pick([1, 2, 4, 8]); t.rte = +rnd(0.7, 0.95).toFixed(2); }
    t.life = Math.round(rnd(8, 40));
    tech.push(t);
  }
  // A plan that may not shed has something it can always build.
  if (!o.shed) tech.push(Object.assign({ id: n + 1 }, CX.NEW.ocgt));
  return { model: CX.load({ v: 2, load, tech }), opts: o };
}

console.log('\n── A2 every plan replayed from its definition ──');
{
  const cases = [];
  // Every Quick Start as it is, with a weekday and a weekend day, and one with a week and the weather.
  for (const k of Object.keys(CX.PRESETS)) for (const sample of ['day', 'day2', k === 'grow' ? 'week' : null]) {
    if (!sample) continue;
    const model = CX.load(CX.PRESETS[k].plan);
    if (sample !== 'day') { model.load.dv = 1; model.load.dm = sample; }
    if (sample === 'week') model.tech.forEach(e => { if (e.kind === 'pv' || e.kind === 'wind') e.prof.dv = 1; });
    cases.push({ name: 'Quick Start ' + k + ', ' + sample, model, opts: Object.assign({}, CX.PRESETS[k].fields) });
  }
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
    const o = CX.options({ peak: Math.round(rnd(100, 2000)), start: 2030, end: 2030, step: 1, rate: +rnd(1, 12).toFixed(1),
      climate: pick(Object.keys(CX.CLIMATES)), stress: R() < 0.5, voll: pick([3000, 10000, 30000]), carbon: Math.round(rnd(0, 80)), shed: true });
    const dm = pick(['', 'day2', 'week']), load = { base: pick(CX.LOAD_KEYS), dv: dm ? 1 : 0, dm: dm || 'day2' };
    const tech = [];
    const m = 2 + Math.floor(R() * 3);
    for (let i = 0; i < m; i++) tech.push(Object.assign({ id: i + 1 }, CX.NEW[pick(['ccgt', 'ocgt', 'coal', 'nuclear', 'diesel', 'geo'])],
      { capex: Math.round(rnd(300, 6000)), fom: Math.round(rnd(5, 120)), vom: Math.round(rnd(5, 250)), avail: +rnd(0.75, 1).toFixed(2), life: Math.round(rnd(10, 50)) }));
    const model = CX.load({ v: 2, load, tech });
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
    const o = CX.options({ peak: 1000, growth: +rnd(1, 9).toFixed(1), start: 2030, end: 2039, step: 5, rate: +rnd(2, 10).toFixed(1),
      climate: pick(Object.keys(CX.CLIMATES)), stress: R() < 0.5, voll: 8000, shed: true });
    const load = { base: pick(CX.LOAD_KEYS) };
    const tech = [
      Object.assign({ id: 1 }, CX.NEW.coal, { capex: Math.round(rnd(1500, 3500)), vom: Math.round(rnd(20, 40)), avail: 1, life: pick([4, 8, 30]), learn: -rnd(0, 0.06) }),
      Object.assign({ id: 2 }, CX.NEW.ocgt, { capex: Math.round(rnd(500, 900)), vom: Math.round(rnd(80, 140)), avail: 1, life: pick([4, 8, 30]), learn: -rnd(0, 0.06) })
    ];
    const model = CX.load({ v: 2, load, tech }), res = await CX.solve(psa, model, o);
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

/* ── A5: profiles from a file ── */
console.log('\n── A5 profiles from a file ──');
{
  const plan0 = CX.load(CX.PRESETS.grow.plan), o0 = CX.options({});
  // The profile now, as the run takes it, for the reader to fill blanks from.
  const nowOf = (m, o, kind, e) => climate => {
    const S = CX.sample(m, Object.assign({}, o, { climate }));
    return CX.gridOf(S, kind === 'load' ? S.load : CX.avail(e, S).a, CX.need(kind === 'load' ? m.load : e.prof, kind === 'load' ? 'load' : e.kind));
  };
  const read = (text, extra) => CX.readProfileFile(CX.csvRows(text), Object.assign({ kind: 'load', who: 'The load profile', climate: 'sum', peak: 1000, current: nowOf(plan0, o0, 'load') }, extra || {}));
  // A template read back is the profile it was written from, for the load and for each farm, at every sampling and climate.
  let worst = 0, trips = 0, tripBad = [];
  for (const climate of Object.keys(CX.CLIMATES)) for (const L of [{ base: 'com' }, { base: 'res', dv: 1, dm: 'day2', f2: [1, 0.85] }, { base: 'resev', dv: 1, dm: 'week', hrs: CX.PROFILES.resev.h.map(v => +(v * 0.9).toFixed(2)) }]) {
    const m = CX.load({ v: 2, load: L, tech: [{ id: 1, kind: 'pv', cf: 0.21, prof: L.dm === 'week' ? { dv: 1 } : {} }, { id: 2, kind: 'wind', cf: 0.33 }] }), o = CX.options({ climate });
    const S = CX.sample(m, o);
    for (const who of ['load', 1, 2]) {
      const e = who === 'load' ? null : m.tech.find(x => x.id === who), kind = who === 'load' ? 'load' : e.kind;
      const g = nowOf(m, o, kind, e)(climate);
      const csv = CX.templateCsv({ kind, who: who === 'load' ? 'the load profile' : CX.nameOf(e), climate, grid: g });
      const got = CX.readProfileFile(CX.csvRows(csv), { kind, who: 'it', climate, peak: 1000, current: nowOf(m, o, kind, e) });
      trips++;
      if (got.errors.length || got.ts.r !== g.r || got.climate) { tripBad.push(climate + ' ' + who + ': ' + (got.errors[0] || got.ts.r)); continue; }
      const m2 = CX.load(JSON.parse(JSON.stringify(CX.compact(m))));
      const p2 = who === 'load' ? m2.load : m2.tech.find(x => x.id === who).prof;
      p2.base = 'custom'; p2.ts = got.ts;
      const S2 = CX.sample(m2, o), a = who === 'load' ? S.load : CX.avail(e, S).a, b = who === 'load' ? S2.load : CX.avail(m2.tech.find(x => x.id === who), S2).a;
      if (S2.H !== S.H) { tripBad.push(climate + ' ' + who + ' H'); continue; }
      // A farm's still day is the file's clearest day at a quarter, which may differ from the climate's by its cap and weather: the typical days are held.
      for (let t = 0; t < S.H; t++) if (who === 'load' || !S.days[Math.floor(t / 24)].stress) worst = Math.max(worst, Math.abs(a[t] - b[t]));
    }
  }
  check('A5 a template read back is the profile it was written from', tripBad.length === 0 && worst < 1e-4, trips + ' templates (load, solar and wind; one day, a weekday and a weekend day, a week; three climates), worst ' + e1(worst) + ' (written to 4 places)' + (tripBad.length ? '; ' + tripBad.slice(0, 3).join(' | ') : ''));

  // Every layout the reader promises.
  const H = [...Array(24).keys()], hh = h => String(h).padStart(2, '0') + ':00', SEAS = ['Summer', 'Autumn', 'Winter', 'Spring'];
  const shape = h => +(0.55 + 0.45 * Math.sin(Math.PI * Math.max(0, h - 5) / 18)).toFixed(4);
  const layouts = [
    ['24 rows, no header, no labels', H.map(h => shape(h)).join('\n'), { r: 'day', keys: ['*'] }],
    ['an Hour column 1 to 24, the hour ending', 'Hour,Load\n' + H.map(h => (h + 1) + ',' + shape(h)).join('\n'), { r: 'day', keys: ['*'], at: [0, shape(0)] }],
    ['1 PM style hours, out of order', 'Time,Load\n' + H.slice().reverse().map(h => ((h % 12) || 12) + ':00 ' + (h < 12 ? 'AM' : 'PM') + ',' + shape(h)).join('\n'), { r: 'day', keys: ['*'], at: [13, shape(13)] }],
    ['48 rows by hours that come round again', 'Hour,Load\n' + [...H, ...H].map((h, i) => h + ',' + (i < 24 ? 1 : 0.7)).join('\n'), { r: 'day2', keys: ['*'], at: [30, 0.7] }],
    ['48 rows in order, no labels', [...H, ...H].map((h, i) => i < 24 ? 1 : 0.6).join('\n'), { r: 'day2', keys: ['*'], at: [24, 0.6] }],
    ['168 rows Day and Hour, a column a season', 'Day,Hour,' + SEAS.join(',') + '\n' + CX.DAYS.flatMap((d, i) => H.map(h => [d, hh(h), 1 - i / 20, 0.8, 0.9, 0.7].join(','))).join('\n'), { r: 'week', keys: SEAS, at: [24 * 6, 0.7], season: 'Summer' }],
    ['168 rows full day names, Indonesian', 'Hari,Jam,Beban\n' + ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].flatMap((d, i) => H.map(h => [d, h, i >= 5 ? 0.8 : 1].join(','))).join('\n'), { r: 'week', keys: ['*'], at: [24 * 5, 0.8] }],
    ['days as columns', 'Hour,' + CX.DAYS.join(',') + '\n' + H.map(h => [hh(h), 1, 1, 1, 1, 1, 0.75, 0.7].join(',')).join('\n'), { r: 'week', keys: ['*'], at: [24 * 6, 0.7] }],
    ['a season and its day as columns', 'Hour,Summer weekday,Summer weekend,Winter weekday,Winter weekend\n' + H.map(h => [h, 1, 0.8, 0.9, 0.7].join(',')).join('\n'), { r: 'day2', keys: SEAS, at: [24, 0.8], season: 'Summer' }],
    ['a Season column, long', 'Season,Hour,Load\n' + SEAS.flatMap(s => H.map(h => [s, h, s === 'Summer' ? 1 : 0.8].join(','))).join('\n'), { r: 'day', keys: SEAS, at: [0, 0.8], season: 'Autumn' }],
    ['a week of dates and times', 'Timestamp,Load\n' + Array.from({ length: 168 }, (_, i) => { const d = new Date(Date.UTC(2026, 2, 4) + i * 3600e3); return d.toISOString().slice(0, 16).replace('T', ' ') + ',' + (d.getUTCDay() % 6 === 0 ? 0.7 : 1); }).join('\n'), { r: 'week', keys: ['*'], at: [24 * 5, 0.7] }],
    ['a day of dates, day first', 'Date,Load\n' + H.map(h => '04/03/2026 ' + hh(h) + ',' + shape(h)).join('\n'), { r: 'day', keys: ['*'] }],
    ['notes, semicolons and decimal commas', '# A note, with a comma\n"# A quoted note"\nUur;Vraag\n' + H.map(h => h + ';' + String(shape(h)).replace('.', ',')).join('\n'), { r: 'day', keys: ['*'], at: [12, shape(12)] }],
    ['percent cells', 'Hour,Load\n' + H.map(h => h + ',' + Math.round(shape(h) * 100) + '%').join('\n'), { r: 'day', keys: ['*'] }],
    ['Fall for Autumn, a column left out kept', 'Hour,Summer,Fall,Winter\n' + H.map(h => [h, 1, 0.8, 0.9].join(',')).join('\n'), { r: 'day', keys: SEAS, kept: 'Spring' }],
    ['a blank cell kept', 'Hour,Load\n' + H.map(h => h + ',' + (h === 3 ? '' : 1)).join('\n'), { r: 'day', keys: SEAS, blank: 1 }],
  ];
  let lay = 0, layBad = [];
  for (const [name, text, want] of layouts) {
    let got;
    try { got = read(text); } catch (e) { layBad.push(name + ': threw ' + e.message); continue; }
    lay++;
    if (got.errors.length) { layBad.push(name + ': ' + got.errors[0]); continue; }
    const keys = Object.keys(got.ts.s);
    if (got.ts.r !== want.r || JSON.stringify(keys.sort()) !== JSON.stringify(want.keys.slice().sort())) { layBad.push(name + ': ' + got.ts.r + ' ' + keys.join('/')); continue; }
    // Each file peaks at 1, so a load's hours are its own.
    if (want.at) {
      const ser = got.ts.s[want.season || keys[0]];
      if (Math.abs(ser[want.at[0]] - want.at[1]) > 1e-4) layBad.push(name + ': hour ' + want.at[0] + ' is ' + ser[want.at[0]] + ', not ' + want.at[1]);
    }
    if (want.kept && !got.notes.some(nt => nt.indexOf(want.kept) >= 0)) layBad.push(name + ': no word that ' + want.kept + ' was kept');
    if (want.blank && !got.notes.some(nt => /blank cell/.test(nt))) layBad.push(name + ': no word of the blank cell');
  }
  check('A5 every layout the reader promises reads to what it holds', layBad.length === 0, lay + ' layouts' + (layBad.length ? '; ' + layBad.slice(0, 3).join(' | ') : ''));

  // Units: a load in MW sets the peak demand; a farm in % or above 1 read as %; seasons decide the climate.
  const mw = read('Hour,Demand [MW]\n' + H.map(h => h + ',' + (2000 + 40 * h)).join('\n'));
  const pv = plan0.tech.find(e => e.kind === 'pv');
  const gen = extra => Object.assign({ kind: 'pv', who: 'Solar PV', climate: 'sum', current: nowOf(plan0, o0, 'gen', pv) }, extra || {});
  const pct = CX.readProfileFile(CX.csvRows('Hour,Summer [%],Winter [%]\n' + H.map(h => [h, h > 6 && h < 18 ? 70 : 0, h > 8 && h < 16 ? 40 : 0].join(',')).join('\n')), gen());
  const auto = CX.readProfileFile(CX.csvRows('Hour,Output\n' + H.map(h => [h, h > 6 && h < 18 ? 80 : 0].join(',')).join('\n')), gen());
  const trop = read('Hour,Dry,Wet\n' + H.map(h => [h, 1, 0.9].join(',')).join('\n'));
  const win = read('Hour,Summer,Winter\n' + H.map(h => [h, 0.8, 1].join(',')).join('\n'));
  check('A5 a load in MW sets the peak demand to its highest hour', !mw.errors.length && mw.peak === 2920 && Math.max(...mw.ts.s['*']) === 1, 'peak ' + mw.peak);
  check('A5 a farm in % (or above 1, up to 100) is read as a share of its rating', !pct.errors.length && Math.abs(Math.max(...pct.ts.s.Summer) - 0.7) < 1e-9 && !auto.errors.length && Math.abs(Math.max(...auto.ts.s['*']) - 0.8) < 1e-9,
    (pct.errors[0] || '') + (auto.errors[0] || ''));
  check('A5 a load\'s seasons set the climate: tropical seasons, or a temperate winter peak', trop.climate === 'trop' && win.climate === 'win' && !trop.errors.length && !win.errors.length, trop.climate + ', ' + win.climate);

  // A bad file is refused with a reason, and nothing in it is used.
  const refused = [
    ['an hour missing', 'Hour,Load\n' + H.slice(0, 23).map(h => h + ',1').join('\n')],
    ['an hour twice', 'Hour,Load\n' + [...H, 5].map(h => h + ',1').join('\n')],
    ['off the hour', 'Hour,Load\n00:30,1\n' + H.slice(1).map(h => h + ',1').join('\n')],
    ['a year of hours', 'Load\n' + Array(8760).fill(1).join('\n')],
    ['two columns with no season', 'Hour,A,B\n' + H.map(h => [h, 1, 2].join(',')).join('\n')],
    ['days and weekdays mixed', 'Day,Hour,Load\n' + ['Mon', 'Weekend'].flatMap(d => H.map(h => [d, h, 1].join(','))).join('\n')],
    ['a word among the values', 'Hour,Load\n' + H.map(h => h + ',' + (h === 9 ? 'peak' : 1)).join('\n')],
    ['all zero', 'Hour,Load\n' + H.map(h => h + ',0').join('\n')],
    ['30 rows, no labels', Array(30).fill(1).join('\n')],
    ['a header and nothing under it', 'Hour,Load\n'],
    ['nothing at all', ''],
    ['units mixed', 'Hour,Summer [MW],Winter [%]\n' + H.map(h => [h, 1, 2].join(',')).join('\n')],
  ];
  let ref = 0, refBad = [];
  for (const [name, text] of refused) {
    try { const got = read(text); if (!got.errors.length || got.ts) refBad.push(name); else ref++; } catch (e) { refBad.push(name + ' threw'); }
  }
  for (const [name, text] of [['MW for a farm', 'Hour,Output [MW]\n' + H.map(h => h + ',5').join('\n')], ['another climate\'s seasons for a farm', 'Hour,Dry,Wet\n' + H.map(h => h + ',0.5,0.4').join('\n')], ['shares over 100', 'Hour,Output\n' + H.map(h => h + ',' + 300).join('\n')]]) {
    try { const got = CX.readProfileFile(CX.csvRows(text), gen()); if (!got.errors.length || got.ts) refBad.push(name); else ref++; } catch (e) { refBad.push(name + ' threw'); }
  }
  check('A5 a bad file is refused with a reason, and nothing in it is used', refBad.length === 0, ref + ' refused' + (refBad.length ? '; not: ' + refBad.join(', ') : ''));
  // Garbage never throws.
  let threw = 0;
  for (let k = 0; k < 300; k++) {
    const R = rng(9000 + k), rows = [];
    const nr = Math.floor(R() * 60), nc = 1 + Math.floor(R() * 6);
    const cellOf = () => { const q = R(); return q < 0.2 ? '' : q < 0.4 ? String(Math.floor(R() * 30)) : q < 0.55 ? (R() * 3).toFixed(2) : q < 0.65 ? CX.DAYS[Math.floor(R() * 7)] : q < 0.72 ? 'Weekend' : q < 0.8 ? ['Summer', 'Dry', 'Fall', 'All'][Math.floor(R() * 4)] : q < 0.86 ? '12:' + Math.floor(R() * 60) : q < 0.9 ? '#x' : q < 0.95 ? '2026-02-3' + Math.floor(R() * 3) + ' 1' + Math.floor(R() * 9) + ':00' : 'x"y'; };
    for (let i = 0; i < nr; i++) { const r = []; for (let j = 0; j < nc; j++) r.push(cellOf()); rows.push(r); }
    try { CX.readProfileFile({ rows, decimalComma: R() < 0.2 }, R() < 0.5 ? { kind: 'load', who: 'x', climate: 'trop', peak: 50, current: nowOf(plan0, o0, 'load') } : gen({ climate: 'trop' })); } catch (e) { threw++; }
  }
  check('A5 garbage never throws', threw === 0, '300 seeded tables, ' + threw + ' threw');
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
  const open = async (init, arg) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', acceptDownloads: true });
    await ctx.addInitScript(() => { try { localStorage.setItem('abt:ctrl:' + location.pathname.replace(/index\.html?$/, ''), '1'); localStorage.setItem('capacityexpansion-planner-tour-v2-seen', '1'); } catch (e) {} });
    if (init) await ctx.addInitScript(init, arg);
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
    await page.goto(ORIGIN + '/capacity-expansion-planner/', { waitUntil: 'load' });
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
  // Daily variability sets each season's sampling, shown (and only shown) in Assumptions.
  await page.click('.quick-start-btn[data-preset="grow"]');
  await solved(page);
  await page.evaluate(() => document.querySelector('.ctrl-tab[data-tab="plan"]').click());
  const sampleNow = () => page.evaluate(() => ({ v: document.getElementById('cxSample').value, off: document.getElementById('cxSample').disabled, why: document.getElementById('sampleWhy').textContent }));
  const s0 = await sampleNow();
  await page.locator('[data-prof="load"] .prof-toggle .toggle-switch').click();
  const s1 = await sampleNow();
  await page.click('[data-prof="load"] [data-pk="dm"] .seg-btn[data-val="week"]');
  const s2 = await sampleNow();
  check('B daily variability sets each season: one day, a weekday and a weekend day, a week, never chosen in Assumptions', s0.v === 'day' && s1.v === 'day2' && s2.v === 'week' && s0.off && /daily variability/.test(s2.why), [s0.v, s1.v, s2.v].join(' → ') + '; ' + s2.why);
  // Dragging a daily bar changes that day.
  const before = await page.evaluate(() => __cx.app.model.load.f7);
  const bars = page.locator('[data-prof="load"] svg[data-bars="d"]'), box = await bars.boundingBox();
  await page.mouse.move(box.x + box.width * (6.5 / 7) * (240 / 256) + box.width * 8 / 256, box.y + box.height * 0.7);
  await page.mouse.down(); await page.mouse.up();
  const after = await page.evaluate(() => __cx.app.model.load.f7);
  check('B a daily bar drags that day of the week', !Array.isArray(before) && Array.isArray(after) && after.length === 7 && after[6] < 0.84 && after[0] === 0.97, JSON.stringify(after));
  // The template, filled in as a week in MW, read back by the page.
  await page.selectOption('#cxProfile', 'custom');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-prof="load"] [data-act="tpl"]')]);
  const tplText = readFileSync(await dl.path(), 'utf8');
  const tplOk = await page.evaluate(t => { const g = CX.readProfileFile(CX.csvRows(t), { kind: 'load', who: 'x', climate: 'sum', peak: 1000 }); return g.errors.length ? g.errors[0] : g.ts.r; }, tplText);
  check('B the load\'s template is a week of every season with its notes, and reads back', tplOk === 'week' && /^"# Capacity Expansion Planner/.test(tplText) && tplText.split('\r\n').filter(l => /^(Mon|Sun),/.test(l)).length === 48, tplOk + ', ' + tplText.split('\r\n').length + ' lines');
  const Hs = [...Array(24).keys()];
  const weekCsv = 'Day,Hour,Summer [MW],Autumn [MW],Winter [MW],Spring [MW]\n' + CX.DAYS.flatMap((d, i) => Hs.map(h => { const v = 900 + 300 * Math.sin(Math.PI * Math.max(0, h - 6) / 16) * (i >= 5 ? 0.8 : 1); return [d, h, (v * 1.1).toFixed(1), (v * 0.9).toFixed(1), v.toFixed(1), (v * 0.95).toFixed(1)].join(','); })).join('\n');
  const choose = async (sel, name, text) => { const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click(sel)]); await fc.setFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(text) }); };
  await choose('[data-prof="load"] [data-act="open"]', 'week.csv', weekCsv);
  await page.waitForFunction(() => __cx.app.model.load.base === 'custom', null, { timeout: 15000 });
  await page.click('#runBtn');
  await page.waitForFunction(() => !document.getElementById('runBtn').disabled && !document.body.classList.contains('is-stale'), null, { timeout: 90000 });
  const fileRun = await page.evaluate(() => ({ raw: __cx.app.res.raw, sample: __cx.app.res.sample, peak: __cx.plan().peak, model: CX.compact(__cx.app.model), opts: __cx.plan() }));
  const here2 = await CX.solve(psa, CX.load(fileRun.model), fileRun.opts);
  // The same plan to rounding: the browser's V8 and this one may differ in the last place of a power or a sine.
  const samePlan = (a, b) => a[0] === b[0] && a[1] === b[1] && Math.abs(a[2] - b[2]) <= 1e-9 * Math.abs(b[2]) && a[3].length === b[3].length && a[3].every((x, i) => x[0] === b[3][i][0] && Math.abs(x[1] - b[3][i][1]) < 1e-4);
  check('B a week of the load in MW from a file sets the peak and the week, and solves as here', fileRun.sample === 'week' && fileRun.peak === 1320 && samePlan(fileRun.raw, here2.raw),
    fileRun.sample + ', peak ' + fileRun.peak + ', objective ' + e1(fileRun.raw[2]) + ' to ' + e1(Math.abs(fileRun.raw[2] - here2.raw[2])));
  // A solar farm from a file in %: the capacity factor its card reports is the run's.
  await page.evaluate(() => document.querySelector('.ctrl-tab[data-tab="tech"]').click());
  const pvId = await page.evaluate(() => __cx.app.model.tech.find(e => e.kind === 'pv').id);
  const card = '.tech-card[data-id="' + pvId + '"]';
  if (!(await page.$(card + '.is-open'))) await page.click(card + ' .tech-toggle');
  await page.selectOption(card + ' select[data-pk="base"]', 'custom');
  const pvCsv = 'Hour,Summer [%],Autumn [%],Winter [%],Spring [%]\n' + Hs.map(h => [h, ...[1, 0.8, 0.55, 0.8].map(k => (Math.max(0, Math.sin(Math.PI * (h - 6) / 12)) * 85 * k).toFixed(1))].join(',')).join('\n');
  await choose(card + ' [data-act="open"]', 'solar.csv', pvCsv);
  await page.waitForFunction(id => __cx.app.model.tech.find(e => e.id === id).prof.base === 'custom', pvId, { timeout: 15000 });
  const pvCf = await page.evaluate(id => { const e = __cx.app.model.tech.find(x => x.id === id), S = CX.sample(__cx.app.model, __cx.plan()); return { cf: CX.fmt.pct(100 * CX.avail(e, S).cf), text: document.querySelector('.tech-card[data-id="' + id + '"] .tech-derived').textContent, cfShown: !!document.querySelector('.tech-card[data-id="' + id + '"] input[data-k="cf"]') }; }, pvId);
  check('B a solar farm from a file reports the capacity factor its hours give, and asks for none', pvCf.text.indexOf('capacity factor of ' + pvCf.cf + '%') >= 0 && !pvCf.cfShown, pvCf.text.slice(-50));
  check('B no page errors', page.__errors.length === 0, page.__errors.join(' | ').slice(0, 200));
  await ctx.close();
  // A plan saved before the profiles opens as it was: the load's shape and sampling from its form.
  const drawn = Array.from({ length: 24 }, (_, h) => +(0.5 + 0.4 * Math.sin(h / 3) ** 2).toFixed(2));
  for (const [label, fields, prof] of [['a residential week', { 'v:cxProfile': 'res', 'v:cxSample': 'week', 'v:cxClimate': 'win' }, ''], ['a day drawn by hand, weekday and weekend', { 'v:cxProfile': 'custom', 'v:cxSample': 'day2' }, drawn]]) {
    const old = await open(init => { try { localStorage.setItem('abt:save:capacityexpansion-planner:v1', init); } catch (e) {} },
      JSON.stringify({ __fields: Object.assign({ 'v:cxPeak': '1000', 'v:cxStart': '2026', 'v:cxEnd': '2040', 'v:cxStep': '5' }, fields), __extra: Object.assign({}, CX.PRESETS.grow.plan, { v: 1, prof }) }));
    await solved(old.page);
    const got = await old.page.evaluate(() => ({ load: CX.compact(__cx.app.model).load, tech: CX.compact(__cx.app.model).tech.map(t => t.prof || null), raw: __cx.app.res.raw, opts: __cx.plan(), model: CX.compact(__cx.app.model), sel: document.getElementById('cxProfile').value }));
    const want = CX.compact(CX.upgrade(CX.load(Object.assign({}, CX.PRESETS.grow.plan, { v: 1, prof })), { profile: fields['v:cxProfile'], sample: fields['v:cxSample'] }));
    const here3 = await CX.solve(psa, CX.load(want), got.opts);
    check('B a v1 plan (' + label + ') opens as it was and solves as here', JSON.stringify(got.load) === JSON.stringify(want.load) && JSON.stringify(got.tech) === JSON.stringify(want.tech.map(t => t.prof || null)) && JSON.stringify(got.raw) === JSON.stringify(here3.raw) && old.page.__errors.length === 0,
      JSON.stringify(got.load).slice(0, 90) + ', select ' + got.sel);
    await old.ctx.close();
  }
  // Hostile saved state: the mini cache holds nonsense, and the page still opens and solves.
  const hostile = await open(() => {
    try { localStorage.setItem('abt:save:capacityexpansion-planner:v1', JSON.stringify({ __fields: { 'v:cxPeak': 'lots', 'v:cxStart': '1066', 'v:cxEnd': '-4', 'v:cxStep': '7', 'v:cxClimate': 'mars' },
      __extra: { tech: [{ id: 'one', kind: 'fusion', capex: -9 }, null, { id: 3, kind: 'pv', cf: 40, prof: { base: 'custom', ts: { r: 'week', s: { Mars: 'red' } } } }], v: 2, load: { base: 'custom', dv: 'maybe', ts: 9 } } })); } catch (e) {}
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
