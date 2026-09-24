// Rent vs Own — main page ⇄ Sensitivity page parity.
//
// Both pages run ../../engine.js, so a disagreement can only come from how
// each page turns what a reader types into the engine's state. This harness
// types the SAME scenario into both pages through their own controls (the
// main page's sidebar, the Sensitivity table's first column) and requires the
// two Own and Rent cashflow exports to be byte-identical.
//
// Scenarios: fixed edge cases plus seeded random ones covering simple and
// detailed mortgages (fixed/floating periods, P&I and interest-only), simple
// and detailed costs ($ per week/month/year with inflation, % of price/value/
// rent), a set or automatic budget and initial cash, zero rent, zero rate,
// 100% down payment, and horizons either side of the term.
//
// The edge cases are also run on the Indonesian pages, which must match too.
//
// Run: node parity.mjs [count]   (default 40 random scenarios)
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SENS = pathToFileURL(join(HERE, '..', 'index.html')).href;
const MAIN = pathToFileURL(join(HERE, '..', '..', 'index.html')).href;
const SENS_ID = pathToFileURL(join(HERE, '..', 'id', 'index.html')).href;
const MAIN_ID = pathToFileURL(join(HERE, '..', '..', 'id', 'index.html')).href;
const N = parseInt(process.argv[2]||'40');

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
  await page.waitForTimeout(300);
  await page.evaluate(()=>{ try{ localStorage.clear(); }catch(e){} window.__csv=null; RVOExport.downloadCSV=(fn,txt)=>{ window.__csv=txt; }; });
  return page;
}

/* ── Scenario generator (seeded, so a failure reproduces) ── */
let seed = 20260924;
const rnd = ()=>{ seed = (seed*1664525 + 1013904223) % 4294967296; return seed/4294967296; };
const pick = a => a[Math.floor(rnd()*a.length)];
const grid = (lo, hi, step) => +(lo + Math.floor(rnd()*((hi-lo)/step+1))*step).toFixed(4);

function randomScenario(){
  const term = pick([10,15,20,25,30,35]);
  const sc = {
    horizon: pick([5,10,term-1,term,term+5,40,60]),
    riskFreeRate: grid(-1, 9, 0.01), initialCash: pick([0,0,50000,250000,1200000]),
    monthlyBudget: pick([0,0,3000,6500,12000]), monthlyBudgetIncrease: grid(0, 6, 0.01),
    propertyPrice: pick([50000,420000,800000,1350000,2600000]), downPaymentPct: grid(0,100,0.01),
    mortgageRate: grid(0, 12, 0.01), mortgageTerm: term, houseGrowth: grid(-3, 9, 0.01), sellingCostPct: grid(0, 7, 0.01),
    setupCostType: pick(['dollar','pct']), setupCost: 0,
    ownOngoingCostType: pick(['dollar','pct']), ownOngoingCostFreq: pick(['yearly','monthly','weekly']), ownOngoingCost: 0,
    ownOngoingInflation: grid(0, 6, 0.01),
    rentFreq: pick(['monthly','weekly','yearly']), rentAmount: 0, rentInflation: grid(-2, 8, 0.01),
    rentOngoingCostType: pick(['dollar','pct']), rentOngoingCostFreq: pick(['yearly','monthly','weekly']), rentOngoingCost: 0,
    rentOngoingInflation: grid(0, 6, 0.01),
    mortgageMode: pick(['simple','detailed']), mortgageType: pick(['pi','pi','io']), costInterestOnly: rnd()<0.6,
    ownCostsMode: pick(['simple','simple','detailed']), rentCostsMode: pick(['simple','simple','detailed']),
  };
  sc.setupCost = sc.setupCostType==='pct' ? grid(0,8,0.25) : pick([0,15000,42000]);
  sc.ownOngoingCost = sc.ownOngoingCostType==='pct' ? grid(0,2.5,0.05) : {yearly:pick([0,4500,9000]),monthly:pick([150,700]),weekly:pick([40,160])}[sc.ownOngoingCostFreq];
  sc.rentAmount = {monthly:pick([0,1800,2800,6500]),weekly:pick([350,700]),yearly:pick([24000,60000])}[sc.rentFreq];
  sc.rentOngoingCost = sc.rentOngoingCostType==='pct' ? grid(0,5,0.1) : {yearly:pick([0,1200]),monthly:pick([40,100]),weekly:pick([10,30])}[sc.rentOngoingCostFreq];
  // Detailed mortgage: 1–3 consecutive periods, fixed or floating
  const n = pick([1,2,3]);
  let to = 0; sc.ratePeriods = [];
  for(let i=0;i<n;i++){
    const last = i===n-1;
    to = last ? term : Math.min(term-1, to + pick([2,3,5,7]));
    const floating = rnd()<0.5, lo = grid(1,8,0.05);
    sc.ratePeriods.push(floating ? {toYear:to,type:'floating',rateMin:lo,rateMax:+(lo+grid(0.5,4,0.05)).toFixed(2)}
                                 : {toYear:to,type:'fixed',rate:grid(0,10,0.05)});
  }
  // Detailed costs
  const ongoing = pcts => ({basis:pick(['yearly','monthly','weekly','pct']), amount:0, inflation:grid(0,5,0.1), pcts});
  sc.ownSetupCosts = Array.from({length:pick([1,2,3])},()=>{ const b=pick(['fixed','pct']); return {basis:b, amount: b==='pct'?grid(0,6,0.25):pick([0,2500,30000])}; });
  sc.ownOngoingCosts = Array.from({length:pick([1,2,3])},()=>{ const o=ongoing(); o.amount = o.basis==='pct'?grid(0,1.5,0.05):{yearly:3000,monthly:250,weekly:60}[o.basis]; return o; });
  sc.rentOngoingCosts = Array.from({length:pick([1,2])},()=>{ const o=ongoing(); o.amount = o.basis==='pct'?grid(0,4,0.1):{yearly:900,monthly:70,weekly:15}[o.basis]; return o; });
  return sc;
}

