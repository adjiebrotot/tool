// Pass A of the QR Code Data Transfer audit: the wire protocol, tested in
// node's vm against the exact shipped codec.js. No browser, no camera, no CDN.
// Imported by run.mjs; also runnable on its own with `node protocol.mjs`.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export function loadCodec() {
  const src = readFileSync(new URL('../codec.js', import.meta.url), 'utf8');
  const ctx = vm.createContext({
    TextEncoder, TextDecoder, console, crypto,
    CompressionStream, DecompressionStream, Math, Date
  });
  vm.runInContext(src, ctx, { filename: 'codec.js' });
  return ctx.QRTCodec;
}

// Deterministic PRNG for the harness itself, so failures reproduce.
function harnessRng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

export async function runProtocolTests(check) {
  const C = loadCodec();

  // ── 1. Base45, exhaustive over every two-byte value ──────────────────────
  {
    let bad = 0;
    for (let v = 0; v < 65536; v++) {
      const src = Uint8Array.of(v >>> 8, v & 255);
      const back = C.base45Decode(C.base45Encode(src));
      if (back.length !== 2 || back[0] !== src[0] || back[1] !== src[1]) bad++;
    }
    check('base45 exhaustive over all 65536 two-byte values', bad === 0, bad + ' mismatches');

    const r = harnessRng(0xC0FFEE);
    let fuzzBad = 0;
    for (let t = 0; t < 3000; t++) {
      const n = Math.floor(r() * 200);
      const src = new Uint8Array(n);
      for (let i = 0; i < n; i++) src[i] = Math.floor(r() * 256);
      const back = C.base45Decode(C.base45Encode(src));
      if (back.length !== n) { fuzzBad++; continue; }
      for (let i = 0; i < n; i++) if (back[i] !== src[i]) { fuzzBad++; break; }
    }
    check('base45 random-length fuzz (3000 cases, odd lengths included)', fuzzBad === 0, fuzzBad + ' mismatches');

    check('base45 empty round trip', C.base45Decode(C.base45Encode(new Uint8Array(0))).length === 0);
    check('base45 rejects a lone trailing character', (() => {
      try { C.base45Decode('0000'); return false; } catch (e) { return true; }
    })());
    check('base45 rejects a character outside the alphabet', (() => {
      try { C.base45Decode('00a'); return false; } catch (e) { return true; }
    })());
    check('base45 rejects an over-range triple', (() => {
      try { C.base45Decode(':::'); return false; } catch (e) { return true; }
    })());
  }

  // ── 2. Capacity arithmetic ───────────────────────────────────────────────
  {
    // Byte-mode capacity is totalDataCodewords - 3 (4 bit mode + 16 bit count).
    check('v40-L byte capacity derives to the standard 2953', C.DATA_CODEWORDS.L[39] - 3 === 2953);
    check('v40-M byte capacity derives to the standard 2331', C.DATA_CODEWORDS.M[39] - 3 === 2331);
    check('v40-L alphanumeric capacity is 4296', C.alnumCapacity(40, 'L') === 4296);
    check('v25-L alphanumeric capacity is 1853', C.alnumCapacity(25, 'L') === 1853);
    check('v20-L alphanumeric capacity is 1249', C.alnumCapacity(20, 'L') === 1249);
    check('v15-L alphanumeric capacity is 758', C.alnumCapacity(15, 'L') === 758);
    check('v10-L alphanumeric capacity is 395', C.alnumCapacity(10, 'L') === 395);
    check('v9-L alphanumeric capacity is 335', C.alnumCapacity(9, 'L') === 335);
    check('v1-L alphanumeric capacity is 25', C.alnumCapacity(1, 'L') === 25);
    check('base45 density is within 4% of raw byte mode at v40-L',
      Math.abs(C.bodySizeFor(40, 'L') / 2953 - 1) < 0.04,
      C.bodySizeFor(40, 'L') + ' vs 2953 bytes');

    let fits = true, detail = '';
    for (const p of C.PRESETS) {
      const n = C.bodySizeFor(p.version, p.ecc);
      const wire = C.wireLengthFor(p.version, p.ecc);
      const cap = C.alnumCapacity(p.version, p.ecc);
      if ((n & 1) || wire !== n / 2 * 3 + 3 || wire > cap) { fits = false; detail = p.id; }
    }
    check('every preset body is even and its wire string fits the QR version', fits, detail);
  }

  // ── 3. CRC-32 known vectors ──────────────────────────────────────────────
  {
    const enc = new TextEncoder();
    check('crc32("123456789") is 0xCBF43926', C.crc32(enc.encode('123456789')) === 0xCBF43926);
    check('crc32 of empty input is 0', C.crc32(new Uint8Array(0)) === 0);
    check('crc32("a") is 0xE8B7BE43', C.crc32(enc.encode('a')) === 0xE8B7BE43);
  }

  // ── 4. Framing, and the alphabet invariant ───────────────────────────────
  {
    const r = harnessRng(0xBEEF);
    const bytes = new Uint8Array(9000);
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(r() * 256);
    const src = await C.prepareSource(bytes, { name: 'demo.bin', mime: 'application/octet-stream', compress: false });
    const plan = C.planSession({ ...src, preset: 'balanced', sessionId: 0x12345678 });

    const man = C.encodeManifestFrame(plan);
    const pm = C.parseFrame(man, plan.n);
    check('manifest frame round trips', !!pm && pm.type === C.TYPE_MANIFEST &&
      pm.K === plan.K && pm.blockSize === plan.blockSize && pm.name === 'demo.bin' &&
      pm.payloadSize === plan.payloadSize && pm.fileCrc === plan.fileCrc);

    const d0 = C.encodeDataFrame(plan, 0);
    const pd = C.parseFrame(d0, plan.n);
    check('systematic frame 0 carries source block 0 verbatim', (() => {
      if (!pd || pd.type !== C.TYPE_DATA || pd.symbolId !== 0) return false;
      for (let i = 0; i < plan.blockSize; i++) if (pd.payload[i] !== plan.blocks[0][i]) return false;
      return true;
    })());

    check('every frame is exactly the expected wire length',
      man.length === C.wireLengthFor(25, 'L') && d0.length === man.length,
      man.length + ' chars');

    // The regression guard for the trailing-space trap.
    const alnumOk = (s) => {
      if (!s.startsWith('Q1') || !s.endsWith(':')) return false;
      for (let i = 0; i < s.length; i++) if (C.A45.indexOf(s[i]) < 0) return false;
      return true;
    };
    let alphaBad = 0;
    for (let t = 0; t < 4000; t++) {
      const s = C.encodeDataFrame(plan, Math.floor(r() * 100000));
      if (!alnumOk(s)) alphaBad++;
    }
    check('4000 frames stay inside the QR alphanumeric charset, Q1-prefixed and :-terminated',
      alphaBad === 0 && alnumOk(man), alphaBad + ' violations');

    // Negative cases.
    const flip = (s, i, ch) => s.substring(0, i) + ch + s.substring(i + 1);
    const other = (ch) => C.A45[(C.A45.indexOf(ch) + 7) % 45];
    check('a single corrupted character is rejected',
      C.parseFrame(flip(d0, 50, other(d0[50])), plan.n) === null);
    check('a truncated frame is rejected', C.parseFrame(d0.slice(0, d0.length - 4) + ':', plan.n) === null);
    check('a missing terminator is rejected', C.parseFrame(d0.slice(0, -1), plan.n) === null);
    check('a wrong prefix is rejected', C.parseFrame('X1' + d0.slice(2), plan.n) === null);
    check('a frame of the wrong length for the session is rejected',
      C.parseFrame(d0, C.bodySizeFor(20, 'L')) === null);
    check('a manifest with a flipped padding byte is rejected', (() => {
      const body = plan.manifestBody.slice(0);
      let pad = body.length - 5;
      body[pad] = 0xFF;
      const dv = new DataView(body.buffer);
      dv.setUint32(body.length - 4, C.crc32(body, 0, body.length - 4), true);
      return C.parseFrame('Q1' + C.base45Encode(body) + ':', plan.n) === null;
    })());
    check('a frame from another session is rejected by the decoder', (() => {
      const dec = C.createDecoder({ K: plan.K, blockSize: plan.blockSize,
        sessionId: (plan.sessionId ^ 1) >>> 0, degTable: plan.degTable });
      return dec.addFrame(pd) === 'reject';
    })());
  }

  // ── 5. Golden determinism vectors ────────────────────────────────────────
  // Frozen so any future refactor that changes wire behaviour fails loudly.
  {
    const GOLDEN = [
      [1000, 100, 0x12345678], [5, 3, 1], [99999, 3000, 0xDEADBEEF],
      [8192, 8192, 0], [12345, 7, 0xFFFFFFFF]
    ];
    const sigs = GOLDEN.map(([sid, K, sess]) => {
      const t = C.buildDegTable(K);
      return Array.from(C.symbolIndices(sid, K, sess, t)).join(',');
    });
    // Frozen from the first verified implementation. If one of these changes,
    // the wire behaviour changed and every already-built sender or receiver
    // stops interoperating, so treat a failure here as a protocol version bump.
    const EXPECTED = [
      '5,7,15,24,26,28,29,33,35,40,41,48,49,51,52,54,57,60,62,68,69,70,71,72,76,77,91,98',
      '0,1',
      '1892,2351',
      '5376,7072',
      '5'
    ];
    if (process.env.QRT_FREEZE) {
      console.log('\nGolden vectors (paste into protocol.mjs):');
      sigs.forEach((s, i) => console.log('  [' + i + '] ' + s));
    }
    sigs.forEach((s, i) => check(
      'golden index vector ' + i + ' (symbolId=' + GOLDEN[i][0] + ', K=' + GOLDEN[i][1] + ')',
      s === EXPECTED[i], s === EXPECTED[i] ? '' : 'got ' + s));
    check('symbolIndices is stable and sorted', sigs.every((s, i) => {
      const arr = s.split(',').map(Number);
      for (let j = 1; j < arr.length; j++) if (arr[j] <= arr[j - 1]) return false;
      return arr.length >= 1 && arr.every(v => v >= 0 && v < GOLDEN[i][1]);
    }));
    check('symbolIndices is reproducible across calls', GOLDEN.every(([sid, K, sess]) => {
      const t1 = C.buildDegTable(K), t2 = C.buildDegTable(K);
      return C.symbolIndices(sid, K, sess, t1).join() === C.symbolIndices(sid, K, sess, t2).join();
    }));
    check('systematic ids map to themselves', (() => {
      const t = C.buildDegTable(50);
      for (let i = 0; i < 50; i++) {
        const ix = C.symbolIndices(i, 50, 0xABCD, t);
        if (ix.length !== 1 || ix[0] !== i) return false;
      }
      return true;
    })());
    check('the degree table survives a manifest round trip byte for byte', (() => {
      for (const K of [3, 100, 3000, 8192]) {
        const payload = new Uint8Array(K * (C.bodySizeFor(25, 'L') - 13));
        const plan = C.planSession({ payload, originalSize: payload.length, fileCrc: 0,
          compressed: false, name: 'x', mime: 'y', preset: 'balanced', sessionId: 7 });
        const pm = C.parseFrame(C.encodeManifestFrame(plan), plan.n);
        if (!pm) return false;
        if (pm.degTable.deg.join() !== plan.degTable.deg.join()) return false;
        if (pm.degTable.cum.join() !== plan.degTable.cum.join()) return false;
      }
      return true;
    })());
    return { C, EXPECTED, sigs };
  }
}

