// The Finance vs Cash guide's live demos: guide-live.js opens the tool in a frame of this page and
// plays each scene in it. Before S.begin() a scene sets itself up, unseen; S.mark('...') names the
// moments the guide's steps refer to, in order (the guide's list under the demo has one item per
// mark); S.focus(part) zooms in on what a step is about, S.focus() shows the whole tool.
// The tool runs in the page and needs no solver or data, so nothing here waits on the network.
// Check them all with  node _ref/guide-check.mjs financingvscash
export const TOOL = {
  path: '../',
  seen: ['fvc-tour-v7-seen'],
  storage: { 'abt:ctrl:/financingvscash/': '1' },   // the Inputs card left open
  // The default plan has been compared and the save and open icons are in.
  ready: (win) => win.document.querySelector('#compTableWrap table') && win.document.querySelector('.scenario-save'),
};

// A Quick Start rebuilds the whole form and runs it at once.
const preset = async (S, key) => {
  await S.click(`.quick-start-btn[data-preset="${key}"]`, { after: 0 });
  await S.until((w) => w.document.querySelector(`.quick-start-btn.active[data-preset="${key}"]`) && w.document.querySelector('#compTableWrap table'), 8000, 'the comparison');
  await S.wait(700);
};
const tab = (S, t) => S.click(`.ctrl-tab[data-tab="${t}"]`, { after: 500 });
// The bar of offers, scrolled into the Inputs card first (a field further down may have moved it out).
const offer = async (S, i) => {
  await S.reveal('.sc-bar', 0.2, 400);
  await settle(S, `.sc-tab[data-idx="${i}"]`);
  await S.click(`.sc-tab[data-idx="${i}"]`, { after: 800 });
};
// A part that may still be moving (a panel scrolling, a note sliding in above it) is clicked
// once it has stood still for a moment.
const settle = async (S, sel) => {
  let last = '', t0 = Date.now();
  await S.until(() => {
    const r = S.doc.querySelector(sel).getBoundingClientRect(), k = r.top + ',' + r.left;
    const still = k === last && Date.now() - t0 > 300;
    last = k;
    return still;
  }, 4000, sel + ' to settle');
};
// The note "Inputs changed" slides in above ▶ Simulate and moves it.
const simulate = async (S, after = 1200) => {
  await settle(S, '#simBtn');
  await S.click('#simBtn', { after: 0 });
  await S.until((w) => !w.document.body.classList.contains('is-stale') && !w.document.getElementById('simBtn').dataset.running, 15000, 'the run');
  await S.wait(after);
};
const toggle = (id) => (S) => { const e = S.doc.getElementById(id); return e && e.closest('label'); };
const park = (S, x = 1200, y = 760) => S.glide(x, y, 500);

