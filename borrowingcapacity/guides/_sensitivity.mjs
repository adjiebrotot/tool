/* The Borrowing Capacity guide's sensitivity chart (the tornado in "How the numbers work"),
   measured on the tool's own engine: the page opens in headless Chromium, the Couple,
   Melbourne Quick Start is loaded, and each input is lowered and raised by one step while the
   rest stay put. The engine is the page's own compute() (window.__BC), fed by its own
   readInputs(), so the figures are what the tool would show for the same form.

   Run: node borrowingcapacity/guides/_sensitivity.mjs   (prints the rows, largest swing first,
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

// One step a reader could argue about, down and up, applied to the engine's own inputs.
// In the Simple income view, readInputs() puts the one income figure in payg.
const STEPS = [
  { name: 'Gross income',              step: '$185,000 → $166,500 / $203,500', lo: p => { p.payg *= 0.9; },        hi: p => { p.payg *= 1.1; } },
  { name: 'Product rate offered',      step: '5.90% → 4.90% / 6.90%',          lo: p => { p.prodRate -= 1; },     hi: p => { p.prodRate += 1; } },
  { name: 'APRA buffer',               step: '3.00% → 2.00% / 4.00%',          lo: p => { p.buffer -= 1; },       hi: p => { p.buffer += 1; } },
  { name: 'Loan term',                 step: '30 → 25 / 35 years',             lo: p => { p.termYears -= 5; },    hi: p => { p.termYears += 5; } },
  { name: 'Dependants',                step: '2 → 1 / 3',                      lo: p => { p.deps -= 1; },         hi: p => { p.deps += 1; } },
  { name: 'Declared living expenses',  step: '$4,800 → $3,800 / $5,800 a month', lo: p => { p.declaredExp -= 1000; }, hi: p => { p.declaredExp += 1000; } },
  { name: 'Credit card limit',         step: '$15,000 → $5,000 / $25,000',     lo: p => { p.cardLimit -= 10000; }, hi: p => { p.cardLimit += 10000; } },
  { name: 'Purchase price',            step: '$920,000 → $828,000 / $1,012,000', lo: p => { p.price *= 0.9; p.valuation = p.price; }, hi: p => { p.price *= 1.1; p.valuation = p.price; } },
  { name: 'Minimum left each month (UMI)', step: '$250 → $0 / $500 a month',   lo: p => { p.umiReq -= 250; },     hi: p => { p.umiReq += 250; } },
  { name: 'Deposit funds',             step: '$300,000 → $250,000 / $350,000', lo: p => { p.savings -= 50000; },  hi: p => { p.savings += 50000; } },
];

const browser = await pw.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => /cdnjs\.cloudflare\.com/.test(r.request().url()) ? r.continue() : r.abort());
await ctx.addInitScript(() => { try { localStorage.setItem('bc-tour-v3-seen', '1'); localStorage.setItem('abt-consent', 'denied'); } catch (e) {} });
const page = await ctx.newPage();
await page.goto(base + 'borrowingcapacity/');
await page.waitForFunction(() => window.__BC);
// The Inputs card opens folded on a first visit, so the preset is pressed from the page itself.
await page.evaluate(() => document.querySelector('.quick-start-btn[data-preset="couple"]').click());

const steps = STEPS.map(s => ({ name: s.name, step: s.step, lo: s.lo.toString(), hi: s.hi.toString() }));
const out = await page.evaluate((steps) => {
  const B = window.__BC, p0 = B.readInputs(), r0 = B.compute(p0);
  const run = (src) => { const p = { ...p0 }; (0, eval)('(' + src + ')')(p); const r = B.compute(p); return { loan: r.maxLoan, serv: r.Lserv, bind: r.binding.label }; };
  return { base: r0.maxLoan, bind: r0.binding.label, rows: steps.map(s => {
    const lo = run(s.lo), hi = run(s.hi);
    return { name: s.name, step: s.step, lo: lo.loan - r0.maxLoan, hi: hi.loan - r0.maxLoan, loBind: lo.bind, hiBind: hi.bind,
      servLo: lo.serv - r0.Lserv, servHi: hi.serv - r0.Lserv };
  }) };
}, steps);
await browser.close();
server.close();

const k = v => (v < 0 ? '−' : '+') + '$' + Math.round(Math.abs(v) / 1000) + 'k';
const rows = out.rows.sort((a, b) => Math.max(Math.abs(b.lo), Math.abs(b.hi)) - Math.max(Math.abs(a.lo), Math.abs(a.hi)));
const top = Math.max(...rows.map(r => Math.max(Math.abs(r.lo), Math.abs(r.hi))));
console.log(`(The last column is the serviceability cap on its own, before the other three caps can stop it.)`);
console.log(`Base case: Couple, Melbourne. Borrowing capacity $${Math.round(out.base).toLocaleString('en-AU')} (${out.bind} binds).\n`);
for (const r of rows) {
  console.log(`${r.name.padEnd(30)} ${r.step.padEnd(34)} lowered ${k(r.lo).padStart(6)} (${r.loBind})  raised ${k(r.hi).padStart(6)} (${r.hiBind})` +
    `   --lo:${(r.lo / top).toFixed(2)};--hi:${(r.hi / top).toFixed(2)}   [${Math.round(r.lo)} / ${Math.round(r.hi)}]` +
    `   serviceability cap alone ${k(r.servLo)} / ${k(r.servHi)}`);
}
