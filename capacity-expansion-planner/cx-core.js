/* Capacity Expansion Planner: the plan, its saved form, the typical days,
   validation and the bridge to the PSA.js optimiser. No DOM here: the page,
   its Web Worker, the engine build's self-test and the audit all load this
   same file. It follows the ED/UC Simulator's ed-core.js.

   ── The question ──────────────────────────────────────────────────────────
   Which plants and batteries to build, how big, and in which year, so that a
   growing demand is met hour by hour at the least cost over the whole plan.
   It is PyPSA's multi-period investment problem (multi_investment_periods),
   solved by PSA.js and HiGHS:
     - each decision year is an investment period, standing for the years up
       to the next one;
     - every technology that can be built gets one candidate per decision
       year (a vintage), with that year's capital cost, its lifetime and
       build_year, so it runs from the year it is built until it retires;
     - each period is operated over a sample of typical days, every hour
       weighted by how many hours of the year it stands for, so a period's
       running costs are a year's;
     - capital is an annuity of the overnight cost at the discount rate, paid
       in every year the plant is in service inside the plan, and every year
       is discounted to the first.

   ── The saved form is frozen ──────────────────────────────────────────────
   A reader's plan lives on in the mini cache, scenario files, Share links
   and embeds, so everything below that names a saved value is a handle, not a
   label. Never rename a key, a kind, a profile key, a climate, a sample or a
   preset key, and never change a DEFAULTS value (a key missing from a saved
   technology means that default). Add new keys with a default that
   reproduces the old result, and migrate in load().

     { v:2, next:<id>, tech:[ technology… ], load:<profile> }

   v1 kept the load profile and the sampling in the form (the Load profile
   and Each season fields) and the 24 hours drawn by hand in prof; CX.upgrade
   turns one into the same plan written as v2.

   A technology is { id:<int>, name, kind, …values }, kind one of
     pv     solar: output follows the sun, scaled to its capacity factor
     wind   wind: output follows the wind shape, scaled the same way
     firm   anything dispatchable that burns or flows (gas, coal, nuclear,
            diesel, geothermal): up to its availability in any hour
     store  storage (a battery, pumped hydro): power rating × hours
   with
     exist   MW in service before the first year (0: none)
     retire  the year that capacity is gone by (0: it stays to the end)
     build   1 if more can be built
     capex   overnight cost per kW of new capacity, in the year of the first period
     fom     fixed operation and maintenance per kW a year (existing and new)
     vom     running cost per MWh: fuel and variable O&M
     life    years a new plant runs once built
     learn   change in capex a year, as a fraction (-0.02 is 2% cheaper each year)
     from    earliest year it can be built (0: the first year)
     max     most MW in service at once, existing included (0: no limit)
     unit    MW per unit, so it is built in whole units (0: any size)
     cf      (pv, wind) capacity factor, the year's output over rating × 8,760 h
     avail   (firm) share of its rating it can give in any hour, for outages
     co2     (firm) tonnes of CO2 per MWh
     hours   (store) hours at full power
     rte     (store) round-trip efficiency
     prof    (pv, wind) its profile, below
   A profile says how a load or a farm moves through the hours of each
   season's typical days:
     base    load: a key of CX.PROFILES ('sys' … 'flat'), or 'custom' (ts);
             pv, wind: '' the climate's sun or wind, scaled to cf, or 'custom'
     hrs     (load) a weekday's 24 hours, edited from base's (absent: base's)
     dv      1: daily variability, the days of a week differ
     dm      (load) 'day2' a weekday and a weekend day, or 'week' Monday to
             Sunday; pv and wind vary by the week's weather only, so 'week'
     f2      (load) [weekday, weekend] factors (absent: 1 and 1)
     f7      seven factors, Monday first (absent: the base's own days, or for
             pv and wind the climate's weather, CX.SUN_WEEK and CX.WIND_WEEK)
     sd      (load) 'bars': the still day is the weekday as the bars draw it,
             as v1 had it (absent: the peak season's day with the highest hour)
     ts      from a file: { r: 'day' | 'day2' | 'week', s: { <season>: [24 ×
             1, 2 or 7 days] }, pk }, one series a season of the climate by
             name or '*' for every season. A load's is per unit (its highest
             hour is the peak), a farm's per unit of its rating, as it is.
             pk (absent before it existed): { s: its season or '', h: [24] },
             the still, overcast peak day, the profile's own hours on it. A
             load's highest hour may then be on it alone, and its typical
             days stay below; without it the still day is built as ever.
             Values are kept as read, so a template reads back exactly.
   Only values that differ from DEFAULTS, or from a blank profile, are written. */
