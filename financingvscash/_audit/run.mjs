// Financing vs Cash — end-to-end audit harness.
// Drives the REAL page headless (CDN libs stubbed; the Chart.js stub records
// every chart config so tests can inspect the plotted datasets).
// Run: node run.mjs
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

// ── independent replay of the documented engine (header comment, script.js) ──
function replay({price, cash, rf, rate, n, ppy, downPct=0, fee=0, adminFee=0}){
  const down=Math.min(price*downPct/100, price, cash);
  const financed=price-down;
  const r=Math.pow(1+rate/100,1/ppy)-1;
  const pmt = r===0 ? financed/n : financed*(r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1);
  const rfp=Math.pow(1+rf/100,1/ppy)-1;
  let bal=financed, totInt=0, inv=cash-down-fee;
  for(let i=1;i<=n;i++){
    const int=bal*r; totInt+=int;
    const pay = i===n ? int+bal : pmt;
    bal = i===n ? 0 : Math.max(0, bal-(pmt-int));
    inv = inv*(1+rfp) - pay - adminFee;
  }
  const cashEnd=(cash-price>0?cash-price:0)*Math.pow(1+rf/100, n/ppy);
  return {pmt, totInt, endWealth:inv, cashEnd, netBenefit:inv-cashEnd};
}

const browser = await chromium.launch({args:['--allow-file-access-from-files']});
const page = await browser.newPage();
page.on('pageerror', e=>console.log('PAGEERROR:', e.message));
await page.route('**/*', route=>{
  const url=route.request().url();
  if(url.startsWith('file://')) return route.continue();
  if(/chart\.umd/.test(url)) return route.fulfill({contentType:'application/javascript', body:CHART_STUB});
  return route.fulfill({contentType:'application/javascript', body:'/* stub */'});
});
await page.goto(PAGE, {waitUntil:'load'});
await page.waitForTimeout(300);

async function compTable(){
  return await page.evaluate(()=>{
    const rows=[...document.querySelectorAll('#compTableWrap table tbody tr')];
    const out={};
    rows.forEach(tr=>{ const c=[...tr.children].map(td=>td.textContent.trim()); out[c[0]]=c.slice(1); });
    out.__cols=[...document.querySelectorAll('#compTableWrap table thead th')].map(t=>t.textContent.trim());
    return out;
  });
}

// ── F1: default scenarios' Ending Wealth / Net Benefit match an independent
//        replay of the documented mathematics ──
{
  const t=await compTable();
  const ref1=replay({price:50000, cash:50000, rf:4.5, rate:5, n:60, ppy:12});
  const ref2=replay({price:50000, cash:50000, rf:4.5, rate:7, n:36, ppy:12});
  const got1=money(t['Ending Wealth'][1]), got2=money(t['Ending Wealth'][2]);
  const nb1=money(t['Net Benefit vs Cash'][1]), nb2=money(t['Net Benefit vs Cash'][2]);
  check('F1 ending wealth matches independent replay (both default scenarios)',
    Math.abs(got1-ref1.endWealth)<1 && Math.abs(got2-ref2.endWealth)<1,
    `app ${got1.toFixed(2)}/${got2.toFixed(2)} vs replay ${ref1.endWealth.toFixed(2)}/${ref2.endWealth.toFixed(2)}`);
  check('F1b net benefit matches replay',
    Math.abs(nb1-ref1.netBenefit)<1 && Math.abs(nb2-ref2.netBenefit)<1,
    `app ${nb1.toFixed(2)}/${nb2.toFixed(2)} vs replay ${ref1.netBenefit.toFixed(2)}/${ref2.netBenefit.toFixed(2)}`);
}

