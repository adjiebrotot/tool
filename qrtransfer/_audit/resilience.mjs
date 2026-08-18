// Resilience pass: does the transfer actually survive real frame loss, and does
// it refuse to hand over data that is not byte-identical?
//
// Everything here goes through the real optical path: real qrcode-generator
// output, rendered to real video frames, played into Chromium's fake camera,
// read back by the real jsQR worker. Frames are destroyed on purpose.
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

function modules(qrcode, str, version, ecc) {
  const qr = qrcode(version, ecc);
  qr.addData(str, 'Alphanumeric');
  qr.make();
  return qr;
}

/* Paint a QR into a luma plane. `topFraction` paints only the top part of the
   code, which is how a torn frame is built: top half of one code, bottom half of
   another, exactly what a camera catches mid-refresh. */
function paint(y, qr, quiet, fromFraction, toFraction) {
  const n = qr.getModuleCount();
  const tot = n + quiet * 2;
  const scale = Math.floor(Math.min(W, H) * 0.94 / tot);
  const side = tot * scale;
  const ox = ((W - side) >> 1), oy = ((H - side) >> 1);
  const r0 = Math.floor(tot * fromFraction), r1 = Math.floor(tot * toFraction);
  for (let r = r0; r < r1; r++) {
    for (let c = 0; c < tot; c++) {
      const inQuiet = r < quiet || c < quiet || r >= quiet + n || c >= quiet + n;
      const dark = inQuiet ? false : qr.isDark(r - quiet, c - quiet);
      const v = dark ? 16 : 235;
      for (let dy = 0; dy < scale; dy++) {
        const row = (oy + r * scale + dy) * W + ox + c * scale;
        y.fill(v, row, row + scale);
      }
    }
  }
}

function blankFrame() { const y = new Uint8Array(W * H); y.fill(160); return y; }

/* An obstruction: something opaque across the middle of the code, the way a hand
   or a reflection blocks a screen. Guaranteed undecodable. */
function occludedFrame(qr, quiet) {
  const y = blankFrame();
  paint(y, qr, quiet, 0, 1);
  const top = Math.floor(H * 0.28), bot = Math.floor(H * 0.72);
  for (let r = top; r < bot; r++) y.fill(40, r * W, r * W + W);
  return y;
}

function tornFrame(qrA, qrB, quiet) {
  const y = blankFrame();
  paint(y, qrA, quiet, 0, 0.5);      // top half of one code
  paint(y, qrB, quiet, 0.5, 1);      // bottom half of the next
  return y;
}

function cleanFrame(qr, quiet) { const y = blankFrame(); paint(y, qr, quiet, 0, 1); return y; }

/* Build the clip and report exactly what was destroyed, so the test can state
   the damage rather than assume it. */
export function buildDamagedClip(path, { qrcode, plan, wires, hold = 3, quiet = 6, plan: _p, damage }) {
  const header = Buffer.from('YUV4MPEG2 W' + W + ' H' + H + ' F30:1 Ip A1:1 C420mpeg2\n', 'ascii');
  const chroma = new Uint8Array((W >> 1) * (H >> 1)).fill(128);
  const parts = [header];
  const stats = { total: wires.length, clean: 0, occluded: 0, torn: 0, blank: 0 };

  const codes = wires.map(w => modules(qrcode, w, plan.version, plan.ecc));

  for (let i = 0; i < wires.length; i++) {
    const kind = damage(i, wires[i]);
    let y;
    if (kind === 'blank') { y = blankFrame(); stats.blank++; }
    else if (kind === 'occlude') { y = occludedFrame(codes[i], quiet); stats.occluded++; }
    else if (kind === 'tear') { y = tornFrame(codes[i], codes[(i + 1) % codes.length], quiet); stats.torn++; }
    else { y = cleanFrame(codes[i], quiet); stats.clean++; }
    for (let k = 0; k < hold; k++) {
      parts.push(Buffer.from('FRAME\n', 'ascii'), Buffer.from(y), Buffer.from(chroma), Buffer.from(chroma));
    }
  }
  const buf = Buffer.concat(parts);
  writeFileSync(path, buf);
  stats.bytes = buf.length;
  stats.videoFrames = wires.length * hold;
  return stats;
}

/* The emission schedule the sender really uses, with each wire tagged so a test
   can target a specific symbol for destruction. */
export function schedule(C, plan, count) {
  const out = [];
  let emission = 0, symbolId = 0;
  const manifest = C.encodeManifestFrame(plan);
  while (out.length < count) {
    if (C.isManifestSlot(emission)) out.push({ wire: manifest, kind: 'manifest', symbolId: null });
    else { out.push({ wire: C.encodeDataFrame(plan, symbolId), kind: 'data', symbolId: symbolId }); symbolId++; }
    emission++;
  }
  return out;
}

