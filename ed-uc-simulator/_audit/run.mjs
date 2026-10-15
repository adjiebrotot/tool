// ED/UC Simulator audit.
//
//   node ed-uc-simulator/_audit/run.mjs
//
// The tool's answers are held to things it did not compute itself:
//
//   A1  PJM 5-bus against the dispatch, nodal prices and cost Li and Bo publish.
//   A2  Every result replayed from the problem's own definition, by code that
//       shares nothing with PSA.js: each bus balances in every hour; the flows
//       are the DC power flow of the injections (a B-θ solve written here);
//       no limit, ramp, minimum up or down time or storage level is broken;
//       start-ups follow the commitment; the cost adds up to PyPSA's objective.
//       Every Quick Start in all three modes, and 30 seeded random networks.
//   A3  Unit commitment is optimal: small cases solved again by enumerating
//       every commitment schedule there is, each dispatched by merit order.
//       The relaxation and economic dispatch are never dearer than it.
//   A4  The prices are marginal costs: a unit running strictly between its
//       limits on an uncongested system sets the price; one below it runs flat
//       out, one above it does not run.
//   A5  The engine files are the ones their banners name (sha256).
//   B   The real page in headless Chromium: the solve runs in its worker; the
//       KPIs and the CSV tables say what the results say; the Run gate is
//       honest; hostile saved state never breaks it; the SVG export is strict
//       XML; and a larger unit commitment solves in a few seconds.

import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TOOL = join(HERE, '..');
const ROOT = join(TOOL, '..');
let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  console.log((ok ? '  PASS  ' : '✗ FAIL  ') + name + (detail ? '  — ' + detail : ''));
  ok ? pass++ : fail++;
};
const e1 = x => (typeof x === 'number' ? x.toExponential(1) : String(x));

/* ── The engine and the core, as the worker loads them ──
   ed-core.js is loaded into this realm: PSA.js reads option objects by their prototype. */
const psa = await import(pathToFileURL(join(TOOL, 'engine', 'psa-opt.min.js')).href);
psa.logger.handler = () => {};
await import(pathToFileURL(join(TOOL, 'ed-core.js')).href);
const ED = globalThis.ED;
ED.setTypes(psa.stdTypes());

/* ── The independent replay ── */
// Seeded random numbers, so a failure can be replayed.
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// Solve A x = b (dense, partial pivoting).
function solve(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
  return x;
}

/* The DC power flow written from its definition: per AC island, B θ = P with
   one bus held at 0, and a branch carries (θ0 − θ1) / x. Reactances are per
   unit on 1 MVA: a line's ohms over its first bus's kV², a transformer's per
   unit on its own rating over that rating. */
function dcFlows(model, inject) {
  const byId = ED.byId(model);
  const buses = model.el.filter(e => e.c === 'Bus').map(b => b.id);
  const brs = model.el.filter(e => (e.c === 'Line' || e.c === 'Transformer') && byId[e.bus0] && byId[e.bus1] && e.bus0 !== e.bus1);
  const xpu = e => e.c === 'Line' ? ED.lineX(e) / (byId[e.bus0].v_nom ** 2) : e.x / e.s_nom;
  const parent = {}; buses.forEach(b => { parent[b] = b; });
  const find = a => { while (parent[a] !== a) a = parent[a] = parent[parent[a]]; return a; };
  brs.forEach(e => { const a = find(e.bus0), b = find(e.bus1); if (a !== b) parent[b] = a; });
  const islands = {};
  buses.forEach(b => { (islands[find(b)] = islands[find(b)] || []).push(b); });
  const theta = {};
  for (const isl of Object.values(islands)) {
    const idx = {}; isl.forEach((b, i) => { idx[b] = i; });
    const n = isl.length - 1;
    if (n <= 0) { theta[isl[0]] = 0; continue; }
    const B = Array.from({ length: n }, () => new Array(n).fill(0)), P = new Array(n).fill(0);
    brs.forEach(e => {
      if (idx[e.bus0] === undefined) return;
      const y = 1 / xpu(e), i = idx[e.bus0] - 1, j = idx[e.bus1] - 1;
      if (i >= 0) B[i][i] += y; if (j >= 0) B[j][j] += y;
      if (i >= 0 && j >= 0) { B[i][j] -= y; B[j][i] -= y; }
    });
    isl.forEach((b, k) => { if (k) P[k - 1] = inject[b]; });
    const th = solve(B, P);
    theta[isl[0]] = 0; isl.forEach((b, k) => { if (k) theta[b] = th[k - 1]; });
  }
  const flow = {};
  brs.forEach(e => { flow[e.id] = (theta[e.bus0] - theta[e.bus1]) / xpu(e); });
  return flow;
}

/* Every promise a result makes, checked from the model and the options alone.
   Returns the worst breach of each kind (0 when none). */
