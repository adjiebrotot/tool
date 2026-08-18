// QR Code Data Transfer — audit harness.
//
// Pass A drives the wire protocol directly in node's vm against the exact
// shipped codec.js: Base45, CRC-32, framing, the deterministic index derivation,
// the fountain decoder under simulated loss, compression, and the memory cap.
// Pass B drives the REAL page in headless Chromium with every CDN stubbed, so it
// checks the app layer and its graceful degradation rather than the maths.
//
// Run: node run.mjs          (add QRT_ONLINE=1 to let the real CDN through and
//                             round-trip frames through a real canvas and jsQR)
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { runProtocolTests, runFountainTests, runCompressionTests, runMemoryTests } from './protocol.mjs';
import { loadQrEncoder, buildY4M, broadcastFrames } from './fakecam.mjs';
import { runResilienceTests } from './resilience.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = pathToFileURL(join(HERE, '..', 'index.html')).href;
const ONLINE = process.env.QRT_ONLINE === '1';
const QUICK = process.env.QRT_QUICK === '1';

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  console.log((ok ? '  PASS  ' : '✗ FAIL  ') + name + (detail ? '  — ' + detail : ''));
  ok ? pass++ : fail++;
};
const section = (t) => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 66 - t.length)));

// ══ PASS A ═════════════════════════════════════════════════════════════════
section('Pass A: wire protocol (node vm, no browser)');
const { C } = await runProtocolTests(check);
const overheadTable = await runFountainTests(check, C, { quick: QUICK });
await runCompressionTests(check, C);
await runMemoryTests(check, C);

console.log('\n  Measured fountain overhead (frames received / K):');
{
  let cur = null;
  for (const r of overheadTable) {
    if (r.K !== cur) { cur = r.K; process.stdout.write('\n    K=' + String(r.K).padStart(5) + '  '); }
    process.stdout.write(' ' + String(Math.round(r.loss * 100)).padStart(2) + '%: ' + r.avg.toFixed(3));
  }
  console.log('\n');
}

console.log('  Frame budget per density preset:');
for (const p of C.PRESETS) {
  const bs = C.blockSizeFor(p.version, p.ecc);
  console.log('    ' + p.label.padEnd(11) + ' v' + String(p.version).padStart(2) + '-' + p.ecc +
    '  ' + String(C.moduleCountFor(p.version)).padStart(3) + ' modules  ' +
    String(bs).padStart(4) + ' B/frame  ' + (bs * 8 / 1024).toFixed(1) + ' KB/s at 8 fps');
}

// ══ PASS B ═════════════════════════════════════════════════════════════════
section('Pass B: the real page (headless Chromium, file://)');

const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', e => { pageErrors.push(e.message); console.log('    PAGEERROR: ' + e.message); });

/* The headless browser has no route to the internet here, so when running
   online the harness fetches the pinned libraries itself and serves the real
   bytes into the page. Cached on disk so repeat runs need no network at all. */
const LIBS = {
  'qrcode-generator': 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.5.2/qrcode.min.js',
  'jsqr': 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js'
};
const libBody = {};
if (ONLINE) {
  const cacheDir = join(HERE, '.cache');
  mkdirSync(cacheDir, { recursive: true });
  for (const [key, url] of Object.entries(LIBS)) {
    const file = join(cacheDir, key + '.js');
    if (existsSync(file)) { libBody[key] = readFileSync(file, 'utf8'); continue; }
    const res = await fetch(url);
    if (!res.ok) throw new Error('could not fetch ' + url + ': HTTP ' + res.status);
    libBody[key] = await res.text();
    writeFileSync(file, libBody[key]);
    console.log('  fetched ' + key + ' (' + libBody[key].length + ' bytes) from ' + url);
  }
}

await page.route('**/*', route => {
  const url = route.request().url();
  if (url.startsWith('file://')) return route.continue();
  if (ONLINE) {
    for (const key of Object.keys(LIBS)) {
      if (url.toLowerCase().includes(key)) {
        return route.fulfill({ contentType: 'application/javascript', body: libBody[key] });
      }
    }
  }
  if (/googletagmanager|fonts\.g/i.test(url)) return route.fulfill({ contentType: 'application/javascript', body: '' });
  return route.fulfill({ contentType: 'application/javascript', body: '/* stub */' });
});

await page.goto(PAGE, { waitUntil: 'load' });
await page.waitForTimeout(400);

