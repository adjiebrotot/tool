// Rent vs Own Sensitivity: accounting integrity of a comparison across columns.
//
// Columns are only comparable when none of them starts richer or is handed
// more money along the way. This harness holds the page to that, against an
// independent replay of the documented rules (the annuity formula, each
// column's needs, the exchange-rate path), never against the page's own code,
// and to identities that need no replay at all because they fix the answer.
//
// One currency (three homes from cheap to dear, everything automatic):
//   A1  every column starts with the same cash, the largest up-front need
//       (deposit and setup, or a first year of rent and renting costs)
//   A2  every column gets the same budget every year, the largest monthly
//       need of any column that year (repayment plus owning costs, or rent
//       plus renting costs)
//   A3  so no column's cash ever goes below zero
//   A4  the Auto notes name that figure and the column it comes from
//   A5  each column's ledger balances, every year: opening cash + budget +
//       interest earned - what was paid = closing cash
//   A6  the fairness identity: two columns' renters hold exactly the future
//       value of the difference in what their rent cost, and nothing else
//   A7  a set cash and budget reach every column alike
//   A8  a budget too small for a column is flagged on that column, from the
//       first year its cash goes below zero
// Several currencies (stubbed rates: 1 USD = 1.5 AUD = 1.35 SGD = 16,500 IDR):
//   B1  switching multi-currency on with every column in the base changes
//       no figure, and results then read in the base's ISO code
//   B2  every column gets the same cash today and the same budget each month
//       in the base, at its own rate on the day: replayed month by month
//       through an independent interest-parity path
//   B3  FX neutrality: with no rent, a renter's wealth in the base is the
//       same in any currency at any risk-free rate when the rate follows
//       interest parity; held at today's rate the higher rate wins (carry)
//   B4  a home growing by exactly its currency's extra interest is worth the
//       same in the base as one that does not grow in a 0% currency
//   B5  accumulated cost is translated cost by cost at the rate on its day
//   B6  the rate is the live one until typed, a typed one counts, and
//       clearing it goes back to the live one
//   B7  a new base re-quotes everything without changing any column's money
//   B8  a summary CSV saved in multi-currency mode reopens to the same state
//       and the same cashflows; so does a reload (the mini cache)
//   B9  columns in two currencies read as one (multi-currency off) are flagged
// Run: node integrity.mjs
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..', '..');
const MIME = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png'};
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if(p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if(!f.startsWith(ROOT) || !fs.existsSync(f)){ r.writeHead(404); return r.end(); }
  r.writeHead(200, {'content-type': MIME[path.extname(f)] || 'application/octet-stream'});
  fs.createReadStream(f).pipe(r);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const URL_EN = ORIGIN + '/rentvsownhouse/sensitivity/';

// Units per US dollar, as the live feed would send them.
const USD = {USD:1, AUD:1.5, SGD:1.35, IDR:16500, JPY:150, EUR:0.9};
const FEED = {result:'success', time_last_update_unix: Date.UTC(2026, 9, 10)/1000, rates: USD};
const CHART_STUB = 'class Chart{constructor(c,g){this.config=g;}update(){}destroy(){}resetZoom(){}}Chart.register=()=>{};window.Chart=Chart;';

let pass = 0, fail = 0;
const check = (name, ok, detail) => { console.log((ok ? '  PASS  ' : '✗ FAIL  ') + name + (detail ? '  — ' + detail : '')); ok ? pass++ : fail++; };

const browser = await pw.chromium.launch();
async function open(keepStorage){
  const ctx = keepStorage || await browser.newContext({viewport:{width:1500, height:1000}});
  if(!keepStorage){
    await ctx.addInitScript(() => { if(!sessionStorage.getItem('init')){ try{ localStorage.clear(); localStorage.setItem('rvos-tour-v2-seen','1'); sessionStorage.setItem('init','1'); }catch(e){} } });
    await ctx.route('**', route => {
      const u = route.request().url();
      if(u.startsWith(ORIGIN)) return route.continue();
      if(u.includes('open.er-api.com')) return route.fulfill({contentType:'application/json', body: JSON.stringify(FEED)});
      if(/chart\.umd/.test(u)) return route.fulfill({contentType:'text/javascript', body: CHART_STUB});
      if(route.request().resourceType()==='script') return route.fulfill({contentType:'text/javascript', body:''});
      return route.abort();
    });
  }
  const page = await ctx.newPage();
  page.on('pageerror', e => { console.log('PAGEERROR:', e.message); fail++; });
  await page.goto(URL_EN);
  await page.waitForFunction(() => window.RVOFX && window.RVOFX.source() && window.RVOFX.source().kind === 'live', null, {timeout: 10000});
  await page.waitForTimeout(200);
  await page.evaluate(() => { window.__csv = null; RVOExport.downloadCSV = (fn, txt) => { window.__csv = txt; }; window.alert = m => { window.__alert = m; }; });
  page.__ctx = ctx;
  return page;
}

// A table from rows by label, as the summary CSV writes it.
const csvOf = (names, rows) => [['Parameter','Unit',...names], ...rows.map(([l, ...v]) => [l, '', ...v])]
  .map(r => r.map(c => `"${c}"`).join(',')).join('\n') + '\n';
async function upload(page, text){
  await page.setInputFiles('#csvFileInput', {name:'t.csv', mimeType:'text/csv', buffer: Buffer.from(text)});
  await page.waitForTimeout(400);
}
async function flows(page, which, si){
  const txt = await page.evaluate(([w, si]) => { window.__csv = null; document.querySelector(`.btn-scen-action.dl-${w}[data-si="${si}"]`).click(); return window.__csv; }, [which, si]);
  const lines = txt.trim().split('\n').filter(l => !l.startsWith('#'));
  const head = lines[0].split(',');
  return {text: txt, rows: lines.slice(1).map(l => { const c = l.split(','); const o = {}; head.forEach((h, i) => o[h] = c[i] === '' ? null : parseFloat(c[i])); return o; })};
}
const series = (page, i, key) => page.evaluate(([i, key]) => window.__RVOS.series(i, key), [i, key]);
const state = page => page.evaluate(() => window.__RVOS.state());
const planOf = page => page.evaluate(() => window.__RVOS.plan());
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const relNear = (a, b, rel) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));

