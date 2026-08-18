/* QR Code Data Transfer — protocol core (QRT/1).
 *
 * Pure by design: no DOM, no CDN global, no browser-only API. The same file runs
 * in the page, inside a worker, and inside node's vm, which is how the audit
 * harness tests the wire protocol without a browser or a camera.
 *
 * Wire format
 *   wire = "Q" + "1" + base45(body) + ":"
 * The "Q1" prefix and ":" terminator keep a Base45 character (the alphabet
 * contains SPACE) from ever being first or last, so a decoder that trims its
 * output cannot silently eat a payload byte.
 *
 * Body layout, common to both frame types (n = body size, fixed per session):
 *   0        1  type: 0x01 manifest, 0x02 data
 *   1        4  sessionId  uint32 LE
 *   5      n-9  type-specific, zero padded
 *   n-4      4  crc32 of body[0 .. n-5]  uint32 LE
 *
 * Data frame (0x02):   5:symbolId uint32 LE, 9:payload[blockSize]
 *   symbolId <  K  systematic, payload is source block symbolId verbatim
 *   symbolId >= K  LT fountain symbol, XOR of a seed-derived index set
 *
 * Manifest frame (0x01): protoVer, flags, K, blockSize, payloadSize,
 *   originalSize, fileCrc32, the quantised degree table, then length-prefixed
 *   UTF-8 filename and MIME type.
 *
 * Exports globalThis.QRTCodec.
 */
