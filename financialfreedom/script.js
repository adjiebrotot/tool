/* Financial Freedom Calculator. How much is enough, and when do you get there.
   ---------------------------------------------------------------------------
   The page answers two separate questions and keeps them apart, because mixing
   them is what made the old single chart unreadable:

     SECTION 1, Path to freedom.  How EARLY could you stop? Required pot at
       every age against what the investment grows to if you never stop paying
       in. No withdrawal appears anywhere in it, so the crossing is the crossing
       and nothing else moves the lines.
     SECTION 2, Cashflows.  What happens if you stop at THIS age? Income and
       spending in the upper two thirds of one chart, the balance they leave
       behind in the lower third, both on the same pair of x axes so a year
       lines up between them. Everything here is for the retirement age on the
       slider, the verdict on that age included, and the slider is the
       sensitivity: it moves nothing in section 1 and everything in section 2.

   Everything below runs in REAL terms (today's money) on MONTHLY steps, and is
   sampled yearly for the charts and the table. The audit harness in _audit/
   replays this documented maths in a deliberately different formulation, so
   read it as the specification, not as a summary.

   Step 1  Normalise the inputs.
     Expenses, savings and the pension all arrive weekly, monthly or yearly and
     are converted to a monthly figure (weekly x 52/12, yearly / 12). Ages are
     decimal years; month counts are round((b - a) * 12).

   Step 2  Strip out inflation, using Fisher rather than subtraction.
     rr   = (1 + r) / (1 + i) - 1        real annual return
     gr   = (1 + g) / (1 + i) - 1        real annual growth of savings/income
     rm   = (1 + rr)^(1/12) - 1          real monthly return
     gm   = (1 + gr)^(1/12) - 1          real monthly growth
     Expenses are constant in real terms by construction, so they never appear
     with an inflation factor again. Nominal figures are only ever produced for
     display, by multiplying a real figure at year y by (1 + i)^y. That is what
     the page shows by DEFAULT, because a balance in the money of its own year
     is the figure the statement will actually read; Show Present Value turns
     the factor back off and leaves everything in today's money.

   Step 3  Savings depend on WHICH field was entered. These are two different
     models and the panel says which one is running.
       entered Savings:    S(t) = S0 * (1 + gm)^t
       entered Net Income: S(t) = I0 * (1 + gm)^t - X       (may go negative)
     where X is the real monthly expense and t is months from today.

     The page also plots income and spending side by side, so both are carried
     as series in their own right, with the identity SAVED = INCOME - SPENT
     holding in every month of the plan, working or retired:
       working, entered Net Income:  income = I0 * (1 + gm)^t
       working, entered Savings:     income = S(t) + X, the take-home pay that
                                     saving that much while spending that much
                                     implies. Nothing else in the engine uses it.
       retired:                      income = the pension, or zero before it
                                     starts. Spending is Xr, so the gap is the
                                     net draw of step 5 with its sign flipped.

   Step 3b  The pension, and whether it keeps its value.
     P0 is the entered amount per month. Two countries do not treat it the same
     way, so the tool asks:
       indexed     P(t) = P0                       flat in TODAY'S money, which
                                                   is a rising figure in the
                                                   money of the day
       not indexed P(t) = P0 / (1 + i)^(t/12)      flat in the MONEY OF THE DAY,
                                                   which is a falling real value
     t is months from TODAY, not from the pension start, so a pension that is
     never indexed has already lost value by the time it starts. Both forms are
     zero before the start age. With zero inflation the two coincide exactly.

   Step 4  Accumulation, while still working. Return over the month, savings
     added at the end of it:
       W(t+1) = W(t) * (1 + rm) + S(t),      W(0) = current invested assets
     Section 1 runs this recurrence for the WHOLE span, today to the life
     expectancy, with no retirement in it at all. That is the line the crossing
     is solved against in step 7, so the marker cannot sit off the curve it is
     read from.

   Step 5  Drawdown, once retired. Expenses out and any pension in at the
     START of the month, return over the month:
       W(t+1) = (W(t) - Xr + P(t)) * (1 + rm)
     Xr is the real monthly expense in retirement (today's expense times the
     retirement multiplier). This is section 2 only: the balance line there
     accumulates to the slider age and draws down from it. It is plotted as it
     comes out, so a plan that runs out is drawn below zero rather than flat
     along it: the negative balance is the size of the miss, and the table and
     the "Left at" card read the same figure.

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
     An unindexed pension has faded to almost nothing by age 120, so the Die
     Rich perpetuity is taken on the net draw AT the horizon, which is then
     within a whisker of the full expense. The months either side of it are
     covered by the same forward pass as every other month.

   Step 7  The earliest financial freedom age. Two curves over age: what the
     investment accumulates to, and the pot step 6 requires if you stopped at
     that age. Accumulated is non-decreasing under the savings model, required
     is non-increasing, so they cross at most once. The first month where
     accumulated >= required is the answer. The search excludes the final month
     only: at the death age itself there is nothing left to fund, so every plan
     would qualify. No crossing before then means the plan is not achievable.
     Neither curve depends on the retirement age, which is why section 1 does
     not move when the slider does.

   Step 8  Monte Carlo. The same recurrences with a random monthly growth
     factor instead of (1 + rm):
       growth = exp(ln(1 + rr)/12 + sigma * sqrt(1/12) * z),   z ~ N(0,1)
     The drift is ln(1 + rr) because the return input is a COMPOUND (CAGR)
     figure, so with no cash flows the median path is the deterministic line
     and sigma = 0 collapses to it exactly. Normals come from Box-Muller,
     seeded per path, so a run is reproducible and every pot is scored against
     the SAME set of paths. The band on the section 1 chart is the yearly
     cross-section of the ACCUMULATION paths, matching the line it wraps.

   Step 9  The confidence pot. Because step 5 is affine in W, each simulated
     path has an exact minimum starting pot that survives it. Collect one per
     path, sort, and read off the percentile. The 90% confidence pot is the
     90th percentile. No search is needed, and success probability at any pot
     is just the share of paths whose requirement is at or below it. This is
     measured at the slider's retirement age, so it is a section 2 figure.

   Step 10  Money deposited, the third line on the section 1 chart. It is what
     you have put in that is STILL in the pot, so it answers "am I living off
     the growth, or am I eating the capital?":
       D(0) = the current invested assets
       D(t+1) = max(0, min(D(t) + max(0, f), W))
     where f is the month's cash flow and W the balance just after it lands.
     Money in adds to it; money out comes off the growth first, which is all the
     clamp against the balance says. On the section 1 chart, where nothing is
     ever withdrawn, it is simply every cent paid in, held down by the balance
     in the years a bad market has the pot below it.

   Step 11  The year-by-year table is a cash flow statement and reconciles as
     one. Each row carries the balance at the start of the year, the twelve
     months of income and spending that follow, and the investment return that
     closes it:
       Growth(y) = Balance(y+1) - Balance(y) - Saved(y)
     Taken as a residual in whatever money is on screen, so the row adds up to
     the cent in today's money and in the money of the day alike. In real terms
     it is the real return on the pot; in future's money it is the nominal
     return, which is the same earnings plus the inflation uplift on the
     balance and the year's flows.

   Not modelled, deliberately: tax, fees beyond whatever the return input is
   already net of, lumpy one-off spending, and any change in the expense level
   other than the retirement multiplier. Nor a separate crash test: one
   hand-placed drawdown told the reader less than step 8 already does, because
   the volatility puts a crash somewhere in thousands of futures, including the
   ones that land it the month you retire.
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
     bonds     long-run developed-market government bond total returns.
     us        S&P 500 total return, 1928 onward.
     asx       Australian equity total return, long run.
     world     developed plus emerging blend, long run.
     gold      USD gold, 1971 onward. Highly start-date dependent: 1971 is a
               regime break, and the volatility is equity-like without the
               earnings behind it. */
var PRESET_ASSETS = {
  custom: {label:'Custom (enter your own)',        ret:8.0,  std:15.0},
  cash:   {label:'Cash / high-yield savings',      ret:4.0,  std:1.0},
  bonds:  {label:'Fixed income (government bonds)',ret:5.0,  std:6.0},
  us:     {label:'Equity - United States',         ret:10.0, std:15.5},
  asx:    {label:'Equity - Australia (ASX)',       ret:9.5,  std:16.0},
  world:  {label:'Equity - global diversified',    ret:8.5,  std:15.0},
  gold:   {label:'Gold',                           ret:7.5,  std:17.0}
};
var PRESETS_AS_AT = '2026-09';

// "Indefinitely" has to stop somewhere to be computable. Die Rich is tested to
// age 120: at the perpetuity pot the real balance is flat, so the horizon only
// has to be long enough to expose a declining one.
var RICH_HORIZON_AGE = 120;
var MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var TICKER_HISTORY_START = '1990-01-01';

var UI_DEFAULTS = {
  currency: 'AUD',
  ageNow: 30, ageRetire: 60, ageDie: 90,
  expense: 60000, expensePeriod: 'yearly',
  savingsMode: 'savings', savings: 30000, savingsPeriod: 'yearly',
  growth: 3, inflation: 2.5,
  assetPreset: 'custom', ret: 8, std: 15, ticker: '',
  assets: 100000,
  mode: 'die', legacy: 500000, retireMultiplier: 100,
  pensionOn: false, pensionStartAge: 67,
  pensionAmount: 29000, pensionPeriod: 'yearly', pensionIndexed: true,
  showReal: false, paths: 1000, seed: 20260921,
  confidence: 90
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
    X: X,
    Xr: X * (ui.retireMultiplier / 100),
    savingsMode: ui.savingsMode,
    S0: ui.savingsMode === 'savings' ? entered : 0,
    I0: ui.savingsMode === 'income' ? entered : 0,
    A0: ui.assets,
    legacy: ui.legacy,
    pensionOn: !!ui.pensionOn,
    pensionStartAge: ui.pensionStartAge,
    pensionIndexed: ui.pensionIndexed !== false,
    pensionMonthly: ui.pensionOn ? perMonth(ui.pensionAmount, ui.pensionPeriod) : 0
  };
}

/* The real monthly pension at absolute age `age` (step 3b). Indexed pensions
   hold their value, so the real figure never moves. An unindexed one is a
   steady figure in the money of the day, which is a real value falling at the
   inflation rate from TODAY — not from the start age, because the amount
   entered is what it pays now, and a pension frozen for the thirty years
   before you claim it buys thirty years less by the time you do. */
function pensionAt(P, age){
  if(!P.pensionOn || age < P.pensionStartAge - 1e-9) return 0;
  if(P.pensionIndexed) return P.pensionMonthly;
  return P.pensionMonthly / Math.pow(1 + P.inflation, Math.max(0, age - P.ageNow));
}

// Real monthly savings t months from today, while still working (step 3).
function savingsAt(P, t){
  var f = Math.pow(1 + P.gm, t);
  return P.savingsMode === 'income' ? (P.I0 * f - P.X) : (P.S0 * f);
}

// Net real monthly draw during retirement at absolute age `age` (step 5).
function drawAt(P, age){ return P.Xr - pensionAt(P, age); }

// Months of work left. Every series below splits on this exact month, so the
// engine and the plotted cash flows cannot disagree about when work stops.
function accMonths(P){ return Math.max(0, months(P.ageNow, P.ageRetire)); }

/* Real monthly income t months from today (step 3). While working it is the
   take-home pay: entered directly under the Net income model, and implied by
   savings plus spending under the Savings model, where it is the only figure
   consistent with what was entered. Once retired it is the pension alone. */
function incomeAt(P, t){
  if(t < accMonths(P)){
    return P.savingsMode === 'income' ? P.I0 * Math.pow(1 + P.gm, t) : savingsAt(P, t) + P.X;
  }
  return pensionAt(P, P.ageNow + t / 12);
}

// Real monthly spending t months from today. Flat by construction in real
// terms; the retirement multiplier is the one thing that moves it.
function spendAt(P, t){ return t < accMonths(P) ? P.X : P.Xr; }

/* Money in less money out, the quantity the second chart fills and the table's
   Saved column. It is savingsAt(t) while working and -drawAt(age) once retired,
   by construction, so SAVED = INCOME - SPENT holds in every month. */
function flowAt(P, t){ return incomeAt(P, t) - spendAt(P, t); }

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

/* Accumulation (step 4), month 0 .. n. The month count is clamped at zero
   because callers hand it a span that can be empty or inverted — retiring at
   your age now is a legitimate slider position, and a solver probing past an
   age bound is not. An empty span is a pot that has not grown, not a crash. */
