// Writes the test fixtures in _audit/fixtures/ and their expected readings in
// _audit/fixtures/cases.json. Run: node make-fixtures.mjs
//
// Every format gets the same known shape, written here byte by byte from the
// format's own specification (not by the library the viewer reads it with),
// so what the viewer must report is known exactly: a box 30 × 20 × 10 along
// the file's X, Y and Z (8 corners, 6 faces, 12 triangles). Variants cover
// what real files do: ASCII and binary, both byte orders, colours, several
// solids, missing and misnamed files, compression (Draco, Meshopt, KTX2),
// zipped packages, units, Z-up files the loader turns, and broken files.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { DEPS, ensureDeps } from './serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'fixtures');

// Generator-only packages (the page never loads these).
const GEN = { '@gltf-transform/core': '4.2.1', '@gltf-transform/extensions': '4.2.1', '@gltf-transform/functions': '4.2.1', 'draco3dgltf': '1.5.7', 'meshoptimizer': '0.25.0' };
ensureDeps();
{
  const need = Object.entries(GEN).filter(([n, v]) => { try { return JSON.parse(fs.readFileSync(path.join(DEPS, 'node_modules', n, 'package.json'))).version !== v; } catch { return true; } });
  if (need.length) {
    const { execFileSync } = await import('node:child_process');
    execFileSync('npm', ['install', '--no-audit', '--no-fund', '--prefix', DEPS, ...need.map(([n, v]) => n + '@' + v)], { stdio: 'inherit' });
  }
}
const req = createRequire(path.join(DEPS, 'package.json'));
const mod = name => import(pathToFileURL(req.resolve(name)).href);
const fflate = await import(pathToFileURL(path.join(DEPS, 'node_modules/three/examples/jsm/libs/fflate.module.js')).href);
const ktx = await import(pathToFileURL(path.join(DEPS, 'node_modules/three/examples/jsm/libs/ktx-parse.module.js')).href);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const cases = [];
function write(rel, data) {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, data);
  return rel;
}
function addCase(name, files, expect, extra = {}) { cases.push({ name, files, expect, ...extra }); }

// ── The box ──────────────────────────────────────────────────────────────
const V = [[0, 0, 0], [30, 0, 0], [30, 20, 0], [0, 20, 0], [0, 0, 10], [30, 0, 10], [30, 20, 10], [0, 20, 10]];
const Q = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [3, 0, 4, 7], [1, 2, 6, 5]];   // outward, counter-clockwise
const T = Q.flatMap(([a, b, c, d]) => [[a, b, c], [a, c, d]]);
const BOX = { triangles: 12, vertices: 8, parts: 1, size: [30, 20, 10] };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); };
const faceNormal = (a, b, c) => norm(cross(sub(V[b], V[a]), sub(V[c], V[a])));
const RED = [0.8, 0.1, 0.1];

// A tiny RGBA PNG (8×8 checker), written by hand: signature, IHDR, IDAT, IEND.
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = buf => { let c = 0xFFFFFFFF; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function png(w = 8, h = 8) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const on = (x + y) % 2 === 0, o = y * (w * 4 + 1) + 1 + x * 4;
      raw[o] = on ? 240 : 40; raw[o + 1] = on ? 200 : 60; raw[o + 2] = on ? 60 : 160; raw[o + 3] = 255;
    }
  }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const PNG = png();

// ═════════════════════════════ STL ═══════════════════════════════════════
function stlAscii(name = 'box', offset = [0, 0, 0], zeroNormals = false, nl = '\n') {
  let s = 'solid ' + name + nl;
  for (const [a, b, c] of T) {
    const n = zeroNormals ? [0, 0, 0] : faceNormal(a, b, c);
    s += ' facet normal ' + n.join(' ') + nl + '  outer loop' + nl;
    for (const i of [a, b, c]) s += '   vertex ' + V[i].map((v, k) => v + offset[k]).join(' ') + nl;
    s += '  endloop' + nl + ' endfacet' + nl;
  }
  return s + 'endsolid ' + name + nl;
}
function stlBinary({ header = 'solid binary file whose header starts like ASCII', colours = false, count = T.length, keep = T.length, trailing = 0 } = {}) {
  const buf = Buffer.alloc(84 + keep * 50 + trailing);
  const head = colours ? 'COLOR=' : header;
  buf.write(head.padEnd(80, ' ').slice(0, 80), 0, 'latin1');
  if (colours) { buf[6] = 200; buf[7] = 200; buf[8] = 200; buf[9] = 255; }   // default colour RGBA
  buf.writeUInt32LE(count, 80);
  T.slice(0, keep).forEach(([a, b, c], i) => {
    const o = 84 + i * 50;
    faceNormal(a, b, c).forEach((v, k) => buf.writeFloatLE(v, o + k * 4));
    [a, b, c].forEach((vi, j) => V[vi].forEach((v, k) => buf.writeFloatLE(v, o + 12 + j * 12 + k * 4)));
    // VisCAM colour: bit 15 clear = this facet has its own 5-bit RGB.
    buf.writeUInt16LE(colours ? (i < 6 ? (31) : (31 << 10)) : 0, o + 48);
  });
  return buf;
}
addCase('stl-ascii', [write('stl/box-ascii.stl', stlAscii())], { formats: ['STL'], up: 'z', units: null, ...BOX });
addCase('stl-ascii-crlf', [write('stl/box-crlf.stl', stlAscii('box', [0, 0, 0], false, '\r\n'))], { formats: ['STL'], ...BOX });
addCase('stl-binary-solid-header', [write('stl/box-binary.stl', stlBinary())], { formats: ['STL'], up: 'z', ...BOX });
addCase('stl-binary-colour', [write('stl/box-colour.stl', stlBinary({ colours: true }))], { formats: ['STL'], ...BOX, vertexColors: true });
addCase('stl-ascii-two-solids', [write('stl/two-solids.stl', stlAscii('left') + stlAscii('right', [40, 0, 0]))], { formats: ['STL'], triangles: 24, vertices: 16, parts: 2, size: [70, 20, 10] });
addCase('stl-zero-normals', [write('stl/zero-normals.stl', stlAscii('box', [0, 0, 0], true))], { formats: ['STL'], ...BOX, normalsOk: true });
addCase('stl-binary-truncated', [write('stl/truncated.stl', stlBinary({ header: 'binary', keep: 10 }))], { formats: ['STL'], triangles: 10, parts: 1, warning: /shorter than its header/ });
addCase('stl-binary-trailing-bytes', [write('stl/trailing.stl', stlBinary({ header: 'binary', trailing: 7 }))], { formats: ['STL'], ...BOX });
addCase('stl-uppercase-name', [write('stl/BOX.STL', stlBinary({ header: 'binary' }))], { formats: ['STL'], ...BOX });

