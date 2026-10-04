// Cost of Living Comparator: column drag audit (Detailed mode).
//
// Every city column in the Detailed table can be dragged, and whichever city
// lands first becomes the From city. The promise is that a move rearranges
// the table and changes no figure: each city keeps every number its column
// showed, in its own currency. So the tests read the table off the screen,
// city by city, before and after a move, and compare:
//
//   D1  "I need to earn": a destination dragged onto From takes its required
//       salary as its typed income, the old From city's required salary comes
//       out at the income it had, every savings ratio still matches, and no
//       cell turns into an override (the index ratio cancels through the
//       middle city). The new From income is also replayed from the raw JSON.
//   D2  dragging it back is an exact round trip: the state is the original
//   D3  reordering destinations only moves columns; From is untouched
//   D4  "I can save" with a custom rate and an override on the city being
//       promoted (moved with the keyboard): every figure holds, the old From
//       income becomes its column's typed income, the custom rate is re-quoted
//       (the old From column takes its inverse), and the cells the new From
//       city cannot give back by estimate are kept as overrides
//   D5  nominal target with custom frequency (weekly income, a per-meal row)
//   D6  Escape mid-drag, and a drop back on the starting place, change nothing
//
// Run: node drag.mjs
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const MIME = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
const server = http.createServer((req,res)=>{
  const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/,'/index.html'));
  if(!existsSync(p)){ res.writeHead(404); res.end(); return; }
  res.writeHead(200, {'content-type': MIME[extname(p)]||'application/octet-stream'});
  res.end(readFileSync(p));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const PAGE = `http://127.0.0.1:${server.address().port}/costofliving-comparator/index.html`;

let pass=0, fail=0;
const check=(name,ok,detail)=>{ console.log((ok?'  PASS  ':'✗ FAIL  ')+name+(detail?'  — '+detail:'')); ok?pass++:fail++; };
const section=t=>console.log('\n'+t);

/* ── independent replay of a Quick Start required salary, from the JSON ── */
const col   = JSON.parse(readFileSync(join(HERE,'..','cost_of_living_indices_aggregated.json'),'utf8'));
const rates = JSON.parse(readFileSync(join(HERE,'..','currency_rates.json'),'utf8'));
const RATE  = Object.fromEntries(rates.data.map(r=>[r.currency,r.usd_rate]));
const CITY  = Object.fromEntries(col.data.map(c=>[c.city+'|'+c.country,c]));
const pos = v => (v!=null && v>0) ? v : null;
function index(c, cat){
  const u = c.utilities_index||{};
  switch(cat){
    case 'rent':       return pos(c.rent_index&&c.rent_index.med);
    case 'groceries':  return pos(c.groceries_index);
    case 'eating_out': return pos(c.eating_out_index);
    case 'other':      return pos(c.coli_no_housing);
    case 'utilities': {
      let a=0,w=0; [['electricity',.5],['water',.2],['gas',.3]].forEach(([k,wt])=>{const v=pos(u[k]&&u[k].Median); if(v){a+=wt*v;w+=wt;}});
      return w?a/w:null;
    }
  }
  return null;
}
const estimate=(amt,from,to,cat)=>amt/RATE[from.currency]*(index(to,cat)/index(from,cat))*RATE[to.currency];

/* ── page driving ─────────────────────────────────────────────────────── */
const browser = await chromium.launch();
const page = await (await browser.newContext({viewport:{width:1700,height:1000}})).newPage();
page.on('pageerror', e=>{ console.log('PAGEERROR:', e.message); fail++; });
await page.addInitScript(()=>{ try{ localStorage.setItem('col-tour-v1-seen','1'); localStorage.setItem('col-tour-v2-seen','1'); }catch(e){} });
// No network: the live-rate feeds fail and the bundled rates are used.
await page.route('**/*', route=>route.request().url().includes('127.0.0.1') ? route.continue() : route.fulfill({contentType:'application/javascript', body:'/* stub */'}));
await page.goto(PAGE, {waitUntil:'load'});
await page.waitForFunction(()=>document.getElementById('dataUpdatedText')?.textContent.length>0);