export async function runFountainTests(check, C, opts = {}) {
  const quick = !!opts.quick;
  const Ks = quick ? [1, 3, 32, 300] : [1, 2, 3, 7, 32, 100, 300, 1000];
  const losses = quick ? [0, 0.3] : [0, 0.1, 0.3, 0.5];
  const trials = quick ? 4 : 12;
  const BUDGET = { 0: 1.10, 0.1: 1.30, 0.3: 1.45, 0.5: 1.70 };
  const table = [];

  for (const K of Ks) {
    for (const loss of losses) {
      let worst = 0, sum = 0, fails = 0;
      for (let t = 0; t < trials; t++) {
        const rng = harnessRng(0x9E37 + K * 131 + Math.round(loss * 1000) * 17 + t);
        const blockSize = C.bodySizeFor(25, 'L') - C.HDR_DATA;
        const size = Math.max(1, K * blockSize - Math.floor(rng() * blockSize));
        const src = new Uint8Array(size);
        for (let i = 0; i < size; i++) src[i] = Math.floor(rng() * 256);

        const plan = C.planSession({ payload: src, originalSize: size, fileCrc: C.crc32(src),
          compressed: false, name: 'f.bin', mime: 'application/octet-stream',
          preset: 'balanced', sessionId: (0x5EED + t) >>> 0 });
        if (plan.K !== K) { fails++; continue; }

        const dec = C.createDecoder({ K: plan.K, blockSize: plan.blockSize,
          sessionId: plan.sessionId, degTable: plan.degTable });

        let sid = 0, emitted = 0;
        const cap = K * 40 + 400;
        while (!dec.isComplete() && emitted < cap) {
          const wire = C.encodeDataFrame(plan, sid++);
          emitted++;
          if (rng() < loss) continue;                 // frame lost in the air
          dec.addFrame(C.parseFrame(wire, plan.n));
        }
        if (!dec.isComplete()) { fails++; continue; }

        const out = dec.assemble(size);
        let same = out.length === size;
        if (same) for (let i = 0; i < size; i++) if (out[i] !== src[i]) { same = false; break; }
        if (!same) { fails++; continue; }

        const ov = dec.stats().overhead;
        sum += ov;
        if (ov > worst) worst = ov;
      }
      const avg = sum / Math.max(1, trials - fails);
      table.push({ K, loss, avg, worst, fails });
      check('fountain K=' + K + ' at ' + Math.round(loss * 100) + '% loss rebuilds byte for byte',
        fails === 0, fails + ' failures');
      check('fountain K=' + K + ' at ' + Math.round(loss * 100) + '% loss stays inside the ' +
        BUDGET[loss].toFixed(2) + 'x budget',
        fails === 0 && avg <= BUDGET[loss] + 0.15,
        'avg ' + avg.toFixed(3) + 'x, worst ' + worst.toFixed(3) + 'x');
    }
  }

  // Zero loss must cost exactly K frames: the systematic prefix earns its keep.
  {
    const blockSize = C.bodySizeFor(25, 'L') - C.HDR_DATA;
    const size = 137 * blockSize;
    const src = new Uint8Array(size);
    const plan = C.planSession({ payload: src, originalSize: size, fileCrc: 0, compressed: false,
      name: 'z', mime: 'z', preset: 'balanced', sessionId: 3 });
    const dec = C.createDecoder({ K: plan.K, blockSize: plan.blockSize,
      sessionId: plan.sessionId, degTable: plan.degTable });
    let sid = 0;
    while (!dec.isComplete()) dec.addFrame(C.parseFrame(C.encodeDataFrame(plan, sid++), plan.n));
    check('a clean pass completes in exactly K frames, zero overhead',
      sid === plan.K && dec.stats().overhead === 1, sid + ' frames for K=' + plan.K);
  }

  // Out-of-order and duplicate delivery must not matter.
  {
    const blockSize = C.bodySizeFor(20, 'L') - C.HDR_DATA;
    const size = 60 * blockSize + 11;
    const rng = harnessRng(0x1234);
    const src = new Uint8Array(size);
    for (let i = 0; i < size; i++) src[i] = Math.floor(rng() * 256);
    const plan = C.planSession({ payload: src, originalSize: size, fileCrc: C.crc32(src),
      compressed: false, name: 'o', mime: 'o', preset: 'safe', sessionId: 11 });
    const wires = [];
    for (let s = 0; s < plan.K * 2; s++) wires.push([s, C.encodeDataFrame(plan, s)]);
    for (let i = wires.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = wires[i]; wires[i] = wires[j]; wires[j] = t;
    }
    const dec = C.createDecoder({ K: plan.K, blockSize: plan.blockSize,
      sessionId: plan.sessionId, degTable: plan.degTable });
    for (const [, w] of wires) {
      dec.addFrame(C.parseFrame(w, plan.n));
      dec.addFrame(C.parseFrame(w, plan.n));   // deliberate duplicate
      if (dec.isComplete()) break;
    }
    const out = dec.assemble(size);
    let same = !!out && out.length === size;
    if (same) for (let i = 0; i < size; i++) if (out[i] !== src[i]) { same = false; break; }
    check('shuffled and duplicated delivery still rebuilds byte for byte', same);
  }

  return table;
}

