// Financing vs Cash — Show in today's money.
//
// The switch beside the results re-reads the board at today's prices; it is
// not a second model. Every check here reads the page twice, the switch off
// (future's money, the engine's own figures) and on, and holds the second to
// an independent replay of the first:
//
//   a balance or a payment at t years      x / (1 + i)^t
//   a total                                the sum of its parts, each deflated
//                                          to its own date, never one total
//                                          divided once
//   anything at the purchase               unchanged
//
// T1  Ending Wealth, the cash at the same horizon and Net Benefit read at each
//     row's own horizon; purchase-day rows do not move
// T2  every schedule row is its future row over (1+i)^(k/ppy), each row still
//     balances, and the Total row foots
// T3  the totals in the comparison table are the sums of the deflated parts:
//     interest, admin fees, fees, financing cost, out-of-pocket
// T4  every point of all four chart metrics is its future point over
//     (1+i)^(t), and each chart ends on the figure its table prints
// T5  the tiles and the verdict read the same figures, the Best tile is the
//     row with the highest Net Benefit on show, and the switch never sends the
//     board out of date
// T6  with prices held still, today's money and future's money are one page
// T7  the switch is saved with the plan and comes back on a reload
// T8  an optimisation sweep passes through today's table on four objectives,
//     and the separate Net Benefit in today's money objective is offered only
//     while the board reads future's money
// T9  the CSV is the schedule on screen, in the money on screen
// T10 the note under Inflation names what the price costs at the horizon
// T11 the switch and the rate are named in What this assumes
//
// Run: node today.mjs
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = pathToFileURL(join(HERE, '..', 'index.html')).href;
const KEY  = 'abt:save:financingvscash:v1';

const CHART_STUB = `
window.__charts = [];
class Chart {
  constructor(ctx, cfg){ this.config=cfg; this.data=(cfg&&cfg.data)||{datasets:[]};
    this.options=(cfg&&cfg.options)||{}; this.canvasId=(ctx&&ctx.id)||''; window.__charts.push(this); }
  update(){} destroy(){ const i=window.__charts.indexOf(this); if(i>=0) window.__charts.splice(i,1); } resetZoom(){}
}
Chart.register=function(){};
window.Chart=Chart;
window.Plotly={newPlot:async()=>{},react:async()=>{},relayout:async()=>{},downloadImage:async()=>{},toImage:async()=>'data:,'};`;

let pass=0, fail=0;
const check=(name,ok,detail)=>{ console.log((ok?'  PASS  ':'✗ FAIL  ')+name+(detail?'  — '+detail:'')); ok?pass++:fail++; };
const money=s=>parseFloat(String(s).replace(/[−–]/g,'-').replace(/[^0-9.\-]/g,''));
const near=(a,b,tol)=>Math.abs(a-b)<=tol;
const PPY={weekly:52,fortnightly:26,monthly:12,yearly:1};

const sc=(o={})=>Object.assign({
  name:'S', financeRate:5, downPaymentPct:0, termPeriods:60, freq:'monthly',
  feeAmt:0, feeType:'fixed', feeTreatment:'upfront', adminFee:0,
  loanType:'annuity', rateMode:'simple', ratePeriods:null,
  paymentMode:'single', paymentPeriods:null, knownPayment:0,
  ioPeriods:60, residualPct:0
}, o);

const browser = await chromium.launch({args:['--allow-file-access-from-files']});
const page = await browser.newPage();
const pageErrors=[];
page.on('pageerror', e=>{ pageErrors.push(e.message); console.log('PAGEERROR:', e.message); });
await page.addInitScript(`(()=>{const o=URL.createObjectURL.bind(URL);window.__blobs=[];URL.createObjectURL=function(b){window.__blobs.push(b);return o(b);};HTMLAnchorElement.prototype.click=function(){};})();`);
await page.route('**/*', route=>{
  const url=route.request().url();
  if(url.startsWith('file://')) return route.continue();
  if(/chart\.umd/.test(url)) return route.fulfill({contentType:'application/javascript', body:CHART_STUB});
  return route.fulfill({contentType:'application/javascript', body:'/* stub */'});
});
await page.goto(PAGE, {waitUntil:'load'});
await page.waitForTimeout(250);

