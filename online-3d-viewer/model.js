/* The common model: what every engine's output becomes before the viewer
   draws it, whichever format it came from.

   - one Group (`content`) holding every part, in the file's own axes;
   - `up`: which file axis points up ('y' or 'z'); the viewer turns the model
     so that axis is up on screen, and a reader can flip it;
   - materials made consistent: a part with no colour of its own is marked
     for the page's model colour, faces show from both sides (CAD and print
     files often face the wrong way) except where glTF / USD say otherwise,
     and every mesh has normals;
   - stats counted the same way for every format: parts, triangles, unique
     vertex positions, points, line segments, materials, textures;
   - size: the bounding box along the file's own X, Y and Z, in its unit. */

import * as THREE from 'three';

const KEEPS_SIDES = new Set(['gltf', 'usd']);   // these formats state single or double sided per material

export function buildModel(loaded) {
  const { parts, warnings } = loaded;
  const content = new THREE.Group();
  content.name = 'model';

  // The up axis most parts use is the model's; a part that differs is turned to match.
  const ups = parts.map(p => p.up);
  const up = ups.filter(u => u === 'z').length > ups.length / 2 ? 'z' : 'y';
  for (const p of parts) {
    const holder = new THREE.Group();
    holder.name = p.name;
    if (p.up !== up) holder.rotation.x = p.up === 'z' ? -Math.PI / 2 : Math.PI / 2;
    holder.add(p.object);
    content.add(holder);
  }

  for (const p of parts) prepare(p.object, p.format.id);
  content.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(content);
  const units = [...new Set(parts.map(p => p.units))];
  const formats = [...new Set(parts.map(p => p.format.label))];
  return {
    content,
    up,
    box,
    size: box.isEmpty() ? new THREE.Vector3() : box.getSize(new THREE.Vector3()),
    units: units.length === 1 ? units[0] : null,
    formats,
    kinds: [...new Set(parts.map(p => p.format.kind))],
    names: parts.map(p => p.name),
    animations: parts.flatMap(p => p.animations || []),
    stats: countStats(content),
    warnings: warnings.slice(),
  };
}

/** Is this the stand-in material a loader gives a part the file did not colour? */
function isStandIn(m) {
  if (!m) return false;
  if (m.userData && m.userData.o3vDefault) return true;
  if (m.name === THREE.Loader.DEFAULT_MATERIAL_NAME) return true;
  // FBX, COLLADA, 3DS and VRML loaders fall back to a nameless white material.
  return m.name === '' && !m.map && !m.vertexColors && m.color && m.color.r === 1 && m.color.g === 1 && m.color.b === 1
    && (m.isMeshPhongMaterial || m.isMeshLambertMaterial || m.isMeshBasicMaterial || m.isMeshStandardMaterial || m.isLineBasicMaterial || m.isPointsMaterial);
}

function prepare(object, formatId) {
  object.traverse(o => {
    if (!o.material) return;
    const g = o.geometry;
    if (o.isMesh && g && g.getAttribute('position') && !g.getAttribute('normal')) g.computeVertexNormals();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      // A texture whose file was missing or unreadable would sample as black;
      // without it the part shows its own colour.
      for (const k of Object.keys(m)) {
        const t = m[k];
        if (t && t.isTexture && !t.isRenderTargetTexture && t.image == null) { m[k] = null; m.needsUpdate = true; }
      }
      if (isStandIn(m)) m.userData.o3vDefault = true;
      if (o.isMesh && !KEEPS_SIDES.has(formatId)) m.side = THREE.DoubleSide;
      if (o.isPoints) m.userData.o3vPointSize = true;
      // A vertex-colour flag with no colours to read paints a part black.
      if (m.vertexColors && g && !g.getAttribute('color')) m.vertexColors = false;
    }
    o.frustumCulled = !o.isSkinnedMesh;   // a skinned mesh's box is its bind pose; never cull it away
  });
}

// ── Stats ────────────────────────────────────────────────────────────────

export function countStats(root) {
  const s = { parts: 0, triangles: 0, vertices: 0, points: 0, segments: 0, materials: 0, textures: 0 };
  const mats = new Set(), texs = new Set();
  const uniqueCache = new Map();
  root.traverse(o => {
    const g = o.geometry;
    const pos = g && g.getAttribute && g.getAttribute('position');
    if (!pos || !o.visible) return;
    const copies = o.isInstancedMesh ? o.count : 1;
    const n = Math.min(g.index ? g.index.count : pos.count, g.drawRange.count);
    if (o.isMesh) {
      s.parts += copies;
      s.triangles += Math.floor(n / 3) * copies;
      if (!uniqueCache.has(g)) uniqueCache.set(g, uniquePositions(pos));
      s.vertices += uniqueCache.get(g) * copies;
    } else if (o.isPoints) {
      s.points += n * copies;
    } else if (o.isLine) {
      s.segments += (o.isLineSegments ? Math.floor(n / 2) : Math.max(0, n - 1)) * copies;
    } else return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m) continue;
      mats.add(m);
      for (const k in m) { const v = m[k]; if (v && v.isTexture) texs.add(v.source || v); }
    }
  });
  s.materials = mats.size;
  s.textures = texs.size;
  return s;
}

/* Distinct vertex positions (exact float equality), so a cube reads as 8
   vertices whether its file shares corners (OBJ, PLY) or repeats them per
   face (STL, glTF with split normals). Open addressing on the float bits. */
const scratch = new Float32Array(3);
const bits = new Uint32Array(scratch.buffer);
function uniquePositions(attr) {
  const n = attr.count;
  if (n === 0) return 0;
  if (n > 30e6) return n;            // too many to be worth hashing; report as stored
  let size = 1;
  while (size < n * 2) size <<= 1;
  const mask = size - 1;
  const table = new Int32Array(size).fill(-1);
  const keys = new Uint32Array(n * 3);
  let unique = 0;
  for (let i = 0; i < n; i++) {
    scratch[0] = attr.getX(i); scratch[1] = attr.getY(i); scratch[2] = attr.getZ(i);
    // -0 and +0 are the same point.
    for (let k = 0; k < 3; k++) if (scratch[k] === 0) scratch[k] = 0;
    const a = bits[0], b = bits[1], c = bits[2];
    let h = (Math.imul(a, 0x9E3779B1) ^ Math.imul(b, 0x85EBCA77) ^ Math.imul(c, 0xC2B2AE3D)) >>> 0;
    h = (h ^ (h >>> 15)) & mask;
    for (;;) {
      const slot = table[h];
      if (slot === -1) {
        table[h] = unique;
        keys[unique * 3] = a; keys[unique * 3 + 1] = b; keys[unique * 3 + 2] = c;
        unique++;
        break;
      }
      if (keys[slot * 3] === a && keys[slot * 3 + 1] === b && keys[slot * 3 + 2] === c) break;
      h = (h + 1) & mask;
    }
  }
  return unique;
}
