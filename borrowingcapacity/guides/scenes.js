// The Borrowing Capacity guide's live demos: guide-live.js opens the tool in a frame of this page
// and plays each scene in it. Before S.begin() a scene sets itself up, unseen; S.mark('...') names
// the moments the guide's steps refer to, in order (the guide's list under the demo has one item
// per mark); S.focus(part) zooms in on what a step is about, S.focus() shows the whole tool.
// Nothing here is fetched or solved ahead: the tool works its answer out as a field changes.
// Check them all with  node _ref/guide-check.mjs borrowingcapacity
export const TOOL = {
  path: '../',
  seen: ['bc-tour-v3-seen'],
  storage: { 'abt:ctrl:/borrowingcapacity/': '1' },   // the Inputs card left open
  // script.js exposes window.__BC once it has drawn its first answer.
  ready: (win) => win.__BC && win.document.getElementById('kpiLoan').textContent !== '—',
};

const tab = (name) => `.ctrl-tab[data-tab="${name}"]`;
const seg = (group, val) => `#${group} .seg-btn[data-val="${val}"]`;
const deps = (n) => `#deps + .seg-group .seg-btn[data-val="${n}"]`;
// A checkbox or a switch is clicked on the row a reader would click.
const row = (id) => (S) => { const e = S.doc.getElementById(id); return e && e.closest('.chk-row, .toggle-switch'); };
const sliderOf = (id) => (S) => { const e = S.doc.getElementById(id); return e && e.closest('.slider-block'); };
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
    // The screen: the Couple, Melbourne Quick Start, down to What this assumes.
    name: 'layout', still: true,
    async run(S) {
      await preset(S, 'couple');
      return { boxes: {
        inputs: '.layout > .controls',
        answer: ['#verdict', '.metrics'],
        chart: '.chart-card',
        working: ['main > .detail-section', '.assumes-card'],
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
      await S.moveTo('.quick-start-btn[data-preset="first-home"]', { ms: 700 });
      await S.wait(2200);
      await S.click('.quick-start-btn[data-preset="couple"]', { after: 300 });
      await S.focus(null, { ms: 900 });
      await park(S);
      await S.wait(2600);
    },
  },
  {
    // Income: Finance Bro's streams, the bonus shaded down, then the other sources.
    name: 'income',
    async run(S) {
      await preset(S, 'finance-bro');
      S.begin();
      await S.focus(['#incModeGroup', '#tab-income .field-group[data-who="employee"]'], { pad: 30, after: 300 });
      S.mark('Simple or Detailed');
      await S.moveTo(seg('incModeGroup', 'simple'), { ms: 700 });
      await S.wait(900);
      await S.moveTo('#incPayg', { ms: 600 });
      await S.wait(700);
      await S.moveTo('#incBonus', { ms: 500 });
      await S.wait(900);
      S.mark('Shade each stream');
      await S.reveal('#shdBonus', 0.4);
      await S.focus(['#incBonus', '#shdBonus'], { pad: 90 });
      await S.fill('#shdBonus', '50', { delay: 220, after: 700 });
      await S.focus();
      await park(S, 900, 420);
      await S.wait(1800);
      S.mark('Anything else you receive');
      await S.reveal('#tab-income .chk-block', 0.2);
      await S.focus('#tab-income .chk-block', { pad: 60 });
      await S.click(row('hasInvest'), { after: 800 });
      await S.reveal('#tab-income .field-group[data-when="hasInvest"]', 0.05);
      await S.focus('#tab-income .field-group[data-when="hasInvest"]', { pad: 20 });
      await S.moveTo('#incRent', { ms: 700 });
      await S.wait(2000);
    },
  },
  {
    // Household: two taxpayers and the split, living costs against HEM, tax and the study loan.
    name: 'household',
    async run(S) {
      await preset(S, 'couple');
      S.begin();
      await S.focus('.ctrl-tabs', { pad: 120, after: 300 });
      S.mark('Who is applying');
      await S.click(tab('house'), { after: 500 });
      await S.reveal('#incSplitRow', 0.4);
      await S.focus(['#adults + .seg-group', '#incSplitRow', '#kpiLoan'], { pad: 30 });
      await S.slide('#incSplit', 0, { ms: 1400, after: 1600 });
      await S.slide('#incSplit', 50, { ms: 1200, after: 1000 });
      S.mark('Living costs and HEM');
      await S.reveal('#hemNote', 0.6);
      await S.focus(['#deps + .seg-group', '#declaredExp', '#hemNote'], { pad: 50 });
      await S.moveTo('#hemNote', { ms: 700 });
      await S.wait(1200);
      await S.fill('#declaredExp', '6000', { after: 900 });
      await S.moveTo('#hemNote', { ms: 600 });
      await S.wait(1200);
      await S.focus();
      await park(S, 900, 420);
      await S.wait(1400);
      S.mark('Tax and study loan');
      await S.reveal('#helpMode', 0.5);
      await S.focus(['#taxYear', '#helpMode'], { pad: 70 });
      await S.moveTo('#taxYear', { ms: 600 });
      await S.wait(700);
      await S.moveTo('#helpMode', { ms: 600 });
      await S.wait(2000);
    },
  },
  {
    // Debts: tick what you have, the card counted at its limit, the detailed rows, after settlement.
    name: 'debts',
    async run(S) {
      await preset(S, 'geoff');
      S.begin();
      await S.focus('.ctrl-tabs', { pad: 120, after: 300 });
      S.mark('Tick what you have');
      await S.click(tab('debts'), { after: 500 });
      await S.reveal('#tab-debts .chk-block', 0.1);
      await S.focus('#tab-debts .chk-block', { pad: 50 });
      await S.click(row('hasPersonal'), { after: 700 });
      await S.reveal('#persRepay', 0.3);
      await S.focus(['#persRepay', '#persBal'], { pad: 60 });
      await S.fill('#persRepay', '600', { after: 500 });
      await S.fill('#persBal', '25000', { after: 900 });
      S.mark('A card counts at its limit');
      await S.reveal('#cardLimit', 0.3);
      await S.focus(['#cardLimit', '#cardSimpleNote'], { pad: 70 });
      await S.moveTo('#cardSimpleNote', { ms: 600 });
      await S.wait(900);
      await S.fill('#cardLimit', '0', { after: 900 });
      await S.focus();
      await park(S, 900, 420);
      await S.wait(1600);
      S.mark('Detailed');
      await S.reveal('#debtsModeGroup', 0.1);
      await S.focus('#debtsModeGroup', { pad: 120 });
      await S.click(seg('debtsModeGroup', 'detailed'), { after: 700 });
      await S.reveal('#cardPct', 0.4);
      await S.focus(sliderOf('cardPct'), { pad: 60 });
      await S.moveTo('#cardPct', { ms: 700 });
      await S.wait(1400);
      S.mark('After settlement');
      await S.reveal('#occupancy', 0.3);
      await S.focus(['#occupancy', '#newPropCosts'], { pad: 60 });
      await S.moveTo('#occupancy', { ms: 600 });
      await S.wait(900);
      await S.moveTo('#newPropCosts', { ms: 600 });
      await S.wait(1600);
    },
  },
  {
    // Loan: the rate and the term, interest only, then the lender's policy settings.
    name: 'loan',
    async run(S) {
      await preset(S, 'couple');
      S.begin();
      await S.focus('.ctrl-tabs', { pad: 120, after: 300 });
      S.mark('Rate and term');
      await S.click(tab('loan'), { after: 500 });
      await S.reveal('#loanSimpleNote', 0.6);
      await S.focus(['#prodRate', '#termYears', '#loanSimpleNote'], { pad: 50 });
      await S.fill('#prodRate', '6.40', { delay: 200, after: 900 });
      await S.moveTo('#loanSimpleNote', { ms: 700 });
      await S.wait(1400);
      S.mark('Interest only to start');
      await S.reveal(row('hasIo'), 0.5);
      await S.focus([row('hasIo'), '#termYears'], { pad: 80 });
      await S.click(row('hasIo'), { after: 900 });
      await S.focus();
      await park(S, 900, 420);
      await S.wait(1600);
      S.mark('Lender policy');
      await S.reveal('#loanModeGroup', 0.1);
      await S.focus('#loanModeGroup', { pad: 120 });
      await S.click(seg('loanModeGroup', 'detailed'), { after: 700 });
      await S.reveal(sliderOf('buffer'), 0.15);
      await S.focus('#tab-loan .field-group[data-adv="loan"]', { pad: 20 });
      await S.slide('#buffer', 2, { ms: 1200, after: 900 });
      await S.slide('#buffer', 3, { ms: 900, after: 700 });
      await S.reveal('#nsrMin', 0.7);
      await S.moveTo('#umiReq', { ms: 600 });
      await S.wait(800);
      await S.moveTo('#nsrMin', { ms: 600 });
      await S.wait(1600);
    },
  },
  {
    // Purchase: the first home buyer, whose deposit binds once Lenders Mortgage Insurance is off.
    name: 'purchase',
    async run(S) {
      await preset(S, 'first-home');
      S.begin();
      await S.focus('.ctrl-tabs', { pad: 120, after: 300 });
      S.mark('Price, deposit and costs');
      await S.click(tab('caps'), { after: 500 });
      await S.reveal('#price', 0.1);
      await S.focus(['#price', '#depositNote', '#otherCosts'], { pad: 40 });
      await S.moveTo('#savings', { ms: 600 });
      await S.wait(700);
      await S.moveTo('#depositNote', { ms: 700 });
      await S.wait(1800);
      S.mark('Lenders Mortgage Insurance');
      await S.reveal(row('lmiCap'), 0.3);
      await S.focus([row('lmiCap'), '#lvrSimpleNote'], { pad: 70 });
      await S.click(row('lmiCap'), { after: 900 });
      await S.focus(['#verdict', '.metrics']);
      await park(S, 1150, 640);
      await S.wait(2800);
      S.mark('Detailed: LVR and DTI');
      await S.reveal('#capsModeGroup', 0.1);
      await S.focus('#capsModeGroup', { pad: 120 });
      await S.click(seg('capsModeGroup', 'detailed'), { after: 700 });
      await S.reveal(sliderOf('lvrMax'), 0.2);
      await S.focus([sliderOf('lvrMax'), '#dtiBasis'], { pad: 40 });
      await S.moveTo('#lvrMax', { ms: 600 });
      await S.wait(900);
      await S.reveal('#dtiBasis', 0.7);
      await S.moveTo('#dtiCap', { ms: 600 });
      await S.wait(900);
      await S.moveTo('#dtiBasis', { ms: 600 });
      await S.wait(1600);
    },
  },
  {
    // The answer: the sentence, the six figures, the chart, the caps and the working.
    name: 'results',
    async run(S) {
      await preset(S, 'couple');
      S.begin();
      S.mark('The answer');
      await S.focus('#verdict', { pad: 30 });
      await S.moveTo('#verdict', { ms: 700 });
      await S.wait(2000);
      S.mark('Six figures');
      await S.focus('.metrics', { pad: 20 });
      await S.moveTo('#kpiBind', { ms: 800 });
      await S.wait(1400);
      await S.moveTo('#kpiUmi', { ms: 700 });
      await S.wait(1200);
      S.mark('Every cap across incomes');
      await S.focus();
      await S.scrollTo('.chart-card', 12, 900);
      await S.focus('.chart-card', { pad: 8 });
      const c = await S.box('#chartCanvas');
      await S.moveTo('#chartCanvas', { at: { x: c.x + c.width * 0.53, y: c.y + c.height * 0.6 }, ms: 800 });
      await S.wait(1200);
      await S.glide(c.x + c.width * 0.85, c.y + c.height * 0.6, 1600);
      await S.wait(800);
      await S.glide(c.x + c.width * 0.2, c.y + c.height * 0.6, 1600);
      await S.wait(800);
      S.mark('The four caps');
      await S.focus();
      await S.scrollTo('#capsTableWrap', 90, 900);
      await S.focus('main > .detail-section', { pad: 10 });
      await S.moveTo('#capsTableWrap', { ms: 700 });
      await S.wait(1800);
      S.mark('The working');
      await S.focus();
      await S.click('#buildSection .fold-btn', { after: 700 });
      await S.scrollTo('#buildSection', 12, 900);
      await S.focus('#buildSection', { pad: 10 });
      await S.moveTo('#buildTableWrap', { ms: 700 });
      await S.wait(2600);
    },
  },
  {
    // Save, open, share and export.
    name: 'share',
    async run(S) {
      await preset(S, 'couple');
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
      await S.focus('.chart-card .share-toggle', { pad: 60 });
      await S.click('.chart-card .share-toggle', { after: 300 });
      await S.focus(['.chart-card .share-toggle', '[role=menu]'], { pad: 30 });
      for (const t of ['Download as PNG', 'Share as link', 'Embed as HTML']) {
        await S.moveTo({ text: t, in: '[role=menu]' }, { ms: 500 });
        await S.wait(900);
      }
      await S.key('Escape');
      S.mark('Export the caps');
      await S.focus();
      await S.scrollTo('#capsTableWrap', 120, 900);
      await S.focus('#csvBtn', { pad: 110 });
      await S.moveTo('#csvBtn', { ms: 700 });
      await S.wait(1800);
    },
  },
  {
    // How the numbers work: the input the answer rests on most (dependants, for this couple),
    // raised and lowered while the figures and the chart follow.
    name: 'sensitivity',
    async run(S) {
      await preset(S, 'couple');
      await S.click(tab('house'), { after: 0 });
      await S.scrollTo('.metrics', 14, 0);
      await S.reveal('#deps', 0.5, 0);
      await park(S);
      S.begin();
      await S.focus(['#deps + .seg-group', '#kpiLoan', '#kpiBind'], { pad: 30, after: 400 });
      S.mark('One more dependant');
      await S.click(deps(3), { after: 1600 });
      await S.focus();
      await park(S, 1000, 640);
      await S.wait(2200);
      S.mark('One fewer');
      await S.focus(['#deps + .seg-group', '#kpiLoan', '#kpiBind'], { pad: 30 });
      await S.click(deps(1), { after: 1600 });
      await S.focus();
      await park(S, 1000, 640);
      await S.wait(2400);
      S.mark('Back to two');
      await S.focus(['#deps + .seg-group', '#kpiLoan', '#kpiBind'], { pad: 30 });
      await S.click(deps(2), { after: 1400 });
      await S.focus();
      await S.wait(1800);
    },
  },
];
