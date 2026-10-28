/* The tornado on the Rent vs Own guide (guides/index.html, "Sensitivity"), measured on the
   tool's own engine (../engine.js, window.RVOEngine) in headless Chromium.

   Base case: the Quick Start "Perth, 2BR house", opened as a reader opens it
   (rentvsownhouse/?qs=perth/house-2br). The headline is the tool's Equity difference: own
   net equity minus rent net equity at the horizon, in today's money (the page's default,
   Show in today's money on, at its 2.5%/yr general inflation). Each row moves one input
   down and up by a step a reader could argue about and keeps the rest.

   Run: node rentvsownhouse/guides/_sensitivity.mjs   (prints the base case and the rows) */
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

const SID = 'perth/house-2br';
// [label, field, low, high, how the step reads]
const STEPS = [
  ['House price growth', 'houseGrowth', -1, 1, 'pp'],
  ['Risk-Free Rate', 'riskFreeRate', -1, 1, 'pp'],
  ['Mortgage rate', 'mortgageRate', -1, 1, 'pp'],
  ['Rent growth', 'rentInflation', -1, 1, 'pp'],
  ['Rent amount', 'rentAmount', -0.1, 0.1, 'pct'],
  ['Property price', 'propertyPrice', -0.1, 0.1, 'pct'],
  ['Ongoing costs of owning', 'ownOngoingCost', -0.1, 0.1, 'pct'],
  ['Selling cost', 'sellingCostPct', -1, 1, 'pp'],
  ['Setup cost', 'setupCost', -1, 1, 'pp'],
  ['Down payment', 'downPaymentPct', -10, 10, 'pp'],
  ['Mortgage term', 'mortgageTerm', -5, 5, 'yrs'],
  ['Time horizon', 'horizon', -5, 5, 'yrs'],
];

const browser = await pw.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => /cdnjs\.cloudflare\.com/.test(r.request().url()) ? r.continue() : r.abort());
await ctx.addInitScript(() => { try { localStorage.setItem('abt-consent', 'denied'); localStorage.setItem('rvo-tour-v4-seen', '1'); } catch (e) {} });
const page = await ctx.newPage();
await page.goto(base + 'rentvsownhouse/?qs=' + SID);
await page.waitForFunction(() => window.__RVO && document.querySelector('#verdict .v-num'));

const out = await page.evaluate(([sid, steps]) => {
  const E = window.RVOEngine, p = window.RVO_QS.preset(sid);
  // The state the page builds from a Quick Start (applyPreset, then readInputs): the preset's
  // own figures, Simple costs, the default 2.5%/yr general inflation for today's money.
  const S0 = Object.assign({}, p, { ownCostsMode: 'simple', rentCostsMode: 'simple', generalInflation: 2.5 });
  const today = (S) => { const m = E.computeModel(S, 'mid'); return m.summary.diff / Math.pow(1 + S.generalInflation / 100, S.horizon); };
  const b = today(S0);
  const rows = steps.map(([label, key, lo, hi, kind]) => {
    const at = (d) => kind === 'pct' ? S0[key] * (1 + d) : S0[key] + d;
    const v = (d) => today(Object.assign({}, S0, { [key]: at(d) })) - b;
    return { label, key, from: S0[key], lo: at(lo), hi: at(hi), dLo: v(lo), dHi: v(hi) };
  });
  return { base: b, shown: document.getElementById('kpiDiff').textContent, verdict: document.querySelector('#verdict .v-num').textContent, rows };
}, [SID, STEPS]);

await browser.close();
server.close();

const k = (v) => (v < 0 ? '−' : '+') + '$' + Math.round(Math.abs(v) / 1000).toLocaleString('en-AU') + 'k';
const max = Math.max(...out.rows.map(r => Math.max(Math.abs(r.dLo), Math.abs(r.dHi))));
console.log(`Base case: ${SID}, Equity difference in today's money ${Math.round(out.base).toLocaleString('en-AU')} (the page shows ${out.shown})`);
out.rows.sort((a, b) => Math.max(Math.abs(b.dLo), Math.abs(b.dHi)) - Math.max(Math.abs(a.dLo), Math.abs(a.dHi)));
for (const r of out.rows) {
  console.log(`${r.label.padEnd(26)} ${String(+r.from.toFixed(2)).padStart(8)} -> ${String(+r.lo.toFixed(2)).padStart(9)} / ${String(+r.hi.toFixed(2)).padEnd(9)}  lo ${k(r.dLo).padStart(8)}  hi ${k(r.dHi).padStart(8)}  --lo:${(r.dLo / max).toFixed(2)};--hi:${(r.dHi / max).toFixed(2)}`);
}
