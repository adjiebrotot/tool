// Global Income Tax Calculator: page audit.
//
// Drives the REAL page in headless Chromium (Chart.js from _ref/.libcache/, run
// node _ref/chart-check.mjs once to fill it) the way a reader does: picks the
// country and sets each field in the form, then reads the figures the page
// shows. run.mjs holds the engine to the spec's golden values; this holds the
// page's plumbing to them (field reading, numbers typed with commas, a monthly
// period, net to gross, the display currency, the saved jobs).
//
// Run: node global-income-tax-calculator/_audit/page.mjs
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize, basename } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const GOLD = JSON.parse(readFileSync(join(HERE, 'golden-v11.json'), 'utf8'));
const LIBS = join(ROOT, '_ref', '.libcache');
if(!existsSync(join(LIBS, 'chart.umd.min.js'))){ console.error('Run node _ref/chart-check.mjs once with network access to cache Chart.js.'); process.exit(2); }

let pass = 0, fail = 0;
const check = (name, ok, detail) => { console.log((ok ? '  PASS  ' : '✗ FAIL  ') + name + (detail ? '  — ' + detail : '')); ok ? pass++ : fail++; };
const num = s => parseFloat(String(s).replace(/[−–]/g, '-').replace(/[^0-9.\-]/g, ''));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.txt': 'text/plain', '.png': 'image/png' };
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
const browser = await pw.chromium.launch();

async function open(clean = true){
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', route => {
    const u = route.request().url();
    if(u.startsWith(ORIGIN)) return route.continue();
    const f = join(LIBS, basename(new URL(u).pathname));
    if(/cdnjs/.test(u) && existsSync(f)) return route.fulfill({ status: 200, contentType: 'text/javascript', body: readFileSync(f, 'utf8') });
    return route.fulfill({ status: 204, body: '' });
  });
  await page.addInitScript(() => { try { localStorage.setItem('abt:ctrl:' + location.pathname, '1'); } catch(e){} });
  await page.goto(ORIGIN + '/global-income-tax-calculator/');
  await page.waitForFunction(() => window.__GSC);
  return { ctx, page, errs };
}

