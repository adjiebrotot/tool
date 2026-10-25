/* Guided-tour config for the Rent vs Own tool.
   The shared engine (../tour-shared.js) reads this object. Every step has to
   describe what is actually on screen, so a step about a tab opens it first.
   v4 trims every step to a lead line and a short list. */
window.__TOUR = {
  seenKey: 'rvo-tour-v4-seen',
  launchLabel: '🧭 Tour',
  steps: [
    {
      target: null,
      title: '👋 Welcome to Rent vs Own',
      body: 'See whether <strong>renting or buying</strong> a home leaves you better off ' +
            'over time. About a minute.'
    },
    {
      target: '.quick-start-row',
      title: '① Start from a city',
      body: '<ul><li>Search a city such as Perth, Tokyo or Jakarta</li>' +
            '<li>Pick a home it really has, studio to four-bedroom</li>' +
            '<li>Local prices, rents and loan terms fill in; change any of them</li></ul>'
    },
    {
      target: '.ctrl-tabs',
      onEnter: function () {
        var tab = document.querySelector('.ctrl-tab[data-tab="own"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '② Three tabs',
      body: '<ul><li><strong>Home</strong>: price, down payment, mortgage, owning costs</li>' +
            '<li><strong>Rent</strong>: rent, its costs, optional Rent-Then-Buy</li>' +
            '<li><strong>Assumptions</strong>: savings rate, price growth, time horizon</li></ul>'
    },
    {
      target: '#verdict',
      title: '③ The answer',
      body: '<ul><li>Which comes out ahead, by how much, after how long</li>' +
            '<li>Blue is owning, gold is renting</li></ul>'
    },
    {
      target: '.metrics',
      title: '④ Key numbers',
      body: '<ul><li><strong>Equity difference</strong> at the end</li>' +
            '<li><strong>Breakeven year</strong>, when owning pulls ahead for good</li>' +
            '<li>The starting cash and monthly budget both paths share</li></ul>'
    },
    {
      target: '.chart-card',
      title: '⑤ Over time',
      body: '<ul><li>Switch between Net equity, Liquid cash and Accumulated cost</li>' +
            '<li>The ? explains each; export as SVG or PNG</li></ul>'
    },
    {
      target: '#detailSection',
      title: '⑥ The details',
      body: '<ul><li>Year-by-year cashflow opens from its chevron; CSV exports it</li>' +
            '<li>What this assumes, below, lists what the model counts</li></ul>'
    },
    {
      target: null,
      title: '✅ You are all set',
      body: '<ul><li>Many scenarios at once? Try the <strong>Sensitivity Analysis ' +
            'Tool</strong> linked near the top</li>' +
            '<li>Replay this tour with the 🧭 button</li></ul>'
    }
  ]
};
