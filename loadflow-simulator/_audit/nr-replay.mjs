// An independent load flow, written from PyPSA's documented model rather than
// from PSA.js's code, to check the Load Flow Simulator against.
//
//   per unit on 1 MVA and each bus's nominal voltage
//   line:        series r + jx (Ω) / v_nom(bus0)², shunt g + jb (S) · v_nom(bus0)², half at each end
//   transformer: series r + jx (p.u. on s_nom) / s_nom, shunt g + jb · s_nom; a T model is turned into
//                its π equivalent; tap ratio τ on the tap side, phase shift φ:
//                  Y00 = (y + y_sh/2) / τ0²   Y01 = −y / (τ0 τ1 e^{−jφ})
//                  Y10 = −y / (τ0 τ1 e^{jφ})  Y11 = (y + y_sh/2) / τ1²
//                (τ0 = τ when the tap is on bus0, τ1 when on bus1). The sign of φ is the one that
//                reproduces PyPSA's own results for PSA.js's pf_small scenario (pypsa-pf-small.json).
//   standard types as PyPSA defines them (line: r, x per km ÷ circuits, b = 2π f c · km · circuits;
//                transformer: vsc, vscr, pfe, i0, taps)
//   slack: the island's first Slack generator, else its first generator, else its first bus;
//   other Slack units and PV units hold their bus voltage; everything else is PQ.
//   Newton-Raphson in polar form with an analytic Jacobian, solved densely.
//   DC: B θ = P with b = 1 / (x_pu · τ), p0 = (θ0 − θ1 − φ) / x_eff; a shunt's conductance
//   draws g · v_nom² of active power, as at 1 p.u. (PyPSA's linear load flow does the same).

/* ── Complex helpers on [re, im] ── */
const c = (re, im = 0) => [re, im];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const div = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
const neg = (a) => [-a[0], -a[1]];
const conj = (a) => [a[0], -a[1]];
const polar = (m, t) => [m * Math.cos(t), m * Math.sin(t)];
const inv = (a) => div(c(1), a);

/* ── A neutral network description ── */
// buses: [{id, v_nom, v_set}]; lines: [{id, b0, b1, r, x, g, b}] (Ω, S);
// trs: [{id, b0, b1, r, x, g, b, s_nom, tau, tap_side, shift, model}] (p.u. on s_nom, degrees);
// gens: [{id, bus, control, p, q}]; loads, stores: [{id, bus, p, q}]; shunts: [{id, bus, g, b}] (S);
// links: [{id, b0, b1, p, eff}]

// The tool's saved model, with PyPSA's standard types applied.
export function fromModel(model, types) {
  const by = Object.fromEntries(model.el.map(e => [e.id, e]));
  const isBus = id => by[id] && by[id].c === 'Bus';
  const net = { buses: [], lines: [], trs: [], gens: [], loads: [], stores: [], shunts: [], links: [] };
  for (const e of model.el) {
    if (e.c === 'Bus') net.buses.push({ id: e.id, v_nom: e.v_nom, v_set: e.v_mag_pu_set });
  }
  for (const e of model.el) {
    const ends = isBus(e.bus0) && isBus(e.bus1) && e.bus0 !== e.bus1;
    if (e.c === 'Line' && ends) {
      const t = e.type && types.line[e.type] && types.line[e.type].f_nom > 0 ? types.line[e.type] : null;
      if (t) net.lines.push({ id: e.id, b0: e.bus0, b1: e.bus1, r: t.r_per_length * e.length / e.num_parallel, x: t.x_per_length * e.length / e.num_parallel,
                              b: 2 * Math.PI * 1e-9 * t.f_nom * t.c_per_length * e.length * e.num_parallel, g: e.g });
      else net.lines.push({ id: e.id, b0: e.bus0, b1: e.bus1, r: e.r, x: e.x, b: e.b, g: e.g });
    } else if (e.c === 'Transformer' && ends) {
      const t = e.type ? types.transformer[e.type] : null;
      if (t) {
        const np = e.num_parallel;
        const r = t.vscr / 100, x = Math.sqrt((t.vsc / 100) ** 2 - r * r);
        const g = t.pfe / (1000 * t.s_nom), b = -Math.sqrt(Math.max((t.i0 / 100) ** 2 - g * g, 0));
        net.trs.push({ id: e.id, b0: e.bus0, b1: e.bus1, r: r / np, x: x / np, g: g * np, b: b * np, s_nom: t.s_nom,
                       tau: 1 + (e.tap_position - t.tap_neutral) * t.tap_step / 100, tap_side: Math.trunc(t.tap_side), shift: t.phase_shift, model: e.model });
      } else net.trs.push({ id: e.id, b0: e.bus0, b1: e.bus1, r: e.r, x: e.x, g: e.g, b: e.b, s_nom: e.s_nom, tau: e.tap_ratio, tap_side: e.tap_side, shift: e.phase_shift, model: e.model });
    } else if (e.c === 'Link' && ends) net.links.push({ id: e.id, b0: e.bus0, b1: e.bus1, p: e.p_set, eff: e.efficiency });
    else if (e.c === 'Generator' && isBus(e.bus)) net.gens.push({ id: e.id, bus: e.bus, control: e.control, p: e.p_set, q: e.q_set });
    else if (e.c === 'Load' && isBus(e.bus)) net.loads.push({ id: e.id, bus: e.bus, p: e.p_set, q: e.q_set });
    else if (e.c === 'StorageUnit' && isBus(e.bus)) net.stores.push({ id: e.id, bus: e.bus, p: e.p_set, q: e.q_set });
    else if (e.c === 'ShuntImpedance' && isBus(e.bus)) net.shunts.push({ id: e.id, bus: e.bus, g: e.g, b: e.b });
  }
  return net;
}

