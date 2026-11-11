/* 3MF engine (3D Manufacturing Format, the 3D-printing package).

   A 3MF is a zip holding an XML model (3D/3dmodel.model), its build items,
   colours, materials and textures. Its unit is written in the model
   (millimetre unless it says otherwise) and it is Z up. */

import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';
import { unzipSync, strFromU8 } from 'three/addons/libs/fflate.module.js';
import { requireBytes, headText, ModelError, hasGeometry } from './common.js';

const UNITS = { micron: 'µm', millimeter: 'mm', centimeter: 'cm', inch: 'in', foot: 'ft', meter: 'm' };

export async function load(entry, ctx) {
  const buffer = await ctx.files.buffer(entry);
  requireBytes(buffer, 22, '3MF');
  if (headText(buffer, 2) !== 'PK') throw new ModelError('This is not a 3MF file: a 3MF is a zip package, and this file is not one.');

  let unit = 'millimeter';
  try {
    const zip = unzipSync(new Uint8Array(buffer), { filter: f => /\.model$/i.test(f.name) });
    const names = Object.keys(zip);
    if (!names.length) throw new ModelError('This 3MF package has no 3D model inside it.');
    const main = names.find(n => /^3D\/3dmodel\.model$/i.test(n)) || names[0];
    const m = /<model\b[^>]*\bunit\s*=\s*["']([a-z]+)["']/i.exec(strFromU8(zip[main]).slice(0, 4096));
    if (m) unit = m[1].toLowerCase();
  } catch (e) {
    if (e.friendly) throw e;
    throw new ModelError('This 3MF package is damaged: its zip could not be opened.');
  }

  let group;
  try { group = new ThreeMFLoader().parse(buffer); } catch (e) {
    throw new ModelError('This 3MF file could not be read (' + e.message + ').');
  }
  if (!group || !hasGeometry(group)) throw new ModelError('This 3MF file has no printable objects in its build.');
  return { object: group, units: UNITS[unit] || null };
}
