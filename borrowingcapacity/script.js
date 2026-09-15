/* ═══════════════════════════════════════════════════════════════════════════
   Borrowing Capacity (Australia) — serviceability engine.

   The pipeline below follows the eight steps a lender's credit engine runs.
   Every constant that a lender could set differently is an input, not a magic
   number, so the whole model can be re-derived from what the page shows.

   Step 1  Assessable income = Σ (stream × shading factor).
   Step 2  Tax on ACTUAL taxable income (not the shaded figure):
             income tax − LITO, + Medicare levy, + surcharge when uninsured,
             + HELP, − franking credits. Negative gearing is added back at the
             marginal rate for lenders that allow it.
   Step 3  Living expenses = MAX(declared, HEM). HEM scales with household
           composition, an income band, and a city cost index. It excludes
           rent, mortgage, debt repayments and investment property outgoings.
   Step 4  Commitments: other loans re-amortised at MAX(actual + buffer, floor),
           cards on the LIMIT, instalment debt, support paid, post-settlement
           rent, property outgoings, less anything closed at settlement.
   Step 5  Assessment rate = MAX(product rate + APRA buffer, lender floor).
           Interest only shortens the amortisation window to term − IO period.
   Step 6  Max repayment = net income − living − commitments − UMI buffer,
           inverted through the annuity formula to a loan amount.
   Step 7  Capacity = MIN(serviceability, DTI, LVR, deposit).
   Step 8  NSR and UMI pass/fail at the capacity figure.

   The form in front of that pipeline is progressively disclosed. A Simple /
   Detailed segmented control per section decides how many of a lender's knobs
   the user tunes, an Employee / Self-employed control decides which side of the
   income form is live, and a checklist per section decides which groups exist
   at all. readInputs() is the one place any of that touches a number.

   Reference data
   - City index: coli_no_housing from
     ../costofliving-comparator/cost_of_living_indices_aggregated.json
     (Numbeo-style, Perth = 100). Housing is excluded there, which is exactly
     what HEM excludes, so the two line up.
   - Tax scales: resident rates with the legislated cut to the lowest bracket
     (16% → 15% → 14% across 2025-26, 2026-27, 2027-28).
   ═══════════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

const $ = id => document.getElementById(id);
const cssVar = n => getComputedStyle(document.body).getPropertyValue(n).trim();
const clamp = (v,lo,hi) => Math.min(hi, Math.max(lo, v));

/* ───────────────────────── Formatters ───────────────────────── */
const fmt = {
  currency(v, compact=false){
    const n = Number(v||0), abs = Math.abs(n), sign = n<0 ? '−' : '';
    if(!isFinite(n)) return '—';
    if(compact && abs>=1e9) return sign+'$'+(abs/1e9).toFixed(2)+'b';
    if(compact && abs>=1e6) return sign+'$'+(abs/1e6).toFixed(2)+'m';
    if(compact && abs>=1e3) return sign+'$'+(abs/1e3).toFixed(0)+'k';
    return sign+'$'+abs.toLocaleString('en-AU',{maximumFractionDigits:0});
  },
  money0(v){ const n=Number(v||0); return (n<0?'−':'')+'$'+Math.abs(n).toLocaleString('en-AU',{maximumFractionDigits:0}); },
  pct(v,d=2){ return Number(v||0).toFixed(d)+'%'; },
  num(v,d=0){ return Number(v||0).toLocaleString('en-AU',{minimumFractionDigits:d,maximumFractionDigits:d}); },
  ratio(v,d=2){ return isFinite(v) ? Number(v).toFixed(d)+'×' : '∞'; }
};

/* ───────────────────────── Reference data ───────────────────────── */

// Cost of living excluding housing, Perth = 100. Cross-fed from the
// Cost of Living Comparator's aggregated dataset (Australian rows).
const CITY_INDEX = {
  'Sydney':102.0, 'Melbourne':98.8, 'Brisbane':102.7, 'Perth':100.0,
  'Adelaide':109.2, 'Canberra':106.1, 'Hobart':86.5, 'Gold Coast':84.3,
  'Regional':95.0
};

// HEM benchmark, monthly, at the Perth index and the lowest income band.
// Median basic plus 25th percentile discretionary, excluding all housing
// and debt costs.
const HEM_BASE    = { 1:1850, 2:2750 };
const HEM_PER_DEP = 480;
const HEM_BANDS = [
  { upTo:  60000, f:1.00 },
  { upTo:  90000, f:1.08 },
  { upTo: 130000, f:1.18 },
  { upTo: 180000, f:1.30 },
  { upTo: 250000, f:1.45 },
  { upTo: Infinity, f:1.62 }
];

// Resident tax scales. [upper bound of bracket, marginal rate].
const TAX_SCALES = {
  '2025-26': [[18200,0],[45000,0.16],[135000,0.30],[190000,0.37],[Infinity,0.45]],
  '2026-27': [[18200,0],[45000,0.15],[135000,0.30],[190000,0.37],[Infinity,0.45]],
  '2027-28': [[18200,0],[45000,0.14],[135000,0.30],[190000,0.37],[Infinity,0.45]]
};

// Low Income Tax Offset: $700, withdrawn at 5c then 1.5c in the dollar.
const LITO = { max:700, t1:37500, r1:0.05, t2:45000, r2:0.015 };

// Medicare levy: 2%, nil below the low income threshold, phased in at 10c
// in the dollar up to 1.25 × the threshold. Latest published thresholds.
const MEDICARE = { rate:0.02, phaseIn:0.10, single:27222, family:45907, perChild:4216 };

// Medicare Levy Surcharge tiers, latest published thresholds. The family
// threshold lifts by $1,500 for each dependent child after the first.
const MLS = {
  single: [[101000,0],[118000,0.010],[158000,0.0125],[Infinity,0.015]],
  family: [[202000,0],[236000,0.010],[316000,0.0125],[Infinity,0.015]],
  perChildAfterFirst: 1500
};

// HELP: marginal repayment on income above the threshold.
const HELP = { tier2:125000, rate1:0.15, rate2:0.17 };

const FRANKING_COMPANY_RATE = 0.30;

/* ───────────────────────── Tax primitives ───────────────────────── */

function incomeTax(taxable, year){
  const scale = TAX_SCALES[year] || TAX_SCALES['2026-27'];
  let tax = 0, prev = 0;
  for(const [upTo, rate] of scale){
    if(taxable <= prev) break;
    tax += (Math.min(taxable, upTo) - prev) * rate;
    prev = upTo;
  }
  return tax;
}

// Marginal rate on the next dollar, measured rather than looked up, so the
// LITO withdrawal tapers and the Medicare levy phase-in are both included.
function marginalTaxRate(taxable, year, adults, deps){
  const f = x => Math.max(0, incomeTax(x, year) - litoAmount(x)) + medicareLevy(x, adults, deps);
  return f(taxable + 1) - f(taxable);
}

