/* Guided-tour config for the Pisah Harta vs Gabung Harta calculator.
   The shared engine (../tour-shared.js) reads this object. */
window.__TOUR = {
  seenKey: 'pvg-tour-v1-seen',
  launchLabel: '🧭 Take a tour',
  steps: [
    {
      target: null,
      title: '👋 Welcome to Pisah vs Gabung Harta',
      body: 'This quick tour shows how to compare <strong>Pisah Harta</strong> and ' +
            '<strong>Gabung Harta</strong> PPh 21 for a married couple, so you can see ' +
            'which filing scheme results in lower total tax. It takes about a minute.'
    },
    {
      target: '#tab-inputs',
      onEnter: function () {
        // Make sure the Inputs panel is showing so the spotlight lands on it.
        var tab = document.querySelector('.ctrl-tab[data-tab="inputs"]');
        if (tab) tab.click();
      },
      title: '① Enter household income',
      body: 'Set the <strong>number of dependents</strong> and the household salary. Use ' +
            '<strong>Total + Split %</strong> to enter one figure and a share, or ' +
            '<strong>Husband + Wife</strong> to enter each salary separately, with ' +
            'deductions (pengurang) if any.'
    },
    {
      target: '.ctrl-tabs',
      title: '② Adjust PTKP and brackets',
      body: 'The <strong>PTKP & Brackets</strong> tab lets you review and edit the PTKP ' +
            'values and the PPh 21 tax brackets, so the calculation always reflects the ' +
            'current rules or your own assumptions.'
    },
    {
      target: '.metrics',
      title: '③ See which scheme wins',
      body: 'The cards show total tax under <strong>Pisah Harta</strong> and ' +
            '<strong>Gabung Harta</strong>, plus the <strong>tax savings</strong> of the ' +
            'cheaper option for your income and split.'
    },
    {
      target: '.chart-card',
      title: '④ Find the crossover',
      body: 'The charts plot total tax and the difference across a salary range, so you ' +
            'can see the <strong>crossover point</strong> where one scheme becomes cheaper ' +
            'than the other. Everything runs privately in your browser.'
    },
    {
      target: null,
      title: '✅ You are all set',
      body: 'That is the whole workflow, free and with no account. Replay this tour any ' +
            'time via <strong>Take a tour</strong> in the header.'
    }
  ]
};
