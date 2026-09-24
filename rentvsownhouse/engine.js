/* Rent vs Own — the calculation engine, shared by the main page and the
   Sensitivity page (window.RVOEngine). Both pages build a state object from
   their own inputs and hand it here, so one set of inputs can only ever give
   one answer: there is no second copy of the model to drift out of step.

   Pure functions of the state object S; nothing here reads the page. The
   fields S carries are the ones listed in normalizeState below.

   computeModel(S, variant) → {rows, rtbRows, breakeven, ...}. `variant` picks
   the rate inside every floating band: 'low', 'mid' (the default, what the
   tables and the Sensitivity page show) or 'high' (the chart's band edges). */
(function(global){
"use strict";

/* Simple mortgage mode is one P&I rate for the whole term, with Accumulated
   Cost counting interest only: whatever a page left in the detailed-only
   fields, the engine sees the same model. */
function normalizeState(S){
  if(S.mortgageMode === 'detailed') return S;
  return Object.assign({}, S, {mortgageType:'pi', costInterestOnly:true});
}

function toYearly(val, freq){
  if(freq==='weekly') return val*52;
  if(freq==='monthly') return val*12;
  return val;
}
function toMonthly(val, freq){
  if(freq==='weekly') return val*52/12;
  if(freq==='yearly') return val/12;
  return val;
}

/* ── MORTGAGE CALC ── */
function calcMonthlyMortgage(principal, annualRate, termYears, type){
  const r = annualRate/100/12;
  const n = termYears*12;
  if(type==='io') return principal*r;
  if(r===0) return principal/n;
  return principal*(r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1);
}

/* ── DETAILED MORTGAGE RATE SCHEDULE ──
   periods: ordered, consecutive [{toYear, type:'fixed'|'floating', rate, rateMin, rateMax}].
   Normalised to [{from, to, min, max}] covering mortgage years 1..term —
   the last period is always extended/clamped to end exactly at the term. */
function normalizeRatePeriods(periods, term, fallbackRate){
  const out = [];
  let from = 1;
  if(Array.isArray(periods)){
    for(let i=0; i<periods.length && from<=term; i++){
      const p = periods[i];
      let to = Math.round(Number(p.toYear)||0);
      to = Math.min(term, Math.max(from, to));
      if(i === periods.length-1) to = term;
      let min, max;
      if(p.type==='floating'){
        const a = Number(p.rateMin)||0, b = Number(p.rateMax)||0;
        min = Math.min(a,b); max = Math.max(a,b);
      } else {
        min = max = Number(p.rate)||0;
      }
      out.push({from, to, min, max});
      from = to+1;
    }
  }
  if(!out.length) out.push({from:1, to:term, min:fallbackRate, max:fallbackRate});
  out[out.length-1].to = term;
  return out;
}
function rateBandForMortgageYear(norm, my){
  for(let i=0;i<norm.length;i++){ if(my>=norm[i].from && my<=norm[i].to) return norm[i]; }
  return norm[norm.length-1];
}
function rateFromBand(band, variant){
  return variant==='low' ? band.min : variant==='high' ? band.max : (band.min+band.max)/2;
}
/* Per-mortgage-year schedule of {rate, r12, monthlyPayment, principalStart, principalEnd}.
   When the rate changes, the P&I payment is re-amortised over the remaining term on the
   outstanding balance (standard variable-rate mortgage accounting). IO loans pay
   principal × period rate for the term, and the whole balance falls due with the
   last payment of the term (`balloon`), paid from cash: an interest-only loan is
   never carried past its term. */
function buildMortgageSchedule(loan, term, type, years, norm, variant, startYear){
  // The schedule is a view of rates by calendar year: a loan taken out at the
  // end of year `startYear` pays, in its year my, the rate of year startYear+my
  // (past the schedule's end, its last period's rate).
  startYear = startYear || 0;
  const sched = [];
  let principal = loan;
  for(let my=1; my<=years; my++){
    const band = rateBandForMortgageYear(norm, my + startYear);
    const rate = rateFromBand(band, variant);
    const r12 = rate/100/12;
    let pay = 0, balloon = 0;
    if(principal > 1e-2 && my <= term){
      pay = type==='io' ? principal * r12 : calcMonthlyMortgage(principal, rate, term - my + 1, 'pi');
    }
    const principalStart = principal;
    if(type!=='io' && pay > 0){
      for(let m=0;m<12;m++){
        if(principal <= 1e-2){ principal = 0; break; }
        const intr = principal * r12;
        principal = Math.max(0, principal - Math.min(pay - intr, principal));
      }
    }
    if(type==='io' && my===term && principal > 1e-2){ balloon = principal; principal = 0; }
    sched.push({rate, r12, monthlyPayment: pay, balloon, principalStart, principalEnd: principal});
  }
  return sched;
}
function getRateNorm(S){
  if(S.mortgageMode !== 'detailed') return [{from:1, to:S.mortgageTerm, min:S.mortgageRate, max:S.mortgageRate}];
  return normalizeRatePeriods(S.ratePeriods, S.mortgageTerm, S.mortgageRate);
}
function scheduleHasFloat(S){
  if(S.mortgageMode !== 'detailed') return false;
  return getRateNorm(S).some(p => p.max - p.min > 1e-9);
}

/* ── COST ITEMS (Costs of Owning / Renting — simple & detailed modes) ──
   Detailed mode stores lists of cost items; simple mode is normalised to a
   single-item list so the engine has exactly one code path.
   Setup item basis:   'fixed' ($ at purchase) | 'pct' (% of buy price at purchase time).
   Ongoing item basis: 'weekly'|'monthly'|'yearly' ($ amount, inflated p.a. by its
   own inflation rate) | 'pct' (own: % of property value; rent: % of annual rent). */
function getOwnSetupItems(S){
  if(S.ownCostsMode==='detailed' && Array.isArray(S.ownSetupCosts) && S.ownSetupCosts.length) return S.ownSetupCosts;
  return [{amount:S.setupCost, basis:S.setupCostType==='pct' ? 'pct' : 'fixed'}];
}
function getOwnOngoingItems(S){
  if(S.ownCostsMode==='detailed' && Array.isArray(S.ownOngoingCosts) && S.ownOngoingCosts.length) return S.ownOngoingCosts;
  return [{amount:S.ownOngoingCost, basis:S.ownOngoingCostType==='pct' ? 'pct' : S.ownOngoingCostFreq, inflation:S.ownOngoingInflation}];
}
function getRentOngoingItems(S){
  if(S.rentCostsMode==='detailed' && Array.isArray(S.rentOngoingCosts) && S.rentOngoingCosts.length) return S.rentOngoingCosts;
  return [{amount:S.rentOngoingCost, basis:S.rentOngoingCostType==='pct' ? 'pct' : S.rentOngoingCostFreq, inflation:S.rentOngoingInflation}];
}
// Total one-time setup cost for a purchase at `price`. % items are a share of
// that price; $ items are in today's money for today's price, so a later
// purchase at a higher price (Rent-Then-Buy) scales them by the same ratio.
function setupCostTotal(S, price){
  const scale = S.propertyPrice > 0 ? price/S.propertyPrice : 1;
  return getOwnSetupItems(S).reduce((t,it)=>{
    const amt = Number(it.amount)||0;
    return t + (it.basis==='pct' ? price*amt/100 : amt*scale);
  }, 0);
}
// Equity left in a home worth `value` owing `loan` if it were sold: the price
// less the selling costs (agent, marketing, legal, seller taxes) and the loan.
function houseEquityAt(S, value, loan){
  return value*(1 - (Number(S.sellingCostPct)||0)/100) - loan;
}
// Yearly ongoing cost of owning for year `yr`, given the property value at the
// start of that year (% items track the value; $ items inflate from year 1).
function ownOngoingYearlyAt(S, yr, propValue){
  return getOwnOngoingItems(S).reduce((t,it)=>{
    const amt = Number(it.amount)||0;
    if(it.basis==='pct') return t + propValue*amt/100;
    return t + toYearly(amt, it.basis) * Math.pow(1+(Number(it.inflation)||0)/100, yr-1);
  }, 0);
}
// Yearly ongoing cost of renting for year `yr`, given that year's monthly rent.
function rentOngoingYearlyAt(S, yr, rentMonthly){
  return getRentOngoingItems(S).reduce((t,it)=>{
    const amt = Number(it.amount)||0;
    if(it.basis==='pct') return t + rentMonthly*12*amt/100;
    return t + toYearly(amt, it.basis) * Math.pow(1+(Number(it.inflation)||0)/100, yr-1);
  }, 0);
}

/* The cash the model starts with. A figure the reader set is used as is;
   left blank, it is the larger of what Own and Rent need on day one:
     Own   the deposit plus setup costs,
     Rent  the first year of rent and renting costs.
   Rent-Then-Buy's deposit plus setup at the future price is reported beside
   it (and its value today at the risk-free rate); a shortfall on the day is
   borrowed, as any negative cash is. */
function initialCashPlan(S){
  S = normalizeState(S);
  const P = S.propertyPrice, rfr = S.riskFreeRate/100, h = S.houseGrowth/100;
  const requiredNow = P*S.downPaymentPct/100 + setupCostTotal(S, P);
  const rentMonthly0 = toMonthly(S.rentAmount, S.rentFreq);
  const rentFirstYearCost = rentMonthly0*12 + rentOngoingYearlyAt(S, 1, rentMonthly0);
  let rtbFutureCost = 0, rtbPresentCost = 0;
  if(S.rtbEnabled){
    const price = P*Math.pow(1+h, S.rtbBuyYear);
    rtbFutureCost  = price*S.downPaymentPct/100 + setupCostTotal(S, price);
    rtbPresentCost = (1+rfr) > 0 ? rtbFutureCost/Math.pow(1+rfr, S.rtbBuyYear) : rtbFutureCost;
  }
  // Rent-Then-Buy's future need is reported, but does not raise the figure:
  // switching that scenario on must leave Own and Rent exactly as they were.
  const autoInitialCash = Math.max(requiredNow, rentFirstYearCost);
  return {requiredNow, rentFirstYearCost, rtbFutureCost, rtbPresentCost, autoInitialCash,
          initialCashUsed: S.initialCash > 0 ? S.initialCash : autoInitialCash};
}

function computeModel(S, variant){
  variant = variant || 'mid';
  S = normalizeState(S);
  const P  = S.propertyPrice;
  const dp = P * S.downPaymentPct/100;
  const loan = P - dp;
  const rfr  = S.riskFreeRate/100;

  // Setup cost (sum of all setup items — simple mode is a single item)
  const setupCostDollar = setupCostTotal(S, P);

  // Mortgage rate schedule (Buy scenario, loan starts day 0).
  // Simple mode = single fixed-rate period; detailed mode = user-defined periods.
  const rateNorm = getRateNorm(S);
  const schedYears = Math.max(S.horizon, 1);
  const ownSched = buildMortgageSchedule(loan, S.mortgageTerm, S.mortgageType, schedYears, rateNorm, variant);
  const ownPayAt = yr => ownSched[Math.min(Math.max(yr,1), ownSched.length)-1].monthlyPayment;
  const mPayment = ownPayAt(1);

  // Monthly rent (year 0)
  const rentMonthly0 = toMonthly(S.rentAmount, S.rentFreq);

  // ── Pre-calculate RTB mortgage (if RTB enabled) ──
  // RTB property price at buyYear, DP%, setup cost, loan, and monthly payment
  const rtbEnabled   = S.rtbEnabled;
  const buyYear      = S.rtbBuyYear;
  const h            = S.houseGrowth/100;
  const ri           = S.rentInflation/100;
  const rtbPropPrice0 = rtbEnabled ? P * Math.pow(1+h, buyYear) : 0;
  const rtbDP0        = rtbEnabled ? rtbPropPrice0 * S.downPaymentPct/100 : 0;
  const rtbLoan0      = rtbEnabled ? Math.max(0, rtbPropPrice0 - rtbDP0) : 0;
  // RTB schedule is indexed by mortgage year (year 1 = first year after purchase)
  const rtbSched0     = rtbEnabled
    ? buildMortgageSchedule(rtbLoan0, S.mortgageTerm, S.mortgageType, schedYears, rateNorm, variant, buyYear)
    : null;

  function ownRequiredMonthly(year){
    const propValueAtYearStart = P * Math.pow(1+h, Math.max(0, year-1));
    const ownOngoingMonthly = ownOngoingYearlyAt(S, year, propValueAtYearStart) / 12;
    return ownPayAt(year) + ownOngoingMonthly;
  }

  function rentRequiredMonthly(year){
    const currentRentMonthly = rentMonthly0 * Math.pow(1+ri, year-1);
    return currentRentMonthly + (rentOngoingYearlyAt(S, year, currentRentMonthly) / 12);
  }

  // The automatic budget is set by Own and Rent alone, so switching
  // Rent-Then-Buy on or off never moves those two; Rent-Then-Buy gets the same
  // budget and borrows (see cashRate) when its later mortgage needs more.
  function getAutoMonthlyBudgetForYear(year){
    return Math.max(ownRequiredMonthly(year), rentRequiredMonthly(year));
  }

  // ── Monthly budget ──
  const budgetIsManual = S.monthlyBudget > 0;
  const monthlyBudget0 = S.monthlyBudget;
  const budgetGrowth   = budgetIsManual ? S.monthlyBudgetIncrease/100 : 0;

  // For KPI warnings we pass the year-1 base budget
  const monthlyBudget = budgetIsManual ? monthlyBudget0 : getAutoMonthlyBudgetForYear(1);

  // ── Initial cash (automatic when left blank) ──
  const {requiredNow, initialCashUsed} = initialCashPlan(S);
  const ownCashStart       = initialCashUsed - requiredNow; // buyer leftover/shortfall → carried into cash
  const renterStartCapital = initialCashUsed;                             // renter invests all

  const rows = [];

  // Year 0
  let ownPropValue    = P;
  let ownPrincipal    = loan;
  let ownCash         = ownCashStart; // buyer surplus cash invested from day 0
  let ownAccumCost    = setupCostDollar;
  let ownAccumInterest= 0;

  let rentCash        = renterStartCapital;
  let rentAccumCost   = 0;
  let rentRent        = rentMonthly0;

  rows.push({
    year:0,
    ownPropValue, ownPrincipal, ownCash,
    ownHouseEquity: houseEquityAt(S, ownPropValue, ownPrincipal),
    ownNetEquity: houseEquityAt(S, ownPropValue, ownPrincipal) + ownCash,
    ownAccumCost: setupCostDollar, ownAccumInterest:0,
    ownMortgagePayment:0,
    rentCash, rentNetEquity:rentCash, rentAccumCost:0, rentRent:rentMonthly0*12,
    netEquityOwn: houseEquityAt(S, ownPropValue, ownPrincipal) + ownCash,
    netEquityRent: rentCash,
    cashOwn: ownCash,
    cashRent: rentCash,
    costOwn: setupCostDollar,
    costRent: 0,
    initialCashUsed, ownCashStart, renterStartCapital,
  });

  const rfm = Math.pow(1+rfr, 1/12)-1; // monthly risk-free
  // Monthly rate on a cash balance in year yr: idle cash earns the risk-free
  // rate; cash below zero is money borrowed, charged the mortgage rate of that
  // year (the schedule's last rate once the term is over). The same rule for
  // every scenario.
  const cashRate = (c, yr) => c >= 0 ? rfm : ownSched[Math.min(yr, ownSched.length)-1].r12;

  for(let yr=1; yr<=S.horizon; yr++){
    // Mortgage rate & payment for this year (re-amortised when the rate changes)
    const yrSched = ownSched[yr-1];
    const mPayYr  = yrSched.monthlyPayment;
    const r12     = yrSched.r12;

    // Rent for this year (inflates each year)
    const currentRentMonthly = rentMonthly0 * Math.pow(1+ri, yr-1);

    // Ongoing costs — monthly equivalent; own uses PREVIOUS year prop value (before appreciation)
    const ownOngoingMonthly  = ownOngoingYearlyAt(S, yr, ownPropValue) / 12;
    const rentOngoingMonthly = rentOngoingYearlyAt(S, yr, currentRentMonthly) / 12;

    // Manual budget for this year (grows p.a. only if manually set)
    const manualMonthlyBudget = budgetIsManual
      ? monthlyBudget0 * Math.pow(1+budgetGrowth, yr-1)
      : null;

    // Cashflow tracking for this year
    const ownBegCash  = ownCash;
    const rentBegCash = rentCash;
    let yearInterest         = 0;
    let ownYearCost          = 0;   // actual expenses (per costInterestOnly toggle)
    let rentYearCost         = 0;
    let ownYearBudget        = 0;
    let ownYearInterestInc   = 0;   // interest income on own cash (RFR return)
    let rentYearInterestInc  = 0;   // interest income on rent cash (RFR return)
    let ownYearOngoingPart   = 0;   // ongoing costs only (no mortgage)
    let rentYearOngoingPart  = 0;   // ongoing costs only (no rent payment)
    let ownYearMortPmt       = 0;   // actual mortgage payments (P+I)

    for(let m=0; m<12; m++){
      const hasMortgage   = ownPrincipal > 1e-2;
      const mMortgage     = hasMortgage ? mPayYr : 0;
      const mOwnCost      = mMortgage + ownOngoingMonthly;   // true monthly cost of owning
      const mRentCost     = currentRentMonthly + rentOngoingMonthly; // true monthly cost of renting

      // ── Budget for this month ──
      const mBudget = budgetIsManual
        ? manualMonthlyBudget
        : getAutoMonthlyBudgetForYear(yr);
      ownYearBudget += mBudget;

      // ── Own: amortise mortgage ──
      let mInterestThisMonth = 0;
      if(hasMortgage){
        mInterestThisMonth  = ownPrincipal * r12;
        const principalPart = S.mortgageType==='pi'
          ? Math.min(mPayYr - mInterestThisMonth, ownPrincipal)
          : 0;
        yearInterest     += mInterestThisMonth;
        ownPrincipal      = Math.max(0, ownPrincipal - principalPart);
        ownAccumInterest += mInterestThisMonth;
      }
      ownYearMortPmt += mMortgage;

      // ── Interest income on cash (BEFORE updating cash) ──
      const ownCashR  = cashRate(ownCash, yr);
      const rentCashR = cashRate(rentCash, yr);
      ownYearInterestInc  += ownCash * ownCashR;
      rentYearInterestInc += rentCash * rentCashR;

      // ── Liquid cash: cash × (1+RFR) + (budget − cost) ──
      const ownSurplus  = mBudget - mOwnCost;
      const rentSurplus = mBudget - mRentCost;
      ownCash  = ownCash  * (1+ownCashR) + ownSurplus;
      rentCash = rentCash * (1+rentCashR) + rentSurplus;

      ownYearOngoingPart  += ownOngoingMonthly;
      rentYearOngoingPart += rentOngoingMonthly;

      // ── Accum Cost: full mortgage+ongoing, or interest+ongoing only per toggle ──
      const ownCostThisMonth = S.costInterestOnly
        ? mInterestThisMonth + ownOngoingMonthly
        : mOwnCost;
      ownAccumCost  += ownCostThisMonth;
      rentAccumCost += mRentCost;
      ownYearCost   += ownCostThisMonth;
      rentYearCost  += mRentCost;
    }
    // Interest-only: the balance falls due with the term's last payment and is
    // repaid from cash (principal, not a cost, unless costs count the whole repayment)
    if(yrSched.balloon > 0 && ownPrincipal > 1e-2){
      const due = ownPrincipal;
      ownCash       -= due;
      ownYearMortPmt += due;
      ownPrincipal   = 0;
      if(!S.costInterestOnly){ ownAccumCost += due; ownYearCost += due; }
    }
    // Derived year values
    const ownYearSurplus  = ownYearBudget - ownYearMortPmt - ownYearOngoingPart;
    const rentYearSurplus = ownYearBudget - rentYearCost;

    // House appreciates at end of year
    ownPropValue = ownPropValue * (1+h);

    const ownHouseEquity = houseEquityAt(S, ownPropValue, ownPrincipal);
    const ownNetEquity   = ownHouseEquity + ownCash;  // equity = property + liquid cash
    const rentNetEquity  = rentCash;                  // renter has no property

    rows.push({
      year:yr,
      ownPropValue, ownPrincipal, ownCash,
      ownHouseEquity, ownNetEquity, ownAccumCost, ownAccumInterest,
      ownMortgagePayment: mPayYr*12,
      ownRateYr: yrSched.rate,
      ownYearInterest: yearInterest,
      ownYearPrincipal: Math.max(0, ownYearMortPmt - yearInterest),
      ownBegCash, ownYearBudget, ownYearCost, ownYearSurplus,
      ownYearOngoing: ownYearOngoingPart,
      ownYearInterestInc,
      rentCash, rentNetEquity, rentAccumCost, rentRent: currentRentMonthly*12,
      rentBegCash, rentYearCost, rentYearSurplus,
      rentYearOngoing: rentYearOngoingPart,
      rentYearInterestInc,
      netEquityOwn: ownNetEquity,
      netEquityRent: rentNetEquity,
      cashOwn: ownCash,
      cashRent: rentCash,
      costOwn: ownAccumCost,
      costRent: rentAccumCost,
      yearlyBudget: ownYearBudget / 12,
    });
  }

  // Breakeven: the year owning moves ahead for good. Found from the horizon
  // backwards, so a lead that is later lost again is not reported as one; when
  // renting is ahead at the horizon there is no breakeven at all, which keeps
  // this card and the Equity Difference card from contradicting each other.
  let breakeven = null;
  for(let i=rows.length-1; i>=1 && rows[i].netEquityOwn>=rows[i].netEquityRent; i--) breakeven = rows[i].year;

  // ── RENT-THEN-BUY SCENARIO ──
  let rtbRows = null;
  if(S.rtbEnabled){
    rtbRows = computeRTB(S, monthlyBudget0, budgetGrowth, budgetIsManual, rentMonthly0, initialCashUsed, getAutoMonthlyBudgetForYear, rtbSched0, cashRate);
  }

  // Range of in-term payments within the horizon (varies under a detailed rate schedule)
  const payRange = (sched, years) => {
    const pays = (sched||[]).slice(0, Math.max(0, Math.min(S.mortgageTerm, years)))
      .map(s=>s.monthlyPayment).filter(p=>p>0);
    return pays.length ? [Math.min(...pays), Math.max(...pays)] : [0, 0];
  };
  const [mPaymentMin, mPaymentMax] = payRange(ownSched, S.horizon);
  const [rtbPaymentMin, rtbPaymentMax] = payRange(rtbSched0, S.horizon - buyYear);

  const last = rows[rows.length-1];
  return {
    rows, breakeven,
    monthlyBudget, mPayment, mPaymentMin, mPaymentMax, rtbPaymentMin, rtbPaymentMax, rentMonthly0,
    rtbRows,
    initialCashUsed, ownCashStart, renterStartCapital,
    summary:{
      ownNetEquity: last.ownNetEquity,
      rentNetEquity: last.rentNetEquity,
      diff: last.ownNetEquity - last.rentNetEquity,
      ownPropValue: last.ownPropValue,
      ownHouseEquity: last.ownHouseEquity,
      ownCash: last.ownCash,
      rentCash: last.rentCash,
      ownAccumCost: last.ownAccumCost,
      rentAccumCost: last.rentAccumCost,
      setupCostDollar,
    }
  };
}

/* ── RENT-THEN-BUY COMPUTATION ──
   Phase 1 (yr 1..buyYear): renting, on the same budget and starting cash as Rent.
   At the end of buyYear it buys at the then-market price: the same deposit %,
   setup costs scaled to that price, and a new loan of the same type and term
   whose rates follow the schedule's calendar years from the purchase onward.
   Phase 2 (yr buyYear+1..horizon): owning, on the same budget as Own and Rent.
   Cash that goes below zero (a deposit it could not cover, a repayment above
   the budget) is borrowed at the mortgage rate, as in every scenario.
*/
function computeRTB(S, monthlyBudget0, budgetGrowth, budgetIsManual, rentMonthly0, initialCashUsed, getAutoMonthlyBudgetForYear, rtbSched, cashRate){
  const P0  = S.propertyPrice;
  const h   = S.houseGrowth/100;
  const ri  = S.rentInflation/100;
  const buyYear = S.rtbBuyYear;

  // RTB renter starts with initialCashUsed (same as pure rent scenario)
  let rtbCash       = initialCashUsed;
  let rtbAccumCost  = 0;
  let rtbPropValue  = 0;
  let rtbPrincipal  = 0;
  let rtbCash2      = 0; // savings after buying
  let rtbAccumInterest = 0;
  let rtbSetupCostAtBuy = 0;
  let rtbMPayment   = 0;
  let rtbPropValueAtBuy = 0;

  const rows = [];

  // Year 0 row (pre-buy phase)
  rows.push({
    year:0,
    phase:'rent',
    rtbPropValue:0, rtbPrincipal:0, rtbCash:rtbCash, rtbCash2:0,
    rtbHouseEquity:0,
    rtbNetEquity: rtbCash,
    rtbAccumCost:0, rtbAccumInterest:0,
    rtbMortgagePayment:0,
    rtbRent: rentMonthly0*12,
    netEquityRTB: rtbCash,
    cashRTB: rtbCash,
    costRTB: 0,
  });

  for(let yr=1; yr<=S.horizon; yr++){
    const currentRentMonthly = rentMonthly0 * Math.pow(1+ri, yr-1);

    if(yr <= buyYear){
      // ─── Phase 1: still renting ───
      const rentOngoingMonthly = rentOngoingYearlyAt(S, yr, currentRentMonthly) / 12;

      const rtbBegCashP1 = rtbCash;
      let rtbP1YearSurplus = 0;
      let rtbP1YearBudget  = 0;
      let rtbP1YearCost    = 0;
      let rtbP1YearInterestInc = 0;
      let rtbP1YearOngoing = 0; // rent + ongoing (all non-mortgage costs during renting)
      for(let m=0; m<12; m++){
        const mRentCost     = currentRentMonthly + rentOngoingMonthly;
        const mBudget = budgetIsManual
          ? monthlyBudget0 * Math.pow(1+budgetGrowth, yr-1)
          : getAutoMonthlyBudgetForYear(yr);
        const rtbCashR = cashRate(rtbCash, yr);
        rtbP1YearInterestInc += rtbCash * rtbCashR;
        const surplus = mBudget - mRentCost;
        rtbCash = rtbCash*(1+rtbCashR) + surplus;
        rtbP1YearSurplus += surplus;
        rtbP1YearBudget  += mBudget;
        rtbP1YearCost    += mRentCost;
        rtbP1YearOngoing += mRentCost; // during renting, "ongoing" = rent + rent-ongoing
        rtbAccumCost += mRentCost;
      }
      const rtbP1Surplus = rtbP1YearBudget - rtbP1YearCost; // net surplus (uncapped)

      if(yr === buyYear){
        // ─── TRANSITION: BUY AT END OF buyYear via standard mortgage ───
        // Property price has grown for buyYear years at RPPI
        rtbPropValueAtBuy = P0 * Math.pow(1+h, buyYear);
        rtbSetupCostAtBuy = setupCostTotal(S, rtbPropValueAtBuy);

        // Down payment = same % as configured, applied to the new (higher) property price
        const rtbDPAtBuy = rtbPropValueAtBuy * S.downPaymentPct / 100;

        // Cash spent at purchase: DP + setup cost
        // Remaining cash stays invested at RFR
        const cashSpent = rtbDPAtBuy + rtbSetupCostAtBuy;
        rtbCash2 = rtbCash - cashSpent; // leftover cash/shortfall after purchase
        rtbAccumCost += rtbSetupCostAtBuy;            // only setup is a true cost

        // Loan = property price − DP (standard mortgage, same rate schedule and term,
        // with the schedule indexed from the purchase year)
        rtbPrincipal = Math.max(0, rtbPropValueAtBuy - rtbDPAtBuy);
        rtbPropValue = rtbPropValueAtBuy;
        rtbMPayment  = rtbSched.length ? rtbSched[0].monthlyPayment : 0;

        // Net Equity = house equity (value less selling costs, less loan) + remaining cash.
        // The drop vs pre-buy is the setup cost plus the selling costs a sale would incur
        // (the deposit itself only moves from cash into the house).
        const rtbHouseEquity = houseEquityAt(S, rtbPropValue, rtbPrincipal); // = DP less selling costs
        const rtbNetEquity   = rtbHouseEquity + rtbCash2;   // = preBuyCash − setup − selling costs
        rows.push({
          year:yr,
          phase:'buy-transition',
          rtbPropValue, rtbPrincipal, rtbCash:rtbCash2, rtbCash2,
          rtbHouseEquity, rtbNetEquity,
          rtbAccumCost, rtbAccumInterest,
          rtbMortgagePayment: rtbMPayment*12,
          rtbBegCash: rtbBegCashP1, rtbYearBudget: rtbP1YearBudget, rtbYearCost: rtbP1YearCost,
          rtbYearOngoing: rtbP1YearOngoing,
          rtbYearInterestInc: rtbP1YearInterestInc,
          rtbYearSurplus: rtbP1Surplus,
          // Cash that leaves the ledger at the purchase (down payment + setup).
          // Reported so the cash row still reconciles: beg + budget + interest
          // income − expenses − purchase outlay = end cash.
          rtbPurchaseOutlay: cashSpent,
          rtbDownPaymentAtBuy: rtbDPAtBuy, rtbSetupAtBuy: rtbSetupCostAtBuy,
          rtbYearInterest:0, rtbYearPrincipal:0,
          rtbRent: currentRentMonthly*12,
          netEquityRTB: rtbNetEquity,
          cashRTB: rtbCash2,
          costRTB: rtbAccumCost,
        });
        continue;
      }

      const rtbNetEq = rtbCash;
      rows.push({
        year:yr,
        phase:'rent',
        rtbPropValue:0, rtbPrincipal:0, rtbCash, rtbCash2:0,
        rtbHouseEquity:0, rtbNetEquity: rtbNetEq,
        rtbAccumCost, rtbAccumInterest:0,
        rtbMortgagePayment:0,
        rtbYearInterest:0, rtbYearPrincipal:0,
        rtbYearSurplus: rtbP1Surplus,
        rtbBegCash: rtbBegCashP1, rtbYearBudget: rtbP1YearBudget, rtbYearCost: rtbP1YearCost,
        rtbYearOngoing: rtbP1YearOngoing,
        rtbYearInterestInc: rtbP1YearInterestInc,
        rtbRent: currentRentMonthly*12,
        netEquityRTB: rtbNetEq,
        cashRTB: rtbCash,
        costRTB: rtbAccumCost,
      });

    } else {
      // ─── Phase 2: now owning (post-buy) ───
      const ownOngoingMonthly = ownOngoingYearlyAt(S, yr, rtbPropValue) / 12;

      // Mortgage year (1 = first year after purchase) → schedule rate & payment
      const rtbMY    = yr - buyYear;
      const rtbSYr   = rtbSched[Math.min(rtbMY, rtbSched.length)-1];
      const rtbPayYr = rtbSYr.monthlyPayment;
      const rtbR12   = rtbSYr.r12;

      const rtbBegCashP2 = rtbCash2;
      let rtbYearInterest = 0, rtbYearPrincipal = 0;
      let rtbYearBudget2 = 0, rtbYearCost2 = 0;
      let rtbYearInterestInc2 = 0, rtbYearOngoing2 = 0, rtbYearMortPmt2 = 0;
      for(let m=0; m<12; m++){
        const hasMortgage = rtbPrincipal > 1e-2;
        const mMortgage   = hasMortgage ? rtbPayYr : 0;
        const mOwnCost    = mMortgage + ownOngoingMonthly;

        let rtbInterest = 0, rtbPrincipalPaid = 0;
        if(hasMortgage){
          rtbInterest      = rtbPrincipal * rtbR12;
          rtbPrincipalPaid = S.mortgageType==='pi'
            ? Math.min(rtbPayYr - rtbInterest, rtbPrincipal)
            : 0;
          rtbPrincipal     = Math.max(0, rtbPrincipal - rtbPrincipalPaid);
          rtbAccumInterest += rtbInterest;
          rtbYearInterest  += rtbInterest;
          rtbYearPrincipal += rtbPrincipalPaid;
        }
        rtbYearMortPmt2 += mMortgage;

        const mBudget = budgetIsManual
          ? monthlyBudget0 * Math.pow(1+budgetGrowth, yr-1)
          : getAutoMonthlyBudgetForYear(yr);
        const rtbCashR = cashRate(rtbCash2, yr);
        rtbYearInterestInc2 += rtbCash2 * rtbCashR;
        const surplus = mBudget - mOwnCost;
        rtbCash2 = rtbCash2*(1+rtbCashR) + surplus;
        rtbYearBudget2   += mBudget;
        rtbYearOngoing2  += ownOngoingMonthly;

        const rtbCostThisMonth = S.costInterestOnly
          ? rtbInterest + ownOngoingMonthly
          : mOwnCost;
        rtbAccumCost += rtbCostThisMonth;
        rtbYearCost2 += rtbCostThisMonth;
      }
      if(rtbSYr.balloon > 0 && rtbPrincipal > 1e-2){
        const due = rtbPrincipal;
        rtbCash2         -= due;
        rtbYearMortPmt2  += due;
        rtbYearPrincipal += due;
        rtbPrincipal      = 0;
        if(!S.costInterestOnly){ rtbAccumCost += due; rtbYearCost2 += due; }
      }
      rtbPropValue = rtbPropValue * (1+h);

      const rtbHouseEquity = houseEquityAt(S, rtbPropValue, rtbPrincipal);
      const rtbNetEquity = rtbHouseEquity + rtbCash2;
      const rtbYearSurplus2 = rtbYearBudget2 - rtbYearMortPmt2 - rtbYearOngoing2;
      rows.push({
        year:yr,
        phase:'own',
        rtbPropValue, rtbPrincipal, rtbCash:0, rtbCash2,
        rtbHouseEquity, rtbNetEquity,
        rtbAccumCost, rtbAccumInterest,
        rtbMortgagePayment: rtbPayYr*12,
        rtbRateYr: rtbSYr.rate,
        rtbYearInterest, rtbYearPrincipal,
        rtbYearSurplus: rtbYearSurplus2,
        rtbBegCash: rtbBegCashP2, rtbYearBudget: rtbYearBudget2, rtbYearCost: rtbYearCost2,
        rtbYearOngoing: rtbYearOngoing2,
        rtbYearInterestInc: rtbYearInterestInc2,
        rtbRent:0,
        netEquityRTB: rtbNetEquity,
        cashRTB: rtbCash2,
        costRTB: rtbAccumCost,
      });
    }
  }

  const rtbDPAtBuy = rtbPropValueAtBuy * S.downPaymentPct / 100;
  const rtbLoanAtBuy = Math.max(0, rtbPropValueAtBuy - rtbDPAtBuy);
  return { rows, rtbMPayment, rtbPropValueAtBuy, rtbSetupCostAtBuy, rtbDPAtBuy, rtbLoanAtBuy };
}

global.RVOEngine = {
  toYearly, toMonthly, calcMonthlyMortgage, normalizeRatePeriods, buildMortgageSchedule,
  getRateNorm, scheduleHasFloat, setupCostTotal, ownOngoingYearlyAt, rentOngoingYearlyAt,
  normalizeState, initialCashPlan, houseEquityAt, computeModel,
};
})(window);
