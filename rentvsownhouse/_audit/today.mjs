// Rent vs Own — Show in today's money.
//
// The switch beside the results re-reads the page at today's prices with the
// General inflation rate on the Assumptions tab; the plan underneath must not
// move. Every check reads the page twice, the switch off (future's money, the
// engine's own figures) and on, and holds the second to a replay of the first:
//
//   a balance, or a year's flow, in year y     x / (1 + g)^y
//   a running total (accumulated cost)         the sum of its own years, each
//                                              deflated, never the total once
//   year 0, a rate                             unchanged
//
// D1  the switch opens on for a new reader, a plan saved before it existed
//     opens off (its figures mean what they meant), a plan saved with it keeps
//     it, and a Quick Start puts it back on
// D2  every cell of the Own, Rent and Rent-Then-Buy cashflow tables (their CSV,
//     to the dollar) is its future cell re-read that way, and every row still
//     reconciles across
// D3  every point of the three charts, bands included, is its future point
//     re-read the same way
// D4  the cards and tiles read the same figures: equity difference, breakeven
//     (which cannot move), the budget range, the final-year tiles, the yearly
//     rent, the repayment range over every year and rate path, the
//     Rent-Then-Buy price at purchase
// D5  the verdict, the chart's axis and note, the table note, the CSV and What
//     this assumes name the money on show; the note under General inflation
//     names the home's price at the horizon
// D6  with prices held still the two moneys are one page, and switching back
//     restores the page exactly
// D7  the Indonesian page reads the same figures
//
// Run: node today.mjs
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = pathToFileURL(join(HERE, '..', 'index.html')).href;
const PAGE_ID = pathToFileURL(join(HERE, '..', 'id', 'index.html')).href;
const KEY = 'abt:save:rentvsownhouse:v1';

const CHART_STUB = `
window.__charts = [];
class Chart {
  constructor(ctx, cfg){ this.config=cfg; this.data=(cfg&&cfg.data)||{datasets:[]}; this.options=(cfg&&cfg.options)||{}; window.__charts.push(this); }
  update(){} destroy(){ const i=window.__charts.indexOf(this); if(i>=0) window.__charts.splice(i,1); } resetZoom(){}
}
Chart.register=function(){};
window.Chart=Chart;`;

let pass=0, fail=0;
const check=(name,ok,detail)=>{ console.log((ok?'  PASS  ':'✗ FAIL  ')+name+(detail?'  — '+detail:'')); ok?pass++:fail++; };
const near=(a,b,tol)=>Math.abs(a-b)<=tol;
const money=s=>{ const t=String(s).replace(/[−–]/g,'-'); const m=t.match(/-?[\d,.]+/); if(!m) return NaN;
  let v=parseFloat(m[0].replace(/,/g,'')); if(/m\b/.test(t)) v*=1e6; else if(/k\b/.test(t)) v*=1e3; else if(/b\b/.test(t)) v*=1e9; return v; };

const browser = await chromium.launch({args:['--allow-file-access-from-files']});
const errors=[];
async function open(url, blob){
  const ctx=await browser.newContext();
  const page=await ctx.newPage();
  page.on('pageerror', e=>{ errors.push(e.message); console.log('PAGEERROR:', e.message); });
  await page.route('**/*', route=>{
    const u=route.request().url();
    if(u.startsWith('file://')) return route.continue();
    if(/chart\.umd/.test(u)) return route.fulfill({contentType:'application/javascript', body:CHART_STUB});
    return route.fulfill({contentType:'application/javascript', body:'/* stub */'});
  });
  await page.goto(url, {waitUntil:'load'});
  await page.evaluate(([k,b])=>{ localStorage.clear(); if(b) localStorage.setItem(k, JSON.stringify(b)); try{ localStorage.setItem=function(){}; }catch(e){} }, [KEY, blob||null]);
  await page.reload({waitUntil:'load'});
  await page.waitForTimeout(350);
  await page.evaluate(()=>{ window.__csv=null; RVOExport.downloadCSV=(fn,txt)=>{ window.__csv=txt; }; });
  return {ctx, page};
}
const setOn=(page,on)=>page.evaluate(on=>{const el=document.getElementById('showReal');el.checked=on;el.dispatchEvent(new Event('change',{bubbles:true}));},on);

