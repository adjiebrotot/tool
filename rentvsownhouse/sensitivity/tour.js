/* Guided-tour config for the Rent vs Own Sensitivity Analysis Tool.
   The shared engine (../../tour-shared.js) reads this object. */
window.__TOUR = {
  seenKey: 'rvos-tour-v2-seen',
  launchLabel: '🧭 Take a tour',
  steps: [
    {
      target: null,
      title: '👋 Welcome to the Rent vs Own Sensitivity Tool',
      body: 'This quick tour shows how to compare <strong>many rent versus buy ' +
            'scenarios side by side</strong> and see how the outcome shifts as prices, ' +
            'rents, and rates change. It takes about a minute.'
    },
    {
      // The grid is far taller than the viewport, so spotlighting all of it
      // left nothing dimmed and read as no highlight at all. The header row
      // is what the step is about: one column per scenario, plus Add.
      target: '#tableWrap thead',
      title: '① Each column is a scenario',
      body: 'Add a column for every case you want to test, for example different ' +
            'deposits, mortgage rates, or cities. Edit any assumption inline and the whole ' +
            'table recalculates instantly. Each field shows its unit, and a figure past a ' +
            'row\'s limits is pulled back to it. The <strong>⚡</strong> picker on the first ' +
            'column searches every Quick Start city and home and fills the column with one; ' +
            'drag a column right to load another.'
    },
    {
      // The step names both controls, so highlight both: the year box sits
      // in its own row beside the metric buttons.
      target: ['#metricGroup', '#yearInput'],
      title: '② Choose the metric and year',
      body: 'Compare on <strong>Net equity</strong>, <strong>Liquid cash</strong> or ' +
            '<strong>Accumulated cost</strong>, and set the <strong>year</strong> to ' +
            'evaluate at. <strong>Own minus rent</strong> at the bottom takes the colour of ' +
            'whichever comes out ahead: blue for owning, gold for renting.'
    },
    {
      target: '.csv-actions',
      title: '③ Compare, export, and reload',
      body: 'Use <strong>Compare</strong> to chart every scenario together, download the ' +
            'grid as CSV, or upload a saved CSV to rebuild your scenarios later. ' +
            'Everything runs privately in your browser.'
    },
    {
      target: null,
      title: '✅ You are all set',
      body: 'That is the workflow. Need the detailed single-case view instead? Use the ' +
            'main <strong>Rent vs Own</strong> tool via the Back link. Replay this tour ' +
            'any time via the <strong>🧭</strong> button.'
    }
  ]
};
