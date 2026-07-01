/* Guided-tour config for the Finance vs Cash Scenario Explorer.
   The shared engine (../tour-shared.js) reads this object. */
window.__TOUR = {
  seenKey: 'fvc-tour-v1-seen',
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
      title: '① Set your base numbers',
      body: 'Enter the <strong>purchase cost</strong>, the <strong>cash you have</strong>, ' +
            'and the <strong>risk-free rate</strong> you would earn on cash left invested. ' +
            'You can also switch on inflation adjustment to see results in today\'s money.'
    },
    {
      target: '.ctrl-tabs',
      title: '② Add financing scenarios',
      body: 'Open <strong>Scenarios</strong> to add each installment or loan option: ' +
            'interest rate, down payment, term, and fees. Compare several at once, then ' +
            'use <strong>Sensitivity</strong> to sweep a variable like the finance rate.'
    },
    {
      target: '.metrics',
      title: '③ See the verdict',
      body: 'The KPI cards call the <strong>best strategy</strong> and the ' +
            '<strong>net benefit versus paying cash</strong>. A positive net benefit means ' +
            'financing and investing the difference left you wealthier.'
    },
    {
      target: '.chart-card',
      title: '④ Explore over time',
      body: 'The chart tracks ending wealth, loan balance, and investment value across the ' +
            'term. Export any view as SVG or PNG, or download the amortization schedule as ' +
            'CSV. Everything runs privately in your browser.'
    },
    {
      target: null,
      title: '✅ You are all set',
      body: 'That is the whole workflow. Free, with no account. Replay this tour any time ' +
            'via <strong>Take a tour</strong> in the header.'
    }
  ]
};
