// Rent vs Own — end-to-end accounting-integrity audit.
// Drives the REAL page headless (CDN libs stubbed), captures the app's own
// Own/Rent/RTB cashflow CSV exports and checks the books balance:
//   R1  own-table cash identity  End = Beg + Budget + InterestInc − (Prin+Int+Ongoing)
//   R2  rent-table cash identity End = Beg + Budget + InterestInc − (Rent+Ongoing)
//   R3  Σ Principal_Exp over the term equals the loan (no money leaks into or
//       out of the mortgage), and Principal_Left hits 0 at term end
//   R4  term > horizon: Principal_Left at the horizon matches the closed-form
//       annuity balance
//   R5  auto budget year 1 = max(own required, rent required) recomputed here
//   R6  RTB transition: House_Equity at buy = DP on the grown price; loan =
//       price − DP
// Run: node run.mjs
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = pathToFileURL(join(HERE, '..', 'index.html')).href;

const CHART_STUB = `
window.__charts=[];
class Chart{constructor(c,g){this.config=g;this.data=(g&&g.data)||{datasets:[]};this.options=(g&&g.options)||{};window.__charts.push(this);}update(){}destroy(){}resetZoom(){}}
Chart.register=()=>{};window.Chart=Chart;`;

let pass=0, fail=0;
const check=(name,ok,detail)=>{ console.log((ok?'  PASS  ':'✗ FAIL  ')+name+(detail?'  — '+detail:'')); ok?pass++:fail++; };

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
await page.waitForTimeout(400);
await page.evaluate(()=>{ window.__csv=null; RVOExport.downloadCSV=(fn,txt)=>{ window.__csv=txt; }; });

async function setInputs(vals){
  await page.evaluate((vals)=>{
    const set=(id,v)=>{ const el=document.getElementById(id); if(!el) return; el.value=String(v); ['input','change'].forEach(t=>el.dispatchEvent(new Event(t,{bubbles:true}))); };
    Object.entries(vals).forEach(([k,v])=>{
      if(k==='rtbEnabled'){ const el=document.getElementById(k); el.checked=!!v; el.dispatchEvent(new Event('change',{bubbles:true})); }
      else set(k,v);
    });
  }, vals);
  await page.waitForTimeout(120);
}
async function grabCsv(table){
  await page.evaluate((table)=>{
    window.__csv=null;
    document.querySelector('.tab-btn[data-table="'+table+'"]')?.click();
    document.getElementById('downloadBtn').click();
  }, table);
  const txt = await page.evaluate(()=>window.__csv);
  const lines = txt.trim().split('\n').filter(l=>!l.startsWith('#'));
  const head = lines[0].split(',');
  return lines.slice(1).map(l=>{ const c=l.split(','); const o={}; head.forEach((h,i)=>o[h]=c[i]===''?null:parseFloat(c[i])); o.__raw=l; return o; });
}
const near=(a,b,tol)=>Math.abs(a-b)<=tol;
function pmt(P,annualPct,years){ const r=annualPct/100/12,n=years*12; return r===0?P/n:P*(r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1); }
function balanceAfter(P,annualPct,years,months){ const r=annualPct/100/12; const m=pmt(P,annualPct,years); let b=P; for(let i=0;i<months;i++){ b=b-(m-b*r); } return b; }

