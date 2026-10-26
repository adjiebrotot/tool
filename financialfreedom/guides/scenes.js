// The Financial Freedom Calculator guide's live demos: guide-live.js opens the tool in a frame of
// this page and plays each scene in it. Before S.begin() a scene sets itself up, unseen; S.mark('...')
// names the moments the guide's steps refer to, in order (the guide's list under the demo has one
// item per mark); S.focus(part) zooms in on what a step is about, S.focus() shows the whole tool.
// Most scenes start from the Moderate FIRE Quick Start, the plan Part 2 works through by hand.
// Check them all with  node _ref/guide-check.mjs financialfreedom
export const TOOL = {
  path: '../',
  seen: ['ff-tour-v5-seen'],
  storage: { 'abt:ctrl:/financialfreedom/': '1' },   // the Inputs card left open
  ready: (win) => win.__FF && win.__FF.last,
};

// A Quick Start, loaded at once while the scene sets up (the same call its button makes).
const plan = async (S, key) => { S.win.__FF.applyQuickStart(key); await S.wait(500); };
const tab = (S, name) => S.click(`.ctrl-tab[data-tab="${name}"]`, { after: 500 });
// Simulate, then the answer it gives: the banner and the three cards above the chart.
const simulate = async (S, after) => {
  await S.focus('.btn-row', { pad: 120 });
  await S.click('#simBtn', { after: 500 });
  await S.focus(['#verdict', '.metrics-3'], { pad: 24, after: after == null ? 2200 : after });
};
const toggle = (sel) => (S) => { const e = S.doc.querySelector(sel); return e && e.closest('.toggle-switch'); };
const park = (S, x = 1150, y = 760) => S.glide(x, y, 500);

