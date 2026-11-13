/* OFF engine (Object File Format, from Geomview; also COFF, NOFF, CNOFF,
   STOFF and their combinations). Three.js has no OFF reader, so this one is
   written here in full.

   Layout:   [ST][C][N]OFF            the keyword, counts may follow on its line
             nVertices nFaces nEdges
             x y z [nx ny nz] [r g b [a]] [s t]     one line per vertex
             n i1 … in [r g b [a]]                  one line per face (any polygon)
   Comments start with #. Colours are 0-255 integers or 0-1 floats. Polygons
   are split into triangles as a fan. Face colours become per-vertex colours,
   so each face keeps its own. Normals are rebuilt with a 30 degree crease, so
   a box stays crisp and a sphere stays smooth. */

import * as THREE from 'three';
import { defaultMaterial, requireBytes, decodeText, ModelError, creaseNormals } from './common.js';

export async function load(entry, ctx) {
  const buffer = await ctx.files.buffer(entry);
  requireBytes(buffer, 3, 'OFF');
  const parsed = parseOFF(decodeText(buffer));
  const mesh = new THREE.Mesh(parsed.geometry, defaultMaterial({ vertexColors: parsed.coloured }));
  mesh.name = entry.name.replace(/\.[^.]+$/, '');
  if (parsed.skipped) ctx.warn(parsed.skipped.toLocaleString() + ' faces in this OFF file point at vertices that do not exist and were left out.');
  return { object: mesh };
}

export function parseOFF(text) {
  const lines = [];
  for (const raw of text.split(/\r?\n/)) {
    const s = raw.replace(/#.*$/, '').trim();
    if (s) lines.push(s);
  }
  if (!lines.length) throw new ModelError('This OFF file is empty.');

  let head = lines[0].split(/\s+/);
  const m = /^(ST)?(C)?(N)?(4)?(n)?OFF$/i.exec(head[0]);
  if (!m) throw new ModelError('This is not an OFF file: it does not start with "OFF".');
  if (m[4] || m[5]) throw new ModelError('This OFF file is four- or n-dimensional, which a 3D viewer cannot show.');
  const hasST = !!m[1], hasC = !!m[2], hasN = !!m[3];

  let li = 1;
  let counts = head.slice(1).map(Number);
  if (counts.length < 2) {
    if (li >= lines.length) throw new ModelError('This OFF file stops before its vertex and face counts.');
    counts = lines[li++].split(/\s+/).map(Number);
  }
  const nv = counts[0] | 0, nf = counts[1] | 0;
  if (!(nv > 0) || !Number.isFinite(counts[0])) throw new ModelError('This OFF file says it has no vertices.');
  if (lines.length < li + nv) throw new ModelError('This OFF file is cut short: it promises ' + nv.toLocaleString() + ' vertices but holds ' + Math.max(0, lines.length - li).toLocaleString() + '.');

  const P = new Float32Array(nv * 3);
  let VC = null;
  for (let i = 0; i < nv; i++) {
    const t = lines[li++].split(/\s+/).map(Number);
    if (t.length < 3 || !Number.isFinite(t[0]) || !Number.isFinite(t[1]) || !Number.isFinite(t[2])) {
      throw new ModelError('Vertex ' + (i + 1) + ' of this OFF file is not three numbers.');
    }
    P[i * 3] = t[0]; P[i * 3 + 1] = t[1]; P[i * 3 + 2] = t[2];
    if (hasC) {
      const c0 = 3 + (hasN ? 3 : 0);
      const rest = t.length - c0 - (hasST ? 2 : 0);
      if (rest >= 3) {
        if (!VC) VC = new Float32Array(nv * 3).fill(1);
        VC[i * 3] = t[c0]; VC[i * 3 + 1] = t[c0 + 1]; VC[i * 3 + 2] = t[c0 + 2];
      }
    }
  }
  if (VC) scaleColours(VC);

  // Faces → triangles (fan), each corner carrying its colour.
  const tris = [];
  const faceCols = [];
  let anyFaceColour = false, skipped = 0;
  for (let f = 0; f < nf && li < lines.length; f++) {
    const t = lines[li++].split(/\s+/).map(Number);
    const n = t[0] | 0;
    if (n < 3 || t.length < n + 1) { if (n >= 3) skipped++; continue; }
    const idx = t.slice(1, n + 1);
    if (idx.some(v => !(v >= 0 && v < nv) || !Number.isInteger(v))) { skipped++; continue; }
    const rest = t.slice(n + 1);
    const col = rest.length >= 3 ? [rest[0], rest[1], rest[2]] : null;
    if (col) anyFaceColour = true;
    for (let k = 1; k < n - 1; k++) {
      tris.push(idx[0], idx[k], idx[k + 1]);
      faceCols.push(col);
    }
  }
  if (!tris.length) throw new ModelError('This OFF file has vertices but no faces that can be drawn.');

  const count = tris.length;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const v = tris[i];
    pos[i * 3] = P[v * 3]; pos[i * 3 + 1] = P[v * 3 + 1]; pos[i * 3 + 2] = P[v * 3 + 2];
  }
  let colours = null;
  if (anyFaceColour) {
    const fc = new Float32Array(faceCols.length * 3);
    faceCols.forEach((c, i) => { const cc = c || [1, 1, 1]; fc[i * 3] = cc[0]; fc[i * 3 + 1] = cc[1]; fc[i * 3 + 2] = cc[2]; });
    scaleColours(fc);
    colours = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const t = Math.floor(i / 3);
      colours[i * 3] = fc[t * 3]; colours[i * 3 + 1] = fc[t * 3 + 1]; colours[i * 3 + 2] = fc[t * 3 + 2];
    }
  } else if (VC) {
    colours = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const v = tris[i];
      colours[i * 3] = VC[v * 3]; colours[i * 3 + 1] = VC[v * 3 + 1]; colours[i * 3 + 2] = VC[v * 3 + 2];
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (colours) {
    // OFF colours are written as sRGB; three.js works in linear light.
    const c = new THREE.Color();
    for (let i = 0; i < colours.length; i += 3) {
      c.setRGB(colours[i], colours[i + 1], colours[i + 2], THREE.SRGBColorSpace);
      colours[i] = c.r; colours[i + 1] = c.g; colours[i + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  }
  g.setAttribute('normal', new THREE.BufferAttribute(creaseNormals(P, tris, Math.PI / 6), 3));
  return { geometry: g, coloured: !!colours, skipped };
}

/** 0-255 integers become 0-1; 0-1 floats are kept. */
function scaleColours(a) {
  let max = 0;
  for (let i = 0; i < a.length; i++) if (a[i] > max) max = a[i];
  if (max > 1) for (let i = 0; i < a.length; i++) a[i] = Math.min(1, a[i] / 255);
}
