/* PLY engine (Stanford polygon file, ASCII and binary, either byte order).

   A PLY with faces is a mesh; one with vertices only is a point cloud (a 3D
   scan), drawn as points sized to the model. Vertex colours are kept. Units
   and the up axis are not recorded; scans are most often Z up. */

import * as THREE from 'three';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { defaultMaterial, requireBytes, headText, ModelError } from './common.js';

export async function load(entry, ctx) {
  const buffer = await ctx.files.buffer(entry);
  requireBytes(buffer, 20, 'PLY');
  if (!/^ply\s/.test(headText(buffer, 8))) throw new ModelError('This is not a PLY file: it does not start with "ply".');
  if (!/end_header/.test(headText(buffer, 65536))) throw new ModelError('This PLY file has no end_header line, so its layout cannot be read.');

  let geometry;
  try { geometry = new PLYLoader().parse(buffer); } catch (e) {
    throw new ModelError('This PLY file could not be read (' + e.message + '). It may be cut short.');
  }
  const pos = geometry.getAttribute('position');
  if (!pos || pos.count === 0) throw new ModelError('This PLY file holds no vertices.');

  const coloured = !!geometry.getAttribute('color');
  const name = entry.name.replace(/\.[^.]+$/, '');

  if (!geometry.index || geometry.index.count === 0) {
    // Vertices only: a point cloud.
    const mat = new THREE.PointsMaterial({ size: 1, sizeAttenuation: true, vertexColors: coloured });
    if (!coloured) mat.userData.o3vDefault = true;
    mat.userData.o3vPointSize = true;   // the viewer sizes points to the model
    const pts = new THREE.Points(geometry, mat);
    pts.name = name;
    return { object: pts };
  }

  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
  const material = defaultMaterial({ vertexColors: coloured });

  // A textured scan names its image in the header: "comment TextureFile x.png".
  const tex = /comment\s+TextureFile\s+(.+?)\s*$/m.exec(headText(buffer, 65536));
  if (tex && geometry.getAttribute('uv')) {
    const hit = ctx.files.find(tex[1]);
    if (hit) {
      const map = await new THREE.TextureLoader().loadAsync(ctx.files.url(hit)).catch(() => null);
      if (map) {
        map.colorSpace = THREE.SRGBColorSpace;
        material.map = map;
        material.vertexColors = false;
        delete material.userData.o3vDefault;
      }
    } else {
      ctx.files.missing.add(tex[1]);
    }
  }

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  return { object: mesh };
}