async function load({fields={}, scenarios=[]}={}){
  const f=Object.assign({
    'v:currencySymbol':'$','v:purchaseCost':'50000','v:availableCash':'60000',
    'v:baseRf':'4.5','v:rateConvention':'ear','c:inflationToggle':false,
    'v:inflationRate':'3','v:chartMetric':'wealth','v:optTarget':'netBenefit'
  }, fields);
  await page.evaluate(([key,blob])=>{
    localStorage.setItem(key, JSON.stringify(blob));
    try{ localStorage.setItem=function(){}; }catch(e){}
  }, [KEY, {__fields:f, __extra:{scenarios}}]);
  await page.reload({waitUntil:'load'});
  await page.waitForTimeout(300);
  await page.evaluate(()=>document.querySelectorAll('[class*="tour-"]').forEach(n=>n.remove()));
}
const flip=on=>page.evaluate(on=>{const el=document.getElementById('inflationToggle');el.checked=on;el.dispatchEvent(new Event('change',{bubbles:true}));},on);

// Everything the board shows, as text and numbers.
async function board(){
  return await page.evaluate(async ()=>{
    const txt=id=>{const e=document.getElementById(id);return e?e.textContent.replace(/\s+/g,' ').trim():'';};
    const comp={};
    [...document.querySelectorAll('#compTableWrap table tbody tr')].forEach(tr=>{
      const c=[...tr.children].map(td=>td.textContent.trim());comp[c[0]]=c.slice(1);});
    comp.__cols=[...document.querySelectorAll('#compTableWrap table thead th')].map(t=>t.firstChild?t.firstChild.textContent.trim():'');
    const amort={},csv={};
    const tabs=[...document.querySelectorAll('#amortTabs .tab-btn')].map(b=>b.textContent.trim());
    for(let i=0;i<tabs.length;i++){
      document.querySelectorAll('#amortTabs .tab-btn')[i].click();
      const rows=[];
      document.querySelectorAll('#amortTableWrap table tbody tr').forEach(tr=>rows.push([...tr.children].map(td=>td.textContent.trim())));
      amort[tabs[i]]=rows;
      window.__blobs.length=0;document.getElementById('downloadBtn').click();
      csv[tabs[i]]=window.__blobs.length?await window.__blobs[0].text():null;
    }
    if(tabs.length)document.querySelectorAll('#amortTabs .tab-btn')[0].click();
    const chart={};
    const sel=document.getElementById('chartMetric'),was=sel.value;
    for(const m of ['wealth','netBenefit','investmentValue','loanBalance']){
      sel.value=m;sel.dispatchEvent(new Event('change',{bubbles:true}));
      const ch=window.__charts.filter(c=>c.canvasId==='chartCanvas').pop();
      chart[m]=ch?{y:ch.options.scales.y.title.text,ds:ch.data.datasets.map(d=>({label:d.label,band:!!d.isBand,pts:d.data.map(p=>[p.x,p.y])}))}:null;
    }
    sel.value=was;sel.dispatchEvent(new Event('change',{bubbles:true}));
    const k={};['kpiBest','kpiNetBenefit','kpiInterest','kpiIntSub','kpiCashWealth'].forEach(id=>k[id]=txt(id));
    return {comp,amort,csv,chart,kpi:k,verdict:txt('verdict'),stale:document.body.classList.contains('is-stale'),
      assumptions:[...document.querySelectorAll('#assumptions li')].map(li=>li.textContent.trim()),
      notes:[txt('compUnitNote'),txt('amortUnitNote')]};
  });
}
const colOf=(t,name)=>t.__cols.indexOf(name)-1;
function firstDiff(a,b,p=''){
  if(a&&typeof a==='object'){for(const k of new Set([...Object.keys(a),...Object.keys(b||{})])){const d=firstDiff(a[k],(b||{})[k],p+'.'+k);if(d)return d;}return '';}
  return a===b?'':p+': '+JSON.stringify(a)+' vs '+JSON.stringify(b);
}