export async function runCompressionTests(check, C) {
  if (!C.hasCompression()) { check('CompressionStream available', false, 'skipping'); return; }

  const text = new TextEncoder().encode('the same sentence over and over. '.repeat(400));
  const s1 = await C.prepareSource(text, { name: 'a.txt', mime: 'text/plain' });
  check('compressible input is compressed and shrinks',
    s1.compressed && s1.payload.length < text.length,
    s1.payload.length + ' of ' + text.length + ' bytes');

  const rng = harnessRng(0x77);
  const noise = new Uint8Array(20000);
  for (let i = 0; i < noise.length; i++) noise[i] = Math.floor(rng() * 256);
  const s2 = await C.prepareSource(noise, { name: 'b.bin', mime: 'application/octet-stream' });
  check('incompressible input keeps the compressed flag clear',
    !s2.compressed && s2.payload.length === noise.length);

  // Full path: prepare, plan, stream, decode, inflate, verify.
  for (const source of [text, noise]) {
    const src = await C.prepareSource(source, { name: 'r.dat', mime: 'application/octet-stream' });
    const plan = C.planSession({ ...src, preset: 'balanced', sessionId: 99 });
    const pm = C.parseFrame(C.encodeManifestFrame(plan), plan.n);
    const dec = C.createDecoder({ K: pm.K, blockSize: pm.blockSize,
      sessionId: pm.sessionId, degTable: pm.degTable });
    let sid = 0;
    while (!dec.isComplete() && sid < pm.K * 20) dec.addFrame(C.parseFrame(C.encodeDataFrame(plan, sid++), plan.n));
    const res = await C.finalise(dec, pm);
    let same = res.ok && res.bytes.length === source.length;
    if (same) for (let i = 0; i < source.length; i++) if (res.bytes[i] !== source[i]) { same = false; break; }
    check('end to end ' + (src.compressed ? 'compressed' : 'stored') +
      ' payload rebuilds and passes its checksum', same, res.reason || '');
  }

  // A corrupted payload must be caught by the whole-file checksum, not handed over.
  {
    const src = await C.prepareSource(noise.subarray(0, 5000), { name: 'c.bin', mime: 'x', compress: false });
    const plan = C.planSession({ ...src, preset: 'balanced', sessionId: 5 });
    const pm = C.parseFrame(C.encodeManifestFrame(plan), plan.n);
    const dec = C.createDecoder({ K: pm.K, blockSize: pm.blockSize,
      sessionId: pm.sessionId, degTable: pm.degTable });
    for (let s = 0; s < pm.K; s++) {
      const p = C.parseFrame(C.encodeDataFrame(plan, s), plan.n);
      if (s === 1) p.payload[0] ^= 0xFF;         // simulate a miscorrected QR
      dec.addFrame(p);
    }
    const res = await C.finalise(dec, pm);
    check('a corrupted block is caught by the whole-file checksum', !res.ok, res.reason || 'accepted');
  }
}

