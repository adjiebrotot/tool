/* Online 3D Viewer: saving the model in another format, so the viewer is a
   converter too.

   - STEP (ISO 10303-21, AP214): the triangles as flat faces. Triangles that
     lie in one plane and touch are merged back into one face (a CAD part's
     flat sides come out as single faces, holes and all); a closed part is a
     solid (FACETED_BREP), an open one a surface model; lines and curves are
     polylines. Part names and colours are kept. A mesh has no exact curves,
     so a cylinder stays faceted, as it was drawn.
   - STL (binary): every triangle, for 3D printing. No lines or points, no
     colour.
   - GLB (binary glTF 2.0): the whole scene, with materials, textures and any
     animation.

   What is written is what is on screen: the model in its current pose,
   turned so the up axis the reader chose is up in the target format (Z for
   STEP and STL, Y for glTF), in millimetres for STEP and STL and metres for
   glTF when the file named its unit, else in the file's own numbers. */

import * as THREE from 'three';

export const TO_MM = { 'µm': 0.001, mm: 1, cm: 10, m: 1000, km: 1e6, in: 25.4, ft: 304.8, mi: 1609344 };

/** The matrix that takes the model's own coordinates to the target's: the
    up axis turned (Y up ↔ Z up) and the unit scaled. */
export function targetMatrix(up, targetUp, scale) {
  const m = new THREE.Matrix4();
  if (up === 'y' && targetUp === 'z') m.makeRotationX(Math.PI / 2);        // Y → Z
  else if (up === 'z' && targetUp === 'y') m.makeRotationX(-Math.PI / 2);  // Z → Y
  // Exact zeros and ones, not cos(π/2)'s 6e-17.
  for (let i = 0; i < 16; i++) m.elements[i] = Math.round(m.elements[i]);
  if (scale !== 1) m.premultiply(new THREE.Matrix4().makeScale(scale, scale, scale));
  return m;
}

/** Every visible mesh, line and point set under `root`, with the matrix that
    takes its vertices into root's space (the overlay edges the viewer adds are
    not part of the model). */
function parts(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const out = [];
  root.traverse(o => {
    if (o.userData.o3vEdge || o.userData.o3vOverlay) return;
    if (!(o.isMesh || o.isLine || o.isPoints)) return;
    let hidden = false;
    for (let p = o; p && p !== root; p = p.parent) if (!p.visible) hidden = true;
    if (hidden || !o.geometry || !o.geometry.getAttribute('position')) return;
    const toRoot = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    if (o.isInstancedMesh) {
      const im = new THREE.Matrix4();
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, im);
        out.push({ object: o, matrix: toRoot.clone().multiply(im), copy: i });
      }
    } else out.push({ object: o, matrix: toRoot, copy: -1 });
  });
  return out;
}

/* A vertex where it is drawn: morph targets and skinning applied (the pose
   on screen), then placed. */
function vertexReader(object, matrix) {
  const v = new THREE.Vector3();
  const live = (object.isSkinnedMesh || object.morphTargetInfluences) && object.getVertexPosition;
  const pos = object.geometry.getAttribute('position');
  return (i, target) => {
    if (live) object.getVertexPosition(i, v); else v.fromBufferAttribute(pos, i);
    return target.copy(v).applyMatrix4(matrix);
  };
}

function materialAt(object, index) {
  const m = object.material;
  return Array.isArray(m) ? m[index] || m[0] : m;
}

/** sRGB 0-1 of a material the file coloured, or null for the viewer's own. */
function colourOf(material) {
  if (!material || !material.color || (material.userData && material.userData.o3vDefault)) return null;
  const c = material.color.clone();
  const out = { r: 0, g: 0, b: 0 };
  c.getRGB(out, THREE.SRGBColorSpace);
  return [out.r, out.g, out.b].map(x => Math.min(1, Math.max(0, x)));
}

/**
 * The model as plain triangles and polylines, in the target's coordinates.
 * @returns {{ meshes: {name, colour, positions: Float64Array}[], lines: {name, colour, points: number[][]}[], points: number, triangles: number }}
 */