// A plan with every kind of figure the switch has to re-read: a level loan
// with fees, a balloon, a loan paid weekly, a stepped repayment, a floating
// rate, and offers of different lengths.
const PLAN=[
  sc({name:'level', financeRate:7, downPaymentPct:20, termPeriods:60, feeAmt:600, adminFee:12}),
  sc({name:'balloon', loanType:'balloon', financeRate:8.4, downPaymentPct:10, residualPct:35, termPeriods:48}),
  sc({name:'weekly', freq:'weekly', financeRate:6, termPeriods:156, feeAmt:2, feeType:'pct', feeTreatment:'capitalise', adminFee:3}),
  sc({name:'steps', loanType:'knownPayment', paymentMode:'schedule', termPeriods:24, paymentPeriods:[{toPeriod:6,amount:1500},{toPeriod:24,amount:2400}]}),
  sc({name:'float', financeRate:5.8, downPaymentPct:20, termPeriods:120, rateMode:'schedule',
    ratePeriods:[{toPeriod:24,type:'fixed',rate:5.8,rateMin:5.8,rateMax:5.8},{toPeriod:120,type:'floating',rate:6.75,rateMin:5,rateMax:8.5}]}),
];
const NAMES=PLAN.map(p=>p.name);
const I=0.03;
const lvl=t=>Math.pow(1+I,t);

await load({scenarios:PLAN});
const F=await board();
await flip(true);
const T=await board();

