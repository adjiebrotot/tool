// The ED/UC Simulator guide's scenes: each drives the real tool and returns the crop (x, y, w, h of
// the page) and encoding options. S.mark('...') names the moments the guide's steps refer to, in
// order (the guide's list has one item per mark, in the same order). Run them with
//   node _ref/guide-capture/run.mjs ed-uc-simulator [scene ...] [--theme light|dark]
import { sleep } from '../../../_ref/guide-capture/lib.mjs';

const OPEN = { 'abt:ctrl:/ed-uc-simulator/': '1' };          // the Inputs card left open
export const TOOL = {
  path: '/ed-uc-simulator/',
  seen: ['educ-tour-v1-seen'],
  storage: OPEN,
  ready: async (page) => {
    await page.waitForFunction(() => window.EDApp && window.EDApp.res, null, { timeout: 30000 });
    await page.waitForTimeout(800);
  },
};

const H = 800;
const el = (id) => `#sldSvg g[data-id="${id}"]`;
// A run disables Run dispatch until it ends: wait for it to start (if it has not yet), then to end.
const solved = async (S) => {
  await S.page.waitForSelector('#runBtn[disabled]', { timeout: 3000 }).catch(() => {});
  await S.page.waitForFunction(() => { const a = window.EDApp; return a.res && a.res.report && !document.querySelector('#runBtn[disabled]'); }, null, { timeout: 60000 });
};
const preset = async (S, key) => {
  await S.page.click(`.quick-start-btn[data-preset="${key}"]`);
  await sleep(600);
  await solved(S);
  await sleep(900);
};
const idOf = (S, name) => S.page.evaluate((n) => window.EDApp.model.el.find(e => e.name === n).id, name);
const top = (S) => S.scrollTo('#sldCard', 12, 900);
const park = (S, x = 1150, y = 700) => S.glide(x, y, 500);
const inPanel = async (S, sel, at = 0.5) => {
  await S.page.evaluate(([s, k]) => {
    const e = document.querySelector(s), c = e.closest('.ctrl-scroll');
    c.scrollTo({ top: e.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop - c.clientHeight * k, behavior: 'smooth' });
  }, [sel, at]);
  await sleep(800);
};
// Pick an option of a select drawn by dropdown.js (or, without it, the select itself).
const choose = async (S, sel, text) => {
  await S.click(sel, { after: 700 });
  const opt = S.page.locator(`.combo-list .combo-opt:has-text("${text}")`).first();
  if (await opt.count() && await opt.isVisible()) await S.click(opt, { after: 900 });
  else { await S.page.keyboard.press('Escape'); await S.page.selectOption(sel, { label: text }); await sleep(900); }
};

