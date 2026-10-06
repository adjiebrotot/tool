// Cross-tool check: a per-period amount follows its frequency.
//
// Every tool that pairs a money field with a frequency control has to rescale
// the money when the control moves — $500 a month is $6,000 a year, and leaving
// the 500 alone would silently restate the plan by a factor of twelve. This
// drives the real pages headless and checks each pair: the arithmetic, the
// rounding back to the field's own precision, the bases that are not periods
// at all (a "% of value" cost is left as typed), and that the tool's own state
// moved with the field rather than just its markup.
//
// Run: node _ref/freq-check.mjs
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = p => pathToFileURL(join(ROOT, p)).href;

const CHART_STUB = `
class Chart { constructor(c,cfg){ this.config=cfg; this.data=(cfg&&cfg.data)||{datasets:[]}; this.options=(cfg&&cfg.options)||{}; this.scales=this.options.scales||{}; }
  update(){} destroy(){} resetZoom(){} zoomScale(){} isDatasetVisible(){return true;} setDatasetVisibility(){} }
Chart.register=function(){}; Chart.Interaction={modes:{}}; Chart.helpers={getRelativePosition:e=>e};
window.Chart=Chart;`;

let pass=0, fail=0;
const check=(name, got, want)=>{
  const ok = String(got)===String(want);
  console.log((ok?'  PASS  ':'✗ FAIL  ')+name+'  — got '+JSON.stringify(got)+(ok?'':' want '+JSON.stringify(want)));
  ok?pass++:fail++;
};

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
  // The guided tour offers itself on a first visit and its backdrop eats clicks.
  // Every tour reads "<tool>-tour-v<N>-seen", and N moves whenever a tour is
  // rewritten, so any such key reads as seen rather than a list that goes stale.
  await page.addInitScript(()=>{
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function(k){ return /-tour-v\d+-seen$/.test(k) ? '1' : get.call(this, k); };
  });
  await page.goto(url(rel), {waitUntil:'load'});
  await page.evaluate(()=>{ document.querySelectorAll('[class*="tour-backdrop"],[class*="tour-pop"],[class*="tour-offer"]').forEach(n=>n.remove()); });
  await page.waitForTimeout(250);
  return page;
}
// selectOption fires input + change the way a real user does.
const setSel=(page,id,v)=>page.selectOption('#'+id, v);
const val=(page,id)=>page.inputValue('#'+id);

