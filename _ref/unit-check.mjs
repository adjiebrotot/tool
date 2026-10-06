// Cross-tool check: a switch of unit never moves the answer.
//
// When a control changes the unit of a field beside it (money to a "%" of the
// price, a monthly to a weekly cadence, a household total and a share to each
// spouse's own figure), the field is restated in the new unit so it keeps
// describing the same money. That is a promise about the books, so this holds
// each switch to the tool's own answer rather than to the figure in the
// field: the answer is read off the page before the switch and after it, and
// the two have to agree, line for line where the new figure is exact. A
// switch back has to give back what was typed.
//
// Where a figure cannot be exact in its new unit (a "%" held to two decimals,
// a split held to whole percents), the check states the bound the rounding
// allows and holds the drift inside it, so a drift past it names a real fault.
//
// freq-check.mjs covers the arithmetic of every frequency pairing; this file
// covers the integrity of the answer across every switch of unit.
//
// Run: node _ref/unit-check.mjs            (ONLY=<fragment> runs one tool)
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = p => pathToFileURL(join(ROOT, p)).href;
const ONLY = process.env.ONLY || '';
const want = name => !ONLY || name.includes(ONLY);

const CHART_STUB = `
class Chart { constructor(c,cfg){ this.config=cfg; this.data=(cfg&&cfg.data)||{datasets:[]}; this.options=(cfg&&cfg.options)||{}; this.scales=this.options.scales||{}; }
  update(){} destroy(){} resetZoom(){} zoomScale(){} isDatasetVisible(){return true;} setDatasetVisibility(){} }
Chart.register=function(){}; Chart.Interaction={modes:{}}; Chart.helpers={getRelativePosition:e=>e};
window.Chart=Chart;
window.Plotly={newPlot:async()=>{},react:async()=>{},relayout:async()=>{},purge:()=>{},downloadImage:async()=>{},toImage:async()=>'data:,'};`;

let pass=0, fail=0;
const check=(name, ok, detail)=>{
  console.log((ok?'  PASS  ':'✗ FAIL  ')+name+(detail!==undefined?'  — '+detail:''));
  ok?pass++:fail++;
};
const eq=(name, got, exp)=>check(name, String(got)===String(exp), 'got '+JSON.stringify(got)+(String(got)===String(exp)?'':' want '+JSON.stringify(exp)));
const near=(name, got, exp, tol)=>check(name, Math.abs(got-exp)<=tol, `got ${got}, want ${exp} ± ${tol}`);
const n=s=>Number(String(s).replace(/[−–]/g,'-').replace(/[^0-9.\-]/g,''));

const browser = await chromium.launch({args:['--allow-file-access-from-files']});

async function open(rel){
  const page = await browser.newPage();
  page.on('pageerror', e => { console.log('  ! pageerror on '+rel+': '+e.message); fail++; });
  await page.route('**/*', r=>{
    const u=r.request().url();
    if(u.startsWith('file://')) return r.continue();
    if(/chart\.umd/.test(u)) return r.fulfill({contentType:'application/javascript', body:CHART_STUB});
    if(/fonts\.googleapis|fonts\.gstatic/.test(u)) return r.fulfill({contentType:'text/css', body:'/*stub*/'});
    return r.fulfill({contentType:'application/javascript', body:'/*stub*/'});
  });
  await page.addInitScript(()=>{
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function(k){ return /-tour-v\d+-seen$/.test(k) ? '1' : get.call(this, k); };
  });
  await page.goto(url(rel), {waitUntil:'load'});
  await page.evaluate(()=>{ document.querySelectorAll('[class*="tour-backdrop"],[class*="tour-pop"],[class*="tour-offer"]').forEach(n=>n.remove()); });
  await page.waitForTimeout(250);
  return page;
}
// Typing into a field the way the audits do: the value, then input and change.
const setVals=(page, vals)=>page.evaluate(vals=>{
  Object.entries(vals).forEach(([id,v])=>{
    const el=document.getElementById(id); if(!el) throw new Error('no #'+id);
    if(el.type==='checkbox'){ el.checked=!!v; el.dispatchEvent(new Event('change',{bubbles:true})); return; }
    el.value=String(v); ['input','change'].forEach(t=>el.dispatchEvent(new Event(t,{bubbles:true})));
  });
}, vals);
const val=(page, sel)=>page.inputValue(sel.startsWith('#')||sel.startsWith('.')?sel:'#'+sel);

/* ════ Rent vs Own ═══════════════════════════════════════════════════════
   The answer is the page's own cashflow export, every table, every year. */
