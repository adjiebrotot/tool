/* IGES engine (Initial Graphics Exchange Specification, .igs / .iges).

   The older neutral CAD format, still common for surfaces. OpenCascade reads
   and triangulates it (see occt.js); a file of curves only has nothing to
   draw. Converted to millimetres; Z up. */

import { readCad } from './occt.js';
import { requireBytes, headText, ModelError } from './common.js';

export async function load(entry, ctx) {
  const buffer = await ctx.files.buffer(entry);
  requireBytes(buffer, 80, 'IGES');
  // Fixed 80-column records: columns 73-80 name the section (S, G, …) and number the line.
  if (!/^.{72}[SGCB][ 0-9]{7}\s*$/m.test(headText(buffer, 2048))) {
    throw new ModelError('This is not an IGES file: it does not have IGES start and global records.');
  }
  const object = await readCad('iges', 'IGES', buffer, ctx);
  return { object, units: 'mm' };
}