/* ── Branch admittances ── */
function branches(net) {
  const vn = Object.fromEntries(net.buses.map(b => [b.id, b.v_nom]));
  const out = [];
  for (const l of net.lines) {
    const v2 = vn[l.b0] ** 2;
    const y = inv(c(l.r / v2, l.x / v2)), ysh = c(l.g * v2, l.b * v2);
    out.push({ id: l.id, kind: 'line', b0: l.b0, b1: l.b1, y, ysh, t0: 1, t1: 1, phi: 0, xdc: l.x / v2 });
  }
  for (const t of net.trs) {
    let z = c(t.r / t.s_nom, t.x / t.s_nom), ysh = c(t.g * t.s_nom, t.b * t.s_nom);
    const xpu = t.x / t.s_nom;
    if (t.model !== 'pi' && (ysh[0] !== 0 || ysh[1] !== 0)) {
      // T to π: halves of the series impedance either side of the magnetising branch.
      const z1 = mul(z, c(0.5)), z2 = z1, z3 = inv(ysh);
      const s = add(add(mul(z1, z2), mul(z2, z3)), mul(z3, z1));
      const zse = div(s, z3), zs0 = div(s, z2), zs1 = div(s, z1);
      z = zse;
      ysh = add(inv(zs0), inv(zs1));
    }
    const y = inv(z);
    const tau = t.tau || 1;
    out.push({ id: t.id, kind: 'tr', b0: t.b0, b1: t.b1, y, ysh, t0: t.tap_side === 1 ? 1 : tau, t1: t.tap_side === 1 ? tau : 1,
               phi: (t.shift || 0) * Math.PI / 180, xdc: xpu * tau });
  }
  for (const br of out) {
    const ps = polar(1, br.phi), half = add(br.y, mul(br.ysh, c(0.5)));
    br.Y00 = mul(half, c(1 / (br.t0 * br.t0)));
    br.Y11 = mul(half, c(1 / (br.t1 * br.t1)));
    br.Y01 = neg(div(br.y, mul(c(br.t0 * br.t1), conj(ps))));
    br.Y10 = neg(div(br.y, mul(c(br.t0 * br.t1), ps)));
  }
  return out;
}

/* ── Islands and their slack ── */
function islands(net, brs) {
  const parent = new Map(net.buses.map(b => [b.id, b.id]));
  const find = a => { while (parent.get(a) !== a) a = parent.get(a); return a; };
  for (const br of brs) { const a = find(br.b0), b = find(br.b1); if (a !== b) parent.set(b, a); }
  const groups = new Map();
  for (const b of net.buses) { const r = find(b.id); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(b.id); }
  return [...groups.values()];
}
function controls(net, isl) {
  const set = new Set(isl);
  const gens = net.gens.filter(g => set.has(g.bus));
  let slackGen = gens.find(g => g.control === 'Slack') || gens[0] || null;
  const slack = slackGen ? slackGen.bus : isl[0];
  const pv = new Set(gens.filter(g => g !== slackGen && (g.control === 'PV' || g.control === 'Slack')).map(g => g.bus));
  pv.delete(slack);
  return { slack, slackGen, pv };
}