check('the page loads with no uncaught errors', pageErrors.length === 0, pageErrors.join(' | '));
check('the codec is exposed on the page', await page.evaluate(() => typeof window.QRTCodec === 'object'));
check('the test hook is present', await page.evaluate(() => typeof window.__QRT.runSelfTest === 'function'));

// Tabs
check('all three panes are present', await page.evaluate(() => document.querySelectorAll('.ctrl-tab').length === 3));
for (const [tab, panel] of [['recv', 'tab-recv'], ['test', 'tab-test'], ['send', 'tab-send']]) {
  await page.evaluate(t => document.querySelector('.ctrl-tab[data-tab="' + t + '"]').click(), tab);
  check('the ' + tab + ' pane opens', await page.evaluate(p => document.getElementById(p).classList.contains('active'), panel));
}

// Presets must agree with the codec, on the page as well as in node.
check('the density picker lists every preset with its real frame size', await page.evaluate(() => {
  const opts = [...document.getElementById('preset').options];
  if (opts.length !== window.QRTCodec.PRESETS.length) return false;
  return opts.every((o, i) => {
    const p = window.QRTCodec.PRESETS[i];
    return o.value === p.id && o.textContent.indexOf(window.QRTCodec.blockSizeFor(p.version, p.ecc) + ' B') >= 0;
  });
}));

// Theme
await page.evaluate(() => document.getElementById('themeToggle').click());
check('the theme toggle switches and reports the other theme', await page.evaluate(() =>
  !document.body.classList.contains('light') && document.getElementById('themeToggle').textContent.includes('Light')));
await page.evaluate(() => document.getElementById('themeToggle').click());

// Self-test: zero loss must cost exactly K frames plus the manifests.
await page.evaluate(() => document.querySelector('.ctrl-tab[data-tab="test"]').click());
const clean = await page.evaluate(() => window.__QRT.runSelfTest({ lossPct: 0, bytes: 60 * 1024 }));
check('self-test at 0% loss rebuilds byte for byte', clean.ok, clean.reason || '');
check('self-test at 0% loss costs exactly K frames, so the systematic prefix really is free',
  clean.ok && clean.overhead === 1 && clean.frames === clean.K,
  clean.frames + ' frames for K=' + clean.K + ' (' + (clean.overhead || 0).toFixed(3) + 'x)');

// Self-test: the headline case from the plan.
const lossy = await page.evaluate(() => window.__QRT.runSelfTest({ lossPct: 30, bytes: 200 * 1024 }));
check('self-test at 30% loss on 200 KB rebuilds byte for byte', lossy.ok, lossy.reason || '');
check('self-test at 30% loss stays under 1.6x overhead', lossy.ok && lossy.overhead < 1.6,
  (lossy.overhead || 0).toFixed(3) + 'x over K=' + lossy.K);
check('the checksum badge reports success', await page.evaluate(() => {
  const b = document.getElementById('resBadge');
  return !document.getElementById('resultPanel').hidden && b.classList.contains('badge-success');
}));
check('the block map is drawn at full size', await page.evaluate(() => {
  const cv = document.getElementById('blockMap');
  return !document.getElementById('progressPanel').hidden && cv.width > 0 &&
         document.getElementById('mapNote').textContent.indexOf('100%') >= 0;
}));

// A hostile loss rate still has to converge rather than hang or lie.
const brutal = await page.evaluate(() => window.__QRT.runSelfTest({ lossPct: 70, bytes: 40 * 1024 }));
check('self-test survives 70% frame loss', brutal.ok, brutal.reason || ((brutal.overhead || 0).toFixed(2) + 'x'));

// Sending: a file goes in, a plan comes out.
await page.evaluate(() => document.querySelector('.ctrl-tab[data-tab="send"]').click());
const planState = await page.evaluate(async () => {
  const bytes = new Uint8Array(50000);
  crypto.getRandomValues(bytes);                 // incompressible, so K is real
  await window.__QRT.setSourceBytes(bytes, 'audit.bin', 'application/octet-stream');
  return window.__QRT.state();
});
const expectK = Math.ceil(50000 / C.blockSizeFor(25, 'L'));
check('choosing a file builds a session plan with the right block count',
  planState.hasPlan && planState.K === expectK,
  'K=' + planState.K + ' (expected ' + expectK + '), blockSize=' + planState.blockSize);

