/* What a ruler point can lock onto, read from a part's own geometry.

   A part's triangles (or line segments) are read once, the first time the
   pointer comes near it, into a snap index in the part's own axes:

   - its edges: where two faces of a CAD file (B-rep faces, from OpenCascade)
     meet, where neighbouring triangles turn by more than 30° (as the Edges
     view draws them), and the open borders of a surface; plus every segment
     of a line part;
   - those edges chained and split into runs: straight edges (two ends and a
     midpoint) and arcs or full circles (a centre and a radius, and an arc's
     midpoint on the curve), the way a CAD program sees the edges a
     tessellated model only approximates;
   - its flat faces (a CAD face, or the triangles an edge closes in), with the
     centre of each face's area and of every hole or boss outline inside one.

   Measure (measure.js) asks for the targets near the pointer and picks
   among them. Nothing here depends on the view. */

import * as THREE from 'three';

const DEG = Math.PI / 180;
const FEATURE_COS = Math.cos(30 * DEG);   // neighbouring triangles turning more than this meet at an edge
const TURN_COS = Math.cos(40 * DEG);      // a chain turning more than this at a point has a corner there
const FLAT_COS = Math.cos(1 * DEG);       // a face whose triangles all face within this of each other is flat
const MAX_TRIS = 1.5e6;                   // bigger parts keep only the corners of the triangle under the pointer
const MAX_PIECE = 3000;
const MIN_SWEEP = 25 * DEG;               // a shorter arc is too little of a circle to trust its centre                   // a longer chain between corners is not searched for arcs

// Kinds of snap point.
export const CORNER = 1, END = 2, MID = 3, CENTRE = 4;

const cache = new WeakMap();   // geometry → index (null: nothing to snap to, or too big)

/** The snap index of a Mesh or Line, built on first use and kept with its geometry. */
export function snapIndex(o) {
  const g = o.geometry;
  if (!g || !g.getAttribute('position')) return null;
  let idx = cache.get(g);
  if (idx === undefined) {
    try { idx = o.isMesh ? fromMesh(g) : o.isLine ? fromLine(o) : null; } catch (e) { idx = null; }
    cache.set(g, idx);
  }
  return idx;
}

// ── Reading the geometry ────────────────────────────────────────────────

/* Positions that are the same point, however the file repeats them (a CAD
   file stores each face's corners again), get one id. */
function weld(pos) {
  const n = pos.count;
  let ext = 0;
  for (let i = 0; i < n; i++) ext = Math.max(ext, Math.abs(pos.getX(i)), Math.abs(pos.getY(i)), Math.abs(pos.getZ(i)));
  const q = Math.max(ext, 1e-30) * 2e-6;
  // An open-addressed hash on the rounded coordinates (a Map of strings is ten times slower).
  let size = 16;
  while (size < n * 2) size *= 2;
  const mask = size - 1, table = new Int32Array(size).fill(-1);
  const Q = new Int32Array(n * 3), P = new Float64Array(n * 3), id = new Int32Array(n);
  let u = 0;
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const qx = Math.round(x / q) | 0, qy = Math.round(y / q) | 0, qz = Math.round(z / q) | 0;
    let h = (Math.imul(qx, 73856093) ^ Math.imul(qy, 19349663) ^ Math.imul(qz, 83492791)) & mask;
    let j;
    for (;;) {
      j = table[h];
      if (j < 0) { j = u++; table[h] = j; Q[j * 3] = qx; Q[j * 3 + 1] = qy; Q[j * 3 + 2] = qz; P[j * 3] = x; P[j * 3 + 1] = y; P[j * 3 + 2] = z; break; }
      if (Q[j * 3] === qx && Q[j * 3 + 1] === qy && Q[j * 3 + 2] === qz) break;
      h = (h + 1) & mask;
    }
    id[i] = j;
  }
  return { id, P: P.slice(0, u * 3), n: u, ext: Math.max(ext, 1e-30) };
}