// ── the actual tests ────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function openReceiver(chromium, PAGE, libBody, y4mPath) {
  const browser = await chromium.launch({ args: [
    '--allow-file-access-from-files',
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--use-file-for-fake-video-capture=' + y4mPath
  ] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith('file://')) return route.continue();
    for (const key of Object.keys(libBody)) {
      if (url.toLowerCase().includes(key)) return route.fulfill({ contentType: 'application/javascript', body: libBody[key] });
    }
    return route.fulfill({ contentType: 'application/javascript', body: '/* stub */' });
  });
  await page.goto(PAGE, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    document.querySelector('.ctrl-tab[data-tab="recv"]').click();
    document.getElementById('decSel').value = 'jsqr';
    document.getElementById('camBtn').click();
  });
  return { browser, page, errors };
}

async function waitForResult(page, seconds) {
  let last = null;
  for (let i = 0; i < seconds * 2; i++) {
    await sleep(500);
    last = await page.evaluate(() => ({
      done: !document.getElementById('resultPanel').hidden,
      map: document.getElementById('mapNote').textContent,
      badge: document.getElementById('resBadge').textContent,
      name: document.getElementById('resName').textContent,
      sub: document.getElementById('resSub').textContent,
      warning: window.__QRT.state().warning
    }));
    if (last.done) break;
  }
  return last;
}

/* Intercept the blob the download button hands over and compare it, byte for
   byte, against what the sender started with. Nothing else counts as proof. */
async function verifyDownload(page, expected) {
  await page.evaluate(exp => { window.__expected = Uint8Array.from(exp); }, Array.from(expected));
  return page.evaluate(() => new Promise(resolve => {
    const orig = URL.createObjectURL;
    URL.createObjectURL = function (blob) {
      blob.arrayBuffer().then(buf => {
        const got = new Uint8Array(buf), want = window.__expected;
        let firstDiff = -1;
        if (got.length === want.length) {
          for (let i = 0; i < want.length; i++) if (got[i] !== want[i]) { firstDiff = i; break; }
        }
        resolve({ length: got.length, expected: want.length,
                  identical: got.length === want.length && firstDiff === -1, firstDiff });
      });
      return orig.call(URL, blob);
    };
    document.getElementById('dlBtn').click();
  }));
}

