// Cost of Living Comparator: custom frequency, accounting integrity audit.
//
// The custom frequency checkbox (Detailed mode) is a conversion add-on: it
// changes the units amounts are TYPED in, never the money they stand for. So
// every test below is one of three kinds:
//
//   status quo  with the box unticked, the page is the page it was before the
//               feature existed (pinned to commit BASE and compared cell by
//               cell), and ticking it with every row left monthly moves nothing
//   no drift    re-expressing a figure in another unit (week, year, per meal,
//               per litre, per gallon...) leaves every total where it was, to
//               the displayed unit. Only a typed amount or quantity moves money
//   replay      every Savings and Required salary cell is recomputed here from
//               the raw JSON (indices and USD rates) and the page's own inputs,
//               without the tool's code: income a month, less the sum of each
//               row's amount times its months-worth multiplier
//
// Exact state is read through the tour's snapshot hook (window.__COL_TOUR),
// which hands back a copy of the page state; the fields on screen are checked
// against it separately, to their display precision.
//
// Run: node freq.mjs
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const BASE = '0127cc7';   // last commit before custom frequency existed

const MIME = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
const server = http.createServer((req,res)=>{
  const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/,'/index.html'));
  if(!existsSync(p)){ res.writeHead(404); res.end(); return; }
  res.writeHead(200, {'content-type': MIME[extname(p)]||'application/octet-stream'});
  res.end(readFileSync(p));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const PAGE = `http://127.0.0.1:${server.address().port}/costofliving-comparator/index.html`;

let pass=0, fail=0;
const check=(name,ok,detail)=>{ console.log((ok?'  PASS  ':'✗ FAIL  ')+name+(detail?'  — '+detail:'')); ok?pass++:fail++; };
const section=t=>console.log('\n'+t);

/* ── independent model, from the raw data ─────────────────────────────── */
const col   = JSON.parse(readFileSync(join(HERE,'..','cost_of_living_indices_aggregated.json'),'utf8'));
const rates = JSON.parse(readFileSync(join(HERE,'..','currency_rates.json'),'utf8'));
const RATE  = Object.fromEntries(rates.data.map(r=>[r.currency,r.usd_rate]));
const CITY  = Object.fromEntries(col.data.map(c=>[c.city+'|'+c.country,c]));
const PER_YEAR = {weekly:52, fortnightly:26, monthly:12, yearly:1};
const GAL = 3.785411784;
const UNIT_CAT = {meal:'eating_out', kwh:'electricity', litre:'fuel', gallon:'fuel', trip:'intl_travel'};
const pos = v => (v!=null && v>0) ? v : null;
function index(c, cat){
  const u = c.utilities_index||{};
  switch(cat){
    case 'rent':        return pos(c.rent_index&&c.rent_index.med);
    case 'groceries':   return pos(c.groceries_index);
    case 'eating_out':  return pos(c.eating_out_index);
    case 'electricity': return pos(u.electricity&&u.electricity.Median);
    case 'water':       return pos(u.water&&u.water.Median);
    case 'gas_util':    return pos(u.gas&&u.gas.Median);
    case 'fuel':        return pos(u.fuel&&u.fuel.Median);
    case 'remittance': case 'intl_travel': return 100;   // FX only
    case 'other':       return pos(c.coli_no_housing);
    case 'utilities': {
      let a=0,w=0; [['electricity',.5],['water',.2],['gas',.3]].forEach(([k,wt])=>{const v=pos(u[k]&&u[k].Median); if(v){a+=wt*v;w+=wt;}});
      return w?a/w:null;
    }
  }
  return null;
}
// A destination's estimate for one row, in the row's own unit.
function estimate(amount, from, to, cat){
  if(!amount) return 0;
  const fi=index(from,cat), ti=index(to,cat);
  return amount / RATE[from.currency] * (ti/fi) * RATE[to.currency];
}
// Months-worth multiplier of one row, derived from its unit.
function mult(row){
  const u=row.unit||'monthly';
  if(PER_YEAR[u]) return PER_YEAR[u]/12;
  return (row.qty>0?row.qty:0) * PER_YEAR[row.qtyPer||'monthly']/12;
}
// Every figure the Savings and Net Income rows should show, from state alone.
function replay(S){
  const from=CITY[S.detailFromKey];
  const inc=PER_YEAR[S.detailIncomeFreq||'monthly']/12;
  const sav=PER_YEAR[S.customFreq?(S.detailSavingsFreq||'monthly'):'monthly']/12;
  const fSal=S.detailFromSalary*inc;
  const fExp=S.detailRows.reduce((t,r)=>t+(r.fromAmount||0)*mult(r),0);
  const fSav=fSal-fExp, fRat=fSal>0?fSav/fSal:0;
  const dests=S.detailToCities.map((k,ci)=>{
    const to=CITY[k];
    const exp=S.detailRows.reduce((t,r)=>{
      const ov=r.overrides&&(String(ci) in r.overrides)?r.overrides[String(ci)]:null;
      return t+(ov!=null?ov:estimate(r.fromAmount||0,from,to,r.catId))*mult(r);
    },0);
    let sal;
    if(S.goal==='earn'){
      sal = S.savingsTarget==='ratio' ? exp/(1-fRat)
          : exp + fSav/RATE[from.currency]*RATE[to.currency];
    } else sal=(S.detailToSalaries[ci]||0)*inc;
    return {exp, sal, reqShown:sal/inc, savShown:(sal-exp)/sav, ratio:sal>0?(sal-exp)/sal*100:null};
  });
  return {fSal, fExp, fSavShown:fSav/sav, fRatio:fRat*100, dests};
}

