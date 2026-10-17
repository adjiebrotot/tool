/* Capacity Expansion Planner: the page.

   cx-core.js holds the plan and the bridge to PSA.js, cx-charts.js draws the
   charts, and cx-worker.js runs the optimisation off the main thread. This
   file ties them to the page: the form, the technology list, the Run gate,
   the answer, the tables, the mini cache, Share and the exports. It follows
   the ED/UC Simulator's script.js. */
(function(){
  'use strict';
  var CX = window.CX;
  var $ = function(id){ return document.getElementById(id); };
  var EMBED = !!(window.SharedShare && window.SharedShare.embedded);
  var F = CX.fmt;
  var esc = CX.esc;

  var app = window.CXApp = {
    model: CX.load(CX.PRESETS[CX.PRESET_DEFAULT].plan),
    res: null,          // the last results, kept (dimmed) while the plan changes
    resModel: null,     // the plan they were solved for, which names their technologies
    solvedKey: null,    // what those results were solved for
    open: null,         // the technology whose card is open
    year: 0             // the decision year the typical days chart shows
  };

  /* ── The engine: a module worker, or this page when a worker cannot run ── */
  var worker = null, workerDead = false, reqId = 0, pending = {};
  var mainP = null;
  function mainEngine(){
    if(!mainP){
      mainP = import('../ed-uc-simulator/engine/psa-opt.min.js');
      mainP.catch(function(){ mainP = null; });
    }
    return mainP;
  }
  function viaMain(msg){
    return mainEngine().then(function(psa){
      if(msg.init) return { ready: true };
      return CX.solve(psa, CX.load(msg.model), msg.opts).then(function(res){ return { res: res }; });
    });
  }
  function startWorker(){
    if(worker || workerDead) return worker;
    try { worker = new Worker('cx-worker.js', { type: 'module' }); }
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

  /* ── The form ── */
  var FIELD = { peak: 'cxPeak', growth: 'cxGrowth', profile: 'cxProfile', start: 'cxStart', end: 'cxEnd', step: 'cxStep',
                shed: 'cxShed', voll: 'cxVoll', carbon: 'cxCarbon', carbonGrow: 'cxCarbonGrow', netZero: 'cxNetZero', nzYear: 'cxNzYear',
                rate: 'cxRate', climate: 'cxClimate', sample: 'cxSample', stress: 'cxStress', time: 'cxTime', gap: 'cxGap' };
  function rawForm(){
    var o = {};
    Object.keys(FIELD).forEach(function(k){ var el = $(FIELD[k]); o[k] = el.type === 'checkbox' ? el.checked : el.value; });
    return o;
  }
  function plan(){ return CX.options(rawForm()); }
  function cur(){ var v = $('cxCur').value; return typeof v === 'string' ? v : '$'; }
  function detailed(){ return $('cxDetail').value === 'detailed'; }
  function setField(k, v){
    var el = $(FIELD[k]);
    if(!el) return;
    if(el.type === 'checkbox') el.checked = !!v; else el.value = String(v);
  }
  // Every field of the form back to the value it was written with.
  function resetForm(){
    Object.keys(FIELD).forEach(function(k){
      var el = $(FIELD[k]);
      if(el.type === 'checkbox') el.checked = el.defaultChecked;
      else if(el.tagName === 'SELECT') Array.prototype.forEach.call(el.options, function(o){ o.selected = o.defaultSelected; });
      else el.value = el.defaultValue;
    });
  }

  /* Kept live on every keystroke, whatever the gate says: affixes, readouts,
     which rows the choices show, the dependent tips and the notes under them. */
  var CLIMATE_TIP = {
    sum: '<strong>Temperate, peak in summer:</strong> four seasons, demand highest in summer, long sunny days then and short low ones in winter, and windier winters.',
    win: '<strong>Temperate, peak in winter:</strong> four seasons, demand highest in winter when the sun is lowest, and windier winters.',
    trop: '<strong>Tropical, the same all year:</strong> a dry and a wet season, twelve hours of high sun every day, a little cloudier in the wet.'
  };
  var SAMPLE_TIP = {
    day: '<strong>One typical day:</strong> each season is one weekday, standing for every day of it. The quickest.',
    day2: '<strong>A weekday and a weekend day:</strong> each season is a weekday for five days in seven and the profile’s weekend day for the other two.',
    week: '<strong>A typical week:</strong> Monday to Sunday for each season, with cloudier and calmer days, so storage and firm plants meet a run of poor weather.'
  };
  function setTip(id, html){ var el = $(id); if(el) el.setAttribute('data-tip', html); }
  function syncForm(){
    var o = plan(), C = cur();
    Array.prototype.forEach.call(document.querySelectorAll('.cur-prefix'), function(p){ p.textContent = C; p.hidden = !C; });
    $('cxGrowthVal').textContent = (+$('cxGrowth').value).toFixed(1) + ' %/yr';
    $('cxCarbonGrowVal').textContent = (+$('cxCarbonGrow').value).toFixed(1) + ' %/yr';
    $('cxRateVal').textContent = (+$('cxRate').value).toFixed(1) + ' %/yr';
    $('vollRow').hidden = !$('cxShed').checked;
    $('nzRow').hidden = !$('cxNetZero').checked;
    $('gapRow').hidden = !app.model.tech.some(function(e){ return e.build && e.unit > 0; });
    setTip('climateTip', CLIMATE_TIP[o.climate]);
    setTip('sampleTip', SAMPLE_TIP[o.sample]);
    var P = CX.periods(o), S = CX.sample(app.model, o);
    $('yearsNote').innerHTML = P.length === 1 ? 'One decision year, <b>' + P[0].year + '</b>.' :
      '<b>' + P.length + '</b> decision years: ' + P.map(function(p){ return p.year; }).join(', ') + (P[P.length - 1].years < o.step ? ', the last for ' + P[P.length - 1].years + (P[P.length - 1].years === 1 ? ' year' : ' years') : '') + '.';
    $('loadNote').innerHTML = 'A year of <b>' + F.gwh(S.energy * o.peak) + ' GWh</b> in ' + o.start + ', a load factor of <b>' + F.pct(100 * S.loadFactor) + '%</b>.';
    $('sampleNote').innerHTML = '<b>' + S.H + '</b> hours a decision year, <b>' + (S.H * P.length).toLocaleString('en-AU') + '</b> in all.';
    drawBars();
  }

  /* ── The load profile: 24 bars, dragged to make it Custom ── */
  function weekday(){
    var o = plan();
    if(o.profile === 'custom') return Array.isArray(app.model.prof) ? app.model.prof : CX.PROFILES.sys.h.slice();
    return CX.PROFILES[o.profile].h;
  }
  var barAt = null;
  function barsSvg(vals, at){
    var s = '<rect x="-8" y="-14" width="256" height="90" fill="transparent"/>', ticks = '';
    vals.forEach(function(v, h){
      var bh = Math.max(0.5, Math.min(v, 1.2) * 54);
      s += '<rect class="pb' + (h === at ? ' pb-on' : '') + '" x="' + (h * 10 + 1) + '" y="' + (58 - bh) + '" width="8" height="' + bh + '" rx="1.5"/>';
    });
    for(var h = 0; h <= 24; h++) ticks += 'M' + h * 10 + ' 58.5v' + (h % 3 ? 2 : 3.5);
    s += '<path class="pb-axis" d="M0 58.5H240' + ticks + '"/>';
    for(var k = 0; k <= 24; k += 3) s += '<text class="pb-t" x="' + k * 10 + '" y="70.5" text-anchor="middle">' + ('0' + k).slice(-2) + '</text>';
    if(at !== null && at !== undefined && at >= 0 && at < 24){
      var v = vals[at], cx = at * 10 + 5, top = 58 - Math.max(0.5, Math.min(v, 1.2) * 54);
      s += '<text class="pb-v" x="' + Math.max(22, Math.min(218, cx)) + '" y="' + Math.max(-4, top - 4) + '" text-anchor="middle">' + ('0' + at).slice(-2) + ':00  ' + Math.round(v * 100) + '%</text>';
    }
    return s;
  }
  function drawBars(){ $('profBars').innerHTML = barsSvg(weekday(), barAt); }
  (function(){
    var svg = $('profBars'), drag = false;
    function hourAt(ev){
      var r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * 256 - 8, y = (ev.clientY - r.top) / r.height * 90 - 14;
      return { h: Math.max(0, Math.min(23, Math.floor(x / 10))), v: Math.max(0, Math.min(1.2, (58 - y) / 54)) };
    }
    function set(ev){
      var p = hourAt(ev), vals = weekday().slice();
      vals[p.h] = Math.round(p.v * 100) / 100;
      app.model.prof = vals;
      if($('cxProfile').value !== 'custom') $('cxProfile').value = 'custom';
      barAt = p.h;
      changed();
    }
    svg.addEventListener('pointerdown', function(ev){ drag = true; try { svg.setPointerCapture(ev.pointerId); } catch(e){} set(ev); ev.preventDefault(); });
    svg.addEventListener('pointermove', function(ev){ if(drag) set(ev); else { barAt = hourAt(ev).h; drawBars(); } });
    svg.addEventListener('pointerup', function(){ drag = false; });
    svg.addEventListener('pointerleave', function(){ if(!drag){ barAt = null; drawBars(); } });
  })();
  // Picking Custom starts from the shape on screen, so nothing moves until a bar is dragged.
  var lastProfile = $('cxProfile').value;
  $('cxProfile').addEventListener('change', function(){
    if(this.value === 'custom' && !Array.isArray(app.model.prof) && CX.PROFILES[lastProfile]) app.model.prof = CX.PROFILES[lastProfile].h.slice();
    lastProfile = this.value;
  });

  /* ── The technology list ── */
  var TIP = {
    exist: 'Capacity already built. It runs, and pays its fixed O&M, until it retires.',
    retire: 'The first year it is no longer in service. Leave it blank to keep it to the end of the plan.',
    build: 'Lets the plan build new capacity of it in any decision year from its earliest year.',
    capex: 'Overnight cost of a new kW in the first year, before interest. It is paid as an annuity over its life at the discount rate.',
    capexStore: 'Overnight cost of a new kW of power with its hours of storage, so a 4-hour battery at 1,200 a kW is 300 a kWh.',
    fom: 'Paid every year on each kW in service, whether it runs or not.',
    life: 'Years a new plant runs once built. It retires after that and may be built again.',
    learn: 'How the capital cost moves each year, compounded: −2% makes it 2% cheaper every year the plan waits.',
    from: 'The first decision year it can be built in, for a plant that takes years to permit or build. Blank is the first year.',
    max: 'The most of it in service at any one time, existing included: a limit of land, fuel or connection. Blank is no limit.',
    unit: 'Built only in whole units of this size, as large plants are. It makes the plan a mixed-integer problem, which takes longer.',
    cf: 'Its year’s output over its rating × 8,760 hours. The typical days’ sun or wind shape is scaled to give it.',
    vom: 'Fuel and variable O&M for each MWh it generates, before any carbon price.',
    co2: 'CO2 for each MWh it generates. The carbon price and the net-zero year apply to it.',
    avail: 'Share of its rating it can give in any hour, after outages and maintenance.',
    hours: 'How long it can discharge at full power: energy capacity is power × hours.',
    rte: 'Share of the energy put in that comes back out, lost half on the way in and half on the way out.'
  };
  function F_(k, label, unit, o){ o = o || {}; o.k = k; o.label = label; o.unit = unit; return o; }
  var isPvWind = function(e){ return e.kind === 'pv' || e.kind === 'wind'; };
  var builds = function(e){ return !!e.build; };
  var FIELDS = [
    F_('kind', 'Kind', '', { kind: 'seg', opts: [['pv', 'Solar'], ['wind', 'Wind'], ['firm', 'Firm'], ['store', 'Storage']], detail: true }),
    F_('exist', 'Existing capacity', 'MW', { min: 0, max: 1e6, tip: TIP.exist, group: 'In service now' }),
    F_('retire', 'Retires in', '', { kind: 'year', tip: TIP.retire, show: function(e){ return e.exist > 0; }, blank: 'Stays' }),
    F_('build', 'Can build more', '', { kind: 'toggle', tip: TIP.build, group: 'New build' }),
    F_('capex', 'Capital cost', '/kW', { money: true, min: 0, max: 1e5, tip: function(e){ return e.kind === 'store' ? TIP.capexStore : TIP.capex; }, show: builds }),
    F_('fom', 'Fixed O&M', '/kW/yr', { money: true, min: 0, max: 1e4, tip: TIP.fom, detail: true }),
    F_('life', 'Lifetime', 'yrs', { min: 1, max: 100, tip: TIP.life, show: builds, detail: true }),
    F_('learn', 'Cost change', '%/yr', { scale: 100, min: -20, max: 20, step: 0.1, tip: TIP.learn, show: builds, detail: true }),
    F_('from', 'Earliest year', '', { kind: 'year', tip: TIP.from, show: builds, detail: true, blank: 'First year' }),
    F_('max', 'Most in service', 'MW', { min: 0, max: 1e6, tip: TIP.max, show: builds, detail: true, blank: 'No limit', zeroBlank: true }),
    F_('unit', 'Unit size', 'MW', { min: 0, max: 1e5, tip: TIP.unit, show: builds, detail: true, blank: 'Any size', zeroBlank: true }),
    F_('cf', 'Capacity factor', '%', { scale: 100, min: 1, max: 95, step: 0.1, tip: TIP.cf, show: isPvWind, group: 'Running' }),
    F_('vom', 'Running cost', '/MWh', { money: true, min: 0, max: 1e5, tip: TIP.vom, show: function(e){ return e.kind === 'firm' || detailed(); }, group: 'Running' }),
    F_('co2', 'Emissions', 't/MWh', { min: 0, max: 3, step: 0.001, tip: TIP.co2, show: function(e){ return e.kind === 'firm'; } }),
    F_('avail', 'Availability', '%', { scale: 100, min: 1, max: 100, step: 0.1, tip: TIP.avail, show: function(e){ return e.kind === 'firm'; }, detail: true }),
    F_('hours', 'Hours at full power', 'h', { min: 0.25, max: 1000, tip: TIP.hours, show: function(e){ return e.kind === 'store'; }, group: 'Running' }),
    F_('rte', 'Round-trip efficiency', '%', { scale: 100, min: 10, max: 100, step: 0.1, tip: TIP.rte, show: function(e){ return e.kind === 'store'; } })
  ];
  var TECH_ICON = {
    pv: '<rect x="4" y="5" width="16" height="11" rx="1.2"/><path d="M4 10.5h16M9.3 5v11M14.7 5v11M12 16v4M8 20h8"/>',
    wind: '<path d="M12 21V11"/><circle cx="12" cy="9" r="1.4"/><path d="M12 7.6V3M10.8 9.7 6.8 12M13.2 9.7l4 2.3"/>',
    firm: '<path d="M4 20.5V11l4 2.5V11l4 2.5V7h3l.8 13.5z"/><path d="M15.8 4.5c.7-1 2.2-1 2.9 0"/>',
    store: '<rect x="5" y="6" width="14" height="13" rx="1.5"/><path d="M9 3v3M15 3v3M9.5 10v5M14.5 11.5v2"/>',
    // A flame inside the loop of its steam cycle.
    ccgt: '<path d="M19.5 9.5A8 8 0 1 0 20 13"/><path d="M20.5 5.8 19.6 9.6 15.9 8.6"/><path d="M12 7.5c.4 1.6 2.6 2.6 2.6 5.1a2.6 2.6 0 0 1-5.2 0c0-1.3.7-2 1.3-2.6.2 1 .7 1.5 1.3 1.5 0-1.5-.5-2.6 0-4z"/>',
    // A flame with speed lines: quick to start.
    ocgt: '<path d="M14 3.5c.6 2.6 4.5 4.3 4.5 8.8a4.5 4.5 0 0 1-9 0c0-2.3 1.2-3.6 2.3-4.6.3 1.8 1.2 2.6 2.2 2.6 0-2.6-.9-4.5 0-6.8z"/><path d="M3 10.5h4M2.5 14h4.5M3.5 17.5h4"/>',
    // A mine cart of coal.
    coal: '<path d="M3.5 10.5h17l-2.2 7H5.7z"/><circle cx="8" cy="19.6" r="1.4"/><circle cx="16" cy="19.6" r="1.4"/><path d="M6.5 10.5a2.3 2.3 0 0 1 4.3-1.2 2.4 2.4 0 0 1 4.4.2 2.2 2.2 0 0 1 2.6 1"/>',
    // An atom.
    nuclear: '<circle cx="12" cy="12" r="1.5" fill="currentColor"/><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(-60 12 12)"/>',
    // Steam rising from a well above hot ground.
    geo: '<path d="M3 14h18"/><path d="M4 18c1.3-1 2.7 1 4 0s2.7-1 4 0 2.7 1 4 0 2.7-1 4 0"/><path d="M12 14v-3.5M10.5 10.5h3"/><path d="M9.5 8c-1.3-1.5 1.3-2.5 0-4.5M14.5 8c-1.3-1.5 1.3-2.5 0-4.5"/>',
    // An engine block.
    diesel: '<path d="M6.5 8h8l2 2.5h1.5V13h2.5v4H18v1.5h-2.5L13.5 20.5H8L6 18.5H4V11h2.5z"/><path d="M8.5 8V5.5h5V8M3 14.5h1"/><circle cx="11" cy="14.5" r="2.2"/>',
    // Water between a high and a low reservoir.
    phes: '<path d="M2.5 4v5.5h7V4M14.5 13v6.5h7V13"/><path d="M4 7c.8-.6 1.7.6 2.5 0s1.7-.6 2.5 0M16 17c.8-.6 1.7.6 2.5 0s1.7-.6 2.5 0"/><path d="M9.5 7.5c4 0 8 1 8 4"/><path d="M15.7 9.9l1.8 1.8 1.6-2"/>'
  };
  // A technology's picture comes from its name, as "+ Add" names it, and
  // failing that from its kind, so a saved plan needs no key of its own for it.
  var FIRM_ICON = [[/nuclear|reactor|\bsmr\b/, 'nuclear'], [/geotherm/, 'geo'], [/diesel|engine|reciprocat/, 'diesel'], [/coal|lignite/, 'coal'],
                   [/peaker|open.cycle|ocgt/, 'ocgt'], [/gas|combined|ccgt/, 'ccgt']];
  function iconKey(e){
    var n = CX.nameOf(e).toLowerCase();
    if(e.kind === 'store') return /pump|hydro|phes/.test(n) ? 'phes' : 'store';
    if(e.kind === 'firm') for(var i = 0; i < FIRM_ICON.length; i++) if(FIRM_ICON[i][0].test(n)) return FIRM_ICON[i][1];
    return e.kind;
  }
  function techIcon(e){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + TECH_ICON[iconKey(e)] + '</svg>'; }
  function tipHtml(t){ return t ? ' <i class="tip-icon" data-tip="' + esc(t) + '">?</i>' : ''; }
  function fmtField(v){ if(!isFinite(v)) return ''; return String(+(+v).toPrecision(8)); }
  function shown(e, f){ return (!f.detail || detailed()) && (!f.show || f.show(e)); }
  function fieldHtml(e, f){
    var tip = typeof f.tip === 'function' ? f.tip(e) : f.tip;
    if(f.kind === 'toggle'){
      return '<div class="toggle-row"><div class="toggle-label"><span class="tip-wrap">' + f.label + tipHtml(tip) + '</span></div><label class="toggle-switch"><input type="checkbox" data-k="' + f.k + '"' + (e[f.k] ? ' checked' : '') + '/><span class="toggle-track"><span class="toggle-knob"></span></span></label></div>';
    }
    if(f.kind === 'seg'){
      return '<div class="field-row inline"><div class="field-label">' + f.label + '</div><div class="seg-group" data-k="' + f.k + '" role="group" aria-label="' + f.label + '">' +
        f.opts.map(function(o){ return '<button type="button" class="seg-btn' + (o[0] === e[f.k] ? ' active' : '') + '" data-val="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div></div>';
    }
    if(f.kind === 'year'){
      var y = e[f.k] ? String(e[f.k]) : '';
      return '<div class="field-row inline"><div class="field-label"><span class="tip-wrap">' + f.label + tipHtml(tip) + '</span></div>' +
        '<div class="affix-wrap" data-unitless><input class="affix-input" type="text" inputmode="numeric" data-k="' + f.k + '" data-min="1900" data-max="2200" data-step="1" value="' + y + '" placeholder="' + f.blank + '"/></div></div>';
    }
    var v = e[f.k] * (f.scale || 1);
    var val = f.zeroBlank && !e[f.k] ? '' : fmtField(v);
    var pre = f.money && cur() ? '<span class="prefix">' + esc(cur()) + '</span>' : '';
    return '<div class="field-row inline"><div class="field-label"><span class="tip-wrap">' + f.label + tipHtml(tip) + '</span></div>' +
      '<div class="affix-wrap">' + pre + '<input class="affix-input' + (f.unit ? ' has-suffix' : '') + '" type="text" inputmode="decimal" data-k="' + f.k + '"' +
      ' data-min="' + f.min + '" data-max="' + f.max + '"' + (f.step ? ' data-step="' + f.step + '"' : '') + ' value="' + val + '"' + (f.blank ? ' placeholder="' + f.blank + '"' : '') + '/>' +
      (f.unit ? '<span class="suffix">' + f.unit + '</span>' : '') + '</div></div>';
  }
  function summary(e){
    var C = cur(), parts = [];
    if(e.exist > 0) parts.push(F.mw(e.exist) + ' MW' + (e.retire ? ' to ' + e.retire : ''));
    if(e.build) parts.push('new at ' + F.money(e.capex, C) + '/kW');
    else if(!(e.exist > 0)) parts.push('left out');
    return parts.join(' · ') || 'none in service';
  }
  function cardHtml(e, i){
    var open = app.open === e.id, html = '';
    html += '<div class="tech-card' + (open ? ' is-open' : '') + '" data-id="' + e.id + '">';
    html += '<div class="tech-head"><span class="tech-sw" style="background:' + CXCharts.colour(i) + '"></span>' +
      '<button type="button" class="tech-toggle" aria-expanded="' + open + '"><span class="tech-ico">' + techIcon(e) + '</span><span class="tech-text"><span class="tech-name">' + esc(CX.nameOf(e)) + '</span>' +
      '<span class="tech-sum">' + esc(summary(e)) + '</span></span><span class="tech-chev" aria-hidden="true">▾</span></button>' +
      '<span class="tech-actions">' + SharedIcon.button('duplicate', 'Duplicate this technology', 'tech-dup') + SharedIcon.button('trash', 'Remove this technology', 'tech-del') + '</span></div>';
    if(open){
      html += '<div class="tech-body"><div class="field-row inline"><div class="field-label">Name</div><input class="txt-input" type="text" data-k="name" maxlength="40" value="' + esc(CX.nameOf(e)) + '"/></div>';
      var group = null;
      FIELDS.forEach(function(f){
        if(f.group) group = f.group;
        if(!shown(e, f)) return;
        if(group){ html += '<div class="tech-sub">' + group + '</div>'; group = null; }
        html += fieldHtml(e, f);
      });
      html += derivedHtml(e) + '</div>';
    }
    return html + '</div>';
  }
  function derivedHtml(e){
    var o = plan(), C = cur(), bits = [];
    if(e.build && e.capex > 0){
      var a = CX.annuity(o.rate / 100, e.life);
      bits.push('A new kW costs <b>' + F.money(e.capex * a + e.fom, C) + '</b> a year to own at ' + F.pct(o.rate) + '%');
      if(e.learn) bits.push('<b>' + F.money(e.capex * Math.pow(1 + e.learn, o.end - o.start), C) + '/kW</b> to build by ' + o.end);
    }
    if(e.kind === 'store') bits.push('<b>' + F.mw(e.hours) + ' h</b> of energy for every MW, ' + F.pct(100 * Math.sqrt(e.rte)) + '% efficient each way' + (e.capex > 0 ? ', ' + F.money(e.capex / e.hours, C) + ' a kWh' : ''));
    return bits.length ? '<p class="derived tech-derived">' + bits.join('; ') + '.</p>' : '';
  }
  function renderTechs(){
    var list = $('techList');
    if(!app.model.tech.length){ list.innerHTML = '<p class="note">No technologies yet. Add one below.</p>'; return; }
    list.innerHTML = app.model.tech.map(cardHtml).join('');
    SharedIcon.hydrate(list);
  }
  function techOf(el){ var c = el.closest('.tech-card'); if(!c) return null; var id = +c.getAttribute('data-id'); return app.model.tech.filter(function(e){ return e.id === id; })[0] || null; }
  $('techList').addEventListener('click', function(ev){
    var e = techOf(ev.target);
    if(!e) return;
    if(ev.target.closest('.tech-del')){
      app.model.tech = app.model.tech.filter(function(x){ return x !== e; });
      if(app.open === e.id) app.open = null;
      renderTechs(); changed(); return;
    }
    if(ev.target.closest('.tech-dup')){
      var c = JSON.parse(JSON.stringify(e));
      c.id = app.model.next++;
      c.name = CX.nameOf(e) + ' copy';
      app.model.tech.splice(app.model.tech.indexOf(e) + 1, 0, c);
      app.open = c.id;
      renderTechs(); changed(); return;
    }
    if(ev.target.closest('.tech-toggle')){
      app.open = app.open === e.id ? null : e.id;
      renderTechs(); return;
    }
    var seg = ev.target.closest('.seg-btn');
    if(seg){
      var g = seg.closest('.seg-group'), k = g.getAttribute('data-k');
      if(k === 'kind' && e.kind !== seg.getAttribute('data-val')){ e.kind = seg.getAttribute('data-val'); renderTechs(); changed(); }
    }
  });
  function readInput(e, el){
    var k = el.getAttribute('data-k'), f = FIELDS.filter(function(x){ return x.k === k; })[0];
    if(k === 'name'){
      e.name = String(el.value).slice(0, 40).trim();
      if(e.name === CX.autoName(e)) e.name = '';
      return 'name';
    }
    if(!f) return null;
    if(f.kind === 'toggle'){ e[k] = el.checked ? 1 : 0; return 'struct'; }
    var raw = String(el.value).trim();
    if(f.kind === 'year' || (f.zeroBlank && raw === '')){ var y = CX.num(raw); e[k] = raw === '' || !isFinite(y) ? 0 : Math.round(y); if(f.kind === 'year' && (e[k] < 1900 || e[k] > 2200)) e[k] = 0; return k === 'exist' ? 'struct' : 'value'; }
    var v = CX.num(raw);
    if(!isFinite(v)) return null;
    v = v / (f.scale || 1);
    var sp = CX.SPEC[k];
    if(sp && sp[0] === 'n') v = Math.min(sp[2], Math.max(sp[1], v));
    var before = e[k];
    e[k] = v;
    // A field that shows or hides others redraws the card once the number settles.
    return (k === 'exist' && (before > 0) !== (v > 0)) || (k === 'unit' && (before > 0) !== (v > 0)) ? 'struct' : 'value';
  }
  $('techList').addEventListener('input', function(ev){
    var el = ev.target, e = techOf(el);
    if(!e || !el.hasAttribute('data-k')) return;
    var kind = readInput(e, el);
    if(!kind) return;
    var head = el.closest('.tech-card').querySelector('.tech-head');
    head.querySelector('.tech-name').textContent = CX.nameOf(e);
    if(el.getAttribute('data-k') === 'name') head.querySelector('.tech-ico').innerHTML = techIcon(e);
    head.querySelector('.tech-sum').textContent = summary(e);
    var d = el.closest('.tech-body').querySelector('.tech-derived'), tmp = document.createElement('div');
    tmp.innerHTML = derivedHtml(e);
    if(d && tmp.firstChild) d.innerHTML = tmp.firstChild.innerHTML;
    if(kind === 'struct' && el.type === 'checkbox') renderTechs();
    changed();
  });
  $('techList').addEventListener('change', function(ev){
    var el = ev.target, e = techOf(el);
    if(!e || !el.hasAttribute('data-k') || el.type === 'checkbox') return;
    var k = el.getAttribute('data-k');
    if(k === 'exist' || k === 'unit') renderTechs();
  });
  // + Add: a menu of technologies, each with typical costs to start from.
  (function(){
    var menu = $('addMenu'), btn = $('addTechBtn');
    menu.innerHTML = CX.NEW_ORDER.map(function(k){
      var t = CX.NEW[k];
      return '<button type="button" class="add-opt" data-key="' + k + '"><span class="tech-ico">' + techIcon(t) + '</span>' + esc(t.name) + '</button>';
    }).join('');
    function show(on){ menu.hidden = !on; btn.setAttribute('aria-expanded', String(on)); }
    btn.addEventListener('click', function(){ show(menu.hidden); });
    menu.addEventListener('click', function(ev){
      var b = ev.target.closest('.add-opt');
      if(!b) return;
      if(app.model.tech.length >= CX.MAX_TECH){ alert('This tool plans up to ' + CX.MAX_TECH + ' technologies.'); return; }
      var t = CX.newTech(app.model, b.getAttribute('data-key'));
      app.model.tech.push(t);
      app.open = t.id;
      show(false);
      renderTechs(); changed();
      var card = document.querySelector('.tech-card[data-id="' + t.id + '"]');
      if(card) card.scrollIntoView({ block: 'nearest' });
    });
    document.addEventListener('click', function(ev){ if(!menu.hidden && !ev.target.closest('.add-tech')) show(false); });
  })();

  /* ── The Run gate ──
     One run takes from a fraction of a second to a minute, so the page never
     re-solves on its own: a change steps the results back and lights the button. */
  function solveKey(){ return JSON.stringify(CX.compact(app.model)) + '|' + JSON.stringify(plan()); }
  function isStale(){ return !app.res || solveKey() !== app.solvedKey; }
  var running = false, runQueued = null, queuedResolve = null, current = null;
  // The solve in hand and any queued behind it, done when they are.
  function solved(){ return running ? (runQueued || current) : Promise.resolve(); }
  function updateStale(){
    var stale = !running && isStale();
    document.body.classList.toggle('is-stale', stale && !!app.res);
    $('runBtn').classList.toggle('needs-run', stale);
    $('staleNote').textContent = app.res ? 'The plan changed. Press Run plan to solve it.' : 'Press Run plan to solve it.';
    if(!app.res) document.body.classList.toggle('is-stale', false);
  }
  function changed(){
    syncForm();
    updateStale();
    renderChecks(CX.validate(app.model, plan()));
    if(persist) persist.schedule();
  }
  function run(){
    if(running){
      if(!runQueued) runQueued = new Promise(function(r){ queuedResolve = r; });
      return runQueued;
    }
    var model = CX.load(CX.compact(app.model)), o = plan(), key = solveKey();
    running = true;
    $('runBtn').disabled = true;
    $('runBtn').textContent = '▶ Solving…';
    var v = CX.validate(model, o);
    renderChecks(v);
    setVerdictBusy(o, model);
    var job = v.errors.length ? Promise.resolve({ report: { ok: false, error: '', blocked: v.errors } })
      : call({ model: CX.compact(model), opts: o }).then(function(d){ return d.res; });
    return current = job.then(function(res){
      res.validation = v;
      app.res = res;
      app.resModel = model;
      app.solvedKey = key;
      try { performance.mark('cx-solved'); } catch(e){}
    }, function(err){
      app.res = { report: { ok: false, error: 'The optimisation engine could not load. Check your connection and press Run plan again.' } };
      app.solvedKey = null;
      if(window.console) console.warn(err);
    }).then(function(){
      running = false;
      $('runBtn').disabled = false;
      $('runBtn').textContent = '▶ Run plan';
      showResults();
      updateStale();
      if(runQueued){ var q = queuedResolve; runQueued = null; queuedResolve = null; run().then(q); }
      return app.res;
    });
  }
  app.run = run;
  $('runBtn').addEventListener('click', function(){ run(); });
  document.addEventListener('keydown', function(ev){ if((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter'){ ev.preventDefault(); run(); } });

  /* ── Checks: what stops a run, and what the run will do ── */
  function renderChecks(v){
    var items = v.errors.map(function(x){ return '<li class="err">' + esc(x.msg) + '</li>'; })
      .concat(v.warnings.map(function(x){ return '<li>' + esc(x.msg) + '</li>'; }));
    $('issueList').innerHTML = items.join('');
    $('checksCard').hidden = !items.length;
  }

  /* ── The answer ── */
  function shownResults(){ return app.res && app.res.report && app.res.report.ok ? app.res : null; }
  function setVerdictBusy(o, model){
    if(app.res && app.res.report && app.res.report.ok) return;
    SharedVerdict.set('verdict', { tone: '', title: 'Solving the plan for ' + o.start + ' to ' + o.end + '…', body: 'PSA.js builds the multi-year problem and HiGHS solves it in your browser.' });
  }
  function list(parts){ return parts.length < 2 ? parts.join('') : parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1]; }
  // The model the results were solved for, so a plan edited since still reads them right.
  function solvedModel(){ return app.res && app.resModel ? app.resModel : app.model; }
  function nameById(id){ var e = solvedModel().tech.filter(function(x){ return x.id === +id; })[0]; return e ? CX.nameOf(e) : '?'; }
  function techById(model, id){ return model.tech.filter(function(x){ return x.id === +id; })[0]; }
  // What a year builds, largest first, as "1,429 MW of Wind".
  function buildsIn(res, k){
    return res.order.filter(function(id){ return res.tech[id].built[k] >= 0.5; })
      .sort(function(a, b){ return res.tech[b].built[k] - res.tech[a].built[k]; });
  }
  function shedShare(T){
    var s = 0, e = 0;
    T.shedEnergy.forEach(function(v, k){ s += v; e += T.energy[k]; });
    return e > 0 ? s / e : 0;
  }
  // Unserved energy worth a word: more than a thousandth of a percent of demand.
  var SHED_NOTE = 1e-5;
  function sharePct(x){ var p = 100 * x; return p >= 0.1 ? F.pct(p) : String(+p.toPrecision(2)); }
  function verdict(res, model){
    var o = res.report.opts, T = res.totals, C = cur(), years = res.periods, K = years.length;
    var cost = 'Present cost <span class="v-num">' + F.big(T.npv, C) + '</span>, a levelised cost of energy of ' + F.price(T.avgCost, C) + ' per MWh served.';
    var shed = shedShare(T) > SHED_NOTE ? ' ' + sharePct(shedShare(T)) + '% of demand goes unserved on the toughest days, where building for it would cost more than the value of lost load.' : '';
    if(!(T.built >= 0.5)){
      return { tone: '', title: 'Build nothing: what is in service ' + (shed ? 'is the cheapest plan to ' + o.end + '.' : 'meets the demand to ' + o.end + '.'), body: cost + shed };
    }
    var totals = years.map(function(_, k){ var s = 0; res.order.forEach(function(id){ s += res.tech[id].built[k]; }); return s; });
    var first = 0;
    while(first < K && !(totals[first] >= 0.5)) first++;
    var lead = buildsIn(res, first).slice(0, 2).map(function(id){ return F.mw(res.tech[id].built[first]) + ' MW of ' + nameById(id); });
    var title = 'Build <span class="v-num">' + F.mw(T.built) + ' MW</span> by ' + years[K - 1] + ', starting with ' + list(lead) + ' in ' + years[first] + '.';
    var body = [];
    var big = first;
    totals.forEach(function(v, k){ if(v > totals[big] + 1e-6) big = k; });
    if(big !== first){
      var top = buildsIn(res, big)[0];
      body.push('The most comes in ' + years[big] + ': ' + F.mw(totals[big]) + ' MW, led by ' + F.mw(res.tech[top].built[big]) + ' MW of ' + nameById(top) + '.');
    }
    var retire = [];
    model.tech.forEach(function(e){
      var d = res.tech[e.id];
      if(!d || !(e.exist > 0) || !e.retire) return;
      for(var k = 1; k < K; k++) if(d.exist[k - 1] > 0 && !(d.exist[k] > 0)){ retire.push(CX.nameOf(e) + ' retires by ' + years[k]); break; }
    });
    if(retire.length) body.push(list(retire) + '.');
    body.push(cost);
    return { tone: '', title: title, body: body.join(' ') + shed };
  }
  function showResults(){
    var res = app.res, r = res && res.report;
    ['mBuilt', 'mNpv', 'mAvg', 'mClean'].forEach(function(id){ $(id).classList.remove('neg'); $(id).classList.remove('warn'); });
    if(!r){ clearKpis(); renderCharts(); renderTable(); renderAssumptions(); return; }
    if(r.blocked || !r.ok){
      var why = r.blocked ? r.blocked.map(function(x){ return x.msg; }).join(' ') : (r.error || 'No result.');
      SharedVerdict.set('verdict', { tone: 'warn', title: r.blocked ? 'Not solved: the plan has ' + (r.blocked.length === 1 ? 'a problem' : 'problems') + ' to fix first.' : 'Not solved.', body: esc(why) });
      clearKpis();
      renderCharts(); renderTable(); renderAssumptions();
      return;
    }
    var T = res.totals, C = cur(), K = res.periods.length, last = res.periods[K - 1], model = solvedModel();
    SharedVerdict.set('verdict', verdict(res, model));
    // New capacity
    $('mBuilt').textContent = F.mw(T.built) + ' MW';
    var top = res.order.map(function(id){ return [id, res.tech[id].built.reduce(function(a, b){ return a + b; }, 0)]; }).filter(function(x){ return x[1] >= 0.5; })
      .sort(function(a, b){ return b[1] - a[1]; });
    $('mBuiltSub').textContent = top.length ? top.slice(0, 3).map(function(x){ return nameById(x[0]) + ' ' + F.mw(x[1]) + ' MW'; }).join(', ') + (top.length > 3 ? ', and ' + (top.length - 3) + ' more' : '') + '.' : 'Nothing new is built.';
    // Present cost
    $('mNpv').textContent = F.big(T.npv, C);
    var pv = function(a){ var s = 0; a.forEach(function(v, k){ s += v * res.disc[k]; }); return s; };
    var capex = pv(T.capex), fixed = pv(T.fom), runC = pv(T.vom) + pv(T.co2cost), lost = pv(T.shedCost);
    $('mNpvSub').textContent = 'Discounted to ' + res.periods[0] + ' at ' + F.pct(res.report.opts.rate) + '%: capital ' + F.big(capex, C) + ', fixed ' + F.big(fixed, C) + ', running ' + F.big(runC, C) +
      (lost > 0.5 ? ', lost load ' + F.big(lost, C) : '') + '.';
    // Levelised cost of energy: present cost over the present value of the energy served
    $('mAvg').textContent = F.price(T.avgCost, C) + '/MWh';
    var a0 = T.served[0] > 0 ? T.cost[0] / T.served[0] : NaN, a1 = T.served[K - 1] > 0 ? T.cost[K - 1] / T.served[K - 1] : NaN;
    var over = 'Over the whole plan, discounted at ' + F.pct(res.report.opts.rate) + '%.';
    $('mAvgSub').textContent = K > 1 ? over + ' A year alone: ' + F.price(a0, C) + ' in ' + res.periods[0] + ', ' + F.price(a1, C) + ' in ' + last + '.' : over;
    // Clean energy in the last year, or the shortfall when there is one
    var shedAll = shedShare(T);
    var clean = T.gen[K - 1] > 0 ? 100 * T.cleanGen[K - 1] / T.gen[K - 1] : NaN;
    $('mCleanLabel').innerHTML = '<span class="tip-wrap">Clean energy in ' + last + ' <i class="tip-icon" data-tip="The share of that year’s generation from plants that emit no CO2. Storage moves energy, so it is not counted.">?</i></span>';
    $('mClean').textContent = F.pct(clean) + '%';
    $('mCleanSub').textContent = 'CO2 ' + F.co2(T.emis[0]) + ' in ' + res.periods[0] + ', ' + F.co2(T.emis[K - 1]) + ' in ' + last + '.' +
      (shedAll > SHED_NOTE ? ' Unserved: ' + sharePct(shedAll) + '% of demand.' : '');
    renderCharts();
    renderTable();
    renderAssumptions();
  }
  function clearKpis(){
    ['mBuilt', 'mNpv', 'mAvg', 'mClean'].forEach(function(id){ $(id).textContent = '–'; $(id + 'Sub').textContent = ''; });
  }

  /* ── Charts ──
     Each chart's own card, or its panel where two share one: Energy by
     source and, folded under it, the Typical days. */
  var CARD = { cap: 'capCard', energy: 'energyPanel', day: 'dayCard', cost: 'costCard' };
  var CHART_NAME = { cap: 'Capacity and when to build', energy: 'Energy by source', day: 'Typical days', cost: 'Cost by year' };
  var folds = {};
  function display(){ return { cur: cur(), year: app.year }; }
  function syncYearPick(res){
    var sel = $('dayYear');
    if(!res){ sel.innerHTML = ''; return; }
    var want = res.periods.map(function(y, k){ return '<option value="' + k + '">' + y + '</option>'; }).join('');
    if(sel.innerHTML !== want) sel.innerHTML = want;
    app.year = Math.max(0, Math.min(res.periods.length - 1, app.year | 0));
    sel.value = String(app.year);
  }
  function renderCharts(){
    var res = shownResults();
    syncYearPick(res);
    var show = window.CXCharts ? CXCharts.render(res, solvedModel(), display(), function(k){ setYear(k, true); }) : {};
    Object.keys(CARD).forEach(function(k){ $(CARD[k]).hidden = !show[k]; });
    $('energyCard').hidden = !show.energy && !show.day;
  }
  // A folded chart opens before anything is done with it.
  function unfold(k){ var f = folds[k]; if(f && !f.isOpen()) f.open(); }
  // A year clicked on a chart by year opens its typical days.
  function setYear(k, scroll){
    var res = shownResults();
    if(!res) return;
    app.year = Math.max(0, Math.min(res.periods.length - 1, k | 0));
    $('dayYear').value = String(app.year);
    CXCharts.year(app.year);
    if(scroll && !EMBED){
      unfold('energy');
      unfold('day');
      $('dayCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
  $('dayYear').addEventListener('change', function(){ setYear(+this.value); });
  function fileBase(){ return 'capacity-plan'; }
  Object.keys(CARD).forEach(function(k){
    var title = function(){ return CHART_NAME[k] + (k === 'day' && shownResults() ? ', ' + shownResults().periods[app.year] : ''); };
    var file = function(ext){ return fileBase() + '-' + CHART_NAME[k].toLowerCase().replace(/[^a-z]+/g, '-') + '.' + ext; };
    $(k + 'SvgBtn').addEventListener('click', function(){ var b = CXCharts.svg(k, title()); if(b) CXCharts.save(b, file('svg')); });
    $(k + 'PngBtn').addEventListener('click', function(){ CXCharts.png(k, title()).then(function(b){ CXCharts.save(b, file('png')); }); });
    $(k + 'CopyBtn').addEventListener('click', function(){ SharedShare.copyImage(function(){ return CXCharts.png(k, title()); }, this); });
    $(k + 'ZoomBtn').addEventListener('click', function(){ CXCharts.resetZoom(k); });
    /* Every chart but the first folds away under its title, open until the
       reader closes it; the typical days start folded. An embed shows its
       one chart open, whatever this device last chose. */
    if(k === 'cap' || EMBED || !window.SharedFold) return;
    folds[k] = SharedFold.attach($(CARD[k]), {
      key: 'capacityexpansion-planner-' + (k === 'day' ? 'typical-days' : k), open: k !== 'day', text: { show: 'Show chart', hide: 'Hide chart' },
      bodies: ['#' + k + 'Sub'].concat(k === 'day' ? ['.day-pick'] : [], ['#' + k + 'Legend', '.canvas-wrap', '#' + k + 'Hover']),
      onOpen: function(){ var ch = CXCharts.get(k); if(ch) ch.resize(); }
    });
    // Its Share menu and zoom reset open it first, so an export draws the chart.
    $(CARD[k]).querySelector('.chart-head').addEventListener('click', function(e){
      if(e.target.closest('.btn-cluster') && !e.target.closest('.fold-btn')) unfold(k);
    }, true);
  });

  /* ── Tables ── */
  var tableKind = 'cap';
  function tableData(){
    var res = shownResults(), m = solvedModel(), C = cur(), rows = [], head = ['Technology'], units = '';
    if(!res) return { head: head, rows: rows, units: 'Run the plan to fill the table.' };
    var yrs = res.periods, K = yrs.length, T = res.totals;
    var techs = m.tech.filter(function(e){ return res.tech[e.id]; });
    var row = function(label, vals, fmt, neg){ rows.push({ cells: [label].concat(vals.map(fmt)), neg: neg || [] }); };
    if(tableKind === 'cap' || tableKind === 'build' || tableKind === 'energy'){
      head = head.concat(yrs.map(String));
      var key = { cap: 'cap', build: 'built', energy: 'gen' }[tableKind];
      techs.forEach(function(e){
        var d = res.tech[e.id];
        row(CX.nameOf(e) + (tableKind === 'energy' && e.kind === 'store' ? ' (discharge)' : ''), d[key], tableKind === 'energy' ? F.gwh : F.mw);
        if(tableKind === 'build' && d.retired.some(function(v){ return v > 1e-6; })) row(CX.nameOf(e) + ' retired', d.retired.map(function(v){ return -v; }), F.mw, yrs.map(function(_, i){ return d.retired[i] > 1e-6 ? i + 1 : -1; }));
      });
      if(tableKind === 'cap'){ row('Total', yrs.map(function(_, k){ var s = 0; techs.forEach(function(e){ s += res.tech[e.id].cap[k]; }); return s; }), F.mw); row('Peak demand', T.peak, F.mw); }
      if(tableKind === 'build') row('Total built', yrs.map(function(_, k){ var s = 0; techs.forEach(function(e){ s += res.tech[e.id].built[k]; }); return s; }), F.mw);
      if(tableKind === 'energy'){
        if(T.shedEnergy.some(function(v){ return v > 1e-3; })) row('Shortfall (load shed)', T.shedEnergy, F.gwh, yrs.map(function(_, i){ return T.shedEnergy[i] > 1e-3 ? i + 1 : -1; }));
        row('Demand', T.energy, F.gwh);
      }
      units = { cap: 'MW in service in each decision year, storage at its power rating.',
                build: 'MW coming into service in each decision year; what retires by then is below zero.',
                energy: 'GWh in a year of each decision year. Storage counts what it gives back.' }[tableKind];
    } else if(tableKind === 'cost'){
      head = ['Cost'].concat(yrs.map(String));
      row('Capital (annuities)', T.capex, function(v){ return F.money(v, C); });
      row('Fixed O&M', T.fom, function(v){ return F.money(v, C); });
      row('Fuel and running', T.vom, function(v){ return F.money(v, C); });
      if(T.co2cost.some(function(v){ return v > 0.5; })) row('Carbon', T.co2cost, function(v){ return F.money(v, C); });
      if(T.shedCost.some(function(v){ return v > 0.5; })) row('Lost load cost', T.shedCost, function(v){ return F.money(v, C); });
      row('Total', T.cost, function(v){ return F.money(v, C); });
      row('Levelised cost per MWh', T.cost.map(function(c, k){ return T.served[k] > 0 ? c / T.served[k] : NaN; }), function(v){ return F.price(v, C); });
      row('Discount factor', res.disc, function(v){ return (Math.round(v * 1000) / 1000).toFixed(3); });
      units = 'A year’s costs in each decision year, in ' + (C || 'currency units') + ' at the first year’s prices and not discounted. The discount factor turns a year’s cost into today’s money for every year the decision year stands for.';
    } else {
      head = ['Decision year', 'Years it stands for', 'Peak demand MW', 'Demand GWh', 'Unserved GWh', 'Capacity MW', 'Firm and storage MW', 'Clean share %', 'CO2', 'Cost a year', 'Levelised cost per MWh'];
      yrs.forEach(function(y, k){
        var cap = 0; techs.forEach(function(e){ cap += res.tech[e.id].cap[k]; });
        rows.push({ cells: [String(y), String(res.years[k]), F.mw(T.peak[k]), F.gwh(T.energy[k]), F.gwh(T.shedEnergy[k]), F.mw(cap), F.mw(T.firm[k]),
          F.pct(T.gen[k] > 0 ? 100 * T.cleanGen[k] / T.gen[k] : NaN), F.co2(T.emis[k]), F.money(T.cost[k], C), F.price(T.served[k] > 0 ? T.cost[k] / T.served[k] : NaN, C)],
          neg: T.shedEnergy[k] > 1e-3 ? [4] : [] });
      });
      units = 'One row per decision year. Money in ' + (C || 'currency units') + ' at the first year’s prices; firm capacity is derated by availability.';
    }
    return { head: head, rows: rows, units: units };
  }
  /* A long header goes on two lines, so a column of short figures is not as
     wide as its title: its unit on the second when the rest is short ("Peak
     demand / MW"), else split where the two lines come out most even ("Years
     it / stands for"). The CSV keeps each title on one line. */
  function headHtml(x){
    var m = /^(.{1,14}) (MW|GWh|MWh|%|per \S+)$/.exec(x), w = x.split(' '), at = 1, worst = Infinity;
    if(m) return esc(m[1]) + '<br>' + esc(m[2]);
    if(x.length <= 10 || w.length < 2) return esc(x);
    for(var i = 1; i < w.length; i++){
      var most = Math.max(w.slice(0, i).join(' ').length, w.slice(i).join(' ').length);
      if(most < worst){ worst = most; at = i; }
    }
    return esc(w.slice(0, at).join(' ')) + '<br>' + esc(w.slice(at).join(' '));
  }
  function renderTable(){
    var t = tableData();
    $('tableUnits').textContent = t.units;
    var h = '<table><thead><tr>' + t.head.map(function(x){ return '<th>' + headHtml(x) + '</th>'; }).join('') + '</tr></thead><tbody>';
    t.rows.forEach(function(r){
      h += '<tr>' + r.cells.map(function(c, i){ return '<td' + (r.neg.indexOf(i) >= 0 ? ' class="neg"' : '') + '>' + esc(c) + '</td>'; }).join('') + '</tr>';
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
    a.download = fileBase() + '-' + { cap: 'capacity', build: 'new-build', energy: 'energy', cost: 'costs', year: 'years' }[tableKind] + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
  });
  if(window.SharedFold) SharedFold.attach($('tablesCard'), { key: 'capacityexpansion-planner', bodies: ['#tableUnits', '#tableWrap'] });

  /* ── What this assumes, from the reader's own plan ── */
  function renderAssumptions(){
    var res = shownResults(), m = res ? solvedModel() : app.model, o = res ? res.report.opts : plan(), C = cur(), li = [];
    var P = CX.periods(o), S = CX.sample(m, o), Cl = CX.CLIMATES[o.climate];
    if(!m.tech.length){ $('assumptions').innerHTML = '<li>Add the plants in service and the technologies that can be built, then press Run plan.</li>'; return; }
    li.push('<strong>' + P.length + ' decision year' + (P.length === 1 ? '' : 's') + ' from ' + o.start + ' to ' + o.end + ',</strong> each standing for the years up to the next at its own demand: ' +
      F.mw(o.peak) + ' MW at the peak in ' + o.start + ', growing ' + F.pct(o.growth) + '% a year.');
    li.push('<strong>Each year is run hour by hour over ' + S.blocks.length + ' typical ' + (o.sample === 'week' ? 'weeks and days' : 'days') + '</strong> of a ' + Cl.label.toLowerCase().replace(/,.*/, '') + ' climate (' +
      Cl.seasons.map(function(s){ return s.name.toLowerCase() + ' at ' + Math.round(s.dem * 100) + '% of the peak'; }).join(', ') + '), each hour weighted by the hours of the year it stands for.');
    if(o.stress) li.push('<strong>A still, overcast weekday at the peak</strong> stands for ' + CX.STRESS.days + ' days of ' + S.peakSeason.toLowerCase() + ', with a quarter of the sun and a tenth of the wind.');
    li.push('<strong>One copper-plate bus:</strong> every plant can serve every load, with no grid limits or losses, and every hour is known in advance.');
    li.push('<strong>Capital is paid as an annuity at ' + F.pct(o.rate) + '% a year</strong> over each plant’s life, only for its years inside the plan, and every year’s cost is discounted to ' + o.start + ' at the same rate. All money is at ' + o.start + ' prices.');
    var sol = m.tech.filter(function(e){ return isPvWind(e) && (e.exist > 0 || e.build); });
    if(sol.length) li.push('<strong>Solar and wind follow their shape</strong> through each typical day, scaled so a year gives ' + list(sol.map(function(e){ return CX.nameOf(e) + ' ' + F.pct(100 * e.cf) + '%'; })) + ' of its rating × 8,760 h. Output may be spilled.');
    var firm = m.tech.filter(function(e){ return e.kind === 'firm' && (e.exist > 0 || e.build); });
    if(firm.some(function(e){ return e.avail < 1; })) li.push('<strong>Firm plants give at most their availability in any hour</strong>: ' + list(firm.filter(function(e){ return e.avail < 1; }).map(function(e){ return CX.nameOf(e) + ' ' + F.pct(100 * e.avail) + '%'; })) + '. They can run anywhere from zero to that, with no start-up costs or minimum output.');
    else if(firm.length) li.push('<strong>Firm plants can run anywhere from zero to their rating</strong> in any hour, with no start-up costs, minimum output or outages.');
    var st = m.tech.filter(function(e){ return e.kind === 'store' && (e.exist > 0 || e.build); });
    if(st.length) li.push('<strong>Storage loses its round-trip efficiency</strong> half on the way in and half on the way out, carries its charge from one typical day into the next, and ends each year where it started.');
    if(m.tech.some(function(e){ return e.build && e.learn; })) li.push('<strong>Capital costs change every year,</strong> compounded from ' + o.start + ': ' + list(m.tech.filter(function(e){ return e.build && e.learn; }).map(function(e){ return CX.nameOf(e) + ' ' + (e.learn > 0 ? '+' : '−') + F.pct(Math.abs(100 * e.learn)) + '%'; })) + ' a year.');
    if(m.tech.some(function(e){ return e.build && e.unit > 0; })) li.push('<strong>Some plants come in whole units,</strong> so the plan is a mixed-integer problem, solved to within ' + (o.gap * 100) + '% of the best possible cost.');
    if(m.tech.some(function(e){ return e.build && e.max > 0; })) li.push('<strong>Build limits hold at every decision year</strong>, existing capacity included: ' + list(m.tech.filter(function(e){ return e.build && e.max > 0; }).map(function(e){ return CX.nameOf(e) + ' ' + F.mw(e.max) + ' MW'; })) + '.');
    if(o.carbon > 0) li.push('<strong>Carbon is priced at ' + F.money(o.carbon, C) + ' a tonne</strong> in ' + o.start + (o.carbonGrow > 0 ? ', rising ' + F.pct(o.carbonGrow) + '% a year to ' + F.money(CX.carbonAt(o, P[P.length - 1].year), C) + ' in ' + P[P.length - 1].year : '') + '.');
    if(o.netZero) li.push('<strong>No CO2 from ' + o.nzYear + ':</strong> from that decision year on, no plant that emits may run.');
    if(o.shed) li.push('<strong>Demand may go unserved at ' + F.money(o.voll, C) + ' per MWh</strong> when that is cheaper than building for it.');
    else li.push('<strong>Every MW of demand must be served:</strong> with no load shedding, a plan that cannot is infeasible.');
    li.push('<strong>No reserve margin is held</strong> beyond what the typical days need, and plants can be retired only on their own dates.');
    $('assumptions').innerHTML = li.map(function(x){ return '<li>' + x + '</li>'; }).join('');
  }

  /* ── Quick Start ── */
  function applyPreset(key){
    var p = CX.PRESETS[key];
    if(!p) return;
    resetForm();
    // A Quick Start's costs are in US dollars, and its technologies open simple.
    $('cxCur').value = '$';
    $('cxDetail').value = 'simple';
    var f = p.fields || {};
    Object.keys(f).forEach(function(k){ setField(k, f[k]); });
    app.model = CX.load(p.plan);
    app.open = null;
    app.year = 0;
    lastProfile = $('cxProfile').value;
    app.res = null; app.solvedKey = null;
    renderTechs();
    syncForm();
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
    renderTechs();
    if(app.res) renderCharts();
  });

  /* ── Tabs ── */
  function showTab(nm){
    Array.prototype.forEach.call(document.querySelectorAll('.ctrl-tab'), function(b){ b.classList.toggle('active', b.getAttribute('data-tab') === nm); });
    Array.prototype.forEach.call(document.querySelectorAll('.ctrl-panel'), function(p){ p.classList.toggle('active', p.id === 'tab-' + nm); });
  }
  Array.prototype.forEach.call(document.querySelectorAll('.ctrl-tab'), function(b){
    b.addEventListener('click', function(){ showTab(b.getAttribute('data-tab')); });
  });

  /* ── The form's own events ── */
  if(window.SharedSeg){
    SharedSeg.fromSelect($('cxStep'), { ariaLabel: 'Years between decisions', labelOf: function(o){ return o.textContent; } });
    var detailSeg = SharedSeg.fromSelect($('cxDetail'), { ariaLabel: 'Detail', labelOf: function(o){ return o.textContent; } });
    // Beside its label it keeps its own size.
    if(detailSeg) detailSeg.group.setAttribute('data-seg-fit', 'off');
  }
  $('cxDetail').addEventListener('change', function(){ renderTechs(); });
  $('cxCur').addEventListener('change', function(){ renderTechs(); if(app.res) showResults(); });
  Object.keys(FIELD).forEach(function(k){
    var el = $(FIELD[k]);
    el.addEventListener('input', changed);
    el.addEventListener('change', changed);
  });

  /* ── Mini cache, scenario files and Share links ── */
  var persist = null, restoredAtLoad = false;
  persist = Persist.init('capacityexpansion-planner', {
    extra: {
      save: function(){ return CX.compact(app.model); },
      // Something that is not a saved plan at all leaves the one on screen.
      restore: function(d){ if(!d || typeof d !== 'object') return; app.model = CX.load(d); restoredAtLoad = !persist; }
    },
    // A scenario file or a Share link: the whole plan is replaced and solved.
    // (The mini cache restores inside init, before persist exists; start-up below handles that.)
    onRestore: function(){ if(persist) return afterRestore(); }
  });
  function afterRestore(){
    app.open = null;
    app.year = 0;
    app.res = null; app.solvedKey = null;
    lastProfile = $('cxProfile').value;
    renderTechs();
    syncForm();
    Array.prototype.forEach.call(document.querySelectorAll('.quick-start-btn.active'), function(b){ b.classList.remove('active'); });
    return run();
  }
  SharedScenario.mount('.quick-start-row', { tool: 'capacityexpansion-planner', persist: persist });
  // The chart's view rides in a link: which year the typical days show. It is
  // set before the plan is solved, so the chart opens on it.
  // An embed or a link sizes and settles once its plan is solved, which a
  // restore only starts: every chart waits on the solve.
  SharedShare.view('dayCanvas', {
    save: function(){ return app.year ? { year: app.year } : undefined; },
    // A link to the typical days opens them.
    load: function(v){ if(v && isFinite(v.year)) app.year = v.year | 0; unfold('energy'); unfold('day'); return solved(); }
  });
  ['capCanvas', 'energyCanvas', 'costCanvas'].forEach(function(key){ SharedShare.view(key, { load: solved }); });
  // When to build went into the capacity chart: its embeds and links open that.
  if(SharedShare.alias) SharedShare.alias('buildCanvas', 'capCanvas');

  /* ── Start: draw at once, solve as soon as the engine is in ── */
  if(!restoredAtLoad && !EMBED){
    var p0 = CX.PRESETS[CX.PRESET_DEFAULT];
    Object.keys(p0.fields || {}).forEach(function(k){ setField(k, p0.fields[k]); });
  }
  lastProfile = $('cxProfile').value;
  renderTechs();
  syncForm();
  renderChecks(CX.validate(app.model, plan()));
  showResults();
  updateStale();
  try { performance.mark('cx-first-render'); } catch(e){}
  // An embed solves the scenario its link carries, once SharedShare has loaded it.
  if(!EMBED) run();

  // The guided tour (tour.js) points at the results, so a plan that changed
  // since its last run is solved first.
  window.__CX_TOUR = { ensureResults: function(){ if(!running && isStale()) return run(); } };
  window.__cx = { app: app, CX: CX, run: run, applyPreset: applyPreset, plan: plan, setYear: setYear, unfold: unfold };
})();