const BASE = randomScenario(); // shape donor for the fixed edge cases
const EDGE = [
  ['defaults, detailed mortgage with a floating tail', {mortgageMode:'detailed', ratePeriods:[{toYear:5,type:'fixed',rate:6},{toYear:30,type:'floating',rateMin:5,rateMax:9}]}],
  ['zero rent', {rentAmount:0, rentFreq:'monthly'}],
  ['zero mortgage rate', {mortgageRate:0}],
  ['no selling cost', {sellingCostPct:0}],
  ['100% down payment', {downPaymentPct:100}],
  ['interest-only past its term', {mortgageMode:'detailed', mortgageType:'io', costInterestOnly:false, mortgageTerm:10, horizon:25, ratePeriods:[{toYear:10,type:'floating',rateMin:4,rateMax:7}]}],
  ['set budget with growth and a cash shortfall', {monthlyBudget:2500, monthlyBudgetIncrease:3, initialCash:50000}],
];

/* ── Typing a scenario into the main page ── */
async function applyMain(page, sc){
  await page.evaluate(async (sc)=>{
    window.__RVO.resetAll();
    const $=id=>document.getElementById(id);
    const fire=(el,...t)=>t.forEach(x=>el.dispatchEvent(new Event(x,{bubbles:true})));
    const val=(id,v)=>{ const el=$(id); el.value=String(v); fire(el,'input','change'); };
    const seg=(group,v)=>document.querySelector('#'+group+' .seg-btn[data-val="'+v+'"]').click();
    const fmtMoney = v => v===0 ? '0' : Number(v).toLocaleString('en-AU',{maximumFractionDigits:2});
    // Frequencies before the amounts they rescale
    ['setupCostType','ownOngoingCostType','ownOngoingCostFreq','rentOngoingCostType','rentOngoingCostFreq','rentFreq'].forEach(k=>val(k, sc[k]));
    ['horizon','riskFreeRate','monthlyBudgetIncrease','downPaymentPct','mortgageRate','mortgageTerm','houseGrowth','sellingCostPct',
     'ownOngoingInflation','rentInflation','rentOngoingInflation'].forEach(k=>val(k, sc[k]));
    ['initialCash','monthlyBudget','propertyPrice','setupCost','ownOngoingCost','rentAmount','rentOngoingCost'].forEach(k=>val(k, fmtMoney(sc[k])));
    if(sc.mortgageMode==='detailed'){
      seg('mortgageModeGroup','detailed');
      const r=document.querySelector('input[name="mortgageType"][value="'+sc.mortgageType+'"]'); r.checked=true; fire(r,'change');
      const cio=$('costInterestOnly'); cio.checked=sc.costInterestOnly; fire(cio,'change');
      const rows=()=>document.querySelectorAll('#ratePeriodRows .rate-period-row');
      while(rows().length<sc.ratePeriods.length) $('addRatePeriod').click();
      while(rows().length>sc.ratePeriods.length) rows()[rows().length-1].querySelector('.rp-delete').click();
      sc.ratePeriods.forEach((p,i)=>{
        const row=rows()[i], set=(s,v)=>{ const el=row.querySelector(s); if(el && v!==undefined){ el.value=String(v); fire(el,'change'); } };
        set('.rp-type',p.type); set('.rp-to',p.toYear); set('.rp-rate',p.rate); set('.rp-min',p.rateMin); set('.rp-max',p.rateMax);
      });
    }
    const costList=(group, rowsId, addId, items)=>{
      seg(group,'detailed');
      const rows=()=>document.querySelectorAll('#'+rowsId+' .cost-item-row');
      while(rows().length<items.length) $(addId).click();
      while(rows().length>items.length) rows()[rows().length-1].querySelector('.ci-delete').click();
      items.forEach((it,i)=>{
        let row=rows()[i];
        const b=row.querySelector('.ci-basis'); b.value=it.basis; fire(b,'input','change');
        row=rows()[i];
        const a=row.querySelector('.ci-amount'); a.value=fmtMoney(it.amount); fire(a,'input','change');
        row=rows()[i];
        const f=row.querySelector('.ci-infl'); if(f && it.inflation!==undefined){ f.value=String(it.inflation); fire(f,'input','change'); }
      });
    };
    if(sc.ownCostsMode==='detailed'){
      costList('ownCostsModeGroup','ownSetupCostRows','addOwnSetupCost', sc.ownSetupCosts);
      costList('ownCostsModeGroup','ownOngoingCostRows','addOwnOngoingCost', sc.ownOngoingCosts);
    }
    if(sc.rentCostsMode==='detailed') costList('rentCostsModeGroup','rentOngoingCostRows','addRentOngoingCost', sc.rentOngoingCosts);
  }, sc);
  await page.waitForTimeout(60);
}