/* ── The independent replay ───────────────────────────────────────────────
   A simple-mode column with money costs paid yearly and monthly rent: */
function needsOf(c, H){
  const loan = c.price * (1 - c.dp/100);
  const i = c.rate/1200, N = c.term*12;
  const pay = i === 0 ? loan/N : loan*i/(1 - Math.pow(1+i, -N));
  const own  = yr => (yr <= c.term && loan > 0.01 ? pay : 0) + c.ownCost*Math.pow(1+c.ownInfl/100, yr-1)/12;
  const rent = yr => c.rent*Math.pow(1+c.rentInfl/100, yr-1) + c.rentCost*Math.pow(1+c.rentCostInfl/100, yr-1)/12;
  const need = []; for(let yr=1; yr<=H; yr++) need.push(Math.max(own(yr), rent(yr)));
  return {
    upFront: Math.max(c.price*c.dp/100 + c.setup, 12*c.rent + c.rentCost),
    need, rentAt: rent,
  };
}
// Units of a column's currency per unit of the base at the end of month k.
const pathOf = (s0, rCol, rBase, parity) => k => parity ? s0 * Math.pow((1+rCol/100)/(1+rBase/100), k/12) : s0;
const rowsFor = c => [
  ['Property price', c.price], ['Down payment', c.dp], ['Mortgage rate', c.rate], ['Mortgage term', c.term],
  ['House price growth (RPPI)', c.growth], ['Selling cost', c.sell], ['Setup cost type', 'dollar'], ['Setup cost', c.setup],
  ['Own cost type', 'dollar'], ['Own cost frequency', 'yearly'], ['Ongoing cost (own)', c.ownCost], ['Own cost inflation', c.ownInfl],
  ['Rent frequency', 'monthly'], ['Rent amount', c.rent], ['Rent inflation', c.rentInfl],
  ['Rent cost type', 'dollar'], ['Rent cost frequency', 'yearly'], ['Ongoing cost (rent)', c.rentCost], ['Rent cost inflation', c.rentCostInfl],
];
function tableCSV(cols, shared, fx){
  const names = cols.map(c => c.name);
  const rows = [];
  rowsFor(cols[0]).forEach(([label], j) => rows.push([label, ...cols.map(c => rowsFor(c)[j][1])]));
  rows.push(['Time horizon', ...cols.map(() => shared.horizon)]);
  rows.push(['Risk-Free Rate', ...cols.map(c => fx ? c.rfr : shared.rfr)]);
  rows.push(['Initial cash', ...cols.map(() => shared.cash || 0)]);
  rows.push(['Monthly housing budget', ...cols.map(() => shared.budget || 0)]);
  rows.push(['Budget annual increase', ...cols.map(() => shared.inc || 0)]);
  if(fx){
    rows.push(['Base currency', ...cols.map(() => fx.base)]);
    rows.push(['Risk-Free Rate, base currency', ...cols.map(() => fx.baseRfr)]);
    rows.push(['Exchange rate path', ...cols.map(() => fx.path)]);
    rows.push(['Scenario currency', ...cols.map(c => c.cur)]);
    rows.push(['Exchange rate', ...cols.map(c => c.s0 === undefined ? '' : c.s0)]);
  }
  return csvOf(names, rows);
}
const home = o => Object.assign({name:'Home', price:800000, dp:20, rate:6, term:30, growth:4, sell:2.5, setup:30000,
  ownCost:6000, ownInfl:2, rent:2800, rentInfl:3, rentCost:1200, rentCostInfl:2}, o);

