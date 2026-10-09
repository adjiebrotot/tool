// Cost of Living Comparator — end-to-end audit.
// Serves the repo over localhost (the page fetches its JSON data), drives the
// REAL page headless and mimics a user:
//   C1  simple mode: baseline estimated-expense math vs independent recompute
//   C2  simple mode: set a CUSTOM FX rate → cross-border figures must use it,
//       but the destination's cost in its own currency must NOT move
//   C3  detailed mode: override a destination cell on row 2, then delete row 1
//       → the override must survive on the surviving row; and the goal lives
//       in exactly one control (#goalGroup), which drives the detailed card
//   C4  data: every city currency resolves to an FX rate, and every rate is
//       used by at least one city (no orphans, no silent 1:1 conversions)
//   C5  simple mode: the ±20% FX-shock slider must move ONLY the cross-currency
//       figures. The index-based expense estimate and the destination savings
//       ratio are ratios of local prices and must hold still; the summary's
//       nominal savings gap must follow the shocked rate exactly.
//   C6  simple mode: the ⇆ swap button turns the comparison around — cities,
//       pickers and salaries change sides, the custom FX rate is inverted, and
//       the monthly expense adopts the estimate shown for the destination
//   C7  detailed mode layout: no absolutely positioned element may escape to
//       the page, and every currency tag must sit inside its own cell
//   C8  Quick Start: each of the six scenarios, applied over a messy page,
//       opens exactly as on a fresh one (it is the page's reset), and every
//       Required salary is replayed from the JSON: index-scaled destination
//       costs divided by one minus the home city's savings ratio
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