export function collect(content, matrix) {
  const meshes = [], lines = [];
  let pointCount = 0, triangles = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (const { object: o, matrix: m, copy } of parts(content)) {
    const full = matrix.clone().multiply(m);
    const read = vertexReader(o, full);
    const g = o.geometry, index = g.index, pos = g.getAttribute('position');
    const count = Math.min(index ? index.count : pos.count, g.drawRange.count);
    const start = Math.max(0, g.drawRange.start);
    const at = i => (index ? index.getX(i) : i);
    const name = (o.name || (o.parent && o.parent.name) || '') + (copy >= 0 ? ' ' + (copy + 1) : '');
    if (o.isMesh) {
      // One part per material, so each keeps its colour.
      const groups = g.groups.length ? g.groups : [{ start: 0, count: Infinity, materialIndex: 0 }];
      for (const grp of groups) {
        const from = Math.max(start, grp.start), to = Math.min(start + count, grp.start + grp.count);
        const n = Math.floor((to - from) / 3);
        if (n <= 0) continue;
        const p = new Float64Array(n * 9);
        for (let t = 0; t < n; t++) {
          read(at(from + t * 3), a); read(at(from + t * 3 + 1), b); read(at(from + t * 3 + 2), c);
          p.set([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z], t * 9);
        }
        meshes.push({ name, colour: colourOf(materialAt(o, grp.materialIndex)), positions: p });
        triangles += n;
      }
    } else if (o.isLine) {
      const colour = colourOf(materialAt(o, 0));
      const pts = [];
      for (let i = start; i < start + count; i++) { read(at(i), a); pts.push([a.x, a.y, a.z]); }
      if (o.isLineSegments) {
        // Pairs: joined into runs where one segment starts at the last one's end.
        let run = null;
        for (let i = 0; i + 1 < pts.length; i += 2) {
          const p = pts[i], q = pts[i + 1];
          if (run && same(run[run.length - 1], p)) run.push(q);
          else { if (run) lines.push({ name, colour, points: run }); run = [p, q]; }
        }
        if (run) lines.push({ name, colour, points: run });
      } else if (pts.length > 1) {
        if (o.isLineLoop) pts.push(pts[0]);
        lines.push({ name, colour, points: pts });
      }
    } else if (o.isPoints) pointCount += count;
  }
  return { meshes, lines, points: pointCount, triangles };
}
const same = (p, q) => p[0] === q[0] && p[1] === q[1] && p[2] === q[2];

// ── STL ──────────────────────────────────────────────────────────────────

/** Binary STL: an 80-byte header, the triangle count, then 50 bytes a triangle. */
export function toStl(data, title) {
  const n = data.triangles;
  const buf = new ArrayBuffer(84 + n * 50);
  const dv = new DataView(buf);
  const head = ('Online 3D Viewer export: ' + title).slice(0, 80);
  for (let i = 0; i < head.length; i++) dv.setUint8(i, head.charCodeAt(i) & 0x7F);
  dv.setUint32(80, n, true);
  let o = 84;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nrm = new THREE.Vector3();
  for (const m of data.meshes) {
    const p = m.positions;
    for (let t = 0; t < p.length; t += 9) {
      a.fromArray(p, t); b.fromArray(p, t + 3); c.fromArray(p, t + 6);
      THREE.Triangle.getNormal(a, b, c, nrm);
      dv.setFloat32(o, nrm.x, true); dv.setFloat32(o + 4, nrm.y, true); dv.setFloat32(o + 8, nrm.z, true);
      for (let k = 0; k < 9; k++) dv.setFloat32(o + 12 + k * 4, p[t + k], true);
      dv.setUint16(o + 48, 0, true);
      o += 50;
    }
  }
  return new Blob([buf], { type: 'model/stl' });
}

// ── STEP ─────────────────────────────────────────────────────────────────

/** A STEP real: always with a decimal point, exponent in capitals. */
function real(v) {
  if (!Number.isFinite(v) || Math.abs(v) < 1e-300) return '0.';
  let s = String(parseFloat(v.toPrecision(12)));
  if (s.includes('e')) {
    let [m, e] = s.split('e');
    if (!m.includes('.')) m += '.';
    return m + 'E' + (e[0] === '+' ? e.slice(1) : e);
  }
  return s.includes('.') ? s : s + '.';
}

