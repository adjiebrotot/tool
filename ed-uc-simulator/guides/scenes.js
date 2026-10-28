// The ED/UC Simulator guide's live demos: guide-live.js opens the tool in a frame of this page and
// plays each scene in it. Before S.begin() a scene sets itself up, unseen; S.mark('...') names the
// moments the guide's steps refer to, in order (the guide's list under the demo has one item per
// mark); S.focus(part) zooms in on what a step is about, S.focus() shows the whole tool. A run a scene starts is solved ahead by _ref/presolve.mjs (S.note('solved') tells it
// when), so a demo never fetches the solver. Check them all with
//   node _ref/guide-check.mjs ed-uc-simulator
export const TOOL = {
  path: '../',
  seen: ['educ-tour-v1-seen'],
  storage: { 'abt:ctrl:/ed-uc-simulator/': '1' },   // the Inputs card left open
  ready: (win) => win.EDApp && win.EDApp.res,
};

const el = (id) => `#sldSvg g[data-id="${id}"]`;
const idOf = (S, name) => S.win.EDApp.model.el.find(e => e.name === name).id;
const toggle = (id) => (S) => { const e = S.doc.getElementById(id); return e && e.closest('.toggle-switch'); };
// Solved: the result on screen is for the network on screen, and Run dispatch is free again.
const solved = async (S) => {
  await S.until((w) => { const x = w.__ed; return x && x.app.res && x.app.res.report && x.app.solvedKey === x.solveKey() && !w.document.querySelector('#runBtn[disabled]'); }, 60000, 'the solve');
  await S.note('solved');
};
const preset = async (S, key) => {
  await S.click(`.quick-start-btn[data-preset="${key}"]`, { after: 600 });
  await solved(S);
  await S.wait(900);
};
const top = (S) => S.scrollTo('#sldCard', 12, 900);
const park = (S, x = 1150, y = 700) => S.glide(x, y, 500);