// The whole page as numbers: the three CSVs, the three charts, the cards.
async function read(page){
  return await page.evaluate(()=>{
    const txt=id=>{const e=document.getElementById(id);return e?e.textContent.replace(/\s+/g,' ').trim():'';};
    const out={csv:{},raw:{},chart:{}};
    for(const t of ['own','rent','rtb']){
      const b=document.querySelector('.tab-btn[data-table="'+t+'"]');
      if(!b||b.style.display==='none') continue;
      b.click(); window.__csv=null; document.getElementById('downloadBtn').click();
      const lines=(window.__csv||'').trim().split('\n');
      out.raw[t]=lines;
      const body=lines.filter(l=>!l.startsWith('#')), head=body[0].split(',');
      out.csv[t]=body.slice(1).map(l=>{const c=l.split(',');const o={};head.forEach((h,i)=>o[h]=c[i]===''?null:(isNaN(+c[i])?c[i]:+c[i]));return o;});
    }
    document.querySelector('.tab-btn[data-table="own"]').click();
    for(const g of ['netEquity','cash','cost']){
      document.querySelector('.graph-btn[data-graph="'+g+'"]').click();
      const ch=window.__charts[window.__charts.length-1];
      out.chart[g]={y:ch.options.scales.y.title.text,labels:ch.data.labels.slice(),ds:ch.data.datasets.map(d=>({label:d.label,band:!!d.isBand,data:d.data.slice()}))};
    }
    document.querySelector('.graph-btn[data-graph="netEquity"]').click();
    ['verdict','kpiDiff','kpiBreakeven','kpiBudgetRange','ownSummary','rentSummary','rtbSummary','chartSub','tableUnitNote','helpGeneralInflation'].forEach(k=>out[k]=txt(k));
    out.tiles={};
    ['ownSummary','rentSummary','rtbSummary'].forEach(id=>{out.tiles[id]=[...document.querySelectorAll('#'+id+' .tile')].map(t=>[t.querySelector('.label').textContent.trim(),t.querySelector('.value').textContent.trim()]);});
    out.assumptions=[...document.querySelectorAll('#assumptions li')].map(li=>li.textContent.trim());
    out.on=document.getElementById('showReal').checked;
    return out;
  });
}

// A plan with a floating rate (so the charts carry bands), Rent-Then-Buy,
// a manual budget that grows, and costs that grow at their own rates.
const PLAN={__fields:{'v:propertyPrice':'900,000','v:downPaymentPct':'20','v:horizon':'25','v:monthlyBudget':'6,000','v:monthlyBudgetIncrease':'2',
  'v:initialCash':'260,000','v:rentAmount':'3,100','v:rentInflation':'3.5','v:ownOngoingInflation':'2.5','v:rentOngoingInflation':'2',
  'c:rtbEnabled':true,'v:rtbBuyYear':'4','v:generalInflation':'3','c:showReal':false},
  __extra:{mortgageMode:'detailed',ratePeriods:[{toYear:3,type:'fixed',rate:5.4,rateMin:5.4,rateMax:5.4},{toYear:30,type:'floating',rate:6.5,rateMin:5,rateMax:8}]}};
const G=0.03, lvl=y=>Math.pow(1+G,y);
const RUN=/Accum_Cost/;
const SKIP=new Set(['Year','Phase','Rate_Pct']);

const {ctx, page}=await open(PAGE, PLAN);
const F=await read(page);
await setOn(page,true);
const T=await read(page);