const state = () => page.evaluate(()=>window.__COL_TOUR.saveState());
const setState = s => page.evaluate(s=>window.__COL_TOUR.restoreState(s), s);
const quick = async id => { await page.click(`.quick-start-btn[data-preset="${id}"]`); await page.waitForTimeout(80); };

// Every figure on screen, one entry per city column, From first.
const readTable = () => page.evaluate(()=>{
  const t=document.querySelector('#detailSec table.dt');
  const n=t.querySelectorAll('[data-col-grip]').length;
  const num=s=>{const v=parseFloat(String(s??'').replace(/,/g,'').replace(/[^\d.\-]/g,''));return isFinite(v)?v:null;};
  const heads=[...t.tHead.rows[0].cells].slice(1,1+n);
  const salCells=[...t.querySelector('tr.salary-tr').cells].slice(1,1+n);
  const savCells=[...t.querySelector('tr.savings-tr').cells].slice(1,1+n);
  const rows=[...t.querySelectorAll('tbody tr[data-ri]')].map(tr=>[...tr.cells].slice(1,1+n));
  return heads.map((th,j)=>({
    city: th.querySelector('.city-search').value,
    curr: th.querySelector('.sub-num').textContent.trim(),
    sal: (()=>{const td=salCells[j], inp=td.querySelector('input'); return inp?num(inp.value):num(td.querySelector('span').textContent);})(),
    exp: rows.map(cells=>{const inp=cells[j].querySelector('input.dt-from-exp,input.dt-to-exp'); return inp?num(inp.value!==''?inp.value:inp.placeholder):null;}),
    ov: rows.map(cells=>cells[j].classList.contains('overridden')),
    sav: num(savCells[j].children[0]?.textContent),
    ratio: num(savCells[j].children[1]?.textContent),
  }));
});
// Same figure to what the screen shows: estimates read off placeholders are
// whole units, typed fields keep cents.
const near=(a,b)=> a==null||b==null ? a===b : Math.abs(a-b) <= 0.51 + 1e-9*Math.abs(a);
function sameByCity(before, after){
  const bad=[];
  before.forEach(b=>{
    const a=after.find(x=>x.city===b.city);
    if(!a){ bad.push(b.city+' missing'); return; }
    if(a.curr!==b.curr) bad.push(`${b.city} currency ${b.curr}→${a.curr}`);
    if(!near(a.sal,b.sal)) bad.push(`${b.city} income ${b.sal}→${a.sal}`);
    b.exp.forEach((v,i)=>{ if(!near(a.exp[i],v)) bad.push(`${b.city} row ${i} ${v}→${a.exp[i]}`); });
    if(!near(a.sav,b.sav)) bad.push(`${b.city} savings ${b.sav}→${a.sav}`);
    if(b.ratio!=null&&a.ratio!=null&&Math.abs(a.ratio-b.ratio)>0.051) bad.push(`${b.city} ratio ${b.ratio}→${a.ratio}`);
  });
  return bad;
}
// A real pointer drag: the grip is carried just past the target column's
// middle (or left where it is, for a drop back on its own place).
async function dragCol(from, to, opts={}){
  const g=await page.locator(`[data-col-grip="${from}"]`).boundingBox();
  const ht=await page.locator(`#detailSec thead th:has([data-col-grip="${to}"])`).boundingBox();
  const sx=g.x+g.width/2, sy=g.y+g.height/2;
  const dx=to===from?30:(ht.x+ht.width/2)+(to<from?-12:12)-sx;
  await page.mouse.move(sx,sy);
  await page.mouse.down();
  await page.mouse.move(sx+dx/2,sy,{steps:6});
  await page.mouse.move(sx+dx,sy,{steps:6});
  await page.waitForTimeout(60);
  if(opts.escape) await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.waitForTimeout(100);
}
const cities = t => t.map(c=>c.city.split(',')[0]).join(', ');