export const SCENES = [
  {
    name: 'layout', still: true,
    async run() {
      return { boxes: {
        inputs: '.layout > .controls',
        parts: '#palette',
        diagram: '#sldStage',
        results: ['.metrics.ed-result', '#dispCard'],
      } };
    },
  },
  {
    name: 'quickstart', storage: {},
    async run(S) {
      S.begin();
      await S.focus('.ctrl-fold-rail', { pad: 140, after: 400 });
      S.mark('Open the inputs');
      await S.click('.ctrl-fold-rail', { after: 500 });
      S.mark('Pick an example');
      await S.focus('.quick-start-row', { pad: 90 });
      await S.moveTo('.quick-start-btn[data-preset="solar"]', { ms: 700 });
      await S.wait(2000);
      await S.click('.quick-start-btn[data-preset="solar"]', { after: 300 });
      await S.focus(null, { ms: 900 });
      await solved(S);
      await park(S);
      await S.wait(2400);
    },
  },
  {
    name: 'draw',
    async run(S) {
      const w = S.win, m = w.document.getElementById('edMode'), a = w.EDApp;
      // Solved as a unit commitment, so the new unit may switch off at night rather than run above the load.
      m.value = 'uc'; m.dispatchEvent(new w.Event('change', { bubbles: true }));
      a.model.el = []; a.model.name = 'My network'; a.sel = new w.Set(); a.change('elec');
      await top(S);
      for (let i = 0; i < 2; i++) await S.click('#zoomIn', { after: 200 });
      await S.wait(500);
      const st = await S.box('#sldStage');
      const A = { x: st.x + 180, y: st.y + 250 }, B = { x: st.x + 520, y: st.y + 250 };
      S.begin();
      // The parts it takes and where they go (the whole palette is nearly as tall as the frame).
      await S.focus(['.pal-btn[data-tool="Bus"]', '.pal-btn[data-tool="Load"]', { x: A.x - 60, y: A.y - 110, width: B.x - A.x + 120, height: 220 }], { pad: 16, after: 300 });
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
      await S.key('Escape');
      S.mark('Run it');
      await S.focus();
      await S.click('#runBtn', { after: 600 });
      await solved(S);
      await park(S, 900, 700);
      await S.wait(2000);
    },
  },
  {
    // A unit: its type, rating, minimum and cost, then commitment.
    name: 'unit',
    async run(S) {
      await preset(S, 'uc3');
      await top(S);
      const coal = idOf(S, 'Coal');
      S.begin();
      S.mark('Select a unit');
      await S.click(el(coal), { after: 1600 });
      S.mark('Its cost');
      await S.reveal('#tab-element [data-k="mcurve"], #tab-element [data-k="marginal_cost"]', 0.3);
      await S.focus('#tab-element [data-k="marginal_cost"]', { pad: 120 });
      await S.moveTo('#tab-element [data-k="marginal_cost"]', { ms: 700 });
      await S.wait(1000);
      const lin = '#tab-element [data-k="mcurve"] .seg-btn[data-val="lin"]';
      if (S.$(lin)) await S.click(lin, { after: 1800 });
      S.mark('Commitment');
      await S.reveal('#tab-element [data-k="committable"]', 0.25);
      await S.focus('#tab-element [data-k="min_up_time"]', { pad: 130 });
      await S.moveTo('#tab-element [data-k="min_up_time"]', { ms: 700 });
      await S.wait(2200);
    },
  },
  {
    // A load's profile: pick one, drag a bar, the days of the week.
    name: 'profile',
    async run(S) {
      await preset(S, 'uc3');
      await top(S);
      const d = idOf(S, 'Demand');
      S.begin();
      S.mark('Select a load');
      await S.click(el(d), { after: 1200 });
      S.mark('Pick a profile');
      await S.reveal('#f_prof', 0.15);
      await S.focus('#f_prof', { pad: 150 });
      await S.choose('#f_prof', 'Residential');
      S.mark('Drag a bar');
      await S.focus('#profBars', { pad: 30 });
      // The bars' own units (viewBox -8 -14 256 90): hour h at x = h * 10 + 5, a share v at y = 58 - 54 v.
      const b = await S.box('#profBars');
      const px = (h, v) => ({ x: b.x + (h * 10 + 5 + 8) / 256 * b.width, y: b.y + (58 - 54 * v + 14) / 90 * b.height });
      await S.moveTo('#profBars', { at: px(17, 0.75), ms: 700 });
      await S.wait(500);
      await S.drag(px(17, 0.75), px(21, 1), { ms1: 300, ms2: 1300, after: 1400 });
      S.mark('Vary it by weekday');
      await S.reveal('#f_daily', 0.2);
      await S.focus(toggle('f_daily'), { pad: 150 });
      await S.moveTo(toggle('f_daily'), { ms: 600 });
      await S.wait(400);
      if (!S.checked('#f_daily')) await S.click(toggle('f_daily'), { after: 1000 });
      if (S.$('#dayBars')) {
        await S.reveal('#dayBars', 0.3);
        await S.focus('#dayBars', { pad: 40 });
        await S.moveTo('#dayBars', { ms: 700 });
      }
      await S.wait(2000);
    },
  },
  {
    // The Dispatch tab: how it is solved, over how long, with what network.
    name: 'dispatch',
    async run(S) {
      await preset(S, 'uc3');
      await top(S);
      S.begin();
      await S.focus('.ctrl-tabs', { pad: 150, after: 300 });
      S.mark('Solve as');
      await S.click('.ctrl-tab[data-tab="dispatch"]', { after: 500 });
      await S.focus(['.ctrl-tabs', '#edMode'], { pad: 60 });
      await S.moveTo('#edMode', { ms: 700 });
      await S.wait(1500);
      S.mark('Horizon');
      await S.focus(['#edSpan', '#edStart'], { pad: 70 });
      await S.fill('#edSpan', '3', { delay: 200, after: 800 });
      await S.moveTo('#edStart', { ms: 600 });
      await S.wait(900);
      S.mark('Profiles from a file');
      await S.focus('#tplCsvBtn', { pad: 130 });
      await S.moveTo('#tplCsvBtn', { ms: 700 });
      await S.wait(1400);
      S.mark('Network and shedding');
      await S.reveal(toggle('edShed'), 0.5);
      await S.focus([toggle('edLimits'), '#edVoll'], { pad: 60 });
      await S.moveTo(toggle('edLimits'), { ms: 600 });
      await S.wait(900);
      await S.moveTo('#edVoll', { ms: 600 });
      await S.wait(900);
      await S.focus();
      await S.click('#runBtn', { after: 600 });
      await solved(S);
      await S.wait(1600);
    },
  },
  {
    // The hour: drag it, play the day, hover an element.
    name: 'hour', storage: {},
    async run(S) {
      await top(S);
      S.begin();
      await S.focus('.hour-ctl', { pad: 60, after: 300 });
      S.mark('Drag the hour');
      await S.slide('#edHour', 3, { ms: 1600, after: 900 });
      await S.slide('#edHour', 12, { ms: 1400, after: 1200 });
      S.mark('Play the day');
      await S.focus();
      await S.click('#playBtn', { after: 5200 });
      await S.click('#playBtn', { after: 700 });
      S.mark('Hover to read');
      let b = null;
      try { b = idOf(S, 'Brighton'); } catch (e) { /* no Brighton in this network */ }
      if (b) await S.focus(el(b), { pad: 170 });
      await S.moveTo(b ? el(b) : '#sldStage', { ms: 800 });
      await S.wait(2600);
    },
  },
  {
    // The charts: dispatch in merit order, prices, commitment; a click picks the hour.
    name: 'charts',
    async run(S) {
      await preset(S, 'uc3');
      await S.scrollTo('#dispCard', 12, 900);
      const c = await S.box('#dispCanvas');
      S.begin();
      await S.focus('#dispCard', { pad: 8, after: 300 });
      S.mark('Dispatch');
      await S.moveTo('#dispCanvas', { at: { x: c.x + c.width * 0.3, y: c.y + c.height * 0.5 }, ms: 800 });
      await S.glide(c.x + c.width * 0.75, c.y + c.height * 0.5, 1800);
      await S.wait(600);
      S.mark('Click an hour');
      await S.click('#dispCanvas', { at: { x: c.x + c.width * 0.86, y: c.y + c.height * 0.5 }, after: 900 });
      await S.focus();
      await S.scrollTo('#sldCard', 12, 1000);
      await S.wait(1600);
      S.mark('Prices and commitment');
      await S.scrollTo('#priceCard', 12, 1000);
      await S.focus('#priceCard', { pad: 8 });
      const pc = await S.box('#priceCanvas');
      await S.glide(pc.x + pc.width * 0.5, pc.y + pc.height * 0.5, 700);
      await S.wait(1000);
      await S.focus();
      await S.scrollTo('#commitCard', 12, 1000);
      await S.focus('#commitCard', { pad: 8 });
      const cc = await S.box('#commitCanvas');
      await S.glide(cc.x + cc.width * 0.4, cc.y + cc.height * 0.5, 700);
      await S.wait(1800);
    },
  },
  {
    // The answer in four figures, then the tables.
    name: 'results', storage: {},
    async run(S) {
      await S.scrollTo('.metrics.ed-result', 160, 900);
      S.begin();
      S.mark('Four figures');
      await S.focus('.metrics.ed-result', { pad: 20 });
      await S.moveTo('#mCong', { ms: 900 });
      await S.wait(1500);
      S.mark('Open the tables');
      await S.focus();
      await S.scrollTo('#tablesCard', 300, 900);
      await S.click('#tablesCard .detail-head > button:last-child, #tablesCard .detail-head [aria-expanded]', { after: 1000 });
      await S.scrollTo('#tablesCard', 90, 900);
      S.mark('Pick a table');
      await S.focus(['#tableTabs', '#csvBtn'], { pad: 60 });
      for (const t of ['bus', 'branch', 'hour']) await S.click(`#tableTabs .seg-btn[data-val="${t}"]`, { after: 1400 });
      await S.moveTo('#csvBtn', { ms: 700 });
      await S.wait(1500);
    },
  },
  {
    name: 'share',
    async run(S) {
      S.begin();
      S.mark('Save or open a file');
      await S.focus(['.scenario-save', '.scenario-load'], { pad: 120 });
      await S.moveTo('.scenario-save', { ms: 800 });
      await S.wait(1300);
      await S.moveTo('.scenario-load', { ms: 500 });
      await S.wait(1000);
      S.mark('Share');
      await S.focus('#sldCard .share-toggle', { pad: 40 });
      await S.click('#sldCard .share-toggle', { after: 300 });
      await S.focus(['#sldCard .share-toggle', '[role=menu]'], { pad: 30 });
      for (const t of ['Download as GIF', 'Share as link', 'Embed as HTML']) {
        await S.moveTo({ text: t, in: '[role=menu]' }, { ms: 500 });
        await S.wait(900);
      }
      await S.key('Escape');
      await S.focus();
      await park(S);
      await S.wait(800);
    },
  },
];
