/* The guide's sensitivity chart (the tornado under "How the numbers work"), measured on the
   tool's own engine: the Financial Freedom Calculator opens in headless Chromium, the Moderate
   FIRE Quick Start is the base case, and each input is moved down and up by one step while the
   rest stay put. The figure is the freedom age (the "Financially free at" card), and each row
   prints how many years it moves.

   The plan is built the way a Quick Start builds it (applyQuickStart: the defaults, the
   scenario's figures, the preset's return and volatility), then handed to the engine's own
   buildParams and solveFreedomAge through window.__FF, the handle the tool keeps for its audit.
   A second block repeats the risk rows on the same plan read at a 90% Investment outcome chance,
   where the volatility starts to count.

   Run: node financialfreedom/guides/_sensitivity.mjs */
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
const ctx = await browser.newContext();
await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => /cdnjs\.cloudflare\.com/.test(r.request().url()) ? r.continue() : r.abort());
const page = await ctx.newPage();
await page.addInitScript(() => { try { localStorage.setItem('ff-tour-v5-seen', '1'); } catch (e) {} });
await page.goto(base + 'financialfreedom/');
await page.waitForFunction(() => window.__FF && window.__FF.last, null, { timeout: 60000 });

// Each row: the field as the tool labels it, the step, and the change to the plan for each end.
const ROWS = [
  ['Savings', '$45,000 → $40,500 / $49,500 a year', { savings: 40500 }, { savings: 49500 }],
  ['Living expenses', '$65,000 → $58,500 / $71,500 a year', { expense: 58500 }, { expense: 71500 }],
  ['Expected return (CAGR)', '8.5% → 7.5% / 9.5%', { ret: 7.5 }, { ret: 9.5 }],
  ['Inflation', '2.5% → 1.5% / 3.5%', { inflation: 1.5 }, { inflation: 3.5 }],
  ['Retirement expenses', '100% → 90% / 110% of living', { retireExpense: 90 }, { retireExpense: 110 }],
  ['Growth of that amount', '3% → 2% / 4% a year', { growth: 2 }, { growth: 4 }],
  ['Invested assets today', '$120,000 → $108,000 / $132,000', { assets: 108000 }, { assets: 132000 }],
  ['Life expectancy', '90 → 85 / 95', { ageDie: 85 }, { ageDie: 95 }],
  ['Volatility', '15% → 10% / 20%', { std: 10 }, { std: 20 }],
  ['Confidence level', '90% → 80% / 95%', { confidence: 80 }, { confidence: 95 }],
];
const RISK = [
  ['Volatility', '15% → 10% / 20%', { std: 10 }, { std: 20 }],
  ['Expected return (CAGR)', '8.5% → 7.5% / 9.5%', { ret: 7.5 }, { ret: 9.5 }],
  ['Investment outcome chance', '90% → 75% / 95%', { chance: 75 }, { chance: 95 }],
];

const out = await page.evaluate(([rows, risk]) => {
  const F = window.__FF;
  const plan = (extra) => {
    const s = F.QUICK_START_SCENARIOS.moderate.vals;
    const ui = Object.assign({}, F.UI_DEFAULTS, s);
    const p = F.PRESET_ASSETS[ui.assetPreset];
    if (p && ui.assetPreset !== 'custom') { ui.ret = p.ret; ui.std = p.std; }
    ui.stages = []; ui.inStages = [];
    return Object.assign(ui, extra || {});
  };
  const age = (ui) => F.solveFreedomAge(F.buildParams(ui));
  const measure = (list, over) => {
    const b = age(plan(over));
    return { base: b, rows: list.map(([name, step, lo, hi]) => {
      const a = age(plan(Object.assign({}, over, lo))), c = age(plan(Object.assign({}, over, hi)));
      return { name, step, lo: a == null ? null : a - b, hi: c == null ? null : c - b, loAge: a, hiAge: c };
    }) };
  };
  // The goals, for the words under the chart (not a down / up step).
  const goals = { legacy: age(plan({ mode: 'legacy' })), rich: age(plan({ mode: 'rich' })) };
  return { main: measure(rows, {}), risk: measure(risk, { chance: 90 }), goals,
    chance90: age(plan({ chance: 90 })), noVol: age(plan({ std: 0, chance: 90 })) };
}, [ROWS, RISK]);

const yrs = (v) => v == null ? 'never' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1) + ' yrs';
const fmtAge = (a) => { const w = Math.floor(a + 1e-9), m = Math.round((a - w) * 12); return m ? `${w}y ${m}m` : `${w}`; };
const table = (title, m) => {
  console.log(`\n${title}: base case free at ${fmtAge(m.base)}`);
  const sorted = m.rows.slice().sort((x, y) => Math.max(Math.abs(y.lo || 0), Math.abs(y.hi || 0)) - Math.max(Math.abs(x.lo || 0), Math.abs(x.hi || 0)));
  const top = Math.max(...sorted.map(r => Math.max(Math.abs(r.lo || 0), Math.abs(r.hi || 0)))) || 1;
  for (const r of sorted) {
    console.log(`${r.name.padEnd(26)} ${r.step.padEnd(36)} lowered ${yrs(r.lo).padStart(10)} (${fmtAge(r.loAge)})   raised ${yrs(r.hi).padStart(10)} (${fmtAge(r.hiAge)})   --lo:${+((r.lo || 0) / top).toFixed(2)};--hi:${+((r.hi || 0) / top).toFixed(2)}`);
  }
};
table('Moderate FIRE, as the Quick Start loads it (Investment outcome chance 50%)', out.main);
table('The same plan at a 90% Investment outcome chance', out.risk);
console.log(`\nGoal: Leave a Legacy ($500,000) free at ${fmtAge(out.goals.legacy)}, Die Rich at ${fmtAge(out.goals.rich)}.`);
console.log(`At 90% chance: ${fmtAge(out.chance90)}; at 90% chance with no volatility: ${fmtAge(out.noVol)}.`);

await browser.close();
server.close();
