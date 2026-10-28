/* Guided-tour config for the Finance vs Cash Scenario Explorer.
   The shared engine (../tour-shared.js) reads this object. v5 follows the
   scenario bar with its offer's form under it, the ▶ Simulate gate, and
   Optimise in place of the Sensitivity tab, so readers who took v4 are
   offered it again. v6 gives the optimise gauge a step of its own. v7 trims
   every step to a lead line and a short list. */
window.__TOUR = {
  seenKey: 'fvc-tour-v7-seen',
  launchLabel: '🧭 Tour',
  guide: 'guides/',
  steps: [
    {
      target: null,
      title: '👋 Welcome to Finance vs Cash',
      body: 'Should you <strong>pay cash</strong>, or <strong>finance and invest the ' +
            'difference</strong>? This compares what each path leaves you with. About a minute.'
    },
    {
      target: '.quick-start-row',
      title: '① Start from an example',
      body: 'One click fills every tab with a real decision: a house, a car, a phone plan, ' +
            'a 0% card conversion and more.' +
            '<ul><li>Change any figure afterwards</li>' +
            '<li>Each one rebuilds the whole form, so it also works as a reset</li></ul>'
    },
    {
      target: '#tab-base',
      onEnter: function () {
        // Make sure the Purchase panel is showing so the spotlight lands on it.
        var tab = document.querySelector('.ctrl-tab[data-tab="base"]');
        if (tab) tab.click();
      },
      title: '② The purchase',
      body: '<ul><li><strong>Purchase</strong>: the cash price and the cash you have</li>' +
            '<li>Assumptions: the <strong>risk-free rate</strong> your cash earns, and inflation</li></ul>'
    },
    {
      target: '#tab-scenarios',
      onEnter: function () {
        // The step describes what is inside the Loan offers panel, so open it
        // instead of asking the user to find the tab themselves.
        var tab = document.querySelector('.ctrl-tab[data-tab="scenarios"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '③ Loan offers',
      body: 'Each offer is a tab on the bar; <strong>+</strong> adds one.' +
            '<ul><li>Double-click to rename, click the dot to recolour</li>' +
            '<li><strong>Loan Type</strong>: flat rate, interest-only, balloon, unknown rate</li>' +
            '<li>Rate Basis: fixed for a while, then floating</li></ul>'
    },
    {
      // The gauge lives beside the field it sweeps, so the step keeps Loan
      // offers open, where Term (shown for every loan type) is on screen.
      target: '.opt-btn[data-opt="term"]',
      onEnter: function () {
        var tab = document.querySelector('.ctrl-tab[data-tab="scenarios"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '④ Optimise a setting',
      body: 'The gold <strong>gauge</strong> beside a field sweeps it over a range.' +
            '<ul><li>Up to two settings, such as term or rate</li>' +
            '<li>Simulate becomes ▶ Optimise; the chart shows which value did best</li></ul>'
    },
    {
      target: '.controls .btn-row',
      title: '⑤ Simulate',
      body: 'Edits do not rerun the comparison; the button lights up instead. Press ' +
            '<strong>▶ Simulate</strong> to compare every offer against cash.'
    },
    {
      target: '#verdict',
      onEnter: function () {
        // Back to the Purchase tab, so the panel matches what the answer is about.
        var tab = document.querySelector('.ctrl-tab[data-tab="base"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '⑥ The answer',
      body: '<ul><li>Whether cash or a loan comes out ahead, and by how much</li>' +
            '<li>The loan’s effective rate against the risk-free rate</li></ul>'
    },
    {
      target: '.metrics',
      title: '⑦ The figures',
      body: '<ul><li>Best strategy, by the Optimization Target you choose</li>' +
            '<li><strong>Net benefit</strong> vs cash: positive means financing wins</li>' +
            '<li>Total interest, and the wealth a cash purchase leaves</li></ul>'
    },
    {
      target: '.chart-card',
      title: '⑧ Over time',
      body: '<ul><li>Switch between Ending Wealth, Net Benefit, Investment Value and Loan Balance</li>' +
            '<li>A floating rate shows as a shaded band</li>' +
            '<li>The amortization schedule opens from its chevron or downloads as CSV</li></ul>'
    },
    {
      target: null,
      title: '✅ You are all set',
      body: '<ul><li>Free, private, no account</li>' +
            '<li>Replay this tour with the 🧭 button</li></ul>'
    }
  ]
};
