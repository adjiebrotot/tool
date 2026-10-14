/* Guided-tour config for the Portfolio DCA Simulator.
   The shared engine (../../tour-shared.js) reads this object. v2 follows the
   redesign: Currency on the Data tab, Settings renamed Assumptions, and the
   answer and summary above the charts, so readers who took v1 see it again.
   v3 adds Optimise mode (the gold gauge beside a field). */
window.__TOUR = {
  seenKey: 'dcapf-tour-v3-seen',
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
      title: '② Data, Portfolios, Assumptions',
      body: 'Pick the currency and load market data in <strong>Data</strong>, build each ' +
            'strategy in <strong>Portfolios</strong>, each with its own Risk-Free Account ' +
            'and fees, and set when orders fill and the seed behind simulated assets in ' +
            '<strong>Assumptions</strong>.'
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
      // .pf-bar is only the portfolio selector; the assets, weights, top-ups
      // and rebalancing rules this step describes live in the panel below it,
      // so spotlight the whole panel the step is actually about.
      target: '#tab-portfolios',
      onEnter: function () {
        // Reveal the Portfolios panel so the spotlight lands on visible content.
        var tab = document.querySelector('.ctrl-tab[data-tab="portfolios"]');
        if (tab) tab.click();
      },
      title: '④ Build and compare portfolios',
      body: 'Each portfolio gets its own three subtabs: <strong>Top-Ups</strong>, ' +
            '<strong>Assets</strong>, and <strong>Rebalancing</strong>, where the target ' +
            'weights live. Add as many portfolios as you like with <strong>+</strong> and ' +
            'the simulator charts them together, so you can compare allocation and ' +
            'rebalancing choices fairly.'
    },
    {
      // The gauge lives beside the field it sweeps, so the step opens the
      // Top-Ups subtab where the first one (Amount per top-up) is on screen.
      target: '.opt-btn[data-opt="topup.amount"]',
      onEnter: function () {
        var tab = document.querySelector('.ctrl-tab[data-tab="portfolios"]');
        if (tab && !tab.classList.contains('active')) tab.click();
        var sub = document.querySelector('.sub-tab[data-sub="topups"]');
        if (sub) sub.click();
      },
      title: '⑤ Optimise a setting',
      body: 'The gold <strong>gauge</strong> beside a field sweeps it over a range: pick a ' +
            'Start, an End and how many steps, for up to two settings of one portfolio. ' +
            'Simulate becomes <strong>▶ Optimise</strong>, and the chart shows which value ' +
            'did best, as a line for one setting or a 3D surface for two.'
    },
    {
      target: '#simBtn',
      onEnter: function () {
        // Simulate/Reset only exist outside the Data panel, so make sure a
        // Portfolios panel is open before the step points at the button.
        var tab = document.querySelector('.ctrl-tab[data-tab="portfolios"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '⑥ Run the simulation',
      body: 'Click <strong>Simulate</strong> to backtest every portfolio on the same ' +
            'overlapping dates. The sentence at the top of the results says which ended ' +
            'highest, or which earned the most on what went in when the top-ups differ. ' +
            'The <strong>Final Summary</strong> under it lines up value, return and risk ' +
            'metrics, the charts follow, and the breakdown table opens from the ' +
            '<strong>chevron</strong> beside its title. Everything runs locally in your browser.'
    },
    {
      target: null,
      title: '✅ You are all set',
      body: 'That is the workflow. Prefer comparing single assets instead? Use the ' +
            '<strong>Single-Asset DCA</strong> tool linked in the header. Replay this tour ' +
            'any time via the <strong>🧭</strong> button.'
    }
  ]
};