/* ── D1 / D2: earn, savings ratio ─────────────────────────────────────── */
section('D1  "I need to earn": a destination dragged onto From');
await quick('sg-au');
const s0=await state();
const t0=await readTable();
await dragCol(2, 0);                       // Melbourne onto From
const t1=await readTable(), s1=await state();
check('D1a Melbourne is the From city and Singapore the first destination', cities(t1)==='Melbourne, Singapore, Sydney, Brisbane, Perth', cities(t1));
let bad=sameByCity(t0,t1);
check('D1b every city keeps every figure it showed', !bad.length, bad.slice(0,4).join('; ')||'5 cities, income, 5 rows, savings, ratio');
check('D1c Melbourne\'s required salary is now its typed income', near(t1[0].sal,t0[2].sal), `AUD ${t0[2].sal} → ${t1[0].sal}`);
check('D1d Singapore now needs exactly the income it had', Math.abs(t1[1].sal-8000)<=0.51, `SGD ${t1[1].sal}`);
check('D1e no cell became an override', t1.every(c=>c.ov.every(o=>!o)) && s1.detailRows.every(r=>!Object.keys(r.overrides).length));
check('D1f every savings ratio still matches home (25%)', t1.every(c=>Math.abs(c.ratio-25)<0.051), t1.map(c=>c.ratio).join(' / '));
{ // replay the promoted income from the raw JSON: home budget scaled, over (1 - home ratio)
  const sg=CITY[s0.detailFromKey], mel=CITY[s0.detailToCities[1]];
  const exp=s0.detailRows.reduce((t,r)=>t+estimate(r.fromAmount,sg,mel,r.catId),0);
  const fExp=s0.detailRows.reduce((t,r)=>t+r.fromAmount,0);
  const req=exp/(1-(s0.detailFromSalary-fExp)/s0.detailFromSalary);
  check('D1g the new From income equals the required salary replayed from the JSON', Math.abs(s1.detailFromSalary-req)<1e-6, `AUD ${req.toFixed(4)} vs ${s1.detailFromSalary.toFixed(4)}`);
}

section('D2  dragging it back is an exact round trip');
await dragCol(1, 0);                       // Singapore back onto From
await dragCol(1, 2);                       // and Melbourne back behind Sydney
const s2=await state();
check('D2a the cities are back in their original order', s2.detailFromKey===s0.detailFromKey && JSON.stringify(s2.detailToCities)===JSON.stringify(s0.detailToCities));
check('D2b the From income is the original to the cent', Math.abs(s2.detailFromSalary-s0.detailFromSalary)<1e-6, `${s2.detailFromSalary}`);
check('D2c every From amount is the original', s2.detailRows.every((r,i)=>Math.abs(r.fromAmount-s0.detailRows[i].fromAmount)<1e-6));
check('D2d and still no override anywhere', s2.detailRows.every(r=>!Object.keys(r.overrides).length));

/* ── D3: destinations only ────────────────────────────────────────────── */
section('D3  reordering destinations only');
await quick('sg-au');
const t3a=await readTable(), s3a=await state();
await dragCol(4, 1);                       // Perth to the first destination
const t3b=await readTable(), s3b=await state();
check('D3a Perth is now the first destination', cities(t3b)==='Singapore, Perth, Sydney, Melbourne, Brisbane', cities(t3b));
bad=sameByCity(t3a,t3b);
check('D3b every city keeps every figure', !bad.length, bad.slice(0,4).join('; '));
check('D3c the From city and its figures are untouched', s3b.detailFromKey===s3a.detailFromKey && s3b.detailFromSalary===s3a.detailFromSalary && s3b.detailRows.every((r,i)=>r.fromAmount===s3a.detailRows[i].fromAmount));