/** A STEP string: quotes doubled, anything beyond ASCII as \X2\ hex. */
function str(s) {
  let out = '';
  for (const ch of String(s == null ? '' : s)) {
    const code = ch.codePointAt(0);
    if (ch === "'") out += "''";
    else if (ch === '\\') out += '\\\\';
    else if (code >= 32 && code < 127) out += ch;
    else if (code < 0x10000) out += '\\X2\\' + code.toString(16).toUpperCase().padStart(4, '0') + '\\X0\\';
    else out += '\\X4\\' + code.toString(16).toUpperCase().padStart(8, '0') + '\\X0\\';
  }
  return "'" + out + "'";
}

/* Welds a part's corners (by position, to a tolerance well under any real
   feature) and lists its triangles as corner numbers. */
function weld(positions, tol) {
  const map = new Map(), verts = [], tris = [];
  const key = (x, y, z) => Math.round(x / tol) + ',' + Math.round(y / tol) + ',' + Math.round(z / tol);
  const id = (x, y, z) => {
    const k = key(x, y, z);
    let i = map.get(k);
    if (i === undefined) { i = verts.length; verts.push([x, y, z]); map.set(k, i); }
    return i;
  };
  for (let t = 0; t < positions.length; t += 9) {
    const i = id(positions[t], positions[t + 1], positions[t + 2]);
    const j = id(positions[t + 3], positions[t + 4], positions[t + 5]);
    const k = id(positions[t + 6], positions[t + 7], positions[t + 8]);
    if (i === j || j === k || k === i) continue;   // a degenerate sliver is no face
    tris.push([i, j, k]);
  }
  return { verts, tris };
}

function normalOf(v, t) {
  const [a, b, c] = t.map(i => v[i]);
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
  const n = [uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx];
  const l = Math.hypot(n[0], n[1], n[2]);
  return l > 0 ? n.map(x => x / l) : null;
}

/**
 * Faces of a welded part: triangles that touch along an edge and lie in one
 * plane become one face, bounded by loops of corners (outer first, then
 * holes). A region whose outline cannot be followed cleanly (a corner where
 * the outline meets itself, or triangles facing opposite ways) is left as
 * its triangles. Also says whether the part is closed (every edge shared by
 * exactly two triangles, facing consistently), which makes it a solid.
 */
export function faces(verts, tris, tol) {
  const edgeKey = (a, b) => a < b ? a + '_' + b : b + '_' + a;
  const edges = new Map();   // undirected edge → triangles on it
  tris.forEach((t, ti) => {
    for (let k = 0; k < 3; k++) {
      const key = edgeKey(t[k], t[(k + 1) % 3]);
      let l = edges.get(key);
      if (!l) edges.set(key, l = []);
      l.push(ti);
    }
  });
  let closed = tris.length > 3;
  for (const [key, l] of edges) {
    if (l.length !== 2) { closed = false; break; }
    // Consistent: the two triangles run along the edge in opposite directions.
    const [a] = key.split('_').map(Number);
    const dir = ti => { const t = tris[ti]; const k = t.indexOf(a); return t[(k + 1) % 3]; };
    if (dir(l[0]) === dir(l[1])) { closed = false; break; }
  }

  const normals = tris.map(t => normalOf(verts, t));
  const region = new Int32Array(tris.length).fill(-1);
  const out = [];
  const angTol = 1e-6;
  for (let s = 0; s < tris.length; s++) {
    if (region[s] >= 0 || !normals[s]) continue;
    const n = normals[s];
    const d = n[0] * verts[tris[s][0]][0] + n[1] * verts[tris[s][0]][1] + n[2] * verts[tris[s][0]][2];
    const members = [s];
    region[s] = s;
    for (let q = 0; q < members.length; q++) {
      const t = tris[members[q]];
      for (let k = 0; k < 3; k++) {
        for (const o of edges.get(edgeKey(t[k], t[(k + 1) % 3]))) {
          if (region[o] >= 0 || !normals[o]) continue;
          const m = normals[o];
          if (1 - (m[0] * n[0] + m[1] * n[1] + m[2] * n[2]) > angTol) continue;
          const p = verts[tris[o][0]];
          if (Math.abs(m[0] * p[0] + m[1] * p[1] + m[2] * p[2] - d) > tol * 4) continue;
          region[o] = s;
          members.push(o);
        }
      }
    }
    const loops = members.length > 1 ? outline(members.map(i => tris[i]), verts, n) : null;
    if (loops) out.push({ normal: n, loops });
    else for (const i of members) out.push({ normal: normals[i], loops: [tris[i].slice()] });
  }
  // Slivers with no normal still close the shell; keep them as they are.
  tris.forEach((t, i) => { if (!normals[i]) out.push({ normal: null, loops: [t.slice()] }); });
  return { faces: out, closed };
}

