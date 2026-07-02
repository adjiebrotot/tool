/* Guided-tour config for the Cost of Living Comparator.
   The shared engine (../tour-shared.js) reads this object.

   Each step that spotlights a result panel first seeds a realistic
   Jakarta → Perth example via window.__COL_TOUR (defined in script.js),
   so the tour always highlights populated content, never an empty
   "select a city" placeholder. Seeding leaves any existing user input
   untouched — demo values only fill in when the fields are blank. */
function colSeedSimple(){
  if (window.__COL_TOUR) window.__COL_TOUR.seedSimple();
}
function colSeedDetailed(){
  if (window.__COL_TOUR) window.__COL_TOUR.seedDetailed();
}
window.__TOUR = {
  seenKey: 'col-tour-v1-seen',
  launchLabel: '🧭 Take a tour',
  steps: [
    {
      target: null,
      title: '👋 Welcome to the Cost of Living Comparator',
      body: 'This quick tour shows you how to compare the cost of living between two ' +
            'cities and see how far your salary really goes before you relocate or ' +
            'negotiate pay. We will use a <strong>Jakarta → Perth</strong> example as we ' +
            'go. It takes about a minute, and you can skip it any time.'
    },
    {
      target: '#modeCard',
      onEnter: colSeedSimple,
      title: '① Choose what you want to know',
      body: 'Pick <strong>Simple</strong> or <strong>Detailed</strong>, then whether you ' +
            'want to know how much you <strong>can save</strong> or how much you ' +
            '<strong>need to earn</strong> to keep the same lifestyle. You can also ' +
            'include or exclude housing, handy when rent is covered by an employer.'
    },
    {
      target: '#simpleCityCard',
      onEnter: colSeedSimple,
      title: '② Pick your two cities',
      body: 'Choose a <strong>From</strong> city and a <strong>To</strong> city from ' +
            '500+ locations — here we have loaded <strong>Jakarta → Perth</strong>. ' +
            'Different currencies are converted automatically so the comparison stays fair.'
    },
    {
      target: '#analysisArea',
      onEnter: colSeedSimple,
      title: '③ Read your results',
      body: 'The comparison updates instantly: the equivalent salary that preserves your ' +
            'standard of living, where your money stretches furthest, and how much of ' +
            'your income is left over. Perfect for relocation planning, a pay ' +
            'negotiation, or a geoarbitrage decision.'
    },
    {
      target: '#analysisArea',
      onEnter: colSeedDetailed,
      title: '④ Go line-by-line with Detailed mode',
      body: 'Switch to <strong>Detailed</strong> for a full breakdown: add as many ' +
            'destination cities as you like and split spending into <strong>rent, ' +
            'groceries, eating out, utilities</strong> and more. Every category is ' +
            'estimated across cities from its own index, and you can override any figure. ' +
            'The same Jakarta → Perth example is now shown category by category.'
    },
    {
      target: null,
      title: '✅ You are all set',
      body: 'That is the whole workflow. The example stays loaded so you can tweak the ' +
            'numbers and cities to your own situation. Everything runs privately in your ' +
            'browser, free, with no account. Replay this tour any time via ' +
            '<strong>Take a tour</strong> in the header.'
    }
  ]
};
