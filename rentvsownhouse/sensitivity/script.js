(function(){
'use strict';

var Tips = window.RVO_TIPS || {};

/* ── i18n ── */
let lang = localStorage.getItem('pf-lang') === 'id' ? 'id' : 'en';
const LANG_SENS = {
  en: {
    sensTitle: '🏠 Rent vs Own — Sensitivity Tool',
    sensSubtitle: 'Model the long-term financial outcome of renting vs buying property — comparing cash, equity, and net wealth over time.',
    btnBack: '← Back',
    labelCurrency: 'Currency:',
    labelMetric: 'Metric:',
    labelAtYear: 'At Year:',
    yearHint: "(clamped to each scenario's horizon)",
    btnCSV: '⬇ CSV',
    metricNetEquity: 'Net Equity',
    metricLiquidCash: 'Liquid Cash',
    metricAccumCost: 'Accum. Cost',
    tableHeaderParam: 'Parameter',
    tableHeaderUnit: 'Unit',
    btnAddScenario: '+ Scenario',
    scenPlaceholder: 'Scenario',
    cappedAt: (n) => `capped at yr ${n}`,
    ownOutputLabel: (ml) => `🏠 Own — ${ml}`,
    rentOutputLabel: (ml) => `💰 Rent — ${ml}`,
    deltaLabel: 'Δ Own − Rent',
    boolEnabled: 'Enabled',
    dupTitle: 'Duplicate',
    removeTitle: 'Remove',
    sepGeneral: '🌐 General',
    sepOwn: '🏡 Own — Property & Mortgage',
    sepRent: '🏢 Rent — Rental Payments & Costs',
    pHorizon: 'Horizon',
    pRiskFreeRate: 'Risk-Free Rate',
    pInitialCash: 'Initial Cash',
    pMonthlyBudget: 'Monthly Housing Budget',
    pMonthlyBudgetIncrease: 'Budget Annual Increase',
    pPropertyPrice: 'Property Price',
    pDownPaymentPct: 'Down Payment',
    pMortgageType: 'Mortgage Type',
    pMortgageRate: 'Mortgage Rate',
    pMortgageTerm: 'Mortgage Term',
    pHouseGrowth: 'House Growth (RPPI)',
    pSetupCost: 'Setup Cost',
    pSetupCostType: 'Setup Cost Type',
    pOwnOngoingCost: 'Ongoing Cost (Own)',
    pOwnOngoingCostFreq: 'Own Cost Frequency',
    pOwnOngoingCostType: 'Own Cost Type',
    pOwnOngoingInflation: 'Own Cost Inflation',
    pCostInterestOnly: 'Cost = Interest Only',
    pRentAmount: 'Rent Amount',
    pRentFreq: 'Rent Frequency',
    pRentInflation: 'Rent Inflation',
    pRentOngoingCost: 'Ongoing Cost (Rent)',
    pRentOngoingCostFreq: 'Rent Cost Frequency',
    pRentOngoingCostType: 'Rent Cost Type',
    pRentOngoingInflation: 'Rent Cost Inflation',
    uYrs: 'yrs',
    uPctPa: '% p.a.',
    uAuto: '0 = auto',
    uPctOfPrice: '% of price',
    uPctPaCagr: '% p.a. CAGR',
    optPI: 'P&I — Principal & Interest',
    optIO: 'IO — Interest Only',
    optFixedAmount: 'Fixed amount ($)',
    optPctPropertyPrice: '% of property price',
    optYearly: 'Yearly',
    optMonthly: 'Monthly',
    optWeekly: 'Weekly',
    optFixedDollar: 'Fixed $ amount',
    optPctPropertyValue: '% of property value',
    optPctAnnualRent: '% of annual rent',
    pctOfRent: '% of rent',
    pctOfValue: '% of value',
  },
  id: {
    sensTitle: '🏠 Rent vs Own — Sensitivity Tool',
    sensSubtitle: 'Modelkan hasil keuangan jangka panjang dari menyewa vs membeli properti — membandingkan kas, ekuitas, dan kekayaan bersih dari waktu ke waktu.',
    btnBack: '← Kembali',
    labelCurrency: 'Mata Uang:',
    labelMetric: 'Metrik:',
    labelAtYear: 'Pada Tahun:',
    yearHint: '(dibatasi oleh jangka waktu masing-masing skenario)',
    btnCSV: '⬇ CSV',
    metricNetEquity: 'Kekayaan Bersih',
    metricLiquidCash: 'Uang Tunai',
    metricAccumCost: 'Biaya Kumulatif',
    tableHeaderParam: 'Parameter',
    tableHeaderUnit: 'Unit',
    btnAddScenario: '+ Skenario',
    scenPlaceholder: 'Skenario',
    cappedAt: (n) => `dipotong di thn ${n}`,
    ownOutputLabel: (ml) => `🏠 Beli — ${ml}`,
    rentOutputLabel: (ml) => `💰 Sewa — ${ml}`,
    deltaLabel: 'Δ Beli − Sewa',
    boolEnabled: 'Aktif',
    dupTitle: 'Duplikat',
    removeTitle: 'Hapus',
    sepGeneral: '🌐 Umum',
    sepOwn: '🏡 Beli — Properti & KPR',
    sepRent: '🏢 Sewa — Pembayaran & Biaya',
    pHorizon: 'Jangka Waktu',
    pRiskFreeRate: 'Suku Bunga Bebas Risiko',
    pInitialCash: 'Modal Awal',
    pMonthlyBudget: 'Anggaran Rumah Bulanan',
    pMonthlyBudgetIncrease: 'Kenaikan Anggaran Tahunan',
    pPropertyPrice: 'Harga Properti',
    pDownPaymentPct: 'Uang Muka (DP)',
    pMortgageType: 'Tipe KPR',
    pMortgageRate: 'Bunga KPR',
    pMortgageTerm: 'Jangka Waktu KPR',
    pHouseGrowth: 'Kenaikan Harga Properti (RPPI)',
    pSetupCost: 'Biaya Awal Pembelian',
    pSetupCostType: 'Tipe Biaya Awal',
    pOwnOngoingCost: 'Biaya Rutin (Beli)',
    pOwnOngoingCostFreq: 'Frekuensi Biaya Rutin Beli',
    pOwnOngoingCostType: 'Tipe Biaya Rutin Beli',
    pOwnOngoingInflation: 'Inflasi Biaya Rutin Beli',
    pCostInterestOnly: 'Biaya = Bunga Saja',
    pRentAmount: 'Biaya Sewa',
    pRentFreq: 'Frekuensi Sewa',
    pRentInflation: 'Kenaikan Sewa Tahunan',
    pRentOngoingCost: 'Biaya Rutin (Sewa)',
    pRentOngoingCostFreq: 'Frekuensi Biaya Rutin Sewa',
    pRentOngoingCostType: 'Tipe Biaya Rutin Sewa',
    pRentOngoingInflation: 'Inflasi Biaya Rutin Sewa',
    uYrs: 'thn',
    uPctPa: '%/thn',
    uAuto: '0 = otomatis',
    uPctOfPrice: '% dari harga',
    uPctPaCagr: '%/thn CAGR',
    optPI: 'P&I — Pokok & Bunga',
    optIO: 'IO — Bunga Saja',
    optFixedAmount: 'Jumlah Tetap ($)',
    optPctPropertyPrice: '% dari harga properti',
    optYearly: 'Tahunan',
    optMonthly: 'Bulanan',
    optWeekly: 'Mingguan',
    optFixedDollar: 'Jumlah Tetap',
    optPctPropertyValue: '% dari nilai properti',
    optPctAnnualRent: '% dari sewa tahunan',
    pctOfRent: '% dari sewa',
    pctOfValue: '% dari nilai',
  }
};
function T(key){ return LANG_SENS[lang][key] !== undefined ? LANG_SENS[lang][key] : (LANG_SENS.en[key] !== undefined ? LANG_SENS.en[key] : key); }

function applyLang(){
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const key = el.dataset.i18n;
    const val = LANG_SENS[lang][key];
    if(val !== undefined && typeof val === 'string') el.textContent = val;
  });
  const lt = document.getElementById('langToggle');
  if(lt) lt.textContent = lang === 'en' ? 'ID' : 'EN';
  /* switch tooltip text for data-tip-key elements based on language */
  const tips = (lang === 'id' && window.RVO_TIPS_ID) ? RVO_TIPS_ID : (window.RVO_TIPS_EN || window.RVO_TIPS);
  if(tips){
    document.querySelectorAll('[data-tip-key]').forEach(function(el){
      var k = el.getAttribute('data-tip-key');
      if(tips[k]) el.setAttribute('data-tip', tips[k]);
    });
  }
}

