// Pisah vs Gabung — end-to-end audit harness.
// Drives the REAL page in headless Chromium (CDN libs stubbed — no network),
// mimicking a user: reads KPIs/tiles, switches input modes, edits brackets.
// Run: node run.mjs
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = pathToFileURL(join(HERE, '..', 'index.html')).href;

const CHART_STUB = `
window.__charts = [];
class Chart {
  constructor(ctx, cfg){ this.config=cfg; this.data=(cfg&&cfg.data)||{datasets:[]}; this.options=(cfg&&cfg.options)||{}; window.__charts.push(this); }
  update(){} destroy(){} resetZoom(){}
}
Chart.register=function(){};
window.Chart=Chart;`;

let pass=0, fail=0;
function check(name, ok, detail){
  console.log((ok?'  PASS  ':'✗ FAIL  ')+name+(detail?('  — '+detail):''));
  ok?pass++:fail++;
}

// ── Reference implementation of the default PPh-21 progressive schedule ──
const BRACKETS = [
  {to:60000000, rate:0.05},{to:250000000, rate:0.15},
  {to:500000000, rate:0.25},{to:5000000000, rate:0.30},{to:Infinity, rate:0.35},
];
function tax(income){
  let t=0, prev=0, rem=income;
  for(const b of BRACKETS){
    const chunk=Math.min(rem, b.to-prev);
    if(chunk<=0) break;
    t+=chunk*b.rate; rem-=chunk; prev=b.to;
  }
  return t;
}
const PTKP_TK0=54e6, PTKP_K=4.5e6;
// fmt.idr compact used by the KPI: >=1e9 → x.xB else >=1e6 → x.xM
function kpiFmt(v){
  const a=Math.abs(v);
  if(a>=1e9) return 'Rp '+(a/1e9).toFixed(1)+'B';
  if(a>=1e6) return 'Rp '+(a/1e6).toFixed(1)+'M';
  return 'Rp '+Math.round(a).toLocaleString('en-US');
}

const browser = await chromium.launch({args:['--allow-file-access-from-files']});
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.route('**/*', route => {
  const url = route.request().url();
  if(url.startsWith('file://')) return route.continue();
  if(/chart\.umd/.test(url)) return route.fulfill({contentType:'application/javascript', body:CHART_STUB});
  return route.fulfill({contentType:'application/javascript', body:'/* stub */'});
});
await page.goto(PAGE, {waitUntil:'load'});
await page.waitForTimeout(300);

// ── T1: every EN summary tile label must be a real translation, not a raw key ──
{
  const tiles = await page.$$eval('#summaryGrid .tile .label', els=>els.map(e=>e.textContent.trim()));
  const rawKeys = tiles.filter(t=>/^tile[A-Z]/.test(t)||/^[a-z]+[A-Z]\w+$/.test(t));
  check('T1 EN summary tiles are translated (no raw i18n keys)', rawKeys.length===0,
    rawKeys.length?('raw key leaked to UI: '+JSON.stringify(rawKeys)):'');
}

// ── T2: default 50/50 KPI sanity vs reference schedule ──
{
  const hus=250e6, wife=250e6;
  const pisahRef = tax(hus-(PTKP_TK0+PTKP_K)) + tax(wife-PTKP_TK0);
  const gabungRef = tax(hus+wife-(PTKP_TK0+PTKP_K+PTKP_TK0));
  const got = await page.evaluate(()=>({p:document.getElementById('kpiPisah').textContent, g:document.getElementById('kpiGabung').textContent}));
  check('T2 default KPIs match reference tax schedule',
    got.p===kpiFmt(pisahRef) && got.g===kpiFmt(gabungRef),
    `app ${got.p}/${got.g} vs ref ${kpiFmt(pisahRef)}/${kpiFmt(gabungRef)}`);
}

// ── T3: "Husband + Wife" mode must tax the salaries the user typed, not a
//        split% rounded to a whole percent. Husband 500M + wife 12M: the true
//        wife share is 2.34%; rounding to 2% shifts ~1.76M of gross onto the
//        husband and changes his tax. ──
{
  await page.click('#modeBtnSplit');
  await page.evaluate(()=>{
    const set=(id,v)=>{ const el=document.getElementById(id); el.value=v; ['input','change'].forEach(t=>el.dispatchEvent(new Event(t,{bubbles:true}))); };
    set('husbandSalaryInput','500,000,000');
    set('wifeSalaryInput','12,000,000');
  });
  await page.waitForTimeout(150);
  const husTaxable = 500e6-(PTKP_TK0+PTKP_K);       // wife 12M < PTKP → 0 tax
  const exact = tax(husTaxable);
  const got = await page.evaluate(()=>document.getElementById('kpiPisah').textContent);
  check('T3 individual-mode Pisah KPI equals tax of typed salaries', got===kpiFmt(exact),
    `app shows ${got}, exact per typed salaries is ${kpiFmt(exact)} `+
    `(app re-derives gross from splitPct rounded to a whole %)`);
}

// ── T4: bracket editor accepts a "to" below the previous bracket's "to" and the
//        progressive tax then computes with a NEGATIVE bracket width (tax drops). ──
{
  // back to defaults first
  await page.click('#resetBtn');
  await page.waitForTimeout(150);
  const before = await page.evaluate(()=>document.getElementById('kpiGabung').textContent);
  // Advanced tab → set bracket #2 (60,000,001–250,000,000) upper bound to 10,000
  await page.evaluate(()=>{ document.querySelector('.ctrl-tab[data-tab="advanced"]')?.click(); });
  await page.evaluate(()=>{
    const rows=document.querySelectorAll('#bracketsContainer .bracket-row');
    const toEl=rows[1].querySelectorAll('input')[1];
    toEl.value='10,000';
    toEl.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.waitForTimeout(150);
  const after = await page.evaluate(()=>document.getElementById('kpiGabung').textContent);
  // Sane reading of the edited ladder (bracket 2 collapsed to nothing): the
  // 327.5M above 60M is all taxed at 25% → 3M + 81.875M = 84.9M. The engine
  // instead walks a NEGATIVE width for bracket 2 (top 10,000 < prev 60M),
  // subtracting 15% of −59.99M and re-taxing that slice at 25%.
  const taxable = 500e6-(PTKP_TK0+PTKP_K+PTKP_TK0);
  const sane = 60e6*0.05 + (taxable-60e6)*0.25;
  check('T4 bracket editor: out-of-order "to" still yields a sane progressive tax', after===kpiFmt(sane),
    `before=${before}; after setting bracket 2 "to"=10,000 app shows ${after}, sane value is ${kpiFmt(sane)}`);
}

await browser.close();
console.log(`\npisahvsgabung audit: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
