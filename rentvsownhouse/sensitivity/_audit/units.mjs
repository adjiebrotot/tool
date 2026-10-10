// Rent vs Own Sensitivity: units, groups and the money-or-% switch.
//
// The table carries no Unit column: each field states its own unit, and it
// has to be the unit the engine reads the figure in, scenario by scenario.
//
//   U1  no Unit column; every number field shows a unit inside it
//   U2  a cost's unit follows its type and the currency ("Rp 32,000", then
//       "4 % of price"), and so does the type's own "Fixed amount (Rp)"
//   U3  switching a cost between money and "%" restates it against what the
//       "%" is a share of, so year 1 costs the same: setup on the price,
//       owning costs on the home's value, renting costs on a year of rent
//   U4  a field shown as unused is one the engine ignores: two scenarios that
//       differ only there give byte-identical cashflows, while the same
//       difference where the field is used does change them (the control)
//   U5  a deciding field sits above the fields it governs, in one group with
//       no rule between its rows, and a rule around it
//   U6  an automatic figure is a blank "Auto" field; clearing a set figure
//       returns it to automatic
//   U7  a rebuild keeps the focus where Tab sent it
//   U8  the Indonesian page has the same units, in Indonesian
// Run: node units.mjs
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SENS = pathToFileURL(join(HERE, '..', 'index.html')).href;
const SENS_ID = pathToFileURL(join(HERE, '..', 'id', 'index.html')).href;

let pass=0, fail=0;
const check=(name,ok,detail)=>{ console.log((ok?'  PASS  ':'✗ FAIL  ')+name+(detail?'  — '+detail:'')); ok?pass++:fail++; };

const browser = await chromium.launch({args:['--allow-file-access-from-files']});
async function open(url){
  const page = await (await browser.newContext({viewport:{width:1500,height:1000}})).newPage();
  page.on('pageerror', e=>{ console.log('PAGEERROR:', e.message); fail++; });
  await page.addInitScript(()=>{ try{ localStorage.clear(); localStorage.setItem('rvos-tour-v2-seen','1'); }catch(e){} });
  await page.route('**/*', r=>r.request().url().startsWith('file://') ? r.continue() : r.fulfill({contentType:'application/javascript', body:'/* stub */'}));
  await page.goto(url, {waitUntil:'load'});
  await page.waitForTimeout(300);
  await page.evaluate(()=>{ window.__csv=null; RVOExport.downloadCSV=(fn,txt)=>{ window.__csv=txt; }; window.alert=m=>{ window.__alert=m; }; });
  return page;
}
// The figures every column shares are one field across the table.
const SHARED = ['horizon','riskFreeRate','initialCash','monthlyBudget','monthlyBudgetIncrease'];
const q = (key, si=0, cls='param-input') => SHARED.includes(key) && cls==='param-input'
  ? `.shared-input[data-key="${key}"]` : `.${cls}[data-key="${key}"][data-si="${si}"]`;
const affix = (page, key, si=0) => page.evaluate(([sel])=>{
  const el=document.querySelector(sel); if(!el) return null;
  const w=el.closest('.param-wrap'); const t=s=>{ const n=w.querySelector(s); return n ? n.textContent.trim() : ''; };
  return {pre:t('.prefix'), suf:t('.suffix'), value:el.value, placeholder:el.placeholder};
}, [q(key,si)]);
async function pick(page, key, v, si=0){ await page.selectOption(q(key,si,'param-select'), v); await page.waitForTimeout(120); }
async function type(page, key, v, si=0){
  await page.evaluate(([s,v])=>{ const el=document.querySelector(s); el.focus(); el.value=v; el.dispatchEvent(new Event('input',{bubbles:true})); el.blur(); }, [q(key,si), v]);
  await page.waitForTimeout(120);
}
// A scenario's Own or Rent cashflow CSV, as rows of named numbers.
async function flows(page, which, si=0){
  const txt = await page.evaluate(([w,si])=>{ window.__csv=null; document.querySelector(`.btn-scen-action.dl-${w}[data-si="${si}"]`).click(); return window.__csv; }, [which,si]);
  const lines = txt.trim().split('\n').filter(l=>!l.startsWith('#'));
  const head = lines[0].split(',');
  return {text: txt, rows: lines.slice(1).map(l=>{ const c=l.split(','); const o={}; head.forEach((h,i)=>o[h]=parseFloat(c[i])); return o; })};
}
async function upload(page, csv){
  await page.setInputFiles('#csvFileInput', {name:'t.csv', mimeType:'text/csv', buffer:Buffer.from(csv)});
  await page.waitForTimeout(400);
}

