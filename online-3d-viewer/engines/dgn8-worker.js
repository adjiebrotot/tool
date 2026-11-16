/* Reads a MicroStation V8 DGN in a worker, with cadkit (cadkit-wasm, MIT or
   Apache-2.0, https://github.com/TNYCL/cadkit) compiled to WebAssembly, and
   turns its drawing into plain arrays the page can draw.

   V8 files keep their elements inside an OLE compound file in a format
   Bentley never published; cadkit reads it into a format-neutral document
   (models, levels, entities; schema docs/schema/document-v1.schema.json).
   Here the design model's entities become:

   - lines: every line, line string, shape, arc, circle, ellipse, B-spline
     and wire face, stroked into segments;
   - triangles: filled faces, meshes and filled shapes (polygons);

   grouped by level and colour. Cells and shared cells are placed first
   (explodeInserts), complex chains and shapes are walked into. Text,
   dimensions' words, hatch patterns, images and points are counted, not
   drawn. In a worker, so a large or hostile file never freezes the page, and
   a WebAssembly trap only costs this worker (the page makes a new one).

   in:  { id, buffer, base }   (base: the cadkit-wasm package URL, pinned)
   out: { id, ok, result } or { id, ok: false, error: 'download-failed' | 'read-failed' | message } */

let lib = null;

async function library(base) {
  if (!lib) {
    lib = (async () => {
      const mod = await import(base + 'web/cadkit_wasm.js');
      await mod.default({ module_or_path: base + 'web/cadkit_wasm_bg.wasm' });
      return mod;
    })().catch(e => { lib = null; throw e; });
  }
  return lib;
}

self.onmessage = async e => {
  const { id, buffer, base } = e.data;
  let mod;
  try { mod = await library(base); } catch (err) { self.postMessage({ id, ok: false, error: 'download-failed' }); return; }
  let doc = null;
  try {
    const bytes = new Uint8Array(buffer);
    const kind = mod.detect(bytes);
    if (kind !== 'dgn_v8' && kind !== 'dgn_v7') { self.postMessage({ id, ok: false, error: 'not-dgn' }); return; }
    doc = mod.read(bytes, { maxInputBytes: 512 * 2 ** 20, maxObjects: 5e6 });
    try { doc.explodeInserts(); } catch (err) { /* cells stay as they are; their placed copies are skipped */ }
    const info = doc.info();
    const json = doc.toJSON();
    const warnings = (doc.warnings() || []).length;
    const result = flatten(json, info);
    result.readerWarnings = warnings;
    const transfer = [];
    for (const g of result.groups) { transfer.push(g.lines.buffer, g.tris.buffer); }
    self.postMessage({ id, ok: true, result }, transfer);
  } catch (err) {
    const k = err && err.kind;
    self.postMessage({ id, ok: false, error: k === 'unknown_format' || k === 'invalid' || k === 'truncated' || k === 'unsupported' ? 'read-failed' : String(err && err.message || err), detail: String(err && err.message || err) });
  } finally {
    if (doc) try { doc.free(); } catch (err) { /* already gone */ }
  }
};

// ── The document as segments and triangles ───────────────────────────────

