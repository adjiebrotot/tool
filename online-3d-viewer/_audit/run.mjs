// Online 3D Viewer: end-to-end audit.
//
//   node run.mjs            fixtures (every format and variant) + page checks
//   node run.mjs --real     also real-world models (--real-only: just those): three.js's own samples
//                           (pinned to r186) and the CAx-IF / OpenCascade test
//                           parts, checked against independent readers
//   ONLY=<substring>        run only the cases whose name contains it
//
// Drives the REAL page headless (Chromium, WebGL in SwiftShader), with the
// CDN libraries served from pinned local copies (serve.mjs).
//
// Fixture cases (fixtures/cases.json, written by make-fixtures.mjs) carry
// what the viewer must report, known by construction: a 30 × 20 × 10 box has
// 12 triangles and 8 corners whatever the format. Every loaded model must
// also put pixels on screen.
//
// Real-world cases have no hand-written answer, so each is compared with a
// reader that shares no code with the viewer's engine: Assimp (assimpjs) for
// mesh and scene formats, and OpenCascade run directly in Node (not through
// the page's worker) for STEP, IGES and BREP.
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { serve, routeCdn, ensureDeps, DEPS } from './serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(HERE, 'fixtures');
const REAL_ONLY = process.argv.includes('--real-only');
const REAL = REAL_ONLY || process.argv.includes('--real');
const ONLY = process.env.ONLY || '';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'o3v-run-'));

let pass = 0, fail = 0;
const failures = [];
const check = (name, ok, detail) => {
  console.log((ok ? '  PASS  ' : '✗ FAIL  ') + name + (detail ? '  (' + detail + ')' : ''));
  if (ok) pass++; else { fail++; failures.push(name + (detail ? ' (' + detail + ')' : '')); }
};

ensureDeps();
const srv = await serve();
const PAGE = srv.url + '/online-3d-viewer/';
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

async function freshPage(viewport = { width: 1280, height: 800 }) {
  const context = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await routeCdn(page);
  await page.goto(PAGE, { waitUntil: 'load' });
  return { page, context, errors };
}

const settled = (page, n) => page.waitForFunction(k => (window.__o3v.state === 'ready' || window.__o3v.state === 'error') && window.__o3v.done === k, n, { timeout: 180000 });

// Count every finished load (ready or error), so a wait can tell one load from the next.
async function armCounter(page) {
  await page.evaluate(() => {
    window.__o3v.done = 0;
    document.addEventListener('o3v:state', e => { if (e.detail.state !== 'loading') window.__o3v.done++; });
  });
}

/* What the page shows, read from the viewer itself: the summary, plus the
   things the summary does not carry (vertex colours, normals, colours,
   textures that really loaded) and whether anything reached the screen. */
function inspect() {
  const h = window.__o3v, v = h.viewer;
  const out = { state: h.state, error: h.error, model: h.model };
  if (h.state !== 'ready' || !v || !v.model) return out;
  let vertexColors = false, normalsOk = true, texturesLoaded = 0, texturesTotal = 0;
  const colours = [];
  v.model.content.traverse(o => {
    if (!o.isMesh && !o.isPoints && !o.isLine) return;
    const g = o.geometry;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m) continue;
      if (m.vertexColors && g.getAttribute('color')) vertexColors = true;
      if (m.color && !m.userData.o3vDefault) colours.push(m.color.getHex());
      for (const k in m) { const t = m[k]; if (t && t.isTexture) { texturesTotal++; if (t.image) texturesLoaded++; } }
    }
    const n = o.isMesh && g.getAttribute('normal');
    if (n) {
      const step = Math.max(1, Math.floor(n.count / 300));
      for (let i = 0; i < n.count; i += step) {
        const l = Math.hypot(n.getX(i), n.getY(i), n.getZ(i));
        if (!(l > 0.5 && l < 1.5)) { normalsOk = false; break; }
      }
    }
  });
  // Pixels: draw the empty stage, then the model (no grid either time), and
  // count the pixels the model changed.
  const hadGrid = v.opts.grid;
  v.setGrid(false);
  const grab = () => {
    v.renderer.render(v.scene, v.camera);
    const src = v.renderer.domElement;
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const x = c.getContext('2d');
    x.drawImage(src, 0, 0);
    return x.getImageData(0, 0, c.width, c.height).data;
  };
  v.orient.visible = false;
  const empty = grab();
  v.orient.visible = true;
  const d = grab();
  let lit = 0;
  for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - empty[i]) + Math.abs(d[i + 1] - empty[i + 1]) + Math.abs(d[i + 2] - empty[i + 2]) > 30) lit++;
  v.setGrid(hadGrid);
  return Object.assign(out, { vertexColors, normalsOk, colours, texturesLoaded, texturesTotal, litShare: lit / (d.length / 4) });
}

