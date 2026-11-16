// Writes the DGN fixtures, byte by byte from the IGDS (MicroStation V7)
// layout, with no DGN library:
//
//   dgn/box-3d.dgn   3D, millimetres: the 30 × 20 × 10 box as 12 lines (level 5,
//                    colour 3 from the file's own colour table), a circle of
//                    radius 5 on its top face (an ellipse, colour 1), a text
//                    label (not drawn: a note says so), and a deleted line far
//                    away (must be ignored).
//   dgn/plan-2d.dgn  2D, metres (100 cm of 10 UORs), global origin moved: a
//                    30 × 20 rectangle (a shape), a quarter arc of radius 10
//                    from its corner, and a cell holding a line string.
//   dgn/v8.dgn       an OLE compound file header, as MicroStation V8 writes
//                    (refused, saying how to save V7).
//   dgn/not.dgn      text (refused).
//
//   node make-dgn.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'dgn');
fs.mkdirSync(OUT, { recursive: true });

// VAX-order 32-bit integer: the high 16-bit word first, each word little-endian.
function int32(v) {
  const u = v >>> 0;
  return [(u >>> 16) & 0xFF, (u >>> 24) & 0xFF, u & 0xFF, (u >>> 8) & 0xFF];
}
// VAX D-float: sign, exponent excess 128, 55-bit fraction after a hidden 1 (0.1fff × 2^(e-128)).
function vax(v) {
  if (v === 0) return [0, 0, 0, 0, 0, 0, 0, 0];
  const sign = v < 0 ? 1 : 0;
  const a = Math.abs(v);
  const exp = Math.floor(Math.log2(a)) + 129;
  const frac = BigInt(Math.round((a / 2 ** (exp - 129) - 1) * 2 ** 52)) << 3n;   // 52 bits of a double, as 55
  const w0 = (sign << 15) | (exp << 7) | Number((frac >> 48n) & 0x7Fn);
  const w = [w0, Number((frac >> 32n) & 0xFFFFn), Number((frac >> 16n) & 0xFFFFn), Number(frac & 0xFFFFn)];
  return w.flatMap(x => [x & 0xFF, x >> 8]);
}
const u16 = v => [v & 0xFF, (v >> 8) & 0xFF];

/* An element: level / complex, type / deleted, words to follow, then the
   range (6 integers), graphic group, attribute index, properties and
   symbology (weight·8 + style, colour), then its data. */
function element(type, level, data, { colour = 0, complex = false, deleted = false } = {}) {
  const body = [...Array(24).fill(0), 0, 0, 0, 0, 0, 0, 0, colour, ...data];
  if (body.length % 2) body.push(0);
  return [level | (complex ? 0x80 : 0), type | (deleted ? 0x80 : 0), ...u16(body.length / 2), ...body];
}

function tcb(is3d, { subPerMaster, uorPerSub, master, sub, origin = [0, 0, 0] }) {
  const b = new Array(1536).fill(0);
  b[0] = is3d ? 0xC8 : 0x08; b[1] = 0x09; b[2] = 0xFE; b[3] = 0x02;
  if (is3d) b[1214] = 0x40;   // the TCB's own 3D flag
  b.splice(1112, 4, ...int32(subPerMaster));
  b.splice(1116, 4, ...int32(uorPerSub));
  b[1120] = master.charCodeAt(0); b[1121] = (master[1] || '\0').charCodeAt(0);
  b[1122] = sub.charCodeAt(0); b[1123] = (sub[1] || '\0').charCodeAt(0);
  b.splice(1240, 8, ...vax(origin[0])); b.splice(1248, 8, ...vax(origin[1])); b.splice(1256, 8, ...vax(origin[2]));
  return b;
}

function colourTable(entries) {
  // Background first (colour 255), then colours 0 to 254.
  const t = new Array(768).fill(0);
  t.splice(0, 3, 255, 255, 255);
  for (const [i, rgb] of Object.entries(entries)) t.splice(3 + i * 3, 3, ...rgb);
  return element(5, 1, [0, 0, ...t]);
}

const END = [0xFF, 0xFF];
const write = (name, bytes) => fs.writeFileSync(path.join(OUT, name), Buffer.from(bytes));

// ── box-3d.dgn: 1 master unit (mm) = 1 sub unit = 1000 UORs ──
{
  const U = 1000;
  const P = (x, y, z) => [...int32(x * U), ...int32(y * U), ...int32(z * U)];
  const c = [[0, 0, 0], [30, 0, 0], [30, 20, 0], [0, 20, 0], [0, 0, 10], [30, 0, 10], [30, 20, 10], [0, 20, 10]];
  const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  const els = [tcb(true, { subPerMaster: 1, uorPerSub: U, master: 'mm', sub: 'mm' }), colourTable({ 1: [0, 0, 255], 3: [200, 30, 40] })];
  for (const [a, b] of edges) els.push(element(3, 5, [...P(...c[a]), ...P(...c[b])], { colour: 3 }));
  // A circle on the top face: primary and secondary axes, an identity quaternion (w = 2^31 - 1), the centre.
  els.push(element(15, 7, [...vax(5 * U), ...vax(5 * U), ...int32(0x7FFFFFFF), ...int32(0), ...int32(0), ...int32(0), ...vax(15 * U), ...vax(10 * U), ...vax(10 * U)], { colour: 1 }));
  els.push(element(17, 9, new Array(28).fill(0)));
  els.push(element(3, 5, [...P(500, 500, 500), ...P(600, 600, 600)], { colour: 3, deleted: true }));
  write('box-3d.dgn', [...els.flat(), ...END]);
}

// ── plan-2d.dgn: 1 m = 100 cm, 1 cm = 10 UORs; the global origin at (-1000, -2000) UORs ──
{
  const U = 1000;   // UORs per metre
  const ox = -1000, oy = -2000;
  // A UOR count is the point's distance from the global origin: x · U + origin (dgnlib subtracts it back).
  const P = (x, y) => [...int32(Math.round(x * U + ox)), ...int32(Math.round(y * U + oy))];
  const els = [tcb(false, { subPerMaster: 100, uorPerSub: 10, master: 'm', sub: 'cm', origin: [ox, oy, 0] })];
  // The rectangle, as a closed shape of 5 points.
  const rect = [[0, 0], [30, 0], [30, 20], [0, 20], [0, 0]];
  els.push(element(6, 1, [...u16(rect.length), ...rect.flatMap(p => P(...p))], { colour: 2 }));
  // A quarter arc of radius 10 about the origin corner: start 0°, sweep 90°, axes, rotation 0, centre.
  els.push(element(16, 2, [...int32(0), ...int32(90 * 360000), ...vax(10 * U), ...vax(10 * U), ...int32(0), ...vax(0 * U + ox), ...vax(0 * U + oy)], { colour: 4 }));
  // A cell with a line string inside: the header, then its component marked complex.
  els.push(element(2, 3, new Array(56).fill(0)));
  const ls = [[5, 5], [10, 15], [25, 15]];
  els.push(element(4, 3, [...u16(ls.length), ...ls.flatMap(p => P(...p))], { colour: 6, complex: true }));
  write('plan-2d.dgn', [...els.flat(), ...END]);
}

// ── v8.dgn: the OLE compound file signature MicroStation V8 files start with ──
write('v8.dgn', [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, ...new Array(504).fill(0)]);
fs.writeFileSync(path.join(OUT, 'not.dgn'), 'This is not a design file, only text.\n');
console.log('Wrote', fs.readdirSync(OUT).join(', '));
