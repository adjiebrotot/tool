// The Workflow Builder guide's live demos: guide-live.js opens the Builder in a frame of this page
// and plays each scene in it. Before S.begin() a scene sets itself up, unseen; S.mark('...') names
// the moments the guide's steps refer to, in order (the guide's list under the demo has one item
// per mark); S.focus(part) zooms in on what a step is about, S.focus() shows the whole Builder.
// Check them all with  node _ref/guide-check.mjs pscad-scripter
const booted = new WeakMap();
export const TOOL = {
  path: '../builder/',
  seen: ['pscad-builder-tour-v1-seen'],
  // Ready once the blocks, the canvas, the Python runtime and the Quick start list are all in.
  ready: (win) => {
    const P = win.PXB;
    if (!P || !P.ready) return false;
    if (!booted.has(win)) {
      booted.set(win, false);
      Promise.all([P.canvasReady, P.runtimeReady, P.templatesReady]).then(() => booted.set(win, true));
    }
    return booted.get(win);
  },
};

const node = (id) => `.react-flow__node[data-id="${id}"]`;
const handle = (id, h) => `${node(id)} .react-flow__handle[data-handleid="${h}"]`;
const head = (id) => `${node(id)} .pxb-n-head`;
const palItem = (type) => `.pxb-pal-item[data-type="${type}"]`;
// A workflow on the canvas, seen from a set place.
const load = async (S, wf, view) => {
  S.win.PXB.loadWorkflowObject(wf, { quiet: true });
  await S.until((w) => w.document.querySelector(node(wf.nodes[wf.nodes.length - 1].id)), 8000, 'the workflow');
  await S.wait(300);
  if (view) { S.win.PXB.app.canvas.setViewport(view); await S.wait(300); }
};
const blank = (S) => S.click('#pxbStarterBlank', { after: 300 });
const foldSide = (S) => S.win.PXB.setSheet(false);
// Into the Blocks panel's search, what it holds replaced (the panel lists blocks as it is typed).
const search = (S, text) => S.fill('#pxbPalSearch', text, { delay: 110, end: null, after: 500 });
const park = (S, x = 900, y = 560) => S.glide(x, y, 500);        // out of a tooltip's way

// A run, its voltage channel and the channel's peak, and a table still to be wired.
const voltages = (more) => ({
  app: 'pscad-builder', v: 1, name: 'Peak voltage',
  nodes: [
    { id: 'n1', type: 'start', x: 0, y: 120, label: '', s: { project: 'vdiv.pscx' } },
    { id: 'n2', type: 'px.run', x: 215, y: 100, label: '', s: {} },
    { id: 'n3', type: 'px.series', x: 450, y: 300, label: 'Bus voltage', s: { channel: 'Vbus' } },
    { id: 'n4', type: 'sig.peak', x: 450, y: 100, label: 'Highest voltage', s: { kind: 'max' } },
    { id: 'n5', type: 'out.table.add', x: 745, y: 100, label: '', s: { table: 'Voltages' } },
  ],
  edges: [{ id: 'e1', from: 'n1', out: 'next', to: 'n2', in: 'in' },
    { id: 'e2', from: 'n2', out: 'result', to: 'n3', in: 'run' },
    { id: 'e3', from: 'n3', out: 'series', to: 'n4', in: 'series' }],
  view: { x: 0, y: 0, zoom: 1 }, ...more,
});

