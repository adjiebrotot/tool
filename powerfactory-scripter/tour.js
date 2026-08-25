/* Guided-tour config for PowerFactory Scripter.
   The shared engine (../tour-shared.js) reads this object. */
window.__TOUR = {
  seenKey: 'pf-tour-v1-seen',
  launchLabel: '🧭 Take a tour',
  // Step ⚡ loads the worked example over the form, so give the user their
  // own configuration back when the tour ends, however it ends.
  saveState: function () {
    return window.__PF_TOUR ? window.__PF_TOUR.saveState() : null;
  },
  restoreState: function (cfg) {
    if (window.__PF_TOUR) window.__PF_TOUR.restoreState(cfg);
  },
  steps: [
    {
      target: null,
      title: '👋 Welcome to PowerFactory Scripter',
      body: 'This quick tour walks you through building a PowerFactory ' +
            'automation script using the <strong>Transmission Loss Factor</strong> ' +
            'worked example. It takes about a minute, and you can skip it any time.'
    },
    {
      target: '.quick-start-row',
      onEnter: function () {
        // Load the worked example so the form below fills in as the tour runs.
        // Returns a promise; a failure here is non-fatal to the tour.
        if (typeof window.applyQuickStart === 'function') {
          Promise.resolve(window.applyQuickStart('sample-01-transmission-loss-factor'))
            .catch(function () {});
        }
      },
      title: '⚡ Quick Start examples',
      body: 'These one-click presets load complete worked examples. ' +
            'We\'ve just loaded the <strong>Transmission Loss Factor</strong> ' +
            'case for you: a brute-force sweep of generator dispatch on the ' +
            'IEEE 9-bus system. Watch the form below fill in.'
    },
    {
      target: '#sec-init',
      title: '① Initialisation',
      body: 'The example uses <strong>Brute Force</strong> as the problem type and ' +
            '<strong>Steady State</strong> as the study type, so every combination of ' +
            'inputs is run through a load flow. Here you also set the PowerFactory ' +
            'API path, username and output directory.'
    },
    {
      target: '#sec-inputs',
      title: '② Input Variables',
      body: 'These are the parameters swept each run. The sample sweeps ' +
            '<code>G2.ElmSym</code> and <code>G3.ElmSym</code> dispatch ' +
            '(<code>pgini</code>) across a range, and every combination is simulated.'
    },
    {
      target: '#sec-outputs',
      title: '③ Output Variables',
      body: 'Results read back after each run. The sample records three: the ' +
            '<code>G1</code> slack dispatch, plus <code>Line 5-7</code> and ' +
            '<code>Line 7-8</code> active power (all <code>m:P:bus1</code>), which ' +
            'together give you the transmission loss factors.'
    },
    {
      target: '.right-toolbar .btn-primary',
      title: '④ Generate the script',
      body: 'When the form is configured, click <strong>Generate Code</strong>. ' +
            'The Python script appears in the preview. Copy it or download the ' +
            '<code>.py</code> file. Everything runs locally; nothing is uploaded.'
    },
    {
      target: null,
      title: '✅ You\'re all set',
      body: 'That\'s the workflow. Try the other Quick Start examples, or browse ' +
            'the <strong>Samples &amp; Guides</strong> page for more. You can replay ' +
            'this tour any time via <strong>Take a tour</strong> in the header.'
    }
  ]
};
