// Drives the REAL Rent-vs-Own app in headless Chromium, sets each case's inputs
// through the live DOM, and captures the app's own CSV export (full app logic,
// whole-dollar precision) for own / rent / rtb. Writes audit/js_out/*.csv.
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(readFileSync(join(HERE, 'cases.json'), 'utf8'));
mkdirSync(join(HERE, 'js_out'), { recursive: true });
const pageUrl = pathToFileURL(join(HERE, '..', 'index.html')).href;

const RANGE = new Set(['downPaymentPct','monthlyBudgetIncrease','riskFreeRate','horizon',
  'mortgageRate','mortgageTerm','houseGrowth','ownOngoingInflation','rentInflation',
  'rentOngoingInflation','rtbBuyYear']);
const TEXT = new Set(['propertyPrice','monthlyBudget','setupCost','ownOngoingCost',
  'rentAmount','rentOngoingCost','initialCash']);
const SELECT = new Set(['setupCostType','ownOngoingCostFreq','ownOngoingCostType',
  'rentFreq','rentOngoingCostFreq','rentOngoingCostType']);

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto(pageUrl, { waitUntil: 'networkidle' });

// Capture CSV instead of triggering a download.
await page.evaluate(() => {
  window.__csv = null;
  const orig = RVOExport.downloadCSV;
  RVOExport.downloadCSV = (fn, txt) => { window.__csv = txt; };
});

async function setInputs(c) {
  await page.evaluate((c) => {
    const fire = el => { ['input','change'].forEach(t => el.dispatchEvent(new Event(t, {bubbles:true}))); };
    const set = (id, v) => { const el = document.getElementById(id); if(!el) return; el.value = String(v); fire(el); };
    const RANGE=['downPaymentPct','monthlyBudgetIncrease','riskFreeRate','horizon','mortgageRate','mortgageTerm','houseGrowth','ownOngoingInflation','rentInflation','rentOngoingInflation','rtbBuyYear'];
    const TEXT=['propertyPrice','monthlyBudget','setupCost','ownOngoingCost','rentAmount','rentOngoingCost','initialCash'];
    const SELECT=['setupCostType','ownOngoingCostFreq','ownOngoingCostType','rentFreq','rentOngoingCostFreq','rentOngoingCostType'];

    // detailed mortgage mode (needed for IO / explicit cost toggle)
    const wantDetailed = c.mode === 'detailed';
    const seg = document.querySelector('#mortgageModeGroup .seg-btn[data-val="'+(wantDetailed?'detailed':'simple')+'"]');
    if (seg) seg.click();

    [...TEXT, ...RANGE, ...SELECT].forEach(k => { if (c[k] !== undefined) set(k, c[k]); });

    // checkboxes
    const rtb = document.getElementById('rtbEnabled');
    if (rtb) { rtb.checked = !!c.rtbEnabled; rtb.dispatchEvent(new Event('change',{bubbles:true})); }
    if (c.rtbEnabled) set('rtbBuyYear', c.rtbBuyYear);

    if (wantDetailed) {
      // mortgage type radio
      const r = document.querySelector('input[name="mortgageType"][value="'+c.mortgageType+'"]');
      if (r) { r.checked = true; r.dispatchEvent(new Event('change',{bubbles:true})); }
      const ci = document.getElementById('costInterestOnly');
      if (ci) { ci.checked = !!c.costInterestOnly; ci.dispatchEvent(new Event('change',{bubbles:true})); }
      // collapse rate schedule to a single fixed period at mortgageRate
      let guard = 0;
      while (document.querySelectorAll('#ratePeriodRows .rate-period-row').length > 1 && guard++ < 10) {
        const del = document.querySelector('#ratePeriodRows .rate-period-row .rp-delete:not([disabled])');
        if (!del) break; del.click();
      }
      const row = document.querySelector('#ratePeriodRows .rate-period-row');
      if (row) {
        const ty = row.querySelector('.rp-type'); if (ty) { ty.value='fixed'; ty.dispatchEvent(new Event('change',{bubbles:true})); }
        const rt = row.querySelector('.rp-rate'); if (rt) { rt.value=String(c.mortgageRate); ['input','change'].forEach(t=>rt.dispatchEvent(new Event(t,{bubbles:true}))); }
      }
    }
  }, c);
  await page.waitForTimeout(60);
}

async function grabCsv(table) {
  await page.evaluate((table) => {
    window.__csv = null;
    const tab = document.querySelector('[data-table="'+table+'"]');
    if (tab) tab.click();
  }, table);
  await page.waitForTimeout(20);
  return await page.evaluate(() => {
    document.getElementById('downloadBtn').click();
    return window.__csv;
  });
}

for (const c of cases) {
  await setInputs(c);
  const own = await grabCsv('own');
  const rent = await grabCsv('rent');
  // strip the leading "# watermark" comment line so it diffs cleanly vs python
  const clean = s => (s||'').split('\n').filter(l => !l.startsWith('#')).join('\n');
  writeFileSync(join(HERE, 'js_out', `${c.name}_own.csv`), clean(own));
  writeFileSync(join(HERE, 'js_out', `${c.name}_rent.csv`), clean(rent));
  if (c.rtbEnabled) {
    const rtb = await grabCsv('rtb');
    writeFileSync(join(HERE, 'js_out', `${c.name}_rtb.csv`), clean(rtb));
  }
  console.log('done', c.name);
}

await browser.close();