/* ── page driving ─────────────────────────────────────────────────────── */
const browser = await chromium.launch();
const num = s => parseFloat(String(s).replace(/,/g,'').replace(/[^\d.\-]/g,''));
const T = 60;

async function openPage(legacy){
  // Its own context, so the pre-feature page's mini cache never leaks into
  // the page under test.
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', e=>{ console.log('PAGEERROR:', e.message); fail++; });
  await page.addInitScript(()=>{ try{ localStorage.setItem('col-tour-v1-seen','1'); }catch(e){} });
  const legacySrc = legacy ? {
    'script.js': execFileSync('git',['show',`${BASE}:costofliving-comparator/script.js`],{cwd:ROOT}).toString(),
    'index.html': execFileSync('git',['show',`${BASE}:costofliving-comparator/index.html`],{cwd:ROOT}).toString(),
  } : null;
  await page.route('**/*', route=>{
    const u=route.request().url();
    if(!u.includes('127.0.0.1')) return route.fulfill({contentType:'application/javascript', body:'/* stub */'});
    if(legacySrc && /\/costofliving-comparator\/script\.js/.test(u)) return route.fulfill({contentType:'application/javascript', body:legacySrc['script.js']});
    if(legacySrc && /\/costofliving-comparator\/index\.html/.test(u)) return route.fulfill({contentType:'text/html', body:legacySrc['index.html']});
    return route.continue();
  });
  await page.goto(PAGE, {waitUntil:'load'});
  await page.waitForFunction(()=>document.getElementById('dataUpdatedText')?.textContent.length>0);
  return page;
}

function driver(page){
  const d = {
    async pick(containerId, key){
      await page.evaluate(({containerId,key})=>{
        const wrap=document.getElementById(containerId);
        const input=wrap.querySelector('input.city-search');
        input.value=key.split('|')[0]; input.dispatchEvent(new Event('input'));
        [...wrap.querySelectorAll('.city-opt')].find(o=>o.dataset.key===key).dispatchEvent(new MouseEvent('mousedown'));
      },{containerId,key});
      await page.waitForTimeout(T);
    },
    async type(sel, v){
      await page.evaluate(({sel,v})=>{ const el=document.querySelector(sel); el.value=v;
        el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); el.dispatchEvent(new Event('blur')); },{sel,v});
      await page.waitForTimeout(T);
    },
    async select(sel, v){ await page.selectOption(sel, v); await page.waitForTimeout(T); },
    async click(sel){ await page.evaluate(sel=>document.querySelector(sel).click(), sel); await page.waitForTimeout(T); },
    async tick(on){
      await page.evaluate(on=>{ const c=document.getElementById('customFreqChk'); if(c.checked!==on){ c.checked=on; c.dispatchEvent(new Event('change',{bubbles:true})); } }, on);
      await page.waitForTimeout(T);
    },
    state: ()=>page.evaluate(()=>window.__COL_TOUR.saveState()),
    // What the Savings / Net Income rows show.
    shown: ()=>page.evaluate(()=>{
      const n=s=>parseFloat(String(s).replace(/,/g,'').replace(/[^\d.\-]/g,''));
      const savCells=[...document.querySelectorAll('tr.savings-tr td')].slice(1);
      const from=savCells[0];
      const dests=savCells.slice(1).filter(td=>td.querySelector('.sub-num'));
      const salRow=[...document.querySelectorAll('tr.salary-tr td')].slice(2);
      return {
        fSav:n(from.querySelector('div').textContent), fRatio:from.querySelector('.sub-num').textContent.trim(),
        dSav:dests.map(td=>n(td.querySelector('div').textContent)),
        dRatio:dests.map(td=>td.querySelector('.sub-num').textContent.trim()),
        req:salRow.map(td=>{const s=td.querySelector('span'); return s?n(s.textContent):null;}).filter(v=>v!=null),
        fields:[...document.querySelectorAll('table.dt input.num-input')].map(i=>i.className.split(' ').pop()+'='+i.value),
      };
    }),
  };
  return d;
}

