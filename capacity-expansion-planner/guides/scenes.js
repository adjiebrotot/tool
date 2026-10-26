// The Capacity Expansion Planner guide's live demos: guide-live.js opens the tool in a frame of
// this page and plays each scene in it. Before S.begin() a scene sets itself up, unseen;
// S.mark('...') names the moments the guide's steps refer to, in order (the guide's list under
// the demo has one item per mark). A run a scene starts is solved ahead by _ref/presolve.mjs
// (S.note('solved') tells it when), so a demo never fetches the solver. Check them all with
//   node _ref/guide-check.mjs capacity-expansion-planner
export const TOOL = {
  path: '../',
  seen: ['capacityexpansion-planner-tour-v2-seen'],
  storage: { 'abt:ctrl:/capacity-expansion-planner/': '1' },   // the Inputs card left open
  ready: (win) => win.CXApp && win.CXApp.res && !win.document.querySelector('#runBtn[disabled]'),
};

const toggle = (id) => (S) => { const e = S.doc.getElementById(id); return e && e.closest('.toggle-switch'); };
// Solved: the result on screen is for the plan on screen, and Run plan is free again.
const solved = async (S) => {
  await S.until((w) => { const x = w.__cx; return x && x.app.res && x.app.solvedKey === x.solveKey() && !w.document.querySelector('#runBtn[disabled]'); }, 120000, 'the solve');
  await S.note('solved');
  await S.wait(900);
};
const park = (S, x = 1150, y = 700) => S.glide(x, y, 500);
const tab = (S, t, after = 900) => S.click(`.ctrl-tab[data-tab="${t}"]`, { after });

