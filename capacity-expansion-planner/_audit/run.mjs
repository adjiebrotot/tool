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
//   A5  Profiles from a file: a template read back runs on the very same
//       hours as the profile it was written from, to the last bit, for 526
//       plans, and a whole year written from one reads back to its week each
//       season; every template its menu offers reads back at its own days; a
//       year of hours is averaged as an averaging written out here says; every
//       layout the reader promises (24, 48 or 168 rows, labelled or in order,
//       days as columns, a season column, dates, notes, units, a peak day)
//       reads to what it holds; a bad file is refused with a reason and
//       nothing in it is used; garbage never throws.
//   A6  The same plan from its profiles as files: Quick Starts and weeks
//       each season, solved as they are and with every profile swapped for
//       its template (or a year), are the very same plan to the digit.
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
   still day is its clearest. A file's own peak day is the still day as it
   is, for the load and for each farm, and its season the peak season; a
   load's peak day holds its highest hour whether the still day runs or not. */
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
  if (isFile(L) && still && L.ts.pk) return L.ts.pk.h.map(x => Math.max(0, x));
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
  const named = isFile(L) && L.ts.pk ? seasons.findIndex(s => s.name === L.ts.pk.s) : -1;
  if (named >= 0) peak = named;
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
  const top = Math.max(...load, ...(isFile(L) && L.ts.pk ? L.ts.pk.h : []));
  for (const e of model.tech) {
    if (e.kind !== 'pv' && e.kind !== 'wind') continue;
    const pv = e.kind === 'pv', p = e.prof, still = pv ? CX.STRESS.sun : CX.STRESS.wind, out = [];
    let clear = 0;
    if (isFile(p)) { const v = fileSeries(p.ts, seasons[peak].name); let most = -1; for (let q = 0; q < NDAYS[p.ts.r]; q++) { let t = 0; for (let h = 0; h < 24; h++) t += v[q * 24 + h]; if (t > most) { most = t; clear = q; } } }
    const week = p.dv && r === 'week' ? (Array.isArray(p.f7) ? p.f7 : pv ? [1, 0.9, 0.6, 1, 0.95, 0.75, 1] : [1, 0.75, 1.2, 0.55, 0.9, 1.25, 0.8]) : null;
    for (const dy of days) for (let h = 0; h < 24; h++) {
      if (isFile(p) && dy.stress && p.ts.pk) { out.push(Math.max(0, p.ts.pk.h[h])); continue; }
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
    // A peak day of its own: in one of the climate's seasons, in none, or in one it has not; a load's often above every typical hour.
    if (R() < 0.5) {
      const ss = CX.CLIMATES[climate].seasons.map(s => s.name), q = R();
      p.ts.pk = { s: q < 0.6 ? pick(ss) : q < 0.8 ? '' : 'Monsoon', h: Array.from({ length: 24 }, (_, h) => kind === 'load' ? +(0.4 + R() * (R() < 0.5 ? 1.6 : 0.9)).toFixed(4) : +(Math.max(0, Math.sin(Math.PI * (h - 6) / 12)) * R() * 0.4).toFixed(4)) };
    }
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
               { v: 2, load: 7, tech: [{ id: 2, kind: 'wind', prof: 'windy' }] }, { v: '2', load: { ts: { r: 'day2', s: [] } } },
               { v: 2, load: { base: 'custom', ts: { r: 'day', s: { '*': Array(24).fill(0.5) }, pk: { s: 9, h: Array(24).fill('x') } } },
                 tech: [{ id: 3, kind: 'pv', prof: { base: 'custom', ts: { r: 'day', s: { '*': Array(24).fill(0.2) }, pk: { s: '__proto__', h: [1, 2] } } } },
                        { id: 4, kind: 'wind', prof: { base: 'custom', ts: { r: 'day', s: { '*': Array(24).fill(0.3) }, pk: 'calm' } } }] }];
  let pthrew = 0, pbad = 0;
  for (const j of odd) {
    try {
      const m = CX.load(j), L = m.load;
      const ok = p => !p.ts || (Object.keys(p.ts.s).length && Object.values(p.ts.s).every(a => a.length === 24 * NDAYS[p.ts.r] && a.every(x => x >= 0 && isFinite(x))) &&
        (!p.ts.pk || (typeof p.ts.pk.s === 'string' && p.ts.pk.s !== '__proto__' && p.ts.pk.h.length === 24 && p.ts.pk.h.every(x => x >= 0 && isFinite(x)))));
      if ((CX.LOAD_KEYS.concat('custom')).indexOf(L.base) < 0 || !ok(L) || (L.hrs && L.hrs.length !== 24) || ['day2', 'week'].indexOf(L.dm) < 0 || [0, 1].indexOf(L.dv) < 0 ||
          m.tech.some(e => !ok(e.prof) || [0, 1].indexOf(e.prof.dv) < 0 || (e.prof.f7 && e.prof.f7.length !== 7))) pbad++;
      CX.sample(m, CX.options({}));
    } catch (e) { pthrew++; }
  }
  check('A0 a profile that makes no sense never throws and reads back to one that does', pthrew === 0 && pbad === 0, odd.length + ' inputs, ' + pthrew + ' threw, ' + pbad + ' invalid');
  // A v1 plan with the form it was saved with samples the year exactly as v1 did.
  const drawn = Array.from({ length: 24 }, (_, h) => +(0.4 + 0.5 * Math.sin(h / 4) ** 2).toFixed(2));
  let worst = 0, n = 0, wrong = 0;
  for (const climate of ['sum', 'win', 'trop']) for (const sample of CX.SAMPLES) for (const stress of [true, false])
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

/* A decision year counts in whole: a plant in service at its start serves all of its
   years, so a retirement or a life that ends partway through a step runs to the step's
   end. The Checks say so, with that year, and stay quiet when the step divides it. */
{
  const plan = (retire, life) => CX.load({ v: 2, tech: [{ id: 1, name: 'Coal', kind: 'firm', exist: 900, retire, build: 0 }, Object.assign({ id: 2 }, CX.NEW.battery, { life })] });
  const say = (m, o) => CX.validate(m, o).warnings.map(w => w.msg).filter(x => / retires in |-year life /.test(x)).join(' | ');
  const o5 = { start: 2026, end: 2050, step: 5 }, o10 = { start: 2026, end: 2050, step: 10 }, o1 = { start: 2026, end: 2050, step: 1 };
  const a = say(plan(2033, 15), o5), b = say(plan(2036, 15), o5), c = say(plan(2033, 15), o10), d = say(plan(2033, 15), o1), e = say(plan(2048, 23), o5);
  check('A0 a retirement or a life partway through a decision step is named in Checks with the year it runs to',
        /retires in 2033.*to 2035\./.test(a) && !/life/.test(a) && !b && /retires in 2033.*to 2035\./.test(c) && /15-year life.*for 20 years/.test(c) && !d &&
        /retires in 2048.*to 2050\./.test(e) && /23-year life.*for 25 years/.test(e),
        [a, b, c, d, e].map(x => x || '(none)').join(' || ').slice(0, 160));
}

/* ── A1: the typical days ── */
console.log('\n── A1 the typical days ──');
{
  let worst = 0, sums = 0, peaks = 0, cfBad = 0, shapeBad = 0, litBad = 0, sampBad = 0, n = 0;
  const seen = { day: 0, day2: 0, week: 0 }, kinds = { file: 0, edited: 0, daily: 0, mean: 0, peak: 0 };
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
    const pkTop = isFile(model.load) && model.load.ts.pk && !c.stress;
    if (pkTop ? Math.max(...S.load) > 1 + 1e-12 : Math.abs(Math.max(...S.load) - 1) > 1e-12) peaks++;
    if (isFile(model.load) && model.load.ts.pk) kinds.peak++;
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
  check('A1 every sampled hour has the weight, demand, sun and wind its rules give', worst < 1e-12, kinds.file + ' load files (' + kinds.mean + ' missing a season, ' + kinds.peak + ' with a peak day), ' + kinds.edited + ' edited shapes, ' + kinds.daily + ' with daily variability; worst ' + e1(worst));
  check('A1 the typical days stand for exactly a year, 8,760 hours', sums === 0, sums + ' off');
  check('A1 the highest hour of demand is the year\'s peak, or below a file\'s peak day when the still day is not run', peaks === 0, peaks + ' off');
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
  /* A template, written and read back through its text as the page does it:
     typical days ('day', 'day2', 'week'; '.s' each season its own) or a whole
     year, each with the still day as it runs, from the profile as the run
     takes it. who is 'load' or a farm's id. */
  const profOf = (m, who) => who === 'load' ? m.load : m.tech.find(x => x.id === who).prof;
  const kindOf = (m, who) => who === 'load' ? 'load' : m.tech.find(x => x.id === who).kind;
  const seriesOf = (m, S, who) => who === 'load' ? S.load : CX.avail(m.tech.find(x => x.id === who), S).a;
  const peakOf = (m, o, who) => {
    const Sx = CX.sample(m, Object.assign({}, o, { stress: true })), a = seriesOf(m, Sx, who), k = Sx.days.findIndex(d => d.stress);
    return { s: Sx.seasons[Sx.days[k].s].name, h: a.slice(k * 24, k * 24 + 24) };
  };
  function template(m, o, who, key) {
    const S = CX.sample(m, o), kind = kindOf(m, who), year = key === 'year', r = year ? 'week' : key.split('.')[0], seasonal = /\.s$/.test(key);
    let g = CX.gridOf(S, seriesOf(m, S, who), r);
    if (!seasonal && !year) g = CX.everySeason(g, o.climate);
    const text = CX.templateCsv({ kind, who: 'it', climate: o.climate, grid: g, seasonal, peak: peakOf(m, o, who), year: year ? o.start : null });
    const got = CX.readProfileFile(CX.csvRows(text), { kind, who: 'It', climate: o.climate, peak: o.peak, year: o.start, current: nowOf(m, o, kind, who === 'load' ? null : m.tech.find(x => x.id === who)) });
    return { text, got, g };
  }
  // The plan with profiles swapped for files read back, saved and opened again as the mini cache would.
  function swapped(m, list) {
    const m2 = CX.load(JSON.parse(JSON.stringify(CX.compact(m))));
    for (const [who, ts] of list) { const p = profOf(m2, who); p.base = 'custom'; p.ts = ts; }
    return CX.load(JSON.parse(JSON.stringify(CX.compact(m2))));
  }
  // Whether two plans run on the very same hours: the same days and seasons, every weight, demand and availability to the last bit.
  function sameRun(m, m2, o, o2) {
    const A = CX.sample(m, o), B = CX.sample(m2, o2 || o);
    if (A.H !== B.H || A.sample !== B.sample) return 'sampled ' + A.sample + ' ' + A.H + ' and ' + B.sample + ' ' + B.H;
    if (A.days.map(d => d.s).join() !== B.days.map(d => d.s).join()) return 'the still day in another season';
    for (let t = 0; t < A.H; t++) if (A.w[t] !== B.w[t] || A.load[t] !== B.load[t]) return 'hour ' + t + ': demand ' + A.load[t] + ' and ' + B.load[t];
    for (const e of m.tech) {
      const a = CX.avail(e, A).a, b = CX.avail(m2.tech.find(x => x.id === e.id), B).a;
      for (let t = 0; t < A.H; t++) if (a[t] !== b[t]) return CX.nameOf(e) + ', hour ' + t + ': ' + a[t] + ' and ' + b[t];
    }
    return '';
  }
  // Plans to hold them to: every climate, daily variability, still day and load shape, farms with and without weather, and the 400 seeded random plans of A1.
  const plans = [];
  for (const climate of Object.keys(CX.CLIMATES)) for (const dm of ['', 'day2', 'week']) for (const stress of [true, false]) for (const base of CX.LOAD_KEYS)
    plans.push({ climate, stress, plan: { v: 2, load: { base, dv: dm ? 1 : 0, dm: dm || 'day2', f2: dm === 'day2' ? [1, 0.87] : '' }, tech: [{ id: 1, kind: 'pv', cf: 0.2, prof: { dv: base === 'res' ? 1 : 0 } }, { id: 2, kind: 'wind', cf: 0.35, prof: { dv: base === 'com' ? 1 : 0 } }] } });
  for (let k = 0; k < 400; k++) {
    const R = rng(4000 + k), climate = Object.keys(CX.CLIMATES)[Math.floor(R() * 3)];
    plans.push({ climate, stress: R() < 0.7, plan: { v: 2, load: randomProfile(R, 'load', climate), tech: [
      { id: 1, kind: 'pv', cf: +(0.12 + R() * 0.25).toFixed(3), prof: randomProfile(R, 'pv', climate), exist: R() < 0.5 ? 100 : 0, build: R() < 0.8 ? 1 : 0 },
      { id: 2, kind: 'wind', cf: +(0.2 + R() * 0.3).toFixed(3), prof: randomProfile(R, 'wind', climate) }] } });
  }
  let one = 0, all = 0, yr = 0, yrWeek = 0, flipped = 0, tplBad = [];
  plans.forEach((c, ci) => {
    const m = CX.load(c.plan), o = CX.options({ climate: c.climate, stress: c.stress }), S = CX.sample(m, o);
    const whos = ['load', 1, 2], back = {};
    // A load's file whose peak day is in winter makes a temperate climate winter-peaking (and in summer, summer-peaking), which changes nothing a file-run load or a farm runs on.
    let o2 = o;
    const flips = got => got.climate && got.climate === CX.CLIMATES[c.climate].flip;
    for (const who of whos) {
      const own = CX.need(profOf(m, who), kindOf(m, who) === 'load' ? 'load' : kindOf(m, who));
      const { got } = template(m, o, who, own + '.s');
      if (got.errors.length || (got.climate && !(who === 'load' && flips(got)))) { tplBad.push(ci + ' ' + who + ': ' + (got.errors[0] || got.climate)); continue; }
      if (got.climate) { o2 = Object.assign({}, o, { climate: got.climate }); flipped++; }
      back[who] = got.ts;
      const why = sameRun(m, swapped(m, [[who, got.ts]]), o, who === 'load' ? o2 : o);
      if (why) tplBad.push(c.climate + ' plan ' + ci + ', ' + who + ' at ' + own + ': ' + why); else one++;
    }
    if (Object.keys(back).length === 3) { const why = sameRun(m, swapped(m, whos.map(w => [w, back[w]])), o, o2); if (why) tplBad.push('plan ' + ci + ', all three: ' + why); else all++; }
    // A whole year: where the plan runs a week, the very same run; else, the same week it would run.
    if (S.sample === 'week' || ci % 5 === 0) {
      const yb = {};
      for (const who of whos) {
        const { got } = template(m, o, who, 'year');
        if (got.errors.length || (got.climate && !(who === 'load' && flips(got))) || got.ts.r !== 'week') { tplBad.push('plan ' + ci + ', ' + who + ', a year: ' + (got.errors[0] || got.climate || got.ts.r)); continue; }
        yb[who] = got.ts;
        if (S.sample !== 'week') {
          const g = CX.gridOf(S, seriesOf(m, S, who), 'week'), pk = peakOf(m, o, who);
          const diff = S.seasons.some(s => g.s[s.name].some((v, t) => v !== got.ts.s[s.name][t])) || pk.h.some((v, h) => v !== got.ts.pk.h[h]) || pk.s !== got.ts.pk.s;
          if (diff) tplBad.push('plan ' + ci + ', ' + who + ', a year: not the week it runs'); else yr++;
        }
      }
      if (S.sample === 'week' && Object.keys(yb).length === 3) { const why = sameRun(m, swapped(m, whos.map(w => [w, yb[w]])), o, o2); if (why) tplBad.push('plan ' + ci + ', a year each: ' + why); else yrWeek++; }
    }
  });
  check('A5 a profile\'s template for each season, read back, runs on the very same hours', tplBad.filter(x => !/year/.test(x)).length === 0,
    one + ' profiles (load, solar and wind, ' + plans.length + ' plans: every climate, daily variability, still day and shape, and 400 seeded random ones with files, peak days and seasons missing), ' + all + ' plans with all three swapped (' + flipped + ' whose file peaks in the other temperate season, which flips summer and winter peaking and changes nothing it runs); every weight, demand and availability to the last bit' +
    (tplBad.length ? '; ' + tplBad.slice(0, 3).join(' | ') : ''));
  check('A5 a whole year written from a profile reads back to the week each season it runs', tplBad.filter(x => /year/.test(x)).length === 0,
    yrWeek + ' plans that run a week run on the very same hours with all three from a year (every climate, north and south); ' + yr + ' years from plans that run fewer days give the same week to the last bit');

  // Every template the menu offers reads back at its days: each season its own as the run takes it, or one for every season, their average by days.
  let menuN = 0;
  const menuBad = [];
  for (const climate of Object.keys(CX.CLIMATES)) for (const L of [{ base: 'com' }, { base: 'res', dv: 1, dm: 'day2', f2: [1, 0.85] }, { base: 'resev', dv: 1, dm: 'week' }]) {
    const m = CX.load({ v: 2, load: L, tech: [{ id: 1, kind: 'pv', cf: 0.21, prof: { dv: 1 } }, { id: 2, kind: 'wind', cf: 0.33 }] }), o = CX.options({ climate });
    const S = CX.sample(m, o);
    for (const who of ['load', 1, 2]) for (const key of ['day', 'day2', 'week', 'day.s', 'day2.s', 'week.s']) {
      const { got, g, text } = template(m, o, who, key), r = key.split('.')[0], seasonal = /\.s$/.test(key);
      menuN++;
      const rows = text.split('\r\n').filter(l => l && !/^"?#/.test(l)).length - 1, want = 24 * NDAYS[r] * (seasonal ? S.seasons.length : 1) + 24;
      if (got.errors.length || got.ts.r !== r || got.climate || rows !== want) { menuBad.push(climate + ' ' + who + ' ' + key + ': ' + (got.errors[0] || got.ts.r + ', ' + rows + ' rows')); continue; }
      if (JSON.stringify(Object.keys(got.ts.s)) !== JSON.stringify(seasonal ? S.seasons.map(s => s.name) : ['*']) || got.ts.pk.s !== (seasonal ? peakOf(m, o, who).s : '')) { menuBad.push(climate + ' ' + who + ' ' + key + ': ' + Object.keys(got.ts.s).join('/') + ', peak in ' + got.ts.pk.s); continue; }
      // A load reads back per unit of its highest hour, which days cut from a week, or an average of seasons, may not reach.
      const pk = peakOf(m, o, who);
      let most = 1;
      if (kindOf(m, who) === 'load') { most = Math.max(...pk.h); Object.values(g.s).forEach(a => a.forEach(v => { if (v > most) most = v; })); }
      for (const sn of Object.keys(g.s)) if (g.s[sn].some((v, t) => v / most !== got.ts.s[sn][t])) { menuBad.push(climate + ' ' + who + ' ' + key + ' ' + sn + ': off'); break; }
      if (!seasonal) {
        // The average of the seasons by their days, written out here.
        const per = CX.gridOf(S, seriesOf(m, S, who), r), W = S.seasons.reduce((a, s) => a + s.days, 0);
        const avg = per.s[S.seasons[0].name].map((_, t) => S.seasons.reduce((a, s) => a + s.days * per.s[s.name][t], 0) / W);
        if (avg.some((v, t) => Math.abs(v / most - got.ts.s['*'][t]) > 1e-12)) menuBad.push(climate + ' ' + who + ' ' + key + ': not the average of its seasons');
      }
    }
  }
  check('A5 every template the menu offers reads back at its days, with its peak day', menuBad.length === 0, menuN + ' templates (one day, a weekday and a weekend day, a week, the same in every season or each its own; from a profile at each of them)' + (menuBad.length ? '; ' + menuBad.slice(0, 3).join(' | ') : ''));

  /* A year of hours from a file, held to an averaging written out here:
     each day to its season by its month (or its Season cell), each week's
     hour the plain mean of its weekday's hours in the season, the peak day
     (the load's highest hour's, or the one marked) left out of them. */
  const MON = { sum: ['Summer', 'Summer', 'Autumn', 'Autumn', 'Autumn', 'Winter', 'Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer'],
                trop: ['Wet season', 'Wet season', 'Wet season', 'Wet season', 'Dry season', 'Dry season', 'Dry season', 'Dry season', 'Dry season', 'Dry season', 'Wet season', 'Wet season'] };
  // The south's months, as the climate keys without -n have them; the north's six months on.
  const seasonAt = (climate, mon) => { const b = climate.replace(/-n$/, ''); return MON[b === 'win' ? 'sum' : b][climate === b ? mon : (mon + 6) % 12]; };
  function yearWant(hours, climate, load) {
    // hours: [{ t (hours since 1970), v, season? , pk? }]
    const recs = hours.map(x => { const d = new Date(x.t * 3600e3); return Object.assign({}, x, { day: Math.floor(x.t / 24), h: d.getUTCHours(), wd: (d.getUTCDay() + 6) % 7, season: x.season || seasonAt(climate, d.getUTCMonth()) }); });
    let pkDay = null, pkS = '';
    const marked = recs.filter(x => x.pk);
    if (marked.length) { pkDay = marked[0].day; pkS = marked[0].season; }
    else if (load) { let b = recs[0]; for (const x of recs) if (x.v > b.v) b = x; pkDay = b.day; pkS = b.season; }
    const sum = {}, cnt = {};
    for (const x of recs) { if (x.day === pkDay) continue; const k = x.season + '|' + (x.wd * 24 + x.h); sum[k] = (sum[k] || 0) + x.v; cnt[k] = (cnt[k] || 0) + 1; }
    const s = {};
    for (const sn of CX.CLIMATES[climate].seasons.map(z => z.name)) s[sn] = Array.from({ length: 168 }, (_, i) => sum[sn + '|' + i] / cnt[sn + '|' + i]);
    const pk = pkDay === null ? null : { s: pkS, h: Array.from({ length: 24 }, (_, h) => recs.find(x => x.day === pkDay && x.h === h).v) };
    // Per unit of the highest hour it keeps: the peak day's, or a typical week's.
    const most = load ? Math.max(...Object.values(s).flat(), ...(pk ? pk.h : [])) : 1;
    for (const sn in s) s[sn] = s[sn].map(v => v / most);
    if (pk) pk.h = pk.h.map(v => v / most);
    return { s, pk, most };
  }
  const ymd = t => { const d = new Date(t * 3600e3); return d.toISOString().slice(0, 10) + ' ' + String(d.getUTCHours()).padStart(2, '0') + ':00'; };
  const yearOf = (y, seed, f) => { const R = rng(seed), t0 = Date.UTC(y, 0, 1) / 3600e3, n = (Date.UTC(y + 1, 0, 1) / 3600e3) - t0; return Array.from({ length: n }, (_, i) => ({ t: t0 + i, v: f(t0 + i, R) })); };
  const loadYear = (t, R) => { const d = new Date(t * 3600e3), h = d.getUTCHours(), m = d.getUTCMonth(); return +(600 + 300 * Math.sin(Math.PI * Math.max(0, h - 6) / 15) + 150 * Math.cos(2 * Math.PI * m / 12) + 80 * R() - ((d.getUTCDay() % 6 === 0) ? 90 : 0)).toFixed(1); };
  const sunYear = (t, R) => { const d = new Date(t * 3600e3), h = d.getUTCHours(); return +(Math.max(0, Math.sin(Math.PI * (h - 6) / 12)) * (0.5 + 0.5 * R())).toFixed(4); };
  const years = [];
  { // In order, a value a row with no labels, summer December to February.
    const hrs = yearOf(2026, 71, loadYear);
    years.push(['8,760 rows in order, no labels, summer Dec to Feb', hrs.map(x => x.v).join('\n'), { kind: 'load', climate: 'sum', year: 2026 }, yearWant(hrs, 'sum', true)]);
  }
  { // Dated in MW, the north: the peak demand is the year's highest hour.
    const hrs = yearOf(2027, 72, loadYear);
    years.push(['ISO date-times in MW, summer Jun to Aug', 'Time,Demand [MW]\n' + hrs.map(x => ymd(x.t) + ',' + x.v).join('\n'), { kind: 'load', climate: 'sum-n', year: 2026 }, yearWant(hrs, 'sum-n', true), { peak: Math.max(...hrs.map(x => x.v)) }]);
  }
  { // A Date and an Hour 1 to 24, the hour ending; tropical.
    const hrs = yearOf(2026, 73, loadYear);
    years.push(['Date and Hour 1 to 24, tropical, wet May to Oct', 'Date,Hour,Load\n' + hrs.map(x => ymd(x.t).slice(0, 10) + ',' + (new Date(x.t * 3600e3).getUTCHours() + 1) + ',' + x.v).join('\n'), { kind: 'load', climate: 'trop-n', year: 2026 }, yearWant(hrs, 'trop-n', true)]);
  }
  { // Times 01:00 to the next year's 00:00, the hour ending; month first.
    const hrs = yearOf(2026, 74, loadYear), us = t => { const d = new Date(t * 3600e3); return (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + '/' + d.getUTCFullYear() + ' ' + d.getUTCHours() + ':00'; };
    years.push(['M/D/YYYY times 01:00 to 00:00, the hour ending', 'Timestamp,Load\n' + hrs.map(x => us(x.t + 1) + ',' + x.v).join('\n'), { kind: 'load', climate: 'win', year: 2026 }, yearWant(hrs, 'win', true)]);
  }
  { // A leap year in order from 1 January of the plan's first year, 8,784 rows.
    const hrs = yearOf(2028, 75, loadYear);
    years.push(['8,784 rows in order, a leap year, winter-peaking Dec to Feb', 'Load\n' + hrs.map(x => x.v).join('\n'), { kind: 'load', climate: 'win-n', year: 2028 }, yearWant(hrs, 'win-n', true)]);
  }
  { // A Season column: March goes to Winter, and one day is marked the peak day.
    const hrs = yearOf(2026, 76, loadYear), mk = Math.floor(Date.UTC(2026, 6, 15) / 864e5);
    hrs.forEach(x => { const d = new Date(x.t * 3600e3); if (d.getUTCMonth() === 2) x.season = 'Winter'; if (Math.floor(x.t / 24) === mk) { x.pk = true; x.season = 'Winter'; } });
    years.push(['a Season column, March in Winter, a day marked peak', 'Time,Season,Load\n' + hrs.map(x => ymd(x.t) + ',' + (x.pk ? 'Winter peak day' : x.season || seasonAt('sum', new Date(x.t * 3600e3).getUTCMonth())) + ',' + x.v).join('\n'),
      { kind: 'load', climate: 'sum', year: 2026 }, yearWant(hrs, 'sum', true)]);
  }
  { // A solar farm's year: no peak day unless one is marked; its shares as they are.
    const hrs = yearOf(2026, 77, sunYear);
    years.push(['a solar farm\'s year, no peak day, tropical', 'Time,Output\n' + hrs.map(x => ymd(x.t) + ',' + x.v).join('\n'), { kind: 'pv', climate: 'trop', year: 2026 }, yearWant(hrs, 'trop', false)]);
  }
  let yOk = 0;
  const yBad = [];
  for (const [name, text, op, want, extra] of years) {
    let got;
    try { got = CX.readProfileFile(CX.csvRows(text), Object.assign({ who: 'It', peak: 1000 }, op)); } catch (e) { yBad.push(name + ': threw ' + e.message); continue; }
    if (got.errors.length) { yBad.push(name + ': ' + got.errors[0]); continue; }
    let off = 0;
    for (const sn of Object.keys(want.s)) want.s[sn].forEach((v, t) => { off = Math.max(off, Math.abs(v - got.ts.s[sn][t])); });
    const pkOk = want.pk ? got.ts.pk && got.ts.pk.s === want.pk.s && want.pk.h.every((v, h) => Math.abs(v - got.ts.pk.h[h]) < 1e-12) : !got.ts.pk;
    if (got.ts.r !== 'week' || off > 1e-12 || !pkOk || (extra && extra.peak && got.peak !== extra.peak)) yBad.push(name + ': ' + got.ts.r + ', off ' + e1(off) + ', peak day ' + (got.ts.pk ? got.ts.pk.s : 'none') + (extra ? ', peak ' + got.peak : ''));
    else yOk++;
  }
  check('A5 a year of hours is averaged into a typical week for each season, its peak day kept apart', yBad.length === 0,
    yOk + ' years (in order and dated, north and south of the equator, a leap year, the hour ending, month first, a Season column, a marked peak day, MW, a solar farm), each to an averaging written out here' + (yBad.length ? '; ' + yBad.slice(0, 3).join(' | ') : ''));


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
    ['tabs and thousands separators, in MW', 'Hour\tLoad [MW]\n' + H.map(h => h + '\t' + (2000 * shape(h)).toLocaleString('en-US', { minimumFractionDigits: 1 })).join('\n'), { r: 'day', keys: ['*'], at: [12, shape(12)] }],
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

  // The peak day in a file of typical days: its rows by the Day column, by the Season column, or among a column a season.
  const pkLayouts = [
    ['Peak day in the Day column, no seasons', 'Day,Hour,Load\n' + H.map(h => 'Every day,' + hh(h) + ',' + shape(h)).join('\n') + '\n' + H.map(h => 'Peak day,' + hh(h) + ',' + (shape(h) * 1.25).toFixed(6)).join('\n'), '', 1 / 1.25],
    ['a Season and Peak day', 'Season,Day,Hour,Load\n' + SEAS.flatMap(s => H.map(h => [s, 'Every day', h, s === 'Winter' ? shape(h) : 0.6].join(','))).join('\n') + '\n' + H.map(h => ['Winter', 'Peak day', h, shape(h) * 1.1].join(',')).join('\n'), 'Winter', 1 / 1.1],
    ['"Summer peak day" in the Season column', 'Season,Hour,Load\n' + SEAS.flatMap(s => H.map(h => [s, h, shape(h)].join(','))).join('\n') + '\n' + H.map(h => ['Summer peak day', h, shape(h)].join(',')).join('\n'), 'Summer', 1],
    ['a column a season, the peak day in its own', 'Day,Hour,Summer,Winter\n' + H.map(h => ['Every day', h, shape(h), 0.5].join(',')).join('\n') + '\n' + H.map(h => ['Peak day', h, shape(h) * 2, ''].join(',')).join('\n'), '', 0.5]
  ];
  let pkOk = 0;
  const pkBad = [];
  for (const [name, text, s, top] of pkLayouts) {
    const got = read(text);
    if (got.errors.length) { pkBad.push(name + ': ' + got.errors[0]); continue; }
    const most = Math.max(...Object.values(got.ts.s).flat());
    if (!got.ts.pk || got.ts.pk.s !== s || Math.abs(Math.max(...got.ts.pk.h) - 1) > 1e-12 || Math.abs(most - top) > 1e-6 || got.ts.r !== 'day') pkBad.push(name + ': ' + JSON.stringify(got.ts.pk && got.ts.pk.s) + ', typical top ' + most);
    else pkOk++;
  }
  check('A5 a file\'s peak day reads apart from its typical days, its highest hour the peak', pkBad.length === 0, pkOk + ' layouts' + (pkBad.length ? '; ' + pkBad.join(' | ') : ''));

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
    ['a year of hours in two columns', 'A,B\n' + Array(8760).fill('1,2').join('\n')],
    ['a year of dates both day first and month first', 'Time,Load\n' + Array.from({ length: 24 * 40 }, (_, i) => { const d = new Date(Date.UTC(2026, 0, 1) + i * 3600e3); return (i < 24 * 20 ? d.getUTCDate() + '/' + (d.getUTCMonth() + 1) : (d.getUTCMonth() + 1) + '/' + d.getUTCDate()) + '/2026 ' + d.getUTCHours() + ':00,1'; }).join('\n')],
    ['a year with an hour twice', 'Time,Load\n' + Array.from({ length: 24 * 10 }, (_, i) => new Date(Date.UTC(2026, 0, 1) + i * 3600e3).toISOString().slice(0, 16).replace('T', ' ') + ',1').concat(['2026-01-03 05:00,2']).join('\n')],
    ['a year whose peak day is marked on two days', 'Time,Season,Load\n' + Array.from({ length: 24 * 10 }, (_, i) => new Date(Date.UTC(2026, 0, 1) + i * 3600e3).toISOString().slice(0, 16).replace('T', ' ') + ',' + (i % 24 === 3 ? 'Summer peak day' : 'Summer') + ',1').join('\n')],
    ['a year in order whose hours are not', 'Hour,Load\n' + Array.from({ length: 8760 }, (_, i) => ((i + 1) % 24) + ',1').join('\n')],
    ['a peak day with an hour missing', 'Day,Hour,Load\n' + H.map(h => 'Every day,' + h + ',1').join('\n') + '\n' + H.slice(1).map(h => 'Peak day,' + h + ',1.2').join('\n')],
    ['a peak day with a blank hour', 'Day,Hour,Load\n' + H.map(h => 'Every day,' + h + ',1').join('\n') + '\n' + H.map(h => 'Peak day,' + h + ',' + (h === 7 ? '' : 1.2)).join('\n')],
    ['a peak day in two seasons', 'Season,Day,Hour,Load\n' + ['Summer', 'Winter'].flatMap(s => H.map(h => s + ',Every day,' + h + ',1')).join('\n') + '\n' + H.map(h => (h < 12 ? 'Summer' : 'Winter') + ',Peak day,' + h + ',1.2').join('\n')],
    ['a peak day with a value in two columns', 'Day,Hour,Summer,Winter\n' + H.map(h => 'Every day,' + h + ',1,0.9').join('\n') + '\n' + H.map(h => 'Peak day,' + h + ',1.2,1.1').join('\n')],
    ['only a peak day', 'Day,Hour,Load\n' + H.map(h => 'Peak day,' + h + ',1').join('\n')],
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
  for (const [name, text] of [['a farm\'s year with another climate\'s seasons', 'Time,Season,Output\n' + Array.from({ length: 24 * 10 }, (_, i) => new Date(Date.UTC(2026, 0, 1) + i * 3600e3).toISOString().slice(0, 16).replace('T', ' ') + ',Dry season,0.3').join('\n')], ['MW for a farm', 'Hour,Output [MW]\n' + H.map(h => h + ',5').join('\n')], ['another climate\'s seasons for a farm', 'Hour,Dry,Wet\n' + H.map(h => h + ',0.5,0.4').join('\n')], ['shares over 100', 'Hour,Output\n' + H.map(h => h + ',' + 300).join('\n')]]) {
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

  /* ── A6: the same plan from its profiles as files ──
     Each plan solved as it is, then with the load and every solar and wind
     farm swapped for its template read back, saved and opened again: the
     plan must be the very same, every build and the objective to the digit
     (raw), and its present cost and new capacity to the last bit. */
  console.log('\n── A6 the same plan from its profiles as files ──');
  const filesFor = (m, o, key) => {
    const list = [];
    for (const who of ['load', ...m.tech.filter(e => e.kind === 'pv' || e.kind === 'wind').map(e => e.id)]) {
      const own = CX.need(profOf(m, who), who === 'load' ? 'load' : kindOf(m, who)), k = key === 'own' ? own + '.s' : key;
      const { got } = template(m, o, who, k);
      if (got.errors.length || got.climate) throw new Error(who + ' ' + k + ': ' + (got.errors[0] || got.climate));
      list.push([who, got.ts]);
    }
    return swapped(m, list);
  };
  const samePlanAs = (a, b) => a.report.ok && b.report.ok && JSON.stringify(a.raw) === JSON.stringify(b.raw) && a.totals.npv === b.totals.npv && a.totals.built === b.totals.built && a.totals.avgCost === b.totals.avgCost;
  const exactRuns = [];
  for (const key of Object.keys(CX.PRESETS)) for (const stress of [true, false]) {
    if (!stress && key !== 'grow' && key !== 'island') continue;
    exactRuns.push({ name: '"' + key + '"' + (stress ? '' : ' with no still day'), fields: Object.assign({}, CX.PRESETS[key].fields, { stress }), plan: CX.PRESETS[key].plan, from: ['own'] });
  }
  const islandWeek = Object.assign({}, CX.PRESETS.island.plan, { load: { base: 'res', dv: 1, dm: 'week' } });
  exactRuns.push({ name: '"island" as a week each season', fields: Object.assign({}, CX.PRESETS.island.fields), plan: islandWeek, from: ['week.s', 'year'] });
  exactRuns.push({ name: '"island" north of the equator as a week each season', fields: Object.assign({}, CX.PRESETS.island.fields, { climate: 'trop-n' }), plan: islandWeek, from: ['year'] });
  exactRuns.push({ name: 'a temperate grid peaking Jun to Aug as a week each season', fields: { end: 2031, climate: 'sum-n' }, plan: Object.assign({}, CX.PRESETS.grow.plan, { load: { base: 'sys', dv: 1, dm: 'week' } }), from: ['week.s', 'year'] });
  for (const x of exactRuns) {
    const m = CX.load(x.plan), o = CX.options(x.fields), res0 = await CX.solve(psa, CX.load(x.plan), x.fields), out = [];
    let ok = res0.report.ok;
    for (const key of x.from) {
      let res1;
      try { res1 = await CX.solve(psa, filesFor(m, o, key), x.fields); } catch (e) { ok = false; out.push(key + ': ' + e.message); continue; }
      const same = samePlanAs(res0, res1);
      ok = ok && same;
      out.push((key === 'own' ? 'each at its own days for each season' : key === 'year' ? 'a year each' : 'a week each season') + (same ? '' : ' DIFFERS: ' + e1(res1.raw[2]) + ' against ' + e1(res0.raw[2])));
    }
    check('A6 ' + x.name + ' from its profiles as files is the very same plan', ok, res0.report.H + ' hours a year × ' + res0.report.K + ', ' + CX.fmt.mw(res0.totals.built) + ' MW, ' + CX.fmt.big(res0.totals.npv, '$') + '; ' + out.join(', '));
  }
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
  // The line of the week draws a weekday and a weekend day apart, and a week as one run.
  const runs = () => page.evaluate(() => document.querySelectorAll('[data-prof="load"] svg[data-line="w"] .pl').length);
  const runs1 = await runs(), seg1 = await page.evaluate(() => document.querySelector('[data-prof="load"] [data-pk="dm"] .seg-btn[data-val="day2"]').textContent);
  await page.click('[data-prof="load"] [data-pk="dm"] .seg-btn[data-val="week"]');
  const s2 = await sampleNow(), runs2 = await runs();
  check('B daily variability sets each season: one day, a weekday and a weekend day, a week, never chosen in Assumptions', s0.v === 'day' && s1.v === 'day2' && s2.v === 'week' && s0.off && /daily variability/.test(s2.why), [s0.v, s1.v, s2.v].join(' → ') + '; ' + s2.why);
  check('B Weekdays/end draws the weekday and the weekend day apart, a full week in one run', seg1 === 'Weekdays/end' && runs1 === 2 && runs2 === 1, seg1 + ': ' + runs1 + ' runs, a week ' + runs2);
  // Dragging a daily bar changes that day.
  const before = await page.evaluate(() => __cx.app.model.load.f7);
  const bars = page.locator('[data-prof="load"] svg[data-bars="d"]'), box = await bars.boundingBox();
  await page.mouse.move(box.x + box.width * (6.5 / 7) * (240 / 256) + box.width * 8 / 256, box.y + box.height * 0.7);
  await page.mouse.down(); await page.mouse.up();
  const after = await page.evaluate(() => __cx.app.model.load.f7);
  check('B a daily bar drags that day of the week', !Array.isArray(before) && Array.isArray(after) && after.length === 7 && after[6] < 0.84 && after[0] === 0.97, JSON.stringify(after));
  // The template menu: seven templates, their rows counted for the climate and the first year, each read back by the page.
  await page.selectOption('#cxProfile', 'custom');
  const tplOf = async (sel, r) => {
    await page.click(sel + ' [data-act="tpl"]');
    await page.waitForSelector('#tplMenu.is-open', { timeout: 3000 });
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#tplMenu .share-opt[data-r="' + r + '"]')]);
    return readFileSync(await dl.path(), 'utf8');
  };
  const tplRead = (t, kind) => page.evaluate(([t, kind]) => {
    const o = __cx.plan(), g = CX.readProfileFile(CX.csvRows(t), { kind, who: 'x', climate: o.climate, peak: 1000, year: o.start });
    return g.errors.length ? g.errors[0] : g.ts.r + '|' + Object.keys(g.ts.s).join('/') + '|' + (g.ts.pk ? 'peak day' : 'none');
  }, [t, kind]);
  const dataRows = t => t.split('\r\n').filter(l => l && !/^"?#/.test(l)).length - 1;
  await page.click('[data-prof="load"] [data-act="tpl"]');
  await page.waitForSelector('#tplMenu.is-open', { timeout: 3000 });
  const menu = (await page.evaluate(() => [...document.querySelectorAll('#tplMenu .share-opt')].map(b => b.getAttribute('data-r') + ': ' + b.querySelector('.combo-main').textContent + ' / ' + b.querySelector('.combo-sub').textContent))).join('\n');
  await page.keyboard.press('Escape');
  check('B the template menu offers seven templates, their rows counted for the climate and the first year', menu.split('\n').length === 7 && /^week\.s: Daily \+ seasonal, full week \/ A week each season: 672 rows$/m.test(menu) && /^day: Hourly variability \/ One typical day: 24 rows$/m.test(menu) && /^year: Full year \/ Every hour of 2026, read into a week each season: 8,760 rows$/m.test(menu), menu.replace(/\n/g, ' · ').slice(0, 260));
  const load = '[data-prof="load"]', SEAS4 = 'Summer/Autumn/Winter/Spring';
  const wk = await tplOf(load, 'week.s'), wkR = await tplRead(wk, 'load');
  check('B the load\'s seasonal week reads back as a week each season and its peak day, with its notes', wkR === 'week|' + SEAS4 + '|peak day' && dataRows(wk) === 672 + 24 && /^"# Capacity Expansion Planner/.test(wk) && /^Winter,Sun,23:00,/m.test(wk), wkR + ', ' + dataRows(wk) + ' rows');
  const tplDay = await tplOf(load, 'day'), tplDay2 = await tplOf(load, 'day2');
  const got1 = await tplRead(tplDay, 'load'), got2 = await tplRead(tplDay2, 'load');
  const shut = await page.evaluate(() => !document.querySelector('#tplMenu.is-open') && document.querySelector('[data-prof="load"] [data-act="tpl"]').getAttribute('aria-expanded') === 'false' && document.activeElement === document.querySelector('[data-prof="load"] [data-act="tpl"]'));
  check('B one typical day, and a weekday and a weekend day, read back the same in every season, each with its peak day', got1 === 'day|*|peak day' && got2 === 'day2|*|peak day' && dataRows(tplDay) === 24 + 24 && dataRows(tplDay2) === 48 + 24 && shut,
    got1 + ' (' + dataRows(tplDay) + ' rows), ' + got2 + ' (' + dataRows(tplDay2) + ' rows), closed ' + shut);
  const yrT = await tplOf(load, 'year'), yrR = await tplRead(yrT, 'load');
  check('B the load\'s full year is every hour of the first year in its seasons, and reads back as a week each season', yrR === 'week|' + SEAS4 + '|peak day' && dataRows(yrT) === 8760 && /^2026-01-01 00:00,Summer peak day,/m.test(yrT) && /^2026-01-02 00:00,Summer,/m.test(yrT) && /^2026-07-01 00:00,Winter,/m.test(yrT),
    yrR + ', ' + dataRows(yrT) + ' rows');
  // The keyboard: ArrowDown opens it on its first row, End is its last, Escape closes it back to the button.
  await page.focus('[data-prof="load"] [data-act="tpl"]');
  await page.keyboard.press('ArrowDown');
  const keyOpen = await page.evaluate(() => !!document.querySelector('#tplMenu.is-open') && document.activeElement === document.querySelector('#tplMenu .share-opt[data-r="day"]'));
  await page.keyboard.press('End');
  const keyEnd = await page.evaluate(() => document.activeElement === document.querySelector('#tplMenu .share-opt[data-r="year"]'));
  await page.keyboard.press('Escape');
  const keyShut = await page.evaluate(() => !document.querySelector('#tplMenu.is-open') && document.activeElement === document.querySelector('[data-prof="load"] [data-act="tpl"]'));
  check('B the template menu is driven by the keyboard as the Share menu is', keyOpen && keyEnd && keyShut, [keyOpen, keyEnd, keyShut].join(' '));
  // The full year opened in the page: a week each season and its peak day, and the page says how it was read.
  await (async () => { const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click(load + ' [data-act="open"]')]); await fc.setFiles({ name: 'year.csv', mimeType: 'text/csv', buffer: Buffer.from(yrT) }); })();
  await page.waitForFunction(() => __cx.app.model.load.base === 'custom' && __cx.app.model.load.ts && __cx.app.model.load.ts.pk, null, { timeout: 30000 });
  const yrIn = await page.evaluate(() => ({ r: __cx.app.model.load.ts.r, keys: Object.keys(__cx.app.model.load.ts.s).join('/'), msg: document.querySelector('[data-prof="load"] .up-msg').textContent, derived: document.querySelector('[data-prof="load"] .prof-body .derived:last-child').textContent }));
  check('B a full year opened in the page is a week each season and its own peak day, and says so', yrIn.r === 'week' && yrIn.keys === SEAS4 && /A year of hours, 1 Jan 2026 to 31 Dec 2026 \(365 days\)/.test(yrIn.msg) && /peak day/.test(yrIn.derived), yrIn.msg.slice(0, 120));
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
  // The climate sits in the load profile, one select that names its months, so the seasons' dates follow it.
  const place = await page.evaluate(() => ({ group: document.getElementById('cxClimate').closest('.field-group').querySelector('.group-title').textContent,
    opts: [...document.getElementById('cxClimate').options].map(o => o.value).join(' '), hemi: !!document.getElementById('cxHemi'), note: !!document.getElementById('climateNote'), tip: document.getElementById('climateTip').getAttribute('data-tip') }));
  await page.selectOption('#cxClimate', 'sum-n');
  const north = await page.evaluate(() => document.getElementById('climateTip').getAttribute('data-tip'));
  await page.selectOption('#cxClimate', 'sum');
  check('B the climate sits in the load profile, one select that names the months, its tip naming the hemisphere and a country or two',
    place.group === 'Load profile' && place.opts === 'sum sum-n win win-n trop trop-n' && !place.hemi && !place.note &&
      /Dec to Feb:.*Southern hemisphere, e\.g\. Australia/.test(place.tip) && /Jun to Aug:.*Northern hemisphere, e\.g\. the United States/.test(north),
    place.group + ', ' + place.opts + '; ' + north.slice(-60));
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
  // A farm's Custom has the same template menu: its one typical day from the file, cut into a weekday and a weekend day.
  const pvTpl = await tplOf(card, 'day2.s'), pvR = await tplRead(pvTpl, 'pv');
  const pvMsg = await page.evaluate(c => document.querySelector(c + ' .up-msg').textContent, card);
  check('B a solar farm\'s template menu gives a weekday and a weekend day each season from its one typical day, and says so', pvR === 'day2|' + SEAS4 + '|peak day' && dataRows(pvTpl) === 4 * 48 + 24 && /\r\nSummer,Weekend,00:00,/.test(pvTpl) && /its one typical day repeated/.test(pvMsg), pvR + ', ' + dataRows(pvTpl) + ' rows; ' + pvMsg.slice(0, 120));
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