// ═════════════════════════════ OBJ ═══════════════════════════════════════
{
  const v = V.map(p => 'v ' + p.join(' ')).join('\n');
  const vt = 'vt 0 0\nvt 1 0\nvt 1 1\nvt 0 1';
  const quads = (list, uv) => list.map(q => 'f ' + q.map((i, k) => (i + 1) + (uv ? '/' + (k + 1) : '')).join(' ')).join('\n');
  const obj = '# box with two materials, one textured\nmtllib box.mtl\no Box\n' + v + '\n' + vt + '\nusemtl Red\n' + quads(Q.slice(0, 4), true) + '\nusemtl Checker\n' + quads(Q.slice(4), true) + '\n';
  const mtl = 'newmtl Red\nKd 0.8 0.1 0.1\nKa 0 0 0\n\nnewmtl Checker\nKd 1 1 1\nmap_Kd textures/checker.png\n';
  addCase('obj-mtl-texture', [write('obj/box.obj', obj), write('obj/box.mtl', mtl), write('obj/textures/checker.png', PNG)],
    { formats: ['OBJ'], up: 'y', ...BOX, materials: 2, textures: 1, noWarnings: true });
  addCase('obj-in-a-zip', [write('zip/box-model.zip', Buffer.from(fflate.zipSync({
    'box-model/box.obj': fflate.strToU8(obj), 'box-model/box.mtl': fflate.strToU8(mtl), 'box-model/textures/checker.png': new Uint8Array(PNG),
    '__MACOSX/box-model/._box.obj': fflate.strToU8('resource fork'), 'box-model/.DS_Store': fflate.strToU8('junk'),
  }, { mtime: new Date('2026-01-01T00:00:00Z') })))], { formats: ['OBJ'], ...BOX, materials: 2, textures: 1, noWarnings: true });
  addCase('obj-missing-mtl', [write('obj-alone/box.obj', obj)], { formats: ['OBJ'], ...BOX, warning: /box\.mtl/ });
  addCase('obj-missing-texture', [write('obj-notex/box.obj', obj), write('obj-notex/box.mtl', mtl)], { formats: ['OBJ'], ...BOX, warning: /checker\.png/ });
  // Negative (relative) indices, vertex colours, an n-gon split into a fan, CRLF line ends.
  const vc = V.map((p, i) => 'v ' + p.join(' ') + ' ' + (i % 2) + ' 0.5 ' + (1 - i % 2)).join('\r\n');
  const neg = Q.map(q => 'f ' + q.map(i => i - 8).join(' ')).join('\r\n');
  addCase('obj-negative-indices-colours-crlf', [write('obj-neg/box.obj', vc + '\r\n' + neg + '\r\n')], { formats: ['OBJ'], ...BOX, vertexColors: true });
  // Lines and points beside a face.
  const lp = v + '\nf 1 2 3\nl 1 5 6 7\np 8\n';
  addCase('obj-lines-points', [write('obj-lp/mixed.obj', lp)], { formats: ['OBJ'], triangles: 1, parts: 1, segments: 3, points: 1, size: [30, 20, 10] });
}

// ═════════════════════════════ PLY ═══════════════════════════════════════
function plyAscii() {
  return 'ply\nformat ascii 1.0\ncomment box with vertex colours\nelement vertex 8\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nelement face 6\nproperty list uchar int vertex_indices\nend_header\n'
    + V.map((p, i) => p.join(' ') + ' ' + (i * 30) + ' 120 200').join('\n') + '\n' + Q.map(q => '4 ' + q.join(' ')).join('\n') + '\n';
}
function plyBinary(little) {
  const head = 'ply\nformat binary_' + (little ? 'little' : 'big') + '_endian 1.0\nelement vertex 8\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nelement face 6\nproperty list uchar int vertex_indices\nend_header\n';
  const body = Buffer.alloc(8 * 15 + 6 * 17);
  let o = 0;
  V.forEach((p, i) => { p.forEach(v => { little ? body.writeFloatLE(v, o) : body.writeFloatBE(v, o); o += 4; }); body[o++] = i * 30; body[o++] = 120; body[o++] = 200; });
  Q.forEach(q => { body[o++] = 4; q.forEach(i => { little ? body.writeInt32LE(i, o) : body.writeInt32BE(i, o); o += 4; }); });
  return Buffer.concat([Buffer.from(head, 'latin1'), body]);
}
addCase('ply-ascii', [write('ply/box-ascii.ply', plyAscii())], { formats: ['PLY'], up: 'y', ...BOX, vertexColors: true });
addCase('ply-binary-little-endian', [write('ply/box-le.ply', plyBinary(true))], { formats: ['PLY'], ...BOX, vertexColors: true });
addCase('ply-binary-big-endian', [write('ply/box-be.ply', plyBinary(false))], { formats: ['PLY'], ...BOX, vertexColors: true });
{
  const n = 500;
  let s = 'ply\nformat ascii 1.0\nelement vertex ' + n + '\nproperty float x\nproperty float y\nproperty float z\nend_header\n';
  for (let i = 0; i < n; i++) { const t = i / (n - 1); s += (15 + 15 * Math.cos(t * 12)).toFixed(4) + ' ' + (10 + 10 * Math.sin(t * 12)).toFixed(4) + ' ' + (10 * t).toFixed(4) + '\n'; }
  addCase('ply-point-cloud', [write('ply/helix-points.ply', s)], { formats: ['PLY'], points: 500, parts: 0, triangles: 0 });
}
addCase('no-extension-sniffed-as-ply', [write('misc/scan', plyAscii())], { formats: ['PLY'], ...BOX });

// ═════════════════════════════ OFF ═══════════════════════════════════════
addCase('off', [write('off/box.off', 'OFF\n# a box\n8 6 12\n' + V.map(p => p.join(' ')).join('\n') + '\n' + Q.map(q => '4 ' + q.join(' ')).join('\n') + '\n')], { formats: ['OFF'], up: 'y', ...BOX });
addCase('off-face-colours-counts-on-header', [write('off/box-colour.off', 'OFF 8 6 0\n' + V.map(p => p.join(' ')).join('\n') + '\n' + Q.map((q, i) => '4 ' + q.join(' ') + ' ' + (i * 40) + ' 100 200').join('\n') + '\n')], { formats: ['OFF'], ...BOX, vertexColors: true });
addCase('coff-vertex-colours', [write('off/box.coff.off', 'COFF\n8 6 0\n' + V.map((p, i) => p.join(' ') + ' 0.' + i + ' 0.5 0.9 1').join('\n') + '\n' + Q.map(q => '4 ' + q.join(' ')).join('\n') + '\n')], { formats: ['OFF'], ...BOX, vertexColors: true });
addCase('off-cut-short', [write('off/short.off', 'OFF\n8 6 0\n0 0 0\n1 0 0\n')], { error: /cut short/ });