(function(root){
  'use strict';
  var CX = root.CX = root.CX || {};
  var own = Object.prototype.hasOwnProperty;

  CX.VERSION = 2;
  CX.KINDS = ['pv', 'wind', 'firm', 'store'];
  CX.KIND_WORD = { pv: 'Solar', wind: 'Wind', firm: 'Firm', store: 'Storage' };

  var DEFAULTS = {
    name: '', kind: 'firm', exist: 0, retire: 0, build: 1, capex: 0, fom: 0, vom: 0, life: 25, learn: 0,
    from: 0, max: 0, unit: 0, cf: 0.25, avail: 1, co2: 0, hours: 4, rte: 0.85
  };
  CX.DEFAULTS = DEFAULTS;
  var BIG = 1e6;
  // How each saved value is read back: [kind, min, max] or ['e', options].
  var SPEC = {
    name: ['s'], kind: ['e', CX.KINDS], exist: ['n', 0, BIG], retire: ['y'], build: ['e', [0, 1]],
    capex: ['n', 0, 1e5], fom: ['n', 0, 1e4], vom: ['n', 0, 1e5], life: ['n', 1, 100], learn: ['n', -0.2, 0.2],
    from: ['y'], max: ['n', 0, BIG], unit: ['n', 0, 1e5], cf: ['n', 0.01, 0.95], avail: ['n', 0.01, 1], co2: ['n', 0, 3],
    hours: ['n', 0.25, 1000], rte: ['n', 0.1, 1]
  };
  CX.SPEC = SPEC;
  CX.MAX_TECH = 24;

  /* What "+ Add" puts in (written out in full, so this table may change
     without changing any saved plan). Costs are typical overnight costs in
     US dollars of the mid 2020s; the reader's own figures replace them. */
  CX.NEW = {
    solar:   { name: 'Solar PV', kind: 'pv', capex: 1000, fom: 15, life: 30, learn: -0.02, cf: 0.22 },
    wind:    { name: 'Wind', kind: 'wind', capex: 1600, fom: 40, life: 25, learn: -0.01, cf: 0.35 },
    ccgt:    { name: 'Gas (CCGT)', kind: 'firm', capex: 1200, fom: 25, vom: 60, life: 30, co2: 0.37, avail: 0.92 },
    ocgt:    { name: 'Gas (OCGT)', kind: 'firm', capex: 800, fom: 15, vom: 95, life: 30, co2: 0.55, avail: 0.95 },
    coal:    { name: 'Coal', kind: 'firm', capex: 3000, fom: 50, vom: 35, life: 40, co2: 0.95, avail: 0.85 },
    nuclear: { name: 'Nuclear', kind: 'firm', capex: 8000, fom: 130, vom: 12, life: 60, avail: 0.9 },
    geo:     { name: 'Geothermal', kind: 'firm', capex: 4500, fom: 100, vom: 5, life: 30, avail: 0.9 },
    diesel:  { name: 'Diesel engines', kind: 'firm', capex: 900, fom: 20, vom: 220, life: 25, co2: 0.7, avail: 0.95 },
    battery: { name: 'Battery', kind: 'store', capex: 1200, fom: 25, life: 15, learn: -0.03, hours: 4, rte: 0.87 },
    phes:    { name: 'Pumped hydro', kind: 'store', capex: 2500, fom: 20, life: 60, hours: 10, rte: 0.78 }
  };
  CX.NEW_ORDER = ['solar', 'wind', 'ccgt', 'ocgt', 'coal', 'nuclear', 'geo', 'diesel', 'battery', 'phes'];

  /* ── Hourly shapes ──
     The ED/UC Simulator's (ed-core.js, ED.PROFILES), under the same keys,
     so a load profile reads the same on both tools. 24 values for a weekday,
     per unit of the peak (a load) or of the clear-day output (solar, wind);
     a demand shape may give a weekend day of its own (w) and seven weekday
     factors, Monday first (d), which a typical week uses. */
  CX.PROFILES = {
    sys:   { label: 'System day', kind: 'load',
             h: [0.62, 0.58, 0.56, 0.55, 0.56, 0.60, 0.68, 0.77, 0.83, 0.86, 0.88, 0.89, 0.89, 0.88, 0.87, 0.87, 0.89, 0.94, 1.00, 0.99, 0.95, 0.87, 0.77, 0.68],
             w: [0.66, 0.61, 0.58, 0.56, 0.55, 0.56, 0.59, 0.64, 0.71, 0.77, 0.81, 0.83, 0.83, 0.82, 0.81, 0.81, 0.84, 0.91, 1.00, 0.99, 0.95, 0.88, 0.79, 0.71],
             d: [0.97, 1, 1, 1, 0.97, 0.88, 0.84] },
    res:   { label: 'Residential', kind: 'load',
             h: [0.45, 0.40, 0.38, 0.37, 0.38, 0.45, 0.62, 0.78, 0.72, 0.62, 0.58, 0.56, 0.55, 0.54, 0.55, 0.60, 0.70, 0.86, 1.00, 0.98, 0.90, 0.78, 0.64, 0.52],
             w: [0.50, 0.44, 0.41, 0.39, 0.38, 0.40, 0.46, 0.57, 0.69, 0.76, 0.78, 0.77, 0.75, 0.73, 0.72, 0.74, 0.80, 0.90, 1.00, 0.98, 0.91, 0.80, 0.68, 0.56],
             d: [0.98, 0.97, 0.97, 0.98, 1, 1.03, 1.02] },
    com:   { label: 'Commercial', kind: 'load',
             h: [0.38, 0.36, 0.35, 0.35, 0.36, 0.40, 0.52, 0.72, 0.88, 0.96, 1.00, 1.00, 0.98, 0.99, 0.98, 0.95, 0.88, 0.74, 0.60, 0.52, 0.47, 0.44, 0.41, 0.39],
             w: [0.42, 0.40, 0.39, 0.39, 0.39, 0.40, 0.43, 0.49, 0.57, 0.65, 0.70, 0.72, 0.72, 0.71, 0.69, 0.66, 0.62, 0.58, 0.54, 0.51, 0.48, 0.46, 0.44, 0.43],
             d: [0.98, 1, 1, 1, 0.96, 0.85, 0.75] },
    ind:   { label: 'Industrial', kind: 'load',
             h: [0.78, 0.77, 0.76, 0.76, 0.77, 0.80, 0.88, 0.96, 1.00, 1.00, 0.99, 0.97, 0.95, 0.98, 1.00, 0.99, 0.96, 0.90, 0.86, 0.84, 0.82, 0.81, 0.80, 0.79],
             w: [0.79, 0.78, 0.77, 0.77, 0.77, 0.78, 0.81, 0.85, 0.88, 0.89, 0.89, 0.88, 0.87, 0.87, 0.87, 0.87, 0.86, 0.84, 0.83, 0.82, 0.81, 0.80, 0.80, 0.79],
             d: [0.98, 1, 1, 1, 0.98, 0.88, 0.82] },
    respv: { label: 'Residential (with Rooftop PV)', kind: 'load',
             h: [0.45, 0.40, 0.38, 0.37, 0.38, 0.44, 0.58, 0.62, 0.42, 0.26, 0.18, 0.14, 0.13, 0.14, 0.20, 0.32, 0.52, 0.82, 1.00, 0.98, 0.90, 0.78, 0.64, 0.52],
             w: [0.50, 0.44, 0.41, 0.39, 0.38, 0.40, 0.44, 0.48, 0.42, 0.32, 0.26, 0.23, 0.22, 0.23, 0.28, 0.40, 0.60, 0.86, 1.00, 0.98, 0.91, 0.80, 0.68, 0.56],
             d: [0.98, 0.97, 0.97, 0.98, 1, 1.03, 1.02] },
    resev: { label: 'Residential (with EV)', kind: 'load',
             h: [0.58, 0.52, 0.47, 0.43, 0.41, 0.44, 0.56, 0.68, 0.62, 0.53, 0.49, 0.47, 0.46, 0.46, 0.48, 0.53, 0.63, 0.78, 0.92, 1.00, 0.98, 0.92, 0.82, 0.70],
             w: [0.62, 0.55, 0.50, 0.46, 0.43, 0.43, 0.46, 0.53, 0.62, 0.70, 0.74, 0.75, 0.74, 0.72, 0.71, 0.72, 0.77, 0.86, 0.95, 1.00, 0.97, 0.90, 0.80, 0.70],
             d: [0.98, 0.97, 0.97, 0.98, 1, 1.04, 1.03] },
    pvs:   { label: 'Solar (Summer)', kind: 'gen',
             h: [0, 0, 0, 0, 0, 0.02, 0.08, 0.22, 0.40, 0.57, 0.71, 0.81, 0.86, 0.86, 0.81, 0.71, 0.57, 0.40, 0.22, 0.08, 0.02, 0, 0, 0] },
    pv:    { label: 'Solar (Spring or Autumn)', kind: 'gen',
             h: [0, 0, 0, 0, 0, 0, 0.03, 0.15, 0.35, 0.55, 0.70, 0.79, 0.82, 0.79, 0.70, 0.55, 0.35, 0.15, 0.03, 0, 0, 0, 0, 0] },
    pvw:   { label: 'Solar (Winter)', kind: 'gen',
             h: [0, 0, 0, 0, 0, 0, 0, 0.02, 0.12, 0.27, 0.40, 0.49, 0.52, 0.49, 0.40, 0.27, 0.12, 0.02, 0, 0, 0, 0, 0, 0] },
    pveq:  { label: 'Solar (Equator)', kind: 'gen',
             h: [0, 0, 0, 0, 0, 0, 0.02, 0.14, 0.34, 0.54, 0.70, 0.80, 0.83, 0.78, 0.66, 0.49, 0.29, 0.10, 0.01, 0, 0, 0, 0, 0] },
    wnd:   { label: 'Wind', kind: 'gen',
             h: [0.62, 0.66, 0.70, 0.72, 0.70, 0.66, 0.60, 0.52, 0.44, 0.38, 0.33, 0.30, 0.29, 0.31, 0.35, 0.40, 0.46, 0.52, 0.56, 0.58, 0.60, 0.61, 0.60, 0.61] },
    // The same every hour and every day: a data centre, a smelter, or 24 hours drawn by hand.
    flat:  { label: 'Flat', kind: 'load',
             h: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] }
  };
  CX.LOAD_KEYS = ['sys', 'res', 'com', 'ind', 'respv', 'resev', 'flat'];
  CX.DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  // A week of weather, Monday first: the ED/UC Simulator's cloudier and calmer days.
  CX.SUN_WEEK = [1, 0.9, 0.6, 1, 0.95, 0.75, 1];
  CX.WIND_WEEK = [1, 0.75, 1.2, 0.55, 0.9, 1.25, 0.8];

  /* ── Climates: the seasons a year is sampled by (keys frozen; new ones are added beside them) ──
     dem is a season's peak as a share of the year's, sol the solar shape
     of its days (and solf a factor on it, for a cloudier wet season), wind
     a factor on the wind shape. The peak season is the one at 1. */
  CX.CLIMATES = {
    sum:  { label: 'Summer peak, Dec to Feb', seasons: [
            { name: 'Summer', days: 91.25, dem: 1.00, sol: 'pvs', solf: 1, wind: 0.85, mon: [11, 0, 1] },
            { name: 'Autumn', days: 91.25, dem: 0.86, sol: 'pv', solf: 1, wind: 1.00, mon: [2, 3, 4] },
            { name: 'Winter', days: 91.25, dem: 0.90, sol: 'pvw', solf: 1, wind: 1.20, mon: [5, 6, 7] },
            { name: 'Spring', days: 91.25, dem: 0.84, sol: 'pv', solf: 1, wind: 0.95, mon: [8, 9, 10] }] },
    win:  { label: 'Winter peak, Jun to Aug', seasons: [
            { name: 'Summer', days: 91.25, dem: 0.84, sol: 'pvs', solf: 1, wind: 0.85, mon: [11, 0, 1] },
            { name: 'Autumn', days: 91.25, dem: 0.88, sol: 'pv', solf: 1, wind: 1.00, mon: [2, 3, 4] },
            { name: 'Winter', days: 91.25, dem: 1.00, sol: 'pvw', solf: 1, wind: 1.20, mon: [5, 6, 7] },
            { name: 'Spring', days: 91.25, dem: 0.86, sol: 'pv', solf: 1, wind: 0.95, mon: [8, 9, 10] }] },
    trop: { label: 'Tropical, wet Nov to Apr', seasons: [
            { name: 'Dry season', days: 182.5, dem: 1.00, sol: 'pveq', solf: 1, wind: 0.9, mon: [4, 5, 6, 7, 8, 9] },
            { name: 'Wet season', days: 182.5, dem: 0.96, sol: 'pveq', solf: 0.8, wind: 1.1, mon: [10, 11, 0, 1, 2, 3] }] }
  };
  /* The months of each season (mon, January 0) say when it is, so a year
     of hours from a file falls into its seasons, and the full-year template
     is dated. The climates above are the southern hemisphere's; each has a
     northern one (key + '-n') with the very same seasons, six months on, so
     a plan runs the same on either and only the dates differ. peaks names
     the season a temperate climate's demand is highest in, and flip is the
     climate of the same months that peaks in the other. */
  var NORTH = { sum: 'Summer peak, Jun to Aug', win: 'Winter peak, Dec to Feb', trop: 'Tropical, wet May to Oct' };
  Object.keys(NORTH).forEach(function(k){
    var seasons = CX.CLIMATES[k].seasons.map(function(z){ var o = {}; for(var q in z) o[q] = z[q]; o.mon = z.mon.map(function(m){ return (m + 6) % 12; }); return o; });
    CX.CLIMATES[k + '-n'] = { label: NORTH[k], seasons: seasons };
  });
  Object.keys(CX.CLIMATES).forEach(function(k){
    var base = k.replace(/-n$/, ''), n = k === base ? '' : '-n';
    CX.CLIMATES[k].peaks = base === 'sum' ? 'Summer' : base === 'win' ? 'Winter' : null;
    CX.CLIMATES[k].flip = base === 'sum' ? 'win' + n : base === 'win' ? 'sum' + n : null;
    CX.CLIMATES[k].north = !!n;
  });
  // The months of season i, and the season (its index) month m (January 0) falls in.
  CX.seasonMonths = function(climate, i){ return CX.CLIMATES[climate].seasons[i].mon.slice(); };
  CX.seasonOfMonth = function(climate, m){
    var S = CX.CLIMATES[climate].seasons;
    for(var i = 0; i < S.length; i++) if(S[i].mon.indexOf(m) >= 0) return i;
    return 0;
  };
  CX.MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // The days of year y: the first (days since 1970) and how many.
  CX.yearDays = function(y){ var d0 = Math.floor(Date.UTC(y, 0, 1) / 86400000); return { d0: d0, n: Math.floor(Date.UTC(y + 1, 0, 1) / 86400000) - d0 }; };
  CX.SAMPLES = ['day', 'day2', 'week'];
  // The days each sampling holds, and how fine it is.
  CX.RES_DAYS = { day: 1, day2: 2, week: 7 };
  var FINE = { day: 0, day2: 1, week: 2 };
  CX.MAX_SEASONS = 12;
  // The still, overcast peak day: the days a year it stands for, and its sun and wind.
  CX.STRESS = { days: 2, sun: 0.25, wind: 0.1 };
  CX.MAX_HOURS = 6000;     // decision years × sampled hours the browser is asked to solve
  CX.SLOW_HOURS = 2500;

  /* ── Small helpers ── */
  function num(v){ var x = typeof v === 'string' && v.trim() !== '' ? Number(v.replace(/,/g, '').replace(/−/g, '-')) : v; return typeof x === 'number' && isFinite(x) ? x : NaN; }
  function clamp(v, lo, hi){ return Math.min(hi, Math.max(lo, v)); }
  function str(v, max){ return typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').slice(0, max || 60) : ''; }
  function toInt(v){ var x = num(v); return isNaN(x) ? NaN : Math.round(x); }
  function r6(x){ return Math.round(x * 1e6) / 1e6; }
  CX.num = num;

  function readValue(spec, v, dflt){
    var k = spec[0];
    if(k === 's') return typeof v === 'string' ? str(v, 60).trim() : dflt;
    if(k === 'y'){
      // A year, or 0 for none. One outside the calendar the tool plans in is none.
      var y = toInt(v);
      if(isNaN(y)) return dflt;
      return y >= 1900 && y <= 2200 ? y : 0;
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
    var n = num(v);
    if(isNaN(n)) return dflt;
    return clamp(n, spec[1], spec[2]);
  }
  function readProf(v){
    if(!Array.isArray(v) || v.length !== 24) return '';
    return v.map(function(x){ var n = num(x); return isNaN(n) ? 0 : r6(clamp(n, 0, 2)); });
  }
  // A day's factors: n numbers from 0 to 2, or '' for none of its own.
  function readFactors(v, n){
    if(!Array.isArray(v) || v.length !== n) return '';
    return v.map(function(x){ var k = num(x); return isNaN(k) ? 1 : r6(clamp(k, 0, 2)); });
  }
  /* A profile from a file: its sampling and a series a season, each the
     right length, and its peak day if it has a whole one. Values are kept as
     they were saved: a file's were rounded to 6 places before the peak day
     came, and still read to exactly those. */
  function readTs(v, cap){
    if(!v || typeof v !== 'object' || !own.call(CX.RES_DAYS, v.r) || !v.s || typeof v.s !== 'object' || Array.isArray(v.s)) return null;
    var n = 24 * CX.RES_DAYS[v.r], out = {}, k = 0;
    var vals = function(a){ return a.map(function(x){ var q = num(x); return isNaN(q) ? 0 : clamp(q, 0, cap); }); };
    Object.keys(v.s).forEach(function(name){
      var a = v.s[name], key = name === '*' ? '*' : str(name, 40).trim();
      if(k >= CX.MAX_SEASONS || !key || /^(__proto__|constructor|prototype)$/.test(key) || own.call(out, key) || !Array.isArray(a) || a.length !== n) return;
      out[key] = vals(a);
      k++;
    });
    if(!k) return null;
    var ts = { r: v.r, s: out }, pk = v.pk;
    if(pk && typeof pk === 'object' && Array.isArray(pk.h) && pk.h.length === 24){
      var ps = typeof pk.s === 'string' ? str(pk.s, 40).trim() : '';
      ts.pk = { s: /^(__proto__|constructor|prototype)$/.test(ps) ? '' : ps, h: vals(pk.h) };
    }
    return ts;
  }

  /* ── Profiles: a load's, or a solar or wind farm's (kind 'gen') ── */
  CX.blankProfile = function(kind){
    return kind === 'load' ? { base: 'sys', hrs: '', dv: 0, dm: 'day2', f2: '', f7: '', ts: null, sd: '' } : { base: '', dv: 0, f7: '', ts: null };
  };
  CX.readProfile = function(raw, kind){
    var load = kind === 'load', p = CX.blankProfile(kind);
    if(!raw || typeof raw !== 'object') return p;
    if(load) p.base = CX.LOAD_KEYS.indexOf(raw.base) >= 0 || raw.base === 'custom' ? raw.base : 'sys';
    else p.base = raw.base === 'custom' ? 'custom' : '';
    p.dv = flag(raw.dv, false) ? 1 : 0;
    p.f7 = readFactors(raw.f7, 7);
    p.ts = readTs(raw.ts, load ? 100 : 1);
    if(load){
      p.hrs = readProf(raw.hrs);
      p.dm = raw.dm === 'week' ? 'week' : 'day2';
      p.f2 = readFactors(raw.f2, 2);
      p.sd = raw.sd === 'bars' ? 'bars' : '';
    }
    return p;
  };
  function compactProfile(p, kind){
    var b = CX.blankProfile(kind), o = {}, any = false;
    if(!p) return null;
    for(var k in b){
      var v = p[k];
      if(v === b[k] || v === undefined) continue;
      o[k] = Array.isArray(v) ? v.slice() : v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v;
      any = true;
    }
    return any ? o : null;
  }
  // Whether a profile takes its hours from a file it has.
  CX.isCustom = function(p){ return !!(p && p.base === 'custom' && p.ts); };
  /* The sampling a profile asks for: a file's own, one typical day without
     daily variability, and with it a load's choice, or a farm's week of weather. */
  CX.need = function(p, kind){
    if(CX.isCustom(p)) return p.ts.r;
    if(!p || !p.dv) return 'day';
    return kind === 'load' ? p.dm : 'week';
  };
  CX.finer = function(a, b){ return FINE[b] > FINE[a] ? b : a; };

  CX.autoName = function(e){ return CX.KIND_WORD[e.kind] + ' ' + e.id; };
  CX.nameOf = function(e){ return e.name || CX.autoName(e); };

  /* ── Reading a saved plan: never throws ──
     A plan saved before v2 also needs the form it was saved with to say what
     its load did (CX.upgrade). Read alone it keeps what that needs in legacy,
     which is never written back. */
  CX.blank = function(){ return { next: 1, tech: [], load: CX.blankProfile('load') }; };
  CX.load = function(raw){
    var m = CX.blank();
    try {
      if(!raw || typeof raw !== 'object') return m;
      var v2 = num(raw.v) >= 2;
      var list = Array.isArray(raw.tech) ? raw.tech.slice(0, CX.MAX_TECH) : [];
      var used = {}, pending = [];
      list.forEach(function(r){
        if(!r || typeof r !== 'object') return;
        var e = { id: toInt(r.id) };
        for(var k in DEFAULTS) e[k] = own.call(r, k) ? readValue(SPEC[k], r[k], DEFAULTS[k]) : DEFAULTS[k];
        e.prof = CX.readProfile(r.prof, 'gen');
        if(!(e.id > 0) || e.id > 1e6 || used[e.id]) pending.push(e);
        else used[e.id] = 1;
        m.tech.push(e);
      });
      // Duplicate or missing ids get fresh ones.
      var next = 1;
      m.tech.forEach(function(e){ if(pending.indexOf(e) < 0 && e.id >= next) next = e.id + 1; });
      pending.forEach(function(e){ e.id = next++; });
      var maxId = 0;
      m.tech.forEach(function(e){ if(e.id > maxId) maxId = e.id; });
      var savedNext = toInt(raw.next);
      m.next = Math.max(maxId + 1, isNaN(savedNext) ? 1 : clamp(savedNext, 1, 1e6));
      if(v2) m.load = CX.readProfile(raw.load, 'load');
      else m.legacy = { prof: readProf(raw.prof) };
    } catch(err){
      if(root.console) root.console.warn('Capacity Expansion Planner: could not read that plan', err);
      return CX.blank();
    }
    return m;
  };

  /* A v1 plan with the form it was saved with ({ profile, sample }, as the
     Load profile and Each season fields held them), written as v2 so it
     computes exactly what it did:
       - Custom with 24 hours drawn was those hours every day, at each season's
         level: Flat, edited. Custom with none was the System day.
       - A weekday and a weekend day is daily variability by weekday and
         weekend at 100% each; a typical week is the shape's own seven days,
         and the cloudier and calmer days of every solar and wind farm. */
  CX.upgrade = function(model, f){
    f = f && typeof f === 'object' ? f : {};
    var L = CX.blankProfile('load'), drawn = model.legacy && model.legacy.prof;
    var prof = typeof f.profile === 'string' ? f.profile : 'sys';
    if(prof === 'custom'){ if(Array.isArray(drawn)){ L.base = 'flat'; L.hrs = drawn.slice(); } }
    else if(CX.LOAD_KEYS.indexOf(prof) >= 0 && prof !== 'flat') L.base = prof;
    if(f.sample === 'day2' || f.sample === 'week'){ L.dv = 1; L.dm = f.sample; }
    if(f.sample === 'week'){
      // Its still day was the weekday as the bars drew it, which in a week can be below a weekend's peak.
      L.sd = 'bars';
      model.tech.forEach(function(e){ if(e.kind === 'pv' || e.kind === 'wind') e.prof.dv = 1; });
    }
    model.load = L;
    delete model.legacy;
    return model;
  };

  /* ── Writing it back, only what differs from the defaults ── */
  CX.compact = function(model){
    var out = { v: CX.VERSION, next: model.next, tech: model.tech.map(function(e){
      var o = { id: e.id };
      for(var k in DEFAULTS) if(e[k] !== DEFAULTS[k]) o[k] = e[k];
      if(o.name === CX.autoName(e)) delete o.name;
      var pc = compactProfile(e.prof, 'gen');
      if(pc) o.prof = pc;
      return o;
    }) };
    var lc = compactProfile(model.load, 'load');
    if(lc) out.load = lc;
    return out;
  };
  CX.newTech = function(model, key){
    var t = { id: model.next++ };
    for(var k in DEFAULTS) t[k] = DEFAULTS[k];
    var nw = CX.NEW[key] || {};
    for(var k2 in nw) t[k2] = nw[k2];
    t.prof = CX.blankProfile('gen');
    return t;
  };

  /* ── Options: the plan's own figures, read from the form, never trusted ── */
  var STEPS = [1, 2, 3, 4, 5, 10];
  function pick(v, list, dflt){ var x = num(v); return list.indexOf(x) >= 0 ? x : dflt; }
  function inRange(v, lo, hi, dflt){ var x = num(v); return isNaN(x) ? dflt : clamp(x, lo, hi); }
  function flag(v, dflt){ return v === false || v === 0 || v === '0' ? false : v === true || v === 1 || v === '1' ? true : dflt; }
  CX.options = function(o){
    o = o || {};
    var start = Math.round(inRange(o.start, 2000, 2100, 2026));
    var end = Math.round(inRange(o.end, 2000, 2150, 2050));
    end = clamp(end, start, start + 60);
    /* The discount rate the plan runs on is always real (rate). Real mode
       (the default, and every plan saved before the mode) takes it as typed;
       Nominal mode takes it from a nominal rate and inflation by Fisher,
       (1 + nominal) / (1 + inflation) - 1, held to the same ends. */
    var rateMode = o.rateMode === 'nominal' ? 'nominal' : 'real';
    var nomRate = inRange(o.nomRate, 0, 50, 10.2), inflation = inRange(o.inflation, 0, 20, 3);
    var rate = rateMode === 'nominal' ? CX.realRate(nomRate, inflation) : inRange(o.rate, 0, 20, 7);
    // The load profile and the sampling are the plan's own (model.load, CX.sampling), not options.
    return {
      peak: inRange(o.peak, 1, BIG, 1000),
      growth: inRange(o.growth, -5, 15, 3),
      start: start, end: end,
      step: pick(o.step, STEPS, 5),
      shed: flag(o.shed, true),
      voll: inRange(o.voll, 500, 1e5, 20000),
      carbon: inRange(o.carbon, 0, 2000, 0),
      carbonGrow: inRange(o.carbonGrow, 0, 30, 0),
      netZero: flag(o.netZero, false),
      nzYear: Math.round(inRange(o.nzYear, 2000, 2150, 2045)),
      rateMode: rateMode,
      rate: rate,
      nomRate: nomRate,
      inflation: inflation,
      climate: own.call(CX.CLIMATES, o.climate) ? o.climate : 'sum',
      stress: flag(o.stress, false),
      time: pick(o.time, [10, 30, 60, 300], 60),
      gap: pick(o.gap, [0.0001, 0.001, 0.01], 0.001)
    };
  };

  /* The real rate, in % a year, that a nominal rate and inflation (both in %)
     come to. Rounded to 10 decimals so a pair that makes a round real rate
     (10.21 and 3 come to 7) runs on exactly it; below 0 it is taken as 0,
     above 20 as 20, the real rate's own ends. */
  CX.realRate = function(nominal, inflation){
    return clamp(+((nominal - inflation) / (100 + inflation) * 100).toFixed(10), 0, 20);
  };

  // The discount rate a plan ran on, in words: "7.0% discount rate", or from a nominal rate and inflation.
  CX.rateWords = function(o){
    var F = CX.fmt;
    return o.rateMode === 'nominal' ? F.rate(o.rate) + '% real discount rate, from ' + F.rate(o.nomRate) + '% nominal and ' + F.rate(o.inflation) + '% inflation'
      : F.rate(o.rate) + '% discount rate';
  };

  /* The decision years: the first, then every step, each standing for the
     years up to the next one (the last for the years to the end). */
  CX.periods = function(o){
    var out = [];
    for(var y = o.start; y <= o.end; y += o.step) out.push({ year: y, years: Math.min(o.step, o.end + 1 - y) });
    return out;
  };
  // Discount factors: what a year's money in each period is worth in the first year, summed over its years.
  CX.discount = function(o, P){
    var r = o.rate / 100;
    return P.map(function(p){
      var s = 0;
      for(var k = 0; k < p.years; k++) s += 1 / Math.pow(1 + r, p.year - o.start + k);
      return s;
    });
  };
  // The annuity that pays back one unit of overnight cost over life years at rate r.
  CX.annuity = function(r, life){
    if(!(life > 0)) return 0;
    if(r === 0) return 1 / life;
    return r / (1 - Math.pow(1 + r, -life));
  };

  /* ── The typical days a year is sampled by ──
     The profiles set it, so they can never disagree with it: each season is
     one weekday ('day'), a weekday and a weekend day ('day2'), or a Monday-
     to-Sunday week ('week'), the finest any profile in the plan asks for
     (CX.need). A profile coarser than the sampling repeats: one typical day
     every day, a weekday Monday to Friday and a weekend day Saturday and
     Sunday. With stress on, a still and overcast day at the year's peak
     stands for CX.STRESS.days of the peak season. Each hour carries w, the
     hours of a year it stands for, so the weights add up to 8,760.
     load is per unit of the year's peak (the highest hour is 1); sun and
     wind are the climate's raw shapes, and gen[id] each farm's own, which
     CX.avail scales to its capacity factor (or, from a file, takes as it is). */
  CX.inPlan = function(e, o, last){
    return (e.exist > 0 && (!e.retire || e.retire > o.start)) || (!!e.build && (!e.from || e.from <= last));
  };
  // The sampling, and what sets it: null for the load, a technology's id for its farm.
  CX.sampling = function(model, o){
    var P = CX.periods(o), last = P[P.length - 1].year, list = [{ who: null, r: CX.need(model.load, 'load') }], r = 'day';
    model.tech.forEach(function(e){
      if((e.kind === 'pv' || e.kind === 'wind') && CX.inPlan(e, o, last)) list.push({ who: e.id, r: CX.need(e.prof, e.kind) });
    });
    list.forEach(function(x){ r = CX.finer(r, x.r); });
    return { r: r, by: r === 'day' ? [] : list.filter(function(x){ return x.r === r; }).map(function(x){ return x.who; }) };
  };
  // The day of a profile's own sampling that stands for weekday wd (Monday 0).
  CX.dayOf = function(r, wd){ return r === 'week' ? wd : r === 'day2' ? (wd >= 5 ? 1 : 0) : 0; };
  // A file's series for a season: its own, else the one for every season, else the average of those it has.
  CX.tsSeries = function(ts, name){
    if(own.call(ts.s, name)) return ts.s[name];
    if(own.call(ts.s, '*')) return ts.s['*'];
    var keys = Object.keys(ts.s), n = keys.length;
    return ts.s[keys[0]].map(function(_, i){ var t = 0; keys.forEach(function(k){ t += ts.s[k][i]; }); return t / n; });
  };
  // The climate's seasons a file has no series for.
  CX.tsMissing = function(ts, seasons){
    if(!ts || own.call(ts.s, '*')) return [];
    return seasons.filter(function(s){ return !own.call(ts.s, s.name); }).map(function(s){ return s.name; });
  };
  // A load's built-in shape: its base, or for Custom with no file the System day.
  CX.loadBase = function(L){ return L && L.base !== 'custom' && own.call(CX.PROFILES, L.base) ? L.base : 'sys'; };
  function baseOf(L){ return CX.PROFILES[CX.loadBase(L)]; }
  // The 24 bars: a weekday's hours.
  CX.loadHours = function(L){ var p = baseOf(L); return (Array.isArray(L.hrs) ? L.hrs : p.h).slice(); };
  // The daily bars: [weekday, weekend], or Monday to Sunday.
  CX.loadDays2 = function(L){ return Array.isArray(L.f2) ? L.f2.slice() : [1, 1]; };
  CX.loadWeek = function(L){ var p = baseOf(L); return Array.isArray(L.f7) ? L.f7.slice() : p.d ? p.d.slice() : [1, 1, 1, 1, 1, 1, 1]; };
  CX.genWeek = function(p, kind){ return p && Array.isArray(p.f7) ? p.f7.slice() : (kind === 'pv' ? CX.SUN_WEEK : CX.WIND_WEEK).slice(); };
  /* A load's 24 hours on weekday wd of season s, before the year's peak is
     made 1. Built in: the bars, at the season's level; with daily variability
     a weekend hour is the shape's weekend day moved by as much as its weekday
     hour was edited, and every hour takes its day's factor. From a file: the
     season's own hours. The still day is the peak season's highest day, or
     (sd 'bars') its weekday as the bars draw it, or a file's peak day. */
  function loadDay(L, s, wd, stress){
    var out = new Array(24), h, v;
    if(CX.isCustom(L)){
      if(stress && L.ts.pk){ for(h = 0; h < 24; h++) out[h] = Math.max(0, +L.ts.pk.h[h] || 0); return out; }
      var ser = CX.tsSeries(L.ts, s.name), at = CX.dayOf(L.ts.r, wd) * 24;
      for(h = 0; h < 24; h++) out[h] = Math.max(0, +ser[at + h] || 0);
      return out;
    }
    var p = baseOf(L), hv = Array.isArray(L.hrs) ? L.hrs : p.h, daily = L.dv && !(stress && L.sd === 'bars'), we = wd >= 5;
    var f = daily ? (L.dm === 'week' ? CX.loadWeek(L)[wd] : CX.loadDays2(L)[we ? 1 : 0]) : 1;
    for(h = 0; h < 24; h++){
      v = daily && we && p.w ? p.w[h] + (hv[h] - p.h[h]) : hv[h];
      if(daily) v *= f;
      out[h] = Math.max(0, +v || 0) * s.dem;
    }
    return out;
  }
  CX.sample = function(model, o){
    var C = CX.CLIMATES[o.climate], seasons = C.seasons, L = model.load || CX.blankProfile('load');
    var smp = CX.sampling(model, o), r = smp.r, custom = CX.isCustom(L);
    var wds = r === 'week' ? [0, 1, 2, 3, 4, 5, 6] : r === 'day2' ? [0, 5] : [0];
    // The peak season holds the highest hour (the first of equals), and its highest day is the still day.
    var peakS = 0, peakWd = 0, top0 = -1;
    seasons.forEach(function(s, i){
      wds.forEach(function(wd){
        var m = Math.max.apply(null, loadDay(L, s, wd, false));
        if(m > top0){ top0 = m; peakS = i; peakWd = wd; }
      });
    });
    // A file's peak day names its season, which the still day then stands in.
    var pkS = custom && L.ts.pk ? seasons.map(function(s){ return s.name; }).indexOf(L.ts.pk.s) : -1;
    if(pkS >= 0) peakS = pkS;
    var stressWd = !custom && L.sd === 'bars' ? 0 : peakWd;
    var days = [];
    seasons.forEach(function(s, i){
      var n = s.days - (o.stress && i === peakS ? CX.STRESS.days : 0);
      if(r === 'week'){
        for(var d = 0; d < 7; d++) days.push({ s: i, wd: d, we: d >= 5, weight: n / 7 });
      } else if(r === 'day2'){
        days.push({ s: i, wd: 0, we: false, weight: n * 5 / 7 });
        days.push({ s: i, wd: 5, we: true, weight: n * 2 / 7 });
      } else days.push({ s: i, wd: 0, we: false, weight: n });
    });
    if(o.stress) days.push({ s: peakS, wd: stressWd, we: stressWd >= 5, weight: CX.STRESS.days, stress: true });
    var H = days.length * 24, w = [], load = [], sun = [], wind = [], top = 0;
    days.forEach(function(dy){
      var s = seasons[dy.s], sol = CX.PROFILES[s.sol].h, wn = CX.PROFILES.wnd.h, ld = loadDay(L, s, dy.wd, dy.stress);
      for(var h = 0; h < 24; h++){
        load.push(ld[h]);
        if(ld[h] > top) top = ld[h];
        sun.push(sol[h] * s.solf * (dy.stress ? CX.STRESS.sun : 1));
        wind.push(wn[h] * s.wind * (dy.stress ? CX.STRESS.wind : 1));
        w.push(dy.weight);
      }
    });
    // A file's peak day holds the year's highest hour whether or not the still day is run.
    if(custom && L.ts.pk) L.ts.pk.h.forEach(function(v){ if(+v > top) top = +v; });
    for(var t = 0; t < H; t++) load[t] = top > 0 ? load[t] / top : 0;
    // Each farm's own: the climate's with its week of weather, or its file's hours.
    var gen = {};
    model.tech.forEach(function(e){
      if(e.kind !== 'pv' && e.kind !== 'wind') return;
      var p = e.prof, isPv = e.kind === 'pv', base = isPv ? sun : wind, out = new Array(H), k = 0;
      if(CX.isCustom(p)){
        // The still day takes the file's peak day as it is, else the clearest (or windiest) of the season's days in it, as the climate's takes a clear one.
        var ser = seasons.map(function(s){ return CX.tsSeries(p.ts, s.name); }), nd = CX.RES_DAYS[p.ts.r], best = 0, most = -1, pk = p.ts.pk;
        for(var q = 0; q < nd; q++){ var tot = 0; for(var hq = 0; hq < 24; hq++) tot += +ser[peakS][q * 24 + hq] || 0; if(tot > most){ most = tot; best = q; } }
        days.forEach(function(dy){
          if(dy.stress && pk){ for(var hp = 0; hp < 24; hp++) out[k++] = Math.max(0, +pk.h[hp] || 0); return; }
          var at = (dy.stress ? best : CX.dayOf(p.ts.r, dy.wd)) * 24, still = dy.stress ? (isPv ? CX.STRESS.sun : CX.STRESS.wind) : 1;
          for(var h = 0; h < 24; h++) out[k++] = Math.max(0, +ser[dy.s][at + h] || 0) * still;
        });
      } else {
        var f = p && p.dv && r === 'week' ? CX.genWeek(p, e.kind) : null;
        days.forEach(function(dy){ for(var h = 0; h < 24; h++){ out[k] = f && !dy.stress ? base[k] * f[dy.wd] : base[k]; k++; } });
      }
      gen[e.id] = out;
    });
    // The blocks the dispatch chart names: a week is one block of seven days,
    // a weekday and a weekend day two under one season (group).
    var blocks = [], at = 0;
    days.forEach(function(dy){
      var s = seasons[dy.s];
      if(r === 'week' && !dy.stress && dy.wd > 0){ blocks[blocks.length - 1].len += 24; at += 24; return; }
      blocks.push({ from: at, len: 24, stress: !!dy.stress, wd: dy.wd,
        name: dy.stress ? 'Still, overcast day' : r === 'week' ? s.name + ' week' : r === 'day2' ? s.name + (dy.we ? ' weekend' : ' weekday') : s.name,
        group: dy.stress ? 'Still, overcast day' : s.name, day: r === 'day2' ? (dy.we ? 'Weekend' : 'Weekday') : '',
        season: s.name, days: r === 'week' && !dy.stress ? s.days - (o.stress && dy.s === peakS ? CX.STRESS.days : 0) : dy.weight });
      at += 24;
    });
    var energy = 0;
    for(var t2 = 0; t2 < H; t2++) energy += w[t2] * load[t2];
    return { H: H, w: w, load: load, sun: sun, wind: wind, gen: gen, blocks: blocks, peakSeason: seasons[peakS].name,
             energy: energy, loadFactor: energy / 8760, days: days, sample: r, sampleBy: smp.by, seasons: seasons };
  };
  /* Any hourly series of a sample, through each season's days at sampling r
     (coarser or finer than the sample's: a day stands for the weekdays it
     covers), the still day left out: { r, s: { <season>: [24 × days] } }. */
  CX.gridOf = function(S, a, r){
    var out = {}, wds = r === 'week' ? [0, 1, 2, 3, 4, 5, 6] : r === 'day2' ? [0, 5] : [0];
    S.seasons.forEach(function(s, i){
      var v = [];
      wds.forEach(function(wd){
        var want = S.sample === 'week' ? wd : S.sample === 'day2' && wd >= 5 ? 5 : 0, k = -1;
        S.days.forEach(function(d, j){ if(k < 0 && d.s === i && !d.stress && d.wd === want) k = j; });
        for(var h = 0; h < 24; h++) v.push(a[k * 24 + h]);
      });
      out[s.name] = v;
    });
    return { r: r, s: out };
  };

  /* A technology's availability in each sampled hour, per unit of its
     rating: solar and wind scaled so the year's output is its capacity
     factor (no hour above 1), or from a file as the file gives it (literal),
     a firm plant its availability every hour. reach is false when the shape
     cannot give that much even at 1 in every hour it has any. */
  CX.avail = function(e, S){
    var H = S.H, out = new Array(H), t;
    if(e.kind === 'firm'){ for(t = 0; t < H; t++) out[t] = e.avail; return { a: out, reach: true }; }
    if(e.kind === 'store'){ for(t = 0; t < H; t++) out[t] = 1; return { a: out, reach: true }; }
    var raw = S.gen && e.id != null && S.gen[e.id] ? S.gen[e.id] : e.kind === 'pv' ? S.sun : S.wind;
    var energy = function(k){ var s = 0; for(var i = 0; i < H; i++) s += S.w[i] * Math.min(1, k * raw[i]); return s / 8760; };
    if(CX.isCustom(e.prof)){
      for(t = 0; t < H; t++) out[t] = Math.min(1, raw[t]);
      return { a: out, reach: true, cf: energy(1), literal: true };
    }
    var lo = 0, hi = 1, i;
    while(energy(hi) < e.cf && hi < 1e6) hi *= 2;
    var reach = energy(hi) >= e.cf - 1e-9;
    for(i = 0; i < 100 && reach; i++){ var mid = (lo + hi) / 2; if(energy(mid) < e.cf) lo = mid; else hi = mid; }
    for(t = 0; t < H; t++) out[t] = Math.min(1, hi * raw[t]);
    return { a: out, reach: reach, cf: energy(hi) };
  };

  /* ── Validation: errors stop a run, warnings say what the run will do ── */
  CX.validate = function(model, options){
    var o = CX.options(options), P = CX.periods(o), errors = [], warnings = [];
    var last = P[P.length - 1].year, S = CX.sample(model, o);
    if(!model.tech.length) errors.push({ id: null, msg: 'Add at least one technology.' });
    var fewer = S.sample === 'day' ? 'Take fewer decision years.' : 'Take fewer decision years, or less daily variability in the profiles (' + list(S.sampleBy.map(whoName(model))) + ').';
    if(P.length * S.H > CX.MAX_HOURS)
      errors.push({ id: null, msg: P.length + ' decision years of ' + S.H + ' hours each is ' + (P.length * S.H).toLocaleString('en-AU') +
        ' hours to solve, more than the ' + CX.MAX_HOURS.toLocaleString('en-AU') + ' this tool takes. ' + fewer });
    else if(P.length * S.H > CX.SLOW_HOURS)
      warnings.push({ id: null, msg: 'That is ' + (P.length * S.H).toLocaleString('en-AU') + ' hours to solve, which can take a minute. ' + fewer.replace(/^Take/, 'It is quicker with') });
    // Profiles: Custom with no file runs on its fallback; a file without a season of this climate averages its others.
    var Cl = CX.CLIMATES[o.climate], L = model.load;
    var checkProfile = function(p, id, who, fallback){
      if(p.base === 'custom' && !p.ts) warnings.push({ id: id, msg: who + ' is Custom with no file opened yet, so it runs as ' + fallback + '.' });
      var miss = CX.isCustom(p) ? CX.tsMissing(p.ts, Cl.seasons) : [];
      if(miss.length) warnings.push({ id: id, msg: who + '’s file has no ' + list(miss) + ', so ' + (miss.length > 1 ? 'they take' : 'it takes') + ' the average of its ' + list(Object.keys(p.ts.s)) + '.' });
    };
    if(L) checkProfile(L, null, 'The load profile', 'the System day');
    var supply = false;
    model.tech.forEach(function(e){
      var n = CX.nameOf(e);
      var existsAtStart = e.exist > 0 && (!e.retire || e.retire > o.start);
      var canBuild = e.build && (!e.from || e.from <= last);
      if(existsAtStart || canBuild) supply = supply || e.kind !== 'store';
      if(!existsAtStart && !canBuild){
        if(e.exist > 0 && e.retire && e.retire <= o.start) warnings.push({ id: e.id, msg: n + ' retires by ' + e.retire + ', before the first year, and cannot be built, so it is left out.' });
        else if(e.build && e.from > last) warnings.push({ id: e.id, msg: n + ' cannot be built until ' + e.from + ', after the last decision year (' + last + '), so it is left out.' });
        else warnings.push({ id: e.id, msg: n + ' has nothing in service and cannot be built, so it is left out.' });
      } else if(e.exist > 0 && e.retire && e.retire <= o.start)
        warnings.push({ id: e.id, msg: n + '’s existing ' + fmtNum(e.exist) + ' MW retires by ' + e.retire + ', before the first year, so only new builds count.' });
      /* A decision year stands for every year up to the next, and a plant counts in
         one when it is in service at its start (PyPSA's rule), so a retirement or a
         life that ends partway through a step runs, and is paid for, to its end. */
      if(existsAtStart && e.retire && e.retire <= o.end){
        var pr = null;
        P.forEach(function(p){ if(p.year < e.retire) pr = p; });
        if(pr && pr.year + pr.years > e.retire)
          warnings.push({ id: e.id, msg: n + ' retires in ' + e.retire + ', partway through decision year ' + pr.year + ' (' + pr.year + ' to ' + (pr.year + pr.years - 1) + '), so the plan keeps it, and its fixed O&M, to ' + (pr.year + pr.years - 1) + '.' });
      }
      if(canBuild){
        var first = P.filter(function(p){ return !e.from || p.year >= e.from; })[0], serve = 0;
        P.forEach(function(p){ if(CX.active(first.year, e.life, p.year)) serve += p.years; });
        if(Math.abs(serve - Math.min(e.life, o.end + 1 - first.year)) > 1e-9)
          warnings.push({ id: e.id, msg: n + '’s ' + fmtNum(e.life) + '-year life ends partway through a decision step, and a plant counts for the whole of each decision year it is in service at, so one built in ' + first.year + ' serves, and pays its annuity, for ' + serve + ' years.' });
      }
      if((e.kind === 'pv' || e.kind === 'wind') && (existsAtStart || canBuild)){
        checkProfile(e.prof, e.id, n + '’s profile', 'the climate’s ' + (e.kind === 'pv' ? 'sun' : 'wind'));
        var av = CX.avail(e, S);
        if(!av.reach) warnings.push({ id: e.id, msg: n + ': the ' + (e.kind === 'pv' ? 'sun' : 'wind') + ' shape gives at most ' + Math.round(av.cf * 1000) / 10 + '% capacity factor, so it runs at that, not ' + Math.round(e.cf * 1000) / 10 + '%.' });
      }
      if(e.build && e.max > 0 && e.exist >= e.max && existsAtStart) warnings.push({ id: e.id, msg: n + ' already has its most in service (' + fmtNum(e.max) + ' MW), so none is built until some retires.' });
    });
    if(model.tech.length && !supply && !o.shed) errors.push({ id: null, msg: 'Nothing generates: add a technology that is in service or can be built, or allow load shedding.' });
    else if(model.tech.length && !supply) warnings.push({ id: null, msg: 'Nothing generates, so all of the demand is shed.' });
    if(o.netZero){
      var clean = model.tech.some(function(e){ return e.kind !== 'store' && !(e.kind === 'firm' && e.co2 > 0) && (e.build || e.exist > 0); });
      if(o.nzYear > last) warnings.push({ id: null, msg: 'Net zero from ' + o.nzYear + ' is after the last decision year (' + last + '), so it changes nothing.' });
      else if(!clean) warnings.push({ id: null, msg: 'Net zero from ' + o.nzYear + ', but no technology is free of CO2, so ' + (o.shed ? 'demand is shed from then on.' : 'the problem cannot be solved.') });
    }
    return { errors: errors, warnings: warnings };
  };
  function fmtNum(x){ return (Math.round(x * 10) / 10).toLocaleString('en-AU'); }
  // "a, b and c".
  function list(parts){ return parts.length < 2 ? parts.join('') : parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1]; }
  CX.list = list;
  // Who a sampling is set by: the load, or a farm by its name.
  function whoName(model){
    return function(id){
      if(id === null) return 'the load';
      var e = model.tech.filter(function(x){ return x.id === id; })[0];
      return e ? CX.nameOf(e) : 'a farm';
    };
  }
  CX.whoName = whoName;

  /* ── The optimisation ── */
  function tile(a, K){ var o = new Array(a.length * K); for(var k = 0; k < K; k++) for(var t = 0; t < a.length; t++) o[k * a.length + t] = a[t]; return o; }
  function col(df, name, n){
    if(!df || !df.columns || !df.columns.has || !df.columns.has(name)) return null;
    var c = df.col(name), out = new Array(n);
    for(var i = 0; i < n; i++){ var v = c[i]; out[i] = typeof v === 'number' ? v : NaN; }
    return out;
  }
  function zeros(n){ var a = new Array(n); for(var i = 0; i < n; i++) a[i] = 0; return a; }
  function staticOf(df, attr, name){ var i = df.index.getLoc(name); return i < 0 ? NaN : df.col(attr)[i]; }
  CX.techName = function(e){ return 't' + e.id; };
  // Whether an asset built in by with life years is in service in year y (PyPSA's activity rule).
  CX.active = function(by, life, y){ return by <= y && y < by + life; };

  /* The assets of a plan: each technology's existing capacity (one asset,
     from the first year to its retirement) and one candidate per decision
     year it can be built in. Pure, so the audit can replay it. */
  CX.assets = function(model, o){
    var P = CX.periods(o), r = o.rate / 100, out = [];
    model.tech.forEach(function(e){
      if(e.exist > 0 && (!e.retire || e.retire > o.start))
        out.push({ tech: e, name: 'x' + e.id, existing: true, by: o.start, life: e.retire ? e.retire - o.start : Infinity, capex: 0, cc: 0 });
      if(!e.build) return;
      P.forEach(function(p){
        if(e.from && p.year < e.from) return;
        var capex = e.capex * Math.pow(1 + e.learn, p.year - o.start);
        out.push({ tech: e, name: 'n' + e.id + '-' + p.year, existing: false, by: p.year, life: e.life, capex: capex,
                   // per MW a year: the annuity of the overnight cost, and fixed O&M
                   cc: capex * 1000 * CX.annuity(r, e.life) + e.fom * 1000 });
      });
    });
    return out;
  };
  // The carbon price in each decision year, rising from the first.
  CX.carbonAt = function(o, y){ return o.carbon * Math.pow(1 + o.carbonGrow / 100, y - o.start); };
  // Running cost per MWh in year y: fuel and variable O&M, and carbon.
  CX.runCost = function(e, o, y){ return e.vom + (e.kind === 'firm' ? e.co2 * CX.carbonAt(o, y) : 0); };
  CX.peakAt = function(o, y){ return o.peak * Math.pow(1 + o.growth / 100, y - o.start); };

  function runOpt(n, extra){
    // Through the accessor's own method, so the options are read the same from any realm.
    var acc = n.optimize && n.optimize._accessor;
    return acc ? acc.optimize(extra) : n.optimize(extra);
  }
  var CONDITION = {
    infeasible: 'The plan is infeasible: nothing that can be built meets the demand in every hour. Check the Checks list, or allow load shedding.',
    infeasible_or_unbounded: 'The plan is infeasible: nothing that can be built meets the demand in every hour. Check the Checks list, or allow load shedding.',
    unbounded: 'The plan is unbounded: some cost can fall without end.',
    time_limit: 'The solver ran out of time before it proved the best plan. Allow more time, a larger gap, fewer decision years or less daily variability.',
    iteration_limit: 'The solver stopped at its iteration limit. Take fewer decision years or less daily variability.'
  };

  /* Solve a plan with a PSA.js module ({Network, logger}). Returns plain
     numbers: each technology's capacity, builds, output and costs in each
     decision year, the hours of each typical day, the run report, and raw
     (everything, in a fixed order, for the engine build's bundle check). */
  CX.solve = async function(psa, model, options){
    var o = CX.options(options), t0 = Date.now();
    var P = CX.periods(o), K = P.length, years = P.map(function(p){ return p.year; });
    var S = CX.sample(model, o), H = S.H, N = K * H;
    var report = { ok: false, opts: o, K: K, H: H, warnings: [], error: '', status: '', condition: '', milp: false };
    var oldHandler = psa.logger.handler;
    psa.logger.handler = function(level, msg){ if(level >= 30) report.warnings.push(String(msg)); };
    try {
      var n = new psa.Network();
      var techs = model.tech;
      n.add('Carrier', ['AC', 'shed']);
      techs.forEach(function(e){ n.add('Carrier', CX.techName(e), { co2_emissions: e.kind === 'firm' ? e.co2 : 0 }); });
      var sns = [];
      for(var t = 0; t < H; t++) sns.push(t);
      n.set_snapshots(sns);
      n.set_investment_periods(years);
      // Every sampled hour stands for w hours of the year in the costs, and for one hour in storage.
      var wAll = tile(S.w, K), sw = n.snapshot_weightings;
      sw.set('objective', Float64Array.from(wAll));
      sw.set('generators', Float64Array.from(wAll));
      sw.set('stores', new Float64Array(N).fill(1));
      var disc = CX.discount(o, P), ipw = n.investment_period_weightings;
      ipw.set('years', Float64Array.from(P.map(function(p){ return p.years; })));
      ipw.set('objective', Float64Array.from(disc));
      n.add('Bus', 'b', { carrier: 'AC' });
      var loadAll = new Array(N), peakK = years.map(function(y){ return CX.peakAt(o, y); });
      for(var k = 0; k < K; k++) for(t = 0; t < H; t++) loadAll[k * H + t] = peakK[k] * S.load[t];
      n.add('Load', 'load', { bus: 'b', p_set: loadAll });
      var A = {}, assets = CX.assets(model, o);
      techs.forEach(function(e){ A[e.id] = CX.avail(e, S).a; });
      var mcOf = {};
      techs.forEach(function(e){
        var mc = new Array(N);
        for(var k2 = 0; k2 < K; k2++){ var c = CX.runCost(e, o, years[k2]); for(var t2 = 0; t2 < H; t2++) mc[k2 * H + t2] = c; }
        mcOf[e.id] = mc;
      });
      assets.forEach(function(a){
        var e = a.tech, kw = { bus: 'b', carrier: CX.techName(e), build_year: a.by, lifetime: a.life };
        if(a.existing) kw.p_nom = e.exist;
        else { kw.p_nom_extendable = true; kw.capital_cost = a.cc; if(e.unit > 0) kw.p_nom_mod = e.unit; }
        if(e.unit > 0 && !a.existing) report.milp = true;
        if(e.kind === 'store'){
          var ef = Math.sqrt(e.rte);
          kw.max_hours = e.hours; kw.efficiency_store = ef; kw.efficiency_dispatch = ef;
          kw.cyclic_state_of_charge = true; kw.cyclic_state_of_charge_per_period = true;
          if(e.vom > 0) kw.marginal_cost = mcOf[e.id];
          n.add('StorageUnit', a.name, kw);
        } else {
          kw.marginal_cost = mcOf[e.id];
          if(e.kind === 'firm') kw.p_max_pu = e.avail;
          else kw.p_max_pu = tile(A[e.id], K);
          n.add('Generator', a.name, kw);
        }
      });
      // Most in service at once: the new builds of each year are held to what the limit leaves.
      techs.forEach(function(e){
        if(!(e.max > 0) || !e.build) return;
        P.forEach(function(p){
          var ex = e.exist > 0 && CX.active(o.start, e.retire ? e.retire - o.start : Infinity, p.year) ? e.exist : 0;
          if(!assets.some(function(a){ return a.tech === e && !a.existing && CX.active(a.by, a.life, p.year); })) return;
          n.add('GlobalConstraint', 'lim' + e.id + '-' + p.year, { type: 'tech_capacity_expansion_limit', carrier_attribute: CX.techName(e),
            sense: '<=', constant: Math.max(0, e.max - ex), investment_period: p.year });
        });
      });
      if(o.netZero && techs.some(function(e){ return e.kind === 'firm' && e.co2 > 0; })){
        P.forEach(function(p){
          if(p.year < o.nzYear) return;
          n.add('GlobalConstraint', 'nz' + p.year, { type: 'primary_energy', carrier_attribute: 'co2_emissions', sense: '<=', constant: 0, investment_period: p.year });
        });
      }
      var shedMax = 0;
      for(var i = 0; i < N; i++) if(loadAll[i] > shedMax) shedMax = loadAll[i];
      if(o.shed && shedMax > 0) n.add('Generator', 'shed', { bus: 'b', carrier: 'shed', p_nom: shedMax, marginal_cost: o.voll });

      var ret = await runOpt(n, { multi_investment_periods: true, include_objective_constant: false,
                                  solver_options: { time_limit: o.time, mip_rel_gap: o.gap } });
      report.status = String(ret[0]); report.condition = String(ret[1]);
      if(report.status !== 'ok'){
        report.error = CONDITION[report.condition] || 'The solver stopped without a solution (' + report.condition + ').';
        report.ms = Date.now() - t0;
        return { report: report, raw: ['error', report.condition] };
      }
      return read(n, model, o, P, S, assets, A, disc, peakK, loadAll, report, t0);
    } catch(err){
      report.error = 'The optimisation stopped: ' + String(err && err.message || err);
      report.ms = Date.now() - t0;
      return { report: report, raw: ['error', String(err && err.message)] };
    } finally {
      psa.logger.handler = oldHandler;
    }
  };

  /* The solved network, as plain numbers per technology and decision year.
     Energy and costs are a year's: each sampled hour times the hours it
     stands for. Money is in the reader's currency at the first year's prices. */
  function read(n, model, o, P, S, assets, A, disc, peakK, loadAll, report, t0){
    var K = P.length, H = S.H, N = K * H, years = P.map(function(p){ return p.year; });
    var gt = n.generators_t, ut = n.storage_units_t;
    var gp = function(name){ return col(gt.p, name, N) || zeros(N); };
    var up = function(name){ return col(ut.p, name, N) || zeros(N); };
    var upIn = function(name){ return col(ut.p_store, name, N) || zeros(N); };
    var upOut = function(name){ return col(ut.p_dispatch, name, N) || zeros(N); };
    var usoc = function(name){ return col(ut.state_of_charge, name, N) || zeros(N); };
    var sum = function(a, k, f){ var s = 0; for(var t = 0; t < H; t++){ var v = a[k * H + t]; s += S.w[t] * (f ? f(v) : v); } return s; };
    var pos = function(v){ return v > 0 ? v : 0; }, neg = function(v){ return v < 0 ? -v : 0; };
    var res = { periods: years, years: P.map(function(p){ return p.years; }), disc: disc, H: H, w: S.w.slice(), blocks: S.blocks,
                sample: S.sample, peakSeason: S.peakSeason, tech: {}, order: [], load: [], shed: [], totals: {} };
    var shedP = o.shed && n.generators.index.has('shed') ? gp('shed') : zeros(N);
    for(var k = 0; k < K; k++){
      res.load.push(loadAll.slice(k * H, (k + 1) * H));
      res.shed.push(shedP.slice(k * H, (k + 1) * H).map(pos));
    }
    var T = { capex: zeros(K), fom: zeros(K), vom: zeros(K), co2cost: zeros(K), shedCost: zeros(K), cost: zeros(K),
              energy: zeros(K), shedEnergy: zeros(K), served: zeros(K), emis: zeros(K), gen: zeros(K), cleanGen: zeros(K),
              curtail: zeros(K), peak: peakK.slice(), firm: zeros(K), objFom: zeros(K) };
    model.tech.forEach(function(e){
      var mine = assets.filter(function(a){ return a.tech === e; });
      var d = { id: e.id, cap: zeros(K), exist: zeros(K), built: zeros(K), retired: zeros(K), gen: zeros(K), charge: zeros(K),
                curtail: zeros(K), cf: zeros(K), emis: zeros(K), capex: zeros(K), fom: zeros(K), vom: zeros(K), co2cost: zeros(K),
                p: [], soc: [], pin: [], pout: [], avail: A[e.id] ? A[e.id].slice() : null, energyCap: zeros(K), vint: [] };
      var isStore = e.kind === 'store';
      var cls = isStore ? n.storage_units : n.generators;
      var net = zeros(N), socAll = zeros(N), inAll = zeros(N), outAll = zeros(N);
      mine.forEach(function(a){
        var pn = a.existing ? e.exist : staticOf(cls, 'p_nom_opt', a.name);
        if(!isFinite(pn) || pn < 1e-6) pn = 0;
        // A mixed-integer run's unit counts come back a hair off whole.
        if(!a.existing && e.unit > 0) pn = Math.round(pn / e.unit) * e.unit;
        a.pnom = pn;
        if(!a.existing) d.vint.push({ year: a.by, mw: pn, capex: a.capex });
        var pa = isStore ? up(a.name) : gp(a.name), sa = isStore ? usoc(a.name) : null;
        var ia = isStore ? upIn(a.name) : null, oa = isStore ? upOut(a.name) : null;
        for(var k2 = 0; k2 < K; k2++){
          if(!CX.active(a.by, a.life, years[k2])) continue;
          d.cap[k2] += pn;
          if(a.existing) d.exist[k2] += pn;
          for(var t = 0; t < H; t++){
            var i = k2 * H + t;
            net[i] += pa[i];
            if(sa){ socAll[i] += sa[i]; inAll[i] += ia[i]; outAll[i] += oa[i]; }
          }
          if(!a.existing){ d.capex[k2] += pn * (a.cc - e.fom * 1000); }
        }
        if(!a.existing) for(var k3 = 0; k3 < K; k3++) if(years[k3] === a.by) d.built[k3] += pn;
        for(var k4 = 1; k4 < K; k4++) if(CX.active(a.by, a.life, years[k4 - 1]) && !CX.active(a.by, a.life, years[k4])) d.retired[k4] += pn;
      });
      for(var k5 = 0; k5 < K; k5++){
        var pk = net.slice(k5 * H, (k5 + 1) * H);
        d.p.push(pk);
        if(isStore){
          d.soc.push(socAll.slice(k5 * H, (k5 + 1) * H));
          d.pin.push(inAll.slice(k5 * H, (k5 + 1) * H));
          d.pout.push(outAll.slice(k5 * H, (k5 + 1) * H));
        }
        // Storage gives back what it discharges and takes what it charges; a plant what it generates.
        d.gen[k5] = isStore ? sum(outAll, k5) : sum(net, k5, pos);
        d.charge[k5] = isStore ? sum(inAll, k5) : sum(net, k5, neg);
        d.fom[k5] = d.cap[k5] * e.fom * 1000;
        d.vom[k5] = d.gen[k5] * e.vom;
        d.co2cost[k5] = e.kind === 'firm' ? d.gen[k5] * e.co2 * CX.carbonAt(o, years[k5]) : 0;
        d.emis[k5] = e.kind === 'firm' ? d.gen[k5] * e.co2 : 0;
        if(isStore) d.energyCap[k5] = d.cap[k5] * e.hours;
        if(e.kind === 'pv' || e.kind === 'wind'){
          var cu = 0;
          for(var t3 = 0; t3 < H; t3++) cu += S.w[t3] * Math.max(0, A[e.id][t3] * d.cap[k5] - pk[t3]);
          d.curtail[k5] = cu;
        }
        d.cf[k5] = d.cap[k5] > 1e-9 ? d.gen[k5] / (d.cap[k5] * 8760) : NaN;
        T.capex[k5] += d.capex[k5]; T.fom[k5] += d.fom[k5]; T.vom[k5] += d.vom[k5]; T.co2cost[k5] += d.co2cost[k5];
        T.emis[k5] += d.emis[k5]; T.curtail[k5] += d.curtail[k5];
        if(!isStore){ T.gen[k5] += d.gen[k5]; if(!(e.kind === 'firm' && e.co2 > 0)) T.cleanGen[k5] += d.gen[k5]; }
        // The fixed O&M of new builds is in the optimiser's objective, an existing plant's is not.
        T.objFom[k5] += (d.cap[k5] - d.exist[k5]) * e.fom * 1000;
        if(e.kind === 'firm' || isStore) T.firm[k5] += d.cap[k5] * (e.kind === 'firm' ? e.avail : 1);
      }
      res.tech[e.id] = d;
      res.order.push(e.id);
    });
    var npv = 0, pvEnergy = 0, objective = 0;
    for(var k6 = 0; k6 < K; k6++){
      T.energy[k6] = sum(loadAll, k6);
      T.shedEnergy[k6] = sum(shedP, k6, pos);
      T.served[k6] = T.energy[k6] - T.shedEnergy[k6];
      T.shedCost[k6] = T.shedEnergy[k6] * o.voll;
      T.cost[k6] = T.capex[k6] + T.fom[k6] + T.vom[k6] + T.co2cost[k6] + T.shedCost[k6];
      npv += disc[k6] * T.cost[k6];
      pvEnergy += disc[k6] * T.served[k6];
      objective += disc[k6] * (T.capex[k6] + T.objFom[k6] + T.vom[k6] + T.co2cost[k6] + T.shedCost[k6]);
    }
    T.npv = npv;
    T.pvEnergy = pvEnergy;
    T.avgCost = pvEnergy > 0 ? npv / pvEnergy : NaN;
    T.objective = n.objective;
    T.replayObjective = objective;
    T.built = model.tech.reduce(function(s, e){ return s + res.tech[e.id].built.reduce(function(a, b){ return a + b; }, 0); }, 0);
    res.totals = T;
    report.ok = true;
    report.ms = Date.now() - t0;
    res.report = report;
    res.raw = [report.status, report.condition, r6(n.objective), assets.map(function(a){ return [a.name, r6(a.pnom)]; })];
    return res;
  }

  /* ── Formatting ── */
  function fixed(x, d){ return (Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); }
  function group(s){ return s.replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function signed(x, s){ return (x < 0 ? '−' : '') + s; }
  CX.fmt = {
    // MW: whole above 100, one place below.
    mw: function(x){
      if(!isFinite(x)) return '–';
      var a = Math.abs(x);
      if(a < 0.05) return '0';
      return signed(x, a >= 100 ? group(fixed(a, 0)) : fixed(a, 1));
    },
    // An energy in MWh, shown as GWh: 1,234.5 GWh.
    gwh: function(x){
      if(!isFinite(x)) return '–';
      var a = Math.abs(x) / 1000;
      if(a < 0.005) return '0';
      return signed(x, a >= 100 ? group(fixed(a, 0)) : a >= 10 ? fixed(a, 1) : fixed(a, 2));
    },
    pct: function(x){ return isFinite(x) ? (Math.abs(x) >= 10 ? fixed(x, 0) : fixed(x, 1)) : '–'; },
    // A rate in %, to the hundredth it needs: 7.0, 6.99, 10.2.
    rate: function(x){ return isFinite(x) ? (Math.abs(x * 10 - Math.round(x * 10)) < 1e-6 ? fixed(x, 1) : fixed(x, 2)) : '–'; },
    // Money, whole units with the symbol.
    money: function(x, cur){
      if(!isFinite(x)) return '–';
      var a = Math.round(Math.abs(x));
      return (x < 0 && a ? '−' : '') + (cur || '') + group(String(a));
    },
    // Money, short: $1.23 bn, $45.6 m, $12,300.
    big: function(x, cur){
      if(!isFinite(x)) return '–';
      var a = Math.abs(x), s;
      if(a >= 1e9) s = fixed(a / 1e9, a >= 1e11 ? 0 : a >= 1e10 ? 1 : 2) + ' bn';
      else if(a >= 1e6) s = fixed(a / 1e6, a >= 1e8 ? 0 : a >= 1e7 ? 1 : 2) + ' m';
      else s = group(String(Math.round(a)));
      return (x < 0 && a >= 0.5 ? '−' : '') + (cur || '') + s;
    },
    price: function(x, cur){
      if(!isFinite(x)) return '–';
      if(Math.abs(x) < 0.005) x = 0;
      var s = fixed(Math.abs(x), 2).split('.');
      return (x < 0 ? '−' : '') + (cur || '') + group(s[0]) + '.' + s[1];
    },
    // Tonnes of CO2, as Mt or kt.
    co2: function(t){
      if(!isFinite(t)) return '–';
      var a = Math.abs(t);
      if(a >= 1e6) return fixed(a / 1e6, a >= 1e8 ? 0 : 2) + ' Mt';
      if(a >= 1e3) return fixed(a / 1e3, a >= 1e5 ? 0 : 1) + ' kt';
      return fixed(a, 0) + ' t';
    }
  };
  CX.esc = function(s){ return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  CX.hash = function(s){
    var h = 0x811c9dc5;
    for(var i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  };

  /* ── Quick Start plans (keys are frozen; contents may be improved) ──
     Each is the plan's form fields and its technologies and load profile, in
     the saved form, read through CX.load like any saved plan. A field a
     preset leaves out takes its default. */
  function T(id, key, extra){
    var t = { id: id }, nw = CX.NEW[key];
    for(var k in nw) t[k] = nw[k];
    for(var k2 in extra) t[k2] = extra[k2];
    return t;
  }
  CX.PRESETS = {
    // A summer-peaking grid of 1 GW growing 3% a year, its coal closing in 2036.
    grow: { fields: {},
      plan: { v: 2, tech: [
        T(1, 'coal', { name: 'Coal', exist: 700, retire: 2036, build: 0 }),
        T(2, 'ccgt', { exist: 300 }),
        T(3, 'ocgt'),
        T(4, 'solar'),
        T(5, 'wind', { max: 1500 }),
        T(6, 'battery')
      ] } },
    // The same grid with a rising carbon price and no CO2 from 2041.
    nz: { fields: { carbon: 40, carbonGrow: 5, netZero: true, nzYear: 2041 },
      plan: { v: 2, tech: [
        T(1, 'coal', { name: 'Coal', exist: 700, retire: 2036, build: 0 }),
        T(2, 'ccgt', { exist: 300 }),
        T(3, 'ocgt'),
        T(4, 'solar'),
        T(5, 'wind', { max: 1500 }),
        T(6, 'battery'),
        T(7, 'phes', { from: 2031 })
      ] } },
    // A winter-peaking grid of 4 GW, flat demand, closing two coal stations.
    coal: { fields: { peak: 4000, growth: 1, climate: 'win', start: 2026, end: 2045, carbon: 25 },
      plan: { v: 2, tech: [
        T(1, 'coal', { name: 'Coal, older station', exist: 2000, retire: 2031, build: 0 }),
        T(2, 'coal', { name: 'Coal, newer station', exist: 1500, retire: 2041, build: 0 }),
        T(3, 'ccgt', { exist: 800, unit: 400 }),
        T(4, 'ocgt', { exist: 400 }),
        T(5, 'wind', { exist: 600, max: 4000 }),
        T(6, 'solar', { cf: 0.16 }),
        T(7, 'battery')
      ] } },
    // A tropical island grid on diesel, growing fast, with sun and geothermal to build.
    island: { fields: { peak: 120, growth: 6, climate: 'trop', start: 2026, end: 2045 },
      plan: { v: 2, load: { base: 'res' }, tech: [
        T(1, 'diesel', { exist: 150 }),
        T(2, 'solar', { cf: 0.18 }),
        T(3, 'battery'),
        T(4, 'geo', { max: 60, unit: 20, from: 2031 })
      ] } }
  };
  CX.PRESET_DEFAULT = 'grow';
})(typeof globalThis !== 'undefined' ? globalThis : this);