function near(a, b, tol) { return Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)); }

function judge(name, c, r, secs, errors) {
  const e = c.expect;
  const m = r.model;
  const tag = name + ': ';
  if (errors.length) check(tag + 'no uncaught page errors', false, errors.join(' | ').slice(0, 300));
  if (e.anyOutcome) { check(tag + 'ends in a clear state', r.state === 'ready' || (r.state === 'error' && !!r.error), r.state + (r.error ? ': ' + r.error : '')); return; }
  const re = x => new RegExp(x.re || x);
  if (e.error) {
    check(tag + 'refuses with a clear message', r.state === 'error' && re(e.error).test(r.error || ''), r.state + ': ' + (r.error || ''));
    return;
  }
  if (r.state !== 'ready') { check(tag + 'opens', false, r.state + ': ' + r.error); return; }
  const s = m.stats;
  const eq = (label, got, want) => check(tag + label, JSON.stringify(got) === JSON.stringify(want), 'got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want));
  if (e.formats) eq('format', m.formats, e.formats);
  if ('up' in e) eq('up axis', m.up, e.up);
  if ('units' in e) eq('unit', m.units, e.units);
  for (const k of ['triangles', 'vertices', 'parts', 'points', 'segments', 'materials', 'textures']) if (k in e) eq(k, s[k], e[k]);
  if ('animations' in e) eq('animations', m.animations, e.animations);
  if ('minTriangles' in e) check(tag + 'triangles ≥ ' + e.minTriangles, s.triangles >= e.minTriangles, 'got ' + s.triangles);
  if ('minSegments' in e) check(tag + 'line segments ≥ ' + e.minSegments, s.segments >= e.minSegments, 'got ' + s.segments);
  if (e.size) {
    const tol = e.tol || 1e-4;
    check(tag + 'size ' + e.size.join(' × '), m.size.every((v, i) => near(v, e.size[i], tol)), 'got ' + m.size.map(v => +v.toPrecision(6)).join(' × '));
  }
  if (e.vertexColors) check(tag + 'vertex colours kept', r.vertexColors);
  if (e.normalsOk) check(tag + 'normals are unit length', r.normalsOk);
  if (e.colour) {
    const want = e.colour.map(v => Math.round(v * 255));
    const hit = r.colours.some(h => [h >> 16 & 255, h >> 8 & 255, h & 255].every((v, i) => Math.abs(v - want[i]) <= 3));
    check(tag + 'colour from the file', hit, 'colours ' + r.colours.map(h => '#' + h.toString(16).padStart(6, '0')).join(' '));
  }
  if ('textures' in e && e.textures) check(tag + 'textures decoded', r.texturesLoaded === r.texturesTotal && r.texturesTotal >= e.textures, r.texturesLoaded + ' of ' + r.texturesTotal);
  if (e.warning) check(tag + 'warns', m.warnings.some(w => re(e.warning).test(w)), JSON.stringify(m.warnings));
  if (e.noWarnings) check(tag + 'no warnings', m.warnings.length === 0, JSON.stringify(m.warnings));
  if (e.maxSeconds) check(tag + 'opens within ' + e.maxSeconds + ' s', secs <= e.maxSeconds, secs.toFixed(2) + ' s');
  check(tag + 'something is drawn', r.litShare > 0.002, (r.litShare * 100).toFixed(2) + '% of pixels');
}

async function runCase(c, filesAbs) {
  const { page, context, errors } = await freshPage();
  await armCounter(page);
  const t0 = Date.now();
  await page.setInputFiles('#fileInput', filesAbs);
  await settled(page, 1).catch(() => {});
  const secs = (Date.now() - t0) / 1000;
  const r = await page.evaluate(inspect);
  await context.close();
  return { r, secs, errors };
}

// ══════════════════════════ 1. Fixtures ══════════════════════════════════
console.log('\n── Fixtures: every format and variant ──');
const cases = JSON.parse(fs.readFileSync(path.join(FIX, 'cases.json'), 'utf8'));
{
  // A large binary STL, made here (too big to keep in the repo): 300 × 300 grid.
  const n = 300, buf = Buffer.alloc(84 + (n - 1) * (n - 1) * 2 * 50);
  buf.write('binary grid'.padEnd(80), 0, 'latin1');
  buf.writeUInt32LE((n - 1) * (n - 1) * 2, 80);
  let o = 84;
  const h = (i, j) => [i, j, 5 * Math.sin(i / 20) * Math.cos(j / 25)];
  const tri = (a, b, c2) => { o += 12; for (const p of [a, b, c2]) for (const v of p) { buf.writeFloatLE(v, o); o += 4; } o += 2; };
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) { tri(h(i, j), h(i + 1, j), h(i + 1, j + 1)); tri(h(i, j), h(i + 1, j + 1), h(i, j + 1)); }
  fs.writeFileSync(path.join(TMP, 'large-grid.stl'), buf);
  cases.push({ name: 'stl-large-grid-179k-triangles', abs: [path.join(TMP, 'large-grid.stl')], expect: { formats: ['STL'], triangles: (n - 1) * (n - 1) * 2, vertices: n * n, parts: 1, maxSeconds: 15 } });
}
const formatsSeen = new Set();
for (const c of cases) {
  if (REAL_ONLY || (ONLY && !c.name.includes(ONLY))) continue;
  const files = c.abs || c.files.map(f => path.join(FIX, f));
  const { r, secs, errors } = await runCase(c, files);
  if (r.model) r.model.formats.forEach(f => formatsSeen.add(f));
  judge(c.name, c, r, secs, errors);
}

