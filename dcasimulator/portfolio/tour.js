/* Guided-tour config for the Portfolio DCA Simulator.
   The shared engine (../../tour-shared.js) reads this object. */
window.__TOUR = {
  seenKey: 'dcapf-tour-v1-seen',
  launchLabel: '🧭 Take a tour',
  steps: [
    {
      target: null,
      title: '👋 Welcome to the Portfolio DCA Simulator',
      body: 'This quick tour shows how to compare whole <strong>portfolio ' +
            'strategies</strong> side by side, each with its own assets, target weights, ' +
            'top-up schedule, and rebalancing method, so you can see which approach grows ' +
            'value fastest. It takes about a minute.'
    },
    {
      target: '.quick-start-row',
      title: '① Start from a worked example',
      body: 'One click loads a full portfolio comparison and runs it: ' +
            '<strong>80/20 vs 60/40</strong> allocations, ' +
            '<strong>rebalance monthly vs quarterly</strong>, or ' +
            '<strong>rebalancing vs constant allocation</strong>. The quickest way to see ' +
            'the simulator in action.'
    },
    {
      target: '.ctrl-tabs',
      title: '② Data, Portfolios, Settings',
      body: 'Load market data in <strong>Data</strong>, build each strategy in ' +
            '<strong>Portfolios</strong>, and set currency and the risk-free rate in ' +
            '<strong>Settings</strong>.'
    },
    {
      target: '#tab-data',
      onEnter: function () {
        // Make sure the Data panel is showing so the spotlight lands on it.
        var tab = document.querySelector('.ctrl-tab[data-tab="data"]');
        if (tab) tab.click();
      },
      title: '③ Load your assets',
      body: 'Enter tickers such as <code>SPY</code>, <code>GOVT</code>, or ' +
            '<code>DHHF.AX</code> for real Yahoo Finance prices, or switch to ' +
            '<strong>Simulated</strong> to model an asset by return and volatility. Load ' +
            'every ticker in one go to stay within the free daily cap.'
    },
    {
      target: '.pf-bar',
      onEnter: function () {
        // Reveal the Portfolios panel so the spotlight lands on visible content.
        var tab = document.querySelector('.ctrl-tab[data-tab="portfolios"]');
        if (tab) tab.click();
      },
      title: '④ Build and compare portfolios',
      body: 'Each portfolio gets its own <strong>assets</strong>, <strong>target ' +
            'weights</strong>, <strong>top-ups</strong>, and <strong>rebalancing</strong> ' +
            'rules. Add several and the simulator charts them together so you can compare ' +
            'allocation and rebalancing choices fairly.'
    },
    {
      target: '#simBtn',
      title: '⑤ Run the simulation',
      body: 'Click <strong>Simulate</strong> to backtest every portfolio on the same ' +
            'overlapping dates. Charts and the <strong>Final Summary</strong> line up ' +
            'value, return, and risk metrics per portfolio. Everything runs locally in ' +
            'your browser.'
    },
    {
      target: null,
      title: '✅ You are all set',
      body: 'That is the workflow. Prefer comparing single assets instead? Use the ' +
            '<strong>Single-Asset DCA</strong> tool linked in the header. Replay this tour ' +
            'any time via <strong>Take a tour</strong>.'
    }
  ]
};
