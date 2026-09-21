/* Financial Freedom Calculator. How much is enough, and when do you get there.
   ---------------------------------------------------------------------------
   Everything below runs in REAL terms (today's money) on MONTHLY steps, and is
   sampled yearly for the charts and the table. The audit harness in _audit/
   replays this documented maths in a deliberately different formulation, so
   read it as the specification, not as a summary.

   Step 1  Normalise the inputs.
     Expenses and savings arrive weekly, monthly or yearly and are converted to
     a monthly figure (weekly x 52/12, yearly / 12). Ages are decimal years;
     month counts are round((b - a) * 12).

   Step 2  Strip out inflation, using Fisher rather than subtraction.
     rr   = (1 + r) / (1 + i) - 1        real annual return
     gr   = (1 + g) / (1 + i) - 1        real annual growth of savings/income
     rm   = (1 + rr)^(1/12) - 1          real monthly return
     gm   = (1 + gr)^(1/12) - 1          real monthly growth
     Expenses are constant in real terms by construction, so they never appear
     with an inflation factor again. Nominal figures are only ever produced for
     display, by multiplying a real figure at year y by (1 + i)^y.

   Step 3  Savings depend on WHICH field was entered. These are two different
     models and the panel says which one is running.
       entered Savings:    S(t) = S0 * (1 + gm)^t
       entered Net Income: S(t) = I0 * (1 + gm)^t - X       (may go negative)
     where X is the real monthly expense and t is months from today.

   Step 4  Accumulation, while still working. Return over the month, savings
     added at the end of it:
       W(t+1) = W(t) * (1 + rm) + S(t),      W(0) = current invested assets

   Step 5  Drawdown, once retired. Expenses out and any pension in at the
     START of the month, return over the month:
       W(t+1) = (W(t) - Xr + P(t)) * (1 + rm)
     Xr is the real monthly expense in retirement (today's expense times the
     retirement multiplier). P(t) is the pension, zero before its start age.

   Step 6  The pot required to stop work at age A. Because step 5 is AFFINE in
     the starting pot, one pass gives every constraint exactly. Track the
     post-withdrawal balance as b(t) = a(t) * W + d(t):
       each month:  d -= c(t);  record the constraint a*W + d >= 0;
                    then a *= growth(t);  d *= growth(t)
     with c(t) = Xr - P(t). The pot must satisfy every month's
     "never below zero" constraint plus one terminal condition:
       Just Die        terminal >= 0
       Leave a Legacy  terminal >= legacy
       Die Rich        terminal >= the perpetuity for whatever the net draw is
                       by the horizon (age 120), so the pot could go on for ever
                       from there. NOT "terminal >= the starting pot": with a
                       pension that begins after retirement the pot is meant to
                       fall through the bridge years and then hold for ever,
                       and that comparison would wrongly reject it.
     The answer is the largest of those lower bounds. With a constant monthly
     return this reduces to the textbook annuity-due and perpetuity-due forms,
     which is check 1 of the audit:
       Just Die   W = Xr * (1 - (1+rm)^-n) / rm * (1 + rm),  limit Xr * n at rm = 0
       Legacy     W = that + legacy / (1 + rm)^n
       Die Rich   W = Xr * (1 + rm) / rm,  needs rm > 0

   Step 7  The earliest financial freedom age. Two curves over age: what you
     will have accumulated, and the pot step 6 requires if you stopped at that
     age. Accumulated is non-decreasing, required is non-increasing, so they
     cross at most once. The first month where accumulated >= required is the
     answer. The search excludes the final month only: at the death age itself
     there is nothing left to fund, so every plan would qualify. No crossing
     before then means the plan is not achievable.

   Step 8  Monte Carlo. The same recurrences with a random monthly growth
     factor instead of (1 + rm):
       growth = exp(ln(1 + rr)/12 + sigma * sqrt(1/12) * z),   z ~ N(0,1)
     The drift is ln(1 + rr) because the return input is a COMPOUND (CAGR)
     figure, so with no cash flows the median path is the deterministic line
     and sigma = 0 collapses to it exactly. Once withdrawals start, path
     dependence pulls the median below the deterministic line: that gap is
     volatility drag, and it is what the success probability measures.
     Normals come from Box-Muller, seeded per path, so a run is reproducible
     and every pot is scored against the SAME set of paths.

   Step 9  The confidence pot. Because step 5 is affine in W, each simulated
     path has an exact minimum starting pot that survives it. Collect one per
     path, sort, and read off the percentile. The 90% confidence pot is the
     90th percentile. No search is needed, and success probability at any pot
     is just the share of paths whose requirement is at or below it.

   Step 10  The crash stress test. Sequence-of-returns risk at its worst: the
     asset's maximum drawdown lands the month retirement starts, then the pot
     compounds at the expected return again with no bonus recovery.

   Not modelled, deliberately: tax, fees beyond whatever the return input is
   already net of, lumpy one-off spending, and any change in the expense level
   other than the retirement multiplier.
*/
(function(){
'use strict';

/* ─── CONSTANTS ─── */

// Display only. No conversion is performed, so the figures mean whatever
// currency the user entered them in.
var CURRENCIES = {
  AUD: {locale:'en-AU', label:'AUD - Australian Dollar'},
  USD: {locale:'en-US', label:'USD - US Dollar'},
  IDR: {locale:'id-ID', label:'IDR - Indonesian Rupiah'},
  SGD: {locale:'en-SG', label:'SGD - Singapore Dollar'},
  GBP: {locale:'en-GB', label:'GBP - British Pound'},
  EUR: {locale:'de-DE', label:'EUR - Euro'}
};

/* Long-run NOMINAL figures, before tax and before fees. They are starting
   points, not forecasts, and every field stays editable after a preset is
   picked. Sources and the window each figure is drawn from, as at 2026-09:
     cash      policy-rate-linked savings. The 4% is a current rate, NOT a
               long-run constant: cash has historically earned roughly 0.5-1%
               above inflation, so a fixed 4% forever is on the generous side.
     bonds     long-run developed-market government bond total returns. The
               -20% drawdown is the 2021-2023 global bond bear market.
     us        S&P 500 total return, 1928 onward. -55% is 2007-2009.
     asx       Australian equity total return, long run. -50% is 2007-2009.
     world     developed plus emerging blend, long run. -54% is 2007-2009.
     gold      USD gold, 1971 onward. Highly start-date dependent: 1971 is a
               regime break, and the -62% drawdown ran from 1980 to 1999. */
var PRESET_ASSETS = {
  custom: {label:'Custom (enter your own)',        ret:8.0,  std:15.0, mdd:-50},
  cash:   {label:'Cash / high-yield savings',      ret:4.0,  std:1.0,  mdd:0},
  bonds:  {label:'Fixed income (government bonds)',ret:5.0,  std:6.0,  mdd:-20},
  us:     {label:'Equity - United States',         ret:10.0, std:15.5, mdd:-55},
  asx:    {label:'Equity - Australia (ASX)',       ret:9.5,  std:16.0, mdd:-50},
  world:  {label:'Equity - global diversified',    ret:8.5,  std:15.0, mdd:-54},
  gold:   {label:'Gold',                           ret:7.5,  std:17.0, mdd:-62}
};
var PRESETS_AS_AT = '2026-09';

// "Indefinitely" has to stop somewhere to be computable. Die Rich is tested to
// age 120: at the perpetuity pot the real balance is flat, so the horizon only
// has to be long enough to expose a declining one.
var RICH_HORIZON_AGE = 120;
var TICKER_HISTORY_START = '1990-01-01';

var UI_DEFAULTS = {
  currency: 'AUD',
  ageNow: 30, ageRetire: 60, ageDie: 90,
  expense: 60000, expensePeriod: 'yearly',
  savingsMode: 'savings', savings: 30000, savingsPeriod: 'yearly',
  growth: 3, inflation: 2.5,
  assetPreset: 'custom', ret: 8, std: 15, mdd: -50, ticker: '',
  assets: 100000,
  mode: 'die', legacy: 500000, retireMultiplier: 100,
  pensionOn: false, pensionStartAge: 67, pensionAmount: 29000,
  showNominal: false, paths: 1000, seed: 20260921,
  confidence: 90, showStress: true
};

var UI = Object.assign({}, UI_DEFAULTS);

/* ─── HELPERS ─── */
var $ = function(id){ return document.getElementById(id); };
function cssVar(n){ return getComputedStyle(document.body).getPropertyValue(n).trim(); }
function clamp(v, lo, hi){ return v < lo ? lo : (v > hi ? hi : v); }
function num(v, fallback){ var n = Number(v); return isFinite(n) ? n : fallback; }
function months(a, b){ return Math.round((b - a) * 12); }
function perMonth(amount, period){
  if(period === 'weekly') return amount * 52 / 12;
  if(period === 'yearly') return amount / 12;
  return amount;
}
// An (i) marker carrying detail that would otherwise be a paragraph on the
// page. `?` is for tips about a field, `i` is for background. The shared
// tooltip renders markup, so only the attribute delimiter is escaped.
function info(html){
  return ' <span class="tip-wrap"><i class="tip-icon" data-tip="' +
    String(html).replace(/"/g, '&quot;') + '">i</i></span>';
}
function escapeHtml(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

/* Display formatting. The currency is a display choice, so the symbol and the
   locale are both read from the current selection rather than hardcoded. */
var fmt = {
  code: 'AUD',
  locale: 'en-AU',
  symbol: '$',
  setCurrency: function(code){
    var c = CURRENCIES[code] || CURRENCIES.AUD;
    fmt.code = CURRENCIES[code] ? code : 'AUD';
    fmt.locale = c.locale;
    try {
      var parts = new Intl.NumberFormat(c.locale, {style:'currency', currency:fmt.code})
        .formatToParts(0);
      for(var i = 0; i < parts.length; i++){
        if(parts[i].type === 'currency'){ fmt.symbol = parts[i].value; break; }
      }
    } catch(_e){ fmt.symbol = '$'; }
  },
  currency: function(v, compact){
    var n = Number(v || 0);
    if(!isFinite(n)) return '—';
    var abs = Math.abs(n);
    var sign = n < 0 ? '−' : '';
    if(compact && abs >= 1e9) return sign + fmt.symbol + (abs / 1e9).toFixed(2) + 'b';
    if(compact && abs >= 1e6) return sign + fmt.symbol + (abs / 1e6).toFixed(2) + 'm';
    if(compact && abs >= 1e3) return sign + fmt.symbol + (abs / 1e3).toFixed(0) + 'k';
    try {
      return new Intl.NumberFormat(fmt.locale, {
        style:'currency', currency:fmt.code, maximumFractionDigits:0
      }).format(n);
    } catch(_e){ return sign + fmt.symbol + Math.round(abs).toLocaleString('en-AU'); }
  },
  pct: function(v, decimals){
    var n = Number(v || 0);
    if(!isFinite(n)) return '—';
    return n.toFixed(decimals == null ? 2 : decimals) + '%';
  },
  num: function(v, decimals){
    var d = decimals || 0;
    return Number(v || 0).toLocaleString(fmt.locale, {minimumFractionDigits:d, maximumFractionDigits:d});
  },
  age: function(a){
    if(a == null || !isFinite(a)) return '—';
    var whole = Math.floor(a + 1e-9);
    var mo = Math.round((a - whole) * 12);
    if(mo >= 12){ whole += 1; mo = 0; }
    return mo ? (whole + 'y ' + mo + 'm') : (whole + '');
  }
};

/* Seeded randomness, so a run is reproducible and every pot is scored against
   the same set of paths. mulberry32 and an FNV-1a seed derivation, matching the
   DCA simulator so the two tools behave the same way. */
function mulberry32(seed){
  var state = seed >>> 0;
  if(state === 0) state = 0x6d2b79f5;
  return function(){
    state |= 0; state = (state + 0x6D2B79F5) | 0;
    var t = Math.imul(state ^ state >>> 15, 1 | state);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function deriveSeed(base, key){
  var h = (base >>> 0) || 0x811c9dc5;
  for(var i = 0; i < key.length; i++){ h ^= key.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
// Box-Muller. The DCA simulator sums three uniforms, which is bounded at three
// standard deviations; retirement outcomes live in the tail, so this tool pays
// for proper normals.
function normalDraws(rng){
  var spare = null;
  return function(){
    if(spare !== null){ var s = spare; spare = null; return s; }
    var u, v, q;
    do { u = rng() * 2 - 1; v = rng() * 2 - 1; q = u * u + v * v; } while(q === 0 || q >= 1);
    var f = Math.sqrt(-2 * Math.log(q) / q);
    spare = v * f;
    return u * f;
  };
}

/* ─── ENGINE ─── */

// Turn raw UI values into the real, monthly parameter set the engine uses.
function buildParams(ui){
  var i  = ui.inflation / 100;
  var rr = (1 + ui.ret / 100) / (1 + i) - 1;
  var gr = (1 + ui.growth / 100) / (1 + i) - 1;
  var X  = perMonth(ui.expense, ui.expensePeriod);
  var entered = perMonth(ui.savings, ui.savingsPeriod);
  return {
    mode: ui.mode,
    ageNow: ui.ageNow, ageRetire: ui.ageRetire, ageDie: ui.ageDie,
    inflation: i,
    rr: rr,
    rm: Math.pow(1 + rr, 1 / 12) - 1,
    gm: Math.pow(1 + gr, 1 / 12) - 1,
    sigma: Math.max(0, ui.std) / 100,
    mdd: Math.min(0, ui.mdd) / 100,
    X: X,
    Xr: X * (ui.retireMultiplier / 100),
    savingsMode: ui.savingsMode,
    S0: ui.savingsMode === 'savings' ? entered : 0,
    I0: ui.savingsMode === 'income' ? entered : 0,
    A0: ui.assets,
    legacy: ui.legacy,
    pensionOn: !!ui.pensionOn,
    pensionStartAge: ui.pensionStartAge,
    pensionMonthly: ui.pensionOn ? ui.pensionAmount / 12 : 0
  };
}

// Real monthly savings t months from today, while still working (step 3).
function savingsAt(P, t){
  var f = Math.pow(1 + P.gm, t);
  return P.savingsMode === 'income' ? (P.I0 * f - P.X) : (P.S0 * f);
}

// Net real monthly draw during retirement at absolute age `age` (step 5).
function drawAt(P, age){
  var pen = (P.pensionOn && age >= P.pensionStartAge - 1e-9) ? P.pensionMonthly : 0;
  return P.Xr - pen;
}

// Horizon the drawdown is tested over: the death age, or age 120 for Die Rich.
function horizonAge(P){ return P.mode === 'rich' ? Math.max(RICH_HORIZON_AGE, P.ageDie) : P.ageDie; }

/* The pot required to stop work at `ra` (step 6). One affine pass: track the
   post-withdrawal balance as a*W + d, collect every "never below zero" bound,
   then apply the mode's terminal bound. `growth` may be an array of per-month
   factors (a Monte Carlo path); leaving it out uses the expected return.
   Returns Infinity when no finite pot satisfies the mode. */
function requiredPot(P, ra, growth){
  var ha = horizonAge(P);
  var n = months(ra, ha);
  if(n <= 0) return P.mode === 'legacy' ? Math.max(0, P.legacy) : 0;   // nothing to fund
  var a = 1, d = 0, need = 0, t, g, bound;
  for(t = 0; t < n; t++){
    d -= drawAt(P, ra + t / 12);
    if(a > 0){ bound = -d / a; if(bound > need) need = bound; }
    g = growth ? growth[t] : (1 + P.rm);
    a *= g; d *= g;
  }
  // Terminal condition. a is a product of positive growth factors, so a > 0.
  // Die Rich asks for a balance that could go on for ever from the horizon, so
  // its target is the perpetuity for whatever the net draw is by then. When a
  // pension starts after retirement the pot is SUPPOSED to fall through the
  // bridge years, so comparing the horizon balance with the starting pot would
  // reject plans that in fact last for ever.
  var target;
  if(P.mode === 'rich'){
    var net = drawAt(P, ha);
    if(net <= 0) target = 0;
    else if(P.rm <= 0) return Infinity;   // nothing lasts for ever below inflation
    else target = net * (1 + P.rm) / P.rm;
  } else {
    target = P.mode === 'legacy' ? Math.max(0, P.legacy) : 0;
  }
  bound = (target - d) / a;
  if(bound > need) need = bound;
  return need;
}

/* Forward drawdown from a pot, used for the charts, the table and the stress
   test. `opts.growth` is an optional per-month factor array, `opts.shock` an
   instantaneous multiplier applied the month retirement starts. */
function drawdownPath(P, W, ra, ha, opts){
  opts = opts || {};
  var n = Math.max(0, months(ra, ha));
  var path = new Float64Array(n + 1);
  var bal = W;
  if(opts.shock) bal = bal * (1 + opts.shock);
  path[0] = bal;
  var minBal = bal, depletedAt = null, t, g;
  for(t = 0; t < n; t++){
    bal -= drawAt(P, ra + t / 12);
    if(bal < minBal) minBal = bal;
    if(bal < 0 && depletedAt === null) depletedAt = ra + t / 12;
    g = opts.growth ? opts.growth[t] : (1 + P.rm);
    bal *= g;
    path[t + 1] = bal;
  }
  return {path: path, min: minBal, terminal: bal, depletedAt: depletedAt};
}

// Accumulation while working (step 4), month 0 .. n.
function accumulate(P, n, growth){
  var out = new Float64Array(n + 1);
  var W = P.A0, t;
  out[0] = W;
  for(t = 0; t < n; t++){
    W = W * (growth ? growth[t] : (1 + P.rm)) + savingsAt(P, t);
    out[t + 1] = W;
  }
  return out;
}

/* The earliest age the two curves cross (step 7). Returns the age, or null if
   they never cross on or before the death age. */
function solveFreedomAge(P, accumArr){
  var n = months(P.ageNow, P.ageDie);
  var acc = accumArr || accumulate(P, n);
  // Exclude only the final month. At the death age itself there is nothing left
  // to fund, so the required pot is zero and every plan crosses, including one
  // that never saves a cent. That is arithmetic, not freedom. Excluding any
  // more than that discards real crossings: a plan funded from age 89y3m to 90
  // is genuinely funded, however short the run.
  var last = Math.max(0, n - 1);
  for(var t = 0; t <= last; t++){
    var age = P.ageNow + t / 12;
    if(acc[t] >= requiredPot(P, age) - 1e-6) return age;
  }
  return null;
}

/* Per-month real growth factors (step 8). With sigma = 0 this returns exactly
   (1 + rm) every month, so every stochastic result collapses onto the
   deterministic one. */
function growthSeries(P, rng, n){
  var out = new Float64Array(n);
  var drift = Math.log(1 + P.rr) / 12;
  var vol = P.sigma * Math.sqrt(1 / 12);
  if(vol === 0){
    var g = Math.exp(drift);
    for(var k = 0; k < n; k++) out[k] = g;
    return out;
  }
  var z = normalDraws(rng);
  for(var t = 0; t < n; t++) out[t] = Math.exp(drift + vol * z());
  return out;
}

/* Full-lifetime Monte Carlo: accumulate from today, then draw down. Returns
   yearly percentile bands for the chart plus the share of paths that survive.
   Bands are the cross-section at each year, so the p10 line is an envelope of
   bad years, not a single bad path. */
function monteCarlo(P, opts){
  var nPaths = Math.max(1, opts.paths | 0);
  var accMonths = Math.max(0, months(P.ageNow, P.ageRetire));
  var chartYears = Math.max(1, Math.round(months(P.ageNow, P.ageDie) / 12));
  var total = Math.max(1, months(P.ageNow, horizonAge(P)));
  var samples = [], y, p, t;
  for(y = 0; y <= chartYears; y++) samples.push(new Float64Array(nPaths));
  var survived = 0;
  // Same bar requiredPot uses for Die Rich: enough at the horizon to fund the
  // remaining draw for ever at the expected return.
  var richNet = drawAt(P, horizonAge(P));
  var richTarget = richNet <= 0 ? 0 : (P.rm > 0 ? richNet * (1 + P.rm) / P.rm : Infinity);
  for(p = 0; p < nPaths; p++){
    var rng = mulberry32(deriveSeed(opts.seed, 'path' + p));
    var g = growthSeries(P, rng, total);
    var W = P.A0, ok = true;
    samples[0][p] = W;
    for(t = 0; t < total; t++){
      if(t < accMonths){
        W = W * g[t] + savingsAt(P, t);
      } else {
        W -= drawAt(P, P.ageNow + t / 12);
        if(W < 0) ok = false;
        W *= g[t];
      }
      if((t + 1) % 12 === 0){
        var yi = (t + 1) / 12;
        if(yi <= chartYears) samples[yi][p] = W;
      }
    }
    if(P.mode === 'legacy' && W < P.legacy) ok = false;
    if(P.mode === 'rich' && W < richTarget) ok = false;
    if(ok) survived++;
  }
  var bands = {p10: [], p50: [], p90: []};
  for(y = 0; y <= chartYears; y++){
    var col = Array.prototype.slice.call(samples[y]).sort(function(a, b){ return a - b; });
    bands.p10.push(quantile(col, 0.10));
    bands.p50.push(quantile(col, 0.50));
    bands.p90.push(quantile(col, 0.90));
  }
  return {bands: bands, years: chartYears, successRate: survived / nPaths, paths: nPaths};
}

function quantile(sorted, q){
  if(!sorted.length) return 0;
  var idx = clamp(Math.ceil(q * sorted.length) - 1, 0, sorted.length - 1);
  return sorted[idx];
}

/* Step 9. One exact minimum pot per simulated path, because the drawdown is
   affine in the starting pot. Sort once and every confidence level and every
   success probability is a lookup, with no search at all. */
function potRequirements(P, opts){
  var nPaths = Math.max(1, opts.paths | 0);
  var ra = P.ageRetire, n = Math.max(1, months(ra, horizonAge(P)));
  var finite = [], infinite = 0, p;
  for(p = 0; p < nPaths; p++){
    var rng = mulberry32(deriveSeed(opts.seed, 'pot' + p));
    var w = requiredPot(P, ra, growthSeries(P, rng, n));
    if(isFinite(w)) finite.push(w); else infinite++;
  }
  finite.sort(function(a, b){ return a - b; });
  return {
    sorted: finite,
    infinite: infinite,
    paths: nPaths,
    // Share of paths a pot of `W` would have survived.
    successAt: function(W){
      if(!isFinite(W)) return infinite ? 0 : 1;
      var lo = 0, hi = finite.length;
      while(lo < hi){ var mid = (lo + hi) >> 1; if(finite[mid] <= W) lo = mid + 1; else hi = mid; }
      return lo / nPaths;
    },
    // Smallest pot that survives `c` percent of paths.
    atConfidence: function(c){
      var wanted = Math.ceil(c / 100 * nPaths);
      if(wanted > finite.length) return Infinity;
      return finite[clamp(wanted - 1, 0, finite.length - 1)];
    }
  };
}

/* Step 10. The shock is a scalar multiplier the month retirement starts, so
   the pot that survives it is just the ordinary pot grossed back up. */
function stressRequiredPot(P){
  var f = 1 + P.mdd;
  if(f <= 0) return Infinity;
  return requiredPot(P, P.ageRetire) / f;
}

/* Annualised statistics from a fetched price series. Adjusted close from the
   Worker's Yahoo path includes dividends; its Stooq fallback does not, so the
   caller warns when `source` is stooq. */
function tickerStats(dates, prices){
  var px = [], dt = [], i;
  for(i = 0; i < prices.length; i++){
    if(isFinite(prices[i]) && prices[i] > 0){ px.push(prices[i]); dt.push(dates[i]); }
  }
  if(px.length < 30) return null;
  var years = (Date.parse(dt[dt.length - 1]) - Date.parse(dt[0])) / (365.25 * 86400000);
  if(!(years > 0.5)) return null;
  var cagr = Math.pow(px[px.length - 1] / px[0], 1 / years) - 1;
  var sum = 0, lr = [];
  for(i = 1; i < px.length; i++){ var x = Math.log(px[i] / px[i - 1]); lr.push(x); sum += x; }
  var mean = sum / lr.length, ss = 0;
  for(i = 0; i < lr.length; i++){ var dv = lr[i] - mean; ss += dv * dv; }
  var sd = lr.length > 1 ? Math.sqrt(ss / (lr.length - 1)) * Math.sqrt(252) : 0;
  var peak = px[0], mdd = 0;
  for(i = 0; i < px.length; i++){
    if(px[i] > peak) peak = px[i];
    var dr = px[i] / peak - 1;
    if(dr < mdd) mdd = dr;
  }
  return {
    cagr: cagr * 100, std: sd * 100, mdd: mdd * 100,
    years: years, from: dt[0], to: dt[dt.length - 1], points: px.length
  };
}

/* ─── FEASIBILITY ─── */

// Is the plan funded by the target retirement age?
function fundedByRetirement(P){
  var n = months(P.ageNow, P.ageRetire);
  var need = requiredPot(P, P.ageRetire);
  if(!isFinite(need)) return false;
  return accumulate(P, n)[n] >= need - 1e-6;
}

/* Each remedy answers "what one thing would have to change for the plan to be
   funded by the target retirement age, holding everything else fixed". Savings
   is affine so it is solved directly; the other two are bisected. */
function solveRemedies(ui){
  var out = [];
  var base = buildParams(ui);
  var n = months(base.ageNow, base.ageRetire);
  var need = requiredPot(base, base.ageRetire);

  if(isFinite(need) && n > 0){
    var at0 = accumulate(buildParams(Object.assign({}, ui, {savings: 0})), n)[n];
    var at1 = accumulate(buildParams(Object.assign({}, ui, {savings: 1})), n)[n];
    var slope = at1 - at0;
    if(slope > 1e-9){
      var neededEntered = (need - at0) / slope;
      var extraMonthly = perMonth(neededEntered - ui.savings, ui.savingsPeriod);
      if(extraMonthly > 0 && isFinite(extraMonthly)){
        out.push({
          key: 'save',
          label: ui.savingsMode === 'income' ? 'Earn more' : 'Save more',
          text: fmt.currency(extraMonthly) + ' more a month, every month from today'
        });
      }
    }
  }

  // Expense cut. Lower expenses shrink the pot you need, and under the net
  // income model they also raise what you save. Anything under a fifth of
  // today's spending is not advice anyone can act on, so it is not offered:
  // with no savings at all, the bisection would otherwise land on "spend
  // nothing", which is true and useless.
  var MIN_LIVABLE = 0.2;
  var lo = 0, hi = 1, mid, k;
  var canFund = function(mult){
    return fundedByRetirement(buildParams(Object.assign({}, ui, {expense: ui.expense * mult})));
  };
  if(canFund(MIN_LIVABLE)){
    lo = MIN_LIVABLE;
    for(k = 0; k < 40; k++){
      mid = (lo + hi) / 2;
      if(canFund(mid)) lo = mid; else hi = mid;
    }
    // Round DOWN to the figure shown. The bisection lands on the exact point
    // where funding flips, so rounding up would advise a spending level that
    // does not actually work. The dollar figure uses the same rounded share so
    // the two halves of the sentence agree.
    var shown = Math.floor(lo * 100) / 100;
    if(shown < 0.999 && shown > 0){
      out.push({
        key: 'spend',
        label: 'Spend less',
        text: 'cut spending to ' + fmt.pct(shown * 100, 0) + ' of today, about ' +
              fmt.currency(perMonth(ui.expense * shown, ui.expensePeriod)) + ' a month'
      });
    }
  }

  // Minimum return. Not affine, so bisect on the nominal rate.
  var rLo = ui.ret, rHi = 40;
  if(fundedByRetirement(buildParams(Object.assign({}, ui, {ret: rHi})))){
    for(k = 0; k < 40; k++){
      mid = (rLo + rHi) / 2;
      if(fundedByRetirement(buildParams(Object.assign({}, ui, {ret: mid})))) rHi = mid;
      else rLo = mid;
    }
    // Round UP, for the same reason in the other direction.
    var shownRet = Math.ceil(rHi * 10) / 10;
    if(shownRet > ui.ret + 0.01){
      out.push({
        key: 'return',
        label: 'Earn a higher return',
        text: fmt.pct(shownRet, 1) + ' a year instead of ' + fmt.pct(ui.ret, 1) +
              ', which means taking more risk'
      });
    }
  }

  // Retire later. The required pot falls with age, so this often works when
  // nothing else does.
  var later = null;
  var P2 = buildParams(ui);
  var ffAge = solveFreedomAge(P2);
  if(ffAge !== null && ffAge > P2.ageRetire) later = ffAge;
  if(later !== null){
    out.push({
      key: 'later',
      label: 'Retire later',
      text: 'at age ' + fmt.age(later) + ' instead of ' + fmt.age(P2.ageRetire)
    });
  }
  return out;
}

/* One place that decides what the page is allowed to claim. */
function diagnose(ui){
  var P = buildParams(ui);
  if(P.ageRetire <= P.ageNow) return {status:'invalid', message:'Your retirement age has to be later than your age now.'};
  if(P.ageDie <= P.ageRetire) return {status:'invalid', message:'Your life expectancy has to be later than your retirement age.'};

  var need = requiredPot(P, P.ageRetire);
  if(!isFinite(need)){
    // Only Die Rich can need an infinite pot, and only below inflation. Guard
    // it anyway so a future mode cannot inherit the wrong explanation.
    if(P.mode !== 'rich'){
      return {
        status: 'impossible',
        message: 'Sorry. On these numbers, financial freedom is mathematically impossible.',
        detail: 'No pot of any size funds this plan.',
        remedies: []
      };
    }
    return {
      status: 'impossible',
      message: 'Sorry. At this return and inflation level, financial freedom is mathematically impossible.',
      detail: 'Your real return is ' + fmt.pct(P.rr * 100, 2) +
              ', so no pot lasts forever at any size. Beat inflation, or choose Just Die.',
      remedies: []
    };
  }

  var ffAge = solveFreedomAge(P);
  if(ffAge === null){
    return {
      status: 'impossible',
      message: 'Sorry. At this income and expense level, financial freedom is mathematically impossible.',
      detail: 'Your savings never catch up with the pot you need, at any age.',
      remedies: solveRemedies(ui)
    };
  }
  if(ffAge <= P.ageNow + 1e-9){
    return {status:'already', message:'You are already financially free. Your current assets alone cover this plan.', ffAge: ffAge};
  }
  if(ffAge > P.ageRetire + 1e-9){
    return {
      status: 'late',
      message: 'Not by ' + fmt.age(P.ageRetire) + '. On these numbers you reach financial freedom at ' + fmt.age(ffAge) + '.',
      remedies: solveRemedies(ui),
      ffAge: ffAge
    };
  }
  return {status:'ok', ffAge: ffAge};
}

/* ─── FULL LIFETIME PATHS (deterministic) ─── */

// Accumulate to the retirement age, then live off whatever is there.
// `shock` multiplies the balance the month retirement starts.
function lifetimePath(P, shock){
  var accM = Math.max(0, months(P.ageNow, P.ageRetire));
  var total = Math.max(1, months(P.ageNow, P.ageDie));
  var out = new Float64Array(total + 1);
  var W = P.A0, t;
  out[0] = W;
  for(t = 0; t < total; t++){
    if(t === accM && shock) W *= (1 + shock);
    if(t < accM){
      W = W * (1 + P.rm) + savingsAt(P, t);
    } else {
      W -= drawAt(P, P.ageNow + t / 12);
      W *= (1 + P.rm);
    }
    out[t + 1] = W;
  }
  return out;
}

// Yearly samples of a monthly array.
function yearly(arr, years){
  var out = [], y;
  for(y = 0; y <= years; y++) out.push(arr[Math.min(y * 12, arr.length - 1)]);
  return out;
}

/* ─── UI STATE ─── */

var persist = null, rendering = false, renderTimer = null;
var chart1 = null, chart2 = null;
var last = null;                 // the most recent computed result
var tickerInfo = null;           // {ticker, stats, source} once a fetch succeeds

function withAlpha(hex, a){
  var m = String(hex || '').trim().match(/^#([0-9a-fA-F]{6})$/);
  if(!m) return hex;
  return '#' + m[1] + Math.round(clamp(a, 0, 1) * 255).toString(16).padStart(2, '0');
}

function readInputs(){
  UI.currency = $('currency').value;
  UI.ageNow = clamp(num($('ageNow').value, UI_DEFAULTS.ageNow), 0, 100);
  UI.ageRetire = clamp(num($('ageRetire').value, UI_DEFAULTS.ageRetire), 1, 110);
  UI.ageDie = clamp(num($('ageDie').value, UI_DEFAULTS.ageDie), 2, 120);
  UI.expense = Math.max(0, SharedFmt.parseFormatted($('expense').value) || 0);
  UI.expensePeriod = $('expensePeriod').value;
  UI.savings = SharedFmt.parseFormatted($('savings').value) || 0;
  UI.savingsPeriod = $('savingsPeriod').value;
  UI.growth = clamp(num($('growth').value, UI_DEFAULTS.growth), -10, 30);
  UI.inflation = clamp(num($('inflation').value, UI_DEFAULTS.inflation), 0, 30);
  UI.assetPreset = $('assetPreset').value;
  UI.ret = clamp(num($('ret').value, UI_DEFAULTS.ret), -5, 40);
  UI.std = clamp(num($('std').value, UI_DEFAULTS.std), 0, 80);
  UI.mdd = clamp(num($('mdd').value, UI_DEFAULTS.mdd), -95, 0);
  UI.ticker = $('ticker').value.trim().toUpperCase();
  UI.assets = Math.max(0, SharedFmt.parseFormatted($('assets').value) || 0);
  UI.legacy = Math.max(0, SharedFmt.parseFormatted($('legacy').value) || 0);
  UI.retireMultiplier = clamp(num($('retireMultiplier').value, 100), 10, 300);
  var checked = document.querySelector('input[name="ffmode"]:checked');
  UI.mode = checked ? checked.value : 'die';
  UI.pensionOn = $('pensionOn').checked;
  UI.pensionStartAge = clamp(num($('pensionStartAge').value, 67), 40, 90);
  UI.pensionAmount = Math.max(0, SharedFmt.parseFormatted($('pensionAmount').value) || 0);
  UI.showNominal = $('showNominal').checked;
  UI.showStress = $('showStress').checked;
  UI.paths = clamp(Math.round(num($('paths').value, 1000)), 100, 5000);
  UI.confidence = clamp(num($('confidence').value, 90), 50, 99);
  UI.seed = Math.max(1, Math.round(num($('seed').value, UI_DEFAULTS.seed)));
  return UI;
}

function syncVisibility(){
  // Persist restores a radio by setting .checked directly, which fires no
  // `change` event, so the highlighted card has to be re-synced on every
  // render rather than only from the radio's own listener.
  syncModeSelection();
  $('legacyRow').style.display = UI.mode === 'legacy' ? '' : 'none';
  $('pensionRows').style.display = UI.pensionOn ? '' : 'none';
  $('savingsLabel').textContent = UI.savingsMode === 'income' ? 'Net income' : 'Savings';
  $('savingsModeNote').innerHTML = UI.savingsMode === 'income'
    ? 'You save the gap between income and expenses.' +
      info('Income grows at the rate below, expenses rise with inflation. The gap widens if your pay outgrows prices and narrows if it does not, so what you save changes every year.')
    : 'This amount grows at the rate below.' +
      info('Expenses size the pot you need but do not feed back into what you save. Switch to Net income if you want the gap between the two worked out for you.');
  var preset = PRESET_ASSETS[UI.assetPreset];
  $('presetNote').innerHTML = UI.assetPreset === 'custom'
    ? 'Your own figures, or pick a preset to start from.'
    : 'Long-run history, not a forecast.' +
      info('Nominal, before tax and fees, as at ' + PRESETS_AS_AT + '. Cash in particular does not earn a fixed real spread forever, and gold\'s figure depends heavily on the start date. Every field stays editable.');
}

function syncCurrencyPrefixes(){
  fmt.setCurrency(UI.currency);
  ['expense', 'savings', 'legacy', 'assets', 'pensionAmount'].forEach(function(id){
    var el = $(id + 'Prefix');
    if(el) el.textContent = fmt.symbol;
  });
}

/* ─── RENDER ─── */

function compute(ui){
  var P = buildParams(ui);
  var diag = diagnose(ui);
  var years = Math.max(1, Math.round(months(P.ageNow, P.ageDie) / 12));
  var thisYear = new Date().getFullYear();

  var det = lifetimePath(P, 0);
  var needAtRetire = requiredPot(P, P.ageRetire);
  var accM = Math.max(0, months(P.ageNow, P.ageRetire));
  var potAtRetire = det[Math.min(accM, det.length - 1)];

  var needCurve = [], y;
  for(y = 0; y <= years; y++){
    var w = requiredPot(P, P.ageNow + y);
    needCurve.push(isFinite(w) ? w : null);
  }

  var mc = monteCarlo(P, {paths: ui.paths, seed: ui.seed});
  var reqs = potRequirements(P, {paths: ui.paths, seed: ui.seed});

  return {
    P: P, ui: ui, diag: diag, years: years, thisYear: thisYear,
    det: det, needCurve: needCurve,
    needAtRetire: needAtRetire, potAtRetire: potAtRetire,
    stressNeed: stressRequiredPot(P),
    mc: mc, reqs: reqs,
    successAtNeed: reqs.successAt(needAtRetire),
    successAtPlan: reqs.successAt(potAtRetire),
    confPot: reqs.atConfidence(ui.confidence),
    ffAge: diag.ffAge != null ? diag.ffAge : null
  };
}

// Today's money to the money of year y, for display only.
function show(res, value, yearIndex){
  if(value == null || !isFinite(value)) return value;
  if(!res.ui.showNominal) return value;
  return value * Math.pow(1 + res.P.inflation, yearIndex);
}

function moneyMode(res){ return res.ui.showNominal ? 'future dollars' : "today's money"; }

function renderVerdict(res){
  var el = $('verdict');
  var d = res.diag;
  var cls = 'verdict card visible ', html = '';
  if(d.status === 'invalid'){
    cls += 'bad';
    html = '<h2>Check the ages</h2><p>' + escapeHtml(d.message) + '</p>';
  } else if(d.status === 'impossible'){
    cls += 'bad';
    html = '<h2>' + escapeHtml(d.message) + '</h2><p>' + escapeHtml(d.detail || '') + '</p>' + remedyList(d.remedies);
  } else if(d.status === 'already'){
    cls += 'good';
    html = '<h2>' + escapeHtml(d.message) + '</h2><p>Everything below shows what happens if you stop now.</p>';
  } else if(d.status === 'late'){
    cls += 'warn';
    html = '<h2>' + escapeHtml(d.message) + '</h2><p>' +
      fmt.num(Math.max(0, d.ffAge - res.P.ageRetire), 1) + ' years past your target. Any one of these closes it.</p>' +
      remedyList(d.remedies);
  } else {
    cls += 'good';
    html = '<h2>Financially free at ' + escapeHtml(fmt.age(d.ffAge)) + ', ' +
      fmt.num(Math.max(0, res.P.ageRetire - d.ffAge), 1) + ' years before your target.</h2>' +
      '<p>On the expected return alone. Read the chance below too.' +
      info('A single average return ignores the order the good and bad years arrive in. Land a crash early in retirement and the same average return runs out, which is why the chance is usually near a coin flip at the amount needed.') + '</p>';
  }
  el.className = cls;
  el.innerHTML = html;
}

function remedyList(remedies){
  if(!remedies || !remedies.length) return '';
  var html = '<ul class="remedies">';
  remedies.forEach(function(r){
    html += '<li><strong>' + escapeHtml(r.label) + '</strong>' + escapeHtml(r.text) + '</li>';
  });
  return html + '</ul>';
}

function renderMetrics(res){
  var retireYearIdx = Math.max(0, Math.round(res.P.ageRetire - res.P.ageNow));
  var modeName = {die:'Just Die', legacy:'Leave a Legacy', rich:'Die Rich'}[res.ui.mode];

  $('mNeed').textContent = isFinite(res.needAtRetire)
    ? fmt.currency(show(res, res.needAtRetire, retireYearIdx), true) : 'Not possible';
  $('mNeedSub').textContent = isFinite(res.needAtRetire)
    ? modeName + ' at ' + fmt.age(res.P.ageRetire) + ', ' +
      fmt.num(res.needAtRetire / Math.max(1e-9, res.P.Xr * 12), 1) + 'x a year of spending'
    : 'No pot works at this real return.';

  var free = res.ffAge;
  $('mFreeAge').textContent = free == null ? 'Never' : fmt.age(free);
  $('mFreeAgeSub').textContent = free == null
    ? 'The curves never cross.'
    : fmt.num(Math.max(0, free - res.P.ageNow), 1) + ' years away, in ' +
      (res.thisYear + Math.round(free - res.P.ageNow));

  var sr = res.successAtPlan;
  $('mSuccess').textContent = fmt.pct(sr * 100, 0);
  $('mSuccess').className = 'value ' + (sr >= 0.85 ? 'pos' : (sr < 0.6 ? 'neg' : ''));
  $('mSuccessSub').textContent = 'of ' + fmt.num(res.mc.paths) + ' simulated futures.';

  $('mConfPot').textContent = isFinite(res.confPot)
    ? fmt.currency(show(res, res.confPot, retireYearIdx), true) : 'Not reachable';
  $('mConfPotSub').textContent = isFinite(res.confPot)
    ? 'vs ' + fmt.pct(res.successAtNeed * 100, 0) + ' survival at the amount needed.'
    : 'Out of reach at this volatility.';

  $('mStress').textContent = isFinite(res.stressNeed)
    ? fmt.currency(show(res, res.stressNeed, retireYearIdx), true) : 'Not possible';
  $('mStressSub').textContent = 'if a ' + fmt.pct(Math.abs(res.ui.mdd), 0) +
    ' fall lands the month you retire.';

  $('mRealRet').textContent = fmt.pct(res.P.rr * 100, 2);
  $('mRealRetSub').textContent = fmt.pct(res.ui.ret, 1) + ' less ' + fmt.pct(res.ui.inflation, 1) +
    ' inflation. ' + (res.P.rr > 0
      ? 'Forever costs ' + fmt.num((1 + res.P.rm) / res.P.rm / 12, 1) + 'x spending.'
      : 'At or below zero, nothing lasts forever.');
}

/* ─── CHARTS ─── */

// Every colour is read from a CSS variable at build time, so the charts have
// to be rebuilt when the theme flips. renderCharts() does exactly that.
function chartTokens(){
  return {
    grid: cssVar('--chart-grid'),
    muted: cssVar('--chart-text'),
    text: cssVar('--text'),
    panel: cssVar('--panel'),
    a: cssVar('--line-a'), b: cssVar('--line-b'), c: cssVar('--line-c'),
    d: cssVar('--line-d'), e: cssVar('--line-e')
  };
}

function pts(values, firstYear){
  var out = [], i;
  for(i = 0; i < values.length; i++) out.push({x: firstYear + i, y: values[i]});
  return out;
}

function baseOptions(res, t, xTitle, hoverId, ageOf){
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: {duration: 250},
    interaction: {mode: 'index', intersect: false},
    plugins: {
      legend: {display: false},
      tooltip: {
        backgroundColor: t.panel, titleColor: t.text, bodyColor: t.muted,
        borderColor: t.grid, borderWidth: 1, padding: 10,
        callbacks: {
          title: function(items){
            if(!items.length) return '';
            var yr = items[0].parsed.x;
            return yr + ', age ' + fmt.age(ageOf(yr));
          },
          label: function(ctx){ return '  ' + ctx.dataset.label + ': ' + fmt.currency(ctx.parsed.y, true); },
          afterBody: function(items){
            if(!items.length) return;
            var yr = items[0].parsed.x;
            $(hoverId).textContent = yr + ', age ' + fmt.age(ageOf(yr)) + '  —  ' +
              items.map(function(i){ return i.dataset.label + ': ' + fmt.currency(i.parsed.y, true); }).join('  |  ');
          }
        }
      },
      zoom: {
        pan: {enabled: true, mode: 'x'},
        zoom: {wheel: {enabled: true, speed: 0.08}, pinch: {enabled: true}, mode: 'x'}
      }
    },
    scales: {
      x: {
        type: 'linear',
        title: {display: true, text: xTitle, color: t.muted, font: {size: 11}},
        ticks: {color: t.muted, maxTicksLimit: 12, precision: 0, font: {size: 11},
                callback: function(v){ return String(Math.round(v)); }},
        grid: {color: t.grid}
      },
      y: {
        title: {display: true, text: 'Balance, ' + moneyMode(res), color: t.muted, font: {size: 11}},
        ticks: {color: t.muted, font: {size: 11}, callback: function(v){ return fmt.currency(v, true); }},
        grid: {color: t.grid}
      }
    }
  };
}

function renderLegend(elId, chart, items){
  var el = $(elId);
  el.innerHTML = '';
  items.forEach(function(item){
    var div = document.createElement('div');
    div.className = 'legend-item';
    div.innerHTML = '<span class="dot ' + (item.style || '') + '" style="background:' + item.color + '"></span>' +
      '<span>' + escapeHtml(item.label) + '</span>';
    div.addEventListener('click', function(){
      var hidden = !chart.isDatasetVisible(item.datasets[0]);
      item.datasets.forEach(function(i){ chart.setDatasetVisibility(i, hidden); });
      div.classList.toggle('hidden', !hidden);
      chart.update();
    });
    el.appendChild(div);
  });
}

function renderCharts(res){
  if(!window.Chart) return;
  var t = chartTokens();
  var y0 = res.thisYear, years = res.years;
  var ageOf = function(yr){ return res.P.ageNow + (yr - y0); };
  var scale = function(arr){
    return arr.map(function(v, i){ return v == null ? null : show(res, v, i); });
  };

  // ── Chart 1: the run-up, with the two curves that decide the answer ──
  // It stops at retirement, or at the freedom age when that comes later. Run it
  // to the life expectancy instead and sixty years of compounding push the 90th
  // percentile so high that the crossing, the one thing this chart is for,
  // becomes an unreadable sliver at the bottom.
  var retIdx = Math.max(0, Math.round(res.P.ageRetire - res.P.ageNow));
  var freeIdx = res.ffAge == null ? retIdx : Math.ceil(res.ffAge - res.P.ageNow);
  var c1 = clamp(Math.max(retIdx, freeIdx) + 3, 1, years);
  var cut = function(arr){ return arr.slice(0, c1 + 1); };
  var det = scale(cut(yearly(res.det, years)));
  var need = scale(cut(res.needCurve));
  var p10 = scale(cut(res.mc.bands.p10)), p50 = scale(cut(res.mc.bands.p50)), p90 = scale(cut(res.mc.bands.p90));

  var ds1 = [
    {label:'Worst 10%', data: pts(p10, y0), borderColor: withAlpha(t.a, 0), backgroundColor:'transparent',
     borderWidth: 0, pointRadius: 0, fill: false},
    {label:'Range of outcomes', data: pts(p90, y0), borderColor: withAlpha(t.a, 0), backgroundColor: withAlpha(t.a, 0.16),
     borderWidth: 0, pointRadius: 0, fill: '-1'},
    {label:'Median outcome', data: pts(p50, y0), borderColor: t.c, borderDash:[5,4],
     borderWidth: 1.6, pointRadius: 0, fill: false},
    {label:'Your money', data: pts(det, y0), borderColor: t.a, borderWidth: 2.4, pointRadius: 0, fill: false},
    {label:'Pot needed to stop here', data: pts(need, y0), borderColor: t.b, borderWidth: 2, pointRadius: 0, fill: false}
  ];
  var legend1 = [
    {label:'Your money', color:t.a, datasets:[3]},
    {label:'Pot needed to stop here', color:t.b, datasets:[4]},
    {label:'Median outcome', color:t.c, style:'dash', datasets:[2]},
    {label:'Range of outcomes, worst 10% to best 10%', color:withAlpha(t.a, 0.45), style:'band', datasets:[0,1]}
  ];

  if(chart1) chart1.destroy();
  chart1 = new Chart($('ffChart').getContext('2d'), {
    type:'line',
    data:{datasets: ds1},
    options: baseOptions(res, t, 'Calendar year (age shown on hover)', 'hover1', ageOf)
  });
  renderLegend('legend1', chart1, legend1);

  // ── Chart 2: the drawdown on its own, four starting pots compared ──
  var ha = res.P.ageDie;
  var ry = y0 + retIdx;
  var ddYears = Math.max(1, Math.round(ha - res.P.ageRetire));
  var run = function(W, shock){
    if(!isFinite(W)) return null;
    var r = drawdownPath(res.P, W, res.P.ageRetire, ha, shock ? {shock: shock} : null);
    return yearly(r.path, ddYears).map(function(v, i){ return show(res, v, retIdx + i); });
  };
  var yourPot = run(res.potAtRetire, 0);
  var needPot = run(res.needAtRetire, 0);
  var confPot = run(res.confPot, 0);
  var crashed = run(res.potAtRetire, res.P.mdd);

  var ds2 = [], legend2 = [];
  function add(label, data, color, dash){
    if(!data) return;
    ds2.push({label: label, data: pts(data, ry), borderColor: color, borderWidth: 2.2,
              borderDash: dash || undefined, pointRadius: 0, fill: false});
    legend2.push({label: label, color: color, style: dash ? 'dash' : '', datasets:[ds2.length - 1]});
  }
  add('Your pot', yourPot, t.a);
  add('The amount needed', needPot, t.b);
  add('Pot for ' + fmt.pct(res.ui.confidence, 0) + ' confidence', confPot, t.e);
  if(res.ui.showStress) add('Your pot after a crash', crashed, t.d, [3,3]);

  if(chart2) chart2.destroy();
  chart2 = new Chart($('ddChart').getContext('2d'), {
    type:'line',
    data:{datasets: ds2},
    options: baseOptions(res, t, 'Calendar year (age shown on hover)', 'hover2', ageOf)
  });
  renderLegend('legend2', chart2, legend2);

  $('chart1Sub').textContent = 'Where the two solid lines cross is the earliest you can stop.';
  $('chart2Sub').textContent = 'The same retirement from four starting pots, age ' +
    fmt.age(res.P.ageRetire) + ' to ' + fmt.age(ha) + '.';
}

/* ─── TABLE ─── */

function renderTable(res){
  var years = res.years, y0 = res.thisYear;
  var retIdx = Math.max(0, Math.round(res.P.ageRetire - res.P.ageNow));
  var freeIdx = res.ffAge == null ? -1 : Math.ceil(res.ffAge - res.P.ageNow);
  var det = yearly(res.det, years);
  var rows = '';
  for(var y = 0; y <= years; y++){
    var age = res.P.ageNow + y;
    var flow = 0, m;
    if(y < years){
      for(m = y * 12; m < (y + 1) * 12; m++){
        flow += (m < retIdx * 12) ? savingsAt(res.P, m) : -drawAt(res.P, res.P.ageNow + m / 12);
      }
    }
    var bal = det[y], needv = res.needCurve[y];
    var gap = (needv == null) ? null : bal - needv;
    var cls = [];
    if(y === freeIdx) cls.push('free');
    if(y === retIdx) cls.push('retire');
    rows += '<tr' + (cls.length ? ' class="' + cls.join(' ') + '"' : '') + '>' +
      '<td>' + (y0 + y) + '</td>' +
      '<td>' + fmt.age(age) + '</td>' +
      '<td class="' + (flow < 0 ? 'neg' : 'pos') + '">' + (y < years ? fmt.currency(show(res, flow, y), true) : '—') + '</td>' +
      '<td>' + fmt.currency(show(res, bal, y), true) + '</td>' +
      '<td>' + (needv == null ? 'n/a' : fmt.currency(show(res, needv, y), true)) + '</td>' +
      '<td class="' + (gap == null ? '' : (gap >= 0 ? 'pos' : 'neg')) + '">' +
        (gap == null ? '—' : fmt.currency(show(res, gap, y), true)) + '</td>' +
      '</tr>';
  }
  $('tableWrap').innerHTML =
    '<table><thead><tr><th>Year</th><th>Age</th><th>Saved or spent</th><th>Balance</th>' +
    '<th>Pot needed</th><th>Gap</th></tr></thead><tbody>' + rows + '</tbody></table>';
  $('tableSub').innerHTML = 'In ' + moneyMode(res) + '.' +
    info('The highlighted row is the year you become financially free. The rule above a row marks the year you retire. Saved or spent is the whole year: savings going in while you work, the net draw once you stop.');
}

/* ─── ASSUMPTIONS ─── */

function renderAssumptions(res){
  var swr = res.needAtRetire > 0 ? (res.P.Xr * 12 / res.needAtRetire * 100) : null;
  var items = [
    '<strong>No tax.</strong> Enter everything net of it.' +
      info('Spending, saving and the return are all taken as after-tax figures. Tax differs too much between countries, and between an ordinary account and a superannuation or pension wrapper, to model honestly in one tool.'),

    '<strong>Shown in ' + moneyMode(res) + '.</strong> Spending holds its value, so it rises with inflation.' +
      info('Switch between today\'s money and future dollars on the Settings tab. Future dollars are the same plan multiplied by the inflation factor for each year, so they look larger and buy the same.'),

    '<strong>Your FIRE number</strong> implies a ' + (swr == null ? 'n/a' : fmt.pct(swr, 2)) + ' SWR.' +
      info('The share of the pot you spend in the first year. The familiar 25 times rule is the same arithmetic at a 4% real return, so a higher real return needs a smaller pot and a lower one needs more.'),

    '<strong>The shaded band is not a path.</strong>' +
      info('It is the 10th to 90th percentile across ' + fmt.num(res.mc.paths) + ' simulated futures at each year separately, so its edges are an envelope rather than one future you could live through. The futures are a random walk that drifts upward and wobbles, using your return as the compound drift and your volatility as the wobble. At 0% volatility they collapse onto the single smooth projection exactly.'),

    '<strong>The crash is worst-case timing,</strong> with no bonus recovery.' +
      info('The drawdown lands the month you retire, when the pot is largest and has the longest still to fund, then compounds again from there. A real crash usually rebounds, so this is deliberately pessimistic.'),

    '<strong>Not modelled:</strong> one-off costs, a mortgage ending, aged care, or any spending change beyond the retirement percentage.'
  ];
  if(res.ui.mode === 'rich'){
    items.splice(3, 0, '<strong>Forever is tested to age ' + RICH_HORIZON_AGE + '.</strong>' +
      info('At the required pot the balance holds its real value, so a longer horizon would not change the answer. With a pension starting after you retire the pot is meant to fall through the years before it, then hold from there.'));
  }
  if(tickerInfo){
    items.push('<strong>' + escapeHtml(tickerInfo.ticker) + '</strong> measured ' +
      escapeHtml(tickerInfo.stats.from) + ' to ' + escapeHtml(tickerInfo.stats.to) + '.' +
      info(tickerInfo.source === 'stooq'
        ? 'That series is not adjusted for dividends, so the return is understated. A Yahoo series would include them.'
        : 'Adjusted close, so dividends are included in the return.'));
  }
  $('assumptions').innerHTML = items.map(function(x){ return '<li>' + x + '</li>'; }).join('');
}

/* ─── MAIN RENDER ─── */

function render(){
  if(rendering) return;
  rendering = true;
  try {
    readInputs();
    syncCurrencyPrefixes();
    syncVisibility();
    var res = compute(UI);
    last = res;
    renderVerdict(res);
    renderMetrics(res);
    renderCharts(res);
    renderTable(res);
    renderAssumptions(res);
    if(window.SharedAbbr && SharedAbbr.refresh) SharedAbbr.refresh();
  } finally {
    rendering = false;
  }
}

function scheduleRender(){
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 160);
}

/* ─── TICKER ─── */

function isoToday(){ return new Date().toISOString().slice(0, 10); }

function tickerStatus(msg, isError){
  var el = $('tickerStatus');
  el.className = isError ? 'err' : '';
  el.innerHTML = msg;
}

function rateSuffix(){
  if(!window.SharedYF || !SharedYF.getDailyRemaining) return '';
  return ' <span style="opacity:.8">(' + SharedYF.getDailyRemaining() + ' of ' +
    SharedYF.getDailyLimit() + ' data requests left today)</span>';
}

async function fetchTicker(){
  var tk = $('ticker').value.trim().toUpperCase();
  if(!tk){ tickerStatus('Enter a ticker code first, for example SPY.', true); return; }
  if(!window.SharedPriceCache){ tickerStatus('Market data engine did not load.', true); return; }
  var btn = $('fetchTickerBtn');
  btn.disabled = true;
  tickerStatus('Loading ' + escapeHtml(tk) + '…');
  try {
    var end = isoToday();
    await SharedPriceCache.ensure(tk, TICKER_HISTORY_START, end);
    var slice = SharedPriceCache.slice(tk, TICKER_HISTORY_START, end);
    if(!slice){ tickerStatus('No price history came back for ' + escapeHtml(tk) + '.', true); return; }
    var st = tickerStats(slice.dates, slice.prices);
    if(!st){ tickerStatus('Not enough price history for ' + escapeHtml(tk) + ' to measure anything useful.', true); return; }
    // ensure() does not throw when only part of a widen fails, and slice()
    // reports what is held rather than what was asked for. Without this the
    // figures would quietly come from a shorter window than advertised.
    var partial = !SharedPriceCache.covers(tk, TICKER_HISTORY_START, end);
    $('assetPreset').value = 'custom';
    $('ret').value = st.cagr.toFixed(1);
    $('std').value = st.std.toFixed(1);
    $('mdd').value = String(Math.round(st.mdd));
    tickerInfo = {ticker: tk, stats: st, source: slice.source};
    tickerStatus('<strong>' + escapeHtml(tk) + '</strong> over ' + fmt.num(st.years, 1) + ' years: ' +
      fmt.pct(st.cagr, 1) + ' a year, ' + fmt.pct(st.std, 1) + ' volatility, ' +
      fmt.pct(st.mdd, 0) + ' worst fall.' +
      (slice.source === 'stooq' ? ' Not adjusted for dividends, so the return is understated.' : '') +
      (partial ? ' Only part of the history was available, so this is measured from ' +
        escapeHtml(st.from) + ' onward.' : '') +
      rateSuffix());
    render();
  } catch(err){
    tickerStatus('Could not load ' + escapeHtml(tk) + ': ' + escapeHtml(err && err.message ? err.message : 'unknown error') + '.' + rateSuffix(), true);
  } finally {
    btn.disabled = false;
  }
}

/* ─── WIRING ─── */

function applyUIToDom(ui){
  $('currency').value = ui.currency;
  $('ageNow').value = ui.ageNow;
  $('ageRetire').value = ui.ageRetire;
  $('ageDie').value = ui.ageDie;
  $('expense').value = SharedFmt.formatThousands(ui.expense);
  $('expensePeriod').value = ui.expensePeriod;
  $('savings').value = SharedFmt.formatThousands(ui.savings);
  $('savingsPeriod').value = ui.savingsPeriod;
  $('growth').value = ui.growth;
  $('inflation').value = ui.inflation;
  $('assetPreset').value = ui.assetPreset;
  $('ret').value = ui.ret;
  $('std').value = ui.std;
  $('mdd').value = ui.mdd;
  $('assets').value = SharedFmt.formatThousands(ui.assets);
  $('legacy').value = SharedFmt.formatThousands(ui.legacy);
  $('retireMultiplier').value = ui.retireMultiplier;
  $('pensionOn').checked = !!ui.pensionOn;
  $('pensionStartAge').value = ui.pensionStartAge;
  $('pensionAmount').value = SharedFmt.formatThousands(ui.pensionAmount);
  $('showNominal').checked = !!ui.showNominal;
  $('showStress').checked = !!ui.showStress;
  $('paths').value = ui.paths;
  $('confidence').value = ui.confidence;
  $('seed').value = ui.seed;
  var radio = document.querySelector('input[name="ffmode"][value="' + ui.mode + '"]');
  if(radio) radio.checked = true;
  syncModeSelection();
  setSavingsMode(ui.savingsMode, true);
}

function syncModeSelection(){
  document.querySelectorAll('#modeGroup .radio-opt').forEach(function(opt){
    var input = opt.querySelector('input[type=radio]');
    opt.classList.toggle('selected', !!(input && input.checked));
  });
}

function setSavingsMode(mode, silent){
  UI.savingsMode = (mode === 'income') ? 'income' : 'savings';
  document.querySelectorAll('#savingsModeGroup .seg-btn').forEach(function(b){
    b.classList.toggle('active', b.dataset.val === UI.savingsMode);
  });
  if(!silent){ if(persist) persist.schedule(); scheduleRender(); }
}

function populateSelects(){
  var cur = $('currency');
  cur.innerHTML = Object.keys(CURRENCIES).map(function(code){
    return '<option value="' + code + '">' + escapeHtml(CURRENCIES[code].label) + '</option>';
  }).join('');
  var pre = $('assetPreset');
  pre.innerHTML = Object.keys(PRESET_ASSETS).map(function(key){
    return '<option value="' + key + '">' + escapeHtml(PRESET_ASSETS[key].label) + '</option>';
  }).join('');
}

function wire(){
  document.querySelectorAll('.ctrl-tab').forEach(function(tab){
    tab.addEventListener('click', function(){
      document.querySelectorAll('.ctrl-tab').forEach(function(t){ t.classList.remove('active'); });
      document.querySelectorAll('.ctrl-panel').forEach(function(p){ p.classList.remove('active'); });
      tab.classList.add('active');
      var panel = $('tab-' + tab.dataset.tab);
      if(panel) panel.classList.add('active');
    });
  });

  $('themeToggle').addEventListener('click', function(){
    document.body.classList.toggle('light');
    $('themeToggle').textContent = document.body.classList.contains('light') ? '🌙 Dark' : '☀️ Light';
    // CSS variables resolve to fixed values when a chart is built, so the
    // charts have to be rebuilt from the new tokens.
    if(last) renderCharts(last);
  });

  ['expense', 'savings', 'assets', 'legacy', 'pensionAmount'].forEach(function(id){
    SharedFmt.attachCurrencyInput($(id), {maxDecimals: 0, onChange: scheduleRender});
  });

  ['ageNow','ageRetire','ageDie','growth','inflation','ret','std','mdd','retireMultiplier',
   'pensionStartAge','paths','confidence','seed'].forEach(function(id){
    $(id).addEventListener('input', scheduleRender);
  });
  ['expensePeriod','savingsPeriod','currency'].forEach(function(id){
    $(id).addEventListener('change', scheduleRender);
  });

  $('assetPreset').addEventListener('change', function(){
    var p = PRESET_ASSETS[$('assetPreset').value];
    if(p && $('assetPreset').value !== 'custom'){
      $('ret').value = p.ret; $('std').value = p.std; $('mdd').value = p.mdd;
      tickerInfo = null;
    }
    scheduleRender();
  });

  document.querySelectorAll('#savingsModeGroup .seg-btn').forEach(function(btn){
    btn.addEventListener('click', function(){ setSavingsMode(btn.dataset.val); });
  });

  document.querySelectorAll('input[name="ffmode"]').forEach(function(r){
    r.addEventListener('change', function(){ syncModeSelection(); scheduleRender(); });
  });

  ['pensionOn','showNominal','showStress'].forEach(function(id){
    $(id).addEventListener('change', scheduleRender);
  });

  $('fetchTickerBtn').addEventListener('click', fetchTicker);
  $('ticker').addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); fetchTicker(); } });

  $('resetZoom1').addEventListener('click', function(){ if(chart1) chart1.resetZoom(); });
  $('resetZoom2').addEventListener('click', function(){ if(chart2) chart2.resetZoom(); });
  $('ffChart').addEventListener('mouseleave', function(){ $('hover1').textContent = 'Hover to inspect any year.'; });
  $('ddChart').addEventListener('mouseleave', function(){ $('hover2').textContent = 'Hover to inspect any year.'; });

  $('resetBtn').addEventListener('click', function(){
    tickerInfo = null;
    $('ticker').value = '';
    tickerStatus('');
    Object.assign(UI, UI_DEFAULTS);
    applyUIToDom(UI_DEFAULTS);
    if(persist) persist.schedule();
    render();
  });
}

/* ─── INIT ─── */

function init(){
  populateSelects();
  applyUIToDom(UI_DEFAULTS);
  wire();
  if(window.Persist){
    // Language-agnostic namespace, so an Indonesian page could share this cache.
    persist = Persist.init('financialfreedom', {
      onRestore: function(){ render(); },
      extra: {
        save: function(){ return {savingsMode: UI.savingsMode}; },
        restore: function(saved){ if(saved && saved.savingsMode) setSavingsMode(saved.savingsMode, true); }
      }
    });
  }
  tickerStatus('Nothing is fetched until you press Fetch.' + rateSuffix());
  render();
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/* Engine handle for the audit harness in _audit/. Everything the harness needs
   to drive the maths without going through the DOM. */
window.__FF = {
  CURRENCIES: CURRENCIES,
  PRESET_ASSETS: PRESET_ASSETS,
  UI_DEFAULTS: UI_DEFAULTS,
  RICH_HORIZON_AGE: RICH_HORIZON_AGE,
  get UI(){ return UI; },
  buildParams: buildParams,
  savingsAt: savingsAt,
  drawAt: drawAt,
  requiredPot: requiredPot,
  drawdownPath: drawdownPath,
  accumulate: accumulate,
  lifetimePath: lifetimePath,
  solveFreedomAge: solveFreedomAge,
  monteCarlo: monteCarlo,
  potRequirements: potRequirements,
  growthSeries: growthSeries,
  stressRequiredPot: stressRequiredPot,
  tickerStats: tickerStats,
  diagnose: diagnose,
  solveRemedies: solveRemedies,
  months: months,
  perMonth: perMonth,
  mulberry32: mulberry32,
  deriveSeed: deriveSeed,
  fmt: fmt,
  readInputs: readInputs,
  compute: compute,
  render: render,
  get last(){ return last; },
  get charts(){ return {main: chart1, drawdown: chart2}; }
};

})();