// ── F2: mixed payment frequencies on one chart axis. Add a YEARLY scenario
//        (5 payments = 5 years) next to the monthly 60-payment (= 5 years)
//        default. Same real duration — but the chart x-axis is a raw period
//        index, so the yearly line gets extrapolated to period 60 = SIXTY YEARS
//        while the monthly line ends at 60 months. ──
{
  await page.evaluate(()=>document.getElementById('addScenarioBtn').click());
  await page.evaluate(()=>{
    const set=(id,v)=>{ const el=document.getElementById(id); el.value=v; ['input','change'].forEach(t=>el.dispatchEvent(new Event(t,{bubbles:true}))); };
    document.getElementById('scName').value='Yearly 5y @5%';
    set('scFreq','yearly'); set('scTerm','5'); set('scRate','5');
    document.getElementById('saveScenarioBtn').click();
  });
  await page.waitForTimeout(250);
  const t=await compTable();
  const idxYearly=t.__cols.findIndex(c=>c==='Yearly 5y @5%')-1; // minus 'Metric' col
  const tableEW=money(t['Ending Wealth'][idxYearly]);
  const chart=await page.evaluate(()=>{
    const ch=window.__charts[window.__charts.length-1];
    const ds=ch.data.datasets.find(d=>d.label==='Yearly 5y @5%');
    const last=ds?ds.data[ds.data.length-1]:null;
    return {xTitle:ch.options.scales.x.title.text, xType:ch.options.scales.x.type,
            lastX:last?last.x:null, lastY:last?last.y:null};
  });
  // On a time (years) axis the yearly scenario ends at x = its actual term (5)
  // with y = its 5-year ending wealth (== the comparison-table Ending Wealth),
  // instead of being compounded out to period 60 (60 years).
  const ok = chart.xType==='linear' && Math.abs(chart.lastX-5)<1e-6 && Math.abs(chart.lastY-tableEW) < Math.abs(tableEW)*0.01;
  check('F2 mixed-frequency chart uses a time axis; yearly scenario ends at its 5-yr wealth',
    ok,
    `x-axis "${chart.xTitle}" (${chart.xType}); yearly scenario ends at x=${chart.lastX}, y=${chart.lastY?.toFixed(0)} vs table Ending Wealth ${tableEW.toFixed(0)}`);
}

// ── F3: editing a scenario's frequency: the code comments say "If freq changed,
//        convert termPeriods" — verify. Change the 60-MONTH scenario to weekly:
//        60 months (5 yr) should become 260 weeks, not silently 60 weeks (1.15 yr). ──
{
  // open editor on scenario 0 (60mo Monthly @ 5%)
  await page.evaluate(()=>{ document.querySelectorAll('.scenario-card .sc-btn[data-action="edit"]')[0].click(); });
  await page.evaluate(()=>{
    const set=(id,v)=>{ const el=document.getElementById(id); el.value=v; ['input','change'].forEach(t=>el.dispatchEvent(new Event(t,{bubbles:true}))); };
    set('scFreq','weekly');
    document.getElementById('saveScenarioBtn').click();
  });
  await page.waitForTimeout(200);
  const card=await page.evaluate(()=>document.querySelectorAll('.scenario-card .sc-summary')[0].textContent.trim());
  check('F3 changing frequency converts the term (5 years stays 5 years)',
    /260\s*weeks/.test(card),
    `scenario now reads "${card}" — a 5-year monthly loan silently became a ~1.15-year weekly loan`);
}

// ── F4: down payment + origination fee exceeding available cash: the scenario
//        silently vanishes (computeScenario returns null) with NO warning. 99%
//        down (49,500) + 1,000 fee > 50,000 cash → cashAfterUpfront < 0. ──
{
  await page.evaluate(()=>document.getElementById('resetBtn').click());
  await page.waitForTimeout(200);
  await page.evaluate(()=>{ document.querySelectorAll('.scenario-card .sc-btn[data-action="edit"]')[0].click(); });
  await page.evaluate(()=>{
    const set=(id,v)=>{ const el=document.getElementById(id); el.value=v; ['input','change'].forEach(t=>el.dispatchEvent(new Event(t,{bubbles:true}))); };
    set('scDownPct','99');
    set('scFeeAmt','1,000');
    document.getElementById('saveScenarioBtn').click();
  });
  await page.waitForTimeout(200);
  const st=await page.evaluate(()=>({
    cols:[...document.querySelectorAll('#compTableWrap table thead th')].map(t=>t.textContent.trim()),
    warn:document.getElementById('warnBanner').style.display,
    warnTxt:document.getElementById('warnBanner').textContent,
  }));
  const dropped=!st.cols.includes('60mo Monthly @ 5%');
  check('F4 unaffordable fee: scenario is either shown or explained (not silently dropped)',
    !dropped || st.warn==='block',
    `scenario vanished from the comparison (cols now ${JSON.stringify(st.cols)}) with warning banner display="${st.warn}"`);
}

await browser.close();
console.log(`\nfinancingvscash audit: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
