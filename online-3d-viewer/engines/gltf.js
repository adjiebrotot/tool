/* glTF engine (glTF 2.0: .gltf with its .bin and textures, or one .glb).

   glTF is three.js's own language, so the scene comes across whole: PBR
   materials, textures, cameras, skins and animations. Compressed files are
   decoded too, each decoder fetched only when the file asks for it: Draco and
   Meshopt geometry, KTX2 / Basis textures. glTF is in metres, Y up.

   A .gltf names its buffers and images as separate files; a missing buffer
   is reported by name before anything is parsed, a missing image as a
   warning (the model still shows, without that texture). */

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { managerFor, requireBytes, headText, decodeText, ModelError, hasGeometry, baseName } from './common.js';
import { DRACO_PATH, BASIS_PATH } from './cdn.js';

export async function load(entry, ctx) {
  const buffer = await ctx.files.buffer(entry);
  requireBytes(buffer, 12, 'glTF');

  const binary = headText(buffer, 4) === 'glTF';
  const json = readJson(buffer, binary);
  const version = String((json.asset && json.asset.version) || '');
  if (!/^2(\.|$)/.test(version)) {
    throw new ModelError('This is a glTF ' + (version || '1.0') + ' file. Only glTF 2.0 can be opened; re-export it as glTF 2.0.');
  }

  // Every external buffer must be here before parsing starts.
  const external = list => (list || []).map(x => x && x.uri).filter(u => u && !/^data:/i.test(u));
  const lost = external(json.buffers).filter(u => !ctx.files.find(u));
  if (lost.length) {
    throw new ModelError('This glTF keeps its geometry in ' + lost.map(baseName).join(', ') + '. Drop that file together with the .gltf.');
  }

  const used = new Set([...(json.extensionsUsed || []), ...(json.extensionsRequired || [])]);
  const manager = managerFor(ctx.files);
  const loader = new GLTFLoader(manager);
  const cleanup = [];

  if (used.has('KHR_draco_mesh_compression')) {
    const { DRACOLoader } = await import('three/addons/loaders/DRACOLoader.js');
    const draco = new DRACOLoader().setDecoderPath(DRACO_PATH);
    loader.setDRACOLoader(draco);
    cleanup.push(() => draco.dispose());
  }
  if (used.has('KHR_texture_basisu')) {
    const { KTX2Loader } = await import('three/addons/loaders/KTX2Loader.js');
    const ktx2 = new KTX2Loader(manager).setTranscoderPath(BASIS_PATH);
    if (ctx.renderer) ktx2.detectSupport(ctx.renderer);
    loader.setKTX2Loader(ktx2);
    cleanup.push(() => ktx2.dispose());
  }
  if (used.has('EXT_meshopt_compression') || used.has('KHR_meshopt_compression')) {
    const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
    loader.setMeshoptDecoder(MeshoptDecoder);
  }

  let gltf;
  try {
    gltf = await loader.parseAsync(buffer, '');
  } catch (e) {
    throw new ModelError('This glTF file could not be read (' + (e && e.message ? e.message : e) + ').');
  } finally {
    cleanup.forEach(f => { try { f(); } catch (e) { /* already gone */ } });
  }

  const scene = gltf.scene || (gltf.scenes && gltf.scenes[0]);
  if (!scene || !hasGeometry(scene)) throw new ModelError('This glTF file has no meshes in its scene.');
  await manager.settled();
  return { object: scene, animations: gltf.animations || [], units: 'm' };
}

function readJson(buffer, binary) {
  try {
    if (binary) {
      const dv = new DataView(buffer);
      const version = dv.getUint32(4, true);
      if (version !== 2) throw new ModelError('This is a version ' + version + ' GLB file. Only glTF 2.0 can be opened; re-export it as glTF 2.0.');
      const len = dv.getUint32(12, true);
      const type = dv.getUint32(16, true);
      if (type !== 0x4E4F534A || 20 + len > buffer.byteLength) throw new ModelError('This GLB file is damaged: its JSON header is missing or cut short.');
      return JSON.parse(decodeText(new Uint8Array(buffer, 20, len)));
    }
    return JSON.parse(decodeText(buffer));
  } catch (e) {
    if (e.friendly) throw e;
    throw new ModelError(binary ? 'This GLB file is damaged: its JSON header could not be read.' : 'This .gltf file is not valid JSON, so it is damaged or not a glTF.');
  }
}
