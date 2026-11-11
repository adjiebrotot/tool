/* FBX engine (Autodesk FBX 7.x, binary and ASCII).

   Meshes, materials, textures (embedded or dropped beside the file), skins
   and animations come across. The loader turns a Z-up file Y up. FBX counts
   in centimetres times the file's UnitScaleFactor, which sets the unit shown.
   FBX 6 and older (2010 and before) cannot be read: re-save it from any
   current tool. */

import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { TGALoader } from 'three/addons/loaders/TGALoader.js';
import { managerFor, requireBytes, ModelError, hasGeometry } from './common.js';

const UNIT_OF_SCALE = [[0.1, 'mm'], [1, 'cm'], [2.54, 'in'], [30.48, 'ft'], [100, 'm']];

export async function load(entry, ctx) {
  const buffer = await ctx.files.buffer(entry);
  requireBytes(buffer, 32, 'FBX');

  const manager = managerFor(ctx.files);
  manager.addHandler(/\.tga$/i, new TGALoader(manager));

  let group;
  try { group = new FBXLoader(manager).parse(buffer, ''); } catch (e) {
    const msg = String(e && e.message || e);
    const v = /FileVersion: (\d+)/.exec(msg);
    if (v) throw new ModelError('This is an FBX ' + (Number(v[1]) / 1000).toFixed(1) + ' file. Only FBX 7.0 (2011) and newer can be opened; re-save it in a newer FBX version.');
    if (/Unknown format/.test(msg)) throw new ModelError('This is not an FBX file: it is neither binary nor ASCII FBX.');
    throw new ModelError('This FBX file could not be read (' + msg.replace(/^THREE\.FBXLoader:\s*/, '') + ').');
  }
  if (!group || !hasGeometry(group)) throw new ModelError('This FBX file has no meshes in it.');
  await manager.settled();

  const f = group.userData && group.userData.unitScaleFactor;
  const unit = f ? (UNIT_OF_SCALE.find(([s]) => Math.abs(s - f) < 1e-6) || [])[1] : 'cm';
  return { object: group, animations: group.animations || [], units: unit || null };
}