/* ── Injections the network is given ── */
function scheduled(net, busId) {
  let p = 0, q = 0;
  for (const g of net.gens) if (g.bus === busId) { p += g.p; if (g.control === 'PQ') q += g.q; }
  for (const s of net.stores) if (s.bus === busId) { p += s.p; q += s.q; }
  for (const l of net.loads) if (l.bus === busId) { p -= l.p; q -= l.q; }
  for (const k of net.links) { if (k.b0 === busId) p -= k.p; if (k.b1 === busId) p += k.p * k.eff; }
  return [p, q];
}

function solveDense(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
    [M[k], M[p]] = [M[p], M[k]];
    if (Math.abs(M[k][k]) < 1e-300) throw new Error('singular Jacobian');
    for (let i = k + 1; i < n; i++) {
      const f = M[i][k] / M[k][k];
      if (f) for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; }
  return x;
}

/* ── AC: Newton-Raphson ── */
// seed 'dc' starts every angle from the DC load flow, as the tool's default does.
export function acFlow(net, { tol = 1e-11, maxIter = 50, seed = 'flat' } = {}) {
  const brs = branches(net);
  const ids = net.buses.map(b => b.id), at = new Map(ids.map((id, i) => [id, i])), n = ids.length;
  const vn = Object.fromEntries(net.buses.map(b => [b.id, b.v_nom]));
  const G = Array.from({ length: n }, () => new Float64Array(n)), B = Array.from({ length: n }, () => new Float64Array(n));
  const stamp = (i, j, y) => { G[i][j] += y[0]; B[i][j] += y[1]; };
  for (const br of brs) {
    const i = at.get(br.b0), j = at.get(br.b1);
    stamp(i, i, br.Y00); stamp(i, j, br.Y01); stamp(j, i, br.Y10); stamp(j, j, br.Y11);
  }
  for (const s of net.shunts) { const i = at.get(s.bus), v2 = vn[s.bus] ** 2; stamp(i, i, c(s.g * v2, s.b * v2)); }
  const V = new Float64Array(n).fill(1), T = new Float64Array(n);
  if (seed === 'dc') { const d = dcFlow(net); ids.forEach((id, i) => { T[i] = d.bus[id].ang * Math.PI / 180; }); }
  const out = { bus: {}, br: {}, gen: {}, iters: 0, converged: true };
  for (const isl of islands(net, brs)) {
    const ctl = controls(net, isl);
    const idx = isl.map(id => at.get(id));
    const vset = Object.fromEntries(net.buses.map(b => [b.id, b.v_set]));
    for (const id of isl) if (id === ctl.slack || ctl.pv.has(id)) V[at.get(id)] = vset[id];
    const pvpq = isl.filter(id => id !== ctl.slack), pq = isl.filter(id => id !== ctl.slack && !ctl.pv.has(id));
    const sched = Object.fromEntries(isl.map(id => [id, scheduled(net, id)]));
    const PQ = i => {
      let p = 0, q = 0;
      for (const k of idx) {
        const t = T[i] - T[k];
        p += V[i] * V[k] * (G[i][k] * Math.cos(t) + B[i][k] * Math.sin(t));
        q += V[i] * V[k] * (G[i][k] * Math.sin(t) - B[i][k] * Math.cos(t));
      }
      return [p, q];
    };
    let it = 0;
    for (; it < maxIter; it++) {
      const calc = new Map(isl.map(id => [id, PQ(at.get(id))]));
      const F = [...pvpq.map(id => calc.get(id)[0] - sched[id][0]), ...pq.map(id => calc.get(id)[1] - sched[id][1])];
      if (!F.length || Math.max(...F.map(Math.abs)) < tol) break;
      const cols = [...pvpq.map(id => ['t', at.get(id)]), ...pq.map(id => ['v', at.get(id)])];
      const rows = [...pvpq.map(id => ['p', at.get(id)]), ...pq.map(id => ['q', at.get(id)])];
      const J = rows.map(([rk, i]) => cols.map(([ck, k]) => {
        const [Pi, Qi] = calc.get(ids[i]);
        if (i === k) {
          if (rk === 'p' && ck === 't') return -Qi - B[i][i] * V[i] * V[i];
          if (rk === 'p' && ck === 'v') return Pi / V[i] + G[i][i] * V[i];
          if (rk === 'q' && ck === 't') return Pi - G[i][i] * V[i] * V[i];
          return Qi / V[i] - B[i][i] * V[i];
        }
        const t = T[i] - T[k];
        if (rk === 'p' && ck === 't') return V[i] * V[k] * (G[i][k] * Math.sin(t) - B[i][k] * Math.cos(t));
        if (rk === 'p' && ck === 'v') return V[i] * (G[i][k] * Math.cos(t) + B[i][k] * Math.sin(t));
        if (rk === 'q' && ck === 't') return -V[i] * V[k] * (G[i][k] * Math.cos(t) + B[i][k] * Math.sin(t));
        return V[i] * (G[i][k] * Math.sin(t) - B[i][k] * Math.cos(t));
      }));
      const dx = solveDense(J, F.map(f => -f));
      cols.forEach(([ck, k], m) => { if (ck === 't') T[k] += dx[m]; else V[k] += dx[m]; });
    }
    out.iters = Math.max(out.iters, it);
    if (it >= maxIter) out.converged = false;
    // What each bus takes in, and the slack and PV units' share of it.
    for (const id of isl) {
      const i = at.get(id), [p, q] = PQ(i);
      out.bus[id] = { v: V[i], ang: T[i] * 180 / Math.PI, p, q };
    }
    const devQ = id => { let q = 0; for (const s of net.stores) if (s.bus === id) q += s.q; for (const l of net.loads) if (l.bus === id) q -= l.q; for (const g of net.gens) if (g.bus === id && g.control === 'PQ') q += g.q; return q; };
    const devP = id => { let p = 0; for (const s of net.stores) if (s.bus === id) p += s.p; for (const l of net.loads) if (l.bus === id) p -= l.p;
      for (const k of net.links) { if (k.b0 === id) p -= k.p; if (k.b1 === id) p += k.p * k.eff; } for (const g of net.gens) if (g.bus === id && g !== ctl.slackGen) p += g.p; return p; };
    if (ctl.slackGen) out.gen[ctl.slackGen.id] = { p: out.bus[ctl.slack].p - devP(ctl.slack), q: out.bus[ctl.slack].q - devQ(ctl.slack) };
    for (const id of ctl.pv) {
      const holders = net.gens.filter(g => g.bus === id && g !== ctl.slackGen && g.control !== 'PQ');
      // PyPSA gives a PV bus's reactive power to its first PV unit.
      if (holders[0]) out.gen[holders[0].id] = { p: holders[0].p, q: out.bus[id].q - devQ(id) };
    }
  }
  for (const br of brs) {
    const i = at.get(br.b0), j = at.get(br.b1);
    const v0 = polar(V[i], T[i]), v1 = polar(V[j], T[j]);
    const s0 = mul(v0, conj(add(mul(br.Y00, v0), mul(br.Y01, v1))));
    const s1 = mul(v1, conj(add(mul(br.Y10, v0), mul(br.Y11, v1))));
    out.br[br.id] = { p0: s0[0], q0: s0[1], p1: s1[0], q1: s1[1] };
  }
  return out;
}