function litoAmount(taxable){
  if(taxable <= LITO.t1) return LITO.max;
  if(taxable <= LITO.t2) return Math.max(0, LITO.max - LITO.r1*(taxable - LITO.t1));
  const atT2 = LITO.max - LITO.r1*(LITO.t2 - LITO.t1);
  return Math.max(0, atT2 - LITO.r2*(taxable - LITO.t2));
}

function medicareLevy(taxable, adults, deps){
  const isFamily = adults >= 2 || deps > 0;
  const lower = isFamily ? MEDICARE.family + MEDICARE.perChild*deps : MEDICARE.single;
  const upper = lower * 1.25;
  if(taxable <= lower) return 0;
  if(taxable < upper)  return MEDICARE.phaseIn * (taxable - lower);
  return MEDICARE.rate * taxable;
}

function mlsRate(surchargeIncome, adults, deps){
  const isFamily = adults >= 2 || deps > 0;
  const tiers = isFamily ? MLS.family : MLS.single;
  const lift  = isFamily ? MLS.perChildAfterFirst * Math.max(0, deps - 1) : 0;
  for(const [upTo, rate] of tiers){ if(surchargeIncome <= upTo + lift) return rate; }
  return tiers[tiers.length-1][1];
}

function helpRepayment(repaymentIncome, threshold){
  if(repaymentIncome <= threshold) return 0;
  const tier2 = Math.max(threshold, HELP.tier2);
  if(repaymentIncome <= tier2) return HELP.rate1 * (repaymentIncome - threshold);
  return HELP.rate1*(tier2 - threshold) + HELP.rate2*(repaymentIncome - tier2);
}

/* ───────────────────────── Loan primitives ───────────────────────── */

// Level repayment that amortises P over n periods at periodic rate i.
function amortPayment(P, i, n){
  if(n <= 0 || P <= 0) return 0;
  if(i === 0) return P/n;
  return P * i / (1 - Math.pow(1+i, -n));
}

// The loan a given level repayment can support. The inverse of amortPayment.
function loanFromPayment(pmt, i, n){
  if(n <= 0 || pmt <= 0) return 0;
  if(i === 0) return pmt * n;
  return pmt * (1 - Math.pow(1+i, -n)) / i;
}

/* ───────────────────────── HEM ───────────────────────── */

function hemMonthly(city, adults, deps, grossIncome){
  const base = (HEM_BASE[adults] || HEM_BASE[1]) + HEM_PER_DEP * deps;
  const cityF = (CITY_INDEX[city] != null ? CITY_INDEX[city] : 100) / 100;
  let bandF = HEM_BANDS[HEM_BANDS.length-1].f;
  for(const b of HEM_BANDS){ if(grossIncome <= b.upTo){ bandF = b.f; break; } }
  return base * cityF * bandF;
}

/* ═════════════════════ The engine ═════════════════════ */

