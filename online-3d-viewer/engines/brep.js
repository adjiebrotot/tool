/* BREP engine (OpenCascade's own boundary-representation file, .brep).

   FreeCAD and other OpenCascade-based tools write it. It is read and
   triangulated by OpenCascade itself (see occt.js). A BREP carries no unit;
   Z up. */

import { readCad } from './occt.js';
import { requireBytes, headText, ModelError } from './common.js';

export async function load(entry, ctx) {
  const buffer = await ctx.files.buffer(entry);
  requireBytes(buffer, 32, 'BREP');
  if (!/DBRep_DrawableShape|CASCADE Topology/.test(headText(buffer, 512))) {
    throw new ModelError('This is not an OpenCascade BREP file: its "CASCADE Topology" header is missing.');
  }
  const object = await readCad('brep', 'BREP', buffer, ctx);
  return { object, units: null };
}