function accumulate(P, n, growth){
  n = Math.max(0, n | 0);
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

/* The band on the section 1 chart (step 8). Accumulation only, because that
   is the line it wraps: the same recurrence as step 4 with a random monthly
   growth factor, sampled yearly across paths. Bands are the cross-section at
   each year, so the p10 line is an envelope of bad years rather than one bad
   path, and at zero volatility every percentile collapses onto the
   deterministic accumulation exactly. */
function accumBands(P, opts){
  var nPaths = Math.max(1, opts.paths | 0);
  var chartYears = Math.max(1, Math.round(months(P.ageNow, P.ageDie) / 12));
  var total = Math.max(1, chartYears * 12);
  var samples = [], y, p, t;
  for(y = 0; y <= chartYears; y++) samples.push(new Float64Array(nPaths));
  for(p = 0; p < nPaths; p++){
    var rng = mulberry32(deriveSeed(opts.seed, 'path' + p));
    var g = growthSeries(P, rng, total);
    var W = P.A0;
    samples[0][p] = W;
    for(t = 0; t < total; t++){
      W = W * g[t] + savingsAt(P, t);
      if((t + 1) % 12 === 0){
        var yi = (t + 1) / 12;
        if(yi <= chartYears) samples[yi][p] = W;
      }
    }
  }
  var bands = {p10: [], p50: [], p90: []};
  for(y = 0; y <= chartYears; y++){
    var col = Array.prototype.slice.call(samples[y]).sort(function(a, b){ return a - b; });
    bands.p10.push(quantile(col, 0.10));
    bands.p50.push(quantile(col, 0.50));
    bands.p90.push(quantile(col, 0.90));
  }
  return {bands: bands, years: chartYears, paths: nPaths};
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

/* Annualised return and volatility from a fetched price series, the two figures
   the engine takes. Adjusted close from the Worker's Yahoo path includes
   dividends; its Stooq fallback does not, so the caller warns when `source` is
   stooq. */
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
  return {
    cagr: cagr * 100, std: sd * 100,
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
  /* The retirement age is a slider pinned to this span, so the only age that
     can still be nonsense is the span itself. Both ends of the slider are
     legitimate answers: retiring at your age now means stopping today, and
     retiring at your life expectancy means never stopping at all. */
  if(P.ageDie <= P.ageNow) return {status:'invalid', message:'Your life expectancy has to be later than your age now.'};

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

/* ─── DETERMINISTIC PATHS ─── */

/* SECTION 1. Accumulation for the whole span, today to the life expectancy,
   with no retirement anywhere in it, carrying the deposited line of step 10
   alongside the balance. This is the curve the crossing in step 7 is solved
   against, so the chart and the answer are reading the same numbers.

   The two series have to be built in the same loop: what a month does to the
   deposited line depends on the balance it leaves behind, which is the whole
   point of the line. Savings land at the END of a working month, after that
   month's return. */
function accumulationSeries(P){
  var total = Math.max(1, months(P.ageNow, P.ageDie));
  var balance = new Float64Array(total + 1);
  var deposited = new Float64Array(total + 1);
  var W = P.A0, dep = P.A0, t, f;
  balance[0] = W; deposited[0] = dep;
  for(t = 0; t < total; t++){
    f = savingsAt(P, t);
    W = W * (1 + P.rm) + f;
    dep = Math.max(0, Math.min(dep + Math.max(0, f), W));
    balance[t + 1] = W;
    deposited[t + 1] = dep;
  }
  return {balance: balance, deposited: deposited, months: total};
}

/* SECTION 2. Accumulate to the retirement age on the slider, then live off
   whatever is there. This is the balance line of the cashflow chart and the
   Balance column of the table, and it is the ONLY place a withdrawal appears.

   Note where in the month each flow lands, because the engine says so: savings
   go in at the END of a working month, after that month's return, while a
   withdrawal comes out at the START of a retired one, before it. */
function lifetimeSeries(P){
  var accM = accMonths(P);
  var total = Math.max(1, months(P.ageNow, P.ageDie));
  var balance = new Float64Array(total + 1);
  var W = P.A0, t, f;
  balance[0] = W;
  for(t = 0; t < total; t++){
    f = flowAt(P, t);
    if(t < accM){
      W = W * (1 + P.rm) + f;                  // savings land after the return
    } else {
      W += f;                                  // the draw comes out before it
      W *= (1 + P.rm);
    }
    balance[t + 1] = W;
  }
  return {balance: balance, months: total};
}

// Yearly samples of a monthly array.
function yearly(arr, years){
  var out = [], y;
  for(y = 0; y <= years; y++) out.push(arr[Math.min(y * 12, arr.length - 1)]);
  return out;
}

/* ─── UI STATE ─── */

var persist = null, rendering = false, stale = false, retireTimer = null;
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
  UI.ageDie = clamp(num($('ageDie').value, UI_DEFAULTS.ageDie), 2, 120);
  /* The retirement age is a slider spanning age now to the life expectancy, so
     it can never be read outside that span however the two ends move. Both
     ends are meaningful: the left is "stop today", the right is "never stop".
     The clamp runs before syncRetireSlider writes the bounds back onto the
     control, so a life expectancy dragged below the handle pulls it down with
     it instead of leaving a stale value behind — and it clamps to the SAME
     rounded span the slider will carry, or a fractional age would have the two
     disagreeing and the handle jumping a year on every keystroke. */
  var span = retireSpan();
  UI.ageRetire = clamp(num($('ageRetire').value, UI_DEFAULTS.ageRetire), span.lo, span.hi);
  UI.expense = Math.max(0, SharedFmt.parseFormatted($('expense').value) || 0);
  UI.expensePeriod = $('expensePeriod').value;
  UI.savings = SharedFmt.parseFormatted($('savings').value) || 0;
  UI.savingsPeriod = $('savingsPeriod').value;
  UI.growth = clamp(num($('growth').value, UI_DEFAULTS.growth), -10, 30);
  UI.inflation = clamp(num($('inflation').value, UI_DEFAULTS.inflation), 0, 30);
  UI.assetPreset = $('assetPreset').value;
  UI.ret = clamp(num($('ret').value, UI_DEFAULTS.ret), -5, 40);
  UI.std = clamp(num($('std').value, UI_DEFAULTS.std), 0, 80);
  UI.ticker = $('ticker').value.trim().toUpperCase();
  UI.assets = Math.max(0, SharedFmt.parseFormatted($('assets').value) || 0);
  UI.legacy = Math.max(0, SharedFmt.parseFormatted($('legacy').value) || 0);
  UI.retireMultiplier = clamp(num($('retireMultiplier').value, 100), 10, 300);
  var checked = document.querySelector('input[name="ffmode"]:checked');
  UI.mode = checked ? checked.value : 'die';
  UI.pensionOn = $('pensionOn').checked;
  UI.pensionStartAge = clamp(num($('pensionStartAge').value, 67), 40, 90);
  UI.pensionAmount = Math.max(0, SharedFmt.parseFormatted($('pensionAmount').value) || 0);
  UI.pensionPeriod = $('pensionPeriod').value;
  UI.pensionIndexed = $('pensionIndexed').checked;
  UI.showReal = $('showReal').checked;
  UI.paths = clamp(Math.round(num($('paths').value, 1000)), 100, 5000);
  UI.confidence = clamp(num($('confidence').value, 90), 50, 99);
  UI.seed = Math.max(1, Math.round(num($('seed').value, UI_DEFAULTS.seed)));
  return UI;
}

/* The slider's own bounds are data, not markup: they are the two ages on the
   You tab, so they are written back on every render. Kept here rather than in
   the slider's listener because Persist restores values without firing events,
   and because either end can move while the handle stays where it was.
   Whole years, because the slider steps in whole years, and because the read
   and the write have to agree on the span or the handle would never settle. */
function retireSpan(){
  var lo = Math.round(UI.ageNow);
  return {lo: lo, hi: Math.max(lo, Math.round(UI.ageDie))};
}

/* The markup's own min and max are the widest the handle can ever go, and the
   mini cache relies on that: Persist restores the saved age by writing it
   straight onto the control, before any render has had a chance to widen the
   span to fit it. Captured on the first call, which is applyUIToDom() at load,
   before anything has narrowed them. */
var retireMarkupSpan = null;
function widenRetireSlider(){
  var el = $('ageRetire');
  if(retireMarkupSpan === null) retireMarkupSpan = {min: el.min, max: el.max};
  el.min = retireMarkupSpan.min;
  el.max = retireMarkupSpan.max;
}

/* The slider's default is the answer above it. A plan's freedom age is the
   earliest age it actually works, so that is where the handle starts: Cashflows
   opens on the earliest stop that pays for itself, instead of on a round number
   nobody chose. Whole years and rounded UP, because the crossing lands mid-year
   and the year before it does not work.

   A plan that never reaches freedom has no such age. Then the handle goes to
   the far end of its own scale — "never stop", which is the life expectancy —
   because that is what the plan says: there is no age at which you can stop.

   It is a default, not a binding. It is set when a whole plan is applied (at
   load, from a Quick Start, or back to the defaults) and from then on the
   handle is the reader's; nothing moves it until the next whole plan.

   Cheap enough to run on the spot: the freedom solve is about half a
   millisecond, against ~150ms for the Monte Carlo it runs before. */
function seedRetireAge(){
  var ff = solveFreedomAge(buildParams(UI));
  var span = retireSpan();
  // 1e-9 so a crossing that lands exactly on a birthday is not pushed a year out.
  UI.ageRetire = clamp(ff === null ? span.hi : Math.ceil(ff - 1e-9), span.lo, span.hi);
  /* Write the handle through the markup's own span and leave it open. The
     render that follows narrows it to this plan's two ages, and at load this
     runs BEFORE the mini cache restores — which writes its saved age straight
     onto the control, and would have it clamped to the defaults' ceiling if
     this narrowed the span on the way past. */
  widenRetireSlider();
  $('ageRetire').value = UI.ageRetire;
  $('ageRetireVal').textContent = fmt.age(UI.ageRetire);
}

function syncRetireSlider(){
  var el = $('ageRetire'), span = retireSpan();
  el.min = span.lo; el.max = span.hi;
  if(Number(el.value) !== UI.ageRetire) el.value = UI.ageRetire;
  $('ageRetireVal').textContent = fmt.age(UI.ageRetire);
  $('retireScaleMin').textContent = 'Stop today (' + fmt.age(span.lo) + ')';
  $('retireScaleMax').textContent = 'Never stop (' + fmt.age(span.hi) + ')';
  ['mNeedAge', 'mHaveAge'].forEach(function(id){ $(id).textContent = fmt.age(UI.ageRetire); });
  $('mLeftAge').textContent = fmt.age(UI.ageDie);
}

function syncVisibility(){
  // Persist restores a radio by setting .checked directly, which fires no
  // `change` event, so the highlighted card has to be re-synced on every
  // render rather than only from the radio's own listener.
  syncModeSelection();
  syncRetireSlider();
  $('legacyRow').style.display = UI.mode === 'legacy' ? '' : 'none';
  $('pensionRows').style.display = UI.pensionOn ? '' : 'none';
  renderPensionNote();
  $('savingsLabel').textContent = UI.savingsMode === 'income' ? 'Net income' : 'Savings';
  $('savingsModeNote').innerHTML = UI.savingsMode === 'income'
    ? 'You save the gap between income and expenses.' +
      info('Income grows at the rate below, expenses rise with inflation, so what you save changes every year.')
    : 'This amount grows at the rate below.' +
      info('Expenses size the pot you need but do not change what you save. Switch to Net income to have the gap worked out for you.');
  var preset = PRESET_ASSETS[UI.assetPreset];
  $('presetNote').innerHTML = UI.assetPreset === 'custom'
    ? 'Your own figures, or pick a preset to start from.'
    : 'Long-run history, not a forecast.' +
      info('Nominal, before tax and fees, as at ' + PRESETS_AS_AT + '. Every field stays editable.');
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
  var now = new Date();
  var thisYear = now.getFullYear(), thisMonth = now.getMonth();

  // Section 1: never retires. Section 2: retires at the slider age. Two
  // different series on purpose, and the only place they have to agree is the
  // retirement month itself, where the second one has not drawn anything yet.
  var acc = accumulationSeries(P);
  var det = lifetimeSeries(P).balance;
  var accM = accMonths(P);
  var needAtRetire = requiredPot(P, P.ageRetire);
  var potAtRetire = acc.balance[Math.min(accM, acc.balance.length - 1)];
  var leftAtDeath = det[det.length - 1];

  /* The engine runs in real terms, where the living cost is flat by
     construction. That is the whole point of real terms, and it is also why
     inflation can LOOK inert: the figure on the page never moves. So the cost
     of living is carried year by year as its own series, and `show()` turns it
     into the money of that year whenever future's money is on. It is the
     same rise that lifts the pot needed, said out loud.

     Income and saving ride alongside it, as whole-year sums of the monthly
     series rather than a rate read off one month, so a year that straddles the
     retirement month is the blend it actually is. The final row has no year
     after it, so it carries the annual rate at that age and no saving. */
  var needCurve = [], incomeCurve = [], expenseCurve = [], flowCurve = [], y, m;
  for(y = 0; y <= years; y++){
    var w = requiredPot(P, P.ageNow + y);
    needCurve.push(isFinite(w) ? w : null);
    if(y < years){
      var inc = 0, exp = 0;
      for(m = y * 12; m < (y + 1) * 12; m++){ inc += incomeAt(P, m); exp += spendAt(P, m); }
      incomeCurve.push(inc);
      expenseCurve.push(exp);
      flowCurve.push(inc - exp);
    } else {
      incomeCurve.push(incomeAt(P, years * 12) * 12);
      expenseCurve.push(spendAt(P, years * 12) * 12);
      flowCurve.push(null);
    }
  }

  var mc = accumBands(P, {paths: ui.paths, seed: ui.seed});
  var reqs = potRequirements(P, {paths: ui.paths, seed: ui.seed});

  return {
    P: P, ui: ui, diag: diag, years: years, thisYear: thisYear, thisMonth: thisMonth,
    acc: acc.balance, deposited: acc.deposited, det: det,
    needCurve: needCurve, incomeCurve: incomeCurve,
    expenseCurve: expenseCurve, flowCurve: flowCurve,
    needAtRetire: needAtRetire, potAtRetire: potAtRetire, leftAtDeath: leftAtDeath,
    mc: mc, reqs: reqs,
    successAtPlan: reqs.successAt(potAtRetire),
    confPot: reqs.atConfidence(ui.confidence),
    ffAge: diag.ffAge != null ? diag.ffAge : null
  };
}

/* Today's money to the money of year y, for display only. Future's money is
   the default: it is what the account will actually read in that year, and
   a reader who has not met real terms before takes them at face value. Show
   Present Value leaves the engine's own real figures alone instead. */
function show(res, value, yearIndex){
  if(value == null || !isFinite(value)) return value;
  if(res.ui.showReal) return value;
  return value * Math.pow(1 + res.P.inflation, yearIndex);
}

function moneyMode(res){ return res.ui.showReal ? "today's money" : "future's money"; }

/* Name a position on the calendar-year axis. The yearly samples sit on whole
   years and read as one, but the crossing falls BETWEEN two of them, so its x
   is a decimal: "2040.1666666666667" is not a date anyone can read. Year 0 of
   the projection is today, so the fraction is months from this month, and the
   answer is named to the nearest one: "Feb 2040". */
function whenLabel(res, yearX){
  var m = Math.round((yearX - res.thisYear) * 12);
  if(m % 12 === 0) return String(res.thisYear + m / 12);
  var abs = res.thisMonth + m;
  return MONTH_NAMES[((abs % 12) + 12) % 12] + ' ' + (res.thisYear + Math.floor(abs / 12));
}

/* What the inflation rate actually does to the reader's own spending. The
   engine already applies it everywhere, but in today's money the living cost
   never moves on screen, so the rate reads as inert until a price is named. */
function renderInflationNote(res){
  var el = $('inflationNote');
  if(!el) return;
  var i = res.P.inflation, now = res.P.X * 12;
  if(!(now > 0)){ el.textContent = ''; return; }
  if(i <= 0){
    el.textContent = 'Prices hold still, so the ' + fmt.currency(now) +
      ' a year you spend today still costs ' + fmt.currency(now) + ' at ' +
      fmt.age(res.P.ageDie) + '.';
    return;
  }
  var toRetire = Math.max(0, res.P.ageRetire - res.P.ageNow);
  var toDie = Math.max(0, res.P.ageDie - res.P.ageNow);
  el.innerHTML = 'The ' + escapeHtml(fmt.currency(now)) + ' a year you spend today costs ' +
    escapeHtml(fmt.currency(now * Math.pow(1 + i, toRetire))) + ' a year at ' +
    escapeHtml(fmt.age(res.P.ageRetire)) + ', and ' +
    escapeHtml(fmt.currency(now * Math.pow(1 + i, toDie))) + ' at ' +
    escapeHtml(fmt.age(res.P.ageDie)) + '.' +
    info('Same life, bigger figure. Turn on Show Present Value in Settings to read it in today\'s money instead.');
}

/* What the indexation switch actually does to the reader's own pension. The
   engine runs in real terms, so an indexed pension is a flat line and an
   unindexed one a sinking one, and neither is legible until a figure is named
   at a date the reader cares about. */
function renderPensionNote(){
  var el = $('pensionNote');
  if(!el) return;
  if(!UI.pensionOn){ el.textContent = ''; el.style.display = 'none'; return; }
  el.style.display = '';
  var perYear = perMonth(UI.pensionAmount, UI.pensionPeriod) * 12;
  var i = UI.inflation / 100;
  var toStart = Math.max(0, UI.pensionStartAge - UI.ageNow);
  var toDie = Math.max(0, UI.ageDie - UI.ageNow);
  if(!(perYear > 0)){ el.textContent = 'Enter an amount and it is counted as income from age ' + fmt.age(UI.pensionStartAge) + '.'; return; }
  if(UI.pensionIndexed){
    el.innerHTML = escapeHtml(fmt.currency(perYear)) + ' a year in today\u2019s money from age ' +
      escapeHtml(fmt.age(UI.pensionStartAge)) + ', and it keeps buying that much: ' +
      escapeHtml(fmt.currency(perYear * Math.pow(1 + i, toStart))) + ' a year in the money of that year.' +
      info('Australia, the UK and the US all index their age pension.');
    return;
  }
  el.innerHTML = escapeHtml(fmt.currency(perYear)) + ' a year from age ' +
    escapeHtml(fmt.age(UI.pensionStartAge)) + ' and never a cent more, so it buys ' +
    escapeHtml(fmt.currency(perYear / Math.pow(1 + i, toStart))) + ' of today\u2019s living when it starts and ' +
    escapeHtml(fmt.currency(perYear / Math.pow(1 + i, toDie))) + ' by ' + escapeHtml(fmt.age(UI.ageDie)) + '.' +
    info('A frozen pension is eroded from TODAY, not from the day it starts: the amount entered is what it pays now, so the years before you claim it wear it down too.');
}

/* TWO verdicts, because the page asks two questions and the slider only moves
   one of them.

   The banner at the top of the page carries what the slider cannot touch: a
   broken pair of ages, a plan no pot of any size can fund, and the age the
   crossing actually happens at. Those are section 1's answers, and they read
   the same wherever the handle is left.

   The verdict on the SLIDER'S OWN AGE — "not by 48, you get there at 64" —
   hangs under the slider instead, because it is an answer about that control:
   it changes on every drag, and the remedies under it (retire later, save
   more) are the ways to close the gap the handle just opened. Putting it at
   the top of the page meant dragging the slider rewrote a banner three
   screens above the hand doing the dragging. */
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
  } else {
    /* `late` and `ok` are the SAME answer to this question: there is a
       crossing, and this is the age it happens at. Whether the slider clears
       it is the other card's business, so this one never mentions it. */
    cls += 'good';
    html = '<h2>Financially free at ' + escapeHtml(fmt.age(d.ffAge)) + '.</h2>' +
      '<p>On the expected return alone, and the retirement slider cannot move it. Read the chance below too.' +
      info('A single average return ignores the order the good and bad years arrive in. Land the bad ones early and the same average return runs out.') + '</p>';
  }
  el.className = cls;
  el.innerHTML = html;
  renderSliderVerdict(res);
}

/* The verdict on the age the slider is sitting on, drawn directly under it.
   It says nothing at all when there is no plan to judge: the banner above has
   already explained why, and a second red card under the slider would read as
   a second, different failure. */
