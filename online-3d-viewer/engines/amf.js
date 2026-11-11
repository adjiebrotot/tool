/* AMF engine (Additive Manufacturing File, plain XML or zipped).

   The loader converts every unit to millimetres, so sizes read in mm. AMF
   is Z up. Colours on objects, volumes and materials are kept. */

import { AMFLoader } from 'three/addons/loaders/AMFLoader.js';
import { requireBytes, headText, ModelError, hasGeometry } from './common.js';

export async function load(entry, ctx) {
  const buffer = await ctx.files.buffer(entry);
  requireBytes(buffer, 20, 'AMF');
  const head = headText(buffer, 2048);
  if (head.slice(0, 2) !== 'PK' && !/<amf[\s>]/i.test(head)) throw new ModelError('This is not an AMF file: it has no <amf> element.');

  let group;
  // The loader logs its unit scale on every load; keep the console quiet.
  const log = console.log;
  console.log = (...a) => { if (!/AMFLoader/.test(String(a[0]))) log.apply(console, a); };
  try { group = new AMFLoader().parse(buffer); } catch (e) {
    throw new ModelError('This AMF file could not be read (' + e.message + ').');
  } finally { console.log = log; }
  if (!group || !hasGeometry(group)) throw new ModelError('This AMF file has no objects with triangles in it.');
  return { object: group, units: 'mm' };
}
