/* ED/UC Simulator: the page.

   ed-core.js holds the model and the bridge to PSA.js, ed-draw.js draws the
   diagram at an hour, ed-editor.js handles the pointer and the keyboard on
   it, ed-charts.js draws the charts under it, and ed-worker.js runs the
   optimisation off the main thread. This file ties them to the page: the
   inspector, the Run gate, the hour, the results, the mini cache, Share and
   the exports. It follows the Load Flow Simulator's script.js. */
(function(){
  'use strict';
  var ED = window.ED;
  var $ = function(id){ return document.getElementById(id); };
  var EMBED = !!(window.SharedShare && window.SharedShare.embedded);
  var svg = $('sldSvg'), stage = $('sldStage');

  var app = window.EDApp = {
    model: ED.load(ED.PRESETS[ED.PRESET_DEFAULT].model),
    res: null,           // the last results, kept (dimmed) while the network changes
    solvedKey: null,     // what those results were solved for
    L: null, scene: null,
    sel: new Set(),
    view: null,          // the visible part of the diagram, in diagram px
    readOnly: EMBED,
    svg: svg, stage: stage
  };

  /* ── The engine: a module worker, or this page when a worker cannot run ── */
  var worker = null, workerDead = false, reqId = 0, pending = {};
  var mainP = null;
  function mainEngine(){
    if(!mainP){
      mainP = import('./engine/psa-opt.min.js');
      mainP.catch(function(){ mainP = null; });
    }
    return mainP;
  }
  function viaMain(msg){
    return mainEngine().then(function(psa){
      if(msg.init) return { types: psa.stdTypes() };
      return ED.solve(psa, ED.load(msg.model), msg.opts).then(function(res){ return { res: res }; });
    });
  }
  function startWorker(){
    if(worker || workerDead) return worker;
    try { worker = new Worker('ed-worker.js', { type: 'module' }); }
    catch(e){ workerDead = true; return null; }
    worker.onmessage = function(e){
      var d = e.data || {}, p = pending[d.id];
      if(!p) return;
      delete pending[d.id];
      if(d.error) p.reject(new Error(d.error)); else p.resolve(d);
    };
    // A browser that cannot run a module worker says so here: everything waiting
    // on it, and everything after, runs on the page instead.
    worker.onerror = function(ev){
      if(ev && ev.preventDefault) ev.preventDefault();
      workerDead = true;
      try { worker.terminate(); } catch(e){}
      worker = null;
      var list = pending; pending = {};
      Object.keys(list).forEach(function(k){ viaMain(list[k].msg).then(list[k].resolve, list[k].reject); });
    };
    return worker;
  }
  function call(msg){
    var w = startWorker();
    if(!w) return viaMain(msg);
    return new Promise(function(resolve, reject){
      var id = ++reqId;
      msg.id = id;
      pending[id] = { resolve: resolve, reject: reject, msg: msg };
      w.postMessage(msg);
    });
  }
  var typesP = null;
  function loadTypes(){
    if(!typesP){
      typesP = call({ init: true }).then(function(d){ ED.setTypes(d.types); renderInspector(); return d.types; });
      typesP.catch(function(){ typesP = null; });
    }
    return typesP;
  }

  /* ── Colours come from the theme's tokens, read once per drawing ── */
  function paint(){
    var cs = getComputedStyle(document.body), cache = {};
    return function(t){ return cache[t] || (cache[t] = cs.getPropertyValue(t).trim() || '#888'); };
  }
  app.paint = paint;

  /* ── Display options: what the diagram shows ── */
  var LABEL_DEFAULTS = {
    Bus: ['name', 'price'],
    Line: ['p', 'load'],
    Transformer: ['name', 'p', 'load'],
    Generator: ['name', 'p'],
    Load: ['name', 'p'],
    StorageUnit: ['name', 'p', 'soc'],
    Link: ['name', 'p']
  };
  var QTY = { name: 'Name', price: 'Price', p: 'P', load: 'Loading', loss: 'Losses', status: 'On or off', cost: 'Marginal cost', soc: 'State of charge' };
  var CLASS_TITLE = { Bus: 'Buses', Line: 'Lines', Transformer: 'Transformers', Generator: 'Generators and grids', Load: 'Loads',
                      StorageUnit: 'Storage', Link: 'HVDC links' };
  function lbId(c, q){ return 'lb_' + c + '_' + q; }
  function buildLabelMatrix(){
    var html = '';
    ED.CLASSES.forEach(function(c){
      html += '<div class="field-group lbl-group" data-c="' + c + '"><div class="group-title">' + CLASS_TITLE[c] + '</div><div class="lbl-chips">';
      ED.LABELS[c].forEach(function(q){
        var on = LABEL_DEFAULTS[c].indexOf(q) >= 0;
        html += '<label class="lbl-chip"><input type="checkbox" id="' + lbId(c, q) + '"' + (on ? ' checked' : '') + '/>' + QTY[q] + '</label>';
      });
      html += '</div></div>';
    });
    $('labelMatrix').innerHTML = html + '<p class="note" id="lblEmpty" hidden>Add elements to the diagram to choose their labels.</p>';
  }
  function syncLabelMatrix(){
    var used = {};
    app.model.el.forEach(function(e){ used[e.c] = 1; });
    Array.prototype.forEach.call(document.querySelectorAll('#labelMatrix .lbl-group'), function(g){ g.hidden = !used[g.getAttribute('data-c')]; });
    var empty = $('lblEmpty');
    if(empty) empty.hidden = Object.keys(used).length > 0;
  }
  function cur(){ var v = $('edCur').value; return typeof v === 'string' ? v : '$'; }
  function hourNow(){
    var H = app.res && app.res.report && app.res.report.ok ? app.res.T : 1;
    var h = parseInt($('edHour').value, 10);
    return isFinite(h) ? Math.max(0, Math.min(H - 1, h)) : 0;
  }
  function display(){
    var labels = {};
    ED.CLASSES.forEach(function(c){
      labels[c] = {};
      ED.LABELS[c].forEach(function(q){ var el = $(lbId(c, q)); labels[c][q] = !!(el && el.checked); });
    });
    return { labels: labels, colourBy: $('colourBy').value, animP: $('animP').checked, hour: hourNow(), cur: cur() };
  }
  function solveOptions(){
    return ED.solveOptions({ mode: $('edMode').value, hours: $('edHours').value, limits: $('edLimits').checked, shed: $('edShed').checked,
                             voll: $('edVoll').value, gap: $('edGap').value, time: $('edTime').value });
  }
  app.display = display;

  /* ── Drawing ── */
  var G = ED.G;
  function hitLayer(){
    var s = '', L = app.L;
    Object.keys(L.br).forEach(function(id){ s += '<path d="' + ED.pathD(L.br[id].pts) + '" fill="none" stroke="none" stroke-width="16" pointer-events="stroke" data-id="' + id + '"/>'; });
    Object.keys(L.bus).forEach(function(id){
      var g = L.bus[id], pad = g.node ? 9 : 7;
      s += '<rect x="' + (Math.min(g.x1, g.x2) - pad) + '" y="' + (Math.min(g.y1, g.y2) - pad) + '" width="' + (Math.abs(g.x2 - g.x1) + 2 * pad) + '" height="' + (Math.abs(g.y2 - g.y1) + 2 * pad) + '" fill="none" pointer-events="all" data-id="' + id + '"/>';
    });
    Object.keys(L.dev).forEach(function(id){
      var g = L.dev[id];
      s += '<circle cx="' + g.cx + '" cy="' + g.cy + '" r="17" fill="none" pointer-events="all" data-id="' + id + '"/>';
    });
    return s;
  }
  function shownResults(){ return app.res && app.res.report && app.res.report.ok ? app.res : null; }
  /* The flow arrows outlive a render: a lane keeps its elements, and so its
     running arrows, while its markup is unchanged. */
  var under = null, flow = null, over = null, laneEls = new Map();
  function syncFlow(lanes){
    var next = new Map(), add = [];
    lanes.forEach(function(l){
      var html = ED.laneSvg([l]), key = html;
      while(next.has(key)) key += '+';
      var g = laneEls.get(key);
      if(g){ laneEls.delete(key); next.set(key, g); } else add.push([key, html]);
    });
    laneEls.forEach(function(g){ g.remove(); });
    if(add.length){
      var first = flow.children.length;
      flow.insertAdjacentHTML('beforeend', add.map(function(a){ return a[1]; }).join(''));
      add.forEach(function(a, i){ next.set(a[0], flow.children[first + i]); });
    }
    laneEls = next;
  }
  function render(){
    var d = display();
    var p = paint();
    app.L = ED.layout(app.model);
    var sc = app.scene = ED.draw(app.model, app.L, shownResults(), d, p);
    var C = sc.colours;
    if(!flow){
      svg.innerHTML = '<g></g><g class="lyr-res"><g class="lyr-flow"></g></g><g></g>';
      under = svg.firstChild; flow = svg.querySelector('.lyr-flow'); over = svg.lastChild;
    }
    under.innerHTML =
      '<defs><pattern id="edDots" width="' + G + '" height="' + G + '" patternUnits="userSpaceOnUse"><circle cx="' + G / 2 + '" cy="' + G / 2 + '" r="0.8" fill="' + C.border + '"/></pattern></defs>' +
      (app.readOnly ? '' : '<rect class="ed-grid" x="-100000" y="-100000" width="200000" height="200000" fill="url(#edDots)" pointer-events="none"/>') +
      '<g class="lyr-base">' + sc.base + '</g>';
    syncFlow(sc.lanes);
    over.innerHTML =
      '<g class="lyr-hit">' + hitLayer() + '</g>' +
      '<g class="lyr-lbl">' + ED.labelSvg(sc.labels, C, function(l){ return !l.res; }) + '</g>' +
      '<g class="lyr-res">' + ED.labelSvg(sc.labels, C, function(l){ return l.res; }) + '</g>' +
      '<g class="lyr-ovl"></g><g class="lyr-tmp"></g>';
    svg.classList.toggle('no-p', !d.animP);
    $('gifBtn').hidden = !(shownResults() && d.animP);
    syncLabelMatrix();
    renderOverlay();
    applyView();
    setSig(d);
  }
  app.render = render;
  var rafPending = false;
  app.renderSoon = function(){
    if(rafPending) return;
    rafPending = true;
    requestAnimationFrame(function(){ rafPending = false; render(); });
  };

  // Selection outlines and the handles of a single selected element.
  function renderOverlay(){
    var g = svg.querySelector('.lyr-ovl');
    if(!g) return;
    if(app.readOnly){ g.innerHTML = ''; return; }
    var C = app.scene.colours, s = '', L = app.L;
    var hl = 'fill="none" stroke="' + C.accent + '" stroke-opacity=".38" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"';
    app.sel.forEach(function(id){
      if(L.bus[id]){ var b = L.bus[id]; s += '<path d="M' + b.x1 + ' ' + b.y1 + 'L' + b.x2 + ' ' + b.y2 + '" stroke-width="13" ' + hl + '/>'; }
      else if(L.br[id]) s += '<path d="' + ED.pathD(L.br[id].pts) + '" stroke-width="9" ' + hl + '/>';
      else if(L.dev[id]){ var d = L.dev[id]; s += '<circle cx="' + d.cx + '" cy="' + d.cy + '" r="17" stroke-width="5" ' + hl + '/>'; }
    });
    if(app.sel.size === 1){
      var id = app.sel.values().next().value, H = 'fill="' + C.bg + '" stroke="' + C.accent + '" stroke-width="2"';
      if(L.bus[id]){
        var b = L.bus[id];
        if(!b.node) s += '<rect data-h="end1" x="' + (b.x1 - 5) + '" y="' + (b.y1 - 5) + '" width="10" height="10" rx="2" ' + H + ' style="cursor:' + (b.v ? 'ns' : 'ew') + '-resize"/>';
        if(!b.node) s += '<rect data-h="end2" x="' + (b.x2 - 5) + '" y="' + (b.y2 - 5) + '" width="10" height="10" rx="2" ' + H + ' style="cursor:' + (b.v ? 'ns' : 'ew') + '-resize"/>';
        var kx = b.v ? b.x2 : b.x2 + 20, ky = b.v ? b.y2 + 20 : b.y2;
        s += '<g data-h="knob" style="cursor:crosshair"><title>Drag to another bus to connect</title><circle cx="' + kx + '" cy="' + ky + '" r="8" fill="' + C.accent + '"/>' +
             '<path d="M' + (kx - 4) + ' ' + ky + 'h8M' + kx + ' ' + (ky - 4) + 'v8" stroke="' + C.bg + '" stroke-width="2" stroke-linecap="round"/></g>';
      } else if(L.br[id]){
        var r = L.br[id];
        s += '<circle data-h="p0" cx="' + r.p0.x + '" cy="' + r.p0.y + '" r="5.5" ' + H + ' style="cursor:move"/>';
        s += '<circle data-h="p1" cx="' + r.p1.x + '" cy="' + r.p1.y + '" r="5.5" ' + H + ' style="cursor:move"/>';
        if(r.pts.length === 4){
          var a = r.pts[1], c = r.pts[2], mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2, vert = a[0] === c[0];
          s += '<rect data-h="mid" x="' + (mx - 4.5) + '" y="' + (my - 4.5) + '" width="9" height="9" transform="rotate(45 ' + mx + ' ' + my + ')" ' + H + ' style="cursor:' + (vert ? 'ew' : 'ns') + '-resize"/>';
        }
      }
    }
    g.innerHTML = s;
  }
  app.renderOverlay = renderOverlay;

  /* ── The view: pan and zoom are the SVG's viewBox ── */
  function stageSize(){ return { w: stage.clientWidth || 800, h: stage.clientHeight || 600 }; }
  function applyView(){
    if(!app.view) fit();
    var v = app.view;
    svg.setAttribute('viewBox', v.x + ' ' + v.y + ' ' + v.w + ' ' + v.h);
    var grid = svg.querySelector('.ed-grid');
    if(grid) grid.style.opacity = stageSize().w / v.w < 0.55 ? '0' : '1';
  }
  function fit(){
    var bb = app.scene ? app.scene.bbox : { x: 0, y: 0, w: 800, h: 500 };
    var s = stageSize(), pad = 28;
    var k = Math.min(s.w / (bb.w + 2 * pad), s.h / (bb.h + 2 * pad), 1.5);
    if(!isFinite(k) || k <= 0) k = 1;
    var w = s.w / k, h = s.h / k;
    app.view = { x: bb.x + bb.w / 2 - w / 2, y: bb.y + bb.h / 2 - h / 2, w: w, h: h };
  }
  app.fit = function(){ app.userView = false; fit(); applyView(); };
  app.zoomAt = function(factor, cx, cy){
    app.fitPending = false; app.userView = true;
    var v = app.view, s = stageSize();
    var k = s.w / v.w * factor;
    k = Math.min(4, Math.max(0.15, k));
    var w = s.w / k, h = s.h / k;
    if(cx === undefined){ cx = v.x + v.w / 2; cy = v.y + v.h / 2; }
    var fx = (cx - v.x) / v.w, fy = (cy - v.y) / v.h;
    app.view = { x: cx - fx * w, y: cy - fy * h, w: w, h: h };
    applyView();
  };
  app.panBy = function(dx, dy){ app.fitPending = false; app.userView = true; app.view.x -= dx; app.view.y -= dy; applyView(); };
  app.applyView = applyView;
  if(window.ResizeObserver){
    var lastW = 0;
    new ResizeObserver(function(){
      var s = stageSize();
      if(!app.view || !lastW){ lastW = s.w; return; }
      if(!app.userView){ lastW = s.w; fit(); applyView(); return; }
      var k = lastW / app.view.w;
      var cx = app.view.x + app.view.w / 2, cy = app.view.y + app.view.h / 2;
      app.view = { x: cx - s.w / k / 2, y: cy - s.h / k / 2, w: s.w / k, h: s.h / k };
      lastW = s.w;
      applyView();
    }).observe(stage);
  }

  /* ── What changed, and what it costs ──
     'geom' moves or renames: drawn again, results still valid.
     'elec' changes what the optimiser sees: the results step back.
     Both are undoable and saved. */
  var history = [], hIdx = -1, lastMerge = null, lastMergeAt = 0;
  function snap(){ return JSON.stringify(ED.compact(app.model)); }
  function pushHistory(mergeKey){
    var now = Date.now();
    var s = snap();
    if(hIdx >= 0 && history[hIdx] === s) return;
    if(mergeKey && mergeKey === lastMerge && now - lastMergeAt < 900 && hIdx > 0){ history[hIdx] = s; lastMergeAt = now; return; }
    history = history.slice(0, hIdx + 1);
    history.push(s);
    if(history.length > 200) history.shift();
    hIdx = history.length - 1;
    lastMerge = mergeKey || null; lastMergeAt = now;
    syncUndo();
  }
  function restoreHistory(i){
    if(i < 0 || i >= history.length) return;
    hIdx = i;
    var keep = new Set(app.sel);
    app.model = ED.load(JSON.parse(history[i]));
    var ids = ED.byId(app.model);
    app.sel = new Set(Array.from(keep).filter(function(id){ return ids[id]; }));
    lastMerge = null;
    afterChange();
    syncUndo();
  }
  app.undo = function(){ restoreHistory(hIdx - 1); };
  app.redo = function(){ restoreHistory(hIdx + 1); };
  function syncUndo(){
    var u = $('undoBtn'), r = $('redoBtn');
    if(u) u.disabled = hIdx <= 0;
    if(r) r.disabled = hIdx >= history.length - 1;
  }
  function afterChange(){
    render();
    renderInspector();
    updateStale();
    if(persist) persist.schedule();
  }
  app.change = function(kind, mergeKey){
    pushHistory(mergeKey);
    afterChange();
  };
  function changeFromField(mergeKey){
    pushHistory(mergeKey);
    app.renderSoon();
    updateStale();
    refreshDerived();
    if(persist) persist.schedule();
  }

  /* ── The Run gate ──
     One run takes from a few milliseconds to seconds, and drawing a network
     passes through states that cannot be solved, so the page never re-solves
     on its own: a change steps the results back and lights the button. */
  function solveKey(){ return ED.elecKey(app.model) + '|' + JSON.stringify(solveOptions()); }
  function isStale(){ return !app.res || solveKey() !== app.solvedKey; }
  function updateStale(){
    var stale = !running && isStale();
    document.body.classList.toggle('is-stale', stale && !!app.res);
    $('runBtn').classList.toggle('needs-run', stale);
    $('staleNote').textContent = app.res ? 'The network changed. Press Run dispatch to solve it.' : 'Press Run dispatch to solve the network.';
    if(!app.res) document.body.classList.toggle('is-stale', false);
    if(svg.pauseAnimations){ if(stale && app.res) svg.pauseAnimations(); else svg.unpauseAnimations(); }
  }
  app.updateStale = updateStale;
  var running = false, runQueued = null;
  function run(){
    if(running){
      // A second press while solving waits for the first, then solves what is on screen.
      if(!runQueued) runQueued = new Promise(function(r){ queuedResolve = r; });
      return runQueued;
    }
    var model = app.model;
    var opts = solveOptions();
    var key = solveKey();
    running = true;
    stopPlay();
    $('runBtn').disabled = true;
    $('runBtn').textContent = '▶ Solving…';
    setSub('Solving' + (opts.mode === 'uc' ? ' the unit commitment' : opts.mode === 'lin' ? ' the relaxed unit commitment' : ' the economic dispatch') + '…');
    var v = ED.validate(model, opts);
    renderIssues(v);
    var job;
    if(v.errors.length){
      job = Promise.resolve({ report: { ok: false, error: '', blocked: v.errors }, bus: {}, br: {}, dev: {}, totals: {} });
    } else {
      job = loadTypes().catch(function(){}).then(function(){
        // Checked again once the line types are known.
        var v2 = ED.validate(model, opts);
        renderIssues(v2);
        if(v2.errors.length) return { report: { ok: false, error: '', blocked: v2.errors }, bus: {}, br: {}, dev: {}, totals: {} };
        v = v2;
        return call({ model: ED.compact(model), opts: opts }).then(function(d){ return d.res; });
      });
    }
    return job.then(function(res){
      res.validation = v;
      app.res = res;
      app.solvedKey = key;
      try { performance.mark('ed-solved'); } catch(e){}
    }, function(err){
      app.res = { report: { ok: false, error: 'The optimisation engine could not load. Check your connection and press Run dispatch again.' }, bus: {}, br: {}, dev: {}, totals: {} };
      app.solvedKey = null;
      if(window.console) console.warn(err);
    }).then(function(){
      running = false;
      $('runBtn').disabled = false;
      $('runBtn').textContent = '▶ Run dispatch';
      syncHourRange();
      showResults();
      render();
      if(app.fitPending){ app.fitPending = false; app.fit(); }
      updateStale();
      if(runQueued){ var q = queuedResolve; runQueued = null; queuedResolve = null; run().then(q); }
      return app.res;
    });
  }
  var queuedResolve = null;
  app.run = run;
  $('runBtn').addEventListener('click', function(){ run(); });

  /* ── The hour ── */
  function syncHourRange(){
    var res = shownResults(), el = $('edHour');
    var H = res ? res.T : 1;
    // With no result yet the hour is kept as it is, for the result to come.
    if(res){
      el.max = String(Math.max(0, H - 1));
      var h = parseInt(el.value, 10);
      if(!isFinite(h) || h > H - 1) el.value = String(Math.min(H - 1, Math.max(0, isFinite(h) ? h : 0)));
    }
    var off = !res || H <= 1;
    el.disabled = off;
    $('playBtn').disabled = off;
    document.querySelector('.hour-ctl').toggleAttribute('data-off', off && !res);
    $('hourOut').textContent = res ? ED.hourLabel(hourNow(), H) : '–';
  }
  function setHour(h, fromChart){
    var res = shownResults();
    if(!res) return;
    h = Math.max(0, Math.min(res.T - 1, h | 0));
    $('edHour').value = String(h);
    $('hourOut').textContent = ED.hourLabel(h, res.T);
    render();
    if(window.EDCharts) EDCharts.hour(h);
    writeHover(hovered !== null ? hovered : (app.sel.size === 1 ? app.sel.values().next().value : null));
    setSubHour();
    if(persist) persist.schedule();
    void fromChart;
  }
  app.setHour = setHour;
  $('edHour').addEventListener('input', function(){ stopPlay(); setHour(parseInt(this.value, 10)); });
  var playT = null;
  function stopPlay(){
    if(!playT) return;
    clearInterval(playT); playT = null;
    $('playBtn').textContent = '▶';
    $('playBtn').title = 'Play the hours'; $('playBtn').setAttribute('aria-label', 'Play the hours');
    $('playBtn').setAttribute('aria-pressed', 'false');
  }
  $('playBtn').addEventListener('click', function(){
    if(playT){ stopPlay(); return; }
    var res = shownResults();
    if(!res || res.T <= 1) return;
    this.textContent = '⏸';
    this.title = 'Pause'; this.setAttribute('aria-label', 'Pause');
    this.setAttribute('aria-pressed', 'true');
    var step = res.T > 48 ? 250 : 600;
    playT = setInterval(function(){
      var r = shownResults();
      if(!r){ stopPlay(); return; }
      setHour((hourNow() + 1) % r.T);
    }, step);
  });

  /* ── Results ── */
  var F = ED.fmt;
  function setSub(t){ $('sldSub').textContent = t; }
  function esc(s){ return ED.esc(s); }
  function name(id){ var e = ED.byId(app.model)[id]; return e ? ED.nameOf(e) : '?'; }
  var MODE_NAME = { uc: 'Unit commitment, mixed-integer', lin: 'Unit commitment, linear relaxation', ed: 'Economic dispatch' };
  function subLine(){
    var res = app.res, r = res && res.report;
    if(!r || !r.ok) return '';
    var ms = r.ms < 1 ? '<1 ms' : r.ms < 1000 ? Math.round(r.ms) + ' ms' : (Math.round(r.ms / 100) / 10) + ' s';
    var warns = (res.validation && res.validation.warnings) || [];
    var warnTxt = warns.length ? ' ' + (warns.length === 1 ? 'One warning' : warns.length + ' warnings') + ' in Checks.' : '';
    var shed = res.totals.shedEnergy > 1e-6 ? ' ' + F.mwh(res.totals.shedEnergy) + ' MWh of load shed.' : '';
    return MODE_NAME[r.mode] + ', optimal. Solved by PSA.js and HiGHS in ' + ms + '.' + shed + warnTxt;
  }
  function setSubHour(){
    var res = shownResults();
    if(!res) return;
    setSub(subLine() + ' Showing ' + ED.hourLabel(hourNow(), res.T) + '.');
  }
  function showResults(){
    var res = app.res, r = res && res.report;
    ['mCost', 'mPrice', 'mUnits', 'mCong'].forEach(function(id){ $(id).classList.remove('neg'); $(id).classList.remove('warn'); });
    if(!r){ clearKpis(); renderCharts(); return; }
    if(r.blocked || !r.ok){
      var why = r.blocked ? r.blocked.map(function(x){ return x.msg; }).join(' ') : (r.error || 'No result.');
      setSub(r.blocked ? 'Not solved: the network has ' + (r.blocked.length === 1 ? 'a problem' : 'problems') + ' to fix first.' : 'Not solved.');
      clearKpis();
      $('mCost').textContent = r.blocked ? 'Fix ' + (r.blocked.length === 1 ? 'one problem' : r.blocked.length + ' problems') : 'Not solved';
      $('mCost').classList.add('neg');
      $('mCostSub').textContent = why;
      renderCharts(); renderTable(); renderAssumptions();
      return;
    }
    var T = res.totals, c = T.costs, C = cur(), H = res.T, o = r.opts;
    setSubHour();
    // Operating cost
    $('mCost').textContent = F.money(T.cost, C);
    var parts = [];
    parts.push('energy ' + F.money(c.energy, C));
    if(c.start + c.shut > 0.5) parts.push('start-ups and shut-downs ' + F.money(c.start + c.shut, C));
    if(c.standby > 0.5) parts.push('no-load ' + F.money(c.standby, C));
    if(c.shed > 0.5) parts.push('load shed ' + F.money(c.shed, C));
    $('mCostSub').textContent = 'Over ' + hoursText(H) + ': ' + parts.join(', ') + '.';
    if(T.shedEnergy > 1e-6) $('mCost').classList.add('warn');
    // Average price
    if(r.pricing === 'none' || !isFinite(T.avgPrice)){
      $('mPrice').textContent = '–';
      $('mPriceSub').textContent = r.pricing === 'none' ? 'No prices: the run with the commitment fixed could not be solved.' : 'No load to weight the prices by.';
    } else {
      $('mPrice').textContent = F.price(T.avgPrice, C);
      var many = app.model.el.filter(function(e){ return e.c === 'Bus'; }).length > 1;
      $('mPriceSub').textContent = 'per MWh, ' + (Math.abs(T.maxPrice - T.minPrice) < 0.005 ? 'the same in every hour' + (many ? ' and at every bus' : '') : 'from ' + F.price(T.minPrice, C) + ' to ' + F.price(T.maxPrice, C) + (many ? ' across hours and buses' : ' across the hours'));
      if(T.maxPrice >= o.voll - 1e-6 && o.shed) $('mPrice').classList.add('warn');
    }
    // Commitment
    var gens = app.model.el.filter(function(e){ return e.c === 'Generator' && res.dev[e.id]; });
    var com = gens.filter(function(e){ return res.dev[e.id].status; });
    if(com.length){
      $('mUnitsLabel').innerHTML = '<span class="tip-wrap">Start-ups <i class="tip-icon" data-tip="Times a committable unit was switched on over the horizon, and how much of their time the committable units ran.">?</i></span>';
      var ran = com.filter(function(e){ return res.dev[e.id].status.some(function(v){ return v > 1e-3; }); }).length;
      $('mUnits').textContent = fmtCount(T.starts);
      $('mUnitsSub').textContent = ran + ' of ' + com.length + ' committable unit' + (com.length === 1 ? '' : 's') + ' ran, on for ' + F.pct(100 * T.unitHoursOn / Math.max(1, T.unitHours)) + '% of their hours' + (r.mode === 'lin' ? ', as fractions of an hour' : '') + '.';
    } else {
      $('mUnitsLabel').innerHTML = '<span class="tip-wrap">Units running <i class="tip-icon" data-tip="Units that produced anything over the horizon. Economic dispatch never switches a unit off, it only sets its output.">?</i></span>';
      var ranG = gens.filter(function(e){ return res.dev[e.id].p.some(function(v){ return v > 1e-6; }); }).length;
      $('mUnits').textContent = ranG + ' of ' + gens.length;
      $('mUnitsSub').textContent = 'Peak demand ' + F.mw(T.peak) + ' MW at ' + ED.hourLabel(T.peakAt, H) + '.';
    }
    // Congestion
    var brs = app.model.el.filter(function(e){ return ED.BRANCH[e.c] && res.br[e.id]; });
    var top = null, topH = 0;
    brs.forEach(function(e){
      var n = res.br[e.id].load.filter(function(v){ return v >= 99.95; }).length;
      if(n > topH){ top = e; topH = n; }
    });
    if(!brs.length){ $('mCong').textContent = '–'; $('mCongSub').textContent = 'No branches: one bus, one price.'; }
    else if(!o.limits){ $('mCong').textContent = 'Off'; $('mCongSub').textContent = 'Line limits are off, so nothing congests.'; }
    else if(!top){
      var hi = null, hiV = -1;
      brs.forEach(function(e){ res.br[e.id].load.forEach(function(v){ if(isFinite(v) && v > hiV){ hiV = v; hi = e; } }); });
      $('mCong').textContent = 'None';
      $('mCongSub').textContent = hi ? 'No branch reaches its limit; the most loaded is ' + ED.nameOf(hi) + ' at ' + F.pctl(hiV, 100) + '%.' : 'No branch has a limit.';
    } else {
      $('mCong').textContent = topH + ' h';
      $('mCongSub').textContent = ED.nameOf(top) + ' at its ' + F.mwr(res.br[top.id].rating) + ' MW limit for ' + (topH === H ? 'every hour' : topH + ' of ' + H + ' hours') + '.';
      $('mCong').classList.add('warn');
    }
    renderCharts();
    renderTable();
    renderAssumptions();
  }
  function fmtCount(x){ var r = Math.round(x * 10) / 10; return (Math.abs(r - Math.round(r)) < 1e-9 ? String(Math.round(r)) : r.toFixed(1)); }
  function hoursText(H){ return H === 1 ? 'one hour' : H === 168 ? 'a week' : H % 24 === 0 && H > 24 ? H / 24 + ' days' : H + ' hours'; }
  function clearKpis(){
    ['mCost', 'mPrice', 'mUnits', 'mCong'].forEach(function(id){ $(id).textContent = '–'; $(id + 'Sub').textContent = ''; });
  }

  /* Charts: one card each, shown only when the result has something for it */
  var CARD = { disp: 'dispCard', price: 'priceCard', commit: 'commitCard', store: 'storeCard' };
  function renderCharts(){
    var res = shownResults();
    var show = window.EDCharts ? EDCharts.render(res, app.model, display(), function(h){ stopPlay(); setHour(h, true); }) : {};
    Object.keys(CARD).forEach(function(k){ $(CARD[k]).hidden = !show[k]; });
  }
  [['disp', 'Dispatch'], ['price', 'Nodal prices'], ['commit', 'Commitment'], ['store', 'Storage']].forEach(function(c){
    var k = c[0];
    var title = function(){ return (app.model.name ? app.model.name + ': ' : '') + c[1]; };
    var file = function(ext){ return fileBase() + '-' + c[1].toLowerCase().replace(/[^a-z]+/g, '-') + '.' + ext; };
    $(k + 'SvgBtn').addEventListener('click', function(){ var b = EDCharts.svg(k + 'Canvas', title(), k + 'Legend'); if(b) EDCharts.save(b, file('svg')); });
    $(k + 'PngBtn').addEventListener('click', function(){ EDCharts.png(k + 'Canvas', title(), k + 'Legend').then(function(b){ EDCharts.save(b, file('png')); }); });
    $(k + 'CopyBtn').addEventListener('click', function(){ SharedShare.copyImage(function(){ return EDCharts.png(k + 'Canvas', title(), k + 'Legend'); }, this); });
    $(k + 'ZoomBtn').addEventListener('click', function(){ EDCharts.resetZoom(k); });
  });

  /* Tables */
  var tableKind = 'unit';
  function hourCost(res, t){
    var c = 0, o = res.report.opts;
    app.model.el.forEach(function(e){
      var d = res.dev[e.id];
      if(e.c !== 'Generator' || !d) return;
      c += e.marginal_cost * d.p[t];
      if(d.status){ c += e.start_up_cost * d.su[t] + e.shut_down_cost * d.sd[t] + e.stand_by_cost * d.status[t]; }
    });
    Object.keys(res.bus).forEach(function(id){ c += res.bus[id].shed[t] * o.voll; });
    app.model.el.forEach(function(e){
      var b = res.br[e.id];
      if(e.c === 'Link' && b && e.both && e.efficiency < 1) c += ED.LINK_EPS * (Math.max(0, b.p0[t]) + Math.max(0, b.p1[t]));
    });
    return c;
  }
  function tableData(){
    var res = shownResults(), m = app.model, rows = [], head, units, C = cur();
    var H = res ? res.T : 0;
    var sum = function(a){ var s = 0; if(a) for(var t = 0; t < a.length; t++) s += a[t]; return s; };
    if(tableKind === 'unit'){
      head = ['Unit', 'Kind', 'Bus', 'Rating MW', 'Energy MWh', 'Capacity factor %', 'Hours on', 'Starts', 'Cost', 'Average cost per MWh'];
      units = 'Energy and cost over the whole horizon, in ' + (C || 'currency units') + '. Storage energy is what it discharged less what it charged.';
      m.el.forEach(function(e){
        if(e.c !== 'Generator' && e.c !== 'StorageUnit') return;
        var d = res && res.dev[e.id];
        var kind = e.c === 'StorageUnit' ? 'Storage' : e.grid ? 'Grid' : e.style === 'pv' ? 'Solar' : e.style === 'wind' ? 'Wind' : e.committable ? 'Generator, committable' : 'Generator';
        var en = d ? sum(d.p) : NaN;
        var on = d && d.status ? sum(d.status) : NaN, st = d && d.su ? sum(d.su) : NaN;
        rows.push({ id: e.id, cells: [ED.nameOf(e), kind, e.bus ? name(e.bus) : 'not on a bus', F.mwr(e.p_nom), d ? F.mwh(en) : '–',
          d && e.c === 'Generator' && e.p_nom > 0 ? F.pct(100 * en / (e.p_nom * H)) : '–',
          isFinite(on) ? fmtCount(on) : '–', isFinite(st) ? fmtCount(st) : '–',
          d && e.c === 'Generator' ? F.money(d.cost, C) : '–', d && e.c === 'Generator' && en > 1e-9 ? F.price(d.cost / en, C) : '–'], neg: [] });
      });
    } else if(tableKind === 'bus'){
      head = ['Bus', 'Nominal kV', 'Average price', 'Lowest price', 'Highest price', 'Demand MWh', 'Shed MWh'];
      units = 'Prices in ' + (C || 'currency units') + ' per MWh; the average is weighted by the demand at the bus, or plain where there is none.';
      m.el.forEach(function(e){
        if(e.c !== 'Bus') return;
        var b = res && res.bus[e.id];
        var avg = NaN, lo = NaN, hi = NaN;
        if(b){
          var wp = 0, wl = 0, s = 0, n = 0;
          b.price.forEach(function(v, t){ if(!isFinite(v)) return; wp += v * b.load[t]; wl += b.load[t]; s += v; n++; if(!(lo <= v)) lo = v; if(!(hi >= v)) hi = v; });
          avg = wl > 0 ? wp / wl : n ? s / n : NaN;
        }
        var shed = b ? sum(b.shed) : 0;
        rows.push({ id: e.id, cells: [ED.nameOf(e), e.v_nom, b ? F.price(avg, C) : '–', b ? F.price(lo, C) : '–', b ? F.price(hi, C) : '–', b ? F.mwh(sum(b.load)) : '–', b ? F.mwh(shed) : '–'],
                    neg: shed > 1e-6 ? [6] : [] });
      });
    } else if(tableKind === 'branch'){
      head = ['Branch', 'Kind', 'From', 'To', 'Limit MW', 'Highest flow MW', 'Highest loading %', 'Hours at limit', 'Energy MWh', 'Losses MWh'];
      units = 'Flows in MW at the end they enter. Energy is what crossed the branch either way; only HVDC links lose any.';
      m.el.forEach(function(e){
        if(!ED.BRANCH[e.c]) return;
        var r = res && res.br[e.id];
        var hiF = 0, hiL = NaN, at = 0, en = 0, loss = 0;
        if(r) for(var t = 0; t < H; t++){
          var f = Math.max(Math.abs(r.p0[t]), Math.abs(r.p1[t]));
          if(f > hiF) hiF = f;
          if(isFinite(r.load[t]) && !(hiL >= r.load[t])) hiL = r.load[t];
          if(r.load[t] >= 99.95) at++;
          en += Math.abs(r.p0[t]); loss += r.loss[t];
        }
        var lim = r ? (res.report.opts.limits && isFinite(r.rating) ? F.mwr(r.rating) : 'none') : (isFinite(ED.rating(e, ED.byId(m)[e.bus0])) ? F.mwr(ED.rating(e, ED.byId(m)[e.bus0])) : 'none');
        rows.push({ id: e.id, cells: [ED.nameOf(e), ED.WORD[e.c], name(e.bus0), name(e.bus1), lim, r ? F.mw(hiF) : '–', r && isFinite(hiL) ? F.pctl(hiL, 100) : '–', r ? String(at) : '–', r ? F.mwh(en) : '–', r ? F.mwh(loss) : '–'],
                    neg: at ? [7] : [] });
      });
    } else {
      head = ['Hour', 'Demand MW', 'Generation MW', 'Storage MW', 'Shed MW', 'Curtailed MW', 'Average price', 'Cost'];
      units = 'Each hour of the horizon. Storage is positive when discharging. The price is the demand-weighted average over the buses, in ' + (C || 'currency units') + ' per MWh, and the cost is that hour’s share of the operating cost.';
      if(res){
        var T = res.totals;
        for(var t = 0; t < H; t++){
          var wp = 0, wl = 0;
          Object.keys(res.bus).forEach(function(id){ var b = res.bus[id]; if(isFinite(b.price[t])){ wp += b.price[t] * b.load[t]; wl += b.load[t]; } });
          rows.push({ id: 'h' + t, hour: t, cells: [ED.hourLabel(t, H), F.mw(T.load[t]), F.mw(T.gen[t]), F.mw(T.store[t]), F.mw(T.shed[t]), F.mw(T.curtail[t]), wl > 0 ? F.price(wp / wl, C) : '–', F.money(hourCost(res, t), C)],
                      neg: T.shed[t] > 1e-6 ? [4] : [] });
        }
      }
    }
    return { head: head, rows: rows, units: units };
  }
  function renderTable(){
    var t = tableData();
    $('tableUnits').textContent = t.units;
    var h = '<table><thead><tr>' + t.head.map(function(x){ return '<th>' + esc(x) + '</th>'; }).join('') + '</tr></thead><tbody>';
    t.rows.forEach(function(r){
      var selected = r.hour !== undefined ? r.hour === hourNow() : app.sel.has(r.id);
      h += '<tr data-row="' + r.id + '"' + (selected ? ' class="is-sel"' : '') + '>' + r.cells.map(function(c, i){
        return '<td' + (r.neg.indexOf(i) >= 0 ? ' class="neg"' : '') + '>' + esc(c) + '</td>';
      }).join('') + '</tr>';
    });
    $('tableWrap').innerHTML = h + '</tbody></table>';
  }
  $('tableTabs').addEventListener('click', function(e){
    var b = e.target.closest('.seg-btn');
    if(!b) return;
    tableKind = b.getAttribute('data-val');
    Array.prototype.forEach.call(this.querySelectorAll('.seg-btn'), function(x){ x.classList.toggle('active', x === b); });
    renderTable();
  });
  $('tableWrap').addEventListener('click', function(e){
    var tr = e.target.closest('tr[data-row]');
    if(!tr) return;
    var key = tr.getAttribute('data-row');
    if(key.charAt(0) === 'h'){ stopPlay(); setHour(+key.slice(1)); renderTable(); return; }
    if(app.readOnly) return;
    app.select([+key]);
  });
  $('csvBtn').addEventListener('click', function(){
    var t = tableData();
    var q = function(s){
      s = String(s).replace(/−/g, '-');
      if(/^[=+\-@\t\r]/.test(s) && !/^[+-]?\d[\d,.]*(e[+-]?\d+)?$/i.test(s)) s = "'" + s;
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    var csv = [t.head.map(q).join(',')].concat(t.rows.map(function(r){ return r.cells.map(q).join(','); })).join('\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'dispatch-' + { unit: 'units', bus: 'buses', branch: 'branches', hour: 'hours' }[tableKind] + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
  });
  if(window.SharedFold) SharedFold.attach($('tablesCard'), { key: 'educ-simulator', bodies: ['#tableUnits', '#tableWrap'] });

  /* What this assumes, from the reader's own network */
  function renderAssumptions(){
    var res = shownResults(), m = app.model, o = res ? res.report.opts : solveOptions(), li = [], C = cur();
    var has = function(c, f){ return m.el.some(function(e){ return e.c === c && (!f || f(e)); }); };
    var branches = has('Line') || has('Transformer');
    li.push('<strong>One-hour steps over ' + hoursText(o.hours) + ',</strong> solved together by PSA.js as PyPSA builds the problem, and by the HiGHS solver.');
    if(branches) li.push('<strong>A lossless DC power flow:</strong> power divides between paths by reactance, every voltage is 1 p.u., and there is no reactive power.');
    if(o.mode === 'uc') li.push('<strong>Committable units are on or off in each hour.</strong> On, they run between their minimum and their rating; HiGHS proves the cost within ' + (o.gap * 100) + '% of the best possible.');
    else if(o.mode === 'lin') li.push('<strong>Commitment is relaxed:</strong> a unit may be partly on, so its minimum output and start-up costs are shared out, and the cost is a lower bound on the true one.');
    else if(has('Generator', function(e){ return e.committable; })) li.push('<strong>Economic dispatch:</strong> every unit can run anywhere from zero to its rating, so start-up costs, minimum output and minimum up and down times are left out.');
    if(res){
      if(res.report.pricing === 'fixed' || res.report.pricing === 'fixed-noramp')
        li.push('<strong>Prices come from a second, linear run</strong> with the commitment held as found. A unit that is off can only set the price above every unit running, as the next to start.' +
          (res.report.pricing === 'fixed-noramp' ? ' Ramp limits were left out of that run, since it could not be solved with them.' : ''));
      else if(res.report.pricing === 'lp') li.push('<strong>Prices are the duals of each bus’s power balance:</strong> what one more MW there would cost in that hour.');
    }
    if(o.shed) li.push('<strong>Load that cannot be served is shed at ' + F.money(o.voll, C) + ' per MWh,</strong> which caps every price.');
    else li.push('<strong>Every MW of demand must be served:</strong> with no load shedding, a shortfall makes the problem infeasible.');
    if(branches && !o.limits) li.push('<strong>Line and transformer limits are ignored,</strong> so power still splits by reactance but nothing congests.');
    if(has('Generator', function(e){ return e.committable; }) && o.mode !== 'ed')
      li.push('<strong>Committable units start the horizon as set:</strong> one running has met its minimum up time, one off its minimum down time.');
    if(has('Generator', function(e){ return e.ramp_limit_up < 1 || e.ramp_limit_down < 1; })) li.push('<strong>Ramp limits cap the change in output from one hour to the next;</strong> a start-up or shut-down hour is not limited.');
    if(has('StorageUnit')){
      var st = m.el.filter(function(e){ return e.c === 'StorageUnit' && ED.onBus(m, e); });
      var cyc = st.every(function(e){ return e.cyclic; });
      li.push('<strong>Storage loses its round-trip efficiency</strong> half on the way in and half on the way out' + (cyc ? ', and ends the horizon holding what it started with.' : '.'));
    }
    if(has('Link')) li.push('<strong>HVDC links carry what the optimiser sets,</strong> up to their rating, and lose (1 − efficiency) of it. They are not bound by reactance.' +
      (has('Link', function(e){ return e.both && e.efficiency < 1; }) ? ' A lossy one that runs both ways costs a token ' + ED.LINK_EPS + ' per MWh sent, so it never sends both ways at once.' : ''));
    var builtIn = m.el.some(function(e){ return (e.c === 'Load' || e.c === 'Generator') && typeof e.prof === 'string' && e.prof; });
    var custom = m.el.some(function(e){ return Array.isArray(e.prof); });
    if(builtIn && o.hours > 24) li.push('<strong>Built-in profiles change through the week:</strong> lower demand at the weekend, cloudier and calmer days. A custom one repeats every day.');
    else if(custom && o.hours > 24) li.push('<strong>Custom profiles repeat every day</strong> of the horizon.');
    li.push('<strong>No reserve is held</strong> and forecasts are perfect: every unit may run to its rating, and solar, wind and demand are known for every hour.');
    if(has('Line', function(e){ return !!ED.lineType(e); }))
      li.push('<strong>Standard line types use PyPSA’s data.</strong> A typed line is rated √3 × voltage × rated current × circuits.');
    $('assumptions').innerHTML = li.map(function(x){ return '<li>' + x + '</li>'; }).join('');
  }

  /* ── The share signature: what the diagram draws, to tell when it has settled ── */
  function setSig(d){
    var res = app.res;
    var digest = !res ? '' : res.report && res.report.ok ? JSON.stringify(res.raw, function(k, v){ return typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v; }) : 'err';
    if(!res){ stage.removeAttribute('data-share-sig'); return; }
    stage.setAttribute('data-share-sig', ED.hash(JSON.stringify(ED.compact(app.model)) + JSON.stringify(d) + digest + (isStale() ? 'stale' : '')));
  }

  /* ── Hover readout, at the hour shown ── */
  var hovered = null;
  app.hover = function(id){
    if(id === hovered) return;
    hovered = id;
    writeHover(id !== null && id !== undefined ? id : (app.sel.size === 1 ? app.sel.values().next().value : null));
  };
  function writeHover(id){
    var box = $('hoverBox');
    var e = id !== null && id !== undefined ? ED.byId(app.model)[id] : null;
    if(!e){ box.innerHTML = app.readOnly ? 'Hover or tap an element to read its values.' : 'Hover or tap an element to read its values. Drag a part from the toolbar onto the diagram to add it.'; return; }
    var res = shownResults(), parts = [], h = hourNow(), C = cur();
    var n = '<strong>' + esc(ED.nameOf(e)) + '</strong>';
    var mono = function(s){ return '<span class="mono">' + s + '</span>'; };
    var when = res ? ' at ' + ED.hourLabel(h, res.T) : '';
    if(e.c === 'Bus'){
      parts.push(n + ', ' + e.v_nom + ' kV bus' + when);
      var r = res && res.bus[e.id];
      if(r){
        parts.push('price ' + mono(F.price(r.price[h], C) + '/MWh'));
        parts.push('net injection ' + mono(F.mw(r.p[h]) + ' MW'));
        if(r.load[h] > 1e-9) parts.push('demand ' + mono(F.mw(r.load[h]) + ' MW'));
        if(r.shed[h] > 1e-6) parts.push('shed ' + mono(F.mw(r.shed[h]) + ' MW'));
      }
    } else if(ED.BRANCH[e.c]){
      parts.push(n + ', ' + (e.c === 'Link' ? 'HVDC link' : ED.WORD[e.c].toLowerCase()) + ' from ' + esc(name(e.bus0)) + ' to ' + esc(name(e.bus1)) + when);
      var b = res && res.br[e.id];
      if(b){
        parts.push('in at ' + esc(name(e.bus0)) + ' ' + mono(F.mw(b.p0[h]) + ' MW'));
        parts.push('in at ' + esc(name(e.bus1)) + ' ' + mono(F.mw(b.p1[h]) + ' MW'));
        if(e.c === 'Link') parts.push('losses ' + mono(F.mw(b.loss[h]) + ' MW'));
        if(isFinite(b.load[h])) parts.push('loading ' + mono(F.pctl(b.load[h], 100) + '%') + ' of ' + mono(F.mwr(b.rating) + ' MW'));
      }
    } else {
      var kind = e.c === 'Generator' ? (e.grid ? 'grid' : e.style === 'pv' ? 'solar' : e.style === 'wind' ? 'wind' : 'generator') : ED.WORD[e.c].toLowerCase();
      parts.push(n + ', ' + kind + (e.bus ? ' on ' + esc(name(e.bus)) : ', not on a bus') + when);
      var dv = res && res.dev[e.id];
      if(dv){
        if(e.c === 'Generator'){
          parts.push('output ' + mono(F.mw(dv.p[h]) + ' MW') + ' of ' + mono(F.mw(dv.avail[h]) + ' MW') + ' available');
          if(dv.status) parts.push(dv.status[h] > 0.999 ? (dv.su[h] > 0.5 ? 'starts this hour' : 'running') : dv.status[h] < 0.001 ? (dv.sd[h] > 0.5 ? 'shuts down this hour' : 'off') : 'running ' + Math.round(dv.status[h] * 100) + '%');
          parts.push('at ' + mono(F.price(e.marginal_cost, C) + '/MWh'));
        } else if(e.c === 'StorageUnit'){
          parts.push(dv.p[h] > 1e-6 ? 'discharging ' + mono(F.mw(dv.p[h]) + ' MW') : dv.p[h] < -1e-6 ? 'charging ' + mono(F.mw(-dv.p[h]) + ' MW') : 'idle');
          parts.push('holding ' + mono(F.mwh(dv.soc[h]) + ' MWh') + ' of ' + mono(F.mwh(dv.cap) + ' MWh'));
        } else parts.push('demand ' + mono(F.mw(dv.p[h]) + ' MW'));
      }
    }
    box.innerHTML = parts.join(' · ');
  }

  /* ── Selection ── */
  app.select = function(ids, add){
    if(app.readOnly) return;
    if(!add) app.sel = new Set();
    (ids || []).forEach(function(id){
      if(add && app.sel.has(id)) app.sel.delete(id); else app.sel.add(id);
    });
    renderOverlay();
    renderInspector();
    writeHover(app.sel.size === 1 ? app.sel.values().next().value : null);
    Array.prototype.forEach.call(document.querySelectorAll('#tableWrap tr[data-row]'), function(tr){
      var k = tr.getAttribute('data-row');
      if(k.charAt(0) !== 'h') tr.classList.toggle('is-sel', app.sel.has(+k));
    });
    document.body.classList.toggle('ed-sheet', app.sel.size > 0 && window.matchMedia('(max-width:1100px)').matches);
    document.body.classList.toggle('ed-has-sel', app.sel.size > 0);
    if(window.SharedCtrl){
      var overlay = document.body.classList.contains('ed-sheet') || document.documentElement.classList.contains('sld-full-open');
      if(app.sel.size && !overlay && !SharedCtrl.isOpen()) SharedCtrl.open();
      SharedCtrl.hold('selection', app.sel.size > 0 && overlay);
    }
    if(app.sel.size) showTab('element');
  };

  /* ── New elements, sized to the voltage they join ── */
  var LINE_BY_KV = [[0.4, 'NAYY 4x150 SE', 0.2], [10, 'NA2XS2Y 1x240 RM/25 6/10 kV', 2], [20, 'NA2XS2Y 1x240 RM/25 12/20 kV', 3],
                    [110, '243-AL1/39-ST1A 110.0', 20], [220, 'Al/St 240/40 2-bundle 220.0', 50], [380, 'Al/St 240/40 4-bundle 380.0', 80]];
  function scaleFor(kv){ return kv <= 1 ? 0.01 : kv <= 36 ? 0.1 : kv <= 150 ? 1 : 5; }
  app.newElement = function(c, extra){
    var m = app.model, id = m.next++;
    var e = { c: ED.toolClass(c), id: id, name: c === 'Grid' ? 'Grid ' + id : '' };
    var d = ED.DEFAULTS[e.c];
    for(var k in d) e[k] = d[k];
    var nw = ED.NEW[c] || {};
    for(var k2 in nw) e[k2] = nw[k2];
    for(var k3 in extra) e[k3] = extra[k3];
    var byId = ED.byId(m);
    var kv = e.c === 'Bus' ? e.v_nom : ED.isBranch(e) ? (byId[e.bus0] ? byId[e.bus0].v_nom : 110) : (byId[e.bus] ? byId[e.bus].v_nom : 110);
    var s = scaleFor(kv);
    if(e.c === 'Line'){
      var t = LINE_BY_KV.filter(function(r){ return r[0] === kv; })[0];
      if(t && ED.types.line[t[1]]){ e.type = t[1]; e.length = t[2]; e.r = 0; e.x = 0; e.s_nom = 0; }
      else { var z = kv * kv / 100; e.x = +(0.1 * z).toPrecision(3); e.r = +(0.0125 * z).toPrecision(3); e.s_nom = 100 * s; }
    }
    if(e.c === 'Transformer'){ e.s_nom = kv <= 1 ? 0.63 : kv <= 36 ? 0.63 : kv <= 150 ? 40 : 250; e.x = kv <= 36 ? 0.06 : 0.12; e.r = 0.01; }
    if(e.c === 'Load') e.p_set = 50 * s;
    if(e.c === 'Generator' && !e.grid) e.p_nom = 100 * s;
    if(e.c === 'Generator' && e.grid) e.p_nom = 1000 * s;
    if(e.c === 'StorageUnit') e.p_nom = 20 * s;
    if(e.c === 'Link') e.p_nom = 100 * s;
    m.el.push(e);
    return e;
  };
  app.deleteSelected = function(){
    if(!app.sel.size) return;
    var gone = app.sel, m = app.model, L = app.L;
    m.el.forEach(function(e){
      if(ED.DEVICE[e.c] && gone.has(e.bus) && !gone.has(e.id)){
        var g = L.dev[e.id];
        e.bus = null;
        e.at = g ? [Math.round(g.cx / G), Math.round(g.cy / G)] : [0, 0];
      }
    });
    m.el = m.el.filter(function(e){ return !gone.has(e.id) && !(ED.BRANCH[e.c] && (gone.has(e.bus0) || gone.has(e.bus1))); });
    app.sel = new Set();
    app.change('elec');
  };
  app.duplicateSelected = function(){
    if(!app.sel.size) return;
    var m = app.model, map = {}, added = [];
    var src = m.el.filter(function(e){ return app.sel.has(e.id); });
    src.forEach(function(e){
      var c = JSON.parse(JSON.stringify(e));
      c.id = m.next++;
      map[e.id] = c.id;
      if(c.name) c.name = c.name + ' copy';
      if(c.c === 'Bus') c.at = [c.at[0] + 3, c.at[1] + 3, c.at[2], c.at[3]];
      else if(ED.DEVICE[c.c] && c.bus === null && c.at) c.at = [c.at[0] + 3, c.at[1] + 3];
      else if(ED.DEVICE[c.c] && c.at) c.at = null;
      if(ED.BRANCH[c.c]) c.at = null;
      added.push(c);
    });
    added.forEach(function(c){
      if(ED.BRANCH[c.c]){ if(map[c.bus0]) c.bus0 = map[c.bus0]; if(map[c.bus1]) c.bus1 = map[c.bus1]; }
      if(ED.DEVICE[c.c] && map[c.bus]) c.bus = map[c.bus];
      m.el.push(c);
    });
    app.sel = new Set(added.map(function(c){ return c.id; }));
    app.change('elec');
  };

  /* ── The inspector ── */
  var TIP = {
    v_nom: 'The line-to-line voltage the bus is rated at. Line types and per-unit values are on it.',
    length: 'Route length. A line type gives its reactance per kilometre.',
    num_parallel: 'Identical circuits side by side: reactance divides and rating multiplies.',
    r: 'Series resistance of the whole line. A DC power flow is lossless, so it is kept for reference only.',
    x: 'Series reactance of the whole line, not per kilometre. Power divides between paths by it.',
    s_nom: 'The most the line may carry. 0 means no limit.',
    tx_s: 'The most it may carry, and the base its reactance is per unit on.',
    tx_x: 'Series reactance, per unit on the transformer’s own rating.',
    tx_r: 'Series resistance, per unit on its rating, kept for reference: the DC power flow is lossless.',
    p_nom: 'The most it can produce.',
    grid_nom: 'The most that can be imported.',
    mc: 'What one more MWh from it costs: fuel and variable running costs. The merit order is sorted by it.',
    grid_mc: 'The price paid for each MWh imported.',
    committable: 'On: the unit is switched on or off hour by hour, with the costs and limits below. Off: it is always available, from zero to its rating.',
    p_min: 'The least it can run at while on, as a share of its rating.',
    min_up: 'Hours it must stay on once started.',
    min_down: 'Hours it must stay off once stopped.',
    start: 'Paid each time it is switched on.',
    shut: 'Paid each time it is switched off.',
    standby: 'Paid for every hour it is on, whatever it produces (a no-load cost).',
    init: 'Its state just before the first hour. Running, it has already met its minimum up time; off, its minimum down time.',
    ramp_up: 'The most its output can rise from one hour to the next, as a share of its rating. 100% is no limit.',
    ramp_down: 'The most its output can fall from one hour to the next. 100% is no limit.',
    load_p: 'Demand at the profile’s highest hour. The profile scales it hour by hour.',
    store_p: 'The most it can charge or discharge at.',
    store_h: 'How long it can discharge at full power. Energy capacity is power × hours.',
    eff: 'Share of the energy put in that comes back out, lost half on the way in and half on the way out.',
    cyclic: 'On: it must end the horizon holding what it started with, so it cannot just empty itself.',
    soc0: 'How full it is at the start, as a share of its energy capacity.',
    link_nom: 'The most it can send, in either direction it runs.',
    link_eff: 'Share of the power sent that arrives at the far end.',
    link_both: 'Whether it can send power both ways or only from its first end.',
    sym: 'How the unit is drawn.<ul><li><strong>Solar, Wind:</strong> symbols only; its availability sets what it produces.</li><li><strong>Grid:</strong> a hatched square, the sign for a wider grid.</li></ul>',
    shape: 'How the bus is drawn.<ul><li><strong>Bar:</strong> a bar its connections spread along.</li><li><strong>Node:</strong> a dot every connection meets at.</li></ul>',
    upright: 'Stands the bar on end. R does the same to every selected bus.',
    upnode: 'Devices leave the node left and right instead of above and below. R does the same to every selected bus.'
  };
  function F_(k, label, unit, o){ o = o || {}; o.k = k; o.label = label; o.unit = unit; return o; }
  var typed = function(e){ return !!ED.lineType(e); }, custom = function(e){ return !ED.lineType(e); };
  var isCom = function(e){ return !!e.committable; };
  var notCyclic = function(e){ return !e.cyclic; };
  var FIELDS = {
    Bus: [F_('style', 'Shape', '', { kind: 'seg', opts: [['', 'Bar'], ['node', 'Node']], tip: TIP.shape }),
          F_('v_nom', 'Nominal voltage', 'kV', { min: 0.1, max: 1500, tip: TIP.v_nom })],
    Line: [F_('type', 'Line type', '', { kind: 'linetype' }),
           F_('length', 'Length', 'km', { min: 0, max: 5000, tip: TIP.length, show: typed }),
           F_('num_parallel', 'Parallel circuits', '', { min: 1, max: 20, step: 1, tip: TIP.num_parallel, show: typed }),
           F_('x', 'Reactance', 'Ω', { min: -1e5, max: 1e5, tip: TIP.x, show: custom }),
           F_('r', 'Resistance', 'Ω', { min: 0, max: 1e5, tip: TIP.r, show: custom }),
           F_('s_nom', 'Rating', 'MW', { min: 0, max: 1e5, tip: TIP.s_nom, show: custom })],
    Transformer: [F_('s_nom', 'Rating', 'MVA', { min: 0, max: 1e5, tip: TIP.tx_s }),
           F_('x', 'Reactance', 'p.u.', { min: -10, max: 10, step: 0.0001, tip: TIP.tx_x }),
           F_('r', 'Resistance', 'p.u.', { min: 0, max: 10, step: 0.0001, tip: TIP.tx_r })],
    Generator: [F_('sym', 'Symbol', '', { kind: 'seg', opts: [['', 'Generator'], ['pv', 'Solar'], ['wind', 'Wind'], ['grid', 'Grid']], wide: true, tip: TIP.sym }),
           F_('p_nom', 'Rating', 'MW', { min: 0, max: 1e5, tip: function(e){ return e.grid ? TIP.grid_nom : TIP.p_nom; } }),
           F_('marginal_cost', 'Marginal cost', '/MWh', { money: true, min: -1e4, max: 1e5, tip: function(e){ return e.grid ? TIP.grid_mc : TIP.mc; } }),
           F_('prof', 'Availability', '', { kind: 'profile' }),
           F_('committable', 'Committable', '', { kind: 'toggle', tip: TIP.committable, group: 'Commitment' }),
           F_('p_min_pu', 'Minimum stable output', '%', { scale: 100, min: 0, max: 100, step: 0.1, tip: TIP.p_min, show: isCom }),
           F_('min_up_time', 'Minimum up time', 'h', { min: 0, max: 168, step: 1, tip: TIP.min_up, show: isCom }),
           F_('min_down_time', 'Minimum down time', 'h', { min: 0, max: 168, step: 1, tip: TIP.min_down, show: isCom }),
           F_('start_up_cost', 'Start-up cost', '', { money: true, min: 0, max: 1e8, tip: TIP.start, show: isCom }),
           F_('shut_down_cost', 'Shut-down cost', '', { money: true, min: 0, max: 1e8, tip: TIP.shut, show: isCom }),
           F_('stand_by_cost', 'No-load cost', '/h', { money: true, min: 0, max: 1e7, tip: TIP.standby, show: isCom }),
           F_('init', 'Before the first hour', '', { kind: 'seg', opts: [[1, 'Running'], [0, 'Off']], tip: TIP.init, show: isCom }),
           F_('ramp_limit_up', 'Ramp up limit', '%/h', { scale: 100, min: 1, max: 100, step: 0.1, tip: TIP.ramp_up, group: 'Ramping' }),
           F_('ramp_limit_down', 'Ramp down limit', '%/h', { scale: 100, min: 1, max: 100, step: 0.1, tip: TIP.ramp_down })],
    Load: [F_('p_set', 'Peak demand', 'MW', { min: 0, max: 1e5, tip: TIP.load_p }),
           F_('prof', 'Profile', '', { kind: 'profile' })],
    StorageUnit: [F_('p_nom', 'Power rating', 'MW', { min: 0, max: 1e5, tip: TIP.store_p }),
           F_('max_hours', 'Hours at full power', 'h', { min: 0, max: 1000, tip: TIP.store_h }),
           F_('eff', 'Round-trip efficiency', '%', { scale: 100, min: 1, max: 100, step: 0.1, tip: TIP.eff }),
           F_('cyclic', 'End where it started', '', { kind: 'toggle', tip: TIP.cyclic }),
           F_('soc0', 'Starting charge', '%', { scale: 100, min: 0, max: 100, step: 0.1, tip: TIP.soc0, show: notCyclic })],
    Link: [F_('p_nom', 'Rating', 'MW', { min: 0, max: 1e5, tip: TIP.link_nom }),
           F_('efficiency', 'Efficiency', '%', { scale: 100, min: 1, max: 100, step: 0.1, tip: TIP.link_eff }),
           F_('both', 'Direction', '', { kind: 'seg', opts: [[1, 'Both ways'], [0, 'One way']], tip: TIP.link_both })]
  };
  function getVal(e, f){ return e[f.k] * (f.scale || 1); }
  function setVal(e, f, v){ e[f.k] = v / (f.scale || 1); }
  function fmtField(v){
    if(!isFinite(v)) return '';
    var a = Math.abs(v);
    if(a !== 0 && (a < 1e-4 || a >= 1e7)) return String(+v.toPrecision(6));
    return String(+v.toPrecision(8));
  }
  var typeKv = ED.lineTypeKv;
  function tipHtml(t, opts){ return t ? ' <i class="tip-icon"' + (opts ? ' data-tip-options' : '') + ' data-tip="' + esc(t) + '">?</i>' : ''; }
  var KIND_ICON = {
    Bus: '<path d="M3 12h18" stroke-width="3"/>',
    Line: '<path d="M3 7h5M16 17h5M8 7v10h8" />',
    Transformer: '<circle cx="9.5" cy="12" r="5"/><circle cx="14.5" cy="12" r="5"/>',
    Node: '<path d="M12 3v5.5M12 15.5V21M3 12h5.5"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/>',
    Generator: '<circle cx="12" cy="12" r="8"/><path d="M8 12q2-3.5 4 0t4 0"/>',
    PV: '<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M4 9.3h16M4 14.7h16M12 4v16"/>',
    Wind: '<circle cx="12" cy="12" r="8"/><path d="M12 10.3V5.5M10.5 12.9l-4.2 2.4M13.5 12.9l4.2 2.4" stroke-width="2.4"/><circle cx="12" cy="12" r="1.3"/>',
    Grid: '<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M4 12l8-8M4 20 20 4M12 20l8-8"/>',
    Load: '<path d="M12 3v9"/><path d="M6 12h12l-6 9z" fill="currentColor"/>',
    StorageUnit: '<rect x="5" y="6" width="14" height="13" rx="1.5"/><path d="M9 3v3M15 3v3M9.5 10v5M14.5 11.5v2"/>',
    Link: '<path d="M2 12h5M17 12h5"/><rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M7 17 17 7"/>'
  };
  ED.KIND_ICON = KIND_ICON;
  function kindIcon(e){
    var k = e.c === 'Generator' && e.grid ? 'Grid' : e.c === 'Generator' && e.style === 'pv' ? 'PV' : e.c === 'Generator' && e.style === 'wind' ? 'Wind' :
            e.c === 'Bus' && e.style === 'node' ? 'Node' : e.c;
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + KIND_ICON[k] + '</svg>';
  }

  /* A profile: a list of shapes, and 24 bars to draw your own. Dragging a bar
     of a built-in shape makes it Custom, starting from that shape's first day. */
  var PROFILE_TIP = {
    load: 'How demand moves through the day, as a share of its peak. Drag the bars to make your own.',
    gen: 'What share of its rating the unit can produce in each hour. Drag the bars to make your own.'
  };
  function profKind(e){ return e.c === 'Load' ? 'load' : 'gen'; }
  function dayValues(e){ var a = []; for(var h = 0; h < 24; h++) a.push(ED.shapeAt(e.prof, h, 1)); return a; }
  function barsSvg(vals){
    var s = '<rect x="0" y="0" width="240" height="64" fill="transparent"/>';
    vals.forEach(function(v, h){
      var bh = Math.max(0.5, v * 54);
      s += '<rect class="pb" x="' + (h * 10 + 1) + '" y="' + (58 - bh) + '" width="8" height="' + bh + '" rx="1.5"/>';
    });
    s += '<path class="pb-axis" d="M0 58.5H240"/>';
    [0, 6, 12, 18].forEach(function(h){ s += '<text class="pb-t" x="' + (h * 10 + 1) + '" y="70">' + ('0' + h).slice(-2) + '</text>'; });
    return s;
  }
  function profileHtml(e){
    var kind = profKind(e);
    var keys = Object.keys(ED.PROFILES).filter(function(k){ return ED.PROFILES[k].kind === kind; });
    var curK = Array.isArray(e.prof) ? 'custom' : e.prof;
    var opts = [['', kind === 'load' ? 'Flat' : 'Always available']].concat(keys.map(function(k){ return [k, ED.PROFILES[k].label]; })).concat([['custom', 'Custom']]);
    var label = kind === 'load' ? 'Profile' : 'Availability';
    return '<div class="field-row"><div class="field-label"><span class="tip-wrap">' + label + tipHtml(PROFILE_TIP[kind]) + '</span></div>' +
      '<select class="sel-input" id="f_prof" data-k="prof">' + opts.map(function(o){ return '<option value="' + o[0] + '"' + (o[0] === curK ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
      '<svg class="prof-bars" id="profBars" viewBox="0 -2 240 76" role="img" aria-label="' + label + ' through the day, hour by hour. Drag a bar to change it.">' + barsSvg(dayValues(e)) + '</svg></div>';
  }
  function fieldHtml(e, f){
    var id = 'f_' + f.k;
    var tip = typeof f.tip === 'function' ? f.tip(e) : f.tip;
    if(f.kind === 'profile') return profileHtml(e);
    if(f.kind === 'linetype'){
      var types = ED.types.line;
      var names = Object.keys(types).filter(function(n){ return types[n].f_nom > 0; });
      var kv = NaN, byId = ED.byId(app.model);
      if(byId[e.bus0]) kv = byId[e.bus0].v_nom;
      var near = names.filter(function(n){ return typeKv(n) === kv; });
      var rest = names.filter(function(n){ return near.indexOf(n) < 0; });
      var opt = function(n){ return '<option value="' + esc(n) + '"' + (e.type === n ? ' selected' : '') + '>' + esc(n) + '</option>'; };
      var unknown = e.type && names.indexOf(e.type) < 0;
      var html = '<option value=""' + (!e.type || unknown ? ' selected' : '') + '>Custom: my own values</option>';
      if(!names.length) html += '<option disabled>Loading the standard types…</option>';
      if(near.length) html += '<optgroup label="At ' + kv + ' kV">' + near.map(opt).join('') + '</optgroup>';
      if(rest.length) html += '<optgroup label="' + (near.length ? 'Other voltages' : 'Standard types') + '">' + rest.map(opt).join('') + '</optgroup>';
      return '<div class="field-row"><div class="field-label"><span class="tip-wrap">' + f.label + tipHtml('PyPSA’s standard line types. A type sets the reactance and the rating; Custom takes your own.') + '</span></div><select class="sel-input" id="' + id + '" data-k="' + f.k + '">' + html + '</select></div>';
    }
    if(f.kind === 'toggle'){
      return '<div class="toggle-row"><div class="toggle-label"><span class="tip-wrap">' + f.label + tipHtml(tip) + '</span></div><label class="toggle-switch"><input type="checkbox" data-k="' + f.k + '"' + (e[f.k] ? ' checked' : '') + '/><span class="toggle-track"><span class="toggle-knob"></span></span></label></div>';
    }
    if(f.kind === 'seg'){
      var cur0 = f.k === 'sym' ? (e.grid ? 'grid' : e.style) : e[f.k];
      return '<div class="field-row' + (f.wide ? '' : ' inline') + '"><div class="field-label"><span class="tip-wrap">' + f.label + tipHtml(tip) + '</span></div><div class="seg-group" data-k="' + f.k + '" role="group" aria-label="' + f.label + '">' +
        f.opts.map(function(o){ return '<button type="button" class="seg-btn' + (o[0] === cur0 ? ' active' : '') + '" data-val="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div></div>';
    }
    var v = getVal(e, f);
    var pre = f.money && cur() ? '<span class="prefix">' + esc(cur()) + '</span>' : '';
    return '<div class="field-row inline"><div class="field-label"><span class="tip-wrap">' + f.label + tipHtml(tip) + '</span></div>' +
      '<div class="affix-wrap">' + pre + '<input class="affix-input' + (f.unit ? ' has-suffix' : '') + '" type="text" inputmode="decimal" id="' + id + '" data-k="' + f.k + '"' +
      ' data-min="' + f.min + '" data-max="' + f.max + '"' + (f.step ? ' data-step="' + f.step + '"' : '') + ' value="' + fmtField(v) + '"/>' +
      (f.unit ? '<span class="suffix">' + f.unit + '</span>' : '') + '</div></div>';
  }
  function derivedHtml(e){
    var byId = ED.byId(app.model);
    if(e.c === 'Line'){
      var t = ED.lineType(e);
      if(t){
        var x = t.x_per_length * e.length / e.num_parallel;
        return '<p class="derived" id="derived">From the type: <b>' + F.mw(x) + ' Ω</b> reactance, rated <b>' + F.mw(ED.rating(e, byId[e.bus0])) + ' MW</b> (' + F.ka(t.i_nom * e.num_parallel) + ' kA).</p>';
      }
      var b0 = byId[e.bus0];
      if(b0 && b0.v_nom){ var z = b0.v_nom * b0.v_nom; return '<p class="derived" id="derived">Reactance per unit on 100 MVA: <b>' + F.v(e.x / z * 100) + '</b>.' + (e.s_nom > 0 ? '' : ' No limit.') + '</p>'; }
    }
    if(e.c === 'Generator' && e.committable && e.p_nom > 0) return '<p class="derived" id="derived">While on: <b>' + F.mw(e.p_min_pu * e.p_nom) + '</b> to <b>' + F.mw(e.p_nom) + ' MW</b>.</p>';
    if(e.c === 'StorageUnit') return '<p class="derived" id="derived">Energy capacity <b>' + F.mwh(e.p_nom * e.max_hours) + ' MWh</b>; each way <b>' + F.pct(100 * Math.sqrt(e.eff)) + '%</b> efficient.</p>';
    return '';
  }
  function refreshDerived(){
    var el = $('derived');
    if(!el || app.sel.size !== 1) return;
    var e = ED.byId(app.model)[app.sel.values().next().value];
    if(!e) return;
    var tmp = document.createElement('div');
    tmp.innerHTML = derivedHtml(e);
    if(tmp.firstChild) el.innerHTML = tmp.firstChild.innerHTML;
  }
  function labelOverrideHtml(e){
    var own = typeof e.lb === 'number';
    var list = ED.LABELS[e.c];
    var html = '<div class="field-group"><div class="group-title">Labels</div><div class="toggle-row"><div class="toggle-label"><span class="tip-wrap">Its own labels' +
      tipHtml('Off: shows what the Labels tab sets for every ' + ED.WORD[e.c].toLowerCase() + '. On: this one shows the boxes ticked below.') + '</span></div>' +
      '<label class="toggle-switch"><input type="checkbox" id="lbOwn"' + (own ? ' checked' : '') + '/><span class="toggle-track"><span class="toggle-knob"></span></span></label></div>';
    if(own){
      html += '<div class="lbl-chips">' + list.map(function(q, i){
        return '<label class="lbl-chip"><input type="checkbox" data-lbq="' + i + '"' + (e.lb & (1 << i) ? ' checked' : '') + '/>' + QTY[q] + '</label>';
      }).join('') + '</div>';
    }
    return html + '</div>';
  }
  function renderInspector(){
    var box = $('inspector');
    if(app.readOnly){ box.innerHTML = ''; return; }
    var m = app.model, byId = ED.byId(m);
    if(app.sel.size === 1){
      var e = byId[app.sel.values().next().value];
      if(e){ box.innerHTML = elementHtml(e); SharedIcon.hydrate(box); return; }
    }
    if(app.sel.size > 1){
      box.innerHTML = '<div class="insp-head"><strong style="flex:1">' + app.sel.size + ' elements selected</strong><span class="insp-actions">' +
        SharedIcon.button('duplicate', 'Duplicate them (Ctrl+D)', 'insp-dup') + SharedIcon.button('trash', 'Delete them (Del)', 'insp-del') + SharedIcon.button('close', 'Deselect (Esc)', 'insp-close') + '</span></div>' +
        '<p class="insp-sub">Drag any of them to move them together.</p>' + doneHtml();
      return;
    }
    var v = ED.validate(m, solveOptions());
    var counts = {};
    m.el.forEach(function(x){ counts[x.c] = (counts[x.c] || 0) + 1; });
    var isl = ED.islands(m);
    var html = '<div class="field-row"><div class="field-label">Network name</div><input class="txt-input" type="text" id="netName" maxlength="60" value="' + esc(m.name) + '" placeholder="My network"/></div>' +
      '<p class="stat-line"><strong>' + (counts.Bus || 0) + '</strong> buses, <strong>' + ((counts.Line || 0) + (counts.Transformer || 0) + (counts.Link || 0)) + '</strong> branches, <strong>' +
      (counts.Generator || 0) + '</strong> generators, <strong>' + (counts.Load || 0) + '</strong> loads, <strong>' + (counts.StorageUnit || 0) + '</strong> storage, <strong>' + isl + '</strong> island' + (isl === 1 ? '' : 's') + '.</p>';
    html += '<div class="field-group" id="checksGroup"' + (v.errors.length || v.warnings.length ? '' : ' hidden') + '><div class="group-title">Checks</div><div class="fg-body"><ul class="issue-list" id="issueList">' + issuesHtml(v) + '</ul></div></div>';
    html += '<div class="field-group"><div class="group-title">Elements</div>';
    EL_GROUPS.forEach(function(gr){
      var list = m.el.filter(gr[1]);
      if(!list.length) return;
      html += '<div class="el-group"><div class="el-group-title">' + gr[0] + '</div><div class="el-list">' + list.map(function(x){
        var free = ED.DEVICE[x.c] && !x.bus;
        return '<button type="button" class="el-chip' + (free ? ' is-free' : '') + '" data-sel="' + x.id + '">' + esc(ED.nameOf(x)) + '</button>';
      }).join('') + '</div></div>';
    });
    html += '</div>';
    box.innerHTML = html;
  }
  var isC = function(c){ return function(x){ return x.c === c; }; };
  var EL_GROUPS = [['Buses', isC('Bus')], ['Lines', isC('Line')], ['Transformers', isC('Transformer')],
    ['Generators', function(x){ return x.c === 'Generator' && !x.grid; }], ['External grids', function(x){ return x.c === 'Generator' && !!x.grid; }],
    ['Loads', isC('Load')], ['Storage', isC('StorageUnit')], ['HVDC links', isC('Link')]];
  function doneHtml(){ return '<div class="insp-done"><button type="button" class="btn-primary" id="inspDone" style="width:100%;margin-top:10px">✓ Done</button></div>'; }
  function issuesHtml(v){
    var items = v.errors.map(function(x){ return '<li class="err" data-sel="' + (x.id === null ? '' : x.id) + '">' + esc(x.msg) + '</li>'; })
      .concat(v.warnings.map(function(x){ return '<li data-sel="' + (x.id === null ? '' : x.id) + '">' + esc(x.msg) + '</li>'; }));
    return items.length ? items.join('') : '<li class="none">No problems found.</li>';
  }
  function renderIssues(v){
    var el = $('issueList'), grp = $('checksGroup');
    if(el) el.innerHTML = issuesHtml(v);
    if(grp) grp.hidden = !(v.errors.length || v.warnings.length);
  }
  function elementHtml(e){
    var byId = ED.byId(app.model);
    var kind = e.c === 'Generator' && e.grid ? 'External grid' : e.c === 'Generator' ? 'Generator' : e.c === 'StorageUnit' ? 'Storage unit' : e.c === 'Link' ? 'HVDC link' : e.c;
    var where = '';
    if(ED.BRANCH[e.c]) where = 'From <strong>' + esc(ED.nameOf(byId[e.bus0])) + '</strong> to <strong>' + esc(ED.nameOf(byId[e.bus1])) + '</strong>';
    else if(ED.DEVICE[e.c]) where = e.bus ? 'On <strong>' + esc(ED.nameOf(byId[e.bus])) + '</strong>' : 'Not on a bus: drag it onto one';
    var html = '<div class="insp-head"><span class="insp-kind" title="' + kind + '">' + kindIcon(e) + '</span>' +
      '<input class="txt-input" type="text" id="elName" maxlength="40" value="' + esc(ED.nameOf(e)) + '" aria-label="Name"/>' +
      '<span class="insp-actions">' + SharedIcon.button('duplicate', 'Duplicate (Ctrl+D)', 'insp-dup') + SharedIcon.button('trash', 'Delete (Del)', 'insp-del') + SharedIcon.button('close', 'Deselect (Esc)', 'insp-close') + '</span></div>' +
      '<p class="insp-sub">' + kind + (where ? '. ' + where + '.' : '.') + '</p>';
    html += '<div class="field-group"><div class="group-title">' + (e.c === 'Bus' ? 'Bus' : 'Parameters') + '</div>';
    (FIELDS[e.c] || []).forEach(function(f){
      if(f.group) html += '</div><div class="field-group"><div class="group-title">' + f.group + '</div>';
      if(!f.show || f.show(e)) html += fieldHtml(e, f);
    });
    if(e.c === 'Bus') html += '<div class="toggle-row"><div class="toggle-label"><span class="tip-wrap">' + (e.style === 'node' ? 'Devices to the sides' + tipHtml(TIP.upnode) : 'Upright bar' + tipHtml(TIP.upright)) + '</span></div><label class="toggle-switch"><input type="checkbox" id="busUpright"' + (e.at[3] === 1 ? ' checked' : '') + '/><span class="toggle-track"><span class="toggle-knob"></span></span></label></div>';
    html += derivedHtml(e) + '</div>';
    html += labelOverrideHtml(e);
    return html + doneHtml();
  }

  // One set of listeners for everything the inspector draws.
  var insp = $('inspector');
  function selectedEl(){ return app.sel.size === 1 ? ED.byId(app.model)[app.sel.values().next().value] : null; }
  function fieldOf(e, k){ return (FIELDS[e.c] || []).filter(function(f){ return f.k === k; })[0]; }
  insp.addEventListener('input', function(ev){
    var t = ev.target;
    if(t.id === 'netName'){ app.model.name = t.value.slice(0, 60); pushHistory('name'); if(persist) persist.schedule(); return; }
    var e = selectedEl();
    if(!e) return;
    if(t.id === 'elName'){
      var v = t.value.trim();
      e.name = v && v !== ED.autoName(e) ? v.slice(0, 40) : '';
      pushHistory('name' + e.id); app.renderSoon(); if(persist) persist.schedule();
      return;
    }
    var k = t.getAttribute('data-k');
    if(!k || t.tagName !== 'INPUT' || t.type !== 'text') return;
    var f = fieldOf(e, k), x = parseFloat(String(t.value).replace(/−/g, '-').replace(/,/g, ''));
    if(!f || !isFinite(x)) return;
    if(x < f.min || x > f.max) return; // the change event pulls it back
    setVal(e, f, x);
    changeFromField('f' + e.id + k);
  });
  insp.addEventListener('change', function(ev){
    var t = ev.target, e = selectedEl();
    if(t.id === 'netName' || t.id === 'elName'){ renderInspector(); return; }
    if(!e) return;
    if(t.id === 'busUpright'){ e.at = [e.at[0], e.at[1], e.at[2], t.checked ? 1 : 0]; app.change('geom'); return; }
    if(t.id === 'lbOwn'){
      if(t.checked){
        var d = display(), mask = 0;
        ED.LABELS[e.c].forEach(function(q, i){ if(d.labels[e.c][q]) mask |= 1 << i; });
        e.lb = mask;
      } else delete e.lb;
      app.change('geom');
      return;
    }
    if(t.hasAttribute('data-lbq')){
      var i = +t.getAttribute('data-lbq');
      e.lb = t.checked ? (e.lb | (1 << i)) : (e.lb & ~(1 << i));
      app.change('geom', 'lb' + e.id);
      return;
    }
    var k = t.getAttribute('data-k');
    if(!k) return;
    if(t.type === 'checkbox'){ e[k] = t.checked ? 1 : 0; app.change('elec'); return; }
    if(t.tagName === 'SELECT' && k === 'prof'){
      // Custom starts from the shape that was showing, so nothing jumps.
      e.prof = t.value === 'custom' ? (Array.isArray(e.prof) ? e.prof : dayValues(e).map(function(v){ return Math.round(v * 100) / 100; })) : t.value;
      app.change('elec');
      return;
    }
    if(t.tagName === 'SELECT'){
      e.type = t.value;
      if(e.c === 'Line' && ED.lineType(e) && !(e.length > 0)) e.length = 1;
      app.change('elec');
      return;
    }
    var f = fieldOf(e, k), x = parseFloat(String(t.value).replace(/−/g, '-').replace(/,/g, ''));
    if(!f) return;
    if(!isFinite(x)){ t.value = fmtField(getVal(e, f)); return; }
    x = Math.min(f.max, Math.max(f.min, x));
    if(f.step === 1) x = Math.round(x);
    setVal(e, f, x);
    t.value = fmtField(getVal(e, f));
    changeFromField('f' + e.id + k);
    if(k === 'v_nom' || k === 'p_min_pu' || k === 'p_nom') refreshDerived();
  });
  insp.addEventListener('click', function(ev){
    var t = ev.target;
    var chip = t.closest('[data-sel]');
    if(chip && chip.getAttribute('data-sel') !== ''){ app.select([+chip.getAttribute('data-sel')]); return; }
    if(t.closest('.insp-del')){ app.deleteSelected(); return; }
    if(t.closest('.insp-dup')){ app.duplicateSelected(); return; }
    if(t.closest('.insp-close') || t.closest('#inspDone')){ app.select([]); return; }
    var seg = t.closest('.seg-group[data-k] .seg-btn');
    if(seg){
      var e = selectedEl(), k = seg.parentElement.getAttribute('data-k'), v = seg.getAttribute('data-val');
      if(!e) return;
      // The look only: grid and style are drawn, never solved.
      if(k === 'sym'){ e.grid = v === 'grid' ? 1 : 0; e.style = v === 'grid' ? '' : v; app.change('geom'); return; }
      if(k === 'style'){ e.style = v; app.change('geom'); return; }
      e[k] = k === 'init' || k === 'both' ? +v : v;
      app.change('elec');
    }
  });
  // Dragging a profile bar sets that hour's value.
  var profDrag = null;
  function profAt(ev){
    var bars = $('profBars');
    if(!bars) return null;
    var r = bars.getBoundingClientRect();
    var x = (ev.clientX - r.left) / r.width * 240, y = (ev.clientY - r.top) / r.height * 76 - 2;
    return { h: Math.max(0, Math.min(23, Math.floor(x / 10))), v: Math.max(0, Math.min(1, (58 - y) / 54)) };
  }
  function profSet(ev){
    var e = selectedEl(), p = profAt(ev);
    if(!e || !p) return;
    if(!Array.isArray(e.prof)) e.prof = dayValues(e).map(function(v){ return Math.round(v * 100) / 100; });
    e.prof[p.h] = Math.round(p.v * 100) / 100;
    $('profBars').innerHTML = barsSvg(dayValues(e));
    var sel = $('f_prof');
    if(sel) sel.value = 'custom';
    changeFromField('prof' + e.id);
  }
  insp.addEventListener('pointerdown', function(ev){
    if(!ev.target.closest('#profBars')) return;
    ev.preventDefault();
    profDrag = ev.pointerId;
    try { $('profBars').setPointerCapture(ev.pointerId); } catch(e){}
    profSet(ev);
  });
  insp.addEventListener('pointermove', function(ev){ if(profDrag === ev.pointerId) profSet(ev); });
  insp.addEventListener('pointerup', function(ev){ if(profDrag === ev.pointerId){ profDrag = null; renderInspector(); } });
  insp.addEventListener('pointercancel', function(){ profDrag = null; });

  /* ── Tabs ── */
  function showTab(nm){
    Array.prototype.forEach.call(document.querySelectorAll('.ctrl-tab'), function(b){ b.classList.toggle('active', b.getAttribute('data-tab') === nm); });
    Array.prototype.forEach.call(document.querySelectorAll('.ctrl-panel'), function(p){ p.classList.toggle('active', p.id === 'tab-' + nm); });
  }
  Array.prototype.forEach.call(document.querySelectorAll('.ctrl-tab'), function(b){
    b.addEventListener('click', function(){ showTab(b.getAttribute('data-tab')); });
  });

  /* ── Dispatch tab and display options ── */
  var MODE_TIP = {
    uc: '<strong>Unit commitment, mixed-integer:</strong> each committable unit is on or off in each hour, with its start-up costs, minimum output and up and down times. Exact.',
    lin: '<strong>Unit commitment, linear relaxation:</strong> on or off becomes a share from 0 to 1. Quick, and its cost is a lower bound on the exact one.',
    ed: '<strong>Economic dispatch:</strong> every unit runs anywhere from zero to its rating, cheapest first. No start-ups, minimum output or up and down times.'
  };
  var LIMITS_TIP = {
    on: 'Lines, transformers and links carry no more than their ratings. A full one splits the price on either side of it.',
    off: 'No branch limit binds, so power still splits by reactance but every bus has the same price, bar losses on links.'
  };
  var COLOUR_TIP = {
    none: '<strong>Nothing:</strong> the diagram stays in one colour, whatever the hour.',
    price: '<strong>Nodal price:</strong> a bus warms toward gold as its price nears the highest of the horizon.',
    loading: '<strong>Branch loading:</strong> a branch thickens with its loading, turns amber near its limit and red at it.',
    both: '<strong>Both:</strong> buses by price, branches by loading. Red is a branch at its limit.'
  };
  function fixForm(){
    var el = $('edVoll'), v = parseFloat(el.value);
    if(isFinite(v)){ var c = Math.min(1e5, Math.max(100, v)); if(c !== v) el.value = c; }
    ['edMode', 'edHours', 'edGap', 'edTime', 'colourBy'].forEach(function(id){
      var s = $(id);
      if(s.selectedIndex >= 0) return;
      var d = Array.prototype.filter.call(s.options, function(o){ return o.defaultSelected; })[0] || s.options[0];
      if(d) d.selected = true;
    });
  }
  function syncDispatchForm(){
    fixForm();
    $('edModeTip').setAttribute('data-tip', MODE_TIP[$('edMode').value] || '');
    $('edLimitsTip').setAttribute('data-tip', LIMITS_TIP[$('edLimits').checked ? 'on' : 'off']);
    $('colourByTip').setAttribute('data-tip', COLOUR_TIP[$('colourBy').value] || '');
    $('vollRow').style.display = $('edShed').checked ? '' : 'none';
    $('gapRow').style.display = $('edMode').value === 'uc' ? '' : 'none';
    $('vollCur').textContent = cur();
    $('vollCur').hidden = !cur();
  }
  ['edMode', 'edHours', 'edLimits', 'edShed', 'edVoll', 'edGap', 'edTime'].forEach(function(id){
    $(id).addEventListener('change', function(){ syncDispatchForm(); updateStale(); renderInspector(); if(!running && app.res) renderAssumptions(); });
  });
  // The currency and the display options read the result; they never send it back to be solved.
  $('edCur').addEventListener('change', function(){ syncDispatchForm(); render(); renderInspector(); if(app.res) showResults(); });
  ['colourBy', 'animP'].forEach(function(id){
    $(id).addEventListener('change', function(){ if(id === 'colourBy') syncDispatchForm(); render(); });
  });
  $('labelMatrix').addEventListener('change', function(){ render(); });

  /* ── Quick Start ── */
  function resetForm(rt){
    Array.prototype.forEach.call(rt.querySelectorAll('input, select'), function(el){
      if(el.closest('[data-no-persist]')) return;
      if(el.type === 'checkbox') el.checked = el.defaultChecked;
      else if(el.tagName === 'SELECT') Array.prototype.forEach.call(el.options, function(o){ o.selected = o.defaultSelected; });
      else el.value = el.defaultValue;
    });
  }
  function applyPreset(key){
    var p = ED.PRESETS[key];
    if(!p) return;
    stopPlay();
    resetForm($('tab-dispatch')); resetForm($('tab-display')); resetForm(document.querySelector('.sld-viewbar'));
    if(p.opts.mode) $('edMode').value = p.opts.mode;
    if(p.opts.hours) $('edHours').value = String(p.opts.hours);
    applyMotionDefault(true);
    syncDispatchForm();
    app.model = ED.load(p.model);
    app.sel = new Set();
    app.res = null; app.solvedKey = null;
    $('edHour').max = String(Math.max(0, (p.opts.hours || 24) - 1));
    $('edHour').value = String(p.hour || 0);
    pushHistory();
    app.view = null;
    render();
    app.fit();
    app.fitPending = true;
    renderInspector();
    if(persist) persist.save();
    Array.prototype.forEach.call(document.querySelectorAll('.quick-start-btn'), function(b){ b.classList.toggle('active', b.getAttribute('data-preset') === key); });
    return run();
  }
  Array.prototype.forEach.call(document.querySelectorAll('.quick-start-btn'), function(b){
    b.addEventListener('click', function(){ applyPreset(b.getAttribute('data-preset')); });
  });

  /* ── Theme ── */
  $('themeToggle').addEventListener('click', function(){
    document.body.classList.toggle('light');
    this.textContent = document.body.classList.contains('light') ? '🌙 Dark' : '☀️ Light';
    render();
    if(app.res) renderCharts();
  });

  /* ── Motion: flows move unless the reader asked for less motion ── */
  (function(){
    var r = '';
    [-8, 4, 16, 28].forEach(function(x){ r += '<path d="' + ED.GLYPH.p.d + '" transform="translate(' + x + ' 5)"/>'; });
    document.querySelector('.flow-key-p').innerHTML = '<g class="fk-run">' + r + '</g>';
  })();
  var motionChosen = false;
  function applyMotionDefault(force){
    if(motionChosen && !force) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(reduce) $('animP').checked = false;
  }
  $('animP').addEventListener('change', function(){ motionChosen = true; });

  /* ── Diagram exports and Share ── */
  var exportP = null;
  function exporter(){
    if(!exportP){
      exportP = new Promise(function(resolve, reject){
        var s = document.createElement('script');
        s.src = 'ed-export.js';
        s.onload = function(){ resolve(window.EDExport); };
        s.onerror = function(){ exportP = null; reject(new Error('The exporter could not load.')); };
        document.head.appendChild(s);
      });
    }
    return exportP;
  }
  app.exporter = exporter;
  function fileBase(){ return (app.model.name || 'dispatch').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'dispatch'; }
  function download(blob, ext){
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileBase() + '.' + ext;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 4000);
  }
  // The export's subtitle is the run summary without its timing, which changes on every run.
  function exportCtx(){
    var res = shownResults();
    var sub = res ? MODE_NAME[res.report.mode] + ', ' + ED.hourLabel(hourNow(), res.T) + ' of ' + hoursText(res.T) + '.' : '';
    return { app: app, ED: ED, display: display(), res: res, stale: isStale(), title: app.model.name || 'Dispatch', sub: sub };
  }
  function busy(on, text){ setSub(on ? text : ''); if(!on && app.res) showResults(); }
  $('svgBtn').addEventListener('click', function(){ exporter().then(function(X){ download(X.svgBlob(exportCtx()), 'svg'); }); });
  $('pngBtn').addEventListener('click', function(){ exporter().then(function(X){ return X.pngBlob(exportCtx()); }).then(function(b){ download(b, 'png'); }); });
  $('gifBtn').addEventListener('click', function(){
    exporter().then(function(X){
      return X.gifBlob(exportCtx(), function(p){ busy(true, 'Making the GIF… ' + Math.round(p * 100) + '%'); });
    }).then(function(b){ busy(false); download(b, 'gif'); }, function(err){ busy(false); alert('The GIF could not be made: ' + (err && err.message || err)); });
  });
  $('copyBtn').addEventListener('click', function(){
    var btn = this, d = display();
    var animated = !!(shownResults() && d.animP);
    var png = function(){ return exporter().then(function(X){ return X.pngBlob(exportCtx()); }); };
    if(!animated){ SharedShare.copyImage(png, btn); return; }
    SharedShare.copyImage(png, btn, {
      gif: function(){ return exporter().then(function(X){ return X.gifBlob(exportCtx()); }); },
      onDone: function(kind){
        setSub(kind === 'gif' ? 'Copied the animated GIF.' : 'Copied a still PNG. Apps that paste rich text, such as email and documents, get the animated GIF. For a GIF file, use Download as GIF.');
        setTimeout(function(){ if(app.res) showResults(); }, 6000);
      }
    });
  });
  $('fitBtn').addEventListener('click', function(){ app.fit(); });
  $('zoomIn').addEventListener('click', function(){ app.zoomAt(1.25); });
  $('zoomOut').addEventListener('click', function(){ app.zoomAt(0.8); });

  // ⤢ lifts the diagram card out of the page to fill the window.
  var sldFull = false;
  function setSldFull(on){
    on = !!on;
    if(on === sldFull) return;
    sldFull = on;
    $('sldCard').classList.toggle('is-full', on);
    document.documentElement.classList.toggle('sld-full-open', on);
    var b = $('sldFull'), label = on ? 'Put the diagram back in the page' : 'Enlarge the diagram to fill the screen';
    b.setAttribute('aria-pressed', String(on));
    b.title = label; b.setAttribute('aria-label', label);
    if(!on) $('sldCard').scrollIntoView({ block: 'nearest' });
  }
  $('sldFull').addEventListener('click', function(){ setSldFull(!sldFull); });
  document.addEventListener('keydown', function(ev){
    if(ev.key !== 'Escape' || !sldFull || ev.defaultPrevented) return;
    var t = ev.target, tag = t && t.tagName;
    if(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    if(app.sel.size || document.querySelector('.pal-btn.is-armed')) return;
    setSldFull(false);
  }, true);

  /* ── Mini cache, scenario files and Share links ── */
  var persist = null, restoredAtLoad = false;
  buildLabelMatrix();
  applyMotionDefault();
  syncDispatchForm();
  // The tool's first folder was educ-simulator. Its saved state is keyed on that
  // name (this cache, scenario files, the folded table), so the name stays.
  persist = Persist.init('educ-simulator', {
    extra: {
      save: function(){ return ED.compact(app.model); },
      // Something that is not a saved network at all leaves the one on screen.
      restore: function(d){ if(!d || typeof d !== 'object') return; app.model = ED.load(d); restoredAtLoad = !persist; }
    },
    // A scenario file or a Share link: the whole network is replaced and solved.
    // (The mini cache restores inside init, before persist exists; start-up below handles that.)
    onRestore: function(){ if(persist) return afterRestore(); }
  });
  function afterRestore(){
    stopPlay();
    app.sel = new Set();
    app.res = null; app.solvedKey = null;
    history = []; hIdx = -1;
    pushHistory();
    syncDispatchForm();
    motionChosen = true;
    app.view = null;
    render();
    app.fit();
    app.fitPending = true;
    renderInspector();
    Array.prototype.forEach.call(document.querySelectorAll('.quick-start-btn.active'), function(b){ b.classList.remove('active'); });
    return run();
  }
  SharedScenario.mount('.quick-start-row', { tool: 'educ-simulator', persist: persist });

  /* ── Start: draw at once, solve as soon as the engine is in ── */
  if(restoredAtLoad) motionChosen = true;
  else if(!EMBED){
    // A first visit opens on the default Quick Start, solved the way it is meant to be.
    var p0 = ED.PRESETS[ED.PRESET_DEFAULT];
    $('edMode').value = p0.opts.mode; $('edHours').value = String(p0.opts.hours);
    $('edHour').max = String(p0.opts.hours - 1); $('edHour').value = String(p0.hour);
  }
  syncDispatchForm();
  pushHistory();
  syncHourRange();
  render();
  app.fit();
  app.fitPending = true;
  renderInspector();
  writeHover(null);
  showResults();
  try { performance.mark('ed-first-render'); } catch(e){}
  if(ED.Editor) ED.Editor(app);
  // An embed solves the scenario its link carries, once SharedShare has loaded it.
  if(!EMBED) run();
  else loadTypes();

  // The guided tour (tour.js) points at the results, so a network that changed
  // since its last run is solved first. It never edits the diagram.
  window.__ED_TOUR = { ensureResults: function(){ if(!running && isStale()) return run(); } };
  window.__ed = { app: app, ED: ED, run: run, applyPreset: applyPreset, display: display, solveOptions: solveOptions, setHour: setHour };
})();