/* ── Typing the same scenario into the Sensitivity page's first column ── */
async function applySens(page, sc){
  await page.evaluate((sc)=>{
    const q=s=>document.querySelector(s);
    const fire=(el,...t)=>t.forEach(x=>el.dispatchEvent(new Event(x,{bubbles:true})));
    const mode=(key,v)=>{ const b=q('.mode-seg[data-mode-key="'+key+'"] .seg-btn[data-val="'+v+'"]'); if(b) b.click(); };
    ['mortgageMode','ownCostsMode','rentCostsMode'].forEach(k=>mode(k, sc[k]));
    const sel=(k,v)=>{ const el=q('.param-select[data-si="0"][data-key="'+k+'"]'); if(el){ el.value=v; fire(el,'change'); } };
    const inp=(k,v)=>{ const el=q('.param-input[data-si="0"][data-key="'+k+'"]'); if(el){ el.value=String(v); fire(el,'blur'); } };
    const bool=(k,v)=>{ const el=q('.param-bool[data-si="0"][data-key="'+k+'"]'); if(el){ el.checked=v; fire(el,'change'); } };
    ['setupCostType','ownOngoingCostType','ownOngoingCostFreq','rentOngoingCostType','rentOngoingCostFreq','rentFreq','mortgageType'].forEach(k=>sel(k, sc[k]));
    bool('costInterestOnly', sc.costInterestOnly);
    ['horizon','riskFreeRate','initialCash','monthlyBudget','monthlyBudgetIncrease','propertyPrice','downPaymentPct','mortgageRate',
     'mortgageTerm','houseGrowth','sellingCostPct','setupCost','ownOngoingCost','ownOngoingInflation','rentAmount','rentInflation','rentOngoingCost','rentOngoingInflation']
      .forEach(k=>inp(k, sc[k]));
    const cell=(cls,idx,extra='')=>q('.'+cls+'[data-si="0"][data-idx="'+idx+'"]'+extra);
    if(sc.mortgageMode==='detailed'){
      const count=()=>document.querySelectorAll('.rp-type[data-si="0"]').length;
      while(count()<sc.ratePeriods.length) q('.add-period-btn[data-si="0"]').click();
      while(count()>sc.ratePeriods.length) cell('rp-del', count()-1).click();
      sc.ratePeriods.forEach((p,i)=>{
        const t=cell('rp-type',i); t.value=p.type; fire(t,'change');
        const to=cell('rp-to',i); if(to){ to.value=String(p.toYear); fire(to,'blur'); }
        [['rp-rate','rate'],['rp-min','rateMin'],['rp-max','rateMax']].forEach(([c,f])=>{ const el=cell(c,i); if(el && p[f]!==undefined){ el.value=String(p[f]); fire(el,'blur'); } });
      });
    }
    const costList=(list, items)=>{
      const sel=`[data-list="${list}"]`;
      const count=()=>document.querySelectorAll('.ci-basis[data-si="0"]'+sel).length;
      while(count()<items.length) q('.add-cost-btn[data-si="0"]'+sel).click();
      while(count()>items.length) cell('ci-del', count()-1, sel).click();
      items.forEach((it,i)=>{
        const b=cell('ci-basis',i,sel); b.value=it.basis; fire(b,'change');
        const a=cell('ci-amt',i,sel); a.value=String(it.amount); fire(a,'blur');
        const f=cell('ci-infl',i,sel); if(f && it.inflation!==undefined){ f.value=String(it.inflation); fire(f,'blur'); }
      });
    };
    if(sc.ownCostsMode==='detailed'){ costList('ownSetupCosts', sc.ownSetupCosts); costList('ownOngoingCosts', sc.ownOngoingCosts); }
    if(sc.rentCostsMode==='detailed') costList('rentOngoingCosts', sc.rentOngoingCosts);
  }, sc);
  await page.waitForTimeout(40);
}

