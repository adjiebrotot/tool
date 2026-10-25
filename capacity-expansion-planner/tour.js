/* Guided-tour config for the Capacity Expansion Planner.
   The shared engine (../tour-shared.js) reads this object.

   The tour never edits the plan, so it has nothing to save or restore beyond
   the tab, which the engine handles. The steps on the results solve a plan
   that changed since its last run first (window.__CX_TOUR, in script.js), so
   they never point at faded or empty figures. */
function cxTab(name) {
  var tab = document.querySelector('.ctrl-tab[data-tab="' + name + '"]');
  if (tab && !tab.classList.contains('active')) tab.click();
}
function cxResults() {
  if (window.__CX_TOUR) window.__CX_TOUR.ensureResults();
}
window.__TOUR = {
  seenKey: 'capacityexpansion-planner-tour-v2-seen',
  launchLabel: '🧭 Tour',
  guide: 'guides/',
  steps: [
    {
      target: null,
      title: '👋 Welcome to the Capacity Expansion Planner',
      body: 'Find which plants and batteries to build, how big, and <strong>in which year</strong>, to meet a growing demand at the least cost. About a minute.'
    },
    {
      target: '.quick-start-row',
      title: '① Start from an example',
      body: 'One click loads a worked plan and solves it:' +
            '<ul><li>A growing grid, net zero</li>' +
            '<li>A coal exit, an island</li>' +
            '<li>Save or open your own from the same row</li></ul>'
    },
    {
      target: ['.ctrl-tabs', '#tab-plan'],
      onEnter: function () { cxTab('plan'); },
      title: '② Demand',
      body: '<ul><li>The <strong>peak</strong> now and how fast it grows</li>' +
            '<li>The climate, then the load profile: drag its bars, add daily variability, or open your own file, of typical days or a full year</li>' +
            '<li>The years to plan, and how often to decide</li></ul>'
    },
    {
      target: ['.ctrl-tabs', '#tab-tech'],
      onEnter: function () { cxTab('tech'); },
      title: '③ Supply',
      body: '<ul><li>What is in service and when it <strong>retires</strong></li>' +
            '<li>What can be built, at what cost</li>' +
            '<li>Solar and wind: the climate’s profile or your own file</li>' +
            '<li>Detailed for lifetimes, limits and unit sizes</li></ul>'
    },
    {
      target: ['.ctrl-tabs', '#tab-policy'],
      onEnter: function () { cxTab('policy'); },
      title: '④ Policy',
      body: 'Load shedding and its value, a <strong>carbon price</strong> and a net-zero year.'
    },
    {
      target: ['.ctrl-tabs', '#tab-assume'],
      onEnter: function () { cxTab('assume'); },
      title: '⑤ Assumptions',
      body: 'The discount rate, real or nominal with inflation, the solver, and the <strong>typical days</strong> each year is run over, which follow the profiles.'
    },
    {
      target: '#runBtn',
      title: '⑥ Run',
      body: 'Press <strong>Run plan</strong> (Ctrl+Enter) after a change. Until you do, the last result stays, faded.'
    },
    {
      target: '#verdict',
      onEnter: cxResults,
      title: '⑦ The answer',
      body: 'What to build first and when, and what the whole plan costs: at the prices of its <strong>First year</strong>, with every year discounted back to it.'
    },
    {
      target: '#capCard',
      onEnter: cxResults,
      title: '⑧ The charts',
      body: '<ul><li>Capacity and <strong>when to build</strong>, energy and cost, year by year</li>' +
            '<li>Decision years in <strong>bold</strong>; each stands for the years up to the next</li>' +
            '<li>Click a year to open its typical days, hour by hour</li></ul>'
    },
    {
      target: '#tablesCard',
      onEnter: cxResults,
      title: '⑨ Results by year',
      body: '<ul><li>Opens from its chevron</li>' +
            '<li>Capacity, New build, Energy, Costs and Years, each with <strong>⬇ CSV</strong></li></ul>'
    },
    {
      target: null,
      title: '✅ You are all set',
      body: '<ul><li>Change anything over the example, or load another</li>' +
            '<li>Everything runs in your browser</li>' +
            '<li>Replay this tour with the 🧭 button</li></ul>'
    }
  ]
};
