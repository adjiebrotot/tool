/* IFC engine (Industry Foundation Classes: IFC2X3, IFC4, IFC4X3; also .ifczip).

   IFC is the open exchange format of building design (BIM): Revit,
   ArchiCAD, Tekla, Allplan, Vectorworks and BricsCAD all write it. Its text
   is STEP (ISO 10303-21) with a building schema, so it starts like a STEP
   file and is told apart by its FILE_SCHEMA. Elements carry their geometry
   as extrusions, sweeps, B-reps and booleans (a door's opening cut from its
   wall), triangulated by web-ifc compiled to WebAssembly in a worker
   (ifc-worker.js), downloaded only when an IFC file is opened (about 1.1 MB
   compressed). The model is drawn grouped by IFC class (IfcWall, IfcSlab,
   IfcWindow, …) in the colours the file gives, Z up, in the file's unit. */

import * as THREE from 'three';
import { requireBytes, headText, ModelError, colourMaterial, baseName } from './common.js';
import { IFC_BASE } from './cdn.js';

/** Does this header (the first bytes as text) name an IFC schema? */
export const isIfcHead = h => /ISO-10303-21/.test(h) && /FILE_SCHEMA\s*\(\s*\(\s*'IFC/i.test(h);

let worker = null, warm = false, seq = 0;
const waiting = new Map();
function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./ifc-worker.js', import.meta.url), { type: 'module' });
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

/** An .ifczip is a zip holding one .ifc: the first one found is opened. */
async function unzipIfc(buffer) {
  const { unzipSync } = await import('three/addons/libs/fflate.module.js');
  let files;
  try { files = unzipSync(new Uint8Array(buffer), { filter: f => /\.ifc$/i.test(f.name) && !/(^|\/)(__MACOSX|\.)/.test(f.name) }); }
  catch (e) { throw new ModelError('This IFC-ZIP file could not be opened as a zip archive.'); }
  const name = Object.keys(files)[0];
  if (!name) throw new ModelError('This zip holds no .ifc file.');
  const u8 = files[name];
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}

export async function load(entry, ctx) {
  let buffer = await ctx.files.buffer(entry);
  requireBytes(buffer, 64, 'IFC');
  if (headText(buffer, 2).startsWith('PK')) buffer = await unzipIfc(buffer);
  const head = headText(buffer, 4096);
  if (/^\s*<\?xml|<ifcXML|ISO-10303-28/i.test(head)) throw new ModelError('This is IFC in XML form (ifcXML), which cannot be read. Export it from the BIM tool as a regular IFC file (.ifc).');
  if (!/ISO-10303-21/.test(head)) throw new ModelError('This is not an IFC file: it does not start with ISO-10303-21.');
  if (!isIfcHead(head)) throw new ModelError('This file is STEP, not IFC: its FILE_SCHEMA names no IFC schema. Rename it .step to open it as a CAD part.');

  ctx.progress(warm ? 'Reading the IFC model…' : 'Loading the IFC reader (web-ifc, about 1.1 MB, once), then reading the model…');
  let r;
  try {
    r = await new Promise((resolve, reject) => {
      const id = ++seq;
      waiting.set(id, { resolve, reject });
      getWorker().postMessage({ id, buffer, base: IFC_BASE }, [buffer]);
    });
  } catch (e) {
    const err = e && e.error;
    if (err === 'download-failed') throw new ModelError('The IFC reader could not be downloaded. Check the internet connection and try again (it is kept for offline use once loaded).');
    if (err === 'read-failed') throw new ModelError('This IFC file could not be read: it is damaged or uses a part of the format the reader does not know (' + (e.detail || 'no detail') + ').');
    throw new ModelError('The IFC file could not be read (' + err + ').');
  }
  if (!r.groups.length) throw new ModelError('This IFC file has no elements with 3D geometry to draw (it may hold only properties, or 2D plans).');
  if (r.failed) ctx.warn(r.failed + ' shape' + (r.failed === 1 ? '' : 's') + ' in this IFC file could not be built and ' + (r.failed === 1 ? 'is' : 'are') + ' not shown.');

  const mpu = r.metresPerUnit;
  const hit = mpu ? UNIT_BY_METRES.find(([m]) => Math.abs(mpu / m - 1) < 1e-9) : null;
  const units = hit ? hit[1] : null;
  if (mpu && !hit) ctx.warn('The model\'s unit is ' + mpu + ' m, which is not a unit the viewer names, so sizes are given in that unit.');

  const root = new THREE.Group();
  root.name = baseName(entry.name);
  root.position.fromArray(r.anchor || [0, 0, 0]);
  root.userData.ifcSchema = r.schema;
  const byType = new Map();
  const mats = new Map();
  const matFor = rgba => {
    const k = rgba.join(',');
    if (!mats.has(k)) mats.set(k, colourMaterial(rgba, { opacity: rgba[3], name: 'IFC ' + rgba.slice(0, 3).map(c => Math.round(c * 255)).join(' ') }));
    return mats.get(k);
  };
  for (const g of r.groups.sort((a, b) => a.type.localeCompare(b.type))) {
    let grp = byType.get(g.type);
    if (!grp) { grp = new THREE.Group(); grp.name = g.type; byType.set(g.type, grp); root.add(grp); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(g.positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(g.normals, 3));
    geo.setIndex(new THREE.BufferAttribute(g.indices, 1));
    const mesh = new THREE.Mesh(geo, matFor(g.rgba));
    mesh.name = g.type;
    // Glass drawn after the solids, so walls show through windows.
    if (g.rgba[3] < 1) mesh.renderOrder = 1;
    grp.add(mesh);
  }
  return { object: root, units };
}
