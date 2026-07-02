/* Guided-tour config for the DCA Scenario Explorer (single asset).
   The shared engine (../tour-shared.js) reads this object. */
window.__TOUR = {
  seenKey: 'dca-tour-v1-seen',
  launchLabel: '🧭 Take a tour',
  steps: [
    {
      target: null,
      title: '👋 Welcome to the DCA Scenario Explorer',
      body: 'This quick tour shows how to backtest and compare ' +
            '<strong>dollar-cost averaging</strong> strategies across different ' +
            'securities, for example an equity ETF versus a money market fund, so you ' +
            'can see which asset would have been more worth it. It takes about a minute.'
    },
    {
      target: '.quick-start-row',
      title: '① Start from a worked example',
      body: 'One click loads a complete comparison and runs it for you: ' +
            '<strong>Monthly vs Weekly</strong>, <strong>Equity vs Money Market</strong>, ' +
            'or <strong>Stock vs ETF</strong>. The fastest way to see how the DCA ' +
            'simulator works before building your own.'
    },
    {
      target: '.ctrl-tabs',
      title: '② Data, Scenarios, Settings',
      body: 'Everything is organised into three tabs. In <strong>Data</strong> you load ' +
            'the market data, in <strong>Scenarios</strong> you define each DCA strategy, ' +
            'and in <strong>Settings</strong> you set currency and the risk-free rate for ' +
            'the advanced metrics.'
    },
    {
      target: '#tab-data',
      onEnter: function () {
        // Make sure the Data panel is showing so the spotlight lands on it.
        var tab = document.querySelector('.ctrl-tab[data-tab="data"]');
        if (tab) tab.click();
      },
      title: '③ Load real or simulated data',
      body: 'Enter tickers such as <code>SPY</code>, <code>AAPL</code>, or ' +
            '<code>AAA.AX</code> to pull real Yahoo Finance prices, or switch to ' +
            '<strong>Simulated</strong> to model an asset by expected return and ' +
            'volatility. List every ticker you want and load them in one go.'
    },
    {
      target: '#simBtn',
      title: '④ Run the simulation',
      body: 'Set the same contribution and schedule for each scenario, then click ' +
            '<strong>Simulate</strong>. Everything runs locally in your browser, no ' +
            'account and no paid software needed.'
    },
    {
      target: '.summary-row',
      title: '⑤ Compare the outcomes',
      body: 'Charts and the <strong>Final Summary</strong> line up ending value, average ' +
            'cost, and return side by side, plus Sharpe, Sortino, and CAGR when you enable ' +
            'advanced metrics. Export any chart or download the full breakdown as CSV.'
    },
    {
      target: null,
      title: '✅ You are all set',
      body: 'That is the workflow. Power user comparing whole portfolios? Try the ' +
            '<strong>Portfolio DCA Simulator</strong> linked near the top. Replay this ' +
            'tour any time via <strong>Take a tour</strong> in the header.'
    }
  ]
};
