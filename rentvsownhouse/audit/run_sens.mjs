// Drives the REAL sensitivity sub-tool in headless Chromium across the SAME
// cases.json matrix as run_js.mjs, and captures its own CSV export for
// own / rent. Writes audit/sens_out/*.csv so compare.py can diff the
// sensitivity engine against the independent Python oracle (py_out/*.csv).
//
// The sensitivity tool has no Rent-then-Buy scenario, so RTB cases are skipped.
// Each case gets a FRESH page with localStorage cleared: the mini cache and the
// per-scenario detailed lists are sticky, and a leaked input from a previous
// case silently invalidates the comparison.
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(readFileSync(join(HERE, 'cases.json'), 'utf8'));
mkdirSync(join(HERE, 'sens_out'), { recursive: true });
const url = pathToFileURL(join(HERE, '..', 'sensitivity', 'index.html')).href;

// Keys the sensitivity table exposes as plain params (simple mode).
const SIMPLE = ['horizon','riskFreeRate','initialCash','monthlyBudget','monthlyBudgetIncrease',
  'propertyPrice','downPaymentPct','mortgageTerm','mortgageRate','houseGrowth',
  'setupCost','setupCostType','ownOngoingCost','ownOngoingCostFreq','ownOngoingCostType',
  'ownOngoingInflation','rentAmount','rentFreq','rentInflation',
  'rentOngoingCost','rentOngoingCostFreq','rentOngoingCostType','rentOngoingInflation'];

const browser = await chromium.launch();
const clean = s => (s || '').split('\n').filter(l => !l.startsWith('#')).join('\n');

for (const c of cases) {
  if (c.rtbEnabled) { console.log('skip', c.name, '(no RTB in the sensitivity tool)'); continue; }

  const page = await browser.newPage();
  page.on('pageerror', () => {});
  await page.addInitScript(() => {
    try { localStorage.clear(); localStorage.setItem('rvos-tour-v1-seen', '1'); } catch (e) {}
  });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    window.__csv = null;
    RVOExport.downloadCSV = (f, t) => { window.__csv = t; };
  });

  // 1. simple-mode params (values commit on blur)
  await page.evaluate(({ c, SIMPLE }) => {
    const set = (key, v) => {
      const el = document.querySelector(`[data-si="0"][data-key="${key}"]`);
      if (!el) return;
      el.value = String(v);
      ['input', 'change'].forEach(t => el.dispatchEvent(new Event(t, { bubbles: true })));
      if (el.tagName === 'INPUT') el.dispatchEvent(new Event('blur', { bubbles: true }));
    };
    SIMPLE.forEach(k => { if (c[k] !== undefined) set(k, c[k]); });
  }, { c, SIMPLE });
  await page.waitForTimeout(80);

  // 2. detailed mortgage mode (only needed for interest-only / explicit cost toggle).
  //    Switching seeds a single fixed period at the scenario's mortgageRate, which
  //    is already set above, so the schedule stays flat like the Python oracle.
  if (c.mode === 'detailed') {
    await page.evaluate(() => {
      document.querySelector('.mode-seg[data-mode-key="mortgageMode"] .seg-btn[data-val="detailed"]')?.click();
    });
    await page.waitForTimeout(80);
    await page.evaluate((c) => {
      const ty = document.querySelector('[data-si="0"][data-key="mortgageType"]');
      if (ty) { ty.value = c.mortgageType; ty.dispatchEvent(new Event('change', { bubbles: true })); }
      const ci = document.querySelector('[data-si="0"][data-key="costInterestOnly"]');
      if (ci) { ci.checked = !!c.costInterestOnly; ci.dispatchEvent(new Event('change', { bubbles: true })); }
    }, c);
    await page.waitForTimeout(80);
  }

  async function grab(which) {
    await page.evaluate((w) => {
      window.__csv = null;
      document.querySelector(`.btn-scen-action.dl-${w}[data-si="0"]`).click();
    }, which);
    await page.waitForTimeout(30);
    return await page.evaluate(() => window.__csv);
  }

  writeFileSync(join(HERE, 'sens_out', `${c.name}_own.csv`), clean(await grab('own')));
  writeFileSync(join(HERE, 'sens_out', `${c.name}_rent.csv`), clean(await grab('rent')));
  console.log('done', c.name);
  await page.close();
}

await browser.close();
