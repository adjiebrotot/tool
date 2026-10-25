// The Capacity Expansion Planner guide's scenes: each drives the real tool and returns the crop
// (x, y, w, h of the page) and encoding options. S.mark('...') names the moments the guide's steps
// refer to, in order (the guide's list has one item per mark, in the same order). Run them with
//   node _ref/guide-capture/run.mjs capacity-expansion-planner [scene ...] [--theme light|dark]
import { sleep } from '../../../_ref/guide-capture/lib.mjs';

const OPEN = { 'abt:ctrl:/capacity-expansion-planner/': '1' };     // the Inputs card left open
export const TOOL = {
  path: '/capacity-expansion-planner/',
  seen: ['capacityexpansion-planner-tour-v2-seen'],
  storage: OPEN,
  ready: async (page) => {
    await page.waitForFunction(() => window.CXApp && window.CXApp.res && !document.querySelector('#runBtn[disabled]'), null, { timeout: 60000 });
    await page.waitForTimeout(800);
  },
};

const H = 800;
const solved = async (S) => {
  // A run disables Run plan until it ends: wait for it to start (if it has not yet), then to end.
  await S.page.waitForSelector('#runBtn[disabled]', { timeout: 3000 }).catch(() => {});
  await S.page.waitForFunction(() => window.CXApp.res && !document.querySelector('#runBtn[disabled]'), null, { timeout: 120000 });
  await sleep(900);
};
const preset = async (S, key) => { await S.page.click(`.quick-start-btn[data-preset="${key}"]`); await solved(S); };
const park = (S, x = 1150, y = 700) => S.glide(x, y, 500);
const tab = (S, t, after = 900) => S.click(`.ctrl-tab[data-tab="${t}"]`, { after });
const inPanel = async (S, sel, at = 0.5) => {
  await S.page.evaluate(([s, k]) => {
    const e = document.querySelector(s), c = e.closest('.ctrl-scroll');
    c.scrollTo({ top: e.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop - c.clientHeight * k, behavior: 'smooth' });
  }, [sel, at]);
  await sleep(800);
};
const choose = async (S, sel, text) => {
  await S.click(sel, { after: 700 });
  const opt = S.page.locator(`.combo-list .combo-opt:has-text("${text}")`).first();
  if (await opt.count() && await opt.isVisible()) await S.click(opt, { after: 900 });
  else { await S.page.keyboard.press('Escape'); await S.page.selectOption(sel, { label: text }); await sleep(900); }
};
const typeIn = async (S, sel, text) => {
  await S.click(sel, { after: 250 });
  await S.page.keyboard.press('Control+A');
  await S.type(sel, text, 150);
  await S.page.keyboard.press('Tab');
  await sleep(700);
};
// Drag a range input's thumb to a value.
const slide = async (S, sel, v) => {
  const [min, max, cur] = await S.page.evaluate((s) => { const e = document.querySelector(s); return [+e.min, +e.max, +e.value]; }, sel);
  const b = await S.box(sel);
  const x = (val) => b.x + 8 + (b.width - 16) * (val - min) / (max - min);
  await S.drag({ x: x(cur), y: b.y + b.height / 2 }, { x: x(v), y: b.y + b.height / 2 }, { ms2: 1000, after: 700 });
};

