/* The bridge to OpenCascade, shared by the STEP, IGES and BREP engines.

   These are exact (B-rep) CAD formats: faces are trimmed surfaces, not
   triangles. OpenCascade reads them and triangulates every face finely
   enough to look smooth (a deflection of 0.1% of the part's size, 0.5 rad),
   in a worker so the page stays responsive. The result keeps the assembly
   tree (each part a named group), part colours and per-face colours
   (OpenCascade reports colours in linear light, not as the file's sRGB).
   STEP and IGES are converted to millimetres; BREP has no unit. */

import * as THREE from 'three';
import { OCCT_BASE } from './cdn.js';
import { defaultMaterial, colourMaterial, ModelError } from './common.js';

const PARAMS = {
  linearUnit: 'millimeter',
  linearDeflectionType: 'bounding_box_ratio',
  linearDeflection: 0.001,
  angularDeflection: 0.5,
};

let worker = null;
let warm = false;
let seq = 0;
const waiting = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./occt-worker.js', import.meta.url));
  worker.onmessage = e => {
    const job = waiting.get(e.data.id);
    if (!job) return;
    waiting.delete(e.data.id);
    if (e.data.ok) { warm = true; job.resolve(e.data.result); } else job.reject(e.data.error);
  };
  worker.onerror = e => {
    for (const job of waiting.values()) job.reject(e.message || 'worker-failed');
    waiting.clear();
    worker = null;
  };
  return worker;
}

function run(kind, buffer) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    waiting.set(id, { resolve, reject });
    getWorker().postMessage({ id, kind, buffer, params: kind === 'brep' ? null : PARAMS, base: OCCT_BASE }, [buffer]);
  });
}

/** Reads a STEP / IGES / BREP buffer into a three.js Group. */
export async function readCad(kind, label, buffer, ctx) {
  ctx.progress(warm ? 'Reading the ' + label + ' geometry…' : 'Loading the CAD reader (OpenCascade, about 2 MB, once), then reading the ' + label + ' geometry…');
  let result;
  try {
    result = await run(kind, buffer);
  } catch (err) {
    if (err === 'download-failed') throw new ModelError('The CAD reader could not be downloaded. Check the internet connection and try again (it is kept for offline use once loaded).');
    if (err === 'read-failed') throw new ModelError('This ' + label + ' file could not be read: it is damaged, empty, or not ' + (label === 'IGES' ? 'an' : 'a') + ' ' + label + ' file.');
    throw new ModelError('The ' + label + ' file could not be read (' + err + ').');
  }
  if (!result.meshes.length) throw new ModelError('This ' + label + ' file has no solids or surfaces to draw (it may hold only curves, points or product data).');

  const built = result.meshes.map(buildMesh);
  const used = new Set();
  const toGroup = node => {
    const g = new THREE.Group();
    g.name = node.name || '';
    for (const i of node.meshes || []) {
      if (!built[i]) continue;
      // A mesh index can repeat (an instanced part); give each use its own object.
      g.add(used.has(i) ? built[i].clone() : built[i]);
      used.add(i);
    }
    for (const c of node.children || []) g.add(toGroup(c));
    return g;
  };
  const root = toGroup(result.root || { meshes: built.map((_, i) => i), children: [] });
  // Anything the tree did not place still belongs in the model.
  built.forEach((m, i) => { if (!used.has(i)) root.add(m); });
  return root;
}

function buildMesh(m, i) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.position, 3));
  if (m.normal && m.normal.length === m.position.length) g.setAttribute('normal', new THREE.BufferAttribute(m.normal, 3));
  else g.computeVertexNormals();
  g.setIndex(new THREE.BufferAttribute(m.index, 1));
  if (!g.getAttribute('normal')) g.computeVertexNormals();

  const partMat = m.color ? colourMaterial(m.color, { linear: true }) : defaultMaterial();
  let material = partMat;

  // Faces coloured on their own: one draw group per run of equal colour.
  const faces = m.faces || [];
  // Which triangles make each CAD face, for the ruler: it snaps to the
  // edges between faces (even smooth ones) and to a flat face's centre.
  if (faces.length) {
    const ranges = new Int32Array(faces.length * 2);
    faces.forEach((f, k) => { ranges[k * 2] = f.first; ranges[k * 2 + 1] = f.last; });
    g.userData.o3vFaces = ranges;
  }
  if (faces.some(f => f.color)) {
    const mats = [partMat];
    const keyOf = c => c ? c.map(v => v.toFixed(4)).join(',') : '';
    const index = new Map([['', 0]]);
    let runStart = 0, runMat = -1;
    const triCount = m.index.length / 3;
    const close = endTri => { if (runMat >= 0 && endTri > runStart) g.addGroup(runStart * 3, (endTri - runStart) * 3, runMat); };
    const sorted = faces.slice().sort((a, b) => a.first - b.first);
    let cursor = 0;
    for (const f of sorted) {
      if (f.first > cursor) { // triangles no face claims: part colour
        if (runMat !== 0) { close(cursor); runStart = cursor; runMat = 0; }
      }
      const k = keyOf(f.color);
      if (!index.has(k)) { index.set(k, mats.length); mats.push(colourMaterial(f.color, { linear: true })); }
      const mi = index.get(k);
      if (mi !== runMat) { close(f.first); runStart = f.first; runMat = mi; }
      cursor = f.last + 1;
    }
    if (cursor < triCount && runMat !== 0) { close(cursor); runStart = cursor; runMat = 0; }
    close(triCount);
    if (mats.length > 1) material = mats; else g.clearGroups();
  }

  const mesh = new THREE.Mesh(g, material);
  mesh.name = m.name || 'Part ' + (i + 1);
  return mesh;
}
