// UI tests for the PowerFactory Workflow Builder page (wave 1, "ui").
//
// Run from the repo root:   node powerfactory-scripter/builder/_audit/ui/run.mjs
// Needs Playwright for Node at D:\opt\node22\lib\node_modules\playwright (Chromium installed).
// Serves the repo statically on a free port, answers every off-site request offline (scripts
// and stylesheets with an empty body, the rest aborted), as the repo's own checks do.
//
// Pass 1 (deterministic): the category files are intercepted with page.route(): js/blocks/
//   start.js is answered with _audit/ui/fixture-blocks.js (one block of every kind and setting
//   kind) and every other category file with an empty module, so the editor is tested against
//   blocks that do not change while the real ones are being written. 1440x900 and 375x812.
// Pass 2 (smoke): the real block files, the built-in tour demo, the tour, phone width.
// Every page is watched for console errors and page errors.
//
// Prints "ui tests: N passed, M failed" and exits 1 on any failure. PFB_UI_ONLY=<text> runs only
// the tests whose name contains that text; PFB_UI_SHOTS=1 keeps screenshots in the temp folder.

import pw from 'file:///D:/opt/node22/lib/node_modules/playwright/index.js';
import { createServer } from 'node:http';
import { existsSync, statSync, createReadStream, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, normalize, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..', '..');          // D:\Repository\tool
const PAGE_PATH = '/powerfactory-scripter/builder/';
const FIXTURE = readFileSync(join(HERE, 'fixture-blocks.js'), 'utf8');
const CATEGORY_FILES = ['start', 'flow', 'values', 'model', 'study', 'check', 'result', 'search', 'advanced'];
const ONLY = process.env.PFB_UI_ONLY || '';
const TMP = mkdtempSync(join(os.tmpdir(), 'pfb-ui-'));

// ---------------------------------------------------------------------------------------------
// Static server

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.py': 'text/plain', '.txt': 'text/plain',
  '.webmanifest': 'application/manifest+json', '.xml': 'application/xml' };
const server = createServer((req, res) => {
  const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  let file = join(ROOT, rel);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const URL = ORIGIN + PAGE_PATH;

// ---------------------------------------------------------------------------------------------
// Tiny test harness

let passed = 0, failed = 0;
const failures = [];
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; failures.push(name); console.log('✗ FAIL  ' + name + (detail ? '  · ' + String(detail).slice(0, 1500) : '')); }
  return !!ok;
}
async function test(name, fn) {
  if (ONLY && !name.toLowerCase().includes(ONLY.toLowerCase())) return;
  console.log('— ' + name);
  try { await fn(); } catch (e) {
    const msg = e && e.message ? e.message.replace(/\x1b\[\d+m/g, '').split('\n').slice(0, 14).join(' | ') : String(e);
    check(name + ' (ran to the end)', false, msg);
  }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------------------------------------
// Pages

const browser = await pw.chromium.launch();
const pages = [];

// opts: { width, height, fixture (default true), theme, routes: [[pattern, handler]], storage: {key: value} }
async function openPage(opts = {}) {
  const width = opts.width || 1440, height = opts.height || 900;
  const ctx = await browser.newContext({ viewport: { width, height }, acceptDownloads: true });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
  // Routes run newest first, so the general one is registered first.
  await ctx.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(ORIGIN)) return route.continue();
    const type = route.request().resourceType();
    if (type === 'script') return route.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
    if (type === 'stylesheet') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return route.abort();
  });
  if (opts.fixture !== false) {
    for (const f of CATEGORY_FILES) {
      await ctx.route(ORIGIN + PAGE_PATH + 'js/blocks/' + f + '.js', route => route.fulfill({
        status: 200, contentType: 'text/javascript', body: f === 'start' ? FIXTURE : 'export {};\n',
      }));
    }
  }
  for (const [pattern, handler] of opts.routes || []) await ctx.route(pattern, handler);
  await ctx.addInitScript(({ theme, storage }) => {
    try {
      // Clear once per tab, so a reload keeps what the page saved (the Persist test).
      if (!sessionStorage.getItem('pfb-ui-test')) {
        localStorage.clear();
        sessionStorage.setItem('pfb-ui-test', '1');
        localStorage.setItem('pf-theme', theme);
        for (const [k, v] of Object.entries(storage || {})) localStorage.setItem(k, v);
      }
      localStorage.setItem('pf-builder-tour-v1-seen', '1');
    } catch (e) { /* fine */ }
  }, { theme: opts.theme || 'light', storage: opts.storage || {} });
  const page = await ctx.newPage();
  const errors = [];
  const dialogs = [];
  // A request this test aborts on purpose (off-site, as the repo checks do) is not the page's fault.
  page.on('console', m => {
    if (m.type() === 'warning' && /^\[Builder\]/.test(m.text())) console.log('    (page says: ' + m.text().slice(0, 300) + ')');
    if (m.type() !== 'error') return;
    const where = (m.location() && m.location().url) || '';
    if (/Failed to load resource/.test(m.text()) && where && !where.startsWith(ORIGIN)) return;
    errors.push('console: ' + m.text() + (where ? ' @ ' + where : ''));
  });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('dialog', async d => { dialogs.push(d.message()); try { await d.accept(); } catch (e) { /* closed */ } });
  const P = { ctx, page, errors, dialogs, width, height };
  pages.push(P);
  if (opts.goto !== false) await gotoReady(P);
  return P;
}

async function gotoReady(P, reload = false) {
  if (reload) await P.page.reload(); else await P.page.goto(URL);
  await P.page.waitForFunction(() => window.PFB && window.PFB.ready, null, { timeout: 15000 });
  await P.page.evaluate(() => Promise.all([PFB.canvasReady, PFB.runtimeReady, PFB.templatesReady]));
  await P.page.waitForFunction(() => !!PFB.store.get().gen, null, { timeout: 15000 });
  await sleep(150);
}
async function closePage(P, label) {
  check((label || 'page') + ': no console errors or page errors', P.errors.length === 0, P.errors.join(' | '));
  await P.ctx.close();
}

const wfOf = (P) => P.page.evaluate(() => JSON.parse(JSON.stringify(PFB.store.get().wf)));
const selOf = (P) => P.page.evaluate(() => PFB.store.get().sel);
async function settle(P, ms = 120) {
  await P.page.evaluate(() => PFB.flushGenerate());
  await sleep(ms);
}
// Load a workflow and show it at zoom 1 with the origin near the top-left of the free part of
// the canvas (below the floating top bar, right of the Blocks panel), so the tests know where
// everything is.
async function openQuickStart(P) {
  if (await P.page.evaluate(() => document.getElementById('pfbQuickStart').hidden)) await P.page.click('#pfbQsBtn');
  await sleep(80);
}
async function freeOrigin(P) {
  return P.page.evaluate(() => {
    const cs = getComputedStyle(document.getElementById('pfbApp'));
    const n = (v, d) => { const x = parseFloat(cs.getPropertyValue(v)); return Number.isFinite(x) ? x : d; };
    return { x: Math.round(n('--pfb-safe-left', 12) + 24), y: Math.round(n('--pfb-dock-top', 72) + 24), zoom: 1 };
  });
}
async function loadWf(P, obj, view) {
  if (!view) view = await freeOrigin(P);
  const n = obj.nodes.length;
  const ok = await P.page.evaluate(o => PFB.loadWorkflowObject(o, { quiet: true }), { ...obj, view });
  await P.page.waitForFunction(k => document.querySelectorAll('.react-flow__node').length === k, n, { timeout: 5000 });
  await sleep(250);
  await P.page.evaluate(v => PFB.app.canvas.setViewport(v), view);
  await P.page.evaluate(() => PFB.select([]));
  await settle(P, 200);
  return ok;
}