// ═════════════════════════════ 3MF ═══════════════════════════════════════
function threeMF(unit) {
  const model = '<?xml version="1.0" encoding="UTF-8"?>\n<model unit="' + unit + '" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n<resources>\n<basematerials id="1"><base name="Red" displaycolor="#CC1A1AFF"/></basematerials>\n<object id="2" type="model" pid="1" pindex="0"><mesh><vertices>\n'
    + V.map(p => '<vertex x="' + p[0] + '" y="' + p[1] + '" z="' + p[2] + '"/>').join('\n') + '\n</vertices><triangles>\n'
    + T.map(t => '<triangle v1="' + t[0] + '" v2="' + t[1] + '" v3="' + t[2] + '"/>').join('\n') + '\n</triangles></mesh></object>\n</resources>\n<build><item objectid="2"/></build>\n</model>\n';
  return Buffer.from(fflate.zipSync({
    '[Content_Types].xml': fflate.strToU8('<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>'),
    '_rels/.rels': fflate.strToU8('<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'),
    '3D/3dmodel.model': fflate.strToU8(model),
  }, { mtime: new Date('2026-01-01T00:00:00Z') }));
}
addCase('3mf-millimetre', [write('3mf/box.3mf', threeMF('millimeter'))], { formats: ['3MF'], up: 'z', units: 'mm', ...BOX });
addCase('3mf-inch', [write('3mf/box-inch.3mf', threeMF('inch'))], { formats: ['3MF'], units: 'in', ...BOX });
addCase('3mf-not-a-zip', [write('3mf/broken.3mf', 'this is not a zip package at all, just text')], { error: /zip/ });

// ═════════════════════════════ AMF ═══════════════════════════════════════
function amf(unit) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<amf unit="' + unit + '" version="1.1">\n<material id="1"><metadata type="name">Red</metadata><color><r>0.8</r><g>0.1</g><b>0.1</b></color></material>\n<object id="0"><mesh><vertices>\n'
    + V.map(p => '<vertex><coordinates><x>' + p[0] + '</x><y>' + p[1] + '</y><z>' + p[2] + '</z></coordinates></vertex>').join('\n') + '\n</vertices><volume materialid="1">\n'
    + T.map(t => '<triangle><v1>' + t[0] + '</v1><v2>' + t[1] + '</v2><v3>' + t[2] + '</v3></triangle>').join('\n') + '\n</volume></mesh></object>\n</amf>\n';
}
addCase('amf', [write('amf/box.amf', amf('millimeter'))], { formats: ['AMF'], up: 'z', units: 'mm', ...BOX });
addCase('amf-zipped-inch', [write('amf/box-zip.amf', Buffer.from(fflate.zipSync({ 'box.amf': fflate.strToU8(amf('inch')) }, { mtime: new Date('2026-01-01T00:00:00Z') })))],
  { formats: ['AMF'], units: 'mm', ...BOX, size: [762, 508, 254] });

