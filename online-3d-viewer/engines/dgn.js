/* DGN engine (MicroStation / Intergraph IGDS design files, version 7).

   A V7 design file is a run of elements, each a small header followed by its
   data, read straight from the bytes here: no library. The layout follows the
   IGDS format as Bentley documented it, and as GDAL's dgnlib reads it.

   - Element header: byte 0 the level (low 6 bits) and the complex flag (a
     component of a cell or chain); byte 1 the type (low 7 bits) and the
     deleted flag; bytes 2-3 the words that follow. FF FF ends the file.
   - Integers are 32-bit in "VAX order": two little-endian 16-bit words, the
     high word first. Floating point is VAX D-float.
   - Coordinates are in UORs (units of resolution). The header element (TCB)
     says how many UORs make a sub unit and how many sub units a master unit,
     and where the global origin is; the model is drawn in master units.
   - A file is 3D when its TCB says so (byte 1214, bit 0x40); a 3D element
     carries a Z for every point and orients arcs by a quaternion.

   What is drawn: lines, line strings, shapes, curves, arcs, ellipses,
   B-spline curves (as uniform B-splines), and every component of cells,
   complex chains and shapes, and 3D surfaces and solids (their boundaries).
   Text is not drawn (counted in a note). Everything is lines: a DGN drawing
   is a wireframe. Lines are grouped by level and coloured from the file's
   colour table, or MicroStation's default table when it has none.

   MicroStation V8 files (since 2001) are a different format inside an OLE
   compound file, which Bentley never published. They are read by cadkit
   (WebAssembly, in dgn8-worker.js), downloaded only when one is opened, and
   drawn the same way: levels, colours, lines, plus filled faces and meshes. */

import * as THREE from 'three';
import { requireBytes, ModelError, defaultMaterial, colourMaterial } from './common.js';
import { CADKIT_BASE } from './cdn.js';

// Element types (IGDS).
const T = {
  CELL: 2, LINE: 3, LINE_STRING: 4, COLOR_TABLE_GROUP: 5, SHAPE: 6, TEXT_NODE: 7, TCB: 9,
  CURVE: 11, COMPLEX_CHAIN: 12, COMPLEX_SHAPE: 14, ELLIPSE: 15, ARC: 16, TEXT: 17,
  SURFACE: 18, SOLID: 19, BSPLINE_POLE: 21, BSPLINE_SURFACE: 24, BSPLINE_KNOT: 26, BSPLINE_CURVE: 27, BSPLINE_WEIGHT: 28,
};

const OLE = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];

/** Is this a V7 design file (its first element the 1536-byte TCB)? */
export function isV7(u8) {
  return u8.length >= 4 && (u8[0] === 0x08 || u8[0] === 0xC8) && u8[1] === 0x09 && u8[2] === 0xFE && u8[3] === 0x02;
}
/** Is this an OLE compound file (MicroStation V8 DGN, among others)? */
export function isOle(u8) { return u8.length >= 8 && OLE.every((b, i) => u8[i] === b); }

// MicroStation's default colour table, for files that carry none: the first
// sixteen as MicroStation shows them, the rest a spread of hues in four bands
// of lightness (close to, not exactly, the default table).
function defaultTable() {
  const t = [[255, 255, 255], [0, 0, 255], [0, 255, 0], [255, 0, 0], [255, 255, 0], [255, 0, 255], [255, 127, 0], [0, 255, 255],
    [64, 64, 64], [192, 192, 192], [254, 0, 96], [160, 224, 0], [0, 254, 160], [128, 0, 160], [176, 176, 176], [0, 240, 240]];
  const c = new THREE.Color();
  for (let i = 16; i < 256; i++) {
    const band = Math.floor((i - 16) / 60), k = (i - 16) % 60;
    c.setHSL(k / 60, 0.85, [0.5, 0.35, 0.65, 0.25][band] || 0.5);
    t.push([Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)]);
  }
  return t;
}