function renderSliderVerdict(res){
  var el = $('verdictSlider');
  if(!el) return;
  var d = res.diag;
  var cls = 'verdict card visible ', html = '';
  if(d.status === 'invalid' || d.status === 'impossible'){
    el.className = 'verdict card';
    el.innerHTML = '';
    return;
  }
  if(d.status === 'late'){
    cls += 'warn';
    html = '<h2>' + escapeHtml(d.message) + '</h2><p>' +
      fmt.num(Math.max(0, d.ffAge - res.P.ageRetire), 1) +
      ' years past the age on this slider. Any one of these closes it.</p>' +
      remedyList(d.remedies);
  } else if(d.status === 'already'){
    cls += 'good';
    html = '<h2>Stopping at ' + escapeHtml(fmt.age(res.P.ageRetire)) + ' works.</h2>' +
      '<p>Your current assets already cover this plan, so every age on this slider clears it.</p>';
  } else {
    cls += 'good';
    html = '<h2>Stopping at ' + escapeHtml(fmt.age(res.P.ageRetire)) + ' works, with ' +
      fmt.num(Math.max(0, res.P.ageRetire - d.ffAge), 1) + ' years to spare.</h2>' +
      '<p>You reach financial freedom at ' + escapeHtml(fmt.age(d.ffAge)) +
      ', and everything below this slider is measured at the age it is left on.</p>';
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

/* Two strips, one per section, and each figure sits with the question it
   answers. Section 1 never mentions the slider; section 2 is entirely about it. */
function renderMetrics(res){
  var retireYearIdx = Math.max(0, Math.round(res.P.ageRetire - res.P.ageNow));
  var dieYearIdx = Math.max(0, Math.round(res.P.ageDie - res.P.ageNow));
  var modeName = {die:'Just Die', legacy:'Leave a Legacy', rich:'Die Rich'}[res.ui.mode];
  var yearsOf = function(pot){ return pot / Math.max(1e-9, res.P.Xr * 12); };

  // ── Section 1 ──
  var free = res.ffAge;
  $('mFreeAge').textContent = free == null ? 'Never' : fmt.age(free);
  $('mFreeAge').className = 'value ' + (free == null ? 'neg' : '');
  $('mFreeAgeSub').textContent = free == null
    ? 'The two curves never meet.'
    : fmt.num(Math.max(0, free - res.P.ageNow), 1) + ' years away, in ' +
      whenLabel(res, res.thisYear + (free - res.P.ageNow)) + '.';

  var freePot = free == null ? null : requiredPot(res.P, free);
  var freeIdx = free == null ? 0 : (free - res.P.ageNow);
  $('mFreePot').textContent = (freePot == null || !isFinite(freePot))
    ? '—' : fmt.currency(show(res, freePot, freeIdx), true);
  $('mFreePotSub').textContent = (freePot == null || !isFinite(freePot))
    ? 'No pot funds this plan.'
    : fmt.num(yearsOf(freePot), 1) + 'x a year of retirement spending, for ' + modeName +
      (res.ui.showReal ? ', in today\u2019s money.' : ', in the money of that year.');

  $('mRealRet').textContent = fmt.pct(res.P.rr * 100, 2);
  $('mRealRetSub').textContent = fmt.pct(res.ui.ret, 1) + ' less ' + fmt.pct(res.ui.inflation, 1) +
    ' inflation. ' + (res.P.rr > 0
      ? 'Forever costs ' + fmt.num((1 + res.P.rm) / res.P.rm / 12, 1) + 'x spending.'
      : 'At or below zero, nothing lasts forever.');

  // ── Section 2, all at the slider age ──
  var need = res.needAtRetire, have = res.potAtRetire;
  $('mNeed').textContent = isFinite(need) ? fmt.currency(show(res, need, retireYearIdx), true) : 'Not possible';
  var swr = isFinite(need) && need > 0 ? (res.P.Xr * 12 / need * 100) : null;
  $('mNeedSub').textContent = isFinite(need)
    ? 'Your FIRE number for ' + modeName + ': ' + fmt.num(yearsOf(need), 1) + 'x a year of spending' +
      (swr == null ? '' : ', a ' + fmt.pct(swr, 2) + ' SWR') +
      (res.ui.showReal ? '.' : ', in ' + (res.thisYear + retireYearIdx) + ' dollars.')
    : 'No pot works at this real return.';

  var short = isFinite(need) ? have - need : -Infinity;
  $('mHave').textContent = fmt.currency(show(res, have, retireYearIdx), true);
  $('mHave').className = 'value ' + (!isFinite(short) ? 'neg' : (short >= -1e-6 ? 'pos' : 'neg'));
  $('mHaveSub').textContent = !isFinite(short)
    ? 'Nothing is enough for this goal.'
    : (short >= -1e-6
        ? fmt.currency(show(res, short, retireYearIdx), true) + ' more than the pot needed.'
        : 'Short by ' + fmt.currency(show(res, -short, retireYearIdx), true) + '.');

  var sr = res.successAtPlan;
  $('mSuccess').textContent = fmt.pct(sr * 100, 0);
  $('mSuccess').className = 'value ' + (sr >= 0.85 ? 'pos' : (sr < 0.6 ? 'neg' : ''));
  /* The confidence pot no longer has a card of its own, but it is still the
     figure to plan around, so it rides under the probability it belongs to. */
  $('mSuccessSub').textContent = 'of ' + fmt.num(res.reqs.paths) + ' simulated futures. ' +
    (isFinite(res.confPot)
      ? fmt.pct(res.ui.confidence, 0) + ' confidence needs ' +
        fmt.currency(show(res, res.confPot, retireYearIdx), true) + '.'
      : fmt.pct(res.ui.confidence, 0) + ' confidence is out of reach at this volatility.');

  /* What the whole drawdown adds up to. It is the one figure that says out
     loud whether the plan was funded: the balance at the life expectancy after
     every year of it has been paid for. */
  var left = res.leftAtDeath;
  $('mLeft').textContent = fmt.currency(show(res, left, dieYearIdx), true);
  $('mLeft').className = 'value ' + (left >= -1e-6 ? (left > 1 ? 'pos' : '') : 'neg');
  $('mLeftSub').textContent = left < -1e-6
    ? 'The pot ran out. This is the shortfall it would have taken to see the plan through.'
    : (res.ui.mode === 'legacy'
        ? 'Against the ' + fmt.currency(show(res, res.ui.legacy, dieYearIdx), true) + ' you wanted to leave.'
        : (res.P.ageRetire >= res.P.ageDie - 1e-9
            ? 'You never stop working on this setting, so nothing is ever drawn.'
            : 'After ' + fmt.num(Math.max(0, res.P.ageDie - res.P.ageRetire), 1) + ' years of retirement.'));
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

/* Keep the y axis on the slice of the plan that is actually on screen. A
   linear y axis is sized once, from the whole series, so zooming into ten
   years of a sixty-year plan leaves those ten years as a flat smear against a
   scale built for the end of it. Every zoom and every pan re-fits y to the x
   window, so the shape under the reader's nose is the shape they can read.

   `hiSeries` are the series the TOP of the axis is sized to, `loSeries` those
   the bottom is. The simulated band's upper edge is deliberately in neither:
   sixty years of compounding put its best decile so far above the lines that
   decide the answer that the answer becomes an unreadable sliver, so the band
   is allowed to run off the top instead and the subtitle says it does. Points
   one year either side of the window count too, so the segments that cross the
   edges are not clipped out of their own scale. */
function makeYFit(y0, hiSeries, loSeries, opts){
  opts = opts || {};
  function edge(list, xMin, xMax, better){
    var best = null;
    list.forEach(function(arr){
      for(var i = 0; i < arr.length; i++){
        var v = arr[i], x = y0 + i;
        if(v == null || !isFinite(v)) continue;
        if(x < xMin - 1 || x > xMax + 1) continue;
        if(best === null || better(v, best)) best = v;
      }
    });
    return best;
  }
  return function(xMin, xMax){
    var hi = edge(hiSeries, xMin, xMax, function(v, b){ return v > b; });
    var lo = edge(loSeries, xMin, xMax, function(v, b){ return v < b; });
    if(hi === null || lo === null) return null;
    // A cash flow, and a balance that can go under, are both read against
    // zero, so zero stays on the axis whichever side of it the window sits.
    if(opts.includeZero && lo > 0) lo = 0;
    if(opts.includeZero && hi < 0) hi = 0;
    var pad = Math.max((hi - lo) * 0.1, Math.abs(hi) * 0.02, 1);
    var min = lo - pad * 0.6;
    if(lo >= 0 && min < 0) min = 0;   // never open a gap below an empty pot
    /* `topPad` buys extra headroom for a pane that has another one sitting on
       top of it: without it the highest tick of the lower pane and the lowest
       tick of the upper one are both drawn at the join, one on the other. */
    return {min: min, max: hi + pad * (opts.topPad || 1)};
  };
}

/* The refit is a Chart.js plugin rather than a zoom callback, because it has
   to happen INSIDE the update the gesture already triggers. A second update
   chasing the first leaves the lines drawn against the old scale while the
   ticks already show the new one, which is worse than not refitting at all.

   The zoom plugin writes the window it is about to draw into the x scale's
   options and then calls update, so by `beforeUpdate` that window is readable
   and the y axis can be sized to it in the same pass. */
var Y_FIT_PLUGIN = {
  id: 'ffYFit',
  beforeUpdate: function(chart){
    // A map of scale id to fitter, because the cashflow chart carries two y
    // axes stacked one above the other: the flows on top and the balance
    // below. Both read the same x window, and both have to be refitted in this
    // one pass.
    var fits = chart.$fitY;
    if(!fits) return;
    var xo = chart.options.scales.x;
    if(!isFinite(xo.min) || !isFinite(xo.max)) return;
    Object.keys(fits).forEach(function(id){
      var yo = chart.options.scales[id];
      if(!yo) return;
      var b = fits[id](xo.min, xo.max);
      if(!b) return;
      yo.min = b.min; yo.max = b.max;
    });
  }
};

/* Chart.js resolves an `index` tooltip by DATA INDEX: it takes the nearest
   element, reads its index, and pulls that index out of every other dataset.
   Every series here is one point per year EXCEPT the droplines, which are two
   points, and the crossing marker, which is one. Hovering either of those
   therefore asked for index 0 or 1 of the yearly series, and the tooltip
   reported the FIRST YEAR of the plan under the hovered year's heading — the
   crossing dot showing "Money deposited: $100k" in 2061.

   Matching by x VALUE is the fix, and it is the right rule anyway: these are
   linear axes where x is a calendar year, so two points belong in the same
   tooltip when they sit at the same year, whatever index they hold inside
   their own dataset. A marker between two yearly samples then answers for
   itself instead of borrowing someone else's row. */
function registerXValueMode(){
  if(!window.Chart || !Chart.Interaction || !Chart.Interaction.modes) return false;
  if(Chart.Interaction.modes.ffXValue) return true;
  var parsedAt = function(meta, i){
    if(meta.controller && meta.controller.getParsed) return meta.controller.getParsed(i);
    return meta._parsed ? meta._parsed[i] : null;
  };
  Chart.Interaction.modes.ffXValue = function(chart, e, options, useFinalPosition){
    var pos = (Chart.helpers && Chart.helpers.getRelativePosition)
      ? Chart.helpers.getRelativePosition(e, chart) : e;
    var metas = chart.getSortedVisibleDatasetMetas();
    var anchor = null, bestPx = Infinity;
    metas.forEach(function(meta){
      meta.data.forEach(function(el, i){
        if(!el || el.skip) return;
        var parsed = parsedAt(meta, i);
        if(!parsed) return;
        var d = Math.abs(el.getProps(['x'], useFinalPosition).x - pos.x);
        if(d < bestPx){ bestPx = d; anchor = parsed.x; }
      });
    });
    if(anchor === null) return [];
    var out = [];
    metas.forEach(function(meta){
      meta.data.forEach(function(el, i){
        if(!el || el.skip) return;
        var parsed = parsedAt(meta, i);
        if(!parsed || Math.abs(parsed.x - anchor) > 1e-9) return;
        out.push({element: el, datasetIndex: meta.index, index: i});
      });
    });
    return out;
  };
  return true;
}

/* Both charts carry TWO x axes over the same numbers: the calendar year the
   data is plotted on, and the age that year lands on. They are given identical
   bounds so the zoom plugin, which moves every x-axis scale together, keeps
   them in step. `limits` pins that span as the widest view there is, so a
   zoom-out cannot pull back past the data the way an unbounded linear scale
   otherwise would (priceCanvas in dcasimulator/ gets this free from being a
   category scale; a linear one has to say so). */
function baseOptions(res, t, hoverId, ageOf, xMin, xMax, opts){
  opts = opts || {};
  /* The window the chart OPENS on and the window it may be zoomed out to are
     two different things. Sixty years of compounding put the end of a plan two
     orders of magnitude above its beginning, so a chart that opens on all of it
     answers nothing; but the rest of the plan is real, and pinching out to it
     has to work. `limitMin`/`limitMax` are the data, xMin/xMax the first view. */
  var limMin = opts.limitMin == null ? xMin : opts.limitMin;
  var limMax = opts.limitMax == null ? xMax : opts.limitMax;
  var span = Math.max(1, limMax - limMin);
  var limit = {min: limMin, max: limMax, minRange: Math.min(3, span)};
  var start = opts.fitY ? opts.fitY(xMin, xMax) : null;
  var lower = opts.lowerPane || null;
  var startLow = lower && lower.fitY ? lower.fitY(xMin, xMax) : null;
  // Falls back to Chart.js's own index mode only where the custom one could
  // not be registered, which is the stubbed build the audit harness runs.
  var hoverMode = registerXValueMode() ? 'ffXValue' : 'index';
  var o = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {duration: 250},
    interaction: {mode: hoverMode, axis: 'x', intersect: false},
    plugins: {
      legend: {display: false},
      tooltip: SharedChartTip.options({
        mode: hoverMode, axis: 'x', intersect: false,
        backgroundColor: t.panel, titleColor: t.text, bodyColor: t.muted,
        borderColor: t.grid, borderWidth: 1, padding: 10,
        // A dropline is a rule, not a reading: both of its ends sit on the
        // hovered year, so left in it would list the same marker twice, once
        // at its value and once at zero.
        filter: function(item){ return !(item.dataset && item.dataset.ffTipHide); },
        callbacks: {
          title: function(items){
            if(!items.length) return '';
            var yr = items[0].parsed.x;
            return whenLabel(res, yr) + ', age ' + fmt.age(ageOf(yr));
          },
          label: function(ctx){ return '  ' + ctx.dataset.label + ': ' + fmt.currency(ctx.parsed.y, true); },
          afterBody: function(items){
            if(!items.length) return;
            var yr = items[0].parsed.x;
            $(hoverId).textContent = whenLabel(res, yr) + ', age ' + fmt.age(ageOf(yr)) + '  —  ' +
              items.map(function(i){ return i.dataset.label + ': ' + fmt.currency(i.parsed.y, true); }).join('  |  ');
          }
        }
      }),
      zoom: {
        limits: {x: limit, xAge: limit},
        /* No gesture callbacks: the y refit runs INSIDE the update the gesture
           already triggers (see Y_FIT_PLUGIN), and there is no second chart
           left to carry an x window across to. */
        pan: {enabled: true, mode: 'x'},
        zoom: {wheel: {enabled: true, speed: 0.08}, pinch: {enabled: true}, mode: 'x'}
      }
    },
    scales: {}
  };
  o.scales.x = {
    type: 'linear', position: 'bottom', min: xMin, max: xMax,
    title: {display: true, text: 'Calendar year', color: t.muted, font: {size: 11}},
    ticks: {color: t.muted, maxTicksLimit: 12, precision: 0, font: {size: 11},
            callback: function(v){ return String(Math.round(v)); }},
    grid: {color: t.grid}
  };
  // The age axis plots nothing. It restates the same x in the unit the
  // reader actually thinks in, under the calendar year.
  o.scales.xAge = {
    type: 'linear', position: 'bottom', min: xMin, max: xMax,
    title: {display: true, text: 'Age', color: t.muted, font: {size: 11}},
    ticks: {color: t.muted, maxTicksLimit: 12, precision: 0, font: {size: 11},
            callback: function(v){ return fmt.age(ageOf(v)); }},
    grid: {drawOnChartArea: false, color: t.grid}
  };
  /* A stock and a flow do not share a scale: a balance in the millions would
     flatten a spending line in the tens of thousands into the axis. They do
     belong in one picture though, so they are given two STACKED scales on one
     canvas instead — the flows in the upper share of the height, the balance
     in the lower one, both reading the single pair of x axes above.

     Chart.js stacks the scales of a group in the order they are DEFINED,
     bottom one first, so the lower pane has to be written onto the options
     before the main axis. Everything else about it is an ordinary y axis. */
  if(lower){
    o.scales[lower.id] = {
      type: 'linear', position: 'left', stack: 'ffCash', stackWeight: lower.weight || 1,
      min: startLow ? startLow.min : undefined,
      max: startLow ? startLow.max : undefined,
      title: {display: true, text: lower.title + ', ' + moneyMode(res),
              color: t.muted, font: {size: 11}},
      // Fewer ticks than a full-height axis would carry, so the two panes
      // cannot print labels on top of each other across the join.
      ticks: {color: t.muted, font: {size: 11}, maxTicksLimit: 5, includeBounds: false,
              callback: function(v){ return fmt.currency(v, true); }},
      grid: {color: t.grid}
    };
    /* A spacer in the middle of the stack, so the two panes read as two
       pictures rather than one picture with a line through it. It plots
       nothing and draws nothing — no ticks, no gridlines, no border — it only
       takes its share of the height, which is small enough to be a seam and
       large enough that the balance floor and the flows floor are plainly not
       the same axis. It is written between the two panes because Chart.js
       stacks a group in the order its scales are DEFINED, bottom one first. */
    o.scales[lower.id + 'Gap'] = {
      type: 'linear', position: 'left', stack: 'ffCash',
      stackWeight: lower.gapWeight || 0.12, min: 0, max: 1,
      ticks: {display: false},
      grid: {display: false, drawTicks: false},
      border: {display: false}
    };
  }
  o.scales.y = {
    // Both bounds come from the fitter above, so the view the chart opens
    // on and the view it zooms to are sized by the same rule.
    min: start ? start.min : undefined,
    max: start ? start.max : undefined,
    stack: lower ? 'ffCash' : undefined,
    stackWeight: lower ? (lower.topWeight || 2) : undefined,
    title: {display: true, text: (opts.yTitle || 'Balance') + ', ' + moneyMode(res),
            color: t.muted, font: {size: 11}},
    ticks: {color: t.muted, font: {size: 11},
            maxTicksLimit: lower ? 7 : undefined, includeBounds: !lower,
            callback: function(v){ return fmt.currency(v, true); }},
    grid: {color: t.grid}
  };
  return o;
}

/* The swatch is read off the dataset the entry stands for, so the key shows
   the mark the chart actually draws: the deposited line is dotted in both, the
   range is a block, the crossing is a ring. `mark` names the dataset that
   carries the look when an entry toggles more than one (the band is a pair of
   datasets, only the second of which is filled). */
function renderLegend(elId, chart, items){
  var el = $(elId);
  el.innerHTML = '';
  items.forEach(function(item){
    var div = document.createElement('div');
    div.className = 'legend-item';
    var src = chart.data.datasets[item.mark == null ? item.datasets[0] : item.mark];
    SharedLegend.attach(div, SharedLegend.specOf(src, item.spec), item.label);
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
  var retIdx = Math.max(0, Math.round(res.P.ageRetire - res.P.ageNow));

  /* On the PATH chart an exhausted pot is drawn flat at zero rather than
     plunging. Going under there means one thing only — you are spending more
     than you earn, before you have even retired — and the line that records it
     is a balance compounding further into the red every month, which on a
     sixty-year axis squashes everything real into a sliver at the top.

     The cashflow balance is not floored: there, going under IS the answer the
     chart is being asked for, and the shortfall is the size of the miss. */
  var clipped = {path: false};
  var floorZero = function(arr, which){
    return arr.map(function(v){
      if(v == null || !isFinite(v)) return v;
      if(v < 0){ clipped[which] = true; return 0; }
      return v;
    });
  };

  /* ── SECTION 1 · Path to freedom ────────────────────────────────────────
     Three lines and a band, and not one of them knows what retirement age is
     on the slider. The pot needed falls with age because fewer years are left
     to fund; the investment climbs because it is never drawn on; where they
     meet is the answer. Putting a withdrawal on this chart was what used to
     make it unreadable, and worse, it drew a balance the crossing was not
     even solved against. */
  var acc = floorZero(scale(yearly(res.acc, years)), 'path');
  var dep = floorZero(scale(yearly(res.deposited, years)), 'path');
  var need = scale(res.needCurve);
  var p10 = floorZero(scale(res.mc.bands.p10), 'path');
  var p90 = floorZero(scale(res.mc.bands.p90), 'path');

  /* Where the chart OPENS. The crossing is the one thing this chart exists for
     and it lands in the first third of most plans, while the investment keeps
     compounding for decades afterwards: open on all sixty years and the answer
     is a sliver a pixel above the axis. So the view opens on the years that
     decide it, a few past the crossing, and the whole plan is one pinch away.
     With no crossing there is nothing to centre on, so it opens on everything,
     which is also the view that shows the two lines never meeting. */
  var view1 = years;
  if(res.ffAge != null){
    view1 = clamp(Math.ceil(res.ffAge - res.P.ageNow) + 8, Math.min(12, years), years);
  }

  /* Size the axis to the expected plan, not to the best of a thousand futures.
     Sixty years of compounding put the 90th percentile an order of magnitude
     above the crossing, and the crossing is what this chart is for. The band is
     allowed to run off the top; the subtitle says so when it does. Measured
     over the opening window, because that is the view the note describes. */
  var fit1 = makeYFit(y0, [acc, dep, need], [acc, dep, need, p10]);
  var start1 = fit1(y0, y0 + view1);
  var bandMax = 0;
  p90.forEach(function(v, i){ if(i <= view1 && v != null && isFinite(v) && v > bandMax) bandMax = v; });
  var bandClipped = !!start1 && bandMax > start1.max;

  /* The band is drawn by a PAIR of datasets — an invisible lower edge and an
     upper one filled down to it — but it is one thing on the chart, so it is
     one mark in the key and one mark against either row of the hover card.
     Left to the datasets, the lower edge would key as nothing at all. */
  var bandSpec = {type: 'area', fill: withAlpha(t.a, 0.16)};
  var ds1 = [
    {label:'Worst 10%', data: pts(p10, y0), borderColor: withAlpha(t.a, 0), backgroundColor:'transparent',
     borderWidth: 0, pointRadius: 0, fill: false, legendSpec: bandSpec},
    {label:'Best 10%', data: pts(p90, y0), borderColor: withAlpha(t.a, 0), backgroundColor: withAlpha(t.a, 0.16),
     borderWidth: 0, pointRadius: 0, fill: '-1', legendSpec: bandSpec},
    {label:'Money deposited', data: pts(dep, y0), borderColor: t.a, borderDash:[2,3],
     borderWidth: 1.8, pointRadius: 0, fill: false},
    {label:'Investment outcome', data: pts(acc, y0), borderColor: t.a, borderWidth: 2.4, pointRadius: 0, fill: false},
    {label:'Pot needed to stop here', data: pts(need, y0), borderColor: t.b, borderWidth: 2, pointRadius: 0, fill: false}
  ];
  var legend1 = [
    {label:'Pot needed to stop here', datasets:[4]},
    {label:'Investment outcome, never drawn on', datasets:[3]},
    {label:'Range of outcomes, worst 10% to best 10%', datasets:[0, 1], mark: 1},
    {label:'Money deposited, still in the pot', datasets:[2]}
  ];

  /* The crossing is the one thing this chart exists for, and it falls BETWEEN
     two yearly samples, so it is plotted as its own exact point rather than
     left for the eye to find. A dropline runs from the point to the floor of
     the chart; both share one legend entry, so hiding either hides both. */
  if(res.ffAge != null){
    var crossOffset = res.ffAge - res.P.ageNow;
    var crossNeed = requiredPot(res.P, res.ffAge);
    if(isFinite(crossNeed) && crossOffset <= years + 1e-9){
      var cx = y0 + crossOffset, cy = show(res, crossNeed, crossOffset);
      ds1.push({label:'Financially free', data:[{x: cx, y: 0}, {x: cx, y: cy}],
                borderColor: withAlpha(t.e, 0.55), borderWidth: 1.4, borderDash:[4,4],
                pointRadius: 0, fill: false, order: -1, ffTipHide: true});
      ds1.push({label:'Financially free', data:[{x: cx, y: cy}],
                borderColor: t.e, backgroundColor: t.panel, borderWidth: 3,
                pointRadius: 6, pointHoverRadius: 8, showLine: false, fill: false, order: -2});
      legend1.push({label:'Financially free at ' + fmt.age(res.ffAge),
                    datasets:[ds1.length - 2, ds1.length - 1], mark: ds1.length - 1});
    }
  }

  if(chart1) chart1.destroy();
  chart1 = new Chart($('ffChart').getContext('2d'), {
    type:'line',
    plugins:[Y_FIT_PLUGIN],
    data:{datasets: ds1},
    options: baseOptions(res, t, 'hover1', ageOf, y0, y0 + view1,
                         {fitY: fit1, limitMin: y0, limitMax: y0 + years})
  });
  chart1.$fitY = {y: fit1};
  renderLegend('legend1', chart1, legend1);

  var notes1 = [];
  if(bandClipped) notes1.push('The axis is sized to the expected outcome, so the best of the simulated futures runs off the top.');
  if(clipped.path) notes1.push('A balance below zero is drawn flat at zero: you are spending more than you earn, so the pot is being eaten before you have even retired.');
  $('chart1Sub').textContent = notes1.join(' ');

  /* ── Cashflows ──────────────────────────────────────────────────────────
     ONE chart, two plot areas stacked on one pair of x axes. Above, in two
     thirds of the height, income against spending with the gap filled: one
     colour where income covers the spending and the difference is saved,
     another where it does not and the difference has to come out of the pot.
     Below, in the remaining third, the balance they leave behind.

     A stock and a flow must not share a scale — a balance in the millions
     flattens a spending line in the tens of thousands into the axis — but they
     are one story, so they are two STACKED scales rather than two charts. A
     year then sits at the same x by construction: there is no second chart to
     keep in step, no zoom to mirror, and one hover card reads the flows and
     what they did to the pot together. */
  var income = scale(res.incomeCurve);
  var spend = scale(res.expenseCurve);
  /* The balance is plotted exactly as the engine leaves it, negative years and
     all. A pot that runs out does not politely stop at zero — it goes on
     owing, which is how the engine records by how much the plan missed — and
     a line drawn flat along the axis instead would be the one place on the
     page that hid the failure the table and the "Left at" card both report. */
  var bal = scale(yearly(res.det, years));
  var retLabel = 'Retire at ' + fmt.age(res.P.ageRetire);

  var fit2 = makeYFit(y0, [income, spend], [income, spend], {includeZero: true});
  var fit3 = makeYFit(y0, [bal], [bal], {includeZero: true, topPad: 2.2});

  /* A vertical rule at the year the two areas change sides, so the reader does
     not have to count years along the axis to find it. One per pane, drawn
     from the floor of that pane to its ceiling as the WHOLE plan sizes them:
     a zoomed-in window can only ever be narrower, so the rule spans its pane
     at every zoom and is clipped to it rather than falling short. */
  var paneSpan = function(fit){ return fit(y0, y0 + years) || {min: 0, max: 0}; };
  var retireLine = function(axisId, span){
    return {label: retLabel, yAxisID: axisId,
            data:[{x: y0 + retIdx, y: span.min}, {x: y0 + retIdx, y: span.max}],
            borderColor: withAlpha(t.e, 0.6), borderWidth: 1.4, borderDash:[4,4],
            pointRadius: 0, fill: false, order: -1, ffTipHide: true};
  };
  var marked = retIdx > 0 && retIdx < years;

  var ds2 = [
    {label:'Spending', data: pts(spend, y0), yAxisID:'y', borderColor: t.b, borderWidth: 2.2,
     pointRadius: 0, fill: false, order: 1},
    {label:'Income', data: pts(income, y0), yAxisID:'y', borderColor: t.c, borderWidth: 2.2,
     pointRadius: 0, order: 0,
     // `above` is where income runs above spending, so the gap is saved; the
     // other side is the gap the pot has to cover.
     fill: {target: 0, above: withAlpha(t.c, 0.28), below: withAlpha(t.b, 0.28)}},
    /* The pot is blue in the path chart, so it is blue here: the same money,
       seen from the other question. It must not be red, because red is already
       the spending and the gap the pot has to cover in the pane above. */
    {label:'Balance', data: pts(bal, y0), yAxisID:'yBal', borderColor: t.a, borderWidth: 2.2,
     pointRadius: 0, fill: 'origin', backgroundColor: withAlpha(t.a, 0.10), order: 3}
  ];
  /* One fill, one entry. The shaded gap is a single quantity — what income
     leaves over — and the two colours are its sign, so it reads as one swatch
     split down the middle rather than as two separate things to hide. */
  var legend2 = [
    {label:'Income', datasets:[1], spec:{fill: null}},
    {label:'Spending', datasets:[0]},
    /* The fill belongs to the income dataset but is not its line, so it is
       stated here as the block it is drawn as — in BOTH of its colours, which
       is what makes it one entry instead of two. */
    {label:'Savings/Withdrawal', datasets:[1],
     spec:{type:'area', width:0, fill: withAlpha(t.c, 0.28), fill2: withAlpha(t.b, 0.28)}},
    {label:'Balance, lower panel', datasets:[2]}
  ];
  if(marked){
    // One rule, drawn in both panes, so hiding it hides the whole line down
    // the picture rather than half of it.
    ds2.push(retireLine('y', paneSpan(fit2)));
    ds2.push(retireLine('yBal', paneSpan(fit3)));
    legend2.push({label: retLabel, datasets:[ds2.length - 2, ds2.length - 1]});
  }

  if(chart2) chart2.destroy();
  chart2 = new Chart($('ddChart').getContext('2d'), {
    type:'line',
    plugins:[Y_FIT_PLUGIN],
    data:{datasets: ds2},
    options: baseOptions(res, t, 'hover2', ageOf, y0, y0 + years,
                         {yTitle: 'A year', fitY: fit2,
                          lowerPane: {id: 'yBal', title: 'Balance', fitY: fit3,
                                      weight: 1, topWeight: 2}})
  });
  // Both panes are refitted to the x window on the same update, so a zoom
  // cannot leave one of them scaled for a view it is no longer showing.
  chart2.$fitY = {y: fit2, yBal: fit3};
  renderLegend('legend2', chart2, legend2);

  /* Only the two edge cases the picture cannot show for itself: at either end
     of the slider there is no crossing to read, so the chart looks like a
     mistake unless it is said. The ordinary case needs no caption. */
  var notes2 = [];
  if(res.P.ageRetire >= res.P.ageDie - 1e-9){
    notes2.push('The slider is at your life expectancy, so you never stop earning and nothing is ever drawn.');
  } else if(res.P.ageRetire <= res.P.ageNow + 1e-9){
    notes2.push('The slider is at your age now, so the drawdown starts today.');
  }
  var ranOut = bal.some(function(v){ return v != null && isFinite(v) && v < 0; });
  if(ranOut) notes2.push('The balance goes below zero and is drawn there: that is the shortfall, not a pause at nothing.');
  $('chart2Sub').textContent = notes2.join(' ');
}

/* ─── TABLE ─── */

/* One row per year, and the row is a cash flow statement that reconciles:

     Balance(y) + Saved(y) + Growth(y) = Balance(y+1)

   Balance is the balance AT that age, which is what the chart plots at that
   year; Income, Expense and Saved are the twelve months that follow it; and
   Growth is taken as the RESIDUAL, so the row adds up to the cent in whichever
   money is on screen. In today's money that residual is the real return on the
   pot. In the money of the day it is the nominal return, which is the same
   earnings plus the inflation uplift on the balance and on the year's flows —
   both true, and the subtitle says which one is showing.

   Everything the table and the CSV need is computed once here, so the two
   cannot drift apart. */
function tableRows(res){
  var years = res.years, y0 = res.thisYear;
  var retIdx = Math.max(0, Math.round(res.P.ageRetire - res.P.ageNow));
  var det = yearly(res.det, years);
  var balance = det.map(function(v, y){ return show(res, v, y); });
  var out = [], y;
  for(y = 0; y <= years; y++){
    var flow = res.flowCurve[y];
    var saved = flow == null ? null : show(res, flow, y);
    out.push({
      year: y0 + y,
      age: res.P.ageNow + y,
      balance: balance[y],
      /* Income, then expense, then what is left: the three read as one
         sentence, and Saved is the subtraction of the two beside it in every
         row. Expense is also the column that shows inflation doing its work
         once future's money is on. */
      income: show(res, res.incomeCurve[y], y),
      expense: show(res, res.expenseCurve[y], y),
      flow: saved,
      // No year after the last one, so there is no return to close it with.
      growth: saved == null ? null : balance[y + 1] - balance[y] - saved,
      /* The one row this table marks. Everything in this section is measured
         at the retirement age on the slider, so that is the row to find; the
         freedom age answers section 1's question and cannot be read off a
         table the slider redraws. */
      free: y === retIdx
    });
  }
  return out;
}

function renderTable(res){
  var rows = '';
  tableRows(res).forEach(function(r){
    rows += '<tr' + (r.free ? ' class="free"' : '') + '>' +
      '<td>' + r.year + '</td>' +
      '<td>' + fmt.age(r.age) + '</td>' +
      '<td class="' + (r.balance < 0 ? 'neg' : '') + '">' + fmt.currency(r.balance, true) + '</td>' +
      '<td>' + fmt.currency(r.income, true) + '</td>' +
      '<td>' + fmt.currency(r.expense, true) + '</td>' +
      '<td class="' + (r.flow != null && r.flow < 0 ? 'neg' : 'pos') + '">' +
        (r.flow == null ? '—' : fmt.currency(r.flow, true)) + '</td>' +
      '<td class="' + (r.growth == null ? '' : (r.growth >= 0 ? 'pos' : 'neg')) + '">' +
        (r.growth == null ? '—' : fmt.currency(r.growth, true)) + '</td>' +
      '</tr>';
  });
  $('tableWrap').innerHTML =
    '<table><thead><tr><th>Year</th><th>Age</th><th>Balance</th><th>Income</th><th>Expense</th>' +
    '<th>Saved / drawn</th><th>Growth</th></tr></thead><tbody>' + rows + '</tbody></table>';
  $('tableSub').innerHTML = 'In ' + moneyMode(res) + '.' +
    info('Balance is what the pot reads AT that age; Income, Expense and Saved are the twelve months that follow it. ' +
         (res.ui.savingsMode === 'income'
           ? 'Income is the net income you entered.'
           : 'You entered savings, so Income is what you save plus what you spend.') +
         ' Growth is the return that closes the year, taken as the residual. The highlighted row is the year you retire.');
}

/* ─── ASSUMPTIONS ─── */

function renderAssumptions(res){
  var swr = res.needAtRetire > 0 ? (res.P.Xr * 12 / res.needAtRetire * 100) : null;
  var items = [
    '<strong>No tax.</strong> Enter everything net of it.' +
      info('Tax differs too much between countries, and between an ordinary account and a pension wrapper, to model honestly in one tool.'),

    '<strong>Shown in ' + moneyMode(res) + '.</strong> Spending holds its value, so it rises with inflation.' +
      info('Future\u2019s money is what the account will actually read: the same plan times each year\'s inflation factor. Show Present Value strips it back out.'),

    '<strong>Inflation is ' + fmt.pct(res.ui.inflation, 1) + ' a year</strong> and applies to every year, working or retired.' +
      info('Living costs, the pot needed and the pension all rise with it, and the return is discounted by it (Fisher, not subtraction). The Expense column below is that rise, year by year.'),

    '<strong>The two sections are two different questions.</strong> Path to freedom never withdraws; Cashflows always does.' +
      info('Path to freedom keeps paying in and compares the result with the pot each age would need. Cashflows stops at the age on the slider and draws down. Moving the slider cannot change the freedom age.'),

    '<strong>Your FIRE number</strong> implies a ' + (swr == null ? 'n/a' : fmt.pct(swr, 2)) + ' SWR.' +
      info('The share of the pot you spend in the first year. The familiar 25 times rule is the same arithmetic at a 4% real return.'),

    '<strong>The shaded band is not a path.</strong>' +
      info('The 10th to 90th percentile across ' + fmt.num(res.mc.paths) + ' simulated futures at each year separately, so its edges are an envelope rather than one future you could live through. At 0% volatility they collapse onto the single smooth projection.'),

    '<strong>Money deposited is what you put in that is still there.</strong>' +
      info('Nothing is withdrawn on that chart, so it is every cent you have paid in, held down by the balance in the years a bad market has the pot below it. The gap to the investment line is the growth.'),

    '<strong>The year-by-year table reconciles.</strong> Balance plus Saved plus Growth is next year\u2019s Balance, to the cent.' +
      info('Growth is whatever is left over once the flows are accounted for. In today\u2019s money that is the real return; in future\u2019s money, the nominal one.'),

    (res.ui.savingsMode === 'income'
      ? '<strong>Income is what you entered</strong>, and what you save is whatever it leaves over.' +
        info('Income grows at the rate on the You tab, spending rises with inflation. Once you retire the only income is the pension, if you included one.')
      : '<strong>Income is implied, not entered.</strong> It is what you save plus what you spend.' +
        info('You entered savings, so the income shown is the take-home pay that saving that much while spending that much implies. Switch to Net income on the You tab to enter it directly.')),

    '<strong>Not modelled:</strong> one-off costs, a mortgage ending, aged care, or any spending change beyond the retirement percentage.'
  ];
  if(res.ui.pensionOn){
    items.splice(3, 0, (res.P.pensionIndexed
      ? '<strong>The pension rises with inflation</strong>, so it keeps its value for ever.'
      : '<strong>The pension never rises</strong>, so it buys less every year.') +
      info(res.P.pensionIndexed
        ? 'A flat line in today\u2019s money and a rising figure in the money of the day. It starts at age ' + fmt.age(res.P.pensionStartAge) + ' and counts as income from then on, which is why it lowers the pot you need.'
        : 'A flat figure in the money of the day and a sinking one in today\u2019s money. The erosion is measured from TODAY, not from the start age, because the amount you entered is what it pays now — so the years before you claim it wear it down too. Turn on "Rises with inflation" if your country indexes its pension.'));
  }
  if(res.ui.mode === 'rich'){
    items.splice(3, 0, '<strong>Forever is tested to age ' + RICH_HORIZON_AGE + '.</strong>' +
      info('At the required pot the balance holds its real value, so a longer horizon would not change the answer.'));
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
    syncForm();
    markFresh();
    var res = compute(UI);
    last = res;
    renderInflationNote(res);
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

/* ── The Simulate gate ──────────────────────────────────────────────────────
   A thousand simulated futures cost about 150ms, and the control goes to five
   thousand, so a page that recomputed itself as you type would stutter for a
   sixth of a second after every pause — longer on a phone — and would do it
   while the plan on screen is still half-entered. So typing does not run the
   engine. It keeps the FORM coherent, which is cheap and has to stay live:
   currency prefixes follow the currency, the retirement slider's ends follow
   the two ages, and the goal you pick decides which fields are even shown.
   What it does not do is pretend the answer below has kept up. The results are
   marked out of date instead, and Simulate is what runs them. */
function syncForm(){
  readInputs();
  syncCurrencyPrefixes();
  syncVisibility();
}

function markStale(){
  syncForm();
  if(stale) return;
  stale = true;
  document.body.classList.add('is-stale');
  var b = $('simBtn');
  if(b) b.classList.add('needs-run');
}

function markFresh(){
  if(!stale) return;
  stale = false;
  document.body.classList.remove('is-stale');
  var b = $('simBtn');
  if(b) b.classList.remove('needs-run');
}

/* Swap a button's label for a moment to confirm something happened. Restores
   whatever was there, so a second press mid-flash cannot strand the label. */
function flashBtn(btn, label){
  if(!btn) return;
  if(btn._flashTimer){ clearTimeout(btn._flashTimer); }
  else { btn._flashLabel = btn.textContent; }
  btn.textContent = label;
  btn._flashTimer = setTimeout(function(){
    btn.textContent = btn._flashLabel;
    btn._flashTimer = null;
  }, 900);
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
    tickerInfo = {ticker: tk, stats: st, source: slice.source};
    tickerStatus('<strong>' + escapeHtml(tk) + '</strong> over ' + fmt.num(st.years, 1) + ' years: ' +
      fmt.pct(st.cagr, 1) + ' a year, ' + fmt.pct(st.std, 1) + ' volatility.' +
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

/* ─── EXPORT ─── */

/* The exports match the DCA simulator's: a 3x PNG, an SVG wrapping that bitmap
   with live text around it, and a CSV of exactly what the table shows. Title
   and legend are drawn on, because a chart leaving the page has to carry its
   own labels. */
var WM_LOGO_SRC = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDY4MCA2ODAiIHJvbGU9ImltZyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8dGl0bGU+QXJjaGVkIEEgTG9nbzwvdGl0bGU+CiAgPGRlc2M+QSBzbGVlayB3aGl0ZSBsZXR0ZXIgQSB3aG9zZSBsZWdzIGZvbGxvdyB0aGUgY2lyY2xlIGN1cnZhdHVyZSwgc3Bhbm5pbmcgODAlIG9mIHRoZSBjaXJjbGUgaGVpZ2h0PC9kZXNjPgoKICA8Y2lyY2xlIGN4PSIzNDAiIGN5PSIzNDAiIHI9IjMwMCIgZmlsbD0iIzAwNTJjYyIvPgoKICA8IS0tIExlZnQgbGVnOiAxMTPCsCB0byAyNDXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyNDIsNTcwIEEgMjUwLDI1MCAwIDAgMSAyMzQsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFRvcCBhcmNoOiAyNDXCsCB0byAyOTXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyMzQsMTEzIEEgMjUwLDI1MCAwIDAgMSA0NDYsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFJpZ2h0IGxlZzogMjk1wrAgdG8gNjfCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSA0NDYsMTEzIEEgMjUwLDI1MCAwIDAgMSA0MzgsNTcwIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIENyb3NzYmFyIC0tPgogIDxsaW5lIHgxPSIxMTMiIHkxPSIzNTQiIHgyPSI1NjciIHkyPSIzNTQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNDIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K';
// Watermark wordmark ("Made using tool.adjiebrotots.com/financialfreedom") baked to DM Sans 500 glyph
// outlines by _ref/bake-watermark.py. Edit there + re-run, not here.
var WM_PATH = "M0.82 0V-7.7H2.12L4.66 -2.48L7.19 -7.7H8.49V0H7.39V-5.76L5.08 -1.04H4.24L1.92 -5.74V0ZM11.9 0.13Q11.24 0.13 10.79 -0.11Q10.35 -0.35 10.13 -0.75Q9.91 -1.15 9.91 -1.62Q9.91 -2.17 10.19 -2.56Q10.47 -2.96 11 -3.17Q11.53 -3.38 12.26 -3.38H13.68Q13.68 -3.89 13.55 -4.23Q13.43 -4.57 13.15 -4.74Q12.87 -4.9 12.42 -4.9Q11.94 -4.9 11.61 -4.68Q11.27 -4.45 11.19 -4H10.09Q10.15 -4.58 10.48 -4.98Q10.8 -5.39 11.31 -5.6Q11.82 -5.82 12.42 -5.82Q13.2 -5.82 13.73 -5.54Q14.25 -5.27 14.52 -4.77Q14.78 -4.27 14.78 -3.58V0H13.82L13.73 -0.94Q13.62 -0.72 13.45 -0.52Q13.28 -0.33 13.05 -0.18Q12.83 -0.03 12.54 0.05Q12.25 0.13 11.9 0.13ZM12.11 -0.76Q12.45 -0.76 12.73 -0.91Q13.01 -1.05 13.22 -1.31Q13.42 -1.56 13.54 -1.87Q13.65 -2.19 13.66 -2.54V-2.6H12.37Q11.9 -2.6 11.61 -2.49Q11.32 -2.37 11.19 -2.16Q11.06 -1.95 11.06 -1.69Q11.06 -1.4 11.19 -1.2Q11.31 -0.99 11.55 -0.88Q11.78 -0.76 12.11 -0.76ZM18.67 0.13Q17.9 0.13 17.3 -0.25Q16.71 -0.64 16.38 -1.31Q16.05 -1.99 16.05 -2.84Q16.05 -3.71 16.38 -4.38Q16.72 -5.05 17.32 -5.43Q17.92 -5.82 18.71 -5.82Q19.35 -5.82 19.83 -5.56Q20.31 -5.31 20.59 -4.84V-7.92H21.69V0H20.7L20.6 -0.87Q20.43 -0.61 20.17 -0.38Q19.91 -0.15 19.54 -0.01Q19.17 0.13 18.67 0.13ZM18.87 -0.82Q19.39 -0.82 19.77 -1.07Q20.16 -1.32 20.37 -1.78Q20.58 -2.23 20.58 -2.84Q20.58 -3.46 20.37 -3.91Q20.16 -4.37 19.77 -4.61Q19.39 -4.86 18.87 -4.86Q18.38 -4.86 18 -4.61Q17.61 -4.37 17.39 -3.91Q17.17 -3.46 17.17 -2.85Q17.17 -2.23 17.39 -1.78Q17.61 -1.32 18 -1.07Q18.38 -0.82 18.87 -0.82ZM25.7 0.13Q24.91 0.13 24.3 -0.24Q23.69 -0.61 23.35 -1.27Q23 -1.94 23 -2.83Q23 -3.72 23.34 -4.4Q23.68 -5.07 24.3 -5.44Q24.91 -5.82 25.71 -5.82Q26.55 -5.82 27.12 -5.45Q27.7 -5.08 28.01 -4.46Q28.31 -3.84 28.31 -3.09Q28.31 -2.98 28.31 -2.86Q28.31 -2.74 28.3 -2.59H23.81V-3.36H27.22Q27.2 -4.1 26.77 -4.5Q26.34 -4.91 25.7 -4.91Q25.26 -4.91 24.89 -4.7Q24.53 -4.49 24.3 -4.08Q24.08 -3.67 24.08 -3.05V-2.74Q24.08 -2.11 24.3 -1.67Q24.52 -1.23 24.88 -1.01Q25.25 -0.78 25.69 -0.78Q26.24 -0.78 26.57 -1Q26.9 -1.22 27.05 -1.61H28.16Q28.01 -1.11 27.68 -0.72Q27.34 -0.32 26.84 -0.1Q26.34 0.13 25.7 0.13ZM34.49 0.13Q33.84 0.13 33.36 -0.12Q32.89 -0.37 32.63 -0.88Q32.37 -1.4 32.37 -2.16V-5.69H33.47V-2.29Q33.47 -1.54 33.81 -1.17Q34.16 -0.8 34.78 -0.8Q35.2 -0.8 35.54 -1Q35.87 -1.19 36.07 -1.56Q36.27 -1.94 36.27 -2.48V-5.69H37.37V0H36.39L36.31 -0.92Q36.08 -0.43 35.6 -0.15Q35.12 0.13 34.49 0.13ZM41.04 0.13Q40.28 0.13 39.75 -0.11Q39.22 -0.34 38.94 -0.77Q38.66 -1.19 38.6 -1.75H39.72Q39.76 -1.48 39.92 -1.26Q40.07 -1.03 40.35 -0.9Q40.63 -0.76 41.04 -0.76Q41.4 -0.76 41.64 -0.87Q41.88 -0.97 42 -1.16Q42.12 -1.34 42.12 -1.58Q42.12 -1.9 41.97 -2.07Q41.82 -2.25 41.53 -2.35Q41.24 -2.44 40.82 -2.5Q40.37 -2.58 40 -2.69Q39.63 -2.81 39.36 -3Q39.08 -3.19 38.94 -3.48Q38.79 -3.77 38.79 -4.17Q38.79 -4.65 39.04 -5.02Q39.3 -5.4 39.78 -5.61Q40.26 -5.82 40.91 -5.82Q41.87 -5.82 42.42 -5.38Q42.98 -4.95 43.08 -4.16H42.02Q41.96 -4.52 41.67 -4.72Q41.38 -4.92 40.9 -4.92Q40.4 -4.92 40.14 -4.74Q39.88 -4.55 39.88 -4.24Q39.88 -4.02 40.01 -3.85Q40.14 -3.68 40.42 -3.56Q40.71 -3.44 41.17 -3.37Q41.82 -3.27 42.28 -3.1Q42.74 -2.93 42.99 -2.59Q43.25 -2.26 43.24 -1.66Q43.24 -1.1 42.97 -0.7Q42.69 -0.3 42.2 -0.08Q41.71 0.13 41.04 0.13ZM44.65 0V-5.69H45.75V0ZM45.2 -6.69Q44.89 -6.69 44.68 -6.89Q44.48 -7.09 44.48 -7.39Q44.48 -7.69 44.68 -7.88Q44.89 -8.07 45.2 -8.07Q45.51 -8.07 45.72 -7.88Q45.93 -7.69 45.93 -7.39Q45.93 -7.09 45.72 -6.89Q45.51 -6.69 45.2 -6.69ZM47.35 0V-5.69H48.33L48.4 -4.77Q48.65 -5.26 49.13 -5.54Q49.61 -5.82 50.24 -5.82Q50.89 -5.82 51.37 -5.56Q51.84 -5.31 52.1 -4.79Q52.36 -4.28 52.36 -3.51V0H51.26V-3.4Q51.26 -4.13 50.91 -4.51Q50.57 -4.88 49.94 -4.88Q49.53 -4.88 49.19 -4.69Q48.85 -4.49 48.65 -4.12Q48.45 -3.74 48.45 -3.2V0ZM56.14 2.55Q55.35 2.55 54.77 2.36Q54.18 2.17 53.85 1.77Q53.53 1.38 53.53 0.8Q53.53 0.49 53.66 0.18Q53.8 -0.13 54.09 -0.41Q54.39 -0.68 54.89 -0.9L55.55 -0.41Q54.96 -0.19 54.77 0.1Q54.57 0.4 54.57 0.69Q54.57 1.02 54.77 1.24Q54.97 1.46 55.32 1.57Q55.67 1.68 56.13 1.68Q56.58 1.68 56.91 1.56Q57.23 1.45 57.41 1.23Q57.59 1.01 57.59 0.72Q57.59 0.32 57.32 0.08Q57.06 -0.15 56.27 -0.19Q55.64 -0.24 55.19 -0.32Q54.75 -0.4 54.45 -0.5Q54.14 -0.61 53.94 -0.75Q53.73 -0.88 53.58 -1.02V-1.28L54.7 -2.39L55.62 -2.09L54.38 -0.99L54.61 -1.5Q54.73 -1.42 54.84 -1.35Q54.96 -1.28 55.15 -1.22Q55.33 -1.16 55.66 -1.11Q55.99 -1.06 56.52 -1.02Q57.29 -0.96 57.75 -0.76Q58.22 -0.55 58.43 -0.19Q58.64 0.17 58.64 0.68Q58.64 1.16 58.38 1.58Q58.12 2.01 57.56 2.28Q57.01 2.55 56.14 2.55ZM56.13 -1.75Q55.43 -1.75 54.94 -2.01Q54.45 -2.28 54.19 -2.75Q53.93 -3.21 53.93 -3.78Q53.93 -4.36 54.19 -4.81Q54.45 -5.27 54.94 -5.55Q55.44 -5.82 56.13 -5.82Q56.84 -5.82 57.33 -5.55Q57.82 -5.27 58.08 -4.81Q58.33 -4.36 58.33 -3.78Q58.33 -3.21 58.08 -2.75Q57.82 -2.28 57.33 -2.01Q56.84 -1.75 56.13 -1.75ZM56.13 -2.62Q56.69 -2.62 57 -2.91Q57.32 -3.2 57.32 -3.78Q57.32 -4.35 57 -4.64Q56.69 -4.93 56.13 -4.93Q55.6 -4.93 55.26 -4.64Q54.93 -4.35 54.93 -3.78Q54.93 -3.2 55.25 -2.91Q55.58 -2.62 56.13 -2.62ZM57.08 -4.82 56.81 -5.69H59.08V-4.94ZM65.36 0Q64.84 0 64.45 -0.16Q64.06 -0.33 63.85 -0.71Q63.65 -1.1 63.65 -1.76V-4.76H62.66V-5.69H63.65L63.78 -7.14H64.75V-5.69H66.33V-4.76H64.75V-1.75Q64.75 -1.28 64.94 -1.11Q65.14 -0.94 65.62 -0.94H66.3V0ZM70.12 0.13Q69.32 0.13 68.7 -0.24Q68.08 -0.61 67.73 -1.28Q67.38 -1.95 67.38 -2.84Q67.38 -3.74 67.73 -4.41Q68.08 -5.08 68.71 -5.45Q69.34 -5.82 70.13 -5.82Q70.94 -5.82 71.56 -5.45Q72.18 -5.08 72.53 -4.41Q72.88 -3.74 72.88 -2.84Q72.88 -1.95 72.53 -1.28Q72.17 -0.61 71.55 -0.24Q70.93 0.13 70.12 0.13ZM70.12 -0.81Q70.58 -0.81 70.95 -1.04Q71.32 -1.27 71.54 -1.72Q71.76 -2.17 71.76 -2.84Q71.76 -3.52 71.54 -3.97Q71.33 -4.42 70.96 -4.65Q70.59 -4.87 70.14 -4.87Q69.69 -4.87 69.31 -4.65Q68.94 -4.42 68.72 -3.97Q68.5 -3.52 68.5 -2.84Q68.5 -2.17 68.72 -1.72Q68.94 -1.27 69.3 -1.04Q69.67 -0.81 70.12 -0.81ZM76.73 0.13Q75.93 0.13 75.31 -0.24Q74.69 -0.61 74.34 -1.28Q73.99 -1.95 73.99 -2.84Q73.99 -3.74 74.34 -4.41Q74.7 -5.08 75.32 -5.45Q75.95 -5.82 76.75 -5.82Q77.55 -5.82 78.17 -5.45Q78.79 -5.08 79.14 -4.41Q79.49 -3.74 79.49 -2.84Q79.49 -1.95 79.14 -1.28Q78.78 -0.61 78.16 -0.24Q77.54 0.13 76.73 0.13ZM76.73 -0.81Q77.19 -0.81 77.56 -1.04Q77.93 -1.27 78.15 -1.72Q78.37 -2.17 78.37 -2.84Q78.37 -3.52 78.15 -3.97Q77.94 -4.42 77.57 -4.65Q77.21 -4.87 76.75 -4.87Q76.3 -4.87 75.93 -4.65Q75.55 -4.42 75.33 -3.97Q75.11 -3.52 75.11 -2.84Q75.11 -2.17 75.33 -1.72Q75.55 -1.27 75.91 -1.04Q76.28 -0.81 76.73 -0.81ZM80.81 0V-7.92H81.91V0ZM83.9 0.05Q83.59 0.05 83.39 -0.15Q83.18 -0.35 83.18 -0.64Q83.18 -0.94 83.39 -1.14Q83.59 -1.34 83.9 -1.34Q84.22 -1.34 84.42 -1.14Q84.62 -0.94 84.62 -0.64Q84.62 -0.35 84.42 -0.15Q84.22 0.05 83.9 0.05ZM87.71 0.13Q87.04 0.13 86.59 -0.11Q86.15 -0.35 85.93 -0.75Q85.71 -1.15 85.71 -1.62Q85.71 -2.17 85.99 -2.56Q86.27 -2.96 86.8 -3.17Q87.33 -3.38 88.06 -3.38H89.48Q89.48 -3.89 89.35 -4.23Q89.23 -4.57 88.95 -4.74Q88.67 -4.9 88.22 -4.9Q87.74 -4.9 87.41 -4.68Q87.07 -4.45 86.99 -4H85.89Q85.95 -4.58 86.28 -4.98Q86.6 -5.39 87.11 -5.6Q87.62 -5.82 88.22 -5.82Q89 -5.82 89.53 -5.54Q90.05 -5.27 90.32 -4.77Q90.58 -4.27 90.58 -3.58V0H89.62L89.53 -0.94Q89.42 -0.72 89.25 -0.52Q89.08 -0.33 88.85 -0.18Q88.63 -0.03 88.34 0.05Q88.05 0.13 87.71 0.13ZM87.91 -0.76Q88.25 -0.76 88.53 -0.91Q88.81 -1.05 89.02 -1.31Q89.23 -1.56 89.34 -1.87Q89.45 -2.19 89.46 -2.54V-2.6H88.17Q87.7 -2.6 87.41 -2.49Q87.12 -2.37 86.99 -2.16Q86.87 -1.95 86.87 -1.69Q86.87 -1.4 86.99 -1.2Q87.11 -0.99 87.35 -0.88Q87.58 -0.76 87.91 -0.76ZM94.47 0.13Q93.7 0.13 93.1 -0.25Q92.51 -0.64 92.18 -1.31Q91.85 -1.99 91.85 -2.84Q91.85 -3.71 92.18 -4.38Q92.52 -5.05 93.12 -5.43Q93.72 -5.82 94.51 -5.82Q95.15 -5.82 95.63 -5.56Q96.11 -5.31 96.39 -4.84V-7.92H97.49V0H96.5L96.4 -0.87Q96.23 -0.61 95.97 -0.38Q95.71 -0.15 95.34 -0.01Q94.97 0.13 94.47 0.13ZM94.67 -0.82Q95.19 -0.82 95.57 -1.07Q95.96 -1.32 96.17 -1.78Q96.38 -2.23 96.38 -2.84Q96.38 -3.46 96.17 -3.91Q95.96 -4.37 95.57 -4.61Q95.19 -4.86 94.67 -4.86Q94.18 -4.86 93.8 -4.61Q93.41 -4.37 93.19 -3.91Q92.97 -3.46 92.97 -2.85Q92.97 -2.23 93.19 -1.78Q93.41 -1.32 93.8 -1.07Q94.18 -0.82 94.67 -0.82ZM97.96 2.42V1.48H98.39Q98.79 1.48 98.96 1.32Q99.12 1.16 99.12 0.77V-5.69H100.22V0.79Q100.22 1.37 100.03 1.73Q99.83 2.08 99.46 2.25Q99.09 2.42 98.56 2.42ZM99.68 -6.69Q99.37 -6.69 99.16 -6.89Q98.96 -7.09 98.96 -7.39Q98.96 -7.69 99.16 -7.88Q99.37 -8.07 99.68 -8.07Q99.99 -8.07 100.2 -7.88Q100.4 -7.69 100.4 -7.39Q100.4 -7.09 100.2 -6.89Q99.99 -6.69 99.68 -6.69ZM101.88 0V-5.69H102.98V0ZM102.44 -6.69Q102.12 -6.69 101.92 -6.89Q101.71 -7.09 101.71 -7.39Q101.71 -7.69 101.92 -7.88Q102.12 -8.07 102.44 -8.07Q102.74 -8.07 102.95 -7.88Q103.16 -7.69 103.16 -7.39Q103.16 -7.09 102.95 -6.89Q102.74 -6.69 102.44 -6.69ZM107.06 0.13Q106.27 0.13 105.66 -0.24Q105.06 -0.61 104.71 -1.27Q104.37 -1.94 104.37 -2.83Q104.37 -3.72 104.71 -4.4Q105.05 -5.07 105.66 -5.44Q106.28 -5.82 107.08 -5.82Q107.91 -5.82 108.49 -5.45Q109.07 -5.08 109.37 -4.46Q109.68 -3.84 109.68 -3.09Q109.68 -2.98 109.68 -2.86Q109.68 -2.74 109.66 -2.59H105.18V-3.36H108.59Q108.56 -4.1 108.13 -4.5Q107.71 -4.91 107.07 -4.91Q106.63 -4.91 106.26 -4.7Q105.89 -4.49 105.67 -4.08Q105.45 -3.67 105.45 -3.05V-2.74Q105.45 -2.11 105.67 -1.67Q105.89 -1.23 106.25 -1.01Q106.62 -0.78 107.06 -0.78Q107.61 -0.78 107.94 -1Q108.26 -1.22 108.42 -1.61H109.52Q109.38 -1.11 109.05 -0.72Q108.71 -0.32 108.21 -0.1Q107.71 0.13 107.06 0.13ZM113.95 0.13Q113.46 0.13 113.09 -0.01Q112.73 -0.15 112.47 -0.37Q112.2 -0.6 112.04 -0.84L111.93 0H110.94V-7.92H112.04V-4.82Q112.31 -5.29 112.8 -5.55Q113.29 -5.82 113.93 -5.82Q114.72 -5.82 115.32 -5.44Q115.92 -5.05 116.25 -4.39Q116.58 -3.72 116.58 -2.86Q116.58 -2 116.25 -1.32Q115.92 -0.64 115.33 -0.26Q114.74 0.13 113.95 0.13ZM113.76 -0.82Q114.25 -0.82 114.63 -1.07Q115.02 -1.32 115.24 -1.77Q115.46 -2.23 115.46 -2.84Q115.46 -3.46 115.24 -3.91Q115.02 -4.37 114.63 -4.61Q114.25 -4.86 113.76 -4.86Q113.25 -4.86 112.86 -4.61Q112.47 -4.37 112.26 -3.91Q112.05 -3.46 112.05 -2.84Q112.05 -2.23 112.26 -1.77Q112.47 -1.32 112.86 -1.07Q113.25 -0.82 113.76 -0.82ZM117.9 0V-5.69H118.89L118.98 -4.65Q119.18 -5.03 119.49 -5.29Q119.8 -5.55 120.24 -5.68Q120.67 -5.82 121.2 -5.82V-4.66H120.66Q120.33 -4.66 120.03 -4.58Q119.74 -4.5 119.5 -4.3Q119.27 -4.11 119.14 -3.79Q119 -3.46 119 -2.96V0ZM124.78 0.13Q123.98 0.13 123.36 -0.24Q122.73 -0.61 122.38 -1.28Q122.03 -1.95 122.03 -2.84Q122.03 -3.74 122.39 -4.41Q122.74 -5.08 123.37 -5.45Q124 -5.82 124.79 -5.82Q125.6 -5.82 126.22 -5.45Q126.84 -5.08 127.19 -4.41Q127.54 -3.74 127.54 -2.84Q127.54 -1.95 127.18 -1.28Q126.83 -0.61 126.21 -0.24Q125.58 0.13 124.78 0.13ZM124.78 -0.81Q125.24 -0.81 125.61 -1.04Q125.98 -1.27 126.2 -1.72Q126.41 -2.17 126.41 -2.84Q126.41 -3.52 126.2 -3.97Q125.99 -4.42 125.62 -4.65Q125.25 -4.87 124.79 -4.87Q124.35 -4.87 123.97 -4.65Q123.6 -4.42 123.38 -3.97Q123.16 -3.52 123.16 -2.84Q123.16 -2.17 123.38 -1.72Q123.59 -1.27 123.96 -1.04Q124.33 -0.81 124.78 -0.81ZM131.18 0Q130.66 0 130.27 -0.16Q129.89 -0.33 129.68 -0.71Q129.47 -1.1 129.47 -1.76V-4.76H128.48V-5.69H129.47L129.61 -7.14H130.57V-5.69H132.15V-4.76H130.57V-1.75Q130.57 -1.28 130.77 -1.11Q130.96 -0.94 131.45 -0.94H132.13V0ZM135.94 0.13Q135.14 0.13 134.52 -0.24Q133.9 -0.61 133.55 -1.28Q133.2 -1.95 133.2 -2.84Q133.2 -3.74 133.55 -4.41Q133.91 -5.08 134.53 -5.45Q135.16 -5.82 135.96 -5.82Q136.77 -5.82 137.39 -5.45Q138 -5.08 138.35 -4.41Q138.7 -3.74 138.7 -2.84Q138.7 -1.95 138.35 -1.28Q137.99 -0.61 137.37 -0.24Q136.75 0.13 135.94 0.13ZM135.94 -0.81Q136.4 -0.81 136.77 -1.04Q137.14 -1.27 137.36 -1.72Q137.58 -2.17 137.58 -2.84Q137.58 -3.52 137.37 -3.97Q137.15 -4.42 136.79 -4.65Q136.42 -4.87 135.96 -4.87Q135.51 -4.87 135.14 -4.65Q134.77 -4.42 134.54 -3.97Q134.32 -3.52 134.32 -2.84Q134.32 -2.17 134.54 -1.72Q134.76 -1.27 135.13 -1.04Q135.49 -0.81 135.94 -0.81ZM142.35 0Q141.82 0 141.44 -0.16Q141.05 -0.33 140.84 -0.71Q140.64 -1.1 140.64 -1.76V-4.76H139.65V-5.69H140.64L140.77 -7.14H141.74V-5.69H143.32V-4.76H141.74V-1.75Q141.74 -1.28 141.93 -1.11Q142.13 -0.94 142.61 -0.94H143.29V0ZM146.72 0.13Q145.95 0.13 145.43 -0.11Q144.9 -0.34 144.62 -0.77Q144.34 -1.19 144.28 -1.75H145.39Q145.44 -1.48 145.59 -1.26Q145.75 -1.03 146.03 -0.9Q146.31 -0.76 146.72 -0.76Q147.07 -0.76 147.31 -0.87Q147.55 -0.97 147.68 -1.16Q147.8 -1.34 147.8 -1.58Q147.8 -1.9 147.65 -2.07Q147.5 -2.25 147.21 -2.35Q146.92 -2.44 146.5 -2.5Q146.05 -2.58 145.68 -2.69Q145.31 -2.81 145.03 -3Q144.76 -3.19 144.61 -3.48Q144.46 -3.77 144.46 -4.17Q144.46 -4.65 144.72 -5.02Q144.98 -5.4 145.46 -5.61Q145.93 -5.82 146.59 -5.82Q147.54 -5.82 148.1 -5.38Q148.66 -4.95 148.76 -4.16H147.7Q147.64 -4.52 147.35 -4.72Q147.06 -4.92 146.58 -4.92Q146.08 -4.92 145.82 -4.74Q145.56 -4.55 145.56 -4.24Q145.56 -4.02 145.68 -3.85Q145.81 -3.68 146.1 -3.56Q146.39 -3.44 146.85 -3.37Q147.49 -3.27 147.96 -3.1Q148.42 -2.93 148.67 -2.59Q148.92 -2.26 148.92 -1.66Q148.92 -1.1 148.64 -0.7Q148.37 -0.3 147.88 -0.08Q147.39 0.13 146.72 0.13ZM150.72 0.05Q150.4 0.05 150.2 -0.15Q150 -0.35 150 -0.64Q150 -0.94 150.2 -1.14Q150.4 -1.34 150.72 -1.34Q151.04 -1.34 151.23 -1.14Q151.43 -0.94 151.43 -0.64Q151.43 -0.35 151.23 -0.15Q151.04 0.05 150.72 0.05ZM155.25 0.13Q154.45 0.13 153.82 -0.24Q153.19 -0.62 152.84 -1.29Q152.48 -1.95 152.48 -2.83Q152.48 -3.73 152.84 -4.4Q153.19 -5.07 153.82 -5.44Q154.45 -5.82 155.25 -5.82Q156.27 -5.82 156.95 -5.28Q157.63 -4.75 157.82 -3.83H156.68Q156.57 -4.33 156.17 -4.6Q155.78 -4.88 155.24 -4.88Q154.78 -4.88 154.4 -4.64Q154.03 -4.41 153.82 -3.96Q153.61 -3.51 153.61 -2.84Q153.61 -2.35 153.73 -1.97Q153.85 -1.58 154.07 -1.32Q154.29 -1.07 154.59 -0.93Q154.89 -0.8 155.24 -0.8Q155.6 -0.8 155.9 -0.92Q156.19 -1.05 156.4 -1.29Q156.61 -1.53 156.68 -1.86H157.82Q157.64 -0.96 156.95 -0.41Q156.26 0.13 155.25 0.13ZM161.67 0.13Q160.87 0.13 160.25 -0.24Q159.63 -0.61 159.28 -1.28Q158.93 -1.95 158.93 -2.84Q158.93 -3.74 159.28 -4.41Q159.64 -5.08 160.26 -5.45Q160.89 -5.82 161.69 -5.82Q162.5 -5.82 163.11 -5.45Q163.73 -5.08 164.08 -4.41Q164.43 -3.74 164.43 -2.84Q164.43 -1.95 164.08 -1.28Q163.72 -0.61 163.1 -0.24Q162.48 0.13 161.67 0.13ZM161.67 -0.81Q162.13 -0.81 162.5 -1.04Q162.87 -1.27 163.09 -1.72Q163.31 -2.17 163.31 -2.84Q163.31 -3.52 163.1 -3.97Q162.88 -4.42 162.52 -4.65Q162.15 -4.87 161.69 -4.87Q161.24 -4.87 160.87 -4.65Q160.49 -4.42 160.27 -3.97Q160.05 -3.52 160.05 -2.84Q160.05 -2.17 160.27 -1.72Q160.49 -1.27 160.86 -1.04Q161.22 -0.81 161.67 -0.81ZM165.75 0V-5.69H166.74L166.81 -4.91Q167.07 -5.33 167.52 -5.58Q167.96 -5.82 168.49 -5.82Q168.9 -5.82 169.24 -5.71Q169.57 -5.59 169.83 -5.37Q170.08 -5.14 170.24 -4.8Q170.54 -5.29 171.03 -5.55Q171.52 -5.82 172.08 -5.82Q172.74 -5.82 173.21 -5.56Q173.68 -5.3 173.92 -4.78Q174.17 -4.27 174.17 -3.5V0H173.08V-3.39Q173.08 -4.13 172.77 -4.51Q172.45 -4.88 171.88 -4.88Q171.49 -4.88 171.18 -4.68Q170.87 -4.49 170.69 -4.1Q170.51 -3.72 170.51 -3.17V0H169.42V-3.39Q169.42 -4.13 169.1 -4.51Q168.78 -4.88 168.21 -4.88Q167.84 -4.88 167.53 -4.68Q167.22 -4.49 167.04 -4.1Q166.85 -3.72 166.85 -3.17V0ZM175.19 1.11 177.95 -8.46H179.02L176.27 1.11ZM180.42 0V-6.29Q180.42 -6.87 180.62 -7.23Q180.81 -7.58 181.18 -7.75Q181.56 -7.92 182.09 -7.92H182.86V-6.98H182.26Q181.86 -6.98 181.69 -6.82Q181.52 -6.66 181.52 -6.27V0ZM179.57 -4.76V-5.69H182.94V-4.76ZM184.16 0V-5.69H185.26V0ZM184.72 -6.69Q184.4 -6.69 184.2 -6.89Q183.99 -7.09 183.99 -7.39Q183.99 -7.69 184.2 -7.88Q184.4 -8.07 184.72 -8.07Q185.02 -8.07 185.23 -7.88Q185.44 -7.69 185.44 -7.39Q185.44 -7.09 185.23 -6.89Q185.02 -6.69 184.72 -6.69ZM186.86 0V-5.69H187.85L187.91 -4.77Q188.17 -5.26 188.64 -5.54Q189.12 -5.82 189.76 -5.82Q190.41 -5.82 190.88 -5.56Q191.35 -5.31 191.61 -4.79Q191.87 -4.28 191.87 -3.51V0H190.78V-3.4Q190.78 -4.13 190.43 -4.51Q190.08 -4.88 189.46 -4.88Q189.04 -4.88 188.7 -4.69Q188.36 -4.49 188.16 -4.12Q187.96 -3.74 187.96 -3.2V0ZM195.19 0.13Q194.52 0.13 194.07 -0.11Q193.63 -0.35 193.41 -0.75Q193.19 -1.15 193.19 -1.62Q193.19 -2.17 193.47 -2.56Q193.75 -2.96 194.28 -3.17Q194.81 -3.38 195.54 -3.38H196.96Q196.96 -3.89 196.83 -4.23Q196.71 -4.57 196.43 -4.74Q196.15 -4.9 195.7 -4.9Q195.22 -4.9 194.89 -4.68Q194.55 -4.45 194.47 -4H193.37Q193.43 -4.58 193.76 -4.98Q194.08 -5.39 194.59 -5.6Q195.11 -5.82 195.7 -5.82Q196.48 -5.82 197.01 -5.54Q197.53 -5.27 197.8 -4.77Q198.06 -4.27 198.06 -3.58V0H197.1L197.01 -0.94Q196.9 -0.72 196.73 -0.52Q196.56 -0.33 196.33 -0.18Q196.11 -0.03 195.82 0.05Q195.53 0.13 195.19 0.13ZM195.39 -0.76Q195.73 -0.76 196.01 -0.91Q196.3 -1.05 196.5 -1.31Q196.71 -1.56 196.82 -1.87Q196.93 -2.19 196.94 -2.54V-2.6H195.65Q195.18 -2.6 194.89 -2.49Q194.6 -2.37 194.48 -2.16Q194.35 -1.95 194.35 -1.69Q194.35 -1.4 194.47 -1.2Q194.59 -0.99 194.83 -0.88Q195.06 -0.76 195.39 -0.76ZM199.55 0V-5.69H200.53L200.6 -4.77Q200.85 -5.26 201.33 -5.54Q201.8 -5.82 202.44 -5.82Q203.09 -5.82 203.56 -5.56Q204.04 -5.31 204.3 -4.79Q204.56 -4.28 204.56 -3.51V0H203.46V-3.4Q203.46 -4.13 203.11 -4.51Q202.76 -4.88 202.14 -4.88Q201.73 -4.88 201.39 -4.69Q201.05 -4.49 200.85 -4.12Q200.65 -3.74 200.65 -3.2V0ZM208.6 0.13Q207.8 0.13 207.17 -0.24Q206.54 -0.62 206.19 -1.29Q205.83 -1.95 205.83 -2.83Q205.83 -3.73 206.19 -4.4Q206.54 -5.07 207.17 -5.44Q207.8 -5.82 208.6 -5.82Q209.62 -5.82 210.3 -5.28Q210.98 -4.75 211.17 -3.83H210.03Q209.92 -4.33 209.52 -4.6Q209.13 -4.88 208.59 -4.88Q208.13 -4.88 207.75 -4.64Q207.38 -4.41 207.17 -3.96Q206.96 -3.51 206.96 -2.84Q206.96 -2.35 207.08 -1.97Q207.2 -1.58 207.42 -1.32Q207.64 -1.07 207.94 -0.93Q208.24 -0.8 208.59 -0.8Q208.95 -0.8 209.25 -0.92Q209.54 -1.05 209.75 -1.29Q209.96 -1.53 210.03 -1.86H211.17Q210.99 -0.96 210.3 -0.41Q209.61 0.13 208.6 0.13ZM212.57 0V-5.69H213.67V0ZM213.12 -6.69Q212.8 -6.69 212.6 -6.89Q212.39 -7.09 212.39 -7.39Q212.39 -7.69 212.6 -7.88Q212.8 -8.07 213.12 -8.07Q213.43 -8.07 213.64 -7.88Q213.85 -7.69 213.85 -7.39Q213.85 -7.09 213.64 -6.89Q213.43 -6.69 213.12 -6.69ZM217.09 0.13Q216.42 0.13 215.97 -0.11Q215.53 -0.35 215.31 -0.75Q215.09 -1.15 215.09 -1.62Q215.09 -2.17 215.37 -2.56Q215.65 -2.96 216.18 -3.17Q216.71 -3.38 217.44 -3.38H218.86Q218.86 -3.89 218.74 -4.23Q218.61 -4.57 218.33 -4.74Q218.06 -4.9 217.6 -4.9Q217.12 -4.9 216.79 -4.68Q216.45 -4.45 216.37 -4H215.27Q215.34 -4.58 215.66 -4.98Q215.98 -5.39 216.49 -5.6Q217.01 -5.82 217.6 -5.82Q218.38 -5.82 218.91 -5.54Q219.43 -5.27 219.7 -4.77Q219.96 -4.27 219.96 -3.58V0H219L218.91 -0.94Q218.8 -0.72 218.63 -0.52Q218.46 -0.33 218.24 -0.18Q218.01 -0.03 217.72 0.05Q217.44 0.13 217.09 0.13ZM217.29 -0.76Q217.63 -0.76 217.91 -0.91Q218.2 -1.05 218.4 -1.31Q218.61 -1.56 218.72 -1.87Q218.83 -2.19 218.84 -2.54V-2.6H217.55Q217.09 -2.6 216.8 -2.49Q216.51 -2.37 216.38 -2.16Q216.25 -1.95 216.25 -1.69Q216.25 -1.4 216.37 -1.2Q216.49 -0.99 216.73 -0.88Q216.96 -0.76 217.29 -0.76ZM221.45 0V-7.92H222.55V0ZM224.4 0V-6.29Q224.4 -6.87 224.59 -7.23Q224.79 -7.58 225.16 -7.75Q225.53 -7.92 226.06 -7.92H226.84V-6.98H226.24Q225.84 -6.98 225.67 -6.82Q225.5 -6.66 225.5 -6.27V0ZM223.55 -4.76V-5.69H226.92V-4.76ZM228.07 0V-5.69H229.06L229.15 -4.65Q229.35 -5.03 229.66 -5.29Q229.97 -5.55 230.4 -5.68Q230.83 -5.82 231.37 -5.82V-4.66H230.83Q230.5 -4.66 230.2 -4.58Q229.9 -4.5 229.67 -4.3Q229.43 -4.11 229.3 -3.79Q229.17 -3.46 229.17 -2.96V0ZM234.9 0.13Q234.1 0.13 233.5 -0.24Q232.89 -0.61 232.54 -1.27Q232.2 -1.94 232.2 -2.83Q232.2 -3.72 232.54 -4.4Q232.88 -5.07 233.49 -5.44Q234.11 -5.82 234.91 -5.82Q235.74 -5.82 236.32 -5.45Q236.9 -5.08 237.2 -4.46Q237.51 -3.84 237.51 -3.09Q237.51 -2.98 237.51 -2.86Q237.51 -2.74 237.49 -2.59H233.01V-3.36H236.42Q236.39 -4.1 235.97 -4.5Q235.54 -4.91 234.9 -4.91Q234.46 -4.91 234.09 -4.7Q233.72 -4.49 233.5 -4.08Q233.28 -3.67 233.28 -3.05V-2.74Q233.28 -2.11 233.5 -1.67Q233.72 -1.23 234.08 -1.01Q234.45 -0.78 234.89 -0.78Q235.44 -0.78 235.77 -1Q236.09 -1.22 236.25 -1.61H237.35Q237.21 -1.11 236.88 -0.72Q236.54 -0.32 236.04 -0.1Q235.54 0.13 234.9 0.13ZM241.25 0.13Q240.46 0.13 239.85 -0.24Q239.24 -0.61 238.9 -1.27Q238.56 -1.94 238.56 -2.83Q238.56 -3.72 238.9 -4.4Q239.24 -5.07 239.85 -5.44Q240.46 -5.82 241.27 -5.82Q242.1 -5.82 242.68 -5.45Q243.26 -5.08 243.56 -4.46Q243.87 -3.84 243.87 -3.09Q243.87 -2.98 243.87 -2.86Q243.86 -2.74 243.85 -2.59H239.37V-3.36H242.78Q242.75 -4.1 242.32 -4.5Q241.9 -4.91 241.26 -4.91Q240.82 -4.91 240.45 -4.7Q240.08 -4.49 239.86 -4.08Q239.64 -3.67 239.64 -3.05V-2.74Q239.64 -2.11 239.85 -1.67Q240.07 -1.23 240.44 -1.01Q240.81 -0.78 241.25 -0.78Q241.8 -0.78 242.13 -1Q242.45 -1.22 242.61 -1.61H243.71Q243.57 -1.11 243.23 -0.72Q242.9 -0.32 242.4 -0.1Q241.9 0.13 241.25 0.13ZM247.54 0.13Q246.76 0.13 246.17 -0.25Q245.58 -0.64 245.25 -1.31Q244.92 -1.99 244.92 -2.84Q244.92 -3.71 245.25 -4.38Q245.58 -5.05 246.18 -5.43Q246.79 -5.82 247.57 -5.82Q248.22 -5.82 248.7 -5.56Q249.18 -5.31 249.46 -4.84V-7.92H250.56V0H249.57L249.46 -0.87Q249.3 -0.61 249.03 -0.38Q248.77 -0.15 248.4 -0.01Q248.03 0.13 247.54 0.13ZM247.74 -0.82Q248.25 -0.82 248.64 -1.07Q249.02 -1.32 249.24 -1.78Q249.45 -2.23 249.45 -2.84Q249.45 -3.46 249.24 -3.91Q249.02 -4.37 248.64 -4.61Q248.25 -4.86 247.74 -4.86Q247.25 -4.86 246.86 -4.61Q246.47 -4.37 246.26 -3.91Q246.04 -3.46 246.04 -2.85Q246.04 -2.23 246.26 -1.78Q246.47 -1.32 246.86 -1.07Q247.25 -0.82 247.74 -0.82ZM254.61 0.13Q253.81 0.13 253.19 -0.24Q252.57 -0.61 252.22 -1.28Q251.87 -1.95 251.87 -2.84Q251.87 -3.74 252.22 -4.41Q252.58 -5.08 253.2 -5.45Q253.83 -5.82 254.63 -5.82Q255.44 -5.82 256.05 -5.45Q256.67 -5.08 257.02 -4.41Q257.37 -3.74 257.37 -2.84Q257.37 -1.95 257.02 -1.28Q256.66 -0.61 256.04 -0.24Q255.42 0.13 254.61 0.13ZM254.61 -0.81Q255.07 -0.81 255.44 -1.04Q255.81 -1.27 256.03 -1.72Q256.25 -2.17 256.25 -2.84Q256.25 -3.52 256.03 -3.97Q255.82 -4.42 255.45 -4.65Q255.09 -4.87 254.63 -4.87Q254.18 -4.87 253.81 -4.65Q253.43 -4.42 253.21 -3.97Q252.99 -3.52 252.99 -2.84Q252.99 -2.17 253.21 -1.72Q253.43 -1.27 253.79 -1.04Q254.16 -0.81 254.61 -0.81ZM258.69 0V-5.69H259.68L259.75 -4.91Q260.01 -5.33 260.46 -5.58Q260.9 -5.82 261.42 -5.82Q261.84 -5.82 262.18 -5.71Q262.51 -5.59 262.77 -5.37Q263.02 -5.14 263.18 -4.8Q263.48 -5.29 263.97 -5.55Q264.46 -5.82 265.02 -5.82Q265.68 -5.82 266.15 -5.56Q266.62 -5.3 266.86 -4.78Q267.11 -4.27 267.11 -3.5V0H266.02V-3.39Q266.02 -4.13 265.71 -4.51Q265.39 -4.88 264.82 -4.88Q264.43 -4.88 264.12 -4.68Q263.81 -4.49 263.63 -4.1Q263.45 -3.72 263.45 -3.17V0H262.35V-3.39Q262.35 -4.13 262.04 -4.51Q261.72 -4.88 261.15 -4.88Q260.78 -4.88 260.47 -4.68Q260.16 -4.49 259.98 -4.1Q259.79 -3.72 259.79 -3.17V0Z";
var WM_PATH_W = 267.83;
var wmLogoImg = new Image();
wmLogoImg.src = WM_LOGO_SRC;

// The export palette is the page's own, read at export time so a chart saved
// in dark mode looks like the one on screen.
function exportTokens(){
  var light = document.body.classList.contains('light');
  return {bg: light ? '#ffffff' : '#0F1728', fg: light ? '#2D3436' : '#EAF1FF'};
}

// Every visible entry, carrying the swatch it draws, so the exported key is
// the page's key rather than a row of coloured dots.
function legendItemsOf(legendId){
  return SharedLegend.itemsOf(legendId);
}

// Row packing lives in SharedLegend now, so every tool's export wraps a wide
// key the same way instead of running it off the edge of the canvas.
var layoutLegend = SharedLegend.layout;

function saveBlob(blob, filename){
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function chartPng(canvasId, filename, chartTitle, legendId, shouldDownload){
  var src = $(canvasId);
  if(!src) return null;
  var dpr = window.devicePixelRatio || 1;
  var OUT = 3;
  var chartW = Math.round(src.width / dpr * OUT);
  var chartH = Math.round(src.height / dpr * OUT);
  var tone = exportTokens();
  var FONT = '"DM Sans", sans-serif';
  var legendItems = legendId ? legendItemsOf(legendId) : [];

  var titleFontPx = Math.round(14 * OUT);
  var legendFontPx = Math.round(11 * OUT);
  var titleH = chartTitle ? Math.round(40 * OUT) : 0;
  var markW = SharedLegend.W * OUT, gap = Math.round(7 * OUT), pad = Math.round(20 * OUT);
  var margin = Math.round(16 * OUT), rowH = Math.round(22 * OUT);
  // The watermark gets a strip of its own, so a legend that needs two rows
  // cannot land on top of it.
  var wmH = Math.round(26 * OUT);

  var measureCtx = document.createElement('canvas').getContext('2d');
  measureCtx.font = '500 ' + legendFontPx + 'px ' + FONT;
  var legendRows = legendItems.length
    ? layoutLegend(legendItems, function(s){ return measureCtx.measureText(s).width; },
                   chartW - margin * 2, markW, gap, pad)
    : [];
  var legendH = legendRows.length ? legendRows.length * rowH + Math.round(8 * OUT) : 0;

  var tmp = document.createElement('canvas');
  tmp.width = chartW;
  tmp.height = chartH + titleH + legendH + wmH;
  var ctx = tmp.getContext('2d');

  ctx.fillStyle = tone.bg;
  ctx.fillRect(0, 0, tmp.width, tmp.height);

  if(chartTitle){
    ctx.font = '700 ' + titleFontPx + 'px ' + FONT;
    ctx.fillStyle = tone.fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(chartTitle, tmp.width / 2, titleH / 2);
  }

  ctx.drawImage(src, 0, titleH, chartW, chartH);

  if(legendRows.length){
    ctx.font = '500 ' + legendFontPx + 'px ' + FONT;
    ctx.textBaseline = 'middle';
    var ly = titleH + chartH + Math.round(4 * OUT);
    legendRows.forEach(function(row, ri){
      var x = Math.max(margin, (tmp.width - row.width) / 2);
      var cy = ly + rowH * ri + rowH / 2;
      row.items.forEach(function(item){
        SharedLegend.paint(ctx, item.swatch, x, cy, OUT);
        x += markW + gap;
        ctx.fillStyle = tone.fg;
        ctx.textAlign = 'left';
        ctx.fillText(item.label, x, cy);
        x += ctx.measureText(item.label).width + pad;
      });
    });
  }

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.font = '500 ' + Math.round(11 * OUT) + 'px ' + FONT;
  ctx.fillStyle = '#1a1a1a';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  var wmText = 'Made using tool.adjiebrotots.com/financialfreedom';
  var wmX = tmp.width - Math.round(12 * OUT);
  var wmY = tmp.height - Math.round(12 * OUT);
  var wmTextW = ctx.measureText(wmText).width;
  var wmLogoSize = Math.round(13 * OUT);
  if(wmLogoImg.complete && wmLogoImg.naturalWidth){
    ctx.drawImage(wmLogoImg, wmX - wmTextW - Math.round(4 * OUT) - wmLogoSize,
                  wmY - wmLogoSize + Math.round(2 * OUT), wmLogoSize, wmLogoSize);
  }
  ctx.fillText(wmText, wmX, wmY);
  ctx.restore();

  if(shouldDownload !== false){
    var a = document.createElement('a');
    a.href = tmp.toDataURL('image/png');
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
  }
  return tmp;
}

function copyCanvasPng(canvas){
  if(!canvas) return Promise.reject(new Error('Nothing to copy yet.'));
  if(!navigator.clipboard || !window.ClipboardItem){
    return Promise.reject(new Error('Clipboard image copy is not supported in this browser.'));
  }
  return new Promise(function(resolve, reject){
    canvas.toBlob(function(blob){
      if(!blob){ reject(new Error('Could not create PNG blob.')); return; }
      navigator.clipboard.write([new ClipboardItem({'image/png': blob})]).then(resolve, reject);
    }, 'image/png');
  });
}

function chartSvg(canvasId, filename, chartTitle, legendId){
  var src = $(canvasId);
  if(!src) return;
  var dpr = window.devicePixelRatio || 1;
  var chartW = Math.round(src.width / dpr), chartH = Math.round(src.height / dpr);
  var tone = exportTokens();
  var FONT = 'DM Sans, sans-serif';
  var legendItems = legendId ? legendItemsOf(legendId) : [];
  var titleH = chartTitle ? 40 : 0;
  var markW = SharedLegend.W, gap = 7, pad = 20, margin = 16, rowH = 22, wmH = 26;
  var mc = document.createElement('canvas').getContext('2d');
  mc.font = '500 11px DM Sans, sans-serif';
  var legendRows = legendItems.length
    ? layoutLegend(legendItems, function(s){ return mc.measureText(s).width; },
                   chartW - margin * 2, markW, gap, pad)
    : [];
  var legendH = legendRows.length ? legendRows.length * rowH + 8 : 0;
  var svgW = chartW, svgH = chartH + titleH + legendH + wmH;
  var NS = 'http://www.w3.org/2000/svg', xl = 'http://www.w3.org/1999/xlink';
  var svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('xmlns', NS); svg.setAttribute('xmlns:xlink', xl);
  svg.setAttribute('width', svgW); svg.setAttribute('height', svgH);
  svg.setAttribute('viewBox', '0 0 ' + svgW + ' ' + svgH);
  var bgRect = document.createElementNS(NS, 'rect');
  bgRect.setAttribute('width', svgW); bgRect.setAttribute('height', svgH);
  bgRect.setAttribute('fill', tone.bg);
  svg.appendChild(bgRect);
  if(chartTitle){
    var t = document.createElementNS(NS, 'text');
    t.setAttribute('x', svgW / 2); t.setAttribute('y', titleH / 2);
    t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'middle');
    t.setAttribute('font-family', FONT); t.setAttribute('font-size', '14');
    t.setAttribute('font-weight', '700'); t.setAttribute('fill', tone.fg);
    t.textContent = chartTitle; svg.appendChild(t);
  }
  var img = document.createElementNS(NS, 'image');
  img.setAttribute('x', 0); img.setAttribute('y', titleH);
  img.setAttribute('width', chartW); img.setAttribute('height', chartH);
  img.setAttributeNS(xl, 'href', src.toDataURL('image/png'));
  svg.appendChild(img);
  legendRows.forEach(function(row, ri){
    var x = Math.max(margin, (svgW - row.width) / 2);
    var cy = titleH + chartH + 4 + rowH * ri + rowH / 2;
    row.items.forEach(function(item){
      svg.appendChild(SharedLegend.svgNode(item.swatch, x, cy, 1));
      x += markW + gap;
      var lt = document.createElementNS(NS, 'text');
      lt.setAttribute('x', x); lt.setAttribute('y', cy);
      lt.setAttribute('dominant-baseline', 'middle'); lt.setAttribute('font-family', FONT);
      lt.setAttribute('font-size', '11'); lt.setAttribute('font-weight', '500');
      lt.setAttribute('fill', tone.fg);
      lt.textContent = item.label; svg.appendChild(lt);
      x += mc.measureText(item.label).width + pad;
    });
  });
  // Watermark text is baked to glyph outlines (WM_PATH) so the exported
  // SVG carries no editable/searchable string; renders identically.
  var wm = document.createElementNS(NS, 'path');
  wm.setAttribute('d', WM_PATH);
  wm.setAttribute('transform', 'translate(' + (svgW - 12 - WM_PATH_W) + ',' + (svgH - 12) + ')');
  wm.setAttribute('fill', '#1a1a1a'); wm.setAttribute('opacity', '0.22');
  svg.appendChild(wm);
  var wmLogoSize = 13;
  var wmLogo = document.createElementNS(NS, 'image');
  wmLogo.setAttribute('href', WM_LOGO_SRC);
  wmLogo.setAttributeNS(xl, 'href', WM_LOGO_SRC);
  wmLogo.setAttribute('width', wmLogoSize); wmLogo.setAttribute('height', wmLogoSize);
  wmLogo.setAttribute('x', svgW - 12 - WM_PATH_W - 4 - wmLogoSize);
  wmLogo.setAttribute('y', svgH - 12 - wmLogoSize + 2);
  wmLogo.setAttribute('opacity', '0.22');
  svg.appendChild(wmLogo);
  var xml = '<?xml version="1.0" encoding="utf-8"?>\n' + new XMLSerializer().serializeToString(svg);
  saveBlob(new Blob([xml], {type: 'image/svg+xml;charset=utf-8'}), filename);
}

// The chart title has to carry the money mode: the same plan in future's money
// is a different picture, and an exported file has no Settings tab to check.
function exportTitle(which){
  if(!last) return 'Financial Freedom Calculator';
  var mode = last.ui.showReal ? "today's money" : "future's money";
  var at = ' at ' + fmt.age(last.P.ageRetire);
  var name = which === 'dd' ? 'Cashflows and balance' + at : 'Path to freedom';
  return 'Financial Freedom Calculator: ' + name + ' (' + mode + ')';
}

function csvCell(v){
  var str = String(v == null ? '' : v);
  return /[",\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
}

function downloadCsv(){
  if(!last){ return; }
  var money = function(v){ return v == null ? '' : v.toFixed(2); };
  var header = ['Year', 'Age', 'Balance', 'Income', 'Expense', 'Saved_or_drawn', 'Growth'];
  var lines = tableRows(last).map(function(r){
    return [r.year, r.age.toFixed(2), money(r.balance), money(r.income), money(r.expense),
            money(r.flow), money(r.growth)].map(csvCell).join(',');
  });
  var csv = '# Made using tool.adjiebrotots.com/financialfreedom\n' +
    '# ' + last.ui.currency + ', ' + (last.ui.showReal ? "today's money" : "future's money") + '\n' +
    header.join(',') + '\n' + lines.join('\n') + '\n';
  saveBlob(new Blob([csv], {type: 'text/csv;charset=utf-8;'}), 'financial_freedom.csv');
}

/* ─── WIRING ─── */

/* ═════════════════════ Quick Start scenarios ═════════════════════
   One-click worked plans. Each one fills every tab with a named saver, so a
   first-time visitor reads a real answer instead of a generic default that
   describes nobody, and each is chosen to teach one lever the page carries:

     Moderate FIRE      the baseline. Savings entered directly, spending kept
                        as it is, the pot run to nothing at the life expectancy.
     Frugal Living      the net income model, where spending less does two jobs
                        at once: it fills the pot faster AND shrinks the pot
                        needed, which is why a lean saver frees up in years
                        rather than decades.
     Geoarbitrage       the retirement spending multiplier. Same earner, same
                        saving, retiring somewhere that costs 40% of home.
     Fat FIRE forever   Die Rich, the goal that never touches the capital.
     Family legacy      Leave a Legacy, where the bequest is discounted back to
                        the day you stop and so costs less than its face value.
     Late start         the pension, and a return that is not all equity. Switch
                        the pension off and freedom moves years later.

   Basis. Every figure is in the currency on screen, which the page never
   converts, and the page carries no tax model, so an income here is take-home
   and a return is net of fees:
   - Returns and volatility come from the asset preset each scenario names, so
     there is one source for them and a preset revision moves the scenarios
     with it. The late starter is the exception: a 60/40 balanced mix is not
     one of the presets, so it carries its own figures as Custom.
   - Inflation is 2.5%, the middle of the RBA's 2-3% band. Geoarbitrage runs
     3%, because a cost base in a developing economy is the one case where the
     single inflation figure this page models is being asked to cover two.
   - Savings rates are deliberately archetypal, not median: 41% for a moderate
     saver, 67% for a frugal one, 63% for a high earner who has not inflated
     their lifestyle with their pay.
   - No scenario sets a retirement age. The slider is seeded from the plan's own
     freedom age by seedRetireAge(), so every scenario opens on the earliest
     stop that works. Read what that costs: the crossing is solved on the
     expected return alone, so a plan parked exactly on it is close to a coin
     flip on the volatility, and the chance shown on the Cashflows board says
     so. The years of margin are one drag to the right, and that drag is the
     board's whole lesson.

   The audit harness in _audit/ pins all of it: every field landing on its own
   control, the return agreeing with the named preset, every scenario reaching
   freedom, the slider opening on that age, and the three tips that claim a
   lever — the frugal saver's years of work, the Bali multiplier, the late
   starter's pension. */
var QUICK_START_SCENARIOS = {

  /* 32, on $110,000 take-home: $65,000 spent, $45,000 saved. Global equity,
     spending unchanged in retirement, nothing left behind. This is the plan
     every other button is a variation on. */
  moderate: {
    label: 'Moderate FIRE',
    vals: {
      ageNow: 32, ageDie: 90,
      expense: 65000, expensePeriod: 'yearly',
      savingsMode: 'savings', savings: 45000, savingsPeriod: 'yearly',
      growth: 3, inflation: 2.5,
      assetPreset: 'world', assets: 120000,
      mode: 'die', retireMultiplier: 100
    }
  },

  /* Lean FIRE at 28. Entered as NET INCOME, which is the model that makes the
     point: the $30,000 spending line is subtracted from the income to get the
     saving AND multiplied into the pot, so cutting it moves both ends. Two
     thirds of the pay packet saved gets there in years, not decades. */
  frugal: {
    label: 'Frugal Living',
    vals: {
      ageNow: 28, ageDie: 92,
      expense: 30000, expensePeriod: 'yearly',
      savingsMode: 'income', savings: 92000, savingsPeriod: 'yearly',
      growth: 2.5, inflation: 2.5,
      assetPreset: 'world', assets: 40000,
      mode: 'die', retireMultiplier: 100
    }
  },

  /* Earn in Australia, retire in Bali. Nothing here is converted: the currency
     selector is display only, and the arbitrage is expressed the way the page
     actually models it, as retirement spending set to 40% of today's. That is
     roughly what a comfortable Canggu or Ubud year costs against a Perth one.
     Inflation is lifted to 3% because the one figure is now covering a cost
     base that is not the one the saving is earned in. */
  geoarbitrage: {
    label: 'Geoarbitrage, Bali',
    vals: {
      ageNow: 34, ageDie: 88,
      expense: 70000, expensePeriod: 'yearly',
      savingsMode: 'savings', savings: 40000, savingsPeriod: 'yearly',
      growth: 3, inflation: 3,
      assetPreset: 'world', assets: 90000,
      mode: 'die', retireMultiplier: 40
    }
  },

  /* $320,000 net, $120,000 spent, US equity, and the goal that never spends a
     cent of capital. Die Rich prices the same spending as a perpetuity, so it
     is the dearest pot on the page, and the $200,000 a year surplus is what
     still reaches it in five years. */
  fatfire: {
    label: 'Fat FIRE, forever',
    vals: {
      ageNow: 38, ageDie: 90,
      expense: 120000, expensePeriod: 'yearly',
      savingsMode: 'income', savings: 320000, savingsPeriod: 'yearly',
      growth: 3, inflation: 2.5,
      assetPreset: 'us', assets: 400000,
      mode: 'rich', retireMultiplier: 100
    }
  },

  /* 40, with a house's worth to hand on: $750,000 in TODAY'S money still there
     at 90, on top of 95% of today's spending because the mortgage is gone by
     then. The bequest is discounted over the thirty-odd years from stopping to
     dying, which is why it adds a fraction of its face value to the pot. */
  legacy: {
    label: 'Family legacy',
    vals: {
      ageNow: 40, ageDie: 90,
      expense: 80000, expensePeriod: 'yearly',
      savingsMode: 'savings', savings: 55000, savingsPeriod: 'yearly',
      growth: 3, inflation: 2.5,
      assetPreset: 'world', assets: 350000,
      mode: 'legacy', legacy: 750000, retireMultiplier: 95
    }
  },

  /* Starting at 52, which is when most people actually start asking. A 60/40
     balanced mix rather than all equity, savings growing slower than prices,
     and the Australian age pension at 67 on the single full rate of about
     $29,000 indexed. The pension is worth a pot of its own: turn it off and the
     freedom age moves years later, which is the lesson the tip points at. */
  latestart: {
    label: 'Late start, on a pension',
    vals: {
      ageNow: 52, ageDie: 92,
      expense: 55000, expensePeriod: 'yearly',
      savingsMode: 'savings', savings: 25000, savingsPeriod: 'yearly',
      growth: 2, inflation: 2.5,
      assetPreset: 'custom', ret: 6.5, std: 10, assets: 180000,
      mode: 'die', retireMultiplier: 85,
      pensionOn: true, pensionStartAge: 67,
      pensionAmount: 29000, pensionPeriod: 'yearly', pensionIndexed: true
    }
  }
};

/* A scenario is built on top of UI_DEFAULTS rather than over whatever is on
   screen, so a field one scenario sets can never be inherited by the next one
   that does not: a pension left ticked by the late starter would otherwise
   quietly fund every plan after it.

   The return and the volatility are taken FROM the named preset rather than
   stored again beside it, so the two can never disagree. Custom is the one
   preset that carries its own pair, and the late starter relies on that.

   A ticker fetch is user data, not scenario data, so it is cleared the way
   Reset clears it: the figures on screen now belong to the preset. */
function applyQuickStart(key){
  var s = QUICK_START_SCENARIOS[key];
  if(!s) return;

  var plan = Object.assign({}, UI_DEFAULTS, s.vals);
  var preset = PRESET_ASSETS[plan.assetPreset];
  if(preset && plan.assetPreset !== 'custom'){ plan.ret = preset.ret; plan.std = preset.std; }

  tickerInfo = null;
  $('ticker').value = '';
  tickerStatus('Nothing is fetched until you press Fetch.' + rateSuffix());

  Object.assign(UI, plan);
  applyUIToDom(plan);
  seedRetireAge();
  markQuickStart(key);
  if(persist) persist.schedule();
  render();
}

// The highlight is a claim about what is on screen, so Reset has to be able to
// drop it as well. Passing no key clears it.
function markQuickStart(key){
  document.querySelectorAll('.quick-start-btn').forEach(function(b){
    b.classList.toggle('active', !!key && b.dataset.preset === key);
  });
}

function applyUIToDom(ui){
  $('currency').value = ui.currency;
  $('ageNow').value = ui.ageNow;
  $('ageDie').value = ui.ageDie;
  /* Open the slider's span back up BEFORE writing the handle. A range input
     clamps whatever you assign against the min and max it is carrying at that
     moment, and syncRetireSlider() keeps narrowing those to the two ages of
     whatever plan is on screen — so writing the handle first let the previous
     plan's ceiling silently eat the new one's retirement age. Frugal Living
     (stop at 37) landed on 42 for anyone who had been looking at a later
     starting age. syncRetireSlider() narrows the span again on the render that
     follows, so the widening is never visible. */
  widenRetireSlider();
  $('ageRetire').value = ui.ageRetire;
  $('expense').value = SharedFmt.formatThousands(ui.expense);
  $('expensePeriod').value = ui.expensePeriod;
  $('savings').value = SharedFmt.formatThousands(ui.savings);
  $('savingsPeriod').value = ui.savingsPeriod;
  $('growth').value = ui.growth;
  $('inflation').value = ui.inflation;
  $('assetPreset').value = ui.assetPreset;
  $('ret').value = ui.ret;
  $('std').value = ui.std;
  $('assets').value = SharedFmt.formatThousands(ui.assets);
  $('legacy').value = SharedFmt.formatThousands(ui.legacy);
  $('retireMultiplier').value = ui.retireMultiplier;
  $('pensionOn').checked = !!ui.pensionOn;
  $('pensionStartAge').value = ui.pensionStartAge;
  $('pensionAmount').value = SharedFmt.formatThousands(ui.pensionAmount);
  $('pensionPeriod').value = ui.pensionPeriod;
  $('pensionIndexed').checked = ui.pensionIndexed !== false;
  $('showReal').checked = !!ui.showReal;
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
  if(!silent){ if(persist) persist.schedule(); markStale(); }
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

  /* Every assumption marks the answer out of date rather than recomputing it.
     See the Simulate gate above the render() definition for why. */
  ['expense', 'savings', 'assets', 'legacy', 'pensionAmount'].forEach(function(id){
    SharedFmt.attachCurrencyInput($(id), {maxDecimals: 0, onChange: markStale});
  });

  ['ageNow','ageDie','growth','inflation','ret','std','retireMultiplier',
   'pensionStartAge','paths','confidence','seed'].forEach(function(id){
    $(id).addEventListener('input', markStale);
  });
  ['expensePeriod','savingsPeriod','pensionPeriod','currency'].forEach(function(id){
    $(id).addEventListener('change', markStale);
  });

  /* The retirement slider is the exception to the Simulate gate, because sweeping
     it IS the question this board asks: it is a sensitivity control, and one you
     have to press a button after is not one. The readout follows the handle on
     every pixel and the recompute sits behind a short debounce, so a drag stays
     smooth instead of running a Monte Carlo per animation frame.

     That render reads the whole form, so any assumption typed but not yet
     simulated is run by it — which is exactly why it clears the stale mark
     rather than leaving it up. What is on screen afterwards really is the plan
     the form describes. */
  $('ageRetire').addEventListener('input', function(){
    $('ageRetireVal').textContent = fmt.age(Number($('ageRetire').value));
    clearTimeout(retireTimer);
    retireTimer = setTimeout(render, 160);
  });

  $('assetPreset').addEventListener('change', function(){
    var p = PRESET_ASSETS[$('assetPreset').value];
    if(p && $('assetPreset').value !== 'custom'){
      $('ret').value = p.ret; $('std').value = p.std;
      tickerInfo = null;
    }
    markStale();
  });

  document.querySelectorAll('.quick-start-btn').forEach(function(btn){
    btn.addEventListener('click', function(){ applyQuickStart(btn.dataset.preset); });
  });

  document.querySelectorAll('#savingsModeGroup .seg-btn').forEach(function(btn){
    btn.addEventListener('click', function(){ setSavingsMode(btn.dataset.val); });
  });

  document.querySelectorAll('input[name="ffmode"]').forEach(function(r){
    r.addEventListener('change', function(){ syncModeSelection(); markStale(); });
  });

  ['pensionOn','pensionIndexed'].forEach(function(id){
    $(id).addEventListener('change', markStale);
  });

  /* Today's money against the money of the day is a way of READING the answer,
     not an assumption about it, so it redraws on the spot. The seed makes the
     simulated futures reproducible, so re-running gives back the same ones. */
  $('showReal').addEventListener('change', render);

  $('fetchTickerBtn').addEventListener('click', fetchTicker);
  $('ticker').addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); fetchTicker(); } });

  /* resetZoom puts the x window back and the refit plugin sizes y to it on the
     same update. The second update is not redundant: the tick set Chart.js
     builds on the reset pass is the zoomed one, and it would otherwise be left
     stranded across an axis it no longer belongs to. */
  $('resetZoom1').addEventListener('click', function(){ if(chart1){ chart1.resetZoom('none'); chart1.update('none'); } });
  $('resetZoom2').addEventListener('click', function(){ if(chart2){ chart2.resetZoom('none'); chart2.update('none'); } });

  $('ffPngBtn').addEventListener('click', function(){
    chartPng('ffChart', 'financial_freedom_path.png', exportTitle('ff'), 'legend1');
  });
  $('ddPngBtn').addEventListener('click', function(){
    chartPng('ddChart', 'financial_freedom_cashflows.png', exportTitle('dd'), 'legend2');
  });
  $('ffSvgBtn').addEventListener('click', function(){
    chartSvg('ffChart', 'financial_freedom_path.svg', exportTitle('ff'), 'legend1');
  });
  $('ddSvgBtn').addEventListener('click', function(){
    chartSvg('ddChart', 'financial_freedom_cashflows.svg', exportTitle('dd'), 'legend2');
  });
  $('ffCopyBtn').addEventListener('click', function(){
    copyCanvasPng(chartPng('ffChart', '', exportTitle('ff'), 'legend1', false))
      .then(function(){ flashBtn($('ffCopyBtn'), '✓'); },
            function(err){ alert('PNG copy failed: ' + (err && err.message ? err.message : 'unknown error')); });
  });
  $('ddCopyBtn').addEventListener('click', function(){
    copyCanvasPng(chartPng('ddChart', '', exportTitle('dd'), 'legend2', false))
      .then(function(){ flashBtn($('ddCopyBtn'), '✓'); },
            function(err){ alert('PNG copy failed: ' + (err && err.message ? err.message : 'unknown error')); });
  });
  $('csvBtn').addEventListener('click', downloadCsv);

  // The gate itself: nothing else on the form runs the engine.
  $('simBtn').addEventListener('click', function(){
    render();
    flashBtn($('simBtn'), '✓ Updated');
  });
  [['ffChart', 'hover1'], ['ddChart', 'hover2']].forEach(function(pair){
    $(pair[0]).addEventListener('mouseleave', function(){
      $(pair[1]).textContent = 'Hover to inspect any year.';
    });
  });

}

/* There is no Reset button. Every Quick Start scenario is built on top of
   UI_DEFAULTS, so any one of them already returns the form to a clean, known
   state — and returns it to a plan worth looking at rather than to an empty
   one. Kept as a function because the page's own audit harness needs a
   documented way back to the defaults. */
function resetToDefaults(){
  tickerInfo = null;
  $('ticker').value = '';
  tickerStatus('');
  Object.assign(UI, UI_DEFAULTS);
  applyUIToDom(UI_DEFAULTS);
  seedRetireAge();
  markQuickStart(null);
  if(persist) persist.schedule();
  render();
}

/* ─── INIT ─── */

function init(){
  populateSelects();
  applyUIToDom(UI_DEFAULTS);
  // Before Persist, so a returning reader's own retirement age wins over the
  // default and a first-time one still opens on their freedom age.
  seedRetireAge();
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
  resetToDefaults: resetToDefaults,
  seedRetireAge: seedRetireAge,
  CURRENCIES: CURRENCIES,
  PRESET_ASSETS: PRESET_ASSETS,
  UI_DEFAULTS: UI_DEFAULTS,
  QUICK_START_SCENARIOS: QUICK_START_SCENARIOS,
  applyQuickStart: applyQuickStart,
  RICH_HORIZON_AGE: RICH_HORIZON_AGE,
  get UI(){ return UI; },
  buildParams: buildParams,
  savingsAt: savingsAt,
  drawAt: drawAt,
  requiredPot: requiredPot,
  accumulate: accumulate,
  accMonths: accMonths,
  incomeAt: incomeAt,
  spendAt: spendAt,
  flowAt: flowAt,
  lifetimeSeries: lifetimeSeries,
  accumulationSeries: accumulationSeries,
  pensionAt: pensionAt,
  solveFreedomAge: solveFreedomAge,
  accumBands: accumBands,
  potRequirements: potRequirements,
  growthSeries: growthSeries,
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
  tableRows: tableRows,
  downloadCsv: downloadCsv,
  chartPng: chartPng,
  chartSvg: chartSvg,
  layoutLegend: layoutLegend,
  render: render,
  get last(){ return last; },
  get charts(){ return {main: chart1, cashflows: chart2}; }
};

})();