// Every shown figure against the independent replay. Displays round to whole
// units, so half a unit (plus float dust) is the whole budget.
async function reconcile(d, label){
  const S=await d.state(), got=await d.shown(), want=replay(S);
  const bad=[];
  const near=(a,b)=>Math.abs(a-b)<=0.5+1e-6*Math.max(1,Math.abs(b));
  if(!near(got.fSav,want.fSavShown)) bad.push(`source savings ${got.fSav} vs ${want.fSavShown.toFixed(2)}`);
  if(got.fRatio!==want.fRatio.toFixed(1)+'% ratio') bad.push(`source ratio "${got.fRatio}" vs ${want.fRatio.toFixed(1)}%`);
  want.dests.forEach((w,ci)=>{
    if(!near(got.dSav[ci],w.savShown)) bad.push(`dest ${ci} savings ${got.dSav[ci]} vs ${w.savShown.toFixed(2)}`);
    if(w.ratio!=null && got.dRatio[ci]!==w.ratio.toFixed(1)+'% ratio') bad.push(`dest ${ci} ratio "${got.dRatio[ci]}" vs ${w.ratio.toFixed(1)}%`);
    if(S.goal==='earn' && !near(got.req[ci],w.reqShown)) bad.push(`dest ${ci} required ${got.req[ci]} vs ${w.reqShown.toFixed(2)}`);
  });
  check('replay: '+label, bad.length===0, bad.length?bad.join('; '):
    `source ${got.fSav}, dests ${got.dSav.join(' / ')}${S.goal==='earn'?', required '+got.req.join(' / '):''}`);
  return {S, got, want};
}
// Monthly money of every column, from state: what a unit switch must not move.
function money(S){
  const r=replay(S);
  return [r.fSal, r.fExp, ...r.dests.flatMap(x=>[x.exp, x.sal])];
}
function sameMoney(a,b){ return a.every((v,i)=>Math.abs(v-b[i])<=1e-6*Math.max(1,Math.abs(v))); }

const JKT='Jakarta|Indonesia', PER='Perth|Australia', SGP='Singapore|Singapore';
const ROWS=[
  ['rent',5000000],['groceries',2500000],['eating_out',1500000],['electricity',800000],
  ['fuel',600000],['intl_travel',2000000],['remittance',1000000],['utilities',400000],
];
// One comparison, typed the way a user types it: Jakarta to Perth and
// Singapore, eight rows and a blank one, one overridden cell.
async function build(d, page){
  await d.click('#modeGroup .seg-btn[data-val="detailed"]');
  await d.pick('dtFromPicker', JKT);
  await d.pick('dtToPicker0', PER);
  await d.click('#addCityBtn');
  await d.pick('dtToPicker1', SGP);
  for(let i=1;i<ROWS.length;i++) await d.click('#addRowBtn');
  for(let i=0;i<ROWS.length;i++){
    await d.select(`.cat-sel[data-ri="${i}"]`, ROWS[i][0]);
    await d.type(`.dt-from-exp[data-ri="${i}"]`, ROWS[i][1].toLocaleString('en-US'));
  }
  await d.click('#addRowBtn');   // and one row left blank, as a new row is
  await d.type('#dt_fs', '25,000,000');
  await d.type('.dt-to-sal[data-ci="0"]', '7,000');
  await d.type('.dt-to-sal[data-ci="1"]', '6,500');
  await d.type('.dt-to-exp[data-ri="1"][data-ci="0"]', '640');   // groceries in Perth, overridden
}
// Every cell of the table: text, and each field's value and placeholder.
const tableSnap = page => page.evaluate(()=>[...document.querySelectorAll('table.dt tbody td')].map(td=>
  td.textContent.replace(/\s+/g,' ').trim()+' | '+[...td.querySelectorAll('input')].map(i=>i.value+'~'+i.placeholder).join(',')));

/* ════════════════════════════════════════════════════════════════════════
   F1  STATUS QUO: box unticked, the table is the pre-feature table
   ════════════════════════════════════════════════════════════════════════ */
