import PRICES from './prices.js';

// The price cache both pages read at start (dca_priceCache_v2), filled from the shipped snapshot.
function unsnap(c, len) {
  const a = c.r || c.d, f = 10 ** (c.k || 0), out = new Array(len);
  if (c.r) return a.slice();
  let n = 0;
  for (let i = 0; i < len; i++) { n += a[i]; out[i] = c.f ? Math.fround(n / f) : n / f; }
  return out;
}
export function priceCache() {
  const cache = {};
  for (const [tk, s] of Object.entries(PRICES.t)) {
    const p = s.t.split('-'), dates = [s.t];
    let day = Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5;
    for (const g of s.g) dates.push(new Date((day += g) * 864e5).toISOString().slice(0, 10));
    const L = dates.length;
    cache[tk] = { dates, prices: unsnap(s.p, L), opens: unsnap(s.o, L), highs: unsnap(s.h, L), lows: unsnap(s.l, L),
      cachedStart: dates[0], cachedEnd: dates[L - 1], coverageStart: PRICES.a, coverageEnd: PRICES.b, source: s.s, kind: s.k };
  }
  return cache;
}
export const CACHE_KEY = 'dca_priceCache_v2';
export const CACHE = JSON.stringify({ savedAt: 0, cache: priceCache() });
// Every demo runs on the same five years, inside the snapshot, whatever today's date is.
export const WINDOW = { start: '2021-10-01', end: '2026-09-30' };

const MAIN_CTRL = 'abt:ctrl:/dcasimulator/', PF_CTRL = 'abt:ctrl:/dcasimulator/portfolio/';
const results = (w) => w.document.querySelector('#summaryGrid .tile');
export const TOOL = {
  path: '../',
  seen: ['dca-tour-v4-seen', 'dcapf-tour-v4-seen'],
  storage: { [MAIN_CTRL]: '1', [CACHE_KEY]: CACHE },   // the Inputs card left open, the prices in the cache
  ready: results,
};
// The Portfolio page: the same cache (both pages share it), its own Inputs card.
const PF = { path: '../portfolio/', storage: { [PF_CTRL]: '1', [CACHE_KEY]: CACHE }, ready: results };

// The guide's dates in the Date Range, as a reader would type them.
const setDates = (S) => {
  const w = S.win, d = S.doc;
  for (const [id, v] of [['startDate', WINDOW.start], ['endDate', WINDOW.end]]) {
    const e = d.getElementById(id); e.value = v; e.dispatchEvent(new w.Event('change', { bubbles: true }));
  }
};
// A run is over: Simulate is free again and the answer names what it should.
const idle = (S, text) => S.until((w) => {
  const b = w.document.getElementById('simBtn'), v = w.document.getElementById('verdict');
  return b && !b.dataset.running && v && v.textContent.trim() && (!text || v.textContent.indexOf(text) >= 0);
}, 30000, 'the run');
// A Quick Start loaded behind the veil, on the guide's dates.
const quick = async (S, key, text) => {
  setDates(S);
  S.doc.querySelector(`.quick-start-btn[data-preset="${key}"]`).click();
  await S.wait(50);
  await idle(S, text);
  await S.wait(300);
};
const simulate = async (S, text) => { await S.click('#simBtn', { after: 200 }); await idle(S, text); await S.wait(900); };
const tab = (S, name) => S.click(`.ctrl-tab[data-tab="${name}"]`, { after: 500 });
const sub = (S, name) => S.click(`.sub-tab[data-sub="${name}"]`, { after: 500 });
const sw = (id) => (S) => { const e = S.doc.getElementById(id); return e && e.closest('.toggle-row'); };
const group = (sel) => (S) => { const e = S.doc.querySelector(sel); return e && e.closest('.field-group'); };
const row = (sel) => (S) => { const e = S.doc.querySelector(sel); return e && e.closest('.field-row, .sec-row, .param-row'); };
const scTab = (name) => (S) => [...S.doc.querySelectorAll('#scenarioTabs .sc-tab')].find(t => t.textContent.indexOf(name) >= 0);
const pfTab = (name) => (S) => [...S.doc.querySelectorAll('#portfolioTabs .pf-tab')].find(t => t.textContent.indexOf(name) >= 0);
const fold = (sel) => `${sel} .fold-btn`;
const top = (S) => S.scrollTo('.layout', 16, 500);           // the inputs card as tall as the frame
const park = (S, x = 1272, y = 70) => S.glide(x, y, 500);    // in the right margin, off a chart's tooltip
// The 1st-of-the-month SPY scenario of Monthly vs Weekly, open in the editor.
const monthly = async (S) => { const t = scTab('$520')(S); if (t) t.click(); await S.wait(200); };

