// A small ZIP reader and writer, enough for the two things the Builder does with archives:
// reading an .xlsx (which is a ZIP of XML) that the reader picked, and writing the study
// package the Download button hands back.
//
// No vendored library: the browser's own CompressionStream / DecompressionStream does the
// deflating, and everything else here is the ZIP container itself (local headers, the central
// directory, CRC-32). Where the browser has no 'deflate-raw' stream the writer stores the files
// uncompressed (a valid ZIP, only bigger) and the reader says so instead of guessing.
//
// Plain ES module, no DOM, so the tests can import it in Node 18+ (which has both streams).

const U8 = (n) => new Uint8Array(n);
const te = new TextEncoder();

// ---------------------------------------------------------------------------------------------
// CRC-32 (the ZIP checksum)

let TABLE = null;
function crcTable() {
  if (TABLE) return TABLE;
  TABLE = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    TABLE[i] = c >>> 0;
  }
  return TABLE;
}
export function crc32(bytes) {
  const t = crcTable();
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ---------------------------------------------------------------------------------------------
// Bytes <-> base64 (how an attached file travels in a saved workflow)

export function bytesToBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function base64ToBytes(b64) {
  const s = atob(String(b64 || ''));
  const out = U8(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Deflate / inflate through the browser's streams

export const hasDeflate = typeof CompressionStream === 'function';
export const hasInflate = typeof DecompressionStream === 'function';

async function through(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return U8(await res.arrayBuffer());
}
export async function deflateRaw(bytes) {
  if (!hasDeflate) return null;
  try { return await through(bytes, new CompressionStream('deflate-raw')); } catch (e) { return null; }
}
export async function inflateRaw(bytes) {
  if (!hasInflate) throw new Error('This browser cannot unpack .xlsx files here.');
  return through(bytes, new DecompressionStream('deflate-raw'));
}

// ---------------------------------------------------------------------------------------------
// Writing

const dosTime = (d) => ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF;
const dosDate = (d) => (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;

// files: [{ name, bytes | text }]. Returns a Blob of the archive. Names use "/" and are written
// as UTF-8 (bit 11 set), so folders inside the package work on every unpacker.
export async function makeZip(files, when = new Date()) {
  const parts = [], central = [];
  let offset = 0;
  const time = dosTime(when), date = dosDate(when);
  for (const f of files) {
    const name = te.encode(String(f.name).replace(/\\/g, '/'));
    const raw = f.bytes instanceof Uint8Array ? f.bytes : te.encode(String(f.text === undefined ? '' : f.text));
    const crc = crc32(raw);
    const packed = raw.length > 64 ? await deflateRaw(raw) : null;
    const use = packed && packed.length < raw.length ? packed : raw;
    const method = use === packed ? 8 : 0;
    const local = U8(30 + name.length);
    const dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);          // version needed
    dv.setUint16(6, 0x0800, true);      // UTF-8 names
    dv.setUint16(8, method, true);
    dv.setUint16(10, time, true);
    dv.setUint16(12, date, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, use.length, true);
    dv.setUint32(22, raw.length, true);
    dv.setUint16(26, name.length, true);
    local.set(name, 30);
    parts.push(local, use);
    const cd = U8(46 + name.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, method, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, use.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    cd.set(name, 46);
    central.push(cd);
    offset += local.length + use.length;
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const end = U8(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}

// ---------------------------------------------------------------------------------------------
// Reading (only what an .xlsx needs: stored and deflated entries, no encryption, no ZIP64)

// Returns a Map of name -> Uint8Array. Throws with a plain message on anything it cannot read.
export async function readZip(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : U8(bytes);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  // The end-of-central-directory record, searched from the end (it may carry a comment).
  let end = -1;
  for (let i = b.length - 22; i >= 0 && i > b.length - 22 - 0xFFFF; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error('this file is not a readable .xlsx (no ZIP directory in it)');
  const count = dv.getUint16(end + 10, true);
  let p = dv.getUint32(end + 16, true);
  const out = new Map();
  for (let k = 0; k < count; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('this .xlsx has a damaged directory');
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const cmtLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + cmtLen;
    if (name.endsWith('/')) continue;
    if (dv.getUint32(local, true) !== 0x04034b50) throw new Error('this .xlsx has a damaged entry');
    const lNameLen = dv.getUint16(local + 26, true);
    const lExtraLen = dv.getUint16(local + 28, true);
    const start = local + 30 + lNameLen + lExtraLen;
    const raw = b.subarray(start, start + csize);
    if (method === 0) out.set(name, raw);
    else if (method === 8) out.set(name, await inflateRaw(raw));
    else throw new Error(`this .xlsx uses a packing method this page cannot read (${method})`);
  }
  return out;
}
