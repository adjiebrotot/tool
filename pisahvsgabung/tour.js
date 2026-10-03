/* Guided-tour config for the Pisah Harta vs Gabung Harta calculator.
   The shared engine (../tour-shared.js) reads this object. v2: the tour
   follows the redesigned page (Quick Start is the way back to the start,
   Household and PTKP & Brackets tabs, the answer sentence, the table behind
   Show table), so readers who took v1 are offered it again. */
window.__TOUR = {
  seenKey: 'pvg-tour-v2-seen',
  launchLabel: '🧭 Take a tour',
  steps: [
    {
      target: null,
      title: '👋 Welcome to Pisah vs Gabung Harta',
      body: 'This quick tour shows how to compare <strong>Pisah Harta</strong> and ' +
            '<strong>Gabung Harta</strong> PPh 21 for a married couple, so you can see which ' +
            'filing scheme results in lower total tax. It takes about a minute.'
    },
    {
      target: '.quick-start-row',
      title: '① Start from an example',
      body: 'Pick a worked household. <strong>Equal incomes, no children</strong> is the example ' +
            'the page opens with, so it also takes you back to the start. Every example puts PTKP ' +
            'and the brackets back to the statutory values.'
    },
    {
      target: '#tab-inputs',
      onEnter: function () {
        // Make sure the Household panel is showing so the spotlight lands on it.
        var tab = document.querySelector('.ctrl-tab[data-tab="inputs"]');
        if (tab) tab.click();
      },
      title: '② Describe your household',
      body: 'Tap the number of <strong>dependants</strong>, then enter income either as a ' +
            '<strong>total and the wife\'s share</strong> or <strong>each spouse</strong> on their ' +
            'own, with any deductions (pengurang). Every amount is rupiah a year.'
    },
    {
      target: '#tab-advanced',
      onEnter: function () {
        // The step describes what is inside PTKP & Brackets, so open that panel
        // rather than spotlighting a tab the user still has to find.
        var tab = document.querySelector('.ctrl-tab[data-tab="advanced"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '③ Check PTKP and brackets',
      body: 'This is <strong>PTKP &amp; Brackets</strong>, now open for you. The PTKP amounts and the PPh 21 ' +
            'brackets start at the statutory values; change them only to model a different rule.'
    },
    {
      target: '#verdict',
      onEnter: function () {
        // Back to the Household tab, so the panel matches what the answer is about.
        var tab = document.querySelector('.ctrl-tab[data-tab="inputs"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '④ Read the answer',
      body: 'The sentence at the top says whether <strong>Pisah Harta</strong> or <strong>Gabung ' +
            'Harta</strong> is cheaper for your household and by how much a year, then where the ' +
            'crossover sits.'
    },
    {
      target: '.metrics',
      title: '⑤ The figures behind it',
      body: 'The first card is the tax saving, in the colour of the cheaper scheme. The other two are ' +
            'each scheme\'s total tax a year and its effective rate.'
    },
    {
      target: '.chart-card',
      title: '⑥ Compare across salaries',
      body: 'The charts run the household salary from Rp 100 million to Rp 5 billion a year at your ' +
            'split. Blue is Pisah Harta and gold is Gabung Harta; the crossover analysis under the ' +
            'second chart says where one becomes cheaper than the other.'
    },
    {
      target: '#detailSection',
      title: '⑦ Open the detail',
      body: '<strong>Show table</strong> opens the tax at each salary, and <strong>CSV</strong> ' +
            'downloads it whether the table is open or not. The page ends with what the calculation ' +
            'assumes.'
    },
    {
      target: null,
      title: '✅ You are all set',
      body: 'That is the whole workflow, free, private and with no account. Replay this tour any ' +
            'time via <strong>Take a tour</strong> in the header.'
    }
  ]
};