export const SCENES = [
  {
    // The screen: Monthly vs Weekly, Inputs open, down to What this assumes.
    name: 'layout', still: true,
    async run(S) {
      await quick(S, 'monthly-weekly', '$520');
      return { boxes: {
        inputs: '.layout > .controls',
        answer: ['#verdict', '.summary-row'],
        charts: ['.chart-card:has(#priceCanvas)', '.chart-card:has(#equityCanvas)'],
        details: ['.detail-section', '.assumes-card'],
      } };
    },
  },
  {
    // The Portfolio page's screen: 80/20 vs 60/40.
    name: 'pf-layout', still: true, ...PF,
    async run(S) {
      await quick(S, 'alloc', '80/20');
      return { boxes: {
        inputs: '.layout > .controls',
        answer: ['#verdict', '.summary-row'],
        value: '#valueCard',
        details: '.detail-section',
      } };
    },
  },
  {
    // A first visit: the inputs folded to a rail; open them and load an example.
    name: 'quickstart', storage: { [CACHE_KEY]: CACHE },
    async run(S) {
      setDates(S);
      await S.wait(200);
      S.begin();
      await S.focus('.ctrl-fold-rail', { pad: 140, after: 400 });
      S.mark('Open the inputs');
      await S.click('.ctrl-fold-rail', { after: 600 });
      S.mark('Pick an example');
      await S.focus('.quick-start-row', { pad: 90 });
      await S.moveTo('.quick-start-btn[data-preset="equity-mmf"]', { ms: 700 });
      await S.wait(1400);
      await S.moveTo('.quick-start-btn[data-preset="monthly-weekly"]', { ms: 600 });
      await S.wait(1400);
      await S.click('.quick-start-btn[data-preset="monthly-weekly"]', { after: 200 });
      await idle(S, '$520');
      S.mark('Read the answer');
      await park(S);
      await S.focus(['#verdict', '.summary-row'], { pad: 24 });
      await S.wait(2800);
      await S.focus(null, { ms: 900 });
      await S.wait(800);
    },
  },
  {
    // The Data tab: the loaded assets, a simulated asset, the dates.
    name: 'data',
    async run(S) {
      await quick(S, 'monthly-weekly', '$520');
      await top(S);
      S.begin();
      await tab(S, 'data');
      S.mark('Currency');
      await S.focus([row('#currencySymbol'), '#poolChipsWrap'], { pad: 30 });
      await S.moveTo(row('#currencySymbol'), { ms: 600 });
      await S.wait(900);
      S.mark('Loaded assets');
      await S.click('#poolToggle', { after: 600 });
      await S.focus('#poolChipsWrap', { pad: 24 });
      await S.moveTo('#poolChips', { ms: 700 });
      await S.wait(1800);
      await S.click('#poolToggle', { after: 400 });
      S.mark('Real or Simulated');
      await S.focus(group('#dataModeToggle'), { pad: 20 });
      await S.moveTo('#tickerPoolInput', { ms: 600 });
      await S.wait(1200);
      await S.click('#dataModeToggle .seg-btn[data-dmode="simulated"]', { after: 600 });
      await S.fill('#simNameInput', 'Steady 6%', { delay: 90, after: 300 });
      await S.fill('#simReturnInput', '6', { after: 300 });
      await S.fill('#simStdInput', '5', { after: 300 });
      await S.focus([group('#dataModeToggle'), '#addSimBtn'], { pad: 16 });
      await S.click('#addSimBtn', { after: 1400 });
      S.mark('Date Range');
      await S.reveal('#startDate', 0.5);
      await S.focus([row('#startDate'), '#startDate', '#endDate'], { pad: 60 });
      await S.moveTo('#startDate', { ms: 600 });
      await S.wait(700);
      await S.moveTo('#endDate', { ms: 500 });
      await S.wait(1600);
    },
  },
  {
    // The Scenarios tab: copy a scenario, point it at another asset, rename it, run.
    name: 'scenarios',
    async run(S) {
      await quick(S, 'monthly-weekly', '$520');
      await monthly(S);
      await top(S);
      S.begin();
      S.mark('A tab per scenario');
      await S.focus('.sc-bar', { pad: 40 });
      await S.moveTo(scTab('$120'), { ms: 600 });
      await S.wait(700);
      await S.click('#dupScenarioBtn', { after: 900 });
      S.mark('Pick the asset');
      await S.reveal('#cfgAssetSelect + .combo-input', 0.45);
      await S.focus(group('#cfgAssetSelect'), { pad: 40 });
      await S.click('#cfgAssetSelect + .combo-input', { after: 700 });
      await S.click({ text: 'AAPL', in: '.combo-list' }, { after: 900 });
      S.mark('Name it');
      await S.reveal('#cfgName', 0.1);
      await S.focus('#cfgName', { pad: 120 });
      await S.fill('#cfgName', 'AAPL - $520 / month', { delay: 70, after: 600 });
      S.mark('Top-ups');
      await S.focus(group('#cfgAmount'), { pad: 30 });
      await S.moveTo('#cfgAmount', { ms: 600 });
      await S.wait(900);
      await S.moveTo('#cfgYearlyInc', { ms: 500 });
      await S.wait(1200);
      S.mark('Simulate');
      await S.focus();
      await simulate(S, 'AAPL');
      await park(S);
      await S.focus(['#verdict', '.summary-row'], { pad: 24 });
      await S.wait(2600);
    },
  },
  {
    // The Investment Style: the four families, and the settings each one reads.
    name: 'styles',
    async run(S) {
      await quick(S, 'monthly-weekly', '$520');
      await monthly(S);
      await top(S);
      await S.reveal('.cat-pills', 0.15);
      S.begin();
      S.mark('Date');
      await S.focus(group('.cat-pills'), { pad: 20 });
      await S.moveTo('.radio-opt.selected', { ms: 700 });
      await S.wait(800);
      await S.fill('[id^="secDay"]', '15', { after: 900 });
      S.mark('Momentum');
      await S.click('.cat-pill[data-cat="momentum"]', { after: 600 });
      await S.click('.radio-opt[id$="_momentum_dip"]', { after: 700 });
      await S.reveal('input[id^="secMomPct"]', 0.45);
      await S.focus(group('.cat-pills'), { pad: 20 });
      await S.slide('input[id^="secMomPct"]', 3, { after: 600 });
      await S.moveTo('.eom-row', { ms: 600 });
      await S.wait(1400);
      S.mark('Technical');
      await S.reveal('.cat-pills', 0.15);
      await S.click('.cat-pill[data-cat="tech"]', { after: 600 });
      await S.click('.radio-opt[id$="_tech_rsi"]', { after: 700 });
      await S.reveal('[id^="secRsiOversold"]', 0.5);
      await S.focus(group('.cat-pills'), { pad: 20 });
      await S.moveTo('[id^="secRsiPeriod"]', { ms: 600 });
      await S.wait(800);
      await S.moveTo('[id^="secRsiOversold"]', { ms: 500 });
      await S.wait(1200);
      S.mark('Forward');
      await S.reveal('.cat-pills', 0.15);
      await S.click('.cat-pill[data-cat="forward"]', { after: 700 });
      await S.focus(group('.cat-pills'), { pad: 20 });
      await S.moveTo('.warn-note', { ms: 700 });
      await S.wait(2400);
      await S.click('.cat-pill[data-cat="tech"]', { after: 600 });
      S.mark('Run it');
      await S.focus();
      await simulate(S, 'SPY');
      await S.scrollTo('.chart-card:has(#priceCanvas)', 12, 900);
      await S.click(sw('showTechToggle'), { after: 500 });
      await S.click(sw('showBuyDateToggle'), { after: 500 });
      await S.focus('.chart-card:has(#priceCanvas)', { pad: 10 });
      await park(S);
      await S.wait(2600);
    },
  },
  {
    // The Assumptions tab: when an order fills, the seed, the risk-free rate.
    name: 'assumptions',
    async run(S) {
      await quick(S, 'monthly-weekly', '$520');
      await top(S);
      S.begin();
      await tab(S, 'settings');
      S.mark('Trade at');
      await S.focus(group('#execTiming'), { pad: 30 });
      await S.choose('#execTiming', "Same day's close", { after: 700 });
      S.mark('Risk-Free Rate');
      await S.moveTo('#riskFreeRate', { ms: 600 });
      await S.wait(1200);
      S.mark('Simulation Seed');
      await S.moveTo('#randomSeed', { ms: 600 });
      await S.wait(1500);
      S.mark('Simulate');
      await S.focus();
      await simulate(S, '$520');
      await park(S);
      await S.focus(['#verdict', '.summary-row'], { pad: 24 });
      await S.wait(2400);
    },
  },
  {
    // The answer, the tiles and the two charts.
    name: 'results',
    async run(S) {
      await quick(S, 'monthly-weekly', '$520');
      await S.scrollTo('#verdict', 16, 400);
      S.begin();
      S.mark('The answer');
      await S.focus('#verdict', { pad: 24 });
      await park(S);
      await S.wait(2400);
      S.mark('Final Summary');
      await S.focus('.summary-row', { pad: 24 });
      await S.click(sw('showAdvancedToggle'), { after: 600 });
      await S.moveTo('#summaryGrid .adv-metrics', { ms: 700 });
      await S.wait(2400);
      S.mark('Security Prices');
      await S.focus();
      await S.scrollTo('.chart-card:has(#priceCanvas)', 12, 900);
      await S.focus('.chart-card:has(#priceCanvas)', { pad: 10 });
      await S.click(sw('showCandleToggle'), { after: 1400 });
      await S.click(sw('showCandleToggle'), { after: 500 });
      const pc = await S.box('#priceCanvas');
      await S.glide(pc.x + pc.width * 0.3, pc.y + pc.height * 0.6, 700);
      await S.glide(pc.x + pc.width * 0.7, pc.y + pc.height * 0.4, 1400);
      await S.wait(600);
      S.mark('Portfolio Value');
      await S.focus();
      await S.scrollTo('.chart-card:has(#equityCanvas)', 12, 900);
      await S.focus('.chart-card:has(#equityCanvas)', { pad: 10 });
      const ec = await S.box('#equityCanvas');
      await S.glide(ec.x + ec.width * 0.4, ec.y + ec.height * 0.5, 700);
      await S.glide(ec.x + ec.width * 0.9, ec.y + ec.height * 0.4, 1400);
      await S.wait(1600);
    },
  },
  {
    // Under the charts: every buy in a table, then what the run assumes.
    name: 'details',
    async run(S) {
      await quick(S, 'monthly-weekly', '$520');
      await S.scrollTo('.detail-section', 300, 400);
      S.begin();
      S.mark('Detailed Breakdown');
      await S.click(fold('.detail-section'), { after: 700 });
      await S.scrollTo('.detail-section', 16, 900);
      await S.focus('.detail-section', { pad: 10 });
      await S.moveTo('#detailBody tr:nth-child(3)', { ms: 700 });
      await S.wait(2000);
      S.mark('Pick a scenario');
      await S.choose('#detailSelect', '$120', { after: 1200 });
      await S.moveTo('#downloadBtn', { ms: 600 });
      await S.wait(1200);
      S.mark('What this assumes');
      await S.focus();
      await S.click(fold('.detail-section'), { after: 500 });
      await S.scrollTo('.assumes-card', 200, 700);
      await S.click(fold('.assumes-card'), { after: 700 });
      await S.focus('.assumes-card', { pad: 16 });
      await S.moveTo('#assumptions', { ms: 700 });
      await S.wait(2600);
    },
  },
  {
    // Optimise: sweep the day of the month on the monthly scenario.
    name: 'optimise',
    async run(S) {
      await quick(S, 'monthly-weekly', '$520');
      await monthly(S);
      await top(S);
      await S.reveal('.opt-btn[data-opt="dayOfMonth"]', 0.5);
      S.begin();
      S.mark('Pick a setting');
      await S.focus(group('.cat-pills'), { pad: 20 });
      await S.moveTo('.opt-btn[data-opt="dayOfMonth"]', { ms: 700 });
      await S.wait(600);
      await S.click('.opt-btn[data-opt="dayOfMonth"]', { after: 900 });
      S.mark('Set the range');
      await S.focus('#optModal .opt-modal', { pad: 30 });
      await S.moveTo('#optStart', { ms: 600 });
      await S.wait(600);
      await S.moveTo('#optSteps', { ms: 600 });
      await S.wait(1400);
      await S.click('#optDoneBtn', { after: 600 });
      S.mark('Optimise');
      await S.focus(['#staleNote', '#simBtn'], { pad: 60 });
      await S.wait(1200);
      await S.click('#simBtn', { after: 200 });
      await idle(S, 'Day of month');
      await S.focus();
      await S.wait(500);
      S.mark('Read the sweep');
      await S.scrollTo('#verdict', 16, 700);
      await S.focus(['#verdict', '.summary-row'], { pad: 20 });
      await park(S);
      await S.wait(2600);
      await S.focus();
      await S.scrollTo('#optCard', 12, 900);
      await S.focus('#optCard', { pad: 10 });
      const oc = await S.box('#optCanvas');
      await S.glide(oc.x + oc.width * 0.1, oc.y + oc.height * 0.5, 700);
      await S.glide(oc.x + oc.width * 0.9, oc.y + oc.height * 0.5, 1800);
      await S.wait(600);
      S.mark('Show a run below');
      await S.choose('#optPick0', '15', { after: 1600 });
      await S.wait(800);
    },
  },
  {
    // Save, open and Share.
    name: 'share',
    async run(S) {
      await quick(S, 'monthly-weekly', '$520');
      await top(S);
      S.begin();
      S.mark('Save or open a file');
      await S.focus(['.quick-start-row .scenario-save', '.quick-start-row .scenario-load'], { pad: 120 });
      await S.moveTo('.scenario-save', { ms: 800 });
      await S.wait(1300);
      await S.moveTo('.scenario-load', { ms: 500 });
      await S.wait(1000);
      S.mark('Share a chart');
      await S.focus();
      await S.scrollTo('.chart-card:has(#equityCanvas)', 12, 800);
      const t = (S2) => S2.doc.querySelector('.chart-card:has(#equityCanvas) .share-toggle');
      await S.focus(t, { pad: 40 });
      await S.click(t, { after: 300 });
      await S.focus([t, '[role=menu]'], { pad: 30 });
      for (const x of ['Download as SVG', 'Share as link', 'Embed as HTML']) {
        await S.moveTo({ text: x, in: '[role=menu]' }, { ms: 500 });
        await S.wait(900);
      }
      await S.key('Escape');
      await S.focus();
      await park(S);
      await S.wait(800);
    },
  },
  {
    // What moves the answer most: the start date, a year earlier, then a year later.
    name: 'live',
    async run(S) {
      await quick(S, 'monthly-weekly', '$520');
      await top(S);
      await tab(S, 'data');
      await S.reveal('#startDate', 0.5);
      // A date field takes its value whole, as the browser's date picker gives it.
      const start = async (v) => {
        await S.click('#startDate', { after: 300 });
        const w = S.win, e = S.doc.getElementById('startDate');
        e.value = v; e.dispatchEvent(new w.Event('input', { bubbles: true })); e.dispatchEvent(new w.Event('change', { bubbles: true }));
        await S.wait(700);
        // On the Data tab the button loads tickers; Simulate is on the other tabs.
        await tab(S, 'securities');
        await simulate(S, '$520');
        await tab(S, 'data');
        await S.reveal('#startDate', 0.5, 300);
      };
      S.begin();
      S.mark('The base case');
      await S.focus(['#startDate', '#summaryGrid .tile'], { pad: 30 });
      await S.moveTo('#summaryGrid .tile', { ms: 700 });
      await S.wait(2200);
      S.mark('A year earlier');
      await start('2020-10-01');
      await S.moveTo('#summaryGrid .tile', { ms: 600 });
      await S.wait(2400);
      S.mark('A year later');
      await start('2022-10-01');
      await S.moveTo('#summaryGrid .tile', { ms: 600 });
      await S.wait(2400);
      S.mark('Back to the base');
      await start(WINDOW.start);
      await S.focus();
      await park(S);
      await S.wait(1800);
    },
  },
  /* ---- The Portfolio page ---------------------------------------------------------------- */
  {
    // Same inputs, two screens: the main page's Scenarios tab, the 1st-of-the-month scenario.
    name: 'same-main', still: true,
    async run(S) {
      await quick(S, 'monthly-weekly', '$520');
      await monthly(S);
      await S.scrollTo('.layout', 8, 0);
      return { boxes: {
        plans: '.sc-bar',
        amount: '.sec-row:has(#cfgAmount)',
        increase: '.sec-row:has(#cfgYearlyInc)',
        when: '.field-group:has(.cat-pills)',
      } };
    },
  },
  {
    // ... and the Portfolio page's Top-Ups, 80/20 vs 60/40.
    name: 'same-pf', still: true, ...PF,
    async run(S) {
      await quick(S, 'alloc', '80/20');
      S.doc.querySelector('.sub-tab[data-sub="topups"]').click();
      await S.wait(200);
      await S.scrollTo('.layout', 8, 0);
      return { boxes: {
        plans: '.pf-bar',
        amount: '.field-row:has(#topupAmount)',
        increase: '.field-row:has(#topupYearlyInc)',
        when: ['.field-row:has(#topupPeriod)', '.field-row:has(#topupScheduleBox)'],
      } };
    },
  },
  {
    // The Portfolio page's Quick Start.
    name: 'pf-quickstart', ...PF,
    async run(S) {
      setDates(S);
      await top(S);
      S.begin();
      S.mark('Pick a comparison');
      await S.focus('.quick-start-row', { pad: 90 });
      await S.moveTo('.quick-start-btn[data-preset="rebal-freq"]', { ms: 700 });
      await S.wait(1400);
      await S.moveTo('.quick-start-btn[data-preset="alloc"]', { ms: 600 });
      await S.wait(1400);
      await S.click('.quick-start-btn[data-preset="alloc"]', { after: 200 });
      await idle(S, '80/20');
      S.mark('Read the answer');
      await park(S);
      await S.focus(['#verdict', '.summary-row'], { pad: 24 });
      await S.wait(2800);
      await S.focus(null, { ms: 900 });
      await S.wait(800);
    },
  },
  {
    // A portfolio's assets and weights: add a third asset, share out the weights, run.
    name: 'pf-assets', ...PF,
    async run(S) {
      await quick(S, 'rebal-vs-alloc', 'Constant');
      await top(S);
      S.begin();
      S.mark('A tab per portfolio');
      await S.focus('.pf-bar', { pad: 40 });
      await S.moveTo(pfTab('Allocation'), { ms: 600 });
      await S.wait(900);
      await S.moveTo(pfTab('Weight'), { ms: 500 });
      await S.wait(700);
      S.mark('Add an asset');
      await sub(S, 'assets');
      await S.focus(['#assetPoolSelect + .combo-input', '#assetList'], { pad: 30 });
      await S.click('#assetPoolSelect + .combo-input', { after: 700 });
      await S.click({ text: 'AAPL', in: '.combo-list' }, { after: 600 });
      await S.click('#addAssetBtn', { after: 1200 });
      S.mark('Target Weights');
      await sub(S, 'rebal');
      await S.reveal('#weightTableWrap', 0.4);
      await S.focus('#rebalWeights', { pad: 20 });
      const wt = (name) => (S2) => [...S2.doc.querySelectorAll('#weightTableWrap .weight-row')].find(r => r.textContent.indexOf(name) >= 0).querySelector('input');
      await S.fill(wt('SPY'), '40', { after: 400 });
      await S.fill(wt('GOVT'), '40', { after: 400 });
      await S.fill(wt('AAPL'), '20', { after: 900 });
      S.mark('Simulate');
      await S.focus();
      await simulate(S, 'Constant');
      await park(S);
      await S.focus(['#verdict', '.summary-row'], { pad: 24 });
      await S.wait(2600);
    },
  },
  {
    // The Rebalancing tab: the method, its timing, the fees.
    name: 'pf-rebal', ...PF,
    async run(S) {
      await quick(S, 'alloc', '80/20');
      pfTab('80/20')(S).click();
      await S.wait(200);
      await top(S);
      S.begin();
      S.mark('Method');
      await sub(S, 'rebal');
      await S.focus('#methodCollapsed', { pad: 40 });
      await S.click('#changeMethodBtn', { after: 700 });
      await S.focus('#methodList', { pad: 16 });
      await S.moveTo('#methodList [data-method="constant-allocation"]', { ms: 700 });
      await S.wait(900);
      await S.moveTo('#methodList [data-method="rule-trigger"]', { ms: 600 });
      await S.wait(900);
      await S.click('#methodList [data-method="constant-weight"]', { after: 900 });
      S.mark('Rebalance Timing');
      await S.reveal('#constantWeightOpts', 0.3);
      await S.focus('#constantWeightOpts', { pad: 20 });
      await S.click('[data-cwtiming="schedule"]', { after: 700 });
      await S.reveal('#rebalScheduleWrap', 0.5);
      await S.moveTo('#rebalPeriod', { ms: 600 });
      await S.wait(1200);
      S.mark('Fees');
      await S.reveal('#buyFee', 0.6);
      await S.focus(group('#buyFee'), { pad: 30 });
      await S.moveTo('#buyFee', { ms: 600 });
      await S.wait(700);
      await S.moveTo('#sellFee', { ms: 500 });
      await S.wait(1200);
      S.mark('Simulate');
      await S.focus();
      await simulate(S, '80/20');
      await park(S);
      await S.focus(['#verdict', '.summary-row'], { pad: 24 });
      await S.wait(2600);
    },
  },
  {
    // The Top-Ups tab: the contribution, its schedule, and what idle cash earns.
    name: 'pf-topups', ...PF,
    async run(S) {
      await quick(S, 'rebal-freq', 'Rebalance');
      pfTab('Quarterly')(S).click();
      await S.wait(200);
      await top(S);
      S.begin();
      S.mark('Contribution');
      await sub(S, 'topups');
      await S.focus(group('#topupAmount'), { pad: 20 });
      await S.moveTo('#topupAmount', { ms: 600 });
      await S.wait(800);
      await S.moveTo('#topupYearlyInc', { ms: 500 });
      await S.wait(900);
      S.mark('When it tops up');
      await S.reveal('#topupScheduleBox', 0.5);
      await S.focus(['.field-row:has(#topupPeriod)', '#topupScheduleHint'], { pad: 30 });
      await S.moveTo('#topupPeriod', { ms: 600 });
      await S.wait(900);
      await S.moveTo('#topupScheduleBox', { ms: 500 });
      await S.wait(1400);
      S.mark('Risk-Free Account');
      await S.reveal('#rfRate', 0.6);
      await S.focus(group('#rfRate'), { pad: 24 });
      await S.fill('#rfRate', '4', { after: 900 });
      S.mark('Simulate');
      await S.focus();
      await simulate(S, 'Rebalance');
      await park(S);
      await S.focus(['#verdict', '.summary-row'], { pad: 24 });
      await S.wait(2600);
    },
  },
  {
    // The Portfolio page's results: value, metrics, one portfolio in detail.
    name: 'pf-results', ...PF,
    async run(S) {
      await quick(S, 'alloc', '80/20');
      await S.scrollTo('#verdict', 16, 400);
      S.begin();
      S.mark('Final Summary');
      await S.focus('.summary-row', { pad: 24 });
      await S.click(sw('showAdvancedToggle'), { after: 600 });
      await S.moveTo('#summaryGrid .adv-metrics', { ms: 700 });
      await S.wait(2400);
      S.mark('Portfolio Value');
      await S.focus();
      await S.scrollTo('#valueCard', 12, 900);
      await S.focus('#valueCard', { pad: 10 });
      const vc = await S.box('#valueCanvas');
      await S.glide(vc.x + vc.width * 0.4, vc.y + vc.height * 0.5, 700);
      await S.glide(vc.x + vc.width * 0.9, vc.y + vc.height * 0.4, 1400);
      await S.wait(800);
      S.mark('One portfolio in detail');
      await S.focus();
      await S.scrollTo('.detail-section', 12, 900);
      await S.focus('.detail-section .detail-head', { pad: 60 });
      await S.choose('#detailPfSelect', '80/20', { after: 1000 });
      S.mark('Composition');
      await S.focus();
      await S.scrollTo('#compViewToggle', 60, 900);
      await S.focus((S2) => S2.doc.getElementById('compCanvas').closest('.detail-subsection'), { pad: 10 });
      await S.click('#compViewToggle .seg-btn[data-cv="percent"]', { after: 1800 });
      S.mark('Breakdown Table');
      await S.focus();
      await S.scrollTo('#downloadBtn', 300, 800);
      const f = (S2) => S2.doc.getElementById('compTable').closest('.detail-subsection').querySelector('.fold-btn');
      await S.click(f, { after: 700 });
      await S.scrollTo('#compUnitNote', 120, 900);
      await S.focus((S2) => S2.doc.getElementById('compTable').closest('.detail-subsection'), { pad: 10 });
      await S.moveTo('#compBody tr:nth-child(2)', { ms: 700 });
      await S.wait(2400);
    },
  },
];