function replay(model, opts, res) {
  const o = ED.solveOptions(opts), H = o.hours, byId = ED.byId(model);
  const on = e => ED.onBus(model, e);
  const ok = e => byId[e.bus0] && byId[e.bus1] && byId[e.bus0].c === 'Bus' && byId[e.bus1].c === 'Bus' && e.bus0 !== e.bus1;
  const w = { balance: 0, flow: 0, limit: 0, gen: 0, ramp: 0, updown: 0, starts: 0, store: 0, link: 0, cost: 0, objective: 0 };
  const bump = (k, v) => { if (v > w[k]) w[k] = v; };
  const gens = model.el.filter(e => e.c === 'Generator' && on(e));
  const loads = model.el.filter(e => e.c === 'Load' && on(e));
  const stores = model.el.filter(e => e.c === 'StorageUnit' && on(e));
  const links = model.el.filter(e => e.c === 'Link' && ok(e));
  const passive = model.el.filter(e => (e.c === 'Line' || e.c === 'Transformer') && ok(e));
  let cost = 0;
  for (let t = 0; t < H; t++) {
    const inj = {};
    model.el.forEach(e => { if (e.c === 'Bus') inj[e.id] = res.bus[e.id].shed[t]; });
    gens.forEach(e => { inj[e.bus] += res.dev[e.id].p[t]; });
    stores.forEach(e => { inj[e.bus] += res.dev[e.id].p[t]; });
    loads.forEach(e => { inj[e.bus] -= ED.loadSeries(e, H, o.start)[t]; });
    links.forEach(e => { inj[e.bus0] -= res.br[e.id].p0[t]; inj[e.bus1] -= res.br[e.id].p1[t]; });
    // Balance: what is injected leaves through the AC branches.
    const out = {}; Object.keys(inj).forEach(b => { out[b] = 0; });
    passive.forEach(e => { out[e.bus0] += res.br[e.id].p0[t]; out[e.bus1] += res.br[e.id].p1[t]; });
    Object.keys(inj).forEach(b => bump('balance', Math.abs(inj[b] - out[b])));
    // Flows: the DC power flow of those injections.
    const f = dcFlows(model, inj);
    passive.forEach(e => {
      bump('flow', Math.abs(f[e.id] - res.br[e.id].p0[t]));
      bump('flow', Math.abs(res.br[e.id].p0[t] + res.br[e.id].p1[t]));    // lossless
      const lim = ED.rating(e, byId[e.bus0]);
      if (o.limits && isFinite(lim)) bump('limit', Math.max(0, Math.abs(res.br[e.id].p0[t]) - lim) / Math.max(1, lim));
    });
    // Links: sent is delivered times the efficiency, within the rating.
    links.forEach(e => {
      const a = res.br[e.id].p0[t], b = res.br[e.id].p1[t];
      const sent = Math.max(a, b), got = -Math.min(a, b);
      if (!e.both) bump('link', Math.max(0, -a) + Math.abs(b + e.efficiency * a));
      else if (e.efficiency === 1) bump('link', Math.abs(a + b));
      else bump('link', Math.abs(got - e.efficiency * sent));   // one way at a time: what arrives is eff × what is sent
      bump('link', Math.max(0, Math.max(Math.abs(a), Math.abs(b)) - e.p_nom - 1e-6));
    });
  }
  // Units: limits, commitment, ramps, start-ups, cost.
  gens.forEach(e => {
    const d = res.dev[e.id], av = ED.availSeries(e, H, o.start);
    const com = e.committable && o.mode !== 'ed';
    for (let t = 0; t < H; t++) {
      const s = com ? d.status[t] : 1;
      if (com && o.mode === 'uc') bump('gen', Math.min(Math.abs(s), Math.abs(s - 1)));
      if (com) bump('gen', Math.max(0, -s, s - 1));
      bump('gen', Math.max(0, d.p[t] - av[t] * e.p_nom * s - 1e-9));
      bump('gen', Math.max(0, (com ? e.p_min_pu * e.p_nom * s : 0) - d.p[t] - 1e-9));
      cost += e.marginal_cost * d.p[t];
      if (com) cost += e.start_up_cost * d.su[t] + e.shut_down_cost * d.sd[t] + e.stand_by_cost * s;
    }
    // Ramps hold between two hours it runs in (a start-up or shut-down hour is free).
    for (let t = 1; t < H; t++) {
      const both = !com || (d.status[t] > 0.999 && d.status[t - 1] > 0.999);
      if (!both || o.mode === 'lin') continue;
      if (e.ramp_limit_up < 1) bump('ramp', Math.max(0, d.p[t] - d.p[t - 1] - e.ramp_limit_up * e.p_nom - 1e-6));
      if (e.ramp_limit_down < 1) bump('ramp', Math.max(0, d.p[t - 1] - d.p[t] - e.ramp_limit_down * e.p_nom - 1e-6));
    }
    if (com && o.mode === 'uc') {
      const st = d.status.map(Math.round);
      let prev = e.init ? 1 : 0, run = e.init ? Math.max(1, e.min_up_time) : Math.max(1, e.min_down_time);
      for (let t = 0; t < H; t++) {
        bump('starts', Math.abs(d.su[t] - Math.max(0, st[t] - prev)));
        bump('starts', Math.abs(d.sd[t] - Math.max(0, prev - st[t])));
        if (st[t] !== prev) {
          // A switch is allowed only once the state before it has lasted its minimum.
          const need = prev ? e.min_up_time : e.min_down_time;
          if (run < need) bump('updown', need - run);
          run = 1;
        } else run++;
        prev = st[t];
      }
    }
  });
  // Storage: the energy follows the flows in and out, inside its capacity.
  stores.forEach(e => {
    const d = res.dev[e.id], eta = Math.sqrt(e.eff), cap = e.p_nom * e.max_hours;
    let soc = e.cyclic ? d.soc[H - 1] : e.soc0 * cap;
    for (let t = 0; t < H; t++) {
      const p = d.p[t];
      soc = soc + (p < 0 ? -p * eta : -p / eta);
      bump('store', Math.abs(soc - d.soc[t]) / Math.max(1, cap));
      soc = d.soc[t];
      bump('store', Math.max(0, -d.soc[t] - 1e-6, d.soc[t] - cap - 1e-6, Math.abs(p) - e.p_nom - 1e-6));
    }
  });
  model.el.forEach(e => { if (e.c === 'Bus') res.bus[e.id].shed.forEach(v => { cost += v * o.voll; }); });
  // A lossy two-way link's token cost on what it sends (it never sends both ways at once, checked above).
  links.forEach(e => { if (e.both && e.efficiency < 1) for (let t = 0; t < H; t++) cost += ED.LINK_EPS * (Math.max(0, res.br[e.id].p0[t]) + Math.max(0, res.br[e.id].p1[t])); });
  bump('cost', Math.abs(cost - res.totals.cost) / Math.max(1, Math.abs(cost)));
  bump('objective', Math.abs(res.totals.cost - res.totals.objective) / Math.max(1, Math.abs(cost)));
  return w;
}
const TOL = { balance: 1e-5, flow: 1e-4, limit: 1e-7, gen: 1e-6, ramp: 1e-5, updown: 0, starts: 1e-6, store: 1e-7, link: 1e-5, cost: 1e-7, objective: 1e-7 };
function holds(w) { return Object.keys(TOL).filter(k => !(w[k] <= TOL[k])); }

