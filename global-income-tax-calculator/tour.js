/* Guided-tour config for the Global Income Tax Calculator.
   The shared engine (../tour-shared.js) reads this object.

   The steps on the results first seed the Asia hubs Quick Start, read in each
   job's own currency (window.__GSC_TOUR, defined in script.js), so the chart
   shows one axis per currency and every step describes what is on screen.
   Whatever the reader had is handed back when the tour ends, however it ends. */
function gitcSeed(){
  if (window.__GSC_TOUR) window.__GSC_TOUR.seed();
}
function gitcTab(name){
  return function () {
    var tab = document.querySelector('.ctrl-tab[data-tab="' + name + '"]');
    if (tab && !tab.classList.contains('active')) tab.click();
  };
}
window.__TOUR = {
  seenKey: 'gitc-tour-v1-seen',
  launchLabel: '🧭 Tour',
  guide: 'guides/',
  saveState: function () {
    return window.__GSC_TOUR ? window.__GSC_TOUR.saveState() : null;
  },
  restoreState: function (snap) {
    if (window.__GSC_TOUR) window.__GSC_TOUR.restoreState(snap);
  },
  steps: [
    {
      target: null,
      title: '👋 Welcome to the Global Income Tax Calculator',
      body: 'Take-home pay after income tax and social contributions in <strong>31 countries</strong> ' +
            'and every US state, each line with its source. About a minute.'
    },
    {
      target: '.quick-start-row',
      title: '① Start from an example',
      body: 'One click loads four jobs side by side, from Asian hubs to US states. ' +
            'Then type over any figure. 💾 and 📂 keep a comparison as a file.'
    },
    {
      target: '.jobs-bar',
      onEnter: gitcSeed,
      title: '② Up to four jobs',
      body: '<ul><li>Each job keeps its own <strong>country</strong>, situation and currency</li>' +
            '<li>Click a job to edit it in the tabs below</li>' +
            '<li><strong>+ Add job</strong> starts as a copy of the one picked</li></ul>'
    },
    {
      target: '#tab-salary',
      onEnter: gitcTab('salary'),
      title: '③ Where and how much',
      body: '<ul><li>Type a few letters to <strong>search</strong> a country, state or province</li>' +
            '<li><strong>I know my</strong>: gross pay, or the take-home pay you want</li>' +
            '<li>Your residency or tax regime, where it matters</li></ul>'
    },
    {
      target: '.ctrl-tabs',
      title: '④ Household and Details',
      body: 'Only what the job\'s country uses: children, a married couple, church tax, ' +
            'a pension rate, a student loan. A tab with nothing to set says so.'
    },
    {
      target: '#verdict',
      onEnter: gitcSeed,
      title: '⑤ The answer',
      body: 'One sentence: which job leaves the most, or the gross pay a take-home needs. ' +
            'The cards under it give each job\'s take-home, tax and contributions.'
    },
    {
      target: '.view-bar',
      onEnter: gitcSeed,
      title: '⑥ Currency and period',
      body: '<ul><li><strong>Show amounts in</strong>: each job\'s own currency, or one for all</li>' +
            '<li><strong>Per</strong>: a year or a month</li>' +
            '<li>Rates are today\'s, for reading only</li></ul>'
    },
    {
      target: '.chart-card',
      onEnter: gitcSeed,
      title: '⑦ Across the pay range',
      body: 'Each line is the share of gross a job takes home as pay rises; the dot is the job as entered. ' +
            'Jobs in different currencies get <strong>one axis per currency</strong>, lined up at the exchange rate.'
    },
    {
      target: '#linesSection',
      onEnter: gitcSeed,
      title: '⑧ Take-home pay breakdowns',
      body: 'One job at a time, picked beside the title: every tax and contribution, its <strong>source</strong> and the date its rule took effect, ' +
            'marked Official, Secondary or Assumption. Open it from its chevron.'
    },
    {
      target: null,
      title: '✅ You are all set',
      body: '<ul><li>Swap in your own jobs over the example</li>' +
            '<li>Everything stays in your browser</li>' +
            '<li>Replay this tour with the 🧭 button</li></ul>'
    }
  ]
};
