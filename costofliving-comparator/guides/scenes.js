// The Cost of Living Comparator guide's live demos: guide-live.js opens the tool in a frame of this
// page and plays each scene in it. Before S.begin() a scene sets itself up, unseen; S.mark('...')
// names the moments the guide's steps refer to, in order (the guide's list under the demo has one
// item per mark); S.focus(part) zooms in on what a step is about, S.focus() shows the whole tool.
// The Map View is the same model on the same inputs, so its scenes open it with their own path
// (MAP). Check them all with
//   node _ref/guide-check.mjs costofliving-comparator
//
// Nothing here fetches from the web. Both pages ask three free feeds for today's exchange rate
// unless their shared cache (LIVE_KEY) holds a fresh one, so every frame starts with that cache
// filled from the tool's own bundled rates (currency_rates.json, the rates the indices were priced
// at), stamped now. The demos then show the figures the guide works by hand, for every reader.
const LIVE_KEY = 'costofliving-comparator:live-fx';
const BUNDLED = await fetch(new URL('../currency_rates.json', import.meta.url)).then((r) => r.json());
function liveCache() {
  const rates = {};
  BUNDLED.data.forEach((r) => { rates[r.currency] = r.usd_rate; });
  return JSON.stringify({ savedAt: Date.now(), live: { rates, date: BUNDLED.metadata.updated_on, source: 'the rates bundled with the tool', url: '../currency_rates.json' } });
}
// A frame's storage: `extra`, and the rate cache made fresh each time a frame opens.
const store = (extra = {}) => {
  const o = { ...extra };
  Object.defineProperty(o, LIVE_KEY, { enumerable: true, get: liveCache });
  return o;
};

const MAP_CTRL = 'abt:ctrl:/costofliving-comparator/map/';
export const TOOL = {
  path: '../',
  seen: ['col-tour-v3-seen', 'colmap-tour-v1-seen'],
  storage: store(),
  ready: (win) => win.__COL_TOUR && win.document.querySelector('#fromPicker .city-search'),
};
// The Map View, ready once its world map is drawn; its Inputs card left open.
const MAP = { path: '../map/', storage: store({ [MAP_CTRL]: '1' }), ready: (win) => win.__colmap && win.__colmap.mapReady() };

/* ---- The comparator ------------------------------------------------------------------------ */
// A Quick Start loaded behind the veil: the Detailed table on one home city and its neighbours.
const quick = async (S, key) => {
  S.doc.querySelector(`.quick-start-btn[data-preset="${key}"]`).click();
  await S.until((w) => w.document.querySelector('#detailSec .salary-tr'), 8000, 'the Quick Start');
  await S.wait(200);
};
// A Simple comparison set behind the veil, through the tour's own hand-back: the tour's
// Jakarta to Perth example, then `patch` over it.
const plan = async (S, patch = {}) => {
  const T = S.win.__COL_TOUR;
  T.seedSimple();
  const s = T.saveState();
  Object.assign(s, patch);
  T.restoreState(s);
  await S.wait(200);
};
// Typed into a field a key at a time, without leaving it (a city search stays open).
const type = async (S, sel, text, delay = 120) => {
  const w = S.win, el = await S.find(sel);
  for (const ch of text) {
    el.value += ch;
    el.dispatchEvent(new w.Event('input', { bubbles: true }));
    await S.wait(delay);
  }
};
// A city picked as a reader picks one: click the search, type, click the city in the list.
const pick = async (S, picker, text, key) => {
  await S.click(`#${picker} .city-search`, { after: 300 });
  await type(S, `#${picker} .city-search`, text);
  await S.wait(500);
  await S.click(`#${picker} .city-opt[data-key="${key}"]`, { after: 700 });
};
const cell = (ri, ci) => `.dt-to-exp[data-ri="${ri}"][data-ci="${ci}"]`;
const req = (ci) => (S) => S.doc.querySelectorAll('#detailSec .salary-tr td.num-td')[ci];
const park = (S, x = 1272, y = 60) => S.glide(x, y, 500);