function compute(p){
  /* ── Step 1: assessable income ──────────────────────────────────── */
  const divGrossUp  = p.div * (p.frankPct/100) * (FRANKING_COMPANY_RATE/(1-FRANKING_COMPANY_RATE));
  const divGrossed  = p.div + divGrossUp;

  const streams = [
    { key:'payg',    label:'Base salary (PAYG)',              amount:p.payg,              shade:p.shdPayg    },
    { key:'ot',      label:'Overtime',                        amount:p.overtime,          shade:p.shdOvertime},
    { key:'bonus',   label:'Bonus or commission',             amount:p.bonus,             shade:p.shdBonus   },
    { key:'allow',   label:'Allowances',                      amount:p.allow,             shade:p.shdAllow   },
    { key:'casual',  label:'Casual or second job',            amount:p.casual,            shade:p.shdCasual  },
    { key:'se',      label:'Self-employed NPAT plus add-backs', amount:p.seNpat + p.seAdd, shade:p.shdSe     },
    { key:'rent',    label:'Gross rental income',             amount:p.rent,              shade:p.shdRent    },
    { key:'div',     label:'Dividends, grossed up',           amount:divGrossed,          shade:p.shdDiv     },
    { key:'ftb',     label:'Family Tax Benefit A and B',      amount:p.ftb,               shade:p.shdFtb     },
    { key:'pension', label:'Centrelink pension or DSP',       amount:p.pension,           shade:p.shdPension },
    { key:'csIn',    label:'Child support received',          amount:p.csIn,              shade:p.shdCsIn    }
  ];
  streams.forEach(s => { s.assessable = s.amount * s.shade/100; });

  const grossAssessable = streams.reduce((a,s) => a + s.assessable, 0);
  const grossUnshaded   = streams.reduce((a,s) => a + s.amount, 0);

  /* ── Step 2: tax on actual taxable income ───────────────────────── */
  const rentalNet    = p.rent - p.ipCash - p.ipDep;   // after interest and depreciation
  const rentalProfit = Math.max(0, rentalNet);
  const rentalLoss   = Math.max(0, -rentalNet);

  const taxableIncome = p.payg + p.overtime + p.bonus + p.allow + p.casual
                      + p.seNpat + rentalProfit + divGrossed
                      + (p.pensionTaxable ? p.pension : 0);

  // Add net investment losses back for the tests that use a wider income base.
  const adjustedIncome = taxableIncome + rentalLoss;

  const grossTax  = incomeTax(taxableIncome, p.taxYear);
  const lito      = litoAmount(taxableIncome);
  const netIncTax = Math.max(0, grossTax - lito);
  const medicare  = medicareLevy(taxableIncome, p.adults, p.deps);
  const surcharge = p.privHealth ? 0 : mlsRate(adjustedIncome, p.adults, p.deps) * taxableIncome;
  const helpAmt   = p.helpMode === 'none' ? 0 : helpRepayment(adjustedIncome, p.helpThreshold);
  const helpAsTax        = p.helpMode === 'tax'        ? helpAmt : 0;
  const helpAsCommitment = p.helpMode === 'commitment' ? helpAmt : 0;

  // The franking credit is already in income, because the dividend is grossed
  // up in Step 1. Subtracting it from tax as well would count it twice, so the
  // full tax on the grossed-up amount stands.
  const totalTax = netIncTax + medicare + surcharge + helpAsTax;

  const mRate    = marginalTaxRate(taxableIncome, p.taxYear, p.adults, p.deps);
  const negGear  = p.negGear ? mRate * rentalLoss : 0;

  const netMonthly = (grossAssessable - totalTax + negGear) / 12;

  /* ── Step 3: living expenses ────────────────────────────────────── */
  const hem      = hemMonthly(p.city, p.adults, p.deps, grossUnshaded);
  const living   = Math.max(p.declaredExp, hem);
  const hemBinds = hem >= p.declaredExp;

  /* ── Step 4: existing commitments ───────────────────────────────── */
  const otherAssessRate = Math.max(p.olRate + p.buffer, p.floorRate);
  const otherMonths = p.olType === 'io'
        ? Math.max(1, (p.olTerm - p.olIo)) * 12
        : Math.max(1, p.olTerm) * 12;
  const otherRepay = amortPayment(p.olBal, otherAssessRate/100/12, otherMonths);
  const cardRepay  = p.cardLimit * p.cardPct/100;
  const rentBoard  = p.occupancy === 'investor' ? p.rentBoard : 0;

  const helpCommMonthly = helpAsCommitment / 12;
  const commitLines = [
    { label:'Other home and investment loans, reassessed', value: otherRepay,
      note: p.olBal>0 ? `${fmt.pct(otherAssessRate)} over ${Math.round(otherMonths/12)} yrs` : '' },
    { label:'Credit cards and lines of credit',  value: cardRepay,
      note: p.cardLimit>0 ? `${fmt.pct(p.cardPct)} of the ${fmt.money0(p.cardLimit)} limit` : '' },
    { label:'Personal and car loans',            value: p.persRepay,   note:'' },
    { label:'Buy now pay later',                 value: p.bnplRepay,   note:'' },
    { label:'HELP repayment',                    value: helpCommMonthly,
      note: helpCommMonthly>0 ? 'counted below the line, not as tax' : '' },
    { label:'Child support or maintenance paid', value: p.csOut,       note:'' },
    { label:'Rent or board after settlement',    value: rentBoard,
      note: p.occupancy === 'owner' ? 'nil, owner occupier' : '' },
    { label:'Investment property outgoings',     value: p.ipOut,       note:'not netted off rent' },
    { label:'Strata, rates and insurance on the new property', value: p.newPropCosts, note:'' },
    { label:'Less facilities closed at settlement', value: -p.refiRepay, note:'' }
  ];
  const commitRaw   = commitLines.reduce((a,l) => a + l.value, 0);
  const commitments = Math.max(0, commitRaw);

  /* ── Step 5: assessment rate on the new loan ────────────────────── */
  const assessRate  = Math.max(p.prodRate + p.buffer, p.floorRate);
  const bufferedRate= p.prodRate + p.buffer;
  const i = assessRate/100/12;
  const nMonths = p.newType === 'io'
        ? Math.max(1, (p.termYears - p.newIo)) * 12
        : Math.max(1, p.termYears) * 12;

  /* ── Step 6: solve for the maximum loan ─────────────────────────── */
  const maxRepay  = netMonthly - living - commitments - p.umiReq;
  const lmiFactor = p.lmiCap ? 1 + p.lmiRate/100 : 1;
  const Lserv = Math.max(0, loanFromPayment(Math.max(0, maxRepay), i, nMonths) / lmiFactor);

  /* ── Step 7: the hard caps ──────────────────────────────────────── */
  const dtiIncome   = p.dtiBasis === 'assessable' ? grossAssessable : grossUnshaded;
  const existingDebt= Math.max(0, p.olBal + p.cardLimit + p.persBal + p.bnplLimit - p.refiBal);
  const Ldti = Math.max(0, p.dtiCap * dtiIncome - existingDebt);

  const lvr  = clamp(p.lvrMax, 0, 99.9)/100;
  const Llvr = lvr * Math.min(p.price, p.valuation);

  const stampDuty    = p.dutyMode === 'pct' ? p.price * p.dutyPct/100 : p.dutyAmt;
  const purchaseCosts= stampDuty + p.legalFees + p.transferFees + p.inspections;
  const availFunds   = p.savings + p.gift + p.grant - purchaseCosts;
  const Ldep = Math.max(0, availFunds / (1 - lvr) * lvr);

  const caps = [
    { key:'serv', label:'Serviceability',  value:Lserv },
    { key:'dti',  label:'Debt to income',  value:Ldti  },
    { key:'lvr',  label:'Loan to value',   value:Llvr  },
    { key:'dep',  label:'Deposit',         value:Ldep  }
  ];
  const maxLoan = Math.min(Lserv, Ldti, Llvr, Ldep);
  const binding = caps.reduce((a,c) => c.value < a.value ? c : a, caps[0]);

  /* ── Step 8: NSR and UMI at the capacity figure ─────────────────── */
  const repayAtMax = amortPayment(maxLoan * lmiFactor, i, nMonths);
  const outgoings  = living + commitments + repayAtMax;
  const nsr = outgoings > 0 ? netMonthly / outgoings : Infinity;
  const umi = netMonthly - outgoings;

  const maxPrice = Math.max(0, maxLoan + availFunds);
  const dtiAtMax = dtiIncome > 0 ? (maxLoan + existingDebt) / dtiIncome : Infinity;

  return {
    streams, grossAssessable, grossUnshaded, divGrossUp, divGrossed,
    rentalNet, rentalProfit, rentalLoss, taxableIncome, adjustedIncome,
    grossTax, lito, netIncTax, medicare, surcharge, helpAmt, helpAsTax,
    helpAsCommitment, totalTax, mRate, negGear, netMonthly,
    hem, living, hemBinds,
    commitLines, commitRaw, commitments, helpCommMonthly, otherRepay, otherAssessRate, otherMonths, cardRepay,
    assessRate, bufferedRate, nMonths, i, lmiFactor,
    maxRepay, Lserv, Ldti, Llvr, Ldep, caps, maxLoan, binding,
    existingDebt, dtiIncome, dtiAtMax, stampDuty, purchaseCosts, availFunds,
    repayAtMax, outgoings, nsr, umi, maxPrice,
    nsrPass: nsr >= p.nsrMin - 1e-9,
    umiPass: umi >= p.umiReq - 1e-6
  };
}

/* ═════════════════════ Progressive disclosure ═════════════════════

   Two independent dials sit above the form, and readInputs() is the single
   place where either of them can change a number:

   - The Simple / Detailed segmented control governs how much of a section the
     user tunes. Its hidden rows are still live: they hold the standard lender
     setting, which the Simple view discloses in a note underneath the field it
     applies to.
   - The checklists govern whether a thing exists at all. An unticked box zeroes
     its inputs outright, so a group the user has scrolled past never leaks a
     stale figure into the result.
   ══════════════════════════════════════════════════════════════════════════ */

const UI_DEFAULTS = { incWho:'employee', incMode:'simple', debtsMode:'simple',
                      loanMode:'simple', capsMode:'simple' };
const UI = { ...UI_DEFAULTS };

// Segmented control id → the UI key it writes.
const SEG_GROUPS = {
  incWhoGroup:'incWho', incModeGroup:'incMode', debtsModeGroup:'debtsMode',
  loanModeGroup:'loanMode', capsModeGroup:'capsMode'
};