/* ═══ A: one currency ═══ */
const H = 30, RFR = 4.5;
const A = [
  home({name:'Cheap flat',  price:420000, setup:16000, ownCost:4200, rent:1900, rate:6.2}),
  home({name:'Mid house',   price:800000}),
  home({name:'Dear house',  price:1600000, setup:85000, ownCost:11000, rent:4200, rate:5.9, growth:5}),
];
{
  const page = await open();
  await upload(page, tableCSV(A, {horizon:H, rfr:RFR}));
  const needs = A.map(c => needsOf(c, H));
  const own = [], rent = [];
  for(let i=0; i<A.length; i++){ own.push(await flows(page, 'own', i)); rent.push(await flows(page, 'rent', i)); }

  // A1
  const icWant = Math.max(...needs.map(n => n.upFront));
  const ic = rent.map(f => f.rows[0].End_Cash);
  check('A1 every column starts with the same cash, the largest up-front need',
    ic.every(v => near(v, icWant, 1)), `columns ${ic.join(' / ')} vs replay ${icWant.toFixed(0)}`);

  // A2
  let worst = 0, at = '';
  for(let yr=1; yr<=H; yr++){
    const want = 12 * Math.max(...needs.map(n => n.need[yr-1]));
    A.forEach((_, i) => { const d = Math.abs(own[i].rows[yr].Ann_Budget - want); if(d > worst){ worst = d; at = `yr ${yr} col ${i}`; } });
  }
  check('A2 every column gets the same budget every year, the largest need of any column that year',
    worst <= 1.5, `largest gap to the replay ${worst.toFixed(2)}${at ? ' at ' + at : ''}`);

  // A3
  const short = [];
  A.forEach((_, i) => { [...own[i].rows, ...rent[i].rows].forEach(r => { if(r.End_Cash < -0.5) short.push(`col ${i} yr ${r.Year}`); }); });
  check('A3 no column\'s cash ever goes below zero', !short.length, short.slice(0, 3).join(', '));

  // A4
  const notes = await page.evaluate(() => [...document.querySelectorAll('.shared-note')].map(n => n.textContent));
  const icFrom = needs.map(n => n.upFront).indexOf(icWant);
  const b1 = Math.max(...needs.map(n => n.need[0])), bFrom = needs.map(n => n.need[0]).indexOf(b1);
  const fmt = v => '$' + Math.round(v).toLocaleString('en-US');
  check('A4 the Auto notes name the figure and the column it comes from',
    notes[0] === `Auto: ${fmt(icWant)} based on ${A[icFrom].name}` && notes[1] === `Auto: ${fmt(b1)}/mo in year 1, based on ${A[bFrom].name}`,
    notes.join(' | '));

  // A5
  const off = [];
  A.forEach((_, i) => {
    own[i].rows.slice(1).forEach(r => { const d = r.Beg_Cash + r.Ann_Budget + r.Interest_Inc - r.Principal_Exp - r.Interest_Exp - r.Ongoing_Exp - r.End_Cash; if(Math.abs(d) > 3) off.push(`own col ${i} yr ${r.Year}: ${d}`); });
    rent[i].rows.slice(1).forEach(r => { const d = r.Beg_Cash + r.Ann_Budget + r.Interest_Inc - r.Rent_Exp - r.Ongoing_Exp - r.End_Cash; if(Math.abs(d) > 3) off.push(`rent col ${i} yr ${r.Year}: ${d}`); });
  });
  check('A5 each column\'s ledger balances every year (opening + budget + interest - paid = closing)', !off.length, off.slice(0, 3).join(' | '));

  // A6: rent cash_X(T) = C(1+i)^12T + sum_k (B_k - c_X,k)(1+i)^(12T-k), the
  // same C and B_k for every column, so the gap is the rent costs' alone.
  const rfm = Math.pow(1 + RFR/100, 1/12) - 1;
  const fvGap = (x, y) => { let s = 0; for(let yr=1; yr<=H; yr++) for(let m=0; m<12; m++){ const k = (yr-1)*12 + m + 1; s += (needs[y].rentAt(yr) - needs[x].rentAt(yr)) * Math.pow(1+rfm, 12*H - k); } return s; };
  const ne = []; for(let i=0; i<A.length; i++) ne.push(await series(page, i, 'rentNetEquity'));
  const g01 = ne[0][H] - ne[1][H], g02 = ne[0][H] - ne[2][H];
  check('A6 two columns\' renters differ by exactly the future value of their rent costs\' difference',
    relNear(g01, fvGap(0, 1), 1e-9) && relNear(g02, fvGap(0, 2), 1e-9),
    `gap ${g01.toFixed(2)} vs replay ${fvGap(0,1).toFixed(2)}; ${g02.toFixed(2)} vs ${fvGap(0,2).toFixed(2)}`);

  // A7
  await upload(page, tableCSV(A, {horizon:H, rfr:RFR, cash:2000000, budget:9000, inc:3}));
  const c7 = [], b7 = [];
  for(let i=0; i<A.length; i++){ const f = await flows(page, 'rent', i); c7.push(f.rows[0].End_Cash); b7.push(f.rows.slice(1).every((r, y) => near(r.Ann_Budget, 108000*Math.pow(1.03, y), 1))); }
  check('A7 a set cash and budget (with its increase) reach every column alike', c7.every(v => v === 2000000) && b7.every(Boolean), `cash ${c7.join(' / ')}, budgets ${b7.join(' / ')}`);

  // A8
  await upload(page, tableCSV(A, {horizon:H, rfr:RFR, budget:3000}));
  const subs = await page.evaluate(() => [...document.querySelectorAll('.scen-header-notes')].map(n => n.textContent));
  const firstNeg = [];
  for(let i=0; i<A.length; i++){ const f = await flows(page, 'own', i); const r = f.rows.find(r => r.End_Cash < -0.5); firstNeg.push(r ? r.Year : null); }
  const ok8 = firstNeg.every((y, i) => y === null ? !/Own cash below zero/.test(subs[i]) : subs[i].includes(`Own cash below zero from year ${y}`));
  check('A8 a budget too small for a column is flagged on it, from the first year its cash goes below zero',
    ok8 && firstNeg.some(y => y !== null), `first negative years ${firstNeg.join(' / ')}; notes ${subs.join(' | ')}`);
  await page.close();
}

