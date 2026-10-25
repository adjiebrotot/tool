// The Load Flow Simulator guide's scenes: each drives the real tool and returns the crop (x, y, w, h
// of the page) and encoding options. S.mark('...') names the moments the guide's steps refer to, in
// order (the guide's list has one item per mark, in the same order). Run them with
//   node _ref/guide-capture/run.mjs loadflow-simulator [scene ...] [--theme light|dark]
import { sleep } from '../../../_ref/guide-capture/lib.mjs';

const OPEN = { 'abt:ctrl:/loadflow-simulator/': '1' };       // the Inputs card left open
export const TOOL = {
  path: '/loadflow-simulator/',
  seen: ['loadflow-tour-v1-seen'],
  storage: OPEN,
  ready: async (page) => {
    await page.waitForFunction(() => window.LFApp && window.LFApp.res, null, { timeout: 20000 });
    await page.waitForTimeout(800);
  },
};

const H = 800;
const el = (id) => `#sldSvg g[data-id="${id}"]`;
const preset = async (S, key) => {
  await S.page.click(`.quick-start-btn[data-preset="${key}"]`);
  await S.page.waitForFunction(() => window.LFApp.res && window.LFApp.res.report, null, { timeout: 20000 });
  await sleep(900);
};
const idOf = (S, name) => S.page.evaluate((n) => window.LFApp.model.el.find(e => e.name === n).id, name);
// Scroll the inputs card (not the page) so a field sits in the middle of it.
const inPanel = async (S, sel) => {
  await S.page.evaluate((s) => {
    const e = document.querySelector(s), c = e.closest('.ctrl-scroll');
    c.scrollTo({ top: e.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop - c.clientHeight / 2, behavior: 'smooth' });
  }, sel);
  await sleep(800);
};
// A loading limit low enough that the WSCC 9-bus shows amber and red branches.
const tightLimit = async (S, pct) => {
  await S.page.evaluate((v) => {
    const e = document.getElementById('lfLoadMax');
    e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true }));
    window.LFApp.run();
  }, String(pct));
  await sleep(1500);
};
const top = (S) => S.scrollTo('#sldCard', 12, 900);          // the diagram card at the top of the screen
const park = (S, x = 1150, y = 700) => S.glide(x, y, 500);   // out of a tooltip's way