/* ── A1: PJM 5-bus against Li and Bo ── */
console.log('\n── A1 PJM 5-bus against the published dispatch and prices ──');
{
  const pub = { price: { A: 16.98, B: 26.38, C: 30.00, D: 39.94, E: 10.00 },
                gen: { Alta: 40, 'Park City': 170, Solitude: 323.49, Sundance: 0, Brighton: 466.51 }, cost: 17479.90 };
  const p = ED.PRESETS.pjm5, model = ED.load(p.model);
  const res = await ED.solve(psa, model, p.opts);
  const h = 18, byName = {};
  model.el.forEach(e => { byName[ED.nameOf(e)] = e; });
  let wp = 0, wg = 0;
  for (const [b, v] of Object.entries(pub.price)) wp = Math.max(wp, Math.abs(res.bus[byName[b].id].price[h] - v));
  for (const [g, v] of Object.entries(pub.gen)) wg = Math.max(wg, Math.abs(res.dev[byName[g].id].p[h] - v));
  const hc = model.el.filter(e => e.c === 'Generator').reduce((s, e) => s + e.marginal_cost * res.dev[e.id].p[h], 0);
  check('A1 at the 18:00 peak, every nodal price is the published one (to the cent shown)', wp < 0.005, 'worst ' + wp.toFixed(4) + ' $/MWh');
  check('A1 and every unit runs at its published output', wg < 0.005, 'worst ' + wg.toFixed(4) + ' MW');
  check('A1 and the hour costs the published $17,479.90', Math.abs(hc - pub.cost) < 0.005, '$' + hc.toFixed(3));
  check('A1 line D-E is at its 240 MW limit, the only branch that is', Math.abs(Math.abs(res.br[byName['D-E'].id].p0[h]) - 240) < 1e-6 &&
        model.el.filter(e => e.c === 'Line' && e !== byName['D-E'] && e.s_nom > 0).every(e => Math.abs(res.br[e.id].p0[h]) < e.s_nom - 1e-6));
}