async function mainCsv(page, t){
  return page.evaluate((t)=>{ window.__csv=null; document.querySelector('.tab-btn[data-table="'+t+'"]').click(); document.getElementById('downloadBtn').click(); return window.__csv; }, t);
}
async function sensCsv(page, w){
  return page.evaluate((w)=>{ window.__csv=null; document.querySelector('.btn-scen-action.dl-'+w+'[data-si="0"]').click(); return window.__csv; }, w);
}
const diffAt=(a,b)=>{ const A=a.split('\n'), B=b.split('\n'); for(let i=0;i<Math.max(A.length,B.length);i++) if(A[i]!==B[i]) return `line ${i+1}\n      main: ${A[i]}\n      sens: ${B[i]}`; return null; };

const main = await open(MAIN);
const cases = EDGE.map(([name, o])=>[name, Object.assign({}, BASE, {mortgageMode:'simple', ownCostsMode:'simple', rentCostsMode:'simple'}, o)]);
for(let i=0;i<N;i++) cases.push(['random #'+(i+1), randomScenario()]);

for(const [name, sc] of cases){
  const sens = await open(SENS); // a fresh page: the Sensitivity modes are page-wide
  await applyMain(main, sc);
  await applySens(sens, sc);
  const [mo, mr, so, sr] = [await mainCsv(main,'own'), await mainCsv(main,'rent'), await sensCsv(sens,'own'), await sensCsv(sens,'rent')];
  const d = diffAt(mo, so) || diffAt(mr, sr);
  const tag = `${sc.mortgageMode}${sc.mortgageMode==='detailed'?'/'+sc.mortgageType+'/'+sc.ratePeriods.map(p=>p.type[0]).join(''):''}, costs ${sc.ownCostsMode}/${sc.rentCostsMode}, budget ${sc.monthlyBudget||'auto'}, h${sc.horizon}/t${sc.mortgageTerm}`;
  check(`P ${name} (${tag}): Own + Rent exports identical`, !d, d||'');
  if(d) console.log('      scenario:', JSON.stringify(sc));
  await sens.close();
}

// The Indonesian pages run the same engine and must give the same numbers:
// every edge case again, all four pages against the English main page.
const mainId = await open(MAIN_ID);
for(const [name, sc] of cases.slice(0, EDGE.length)){
  await applyMain(main, sc); await applyMain(mainId, sc);
  const sensId = await open(SENS_ID); await applySens(sensId, sc);
  const ref = [await mainCsv(main,'own'), await mainCsv(main,'rent')];
  const d = diffAt(ref[0], await mainCsv(mainId,'own')) || diffAt(ref[1], await mainCsv(mainId,'rent'))
         || diffAt(ref[0], await sensCsv(sensId,'own')) || diffAt(ref[1], await sensCsv(sensId,'rent'));
  check(`P ${name}: Indonesian main + Sensitivity pages match the English main page`, !d, d||'');
  await sensId.close();
}

await browser.close();
console.log(`\nmain ⇄ sensitivity parity: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