/* ── shared arithmetic ─────────────────────────────────────────────── */
{
  const page = await open('financialfreedom/index.html');
  const c = await page.evaluate(()=>[
    SharedFreq.convert(500,'monthly','yearly',2),
    SharedFreq.convert(500,'weekly','monthly',2),
    SharedFreq.convert(500,'weekly','monthly',0),
    SharedFreq.convert(500,'monthly','monthly',2),
    SharedFreq.convert(100,'yearly','pct',2),
    SharedFreq.convert(100,'fixed','monthly',2),
    SharedFreq.convert(1000,'yearly','fortnightly',2),
    SharedFreq.convert(1000,'quarterly','daily',2)
  ]);
  check('convert 500 monthly->yearly', c[0], 6000);
  check('convert 500 weekly->monthly (2dp)', c[1], 2166.67);
  check('convert 500 weekly->monthly (0dp)', c[2], 2167);
  check('convert same period is a no-op', c[3], 500);
  check('convert to a non-period basis is null', c[4], null);
  check('convert from a non-period basis is null', c[5], null);
  check('convert 1000 yearly->fortnightly', c[6], 38.46);
  check('convert 1000 quarterly->daily', c[7], 10.96);

  /* ── financialfreedom (0 decimals) ───────────────────────────────── */
  check('ff expense starts at 60,000 a year', await val(page,'expense'), '60,000');
  await setSel(page,'expensePeriod','monthly');
  check('ff 60,000 a year -> a month', await val(page,'expense'), '5,000');
  await setSel(page,'expensePeriod','weekly');
  check('ff 5,000 a month -> a week', await val(page,'expense'), '1,154');
  await setSel(page,'expensePeriod','yearly');
  check('ff 1,154 a week -> a year', await val(page,'expense'), '60,008');
  await setSel(page,'savingsPeriod','monthly');
  check('ff savings 30,000 a year -> a month', await val(page,'savings'), '2,500');
  // The pension rows sit under Money in, on the You tab.
  await page.click('.ctrl-tab[data-tab="you"]');
  await page.evaluate(()=>{ const c=document.getElementById('pensionOn'); c.checked=true; c.dispatchEvent(new Event('change',{bubbles:true})); });
  await page.waitForTimeout(100);
  await setSel(page,'pensionPeriod','monthly');
  check('ff pension 29,000 a year -> a month', await val(page,'pensionAmount'), '2,417');
  // A Quick Start sets both fields at once; the next user change must convert
  // from the period the preset left behind, not the one before it.
  await page.click('.ctrl-tab[data-tab="you"]');
  await page.evaluate(()=>{ document.querySelector('.quick-start-btn').click(); });
  await page.waitForTimeout(150);
  const qsExpense = await val(page,'expense'), qsPeriod = await page.inputValue('#expensePeriod');
  await setSel(page,'expensePeriod', qsPeriod==='yearly'?'monthly':'yearly');
  const after = await val(page,'expense');
  const want = qsPeriod==='yearly'
    ? String(Math.round(Number(qsExpense.replace(/,/g,''))/12).toLocaleString('en-US'))
    : String(Math.round(Number(qsExpense.replace(/,/g,''))*12).toLocaleString('en-US'));
  check('ff converts from the period a Quick Start left', after, want);

  /* Retirement expenses and each life stage take a share of living as well as
     a period. Between two periods the figure is rescaled; to or from a share
     it is converted through today's living expenses, read off the form. */
  await page.evaluate(()=>{ window.__FF.resetToDefaults(); });
  check('ff retirement expenses start at 100% of living', await val(page,'retireExpense'), '100');
  await setSel(page,'retireExpensePeriod','yearly');
  check('ff 100% of 60,000 a year -> a year', await val(page,'retireExpense'), '60,000');
  await setSel(page,'retireExpensePeriod','weekly');
  check('ff 60,000 a year -> a week', await val(page,'retireExpense'), '1,154');
  await setSel(page,'retireExpensePeriod','pct');
  check('ff 1,154 a week -> % of living', await val(page,'retireExpense'), '100');
  check('ff the engine reads the share it shows',
    await page.evaluate(()=>window.__FF.UI.retireExpense+' '+window.__FF.UI.retireExpensePeriod), '100 pct');
  await page.click('#expenseModeGroup .seg-btn[data-val="detailed"]');
  await page.click('#addStage');
  await page.selectOption('#stageRows .stage-basis', 'monthly');
  check('ff a stage at 100% of living -> a month', await page.inputValue('#stageRows .stage-amount'), '5,000');
  await page.selectOption('#stageRows .stage-basis', 'yearly');
  check('ff a stage at 5,000 a month -> a year', await page.inputValue('#stageRows .stage-amount'), '60,000');
  check('ff and the stage the engine runs moved with it',
    await page.evaluate(()=>{ const s=window.__FF.UI.stages[0]; return s.amount+' '+s.period; }), '60000 yearly');
  await page.close();
}

/* ── rentvsownhouse (2 decimals, pct basis, detailed rows) ─────────── */
{
  const page = await open('rentvsownhouse/index.html');
  await page.click('.ctrl-tab[data-tab="rent"]');
  check('rvo rent starts at 2,800 a month', await val(page,'rentAmount'), '2,800');
  await setSel(page,'rentFreq','weekly');
  check('rvo 2,800 a month -> a week', await val(page,'rentAmount'), '646.15');
  await setSel(page,'rentFreq','yearly');
  check('rvo 646.15 a week -> a year', await val(page,'rentAmount'), '33,599.8');
  await page.click('.ctrl-tab[data-tab="own"]');
  await setSel(page,'ownOngoingCostFreq','monthly');
  check('rvo own ongoing 6,000 a year -> a month', await val(page,'ownOngoingCost'), '500');
  // On a "% of property value" basis the figure is a percentage, not money.
  await setSel(page,'ownOngoingCostType','pct');
  await page.fill('#ownOngoingCost','1.5');
  await setSel(page,'ownOngoingCostFreq','yearly');
  check('rvo a % basis is left alone', await val(page,'ownOngoingCost'), '1.5');
  await setSel(page,'ownOngoingCostType','dollar');

  // Detailed cost rows.
  await page.click('.ctrl-tab[data-tab="rent"]');
  await page.click('#rentCostsModeGroup .seg-btn[data-val="detailed"]');
  await page.waitForTimeout(150);
  const row = '#rentOngoingCostRows .cost-item-row:first-child';
  await page.fill(row+' .ci-amount','1,200');
  await page.selectOption(row+' .ci-basis','monthly');
  check('rvo detailed row 1,200 a year -> a month', await page.inputValue(row+' .ci-amount'), '100');
  await page.selectOption(row+' .ci-basis','weekly');
  check('rvo detailed row 100 a month -> a week', await page.inputValue(row+' .ci-amount'), '23.08');
  await page.selectOption(row+' .ci-basis','pct');
  check('rvo detailed row -> % basis left alone', await page.inputValue(row+' .ci-amount'), '23.08');
  await page.close();
}