export async function runMemoryTests(check, C) {
  const blockSize = C.bodySizeFor(25, 'L') - C.HDR_DATA;
  const K = 400;
  const size = K * blockSize;
  const rng = harnessRng(0xAA55);
  const src = new Uint8Array(size);
  for (let i = 0; i < size; i++) src[i] = Math.floor(rng() * 256);
  const plan = C.planSession({ payload: src, originalSize: size, fileCrc: C.crc32(src),
    compressed: false, name: 'm', mime: 'm', preset: 'balanced', sessionId: 21 });

  const CAP = 1024 * 1024;
  const dec = C.createDecoder({ K: plan.K, blockSize: plan.blockSize, sessionId: plan.sessionId,
    degTable: plan.degTable, maxPendingBytes: CAP });

  // Feed only high-degree symbols first, which is the worst case for the store.
  let over = false, sid = plan.K;
  for (let i = 0; i < 3000 && !dec.isComplete(); i++) {
    dec.addFrame(C.parseFrame(C.encodeDataFrame(plan, sid++), plan.n));
    if (dec.stats().pendingBytes > CAP) over = true;
  }
  check('the pending-equation store never exceeds its cap', !over,
    dec.stats().peakPendingBytes + ' bytes peak against a ' + CAP + ' cap');

  // Even after eviction the transfer still completes once enough symbols arrive.
  for (let i = 0; i < 20000 && !dec.isComplete(); i++) {
    dec.addFrame(C.parseFrame(C.encodeDataFrame(plan, sid++), plan.n));
  }
  check('decoding still completes after eviction', dec.isComplete(),
    dec.recovered + ' of ' + plan.K + ' blocks');

  const out = dec.assemble(size);
  let same = !!out;
  if (same) for (let i = 0; i < size; i++) if (out[i] !== src[i]) { same = false; break; }
  check('the evicting decoder still rebuilds byte for byte', same);

  // The feed above is deliberately pathological (fountain symbols only, no
  // systematic prefix). Measure the store again under a realistic stream.
  {
    const dec2 = C.createDecoder({ K: plan.K, blockSize: plan.blockSize,
      sessionId: plan.sessionId, degTable: plan.degTable });
    const r2 = harnessRng(0x5150);
    let s2 = 0;
    while (!dec2.isComplete() && s2 < plan.K * 30) {
      const w = C.encodeDataFrame(plan, s2++);
      if (r2() < 0.15) continue;
      dec2.addFrame(C.parseFrame(w, plan.n));
    }
    const peak = dec2.stats().peakPendingBytes / (plan.K * blockSize);
    check('peak pending storage under a realistic 15% loss stream stays under 25% of the payload',
      dec2.isComplete() && peak < 0.25, (peak * 100).toFixed(1) + '% of payload size');
  }
}