section('F1  status quo');
let legacySnaps=null;
try {
  const lp = await openPage(true); const ld = driver(lp);
  await build(ld, lp);
  legacySnaps={save:await tableSnap(lp)};
  await ld.click('#goalGroup .seg-btn[data-val="earn"]');
  legacySnaps.earnRatio=await tableSnap(lp);
  await ld.click('#dtTargetGroup .seg-btn[data-val="nominal"]');
  legacySnaps.earnNominal=await tableSnap(lp);
  await lp.close();
} catch(e){ console.log(`  (skipped: commit ${BASE} not in this clone: ${e.message.split('\n')[0]})`); }

const page = await openPage(false); const d = driver(page);
{
  const hiddenSimple = await page.evaluate(()=>getComputedStyle(document.getElementById('freqRow')).display==='none');
  await build(d, page);
  const shownDetailed = await page.evaluate(()=>getComputedStyle(document.getElementById('freqRow')).display!=='none');
  const unticked = await page.evaluate(()=>!document.getElementById('customFreqChk').checked);
  const noSelects = await page.evaluate(()=>document.querySelectorAll('table.dt .freq-sel, table.dt .dt-qty').length===0);
  check('F1a the checkbox lives in the mode card, shown in Detailed only, unticked by default',
    hiddenSimple && shownDetailed && unticked, `hidden in simple=${hiddenSimple}, shown in detailed=${shownDetailed}, unticked=${unticked}`);
  check('F1b unticked, no frequency control is drawn in the table', noSelects);
  const snaps={save:await tableSnap(page)};
  await reconcile(d,'unticked, I can save');
  await d.click('#goalGroup .seg-btn[data-val="earn"]');
  snaps.earnRatio=await tableSnap(page);
  await reconcile(d,'unticked, I need to earn, ratio target');
  await d.click('#dtTargetGroup .seg-btn[data-val="nominal"]');
  snaps.earnNominal=await tableSnap(page);
  await reconcile(d,'unticked, I need to earn, nominal target');
  if(legacySnaps){
    for(const k of Object.keys(snaps)){
      const diff=snaps[k].map((c,i)=>c===legacySnaps[k][i]?null:`cell ${i}: "${legacySnaps[k][i]}" → "${c}"`).filter(Boolean);
      check(`F1c unticked, every cell matches the pre-feature page (${k})`,
        diff.length===0 && snaps[k].length===legacySnaps[k].length,
        diff.length?diff.slice(0,3).join('; '):`${snaps[k].length} cells identical to ${BASE}`);
    }
  }
  await d.click('#dtTargetGroup .seg-btn[data-val="ratio"]');
  await d.click('#goalGroup .seg-btn[data-val="save"]');
}

/* ════════════════════════════════════════════════════════════════════════
   F2  PURE ADD-ON: ticking the box with every row monthly moves nothing
   ════════════════════════════════════════════════════════════════════════ */
section('F2  ticking the box alone moves nothing');
{
  const before = await d.shown(), sBefore = await d.state();
  await d.tick(true);
  const after = await d.shown(), sAfter = await d.state();
  const drawn = await page.evaluate(()=>({
    rows:document.querySelectorAll('.dt-unit').length, inc:!!document.getElementById('dtIncomeFreq'), sav:!!document.getElementById('dtSavingsFreq'),
    allMonthly:[...document.querySelectorAll('.dt-unit')].every(s=>s.value==='monthly'),
  }));
  check('F2a ticked, every row, Net Income and Savings gets a frequency control, all on a month',
    drawn.rows===ROWS.length+1 && drawn.inc && drawn.sav && drawn.allMonthly, JSON.stringify(drawn));
  check('F2b ticking changes no field and no figure',
    JSON.stringify(before)===JSON.stringify(after) && sameMoney(money(sBefore),money(sAfter)),
    `savings ${before.fSav} / ${before.dSav.join(' / ')} → ${after.fSav} / ${after.dSav.join(' / ')}`);
  const opts = await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('.dt-unit')].map(s=>
    [document.querySelector(`.cat-sel[data-ri="${s.dataset.ri}"]`).value,[...s.options].map(o=>o.value).join(',')])));
  const P='weekly,fortnightly,monthly,yearly';
  check('F2c each category offers the four periods, plus its own unit price',
    opts.rent===P && opts.groceries===P && opts.remittance===P && opts.utilities===P
    && opts.eating_out===P+',meal' && opts.electricity===P+',kwh'
    && opts.fuel===P+',litre,gallon' && opts.intl_travel===P+',trip', JSON.stringify(opts));
}

/* ════════════════════════════════════════════════════════════════════════
   F3  PERIODS: the field rescales, the money does not move
   ════════════════════════════════════════════════════════════════════════ */
