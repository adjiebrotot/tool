/* Guided-tour config for the Cost of Living Comparator.
   The shared engine (../tour-shared.js) reads this object.

   Each step that spotlights a result panel first seeds the Jakarta to
   Perth example via window.__COL_TOUR (defined in script.js), so the
   tour always highlights populated content, never an empty "select a
   city" placeholder. The steps below name those two cities out loud, so
   the seed always applies: whatever was on screen before is replaced,
   and the tour never describes one pair of cities while showing
   another. v3 trims every step to a lead line and a short list. */
function colSeedSimple(){
  if (window.__COL_TOUR) window.__COL_TOUR.seedSimple();
}
function colSeedDetailed(){
  if (window.__COL_TOUR) window.__COL_TOUR.seedDetailed();
}
window.__TOUR = {
  seenKey: 'col-tour-v3-seen',
  launchLabel: '🧭 Take a tour',
  // The steps overwrite the comparison on screen, so hand back whatever the
  // user had when the tour ends, however it ends.
  saveState: function () {
    return window.__COL_TOUR ? window.__COL_TOUR.saveState() : null;
  },
  restoreState: function (snap) {
    if (window.__COL_TOUR) window.__COL_TOUR.restoreState(snap);
  },
  steps: [
    {
      target: null,
      title: '👋 Welcome to the Cost of Living Comparator',
      body: 'See how far your salary goes in <strong>another city</strong>. We will use ' +
            'Jakarta \u2192 Perth as the example. About a minute.'
    },
    {
      target: '#modeCard',
      onEnter: colSeedSimple,
      title: '① Choose the question',
      body: '<ul><li><strong>Detail</strong>: Simple or Detailed</li>' +
            '<li>How much you <strong>can save</strong>, or how much you ' +
            '<strong>need to earn</strong></li>' +
            '<li>Include housing or leave it out</li></ul>'
    },
    {
      target: '#simpleCityCard',
      onEnter: colSeedSimple,
      title: '② Pick two cities',
      body: '<ul><li>A <strong>From</strong> and a <strong>To</strong> city, from 500+</li>' +
            '<li>Currencies convert automatically</li></ul>'
    },
    {
      target: '#analysisArea',
      onEnter: colSeedSimple,
      title: '③ Read the result',
      body: '<ul><li>The sentence on top is the answer: the saving gap, or the salary needed</li>' +
            '<li>Both cities follow side by side, per month</li>' +
            '<li>What this assumes opens from its chevron</li></ul>'
    },
    {
      target: '#analysisArea',
      onEnter: colSeedDetailed,
      title: '④ Detailed mode',
      body: 'The same example, category by category:' +
            '<ul><li>Add more destination cities</li>' +
            '<li>Split spending into rent, groceries, utilities and more; override any figure</li>' +
            '<li>At a custom frequency: enter a row per week, year, meal or trip</li></ul>'
    },
    {
      target: null,
      title: '✅ You are all set',
      body: '<ul><li>Swap in your own cities over the example</li>' +
            '<li>Everything stays in your browser</li>' +
            '<li>Replay this tour with the 🧭 button</li></ul>'
    }
  ]
};