export const SCENES = [
  {
    // The screen: the tool on a first look, Inputs open, down to the results.
    name: 'layout', still: true, h: 1400,
    async run(S) {
      await S.page.mouse.move(1270, 1390);
      await sleep(600);
      return { boxes: {
        inputs: '.layout > .controls',
        parts: '#palette',
        diagram: '#sldStage',
        results: ['.metrics.lf-result', '#tablesCard'],
      } };
    },
  },
  {
    // A first visit: the inputs are folded to a rail; open them and load a network.
    name: 'quickstart', h: H, storage: {},
    async run(S) {
      await sleep(400);
      S.begin();
      S.mark('Open the inputs');
      await S.click('.ctrl-fold-rail', { after: 300 });
      await park(S, 700, 600);
      await sleep(700);
      S.mark('Pick a network');
      await S.moveTo('.quick-start-btn[data-preset="hvdc"]', { ms: 700 });
      await sleep(1800);
      await S.click('.quick-start-btn[data-preset="hvdc"]', { after: 2400 });
      await park(S);
      await sleep(1200);
      return { crop: [0, 0, 1280, H] };
    },
  },
  {
    // An empty diagram: two buses, a grid and a load on them, a line between, then run.
    name: 'draw', h: H,
    async run(S) {
      const { page } = S;
      page.on('dialog', d => d.accept());
      await page.evaluate(() => { const a = window.LFApp; a.model.el = []; a.model.name = 'My network'; a.sel = new Set(); a.change('elec'); });
      await top(S);
      for (let i = 0; i < 2; i++) { await page.click('#zoomIn'); await sleep(200); }
      await sleep(500);
      const st = await S.box('#sldStage');
      const A = { x: st.x + 180, y: st.y + 250 }, B = { x: st.x + 520, y: st.y + 250 };
      S.begin();
      S.mark('Drop a bus');
      await S.drag('.pal-btn[data-tool="Bus"]', A, { after: 700 });
      await S.drag('.pal-btn[data-tool="Bus"]', B, { after: 700 });
      S.mark('Drop a device on a bus');
      await S.drag('.pal-btn[data-tool="Grid"]', { x: A.x, y: A.y - 4 }, { after: 700 });
      await S.drag('.pal-btn[data-tool="Load"]', { x: B.x, y: B.y + 4 }, { after: 700 });
      S.mark('Connect two buses');
      await S.click('.pal-btn[data-tool="Line"]', { after: 600 });
      await S.drag({ x: A.x + 25, y: A.y }, { x: B.x - 25, y: B.y }, { after: 900 });
      await page.keyboard.press('Escape');
      S.mark('Run it');
      await S.click('#runBtn', { after: 2600 });
      await park(S, 900, 700);
      await sleep(800);
      return { crop: [0, 0, 1280, H] };
    },
  },
  {
    // Select a load, change it, run again; with nothing selected, the network and its checks.
    name: 'edit', h: H,
    async run(S) {
      const { page } = S;
      await preset(S, '3bus');
      await top(S);
      const town = await idOf(S, 'Town');
      S.begin();
      S.mark('Select an element');
      await S.click(el(town), { after: 1400 });
      S.mark('Change a value');
      await S.click('#f_p_set', { after: 300 });
      await page.keyboard.press('Control+A');
      await S.type('#f_p_set', '160', 140);
      await page.keyboard.press('Tab');
      await sleep(1400);
      S.mark('Run it again');
      await S.click('#runBtn', { after: 2200 });
      S.mark('Nothing selected');
      await page.keyboard.press('Escape');
      await sleep(400);
      await S.click('#sldStage', { at: { x: 1150, y: 240 }, after: 900 });
      await S.moveTo('#inspector', { ms: 700 });
      await sleep(2000);
      return { crop: [0, 0, 1280, H] };
    },
  },
  {
    // The Load flow tab: the method and the limits; then Labels.
    name: 'settings', h: H,
    async run(S) {
      const { page } = S;
      await top(S);
      S.begin();
      S.mark('Load flow');
      await S.click('.ctrl-tab[data-tab="solver"]', { after: 900 });
      await S.moveTo('#lfMethod', { ms: 600 });
      await sleep(900);
      S.mark('Limits');
      const lim = '#lfLoadMax';
      await inPanel(S, lim);
      await S.click(lim, { after: 300 });
      await page.keyboard.press('Control+A');
      await S.type(lim, '60', 160);
      await page.keyboard.press('Tab');
      await sleep(500);
      await S.click('#runBtn', { after: 2200 });
      S.mark('Labels');
      await S.click('.ctrl-tab[data-tab="display"]', { after: 900 });
      await S.moveTo('#labelMatrix', { ms: 700 });
      await sleep(2200);
      return { crop: [0, 0, 1280, H] };
    },
  },
  {
    // Reading the diagram: colour, hover, the flows, full screen.
    name: 'read', h: 960, storage: {},
    async run(S) {
      const { page } = S;
      await tightLimit(S, 60);
      await top(S);
      S.begin();
      S.mark('Colour by');
      await S.click('#colourBy', { after: 700 });
      const opt = page.locator('.combo-list .combo-opt:has-text("Branch loading"), .dd-list [role=option]:has-text("Branch loading")').first();
      if (await opt.count()) await S.click(opt, { after: 1400 });
      else { await page.selectOption('#colourBy', 'loading'); await sleep(1400); }
      S.mark('Hover to read');
      const t1 = await idOf(S, 'T1').catch(() => null);
      await S.moveTo(t1 ? el(t1) : '#sldStage', { ms: 800 });
      await sleep(2400);
      S.mark('The flows');
      await S.click('#animQ', { after: 1500 });
      await S.click('#animQ', { after: 900 });
      S.mark('Full screen');
      await S.click('#sldFull', { after: 2400 });
      await S.click('#sldFull', { after: 1000 });
      return { crop: [0, 0, 1280, 960] };
    },
  },
  {
    // The answer in four figures, then the tables.
    name: 'results', h: H, storage: {},
    async run(S) {
      const { page } = S;
      await S.scrollTo('.metrics.lf-result', 160, 900);
      S.begin();
      S.mark('Four figures');
      await S.moveTo('#mLoad', { ms: 900 });
      await sleep(1500);
      S.mark('Open the tables');
      await S.click('#tablesCard .detail-head > button:last-child, #tablesCard .fold-btn, #tablesCard [aria-expanded]', { after: 1000 });
      await S.scrollTo('#tablesCard', 90, 900);
      S.mark('Pick a table');
      await S.click('#tableTabs .seg-btn[data-val="branch"]', { after: 1800 });
      await S.click('#tableTabs .seg-btn[data-val="device"]', { after: 1500 });
      await S.moveTo('#csvBtn', { ms: 700 });
      await sleep(1500);
      return { crop: [0, 0, 1280, H] };
    },
  },
  {
    // Share: files, a link and an embed; and the scenario's own file.
    name: 'share', h: H,
    async run(S) {
      const { page } = S;
      S.begin();
      S.mark('Save or open a file');
      await S.moveTo('.scenario-save', { ms: 800 });
      await sleep(1500);
      await S.moveTo('.scenario-load', { ms: 500 });
      await sleep(1200);
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