section('F3  period rows');
{
  const field = sel => page.inputValue(sel).then(num);
  let m0 = money(await d.state());
  await d.select('.dt-unit[data-ri="0"]','weekly');
  const wk = await field('.dt-from-exp[data-ri="0"]');
  const s1 = await d.state();
  check('F3a rent 5,000,000 a month → a week: field and state say 1,153,846.15',
    wk===1153846.15 && Math.abs(s1.detailRows[0].fromAmount-5e6*12/52)<1e-6, `field ${wk}, state ${s1.detailRows[0].fromAmount}`);
  check('F3b … and no total moves', sameMoney(m0,money(s1)));
  await reconcile(d,'rent a week');
  await d.select('.dt-unit[data-ri="0"]','yearly');
  check('F3c a week → a year gives 60,000,000 exactly (no rounding carried)', await field('.dt-from-exp[data-ri="0"]')===60000000);
  await d.select('.dt-unit[data-ri="0"]','fortnightly');
  await d.select('.dt-unit[data-ri="0"]','monthly');
  const back = (await d.state()).detailRows[0].fromAmount;
  check('F3d month → week → year → fortnight → month returns exactly 5,000,000', Math.abs(back-5e6)<1e-6, `got ${back}`);
  // The overridden groceries cell is an amount in the row's unit: it follows.
  await d.select('.dt-unit[data-ri="1"]','yearly');
  const ovY = await field('.dt-to-exp[data-ri="1"][data-ci="0"]');
  check('F3e an overridden destination cell rescales with its row (AUD 640 a month → 7,680 a year)', ovY===7680, `got ${ovY}`);
  check('F3f … and no total moves', sameMoney(m0,money(await d.state())));
  await reconcile(d,'groceries a year, override included');
  // A typed amount DOES move money, and exactly by amount x multiplier.
  const before = replay(await d.state());
  await d.type('.dt-from-exp[data-ri="1"]','24,000,000');   // was 30,000,000 a year
  const after = replay(await d.state());
  check('F3g typing 24,000,000 a year adds exactly (24,000,000 − 30,000,000)/12 a month to the source',
    Math.abs((after.fExp-before.fExp)-(24e6-30e6)/12)<1e-6, `${(after.fExp-before.fExp).toFixed(2)}`);
  await reconcile(d,'typed yearly amount');
}

/* ════════════════════════════════════════════════════════════════════════
   F4  NET INCOME and SAVINGS frequency
   ════════════════════════════════════════════════════════════════════════ */
section('F4  Net Income and Savings');
{
  const m0 = money(await d.state()), sh0 = await d.shown();
  await d.select('#dtIncomeFreq','fortnightly');
  const f = await page.evaluate(()=>[document.getElementById('dt_fs').value,
    ...[...document.querySelectorAll('.dt-to-sal')].map(i=>i.value)]);
  const S = await d.state();
  check('F4a Net Income a month → a fortnight rescales source and destination salaries',
    f[0]==='11,538,461.54' && f[1]==='3,230.77' && f[2]==='3,000' && Math.abs(S.detailFromSalary-25e6*12/26)<1e-6,
    f.join(' / '));
  const sh1 = await d.shown();
  check('F4b … and moves no figure: savings and every ratio are unchanged',
    sameMoney(m0,money(S)) && sh1.fSav===sh0.fSav && JSON.stringify(sh1.dSav)===JSON.stringify(sh0.dSav)
    && JSON.stringify(sh1.dRatio)===JSON.stringify(sh0.dRatio) && sh1.fRatio===sh0.fRatio);
  await reconcile(d,'income a fortnight');

  const fieldsBefore = (await d.shown()).fields;
  for(const [p,k] of [['yearly',12],['weekly',12/52],['fortnightly',12/26],['monthly',1]]){
    await d.select('#dtSavingsFreq',p);
    const sh = await d.shown();
    const monthly = replay({...(await d.state()), detailSavingsFreq:'monthly'});
    check(`F4c Savings shown ${p}: the monthly savings × ${k.toFixed(4)}, ratios untouched, no field moves`,
      Math.abs(sh.fSav - monthly.fSavShown*k)<=0.5 && sh.dSav.every((v,i)=>Math.abs(v-monthly.dests[i].savShown*k)<=0.5)
      && sh.fRatio===sh0.fRatio && JSON.stringify(sh.dRatio)===JSON.stringify(sh0.dRatio)
      && JSON.stringify(sh.fields)===JSON.stringify(fieldsBefore),
      `source ${sh.fSav}, dests ${sh.dSav.join(' / ')}`);
  }
  await d.select('#dtSavingsFreq','yearly');
  await reconcile(d,'savings a year, income a fortnight');
}

