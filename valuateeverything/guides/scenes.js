// The Valuate Everything guide's live demos: guide-live.js opens the tool in a frame of this page
// and plays each scene in it. Before S.begin() a scene sets itself up, unseen; S.mark('...') names
// the moments the guide's steps refer to, in order (the guide's list under the demo has one item
// per mark); S.focus(part) zooms in on what a step is about, S.focus() shows the whole tool.
//
// Nothing here waits on the web. The page asks the site itself for one file, the currency codes
// the Price column offers (../costofliving-comparator/currency_rates.json, with the browser's own
// list as its fallback); the chart library comes from cdnjs, as for a reader, and the equation's
// typesetter from jsDelivr, without which the tool writes the equation as plain text. A scene that
// needs the chart waits for it to be drawn, or for the tool's own note that it could not load.
// Check them all with  node _ref/guide-check.mjs valuateeverything
export const TOOL = {
  path: '../',
  seen: [],                                            // the tool has no tour
  storage: { 'abt:ctrl:/valuateeverything/': '1' },    // the Inputs card left open
  // script.js exposes window.__VE at the end of its start-up, after its first answer.
  ready: (win) => win.__VE && /\d/.test(win.document.getElementById('kpiFair').textContent) && drawn(win),
};

// The chart drawn, or the tool's own word that its library could not load.
function drawn(w) {
  const d = w.document;
  return !!d.querySelector('#plotDiv .main-svg') || !d.getElementById('plotEmpty').hidden;
}
const tab = (name) => `.ctrl-tab[data-tab="${name}"]`;
const qs = (key) => `.quick-start-btn[data-preset="${key}"]`;
const seg = (sel, v) => `${sel} + .seg-group .seg-btn[data-val="${v}"]`;
const cell = (r, c) => `#gridWrap tr[data-r="${r}"] td[data-c="${c}"] input`;
const item = (k, part) => `#itemList .item-card:nth-child(${k}) ${part}`;
const groupOf = (id) => (S) => { const e = S.doc.getElementById(id); return e && e.closest('.field-group'); };
const sliderOf = (id) => (S) => { const e = S.doc.getElementById(id); return e && e.closest('.slider-block'); };
const fair = '.metrics .metric:nth-child(2)';                // the Fair price card
const park = (S, x = 1264, y = 860) => S.glide(x, y, 500);   // in the page's right margin, out of a tooltip's way
// Valuate: the answer catches up with the form, and the chart is drawn again.
const valuate = async (S, after = 400) => {
  await S.click('#valuateBtn', { after: 0 });
  await S.until((w) => !w.document.body.classList.contains('is-stale') && drawn(w), 30000, 'the answer');
  await S.wait(after);
};
// A Quick Start, loaded before the scene begins (the Inputs card must be open).
const preset = async (S, key) => {
  await S.click(qs(key), { after: 0 });
  await S.until((w) => w.document.querySelector(`.quick-start-btn.active[data-preset="${key}"]`) && drawn(w), 20000, 'the Quick Start');
  await park(S);
  await S.wait(300);
};