// The detailed employment and business streams, by side of the Employee /
// Self-employed switch. Used both to gate them and to carry the headline
// figure across when the user flips between Simple and Detailed.
const DETAIL_STREAMS = {
  employee: ['incPayg','incOvertime','incBonus','incAllow','incCasual'],
  self:     ['incSeNpat','incSeAdd']
};

function segActive(){
  Object.entries(SEG_GROUPS).forEach(([groupId, key]) => {
    const g = $(groupId); if(!g) return;
    g.querySelectorAll('.seg-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.val === UI[key]));
  });
}

// Rows whose visibility turns on the value of another control rather than on a
// mode or a checklist. Keyed by element id so they go through the same single
// pass, which is what stops one rule showing a row another rule just hid.
const EXTRA_RULES = {
  olIoRow:          () => str('olType') === 'io',
  rentBoardRow:     () => str('occupancy') === 'investor',
  helpThresholdRow: () => str('helpMode') !== 'none',
  dutyPctWrap:      () => str('dutyMode') === 'pct',
  dutyAmtWrap:      () => str('dutyMode') !== 'pct'
};

// data-adv / data-simple gate on a section's mode, data-who on the Employee /
// Self-employed switch, and data-when on one or more checklist boxes. An
// element may carry several, and every one of them has to pass.
function isVisible(el){
  const d = el.dataset;
  if(d.adv    && UI[d.adv + 'Mode'] !== 'detailed') return false;
  if(d.simple && UI[d.simple + 'Mode'] !== 'simple') return false;
  if(d.who    && UI.incWho !== d.who) return false;
  if(d.when   && !d.when.split(/\s+/).every(id => { const c = $(id); return c && c.checked; })) return false;
  const extra = EXTRA_RULES[el.id];
  return extra ? extra() : true;
}

function applyVisibility(){
  const els = new Set(document.querySelectorAll('[data-adv],[data-simple],[data-who],[data-when]'));
  Object.keys(EXTRA_RULES).forEach(id => { const el = $(id); if(el) els.add(el); });
  els.forEach(el => { el.style.display = isVisible(el) ? '' : 'none'; });
}

/* ═════════════════════ Reading the form ═════════════════════ */

const num = id => SharedFmt.parseFormatted($(id).value);
const bool = id => $(id).checked;
const str  = id => $(id).value;

function readInputs(){
  const p = {
    payg:num('incPayg'),          shdPayg:num('shdPayg'),
    overtime:num('incOvertime'),  shdOvertime:num('shdOvertime'),
    bonus:num('incBonus'),        shdBonus:num('shdBonus'),
    allow:num('incAllow'),        shdAllow:num('shdAllow'),
    casual:num('incCasual'),      shdCasual:num('shdCasual'),
    seNpat:num('incSeNpat'),      seAdd:num('incSeAdd'),  shdSe:num('shdSe'),
    rent:num('incRent'),          shdRent:num('shdRent'),
    ipCash:num('ipCash'),         ipDep:num('ipDep'),     negGear:bool('negGear'),
    div:num('incDiv'),            shdDiv:num('shdDiv'),   frankPct:num('frankPct'),
    ftb:num('incFtb'),            shdFtb:num('shdFtb'),
    pension:num('incPension'),    shdPension:num('shdPension'), pensionTaxable:bool('pensionTaxable'),
    csIn:num('incCsIn'),          shdCsIn:num('shdCsIn'),

    city:str('city'),  adults:parseInt(str('adults'),10) || 1,  deps:num('deps'),
    declaredExp:num('declaredExp'), privHealth:bool('privHealth'),
    helpMode:str('helpMode'), helpThreshold:num('helpThreshold'), taxYear:str('taxYear'),

    olBal:num('olBal'), olRate:num('olRate'), olTerm:num('olTerm'),
    olType:str('olType'), olIo:num('olIo'),
    cardLimit:num('cardLimit'), cardPct:num('cardPct'),
    persRepay:num('persRepay'), persBal:num('persBal'),
    bnplRepay:num('bnplRepay'), bnplLimit:num('bnplLimit'),
    csOut:num('csOut'), occupancy:str('occupancy'), rentBoard:num('rentBoard'),
    ipOut:num('ipOut'), newPropCosts:num('newPropCosts'),
    refiRepay:num('refiRepay'), refiBal:num('refiBal'),

    prodRate:num('prodRate'), buffer:num('buffer'), floorRate:num('floorRate'),
    termYears:num('termYears'), newType:bool('hasIo') ? 'io' : 'pi', newIo:num('newIo'),
    umiReq:num('umiReq'), nsrMin:num('nsrMin'),

    dtiCap:num('dtiCap'), dtiBasis:str('dtiBasis'),
    lvrMax:num('lvrMax'), price:num('price'), valuation:num('valuation'),
    lmiCap:bool('lmiCap'), lmiRate:num('lmiRate'),
    savings:num('savings'), gift:num('gift'), grant:num('grant'),
    dutyMode:str('dutyMode'), dutyPct:num('dutyPct'), dutyAmt:num('dutyAmt'),
    legalFees:num('legalFees'), transferFees:num('transferFees'), inspections:num('inspections')
  };

  /* ── Income: Simple takes one gross figure at 100%, which is how a lender
        treats base salary and two-year-average business profit alike. ── */
  if(UI.incMode === 'simple'){
    const v = num('incSimple');
    p.payg = UI.incWho === 'employee' ? v : 0;  p.shdPayg = 100;
    p.overtime = p.bonus = p.allow = p.casual = 0;
    p.seNpat = UI.incWho === 'self' ? v : 0;    p.seAdd = 0;  p.shdSe = 100;
  } else {
    if(UI.incWho !== 'employee') p.payg = p.overtime = p.bonus = p.allow = p.casual = 0;
    if(UI.incWho !== 'self')     p.seNpat = p.seAdd = 0;
  }

  /* ── Checklists: an unticked box means the thing does not exist. ── */
  if(!bool('hasInvest')){ p.rent = p.ipCash = p.ipDep = p.div = p.ipOut = 0; }
  if(!bool('hasGov')){ p.ftb = p.pension = p.csIn = 0; }
  if(!bool('hasHomeLoan')){ p.olBal = 0; }
  if(!bool('hasCard')){ p.cardLimit = 0; }
  if(!bool('hasPersonal')){ p.persRepay = p.persBal = 0; }
  if(!bool('hasBnpl')){ p.bnplRepay = p.bnplLimit = 0; }
  if(!bool('hasSupport')){ p.csOut = 0; }
  if(!bool('hasRefi')){ p.refiRepay = p.refiBal = 0; }
  if(!bool('hasGift')){ p.gift = 0; }
  if(!bool('hasGrant')){ p.grant = 0; }

  return p;
}

/* ═════════════════════ Income sweep for the chart ═════════════════════ */

// Salary, business and investment income scale together. Government payments
// are needs tested rather than earned, so they hold still.
const SCALABLE = ['payg','overtime','bonus','allow','casual','seNpat','seAdd','rent','div'];
const SWEEP_POINTS = 25;                       // index 12 is the user's own scenario
const USER_INDEX   = (SWEEP_POINTS - 1) / 2;

function buildSweep(p){
  const base = SCALABLE.reduce((a,k) => a + p[k], 0);
  const rows = [];
  const tiny = base < 1000;
  for(let j=0; j<SWEEP_POINTS; j++){
    const q = { ...p };
    if(tiny){
      // Nothing to scale, so sweep a notional salary instead.
      q.payg = 300000 * j/(SWEEP_POINTS-1);
    } else {
      const k = 0.4 + 1.2 * j/(SWEEP_POINTS-1);
      SCALABLE.forEach(key => { q[key] = p[key] * k; });
    }
    const r = compute(q);
    rows.push({ x:r.grossUnshaded, serv:r.Lserv, dti:r.Ldti, lvr:r.Llvr, dep:r.Ldep, cap:r.maxLoan });
  }
  return { rows, tiny };
}

/* ═════════════════════ Rendering ═════════════════════ */

let chart = null;
let last = null;
let persist = null;

// Labels and tooltips that follow the Employee / Self-employed switch, so the
// one Simple field reads correctly on either side of it.
const SIMPLE_INC = {
  employee: {
    label: 'Total employment income',
    tip: 'Gross salary and wages for the year, before tax and <strong>excluding</strong> employer super. Counted in full, which is how a lender treats base salary.',
    note: 'Annual and gross, counted in full. Switch to Detailed to split out overtime, bonus, allowances and a second job, each with its own shading.'
  },
  self: {
    label: 'Business income you draw on',
    tip: 'Two year average net profit after tax of the business, plus any add-backs. Counted in full, which is how a lender treats an established trading history.',
    note: 'Annual, two year average, counted in full. Switch to Detailed to separate NPAT from add-backs and shade them.'
  }
};

function syncUI(){
  $('depsValue').textContent    = fmt.num(num('deps'));
  $('cardPctValue').textContent = fmt.pct(num('cardPct'));
  $('bufferValue').textContent  = fmt.pct(num('buffer'));
  $('floorValue').textContent   = fmt.pct(num('floorRate'));
  $('nsrValue').textContent     = num('nsrMin').toFixed(2);
  $('dtiValue').textContent     = num('dtiCap').toFixed(2)+'×';
  $('lvrValue').textContent     = fmt.pct(num('lvrMax'),0);

  segActive();
  applyVisibility();

  const si = SIMPLE_INC[UI.incWho];
  $('incSimpleLabel').textContent = si.label;
  $('incSimpleTip').setAttribute('data-tip', si.tip);
  $('incSimpleNote').textContent  = si.note;

  // What each Simple view is quietly assuming on the user's behalf.
  const olYears = str('olType')==='io' ? num('olTerm') - num('olIo') : num('olTerm');
  $('olSimpleNote').textContent = `Reassessed as principal and interest over ${fmt.num(olYears)} years, `
    + `at the higher of this plus the buffer and the lender floor.`;
  $('cardSimpleNote').textContent = `Assessed at ${fmt.pct(num('cardPct'))} of the limit a month, `
    + `whatever the balance.`;
  $('loanSimpleNote').textContent = `Tested at the higher of ${fmt.pct(num('prodRate') + num('buffer'))} `
    + `(product rate plus the ${fmt.pct(num('buffer'))} APRA buffer) and the ${fmt.pct(num('floorRate'))} lender floor, `
    + `keeping ${fmt.money0(num('umiReq'))}/mo spare and an NSR of at least ${num('nsrMin').toFixed(2)}.`;
  $('capsSimpleNote').textContent = `Debt is also capped at ${num('dtiCap').toFixed(1)}× gross income, `
    + `and the LVR is measured against a ${fmt.money0(num('valuation'))} bank valuation.`;
  $('feesSimpleNote').textContent = `Plus ${fmt.money0(num('legalFees') + num('transferFees') + num('inspections'))} `
    + `of legal, transfer and inspection fees.`;
}

function renderKpis(r, p){
  $('kpiLoan').textContent = fmt.money0(r.maxLoan);
  $('kpiLoanSub').textContent = `assessed at ${fmt.pct(r.assessRate)} over ${Math.round(r.nMonths/12)} years`;

  $('kpiBind').textContent = r.binding.label;
  $('kpiBind').className = 'value small';
  const secondLowest = r.caps.filter(c=>c.key!==r.binding.key).reduce((a,c)=>Math.min(a,c.value), Infinity);
  $('kpiBindSub').textContent = `next limit is ${fmt.money0(secondLowest)}, ${fmt.money0(secondLowest - r.maxLoan)} above`;

  $('kpiPrice').textContent = fmt.money0(r.maxPrice);
  $('kpiPriceSub').textContent = `loan plus ${fmt.money0(r.availFunds)} deposit after ${fmt.money0(r.purchaseCosts)} of costs`;

  $('kpiRepay').textContent = fmt.money0(r.repayAtMax)+'/mo';
  const actualRepay = amortPayment(r.maxLoan*r.lmiFactor, p.prodRate/100/12, Math.max(1,p.termYears)*12);
  $('kpiRepaySub').textContent = `${fmt.money0(actualRepay)}/mo at the ${fmt.pct(p.prodRate)} product rate`;

  $('kpiNsr').textContent = fmt.ratio(r.nsr);
  $('kpiNsr').className = 'value ' + (r.nsrPass ? 'pos' : 'neg');
  $('kpiNsrSub').textContent = (r.nsrPass ? 'passes' : 'fails') + ` the ${p.nsrMin.toFixed(2)} minimum`;

  $('kpiUmi').textContent = fmt.money0(r.umi)+'/mo';
  $('kpiUmi').className = 'value ' + (r.umiPass ? 'pos' : 'neg');
  $('kpiUmiSub').textContent = (r.umiPass ? 'passes' : 'fails') + ` the ${fmt.money0(p.umiReq)} minimum surplus`;
}

function table(head, rows){
  return '<table><thead><tr>' + head.map(h=>`<th>${h}</th>`).join('') + '</tr></thead><tbody>'
       + rows.map(r => `<tr class="${r.cls||''}">` + r.cells.map((c,idx) =>
           `<td class="${(r.cellCls&&r.cellCls[idx])||''}">${c}</td>`).join('') + '</tr>').join('')
       + '</tbody></table>';
}

function renderCaps(r){
  const rows = r.caps.map(c => ({
    cls: c.key===r.binding.key ? 'bind' : '',
    cells: [
      c.label,
      fmt.money0(c.value),
      c.key===r.binding.key ? '—' : '+'+fmt.money0(c.value - r.maxLoan),
      c.key===r.binding.key
        ? '<span class="badge badge-warning">Binding</span>'
        : '<span class="badge badge-info">Slack</span>'
    ],
    cellCls: ['','','','']
  }));
  rows.push({ cls:'total', cells:['Borrowing capacity', fmt.money0(r.maxLoan), '', ''], cellCls:['','','',''] });
  $('capsTableWrap').innerHTML = table(['Constraint','Limit','Headroom','Status'], rows);
}

function renderBuild(r, p){
  const M = v => fmt.money0(v);
  const A = v => fmt.money0(v*12);
  const rows = [];
  const push = (label, monthly, note, cls, cellCls) =>
    rows.push({ cls:cls||'', cells:[label, M(monthly), A(monthly), note||''], cellCls: cellCls || ['','','','note'] });

  push('Gross assessable income', r.grossAssessable/12, `${M(r.grossUnshaded/12)}/mo entered, shaded to ${fmt.pct(r.grossUnshaded? r.grossAssessable/r.grossUnshaded*100 : 0,1)}`);
  push('Income tax after LITO', -r.netIncTax/12, `on ${M(r.taxableIncome/12)}/mo taxable, LITO ${M(r.lito/12)}/mo`, '', ['','neg','neg','note']);
  push('Medicare levy', -r.medicare/12, '', '', ['','neg','neg','note']);
  if(r.surcharge > 0) push('Medicare levy surcharge', -r.surcharge/12, 'no private hospital cover', '', ['','neg','neg','note']);
  if(r.helpAsTax > 0) push('HELP repayment', -r.helpAsTax/12, `on ${M(r.adjustedIncome/12)}/mo repayment income`, '', ['','neg','neg','note']);
  push('Total tax', -r.totalTax/12, r.divGrossUp > 0
        ? `includes ${M(r.divGrossUp/12)}/mo of franking credits already counted in income`
        : '', 'total', ['','neg','neg','note']);
  if(r.negGear > 0) push('Negative gearing add-back', r.negGear/12, `${fmt.pct(r.mRate*100,1)} on a ${M(r.rentalLoss/12)}/mo rental loss`, '', ['','pos','pos','note']);
  push('Net income available', r.netMonthly, '', 'total');
  push('Living expenses', -r.living, r.hemBinds
        ? `HEM ${M(r.hem)}/mo overrides the ${M(p.declaredExp)}/mo declared`
        : `declared ${M(p.declaredExp)}/mo exceeds HEM ${M(r.hem)}/mo`, '', ['','neg','neg','note']);
  push('Existing commitments', -r.commitments, '', '', ['','neg','neg','note']);
  push('Minimum surplus buffer (UMI)', -p.umiReq, '', '', ['','neg','neg','note']);
  push('Maximum new repayment', r.maxRepay, '', 'total', r.maxRepay<0 ? ['','neg','neg','note'] : ['','','','note']);
  rows.push({ cls:'', cells:['Assessment rate', fmt.pct(r.assessRate), '',
        `higher of ${fmt.pct(r.bufferedRate)} buffered and the ${fmt.pct(p.floorRate)} floor`], cellCls:['','','','note'] });
  rows.push({ cls:'', cells:['Amortisation window', Math.round(r.nMonths/12)+' yrs', r.nMonths+' mo',
        p.newType==='io' ? `${p.termYears} yr term less ${p.newIo} yrs interest only` : 'full term, principal and interest'], cellCls:['','','','note'] });
  if(r.lmiFactor > 1) rows.push({ cls:'', cells:['LMI capitalised', fmt.pct((r.lmiFactor-1)*100), '',
        'serviced on top of the base loan'], cellCls:['','','','note'] });
  rows.push({ cls:'total', cells:['Loan this supports', fmt.money0(r.Lserv), '',
        'maximum repayment inverted through the annuity formula'], cellCls:['','','','note'] });
  $('buildTableWrap').innerHTML = table(['Item','Monthly','Annual','Note'], rows);
}

function renderIncome(r){
  const rows = r.streams.filter(s => s.amount !== 0).map(s => ({
    cells:[s.label, fmt.money0(s.amount), fmt.pct(s.shade,0), fmt.money0(s.assessable)], cellCls:['','','','']
  }));
  if(!rows.length) rows.push({ cells:['No income entered','$0','—','$0'], cellCls:['','','',''] });
  rows.push({ cls:'total', cells:['Total', fmt.money0(r.grossUnshaded),
        fmt.pct(r.grossUnshaded ? r.grossAssessable/r.grossUnshaded*100 : 0, 1), fmt.money0(r.grossAssessable)], cellCls:['','','',''] });
  $('incomeTableWrap').innerHTML = table(['Stream','Entered, annual','Shading','Assessable'], rows);
}

function renderCommitments(r){
  const rows = r.commitLines.filter(l => l.value !== 0).map(l => ({
    cells:[l.label, fmt.money0(l.value), l.note], cellCls:['', l.value<0?'pos':'neg', 'note']
  }));
  if(!rows.length) rows.push({ cells:['No commitments entered','$0',''], cellCls:['','','note'] });
  rows.push({ cls:'total', cells:['Total monthly commitments', fmt.money0(r.commitments),
        r.commitRaw < 0 ? 'floored at zero, the closures exceed every other commitment' : ''], cellCls:['','neg','note'] });
  $('commTableWrap').innerHTML = table(['Item','Monthly','Note'], rows);
}

// The HEM benchmark is not a warning, it is the number the assessment actually
// uses, so it is stated where it is entered rather than in the banner.
function renderHemNote(r, p){
  $('hemNote').textContent = r.hemBinds
    ? `HEM of ${fmt.money0(r.hem)}/mo in ${p.city} will be used instead, it is the higher figure.`
    : `Used as declared, it is above the ${fmt.money0(r.hem)}/mo HEM for ${p.city}.`;
}

function renderWarnings(r, p){
  const msgs = [];
  if(r.maxRepay <= 0)
    msgs.push('Surplus income does not cover any repayment at the assessment rate, so serviceability caps the loan at zero.');
  if(r.commitRaw < 0)
    msgs.push('The facilities closing at settlement are worth more than every other commitment, so commitments were floored at zero.');
  if(p.lvrMax > 80 && !p.lmiCap)
    msgs.push('Above 80% LVR, Lenders Mortgage Insurance is normally payable. Switch on Capitalise LMI to feed it back into serviceability.');
  if(r.dtiAtMax > 6 && r.binding.key !== 'dti')
    msgs.push(`At this loan the debt-to-income ratio reaches ${fmt.ratio(r.dtiAtMax)}, which is reportable to APRA as a high-DTI loan.`);
  if(!r.nsrPass)
    msgs.push(`The Net Service Ratio of ${fmt.ratio(r.nsr)} is below the ${p.nsrMin.toFixed(2)} minimum.`);
  const el = $('warnBanner');
  el.innerHTML = msgs.map(m => '• '+m).join('<br>');
  el.classList.toggle('visible', msgs.length > 0);
}

/* ───────────────────────── Chart ───────────────────────── */

// Distinct hue AND distinct dash for every cap, so the chart never relies on
// colour alone to tell the four constraints apart.
const SERIES = [
  { key:'cap',  label:'Borrowing capacity', varName:'--accent-strong', width:3.4, dash:[]     },
  { key:'serv', label:'Serviceability',     varName:'--accent2',       width:1.9, dash:[7,4]  },
  { key:'dti',  label:'Debt to income',     varName:'--line-b',        width:1.9, dash:[2,3]  },
  { key:'lvr',  label:'Loan to value',      varName:'--gold',          width:1.9, dash:[11,4] },
  { key:'dep',  label:'Deposit',            varName:'--line-d',        width:1.9, dash:[1,4]  }
];

function renderLegend(datasets){
  const el = $('chartLegend');
  el.innerHTML = '';
  datasets.forEach((ds, idx) => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    const dashCls = SERIES[idx].dash.length ? ' dash' : '';
    item.innerHTML = `<span class="dot${dashCls}" style="background:${ds.borderColor}"></span><span>${ds.label}</span>`;
    item.addEventListener('click', () => {
      const hidden = !item.classList.contains('hidden');
      item.classList.toggle('hidden', hidden);
      chart.setDatasetVisibility(idx, !hidden);
      chart.update();
    });
    el.appendChild(item);
  });
}

