// Rent vs Own — Sensitivity tool audit.
//   S1  cross-tool consistency: the sensitivity tool's default scenario equals
//       the main tool's defaults, so their per-scenario Own/Rent cashflow CSV
//       exports (built by the SAME RVOExport module) must be byte-identical.
//   S2  summary CSV layout: the parameter rows carry a "Unit" column but the
//       three result rows at the bottom don't, so scenario values shift one
//       column left under the wrong header.
//   S3  view-year output equals the cashflow CSV at that year (Net Equity).
//   S4  a summary CSV saved before the October 2026 relabel ("Horizon",
//       "House Growth (RPPI)", "Mortgage Mode", "Anggaran Rumah Bulanan"…)
//       still opens: every value it carries comes back out, simple and
//       detailed, English and Indonesian (fixtures/ were exported from 5e63a62).
//       Rows are matched by label, not position: the table (and the CSV with
//       it) lists a deciding field before the fields it governs, so the order
//       has moved since those files were saved. The time horizon, risk-free
//       rate, initial cash, budget and its increase are now one figure for
//       every column, so those rows come back as the first column's value
//       under every column (the fixtures hold a different one per column).
//       Every other row comes back exactly.
//   S5  a summary CSV exported now, with a detailed rate schedule, reopens
//       with that schedule on the page of either language (the importer
//       once read only the pre-relabel "Rate Period 1" row names).
// Run: node run.mjs
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SENS = pathToFileURL(join(HERE, '..', 'index.html')).href;
const MAIN = pathToFileURL(join(HERE, '..', '..', 'index.html')).href;

const CHART_STUB = `
window.__charts=[];
class Chart{constructor(c,g){this.config=g;this.data=(g&&g.data)||{datasets:[]};this.options=(g&&g.options)||{};window.__charts.push(this);}update(){}destroy(){}resetZoom(){}}
Chart.register=()=>{};window.Chart=Chart;`;

let pass=0, fail=0;
const check=(name,ok,detail)=>{ console.log((ok?'  PASS  ':'✗ FAIL  ')+name+(detail?'  — '+detail:'')); ok?pass++:fail++; };

const browser = await chromium.launch({args:['--allow-file-access-from-files']});
async function open(url){
  const page = await browser.newPage();
  page.on('pageerror', e=>console.log('PAGEERROR:', e.message));
  await page.route('**/*', route=>{
    const u=route.request().url();
    if(u.startsWith('file://')) return route.continue();
    if(/chart\.umd/.test(u)) return route.fulfill({contentType:'application/javascript', body:CHART_STUB});
    return route.fulfill({contentType:'application/javascript', body:'/* stub */'});
  });
  await page.goto(url, {waitUntil:'load'});
  await page.waitForTimeout(400);
  await page.evaluate(()=>{ window.__csv=null; RVOExport.downloadCSV=(fn,txt)=>{ window.__csv=txt; }; });
  return page;
}

// ── main tool CSVs at defaults ──
const main = await open(MAIN);
async function mainCsv(table){
  await main.evaluate((t)=>{ window.__csv=null; document.querySelector('.tab-btn[data-table="'+t+'"]')?.click(); document.getElementById('downloadBtn').click(); }, table);
  return await main.evaluate(()=>window.__csv);
}
const mainOwn = await mainCsv('own');
const mainRent = await mainCsv('rent');

// ── sensitivity tool CSVs for scenario 0 (Base Case = same defaults) ──
const sens = await open(SENS);
async function sensCsv(which){
  await sens.evaluate((w)=>{ window.__csv=null; document.querySelector('.btn-scen-action.dl-'+w+'[data-si="0"]').click(); }, which);
  return await sens.evaluate(()=>window.__csv);
}
const sensOwn = await sensCsv('own');
const sensRent = await sensCsv('rent');

// S1
{
  const diffAt=(a,b)=>{ const A=a.split('\n'), B=b.split('\n'); for(let i=0;i<Math.max(A.length,B.length);i++) if(A[i]!==B[i]) return `line ${i+1}:\n    main: ${A[i]}\n    sens: ${B[i]}`; return null; };
  const dOwn=diffAt(mainOwn,sensOwn), dRent=diffAt(mainRent,sensRent);
  check('S1a own cashflow identical between main tool and sensitivity tool', !dOwn, dOwn||'');
  check('S1b rent cashflow identical between main tool and sensitivity tool', !dRent, dRent||'');
}