// Compression is user-visible: it changes how long the transfer takes.
const squashed = await page.evaluate(async () => {
  const enc = new TextEncoder().encode('the same line over and over again. '.repeat(2000));
  await window.__QRT.setSourceBytes(enc, 'repetitive.txt', 'text/plain');
  const withComp = window.__QRT.state().K;
  document.getElementById('compressToggle').checked = false;
  document.getElementById('compressToggle').dispatchEvent(new Event('change'));
  await new Promise(r => setTimeout(r, 150));
  const without = window.__QRT.state().K;
  document.getElementById('compressToggle').checked = true;
  document.getElementById('compressToggle').dispatchEvent(new Event('change'));
  await new Promise(r => setTimeout(r, 150));
  return { withComp, without };
});
check('compression shrinks a repetitive file to far fewer blocks',
  squashed.withComp > 0 && squashed.withComp < squashed.without / 4,
  squashed.withComp + ' blocks compressed against ' + squashed.without + ' raw');
check('the plan uses the balanced preset body size',
  planState.n === C.bodySizeFor(25, 'L') && planState.version === 25);
check('the start button is enabled once a file is loaded',
  await page.evaluate(() => !document.getElementById('startBtn').disabled));

// Frames generated inside the page must parse in node: same codec, both sides.
const wires = await page.evaluate(() => window.__QRT.frameStrings(6));
check('frames minted in the browser parse in node', (() => {
  const n = C.bodySizeFor(25, 'L');
  const man = C.parseFrame(wires[0], n);
  if (!man || man.type !== C.TYPE_MANIFEST) return false;
  for (let i = 1; i < wires.length; i++) {
    const p = C.parseFrame(wires[i], n);
    if (!p || p.type !== C.TYPE_DATA || p.symbolId !== i - 1) return false;
  }
  return true;
})());
check('every browser-minted frame is the exact expected wire length',
  wires.every(w => w.length === C.wireLengthFor(25, 'L')), wires[0].length + ' chars');

// Oversize input must be refused, not silently truncated.
const tooBig = await page.evaluate(async () => {
  await window.__QRT.setSourceBytes(new Uint8Array(11 * 1024 * 1024), 'huge.bin', 'application/octet-stream');
  return window.__QRT.state();
});
check('a file past the size limit is refused with a readable reason',
  /limit/i.test(tooBig.warning), tooBig.warning.slice(0, 80));

// Graceful degradation, which is the whole point of running this offline.
if (!ONLINE) {
  await page.evaluate(async () => {
    const bytes = new Uint8Array(2000);
    await window.__QRT.setSourceBytes(bytes, 'x.bin', 'application/octet-stream');
    window.__QRT.startBroadcast();
  });
  await page.waitForTimeout(1200);
  const degraded = await page.evaluate(() => window.__QRT.state());
  check('with no QR encoder reachable the sender warns instead of throwing',
    /encoder|unavailable/i.test(degraded.warning), degraded.warning.slice(0, 90));
  check('no uncaught error escaped while the encoder was missing', pageErrors.length === 0, pageErrors.join(' | '));

  await page.evaluate(() => {
    document.querySelector('.ctrl-tab[data-tab="recv"]').click();
    document.getElementById('camBtn').click();
  });
  await page.waitForTimeout(600);
  const cam = await page.evaluate(() => window.__QRT.state());
  // Offline under file:// the decoder libraries cannot load. Whatever the reason,
  // the receiver has to say so in words rather than throw or sit there silently.
  check('the receiver reports why it cannot start instead of throwing',
    /https|secure|camera|decoder|connection/i.test(cam.warning), cam.warning.slice(0, 90));
  check('no uncaught error escaped from the receiver either', pageErrors.length === 0, pageErrors.join(' | '));
}