// ═══ Case A: defaults (800k, 20% down, 6%, 30y term, 30y horizon) ═══
await page.evaluate(()=>document.getElementById('resetBtn').click());
await page.waitForTimeout(200);
{
  const own = await grabCsv('own');
  const rent = await grabCsv('rent');
  // R1/R2 cash identities per year (whole-dollar CSV → tolerance a few $)
  let bad=[];
  own.slice(1).forEach(r=>{
    const rhs=r.Beg_Cash + r.Ann_Budget + r.Interest_Inc - (r.Principal_Exp + r.Interest_Exp + r.Ongoing_Exp);
    if(!near(r.End_Cash, rhs, 5)) bad.push(`yr${r.Year}: End ${r.End_Cash} vs ${rhs.toFixed(0)}`);
  });
  check('R1 own cash identity holds every year', bad.length===0, bad.slice(0,3).join('; '));
  bad=[];
  rent.slice(1).forEach(r=>{
    const rhs=r.Beg_Cash + r.Ann_Budget + r.Interest_Inc - (r.Rent_Exp + r.Ongoing_Exp);
    if(!near(r.End_Cash, rhs, 5)) bad.push(`yr${r.Year}: End ${r.End_Cash} vs ${rhs.toFixed(0)}`);
  });
  check('R2 rent cash identity holds every year', bad.length===0, bad.slice(0,3).join('; '));
  // R3 mortgage conservation
  const sumPrin = own.slice(1).reduce((s,r)=>s+(r.Principal_Exp||0),0);
  const lastLeft = own[own.length-1].Principal_Left;
  check('R3 Σ principal paid == loan and balance reaches 0',
    near(sumPrin, 640000, 30) && near(lastLeft, 0, 1),
    `Σ principal ${sumPrin.toFixed(0)} vs loan 640000; final balance ${lastLeft}`);
  // R5 auto budget year 1
  const ownReq = pmt(640000,6,30) + 6000/12;
  const rentReq = 2800 + 1200/12;
  const expect = Math.max(ownReq, rentReq)*12;
  check('R5 auto budget year 1 = 12 × max(own required, rent required)',
    near(own[1].Ann_Budget, expect, 5),
    `csv ${own[1].Ann_Budget} vs recomputed ${expect.toFixed(0)}`);
}

// ═══ Case B: term 30 > horizon 10 → remaining balance matches closed form ═══
await setInputs({horizon:10});
{
  const own = await grabCsv('own');
  const ref = balanceAfter(640000,6,30,120);
  check('R4 principal left at yr10 of a 30y loan matches annuity closed form',
    near(own[own.length-1].Principal_Left, ref, 5),
    `csv ${own[own.length-1].Principal_Left} vs closed-form ${ref.toFixed(0)}`);
}

// ═══ Case C: RTB at year 5 ═══
await page.evaluate(()=>document.getElementById('resetBtn').click());
await page.waitForTimeout(200);
await setInputs({rtbEnabled:true, rtbBuyYear:5});
{
  const rtb = await grabCsv('rtb');
  const buyRow = rtb.find(r=>r.__raw.includes('buy-transition'));
  const price5 = 800000*Math.pow(1.05,5);
  const dp5 = price5*0.20, loan5 = price5-dp5;
  check('R6 RTB transition: house equity = DP on grown price; loan = price − DP',
    buyRow && near(buyRow.House_Equity, dp5, 5) && near(buyRow.Principal_Left, loan5, 5),
    buyRow?`equity ${buyRow.House_Equity} vs ${dp5.toFixed(0)}; loan ${buyRow.Principal_Left} vs ${loan5.toFixed(0)}`:'no buy-transition row');
  // RTB cash identity across phases
  let bad=[];
  rtb.slice(1).forEach(r=>{
    // buy-transition year also spends DP + setup (default setup is a FIXED
    // $32,000 item — fixed-$ setup items deliberately do not scale with price)
    const rhs=r.Beg_Cash + r.Ann_Budget + r.Interest_Inc - (r.Total_Exp||0) - (r.__raw.includes('buy-transition')? (32000 + dp5) : 0);
    if(!near(r.End_Cash, rhs, Math.max(6, Math.abs(r.End_Cash)*0.001))) bad.push(`yr${r.Year}(${r.__raw.split(',')[1]}): End ${r.End_Cash} vs ${rhs.toFixed(0)}`);
  });
  check('R7 RTB cash identity holds every year (incl. purchase year outlay)', bad.length===0, bad.slice(0,4).join('; '));
}

await browser.close();
console.log(`\nrentvsownhouse audit: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
