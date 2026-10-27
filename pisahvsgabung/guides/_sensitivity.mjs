/* The PPh 21 Pisah vs Gabung guide's sensitivity chart (the tornado in "How the numbers work"),
   measured on the tool's own engine: the page opens in headless Chromium, the Double income
   family Quick Start is loaded, and each input is lowered and raised by one step while the rest
   stay put. The figures come from the page's own readInputs() and computeModel()
   (window.__PVG), so they are what the tool would show for the same form.

   The headline is the saving from Gabung Harta: Pisah Harta's total tax less Gabung Harta's
   (summary.current.diff; positive means Gabung Harta is cheaper).

   Run: node pisahvsgabung/guides/_sensitivity.mjs   (prints the rows, largest swing first,
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

// One step a reader could argue about, down and up, applied to the form's own fields
// (the Double income family is in the Each spouse view: husband 400M, wife 300M, 1 dependant).
// null: no step that way (a deduction cannot go below nil).
const M = 1e6;
const STEPS = [
  { name: "Wife's gross salary", step: 'Rp 300M → 270M / 330M',
    lo: { wifeSalaryInput: 270 * M }, hi: { wifeSalaryInput: 330 * M } },
  { name: "Husband's gross salary", step: 'Rp 400M → 360M / 440M',
    lo: { husbandSalaryInput: 360 * M }, hi: { husbandSalaryInput: 440 * M } },
  { name: 'Household salary, same split', step: 'Rp 700M → 630M / 770M',
    lo: { husbandSalaryInput: 360 * M, wifeSalaryInput: 270 * M }, hi: { husbandSalaryInput: 440 * M, wifeSalaryInput: 330 * M } },
  { name: "Wife's share, total kept", step: '42.9% → 32.9% / 52.9% (Rp 70M moved)',
    lo: { husbandSalaryInput: 470 * M, wifeSalaryInput: 230 * M }, hi: { husbandSalaryInput: 330 * M, wifeSalaryInput: 370 * M } },
  { name: 'Dependants', step: '1 → 0 / 2',
    lo: { dependents: 0 }, hi: { dependents: 2 } },
  { name: 'Deductions, each spouse', step: 'nil → Rp 6M each (the biaya jabatan cap)',
    lo: null, hi: { husbandDeductionInput: 6 * M, wifeDeductionInput: 6 * M } },
];

const browser = await pw.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => /cdnjs\.cloudflare\.com/.test(r.request().url()) ? r.continue() : r.abort());
await ctx.addInitScript(() => { try { localStorage.setItem('pvg-tour-v3-seen', '1'); localStorage.setItem('abt-consent', 'denied'); } catch (e) {} });
const page = await ctx.newPage();
await page.goto(base + 'pisahvsgabung/');
await page.waitForFunction(() => window.__PVG);
// The Inputs card opens folded on a first visit, so the preset is pressed from the page itself.
await page.evaluate(() => document.querySelector('.quick-start-btn[data-preset="double"]').click());

const out = await page.evaluate((steps) => {
  const P = window.__PVG, doc = document;
  const ids = ['husbandSalaryInput', 'wifeSalaryInput', 'husbandDeductionInput', 'wifeDeductionInput', 'dependents'];
  const keep = Object.fromEntries(ids.map(id => [id, doc.getElementById(id).value]));
  const run = (set) => {
    for (const id of ids) doc.getElementById(id).value = keep[id];
    for (const [id, v] of Object.entries(set || {})) doc.getElementById(id).value = id === 'dependents' ? String(v) : v.toLocaleString('en-US');
    P.readInputs();
    const c = P.computeModel().summary.current;
    return { diff: c.diff, gab: c.pisahTax, pis: c.gabungTax };   // the handles are named the other way round (script.js, above LANG)
  };
  const b = run(null);
  const rows = steps.map(s => {
    const lo = s.lo ? run(s.lo) : null, hi = s.hi ? run(s.hi) : null;
    return { name: s.name, step: s.step, lo: lo ? lo.diff - b.diff : null, hi: hi ? hi.diff - b.diff : null, loT: lo, hiT: hi };
  });
  run(null);
  return { base: b, rows };
}, STEPS);
await browser.close();
server.close();

const rp = v => 'Rp ' + Math.round(v).toLocaleString('en-US');
const m = v => v == null ? '—' : (Math.abs(v) < 500 ? 'Rp 0' : (v < 0 ? '−' : '+') + 'Rp ' + (Math.abs(v) / 1e6).toFixed(2) + 'M');
const size = r => Math.max(Math.abs(r.lo || 0), Math.abs(r.hi || 0));
const rows = out.rows.sort((a, b) => size(b) - size(a));
const top = Math.max(...rows.map(size));
console.log(`Base case: Double income family. Gabung Harta ${rp(out.base.gab)}, Pisah Harta ${rp(out.base.pis)}: Gabung Harta saves ${rp(out.base.diff)} a year.\n`);
for (const r of rows) {
  const t = x => x ? `(Gabung ${rp(x.gab)}, Pisah ${rp(x.pis)}, saving ${rp(x.diff)})` : '';
  console.log(`${r.name.padEnd(30)} ${r.step.padEnd(42)} lowered ${m(r.lo).padStart(10)}  raised ${m(r.hi).padStart(10)}` +
    `   --lo:${((r.lo || 0) / top).toFixed(2)};--hi:${((r.hi || 0) / top).toFixed(2)}\n      lowered ${t(r.loT)}\n      raised  ${t(r.hiT)}`);
}