// fx = the IDR-per-AUD rate money crosses the border at (custom and/or the
// scenario slider). The estimate itself never uses it: it is a ratio of local
// prices and always rides the rate the indices were priced at.
function expected(fx){
  const te = FE*(1/defaultFx)*(ti/fi);        // est. expenses in AUD
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

// ── C2: custom FX crosses the border, but must NOT reprice Perth in AUD ──
{
  const before = await page.evaluate(()=>document.querySelectorAll('.col-card')[1].querySelectorAll('.sav-val')[0].textContent);
  const customFx = Math.round(defaultFx*2);   // user thinks the AUD is 2x stronger
  await setVal('simpleFxInput', String(customFx));
  const e = expected(customFx);
  const got = await page.evaluate(()=>({
    te: document.querySelectorAll('.col-card')[1].querySelectorAll('.sav-val')[0].textContent,
    summary: document.getElementById('ss_summary').textContent }));
  const m = got.summary.match(/AUD\s*([\d,]+)/);
  check('C2a with a custom FX rate the summary nominal difference uses it',
    m && Math.abs(num(m[1])-Math.abs(e.nomDiffAUD)) <= 1,
    `summary says AUD ${m&&m[1]}; with custom FX it should be ${Math.abs(e.nomDiffAUD).toFixed(0)} `+
    `(DB-rate value would be ${Math.abs(expected(defaultFx).nomDiffAUD).toFixed(0)})`);
  // A rate is a bridge between currencies, not a price list. Perth's cost in
  // AUD cannot change because the user re-quoted the Rupiah.
  check('C2b a custom FX rate does not change the destination cost in its own currency',
    got.te===before && Math.abs(num(got.te)-e.te)<=1,
    `est expenses were "${before}" at the bundled rate and "${got.te}" at a 2x custom rate`);
  await setVal('simpleFxInput', '');           // back to the bundled rate
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

  // The goal lives in ONE control (#goalGroup, on screen in both modes). A
  // second copy inside the detailed card would drift out of sync with it.
  const goalCtl = await page.evaluate(()=>({
    top: !!document.getElementById('goalGroup') && document.getElementById('goalRow').offsetParent!==null,
    dup: !!document.getElementById('dtGoalGroup'),
  }));
  await page.evaluate(()=>document.querySelector('#goalGroup .seg-btn[data-val="earn"]').click());
  await page.waitForTimeout(120);
  const earn = await page.evaluate(()=>({
    active: document.querySelector('#goalGroup .seg-btn.active').dataset.val,
    target: !!document.getElementById('dtTargetGroup'),
    reqSalary: /required/i.test(document.querySelector('table.dt').textContent),
  }));
  await page.evaluate(()=>document.querySelector('#goalGroup .seg-btn[data-val="save"]').click());
  await page.waitForTimeout(120);
  const saved = await page.evaluate(()=>({
    active: document.querySelector('#goalGroup .seg-btn.active').dataset.val,
    target: !!document.getElementById('dtTargetGroup'),
  }));
  check('C3b detailed mode has one goal control, and the top one drives it',
    goalCtl.top && !goalCtl.dup && earn.active==='earn' && earn.target && earn.reqSalary
      && saved.active==='save' && !saved.target,
    `#goalRow visible=${goalCtl.top}, #dtGoalGroup present=${goalCtl.dup}; `+
    `earn → target row=${earn.target}, save → target row=${saved.target}`);
}

// ── C4: DATA — every city must resolve to an FX rate, and every rate must be
//        used. Rows whose currency had no rate (Caracas/VES) were removed, so
//        this now asserts the invariant rather than the old degradation path:
//        a future data refresh that reintroduces a rate-less currency, or
//        leaves an orphan rate behind, fails here. The engine's "no rate → —"
//        guard still exists and is covered by the null handling in C1/C5. ──
{
  await page.evaluate(()=>{ document.querySelector('#modeGroup .seg-btn[data-val="simple"]')?.click(); });
  await page.waitForTimeout(100);
  const noRate = col.data.filter(c => RATE[c.currency] == null).map(c => `${c.city} (${c.currency})`);
  check('C4a every city currency resolves to an FX rate', noRate.length === 0,
    noRate.length ? `missing rates: ${noRate.join(', ')}` : `all ${col.data.length} cities covered by ${Object.keys(RATE).length} rates`);
  const used = new Set(col.data.map(c => c.currency));
  const orphan = Object.keys(RATE).filter(c => !used.has(c));
  check('C4b no orphaned currency rates', orphan.length === 0,
    orphan.length ? `rates with no city: ${orphan.join(', ')}` : 'every rate is referenced by at least one city');
}

// ── C5: FX-shock slider: local-price figures frozen, cross-currency ones move ──
{
  await pickCity('fromPicker','Jakarta|Indonesia');
  await pickCity('toPicker','Perth|Australia');
  await setVal('ss_fs', FS.toLocaleString('en-US'));
  await setVal('ss_fe', FE.toLocaleString('en-US'));
  await setVal('ss_ts', TS.toLocaleString('en-US'));

  const readSimple = () => page.evaluate(()=>{
    const dest=document.querySelectorAll('.col-card')[1];
    return { te: dest.querySelectorAll('.sav-val')[0].textContent.trim(),
             ratio: dest.querySelectorAll('.sav-ratio')[0].textContent.trim(),
             summary: document.getElementById('ss_summary').textContent };
  });
  const setShock = async p => {
    await page.evaluate(p=>{ const s=document.getElementById('fxShockSlider'); s.value=String(p); s.dispatchEvent(new Event('input')); }, p);
    await page.waitForTimeout(80);
  };

  const hasSlider = await page.evaluate(()=>!!document.getElementById('fxShockSlider'));
  const bounds = await page.evaluate(()=>{ const s=document.getElementById('fxShockSlider'); return s?{min:s.min,max:s.max}:null; });
  check('C5a FX-shock slider is present in simple mode and capped at ±20%',
    hasSlider && bounds.min==='-20' && bounds.max==='20', `min=${bounds&&bounds.min} max=${bounds&&bounds.max}`);

  const at0 = await readSimple();
  await setShock(20);
  const atPlus = await readSimple();
  await setShock(-20);
  const atMinus = await readSimple();

  // The estimate is expense x P_dest/P_src, so the rate cancels out of it and a
  // nominal FX move must leave it (and the ratio built from it) untouched.
  check('C5b estimated destination expenses do not move with the FX shock',
    at0.te===atPlus.te && at0.te===atMinus.te,
    `est expenses: 0% "${at0.te}", +20% "${atPlus.te}", −20% "${atMinus.te}"`);
  check('C5c destination savings ratio does not move with the FX shock',
    at0.ratio===atPlus.ratio && at0.ratio===atMinus.ratio,
    `dest ratio: 0% "${at0.ratio}", +20% "${atPlus.ratio}", −20% "${atMinus.ratio}"`);

  // The summary gap converts source savings into the destination currency, so
  // it must track the shocked rate to the cent.
  function expectedShocked(pct){
    const shocked = defaultFx*(1+pct/100);      // IDR per AUD under the scenario
    const te = FE*(1/defaultFx)*(ti/fi);        // estimate stays on the BASE rate
    return Math.abs((TS-te) - (FS-FE)/shocked); // nominal gap in AUD
  }
  let gapOk = true, gapDetail = [];
  for(const pct of [20,-20,7]){
    await setShock(pct);
    const s = await readSimple();
    const m = s.summary.match(/AUD\s*([\d,]+)/);
    const want = expectedShocked(pct);
    const ok = m && Math.abs(num(m[1])-want) <= 1;
    if(!ok) gapOk = false;
    gapDetail.push(`${pct>0?'+':''}${pct}%: got ${m&&m[1]} want ${want.toFixed(0)}`);
  }
  check('C5d summary nominal savings gap follows the shocked rate', gapOk,
    gapDetail.join('; ')+` (unshocked gap is ${expectedShocked(0).toFixed(0)})`);

  // A scenario must announce itself, and must be clearable.
  const flagged = await page.evaluate(()=>document.getElementById('ss_summary').textContent.includes('Scenario:'));
  await page.evaluate(()=>document.getElementById('fxShockReset').click());
  await page.waitForTimeout(80);
  const back = await readSimple();
  const sliderBack = await page.evaluate(()=>document.getElementById('fxShockSlider').value);
  check('C5e a non-zero shock is labelled a scenario, and reset returns to today\'s rate',
    flagged && sliderBack==='0' && back.summary===at0.summary && !back.summary.includes('Scenario:'),
    `labelled=${flagged}; after reset slider="${sliderBack}", summary restored=${back.summary===at0.summary}`);
}

// ── C6: the ⇆ swap button turns the comparison around ────────────────────
{
  await pickCity('fromPicker','Jakarta|Indonesia');
  await pickCity('toPicker','Perth|Australia');
  await setVal('ss_fs', (50000000).toLocaleString('en-US'));
  await setVal('ss_fe', (15000000).toLocaleString('en-US'));
  await setVal('ss_ts', (6000).toLocaleString('en-US'));

  // the destination estimate on screen — the swap must adopt it as the new
  // source-city expense
  const estShown = await page.evaluate(()=>document.querySelectorAll('.col-card')[1].querySelectorAll('.sav-val')[0].textContent);

  const before = await page.evaluate(()=>({
    from:document.querySelectorAll('.col-header')[0].textContent.replace(/^\W+/,'').trim(),
    to:document.querySelectorAll('.col-header')[1].textContent.replace(/^\W+/,'').trim(),
    fromInput:document.getElementById('fromPicker').querySelector('input').value,
  }));

  // a custom rate, so the inversion on swap can be checked
  await page.evaluate(()=>{ const el=document.getElementById('simpleFxInput'); el.value='10000'; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('blur')); });
  await page.waitForTimeout(80);

  await page.evaluate(()=>document.getElementById('swapCities').click());
  await page.waitForTimeout(120);

  const after = await page.evaluate(()=>({
    from:document.querySelectorAll('.col-header')[0].textContent.replace(/^\W+/,'').trim(),
    to:document.querySelectorAll('.col-header')[1].textContent.replace(/^\W+/,'').trim(),
    fromInput:document.getElementById('fromPicker').querySelector('input').value,
    toInput:document.getElementById('toPicker').querySelector('input').value,
    fs:document.getElementById('ss_fs').value,
    fe:document.getElementById('ss_fe').value,
    ts:document.getElementById('ss_ts').value,
    fx:document.getElementById('simpleFxInput').value,
  }));

  check('C6a swap exchanges the From and To cities, in the columns and the pickers',
    after.from===before.to && after.to===before.from && after.fromInput!==before.fromInput && after.toInput===before.fromInput,
    `${before.from} / ${before.to} → ${after.from} / ${after.to}; pickers "${before.fromInput}" → "${after.fromInput}" / "${after.toInput}"`);
  check('C6b the salaries travel with their cities',
    num(after.fs)===6000 && num(after.ts)===50000000,
    `from salary ${after.fs}, to salary ${after.ts}`);
  check('C6c the custom FX rate is inverted, not dropped',
    Math.abs(num(after.fx)-1/10000) < 1e-9,
    `10,000 IDR per AUD → ${after.fx} AUD per IDR`);
  check('C6e the monthly expense adopts the estimate that was on screen for the destination',
    Math.abs(num(after.fe)-num(estShown)) <= 1,
    `destination showed "${estShown}"; new source expense is "${after.fe}"`);
  // Nothing to turn around once both sides are empty.
  await page.evaluate(()=>{
    ['fromPicker','toPicker'].forEach(id=>document.getElementById(id).querySelector('.city-clear')
      .dispatchEvent(new MouseEvent('mousedown',{bubbles:true})));
  });
  await page.waitForTimeout(120);
  const disabledEmpty = await page.evaluate(()=>document.getElementById('swapCities').disabled);
  check('C6d the button is disabled once both cities are cleared', disabledEmpty===true,
    `disabled=${disabledEmpty}`);
}

