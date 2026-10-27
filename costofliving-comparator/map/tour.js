/* Guided-tour config for the Cost of Living Map.
   The shared engine (../../tour-shared.js) reads this object.

   The steps narrate the Perth Quick Start, so every step that points at the
   form or a result loads it first via window.__COLMAP_TOUR (defined in
   script.js), and the reader's own plan comes back when the tour ends. */
function colmapSeed(){
  if (window.__COLMAP_TOUR) window.__COLMAP_TOUR.seed();
}
window.__TOUR = {
  seenKey: 'colmap-tour-v1-seen',
  launchLabel: '🧭 Tour',
  guide: '../guides/#map',
  saveState: function () {
    return window.__COLMAP_TOUR ? window.__COLMAP_TOUR.saveState() : null;
  },
  restoreState: function (snap) {
    if (window.__COLMAP_TOUR) window.__COLMAP_TOUR.restoreState(snap);
  },
  steps: [
    {
      target: null,
      title: '👋 Welcome to the Cost of Living Map',
      body: 'Every city on one map: what it takes to keep <strong>your lifestyle</strong> there. ' +
            'We will use Perth on AUD 6,500 a month as the example. About a minute.'
    },
    {
      target: '.quick-start-row',
      onEnter: colmapSeed,
      title: '① Start from an example',
      body: '<ul><li>One click fills a single professional’s month in six cities</li>' +
            '<li><strong>Perth</strong> is loaded now</li>' +
            '<li>Save or open your own plan from the same row</li></ul>'
    },
    {
      target: '#youGroup',
      onEnter: colmapSeed,
      title: '② You',
      body: '<ul><li><strong>Your city</strong>: every other city is compared with it</li>' +
            '<li>Figures lead with its currency</li>' +
            '<li>Net salary is take-home pay, a month</li></ul>'
    },
    {
      target: '#compareGroup',
      onEnter: colmapSeed,
      title: '③ Compare by',
      body: '<ul><li><strong>Required</strong>: the salary each city needs</li>' +
            '<li>Global: your own salary everywhere</li>' +
            '<li>Scaled: the same multiple of local pay</li>' +
            '<li>Target: keep your savings ratio or amount</li></ul>'
    },
    {
      target: '#lifestyleGroup',
      onEnter: colmapSeed,
      title: '④ Your lifestyle',
      body: '<ul><li>Simple: one living cost, housing in or out</li>' +
            '<li><strong>Detailed</strong>: a row per category, each scaled by its own index</li></ul>'
    },
    {
      target: '#mapCard',
      onEnter: colmapSeed,
      title: '⑤ Read the map',
      body: '<ul><li>Colour shows cheaper or dearer than your city</li>' +
            '<li><strong>View</strong> picks the figure each city shows</li>' +
            '<li>Hover or tap a city for its figures</li></ul>'
    },
    {
      target: '.map-zoom',
      onEnter: colmapSeed,
      title: '⑥ Move around',
      body: '<ul><li>Drag, scroll or pinch; + and − zoom</li>' +
            '<li>Back to your city, or the whole world</li>' +
            '<li>The funnel shows <strong>major cities</strong> only; ⤢ fills the screen</li></ul>'
    },
    {
      target: '#metrics',
      onEnter: colmapSeed,
      title: '⑦ The headline',
      body: 'Your city, the cheapest and dearest, and how many cities cost less than yours.'
    },
    {
      target: '#tableCard',
      onEnter: colmapSeed,
      title: '⑧ Every city',
      body: '<ul><li>Opens from its chevron</li>' +
            '<li>Find a city or country; click a row to fly to it</li>' +
            '<li><strong>⬇ CSV</strong> downloads the lot</li></ul>'
    },
    {
      target: null,
      title: '✅ You are all set',
      body: '<ul><li>Swap in your own city and salary over the example</li>' +
            '<li>Everything stays in your browser</li>' +
            '<li>Replay this tour with the 🧭 button</li></ul>'
    }
  ]
};