export const SCENES = [
  {
    name: 'layout', still: true, h: 1500,
    async run(S) {
      await S.page.mouse.move(1270, 1490);
      await sleep(600);
      return { boxes: {
        inputs: '.layout > .controls',
        parts: '#palette',
        diagram: '#sldStage',
        results: ['.metrics.ed-result', '#dispCard'],
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
      await park(S, 700, 600);
      await sleep(700);
      S.mark('Pick an example');
      await S.moveTo('.quick-start-btn[data-preset="solar"]', { ms: 700 });
      await sleep(2000);
      await S.click('.quick-start-btn[data-preset="solar"]', { after: 600 });
      await solved(S);
      await park(S);
      await sleep(2400);
      return { crop: [0, 0, 1280, H] };
    },
  },
  {
    name: 'draw', h: H,
    async run(S) {
      const { page } = S;
      await page.evaluate(() => {
        // Solved as a unit commitment, so the new unit may switch off at night rather than run above the load.
        const m = document.getElementById('edMode'); m.value = 'uc'; m.dispatchEvent(new Event('change', { bubbles: true }));
        const a = window.EDApp; a.model.el = []; a.model.name = 'My network'; a.sel = new Set(); a.change('elec');
      });
      await top(S);
      for (let i = 0; i < 2; i++) { await page.click('#zoomIn'); await sleep(200); }
      await sleep(500);
      const st = await S.box('#sldStage');
      const A = { x: st.x + 180, y: st.y + 250 }, B = { x: st.x + 520, y: st.y + 250 };
      S.begin();
      S.mark('Drop a bus');
      await S.drag('.pal-btn[data-tool="Bus"]', A, { after: 700 });
      await S.drag('.pal-btn[data-tool="Bus"]', B, { after: 700 });
      S.mark('Drop units and loads');
      await S.drag('.pal-btn[data-tool="Generator"]', { x: A.x, y: A.y - 4 }, { after: 700 });
      await S.drag('.pal-btn[data-tool="PV"]', { x: B.x - 40, y: B.y - 4 }, { after: 700 });
      await S.drag('.pal-btn[data-tool="Load"]', { x: B.x + 30, y: B.y + 4 }, { after: 700 });
      S.mark('Connect two buses');
      await S.click('.pal-btn[data-tool="Line"]', { after: 600 });
      await S.drag({ x: A.x + 25, y: A.y }, { x: B.x - 25, y: B.y }, { after: 900 });
      await page.keyboard.press('Escape');
      S.mark('Run it');
      await S.click('#runBtn', { after: 600 });
      await solved(S);
      await park(S, 900, 700);
      await sleep(2000);
      return { crop: [0, 0, 1280, H] };
    },
  },
  {
    // A unit: its type, rating, minimum and cost, then commitment.
    name: 'unit', h: H,
    async run(S) {
      const { page } = S;
      await preset(S, 'uc3');
      await top(S);
      const coal = await idOf(S, 'Coal');
      S.begin();
      S.mark('Select a unit');
      await S.click(el(coal), { after: 1600 });
      S.mark('Its cost');
      await inPanel(S, '#tab-element [data-k="mcurve"], #tab-element [data-k="marginal_cost"]', 0.3);
      await S.moveTo('#tab-element [data-k="marginal_cost"]', { ms: 700 });
      await sleep(1000);
      const lin = page.locator('#tab-element [data-k="mcurve"] .seg-btn[data-val="lin"]');
      if (await lin.count()) { await S.click(lin, { after: 1800 }); }
      S.mark('Commitment');
      await inPanel(S, '#tab-element [data-k="committable"]', 0.25);
      await S.moveTo('#tab-element [data-k="min_up_time"]', { ms: 700 });
      await sleep(2200);
      return { crop: [0, 0, 1280, H] };
    },
  },
  {
    // A load's profile: pick one, drag a bar, the days of the week.
    name: 'profile', h: H,
    async run(S) {
      const { page } = S;
      await preset(S, 'uc3');
      await top(S);
      const d = await idOf(S, 'Demand');
      S.begin();
      S.mark('Select a load');
      await S.click(el(d), { after: 1200 });
      S.mark('Pick a profile');
      await inPanel(S, '#f_prof', 0.15);
      await choose(S, '#f_prof', 'Residential');
      S.mark('Drag a bar');
      // The bars' own units (viewBox -8 -14 256 90): hour h at x = h * 10 + 5, a share v at y = 58 - 54 v.
      const b = await S.box('#profBars');
      const px = (h, v) => ({ x: b.x + (h * 10 + 5 + 8) / 256 * b.width, y: b.y + (58 - 54 * v + 14) / 90 * b.height });
      await S.moveTo('#profBars', { at: px(17, 0.75), ms: 700 });
      await sleep(500);
      await S.drag(px(17, 0.75), px(21, 1), { ms1: 300, ms2: 1300, after: 1400 });
      S.mark('Vary it by weekday');
      await inPanel(S, '#f_daily', 0.2);
      await S.moveTo('.toggle-switch:has(#f_daily)', { ms: 600 });
      await sleep(400);
      if (!(await page.isChecked('#f_daily'))) await S.click('.toggle-switch:has(#f_daily)', { after: 1000 });
      await inPanel(S, '#dayBars', 0.3).catch(() => {});
      await S.moveTo('#dayBars', { ms: 700 }).catch(() => {});
      await sleep(2000);
      return { crop: [0, 0, 1280, H] };
    },
  },
  {
    // The Dispatch tab: how it is solved, over how long, with what network.
    name: 'dispatch', h: H,
    async run(S) {
      const { page } = S;
      await preset(S, 'uc3');
      await top(S);
      S.begin();
      S.mark('Solve as');
      await S.click('.ctrl-tab[data-tab="dispatch"]', { after: 900 });
      await S.moveTo('#edMode', { ms: 700 });
      await sleep(1500);
      S.mark('Horizon');
      await S.click('#edSpan', { after: 300 });
      await page.keyboard.press('Control+A');
      await S.type('#edSpan', '3', 200);
      await page.keyboard.press('Tab');
      await sleep(800);
      await S.moveTo('#edStart', { ms: 600 });
      await sleep(900);
      S.mark('Profiles from a file');
      await S.moveTo('#tplCsvBtn', { ms: 700 });
      await sleep(1400);
      S.mark('Network and shedding');
      await inPanel(S, '.toggle-switch:has(#edShed)', 0.5);
      await S.moveTo('.toggle-switch:has(#edLimits)', { ms: 600 });
      await sleep(900);
      await S.moveTo('#edVoll', { ms: 600 });
      await sleep(900);
      await S.click('#runBtn', { after: 600 });
      await solved(S);
      await sleep(1600);
      return { crop: [0, 0, 1280, H] };
    },
  },
  {
    // The hour: drag it, play the day, hover an element.
    name: 'hour', h: 960, storage: {},
    async run(S) {
      const { page } = S;
      await top(S);
      const hr = await S.box('#edHour');
      const at = (h) => ({ x: hr.x + 8 + (hr.width - 16) * h / 23, y: hr.y + hr.height / 2 });
      S.begin();
      S.mark('Drag the hour');
      await S.drag(at(18), at(3), { ms2: 1600, hold: 600, after: 900 });
      await S.drag(at(3), at(12), { ms2: 1400, hold: 400, after: 1200 });
      S.mark('Play the day');
      await S.click('#playBtn', { after: 5200 });
      await S.click('#playBtn', { after: 700 });
      S.mark('Hover to read');
      const b = await idOf(S, 'Brighton').catch(() => null);
      await S.moveTo(b ? el(b) : '#sldStage', { ms: 800 });
      await sleep(2600);
      return { crop: [0, 0, 1280, 960] };
    },
  },
  {
    // The charts: dispatch in merit order, prices, commitment; a click picks the hour.
    name: 'charts', h: H,
    async run(S) {
      const { page } = S;
      await preset(S, 'uc3');
      await S.scrollTo('#dispCard', 12, 900);
      const c = await S.box('#dispCanvas');
      S.begin();
      S.mark('Dispatch');
      await S.moveTo('#dispCanvas', { at: { x: c.x + c.width * 0.3, y: c.y + c.height * 0.5 }, ms: 800 });
      await S.glide(c.x + c.width * 0.75, c.y + c.height * 0.5, 1800);
      await sleep(600);
      S.mark('Click an hour');
      await S.click('#dispCanvas', { at: { x: c.x + c.width * 0.86, y: c.y + c.height * 0.5 }, after: 900 });
      await S.scrollTo('#sldCard', 12, 1000);
      await sleep(1600);
      S.mark('Prices and commitment');
      await S.scrollTo('#priceCard', 12, 1000);
      const pc = await S.box('#priceCanvas');
      await S.glide(pc.x + pc.width * 0.5, pc.y + pc.height * 0.5, 700);
      await sleep(1000);
      await S.scrollTo('#commitCard', 12, 1000);
      const cc = await S.box('#commitCanvas');
      await S.glide(cc.x + cc.width * 0.4, cc.y + cc.height * 0.5, 700);
      await sleep(1800);
      return { crop: [0, 0, 1280, H] };
    },
  },
  {
    // The answer in four figures, then the tables.
    name: 'results', h: H, storage: {},
    async run(S) {
      const { page } = S;
      await S.scrollTo('.metrics.ed-result', 160, 900);
      S.begin();
      S.mark('Four figures');
      await S.moveTo('#mCong', { ms: 900 });
      await sleep(1500);
      S.mark('Open the tables');
      await S.scrollTo('#tablesCard', 300, 900);
      await S.click('#tablesCard .detail-head > button:last-child, #tablesCard .detail-head [aria-expanded]', { after: 1000 });
      await S.scrollTo('#tablesCard', 90, 900);
      S.mark('Pick a table');
      for (const t of ['bus', 'branch', 'hour']) await S.click(`#tableTabs .seg-btn[data-val="${t}"]`, { after: 1400 });
      await S.moveTo('#csvBtn', { ms: 700 });
      await sleep(1500);
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
      S.mark('Share');
      await S.click('#sldCard .share-toggle', { after: 1200 });
      for (const t of ['Download as GIF', 'Share as link', 'Embed as HTML']) {
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