/* ── A2: every result replayed ── */
console.log('\n── A2 every result replayed from the problem’s definition ──');
const cases = [];
for (const key of Object.keys(ED.PRESETS)) for (const mode of ['uc', 'lin', 'ed']) cases.push({ name: key + ' ' + mode, model: ED.load(ED.PRESETS[key].model), opts: { ...ED.PRESETS[key].opts, mode } });
// Seeded random networks over everything the tool can draw.
function randomCase(seed) {
  const r = rng(seed), pick = a => a[Math.floor(r() * a.length)];
  const el = [], nb = 2 + Math.floor(r() * 6);
  let id = 1;
  const buses = [];
  for (let i = 0; i < nb; i++) { buses.push(id); el.push({ c: 'Bus', id: id++, v_nom: 110, at: [10 + 12 * i, 10] }); }
  for (let i = 1; i < nb; i++) el.push({ c: 'Line', id: id++, bus0: buses[Math.floor(r() * i)], bus1: buses[i], x: 5 + r() * 40, r: 1, s_nom: r() < 0.6 ? Math.round(40 + r() * 200) : 0 });
  if (nb > 2 && r() < 0.7) el.push({ c: 'Line', id: id++, bus0: buses[0], bus1: buses[nb - 1], x: 10 + r() * 30, s_nom: Math.round(30 + r() * 120) });
  if (r() < 0.4){ const b = id++; el.push({ c: 'Bus', id: b, v_nom: 33, at: [10, 40] }); el.push({ c: 'Transformer', id: id++, bus0: buses[0], bus1: b, s_nom: 120, x: 0.1 }); buses.push(b); }
  const ng = 2 + Math.floor(r() * 4);
  for (let k = 0; k < ng; k++) {
    const com = r() < 0.6;
    el.push({ c: 'Generator', id: id++, bus: pick(buses), p_nom: Math.round(40 + r() * 200), marginal_cost: Math.round(5 + r() * 120),
      committable: com ? 1 : 0, p_min_pu: com ? Math.round(r() * 50) / 100 : 0, start_up_cost: com ? Math.round(r() * 5000) : 0,
      shut_down_cost: com && r() < 0.3 ? Math.round(r() * 1000) : 0, stand_by_cost: com && r() < 0.3 ? Math.round(r() * 300) : 0,
      min_up_time: com ? Math.floor(r() * 5) : 0, min_down_time: com ? Math.floor(r() * 5) : 0, init: r() < 0.6 ? 1 : 0,
      ramp_limit_up: r() < 0.4 ? Math.round((0.2 + r() * 0.6) * 100) / 100 : 1, ramp_limit_down: r() < 0.4 ? Math.round((0.2 + r() * 0.6) * 100) / 100 : 1,
      prof: r() < 0.25 ? pick(['solar', 'wind']) : '' });
  }
  const nl = 1 + Math.floor(r() * 3);
  for (let k = 0; k < nl; k++) el.push({ c: 'Load', id: id++, bus: pick(buses), p_set: Math.round(30 + r() * 180), prof: pick(['', 'sys', 'res', 'com', 'ind']) });
  if (r() < 0.5) el.push({ c: 'StorageUnit', id: id++, bus: pick(buses), p_nom: Math.round(10 + r() * 60), max_hours: 1 + Math.floor(r() * 6), eff: 0.7 + r() * 0.3, cyclic: r() < 0.6 ? 1 : 0, soc0: r() });
  if (r() < 0.4) {
    const a = id++, b = id++;
    el.push({ c: 'Bus', id: a, v_nom: 220, at: [80, 40] });
    el.push({ c: 'Generator', id: id++, bus: a, p_nom: 300, marginal_cost: Math.round(10 + r() * 60) });
    el.push({ c: 'Link', id: b, bus0: buses[0], bus1: a, p_nom: Math.round(30 + r() * 150), efficiency: r() < 0.5 ? 1 : 0.9 + r() * 0.09, both: r() < 0.7 ? 1 : 0 });
  }
  return { name: 'random ' + seed, model: ED.load({ v: 1, el }), opts: { mode: pick(['uc', 'uc', 'lin', 'ed']), hours: pick([24, 24, 48]), limits: r() < 0.85, shed: true } };
}
for (let s = 1; s <= 30; s++) cases.push(randomCase(s));
let solvedN = 0;
for (const c of cases) {
  const res = await ED.solve(psa, c.model, c.opts);
  if (!res.report.ok) { check(`A2 ${c.name} solves`, false, res.report.error); continue; }
  solvedN++;
  const w = replay(c.model, c.opts, res), bad = holds(w);
  check(`A2 ${c.name}: balance, DC flows, limits, units, ramps, up and down times, storage, cost`, !bad.length,
        bad.length ? bad.map(k => k + ' ' + e1(w[k])).join(', ') : 'worst flow ' + e1(w.flow) + ' MW, balance ' + e1(w.balance) + ' MW');
}
console.log('  (' + solvedN + ' of ' + cases.length + ' cases solved)');

/* ── A3: unit commitment against every schedule there is ── */
console.log('\n── A3 unit commitment is optimal: every schedule enumerated ──');
/* One bus, no ramps, no storage: given who is on in an hour, the cheapest
   dispatch runs every unit at its minimum and fills the rest cheapest first,
   shedding what cannot be met at the value of lost load. Infeasible when the
   minimums alone exceed the load (nothing can absorb the surplus). */
