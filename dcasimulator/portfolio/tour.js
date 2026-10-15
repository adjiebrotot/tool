/* Guided-tour config for the Portfolio DCA Simulator.
   The shared engine (../../tour-shared.js) reads this object. v2 follows the
   redesign: Currency on the Data tab, Settings renamed Assumptions, and the
   answer and summary above the charts, so readers who took v1 see it again.
   v3 adds Optimise mode (the gold gauge beside a field). v4 trims every step
   to a lead line and a short list. */
window.__TOUR = {
  seenKey: 'dcapf-tour-v4-seen',
  launchLabel: '🧭 Take a tour',
  steps: [
    {
      target: null,
      title: '👋 Welcome to the Portfolio DCA Simulator',
      body: 'Compare whole <strong>portfolio strategies</strong> side by side: assets, ' +
            'weights, top-ups and rebalancing. About a minute.'
    },
    {
      target: '.quick-start-row',
      title: '① Start from an example',
      body: 'One click loads a comparison and runs it:' +
            '<ul><li>80/20 vs 60/40</li>' +
            '<li>Rebalance monthly vs quarterly</li>' +
            '<li>Rebalancing vs constant allocation</li></ul>'
    },
    {
      target: '.ctrl-tabs',
      title: '② Three tabs',
      body: '<ul><li><strong>Data</strong>: currency and prices</li>' +
            '<li><strong>Portfolios</strong>: each strategy, with its own cash account and fees</li>' +
            '<li><strong>Assumptions</strong>: order fills and simulation seed</li></ul>'
    },
    {
      target: '#tab-data',
      onEnter: function () {
        // Make sure the Data panel is showing so the spotlight lands on it.
        var tab = document.querySelector('.ctrl-tab[data-tab="data"]');
        if (tab) tab.click();
      },
      title: '③ Load your assets',
      body: '<ul><li>Real prices: list tickers such as <code>SPY</code> or ' +
            '<code>DHHF.AX</code> and load them in one go</li>' +
            '<li><strong>Simulated</strong>: model an asset from its return and volatility</li></ul>'
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
      title: '④ Build portfolios',
      body: 'Add as many as you like with <strong>+</strong>. Each has three subtabs:' +
            '<ul><li>Top-Ups: how much and how often</li>' +
            '<li>Assets: what it holds</li>' +
            '<li>Rebalancing: target weights and when to restore them</li></ul>'
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
      body: 'The gold <strong>gauge</strong> beside a field sweeps it over a range.' +
            '<ul><li>Up to two settings of one portfolio</li>' +
            '<li>Simulate becomes ▶ Optimise</li>' +
            '<li>The chart shows which value did best</li></ul>'
    },
    {
      target: '#simBtn',
      onEnter: function () {
        // Simulate/Reset only exist outside the Data panel, so make sure a
        // Portfolios panel is open before the step points at the button.
        var tab = document.querySelector('.ctrl-tab[data-tab="portfolios"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '⑥ Simulate',
      body: 'Press <strong>Simulate</strong> to backtest every portfolio on the same dates.' +
            '<ul><li>The sentence on top names the winner</li>' +
            '<li>Final Summary lines up value, return and risk</li>' +
            '<li>Charts follow; the breakdown table opens from its chevron</li></ul>'
    },
    {
      target: null,
      title: '✅ You are all set',
      body: '<ul><li>Comparing single assets? Use the <strong>Single-Asset DCA</strong> ' +
            'tool linked in the header</li>' +
            '<li>Replay this tour with the 🧭 button</li></ul>'
    }
  ]
};
