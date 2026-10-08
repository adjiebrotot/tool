// Rent vs Own Sensitivity: Quick Start picker audit.
//
// The first column can be filled with any Quick Start scenario (a city and
// one of its homes). Both pages read the one list, ../../quickstart-data.js.
//
//   Q0  the main page offers every city in the data, and for each city
//       exactly the homes that city has
//   Q1  every scenario loaded into the first column gives Own and Rent
//       cashflow exports byte-identical to the same Quick Start on the
//       main page
//   Q2  the column is named after the scenario, and the page currency (the
//       picker and every column) follows the city's symbol
//   Q3  only the first column has the picker; after a drag the column now
//       first has it, and the scenario moved right keeps all its figures
//   Q4  with the detailed modes on, a scenario still loads (its lists are
//       seeded) and gives the same exports as in simple mode
//   Q5  the Indonesian page has the picker and loads the same figures
//   Q6  search: the list shows exactly the scenarios whose city, country,
//       currency or home has every word typed, the way the Cost of Living
//       Comparator's city picker matches
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
  await page.addInitScript(()=>{ try{ localStorage.clear(); localStorage.setItem('rvos-tour-v2-seen','1'); localStorage.setItem('rvo-tour-v2-seen','1'); localStorage.setItem('rvo-tour-v3-seen','1'); localStorage.setItem('rvo-id-tour-v3-seen','1'); }catch(e){} });
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
// Pick through the popover, as a reader would: open it, type, press the row.
const pickCity = (page, sid) => page.evaluate(async (sid)=>{
  const sleep = ms => new Promise(r=>setTimeout(r, ms));
  document.querySelector('.scen-preset[data-si="0"]').click();
  await sleep(10);
  const input = document.querySelector('.scen-preset-pop.open .scen-preset-search');
  const [c, t] = sid.split('/');
  input.value = window.RVO_QS.city(c).city + ' ' + window.RVO_QS.type(t).name.en;
  input.dispatchEvent(new Event('input', {bubbles:true}));
  const row = document.querySelector('.scen-preset-pop .combo-opt[data-sid="'+sid+'"]');
  if(!row) throw new Error('no row for '+sid+' after typing "'+input.value+'"');
  row.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true}));
}, sid);
// The main page's own picker: the city's row, then the home.
const pickMain = (page, sid) => page.evaluate((sid)=>{
  const [c, t] = sid.split('/');
  const input = document.getElementById('qsCity');
  input.focus();
  input.value = window.RVO_QS.city(c).city;
  input.dispatchEvent(new Event('input', {bubbles:true}));
  document.querySelector('#qsCityList .combo-opt[data-key="'+c+'"]').dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true}));
  const sel = document.getElementById('qsType');
  if(sel.value !== t){ sel.value = t; sel.dispatchEvent(new Event('change', {bubbles:true})); }
  return sel.value === t;
}, sid);
const mainCsv = (page, t) => page.evaluate((t)=>{ window.__csv=null; document.querySelector('.tab-btn[data-table="'+t+'"]').click(); document.getElementById('downloadBtn').click(); return window.__csv; }, t);
const sensCsv = (page, w, si=0) => page.evaluate(([w,si])=>{ window.__csv=null; document.querySelector('.btn-scen-action.dl-'+w+'[data-si="'+si+'"]').click(); return window.__csv; }, [w,si]);
const diffAt=(a,b)=>{ if(!a||!b) return 'missing export'; const A=a.split('\n'), B=b.split('\n'); for(let i=0;i<Math.max(A.length,B.length);i++) if(A[i]!==B[i]) return `line ${i+1}\n      main: ${A[i]}\n      sens: ${B[i]}`; return null; };
const header = page => page.evaluate(()=>({
  names: [...document.querySelectorAll('.scen-name-input')].map(i=>i.value),
  pickers: [...document.querySelectorAll('.scen-preset')].map(s=>s.dataset.si),
  page: document.getElementById('currencySelect').value,
  price: [...document.querySelectorAll('.param-input[data-key="propertyPrice"]')].map(i=>i.value),
}));

