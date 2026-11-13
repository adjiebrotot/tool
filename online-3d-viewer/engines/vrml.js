/* VRML engine (VRML 2.0 / VRML97, .wrl).

   Shapes, materials, textures, transforms and colours are read. A Background
   node (a sky sphere 10 km wide) is left out, so it does not set the zoom.
   VRML is Y up and has no unit (metres by convention). VRML 1.0 is a
   different language and cannot be read. */

import { VRMLLoader } from 'three/addons/loaders/VRMLLoader.js';
import { managerFor, requireBytes, decodeText, ModelError, hasGeometry } from './common.js';

export async function load(entry, ctx) {
  const buffer = await ctx.files.buffer(entry);
  requireBytes(buffer, 12, 'VRML');
  const text = decodeText(buffer);
  const head = text.slice(0, 64);
  if (/^#VRML V1\.0/i.test(head)) throw new ModelError('This is a VRML 1.0 file. Only VRML 2.0 (VRML97) can be opened; convert it to VRML 2.0 or another format.');
  if (/^#X3D/i.test(head) || /<X3D[\s>]/i.test(text.slice(0, 2048))) throw new ModelError('This is an X3D file, which cannot be opened here. Export it as VRML 2.0 (.wrl) instead.');
  if (!/^#VRML V2\.0/i.test(head)) throw new ModelError('This is not a VRML 2.0 file: it does not start with "#VRML V2.0".');

  const manager = managerFor(ctx.files);
  let scene;
  try { scene = new VRMLLoader(manager).parse(text, ''); } catch (e) {
    throw new ModelError('This VRML file could not be read (' + String(e && e.message || e).slice(0, 160) + ').');
  }
  // Drop the Background group (a sky and ground sphere drawn first).
  for (const child of [...scene.children]) if (child.renderOrder === -Infinity) scene.remove(child);
  if (!hasGeometry(scene)) throw new ModelError('This VRML file has no shapes in it.');
  await manager.settled();
  return { object: scene };
}