async function rvoCsv(page){
  return page.evaluate(()=>{
    RVOExport.downloadCSV=(fn,txt)=>{ window.__csv=txt; };
    const out={};
    ['own','rent','rtb'].forEach(t=>{
      const tab=document.querySelector('.tab-btn[data-table="'+t+'"]');
      if(!tab || tab.style.display==='none') return;
      window.__csv=null; tab.click(); document.getElementById('downloadBtn').click();
      out[t]=(window.__csv||'').split('\n').filter(l=>!l.startsWith('#')).join('\n');
    });
    return out;
  });
}
// A float that rounds to zero may print as "-0" on one path and "0" on the
// other, which is no difference of money, so the sign of a zero is dropped.
const z=s=>(s||'').replace(/(^|,)-0(?=,|$|\n)/gm,'$10');
const sameCsv=(a,b)=>['own','rent','rtb'].every(t=>z(a[t])===z(b[t]));
const diffAt=(a,b)=>{ for(const t of ['own','rent','rtb']){ const x=z(a[t]).split('\n'), y=z(b[t]).split('\n');
  for(let i=0;i<Math.max(x.length,y.length);i++) if(x[i]!==y[i]) return t+' line '+i+': '+x[i]+' | '+y[i]; } return 'identical'; };
// A column of one table, by header name.
const col=(csv, table, name)=>{ const L=csv[table].split('\n'); const h=L[0].split(','); const i=h.indexOf(name);
  return L.slice(1).map(l=>l.split(',')[i]); };