const main = await open(MAIN);
const all = await main.evaluate(()=>window.RVO_QS.all());
const info = await main.evaluate(()=>{
  const Q = window.RVO_QS, out = {};
  Q.all().forEach(sid=>{ const p = Q.preset(sid); out[sid] = {label:Q.label(sid,'en'), labelId:Q.label(sid,'id'), sym:p.currencySymbol}; });
  return out;
});

// Q0: the main page offers what the data holds.
{
  const got = await main.evaluate(async ()=>{
    const Q = window.RVO_QS, input = document.getElementById('qsCity'), bad = [];
    input.focus(); input.value = ''; input.dispatchEvent(new Event('input', {bubbles:true}));
    const rows = [...document.querySelectorAll('#qsCityList .combo-opt')].map(r=>r.dataset.key).sort();
    const want = Q.data.cities.map(c=>c.key).sort();
    if(JSON.stringify(rows)!==JSON.stringify(want)) bad.push('cities '+rows.length+' vs '+want.length);
    for(const c of Q.data.cities){
      input.value = c.city; input.dispatchEvent(new Event('input', {bubbles:true}));
      document.querySelector('#qsCityList .combo-opt[data-key="'+c.key+'"]').dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true}));
      const opts = [...document.querySelectorAll('#qsType option')].map(o=>o.value);
      if(JSON.stringify(opts)!==JSON.stringify(Q.homes(c.key))) bad.push(c.key+': '+opts.join(','));
    }
    return {n: want.length, bad};
  });
  check(`Q0 the main page offers all ${got.n} cities, each with exactly its own homes`, !got.bad.length, got.bad.slice(0,4).join(' | '));
}

// Q1 and Q2: every scenario, on one Sensitivity page loaded once.
const ref = {};
{
  const sens = await open(SENS);
  const bad1 = [], bad2 = [];
  for(const sid of all){
    if(!(await pickMain(main, sid))){ bad1.push(sid+' (main page has no such home)'); continue; }
    await main.waitForTimeout(20);
    ref[sid] = [await mainCsv(main,'own'), await mainCsv(main,'rent')];
    await pickCity(sens, sid);
    const d = diffAt(ref[sid][0], await sensCsv(sens,'own')) || diffAt(ref[sid][1], await sensCsv(sens,'rent'));
    if(d) bad1.push(sid+': '+d);
    const {label, sym} = info[sid];
    const h = await header(sens);
    const symsOk = await sens.evaluate(s=>[...document.querySelectorAll('.param-input[data-key="propertyPrice"]')].every(i=>(i.closest('td').textContent||'').includes(s)), sym);
    if(!(h.names[0]===label && h.page===sym && symsOk)) bad2.push(sid+' '+JSON.stringify(h));
  }
  check(`Q1 all ${all.length} scenarios: Own + Rent exports match the main page Quick Start`, !bad1.length, bad1.slice(0,3).join('\n    '));
  check(`Q2 all ${all.length} scenarios: column named after the scenario, page currency follows`, !bad2.length, bad2.slice(0,3).join(' | '));
  await sens.close();
}

// Q3: Perth first, drag it right, then Melbourne into the first column.
{
  const sens = await open(SENS);
  await pickCity(sens, 'perth/apt-2br');
  const before = await header(sens);
  check('Q3 only the first column has the picker', JSON.stringify(before.pickers)==='["0"]', JSON.stringify(before.pickers));
  const perthOwn = await sensCsv(sens,'own',0);
  // Move column 0 one place right with the grip's arrow key (as drag.mjs does).
  await sens.focus('[data-col-grip="0"]');
  await sens.keyboard.press('ArrowRight');
  await sens.waitForTimeout(100);
  await pickCity(sens, 'melbourne/apt-2br');
  const after = await header(sens);
  check('Q3 after a move the new first column has the picker', JSON.stringify(after.pickers)==='["0"]', JSON.stringify(after.pickers));
  check('Q3 Melbourne first, Perth second', after.names[0]===info['melbourne/apt-2br'].label && after.names[1]===info['perth/apt-2br'].label, after.names.join(' | '));
  check('Q3 Perth moved right keeps its figures', diffAt(perthOwn, await sensCsv(sens,'own',1))===null);
  check('Q3 Melbourne matches the main page', diffAt(ref['melbourne/apt-2br'][0], await sensCsv(sens,'own',0))===null);
  await sens.close();
}