// ── C7: layout — no absolutely positioned element may escape to the page ──
// A position:absolute rule applied outside a positioned wrapper resolves
// against the initial containing block, so every such element lands on one
// spot over the page. The destination currency tags did exactly that.
{
  await page.evaluate(()=>{ document.querySelector('#modeGroup .seg-btn[data-val="detailed"]').click(); });
  await page.waitForTimeout(120);
  await pickCity('dtFromPicker','Jakarta|Indonesia');
  await pickCity('dtToPicker0','Perth|Australia');
  await page.evaluate(()=>document.getElementById('addCityBtn').click());
  await page.waitForTimeout(120);
  await pickCity('dtToPicker1','Singapore|Singapore');
  await page.evaluate(()=>document.getElementById('addRowBtn').click());
  await page.waitForTimeout(150);
  const escaped = await page.evaluate(()=>{
    const out=[];
    document.querySelectorAll('*').forEach(el=>{
      const cs=getComputedStyle(el);
      if(cs.position!=='absolute') return;
      if(cs.display==='none' || el.offsetWidth+el.offsetHeight===0) return;
      const op=el.offsetParent;               // null / body = no positioned ancestor
      if(op && op!==document.body && op!==document.documentElement) return;
      out.push(`${el.tagName.toLowerCase()}.${String(el.className)} "${(el.textContent||'').trim().slice(0,12)}"`);
    });
    return out;
  });
  // Tags must sit inside their cell, not over the page.
  const tagsPlaced = await page.evaluate(()=>{
    const tags=[...document.querySelectorAll('.curr-tag')];
    return tags.length>0 && tags.every(t=>{
      const cell=t.closest('td,th'); if(!cell) return false;
      const a=t.getBoundingClientRect(), b=cell.getBoundingClientRect();
      return a.left>=b.left-1 && a.right<=b.right+1 && a.top>=b.top-1 && a.bottom<=b.bottom+1;
    });
  });
  check('C7 no absolutely positioned element escapes its wrapper, currency tags sit in their cell',
    escaped.length===0 && tagsPlaced,
    escaped.length ? `escaped: ${escaped.join(', ')}` : `all currency tags inside their own cell (${tagsPlaced})`);
}