/* ════════════════════════════════════════════════════════════════════════
   F5  UNIT PRICES: price x quantity, defaults as specified
   ════════════════════════════════════════════════════════════════════════ */
section('F5  unit prices');
{
  const qtyOf = ri => page.evaluate(ri=>({q:document.querySelector(`.dt-qty[data-ri="${ri}"]`)?.value,
    p:document.querySelector(`.dt-qty-per[data-ri="${ri}"]`)?.value}), ri);
  const cases = [
    [2,'meal', '2','weekly', 1500000/(2*52/12), 'eating out: 2 meals a week'],
    [3,'kwh',  '450','monthly', 800000/450, 'electricity: 450 kWh a month'],
    [4,'litre','75','monthly', 600000/75, 'fuel: 75 litres a month'],
    [5,'trip', '2','yearly', 2000000/(2/12), 'international travel: 2 trips a year'],
  ];
  for(const [ri,unit,q,per,price,label] of cases){
    const m0 = money(await d.state());
    await d.select(`.dt-unit[data-ri="${ri}"]`, unit);
    const S = await d.state(), qy = await qtyOf(ri);
    check(`F5 ${label} by default; the price is the monthly figure over that`,
      qy.q===q && qy.p===per && Math.abs(S.detailRows[ri].fromAmount-price)<1e-6 && sameMoney(m0,money(S)),
      `qty ${qy.q} a ${qy.p}, price ${S.detailRows[ri].fromAmount.toFixed(4)} (want ${price.toFixed(4)}), money kept=${sameMoney(m0,money(S))}`);
  }
  // Destination prices are per unit too: the index applies to the unit price.
  const S = await d.state();
  const perth = await page.inputValue('.dt-to-exp[data-ri="2"][data-ci="0"]');
  const want = estimate(S.detailRows[2].fromAmount, CITY[JKT], CITY[PER], 'eating_out');
  check('F5e Perth\'s cell is a price per meal, estimated from the source price per meal',
    Math.abs(num(perth)-want)<0.005, `shown ${perth}, replay ${want.toFixed(4)}`);
  const totalLine = await page.evaluate(()=>document.querySelector('.dt-to-exp[data-ri="2"][data-ci="0"]').closest('td').textContent);
  check('F5f a unit-priced cell says what it comes to over the quantity\'s period',
    /= AUD [\d,]+ a week/.test(totalLine), totalLine.replace(/\s+/g,' ').trim());
  await reconcile(d,'four unit-priced rows');

  // Litre <-> gallon is the same fuel in another measure.
  const m0 = money(await d.state());
  await d.select('.dt-unit[data-ri="4"]','gallon');
  const g = await d.state(), gq = await qtyOf(4);
  check('F5g per litre → per gallon: 75 litres become 19.8129 US gallons and the price × 3.7854',
    gq.q==='19.8129' && Math.abs(g.detailRows[4].qty-75/GAL)<1e-9 && Math.abs(g.detailRows[4].fromAmount-8000*GAL)<1e-6 && sameMoney(m0,money(g)),
    `qty ${gq.q}, price ${g.detailRows[4].fromAmount.toFixed(4)}`);
  await d.select('.dt-unit[data-ri="4"]','litre');
  const l = await d.state();
  check('F5h … and back to litres returns exactly 75 at 8,000',
    Math.abs(l.detailRows[4].qty-75)<1e-9 && Math.abs(l.detailRows[4].fromAmount-8000)<1e-6);
  await d.select('.dt-unit[data-ri="4"]','gallon');
}

/* ════════════════════════════════════════════════════════════════════════
   F6  QUANTITY: the one input besides an amount that moves money
   ════════════════════════════════════════════════════════════════════════ */
