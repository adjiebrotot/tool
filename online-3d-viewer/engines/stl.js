/* STL engine (ASCII and binary, including the colour extension some
   slicers and CAD tools write into binary files).

   An STL is a list of triangles and nothing else: no units, no materials, Z up
   by convention. Each "solid … endsolid" block of an ASCII file becomes a part
   of its own, so a multi-body export keeps its bodies.

   Two faults are common in the wild and both are handled here: facet normals
   written as 0 0 0 (the normals are always rebuilt from the triangles), and a
   binary file that is cut short or carries trailing bytes (read up to the last
   whole triangle, with a warning, instead of failing). */

import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { defaultMaterial, requireBytes, ModelError } from './common.js';

export async function load(entry, ctx) {
  const buffer = await ctx.files.buffer(entry);
  requireBytes(buffer, 15, 'STL');

  let geometry = null;
  try { geometry = new STLLoader().parse(buffer); } catch (e) { geometry = null; }
  if (!triangles(geometry) || !isFiniteArray(geometry.getAttribute('position').array)) {
    // Not a clean file by the book: try it as binary up to its last whole triangle.
    geometry = readBinaryLenient(buffer);
  }
  if (!triangles(geometry)) throw new ModelError('This STL file could not be read: no triangles were found in it.');
  if (!isFiniteArray(geometry.getAttribute('position').array)) throw new ModelError('This STL file has broken coordinates (not numbers), so it is damaged or not an STL.');
  const cut = geometry.userData.cutShort;
  if (cut) ctx.warn('This STL file is shorter than its header says (' + cut.declared.toLocaleString('en-US') + ' triangles), so only the ' + cut.present.toLocaleString('en-US') + ' it holds are shown.');

  // File normals are often zero or stale; the triangles themselves are the truth.
  geometry.deleteAttribute('normal');
  geometry.computeVertexNormals();

  const coloured = !!geometry.hasColors;
  const material = () => {
    const m = defaultMaterial({ vertexColors: coloured });
    if (coloured && geometry.alpha != null && geometry.alpha < 1) { m.transparent = true; m.opacity = geometry.alpha; }
    return m;
  };

  // One part per ASCII solid; a binary file (or one solid) is one part.
  const names = (geometry.userData && geometry.userData.groupNames) || [];
  const groups = geometry.groups.filter(g => g.count > 0);
  if (groups.length > 1) {
    const group = new THREE.Group();
    groups.forEach((gr, i) => {
      const mesh = new THREE.Mesh(sliceGeometry(geometry, gr.start, gr.count), material());
      mesh.name = (names[gr.materialIndex] || '').trim() || 'Solid ' + (i + 1);
      group.add(mesh);
    });
    return { object: group };
  }

  geometry.clearGroups();
  const mesh = new THREE.Mesh(geometry, material());
  mesh.name = (names[0] || '').trim() || entry.name.replace(/\.[^.]+$/, '');
  return { object: mesh };
}

function triangles(g) {
  const p = g && g.getAttribute && g.getAttribute('position');
  return p ? Math.floor(p.count / 3) : 0;
}

/* Binary STL: 80-byte header, uint32 triangle count, then 50 bytes per
   triangle (normal, three vertices, uint16 attribute). */
function readBinaryLenient(buffer) {
  if (buffer.byteLength < 84 + 50) return null;
  const dv = new DataView(buffer);
  const declared = dv.getUint32(80, true);
  const present = Math.floor((buffer.byteLength - 84) / 50);
  const n = declared > 0 ? Math.min(declared, present) : present;
  if (n <= 0) return null;
  const pos = new Float32Array(n * 9);
  for (let i = 0; i < n; i++) {
    const o = 84 + i * 50 + 12;
    for (let k = 0; k < 9; k++) pos[i * 9 + k] = dv.getFloat32(o + k * 4, true);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (declared > present) g.userData.cutShort = { declared, present: n };
  return g;
}

function sliceGeometry(src, start, count) {
  const g = new THREE.BufferGeometry();
  for (const name of Object.keys(src.attributes)) {
    const a = src.attributes[name];
    g.setAttribute(name, new THREE.BufferAttribute(a.array.slice(start * a.itemSize, (start + count) * a.itemSize), a.itemSize, a.normalized));
  }
  return g;
}

function isFiniteArray(a) {
  // A spot check is enough: a misread file is garbage everywhere, and garbage
  // read as floats is NaN, infinite or absurdly large.
  const step = Math.max(1, Math.floor(a.length / 997));
  for (let i = 0; i < a.length; i += step) if (!Number.isFinite(a[i]) || Math.abs(a[i]) > 1e15) return false;
  return true;
}