function updateChart(sweep, userIdx){
  if(typeof Chart === 'undefined'){
    $('hoverBox').textContent = 'The chart library could not be loaded, so the chart is unavailable. Every number on this page is still correct.';
    return;
  }
  const grid = cssVar('--chart-grid'), muted = cssVar('--chart-text'), text = cssVar('--text');

  const datasets = SERIES.map(s => {
    const colour = cssVar(s.varName);
    const isCap = s.key === 'cap';
    return {
      label: s.label,
      data: sweep.rows.map(r => ({ x:r.x, y:r[s.key] })),
      borderColor: colour,
      backgroundColor: isCap ? colour+'22' : colour,
      borderWidth: s.width,
      borderDash: s.dash,
      fill: isCap ? 'origin' : false,
      tension: 0.12,
      order: isCap ? 0 : 1,
      pointRadius: ctx => (isCap && ctx.dataIndex === userIdx) ? 7 : 0,
      pointHoverRadius: ctx => (isCap && ctx.dataIndex === userIdx) ? 9 : 4,
      // Per series, not a shared accent: Chart.js draws the tooltip swatch from
      // the point style, so one colour for all five made every row look alike.
      pointBackgroundColor: colour,
      pointBorderColor: cssVar('--panel'),
      pointBorderWidth: 2
    };
  });

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    interaction: { mode:'index', intersect:false },
    plugins: {
      legend: { display:false },
      tooltip: {
        backgroundColor: cssVar('--panel'), titleColor: text, bodyColor: muted,
        borderColor: grid, borderWidth: 1, padding: 10,
        callbacks: {
          title: items => items.length ? 'Gross income '+fmt.money0(items[0].parsed.x) : '',
          label: ctx => `  ${ctx.dataset.label}: ${fmt.currency(ctx.parsed.y, true)}`,
          labelColor: ctx => ({ borderColor: ctx.dataset.borderColor,
                                backgroundColor: ctx.dataset.borderColor,
                                borderWidth: 2, borderRadius: 2 }),
          afterBody(items){
            if(!items.length) return;
            const you = items[0].dataIndex === userIdx ? '  (your scenario)' : '';
            $('hoverBox').textContent = `Gross income ${fmt.money0(items[0].parsed.x)}${you}  |  `
              + items.map(it => `${it.dataset.label}: ${fmt.currency(it.parsed.y, true)}`).join('  |  ');
          }
        }
      },
      zoom: {
        pan: { enabled:true, mode:'x' },
        zoom: { wheel:{ enabled:true, speed:0.08 }, pinch:{ enabled:true }, mode:'x' }
      }
    },
    scales: {
      x: {
        type:'linear',
        title:{ display:true, text:'Gross income, pre-tax ($ per year)', color:muted, font:{size:11} },
        ticks:{ color:muted, maxTicksLimit:9, font:{size:11}, callback:v => fmt.currency(v, true) },
        grid:{ color:grid }
      },
      y: {
        title:{ display:true, text:'Borrowing capacity ($)', color:muted, font:{size:11} },
        min: 0,
        ticks:{ color:muted, font:{size:11}, callback:v => fmt.currency(v, true) },
        grid:{ color:grid }
      }
    }
  };

  if(chart) chart.destroy();
  chart = new Chart($('chartCanvas'), { type:'line', data:{ datasets }, options });
  renderLegend(datasets);
}

