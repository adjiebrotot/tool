// Financing vs Cash — scenario colour audit.
// The colour a scenario is drawn with is user-settable from two controls that
// must never disagree: the dot on its card in the list, and the boxed swatch in
// the editor's Scenario Name row. This drives the real page headless and holds
// both to the same answer, including across a save, a duplicate and a reload.
// Run: node colour.mjs
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = pathToFileURL(join(HERE, '..', 'index.html')).href;
const CHART_STUB = `
window.__charts = [];
class Chart { constructor(ctx,cfg){this.config=cfg;this.data=(cfg&&cfg.data)||{datasets:[]};this.options=(cfg&&cfg.options)||{};this.canvasId=(ctx&&ctx.id)||'';window.__charts.push(this);}
 update(){} destroy(){const i=window.__charts.indexOf(this);if(i>=0)window.__charts.splice(i,1);} resetZoom(){} }
Chart.register=function(){};window.Chart=Chart;
window.Plotly={newPlot:async()=>{},react:async()=>{},relayout:async()=>{},downloadImage:async()=>{},toImage:async()=>'data:,'};`;
let pass=0,fail=0;
const check=(n,ok,d)=>{console.log((ok?'  PASS  ':'✗ FAIL  ')+n+(d?'  — '+d:''));ok?pass++:fail++;};
const browser=await chromium.launch({args:['--allow-file-access-from-files']});
const page=await browser.newPage();
page.on('pageerror',e=>console.log('PAGEERROR:',e.message));
await page.route('**/*',route=>{const url=route.request().url();
 if(url.startsWith('file://'))return route.continue();
 if(/chart\.umd/.test(url))return route.fulfill({contentType:'application/javascript',body:CHART_STUB});
 return route.fulfill({contentType:'application/javascript',body:'/* stub */'});});
await page.goto(PAGE,{waitUntil:'load'});
await page.waitForTimeout(300);
const lineOf=async name=>page.evaluate(n=>{
  const ch=window.__charts.filter(c=>c.canvasId==='chartCanvas').pop();
  const d=ch.data.datasets.find(x=>x.label===n);return d?d.borderColor:null;},name);

// C1 the dot is a real colour input carrying the palette colour
const dots=await page.$$('.sc-dot');
const tag=await page.evaluate(()=>{const d=document.querySelector('.sc-dot');return d.tagName+':'+d.type+':'+d.value;});
check('C1 the dot on each card is a clickable colour input seeded with the series colour',
  dots.length===2 && /^INPUT:color:#[0-9a-f]{6}$/.test(tag), `${dots.length} dots, first = ${tag}`);

// C2 changing the dot repaints that scenario's line and nothing else
const before=await lineOf('60mo Monthly @ 5%'), otherBefore=await lineOf('36mo Monthly @ 7%');
await page.evaluate(()=>{const d=document.querySelector('.sc-dot');d.value='#ff00aa';
  d.dispatchEvent(new Event('change',{bubbles:true}));});
await page.waitForTimeout(250);
const after=await lineOf('60mo Monthly @ 5%'), otherAfter=await lineOf('36mo Monthly @ 7%');
check('C2 a colour picked on the dot becomes that series\' line colour, leaving the others alone',
  after==='#ff00aa' && otherAfter===otherBefore && before!=='#ff00aa',
  `line ${before} -> ${after}; other ${otherBefore} -> ${otherAfter}`);

// C3 the dot does not open the editor
const editorOpen=await page.evaluate(()=>document.getElementById('scenarioEditor').style.display);
check('C3 using the dot does not open the scenario editor', editorOpen!=='block', `editor display="${editorOpen}"`);

// C4 the editor box mirrors the dot, and vice versa
await page.evaluate(()=>document.querySelectorAll('.scenario-card')[0].click());
await page.waitForTimeout(150);
const box=await page.inputValue('#scColor');
check('C4 the editor swatch opens showing the colour the dot holds', box==='#ff00aa', `#scColor = ${box}`);
await page.evaluate(()=>{const b=document.getElementById('scColor');b.value='#00c2a0';
  b.dispatchEvent(new Event('change',{bubbles:true}));});
await page.waitForTimeout(250);
const dotVal=await page.evaluate(()=>document.querySelector('.sc-dot').value);
check('C5 a colour picked in the editor mirrors onto the card dot and the chart',
  dotVal==='#00c2a0' && (await lineOf('60mo Monthly @ 5%'))==='#00c2a0', `dot ${dotVal}`);

// C6 reset returns to the theme palette colour
await page.evaluate(()=>document.getElementById('scColorReset').click());
await page.waitForTimeout(250);
const reset=await lineOf('60mo Monthly @ 5%');
check('C6 reset returns the series to its palette colour', reset.toLowerCase()===before.toLowerCase(), `${reset} vs original ${before}`);

// C7 a saved edit keeps the colour
await page.evaluate(()=>{const b=document.getElementById('scColor');b.value='#ffaa00';
  b.dispatchEvent(new Event('change',{bubbles:true}));});
await page.waitForTimeout(200);
await page.evaluate(()=>{const n=document.getElementById('scName');n.value='Renamed';
  n.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('saveScenarioBtn').click();});
await page.waitForTimeout(250);
check('C7 saving the editor keeps the colour the swatch set', (await lineOf('Renamed'))==='#ffaa00', await lineOf('Renamed'));

// C8 duplicating hands the copy its own palette slot
await page.evaluate(()=>document.querySelector('.scenario-card [data-action="dup"]').click());
await page.waitForTimeout(250);
const dup=await lineOf('Renamed (copy)');
check('C8 a duplicate takes the next palette colour rather than cloning a custom one',
  dup && dup!=='#ffaa00', `copy = ${dup}`);

// C9 the colour survives a reload through the mini cache
await page.reload({waitUntil:'load'});
await page.waitForTimeout(400);
check('C9 a custom colour survives a reload', (await lineOf('Renamed'))==='#ffaa00', await lineOf('Renamed'));

// C10 every palette slot resolves to a colour something can actually paint
await page.evaluate(()=>{for(let i=0;i<4;i++)document.getElementById('addScenarioBtn').click();
  document.getElementById('cancelScenarioBtn').click();});
await page.waitForTimeout(400);
const sixth=await page.evaluate(()=>{const ch=window.__charts.filter(c=>c.canvasId==='chartCanvas').pop();
  return ch.data.datasets.map(d=>d.borderColor);});
check('C10 all six palette slots resolve to a paintable colour, none to an empty string',
  sixth.every(c=>/^#[0-9a-fA-F]{6}$|^rgb/.test(c)), sixth.join(' '));

console.log(`\ncolour audit: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail?1:0);
