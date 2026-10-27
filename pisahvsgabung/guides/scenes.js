// The PPh 21 Pisah vs Gabung guide's live demos: guide-live.js opens the tool in a frame of this
// page and plays each scene in it. Before S.begin() a scene sets itself up, unseen; S.mark('...')
// names the moments the guide's steps refer to, in order (the guide's list under the demo has one
// item per mark); S.focus(part) zooms in on what a step is about, S.focus() shows the whole tool.
// Nothing here is fetched or solved ahead: the tool works its answer out as a field changes.
// Check them all with  node _ref/guide-check.mjs pisahvsgabung
export const TOOL = {
  path: '../',
  seen: ['pvg-tour-v3-seen'],
  storage: { 'abt:ctrl:/pisahvsgabung/': '1' },   // the Inputs card left open
  // script.js exposes window.__PVG at the end of its start-up, after its first answer.
  ready: (win) => win.__PVG && win.document.getElementById('kpiSaving').textContent !== '—',
};

const tab = (name) => `.ctrl-tab[data-tab="${name}"]`;
const deps = (n) => `#dependents + .seg-group .seg-btn[data-val="${n}"]`;
const sliderOf = (id) => (S) => { const e = S.doc.getElementById(id); return e && e.closest('.slider-block'); };
const rowOf = (id) => (S) => { const e = S.doc.getElementById(id); return e && e.closest('.field-row'); };
const saving = '.metrics .metric:first-child';               // the Tax savings card
const park = (S, x = 1262, y = 790) => S.glide(x, y, 500);   // in the page's right margin, out of a tooltip's way
// A Quick Start, loaded before the scene begins (the Inputs card must be open).
const preset = async (S, key) => {
  await S.click(`.quick-start-btn[data-preset="${key}"]`, { after: 0 });
  await S.until((w) => w.document.querySelector(`.quick-start-btn.active[data-preset="${key}"]`), 8000, 'the Quick Start');
  await park(S);
  await S.wait(300);
};

