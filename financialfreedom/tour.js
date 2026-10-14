/* Guided-tour config for the Financial Freedom Calculator.
   The shared engine (../tour-shared.js) reads this object. Every step has to
   describe what is actually on screen, so the steps that talk about a panel
   open that panel first. v4 follows the redesign: Settings became
   Assumptions (inflation and the simulation), the money switch moved beside
   the results, and the table opens behind Show table, so readers who took v3
   are offered it again. v5 trims every step to a lead line and a short list. */
window.__TOUR = {
  seenKey: 'ff-tour-v5-seen',
  launchLabel: '🧭 Take a tour',
  steps: [
    {
      target: null,
      title: '👋 How much is enough?',
      body: 'Find two things:' +
            '<ul><li>the <strong>pot</strong> you need before you can stop working</li>' +
            '<li>the <strong>age</strong> you actually reach it</li></ul>'
    },
    {
      target: '.quick-start-row',
      title: '① Start from a worked plan',
      body: 'One click fills every tab with a ready-made saver, from a moderate 40% saver ' +
            'to a geoarbitrageur or a late starter. Then change any figure.'
    },
    {
      target: '#tab-you',
      onEnter: function () {
        var tab = document.querySelector('.ctrl-tab[data-tab="you"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '② Your money in and out',
      body: '<ul><li><strong>Money in</strong>: savings, or income with the gap worked ' +
            'out, plus any pension</li>' +
            '<li><strong>Money out</strong>: spending now and once you stop</li>' +
            '<li>Set <strong>Detail</strong> to Detailed for life stages (study, kids, ' +
            'part-time work)</li></ul>'
    },
    {
      target: '#tab-invest',
      onEnter: function () {
        var tab = document.querySelector('.ctrl-tab[data-tab="invest"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '③ What it is invested in',
      body: '<ul><li>Pick a preset, or type a ticker and press Fetch</li>' +
            '<li><strong>Volatility</strong> sets how wide the outcomes spread, crashes ' +
            'included</li></ul>'
    },
    {
      target: '#tab-goal',
      onEnter: function () {
        var tab = document.querySelector('.ctrl-tab[data-tab="goal"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '④ What should the money do?',
      body: 'Each needs a very different pot:' +
            '<ul><li>Just Die: spend it all by life expectancy</li>' +
            '<li>Leave a Legacy: keep a set amount</li>' +
            '<li>Die Rich: spend only the growth, forever</li></ul>'
    },
    {
      target: '#tab-settings',
      onEnter: function () {
        var tab = document.querySelector('.ctrl-tab[data-tab="settings"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '⑤ Assumptions',
      body: 'The guesses nobody knows for sure:' +
            '<ul><li><strong>Inflation</strong>, which lifts your spending and the pot</li>' +
            '<li>How certain the outcome has to be</li></ul>'
    },
    {
      target: '#simBtn',
      title: '⑥ Press Simulate',
      body: '<ul><li>Edits do not rerun the answer; this button lights up instead</li>' +
            '<li>Press <strong>Simulate</strong> once the plan is set</li>' +
            '<li>Quick Starts and the retirement slider run on their own</li></ul>'
    },
    {
      target: '#boardPath',
      onEnter: function () {
        var tab = document.querySelector('.ctrl-tab[data-tab="you"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '⑦ Path to freedom',
      body: '<ul><li>Red: the pot you need if you stopped at that age</li>' +
            '<li>Blue: what your investment grows to</li>' +
            '<li><strong>Where they cross</strong> is the earliest age you could stop</li>' +
            '<li>Show in today’s money switches every figure on the page</li></ul>'
    },
    {
      target: '#retireSlider',
      title: '⑧ Drag the retirement age',
      body: 'Everything below follows this slider.' +
            '<ul><li>It starts on the crossing, near a coin flip</li>' +
            '<li>Drag right and the <strong>chance of success</strong> climbs</li>' +
            '<li>Click the age to type one</li></ul>'
    },
    {
      target: '#boardCash .chart-card',
      title: '⑨ Cashflows',
      body: '<ul><li>Income against spending: green while you save, red once the pot pays</li>' +
            '<li>The panel under it shows the balance those flows leave</li></ul>'
    },
    {
      target: '#boardCash .detail-section',
      title: '⑩ Year-by-year table',
      body: '<ul><li>Opens from the chevron; CSV exports it either way</li>' +
            '<li>Each row adds up: Balance + Saved + Growth = next Balance</li></ul>'
    },
    {
      target: null,
      title: '✅ You are all set',
      body: '<ul><li>Nothing leaves your browser, and your inputs are remembered</li>' +
            '<li>Replay this tour with the 🧭 button</li></ul>'
    }
  ]
};
