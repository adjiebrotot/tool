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
//   A3b A ramp limit never stops a unit starting or stopping: a ramp-limited
//       unit serves a load it can carry instead of shedding it.
//   A3c Unit commitment with cost curves is optimal: the same enumeration,
//       each hour filled piece by piece.
//   A4  The prices are marginal costs: a unit running strictly between its
//       limits on an uncongested system sets the price; one below it runs flat
//       out, one above it does not run. A cost curve's unit inside a piece sets
//       that piece's slope.
//   A5  The engine files are the ones their banners name (sha256).
//   A10 Held to PyPSA 1.4 itself: cost curves against its piecewise marginal
//       cost and its exact quadratic cost, minimum stable loading against its
//       p_min_pu (fixtures from pypsa-bench.py).
//   A11 Saved state from before: a v1 unit that is not committable keeps
//       computing what it did, and new keys that are missing or broken fall back.
//   B   The real page in headless Chromium: the solve runs in its worker; the
//       KPIs and the CSV tables say what the results say; the Run gate is
//       honest; hostile saved state never breaks it; the SVG export is strict
//       XML; and a larger unit commitment solves in a few seconds.

import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
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
/* A cost curve from its definition: the cost of an hour at P MW is
   a·P + q·P² + k·P³ (k only for a quadratic marginal cost), solved as pieces:
   CURVE_PIECES in all, equal from 0 to the minimum stable loading and on to
   the rating (that split in proportion, at least one each side), each at the
   chord of the curve. */
