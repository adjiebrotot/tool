/* A guide's live demos still play.
   ---------------------------------------------------------------------------
   A guide with live demos (<tool>/guides/scenes.js, played by guide-live.js)
   is a script against the tool as it is today, so a change to the tool can
   break a step without anything looking wrong in the tool itself: a renamed
   id, a moved button, a field that now needs a click first. This plays every
   scene of every such guide, in both themes, on the guide page as a reader
   gets it, and fails when one of them:

     A. stops on a step (a part it points at is gone, a wait never ends),
     B. names a different number of moments (S.mark) than its demo lists steps,
     C. throws in the tool, or opens without demo mode (guide-demo.js: storage
        of its own, no analytics),
     D. fetches the solver (a run it starts was not solved ahead: run
        node _ref/presolve.mjs), or
     E. changes the reader's own storage on the guide page.

   The screen's still scene must outline every part it names.

   Run: node _ref/guide-check.mjs [tool ...]   (REAL=1: at a reader's pace, not at once)
*/
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { createServer } from 'node:http';
import { existsSync, readdirSync, statSync, createReadStream } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const TOOLS = args.length ? args : readdirSync(ROOT).filter(d => existsSync(join(ROOT, d, 'guides', 'scenes.js')));
const FAST = !process.env.REAL;
// What a browser says about its own work, not about the tool.
const BENIGN = /ResizeObserver loop/;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const server = createServer((req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  let f = join(ROOT, p);
  if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); res.end(); return; }
  if (statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' });
  createReadStream(f).pipe(res);
}).listen(0);
const base = 'http://127.0.0.1:' + server.address().port + '/';

const browser = await chromium.launch();
let failed = 0, passed = 0;
const fail = (msg) => { console.log('FAIL ' + msg); failed++; };

for (const tool of TOOLS) {
  if (!existsSync(join(ROOT, tool, 'guides', 'scenes.js'))) { fail(tool + ': no guides/scenes.js'); continue; }
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    // The libraries from cdnjs load as for a reader; analytics and the rest of the web do not.
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => /cdnjs\.cloudflare\.com/.test(r.request().url()) ? r.continue() : r.abort());
    await ctx.addInitScript(t => {
      window.GuideLiveManual = true;
      if (window.top === window) try { localStorage.setItem('abt-theme', t); localStorage.setItem('abt-consent', 'denied'); } catch (e) {}
    }, theme);
    const page = await ctx.newPage();
    const solver = [];
    page.on('request', r => { if (/highs\.wasm/.test(r.url())) solver.push(r.frame().name() || r.url()); });
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.goto(base + tool + '/guides/');
    const scenes = await page.evaluate(() => GuideLive.ready.then(() => GuideLive.scenes.SCENES.map(s => ({ name: s.name, still: !!s.still }))));
    const onPage = await page.evaluate(() => GuideLive.demos.map(d => d.name));
    for (const n of onPage) if (!scenes.some(s => s.name === n)) fail(`${tool} (${theme}): the page has a demo "${n}" with no scene`);
    const before = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));

    for (const sc of scenes) {
      const label = `${tool} ${sc.name} (${theme})`;
      if (!onPage.includes(sc.name)) { fail(label + ': no demo on the page plays it'); continue; }
      const n0 = solver.length;
      const r = await page.evaluate(([n, fast]) => GuideLive.run(n, { fast, keep: true }), [sc.name, FAST]);
      const frame = page.frames().find(f => f !== page.mainFrame() && /[?&]demo(&|$)/.test(f.url()));
      const demo = frame ? await frame.evaluate(() => ({ demo: !!window.ABT_DEMO, store: !!(localStorage && localStorage.__demo), ga: !!window['ga-disable-G-VYTV157ST0'] })) : null;
      const boxes = sc.still ? await page.evaluate(n => [...document.querySelectorAll(`.gd-shot-frame[data-shot="${n}"] .gd-box`)]
        .map(b => b.getBoundingClientRect()).filter(b => b.width < 4 || b.height < 4).length, sc.name) : 0;
      await page.evaluate(n => GuideLive.demos.find(d => d.name === n).stop(), sc.name);

      const bad = [];
      if (r.error) bad.push('stopped: ' + r.error);
      if (!sc.still && !r.error && r.marks.length !== r.steps) bad.push(`${r.marks.length} moments (S.mark) for ${r.steps} steps in its list`);
      const errs = (r.errors || []).filter(e => !BENIGN.test(e));
      if (errs.length) bad.push('the tool threw: ' + errs.slice(0, 3).join(' | '));
      if (!demo || !demo.demo || !demo.store || !demo.ga) bad.push('the tool did not open in demo mode (guide-demo.js in its <head>)');
      if (solver.length > n0) bad.push('fetched the solver (run node _ref/presolve.mjs)');
      if (boxes) bad.push(boxes + ' part(s) of the screen not outlined');
      if (bad.length) fail(label + ': ' + bad.join('; '));
      else { passed++; console.log(`PASS ${label}` + (sc.still ? '' : `: ${r.marks.length} steps, ${(r.ms / 1000).toFixed(1)} s`)); }
    }

    const after = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));
    if (after !== before) fail(`${tool} (${theme}): the demos changed the reader's own storage`);
    const thrown = pageErrors.filter(e => !BENIGN.test(e));
    if (thrown.length) fail(`${tool} (${theme}): the guide page threw: ${thrown.slice(0, 3).join(' | ')}`);
    await ctx.close();
  }
}
await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