export async function runResilienceTests(check, { C, chromium, PAGE, libBody, cacheDir, join, log }) {
  const qrcode = loadQrEncoder(libBody['qrcode-generator']);

  // ── R1: heavy, realistic damage ──────────────────────────────────────────
  {
    const payload = new Uint8Array(7000);
    for (let i = 0; i < payload.length; i++) payload[i] = (i * 181 + 23) & 0xFF;
    const src = await C.prepareSource(payload, { name: 'damaged.bin', mime: 'application/octet-stream', compress: false });
    const plan = C.planSession({ ...src, preset: 'safe', sessionId: 0x0BADCAFE >>> 0 });
    const sched = schedule(C, plan, plan.K * 6 + 10);

    // Deterministic damage: a blind opening, then roughly 40% destroyed, with
    // every eighth survivor torn across two codes.
    let rs = 12345;
    const rnd = () => { rs = (rs * 1103515245 + 12345) & 0x7FFFFFFF; return rs / 0x80000000; };
    let torn = 0;
    const damage = (i) => {
      if (i < 5) return 'blank';                 // receiver sees nothing at first
      const r = rnd();
      if (r < 0.40) return 'occlude';
      if (r < 0.47 && torn++ < 6) return 'tear';
      return 'clean';
    };

    const y4m = join(cacheDir, 'resilience-r1.y4m');
    const stats = buildDamagedClip(y4m, { qrcode, plan, wires: sched.map(s => s.wire), hold: 3, damage });
    const destroyed = stats.occluded + stats.torn + stats.blank;
    log('  R1 clip: ' + stats.total + ' codes, ' + stats.clean + ' clean, ' +
        stats.occluded + ' blocked, ' + stats.torn + ' torn, ' + stats.blank + ' blank ' +
        '(' + Math.round(destroyed / stats.total * 100) + '% unreadable), K=' + plan.K);

    const { browser, page, errors } = await openReceiver(chromium, PAGE, libBody, y4m);
    const res = await waitForResult(page, 75);
    check('R1: transfer completes with ' + Math.round(destroyed / stats.total * 100) +
      '% of codes unreadable', !!res && res.done,
      res ? 'stalled at ' + res.map + (res.warning ? ' | ' + res.warning : '') : 'no state');
    check('R1: every block is recovered', !!res && /100%/.test(res.map), res && res.map);
    check('R1: the checksum passes', !!res && res.done && /OK/i.test(res.badge), res && res.badge);
    if (res && res.done) {
      const dl = await verifyDownload(page, payload);
      check('R1: the delivered file is byte for byte identical to the sender file',
        dl.identical, dl.identical ? dl.length + ' bytes' :
          'length ' + dl.length + ' vs ' + dl.expected + ', first difference at ' + dl.firstDiff);
      log('  R1 result: ' + res.sub);
    }
    check('R1: no uncaught error while frames were being destroyed', errors.length === 0, errors.join(' | '));
    await browser.close();
  }

  // ── R2: a specific block is never transmitted intact ─────────────────────
  // This is the claim under test: a frame the receiver never sees does not
  // matter, because repair frames rebuild that block from combinations.
  {
    const payload = new Uint8Array(4000);
    for (let i = 0; i < payload.length; i++) payload[i] = (i * 61 + 7) & 0xFF;
    const src = await C.prepareSource(payload, { name: 'missing-block.bin', mime: 'application/octet-stream', compress: false });
    const plan = C.planSession({ ...src, preset: 'compatible', sessionId: 0x51D3 });
    const sched = schedule(C, plan, plan.K * 8 + 12);

    // Destroy every frame carrying a plain copy of blocks 1 and 3, forever.
    const doomed = new Set([1, 3]);
    const damage = (i) => (sched[i].kind === 'data' && doomed.has(sched[i].symbolId)) ? 'occlude' : 'clean';

    const y4m = join(cacheDir, 'resilience-r2.y4m');
    const stats = buildDamagedClip(y4m, { qrcode, plan, wires: sched.map(s => s.wire), hold: 3, damage });
    log('  R2 clip: K=' + plan.K + ', plain copies of blocks ' + [...doomed].join(' and ') +
        ' are blocked in every pass (' + stats.occluded + ' codes destroyed)');

    const { browser, page, errors } = await openReceiver(chromium, PAGE, libBody, y4m);
    const res = await waitForResult(page, 75);
    check('R2: blocks never sent in the clear are still rebuilt from repair frames',
      !!res && res.done && /100%/.test(res.map),
      res ? res.map + (res.warning ? ' | ' + res.warning : '') : 'no state');
    if (res && res.done) {
      const dl = await verifyDownload(page, payload);
      check('R2: the delivered file is byte for byte identical despite the missing blocks',
        dl.identical, dl.identical ? dl.length + ' bytes' : 'first difference at ' + dl.firstDiff);
      log('  R2 result: ' + res.sub);
    }
    check('R2: no uncaught error', errors.length === 0, errors.join(' | '));
    await browser.close();
  }

  // ── R3: the failsafe must refuse data that is not identical ──────────────
  // Every QR here is perfectly formed and passes its own per-frame checksum, but
  // the blocks carry the wrong bytes, which is what a miscorrected code looks
  // like from the receiver's side. The whole-file checksum is the last gate and
  // it has to hold: no download, ever.
  {
    const payload = new Uint8Array(3000);
    for (let i = 0; i < payload.length; i++) payload[i] = (i * 29 + 11) & 0xFF;
    const corrupt = payload.slice(0);
    for (let i = 1500; i < 1520; i++) corrupt[i] ^= 0xFF;      // 20 bytes wrong

    const sessionId = 0xDEFEC7 >>> 0;
    const honest = await C.prepareSource(payload, { name: 'honest.bin', mime: 'application/octet-stream', compress: false });
    const liar = await C.prepareSource(corrupt, { name: 'honest.bin', mime: 'application/octet-stream', compress: false });
    const planTruth = C.planSession({ ...honest, preset: 'compatible', sessionId });
    const planLie = C.planSession({ ...liar, preset: 'compatible', sessionId });
    if (planTruth.K !== planLie.K || planTruth.blockSize !== planLie.blockSize) {
      throw new Error('resilience R3 setup: the two plans must be the same shape');
    }

    // Manifest describes the real file. The data frames carry the corrupted one.
    const wires = [];
    let emission = 0, symbolId = 0;
    const manifest = C.encodeManifestFrame(planTruth);
    while (wires.length < planTruth.K * 5 + 8) {
      if (C.isManifestSlot(emission)) wires.push(manifest);
      else wires.push(C.encodeDataFrame(planLie, symbolId++));
      emission++;
    }

    const y4m = join(cacheDir, 'resilience-r3.y4m');
    buildDamagedClip(y4m, { qrcode, plan: planTruth, wires, hold: 3, damage: () => 'clean' });
    log('  R3 clip: every code is clean and valid, but 20 payload bytes are wrong ' +
        'and the manifest checksum describes the original');

    const { browser, page, errors } = await openReceiver(chromium, PAGE, libBody, y4m);
    // Give it well past the time a good stream of this size needs.
    let state = null;
    for (let i = 0; i < 60; i++) {
      await sleep(500);
      state = await page.evaluate(() => ({
        offered: !document.getElementById('resultPanel').hidden,
        map: document.getElementById('mapNote').textContent,
        warning: window.__QRT.state().warning
      }));
      if (state.offered) break;
    }
    check('R3: corrupted data is never offered for download', !state.offered,
      state.offered ? 'a file was offered despite the checksum failing' : 'no download offered');
    check('R3: the receiver says the checksum failed rather than staying silent',
      /checksum/i.test(state.warning || ''), state.warning || '(no message shown)');
    check('R3: the receiver keeps trying instead of giving up',
      /of/.test(state.map || ''), 'progress shown: ' + state.map);
    check('R3: no uncaught error', errors.length === 0, errors.join(' | '));
    log('  R3 message: ' + (state.warning || '(none)'));
    await browser.close();
  }
}