// U1
{
  const page = await open(SENS);
  const heads = await page.evaluate(()=>[...document.querySelectorAll('#tableWrap thead th')].map(th=>(th.querySelector('.scen-name-input')||{}).value || th.textContent.trim()));
  check('U1a the table has no Unit column', !heads.some(h=>/^unit$/i.test(h)) && heads.length === 2 + 2, heads.join(' | '));
  for(const mode of ['simple','detailed']){
    if(mode==='detailed') await page.evaluate(()=>['mortgageMode','ownCostsMode','rentCostsMode'].forEach(k=>document.querySelector(`.mode-seg[data-mode-key="${k}"] .seg-btn[data-val="detailed"]`).click()));
    await type(page, 'monthlyBudget', '5000'); // brings the budget increase into use
    const bare = await page.evaluate(()=>[...document.querySelectorAll('#tableWrap .param-input')].filter(el=>{
      const w=el.closest('.param-wrap'); return !w || ![...w.querySelectorAll('.prefix,.suffix')].some(a=>a.textContent.trim()); }).map(el=>el.dataset.key));
    const n = await page.evaluate(()=>document.querySelectorAll('#tableWrap .param-input').length);
    check(`U1b every number field shows its unit inside it (${mode})`, bare.length===0 && n>10, bare.join(', ') || `${n} fields`);
  }
  await page.close();
}

// U2
{
  const page = await open(SENS);
  await page.selectOption('#currencySelect', 'Rp'); await page.waitForTimeout(150);
  let a = await affix(page, 'setupCost');
  check('U2a a fixed setup cost leads with the currency', a.pre==='Rp' && a.suf==='' && a.value==='32,000', JSON.stringify(a));
  const opt = await page.evaluate(s=>document.querySelector(s).selectedOptions[0].textContent, q('setupCostType',0,'param-select'));
  check('U2b the type names the currency it means', opt==='Fixed amount (Rp)', opt);
  await pick(page, 'setupCostType', 'pct');
  a = await affix(page, 'setupCost');
  check('U2c a % setup cost trails "% of price", with no currency', a.pre==='' && a.suf==='% of price', JSON.stringify(a));
  a = await affix(page, 'ownOngoingCost');
  check('U2d an owning cost in money says its period', a.pre==='Rp' && a.suf==='/yr', JSON.stringify(a));
  await pick(page, 'ownOngoingCostFreq', 'weekly');
  a = await affix(page, 'ownOngoingCost');
  check('U2e …and follows its frequency', a.suf==='/wk', JSON.stringify(a));
  await pick(page, 'ownOngoingCostType', 'pct');
  a = await affix(page, 'ownOngoingCost');
  check('U2f a % owning cost is a share of the home\'s value', a.pre==='' && a.suf==='% of value', JSON.stringify(a));
  await pick(page, 'rentOngoingCostType', 'pct');
  a = await affix(page, 'rentOngoingCost');
  check('U2g a % renting cost is a share of the rent', a.pre==='' && a.suf==='% of rent', JSON.stringify(a));
  await pick(page, 'rentFreq', 'weekly');
  a = await affix(page, 'rentAmount');
  check('U2h the rent says the period its frequency picks', a.pre==='Rp' && a.suf==='/wk', JSON.stringify(a));
  // Only scenario 0 changed: scenario 1 keeps its own units.
  a = await affix(page, 'setupCost', 1);
  check('U2i each scenario wears its own unit', a.pre==='Rp' && a.suf==='', JSON.stringify(a));
  await page.close();
}

