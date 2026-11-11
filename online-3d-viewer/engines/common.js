/* What every engine shares.

   An engine turns one file (plus the files that came with it: an OBJ's MTL and
   textures, a glTF's .bin) into a three.js Object3D. This file holds the
   pieces they all need:

   - FileSet: the files a reader dropped, found by the names a model uses for
     them (a path, a bare name, URL-encoded, any case, Windows backslashes);
   - a LoadingManager that answers a loader's request for "textures/wood.png"
     with the dropped file, and notes what was asked for but not dropped;
   - the default material, given to a part whose file carries no colour, and
     marked so the viewer can paint it in the page's model colour;
   - small helpers: text decoding, a mesh from plain arrays, a friendly error. */

import * as THREE from 'three';

const LIBRARY_CDN = 'https://cdn.jsdelivr.net/npm/';

// ── Files ────────────────────────────────────────────────────────────────

function cleanPath(p) {
  let s = String(p || '');
  try { s = decodeURIComponent(s); } catch (e) { /* keep as given */ }
  s = s.replace(/\\/g, '/').replace(/[?#].*$/, '');
  s = s.replace(/^[a-z]+:\/\/[^/]*\//i, '');   // http://host/ …
  s = s.replace(/^[a-z]:\//i, '');              // C:/ …
  s = s.replace(/^(\.\/)+/, '').replace(/^\/+/, '');
  // Collapse "a/b/../c" so "../textures/x.png" can still match by its tail.
  const out = [];
  for (const part of s.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') { out.pop(); continue; }
    out.push(part);
  }
  return out.join('/').toLowerCase();
}

export function baseName(p) {
  const s = String(p || '').replace(/\\/g, '/');
  return s.slice(s.lastIndexOf('/') + 1);
}

export function extOf(p) {
  const b = baseName(p);
  const i = b.lastIndexOf('.');
  return i > 0 ? b.slice(i + 1).toLowerCase() : '';
}

export class FileSet {
  /** @param {{file: Blob, name: string, path?: string}[]} list */
  constructor(list) {
    this.entries = list.map(it => ({
      file: it.file,
      name: it.name || baseName(it.path),
      path: it.path || it.name,
      key: cleanPath(it.path || it.name),
      ext: extOf(it.name || it.path),
    }));
    this.urls = new Map();
    this.missing = new Set();
    this._empty = null;
  }

  /** The dropped file a model means by `ref`, or null. */
  find(ref) {
    const key = cleanPath(ref);
    if (!key) return null;
    let hit = this.entries.find(e => e.key === key);
    if (hit) return hit;
    // "textures/a.png" asked, "model/textures/a.png" dropped (a folder drop), or the reverse.
    hit = this.entries.find(e => e.key.endsWith('/' + key) || key.endsWith('/' + e.key));
    if (hit) return hit;
    const name = baseName(key);
    return this.entries.find(e => baseName(e.key) === name) || null;
  }

  url(entry) {
    let u = this.urls.get(entry);
    if (!u) { u = URL.createObjectURL(entry.file); this.urls.set(entry, u); }
    return u;
  }

  emptyUrl() {
    if (!this._empty) this._empty = URL.createObjectURL(new Blob([]));
    return this._empty;
  }

  async buffer(entry) { return await entry.file.arrayBuffer(); }
  async text(entry) { return decodeText(await entry.file.arrayBuffer()); }

  /** Blob URLs made for textures must outlive the load (a texture can be
     re-uploaded to the GPU later), so they are freed when the next model opens. */
  dispose() {
    for (const u of this.urls.values()) URL.revokeObjectURL(u);
    if (this._empty) URL.revokeObjectURL(this._empty);
    this.urls.clear();
  }
}

/** A LoadingManager whose requests are answered from the dropped files. */
export function managerFor(files) {
  const manager = new THREE.LoadingManager();
  manager.setURLModifier(url => {
    if (/^(data|blob):/i.test(url)) return url;
    // A decoder a loader fetches for itself (Draco, Basis, rhino3dm) is a library, not a model file.
    if (url.startsWith(LIBRARY_CDN)) return url;
    const hit = files.find(url);
    if (hit) return files.url(hit);
    let shown = String(url);
    try { shown = decodeURIComponent(shown); } catch (e) { /* keep as given */ }
    files.missing.add(baseName(shown.replace(/[?#].*$/, '')) || shown);
    // Nothing is fetched from the web or from this site: a missing texture
    // stays blank, a missing buffer is caught by the engine that needs it.
    return files.emptyUrl();
  });
  // settled(): resolves once every file the loaders asked for has loaded or
  // failed, so the first frame (and the stats) include the textures.
  let busy = 0;
  const waiters = [];
  const start = manager.itemStart.bind(manager);
  const end = manager.itemEnd.bind(manager);
  manager.itemStart = url => { busy++; start(url); };
  manager.itemEnd = url => {
    end(url);
    busy = Math.max(0, busy - 1);
    if (busy === 0) waiters.splice(0).forEach(f => f());
  };
  manager.settled = (timeout = 10000) => busy === 0
    ? new Promise(r => setTimeout(r, 0))
    : new Promise(r => { waiters.push(r); setTimeout(r, timeout); });
  return manager;
}

// ── Text and errors ──────────────────────────────────────────────────────

const UTF8 = new TextDecoder('utf-8');

export function decodeText(buffer) {
  let s = UTF8.decode(buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer);
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
  return s;
}

/** The first `n` bytes as Latin-1 text, for sniffing a header. */
export function headText(buffer, n = 256) {
  const u8 = new Uint8Array(buffer, 0, Math.min(n, buffer.byteLength));
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return s;
}

/** An error the page shows to the reader as it is. */
export class ModelError extends Error {
  constructor(message) { super(message); this.name = 'ModelError'; this.friendly = true; }
}

export function requireBytes(buffer, min, label) {
  if (!buffer || buffer.byteLength === 0) throw new ModelError('This ' + label + ' file is empty.');
  if (buffer.byteLength < min) throw new ModelError('This ' + label + ' file is too short to hold a model.');
}

// ── Materials and meshes ─────────────────────────────────────────────────

/** The material for a part whose file names no colour. The viewer paints
    every material marked o3vDefault in the page's model colour. */
export function defaultMaterial(opts = {}) {
  const m = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.55,
    metalness: 0.05,
    side: THREE.DoubleSide,
    vertexColors: !!opts.vertexColors,
    flatShading: !!opts.flatShading,
  });
  m.name = opts.name || '';
  // A part coloured by its own vertices keeps them; only a plain part is tinted.
  if (!opts.vertexColors) m.userData.o3vDefault = true;
  return m;
}

/** A material in a colour the file gave: 0-1 components, sRGB as files
    write them, or linear light when opts.linear (OpenCascade's colours). */
export function colourMaterial(rgb, opts = {}) {
  const m = new THREE.MeshStandardMaterial({
    roughness: 0.5,
    metalness: 0.05,
    side: THREE.DoubleSide,
    transparent: opts.opacity != null && opts.opacity < 1,
    opacity: opts.opacity != null ? opts.opacity : 1,
  });
  m.color.setRGB(rgb[0], rgb[1], rgb[2], opts.linear ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace);
  m.name = opts.name || '';
  return m;
}

/** A Mesh from plain arrays (positions in triplets; optional normals,
    per-vertex colours 0-1 and triangle indices). */
export function meshFromArrays({ positions, normals, colors, indices, name, material }) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(toF32(positions), 3));
  if (normals && normals.length === positions.length) g.setAttribute('normal', new THREE.BufferAttribute(toF32(normals), 3));
  if (colors && colors.length === positions.length) g.setAttribute('color', new THREE.BufferAttribute(toF32(colors), 3));
  if (indices && indices.length) {
    const max = positions.length / 3;
    g.setIndex(new THREE.BufferAttribute(max > 65535 ? toU32(indices) : toU16(indices), 1));
  }
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, material || defaultMaterial({ vertexColors: !!g.getAttribute('color') }));
  mesh.name = name || '';
  return mesh;
}

function toF32(a) { return a instanceof Float32Array ? a : new Float32Array(a); }
function toU32(a) { return a instanceof Uint32Array ? a : new Uint32Array(a); }
function toU16(a) { return a instanceof Uint16Array ? a : new Uint16Array(a); }

/** Gives every mesh without normals a set, so it is lit (STL, OFF, some PLY). */
export function ensureNormals(object) {
  object.traverse(o => {
    if (o.isMesh && o.geometry && !o.geometry.getAttribute('normal') && o.geometry.getAttribute('position')) {
      o.geometry.computeVertexNormals();
    }
  });
}

/** True when the object holds at least one drawable vertex. */
export function hasGeometry(object) {
  let found = false;
  object.traverse(o => {
    if (found) return;
    const p = o.geometry && o.geometry.getAttribute && o.geometry.getAttribute('position');
    if (p && p.count > 0) found = true;
  });
  return found;
}

/** Waits for one paint, so a "Reading…" message shows before a long parse. */
export function nextFrame() {
  return new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
}

/** Normals for triangle corners that are smooth across an edge flatter than
    `angle` and sharp across a steeper one. P holds the shared vertex
    positions (triplets), corners the vertex index of each triangle corner.
    Works on the file's own vertex numbering, so it never merges two vertices
    that merely sit close together. */
export function creaseNormals(P, corners, angle = Math.PI / 6) {
  const nt = Math.floor(corners.length / 3);
  const fn = new Float64Array(nt * 3);          // area-weighted face normals
  for (let t = 0; t < nt; t++) {
    const a = corners[t * 3] * 3, b = corners[t * 3 + 1] * 3, c = corners[t * 3 + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    fn[t * 3] = uy * vz - uz * vy; fn[t * 3 + 1] = uz * vx - ux * vz; fn[t * 3 + 2] = ux * vy - uy * vx;
  }
  const nv = P.length / 3;
  // vertex → triangles touching it (CSR layout)
  const deg = new Uint32Array(nv + 1);
  for (let i = 0; i < nt * 3; i++) deg[corners[i] + 1]++;
  for (let v = 0; v < nv; v++) deg[v + 1] += deg[v];
  const fill = deg.slice(0, nv);
  const adj = new Uint32Array(nt * 3);
  for (let i = 0; i < nt * 3; i++) adj[fill[corners[i]]++] = Math.floor(i / 3);

  const cos = Math.cos(angle);
  const un = new Float32Array(nt * 3);           // unit face normals
  for (let t = 0; t < nt; t++) {
    const x = fn[t * 3], y = fn[t * 3 + 1], z = fn[t * 3 + 2];
    const l = Math.hypot(x, y, z) || 1;
    un[t * 3] = x / l; un[t * 3 + 1] = y / l; un[t * 3 + 2] = z / l;
  }
  const out = new Float32Array(nt * 9);
  for (let t = 0; t < nt; t++) {
    const ax = un[t * 3], ay = un[t * 3 + 1], az = un[t * 3 + 2];
    for (let k = 0; k < 3; k++) {
      const v = corners[t * 3 + k];
      let sx = 0, sy = 0, sz = 0;
      for (let j = deg[v]; j < deg[v + 1]; j++) {
        const g = adj[j];
        if (g === t || ax * un[g * 3] + ay * un[g * 3 + 1] + az * un[g * 3 + 2] >= cos) { sx += fn[g * 3]; sy += fn[g * 3 + 1]; sz += fn[g * 3 + 2]; }
      }
      const l = Math.hypot(sx, sy, sz) || 1;
      out[t * 9 + k * 3] = sx / l; out[t * 9 + k * 3 + 1] = sy / l; out[t * 9 + k * 3 + 2] = sz / l;
    }
  }
  return out;
}