// Optional: prove the optics with the real libraries and a real canvas.
if (ONLINE) {
  section('Pass B+: real QR images through a real decoder');
  const rt = await page.evaluate(async () => {
    const load = (src) => new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    await load('https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.5.2/qrcode.min.js');
    await load('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js');
    const C = window.QRTCodec;
    const out = [];
    for (const preset of ['compatible', 'safe', 'balanced', 'dense', 'max']) {
      const p = C.presetById(preset);
      const bs = C.blockSizeFor(p.version, p.ecc);
      const payload = new Uint8Array(bs * 3);
      for (let i = 0; i < payload.length; i++) payload[i] = (i * 31 + 7) & 255;
      const plan = C.planSession({ payload, originalSize: payload.length, fileCrc: C.crc32(payload),
        compressed: false, name: 't.bin', mime: 'application/octet-stream', preset });
      const wire = C.encodeDataFrame(plan, 1);
      const qr = qrcode(p.version, p.ecc);
      qr.addData(wire, 'Alphanumeric');
      qr.make();
      const n = qr.getModuleCount(), q = 6, px = 3, tot = (n + q * 2) * px;
      const cv = document.createElement('canvas'); cv.width = cv.height = tot;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, tot, tot);
      ctx.fillStyle = '#000';
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
        if (qr.isDark(r, c)) ctx.fillRect((c + q) * px, (r + q) * px, px, px);
      const img = ctx.getImageData(0, 0, tot, tot);
      const res = jsQR(img.data, tot, tot, { inversionAttempts: 'dontInvert' });
      const parsed = res ? C.parseFrame(res.data, plan.n) : null;
      out.push({ preset, modules: n, decoded: !!res, exact: res ? res.data === wire : false,
                 parsed: !!parsed && parsed.symbolId === 1 });
    }
    return out;
  });
  for (const r of rt) {
    check('a real ' + r.preset + ' code (' + r.modules + ' modules) survives encode, render, and jsQR decode',
      r.decoded && r.exact && r.parsed,
      r.decoded ? (r.exact ? 'parsed=' + r.parsed : 'string differed') : 'not detected');
  }

  // The sender's own canvas, as drawn by the worker pool and the packed-bit blit.
  // Everything above tested the codec; this tests what a camera would actually see.
  await page.evaluate(async () => {
    document.querySelector('.ctrl-tab[data-tab="send"]').click();
    const bytes = new Uint8Array(6000);
    crypto.getRandomValues(bytes);
    document.getElementById('preset').value = 'safe';
    document.getElementById('preset').dispatchEvent(new Event('change'));
    await window.__QRT.setSourceBytes(bytes, 'render.bin', 'application/octet-stream');
    window.__QRT.startBroadcast();
  });
  await page.waitForTimeout(2500);

  const painted = await page.evaluate(() => {
    const st = window.__QRT.state();
    const cv = document.getElementById('qrCanvas');
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const img = ctx.getImageData(0, 0, cv.width, cv.height);
    const res = jsQR(img.data, cv.width, cv.height, { inversionAttempts: 'dontInvert' });
    const parsed = res ? window.QRTCodec.parseFrame(res.data, st.n) : null;
    let min = 255, max = 0;
    for (let i = 0; i < img.data.length; i += 4) { if (img.data[i] < min) min = img.data[i]; if (img.data[i] > max) max = img.data[i]; }
    return { broadcasting: st.broadcasting, framesShown: st.framesShown, size: cv.width,
             decoded: !!res, parsedType: parsed ? parsed.type : null,
             symbolId: parsed && parsed.type === 2 ? parsed.symbolId : null,
             contrast: [min, max], warning: st.warning };
  });

  check('the sender actually animates through frames', painted.framesShown > 5,
    painted.framesShown + ' frames drawn' + (painted.warning ? ' | ' + painted.warning : ''));
  check('the code painted on the sender canvas is pure black on pure white',
    painted.contrast[0] === 0 && painted.contrast[1] === 255, painted.contrast.join('..'));
  check('a camera reading the sender canvas gets a valid frame back',
    painted.decoded && painted.parsedType !== null,
    painted.decoded ? 'type ' + painted.parsedType + ', symbolId ' + painted.symbolId : 'nothing detected');
  await page.evaluate(() => window.__QRT.stopBroadcast());
}