function hourCost(units, on, load, voll) {
  let min = 0, cost = 0;
  const run = units.filter((u, i) => on[i]);
  run.forEach(u => { min += u.pmin; cost += u.mc * u.pmin; });
  if (min > load + 1e-9) return Infinity;
  let rest = load - min;
  run.slice().sort((a, b) => a.mc - b.mc).forEach(u => { const q = Math.min(rest, u.pmax - u.pmin); cost += q * u.mc; rest -= q; });
  return cost + rest * voll;
}
function bruteForce(units, loads, voll) {
  const n = units.length, H = loads.length;
  // Each unit's feasible on/off strings, with their start, shut-down and stand-by costs.
  const options = units.map(u => {
    const out = [];
    for (let m = 0; m < (1 << H); m++) {
      const st = Array.from({ length: H }, (_, t) => (m >> t) & 1);
      let prev = u.init, run = u.init ? Math.max(1, u.up) : Math.max(1, u.down), okk = true, c = 0;
      for (let t = 0; t < H && okk; t++) {
        if (st[t] !== prev) { if (run < (prev ? u.up : u.down)) okk = false; run = 1; if (st[t]) c += u.su; else c += u.sd; } else run++;
        prev = st[t]; c += st[t] * u.sb;
      }
      if (okk) out.push({ st, c });
    }
    return out;
  });
  let best = Infinity;
  const pickIdx = new Array(n).fill(0);
  (function rec(k, fixed){
    if (k === n) {
      let c = fixed;
      for (let t = 0; t < loads.length && c < best; t++) c += hourCost(units, pickIdx.map((j, i) => options[i][j].st[t]), loads[t], voll);
      if (c < best) best = c;
      return;
    }
    for (let j = 0; j < options[k].length; j++) { pickIdx[k] = j; rec(k + 1, fixed + options[k][j].c); }
  })(0, 0);
  return best;
}
let a3 = 0;
for (let seed = 101; seed <= 115; seed++) {
  const r = rng(seed), H = 5 + Math.floor(r() * 2), n = 3;
  const units = Array.from({ length: n }, () => {
    const pmax = Math.round(50 + r() * 150);
    return { pmax, pmin: Math.round(pmax * r() * 0.6), mc: Math.round(10 + r() * 90), su: Math.round(r() * 4000), sd: r() < 0.3 ? Math.round(r() * 800) : 0,
             sb: r() < 0.3 ? Math.round(r() * 200) : 0, up: Math.floor(r() * 4), down: Math.floor(r() * 4), init: r() < 0.5 ? 1 : 0 };
  });
  const loads = Array.from({ length: H }, () => Math.round(60 + r() * 260));
  const voll = 3000;
  // The same case as the tool sees it: one bus, a load with a custom profile per unit of its peak.
  const peak = Math.max(...loads), el = [{ c: 'Bus', id: 1, v_nom: 110, at: [10, 10, 20] }];
  units.forEach((u, i) => el.push({ c: 'Generator', id: 2 + i, bus: 1, p_nom: u.pmax, marginal_cost: u.mc, committable: 1, p_min_pu: u.pmin / u.pmax,
    start_up_cost: u.su, shut_down_cost: u.sd, stand_by_cost: u.sb, min_up_time: u.up, min_down_time: u.down, init: u.init }));
  const prof = Array.from({ length: 24 }, (_, h) => h < H ? loads[h] / peak : 0);
  el.push({ c: 'Load', id: 9, bus: 1, p_set: peak, prof });
  const model = ED.load({ v: 1, el });
  const want = bruteForce(units, loads, voll);
  const opts = { mode: 'uc', hours: H, voll, gap: 0.0001 };
  const res = await ED.solve(psa, model, opts);
  if (!res.report.ok){ check(`A3 seed ${seed} solves`, false, res.report.error); continue; }
  const got = res.totals.objective;
  // HiGHS proves its answer within 0.01% of the best; the enumeration finds the best exactly.
  // The solver's feasibility tolerance (1e-7) lets its cost dip a hair under the exact one.
  const okk = got >= want * (1 - 1e-6) - 1e-6 && got <= want * (1 + 1e-4) + 1e-6;
  if (okk) a3++;
  check(`A3 seed ${seed}: ${n} units, ${H} hours, the MILP finds the cheapest of every schedule`, okk, 'tool ' + got.toFixed(4) + ', enumerated ' + want.toFixed(4));
  const lin = await ED.solve(psa, model, { ...opts, mode: 'lin' }), ed = await ED.solve(psa, model, { ...opts, mode: 'ed' });
  check(`A3 seed ${seed}: the relaxation and economic dispatch are never dearer`, lin.report.ok && ed.report.ok &&
        lin.totals.cost <= got * (1 + 1e-6) + 1e-6 && ed.totals.cost <= got * (1 + 1e-6) + 1e-6,
        'relaxed ' + (lin.totals.cost || NaN).toFixed(2) + ', dispatch ' + (ed.totals.cost || NaN).toFixed(2));
}

/* ── A4: prices are marginal costs ── */
console.log('\n── A4 the prices are marginal costs ──');
for (const [key, mode] of [['uc3', 'ed'], ['uc3', 'uc'], ['solar', 'uc'], ['pjm5', 'ed']]) {
  const model = ED.load(ED.PRESETS[key].model), opts = { ...ED.PRESETS[key].opts, mode };
  // Under unit commitment, without ramp limits, so every hour's price is a merit-order one.
  if (mode === 'uc') model.el.forEach(e => { if (e.c === 'Generator'){ e.ramp_limit_up = 1; e.ramp_limit_down = 1; } });
  const res = await ED.solve(psa, model, opts);
  let worst = 0, n = 0;
  const gens = model.el.filter(e => e.c === 'Generator');
  for (let t = 0; t < res.T; t++) {
    gens.forEach(e => {
      const d = res.dev[e.id], price = res.bus[e.bus].price[t];
      const on = d.status ? d.status[t] > 0.5 : true;
      if (!on) return;
      const lo = (d.status ? e.p_min_pu : 0) * e.p_nom, hi = d.avail[t];
      if (!(hi > 1e-9)) return;   // nothing available: no price to set
      const ramp = e.ramp_limit_up < 1 || e.ramp_limit_down < 1;
      if (ramp && mode !== 'ed') return;   // a ramp-bound hour has a price of its own making
      if (d.p[t] > lo + 1e-4 && d.p[t] < hi - 1e-4 && !ramp) { worst = Math.max(worst, Math.abs(price - e.marginal_cost)); n++; }
      else if (d.p[t] >= hi - 1e-4 && !ramp) { worst = Math.max(worst, Math.max(0, e.marginal_cost - price)); n++; }
      else if (d.p[t] <= 1e-6 && !d.status) { worst = Math.max(worst, Math.max(0, price - e.marginal_cost)); n++; }
    });
  }
  check(`A4 ${key} ${mode}: a unit between its limits sets the price at its bus; flat out it is no dearer, idle no cheaper`, worst < 1e-6, n + ' unit-hours, worst ' + e1(worst) + ' $/MWh');
}