// S2 — summary CSV column alignment
{
  // capture the summary CSV text via the Blob the tool builds (cleanCSV hook)
  await sens.evaluate(()=>{
    window.__summary=null;
    const orig=RVOExport.cleanCSV;
    RVOExport.cleanCSV=(t)=>{ window.__summary=t; return orig(t); };
    URL.createObjectURL=()=>'blob:stub';
    HTMLAnchorElement.prototype.click=function(){};
    document.getElementById('downloadCSVBtn').click();
  });
  const txt = await sens.evaluate(()=>window.__summary);
  const rows = txt.trim().split('\n').map(l=>l.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.length ?? l.split(',').length);
  const lines = txt.trim().split('\n');
  const cols = l => l.length ? (l.match(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/g)||[]).length+1 : 0;
  const headerCols = cols(lines[0]);
  const resultLines = lines.slice(-3);
  const badly = resultLines.filter(l=>cols(l)!==headerCols);
  check('S2 result rows have the same column count as the header (values align under scenario names)',
    badly.length===0,
    `header has ${headerCols} cols; result rows have ${resultLines.map(cols).join('/')} — `+
    `first scenario's result lands under the "Unit" column: ${resultLines[0]}`);
}

// S3 — table output equals cashflow CSV at the view year
{
  const outOwn = await sens.evaluate(()=>document.querySelector('tr.out-own td.scen-td').textContent.trim());
  const rows = sensOwn.trim().split('\n').filter(l=>!l.startsWith('#'));
  const head = rows[0].split(',');
  const last = rows[rows.length-1].split(',');
  const netEq = parseFloat(last[head.indexOf('Net_Equity')]);
  const fmt = v=>{ const a=Math.abs(v); const s=v<0?'−':''; if(a>=1e9) return s+'$'+(a/1e9).toFixed(2)+'b'; if(a>=1e6) return s+'$'+(a/1e6).toFixed(2)+'m'; if(a>=1000) return s+'$'+(a/1000).toFixed(0)+'k'; return s+'$'+Math.round(a); };
  check('S3 table Own output at view year matches the cashflow CSV', outOwn===fmt(netEq),
    `table ${outOwn} vs csv-derived ${fmt(netEq)}`);
}

