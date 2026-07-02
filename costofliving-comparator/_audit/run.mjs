// Cost of Living Comparator — end-to-end audit.
// Serves the repo over localhost (the page fetches its JSON data), drives the
// REAL page headless and mimics a user:
//   C1  simple mode: baseline estimated-expense math vs independent recompute
//   C2  simple mode: set a CUSTOM FX rate → the summary's nominal-savings
//       difference must use it (the ≈-conversions in the cells do)
//   C3  detailed mode: override a destination cell on row 2, then delete row 1
//       → the override must survive on the surviving row
//   C4  data: every city currency must exist in currency_rates.json (missing
//       ones silently convert at 1:1 with USD)
// Run: node run.mjs
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');   // repo root (page loads ../shared.js etc.)

const MIME = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const server = http.createServer((req,res)=>{
  const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/,'/index.html'));
  if(!existsSync(p)){ res.writeHead(404); res.end(); return; }
  res.writeHead(200, {'content-type': MIME[extname(p)]||'application/octet-stream'});
  res.end(readFileSync(p));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const PORT = server.address().port;
const PAGE = `http://127.0.0.1:${PORT}/costofliving-comparator/index.html`;

let pass=0, fail=0;
const check=(name,ok,detail)=>{ console.log((ok?'  PASS  ':'✗ FAIL  ')+name+(detail?'  — '+detail:'')); ok?pass++:fail++; };

// data for expected-value math
const col = JSON.parse(readFileSync(join(HERE,'..','cost_of_living_indices_aggregated.json'),'utf8'));
const rates = JSON.parse(readFileSync(join(HERE,'..','currency_rates.json'),'utf8'));
const RATE = Object.fromEntries(rates.data.map(r=>[r.currency,r.usd_rate]));
const cityIdx = Object.fromEntries(col.data.map(c=>[c.city+'|'+c.country, c]));
const JKT = cityIdx['Jakarta|Indonesia'], PER = cityIdx['Perth|Australia'];

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e=>console.log('PAGEERROR:', e.message));
await page.route('**/*', route=>{
  const u=route.request().url();
  if(u.includes('127.0.0.1')) return route.continue();
  return route.fulfill({contentType:'application/javascript', body:'/* stub */'});
});
await page.goto(PAGE, {waitUntil:'load'});
await page.waitForFunction(()=>document.getElementById('dataUpdatedText')?.textContent.length>0);

async function pickCity(containerId, key){
  await page.evaluate(({containerId,key})=>{
    const wrap=document.getElementById(containerId);
    const input=wrap.querySelector('input.city-search');
    input.value=key.split('|')[0];
    input.dispatchEvent(new Event('input'));
    const opt=[...wrap.querySelectorAll('.city-opt')].find(o=>o.dataset.key===key);
    opt.dispatchEvent(new MouseEvent('mousedown'));
  },{containerId,key});
  await page.waitForTimeout(80);
}
const setVal=async (id,v)=>{ await page.evaluate(({id,v})=>{ const el=document.getElementById(id); el.value=v; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('blur')); },{id,v}); await page.waitForTimeout(80); };
const num=s=>parseFloat(String(s).replace(/,/g,'').replace(/[^\d.\-]/g,''));

// ── setup: Jakarta → Perth, salaries in simple "I can save" mode ──
await pickCity('fromPicker','Jakarta|Indonesia');
await pickCity('toPicker','Perth|Australia');
const FS=50000000, FE=30000000, TS=6000;      // IDR, IDR, AUD
await setVal('ss_fs', FS.toLocaleString('en-US'));
await setVal('ss_fe', FE.toLocaleString('en-US'));
await setVal('ss_ts', TS.toLocaleString('en-US'));

const fi=JKT.coli_with_housing, ti=PER.coli_with_housing;
const fr=RATE.IDR, tr=RATE.AUD;               // units per USD
const defaultFx = fr/tr;                      // IDR per AUD

function expected(fx){ // fx = IDR per 1 AUD
  const te = FE*(1/fx)*(ti/fi);               // est. expenses in AUD
  const fSav=FS-FE, tSav=TS-te;
  const nomDiffAUD = tSav - fSav/fx;          // common-currency diff in AUD
  return {te, nomDiffAUD};
}