// U3: year 1 survives the switch, later years follow the new basis
{
  const page = await open(SENS);
  const own0 = await flows(page, 'own'), rent0 = await flows(page, 'rent');
  await pick(page, 'setupCostType', 'pct');
  const own1 = await flows(page, 'own');
  check('U3a setup cost 32,000 -> 4% of the price: the same cost at purchase',
    own1.rows[0].Accum_Cost === own0.rows[0].Accum_Cost && (await affix(page,'setupCost')).value==='4',
    `${own0.rows[0].Accum_Cost} -> ${own1.rows[0].Accum_Cost}`);
  check('U3b …and the whole Own cashflow is unchanged (a % of a fixed price is fixed)', own1.text===own0.text);

  await pick(page, 'ownOngoingCostType', 'pct');
  const own2 = await flows(page, 'own');
  check('U3c owning costs 6,000 a year -> 0.75% of value: year 1 costs the same',
    own2.rows[1].Ongoing_Exp === own0.rows[1].Ongoing_Exp, `${own0.rows[1].Ongoing_Exp} -> ${own2.rows[1].Ongoing_Exp}`);
  check('U3d …and later years track the value (5%/yr growth) instead of 0% inflation',
    Math.abs(own2.rows[2].Ongoing_Exp - own0.rows[2].Ongoing_Exp*1.05) < 0.01, `${own0.rows[2].Ongoing_Exp} -> ${own2.rows[2].Ongoing_Exp}`);

  await pick(page, 'rentOngoingCostType', 'pct');
  const rent1 = await flows(page, 'rent');
  // 1,200 of 33,600 is 3.5714%; held to two decimals that is 3.57%, 0.48 a year less.
  check('U3e renting costs 1,200 a year -> 3.57% of a year of rent: year 1 within the rounding of the %',
    Math.abs(rent1.rows[1].Ongoing_Exp - rent0.rows[1].Ongoing_Exp) <= 33600*0.00005, `${rent0.rows[1].Ongoing_Exp} -> ${rent1.rows[1].Ongoing_Exp}`);

  // Back again: money, at the period that was picked before.
  await pick(page, 'ownOngoingCostType', 'dollar');
  check('U3f owning costs come back as 6,000 a year', (await affix(page,'ownOngoingCost')).value==='6,000');
  await pick(page, 'setupCostType', 'dollar');
  check('U3g setup comes back as 32,000', (await affix(page,'setupCost')).value==='32,000');
  // A price change after the switch keeps the % (the cost follows the price).
  await pick(page, 'setupCostType', 'pct');
  await type(page, 'propertyPrice', '1000000');
  check('U3h a later price change keeps the % as typed', (await affix(page,'setupCost')).value==='4');
  await page.close();
}

// U4: unused means unused
{
  const page = await open(SENS);
  const pair = (rows) => '"Parameter","Unit","A","B"\n' + rows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\n') + '\n';
  const same = async (rows) => { await upload(page, pair(rows));
    const [a,b] = [await flows(page,'own',0), await flows(page,'own',1)], [c,d] = [await flows(page,'rent',0), await flows(page,'rent',1)];
    return a.text===b.text && c.text===d.text; };
  const unused = async () => page.evaluate(()=>document.querySelectorAll('#tableWrap td.inactive-td').length);
  const cases = [
    ['an owning cost\'s inflation under a % type', [['Own cost type','','pct','pct'],['Ongoing cost (own)','','1','1'],['Own cost inflation','','0','6']],
                                                   [['Own cost type','','dollar','dollar'],['Own cost inflation','','0','6']]],
    ['an owning cost\'s frequency under a % type', [['Own cost type','','pct','pct'],['Ongoing cost (own)','','1','1'],['Own cost frequency','','yearly','weekly']],
                                                   [['Own cost type','','dollar','dollar'],['Own cost frequency','','yearly','weekly']]],
    ['a renting cost\'s inflation under a % type', [['Rent cost type','','pct','pct'],['Ongoing cost (rent)','','4','4'],['Rent cost inflation','','0','6']],
                                                   [['Rent cost type','','dollar','dollar'],['Rent cost inflation','','0','6']]],
    ['a renting cost\'s frequency under a % type', [['Rent cost type','','pct','pct'],['Ongoing cost (rent)','','4','4'],['Rent cost frequency','','yearly','monthly']],
                                                   [['Rent cost type','','dollar','dollar'],['Rent cost frequency','','yearly','monthly']]],
  ];
  for(const [name, off, on] of cases){
    const ignored = await same(off), shown = await unused();
    const used = !(await same(on));
    check(`U4 ${name} is shown as unused and changes nothing`, ignored && shown >= 2 && used, `ignored ${ignored}, unused cells ${shown}, used when active ${used}`);
  }
  await page.close();
}
// U4, shared: the budget increase is one field for every column, so the
// control is the same table before and after it is typed.
{
  const page = await open(SENS);
  const all = async () => [await flows(page,'own',0), await flows(page,'rent',0), await flows(page,'own',1), await flows(page,'rent',1)].map(f=>f.text).join('\n');
  const off = await page.evaluate(()=>!!document.querySelector('td.inactive-td.shared-td') && !document.querySelector('.shared-input[data-key="monthlyBudgetIncrease"]'));
  const base = await all();
  await upload(page, '"Parameter","Unit","A","B"\n"Monthly housing budget","","0","0"\n"Budget annual increase","","6","6"\n');
  const ignored = (await all()) === base;
  await type(page, 'monthlyBudget', '9000');
  const set0 = await all();
  await type(page, 'monthlyBudgetIncrease', '0');
  const used = (await all()) !== set0;
  check('U4 the budget increase with an automatic budget is shown as unused and changes nothing', off && ignored && used, `shown unused ${off}, ignored ${ignored}, used when active ${used}`);
  await page.close();
}

