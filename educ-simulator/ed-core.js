/* ED/UC Simulator: the network model, its saved form, the time series,
   validation and the bridge to the PSA.js optimiser. No DOM here: the page,
   its Web Worker, the build's self-test and the audit all load this same file.

   ── The saved form is frozen ──────────────────────────────────────────────
   A reader's network lives on in the mini cache, scenario files, Share links
   and embeds, so everything below that names a saved value is a handle, not a
   label. Never rename a key, a class name, an enum value, a profile key or a
   preset key, and never change a DEFAULTS value (a key that is missing from a
   saved network means that default). Add new keys with a default that
   reproduces the old result, and migrate in load().

     { v:1, name:'…', next:<id>, el:[ element… ] }

   An element is { c:<PyPSA class>, id:<int>, …attributes } with the bus
   references bus (one-port devices) or bus0/bus1 (branches) as element ids.
   Attributes are PyPSA's where PyPSA has one, in PyPSA units, plus:
     name   omitted when it is the automatic "<Word> <id>"
     at     geometry, in grid units (ED.G px each), as in the Load Flow
            Simulator: Bus [x, y, w] or [x, y, w, 1] for a vertical bar;
            device [a, s] (offset along its bar, side) or [x, y] on no bus;
            branch [a0, a1, m]
     lb     a per-element label override, a bitmask over ED.LABELS[c]
     prof   (Load, Generator) the hourly shape: '' for flat, a key of
            ED.PROFILES, or 24 numbers (per unit of the peak or the rating)
     init   (Generator) 1 if the unit was running before the first hour
     eff    (StorageUnit) round-trip efficiency, split evenly between
            charging and discharging
     soc0   (StorageUnit) state of charge at the start, per unit of capacity
     cyclic (StorageUnit) 1: it must end the horizon where it started
     both   (Link) 1: it can carry power either way
     grid   (Generator) 1 draws it as an external grid; the model ignores it
     style  how it is drawn, never what it computes
   A Line's s_nom of 0 means no limit, as in MATPOWER. A ramp limit of 1
   (100% of the rating per hour) means none. Only values that differ from
   DEFAULTS are written. */