// ── C1: baseline (DB rates) — estimated expense + summary diff ──
{
  const e = expected(defaultFx);
  const got = await page.evaluate(()=>{
    const cols=document.querySelectorAll('.col-card');
    return { te: cols[1].querySelectorAll('.sav-val')[0].textContent,
             summary: document.getElementById('ss_summary').textContent };
  });
  const teOk = Math.abs(num(got.te)-e.te) <= 1;
  const m = got.summary.match(/AUD\s*([\d,]+)/);
  const sumOk = m && Math.abs(num(m[1])-Math.abs(e.nomDiffAUD)) <= 1;
  check('C1 baseline estimated expenses + summary match independent recompute', teOk&&sumOk,
    `est ${got.te} vs ${e.te.toFixed(0)}; summary diff ${m&&m[1]} vs ${Math.abs(e.nomDiffAUD).toFixed(0)}`);
}

// ── C2: custom FX — summary must follow the custom rate ──
{
  const customFx = Math.round(defaultFx*2);   // user thinks the AUD is 2× stronger
  await setVal('simpleFxInput', String(customFx));
  const e = expected(customFx);
  const got = await page.evaluate(()=>document.getElementById('ss_summary').textContent);
  const m = got.match(/AUD\s*([\d,]+)/);
  check('C2 with a custom FX rate the summary nominal difference uses it',
    m && Math.abs(num(m[1])-Math.abs(e.nomDiffAUD)) <= 1,
    `summary says AUD ${m&&m[1]}; with custom FX it should be ${Math.abs(e.nomDiffAUD).toFixed(0)} `+
    `(DB-rate value would be ${Math.abs(expected(defaultFx).nomDiffAUD).toFixed(0)})`);
}

// ── C3: detailed mode — override must survive deleting a row above it ──
{
  await page.evaluate(()=>{ document.querySelector('#modeGroup .seg-btn[data-val="detailed"]').click(); });
  await page.waitForTimeout(100);
  await pickCity('dtFromPicker','Jakarta|Indonesia');
  await pickCity('dtToPicker0','Perth|Australia');
  await page.evaluate(()=>document.getElementById('addRowBtn').click());
  await page.waitForTimeout(100);
  // row 0 = rent, row 1 = other; give row 1 an amount then override its estimate
  await page.evaluate(()=>{
    const set=(el,v,ev)=>{ el.value=v; el.dispatchEvent(new Event(ev,{bubbles:true})); };
    const from1=document.querySelector('.dt-from-exp[data-ri="1"]');
    set(from1,'5,000,000','input'); from1.dispatchEvent(new Event('blur'));
  });
  await page.waitForTimeout(100);
  await page.evaluate(()=>{
    const ov=document.querySelector('.dt-to-exp[data-ri="1"][data-ci="0"]');
    ov.value='777'; ov.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.waitForTimeout(100);
  const before = await page.evaluate(()=>document.querySelector('.dt-to-exp[data-ri="1"][data-ci="0"]').value);
  await page.evaluate(()=>document.querySelector('.rmv-row-btn[data-ri="0"]').click());
  await page.waitForTimeout(100);
  const after = await page.evaluate(()=>({
    val: document.querySelector('.dt-to-exp[data-ri="0"][data-ci="0"]').value,
    overridden: !!document.querySelector('td.overridden'),
  }));
  check('C3 detailed-mode override survives deleting the row above it',
    before==='777' && after.val==='777' && after.overridden,
    `override was "777" before deleting row 1; surviving row now shows "${after.val}" (overridden=${after.overridden})`);
}

// ── C4: every city currency must have an FX rate ──
{
  const missing = [...new Set(col.data.filter(c=>RATE[c.currency]==null).map(c=>c.currency))];
  const affected = col.data.filter(c=>RATE[c.currency]==null).map(c=>c.city+', '+c.country);
  check('C4 all city currencies present in currency_rates.json', missing.length===0,
    `missing ${JSON.stringify(missing)} → ${affected.join('; ')} silently convert at 1:1 with USD`);
}

await browser.close();
server.close();
console.log(`\ncostofliving audit: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