export const SCENES = [
  {
    // The screen: the page as it opens (Equal incomes, no children), down to What this assumes.
    name: 'layout', still: true,
    async run() {
      return { boxes: {
        inputs: '.layout > .controls',
        answer: ['#verdict', '.metrics'],
        charts: ['.chart-card', '.chart-card:has(#chartCanvas2)'],
        working: ['.summary-card', '#detailSection', '.assumes-card'],
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
      await S.moveTo('.quick-start-btn[data-preset="single"]', { ms: 700 });
      await S.wait(2200);
      await S.moveTo('.quick-start-btn[data-preset="double"]', { ms: 600 });
      await S.wait(2000);
      await S.click('.quick-start-btn[data-preset="double"]', { after: 300 });
      await S.focus(null, { ms: 900 });
      await park(S);
      await S.wait(2600);
    },
  },
  {
    // Household: dependants, the wife's share, deductions, then the Each spouse view.
    name: 'household',
    async run(S) {
      await preset(S, 'even');
      S.begin();
      await S.focus(['#dependents + .seg-group', saving], { pad: 40, after: 300 });
      S.mark('Dependants');
      await S.click(deps(2), { after: 1800 });
      S.mark("The wife's share");
      await S.reveal('#splitPct', 0.45);
      await S.focus([sliderOf('splitPct'), '#totalSalaryInput', saving], { pad: 30 });
      await S.moveTo('#totalSalaryInput', { ms: 600 });
      await S.wait(900);
      await S.slide('#splitPct', 30, { ms: 1600, after: 1800 });
      S.mark('Deductions');
      await S.reveal('#deductionInput', 0.4);
      await S.focus([rowOf('deductionInput'), saving], { pad: 30 });
      await S.fill('#deductionInput', '12000000', { delay: 120, after: 900 });
      await S.reveal('#capWarning', 0.7);
      await S.focus(['#capWarning', '#deductionInput'], { pad: 50 });
      await S.moveTo('#capWarning', { ms: 700 });
      await S.wait(2200);
      S.mark('Each spouse');
      await S.reveal('.input-mode-toggle', 0.15);
      await S.focus('#tab-inputs .field-group:nth-of-type(2)', { pad: 20 });
      await S.click('#modeBtnSplit', { after: 1200 });
      await S.moveTo('#wifeSalaryInput', { ms: 700 });
      await S.wait(1200);
      await S.reveal('#wifeDeductionInput', 0.7);
      await S.moveTo('#husbandDeductionInput', { ms: 700 });
      await S.wait(2000);
    },
  },
  {
    // PTKP & Brackets: the allowances, the brackets, and how each way is taxed.
    name: 'ptkp',
    async run(S) {
      await preset(S, 'double');
      S.begin();
      await S.focus('.ctrl-tabs', { pad: 120, after: 300 });
      S.mark('Tax-free allowance (PTKP)');
      await S.click(tab('advanced'), { after: 600 });
      await S.reveal('#ptkpBase', 0.2);
      await S.focus('#tab-advanced .bracket-group', { pad: 30 });
      for (const id of ['ptkpBase', 'ptkpMarried', 'ptkpSpouse', 'ptkpDependent']) {
        await S.moveTo('#' + id, { ms: 500 });
        await S.wait(700);
      }
      await S.moveTo('#ptkpGDisplay', { ms: 600 });
      await S.wait(1800);
      S.mark('Tax brackets');
      await S.reveal('#bracketsContainer', 0.5);
      await S.focus('#bracketsContainer', { pad: 60 });
      await S.moveTo('#bracketsContainer .bracket-row:nth-child(2) input:nth-child(2)', { ms: 600 });
      await S.wait(900);
      await S.moveTo('#bracketsContainer .bracket-row:nth-child(4) input:nth-child(3)', { ms: 700 });
      await S.wait(900);
      await S.moveTo('#bracketsContainer .bracket-row:last-child input:nth-child(2)', { ms: 600 });
      await S.wait(1400);
      S.mark('The two ways');
      await S.reveal('#infoBoxContent', 0.5);
      await S.focus('#infoBoxContent', { pad: 30 });
      const ib = await S.box('#infoBoxContent');   // in its margin, clear of the codes' tooltips
      await S.moveTo('#infoBoxContent', { at: { x: ib.x + 6, y: ib.y + ib.height * 0.45 }, ms: 700 });
      await S.wait(3200);
    },
  },
  {
    // The answer: the sentence, the three figures, both charts, the summary and the table.
    name: 'results',
    async run(S) {
      await preset(S, 'double');
      S.begin();
      S.mark('The answer');
      await S.focus('#verdict', { pad: 30 });
      await S.moveTo('#verdict', { ms: 700 });
      await S.wait(2400);
      S.mark('Three figures');
      await S.focus('.metrics', { pad: 20 });
      await S.moveTo('#kpiSaving', { ms: 700 });
      await S.wait(1200);
      await S.moveTo('#kpiGabung', { ms: 800 });
      await S.wait(1400);
      S.mark('Total tax across salaries');
      await S.focus();
      await S.scrollTo('.chart-card', 12, 900);
      await S.focus('.chart-card', { pad: 8 });
      let c = await S.box('#chartCanvas');
      await S.moveTo('#chartCanvas', { at: { x: c.x + c.width * 0.3, y: c.y + c.height * 0.7 }, ms: 800 });
      await S.wait(1000);
      await S.glide(c.x + c.width * 0.8, c.y + c.height * 0.7, 1600);
      await S.wait(1200);
      S.mark('The difference and the crossover');
      await S.focus();
      await S.scrollTo('.chart-card:has(#chartCanvas2)', 12, 900);
      await S.focus('.chart-card:has(#chartCanvas2)', { pad: 8 });
      c = await S.box('#chartCanvas2');
      await S.moveTo('#chartCanvas2', { at: { x: c.x + c.width * 0.04, y: c.y + c.height * 0.6 }, ms: 800 });
      await S.wait(1200);
      await S.glide(c.x + c.width * 0.45, c.y + c.height * 0.6, 1600);
      await S.wait(1000);
      await S.moveTo('#crossoverInfo', { ms: 700 });
      await S.wait(2000);
      S.mark('Summary');
      await S.focus();
      await S.scrollTo('.summary-card', 90, 900);
      await S.focus('.summary-card', { pad: 16 });
      await S.moveTo('#summaryGrid .tile:last-child', { ms: 800 });
      await S.wait(2000);
      S.mark('The table');
      await S.focus();
      await S.click('#detailSection .fold-btn', { after: 700 });
      await S.scrollTo('#detailSection', 12, 900);
      await S.focus('#detailSection', { pad: 10 });
      await S.click('#tableTabs .tab-btn[data-scenario="pisah"]', { after: 1800 });
      await S.click('#tableTabs .tab-btn[data-scenario="gabung"]', { after: 2200 });
    },
  },
  {
    // Save, open, share and export.
    name: 'share',
    async run(S) {
      await preset(S, 'double');
      S.begin();
      S.mark('Save or open a file');
      await S.focus(['.scenario-save', '.scenario-load'], { pad: 120 });
      await S.moveTo('.scenario-save', { ms: 800 });
      await S.wait(1400);
      await S.moveTo('.scenario-load', { ms: 500 });
      await S.wait(1200);
      S.mark('Share a chart');
      await S.focus();
      await S.scrollTo('.chart-card', 12, 900);
      await S.focus('.chart-card .share-toggle', { pad: 60 });
      await S.click('.chart-card .share-toggle', { after: 300 });
      await S.focus(['.chart-card .share-toggle', '[role=menu]'], { pad: 30 });
      for (const t of ['Download as PNG', 'Share as link', 'Embed as HTML']) {
        await S.moveTo({ text: t, in: '[role=menu]' }, { ms: 500 });
        await S.wait(900);
      }
      await S.key('Escape');
      S.mark('Export the table');
      await S.focus();
      await S.scrollTo('#detailSection', 200, 900);
      await S.focus('#downloadBtn', { pad: 110 });
      await S.moveTo('#downloadBtn', { ms: 700 });
      await S.wait(1800);
    },
  },
  {
    // How the numbers work: the input the saving rests on most (who earns the money), moved
    // one way and the other while the household total stays at Rp 700M.
    name: 'sensitivity',
    async run(S) {
      await preset(S, 'double');
      await S.reveal('#husbandSalaryInput', 0.3, 0);
      await park(S);
      S.begin();
      const view = ['#husbandSalaryInput', '#wifeSalaryInput', saving];
      await S.focus(view, { pad: 30, after: 400 });
      S.mark('Rp 70M more to the wife');
      await S.fill('#husbandSalaryInput', '330000000', { delay: 90, after: 300 });
      await S.fill('#wifeSalaryInput', '370000000', { delay: 90, after: 600 });
      await S.moveTo('#kpiSaving', { ms: 700 });
      await S.wait(1600);
      await S.focus();
      await park(S, 1262, 640);
      await S.wait(2200);
      S.mark('Rp 70M more to the husband');
      await S.focus(view, { pad: 30 });
      await S.fill('#husbandSalaryInput', '470000000', { delay: 90, after: 300 });
      await S.fill('#wifeSalaryInput', '230000000', { delay: 90, after: 600 });
      await S.moveTo('#kpiSaving', { ms: 700 });
      await S.wait(1600);
      await S.focus();
      await park(S, 1262, 640);
      await S.wait(2400);
      S.mark('Back to the example');
      await S.focus(['.quick-start-row', '.metrics'], { pad: 30 });
      await S.click('.quick-start-btn[data-preset="double"]', { after: 1400 });
      await S.focus();
      await park(S);
      await S.wait(1800);
    },
  },
];