function flatten(json, info) {
  const models = json.models || [];
  // The first design model (V8 files may also hold sheets); else the first.
  const model = models.find(m => m.kind === 'model' && (m.entities || []).length) || models.find(m => (m.entities || []).length) || models[0];
  const layers = new Map((json.layers || []).map(l => [l.name, l]));
  const out = { groups: [], texts: 0, skipped: 0, hidden: 0, otherModels: 0, modelName: model ? model.name : '', is3d: !!(model && model.is_3d),
    unit: info && info.units, metersPerUnit: info ? info.metersPerUnit : null };
  if (!model) return out;
  out.otherModels = models.filter(m => m !== model && m.kind === 'model' && (m.entities || []).length).length;

  const bins = new Map();   // "level\u0000r,g,b" → { level, rgb, lines: [], tris: [] }
  const bin = (level, rgb) => {
    const k = level + '\u0000' + (rgb ? rgb.join(',') : '');
    let b = bins.get(k);
    if (!b) bins.set(k, b = { level, rgb, lines: [], tris: [] });
    return b;
  };
  const rgbOf = (colour, layerName, inherited) => {
    if (!colour) return inherited;
    if (colour.type === 'rgb') return [colour.r, colour.g, colour.b];
    if (colour.type === 'by_layer') { const l = layers.get(layerName); return l && l.color && l.color.type === 'rgb' ? [l.color.r, l.color.g, l.color.b] : inherited; }
    if (colour.type === 'by_block') return inherited;
    if (colour.type === 'aci') return aci(colour.index);
    return inherited;
  };
  const P = p => [p.x || 0, p.y || 0, p.z || 0];
  const seg = (b, pts, closed) => {
    for (let i = 0; i + 1 < pts.length; i++) b.lines.push(...pts[i], ...pts[i + 1]);
    if (closed && pts.length > 2) b.lines.push(...pts[pts.length - 1], ...pts[0]);
  };
  const tri = (b, a, c, d) => b.tris.push(...a, ...c, ...d);

  const walk = (ent, inheritedLevel, inheritedRgb) => {
    if (!ent || ent.visible === false) { out.hidden++; return; }
    const level = ent.layer || inheritedLevel || 'Default';
    const lay = layers.get(level);
    if (lay && (lay.visible === false || lay.frozen)) { out.hidden++; return; }
    const rgb = rgbOf(ent.color, level, inheritedRgb);
    const k = ent.kind || {};
    const b = () => bin(level, rgb);
    switch (k.type) {
      case 'line': seg(b(), [P(k.start), P(k.end)]); break;
      case 'polyline': seg(b(), polyline(k), false); break;
      case 'circle': seg(b(), conic(P(k.center), k.normal, k.radius, k.radius, null, 0, 2 * Math.PI), false); break;
      case 'arc': {
        let e = k.end_angle;
        while (e <= k.start_angle) e += 2 * Math.PI;
        seg(b(), conic(P(k.center), k.normal, k.radius, k.radius, null, k.start_angle, e), false);
        break;
      }
      case 'ellipse': {
        const maj = P(k.major_axis), a = Math.hypot(...maj);
        let e = k.end_param;
        while (e <= k.start_param) e += 2 * Math.PI;
        seg(b(), conic(P(k.center), k.normal, a, a * k.ratio, maj, k.start_param, e), false);
        break;
      }
      case 'spline': seg(b(), spline(k), false); break;
      case 'face': {
        const pts = (k.points || []).map(P);
        if (k.filled && pts.length >= 3) { tri(b(), pts[0], pts[1], pts[2]); if (pts.length === 4) tri(b(), pts[0], pts[2], pts[3]); }
        else seg(b(), pts, true);
        break;
      }
      case 'polygon': {
        seg(b(), (k.exterior || []).map(P), false);
        for (const ring of k.interiors || []) seg(b(), ring.map(P), false);
        break;
      }
      case 'mesh': {
        const v = (k.vertices || []).map(P);
        for (const f of k.faces || []) for (let i = 1; i + 1 < f.length; i++) if (v[f[0]] && v[f[i]] && v[f[i + 1]]) tri(b(), v[f[0]], v[f[i]], v[f[i + 1]]);
        break;
      }
      case 'leader': seg(b(), (k.vertices || []).map(P), false); break;
      case 'group': for (const c of k.children || []) walk(c, level, rgb); break;
      case 'text': case 'm_text': out.texts++; break;
      case 'dimension': out.skipped++; break;
      case 'hatch': out.skipped++; break;
      default: out.skipped++; break;
    }
  };
  for (const ent of model.entities || []) walk(ent, null, null);

  // Kept relative to a corner when far from the origin (map coordinates),
  // so 32-bit floats do not round the drawing; the page moves the group back.
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const b of bins.values()) for (const arr of [b.lines, b.tris]) for (let i = 0; i < arr.length; i++) {
    const a = i % 3;
    if (arr[i] < lo[a]) lo[a] = arr[i];
    if (arr[i] > hi[a]) hi[a] = arr[i];
  }
  const span = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2], 1e-9);
  const far = lo.every(Number.isFinite) && Math.max(...lo.map(Math.abs)) >= 4 * span;
  const anchor = far ? lo : [0, 0, 0];
  out.anchor = anchor;
  for (const b of bins.values()) {
    const shift = arr => { const f = new Float32Array(arr.length); for (let i = 0; i < arr.length; i++) f[i] = arr[i] - anchor[i % 3]; return f; };
    out.groups.push({ level: b.level, rgb: b.rgb, lines: shift(b.lines), tris: shift(b.tris) });
  }
  return out;
}

/* A polyline's points, with each bulged segment (an arc: bulge = tan of a
   quarter of its angle, turning anticlockwise about the normal) stroked. */
function polyline(k) {
  const vs = k.vertices || [];
  const n = k.normal || { x: 0, y: 0, z: 1 };
  const flat = Math.abs(n.x) < 1e-12 && Math.abs(n.y) < 1e-12;
  const pts = [];
  const count = k.closed ? vs.length : vs.length - 1;
  for (let i = 0; i < vs.length; i++) {
    const p = vs[i].position;
    pts.push([p.x, p.y, p.z || 0]);
    if (i >= count) continue;
    const bulge = vs[i].bulge || 0;
    if (!bulge || !flat) continue;
    const q = vs[(i + 1) % vs.length].position;
    const sign = n.z < 0 ? -1 : 1;
    const theta = 4 * Math.atan(bulge) * sign;
    const dx = q.x - p.x, dy = q.y - p.y, chord = Math.hypot(dx, dy);
    if (!chord) continue;
    const r = chord / (2 * Math.sin(theta / 2));
    // Centre: from the chord's middle, along its left normal.
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2, h = r * Math.cos(theta / 2);
    const cx = mx - dy / chord * h, cy = my + dx / chord * h;
    const a0 = Math.atan2(p.y - cy, p.x - cx);
    const steps = Math.max(2, Math.ceil(Math.abs(theta) / (2 * Math.PI) * 64));
    for (let s = 1; s < steps; s++) {
      const t = a0 + theta * s / steps, z = (p.z || 0) + ((q.z || 0) - (p.z || 0)) * s / steps;
      pts.push([cx + Math.abs(r) * Math.cos(t), cy + Math.abs(r) * Math.sin(t), z]);
    }
  }
  if (k.closed && vs.length > 2) pts.push(pts[0].slice());
  return pts;
}

