/* Guided-tour config for the Pisah Harta vs Gabung Harta calculator.
   The shared engine (../tour-shared.js) reads this object. v2: the tour
   follows the redesigned page (Quick Start is the way back to the start,
   Household and PTKP & Brackets tabs, the answer sentence, the table behind
   Show table), so readers who took v1 are offered it again. v3 trims every
   step to a lead line and a short list. */
window.__TOUR = {
  seenKey: 'pvg-tour-v3-seen',
  launchLabel: '🧭 Take a tour',
  steps: [
    {
      target: null,
      title: '👋 Welcome to Pisah vs Gabung Harta',
      body: 'Find which way a married couple files PPh 21 for <strong>less tax</strong>: ' +
            'Pisah Harta or Gabung Harta. About a minute.'
    },
    {
      target: '.quick-start-row',
      title: '① Start from an example',
      body: '<ul><li>Each loads a worked household</li>' +
            '<li>Equal incomes, no children is the starting example</li>' +
            '<li>Every example resets PTKP and brackets to the law</li></ul>'
    },
    {
      target: '#tab-inputs',
      onEnter: function () {
        // Make sure the Household panel is showing so the spotlight lands on it.
        var tab = document.querySelector('.ctrl-tab[data-tab="inputs"]');
        if (tab) tab.click();
      },
      title: '② Your household',
      body: '<ul><li>Number of <strong>dependants</strong></li>' +
            '<li>Income as a total and the wife\'s share, or per spouse</li>' +
            '<li>Any deductions (pengurang); all in rupiah a year</li></ul>'
    },
    {
      target: '#tab-advanced',
      onEnter: function () {
        // The step describes what is inside PTKP & Brackets, so open that panel
        // rather than spotlighting a tab the user still has to find.
        var tab = document.querySelector('.ctrl-tab[data-tab="advanced"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '③ PTKP & Brackets',
      body: 'Set to the statutory values. Change them only to model a different rule.'
    },
    {
      target: '#verdict',
      onEnter: function () {
        // Back to the Household tab, so the panel matches what the answer is about.
        var tab = document.querySelector('.ctrl-tab[data-tab="inputs"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '④ The answer',
      body: '<ul><li>Which scheme is <strong>cheaper</strong>, and by how much a year</li>' +
            '<li>Where the crossover sits</li></ul>'
    },
    {
      target: '.metrics',
      title: '⑤ The figures',
      body: '<ul><li>Tax saving, in the cheaper scheme\'s colour</li>' +
            '<li>Each scheme\'s total tax and effective rate</li></ul>'
    },
    {
      target: '.chart-card',
      title: '⑥ Across salaries',
      body: '<ul><li>Household salary from Rp 100 million to Rp 5 billion, at your split</li>' +
            '<li>Blue is Gabung, gold is Pisah</li>' +
            '<li>The crossover note under the second chart says where they swap</li></ul>'
    },
    {
      target: '#detailSection',
      title: '⑦ The detail',
      body: '<ul><li>The chevron opens tax at each salary</li>' +
            '<li><strong>CSV</strong> downloads it either way</li></ul>'
    },
    {
      target: null,
      title: '✅ You are all set',
      body: '<ul><li>Free, private, no account</li>' +
            '<li>Replay this tour with the 🧭 button</li></ul>'
    }
  ]
};