/* The boundary of a flat region of triangles as loops of corners, outer one
   first; null when it cannot be traced cleanly. */
function outline(region, verts, n) {
  const count = new Map();
  for (const t of region) for (let k = 0; k < 3; k++) {
    const a = t[k], b = t[(k + 1) % 3];
    const fwd = a + '>' + b, back = b + '>' + a;
    if (count.has(back)) count.delete(back);      // shared inside the region
    else if (count.has(fwd)) return null;          // two triangles the same way along one edge
    else count.set(fwd, [a, b]);
  }
  const next = new Map();
  for (const [a, b] of count.values()) {
    if (next.has(a)) return null;                  // the outline touches itself here
    next.set(a, b);
  }
  const loops = [];
  const seen = new Set();
  for (const startV of next.keys()) {
    if (seen.has(startV)) continue;
    const loop = [];
    let v = startV;
    while (!seen.has(v)) {
      seen.add(v);
      loop.push(v);
      v = next.get(v);
      if (v === undefined) return null;
    }
    if (v !== startV || loop.length < 3) return null;
    loops.push(loop);
  }
  if (!loops.length) return null;
  // The outer loop runs anticlockwise about the normal (positive area); holes the other way.
  const area = loop => {
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < loop.length; i++) {
      const p = verts[loop[i]], q = verts[loop[(i + 1) % loop.length]];
      x += p[1] * q[2] - p[2] * q[1]; y += p[2] * q[0] - p[0] * q[2]; z += p[0] * q[1] - p[1] * q[0];
    }
    return (x * n[0] + y * n[1] + z * n[2]) / 2;
  };
  const areas = loops.map(area);
  const outer = areas.filter(a => a > 0);
  if (outer.length !== 1) return null;             // two separate pieces in one plane: keep them as triangles
  const i = areas.indexOf(outer[0]);
  return [loops[i], ...loops.filter((_, k) => k !== i)];
}

/**
 * The model as a STEP AP214 file.
 * @param data   collect()'s output, in millimetres
 * @param title  the product's name
 * @param size   the model's largest dimension, for the weld tolerance
 */
