/* 3DM engine (Rhinoceros 3D, versions 4 to 8).

   Rhino stores exact NURBS surfaces (B-reps, extrusions, SubD) with a render
   mesh beside them; rhino3dm, McNeel's own reader compiled to WebAssembly,
   reads the file in a worker and hands over the meshes, curves, points and
   materials. The reader (about 9 MB, 3 MB compressed) is fetched the first
   time a 3DM file is opened. Rhino is Z up; the unit is the file's own. A
   surface saved without its render mesh ("Save small") has nothing to draw. */

import { Rhino3dmLoader } from 'three/addons/loaders/3DMLoader.js';
import { requireBytes, headText, ModelError, hasGeometry } from './common.js';
import { RHINO_BASE } from './cdn.js';

// ON::LengthUnitSystem
const UNITS = { 1: 'µm', 2: 'mm', 3: 'cm', 4: 'm', 5: 'km', 8: 'in', 9: 'ft', 10: 'mi' };

export async function load(entry, ctx) {
  const buffer = await ctx.files.buffer(entry);
  requireBytes(buffer, 40, '3DM');
  if (!/^3D Geometry File Format/.test(headText(buffer, 32))) throw new ModelError('This is not a Rhino 3DM file: its header is missing.');

  ctx.progress('Loading the Rhino reader (about 3 MB, once)…');
  const loader = new Rhino3dmLoader();
  loader.setLibraryPath(RHINO_BASE);
  loader.setWorkerLimit(1);
  let object;
  try {
    object = await loader.parseAsync(buffer);
  } catch (e) {
    throw new ModelError('This 3DM file could not be read (' + String(e && e.message || e) + ').');
  } finally {
    loader.dispose();
  }
  if (!object || !hasGeometry(object)) {
    throw new ModelError('This 3DM file has nothing to draw. Its surfaces may have been saved without render meshes ("Save small"): open it in Rhino, shade it and save again.');
  }
  const warnings = (object.userData && object.userData.warnings) || [];
  const skipped = warnings.filter(w => w && /not supported|no render mesh/i.test(w.message || '')).length;
  if (skipped) ctx.warn(skipped + ' object' + (skipped > 1 ? 's' : '') + ' in this 3DM file could not be drawn (no render mesh, or a type the reader does not support).');

  const s = object.userData && object.userData.settings;
  const u = s && s.modelUnitSystem;
  const code = u && typeof u === 'object' ? u.value : u;
  return { object, units: UNITS[code] || null };
}
