/* 3DS engine (Autodesk 3D Studio, the binary chunk format).

   Meshes, their materials and textures (dropped beside the file) are read.
   3DS has no unit and is Z up. */

import { TDSLoader } from 'three/addons/loaders/TDSLoader.js';
import { managerFor, requireBytes, ModelError, hasGeometry } from './common.js';

export async function load(entry, ctx) {
  const buffer = await ctx.files.buffer(entry);
  requireBytes(buffer, 16, '3DS');
  const dv = new DataView(buffer);
  if (dv.getUint16(0, true) !== 0x4D4D) throw new ModelError('This is not a 3DS file: it does not start with the 3DS main chunk.');

  const manager = managerFor(ctx.files);
  let group;
  try { group = new TDSLoader(manager).parse(buffer, ''); } catch (e) {
    throw new ModelError('This 3DS file could not be read (' + e.message + '). It may be cut short.');
  }
  if (!group || !hasGeometry(group)) throw new ModelError('This 3DS file has no meshes in it.');
  await manager.settled();
  return { object: group };
}
