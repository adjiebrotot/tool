/* OBJ engine (Wavefront OBJ, with its MTL materials and textures).

   An OBJ names its material library on an "mtllib" line and its textures
   inside the MTL. Both are separate files, so they are found among the files
   dropped with the model: by the name the OBJ gives, else an MTL of the same
   base name, else the only MTL dropped. Whatever is still missing is reported,
   and the model shows in the default colour instead. OBJ is Y up. */

import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { managerFor, defaultMaterial, requireBytes, ModelError, hasGeometry, baseName } from './common.js';

export async function load(entry, ctx) {
  const buffer = await ctx.files.buffer(entry);
  requireBytes(buffer, 6, 'OBJ');
  const text = new TextDecoder('utf-8').decode(buffer);
  if (!/^\s*(v|f|l|p)\s/m.test(text)) throw new ModelError('This OBJ file has no vertices or faces in it.');

  const files = ctx.files;
  const manager = managerFor(files);

  // ── Find the material library ──
  const wanted = [];
  for (const m of text.matchAll(/^[ \t]*mtllib[ \t]+(.+?)[ \t]*$/gm)) wanted.push(m[1]);
  const mtlEntries = [];
  const missingMtl = [];
  for (const line of wanted) {
    // A name may contain spaces, or one line may list several libraries.
    let hit = files.find(line);
    if (hit) { if (!mtlEntries.includes(hit)) mtlEntries.push(hit); continue; }
    const parts = line.split(/\s+/);
    let any = false;
    for (const p of parts) { const h = files.find(p); if (h) { any = true; if (!mtlEntries.includes(h)) mtlEntries.push(h); } }
    if (!any) missingMtl.push(baseName(line));
  }
  if (!mtlEntries.length) {
    const mtls = files.entries.filter(e => e.ext === 'mtl');
    const stem = entry.name.replace(/\.[^.]+$/, '').toLowerCase();
    const same = mtls.find(e => e.name.replace(/\.[^.]+$/, '').toLowerCase() === stem);
    const pick = same || (mtls.length === 1 ? mtls[0] : null);
    if (pick) { mtlEntries.push(pick); missingMtl.length = 0; }
  }
  if (missingMtl.length) ctx.warn('Materials file ' + missingMtl.join(', ') + ' was not dropped with the model, so it shows in the default colour.');

  let creator = null;
  if (mtlEntries.length) {
    const mtlText = (await Promise.all(mtlEntries.map(e => files.text(e)))).join('\n');
    const mtlLoader = new MTLLoader(manager);
    mtlLoader.setMaterialOptions({ side: THREE.DoubleSide });
    creator = mtlLoader.parse(mtlText, '');
    creator.preload();
  }

  const loader = new OBJLoader(manager);
  if (creator) loader.setMaterials(creator);
  let group;
  try { group = loader.parse(splitPrimitiveRuns(text)); } catch (e) { throw new ModelError('This OBJ file could not be read (' + e.message + ').'); }
  if (!hasGeometry(group)) throw new ModelError('This OBJ file has no faces, lines or points that can be drawn.');

  // A part whose usemtl had no match in the MTL (or no MTL at all) got a
  // plain white material from the loader: give it the default look instead.
  const known = new Set(creator ? Object.values(creator.materials) : []);
  group.traverse(o => {
    if (!o.material) return;
    const fix = m => {
      if (known.has(m)) return m;
      if (!o.isMesh) { if (!m.vertexColors) m.userData.o3vDefault = true; return m; }
      return defaultMaterial({ vertexColors: m.vertexColors, flatShading: m.flatShading, name: m.name });
    };
    o.material = Array.isArray(o.material) ? o.material.map(fix) : fix(o.material);
  });

  // MTL textures load in the background: wait so the first frame has them.
  await manager.settled();
  return { object: group };
}

/* Two things OBJLoader gets wrong with lines and points, put right in the text:
   - it gives each object one primitive type (faces, lines or points, whichever
     came last), so an object that mixes them would draw its faces as points:
     a new group starts wherever the type changes;
   - it draws a polyline "l 1 2 3 4" as separate pairs (1-2, 3-4): each
     polyline becomes its consecutive two-point segments. */
export function splitPrimitiveRuns(text) {
  if (!/^[ \t]*[lp][ \t]/m.test(text)) return text;
  const lines = text.split(/\r?\n/);
  const out = [];
  const label = { f: 'faces', l: 'lines', p: 'points' };
  let kind = '', n = 0, declared = false;
  for (const line of lines) {
    const m = /^[ \t]*(f|l|p|o|g)(?=[ \t]|$)/.exec(line);
    if (m) {
      const k = m[1];
      if (k === 'o' || k === 'g') { kind = ''; declared = true; }
      else {
        // The loader folds its first group into the unnamed object it starts
        // with, so the first run needs a group of its own too.
        if (!declared) { out.push('g ' + label[k] + '_' + (++n)); declared = true; }
        else if (kind && k !== kind) out.push('g ' + label[k] + '_' + (++n));
        kind = k;
        if (k === 'l') {
          const v = line.trim().split(/\s+/).slice(1);
          if (v.length > 2) { for (let i = 0; i + 1 < v.length; i++) out.push('l ' + v[i] + ' ' + v[i + 1]); continue; }
        }
      }
    }
    out.push(line);
  }
  return out.join('\n');
}
