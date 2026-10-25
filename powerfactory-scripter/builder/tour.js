/* Guided tour of the PowerFactory Workflow Builder (DESIGN 8). The shared engine
   (../../tour-shared.js) reads window.__TOUR.

   The tour fills the canvas with a worked example: the Headroom study template when the
   templates are there, otherwise a small built-in demo made only of blocks this version has.
   The reader's own workflow is given back when the tour ends, however it ends (saveState /
   restoreState). The editor (js/ui/main.js, a module) may still be starting when the tour
   opens, so every step reaches it through window.PFB when it is there and waits for it
   otherwise; the snapshot of the reader's work is taken before anything is loaded, at the
   latest just before the demo replaces it.

   Steps whose words depend on what is on screen (the golden rule of tour-shared.js) give
   `target` and `body` as getters, read after onEnter has run (the engine reads `target`
   again on every look-up, so a step can point at the example while it is still loading). */
(function () {
  'use strict';

  // The built-in demo: a dispatch sweep with a load flow and an RMS run. Only blocks of the
  // first wave, so it loads whatever else is missing. Settings not given take their defaults.
  var DEMO = {
    app: 'pf-builder', v: 1, name: 'Headroom study (demo)',
    nodes: [
      { id: 'n1', type: 'start', x: 0, y: 160, label: '', s: {} },
      { id: 'n2', type: 'flow.range', x: 320, y: 160, label: 'Dispatch (MW)', s: { from: 100, to: 300, step: 50 } },
      { id: 'n3', type: 'pf.dispatch', x: 640, y: 32, label: 'Generator A', s: { gen: { cls: 'ElmSym', name: 'G 02', match: 'one' } } },
      { id: 'n4', type: 'pf.ldf', x: 960, y: 32, label: '', s: {} },
      { id: 'n5', type: 'pf.evt.trip', x: 1280, y: 32, label: 'Trip G 03', s: { el: { cls: 'ElmSym', name: 'G 03', match: 'one' }, t: 1 } },
      { id: 'n6', type: 'pf.rms', x: 1600, y: 32, label: '', s: { tstop: 20, record: [{ id: 'r1', cls: 'ElmTerm', name: 'Bus 5', var: 'm:fehz', combine: 'none' }] } },
      { id: 'n7', type: 'flow.log', x: 1920, y: 32, label: '', s: { text: 'Dispatch {mw} MW: the run reached {t} s' } },
      { id: 'n8', type: 'flow.log', x: 640, y: 400, label: 'All passes done', s: { text: 'Every dispatch level has been run.' } }
    ],
    edges: [
      { id: 'e1', from: 'n1', out: 'next', to: 'n2', in: 'in' },
      { id: 'e2', from: 'n2', out: 'body', to: 'n3', in: 'in' },
      { id: 'e3', from: 'n2', out: 'value', to: 'n3', in: 'p' },
      { id: 'e4', from: 'n3', out: 'next', to: 'n4', in: 'in' },
      { id: 'e5', from: 'n4', out: 'ok', to: 'n5', in: 'in' },
      { id: 'e6', from: 'n5', out: 'next', to: 'n6', in: 'in' },
      { id: 'e7', from: 'n6', out: 'ok', to: 'n7', in: 'in' },
      { id: 'e8', from: 'n2', out: 'value', to: 'n7', in: 'mw' },
      { id: 'e9', from: 'n6', out: 't_end', to: 'n7', in: 't' },
      { id: 'e10', from: 'n2', out: 'done', to: 'n8', in: 'in' }
    ],
    view: { x: 0, y: 0, zoom: 1 }
  };
  window.__PFB_DEMO = DEMO;   // for the tests

  var api = function () { return window.PFB && window.PFB.ready ? window.PFB : null; };
  // Run fn now when the editor is up, else as soon as it says it is.
  function whenReady(fn) {
    var p = api();
    if (p) { try { fn(p); } catch (e) { /* non-fatal to the tour */ } return; }
    window.addEventListener('pfb:ready', function once(ev) {
      window.removeEventListener('pfb:ready', once);
      try { fn(ev.detail); } catch (e) { /* non-fatal */ }
    });
  }

  // The reader's work: taken once per tour, before the demo replaces it. `marker` is what
  // saveState hands the engine; restoreState gets it back.
  var marker = null;
  function takeSnapshot(p) {
    if (!marker || marker.taken) return;
    marker.taken = true;
    marker.snap = p.isBlank() ? null : p.snapshot();
  }

  function nodeOf(type) {
    var p = api();
    if (!p) return null;
    var wf = p.store.get().wf;
    for (var i = 0; i < wf.nodes.length; i++) if (wf.nodes[i].type === type) return wf.nodes[i];
    return null;
  }
  function nodeSel(type, inner) {
    var n = nodeOf(type);
    return n ? '.react-flow__node[data-id="' + n.id + '"]' + (inner ? ' ' + inner : '') : null;
  }

  // The worked example arrives asynchronously (the template is fetched), so the steps that
  // point into it wait for demoP, and their targets name nothing (NOT_YET: the engine keeps
  // looking) until it is on the canvas, rather than settling on the bare canvas.
  var NOT_YET = '.pfb-tour-not-yet';
  var demoP = null, demoReady = false;
  function loadDemo() {
    if (demoP) return demoP;
    var mk = marker;
    demoP = new Promise(function (resolve) {
      whenReady(function (p) {
        takeSnapshot(p);
        Promise.resolve(p.templatesReady).then(function () {
          // The tour ended while the templates were on their way: leave the reader's work be.
          if (marker !== mk) return false;
          var hasTpl = (p.templates() || []).some(function (t) { return t.id === 'headroom'; });
          if (hasTpl) mk.loaded = true;
          return hasTpl ? p.loadTemplate('headroom', { quiet: true, ask: false }) : false;
        }).catch(function () { return false; }).then(function (ok) {
          if (marker !== mk) return resolve(false);
          mk.loaded = true;
          if (!ok) p.loadWorkflowObject(DEMO, { quiet: true });
          p.select([]);
          // Ready once the view has settled, so the steps measure the blocks where they stay.
          setTimeout(function () {
            p.fitView();
            setTimeout(function () { demoReady = true; resolve(true); }, 320);
          }, 120);
        });
      });
    });
    return demoP;
  }
  // Inside the example: the target once it is loaded (or the canvas when the block is missing).
  function inDemo(sel) { return demoReady ? (sel || '#pfbCanvas') : NOT_YET; }
  // The main chain of the example, spotlighted together on the step that introduces it. A
  // workflow wider than the screen shows its left end (canvas.fitView), so only the blocks in
  // the free part of the canvas count: not those behind the Settings panel or off screen.
  function chainTarget() {
    if (!demoReady) return NOT_YET;
    var side = document.getElementById('pfbSide');
    var sr = side && side.getBoundingClientRect();
    var limit = sr && sr.width && sr.left > window.innerWidth / 2 ? sr.left : window.innerWidth;
    var list = ['start', 'flow.range', 'pf.dispatch', 'pf.ldf', 'pf.evt.trip', 'pf.rms']
      .map(function (t) { return nodeSel(t); }).filter(function (sel) {
        var el = sel && document.querySelector(sel);
        return el && el.getBoundingClientRect().right <= limit;
      });
    return list.length ? list : '#pfbCanvas';
  }
  // Select (and with `tab`, open the settings of) the first of `types` the example has.
  function focus(types, tab) {
    loadDemo().then(function () {
      var p = api(), n = null;
      [].concat(types).some(function (t) { return (n = nodeOf(t)); });
      if (p && n) { p.focusNode(n.id); if (tab) p.openSettings(n.id); }
    });
  }
  function hasBlock(type) {
    var p = api();
    return !!(p && p.registry.getBlock(type));
  }
  function phone() { var p = api(); return !!(p && p.isPhone()); }
  function starterShown() { return !!document.querySelector('.pfb-starter:not([hidden]) .pfb-starter-card'); }

  window.__TOUR = {
    seenKey: 'pf-builder-tour-v1-seen',
    launchLabel: '🧭 Take a tour',
    // Opened from a link to a Quick start (#qs=, js/ui/templates.js): show that example, and
    // leave the tour for the next visit (its demo would load over the example).
    holdFirstVisit: function () { return !!window.__PFB_QS || /(?:^#|&)qs=/.test(location.hash); },
    saveState: function () {
      marker = { taken: false, loaded: false, snap: null };
      demoP = null; demoReady = false;
      var p = api();
      if (p) takeSnapshot(p);
      return marker;
    },
    restoreState: function (m) {
      var mk = m || marker;
      var pending = demoP;
      marker = null;
      demoP = null; demoReady = false;
      if (!mk || !mk.loaded) return;         // nothing was loaded over the reader's work
      // An example still loading checks `marker` and stops; one already in is replaced here.
      Promise.resolve(pending).then(function () {
        whenReady(function (p) {
          if (mk.snap) p.restore(mk.snap);
          p.select([]);
          p.openTab('settings');
          if (p.isPhone()) { p.setPalette(false); p.setSheet(false); }
        });
      });
    },
    // The flow: how a workflow starts, then a worked example read block by block (its
    // project, an element, where a pass ends, its checks), then how to build one's own
    // (the Blocks panel), what is left to fill in, and the download.
    // The welcome card is centred, as in the parent's tour: a spotlight here would scroll the
    // page the moment the tour opens on a first visit (closing any list the reader just opened).
    steps: [
      {
        target: null,
        title: '👋 Welcome to the Workflow Builder',
        body: 'Wire <strong>blocks</strong> into a workflow and get <strong>one ready-to-run Python file</strong> for PowerFactory 2024. About a minute.'
      },
      {
        get target() {
          if (starterShown()) return '.pfb-starter:not([hidden]) .pfb-starter-card';
          if (document.querySelector('.pfb-starter-tpl')) return '#pfbQsBtn';
          return '#pfbCanvas';
        },
        title: 'Start here',
        get body() {
          var tpl = !!document.querySelector('.pfb-starter-tpl');
          var lead = starterShown()
            ? (tpl ? 'Open a <strong>worked example</strong>, or <strong>Start blank</strong> and add blocks. '
                   : '<strong>Start blank</strong> and add blocks. ')
            : (tpl ? '<strong>Quick start</strong> opens a worked example in place of the canvas. ' : '');
          var p = api(), own = p && !p.isBlank();
          return lead + 'Every workflow begins at the <strong>Start</strong> block, which is always on the canvas. ' +
                 'Next, the tour opens an example for you' + (own ? '; your own workflow comes back when it ends.' : '.');
        }
      },
      {
        get target() { return chainTarget(); },
        onEnter: function () {
          whenReady(function (p) { if (p.isPhone()) { p.setPalette(false); p.setSheet(false); } p.select([]); });
          loadDemo();
        },
        title: 'A worked example',
        body: 'A <strong>headroom study</strong>, read left to right: for each dispatch of Generator A, run a load flow, trip a unit and run an RMS simulation.' +
              '<ul><li><strong>Thick wires</strong>: then do this</li><li><strong>Thin wires</strong>: use this value</li></ul>'
      },
      {
        get target() { return phone() ? '#pfbSide' : inDemo('#pfbInspector [data-key="project"]'); },
        onEnter: function () { focus('start', true); },
        title: 'Start: your project',
        body: 'Select a block to see its <strong>settings</strong> here. On Start, type the <strong>project</strong> name exactly as in PowerFactory; the rest can stay as it is.'
      },
      {
        get target() { return phone() ? '#pfbSide' : inDemo('#pfbInspector .pfb-elpick'); },
        onEnter: function () { focus('pf.dispatch', true); },
        title: 'The element picker',
        body: 'Pick the <strong>kind of element</strong>, then its name exactly as in the Data Manager, e.g. <code>G 02</code>. Its power comes in on the wire from Dispatch (MW).'
      },
      {
        get target() { return inDemo(nodeSel('pf.ldf', '.pfb-end') || nodeSel('pf.ldf')); },
        onEnter: function () {
          whenReady(function (p) { if (p.isPhone()) p.setSheet(false); });
          focus('pf.ldf', false);
        },
        title: 'Where a wire stops',
        body: '<strong>Did not converge</strong> is not wired, so that pass ends there: the caption says it <strong>skips to the next pass</strong> of Dispatch (MW). No extra blocks needed.'
      },
      {
        get target() { return inDemo(nodeSel('sig.nadir') || nodeSel('pf.rms')); },
        onEnter: function () { focus(['sig.nadir', 'pf.rms'], false); },
        title: 'Curves and checks',
        get body() {
          if (nodeOf('sig.nadir')) return '<strong>Frequency nadir</strong> reads the frequency the RMS run recorded and gives the lowest value, its time and a verdict for the results table.';
          return 'Run RMS simulation <strong>records</strong> Bus 5 frequency: each Record row becomes a time series output' +
                 (hasBlock('sig.nadir') ? ' for checks such as <strong>Frequency nadir</strong>.' : ' that other blocks can use.');
        }
      },
      {
        target: '#pfbPalette',
        onEnter: function () { whenReady(function (p) { p.select([]); if (p.isPhone()) { p.setSheet(false); p.setPalette(true); } }); },
        title: 'Build your own',
        body: 'The <strong>Blocks</strong> panel has every step a workflow can take.' +
              '<ul><li><strong>Click</strong> a block: it joins the end of the flow, wired</li>' +
              '<li>Or <strong>drag</strong> it onto the canvas, or onto a wire to put it between two steps</li></ul>'
      },
      {
        get target() { return document.querySelector('#pfbProblems .pfb-prob') ? '#pfbProblems .pfb-prob' : '#pfbSide'; },
        onEnter: function () { whenReady(function (p) { p.select([]); p.openTab('problems'); if (p.isPhone()) { p.setPalette(false); p.setSheet(true); } }); },
        title: 'Problems and to-dos',
        body: 'Fields still to fill in show here as <strong>to do</strong>, mistakes as errors. Click one to go to its block.'
      },
      {
        target: '#pfbDownload',
        onEnter: function () { whenReady(function (p) { p.openTab('python'); if (p.isPhone()) p.setSheet(false); }); },
        title: 'Download the study',
        body: 'The <strong>Python</strong> tab shows the script as you build. <strong>⬇ Download</strong> saves the whole study (the script, the workflow and any data file you attached) as one .zip; Open reads a saved workflow back later.'
      }
    ]
  };
})();