const UNIT_NAMES = {
  mm: 'mm', millimeter: 'mm', millimetre: 'mm', cm: 'cm', m: 'm', meter: 'm', metre: 'm', km: 'km',
  in: 'in', '"': 'in', inch: 'in', ft: 'ft', "'": 'ft', feet: 'ft', foot: 'ft', mi: 'mi', um: 'µm', 'µm': 'µm',
};

// ── Reading numbers ──────────────────────────────────────────────────────
const int32 = (u, p) => (u[p + 2] | (u[p + 3] << 8) | (u[p] << 16) | (u[p + 1] << 24));
const uint16 = (u, p) => u[p] | (u[p + 1] << 8);

/** VAX D-float: sign, 8-bit exponent (excess 128), 55-bit fraction with a
    hidden leading bit, in four little-endian words, most significant first. */
export function vaxDouble(u, p) {
  const w0 = uint16(u, p), w1 = uint16(u, p + 2), w2 = uint16(u, p + 4), w3 = uint16(u, p + 6);
  const exp = (w0 >> 7) & 0xFF;
  if (exp === 0) return 0;
  const frac = (w0 & 0x7F) * 2 ** 48 + w1 * 2 ** 32 + w2 * 2 ** 16 + w3;
  const v = (1 + frac / 2 ** 55) * 2 ** (exp - 129);
  return (w0 & 0x8000) ? -v : v;
}

/** Angles are in 1/360000 of a degree. A sweep is sign and magnitude, 0 a full turn. */
const angle = v => v / 360000 * Math.PI / 180;
function sweep(raw) {
  if (raw === 0) return 2 * Math.PI;
  if (raw & 0x80000000) return -angle(raw & 0x7FFFFFFF);
  return angle(raw);
}

/** The rows of an element's rotation, from its quaternion (w, x, y, z as
    fractions of 2^31): row 0 is where the element's own X axis points, row 1
    its Y axis (dgnlib's DGNQuaternionToMatrix). */
function quatRows(u, p) {
  const s = 2 ** 31;
  const w = int32(u, p) / s, x = int32(u, p + 4) / s, y = int32(u, p + 8) / s, z = int32(u, p + 12) / s;
  return [
    [x * x - y * y - z * z + w * w, 2 * (y * w + x * z), 2 * (x * y - z * w)],
    [2 * (x * z - y * w), -x * x + z * z - y * y + w * w, 2 * (x * w + z * y)],
  ];
}

// ── The reader ───────────────────────────────────────────────────────────

/**
 * Reads a V7 design file into plain data: polylines (arrays of [x, y, z] in
 * master units) by level and colour, the colour table, the unit and a count
 * of what was left out. Exported for the audit.
 */