function curveDef(e) {
  const k = e.mcurve === 'quad' ? e.marginal_cost_cubic : 0, q = e.marginal_cost_quadratic;
  if (!((e.mcurve === 'lin' && q) || (e.mcurve === 'quad' && (q || k))) || !(e.p_nom > 0)) return null;
  const C = P => e.marginal_cost * P + q * P * P + k * P * P * P, N = ED.CURVE_PIECES, P = e.p_nom, pm = Math.min(1, Math.max(0, e.p_min_pu)) * P;
  const lo = pm > 0 && pm < P ? Math.min(N - 1, Math.max(1, Math.floor(N * pm / P + 0.5))) : 0, base = lo ? pm : 0, x = [0];
  for (let i = 1; i <= lo; i++) x.push(i === lo ? pm : pm * i / lo);
  for (let j = 1; j <= N - lo; j++) x.push(j === N - lo ? P : base + (P - base) * j / (N - lo));
  return { x, s: x.slice(1).map((v, i) => (C(v) - C(x[i])) / (v - x[i])) };
}
function energyDef(e, p) {
  const d = curveDef(e);
  if (!d) return e.marginal_cost * p;
  return d.s.reduce((c, s, i) => c + s * Math.min(Math.max(p - d.x[i], 0), d.x[i + 1] - d.x[i]), 0);
}
function replay(model, opts, res) {
  const o = ED.solveOptions(opts), H = o.hours, byId = ED.byId(model);
  const on = e => ED.onBus(model, e);
  const ok = e => byId[e.bus0] && byId[e.bus1] && byId[e.bus0].c === 'Bus' && byId[e.bus1].c === 'Bus' && e.bus0 !== e.bus1;
  const w = { balance: 0, flow: 0, limit: 0, gen: 0, ramp: 0, updown: 0, starts: 0, store: 0, link: 0, curve: 0, cost: 0, objective: 0 };
  const bump = (k, v) => { if (v > w[k]) w[k] = v; };
  const gens = model.el.filter(e => e.c === 'Generator' && on(e));
  const loads = model.el.filter(e => e.c === 'Load' && on(e));
  const stores = model.el.filter(e => e.c === 'StorageUnit' && on(e));
  const links = model.el.filter(e => e.c === 'Link' && ok(e));
  const passive = model.el.filter(e => (e.c === 'Line' || e.c === 'Transformer') && ok(e));
  let cost = 0, constant = 0;
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
  // Units: limits, commitment, ramps, start-ups, cost. Unit commitment commits the
  // committable units and keeps the rest on throughout; economic dispatch keeps every
  // unit on; the economic dispatch from zero holds no minimum.
  const commits = o.mode === 'uc' || o.mode === 'lin';
  gens.forEach(e => {
    const d = res.dev[e.id], av = ED.availSeries(e, H, o.start);
    const com = e.committable && commits, onThroughout = o.mode === 'edm' || (commits && !e.committable);
    const def = curveDef(e), pc = ED.costPieces(e);
    if (!def !== !pc || (def && (def.x.length !== pc.x.length || def.x.some((v, i) => Math.abs(v - pc.x[i]) > 1e-9 * e.p_nom) ||
        def.s.some((v, i) => Math.abs(v - pc.s[i]) > 1e-9 * Math.max(1, Math.abs(v)))))) bump('curve', 1);
    if (def) for (let i = 1; i < def.s.length; i++) bump('curve', Math.max(0, def.s[i - 1] - def.s[i] - 1e-9));   // fills in order: no binaries needed
    for (let t = 0; t < H; t++) {
      const s = com ? d.status[t] : 1;
      if (com && o.mode === 'uc') bump('gen', Math.min(Math.abs(s), Math.abs(s - 1)));
      if (com) bump('gen', Math.max(0, -s, s - 1));
      bump('gen', Math.max(0, d.p[t] - av[t] * e.p_nom * s - 1e-9));
      const floor = com ? e.p_min_pu * e.p_nom * s : onThroughout ? Math.min(e.p_min_pu, av[t]) * e.p_nom : 0;
      bump('gen', Math.max(0, floor - d.p[t] - 1e-9));
      cost += energyDef(e, d.p[t]);
      if (com) cost += e.start_up_cost * d.su[t] + e.shut_down_cost * d.sd[t] + e.stand_by_cost * s;
      // On in every hour of an economic dispatch, a committable unit pays its no-load cost, outside the objective.
      else if (o.mode === 'edm' && e.committable){ cost += e.stand_by_cost; constant += e.stand_by_cost; }
    }
    // Ramps hold between two hours it runs in (a start-up or shut-down hour is free).
    for (let t = 1; t < H; t++) {
      const both = !com || (d.status[t] > 0.999 && d.status[t - 1] > 0.999);
      if (!both || o.mode === 'lin') continue;
      if (e.ramp_limit_up < 1) bump('ramp', Math.max(0, d.p[t] - d.p[t - 1] - e.ramp_limit_up * e.p_nom - 1e-6));
      if (e.ramp_limit_down < 1) bump('ramp', Math.max(0, d.p[t - 1] - d.p[t] - e.ramp_limit_down * e.p_nom - 1e-6));
    }
    // A unit that starts reaches at most its minimum plus one hour's ramp up, and the
    // hour before it stops runs at most its minimum plus one hour's ramp down.
    if (com && o.mode === 'uc') for (let t = 0; t < H; t++) {
      const was = t ? d.status[t - 1] : (e.init ? 1 : 0);
      if (e.ramp_limit_up < 1 && d.status[t] > 0.5 && was < 0.5) bump('ramp', Math.max(0, d.p[t] - Math.min(1, e.p_min_pu + e.ramp_limit_up) * e.p_nom - 1e-6));
      if (e.ramp_limit_down < 1 && t && d.status[t] < 0.5 && was > 0.5) bump('ramp', Math.max(0, d.p[t - 1] - Math.min(1, e.p_min_pu + e.ramp_limit_down) * e.p_nom - 1e-6));
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
  bump('objective', Math.abs(res.totals.cost - constant - res.totals.objective) / Math.max(1, Math.abs(cost)));
  return w;
}
const TOL = { balance: 1e-5, flow: 1e-4, limit: 1e-7, gen: 1e-6, ramp: 1e-5, updown: 0, starts: 1e-6, store: 1e-7, link: 1e-5, curve: 0, cost: 1e-7, objective: 1e-7 };
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
for (const key of Object.keys(ED.PRESETS)) for (const mode of ['uc', 'lin', 'edm', 'ed']) cases.push({ name: key + ' ' + mode, model: ED.load(ED.PRESETS[key].model), opts: { ...ED.PRESETS[key].opts, mode } });
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
/* The same networks given cost curves, linear and quadratic, and minimum stable
   loading on units that are not committable, solved in every mode. A minimum
   that leaves an hour no dispatch (the checks say so) is dropped. */
function curveCase(seed) {
  const c = randomCase(seed), r = rng(seed * 7919), pick = a => a[Math.floor(r() * a.length)];
  const el = ED.compact(c.model).el;
  el.forEach(e => {
    if (e.c !== 'Generator') return;
    if (r() < 0.6) {
      const P = e.p_nom, rise = (0.1 + r() * 0.6) * Math.max(10, Math.abs(e.marginal_cost)), quad = r() < 0.5;
      e.mcurve = quad ? 'quad' : 'lin';
      e.marginal_cost_quadratic = (quad ? rise * 0.4 : rise) / P / 2;
      if (quad) e.marginal_cost_cubic = rise * (r() < 0.75 ? 0.6 : -0.15) / (P * P) / 3;
    }
    if (!e.committable && r() < 0.5) e.p_min_pu = Math.round(r() * 35) / 100;
  });
  const opts = { ...c.opts, mode: pick(['uc', 'lin', 'edm', 'edm', 'ed']) };
  let model = ED.load({ v: 2, el });
  if (ED.validate(model, opts).errors.length) { el.forEach(e => { if (e.c === 'Generator' && !e.committable) e.p_min_pu = 0; }); model = ED.load({ v: 2, el }); }
  if (ED.validate(model, opts).errors.length) opts.mode = 'uc';
  return { name: 'curves ' + seed + ' ' + opts.mode, model, opts };
}
for (let s = 31; s <= 50; s++) cases.push(curveCase(s));
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
let hourCost = function(units, on, load, voll) {
  let min = 0, cost = 0;
  const run = units.filter((u, i) => on[i]);
  run.forEach(u => { min += u.pmin; cost += u.mc * u.pmin; });
  if (min > load + 1e-9) return Infinity;
  let rest = load - min;
  run.slice().sort((a, b) => a.mc - b.mc).forEach(u => { const q = Math.min(rest, u.pmax - u.pmin); cost += q * u.mc; rest -= q; });
  return cost + rest * voll;
};
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

/* ── A3c: unit commitment with cost curves, against every schedule ──
   As A3, with each unit's cost curve: a unit that runs pays its pieces up to
   its minimum, and the rest of the load is filled from every running unit's
   pieces above it, cheapest first (a curve's pieces get dearer, so a unit's
   own fill in order). */
console.log('\n── A3c unit commitment with cost curves is optimal ──');
function curveHourCost(units, on, load, voll) {
  let min = 0, cost = 0;
  const blocks = [];
  units.forEach((u, i) => {
    if (!on[i]) return;
    min += u.pmin;
    u.d.s.forEach((s, k) => {
      const a = u.d.x[k], b = u.d.x[k + 1];
      if (b <= u.pmin + 1e-9) cost += s * (b - a);
      else { if (a < u.pmin) cost += s * (u.pmin - a); blocks.push({ s, w: b - Math.max(a, u.pmin) }); }
    });
  });
  if (min > load + 1e-9) return Infinity;
  let rest = load - min;
  blocks.sort((a, b) => a.s - b.s).forEach(bk => { const q = Math.min(rest, bk.w); cost += q * bk.s; rest -= q; });
  return cost + rest * voll;
}
for (let seed = 121; seed <= 130; seed++) {
  const r = rng(seed), H = 5, n = 3;
  const el = [{ c: 'Bus', id: 1, v_nom: 110, at: [10, 10, 20] }];
  const units = Array.from({ length: n }, (_, i) => {
    const pmax = Math.round(50 + r() * 150), pmin = Math.round(pmax * r() * 0.5), a = Math.round(10 + r() * 80), quad = r() < 0.5;
    const rise = (0.2 + r() * 0.8) * a;
    const g = { c: 'Generator', id: 2 + i, bus: 1, p_nom: pmax, marginal_cost: a, committable: 1, p_min_pu: pmin / pmax,
      mcurve: quad ? 'quad' : 'lin', marginal_cost_quadratic: (quad ? rise / 2 : rise) / pmax / 2, marginal_cost_cubic: quad ? rise / 2 / (pmax * pmax) / 3 : 0,
      start_up_cost: Math.round(r() * 3000), stand_by_cost: r() < 0.3 ? Math.round(r() * 200) : 0, min_up_time: Math.floor(r() * 3), min_down_time: Math.floor(r() * 3), init: r() < 0.5 ? 1 : 0 };
    el.push(g);
    return { pmax, pmin, d: curveDef(ED.load({ v: 2, el: [el[0], g] }).el[1]), su: g.start_up_cost, sd: 0, sb: g.stand_by_cost, up: g.min_up_time, down: g.min_down_time, init: g.init };
  });
  const loads = Array.from({ length: H }, () => Math.round(60 + r() * 260)), voll = 3000, peak = Math.max(...loads);
  el.push({ c: 'Load', id: 9, bus: 1, p_set: peak, prof: Array.from({ length: 24 }, (_, h) => h < H ? loads[h] / peak : 0) });
  const model = ED.load({ v: 2, el });
  // The enumeration of A3, with each hour filled piece by piece.
  const keep = hourCost;
  hourCost = curveHourCost;
  const want = bruteForce(units, loads, voll);
  hourCost = keep;
  const opts = { mode: 'uc', hours: H, voll, gap: 0.0001 };
  const res = await ED.solve(psa, model, opts);
  if (!res.report.ok){ check(`A3c seed ${seed} solves`, false, res.report.error); continue; }
  const got = res.totals.objective;
  check(`A3c seed ${seed}: ${n} units with cost curves, ${H} hours, the MILP finds the cheapest of every schedule`,
        got >= want * (1 - 1e-6) - 1e-6 && got <= want * (1 + 1e-4) + 1e-6, 'tool ' + got.toFixed(4) + ', enumerated ' + want.toFixed(4));
  const lin = await ED.solve(psa, model, { ...opts, mode: 'lin' }), ed = await ED.solve(psa, model, { ...opts, mode: 'ed' });
  check(`A3c seed ${seed}: the relaxation and the economic dispatch from zero are never dearer`, lin.report.ok && ed.report.ok &&
        lin.totals.cost <= got * (1 + 1e-6) + 1e-6 && ed.totals.cost <= got * (1 + 1e-6) + 1e-6,
        'relaxed ' + (lin.totals.cost || NaN).toFixed(2) + ', dispatch ' + (ed.totals.cost || NaN).toFixed(2));
}

/* ── A3b: a ramp limit never stops a unit starting or stopping ──
   PyPSA writes its ramp rows with the change in status, so with the start-up and
   shut-down ramps at the full rating a unit that ramps 31% an hour could only start at
   69% of its rating or more, and only stop from 52% or more: load was shed instead.
   One 217 MW unit, minimum 41%, ramps 48% up and 31% down, start-up cost 100 and
   10 per MWh: it must serve 100 MW in the middle two hours, and 100 MW from the first
   hour (off before) or until the third (running before), for 2,100 or 2,000. */
console.log('\n── A3b ramp limits and start-ups ──');
for (const [loads, init, want] of [[[0, 100, 100, 0], 0, 2100], [[100, 100, 100], 0, 3100], [[100, 100, 0, 0], 1, 2000], [[0, 217, 217, 0, 0], 0, null]]) {
  const peak = Math.max(...loads);
  const model = ED.load({ v: 1, el: [{ c: 'Bus', id: 1, v_nom: 110, at: [10, 10, 20] },
    { c: 'Generator', id: 2, bus: 1, p_nom: 217, marginal_cost: 10, committable: 1, p_min_pu: 0.41, start_up_cost: 100, min_up_time: 1, min_down_time: 1,
      ramp_limit_up: 0.48, ramp_limit_down: 0.31, init },
    { c: 'Load', id: 3, bus: 1, p_set: peak, prof: Array.from({ length: 24 }, (_, h) => h < loads.length ? loads[h] / peak : 0) }] });
  const res = await ED.solve(psa, model, { mode: 'uc', hours: loads.length, voll: 10000 });
  const p = res.report.ok ? res.dev[2].p : [];
  // Where the load needs more than one hour's ramp from the minimum, the unit starts as high as it may and sheds the rest.
  const capOk = want !== null || (Math.abs(p[1] - 0.89 * 217) < 1e-4 && Math.abs(p[2] - 0.72 * 217) < 1e-4);
  check(`A3b load ${loads.join('/')} MW, ${init ? 'running' : 'off'} before: ${want === null ? 'starts at its minimum plus a ramp, stops from its minimum plus a ramp down' : 'served, costs ' + want}`,
        res.report.ok && (want === null ? capOk : Math.abs(res.totals.cost - want) < 1e-6), res.report.ok ? 'cost ' + res.totals.cost.toFixed(2) + ', output ' + p.map(v => +v.toFixed(2)).join('/') : res.report.error);
}

/* ── A4: prices are marginal costs ── */
console.log('\n── A4 the prices are marginal costs ──');
const curved = JSON.parse(readFileSync(join(HERE, 'pypsa-cases.json'), 'utf8')).cases;
const presetOr = key => key.startsWith('pypsa:') ? curved[+key.slice(6)].model : ED.PRESETS[key].model;
for (const [key, mode] of [['uc3', 'ed'], ['uc3', 'uc'], ['solar', 'uc'], ['pjm5', 'ed'], ['pjm5', 'edm'], ['pypsa:0', 'edm'], ['pypsa:0', 'ed'], ['pypsa:0', 'uc'], ['pypsa:6', 'uc']]) {
  const model = ED.load(presetOr(key)), opts = { ...(ED.PRESETS[key] || { opts: { hours: 24 } }).opts, mode };
  // Under unit commitment and economic dispatch, without ramp limits, so every hour's price is a merit-order one.
  if (mode === 'uc' || mode === 'edm') model.el.forEach(e => { if (e.c === 'Generator'){ e.ramp_limit_up = 1; e.ramp_limit_down = 1; } });
  const res = await ED.solve(psa, model, opts);
  let worst = 0, n = 0;
  const gens = model.el.filter(e => e.c === 'Generator');
  for (let t = 0; t < res.T; t++) {
    gens.forEach(e => {
      const d = res.dev[e.id], price = res.bus[e.bus].price[t];
      const on = d.status ? d.status[t] > 0.5 : true;
      if (!on) return;
      const held = d.status || mode === 'edm' || ((mode === 'uc' || mode === 'lin') && !e.committable);
      const lo = (held ? Math.min(e.p_min_pu, d.avail[t] / e.p_nom) : 0) * e.p_nom, hi = d.avail[t];
      if (!(hi > 1e-9)) return;   // nothing available: no price to set
      const ramp = e.ramp_limit_up < 1 || e.ramp_limit_down < 1;
      if (ramp && mode !== 'ed') return;   // a ramp-bound hour has a price of its own making
      // A cost curve's unit: the slope of the piece it is in, its first piece's at zero, its last one's flat out.
      const def = curveDef(e), at = def ? def.x.findIndex((x, k) => k && d.p[t] < x - 1e-4) - 1 : -1;
      const inside = !def || (at >= 0 && d.p[t] > def.x[at] + 1e-4);
      const mcHere = def ? def.s[Math.max(0, at)] : e.marginal_cost, mcTop = def ? def.s[def.s.length - 1] : e.marginal_cost, mcLow = def ? def.s[0] : e.marginal_cost;
      if (d.p[t] > lo + 1e-4 && d.p[t] < hi - 1e-4 && !ramp) { if (inside) { worst = Math.max(worst, Math.abs(price - mcHere)); n++; } }
      else if (d.p[t] >= hi - 1e-4 && !ramp) { worst = Math.max(worst, Math.max(0, (def ? def.s[Math.max(0, def.x.findIndex(x => x >= hi - 1e-9) - 1)] : mcTop) - price)); n++; }
      else if (d.p[t] <= 1e-6 && !d.status) { worst = Math.max(worst, Math.max(0, price - mcLow)); n++; }
    });
  }
  check(`A4 ${key} ${mode}: a unit between its limits sets the price at its bus; flat out it is no dearer, idle no cheaper`, worst < 1e-6 && n > 0, n + ' unit-hours, worst ' + e1(worst) + ' $/MWh');
}

/* ── A10: held to PyPSA itself ──
   pypsa-cases.mjs writes networks in the tool's saved form with their hourly
   series; pypsa-bench.py builds each one in PyPSA 1.4 its own way and solves it:
   a cost curve as PyPSA's piecewise marginal_cost, the linear relaxation as the
   same pieces in plain components (PyPSA's piecewise turns it into a
   mixed-integer problem), and a linear marginal cost also as PyPSA's exact
   quadratic cost. The fixtures are checked in, so this needs no Python. */
console.log('\n── A10 held to PyPSA: cost curves and minimum stable loading ──');
{
  const C = JSON.parse(readFileSync(join(HERE, 'pypsa-cases.json'), 'utf8'));
  const Fx = JSON.parse(readFileSync(join(HERE, 'pypsa-fixtures.json'), 'utf8'));
  check('A10 the fixtures are PyPSA\'s answers to these very cases', Fx.cases.length === C.cases.length && Fx.pieces === ED.CURVE_PIECES &&
        C.cases.every((c, i) => Fx.cases[i].name === c.name), 'PyPSA ' + Fx.pypsa + ', ' + Fx.cases.length + ' cases');
  for (let i = 0; i < C.cases.length; i++) {
    const c = C.cases[i], f = Fx.cases[i], model = ED.load(c.model), o = c.opts, H = o.hours;
    // The series the cases carry are the tool's own, so the two sides solve the same hours.
    const sameSeries = model.el.every(e => e.c === 'Load' ? ED.loadSeries(e, H, o.start).every((v, t) => v === c.series[e.id][t]) :
      e.c === 'Generator' ? ED.availSeries(e, H, o.start).every((v, t) => v === c.series[e.id][t]) : true);
    const res = await ED.solve(psa, model, o);
    if (!res.report.ok) { check(`A10 ${c.name} solves`, false, res.report.error); continue; }
    const got = res.totals.objective, rel = (got - f.objective) / Math.abs(f.objective);
    const storage = model.el.some(e => e.c === 'StorageUnit');
    let dp = 0, dpr = 0;
    for (const [id, a] of Object.entries(f.p)) a.forEach((v, t) => { dp = Math.max(dp, Math.abs(v - res.dev[id].p[t])); });
    if (f.price) for (const [id, a] of Object.entries(f.price)) a.forEach((v, t) => { dpr = Math.max(dpr, Math.abs(v - res.bus[id].price[t])); });
    const mip = o.mode === 'uc' && !!f.status;
    if (c.cost === 'quadratic') {
      // The pieces lie on or above the exact cost, by at most q × w² / 4 a unit and hour on a
      // piece w MW wide; a price lands within half a piece's rise, q × w, of the exact one.
      let bound = 0, step = 0;
      model.el.filter(ED.hasCurve).forEach(e => {
        const x = ED.costPieces(e).x, w = Math.max(...x.slice(1).map((v, k) => v - x[k]));
        bound += e.marginal_cost_quadratic * w * w / 4 * H; step = Math.max(step, e.marginal_cost_quadratic * w);
      });
      check(`A10 ${c.name}: the pieces cost no less than PyPSA's exact quadratic optimum and no more than their chord error above it`,
            sameSeries && got >= f.objective * (1 - 1e-9) - 1e-6 && got - f.objective <= bound + 1e-6,
            'tool ' + got.toFixed(4) + ', PyPSA ' + f.objective.toFixed(4) + ' (+' + (100 * rel).toFixed(4) + '%, bound ' + bound.toFixed(2) + ')');
      check(`A10 ${c.name}: every nodal price within half a piece's rise of PyPSA's exact one`, dpr <= step + 1e-9, 'worst ' + dpr.toFixed(4) + ' of ' + step.toFixed(4) + ' $/MWh');
      continue;
    }
    check(`A10 ${c.name}: the objective is PyPSA's` + (mip ? ' within the 0.01% gap' : ''), sameSeries &&
          (mip ? rel >= -1e-7 && rel <= 1e-4 : Math.abs(rel) <= 1e-9), 'tool ' + got.toFixed(4) + ', PyPSA ' + f.objective.toFixed(4) + ' (' + e1(rel) + ')');
    // A linear problem's dispatch and prices are PyPSA's too, bar storage, whose hours can trade at no cost.
    if (!mip && !storage) check(`A10 ${c.name}: every unit's output in every hour is PyPSA's`, dp <= 1e-5, 'worst ' + e1(dp) + ' MW');
    if (!mip && f.price) check(`A10 ${c.name}: every nodal price in every hour is PyPSA's`, dpr <= 1e-6, 'worst ' + e1(dpr) + ' $/MWh');
  }
}

/* ── A11: saved state from before keeps its meaning ── */
console.log('\n── A11 saved state from before, and broken new keys ──');
{
  // v1 held a minimum only while committed: a unit that is not committable ran from zero.
  const v1 = { v: 1, el: [{ c: 'Bus', id: 1, v_nom: 110, at: [10, 10, 20] },
    { c: 'Generator', id: 2, bus: 1, p_nom: 100, marginal_cost: 50, p_min_pu: 0.4 },
    { c: 'Generator', id: 3, bus: 1, p_nom: 100, marginal_cost: 30, committable: 1, p_min_pu: 0.4, min_up_time: 1, min_down_time: 1 },
    { c: 'Load', id: 4, bus: 1, p_set: 160, prof: 'sys' }] };
  const before = JSON.stringify(v1), m1 = ED.load(v1), m2 = ED.load({ ...v1, v: 2 });
  const g = (m, id) => m.el.find(e => e.id === id);
  check('A11 a v1 unit that is not committable loses the minimum it never had; a committable one keeps its own; the object read is left as it was',
        g(m1, 2).p_min_pu === 0 && g(m1, 3).p_min_pu === 0.4 && g(m2, 2).p_min_pu === 0.4 && JSON.stringify(v1) === before && ED.compact(m1).v === 2 &&
        !('p_min_pu' in ED.compact(m1).el.find(e => e.id === 2)));
  const r1 = await ED.solve(psa, m1, { mode: 'uc', hours: 24 }), r2 = await ED.solve(psa, m2, { mode: 'uc', hours: 24 });
  check('A11 so the v1 unit still runs from zero, and the same unit saved as v2 never runs below its 40 MW',
        r1.report.ok && r2.report.ok && r1.dev[2].p.some(v => v < 40 - 1e-6) && r2.dev[2].p.every(v => v >= 40 - 1e-6),
        'v1 lowest ' + Math.min(...r1.dev[2].p).toFixed(2) + ' MW, v2 lowest ' + Math.min(...r2.dev[2].p).toFixed(2) + ' MW');
  // Missing, unknown and broken new keys fall back; nothing throws.
  const bad = ED.load({ v: 2, el: [{ c: 'Bus', id: 1, v_nom: 110, at: [0, 0, 10] },
    { c: 'Generator', id: 2, bus: 1, p_nom: 100, marginal_cost: 30, mcurve: 'cubic', marginal_cost_quadratic: -5, marginal_cost_cubic: 'x' },
    { c: 'Generator', id: 3, bus: 1, p_nom: 100, marginal_cost: 30, mcurve: 'LIN', marginal_cost_quadratic: 1e9 },
    { c: 'Generator', id: 4, bus: 1, p_nom: 100, marginal_cost: 30, mcurve: null }] }).el;
  check('A11 an unknown curve is a scalar, a negative slope kept, a word 0, a curve in capitals read, a huge slope held at its bound',
        bad[1].mcurve === '' && bad[1].marginal_cost_quadratic === -5 && bad[1].marginal_cost_cubic === 0 && bad[2].mcurve === 'lin' &&
        bad[2].marginal_cost_quadratic === 1e3 && bad[3].mcurve === '' && !ED.hasCurve(bad[1]), JSON.stringify(bad.slice(1).map(e => [e.mcurve, e.marginal_cost_quadratic, e.marginal_cost_cubic])));
  // The economic dispatch saved before 'edm' keeps its value and its meaning; an unknown mode is unit commitment.
  check('A11 the old economic dispatch keeps its value, the new one has its own, and an unknown mode is unit commitment',
        ED.solveOptions({ mode: 'ed' }).mode === 'ed' && ED.solveOptions({ mode: 'edm' }).mode === 'edm' && ED.solveOptions({ mode: 'xyz' }).mode === 'uc');
  const pj = ED.load(ED.PRESETS.pjm5.model), pe = await ED.solve(psa, pj, { mode: 'ed', hours: 24 }), pm = await ED.solve(psa, pj, { mode: 'edm', hours: 24 });
  check('A11 with no minimums anywhere, the two economic dispatches are the same problem (PJM 5-bus)', pe.report.ok && pm.report.ok && JSON.stringify(pe.raw) === JSON.stringify(pm.raw));
  // A flat curve is the scalar it equals: the same problem, bit for bit.
  const u3 = ED.load(ED.PRESETS.uc3.model), flat = ED.load(ED.compact(u3));
  flat.el.filter(e => e.c === 'Generator').forEach(e => { e.mcurve = 'quad'; });
  const ra = await ED.solve(psa, u3, { mode: 'uc', hours: 24 }), rb = await ED.solve(psa, flat, { mode: 'uc', hours: 24 });
  check('A11 a curve with no slope and no curvature solves as its scalar, bit for bit', JSON.stringify(ra.raw) === JSON.stringify(rb.raw));
  // A marginal cost that falls as the output rises cannot be solved in pieces without binaries: the checks stop it.
  const fall = ED.load(ED.compact(u3));
  Object.assign(fall.el.find(e => e.name === 'Coal'), { mcurve: 'quad', marginal_cost_quadratic: 0.01, marginal_cost_cubic: -0.0001 });
  const v = ED.validate(fall, { mode: 'uc', hours: 24 });
  check('A11 a marginal cost that falls is an error in the checks, naming the unit', v.errors.some(x => /Coal’s marginal cost falls/.test(x.msg)), v.errors.map(x => x.msg).join(' ').slice(0, 160));
  // Minimums that cannot all fit under the load stop the run, saying where.
  const over = ED.load(ED.compact(u3));
  over.el.filter(e => e.c === 'Generator').forEach(e => { e.p_min_pu = 0.6; });
  const vo = ED.validate(over, { mode: 'edm', hours: 24 }), vu = ED.validate(over, { mode: 'uc', hours: 24 });
  check('A11 economic dispatch with minimums above the night\'s load is an error in the checks; unit commitment can switch units off',
        vo.errors.some(x => /cannot go below/.test(x.msg)) && !vu.errors.length, vo.errors.map(x => x.msg).join(' ').slice(0, 200));
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
        const weekend = wd(at.toISOString().slice(0, 16)) >= 5;
        let want = (P[key].w && weekend ? P[key].w : P[key].h)[h] * (P[key].d ? P[key].d[day] : 1);
        if (P[key].kind === 'gen') want = Math.min(1, want);
        worst = Math.max(worst, Math.abs(got[t] - want)); n++;
      }
    }
  }
  check('A6 every built-in profile follows the clock from its start, demand by weekday with its own weekend day, and units by day of the horizon', worst < 1e-12, n + ' hours, worst ' + worst);
  const lab = [ED.hourLabel(0, 24, '2026-01-01T00:00'), ED.hourLabel(25, 48, '2026-01-31T23:00'), ED.hourLabel(719, 720, '2028-02-01T00:00'), ED.hourLabel(3, 24, 'not a date')];
  check('A6 hours are labelled as dates from the start', lab.join('|') === '01/01/2026 00:00|02/02/2026 00:00|01/03/2028 23:00|01/01/2026 03:00', lab.join(' | '));
  const o1 = ED.solveOptions({ hours: 99999, start: '2026-02-30T05:00' }), o2 = ED.solveOptions({ hours: 720, start: '2026-06-15T07:45' });
  check('A6 a horizon stops at 30 days, a start is a whole hour of a real date', o1.hours === 720 && o1.start === '2026-01-01T00:00' && o2.hours === 720 && o2.start === '2026-06-15T07:00', JSON.stringify([o1.hours, o1.start, o2.start]));
  // A run from before the start date began on a Monday at 00:00: no start reproduces it.
  const e = { p_set: 1, prof: 'com' };
  check('A6 a Monday start at 00:00 computes what the tool computed before it had a start date', JSON.stringify(ED.loadSeries(e, 168, '2025-12-29T00:00')) === JSON.stringify(ED.loadSeries(e, 168)), 'com, a week');
}