section('F6  quantities');
{
  const S0 = await d.state(), r0 = replay(S0), price = S0.detailRows[2].fromAmount;
  await d.type('.dt-qty[data-ri="2"]','4');
  const r1 = replay(await d.state());
  check('F6a 2 → 4 meals a week adds exactly price × 2 × 52/12 to the source',
    Math.abs((r1.fExp-r0.fExp)-price*2*52/12)<1e-6, `${(r1.fExp-r0.fExp).toFixed(2)} vs ${(price*2*52/12).toFixed(2)}`);
  await reconcile(d,'4 meals a week');
  const m0 = money(await d.state());
  await d.select('.dt-qty-per[data-ri="2"]','monthly');
  const q = await page.inputValue('.dt-qty[data-ri="2"]');
  check('F6b 4 meals a week → a month shows 17.3333 and moves no money',
    q==='17.3333' && sameMoney(m0,money(await d.state())), `qty field ${q}`);
  // 2 trips a year a week is 0.0385; carrying the rounded figure would book
  // 2.002 trips a year. The state keeps the exact figure.
  const m1 = money(await d.state());
  await d.select('.dt-qty-per[data-ri="5"]','weekly');
  await d.select('.dt-qty-per[data-ri="5"]','yearly');
  const t = await d.state();
  check('F6c 2 trips a year → a week → a year is still exactly 2, and no money moved',
    Math.abs(t.detailRows[5].qty-2)<1e-9 && sameMoney(m1,money(t)), `qty ${t.detailRows[5].qty}`);
  await d.type('.dt-qty[data-ri="3"]','0');
  const z = replay(await d.state());
  const zr = replay({...(await d.state()), detailRows:(await d.state()).detailRows.filter((_,i)=>i!==3)});
  check('F6d a quantity of 0 makes the row cost nothing', Math.abs(z.fExp-zr.fExp)<1e-6);
  await d.type('.dt-qty[data-ri="3"]','450');
}

/* ════════════════════════════════════════════════════════════════════════
   F7  OVERRIDES and CATEGORY changes on unit-priced rows
   ════════════════════════════════════════════════════════════════════════ */
section('F7  overrides and category changes');
{
  await d.type('.dt-to-exp[data-ri="2"][data-ci="0"]','25');   // AUD 25 a meal in Perth
  const S = await d.state(), r = replay(S);
  check('F7a a Perth override of AUD 25 a meal is booked as 25 × meals a month',
    S.detailRows[2].overrides['0']===25, `override ${S.detailRows[2].overrides['0']}, qty ${S.detailRows[2].qty} a ${S.detailRows[2].qtyPer}`);
  await reconcile(d,'overridden price per meal');
  const m0 = money(S);
  await d.select('.dt-unit[data-ri="2"]','weekly');
  const w = await d.state();
  check('F7b per meal → per week: the override becomes 25 × 17.3333 × 12/52 = AUD 100 a week, money kept',
    Math.abs(w.detailRows[2].overrides['0']-100)<1e-9 && sameMoney(m0,money(w)), `override ${w.detailRows[2].overrides['0']}`);
  await d.select('.dt-unit[data-ri="2"]','meal');
  const back = await d.state();
  check('F7c … and back to per meal remembers 17.3333 meals a month and AUD 25',
    Math.abs(back.detailRows[2].qty-52/3)<1e-9 && Math.abs(back.detailRows[2].overrides['0']-25)<1e-9 && sameMoney(m0,money(back)));
  // Groceries has no per-meal price: the row goes to a month, money intact.
  const m1 = money(back);
  await d.select('.cat-sel[data-ri="2"]','groceries');
  const g = await d.state();
  const unitNow = await page.inputValue('.dt-unit[data-ri="2"]');
  check('F7d changing a per-meal row to Groceries moves it to a month and keeps its money',
    unitNow==='monthly' && g.detailRows[2].unit==='monthly' && replay(g).fExp===replay(g).fExp && Math.abs(replay(g).fExp-replay(back).fExp)<1e-6,
    `unit ${unitNow}; source expenses a month ${replay(back).fExp.toFixed(2)} → ${replay(g).fExp.toFixed(2)}`);
  await d.select('.cat-sel[data-ri="2"]','eating_out');
  await d.select('.dt-unit[data-ri="2"]','meal');
  await reconcile(d,'row back to eating out per meal');
}

/* ════════════════════════════════════════════════════════════════════════
   F8  I NEED TO EARN: the required salary is quoted per the income period
   ════════════════════════════════════════════════════════════════════════ */
section('F8  required salary');
{
  await d.click('#goalGroup .seg-btn[data-val="earn"]');
  for(const target of ['ratio','nominal']){
    await d.click(`#dtTargetGroup .seg-btn[data-val="${target}"]`);
    for(const p of ['weekly','yearly','fortnightly']){
      await d.select('#dtIncomeFreq',p);
      await reconcile(d,`earn, ${target} target, income per ${p}`);
    }
  }
  const S = await d.state(), r = replay(S);
  const reqMonthly = r.dests.map(x=>x.sal);
  await d.select('#dtIncomeFreq','monthly');
  const r2 = replay(await d.state()), shown = await d.shown();
  check('F8a the required salary is the same money whatever period quotes it',
    reqMonthly.every((v,i)=>Math.abs(v-r2.dests[i].sal)<1e-6) && shown.req.every((v,i)=>Math.abs(v-r2.dests[i].sal)<=0.5),
    `required a month ${shown.req.join(' / ')}`);
  await d.click('#dtTargetGroup .seg-btn[data-val="ratio"]');
  await d.click('#goalGroup .seg-btn[data-val="save"]');
  await d.select('#dtIncomeFreq','fortnightly');
}