async function rvoChecks(rel, tag){
  const page = await open(rel);
  // Rent-Then-Buy on, so the setup cost is also paid at a later price.
  await setVals(page, {rtbEnabled:true});
  await page.waitForTimeout(150);
  await page.click('.ctrl-tab[data-tab="own"]');

  // R1 Setup cost: a fixed amount scales with the price it is paid on, as a
  // "%" does, so the whole model is unchanged in every table and year.
  {
    const before = await rvoCsv(page);
    await page.selectOption('#setupCostType','pct');
    eq(tag+' R1 setup 32,000 -> 4% of an 800,000 price', await val(page,'setupCost'), '4');
    const pct = await rvoCsv(page);
    check(tag+' R1 every cashflow table unchanged by the switch, Rent-Then-Buy included', sameCsv(before,pct), diffAt(before,pct));
    await page.selectOption('#setupCostType','dollar');
    eq(tag+' R1 4% -> back to 32,000', await val(page,'setupCost'), '32,000');
    const back = await rvoCsv(page);
    check(tag+' R1 and the round trip leaves the model where it was', sameCsv(before,back), diffAt(before,back));
  }
  // R2 Owning costs: a "%" tracks the home's value and a fixed amount its own
  // inflation. With that inflation equal to the house growth the two are the
  // same path, so every year has to match, not only year 1.
  {
    const g = await val(page,'houseGrowth');
    await setVals(page, {ownOngoingInflation:g});
    await page.waitForTimeout(100);
    const before = await rvoCsv(page);
    await page.selectOption('#ownOngoingCostType','pct');
    eq(tag+' R2 owning costs 6,000 a year -> 0.75% of an 800,000 home', await val(page,'ownOngoingCost'), '0.75');
    const pct = await rvoCsv(page);
    check(tag+' R2 every table, every year unchanged (cost inflation = house growth '+g+'%)', sameCsv(before,pct), diffAt(before,pct));
    // A frequency move under a "%" is no move of money: field and model stay.
    await page.selectOption('#ownOngoingCostFreq','monthly');
    eq(tag+' R2 a "%" cost is left alone when its frequency moves', await val(page,'ownOngoingCost'), '0.75');
    check(tag+' R2 and the model ignores that frequency', sameCsv(before, await rvoCsv(page)));
    await page.selectOption('#ownOngoingCostType','dollar');
    eq(tag+' R2 0.75% -> 500 a month (the frequency now showing)', await val(page,'ownOngoingCost'), '500');
    const monthly = await rvoCsv(page);
    check(tag+' R2 500 a month is the same model as 6,000 a year', sameCsv(before,monthly), diffAt(before,monthly));
    await page.selectOption('#ownOngoingCostFreq','yearly');
    eq(tag+' R2 500 a month -> 6,000 a year', await val(page,'ownOngoingCost'), '6,000');
    // Off that matched growth, only year 1 is promised: later years follow the new basis.
    await setVals(page, {ownOngoingInflation:0});
    await page.waitForTimeout(100);
    const fixed = await rvoCsv(page);
    await page.selectOption('#ownOngoingCostType','pct');
    const share = await rvoCsv(page);
    eq(tag+' R2 with no cost inflation, year 1 owning costs still match', col(share,'own','Ongoing_Exp')[1], col(fixed,'own','Ongoing_Exp')[1]);
    await page.selectOption('#ownOngoingCostType','dollar');
  }
  // R3 Renting costs, a share of a year of rent (2,800 a month = 33,600).
  {
    await page.click('.ctrl-tab[data-tab="rent"]');
    const ri = await val(page,'rentInflation');
    await setVals(page, {rentOngoingCost:'1,344', rentOngoingInflation:ri});
    await page.waitForTimeout(100);
    const before = await rvoCsv(page);
    await page.selectOption('#rentOngoingCostType','pct');
    eq(tag+' R3 renting costs 1,344 a year -> 4% of a year of rent', await val(page,'rentOngoingCost'), '4');
    const pct = await rvoCsv(page);
    check(tag+' R3 every table, every year unchanged (cost inflation = rent inflation '+ri+'%)', sameCsv(before,pct), diffAt(before,pct));
    await page.selectOption('#rentOngoingCostType','dollar');
    eq(tag+' R3 4% -> back to 1,344 a year', await val(page,'rentOngoingCost'), '1,344');
    // A share that is not exact at two decimals: 1,200 / 33,600 = 3.5714%.
    // The bound is half a hundredth of a percent of a year of rent: 1.68.
    await setVals(page, {rentOngoingCost:'1,200'});
    await page.waitForTimeout(100);
    const fixed = await rvoCsv(page);
    await page.selectOption('#rentOngoingCostType','pct');
    eq(tag+' R3 1,200 a year -> 3.57% (two decimals)', await val(page,'rentOngoingCost'), '3.57');
    const share = await rvoCsv(page);
    near(tag+' R3 year 1 renting costs drift no further than the rounding allows',
      n(col(share,'rent','Ongoing_Exp')[1]), n(col(fixed,'rent','Ongoing_Exp')[1]), 1.68+0.5);
    await page.selectOption('#rentOngoingCostType','dollar');
    near(tag+' R3 and the round trip comes back within it', n(await val(page,'rentOngoingCost')), 1200, 1.68);
  }
  // R4 Detailed cost rows convert through the same function, row by row.
  {
    await page.click('.ctrl-tab[data-tab="own"]');
    await page.click('#ownCostsModeGroup .seg-btn[data-val="detailed"]');
    await page.waitForTimeout(150);
    const before = await rvoCsv(page);
    const row = '#ownSetupCostRows .cost-item-row:first-child';
    await page.selectOption(row+' .ci-basis','pct');
    eq(tag+' R4 detailed setup row 32,000 -> 4% of price', await page.inputValue(row+' .ci-amount'), '4');
    const pct = await rvoCsv(page);
    check(tag+' R4 detailed setup row: model unchanged', sameCsv(before,pct), diffAt(before,pct));
    await page.selectOption(row+' .ci-basis','fixed');
    eq(tag+' R4 detailed setup row back to 32,000', await page.inputValue(row+' .ci-amount'), '32,000');
    const orow = '#ownOngoingCostRows .cost-item-row:first-child';
    await page.selectOption(orow+' .ci-basis','monthly');
    await page.selectOption(orow+' .ci-basis','pct');
    eq(tag+' R4 detailed owning row 500 a month -> 0.75% of value', await page.inputValue(orow+' .ci-amount'), '0.75');
    const opct = await rvoCsv(page);
    eq(tag+' R4 detailed owning row: year 1 owning costs unchanged', col(opct,'own','Ongoing_Exp')[1], col(before,'own','Ongoing_Exp')[1]);
    await page.selectOption(orow+' .ci-basis','yearly');
    eq(tag+' R4 detailed owning row 0.75% -> 6,000 a year', await page.inputValue(orow+' .ci-amount'), '6,000');
    await page.click('#ownCostsModeGroup .seg-btn[data-val="simple"]');
    await page.waitForTimeout(100);
  }
  // R5 A Quick Start sets the type without an event; the next switch has to
  // convert from the type it left, not the one before it.
  {
    // Sydney: its setup cost is a "%" of the price.
    const qs = await page.evaluate(()=>{
      const b=document.querySelector('.quick-start-btn[data-city="sydney"]'); b.click(); return b.dataset.city; });
    await page.waitForTimeout(200);
    const type = await val(page,'setupCostType'), fig = n(await val(page,'setupCost'));
    const price = n(await val(page,'propertyPrice'));
    const before = await rvoCsv(page);
    await page.selectOption('#setupCostType', type==='pct'?'dollar':'pct');
    const got = n(await val(page,'setupCost'));
    const exp = type==='pct' ? Math.round(fig/100*price*100)/100 : Math.round(fig/price*100*100)/100;
    eq(tag+' R5 after Quick Start "'+qs+'", setup converts from the '+type+' it left', got, exp);
    // An exact share (a "%" preset) restates to the cent, so the model holds.
    if(type==='pct') check(tag+' R5 and the model is unchanged', sameCsv(before, await rvoCsv(page)), diffAt(before, await rvoCsv(page)));
  }
  await page.close();
}
if(want('rentvsownhouse')){
  console.log('\n── Rent vs Own ──');
  await rvoChecks('rentvsownhouse/index.html', 'rvo');
  await rvoChecks('rentvsownhouse/id/index.html', 'rvo-id');
}