/* An arc of a circle or ellipse in the plane of `normal`: X along the major
   axis (or the arbitrary axis CAD files use for circles), Y = normal × X. */
function conic(c, normal, a, b, majorDir, t0, t1) {
  const n = unit(normal ? [normal.x, normal.y, normal.z] : [0, 0, 1]) || [0, 0, 1];
  let x = majorDir ? unit(majorDir) : arbitraryAxis(n);
  const y = cross(n, x);
  const steps = Math.max(8, Math.ceil(Math.abs(t1 - t0) / (2 * Math.PI) * 96));
  const pts = [];
  for (let s = 0; s <= steps; s++) {
    const t = t0 + (t1 - t0) * s / steps, ca = a * Math.cos(t), sb = b * Math.sin(t);
    pts.push([c[0] + ca * x[0] + sb * y[0], c[1] + ca * x[1] + sb * y[1], c[2] + ca * x[2] + sb * y[2]]);
  }
  return pts;
}
function unit(v) { const l = Math.hypot(v[0], v[1], v[2]); return l > 0 ? [v[0] / l, v[1] / l, v[2] / l] : null; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
// The "arbitrary axis" rule of DWG / DXF, which cadkit's neutral model follows for circles.
function arbitraryAxis(n) {
  const w = Math.abs(n[0]) < 1 / 64 && Math.abs(n[1]) < 1 / 64 ? cross([0, 1, 0], n) : cross([0, 0, 1], n);
  return unit(w) || [1, 0, 0];
}

/* A B-spline (rational when it has weights) on its own knots, by de Boor;
   with no knots, clamped uniform ones; with only fit points, through them. */
function spline(k) {
  const P = (k.control_points || []).map(p => [p.x, p.y, p.z || 0]);
  if (P.length < 2) return (k.fit_points || []).map(p => [p.x, p.y, p.z || 0]);
  const deg = Math.max(1, Math.min(k.degree || 3, P.length - 1));
  const n = P.length;
  let U = (k.knots || []).slice();
  if (U.length !== n + deg + 1) {
    U = [];
    for (let i = 0; i <= deg; i++) U.push(0);
    for (let i = 1; i < n - deg; i++) U.push(i);
    for (let i = 0; i <= deg; i++) U.push(n - deg);
  }
  const W = (k.weights || []).length === n ? k.weights : null;
  const lo = U[deg], hi = U[n];
  const steps = Math.max(24, (n - deg) * 16);
  const out = [];
  for (let s = 0; s <= steps; s++) {
    const t = Math.min(lo + (hi - lo) * s / steps, hi - 1e-12 * Math.max(1, Math.abs(hi)));
    let span = deg;
    while (span < n - 1 && t >= U[span + 1]) span++;
    const d = [];
    for (let j = 0; j <= deg; j++) {
      const i = span - deg + j, w = W ? W[i] : 1;
      d.push([P[i][0] * w, P[i][1] * w, P[i][2] * w, w]);
    }
    for (let r = 1; r <= deg; r++) {
      for (let j = deg; j >= r; j--) {
        const i = span - deg + j;
        const den = U[i + deg - r + 1] - U[i];
        const a = den ? (t - U[i]) / den : 0;
        for (let c = 0; c < 4; c++) d[j][c] = (1 - a) * d[j - 1][c] + a * d[j][c];
      }
    }
    const h = d[deg];
    out.push([h[0] / h[3], h[1] / h[3], h[2] / h[3]]);
  }
  return out;
}

/* AutoCAD colour index, for the rare entity that carries one (cadkit turns
   DGN colour indices into RGB itself): the seven named colours, greys, and
   an even spread of hues for the rest. */
function aci(i) {
  const named = [null, [255, 0, 0], [255, 255, 0], [0, 255, 0], [0, 255, 255], [0, 0, 255], [255, 0, 255], [255, 255, 255], [128, 128, 128], [192, 192, 192]];
  if (named[i]) return named[i];
  if (i >= 250) { const g = Math.round(51 + (i - 250) * 40.8); return [g, g, g]; }
  const h = ((i - 10) / 240) * 360, f = x => { const k = (x + h / 60) % 6; return Math.round(255 * (1 - Math.max(0, Math.min(k, 4 - k, 1)))); };
  return [f(5), f(3), f(1)];
}