console.log('\n════ Show in today\'s money, against an independent replay ════');
{
  const bad=[];
  for(const nm of NAMES){
    const i=colOf(F.comp,nm), j=colOf(T.comp,nm);
    const yrs=PLAN.find(p=>p.name===nm).termPeriods/PPY[PLAN.find(p=>p.name===nm).freq];
    for(const k of ['Ending Wealth','Cash Purchase at Same Horizon','Net Benefit vs Cash']){
      const want=money(F.comp[k][i])/lvl(yrs), got=money(T.comp[k][j]);
      if(!near(got,want,0.011)) bad.push(`${nm} ${k} ${got} ≠ ${want.toFixed(2)}`);
    }
    const lo=money((F.comp['Ending Wealth Range (min–max)']||[])[i]);
    for(const k of ['Loan Type','Down Payment (%)','Down Payment Amount','Financed Amount','Effective Annual Rate (EAR)','Comparison Horizon'])
      if(F.comp[k][i]!==T.comp[k][j]) bad.push(`${nm} ${k} moved`);
  }
  // The float's range row is read at the same horizon as its midpoint.
  const fi=colOf(F.comp,'float'), ti=colOf(T.comp,'float');
  const fr=F.comp['Ending Wealth Range (min–max)'][fi].split('–').map(money), tr=T.comp['Ending Wealth Range (min–max)'][ti].split('–').map(money);
  fr.forEach((v,k)=>{ if(!near(tr[k],v/lvl(10),0.011)) bad.push(`float range ${k} ${tr[k]} ≠ ${(v/lvl(10)).toFixed(2)}`); });
  check('T1 wealth, the cash at the same horizon and Net Benefit are read at each row\'s own horizon; purchase-day rows do not move',
    !bad.length, bad.slice(0,5).join(' | ') || `${NAMES.length} offers, horizons 2 to 10 years, and the floating range`);
}
{
  const bad=[]; let n=0;
  for(const nm of NAMES){
    const p=PLAN.find(x=>x.name===nm), ppy=PPY[p.freq];
    const fr=F.amort[nm].filter(r=>/^\d/.test(r[0])&&r.length>=6), tr=T.amort[nm].filter(r=>/^\d/.test(r[0])&&r.length>=6);
    if(fr.length!==tr.length){ bad.push(nm+' row count'); continue; }
    const off=fr[0].length===7?1:0; // a scheduled rate adds a column
    let sum=[0,0,0];
    fr.forEach((r,k)=>{
      const d=lvl(Number(r[0])/ppy), t=tr[k];
      for(let c=1+off;c<=5+off;c++) if(!near(money(t[c]),money(r[c])/d,0.011)){ bad.push(`${nm} #${r[0]} col ${c}`); }
      if(!near(money(t[2+off])+money(t[3+off]),money(t[4+off]),0.011)) bad.push(`${nm} #${r[0]} payment ≠ interest + principal`);
      if(!near(money(t[1+off])-money(t[3+off]),money(t[5+off]),0.011)) bad.push(`${nm} #${r[0]} end ≠ start − principal`);
      sum[0]+=money(t[2+off]);sum[1]+=money(t[3+off]);sum[2]+=money(t[4+off]);n++;
    });
    const tot=T.amort[nm].find(r=>r[0]==='Total');
    [0,1,2].forEach(c=>{ if(!near(money(tot[2+off+c]),sum[c],0.005*fr.length+0.01)) bad.push(`${nm} Total col ${c} does not foot`); });
  }
  check('T2 every schedule row is its future row over (1+i)^(k/ppy), still balances, and the Total row foots',
    !bad.length, bad.slice(0,5).join(' | ') || `${n} rows across ${NAMES.length} schedules`);
}
{
  // The totals are replayed from the FUTURE schedule, deflated row by row.
  const bad=[];
  for(const nm of NAMES){
    const p=PLAN.find(x=>x.name===nm), ppy=PPY[p.freq];
    const fr=F.amort[nm].filter(r=>/^\d/.test(r[0])&&r.length>=6);
    const off=fr[0].length===7?1:0;
    let int=0,pay=0,adm=0;
    fr.forEach(r=>{const d=lvl(Number(r[0])/ppy);int+=money(r[2+off])/d;pay+=money(r[4+off])/d;adm+=(p.adminFee||0)/d;});
    const i=colOf(F.comp,nm), j=colOf(T.comp,nm);
    const fee=money(F.comp['Total Fees Paid'][i])-money(F.comp['Total Admin Fees'][i]);
    const down=money(F.comp['Down Payment Amount'][i]);
    const cashFee=p.feeTreatment==='upfront'?fee:0;
    const want={'Total Interest Paid':int,'Total Admin Fees':adm,'Total Fees Paid':fee+adm,'Total Financing Cost':int+fee+adm,'Total Out-of-Pocket':down+cashFee+pay+adm};
    // Display rounding: each printed cell is to the cent, so the replay from
    // printed rows carries half a cent a row.
    const tol=0.006*fr.length+0.02;
    for(const [k,v] of Object.entries(want)) if(!near(money(T.comp[k][j]),v,tol)) bad.push(`${nm} ${k} ${T.comp[k][j]} ≠ ${v.toFixed(2)}`);
  }
  check('T3 every total is the sum of its parts each deflated to its own date: interest, admin, fees, cost, out-of-pocket',
    !bad.length, bad.slice(0,5).join(' | ') || 'five totals × '+NAMES.length+' offers replayed from the future schedule');
}
{
  const bad=[]; let pts=0;
  for(const m of Object.keys(F.chart)){
    const f=F.chart[m], t=T.chart[m];
    if(!/today’s money|today's money/.test(t.y)) bad.push(m+' axis does not name today\'s money: '+t.y);
    if(!/future’s money|future's money/.test(f.y)) bad.push(m+' axis does not name future\'s money: '+f.y);
    // Weekly is the finest period on show, so the axis is in weeks.
    f.ds.forEach((d,k)=>d.pts.forEach(([x,y],q)=>{const ty=t.ds[k].pts[q][1];pts++;
      if(!near(ty,y/lvl(x/52),Math.max(1e-6,Math.abs(y)*1e-9))) bad.push(`${m} ${d.label} @${x}`);}));
  }
  // Each chart ends on its row in the table: an offer's wealth line at its own
  // horizon is its Ending Wealth.
  for(const nm of NAMES){
    const p=PLAN.find(x=>x.name===nm), x=p.termPeriods/PPY[p.freq]*52;
    const ds=T.chart.wealth.ds.find(d=>d.label===nm&&!d.band), pt=ds.pts.find(q=>Math.abs(q[0]-x)<1e-6);
    if(!pt||!near(pt[1],money(T.comp['Ending Wealth'][colOf(T.comp,nm)]),0.011)) bad.push(nm+' wealth line does not end on Ending Wealth');
  }
  check('T4 every point of all four chart metrics is its future point over (1+i)^t, and ends on its own table row',
    !bad.length, bad.slice(0,5).join(' | ') || pts+' points');
}
{
  const bad=[];
  const nbs=NAMES.map(nm=>[nm,money(T.comp['Net Benefit vs Cash'][colOf(T.comp,nm)])]);
  const top=nbs.reduce((a,b)=>b[1]>a[1]?b:a);
  const best=T.kpi.kpiBest;
  if(top[1]>0.005){
    if(best!==top[0]) bad.push(`Best tile ${best}, highest Net Benefit on show ${top[0]}`);
    if(!near(money(T.kpi.kpiNetBenefit),top[1],Math.max(1,Math.abs(top[1])*0.01))) bad.push('Net Benefit tile '+T.kpi.kpiNetBenefit+' vs '+top[1]);
  }
  // The Cash Purchase column runs to the longest horizon, ten years.
  const fCash=money(F.comp['Ending Wealth'][0]);
  const tCash=money(T.comp['Ending Wealth'][0]);
  if(!near(tCash,fCash/lvl(10),0.011)) bad.push('cash column '+tCash+' vs '+(fCash/lvl(10)).toFixed(2));
  if(!/today’s money/.test(T.verdict)) bad.push('verdict does not say today\'s money');
  if(/today’s money/.test(F.verdict)) bad.push('future verdict mentions today\'s money');
  if(T.stale) bad.push('the switch sent the board out of date');
  check('T5 the tiles and the verdict read the same figures, the Best tile is the top row on show, and the board stays fresh',
    !bad.length, bad.join(' | ') || `Best ${best}, cash column at 10 yr, verdict names the money`);
}
{
  await flip(false);
  const back=await board();
  const same=JSON.stringify(back)===JSON.stringify(F);
  await load({fields:{'v:inflationRate':'0'}, scenarios:PLAN});
  const f0=await board(); await flip(true); const t0=await board();
  const strip=b=>{const c=JSON.parse(JSON.stringify(b));for(const m of Object.values(c.chart))delete m.y;delete c.verdict;delete c.assumptions;delete c.notes;return JSON.stringify(c);};
  check('T6 switching back restores the board to the cent, and with prices held still the two moneys are one page',
    same && strip(f0)===strip(t0), (same?'':'switching back changed the board; ')+(strip(f0)===strip(t0)?'':'0% inflation still moved a figure: '+firstDiff(JSON.parse(strip(f0)),JSON.parse(strip(t0)))));
}
{
  await load({fields:{'c:inflationToggle':true}, scenarios:PLAN.slice(0,1)});
  const on1=await page.evaluate(()=>document.getElementById('inflationToggle').checked);
  await flip(false);
  await page.waitForTimeout(600); // the cache saves on a short debounce
  const blob=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'{}'),KEY);
  check('T7 a plan saved with the switch on opens on it, and the switch is saved with the plan',
    on1 && blob.__fields && blob.__fields['c:inflationToggle']===false, `opened ${on1?'on':'off'}; saved ${JSON.stringify(blob.__fields&&blob.__fields['c:inflationToggle'])}`);
}
{
  // Sweep the finance rate through 7%, the rate on the form, in today's money.
  const s=sc({name:'x', loanType:'annuity', financeRate:7, downPaymentPct:20, termPeriods:60, feeAmt:500, adminFee:5});
  await load({fields:{'v:availableCash':'90000'}, scenarios:[s]});
  await flip(true);
  const t=await board();
  const live={netBenefit:money(t.comp['Net Benefit vs Cash'][0+colOf(t.comp,'x')]),endWealth:money(t.comp['Ending Wealth'][colOf(t.comp,'x')]),
    totalInterest:money(t.comp['Total Interest Paid'][colOf(t.comp,'x')]),totalFinanceCost:money(t.comp['Total Financing Cost'][colOf(t.comp,'x')])};
  await page.evaluate(()=>{document.querySelector('.ctrl-tab[data-tab="scenarios"]').click();document.querySelector('.opt-btn[data-opt="financeRate"]').click();});
  await page.waitForTimeout(150);
  await page.evaluate(()=>{
    const set=(id,v)=>{const el=document.getElementById(id);el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));};
    set('optStart','1'); set('optEnd','13'); set('optSteps','25');
    document.getElementById('optDoneBtn').click(); document.getElementById('simBtn').click();
  });
  await page.waitForTimeout(700);
  const bad=[];
  const at=async obj=>page.evaluate(async obj=>{
    const el=document.getElementById('optMetric');el.value=obj;el.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(r=>setTimeout(r,80));
    const ch=window.__charts.filter(c=>c.canvasId==='chartCanvas').pop();
    const p=ch&&ch.data.datasets[0].data.find(d=>d&&Math.abs(d.x-7)<1e-9);
    return {y:p?p.y:null,axis:ch?ch.options.scales.y.title.text:''};
  },obj);
  for(const obj of Object.keys(live)){
    const g=await at(obj);
    if(g.y==null||!near(g.y,live[obj],Math.max(0.05,Math.abs(live[obj])*1e-6))) bad.push(`${obj}: sweep ${g.y} vs table ${live[obj]}`);
    if(!/today’s money|today's money/.test(g.axis)) bad.push(obj+' axis: '+g.axis);
  }
  const offered=()=>page.evaluate(()=>{const o=document.querySelector('#optMetric option[value="inflAdjNetBenefit"]');return !o.hidden&&!o.disabled;});
  const inToday=await offered();
  await flip(false);
  const inFuture=await offered();
  const realObj=await at('inflAdjNetBenefit');
  if(inToday) bad.push('Net Benefit in today\'s money offered while the board already reads it');
  if(!inFuture) bad.push('Net Benefit in today\'s money not offered in future\'s money');
  if(!near(realObj.y,live.netBenefit,Math.max(0.05,Math.abs(live.netBenefit)*1e-6))) bad.push(`today objective ${realObj.y} vs ${live.netBenefit}`);
  await page.evaluate(()=>document.getElementById('optCancelBtn').click());
  check('T8 a sweep passes through today\'s table on four objectives; the separate today objective shows only in future\'s money',
    !bad.length, bad.join(' | ') || Object.entries(live).map(([k,v])=>k+'='+v.toFixed(2)).join(', '));
}
{
  const bad=[];
  for(const nm of NAMES){
    const lines=(T.csv[nm]||'').trim().split('\n').slice(1);
    const rows=T.amort[nm];
    if(lines.length-1!==rows.length) { bad.push(nm+' row count'); continue; }
    rows.forEach((r,k)=>{const cells=lines[k+1].split('","').map(c=>c.replace(/^"|"$/g,''));
      if(cells.join('|')!==r.join('|').replace(/[–−]/g,'-').replace(/[ \t]*[‒—―][ \t]*/g,' ')) bad.push(nm+' line '+k);});
  }
  check('T9 the CSV is the schedule on screen, in the money on screen', !bad.length, bad.slice(0,4).join(' | ') || NAMES.length+' schedules');
}
{
  await load({fields:{'v:purchaseCost':'50000','v:inflationRate':'3'}, scenarios:[sc({name:'n',termPeriods:120})]});
  const note=await page.evaluate(()=>document.getElementById('inflationNote').textContent);
  const want=50000*Math.pow(1.03,10);
  check('T10 the note under Inflation names what the price costs at the horizon',
    note.includes('$50,000')&&note.includes('$'+Math.round(want).toLocaleString('en-US')), note);
}
{
  const ok=T.assumptions.some(t=>/today's money, with prices rising 3%/.test(t)) && F.assumptions.some(t=>/future's money/.test(t)&&/3%/.test(t));
  check('T11 What this assumes names the money on show and the rate', ok, T.assumptions.find(t=>/money/.test(t)));
}

check('no page errors', pageErrors.length===0, pageErrors.slice(0,2).join(' | '));
await browser.close();
console.log(`\nfinancingvscash today's money audit: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