export const SCENES = [
  {
    name: 'layout', still: true,
    async run() {
      return { boxes: {
        inputs: '.layout > .controls',
        answer: ['#verdict', '.metrics.cx-result'],
        charts: ['#capCard', '#energyCard'],
      } };
    },
  },
  {
    name: 'quickstart', storage: {},
    async run(S) {
      S.begin();
      await S.wait(400);
      S.mark('Open the inputs');
      await S.click('.ctrl-fold-rail', { after: 300 });
      await park(S, 800, 600);
      await S.wait(700);
      S.mark('Pick an example');
      await S.moveTo('.quick-start-btn[data-preset="nz"]', { ms: 700 });
      await S.wait(2000);
      await S.click('.quick-start-btn[data-preset="nz"]', { after: 200 });
      await park(S, 1000, 600);
      await solved(S);
      await S.wait(2200);
    },
  },
  {
    // Demand: the peak and its growth, the climate and the day, the years.
    name: 'demand',
    async run(S) {
      S.begin();
      S.mark('Peak and growth');
      await S.fill('#cxPeak', '1200', { delay: 150 });
      await S.slide('#cxGrowth', 4);
      S.mark('Climate and profile');
      await S.reveal('#cxClimate', 0.3);
      await S.choose('#cxClimate', 'Winter peak, Jun to Aug');
      await S.choose('#cxProfile', 'Residential');
      const b = await S.box('#loadProf svg[data-bars="h"]');
      const px = (h, v) => ({ x: b.x + (h * 10 + 5 + 8) / 256 * b.width, y: b.y + (58 - 54 * v + 14) / 90 * b.height });
      await S.drag(px(16, 0.7), px(20, 1), { ms2: 1200, after: 1000 });
      S.mark('Planning years');
      await S.reveal('#cxStep', 0.5);
      await S.moveTo('#cxEnd', { ms: 600 });
      await S.wait(600);
      await S.choose('#cxStep', '3 yrs');
      await S.moveTo('#yearsNote', { ms: 600 });
      await S.wait(1600);
    },
  },
  {
    // Supply: what is in service, what can be built, a new technology.
    name: 'supply',
    async run(S) {
      S.begin();
      S.mark('In service and to build');
      await tab(S, 'tech');
      await S.moveTo('.tech-card[data-id="1"] .tech-sum', { ms: 700 });
      await S.wait(900);
      S.mark('Open a technology');
      await S.click('.tech-card[data-id="4"] .tech-toggle', { after: 900 });
      await S.reveal('.tech-card[data-id="4"] .tech-body', 0.3);
      await S.moveTo('.tech-card[data-id="4"] [data-k="capex"]', { ms: 700 });
      await S.wait(1200);
      S.mark('Detailed');
      await S.reveal('#cxDetail', 0.3);
      const det = (S) => [].slice.call(S.doc.querySelectorAll('.detail-row .seg-btn')).filter(b => b.textContent.indexOf('Detailed') >= 0)[0];
      if (det(S)) await S.click(det, { after: 1000 });
      else await S.choose('#cxDetail', 'Detailed');
      await S.reveal('.tech-card[data-id="4"] [data-k="life"]', 0.4);
      await S.moveTo('.tech-card[data-id="4"] [data-k="life"]', { ms: 700 });
      await S.wait(1200);
      S.mark('Add a technology');
      await S.reveal('#addTechBtn', 0.3);
      await S.click('#addTechBtn', { after: 500 });
      await S.reveal('.add-opt[data-key="nuclear"]', 0.6);
      await S.click('.add-opt[data-key="nuclear"]', { after: 600 });
      await S.reveal('#techList .tech-card:last-child', 0.4);
      await S.moveTo('#techList .tech-card:last-child .tech-head', { ms: 600 });
      await S.wait(2000);
    },
  },
  {
    // Policy, then run: a carbon price and a net-zero year, and the answer that follows.
    name: 'policy',
    async run(S) {
      S.begin();
      S.mark('Reliability');
      await tab(S, 'policy');
      await S.moveTo('#cxVoll', { ms: 700 });
      await S.wait(900);
      S.mark('Carbon price');
      await S.reveal('#cxCarbon', 0.35);
      await S.fill('#cxCarbon', '40', { delay: 150 });
      await S.slide('#cxCarbonGrow', 5);
      S.mark('Net-zero year');
      await S.reveal(toggle('cxNetZero'), 0.45);
      await S.click(toggle('cxNetZero'), { after: 900 });
      await S.moveTo('#cxNzYear', { ms: 600 });     // 2045 already; typed a digit at a time it would clamp on the way
      await S.wait(900);
      S.mark('Run the plan');
      await S.click('#runBtn', { after: 200 });
      await park(S, 820, 230);
      await solved(S);
      await S.wait(2400);
    },
  },
  {
    // Assumptions: the discount rate, the typical days, the solver.
    name: 'assume',
    async run(S) {
      S.begin();
      S.mark('Discount rate');
      await tab(S, 'assume');
      await S.choose('#cxRateMode', 'Nominal');
      await S.moveTo('#realRateNote', { ms: 700 });
      await S.wait(1400);
      S.mark('Typical days');
      await S.reveal(toggle('cxStress'), 0.5);
      await S.moveTo('#sampleWhy', { ms: 700 });
      await S.wait(900);
      await S.click(toggle('cxStress'), { after: 1000 });
      await S.moveTo('#sampleNote', { ms: 600 });
      await S.wait(1400);
      S.mark('Solver');
      await S.reveal('#cxTime', 0.6);
      await S.moveTo('#cxTime', { ms: 600 });
      await S.wait(1600);
    },
  },
  {
    // The answer and the charts: capacity, then a decision year's typical days.
    name: 'charts', storage: {},
    async run(S) {
      S.win.scrollTo(0, 0);
      S.begin();
      S.mark('The answer');
      await S.moveTo('#verdict', { ms: 800 });
      await S.wait(2200);
      S.mark('Capacity and when to build');
      await S.scrollTo('#capCard', 12, 1000);
      const c = await S.box('#capCanvas');
      await S.glide(c.x + c.width * 0.15, c.y + c.height * 0.6, 700);
      await S.glide(c.x + c.width * 0.55, c.y + c.height * 0.6, 1600);
      await S.wait(900);
      S.mark('Click a year');
      await S.click('#capCanvas', { at: { x: c.x + c.width * 0.55, y: c.y + c.height * 0.6 }, after: 1800 });
      const d = await S.box('#dayCanvas');
      await S.glide(d.x + d.width * 0.12, d.y + d.height * 0.4, 700);
      await S.glide(d.x + d.width * 0.45, d.y + d.height * 0.4, 1600);
      await S.wait(700);
      S.mark('Energy and cost');
      await S.scrollTo('#costCard', 12, 1100);
      const k = await S.box('#costCanvas');
      await S.glide(k.x + k.width * 0.7, k.y + k.height * 0.5, 800);
      await S.wait(1800);
    },
  },
  {
    name: 'results', storage: {},
    async run(S) {
      await S.scrollTo('#costCard', 0, 900);
      await S.scrollTo('#tablesCard', 500, 900);
      S.begin();
      S.mark('Open the tables');
      await S.click('#tablesCard .detail-head > button:last-child, #tablesCard .detail-head [aria-expanded]', { after: 1000 });
      await S.scrollTo('#tablesCard', 90, 900);
      S.mark('Pick a table');
      for (const t of ['build', 'energy', 'cost', 'year']) await S.click(`#tableTabs .seg-btn[data-val="${t}"]`, { after: 1300 });
      await S.moveTo('#csvBtn', { ms: 700 });
      await S.wait(1200);
    },
  },
  {
    name: 'share',
    async run(S) {
      S.begin();
      S.mark('Save or open a file');
      await S.moveTo('.scenario-save', { ms: 800 });
      await S.wait(1300);
      await S.moveTo('.scenario-load', { ms: 500 });
      await S.wait(1000);
      S.mark('Share a chart');
      await S.scrollTo('#capCard', 12, 900);
      await S.click('#capCard .share-toggle', { after: 1200 });
      for (const t of ['Download as PNG', 'Share as link', 'Embed as HTML']) {
        await S.moveTo({ text: t, in: '[role=menu]' }, { ms: 500 });
        await S.wait(900);
      }
      await S.key('Escape');
      await park(S);
      await S.wait(800);
    },
  },
];
