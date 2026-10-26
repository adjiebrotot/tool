/* Quick Starts solved ahead of time, for the optimiser tools.
   ---------------------------------------------------------------------------
   The Capacity Expansion Planner and the ED/UC Simulator solve with HiGHS in
   the browser, which takes seconds on a phone. solve-cache.js lets them open
   a result solved before instead, when it was solved for the very key on
   screen and by the very solver the tool ships. This writes those results for
   the first visit and every Quick Start, into <tool>/presolved/:

     index.json        { rev, files: { <hash of the key>: "<name>.json" } }
     <name>.json       { rev, key, res }

   rev is a hash of the files that compute a result (REV below). Change one of
   them and every kept result, shipped or in a reader's browser, stops being
   used until this is run again: the tools then solve as they always did, so
   a stale rev costs speed, never a wrong answer. Each page is solved for real
   here (its presolved/ folder hidden from it), in Chromium, so the key and the
   result are exactly what a reader's browser makes.

   A tool whose guide plays live demos (<tool>/guides/scenes.js, guide-live.js)
   gets what those demos run solved too, as guide-<scene>.json: every scene is
   played on the guide page and each solve it waits for (S.note('solved')) is
   kept, so a demo never fetches the solver. Run this again after changing a
   scene that solves.

   Run:  node _ref/presolve.mjs           write them (ONLY=ed-uc-simulator: one tool)
         node _ref/presolve.mjs --check   fail if a tool's solver changed since
*/
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, statSync, createReadStream } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE = ['ed-uc-simulator/engine/psa-opt.min.js', 'ed-uc-simulator/engine/highs.mjs', 'ed-uc-simulator/engine/highs.wasm'];
const TOOLS = {
  'capacity-expansion-planner': { app: '__cx', rev: ['capacity-expansion-planner/cx-core.js', 'capacity-expansion-planner/cx-worker.js', ...ENGINE] },
  'ed-uc-simulator': { app: '__ed', rev: ['ed-uc-simulator/ed-core.js', 'ed-uc-simulator/ed-worker.js', ...ENGINE] },
};
const only = process.env.ONLY ? process.env.ONLY.split(',') : Object.keys(TOOLS);
const CHECK = process.argv.includes('--check');

function revOf(tool) {
  const h = createHash('sha256');
  for (const f of TOOLS[tool].rev) { h.update(f + '\0'); h.update(readFileSync(join(ROOT, f))); }
  return h.digest('hex').slice(0, 16);
}

if (CHECK) {
  let bad = 0;
  for (const tool of only) {
    const ixPath = join(ROOT, tool, 'presolved', 'index.json');
    const ix = existsSync(ixPath) ? JSON.parse(readFileSync(ixPath, 'utf8')) : null;
    const rev = revOf(tool);
    const missing = ix ? Object.values(ix.files).filter(f => !existsSync(join(ROOT, tool, 'presolved', f))) : [];
    const stale = ix ? Object.values(ix.files).filter(f => !missing.includes(f) && JSON.parse(readFileSync(join(ROOT, tool, 'presolved', f), 'utf8')).rev !== ix.rev) : [];
    const ok = ix && ix.rev === rev && !missing.length && !stale.length;
    console.log((ok ? 'PASS ' : 'FAIL ') + tool + (ok ? ' (' + Object.keys(ix.files).length + ' results, rev ' + rev + ')'
      : !ix ? ': no presolved/index.json' : ix.rev !== rev ? ': the solver changed since its results were solved (run node _ref/presolve.mjs)'
      : ': ' + missing.concat(stale).join(', ') + ' missing or from another rev'));
    if (!ok) bad++;
  }
  process.exit(bad ? 1 : 0);
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const server = createServer((req, res) => {
  let p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  let f = join(ROOT, p);
  if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); res.end(); return; }
  if (statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' });
  createReadStream(f).pipe(res);
}).listen(0);
const base = 'http://127.0.0.1:' + server.address().port + '/';

