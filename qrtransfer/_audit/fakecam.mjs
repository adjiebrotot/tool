// Builds a raw Y4M clip of a real QR broadcast, so Chromium's fake camera can
// play it into getUserMedia. This is the only way to exercise the whole receiver
// pipeline headlessly: camera -> video -> ROI crop -> jsQR worker -> fountain
// decoder -> checksum -> download.
import vm from 'node:vm';
import { writeFileSync } from 'node:fs';

const W = 640, H = 480;

export function loadQrEncoder(libSrc) {
  const ctx = vm.createContext({ module: { exports: {} }, exports: {}, console });
  vm.runInContext(libSrc, ctx, { filename: 'qrcode.min.js' });
  const qr = ctx.module.exports || ctx.qrcode;
  if (typeof qr !== 'function') throw new Error('qrcode-generator did not export a function');
  return qr;
}

function renderY(qrcode, str, version, ecc, quiet) {
  const qr = qrcode(version, ecc);
  qr.addData(str, 'Alphanumeric');
  qr.make();
  const n = qr.getModuleCount();
  const tot = n + quiet * 2;
  const scale = Math.floor(Math.min(W, H) * 0.94 / tot);
  const side = tot * scale;
  const ox = ((W - side) >> 1), oy = ((H - side) >> 1);

  const y = new Uint8Array(W * H);
  y.fill(160);                                  // mid grey surround, like a desk
  for (let r = 0; r < tot; r++) {
    for (let c = 0; c < tot; c++) {
      const inQuiet = r < quiet || c < quiet || r >= quiet + n || c >= quiet + n;
      const dark = inQuiet ? false : qr.isDark(r - quiet, c - quiet);
      const v = dark ? 16 : 235;                // studio-swing black and white
      for (let dy = 0; dy < scale; dy++) {
        const row = (oy + r * scale + dy) * W + ox + c * scale;
        y.fill(v, row, row + scale);
      }
    }
  }
  return y;
}

/* Writes a Y4M whose frames are the sender's own output. Each code is held for
   `hold` video frames, which is what a real sender at 30/hold fps looks like. */
export function buildY4M(path, { qrcode, C, plan, frames, hold = 3, quiet = 6 }) {
  const header = Buffer.from('YUV4MPEG2 W' + W + ' H' + H + ' F30:1 Ip A1:1 C420mpeg2\n', 'ascii');
  const chroma = new Uint8Array((W >> 1) * (H >> 1)).fill(128);
  const parts = [header];
  for (const str of frames) {
    const y = renderY(qrcode, str, plan.version, plan.ecc, quiet);
    for (let k = 0; k < hold; k++) {
      parts.push(Buffer.from('FRAME\n', 'ascii'), Buffer.from(y), Buffer.from(chroma), Buffer.from(chroma));
    }
  }
  const buf = Buffer.concat(parts);
  writeFileSync(path, buf);
  return { path, bytes: buf.length, frameCount: frames.length * hold };
}

/* The frame sequence a receiver would actually see: manifests interleaved on the
   real schedule, systematic blocks, then fountain repair symbols. */
export function broadcastFrames(C, plan, count) {
  const out = [];
  let emission = 0, symbolId = 0;
  const manifest = C.encodeManifestFrame(plan);
  while (out.length < count) {
    if (C.isManifestSlot(emission)) out.push(manifest);
    else out.push(C.encodeDataFrame(plan, symbolId++));
    emission++;
  }
  return out;
}