/* ───────────────────────── Main render ───────────────────────── */

function render(){
  syncUI();
  const p = readInputs();
  const r = compute(p);
  const sweep = buildSweep(p);
  last = { p, r, sweep };

  renderKpis(r, p);
  renderCaps(r);
  renderBuild(r, p);
  renderIncome(r);
  renderCommitments(r);
  renderHemNote(r, p);
  renderWarnings(r, p);
  updateChart(sweep, sweep.tiny ? -1 : USER_INDEX);
}

/* ───────────────────────── Exports ───────────────────────── */

function downloadBlob(content, filename, type){
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportCsv(){
  if(!last) return;
  const { r, p, sweep } = last;
  const q = v => `"${String(v).replace(/"/g,'""')}"`;
  const lines = [];
  lines.push(['Borrowing Capacity, tool.adjiebrotots.com/borrowingcapacity'].map(q).join(','));
  lines.push('');
  lines.push(['Result','Value'].map(q).join(','));
  [['Borrowing capacity', r.maxLoan], ['Binding constraint', r.binding.label],
   ['Maximum purchase price', r.maxPrice], ['Assessment rate %', r.assessRate.toFixed(2)],
   ['Assessed repayment per month', Math.round(r.repayAtMax)],
   ['Gross income entered', Math.round(r.grossUnshaded)],
   ['Gross assessable income', Math.round(r.grossAssessable)],
   ['Total tax', Math.round(r.totalTax)],
   ['Net income per month', Math.round(r.netMonthly)],
   ['Living expenses per month', Math.round(r.living)],
   ['HEM benchmark per month', Math.round(r.hem)],
   ['Commitments per month', Math.round(r.commitments)],
   ['Maximum new repayment per month', Math.round(r.maxRepay)],
   ['NSR', isFinite(r.nsr) ? r.nsr.toFixed(3) : 'n/a'],
   ['UMI per month', Math.round(r.umi)],
   ['Serviceability cap', Math.round(r.Lserv)], ['DTI cap', Math.round(r.Ldti)],
   ['LVR cap', Math.round(r.Llvr)], ['Deposit cap', Math.round(r.Ldep)]
  ].forEach(row => lines.push(row.map(q).join(',')));
  lines.push('');
  lines.push(['Gross income','Serviceability','DTI cap','LVR cap','Deposit cap','Borrowing capacity'].map(q).join(','));
  sweep.rows.forEach(row => lines.push([Math.round(row.x), Math.round(row.serv), Math.round(row.dti),
        Math.round(row.lvr), Math.round(row.dep), Math.round(row.cap)].map(q).join(',')));
  downloadBlob(lines.join('\n'), 'borrowing-capacity.csv', 'text/csv;charset=utf-8;');
}

// Composite the chart onto a titled canvas so the PNG stands alone.
function chartPng(){
  const src = $('chartCanvas');
  const pad = 28, headH = 74, footH = 34;
  const out = document.createElement('canvas');
  out.width = src.width + pad*2;
  out.height = src.height + headH + footH + pad;
  const ctx = out.getContext('2d');
  ctx.fillStyle = cssVar('--panel') || '#fff';
  ctx.fillRect(0,0,out.width,out.height);
  ctx.fillStyle = cssVar('--text');
  ctx.font = '700 26px "DM Sans", sans-serif';
  ctx.fillText('Borrowing capacity across the income range', pad, pad+22);
  ctx.fillStyle = cssVar('--muted');
  ctx.font = '400 15px "DM Sans", sans-serif';
  if(last) ctx.fillText(`Capacity ${fmt.money0(last.r.maxLoan)} · binding constraint: ${last.r.binding.label} · assessed at ${fmt.pct(last.r.assessRate)}`, pad, pad+48);
  ctx.drawImage(src, pad, headH);
  ctx.font = '400 13px "DM Sans", sans-serif';
  ctx.fillText('Made using tool.adjiebrotots.com/borrowingcapacity', pad, out.height - 14);
  return out;
}

function exportPng(){
  chartPng().toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'borrowing-capacity.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

function copyPng(){
  const btn = $('copyBtn'), original = btn.textContent;
  chartPng().toBlob(async blob => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      btn.textContent = '✓';
    } catch(e){
      btn.textContent = '✕';
    }
    setTimeout(() => { btn.textContent = original; }, 1400);
  });
}