// S4 — old summary CSVs, opened by the current importer
{
  const cells = l => (l.match(/("([^"]|"")*"|[^,]*)(,|$)/g) || []).map(c => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"'));
  // The rows the October 2026 relabel renamed, old label to current, frozen
  // here (read off the importer of the day, which still listed rows in the
  // old order); every other row kept its words and changed case at most.
  const RENAMED = {
    'horizon': 'time horizon', 'mortgage mode': 'mortgage detail', 'rate period 1': 'rate, period 1',
    'house growth (rppi)': 'house price growth (rppi)', 'own costs mode': 'own costs detail', 'rent costs mode': 'rent costs detail',
    'anggaran rumah bulanan': 'anggaran perumahan bulanan', 'mode kpr': 'rincian kpr', 'tipe kpr': 'jenis kpr',
    'periode bunga 1': 'bunga, periode 1', 'mode biaya beli': 'rincian biaya beli', 'mode biaya sewa': 'rincian biaya sewa',
  };
  // The parameter section: rows up to the first blank line, as label -> values
  // (the unit column is allowed to have changed).
  const values = (txt, rename) => { const out = new Map(); let first = true;
    for (const l of txt.replace(/\r/g, '').split('\n')) { if (!l.trim()) break; if (first) { first = false; continue; }
      const c = cells(l), k = c[0].trim().toLowerCase(); out.set(rename ? (RENAMED[k] || k) : k, c.slice(2).join('|')); }
    return out; };
  // Opens a CSV on a page and returns the summary CSV it then exports.
  async function reopen(url, f, text){
    const page = await open(url);
    await page.evaluate(() => { window.__summary = null; const orig = RVOExport.cleanCSV; RVOExport.cleanCSV = t => { window.__summary = t; return orig(t); };
      URL.createObjectURL = () => 'blob:stub'; HTMLAnchorElement.prototype.click = function(){}; window.alert = m => { window.__alert = m; }; });
    await page.setInputFiles('#csvFileInput', { name: f, mimeType: 'text/csv', buffer: Buffer.from(text) });
    await page.waitForTimeout(600);
    await page.evaluate(() => document.getElementById('downloadCSVBtn').click());
    const out = { csv: await page.evaluate(() => window.__summary || ''), alert: await page.evaluate(() => window.__alert) };
    await page.close();
    return out;
  }
  const SENS_ID = pathToFileURL(join(HERE, '..', 'id', 'index.html')).href;
  const dir = join(HERE, 'fixtures');
  for (const f of readdirSync(dir).filter(n => /^pre-relabel-.*\.csv$/.test(n)).sort()) {
    const old = readFileSync(join(dir, f), 'utf8');
    const isId = /-id-/.test(f);
    // On the page of the file's own language, row by row by label.
    const own = await reopen(isId ? SENS_ID : SENS, f, old);
    const a = values(old, true), b = values(own.csv, false);
    // Shared rows: the first column's figure, under every column.
    const SHARED = ['time horizon', 'risk-free rate', 'initial cash', 'monthly housing budget', 'budget annual increase',
      'jangka waktu', 'suku bunga bebas risiko', 'modal awal', 'anggaran perumahan bulanan', 'kenaikan anggaran tahunan'];
    for (const k of SHARED) if (a.has(k)) { const v = a.get(k).split('|'); a.set(k, v.map(x => x === '' ? '' : v[0]).join('|')); }
    const bad = [...a].map(([k, v]) => v === b.get(k) ? null : `${k}: ${v} -> ${b.has(k) ? b.get(k) : '(no such row)'}`).filter(Boolean);
    check(`S4 ${f} reopens with every value it carries`, bad.length === 0 && a.size === b.size && !own.alert,
      bad.slice(0, 3).join(' | ') || `${a.size} parameter rows` + (a.size === b.size ? '' : `, now ${b.size}`));
    // On the other language's page too: its export lists the same rows in the
    // same order, in the other language, so its values match row for row.
    const other = await reopen(isId ? SENS : SENS_ID, f, old);
    const B = [...b.values()], C = [...values(other.csv, false).values()];
    const off = B.map((v, i) => v === C[i] ? null : `row ${i + 1}: ${v} -> ${C[i]}`).filter(Boolean);
    check(`S4 ${f} also reopens on the ${isId ? 'English' : 'Indonesian'} page`, off.length === 0 && B.length === C.length && !other.alert,
      off.slice(0, 3).join(' | ') || `${C.length} parameter rows`);
  }
}

// S5 — a detailed rate schedule survives today's export, in both languages
{
  const SENS_ID = pathToFileURL(join(HERE, '..', 'id', 'index.html')).href;
  for (const [from, to] of [[SENS, SENS], [SENS_ID, SENS_ID], [SENS, SENS_ID]]) {
    const a = await open(from);
    const setup = await a.evaluate(() => {
      document.querySelector('.mode-seg[data-mode-key="mortgageMode"] .seg-btn[data-val="detailed"]').click();
      document.querySelector('.add-period-btn[data-si="0"]').click();
      const set = (sel, v, ev) => { const el = document.querySelector(sel); el.value = v; el.dispatchEvent(new Event(ev, {bubbles:true})); };
      set('.rp-rate[data-si="0"][data-idx="0"]', '3.9', 'blur');
      set('.rp-type[data-si="0"][data-idx="1"]', 'floating', 'change');
      set('.rp-min[data-si="0"][data-idx="1"]', '5.5', 'blur');
      set('.rp-max[data-si="0"][data-idx="1"]', '8', 'blur');
      window.__summary = null; const orig = RVOExport.cleanCSV; RVOExport.cleanCSV = t => { window.__summary = t; return orig(t); };
      URL.createObjectURL = () => 'blob:stub'; HTMLAnchorElement.prototype.click = function(){};
      document.getElementById('downloadCSVBtn').click();
      return window.__summary;
    });
    const want = await a.evaluate(() => { window.__csv = null; document.querySelector('.btn-scen-action.dl-own[data-si="0"]').click(); return window.__csv; });
    const b = await open(to);
    await b.setInputFiles('#csvFileInput', { name: 's.csv', mimeType: 'text/csv', buffer: Buffer.from(setup) });
    await b.waitForTimeout(500);
    const got = await b.evaluate(() => { window.__csv = null; document.querySelector('.btn-scen-action.dl-own[data-si="0"]').click(); return window.__csv; });
    const n = await b.evaluate(() => document.querySelectorAll('.rp-type[data-si="0"]').length);
    check(`S5 a detailed rate schedule reopens from today's export (${from === SENS ? 'English' : 'Indonesian'} file, ${to === SENS ? 'English' : 'Indonesian'} page)`,
      n === 2 && got === want, `${n} rate periods; cashflow ${got === want ? 'identical' : 'differs'}`);
    await a.close(); await b.close();
  }
}

await browser.close();
console.log(`\nsensitivity audit: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
