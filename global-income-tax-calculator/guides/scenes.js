// The Global Income Tax Calculator guide's live demos: guide-live.js opens the tool in a frame of
// this page and plays each scene in it. Before S.begin() a scene sets itself up, unseen;
// S.mark('...') names the moments the guide's steps refer to, in order (the guide's list under the
// demo has one item per mark); S.focus(part) zooms in on what a step is about, S.focus() shows the
// whole tool. Check them all with
//   node _ref/guide-check.mjs global-income-tax-calculator
//
// Nothing here fetches from the web: in a demo (?demo) the tool keeps the exchange rates bundled
// with it (engine.js, 10 Nov 2026), so the figures the guide quotes are the ones every reader sees.
export const TOOL = {
  path: '../',
  seen: ['gitc-tour-v1-seen'],
  // The Inputs card open, as on a first visit at this width.
  storage: { 'abt:ctrl:/global-income-tax-calculator/': '1' },
  ready: (win) => win.__GSC && win.__GSC_TOUR && win.document.querySelector('#country + .combo-input'),
};

// A Quick Start loaded behind the veil.
const quick = async (S, key) => {
  S.win.__GSC.applyQuickStart(key);
  await S.wait(250);
};
// A country picked as a reader picks one: click the search, type, click it in the list.
const pick = async (S, field, text, name) => {
  await S.click(`#${field} + .combo-input`, { after: 300 });
  await S.fill(`#${field} + .combo-input`, text, { click: false, end: null, after: 600 });
  await S.click({ text: name, in: '.combo-list' }, { after: 800 });
};
const seg = (field, val) => `#${field} + .seg-group .seg-btn[data-val="${val}"]`;

export const SCENES = [
  {
    // The screen: the Asia hubs Quick Start, each job in its own currency.
    name: 'layout', still: true,
    async run(S) {
      S.win.__GSC_TOUR.seed();
      await S.wait(300);
      return { boxes: {
        start: ['.quick-start-row', '.jobs-bar'],
        form: ['.ctrl-tabs', '#jobScope'],
        answer: ['#verdict', '.view-bar', '#metrics'],
        chart: '.chart-card',
        details: ['#compareSection', '#linesSection'],
      } };
    },
  },
  {
    // Pick an example and read the answer.
    name: 'quickstart',
    async run(S) {
      S.begin();
      S.mark('Pick an example');
      await S.focus('.quick-start-row', { pad: 50, after: 300 });
      await S.moveTo('.quick-start-btn[data-preset="asia"]', { ms: 700 });
      await S.wait(1200);
      await S.moveTo('.quick-start-btn[data-preset="europe"]', { ms: 600 });
      await S.wait(1400);
      await S.click('.quick-start-btn[data-preset="europe"]', { after: 700 });
      S.mark('Four jobs, one each');
      await S.focus('.jobs-bar', { pad: 30 });
      await S.moveTo('.job-row:nth-child(4) .job-chip', { ms: 800 });
      await S.wait(1600);
      S.mark('Read the answer');
      await S.focus(['#verdict', '#metrics'], { pad: 24 });
      await S.moveTo('#verdict', { ms: 700 });
      await S.wait(2400);
      await S.focus();
    },
  },
  {
    // One job: search a country, type the pay, read the take-home.
    name: 'country',
    async run(S) {
      S.begin();
      S.mark('Search a country');
      await S.focus(['#country + .combo-input'], { pad: 120, after: 200 });
      await pick(S, 'country', 'king', 'United Kingdom');
      S.mark('Type the pay');
      await S.focus(['#amount', '#period'], { pad: 90 });
      await S.fill('#amount', '85000', { after: 900 });
      S.mark('Read the take-home');
      await S.focus(['#verdict', '#metrics'], { pad: 24 });
      await S.moveTo('#metrics .metric:first-child', { ms: 700 });
      await S.wait(2400);
      await S.focus();
    },
  },
  {
    // Take-home to gross: the gross pay a take-home needs.
    name: 'net',
    async run(S) {
      await quick(S, 'net');
      S.win.__GSC.pickJob(1);
      await S.wait(200);
      S.begin();
      S.mark('Choose take-home pay');
      await S.focus(['#dir + .seg-group', '#amount'], { pad: 90, after: 300 });
      await S.moveTo(seg('dir', 'net'), { ms: 700 });
      await S.wait(1400);
      S.mark('Type what you want left');
      await S.fill('#amount', '4500', { after: 900 });
      S.mark('Read the gross pay it needs');
      await S.focus(['#verdict', '#metrics'], { pad: 24 });
      await S.moveTo('#metrics .metric:nth-child(2)', { ms: 700 });
      await S.wait(2600);
      await S.focus();
    },
  },
  {
    // Jobs in different currencies: one axis per currency, then one currency for all.
    name: 'currency',
    async run(S) {
      await quick(S, 'asia');
      S.doc.getElementById('dispCur').value = 'local';
      S.doc.getElementById('dispCur').dispatchEvent(new S.win.Event('change'));
      await S.wait(300);
      await S.scrollTo('.view-bar', 16, 0);
      S.begin();
      S.mark('One axis per currency');
      await S.focus('.chart-card', { pad: 20, after: 300 });
      await S.moveTo('#chartCanvas', { ms: 800 });
      await S.wait(800);
      const c = await S.box('#chartCanvas');
      await S.glide(c.x + c.width * 0.42, c.y + c.height * 0.55, 1400);
      await S.wait(2200);
      S.mark('Or one currency for all');
      await S.focus('.view-bar', { pad: 60 });
      await S.choose('#dispCur', 'US dollar (USD)', { after: 900 });
      await S.focus(['.chart-card'], { pad: 20 });
      await S.wait(2200);
      await S.focus();
    },
  },
  {
    // The take-home pay breakdowns, each line with its source.
    name: 'lines',
    async run(S) {
      await quick(S, 'europe');
      S.begin();
      S.mark('Open the breakdowns');
      await S.scrollTo('#linesSection', 16, 600);
      await S.focus('#linesSection .detail-head', { pad: 40 });
      await S.click('#linesSection .detail-head h2', { after: 900 });
      S.mark('Every line, its source and its date');
      await S.focus('#linesWrap .job-block:first-child', { pad: 20 });
      await S.moveTo('#linesWrap .job-block:first-child td.src a', { ms: 800 });
      await S.wait(2600);
      await S.focus();
    },
  },
];
