// Global Income Tax Calculator: the English page and its Indonesian twin (id/) are one tool.
//
// Both pages run the same script.js on the same Persist namespace, and show figures in the same
// format (1,234.5, as the form's fields write them), so a reader's work moves between them
// unchanged. This holds that with the real pages in headless Chromium:
//   1. every Quick Start: the same jobs, the same figures in Where the pay goes and the cards,
//      the same chart data, on both pages;
//   2. work saved on the English page (the mini cache) opens on id/ as the same fields, jobs and
//      numbers, and work changed on id/ opens back on the English page the same way;
//   3. a Share link made on one page opens on the other with the same jobs;
//   4. an AI #load link opens the same on both, including a select named by its English words.
// Needs Chart.js cached in _ref/.libcache/ (node _ref/chart-check.mjs once).
// Run: node global-income-tax-calculator/_audit/lang-parity.mjs
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize, basename } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LIBS = join(ROOT, '_ref', '.libcache');
if(!existsSync(join(LIBS, 'chart.umd.min.js'))){ console.error('Run node _ref/chart-check.mjs once with network access to cache Chart.js.'); process.exit(2); }
let pass = 0, fail = 0;
const check = (name, ok, detail) => { console.log((ok ? '  PASS  ' : '✗ FAIL  ') + name + (detail && !ok ? '  — ' + detail : '')); ok ? pass++ : fail++; };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.txt': 'text/plain' };
const server = createServer((req, res) => {
  const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  let file = join(ROOT, rel);
  if(existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if(!file.startsWith(ROOT) || !existsSync(file)){ res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const EN = '/global-income-tax-calculator/', ID = '/global-income-tax-calculator/id/';
const browser = await pw.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
const errs = [];
await ctx.route('**/*', route => {
  const u = route.request().url();
  if(u.startsWith(ORIGIN)) return route.continue();
  const f = join(LIBS, basename(new URL(u).pathname));
  if(/cdnjs/.test(u) && existsSync(f)) return route.fulfill({ status: 200, contentType: 'text/javascript', body: readFileSync(f, 'utf8') });
  return route.fulfill({ status: 204, body: '' });
});
await ctx.addInitScript(() => { try { localStorage.setItem('abt:ctrl:' + location.pathname, '1'); localStorage.setItem('gitc-tour-v1-seen', '1'); localStorage.setItem('gitc-id-tour-v1-seen', '1'); } catch(e){} });
const page = await ctx.newPage();
page.on('pageerror', e => errs.push(e.message));
async function go(path){ await page.goto(ORIGIN + path); await page.waitForFunction(() => window.__GSC); await page.waitForTimeout(150); }
const state = () => page.evaluate(() => {
  const G = window.__GSC, rs = G.JOBS().map(G.compute);
  return { jobs: JSON.parse(JSON.stringify(G.JOBS())), active: G.active(), dispCur: document.getElementById('dispCur').value, dispPer: document.getElementById('dispPer').value,
    figures: rs.map(r => r.notSupported ? r.reason : [r.gross, r.incomeTax, r.social, r.other, r.net, r.marginal].map(v => v == null ? null : +v.toFixed(6))),
    shown: [...document.querySelectorAll('#compareWrap td:not(:first-child), #metrics .value')].map(td => td.textContent.trim()),
    chart: (() => { const c = Chart.getChart(document.getElementById('chartCanvas')); return c ? c.data.datasets.map(d => d.data.map(p => [Math.round(p.x), p.y == null ? null : +p.y.toFixed(6)])) : null; })() };
});
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const firstDiff = (a, b) => { for(const k of Object.keys(a)) if(!same(a[k], b[k])) return k + ': ' + JSON.stringify(a[k]).slice(0, 160) + ' vs ' + JSON.stringify(b[k]).slice(0, 160); return ''; };

/* 1. Quick Starts */
for(const qs of await (async () => { await go(EN); return page.evaluate(() => window.GSC_QS); })()){
  await go(EN); await page.evaluate(k => window.__GSC.applyQuickStart(k), qs); const a = await state();
  await go(ID); await page.evaluate(k => window.__GSC.applyQuickStart(k), qs); const b = await state();
  check(`Quick Start ${qs}: same jobs, figures and chart on both pages`, same(a, b), firstDiff(a, b));
}

/* 2. The mini cache, both ways */
await page.evaluate(() => localStorage.clear());
await go(EN);
await page.evaluate(() => {
  const G = window.__GSC, set = (id, v) => { const el = document.getElementById(id); if(el.type === 'checkbox') el.checked = !!v; else el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  set('country', 'PT'); set('ptRegime', 'jovem'); set('ptJovemYear', '3'); set('ptHealth', '2,345.67'); set('amount', '123,456.78');
  G.addJob(); set('country', 'DE'); set('deAddOn', '3.125'); set('deChurch', '9'); set('amount', '98,765'); set('period', 'monthly');
  G.addJob(); set('country', 'US'); set('usState', 'NY'); set('usNyc', true); set('dir', 'net'); set('amount', '150,000');
  document.getElementById('dispCur').value = 'EUR'; document.getElementById('dispCur').dispatchEvent(new Event('change'));
  G.pickJob(1);
});
await page.waitForTimeout(1200);       // the mini cache saves on a short timer
const savedEn = await state();
await go(ID);
const onId = await state();
check('work saved on the English page opens on id/ unchanged (fields, jobs, figures, chart)', same(savedEn, onId), firstDiff(savedEn, onId));
check('a number typed on the English page reads the same on id/ (amount 123,456.78)', onId.jobs[0].amount === '123,456.78' && onId.figures[0][0] === savedEn.figures[0][0], onId.jobs[0].amount);
await page.evaluate(() => { const el = document.getElementById('amount'); el.value = '87,654.32'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
await page.waitForTimeout(1200);
const savedId = await state();
await go(EN);
const onEn = await state();
check('work changed on id/ opens on the English page unchanged', same(savedId, onEn), firstDiff(savedId, onEn));
check('the edit made on id/ is the number it was (87,654.32)', onEn.jobs[1].amount === '87,654.32', onEn.jobs[1].amount);

/* 3. A Share link, both ways */
for(const [from, to] of [[EN, ID], [ID, EN]]){
  await go(from);
  const hash = await page.evaluate(async () => {
    const cl = [...document.querySelectorAll('*')].find(el => el.__share);
    return cl ? (await SharedShare.shareLink(cl)).replace(/^[^#]*/, '') : null;
  });
  if(!hash){ check(`Share link ${from} -> ${to}`, false, 'no Share cluster found'); continue; }
  const before = await state();
  await page.evaluate(() => localStorage.clear());
  await page.goto(ORIGIN + to + hash); await page.waitForFunction(() => window.__GSC); await page.waitForTimeout(400);
  const after = await state();
  check(`a Share link made on ${from === EN ? 'the English page' : 'id/'} opens the same on ${to === EN ? 'the English page' : 'id/'}`, same(before.jobs, after.jobs) && same(before.figures, after.figures), firstDiff(before, after));
}

/* 4. An AI #load link */
const AI = '#load&v=1&country=AU&auRes=Foreign%20resident&amount=95000&period=yearly&json=' + encodeURIComponent(JSON.stringify({ jobs: [{ country: 'AU', auRes: 'foreign', amount: 95000 }, { country: 'SG', sgRes: 'Non-resident (under 183 days)', amount: 140000 }] }));
const viaAi = [];
for(const p of [EN, ID]){
  await page.evaluate(() => localStorage.clear()).catch(() => {});
  await page.goto(ORIGIN + p + AI); await page.waitForFunction(() => window.__GSC); await page.waitForTimeout(500);
  viaAi.push(await state());
}
check('an AI #load link opens the same jobs and figures on both pages', same(viaAi[0].jobs, viaAi[1].jobs) && same(viaAi[0].figures, viaAi[1].figures), firstDiff(viaAi[0], viaAi[1]));
check('an option named by its English words loads on id/ (sgRes: Non-resident (under 183 days))', viaAi[1].jobs[1] && viaAi[1].jobs[1].sgRes === 'nonres', JSON.stringify(viaAi[1].jobs[1]));
check('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
console.log(`\nlang parity: ${pass} passed, ${fail} failed`);
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
