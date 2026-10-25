/* Guided-tour config for PowerFactory Scripter.
   The shared engine (../tour-shared.js) reads this object. v2 trims every
   step to a lead line and a short list. */
window.__TOUR = {
  seenKey: 'pf-tour-v2-seen',
  launchLabel: '🧭 Tour',
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
      body: 'Fill in a form, get a ready-to-run <strong>PowerFactory Python script</strong>. ' +
            'About a minute.'
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
      title: '⚡ Quick Start',
      body: 'One-click worked examples. We just loaded <strong>Transmission Loss ' +
            'Factor</strong>: a generator dispatch sweep on the IEEE 9-bus system.'
    },
    {
      target: '#sec-init',
      title: '① Initialisation',
      body: '<ul><li><strong>Problem type</strong>: here Brute Force, so every input ' +
            'combination runs</li>' +
            '<li>Study type: here Steady State (a load flow)</li>' +
            '<li>Also your API path, username and output folder</li></ul>'
    },
    {
      target: '#sec-inputs',
      title: '② Input Variables',
      body: 'What changes each run. Here: <code>G2</code> and <code>G3</code> dispatch ' +
            '(<code>pgini</code>) over a range.'
    },
    {
      target: '#sec-outputs',
      title: '③ Output Variables',
      body: 'What is read back after each run. Here: <code>G1</code> dispatch and two ' +
            'line flows, which give the loss factors.'
    },
    {
      target: '.right-toolbar .btn-primary',
      title: '④ Generate',
      body: 'Press <strong>Generate Code</strong>, then copy the script or download the ' +
            '<code>.py</code>. Nothing is uploaded.'
    },
    {
      target: null,
      title: '✅ You are all set',
      body: '<ul><li>More examples: the other Quick Starts and the ' +
            '<strong>Samples &amp; Guides</strong> page</li>' +
            '<li>Replay this tour with the 🧭 button</li></ul>'
    }
  ]
};