/* ── D4: save mode, custom rate, override, keyboard ───────────────────── */
section('D4  "I can save" with a custom rate and an override, by keyboard');
await quick('sea');
{
  const s=await state();
  s.goal='save';
  s.detailToSalaries=[9000, 60000, 30000000];       // MYR, THB, VND
  s.customFxDetailed=[3600, null, null];            // IDR per 1 MYR (market is about 3,500)
  s.detailRows[0].overrides={'0':2500};             // KL rent typed in
  s.detailRows[1].overrides={'1':9000};             // Bangkok groceries typed in
  await setState(s);
}
const t4a=await readTable(), s4a=await state();
await page.focus('[data-col-grip="1"]');
await page.keyboard.press('ArrowLeft');             // Kuala Lumpur onto From
await page.waitForTimeout(100);
const t4b=await readTable(), s4b=await state();
check('D4a Kuala Lumpur is the From city, Jakarta the first destination', cities(t4b)==='Kuala Lumpur, Jakarta, Bangkok, Ho Chi Minh City', cities(t4b));
bad=sameByCity(t4a,t4b);
check('D4b every city keeps every figure it showed', !bad.length, bad.slice(0,4).join('; ')||'4 cities');
check('D4c Kuala Lumpur\'s typed income is the From income', s4b.detailFromSalary===9000);
check('D4d Jakarta\'s income moves to its column as typed income', s4b.detailToSalaries[0]===25000000 && s4b.detailToSalaries[1]===60000);
check('D4e Jakarta\'s column takes the inverse of the custom rate', Math.abs(s4b.customFxDetailed[0]-1/3600)<1e-15, `${s4b.customFxDetailed[0]}`);
{
  const mkt=RATE.MYR/RATE.THB;   // MYR per 1 THB, the market cross rate
  check('D4f Bangkok\'s rate is re-quoted in MYR, keeping the IDR crossing', Math.abs(s4b.customFxDetailed[1]-(RATE.IDR/RATE.THB)/3600)<1e-12, `${s4b.customFxDetailed[1]} vs market ${mkt}`);
}
check('D4g the typed KL rent is now the From rent', s4b.detailRows[0].fromAmount===2500);
check('D4h the typed Bangkok groceries stay an override', s4b.detailRows[1].overrides['1']===9000 && t4b[2].ov[1]);
check('D4i the moved figures are flagged where an estimate would not give them back', t4b.slice(1).some(c=>c.ov.some(Boolean)), t4b.map(c=>c.ov.filter(Boolean).length).join(' / ')+' overrides per column');
await page.focus('[data-col-grip="1"]');
check('D4j the grip keeps focus after the move', await page.evaluate(()=>document.activeElement?.dataset.colGrip==='1'));

/* ── D5: nominal, custom frequency ────────────────────────────────────── */
section('D5  nominal target with custom frequency');
await quick('eu');
{
  const s=await state();
  s.savingsTarget='nominal'; s.customFreq=true; s.detailIncomeFreq='weekly';
  s.detailFromSalary=4500*12/52;
  s.detailRows[2]={catId:'eating_out', fromAmount:25, unit:'meal', qty:4, qtyPer:'weekly', qtyUnit:'meal', overrides:{}};
  await setState(s);
}
const t5a=await readTable();
await dragCol(3, 0);                       // Berlin onto From
const t5b=await readTable(), s5b=await state();
check('D5a Berlin is the From city', cities(t5b)==='Berlin, London, Paris, Amsterdam', cities(t5b));
bad=sameByCity(t5a,t5b);
check('D5b every city keeps every figure, per week and per meal', !bad.length, bad.slice(0,4).join('; ')||'4 cities');
check('D5c the meal row keeps its unit and quantity', s5b.detailRows[2].unit==='meal' && s5b.detailRows[2].qty===4 && s5b.detailRows[2].qtyPer==='weekly');
check('D5d London needs exactly the weekly income it had', Math.abs(t5b[1].sal-4500*12/52)<=0.51, `GBP ${t5b[1].sal}`);

/* ── D6: cancels ──────────────────────────────────────────────────────── */
section('D6  a drag that is cancelled changes nothing');
await quick('us');
const s6a=await state();
await dragCol(2, 0, {escape:true});
check('D6a Escape mid-drag leaves the state as it was', JSON.stringify(await state())===JSON.stringify(s6a));
await dragCol(2, 2);
check('D6b dropping a column back on its own place leaves the state as it was', JSON.stringify(await state())===JSON.stringify(s6a));
check('D6c no drag styling is left behind', await page.evaluate(()=>!document.querySelector('.col-drag-src,.col-drop-line') && !document.body.classList.contains('col-dragging')));

await browser.close();
server.close();
console.log(`\ncolumn drag audit: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
