/* Guided-tour config for the Finance vs Cash Scenario Explorer.
   The shared engine (../tour-shared.js) reads this object. */
window.__TOUR = {
  seenKey: 'fvc-tour-v2-seen',
  launchLabel: '🧭 Take a tour',
  steps: [
    {
      target: null,
      title: '👋 Welcome to Finance vs Cash',
      body: 'This quick tour shows how to decide whether to <strong>pay cash</strong> or ' +
            '<strong>finance a purchase and invest the difference</strong>. It compares ' +
            'the total cost of each path, so you can tell if a low-rate or 0% installment ' +
            'plan actually beats paying in full. It takes about a minute.'
    },
    {
      target: '#tab-base',
      onEnter: function () {
        // Make sure the Base panel is showing so the spotlight lands on it.
        var tab = document.querySelector('.ctrl-tab[data-tab="base"]');
        if (tab) tab.click();
      },
      title: '① Set your base numbers',
      body: 'Enter the <strong>purchase cost</strong>, the <strong>cash you have</strong>, ' +
            'and the <strong>risk-free rate</strong> you would earn on cash left invested. ' +
            'You can also switch on inflation adjustment to see results in today\'s money.'
    },
    {
      target: '#tab-scenarios',
      onEnter: function () {
        // The step describes what is inside the Scenarios panel, so open it
        // instead of asking the user to find the tab themselves.
        var tab = document.querySelector('.ctrl-tab[data-tab="scenarios"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '② Add financing scenarios',
      body: 'This is <strong>Scenarios</strong>, now open for you. Add each installment ' +
            'or loan option here: interest rate, down payment, term, and fees. ' +
            '<strong>Loan Type</strong> covers the shapes lenders actually sell, from a ' +
            'flat rate to interest-only, a balloon, or an instalment whose rate you do ' +
            'not know. <strong>Rate Basis</strong> switches to a schedule when the rate ' +
            'is fixed for a while and then floats. Compare several at once, then use the ' +
            '<strong>Sensitivity</strong> tab to sweep a variable such as the finance rate.'
    },
    {
      target: '.metrics',
      title: '③ See the verdict',
      body: 'Four KPI cards call it: the <strong>best strategy</strong>, the ' +
            '<strong>net benefit versus paying cash</strong>, the <strong>total ' +
            'interest</strong> that strategy pays, and the <strong>wealth a cash ' +
            'purchase</strong> would leave you with. A positive net benefit means ' +
            'financing and investing the difference left you wealthier; a negative one, ' +
            'as in the default numbers here, means paying cash wins.'
    },
    {
      target: '.chart-card',
      title: '④ Explore over time',
      body: 'The chart tracks ending wealth, loan balance, and investment value across the ' +
            'term. A floating rate is drawn as a shaded band, so you see the range rather ' +
            'than one guess. Export any view as SVG or PNG, or download the amortization ' +
            'schedule as CSV. Everything runs privately in your browser.'
    },
    {
      target: null,
      title: '✅ You are all set',
      body: 'That is the whole workflow. Free, with no account. Replay this tour any time ' +
            'via <strong>Take a tour</strong> in the header.'
    }
  ]
};