export function toStep(data, title, size) {
  const lines = [];
  let id = 0;
  const E = text => { lines.push('#' + (++id) + '=' + text + ';'); return '#' + id; };
  const tol = Math.max(size, 1e-6) * 1e-9;

  const appCtx = E("APPLICATION_CONTEXT('core data for automotive mechanical design processes')");
  E("APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000," + appCtx + ')');
  const prodCtx = E("PRODUCT_CONTEXT(''," + appCtx + ",'mechanical')");
  const defCtx = E("PRODUCT_DEFINITION_CONTEXT('part definition'," + appCtx + ",'design')");
  const product = E('PRODUCT(' + str(title) + ',' + str(title) + ",'',(" + prodCtx + '))');
  E("PRODUCT_RELATED_PRODUCT_CATEGORY('part',$,(" + product + '))');
  const formation = E("PRODUCT_DEFINITION_FORMATION('',''," + product + ')');
  const definition = E("PRODUCT_DEFINITION('design',''," + formation + ',' + defCtx + ')');
  const pds = E("PRODUCT_DEFINITION_SHAPE(''," + "''," + definition + ')');
  const mm = E('(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))');
  const rad = E('(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.))');
  const sr = E('(NAMED_UNIT(*)SI_UNIT($,.STERADIAN.)SOLID_ANGLE_UNIT())');
  const unc = E('UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(' + real(Math.max(tol * 10, 1e-7)) + '),' + mm + ",'distance_accuracy_value','confusion accuracy')");
  const ctx = E('(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((' + unc + '))GLOBAL_UNIT_ASSIGNED_CONTEXT((' + mm + ',' + rad + ',' + sr + "))REPRESENTATION_CONTEXT('Context #1','3D Context with UNIT and UNCERTAINTY'))");
  const origin = E("CARTESIAN_POINT('',(0.,0.,0.))");
  const axis = E("AXIS2_PLACEMENT_3D(''," + origin + ',' + E("DIRECTION('',(0.,0.,1.))") + ',' + E("DIRECTION('',(1.,0.,0.))") + ')');

  const items = [axis];
  const styled = [];
  const styleFor = new Map();
  const colourRef = rgb => {
    const k = rgb.map(x => x.toFixed(4)).join(',');
    if (!styleFor.has(k)) styleFor.set(k, { colour: E("COLOUR_RGB(''," + rgb.map(real).join(',') + ')') });
    return styleFor.get(k);
  };
  const surfaceStyle = rgb => {
    const s = colourRef(rgb);
    if (!s.surface) {
      const fill = E("FILL_AREA_STYLE(''," + '(' + E("FILL_AREA_STYLE_COLOUR(''," + s.colour + ')') + '))');
      const side = E("SURFACE_SIDE_STYLE('',(" + E('SURFACE_STYLE_FILL_AREA(' + fill + ')') + '))');
      s.surface = E('PRESENTATION_STYLE_ASSIGNMENT((' + E('SURFACE_STYLE_USAGE(.BOTH.,' + side + ')') + '))');
    }
    return s.surface;
  };
  let font = null;
  const curveStyle = rgb => {
    const s = colourRef(rgb);
    if (!s.curve) {
      font = font || E("DRAUGHTING_PRE_DEFINED_CURVE_FONT('continuous')");
      s.curve = E('PRESENTATION_STYLE_ASSIGNMENT((' + E("CURVE_STYLE(''," + font + ',POSITIVE_LENGTH_MEASURE(0.1),' + s.colour + ')') + '))');
    }
    return s.curve;
  };

  let solids = 0, shells = 0, faceCount = 0;
  for (const m of data.meshes) {
    const { verts, tris } = weld(m.positions, tol);
    if (!tris.length) continue;
    const { faces: fs, closed } = faces(verts, tris, tol);
    const pts = new Map();
    const P = i => {
      let r = pts.get(i);
      if (!r) { const v = verts[i]; r = E("CARTESIAN_POINT('',(" + real(v[0]) + ',' + real(v[1]) + ',' + real(v[2]) + '))'); pts.set(i, r); }
      return r;
    };
    const faceRefs = [];
    for (const f of fs) {
      const bounds = f.loops.map((loop, k) => {
        const poly = E("POLY_LOOP('',(" + loop.map(P).join(',') + '))');
        return E((k === 0 ? 'FACE_OUTER_BOUND' : 'FACE_BOUND') + "(''," + poly + ',.T.)');
      });
      if (f.normal) {
        const n = f.normal;
        // Any direction across the normal will do for the plane's X axis.
        const ref = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
        const dot = ref[0] * n[0] + ref[1] * n[1] + ref[2] * n[2];
        const x = [ref[0] - dot * n[0], ref[1] - dot * n[1], ref[2] - dot * n[2]];
        const xl = Math.hypot(...x);
        const place = E("AXIS2_PLACEMENT_3D(''," + P(f.loops[0][0]) + ',' + E("DIRECTION('',(" + n.map(real).join(',') + '))') + ',' + E("DIRECTION('',(" + x.map(c => real(c / xl)).join(',') + '))') + ')');
        faceRefs.push(E("FACE_SURFACE(''," + '(' + bounds.join(',') + '),' + E("PLANE(''," + place + ')') + ',.T.)'));
      } else faceRefs.push(E("FACE(''," + '(' + bounds.join(',') + '))'));
    }
    faceCount += faceRefs.length;
    let item;
    if (closed) {
      item = E('FACETED_BREP(' + str(m.name) + ',' + E("CLOSED_SHELL(''," + '(' + faceRefs.join(',') + '))') + ')');
      solids++;
    } else {
      item = E('SHELL_BASED_SURFACE_MODEL(' + str(m.name) + ',(' + E("OPEN_SHELL(''," + '(' + faceRefs.join(',') + '))') + '))');
      shells++;
    }
    items.push(item);
    if (m.colour) styled.push(E("STYLED_ITEM('color',(" + surfaceStyle(m.colour) + '),' + item + ')'));
  }

  let curves = 0;
  if (data.lines.length) {
    // One curve set a colour, so each keeps its colour.
    const byColour = new Map();
    for (const l of data.lines) {
      const k = l.colour ? l.colour.join(',') : '';
      if (!byColour.has(k)) byColour.set(k, { colour: l.colour, refs: [] });
      const pts = l.points.map(p => E("CARTESIAN_POINT('',(" + real(p[0]) + ',' + real(p[1]) + ',' + real(p[2]) + '))'));
      byColour.get(k).refs.push(E("POLYLINE(''," + '(' + pts.join(',') + '))'));
      curves++;
    }
    for (const { colour, refs } of byColour.values()) {
      const set = E("GEOMETRIC_CURVE_SET('',(" + refs.join(',') + '))');
      items.push(set);
      if (colour) styled.push(E("STYLED_ITEM('color',(" + curveStyle(colour) + '),' + set + ')'));
    }
  }

  const rep = E('SHAPE_REPRESENTATION(' + str(title) + ',(' + items.join(',') + '),' + ctx + ')');
  E('SHAPE_DEFINITION_REPRESENTATION(' + pds + ',' + rep + ')');
  if (styled.length) E("MECHANICAL_DESIGN_GEOMETRIC_PRESENTATION_REPRESENTATION('',(" + styled.join(',') + '),' + ctx + ')');

  const stamp = new Date().toISOString().slice(0, 19);
  const head = [
    'ISO-10303-21;',
    'HEADER;',
    "FILE_DESCRIPTION(('Faceted model exported by the Online 3D Viewer (tool.adjiebrotots.com/online-3d-viewer)'),'2;1');",
    'FILE_NAME(' + str(title + '.step') + ",'" + stamp + "',(''),(''),'Online 3D Viewer','Online 3D Viewer','');",
    "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));",
    'ENDSEC;',
    'DATA;',
  ];
  const text = head.concat(lines, ['ENDSEC;', 'END-ISO-10303-21;', '']).join('\n');
  return { blob: new Blob([text], { type: 'model/step' }), solids, shells, faces: faceCount, curves };
}