/* ════ Finance vs Cash ═══════════════════════════════════════════════════
   The answer is the comparison table: every metric for every scenario. */
if(want('financingvscash')){
  console.log('\n── Finance vs Cash ──');
  const page = await open('financingvscash/index.html');
  const KEY='abt:save:financingvscash:v1';
  const sc=o=>Object.assign({name:'S', financeRate:7, downPaymentPct:20, termPeriods:60, freq:'monthly',
    feeAmt:0, feeType:'fixed', feeTreatment:'upfront', adminFee:0, loanType:'annuity', rateMode:'simple',
    ratePeriods:null, paymentMode:'single', paymentPeriods:null, knownPayment:0, ioPeriods:60, residualPct:0}, o);
  async function load(scenarios, fields={}){
    const f=Object.assign({'v:currencySymbol':'$','v:purchaseCost':'50000','v:availableCash':'50000',
      'v:baseRf':'4.5','v:rateConvention':'ear','c:inflationToggle':false,'v:inflationRate':'2.5',
      'v:chartMetric':'wealth','v:optTarget':'netBenefit'}, fields);
    await page.evaluate(([key,blob])=>{ localStorage.setItem(key, JSON.stringify(blob)); try{ localStorage.setItem=function(){}; }catch(e){} },
      [KEY, {__fields:f, __extra:{scenarios}}]);
    await page.reload({waitUntil:'load'});
    await page.waitForTimeout(300);
    await page.evaluate(()=>{ document.querySelectorAll('[class*="tour-backdrop"],[class*="tour-pop"],[class*="tour-offer"]').forEach(n=>n.remove()); });
  }
  const table=()=>page.evaluate(()=>[...document.querySelectorAll('#compTableWrap table tr')].map(tr=>[...tr.children].map(td=>td.textContent.trim()).join(' | ')).join('\n'));
  const edit=async i=>{ await page.click('.ctrl-tab[data-tab="scenarios"]'); await page.evaluate(i=>document.querySelector('.sc-btn[data-action="edit"][data-idx="'+i+'"]').click(), i); await page.waitForTimeout(100); };
  const save=async()=>{ await page.click('#saveScenarioBtn'); await page.waitForTimeout(200); };
  const nums=t=>t.split('\n').map(l=>l.split(' | ').map(c=>/\d/.test(c)?n(c):c));
  // Largest numeric gap between two tables of the same shape.
  const gap=(a,b)=>{ const A=nums(a), B=nums(b); let g=0; A.forEach((r,i)=>r.forEach((c,j)=>{ if(typeof c==='number'&&typeof B[i][j]==='number') g=Math.max(g,Math.abs(c-B[i][j])); })); return g; };

  // F1 Fee paid upfront: $600 on 40,000 financed (50,000 less 20% down) is 1.5%.
  for(const treat of ['upfront','capitalise']){
    await load([sc({name:'Fee', feeAmt:600, feeTreatment:treat})]);
    const before = await table();
    await edit(0);
    await page.selectOption('#scFeeType','pct');
    eq('fvc F1 '+treat+': fee 600 -> 1.5% of the 40,000 financed', await val(page,'scFeeAmt'), '1.5');
    await save();
    const after = await table();
    check('fvc F1 '+treat+': the comparison table is unchanged', after===before, gap(before,after)===0?'identical':'max gap '+gap(before,after));
    await edit(0);
    await page.selectOption('#scFeeType','fixed');
    eq('fvc F1 '+treat+': 1.5% -> back to 600', await val(page,'scFeeAmt'), '600');
    await save();
    check('fvc F1 '+treat+': and the round trip leaves it unchanged', await table()===before);
  }
  // F2 Deducted from the advance: a % grosses the loan up, so the share that
  // costs $1,025.64 there is 2.5% (40,000 / 0.975 = 41,025.64).
  {
    await load([sc({name:'Fee', feeAmt:1025.64, feeTreatment:'discount'})]);
    const before = await table();
    await edit(0);
    await page.selectOption('#scFeeType','pct');
    eq('fvc F2 discount: fee 1,025.64 -> 2.5% grossed up', await val(page,'scFeeAmt'), '2.5');
    await save();
    const after = await table();
    // 2.5% is 1,025.641 against 1,025.64 typed: a tenth of a cent.
    check('fvc F2 discount: the table moves by no more than the cent it rounds', gap(before,after)<=0.01, 'max gap '+gap(before,after));
    await edit(0);
    await page.selectOption('#scFeeType','fixed');
    eq('fvc F2 discount: 2.5% -> back to 1,025.64', await val(page,'scFeeAmt'), '1,025.64');
    await save();
  }
  // F3 The down payment is capped by the cash on hand, and so is the base.
  {
    await load([sc({name:'Fee', feeAmt:900, downPaymentPct:20})], {'v:availableCash':'5000'});
    const before = await table();
    await edit(0);
    await page.selectOption('#scFeeType','pct');
    eq('fvc F3 cash caps the down payment at 5,000: 900 is 2% of 45,000', await val(page,'scFeeAmt'), '2');
    await save();
    check('fvc F3 the comparison table is unchanged', await table()===before);
  }
  // F4 Frequency: a known repayment, its schedule and the admin fee are per
  // repayment, so they follow the period with the term. What goes out over a
  // year stays put to the cent per repayment, and so the solved rate does.
  {
    await load([sc({name:'Known', loanType:'knownPayment', knownPayment:950, adminFee:10, downPaymentPct:20})]);
    await edit(0);
    await page.click('.ctrl-tab[data-tab="scenarios"]');
    const r0 = await page.textContent('#scImpliedRate');
    await page.selectOption('#scFreq','weekly');
    eq('fvc F4 term 60 months -> 260 weeks', await val(page,'scTerm'), '260');
    eq('fvc F4 repayment 950 a month -> 219.23 a week', await val(page,'scKnownPayment'), '219.23');
    eq('fvc F4 admin fee 10 a payment monthly -> 2.31 weekly', await val(page,'scAdminFee'), '2.31');
    const r1 = await page.textContent('#scImpliedRate');
    // Weekly repayments start sooner, so the rate moves a little; the old
    // behaviour (950 a week) would have more than quadrupled the repayments.
    // The same money a year paid weekly arrives sooner (and 260 weeks is six
    // days short of five years), so the solved rate moves a little. It has to
    // be the rate an independent solve of the converted stream gives, not a
    // guess at "close": 40,000 repaid by 60 x 950 or by 260 x 219.23.
    const rate=t=>parseFloat(String(t).replace(/[^0-9.\-]+/,''));
    const ear=(P,pmt,k,ppy)=>{ let lo=0,hi=1; for(let i=0;i<200;i++){ const r=(lo+hi)/2; (pmt*(1-Math.pow(1+r,-k))/r>P)?lo=r:hi=r; } return (Math.pow(1+(lo+hi)/2,ppy)-1)*100; };
    near('fvc F4 monthly: the page solves the rate an independent replay does', rate(r0), ear(40000,950,60,12), 0.006);
    near('fvc F4 weekly: likewise for the converted stream', rate(r1), ear(40000,219.23,260,52), 0.006);
    check('fvc F4 the rate stays within a point of where it was (950 a week would read '+ear(40000,950,260,52).toFixed(0)+'%)',
      Math.abs(rate(r1)-rate(r0))<1, rate(r0)+'% -> '+rate(r1)+'%');
    near('fvc F4 repayments a year: 52 x 219.23 against 12 x 950', 52*219.23, 12*950, 52*0.005);
    await page.selectOption('#scFreq','monthly');
    eq('fvc F4 and back: 219.23 a week -> 950 a month (11,399.96 / 12)', await val(page,'scKnownPayment'), '950');
    eq('fvc F4 term back to 60', await val(page,'scTerm'), '60');
    // A repayment schedule's amounts follow it too.
    await page.click('#scPaymentModeGroup .seg-btn[data-val="schedule"]');
    await page.waitForTimeout(100);
    const amts0 = await page.$$eval('#scPaymentPeriodRows .sp-amt', els=>els.map(e=>e.value));
    await page.selectOption('#scFreq','yearly');
    const amts1 = await page.$$eval('#scPaymentPeriodRows .sp-amt', els=>els.map(e=>e.value));
    eq('fvc F4 each scheduled repayment a month -> a year', amts1.map(n).join(','), amts0.map(v=>Math.round(n(v)*12*100)/100).join(','));
    await page.click('#cancelScenarioBtn');
  }
  await page.close();
}