// ══ PASS C ═════════════════════════════════════════════════════════════════
// The receiver, end to end, against a fake camera playing a real broadcast.
if (ONLINE) {
  section('Pass C: the receiver against a fake camera');

  const qrcode = loadQrEncoder(libBody['qrcode-generator']);
  const payload = new Uint8Array(5000);
  for (let i = 0; i < payload.length; i++) payload[i] = (i * 97 + 41) & 255;
  const src = await C.prepareSource(payload, { name: 'fakecam.bin', mime: 'application/octet-stream', compress: false });
  const camPlan = C.planSession({ ...src, preset: 'safe', sessionId: 0x0FACE01 });

  // Enough frames that a receiver joining at any point still finishes in one loop.
  const frames = broadcastFrames(C, camPlan, camPlan.K * 3 + 8);
  const y4m = join(HERE, '.cache', 'broadcast.y4m');
  const built = buildY4M(y4m, { qrcode, C, plan: camPlan, frames, hold: 3 });
  console.log('  built a ' + built.frameCount + ' frame clip (' + frames.length + ' codes, K=' +
    camPlan.K + ', v' + camPlan.version + ') at ' + (built.bytes / 1048576).toFixed(1) + ' MB');

  const camBrowser = await chromium.launch({ args: [
    '--allow-file-access-from-files',
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--use-file-for-fake-video-capture=' + y4m
  ] });
  const camPage = await camBrowser.newPage();
  const camErrors = [];
  camPage.on('pageerror', e => { camErrors.push(e.message); console.log('    PAGEERROR: ' + e.message); });
  await camPage.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith('file://')) return route.continue();
    for (const key of Object.keys(LIBS)) {
      if (url.toLowerCase().includes(key)) return route.fulfill({ contentType: 'application/javascript', body: libBody[key] });
    }
    if (/googletagmanager|fonts\.g/i.test(url)) return route.fulfill({ contentType: 'application/javascript', body: '' });
    return route.fulfill({ contentType: 'application/javascript', body: '/* stub */' });
  });
  await camPage.goto(PAGE, { waitUntil: 'load' });
  await camPage.waitForTimeout(300);

  await camPage.evaluate(() => {
    document.querySelector('.ctrl-tab[data-tab="recv"]').click();
    document.getElementById('decSel').value = 'jsqr';       // deterministic path
    document.getElementById('resSel').value = '1280';
    document.getElementById('camBtn').click();
  });

  // Poll until the transfer completes or we run out of patience.
  let done = null;
  for (let i = 0; i < 100; i++) {
    await camPage.waitForTimeout(600);
    done = await camPage.evaluate(() => {
      const r = document.getElementById('resultPanel');
      const map = document.getElementById('mapNote').textContent;
      return { finished: !r.hidden, map: map, badge: document.getElementById('resBadge').textContent,
               name: document.getElementById('resName').textContent,
               sub: document.getElementById('resSub').textContent,
               warning: window.__QRT.state().warning };
    });
    if (done.finished) break;
  }

  check('the fake camera stream is decoded to completion', !!done && done.finished,
    done ? ('stalled at ' + done.map + (done.warning ? ' | ' + done.warning : '')) : 'no state');
  check('the rebuilt file passes its checksum', !!done && done.finished && /OK/i.test(done.badge),
    done && done.badge);
  check('the rebuilt file carries the sender filename', !!done && done.name === 'fakecam.bin', done && done.name);
  check('the block map reached 100%', !!done && /100%/.test(done.map), done && done.map);
  check('no uncaught error during live capture', camErrors.length === 0, camErrors.join(' | '));

  // The download button must hand over the exact original bytes.
  if (done && done.finished) {
    const dl = await camPage.evaluate(() => new Promise(resolve => {
      const orig = URL.createObjectURL;
      URL.createObjectURL = function (blob) {
        blob.arrayBuffer().then(b => {
          const u = new Uint8Array(b);
          let sum = 0;
          for (let i = 0; i < u.length; i++) sum = (sum + u[i] * (i % 7 + 1)) >>> 0;
          resolve({ length: u.length, sum, first: u[0], last: u[u.length - 1] });
        });
        return orig.call(URL, blob);
      };
      document.getElementById('dlBtn').click();
    }));
    let sum = 0;
    for (let i = 0; i < payload.length; i++) sum = (sum + payload[i] * (i % 7 + 1)) >>> 0;
    check('the downloaded blob is byte for byte the original payload',
      dl.length === payload.length && dl.sum === sum,
      dl.length + ' bytes, checksum ' + (dl.sum === sum ? 'matches' : 'differs'));
  }

  await camBrowser.close();
}

// ══ PASS D ═════════════════════════════════════════════════════════════════
// Frame loss, on purpose, through the real optical path.
if (ONLINE) {
  section('Pass D: surviving destroyed frames');
  await runResilienceTests(check, {
    C, chromium, PAGE, libBody, cacheDir: join(HERE, '.cache'), join,
    log: (m) => console.log(m)
  });
}

await browser.close();

section('Result');
console.log('  ' + pass + ' passed, ' + fail + ' failed');
if (!ONLINE) console.log('  (run with QRT_ONLINE=1 to also test real QR images end to end)');
process.exit(fail ? 1 : 0);