/* ── A7: daily variability and profiles from a file ── */
console.log('\n── A7 profiles: hourly × daily, and hours from a file ──');
await import(pathToFileURL(join(TOOL, 'ed-profiles.js')).href);
// SheetJS, the library the page loads for Excel files, cached beside the chart libraries.
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
const LIBDIR = join(ROOT, '_ref', '.libcache'), XLSX_FILE = join(LIBDIR, 'xlsx.full.min.js');
if (!existsSync(XLSX_FILE)) { mkdirSync(LIBDIR, { recursive: true }); writeFileSync(XLSX_FILE, await (await fetch(XLSX_URL)).text()); }
const XLSX = createRequire(import.meta.url)(XLSX_FILE);
const HOUR = 3600e3;
/* What a profile is worth in an hour, from its definition and JavaScript's own
   calendar: a file's value by its date and time; else the hourly value (its
   own 24, a built-in's, or 1; on Saturday and Sunday a built-in demand
   shape's weekend day, moved by as much as its own 24 were edited from the
   shape they started from) times the day's factor (daily variability by
   weekday, a built-in demand shape by weekday, a built-in unit by day of the
   horizon, or 1); a unit never above 1. */
function want(e, t, start) {
  const ms = Date.parse(start + ':00Z') + t * HOUR, at = new Date(ms);
  let v;
  if (e.ts && e.ts.v && e.ts.v.length) {
    const i = (ms - Date.parse(e.ts.at + ':00Z')) / HOUR;
    v = i >= 0 && i < e.ts.v.length ? e.ts.v[i] : 0;
  } else {
    const P = typeof e.prof === 'string' && e.prof ? ED.PROFILES[e.prof] : Array.isArray(e.prof) && e.pbase ? ED.PROFILES[e.pbase] : null, h = at.getUTCHours();
    const wd = (at.getUTCDay() + 6) % 7, dayN = Math.floor((ms - Date.parse(start.slice(0, 10) + 'T00:00:00Z')) / 864e5);
    const own = Array.isArray(e.prof) ? e.prof[h] : P ? P.h[h] : 1;
    const hv = P && P.w && wd >= 5 ? Math.max(0, P.w[h] + (own - P.h[h])) : own;
    const dv = Array.isArray(e.dprof) ? e.dprof[wd] : P && P.d ? P.d[P.kind === 'load' ? wd : dayN % 7] : 1;
    v = hv * dv;
  }
  return e.c === 'Generator' ? Math.min(1, v) : v;
}
const STARTS = ['2026-01-01T00:00', '2026-01-03T06:00', '2025-12-29T00:00', '2028-02-28T21:00', '2026-10-04T13:00'];
{
  // Every way a profile can be set, from every start, over 30 days, against the definition.
  const r = rng(77), rnd = n => Array.from({ length: n }, () => Math.round(r() * 120) / 100);
  const kinds = [];
  for (const c of ['Load', 'Generator']) {
    const shapes = ['', 'custom', ...Object.keys(ED.PROFILES).filter(k => ED.PROFILES[k].kind === (c === 'Load' ? 'load' : 'gen'))];
    for (const sh of shapes) for (const daily of [false, true]) kinds.push({ c, prof: sh === 'custom' ? rnd(24) : sh, dprof: daily ? rnd(7) : '' });
    // A built-in shape with its bars dragged: its own 24 hours, and the shape they started from.
    for (const sh of shapes.slice(2)) for (const daily of [false, true]) kinds.push({ c, prof: rnd(24), pbase: sh, dprof: daily ? rnd(7) : '' });
  }
  let worst = 0, n = 0, worstFile = 0;
  for (const start of STARTS) for (const k of kinds) {
    const e = ED.load({ v: 1, el: [{ c: 'Bus', id: 1 }, { ...k, id: 2, bus: 1, p_set: 1, p_nom: 1 }] }).el[1];
    const got = ED.series(e, 720, start, e.c === 'Generator' ? 1 : 0);
    for (let t = 0; t < 720; t++) { worst = Math.max(worst, Math.abs(got[t] - want(e, t, start))); n++; }
    // The same hours from a file that starts earlier: read by date and time.
    const f = { ...e, ts: { at: ED.isoOf(Date.parse(start + ':00Z') - 30 * HOUR), v: rnd(720) } };
    const g = ED.series(f, 690, start, f.c === 'Generator' ? 1 : 0);
    for (let t = 0; t < 690; t++) worstFile = Math.max(worstFile, Math.abs(g[t] - want(f, t, start)));
  }
  check('A7 every profile, built-in, edited, custom or flat, with and without daily variability, is hourly × daily by the calendar', worst === 0, n + ' hours from ' + STARTS.length + ' starts, worst ' + worst);
  check('A7 a profile from a file gives each hour the value its date and time has in the file', worstFile === 0, 'worst ' + worstFile);
  // The reader's own example: 80% at 14:00 on a 50% day is 40%.
  const ex = ED.load({ v: 1, el: [{ c: 'Bus', id: 1 }, { c: 'Generator', id: 2, bus: 1, p_nom: 200, prof: Array(24).fill(1).map((x, h) => h === 14 ? 0.8 : 1), dprof: [1, 1, 1, 0.5, 1, 1, 1] }] }).el[1];
  const thu14 = ED.availSeries(ex, 24, '2026-01-01T00:00')[14];  // 01/01/2026 is a Thursday
  check('A7 80% of the rating at 14:00 on a 50% Thursday is 40% (80 MW of 200)', Math.abs(thu14 - 0.4) < 1e-12 && Math.abs(thu14 * ex.p_nom - 80) < 1e-9, thu14 * ex.p_nom + ' MW');
  // Old networks: no daily variability, no file, exactly as before (the legacy formula, bit for bit).
  let legacy = 0;
  for (const start of STARTS) for (const k of kinds.filter(k => !k.dprof && !k.pbase)) {
    const e = { c: k.c, prof: k.prof, dprof: '', ts: null, p_set: 1 };
    const got = k.c === 'Load' ? ED.loadSeries(e, 200, start) : ED.availSeries(e, 200, start);
    for (let t = 0; t < 200; t++) if (got[t] !== (k.c === 'Load' ? 1 * ED.shapeAt(k.prof, t, 0, start) : ED.shapeAt(k.prof, t, 1, start))) legacy++;
  }
  // Weekend days are new in built-in demand shapes, so that holds for weekdays and every other shape.
  check('A7 a profile with no daily variability or file computes what it did before, bit for bit', legacy === 0, legacy + ' hours differ');
  // Turning daily variability on starts from the profile's own days: nothing moves.
  let jump = 0;
  for (const start of STARTS) for (const k of kinds.filter(k => !k.dprof)) {
    const e = { c: k.c, prof: k.prof, pbase: k.pbase || '', dprof: '', ts: null };
    const before = ED.series(e, 720, start), on = { ...e, dprof: ED.weekOf(e, start) }, after = ED.series(on, 720, start);
    for (let t = 0; t < 720; t++) jump = Math.max(jump, Math.abs(after[t] - before[t]));
  }
  check('A7 turning daily variability on keeps every hour where it was, for every shape, edited or not, and start, over 30 days', jump === 0, 'worst ' + jump);
  // Dragging a bar of a built-in shape keeps its week: untouched hours do not move on any day.
  let drift = 0;
  for (const start of STARTS) for (const key of Object.keys(ED.PROFILES)) {
    const c = ED.PROFILES[key].kind === 'load' ? 'Load' : 'Generator', a = { c, prof: key, pbase: '', dprof: '', ts: null };
    const b = { ...a, prof: ED.hourShape(a), pbase: key };
    const sa = ED.series(a, 720, start), sb = ED.series(b, 720, start);
    for (let t = 0; t < 720; t++) drift = Math.max(drift, Math.abs(sa[t] - sb[t]));
  }
  check('A7 a built-in shape taken as its 24 bars keeps every hour, weekends and weather days included, for every start', drift < 1e-12, 'worst ' + drift);
  // A demand shape's weekend is a day of its own, not a weekday scaled: offices barely peak.
  const com = ED.loadSeries({ p_set: 100, prof: 'com' }, 168, '2026-01-05T00:00');  // a Monday
  const PC = ED.PROFILES.com, fri11 = com[4 * 24 + 11], sat11 = com[5 * 24 + 11], sun03 = com[6 * 24 + 3];
  check('A7 a demand shape has a weekday and a weekend day: Commercial at 11:00 on Friday and Saturday, 03:00 on Sunday',
    Math.abs(fri11 - 100 * PC.h[11] * PC.d[4]) < 1e-9 && Math.abs(sat11 - 100 * PC.w[11] * PC.d[5]) < 1e-9 && Math.abs(sun03 - 100 * PC.w[3] * PC.d[6]) < 1e-9 && sat11 < 0.75 * fri11,
    [fri11, sat11, sun03].map(x => x.toFixed(1)).join(', ') + ' MW');
  check('A7 every built-in demand shape differs from day to day: no week is the same seven days', Object.values(ED.PROFILES).filter(p => p.kind === 'load').every(p => p.w && new Set(p.d).size >= 3),
    Object.keys(ED.PROFILES).filter(k => ED.PROFILES[k].kind === 'load').map(k => k + ' ' + ED.PROFILES[k].d.join('/')).join('; '));
}
{
  // Saved state: the new keys survive a round trip, old state takes the old defaults, junk never throws.
  const m = ED.load({ v: 1, el: [{ c: 'Bus', id: 1 }, { c: 'Load', id: 2, bus: 1, p_set: 10, prof: 'res', dprof: [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4] },
    { c: 'Generator', id: 3, bus: 1, p_nom: 10, ts: { at: '2026-01-01T00:00', v: [0.1, 0.2, 0.3] } }] });
  const back = ED.load(JSON.parse(JSON.stringify(ED.compact(m))));
  check('A7 daily variability and a file’s hours survive saving and reading back', JSON.stringify(ED.compact(back)) === JSON.stringify(ED.compact(m)) &&
    back.el[1].dprof[6] === 0.4 && back.el[2].ts.v[2] === 0.3 && back.el[2].ts.at === '2026-01-01T00:00');
  const old = ED.compact(ED.load(ED.PRESETS.areas.model));
  check('A7 a network saved before them writes neither key and reads them as off', !JSON.stringify(old).includes('dprof') && !JSON.stringify(old).includes('"ts"') &&
    ED.load(old).el.filter(e => e.c === 'Load' || e.c === 'Generator').every(e => e.dprof === '' && e.ts === null));
  const junk = [{ dprof: [1, 2] }, { dprof: 'x' }, { dprof: [1, 1, 1, 1, 1, 1, 'a'] }, { dprof: [-1, 9, 1, 1, 1, 1, 1] }, { ts: 'x' }, { ts: { at: 'soon', v: [1] } },
    { ts: { at: '2026-02-30T00:00', v: [1] } }, { ts: { at: '2026-01-01T00:00', v: [] } }, { ts: { at: '2026-01-01T00:00', v: ['a', -5, 1e9, null] } },
    { ts: { at: '2026-01-01T00:00', v: new Array(5000).fill(0.5) } }, { ts: [1, 2, 3] }, { ts: { at: '2026-01-01T05:30', v: [1] } },
    { pbase: 'toString', prof: Array(24).fill(1) }, { pbase: 7 }, { pbase: 'nope', prof: 'res' }];
  let threw = 0, wrong = [];
  for (const j of junk) {
    try {
      const e = ED.load({ v: 1, el: [{ c: 'Bus', id: 1 }, { c: 'Generator', id: 2, bus: 1, p_nom: 5, ...j }] }).el[1];
      const okD = (e.pbase === '' || Object.hasOwn(ED.PROFILES, e.pbase)) && (e.dprof === '' || (Array.isArray(e.dprof) && e.dprof.length === 7 && e.dprof.every(x => x >= 0 && x <= 2)));
      const okT = e.ts === null || (typeof e.ts.at === 'string' && /T\d\d:00$/.test(e.ts.at) && e.ts.v.length >= 1 && e.ts.v.length <= ED.MAX_HOURS && e.ts.v.every(x => x >= 0 && x <= 100));
      ED.series(e, 48, '2026-01-01T00:00', 1); ED.validate({ el: [{ c: 'Bus', id: 1, at: [0, 0, 8, 0] }, e] }, { hours: 48 });
      if (!okD || !okT) wrong.push(JSON.stringify(j).slice(0, 40));
    } catch (err) { threw++; wrong.push(err.message); }
  }
  check('A7 broken daily factors, file hours or edited-from shapes in saved state never throw, and read as something valid', !threw && !wrong.length, wrong.slice(0, 3).join(' | '));
  // A file that stops short of the horizon stops the run, naming the element and both spans.
  const v = ED.validate(m, { hours: 48, start: '2026-01-01T00:00' });
  const err = v.errors.find(x => x.id === 3);
  check('A7 a file that does not cover the horizon is an error that names its span and the horizon’s', !!err && /01\/01\/2026 00:00 to 01\/01\/2026 02:00/.test(err.msg) && /02\/01\/2026 23:00/.test(err.msg), err && err.msg);
}