function fromMesh(g) {
  const pos = g.getAttribute('position');
  const index = g.index;
  const T = Math.floor((index ? index.count : pos.count) / 3);
  if (!T || T > MAX_TRIS) return null;
  const W = weld(pos), P = W.P;
  const tri = new Int32Array(T * 3), N = new Float64Array(T * 3), area = new Float64Array(T);
  const tiny = (W.ext * 1e-9) ** 2;
  for (let t = 0; t < T; t++) {
    for (let k = 0; k < 3; k++) tri[t * 3 + k] = W.id[index ? index.getX(t * 3 + k) : t * 3 + k];
    const a = tri[t * 3] * 3, b = tri[t * 3 + 1] * 3, c = tri[t * 3 + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    area[t] = l / 2;
    if (l * l > tiny) { N[t * 3] = nx / l; N[t * 3 + 1] = ny / l; N[t * 3 + 2] = nz / l; }
    else area[t] = 0;   // a sliver with no area: no edges, no face
  }

  // The CAD faces each triangle belongs to (OpenCascade's ranges), if the file had them.
  let cadFace = null;
  const ranges = g.userData && g.userData.o3vFaces;
  if (ranges && ranges.length) {
    cadFace = new Int32Array(T).fill(-1);
    for (let f = 0; f + 1 < ranges.length; f += 2) for (let t = Math.max(0, ranges[f]); t <= Math.min(T - 1, ranges[f + 1]); t++) cadFace[t] = f / 2;
  }

  // Every edge, and the triangles on each side.
  let size = 16;
  while (size < T * 6) size *= 2;
  const mask = size - 1, table = new Int32Array(size).fill(-1);
  const eA = new Int32Array(T * 3), eB = new Int32Array(T * 3), eT1 = new Int32Array(T * 3), eT2 = new Int32Array(T * 3), eN = new Int32Array(T * 3);
  let E = 0;
  for (let t = 0; t < T; t++) {
    if (!area[t]) continue;
    for (let k = 0; k < 3; k++) {
      let a = tri[t * 3 + k], b = tri[t * 3 + (k + 1) % 3];
      if (a === b) continue;
      if (a > b) { const s = a; a = b; b = s; }
      let h = (Math.imul(a, 0x9E3779B1) ^ Math.imul(b, 0x85EBCA77)) & mask;
      for (;;) {
        const e = table[h];
        if (e < 0) { table[h] = E; eA[E] = a; eB[E] = b; eT1[E] = t; eT2[E] = -1; eN[E] = 1; E++; break; }
        if (eA[e] === a && eB[e] === b) { if (eN[e] === 1) eT2[e] = t; eN[e]++; break; }
        h = (h + 1) & mask;
      }
    }
  }
  const isEdge = new Uint8Array(E);
  for (let e = 0; e < E; e++) {
    if (eN[e] !== 2) { isEdge[e] = 1; continue; }
    const t1 = eT1[e], t2 = eT2[e];
    if (cadFace && cadFace[t1] !== cadFace[t2]) { isEdge[e] = 1; continue; }
    const d = N[t1 * 3] * N[t2 * 3] + N[t1 * 3 + 1] * N[t2 * 3 + 1] + N[t1 * 3 + 2] * N[t2 * 3 + 2];
    if (d < FEATURE_COS) isEdge[e] = 1;
  }

  // Faces: triangles joined across everything that is not an edge.
  const parent = new Int32Array(T);
  for (let t = 0; t < T; t++) parent[t] = t;
  const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (let e = 0; e < E; e++) if (!isEdge[e]) { const a = find(eT1[e]), b = find(eT2[e]); if (a !== b) parent[a] = b; }
  const face = new Int32Array(T).fill(-1);
  const roots = new Map();
  for (let t = 0; t < T; t++) {
    if (!area[t]) continue;
    const r = find(t);
    let f = roots.get(r);
    if (f === undefined) { f = roots.size; roots.set(r, f); }
    face[t] = f;
  }
  const F = roots.size;
  const fA = new Float64Array(F), fN = new Float64Array(F * 3), fC = new Float64Array(F * 3);
  for (let t = 0; t < T; t++) {
    const f = face[t];
    if (f < 0) continue;
    const A = area[t];
    fA[f] += A;
    for (let k = 0; k < 3; k++) {
      fN[f * 3 + k] += N[t * 3 + k] * A;
      fC[f * 3 + k] += A * (P[tri[t * 3] * 3 + k] + P[tri[t * 3 + 1] * 3 + k] + P[tri[t * 3 + 2] * 3 + k]) / 3;
    }
  }
  const flat = new Uint8Array(F).fill(1);
  for (let f = 0; f < F; f++) {
    const l = Math.hypot(fN[f * 3], fN[f * 3 + 1], fN[f * 3 + 2]);
    if (!(fA[f] > 0) || !(l > 0)) { flat[f] = 0; continue; }
    for (let k = 0; k < 3; k++) { fN[f * 3 + k] /= l; fC[f * 3 + k] /= fA[f]; }
  }
  for (let t = 0; t < T; t++) {
    const f = face[t];
    if (f < 0 || !flat[f]) continue;
    const d = N[t * 3] * fN[f * 3] + N[t * 3 + 1] * fN[f * 3 + 1] + N[t * 3 + 2] * fN[f * 3 + 2];
    if (d < FLAT_COS) flat[f] = 0;
  }

  const edges = [];
  for (let e = 0; e < E; e++) if (isEdge[e]) edges.push(eA[e], eB[e]);
  const idx = assemble(P, W.ext, edges, cadFace != null);
  idx.face = face;
  idx.faces = { n: F, flat, normal: fN, centre: fC };

  // Holes and bosses: the outlines inside a flat face, each with its centre
  // (a round one is already a circle; a square or slotted one is found here).
  const border = new Map();   // face → its edges
  for (let e = 0; e < E; e++) {
    if (!isEdge[e]) continue;
    const t1 = eT1[e], t2 = eT2[e];
    for (const t of t2 >= 0 && face[t2] !== face[t1] ? [t1, t2] : [t1]) {
      if (face[t] < 0 || !flat[face[t]]) continue;
      let list = border.get(face[t]);
      if (!list) border.set(face[t], list = []);
      list.push(eA[e], eB[e]);
    }
  }
  for (const [f, list] of border) {
    const loops = chains(list).list.filter(c => c.closed && c.ids.length > 3);
    if (loops.length < 2) continue;
    const nrm = [fN[f * 3], fN[f * 3 + 1], fN[f * 3 + 2]];
    const out = loops.map(c => outline(P, c.ids, nrm)).filter(Boolean);
    if (out.length < 2) continue;
    out.sort((a, b) => b.area - a.area);   // the biggest is the face's outside
    for (const o of out.slice(1)) idx.addLoop(o.centre, o.ids);
  }
  return idx.finish();
}

function fromLine(o) {
  const g = o.geometry, pos = g.getAttribute('position');
  const count = g.index ? g.index.count : pos.count;
  if (count < 2 || count > MAX_TRIS * 3) return null;
  const W = weld(pos);
  const at = i => W.id[g.index ? g.index.getX(i) : i];
  const edges = [];
  if (o.isLineSegments) for (let i = 0; i + 1 < count; i += 2) edges.push(at(i), at(i + 1));
  else {
    for (let i = 0; i + 1 < count; i++) edges.push(at(i), at(i + 1));
    if (o.isLineLoop) edges.push(at(count - 1), at(0));
  }
  const seen = new Set(), unique = [];
  for (let i = 0; i < edges.length; i += 2) {
    let a = edges[i], b = edges[i + 1];
    if (a === b) continue;
    if (a > b) { const s = a; a = b; b = s; }
    const k = a * W.n + b;
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(a, b);
  }
  return assemble(W.P, W.ext, unique, false).finish();
}

// ── Chains and runs ──────────────────────────────────────────────────────

/* Edges (pairs of welded ids) into chains: a chain runs between points
   where more or fewer than two edges meet, or round a closed loop. */
function chains(edges) {
  const S = edges.length / 2;
  const adj = new Map();
  for (let s = 0; s < S; s++) for (const v of [edges[s * 2], edges[s * 2 + 1]]) {
    let l = adj.get(v);
    if (!l) adj.set(v, l = []);
    l.push(s);
  }
  const used = new Uint8Array(S), out = [];
  const walk = (v0, s0) => {
    const ids = [v0];
    let v = v0, s = s0;
    for (;;) {
      used[s] = 1;
      v = edges[s * 2] === v ? edges[s * 2 + 1] : edges[s * 2];
      ids.push(v);
      const l = adj.get(v);
      if (l.length !== 2 || v === v0) break;
      const next = l[0] === s ? l[1] : l[0];
      if (used[next]) break;
      s = next;
    }
    return { ids, closed: ids.length > 2 && ids[0] === ids[ids.length - 1] };
  };
  for (const [v, l] of adj) if (l.length !== 2) for (const s of l) if (!used[s]) out.push(walk(v, s));
  for (let s = 0; s < S; s++) if (!used[s]) out.push(walk(edges[s * 2], s));
  return { list: out, adj };
}

class Index {
  constructor(P, ext, cad) {
    this.P = P;
    this.ext = ext;
    this.cad = cad;          // the faces are a CAD file's own: the mesh's inner corners mean nothing
    this.runs = [];          // { kind: 'line' | 'arc' | 'circle' | 'loop', pts: [x,y,z,…], centre?, normal?, r? }
    this.sp = [];            // snap points: x, y, z
    this.spKind = [];
    this.spRun = [];
    this.seg = [];           // edge segments: ax, ay, az, bx, by, bz
    this.segRun = [];
    this._seen = new Map();  // welded id or position → snap point
  }

  point(x, y, z, kind, run, key) {
    if (key == null) key = 'p' + Math.round(x / this.ext * 1e6) + ',' + Math.round(y / this.ext * 1e6) + ',' + Math.round(z / this.ext * 1e6) + ':' + kind;
    const had = this._seen.get(key);
    if (had != null) {
      if (kind < this.spKind[had]) this.spKind[had] = kind;   // a corner outranks an end
      return had;
    }
    const i = this.spKind.length;
    this._seen.set(key, i);
    this.sp.push(x, y, z);
    this.spKind.push(kind);
    this.spRun.push(run);
    return i;
  }

  run(r) { this.runs.push(r); return this.runs.length - 1; }

  addLoop(centre, ids) {
    const pts = [];
    for (const v of ids) pts.push(this.P[v * 3], this.P[v * 3 + 1], this.P[v * 3 + 2]);
    const ri = this.run({ kind: 'loop', pts, centre });
    this.point(centre[0], centre[1], centre[2], CENTRE, ri);
  }

  finish() {
    this.sp = Float64Array.from(this.sp);
    this.spKind = Uint8Array.from(this.spKind);
    this.spRun = Int32Array.from(this.spRun);
    this.seg = Float64Array.from(this.seg);
    this.segRun = Int32Array.from(this.segRun);
    this._seen = null;
    return this;
  }
}

function assemble(P, ext, edges, cad) {
  const idx = new Index(P, ext, cad);
  const ch = chains(edges);
  const V = i => new THREE.Vector3(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
  for (const c of ch.list) {
    const ids = c.ids.slice(), pts = ids.map(V);
    const runs = splitChain(pts, ids, c.closed, ext);
    for (const r of runs) {
      const seq = pts.slice(r.i, r.j + 1);
      const flat = [];
      for (const p of seq) flat.push(p.x, p.y, p.z);
      const run = { kind: r.kind, pts: flat };
      if (r.circle) { run.centre = r.circle.c.toArray(); run.normal = r.circle.n.toArray(); run.r = r.circle.r; }
      const ri = idx.run(run);
      for (let k = 0; k + 1 < seq.length; k++) {
        idx.seg.push(seq[k].x, seq[k].y, seq[k].z, seq[k + 1].x, seq[k + 1].y, seq[k + 1].z);
        idx.segRun.push(ri);
      }
      if (r.kind !== 'circle') {
        // The two ends: a corner where edges meet or the chain turns, else the end of a run.
        for (const k of [r.i, r.j]) {
          const at = ids[k], deg = ch.adj.get(at).length;
          const corner = deg >= 3 || (deg === 2 && turnsAt(pts, k, c.closed));
          idx.point(P[at * 3], P[at * 3 + 1], P[at * 3 + 2], corner ? CORNER : END, ri, 'v' + at);
        }
        const m = r.kind === 'line' ? seq[0].clone().add(seq[seq.length - 1]).multiplyScalar(0.5) : arcMid(seq, r.circle);
        idx.point(m.x, m.y, m.z, MID, ri);
      }
      if (r.circle) idx.point(run.centre[0], run.centre[1], run.centre[2], CENTRE, ri);
    }
  }
  return idx;
}

/* Does the chain turn sharply at point k (a corner between two runs)? */
function turnsAt(pts, k, closed) {
  const n = pts.length - 1;
  let a, b;
  if (k > 0 && k < n) { a = pts[k - 1]; b = pts[k + 1]; }
  else if (closed) { a = pts[n - 1]; b = pts[1]; }
  else return true;
  const u = pts[k].clone().sub(a), w = b.clone().sub(pts[k]);
  const l = u.length() * w.length();
  return !(l > 0) || u.dot(w) / l < TURN_COS;
}

/* A chain of points (closed: the last repeats the first) into straight runs
   and arcs: { kind, i, j, circle? } over pts[i..j]. A closed chain is turned
   (pts and ids together) to start where a run starts. */
function splitChain(pts, ids, closed, ext) {
  const m = pts.length - 1;
  if (m < 1) return [];
  if (closed && m >= 6) {
    const c = arcFit(pts, 0, m, ext, true);
    if (c) return [{ kind: 'circle', i: 0, j: m, circle: c }];
  }
  const turn = k0 => {
    if (k0 <= 0) return;
    for (const arr of [pts, ids]) { const r = arr.slice(k0, m).concat(arr.slice(0, k0 + 1)); arr.splice(0, arr.length, ...r); }
  };
  const pieces = () => {
    const out = [];
    let s = 0;
    for (let k = 1; k <= m; k++) if (k === m || turnsAt(pts, k, false)) { greedy(pts, s, k, ext, out); s = k; }
    return out;
  };
  if (!closed) return pieces();
  // Start at a corner if the loop has one, so no edge is cut in two.
  for (let k = 0; k < m; k++) if (turnsAt(pts, k, true)) { turn(k); return pieces(); }
  // A smooth loop (a slot, an oval): start where the first pass found its last run to start.
  const first = pieces();
  if (first.length < 2) return first;
  turn(first[first.length - 1].i);
  return pieces();
}

function greedy(pts, s, e, ext, out) {
  if (e - s > MAX_PIECE) { for (let i = s; i < e; i++) out.push({ kind: 'line', i, j: i + 1 }); return; }
  let i = s;
  while (i < e) {
    let j = i + 1;
    while (j < e && collinear(pts, i, j + 1, ext)) j++;
    let k = -1, c = null;
    for (let kk = i + 3; kk <= e; kk++) {
      const f = arcFit(pts, i, kk, ext, false);
      if (!f) break;
      k = kk; c = f;
    }
    if (c && c.sweep >= MIN_SWEEP && k > j) { out.push({ kind: 'arc', i, j: k, circle: c }); i = k; }
    else { out.push({ kind: 'line', i, j }); i = j; }
  }
}

function collinear(pts, i, j, ext) {
  const a = pts[i], b = pts[j];
  const d = b.clone().sub(a), L = d.length();
  if (!(L > 0)) return false;
  d.divideScalar(L);
  const tol = L * 1e-4 + ext * 1e-6;
  const w = new THREE.Vector3();
  for (let k = i + 1; k < j; k++) {
    w.subVectors(pts[k], a);
    const t = w.dot(d);
    if (t <= 0 || t >= L || w.addScaledVector(d, -t).length() > tol) return false;
  }
  return true;
}

/* The circle through pts[i..j], if they all lie on one, turning one way and
   evenly enough to be a drawn arc and not a wavy curve. */
function arcFit(pts, i, j, ext, closed) {
  const n = j - i;
  if (n < 3) return null;
  const a = pts[i], b = pts[i + Math.round(n / 3)], c = pts[i + Math.round(2 * n / 3)];
  const circ = circle3(a, b, c);
  if (!circ) return null;
  const { c: C, r: R, n: Nrm } = circ;
  const tol = R * 2e-3 + ext * 2e-6;
  const w = new THREE.Vector3(), u = new THREE.Vector3(), v = new THREE.Vector3();
  let sweep = 0;
  for (let k = i; k <= j; k++) {
    w.subVectors(pts[k], C);
    if (Math.abs(w.dot(Nrm)) > tol || Math.abs(w.length() - R) > tol) return null;
    if (k > i) {
      u.subVectors(pts[k - 1], C); v.subVectors(pts[k], C);
      const ang = Math.atan2(u.clone().cross(v).dot(Nrm), u.dot(v));
      if (!(ang > 0) || ang > 40 * DEG) return null;   // one way round, never a jump
      sweep += ang;
    }
  }
  if (closed ? Math.abs(sweep - 2 * Math.PI) > 1e-3 : sweep > 2 * Math.PI - 1e-6) return null;
  return { c: C, r: R, n: Nrm, sweep };
}

function circle3(a, b, c) {
  const ab = b.clone().sub(a), ac = c.clone().sub(a);
  const n = ab.clone().cross(ac);
  const nn = n.lengthSq();
  if (!(nn > 1e-12 * ab.lengthSq() * ac.lengthSq())) return null;
  const centre = n.clone().cross(ab).multiplyScalar(ac.lengthSq())
    .add(ac.clone().cross(n).multiplyScalar(ab.lengthSq()))
    .divideScalar(2 * nn).add(a);
  const r = centre.distanceTo(a);
  // The normal points the way the arc runs (a → b → c turns counter-clockwise about it).
  return { c: centre, r, n: n.normalize() };
}

function arcMid(seq, circ) {
  const start = seq[0].clone().sub(circ.c);
  return start.applyAxisAngle(circ.n, circ.sweep / 2).add(circ.c);
}

/* A closed outline in a flat face: its area centre, in the face's plane. */
function outline(P, ids, nrm) {
  const N = new THREE.Vector3(...nrm);
  const pts = ids.slice(0, -1).map(i => new THREE.Vector3(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]));
  if (pts.length < 3) return null;
  const o = pts[0];
  let A = 0;
  const C = new THREE.Vector3(), x = new THREE.Vector3();
  for (let k = 1; k + 1 < pts.length; k++) {
    x.subVectors(pts[k], o).cross(new THREE.Vector3().subVectors(pts[k + 1], o));
    const a = x.dot(N) / 2;   // signed: a non-convex outline still adds up
    A += a;
    C.addScaledVector(o.clone().add(pts[k]).add(pts[k + 1]), a / 3);
  }
  if (!(Math.abs(A) > 0)) return null;
  C.divideScalar(A);
  return { area: Math.abs(A), centre: C.toArray(), ids };
}
