/* DAE engine (COLLADA, the XML exchange format).

   Scenes, materials, textures, skins and animations are read. The loader
   applies the file's unit (so sizes read in metres) and its up axis (Z-up
   files are turned Y up). */

import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';
import { managerFor, requireBytes, decodeText, ModelError, hasGeometry } from './common.js';

export async function load(entry, ctx) {
  const buffer = await ctx.files.buffer(entry);
  requireBytes(buffer, 40, 'DAE');
  const text = decodeText(buffer);
  if (!/<COLLADA[\s>]/i.test(text.slice(0, 4096))) throw new ModelError('This is not a COLLADA file: it has no <COLLADA> element.');

  const manager = managerFor(ctx.files);
  let collada;
  const err = console.error;
  let parserError = '';
  console.error = (...a) => { const s = a.map(String).join(' '); if (/ColladaLoader|ColladaParser/.test(s)) parserError = s; else err.apply(console, a); };
  try { collada = new ColladaLoader(manager).parse(text, ''); } catch (e) {
    throw new ModelError('This COLLADA file could not be read (' + e.message + ').');
  } finally { console.error = err; }
  if (!collada || !collada.scene) {
    throw new ModelError('This COLLADA file could not be read' + (/version/i.test(parserError) ? ': only COLLADA 1.4 and 1.5 are supported.' : ': its XML is damaged.'));
  }
  if (!hasGeometry(collada.scene)) throw new ModelError('This COLLADA file has no geometry in its scene.');
  await manager.settled();
  return { object: collada.scene, animations: collada.scene.animations || collada.animations || [], units: 'm' };
}
