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
  constructor(ctx, cfg){ this.config=cfg; this.data=(cfg&&cfg.data)||{datasets:[]}; this.options=(cfg&&cfg.options)||{};
    // Which canvas a chart was built on, because the page now draws the
    // sensitivity sweep alongside the main chart and "the last one made" no
    // longer picks out the one a check means.
    this.canvasId=(ctx&&ctx.id)||''; window.__charts.push(this); }
  update(){} destroy(){ const i=window.__charts.indexOf(this); if(i>=0) window.__charts.splice(i,1); } resetZoom(){}
}
Chart.register=function(){};
window.Chart=Chart;
window.Plotly={newPlot:async()=>{},react:async()=>{},relayout:async()=>{},downloadImage:async()=>{},toImage:async()=>'data:,'};`;

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
    const ch=window.__charts.filter(c=>c.canvasId==='chartCanvas').pop();
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


/* ══ Loan types ══════════════════════════════════════════════════════════════
   Every check below compares the page against maths re-derived HERE, from the
   engine notes in script.js, never by calling into the page's own functions. */

const perRate=(annualPct,ppy)=>Math.pow(1+annualPct/100,1/ppy)-1;
const pmtOf=(P,r,n)=>r===0?P/n:P*(r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1);
// Independent IRR: bisection on the discounted stream, which is deliberately a
// DIFFERENT formulation from the page's forward-balance recursion.
function irrOf(principal,payments){
  const npv=r=>payments.reduce((s,p,i)=>s+p/Math.pow(1+r,i+1),0)-principal;
  let lo=-0.5,hi=1;
  for(let i=0;i<300;i++){const m=(lo+hi)/2;if(npv(m)>0)lo=m;else hi=m;}
  return(lo+hi)/2;
}
const effAnnual=(r,ppy)=>(Math.pow(1+r,ppy)-1)*100;

const setBase=o=>page.evaluate(o=>{
  const fire=(el,e)=>e.forEach(t=>el.dispatchEvent(new Event(t,{bubbles:true})));
  const put=(id,v)=>{const el=document.getElementById(id);el.value=String(v);fire(el,['input','change']);};
  if(o.price!==undefined)put('purchaseCost',o.price);
  if(o.cash!==undefined)put('availableCash',o.cash);
  if(o.rf!==undefined)put('baseRf',o.rf);
  if(o.conv!==undefined){const el=document.getElementById('rateConvention');el.value=o.conv;fire(el,['change']);}
},o);

// Collapse to a single scenario and configure it. Frequency, term and rate are
// set BEFORE the loan type so the type's own seeding sees the right term.
const setOneScenario=o=>page.evaluate(o=>{
  const fire=(el,e)=>e.forEach(t=>el.dispatchEvent(new Event(t,{bubbles:true})));
  let guard=0;
  while(document.querySelectorAll('.scenario-card').length>1&&guard++<50)
    document.querySelectorAll('.scenario-card .sc-btn[data-action="del"]')[1].click();
  document.querySelectorAll('.scenario-card .sc-btn[data-action="edit"]')[0].click();
  document.querySelector('#scRateModeGroup .seg-btn[data-val="simple"]').click();
  document.querySelector('#scPaymentModeGroup .seg-btn[data-val="single"]').click();
  const set=(id,v,evts)=>{const el=document.getElementById(id);el.value=String(v);fire(el,evts||['input','change']);};
  document.getElementById('scName').value=o.name||'S';
  if(o.freq)set('scFreq',o.freq,['change']);
  set('scTerm',o.term);
  set('scRate',o.rate===undefined?5:o.rate);
  set('scDownPct',o.downPct||0);
  set('scFeeType',o.feeType||'fixed',['change']);
  set('scFeeAmt',o.fee||0);
  set('scFeeTreatment',o.feeTreatment||'upfront',['change']);
  set('scAdminFee',o.adminFee||0);
  set('scLoanType',o.loanType||'annuity',['change']);
  if(o.ioPeriods!==undefined)set('scIoPeriods',o.ioPeriods);
  if(o.residualPct!==undefined)set('scResidualPct',o.residualPct);
  if(o.payment!==undefined)set('scKnownPayment',o.payment);
},o);

const saveScenario=()=>page.evaluate(()=>document.getElementById('saveScenarioBtn').click());

// Drive the rate or repayment schedule rows the way a reader would.
const setSchedule=(kind,rows)=>page.evaluate(([kind,rows])=>{
  const fire=(el,e)=>e.forEach(t=>el.dispatchEvent(new Event(t,{bubbles:true})));
  const grp=kind==='rate'?'scRateModeGroup':'scPaymentModeGroup';
  document.querySelector('#'+grp+' .seg-btn[data-val="schedule"]').click();
  const wrapId=kind==='rate'?'scRatePeriodRows':'scPaymentPeriodRows';
  const addId=kind==='rate'?'addRatePeriodBtn':'addPaymentPeriodBtn';
  let guard=0;
  while(document.querySelectorAll('#'+wrapId+' .sched-row').length>rows.length&&guard++<40){
    const d=document.querySelector('#'+wrapId+' .sched-row .sp-delete:not([disabled])');
    if(!d)break;d.click();
  }
  while(document.querySelectorAll('#'+wrapId+' .sched-row').length<rows.length&&guard++<40)
    document.getElementById(addId).click();
  [...document.querySelectorAll('#'+wrapId+' .sched-row')].forEach((row,i)=>{
    const r=rows[i];
    if(kind==='rate'){
      const ty=row.querySelector('.sp-type');ty.value=r.type;fire(ty,['change']);
      const f=ty.value==='floating';
      row.querySelector('.sp-fixed-wrap').style.display=f?'none':'';
      row.querySelector('.sp-float-wrap').style.display=f?'':'none';
    }
    const to=row.querySelector('.sp-to');
    if(to&&r.to!==undefined){to.value=r.to;fire(to,['input','change']);}
    if(kind==='rate'){
      if(r.type==='fixed'){const e=row.querySelector('.sp-rate');e.value=r.rate;fire(e,['input','change']);}
      else{const a=row.querySelector('.sp-min'),b=row.querySelector('.sp-max');
           a.value=r.min;fire(a,['input','change']);b.value=r.max;fire(b,['input','change']);}
    } else {const e=row.querySelector('.sp-amt');e.value=String(r.amount);fire(e,['input','change']);}
  });
},[kind,rows]);

// Numeric amortization rows only: the Total line and the fee footnotes are not
// periods and must not be read as if they were.
const amortRows=()=>page.evaluate(()=>{
  const t=document.querySelector('#amortTableWrap table');
  if(!t)return null;
  const head=[...t.querySelectorAll('thead th')].map(x=>x.textContent.trim());
  const rows=[...t.querySelectorAll('tbody tr')]
    .map(tr=>[...tr.children].map(td=>td.textContent.trim()))
    .filter(c=>c.length===head.length&&/^[\d,]+$/.test(c[0]));
  return{head,rows};
});
const cell=(t,label,col=1)=>t[label]?money(t[label][col]):NaN;

const PRICE=50000,CASH=80000,RF=4.5,PPY=12,N=60;

// ── F5: flat rate charges interest on the ORIGINAL principal, for ever ──
{
  await setBase({price:PRICE,cash:CASH,rf:RF,conv:'ear'});
  await setOneScenario({name:'Flat',loanType:'flat',freq:'monthly',term:N,rate:5});
  await saveScenario();await page.waitForTimeout(200);
  const r=perRate(5,PPY);
  const refInt=PRICE*r*N, refPmt=PRICE/N+PRICE*r;
  const t=await compTable();
  const gotInt=cell(t,'Total Interest Paid'), gotPmt=cell(t,'Periodic Payment');
  check('F5 flat rate: total interest is P0 x r x n and the instalment is P0/n + P0 x r',
    Math.abs(gotInt-refInt)<0.02&&Math.abs(gotPmt-refPmt)<0.02,
    `app ${gotInt.toFixed(2)} int / ${gotPmt.toFixed(2)} pmt vs replay ${refInt.toFixed(2)} / ${refPmt.toFixed(2)}`);

  // ── F6: and its effective rate is far above the headline ──
  const refEff=effAnnual(irrOf(PRICE,new Array(N).fill(refPmt)),PPY);
  const gotEff=cell(t,'Effective Rate (APR)');
  check('F6 flat rate: the effective APR matches an independent IRR and far exceeds the quoted 5%',
    Math.abs(gotEff-refEff)<0.02&&gotEff>8,
    `app ${gotEff.toFixed(2)}% vs replay ${refEff.toFixed(2)}% (quoted 5.00%)`);
}

// ── F7: a known repayment solves back to the rate it was generated from ──
{
  const r=perRate(7,PPY);
  const pmt=Math.round(pmtOf(PRICE,r,N)*100)/100;
  await setOneScenario({name:'Known',loanType:'knownPayment',freq:'monthly',term:N,rate:5,payment:pmt});
  await saveScenario();await page.waitForTimeout(200);
  const got=cell(await compTable(),'Effective Rate (APR)');
  check('F7 known repayment: the solved rate returns the 7% the instalment was built from',
    Math.abs(got-7)<0.02,`app ${got.toFixed(4)}% vs 7.0000% (instalment ${pmt})`);
}

// ── F8: a STEPPED repayment plan, solved and reproduced period by period ──
{
  await setOneScenario({name:'Stepped',loanType:'knownPayment',freq:'monthly',term:N,rate:5});
  await setSchedule('payment',[{to:2,amount:100},{to:6,amount:200},{amount:1100}]);
  await saveScenario();await page.waitForTimeout(250);
  const a=await amortRows();
  const pi=a.head.indexOf('Payment'), ei=a.head.indexOf('End Balance');
  const pay=k=>money(a.rows[k-1][pi]);
  const steps=pay(1)===100&&pay(2)===100&&pay(3)===200&&pay(6)===200&&pay(7)===1100&&pay(N-1)===1100;
  const closes=Math.abs(money(a.rows[N-1][ei]))<0.01;
  check('F8 stepped repayment: the entered steps land in the entered periods and the balance closes at zero',
    steps&&closes&&a.rows.length===N,
    `periods 1,2,3,6,7,59 paid ${[1,2,3,6,7,59].map(pay).join('/')}, final end balance ${a.rows[N-1][ei]}`);

  // The rate the page solved must reproduce that exact stream independently.
  const stream=[];for(let i=1;i<=N;i++)stream.push(i<=2?100:i<=6?200:1100);
  stream[N-1]=money(a.rows[N-1][pi]); // the last period settles the remainder
  const refEff=effAnnual(irrOf(PRICE,stream),PPY);
  const gotEff=cell(await compTable(),'Effective Rate (APR)');
  check('F8b stepped repayment: the solved APR matches an independent IRR of the same stream',
    Math.abs(gotEff-refEff)<0.02,`app ${gotEff.toFixed(3)}% vs replay ${refEff.toFixed(3)}%`);
}

// ── F9: interest-only pays interest alone, then the whole principal ──
{
  await setOneScenario({name:'IO',loanType:'interestOnly',freq:'monthly',term:N,rate:6,ioPeriods:N});
  await saveScenario();await page.waitForTimeout(200);
  const a=await amortRows();
  const pi=a.head.indexOf('Payment'),ei=a.head.indexOf('End Balance');
  const r=perRate(6,PPY),refIo=PRICE*r;
  const levelOk=[1,2,30,N-1].every(k=>Math.abs(money(a.rows[k-1][pi])-refIo)<0.02);
  const flatOk=[1,2,30,N-1].every(k=>Math.abs(money(a.rows[k-1][ei])-PRICE)<0.02);
  const finalOk=Math.abs(money(a.rows[N-1][pi])-(refIo+PRICE))<0.02;
  check('F9 interest-only: every instalment is balance x r, the balance never falls, and the last payment repays it all',
    levelOk&&flatOk&&finalOk,
    `instalment ${a.rows[0][pi]} vs ${refIo.toFixed(2)}, balance at period 30 ${a.rows[29][ei]}, final payment ${a.rows[N-1][pi]}`);
}

// ── F10: a balloon is a level annuity plus a residual at the end ──
{
  const RES=30;
  await setOneScenario({name:'Balloon',loanType:'balloon',freq:'monthly',term:N,rate:6,residualPct:RES});
  await saveScenario();await page.waitForTimeout(200);
  const r=perRate(6,PPY),R=PRICE*RES/100;
  const refPmt=pmtOf(PRICE-R/Math.pow(1+r,N),r,N);
  const t=await compTable();
  const gotPmt=cell(t,'Periodic Payment'),gotFinal=cell(t,'Final Payment'),gotRes=cell(t,'Residual / Balloon');
  check('F10 balloon: the instalment matches an independent residual annuity and the final payment adds the residual',
    Math.abs(gotPmt-refPmt)<0.02&&Math.abs(gotRes-R)<0.02&&Math.abs((gotFinal-gotPmt)-R)<0.05,
    `pmt ${gotPmt.toFixed(2)} vs ${refPmt.toFixed(2)}; final ${gotFinal.toFixed(2)} - pmt = ${(gotFinal-gotPmt).toFixed(2)} vs residual ${R.toFixed(2)}`);
}

// ── F11: a floating period draws a band, and the band brackets the midpoint ──
{
  await setOneScenario({name:'Variable',loanType:'annuity',freq:'monthly',term:N,rate:6});
  await setSchedule('rate',[{type:'floating',min:4,max:8}]);
  await saveScenario();await page.waitForTimeout(300);
  const bands=await page.evaluate(()=>{
    const ch=window.__charts.filter(c=>c.canvasId==='chartCanvas').pop();
    const b=ch.data.datasets.filter(d=>d.isBand);
    return{n:b.length,filtered:typeof ch.options.plugins.tooltip.filter==='function',
      fill:b.length?b[1].fill:null,
      lastHi:b.length?b[0].data[b[0].data.length-1].y:null,
      lastLo:b.length?b[1].data[b[1].data.length-1].y:null};
  });
  const t=await compTable();
  const mid=cell(t,'Ending Wealth');
  const rng=(t['Ending Wealth Range (min–max)']||[])[1]||'';
  const nums=rng.replace(/[−–]/g,m=>m==='−'?'-':'|').split('|').map(x=>parseFloat(String(x).replace(/[^0-9.\-]/g,'')));
  const lo=Math.min(...nums),hi=Math.max(...nums);
  check('F11 floating rate: two band datasets are drawn, excluded from the hover card, and bracket the midpoint',
    bands.n===2&&bands.filtered&&bands.fill==='-1'&&isFinite(mid)&&lo<mid+0.01&&mid<hi+0.01,
    `${bands.n} band datasets (fill ${bands.fill}, tooltip filter ${bands.filtered}); range ${lo.toFixed(0)} to ${hi.toFixed(0)} around midpoint ${mid.toFixed(0)}`);
}

// ── F12: fixed THEN floating. The band must be shut while the rate is fixed ──
{
  await setOneScenario({name:'Mixed',loanType:'annuity',freq:'monthly',term:N,rate:6});
  await setSchedule('rate',[{to:24,type:'fixed',rate:6},{type:'floating',min:4,max:9}]);
  await saveScenario();await page.waitForTimeout(300);
  const w=await page.evaluate(()=>{
    const ch=window.__charts.filter(c=>c.canvasId==='chartCanvas').pop();
    const b=ch.data.datasets.filter(d=>d.isBand);
    if(b.length!==2)return null;
    const width=x=>{const i=b[0].data.findIndex(p=>Math.abs(p.x-x)<0.05);
      return i<0?null:Math.abs(b[0].data[i].y-b[1].data[i].y);};
    return{atYear1:width(1),atYear2:width(2),atYear4:width(4),atEnd:Math.abs(b[0].data[b[0].data.length-1].y-b[1].data[b[1].data.length-1].y)};
  });
  check('F12 fixed then floating: the band is shut across the fixed years and opens after the switch',
    !!w&&w.atYear1<0.5&&w.atYear2<0.5&&w.atYear4>1&&w.atEnd>w.atYear4,
    w?`band width: yr1 ${w.atYear1.toFixed(2)}, yr2 ${w.atYear2.toFixed(2)}, yr4 ${w.atYear4.toFixed(0)}, end ${w.atEnd.toFixed(0)}`:'band datasets missing');
}

// ── F19: the read-out under the chart is filled, and carries the range ──
{
  const out=await page.evaluate(()=>{
    const ch=window.__charts.filter(c=>c.canvasId==='chartCanvas').pop();
    if(typeof ch.options.onHover!=='function')return{err:'no onHover handler'};
    const i=Math.floor(ch.data.datasets[0].data.length*0.8);
    ch.options.onHover({},[{index:i,datasetIndex:0}],ch);
    return{txt:document.getElementById('hoverBox').textContent};
  });
  check('F19 the hover read-out names the period, every series once, and the band as a range',
    !out.err&&/^Year /.test(out.txt)&&/Mixed: /.test(out.txt)&&/\(.+ – .+\)/.test(out.txt)&&!/\(band\)/.test(out.txt),
    out.err||`"${out.txt.slice(0,130)}"`);
}

// ── F14: the nominal convention divides, it does not compound ──
{
  await setBase({conv:'nominal'});
  await setOneScenario({name:'Nominal',loanType:'annuity',freq:'monthly',term:12,rate:12});
  await saveScenario();await page.waitForTimeout(200);
  const a=await amortRows();
  const ii=a.head.indexOf('Interest');
  const gotFirst=money(a.rows[0][ii]);
  await setBase({conv:'ear'});await page.waitForTimeout(200);
  const a2=await amortRows();
  const gotEar=money(a2.rows[0][a2.head.indexOf('Interest')]);
  check('F14 rate convention: nominal 12% charges exactly 1.000% a period, effective charges 0.949%',
    Math.abs(gotFirst-PRICE*0.01)<0.02&&Math.abs(gotEar-PRICE*perRate(12,PPY))<0.02,
    `nominal first interest ${gotFirst.toFixed(2)} vs ${(PRICE*0.01).toFixed(2)}; effective ${gotEar.toFixed(2)} vs ${(PRICE*perRate(12,PPY)).toFixed(2)}`);
}

// ── F15: a bullet loan has no instalments and one grown lump at maturity ──
{
  await setOneScenario({name:'Bullet',loanType:'bullet',freq:'monthly',term:12,rate:10});
  await saveScenario();await page.waitForTimeout(200);
  const a=await amortRows();
  const pi=a.head.indexOf('Payment'),ei=a.head.indexOf('End Balance');
  const r=perRate(10,PPY),refLump=PRICE*Math.pow(1+r,12);
  const quiet=a.rows.slice(0,11).every(c=>money(c[pi])===0);
  const grows=money(a.rows[5][ei])>PRICE;
  check('F15 bullet: no instalments, the debt compounds, and one payment of P(1+r)^n settles it',
    a&&a.rows.length===12&&quiet&&grows&&Math.abs(money(a.rows[11][pi])-refLump)<0.05,
    `11 quiet periods=${quiet}, balance at period 6 ${a.rows[5][ei]}, final payment ${a.rows[11][pi]} vs replay ${refLump.toFixed(2)}`);
}

// ── F16: a deferred start pushes the balance ABOVE the original principal ──
{
  await setOneScenario({name:'Deferred',loanType:'deferred',freq:'monthly',term:N,rate:9,ioPeriods:6});
  await saveScenario();await page.waitForTimeout(200);
  const a=await amortRows();
  const pi=a.head.indexOf('Payment'),ei=a.head.indexOf('End Balance');
  const r=perRate(9,PPY),refAfterHoliday=PRICE*Math.pow(1+r,6);
  const holidayQuiet=a.rows.slice(0,6).every(c=>money(c[pi])===0);
  const grown=money(a.rows[5][ei]);
  const resumes=money(a.rows[6][pi])>0;
  check('F16 deferred start: nothing is paid during the holiday, the debt grows past the original principal, then instalments resume',
    holidayQuiet&&resumes&&grown>PRICE&&Math.abs(grown-refAfterHoliday)<0.05,
    `balance after the 6-period holiday ${grown.toFixed(2)} vs replay ${refAfterHoliday.toFixed(2)} (borrowed ${PRICE}); first instalment ${a.rows[6][pi]}`);
}

// ── F17: the fee is counted once, whichever way it is settled ──
{
  const read=async()=>{const t=await compTable();
    return{oop:cell(t,'Total Out-of-Pocket'),fin:cell(t,'Financed Amount'),ew:cell(t,'Ending Wealth')};};
  await setOneScenario({name:'FeeA',loanType:'annuity',freq:'monthly',term:N,rate:6,fee:0,feeTreatment:'upfront'});
  await saveScenario();await page.waitForTimeout(200);
  const zeroUp=await read();
  await setOneScenario({name:'FeeB',loanType:'annuity',freq:'monthly',term:N,rate:6,fee:0,feeTreatment:'capitalise'});
  await saveScenario();await page.waitForTimeout(200);
  const zeroCap=await read();
  await setOneScenario({name:'FeeC',loanType:'annuity',freq:'monthly',term:N,rate:6,fee:0,feeTreatment:'discount'});
  await saveScenario();await page.waitForTimeout(200);
  const zeroDis=await read();
  check('F17 fee treatment: with no fee all three treatments are identical',
    Math.abs(zeroUp.ew-zeroCap.ew)<0.02&&Math.abs(zeroUp.ew-zeroDis.ew)<0.02,
    `ending wealth ${zeroUp.ew.toFixed(2)} / ${zeroCap.ew.toFixed(2)} / ${zeroDis.ew.toFixed(2)}`);

  const FEE=1000,r=perRate(6,PPY);
  await setOneScenario({name:'FeeUp',loanType:'annuity',freq:'monthly',term:N,rate:6,fee:FEE,feeTreatment:'upfront'});
  await saveScenario();await page.waitForTimeout(200);
  const up=await read();
  await setOneScenario({name:'FeeCap',loanType:'annuity',freq:'monthly',term:N,rate:6,fee:FEE,feeTreatment:'capitalise'});
  await saveScenario();await page.waitForTimeout(200);
  const cap=await read();
  // Paid upfront the fee is spent once and never borrowed; capitalised it is
  // borrowed, so out-of-pocket rises by exactly the interest the fee attracts.
  const refUpOOP=FEE+pmtOf(PRICE,r,N)*N;
  const refCapOOP=pmtOf(PRICE+FEE,r,N)*N;
  check('F17b fee treatment: an upfront fee is never borrowed and a capitalised fee is never counted twice',
    Math.abs(up.fin-PRICE)<1&&Math.abs(cap.fin-(PRICE+FEE))<1&&
    Math.abs(up.oop-refUpOOP)<0.05&&Math.abs(cap.oop-refCapOOP)<0.05,
    `financed ${up.fin.toFixed(2)}/${cap.fin.toFixed(2)}; out-of-pocket ${up.oop.toFixed(2)} vs ${refUpOOP.toFixed(2)} and ${cap.oop.toFixed(2)} vs ${refCapOOP.toFixed(2)}`);

  // A percentage fee deducted from the advance has to be grossed up, or the
  // net proceeds would not cover the price.
  await setOneScenario({name:'FeeDis',loanType:'annuity',freq:'monthly',term:N,rate:6,fee:10,feeType:'pct',feeTreatment:'discount'});
  await saveScenario();await page.waitForTimeout(200);
  const dis=await read();
  check('F17c discounted note: the advance is grossed up so the net proceeds still meet the price',
    Math.abs(dis.fin-PRICE/0.9)<1,
    `financed ${dis.fin.toFixed(2)} vs ${(PRICE/0.9).toFixed(2)} (net advance ${(dis.fin*0.9).toFixed(2)} vs price ${PRICE})`);
}

// ── F18: an unsolvable repayment plan must be explained as what it is ──
{
  await setOneScenario({name:'Hopeless',loanType:'knownPayment',freq:'monthly',term:N,rate:5,payment:0});
  await saveScenario();await page.waitForTimeout(250);
  const w=await page.evaluate(()=>({disp:getComputedStyle(document.getElementById('warnBanner')).display,
    txt:document.getElementById('warnBanner').textContent}));
  check('F18 an unsolvable repayment plan is explained as one, not blamed on the down payment',
    w.disp!=='none'&&/no interest rate/i.test(w.txt)&&!/down payment/i.test(w.txt),
    `banner display=${w.disp}, text "${w.txt.trim().slice(0,110)}"`);
}

// ── F13: a scenario saved before loan types existed must still load ──
{
  await page.addInitScript(()=>{
    try{localStorage.setItem('abt:save:financingvscash:v1',JSON.stringify({
      __fields:{'v:purchaseCost':'50,000','v:availableCash':'80,000','v:baseRf':'4.5'},
      __extra:{scenarios:[{name:'Legacy',financeRate:5,downPaymentPct:0,termPeriods:60,freq:'monthly',feeAmt:0,feeType:'fixed',adminFee:0}]}
    }));}catch(e){}
  });
  await page.reload({waitUntil:'load'});
  await page.waitForTimeout(400);
  const t=await compTable();
  const legacy=t.__cols.includes('Legacy');
  const type=(t['Loan Type']||[])[1]||'';
  const ref=replay({price:50000,cash:80000,rf:4.5,rate:5,n:60,ppy:12});
  const ew=cell(t,'Ending Wealth');
  check('F13 backwards compatibility: a scenario saved before loan types existed loads as a plain amortizing loan',
    legacy&&/Amortizing/.test(type)&&Math.abs(ew-ref.endWealth)<1,
    `column present=${legacy}, loan type "${type}", ending wealth ${ew.toFixed(2)} vs replay ${ref.endWealth.toFixed(2)}`);
  await page.evaluate(()=>localStorage.clear());
}

await browser.close();
console.log(`\nfinancingvscash audit: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