/* ── A5: the engine files ── */
console.log('\n── A5 the engine ──');
for (const [file, re] of [['psa-opt.min.js', /sha256 of the code below: ([0-9a-f]{64})/]]) {
  const text = readFileSync(join(TOOL, 'engine', file), 'utf8');
  const end = text.indexOf('*/\n') + 3, m = re.exec(text);
  const got = createHash('sha256').update(text.slice(end)).digest('hex');
  check(`A5 engine/${file} hashes to the sha256 in its banner`, !!m && m[1] === got, got.slice(0, 16));
}
{
  const banner = readFileSync(join(TOOL, 'engine', 'highs.mjs'), 'utf8').split('\n')[0];
  const m = /highs\.wasm sha256 ([0-9a-f]{64})/.exec(banner);
  const got = createHash('sha256').update(readFileSync(join(TOOL, 'engine', 'highs.wasm'))).digest('hex');
  check('A5 engine/highs.wasm hashes to the sha256 named in highs.mjs', !!m && m[1] === got, got.slice(0, 16));
}

/* ── A6: the calendar ── */
console.log('\n── A6 the calendar ──');
{
  // The weekday and the clock from JavaScript's own calendar, not the tool's.
  const wd = iso => (new Date(iso + ':00Z').getUTCDay() + 6) % 7;
  const P = ED.PROFILES;
  let worst = 0, n = 0;
  for (const start of ['2026-01-01T00:00', '2026-01-03T06:00', '2025-12-29T00:00', '2028-02-28T21:00']) {
    const ms0 = Date.parse(start + ':00Z');
    for (const key of Object.keys(P)) {
      const e = { p_set: 1, prof: key }, H = 200;
      const got = P[key].kind === 'load' ? ED.loadSeries(e, H, start) : ED.availSeries(e, H, start);
      for (let t = 0; t < H; t++) {
        const at = new Date(ms0 + t * 3600e3), h = at.getUTCHours();
        const midnight = Date.parse(start.slice(0, 10) + 'T00:00:00Z');
        const day = P[key].kind === 'load' ? wd(at.toISOString().slice(0, 16)) : Math.floor((ms0 + t * 3600e3 - midnight) / 864e5) % 7;
        let want = P[key].h[h] * P[key].d[day];
        if (P[key].kind === 'gen') want = Math.min(1, want);
        worst = Math.max(worst, Math.abs(got[t] - want)); n++;
      }
    }
  }
  check('A6 every built-in profile follows the clock from its start, demand by weekday and units by day of the horizon', worst < 1e-12, n + ' hours, worst ' + worst);
  const lab = [ED.hourLabel(0, 24, '2026-01-01T00:00'), ED.hourLabel(25, 48, '2026-01-31T23:00'), ED.hourLabel(719, 720, '2028-02-01T00:00'), ED.hourLabel(3, 24, 'not a date')];
  check('A6 hours are labelled as dates from the start', lab.join('|') === '01/01/2026 00:00|02/02/2026 00:00|01/03/2028 23:00|01/01/2026 03:00', lab.join(' | '));
  const o1 = ED.solveOptions({ hours: 99999, start: '2026-02-30T05:00' }), o2 = ED.solveOptions({ hours: 720, start: '2026-06-15T07:45' });
  check('A6 a horizon stops at 30 days, a start is a whole hour of a real date', o1.hours === 720 && o1.start === '2026-01-01T00:00' && o2.hours === 720 && o2.start === '2026-06-15T07:00', JSON.stringify([o1.hours, o1.start, o2.start]));
  // A run from before the start date began on a Monday at 00:00: no start reproduces it.
  const e = { p_set: 1, prof: 'com' };
  check('A6 a Monday start at 00:00 computes what the tool computed before it had a start date', JSON.stringify(ED.loadSeries(e, 168, '2025-12-29T00:00')) === JSON.stringify(ED.loadSeries(e, 168)), 'com, a week');
}

