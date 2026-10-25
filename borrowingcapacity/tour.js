/* Guided-tour config for the Borrowing Capacity tool.
   The shared engine (../tour-shared.js) reads this object.

   Step ① loads the Average Man scenario over the form, so every later step
   spotlights a populated panel and a real result rather than the generic
   default. The steps name him out loud, so the seed always applies and the
   tour can never describe one borrower while showing another.

   Because that overwrites whatever was on screen, saveState and restoreState
   hand the user their own figures back when the tour ends, however it ends.
   Both delegate to window.__BC_TOUR, which script.js exposes.

   v2 follows the redesign: the answer sentence, the Purchase tab (was Caps),
   the one "Detail" switch per section and the spelled-out NSR and UMI, so
   readers who took v1 are offered it again. v3 trims every step to a lead
   line and a short list. */
window.__TOUR = {
  seenKey: 'bc-tour-v3-seen',
  launchLabel: '🧭 Tour',
  saveState: function () {
    return window.__BC_TOUR ? window.__BC_TOUR.saveState() : null;
  },
  restoreState: function (snap) {
    if (window.__BC_TOUR) window.__BC_TOUR.restoreState(snap);
  },
  steps: [
    {
      target: null,
      title: '👋 Welcome to Borrowing Capacity',
      body: 'Work out <strong>how much an Australian lender would lend you</strong>, the ' +
            'way a lender does. About a minute.'
    },
    {
      target: '.quick-start-row',
      onEnter: function () {
        if (window.__BC_TOUR) window.__BC_TOUR.seedMan();
      },
      title: '① Start from an example',
      body: 'One click fills every tab. We loaded <strong>Average Man in Perth</strong>, ' +
            'a single buyer on $110,000, for the rest of the tour.'
    },
    {
      target: '.ctrl-tabs',
      title: '② Five tabs, in a lender\u2019s order',
      body: '<ul><li>Income: what you earn</li>' +
            '<li>Household: who you support, where you live</li>' +
            '<li>Debts: what you already owe</li>' +
            '<li>Loan: rate, term, assessment settings</li>' +
            '<li>Purchase: price, deposit, costs</li></ul>'
    },
    {
      target: '#incModeGroup',
      onEnter: function () {
        var tab = document.querySelector('.ctrl-tab[data-tab="income"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '③ Simple or Detailed',
      body: 'Four sections open with a <strong>Detail</strong> switch; mix them freely.' +
            '<ul><li>Simple: one gross figure a year</li>' +
            '<li>Detailed: each income stream at the share a lender counts</li></ul>'
    },
    {
      target: '#verdict',
      title: '④ The answer',
      body: '<ul><li>How much he could likely borrow</li>' +
            '<li>Whether that buys the home he priced</li>' +
            '<li>Which cap sets the limit</li></ul>'
    },
    {
      target: '.metrics',
      title: '⑤ The figures',
      body: '<ul><li><strong>Binding constraint</strong>: the cap holding him back ' +
            '(here serviceability)</li>' +
            '<li>Income cover (NSR) and Left each month (UMI): how tight it is</li></ul>'
    },
    {
      target: '.chart-card',
      title: '⑥ Every cap across incomes',
      body: '<ul><li>All four caps, plotted across the income range</li>' +
            '<li>Your capacity is the <strong>lowest line</strong> at each point</li></ul>'
    },
    {
      target: null,
      title: '✅ You are all set',
      body: 'Below the chart:' +
            '<ul><li>The four caps table, with CSV export</li>' +
            '<li>Workings and assumptions, each behind a chevron</li>' +
            '<li>Replay this tour with the 🧭 button</li></ul>'
    }
  ]
};