export function readDgn(buffer) {
  const u = new Uint8Array(buffer);
  if (!isV7(u)) throw new ModelError('This is not a MicroStation design file.');
  // 3D: the TCB's flag at byte 1214 (bit 0x40), as dgnlib reads it; the
  // first byte (C8 for 3D) says the same in files that are well made.
  const is3d = u.length > 1214 ? !!(u[1214] & 0x40) : u[0] === 0xC8;
  const N = is3d ? 3 : 2;            // integers per point
  const out = { is3d, unit: null, unitName: '', lines: [], texts: 0, skipped: 0, splines: 0, truncated: false, colours: null };

  let scale = 1, ox = 0, oy = 0, oz = 0;
  const pt = (p, k = 0) => {
    const q = p + k * N * 4;
    return [int32(u, q) * scale - ox, int32(u, q + 4) * scale - oy, is3d ? int32(u, q + 8) * scale - oz : 0];
  };
  const add = (level, colour, points, closed) => {
    if (points.length < 2) return;
    if (closed) {
      const a = points[0], b = points[points.length - 1];
      if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2]) points.push(a.slice());
    }
    out.lines.push({ level, colour, points });
  };
  let spline = null;   // a B-spline curve header waiting for its poles

  let off = 0;
  while (off + 4 <= u.length) {
    if (u[off] === 0xFF && u[off + 1] === 0xFF) break;
    const size = uint16(u, off + 2) * 2 + 4;
    if (off + size > u.length) { out.truncated = true; break; }
    const level = u[off] & 0x3F, deleted = u[off + 1] & 0x80, type = u[off + 1] & 0x7F;
    const e = off;
    off += size;
    if (deleted) continue;

    if (type === T.TCB) {
      if (size < 1264) continue;
      const subPerMaster = int32(u, e + 1112), uorPerSub = int32(u, e + 1116);
      const per = subPerMaster * uorPerSub;
      if (per > 0) scale = 1 / per;
      const name = String.fromCharCode(u[e + 1120], u[e + 1121]).replace(/\0/g, '').trim();
      out.unitName = name;
      out.unit = UNIT_NAMES[name.toLowerCase()] || null;
      ox = vaxDouble(u, e + 1240) * scale; oy = vaxDouble(u, e + 1248) * scale; oz = vaxDouble(u, e + 1256) * scale;
      continue;
    }
    if (type === T.COLOR_TABLE_GROUP && level === 1 && size >= 38 + 768) {
      // The background comes first (it is colour 255), then colours 0 to 254.
      const t = [];
      for (let i = 0; i < 255; i++) t.push([u[e + 41 + i * 3], u[e + 42 + i * 3], u[e + 43 + i * 3]]);
      t.push([u[e + 38], u[e + 39], u[e + 40]]);
      out.colours = t;
      continue;
    }
    if (size < 36) continue;        // no display header: not graphic
    const colour = u[e + 35];

    switch (type) {
      case T.LINE: {
        if (size < 36 + 2 * N * 4) break;
        add(level, colour, [pt(e + 36, 0), pt(e + 36, 1)], false);
        break;
      }
      case T.LINE_STRING: case T.SHAPE: case T.CURVE: case T.BSPLINE_POLE: {
        const n = uint16(u, e + 36);
        const fits = Math.floor((size - 38) / (N * 4));
        const count = Math.min(n, fits);
        const pts = [];
        for (let k = 0; k < count; k++) pts.push(pt(e + 38, k));
        if (type === T.BSPLINE_POLE && spline) { add(level, colour, bspline(pts, spline.order, spline.closed), false); spline = null; break; }
        if (type === T.BSPLINE_POLE) { add(level, colour, pts, false); break; }
        // A curve's first two and last two points only steer its ends.
        if (type === T.CURVE) { add(level, colour, catmull(pts), false); break; }
        add(level, colour, pts, type === T.SHAPE);
        break;
      }
      case T.ELLIPSE: case T.ARC: {
        const arc = type === T.ARC;
        let p = e + 36, start = 0, turn = 2 * Math.PI;
        if (arc) { start = angle(int32(u, p)); turn = sweep(int32(u, p + 4) >>> 0); p += 8; }
        const a = vaxDouble(u, p) * scale, b = vaxDouble(u, p + 8) * scale;
        p += 16;
        let rows;
        if (is3d) { rows = quatRows(u, p); p += 16; } else {
          const r = angle(int32(u, p));
          rows = [[Math.cos(r), Math.sin(r), 0], [-Math.sin(r), Math.cos(r), 0]];
          p += 4;
        }
        if (p + N * 8 > e + size) break;
        const c = [vaxDouble(u, p) * scale - ox, vaxDouble(u, p + 8) * scale - oy, is3d ? vaxDouble(u, p + 16) * scale - oz : 0];
        const steps = Math.max(8, Math.ceil(Math.abs(turn) / (2 * Math.PI) * 96));
        const pts = [];
        for (let k = 0; k <= steps; k++) {
          const t = start + turn * k / steps;
          const x = a * Math.cos(t), y = b * Math.sin(t);
          pts.push([c[0] + x * rows[0][0] + y * rows[1][0], c[1] + x * rows[0][1] + y * rows[1][1], c[2] + x * rows[0][2] + y * rows[1][2]]);
        }
        add(level, colour, pts, false);
        break;
      }
      case T.BSPLINE_CURVE: {
        out.splines++;
        spline = { order: (u[e + 36] & 0x0F) + 2, closed: !!(u[e + 37] & 0x80) };
        break;
      }
      case T.TEXT: case T.TEXT_NODE: out.texts += type === T.TEXT ? 1 : 0; break;
      case T.BSPLINE_SURFACE: out.skipped++; break;
      default: break;   // headers (cells, chains, surfaces), knots, weights, attributes: no geometry of their own
    }
  }
  return out;
}