/* ── A8: reading a file of profiles ── */
console.log('\n── A8 profiles from a file: matched by date and time ──');
const csvOf = rows => rows.map(r => r.map(c => /[,"\n]/.test(String(c)) ? '"' + String(c).replace(/"/g, '""') + '"' : c).join(',')).join('\n');
const isoAt = ms => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
function solarNet() { return ED.load(ED.PRESETS.solar.model); }
const byNm = (m, n) => m.el.find(e => ED.nameOf(e) === n);
{
  const m = solarNet(), H = 72, start = '2026-03-06T00:00', s0 = Date.parse(start + ':00Z');
  const tpl = ED.profileTemplate(m, H, start);
  const csv = ED.templateCsv(tpl);
  const lines = csv.trim().split('\r\n');
  check('A8 the template has a row for each hour of the horizon from the first hour, and a column per load and generator',
    lines.length === H + 1 && lines[1].startsWith('2026-03-06 00:00,') && lines[H].startsWith('2026-03-08 23:00,') &&
    lines[0] === 'Date and time,Solar farm [p.u.],Gas turbine [p.u.],Peaker [p.u.],Homes [p.u.],Shops and offices [p.u.]', lines[0]);
  const same = ED.readProfiles(ED.csvRows(csv), m, { H, start });
  const sameOk = !same.errors.length && same.changes.length === 5 && same.changes.every(c => { const e = m.el.find(x => x.id === c.id), now = ED.series(e, H, start, e.c === 'Generator' ? 1 : 0);
    return c.ts.at === start && c.p_set === undefined && c.ts.v.every((v, t) => Math.abs(v - now[t]) < 6e-5); });
  check('A8 the template opened as it is makes every load and generator Custom, with the hours it had', sameOk, same.errors.join(' ') || same.notes[0]);
  // Blank cells take the hour from the element's shape; a column left out or left empty leaves its element alone.
  {
    const sf = byNm(m, 'Solar farm'), hm = byNm(m, 'Homes'), sh = byNm(m, 'Shops and offices');
    const shapeSf = ED.series(sf, H, start, 1), shapeHm = ED.series(hm, H, start);
    const r = [['Date and time', 'Solar farm [p.u.]', 'Homes [MW]', 'Shops and offices']];
    for (let t = 0; t < H; t++) r.push([isoAt(s0 + t * HOUR), t % 5 === 0 ? '' : t === 7 ? '0' : '0.4', t < 10 ? '' : String(100 + t), '']);
    const o = ED.readProfiles(ED.csvRows(csvOf(r)), m, { H, start });
    const g = id => o.changes.find(c => c.id === id);
    const cs = g(sf.id), ch = g(hm.id), peak = 100 + H - 1;
    const ok = !o.errors.length && o.changes.length === 2 && !g(sh.id) && cs && ch && ch.p_set === peak &&
      cs.ts.v.every((v, t) => Math.abs(v - (t % 5 === 0 ? shapeSf[t] : t === 7 ? 0 : 0.4)) < 1e-6) &&
      ch.ts.v.every((v, t) => Math.abs(v * peak - (t < 10 ? shapeHm[t] * hm.p_set : 100 + t)) < 1e-3) &&
      o.notes.some(n => /Solar farm takes its hours from the file, per unit\. 15 blank hours follow its shape/.test(n)) && o.notes.some(n => /Shops and offices kept its profile/.test(n));
    check('A8 blank cells follow the element’s shape (0 is a value), in the MW it gave; an empty column leaves its element alone', ok, o.errors.join(' ') || o.notes.join(' ').slice(0, 200));
  }
  // Homes halved on the Saturday; rows shuffled, a year of hours around them.
  const homes = byNm(m, 'Homes'), want0 = ED.series(homes, H, start);
  const rows = [['Timestamp', 'Homes [p.u.]', 'Something else']];
  for (let t = -24 * 40; t < H + 24 * 300; t++) {
    const ms = s0 + t * HOUR, inH = t >= 0 && t < H;
    rows.push([isoAt(ms), inH ? (t >= 24 && t < 48 ? want0[t] * 0.5 : want0[t]).toFixed(5) : (t % 7 ? '0.5' : ''), 'x']);
  }
  const shuffled = [rows[0], ...rows.slice(1).sort(() => rng(5)() - 0.5)];
  for (let i = shuffled.length - 1; i > 1; i--) { const j = 1 + Math.floor(rng(i)() * i); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
  const out = ED.readProfiles(ED.csvRows(csvOf(shuffled)), m, { H, start });
  const ch = out.changes[0];
  let worst = 0;
  if (ch) for (let t = 0; t < H; t++) worst = Math.max(worst, Math.abs(ch.ts.v[t] - +(t >= 24 && t < 48 ? want0[t] * 0.5 : want0[t]).toFixed(5)));
  check('A8 a year of shuffled rows: the horizon’s hours are found by date and time, the rest left out, unknown columns named',
    !out.errors.length && out.changes.length === 1 && ch.id === homes.id && ch.ts.at === start && ch.ts.v.length === H && worst < 1e-9 &&
    out.used.outside === rows.length - 1 - H && out.notes.some(n => /Something else/.test(n)), out.errors.join(' ') || ('worst ' + worst + ', ' + out.used.outside + ' outside'));
  // Too little: short at the start, short at the end, a missing hour, a repeated hour, half-hourly, no dates.
  const mk = (fn, head = ['Date and time', 'Homes']) => { const r = [head]; fn(r); return ED.csvRows(csvOf(r)); };
  const span = (a, b) => r => { for (let t = a; t < b; t++) r.push([isoAt(s0 + t * HOUR), '0.5']); };
  const cases = {
    'short at the start': [mk(span(3, H + 10)), /3 hours short at the start/],
    'short at the end': [mk(span(-5, H - 1)), /1 hour short at the end/],
    'short at both ends': [mk(span(2, H - 2)), /2 hours short at the start and 2 hours short at the end/],
    'a missing hour': [mk(r => { for (let t = 0; t < H; t++) if (t !== 30) r.push([isoAt(s0 + t * HOUR), '0.5']); }), /no row for 07\/03\/2026 06:00/],
    'a repeated hour (a clock change)': [mk(r => { span(0, H)(r); r.push([isoAt(s0 + 5 * HOUR), '0.4']); }), /both 06\/03\/2026 05:00/],
    'half-hourly rows': [mk(r => { for (let t = 0; t < 2 * H; t++) r.push([isoAt(s0 + t * HOUR / 2), '0.5']); }), /30 minutes apart/],
    'no dates': [mk(r => { for (let t = 0; t < H; t++) r.push([String(t), '0.5']); }, ['Hour', 'Homes']), /No column of dates and times/],
    'a word among the values': [mk(r => { span(0, H)(r); r[10][1] = 'n/a'; }), /“n\/a” is not a number at 06\/03\/2026 09:00 \(row 11\)/],
    'a date that is not one': [mk(r => { span(0, H)(r); r[4][0] = '2026-02-30 03:00'; }), /not a date and time/],
    'no column for anything here': [mk(span(0, H), ['Date', 'Nobody']), /No column is named after a load or a generator/]
  };
  for (const [name, [table, re]] of Object.entries(cases)) {
    const o = ED.readProfiles(table, m, { H, start });
    check(`A8 turned away, saying why: ${name}`, o.errors.length > 0 && !o.changes.length && re.test(o.errors.join(' ')), o.errors.join(' ').slice(0, 160));
  }
  // One bad column stops the whole file: nothing half applied.
  const two = [['Date and time', 'Homes', 'Solar farm']];
  for (let t = 0; t < H; t++) two.push([isoAt(s0 + t * HOUR), '0.5', t === 9 ? 'oops' : '0.3']);
  const o2 = ED.readProfiles(ED.csvRows(csvOf(two)), m, { H, start });
  check('A8 one bad column turns the whole file away, so nothing is half applied', o2.errors.length === 1 && o2.changes.length === 0, o2.errors[0]);
}
{
  // The ways spreadsheets write dates, numbers and files.
  const m = solarNet(), H = 48, start = '2026-01-01T00:00', s0 = Date.parse(start + ':00Z'), homes = byNm(m, 'Homes');
  const two = n => String(n).padStart(2, '0'), MON = ['Jan', 'Feb'];
  const fmts = {
    'ISO with T and seconds': d => `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())}T${two(d.getUTCHours())}:00:00`,
    'day first, as Excel writes it in Australia': d => `${d.getUTCDate()}/${two(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${d.getUTCHours()}:00`,
    'month first with AM and PM, as in the US': d => `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()} ${(d.getUTCHours() % 12) || 12}:00 ${d.getUTCHours() < 12 ? 'AM' : 'PM'}`,
    'a month by name': d => `${d.getUTCDate()}-${MON[d.getUTCMonth()]}-${d.getUTCFullYear()} ${two(d.getUTCHours())}:00`,
    'slashes and a two-digit year': d => `${two(d.getUTCDate())}/${two(d.getUTCMonth() + 1)}/${String(d.getUTCFullYear()).slice(2)} ${two(d.getUTCHours())}:00`
  };
  for (const [name, f] of Object.entries(fmts)) {
    const r = [['Date', 'Homes']];
    for (let t = 0; t < H; t++) r.push([f(new Date(s0 + t * HOUR)), String((t % 24) / 24)]);
    const o = ED.readProfiles(ED.csvRows(csvOf(r)), m, { H, start });
    const ok = !o.errors.length && o.changes[0] && o.changes[0].ts.v.every((v, t) => Math.abs(v - (t % 24) / 24) < 1e-5);
    check(`A8 dates written ${name} land on their hours`, ok, o.errors.join(' ') || (r[2][0] + ' …'));
  }
  // Semicolons and decimal commas, tabs, quotes, a byte order mark, Windows line ends; % and MW columns.
  const body = (sep, dec) => ['﻿"Date and time"' + sep + '"Homes [%]"' + sep + '"Solar farm (MW)"' + sep + '"Shops and offices"']
    .concat(Array.from({ length: H }, (_, t) => isoAt(s0 + t * HOUR) + sep + String(40 + t % 10).replace('.', dec) + sep + String(t % 24 === 12 ? 500.5 : 210.25).replace('.', dec) + sep + (t === 3 ? '"1' + dec + '5"' : '-0' + dec + '25'))).join('\r\n');
  for (const [name, sep, dec] of [['commas', ',', '.'], ['semicolons with decimal commas', ';', ','], ['tabs', '\t', '.']]) {
    const o = ED.readProfiles(ED.csvRows(body(sep, dec)), m, { H, start });
    const g = id => (o.changes.find(c => c.id === id) || {}).ts;
    const h = g(homes.id), sf = g(byNm(m, 'Solar farm').id), sh = g(byNm(m, 'Shops and offices').id);
    const ok = !o.errors.length && h && sf && sh && Math.abs(h.v[5] - 0.45) < 1e-9 && Math.abs(sf.v[0] - 210.25 / 420) < 1e-5 && Math.abs(sf.v[12] - 500.5 / 420) < 1e-5 &&
      sh.v[0] === 0 && Math.abs(sh.v[3] - 1.5) < 1e-9 && o.notes.some(n => /Shops and offices takes its hours from the file, per unit\. 47 negative values were read as 0/.test(n)) && o.notes.some(n => /Solar farm takes its hours from the file, in MW\. 2 hours above its rating are held at it/.test(n));
    check(`A8 a CSV with ${name}: % and MW headers read, negatives read as 0, above the rating held at it`, ok, o.errors.join(' ') || o.notes.join(' ').slice(0, 200));
  }
  // A load in MW: its peak demand becomes the file's highest hour, and every hour keeps its MW.
  const r = [['Date and time', 'Homes [MW]']];
  for (let t = 0; t < H; t++) r.push([isoAt(s0 + t * HOUR), String(100 + 3.7 * t)]);
  const o = ED.readProfiles(ED.csvRows(csvOf(r)), m, { H, start }), c = o.changes[0];
  const mw = c && c.ts.v.map(v => v * c.p_set);
  check('A8 a load in MW: its peak demand becomes the file’s highest hour and every hour keeps its MW', !!c && c.p_set === 100 + 3.7 * 47 && mw.every((v, t) => Math.abs(v - (100 + 3.7 * t)) < 0.01), c && c.p_set + ' MW');
  // A tab-separated file from an English spreadsheet groups thousands with commas: 1,234.5 is
  // a thousand and more, never 1.2345. With both marks, the last one is the decimal.
  for (const [name, sep, txt] of [['tabs and thousands separators', '\t', v => v.toLocaleString('en-US', { minimumFractionDigits: 1 })],
                                  ['semicolons, thousands points and decimal commas', ';', v => v.toLocaleString('de-DE', { minimumFractionDigits: 1 })]]) {
    const rows = ['Date and time' + sep + 'Homes [MW]'].concat(Array.from({ length: H }, (_, t) => isoAt(s0 + t * HOUR) + sep + txt(1000 + 12.5 * t)));
    const ot = ED.readProfiles(ED.csvRows(rows.join('\n')), m, { H, start }), ct = ot.changes[0];
    check(`A8 a file with ${name} reads ${txt(1234.5)} as 1234.5`, !!ct && Math.abs(ct.p_set - (1000 + 12.5 * (H - 1))) < 1e-9 && ct.ts.v.every((v, t) => Math.abs(v * ct.p_set - (1000 + 12.5 * t)) < 0.01),
          ot.errors.join(' ') || (ct && ct.p_set + ' MW'));
  }
  // One element: a file with one column of values, whatever its header, is that element's.
  const one = [['When', 'Value']];
  for (let t = 0; t < H; t++) one.push([isoAt(s0 + t * HOUR), '0.7']);
  const o1 = ED.readProfiles(ED.csvRows(csvOf(one)), m, { H, start, only: homes.id });
  const bare = ED.readProfiles(ED.csvRows(one.slice(1).map(r => r.join(',')).join('\n')), m, { H, start, only: homes.id });
  check('A8 for one element, a file with no header row at all is read from its first row', !bare.errors.length && bare.changes.length === 1 && bare.changes[0].ts.v.length === H, bare.errors.join(' '));
  check('A8 for one element, a file with one column of values is its, whatever the header says', !o1.errors.length && o1.changes.length === 1 && o1.changes[0].id === homes.id && o1.changes[0].ts.v.every(v => v === 0.7));
  // Two elements with one name: the template tells them apart by id.
  const dup = ED.load({ v: 1, el: [{ c: 'Bus', id: 1 }, { c: 'Load', id: 2, bus: 1, name: 'Town', p_set: 10 }, { c: 'Load', id: 3, bus: 1, name: 'Town', p_set: 20 }] });
  const tp = ED.profileTemplate(dup, 24, start);
  tp.rows.forEach(rw => { rw[2] = 0.25; });
  const od = ED.readProfiles(ED.csvRows(ED.templateCsv(tp)), dup, { H: 24, start });
  const odOf = id => od.changes.find(c => c.id === id);
  check('A8 two loads with one name: the template heads them by id, and each takes its own column', tp.head.join('|') === 'Date and time|Town #2 [p.u.]|Town #3 [p.u.]' &&
    !od.errors.length && od.changes.length === 2 && odOf(3).ts.v.every(v => v === 0.25) && odOf(2).ts.v.every((v, t) => Math.abs(v - +tp.rows[t][1]) < 1e-9), tp.head.join(' | '));
}
{
  // Excel: the template as a workbook, read back; a 1904 workbook; dates typed as text.
  const m = solarNet(), H = 168, start = '2026-07-01T05:00';
  const tpl = ED.profileTemplate(m, H, start);
  const buf = ED.templateBook(XLSX, tpl);
  const wb = XLSX.read(buf, { type: 'array', cellNF: true });
  const ws = wb.Sheets.Profiles, a2 = ws.A2;
  check('A8 the Excel template holds real dates (a date cell, not text) and a Read me sheet', a2 && a2.t === 'n' && XLSX.SSF.is_date(a2.z) && wb.SheetNames.join() === 'Profiles,Read me', a2 && (a2.t + ' ' + a2.z));
  const t1 = ED.sheetRows(XLSX, new Uint8Array(buf));
  check('A8 its dates read back exactly, from the serial number, with no time zone', t1.rows[1][0] === '2026-07-01 05:00:00' && t1.rows[H][0] === '2026-07-08 04:00:00', t1.rows[1][0] + ' … ' + t1.rows[H][0]);
  const same = ED.readProfiles(t1, m, { H, start });
  check('A8 the Excel template opened as it is gives every column the hours it had', !same.errors.length && same.changes.length === tpl.els.length &&
    same.changes.every(c => { const e = m.el.find(x => x.id === c.id), now = ED.series(e, H, start, e.c === 'Generator' ? 1 : 0); return c.ts.v.every((v, t) => Math.abs(v - now[t]) < 6e-5); }), same.errors.join(' '));
  // Solar farm halved in the workbook, in place.
  for (let i = 1; i <= H; i++) { const ref = 'B' + (i + 1); ws[ref].v = ws[ref].v / 2; }
  const ed = ED.readProfiles(ED.sheetRows(XLSX, new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }))), m, { H, start });
  const sf = byNm(m, 'Solar farm'), base = ED.series(sf, H, start, 1);
  const edSf = ed.changes.find(c => c.id === sf.id);
  check('A8 an edited Excel workbook takes the column that was edited, hour for hour', !ed.errors.length && ed.changes.length === tpl.els.length && !!edSf &&
    edSf.ts.v.every((v, t) => Math.abs(v - Math.round(base[t] * 1e4) / 2e4) < 1e-5), ed.errors.join(' '));
  // A workbook on the 1904 date system, and one whose dates are text.
  const aoa = [['Date and time', 'Homes']];
  for (let t = 0; t < H; t++) aoa.push([ED.msSerial(Date.parse(start + ':00Z') + t * HOUR) - 1462, 0.6]);
  const w4 = XLSX.utils.book_new(), s4 = XLSX.utils.aoa_to_sheet(aoa);
  for (let t = 0; t < H; t++) s4['A' + (t + 2)].z = 'dd/mm/yyyy hh:mm';
  XLSX.utils.book_append_sheet(w4, s4, 'Data'); w4.Workbook = { WBProps: { date1904: true } };
  const o4 = ED.readProfiles(ED.sheetRows(XLSX, new Uint8Array(XLSX.write(w4, { type: 'array', bookType: 'xlsx' }))), m, { H, start });
  check('A8 a workbook on the 1904 date system lands on the same hours', !o4.errors.length && o4.changes.length === 1 && o4.changes[0].ts.v.every(v => v === 0.6), o4.errors.join(' '));
  const aoaT = [['Date and time', 'Homes']];
  for (let t = 0; t < H; t++) aoaT.push([isoAt(Date.parse(start + ':00Z') + t * HOUR), '0.55']);
  const wt = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wt, XLSX.utils.aoa_to_sheet(aoaT), 'Sheet1');
  const ot = ED.readProfiles(ED.sheetRows(XLSX, new Uint8Array(XLSX.write(wt, { type: 'array', bookType: 'xls' }))), m, { H, start });
  check('A8 an old .xls workbook with its dates typed as text is read too', !ot.errors.length && ot.changes.length === 1 && ot.changes[0].ts.v.every(v => v === 0.55), ot.errors.join(' '));
}
console.log('\n── A7 solved with daily variability and files ──');
{
  // Solved: daily variability and a file change the dispatch exactly as they say, and the replay holds.
  const one = (prof, dprof) => ED.load({ v: 1, el: [{ c: 'Bus', id: 1, at: [0, 0, 8] },
    { c: 'Generator', id: 2, name: 'Sun', bus: 1, p_nom: 200, marginal_cost: 0, prof, dprof },
    { c: 'Generator', id: 3, name: 'Gas', bus: 1, p_nom: 500, marginal_cost: 50 },
    { c: 'Load', id: 4, bus: 1, p_set: 300 }] });
  const ex = one(Array.from({ length: 24 }, (_, h) => h === 14 ? 0.8 : 1), [1, 1, 1, 0.5, 1, 1, 1]);
  const rs = await ED.solve(psa, ex, { mode: 'ed', hours: 48, start: '2026-01-01T00:00' });
  check('A7 solved: the sun gives 80 MW at 14:00 on its 50% Thursday and 160 MW at 14:00 on Friday, gas the rest',
    rs.report.ok && Math.abs(rs.dev[2].p[14] - 80) < 1e-6 && Math.abs(rs.dev[3].p[14] - 220) < 1e-6 && Math.abs(rs.dev[2].p[38] - 160) < 1e-6 && Math.abs(rs.dev[2].p[13] - 100) < 1e-6,
    rs.report.ok ? [rs.dev[2].p[13], rs.dev[2].p[14], rs.dev[2].p[38]].map(x => x.toFixed(2)).join(', ') + ' MW' : rs.report.error);
  // Daily variability turned on from every Quick Start's own days: the very same result.
  let diff = [];
  for (const key of Object.keys(ED.PRESETS)) {
    const p = ED.PRESETS[key], a = ED.load(p.model), b = ED.load(p.model), o = { ...p.opts, hours: 72, start: '2026-05-14T09:00' };
    b.el.forEach(e => { if (e.c === 'Load' || e.c === 'Generator') e.dprof = ED.weekOf(e, o.start); });
    const [ra, rb] = [await ED.solve(psa, a, o), await ED.solve(psa, b, o)];
    if (!ra.report.ok || !rb.report.ok || ra.totals.cost !== rb.totals.cost) diff.push(key + ' ' + ra.totals.cost + ' vs ' + rb.totals.cost);
  }
  check('A7 every Quick Start with daily variability turned on from its own days solves to the very same cost', !diff.length, diff.join('; ') || '4 Quick Starts, 72 hours');
  // Every Quick Start with its profiles given as a file (the template's four places): the same cost, to rounding.
  diff = [];
  for (const key of Object.keys(ED.PRESETS)) {
    const p = ED.PRESETS[key], a = ED.load(p.model), b = ED.load(p.model), o = { ...p.opts, start: '2026-02-02T00:00' };
    const H = ED.solveOptions(o).hours;
    b.el.forEach(e => { if (e.c === 'Load' || e.c === 'Generator') e.ts = { at: o.start, v: ED.series(e, H, o.start, e.c === 'Generator' ? 1 : 0).map(v => Math.round(v * 1e4) / 1e4) }; });
    const [ra, rb] = [await ED.solve(psa, a, o), await ED.solve(psa, b, o)];
    const rel = Math.abs(ra.totals.cost - rb.totals.cost) / ra.totals.cost;
    if (!rb.report.ok || rel > 1e-4) diff.push(key + ' ' + rel.toExponential(1));
  }
  check('A7 every Quick Start with its profiles taken from a file solves to the same cost, to the file’s rounding', !diff.length, diff.join('; ') || 'within 1e-4');
  // Seeded random networks with daily variability and files, replayed from their definition.
  let bad = [], n = 0;
  for (let seed = 101; seed <= 115; seed++) {
    const c = randomCase(seed), r = rng(seed * 7), start = pickStart(r);
    c.opts.start = start;
    const H = ED.solveOptions(c.opts).hours, s0 = Date.parse(start + ':00Z');
    c.model.el.forEach(e => {
      if (e.c !== 'Load' && e.c !== 'Generator') return;
      const u = r();
      if (u < 0.4) e.dprof = Array.from({ length: 7 }, () => Math.round((0.3 + r() * 0.9) * 100) / 100);
      else if (u < 0.7) e.ts = { at: ED.isoOf(s0 - Math.floor(r() * 5) * HOUR), v: Array.from({ length: H + 6 }, () => Math.round(r() * 110) / 100) };
    });
    const res = await ED.solve(psa, c.model, c.opts);
    if (!res.report.ok) { bad.push(seed + ': ' + res.report.error); continue; }
    n++;
    const w = replay(c.model, c.opts, res), fails = holds(w);
    // And the demand and availability the solver saw are the definition's.
    let dw = 0;
    c.model.el.forEach(e => {
      if (!ED.onBus(c.model, e)) return;
      for (let t = 0; t < H; t++) {
        if (e.c === 'Load') dw = Math.max(dw, Math.abs(res.dev[e.id].p[t] - e.p_set * want(e, t, start)));
        if (e.c === 'Generator') dw = Math.max(dw, Math.abs(res.dev[e.id].avail[t] - e.p_nom * want(e, t, start)));
      }
    });
    if (fails.length || dw > 1e-9) bad.push(seed + ': ' + fails.join(',') + ' profile ' + dw);
  }
  check('A7 15 seeded networks with daily variability and files: replayed from their definition, demand and availability as defined', !bad.length && n === 15, bad.slice(0, 3).join(' | ') || n + ' solved');
}
function pickStart(r) { return ED.isoOf(Date.UTC(2026, Math.floor(r() * 12), 1 + Math.floor(r() * 28), Math.floor(r() * 24))); }