// U5: deciding field first, one group, no rule inside it
{
  const page = await open(SENS);
  await type(page, 'monthlyBudget', '5000'); // so the increase has a field to find
  const layout = await page.evaluate(()=>{
    const rows=[...document.querySelectorAll('#tableWrap tbody tr')];
    const at=k=>rows.findIndex(tr=>tr.querySelector(`[data-key="${k}"]`));
    const ruleBelow=k=>{ const tr=rows[at(k)]; return parseFloat(getComputedStyle(tr.querySelector('td.scen-td')).borderBottomWidth); };
    return {at:Object.fromEntries(['setupCostType','setupCost','ownOngoingCostType','ownOngoingCostFreq','ownOngoingCost','ownOngoingInflation',
      'rentFreq','rentAmount','rentOngoingCostType','rentOngoingCostFreq','rentOngoingCost','rentOngoingInflation','monthlyBudget','monthlyBudgetIncrease'].map(k=>[k,at(k)])),
      inside:['setupCostType','ownOngoingCostType','ownOngoingCostFreq','ownOngoingCost','rentFreq','rentOngoingCostType','monthlyBudget'].map(ruleBelow),
      around:['setupCost','ownOngoingInflation','rentAmount','rentOngoingInflation'].map(ruleBelow)};
  });
  const A = layout.at, before = (x,y)=>A[x]>=0 && A[y]>=0 && A[x]===A[y]-1;
  check('U5a each type sits directly above the cost it decides',
    before('setupCostType','setupCost') && before('ownOngoingCostType','ownOngoingCostFreq') && before('rentOngoingCostType','rentOngoingCostFreq'), JSON.stringify(A));
  check('U5b each frequency sits directly above the money it is per',
    before('ownOngoingCostFreq','ownOngoingCost') && before('rentOngoingCostFreq','rentOngoingCost') && before('rentFreq','rentAmount'));
  check('U5c the budget sits directly above its increase', before('monthlyBudget','monthlyBudgetIncrease'));
  check('U5d no rule between the rows of a group', layout.inside.every(w=>w===0), layout.inside.join(','));
  check('U5e a rule closes each group', layout.around.every(w=>w>0), layout.around.join(','));
  await page.close();
}

// U6: Auto
{
  const page = await open(SENS);
  const base = (await flows(page,'own')).text;
  let a = await affix(page, 'initialCash');
  check('U6a automatic initial cash is a blank "Auto" field', a.value==='' && a.placeholder==='Auto' && a.pre==='$', JSON.stringify(a));
  await type(page, 'initialCash', '2500000');
  a = await affix(page, 'initialCash');
  const set = (await flows(page,'own')).text;
  check('U6b a set figure shows and counts', a.value==='2,500,000' && set!==base);
  await type(page, 'initialCash', '');
  a = await affix(page, 'initialCash');
  check('U6c clearing it goes back to automatic', a.value==='' && (await flows(page,'own')).text===base);
  await type(page, 'monthlyBudget', '0');
  check('U6d a typed 0 reads as Auto', (await affix(page,'monthlyBudget')).value==='');
  await page.close();
}

// U7: focus survives the rebuild a budget change causes
{
  const page = await open(SENS);
  await page.click(q('monthlyBudget',0));
  await page.keyboard.type('5000');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(150);
  // The budget is one field across the table now. Its annual increase only
  // turns into a field once the budget is set, so Tab, pressed before that,
  // was headed for the next field there was: the first column's price.
  const f = await page.evaluate(()=>{ const a=document.activeElement; return a && a.dataset ? `${a.className}|${a.dataset.key}|${a.dataset.si}` : String(a&&a.tagName); });
  check('U7 Tab out of a field that rebuilds the table lands on the next field', f==='param-input|propertyPrice|0', f);
  await page.close();
}

// U8: Indonesian
{
  const page = await open(SENS_ID);
  const a = await affix(page, 'rentAmount'), b = await affix(page, 'monthlyBudget');
  const opt = await page.evaluate(s=>document.querySelector(s).selectedOptions[0].textContent, q('setupCostType',0,'param-select'));
  check('U8 the Indonesian page names its units in Indonesian', a.suf==='/bln' && b.placeholder==='Otomatis' && opt==='Jumlah tetap ($)', `${a.suf} ${b.placeholder} ${opt}`);
  await page.close();
}

await browser.close();
console.log(`\nsensitivity units audit: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