// Q4: detailed modes on before a city is loaded.
{
  const sens = await open(SENS);
  await sens.evaluate(()=>['mortgageMode','ownCostsMode','rentCostsMode'].forEach(k=>document.querySelector('.mode-seg[data-mode-key="'+k+'"] .seg-btn[data-val="detailed"]').click()));
  await pickCity(sens, 'jakarta/apt-2br');
  const rows = await sens.evaluate(()=>({rp:document.querySelectorAll('.rp-type[data-si="0"]').length, ci:document.querySelectorAll('.ci-basis[data-si="0"]').length}));
  check('Q4 detailed modes: the city seeds one rate period and its cost rows', rows.rp===1 && rows.ci===3, JSON.stringify(rows));
  const d = diffAt(ref['jakarta/apt-2br'][0], await sensCsv(sens,'own')) || diffAt(ref['jakarta/apt-2br'][1], await sensCsv(sens,'rent'));
  check('Q4 detailed modes: Jakarta exports still match the main page', !d, d||'');
  await sens.close();
}

// Q5: the Indonesian page.
{
  const sens = await open(SENS_ID);
  const sid = 'kualalumpur/apt-2br';
  await sens.evaluate(()=>document.querySelector('.scen-preset[data-si="0"]').click());
  const ph = await sens.evaluate(()=>document.querySelector('.scen-preset-search').placeholder);
  await sens.keyboard.press('Escape');
  await pickCity(sens, sid);
  const h = await header(sens);
  const d = diffAt(ref[sid][0], await sensCsv(sens,'own')) || diffAt(ref[sid][1], await sensCsv(sens,'rent'));
  check('Q5 Indonesian page: picker in Indonesian, Kuala Lumpur loads in RM with the same figures, named in Indonesian',
    /Cari/.test(ph) && h.page==='RM' && h.names[0]===info[sid].labelId && !d, ph+' | '+h.names[0]+' '+(d||''));
  await sens.close();
}

// Q6: search matches the way the city picker does.
{
  const sens = await open(SENS);
  const qs = ['perth', 'singapore', 'australia', 'kuala apartment', 'rp', 'zzz no such place', 'uae', 'zurich', 'studio', 'tokyo 2br', 'house'];
  const bad = [];
  for(const q of qs){
    const r = await sens.evaluate((q)=>{
      document.querySelector('.scen-preset[data-si="0"]').click();
      const input = document.querySelector('.scen-preset-pop.open .scen-preset-search');
      input.value = q; input.dispatchEvent(new Event('input', {bubbles:true}));
      const got = [...document.querySelectorAll('.scen-preset-pop .combo-opt')].map(r=>r.dataset.sid).sort();
      const Q = window.RVO_QS;
      const want = Q.all().filter(sid=>{ const [c,t] = sid.split('/'); return Q.homeMatches(Q.city(c), t, q, 'en'); }).sort();
      const words = q.split(/\s+/);
      // Independent of homeMatches: every listed row really carries every word.
      const honest = got.every(sid=>{
        const [c,t] = sid.split('/'), C = Q.city(c), T = Q.type(t);
        const hay = [C.city, C.country, C.countryId, C.countryCode, C.currencyCode, C.region].concat(C.aliases||[], [T.name.en, T.short.en, Q.formText(T.form,'en'), T.form==='house'?'villa townhouse':'flat condo unit']).join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
        return words.every(w=>hay.includes(w));
      });
      const empty = !!document.querySelector('.scen-preset-pop .combo-empty');
      document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}));
      input.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
      return {n: got.length, same: JSON.stringify(got)===JSON.stringify(want), honest, empty};
    }, q);
    if(!r.same || !r.honest || (r.n===0) !== r.empty) bad.push(q+' '+JSON.stringify(r));
  }
  check('Q6 the search lists exactly the scenarios that carry every word typed', !bad.length, bad.join(' | '));
  await sens.close();
}

await browser.close();
console.log(`\nquick start picker: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
