/* The tornado on the Cost of Living guide (guides/index.html, "Sensitivity"), measured on the
   tool's own engine (../script.js) in headless Chromium, with no network: money crossing
   currencies converts at the bundled rates of currency_rates.json, as it does when the live feeds
   cannot be reached.

   Base case: the Quick Start "Singapore vs Australia" (SGD 8,000 a month net, SGD 6,000 spent in
   five rows, saving 25%), read in its first destination, Sydney: the Required net salary in the
   Net Income row, a month, in AUD. Each row moves one input down and up and keeps the rest. The
   state goes in through the tour's own hand-back (window.__COL_TOUR.restoreState), so every figure
   is the one the page draws. The exchange-rate row reloads the page with the SGD rate moved in its
   live-rate cache, which is how a market move reaches the tool.

   Run: node costofliving-comparator/guides/_sensitivity.mjs   (prints the base case and the rows) */
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import { createServer } from 'node:http';
import { existsSync, statSync, createReadStream, readFileSync } from 'node:fs';
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
const RATES = JSON.parse(readFileSync(join(ROOT, 'costofliving-comparator', 'currency_rates.json'), 'utf8'));

const browser = await pw.chromium.launch();
// A page on the Quick Start; `sgd` multiplies the SGD market rate (units per USD) in the live cache.
async function open(sgd) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  const seed = { 'abt-consent': 'denied', 'col-tour-v3-seen': '1' };
  if (sgd) {
    const rates = {};
    RATES.data.forEach(r => { rates[r.currency] = r.usd_rate * (r.currency === 'SGD' ? sgd : 1); });
    seed['costofliving-comparator:live-fx'] = JSON.stringify({ savedAt: Date.now(), live: { rates, date: RATES.metadata.updated_on, source: 'test', url: '' } });
  }
  await ctx.addInitScript(s => { try { for (const k in s) localStorage.setItem(k, s[k]); } catch (e) {} }, seed);
  const page = await ctx.newPage();
  await page.goto(base + 'costofliving-comparator/');
  await page.waitForFunction(() => window.__COL_TOUR && document.querySelector('.quick-start-btn'));
  await page.click('.quick-start-btn[data-preset="sg-au"]');
  await page.waitForFunction(() => document.querySelector('#detailSec .salary-tr'));
  return { ctx, page };
}
// The Sydney column's Net Income (required) after `edit` changes a copy of the state.
const read = (page, edit) => page.evaluate((src) => {
  const T = window.__COL_TOUR;
  if (!window.__base) window.__base = JSON.stringify(T.saveState());   // the Quick Start, before any edit
  const s = JSON.parse(window.__base);
  (0, eval)('(' + src + ')')(s);
  T.restoreState(s);
  const cell = document.querySelectorAll('#detailSec .salary-tr td.num-td')[0];
  const t = cell ? cell.querySelector('span').textContent : '';
  return { text: t, v: Number(t.replace(/[^\d.-]/g, '')) };
}, edit ? edit.toString() : '() => {}');

const { ctx, page } = await open(0);
const b = await read(page);
// [label, step, edit(lo), edit(hi)]. Rows are rent, groceries, eating out, utilities, other.
const scale = (i, k) => `(s) => { s.detailRows[${i}].fromAmount *= ${k}; }`;
const over = (k, only) => `(s) => { const est = [4576.95, 672.16, 996.03, 329.2, 1059.47]; s.detailRows.forEach((r, i) => { if (${only === undefined ? 'true' : 'i === ' + only}) r.overrides = { 0: est[i] * ${k} }; }); }`;
const ROWS = [
  ['Net Income in Singapore', 'SGD 8,000 → 7,200 / 8,800', '(s) => { s.detailFromSalary = 7200; }', '(s) => { s.detailFromSalary = 8800; }'],
  ['Sydney prices, every row', 'the estimates −10% / +10%, typed over', over(0.9), over(1.1)],
  ['Sydney rent', 'AUD 4,577 → 4,119 / 5,035, typed over', over(0.9, 0), over(1.1, 0)],
  ['Singapore rent', 'SGD 3,500 → 3,150 / 3,850', scale(0, 0.9), scale(0, 1.1)],
  ['Eating out in Singapore', 'SGD 700 → 630 / 770', scale(2, 0.9), scale(2, 1.1)],
  ['Other in Singapore', 'SGD 1,000 → 900 / 1,100', scale(4, 0.9), scale(4, 1.1)],
  ['Your spending, every row', 'SGD 6,000 → 5,400 / 6,600', '(s) => { s.detailRows.forEach(r => { r.fromAmount *= 0.9; }); }', '(s) => { s.detailRows.forEach(r => { r.fromAmount *= 1.1; }); }'],
];
const rows = [];
for (const [label, step, lo, hi] of ROWS) {
  const a = await read(page, lo), c = await read(page, hi);
  rows.push({ label, step, dLo: a.v - b.v, dHi: c.v - b.v });
}
// Two switches beside the tornado: the other savings target, and Simple mode on one figure.
const nominal = await read(page, "(s) => { s.savingsTarget = 'nominal'; }");
const simple = await page.evaluate(() => {
  const T = window.__COL_TOUR, out = {};
  for (const h of ['include', 'exclude']) {
    const s = JSON.parse(window.__base);
    Object.assign(s, { mode: 'simple', goal: 'earn', savingsTarget: 'ratio', housing: h, fromKey: 'Singapore|Singapore', toKey: 'Sydney|Australia', fromSalary: 8000, fromExpense: 6000 });
    T.restoreState(s);
    out[h] = document.querySelector('#analysisArea .req-val').textContent;
  }
  return out;
});
await ctx.close();

// The exchange rate: SGD per AUD 10% lower (SGD stronger) and 10% higher, on both targets.
const fx = {};
for (const [k, m] of [['lo', 0.9], ['hi', 1.1]]) {
  const { ctx: c2, page: p2 } = await open(m);
  fx[k] = { ratio: (await read(p2)).v, nominal: (await read(p2, "(s) => { s.savingsTarget = 'nominal'; }")).v };
  await c2.close();
}
rows.push({ label: 'Exchange rate', step: 'SGD per AUD −10% / +10%', dLo: fx.lo.ratio - b.v, dHi: fx.hi.ratio - b.v });

await browser.close();
server.close();

const aud = (v) => (v < 0 ? '−' : v > 0 ? '+' : '±') + 'AUD ' + Math.abs(Math.round(v)).toLocaleString('en-AU');
const max = Math.max(...rows.map(r => Math.max(Math.abs(r.dLo), Math.abs(r.dHi))));
console.log(`Base case: Singapore vs Australia, Sydney's Required net salary ${b.text} a month (ratio target, 25%)`);
rows.sort((x, y) => Math.max(Math.abs(y.dLo), Math.abs(y.dHi)) - Math.max(Math.abs(x.dLo), Math.abs(x.dHi)));
for (const r of rows) {
  console.log(`${r.label.padEnd(26)} ${r.step.padEnd(40)} lo ${aud(r.dLo).padStart(10)}  hi ${aud(r.dHi).padStart(10)}  --lo:${(r.dLo / max).toFixed(2)};--hi:${(r.dHi / max).toFixed(2)}`);
}
console.log(`\nNominal savings target instead: ${nominal.text} (SGD per AUD −10%: AUD ${fx.lo.nominal.toLocaleString('en-AU')}, +10%: AUD ${fx.hi.nominal.toLocaleString('en-AU')})`);
console.log(`Simple mode, SGD 6,000 on one figure: with housing ${simple.include}, without housing ${simple.exclude}`);
