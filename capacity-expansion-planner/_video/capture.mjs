// Capacity Expansion Planner explainer video: capture step.
//
//   node capacity-expansion-planner/_video/capture.mjs
//
// Serves the site, solves the Growing grid Quick Start in the real tool, and
// writes what the storyboard (story.html) draws from:
//   data.js   the solved plan: capacity, builds and hourly dispatch by year
//   boxes.js  where the page's cards and buttons sit, for the highlights
//   shots/    the inputs panel on each tab, and the page at four scroll stops
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import http from 'http';
import fs from 'fs';
import path from 'path';

const HERE = path.dirname(new URL(import.meta.url).pathname), ROOT = path.resolve(HERE, '../..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const PAGE = `http://localhost:${server.address().port}/capacity-expansion-planner/`;

const b = await pw.chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
await p.goto(PAGE, { waitUntil: 'networkidle' });
await p.evaluate(() => { try { localStorage.setItem('capacityexpansion-planner-tour-v2-seen', '1'); } catch (e) {} });
await p.reload({ waitUntil: 'networkidle' });
await p.click('.ctrl-fold-rail'); await p.waitForTimeout(600);
await p.click('[data-preset="grow"]');
await p.waitForFunction(() => window.CXApp && CXApp.res && CXApp.res.report && CXApp.res.report.ok, null, { timeout: 120000 });
await p.mouse.move(1590, 890); await p.waitForTimeout(1500);

// The solved plan, rounded to a tenth of a MW.
const D = await p.evaluate(() => {
  const r = CXApp.res, m = CXApp.model, r1 = a => Array.from(a).map(v => Math.round(v * 10) / 10);
  return {
    periods: r.periods, peak: r1(r.totals.peak), cols: m.tech.map((e, i) => CXCharts.colour(i)),
    blocks: r.blocks.map(x => ({ name: x.name, from: x.from, len: x.len, days: x.days })),
    load: r.load.map(r1),
    tech: m.tech.map(e => { const t = r.tech[e.id]; return { id: e.id, name: CX.nameOf(e), cap: r1(t.cap), exist: r1(t.exist), built: r1(t.built), p: t.p.map(r1) }; })
  };
});
fs.writeFileSync(path.join(HERE, 'data.js'), 'window.D=' + JSON.stringify(D) + ';\n');

for (const tab of ['plan', 'tech', 'policy', 'assume']) {
  await p.click(`.ctrl-tab[data-tab="${tab}"]`); await p.waitForTimeout(500);
  await p.mouse.move(1590, 890); await p.waitForTimeout(300);
  await p.locator('#ctrlCard').screenshot({ path: path.join(HERE, `shots/ctrl-${tab}.png`) });
}
await p.click('.ctrl-tab[data-tab="plan"]');

// Open 2046's typical days, then the page at four scroll stops.
const cb = await p.locator('#capCard canvas').first().boundingBox();
await p.mouse.click(cb.x + cb.width * 0.88, cb.y + cb.height * 0.5);
await p.waitForTimeout(1500);
const sels = { grow: '[data-preset="grow"]', run: '#runBtn', verdict: '#verdict', capCard: '#capCard', dayCard: '#dayCard', costCard: '#costCard', tablesCard: '#tablesCard' };
const boxes = {};
for (const [name, id] of Object.entries({ v0: null, v1: 'capCard', v2: 'dayCard', v3: 'costCard' })) {
  await p.evaluate(id => { if (!id) return scrollTo(0, 0); scrollTo(0, document.getElementById(id).getBoundingClientRect().top + scrollY - 24); }, id);
  await p.mouse.move(1590, 890); await p.waitForTimeout(900);
  await p.screenshot({ path: path.join(HERE, `shots/${name}.png`) });
  boxes[name] = await p.evaluate(s => Object.fromEntries(Object.entries(s).map(([k, q]) => { const r = document.querySelector(q).getBoundingClientRect(); return [k, [r.x, r.y, r.width, r.height].map(Math.round)]; })), sels);
}
fs.writeFileSync(path.join(HERE, 'boxes.js'), 'window.BOXES=' + JSON.stringify(boxes) + ';\n');
await b.close(); server.close();
console.log('captured', D.periods.join(', '), 'from', PAGE);