// ---- Geometry
async function handleAt(P, nodeId, handleId, kind) {
  const loc = P.page.locator(`.react-flow__node[data-id="${nodeId}"] .react-flow__handle.${kind}[data-handleid="${handleId}"]`);
  const b = await loc.boundingBox();
  if (!b) throw new Error(`no ${kind} handle ${handleId} on ${nodeId}`);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
async function dragMouse(P, from, to, steps = 14) {
  await P.page.mouse.move(from.x, from.y);
  await P.page.mouse.down();
  for (let i = 1; i <= steps; i++) await P.page.mouse.move(from.x + (to.x - from.x) * i / steps, from.y + (to.y - from.y) * i / steps);
  await sleep(60);
  await P.page.mouse.up();
  await sleep(200);
}
// A point on the empty canvas at least `gap` px from every block and overlay.
async function emptyPoint(P, gap = 70) {
  return P.page.evaluate((g) => {
    const c = document.querySelector('.pfb-flow').getBoundingClientRect();
    const boxes = [...document.querySelectorAll('.react-flow__node, .react-flow__minimap, .pfb-legend, .pfb-starter-card, .pfb-dock, .pfb-top > *, .pfb-foot')].map(n => n.getBoundingClientRect()).filter(b => b.width && b.height);
    for (let y = c.top + 40; y < c.bottom - 40; y += 20) {
      for (let x = c.left + 40; x < c.right - 40; x += 20) {
        if (boxes.some(b => x > b.left - g && x < b.right + g && y > b.top - g && y < b.bottom + g)) continue;
        const el = document.elementFromPoint(x, y);
        if (el && el.classList.contains('react-flow__pane')) return { x, y };
      }
    }
    return null;
  }, gap);
}
async function edgeMid(P, edgeId) {
  return P.page.evaluate(id => {
    const p = document.querySelector(`.react-flow__edge[data-id="${id}"] path.react-flow__edge-path`);
    if (!p) return null;
    const pt = p.getPointAtLength(p.getTotalLength() / 2);
    const m = p.getScreenCTM();
    return { x: m.a * pt.x + m.c * pt.y + m.e, y: m.b * pt.x + m.d * pt.y + m.f };
  }, edgeId);
}
// Drag a palette item and drop it at a screen point (HTML5 drag and drop).
async function dropPalette(P, type, pt) {
  const flow = await P.page.locator('.pfb-flow').boundingBox();
  await P.page.locator(`.pfb-pal-item[data-type="${type}"]`).dragTo(P.page.locator('.pfb-flow'), { force: true, targetPosition: { x: pt.x - flow.x, y: pt.y - flow.y } });
  await sleep(250);
}
// The repo's button-check and dropdown-check only see the page as it first loads (only Start).
// These run the same rules (copied from _ref/button-check.mjs and _ref/dropdown-check.mjs) on
// whatever the page shows now: a selected block's inspector, Problems fixes, toasts, quick-add.
async function buttonVocabulary(P) {
  return P.page.evaluate(() => {
    const SEL = 'button, [role=button], a[class*=btn], label[class*=btn]';
    const rows = [...document.querySelectorAll(SEL)].filter(el => !el.closest('[class*="tour-"]')).map(el => {
      const ico = [...el.querySelectorAll('svg.ico')].map(s => ([...s.classList].find(c => c.startsWith('ico-')) || '').slice(4));
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      const name = (el.getAttribute('aria-label') || el.getAttribute('title') || text).trim();
      const cs = getComputedStyle(el);
      return { text, name, ico, hasName: !!(el.getAttribute('aria-label') || el.getAttribute('title')), bare: el.classList.contains('btn-bare'), bg: cs.backgroundColor, border: parseFloat(cs.borderTopWidth) || 0, tag: el.tagName.toLowerCase() };
    });
    const CLOSE = /\b(close|dismiss|tutup)\b/i, DEL = /\b(remove|delete|hapus|discard)\b|\bclear (all|the)\b|^clear$/i;
    const DUP = /\b(duplicate|duplikat)\b|copy this (scenario|portfolio)/i, EDIT = /^(edit|ubah)\b|change method/i;
    const SAVE = /\bsave\b.*\b(file|json)\b/i, OPEN = /\bopen\b.*\b(file|json|csv|xlsx|video)\b|^open$/i, CLIP = /clipboard/i;
    const bad = [];
    const add = (rule, r) => bad.push(rule + ': "' + r.name.slice(0, 50) + '"');
    for (const r of rows) {
      if (/[✕×✖⊗]/.test(r.text.replace(/\d\s*×|×\s*\d/g, ''))) add('cross as text', r);
      if (r.ico.includes('close') && !CLOSE.test(r.name)) add('cross not on a close', r);
      if (DEL.test(r.name) && !r.ico.includes('trash') && !/^clear$/i.test(r.name)) add('delete without the bin', r);
      if (r.ico.includes('trash') && !(DEL.test(r.name) || /\bclear\b/i.test(r.name))) add('bin on something else', r);
      for (const [re, ico, what] of [[DUP, 'duplicate', 'duplicate'], [EDIT, 'edit', 'edit'], [SAVE, 'save', 'save'], [OPEN, 'open', 'open']]) {
        if (re.test(r.name) && !r.ico.includes(ico)) add(what + ' without its picture', r);
        if (r.ico.includes(ico) && !re.test(r.name)) add(what + ' picture lent', r);
      }
      if (CLIP.test(r.name) && !r.text.includes('⧉')) add('clipboard without ⧉', r);
      if (r.text === '⧉' && !CLIP.test(r.name)) add('⧉ not clipboard', r);
      if (/[💾📂📁🗂📥📤📊✏✎🗑⚙⊡]|^[↓↑]\s/u.test(r.text)) add('stray glyph', r);
      if (!r.text && !r.hasName && r.tag !== 'a') add('icon-only without a name', r);
      if (r.bare && !(/rgba\(0, 0, 0, 0\)|transparent/.test(r.bg) && r.border === 0)) add('bare with a fill or border', r);
    }
    return { n: rows.length, bad };
  });
}
async function fieldLook(P) {
  return P.page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;left:-9999px;border:1px solid var(--border);background:var(--input-bg);color:var(--panel)';
    document.body.appendChild(probe);
    const pc = getComputedStyle(probe);
    const token = { border: pc.borderTopColor, inputBg: pc.backgroundColor, panel: pc.color };
    probe.remove();
    const bad = [];
    const sels = [...document.querySelectorAll('#pfbApp select')].filter(s => s.offsetParent);
    for (const s of sels) {
      const c = getComputedStyle(s);
      const why = [];
      if (c.fontFamily.split(',')[0].replace(/["']/g, '').trim() !== 'DM Sans') why.push('font');
      if (c.fontWeight !== '500') why.push('weight ' + c.fontWeight);
      if (c.borderTopStyle !== 'solid' || c.borderTopColor !== token.border) why.push('border');
      if (c.backgroundColor !== token.inputBg && c.backgroundColor !== token.panel) why.push('fill ' + c.backgroundColor);
      if (!c.backgroundImage.startsWith('url(')) why.push('no chevron');
      if (parseFloat(c.paddingRight) < 18) why.push('padding-right ' + c.paddingRight);
      if (parseFloat(c.paddingLeft) < 6 || parseFloat(c.paddingTop) < 3) why.push('text against the border');
      if (why.length) bad.push((s.getAttribute('aria-label') || s.className) + ': ' + why.join(', '));
    }
    const combos = [...document.querySelectorAll('#pfbApp .combo-input')].filter(s => s.offsetParent);
    for (const el of combos) {
      const c = getComputedStyle(el);
      if (c.fontFamily.split(',')[0].replace(/["']/g, '').trim() !== 'DM Sans' || parseFloat(c.paddingLeft) < 6) bad.push('combo ' + (el.getAttribute('aria-label') || '') + ' look');
    }
    return { n: sels.length + combos.length, bad };
  });
}
const toastTexts = (P) => P.page.$$eval('.pfb-toast .pfb-toast-msg', ns => ns.map(n => n.textContent));
async function clearToasts(P) { await P.page.evaluate(() => document.querySelectorAll('.pfb-toast').forEach(t => t.remove())); }
const edgeBetween = (wf, from, out, to, inn) => wf.edges.find(e => e.from === from && e.out === out && e.to === to && e.in === inn);
const nodeIdsOf = (wf) => wf.nodes.map(n => n.id);

// The workflow most tests start from (fixture blocks):
//   Start -> Dispatch (MW) [fx.loop] -Each pass-> Set value -> Run calculation
//   Dispatch.value -> Set value.value
const BASE = {
  app: 'pf-builder', v: 1, name: 'UI test',
  nodes: [
    { id: 'n1', type: 'start', x: 16, y: 16, label: '', s: {} },
    { id: 'n2', type: 'fx.loop', x: 16, y: 208, label: 'Dispatch (MW)', s: {} },
    { id: 'n3', type: 'fx.set', x: 336, y: 16, label: '', s: { el: { cls: 'ElmSym', name: 'G 02', match: 'one' } } },
    { id: 'n4', type: 'fx.calc', x: 336, y: 272, label: '', s: {} },
  ],
  edges: [
    { id: 'e1', from: 'n1', out: 'next', to: 'n2', in: 'in' },
    { id: 'e2', from: 'n2', out: 'body', to: 'n3', in: 'in' },
    { id: 'e3', from: 'n2', out: 'value', to: 'n3', in: 'value' },
    { id: 'e4', from: 'n3', out: 'next', to: 'n4', in: 'in' },
  ],
};
const clone = (o) => JSON.parse(JSON.stringify(o));

// =============================================================================================
// PASS 1: fixture blocks, desktop

console.log('Pass 1: fixture blocks, 1440 x 900');
const D = await openPage();

await test('page loads clean', async () => {
  const info = await D.page.evaluate(() => ({
    react: typeof window.React === 'object' && typeof window.ReactDOM === 'object',
    rf: !!(window.ReactFlow && window.ReactFlow.ReactFlow),
    canvas: !!document.querySelector('.pfb-flow .react-flow'),
    msgHidden: document.getElementById('pfbCanvasMsg').hidden,
    failed: PFB.failed,
    alert: document.getElementById('pfbAlert').classList.contains('visible'),
    h1: document.querySelector('h1').textContent.trim(),
    banner: [...document.querySelectorAll('#scripterLinkDiv a')].map(a => a.getAttribute('href')),
    footer: !!document.querySelector('footer.pfb-foot .footer-links') && !!document.querySelector('footer.pfb-foot .footer-collab'),
    noAbbr: document.getElementById('pfbApp').hasAttribute('data-no-abbr') && document.getElementById('pfbApp').hasAttribute('data-no-persist'),
    emdash: /\u2014/.test(document.body.innerText),
  }));
  check('the vendored libraries load (React, ReactDOM, React Flow)', info.react && info.rf && info.canvas && info.msgHidden, JSON.stringify(info));
  check('every block file loaded, no banner', info.failed.length === 0 && !info.alert, JSON.stringify(info.failed));
  check('header h1, banner links to ../ and ../samples/, footer', info.h1 === 'PowerFactory Workflow Builder' && info.banner.includes('../') && info.banner.includes('../samples/') && info.footer, JSON.stringify(info));
  check('the app shell is data-no-abbr and data-no-persist', info.noAbbr);
  check('no em-dash in the page text', !info.emdash);
  const sw = await D.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  check('no horizontal page scroll at 1440 px', sw);
});

await test('starter card on an empty canvas', async () => {
  const vis = await D.page.evaluate(() => !document.getElementById('pfbStarter').hidden);
  check('the starter card shows while only Start is on the canvas', vis);
  const startBox = await D.page.locator('.react-flow__node').first().boundingBox();
  const card = await D.page.locator('.pfb-starter-card').boundingBox();
  check('the starter card does not cover the Start block', startBox && card && (startBox.y + startBox.height <= card.y || startBox.y >= card.y + card.height || startBox.x + startBox.width <= card.x || startBox.x >= card.x + card.width), JSON.stringify({ startBox, card }));
  await D.page.click('#pfbStarterBlank');
  check('Start blank hides it', await D.page.evaluate(() => document.getElementById('pfbStarter').hidden));
});

await test('palette', async () => {
  const info = await D.page.evaluate(() => {
    const blocks = PFB.registry.allBlocks();
    const cats = [...new Set(blocks.map(b => b.cat))];
    const shown = [...document.querySelectorAll('.pfb-cat')].map(c => ({ cat: c.dataset.cat, n: c.querySelectorAll('.pfb-pal-item').length }));
    return { nBlocks: blocks.length, items: document.querySelectorAll('.pfb-pal-item').length, cats, shown,
      order: shown.map(s => s.cat), regOrder: PFB.registry.CATEGORIES.map(c => c.id).filter(id => cats.includes(id)),
      startOff: (document.querySelector('.pfb-pal-item[data-type="start"]') || {}).className || '',
      startText: (document.querySelector('.pfb-pal-item[data-type="start"]') || {}).textContent || '' };
  });
  check('palette lists every block', info.items === info.nBlocks && info.nBlocks === 14, JSON.stringify(info));
  check('categories in registry order, none empty', JSON.stringify(info.order) === JSON.stringify(info.regOrder) && info.shown.every(s => s.n > 0), JSON.stringify(info.shown));
  check('Start is greyed "Already on the canvas"', /is-off/.test(info.startOff) && /Already on the canvas/.test(info.startText));
  await D.page.fill('#pfbPalSearch', 'dispatch');
  const found = await D.page.$$eval('.pfb-pal-item', ns => ns.map(n => n.dataset.type));
  check('search finds a block by keyword', found.length === 1 && found[0] === 'fx.set', JSON.stringify(found));
  await D.page.fill('#pfbPalSearch', 'zzzz nothing');
  check('search with no match says so', await D.page.isVisible('.pfb-pal-empty'));
  await D.page.fill('#pfbPalSearch', '');
  // Collapsing a category
  await D.page.click('.pfb-cat[data-cat="model"] .pfb-cat-head');
  check('a category folds', await D.page.evaluate(() => document.querySelector('.pfb-cat[data-cat="model"] .pfb-cat-items').hidden));
  await D.page.click('.pfb-cat[data-cat="model"] .pfb-cat-head');
  // Tips are the descriptions, within the site's 200 characters
  const tips = await D.page.$$eval('.pfb-pal-item[data-tip]', ns => ns.map(n => n.getAttribute('data-tip')));
  check('palette tips are the descriptions (200 characters at most)', tips.length >= 13 && tips.every(t => t.length > 0 && t.length <= 200));
});

await test('click to add, wired', async () => {
  await loadWf(D, BASE);
  // Make every category open (folded ones hide their items).
  await D.page.evaluate(() => document.querySelectorAll('.pfb-cat-head[aria-expanded="false"]').forEach(b => b.click()));
  await D.page.evaluate(() => PFB.select(['n4']));
  await D.page.click('.pfb-pal-item[data-type="fx.log"]');
  await sleep(200);
  let wf = await wfOf(D);
  const a = wf.nodes.find(n => n.type === 'fx.log');
  check('a step lands after the selected block, wired from its first free flow output', a && edgeBetween(wf, 'n4', 'ok', a.id, 'in'), JSON.stringify(wf.edges));
  check('the new block is selected', JSON.stringify((await selOf(D)).nodes) === JSON.stringify([a && a.id]));
  await D.page.evaluate(() => PFB.select([]));
  await D.page.click('.pfb-pal-item[data-type="fx.remember"]');
  await sleep(200);
  wf = await wfOf(D);
  const b = wf.nodes.find(n => n.type === 'fx.remember');
  check('with nothing selected it chains after the block added last', b && edgeBetween(wf, a.id, 'next', b.id, 'in'), JSON.stringify(wf.edges.slice(-2)));
  await D.page.evaluate(() => PFB.select(['n4']));
  await D.page.click('.pfb-pal-item[data-type="fx.peak"]');
  await sleep(200);
  wf = await wfOf(D);
  const c = wf.nodes.find(n => n.type === 'fx.peak');
  const n4 = wf.nodes.find(n => n.id === 'n4');
  check('a calculator lands right of the selected block with its first fitting output wired', c && edgeBetween(wf, 'n4', 'curve', c.id, 'series') && c.x > n4.x, JSON.stringify(wf.edges.slice(-1)));
  await D.page.click('.pfb-pal-item[data-type="start"]').catch(() => {});
  check('Start cannot be added twice', (await wfOf(D)).nodes.filter(n => n.type === 'start').length === 1);
});

await test('drag a block from the palette', async () => {
  await loadWf(D, BASE);
  const pt = await emptyPoint(D);
  await dropPalette(D, 'fx.number', pt);
  const wf = await wfOf(D);
  const n = wf.nodes.find(x => x.type === 'fx.number');
  const vp = await D.page.evaluate(() => PFB.app.canvas.rf.getViewport());
  const flow = await D.page.locator('.pfb-flow').boundingBox();
  const want = { x: (pt.x - flow.x - vp.x) / vp.zoom, y: (pt.y - flow.y - vp.y) / vp.zoom };
  check('a dropped block lands where it was dropped (snapped to the grid)', n && Math.abs(n.x - want.x) <= 16 && Math.abs(n.y - want.y) <= 16 && n.x % 16 === 0, JSON.stringify({ n, want }));
});

await test('splice a step onto a flow wire', async () => {
  await loadWf(D, BASE);
  const mid = await edgeMid(D, 'e4');
  await dropPalette(D, 'fx.remember', mid);
  const wf = await wfOf(D);
  const n = wf.nodes.find(x => x.type === 'fx.remember');
  check('dropping a step on a flow wire puts it between the two steps', n && edgeBetween(wf, 'n3', 'next', n.id, 'in') && edgeBetween(wf, n.id, 'next', 'n4', 'in') && !edgeBetween(wf, 'n3', 'next', 'n4', 'in') && wf.edges.length === 5, JSON.stringify(wf.edges));
  await D.page.keyboard.press('Control+z');
  await sleep(150);
  const back = await wfOf(D);
  check('one undo takes the splice back', back.nodes.length === 4 && !!edgeBetween(back, 'n3', 'next', 'n4', 'in') && back.edges.length === 4);
});

await test('drag a wire between handles', async () => {
  await loadWf(D, { ...clone(BASE), nodes: [...clone(BASE).nodes, { id: 'n5', type: 'fx.log', x: 656, y: 272, label: '', s: {} }] });
  const from = await handleAt(D, 'n4', 'slack', 'source');
  const to = await handleAt(D, 'n5', 'a', 'target');
  await dragMouse(D, from, to);
  const wf = await wfOf(D);
  check('a data wire is made from an output to an input', !!edgeBetween(wf, 'n4', 'slack', 'n5', 'a'), JSON.stringify(wf.edges));
  const cls = await D.page.evaluate(() => { const e = PFB.store.get().wf.edges.find(x => x.from === 'n4' && x.out === 'slack'); return e ? document.querySelector(`.react-flow__edge[data-id="${e.id}"]`).getAttribute('class') : ''; });
  check('a data wire is drawn thin in its type colour', /pfb-e-data/.test(cls) && /pfb-t-num/.test(cls), cls);
  const fcls = await D.page.evaluate(() => document.querySelector('.react-flow__edge[data-id="e4"]').getAttribute('class'));
  check('a flow wire is drawn as a flow wire', /pfb-e-flow/.test(fcls), fcls);
  // A flow wire into a flow input
  const f1 = await handleAt(D, 'n4', 'ok', 'source');
  const t1 = await handleAt(D, 'n5', 'in', 'target');
  await dragMouse(D, f1, t1);
  check('a flow wire is made between flow ports', !!edgeBetween(await wfOf(D), 'n4', 'ok', 'n5', 'in'));
  // Ports highlight while a wire is dragged
  const f2 = await handleAt(D, 'n4', 'curve', 'source');
  await D.page.mouse.move(f2.x, f2.y);
  await D.page.mouse.down();
  await D.page.mouse.move(f2.x + 60, f2.y + 40, { steps: 5 });
  const hl = await D.page.evaluate(() => ({
    on: document.getElementById('pfbCanvas').classList.contains('pfb-connecting'),
    rule: document.getElementById('pfbConnStyle').textContent,
  }));
  await D.page.mouse.up();
  await sleep(150);
  await D.page.keyboard.press('Escape');
  await D.page.evaluate(() => { if (window.PFB) PFB.app.closeQuickAdd(); });
  check('while a wire is dragged the ports that fit brighten', hl.on && /data-pt="series"/.test(hl.rule) && !/data-pt="num"/.test(hl.rule), JSON.stringify(hl));
});

await test('a refused wire says why and offers a converter', async () => {
  await loadWf(D, BASE);
  await clearToasts(D);
  const from = await handleAt(D, 'n4', 'curve', 'source');
  const to = await handleAt(D, 'n3', 'value', 'target');
  await dragMouse(D, from, to);
  const toasts = await toastTexts(D);
  check('the refusal toast says why (whyNot)', toasts.some(t => /whole curve/.test(t)), JSON.stringify(toasts));
  const qa = await D.page.$$eval('.pfb-qa .pfb-qa-main', ns => ns.map(n => n.textContent));
  check('quick-add offers the converting blocks', qa.includes('Peak'), JSON.stringify(qa));
  check('the wire was not made', !edgeBetween(await wfOf(D), 'n4', 'curve', 'n3', 'value'));
  await D.page.click('.pfb-qa .pfb-qa-item:has-text("Peak")');
  await sleep(200);
  const wf = await wfOf(D);
  const p = wf.nodes.find(n => n.type === 'fx.peak');
  check('the converter goes between them', p && edgeBetween(wf, 'n4', 'curve', p.id, 'series') && edgeBetween(wf, p.id, 'value', 'n3', 'value'), JSON.stringify(wf.edges));
  // A wire back into its own loop
  await clearToasts(D);
  const f2 = await handleAt(D, 'n4', 'fail', 'source');
  const t2 = await handleAt(D, 'n2', 'in', 'target');
  await dragMouse(D, f2, t2);
  const t3 = await toastTexts(D);
  check('a wire from the Each pass route back into its loop is refused', t3.some(t => /No need to wire back/.test(t)) && !edgeBetween(await wfOf(D), 'n4', 'fail', 'n2', 'in'), JSON.stringify(t3));
  await D.page.evaluate(() => PFB.app.closeQuickAdd());
});

await test('quick-add on a pane drop', async () => {
  await loadWf(D, BASE);
  const from = await handleAt(D, 'n2', 'done', 'source');
  const pt = await emptyPoint(D);
  await dragMouse(D, from, pt);
  const title = await D.page.textContent('.pfb-qa .pfb-qa-title').catch(() => '');
  check('dropping a wire on the empty canvas opens quick-add', /Then do/.test(title || ''), title);
  const items = await D.page.$$eval('.pfb-qa .pfb-qa-main', ns => ns.map(n => n.textContent));
  check('quick-add lists only blocks with a flow input', items.includes('Print a message') && !items.includes('Peak') && !items.includes('Number'), JSON.stringify(items));
  await D.page.fill('.pfb-qa-search', 'print');
  await D.page.keyboard.press('Enter');
  await sleep(200);
  const wf = await wfOf(D);
  const n = wf.nodes.find(x => x.type === 'fx.log');
  check('the picked block is added and wired', n && edgeBetween(wf, 'n2', 'done', n.id, 'in'), JSON.stringify(wf.edges));
  // From a Yes / No output: "Continue only if Yes"
  const f2 = await handleAt(D, 'n4', 'converged', 'source');
  const pt2 = await emptyPoint(D);
  await dragMouse(D, f2, pt2);
  const first = await D.page.textContent('.pfb-qa .pfb-qa-item .pfb-qa-main').catch(() => '');
  check('quick-add from a Yes / No output offers "Continue only if Yes" first', first === 'Continue only if Yes', first);
  await D.page.click('.pfb-qa .pfb-qa-item.pfb-qa-first');
  await sleep(200);
  const wf2 = await wfOf(D);
  const iff = wf2.nodes.find(x => x.type === 'flow.if');
  check('"Continue only if Yes" puts an If (is true) after the step the value comes from',
    iff && iff.s.op === 'true' && edgeBetween(wf2, 'n4', 'converged', iff.id, 'a') && edgeBetween(wf2, 'n4', 'ok', iff.id, 'in'), JSON.stringify(wf2.edges));
  // From an input, backwards
  const t3 = await handleAt(D, 'n4', 'in', 'target');
  await D.page.evaluate(() => PFB.select([]));
});

await test('a second wire from a used flow output replaces the first, with Undo', async () => {
  await loadWf(D, { ...clone(BASE), nodes: [...clone(BASE).nodes, { id: 'n5', type: 'fx.log', x: 656, y: 272, label: '', s: {} }] });
  await clearToasts(D);
  const from = await handleAt(D, 'n3', 'next', 'source');
  const to = await handleAt(D, 'n5', 'in', 'target');
  await dragMouse(D, from, to);
  const wf = await wfOf(D);
  const toasts = await toastTexts(D);
  check('the new wire replaces the old one', edgeBetween(wf, 'n3', 'next', 'n5', 'in') && !wf.edges.some(e => e.id === 'e4'));
  check('a toast says so and offers Undo', toasts.some(t => /was replaced/.test(t)) && await D.page.isVisible('.pfb-toast .pfb-toast-undo'), JSON.stringify(toasts));
  await D.page.click('.pfb-toast .pfb-toast-undo');
  await sleep(150);
  const back = await wfOf(D);
  check('Undo in the toast brings the old wire back', back.edges.some(e => e.id === 'e4') && !edgeBetween(back, 'n3', 'next', 'n5', 'in'));
});

await test('inspector edits', async () => {
  await loadWf(D, BASE);
  await D.page.click('.react-flow__node[data-id="n3"] .pfb-n-title');
  await sleep(200);
  check('selecting a block shows it in Settings', /Set value/.test(await D.page.textContent('#pfbInspector .pfb-insp-title')));
  // attr setting -> summary
  const attr = D.page.locator('#pfbInspector [data-key="attr"] input');
  await attr.fill('plini');
  await sleep(150);
  const sum = await D.page.textContent('.react-flow__node[data-id="n3"] .pfb-n-sum');
  check('an inspector edit changes the block summary on the canvas', sum === 'Set plini to 100 MW', sum);
  await D.page.keyboard.press('Escape');
  // a wired input names its source; "Type a value instead" unwires it
  const src = await D.page.textContent('#pfbInspector [data-port="value"] .pfb-in-src');
  check('a wired input names its source', /Dispatch \(MW\)/.test(src), src);
  await D.page.click('#pfbInspector [data-port="value"] .pfb-unwire');
  await sleep(150);
  check('"Type a value instead" removes the wire', !(await wfOf(D)).edges.some(e => e.id === 'e3'));
  const num = D.page.locator('#pfbInspector [data-port="value"] input.affix-input');
  check('the number field shows its unit as an affix', (await D.page.textContent('#pfbInspector [data-port="value"] .suffix')) === 'MW');
  await num.fill('250');
  await num.blur();
  await sleep(150);
  const fb = await D.page.textContent('.react-flow__node[data-id="n3"] [data-handleid="value"] ~ .pfb-n-fb');
  check('an unwired input with a fallback shows "= value" on the canvas', fb === '= 250 MW', fb);
  await num.fill('9999');
  await sleep(100);
  check('a number above the maximum says so', /highest value is 5000/.test(await D.page.textContent('#pfbInspector [data-port="value"] .pfb-num-hint')));
  await num.blur();
  await sleep(100);
  check('and is clamped on blur', (await wfOf(D)).nodes.find(n => n.id === 'n3').s.value === 5000);
  // undo of a field is one step (coalesced while typing)
  const before = (await wfOf(D)).nodes.find(n => n.id === 'n3').s.attr;
  await D.page.click('.react-flow__pane', { position: { x: 5, y: 5 } }).catch(() => {});
  // More options fold
  await D.page.evaluate(() => PFB.select(['n3']));
  await sleep(100);
  check('More options are folded', await D.page.evaluate(() => { const b = document.querySelector('#pfbInspector .pfb-more .fg-sub'); return !!b && b.hidden; }));
  await D.page.click('#pfbInspector .pfb-more-btn');
  check('and open on a click', await D.page.isVisible('#pfbInspector [data-key="note"]'));
  // pin: put a setting at the top of the script
  await D.page.click('#pfbInspector [data-key="mode"] .pfb-pin');
  await sleep(100);
  await settle(D);
  const pinned = (await wfOf(D)).nodes.find(n => n.id === 'n3').pin;
  const code = await D.page.evaluate(() => PFB.store.get().gen.code);
  check('a pinned setting goes to the top of the script', pinned.includes('mode') && /^[A-Z_]+MODE\s*=\s*"abs"/m.test(code), JSON.stringify(pinned));
  await D.page.evaluate(() => PFB.select(['n2']));
  await sleep(120);
  await D.page.click('#pfbInspector .pfb-more-btn').catch(() => {});
  check('a noPin setting has no pin button', await D.page.evaluate(() => { const r = document.querySelector('#pfbInspector [data-key="restore"]'); return !!r && !r.querySelector('.pfb-pin'); }));
  check('a calculator-free step shows Duplicate and Delete', await D.page.isVisible('#pfbInspector .pfb-insp-actions .pfb-del'));
});

await test('element picker', async () => {
  await loadWf(D, BASE);
  await D.page.evaluate(() => PFB.select(['n3']));
  await sleep(150);
  const opts = await D.page.$$eval('#pfbInspector [data-port="el"] select.pfb-el-cls option', ns => ns.map(o => [o.value, o.textContent]));
  check('the class list is filtered by the input\'s kinds, plain names first', JSON.stringify(opts) === JSON.stringify([['ElmSym', 'Synchronous generator (ElmSym)'], ['ElmGenstat', 'Static generator (ElmGenstat)']]), JSON.stringify(opts));
  check('the name field has the Data Manager placeholder', (await D.page.getAttribute('#pfbInspector [data-port="el"] .pfb-el-name', 'placeholder')) === 'Exactly as in the Data Manager, e.g. G 02');
  await D.page.selectOption('#pfbInspector [data-port="el"] select.pfb-el-cls', 'ElmGenstat');
  await D.page.fill('#pfbInspector [data-port="el"] .pfb-el-name', 'PV 1');
  await D.page.selectOption('#pfbInspector [data-port="el"] select.pfb-el-match', 'all');
  await sleep(150);
  const el = (await wfOf(D)).nodes.find(n => n.id === 'n3').s.el;
  check('the picker saves {cls, name, match}', el.cls === 'ElmGenstat' && el.name === 'PV 1' && el.match === 'all', JSON.stringify(el));
  check('the canvas shows the element next to the input', (await D.page.textContent('.react-flow__node[data-id="n3"] [data-handleid="el"] ~ .pfb-n-fb')) === '= PV 1');
  const matchOpts = await D.page.$$eval('#pfbInspector [data-port="el"] select.pfb-el-match option', ns => ns.map(o => o.value));
  check('match one / first / all', JSON.stringify(matchOpts) === '["one","first","all"]');
});

await test('attribute suggestions', async () => {
  await loadWf(D, BASE);
  await D.page.evaluate(() => PFB.select(['n3']));
  await sleep(120);
  await D.page.fill('#pfbInspector [data-key="attr"] input', '');
  await D.page.click('#pfbInspector [data-key="attr"] input');
  await D.page.keyboard.type('active power');
  await D.page.waitForSelector('.pfb-combo-list .combo-opt', { timeout: 8000 });
  const rows = await D.page.$$eval('.pfb-combo-list .combo-opt', ns => ns.slice(0, 40).map(n => ({ main: n.querySelector('.combo-main').textContent, chip: (n.querySelector('.combo-chip') || {}).textContent })));
  check('attribute suggestions show the description first and the code second', rows.length > 0 && rows.some(r => r.chip === 'pgini'), JSON.stringify(rows.slice(0, 5)));
  check('input data is offered without the e: prefix', rows.every(r => !/^[eb]:/.test(r.chip || '')), JSON.stringify(rows.slice(0, 5)));
  await D.page.click('.pfb-combo-list .combo-opt:has(.combo-chip:text-is("pgini"))');
  await sleep(120);
  check('a suggestion fills the field', (await wfOf(D)).nodes.find(n => n.id === 'n3').s.attr === 'pgini');
  // A results variable at a branch terminal: the real suffixes, never the busN placeholder
  await loadWf(D, { ...clone(BASE), nodes: [...clone(BASE).nodes, { id: 'n5', type: 'fx.rows', x: 656, y: 16, label: '', s: {} }] });
  await D.page.evaluate(() => PFB.select(['n5']));
  await sleep(120);
  await D.page.click('#pfbInspector .pfb-list-row [data-fid$=":var"]');
  await D.page.keyboard.type('m:P');
  await D.page.waitForSelector('.pfb-combo-list .combo-opt', { timeout: 8000 });
  const chips = await D.page.$$eval('.pfb-combo-list .combo-chip', ns => ns.map(n => n.textContent));
  check('a line\'s result variables carry :bus1 / :bus2, never :busN', chips.includes('m:P:bus1') && chips.includes('m:P:bus2') && !chips.some(c => /busN|:Ph/.test(c)), JSON.stringify(chips.slice(0, 12)));
  await D.page.keyboard.press('Escape');
});

await test('list editors and dynamic ports', async () => {
  await loadWf(D, { ...clone(BASE), nodes: [...clone(BASE).nodes, { id: 'n5', type: 'fx.rows', x: 656, y: 16, label: '', s: {} }] });
  await D.page.evaluate(() => PFB.select(['n5']));
  await sleep(150);
  check('a list shows its rows', (await D.page.$$('#pfbInspector .pfb-list-row')).length === 1);
  await D.page.click('#pfbInspector .pfb-list-add');
  await sleep(200);
  let wf = await wfOf(D);
  const rows = wf.nodes.find(n => n.id === 'n5').s.cols;
  check('+ Add makes a row with a stable id', rows.length === 2 && rows[1].id === 'c2', JSON.stringify(rows));
  check('the row becomes a port on the canvas', await D.page.isVisible('.react-flow__node[data-id="n5"] .react-flow__handle.target[data-handleid="c2"]'));
  // wire the new port, then remove its row: the wire goes with it
  const from = await handleAt(D, 'n4', 'slack', 'source');
  const to = await handleAt(D, 'n5', 'c2', 'target');
  await dragMouse(D, from, to);
  check('a wire into the new port', !!edgeBetween(await wfOf(D), 'n4', 'slack', 'n5', 'c2'));
  await D.page.evaluate(() => PFB.select(['n5']));
  await sleep(150);
  await D.page.click('#pfbInspector .pfb-list-row[data-row="c2"] .is-delete');
  await sleep(200);
  wf = await wfOf(D);
  check('the bin removes the row, its port and its wire', wf.nodes.find(n => n.id === 'n5').s.cols.length === 1 && !wf.edges.some(e => e.to === 'n5' && e.in === 'c2'));
  check('the port is gone from the canvas', !(await D.page.$('.react-flow__node[data-id="n5"] .react-flow__handle.target[data-handleid="c2"]')));
  // a code field: Tab writes four spaces
  await loadWf(D, { ...clone(BASE), nodes: [...clone(BASE).nodes, { id: 'n5', type: 'fx.code', x: 656, y: 16, label: '', s: { code: 'x = 1' } }] });
  await D.page.evaluate(() => PFB.select(['n5']));
  await sleep(150);
  const ta = D.page.locator('#pfbInspector textarea.pfb-codearea');
  await ta.click();
  await D.page.keyboard.press('End');
  await D.page.keyboard.press('Enter');
  await D.page.keyboard.press('Tab');
  await D.page.keyboard.type('y = 2');
  await sleep(120);
  check('a code field is monospace and Tab inserts 4 spaces', (await wfOf(D)).nodes.find(n => n.id === 'n5').s.code === 'x = 1\n    y = 2' &&
    /Mono/.test(await ta.evaluate(t => getComputedStyle(t).fontFamily)));
});

await test('names in use are offered (suggest)', async () => {
  const w = clone(BASE);
  w.nodes.push({ id: 'n5', type: 'fx.remember', x: 656, y: 16, label: '', s: { name: 'nadir_low' } });
  w.nodes.push({ id: 'n6', type: 'fx.remember', x: 656, y: 272, label: '', s: { name: 'peak' } });
  await loadWf(D, w);
  await D.page.evaluate(() => PFB.select(['n6']));
  await sleep(150);
  await D.page.fill('#pfbInspector [data-key="name"] input', '');
  await D.page.click('#pfbInspector [data-key="name"] input');
  await sleep(250);
  const names = await D.page.$$eval('.pfb-combo-list .combo-main', ns => ns.map(n => n.textContent));
  check('a setting with suggest offers the names already used', names.includes('nadir_low'), JSON.stringify(names));
  await D.page.keyboard.press('Escape');
});

await test('workflow settings with nothing selected', async () => {
  await loadWf(D, BASE);
  await D.page.evaluate(() => PFB.select([]));
  await sleep(120);
  const title = await D.page.textContent('#pfbInspector .pfb-insp-title');
  check('nothing selected shows the Workflow settings', title === 'Workflow');
  check('a "How it works" card explains the two wires', /Flow wire/.test(await D.page.textContent('#pfbInspector .pfb-how')) && /Data wire/.test(await D.page.textContent('#pfbInspector .pfb-how')));
  await D.page.fill('#pfbInspector [data-key="wfname"] input', 'Headroom test');
  await D.page.fill('#pfbInspector [data-key="project"] input', 'Nine-bus System');
  await D.page.locator('#pfbInspector [data-key="project"] input').blur();
  await settle(D);
  const wf = await wfOf(D);
  const code = await D.page.evaluate(() => PFB.store.get().gen.code);
  check('Workflow name edits wf.name and the script', wf.name === 'Headroom test' && /WORKFLOW_NAME = "Headroom test"/.test(code), wf.name);
  check('Start\'s settings are edited here', wf.nodes[0].s.project === 'Nine-bus System' && /PROJECT = "Nine-bus System"/.test(code));
  const label = await D.page.textContent('#pfbDownload');
  check('with no problems the download button carries no count', label.trim() === '⬇ Download .py', label);
});

await test('undo and redo', async () => {
  await loadWf(D, BASE);
  await D.page.evaluate(() => PFB.select(['n3']));
  await sleep(120);
  const f = D.page.locator('#pfbInspector [data-key="attr"] input');
  await f.fill('');
  await f.type('qgini');
  await f.blur();
  await sleep(120);
  await D.page.click('#pfbCanvas .react-flow__pane', { position: { x: 8, y: 8 }, force: true }).catch(() => {});
  check('Undo is enabled after an edit', !(await D.page.isDisabled('#pfbUndo')));
  await D.page.keyboard.press('Control+z');
  await sleep(150);
  const a = (await wfOf(D)).nodes.find(n => n.id === 'n3').s.attr;
  check('Ctrl+Z undoes a whole field edit in one step', a === 'pgini', a);
  await D.page.keyboard.press('Control+y');
  await sleep(150);
  check('Ctrl+Y redoes it', (await wfOf(D)).nodes.find(n => n.id === 'n3').s.attr === 'qgini');
  await D.page.keyboard.press('Control+Shift+z');
  await D.page.click('#pfbUndo');
  await sleep(120);
  await D.page.click('#pfbRedo');
  await sleep(120);
  check('the toolbar undo / redo buttons work', (await wfOf(D)).nodes.find(n => n.id === 'n3').s.attr === 'qgini');
  // A node drag is one undo step
  const box = await D.page.locator('.react-flow__node[data-id="n4"] .pfb-n-head').boundingBox();
  await dragMouse(D, { x: box.x + 40, y: box.y + 10 }, { x: box.x + 140, y: box.y + 90 }, 10);
  const moved = (await wfOf(D)).nodes.find(n => n.id === 'n4');
  check('dragging a block moves it (snapped to the grid)', (moved.x !== 336 || moved.y !== 272) && moved.x % 16 === 0 && moved.y % 16 === 0, JSON.stringify(moved));
  await D.page.keyboard.press('Control+z');
  await sleep(150);
  const back = (await wfOf(D)).nodes.find(n => n.id === 'n4');
  check('one undo puts a dragged block back', back.x === 336 && back.y === 272, JSON.stringify(back));
});

await test('delete (Start refuses) and undo brings the wires back', async () => {
  await loadWf(D, BASE);
  await clearToasts(D);
  await D.page.click('.react-flow__node[data-id="n1"] .pfb-n-title');
  await D.page.keyboard.press('Delete');
  await sleep(150);
  check('Start cannot be deleted', (await wfOf(D)).nodes.some(n => n.id === 'n1') && (await toastTexts(D)).some(t => /Start cannot be deleted/.test(t)));
  await D.page.click('.react-flow__node[data-id="n3"] .pfb-n-title');
  await D.page.keyboard.press('Delete');
  await sleep(150);
  let wf = await wfOf(D);
  check('Delete removes the block and its wires', !wf.nodes.some(n => n.id === 'n3') && wf.edges.length === 1, JSON.stringify(wf.edges));
  check('a toast offers Undo', (await toastTexts(D)).some(t => /Deleted Set value and 3 wires/.test(t)));
  await D.page.click('.pfb-toast .pfb-toast-undo');
  await sleep(150);
  wf = await wfOf(D);
  check('undo restores the block and its wires in one step', wf.nodes.some(n => n.id === 'n3') && ['e2', 'e3', 'e4'].every(id => wf.edges.some(e => e.id === id)));
  // Backspace in a text field edits the text, it does not delete the block
  await D.page.evaluate(() => PFB.select(['n3']));
  await sleep(120);
  await D.page.click('#pfbInspector [data-key="attr"] input');
  await D.page.keyboard.press('Backspace');
  await sleep(100);
  check('Backspace in a field does not delete the block', (await wfOf(D)).nodes.some(n => n.id === 'n3'));
  // A wire: select it, Delete
  await D.page.evaluate(() => PFB.store.select([], ['e4']));
  await sleep(100);
  await D.page.locator('.pfb-flow').focus().catch(() => {});
  await D.page.evaluate(() => document.activeElement && document.activeElement.blur());
  await D.page.keyboard.press('Delete');
  await sleep(120);
  check('a selected wire is deleted with Delete', !(await wfOf(D)).edges.some(e => e.id === 'e4'));
  // the bin on the inspector
  await D.page.evaluate(() => PFB.select(['n4']));
  await sleep(120);
  await D.page.click('#pfbInspector .pfb-insp-actions .pfb-del');
  await sleep(120);
  check('the inspector bin deletes the block', !(await wfOf(D)).nodes.some(n => n.id === 'n4'));
});

await test('copy, paste and duplicate', async () => {
  await loadWf(D, BASE);
  await D.page.evaluate(() => PFB.select(['n3', 'n4']));
  await D.page.evaluate(() => document.activeElement && document.activeElement.blur());
  await D.page.keyboard.press('Control+c');
  await D.page.keyboard.press('Control+v');
  await sleep(300);
  let wf = await wfOf(D);
  const added = wf.nodes.filter(n => !['n1', 'n2', 'n3', 'n4'].includes(n.id));
  check('Ctrl+C / Ctrl+V paste the blocks with new ids', added.length === 2 && added.map(n => n.type).sort().join() === 'fx.calc,fx.set', JSON.stringify(added.map(n => n.id)));
  const internal = wf.edges.filter(e => added.some(n => n.id === e.from) && added.some(n => n.id === e.to));
  check('the wire between them is pasted too, the wires to outside are not', internal.length === 1 && wf.edges.length === 5, JSON.stringify(wf.edges));
  check('the pasted blocks are selected', JSON.stringify((await selOf(D)).nodes.sort()) === JSON.stringify(added.map(n => n.id).sort()));
  await D.page.evaluate(() => PFB.select(['n4']));
  await D.page.evaluate(() => document.activeElement && document.activeElement.blur());
  await D.page.keyboard.press('Control+d');
  await sleep(200);
  wf = await wfOf(D);
  check('Ctrl+D duplicates the selected block', wf.nodes.filter(n => n.type === 'fx.calc').length === 3);
  await D.page.evaluate(() => PFB.select(['n1']));
  await D.page.keyboard.press('Control+d');
  await sleep(150);
  check('Start is not duplicated', (await wfOf(D)).nodes.filter(n => n.type === 'start').length === 1);
});

await test('rename in place', async () => {
  await loadWf(D, BASE);
  await D.page.dblclick('.react-flow__node[data-id="n3"] .pfb-n-title');
  await D.page.waitForSelector('.react-flow__node[data-id="n3"] .pfb-n-rename');
  await D.page.keyboard.press('Control+a');
  await D.page.keyboard.type('Generator A');
  await D.page.keyboard.press('Enter');
  await sleep(150);
  check('double-clicking a title renames the block', (await wfOf(D)).nodes.find(n => n.id === 'n3').label === 'Generator A' && (await D.page.textContent('.react-flow__node[data-id="n3"] .pfb-n-title')) === 'Generator A');
});

await test('canvas decorations', async () => {
  await loadWf(D, BASE);
  await settle(D, 250);
  const d = await D.page.evaluate(() => {
    const q = (id, sel) => { const n = document.querySelector(`.react-flow__node[data-id="${id}"] ${sel}`); return n ? n.textContent : null; };
    const node = (id) => document.querySelector(`.react-flow__node[data-id="${id}"] .pfb-node`);
    return {
      end: q('n4', '.pfb-end'), chip: q('n4', '.pfb-n-chip'), step: q('n3', '.pfb-n-step'),
      frame: (() => {
        const f = document.querySelector('.pfb-frame');
        if (!f) return null;
        const r = f.getBoundingClientRect(), holds = {};
        for (const id of ['n2', 'n3', 'n4']) {
          const b = document.querySelector(`.react-flow__node[data-id="${id}"]`).getBoundingClientRect();
          holds[id] = b.left >= r.left && b.top >= r.top && b.right <= r.right && b.bottom <= r.bottom;
        }
        return { tab: f.querySelector('.pfb-frame-tab').textContent, holds, n: document.querySelectorAll('.pfb-frame').length };
      })(),
      flowInHead: !!document.querySelector('.react-flow__node[data-id="n3"] .pfb-n-head .react-flow__handle.target[data-handleid="in"]'),
      flowOutLabel: q('n4', '.pfb-n-flabel'),
      tint: getComputedStyle(node('n3')).getPropertyValue('--cat').trim() === getComputedStyle(document.body).getPropertyValue('--cat-model').trim() &&
        getComputedStyle(node('n4')).getPropertyValue('--cat').trim() === getComputedStyle(document.body).getPropertyValue('--cat-study').trim() &&
        getComputedStyle(node('n3')).getPropertyValue('--cat').trim() !== getComputedStyle(node('n4')).getPropertyValue('--cat').trim(),
      todo: q('n1', '.pfb-n-badge'),
      unit: q('n3', '[data-handleid="value"] ~ .pfb-n-plab'),
      typeTip: (document.querySelector('.react-flow__node[data-id="n4"] .react-flow__handle[data-handleid="curve"]') || {}).getAttribute && document.querySelector('.react-flow__node[data-id="n4"] .react-flow__handle[data-handleid="curve"]').getAttribute('data-tip'),
      minimap: !!document.querySelector('.react-flow__minimap'),
      legend: document.querySelectorAll('#pfbLegendList li').length,
      noRfControls: !document.querySelector('.react-flow__controls'),
    };
  });
  check('an unwired flow output shows where the route goes', d.end === 'skips to the next pass of Dispatch (MW)', d.end);
  check('a loop\'s body is drawn in one frame named after the loop, the loop block outside it', d.frame && d.frame.n === 1 && /Each pass.*Dispatch \(MW\)/.test(d.frame.tab) && d.frame.holds.n3 && d.frame.holds.n4 && !d.frame.holds.n2, JSON.stringify(d.frame));
  check('a framed block needs no loop chip', d.chip === null, d.chip);
  check('the step number is shown', d.step === '3', d.step);
  check('the flow input sits in the header row', d.flowInHead);
  check('flow outputs carry their labels', d.flowOutLabel === 'Converged', d.flowOutLabel);
  check('blocks are tinted by category', d.tint === true, d.tint);
  check('a to-do shows on its block', /to do/i.test(d.todo || ''), d.todo);
  check('ports show label and unit', d.unit === 'Value (MW)', d.unit);
  check('hovering a port says its type in words', /Data type:<\/strong> Time series\. A curve over time/.test(d.typeTip || ''), d.typeTip);
  check('minimap and wire legend are there, no default controls', d.minimap && d.legend >= 13 && d.noRfControls, JSON.stringify(d));
  // An error: border, badge and the offending wire in the error colour
  const w = clone(BASE);
  w.edges.push({ id: 'e5', from: 'n4', out: 'ok', to: 'n3', in: 'nope' });
  await loadWf(D, w);
  await settle(D, 250);
  const e = await D.page.evaluate(() => ({
    border: document.querySelector('.react-flow__node[data-id="n3"] .pfb-node').classList.contains('pfb-lv-error'),
    badge: (document.querySelector('.react-flow__node[data-id="n3"] .pfb-n-badge') || {}).textContent,
    edge: document.querySelector('.react-flow__edge[data-id="e5"]').getAttribute('class'),
    stray: !!document.querySelector('.react-flow__node[data-id="n3"] .pfb-n-in.is-stray'),
  }));
  check('a block with an error has the error border and the ⚠ badge', e.border && e.badge === '⚠', JSON.stringify(e));
  check('the offending wire is drawn in the error colour, on a placeholder port', /pfb-e-err/.test(e.edge) && e.stray, JSON.stringify(e));
  // A note is a sticky note; a Missing block keeps its data
  const w2 = clone(BASE);
  w2.nodes.push({ id: 'n5', type: 'note', x: 656, y: 16, label: '', s: { text: 'Check G 02 first' } });
  w2.nodes.push({ id: 'n6', type: 'zz.unknown', x: 656, y: 272, label: 'Old block', s: { keep: 42 } });
  w2.edges.push({ id: 'e5', from: 'n4', out: 'ok', to: 'n6', in: 'in' });
  await loadWf(D, w2);
  const m = await D.page.evaluate(() => ({
    note: (document.querySelector('.react-flow__node[data-id="n5"] .pfb-note-text') || {}).textContent,
    missing: !!document.querySelector('.react-flow__node[data-id="n6"] .pfb-node.pfb-missing'),
    wire: !!document.querySelector('.react-flow__edge[data-id="e5"]'),
  }));
  check('a note is drawn as a sticky note', m.note === 'Check G 02 first', JSON.stringify(m));
  check('an unknown block shows as a Missing block with its wire', m.missing && m.wire, JSON.stringify(m));
  const saved = await D.page.evaluate(() => PFB.getWorkflow());
  const keep = saved.nodes.find(n => n.id === 'n6');
  check('a Missing block is saved back unchanged', keep && keep.type === 'zz.unknown' && keep.s.keep === 42 && saved.edges.some(x => x.id === 'e5'));
  await D.page.evaluate(() => PFB.select(['n6']));
  await sleep(120);
  check('the inspector says it is missing', /Missing block/.test(await D.page.textContent('#pfbInspector .pfb-insp-title')));
  // The frame follows a block while it is dragged
  await loadWf(D, BASE);
  const fw0 = await D.page.evaluate(() => document.querySelector('.pfb-frame').getBoundingClientRect().width);
  const hb = await D.page.locator('.react-flow__node[data-id="n4"] .pfb-n-head').boundingBox();
  await D.page.mouse.move(hb.x + 30, hb.y + hb.height / 2);
  await D.page.mouse.down();
  await D.page.mouse.move(hb.x + 230, hb.y + hb.height / 2, { steps: 8 });
  await sleep(120);
  const fw1 = await D.page.evaluate(() => document.querySelector('.pfb-frame').getBoundingClientRect().width);
  await D.page.mouse.up();
  await sleep(200);
  check('a loop frame grows with a body block while it is dragged', fw1 > fw0 + 150, fw0 + ' -> ' + fw1);
  // The frame hugs its blocks: three blocks in an L leave the L's empty corner outside it
  const wl = clone(BASE);
  wl.nodes.push({ id: 'n5', type: 'fx.set', x: 656, y: 272, label: '', s: { el: { cls: 'ElmSym', name: 'G 03', match: 'one' } } });
  wl.edges.push({ id: 'e5', from: 'n4', out: 'ok', to: 'n5', in: 'in' });
  await loadWf(D, wl);
  await settle(D, 250);
  const hug = await D.page.evaluate(() => {
    const path = document.querySelector('.pfb-frame path');
    const inFill = (x, y) => !!path && path.isPointInFill(new DOMPoint(x, y));
    return { corner: inFill(656 + 150, 40), n3: inFill(336 + 40, 16 + 30), n4: inFill(336 + 40, 272 + 30), n5: inFill(656 + 40, 272 + 30), tabs: document.querySelectorAll('.pfb-frame-tab').length };
  });
  check('a loop frame hugs its blocks (an L of blocks leaves its empty corner out)', !hug.corner && hug.n3 && hug.n4 && hug.n5 && hug.tabs === 1, JSON.stringify(hug));
});

await test('Python tab', async () => {
  await loadWf(D, BASE);
  await D.page.click('.ctrl-tab[data-tab="python"]');
  await sleep(250);
  const code = await D.page.textContent('#pfbCodeInner');
  check('the Python tab shows the script', /def main\(\):/.test(code) && /^# PFB1 /m.test(code) && /# -- Step 3: Set value/.test(code), code.slice(0, 200));
  check('the code view is plain text when highlight.js is not there', !(await D.page.evaluate(() => document.getElementById('pfbCodeInner').classList.contains('hljs'))));
  // live: a change shows up
  await D.page.evaluate(() => { const w = PFB.store.get().wf; PFB.store.commit({ ...w, name: 'Live check' }); });
  await sleep(400);
  check('the preview follows the workflow (debounced)', /# Live check/.test(await D.page.textContent('#pfbCodeInner')));
  // copy
  await clearToasts(D);
  await D.page.click('#pfbCopy');
  await sleep(200);
  const clip = await D.page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  check('⧉ copies the script to the clipboard', /def main\(\):/.test(clip) && (await toastTexts(D)).some(t => /Copied/.test(t)));
  // See its Python
  await D.page.click('.ctrl-tab[data-tab="settings"]');
  await D.page.evaluate(() => PFB.select(['n4']));
  await sleep(120);
  await D.page.click('#pfbInspector .pfb-see-py');
  await sleep(350);
  const mark = await D.page.evaluate(() => {
    const m = document.getElementById('pfbCodeMark');
    const wrap = document.getElementById('pfbCodeWrap');
    const g = PFB.store.get().gen;
    const r = m.getBoundingClientRect(), w = wrap.getBoundingClientRect();
    const lines = g.code.split('\n');
    const sp = g.spans.n4[0];
    return { hidden: m.hidden, inView: r.top >= w.top - 1 && r.top < w.bottom, tab: PFB.store.get().tab, first: lines[sp[0] - 1] };
  });
  check('"See its Python" opens the tab and marks the block\'s lines', !mark.hidden && mark.inView && mark.tab === 'python' && /Step 4: Run calculation/.test(mark.first), JSON.stringify(mark));
  await D.page.click('.ctrl-tab[data-tab="settings"]');
});

await test('Problems tab', async () => {
  await loadWf(D, BASE);
  await D.page.evaluate(() => PFB.select(['n3']));
  const badge = await D.page.textContent('#pfbProbCount');
  check('the Problems tab has a count badge', badge === '1', badge);
  await D.page.click('.ctrl-tab[data-tab="problems"]');
  await sleep(150);
  const items = await D.page.$$eval('#pfbProblems .pfb-prob', ns => ns.map(n => ({ cls: n.className, msg: n.querySelector('.pfb-prob-msg').textContent })));
  check('the to-do is listed', items.length === 1 && /pfb-lv-todo/.test(items[0].cls) && /Fill in Project on Start/.test(items[0].msg), JSON.stringify(items));
  await D.page.click('#pfbProblems .pfb-prob');
  await sleep(200);
  check('a problem click selects the block', JSON.stringify((await selOf(D)).nodes) === '["n1"]');
  const label = await D.page.textContent('#pfbDownload');
  check('the download button carries the count (errors + to-dos)', label.trim() === '⬇ Download .py (1 problem)', label);
  // A warning is counted apart, so the first badge always agrees with the Download label.
  const ww = clone(BASE);
  ww.nodes.push({ id: 'n9', type: 'fx.set', x: 700, y: 420, label: 'Stray', s: { el: { cls: 'ElmSym', name: 'G 03', match: 'one' } } });
  await loadWf(D, ww);
  await settle(D);
  const counts = await D.page.evaluate(() => {
    const w = document.getElementById('pfbWarnCount');
    return { fix: document.getElementById('pfbProbCount').textContent, warn: w.hidden ? '' : w.textContent, dl: document.getElementById('pfbDownload').textContent.trim(), levels: PFB.store.get().gen.problems.map(p => p.level) };
  });
  check('warnings have their own badge and the first badge agrees with Download', counts.fix === '1' && counts.warn === '1' && counts.dl === '⬇ Download .py (1 problem)', JSON.stringify(counts));
  // Fix buttons: remove a wire to a port that is gone, add Start
  const w = clone(BASE);
  w.edges.push({ id: 'e5', from: 'n4', out: 'ok', to: 'n3', in: 'nope' });
  await loadWf(D, w);
  await D.page.click('.ctrl-tab[data-tab="problems"]');
  await sleep(150);
  const fix = D.page.locator('#pfbProblems .pfb-prob-fix:has-text("Remove the wire")');
  check('a problem offers its fix as a button (with the bin)', await fix.count() === 1 && await fix.locator('svg.ico-trash').count() === 1);
  await fix.click();
  await sleep(200);
  check('the fix removes the wire', !(await wfOf(D)).edges.some(e => e.id === 'e5'));
  const w2 = clone(BASE);
  w2.nodes = w2.nodes.filter(n => n.id !== 'n1');
  w2.edges = w2.edges.filter(e => e.from !== 'n1');
  await loadWf(D, w2);
  await D.page.click('.ctrl-tab[data-tab="problems"]');
  await sleep(150);
  await D.page.click('#pfbProblems .pfb-prob-fix:has-text("Add Start")');
  await sleep(200);
  check('the Add Start fix adds Start', (await wfOf(D)).nodes.filter(n => n.type === 'start').length === 1);
  await D.page.click('.ctrl-tab[data-tab="settings"]');
});

await test('Save and Open (.json and .py)', async () => {
  const w = clone(BASE);
  w.name = 'Round trip';
  w.nodes[0].s = { project: 'Nine-bus System' };
  w.nodes[2].s = { el: { cls: 'ElmSym', name: 'G 02', match: 'one' }, attr: 'pgini' };
  w.nodes[2].pin = ['attr'];
  await loadWf(D, w);
  const before = await D.page.evaluate(() => PFB.getWorkflow());
  const [dl] = await Promise.all([D.page.waitForEvent('download'), D.page.click('#pfbSave')]);
  const jsonPath = join(TMP, dl.suggestedFilename());
  await dl.saveAs(jsonPath);
  const saved = JSON.parse(readFileSync(jsonPath, 'utf8'));
  check('Save writes the workflow as .json', dl.suggestedFilename() === 'round_trip.json' && saved.app === 'pf-builder' && saved.v === 1 && saved.nodes.length === 4, dl.suggestedFilename());
  // empty the canvas (Clear asks first), then Open the file
  D.dialogs.length = 0;
  await D.page.click('#pfbClear');
  await sleep(150);
  check('Clear asks first and leaves Start', D.dialogs.length === 1 && (await wfOf(D)).nodes.length === 1);
  await clearToasts(D);
  await D.page.setInputFiles('#pfbOpenInput', jsonPath);
  await D.page.waitForFunction(() => PFB.store.get().wf.nodes.length === 4);
  const after = await D.page.evaluate(() => PFB.getWorkflow());
  check('Open reads the .json back', JSON.stringify(after.nodes) === JSON.stringify(before.nodes) && JSON.stringify(after.edges) === JSON.stringify(before.edges) && after.name === 'Round trip');
  check('a toast says what was replaced, with Undo', (await toastTexts(D)).some(t => /Replaced/.test(t)) && await D.page.isVisible('.pfb-toast .pfb-toast-undo'));
  // .py: download, edit a SETTINGS line, open it
  await settle(D);
  D.dialogs.length = 0;
  const [dp] = await Promise.all([D.page.waitForEvent('download'), D.page.click('#pfbDownload')]);
  const pyPath = join(TMP, dp.suggestedFilename());
  await dp.saveAs(pyPath);
  const py = readFileSync(pyPath, 'utf8');
  check('Download .py writes the script with its # PFB1 line', dp.suggestedFilename() === 'round_trip.py' && /^# PFB1 \{/m.test(py) && D.dialogs.length === 0, dp.suggestedFilename());
  const edited = py.replace(/^PROJECT = "Nine-bus System"/m, 'PROJECT = "39 Bus New England System"');
  const pyPath2 = join(TMP, 'edited.py');
  writeFileSync(pyPath2, edited);
  await clearToasts(D);
  await D.page.click('#pfbClear');
  await sleep(100);
  await D.page.setInputFiles('#pfbOpenInput', pyPath2);
  await D.page.waitForFunction(() => PFB.store.get().wf.nodes.length === 4);
  const fromPy = await D.page.evaluate(() => PFB.getWorkflow());
  check('Open reads a .py made here back', JSON.stringify(fromPy.edges) === JSON.stringify(before.edges) && fromPy.nodes[2].pin.includes('attr'));
  check('and the SETTINGS values edited in the file', fromPy.nodes[0].s.project === '39 Bus New England System' && (await toastTexts(D)).some(t => /edited in the file: PROJECT/.test(t)), JSON.stringify(await toastTexts(D)));
  // A download with problems asks once
  await D.page.evaluate(() => { const w = PFB.store.get().wf; PFB.store.commit({ ...w, nodes: w.nodes.map(n => (n.type === 'start' ? { ...n, s: { ...n.s, project: '' } } : n)) }); });
  await settle(D);
  D.dialogs.length = 0;
  const [d3] = await Promise.all([D.page.waitForEvent('download'), D.page.click('#pfbDownload')]);
  check('a download with problems asks once ("The script will stop before connecting")', D.dialogs.length === 1 && /The script will stop before connecting until these are fixed/.test(D.dialogs[0]) && !!d3);
  await D.page.click('.ctrl-tab[data-tab="python"]');
  await Promise.all([D.page.waitForEvent('download'), D.page.click('#pfbDownload2')]);
  await D.page.click('.ctrl-tab[data-tab="settings"]');
  check('and not again for the same problems', D.dialogs.length === 1);
  // A file from another tool is refused, the canvas untouched
  const other = join(TMP, 'other.json');
  writeFileSync(other, JSON.stringify({ app: 'something-else', nodes: [] }));
  const n0 = (await wfOf(D)).nodes.length;
  await clearToasts(D);
  await D.page.setInputFiles('#pfbOpenInput', other);
  await sleep(300);
  check('a file from another tool is refused and the canvas kept', (await wfOf(D)).nodes.length === n0 && (await toastTexts(D)).some(t => /another tool/.test(t)));
});

await test('reload keeps the workflow (Persist)', async () => {
  const w = clone(BASE);
  w.name = 'Kept';
  await loadWf(D, w);
  await D.page.evaluate(() => PFB.select(['n3']));
  await sleep(100);
  await D.page.fill('#pfbInspector [data-key="attr"] input', 'ngnum');
  await D.page.locator('#pfbInspector [data-key="attr"] input').blur();
  await sleep(700);
  const before = await D.page.evaluate(() => PFB.getWorkflow());
  await gotoReady(D, true);
  await sleep(300);
  const after = await D.page.evaluate(() => PFB.getWorkflow());
  check('a reload brings the same workflow back', JSON.stringify(after.nodes) === JSON.stringify(before.nodes) && JSON.stringify(after.edges) === JSON.stringify(before.edges) && after.name === 'Kept');
  check('and the view', Math.abs(after.view.zoom - before.view.zoom) < 1e-6);
  const key = await D.page.evaluate(() => Object.keys(localStorage).find(k => k.startsWith('abt:save:powerfactory-scripter-builder:')));
  check('saved under the frozen Persist namespace', key === 'abt:save:powerfactory-scripter-builder:v1', key);
});

await test('theme toggle', async () => {
  await loadWf(D, BASE);
  const read = () => D.page.evaluate(() => {
    const cs = (sel, p) => { const n = document.querySelector(sel); return n ? getComputedStyle(n)[p] : ''; };
    const lum = (c) => {
      const m = c.match(/[\d.]+/g); if (!m) return 0;
      const [r, g, b] = m.slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const o = {
      light: document.body.classList.contains('light'),
      rf: document.querySelector('.pfb-flow .react-flow').className,
      body: cs('body', 'backgroundColor'), canvas: cs('.pfb-flow .react-flow', 'backgroundColor'),
      node: cs('.react-flow__node[data-id="n3"] .pfb-node', 'backgroundColor'), title: cs('.react-flow__node[data-id="n3"] .pfb-n-title', 'color'),
      palette: cs('.pfb-palette', 'backgroundColor'), palText: cs('.pfb-pal-title', 'color'),
      side: cs('.pfb-side', 'backgroundColor'), label: cs('#pfbInspector .field-label', 'color'),
      flow: cs('.react-flow__edge[data-id="e4"] .react-flow__edge-path', 'stroke'), data: cs('.react-flow__edge[data-id="e3"] .react-flow__edge-path', 'stroke'),
      btn: cs('#pfbDownload', 'backgroundColor'), btnText: cs('#pfbDownload', 'color'),
    };
    o.contrast = { node: ratio(o.title, o.node), pal: ratio(o.palText, o.palette), side: ratio(o.label, o.side), btn: ratio(o.btnText, o.btn), flow: ratio(o.flow, o.canvas) };
    return o;
  });
  const a = await read();
  await D.page.click('#themeToggle');
  await sleep(250);
  const b = await read();
  await D.page.click('#themeToggle');
  await sleep(150);
  const keys = ['body', 'canvas', 'node', 'title', 'palette', 'side', 'flow'];
  const clear = (o) => keys.every(k => o[k] && o[k] !== 'rgba(0, 0, 0, 0)' && o[k] !== 'transparent');
  check('the theme toggle switches the page and the canvas', a.light !== b.light && /\blight\b/.test(a.rf) !== /\blight\b/.test(b.rf), JSON.stringify([a.rf, b.rf]));
  check('colours change with the theme', keys.filter(k => a[k] !== b[k]).length >= 6, JSON.stringify(keys.map(k => [k, a[k], b[k]])));
  check('no colour is transparent in either theme', clear(a) && clear(b));
  const readable = (o) => o.contrast.node >= 4.5 && o.contrast.pal >= 4.5 && o.contrast.side >= 4.5 && o.contrast.btn >= 3 && o.contrast.flow >= 3;
  check('text and wires are readable in both themes (contrast)', readable(a) && readable(b), JSON.stringify([a.contrast, b.contrast]));
  check('the theme is kept in pf-theme, shared with the parent', await D.page.evaluate(() => localStorage.getItem('pf-theme')) === 'light');
});

await test('button pictures and field look in every panel state', async () => {
  const w = clone(BASE);
  w.nodes.push({ id: 'n5', type: 'fx.rows', x: 656, y: 16, label: '', s: {} });
  w.nodes.push({ id: 'n6', type: 'fx.code', x: 656, y: 272, label: '', s: {} });
  w.nodes.push({ id: 'n7', type: 'zz.unknown', x: 960, y: 16, label: '', s: {} });
  w.edges.push({ id: 'e5', from: 'n4', out: 'ok', to: 'n3', in: 'nope' });
  await loadWf(D, w);
  const states = [
    ['nothing selected', () => PFB.select([])],
    ['Set value', () => PFB.select(['n3'])],
    ['Add row (list)', () => PFB.select(['n5'])],
    ['Python code', () => PFB.select(['n6'])],
    ['Missing block', () => PFB.select(['n7'])],
    ['two blocks', () => PFB.select(['n3', 'n4'])],
    ['a wire', () => PFB.store.select([], ['e4'])],
    ['Problems', () => { PFB.select([]); PFB.openTab('problems'); }],
    ['Python', () => PFB.openTab('python')],
    ['a toast with Undo', () => { PFB.openTab('settings'); PFB.app.deleteNodes(['n6']); }],
  ];
  const bad = [], look = [];
  for (const theme of ['light', 'dark']) {
    await D.page.evaluate(t => { if (document.body.classList.contains('light') !== (t === 'light')) document.getElementById('themeToggle').click(); }, theme);
    for (const [name, fn] of states) {
      await D.page.evaluate(fn);
      await sleep(150);
      await D.page.evaluate(() => document.querySelectorAll('#pfbInspector .pfb-more-btn[aria-expanded="false"]').forEach(b => b.click()));
      await sleep(60);
      const v = await buttonVocabulary(D);
      bad.push(...v.bad.map(b => theme + ' ' + name + ': ' + b));
      const f = await fieldLook(D);
      look.push(...f.bad.map(b => theme + ' ' + name + ': ' + b));
    }
    await D.page.evaluate(() => { PFB.app.undo(); PFB.openTab('settings'); });
  }
  check('every button keeps the site\'s picture rules in every state (button-check rules)', bad.length === 0, bad.slice(0, 8).join(' | '));
  check('every select and combobox keeps the shared field look (dropdown-check rules)', look.length === 0, look.slice(0, 8).join(' | '));
  await D.page.evaluate(() => { if (!document.body.classList.contains('light')) document.getElementById('themeToggle').click(); });
});

await test('templates gallery', async () => {
  const T = await openPage({
    routes: [
      [ORIGIN + PAGE_PATH + 'templates/index.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ templates: [{ id: 'demo', title: 'Demo study', desc: 'A loop with a calculation.', file: 'demo.json' }, { id: 'Bad Id', title: 'x', file: '../x.json' }] }) })],
      [ORIGIN + PAGE_PATH + 'templates/demo.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...BASE, name: 'Demo study' }) })],
    ],
  });
  const btns = await T.page.$$eval('#pfbTemplates .quick-start-btn', ns => ns.map(n => [n.dataset.preset, n.textContent, n.getAttribute('data-tip')]));
  check('the Quick start popover lists the templates (bad entries left out)', JSON.stringify(btns) === JSON.stringify([['demo', 'Demo study', 'A loop with a calculation.']]), JSON.stringify(btns));
  check('the starter card offers them too', await T.page.isVisible('#pfbStarterBtns .pfb-starter-tpl'));
  await openQuickStart(T); await T.page.click('#pfbTemplates .quick-start-btn');
  await T.page.waitForFunction(() => PFB.store.get().wf.nodes.length === 4);
  check('a template loads (no question on an empty canvas)', T.dialogs.length === 0 && (await wfOf(T)).name === 'Demo study');
  check('its button is marked active', await T.page.evaluate(() => document.querySelector('#pfbTemplates .quick-start-btn').classList.contains('active')));
  await T.page.evaluate(() => PFB.select(['n3']));
  await sleep(100);
  await T.page.fill('#pfbInspector [data-key="attr"] input', 'changed');
  await T.page.locator('#pfbInspector [data-key="attr"] input').blur();
  await sleep(100);
  await openQuickStart(T); await T.page.click('#pfbTemplates .quick-start-btn');
  await sleep(400);
  check('it asks first when the canvas has unsaved work', T.dialogs.length === 1 && /Replace the workflow/.test(T.dialogs[0]), JSON.stringify(T.dialogs));
  await T.page.keyboard.press('Control+z');
  await sleep(150);
  check('a template load is one undo step', (await wfOf(T)).nodes.find(n => n.id === 'n3').s.attr === 'changed');
  await closePage(T, 'templates page');
});

await test('a block file that fails holds autosave', async () => {
  const F = await openPage({
    routes: [[ORIGIN + PAGE_PATH + 'js/blocks/model.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'throw new Error("broken on purpose");\n' })]],
    storage: { 'abt:save:powerfactory-scripter-builder:v1': JSON.stringify({ __fields: {}, __extra: { ...BASE, name: 'Cached' } }) },
  });
  // The thrown error in the module is the test's own doing: drop it from the error list.
  F.errors.splice(0, F.errors.length, ...F.errors.filter(e => !/broken on purpose/.test(e)));
  const info = await F.page.evaluate(() => ({ alert: document.getElementById('pfbAlert').textContent, vis: document.getElementById('pfbAlert').classList.contains('visible'), failed: PFB.failed, name: PFB.store.get().wf.name }));
  check('a failed category file shows a banner', info.vis && /Some blocks did not load/.test(info.alert) && info.failed.includes('model.js'), JSON.stringify(info));
  check('the cached workflow still opens', info.name === 'Cached');
  await F.page.evaluate(() => { const w = PFB.store.get().wf; PFB.store.commit({ ...w, name: 'Changed while broken' }); });
  await sleep(700);
  const raw = await F.page.evaluate(() => JSON.parse(localStorage.getItem('abt:save:powerfactory-scripter-builder:v1')));
  check('while a file failed, the mini cache is not overwritten', raw.__extra.name === 'Cached', raw.__extra && raw.__extra.name);
  await closePage(F, 'failed-file page');
});

await test('the canvas library missing: the rest still works', async () => {
  const G = await openPage({ goto: false, routes: [[ORIGIN + PAGE_PATH + 'vendor/xyflow-react.umd.js', r => r.fulfill({ status: 404, body: 'gone' })]] });
  await G.page.goto(URL);
  await G.page.waitForFunction(() => window.PFB && window.PFB.ready, null, { timeout: 15000 });
  await G.page.evaluate(() => PFB.runtimeReady);
  await G.page.waitForFunction(() => !!PFB.store.get().gen);
  G.errors.splice(0, G.errors.length, ...G.errors.filter(e => !/404|Failed to load resource/.test(e)));
  const info = await G.page.evaluate(() => ({ msg: !document.getElementById('pfbCanvasMsg').hidden, pal: document.querySelectorAll('.pfb-pal-item').length, code: PFB.store.get().gen.code.length }));
  check('without the canvas library the page says so, and the palette and Python work', info.msg && info.pal > 0 && info.code > 1000, JSON.stringify(info));
  await G.page.click('.pfb-pal-item[data-type="fx.log"]');
  await sleep(150);
  check('blocks can still be added', (await wfOf(G)).nodes.length === 2);
  await closePage(G, 'no-canvas page');
});

await test('tour', async () => {
  await loadWf(D, BASE);
  const before = await D.page.evaluate(() => PFB.getWorkflow());
  await D.page.evaluate(() => window.pfTour.start());
  await D.page.waitForSelector('.pf-tour-tooltip');
  let n = 0, titles = [];
  for (; n < 20; n++) {
    await sleep(1100);
    titles.push(await D.page.textContent('.pf-tour-tooltip .pf-tour-title'));
    const last = /Done/.test(await D.page.textContent('.pf-tour-tooltip .pf-tour-btn-primary'));
    await D.page.click('.pf-tour-tooltip .pf-tour-btn-primary');
    if (last) break;
  }
  await sleep(500);
  const after = await D.page.evaluate(() => PFB.getWorkflow());
  check('the tour runs to the end', !(await D.page.$('.pf-tour-tooltip')) && titles.length >= 8, JSON.stringify(titles));
  check('the reader\'s workflow comes back after the tour', JSON.stringify(after.nodes) === JSON.stringify(before.nodes) && JSON.stringify(after.edges) === JSON.stringify(before.edges));
  check('the tour has its seen key', await D.page.evaluate(() => localStorage.getItem('pf-builder-tour-v1-seen')) === '1');
});

if (process.env.PFB_UI_SHOTS) await D.page.screenshot({ path: join(TMP, 'desktop.png') });
await closePage(D, 'desktop page');

// =============================================================================================
// PASS 1b: fixture blocks, phone

console.log('Pass 1b: fixture blocks, 375 x 812');
await test('phone layout', async () => {
  const M = await openPage({ width: 375, height: 812 });
  await loadWf(M, BASE, { x: 8, y: 140, zoom: 0.8 });
  const info = await M.page.evaluate(() => {
    const vis = (id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; };
    const h = document.querySelector('.react-flow__handle.pfb-h-data');
    const after = h ? getComputedStyle(h, '::after') : null;
    return {
      noScroll: document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth,
      undo: vis('pfbUndo') && vis('pfbRedo'), dl: vis('pfbDownload'),
      palHidden: document.getElementById('pfbPalette').classList.contains('is-folded') && getComputedStyle(document.getElementById('pfbPalBody')).display === 'none',
      hit: after ? parseFloat(after.left) : 0, hw: h ? h.getBoundingClientRect().width / 0.8 : 0,
      tabs: vis('pfbSide'),
    };
  });
  check('no horizontal page scroll at 375 px', info.noScroll, JSON.stringify(info));
  check('↶ ↷ and Download stay in view', info.undo && info.dl, JSON.stringify(info));
  check('the Blocks panel starts folded on a phone', info.palHidden);
  check('handles have a 28 px hit area', Math.abs(info.hw - 2 * info.hit - 28) < 1.5, JSON.stringify(info));
  await M.page.click('#pfbPalToggle');
  await sleep(350);
  check('its chevron opens the Blocks panel', await M.page.evaluate(() => !document.getElementById('pfbPalette').classList.contains('is-folded')));
  check('a phone shows the block descriptions as a second line', await M.page.isVisible('.pfb-pal-item[data-type="fx.set"] .pfb-pal-desc'));
  await M.page.evaluate(() => PFB.select(['n4']));
  await M.page.click('.pfb-pal-item[data-type="fx.log"]');
  await sleep(400);
  const wf = await wfOf(M);
  const a = wf.nodes.find(n => n.type === 'fx.log');
  check('a tap on a block adds it wired, and folds the Blocks panel', a && edgeBetween(wf, 'n4', 'ok', a.id, 'in') && await M.page.evaluate(() => document.getElementById('pfbPalette').classList.contains('is-folded')));
  // (adding a block centred the view on it; bring Set value back and tap it)
  await M.page.evaluate(() => PFB.focusNode('n3'));
  await sleep(450);
  await M.page.evaluate(() => PFB.select([]));
  await M.page.click('.react-flow__node[data-id="n3"] .pfb-n-sum');
  await sleep(250);
  check('a toolbar sits over the selected block (Settings, duplicate, bin)', await M.page.isVisible('.pfb-ntb') && (await M.page.$$('.pfb-ntb button')).length === 3);
  await M.page.click('.pfb-ntb button:has-text("Settings")');
  await sleep(350);
  const sheet = await M.page.evaluate(() => ({ open: !document.getElementById('pfbSide').classList.contains('is-folded'), h: document.getElementById('pfbSide').getBoundingClientRect().height, title: (document.querySelector('#pfbInspector .pfb-insp-title') || {}).textContent }));
  check('Settings opens the inspector as a bottom sheet', sheet.open && sheet.h > 200 && sheet.title === 'Set value', JSON.stringify(sheet));
  const noScroll2 = await M.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  check('still no horizontal scroll with the sheet open', noScroll2);
  // connect by tapping two handles (connectOnClick)
  await M.page.click('#pfbSheetToggle');
  await sleep(300);
  await M.page.evaluate(() => { PFB.select([]); PFB.app.canvas.setViewport({ x: 8, y: 140, zoom: 0.5 }); });
  await sleep(250);
  const s1 = await handleAt(M, 'n4', 'slack', 'source');
  const t1 = await handleAt(M, a.id, 'a', 'target');
  await M.page.mouse.click(s1.x, s1.y);
  await sleep(120);
  await M.page.mouse.click(t1.x, t1.y);
  await sleep(250);
  check('tapping an output then an input wires them (connectOnClick)', !!edgeBetween(await wfOf(M), 'n4', 'slack', a.id, 'a'));
  if (process.env.PFB_UI_SHOTS) await M.page.screenshot({ path: join(TMP, 'phone.png') });
  await closePage(M, 'phone page');
});

// =============================================================================================
// PASS 2: the real block files

console.log('Pass 2: the real block files');
await test('real blocks smoke', async () => {
  const S = await openPage({ fixture: false });
  const info = await S.page.evaluate(() => ({
    failed: PFB.failed, n: PFB.registry.allBlocks().length, items: document.querySelectorAll('.pfb-pal-item').length,
    cats: [...document.querySelectorAll('.pfb-cat')].map(c => [c.dataset.cat, c.querySelectorAll('.pfb-pal-item').length]),
    regCats: [...new Set(PFB.registry.allBlocks().map(b => b.cat))],
  }));
  check('every real block file loads', info.failed.length === 0, JSON.stringify(info.failed));
  check('the palette lists every real block, categories with no blocks hidden', info.items === info.n && info.n > 30 && info.cats.length === info.regCats.length && info.cats.every(c => c[1] > 0), JSON.stringify(info.cats));
  const tips = await S.page.$$eval('.pfb-pal-item[data-tip]', ns => ns.filter(n => n.getAttribute('data-tip').length > 200).map(n => n.dataset.type));
  check('every palette tip is 200 characters at most', tips.length === 0, JSON.stringify(tips));
  // the built-in demo
  await S.page.evaluate(() => PFB.loadWorkflowObject(window.__PFB_DEMO, { quiet: true }));
  await S.page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length === window.__PFB_DEMO.nodes.length);
  await settle(S, 300);
  const d = await S.page.evaluate(() => ({
    missing: document.querySelectorAll('.pfb-missing').length, probs: PFB.store.get().gen.problems.map(p => p.level + ': ' + p.msg),
    code: PFB.store.get().gen.code, caption: (document.querySelector('.react-flow__node[data-id="n4"] .pfb-end') || {}).textContent,
  }));
  check('the tour demo loads with real blocks (no Missing block)', d.missing === 0, d.missing);
  check('the demo generates with only the project to fill in', d.probs.length === 1 && /todo: Fill in Project/.test(d.probs[0]) && /def main\(\):/.test(d.code), JSON.stringify(d.probs));
  check('the demo shows the "skips to the next pass" caption', d.caption === 'skips to the next pass of Dispatch (MW)', d.caption);
  // every block can be selected without an error and draws its inspector
  const all = await S.page.evaluate(async () => {
    const out = [];
    const types = PFB.registry.allBlocks().map(b => b.type).filter(t => t !== 'start');
    const wf = PFB.store.get().wf;
    let next = wf;
    let x = 0;
    for (const t of types) { const r = PFB.ops.addNode(next, t, 3000 + (x++ % 8) * 300, 1200 + Math.floor(x / 8) * 260); next = r.wf; }
    PFB.store.commit(next);
    await new Promise(r => setTimeout(r, 400));
    for (const n of PFB.store.get().wf.nodes) {
      PFB.select([n.id]);
      await new Promise(r => setTimeout(r, 15));
      const t = document.querySelector('#pfbInspector .pfb-insp-title');
      if (!t || !t.textContent) out.push(n.type);
    }
    return { bad: out, n: PFB.store.get().wf.nodes.length, ids: PFB.store.get().wf.nodes.map(n => n.id) };
  });
  check('every real block draws on the canvas and in the inspector', all.bad.length === 0, JSON.stringify(all.bad));
  const bad = [], look = [];
  for (const id of all.ids) {
    const type = await S.page.evaluate(i => { PFB.select([i]); return PFB.store.get().wf.nodes.find(n => n.id === i).type; }, id);
    await sleep(40);
    await S.page.evaluate(() => document.querySelectorAll('#pfbInspector .pfb-more-btn[aria-expanded="false"]').forEach(b => b.click()));
    await sleep(30);
    bad.push(...(await buttonVocabulary(S)).bad.map(b => type + ': ' + b));
    look.push(...(await fieldLook(S)).bad.map(b => type + ': ' + b));
  }
  check('every real block\'s inspector keeps the button picture rules', bad.length === 0, [...new Set(bad)].slice(0, 8).join(' | '));
  check('every real block\'s inspector keeps the shared field look', look.length === 0, [...new Set(look)].slice(0, 8).join(' | '));
  const tipsLong = await S.page.evaluate(async () => {
    const out = [];
    for (const n of PFB.store.get().wf.nodes) {
      PFB.select([n.id]);
      await new Promise(r => setTimeout(r, 10));
      document.querySelectorAll('#pfbInspector .pfb-more-btn[aria-expanded="false"]').forEach(b => b.click());
      await new Promise(r => setTimeout(r, 10));
      for (const t of document.querySelectorAll('#pfbInspector [data-tip], .react-flow__node [data-tip]')) {
        const d = document.createElement('div'); d.innerHTML = t.getAttribute('data-tip');
        const len = d.textContent.length;
        if (!len || len > 200 || /—/.test(d.textContent)) out.push(n.type + ' ' + len + ' ' + d.textContent.slice(0, 50));
      }
    }
    return [...new Set(out)];
  });
  check('every tip of every real block is 1 to 200 characters with no em-dash', tipsLong.length === 0, tipsLong.slice(0, 8).join(' | '));
  // a real Record row: the variable column, the element picker of a real step
  await S.page.evaluate(() => PFB.select(['n3']));
  await sleep(150);
  const ep = await S.page.$$eval('#pfbInspector [data-port="gen"] select.pfb-el-cls option', ns => ns.map(o => o.textContent));
  check('the real dispatch block offers generator classes, plain names first', ep[0] === 'Synchronous generator (ElmSym)', JSON.stringify(ep));
  // previews: what a graph or table block makes, in the reader's names, with the loop's values
  await S.page.evaluate(() => PFB.loadTemplate('headroom', { quiet: true }));
  await S.page.waitForFunction(() => !!document.querySelector('.react-flow__node[data-id="n15"] .pfb-pv'), null, { timeout: 5000 });
  await settle(S, 300);
  const pv = await S.page.evaluate(() => {
    const q = (id) => document.querySelector(`.react-flow__node[data-id="${id}"] .pfb-pv`);
    const own = (el) => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('');
    const t = q('n14'), g = q('n15');
    return {
      file: t && t.querySelector('.pfb-pv-file').textContent,
      heads: t ? [...t.querySelectorAll('th')].map(th => th.textContent) : [],
      loopVals: t ? [...t.querySelectorAll('td.is-loop')].map(td => td.textContent) : [],
      graph: g ? [...g.querySelectorAll('text')].map(own) : [],
      none: !q('n6'),
    };
  });
  check('a table block previews its file, its columns and the loop\'s first values', pv.file === 'Headroom.csv' && pv.heads[0] === 'Dispatch (MW)' && pv.heads.includes('Nadir (Hz)') && pv.loopVals.join() === '100,150,200', JSON.stringify(pv));
  check('a graph block previews its axes in the reader\'s words; a load flow has no preview', pv.graph.includes('Dispatch (MW)') && pv.graph.includes('Nadir (Hz)') && pv.none, JSON.stringify(pv.graph));
  // the tour with the real demo
  await S.page.evaluate(() => PFB.loadWorkflowObject({ app: 'pf-builder', v: 1, name: 'Mine', nodes: [{ id: 'n1', type: 'start', x: 0, y: 0, s: { project: 'P' } }], edges: [] }, { quiet: true }));
  await sleep(300);
  await S.page.evaluate(() => window.pfTour.start());
  await S.page.waitForSelector('.pf-tour-tooltip');
  let titles = [], demoSeen = false;
  for (let i = 0; i < 20; i++) {
    await sleep(1100);
    titles.push(await S.page.textContent('.pf-tour-tooltip .pf-tour-title'));
    if (await S.page.evaluate(() => PFB.store.get().wf.nodes.some(n => n.type === 'pf.rms'))) demoSeen = true;
    const last = /Done/.test(await S.page.textContent('.pf-tour-tooltip .pf-tour-btn-primary'));
    await S.page.click('.pf-tour-tooltip .pf-tour-btn-primary');
    if (last) break;
  }
  await sleep(500);
  const back = await wfOf(S);
  check('the tour loads the demo and gives the reader\'s workflow back', demoSeen && back.name === 'Mine' && back.nodes.length === 1, JSON.stringify(titles));
  await closePage(S, 'real-blocks page');
});

await test('real blocks, phone', async () => {
  const S = await openPage({ fixture: false, width: 375, height: 812, theme: 'dark' });
  await S.page.evaluate(() => PFB.loadWorkflowObject(window.__PFB_DEMO, { quiet: true }));
  await sleep(600);
  check('no horizontal page scroll at 375 px with the real demo', await S.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  if (process.env.PFB_UI_SHOTS) await S.page.screenshot({ path: join(TMP, 'phone-real.png') });
  await closePage(S, 'real-blocks phone page');
});

// =============================================================================================

await browser.close();
server.close();
if (!process.env.PFB_UI_SHOTS) { try { rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* fine */ } }
else console.log('screenshots in ' + TMP);
console.log(`ui tests: ${passed} passed, ${failed} failed`);
if (failed) console.log('failed: ' + failures.join(' / '));
process.exit(failed ? 1 : 0);
