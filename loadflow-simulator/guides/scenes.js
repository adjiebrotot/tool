// The Load Flow Simulator guide's live demos: guide-live.js opens the tool in a frame of this page
// and plays each scene in it. Before S.begin() a scene sets itself up, unseen; S.mark('...') names
// the moments the guide's steps refer to, in order (the guide's list under the demo has one item
// per mark). Check them all with  node _ref/guide-check.mjs loadflow-simulator
export const TOOL = {
  path: '../',
  seen: ['loadflow-tour-v1-seen'],
  storage: { 'abt:ctrl:/loadflow-simulator/': '1' },   // the Inputs card left open
  ready: (win) => win.LFApp && win.LFApp.res,
};

const el = (id) => `#sldSvg g[data-id="${id}"]`;
const idOf = (S, name) => S.win.LFApp.model.el.find(e => e.name === name).id;
const preset = async (S, key) => {
  await S.click(`.quick-start-btn[data-preset="${key}"]`, { after: 0 });
  await S.until((w) => w.LFApp.res && w.LFApp.res.report, 20000, 'the load flow');
  await S.wait(900);
};
// A loading limit low enough that the WSCC 9-bus shows amber and red branches.
const tightLimit = async (S, pct) => {
  const w = S.win, e = w.document.getElementById('lfLoadMax');
  e.value = String(pct);
  e.dispatchEvent(new w.Event('input', { bubbles: true }));
  e.dispatchEvent(new w.Event('change', { bubbles: true }));
  w.LFApp.run();
  await S.wait(1500);
};
const top = (S) => S.scrollTo('#sldCard', 12, 900);          // the diagram card at the top of the screen
const park = (S, x = 1150, y = 700) => S.glide(x, y, 500);   // out of a tooltip's way

export const SCENES = [
  {
    // The screen: the tool on a first look, Inputs open, down to the results.
    name: 'layout', still: true,
    async run() {
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
    name: 'quickstart', storage: {},
    async run(S) {
      S.begin();
      await S.wait(400);
      S.mark('Open the inputs');
      await S.click('.ctrl-fold-rail', { after: 300 });
      await park(S, 700, 600);
      await S.wait(700);
      S.mark('Pick a network');
      await S.moveTo('.quick-start-btn[data-preset="hvdc"]', { ms: 700 });
      await S.wait(1800);
      await S.click('.quick-start-btn[data-preset="hvdc"]', { after: 2400 });
      await park(S);
      await S.wait(1200);
    },
  },
  {
    // An empty diagram: two buses, a grid and a load on them, a line between, then run.
    name: 'draw',
    async run(S) {
      const w = S.win, a = w.LFApp;
      a.model.el = []; a.model.name = 'My network'; a.sel = new w.Set(); a.change('elec');
      await top(S);
      for (let i = 0; i < 2; i++) await S.click('#zoomIn', { after: 200 });
      await S.wait(500);
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
      await S.key('Escape');
      S.mark('Run it');
      await S.click('#runBtn', { after: 2600 });
      await park(S, 900, 700);
      await S.wait(800);
    },
  },
  {
    // Select a load, change it, run again; with nothing selected, the network and its checks.
    name: 'edit',
    async run(S) {
      await preset(S, '3bus');
      await top(S);
      const town = idOf(S, 'Town');
      S.begin();
      S.mark('Select an element');
      await S.click(el(town), { after: 1400 });
      S.mark('Change a value');
      await S.fill('#f_p_set', '160', { after: 1400 });
      S.mark('Run it again');
      await S.click('#runBtn', { after: 2200 });
      S.mark('Nothing selected');
      await S.key('Escape', { after: 400 });
      await S.click('#sldStage', { at: { x: 1150, y: 240 }, after: 900 });
      await S.moveTo('#inspector', { ms: 700 });
      await S.wait(2000);
    },
  },
  {
    // The Load flow tab: the method and the limits; then Labels.
    name: 'settings',
    async run(S) {
      await top(S);
      S.begin();
      S.mark('Load flow');
      await S.click('.ctrl-tab[data-tab="solver"]', { after: 900 });
      await S.moveTo('#lfMethod', { ms: 600 });
      await S.wait(900);
      S.mark('Limits');
      await S.reveal('#lfLoadMax');
      await S.fill('#lfLoadMax', '60', { delay: 160, after: 500 });
      await S.click('#runBtn', { after: 2200 });
      S.mark('Labels');
      await S.click('.ctrl-tab[data-tab="display"]', { after: 900 });
      await S.moveTo('#labelMatrix', { ms: 700 });
      await S.wait(2200);
    },
  },
  {
    // Reading the diagram: colour, hover, the flows, full screen.
    name: 'read', storage: {},
    async run(S) {
      await tightLimit(S, 60);
      await top(S);
      S.begin();
      S.mark('Colour by');
      await S.choose('#colourBy', 'Branch loading', { after: 1400 });
      S.mark('Hover to read');
      let t1 = null;
      try { t1 = idOf(S, 'T1'); } catch (e) { /* no T1 in this network */ }
      await S.moveTo(t1 ? el(t1) : '#sldStage', { ms: 800 });
      await S.wait(2400);
      S.mark('The flows');
      await S.click('#animQ', { after: 1500 });
      await S.click('#animQ', { after: 900 });
      S.mark('Full screen');
      await S.click('#sldFull', { after: 2400 });
      await S.click('#sldFull', { after: 1000 });
    },
  },
  {
    // The answer in four figures, then the tables.
    name: 'results', storage: {},
    async run(S) {
      await S.scrollTo('.metrics.lf-result', 160, 900);
      S.begin();
      S.mark('Four figures');
      await S.moveTo('#mLoad', { ms: 900 });
      await S.wait(1500);
      S.mark('Open the tables');
      await S.click('#tablesCard .detail-head > button:last-child, #tablesCard .fold-btn, #tablesCard [aria-expanded]', { after: 1000 });
      await S.scrollTo('#tablesCard', 90, 900);
      S.mark('Pick a table');
      await S.click('#tableTabs .seg-btn[data-val="branch"]', { after: 1800 });
      await S.click('#tableTabs .seg-btn[data-val="device"]', { after: 1500 });
      await S.moveTo('#csvBtn', { ms: 700 });
      await S.wait(1500);
    },
  },
  {
    // Share: files, a link and an embed; and the scenario's own file.
    name: 'share',
    async run(S) {
      S.begin();
      S.mark('Save or open a file');
      await S.moveTo('.scenario-save', { ms: 800 });
      await S.wait(1500);
      await S.moveTo('.scenario-load', { ms: 500 });
      await S.wait(1200);
      S.mark('Share');
      await S.click('#sldCard .share-toggle', { after: 1200 });
      for (const t of ['Download as GIF', 'Share as link', 'Embed as HTML']) {
        await S.moveTo({ text: t, in: '[role=menu]' }, { ms: 500 });
        await S.wait(900);
      }
      await S.key('Escape');
      await park(S);
      await S.wait(800);
    },
  },
];
