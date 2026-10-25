// The scenes: each drives the real builder and returns the crop (x, y, w, h of the page) and
// encoding options. S.mark('...') names the moments the guide's steps refer to, in order (the
// guide's list has one item per mark, in the same order). `h` is the page height when a scene
// needs a taller screen than 720.
import { sleep } from './lib.mjs';

const blank = async (S) => { await S.page.click('#pfbStarterBlank'); await sleep(500); };
const fold = (S) => S.page.evaluate(() => window.PFB.setSheet(false));
const load = (S, obj) => S.page.evaluate((o) => window.PFB.loadWorkflowObject(o, { quiet: true }), obj);
const node = (id) => `.react-flow__node[data-id="${id}"]`;
const handle = (id, h) => `${node(id)} .react-flow__handle[data-handleid="${h}"]`;
const park = (S) => S.glide(900, 560, 500);                 // leave a tooltip's way

const voltages = (extra = {}) => ({
  app: 'pf-builder', v: 1, name: 'Voltages',
  nodes: [
    { id: 'n1', type: 'start', x: 0, y: 120, label: '', s: { project: 'Nine-bus System' } },
    { id: 'n2', type: 'pf.ldf', x: 215, y: 100, label: '', s: {} },
    { id: 'n3', type: 'pf.get', x: 450, y: 100, label: 'Bus voltages', s: { el: { cls: 'ElmTerm', name: '*', match: 'all' }, attr: 'm:u' } },
    { id: 'n4', type: 'out.table.add', x: 745, y: 100, label: '', s: { table: 'Voltages' } },
  ],
  edges: [{ id: 'e1', from: 'n1', out: 'next', to: 'n2', in: 'in' }],
  view: { x: 0, y: 0, zoom: 1 }, ...extra,
});