/* ── B: the page ── */
console.log('\n── B the page ──');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.txt': 'text/plain', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = normalize(join(ROOT, p));
  if (!f.startsWith(ROOT) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;
const URL_ = ORIGIN + '/ed-uc-simulator/';
const LIBS = join(ROOT, '_ref', '.libcache');
const browser = await pw.chromium.launch();
async function fresh(init) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await ctx.addInitScript(`try { localStorage.setItem('abt:ctrl:/ed-uc-simulator/', '1'); localStorage.setItem('educ-tour-v1-seen', '1'); } catch(e){}
    window.__workers = 0; (function(W){ window.Worker = function(u, o){ window.__workers++; return new W(u, o); }; window.Worker.prototype = W.prototype; })(window.Worker);
    ${init || ''}`);
  await ctx.route(/cdnjs\.cloudflare\.com/, r => {
    const f = join(LIBS, r.request().url().split('/').pop());
    if (existsSync(f)) return r.fulfill({ body: readFileSync(f), contentType: 'text/javascript' });
    return r.continue();
  });
  await ctx.route(/fonts\.googleapis|fonts\.gstatic|googletagmanager/, r => r.fulfill({ body: '', contentType: 'text/css' }));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  return { ctx, page, errs };
}
const solvedP = page => page.waitForFunction(() => window.__ed && window.__ed.app.res && window.__ed.app.res.report && !document.getElementById('runBtn').disabled, null, { timeout: 60000 });
{
  const { page, errs } = await fresh();
  const t0 = Date.now();
  await page.goto(URL_);
  await solvedP(page);
  const first = Date.now() - t0;
  check('B1 the first solve runs in the worker, with the solver fetched on demand', await page.evaluate(() => window.__workers) === 1, first + ' ms to the first result');
  for (const key of Object.keys(ED.PRESETS)) {
    await page.evaluate(k => window.__ed.applyPreset(k), key);
    await solvedP(page);
    await page.waitForTimeout(200);
    const got = await page.evaluate(() => {
      const a = window.__ed.app, r = a.res, F = window.ED.fmt, cur = document.getElementById('edCur').value;
      return { ok: r.report.ok, cost: document.getElementById('mCost').textContent, want: F.money(r.totals.cost, cur),
               price: document.getElementById('mPrice').textContent, wantP: F.price(r.totals.avgPrice, cur), T: r.T };
    });
    check(`B2 ${key}: the cost and average price cards say what the result says`, got.ok && got.cost === got.want && got.price === got.wantP, got.cost + ', ' + got.price);
    // The hours table, as its CSV: costs add up to the operating cost, demand to the energy.
    await page.click('#tableTabs .seg-btn[data-val="hour"]');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#csvBtn')]);
    const csv = readFileSync(await dl.path(), 'utf8').trim().split('\n').map(l => l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(s => s.replace(/^"|"$/g, '')));
    const num = s => parseFloat(String(s).replace(/[^0-9.\-]/g, ''));
    const head = csv[0], rows = csv.slice(1);
    const sumCost = rows.reduce((s, r) => s + num(r[head.indexOf('Cost')]), 0);
    const T = await page.evaluate(() => window.__ed.app.res.totals);
    check(`B3 ${key}: the hours CSV has every hour, and its costs add up to the operating cost`, rows.length === got.T && Math.abs(sumCost - T.cost) <= rows.length * 0.5 + 1e-6,
          rows.length + ' rows, ' + sumCost.toFixed(0) + ' vs ' + T.cost.toFixed(0));
  }
  check('B no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  // The Run gate
  const gate = await page.evaluate(async () => {
    const a = window.__ed.app, out = {};
    const g = a.model.el.filter(e => e.c === 'Generator')[0];
    const sig = document.getElementById('sldStage').getAttribute('data-share-sig');
    g.marginal_cost += 5; a.change('elec');
    out.stale = document.getElementById('runBtn').classList.contains('needs-run');
    a.undo();
    out.clean = !document.getElementById('runBtn').classList.contains('needs-run') && document.getElementById('sldStage').getAttribute('data-share-sig') === sig;
    const b = a.model.el.filter(e => e.c === 'Bus')[0]; b.at = [b.at[0] + 2, b.at[1], b.at[2], b.at[3]]; a.change('geom');
    out.move = !document.getElementById('runBtn').classList.contains('needs-run');
    const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
    set('edSpanUnit', 'd'); set('edSpan', '2');
    out.horizon = document.getElementById('runBtn').classList.contains('needs-run');
    await a.run();
    out.ran = !document.getElementById('runBtn').classList.contains('needs-run') && a.res.T === 48;
    set('edStart', '2026-03-07T06:00');
    out.start = document.getElementById('runBtn').classList.contains('needs-run');
    return out;
  });
  check('B4 the Run gate: an edit is stale, undo clears it, a move does not, a new horizon or start does, Run refreshes', gate.stale && gate.clean && gate.move && gate.horizon && gate.ran && gate.start, JSON.stringify(gate));
  // The SVG export is strict XML.
  const svg = await page.evaluate(() => window.__ed.app.exporter().then(X => X.svgText({ app: window.__ed.app, ED: window.ED, display: window.__ed.display(), res: window.__ed.app.res, stale: false, title: 'T', sub: 'S' })));
  const xmlOk = await page.evaluate(s => !new DOMParser().parseFromString(s, 'image/svg+xml').querySelector('parsererror'), svg);
  check('B5 the diagram’s SVG export is strict XML', xmlOk, (svg.length / 1024).toFixed(0) + ' KB');
  // A larger unit commitment: 12 buses, 20 units, a week.
  const big = await page.evaluate(async () => {
    const el = [], N = 12; let id = 1;
    for (let i = 0; i < N; i++) el.push({ c: 'Bus', id: id++, v_nom: 220, at: [10 + (i % 4) * 20, 10 + Math.floor(i / 4) * 20, 10] });
    for (let i = 1; i < N; i++) el.push({ c: 'Line', id: id++, bus0: i, bus1: i + 1 > N ? 1 : i + 1, x: 20 + i, s_nom: 150 + 10 * i });
    for (let k = 0; k < 20; k++) el.push({ c: 'Generator', id: id++, bus: 1 + (k % N), p_nom: 60 + 7 * k, marginal_cost: 15 + 4 * k, committable: k % 3 ? 1 : 0,
      p_min_pu: 0.3, start_up_cost: 500 + 100 * k, min_up_time: k % 4, min_down_time: k % 3 });
    for (let i = 0; i < N; i++) el.push({ c: 'Load', id: id++, bus: 1 + i, p_set: 80, prof: ['sys', 'res', 'com', 'ind'][i % 4] });
    const a = window.__ed.app;
    a.model = window.ED.load({ v: 1, el }); a.change('elec');
    document.getElementById('edSpanUnit').value = 'h';
    const h = document.getElementById('edSpan'); h.value = '168'; h.dispatchEvent(new Event('change', { bubbles: true }));
    const t0 = performance.now();
    await a.run();
    return { ok: a.res.report.ok, ms: performance.now() - t0, err: a.res.report.error };
  });
  check('B6 12 buses, 20 units over a week: the unit commitment solves in under 30 s', big.ok && big.ms < 30000, big.ok ? Math.round(big.ms) + ' ms' : big.err);
}
// Thirty days from a start date: every hour is solved, dated and listed.
{
  const { page, errs } = await fresh();
  await page.goto(URL_);
  await solvedP(page);
  const r = await page.evaluate(async () => {
    await window.__ed.applyPreset('uc3');
    const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
    set('edSpanUnit', 'd'); set('edSpan', '30'); set('edStart', '2026-07-01T00:00');
    const t0 = performance.now();
    await window.__ed.run();
    window.__ed.setHour(719);
    document.querySelector('#tableTabs [data-val="hour"]').click();
    const rows = document.querySelectorAll('#tableWrap tbody tr');
    return { ok: window.__ed.app.res.report.ok, T: window.__ed.app.res.T, ms: performance.now() - t0, out: document.getElementById('hourOut').textContent,
             first: rows[0] && rows[0].cells[0].textContent, last: rows[rows.length - 1] && rows[rows.length - 1].cells[0].textContent, n: rows.length,
             sub: document.getElementById('sldSub').textContent, maxDays: document.getElementById('edSpan').max };
  });
  check('B8 30 days from 01/07/2026: solved, every hour dated in the table, the diagram and its subtitle', r.ok && r.T === 720 && r.n === 720 && r.first === '01/07/2026 00:00' &&
    r.last === '30/07/2026 23:00' && r.out === '30/07/2026 23:00' && r.sub.includes('30/07/2026 23:00') && r.maxDays === '30' && !errs.length, JSON.stringify(r).slice(0, 220));
}
// A mini cache from before the horizon became a number and a unit keeps its horizon and its weekdays.
{
  const raw = JSON.stringify({ __fields: { 'v:edMode': 'ed', 'v:edHours': '72' }, __extra: ED.compact(ED.PRESETS.pjm5.model) });
  const { page, errs } = await fresh(`try { localStorage.setItem('abt:save:educ-simulator:v1', ${JSON.stringify(raw)}); } catch(e){}`);
  await page.goto(URL_);
  await solvedP(page);
  const r = await page.evaluate(() => ({ span: document.getElementById('edSpan').value, unit: document.getElementById('edSpanUnit').value,
    start: document.getElementById('edStart').value, T: window.__ed.app.res.T, o: window.__ed.solveOptions() }));
  check('B9 an old saved horizon (72 hours) opens as 3 days from a Monday, as it was solved before', r.span === '3' && r.unit === 'd' && r.start === '2025-12-29T00:00' && r.T === 72 && !errs.length, JSON.stringify(r).slice(0, 200));
}
// Hostile saved state, through the mini cache: nothing throws, nothing is injected, a run still happens.
{
  const states = {
    empty: '{}', nullish: 'null', text: 'not json', future: JSON.stringify({ __extra: { v: 99, el: [{ c: 'Bus', id: 1 }] } }),
    junk: JSON.stringify({ __fields: { 'v:edMode': 'quantum', 'v:edHours': '9999', 'v:edVoll': 'abc', 'c:edShed': 'x', 'v:edHour': '-5' },
      __extra: { v: 1, el: [{ c: 'Bus', id: 'x', v_nom: 'NaN' }, { c: 'Bus', id: 1, name: '<img src=x onerror=window.__pwned=1>' }, { c: 'Nope', id: 3 },
        { c: 'Generator', id: 4, bus: 1, p_nom: -50, marginal_cost: 'cheap', committable: 7, prof: [1, 2, 'a'] }, { c: 'Load', id: 5, bus: 1, p_set: 1e9, prof: 'toString' },
        { c: 'Line', id: 6, bus0: 1, bus1: 99 }, { c: 'Load', id: 4, bus: 1, p_set: 10, prof: new Array(24).fill(-3) }, { c: 'StorageUnit', id: 8, bus: 1, eff: 5, soc0: -1 }] } })
  };
  for (const [name, raw] of Object.entries(states)) {
    const { page, errs } = await fresh(`try { localStorage.setItem('abt:save:educ-simulator:v1', ${JSON.stringify(raw)}); } catch(e){}`);
    await page.goto(URL_);
    await solvedP(page).catch(() => {});
    const r = await page.evaluate(() => ({ pwned: !!window.__pwned, res: !!(window.__ed && window.__ed.app.res), imgs: document.querySelectorAll('#sldSvg img, #inspector img').length }));
    check(`B7 saved state "${name}": no error, nothing injected, the page still solves`, !errs.length && !r.pwned && r.res && !r.imgs, errs.slice(0, 2).join(' | '));
  }
}
await browser.close();
server.close();
console.log(`\nED/UC audit: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
