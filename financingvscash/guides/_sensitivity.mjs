/* The Finance vs Cash guide's sensitivity chart (the tornado in "How the numbers work"), measured on
   the tool itself: the page is opened in headless Chromium, the Car Quick Start is loaded, one input
   is moved down and then up with the rest left as the preset sets them, ▶ Simulate is pressed, and
   the Net Benefit vs Cash of the "3yr loan, 10% down" offer is read off the Scenario Comparison
   table. It prints one row per input, sorted by the size of the swing, with --lo / --hi scaled so
   the largest move is 1, then the wash (the loan at the risk-free rate with no fee) and the
   Finance Rate at which the offer draws level with paying cash.

   Run: node financingvscash/guides/_sensitivity.mjs */
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const server = createServer((req, res) => {
  let f = join(ROOT, normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, ''));
  if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); res.end(); return; }
  if (statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
}).listen(0);
const URL0 = 'http://127.0.0.1:' + server.address().port + '/financingvscash/';

const PRESET = 'car', OFFER = '3yr loan, 10% down';
// [label, base shown, field, low value, high value, how the step reads]
const INPUTS = [
  ['Finance Rate', '#scRate', '7.4', '9.4', '8.4% → 7.4% / 9.4%'],
  ['Risk-Free Rate', '#baseRf', '3.5', '5.5', '4.5% → 3.5% / 5.5%'],
  ['Term', '#scTerm', '24', '48', '36 → 24 / 48 months'],
  ['Down Payment', '#scDownPct', '0', '20', '10% → 0% / 20%'],
  ['Cash Purchase Cost', '#purchaseCost', '40,500', '49,500', '$45,000 → $40,500 / $49,500'],
  ['Origination Fee', '#scFeeAmt', '0', '800', '$400 → $0 / $800'],
  ['Available Cash', '#availableCash', '54,000', '66,000', '$60,000 → $54,000 / $66,000'],
];

const browser = await pw.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => /cdnjs\.cloudflare\.com/.test(r.request().url()) ? r.continue() : r.abort());
await ctx.addInitScript(() => { try { localStorage.setItem('fvc-tour-v7-seen', '1'); localStorage.setItem('abt-consent', 'denied'); localStorage.setItem('abt:ctrl:/financingvscash/', '1'); } catch (e) {} });
const page = await ctx.newPage();

// The preset, then each edit in turn on a fresh copy of it; null edits read the preset itself.
async function netBenefit(edits) {
  await page.goto(URL0);
  await page.waitForSelector('#compTableWrap table');
  return page.evaluate(async ([preset, offer, edits]) => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    document.querySelector(`.quick-start-btn[data-preset="${preset}"]`).click();
    await wait(300);
    for (const [sel, v] of edits) {
      const el = document.querySelector(sel);
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    await wait(300);
    document.getElementById('simBtn').click();
    await wait(300);
    const t = document.querySelector('#compTableWrap table');
    const head = [...t.tHead.rows[0].cells].map(c => c.firstChild.textContent.trim());
    const col = head.indexOf(offer);
    const row = [...t.tBodies[0].rows].find(r => r.cells[0].textContent.trim() === 'Net Benefit vs Cash');
    const txt = row.cells[col].textContent.trim();
    return (txt.startsWith('−') ? -1 : 1) * parseFloat(txt.replace(/[^0-9.]/g, ''));
  }, [PRESET, OFFER, edits]);
}

const base = await netBenefit([]);
const rows = [];
for (const [name, sel, lo, hi, step] of INPUTS) {
  const a = await netBenefit([[sel, lo]]), b = await netBenefit([[sel, hi]]);
  rows.push({ name, step, lo: a - base, hi: b - base });
}
const wash = await netBenefit([['#scRate', '4.5'], ['#scFeeAmt', '0']]);
// The Finance Rate at which this offer draws level with paying cash, fee and all (bisection).
let lo = 0, hi = 8.4;
for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; if (await netBenefit([['#scRate', m.toFixed(4)]]) > 0) lo = m; else hi = m; }
await browser.close();
server.close();

rows.sort((x, y) => Math.max(Math.abs(y.lo), Math.abs(y.hi)) - Math.max(Math.abs(x.lo), Math.abs(x.hi)));
const top = Math.max(...rows.map(r => Math.max(Math.abs(r.lo), Math.abs(r.hi)))) || 1;
const money = (v) => (v < 0 ? '−' : v > 0 ? '+' : '') + '$' + Math.abs(Math.round(v)).toLocaleString('en-US');
console.log(`Base case: Car Quick Start, "${OFFER}": Net Benefit vs Cash ${money(base)} (exact ${base.toFixed(2)})`);
for (const r of rows) {
  console.log(`${r.name.padEnd(20)} ${r.step.padEnd(30)} lowered ${money(r.lo).padStart(8)}  raised ${money(r.hi).padStart(8)}   --lo:${(r.lo / top).toFixed(2)};--hi:${(r.hi / top).toFixed(2)}`);
}
console.log(`The wash (Finance Rate 4.5% = Risk-Free Rate, no fee): Net Benefit ${wash.toFixed(2)}`);
console.log(`Break-even Finance Rate, with the $400 fee: ${((lo + hi) / 2).toFixed(2)}%`);