export const SCENES = [
  {
    name: 'add',
    async run(S) {
      const { page } = S;
      await blank(S); await fold(S);
      await S.click('#pfbPalSearch', { ms: 300 });
      S.begin();
      S.mark('Search the Blocks panel');
      await S.type('#pfbPalSearch', 'load flow');
      await sleep(500);
      S.mark('Click a block to add it');
      await S.click('.pfb-pal-item[data-type="pf.ldf"]', { after: 1500 });
      await S.click('#pfbFit', { after: 1000 });
      await park(S);
      S.mark('Drag a block onto the canvas');
      await S.click('#pfbPalSearch', { ms: 500 });
      await page.fill('#pfbPalSearch', '');
      await S.type('#pfbPalSearch', 'read attr');
      await sleep(400);
      await S.drag('.pfb-pal-item[data-type="pf.get"]', { x: 930, y: 470 }, { after: 600 });
      await park(S);
      await sleep(1800);
      return { crop: [0, 0, 1280, 720] };
    },
  },
  {
    name: 'wire',
    async run(S) {
      const { page } = S;
      await fold(S);
      await load(S, voltages());
      await sleep(900);
      await page.evaluate(() => window.PFB.app.canvas.setViewport({ x: 285, y: 150, zoom: 0.92 }));
      await sleep(900);
      S.begin();
      S.mark('A flow wire: then do this');
      await S.drag(handle('n2', 'ok'), handle('n3', 'in'), { after: 1100 });
      S.mark('A data wire: use this value');
      await S.drag(handle('n3', 'max'), handle('n4', 'add'), { after: 1500 });
      await park(S);
      S.mark('Wire colours');
      await S.click('#pfbLegend summary', { after: 1800 });
      await sleep(1200);
      return { crop: [0, 0, 1280, 720] };
    },
  },
  {
    name: 'loop',
    async run(S) {
      const { page } = S;
      await blank(S); await fold(S);
      await S.click('#pfbPalSearch', { ms: 300 });
      S.begin();
      S.mark('Add a loop block');
      await S.type('#pfbPalSearch', 'range');
      await sleep(400);
      await S.click('.pfb-pal-item[data-type="flow.range"]', { after: 1300 });
      S.mark('Add steps inside Each pass');
      await S.click('#pfbPalSearch', { ms: 500 });
      await page.fill('#pfbPalSearch', '');
      await S.type('#pfbPalSearch', 'load flow');
      await sleep(400);
      await S.click('.pfb-pal-item[data-type="pf.ldf"]', { after: 1300 });
      await S.click('#pfbFit', { after: 1200 });
      S.mark('Drag from After all passes');
      const h = await S.centre(handle('n2', 'done'));
      await S.drag(h, { x: h.x + 190, y: h.y + 150 }, { after: 900 });
      await S.type('.pfb-qa-search', 'print', 110);
      await sleep(500);
      S.mark('Pick the block that runs after the loop');
      await S.click('.pfb-qa-item:has-text("Print a message")', { after: 1200 });
      await S.click('#pfbFit', { after: 1500 });
      await park(S);
      await sleep(1200);
      return { crop: [0, 0, 1280, 720] };
    },
  },
  {
    name: 'settings', h: 780,
    async run(S) {
      const { page } = S;
      await load(S, {
        app: 'pf-builder', v: 1, name: 'Line loading',
        nodes: [
          { id: 'n1', type: 'start', x: 0, y: 140, label: '', s: {} },
          { id: 'n2', type: 'pf.ldf', x: 215, y: 120, label: '', s: {} },
          { id: 'n3', type: 'pf.get', x: 450, y: 120, label: '', s: {} },
        ],
        edges: [{ id: 'e1', from: 'n1', out: 'next', to: 'n2', in: 'in' }, { id: 'e2', from: 'n2', out: 'ok', to: 'n3', in: 'in' }],
        view: { x: 0, y: 0, zoom: 1 },
      });
      await sleep(800);
      await page.evaluate(() => window.PFB.app.canvas.setViewport({ x: 335, y: 240, zoom: 0.78 }));
      await sleep(700);
      S.begin();
      S.mark('See what is missing');
      await S.click('.ctrl-tab[data-tab="problems"]', { after: 2600 });
      S.mark('Select a block');
      await S.click('.ctrl-tab[data-tab="settings"]', { after: 500 });
      await S.click(node('n1') + ' .pfb-n-head', { after: 1000 });
      S.mark('Fill in a required setting');
      await S.click('#pfbInspector [data-key="project"] input', { after: 300 });
      await S.type('#pfbInspector [data-key="project"] input', 'Nine-bus System', 70);
      await sleep(1200);
      S.mark('Choose what fits the block');
      await S.click(node('n3') + ' .pfb-n-head', { after: 1000 });
      await S.click('#pfbInspector .pfb-el-cls', { after: 700 });
      const opt = page.locator('.combo-list .combo-opt:has-text("(ElmLne)")').first();
      await opt.scrollIntoViewIfNeeded();
      await S.click(opt, { after: 900 });
      await S.click('#pfbInspector .pfb-elpick input[type="text"]', { after: 300 });
      await S.type('#pfbInspector .pfb-elpick input[type="text"]', 'Line 1', 90);
      await sleep(500);
      const attr = '#pfbInspector [data-key="attr"] input';
      await S.click(attr, { after: 300 });
      await page.keyboard.press('Control+A');
      await S.type(attr, 'c:loading', 80);
      await sleep(900);
      S.mark('Nothing left to do');
      await S.click('.ctrl-tab[data-tab="problems"]', { after: 2000 });
      return { crop: [292, 0, 988, 780] };
    },
  },
  {
    name: 'rename',
    async run(S) {
      const { page } = S;
      await load(S, {
        app: 'pf-builder', v: 1, name: 'Voltages',
        nodes: [
          { id: 'n1', type: 'start', x: 0, y: 140, label: '', s: { project: 'Nine-bus System' } },
          { id: 'n2', type: 'pf.get', x: 260, y: 120, label: '', s: { el: { cls: 'ElmTerm', name: '*', match: 'all' }, attr: 'm:u' } },
        ],
        edges: [{ id: 'e1', from: 'n1', out: 'next', to: 'n2', in: 'in' }],
        view: { x: 0, y: 0, zoom: 1 },
      });
      await sleep(800);
      await page.evaluate(() => window.PFB.app.canvas.setViewport({ x: 300, y: 230, zoom: 1 }));
      await sleep(600);
      S.begin();
      S.mark('Double-click the name');
      const t = await S.moveTo(node('n2') + ' .pfb-n-title');
      await sleep(250);
      await page.mouse.dblclick(t.x, t.y);
      await sleep(900);
      S.mark('Type a new name');
      await page.keyboard.press('Control+A');
      for (const ch of 'Busbar voltage') { await page.keyboard.type(ch); await sleep(80); }
      await sleep(500);
      await page.keyboard.press('Enter');
      await sleep(1000);
      S.mark('The name follows everywhere');
      await S.moveTo('#pfbInspector input[aria-label="Name on the canvas"]', { ms: 700 });
      await sleep(1800);
      return { crop: [250, 70, 1030, 450] };
    },
  },
  {
    name: 'quickstart',
    async run(S) {
      const { page } = S;
      await page.click('#pfbStarterBlank'); await sleep(500);
      S.begin();
      S.mark('Open Quick start');
      await S.click('#pfbQsBtn', { after: 1000 });
      S.mark('Pick a worked example');
      await S.moveTo('.quick-start-btn[data-preset="n-1"]', { ms: 700 });
      await sleep(1400);
      await S.click('.quick-start-btn[data-preset="n-1"]', { after: 1200 });
      await park(S);
      await sleep(2400);
      return { crop: [0, 0, 1280, 720] };
    },
  },
  {
    name: 'results',
    async run(S) {
      const { page } = S;
      await page.evaluate(() => window.PFB.loadTemplate('shc-buses', { quiet: true, ask: false }));
      await sleep(1500);
      await page.evaluate(() => window.PFB.app.canvas.setViewport({ x: -840, y: 150, zoom: 0.85 }));
      await sleep(900);
      S.begin();
      S.mark('Add row to results table');
      await S.click(node('n7') + ' .pfb-n-head', { after: 2200 });
      S.mark('Draw a graph');
      await page.evaluate(() => window.PFB.focusNode('n9'));
      await sleep(1500);
      await S.click(node('n9') + ' .pfb-n-head', { after: 2600 });
      await park(S);
      await sleep(1000);
      return { crop: [0, 0, 1280, 720] };
    },
  },
  {
    name: 'download',
    async run(S) {
      const { page } = S;
      await page.evaluate(async () => {
        const t = await (await fetch('templates/ldf-cases.json')).json();
        t.nodes.find(n => n.type === 'start').s.project = 'Nine-bus System';
        window.PFB.loadWorkflowObject(t, { quiet: true });
      });
      await sleep(1500);
      await page.evaluate(() => window.PFB.select([]));
      S.begin();
      S.mark('Save the workflow');
      await S.click('#pfbSave', { after: 2200 });
      S.mark('Read the Python');
      await S.click('.ctrl-tab[data-tab="python"]', { after: 1800 });
      await page.evaluate(() => { document.getElementById('pfbCodeWrap').scrollTo({ top: 520, behavior: 'smooth' }); });
      await sleep(1800);
      S.mark('Download');
      await S.click('#pfbDownload', { after: 2800 });
      return { crop: [0, 0, 1280, 720] };
    },
  },
  {
    name: 'layout', still: true,
    async run(S) {
      const { page } = S;
      await page.evaluate(() => window.PFB.loadTemplate('ldf-cases', { quiet: true, ask: false }));
      await sleep(1500);
      await page.evaluate(() => window.PFB.fitView());
      await sleep(700);
      await page.evaluate(() => window.PFB.focusNode('n5'));
      await sleep(1200);
      await page.mouse.move(640, 560);
      await sleep(400);
      return { boxes: { toolbar: '#pfbToolbar', blocks: '#pfbPalette', canvas: '#pfbCanvas', side: '#pfbSide', download: '#pfbDownload', qs: '#pfbQsBtn', save: '#pfbSave', problems: '.ctrl-tab[data-tab="problems"]' } };
    },
  },
];