/* ════ Borrowing Capacity ════════════════════════════════════════════════
   The answer is compute() on what the form reads: every cap, the binding one,
   the loan and the price it buys. */
if(want('borrowingcapacity')){
  console.log('\n── Borrowing Capacity ──');
  const page = await open('borrowingcapacity/index.html');
  const answer=()=>page.evaluate(()=>{ const r=window.__BC.compute(window.__BC.readInputs());
    return {loan:r.maxLoan, price:r.maxPrice, bind:r.binding.key, funds:r.availFunds, costs:r.purchaseCosts,
            caps:r.caps.map(c=>c.key+':'+c.value).join(' ')}; });
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  await page.click('.ctrl-tab[data-tab="caps"]');
  await setVals(page, {price:'900,000', savings:'220,000', otherCosts:'4,000', dutyPct:'4'});
  await page.waitForTimeout(100);

  // B1 Stamp duty: 4% of 900,000 is 36,000, both ways, and nothing moves.
  {
    const before = await answer();
    await page.selectOption('#dutyMode','amount');
    eq('bc B1 duty 4% -> 36,000', await val(page,'dutyAmt'), '36,000');
    check('bc B1 every cap and the answer unchanged', same(before, await answer()), JSON.stringify(await answer()));
    await page.selectOption('#dutyMode','pct');
    eq('bc B1 36,000 -> back to 4%', await val(page,'dutyPct'), '4');
    check('bc B1 round trip unchanged', same(before, await answer()));
  }
  // B2 Deposit: an amount is savings with the costs still to come out of it,
  // a % is the deposit itself. 220,000 less 40,000 of costs is 20% of 900,000.
  {
    const before = await answer();
    await page.selectOption('#depositMode','pct');
    eq('bc B2 savings 220,000 with 40,000 of costs -> a 20% deposit', await val(page,'depositPct'), '20');
    const pct = await answer();
    check('bc B2 every cap, the deposit and the price unchanged', same(before, pct), JSON.stringify(before)+' vs '+JSON.stringify(pct));
    await page.selectOption('#depositMode','amount');
    eq('bc B2 20% -> back to 220,000 of savings', await val(page,'savings'), '220,000');
    check('bc B2 round trip unchanged', same(before, await answer()));
  }
  // B3 A share that is not exact at three decimals: 160,000 / 900,000.
  // The bound is half a thousandth of a percent of the price: 4.50.
  {
    await setVals(page, {savings:'200,000'});
    await page.waitForTimeout(100);
    const before = await answer();
    await page.selectOption('#depositMode','pct');
    eq('bc B3 savings 200,000 -> 17.778%', await val(page,'depositPct'), '17.778');
    const pct = await answer();
    near('bc B3 the deposit drifts no further than the rounding allows', pct.funds, before.funds, 4.5);
    eq('bc B3 the binding cap is the same', pct.bind, before.bind);
    // The deposit cap is funds x LVR / (1 - LVR): 4 times the drift at 80%.
    near('bc B3 the loan moves by at most that drift through the deposit cap', pct.loan, before.loan, 4.5*4);
    await page.selectOption('#depositMode','amount');
    near('bc B3 round trip within the bound', n(await val(page,'savings')), 200000, 4.5);
  }
  // B4 The deposit converts through the duty as entered, in either mode.
  {
    await setVals(page, {savings:'220,000'});
    await page.selectOption('#dutyMode','amount');
    await setVals(page, {dutyAmt:'36,000'});
    await page.waitForTimeout(100);
    const before = await answer();
    await page.selectOption('#depositMode','pct');
    eq('bc B4 with duty as an amount, 220,000 -> 20%', await val(page,'depositPct'), '20');
    check('bc B4 answer unchanged', same(before, await answer()));
    await page.selectOption('#depositMode','amount');
    await page.selectOption('#dutyMode','pct');
  }
  // B5 A Quick Start sets the modes silently; the next switch converts from them.
  {
    await page.evaluate(()=>document.querySelector('.quick-start-btn').click());
    await page.waitForTimeout(150);
    const mode = await val(page,'dutyMode');
    const before = await answer();
    await page.selectOption('#dutyMode', mode==='pct'?'amount':'pct');
    const after = await answer();
    near('bc B5 after a Quick Start, the duty switch keeps the duty ('+mode+' -> other)', after.costs, before.costs, mode==='pct'?0.005:n(await val(page,'price'))*0.000005);
  }
  await page.close();
}