/* ── PARAMS (grouped with sep dividers) ── */
const PARAMS = [
  {type:'sep', sepKey:'sepGeneral'},
  {key:'horizon',              labelKey:'pHorizon',              type:'integer',  unitKey:'uYrs',        min:1,   max:60,  step:1,    tip:'horizon'},
  {key:'riskFreeRate',         labelKey:'pRiskFreeRate',         type:'percent',  unitKey:'uPctPa',      min:0,   max:25,  step:0.05, tip:'riskFreeRate'},
  {key:'initialCash',          labelKey:'pInitialCash',          type:'currency', unitKey:'uAuto',       min:0,            step:10000,tip:'initialCash'},
  {key:'monthlyBudget',        labelKey:'pMonthlyBudget',        type:'currency', unitKey:'uAuto',       min:0,            step:100,  tip:'monthlyBudget'},
  {key:'monthlyBudgetIncrease',labelKey:'pMonthlyBudgetIncrease',type:'percent',  unitKey:'uPctPa',      min:0,   max:25,  step:0.1,  tip:'monthlyBudgetIncrease'},

  {type:'sep', sepKey:'sepOwn'},
  {key:'propertyPrice',        labelKey:'pPropertyPrice',        type:'currency',                        min:50000,        step:10000,tip:'propertyPrice'},
  {key:'downPaymentPct',       labelKey:'pDownPaymentPct',       type:'percent',  unitKey:'uPctOfPrice', min:0,   max:99,  step:0.5,  tip:'downPaymentPct'},
  {key:'mortgageType',         labelKey:'pMortgageType',         type:'select',   options:[{v:'pi',lk:'optPI'},{v:'io',lk:'optIO'}], tip:'mortgageType'},
  {key:'mortgageRate',         labelKey:'pMortgageRate',         type:'percent',  unitKey:'uPctPa',      min:0,   max:25,  step:0.05, tip:'mortgageRate'},
  {key:'mortgageTerm',         labelKey:'pMortgageTerm',         type:'integer',  unitKey:'uYrs',        min:1,   max:40,  step:1,    tip:'mortgageTerm'},
  {key:'houseGrowth',          labelKey:'pHouseGrowth',          type:'percent',  unitKey:'uPctPaCagr',  min:-10, max:30,  step:0.1,  tip:'houseGrowth'},
  {key:'setupCost',            labelKey:'pSetupCost',            type:'currency',                        min:0,            step:500,  tip:'setupCost'},
  {key:'setupCostType',        labelKey:'pSetupCostType',        type:'select',   options:[{v:'dollar',lk:'optFixedAmount'},{v:'pct',lk:'optPctPropertyPrice'}], tip:'setupCost'},
  {key:'ownOngoingCost',       labelKey:'pOwnOngoingCost',       type:'currency',                        min:0,            step:100,  tip:'ownOngoingCost', subgroup:'own-cost'},
  {key:'ownOngoingCostFreq',   labelKey:'pOwnOngoingCostFreq',   type:'select',   options:[{v:'yearly',lk:'optYearly'},{v:'monthly',lk:'optMonthly'},{v:'weekly',lk:'optWeekly'}], subgroup:'own-cost'},
  {key:'ownOngoingCostType',   labelKey:'pOwnOngoingCostType',   type:'select',   options:[{v:'dollar',lk:'optFixedDollar'},{v:'pct',lk:'optPctPropertyValue'}], subgroup:'own-cost'},
  {key:'ownOngoingInflation',  labelKey:'pOwnOngoingInflation',  type:'percent',  unitKey:'uPctPa',      min:0,   max:15,  step:0.1,  tip:'ownOngoingInflation'},
  {key:'costInterestOnly',     labelKey:'pCostInterestOnly',     type:'boolean',                                                      tip:'costInterestOnly'},

  {type:'sep', sepKey:'sepRent'},
  {key:'rentAmount',           labelKey:'pRentAmount',           type:'currency',                        min:0,            step:50,   tip:'rentAmount'},
  {key:'rentFreq',             labelKey:'pRentFreq',             type:'select',   options:[{v:'monthly',lk:'optMonthly'},{v:'weekly',lk:'optWeekly'},{v:'yearly',lk:'optYearly'}]},
  {key:'rentInflation',        labelKey:'pRentInflation',        type:'percent',  unitKey:'uPctPa',      min:-5,  max:25,  step:0.1,  tip:'rentInflation'},
  {key:'rentOngoingCost',      labelKey:'pRentOngoingCost',      type:'currency',                        min:0,            step:100,  tip:'rentOngoingCost', subgroup:'rent-cost'},
  {key:'rentOngoingCostFreq',  labelKey:'pRentOngoingCostFreq',  type:'select',   options:[{v:'yearly',lk:'optYearly'},{v:'monthly',lk:'optMonthly'},{v:'weekly',lk:'optWeekly'}], subgroup:'rent-cost'},
  {key:'rentOngoingCostType',  labelKey:'pRentOngoingCostType',  type:'select',   options:[{v:'dollar',lk:'optFixedDollar'},{v:'pct',lk:'optPctAnnualRent'}], subgroup:'rent-cost'},
  {key:'rentOngoingInflation', labelKey:'pRentOngoingInflation', type:'percent',  unitKey:'uPctPa',      min:0,   max:15,  step:0.1,  tip:'rentOngoingInflation'},
];