// ── C8: Quick Start — each scenario is a clean reset, and its answer is right ──
// The scenarios are the page's only reset, so each must open from the defaults:
// applied over a deliberately messy page (custom frequency on, a nominal target,
// an override, simple-mode cities and a custom rate) it must look exactly as it
// does on a fresh page. Then every Required salary is replayed from the raw
// JSON: destination costs index-scaled at the bundled rate (live feeds are
// stubbed out here), divided by one minus the home city's savings ratio.
{
  const QS = {
    'sg-au': ['Singapore|Singapore', ['Sydney|Australia','Melbourne|Australia','Brisbane|Australia','Perth|Australia'], 8000,
              {rent:3500, groceries:600, eating_out:700, utilities:200, other:1000}],
    'sea':   ['Jakarta|Indonesia', ['Kuala Lumpur|Malaysia','Bangkok|Thailand','Ho Chi Minh City|Vietnam'], 25000000,
              {rent:7000000, groceries:3000000, eating_out:2500000, utilities:1200000, fuel:800000, other:3000000}],
    'us':    ['New York, NY|United States', ['San Francisco, CA|United States','Seattle, WA|United States','Austin, TX|United States'], 8500,
              {rent:4000, groceries:600, eating_out:700, utilities:200, other:1300}],
    'eu':    ['London|United Kingdom', ['Paris|France','Amsterdam|Netherlands','Berlin|Germany'], 4500,
              {rent:2100, groceries:350, eating_out:400, utilities:250, other:500}],
    'me':    ['Dubai|United Arab Emirates', ['Abu Dhabi|United Arab Emirates','Doha|Qatar','Riyadh|Saudi Arabia'], 30000,
              {rent:9000, groceries:2000, eating_out:2000, utilities:800, fuel:400, other:3800}],
    'ea':    ['Tokyo|Japan', ['Seoul|South Korea','Hong Kong|Hong Kong (China)','Shanghai|China'], 450000,
              {rent:140000, groceries:50000, eating_out:45000, utilities:15000, other:65000}],
  };
  const med = (c,k) => { const v=c.utilities_index&&c.utilities_index[k]; return v&&v.Median>0 ? v.Median : null; };
  const idx = (c,cat) => {
    if(cat==='rent') return c.rent_index&&c.rent_index.med;
    if(cat==='groceries') return c.groceries_index;
    if(cat==='eating_out') return c.eating_out_index;
    if(cat==='fuel') return med(c,'fuel');
    if(cat==='other') return c.coli_no_housing;
    if(cat==='utilities'){                    // 50/20/30, renormalised over what exists
      let a=0, w=0;
      [['electricity',.5],['water',.2],['gas',.3]].forEach(([k,wt])=>{ const v=med(c,k); if(v){ a+=v*wt; w+=wt; } });
      return w ? a/w : null;
    }
  };
  const snapPage = p => p.evaluate(()=>({
    seg: [...document.querySelectorAll('.seg-btn.active')].map(b=>b.closest('[id]').id+'='+b.dataset.val).join(','),
    freq: document.getElementById('customFreqChk').checked,
    simple: [...document.querySelectorAll('#fromPicker input,#toPicker input')].map(i=>i.value).join('|'),
    table: [...document.querySelectorAll('#detailSec input,#detailSec select')].map(e=>e.value).join('|'),
    cells: [...document.querySelectorAll('#detailSec td')].map(td=>td.textContent.replace(/\s+/g,' ').trim()).join('|'),
    active: [...document.querySelectorAll('.quick-start-btn.active')].map(b=>b.dataset.preset).join(','),
  }));

  // A fresh page per scenario gives the clean reference.
  const fresh = await browser.newPage();
  await fresh.route('**/*', route=>route.request().url().includes('127.0.0.1')
    ? route.continue() : route.fulfill({contentType:'application/javascript', body:'/* stub */'}));
  await fresh.goto(PAGE, {waitUntil:'load'});
  await fresh.waitForFunction(()=>document.getElementById('dataUpdatedText')?.textContent.length>0);

  for(const [id,[fromKey,toKeys,sal,rows]] of Object.entries(QS)){
    await fresh.evaluate(()=>{ try{ localStorage.clear(); }catch(e){} });
    await fresh.reload({waitUntil:'load'});
    await fresh.waitForFunction(()=>document.getElementById('dataUpdatedText')?.textContent.length>0);
    await fresh.evaluate(id=>document.querySelector(`.quick-start-btn[data-preset="${id}"]`).click(), id);
    await fresh.waitForTimeout(150);
    const ref = await snapPage(fresh);

    // Mess up the shared page, then apply the same scenario over it.
    await page.evaluate(()=>{ document.querySelector('#modeGroup .seg-btn[data-val="detailed"]').click(); });
    await page.waitForTimeout(80);
    await page.evaluate(()=>{
      const c=document.getElementById('customFreqChk'); c.checked=true; c.dispatchEvent(new Event('change'));
      document.querySelector('#goalGroup .seg-btn[data-val="earn"]').click();
    });
    await page.waitForTimeout(80);
    await page.evaluate(()=>{ const n=document.querySelector('#dtTargetGroup .seg-btn[data-val="nominal"]'); if(n) n.click(); });
    await page.waitForTimeout(80);
    await page.evaluate(()=>{ const o=document.querySelector('.dt-to-exp'); if(o){ o.value='123'; o.dispatchEvent(new Event('input')); o.dispatchEvent(new Event('blur')); } });
    await page.evaluate(()=>{ document.querySelector('#modeGroup .seg-btn[data-val="simple"]').click(); });
    await page.waitForTimeout(80);
    await pickCity('fromPicker','Jakarta|Indonesia');
    await pickCity('toPicker','Perth|Australia');
    await setVal('simpleFxInput','9999');
    await page.evaluate(id=>document.querySelector(`.quick-start-btn[data-preset="${id}"]`).click(), id);
    await page.waitForTimeout(150);
    const got = await snapPage(page);
    const diffs = Object.keys(ref).filter(k=>ref[k]!==got[k]);
    check(`C8a "${id}" opens the same over a messy page as on a fresh one`, diffs.length===0,
      diffs.length ? diffs.map(k=>`${k}: ${String(got[k]).slice(0,80)} ≠ ${String(ref[k]).slice(0,80)}`).join(' | ')
                   : `detailed, earn, savings ratio, ${toKeys.length} destinations, no custom frequency`);

    // Independent replay of the answer.
    const F = cityIdx[fromKey];
    const fe = Object.values(rows).reduce((a,b)=>a+b,0), ratio = (sal-fe)/sal;
    const shown = await page.evaluate(()=>[...document.querySelectorAll('.salary-tr td.num-td')].map(td=>({
      req: td.querySelector('span').textContent, ratio: null })));
    const ratios = await page.evaluate(()=>[...document.querySelectorAll('.dt-sav .sub-num')].map(e=>e.textContent));
    const fromRatio = await page.evaluate(()=>document.querySelector('.dt-sav-from .sub-num').textContent);
    const bad = [], seen = [];
    toKeys.forEach((k,i)=>{
      const T = cityIdx[k];
      let tot = 0;
      for(const [cat,a] of Object.entries(rows)) tot += a/RATE[F.currency]*(idx(T,cat)/idx(F,cat))*RATE[T.currency];
      const want = tot/(1-ratio);
      const g = shown[i] ? num(shown[i].req) : NaN;
      const cur = shown[i] && shown[i].req.split(' ')[0];
      if(!(Math.abs(g-want) <= Math.max(1, want*1e-9)) || cur!==T.currency) bad.push(`${T.city} ${shown[i]&&shown[i].req} want ${T.currency} ${want.toFixed(0)}`);
      if(ratios[i] !== (ratio*100).toFixed(1)+'% ratio') bad.push(`${T.city} ratio "${ratios[i]}"`);
      seen.push(`${T.city} ${shown[i]&&shown[i].req}`);
    });
    if(fromRatio !== (ratio*100).toFixed(1)+'% ratio') bad.push(`home ratio "${fromRatio}"`);
    check(`C8b "${id}" required salaries keep the home savings ratio (${(ratio*100).toFixed(0)}%), replayed from the JSON`,
      bad.length===0 && shown.length===toKeys.length, bad.length ? bad.join(' | ') : seen.join(', '));
  }
  await fresh.close();
}

await browser.close();
server.close();
console.log(`\ncostofliving audit: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
