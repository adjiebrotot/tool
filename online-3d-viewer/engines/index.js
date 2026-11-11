/* The engine registry: which file goes to which engine, and the load of a
   whole drop (a model plus the files it refers to).

   Each format has its own engine module (./stl.js, ./step.js, …), imported
   only when a file of that format is opened, so the page carries none of
   them until it needs one. Every engine has the same shape:

       load(entry, ctx) → { object: THREE.Object3D, units?, animations? }

   where `entry` is the dropped file and `ctx` = { files, renderer, warn,
   progress }. model.js then turns the parts into the common model the viewer
   draws. A file is matched by its extension, and by its first bytes when the
   extension is missing or wrong. */

import { FileSet, extOf, baseName, headText, ModelError } from './common.js';

// up: the axis that points up in files of this format, by convention.
export const FORMATS = [
  { id: 'step', label: 'STEP', exts: ['step', 'stp', 'p21'], kind: 'cad', up: 'z', load: () => import('./step.js') },
  { id: 'iges', label: 'IGES', exts: ['iges', 'igs'], kind: 'cad', up: 'z', load: () => import('./iges.js') },
  { id: 'brep', label: 'BREP', exts: ['brep', 'brp'], kind: 'cad', up: 'z', load: () => import('./brep.js') },
  { id: '3dm', label: 'Rhino 3DM', exts: ['3dm'], kind: 'cad', up: 'z', load: () => import('./3dm.js') },
  { id: 'stl', label: 'STL', exts: ['stl'], kind: 'mesh', up: 'z', load: () => import('./stl.js') },
  { id: 'obj', label: 'OBJ', exts: ['obj'], kind: 'mesh', up: 'y', load: () => import('./obj.js') },
  { id: '3mf', label: '3MF', exts: ['3mf'], kind: 'mesh', up: 'z', load: () => import('./3mf.js') },
  { id: 'amf', label: 'AMF', exts: ['amf'], kind: 'mesh', up: 'z', load: () => import('./amf.js') },
  { id: 'gltf', label: 'glTF', exts: ['gltf', 'glb'], kind: 'scene', up: 'y', load: () => import('./gltf.js') },
  { id: 'fbx', label: 'FBX', exts: ['fbx'], kind: 'scene', up: 'y', load: () => import('./fbx.js') },
  { id: 'dae', label: 'COLLADA', exts: ['dae'], kind: 'scene', up: 'y', load: () => import('./dae.js') },
  { id: 'usd', label: 'USD', exts: ['usdz', 'usda', 'usdc', 'usd'], kind: 'scene', up: 'y', load: () => import('./usd.js') },
  { id: 'ply', label: 'PLY', exts: ['ply'], kind: 'mesh', up: 'y', load: () => import('./ply.js') },
  { id: '3ds', label: '3DS', exts: ['3ds'], kind: 'mesh', up: 'z', load: () => import('./3ds.js') },
  { id: 'off', label: 'OFF', exts: ['off'], kind: 'mesh', up: 'y', load: () => import('./off.js') },
  { id: 'vrml', label: 'VRML', exts: ['wrl', 'vrml'], kind: 'scene', up: 'y', load: () => import('./vrml.js') },
];

/** Files a model refers to: materials, buffers, textures. Never opened on their own. */
export const COMPANIONS = ['mtl', 'bin', 'png', 'jpg', 'jpeg', 'jfif', 'webp', 'gif', 'bmp', 'tga', 'tif', 'tiff', 'ktx2', 'ktx', 'dds', 'avif', 'hdr', 'exr', 'basis'];

const BY_EXT = new Map();
for (const f of FORMATS) for (const e of f.exts) BY_EXT.set(e, f);
const BY_ID = new Map(FORMATS.map(f => [f.id, f]));

export function formatOf(name) { return BY_EXT.get(extOf(name)) || null; }
export function formatById(id) { return BY_ID.get(id) || null; }
export const ACCEPT = [...FORMATS.flatMap(f => f.exts), ...COMPANIONS, 'zip'].map(e => '.' + e).join(',');

/** The format a file's own signature names beyond doubt (a magic number or
    a header no other format starts with), or null. A file whose signature
    disagrees with its extension is opened by its signature. */