const DEFAULT_SCENARIO = {
  name: 'Base Case',
  propertyPrice: 800000,
  downPaymentPct: 20,
  mortgageType: 'pi',
  mortgageRate: 6.0,
  mortgageTerm: 30,
  riskFreeRate: 4.5,
  houseGrowth: 5.0,
  horizon: 30,
  setupCost: 32000,
  setupCostType: 'dollar',
  ownOngoingCost: 6000,
  ownOngoingCostFreq: 'yearly',
  ownOngoingCostType: 'dollar',
  ownOngoingInflation: 0,
  costInterestOnly: true,
  rentAmount: 2800,
  rentFreq: 'monthly',
  rentInflation: 3.0,
  rentOngoingCost: 1200,
  rentOngoingCostFreq: 'yearly',
  rentOngoingCostType: 'dollar',
  rentOngoingInflation: 0,
  initialCash: 0,
  monthlyBudget: 0,
  monthlyBudgetIncrease: 0,
  currencySymbol: '$',
};

/* ── STATE ── */
let scenarios = [Object.assign({}, DEFAULT_SCENARIO)];
let metric = 'netEquity';
let viewYear = 30;
let scenarioResults = [];

/* ── UTILITIES ── */
function parseNum(val){
  if(typeof val==='number') return Number.isFinite(val) ? val : 0;
  const cleaned = String(val ?? '').replace(/,/g,'').replace(/[^\d.-]/g,'').trim();
  if(!cleaned || cleaned==='-' || cleaned==='.' || cleaned==='-.') return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
function parseFloatSafe(val, fb){ const n=parseFloat(String(val).replace(/,/g,'')); return isNaN(n)?fb:n; }
function parseIntSafe(val, fb){ const n=parseInt(String(val).replace(/,/g,'')); return isNaN(n)?fb:n; }
function toYearly(val,freq){ if(freq==='weekly') return val*52; if(freq==='monthly') return val*12; return val; }
function toMonthly(val,freq){ if(freq==='weekly') return val*52/12; if(freq==='yearly') return val/12; return val; }

function addCommas(n){
  const num = Math.round(n);
  const abs = Math.abs(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g,',');
  return num < 0 ? '-'+abs : abs;
}

function fmtInputVal(val, type){
  const n = parseNum(val);
  if(type==='currency') return addCommas(n);
  if(type==='percent')  return n.toFixed(2);
  if(type==='integer')  return String(Math.round(n));
  return String(val ?? '');
}

function fmtCurrency(v, sym){
  sym = sym || '$';
  const n = Number(v||0), abs = Math.abs(n), sign = n<0 ? '−' : '';
  if(abs>=1e9) return sign+sym+(abs/1e9).toFixed(2)+'b';
  if(abs>=1e6) return sign+sym+(abs/1e6).toFixed(2)+'m';
  if(abs>=1000) return sign+sym+(abs/1000).toFixed(0)+'k';
  return sign+sym+Math.round(abs);
}

function escHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escAttr(s){ return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ── COMPUTE ENGINE ── */
function calcMonthlyMortgage(principal, annualRate, termYears, type){
  const r = annualRate/100/12, n = termYears*12;
  if(type==='io') return principal*r;
  if(r===0) return principal/n;
  return principal*(r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1);
}

function buildStateObj(sc){
  return {
    propertyPrice:       Math.max(50000, sc.propertyPrice || 800000),
    downPaymentPct:      sc.downPaymentPct ?? 20,
    mortgageType:        sc.mortgageType || 'pi',
    mortgageRate:        sc.mortgageRate ?? 6.0,
    mortgageTerm:        sc.mortgageTerm ?? 30,
    riskFreeRate:        sc.riskFreeRate ?? 4.5,
    houseGrowth:         sc.houseGrowth ?? 5.0,
    horizon:             Math.max(1, sc.horizon || 30),
    setupCost:           Math.max(0, sc.setupCost || 0),
    setupCostType:       sc.setupCostType || 'dollar',
    ownOngoingCost:      Math.max(0, sc.ownOngoingCost || 0),
    ownOngoingCostFreq:  sc.ownOngoingCostFreq || 'yearly',
    ownOngoingCostType:  sc.ownOngoingCostType || 'dollar',
    ownOngoingInflation: sc.ownOngoingInflation ?? 0,
    costInterestOnly:    sc.costInterestOnly !== false,
    rentAmount:          Math.max(0, sc.rentAmount || 0),
    rentFreq:            sc.rentFreq || 'monthly',
    rentInflation:       sc.rentInflation ?? 3.0,
    rentOngoingCost:     Math.max(0, sc.rentOngoingCost || 0),
    rentOngoingCostFreq: sc.rentOngoingCostFreq || 'yearly',
    rentOngoingCostType: sc.rentOngoingCostType || 'dollar',
    rentOngoingInflation:sc.rentOngoingInflation ?? 0,
    initialCash:         sc.initialCash || 0,
    monthlyBudget:       sc.monthlyBudget || 0,
    monthlyBudgetIncrease: sc.monthlyBudgetIncrease || 0,
    currencySymbol:      sc.currencySymbol || '$',
  };
}

function computeModel(S){
  const P   = S.propertyPrice;
  const dp  = P * S.downPaymentPct/100;
  const loan = P - dp;
  const rfr  = S.riskFreeRate/100;
  const h    = S.houseGrowth/100;
  const ri   = S.rentInflation/100;

  const setupCostDollar = S.setupCostType==='pct' ? P*S.setupCost/100 : S.setupCost;
  const mPayment = calcMonthlyMortgage(loan, S.mortgageRate, S.mortgageTerm, S.mortgageType);
  const rentMonthly0 = toMonthly(S.rentAmount, S.rentFreq);
  const rentOngoingYearly0 = S.rentOngoingCostType==='pct'
    ? rentMonthly0*12*S.rentOngoingCost/100
    : toYearly(S.rentOngoingCost, S.rentOngoingCostFreq);

  function ownRequiredMonthly(yr){
    const propVal = P * Math.pow(1+h, Math.max(0,yr-1));
    let oo = toYearly(S.ownOngoingCost, S.ownOngoingCostFreq);
    if(S.ownOngoingCostType==='pct') oo = propVal*S.ownOngoingCost/100;
    else oo *= Math.pow(1+S.ownOngoingInflation/100, yr-1);
    const mort = S.mortgageType==='pi' ? (yr<=S.mortgageTerm?mPayment:0) : (loan>0?mPayment:0);
    return mort + oo/12;
  }
  function rentRequiredMonthly(yr){
    const cur = rentMonthly0 * Math.pow(1+ri, yr-1);
    let ro = toYearly(S.rentOngoingCost, S.rentOngoingCostFreq);
    if(S.rentOngoingCostType==='pct') ro = cur*12*S.rentOngoingCost/100;
    else ro *= Math.pow(1+S.rentOngoingInflation/100, yr-1);
    return cur + ro/12;
  }

  const budgetIsManual = S.monthlyBudget > 0;
  const budgetGrowth   = budgetIsManual ? S.monthlyBudgetIncrease/100 : 0;
  function getMonthlyBudget(yr){
    if(budgetIsManual) return S.monthlyBudget * Math.pow(1+budgetGrowth, yr-1);
    return Math.max(ownRequiredMonthly(yr), rentRequiredMonthly(yr));
  }

  const requiredNow     = dp + setupCostDollar;
  const autoInitialCash = Math.max(requiredNow, rentMonthly0*12+rentOngoingYearly0);
  const initialCashUsed = S.initialCash > 0 ? S.initialCash : autoInitialCash;
  const ownCashStart    = initialCashUsed - requiredNow;
  const renterStart     = initialCashUsed;

  const rows = [];
  let ownPropValue = P, ownPrincipal = loan, ownCash = ownCashStart;
  let ownAccumCost = setupCostDollar, ownAccumInterest = 0;
  let rentCash = renterStart, rentAccumCost = 0;

  rows.push({ year:0, ownPropValue, ownPrincipal, ownCash,
    ownHouseEquity:ownPropValue-ownPrincipal, ownNetEquity:ownPropValue-ownPrincipal+ownCash,
    ownAccumCost:setupCostDollar, ownAccumInterest:0,
    rentCash, rentNetEquity:rentCash, rentAccumCost:0 });

  const r12 = S.mortgageRate/100/12;
  const rfm = Math.pow(1+rfr,1/12)-1;

  for(let yr=1; yr<=S.horizon; yr++){
    const curRent = rentMonthly0 * Math.pow(1+ri, yr-1);
    let oo = toYearly(S.ownOngoingCost, S.ownOngoingCostFreq);
    if(S.ownOngoingCostType==='pct') oo = ownPropValue*S.ownOngoingCost/100;
    else oo *= Math.pow(1+S.ownOngoingInflation/100, yr-1);
    const oom = oo/12;

    let ro = toYearly(S.rentOngoingCost, S.rentOngoingCostFreq);
    if(S.rentOngoingCostType==='pct') ro = curRent*12*S.rentOngoingCost/100;
    else ro *= Math.pow(1+S.rentOngoingInflation/100, yr-1);
    const rom = ro/12;

    let yearInterest = 0;
    for(let m=0; m<12; m++){
      const hasMort = ownPrincipal > 1e-2;
      const mMort   = hasMort ? mPayment : 0;
      const mBudget = getMonthlyBudget(yr);
      let mInt = 0;
      if(hasMort){
        mInt = ownPrincipal * r12;
        const prin = S.mortgageType==='pi' ? Math.min(mPayment-mInt, ownPrincipal) : 0;
        yearInterest += mInt; ownPrincipal = Math.max(0, ownPrincipal-prin); ownAccumInterest += mInt;
      }
      ownCash  = ownCash  * (1+rfm) + (mBudget - mMort - oom);
      rentCash = rentCash * (1+rfm) + (mBudget - curRent - rom);
      ownAccumCost  += S.costInterestOnly ? mInt+oom : mMort+oom;
      rentAccumCost += curRent + rom;
    }
    ownPropValue *= (1+h);
    const ownHouseEquity = ownPropValue - ownPrincipal;
    rows.push({ year:yr, ownPropValue, ownPrincipal, ownCash,
      ownHouseEquity, ownNetEquity:ownHouseEquity+ownCash, ownAccumCost, ownAccumInterest,
      ownYearInterest:yearInterest, rentCash, rentNetEquity:rentCash, rentAccumCost });
  }
  return { rows, initialCashUsed, ownCashStart, renterStart };
}

/* ── HELPERS ── */
function metricLabel(){
  return metric==='netEquity' ? T('metricNetEquity') : metric==='cash' ? T('metricLiquidCash') : T('metricAccumCost');
}
function getMetricValues(i){
  const res = scenarioResults[i];
  if(!res || !res.rows) return {own:null,rent:null};
  const yr = Math.min(viewYear, scenarios[i].horizon || 30);
  const row = res.rows[yr];
  if(!row) return {own:null,rent:null};
  if(metric==='netEquity') return {own:row.ownNetEquity, rent:row.rentNetEquity};
  if(metric==='cash')      return {own:row.ownCash,      rent:row.rentCash};
  return                          {own:row.ownAccumCost, rent:row.rentAccumCost};
}
function deltaColor(d){ return metric==='cost' ? (d>0?'neg-val':'pos-val') : (d>=0?'pos-val':'neg-val'); }
const symOf = sc => (sc && sc.currencySymbol) || '$';

/* ── SCENARIO MANAGEMENT ── */
function addScenario(){
  const clone = Object.assign({}, scenarios[scenarios.length-1]);
  clone.name = 'Scenario '+(scenarios.length+1);
  scenarios.push(clone);
  rerender();
}
function removeScenario(i){
  if(scenarios.length<=1) return;
  scenarios.splice(i,1); scenarioResults.splice(i,1); rerender();
}

/* ── BUILD TABLE ── */
function unitForParam(p){
  if(p.type==='currency') return symOf(scenarios[0]) || '$';
  if(p.type==='percent') return p.unitKey ? T(p.unitKey) : (p.unit || '%');
  return p.unitKey ? T(p.unitKey) : (p.unit || '');
}

function getOngoingCostUnit(sc, costKey){
  if(costKey==='rentOngoingCost') return sc.rentOngoingCostType==='pct' ? T('pctOfRent') : symOf(sc);
  if(costKey==='ownOngoingCost')  return sc.ownOngoingCostType==='pct'  ? T('pctOfValue') : symOf(sc);
  return symOf(sc);
}

function buildTableHTML(){
  const n = scenarios.length;
  const colCount = n + 3;

  const thScens = scenarios.map((sc,i)=>{
    const clamped = Math.min(viewYear, sc.horizon||30);
    return `<th class="scen-th"><div class="scen-header-cell">
      <div class="scen-header-actions">
        <input class="scen-name-input" data-si="${i}" value="${escHtml(sc.name)}" placeholder="${T('scenPlaceholder')} ${i+1}"/>
        <button class="btn-dupe" data-si="${i}" title="${T('dupTitle')}">⧉</button>
        ${n>1?`<button class="btn-remove rmv-scen" data-si="${i}" title="${T('removeTitle')}">✕</button>`:''}
      </div>
      ${clamped<viewYear?`<span class="scen-header-sub">${T('cappedAt')(clamped)}</span>`:''}
    </div></th>`;
  }).join('');

  let bodyHtml = '';
  const isDynamicUnit = key => key==='rentOngoingCost' || key==='ownOngoingCost';
  PARAMS.forEach((p,pi)=>{
    if(p.type==='sep'){
      bodyHtml += `<tr class="group-sep-tr"><td colspan="${colCount}">${T(p.sepKey)}</td></tr>`;
      return;
    }
    const tipTips = (lang==='id'&&window.RVO_TIPS_ID)?RVO_TIPS_ID:(window.RVO_TIPS_EN||window.RVO_TIPS||{});
    const tipText = p.tip ? tipTips[p.tip] : '';
    const tipHtml = tipText ? `<span class="tip-icon" data-tip-key="${escAttr(p.tip)}" data-tip="${escAttr(tipText)}">?</span>` : '';

    const prevP = PARAMS[pi-1], nextP = PARAMS[pi+1];
    const isFirst = p.subgroup && (!prevP || prevP.subgroup!==p.subgroup || prevP.type==='sep');
    const isLast  = p.subgroup && (!nextP || nextP.subgroup!==p.subgroup);
    const rowClass = [
      p.subgroup ? 'subgroup-row' : '',
      isFirst ? 'subgroup-first' : '',
      isLast  ? 'subgroup-last'  : '',
    ].filter(Boolean).join(' ');

    const tds = scenarios.map((sc,i)=>{
      let inp = '';
      if(p.type==='select'){
        const opts = (p.options||[]).map(o=>`<option value="${escAttr(o.v)}"${sc[p.key]===o.v?' selected':''}>${escHtml(o.lk ? T(o.lk) : o.l)}</option>`).join('');
        inp = `<select class="param-select" data-si="${i}" data-key="${p.key}">${opts}</select>`;
      } else if(p.type==='boolean'){
        inp = `<div class="param-bool-wrap"><input type="checkbox" class="param-bool" data-si="${i}" data-key="${p.key}"${sc[p.key]!==false?' checked':''}/><span class="param-bool-label">${T('boolEnabled')}</span></div>`;
      } else {
        inp = `<input class="param-input" type="text" inputmode="numeric" data-si="${i}" data-key="${p.key}" data-ptype="${p.type}" value="${escAttr(fmtInputVal(sc[p.key], p.type))}"/>`;
      }
      if(isDynamicUnit(p.key)){
        inp += `<span class="ongoing-unit" data-si="${i}" data-cost-key="${p.key}">${escHtml(getOngoingCostUnit(sc, p.key))}</span>`;
      }
      return `<td class="scen-td">${inp}</td>`;
    }).join('');

    const unitCell = isDynamicUnit(p.key)
      ? `<td class="unit-td"></td>`
      : `<td class="unit-td">${escHtml(unitForParam(p))}</td>`;

    bodyHtml += `<tr${rowClass?' class="'+rowClass+'"':''}><td class="label-td">${escHtml(T(p.labelKey))}${tipHtml}</td>${unitCell}${tds}<td style="border:1px solid var(--border);background:var(--input-bg);"></td></tr>`;
  });

  const emptyTd = `<td style="border:1px solid var(--border);background:var(--input-bg);"></td>`;
  const ml = metricLabel();
  const ownTds  = scenarios.map((_,i)=>{ const v=getMetricValues(i); return `<td class="scen-td num-td">${v.own!==null?fmtCurrency(v.own,symOf(scenarios[i])):'—'}</td>`; }).join('');
  const rentTds = scenarios.map((_,i)=>{ const v=getMetricValues(i); return `<td class="scen-td num-td">${v.rent!==null?fmtCurrency(v.rent,symOf(scenarios[i])):'—'}</td>`; }).join('');
  const deltaTds= scenarios.map((_,i)=>{ const v=getMetricValues(i); if(v.own===null) return `<td class="scen-td num-td">—</td>`; const d=v.own-v.rent; return `<td class="scen-td num-td ${deltaColor(d)}">${d>=0?'+':''}${fmtCurrency(d,symOf(scenarios[i]))}</td>`; }).join('');

  return `<table class="dt"><thead><tr>
    <th class="label-td">${T('tableHeaderParam')}</th><th class="unit-th">${T('tableHeaderUnit')}</th>${thScens}
    <th style="white-space:nowrap;vertical-align:middle;"><button class="btn-add" id="addScenBtn">${T('btnAddScenario')}</button></th>
  </tr></thead><tbody>
    ${bodyHtml}
    <tr class="sep-tr"><td colspan="${colCount}"></td></tr>
    <tr class="out-own"><td class="label-td">${T('ownOutputLabel')(ml)}</td><td class="unit-td"></td>${ownTds}${emptyTd}</tr>
    <tr class="out-rent"><td class="label-td">${T('rentOutputLabel')(ml)}</td><td class="unit-td"></td>${rentTds}${emptyTd}</tr>
    <tr class="out-delta"><td class="label-td">${T('deltaLabel')}</td><td class="unit-td"></td>${deltaTds}${emptyTd}</tr>
  </tbody></table>`;
}

/* ── RERENDER OUTPUT ONLY ── */
function rerenderOutputOnly(){
  const wrap = document.getElementById('tableWrap');
  if(!wrap) return;
  const ml = metricLabel();
  const ol = wrap.querySelector('tr.out-own .label-td');   if(ol) ol.textContent = T('ownOutputLabel')(ml);
  const rl = wrap.querySelector('tr.out-rent .label-td');  if(rl) rl.textContent = T('rentOutputLabel')(ml);
  const oTds = wrap.querySelectorAll('tr.out-own td.scen-td');
  const rTds = wrap.querySelectorAll('tr.out-rent td.scen-td');
  const dTds = wrap.querySelectorAll('tr.out-delta td.scen-td');
  scenarios.forEach((sc,i)=>{
    const v = getMetricValues(i), s = symOf(sc);
    if(oTds[i]) oTds[i].textContent = v.own!==null  ? fmtCurrency(v.own, s)  : '—';
    if(rTds[i]) rTds[i].textContent = v.rent!==null ? fmtCurrency(v.rent, s) : '—';
    if(dTds[i]){
      if(v.own===null){ dTds[i].textContent='—'; dTds[i].className='scen-td num-td'; return; }
      const d = v.own-v.rent;
      dTds[i].textContent = (d>=0?'+':'')+fmtCurrency(d,s);
      dTds[i].className   = 'scen-td num-td '+deltaColor(d);
    }
  });
}

/* ── RERENDER ── */
function rerender(){
  scenarioResults = scenarios.map(sc=>{ try{ return computeModel(buildStateObj(sc)); }catch(e){ console.error(e); return null; } });
  const wrap = document.getElementById('tableWrap');
  if(!wrap) return;
  wrap.innerHTML = buildTableHTML();
  wireEvents();
}

/* ── CSV DOWNLOAD ── */
function downloadCSV(){
  const esc = v => '"'+String(v).replace(/"/g,'""')+'"';
  const lines = [];
  lines.push([esc(T('tableHeaderParam')), esc(T('tableHeaderUnit')), ...scenarios.map(sc=>esc(sc.name))].join(','));
  PARAMS.forEach(p=>{
    if(p.type==='sep') return;
    lines.push([esc(T(p.labelKey)), esc(unitForParam(p)), ...scenarios.map(sc=>{
      if(p.type==='boolean') return esc(sc[p.key]!==false?'Yes':'No');
      if(p.type==='select')  return esc(sc[p.key]||'');
      return esc(sc[p.key]??0);
    })].join(','));
  });
  lines.push('');
  const ml = metricLabel();
  lines.push([esc(T('ownOutputLabel')(ml)),  ...scenarios.map((_,i)=>{ const v=getMetricValues(i); return esc(v.own!==null?fmtCurrency(v.own,symOf(scenarios[i])):'—'); })].join(','));
  lines.push([esc(T('rentOutputLabel')(ml)), ...scenarios.map((_,i)=>{ const v=getMetricValues(i); return esc(v.rent!==null?fmtCurrency(v.rent,symOf(scenarios[i])):'—'); })].join(','));
  lines.push([esc(T('deltaLabel')),          ...scenarios.map((_,i)=>{ const v=getMetricValues(i); if(v.own===null) return esc('—'); const d=v.own-v.rent; return esc((d>=0?'+':'')+fmtCurrency(d,symOf(scenarios[i]))); })].join(','));

  const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'rent-vs-own-sensitivity.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

/* ── WIRE EVENTS ── */
function wireEvents(){
  document.querySelectorAll('.scen-name-input').forEach(el=>{
    el.addEventListener('input', e=>{ scenarios[+e.target.dataset.si].name = e.target.value; });
  });

  document.querySelectorAll('.param-input').forEach(el=>{
    el.addEventListener('focus', e=>{
      const val = scenarios[+e.target.dataset.si][e.target.dataset.key];
      e.target.value = String(val ?? '').replace(/,/g,'');
    });
    el.addEventListener('blur', e=>{
      const si = +e.target.dataset.si, key = e.target.dataset.key, ptype = e.target.dataset.ptype;
      const p = PARAMS.find(x=>x.key===key);
      if(!p) return;
      let val = ptype==='integer' ? parseIntSafe(e.target.value, scenarios[si][key]) : parseFloatSafe(e.target.value, scenarios[si][key]);
      if(p.min!=null) val = Math.max(p.min, val);
      if(p.max!=null) val = Math.min(p.max, val);
      scenarios[si][key] = val;
      e.target.value = fmtInputVal(val, ptype);
      if(key==='horizon'){
        const maxH = Math.max(...scenarios.map(s=>s.horizon||1));
        document.getElementById('yearInput').max = maxH;
      }
      try{ scenarioResults[si] = computeModel(buildStateObj(scenarios[si])); }catch(err){}
      rerenderOutputOnly();
      updateClampNote(si);
    });
    el.addEventListener('keydown', e=>{ if(e.key==='Enter') e.target.blur(); });
  });

  document.querySelectorAll('.param-select').forEach(el=>{
    el.addEventListener('change', e=>{
      const si = +e.target.dataset.si, key = e.target.dataset.key;
      scenarios[si][key] = e.target.value;
      if(key==='rentOngoingCostType' || key==='ownOngoingCostType'){
        const costKey = key==='rentOngoingCostType' ? 'rentOngoingCost' : 'ownOngoingCost';
        document.querySelectorAll(`.ongoing-unit[data-si="${si}"][data-cost-key="${costKey}"]`).forEach(span=>{
          span.textContent = getOngoingCostUnit(scenarios[si], costKey);
        });
      }
      try{ scenarioResults[si] = computeModel(buildStateObj(scenarios[si])); }catch(err){}
      rerenderOutputOnly();
    });
  });

  document.querySelectorAll('.param-bool').forEach(el=>{
    el.addEventListener('change', e=>{
      const si = +e.target.dataset.si;
      scenarios[si][e.target.dataset.key] = e.target.checked;
      try{ scenarioResults[si] = computeModel(buildStateObj(scenarios[si])); }catch(err){}
      rerenderOutputOnly();
    });
  });

  const addBtn = document.getElementById('addScenBtn');
  if(addBtn) addBtn.addEventListener('click', addScenario);

  document.querySelectorAll('.rmv-scen').forEach(btn=>{
    btn.addEventListener('click', ()=> removeScenario(+btn.dataset.si));
  });

  document.querySelectorAll('.btn-dupe').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const si = +btn.dataset.si;
      const clone = Object.assign({}, scenarios[si]);
      clone.name = scenarios[si].name+' (copy)';
      scenarios.splice(si+1, 0, clone);
      rerender();
    });
  });
}