/* ── DC: the linear load flow ── */
export function dcFlow(net) {
  const brs = branches(net);
  const ids = net.buses.map(b => b.id), at = new Map(ids.map((id, i) => [id, i])), n = ids.length;
  const T = new Float64Array(n);
  const out = { bus: {}, br: {} };
  for (const isl of islands(net, brs)) {
    const ctl = controls(net, isl);
    const rest = isl.filter(id => id !== ctl.slack), pos = new Map(rest.map((id, k) => [id, k]));
    const vn = Object.fromEntries(net.buses.map(b => [b.id, b.v_nom]));
    const shuntP = id => net.shunts.filter(s => s.bus === id).reduce((a, s) => a + s.g * vn[id] ** 2, 0);
    const Bm = rest.map(() => new Array(rest.length).fill(0)), P = rest.map(id => scheduled(net, id)[0] - shuntP(id));
    for (const br of brs) {
      if (!isl.includes(br.b0)) continue;
      const b = 1 / br.xdc, a = pos.get(br.b0), d = pos.get(br.b1);
      if (a !== undefined) { Bm[a][a] += b; if (d !== undefined) Bm[a][d] -= b; P[a] += b * br.phi; }
      if (d !== undefined) { Bm[d][d] += b; if (a !== undefined) Bm[d][a] -= b; P[d] -= b * br.phi; }
    }
    const th = rest.length ? solveDense(Bm, P) : [];
    rest.forEach((id, k) => { T[at.get(id)] = th[k]; });
  }
  for (const br of brs) {
    const p0 = (T[at.get(br.b0)] - T[at.get(br.b1)] - br.phi) / br.xdc;
    out.br[br.id] = { p0, p1: -p0 };
  }
  for (const id of ids) out.bus[id] = { v: 1, ang: T[at.get(id)] * 180 / Math.PI };
  return out;
}