console.log('\n════ Show in today\'s money, against a replay of future\'s money ════');
{
  const bad=[]; let cells=0;
  for(const t of Object.keys(F.csv)){
    const run={};
    F.csv[t].forEach((r,i)=>{
      const tr=T.csv[t][i], d=lvl(r.Year);
      for(const k of Object.keys(r)){
        if(SKIP.has(k)){ if(r[k]!==tr[k]) bad.push(`${t} yr${r.Year} ${k} moved`); continue; }
        if(r[k]===null){ if(tr[k]!==null) bad.push(`${t} yr${r.Year} ${k} filled`); continue; }
        cells++;
        if(RUN.test(k)){
          const prev=i>0&&F.csv[t][i-1][k]!=null?F.csv[t][i-1][k]:0;
          run[k]=(run[k]||0)+(r[k]-prev)/d;
          // Each future cell is rounded to the dollar, so the replay carries
          // half a dollar a year.
          if(!near(tr[k],run[k],1+0.5*i)) bad.push(`${t} yr${r.Year} ${k} ${tr[k]} ≠ ${run[k].toFixed(0)}`);
        } else if(!near(tr[k],r[k]/d,1)) bad.push(`${t} yr${r.Year} ${k} ${tr[k]} ≠ ${(r[k]/d).toFixed(0)}`);
      }
      // A row still reconciles across in today's money: it is all one year's.
      if(r.Year>0&&t!=='rtb'){
        const outflow=t==='own'?tr.Principal_Exp+tr.Interest_Exp+tr.Ongoing_Exp:tr.Rent_Exp+tr.Ongoing_Exp;
        if(!near(tr.Beg_Cash+tr.Ann_Budget+tr.Interest_Inc-outflow,tr.End_Cash,4)) bad.push(`${t} yr${r.Year} row does not reconcile`);
      }
    });
  }
  check('D2 every cell of the three cashflow tables is its future cell re-read at that year, running totals summed year by year, and every row still reconciles',
    !bad.length, bad.slice(0,5).join(' | ') || `${cells} cells across ${Object.keys(F.csv).join(', ')}`);
}
{
  const bad=[]; let pts=0;
  for(const g of Object.keys(F.chart)){
    const f=F.chart[g], t=T.chart[g];
    f.ds.forEach((d,k)=>{
      const td=t.ds[k].data; let run=0;
      d.data.forEach((v,i)=>{
        const y=f.labels[i], dd=lvl(y); pts++;
        const want=g==='cost'?(run+=(v-(i?d.data[i-1]:0))/dd):v/dd;
        if(!near(td[i],want,Math.max(1e-6,Math.abs(want)*1e-9))) bad.push(`${g} ${d.label} yr${y}: ${td[i]} ≠ ${want}`);
      });
    });
    if(!/today’s money/.test(t.y)||!/future’s money/.test(f.y)) bad.push(`${g} axis: "${f.y}" / "${t.y}"`);
  }
  check('D3 every point of the three charts, bands included, is its future point re-read the same way, and each axis names its money',
    !bad.length, bad.slice(0,5).join(' | ') || pts+' points');
}
{
  const bad=[];
  const H=25, last=T.csv.own[T.csv.own.length-1], lastR=T.csv.rent[T.csv.rent.length-1];
  const diff=last.Net_Equity-lastR.Net_Equity;
  if(!near(money(T.kpiDiff),diff,Math.max(1e4,Math.abs(diff)*0.01))) bad.push(`equity difference ${T.kpiDiff} vs ${diff}`);
  if(T.kpiBreakeven!==F.kpiBreakeven) bad.push(`breakeven moved: ${F.kpiBreakeven} → ${T.kpiBreakeven}`);
  const tile=(id,lab)=>{const t=T.tiles[id].find(x=>x[0].startsWith(lab));return t?t[1]:null;};
  const pairs=[['ownSummary','Net equity',last.Net_Equity],['ownSummary','Accumulated cost',last.Accum_Cost],['ownSummary','House equity',last.House_Equity],
    ['ownSummary','Liquid cash',last.End_Cash],['rentSummary','Net equity',lastR.Net_Equity],['rentSummary','Accumulated cost',lastR.Accum_Cost]];
  pairs.forEach(([id,lab,v])=>{const s=tile(id,lab);if(!s||!near(money(s),v,Math.max(5e3,Math.abs(v)*0.006))) bad.push(`${id} ${lab} ${s} vs ${v}`);});
  // Year-1 rent: the first year's rent, read at the end of year 1.
  const y1=T.tiles.rentSummary.find(x=>/Year 1\)/.test(x[0]));
  if(!y1||!near(money(y1[1]),T.csv.rent[1].Rent_Exp,600)) bad.push(`year-1 rent ${y1&&y1[1]} vs ${T.csv.rent[1].Rent_Exp}`);
  // The repayment range: every in-term year, every rate path, in today's money.
  const pay=T.tiles.ownSummary.find(x=>x[0].startsWith('Monthly mortgage'))[1].split(/[–-]/).map(money);
  const fpay=F.tiles.ownSummary.find(x=>x[0].startsWith('Monthly mortgage'))[1].split(/[–-]/).map(money);
  if(!(pay[0]<fpay[0]&&pay[1]<=fpay[1]+1)) bad.push(`repayment range ${pay} not inside future ${fpay}`);
  if(!(pay[0]<=fpay[0]/lvl(H)+1&&pay[1]>=fpay[0]/lvl(1)-1)) bad.push(`repayment range ${pay} misses the deflated ends`);
  const rtbPrice=T.tiles.rtbSummary.find(x=>/Property price at purchase|Harga/.test(x[0]))||T.tiles.rtbSummary[4];
  const fPrice=F.tiles.rtbSummary[4];
  if(!near(money(rtbPrice[1]),money(fPrice[1])/lvl(4),Math.max(2e3,money(fPrice[1])*0.006))) bad.push(`RTB price ${rtbPrice[1]} vs ${fPrice[1]}/1.03^4`);
  // The budget card is the range of the table's budgets, read each year.
  const bud=T.csv.own.slice(1).map(r=>r.Ann_Budget/12);
  const br=T.kpiBudgetRange.split(/[–-]/).map(money);
  if(!near(br[0],Math.min(...bud),Math.max(600,Math.min(...bud)*0.02))||!near(br[1],Math.max(...bud),Math.max(600,Math.max(...bud)*0.02))) bad.push(`budget range ${T.kpiBudgetRange} vs ${Math.min(...bud).toFixed(0)}–${Math.max(...bud).toFixed(0)}`);
  check('D4 the cards and tiles read the same figures, the breakeven year cannot move, and the repayment range spans every year and path',
    !bad.length, bad.join(' | ') || `difference ${T.kpiDiff}, breakeven ${T.kpiBreakeven}, repayments ${T.tiles.ownSummary.find(x=>x[0].startsWith('Monthly mortgage'))[1]}`);
}
{
  const bad=[];
  if(!/in today’s money\./.test(T.verdict)) bad.push('verdict');
  if(!/in future’s money\./.test(F.verdict)) bad.push('future verdict');
  if(!/today’s money, at 3% general inflation/.test(T.chartSub)) bad.push('chart note: '+T.chartSub);
  if(!/today’s money/.test(T.tableUnitNote)||!/future’s money/.test(F.tableUnitNote)) bad.push('table note');
  if(T.raw.own[1]!=="# In today's money, at 3% general inflation a year") bad.push('CSV line: '+T.raw.own[1]);
  if(F.raw.own[1].startsWith('#')) bad.push('future CSV carries a money line');
  if(!T.assumptions.some(a=>/Figures are in today's money, with prices rising 3% a year/.test(a))) bad.push('assumptions (today)');
  if(!F.assumptions.some(a=>/Figures are in future's money/.test(a)&&/3%/.test(a))) bad.push('assumptions (future)');
  const want='$'+Math.round(900000*lvl(25)).toLocaleString('en-AU');
  if(!T.helpGeneralInflation.includes('$900,000')||!T.helpGeneralInflation.includes(want)) bad.push('inflation note: '+T.helpGeneralInflation);
  check('D5 the verdict, the chart, the table, the CSV, What this assumes and the inflation note name the money on show',
    !bad.length, bad.join(' | ') || T.helpGeneralInflation);
}
{
  await setOn(page,false);
  const back=await read(page);
  const same=JSON.stringify(back)===JSON.stringify(F);
  const z=JSON.parse(JSON.stringify(PLAN)); z.__fields['v:generalInflation']='0';
  const o=await open(PAGE, z); const f0=await read(o.page); await setOn(o.page,true); const t0=await read(o.page); await o.ctx.close();
  const strip=x=>{const c=JSON.parse(JSON.stringify(x));for(const g of Object.values(c.chart))delete g.y;
    ['verdict','chartSub','tableUnitNote','assumptions','on','raw'].forEach(k=>delete c[k]);return JSON.stringify(c);};
  check('D6 switching back restores the page exactly, and with prices held still the two moneys are one page',
    same&&strip(f0)===strip(t0), (same?'':'switching back changed the page; ')+(strip(f0)===strip(t0)?'':'0% still moved a figure'));
}
await ctx.close();
{
  const states=[];
  let o=await open(PAGE, null); states.push(['new reader', await o.page.evaluate(()=>document.getElementById('showReal').checked), true]);
  // Off, then a Quick Start: a scenario is a full reset, the switch included.
  await setOn(o.page,false);
  await o.page.evaluate(()=>{ const i=document.getElementById('qsCity'); i.value='Perth'; i.dispatchEvent(new Event('input',{bubbles:true})); });
  await o.page.waitForTimeout(150);
  await o.page.evaluate(()=>{ const r=document.querySelector('#qsCityList [role="option"], #qsCityList .combo-item, #qsCityList > *'); if(r) r.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})), r.click(); });
  await o.page.waitForTimeout(300);
  states.push(['after a Quick Start', await o.page.evaluate(()=>document.getElementById('showReal').checked), true]);
  await o.ctx.close();
  const old={__fields:{'v:propertyPrice':'700,000','v:horizon':'20'},__extra:{}};
  o=await open(PAGE, old); states.push(['a plan saved before the switch', await o.page.evaluate(()=>document.getElementById('showReal').checked), false]); await o.ctx.close();
  o=await open(PAGE, {__fields:{'v:propertyPrice':'700,000','c:showReal':true},__extra:{}}); states.push(['a plan saved with it on', await o.page.evaluate(()=>document.getElementById('showReal').checked), true]); await o.ctx.close();
  o=await open(PAGE, {__fields:{'v:propertyPrice':'700,000','c:showReal':false},__extra:{}}); states.push(['a plan saved with it off', await o.page.evaluate(()=>document.getElementById('showReal').checked), false]); await o.ctx.close();
  const bad=states.filter(s=>s[1]!==s[2]);
  check('D1 on for a new reader and after a Quick Start, off for a plan saved before it existed, and kept as saved otherwise',
    !bad.length, (bad.length?bad:states).map(s=>s[0]+': '+(s[1]?'on':'off')).join(', '));
}
{
  const id=JSON.parse(JSON.stringify(PLAN)); id.__fields['c:showReal']=true;
  const a=await open(PAGE, id), b=await open(PAGE_ID, id);
  const ea=await read(a.page), eb=await read(b.page);
  await a.ctx.close(); await b.ctx.close();
  const same=JSON.stringify(ea.csv)===JSON.stringify(eb.csv)&&JSON.stringify(ea.chart.netEquity.ds.map(d=>d.data))===JSON.stringify(eb.chart.netEquity.ds.map(d=>d.data));
  const why=[];
  if(JSON.stringify(ea.csv)!==JSON.stringify(eb.csv))why.push('tables differ');
  if(JSON.stringify(ea.chart.netEquity.ds.map(d=>d.data))!==JSON.stringify(eb.chart.netEquity.ds.map(d=>d.data)))why.push('chart differs');
  if(!/nilai hari ini/.test(eb.verdict))why.push('verdict: '+eb.verdict.slice(-120));
  check('D7 the Indonesian page reads the same figures in today\'s money', same && !why.length, why.join(' | ') || 'tables and chart identical; the verdict says nilai hari ini');
}

check('no page errors', errors.length===0, errors.slice(0,2).join(' | '));
await browser.close();
console.log(`\nrentvsownhouse today's money audit: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
