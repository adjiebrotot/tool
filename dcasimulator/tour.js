/* Guided-tour config for the DCA Scenario Explorer (single asset).
   The shared engine (../tour-shared.js) reads this object. v2 follows the
   redesign: Currency on the Data tab, Settings renamed Assumptions, and the
   answer and summary above the charts, so readers who took v1 see it again.
   v3 trims every step to a lead line and a short list. */
window.__TOUR = {
  seenKey: 'dca-tour-v3-seen',
  launchLabel: '🧭 Take a tour',
  steps: [
    {
      target: null,
      title: '👋 Welcome to the DCA Scenario Explorer',
      body: 'Backtest <strong>dollar-cost averaging</strong> into different assets and ' +
            'see which would have grown more. About a minute.'
    },
    {
      target: '.quick-start-row',
      title: '① Start from an example',
      body: 'One click loads a full comparison and runs it:' +
            '<ul><li>Monthly vs Weekly</li>' +
            '<li>Equity vs Money Market</li>' +
            '<li>Stock vs ETF</li></ul>'
    },
    {
      target: '.ctrl-tabs',
      title: '② Three tabs',
      body: '<ul><li><strong>Data</strong>: currency and prices</li>' +
            '<li><strong>Scenarios</strong>: one DCA plan each</li>' +
            '<li><strong>Assumptions</strong>: order fills, simulation seed, risk-free rate</li></ul>'
    },
    {
      target: '#tab-data',
      onEnter: function () {
        // Make sure the Data panel is showing so the spotlight lands on it.
        var tab = document.querySelector('.ctrl-tab[data-tab="data"]');
        if (tab) tab.click();
      },
      title: '③ Load the data',
      body: '<ul><li>Real prices: list tickers such as <code>SPY</code> or ' +
            '<code>AAA.AX</code> and load them together</li>' +
            '<li><strong>Simulated</strong>: model an asset from its return and volatility</li></ul>'
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
      title: '④ Simulate',
      body: 'Set each scenario’s contribution and schedule, then press ' +
            '<strong>Simulate</strong>. It all runs in your browser.'
    },
    {
      target: '.summary-row',
      onEnter: function () {
        // Describing a Final Summary means there has to be one on screen.
        if (window.__DCA_TOUR) window.__DCA_TOUR.ensureResults();
      },
      title: '⑤ Read the result',
      body: '<ul><li>The sentence on top names the winner and by how much</li>' +
            '<li><strong>Final Summary</strong>: value, ROI and trades, with Sharpe and ' +
            'CAGR under Advanced metrics</li>' +
            '<li>Charts follow; the breakdown table opens from its chevron or downloads as CSV</li></ul>'
    },
    {
      target: null,
      title: '✅ You are all set',
      body: '<ul><li>Comparing whole portfolios? Try the <strong>Portfolio DCA ' +
            'Simulator</strong> linked near the top</li>' +
            '<li>Replay this tour with the 🧭 button</li></ul>'
    }
  ]
};