/* ───────────────────────── Wiring ───────────────────────── */

const DEFAULTS = {};
function captureDefaults(){
  document.querySelectorAll('#tab-income input, #tab-income select, #tab-house input, #tab-house select, '
    + '#tab-debts input, #tab-debts select, #tab-loan input, #tab-loan select, #tab-caps input, #tab-caps select')
    .forEach(el => {
      if(!el.id) return;
      DEFAULTS[el.id] = el.type === 'checkbox' ? el.checked : el.value;
    });
}

function resetAll(){
  Object.keys(DEFAULTS).forEach(id => {
    const el = $(id); if(!el) return;
    if(el.type === 'checkbox') el.checked = DEFAULTS[id];
    else el.value = DEFAULTS[id];
  });
  Object.assign(UI, UI_DEFAULTS);
  if(persist) persist.save();
  render();
}

// Flipping Simple and Detailed must not lose the headline figure, so the two
// views hand it to each other: Detailed opens on the number Simple held, and
// Simple reopens on what the streams on that side of the switch now add up to.
const setAmount = (id, v) => { $(id).value = SharedFmt.formatThousands(String(v), { maxDecimals:2 }); };

function carryIncome(nextMode, nextWho){
  const primary = nextWho === 'self' ? 'incSeNpat' : 'incPayg';
  if(nextMode === 'detailed' && UI.incMode === 'simple'){
    setAmount(primary, num('incSimple'));
  } else if(nextMode === 'simple' && UI.incMode === 'detailed'){
    setAmount('incSimple', DETAIL_STREAMS[nextWho].reduce((a, id) => a + num(id), 0));
  }
}