/* ════ DCA Scenario Explorer ═════════════════════════════════════════════
   The amount is per purchase, so the money a year is the answer to hold. */
if(want('dcasimulator')){
  console.log('\n── DCA Scenario Explorer ──');
  const page = await open('dcasimulator/index.html');
  await page.click('.ctrl-tab[data-tab="securities"]');
  await page.click('#addScenarioBtn');
  await page.waitForTimeout(200);
  const pick=async (cat, style)=>{
    await page.evaluate(([cat,style])=>{
      const pill=[...document.querySelectorAll('.cat-pill')].find(p=>p.dataset.cat===cat); if(pill) pill.click();
      const r=[...document.querySelectorAll('input[name^="secStyle"]')].find(x=>x.value===style);
      if(!r) throw new Error('no style '+style);
      r.checked=true; r.dispatchEvent(new Event('change',{bubbles:true}));
    }, [cat, style]);
    await page.waitForTimeout(120);
  };
  await pick('date','monthly-date');
  await page.fill('#cfgAmount','500');
  await page.dispatchEvent('#cfgAmount','change');
  await pick('date','weekly-day');
  eq('dca D1 monthly date -> weekly day: 500 a month is 115.38 a week', await val(page,'cfgAmount'), '115.38');
  near('dca D1 money a year held: 52 x 115.38 against 12 x 500', 52*115.38, 6000, 52*0.005);
  await pick('forward','weekly-top');
  eq('dca D2 between two weekly styles the amount stays', await val(page,'cfgAmount'), '115.38');
  await pick('forward','monthly-bottom');
  eq('dca D3 weekly -> monthly style: 115.38 a week is 499.98 a month', await val(page,'cfgAmount'), '499.98');
  await pick('date','monthly-date');
  eq('dca D4 between two monthly styles the amount stays', await val(page,'cfgAmount'), '499.98');
  // A momentum style buys at most once per its own Frequency (monthly here).
  await pick('momentum','momentum-dip');
  eq('dca D5 monthly date -> monthly momentum: unchanged', await val(page,'cfgAmount'), '499.98');
  await page.evaluate(()=>document.querySelector('[id^="secPeriodSeg"] .seg-btn[data-period="weekly"]').click());
  await page.waitForTimeout(120);
  eq('dca D6 momentum frequency monthly -> weekly', await val(page,'cfgAmount'), '115.38');
  await pick('date','monthly-date');
  eq('dca D7 weekly momentum -> monthly date style', await val(page,'cfgAmount'), '499.98');
  // The scenario's own state moved, not only the field: another scenario and
  // back rebuilds the form from state.
  await page.click('#addScenarioBtn');
  await page.waitForTimeout(150);
  await page.evaluate(()=>{ const t=document.querySelectorAll('#scenarioTabs .sc-tab'); t[t.length-2].querySelector('.sc-tab-name').click(); });
  await page.waitForTimeout(150);
  eq('dca D8 the scenario itself holds the converted amount', await val(page,'cfgAmount'), '499.98');
  await page.close();
}