export function sniffStrong(buffer) {
  if (!buffer || buffer.byteLength < 4) return null;
  const h = headText(buffer, 2048);
  if (h.startsWith('glTF')) return 'gltf';
  if (h.startsWith('Kaydara FBX Binary')) return 'fbx';
  if (/^\s*ISO-10303-21;/.test(h)) return 'step';
  if (/^ply\r?\n/.test(h)) return 'ply';
  if (/^#VRML V2\.0/.test(h)) return 'vrml';
  if (h.startsWith('PXR-USDC') || /^#usda\s/.test(h)) return 'usd';
  if (h.startsWith('3D Geometry File Format')) return '3dm';
  if (/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<COLLADA[\s>]/i.test(h)) return 'dae';
  if (h.startsWith('PK') && /3D\/3dmodel\.model/i.test(h)) return '3mf';
  return null;
}

/** Which format the bytes say a file is, or null. Used when the extension
    is missing, unknown, or turns out to be wrong. */
export function sniff(buffer, size = buffer ? buffer.byteLength : 0) {
  if (!buffer || buffer.byteLength < 4) return null;
  const h = headText(buffer, 2048);
  const u8 = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 2048));
  if (h.startsWith('glTF')) return 'gltf';
  if (h.startsWith('Kaydara FBX Binary') || /^\s*;\s*FBX \d/.test(h)) return 'fbx';
  if (/^\s*ISO-10303-21/.test(h)) return 'step';
  if (/^ply\s/.test(h)) return 'ply';
  if (/^#VRML V2\.0/.test(h)) return 'vrml';
  if (/^#usda\s/.test(h) || h.startsWith('PXR-USDC')) return 'usd';
  if (h.startsWith('3D Geometry File Format')) return '3dm';
  if (/DBRep_DrawableShape|CASCADE Topology/.test(h.slice(0, 256))) return 'brep';
  if (/^(ST)?C?N?OFF(\s|$)/.test(h)) return 'off';
  if (/<COLLADA[\s>]/i.test(h)) return 'dae';
  if (/<amf[\s>]/i.test(h)) return 'amf';
  if (h.startsWith('PK')) {
    // A zip: look at the names in its first local headers.
    if (/3D\/3dmodel\.model/i.test(h)) return '3mf';
    if (/\.usd[ac]?/i.test(h)) return 'usd';
    if (/\.amf/i.test(h)) return 'amf';
    return null;
  }
  if (u8[0] === 0x4D && u8[1] === 0x4D && buffer.byteLength >= 6) {
    const len = new DataView(buffer).getUint32(2, true);
    if (len > 16 && len <= size + 16) return '3ds';   // the main chunk spans the file
  }
  if (/^\s*solid[\s\S]*?facet\s/i.test(h)) return 'stl';
  // Binary STL: an 80-byte header, then a triangle count that fixes the file size.
  if (buffer.byteLength >= 84 && 84 + new DataView(buffer).getUint32(80, true) * 50 === size) return 'stl';
  if (/^.{72}[SGCB][ 0-9]{7}\s*$/m.test(h)) return 'iges';
  if (/^\s*\{[\s\S]*"asset"\s*:/.test(h)) return 'gltf';
  if (/^\s*v\s+-?[\d.]/m.test(h) && /^\s*(f|l|p|o|g|usemtl|mtllib)\s/m.test(h)) return 'obj';
  return null;
}

/**
 * Loads everything a reader dropped.
 * @param {{file: Blob, name: string, path?: string}[]} list
 * @param {{renderer?: any, progress?: (msg: string) => void}} opts
 * @returns {Promise<{parts: object[], files: FileSet, warnings: string[]}>}
 */
export async function loadFiles(list, opts = {}) {
  const warnings = [];
  const progress = opts.progress || (() => {});
  const warn = msg => { if (msg && !warnings.includes(msg)) warnings.push(msg); };
  list = await unpackZips(list, warn, progress);
  const files = new FileSet(list);

  // Which dropped files are models? By extension, else by content.
  const models = [];
  const unknown = [];
  for (const e of files.entries) {
    const f = BY_EXT.get(e.ext);
    if (f) { models.push({ entry: e, format: f }); continue; }
    if (COMPANIONS.includes(e.ext)) continue;
    const id = sniff(await e.file.slice(0, 4096).arrayBuffer(), e.file.size);
    if (id) models.push({ entry: e, format: BY_ID.get(id) });
    else unknown.push(e.name);
  }

  if (!models.length) {
    files.dispose();
    if (unknown.length) {
      throw new ModelError((unknown.length === 1 ? unknown[0] + ' is not' : unknown.slice(0, 3).join(', ') + (unknown.length > 3 ? '…' : '') + ' are not') + ' a 3D model this viewer can read.');
    }
    const names = files.entries.map(e => e.name);
    throw new ModelError(names.length
      ? 'Only ' + names.slice(0, 3).join(', ') + (names.length > 3 ? '…' : '') + ' came in: these belong to a model. Drop the model file (.obj, .gltf, …) together with them.'
      : 'No file came in. Drop a 3D model file, or a folder that holds one.');
  }
  if (unknown.length) warn('Skipped ' + unknown.slice(0, 3).join(', ') + (unknown.length > 3 ? ' and ' + (unknown.length - 3) + ' more' : '') + ': not a 3D model or a file a model uses.');

  const parts = [];
  const errors = [];
  // One try of one engine; its warnings count only if it succeeds.
  const attempt = async (format, entry) => {
    const own = [];
    const ctx = { files, renderer: opts.renderer || null, warn: m => own.push(m), progress };
    const part = await runEngine(format, entry, ctx);
    own.forEach(warn);
    return part;
  };
  const misnamed = (entry, f) => warn(entry.name + ' is named .' + entry.ext + ' but holds ' + f.label + ', so it was opened as ' + f.label + '.');
  for (let { entry, format } of models) {
    progress('Reading ' + entry.name + '…');
    // A signature that names another format wins over the extension.
    const strong = sniffStrong(await entry.file.slice(0, 2048).arrayBuffer());
    if (strong && strong !== format.id && entry.ext && BY_EXT.has(entry.ext)) {
      format = BY_ID.get(strong);
      misnamed(entry, format);
    }
    try {
      parts.push(await attempt(format, entry));
    } catch (err) {
      // Named one thing, holding another? Try the format the bytes say.
      let retried = null;
      if (err && err.friendly) {
        const id = sniff(await files.buffer(entry), entry.file.size);
        const other = id && id !== format.id ? BY_ID.get(id) : null;
        if (other) {
          try {
            retried = await attempt(other, entry);
            misnamed(entry, other);
          } catch (e2) { retried = null; }
        }
      }
      if (retried) parts.push(retried);
      else errors.push({ name: entry.name, error: err });
    }
  }

  if (!parts.length) {
    files.dispose();
    const e = errors[0].error;
    const msg = e && e.friendly ? e.message : 'This file could not be opened (' + (e && e.message || e) + ').';
    throw new ModelError(errors.length > 1 ? errors[0].name + ': ' + msg : msg);
  }
  for (const { name, error } of errors) warn(name + ' could not be opened: ' + (error && error.friendly ? error.message : String(error && error.message || error)));

  const missing = [...files.missing].filter(n => n && !warnings.some(w => w.includes(n)));
  if (missing.length) warn('Not among the dropped files: ' + missing.slice(0, 4).join(', ') + (missing.length > 4 ? ' and ' + (missing.length - 4) + ' more' : '') + '. Drop them with the model to see them.');

  return { parts, files, warnings };
}

/* A .zip (how models are often downloaded: an OBJ with its MTL and textures)
   is opened in the browser and its files join the drop, under a folder of the
   zip's name. 3MF and USDZ are zips too, but are named as such and stay whole. */
async function unpackZips(list, warn, progress) {
  if (!list.some(it => extOf(it.name || it.path) === 'zip')) return list;
  const { unzipSync } = await import('three/addons/libs/fflate.module.js');
  const out = [];
  for (const it of list) {
    if (extOf(it.name || it.path) !== 'zip') { out.push(it); continue; }
    progress('Opening ' + it.name + '…');
    let entries;
    try {
      entries = unzipSync(new Uint8Array(await it.file.arrayBuffer()), {
        // Folders, macOS resource forks and hidden files are not part of the model.
        filter: f => !f.name.endsWith('/') && !/(^|\/)(__MACOSX|\.[^/]*)(\/|$)/.test(f.name),
      });
    } catch (e) {
      warn(it.name + ' could not be opened as a zip archive, so it was skipped.');
      continue;
    }
    const folder = (it.path || it.name).replace(/\.zip$/i, '');
    for (const [p, bytes] of Object.entries(entries)) out.push({ file: new Blob([bytes]), name: baseName(p), path: folder + '/' + p });
  }
  return out;
}

async function runEngine(format, entry, ctx) {
  const mod = await format.load();
  const out = await mod.load(entry, ctx);
  return {
    object: out.object,
    format,
    name: entry.name,
    up: out.up || format.up,
    units: out.units === undefined ? null : out.units,
    animations: out.animations || [],
  };
}