function updateClampNote(si){
  const cells = document.querySelectorAll('.scen-header-cell');
  const cell = cells[si]; if(!cell) return;
  const clamped = Math.min(viewYear, scenarios[si].horizon||30);
  let sub = cell.querySelector('.scen-header-sub');
  if(clamped < viewYear){
    if(!sub){ sub=document.createElement('span'); sub.className='scen-header-sub'; cell.appendChild(sub); }
    sub.textContent = T('cappedAt')(clamped);
  } else if(sub) sub.remove();
}

/* ── GLOBAL TOOLTIP ── */
(function(){
  const tt = document.getElementById('globalTooltip');
  const ttText = tt.querySelector('.tt-text');
  const ttArrow = tt.querySelector('.tt-arrow');
  const PAD = 8;
  function hide(){ tt.classList.remove('visible'); tt.style.display='none'; }

  document.addEventListener('mouseover', e=>{
    const icon = e.target.closest('[data-tip]');
    if(!icon){ hide(); return; }
    const tip = icon.getAttribute('data-tip');
    if(!tip){ hide(); return; }
    ttText.innerHTML = tip;
    tt.classList.remove('flip-below');
    tt.style.display='block'; tt.style.opacity='0'; tt.classList.add('visible');

    const rect = icon.getBoundingClientRect();
    const ttW = tt.offsetWidth, ttH = tt.offsetHeight;
    const cx = rect.left + rect.width/2;
    let top = rect.top - ttH - 10, left = cx - ttW/2;
    if(top < PAD){ top = rect.bottom+10; tt.classList.add('flip-below'); }
    left = Math.max(PAD, Math.min(left, window.innerWidth-ttW-PAD));
    top  = Math.max(PAD, Math.min(top,  window.innerHeight-ttH-PAD));
    tt.style.left = left+'px'; tt.style.top = top+'px'; tt.style.opacity='1';
    ttArrow.style.left = Math.max(10, Math.min(cx-left, ttW-10))+'px';
  });

  document.addEventListener('mouseout', e=>{
    const icon = e.target.closest('[data-tip]');
    if(icon && (!e.relatedTarget || !icon.contains(e.relatedTarget))) hide();
  });
})();