/* ── rentvsownhouse, Indonesian page ───────────────────────────────── */
{
  // The /id/ page is the same script.js against a baked translation, so the
  // conversion has to survive the translated option labels.
  const page = await open('rentvsownhouse/id/index.html');
  await page.click('.ctrl-tab[data-tab="rent"]');
  check('rvo-id rent starts at 2,800 a month', await val(page,'rentAmount'), '2,800');
  await setSel(page,'rentFreq','weekly');
  check('rvo-id 2,800 a month -> a week', await val(page,'rentAmount'), '646.15');
  await page.close();
}

/* ── rentvsownhouse sensitivity ────────────────────────────────────── */
{
  const SharedFreqPerYear = {yearly:1, monthly:12, weekly:52};
  const page = await open('rentvsownhouse/sensitivity/index.html');
  const amt  = '.param-input[data-key="rentAmount"][data-si="0"]';
  const freq = '.param-select[data-key="rentFreq"][data-si="0"]';
  const before = await page.inputValue(amt);
  await page.selectOption(freq,'weekly');
  await page.waitForTimeout(200);
  const n = Number(String(before).replace(/,/g,''));
  const want = (Math.round(n*12/52*100)/100).toLocaleString('en-US',{maximumFractionDigits:2});
  check('sens rent a month -> a week', await page.inputValue(amt), want);
  await page.selectOption(freq,'monthly');
  await page.waitForTimeout(200);
  check('sens rent a week -> a month', Number(String(await page.inputValue(amt)).replace(/,/g,'')) > n*0.99, true);

  const cAmt  = '.param-input[data-key="ownOngoingCost"][data-si="0"]';
  const cFreq = '.param-select[data-key="ownOngoingCostFreq"][data-si="0"]';
  const cType = '.param-select[data-key="ownOngoingCostType"][data-si="0"]';
  const c0 = Number(String(await page.inputValue(cAmt)).replace(/,/g,''));
  await page.selectOption(cFreq,'monthly');
  await page.waitForTimeout(200);
  check('sens own cost a year -> a month',
    Number(String(await page.inputValue(cAmt)).replace(/,/g,'')), Math.round(c0/12*100)/100);
  // Money and "%" convert too, against what the "%" is a share of: 500 a
  // month of owning costs on the default 800,000 home is 0.75% of its value.
  await page.selectOption(cType,'pct');
  await page.waitForTimeout(200);
  check('sens own cost 500 a month -> % of property value', await page.inputValue(cAmt), '0.75');
  // A "%" cost is not money per period, so it offers no frequency to move.
  check('sens a % cost has no frequency to move', await page.locator(cFreq).count(), 0);
  await page.selectOption(cType,'dollar');
  await page.waitForTimeout(200);
  check('sens own cost % of property value -> 500 a month', await page.inputValue(cAmt), '500');
  check('sens own cost keeps its frequency through a % round trip', await page.inputValue(cFreq), 'monthly');

  const sAmt  = '.param-input[data-key="setupCost"][data-si="0"]';
  const sType = '.param-select[data-key="setupCostType"][data-si="0"]';
  await page.selectOption(sType,'pct');
  await page.waitForTimeout(200);
  check('sens setup cost 32,000 -> % of an 800,000 price', await page.inputValue(sAmt), '4');
  await page.selectOption(sType,'dollar');
  await page.waitForTimeout(200);
  check('sens setup cost 4% of price -> 32,000', await page.inputValue(sAmt), '32,000');

  // Renting costs are a share of a year of rent (2,800 a month here).
  const rcAmt  = '.param-input[data-key="rentOngoingCost"][data-si="0"]';
  const rcType = '.param-select[data-key="rentOngoingCostType"][data-si="0"]';
  await page.selectOption(rcType,'pct');
  await page.waitForTimeout(200);
  check('sens rent cost 1,200 a year -> % of yearly rent', await page.inputValue(rcAmt), '3.57');
  // The "%" holds two decimals (as the main page's field does), so the way
  // back lands within 0.005% of a year of rent, not always on the cent.
  await page.selectOption(rcType,'dollar');
  await page.waitForTimeout(200);
  check('sens rent cost % of yearly rent -> back to about 1,200 a year',
    Math.abs(Number(String(await page.inputValue(rcAmt)).replace(/,/g,'')) - 1200) <= 33600*0.00005, true);

  // Detailed per-scenario cost rows.
  await page.evaluate(()=>document.querySelector('.mode-seg[data-mode-key="rentCostsMode"] .seg-btn[data-val="detailed"]').click());
  await page.waitForTimeout(200);
  const rowAmt   = '.ci-amt[data-si="0"][data-idx="0"]';
  const rowBasis = '.ci-basis[data-si="0"][data-idx="0"]';
  const d0 = Number(String(await page.inputValue(rowAmt)).replace(/,/g,''));
  const b0 = await page.inputValue(rowBasis);
  await page.selectOption(rowBasis, b0==='yearly' ? 'monthly' : 'yearly');
  await page.waitForTimeout(200);
  const d1 = Number(String(await page.inputValue(rowAmt)).replace(/,/g,''));
  check('sens detailed cost row rescales with its basis',
    d1, b0==='yearly' ? Math.round(d0/12*100)/100 : Math.round(d0*12*100)/100);
  // …and restates as a "%" of a year of rent.
  const b1 = await page.inputValue(rowBasis);
  const yearRent = Number(String(await page.inputValue(amt)).replace(/,/g,''))*12; // rent is back to a month
  await page.selectOption(rowBasis, 'pct');
  await page.waitForTimeout(200);
  check('sens detailed cost row money -> % of yearly rent',
    Number(await page.inputValue(rowAmt)), Math.round(d1*SharedFreqPerYear[b1]/yearRent*100*100)/100);
  await page.close();
}

