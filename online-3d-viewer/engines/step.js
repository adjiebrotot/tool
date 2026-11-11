/* STEP engine (ISO 10303-21: AP203, AP214 and AP242 parts and assemblies).

   STEP is the neutral exchange format of mechanical CAD (SolidWorks,
   Inventor, Fusion, Creo, CATIA, NX, FreeCAD all write it). Its solids are
   exact surfaces, so OpenCascade triangulates them (see occt.js). Converted
   to millimetres; Z up. */

import { readCad } from './occt.js';
import { requireBytes, headText, ModelError } from './common.js';

export async function load(entry, ctx) {
  const buffer = await ctx.files.buffer(entry);
  requireBytes(buffer, 64, 'STEP');
  const head = headText(buffer, 1024);
  if (!/ISO-10303-21/.test(head)) {
    if (/ISO-10303-28|<\?xml/.test(head)) throw new ModelError('This is STEP in XML form (ISO 10303-28), which cannot be read. Export it as a regular STEP file (.stp).');
    throw new ModelError('This is not a STEP file: it does not start with ISO-10303-21.');
  }
  let object;
  try {
    object = await readCad('step', 'STEP', buffer, ctx);
  } catch (e) {
    // An assembly whose parts live in other files (AP214 external references)
    // has no geometry of its own; say which files it points to.
    // (The buffer went to the worker; read the file again.)
    const refs = e.friendly ? [...(await ctx.files.text(entry)).matchAll(/DOCUMENT_FILE\s*\(\s*'([^']+)'/g)].map(m => m[1]) : [];
    if (e.friendly && refs.length) {
      const names = [...new Set(refs)];
      throw new ModelError('This STEP file is an assembly that keeps its parts in separate files (' + names.slice(0, 3).join(', ') + (names.length > 3 ? ', …' : '') + '). Open a part file, or export the assembly from CAD as one STEP file.');
    }
    throw e;
  }
  return { object, units: 'mm' };
}