export const SCENES = [
  {
    // The screen: the Car Quick Start, Inputs open, down to What this assumes.
    name: 'layout', still: true,
    async run(S) {
      await preset(S, 'car');
      // Off the button, so its tip has gone before the picture is taken.
      await S.glide(1270, 140, 0);
      const t0 = Date.now();
      await S.until(() => Date.now() - t0 > 500, 3000, 'the tip to close');
      return { boxes: {
        inputs: '.layout > .controls',
        answer: ['#verdict', '#simMetrics'],
        chart: '.chart-card',
        tables: ['.detail-section', '.assumes-card'],
      } };
    },
  },
  {
    // A first visit: the inputs are folded to a rail; open them and load a comparison.
    name: 'quickstart', storage: {},
    async run(S) {
      S.begin();
      await S.focus('.ctrl-fold-rail', { pad: 140, after: 400 });
      S.mark('Open the inputs');
      await S.click('.ctrl-fold-rail', { after: 600 });
      S.mark('Pick a comparison');
      await S.focus('.quick-start-row', { pad: 90 });
      await S.moveTo('.quick-start-btn[data-preset="car"]', { ms: 700 });
      await S.wait(2200);
      await S.click('.quick-start-btn[data-preset="car"]', { after: 500 });
      S.mark('Read the answer');
      await S.focus(['#verdict', '#simMetrics'], { pad: 20 });
      await S.moveTo('#kpiNetBenefit', { ms: 800 });
      await S.wait(2600);
      await S.focus(null, { ms: 900 });
      await park(S);
      await S.wait(1200);
    },
  },
  {
    // The Purchase tab: the cash price, the cash on hand, then the Simulate gate.
    name: 'purchase',
    async run(S) {
      await tab(S, 'base');
      S.begin();
      await S.focus('#tab-base', { pad: 30, after: 300 });
      S.mark('The price and your cash');
      await S.fill('#purchaseCost', '45000', { after: 500 });
      await S.reveal('#availableCash', 0.6);
      await S.fill('#availableCash', '60000', { after: 800 });
      S.mark('A price per offer');
      await S.moveTo('#tab-base .toggle-row .tip-icon', { ms: 700 });
      await S.wait(2400);
      S.mark('Simulate');
      await S.focus('.btn-row', { pad: 110 });
      await S.moveTo('#staleNote', { ms: 600 });
      await S.wait(1400);
      await simulate(S, 300);
      await S.focus(['#verdict', '#simMetrics'], { pad: 20 });
      await S.wait(2400);
      await S.focus();
      await park(S);
      await S.wait(800);
    },
  },
  {
    // The Loan offers tab: the bar of offers, a new one, its type, rate, term and fees.
    name: 'offers',
    async run(S) {
      await preset(S, 'car');
      await tab(S, 'scenarios');
      S.begin();
      await S.focus('.sc-bar', { pad: 70, after: 300 });
      S.mark('One tab per offer');
      await offer(S, 1);
      await offer(S, 2);
      S.mark('Add an offer');
      await S.click('#addScenarioBtn', { after: 1000 });
      S.mark('Its loan type');
      await S.reveal('#scLoanType', 0.3);
      await S.focus('#scLoanTypeRow', { pad: 90 });
      await S.choose('#scLoanType', 'Flat rate', { after: 1200 });
      S.mark('Term, rate and fees');
      await S.reveal('#scTerm', 0.3);
      await S.focus(['#scTermRow', '#scRateBlock'], { pad: 60 });
      await S.fill('#scTerm', '36', { after: 400 });
      await S.fill('#scRate', '4.9', { after: 600 });
      await S.reveal('#scFeeAmt', 0.5);
      await S.focus(['#scDownRow', '#scAdminFeeRow'], { pad: 40 });
      await S.slide('#scDownPct', 10, { ms: 900, after: 500 });
      await S.fill('#scFeeAmt', '400', { after: 800 });
      S.mark('Simulate');
      await S.focus();
      await simulate(S, 600);
      await S.scrollTo('.detail-section', 12, 1000);
      await S.focus('.detail-section', { pad: 10 });
      await S.moveTo({ text: 'Effective Annual Rate (EAR)', in: '#compTableWrap' }, { ms: 800 });
      await S.wait(2600);
    },
  },
  {
    // Two loan types with a field of their own: a known repayment, then a fixed rate that floats.
    name: 'types',
    async run(S) {
      await preset(S, 'phone');
      await tab(S, 'scenarios');
      S.begin();
      S.mark('Known repayment');
      await S.focus('.sc-bar', { pad: 70 });
      await offer(S, 1);
      await S.reveal('#scKnownPayment', 0.35);
      await S.focus(['#scKnownPaymentRow', '#scImpliedRateRow'], { pad: 60 });
      S.mark('The rate it implies');
      await S.moveTo('#scImpliedRate', { ms: 700 });
      await S.wait(1200);
      await S.fill('#scKnownPayment', '78', { delay: 220, after: 1600 });
      S.mark('Fixed, then floating');
      await S.focus();
      await preset(S, 'house');
      await offer(S, 1);
      await S.reveal('#scRateScheduleRow', 0.3);
      await S.focus('#scRateScheduleRow', { pad: 50 });
      await S.moveTo('#scRatePeriodRows', { ms: 800 });
      await S.wait(2400);
      S.mark('The band');
      await S.focus();
      await S.scrollTo('.chart-card', 12, 1000);
      const c = await S.box('#chartCanvas');
      await S.focus('.chart-card', { pad: 8 });
      await S.moveTo('#chartCanvas', { at: { x: c.x + c.width * 0.45, y: c.y + c.height * 0.5 }, ms: 800 });
      await S.glide(c.x + c.width * 0.8, c.y + c.height * 0.5, 1600);
      await S.wait(2400);
    },
  },
  {
    // The Assumptions tab: what the cash earns, how a rate is read, inflation, today's money.
    name: 'assume',
    async run(S) {
      await preset(S, 'car');
      await tab(S, 'assume');
      S.begin();
      await S.focus('#tab-assume', { pad: 30, after: 300 });
      S.mark('Risk-Free Rate');
      await S.slide('#baseRf', 6, { ms: 1200, after: 900 });
      S.mark('Rate Convention');
      await S.choose('#rateConvention', 'Nominal annual (APR)', { after: 1500 });
      S.mark('Inflation');
      await S.fill('#inflationRate', '3', { after: 600 });
      await S.moveTo('#inflationNote', { ms: 700 });
      await S.wait(1800);
      S.mark("Show in today's money");
      await S.focus();
      await simulate(S, 900);
      await S.focus(['.money-bar', '#simMetrics'], { pad: 20 });
      await S.click(toggle('inflationToggle'), { after: 2400 });
      await S.click(toggle('inflationToggle'), { after: 1200 });
    },
  },
  {
    // The answer: the verdict, the four figures, the target that picks the best, the table.
    name: 'results',
    async run(S) {
      // The opening plan with cash earning 6%: the 5% loan now beats paying cash, the 7% one does
      // not, and the 7% one still pays the least interest.
      const w = S.win;
      for (const [id, v] of [['baseRf', '6'], ['availableCash', '60,000']]) {
        const e = S.doc.getElementById(id);
        e.value = v;
        e.dispatchEvent(new w.Event('input', { bubbles: true }));
        e.dispatchEvent(new w.Event('change', { bubbles: true }));
      }
      await simulate(S, 300);
      S.begin();
      S.mark('The verdict');
      await S.focus('#verdict', { pad: 30 });
      await S.moveTo('#verdict', { ms: 800 });
      await S.wait(2000);
      S.mark('Four figures');
      await S.focus('#simMetrics', { pad: 16 });
      await S.moveTo('#kpiNetBenefit', { ms: 700 });
      await S.wait(1200);
      await S.moveTo('#kpiCashWealth', { ms: 700 });
      await S.wait(1200);
      S.mark('Optimization Target');
      await S.choose('#optTarget', 'Lowest Total Interest', { after: 1800 });
      await S.choose('#optTarget', 'Highest Net Benefit', { after: 900 });
      S.mark('Scenario Comparison');
      await S.focus();
      await S.scrollTo('.detail-section', 12, 1000);
      await S.focus('.detail-section', { pad: 10 });
      await S.moveTo({ text: 'Net Benefit vs Cash', in: '#compTableWrap' }, { ms: 800 });
      await S.wait(2600);
    },
  },
  {
    // The chart: its four readings, a date read off it, the repayment schedule under it.
    name: 'charts',
    async run(S) {
      await preset(S, 'deferred');
      await S.scrollTo('.chart-card', 12, 600);
      const c = await S.box('#chartCanvas');
      S.begin();
      await S.focus('.chart-card', { pad: 8, after: 300 });
      S.mark('Chart Metric');
      await S.wait(1200);
      await S.click('.chart-switch .seg-btn[data-val="wealth"]', { after: 1500 });
      await S.click('.chart-switch .seg-btn[data-val="netBenefit"]', { after: 1500 });
      await S.click('.chart-switch .seg-btn[data-val="loanBalance"]', { after: 900 });
      S.mark('Read a date');
      await S.moveTo('#chartCanvas', { at: { x: c.x + c.width * 0.25, y: c.y + c.height * 0.5 }, ms: 800 });
      await S.glide(c.x + c.width * 0.36, c.y + c.height * 0.5, 1400);
      await S.wait(1800);
      S.mark('Amortization Schedule');
      await S.focus();
      await S.scrollTo('#amortSection', 12, 900);
      await S.click('#amortSection .fold-btn', { after: 900 });
      await S.focus('#amortSection', { pad: 10 });
      await S.click({ text: '36 payments, 10% off', in: '#amortTabs' }, { after: 1600 });
      await S.click({ text: '12mo holiday, then 24 payments', in: '#amortTabs' }, { after: 1200 });
      await S.moveTo('#downloadBtn', { ms: 700 });
      await S.wait(1600);
    },
  },
  {
    // Optimise: sweep one setting of one offer and read the best, your setting and the worst.
    name: 'optimise',
    async run(S) {
      await preset(S, 'car');
      await tab(S, 'scenarios');
      await S.reveal('#scTermRow', 0.35);
      S.begin();
      await S.focus('#scTermRow', { pad: 90, after: 300 });
      S.mark('Pick a setting');
      await S.click('.opt-btn[data-opt="term"]', { after: 900 });
      S.mark('Set the range');
      await S.focus('.opt-modal', { pad: 30 });
      await S.fill('#optStart', '12', { after: 300 });
      await S.fill('#optEnd', '60', { after: 300 });
      await S.fill('#optSteps', '5', { after: 900 });
      await S.click('#optDoneBtn', { after: 600 });
      S.mark('▶ Optimise');
      await S.focus('.btn-row', { pad: 100 });
      await S.moveTo('#staleNote', { ms: 600 });
      await S.wait(1800);
      await S.click('#simBtn', { after: 0 });
      await S.until((w) => w.document.body.classList.contains('board-opt') && !w.document.getElementById('simBtn').dataset.running, 15000, 'the sweep');
      await S.wait(300);
      S.mark('Best, yours, worst');
      await S.focus(['#verdict', '#optMetrics'], { pad: 16 });
      await S.moveTo('#optBestVal', { ms: 700 });
      await S.wait(1200);
      await S.moveTo('#optWorstVal', { ms: 700 });
      await S.wait(1400);
      await S.focus();
      await S.scrollTo('.chart-card', 12, 900);
      await S.focus('.chart-card', { pad: 8 });
      await S.wait(2400);
      S.mark('Back to comparing');
      await S.focus();
      await S.scrollTop(700);
      await S.click('#optCancelBtn', { after: 700 });
      await simulate(S, 1600);
    },
  },
  {
    // Save, open and share.
    name: 'share',
    async run(S) {
      await preset(S, 'motorbike');
      S.begin();
      S.mark('Save or open a file');
      await S.focus(['.scenario-save', '.scenario-load'], { pad: 120 });
      await S.moveTo('.scenario-save', { ms: 800 });
      await S.wait(1500);
      await S.moveTo('.scenario-load', { ms: 500 });
      await S.wait(1200);
      S.mark('Share');
      await S.focus('.chart-card .share-toggle', { pad: 40 });
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
    // Part 2: the longest bar of the tornado, live. The Car's three-year loan over a longer term,
    // then a shorter one, with Net Benefit on the chart.
    name: 'sensitivity',
    async run(S) {
      await preset(S, 'car');
      await tab(S, 'scenarios');
      await S.click('.chart-switch .seg-btn[data-val="netBenefit"]', { after: 300 });
      await S.reveal('#scTermRow', 0.35);
      await S.scrollTo('#simMetrics', 12, 600);   // the figures and the chart under them; the inputs stay put
      S.begin();
      S.mark('The base case');
      await S.focus(['#kpiNetBenefit', '#chartCanvas'], { pad: 10 });
      await S.moveTo('#kpiNetBenefit', { ms: 800 });
      await S.wait(2000);
      S.mark('A longer term');
      await S.focus('#scTermRow', { pad: 90 });
      await S.fill('#scTerm', '48', { delay: 220, after: 500 });
      await S.focus();
      await simulate(S, 300);
      await S.moveTo('#kpiNetBenefit', { ms: 700 });
      await S.wait(2600);
      S.mark('A shorter term');
      await S.focus('#scTermRow', { pad: 90 });
      await S.fill('#scTerm', '24', { delay: 220, after: 500 });
      await S.focus();
      await simulate(S, 300);
      await S.moveTo('#kpiNetBenefit', { ms: 700 });
      await S.wait(2600);
    },
  },
];