(function (global) {
'use strict';

var PROTO_VER = 1;
var TYPE_MANIFEST = 0x01;
var TYPE_DATA = 0x02;
var HDR_DATA = 13;        // type 1 + sessionId 4 + symbolId 4 + crc 4
var MAX_K = 8192;         // keeps K well under 2^21, see symbolIndices()
var MAX_NAME = 120;
var MAX_MIME = 80;
var MAX_DEG_ENTRIES = 40;

// ── Base45 (RFC 9285) ───────────────────────────────────────────────────────

var A45 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
var A45_REV = new Int16Array(128);
for (var _i = 0; _i < 128; _i++) A45_REV[_i] = -1;
for (var _j = 0; _j < 45; _j++) A45_REV[A45.charCodeAt(_j)] = _j;

function base45Encode(bytes) {
  var n = bytes.length;
  var out = new Array((n >> 1) * 3 + ((n & 1) ? 2 : 0));
  var o = 0, i = 0, v;
  for (; i + 1 < n; i += 2) {
    v = bytes[i] * 256 + bytes[i + 1];
    out[o++] = A45.charAt(v % 45);
    out[o++] = A45.charAt(((v / 45) | 0) % 45);
    out[o++] = A45.charAt((v / 2025) | 0);
  }
  if (i < n) {
    v = bytes[i];
    out[o++] = A45.charAt(v % 45);
    out[o++] = A45.charAt((v / 45) | 0);
  }
  return out.join('');
}

function a45val(str, i) {
  var c = str.charCodeAt(i);
  var v = c < 128 ? A45_REV[c] : -1;
  if (v < 0) throw new Error('base45: character outside the alphabet');
  return v;
}

function base45Decode(str) {
  var L = str.length;
  var rem = L % 3;
  if (rem === 1) throw new Error('base45: bad length');
  var out = new Uint8Array(((L / 3) | 0) * 2 + (rem === 2 ? 1 : 0));
  var o = 0, i = 0, v;
  for (; i + 2 < L; i += 3) {
    v = a45val(str, i) + a45val(str, i + 1) * 45 + a45val(str, i + 2) * 2025;
    if (v > 65535) throw new Error('base45: value overflow');
    out[o++] = v >>> 8;
    out[o++] = v & 255;
  }
  if (i < L) {
    v = a45val(str, i) + a45val(str, i + 1) * 45;
    if (v > 255) throw new Error('base45: value overflow');
    out[o++] = v;
  }
  return out;
}

// ── CRC-32 (IEEE, reflected) ────────────────────────────────────────────────

var CRC_T = null;
function crcTable() {
  if (CRC_T) return CRC_T;
  var t = new Uint32Array(256);
  for (var i = 0; i < 256; i++) {
    var c = i;
    for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  CRC_T = t;
  return t;
}

function crc32(bytes, start, end) {
  var t = crcTable();
  var c = 0xFFFFFFFF;
  var s = start || 0;
  var e = (end === undefined || end === null) ? bytes.length : end;
  for (var i = s; i < e; i++) c = (c >>> 8) ^ t[(c ^ bytes[i]) & 0xFF];
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ── Deterministic PRNG ──────────────────────────────────────────────────────
// Sender and receiver must derive byte-identical index sets from the same
// symbolId, so every step is an exact uint32 operation. Math.imul is required:
// a plain a*b on two uint32s can exceed 2^53 and lose mantissa bits.

function mix32(x) {
  x = (x + 0x9E3779B9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21F0AAAD) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x735A2D97) >>> 0;
  return (x ^ (x >>> 15)) >>> 0;
}

function rng32(seed) {
  var s = mix32(seed >>> 0);
  if (s === 0) s = 0x9E3779B9;   // xorshift32 has a fixed point at zero
  return function next() {
    s ^= s << 13; s >>>= 0;      // << can set bit 31, so renormalise
    s ^= s >>> 17;
    s ^= s << 5;  s >>>= 0;
    return s >>> 0;
  };
}

// ── QR capacity ─────────────────────────────────────────────────────────────
// Total data codewords per version. Cross-check: byte-mode capacity at v40-L is
// 2956 - 3 = 2953, and at v40-M is 2334 - 3 = 2331, both matching the standard.

var DATA_CODEWORDS = {
  L: [19,34,55,80,108,136,156,194,232,274,324,370,428,461,523,589,647,721,795,861,
      932,1006,1094,1174,1276,1370,1468,1531,1631,1735,1843,1955,2071,2191,2306,
      2434,2566,2702,2812,2956],
  M: [16,28,44,64,86,108,124,154,182,216,254,290,334,365,415,453,507,563,627,669,
      714,782,860,914,1000,1062,1128,1193,1267,1373,1455,1541,1631,1725,1812,1914,
      1992,2102,2216,2334]
};

function alnumCapacity(version, ecc) {
  var tbl = DATA_CODEWORDS[ecc];
  if (!tbl || version < 1 || version > 40) throw new Error('bad QR version or ECC level');
  var bits = tbl[version - 1] * 8 - 4 - (version <= 9 ? 9 : (version <= 26 ? 11 : 13));
  var pairs = Math.floor(bits / 11);
  var chars = pairs * 2;
  if (bits - pairs * 11 >= 6) chars += 1;   // a lone trailing character costs 6 bits
  return chars;
}

// Largest even body size whose wire string still fits: 2 + 3n/2 + 1 <= capacity.
function bodySizeFor(version, ecc) {
  var n = Math.floor((alnumCapacity(version, ecc) - 3) * 2 / 3);
  if (n & 1) n -= 1;
  return n;
}

function blockSizeFor(version, ecc) { return bodySizeFor(version, ecc) - HDR_DATA; }

/* A receiver only ever sees the body size, so this recovers the version the
   sender used, which sets the module count the camera should be scaled for. */
function versionForBodySize(n, ecc) {
  ecc = ecc || 'L';
  for (var v = 1; v <= 40; v++) if (bodySizeFor(v, ecc) === n) return v;
  return 0;
}
function moduleCountFor(version) { return version * 4 + 17; }
function wireLengthFor(version, ecc) { return bodySizeFor(version, ecc) / 2 * 3 + 3; }

var PRESETS = [
  { id: 'compatible', label: 'Compatible', version: 15, ecc: 'L' },
  { id: 'safe',       label: 'Safe',       version: 20, ecc: 'L' },
  { id: 'balanced',   label: 'Balanced',   version: 25, ecc: 'L' },
  { id: 'dense',      label: 'Dense',      version: 30, ecc: 'L' },
  { id: 'max',        label: 'Maximum',    version: 40, ecc: 'L' }
];

function presetById(id) {
  for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) return PRESETS[i];
  return PRESETS[2];
}

// ── Degree distribution ─────────────────────────────────────────────────────
// Math.log is implementation-defined in the last ulp, and Robust Soliton has a
// discontinuity at floor(K/R): a 1-ulp difference there relocates the tau spike
// and gives the two sides different index sets, which fails the transfer with no
// diagnosable cause. So only the SENDER evaluates it. The result is lumped into
// at most 40 buckets, quantised to uint16, and shipped in the manifest. The
// receiver never touches a transcendental function.

var DEG_C = 0.1, DEG_DELTA = 0.05, DEG_W = 0.30, DEG_LADDER = 1.4;

function buildDegTable(K, c, delta, w) {
  c = (c === undefined) ? DEG_C : c;
  delta = (delta === undefined) ? DEG_DELTA : delta;
  w = (w === undefined) ? DEG_W : w;

  var R = Math.max(1, Math.round(c * Math.log(K / delta) * Math.sqrt(K) * 256) / 256);
  var kr = Math.floor(K / R);
  var pmf = new Float64Array(K + 2);
  var beta = 0, d, rho, tau;
  for (d = 1; d <= K; d++) {
    rho = (d === 1) ? 1 / K : 1 / (d * (d - 1));
    tau = 0;
    if (kr >= 1 && d <= kr - 1) tau = R / (d * K);
    else if (d === kr) tau = R * Math.log(R / delta) / K;
    pmf[d] = rho + tau;
    beta += pmf[d];
  }

  var L = [];
  for (d = 1; d <= K; d = Math.max(d + 1, Math.ceil(d * DEG_LADDER))) L.push(d);
  if (L[L.length - 1] !== K) L.push(K);
  while (L.length > MAX_DEG_ENTRIES) L.splice(1, 1);

  var lump = new Float64Array(L.length);
  var li = 0;
  for (d = 1; d <= K; d++) {
    while (li < L.length - 1 && d > L[li]) li++;
    lump[li] += pmf[d] / beta;
  }
  var tot = 0, i;
  for (i = 0; i < L.length; i++) { lump[i] = lump[i] * (1 - w) + w / L.length; tot += lump[i]; }

  var deg = new Uint16Array(L.length), cum = new Uint16Array(L.length);
  var acc = 0;
  for (i = 0; i < L.length; i++) {
    deg[i] = L[i];
    acc += lump[i] / tot;
    cum[i] = Math.min(65535, Math.round(acc * 65535));
  }
  cum[L.length - 1] = 65535;
  for (i = 1; i < cum.length; i++) if (cum[i] <= cum[i - 1]) cum[i] = cum[i - 1] + 1;
  cum[cum.length - 1] = 65535;
  return { deg: deg, cum: cum };
}

// Pure integer comparison, identical on every engine.
function sampleDegree(table, u16) {
  var cum = table.cum;
  for (var i = 0; i < cum.length; i++) if (u16 <= cum[i]) return table.deg[i];
  return table.deg[table.deg.length - 1];
}

// Math.floor(r * K / 4294967296) in exactly this order: r*K stays an exact
// integer below 2^53 (given K <= 8192), and dividing by 2^32 is an exact
// power-of-two rescale. Writing r/4294967296*K instead rounds first and can land
// one index away on a different engine.
function pickDistinct(r, K, d) {
  var out, i, j, t, idx, dup;
  if (d >= K) {
    out = new Uint32Array(K);
    for (i = 0; i < K; i++) out[i] = i;
    return out;
  }
  if (d * 2 > K) {
    var pool = new Uint32Array(K);
    for (i = 0; i < K; i++) pool[i] = i;
    for (i = 0; i < d; i++) {
      j = i + Math.floor(r() * (K - i) / 4294967296);
      t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    out = pool.slice(0, d);
    out.sort();
    return out;
  }
  out = new Uint32Array(d);
  var n = 0;
  while (n < d) {
    idx = Math.floor(r() * K / 4294967296);
    dup = false;
    for (j = 0; j < n; j++) if (out[j] === idx) { dup = true; break; }
    if (!dup) out[n++] = idx;
  }
  out.sort();
  return out;
}

function symbolIndices(symbolId, K, sessionId, table) {
  symbolId = symbolId >>> 0;
  if (symbolId < K) return Uint32Array.of(symbolId);
  var r = rng32((symbolId ^ (sessionId >>> 0)) >>> 0);
  var d = sampleDegree(table, r() >>> 16);
  if (d > K) d = K;
  if (d < 1) d = 1;
  return pickDistinct(r, K, d);
}

// ── Compression ─────────────────────────────────────────────────────────────

function drainStream(readable) {
  var reader = readable.getReader();
  var chunks = [], total = 0;
  function step() {
    return reader.read().then(function (res) {
      if (res.done) {
        var out = new Uint8Array(total), o = 0;
        for (var i = 0; i < chunks.length; i++) { out.set(chunks[i], o); o += chunks[i].length; }
        return out;
      }
      chunks.push(res.value);
      total += res.value.length;
      return step();
    });
  }
  return step();
}

function pipeThrough(bytes, stream) {
  var out = drainStream(stream.readable);
  var w = stream.writable.getWriter();
  return w.write(bytes)
    .then(function () { return w.close(); })
    .then(function () { return out; });
}

function hasCompression() {
  return typeof global.CompressionStream === 'function' &&
         typeof global.DecompressionStream === 'function';
}

function deflateRaw(bytes) {
  if (!hasCompression()) return Promise.resolve(null);
  try { return pipeThrough(bytes, new global.CompressionStream('deflate-raw')); }
  catch (e) { return Promise.resolve(null); }
}

function inflateRaw(bytes) {
  if (!hasCompression()) return Promise.reject(new Error('DecompressionStream unavailable'));
  return pipeThrough(bytes, new global.DecompressionStream('deflate-raw'));
}

// ── Session planning ────────────────────────────────────────────────────────

function utf8(str) {
  if (typeof global.TextEncoder === 'function') return new global.TextEncoder().encode(str);
  var out = [], i, c;
  for (i = 0; i < str.length; i++) {
    c = str.charCodeAt(i);
    if (c < 128) out.push(c);
    else if (c < 2048) out.push(192 | (c >> 6), 128 | (c & 63));
    else out.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63));
  }
  return new Uint8Array(out);
}

function fromUtf8(bytes) {
  if (typeof global.TextDecoder === 'function') return new global.TextDecoder().decode(bytes);
  var s = '';
  for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

function clipUtf8(str, max) {
  var b = utf8(str);
  if (b.length <= max) return b;
  b = b.subarray(0, max);
  while (b.length && (b[b.length - 1] & 0xC0) === 0x80) b = b.subarray(0, b.length - 1);
  if (b.length && (b[b.length - 1] & 0x80)) b = b.subarray(0, b.length - 1);
  return b;
}

/* Compress if it helps, checksum the original, and return everything
   planSession needs. Async only because CompressionStream is. */
function prepareSource(bytes, opts) {
  opts = opts || {};
  var originalSize = bytes.length;
  var fileCrc = crc32(bytes);
  var base = {
    originalSize: originalSize,
    fileCrc: fileCrc,
    name: opts.name || 'transfer.bin',
    mime: opts.mime || 'application/octet-stream'
  };
  if (opts.compress === false || originalSize === 0) {
    base.payload = bytes; base.compressed = false;
    return Promise.resolve(base);
  }
  return deflateRaw(bytes).then(function (packed) {
    // Keep the compressed form only if it actually shrinks.
    if (packed && packed.length < originalSize) { base.payload = packed; base.compressed = true; }
    else { base.payload = bytes; base.compressed = false; }
    return base;
  });
}

function planSession(src) {
  var preset = src.preset ? presetById(src.preset) : { version: src.version, ecc: src.ecc || 'L' };
  var version = preset.version, ecc = preset.ecc;
  var n = bodySizeFor(version, ecc);
  var blockSize = n - HDR_DATA;
  var payload = src.payload;
  var K = Math.max(1, Math.ceil(payload.length / blockSize));
  if (K > MAX_K) throw new Error('payload too large for this density (K=' + K + ')');

  var blocks = new Array(K);
  for (var i = 0; i < K; i++) {
    var b = new Uint8Array(blockSize);          // own buffer, so always 4-byte aligned
    b.set(payload.subarray(i * blockSize, Math.min((i + 1) * blockSize, payload.length)));
    blocks[i] = b;
  }

  var sessionId = (src.sessionId === undefined ? randomU32() : src.sessionId) >>> 0;
  var plan = {
    version: version, ecc: ecc, n: n, blockSize: blockSize, K: K,
    blocks: blocks, sessionId: sessionId,
    degTable: buildDegTable(K),
    payloadSize: payload.length,
    originalSize: src.originalSize,
    fileCrc: src.fileCrc >>> 0,
    compressed: !!src.compressed,
    name: src.name || 'transfer.bin',
    mime: src.mime || 'application/octet-stream'
  };
  plan.manifestBody = buildManifestBody(plan);
  return plan;
}

function randomU32() {
  var c = global.crypto;
  if (c && typeof c.getRandomValues === 'function') {
    return c.getRandomValues(new Uint32Array(1))[0] >>> 0;
  }
  return (Math.floor(Math.random() * 4294967296)) >>> 0;
}

// ── Frame encoding ──────────────────────────────────────────────────────────

function wrap(body) { return 'Q1' + base45Encode(body) + ':'; }

function buildManifestBody(plan) {
  var n = plan.n;
  var body = new Uint8Array(n);
  var dv = new DataView(body.buffer);
  var T = plan.degTable.deg.length;
  var name = clipUtf8(plan.name, MAX_NAME);
  var mime = clipUtf8(plan.mime, MAX_MIME);

  body[0] = TYPE_MANIFEST;
  dv.setUint32(1, plan.sessionId, true);
  body[5] = PROTO_VER;
  body[6] = plan.compressed ? 1 : 0;
  dv.setUint32(7, plan.K, true);
  dv.setUint16(11, plan.blockSize, true);
  dv.setUint32(13, plan.payloadSize, true);
  dv.setUint32(17, plan.originalSize, true);
  dv.setUint32(21, plan.fileCrc, true);
  body[25] = T;
  var o = 26;
  for (var i = 0; i < T; i++) {
    dv.setUint16(o, plan.degTable.deg[i], true); o += 2;
    dv.setUint16(o, plan.degTable.cum[i], true); o += 2;
  }
  if (o + 2 + name.length + mime.length > n - 4) throw new Error('manifest does not fit');
  body[o++] = name.length; body.set(name, o); o += name.length;
  body[o++] = mime.length; body.set(mime, o); o += mime.length;
  dv.setUint32(n - 4, crc32(body, 0, n - 4), true);
  return body;
}

function encodeManifestFrame(plan) { return wrap(plan.manifestBody); }

function encodeDataFrame(plan, symbolId) {
  var n = plan.n, blockSize = plan.blockSize;
  var body = new Uint8Array(n);
  var dv = new DataView(body.buffer);
  body[0] = TYPE_DATA;
  dv.setUint32(1, plan.sessionId, true);
  dv.setUint32(5, symbolId >>> 0, true);

  var ids = symbolIndices(symbolId, plan.K, plan.sessionId, plan.degTable);
  var payload = body.subarray(9, 9 + blockSize);
  for (var i = 0; i < ids.length; i++) xorInto(payload, plan.blocks[ids[i]]);

  dv.setUint32(n - 4, crc32(body, 0, n - 4), true);
  return wrap(body);
}

/* The emission schedule: 3 manifests up front, then one every 16 data frames.
   ~5.9% overhead for roughly a one second join latency at 8 fps. */
var MANIFEST_LEAD = 3, MANIFEST_EVERY = 16;

function isManifestSlot(emissionIndex) {
  if (emissionIndex < MANIFEST_LEAD) return true;
  return ((emissionIndex - MANIFEST_LEAD) % (MANIFEST_EVERY + 1)) === MANIFEST_EVERY;
}

// ── Frame parsing ───────────────────────────────────────────────────────────

function parseFrame(wire, expectedN) {
  if (typeof wire !== 'string') return null;
  var L = wire.length;
  if (L < 8) return null;
  if (wire.charCodeAt(0) !== 81 || wire.charCodeAt(1) !== 49) return null;   // "Q1"
  if (wire.charCodeAt(L - 1) !== 58) return null;                            // ":"
  if (expectedN && L !== expectedN / 2 * 3 + 3) return null;

  var body;
  try { body = base45Decode(wire.substring(2, L - 1)); }
  catch (e) { return null; }

  var n = body.length;
  if (n < 14 || (n & 1)) return null;
  if (expectedN && n !== expectedN) return null;

  var dv = new DataView(body.buffer, body.byteOffset, n);
  if (dv.getUint32(n - 4, true) !== crc32(body, 0, n - 4)) return null;

  var type = body[0];
  var sessionId = dv.getUint32(1, true);

  if (type === TYPE_DATA) {
    return { type: TYPE_DATA, n: n, sessionId: sessionId,
             symbolId: dv.getUint32(5, true),
             payload: body.subarray(9, n - 4) };
  }
  if (type !== TYPE_MANIFEST) return null;

  if (body[5] !== PROTO_VER) return null;
  var m = {
    type: TYPE_MANIFEST, n: n, sessionId: sessionId,
    compressed: (body[6] & 1) === 1,
    K: dv.getUint32(7, true),
    blockSize: dv.getUint16(11, true),
    payloadSize: dv.getUint32(13, true),
    originalSize: dv.getUint32(17, true),
    fileCrc: dv.getUint32(21, true)
  };
  if (m.blockSize !== n - HDR_DATA) return null;
  if (m.K < 1 || m.K > MAX_K) return null;
  if (m.K !== Math.max(1, Math.ceil(m.payloadSize / m.blockSize))) return null;

  var T = body[25];
  if (T < 1 || T > MAX_DEG_ENTRIES) return null;
  var o = 26;
  if (o + T * 4 + 2 > n - 4) return null;
  var deg = new Uint16Array(T), cum = new Uint16Array(T), prev = -1;
  for (var i = 0; i < T; i++) {
    deg[i] = dv.getUint16(o, true); o += 2;
    cum[i] = dv.getUint16(o, true); o += 2;
    if (deg[i] < 1 || deg[i] > m.K) return null;
    if (cum[i] <= prev) return null;
    prev = cum[i];
  }
  if (cum[T - 1] !== 65535) return null;
  m.degTable = { deg: deg, cum: cum };

  var nameLen = body[o++];
  if (nameLen > MAX_NAME || o + nameLen + 1 > n - 4) return null;
  m.name = fromUtf8(body.subarray(o, o + nameLen)); o += nameLen;
  var mimeLen = body[o++];
  if (mimeLen > MAX_MIME || o + mimeLen > n - 4) return null;
  m.mime = fromUtf8(body.subarray(o, o + mimeLen)); o += mimeLen;
  for (; o < n - 4; o++) if (body[o] !== 0) return null;   // padding must be clean
  return m;
}

// ── XOR ─────────────────────────────────────────────────────────────────────

function xorInto(a, b) {
  var len = a.length < b.length ? a.length : b.length;
  var i = 0;
  if (((a.byteOffset & 3) === 0) && ((b.byteOffset & 3) === 0) && len >= 16) {
    var words = len >>> 2;
    var av = new Uint32Array(a.buffer, a.byteOffset, words);
    var bv = new Uint32Array(b.buffer, b.byteOffset, words);
    for (; i < words; i++) av[i] ^= bv[i];
    i = words << 2;
  }
  for (; i < len; i++) a[i] ^= b[i];
}

// ── Peeling decoder ─────────────────────────────────────────────────────────

function createDecoder(opts) {
  var K = opts.K, blockSize = opts.blockSize;
  var sessionId = opts.sessionId >>> 0;
  var degTable = opts.degTable;
  var maxPending = opts.maxPendingBytes || (48 * 1024 * 1024);
  var geLimit = opts.geLimit === undefined ? 256 : opts.geLimit;

  var blocks = new Array(K);
  var blockToEqs = new Array(K);
  for (var i = 0; i < K; i++) { blocks[i] = null; blockToEqs[i] = []; }

  var recovered = 0, pendingBytes = 0, liveEqs = 0, peakPending = 0;
  var accepted = 0, redundant = 0, rejected = 0;
  var sinceGE = 0;
  var seen = new Set();
  var ripple = [];

  function processRipple() {
    while (ripple.length) {
      var item = ripple.pop();
      var id = item[0], data = item[1];
      if (blocks[id] !== null) continue;
      blocks[id] = data;
      recovered++;
      var lst = blockToEqs[id];
      blockToEqs[id] = [];
      for (var e = 0; e < lst.length; e++) {
        var eq = lst[e];
        if (eq.dead || !eq.unknown.has(id)) continue;
        xorInto(eq.data, data);
        eq.unknown.delete(id);
        if (eq.unknown.size === 1) {
          eq.dead = true; pendingBytes -= eq.data.length; liveEqs--;
          var only = eq.unknown.values().next().value;
          ripple.push([only, eq.data]);      // hand the buffer over, no copy
        } else if (eq.unknown.size === 0) {
          eq.dead = true; pendingBytes -= eq.data.length; liveEqs--;
        }
      }
    }
  }

  function evictWorst() {
    var worst = null, worstSize = -1;
    for (var id = 0; id < K; id++) {
      var lst = blockToEqs[id];
      for (var e = 0; e < lst.length; e++) {
        var eq = lst[e];
        if (!eq.dead && eq.unknown.size > worstSize) { worst = eq; worstSize = eq.unknown.size; }
      }
    }
    if (worst) { worst.dead = true; pendingBytes -= worst.data.length; liveEqs--; }
  }

  /* Bounded Gaussian elimination. Only fires on a genuine stall with few
     unknowns left, and only once per 32 symbols, so it can never hang the tab.
     Worth it for tail latency rather than average overhead. */
  function maybeGaussian() {
    var u = K - recovered;
    if (u === 0 || u > geLimit) return;
    if (sinceGE < 32) return;
    sinceGE = 0;

    var U = [], pos = new Map(), id;
    for (id = 0; id < K; id++) if (blocks[id] === null) { pos.set(id, U.length); U.push(id); }
    var words = Math.ceil(u / 32);

    var rows = [], seenEq = new Set();
    for (id = 0; id < K; id++) {
      var lst = blockToEqs[id];
      for (var e = 0; e < lst.length; e++) {
        var eq = lst[e];
        if (eq.dead || seenEq.has(eq)) continue;
        seenEq.add(eq);
        var coeff = new Uint32Array(words), ok = true;
        eq.unknown.forEach(function (uid) {
          var c = pos.get(uid);
          if (c === undefined) ok = false;
          else coeff[c >>> 5] |= (1 << (c & 31));
        });
        if (ok) rows.push({ coeff: coeff, data: eq.data.slice(0) });
      }
    }
    if (rows.length < u) return;

    var piv = new Array(u), c2;
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      for (var c = 0; c < u; c++) {
        if (!(row.coeff[c >>> 5] & (1 << (c & 31)))) continue;
        if (piv[c]) {
          for (var w = 0; w < words; w++) row.coeff[w] ^= piv[c].coeff[w];
          xorInto(row.data, piv[c].data);
        } else { piv[c] = row; break; }
      }
    }
    for (c = 0; c < u; c++) if (!piv[c]) return;    // rank deficient, wait for more

    for (c = u - 1; c >= 0; c--) {
      var pr = piv[c];
      for (c2 = c + 1; c2 < u; c2++) {
        if (pr.coeff[c2 >>> 5] & (1 << (c2 & 31))) xorInto(pr.data, blocks[U[c2]]);
      }
      blocks[U[c]] = pr.data;
      recovered++;
    }
  }

  function addSymbol(symbolId, payload) {
    symbolId = symbolId >>> 0;
    if (recovered >= K) { redundant++; return 'complete'; }
    if (seen.has(symbolId)) { redundant++; return 'redundant'; }
    seen.add(symbolId);
    accepted++;
    sinceGE++;

    var ids = symbolIndices(symbolId, K, sessionId, degTable);
    var data = new Uint8Array(blockSize);
    data.set(payload.subarray(0, blockSize));

    var unknown = [];
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      if (blocks[id] !== null) xorInto(data, blocks[id]);
      else unknown.push(id);
    }

    if (unknown.length === 0) { redundant++; return 'redundant'; }
    if (unknown.length === 1) {
      ripple.push([unknown[0], data]);
      processRipple();
      if (recovered < K) maybeGaussian();
      return 'progress';
    }

    while (pendingBytes + blockSize > maxPending && liveEqs > 0) evictWorst();
    var eq = { unknown: new Set(unknown), data: data, dead: false };
    pendingBytes += blockSize;
    liveEqs++;
    if (pendingBytes > peakPending) peakPending = pendingBytes;
    for (i = 0; i < unknown.length; i++) blockToEqs[unknown[i]].push(eq);
    maybeGaussian();
    return 'stored';
  }

  function addFrame(parsed) {
    if (!parsed || parsed.type !== TYPE_DATA) { rejected++; return 'reject'; }
    if (parsed.sessionId !== sessionId) { rejected++; return 'reject'; }
    if (parsed.payload.length !== blockSize) { rejected++; return 'reject'; }
    return addSymbol(parsed.symbolId, parsed.payload);
  }

  function assemble(payloadSize) {
    if (recovered < K) return null;
    var size = (payloadSize === undefined) ? K * blockSize : payloadSize;
    var out = new Uint8Array(size);
    for (var i = 0; i < K; i++) {
      var off = i * blockSize;
      if (off >= size) break;
      var take = Math.min(blockSize, size - off);
      out.set(blocks[i].subarray(0, take), off);
    }
    return out;
  }

  return {
    addFrame: addFrame,
    addSymbol: addSymbol,
    assemble: assemble,
    isComplete: function () { return recovered >= K; },
    have: function (i) { return blocks[i] !== null; },
    get recovered() { return recovered; },
    get K() { return K; },
    stats: function () {
      return { K: K, recovered: recovered, accepted: accepted, redundant: redundant,
               rejected: rejected, liveEqs: liveEqs, pendingBytes: pendingBytes,
               peakPendingBytes: peakPending,
               overhead: recovered >= K ? accepted / K : null };
    }
  };
}

