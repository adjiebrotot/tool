// The Rent vs Own guide's live demos: guide-live.js opens the tool in a frame of this page and
// plays each scene in it. Before S.begin() a scene sets itself up, unseen; S.mark('...') names the
// moments the guide's steps refer to, in order (the guide's list under the demo has one item per
// mark); S.focus(part) zooms in on what a step is about, S.focus() shows the whole tool.
// The Sensitivity page is the same model on the same inputs, so its scenes open it with their
// own path (SENS). Nothing here fetches: every scenario is a single-currency one, so no
// exchange rate is ever asked for. Check them all with
//   node _ref/guide-check.mjs rentvsownhouse
export const TOOL = {
  path: '../',
  seen: ['rvo-tour-v4-seen', 'rvos-tour-v3-seen'],
  storage: { 'abt:ctrl:/rentvsownhouse/': '1' },   // the Inputs card left open
  ready: (win) => win.__RVO && win.document.querySelector('#verdict .v-num'),
};

// The Sensitivity page, ready once its table and its shared plan are built.
const SENS = { path: '../sensitivity/', ready: (win) => win.__RVOS && win.__RVOS.plan() && win.document.querySelector('#tableWrap table.dt') };

// A Quick Start loaded behind the veil, the way the two pickers load one: the city from its
// list, then the home from its select.
const quick = async (S, city, type) => {
  const w = S.win, d = S.doc, inp = d.getElementById('qsCity');
  inp.value = city;
  inp.dispatchEvent(new w.Event('input', { bubbles: true }));
  const row = d.querySelector(`#qsCityList .combo-opt[data-key="${city}"]`);
  row.dispatchEvent(new w.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  const sel = d.getElementById('qsType');
  if (type && sel.value !== type) { sel.value = type; sel.dispatchEvent(new w.Event('change', { bubbles: true })); }
  await S.wait(300);
};
// The same on the Sensitivity page: a column's bolt, then a home from its list.
const column = async (S, si, sid, find) => {
  await S.click(`.scen-preset[data-si="${si}"]`, { after: 400 });
  if (find) await type(S, '.scen-preset-search', find);
  await S.wait(500);
  await S.click(`.scen-preset-opts .combo-opt[data-sid="${sid}"]`, { after: 900 });
};
// Typed into a field a key at a time, without leaving it (a search box stays open).
const type = async (S, sel, text, delay = 130) => {
  const w = S.win, el = await S.find(sel);
  for (const ch of text) {
    el.value += ch;
    el.dispatchEvent(new w.Event('input', { bubbles: true }));
    await S.wait(delay);
  }
};
const tab = (S, name) => S.click(`.ctrl-tab[data-tab="${name}"]`, { after: 500 });
const sw = (id) => (S) => { const e = S.doc.getElementById(id); return e && e.closest('.toggle-switch'); };
const group = (sel) => (S) => { const e = S.doc.querySelector(sel); return e && e.closest('.field-group'); };
const row = (sel) => (S) => { const e = S.doc.querySelector(sel); return e && e.closest('.field-row'); };
const top = (S) => S.scrollTo('.layout', 16, 400);           // the inputs card as tall as the frame
const park = (S, x = 1150, y = 700) => S.glide(x, y, 500);   // out of a tooltip's way

export const SCENES = [
  {
    // The screen: Perth, a two-bedroom house, Inputs open, down to What this assumes.
    name: 'layout', still: true,
    async run(S) {
      await quick(S, 'perth', 'house-2br');
      return { boxes: {
        inputs: '.layout > .controls',
        answer: ['#verdict', '.metrics'],
        chart: '.chart-card',
        details: ['#summarySection', '.assumes-card'],
      } };
    },
  },
  {
    // The Sensitivity page's screen, as it first opens: two columns on the default home.
    name: 'sens-layout', still: true, ...SENS,
    async run() {
      return { boxes: {
        bar: '.controls-bar',
        columns: '#tableWrap thead',
        shared: ['#tableWrap tbody > tr.group-sep-tr', '#tableWrap tbody > tr:nth-child(6)'],
        own: ['#tableWrap tbody > tr:nth-child(7)', '#tableWrap tr:has([data-key="rentOngoingInflation"])'],
        results: ['#tableWrap tr.view-tr', '#tableWrap tr.out-actions'],
      } };
    },
  },
  {
    // A first visit: the inputs folded to a rail; open them, find a city, pick a home.
    name: 'quickstart', storage: {},
    async run(S) {
      S.begin();
      await S.focus('.ctrl-fold-rail', { pad: 140, after: 400 });
      S.mark('Open the inputs');
      await S.click('.ctrl-fold-rail', { after: 600 });
      S.mark('Search a city');
      await S.focus('.quick-start-row', { pad: 70 });
      await S.click('#qsCity', { after: 500 });
      await type(S, '#qsCity', 'Perth');
      await S.wait(700);
      await S.click('#qsCityList .combo-opt[data-key="perth"]', { after: 900 });
      S.mark('Pick a home');
      await S.choose('#qsType', '2BR house', { after: 700 });
      await S.moveTo('#qsAll', { ms: 600 });
      await S.wait(1600);
      S.mark('Read the answer');
      await S.focus(['#verdict', '.metrics'], { pad: 30 });
      await park(S);
      await S.wait(2600);
      await S.focus(null, { ms: 900 });
      await S.wait(800);
    },
  },
  {
    // The Home tab: the price and deposit, a staged loan, the costs of owning.
    name: 'home',
    async run(S) {
      await quick(S, 'perth', 'house-2br');
      await top(S);
      S.begin();
      S.mark('Price and deposit');
      await S.focus(group('#propertyPrice'), { pad: 30 });
      await S.moveTo('#propertyPrice', { ms: 600 });
      await S.wait(700);
      await S.slide('#downPaymentPct', 30, { after: 900 });
      await S.focus([group('#propertyPrice'), '#verdict'], { pad: 20, after: 1400 });
      S.mark('Simple or Detailed');
      await S.reveal('#mortgageModeGroup', 0.25);
      await S.focus(group('#mortgageModeGroup'), { pad: 30 });
      await S.click('#mortgageModeGroup .seg-btn[data-val="detailed"]', { after: 900 });
      await S.moveTo('#ratePeriodRows', { ms: 700 });
      await S.wait(1500);
      S.mark('The floating band');
      await S.focus('.chart-card', { pad: 20 });
      await S.moveTo('#chartLegend', { ms: 700 });
      await S.wait(2200);
      await S.focus();
      await S.click('#mortgageModeGroup .seg-btn[data-val="simple"]', { after: 700 });
      S.mark('Costs of owning');
      await S.reveal('#ownCostsModeGroup', 0.2);
      await S.focus(group('#ownCostsModeGroup'), { pad: 24 });
      await S.choose('#setupCostType', '$', { after: 1100 });
      await S.moveTo('#ownOngoingCostType', { ms: 600 });
      await S.wait(1600);
    },
  },
  {
    // The Rent tab: the rent and its growth, the costs of renting, Rent-Then-Buy.
    name: 'rent',
    async run(S) {
      await quick(S, 'perth', 'house-2br');
      await top(S);
      await tab(S, 'rent');
      S.begin();
      S.mark('Rent and its growth');
      await S.focus(group('#rentAmount'), { pad: 30 });
      await S.choose('#rentFreq', 'a month', { after: 1000 });
      await S.slide('#rentInflation', 4.5, { after: 800 });
      await S.focus([group('#rentAmount'), '#verdict'], { pad: 20, after: 1400 });
      S.mark('Costs of renting');
      await S.focus(group('#rentOngoingCost'), { pad: 30 });
      await S.moveTo('#rentOngoingCostType', { ms: 700 });
      await S.wait(1500);
      S.mark('Rent-Then-Buy');
      await S.reveal('#rtbEnabled', 0.5);
      await S.focus(group('#rtbEnabled'), { pad: 60 });
      await S.click(sw('rtbEnabled'), { after: 900 });
      await S.slide('#rtbBuyYear', 8, { after: 900 });
      S.mark('A third line');
      await S.focus(['#verdict', '.chart-card'], { pad: 16 });
      await park(S, 1150, 760);
      await S.wait(2600);
    },
  },
  {
    // The Assumptions tab: prices and savings, property growth, cash and the budget.
    name: 'assumptions',
    async run(S) {
      await quick(S, 'perth', 'house-2br');
      await top(S);
      await tab(S, 'general');
      S.begin();
      S.mark('Prices and savings');
      await S.focus([group('#generalInflation'), group('#riskFreeRate')], { pad: 20 });
      await S.moveTo('#riskFreeRateVal', { ms: 700 });
      await S.wait(1600);
      S.mark('Property growth');
      await S.reveal('#houseGrowth', 0.3);
      await S.focus(group('#houseGrowth'), { pad: 24 });
      await S.click('#cagrToolToggle', { after: 700 });
      await S.reveal('#cagrCalc', 0.6);
      await S.fill('#cagrRows .cagr-row:nth-child(1) .cagr-year', '2006', { delay: 90, after: 300 });
      await S.fill('#cagrRows .cagr-row:nth-child(1) .cagr-price', '380000', { delay: 90, after: 300 });
      await S.fill('#cagrRows .cagr-row:nth-child(2) .cagr-year', '2026', { delay: 90, after: 300 });
      await S.fill('#cagrRows .cagr-row:nth-child(2) .cagr-price', '855000', { delay: 90, after: 300 });
      await S.click('#cagrCalc', { after: 1800 });
      S.mark('Cash and the budget');
      await S.reveal('#monthlyBudget', 0.5);
      await S.focus(group('#initialCash'), { pad: 24 });
      await S.moveTo('#initialCashSub', { ms: 700 });
      await S.wait(1400);
      await S.focus();
      await S.fill('#monthlyBudget', '6000', { after: 1200 });
      S.mark('The lead stays');
      await S.focus(['#verdict', '.metrics'], { pad: 24 });
      await park(S);
      await S.wait(2800);
    },
  },
  {
    // The answer, the money it is read in, the four figures and the chart.
    name: 'results',
    async run(S) {
      await quick(S, 'perth', 'house-2br');
      S.begin();
      S.mark('The answer');
      await S.focus(['#verdict', '.money-bar'], { pad: 24 });
      await S.moveTo('#verdict .v-num', { ms: 700 });
      await S.wait(1600);
      S.mark("Today's money");
      await S.click(sw('showReal'), { after: 2000 });
      await S.click(sw('showReal'), { after: 1000 });
      S.mark('Four figures');
      await S.focus('.metrics', { pad: 20 });
      await S.moveTo('#kpiBreakeven', { ms: 700 });
      await S.wait(1600);
      S.mark('The chart');
      await S.focus('.chart-card', { pad: 16 });
      await S.click('#graphCash', { after: 1300 });
      await S.click('#graphCost', { after: 1300 });
      await S.click('#graphNetEquity', { after: 700 });
      const c = await S.box('#chartCanvas');
      await S.glide(c.x + c.width * 0.18, c.y + c.height * 0.6, 700);
      await S.glide(c.x + c.width * 0.62, c.y + c.height * 0.5, 1400);
      await S.wait(1600);
    },
  },
  {
    // Under the chart: the two snapshots, the year-by-year cashflow, what it assumes.
    name: 'details',
    async run(S) {
      await quick(S, 'perth', 'house-2br');
      await S.scrollTo('#summarySection', 120, 0);
      S.begin();
      S.mark('Snapshots');
      await S.focus('#summarySection', { pad: 16 });
      await S.moveTo('#ownSummary .tile:nth-child(3)', { ms: 700 });
      await S.wait(1500);
      S.mark('Cashflow by year');
      await S.focus();
      await S.click('#detailSection .fold-btn', { after: 900 });
      await S.scrollTo('#detailSection', 40, 900);
      await S.focus(['#detailSection .detail-head', '#detailTableWrap'], { pad: 10 });
      await S.click('#tableTabs .tab-btn[data-table="rent"]', { after: 1500 });
      await S.moveTo('#downloadBtn', { ms: 600 });
      await S.wait(1000);
      S.mark('What this assumes');
      await S.focus();
      await S.scrollTo('.assumes-card', 300, 700);
      await S.click('.assumes-card .fold-btn', { after: 800 });
      await S.scrollTo('.assumes-card', 60, 800);
      await S.focus('.assumes-card', { pad: 16 });
      await S.moveTo('#assumptions li:nth-child(4)', { ms: 700 });
      await S.wait(2200);
    },
  },
  {
    // Save, open, and the chart's Share menu.
    name: 'share',
    async run(S) {
      await quick(S, 'perth', 'house-2br');
      S.begin();
      S.mark('Save or open a file');
      await S.focus(['.scenario-save', '.scenario-load'], { pad: 120 });
      await S.moveTo('.scenario-save', { ms: 700 });
      await S.wait(1300);
      await S.moveTo('.scenario-load', { ms: 500 });
      await S.wait(1100);
      S.mark('Share');
      await S.focus('.chart-card .share-toggle', { pad: 60 });
      await S.click('.chart-card .share-toggle', { after: 300 });
      await S.focus(['.chart-card .share-toggle', '[role=menu]'], { pad: 30 });
      for (const t of ['Download as PNG', 'Share as link', 'Embed as HTML']) {
        await S.moveTo({ text: t, in: '[role=menu]' }, { ms: 500 });
        await S.wait(900);
      }
      await S.key('Escape');
      await S.focus();
      await park(S);
      await S.wait(800);
    },
  },
  {
    // Same inputs, two screens: the main page's Home tab, at the width that stacks it.
    name: 'same-main', still: true,
    async run() {
      return { boxes: {
        currency: '#tab-own > .field-row',
        price: '.field-row:has(#propertyPrice)',
        deposit: '.field-row:has(#downPaymentPct)',
        detail: '.field-row:has(#mortgageModeGroup)',
        rate: '#mortgageRateRow',
        term: '.field-row:has(#mortgageTerm)',
      } };
    },
  },
  {
    // ... and the same six on the Sensitivity page.
    name: 'same-sens', still: true, ...SENS,
    async run() {
      return { boxes: {
        currency: ['#currencyLabel', '.fx-row'],
        price: '#tableWrap tr:has([data-key="propertyPrice"])',
        deposit: '#tableWrap tr:has([data-key="downPaymentPct"])',
        detail: '#tableWrap tr:has([data-mode-key="mortgageMode"])',
        rate: '#tableWrap tr:has([data-key="mortgageRate"])',
        term: '#tableWrap tr:has([data-key="mortgageTerm"])',
      } };
    },
  },
  {
    // The Sensitivity page: two Perth homes from the bolt, the money they share, the answer.
    name: 'sens-quickstart', ...SENS,
    async run(S) {
      S.begin();
      S.mark('Fill a column');
      await S.focus('#tableWrap thead', { pad: 40 });
      await column(S, 0, 'perth/house-2br', 'perth house');
      S.mark('And the next');
      await column(S, 1, 'perth/apt-2br', 'perth apart');
      S.mark('The shared rows');
      await S.focus(['#tableWrap tbody > tr.group-sep-tr', '#tableWrap tbody > tr:nth-child(6)'], { pad: 16 });
      await S.moveTo('.shared-note[data-note="initialCash"]', { ms: 700 });
      await S.wait(1300);
      await S.moveTo('.shared-note[data-note="monthlyBudget"]', { ms: 600 });
      await S.wait(1500);
      S.mark('Read across');
      await S.focus();
      await S.scrollTo('#tableWrap tr.view-tr', 420, 900);
      await S.focus(['#tableWrap tr.view-tr', '#tableWrap tr.out-delta'], { pad: 20 });
      await S.moveTo('#tableWrap tr.out-delta td:nth-child(2)', { ms: 700 });
      await S.wait(1200);
      await S.moveTo('#tableWrap tr.out-delta td:nth-child(3)', { ms: 600 });
      await S.wait(1800);
    },
  },
  {
    // A copied column with one change, a metric and a year, every scenario on one chart, and the files.
    name: 'sens-compare', ...SENS,
    async run(S) {
      await column(S, 0, 'perth/house-2br');
      S.begin();
      S.mark('Copy and change');
      await S.focus('#tableWrap thead', { pad: 40 });
      await S.click('.btn-dupe[data-si="0"]', { after: 900 });
      await S.scrollTo('#tableWrap tr:has([data-key="mortgageRate"])', 300, 600);
      await S.focus('#tableWrap tr:has([data-key="mortgageRate"])', { pad: 60 });
      await S.fill('.param-input[data-si="1"][data-key="mortgageRate"]', '7.4', { after: 900 });
      S.mark('Compare on');
      await S.focus();
      await S.scrollTo('#tableWrap tr.view-tr', 420, 900);
      await S.focus(['#tableWrap tr.view-tr', '#tableWrap tr.out-delta'], { pad: 20 });
      await S.click('#metricGroup .seg-btn[data-metric="cash"]', { after: 1100 });
      await S.fill('#yearInput', '10', { after: 900 });
      await S.click('#metricGroup .seg-btn[data-metric="netEquity"]', { after: 900 });
      S.mark('Compare');
      await S.focus();
      await S.scrollTop(600);
      await S.click('#compareAllBtn', { after: 2600 });
      await S.click('.gc-overlay.open .gc-close', { after: 700 });
      S.mark('Save the grid');
      await S.focus(['.csv-actions', '.header-right'], { pad: 30 });
      await S.moveTo('#downloadCSVBtn', { ms: 600 });
      await S.wait(1000);
      await S.moveTo('.header-right .scenario-save', { ms: 600 });
      await S.wait(1400);
    },
  },
  {
    // How the numbers work: House price growth, the input the answer rests on most, moved a
    // point up and a point down from the Perth base case.
    name: 'live',
    async run(S) {
      await quick(S, 'perth', 'house-2br');
      await top(S);
      await tab(S, 'general');
      await S.reveal('#houseGrowth', 0.3);
      S.begin();
      S.mark('The base case');
      await S.focus(['#houseGrowth', '#verdict', '.metrics'], { pad: 16 });
      await S.moveTo('#kpiDiff', { ms: 700 });
      await S.wait(1800);
      S.mark('Growth up a point');
      await S.slide('#houseGrowth', 5.5, { ms: 1400, after: 2400 });
      S.mark('Growth down a point');
      await S.slide('#houseGrowth', 3.5, { ms: 1800, after: 2400 });
      S.mark('Back to the base');
      await S.focus();
      await S.slide('#houseGrowth', 4.5, { ms: 1400, after: 2600 });
    },
  },
];
