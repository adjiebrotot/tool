/* Guided-tour config for the Finance vs Cash Scenario Explorer.
   The shared engine (../tour-shared.js) reads this object. v4 follows the
   redesign: Purchase | Loan offers | Assumptions | Sensitivity tabs, the
   answer sentence, and the chart's own metric switch, so readers who took v3
   are offered it again. */
window.__TOUR = {
  seenKey: 'fvc-tour-v4-seen',
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
      target: '.quick-start-row',
      title: '① Start from a worked comparison',
      body: 'One click fills every tab with a decision people actually face: a ' +
            '<strong>house</strong> paid outright against 30-year fixed, ' +
            'fixed-then-variable, and 15-year loans; a <strong>car</strong> over three ' +
            'years, five years, or five with a balloon; a <strong>phone</strong> on plans ' +
            'of 12, 24 or 36 payments that quote no rate at all; a ' +
            '<strong>credit-card 0%</strong> conversion over three tenors; a ' +
            '<strong>flat-rate motorbike</strong> quoted per month; and a ' +
            '<strong>payment holiday</strong> against paying from day one. None of them ' +
            'is decided by the price tag: in the phone and the car the smallest ' +
            'instalment is the worst deal. Then change any figure over the top of it. ' +
            'There is no Reset button because each of these rebuilds the whole form from ' +
            'scratch, so one of them always is one.'
    },
    {
      target: '#tab-base',
      onEnter: function () {
        // Make sure the Purchase panel is showing so the spotlight lands on it.
        var tab = document.querySelector('.ctrl-tab[data-tab="base"]');
        if (tab) tab.click();
      },
      title: '② Enter the purchase',
      body: 'On <strong>Purchase</strong>, enter the <strong>cash purchase cost</strong> and ' +
            'the <strong>cash you have</strong>, in the currency you pick. The ' +
            '<strong>Assumptions</strong> tab holds the <strong>risk-free rate</strong> ' +
            'your cash earns while it stays invested, and the inflation adjustment.'
    },
    {
      target: '#tab-scenarios',
      onEnter: function () {
        // The step describes what is inside the Loan offers panel, so open it
        // instead of asking the user to find the tab themselves.
        var tab = document.querySelector('.ctrl-tab[data-tab="scenarios"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '③ Add financing scenarios',
      body: 'This is <strong>Loan offers</strong>, now open for you. Add each installment ' +
            'or loan option here: interest rate, down payment, term, and fees. ' +
            '<strong>Loan Type</strong> covers the shapes lenders actually sell, from a ' +
            'flat rate to interest-only, a balloon, or an instalment whose rate you do ' +
            'not know. <strong>Rate Basis</strong> switches to a schedule when the rate ' +
            'is fixed for a while and then floats. The coloured dot on each card is a ' +
            'swatch: click it, or the one beside <strong>Scenario Name</strong>, to ' +
            'recolour that scenario everywhere it is drawn. Compare several at once, then use the ' +
            '<strong>Sensitivity</strong> tab to sweep a variable such as the finance rate.'
    },
    {
      target: '#verdict',
      onEnter: function () {
        // Back to the Purchase tab, so the panel matches what the answer is about.
        var tab = document.querySelector('.ctrl-tab[data-tab="base"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '④ Read the answer',
      body: 'The sentence at the top says whether paying cash or a loan comes out ahead, ' +
            'by how much, and at what effective rate against the risk-free rate.'
    },
    {
      target: '.metrics',
      title: '⑤ The figures behind it',
      body: 'Four KPI cards call it: the <strong>best strategy</strong>, the ' +
            '<strong>net benefit versus paying cash</strong>, the <strong>total ' +
            'interest</strong> that strategy pays, and the <strong>wealth a cash ' +
            'purchase</strong> would leave you with. The <strong>Optimization ' +
            'Target</strong> in the first card decides what "best" means. A positive net ' +
            'benefit means financing and investing the difference left you wealthier; a ' +
            'negative one, as in the default numbers here, means paying cash wins.'
    },
    {
      target: '.chart-card',
      title: '⑥ Explore over time',
      body: 'Switch the chart between <strong>Ending Wealth</strong>, <strong>Net ' +
            'Benefit</strong>, <strong>Investment Value</strong> and <strong>Loan ' +
            'Balance</strong> right above it. A floating rate is drawn as a shaded band, so ' +
            'you see the range rather than one guess. Export any view as SVG or PNG; the ' +
            'amortization schedule opens from <strong>Show table</strong> and downloads as ' +
            'CSV. Everything runs privately in your browser.'
    },
    {
      target: null,
      title: '✅ You are all set',
      body: 'That is the whole workflow. Free, with no account. Replay this tour any time ' +
            'via the <strong>🧭</strong> button in the header.'
    }
  ]
};
