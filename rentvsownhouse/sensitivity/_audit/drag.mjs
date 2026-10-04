// Rent vs Own Sensitivity: column drag audit.
//
// A scenario column can be dragged to a new place. Each scenario carries all
// of its own inputs and results, so a move is visual only: the scenarios
// change order and every one of them keeps every figure.
//
//   G1  a pointer drag moves the third scenario first; each scenario's inputs
//       and Own, Rent and difference figures travel with it, unchanged
//   G2  the arrow keys move a scenario one place, and focus stays on its grip
//   G3  the order is what gets saved and exported: the summary CSV header
//       follows it
//   G4  the Indonesian page has the same grips
//   G5  a single scenario has nothing to swap with, so it shows no grip
//
// Run: node drag.mjs
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
  const page = await (await browser.newContext({viewport:{width:1600,height:1000}})).newPage();
  page.on('pageerror', e=>{ console.log('PAGEERROR:', e.message); fail++; });
  await page.addInitScript(()=>{ try{ localStorage.setItem('rvos-tour-v2-seen','1'); }catch(e){} });   // no guided tour over the table
  await page.route('**/*', route=>route.request().url().startsWith('file://') ? route.continue() : route.fulfill({contentType:'application/javascript', body:'/* stub */'}));
  await page.goto(url, {waitUntil:'load'});
  await page.waitForTimeout(400);
  return page;
}
// Every scenario column on screen: its name, property price and the three
// result figures.
const read = page => page.evaluate(()=>{
  const t=document.querySelector('#tableWrap table.dt');
  const names=[...t.querySelectorAll('.scen-name-input')].map(i=>i.value);
  const price=[...t.querySelectorAll('.param-input[data-key="propertyPrice"]')].map(i=>i.value);
  const out=cls=>[...t.querySelectorAll(`tr.${cls} td.scen-td`)].map(td=>td.textContent.trim());
  return names.map((n,i)=>({name:n, price:price[i], own:out('out-own')[i], rent:out('out-rent')[i], delta:out('out-delta')[i]}));
});
async function setScenario(page, si, name, price){
  await page.evaluate(({si,name,price})=>{
    const n=document.querySelector(`.scen-name-input[data-si="${si}"]`); n.value=name; n.dispatchEvent(new Event('input',{bubbles:true}));
    const p=document.querySelector(`.param-input[data-key="propertyPrice"][data-si="${si}"]`); p.value=price; p.dispatchEvent(new Event('input',{bubbles:true})); p.dispatchEvent(new Event('change',{bubbles:true})); p.dispatchEvent(new Event('blur',{bubbles:true}));
  },{si,name,price});
  await page.waitForTimeout(120);
}

const page = await open(SENS);
await page.click('#addScenBtn'); await page.waitForTimeout(150);
await setScenario(page, 0, 'Cheap', '500000');
await setScenario(page, 1, 'Middle', '800000');
await setScenario(page, 2, 'Dear', '1200000');
const before = await read(page);

// G1: pointer drag, the grip carried past the first column's middle
{
  const g=await page.locator('[data-col-grip="2"]').boundingBox();
  const h=await page.locator('#tableWrap thead th:has([data-col-grip="0"])').boundingBox();
  await page.mouse.move(g.x+g.width/2, g.y+g.height/2);
  await page.mouse.down();
  await page.mouse.move(h.x+h.width/2-12, g.y+g.height/2, {steps:12});
  await page.mouse.up();
  await page.waitForTimeout(200);
}
const after = await read(page);
check('G1a the third scenario is now first', after.map(s=>s.name).join(', ')==='Dear, Cheap, Middle', after.map(s=>s.name).join(', '));
check('G1b every scenario keeps its inputs and results', ['Dear','Cheap','Middle'].every((n,i)=>JSON.stringify(after[i])===JSON.stringify(before.find(b=>b.name===n))),
  after.map(s=>`${s.name} ${s.delta}`).join(' / '));
check('G1c the scenarios really differ, so the check means something', new Set(before.map(s=>s.own)).size===3);

// G2: keyboard
await page.focus('[data-col-grip="0"]');
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(150);
const kb = await read(page);
check('G2a the right arrow moves a scenario one place', kb.map(s=>s.name).join(', ')==='Cheap, Dear, Middle', kb.map(s=>s.name).join(', '));
check('G2b focus stays on the moved scenario\'s grip', await page.evaluate(()=>document.activeElement?.dataset.colGrip==='1'));
check('G2c every scenario still keeps its figures', ['Cheap','Dear','Middle'].every((n,i)=>JSON.stringify(kb[i])===JSON.stringify(before.find(b=>b.name===n))));

// G3: export follows the order
const csv = await page.evaluate(()=>new Promise(res=>{
  const orig=URL.createObjectURL;
  URL.createObjectURL=b=>{ b.text().then(res); URL.createObjectURL=orig; return 'blob:x'; };
  document.getElementById('downloadCSVBtn').click();
}));
check('G3 the summary CSV lists the scenarios in the new order', /Cheap.*Dear.*Middle/.test(csv.split('\n')[0]), csv.split('\n')[0]);

// G4, G5
const idp = await open(SENS_ID);
check('G4 the Indonesian page has a grip per scenario, labelled in Indonesian',
  await idp.evaluate(()=>{ const g=[...document.querySelectorAll('[data-col-grip]')]; return g.length===2 && /Seret/.test(g[0].title); }));
await idp.click('.rmv-scen[data-si="1"]'); await idp.waitForTimeout(150);
check('G5 a single scenario shows no grip', await idp.evaluate(()=>!document.querySelector('[data-col-grip]')));

await browser.close();
console.log(`\nsensitivity column drag audit: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
