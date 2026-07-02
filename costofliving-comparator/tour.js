/* Guided-tour config for the Cost of Living Comparator.
   The shared engine (../tour-shared.js) reads this object. */
window.__TOUR = {
  seenKey: 'col-tour-v1-seen',
  launchLabel: '🧭 Take a tour',
  steps: [
    {
      target: null,
      title: '👋 Welcome to the Cost of Living Comparator',
      body: 'This quick tour shows you how to compare the cost of living between two ' +
            'cities and see how far your salary really goes before you relocate or ' +
            'negotiate pay. It takes about a minute, and you can skip it any time.'
    },
    {
      target: '#modeCard',
      title: '① Choose what you want to know',
      body: 'Pick <strong>Simple</strong> or <strong>Detailed</strong>, then whether you ' +
            'want to know how much you <strong>can save</strong> or how much you ' +
            '<strong>need to earn</strong> to keep the same lifestyle. You can also ' +
            'include or exclude housing, handy when rent is covered by an employer.'
    },
    {
      target: '#simpleCityCard',
      onEnter: function () {
        // The two-city card only exists in Simple mode; make sure we are in it
        // so the spotlight lands on real content rather than a hidden element.
        var seg = document.querySelector('#modeGroup .seg-btn[data-val="simple"]');
        if (seg) seg.click();
      },
      title: '② Pick your two cities',
      body: 'Choose a <strong>From</strong> city and a <strong>To</strong> city from ' +
            '500+ locations, for example <strong>Jakarta to Perth</strong> or ' +
            '<strong>Bangkok to Singapore</strong>. Different currencies are converted ' +
            'automatically so the comparison stays fair.'
    },
    {
      target: '#analysisArea',
      title: '③ Read your results',
      body: 'The comparison updates instantly: the equivalent salary that preserves your ' +
            'standard of living, where your money stretches furthest, and how much of ' +
            'your income is left over. Perfect for relocation planning, a pay ' +
            'negotiation, or a geoarbitrage decision.'
    },
    {
      target: null,
      title: '✅ You are all set',
      body: 'That is the whole workflow. Everything runs privately in your browser, free, ' +
            'with no account. Replay this tour any time via ' +
            '<strong>Take a tour</strong> in the header.'
    }
  ]
};