/* ---- The Map View -------------------------------------------------------------------------- */
// The map has stopped moving: two looks 50 ms apart find the same view.
const settle = (S) => {
  let last = '';
  return S.until((w) => { const t = JSON.stringify(w.__colmap.transform()); const same = t === last; last = t; return same; }, 10000, 'the map to settle');
};
const mapQuick = async (S, key = 'per') => {
  S.doc.querySelector(`.quick-start-btn[data-preset="${key}"]`).click();
  await S.wait(100);
  await settle(S);
};
// Where a city's dot is in the frame now.
const dot = (S, key) => {
  const p = S.win.__colmap.screenOf(key), r = S.doc.getElementById('mapCanvas').getBoundingClientRect();
  return { x: r.left + p[0], y: r.top + p[1] };
};
const seg = (group, val) => `#${group} .seg-btn[data-val="${val}"]`;

export const SCENES = [
  {
    // The screen: Jakarta to Perth, the tour's example, on the question "how much do I need to earn".
    name: 'layout', still: true,
    async run(S) {
      await plan(S, { goal: 'earn' });
      return { boxes: {
        question: '#modeCard',
        cities: '#simpleCityCard',
        rate: '#simpleFxCard',
        answer: '.analysis-card',
        assumes: '.assumes-card',
      } };
    },
  },
  {
    // The Map View's screen: the Perth Quick Start, Inputs open.
    name: 'map-layout', still: true, ...MAP,
    async run(S) {
      await mapQuick(S);
      return { boxes: {
        inputs: '.layout > .controls',
        map: '#mapCard',
        metrics: '#metrics',
        details: ['#tableCard', '.assumes-card'],
      } };
    },
  },
  {
    // Pick an example; read the Net Income row and the rows under it.
    name: 'quickstart',
    async run(S) {
      S.begin();
      S.mark('Pick an example');
      await S.focus('.quick-start-row', { pad: 60, after: 300 });
      await S.moveTo('.quick-start-btn[data-preset="sea"]', { ms: 700 });
      await S.wait(1500);
      await S.moveTo('.quick-start-btn[data-preset="sg-au"]', { ms: 600 });
      await S.wait(1500);
      await S.click('.quick-start-btn[data-preset="sg-au"]', { after: 600 });
      S.mark('Read the Net Income row');
      await S.focus();
      await S.scrollTo('#detailSec', 16, 900);
      await S.focus('#detailSec .salary-tr', { pad: 30 });
      await S.moveTo(req(0), { ms: 700 });
      await S.wait(1200);
      await S.moveTo(req(3), { ms: 900 });
      await S.wait(1600);
      S.mark('Each row, each city');
      await S.focus(['#detailSec tr[data-ri="0"]', '#detailSec tr[data-ri="4"]'], { pad: 20 });
      await S.moveTo(cell(0, 0), { ms: 700 });
      await S.wait(1400);
      await S.moveTo(cell(0, 1), { ms: 600 });
      await S.wait(1400);
      await S.focus('#detailSec .savings-tr', { pad: 30 });
      await S.moveTo('#detailSec .dt-sav[data-ci="0"]', { ms: 700 });
      await S.wait(1800);
      await S.focus(null, { ms: 900 });
      await park(S);
      await S.wait(600);
    },
  },
  {
    // Simple: two cities, your month, a salary there, the answer, then swap them.
    name: 'simple',
    async run(S) {
      S.begin();
      S.mark('Pick two cities');
      await S.focus('#simpleCityCard', { pad: 40, after: 300 });
      await pick(S, 'fromPicker', 'jakarta', 'Jakarta|Indonesia');
      await pick(S, 'toPicker', 'perth', 'Perth|Australia');
      S.mark('Enter your month');
      await S.focus();
      await S.scrollTo('.analysis-card', 16, 800);
      await S.focus('.compare-cols .col-card:first-child', { pad: 20 });
      await S.fill('#ss_fs', '20000000', { delay: 110, after: 500 });
      await S.fill('#ss_fe', '12000000', { delay: 110, after: 700 });
      S.mark('And a salary there');
      await S.focus('.compare-cols .col-card:last-child', { pad: 20 });
      await S.fill('#ss_ts', '6500', { after: 900 });
      S.mark('Read the answer');
      await S.focus('#ss_summary', { pad: 40 });
      await S.moveTo('#ss_summary', { ms: 700 });
      await S.wait(2600);
      S.mark('Swap them');
      await S.focus();
      await S.scrollTo('#simpleCityCard', 16, 700);
      await S.focus('#simpleCityCard', { pad: 40 });
      await S.click('#swapCities', { after: 1400 });
      await S.focus(null, { ms: 800 });
      await S.scrollTo('.analysis-card', 16, 900);
      await park(S);
      await S.wait(1800);
    },
  },
  {
    // I need to earn: the required salary, the target, housing in or out.
    name: 'earn',
    async run(S) {
      await plan(S);
      S.begin();
      S.mark('I need to earn');
      await S.focus('#modeCard', { pad: 20, after: 300 });
      await S.click(seg('goalGroup', 'earn'), { after: 800 });
      await S.focus();
      await S.scrollTo('.analysis-card', 16, 900);
      await S.focus(['.analysis-card .summary-box', '.field-row:has(.req-val)'], { pad: 20 });
      await S.moveTo('.req-val', { ms: 700 });
      await S.wait(2200);
      S.mark('Pick the target');
      await S.focus(['.target-row', '.analysis-card .summary-box'], { pad: 30 });
      await S.click(seg('targetGroup', 'nominal'), { after: 2200 });
      await S.click(seg('targetGroup', 'ratio'), { after: 1400 });
      S.mark('Housing in or out');
      await S.focus();
      await S.scrollTo('#modeCard', 16, 800);
      await S.focus('#housingRow', { pad: 60 });
      await S.click(seg('housingGroup', 'exclude'), { after: 700 });
      await S.focus();
      await S.scrollTo('.analysis-card', 16, 900);
      await S.focus(['.analysis-card .summary-box', '.field-row:has(.req-val)'], { pad: 20 });
      await S.moveTo('.req-val', { ms: 700 });
      await S.wait(2400);
      await S.focus(null, { ms: 800 });
      await park(S);
      await S.wait(600);
    },
  },
  {
    // The exchange rate: the default, your own, a scenario, and what none of them moves.
    name: 'fx',
    async run(S) {
      await plan(S);
      await S.scrollTo('#simpleFxCard', 16, 0);
      S.begin();
      S.mark('The rate it uses');
      await S.focus('#simpleFxCard', { pad: 20, after: 300 });
      await S.moveTo('#simpleFxInput', { ms: 700 });
      await S.wait(1800);
      S.mark('Your own rate');
      await S.fill('#simpleFxInput', '11000', { after: 900 });
      await S.focus(['#ss_summary', '.compare-cols'], { pad: 10 });
      await S.moveTo('#ss_summary', { ms: 700 });
      await S.wait(2200);
      S.mark('What if AUD moves?');
      await S.focus('#fxShockBlock', { pad: 30 });
      await S.slide('#fxShockSlider', 10, { ms: 1400, after: 900 });
      await S.focus(['#ss_summary', '.compare-cols'], { pad: 10 });
      await S.moveTo('#ss_summary', { ms: 700 });
      await S.wait(2200);
      S.mark('What does not move');
      await S.focus('.compare-cols .col-card:last-child', { pad: 20 });
      await S.moveTo('.compare-cols .col-card:last-child .sav-block.neutral', { ms: 700 });
      await S.wait(2600);
      await S.focus(null, { ms: 800 });
      await park(S);
      await S.wait(600);
    },
  },
  {
    // The Detailed table: a city, a row, a typed figure, the answer.
    name: 'detailed',
    async run(S) {
      await quick(S, 'eu');
      await S.scrollTo('#detailSec', 16, 0);
      S.begin();
      S.mark('Add a city');
      await S.focus('#detailSec thead', { pad: 20, after: 300 });
      await S.click('#addCityBtn', { after: 700 });
      await pick(S, 'dtToPicker3', 'dublin', 'Dublin|Ireland');
      S.mark('Add a row');
      await S.focus(['#addRowBtn', '#detailSec tr[data-ri="4"]'], { pad: 20 });
      await S.click('#addRowBtn', { after: 700 });
      await S.focus('#detailSec tr[data-ri="5"]', { pad: 40 });
      await S.choose('.cat-sel[data-ri="5"]', 'Health Insurance', { after: 700 });
      await S.fill('.dt-from-exp[data-ri="5"]', '120', { after: 900 });
      S.mark('Type over an estimate');
      await S.focus('#detailSec tr[data-ri="0"]', { pad: 40 });
      await S.fill(cell(0, 0), '1900', { after: 1400 });
      S.mark('Read the answer');
      await S.focus(['#detailSec .salary-tr', '#detailSec .savings-tr'], { pad: 20 });
      await S.moveTo(req(0), { ms: 700 });
      await S.wait(1500);
      await S.moveTo(req(3), { ms: 800 });
      await S.wait(2000);
      await S.focus(null, { ms: 800 });
      await park(S);
      await S.wait(600);
    },
  },
  {
    // At a custom frequency, and a column moved to the front.
    name: 'detailed-more',
    async run(S) {
      await quick(S, 'eu');
      S.begin();
      S.mark('At a custom frequency');
      await S.focus('#freqRow', { pad: 80, after: 300 });
      await S.click('#customFreqChk', { after: 900 });
      await S.scrollTo('#detailSec', 16, 800);
      await S.focus('#detailSec tr[data-ri="2"]', { pad: 50 });
      await S.choose('.dt-unit[data-ri="2"]', 'per meal', { after: 1600 });
      await S.moveTo('.dt-qty[data-ri="2"]', { ms: 600 });
      await S.wait(1600);
      S.mark('Move a column');
      await S.focus('#detailSec thead', { pad: 30 });
      const from = await S.centre('[data-col-grip="2"]'), to = await S.centre('[data-col-grip="0"]');
      await S.drag(from, { x: to.x - 30, y: to.y }, { ms2: 1400, hold: 400, after: 1400 });
      await S.focus(['#detailSec thead', '#detailSec .salary-tr'], { pad: 20 });
      await S.moveTo(req(0), { ms: 700 });
      await S.wait(2200);
      await S.focus(null, { ms: 800 });
      await park(S);
      await S.wait(600);
    },
  },
  {
    // Same inputs, two screens: the comparator's Simple fields ...
    name: 'same-main', still: true,
    async run(S) {
      await plan(S, { goal: 'earn', fromKey: 'Perth|Australia', toKey: 'Sydney|Australia', fromSalary: 6500, fromExpense: 4550, toSalary: 0 });
      await S.scrollTo('#modeCard', 12, 0);
      return { boxes: {
        city: '.city-block:has(#fromPicker)',
        salary: '.field-row:has(#se_fs)',
        living: '.field-row:has(#se_fe)',
        housing: '#housingRow',
        detail: '.toggle-row:has(#modeGroup)',
        goal: '#goalRow',
        target: '.target-row',
      } };
    },
  },
  {
    // ... and the same seven on the Map View.
    name: 'same-map', still: true, ...MAP,
    async run(S) {
      await mapQuick(S);
      await S.click(seg('detailGroup', 'simple'), { after: 300 });
      await S.scrollTo('.layout > .controls', 12, 0);
      return { boxes: {
        city: '.field-row:has(#fromPicker)',
        salary: '.field-row:has(#salary)',
        living: '.field-row:has(#expense)',
        housing: '.toggle-row:has(#housingGroup)',
        detail: '.toggle-row:has(#detailGroup)',
        goal: '.toggle-row:has(#modeGroup)',
        target: '#targetRow',
      } };
    },
  },
  {
    // The Map View on a first visit: the inputs folded; open them, load Perth, read the map.
    name: 'map-quickstart', ...MAP, storage: store(),
    async run(S) {
      S.begin();
      await S.focus('.ctrl-fold-rail', { pad: 140, after: 400 });
      S.mark('Open the inputs');
      await S.click('.ctrl-fold-rail', { after: 900 });
      S.mark('Pick an example');
      await S.focus('.quick-start-row', { pad: 60 });
      await S.moveTo('.quick-start-btn[data-preset="jkt"]', { ms: 700 });
      await S.wait(1400);
      await S.moveTo('.quick-start-btn[data-preset="per"]', { ms: 600 });
      await S.wait(1200);
      await S.click('.quick-start-btn[data-preset="per"]', { after: 300 });
      await settle(S);
      S.mark('Read the map');
      await S.focus('#mapCard', { pad: 10 });
      await S.moveTo('#legend', { ms: 700 });
      await S.wait(1600);
      const p = dot(S, 'Sydney|Australia');
      await S.glide(p.x, p.y, 900);
      await S.wait(2600);
      S.mark('The four figures');
      await park(S);
      await S.focus();
      await S.scrollTo('#metrics', 120, 900);
      await S.focus('#metrics', { pad: 20 });
      await S.moveTo('#mVal1', { ms: 700 });
      await S.wait(1400);
      await S.moveTo('#mVal3', { ms: 700 });
      await S.wait(1800);
      await S.focus(null, { ms: 800 });
      await park(S);
      await S.wait(600);
    },
  },
  {
    // Compare by: the three salary modes, a yardstick, the views.
    name: 'map-modes', ...MAP,
    async run(S) {
      await mapQuick(S);
      S.begin();
      S.mark('Required');
      await S.focus('#compareGroup', { pad: 30, after: 300 });
      await S.moveTo(seg('modeGroup', 'required'), { ms: 600 });
      await S.wait(900);
      await S.moveTo('#targetGroup', { ms: 600 });
      await S.wait(1200);
      await S.focus(null, { ms: 700 });
      await S.wait(1200);
      S.mark('Global');
      await S.focus('#compareGroup', { pad: 30 });
      await S.click(seg('modeGroup', 'global'), { after: 500 });
      await S.focus(['#mapCard', '#metrics'], { pad: 10 });
      await S.wait(2600);
      S.mark('Scaled');
      await S.focus('#compareGroup', { pad: 30 });
      await S.click(seg('modeGroup', 'scaled'), { after: 900 });
      await S.click(seg('scaleGroup', 'median'), { after: 600 });
      await S.focus(['#mapCard', '#metrics'], { pad: 10 });
      await S.wait(2600);
      S.mark('Change the view');
      await S.focus('.chart-head', { pad: 40 });
      await S.click(seg('viewGroup', 'ratio'), { after: 1600 });
      await S.click(seg('viewGroup', 'salary'), { after: 1200 });
      await S.focus(null, { ms: 800 });
      await park(S);
      await S.wait(800);
    },
  },
  {
    // Lifestyle: one figure with housing in or out, or a row per category.
    name: 'map-lifestyle', ...MAP,
    async run(S) {
      await mapQuick(S);
      await S.reveal('#lifestyleGroup', 0.15, 0);
      S.begin();
      S.mark('Detailed: a row each');
      await S.focus('#lifestyleGroup', { pad: 20, after: 300 });
      await S.moveTo('#rows .exp-row:first-child .row-amt', { ms: 700 });
      await S.wait(900);
      await S.fill('#rows .exp-row:first-child .row-amt', '2000', { after: 900 });
      await S.moveTo('#rowsTotal', { ms: 600 });
      await S.wait(1400);
      S.mark('Simple: one figure');
      await S.click(seg('detailGroup', 'simple'), { after: 900 });
      await S.moveTo('#expense', { ms: 600 });
      await S.wait(1200);
      S.mark('Housing in or out');
      await S.click(seg('housingGroup', 'exclude'), { after: 700 });
      await S.focus(['#mapCard', '#metrics'], { pad: 10 });
      await S.wait(2600);
      await S.focus(null, { ms: 800 });
      await park(S);
      await S.wait(600);
    },
  },
  {
    // Reading the map: a city's card, zoom and move, major cities, full screen, every city.
    name: 'map-read', ...MAP,
    async run(S) {
      await mapQuick(S);
      S.begin();
      S.mark('Point at a city');
      await S.focus('#mapCard', { pad: 10, after: 300 });
      const p = dot(S, 'Singapore|Singapore');
      await S.glide(p.x, p.y, 900);
      await S.wait(2600);
      S.mark('Zoom and move');
      await S.focus('.map-zoom', { pad: 120 });
      await S.click('#zoomWorld', { after: 400 });
      await settle(S);
      await S.focus('#mapCard', { pad: 10 });
      await S.wait(1200);
      await S.click('#zoomHome', { after: 400 });
      await settle(S);
      await S.wait(800);
      S.mark('Major cities only');
      await S.click('#majorOnly', { after: 1800 });
      await S.click('#majorOnly', { after: 800 });
      S.mark('Full screen');
      await S.click('#mapFull', { after: 2200 });
      await S.click('#mapFull', { after: 900 });
      S.mark('Every city');
      await S.focus();
      await S.scrollTo('#tableCard', 90, 900);
      await S.click('#tableCard .fold-btn', { after: 900 });
      await S.focus('#tableCard', { pad: 10 });
      await S.click('#tableFind', { after: 200 });
      await type(S, '#tableFind', 'australia', 140);
      await S.wait(1600);
      await S.moveTo('#csvBtn', { ms: 700 });
      await S.wait(1400);
      await S.focus(null, { ms: 800 });
      await park(S);
      await S.wait(600);
    },
  },
  {
    // Save, open, and what the answer rests on.
    name: 'save',
    async run(S) {
      await quick(S, 'sg-au');
      S.begin();
      S.mark('Save or open a file');
      await S.focus('.quick-start-row', { pad: 40, after: 300 });
      await S.moveTo('.scenario-save', { ms: 800 });
      await S.wait(1500);
      await S.moveTo('.scenario-load', { ms: 500 });
      await S.wait(1300);
      S.mark('What this assumes');
      await S.focus();
      await S.scrollTo('.assumes-card', 160, 900);
      await S.click('.assumes-card .fold-btn', { after: 900 });
      await S.focus('.assumes-card', { pad: 20 });
      await S.moveTo('#assumptions', { ms: 800 });
      await S.wait(2800);
      await S.focus(null, { ms: 800 });
      await park(S);
      await S.wait(600);
    },
  },
  {
    // Part 2: the input the answer rests on most, up and down. Then more spending at home.
    name: 'live',
    async run(S) {
      await quick(S, 'sg-au');
      await S.scrollTo('#detailSec', 16, 0);
      S.begin();
      S.mark('The base case');
      await S.focus(['#detailSec .salary-tr', '#detailSec tr[data-ri="0"]'], { pad: 20, after: 300 });
      await S.moveTo(req(0), { ms: 700 });
      await S.wait(2000);
      S.mark('Salary up 10%');
      await S.fill('#dt_fs', '8800', { after: 900 });
      await S.moveTo(req(0), { ms: 700 });
      await S.wait(2200);
      S.mark('Salary down 10%');
      await S.fill('#dt_fs', '7200', { after: 900 });
      await S.moveTo(req(0), { ms: 700 });
      await S.wait(2200);
      S.mark('Rent up 10%, salary back');
      await S.fill('#dt_fs', '8000', { after: 600 });
      await S.fill('.dt-from-exp[data-ri="0"]', '3850', { after: 900 });
      await S.focus(['#detailSec .salary-tr', '#detailSec .savings-tr'], { pad: 20 });
      await S.moveTo(req(0), { ms: 700 });
      await S.wait(2600);
      await S.focus(null, { ms: 800 });
      await park(S);
      await S.wait(600);
    },
  },
];