/* ════ PPh 21 Pisah vs Gabung ════════════════════════════════════════════
   The answer is the page's CSV: the tax filed apart and filed jointly, in
   whole rupiah, across the salary sweep at the household's own share and
   deductions. The headline cards round to a tenth of a million, so they are
   checked too but prove less. */
async function pphChecks(rel, tag){
  const page = await open(rel);
  const kpis=()=>page.evaluate(()=>['kpiPisah','kpiGabung','kpiSaving'].map(id=>document.getElementById(id).textContent.trim()).join(' / '));
  const csv=async()=>{
    await page.evaluate(()=>{ window.__blob=null; URL.createObjectURL=b=>{ window.__blob=b; return 'blob:unit-check'; }; URL.revokeObjectURL=()=>{}; document.getElementById('downloadBtn').click(); });
    const txt = await page.evaluate(()=>window.__blob ? window.__blob.text() : '');
    return txt.split('\n').filter(l=>!l.startsWith('#')).join('\n');
  };
  // One salary's row of the sweep, as {column: value}.
  const row=(c, mio)=>{ const L=c.split('\n'), h=L[0].split(','); const r=L.find(l=>l.split(',')[0]===String(mio));
    const o={}; h.forEach((k,i)=>o[k]=r?r.split(',')[i]:undefined); return o; };
  await setVals(page, {totalSalaryInput:'500,000,000', splitPct:'40', deductionInput:'10,000,000'});
  await page.waitForTimeout(150);
  const before = await csv(), beforeK = await kpis();
  check(tag+' P0 the CSV carries the sweep', before.split('\n').length>50, before.split('\n').length+' lines');
  await page.click('#modeBtnSplit');
  await page.waitForTimeout(150);
  eq(tag+' P1 total 500M at 40% to the wife -> husband 300M', await val(page,'husbandSalaryInput'), '300,000,000');
  eq(tag+' P1 -> wife 200M', await val(page,'wifeSalaryInput'), '200,000,000');
  eq(tag+' P1 deduction 10M split as Total mode splits it -> husband 6M', await val(page,'husbandDeductionInput'), '6,000,000');
  eq(tag+' P1 -> wife 4M', await val(page,'wifeDeductionInput'), '4,000,000');
  const split = await csv();
  check(tag+' P1 every row of the sweep identical to the rupiah', split===before, split===before?'identical':'differs');
  eq(tag+' P1 the headline cards unchanged', await kpis(), beforeK);
  await page.click('#modeBtnTotal');
  await page.waitForTimeout(150);
  eq(tag+' P2 back to Total: 500M', await val(page,'totalSalaryInput'), '500,000,000');
  eq(tag+' P2 at 40%', await val(page,'splitPct'), '40');
  eq(tag+' P2 deduction 10M', await val(page,'deductionInput'), '10,000,000');
  check(tag+' P2 every row of the sweep identical to the rupiah', await csv()===before);
  // P3 A split Total mode cannot hold: 400M and 300M is 42.857%. The total is
  // exact and the share lands on the nearest whole percent, so the household
  // moves by 1M (0.143% of 700M) from husband to wife and the tax can move.
  // The 700M row of the sweep is that household in either mode, so the drift
  // is measured on it, to the rupiah, and bounded by 1M taxed at the top 35%.
  await page.click('#modeBtnSplit');
  await setVals(page, {husbandSalaryInput:'400,000,000', wifeSalaryInput:'300,000,000', husbandDeductionInput:'0', wifeDeductionInput:'0'});
  await page.waitForTimeout(150);
  const indiv = row(await csv(), 700);
  eq(tag+' P3 the 700M row is the household typed (husband)', indiv.HusbandGross, '400000000');
  await page.click('#modeBtnTotal');
  await page.waitForTimeout(150);
  eq(tag+' P3 each spouse 400M + 300M -> total 700M', await val(page,'totalSalaryInput'), '700,000,000');
  eq(tag+' P3 -> the nearest whole share, 43%', await val(page,'splitPct'), '43');
  const tot = row(await csv(), 700);
  eq(tag+' P3 which puts 1M more with the wife', Number(tot.WifeGross)-Number(indiv.WifeGross), 1000000);
  const dP = Math.abs(Number(tot.TotalTax_Pisah)-Number(indiv.TotalTax_Pisah));
  const dG = Math.abs(Number(tot.TotalTax_Gabung)-Number(indiv.TotalTax_Gabung));
  check(tag+' P3 filed jointly the household is the same, so its tax is unchanged', dG===0, 'gap Rp '+dG);
  check(tag+' P3 filed apart the tax moves by at most 35% of the 1M shifted', dP<=350000, 'gap Rp '+dP.toLocaleString('en-US')
    +' ('+Number(indiv.TotalTax_Pisah).toLocaleString('en-US')+' -> '+Number(tot.TotalTax_Pisah).toLocaleString('en-US')+')');
  // P4 A Quick Start picks its mode with its own figures, never carried ones.
  await page.click('.quick-start-btn[data-preset="double"]');
  await page.waitForTimeout(150);
  eq(tag+' P4 Quick Start "double" keeps its own husband figure', await val(page,'husbandSalaryInput'), '400,000,000');
  eq(tag+' P4 and its own wife figure', await val(page,'wifeSalaryInput'), '300,000,000');
  await page.close();
}
if(want('pisahvsgabung')){
  console.log('\n── PPh 21 Pisah vs Gabung ──');
  await pphChecks('pisahvsgabung/index.html', 'pph');
  await pphChecks('pisahvsgabung/id/index.html', 'pph-id');
}

await browser.close();
console.log('\nUnit check: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