function wireSegments(){
  Object.entries(SEG_GROUPS).forEach(([groupId, key]) => {
    const g = $(groupId); if(!g) return;
    g.querySelectorAll('.seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.val;
        if(UI[key] === val) return;
        if(key === 'incMode') carryIncome(val, UI.incWho);
        if(key === 'incWho' && UI.incMode === 'detailed') carryIncome('detailed', val);
        UI[key] = val;
        if(persist) persist.schedule();
        render();
      });
    });
  });
}

function init(){
  captureDefaults();

  document.querySelectorAll('.fmt-num').forEach(el =>
    SharedFmt.attachCurrencyInput(el, { maxDecimals:2 }));
  document.querySelectorAll('.fmt-pct').forEach(el =>
    SharedFmt.attachCurrencyInput(el, { maxDecimals:3 }));

  document.querySelectorAll('.ctrl-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.ctrl-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.ctrl-panel').forEach(pnl => pnl.classList.remove('active'));
      tab.classList.add('active');
      $('tab-' + tab.dataset.tab).classList.add('active');
    });
  });

  document.querySelector('.controls').addEventListener('input', render);
  document.querySelector('.controls').addEventListener('change', render);

  $('themeToggle').addEventListener('click', () => {
    document.body.classList.toggle('light');
    $('themeToggle').textContent = document.body.classList.contains('light') ? '🌙 Dark' : '☀️ Light';
    if(last) updateChart(last.sweep, last.sweep.tiny ? -1 : USER_INDEX);
  });

  $('resetBtn').addEventListener('click', resetAll);
  $('csvBtn').addEventListener('click', exportCsv);
  $('pngBtn').addEventListener('click', exportPng);
  $('copyBtn').addEventListener('click', copyPng);
  $('resetZoomBtn').addEventListener('click', () => { if(chart) chart.resetZoom(); });
  $('chartCanvas').addEventListener('mouseleave', () => {
    $('hoverBox').textContent = 'Hover the chart to read every cap at a given income.';
  });

  wireSegments();

  // Persist stores form controls on its own. The segmented controls are
  // buttons, so their state rides along in the extra slot.
  persist = Persist.init('borrowingcapacity', {
    onRestore: render,
    extra: {
      save: () => ({ ...UI }),
      restore: saved => {
        if(!saved || typeof saved !== 'object') return;
        Object.keys(UI_DEFAULTS).forEach(k => { if(saved[k]) UI[k] = saved[k]; });
      }
    }
  });
  render();

  // Exposed so the audit harness can drive the engine directly as well as
  // through the DOM.
  window.__BC = { UI, compute, readInputs, buildSweep, hemMonthly, incomeTax, litoAmount, marginalTaxRate,
                  medicareLevy, mlsRate, helpRepayment, amortPayment, loanFromPayment,
                  CITY_INDEX, TAX_SCALES, USER_INDEX };
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();