/* A curve element passes through its points but the first two and the last
   two, which only set the direction at its ends. Drawn as a Catmull-Rom
   spline, steered at each end by the point just outside it. */
function catmull(p) {
  if (p.length < 6) return p;
  const out = [];
  for (let i = 2; i < p.length - 3; i++) {
    const p0 = p[i - 1], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2];
    for (let s = 0; s < 8; s++) {
      const t = s / 8, t2 = t * t, t3 = t2 * t;
      out.push([0, 1, 2].map(k => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  out.push(p[p.length - 3]);
  return out;
}

/* A B-spline of the given order through its poles, on uniform knots (clamped
   at the ends, or wrapped round when closed): de Boor's algorithm. */
function bspline(poles, order, closed) {
  let P = poles;
  const k = Math.min(order, P.length);
  if (k < 2) return P;
  if (closed) P = P.concat(P.slice(0, k - 1));
  const n = P.length;
  const knots = [];
  if (closed) for (let i = 0; i < n + k; i++) knots.push(i);
  else {
    for (let i = 0; i < k; i++) knots.push(0);
    for (let i = 1; i < n - k + 1; i++) knots.push(i);
    for (let i = 0; i < k; i++) knots.push(n - k + 1);
  }
  const lo = knots[k - 1], hi = knots[n];
  const steps = Math.max(16, (n - k + 1) * 12);
  const out = [];
  for (let s = 0; s <= steps; s++) {
    const t = lo + (hi - lo) * s / steps;
    let span = k - 1;
    while (span < n - 1 && t >= knots[span + 1]) span++;
    const d = [];
    for (let j = 0; j < k; j++) d.push(P[span - k + 1 + j].slice());
    for (let r = 1; r < k; r++) {
      for (let j = k - 1; j >= r; j--) {
        const i = span - k + 1 + j;
        const den = knots[i + k - r] - knots[i];
        const a = den ? (t - knots[i]) / den : 0;
        for (let c = 0; c < 3; c++) d[j][c] = (1 - a) * d[j - 1][c] + a * d[j][c];
      }
    }
    out.push(d[k - 1]);
  }
  return out;
}

// ── The engine ───────────────────────────────────────────────────────────

export async function load(entry, ctx) {
  const buffer = await ctx.files.buffer(entry);
  requireBytes(buffer, 4, 'DGN');
  const head = new Uint8Array(buffer, 0, Math.min(8, buffer.byteLength));
  if (isOle(head)) return loadV8(entry, buffer, ctx);
  if (!isV7(head)) throw new ModelError('This is not a MicroStation DGN file: it does not start with a V7 design file header.');
  requireBytes(buffer, 1536, 'DGN');

  const d = readDgn(buffer);
  if (d.truncated) ctx.warn('This DGN file is cut short; what was read before the break is shown.');
  if (!d.lines.length) throw new ModelError('This DGN file has no lines, shapes or arcs to draw' + (d.texts ? ' (only text)' : '') + '.');
  if (d.texts) ctx.warn(d.texts + ' text label' + (d.texts === 1 ? ' is' : 's are') + ' not shown: the viewer draws the geometry only.');
  if (d.skipped) ctx.warn(d.skipped + ' B-spline surface' + (d.skipped === 1 ? ' is' : 's are') + ' not shown.');
  if (!d.unit && d.unitName) ctx.warn('The file\'s master unit is "' + d.unitName + '", which is not a unit the viewer knows, so sizes are given without one.');

  const table = d.colours || defaultTable();
  // Far from the origin (map coordinates), 32-bit floats would round the
  // drawing; the points are kept relative to a corner of it, which the
  // group is moved to, so every world position is still the file's own.
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  for (const l of d.lines) for (const p of l.points) box.expandByPoint(v.set(p[0], p[1], p[2]));
  const anchor = box.min.clone();
  const span = box.getSize(new THREE.Vector3());
  if (Math.max(Math.abs(anchor.x), Math.abs(anchor.y), Math.abs(anchor.z)) < 4 * Math.max(span.x, span.y, span.z, 1e-9)) anchor.set(0, 0, 0);

  // Level → colour → segment pairs.
  const byLevel = new Map();
  for (const l of d.lines) {
    if (!byLevel.has(l.level)) byLevel.set(l.level, new Map());
    const m = byLevel.get(l.level);
    if (!m.has(l.colour)) m.set(l.colour, []);
    const arr = m.get(l.colour);
    const p = l.points;
    for (let i = 0; i + 1 < p.length; i++) {
      arr.push(p[i][0] - anchor.x, p[i][1] - anchor.y, p[i][2] - anchor.z, p[i + 1][0] - anchor.x, p[i + 1][1] - anchor.y, p[i + 1][2] - anchor.z);
    }
  }
  const root = new THREE.Group();
  root.name = entry.name;
  root.position.copy(anchor);
  const mats = new Map();
  const matFor = idx => {
    if (mats.has(idx)) return mats.get(idx);
    const rgb = table[idx] || [255, 255, 255];
    const m = new THREE.LineBasicMaterial();
    // White (colour 0 and its like) would vanish on a light page: it takes the page's line colour.
    if (rgb[0] > 245 && rgb[1] > 245 && rgb[2] > 245) { m.color.set(0xffffff); m.userData.o3vDefault = true; }
    else m.color.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);
    m.name = 'Colour ' + idx;
    mats.set(idx, m);
    return m;
  };
  for (const level of [...byLevel.keys()].sort((a, b) => a - b)) {
    const g = new THREE.Group();
    g.name = 'Level ' + level;
    for (const [colour, arr] of byLevel.get(level)) {
      if (!arr.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      const ls = new THREE.LineSegments(geo, matFor(colour));
      ls.name = 'Level ' + level + ', colour ' + colour;
      g.add(ls);
    }
    root.add(g);
  }
  return { object: root, units: d.unit };
}

// ── V8: cadkit in a worker ───────────────────────────────────────────────

let worker = null, warm = false, seq = 0;
const waiting = new Map();
function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./dgn8-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = e => {
    const job = waiting.get(e.data.id);
    if (!job) return;
    waiting.delete(e.data.id);
    if (e.data.ok) { warm = true; job.resolve(e.data.result); } else job.reject(e.data);
  };
  worker.onerror = e => {
    // A trap or a failed import: this worker is spent; the next file gets a new one.
    for (const job of waiting.values()) job.reject({ error: e.message || 'worker-failed' });
    waiting.clear();
    worker = null;
  };
  return worker;
}

const UNIT_BY_METRES = [[1e-6, 'µm'], [0.001, 'mm'], [0.01, 'cm'], [1, 'm'], [1000, 'km'], [0.0254, 'in'], [0.3048, 'ft'], [1609.344, 'mi']];

async function loadV8(entry, buffer, ctx) {
  ctx.progress(warm ? 'Reading the DGN V8 drawing…' : 'Loading the DGN V8 reader (cadkit, about 1.3 MB, once), then reading the drawing…');
  let r;
  try {
    r = await new Promise((resolve, reject) => {
      const id = ++seq;
      waiting.set(id, { resolve, reject });
      getWorker().postMessage({ id, buffer, base: CADKIT_BASE }, [buffer]);
    });
  } catch (e) {
    const err = e && e.error;
    if (err === 'download-failed') throw new ModelError('The DGN V8 reader could not be downloaded. Check the internet connection and try again (it is kept for offline use once loaded).');
    if (err === 'not-dgn') throw new ModelError('This file is an OLE compound document (like an old Word or Excel file), not a MicroStation DGN.');
    if (err === 'read-failed') throw new ModelError('This DGN V8 file could not be read: it is damaged, protected, or uses a part of the format the reader does not know (' + (e.detail || 'no detail') + ').');
    throw new ModelError('The DGN V8 file could not be read (' + err + ').');
  }
  const segs = r.groups.reduce((n, g) => n + g.lines.length, 0), tris = r.groups.reduce((n, g) => n + g.tris.length, 0);
  if (!segs && !tris) throw new ModelError('This DGN file has no lines, shapes or surfaces to draw in its design model' + (r.texts ? ' (only text)' : '') + '.');
  if (r.texts) ctx.warn(r.texts + ' text label' + (r.texts === 1 ? ' is' : 's are') + ' not shown: the viewer draws the geometry only.');
  if (r.skipped) ctx.warn(r.skipped + ' element' + (r.skipped === 1 ? '' : 's') + ' (hatching, dimensions, images or points) ' + (r.skipped === 1 ? 'is' : 'are') + ' not shown.');
  if (r.otherModels) ctx.warn('The file holds ' + (r.otherModels + 1) + ' design models; "' + r.modelName + '" is shown.');

  const mpu = r.metersPerUnit;
  const hit = mpu ? UNIT_BY_METRES.find(([m]) => Math.abs(mpu / m - 1) < 1e-9) : null;
  const units = hit ? hit[1] : null;
  if (mpu && !hit) ctx.warn('The drawing\'s unit is ' + mpu + ' m, which is not a unit the viewer names, so sizes are given in that unit.');

  const root = new THREE.Group();
  root.name = entry.name;
  root.position.fromArray(r.anchor || [0, 0, 0]);
  const levels = new Map();
  const lineMats = new Map(), meshMats = new Map();
  const key = rgb => rgb ? rgb.join(',') : '';
  const white = rgb => !rgb || (rgb[0] > 245 && rgb[1] > 245 && rgb[2] > 245);
  const lineMat = rgb => {
    if (!lineMats.has(key(rgb))) {
      const m = new THREE.LineBasicMaterial();
      if (white(rgb)) { m.color.set(0xffffff); m.userData.o3vDefault = true; }
      else m.color.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);
      lineMats.set(key(rgb), m);
    }
    return lineMats.get(key(rgb));
  };
  const meshMat = rgb => {
    if (!meshMats.has(key(rgb))) meshMats.set(key(rgb), white(rgb) ? defaultMaterial() : colourMaterial(rgb.map(v => v / 255)));
    return meshMats.get(key(rgb));
  };
  for (const g of r.groups.sort((a, b) => String(a.level).localeCompare(String(b.level), undefined, { numeric: true }))) {
    let lv = levels.get(g.level);
    if (!lv) { lv = new THREE.Group(); lv.name = g.level; levels.set(g.level, lv); root.add(lv); }
    const label = g.level + (g.rgb ? ', ' + g.rgb.join(' ') : '');
    if (g.lines.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(g.lines, 3));
      const ls = new THREE.LineSegments(geo, lineMat(g.rgb));
      ls.name = label;
      lv.add(ls);
    }
    if (g.tris.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(g.tris, 3));
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, meshMat(g.rgb));
      mesh.name = label;
      lv.add(mesh);
    }
  }
  return { object: root, units };
}