export const SCENES = [
  {
    name: 'layout', still: true, h: 1400,
    async run(S) {
      await S.page.mouse.move(1270, 1390);
      await sleep(600);
      return { boxes: {
        inputs: '.layout > .controls',
        answer: ['#verdict', '.metrics.cx-result'],
        charts: ['#capCard', '#energyCard'],
      } };
    },
  },
  {
    name: 'quickstart', h: H, storage: {},
    async run(S) {
      await sleep(400);
      S.begin();
      S.mark('Open the inputs');
      await S.click('.ctrl-fold-rail', { after: 300 });
      await park(S, 800, 600);
      await sleep(700);
      S.mark('Pick an example');
      await S.moveTo('.quick-start-btn[data-preset="nz"]', { ms: 700 });
      await sleep(2000);
      await S.click('.quick-start-btn[data-preset="nz"]', { after: 200 });
      await park(S, 1000, 600);
      await solved(S);
      await sleep(2200);
      return { crop: [0, 0, 1280, H] };
    },
  },
  {
    // Demand: the peak and its growth, the climate and the day, the years.
    name: 'demand', h: H,
    async run(S) {
      S.begin();
      S.mark('Peak and growth');
      await typeIn(S, '#cxPeak', '1200');
      await slide(S, '#cxGrowth', 4);
      S.mark('Climate and profile');
      await inPanel(S, '#cxClimate', 0.3);
      await choose(S, '#cxClimate', 'Winter peak, Jun to Aug');
      await choose(S, '#cxProfile', 'Residential');
      const b = await S.box('#loadProf svg[data-bars="h"]');
      const px = (h, v) => ({ x: b.x + (h * 10 + 5 + 8) / 256 * b.width, y: b.y + (58 - 54 * v + 14) / 90 * b.height });
      await S.drag(px(16, 0.7), px(20, 1), { ms2: 1200, after: 1000 });
      S.mark('Planning years');
      await inPanel(S, '#cxStep', 0.5);
      await S.moveTo('#cxEnd', { ms: 600 });
      await sleep(600);
      await choose(S, '#cxStep', '3 yrs');
      await S.moveTo('#yearsNote', { ms: 600 });
      await sleep(1600);
      return { crop: [0, 0, 1280, H] };
    },
  },
  {
    // Supply: what is in service, what can be built, a new technology.
    name: 'supply', h: H,
    async run(S) {
      const { page } = S;
      S.begin();
      S.mark('In service and to build');
      await tab(S, 'tech');
      await S.moveTo('.tech-card[data-id="1"] .tech-sum', { ms: 700 });
      await sleep(900);
      S.mark('Open a technology');
      await S.click('.tech-card[data-id="4"] .tech-toggle', { after: 900 });
      await inPanel(S, '.tech-card[data-id="4"] .tech-body', 0.3);
      await S.moveTo('.tech-card[data-id="4"] [data-k="capex"]', { ms: 700 });
      await sleep(1200);
      S.mark('Detailed');
      await inPanel(S, '#cxDetail', 0.3);
      const det = page.locator('.detail-row .seg-btn:has-text("Detailed")');
      if (await det.count()) await S.click(det, { after: 1000 });
      else await choose(S, '#cxDetail', 'Detailed');
      await inPanel(S, '.tech-card[data-id="4"] [data-k="life"]', 0.4);
      await S.moveTo('.tech-card[data-id="4"] [data-k="life"]', { ms: 700 });
      await sleep(1200);
      S.mark('Add a technology');
      await inPanel(S, '#addTechBtn', 0.3);
      await S.click('#addTechBtn', { after: 500 });
      await inPanel(S, '.add-opt[data-key="nuclear"]', 0.6);
      await S.click('.add-opt[data-key="nuclear"]', { after: 600 });
      await inPanel(S, '#techList .tech-card:last-child', 0.4);
      await S.moveTo('#techList .tech-card:last-child .tech-head', { ms: 600 });
      await sleep(2000);
      return { crop: [0, 0, 1280, H] };
    },
  },
  {
    // Policy, then run: a carbon price and a net-zero year, and the answer that follows.
    name: 'policy', h: H,
    async run(S) {
      const { page } = S;
      S.begin();
      S.mark('Reliability');
      await tab(S, 'policy');
      await S.moveTo('#cxVoll', { ms: 700 });
      await sleep(900);
      S.mark('Carbon price');
      await inPanel(S, '#cxCarbon', 0.35);
      await typeIn(S, '#cxCarbon', '40');
      await slide(S, '#cxCarbonGrow', 5);
      S.mark('Net-zero year');
      await inPanel(S, '.toggle-switch:has(#cxNetZero)', 0.45);
      await S.click('.toggle-switch:has(#cxNetZero)', { after: 900 });
      await S.moveTo('#cxNzYear', { ms: 600 });     // 2045 already; typed a digit at a time it would clamp on the way
      await sleep(900);
      S.mark('Run the plan');
      await S.click('#runBtn', { after: 200 });
      await park(S, 820, 230);
      await solved(S);
      await sleep(2400);
      return { crop: [0, 0, 1280, H] };
    },
  },
  {
    // Assumptions: the discount rate, the typical days, the solver.
    name: 'assume', h: H,
    async run(S) {
      S.begin();
      S.mark('Discount rate');
      await tab(S, 'assume');
      await choose(S, '#cxRateMode', 'Nominal');
      await S.moveTo('#realRateNote', { ms: 700 });
      await sleep(1400);
      S.mark('Typical days');
      await inPanel(S, '.toggle-switch:has(#cxStress)', 0.5);
      await S.moveTo('#sampleWhy', { ms: 700 });
      await sleep(900);
      await S.click('.toggle-switch:has(#cxStress)', { after: 1000 });
      await S.moveTo('#sampleNote', { ms: 600 });
      await sleep(1400);
      S.mark('Solver');
      await inPanel(S, '#cxTime', 0.6);
      await S.moveTo('#cxTime', { ms: 600 });
      await sleep(1600);
      return { crop: [0, 0, 1280, H] };
    },
  },
  {
    // The answer and the charts: capacity, then a decision year's typical days.
    name: 'charts', h: H, storage: {},
    async run(S) {
      const { page } = S;
      await page.evaluate(() => window.scrollTo(0, 0));
      S.begin();
      S.mark('The answer');
      await S.moveTo('#verdict', { ms: 800 });
      await sleep(2200);
      S.mark('Capacity and when to build');
      await S.scrollTo('#capCard', 12, 1000);
      const c = await S.box('#capCanvas');
      await S.glide(c.x + c.width * 0.15, c.y + c.height * 0.6, 700);
      await S.glide(c.x + c.width * 0.55, c.y + c.height * 0.6, 1600);
      await sleep(900);
      S.mark('Click a year');
      await S.click('#capCanvas', { at: { x: c.x + c.width * 0.55, y: c.y + c.height * 0.6 }, after: 1800 });
      const d = await S.box('#dayCanvas');
      await S.glide(d.x + d.width * 0.12, d.y + d.height * 0.4, 700);
      await S.glide(d.x + d.width * 0.45, d.y + d.height * 0.4, 1600);
      await sleep(700);
      S.mark('Energy and cost');
      await S.scrollTo('#costCard', 12, 1100);
      const k = await S.box('#costCanvas');
      await S.glide(k.x + k.width * 0.7, k.y + k.height * 0.5, 800);
      await sleep(1800);
      return { crop: [0, 0, 1280, H] };
    },
  },
  {
    name: 'results', h: H, storage: {},
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
      await sleep(1200);
      return { crop: [0, 0, 1280, H] };
    },
  },
  {
    name: 'share', h: H,
    async run(S) {
      const { page } = S;
      S.begin();
      S.mark('Save or open a file');
      await S.moveTo('.scenario-save', { ms: 800 });
      await sleep(1300);
      await S.moveTo('.scenario-load', { ms: 500 });
      await sleep(1000);
      S.mark('Share a chart');
      await S.scrollTo('#capCard', 12, 900);
      await S.click('#capCard .share-toggle', { after: 1200 });
      for (const t of ['Download as PNG', 'Share as link', 'Embed as HTML']) {
        await S.moveTo(page.locator(`[role=menu] :text("${t}")`).first(), { ms: 500 });
        await sleep(900);
      }
      await page.keyboard.press('Escape');
      await park(S);
      await sleep(800);
      return { crop: [0, 0, 1280, H] };
    },
  },
];