/* ── dcasimulator portfolio ────────────────────────────────────────── */
{
  const page = await open('dcasimulator/portfolio/index.html');
  await page.click('.ctrl-tab[data-tab="portfolios"]');
  await page.click('.sub-tab[data-sub="topups"]');
  check('pf top-up starts at 5,000 a month', await val(page,'topupAmount'), '5,000');
  await setSel(page,'topupPeriod','yearly');
  check('pf 5,000 a month -> a year', await val(page,'topupAmount'), '60,000');
  await setSel(page,'topupPeriod','fortnightly');
  check('pf 60,000 a year -> a fortnight', await val(page,'topupAmount'), '2,307.69');
  // Proves the portfolio's own state moved with the field, not just the input:
  // a second portfolio and back repopulates the form from state.
  await page.click('#addPortfolioBtn');
  await page.waitForTimeout(120);
  await page.click('#portfolioTabs .pf-tab:first-child .pf-tab-name');
  await page.waitForTimeout(120);
  check('pf state follows the field', await val(page,'topupAmount'), '2,307.69');
  check('pf period follows the field', await page.inputValue('#topupPeriod'), 'fortnightly');
  await page.close();
}

/* ── dcasimulator scenario frequency toggle ────────────────────────── */
{
  const page = await open('dcasimulator/index.html');
  await page.click('.ctrl-tab[data-tab="securities"]');
  await page.click('#addScenarioBtn');
  await page.waitForTimeout(200);
  // A momentum style is one of the two families that carry the Monthly/Weekly
  // Frequency control; the date-based styles carry their own cadence.
  await page.evaluate(()=>{
    const pill=[...document.querySelectorAll('.cat-pill')].find(p=>/momentum/i.test(p.textContent));
    if(pill) pill.click();
  });
  await page.waitForTimeout(150);
  await page.evaluate(()=>{
    const r=[...document.querySelectorAll('input[name^="secStyle"]')].find(x=>/top|bottom|dip|momentum/i.test(x.value));
    if(r){ r.checked=true; r.dispatchEvent(new Event('change',{bubbles:true})); }
  });
  await page.waitForTimeout(200);
  const seen = await page.evaluate(()=>!!document.querySelector('[id^="secPeriodSeg"]'));
  check('dca scenario shows a Frequency toggle', seen, true);
  if(seen){
    await page.fill('#cfgAmount','500');
    await page.evaluate(()=>{ document.querySelector('[id^="secPeriodSeg"] .seg-btn[data-period="weekly"]').click(); });
    await page.waitForTimeout(150);
    check('dca 500 a month -> a week', await val(page,'cfgAmount'), '115.38');
    await page.evaluate(()=>{ document.querySelector('[id^="secPeriodSeg"] .seg-btn[data-period="monthly"]').click(); });
    await page.waitForTimeout(150);
    check('dca 115.38 a week -> a month', await val(page,'cfgAmount'), '499.98');
    await page.evaluate(()=>{ document.querySelector('[id^="secPeriodSeg"] .seg-btn[data-period="monthly"]').click(); });
    await page.waitForTimeout(150);
    check('dca re-picking the same period is a no-op', await val(page,'cfgAmount'), '499.98');
  }
  await page.close();
}

await browser.close();
console.log('\nFrequency check: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