// Set the form as a reader would: one job, its country, then each field, firing input and change.
async function setJob(page, country, fields, amount, period = 'yearly', dir = 'gross'){
  await page.evaluate(([country, fields, amount, period, dir]) => {
    while(document.querySelectorAll('.job-del').length) document.querySelector('.job-del').click();
    window.__GSC.writeJob({});            // a fresh job: every field back to the page's default
    const fire = el => { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    const set = (id, v) => {
      const el = document.getElementById(id);
      if(el.type === 'checkbox') el.checked = !!v; else el.value = String(v);
      fire(el);
    };
    set('country', country);
    set('period', period);
    set('dir', dir);
    Object.entries(fields).forEach(([id, v]) => set(id, v));
    set('amount', Number(amount).toLocaleString('en'));
  }, [country, fields, amount, period, dir]);
}
// The figures the page shows for job 1 in the Where the pay goes table.
async function shown(page){
  return page.evaluate(() => {
    const out = {};
    document.querySelectorAll('#compareWrap tbody tr').forEach(tr => {
      const td = tr.querySelectorAll('td');
      out[td[0].textContent.trim()] = td[1].textContent.trim();
    });
    return out;
  });
}

/* ── 1. Golden cases through the form ── */
const CASES = [
  ['AU|pr|120000', 'AU', { auRes: 'pr' }], ['AU|whm|60000', 'AU', { auRes: 'whm' }],
  ['SG|citizen55|120000', 'SG', { sgRes: 'citizen', sgAge: '55' }], ['SG|pr1|300000', 'SG', { sgRes: 'pr1' }],
  ['UK|SCO|80000', 'GB', { ukRegion: 'sco' }], ['UK|rUK|150000', 'GB', { ukRegion: 'ruk' }],
  ['DE|III|85000', 'DE', { deClass: 'III', deKids: true }], ['DE|I_church9|150000', 'DE', { deChurch: '9' }],
  ['US-TX|MFJ|500000', 'US', { usState: 'TX', usFiling: 'MFJ' }], ['US-CA|single|180000', 'US', { usState: 'CA' }],
  ['US-NY|NYC_MFJ|150000', 'US', { usState: 'NY', usFiling: 'MFJ', usNyc: true }], ['US-NY|NYS_single|600000', 'US', { usState: 'NY' }],
  ['US-states (v11)|MD_S|180000', 'US', { usState: 'MD' }], ['US-states (v11)|HI_MFJ|80000', 'US', { usState: 'HI', usFiling: 'MFJ' }],
  ['US-TX NRA|F1_NRA_ficaExempt|80000', 'US', { usState: 'TX', usRes: 'nra', usFicaExempt: true }],
  ['TH|married2kids|1200000', 'TH', { thSpouse: true, thKids: '2' }],
  ['MY|expat_resident|120000', 'MY', { myRes: 'expat' }],
  ['NL (gross incl. holiday pay)|ruling30|86400', 'NL', { nlRuling: true, nlHoliday: false }],
  ['NO|resident|700000', 'NO', {}], ['SE|Stockholm30.55|600000', 'SE', {}], ['EE|pillarII_off|48000', 'EE', { eeP2: '0' }],
  ['FI|Helsinki_church1|72000', 'FI', { fiChurch: '1' }], ['FI|keyEmployee|120000', 'FI', { fiRes: 'key' }],
  ['BE|married_sole_earner_5kids|90000', 'BE', { beStatus: 'married', beKids: '5' }], ['BE|single_parent_2kids|60000', 'BE', { beKids: '2', beSingleParent: true }],
  ['IT|impatriate60_child|120000', 'IT', { itImp: 'imp60' }], ['IT|Milan|35000', 'IT', {}],
  ['CH-ZH (city, single, age 35-44)|married_2kids|200000', 'CH', { chStatus: 'married', chKids: '2' }],
  ['CH-ZH (city, single, age 35-44)|B_permit_single_church10|120000', 'CH', { chChurch: true }],
  ['FR|married2kids_cadre|120000', 'FR', { frCadre: 'cadre', frMarried: true, frKids: '2' }], ['FR|single_cadre_impatriate30|60000', 'FR', { frCadre: 'cadre', frImp: true }],
  ['ES (Madrid)|resident_2kids|19000', 'ES', { esKids: '2' }], ['ES (Madrid)|beckham|80000', 'ES', { esRegime: 'beckham' }],
  ['PT|IRSJovem_y3|30000', 'PT', { ptRegime: 'jovem', ptJovemYear: '3' }], ['PT|resident_2deps_8y_2y|60000', 'PT', { ptDepOld: '1', ptDepYoung: '1' }],
  ['PT|resident_health2000_edu1000|40000', 'PT', { ptHealth: '2,000', ptEdu: '1,000' }],
  ['JP (Tokyo, <40)|year1_noResidentTax|8000000', 'JP', { jpRes: 'y1' }], ['KR|progressive|100000000', 'KR', {}],
  ['CA-ON|single|25000', 'CA', { caProv: 'ON' }], ['CA-QC|single|200000', 'CA', { caProv: 'QC' }],
  ['HK|married2kids_MPF|720000', 'HK', { hkMarried: true, hkKids: '2' }], ['CN-SH|expat_allow120k|480000', 'CN', { cnRes: 'expat', cnAllow: '120,000' }],
  ['TW|resident_single_goldcard|6000000', 'TW', { twGold: true }], ['TW|nonresident|1200000', 'TW', { twRes: 'nonres' }],
  ['Gulf|SA_national_new_2026|600000', 'SA', { gulfNat: 'national', saScheme: 'new' }], ['Gulf|BH_expat|240000', 'BH', { gulfNat: 'expat' }],
  ['ID (gross/month)|K2|40000000', 'ID', { idMarried: true, idDeps: '2' }, 'monthly']
];
{
  const { ctx, page, errs } = await open();
  for(const [key, country, fields, period] of CASES){
    const want = GOLD[key];
    const gross = +key.split('|')[2];
    await setJob(page, country, fields, gross, period || 'yearly');
    const s = await shown(page);
    const tax = num(s['Income tax, all levels']), net = num(s['Take-home pay']);
    const ok = Math.abs(tax - Math.round(want.incomeTax)) <= 1 && Math.abs(net - Math.round(want.net)) <= 1;
    check('page shows golden ' + key, ok, ok ? '' : 'tax ' + s['Income tax, all levels'] + ' vs ' + want.incomeTax + ', net ' + s['Take-home pay'] + ' vs ' + want.net);
  }
  check('no page errors while the golden cases were typed in', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ── 2. Net to gross, the display currency, and the jobs kept over a reload ── */
{
  const { ctx, page, errs } = await open();
  await setJob(page, 'DE', {}, 4500, 'monthly', 'net');
  const r = await page.evaluate(() => { const g = window.__GSC; const j = g.JOBS()[0]; return g.compute(j); });
  check('net to gross: the solved gross takes home 4,500 a month', Math.abs(r.net - 54000) <= 1, 'gross ' + r.gross.toFixed(2) + ', net ' + r.net.toFixed(2));
  const s = await shown(page);
  check('net to gross: the table shows the solved gross', Math.abs(num(s['Gross pay']) - Math.round(r.gross)) <= 1, s['Gross pay']);

  await page.evaluate(() => { const d = document.getElementById('dispCur'); d.value = 'USD'; d.dispatchEvent(new Event('change', { bubbles: true })); });
  const usd = await shown(page);
  const fx = await page.evaluate(() => window.GSCEngine.FX.EUR);
  check('display currency restates take-home at the dated rate', Math.abs(num(usd['Take-home pay']) - Math.round(54000/fx)) <= 1, usd['Take-home pay'] + ' vs ' + Math.round(54000/fx));
  await page.evaluate(() => { const d = document.getElementById('dispPer'); d.value = 'month'; d.dispatchEvent(new Event('change', { bubbles: true })); });
  const usdM = await shown(page);
  check('per month divides by twelve', Math.abs(num(usdM['Take-home pay']) - Math.round(4500/fx)) <= 1, usdM['Take-home pay']);

  // Three jobs, the second edited, then a reload.
  await page.evaluate(() => {
    window.__GSC.addJob(); window.__GSC.addJob();
    window.__GSC.pickJob(1);
    const c = document.getElementById('country'); c.value = 'PT'; c.dispatchEvent(new Event('change', { bubbles: true }));
    const k = document.getElementById('ptRegime'); k.value = 'ifici'; k.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(900);
  const before = await page.evaluate(() => JSON.stringify(window.__GSC.JOBS().map(j => [j.country, j.ptRegime, j.dir, j.amount])));
  await page.reload();
  await page.waitForFunction(() => window.__GSC);
  const after = await page.evaluate(() => JSON.stringify(window.__GSC.JOBS().map(j => [j.country, j.ptRegime, j.dir, j.amount])));
  check('three jobs come back after a reload, the edited one as edited', before === after, after);
  check('the job on screen comes back too', await page.evaluate(() => window.__GSC.active()) === 1);
  check('no page errors in the round trip', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ── 3. Switching the period restates the amount and never moves the answer ── */
{
  const { ctx, page, errs } = await open();
  await setJob(page, 'FR', { frCadre: 'cadre' }, 72000);
  const before = await shown(page);
  const switchTo = per => page.evaluate(per => {
    const sel = document.getElementById('period');
    sel.dispatchEvent(new Event('focus'));          // SharedFreq reads the period it converts from here
    sel.value = per;
    sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true }));
    return document.getElementById('amount').value;
  }, per);
  const monthly = await switchTo('monthly');
  const mid = await shown(page);
  check('a year to a month restates the amount (72,000 a year is 6,000 a month)', monthly === '6,000', monthly);
  check('and the take-home does not move', mid['Take-home pay'] === before['Take-home pay'], mid['Take-home pay'] + ' vs ' + before['Take-home pay']);
  const back = await switchTo('yearly');
  check('switching back gives back what was typed', back === '72,000', back);
  check('no page errors in the switch', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ── 4. The states not loaded are not offered, and a job saved with one says so ── */
{
  const { ctx, page, errs } = await open();
  const gated = await page.evaluate(() => Object.keys(window.__GSC.E.US_ST_GATED));
  const offered = await page.evaluate(() => [...document.getElementById('usState').options].map(o => o.value));
  check('the state list offers 39 states and DC', offered.length === 40, offered.length);
  check('no state that is not loaded is offered', !gated.some(s => offered.includes(s)), gated.filter(s => offered.includes(s)).join(','));
  // A second job saved with Ohio (before the list was trimmed) still opens, and says why instead of a figure.
  await setJob(page, 'US', { usState: 'TX' }, 80000);
  await page.evaluate(() => {
    window.__GSC.addJob();
    window.__GSC.pickJob(0);
    window.__GSC.JOBS()[1].usState = 'OH';
    window.__GSC.render();
  });
  const v = await page.evaluate(() => document.getElementById('verdict').innerText);
  check('a saved job in a state not loaded shows the reason, not a number', /Ohio is not covered/i.test(v), v.slice(0, 160));
  // As the form's job, a state the list no longer holds keeps the default (California).
  const st = await page.evaluate(() => { window.__GSC.writeJob({ country: 'US', usState: 'OH' }); return document.getElementById('usState').value; });
  check('as the form\'s job it falls back to the default state', st === 'CA', st);
  check('no page errors on a state not loaded', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close(); server.close();
console.log(`\npage audit: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