// ── glTF ─────────────────────────────────────────────────────────────────

/**
 * The scene as GLB, animations included. The model is copied (skeletons and
 * all), so the one on screen is never taken out of the view while it saves.
 */
export async function toGlb(content, animations, matrix) {
  const [{ GLTFExporter }, SkeletonUtils] = await Promise.all([
    import('three/addons/exporters/GLTFExporter.js'),
    import('three/addons/utils/SkeletonUtils.js'),
  ]);
  const copy = SkeletonUtils.clone(content);
  const drop = [];
  copy.traverse(o => { if (o.userData.o3vEdge || o.userData.o3vOverlay) drop.push(o); });
  drop.forEach(o => o.parent && o.parent.remove(o));
  copy.position.set(0, 0, 0); copy.quaternion.identity(); copy.scale.set(1, 1, 1);
  const root = new THREE.Group();
  root.name = content.name || 'model';
  matrix.decompose(root.position, root.quaternion, root.scale);
  root.add(copy);
  const exporter = new GLTFExporter();
  // Compressed (KTX2) textures are decoded back to pictures where the browser can.
  try {
    const TextureUtils = await import('three/addons/utils/WebGLTextureUtils.js');
    if (exporter.setTextureUtils) exporter.setTextureUtils(TextureUtils);
  } catch (e) { /* saved without those textures */ }
  const clips = (animations || []).filter(c => c && c.tracks && c.tracks.length);
  const result = await exporter.parseAsync(root, { binary: true, trs: true, animations: clips, onlyVisible: true });
  return new Blob([result], { type: 'model/gltf-binary' });
}