/* ════════════════════════════════════════════════════════════════════════
   F9  UNTICK and TICK again, and a reload
   ════════════════════════════════════════════════════════════════════════ */
section('F9  switching the feature off and on');
{
  const S0 = await d.state(), m0 = money(S0);
  const units0 = S0.detailRows.map(r=>r.unit).join(',');
  await d.tick(false);
  const S1 = await d.state();
  const ui = await page.evaluate(()=>document.querySelectorAll('table.dt .freq-sel, table.dt .dt-qty').length);
  check('F9a unticked: every row and Net Income go back to a month, with no control left in the table',
    S1.detailRows.every(r=>r.unit==='monthly') && S1.detailIncomeFreq==='monthly' && ui===0,
    `units ${S1.detailRows.map(r=>r.unit).join(',')}, income ${S1.detailIncomeFreq}`);
  check('F9b … and every column keeps its money (savings shown a month again)', sameMoney(m0,money(S1)));
  await reconcile(d,'unticked after use');
  const eatM = S1.detailRows[2].fromAmount;
  check('F9c the per-meal row now reads as its monthly bill', Math.abs(eatM - S0.detailRows[2].fromAmount*S0.detailRows[2].qty*PER_YEAR[S0.detailRows[2].qtyPer]/12)<1e-6,
    `${eatM.toFixed(2)} a month`);
  await d.tick(true);
  const S2 = await d.state();
  check('F9d ticked again: each row gets its unit back, money unchanged',
    S2.detailRows.map(r=>r.unit).join(',')===units0 && S2.detailIncomeFreq==='fortnightly' && sameMoney(m0,money(S2)),
    `units ${S2.detailRows.map(r=>r.unit).join(',')}`);
  await reconcile(d,'ticked again');

  // Reload: the mini cache brings the whole thing back.
  await page.waitForTimeout(600);
  const shownBefore = await d.shown();
  await page.reload({waitUntil:'load'});
  await page.waitForFunction(()=>document.getElementById('dataUpdatedText')?.textContent.length>0);
  await page.waitForTimeout(200);
  const ticked = await page.evaluate(()=>document.getElementById('customFreqChk').checked);
  const shownAfter = await d.shown();
  check('F9e a reload restores the ticked box, the units and every figure',
    ticked && JSON.stringify(shownAfter)===JSON.stringify(shownBefore), `ticked=${ticked}`);
}

/* ════════════════════════════════════════════════════════════════════════
   F10  PROPERTY SWEEP: 60 random unit and period switches, zero drift
   ════════════════════════════════════════════════════════════════════════ */
section('F10  random switches');
{
  let seed = 20260923;
  const rnd = n => { seed = (seed*1103515245+12345) & 0x7fffffff; return seed % n; };
  const m0 = money(await d.state());
  const S = await d.state();
  let drift = [], moves = [];
  for(let i=0;i<60;i++){
    const kind = rnd(4);
    let sel, v;
    if(kind===0){ sel='#dtIncomeFreq'; v=Object.keys(PER_YEAR)[rnd(4)]; }
    else if(kind===1){ sel='#dtSavingsFreq'; v=Object.keys(PER_YEAR)[rnd(4)]; }
    else {
      const ri = rnd(ROWS.length);
      const cat = S.detailRows[ri].catId;
      const units = Object.keys(PER_YEAR).concat(Object.keys(UNIT_CAT).filter(u=>UNIT_CAT[u]===cat));
      const isUnit = await page.$(`.dt-qty-per[data-ri="${ri}"]`);
      if(kind===3 && isUnit){ sel=`.dt-qty-per[data-ri="${ri}"]`; v=Object.keys(PER_YEAR)[rnd(4)]; }
      else { sel=`.dt-unit[data-ri="${ri}"]`; v=units[rnd(units.length)]; }
    }
    await d.select(sel, v);
    moves.push(`${sel}=${v}`);
    const m = money(await d.state());
    if(!sameMoney(m0,m)) drift.push(`after ${i+1} (${sel}=${v})`);
  }
  check('F10a 60 random switches of unit, quantity period, income and savings period move no money',
    drift.length===0, drift.length?drift.slice(0,3).join('; '):`${moves.length} switches`);
  await reconcile(d,'after the sweep');
}

await browser.close();
server.close();
console.log(`\ncustom frequency audit: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