/* ── A9: fast ── */
console.log('\n── A9 the profile mechanism is fast ──');
{
  const time = (fn, reps = 5) => { fn(); const t0 = performance.now(); for (let i = 0; i < reps; i++) fn(); return (performance.now() - t0) / reps; };
  // 300 loads and 120 units over 30 days, every kind of profile.
  const el = [{ c: 'Bus', id: 1, at: [0, 0, 8] }], r = rng(9);
  const shapes = ['sys', 'res', 'com', 'ind', '', 'custom', 'solar', 'wind'];
  for (let i = 0; i < 420; i++) {
    const sh = shapes[i % 8], e = { c: i < 300 ? 'Load' : 'Generator', id: i + 2, bus: 1, p_set: 10, p_nom: 10, prof: sh === 'custom' ? Array.from({ length: 24 }, () => r()) : sh };
    if (i % 3 === 0) e.dprof = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4];
    if (i % 5 === 0) e.ts = { at: '2026-01-01T00:00', v: Array.from({ length: 720 }, () => r()) };
    el.push(e);
  }
  const big = ED.load({ v: 1, el });
  const ms1 = time(() => big.el.forEach(e => { if (e.c !== 'Bus') ED.series(e, 720, '2026-01-01T00:00', e.c === 'Generator' ? 1 : 0); }));
  check('A9 every hour of 30 days for 420 loads and units (302,400 values) in under 30 ms', ms1 < 30, ms1.toFixed(1) + ' ms');
  const ms2 = time(() => ED.validate(big, { hours: 720, start: '2026-01-01T00:00' }));
  check('A9 the checks over those 30 days, run on every edit, in under 50 ms', ms2 < 50, ms2.toFixed(1) + ' ms');
  // A year of hours for 40 loads and units in a CSV, read against a week.
  const m = ED.load({ v: 1, el: [{ c: 'Bus', id: 1 }].concat(Array.from({ length: 40 }, (_, i) => ({ c: i % 2 ? 'Load' : 'Generator', id: i + 2, name: 'E' + i, bus: 1, p_set: 50, p_nom: 50 }))) });
  const head = ['Date and time'].concat(Array.from({ length: 40 }, (_, i) => 'E' + i + ' [p.u.]'));
  const lines = [head.join(',')], y0 = Date.parse('2026-01-01T00:00:00Z');
  for (let t = 0; t < 8760; t++) { const row = [isoAt(y0 + t * HOUR)]; for (let k = 0; k < 40; k++) row.push((((t * 7 + k * 13) % 100) / 100).toFixed(3)); lines.push(row.join(',')); }
  const text = lines.join('\n');
  let res = null;
  const ms3 = time(() => { res = ED.readProfiles(ED.csvRows(text), m, { H: 168, start: '2026-06-01T00:00' }); }, 3);
  check('A9 a year of hours for 40 columns (' + (text.length / 1e6).toFixed(1) + ' MB of CSV) read and matched to a week in under 400 ms', ms3 < 400 && res.changes.length === 40 && res.used.outside === 8760 - 168, ms3.toFixed(0) + ' ms');
  const tpl = time(() => ED.templateCsv(ED.profileTemplate(big, 720, '2026-01-01T00:00')), 3);
  check('A9 a 30-day template for 420 loads and units in under 300 ms', tpl < 300, tpl.toFixed(0) + ' ms');
  const aoa = [head];
  for (let t = 0; t < 8760; t++) { const row = [ED.msSerial(y0 + t * HOUR)]; for (let k = 0; k < 40; k++) row.push(((t * 7 + k * 13) % 100) / 100); aoa.push(row); }
  const ws = XLSX.utils.aoa_to_sheet(aoa); for (let t = 0; t < 8760; t++) ws['A' + (t + 2)].z = 'yyyy-mm-dd hh:mm';
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Profiles');
  const xbuf = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
  let xr = null;
  const ms4 = time(() => { xr = ED.readProfiles(ED.sheetRows(XLSX, xbuf), m, { H: 168, start: '2026-06-01T00:00' }); }, 2);
  check('A9 the same year as an Excel workbook (' + (xbuf.length / 1e6).toFixed(1) + ' MB) read and matched in under 3 s', ms4 < 3000 && xr.changes.length === 40, ms4.toFixed(0) + ' ms');
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
  check('B8 30 days from 01/07/2026: solved, every hour dated in the table and the diagram, and not restated under it', r.ok && r.T === 720 && r.n === 720 && r.first === '01/07/2026 00:00' &&
    r.last === '30/07/2026 23:00' && r.out === '30/07/2026 23:00' && !r.sub.includes('23:00') && r.maxDays === '30' && !errs.length, JSON.stringify(r).slice(0, 220));
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
// Daily variability and profiles from a file, through the page's own controls.
{
  const { page, errs } = await fresh();
  await page.goto(URL_);
  await solvedP(page);
  await page.evaluate(() => window.__ed.applyPreset('solar'));
  await solvedP(page);
  const cost0 = await page.evaluate(() => window.__ed.app.res.totals.cost);
  const homesId = await page.evaluate(() => window.__ed.app.model.el.find(e => e.name === 'Homes').id);
  await page.evaluate(id => window.__ed.app.select([id]), homesId);
  // A built-in shape: its bars and the daily toggle, no line, no file buttons.
  const plain = await page.evaluate(() => ({ sel: document.getElementById('f_prof').value, opts: [...document.querySelectorAll('#f_prof option')].map(o => o.value),
    bars: document.querySelectorAll('#profBars .pb').length, daily: !!document.getElementById('f_daily'), line: !!document.getElementById('tsLine'), open: !!document.getElementById('profOpen') }));
  check('B10 a built-in shape shows its 24 bars and the daily toggle, and only Custom offers a file',
    plain.sel === 'res' && plain.opts.includes('custom') && !plain.opts.includes('file') && plain.bars === 24 && plain.daily && !plain.line && !plain.open && !errs.length, JSON.stringify(plain));
  // A demand shape comes with daily variability on: seven bars from its own weekdays and the week drawn as a line, no caption.
  const dayState = () => page.evaluate(() => ({ on: document.getElementById('f_daily').checked, bars: document.querySelectorAll('#dayBars .pb-day').length,
    week: document.querySelectorAll('#weekLine .pb-t').length, dprof: window.__ed.app.model.el.find(e => e.name === 'Homes').dprof,
    cap: document.querySelectorAll('#inspector .prof-cap').length, steps: document.querySelectorAll('#inspector .prof-step').length }));
  const on = await dayState();
  check('B10 a demand shape has daily variability on: Monday to Sunday bars from its own days and the week as a line, no caption',
    on.on && on.bars === 7 && on.week === 7 && on.dprof === '' && !on.cap && !on.steps && !errs.length, JSON.stringify(on));
  // Off: every weekday the same (seven 1s, kept apart from the shape's own days), and a different answer; on again, the shape's days and the same answer.
  await page.click('label:has(#f_daily)');
  const off = await dayState();
  await page.evaluate(() => window.__ed.run());
  const costOff = await page.evaluate(() => window.__ed.app.res.totals.cost);
  await page.click('label:has(#f_daily)');
  const on2 = await dayState();
  await page.evaluate(() => window.__ed.run());
  const cost1 = await page.evaluate(() => window.__ed.app.res.totals.cost);
  check('B10 Daily variability off makes every weekday the same, and on again brings back the shape’s own days and the same answer',
    !off.on && !off.bars && !off.week && JSON.stringify(off.dprof) === '[1,1,1,1,1,1,1]' && costOff !== cost0 &&
    on2.on && on2.bars === 7 && on2.dprof === '' && cost1 === cost0 && !errs.length, JSON.stringify({ off, on2, cost0, costOff, cost1 }).slice(0, 300));
  // Picking a shape: a demand shape turns daily variability on, a unit's comes without it.
  const picks = await page.evaluate(() => {
    const ed = window.__ed, m = ed.app.model, homes = m.el.find(e => e.name === 'Homes'), pv = m.el.find(e => e.c === 'Generator' && e.style === 'pv');
    const pick = (e, v) => { ed.app.select([e.id]); const s = document.getElementById('f_prof'); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true }));
      return { v, prof: e.prof, dprof: e.dprof, on: document.getElementById('f_daily').checked, week: !!document.getElementById('weekLine'), opts: [...s.options].map(o => o.value) }; };
    homes.dprof = [1, 1, 1, 1, 1, 1, 1];
    const out = [pick(homes, 'respv'), pick(homes, 'resev'), pick(homes, 'com'), pick(pv, 'pveq'), pick(pv, 'pvs')];
    pick(homes, 'res'); ed.app.select([homes.id]);
    return out;
  });
  check('B10 picking a demand shape turns daily variability on with its own days; a solar or wind shape has none, and the new shapes are offered',
    picks.slice(0, 3).every(p => p.on && p.week && p.dprof === '') && picks.slice(3).every(p => !p.on && !p.week && p.dprof === '') &&
    ['respv', 'resev'].every(k => picks[0].opts.includes(k)) && picks[3].opts.includes('pveq') && !picks[3].opts.some(k => ED.PROFILES[k] && ED.PROFILES[k].old) && !errs.length,
    JSON.stringify(picks.map(p => [p.v, p.on, p.week])));
  // Drag Thursday's bar down to half: the model, the bars and the week all follow, and the run uses it.
  // The bars' own units to the screen, through the SVG's transform.
  const at = (ux, uy) => page.evaluate(([x, y]) => { const s = document.getElementById('dayBars'), p = s.createSVGPoint(); p.x = x; p.y = y; const q = p.matrixTransform(s.getScreenCTM()); return [q.x, q.y]; }, [ux, uy]);
  const [ax, ay] = await at(120, 30), [bx, by] = await at(120, 58 - 27);
  await page.mouse.move(ax, ay); await page.mouse.down(); await page.mouse.move(bx, by, { steps: 4 }); await page.mouse.up();
  const drag = await page.evaluate(() => ({ d: window.__ed.app.model.el.find(e => e.name === 'Homes').dprof.slice(), stale: document.getElementById('runBtn').classList.contains('needs-run') }));
  await page.evaluate(() => { const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }; set('edSpanUnit', 'd'); set('edSpan', '7'); set('edStart', '2026-01-05T00:00'); });
  await page.evaluate(() => window.__ed.run());
  await solvedP(page);
  const thu = await page.evaluate(id => { const r = window.__ed.app.res, e = window.__ed.app.model.el.find(x => x.id === id); return { p: r.dev[id].p.slice(72, 96), ps: e.p_set, mon: r.dev[id].p.slice(0, 24) }; }, homesId);
  const wantThu = ED.PROFILES.res.h.map(v => 300 * v * drag.d[3]);
  check('B11 dragging Thursday’s bar to half halves Thursday’s demand in the run, hour by hour', Math.abs(drag.d[3] - 0.5) < 0.011 && drag.stale &&
    thu.p.every((v, h) => Math.abs(v - wantThu[h]) < 1e-9), 'Thursday ' + drag.d[3] + ', 18:00 ' + thu.p[18].toFixed(1) + ' MW');
  // Drag 18:00 on the hourly bars to 50%: the list reads Residential, edited, and every day's 18:00 moves by the same, weekend too.
  const prevH = await page.evaluate(id => window.__ed.app.res.dev[id].p.slice(), homesId);
  const hat = (ux, uy) => page.evaluate(([x, y]) => { const s = document.getElementById('profBars'), p = s.createSVGPoint(); p.x = x; p.y = y; const q = p.matrixTransform(s.getScreenCTM()); return [q.x, q.y]; }, [ux, uy]);
  const [hx, hy] = await hat(185, 10), [hx2, hy2] = await hat(185, 58 - 27);
  await page.mouse.move(hx, hy); await page.mouse.down(); await page.mouse.move(hx2, hy2, { steps: 4 }); await page.mouse.up();
  const ed = await page.evaluate(id => { const e = window.__ed.app.model.el.find(x => x.id === id); const s = document.getElementById('f_prof');
    return { prof18: e.prof[18], pbase: e.pbase, sel: s.value, label: s.options[s.selectedIndex].textContent }; }, homesId);
  await page.evaluate(() => window.__ed.run());
  await solvedP(page);
  const edP = await page.evaluate(id => window.__ed.app.res.dev[id].p.slice(), homesId);
  const R_ = ED.PROFILES.res, dd = ed.prof18 - R_.h[18];
  // 05/01/2026 is a Monday: day k's 18:00 is hour 24k + 18, Saturday and Sunday on the weekend day.
  const moved = [0, 1, 2, 4, 5, 6].every(k => Math.abs(edP[24 * k + 18] - 300 * ((k >= 5 ? R_.w[18] : R_.h[18]) + dd) * drag.d[k]) < 1e-6) && edP.every((v, t) => t % 24 === 18 || Math.abs(v - prevH[t]) < 1e-9);
  check('B11 dragging an hour of Residential keeps it Residential, edited: that hour moves by the same on every day, weekend too, and no other hour moves',
    Math.abs(ed.prof18 - 0.5) < 0.011 && ed.pbase === 'res' && ed.sel === 'res' && /Residential, edited/.test(ed.label) && moved && !errs.length, JSON.stringify(ed));
  // Custom: the file buttons above the horizon's hours, no bars, and nothing changes until a file is opened.
  const snapC = await page.evaluate(() => JSON.stringify(window.ED.compact(window.__ed.app.model)));
  await page.selectOption('#f_prof', 'custom');
  const cu = await page.evaluate(() => { const o = document.getElementById('profOpen'), l = document.getElementById('tsLine');
    return { sel: document.getElementById('f_prof').value, order: !!(o && l && (o.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING)), tpl: !!document.getElementById('profTpl'),
      extra: document.querySelectorAll('#inspector .prof-bars, #inspector .prof-cap, #f_daily').length, snap: JSON.stringify(window.ED.compact(window.__ed.app.model)) }; });
  check('B11 Custom shows Open file and the template above the horizon’s hours, nothing else, and changes nothing until a file is opened',
    cu.sel === 'custom' && cu.order && cu.tpl && !cu.extra && cu.snap === snapC && !errs.length, JSON.stringify({ ...cu, snap: undefined }));
  await page.evaluate(id => { window.__ed.app.select([]); window.__ed.app.select([id]); }, homesId);
  // The templates: both formats, the horizon's hours from the first hour, a column per load and generator.
  await page.click('.ctrl-tab[data-tab="dispatch"]');
  // The Excel template is the page's still (app.downloadTemplate); the button is the CSV one.
  const [dx] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => window.__ed.app.downloadTemplate('xlsx'))]);
  const xbuf = readFileSync(await dx.path());
  const xt = ED.sheetRows(XLSX, new Uint8Array(xbuf));
  const [dc] = await Promise.all([page.waitForEvent('download'), page.click('#tplCsvBtn')]);
  const ctext = readFileSync(await dc.path(), 'utf8'), ct = ED.csvRows(ctext);
  const tmsg = await page.textContent('#profAllMsg');
  check('B12 the Excel and CSV templates: 168 hours from 05/01/2026 00:00, a column per load and generator, the same numbers in both',
    dx.suggestedFilename().endsWith('.xlsx') && dc.suggestedFilename().endsWith('.csv') && xt.rows.length === 169 && ct.rows.filter(r => r.join('')).length === 169 &&
    xt.rows[1][0] === '2026-01-05 00:00:00' && xt.rows[168][0] === '2026-01-11 23:00:00' && ct.rows[1][0] === '2026-01-05 00:00' && xt.rows[0].length === 6 &&
    xt.rows.slice(1).every((r, i) => r.slice(1).every((v, j) => v === +ct.rows[i + 1][j + 1])) && /168 hours/.test(tmsg),
    dx.suggestedFilename() + ', ' + dc.suggestedFilename() + ': ' + tmsg.slice(0, 90));
  // Opened as downloaded: every load and generator turns Custom and keeps every hour it had.
  // The dispatch tab's Open file is on its own tab: go there first, as a reader would.
  const pick = async (sel, file) => {
    if (sel === '#profAllBtn') await page.click('.ctrl-tab[data-tab="dispatch"]');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click(sel)]); await fc.setFiles(file);
  };
  const tmpd = join(HERE, '.tmp'); mkdirSync(tmpd, { recursive: true });
  const fAs = (name, body) => { const f = join(tmpd, name); writeFileSync(f, body); return f; };
  const seriesNow = () => page.evaluate(() => { const a = window.__ed.app;
    const H = 168, st = document.getElementById('edStart').value;
    return a.model.el.filter(e => e.c === 'Load' || e.c === 'Generator').map(e => ({ id: e.id, ts: window.ED.hasTs(e), v: window.ED.series(e, H, st, e.c === 'Generator' ? 1 : 0) })); });
  const sBefore = await seriesNow();
  await pick('#profAllBtn', await dx.path().then(p => fAs('as-is.xlsx', readFileSync(p))));
  await page.waitForFunction(() => /as-is\.xlsx:/.test(document.getElementById('profAllMsg').textContent));
  const sAfter = await seriesNow();
  await page.evaluate(id => window.__ed.app.select([id]), sAfter[0].id);
  const selAs = await page.evaluate(() => ({ sel: document.getElementById('f_prof').value, line: !!document.querySelector('#tsLine .pl'), tpl: !!document.getElementById('profTpl') }));
  await page.evaluate(() => window.__ed.app.select([]));
  check('B13 the template opened as downloaded: every load and generator is Custom, the inspector shows it so, and no hour moves',
    sAfter.length === sBefore.length && sAfter.every((x, i) => x.ts && x.v.every((v, t) => Math.abs(v - sBefore[i].v[t]) < 6e-5)) && selAs.sel === 'custom' && selAs.line && selAs.tpl,
    JSON.stringify(selAs) + ' ' + (await page.textContent('#profAllMsg')).slice(0, 120));
  // The CSV template with Solar farm cloudy on Wednesday, opened: the solar farm takes its hours from the file, the run uses them.
  const rows = ctext.trim().split('\r\n').map(l => l.split(','));
  const sfCol = rows[0].indexOf('Solar farm [p.u.]');
  for (let i = 49; i <= 72; i++) rows[i][sfCol] = String(+rows[i][sfCol] * 0.25);
  const t0 = Date.now();
  await pick('#profAllBtn', fAs('cloudy-wednesday.csv', rows.map(r => r.join(',')).join('\r\n')));
  await page.waitForFunction(() => /Solar farm/.test(document.getElementById('profAllMsg').textContent) && /cloudy-wednesday/.test(document.getElementById('profAllMsg').textContent));
  const applied = Date.now() - t0;
  const sf = await page.evaluate(() => { const e = window.__ed.app.model.el.find(x => x.name === 'Solar farm'); return { ts: e.ts, id: e.id, p_nom: e.p_nom }; });
  await page.evaluate(id => window.__ed.app.select([id]), sf.id);
  const insp = await page.evaluate(() => ({ sel: document.getElementById('f_prof').value, line: !!document.querySelector('#tsLine .pl'), cap: !!document.querySelector('#inspector .prof-cap'), daily: !!document.getElementById('f_daily'), bars: !!document.getElementById('profBars') }));
  await page.evaluate(() => window.__ed.run());
  const av = await page.evaluate(id => window.__ed.app.res.dev[id].avail, sf.id);
  check('B14 a CSV with a cloudy Wednesday: the solar farm takes those hours from the file, the run uses them, the inspector shows them',
    !!sf.ts && sf.ts.at === '2026-01-05T00:00' && sf.ts.v.length === 168 && insp.sel === 'custom' && insp.line && !insp.daily && !insp.cap && !insp.bars &&
    av.every((v, t) => Math.abs(v - Math.min(1, +rows[t + 1][sfCol]) * sf.p_nom) < 420 * 1e-5) && !errs.length, applied + ' ms to apply; ' + JSON.stringify(insp));
  // A longer horizon than the file: the run is stopped and says why, in the checks.
  await page.evaluate(() => { const el = document.getElementById('edSpan'); el.value = '8'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  const blocked = await page.evaluate(async () => { await window.__ed.run(); const r = window.__ed.app.res;
    return { ok: r.report.ok, why: (r.report.blocked || []).map(x => x.msg).join(' ') }; });
  check('B15 a horizon past the file’s last hour stops the run, saying so in the checks', !blocked.ok && /Solar farm’s uploaded profile runs from 05\/01\/2026 00:00 to 11\/01\/2026 23:00/.test(blocked.why),
    blocked.why.slice(0, 120));
  // A file too short for the horizon is turned away and changes nothing.
  const snap2 = await page.evaluate(() => JSON.stringify(window.ED.compact(window.__ed.app.model)));
  await page.evaluate(() => window.__ed.app.select([]));
  await pick('#profAllBtn', fAs('short.csv', rows.slice(0, 100).map(r => r.join(',')).join('\n')));
  await page.waitForFunction(() => /was not used/.test(document.getElementById('profAllMsg').textContent));
  const rej = await page.evaluate(() => ({ msg: document.getElementById('profAllMsg').textContent, err: document.getElementById('profAllMsg').classList.contains('is-err'), snap: JSON.stringify(window.ED.compact(window.__ed.app.model)) }));
  check('B16 a file that stops short of the horizon is turned away, saying where, and nothing changes', rej.err && rej.snap === snap2 && /short at the end/.test(rej.msg), rej.msg.slice(0, 140));
  // One element from the inspector: Custom, then Open file; one column of MW for a load sets its peak.
  await page.evaluate(() => { const el = document.getElementById('edSpan'); el.value = '7'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.evaluate(id => window.__ed.app.select([id]), homesId);
  const one = [['Time', 'Demand in MW (MW)']];
  for (let t = 0; t < 168; t++) one.push([`${String(5 + Math.floor(t / 24)).padStart(2, '0')}/01/2026 ${String(t % 24).padStart(2, '0')}:00`, String(200 + (t % 24) * 5)]);
  await page.selectOption('#f_prof', 'custom');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#profOpen')]);
  await fc.setFiles(fAs('homes-mw.csv', one.map(r => r.join(',')).join('\n')));
  await page.waitForFunction(() => /homes-mw\.csv(:| was not| could not)/.test((document.getElementById('profMsg') || {}).textContent || ''));
  const h = await page.evaluate(id => { const e = window.__ed.app.model.el.find(x => x.id === id); return { p_set: e.p_set, v0: e.ts && e.ts.v[0], n: e.ts && e.ts.v.length, msg: document.getElementById('profMsg').textContent, sel: document.getElementById('f_prof').value }; }, homesId);
  await page.evaluate(() => window.__ed.run());
  const hp = await page.evaluate(id => window.__ed.app.res.dev[id].p, homesId);
  check('B17 Custom in the inspector: one column in MW sets the peak demand to its highest hour, and every hour keeps its MW',
    h.p_set === 315 && h.n === 168 && h.sel === 'custom' && hp.every((v, t) => Math.abs(v - (200 + (t % 24) * 5)) < 1e-3) && /peak demand set/.test(h.msg),
    'sel ' + h.sel + ', worst ' + Math.max(...hp.map((v, t) => Math.abs(v - (200 + (t % 24) * 5)))).toExponential(1) + ' MW; ' + h.msg.slice(0, 120));
  // Back to a built-in shape: the file is let go.
  await page.selectOption('#f_prof', 'res');
  const back = await page.evaluate(id => { const e = window.__ed.app.model.el.find(x => x.id === id); return { ts: e.ts, prof: e.prof, dprof: e.dprof, on: window.ED.dailyOn(e), toggle: !!(document.getElementById('f_daily') || {}).checked }; }, homesId);
  check('B18 choosing a shape again lets the file go and brings the shape’s own daily variability', back.ts === null && back.prof === 'res' && back.dprof === '' && back.on && back.toggle, JSON.stringify(back));
  // Undo brings the file back; the mini cache keeps both across a reload, and the reload solves them.
  await page.evaluate(() => window.__ed.app.undo());
  await page.evaluate(() => window.__ed.run());
  const before = await page.evaluate(() => ({ cost: window.__ed.app.res.totals.cost, snap: JSON.stringify(window.ED.compact(window.__ed.app.model)) }));
  await page.waitForTimeout(600);
  await page.reload();
  await solvedP(page);
  const after = await page.evaluate(() => ({ cost: window.__ed.app.res.totals.cost, snap: JSON.stringify(window.ED.compact(window.__ed.app.model)), T: window.__ed.app.res.T }));
  check('B19 undo brings the file back, and a reload keeps the files and the daily bars and solves to the same cost',
    before.snap.includes('"ts"') && before.snap.includes('"dprof"') && after.snap === before.snap && after.cost === before.cost && after.T === 168 && !errs.length, '$' + Math.round(after.cost).toLocaleString());
  // A year of hours for the whole network, opened on the page: how long until it is applied.
  const y0 = Date.parse('2026-01-01T00:00:00Z'), yr = [['Date and time', 'Homes [p.u.]', 'Shops and offices [p.u.]', 'Solar farm [p.u.]']];
  for (let t = 0; t < 8760; t++) yr.push([isoAt(y0 + t * HOUR), ((t % 24) / 30 + 0.2).toFixed(4), ((t % 13) / 20 + 0.1).toFixed(4), ((t % 7) / 8).toFixed(4)]);
  const t1 = Date.now();
  await pick('#profAllBtn', fAs('year.csv', yr.map(r => r.join(',')).join('\n')));
  await page.waitForFunction(() => /year\.csv:/.test(document.getElementById('profAllMsg').textContent));
  const yms = Date.now() - t1, ym = await page.textContent('#profAllMsg');
  // The page's own time, without the file chooser: read, matched, applied and redrawn.
  const inPage = await page.evaluate(async text => {
    const f = new File([text], 'year.csv'), out = [];
    for (let i = 0; i < 3; i++) { const t0 = performance.now(); await window.__ed.app.applyProfileFile(f, null); out.push(performance.now() - t0); }
    return Math.min(...out);
  }, yr.map(r => r.join(',')).join('\n'));
  check('B20 a year of hours opened on the page is matched to the week and applied in under 250 ms', inPage < 250 && /8,592 rows outside the horizon left out/.test(ym),
    Math.round(inPage) + ' ms on the page (' + yms + ' ms through the file chooser): ' + ym.slice(0, 80));
  check('B no page errors with profiles', errs.length === 0, errs.slice(0, 3).join(' | '));
  rmSync(tmpd, { recursive: true, force: true });
}
// A generator's type, its minimum stable loading and its cost curve, through the inspector.
{
  const { page, errs } = await fresh();
  await page.goto(URL_);
  await solvedP(page);
  await page.evaluate(() => window.__ed.applyPreset('uc3'));
  await solvedP(page);
  const idOf = n => page.evaluate(name => window.__ed.app.model.el.find(e => e.name === name).id, n);
  const coal = await idOf('Coal'), cc = await idOf('Combined cycle');
  const shown = () => page.evaluate(() => {
    const q = s => !!document.querySelector('#inspector ' + s), lbl = document.querySelector('#inspector .seg-group[data-k="sym"]');
    return { type: lbl ? lbl.closest('.field-row').querySelector('.field-label').textContent.trim() : '', pmin: q('#f_p_min_pu'), curve: q('.seg-group[data-k="mcurve"]'),
      com: q('input[data-k="committable"]'), ramp: q('#f_ramp_limit_up'), mc: q('#f_marginal_cost'), groups: [...document.querySelectorAll('#inspector .group-title')].map(g => g.textContent),
      profs: [...(document.getElementById('f_prof') || { options: [] }).options].map(o => o.value), sub: document.querySelector('#inspector .insp-sub').textContent };
  });
  await page.evaluate(id => window.__ed.app.select([id]), coal);
  const g0 = await shown();
  await page.click('.seg-group[data-k="sym"] .seg-btn[data-val="pv"]');
  const s1 = await shown(), m1 = await page.evaluate(id => window.ED.compact(window.__ed.app.model).el.find(e => e.id === id), coal);
  const stale = await page.evaluate(() => document.getElementById('runBtn').classList.contains('needs-run'));
  check('B21 Type: a Generator offers its minimum stable loading, a marginal cost curve, commitment and ramping', g0.type.startsWith('Type') && g0.pmin && g0.curve && g0.com && g0.ramp &&
    g0.groups.join() === 'Parameters,Cost,Commitment,Ramping,Labels' && !g0.profs.includes('pv') && /^Generator\./.test(g0.sub), JSON.stringify(g0).slice(0, 200));
  check('B21 Type Solar: what it does not offer goes back to its default and is hidden, its availability is the sun\'s, and the run is out of date',
    !s1.pmin && !s1.curve && !s1.com && !s1.ramp && s1.mc && s1.groups.join() === 'Parameters,Labels' && s1.profs.includes('pv') && !s1.profs.includes('wnd') && /^Solar\./.test(s1.sub) &&
    m1.style === 'pv' && m1.prof === 'pv' && !('committable' in m1) && !('p_min_pu' in m1) && !('ramp_limit_up' in m1) && !('start_up_cost' in m1) && stale, JSON.stringify(m1));
  await page.click('.seg-group[data-k="sym"] .seg-btn[data-val=""]');
  const s2 = await shown(), m2 = await page.evaluate(id => window.ED.compact(window.__ed.app.model).el.find(e => e.id === id), coal);
  check('B21 back to a Generator: it starts as a new one does, committable with a 30% minimum stable loading, always available',
    s2.pmin && s2.com && m2.committable === 1 && m2.p_min_pu === 0.3 && m2.prof === undefined && m2.style === undefined &&
    await page.inputValue('#f_p_min_pu') === '30' && /While on/.test(await page.textContent('#derived')), JSON.stringify(m2));
  await page.evaluate(() => window.__ed.app.undo()); await page.evaluate(() => window.__ed.app.undo());
  // A cost curve on the combined cycle.
  await page.evaluate(id => window.__ed.app.select([id]), cc);
  await page.click('.seg-group[data-k="mcurve"] .seg-btn[data-val="lin"]');
  const lin = await page.evaluate(id => {
    const e = window.__ed.app.model.el.find(x => x.id === id), sv = document.getElementById('costCurve');
    return { mcurve: e.mcurve, q: e.marginal_cost_quadratic, slope: (document.getElementById('f_marginal_cost_quadratic') || {}).value, cubic: !!document.getElementById('f_marginal_cost_cubic'),
      line: !!(sv && sv.querySelector('path.pl')), steps: !!(sv && sv.querySelector('path.cc-step')), a: document.querySelector('#f_marginal_cost').closest('.field-row').textContent };
  }, cc);
  check('B22 Linear: a slope to fill in, seeded so the curve rises, and the curve drawn with the pieces it is solved as',
    lin.mcurve === 'lin' && lin.q > 0 && +lin.slope === lin.q * 2 && !lin.cubic && lin.line && lin.steps && /At 0 MW/.test(lin.a), JSON.stringify(lin));
  const typeIn = async (sel, v) => { await page.fill(sel, v); await page.dispatchEvent(sel, 'change'); };
  const d0 = await page.getAttribute('#costCurve path.pl', 'd');
  await typeIn('#f_marginal_cost_quadratic', '0.05');
  await page.click('.seg-group[data-k="mcurve"] .seg-btn[data-val="quad"]');
  await typeIn('#f_marginal_cost_cubic', '0.0003');
  const quad = await page.evaluate(id => { const e = window.__ed.app.model.el.find(x => x.id === id); return { mcurve: e.mcurve, q: e.marginal_cost_quadratic, k: e.marginal_cost_cubic, d: document.querySelector('#costCurve path.pl').getAttribute('d'), line: document.getElementById('costLine').textContent }; }, cc);
  check('B22 Quadratic: a curvature too; the values are stored in PyPSA\'s convention (a·P + q·P² + k·P³ an hour) and the curve redraws',
    quad.mcurve === 'quad' && Math.abs(quad.q - 0.025) < 1e-12 && Math.abs(quad.k - 0.0001) < 1e-12 && quad.d !== d0 && /From .*\/MWh at 96 MW to .*\/MWh at 240 MW/.test(quad.line), JSON.stringify(quad).slice(0, 240));
  // Pointing at the curve reads it.
  await page.evaluate(() => document.getElementById('costCurve').scrollIntoView({ block: 'center' }));
  const bb = await page.locator('#costCurve').boundingBox();
  await page.mouse.move(bb.x + bb.width * 0.6, bb.y + bb.height * 0.5);
  const read = await page.evaluate(() => (document.querySelector('#costCurve text.pb-v') || {}).textContent || '');
  check('B22 pointing at the curve reads its output and marginal cost there', /MW .*\/MWh/.test(read), read);
  await page.evaluate(() => window.__ed.run());
  await solvedP(page);
  const snap = await page.evaluate(() => ({ model: window.ED.compact(window.__ed.app.model), opts: window.__ed.solveOptions(), cost: window.__ed.app.res.totals.cost, card: document.getElementById('mCost').textContent,
    want: window.ED.fmt.money(window.__ed.app.res.totals.cost, document.getElementById('edCur').value), assume: document.getElementById('assumptions').textContent }));
  const here = await ED.solve(psa, ED.load(snap.model), snap.opts);
  check('B22 the run in the page is the core\'s on the same network, its cost card says so, and What this assumes names the pieces',
    here.report.ok && Math.abs(here.totals.cost - snap.cost) < 1e-6 * snap.cost && snap.card === snap.want && /solved as 16 straight pieces/.test(snap.assume), '$' + Math.round(snap.cost).toLocaleString());
  // The diagram's cost label reads the marginal cost at the hour's output.
  await page.evaluate(() => { const b = document.getElementById('lb_Generator_cost'); if (b && !b.checked) b.click(); });
  const lab = await page.evaluate(id => {
    const e = window.__ed.app.model.el.find(x => x.id === id), h = +document.getElementById('edHour').value, p = window.__ed.app.res.dev[id].p[h];
    const want = window.ED.fmt.price(window.ED.mcAt(e, p), document.getElementById('edCur').value) + '/MWh';
    return { want, has: [...document.querySelectorAll('#sldSvg text')].some(t => t.textContent === want) };
  }, cc);
  check('B22 the diagram labels a curve\'s unit with its marginal cost at the hour\'s output', lab.has, lab.want);
  await page.click('.seg-group[data-k="mcurve"] .seg-btn[data-val=""]');
  await page.evaluate(() => window.__ed.run());
  await solvedP(page);
  const back = await page.evaluate(() => ({ cost: window.__ed.app.res.totals.cost, curve: !!document.getElementById('costCurve') }));
  const plain = await ED.solve(psa, ED.load(ED.PRESETS.uc3.model), ED.PRESETS.uc3.opts);
  check('B22 Scalar again: the curve goes, and the unit costs its marginal cost at any output, as before', !back.curve && Math.abs(back.cost - plain.totals.cost) < 1e-6, '$' + back.cost.toFixed(2));
  check('B22 no page errors', !errs.length, errs.slice(0, 2).join(' | '));
}
// Minimum stable loading on a unit that is not committable, and the two economic dispatches.
{
  const { page, errs } = await fresh();
  await page.goto(URL_);
  await solvedP(page);
  const mode0 = await page.inputValue('#edMode');
  const sun = await page.evaluate(() => window.__ed.app.model.el.find(e => e.name === 'Sundance').id);
  await page.evaluate(id => window.__ed.app.select([id]), sun);
  const d0 = await page.textContent('#derived');
  await page.fill('#f_p_min_pu', '25'); await page.dispatchEvent('#f_p_min_pu', 'change');
  await page.evaluate(() => window.__ed.run());
  await solvedP(page);
  const edm = await page.evaluate(id => window.__ed.app.res.dev[id].p.slice(), sun);
  await page.evaluate(() => { const el = document.getElementById('edMode'); el.value = 'ed'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.evaluate(() => window.__ed.run());
  await solvedP(page);
  const ed = await page.evaluate(id => ({ p: window.__ed.app.res.dev[id].p.slice(), label: document.querySelector('#edMode option:checked').textContent, tip: document.getElementById('edModeTip').getAttribute('data-tip') }), sun);
  check('B23 PJM 5-bus opens as an economic dispatch that holds minimums, and a unit that is not committable shows its minimum stable loading, always on',
    mode0 === 'edm' && /Always on/.test(d0), mode0 + '; ' + d0);
  check('B23 at 25%, Sundance never runs below 50 MW; the economic dispatch with no minimum output runs it from zero, as Li and Bo have it at 18:00',
    edm.every(v => v >= 50 - 1e-6) && Math.abs(ed.p[18]) < 1e-6 && /no minimum output/.test(ed.label) && /from zero/.test(ed.tip) && !errs.length,
    'lowest ' + Math.min(...edm).toFixed(2) + ' MW; 18:00 ' + ed.p[18].toFixed(3) + ' MW');
}
// A cache from before: the old economic dispatch keeps its meaning, and a v1 unit that is not committable keeps running from zero.
{
  const m = JSON.parse(JSON.stringify(ED.PRESETS.uc3.model));
  m.v = 1;
  m.el.forEach(e => { if (e.c === 'Generator') e.committable = 0; });
  const raw = JSON.stringify({ __fields: { 'v:edMode': 'ed', 'v:edSpan': '1', 'v:edSpanUnit': 'd', 'v:edStart': '2026-01-01T00:00' }, __extra: m });
  const { page, errs } = await fresh(`try { localStorage.setItem('abt:save:educ-simulator:v1', ${JSON.stringify(raw)}); } catch(e){}`);
  await page.goto(URL_);
  await solvedP(page);
  const r = await page.evaluate(() => ({ mode: document.getElementById('edMode').value, cost: window.__ed.app.res.totals.cost, mins: window.__ed.app.model.el.filter(e => e.c === 'Generator').map(e => e.p_min_pu) }));
  const want = await ED.solve(psa, ED.load({ ...m, el: m.el.map(e => { const o = { ...e }; delete o.p_min_pu; return o; }) }), { mode: 'ed', hours: 24, start: '2026-01-01T00:00' });
  check('B24 a cache from before keeps "Economic dispatch" as it was, every unit from zero, and its units that are not committable lose the minimum they never had',
    r.mode === 'ed' && r.mins.every(v => v === 0) && Math.abs(r.cost - want.totals.cost) < 1e-6 && !errs.length, r.mode + ', $' + r.cost.toFixed(2));
}
await browser.close();
server.close();
console.log(`\nED/UC audit: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
