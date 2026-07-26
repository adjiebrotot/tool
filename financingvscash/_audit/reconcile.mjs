// Financing vs Cash — comparison-table reconciliation audit.
// Guards the accounting identity that the main run.mjs does not cover: with
// scenarios of DIFFERING horizons, every column of the comparison table must
// reconcile against a cash baseline drawn at that scenario's own horizon.
//
// A single shared "Cash Purchase" cell cannot satisfy this once horizons
// differ, which is the defect this file exists to catch: a 3-year scenario
// scored against a 5-year cash balance is wrong by the growth between them.
// Run: node reconcile.mjs
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = pathToFileURL(join(HERE, '..', 'index.html')).href;

const CHART_STUB = `
window.__charts = [];
class Chart {
  constructor(ctx, cfg){ this.config=cfg; this.data=(cfg&&cfg.data)||{datasets:[]}; this.options=(cfg&&cfg.options)||{}; window.__charts.push(this); }
  update(){} destroy(){ const i=window.__charts.indexOf(this); if(i>=0) window.__charts.splice(i,1); } resetZoom(){}
}
Chart.register=function(){};
window.Chart=Chart;
window.Plotly={newPlot:async()=>{},relayout:async()=>{},downloadImage:async()=>{},toImage:async()=>'data:,'};`;

let pass=0, fail=0;
const check=(name,ok,detail)=>{ console.log((ok?'  PASS  ':'✗ FAIL  ')+name+(detail?'  — '+detail:'')); ok?pass++:fail++; };
const money=s=>parseFloat(String(s).replace(/[−–]/g,'-').replace(/[^0-9.\-]/g,''));

const browser = await chromium.launch({args:['--allow-file-access-from-files']});
const page = await browser.newPage();
const pageErrors=[];
page.on('pageerror', e=>pageErrors.push(e.message));
await page.route('**/*', route=>{
  const url=route.request().url();
  if(url.startsWith('file://')) return route.continue();
  if(/chart\.umd/.test(url)) return route.fulfill({contentType:'application/javascript', body:CHART_STUB});
  return route.fulfill({contentType:'application/javascript', body:'/* stub */'});
});
await page.goto(PAGE, {waitUntil:'load'});
await page.waitForTimeout(250);

const setBase = (o)=>page.evaluate(o=>{
  const fire=(el,evts)=>evts.forEach(t=>el.dispatchEvent(new Event(t,{bubbles:true})));
  const put=(id,v)=>{ const el=document.getElementById(id); el.value=String(v); fire(el,['input','change']); };
  if(o.price!==undefined) put('purchaseCost', o.price);
  if(o.cash!==undefined)  put('availableCash', o.cash);
  if(o.rf!==undefined)    put('baseRf', o.rf);
  if(o.inflOn!==undefined){ const el=document.getElementById('inflationToggle'); el.checked=!!o.inflOn; fire(el,['change']); }
}, o);

const setScenarios = (list)=>page.evaluate(list=>{
  const fire=(el,evts)=>evts.forEach(t=>el.dispatchEvent(new Event(t,{bubbles:true})));
  let guard=0;
  while(document.querySelectorAll('.scenario-card').length && guard++<50){
    document.querySelectorAll('.scenario-card .sc-btn[data-action="del"]')[0].click();
  }
  list.forEach(s=>{
    document.getElementById('addScenarioBtn').click();
    const set=(id,v,evts=['input','change'])=>{ const el=document.getElementById(id); el.value=String(v); fire(el,evts); };
    document.getElementById('scName').value = s.name;
    set('scRate', s.rate); set('scDownPct', s.downPct ?? 0);
    if(s.freq) set('scFreq', s.freq, ['change']);   // freq first: it rewrites the term field
    set('scTerm', s.term);
    set('scFeeType','fixed',['change']); set('scFeeAmt',0); set('scAdminFee',0);
    document.getElementById('saveScenarioBtn').click();
  });
}, list);

const compTable = ()=>page.evaluate(()=>{
  const tbl=document.querySelector('#compTableWrap table');
  if(!tbl) return {__cols:[]};
  const out={};
  [...tbl.querySelectorAll('tbody tr')].forEach(tr=>{
    const c=[...tr.children].map(td=>td.textContent.trim()); out[c[0]]=c.slice(1);
  });
  out.__cols=[...tbl.querySelectorAll('thead th')].map(t=>t.textContent.trim());
  return out;
});

/* ── T1: mixed horizons must each reconcile against their own baseline ── */
const PRICE=50000, CASH=80000, RF=4.5;
await setBase({price:PRICE, cash:CASH, rf:RF, inflOn:false});
await setScenarios([
  {name:'S5y', rate:5, term:60, freq:'monthly'},
  {name:'S3y', rate:5, term:36, freq:'monthly'},
]);
await page.waitForTimeout(150);

const tb = await compTable();
const ew=tb['Ending Wealth'], nb=tb['Net Benefit vs Cash'], base=tb['Cash Purchase at Same Horizon'];

check('comparison table exposes a per-scenario cash baseline row', !!base,
      base?('row = '+base.join(' | ')):'row missing — a single shared cash cell cannot reconcile mixed horizons');

if(ew && nb && base){
  for(let c=1;c<ew.length;c++){
    const E=money(ew[c]), B=money(base[c]), N=money(nb[c]);
    check(`column ${c} reconciles: Ending Wealth - same-horizon cash == Net Benefit`,
          Math.abs((E-B)-N)<0.01,
          `${E.toFixed(2)} - ${B.toFixed(2)} = ${(E-B).toFixed(2)} vs printed ${N.toFixed(2)}`);
  }
  // The cash buyer spends the price up front and compounds only what is left.
  const expect = yrs => (CASH-PRICE)*Math.pow(1+RF/100, yrs);
  check('5-year baseline matches an independent compounding of (cash - price)',
        Math.abs(money(base[1])-expect(5))<1, `table ${money(base[1]).toFixed(2)} vs ${expect(5).toFixed(2)}`);
  check('3-year baseline matches an independent compounding of (cash - price)',
        Math.abs(money(base[2])-expect(3))<1, `table ${money(base[2]).toFixed(2)} vs ${expect(3).toFixed(2)}`);
  check('the two baselines differ, i.e. horizons are genuinely distinguished',
        Math.abs(money(base[1])-money(base[2]))>1,
        `gap ${(money(base[1])-money(base[2])).toFixed(2)} — this is the amount a shared cell would misstate`);
}

/* ── T2: no confident verdict when there is nothing to compute from ── */
await setBase({price:0, cash:0});
await page.waitForTimeout(250);
const blank = await page.evaluate(()=>{
  const w=document.getElementById('warnBanner');
  const t=document.querySelector('#compTableWrap table');
  const row=t?[...t.querySelectorAll('tbody tr')].find(tr=>tr.children[0].textContent.trim()==='Ending Wealth'):null;
  return { warn:w?getComputedStyle(w).display:'none',
           ew:row?[...row.children].slice(1).map(td=>td.textContent.trim()):null };
});
check('price=0 and cash=0 warns instead of printing a confident all-zero verdict',
      blank.warn!=='none' || !blank.ew,
      `warn display=${blank.warn}, Ending Wealth row=${blank.ew?blank.ew.join('|'):'absent'}`);

check('no uncaught page errors', pageErrors.length===0, pageErrors.join(' ; ') || 'none');

console.log(`\nfinancingvscash reconciliation audit: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail?1:0);