(function(root){
  'use strict';
  var ED = root.ED = root.ED || {};

  ED.VERSION = 1;
  ED.G = 10;

  var CLASSES = ['Bus', 'Line', 'Transformer', 'Generator', 'Load', 'StorageUnit', 'Link'];
  var BRANCH = { Line: 1, Transformer: 1, Link: 1 };
  var PASSIVE = { Line: 1, Transformer: 1 };
  var DEVICE = { Generator: 1, Load: 1, StorageUnit: 1 };
  var WORD = { Bus: 'Bus', Line: 'Line', Transformer: 'Transformer', Generator: 'Generator', Load: 'Load',
               StorageUnit: 'Storage', Link: 'Link' };
  ED.CLASSES = CLASSES; ED.BRANCH = BRANCH; ED.PASSIVE = PASSIVE; ED.DEVICE = DEVICE; ED.WORD = WORD;

  var DEFAULTS = {
    Bus:         { v_nom: 1, style: '' },
    Line:        { type: '', length: 0, num_parallel: 1, r: 0, x: 0, s_nom: 0 },
    Transformer: { s_nom: 0, x: 0, r: 0 },
    Generator:   { p_nom: 0, marginal_cost: 0, committable: 0, p_min_pu: 0, start_up_cost: 0, shut_down_cost: 0,
                   stand_by_cost: 0, min_up_time: 0, min_down_time: 0, ramp_limit_up: 1, ramp_limit_down: 1,
                   init: 1, prof: '', grid: 0, style: '' },
    Load:        { p_set: 0, prof: '' },
    StorageUnit: { p_nom: 0, max_hours: 1, eff: 1, soc0: 0, cyclic: 1 },
    Link:        { p_nom: 0, efficiency: 1, both: 1 }
  };
  ED.DEFAULTS = DEFAULTS;

  // How each saved value is read back: [kind, min, max], ['e', options] or ['p'] (a profile).
  var BIG = 1e5;
  var SPEC = {
    Bus:         { v_nom: ['n', 0.1, 1500], style: ['e', ['', 'node']] },
    Line:        { type: ['s'], length: ['n', 0, 5000], num_parallel: ['i', 1, 20], r: ['n', 0, BIG], x: ['n', -BIG, BIG], s_nom: ['n', 0, BIG] },
    Transformer: { s_nom: ['n', 0, BIG], x: ['n', -10, 10], r: ['n', 0, 10] },
    Generator:   { p_nom: ['n', 0, BIG], marginal_cost: ['n', -1e4, 1e5], committable: ['e', [0, 1]], p_min_pu: ['n', 0, 1],
                   start_up_cost: ['n', 0, 1e8], shut_down_cost: ['n', 0, 1e8], stand_by_cost: ['n', 0, 1e7],
                   min_up_time: ['i', 0, 168], min_down_time: ['i', 0, 168], ramp_limit_up: ['n', 0.01, 1], ramp_limit_down: ['n', 0.01, 1],
                   init: ['e', [0, 1]], prof: ['p'], grid: ['e', [0, 1]], style: ['e', ['', 'pv', 'wind']] },
    Load:        { p_set: ['n', 0, BIG], prof: ['p'] },
    StorageUnit: { p_nom: ['n', 0, BIG], max_hours: ['n', 0, 1000], eff: ['n', 0.01, 1], soc0: ['n', 0, 1], cyclic: ['e', [0, 1]] },
    Link:        { p_nom: ['n', 0, BIG], efficiency: ['n', 0.01, 1], both: ['e', [0, 1]] }
  };
  ED.SPEC = SPEC;

  // What a new element from the palette starts with (written out in full, so
  // this table may change without changing any saved network).
  ED.NEW = {
    Bus:         { v_nom: 110 },
    Node:        { v_nom: 110, style: 'node' },
    Line:        { r: 2, x: 12, s_nom: 100 },
    Transformer: { s_nom: 100, x: 0.1, r: 0.005 },
    Generator:   { p_nom: 100, marginal_cost: 40, committable: 1, p_min_pu: 0.3, min_up_time: 2, min_down_time: 2, start_up_cost: 1000 },
    PV:          { p_nom: 100, marginal_cost: 0, style: 'pv', prof: 'solar' },
    Wind:        { p_nom: 100, marginal_cost: 0, style: 'wind', prof: 'wind' },
    Grid:        { p_nom: 1000, marginal_cost: 80, grid: 1 },
    Load:        { p_set: 50, prof: 'sys' },
    StorageUnit: { p_nom: 20, max_hours: 4, eff: 0.85, soc0: 0.5 },
    Link:        { p_nom: 100, efficiency: 0.97 }
  };

  // Toolbar parts that are another class drawn another way: the class they make.
  ED.TOOL_CLASS = { Node: 'Bus', Grid: 'Generator', PV: 'Generator', Wind: 'Generator' };
  ED.toolClass = function(tool){ return ED.TOOL_CLASS[tool] || tool; };

  // The quantities a label can show, per class. Frozen order: lb is a bitmask over it.
  ED.LABELS = {
    Bus:         ['name', 'price', 'p'],
    Line:        ['name', 'p', 'load'],
    Transformer: ['name', 'p', 'load'],
    Generator:   ['name', 'p', 'status', 'cost'],
    Load:        ['name', 'p'],
    StorageUnit: ['name', 'p', 'soc'],
    Link:        ['name', 'p', 'loss']
  };

  /* ── Hourly shapes ──
     24 values for one day, per unit of a load's peak or a unit's rating, and a
     factor for each day of a week. The keys are frozen; the numbers may be
     improved. A custom shape repeats as it is every day. */
  ED.PROFILES = {
    sys:   { label: 'System day', kind: 'load',
             h: [0.62, 0.58, 0.56, 0.55, 0.56, 0.60, 0.68, 0.77, 0.83, 0.86, 0.88, 0.89, 0.89, 0.88, 0.87, 0.87, 0.89, 0.94, 1.00, 0.99, 0.95, 0.87, 0.77, 0.68],
             d: [1, 1, 1, 1, 0.98, 0.9, 0.86] },
    res:   { label: 'Residential', kind: 'load',
             h: [0.45, 0.40, 0.38, 0.37, 0.38, 0.45, 0.62, 0.78, 0.72, 0.62, 0.58, 0.56, 0.55, 0.54, 0.55, 0.60, 0.70, 0.86, 1.00, 0.98, 0.90, 0.78, 0.64, 0.52],
             d: [1, 1, 1, 1, 1, 1.04, 1.04] },
    com:   { label: 'Commercial', kind: 'load',
             h: [0.38, 0.36, 0.35, 0.35, 0.36, 0.40, 0.52, 0.72, 0.88, 0.96, 1.00, 1.00, 0.98, 0.99, 0.98, 0.95, 0.88, 0.74, 0.60, 0.52, 0.47, 0.44, 0.41, 0.39],
             d: [1, 1, 1, 1, 0.97, 0.6, 0.5] },
    ind:   { label: 'Industrial', kind: 'load',
             h: [0.78, 0.77, 0.76, 0.76, 0.77, 0.80, 0.88, 0.96, 1.00, 1.00, 0.99, 0.97, 0.95, 0.98, 1.00, 0.99, 0.96, 0.90, 0.86, 0.84, 0.82, 0.81, 0.80, 0.79],
             d: [1, 1, 1, 1, 1, 0.85, 0.8] },
    solar: { label: 'Solar', kind: 'gen',
             h: [0, 0, 0, 0, 0, 0, 0.03, 0.15, 0.35, 0.55, 0.70, 0.79, 0.82, 0.79, 0.70, 0.55, 0.35, 0.15, 0.03, 0, 0, 0, 0, 0],
             d: [1, 0.9, 0.6, 1, 0.95, 0.75, 1] },
    wind:  { label: 'Wind', kind: 'gen',
             h: [0.62, 0.66, 0.70, 0.72, 0.70, 0.66, 0.60, 0.52, 0.44, 0.38, 0.33, 0.30, 0.29, 0.31, 0.35, 0.40, 0.46, 0.52, 0.56, 0.58, 0.60, 0.61, 0.60, 0.61],
             d: [1, 0.75, 1.2, 0.55, 0.9, 1.25, 0.8] }
  };
  var own = Object.prototype.hasOwnProperty;
  // The value of a profile at hour t (0-based from the start of the horizon).
  ED.shapeAt = function(prof, t, cap){
    var h = t % 24, d = Math.floor(t / 24) % 7, v;
    if(Array.isArray(prof)) v = +prof[h];
    else if(prof && own.call(ED.PROFILES, prof)){ var p = ED.PROFILES[prof]; v = p.h[h] * p.d[d]; }
    else v = 1;
    if(!isFinite(v) || v < 0) v = 0;
    return cap ? Math.min(cap, v) : v;
  };
  // A load's demand, MW, hour by hour.
  ED.loadSeries = function(e, H){
    var out = [];
    for(var t = 0; t < H; t++) out.push(e.p_set * ED.shapeAt(e.prof, t));
    return out;
  };
  // A unit's availability, per unit of its rating, hour by hour (never above 1).
  ED.availSeries = function(e, H){
    var out = [];
    for(var t = 0; t < H; t++) out.push(ED.shapeAt(e.prof, t, 1));
    return out;
  };
  ED.HOURS = [1, 24, 48, 72, 168];

  /* ── Small helpers ── */
  function num(v){ var x = typeof v === 'string' && v.trim() !== '' ? Number(v) : v; return typeof x === 'number' && isFinite(x) ? x : NaN; }
  function clamp(v, lo, hi){ return Math.min(hi, Math.max(lo, v)); }
  function str(v, max){ return typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').slice(0, max || 60) : ''; }
  function toInt(v){ var x = num(v); return isNaN(x) ? NaN : Math.round(x); }
  function has(o, k){ return Object.prototype.hasOwnProperty.call(o, k); }
  function r6(x){ return Math.round(x * 1e6) / 1e6; }
  ED.num = num;

  function readValue(spec, v, dflt){
    var k = spec[0];
    if(k === 's') return typeof v === 'string' ? str(v, 80) : dflt;
    if(k === 'p'){
      if(typeof v === 'string') return own.call(ED.PROFILES, v) ? v : v === '' ? '' : dflt;
      if(Array.isArray(v) && v.length === 24){
        var a = v.map(function(x){ var n = num(x); return isNaN(n) ? 0 : r6(clamp(n, 0, 2)); });
        return a;
      }
      return dflt;
    }
    if(k === 'e'){
      var opts = spec[1];
      if(opts.indexOf(v) >= 0) return v;
      if(typeof opts[0] === 'number'){
        var x = num(v);
        if(v === true) x = 1; else if(v === false) x = 0;
        if(isNaN(x)) return dflt;
        // A value that is gone maps to its nearest option.
        return opts.reduce(function(b, o){ return Math.abs(o - x) < Math.abs(b - x) ? o : b; }, opts[0]);
      }
      if(typeof v === 'string'){
        var low = v.toLowerCase();
        for(var i = 0; i < opts.length; i++) if(String(opts[i]).toLowerCase() === low) return opts[i];
      }
      return dflt;
    }
    var n = k === 'i' ? toInt(v) : num(v);
    if(isNaN(n)) return dflt;
    return clamp(n, spec[1], spec[2]);
  }

  ED.autoName = function(e){ return WORD[e.c] + ' ' + e.id; };
  ED.nameOf = function(e){ return e.name || ED.autoName(e); };
  ED.isBranch = function(e){ return !!BRANCH[e.c]; };
  ED.isDevice = function(e){ return !!DEVICE[e.c]; };

  /* ── Reading a saved network: never throws ── */
  function migrate(raw){
    // v1 is the first saved form. A later version converts older ones here.
    return raw;
  }

  function readAt(c, at, attached){
    if(!Array.isArray(at)) return null;
    var a = at.map(function(v){ return v === null ? null : num(v); });
    if(c === 'Bus'){
      if(isNaN(a[0]) || isNaN(a[1])) return null;
      return [clamp(Math.round(a[0]), -5000, 5000), clamp(Math.round(a[1]), -5000, 5000),
              isNaN(a[2]) ? 8 : clamp(Math.round(a[2]), 2, 400), a[3] === 1 ? 1 : 0];
    }
    if(DEVICE[c]){
      if(attached){
        if(isNaN(a[0])) return null;
        return [clamp(Math.round(a[0]), -200, 200), a[1] === 1 ? 1 : 0];
      }
      if(isNaN(a[0]) || isNaN(a[1])) return null;
      return [clamp(Math.round(a[0]), -5000, 5000), clamp(Math.round(a[1]), -5000, 5000)];
    }
    var out = [0, 1, 2].map(function(i){ var v = a[i]; return v === null || v === undefined || isNaN(v) ? null : clamp(Math.round(v), -5000, 5000); });
    return out[0] === null && out[1] === null && out[2] === null ? null : out;
  }

  ED.load = function(raw){
    var m = { name: '', next: 1, el: [] };
    try {
      if(!raw || typeof raw !== 'object') return m;
      raw = migrate(raw);
      m.name = str(raw.name, 60);
      var list = Array.isArray(raw.el) ? raw.el.slice(0, 5000) : [];
      var used = {}, pending = [];
      list.forEach(function(r){
        if(!r || typeof r !== 'object' || !has(DEFAULTS, r.c)) return;
        var e = { c: r.c, id: toInt(r.id) };
        var d = DEFAULTS[r.c], sp = SPEC[r.c];
        for(var k in d) e[k] = has(r, k) ? readValue(sp[k], r[k], d[k]) : d[k];
        e.name = str(r.name, 40).trim();
        if(BRANCH[r.c]){ e.bus0 = toInt(r.bus0); e.bus1 = toInt(r.bus1); }
        if(DEVICE[r.c]) e.bus = toInt(r.bus);
        e._at = r.at;
        var lb = toInt(r.lb);
        if(!isNaN(lb) && lb >= 0 && lb < (1 << ED.LABELS[r.c].length)) e.lb = lb;
        if(!(e.id > 0) || e.id > 1e6 || used[e.id]) pending.push(e);
        else used[e.id] = 1;
        m.el.push(e);
      });
      // Duplicate or missing ids get fresh ones.
      var next = 1;
      m.el.forEach(function(e){ if(used[e.id] && pending.indexOf(e) < 0 && e.id >= next) next = e.id + 1; });
      pending.forEach(function(e){ e.id = next++; });
      var buses = {};
      m.el.forEach(function(e){ if(e.c === 'Bus') buses[e.id] = e; });
      m.el = m.el.filter(function(e){
        if(BRANCH[e.c] && (!buses[e.bus0] || !buses[e.bus1])) return false; // a branch needs both its ends
        if(DEVICE[e.c] && !buses[e.bus]) e.bus = null;
        var at = readAt(e.c, e._at, DEVICE[e.c] ? e.bus !== null : true);
        delete e._at;
        if(e.c === 'Bus' && !at) at = [10 + (e.id % 10) * 12, 10 + Math.floor(e.id / 10) * 16, 8, 0];
        if(DEVICE[e.c] && e.bus === null && (!at || at.length !== 2)) at = [0, 0];
        e.at = at;
        return true;
      });
      var maxId = 0;
      m.el.forEach(function(e){ if(e.id > maxId) maxId = e.id; });
      var savedNext = toInt(raw.next);
      m.next = Math.max(maxId + 1, isNaN(savedNext) ? 1 : clamp(savedNext, 1, 1e6));
      if(m.el.length !== new Set(m.el.map(function(e){ return e.id; })).size) throw new Error('ids');
    } catch(err){
      if(root.console) root.console.warn('ED/UC: could not read that network', err);
      return { name: '', next: 1, el: [] };
    }
    return m;
  };

  /* ── Writing it back, only what differs from the defaults ── */
  function same(a, b){ return Array.isArray(a) || Array.isArray(b) ? JSON.stringify(a) === JSON.stringify(b) : a === b; }
  ED.compact = function(model){
    var out = { v: ED.VERSION };
    if(model.name) out.name = model.name;
    out.next = model.next;
    out.el = model.el.map(function(e){
      var o = { c: e.c, id: e.id };
      if(e.name && e.name !== ED.autoName(e)) o.name = e.name;
      if(BRANCH[e.c]){ o.bus0 = e.bus0; o.bus1 = e.bus1; }
      if(DEVICE[e.c] && e.bus !== null && e.bus !== undefined) o.bus = e.bus;
      if(e.at){
        var at = e.at.slice();
        if(e.c === 'Bus' && at[3] !== 1) at.length = 3;
        if(BRANCH[e.c]){ while(at.length && at[at.length - 1] === null) at.pop(); }
        if(at.length) o.at = at;
      }
      var d = DEFAULTS[e.c];
      for(var k in d) if(!same(e[k], d[k])) o[k] = Array.isArray(e[k]) ? e[k].slice() : e[k];
      if(typeof e.lb === 'number') o.lb = e.lb;
      return o;
    });
    return out;
  };

  /* ── What the optimiser sees, to tell when a result is out of date ── */
  ED.hash = function(s){
    var h = 0x811c9dc5;
    for(var i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  };
  var DRAW_ONLY = { grid: 1, style: 1 };
  ED.elecKey = function(model){
    return JSON.stringify(model.el.map(function(e){
      var o = [e.c, e.id];
      if(BRANCH[e.c]) o.push(e.bus0, e.bus1);
      if(DEVICE[e.c]) o.push(e.bus === null || e.bus === undefined ? null : e.bus);
      var d = DEFAULTS[e.c];
      for(var k in d) if(!DRAW_ONLY[k]) o.push(e[k]);
      return o;
    }));
  };

  /* ── Model queries ── */
  ED.byId = function(model){
    var map = {};
    model.el.forEach(function(e){ map[e.id] = e; });
    return map;
  };
  // Groups of buses that can trade power: joined by lines, transformers or links.
  ED.areas = function(model){
    var parent = {};
    function find(a){ while(parent[a] !== a){ parent[a] = parent[parent[a]]; a = parent[a]; } return a; }
    var buses = model.el.filter(function(e){ return e.c === 'Bus'; });
    buses.forEach(function(b){ parent[b.id] = b.id; });
    model.el.forEach(function(e){
      if(BRANCH[e.c] && has(parent, e.bus0) && has(parent, e.bus1) && e.bus0 !== e.bus1){
        if(e.c === 'Link' && !(e.p_nom > 0)) return;
        var a = find(e.bus0), b = find(e.bus1);
        if(a !== b) parent[b] = a;
      }
    });
    var groups = {}, order = [];
    buses.forEach(function(b){
      var r = find(b.id);
      if(!groups[r]){ groups[r] = { buses: [] }; order.push(r); }
      groups[r].buses.push(b.id);
    });
    return order.map(function(r){ return groups[r]; });
  };
  ED.onBus = function(model, e){
    var b = e.bus !== null && e.bus !== undefined ? ED.byId(model)[e.bus] : null;
    return !!(b && b.c === 'Bus');
  };

  /* ── Standard line types (from the engine; empty until it has loaded) ── */
  ED.types = { line: {}, transformer: {} };
  ED.setTypes = function(t){ if(t && t.line && t.transformer) ED.types = t; };
  ED.lineType = function(e){ var t = e.type && own.call(ED.types.line, e.type) ? ED.types.line[e.type] : null; return t && t.f_nom > 0 ? t : null; };
  ED.lineTypeKv = function(name){
    var m = / (\d+(?:\.\d+)?)$/.exec(name) || /\/(\d+(?:\.\d+)?) kV$/.exec(name);
    if(m) return +m[1];
    return /^NAYY/.test(name) ? 0.4 : NaN;
  };
  // A branch's limit in MW as the optimiser sees it; Infinity when it has none.
  ED.rating = function(e, bus0){
    if(e.c === 'Line'){
      var t = ED.lineType(e);
      if(t) return Math.sqrt(3) * (bus0 ? bus0.v_nom : 0) * t.i_nom * e.num_parallel;
      return e.s_nom > 0 ? e.s_nom : Infinity;
    }
    if(e.c === 'Transformer') return e.s_nom;
    if(e.c === 'Link') return e.p_nom;
    return Infinity;
  };
  // A line's reactance in ohms, from its type or its own value.
  ED.lineX = function(e){
    var t = ED.lineType(e);
    return t ? t.x_per_length * e.length / e.num_parallel : e.x;
  };

  /* ── Options: what to solve, read from the form, never trusted ── */
  ED.solveOptions = function(o){
    o = o || {};
    var hours = toInt(o.hours);
    return {
      mode: o.mode === 'ed' || o.mode === 'lin' ? o.mode : 'uc',
      hours: ED.HOURS.indexOf(hours) >= 0 ? hours : 24,
      limits: o.limits === false || o.limits === 0 || o.limits === '0' ? false : true,
      shed: o.shed === false || o.shed === 0 || o.shed === '0' ? false : true,
      voll: (function(v){ v = num(v); return isNaN(v) ? 10000 : clamp(v, 100, 1e5); })(o.voll),
      gap: [0.0001, 0.001, 0.01].indexOf(num(o.gap)) >= 0 ? num(o.gap) : 0.0001,
      time: [10, 30, 60, 300].indexOf(toInt(o.time)) >= 0 ? toInt(o.time) : 60
    };
  };

  /* ── Validation: errors stop a run, warnings explain what the run will do ── */
  ED.validate = function(model, options){
    var o = ED.solveOptions(options);
    var H = o.hours;
    var errors = [], warnings = [];
    var byId = ED.byId(model);
    var buses = model.el.filter(function(e){ return e.c === 'Bus'; });
    var nm = function(id){ return byId[id] ? ED.nameOf(byId[id]) : '?'; };
    var typedLine = function(e){ return Object.keys(ED.types.line).length ? !!ED.lineType(e) : !!e.type; };
    if(!buses.length) errors.push({ id: null, msg: 'Add at least one bus.' });
    if(buses.length > 300) errors.push({ id: null, msg: 'This tool optimises up to 300 buses.' });
    var gensAll = model.el.filter(function(e){ return e.c === 'Generator'; });
    if(gensAll.length > 120) errors.push({ id: null, msg: 'This tool optimises up to 120 generators.' });
    model.el.forEach(function(e){
      var n = ED.nameOf(e);
      if(BRANCH[e.c]){
        if(e.bus0 === e.bus1) errors.push({ id: e.id, msg: n + ' starts and ends on the same bus.' });
        var b0 = byId[e.bus0], b1 = byId[e.bus1];
        if(e.c === 'Line'){
          if(e.type && !ED.lineType(e) && Object.keys(ED.types.line).length) warnings.push({ id: e.id, msg: n + ': type "' + e.type + '" is unknown, so its own values are used.' });
          if(typedLine(e)){ if(!(e.length > 0)) errors.push({ id: e.id, msg: n + ' has a line type but no length.' }); }
          else if(e.x === 0) errors.push({ id: e.id, msg: n + ' has no reactance. Power divides between parallel paths by reactance, so give it one.' });
          if(b0 && b1 && b0.v_nom !== b1.v_nom) warnings.push({ id: e.id, msg: n + ' joins ' + b0.v_nom + ' kV and ' + b1.v_nom + ' kV buses. A line takes the voltage of its first end; use a transformer between voltages.' });
        }
        if(e.c === 'Transformer'){
          if(!(e.s_nom > 0)) errors.push({ id: e.id, msg: n + ' needs a rating above 0 MVA: its reactance is per unit on that rating.' });
          if(e.x === 0) errors.push({ id: e.id, msg: n + ' has no reactance. Give it one.' });
        }
        if(e.c === 'Link' && !(e.p_nom > 0)) warnings.push({ id: e.id, msg: n + ' has no rating, so it carries nothing.' });
      }
      if(DEVICE[e.c] && !ED.onBus(model, e)) warnings.push({ id: e.id, msg: n + ' is not on a bus, so it is left out.' });
      if(e.c === 'Generator' && ED.onBus(model, e) && !(e.p_nom > 0)) warnings.push({ id: e.id, msg: n + ' has no rating, so it supplies nothing.' });
      if(e.c === 'StorageUnit' && ED.onBus(model, e) && !(e.p_nom > 0 && e.max_hours > 0)) warnings.push({ id: e.id, msg: n + ' has no power or energy rating, so it does nothing.' });
      if(e.c === 'Generator' && e.committable && o.mode !== 'ed' && e.p_min_pu > 0 && Array.isArray(e.prof) === false && e.prof && ED.PROFILES[e.prof] && ED.PROFILES[e.prof].kind === 'gen')
        warnings.push({ id: e.id, msg: n + ' must run at ' + Math.round(e.p_min_pu * 100) + '% or stay off, so in hours its ' + ED.PROFILES[e.prof].label.toLowerCase() + ' availability is lower it is kept off.' });
    });
    // Each group of buses that can trade power has to be able to meet its own load.
    var devs = model.el.filter(function(e){ return DEVICE[e.c] && ED.onBus(model, e); });
    ED.areas(model).forEach(function(area){
      var inA = function(e){ return area.buses.indexOf(e.bus) >= 0; };
      var loads = devs.filter(function(e){ return e.c === 'Load' && inA(e) && e.p_set > 0; });
      if(!loads.length) return;
      var gens = devs.filter(function(e){ return e.c === 'Generator' && inA(e) && e.p_nom > 0; });
      var stores = devs.filter(function(e){ return e.c === 'StorageUnit' && inA(e) && e.p_nom > 0 && e.max_hours > 0; });
      var where = area.buses.length > 1 ? 'The area with ' + nm(area.buses[0]) : nm(area.buses[0]);
      if(!gens.length && !stores.length){
        if(o.shed) warnings.push({ id: loads[0].id, msg: where + ' has load but nothing to supply it, so all of it is shed.' });
        else errors.push({ id: loads[0].id, msg: where + ' has load but nothing to supply it. Add a generator, or allow load shedding.' });
        return;
      }
      var lseries = loads.map(function(e){ return ED.loadSeries(e, H); });
      var gseries = gens.map(function(e){ return ED.availSeries(e, H).map(function(a){ return a * e.p_nom; }); });
      var short = null;
      for(var t = 0; t < H; t++){
        var need = 0, can = 0;
        lseries.forEach(function(s){ need += s[t]; });
        gseries.forEach(function(s){ can += s[t]; });
        stores.forEach(function(e){ can += e.p_nom; });
        if(need > can + 1e-6 && (!short || need - can > short.gap)) short = { t: t, gap: need - can, need: need, can: can };
      }
      if(short){
        var msg = where + ': at ' + ED.hourLabel(short.t, H) + ' the load (' + fmt1(short.need) + ' MW) is more than everything there can supply (' + fmt1(short.can) + ' MW)';
        if(o.shed) warnings.push({ id: loads[0].id, msg: msg + ', so some of it is shed.' });
        else errors.push({ id: loads[0].id, msg: msg + '. Add capacity, or allow load shedding.' });
      }
    });
    if(!gensAll.length && !o.shed && devs.some(function(e){ return e.c === 'Load' && e.p_set > 0; }) && !errors.length)
      errors.push({ id: null, msg: 'Add a generator, or allow load shedding.' });
    return { errors: errors, warnings: warnings };
  };
  function fmt1(x){ return (Math.round(x * 10) / 10).toLocaleString('en-AU'); }
  // "Day 2 18:00" on a horizon longer than a day, "18:00" otherwise.
  ED.hourLabel = function(t, H){
    var hh = ('0' + (t % 24)).slice(-2) + ':00';
    return H > 24 ? 'Day ' + (Math.floor(t / 24) + 1) + ' ' + hh : hh;
  };

  /* ── The optimisation ── */
  function pyName(id){ return 'e' + id; }
  var BIGF = 1e6;      // the limit sent for a branch that has none
  function col(df, name, H){
    if(!df || !df.columns || !df.columns.has || !df.columns.has(name)) return null;
    var c = df.col(name), out = [];
    for(var t = 0; t < H; t++){ var v = c[t]; out.push(typeof v === 'number' ? v : v === true ? 1 : v === false ? 0 : NaN); }
    return out;
  }
  function zeros(H){ var a = []; for(var t = 0; t < H; t++) a.push(0); return a; }
  function nans(H){ var a = []; for(var t = 0; t < H; t++) a.push(NaN); return a; }
  function allOne(a){ for(var i = 0; i < a.length; i++) if(a[i] !== 1) return false; return true; }

  /* Build the PSA.js network. fixed, when given, is the commitment found by
     the unit commitment (id -> 0/1 per hour): the units become ordinary
     dispatchable ones, held off where they were off and between their minimum
     and their rating where they were on, so the linear problem left has duals,
     which are the prices. noRamp drops their ramp limits too. */
  function build(psa, model, o, fixed, noRamp){
    var H = o.hours;
    var byId = ED.byId(model);
    var buses = model.el.filter(function(e){ return e.c === 'Bus'; });
    var on = function(e){ return ED.onBus(model, e); };
    var ends = function(e){ return byId[e.bus0] && byId[e.bus1] && byId[e.bus0].c === 'Bus' && byId[e.bus1].c === 'Bus' && e.bus0 !== e.bus1; };
    var n = new psa.Network();
    // The carriers PyPSA expects, so its consistency check has nothing to say.
    n.add('Carrier', ['AC', '']);
    var sns = [];
    for(var t = 0; t < H; t++) sns.push(t);
    n.set_snapshots(sns);
    buses.forEach(function(b){ n.add('Bus', pyName(b.id), { v_nom: b.v_nom }); });
    var lines = model.el.filter(function(e){ return e.c === 'Line' && ends(e); });
    lines.forEach(function(e){
      var lt = ED.lineType(e), rt = ED.rating(e, byId[e.bus0]);
      n.add('Line', pyName(e.id), { bus0: pyName(e.bus0), bus1: pyName(e.bus1), type: lt ? e.type : '', length: e.length, num_parallel: e.num_parallel,
        r: lt ? 0 : e.r, x: lt ? 0 : e.x, s_nom: o.limits && isFinite(rt) ? rt : BIGF });
    });
    var trs = model.el.filter(function(e){ return e.c === 'Transformer' && ends(e); });
    trs.forEach(function(e){
      n.add('Transformer', pyName(e.id), { bus0: pyName(e.bus0), bus1: pyName(e.bus1), x: e.x, r: e.r, s_nom: e.s_nom, s_max_pu: o.limits ? 1 : BIGF / Math.max(e.s_nom, 1e-9) });
    });
    var gens = model.el.filter(function(e){ return e.c === 'Generator' && on(e); });
    gens.forEach(function(e){
      var avail = ED.availSeries(e, H);
      var kw = { bus: pyName(e.bus), p_nom: e.p_nom, marginal_cost: e.marginal_cost, p_max_pu: allOne(avail) ? 1 : avail };
      var com = e.committable && o.mode !== 'ed';
      var up = e.ramp_limit_up < 1 ? e.ramp_limit_up : NaN, down = e.ramp_limit_down < 1 ? e.ramp_limit_down : NaN;
      if(com && !fixed){
        kw.committable = true;
        kw.p_min_pu = e.p_min_pu;
        kw.start_up_cost = e.start_up_cost; kw.shut_down_cost = e.shut_down_cost; kw.stand_by_cost = e.stand_by_cost;
        kw.min_up_time = e.min_up_time; kw.min_down_time = e.min_down_time;
        // "Running before" has already met its minimum up time, "off" its minimum down time.
        kw.up_time_before = e.init ? Math.max(1, e.min_up_time) : 0;
        kw.down_time_before = e.init ? 0 : Math.max(1, e.min_down_time);
        if(!isNaN(up)) kw.ramp_limit_up = up;
        if(!isNaN(down)) kw.ramp_limit_down = down;
      } else if(com && fixed){
        var st = fixed[e.id];
        // Off, it stays out, except as the next unit to start: above the dearest
        // unit running in that hour it may set the price.
        kw.p_max_pu = avail.map(function(a, t){ return st[t] || e.marginal_cost >= fixed.top[t] ? a : 0; });
        kw.p_min_pu = st.map(function(s, t){ return s ? Math.min(e.p_min_pu, avail[t]) : 0; });
        // A start-up or shut-down hour is not ramp limited (PyPSA's own start-up and
        // shut-down ramps are left at the full rating).
        if(!noRamp && !isNaN(up)) kw.ramp_limit_up = st.map(function(s, t){ return t > 0 && s && !st[t - 1] ? NaN : up; });
        if(!noRamp && !isNaN(down)) kw.ramp_limit_down = st.map(function(s, t){ return t > 0 && !s && st[t - 1] ? NaN : down; });
      } else {
        if(!isNaN(up)) kw.ramp_limit_up = up;
        if(!isNaN(down)) kw.ramp_limit_down = down;
      }
      n.add('Generator', pyName(e.id), kw);
    });
    var loads = model.el.filter(function(e){ return e.c === 'Load' && on(e); });
    var busLoad = {};
    loads.forEach(function(e){
      var s = ED.loadSeries(e, H);
      n.add('Load', pyName(e.id), { bus: pyName(e.bus), p_set: s });
      var bl = busLoad[e.bus] || (busLoad[e.bus] = zeros(H));
      s.forEach(function(v, t){ bl[t] += v; });
    });
    var shedBuses = [];
    if(o.shed) Object.keys(busLoad).forEach(function(b){
      var peak = Math.max.apply(null, busLoad[b]);
      if(!(peak > 0)) return;
      shedBuses.push(+b);
      n.add('Generator', 'shed' + b, { bus: pyName(+b), p_nom: peak, marginal_cost: o.voll });
    });
    var stores = model.el.filter(function(e){ return e.c === 'StorageUnit' && on(e); });
    stores.forEach(function(e){
      var ef = Math.sqrt(e.eff);
      n.add('StorageUnit', pyName(e.id), { bus: pyName(e.bus), p_nom: e.p_nom, max_hours: e.max_hours,
        efficiency_store: ef, efficiency_dispatch: ef, cyclic_state_of_charge: !!e.cyclic,
        state_of_charge_initial: e.cyclic ? 0 : e.soc0 * e.p_nom * e.max_hours });
    });
    var links = model.el.filter(function(e){ return e.c === 'Link' && ends(e); });
    links.forEach(function(e){
      // A lossy link that runs both ways is two one-way links: PyPSA applies the
      // efficiency to a negative flow the wrong way round, which would create energy.
      if(e.both && e.efficiency < 1){
        n.add('Link', pyName(e.id), { bus0: pyName(e.bus0), bus1: pyName(e.bus1), p_nom: e.p_nom, efficiency: e.efficiency });
        n.add('Link', pyName(e.id) + 'r', { bus0: pyName(e.bus1), bus1: pyName(e.bus0), p_nom: e.p_nom, efficiency: e.efficiency });
      } else {
        n.add('Link', pyName(e.id), { bus0: pyName(e.bus0), bus1: pyName(e.bus1), p_nom: e.p_nom, efficiency: e.efficiency, p_min_pu: e.both ? -1 : 0 });
      }
    });
    return { n: n, buses: buses, lines: lines, trs: trs, gens: gens, loads: loads, stores: stores, links: links, shedBuses: shedBuses, busLoad: busLoad, byId: byId };
  }

  function solverOptions(o){ return { mip_rel_gap: o.gap, time_limit: o.time }; }
  // There is nothing to invest in here, so the objective has no constant.
  function optArgs(o, lin){ return { linearized_unit_commitment: !!lin, include_objective_constant: false, solver_options: solverOptions(o) }; }
  function runOpt(n, extra){
    // Through the accessor's own method, so the options are read the same from any realm.
    var acc = n.optimize && n.optimize._accessor;
    return acc ? acc.optimize(extra) : n.optimize(extra);
  }
  var CONDITION = {
    infeasible: 'The problem is infeasible: no dispatch meets every load and limit. Check the Checks list, or allow load shedding.',
    infeasible_or_unbounded: 'The problem is infeasible: no dispatch meets every load and limit. Check the Checks list, or allow load shedding.',
    unbounded: 'The problem is unbounded: some cost can fall without end. Check for a negative cost on something with no limit.',
    time_limit: 'The solver ran out of time before it proved an optimum. Allow more time, a larger gap, or a shorter horizon.',
    iteration_limit: 'The solver stopped at its iteration limit. Try a shorter horizon.'
  };

  /* Solve a model with a PSA.js module ({Network, logger, stdTypes}). Returns
     plain numbers keyed by element id, hour by hour, the run report, and raw
     (everything, in a fixed order, for the build's bundle-against-source check). */
  ED.solve = async function(psa, model, options){
    var o = ED.solveOptions(options);
    var H = o.hours;
    var t0 = Date.now();
    var report = { ok: false, mode: o.mode, opts: o, H: H, warnings: [], error: '', status: '', condition: '', pricing: '', milp: false };
    var oldHandler = psa.logger.handler;
    psa.logger.handler = function(level, msg){ if(level >= 30) report.warnings.push(String(msg)); };
    try {
      if(psa.stdTypes && !Object.keys(ED.types.line).length) ED.setTypes(psa.stdTypes());
      var B = build(psa, model, o, null);
      var n = B.n;
      var comGens = B.gens.filter(function(e){ return e.committable && o.mode !== 'ed'; });
      report.milp = o.mode === 'uc' && comGens.length > 0;
      var ret = await runOpt(n, optArgs(o, o.mode === 'lin'));
      report.status = String(ret[0]); report.condition = String(ret[1]);
      if(report.status !== 'ok'){
        report.error = CONDITION[report.condition] || 'The solver stopped without a solution (' + report.condition + ').';
        report.ms = Date.now() - t0;
        return { T: H, bus: {}, br: {}, dev: {}, totals: {}, report: report, raw: ['error', report.condition] };
      }
      var res = { T: H, bus: {}, br: {}, dev: {}, totals: {} };
      var gt = n.generators_t;
      // Commitment, as the solver left it (a relaxed run can leave fractions).
      var status = {}, su = {}, sd = {};
      comGens.forEach(function(e){
        var nm = pyName(e.id);
        // A mixed-integer run's binaries come back a hair off 0 and 1.
        var rd = function(a){ return report.milp ? a.map(function(v){ return Math.round(v); }) : a.map(function(v){ return Math.abs(v) < 1e-9 ? 0 : v; }); };
        status[e.id] = rd(col(gt.status, nm, H) || zeros(H));
        su[e.id] = rd(col(gt.start_up, nm, H) || zeros(H));
        sd[e.id] = rd(col(gt.shut_down, nm, H) || zeros(H));
      });

      // Prices. A linear problem has them as its duals. A mixed-integer one does
      // not, so it is solved again with the commitment fixed, as markets do.
      var prices = null;
      if(report.milp){
        var fixedSt = { top: [] };
        comGens.forEach(function(e){ fixedSt[e.id] = status[e.id].slice(); });
        // The dearest unit running in each hour, of those that can run.
        for(var h0 = 0; h0 < H; h0++){
          var top = -Infinity;
          B.gens.forEach(function(e){
            var on1 = status[e.id] ? status[e.id][h0] : 1;
            if(on1 && e.p_nom > 0 && ED.shapeAt(e.prof, h0, 1) > 0 && e.marginal_cost > top) top = e.marginal_cost;
          });
          fixedSt.top.push(top);
        }
        for(var attempt = 0; attempt < 2 && !prices; attempt++){
          var P = build(psa, model, o, fixedSt, attempt === 1);
          var r2 = await runOpt(P.n, optArgs(o, false));
          if(String(r2[0]) === 'ok'){
            prices = {};
            B.buses.forEach(function(b){ prices[b.id] = col(P.n.buses_t.marginal_price, pyName(b.id), H) || nans(H); });
            report.pricing = attempt === 0 ? 'fixed' : 'fixed-noramp';
          }
        }
        if(!prices) report.pricing = 'none';
      } else {
        prices = {};
        B.buses.forEach(function(b){ prices[b.id] = col(n.buses_t.marginal_price, pyName(b.id), H) || nans(H); });
        report.pricing = 'lp';
      }

      // Buses
      B.buses.forEach(function(b){
        var nm = pyName(b.id);
        res.bus[b.id] = {
          price: prices ? prices[b.id] : nans(H),
          p: col(n.buses_t.p, nm, H) || zeros(H),
          load: B.busLoad[b.id] ? B.busLoad[b.id].slice() : zeros(H),
          shed: B.shedBuses.indexOf(b.id) >= 0 ? (col(gt.p, 'shed' + b.id, H) || zeros(H)).map(function(v){ return Math.max(0, v); }) : zeros(H)
        };
      });
      // Branches
      function branch(list, frames){
        list.forEach(function(e){
          var nm = pyName(e.id), p0 = col(frames.p0, nm, H) || zeros(H), p1 = col(frames.p1, nm, H) || zeros(H);
          var rating = ED.rating(e, B.byId[e.bus0]);
          var lim = o.limits ? rating : Infinity;
          res.br[e.id] = { p0: p0, p1: p1, loss: p0.map(function(v, t){ return v + p1[t]; }), rating: rating,
                           load: p0.map(function(v, t){ return isFinite(lim) && lim > 0 ? 100 * Math.max(Math.abs(v), Math.abs(p1[t])) / lim : NaN; }) };
        });
      }
      branch(B.lines, n.lines_t);
      branch(B.trs, n.transformers_t);
      B.links.forEach(function(e){
        var nm = pyName(e.id), lt = n.links_t;
        var f0 = col(lt.p0, nm, H) || zeros(H), f1 = col(lt.p1, nm, H) || zeros(H);
        var r0 = col(lt.p0, nm + 'r', H), r1 = col(lt.p1, nm + 'r', H);
        // Into the link at each end: the forward flow and the reverse one's arrival, and the other way.
        var p0 = f0.map(function(v, t){ return v + (r1 ? r1[t] : 0); }), p1 = f1.map(function(v, t){ return v + (r0 ? r0[t] : 0); });
        var sent = p0.map(function(v, t){ return Math.max(v, p1[t], 0); });
        res.br[e.id] = { p0: p0, p1: p1, loss: p0.map(function(v, t){ return v + p1[t]; }), rating: e.p_nom,
                         load: sent.map(function(v){ return e.p_nom > 0 ? 100 * v / e.p_nom : NaN; }) };
      });
      // Devices
      var cost = { energy: 0, start: 0, shut: 0, standby: 0, shed: 0 };
      B.gens.forEach(function(e){
        var nm = pyName(e.id), p = col(gt.p, nm, H) || zeros(H), avail = ED.availSeries(e, H);
        var com = !!status[e.id];
        var d = { p: p, avail: avail.map(function(a){ return a * e.p_nom; }), status: com ? status[e.id] : null,
                  su: com ? su[e.id] : null, sd: com ? sd[e.id] : null, cost: 0, energy: 0 };
        var en = 0, c = e.marginal_cost * 0;
        p.forEach(function(v){ en += v; });
        c = e.marginal_cost * en;
        cost.energy += c;
        var cs = 0, cd = 0, cb = 0;
        if(com){
          su[e.id].forEach(function(v){ cs += v * e.start_up_cost; });
          sd[e.id].forEach(function(v){ cd += v * e.shut_down_cost; });
          status[e.id].forEach(function(v){ cb += v * e.stand_by_cost; });
        }
        cost.start += cs; cost.shut += cd; cost.standby += cb;
        d.energy = en; d.cost = c + cs + cd + cb; d.costStart = cs + cd; d.costStandby = cb;
        res.dev[e.id] = d;
      });
      B.loads.forEach(function(e){ res.dev[e.id] = { p: ED.loadSeries(e, H) }; });
      B.stores.forEach(function(e){
        var nm = pyName(e.id);
        res.dev[e.id] = { p: col(n.storage_units_t.p, nm, H) || zeros(H), soc: col(n.storage_units_t.state_of_charge, nm, H) || zeros(H),
                          cap: e.p_nom * e.max_hours };
      });
      B.shedBuses.forEach(function(b){ res.bus[b].shed.forEach(function(v){ cost.shed += v * o.voll; }); });

      // Totals
      var T = { cost: 0, objective: n.objective, load: zeros(H), shed: zeros(H), gen: zeros(H), store: zeros(H), curtail: zeros(H),
                energy: 0, shedEnergy: 0, curtailEnergy: 0, peak: 0, peakAt: 0, starts: 0, unitHoursOn: 0, unitHours: 0,
                avgPrice: NaN, minPrice: NaN, maxPrice: NaN };
      T.costs = cost;
      T.cost = cost.energy + cost.start + cost.shut + cost.standby + cost.shed;
      B.buses.forEach(function(b){ var r = res.bus[b.id]; for(var t = 0; t < H; t++){ T.load[t] += r.load[t]; T.shed[t] += r.shed[t]; } });
      B.gens.forEach(function(e){
        var d = res.dev[e.id];
        for(var t = 0; t < H; t++){
          T.gen[t] += d.p[t];
          if(e.prof) T.curtail[t] += Math.max(0, d.avail[t] - d.p[t]);
        }
        if(d.status){
          d.status.forEach(function(v){ T.unitHoursOn += v; });
          d.su.forEach(function(v){ T.starts += v; });
          T.unitHours += H;
        }
      });
      B.stores.forEach(function(e){ var d = res.dev[e.id]; for(var t = 0; t < H; t++) T.store[t] += d.p[t]; });
      var wp = 0, wl = 0;
      for(var h = 0; h < H; h++){
        T.energy += T.load[h] - T.shed[h];
        T.shedEnergy += T.shed[h];
        T.curtailEnergy += T.curtail[h];
        if(T.load[h] > T.peak + 1e-9){ T.peak = T.load[h]; T.peakAt = h; }
      }
      if(prices){
        B.buses.forEach(function(b){
          var pr = prices[b.id], l = res.bus[b.id].load;
          for(var t = 0; t < H; t++){
            var v = pr[t];
            if(!isFinite(v)) continue;
            if(!(T.minPrice <= v)) T.minPrice = v;
            if(!(T.maxPrice >= v)) T.maxPrice = v;
            wp += v * l[t]; wl += l[t];
          }
        });
        T.avgPrice = wl > 0 ? wp / wl : NaN;
      }
      res.totals = T;
      report.ok = true;
      report.ms = Date.now() - t0;
      res.report = report;
      res.raw = [report.status, report.condition, report.pricing, r6(T.objective), res.bus, res.br, res.dev];
      return res;
    } catch(err){
      report.error = 'The optimisation stopped: ' + String(err && err.message || err);
      report.ms = Date.now() - t0;
      return { T: H, bus: {}, br: {}, dev: {}, totals: {}, report: report, raw: ['error', String(err && err.message)] };
    } finally {
      psa.logger.handler = oldHandler;
    }
  };

  /* ── Quick Start networks (keys are frozen; contents may be improved) ──
     Built in the saved form and read through ED.load, like any saved network,
     each with the options it is solved with. */
  function pjm5(){
    // F. Li and R. Bo, "Small test systems for power system economic studies",
    // IEEE PES General Meeting 2010: the PJM 5-bus system, per unit on 100 MVA
    // and 230 kV converted to ohms. Loads follow a system day that peaks at
    // 18:00 at the published 300, 300 and 400 MW.
    var Z = 230 * 230 / 100;
    var line = function(id, a, b, r, x, s, name){ return { c: 'Line', id: id, name: name, bus0: a, bus1: b, r: +(r * Z).toFixed(4), x: +(x * Z).toFixed(4), s_nom: s }; };
    return { v: 1, name: 'PJM 5-bus', el: [
      { c: 'Bus', id: 1, name: 'A', v_nom: 230, at: [16, 14, 10] },
      { c: 'Bus', id: 2, name: 'B', v_nom: 230, at: [50, 14, 10] },
      { c: 'Bus', id: 3, name: 'C', v_nom: 230, at: [84, 26, 10, 1] },
      { c: 'Bus', id: 4, name: 'D', v_nom: 230, at: [50, 44, 10] },
      { c: 'Bus', id: 5, name: 'E', v_nom: 230, at: [16, 44, 10] },
      line(6, 1, 2, 0.00281, 0.0281, 400, 'A-B'),
      line(7, 1, 4, 0.00304, 0.0304, 0, 'A-D'),
      line(8, 1, 5, 0.00064, 0.0064, 0, 'A-E'),
      line(9, 2, 3, 0.00108, 0.0108, 0, 'B-C'),
      line(10, 3, 4, 0.00297, 0.0297, 0, 'C-D'),
      line(11, 4, 5, 0.00297, 0.0297, 240, 'D-E'),
      { c: 'Generator', id: 12, name: 'Alta', bus: 1, p_nom: 40, marginal_cost: 14, at: [-2, 1] },
      { c: 'Generator', id: 13, name: 'Park City', bus: 1, p_nom: 170, marginal_cost: 15, at: [2, 1] },
      { c: 'Generator', id: 14, name: 'Solitude', bus: 3, p_nom: 520, marginal_cost: 30, at: [-2, 0] },
      { c: 'Generator', id: 15, name: 'Sundance', bus: 4, p_nom: 200, marginal_cost: 40, at: [3, 0] },
      { c: 'Generator', id: 16, name: 'Brighton', bus: 5, p_nom: 600, marginal_cost: 10, at: [0, 0] },
      { c: 'Load', id: 17, name: 'Load B', bus: 2, p_set: 300, prof: 'sys', at: [3, 1] },
      { c: 'Load', id: 18, name: 'Load C', bus: 3, p_set: 300, prof: 'sys', at: [2, 0] },
      { c: 'Load', id: 19, name: 'Load D', bus: 4, p_set: 400, prof: 'sys', at: [-3, 0] }
    ] };
  }
  function uc3(){
    // Three thermal units on one bus: a slow, cheap baseload unit, a combined
    // cycle that can cycle daily and a quick, dear peaker.
    return { v: 1, name: 'Three-unit commitment', el: [
      { c: 'Bus', id: 1, name: 'System', v_nom: 220, at: [40, 24, 30] },
      { c: 'Generator', id: 2, name: 'Coal', bus: 1, p_nom: 380, marginal_cost: 28, committable: 1, p_min_pu: 0.45,
        start_up_cost: 18000, shut_down_cost: 0, min_up_time: 8, min_down_time: 8, ramp_limit_up: 0.25, ramp_limit_down: 0.25, at: [-10, 1] },
      { c: 'Generator', id: 3, name: 'Combined cycle', bus: 1, p_nom: 240, marginal_cost: 52, committable: 1, p_min_pu: 0.4,
        start_up_cost: 3000, min_up_time: 4, min_down_time: 3, ramp_limit_up: 0.5, ramp_limit_down: 0.5, at: [0, 1] },
      { c: 'Generator', id: 4, name: 'Peaker', bus: 1, p_nom: 120, marginal_cost: 115, committable: 1, p_min_pu: 0.2,
        start_up_cost: 900, min_up_time: 1, min_down_time: 1, init: 0, at: [10, 1] },
      { c: 'Load', id: 5, name: 'Demand', bus: 1, p_set: 640, prof: 'sys', at: [0, 0] }
    ] };
  }
  function solar(){
    return { v: 1, name: 'Solar and a battery', el: [
      { c: 'Bus', id: 1, name: 'Town', v_nom: 132, at: [40, 24, 34] },
      { c: 'Generator', id: 2, name: 'Solar farm', bus: 1, p_nom: 420, marginal_cost: 0, prof: 'solar', style: 'pv', at: [-12, 1] },
      { c: 'Generator', id: 3, name: 'Gas turbine', bus: 1, p_nom: 260, marginal_cost: 62, committable: 1, p_min_pu: 0.35,
        start_up_cost: 4000, min_up_time: 4, min_down_time: 2, ramp_limit_up: 0.6, ramp_limit_down: 0.6, at: [-3, 1] },
      { c: 'Generator', id: 4, name: 'Peaker', bus: 1, p_nom: 150, marginal_cost: 140, committable: 1, p_min_pu: 0.2,
        start_up_cost: 600, min_up_time: 1, min_down_time: 1, init: 0, at: [6, 1] },
      { c: 'StorageUnit', id: 5, name: 'Battery', bus: 1, p_nom: 100, max_hours: 4, eff: 0.88, soc0: 0.5, at: [14, 1] },
      { c: 'Load', id: 6, name: 'Homes', bus: 1, p_set: 300, prof: 'res', at: [-6, 0] },
      { c: 'Load', id: 7, name: 'Shops and offices', bus: 1, p_set: 180, prof: 'com', at: [6, 0] }
    ] };
  }
  function areas(){
    return { v: 1, name: 'Two areas, wind and an HVDC link', el: [
      { c: 'Bus', id: 1, name: 'North', v_nom: 275, at: [16, 26, 14, 1] },
      { c: 'Bus', id: 2, name: 'South', v_nom: 275, at: [76, 26, 14, 1] },
      { c: 'Link', id: 3, name: 'HVDC link', bus0: 1, bus1: 2, p_nom: 250, efficiency: 0.97 },
      { c: 'Generator', id: 4, name: 'Wind farms', bus: 1, p_nom: 600, marginal_cost: 0, prof: 'wind', style: 'wind', at: [-4, 1] },
      { c: 'Generator', id: 5, name: 'Hydro', bus: 1, p_nom: 150, marginal_cost: 18, ramp_limit_up: 0.5, ramp_limit_down: 0.5, at: [3, 1] },
      { c: 'Load', id: 6, name: 'North load', bus: 1, p_set: 220, prof: 'ind', at: [5, 1] },
      { c: 'Generator', id: 7, name: 'Combined cycle', bus: 2, p_nom: 350, marginal_cost: 55, committable: 1, p_min_pu: 0.4,
        start_up_cost: 7000, min_up_time: 6, min_down_time: 4, ramp_limit_up: 0.4, ramp_limit_down: 0.4, at: [-4, 0] },
      { c: 'Generator', id: 8, name: 'Peakers', bus: 2, p_nom: 250, marginal_cost: 120, committable: 1, p_min_pu: 0.2,
        start_up_cost: 1200, min_up_time: 1, min_down_time: 1, init: 0, at: [4, 0] },
      { c: 'Load', id: 9, name: 'South load', bus: 2, p_set: 620, prof: 'sys', at: [0, 1] }
    ] };
  }
  ED.PRESETS = {
    pjm5:  { model: pjm5(),   opts: { mode: 'ed', hours: 24 }, hour: 18 },
    uc3:   { model: uc3(),    opts: { mode: 'uc', hours: 24 }, hour: 18 },
    solar: { model: solar(),  opts: { mode: 'uc', hours: 24 }, hour: 12 },
    areas: { model: areas(),  opts: { mode: 'uc', hours: 72 }, hour: 18 }
  };
  ED.PRESET_DEFAULT = 'pjm5';
})(typeof globalThis !== 'undefined' ? globalThis : this);