/* Rebuild the original bytes from a completed decoder: trim, inflate if the
   manifest said so, and verify against the whole-file checksum. */
function finalise(decoder, manifest) {
  var payload = decoder.assemble(manifest.payloadSize);
  if (!payload) return Promise.resolve({ ok: false, reason: 'incomplete' });
  var step = manifest.compressed ? inflateRaw(payload) : Promise.resolve(payload);
  return step.then(function (bytes) {
    if (bytes.length !== manifest.originalSize) {
      return { ok: false, reason: 'size mismatch', bytes: bytes };
    }
    var crc = crc32(bytes);
    return { ok: crc === manifest.fileCrc, reason: crc === manifest.fileCrc ? null : 'checksum failed',
             bytes: bytes, crc: crc };
  }, function () {
    return { ok: false, reason: 'could not decompress' };
  });
}

global.QRTCodec = {
  PROTO_VER: PROTO_VER, TYPE_MANIFEST: TYPE_MANIFEST, TYPE_DATA: TYPE_DATA,
  HDR_DATA: HDR_DATA, MAX_K: MAX_K,
  MANIFEST_LEAD: MANIFEST_LEAD, MANIFEST_EVERY: MANIFEST_EVERY,
  A45: A45, base45Encode: base45Encode, base45Decode: base45Decode,
  crc32: crc32, mix32: mix32, rng32: rng32,
  DATA_CODEWORDS: DATA_CODEWORDS, alnumCapacity: alnumCapacity,
  bodySizeFor: bodySizeFor, blockSizeFor: blockSizeFor, wireLengthFor: wireLengthFor,
  versionForBodySize: versionForBodySize, moduleCountFor: moduleCountFor,
  PRESETS: PRESETS, presetById: presetById,
  buildDegTable: buildDegTable, sampleDegree: sampleDegree,
  pickDistinct: pickDistinct, symbolIndices: symbolIndices,
  hasCompression: hasCompression, deflateRaw: deflateRaw, inflateRaw: inflateRaw,
  prepareSource: prepareSource, planSession: planSession,
  encodeManifestFrame: encodeManifestFrame, encodeDataFrame: encodeDataFrame,
  isManifestSlot: isManifestSlot, parseFrame: parseFrame,
  xorInto: xorInto, createDecoder: createDecoder, finalise: finalise,
  utf8: utf8, fromUtf8: fromUtf8, randomU32: randomU32
};

})(typeof globalThis !== 'undefined' ? globalThis : this);
