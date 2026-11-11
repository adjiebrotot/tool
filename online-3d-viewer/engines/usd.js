/* USD engine (Universal Scene Description: .usdz packages, .usda text and
   .usdc binary layers, as Apple's AR Quick Look and Omniverse use).

   Meshes, materials and the textures packed in a USDZ are read. The loader
   applies the stage's metersPerUnit (sizes then read in metres) and turns a
   Z-up stage Y up. References to layers outside the file are not followed. */

import { USDLoader } from 'three/addons/loaders/USDLoader.js';
import { managerFor, requireBytes, headText, ModelError, hasGeometry } from './common.js';

export async function load(entry, ctx) {
  const buffer = await ctx.files.buffer(entry);
  requireBytes(buffer, 16, 'USD');
  const head = headText(buffer, 16);
  const zip = head.slice(0, 2) === 'PK';
  const crate = head.slice(0, 8) === 'PXR-USDC';
  if (!zip && !crate && !/^#usda\s/.test(head)) throw new ModelError('This is not a USD file: it is neither a USDZ package, a USDA text layer nor a USDC binary layer.');

  const manager = managerFor(ctx.files);
  let group;
  try {
    group = await new Promise((resolve, reject) => {
      const loader = new USDLoader(manager);
      loader.parse(buffer, '', resolve, reject);
    });
  } catch (e) {
    throw new ModelError('This USD file could not be read (' + String(e && e.message || e).replace(/^THREE\.USDLoader:\s*/, '') + ').');
  }
  if (!group || !hasGeometry(group)) throw new ModelError('This USD file has no meshes in it.');
  await manager.settled();
  // The loader scales to metres only when the stage states metersPerUnit.
  return { object: group, units: group.scale.x !== 1 ? 'm' : null };
}