/* ═══ B: several currencies ═══ */
{
  // B1
  const page = await open();
  await upload(page, tableCSV(A.slice(0, 2), {horizon:H, rfr:RFR}));
  const before = [await flows(page, 'own', 0), await flows(page, 'rent', 1)].map(f => f.text).join('\n');
  await page.click('#fxModeToggle'); await page.waitForTimeout(200);
  const after = [await flows(page, 'own', 0), await flows(page, 'rent', 1)].map(f => f.text.split('\n').filter(l => !l.startsWith('# Figures')).join('\n')).join('\n');
  const out = await page.evaluate(() => document.querySelector('tr.out-own td.scen-td').textContent);
  const st = await state(page);
  check('B1 multi-currency on, every column in the base: no figure moves, results read in the base\'s code',
    before === after && /^AUD /.test(out) && st.fx.on && st.scenarios.every(s => s.currency === 'AUD'), `${out}, base ${st.fx.base}`);
  await page.close();
}

const MC = [
  home({name:'Melbourne', cur:'AUD', rfr:4.6, price:900000, setup:50000, ownCost:7000, rent:2600, rate:6.3}),
  home({name:'Singapore', cur:'SGD', rfr:2.0, s0:0.9, price:1300000, dp:25, setup:40000, ownCost:4000, rent:3800, rate:2.6, growth:3}),
  home({name:'Jakarta',   cur:'IDR', rfr:5.5, s0:11000, price:2500000000, setup:150000000, ownCost:25000000, rent:9000000, rate:9.5, term:20, rentInfl:4}),
];
{
  // B2
  const page = await open();
  for(const parity of [true, false]){
    const fx = {base:'AUD', baseRfr:4.6, path: parity ? 'parity' : 'hold'};
    await upload(page, tableCSV(MC, {horizon:H}, fx));
    const s0 = MC.map(c => c.s0 || 1);
    const paths = MC.map((c, i) => pathOf(s0[i], c.rfr, fx.baseRfr, parity));
    const needs = MC.map(c => needsOf(c, H));
    const icBase = Math.max(...needs.map((n, i) => n.upFront / s0[i]));
    const B = []; for(let k=0; k<12*H; k++){ const yr = Math.floor(k/12) + 1; B.push(Math.max(...needs.map((n, i) => n.need[yr-1] / paths[i](k+1)))); }
    let icGap = 0, bGap = 0, at = '';
    for(let i=0; i<MC.length; i++){
      const f = await flows(page, 'rent', i);
      // The cashflow file holds whole units, so half a unit is the rounding.
      icGap = Math.max(icGap, Math.max(0, Math.abs(f.rows[0].End_Cash - icBase*s0[i]) - 0.5) / Math.max(1, icBase*s0[i]));
      for(let yr=1; yr<=H; yr++){
        let want = 0; for(let m=0; m<12; m++){ const k = (yr-1)*12 + m; want += B[k] * paths[i](k+1); }
        const g = Math.max(0, Math.abs(f.rows[yr].Ann_Budget - want) - 0.5) / Math.max(1, want);
        if(g > bGap){ bGap = g; at = `${MC[i].name} yr ${yr}: ${f.rows[yr].Ann_Budget} vs ${want.toFixed(0)}`; }
      }
    }
    check(`B2 ${parity ? 'interest parity' : 'rate held'}: the same cash today and the same budget each month in AUD, at each column's own rate`,
      icGap < 1e-9 && bGap < 1e-9, `largest relative gap: cash ${icGap.toExponential(1)}, budget ${bGap.toExponential(1)}${at ? ' (' + at + ')' : ''}`);
    if(parity){
      const short = [];
      for(let i=0; i<MC.length; i++) for(const w of ['own', 'rent']) (await flows(page, w, i)).rows.forEach(r => { if(r.End_Cash < -0.5) short.push(`${MC[i].name} ${w} yr ${r.Year}`); });
      check('B2 interest parity: no column runs short in any currency', !short.length, short.slice(0, 3).join(', '));
    }
  }
  await page.close();
}
{
  // B3: no rent, no renting costs; a renter only holds the shared money.
  const page = await open();
  const noRent = o => home(Object.assign({rent:0, rentCost:0}, o));
  const cols = [noRent({name:'AUD at 4%', cur:'AUD', rfr:4}), noRent({name:'IDR at 9%', cur:'IDR', rfr:9, s0:11000, price:8800000000, setup:330000000, ownCost:66000000}),
                noRent({name:'JPY at 0.5%', cur:'JPY', rfr:0.5, s0:100, price:80000000, setup:3000000, ownCost:600000})];
  await upload(page, tableCSV(cols, {horizon:H}, {base:'AUD', baseRfr:4, path:'parity'}));
  const ne = []; for(let i=0; i<cols.length; i++) ne.push(await series(page, i, 'rentNetEquity'));
  let worst = 0; for(let y=0; y<=H; y++) for(let i=1; i<cols.length; i++) worst = Math.max(worst, Math.abs(ne[i][y] - ne[0][y]) / ne[0][y]);
  check('B3 interest parity: a renter\'s wealth in AUD is the same in AUD at 4%, IDR at 9% and JPY at 0.5%, every year',
    worst < 1e-9, `largest relative gap ${worst.toExponential(2)}; year ${H}: ${ne.map(s => Math.round(s[H])).join(' / ')}`);
  await upload(page, tableCSV(cols, {horizon:H}, {base:'AUD', baseRfr:4, path:'hold'}));
  const held = []; for(let i=0; i<cols.length; i++) held.push(await series(page, i, 'rentNetEquity'));
  check('B3 rate held: the 9% currency now beats the 4% one and the 0.5% one trails (carry, not housing)',
    held[1][H] > held[0][H] * 1.5 && held[2][H] < held[0][H] * 0.7, `year ${H}: ${held.map(s => Math.round(s[H])).join(' / ')}`);
  await page.close();
}
{
  // B4: all cash, no costs, no rent. AUD earns 0% and the home does not
  // grow; IDR earns 10% and its home grows 10%: the same home in AUD.
  const page = await open();
  const bare = o => home(Object.assign({dp:100, setup:0, ownCost:0, rent:0, rentCost:0, sell:3}, o));
  const cols = [bare({name:'AUD 0%', cur:'AUD', rfr:0, price:600000, growth:0}), bare({name:'IDR 10%', cur:'IDR', rfr:10, s0:11000, price:6600000000, growth:10})];
  await upload(page, tableCSV(cols, {horizon:H}, {base:'AUD', baseRfr:0, path:'parity'}));
  const a = await series(page, 0, 'ownNetEquity'), b = await series(page, 1, 'ownNetEquity');
  let worst = 0; for(let y=0; y<=H; y++) worst = Math.max(worst, Math.abs(a[y] - b[y]) / a[y]);
  check('B4 a home growing by exactly its currency\'s extra interest is worth the same in AUD every year',
    worst < 1e-9 && near(a[H], 600000*0.97, 1e-6), `largest relative gap ${worst.toExponential(2)}; year ${H}: ${a[H].toFixed(2)} / ${b[H].toFixed(2)}`);
  await page.close();
}
{
  // B5: an IDR home with only a fixed owning cost (no loan, no inflation).
  const page = await open();
  const C = 24000000, s0 = 11000;
  const cols = [home({name:'AUD', cur:'AUD', rfr:4}), home({name:'IDR', cur:'IDR', rfr:8, s0, dp:100, setup:0, ownCost:C, ownInfl:0, price:5000000000})];
  for(const parity of [true, false]){
    await upload(page, tableCSV(cols, {horizon:H}, {base:'AUD', baseRfr:4, path: parity ? 'parity' : 'hold'}));
    const got = await series(page, 1, 'ownAccumCost');
    const p = pathOf(s0, 8, 4, parity);
    let want = 0, worst = 0;
    for(let yr=1; yr<=H; yr++){ for(let m=1; m<=12; m++) want += (C/12) / p((yr-1)*12 + m); worst = Math.max(worst, Math.abs(got[yr] - want) / want); }
    check(`B5 ${parity ? 'interest parity' : 'rate held'}: accumulated cost in AUD is each month's cost at that month's rate`,
      worst < 1e-9, `year ${H}: ${got[H].toFixed(2)} vs replay ${want.toFixed(2)}`);
  }
  await page.close();
}
{
  // B6: Melbourne + Jakarta from Quick Start, live rates.
  const page = await open();
  const pick = (si, sid) => page.evaluate(async ([si, sid]) => {
    document.querySelector('.scen-preset[data-si="'+si+'"]').click();
    await new Promise(r => setTimeout(r, 20));
    document.querySelector('.scen-preset-pop .combo-opt[data-sid="'+sid+'"]').dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true}));
  }, [si, sid]);
  await pick(0, 'melbourne/apt-1br'); await pick(1, 'jakarta/apt-2br'); await page.waitForTimeout(200);
  const live = USD.IDR / USD.AUD;
  const read = () => page.evaluate(() => ({v: document.querySelector('.fx-input[data-si="1"]').value, note: document.querySelector('[data-fx-note="1"]').textContent, s0: window.__RVOS.plan().items[1].s0}));
  const r1 = await read();
  const typeRate = async v => { await page.evaluate(v => { const el = document.querySelector('.fx-input[data-si="1"]'); el.focus(); el.value = v; el.blur(); }, v); await page.waitForTimeout(150); };
  await typeRate('12000'); const r2 = await read();
  await typeRate(''); const r3 = await read();
  check('B6 the live rate until one is typed, the typed one counts, clearing returns to live',
    r1.s0 === live && r1.v === '11,000' && /Live rate, 10 Oct 2026/.test(r1.note) && r2.s0 === 12000 && /Your rate/.test(r2.note) && r3.s0 === live,
    JSON.stringify([r1, r2, r3]));

  // B7: a set cash, base AUD, rate held; then base USD.
  await page.evaluate(() => { const el = document.querySelector('.fxpath-select'); el.value = 'hold'; el.dispatchEvent(new Event('change', {bubbles:true})); });
  await page.evaluate(() => { const el = document.querySelector('.shared-input[data-key="initialCash"]'); el.focus(); el.value = '1500000'; el.blur(); });
  await page.waitForTimeout(150);
  const localBefore = [await flows(page, 'rent', 0), await flows(page, 'rent', 1)].map(f => f.rows.map(r => r.End_Cash));
  const audNE = [await series(page, 0, 'ownNetEquity'), await series(page, 1, 'ownNetEquity')];
  await page.selectOption('#baseCurrencySelect', 'USD'); await page.waitForTimeout(200);
  const st = await state(page);
  const localAfter = [await flows(page, 'rent', 0), await flows(page, 'rent', 1)].map(f => f.rows.map(r => r.End_Cash));
  const usdNE = [await series(page, 0, 'ownNetEquity'), await series(page, 1, 'ownNetEquity')];
  const k = USD.USD / USD.AUD;
  const moneyKept = localBefore.every((col, i) => col.every((v, y) => Math.abs(v - localAfter[i][y]) <= Math.max(2, Math.abs(v)*1e-8)));
  const translated = audNE.every((col, i) => col.every((v, y) => relNear(usdNE[i][y], v*k, 1e-8)));
  check('B7 a new base re-quotes the set cash (AUD 1.5m is USD 1m) and every column\'s money stays the same',
    st.fx.base === 'USD' && st.shared.initialCash === 1000000 && moneyKept && translated,
    `cash ${st.shared.initialCash} ${st.fx.base}; local money kept ${moneyKept}; results translated ${translated}`);

  // B8: summary CSV round trip, then a reload.
  const csv = await page.evaluate(() => { let t = null; const orig = RVOExport.cleanCSV; RVOExport.cleanCSV = s => { t = s; return orig(s); };
    URL.createObjectURL = () => 'blob:stub'; HTMLAnchorElement.prototype.click = function(){}; document.getElementById('downloadCSVBtn').click(); RVOExport.cleanCSV = orig; return t; });
  const flowsOf = async p => { const out = []; for(let i=0; i<2; i++) for(const w of ['own', 'rent']) out.push((await flows(p, w, i)).text); return out.join('\n'); };
  const ref = await flowsOf(page);
  const page2 = await open();
  await upload(page2, csv);
  const st2 = await state(page2);
  const same = (x, y) => JSON.stringify({sh:x.shared, base:x.fx.base, path:x.fx.path, on:x.fx.on, cur:x.scenarios.map(s => s.currency)})
                      === JSON.stringify({sh:y.shared, base:y.fx.base, path:y.fx.path, on:y.fx.on, cur:y.scenarios.map(s => s.currency)});
  const got2 = await flowsOf(page2);
  check('B8 a summary CSV saved in multi-currency mode reopens to the same state and cashflows',
    same(st, st2) && got2 === ref, JSON.stringify(st2.fx));
  await page2.close();
  await page.waitForTimeout(600); // let the mini cache save
  await page.reload();
  await page.waitForFunction(() => window.RVOFX && window.RVOFX.source(), null, {timeout: 10000});
  await page.waitForTimeout(300);
  await page.evaluate(() => { RVOExport.downloadCSV = (fn, txt) => { window.__csv = txt; }; });
  const page3 = page;
  check('B8 a reload brings the same state and cashflows back (mini cache)', same(st, await state(page3)) && (await flowsOf(page3)) === ref);

  // B9: off again, the AUD and IDR columns are read as one money: flagged.
  await page3.click('#fxModeToggle'); await page3.waitForTimeout(200);
  const warn = await page3.evaluate(() => { const w = document.getElementById('fxWarn'); return w.hidden ? '' : w.textContent; });
  check('B9 columns in two currencies read as one (multi-currency off) are flagged', /AUD/.test(warn) && /IDR/.test(warn), warn);
  await page.close();
}

await browser.close();
server.close();
console.log(`\nsensitivity integrity audit: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
