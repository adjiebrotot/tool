/* The tornado on the DCA Scenario Explorer guide (guides/index.html, "What moves the answer"),
   measured on the tool itself in headless Chromium, on the guide's own price snapshot
   (guides/prices.js: real SPY prices, put in the page's price cache exactly as the demos do),
   so nothing is fetched and every run is the one a reader would get.

   Base case: the Quick Start "Monthly vs Weekly", its first scenario alone (SPY, $520 on the
   1st of every month), over the guide's window, 1 Oct 2021 to 30 Sep 2026, filled at the next
   day's open. The headline is that scenario's final value. Each row moves one input and keeps
   the rest, then presses Simulate and reads the Final Summary tile.

   Run: node dcasimulator/guides/_sensitivity.mjs   (prints the base case and the rows) */
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import { createServer } from 'node:http';
import { existsSync, statSync, createReadStream } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CACHE, CACHE_KEY, WINDOW } from './scenes.js';

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
await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => /cdnjs\.cloudflare\.com/.test(r.request().url()) ? r.continue() : r.abort());
await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); localStorage.setItem('dca-tour-v4-seen', '1'); localStorage.setItem('abt-consent', 'denied'); localStorage.setItem('abt:ctrl:/dcasimulator/', '1'); } catch (e) {} }, [CACHE_KEY, CACHE]);
const page = await ctx.newPage();
await page.goto(base + 'dcasimulator/');
await page.waitForFunction(() => document.querySelector('#summaryGrid .tile'));

// The page's own controls, set as a reader sets them (the field, then its event).
await page.evaluate(() => {
  const H = window.__sens = {};
  const $ = (s) => document.querySelector(s);
  H.set = (sel, v, ev = 'change') => { const e = $(sel); e.value = v; e.dispatchEvent(new Event(ev, { bubbles: true })); };
  // An Investment style: its category, then its option.
  H.style = (cat, v) => { $(`.cat-pill[data-cat="${cat}"]`).click(); const r = $(`input[name^="secStyle"][value="${v}"]`); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); };
  H.done = () => !$('#simBtn').dataset.running;
  H.tile = () => {
    const t = $('#summaryGrid .tile'), txt = t.innerText;
    const num = (re) => { const m = re.exec(txt); return m ? +m[1].replace(/[$,]/g, '') : null; };
    return { final: num(/^[^\n]*\n\$([\d,]+)/), roi: num(/ROI: (-?[\d.]+)%/), dep: num(/Topped up: \$([\d,]+)/), trades: num(/Trades: (\d+)/) };
  };
});
const run = async () => { await page.click('#simBtn'); await page.waitForFunction(() => window.__sens.done()); await page.waitForTimeout(80); return page.evaluate(() => window.__sens.tile()); };
const setDates = (a, b) => page.evaluate(([a, b]) => { window.__sens.set('#startDate', a); window.__sens.set('#endDate', b); }, [a, b]);

// The Quick Start, over the guide's window, then its weekly scenario removed.
await setDates(WINDOW.start, WINDOW.end);
await page.click('.quick-start-btn[data-preset="monthly-weekly"]');
await page.waitForFunction(() => document.querySelectorAll('#summaryGrid .tile').length === 2 && window.__sens.done());
await page.click('#delScenarioBtn');          // the active scenario is the last added, the weekly one
const B = await run();

const ROWS = [
  ['Start date', '1 Oct 2021 → 1 Oct 2020 / 1 Oct 2022', async (d) => { await setDates(d < 0 ? '2020-10-01' : '2022-10-01', WINDOW.end); }, async () => setDates(WINDOW.start, WINDOW.end)],
  ['Amount per top-up', '$520 → $468 / $572 a month', async (d) => page.evaluate((v) => window.__sens.set('#cfgAmount', v, 'input'), d < 0 ? '468' : '572'), async () => page.evaluate(() => window.__sens.set('#cfgAmount', '520', 'input'))],
  ['Yearly increase', '0% → 0% / 5% a year', async (d) => page.evaluate((v) => window.__sens.set('#cfgYearlyInc', v, 'input'), d < 0 ? '0' : '5'), async () => page.evaluate(() => window.__sens.set('#cfgYearlyInc', '0', 'input'))],
  ['Day of month', '1st → 10th / 20th', async (d) => page.evaluate((v) => window.__sens.set('[id^="secDay"]', v), d < 0 ? '10' : '20'), async () => page.evaluate(() => window.__sens.set('[id^="secDay"]', '1'))],
  ['Buy day in the month', "the 1st → the lowest / the highest close (hindsight)", async (d) => page.evaluate((v) => window.__sens.style('forward', v), d < 0 ? 'monthly-bottom' : 'monthly-top'), async () => page.evaluate(() => window.__sens.style('date', 'monthly-date'))],
  ['Trade at', "next day's open → same day's close / next day's close", async (d) => page.evaluate((v) => window.__sens.set('#execTiming', v), d < 0 ? 'close' : 'next-close'), async () => page.evaluate(() => window.__sens.set('#execTiming', 'next-open'))],
];
const out = [];
for (const [label, step, apply, undo] of ROWS) {
  await apply(-1); const lo = await run();
  await apply(1); const hi = await run();
  await undo();
  out.push({ label, step, lo, hi });
}
const again = await run();
await browser.close();
server.close();

const k = (v) => (v < 0 ? '−' : '+') + '$' + Math.abs(Math.round(v)).toLocaleString('en-AU');
console.log(`Base case: SPY $520 on the 1st, ${WINDOW.start} to ${WINDOW.end}: final value $${B.final.toLocaleString('en-AU')}, topped up $${B.dep.toLocaleString('en-AU')}, ROI ${B.roi}%, ${B.trades} trades` + (again.final === B.final ? '' : `  (MISMATCH after the rows: ${again.final})`));
const max = Math.max(...out.map(r => Math.max(Math.abs(r.lo.final - B.final), Math.abs(r.hi.final - B.final))));
out.sort((a, b) => Math.max(Math.abs(b.lo.final - B.final), Math.abs(b.hi.final - B.final)) - Math.max(Math.abs(a.lo.final - B.final), Math.abs(a.hi.final - B.final)));
for (const r of out) {
  const dl = r.lo.final - B.final, dh = r.hi.final - B.final;
  console.log(`${r.label.padEnd(18)} ${r.step.padEnd(52)} lo ${k(dl).padStart(8)} (ROI ${r.lo.roi}%, in $${r.lo.dep})  hi ${k(dh).padStart(8)} (ROI ${r.hi.roi}%, in $${r.hi.dep})  --lo:${(dl / max).toFixed(2)};--hi:${(dh / max).toFixed(2)}`);
}