export const SCENES = [
  {
    // The screen: a worked example open, its Run simulation block selected.
    name: 'layout', still: true,
    async run(S) {
      const P = S.win.PXB;
      await P.loadTemplate('frt', { quiet: true, ask: false });
      await S.until((w) => w.document.querySelector(node('n10')), 8000, 'the example');
      P.fitView();
      P.focusNode('n4');
      const pal = (await S.box('#pxbPalette')), side = (await S.box('#pxbSide'));
      return { boxes: {
        toolbar: '#pxbToolbar',
        blocks: '#pxbPalette',
        // The canvas is the whole page under the panels: the part of it between them.
        canvas: { x: pal.x + pal.width + 12, y: pal.y, width: side.x - pal.x - pal.width - 24, height: Math.max(pal.height, side.height) },
        side: '#pxbSide',
      } };
    },
  },
  {
    // An empty canvas: search, click a block in, drag another one out.
    name: 'add',
    async run(S) {
      await blank(S);
      foldSide(S);
      await S.wait(300);
      S.begin();
      S.mark('Search');
      await S.focus(['#pxbPalSearch', { x: 20, y: 80, width: 560, height: 300 }], { pad: 10, after: 300 });
      await search(S, 'run simulation');
      S.mark('Click to add');
      await S.click(palItem('px.run'), { after: 1200 });
      await S.focus(null, { ms: 800 });
      await S.click('#pxbFit', { after: 900 });
      await park(S);
      S.mark('Or drag');
      await search(S, 'read a channel');
      const st = await S.box(node('n1'));                         // under Start, clear of the rest
      await S.drag(palItem('px.series'), { x: st.x - 30, y: st.y + st.height + 90 }, { after: 900 });
      await park(S);
      await S.wait(1600);
    },
  },
  {
    // A flow wire from Reached the end, then a data wire from Peak; the colours' key.
    name: 'wire',
    async run(S) {
      foldSide(S);
      await load(S, voltages(), { x: 285, y: 150, zoom: 0.92 });
      S.begin();
      await S.focus([node('n2'), node('n3'), node('n5')], { pad: 30, after: 300 });
      S.mark('Flow wire');
      await S.drag(handle('n2', 'ok'), handle('n5', 'in'), { after: 1100 });
      S.mark('Data wire');
      await S.drag(handle('n4', 'value'), handle('n5', 'add'), { after: 1500 });
      await park(S);
      S.mark('Wire colours');
      await S.focus(null, { ms: 700 });
      await S.click('#pxbLegend summary', { after: 400 });
      await S.focus('#pxbLegend', { pad: 60 });
      await S.wait(2600);
    },
  },
  {
    // A range loop, a run in each pass, and a message after all of them.
    name: 'loop',
    async run(S) {
      await blank(S);
      foldSide(S);
      await S.wait(300);
      S.begin();
      S.mark('Add the loop');
      await S.focus(['#pxbPalSearch', { x: 20, y: 80, width: 560, height: 300 }], { pad: 10, after: 300 });
      await search(S, 'range');
      await S.click(palItem('flow.range'), { after: 900 });
      await S.focus(null, { ms: 700 });
      S.mark('Fill Each pass');
      await search(S, 'run simulation');
      await S.click(palItem('px.run'), { after: 1000 });
      await S.click('#pxbFit', { after: 1200 });
      S.mark('Drag from After all passes');
      const h = await S.centre(handle('n2', 'done'));
      await S.focus([handle('n2', 'done'), { x: h.x + 120, y: h.y + 80, width: 260, height: 260 }], { pad: 40 });
      await S.drag(h, { x: h.x + 190, y: h.y + 150 }, { after: 900 });
      S.mark('Pick the next step');
      await S.fill('.pxb-qa-search', 'print', { click: false, delay: 110, end: null, after: 500 });
      await S.click({ text: 'Print a message', in: '.pxb-qa' }, { after: 1000 });
      await S.focus(null, { ms: 700 });
      await S.click('#pxbFit', { after: 1500 });
      await park(S);
      await S.wait(1200);
    },
  },
  {
    // Problems first; then Start's case, and which parameter a Set parameter block writes.
    name: 'settings',
    async run(S) {
      await load(S, {
        app: 'pscad-builder', v: 1, name: 'Load resistance',
        nodes: [
          { id: 'n1', type: 'start', x: 0, y: 140, label: '', s: {} },
          { id: 'n3', type: 'px.set', x: 215, y: 120, label: '', s: { el: { cls: '', name: '', match: 'one' }, param: '' } },
          { id: 'n2', type: 'px.run', x: 470, y: 120, label: '', s: {} },
        ],
        edges: [{ id: 'e1', from: 'n1', out: 'next', to: 'n3', in: 'in' }, { id: 'e2', from: 'n3', out: 'next', to: 'n2', in: 'in' }],
        view: { x: 0, y: 0, zoom: 1 },
      }, { x: 335, y: 240, zoom: 0.78 });
      const side = await S.box('#pxbSide');
      const top = { x: side.x, y: side.y, width: side.width, height: 240 };   // its tabs and the first lines
      S.begin();
      S.mark('See what is missing');
      await S.focus(top, { pad: 16, after: 300 });
      await S.click('.ctrl-tab[data-tab="problems"]', { after: 2600 });
      S.mark('Select a block');
      await S.click('.ctrl-tab[data-tab="settings"]', { after: 500 });
      await S.focus(null, { ms: 700 });
      await S.click(head('n1'), { after: 900 });
      S.mark('Fill in what is required');
      const project = '#pxbInspector [data-key="project"]';
      await S.reveal(project, 0.45, 600);
      await S.focus(project, { pad: 110 });
      await S.fill(project + ' input', 'vdiv.pscx', { delay: 70, after: 1200 });
      S.mark('Choose from what fits');
      await S.focus(null, { ms: 700 });
      await S.click(head('n3'), { after: 900 });
      const attr = '#pxbInspector [data-key="param"]';
      await S.reveal(attr, 0.62, 600);
      await S.focus(['#pxbInspector .pxb-el-cls', attr], { pad: 30 });
      await S.choose('#pxbInspector .pxb-el-cls', '(master:resistor)', { after: 700 });
      await S.fill('#pxbInspector .pxb-elpick input[type="text"]', 'Load', { delay: 90, after: 500 });
      await S.fill(attr + ' input', 'R', { delay: 80, after: 900 });
      S.mark('Nothing left to do');
      await S.focus(null, { ms: 700 });
      await S.click('.ctrl-tab[data-tab="problems"]', { after: 400 });
      await S.focus(['#pxbDownload', top], { pad: 16 });
      await S.wait(2400);
    },
  },
  {
    // Double-click a block's name, type a new one; Settings shows it too.
    name: 'rename',
    async run(S) {
      await load(S, {
        app: 'pscad-builder', v: 1, name: 'Voltages',
        nodes: [
          { id: 'n1', type: 'start', x: 0, y: 140, label: '', s: { project: 'vdiv.pscx' } },
          { id: 'n2', type: 'px.run', x: 260, y: 120, label: '', s: {} },
        ],
        edges: [{ id: 'e1', from: 'n1', out: 'next', to: 'n2', in: 'in' }],
        view: { x: 0, y: 0, zoom: 1 },
      }, { x: 300, y: 230, zoom: 1 });
      S.begin();
      await S.focus([node('n1'), node('n2')], { pad: 40, after: 300 });
      S.mark('Double-click the name');
      await S.dblclick(node('n2') + ' .pxb-n-title', { after: 900 });
      S.mark('Type, then press Enter');
      await S.fill(node('n2') + ' .pxb-n-rename', 'Run to 2 s', { click: false, delay: 80, end: 'Enter', after: 1000 });
      S.mark('Or use Settings');
      await S.focus(['#pxbInspector input[aria-label="Name on the canvas"]', node('n2')], { pad: 40 });
      await S.moveTo('#pxbInspector input[aria-label="Name on the canvas"]', { ms: 700 });
      await S.wait(2000);
    },
  },
  {
    // A blank canvas; Quick start opens Fault ride through.
    name: 'quickstart',
    async run(S) {
      await blank(S);
      S.begin();
      S.mark('Open Quick start');
      await S.focus('#pxbToolbar', { pad: 60, after: 300 });
      await S.click('#pxbQsBtn', { after: 600 });
      await S.focus(['#pxbToolbar', '#pxbQuickStart'], { pad: 20 });
      S.mark('Pick an example');
      await S.moveTo('.quick-start-btn[data-preset="frt"]', { ms: 700 });
      await S.wait(1600);
      await S.click('.quick-start-btn[data-preset="frt"]', { after: 300 });
      await S.focus(null, { ms: 900 });
      await park(S);
      await S.wait(2400);
    },
  },
  {
    // Fault ride through: its Add row block, then its graph.
    name: 'results',
    async run(S) {
      await S.win.PXB.loadTemplate('frt', { quiet: true, ask: false });
      await S.until((w) => w.document.querySelector(node('n10')), 8000, 'the example');
      await S.wait(300);
      S.win.PXB.app.canvas.setViewport({ x: -840, y: 150, zoom: 0.85 });
      await S.wait(300);
      const side = await S.box('#pxbSide');
      const top = { x: side.x, y: side.y, width: side.width, height: 300 };   // the block's name and first settings
      S.begin();
      S.mark('Add row to results table');
      await S.click(head('n9'), { after: 600 });
      await S.focus([node('n9'), top], { pad: 20 });
      await S.wait(1800);
      S.mark('Draw a graph');
      await S.focus(null, { ms: 700 });
      S.win.PXB.focusNode('n10');
      await S.wait(1200);
      await S.click(head('n10'), { after: 600 });
      await S.focus([node('n10'), top], { pad: 20 });
      await S.wait(2400);
      await S.focus(null, { ms: 700 });
      await park(S);
    },
  },
  {
    // Fault ride through: Save, the Python, Download (a demo saves no file).
    name: 'download',
    async run(S) {
      const t = await (await S.win.fetch('templates/frt.json')).json();
      t.nodes.find((n) => n.type === 'start').s.project = 'vdiv.pscx';
      await load(S, t);
      await S.wait(600);
      S.win.PXB.select([]);
      const side = await S.box('#pxbSide');
      S.begin();
      S.mark('Save');
      await S.focus('#pxbToolbar', { pad: 60, after: 300 });
      await S.click('#pxbSave', { after: 300 });
      await S.focus(null, { ms: 700 });                           // the message it leaves, at the bottom
      await S.wait(1400);
      S.mark('Read the Python');
      await S.click('.ctrl-tab[data-tab="python"]', { after: 400 });
      await S.focus({ x: side.x, y: side.y, width: side.width, height: 330 }, { pad: 16 });
      S.doc.getElementById('pxbCodeWrap').scrollTo({ top: 520, behavior: 'smooth' });
      await S.wait(2200);
      S.mark('Download');
      await S.focus(null, { ms: 700 });
      await S.click('#pxbDownload', { after: 2800 });
    },
  },
];
