/* Guided-tour config for the Rent vs Own Sensitivity Analysis Tool.
   The shared engine (../../tour-shared.js) reads this object. v3 trims every
   step to a lead line and a short list. */
window.__TOUR = {
  seenKey: 'rvos-tour-v3-seen',
  launchLabel: '🧭 Tour',
  steps: [
    {
      target: null,
      title: '👋 Welcome to the Rent vs Own Sensitivity Tool',
      body: 'Compare <strong>many rent vs buy scenarios</strong> side by side. About a minute.'
    },
    {
      // The grid is far taller than the viewport, so spotlighting all of it
      // left nothing dimmed and read as no highlight at all. The header row
      // is what the step is about: one column per scenario, plus Add.
      target: '#tableWrap thead',
      title: '① Each column is a scenario',
      body: '<ul><li>Add a column per case: another deposit, rate or city</li>' +
            '<li>Edit any cell and the table recalculates</li>' +
            '<li>The <strong>⚡</strong> picker fills a column from a Quick Start city</li></ul>'
    },
    {
      target: '#tableWrap tr.group-sep-tr',
      title: '② Shared rows',
      body: 'Horizon, risk-free rate, starting cash and budget are the same for every column, ' +
            'so no scenario wins with more money.' +
            '<ul><li>On <strong>Auto</strong>, cash and budget match the column that needs most</li></ul>'
    },
    {
      target: '.fx-row',
      title: '③ Different currencies',
      body: '<ul><li>Tick <strong>Multi-currency</strong> to give each column its own ' +
            'currency and rate</li>' +
            '<li>Results are shown in the base currency</li></ul>'
    },
    {
      // The step names both controls, so highlight both: the year box sits
      // beside the metric buttons, in the table row above the results.
      target: ['#metricGroup', '#yearInput'],
      title: '④ Metric and year',
      body: '<ul><li>Compare on Net equity, Liquid cash or Accumulated cost</li>' +
            '<li>Set the <strong>year</strong> to compare at</li>' +
            '<li>Own minus rent: blue when owning wins, gold when renting does</li></ul>'
    },
    {
      target: '.csv-actions',
      title: '⑤ Compare and save',
      body: '<ul><li><strong>Compare</strong> charts every scenario together</li>' +
            '<li>Download the grid as CSV, or upload one to rebuild it later</li></ul>'
    },
    {
      target: null,
      title: '✅ You are all set',
      body: '<ul><li>One case in detail? Use the main <strong>Rent vs Own</strong> tool ' +
            'via the Back link</li>' +
            '<li>Replay this tour with the 🧭 button</li></ul>'
    }
  ]
};
