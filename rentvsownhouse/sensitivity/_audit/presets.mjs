// Rent vs Own Sensitivity: Quick Start picker audit.
//
// The first column can be filled with a city from the main page's Quick
// Start row. Both pages read the one list, ../../presets.js.
//
//   Q1  each city loaded into the first column gives Own and Rent cashflow
//       exports byte-identical to that city's Quick Start on the main page
//   Q2  the column is named after the city, and the page currency (the
//       picker and every column) follows the city's symbol
//   Q3  only the first column has the picker; after a drag the column now
//       first has it, and the city moved right keeps all its figures
//   Q4  with the detailed modes on, a city still loads (its lists are seeded)
//       and gives the same exports as in simple mode
//   Q5  the Indonesian page has the picker and loads the same figures
//
// Run: node presets.mjs
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SENS = pathToFileURL(join(HERE, '..', 'index.html')).href;
const SENS_ID = pathToFileURL(join(HERE, '..', 'id', 'index.html')).href;
const MAIN = pathToFileURL(join(HERE, '..', '..', 'index.html')).href;

const CHART_STUB = `
class Chart{constructor(c,g){this.config=g;this.data=(g&&g.data)||{datasets:[]};this.options=(g&&g.options)||{};}update(){}destroy(){}resetZoom(){}}
Chart.register=()=>{};window.Chart=Chart;`;

let pass=0, fail=0;
const check=(name,ok,detail)=>{ console.log((ok?'  PASS  ':'✗ FAIL  ')+name+(detail?'  — '+detail:'')); ok?pass++:fail++; };

const browser = await chromium.launch({args:['--allow-file-access-from-files']});
async function open(url){
  const page = await (await browser.newContext({viewport:{width:1600,height:1000}})).newPage();
  page.on('pageerror', e=>{ console.log('PAGEERROR:', e.message); fail++; });
  await page.addInitScript(()=>{ try{ localStorage.clear(); localStorage.setItem('rvos-tour-v2-seen','1'); localStorage.setItem('rvo-tour-v2-seen','1'); }catch(e){} });
  await page.route('**/*', route=>{
    const u=route.request().url();
    if(u.startsWith('file://')) return route.continue();
    if(/chart\.umd/.test(u)) return route.fulfill({contentType:'application/javascript', body:CHART_STUB});
    return route.fulfill({contentType:'application/javascript', body:'/* stub */'});
  });
  await page.goto(url, {waitUntil:'load'});
  await page.waitForTimeout(300);
  await page.evaluate(()=>{ window.__csv=null; RVOExport.downloadCSV=(fn,txt)=>{ window.__csv=txt; }; });
  return page;
}
const pickCity = (page, key) => page.evaluate((key)=>{
  const el=document.querySelector('.scen-preset-select[data-si="0"]');
  el.value=key; el.dispatchEvent(new Event('change',{bubbles:true}));
}, key);
const mainCsv = (page, t) => page.evaluate((t)=>{ window.__csv=null; document.querySelector('.tab-btn[data-table="'+t+'"]').click(); document.getElementById('downloadBtn').click(); return window.__csv; }, t);
const sensCsv = (page, w, si=0) => page.evaluate(([w,si])=>{ window.__csv=null; document.querySelector('.btn-scen-action.dl-'+w+'[data-si="'+si+'"]').click(); return window.__csv; }, [w,si]);
const diffAt=(a,b)=>{ if(!a||!b) return 'missing export'; const A=a.split('\n'), B=b.split('\n'); for(let i=0;i<Math.max(A.length,B.length);i++) if(A[i]!==B[i]) return `line ${i+1}\n      main: ${A[i]}\n      sens: ${B[i]}`; return null; };
const header = page => page.evaluate(()=>({
  names: [...document.querySelectorAll('.scen-name-input')].map(i=>i.value),
  pickers: [...document.querySelectorAll('.scen-preset-select')].map(s=>s.dataset.si),
  page: document.getElementById('currencySelect').value,
  price: [...document.querySelectorAll('.param-input[data-key="propertyPrice"]')].map(i=>i.value),
}));