// ══════════════════════════ 2. The page ══════════════════════════════════
if (!REAL_ONLY && (!ONLY || 'page'.includes(ONLY))) {
  console.log('\n── The page: drop, folders, toolbar, sample, phone ──');
  const fx = p => path.join(FIX, p);
  const { page, context, errors } = await freshPage();
  await armCounter(page);

  // Load the 3D core early? No: the drop screen must not need it.
  check('page: drop screen shows first, workspace hidden', await page.evaluate(() => getComputedStyle(document.getElementById('dropZone')).display !== 'none' && !document.getElementById('workspace').classList.contains('active')));

  // An error on the drop screen, then a good file clears it.
  await page.setInputFiles('#fileInput', [fx('misc/notes.txt')]);
  await settled(page, 1);
  check('page: a bad file explains itself on the drop screen', await page.evaluate(() => document.getElementById('dropError').classList.contains('visible') && /not a 3D model/.test(document.getElementById('dropError').textContent)));
  await page.setInputFiles('#fileInput', [fx('stl/box-ascii.stl')]);
  await settled(page, 2);
  check('page: a good file opens the workspace and clears the error', await page.evaluate(() => document.getElementById('workspace').classList.contains('active') && !document.getElementById('dropError').classList.contains('visible')));
  check('page: info card filled', await page.evaluate(() => document.getElementById('infoTris').textContent === '12' && document.getElementById('infoVerts').textContent === '8' && /30 × 20 × 10/.test(document.getElementById('infoSize').textContent)));
  check('page: size tip says the format has no unit', await page.evaluate(() => /no unit/.test(document.getElementById('sizeTip').getAttribute('data-tip'))));

  // Up axis: a Z-up box stands 10 tall; flipped to Y up it stands 20 tall.
  const height = () => page.evaluate(() => { const v = window.__o3v.viewer; return +(v.box.max.y - v.box.min.y).toFixed(4); });
  check('page: Z up stands the box 10 tall', (await height()) === 10, String(await height()));
  await page.click('[data-up="y"]');
  check('page: Y up stands it 20 tall', (await height()) === 20, String(await height()));
  check('page: Up buttons show the choice', await page.evaluate(() => document.querySelector('[data-up="y"]').classList.contains('active') && !document.querySelector('[data-up="z"]').classList.contains('active')));
  await page.click('[data-up="z"]');
  check('page: model sits on the grid, centred', await page.evaluate(() => { const b = window.__o3v.viewer.box; return Math.abs(b.min.y) < 1e-6 && Math.abs(b.min.x + b.max.x) < 1e-6 && Math.abs(b.min.z + b.max.z) < 1e-6; }));

  // Toggles.
  const edgeCount = () => page.evaluate(() => { let n = 0; window.__o3v.viewer.model.content.traverse(o => { if (o.userData.o3vEdge) n++; }); return n; });
  await page.click('label:has(#edgesToggle)');
  check('page: Edges on draws feature edges', (await edgeCount()) > 0);
  check('page: the box has 12 feature edges', await page.evaluate(() => { let n = 0; window.__o3v.viewer.model.content.traverse(o => { if (o.userData.o3vEdge) n += o.geometry.getAttribute('position').count / 2; }); return n === 12; }));
  await page.click('label:has(#edgesToggle)');
  check('page: Edges off removes them', (await edgeCount()) === 0);
  await page.click('label:has(#wireToggle)');
  check('page: Wireframe on', await page.evaluate(() => { let ok = true; window.__o3v.viewer.model.content.traverse(o => { if (o.isMesh) ok = ok && o.material.wireframe; }); return ok; }));
  await page.click('label:has(#wireToggle)');
  await page.click('label:has(#gridToggle)');
  check('page: Grid off', await page.evaluate(() => window.__o3v.viewer.grid === null));
  await page.click('label:has(#gridToggle)');
  check('page: Grid on again', await page.evaluate(() => !!window.__o3v.viewer.grid));

  // Reset view: turn the model, then reset puts the camera back.
  const camAt = () => page.evaluate(() => window.__o3v.viewer.camera.position.toArray().map(v => +v.toFixed(5)));
  const start = await camAt();
  const box = await page.locator('#stage canvas').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2 + 60, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const turned = await camAt();
  check('page: dragging turns the view', JSON.stringify(start) !== JSON.stringify(turned));
  await page.click('#resetViewBtn');
  check('page: ⟳ puts the view back', JSON.stringify(await camAt()) === JSON.stringify(start), JSON.stringify(await camAt()) + ' vs ' + JSON.stringify(start));

  // PNG download.
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#pngBtn')]);
  const pngPath = path.join(TMP, 'view.png');
  await dl.saveAs(pngPath);
  const png = fs.readFileSync(pngPath);
  check('page: ⬇ PNG saves a PNG named after the model', png.subarray(1, 4).toString() === 'PNG' && dl.suggestedFilename() === 'box-ascii.png', dl.suggestedFilename() + ', ' + png.length + ' bytes');
  check('page: the PNG is at least twice the screen size', png.readUInt32BE(16) >= 2 * 1200, 'width ' + png.readUInt32BE(16));

  // Theme follows the page.
  const bg = () => page.evaluate(() => window.__o3v.viewer.scene.background.userData.colours);
  const bg1 = await bg();
  await page.click('#themeToggle');
  const bg2 = await bg();
  check('page: night theme repaints the stage', bg1 !== bg2, bg1 + ' → ' + bg2);
  await page.click('#themeToggle');

  // A drop (synthetic DataTransfer, as a browser gives one) with several files.
  await page.evaluate(async () => {
    const get = async (p, n) => new File([await (await fetch('_audit/fixtures/' + p)).blob()], n);
    const dt = new DataTransfer();
    for (const [p, n] of [['obj/box.obj', 'box.obj'], ['obj/box.mtl', 'box.mtl'], ['obj/textures/checker.png', 'checker.png']]) dt.items.add(await get(p, n));
    document.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  await settled(page, 3);
  check('page: dropping OBJ + MTL + PNG together opens the textured model', await page.evaluate(() => { const m = window.__o3v.model; return window.__o3v.state === 'ready' && m.formats[0] === 'OBJ' && m.stats.textures === 1 && m.warnings.length === 0; }));

  // A folder (paths as a folder drop gives them): glTF in model/, texture in model/textures/.
  await page.evaluate(async () => {
    const get = async p => (await fetch('_audit/fixtures/' + p)).blob();
    await window.__o3v.open([
      { file: new File([await get('gltf-sep/box.gltf')], 'box.gltf'), name: 'box.gltf', path: 'Box Folder/box.gltf' },
      { file: new File([await get('gltf-sep/box.bin')], 'box.bin'), name: 'box.bin', path: 'Box Folder/box.bin' },
      { file: new File([await get('gltf-sep/textures/checker map.png')], 'checker map.png'), name: 'checker map.png', path: 'Box Folder/textures/checker map.png' },
    ]);
  });
  await settled(page, 4);
  check('page: a dropped folder resolves textures/ paths', await page.evaluate(() => window.__o3v.model.stats.textures === 1 && window.__o3v.model.warnings.length === 0));

  // A bad file while a model is open: the model stays, a note explains.
  await page.evaluate(async () => { await window.__o3v.open([{ file: new File(['garbage'], 'x.glb'), name: 'x.glb', path: 'x.glb' }]); });
  await settled(page, 5);
  check('page: a bad file over an open model keeps the model and shows the reason', await page.evaluate(() => !document.getElementById('stageNote').hidden && document.getElementById('stageNote').classList.contains('is-error') && !!window.__o3v.viewer.model));
  await page.click('#stageNoteClose');
  check('page: ✕ closes the note', await page.evaluate(() => document.getElementById('stageNote').hidden));

  // The mini cache keeps the display switches.
  await page.click('label:has(#edgesToggle)');
  await page.waitForTimeout(600);
  await page.reload({ waitUntil: 'load' });
  check('page: Edges switch remembered after a reload', await page.evaluate(() => document.getElementById('edgesToggle').checked));
  await page.evaluate(() => { document.getElementById('edgesToggle').checked = false; document.getElementById('edgesToggle').dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(600);

  // The sample button.
  await armCounter(page);
  await page.click('#sampleBtn');
  await settled(page, 1);
  check('page: Load a sample model opens the gear train', await page.evaluate(() => { const m = window.__o3v.model; return window.__o3v.state === 'ready' && m.names[0] === 'sample.glb' && m.stats.parts === 14 && m.animations === 1; }));
  check('page: the sample animates, and ▶/❚❚ pauses it', await page.evaluate(async () => {
    const v = window.__o3v.viewer, btn = document.getElementById('playBtn');
    const q0 = v.model.content.getObjectByName('Gear30T').quaternion.clone();
    await new Promise(r => setTimeout(r, 400));
    const moved = !v.model.content.getObjectByName('Gear30T').quaternion.equals(q0);
    btn.click();
    const q1 = v.model.content.getObjectByName('Gear30T').quaternion.clone();
    await new Promise(r => setTimeout(r, 300));
    return !btn.hidden && moved && !v.playing && v.model.content.getObjectByName('Gear30T').quaternion.equals(q1);
  }));
  check('page: no uncaught errors through all of it', errors.length === 0, errors.join(' | '));
  await context.close();

  // A phone: no sideways scroll, the toolbar wraps, the stage has room.
  const phone = await freshPage({ width: 390, height: 844 });
  await armCounter(phone.page);
  check('page (phone): drop screen fits the width', await phone.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await phone.page.setInputFiles('#fileInput', [fx('stl/box-ascii.stl')]);
  await settled(phone.page, 1);
  check('page (phone): workspace fits the width', await phone.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), String(await phone.page.evaluate(() => document.documentElement.scrollWidth)));
  check('page (phone): the stage keeps most of the screen', await phone.page.evaluate(() => document.getElementById('stage').getBoundingClientRect().height >= 0.5 * innerHeight), String(await phone.page.evaluate(() => document.getElementById('stage').getBoundingClientRect().height)));
  await phone.page.screenshot({ path: path.join(TMP, 'phone.png') });
  await phone.context.close();
}

// ══════════════════════════ 3. Real-world models ═════════════════════════
if (REAL) {
  console.log('\n── Real-world models, against independent readers ──');
  const req = createRequire(path.join(DEPS, 'package.json'));
  try { req.resolve('assimpjs'); } catch {
    const { execFileSync } = await import('node:child_process');
    execFileSync('npm', ['install', '--no-audit', '--no-fund', '--prefix', DEPS, 'assimpjs@0.0.10'], { stdio: 'inherit' });
  }
  // A fresh Assimp per file: a fault inside its WebAssembly leaves the instance unusable.
  const assimpFactory = req('assimpjs');
  const occt = await req('occt-import-js')();
  const CACHE = path.join(os.tmpdir(), 'o3v-real-cache');
  fs.mkdirSync(CACHE, { recursive: true });

  const THREE_MODELS = 'https://raw.githubusercontent.com/mrdoob/three.js/r186/examples/models/';
  const OCCT_TESTS = path.join(DEPS, 'node_modules/occt-import-js/test/testfiles/');
  const REAL_CASES = [
    'stl/ascii/slotted_disk.stl', 'stl/ascii/pr2_head_tilt.stl', 'stl/binary/pr2_head_pan.stl', 'stl/binary/colored.stl',
    'obj/walt/WaltHead.obj', 'obj/male02/male02.obj', 'obj/tree.obj',
    'ply/ascii/dolphins.ply', 'ply/ascii/dolphins_colored.ply', 'ply/binary/Lucy100k.ply',
    '3mf/cube_gears.3mf', '3mf/truck.3mf', '3mf/facecolors.3mf', '3mf/vertexcolors.3mf',
    'amf/rook.amf',
    'gltf/DamagedHelmet/glTF/DamagedHelmet.gltf', 'gltf/LittlestTokyo.glb', 'gltf/ferrari.glb', 'gltf/coffeemat.glb', 'gltf/Soldier.glb',
    'gltf/RobotExpressive/RobotExpressive.glb', 'gltf/Horse.glb', 'gltf/facecap.glb', 'gltf/Parrot.glb',
    'fbx/Samba Dancing.fbx', 'fbx/stanford-bunny.fbx', 'fbx/nurbs.fbx',
    'collada/elf/elf.dae', 'collada/stormtrooper/stormtrooper.dae', 'collada/abb_irb52_7_120.dae',
    '3ds/portalgun/portalgun.3ds',
    'vrml/house.wrl', 'vrml/creaseAngle.wrl', 'vrml/elevationGrid1.wrl',
    'usdz/saeukkang.usdz',
    '3dm/Rhino_Logo.3dm',
  ].map(p => ({ src: THREE_MODELS + p.split('/').map(encodeURIComponent).join('/'), name: p }));
  for (const p of ['cube-10x10mm/Cube 10x10.stp', 'cube-10x10mm/Cube 10x10.igs', 'cube-10x10mm/Cube 10x10.stl', 'cube-units/cube-in.step', 'cube-units/cube-m.step',
    'cube-units/cube-mm.step', 'rounded-cube/rounded-cube.step', 'simple-basic-cube/cube.stp', 'cax-if/as1_pe_203.stp', 'cax-if/as1-oc-214.stp',
    'cax-if/dm1-id-214.stp', 'cax-if/io1-cm-214.stp', 'cax-if/sg1-c5-214.stp', 'cax-if/s1_pe_214/s1_pe_214.stp', 'cax-if-brep/as1_pe_203.brep']) {
    if (fs.existsSync(OCCT_TESTS + p)) REAL_CASES.push({ local: OCCT_TESTS + p, name: 'occt/' + p });
  }
  // An AP214 assembly whose parts are other .stp files: no reader in a browser can follow
  // those references, so the viewer must say so by name.
  const asm = REAL_CASES.find(c => /s1_pe_214\.stp$/.test(c.name));
  if (asm) asm.expectError = /separate files \(mainbody_asm\.stp/;

  async function fetchTo(url, dest) {
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return true;
    const res = await fetch(url);
    if (!res.ok) return false;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    return true;
  }
  // The files a model names: glTF buffers and images, OBJ's MTL and MTL's maps, COLLADA images.
  function companions(file, text) {
    const ext = path.extname(file).toLowerCase();
    const out = new Set();
    if (ext === '.gltf') { const j = JSON.parse(text); for (const x of [...(j.buffers || []), ...(j.images || [])]) if (x.uri && !x.uri.startsWith('data:')) out.add(decodeURIComponent(x.uri)); }
    if (ext === '.obj') for (const m of text.matchAll(/^mtllib\s+(.+?)\s*$/gm)) out.add(m[1]);
    if (ext === '.mtl') for (const m of text.matchAll(/^\s*(?:map_\w+|bump|norm|disp)\s+(?:-\S+\s+\S+\s+)*(.+?)\s*$/gim)) out.add(m[1]);
    if (ext === '.dae') for (const m of text.matchAll(/<init_from>([^<]+)<\/init_from>/g)) if (/\.(png|jpe?g|tga|bmp|gif)$/i.test(m[1])) out.add(m[1].replace(/^file:\/\/\//, ''));
    if (ext === '.3ds') for (const m of text.matchAll(/[\w\-. ]{1,64}\.(?:png|jpe?g|tga|bmp|gif)/gi)) { out.add(m[0]); out.add('textures/' + m[0]); }
    return [...out];
  }

  for (const rc of REAL_CASES) {
    if (ONLY && !rc.name.includes(ONLY)) continue;
    const files = [];
    if (rc.local) files.push(rc.local);
    else {
      const dest = path.join(CACHE, rc.name);
      if (!(await fetchTo(rc.src, dest))) { check('real ' + rc.name + ': download', false, rc.src); continue; }
      files.push(dest);
      const queue = [dest];
      while (queue.length) {
        const f = queue.shift();
        if (!/\.(gltf|obj|mtl|dae|3ds)$/i.test(f)) continue;
        for (const ref of companions(f, fs.readFileSync(f, /\.3ds$/i.test(f) ? 'latin1' : 'utf8'))) {
          const d = path.join(path.dirname(f), ref);
          const url = new URL(ref.split('/').map(encodeURIComponent).join('/'), rc.src.slice(0, rc.src.lastIndexOf('/') + 1) + (path.relative(path.dirname(dest), path.dirname(f)) ? path.relative(path.dirname(dest), path.dirname(f)) + '/' : '')).href;
          if (!files.includes(d) && await fetchTo(url, d)) { files.push(d); queue.push(d); }
        }
      }
    }
    const { r, secs, errors } = await runCase(rc, files);
    const tag = 'real ' + rc.name + ': ';
    if (errors.length) check(tag + 'no uncaught page errors', false, errors.join(' | ').slice(0, 200));
    if (rc.expectError) { check(tag + 'refuses with a clear message', r.state === 'error' && rc.expectError.test(r.error || ''), r.error); continue; }
    if (r.state !== 'ready') { check(tag + 'opens', false, r.error); continue; }
    const s = r.model.stats;
    check(tag + 'opens and draws', r.litShare > 0.002 && (s.triangles + s.points + s.segments) > 0,
      [r.model.formats.join('+'), s.parts + ' parts', s.triangles + ' tris', s.points ? s.points + ' pts' : '', s.segments ? s.segments + ' segs' : '', r.model.units || 'no unit', secs.toFixed(1) + ' s', r.model.warnings.length ? 'warn: ' + r.model.warnings.join(' / ').slice(0, 120) : ''].filter(Boolean).join(', '));
    if (r.texturesTotal) check(tag + 'textures decoded', r.texturesLoaded === r.texturesTotal, r.texturesLoaded + ' of ' + r.texturesTotal);

    // Independent reader.
    const ext = path.extname(files[0]).toLowerCase();
    const buf = fs.readFileSync(files[0]);
    if (['.stp', '.step', '.igs', '.iges', '.brep'].includes(ext)) {
      const fn = ext === '.brep' ? occt.ReadBrepFile : /\.ig/.test(ext) ? occt.ReadIgesFile : occt.ReadStepFile;
      const res = fn(new Uint8Array(buf), ext === '.brep' ? null : { linearUnit: 'millimeter', linearDeflectionType: 'bounding_box_ratio', linearDeflection: 0.001, angularDeflection: 0.5 });
      const tris = res.meshes.reduce((a, m) => a + m.index.array.length / 3, 0);
      check(tag + 'triangles match OpenCascade run directly (' + tris + ')', s.triangles === tris, 'viewer ' + s.triangles);
      // cube-in.step is a 1 m cube written in inches (its points read 39.37): 1000 mm once converted.
      if (/cube-in/.test(rc.name)) check(tag + 'inches converted to mm (39.37 in = 1000 mm)', r.model.size.every(v => near(v, 1000, 1e-3)), r.model.size.join(' × '));
      if (/cube-m\.step/.test(rc.name)) check(tag + 'metres converted to mm', r.model.size.every(v => near(v, 1000, 1e-3)), r.model.size.join(' × '));
      if (/Cube 10x10/.test(rc.name)) check(tag + '10 mm cube', r.model.size.every(v => near(v, 10, 1e-3)), r.model.size.join(' × '));
    }
    // glTF states its own counts: each triangle primitive's index (or vertex)
    // count, once per node that places the mesh. That holds even for Draco and
    // Meshopt files, which Assimp cannot open.
    if (ext === '.gltf' || ext === '.glb') {
      const j = ext === '.glb' ? JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8')) : JSON.parse(buf.toString('utf8'));
      const uses = new Map();
      const walk = i => { const n = j.nodes[i]; if (n.mesh != null) uses.set(n.mesh, (uses.get(n.mesh) || 0) + 1); (n.children || []).forEach(walk); };
      (j.scenes[j.scene || 0].nodes || []).forEach(walk);
      let tris = 0;
      (j.meshes || []).forEach((m, i) => {
        for (const p of m.primitives) {
          if ((p.mode ?? 4) !== 4) continue;
          const n = p.indices != null ? j.accessors[p.indices].count : j.accessors[p.attributes.POSITION].count;
          tris += Math.floor(n / 3) * (uses.get(i) || 0);
        }
      });
      check(tag + 'triangles match the counts the glTF states (' + tris + ')', s.triangles === tris, 'viewer ' + s.triangles);
    }
    if (!['.3dm', '.usdz', '.wrl', '.stp', '.step', '.igs', '.iges', '.brep'].includes(ext)) {
      let j = null, why = '';
      try {
        const assimp = await assimpFactory();
        const list = new assimp.FileList();
        for (const f of files) list.AddFile(path.basename(f), fs.readFileSync(f));
        const res = assimp.ConvertFileList(list, 'assjson');
        if (!res.IsSuccess() || res.FileCount() === 0) why = res.GetErrorCode();
        else j = JSON.parse(new TextDecoder().decode(res.GetFile(0).GetContent()));
      } catch (e) { why = String(e && e.message || e); }
      if (!j) { console.log('  note  ' + tag + 'Assimp itself could not read this file (' + why + '), so there is no second reading to compare'); continue; }
      // Count each mesh once per node that places it.
      const uses = new Map();
      const walk = n => { for (const i of n.meshes || []) uses.set(i, (uses.get(i) || 0) + 1); for (const c of n.children || []) walk(c); };
      walk(j.rootnode);
      let tris = 0, lines = 0, pts = 0;
      (j.meshes || []).forEach((m, i) => {
        const k = uses.get(i) || 0;
        for (const f of m.faces || []) { if (f.length === 3) tris += k; else if (f.length === 2) lines += k; else if (f.length === 1) pts += k; else if (f.length > 3) tris += (f.length - 2) * k; }
      });
      const viewerDrawn = s.triangles;
      const ok = viewerDrawn === tris;
      check(tag + 'triangles match Assimp (' + tris + ')', ok, 'viewer ' + viewerDrawn + (ok ? '' : ', Assimp lines ' + lines + ' points ' + pts));
    }
  }
}

await browser.close();
await srv.close();
fs.rmSync(TMP, { recursive: true, force: true });
console.log('\n' + pass + ' passed, ' + fail + ' failed' + (formatsSeen.size ? '; formats opened: ' + [...formatsSeen].sort().join(', ') : ''));
if (fail) { console.log('\nFailures:\n  ' + failures.join('\n  ')); process.exit(1); }
