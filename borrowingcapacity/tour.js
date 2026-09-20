/* Guided-tour config for the Borrowing Capacity tool.
   The shared engine (../tour-shared.js) reads this object.

   Step ① loads the Average Man scenario over the form, so every later step
   spotlights a populated panel and a real result rather than the generic
   default. The steps name him out loud, so the seed always applies and the
   tour can never describe one borrower while showing another.

   Because that overwrites whatever was on screen, saveState and restoreState
   hand the user their own figures back when the tour ends, however it ends.
   Both delegate to window.__BC_TOUR, which script.js exposes. */
window.__TOUR = {
  seenKey: 'bc-tour-v1-seen',
  launchLabel: '🧭 Take a tour',
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
      body: 'This quick tour shows how to work out <strong>how much an Australian ' +
            'lender would actually advance you</strong>, after income shading, tax, ' +
            'the HEM living-cost benchmark, your existing commitments and the four ' +
            'hard caps. It takes about a minute, and you can skip it any time.'
    },
    {
      target: '.quick-start-row',
      onEnter: function () {
        if (window.__BC_TOUR) window.__BC_TOUR.seedMan();
      },
      title: '① Start from a worked example',
      body: 'One click fills every tab with a real borrower. We have loaded ' +
            '<strong>Average Man in Perth</strong> for you, a single buyer on ' +
            '$105,000, so the rest of the tour has his numbers on screen. There is ' +
            'also a Sydney high earner, a Melbourne couple, a first home buyer and a ' +
            'self-employed tradie.'
    },
    {
      target: '.ctrl-tabs',
      title: '② Five tabs, in the order a lender asks',
      body: '<strong>Income</strong> is what you earn, <strong>Household</strong> is ' +
            'who you support and where you live, <strong>Debts</strong> is what you ' +
            'already owe, <strong>Loan</strong> is the product and the assessment ' +
            'settings, and <strong>Caps</strong> is the property and the ceilings.'
    },
    {
      target: '#incModeGroup',
      onEnter: function () {
        var tab = document.querySelector('.ctrl-tab[data-tab="income"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '③ Simple or Detailed, section by section',
      body: '<strong>Simple</strong> takes one gross figure. <strong>Detailed</strong> ' +
            'splits it into each stream and exposes the shading factor, the share a ' +
            'lender is willing to count. A bonus is typically counted at 80%, base ' +
            'salary in full. Four sections carry this switch, and you can mix them.'
    },
    {
      target: '.metrics',
      title: '④ Read the binding constraint first',
      body: 'Six numbers summarise the run. <strong>Binding constraint</strong> is the ' +
            'one to read first: it names the cap actually holding you back, and the ' +
            'other three have slack. For him it is serviceability, which is what ' +
            'stops most Australian borrowers. <strong>NSR</strong> and ' +
            '<strong>UMI</strong> show how tightly the answer closes.'
    },
    {
      target: '.chart-card',
      title: '⑤ See every cap across the income range',
      body: 'He sits at the centre of a sweep across the income range, with all ' +
            'four caps plotted. Your capacity is the <strong>lowest line at every ' +
            'point</strong>, so you can see exactly where one cap hands over to ' +
            'another. Hover for the figures, and export the chart as an image.'
    },
    {
      target: null,
      title: '✅ You are all set',
      body: 'Four tables below the chart break down the four caps, the serviceability ' +
            'build-up line by line, your income shading and your monthly commitments, ' +
            'and <strong>CSV</strong> exports the lot. Everything runs privately in ' +
            'your browser, free. Replay this tour any time via <strong>Take a ' +
            'tour</strong> in the header.'
    }
  ]
};