const main = await open(MAIN);
const cities = await main.evaluate(()=>Object.entries(window.RVO_CITY_PRESETS).map(([k,v])=>[k,v.label,v.currencySymbol]));
check('presets.js lists the six Quick Start cities', cities.length===6, cities.map(c=>c[0]).join(', '));
const mainBtns = await main.evaluate(()=>[...document.querySelectorAll('.quick-start-btn')].map(b=>b.dataset.city));
check('the main page Quick Start buttons match presets.js', JSON.stringify(mainBtns)===JSON.stringify(cities.map(c=>c[0])), mainBtns.join(', '));

const ref = {};
for(const [key, label, sym] of cities){
  await main.evaluate(k=>document.querySelector('.quick-start-btn[data-city="'+k+'"]').click(), key);
  await main.waitForTimeout(40);
  ref[key] = [await mainCsv(main,'own'), await mainCsv(main,'rent')];
  const sens = await open(SENS);
  await pickCity(sens, key);
  const d = diffAt(ref[key][0], await sensCsv(sens,'own')) || diffAt(ref[key][1], await sensCsv(sens,'rent'));
  check(`Q1 ${label}: Own + Rent exports match the main page Quick Start`, !d, d||'');
  const h = await header(sens);
  const symsOk = await sens.evaluate(s=>[...document.querySelectorAll('.param-input[data-key="propertyPrice"]')].every(i=>(i.closest('td').textContent||'').includes(s)), sym);
  check(`Q2 ${label}: column named after the city, page currency ${sym}`, h.names[0]===label && h.page===sym && symsOk, JSON.stringify(h));
  await sens.close();
}

// Q3: Perth first, drag it right, then Melbourne into the first column.
{
  const sens = await open(SENS);
  await pickCity(sens, 'perth');
  const before = await header(sens);
  check('Q3 only the first column has the picker', JSON.stringify(before.pickers)==='["0"]', JSON.stringify(before.pickers));
  const perthOwn = await sensCsv(sens,'own',0);
  // Move column 0 one place right with the grip's arrow key (as drag.mjs does).
  await sens.focus('[data-col-grip="0"]');
  await sens.keyboard.press('ArrowRight');
  await sens.waitForTimeout(100);
  await pickCity(sens, 'melbourne');
  const after = await header(sens);
  check('Q3 after a move the new first column has the picker', JSON.stringify(after.pickers)==='["0"]', JSON.stringify(after.pickers));
  check('Q3 Melbourne first, Perth second', after.names[0]==='Melbourne, AU' && after.names[1]==='Perth, AU', after.names.join(' | '));
  check('Q3 Perth moved right keeps its figures', diffAt(perthOwn, await sensCsv(sens,'own',1))===null);
  check('Q3 Melbourne matches the main page', diffAt(ref.melbourne[0], await sensCsv(sens,'own',0))===null);
  await sens.close();
}

// Q4: detailed modes on before a city is loaded.
{
  const sens = await open(SENS);
  await sens.evaluate(()=>['mortgageMode','ownCostsMode','rentCostsMode'].forEach(k=>document.querySelector('.mode-seg[data-mode-key="'+k+'"] .seg-btn[data-val="detailed"]').click()));
  await pickCity(sens, 'jakarta');
  const rows = await sens.evaluate(()=>({rp:document.querySelectorAll('.rp-type[data-si="0"]').length, ci:document.querySelectorAll('.ci-basis[data-si="0"]').length}));
  check('Q4 detailed modes: the city seeds one rate period and its cost rows', rows.rp===1 && rows.ci===3, JSON.stringify(rows));
  const d = diffAt(ref.jakarta[0], await sensCsv(sens,'own')) || diffAt(ref.jakarta[1], await sensCsv(sens,'rent'));
  check('Q4 detailed modes: Jakarta exports still match the main page', !d, d||'');
  await sens.close();
}

// Q5: the Indonesian page.
{
  const sens = await open(SENS_ID);
  const label = await sens.evaluate(()=>document.querySelector('.scen-preset-select option').textContent);
  await pickCity(sens, 'kualalumpur');
  const h = await header(sens);
  const d = diffAt(ref.kualalumpur[0], await sensCsv(sens,'own')) || diffAt(ref.kualalumpur[1], await sensCsv(sens,'rent'));
  check('Q5 Indonesian page: picker in Indonesian, Kuala Lumpur loads in RM with the same figures', /Mulai Cepat/.test(label) && h.page==='RM' && !d, label+' '+(d||''));
  await sens.close();
}

await browser.close();
console.log(`\nquick start picker: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
