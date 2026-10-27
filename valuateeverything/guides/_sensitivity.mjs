/* The Valuate Everything guide's sensitivity chart (the tornado in "How the numbers work"),
   measured on the tool's own engine: the page opens in headless Chromium, the Camry Hybrid
   Quick Start is loaded with the current year pinned to 2026 (the year its listings were
   gathered), and each input is moved down and up by one step while the rest stay put. The
   figures come from the page's own compute() (window.__VE), so they are what the tool would
   show for the same form after Valuate.

   The headline is the fair price of the first car to check, the 2021 Ascent Sport with
   52,771 km (its asking price is $32,369). Two last blocks: the same listings a year on (the
   current year follows the calendar), and inflation on the Perth house, whose sales run from
   2023, as every Camry listing is from 2026 and inflation moves nothing there.

   Run: node valuateeverything/guides/_sensitivity.mjs   (prints the rows, largest swing first,
   with the --lo / --hi the guide's .gd-tornado rows take) */
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import { createServer } from 'node:http';
import { existsSync, statSync, createReadStream } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
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

const browser = await pw.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
// Nothing from the web is needed: the engine runs without the chart and equation libraries.
await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
await ctx.addInitScript(() => { try { localStorage.setItem('abt-consent', 'denied'); } catch (e) {} });
const page = await ctx.newPage();
await page.goto(base + 'valuateeverything/');
await page.waitForFunction(() => window.__VE);

const out = await page.evaluate(() => {
  const V = window.__VE, $ = (id) => document.getElementById(id);
  // A step is a change to the form (fields) and/or to the saved state (the listings and items).
  const run = (preset, step, pick) => {
    V.applyQuickStart(preset);
    $('curYear').value = '2026';
    if (step) step(V.state);
    const r = V.compute();
    if (r.error) return { error: r.error };
    return pick(r);
  };
  const camry = (r) => ({ fair: r.items[0].fair, gap: r.items[0].gap, r2: r.model.r2, rmse: r.model.rmse });
  const field = (id, v) => () => { $(id).value = v; };
  const item = (col, v) => (S) => { S.items[0].vals[col] = v; };
  const both = (...fs) => (S) => fs.forEach(f => f(S));

  const base = run('camry', null, camry);
  // One listing left out at a time: the largest fall and the largest rise in the fair price.
  const n = V.PRESETS.camry.rows.length, loo = [];
  for (let i = 0; i < n; i++) loo.push({ row: i + 1, ...run('camry', (S) => { S.rows.splice(i, 1); }, camry) });
  loo.sort((a, b) => a.fair - b.fair);

  const STEPS = [
    { name: 'Age', step: '5 yrs → 4 / 6 (Year 2022 / 2020)', lo: item('c2', '2022'), hi: item('c2', '2020') },
    { name: 'Odometer', step: '52,771 km → 42,771 / 62,771', lo: item('c3', '42771'), hi: item('c3', '62771') },
    { name: 'Above Ascent grade', step: 'Yes → No (cannot go higher)', lo: item('c4', false), hi: null },
    { name: 'Modelling approach', step: 'Linear → Log-linear / Quadratic terms', lo: field('model', 'log'), hi: field('model', 'quadratic') },
    { name: 'Ridge penalty (λ)', step: 'Linear (λ 0) → Ridge at λ 0.1 / 1.0', lo: both(field('model', 'ridge'), field('lambda', '0.1')), hi: both(field('model', 'ridge'), field('lambda', '1')) },
    { name: 'Inflation', step: '3% → 2% / 4% a year (every listing is from 2026)', lo: field('inflation', '2'), hi: field('inflation', '4') },
  ];
  const rows = STEPS.map(s => {
    const go = (f) => f ? run('camry', f, camry) : null;
    const lo = go(s.lo), hi = go(s.hi);
    return { name: s.name, step: s.step, lo: lo ? lo.fair - base.fair : null, hi: hi ? hi.fair - base.fair : null, loT: lo, hiT: hi };
  });
  // Not a row of the chart: the same listings a year on (the current year follows the calendar).
  // A step runs after the pin, so it wins. 2025 would drop every listing (seen after the current year).
  const yearOn = run('camry', field('curYear', '2027'), camry);
  rows.push({ name: 'One listing left out', step: `each of the ${n} in turn: the largest fall / rise (rows ${loo[0].row} / ${loo[n - 1].row})`,
    lo: loo[0].fair - base.fair, hi: loo[n - 1].fair - base.fair, loT: loo[0], hiT: loo[n - 1] });

  // Inflation where it matters: the Perth house, sales from 2023 to 2026.
  const house = (r) => ({ r2: r.model.r2, rmse: r.model.rmse, items: r.items.map(it => ({ name: it.name, fair: it.fair, gap: it.gap, gapPct: it.gapPct })) });
  const inflations = ['0', '2', '3', '4', '6', '10'].map(i => ({ i, ...run('house', field('inflation', i), house) }));
  V.applyQuickStart('camry');
  return { base, rows, yearOn, house: inflations };
});
await browser.close();
server.close();

const $ = v => '$' + Math.round(v).toLocaleString('en-AU');
const d = v => v == null ? 'none' : (Math.abs(v) < 0.5 ? '$0' : (v < 0 ? '−' : '+') + '$' + Math.round(Math.abs(v)).toLocaleString('en-AU'));
const size = r => Math.max(Math.abs(r.lo || 0), Math.abs(r.hi || 0));
const rows = out.rows.sort((a, b) => size(b) - size(a));
const top = Math.max(...rows.map(size));
console.log(`Base case: Camry Hybrid, Linear regression, current year 2026. 2021 Ascent Sport, 52,771 km: fair price ${$(out.base.fair)}, asking $32,369, gap ${d(out.base.gap)} (R² ${out.base.r2.toFixed(2)}, typical error ±${$(out.base.rmse)}).\n`);
for (const r of rows) {
  const t = x => x ? `(fair ${$(x.fair)}, gap ${d(x.gap)})` : '';
  console.log(`${r.name.padEnd(22)} ${r.step.padEnd(70)} lowered ${d(r.lo).padStart(8)}  raised ${d(r.hi).padStart(8)}` +
    `   --lo:${((r.lo || 0) / top).toFixed(2)};--hi:${((r.hi || 0) / top).toFixed(2)}\n      lowered ${t(r.loT)}\n      raised  ${t(r.hiT)}`);
}
console.log(`\nNot in the chart: the same listings a year on, current year 2027: fair ${$(out.yearOn.fair)} (${d(out.yearOn.fair - out.base.fair)}).`);
console.log('\nPerth house, Linear regression, current year 2026, by inflation:');
const h3 = out.house.find(h => h.i === '3');
for (const h of out.house) {
  console.log(`  ${(h.i + '%').padStart(4)}  R² ${h.r2.toFixed(2)}, typical error ±${$(h.rmse)}  ` + h.items.map((it, k) =>
    `${it.name.split(',')[0]} ${$(it.fair)} (${d(it.fair - h3.items[k].fair)} on 3%; gap ${d(it.gap)}, ${(it.gapPct * 100).toFixed(1)}%)`).join('  '));
}
