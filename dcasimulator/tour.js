/* Guided-tour config for the DCA Scenario Explorer (single asset).
   The shared engine (../tour-shared.js) reads this object. v2 follows the
   redesign: Currency on the Data tab, Settings renamed Assumptions, and the
   answer and summary above the charts, so readers who took v1 see it again. */
window.__TOUR = {
  seenKey: 'dca-tour-v2-seen',
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
      title: '② Data, Scenarios, Assumptions',
      body: 'Everything is organised into three tabs. In <strong>Data</strong> you pick ' +
            'the currency and load the market data, in <strong>Scenarios</strong> you ' +
            'define each DCA strategy, and in <strong>Assumptions</strong> you set when ' +
            'orders fill, the seed behind simulated assets, and the risk-free rate for ' +
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
      onEnter: function () {
        // Simulate/Reset are hidden while the Data panel is showing, so the
        // step used to spotlight an element with no box at all. Open the
        // Scenarios panel the step is talking about before highlighting it.
        var tab = document.querySelector('.ctrl-tab[data-tab="securities"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '④ Run the simulation',
      body: 'Set the same contribution and schedule for each scenario, then click ' +
            '<strong>Simulate</strong>. Everything runs locally in your browser, no ' +
            'account and no paid software needed.'
    },
    {
      target: '.summary-row',
      onEnter: function () {
        // Describing a Final Summary means there has to be one on screen.
        if (window.__DCA_TOUR) window.__DCA_TOUR.ensureResults();
      },
      title: '⑤ Read the answer, then compare',
      body: 'The sentence above the summary says which scenario ended highest and by how ' +
            'much, or, when they put different amounts in, which earned the most on what ' +
            'went in. The <strong>Final Summary</strong> gives each one\u2019s final value, ' +
            'return on investment (ROI), total topped up and trades, plus Sharpe, Sortino ' +
            'and CAGR under <strong>Advanced metrics</strong>. The charts follow; export any ' +
            'of them, and open the breakdown with <strong>Show table</strong> or download ' +
            'it as CSV.'
    },
    {
      target: null,
      title: '✅ You are all set',
      body: 'That is the workflow. Power user comparing whole portfolios? Try the ' +
            '<strong>Portfolio DCA Simulator</strong> linked near the top. Replay this ' +
            'tour any time via the <strong>🧭</strong> button in the header.'
    }
  ]
};