export const SCENES = [
  {
    // The screen: the page as it opens (the Camry Hybrid), down to What this assumes.
    name: 'layout', still: true,
    async run() {
      return { boxes: {
        inputs: '.layout > .controls',
        answer: ['#verdict', '.metrics'],
        chart: '.chart-card',
        tables: ['#itemsSection', '#coefSection', '#dataSection', '.assumes-card'],
      } };
    },
  },
  {
    // A first visit: the inputs are folded to a rail; open them and load an example.
    name: 'quickstart', storage: {},
    async run(S) {
      await park(S);
      S.begin();
      await S.focus('.ctrl-fold-rail', { pad: 140, after: 400 });
      S.mark('Open the inputs');
      await S.click('.ctrl-fold-rail', { after: 600 });
      S.mark('Pick an example');
      await S.focus('.quick-start-row', { pad: 60 });
      await S.moveTo(qs('camera'), { ms: 700 });
      await S.wait(2200);
      await S.moveTo(qs('house'), { ms: 600 });
      await S.wait(2200);
      await S.click(qs('house'), { after: 300 });
      await S.focus(null, { ms: 900 });
      await S.until((w) => drawn(w), 20000, 'the chart');
      await park(S);
      await S.wait(2600);
    },
  },
  {
    // Market data: what it is, the columns, a listing changed, Valuate, the other ways in.
    name: 'market',
    async run(S) {
      S.begin();
      S.mark('What you are valuing');
      await S.focus(groupOf('itemWhat'), { pad: 60 });
      await S.moveTo('#itemWhat', { ms: 700 });
      await S.wait(1400);
      S.mark('Columns');
      await S.focus(groupOf('colList'), { pad: 20 });
      await S.moveTo('#colList .col-row:nth-child(2) .col-type', { ms: 700 });
      await S.wait(900);
      await S.moveTo('.col-head .tip-icon', { ms: 600 });
      await S.wait(2200);
      await S.moveTo('#colList .col-row:nth-child(5) .col-name', { ms: 600 });
      await S.wait(1000);
      S.mark('Listings');
      await S.reveal('#gridWrap', 0.3);
      await S.focus('#entry-table', { pad: 20 });
      await S.fill(cell(0, 0), '30980', { after: 900 });
      await S.focus(['#entry-table', '#valuateBtn'], { pad: 20 });
      await S.moveTo('#staleNote', { ms: 600 });
      await S.wait(1600);
      S.mark('Valuate');
      await valuate(S, 300);
      await S.focus();
      await park(S);
      await S.wait(2400);
      S.mark('Text, CSV or AI');
      await S.reveal('#entryMode', 0.15);
      await S.focus(groupOf('entryMode'), { pad: 20 });
      await S.click(seg('#entryMode', 'text'), { after: 1800 });
      await S.click(seg('#entryMode', 'csv'), { after: 1600 });
      await S.click(seg('#entryMode', 'ai'), { after: 2400 });
    },
  },
  {
    // Items to buy: one car, its asking price and year, Valuate, then more items.
    name: 'items',
    async run(S) {
      await S.click(tab('items'), { after: 300 });
      await park(S);
      S.begin();
      S.mark('An item to check');
      await S.focus(item(1, ''), { pad: 30 });
      await S.moveTo(item(1, '.item-name'), { ms: 700 });
      await S.wait(1200);
      S.mark('Asking price');
      await S.fill(item(1, '.item-ask'), '30990', { after: 900 });
      S.mark('Its features');
      await S.fill(item(1, '[data-col="c2"]'), '2022', { after: 600 });
      await S.moveTo(item(1, '[data-age="c2"]'), { ms: 500 });
      await S.wait(1400);
      S.mark('Valuate');
      await S.focus(['.layout > .controls', fair], { pad: 10 });
      await valuate(S, 300);
      await S.focus(['#verdict', '.metrics'], { pad: 20 });
      await park(S);
      await S.wait(2600);
      S.mark('Add or copy');
      await S.focus(item(1, '.item-head'), { pad: 60 });
      await S.moveTo(item(1, '.item-dup'), { ms: 600 });
      await S.wait(1200);
      await S.reveal('#addItemBtn', 0.8);
      await S.focus('#addItemBtn', { pad: 100 });
      await S.moveTo('#addItemBtn', { ms: 600 });
      await S.wait(1600);
    },
  },
  {
    // Assumptions, on the Perth house: the year and inflation, then the model and Ridge.
    name: 'assumptions',
    async run(S) {
      await preset(S, 'house');
      await S.click(tab('settings'), { after: 300 });
      await park(S);
      S.begin();
      S.mark('Prices');
      await S.focus(groupOf('currency'), { pad: 30 });
      await S.moveTo('#currency', { ms: 600 });
      await S.wait(800);
      await S.moveTo('#curYear', { ms: 600 });
      await S.wait(1200);
      S.mark('Inflation');
      await S.focus([sliderOf('inflation'), fair], { pad: 20 });
      await S.slide('#inflation', 6, { ms: 1400, after: 600 });
      await valuate(S, 2200);
      S.mark('Modelling approach');
      await S.reveal('#model', 0.4, 600);
      await S.focus([groupOf('model'), fair], { pad: 20 });
      await S.choose('#model', 'Ridge regression', { after: 900 });
      S.mark('Ridge penalty');
      await S.reveal('#lambda', 0.6, 600);
      await S.focus([sliderOf('lambda'), fair], { pad: 20 });
      await S.slide('#lambda', 1, { ms: 1400, after: 600 });
      await valuate(S, 1200);
      await S.focus();
      await park(S);
      await S.wait(1800);
    },
  },
  {
    // The answer: the sentence and the four figures, then the tables under the chart.
    name: 'results', storage: {},
    async run(S) {
      await park(S);
      S.begin();
      S.mark('The answer');
      await S.focus('#verdict', { pad: 20 });
      await S.moveTo('#verdict .v-num', { ms: 700 });
      await S.wait(2200);
      S.mark('Four figures');
      await S.focus('.metrics', { pad: 20 });
      for (const id of ['#kpiBest', '#kpiFair', '#kpiFit', '#kpiErr']) { await S.moveTo(id, { ms: 500 }); await S.wait(900); }
      S.mark('Items to buy');
      await S.focus();
      await S.scrollTo('#itemsSection', 60, 900);
      await S.click('#itemsSection .fold-btn', { after: 500 });
      await S.focus('#itemsSection', { pad: 16 });
      await S.wait(2200);
      S.mark('Price model terms');
      await S.focus();
      await S.scrollTo('#coefSection', 60, 800);
      await S.click('#coefSection .fold-btn', { after: 500 });
      await S.focus('#coefSection', { pad: 16 });
      await S.moveTo('#equation', { ms: 700 });
      await S.wait(2400);
      S.mark('Listings against the model');
      await S.focus();
      await S.scrollTo('#dataSection', 60, 800);
      await S.click('#dataSection .fold-btn', { after: 500 });
      await S.focus('#dataSection', { pad: 16 });
      await S.wait(2400);
      S.mark('What this assumes');
      await S.focus();
      await S.scrollTo('.assumes-card', 300, 900);
      await S.click('.assumes-card .fold-btn', { after: 500 });
      await S.focus('.assumes-card', { pad: 16 });
      await S.wait(2600);
    },
  },
  {
    // The chart: the line and the dots, another feature across, held at an item, in 3D.
    name: 'chart', storage: {},
    async run(S) {
      await S.scrollTo('.chart-card', 12, 900);
      await park(S);
      // The plot's box, not the plot: without its library the tool says so in the same place.
      const plot = await S.box('.plot-wrap');
      S.begin();
      S.mark('The line and the dots');
      await S.focus('.plot-wrap', { pad: 10 });
      await S.moveTo('.plot-wrap', { at: { x: plot.x + plot.width * 0.25, y: plot.y + plot.height * 0.3 }, ms: 700 });
      await S.glide(plot.x + plot.width * 0.6, plot.y + plot.height * 0.45, 1600);
      await S.wait(1600);
      S.mark('Across');
      await S.focus('.chart-opts', { pad: 40 });
      await S.choose('#axisX', 'Year', { after: 600 });
      await S.focus('.chart-card', { pad: 8 });
      await S.wait(2000);
      S.mark('Hold others at');
      await S.focus('.chart-opts', { pad: 40 });
      await S.choose('#holdAt', '2021 Ascent Sport', { after: 600 });
      await S.focus('.chart-card', { pad: 8 });
      await S.moveTo('#chartNote', { ms: 600 });
      await S.wait(2400);
      S.mark('3D');
      await S.focus('.chart-opts', { pad: 40 });
      await S.click(seg('#viewDim', '3d'), { after: 600 });
      await S.choose('#axisY', 'Odometer', { after: 600 });
      await S.focus('.chart-card', { pad: 8 });
      await park(S);
      await S.wait(2800);
      S.mark('Show data points');
      await S.focus('.chart-opts', { pad: 40 });
      await S.click('#showData', { after: 1600 });
      await S.click('#showData', { after: 600 });
      await S.click(seg('#viewDim', '2d'), { after: 600 });
      await S.focus();
      await park(S);
      await S.wait(1600);
    },
  },
  {
    // Save, open and Share, and the listings as a CSV.
    name: 'share',
    async run(S) {
      await park(S);
      S.begin();
      S.mark('Save or open a file');
      await S.focus(['.scenario-save', '.scenario-load'], { pad: 120 });
      await S.moveTo('.scenario-save', { ms: 800 });
      await S.wait(1400);
      await S.moveTo('.scenario-load', { ms: 500 });
      await S.wait(1200);
      S.mark('Share the chart');
      await S.focus();
      await S.scrollTo('.chart-card', 12, 900);
      await S.focus('.chart-card .share-toggle', { pad: 40 });
      await S.click('.chart-card .share-toggle', { after: 300 });
      await S.focus(['.chart-card .share-toggle', '[role=menu]'], { pad: 30 });
      for (const t of ['Download as PNG', 'Share as link', 'Embed as HTML']) {
        await S.moveTo({ text: t, in: '[role=menu]' }, { ms: 500 });
        await S.wait(900);
      }
      await S.key('Escape');
      S.mark('The listings as CSV');
      await S.focus();
      await S.scrollTo('#dataSection', 200, 900);
      await S.focus('#dataSection .detail-head', { pad: 60 });
      await S.moveTo('#dataCsvBtn', { ms: 700 });
      await S.wait(2000);
    },
  },
  {
    // Part 2: the input the fair price rests on most (the grade), then the age, on the Camry.
    name: 'sensitivity',
    async run(S) {
      await S.click(tab('items'), { after: 300 });
      await park(S);
      const box = item(1, '[data-col="c4"]');
      S.begin();
      S.mark('Not above Ascent');
      await S.focus([item(1, ''), fair], { pad: 10 });
      await S.click(box, { after: 700 });
      await valuate(S, 300);
      await S.focus(['#verdict', '.metrics'], { pad: 20 });
      await park(S);
      await S.wait(3000);
      S.mark('A year newer');
      await S.focus([item(1, ''), fair], { pad: 10 });
      await S.click(box, { after: 500 });
      await S.fill(item(1, '[data-col="c2"]'), '2022', { after: 500 });
      await valuate(S, 300);
      await S.focus(['#verdict', '.metrics'], { pad: 20 });
      await park(S);
      await S.wait(2800);
      S.mark('A year older');
      await S.focus([item(1, ''), fair], { pad: 10 });
      await S.fill(item(1, '[data-col="c2"]'), '2020', { after: 500 });
      await valuate(S, 300);
      await S.focus(['#verdict', '.metrics'], { pad: 20 });
      await park(S);
      await S.wait(2800);
    },
  },
];