/* ── INIT ── */
document.addEventListener('DOMContentLoaded', ()=>{
  applyLang();
  rerender();

  const themeBtn = document.getElementById('themeToggle');
  // Apply persisted theme on load (body defaults to light; remove class if stored dark)
  if(localStorage.getItem('pf-theme')==='dark'){document.body.classList.remove('light');themeBtn.textContent='☀️ Light';}
  themeBtn.addEventListener('click', ()=>{
    document.body.classList.toggle('light');
    themeBtn.textContent = document.body.classList.contains('light') ? '🌙 Dark' : '☀️ Light';
    localStorage.setItem('pf-theme', document.body.classList.contains('light') ? 'light' : 'dark');
  });

  document.getElementById('langToggle').addEventListener('click', ()=>{
    lang = lang === 'en' ? 'id' : 'en';
    localStorage.setItem('pf-lang', lang);
    applyLang();
    rerender();
  });

  document.getElementById('currencySelect').addEventListener('change', e=>{
    scenarios.forEach(sc=>{ sc.currencySymbol = e.target.value; });
    rerender();
  });

  document.getElementById('metricGroup').addEventListener('click', e=>{
    const btn = e.target.closest('.seg-btn');
    if(!btn || !btn.dataset.metric) return;
    metric = btn.dataset.metric;
    document.querySelectorAll('#metricGroup .seg-btn').forEach(b=>b.classList.toggle('active', b===btn));
    rerenderOutputOnly();
  });

  document.getElementById('yearInput').addEventListener('input', e=>{
    viewYear = Math.max(1, parseIntSafe(e.target.value, 30));
    const wrap = document.getElementById('tableWrap');
    if(wrap){ wrap.innerHTML = buildTableHTML(); wireEvents(); }
  });

  document.getElementById('downloadCSVBtn').addEventListener('click', downloadCSV);
});

})();