const browser = await chromium.launch();
let failed = 0;
for (const tool of only) {
  const { app } = TOOLS[tool];
  const rev = revOf(tool);
  const presets = await (async () => {
    const page = await browser.newPage();
    await page.goto(base + tool + '/');
    const keys = await page.evaluate(a => Object.keys((window[a].CX || window[a].ED).PRESETS), app);
    await page.close();
    return keys;
  })();
  const out = new Map();  // hash -> { name, key, res }
  for (const name of ['start', ...presets]) {
    // A fresh context each time: no mini cache, no kept results.
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.route('**/presolved/**', r => r.fulfill({ status: 404, body: '' }));
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('  page error: ' + e.message));
    await page.goto(base + tool + '/');
    const settled = a => { const x = window[a]; return x && x.app.res && x.app.solvedKey === x.solveKey(); };
    await page.waitForFunction(settled, app, { timeout: 180000 });
    if (name !== 'start') {
      await page.evaluate(([a, k]) => window[a].applyPreset(k), [app, name]);
      await page.waitForFunction(settled, app, { timeout: 180000 });
    }
    const got = await page.evaluate(a => {
      const x = window[a], key = x.solveKey();
      return { key, hash: SolveCache.hash(key), ok: !!(x.app.res.report && x.app.res.report.ok), res: SolveCache.encode(x.app.res) };
    }, app);
    await ctx.close();
    if (!got.ok) { console.log('FAIL ' + tool + ' ' + name + ': did not solve'); failed++; continue; }
    // The first visit opens on the default Quick Start: kept under its name.
    if (out.has(got.hash)) { const was = out.get(got.hash); console.log('     ' + tool + ' ' + name + ': same plan as ' + was.name); if (was.name === 'start') was.name = name; continue; }
    out.set(got.hash, { name, key: got.key, res: got.res });
    console.log('PASS ' + tool + ' ' + name + ' (' + Math.round(got.res.length / 1024) + ' KB)');
  }
  // What the guide's live demos run: each scene played on the guide page, and every solve it
  // waits for kept under the scene's name (the Quick Starts it loads are kept already).
  if (existsSync(join(ROOT, tool, 'guides', 'scenes.js'))) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.route('**/presolved/**', r => r.fulfill({ status: 404, body: '' }));
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => /cdnjs\.cloudflare\.com/.test(r.request().url()) ? r.continue() : r.abort());
    await ctx.addInitScript(() => { window.GuideLiveManual = true; });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('  page error: ' + e.message));
    const got = [];
    await page.exposeFunction('__presolveKeep', (scene, x) => { got.push({ scene, ...x }); });
    await page.goto(base + tool + '/guides/');
    const scenes = await page.evaluate(() => GuideLive.ready.then(() => GuideLive.scenes.SCENES.filter(s => !s.still).map(s => s.name)));
    await page.evaluate(a => {
      GuideLive.onNote = (tag, win, scene) => {
        if (tag !== 'solved') return;
        const x = win[a], key = x.solveKey();
        return window.__presolveKeep(scene, { key, hash: win.SolveCache.hash(key), ok: !!(x.app.res.report && x.app.res.report.ok), res: win.SolveCache.encode(x.app.res) });
      };
    }, app);
    for (const name of scenes) {
      const r = await page.evaluate(n => GuideLive.run(n), name);
      if (r.error) { console.log('FAIL ' + tool + ' guide ' + name + ': ' + r.error); failed++; }
    }
    await ctx.close();
    const count = {};
    for (const g of got) {
      if (!g.ok) { console.log('FAIL ' + tool + ' guide ' + g.scene + ': did not solve'); failed++; continue; }
      if (out.has(g.hash)) continue;
      count[g.scene] = (count[g.scene] || 0) + 1;
      const name = 'guide-' + g.scene + (count[g.scene] > 1 ? '-' + count[g.scene] : '');
      out.set(g.hash, { name, key: g.key, res: g.res });
      console.log('PASS ' + tool + ' ' + name + ' (' + Math.round(g.res.length / 1024) + ' KB)');
    }
  }
  const dir = join(ROOT, tool, 'presolved');
  mkdirSync(dir, { recursive: true });
  const files = {};
  for (const [hash, x] of out) {
    const f = join(dir, x.name + '.json');
    // The same solver on the same key gives the same result (all but the time
    // it took), so a file already holding it is left as it is.
    const old = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
    // The result is kept as the page wrote it (its NaN and Infinity encoded), spliced in.
    if (!old || old.rev !== rev || old.key !== x.key)
      writeFileSync(f, '{"rev":' + JSON.stringify(rev) + ',"key":' + JSON.stringify(x.key) + ',"res":' + x.res + '}\n');
    files[hash] = x.name + '.json';
  }
  for (const f of readdirSync(dir)) if (f.endsWith('.json') && f !== 'index.json' && !Object.values(files).includes(f)) unlinkSync(join(dir, f));
  writeFileSync(join(dir, 'index.json'), JSON.stringify({ rev, files }, null, 2) + '\n');
}
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