export const SCENES = [
  {
    // The screen: Moderate FIRE, Inputs open, down to What this assumes.
    name: 'layout', still: true,
    async run(S) {
      await plan(S, 'moderate');
      return { boxes: {
        inputs: '.layout > .controls',
        path: ['#verdict', '#boardPath'],
        cash: '#boardCash',
        assumes: '.assumes-card',
      } };
    },
  },
  {
    // A first visit: the inputs are folded to a rail; open them and load a worked plan.
    name: 'quickstart', storage: {},
    async run(S) {
      S.begin();
      await S.focus('.ctrl-fold-rail', { pad: 140, after: 400 });
      S.mark('Open the inputs');
      await S.click('.ctrl-fold-rail', { after: 600 });
      S.mark('Pick a plan');
      await S.focus('.quick-start-row', { pad: 60 });
      await S.moveTo('.quick-start-btn[data-preset="frugal"]', { ms: 700 });
      await S.wait(2200);
      await S.click('.quick-start-btn[data-preset="frugal"]', { after: 300 });
      await S.focus(null, { ms: 900 });
      await park(S);
      await S.wait(2600);
    },
  },
  {
    // The You tab: the ages, Money in, Money out, then Simulate.
    name: 'you',
    async run(S) {
      await plan(S, 'moderate');
      S.begin();
      S.mark('Ages');
      await S.focus(['#currency', '#ageDie'], { pad: 40 });
      await S.moveTo('#ageNow', { ms: 700 });
      await S.wait(700);
      await S.moveTo('#ageDie', { ms: 500 });
      await S.wait(900);
      S.mark('Money in');
      await S.reveal('#savingsRow', 0.35);
      await S.focus(['#savingsModeGroup', '#growthRow'], { pad: 30 });
      await S.moveTo('#savingsModeGroup', { ms: 600 });
      await S.wait(900);
      await S.fill('#savings', '50000', { after: 600 });
      await S.moveTo('#growth', { ms: 500 });
      await S.wait(800);
      S.mark('Money out');
      await S.reveal('#livingRow', 0.3);
      await S.focus(['#livingRow', '#retireRow'], { pad: 30 });
      await S.moveTo('#expense', { ms: 600 });
      await S.wait(700);
      await S.fill('#retireExpense', '80', { after: 900 });
      S.mark('Simulate');
      await simulate(S);
    },
  },
  {
    // Life stages on both sides: Frugal Living's hustle age, part-time work and the age pension.
    name: 'stages',
    async run(S) {
      await plan(S, 'frugal');
      S.begin();
      S.mark('Detailed');
      await S.reveal('#incomeModeGroup', 0.1);
      await S.focus(['#incomeModeGroup', '#inStageRows .stage-row:first-child'], { pad: 30 });
      await S.moveTo('#incomeModeGroup', { ms: 700 });
      await S.wait(1200);
      S.mark('A stage of income');
      await S.reveal('#inStageRows .stage-row:nth-child(2)', 0.2);
      await S.focus('#inStageRows .stage-row:nth-child(2)', { pad: 24 });
      await S.moveTo('#inStageRows .stage-row:nth-child(2) .in-amount', { ms: 600 });
      await S.wait(800);
      await S.moveTo(toggle('#inStageRows .stage-row:nth-child(2) .in-keeps'), { ms: 600 });
      await S.wait(1400);
      S.mark('A stage of spending');
      await S.reveal('#stageRows .stage-row:nth-child(2)', 0.25);
      await S.focus('#stageRows .stage-row:nth-child(2)', { pad: 24 });
      await S.moveTo('#stageRows .stage-row:nth-child(2) .stage-from', { ms: 600 });
      await S.wait(700);
      await S.fill('#stageRows .stage-row:nth-child(2) .stage-amount', '130', { after: 900 });
      S.mark('The timeline');
      await S.reveal('#stageTimeline', 0.25);
      await S.focus('#stageTimeline', { pad: 24 });
      await S.moveTo('#stageTimeline', { ms: 700 });
      await S.wait(1600);
      S.mark('On the chart');
      await S.focus('.btn-row', { pad: 120 });
      await S.click('#simBtn', { after: 600 });
      await S.focus();
      await S.scrollTo('#boardCash .chart-card', 12, 1000);
      await S.focus('#boardCash .chart-card', { pad: 8 });
      await S.click('#stageViewGroup .seg-btn[data-val="in"]', { after: 1800 });
      await S.click('#stageViewGroup .seg-btn[data-val="out"]', { after: 1600 });
    },
  },
  {
    // The Investment tab: what you hold, the asset, its return and volatility, a ticker.
    name: 'invest',
    async run(S) {
      await plan(S, 'moderate');
      S.begin();
      await S.focus('.ctrl-tabs', { pad: 150, after: 300 });
      S.mark('Invested assets');
      await tab(S, 'invest');
      await S.focus(['.ctrl-tabs', '#assets'], { pad: 40 });
      await S.fill('#assets', '150000', { after: 800 });
      S.mark('Pick an asset');
      await S.focus(['#assetPreset', '#std'], { pad: 60 });
      await S.choose('#assetPreset', 'Equity - Australia (ASX)', { after: 1200 });
      S.mark('Return and volatility');
      await S.reveal('#std', 0.6);
      await S.focus(['#ret', '#std'], { pad: 60 });
      await S.moveTo('#ret', { ms: 600 });
      await S.wait(900);
      await S.moveTo('#std', { ms: 500 });
      await S.wait(900);
      await simulate(S, 1800);
      S.mark('A real ticker');
      await S.reveal('.ticker-row', 0.5);
      await S.focus('.ticker-row', { pad: 110 });
      await S.moveTo('#ticker', { ms: 600 });
      await S.wait(800);
      await S.moveTo('#fetchTickerBtn', { ms: 500 });
      await S.wait(1600);
    },
  },
  {
    // The Goal tab: what the money should do.
    name: 'goal',
    async run(S) {
      await plan(S, 'moderate');
      S.begin();
      await S.focus('.ctrl-tabs', { pad: 150, after: 300 });
      S.mark('Just Die');
      await tab(S, 'goal');
      await S.focus('#modeGroup', { pad: 30 });
      await S.moveTo('#modeGroup .radio-opt:nth-child(1)', { ms: 700 });
      await S.wait(1400);
      S.mark('Leave a Legacy');
      await S.click('#modeGroup .radio-opt:nth-child(2)', { after: 700 });
      await S.focus(['#modeGroup', '#legacyRow'], { pad: 24 });
      await S.fill('#legacy', '750000', { after: 800 });
      await simulate(S, 2000);
      S.mark('Die Rich');
      await S.focus('#modeGroup', { pad: 30 });
      await S.click('#modeGroup .radio-opt:nth-child(3)', { after: 800 });
      await simulate(S, 2400);
    },
  },
  {
    // The Assumptions tab: inflation, then how sure the answer has to be.
    name: 'assumptions',
    async run(S) {
      await plan(S, 'moderate');
      S.begin();
      await S.focus('.ctrl-tabs', { pad: 150, after: 300 });
      S.mark('Inflation');
      await tab(S, 'settings');
      await S.focus(['#inflation', '#inflationNote'], { pad: 40 });
      await S.moveTo('#inflationNote', { ms: 700 });
      await S.wait(1800);
      S.mark('Confidence level');
      await S.focus(['#chance', '#confidence'], { pad: 60 });
      await S.fill('#confidence', '95', { after: 600 });
      await S.focus('.btn-row', { pad: 120 });
      await S.click('#simBtn', { after: 500 });
      await S.focus();
      await S.scrollTo('#mSuccess', 160, 900);
      await S.focus('#mSuccess', { pad: 60 });
      await S.moveTo('#mSuccessSub', { ms: 700 });
      await S.wait(2200);
      await S.focus();
      await S.scrollTop(700);
      S.mark('Investment outcome chance');
      await S.focus(['#chance', '#confidence'], { pad: 60 });
      await S.fill('#chance', '90', { after: 600 });
      await simulate(S, 900);
      await S.focus();
      await S.scrollTo('#boardPath .chart-card', 12, 900);
      await S.focus('#boardPath .chart-card', { pad: 8, after: 2600 });
    },
  },
  {
    // Path to freedom: the answer, the chart, today's money or the money of the day.
    name: 'path',
    async run(S) {
      await plan(S, 'moderate');
      S.begin();
      S.mark('The answer');
      await S.focus(['#verdict', '.metrics-3'], { pad: 20 });
      await S.moveTo('#mFreeAge', { ms: 700 });
      await S.wait(1000);
      await S.moveTo('#mFreePot', { ms: 600 });
      await S.wait(1000);
      await S.moveTo('#mRealRet', { ms: 600 });
      await S.wait(1000);
      S.mark('The chart');
      await S.focus();
      await S.scrollTo('#boardPath .chart-card', 12, 900);
      await S.focus('#boardPath .chart-card', { pad: 8 });
      const c = await S.box('#ffChart');
      await S.moveTo('#ffChart', { at: { x: c.x + c.width * 0.2, y: c.y + c.height * 0.5 }, ms: 700 });
      await S.glide(c.x + c.width * 0.6, c.y + c.height * 0.5, 1800);
      await S.wait(1400);
      S.mark("Today's money");
      await S.focus();
      await S.scrollTop(800);
      await S.focus('.money-toggle', { pad: 160 });
      await S.click(toggle('#showReal'), { after: 600 });
      await S.focus(['.money-toggle', '.metrics-3'], { pad: 20, after: 2000 });
      await S.click(toggle('#showReal'), { after: 1400 });
    },
  },
  {
    // Cashflows: the Retire at slider, its verdict and cards, the chart.
    name: 'cashflows',
    async run(S) {
      await plan(S, 'moderate');
      await S.scrollTo('#boardCash', 12, 0);
      S.begin();
      S.mark('Retire at');
      await S.focus(['#retireSlider', '#verdictSlider'], { pad: 20 });
      await S.slide('#ageRetire', 40, { ms: 1400, after: 2000 });
      S.mark('The verdict and the cards');
      await S.focus(['#verdictSlider', '#boardCash .metrics'], { pad: 20 });
      await S.moveTo('#verdictSlider', { ms: 700 });
      await S.wait(1800);
      await S.focus(['#retireSlider', '#boardCash .metrics'], { pad: 20 });
      await S.slide('#ageRetire', 52, { ms: 1600, after: 1400 });
      await S.moveTo('#mSuccess', { ms: 600 });
      await S.wait(1600);
      S.mark('Cashflows and balance');
      await S.focus();
      await S.scrollTo('#boardCash .chart-card', 12, 900);
      await S.focus('#boardCash .chart-card', { pad: 8 });
      const c = await S.box('#ddChart');
      await S.moveTo('#ddChart', { at: { x: c.x + c.width * 0.15, y: c.y + c.height * 0.3 }, ms: 700 });
      await S.glide(c.x + c.width * 0.7, c.y + c.height * 0.3, 1800);
      await S.wait(1600);
    },
  },
  {
    // Year by year, and what the answer assumes.
    name: 'table',
    async run(S) {
      await plan(S, 'moderate');
      await S.scrollTo('#boardCash .detail-section', 300, 0);
      S.begin();
      S.mark('Year by year');
      await S.click('#boardCash .detail-section .fold-btn', { after: 900 });
      await S.scrollTo('#boardCash .detail-section', 12, 900);
      await S.focus('#boardCash .detail-section', { pad: 8 });
      await S.moveTo('#tableWrap', { ms: 800 });
      await S.wait(1200);
      await S.moveTo('#csvBtn', { ms: 600 });
      await S.wait(1200);
      S.mark('What this assumes');
      await S.focus();
      await S.scrollTo('.assumes-card', 300, 900);
      await S.click('.assumes-card .fold-btn', { after: 700 });
      await S.scrollTo('.assumes-card', 60, 900);
      await S.focus('.assumes-card', { pad: 8 });
      await S.moveTo('#assumptions', { ms: 800 });
      await S.wait(2400);
    },
  },
  {
    // Save, open and Share.
    name: 'share',
    async run(S) {
      await plan(S, 'moderate');
      S.begin();
      S.mark('Save or open a file');
      await S.focus(['.scenario-save', '.scenario-load'], { pad: 120 });
      await S.moveTo('.scenario-save', { ms: 800 });
      await S.wait(1500);
      await S.moveTo('.scenario-load', { ms: 500 });
      await S.wait(1200);
      S.mark('Share');
      await S.focus();
      await S.scrollTo('#boardPath .chart-card', 12, 900);
      await S.focus('#boardPath .share-toggle', { pad: 60 });
      await S.click('#boardPath .share-toggle', { after: 300 });
      await S.focus(['#boardPath .share-toggle', '[role=menu]'], { pad: 30 });
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
    // Part 2: the input the freedom age leans on most, moved up and then down.
    name: 'sense',
    async run(S) {
      await plan(S, 'moderate');
      await tab(S, 'settings');
      S.begin();
      S.mark('Raise inflation');
      await S.focus(['#inflation', '#inflationNote'], { pad: 40 });
      await S.fill('#inflation', '3.5', { delay: 220, after: 600 });
      await simulate(S, 900);
      await S.focus();
      await S.scrollTo('#boardPath .chart-card', 12, 900);
      await S.focus('#boardPath .chart-card', { pad: 8, after: 2400 });
      await S.focus();
      await S.scrollTop(800);
      S.mark('Lower it');
      await S.focus(['#inflation', '#inflationNote'], { pad: 40 });
      await S.fill('#inflation', '1.5', { delay: 220, after: 600 });
      await simulate(S, 900);
      await S.focus();
      await S.scrollTo('#boardPath .chart-card', 12, 900);
      await S.focus('#boardPath .chart-card', { pad: 8, after: 2400 });
      await S.focus();
      await S.scrollTop(800);
      S.mark('Back to the base case');
      await S.focus(['#inflation', '#inflationNote'], { pad: 40 });
      await S.fill('#inflation', '2.5', { delay: 220, after: 600 });
      await simulate(S, 2600);
    },
  },
];