// ═════════════════════════════ glTF ══════════════════════════════════════
// 24 corners (each face its own normal and texture coordinates), 36 indices.
function gltfBox({ texture = 'none', animated = false } = {}) {
  const pos = [], nor = [], uv = [], idx = [];
  Q.forEach(q => {
    const n = faceNormal(q[0], q[1], q[2]);
    const base = pos.length / 3;
    q.forEach((i, k) => { pos.push(...V[i]); nor.push(...n); uv.push(k === 1 || k === 2 ? 1 : 0, k >= 2 ? 1 : 0); });
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  const f32 = a => Buffer.from(new Float32Array(a).buffer);
  const parts = [f32(pos), f32(nor), f32(uv), Buffer.from(new Uint16Array(idx).buffer)];
  const views = [];
  let off = 0;
  const pushView = (buf, target) => { const v = { buffer: 0, byteOffset: off, byteLength: buf.length }; if (target) v.target = target; views.push(v); off += buf.length; while (off % 4) off++; };
  parts.forEach((b, i) => pushView(b, i < 3 ? 34962 : 34963));
  const json = {
    asset: { version: '2.0', generator: 'make-fixtures.mjs' },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: 'Box' }],
    meshes: [{ name: 'Box', primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 24, type: 'VEC3', min: [0, 0, 0], max: [30, 20, 10] },
      { bufferView: 1, componentType: 5126, count: 24, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: 24, type: 'VEC2' },
      { bufferView: 3, componentType: 5123, count: 36, type: 'SCALAR' },
    ],
    bufferViews: views,
    materials: [{ name: 'Box', pbrMetallicRoughness: { baseColorFactor: [...RED, 1], metallicFactor: 0.1, roughnessFactor: 0.6 } }],
  };
  let image = null;
  if (texture !== 'none') {
    json.materials[0].pbrMetallicRoughness.baseColorFactor = [1, 1, 1, 1];
    json.materials[0].pbrMetallicRoughness.baseColorTexture = { index: 0 };
    json.samplers = [{ magFilter: 9728, minFilter: 9728 }];
    if (texture === 'ktx2') {
      json.textures = [{ sampler: 0, extensions: { KHR_texture_basisu: { source: 0 } } }];
      json.extensionsUsed = ['KHR_texture_basisu'];
      json.extensionsRequired = ['KHR_texture_basisu'];
      image = ktx2Rgba();
    } else {
      json.textures = [{ sampler: 0, source: 0 }];
      image = PNG;
    }
  }
  if (animated) {
    const times = f32([0, 1, 2]);
    const s = Math.SQRT1_2;
    const rots = f32([0, 0, 0, 1, 0, s, 0, s, 0, 1, 0, 0]);
    pushView(times); pushView(rots);
    json.accessors.push({ bufferView: views.length - 2, componentType: 5126, count: 3, type: 'SCALAR', min: [0], max: [2] }, { bufferView: views.length - 1, componentType: 5126, count: 3, type: 'VEC4' });
    json.animations = [{ name: 'Spin', samplers: [{ input: 4, output: 5, interpolation: 'LINEAR' }], channels: [{ sampler: 0, target: { node: 0, path: 'rotation' } }] }];
    parts.push(times, rots);
  }
  const pad4 = b => { const p = (4 - b.length % 4) % 4; return p ? Buffer.concat([b, Buffer.alloc(p)]) : b; };
  const bin = Buffer.concat(parts.map(pad4));
  return { json, bin, image, imageMime: texture === 'ktx2' ? 'image/ktx2' : 'image/png' };
}
function glb(json, bin) {
  const j = Buffer.from(JSON.stringify(json));
  const jp = Buffer.concat([j, Buffer.alloc((4 - j.length % 4) % 4, 0x20)]);
  const bp = Buffer.concat([bin, Buffer.alloc((4 - bin.length % 4) % 4)]);
  const head = Buffer.alloc(12); head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jp.length + 8 + bp.length, 8);
  const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
  return Buffer.concat([head, ch(jp.length, 0x4E4F534A), jp, ch(bp.length, 0x004E4942), bp]);
}
// An uncompressed 8×8 RGBA KTX2 texture (ktx-parse writes the container).
function ktx2Rgba() {
  const c = ktx.createDefaultContainer();
  c.vkFormat = ktx.VK_FORMAT_R8G8B8A8_SRGB;
  c.typeSize = 1;
  c.pixelWidth = 8; c.pixelHeight = 8; c.pixelDepth = 0; c.layerCount = 0; c.faceCount = 1;
  c.supercompressionScheme = 0;
  const px = Buffer.alloc(8 * 8 * 4);
  for (let i = 0; i < 64; i++) { const on = (i % 8 + Math.floor(i / 8)) % 2 === 0; px[i * 4] = on ? 240 : 40; px[i * 4 + 1] = on ? 200 : 60; px[i * 4 + 2] = on ? 60 : 160; px[i * 4 + 3] = 255; }
  c.levels = [{ levelData: new Uint8Array(px), uncompressedByteLength: px.length }];
  const dfd = c.dataFormatDescriptor[0];
  dfd.colorModel = 1; dfd.colorPrimaries = 1; dfd.transferFunction = 2; dfd.flags = 0;
  dfd.texelBlockDimension = [0, 0, 0, 0];
  dfd.bytesPlane = [4, 0, 0, 0, 0, 0, 0, 0];
  // R, G, B, then alpha (channel 15) flagged linear (0x10), as sRGB data needs.
  dfd.samples = [0, 1, 2, 15].map((ch, i) => ({ bitOffset: i * 8, bitLength: 7, channelType: ch === 15 ? 0x1F : ch, samplePosition: [0, 0, 0, 0], sampleLower: 0, sampleUpper: 255 }));
  return Buffer.from(ktx.write(c));
}
{
  const plain = gltfBox();
  const embedded = { ...plain.json, buffers: [{ byteLength: plain.bin.length, uri: 'data:application/octet-stream;base64,' + plain.bin.toString('base64') }] };
  addCase('gltf-embedded', [write('gltf/embedded.gltf', JSON.stringify(embedded, null, 1))], { formats: ['glTF'], up: 'y', units: 'm', ...BOX, materials: 1 });

  const tex = gltfBox({ texture: 'png' });
  const sep = { ...tex.json, buffers: [{ byteLength: tex.bin.length, uri: 'box.bin' }], images: [{ uri: 'textures/checker%20map.png' }] };
  addCase('gltf-separate-bin-texture', [write('gltf-sep/box.gltf', JSON.stringify(sep)), write('gltf-sep/box.bin', tex.bin), write('gltf-sep/textures/checker map.png', PNG)],
    { formats: ['glTF'], ...BOX, textures: 1, noWarnings: true });
  addCase('gltf-missing-bin', [write('gltf-nobin/box.gltf', JSON.stringify(sep))], { error: /box\.bin/ });
  addCase('gltf-missing-texture', [write('gltf-notex/box.gltf', JSON.stringify(sep)), write('gltf-notex/box.bin', tex.bin)], { formats: ['glTF'], ...BOX, warning: /checker map\.png/ });

  // GLB with its PNG inside the binary chunk.
  const g = gltfBox({ texture: 'png' });
  const imgOff = g.bin.length;
  const bin = Buffer.concat([g.bin, PNG]);
  const gj = { ...g.json, bufferViews: [...g.json.bufferViews, { buffer: 0, byteOffset: imgOff, byteLength: PNG.length }], images: [{ bufferView: g.json.bufferViews.length, mimeType: 'image/png' }], buffers: [{ byteLength: bin.length }] };
  const glbBytes = glb(gj, bin);
  addCase('glb-embedded-texture', [write('glb/box.glb', glbBytes)], { formats: ['glTF'], units: 'm', ...BOX, textures: 1 });
  addCase('glb-misnamed-as-stl', [write('misc/actually-a-glb.stl', glbBytes)], { formats: ['glTF'], ...BOX, warning: /holds glTF/ });
  addCase('glb-truncated', [write('glb/truncated.glb', glbBytes.subarray(0, Math.floor(glbBytes.length / 2)))], { error: /glTF|GLB/ });

  const k = gltfBox({ texture: 'ktx2' });
  const kOff = k.bin.length;
  const kbin = Buffer.concat([k.bin, k.image]);
  const kj = { ...k.json, bufferViews: [...k.json.bufferViews, { buffer: 0, byteOffset: kOff, byteLength: k.image.length }], images: [{ bufferView: k.json.bufferViews.length, mimeType: 'image/ktx2' }], buffers: [{ byteLength: kbin.length }] };
  addCase('glb-ktx2-texture', [write('glb/box-ktx2.glb', glb(kj, kbin))], { formats: ['glTF'], ...BOX, textures: 1 });

  const a = gltfBox({ animated: true });
  addCase('glb-animated', [write('glb/box-animated.glb', glb({ ...a.json, buffers: [{ byteLength: a.bin.length }] }, a.bin))], { formats: ['glTF'], ...BOX, animations: 1 });

  // Draco and Meshopt, written by glTF-Transform from the plain GLB.
  const core = await mod('@gltf-transform/core');
  const ext = await mod('@gltf-transform/extensions');
  const fn = await mod('@gltf-transform/functions');
  const draco3d = (await mod('draco3dgltf')).default;
  const { MeshoptEncoder } = await mod('meshoptimizer');
  await MeshoptEncoder.ready;
  const io = new core.NodeIO().registerExtensions(ext.ALL_EXTENSIONS).registerDependencies({
    'draco3d.encoder': await draco3d.createEncoderModule(), 'draco3d.decoder': await draco3d.createDecoderModule(), 'meshopt.encoder': MeshoptEncoder,
  });
  const plainGlb = glb({ ...plain.json, buffers: [{ byteLength: plain.bin.length }] }, plain.bin);
  const d1 = await io.readBinary(new Uint8Array(plainGlb));
  await d1.transform(fn.draco({ method: 'edgebreaker' }));
  addCase('glb-draco', [write('glb/box-draco.glb', Buffer.from(await io.writeBinary(d1)))], { formats: ['glTF'], triangles: 12, vertices: 8, parts: 1, size: [30, 20, 10], tol: 0.01 });
  const d2 = await io.readBinary(new Uint8Array(plainGlb));
  await d2.transform(fn.reorder({ encoder: MeshoptEncoder }), fn.quantize(), fn.meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  addCase('glb-meshopt', [write('glb/box-meshopt.glb', Buffer.from(await io.writeBinary(d2)))], { formats: ['glTF'], triangles: 12, vertices: 8, parts: 1, size: [30, 20, 10], tol: 0.01 });

  addCase('gltf-version-1', [write('gltf/old.gltf', JSON.stringify({ asset: { version: '1.0' }, meshes: {} }))], { error: /glTF 1\.0/ });
  addCase('gltf-not-json', [write('gltf/broken.gltf', '{ "asset": { "version": "2.0" ')], { error: /not valid JSON/ });
}

// ═════════════════════════════ FBX ═══════════════════════════════════════
// One tree, written twice: FBX 7.4 ASCII and FBX 7.4 binary.
const fbxPolys = Q.flatMap(q => [q[0], q[1], q[2], ~q[3]]);   // a polygon's last index is stored bitwise-NOT
const FBX_TREE = [
  ['FBXHeaderExtension', [], [['FBXHeaderVersion', [['I', 1003]]], ['FBXVersion', [['I', 7400]]]]],
  ['GlobalSettings', [], [['Version', [['I', 1000]]], ['Properties70', [], [
    ['P', [['S', 'UpAxis'], ['S', 'int'], ['S', 'Integer'], ['S', ''], ['I', 1]]],
    ['P', [['S', 'UnitScaleFactor'], ['S', 'double'], ['S', 'Number'], ['S', ''], ['D', 0.1]]],
  ]]]],
  ['Objects', [], [
    ['Geometry', [['L', 1000], ['S', 'Box\x00\x01Geometry', 'Geometry::Box'], ['S', 'Mesh']], [
      ['Vertices', [['d', V.flat()]]],
      ['PolygonVertexIndex', [['i', fbxPolys]]],
      ['GeometryVersion', [['I', 124]]],
      ['LayerElementMaterial', [['I', 0]], [['Version', [['I', 101]]], ['Name', [['S', '']]], ['MappingInformationType', [['S', 'AllSame']]], ['ReferenceInformationType', [['S', 'IndexToDirect']]], ['Materials', [['i', [0]]]]]],
    ]],
    ['Model', [['L', 2000], ['S', 'Box\x00\x01Model', 'Model::Box'], ['S', 'Mesh']], [['Version', [['I', 232]]]]],
    ['Material', [['L', 3000], ['S', 'Red\x00\x01Material', 'Material::Red'], ['S', '']], [
      ['Version', [['I', 102]]], ['ShadingModel', [['S', 'phong']]],
      ['Properties70', [], [['P', [['S', 'DiffuseColor'], ['S', 'Color'], ['S', ''], ['S', 'A'], ['D', 0.8], ['D', 0.1], ['D', 0.1]]]]],
    ]],
  ]],
  ['Connections', [], [
    ['C', [['S', 'OO'], ['L', 2000], ['L', 0]]],
    ['C', [['S', 'OO'], ['L', 1000], ['L', 2000]]],
    ['C', [['S', 'OO'], ['L', 3000], ['L', 2000]]],
  ]],
];
function fbxAscii(tree, version = '7.4.0') {
  const val = ([t, v, asciiForm]) => t === 'S' ? '"' + (asciiForm || v) + '"' : (t === 'd' || t === 'i') ? null : String(v);
  const node = ([name, props, kids = []], ind) => {
    const arr = props.find(p => p[0] === 'd' || p[0] === 'i');
    if (arr) return ind + name + ': *' + arr[1].length + ' {\n' + ind + '\ta: ' + arr[1].join(',') + '\n' + ind + '}\n';
    const head = ind + name + ': ' + props.map(val).join(', ');
    return kids.length ? head + ' {\n' + kids.map(k => node(k, ind + '\t')).join('') + ind + '}\n' : head + '\n';
  };
  return '; FBX ' + version + ' project file\n; written by make-fixtures.mjs\n\n' + tree.map(n => node(n, '')).join('');
}
function fbxBinary(tree, version = 7400) {
  const chunks = [];
  let offset = 27;
  const prop = ([t, v]) => {
    switch (t) {
      case 'I': { const b = Buffer.alloc(5); b.write('I'); b.writeInt32LE(v, 1); return b; }
      case 'L': { const b = Buffer.alloc(9); b.write('L'); b.writeBigInt64LE(BigInt(v), 1); return b; }
      case 'D': { const b = Buffer.alloc(9); b.write('D'); b.writeDoubleLE(v, 1); return b; }
      case 'S': { const s = Buffer.from(v, 'latin1'); const b = Buffer.alloc(5); b.write('S'); b.writeUInt32LE(s.length, 1); return Buffer.concat([b, s]); }
      case 'd': case 'i': {
        const size = t === 'd' ? 8 : 4;
        const data = Buffer.alloc(v.length * size);
        v.forEach((x, k) => t === 'd' ? data.writeDoubleLE(x, k * size) : data.writeInt32LE(x, k * size));
        const b = Buffer.alloc(13); b.write(t); b.writeUInt32LE(v.length, 1); b.writeUInt32LE(0, 5); b.writeUInt32LE(data.length, 9);
        return Buffer.concat([b, data]);
      }
    }
    throw new Error('prop ' + t);
  };
  const record = ([name, props, kids = []], start) => {
    const p = Buffer.concat(props.map(prop));
    const nameB = Buffer.from(name, 'latin1');
    const headLen = 13 + nameB.length;
    let pos = start + headLen + p.length;
    const kidBufs = [];
    for (const k of kids) { const kb = record(k, pos); kidBufs.push(kb); pos += kb.length; }
    if (kids.length) { kidBufs.push(Buffer.alloc(13)); pos += 13; }
    const head = Buffer.alloc(headLen);
    head.writeUInt32LE(pos, 0); head.writeUInt32LE(props.length, 4); head.writeUInt32LE(p.length, 8); head[12] = nameB.length; nameB.copy(head, 13);
    return Buffer.concat([head, p, ...kidBufs]);
  };
  for (const n of tree) { const r = record(n, offset); chunks.push(r); offset += r.length; }
  chunks.push(Buffer.alloc(13)); offset += 13;
  // Footer: the reader stops 160 + 16 bytes (16-aligned) before the end.
  const end = (offset + 176) & ~0xF;
  chunks.push(Buffer.alloc(end - offset));
  const magic = Buffer.alloc(27); magic.write('Kaydara FBX Binary  \x00\x1A\x00', 'latin1'); magic.writeUInt32LE(version, 23);
  return Buffer.concat([magic, ...chunks]);
}
addCase('fbx-ascii', [write('fbx/box-ascii.fbx', fbxAscii(FBX_TREE))], { formats: ['FBX'], up: 'y', units: 'mm', ...BOX, materials: 1 });
addCase('fbx-binary', [write('fbx/box-binary.fbx', fbxBinary(FBX_TREE))], { formats: ['FBX'], units: 'mm', ...BOX, materials: 1 });
addCase('fbx-version-6', [write('fbx/old.fbx', '; FBX 6.1.0 project file\nFBXHeaderExtension:  {\n\tFBXHeaderVersion: 1003\n\tFBXVersion: 6100\n}\n')], { error: /FBX 6\.1/ });

// ═════════════════════════════ COLLADA ═══════════════════════════════════
const dae = '<?xml version="1.0" encoding="utf-8"?>\n<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">\n'
  + '<asset><unit name="millimeter" meter="0.001"/><up_axis>Z_UP</up_axis></asset>\n'
  + '<library_effects><effect id="red-fx"><profile_COMMON><technique sid="common"><lambert><diffuse><color>0.8 0.1 0.1 1</color></diffuse></lambert></technique></profile_COMMON></effect></library_effects>\n'
  + '<library_materials><material id="red" name="Red"><instance_effect url="#red-fx"/></material></library_materials>\n'
  + '<library_geometries><geometry id="box" name="Box"><mesh>\n'
  + '<source id="box-pos"><float_array id="box-pos-array" count="24">' + V.flat().join(' ') + '</float_array><technique_common><accessor source="#box-pos-array" count="8" stride="3"><param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common></source>\n'
  + '<vertices id="box-vtx"><input semantic="POSITION" source="#box-pos"/></vertices>\n'
  + '<polylist material="mat" count="6"><input semantic="VERTEX" source="#box-vtx" offset="0"/><vcount>4 4 4 4 4 4</vcount><p>' + Q.flat().join(' ') + '</p></polylist>\n'
  + '</mesh></geometry></library_geometries>\n'
  + '<library_visual_scenes><visual_scene id="scene"><node id="box-node" name="Box"><instance_geometry url="#box"><bind_material><technique_common><instance_material symbol="mat" target="#red"/></technique_common></bind_material></instance_geometry></node></visual_scene></library_visual_scenes>\n'
  + '<scene><instance_visual_scene url="#scene"/></scene>\n</COLLADA>\n';
// Millimetres become metres and Z up becomes Y up: 30 × 20 × 10 mm reads 0.03 × 0.01 × 0.02 m.
addCase('dae-millimetre-z-up', [write('dae/box.dae', dae)], { formats: ['COLLADA'], up: 'y', units: 'm', triangles: 12, vertices: 8, parts: 1, size: [0.03, 0.01, 0.02], tol: 1e-6 });
addCase('dae-not-collada', [write('dae/not.dae', '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>')], { error: /not a COLLADA/ });

// ═════════════════════════════ 3DS ═══════════════════════════════════════
function chunk(id, ...parts) {
  const body = Buffer.concat(parts);
  const h = Buffer.alloc(6); h.writeUInt16LE(id, 0); h.writeUInt32LE(6 + body.length, 2);
  return Buffer.concat([h, body]);
}
const u16 = v => { const b = Buffer.alloc(2); b.writeUInt16LE(v); return b; };
const u32 = v => { const b = Buffer.alloc(4); b.writeUInt32LE(v); return b; };
const cstr = s => Buffer.from(s + '\0', 'latin1');
const points = Buffer.concat([u16(8), ...V.map(p => { const b = Buffer.alloc(12); p.forEach((v, k) => b.writeFloatLE(v, k * 4)); return b; })]);
const faces = Buffer.concat([u16(12), ...T.map(t => Buffer.concat([u16(t[0]), u16(t[1]), u16(t[2]), u16(0)]))]);
const matGroup = chunk(0x4130, cstr('Red'), u16(12), ...T.map((_, i) => u16(i)));
const tds = chunk(0x4D4D,
  chunk(0x0002, u32(3)),
  chunk(0x3D3D,
    chunk(0x3D3E, u32(3)),
    chunk(0xAFFF, chunk(0xA000, cstr('Red')), chunk(0xA020, chunk(0x0011, Buffer.from([204, 26, 26])))),
    chunk(0x4000, cstr('Box'), chunk(0x4100, chunk(0x4110, points), chunk(0x4120, faces, matGroup)))));
addCase('3ds', [write('3ds/box.3ds', tds)], { formats: ['3DS'], up: 'z', ...BOX, materials: 1 });
addCase('3ds-truncated', [write('3ds/truncated.3ds', tds.subarray(0, 40))], { anyOutcome: true });

// ═════════════════════════════ VRML ══════════════════════════════════════
const wrl = '#VRML V2.0 utf8\n# a box, and a sky that must not count toward the size\nBackground { skyColor [ 0.2 0.3 0.6 ] }\n'
  + 'Transform { children [ Shape {\n appearance Appearance { material Material { diffuseColor 0.8 0.1 0.1 } }\n geometry IndexedFaceSet {\n  solid FALSE\n  coord Coordinate { point [ ' + V.map(p => p.join(' ')).join(', ') + ' ] }\n  coordIndex [ ' + Q.map(q => q.join(' ') + ' -1').join(', ') + ' ]\n }\n} ] }\n';
addCase('vrml-with-background', [write('vrml/box.wrl', wrl)], { formats: ['VRML'], up: 'y', ...BOX });
addCase('vrml-1', [write('vrml/old.wrl', '#VRML V1.0 ascii\nSeparator { Cube {} }\n')], { error: /VRML 1\.0/ });

// ═════════════════════════════ USD ═══════════════════════════════════════
const usda = '#usda 1.0\n(\n    defaultPrim = "Box"\n    metersPerUnit = 0.001\n    upAxis = "Z"\n)\n\ndef Xform "Box"\n{\n    def Mesh "BoxMesh"\n    {\n'
  + '        int[] faceVertexCounts = [' + Q.map(() => 4).join(', ') + ']\n'
  + '        int[] faceVertexIndices = [' + Q.flat().join(', ') + ']\n'
  + '        point3f[] points = [' + V.map(p => '(' + p.join(', ') + ')').join(', ') + ']\n'
  + '        color3f[] primvars:displayColor = [(0.8, 0.1, 0.1)]\n    }\n}\n';
// metersPerUnit 0.001 and Z up: 30 × 20 × 10 mm reads 0.03 × 0.01 × 0.02 m.
const USD_EXPECT = { formats: ['USD'], up: 'y', units: 'm', triangles: 12, vertices: 8, parts: 1, size: [0.03, 0.01, 0.02], tol: 1e-6 };
addCase('usda', [write('usd/box.usda', usda)], USD_EXPECT);
addCase('usdz', [write('usd/box.usdz', Buffer.from(fflate.zipSync({ 'box.usda': [fflate.strToU8(usda), { level: 0 }] }, { mtime: new Date('2026-01-01T00:00:00Z') })))], USD_EXPECT);

// ═════════════════════════════ STEP ══════════════════════════════════════
function stepBox() {
  const lines = [];
  let n = 0;
  const e = s => { lines.push('#' + (++n) + '=' + s + ';'); return '#' + n; };
  const r = x => Number.isInteger(x) ? x + '.' : String(x);
  const pt = p => e("CARTESIAN_POINT('',(" + p.map(r).join(',') + '))');
  const dir = d => e("DIRECTION('',(" + d.map(r).join(',') + '))');
  const app = e("APPLICATION_CONTEXT('automotive design')");
  e("APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000," + app + ')');
  const pctx = e("PRODUCT_CONTEXT(''," + app + ",'mechanical')");
  const prod = e("PRODUCT('Box','Box',''," + '(' + pctx + '))');
  const pdf = e("PRODUCT_DEFINITION_FORMATION('',''," + prod + ')');
  const pdc = e("PRODUCT_DEFINITION_CONTEXT('part definition'," + app + ",'design')");
  const pd = e("PRODUCT_DEFINITION('design',''," + pdf + ',' + pdc + ')');
  const pds = e("PRODUCT_DEFINITION_SHAPE(''," + "''," + pd + ')');
  const mm = e('(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))');
  const rad = e('(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.))');
  const sr = e('(NAMED_UNIT(*)SI_UNIT($,.STERADIAN.)SOLID_ANGLE_UNIT())');
  const unc = e("UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-07)," + mm + ",'distance_accuracy_value','')");
  const ctx = e('(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((' + unc + '))GLOBAL_UNIT_ASSIGNED_CONTEXT((' + mm + ',' + rad + ',' + sr + "))REPRESENTATION_CONTEXT('Box','3D'))");
  const origin = e("AXIS2_PLACEMENT_3D(''," + pt([0, 0, 0]) + ',' + dir([0, 0, 1]) + ',' + dir([1, 0, 0]) + ')');
  const vtx = V.map(p => e("VERTEX_POINT(''," + pt(p) + ')'));
  const edges = new Map();
  const edge = (a, b) => {
    const key = Math.min(a, b) + '-' + Math.max(a, b);
    if (!edges.has(key)) {
      const [s, t] = [Math.min(a, b), Math.max(a, b)];
      const d = sub(V[t], V[s]);
      const len = Math.hypot(...d);
      const line = e("LINE(''," + pt(V[s]) + ',' + e("VECTOR(''," + dir(norm(d)) + ',' + r(len) + ')') + ')');
      edges.set(key, { id: e("EDGE_CURVE(''," + vtx[s] + ',' + vtx[t] + ',' + line + ',.T.)'), s });
    }
    const ed = edges.get(key);
    return e("ORIENTED_EDGE('',*,*," + ed.id + ',' + (ed.s === a ? '.T.' : '.F.') + ')');
  };
  const faceIds = Q.map(q => {
    const loop = e("EDGE_LOOP('',(" + q.map((a, i) => edge(a, q[(i + 1) % 4])).join(',') + '))');
    const bound = e("FACE_OUTER_BOUND(''," + loop + ',.T.)');
    const nrm = faceNormal(q[0], q[1], q[2]);
    const plane = e("PLANE(''," + e("AXIS2_PLACEMENT_3D(''," + pt(V[q[0]]) + ',' + dir(nrm) + ',' + dir(norm(sub(V[q[1]], V[q[0]]))) + ')') + ')');
    return e("ADVANCED_FACE('',(" + bound + ')' + ',' + plane + ',.T.)');
  });
  const shell = e("CLOSED_SHELL('',(" + faceIds.join(',') + '))');
  const solid = e("MANIFOLD_SOLID_BREP('Box'," + shell + ')');
  const rep = e("ADVANCED_BREP_SHAPE_REPRESENTATION('Box',(" + origin + ',' + solid + '),' + ctx + ')');
  e('SHAPE_DEFINITION_REPRESENTATION(' + pds + ',' + rep + ')');
  // Colour the solid red.
  const colour = e("COLOUR_RGB(''," + RED.map(r).join(',') + ')');
  const fill = e("FILL_AREA_STYLE('',(" + e("FILL_AREA_STYLE_COLOUR(''," + colour + ')') + '))');
  const side = e("SURFACE_SIDE_STYLE('',(" + e('SURFACE_STYLE_FILL_AREA(' + fill + ')') + '))');
  const psa = e('PRESENTATION_STYLE_ASSIGNMENT((' + e('SURFACE_STYLE_USAGE(.BOTH.,' + side + ')') + '))');
  const styled = e("STYLED_ITEM('color',(" + psa + '),' + solid + ')');
  e("MECHANICAL_DESIGN_GEOMETRIC_PRESENTATION_REPRESENTATION('',(" + styled + '),' + ctx + ')');
  return 'ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION((\'Online 3D Viewer test box\'),\'2;1\');\nFILE_NAME(\'box.stp\',\'2026-11-11T00:00:00\',(\'\'),(\'\'),\'make-fixtures.mjs\',\'\',\'\');\n'
    + 'FILE_SCHEMA((\'AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }\'));\nENDSEC;\nDATA;\n' + lines.join('\n') + '\nENDSEC;\nEND-ISO-10303-21;\n';
}
addCase('step-ap214-box', [write('step/box.stp', stepBox())], { formats: ['STEP'], up: 'z', units: 'mm', triangles: 12, vertices: 8, parts: 1, size: [30, 20, 10], colour: RED, tol: 1e-4 });
addCase('step-xml', [write('step/box-xml.stp', '<?xml version="1.0"?>\n<iso_10303_28 version="2.0"></iso_10303_28>\n')], { error: /XML/ });
addCase('step-garbage', [write('step/garbage.step', 'ISO-10303-21;\nHEADER;\nthis is not a real step file at all\nENDSEC;\n'.repeat(3))], { error: /STEP/ });

// ═════════════════════════════ IGES ══════════════════════════════════════
// Six untrimmed bilinear B-spline surfaces (entity 128), one per face.
function igesBox() {
  const col = (s, w) => String(s).padStart(w);
  const S = ['Online 3D Viewer test box, six bilinear B-spline surfaces'.padEnd(72) + 'S' + col(1, 7)];
  const g = '1H,,1H;,7HBOX.IGS,7HBOX.IGS,17Hmake-fixtures.mjs,3H1.0,32,38,6,308,15,7HBOX.IGS,1.,2,2HMM,1,1.,15H20261111.000000,1.E-06,100.,4Htest,4Htest,11,0,15H20261111.000000;';
  const G = [];
  for (let i = 0; i < g.length; i += 72) G.push(g.slice(i, i + 72).padEnd(72) + 'G' + col(G.length + 1, 7));
  const D = [], P = [];
  Q.forEach((q, fi) => {
    const [a, b, c, d] = q.map(i => V[i]);
    // Control points in u-fastest order: P00 = a, P10 = b, P01 = d, P11 = c.
    // 128, K1, K2, M1, M2, PROP1-5 | knots S (4), knots T (4), weights (4), control points (4 × xyz), U0, U1, V0, V1
    const params = [128, 1, 1, 1, 1, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, ...a, ...b, ...d, ...c, 0, 1, 0, 1];
    // The first ten are integers; everything after is real and is written with a point.
    const fmt = params.map((v, i) => (i >= 10 ? (String(v).includes('.') ? String(v) : v + '.') : String(v)));
    const text = fmt.join(',') + ';';
    const deSeq = D.length + 1;
    const start = P.length + 1;
    let line = '';
    const lines = [];
    for (const tok of text.split(/(?<=[,;])/)) {
      if ((line + tok).length > 64) { lines.push(line); line = ''; }
      line += tok;
    }
    if (line) lines.push(line);
    for (const l of lines) P.push(l.padEnd(64) + ' ' + col(deSeq, 7) + 'P' + col(P.length + 1, 7));
    D.push(col(128, 8) + col(start, 8) + col(0, 8) + col(0, 8) + col(0, 8) + col(0, 8) + col(0, 8) + col(0, 8) + '00000000' + 'D' + col(deSeq, 7));
    D.push(col(128, 8) + col(0, 8) + col(0, 8) + col(lines.length, 8) + col(0, 8) + ' '.repeat(8) + ' '.repeat(8) + ('FACE' + (fi + 1)).padStart(8) + col(0, 8) + 'D' + col(deSeq + 1, 7));
  });
  const Tline = ('S' + col(S.length, 7) + 'G' + col(G.length, 7) + 'D' + col(D.length, 7) + 'P' + col(P.length, 7)).padEnd(72) + 'T' + col(1, 7);
  return [...S, ...G, ...D, ...P, Tline].join('\r\n') + '\r\n';
}
addCase('iges-surfaces-box', [write('iges/box.igs', igesBox())], { formats: ['IGES'], up: 'z', units: 'mm', minTriangles: 12, size: [30, 20, 10], tol: 1e-3 });
addCase('iges-not-iges', [write('iges/not.iges', 'just some text that is long enough to look like a file but is not IGES at all, no.\n'.repeat(3))], { error: /not an IGES/ });

// ═════════════════════════════ Rhino 3DM ═════════════════════════════════
{
  const rhino = await (req('rhino3dm'))();
  const doc = new rhino.File3dm();
  doc.settings().modelUnitSystem = rhino.UnitSystem.Millimeters;
  const mesh = new rhino.Mesh();
  V.forEach(p => mesh.vertices().add(p[0], p[1], p[2]));
  Q.forEach(q => mesh.faces().addQuadFace(q[0], q[1], q[2], q[3]));
  mesh.normals().computeNormals();
  mesh.compact();
  const attr = new rhino.ObjectAttributes();
  attr.name = 'Box';
  doc.objects().add(mesh, attr);
  doc.objects().add(new rhino.LineCurve([0, 0, 0], [30, 20, 10]), null);
  doc.objects().add(new rhino.Point([15, 10, 10]), null);
  addCase('3dm-mesh-line-point', [write('3dm/box.3dm', Buffer.from(doc.toByteArray()))], { formats: ['Rhino 3DM'], up: 'z', units: 'mm', ...BOX, minSegments: 1, points: 1 });
}
addCase('3dm-not-3dm', [write('3dm/not.3dm', Buffer.alloc(200, 7))], { error: /not a Rhino/ });

// ═════════════════════════════ Robustness ════════════════════════════════
addCase('empty-file', [write('misc/empty.stl', Buffer.alloc(0))], { error: /empty/ });
{
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF) / 0x7FFFFFFF;
  const junk = Buffer.alloc(1003);
  for (let i = 0; i < junk.length; i++) junk[i] = Math.floor(rnd() * 256);
  junk.write('not solid', 0, 'latin1');
  addCase('garbage-bytes-as-stl', [write('misc/garbage.stl', junk)], { error: /STL/ });
}
addCase('unknown-file', [write('misc/notes.txt', 'shopping list: milk, eggs')], { error: /not a 3D model/ });
addCase('only-a-material-file', [write('misc/box.mtl', 'newmtl Red\nKd 1 0 0\n')], { error: /model file/ });
addCase('two-models-at-once', [write('multi/a.stl', stlAscii()), write('multi/b.ply', plyAscii())], { formats: ['STL', 'PLY'], triangles: 24, vertices: 16, parts: 2 });
addCase('model-and-junk-file', [write('mixed/box.stl', stlAscii()), write('mixed/readme.txt', 'hello')], { formats: ['STL'], ...BOX, warning: /readme\.txt/ });

// (The large timing mesh is generated by run.mjs at test time; it is too big to keep here.)

fs.writeFileSync(path.join(OUT, 'cases.json'), JSON.stringify(cases, (k, v) => v instanceof RegExp ? { re: v.source } : v, 1));
let bytes = 0;
const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else bytes += fs.statSync(p).size; } };
walk(OUT);
console.log('wrote ' + cases.length + ' cases, ' + (bytes / 1024).toFixed(0) + ' KB, in ' + OUT);
