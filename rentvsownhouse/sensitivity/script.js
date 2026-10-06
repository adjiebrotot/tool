(function(){
'use strict';

var Tips = window.RVO_TIPS || {};

/* ── i18n ── */
let lang = (window.DEFAULT_LANG === 'id') ? 'id' : 'en';
const LANG_SENS = {
  en: {
    sensTitle: 'Rent vs Own: Sensitivity Tool',
    sensSubtitle: 'Model the long-term financial outcome of renting vs buying property, comparing cash, equity and net wealth over time.',
    btnBack: '← Back',
    labelCurrency: 'Currency Symbol:',
    labelMetric: 'Metric:',
    labelAtYear: 'At year:',
    yearHint: "(clamped to each scenario's horizon)",
    btnCSV: '⬇ CSV',
    btnUploadCSV: '⬆ CSV',
    btnCompareAll: 'Compare',
    csvParseError: 'Could not read this CSV. Make sure it is a sensitivity CSV exported from this tool.',
    gcTitle: 'All scenarios',
    gcScenariosLabel: 'Scenarios:',
    gcShowOwn: 'Own',
    gcShowRent: 'Rent',
    metricNetEquity: 'Net equity',
    metricLiquidCash: 'Liquid cash',
    metricAccumCost: 'Accumulated cost',
    // Phone-width forms of the metric switch, so its three options keep one row.
    metricNetEquityShort: 'Net equity',
    metricLiquidCashShort: 'Liq. cash',
    metricAccumCostShort: 'Accum. cost',
    tableHeaderParam: 'Parameter',
    tableHeaderUnit: 'Unit',
    btnAddScenario: '+ Scenario',
    scenPlaceholder: 'Scenario',
    cappedAt: (n) => `capped at year ${n}`,
    ownOutputLabel: (ml) => `Own: ${ml}`,
    rentOutputLabel: (ml) => `Rent: ${ml}`,
    deltaLabel: 'Own minus rent',
    actionsLabel: 'Per-scenario',
    dlOwnTitle: 'Download Own cashflow (CSV)',
    dlRentTitle: 'Download Rent cashflow (CSV)',
    chartBtnTitle: 'Show comparison chart',
    chartCompare: 'Comparison',
    closeTitle: 'Close',
    /* Buttons in the export cluster are glyphs or two-word labels, so the
       title attribute is what says what each one does, in the wording every
       tool on the site uses. */
    btnSvgTitle: 'Download this chart as SVG',
    btnPngTitle: 'Download this chart as PNG',
    btnCopyTitle: 'Copy PNG to clipboard',
    btnResetZoomTitle: 'Reset zoom',
    chartHoverHint: 'Hover over the chart to inspect a year.',
    seriesOwn: 'Own',
    seriesRent: 'Rent',
    boolEnabled: 'Enabled',
    dupTitle: 'Duplicate',
    dragTitle: 'Drag to reorder scenarios',
    removeTitle: 'Remove',
    sepGeneral: 'Assumptions',
    sepOwn: 'Home: property & mortgage',
    sepRent: 'Rent: rental payments & costs',
    pHorizon: 'Time horizon',
    pRiskFreeRate: 'Risk-Free Rate',
    pInitialCash: 'Initial cash',
    pMonthlyBudget: 'Monthly housing budget',
    pMonthlyBudgetIncrease: 'Budget annual increase',
    pPropertyPrice: 'Property price',
    pDownPaymentPct: 'Down payment',
    pMortgageType: 'Mortgage type',
    pMortgageRate: 'Mortgage rate',
    pMortgageTerm: 'Mortgage term',
    pHouseGrowth: 'House price growth (RPPI)',
    pSellingCost: 'Selling cost',
    pSetupCost: 'Setup cost',
    pSetupCostType: 'Setup cost type',
    pOwnOngoingCost: 'Ongoing cost (own)',
    pOwnOngoingCostFreq: 'Own cost frequency',
    pOwnOngoingCostType: 'Own cost type',
    pOwnOngoingInflation: 'Own cost inflation',
    pCostInterestOnly: 'Cost = interest only',
    pRentAmount: 'Rent amount',
    pRentFreq: 'Rent frequency',
    pRentInflation: 'Rent inflation',
    pRentOngoingCost: 'Ongoing cost (rent)',
    pRentOngoingCostFreq: 'Rent cost frequency',
    pRentOngoingCostType: 'Rent cost type',
    pRentOngoingInflation: 'Rent cost inflation',
    pMortgageMode: 'Mortgage detail',
    pOwnCostsMode: 'Own costs detail',
    pRentCostsMode: 'Rent costs detail',
    segSimple: 'Simple',
    segDetailed: 'Detailed',
    pRatePeriodN: (k) => `Rate, period ${k}`,
    pSetupCostN: (k) => `Setup cost ${k}`,
    pOwnOngoingN: (k) => `Own ongoing cost ${k}`,
    pRentOngoingN: (k) => `Rent ongoing cost ${k}`,
    btnAddPeriod: '+ Rate period',
    btnAddSetupCost: '+ Setup cost',
    btnAddOngoingCost: '+ Ongoing cost',
    optFixed: 'Fixed',
    optFloating: 'Floating',
    uYr: 'Year',
    uToYr: 'to year',
    lblInfl: 'inflation',
    optPerYear: '/ yr',
    optPerMonth: '/ mo',
    optPerWeek: '/ wk',
    optPctBuyPrice: '% of buy price',
    notUsed: 'not used in this scenario',
    offNoBudget: 'Only with a set budget',
    offPctCost: 'Not used for a % cost',
    uYrs: 'yrs',
    uPctPa: '%/yr',
    uPerYr: '/yr',
    uPerMo: '/mo',
    uPerWk: '/wk',
    phAuto: 'Auto',
    autoNote: '0 = auto',
    unitOr: ' or ',
    uPctOfPrice: '% of price',
    uPctOfSale: '% of sale',
    optPI: 'Principal and interest (P&I)',
    optIO: 'Interest only (IO)',
    optFixedAmount: (sym) => `Fixed amount (${sym})`,
    optPctPropertyPrice: '% of property price',
    optYearly: 'a year',
    optMonthly: 'a month',
    optWeekly: 'a week',
    optPctPropertyValue: '% of property value',
    optPctAnnualRent: '% of yearly rent',
    pctOfRent: '% of rent',
    pctOfValue: '% of value',
    hintMax: 'Max',
    hintMin: 'Min',
  },
  id: {
    sensTitle: 'Sewa vs Beli: Alat Sensitivitas',
    sensSubtitle: 'Modelkan hasil keuangan jangka panjang dari menyewa vs membeli properti, membandingkan kas, ekuitas, dan kekayaan bersih dari waktu ke waktu.',
    btnBack: '← Kembali',
    labelCurrency: 'Simbol Mata Uang:',
    labelMetric: 'Metrik:',
    labelAtYear: 'Di tahun:',
    yearHint: '(dibatasi oleh jangka waktu masing-masing skenario)',
    btnCSV: '⬇ CSV',
    btnUploadCSV: '⬆ CSV',
    btnCompareAll: 'Bandingkan',
    csvParseError: 'Tidak dapat membaca CSV ini. Pastikan file adalah CSV sensitivitas yang diekspor dari alat ini.',
    gcTitle: 'Semua skenario',
    gcScenariosLabel: 'Skenario:',
    gcShowOwn: 'Beli',
    gcShowRent: 'Sewa',
    metricNetEquity: 'Kekayaan bersih',
    metricLiquidCash: 'Uang tunai',
    metricAccumCost: 'Biaya kumulatif',
    metricNetEquityShort: 'Kekayaan bersih',
    metricLiquidCashShort: 'Tunai',
    metricAccumCostShort: 'Total biaya',
    tableHeaderParam: 'Parameter',
    tableHeaderUnit: 'Unit',
    btnAddScenario: '+ Skenario',
    scenPlaceholder: 'Skenario',
    cappedAt: (n) => `dibatasi di tahun ke-${n}`,
    ownOutputLabel: (ml) => `Beli: ${ml}`,
    rentOutputLabel: (ml) => `Sewa: ${ml}`,
    deltaLabel: 'Beli dikurangi sewa',
    actionsLabel: 'Per-skenario',
    dlOwnTitle: 'Unduh arus kas Beli (CSV)',
    dlRentTitle: 'Unduh arus kas Sewa (CSV)',
    chartBtnTitle: 'Tampilkan grafik perbandingan',
    chartCompare: 'Perbandingan',
    closeTitle: 'Tutup',
    btnSvgTitle: 'Unduh grafik ini sebagai SVG',
    btnPngTitle: 'Unduh grafik ini sebagai PNG',
    btnCopyTitle: 'Salin PNG ke papan klip',
    btnResetZoomTitle: 'Atur ulang zoom',
    chartHoverHint: 'Arahkan kursor ke grafik untuk memeriksa suatu tahun.',
    seriesOwn: 'Beli',
    seriesRent: 'Sewa',
    boolEnabled: 'Aktif',
    dupTitle: 'Duplikat',
    dragTitle: 'Seret untuk mengurutkan skenario',
    removeTitle: 'Hapus',
    sepGeneral: 'Asumsi',
    sepOwn: 'Rumah: properti & KPR',
    sepRent: 'Sewa: pembayaran & biaya',
    pHorizon: 'Jangka waktu',
    pRiskFreeRate: 'Suku Bunga Bebas Risiko',
    pInitialCash: 'Modal awal',
    pMonthlyBudget: 'Anggaran perumahan bulanan',
    pMonthlyBudgetIncrease: 'Kenaikan anggaran tahunan',
    pPropertyPrice: 'Harga properti',
    pDownPaymentPct: 'Uang Muka (DP)',
    pMortgageType: 'Jenis KPR',
    pMortgageRate: 'Bunga KPR',
    pMortgageTerm: 'Jangka waktu KPR',
    pHouseGrowth: 'Kenaikan harga properti (RPPI)',
    pSellingCost: 'Biaya penjualan',
    pSetupCost: 'Biaya awal pembelian',
    pSetupCostType: 'Tipe biaya awal',
    pOwnOngoingCost: 'Biaya rutin (beli)',
    pOwnOngoingCostFreq: 'Frekuensi biaya rutin beli',
    pOwnOngoingCostType: 'Tipe biaya rutin beli',
    pOwnOngoingInflation: 'Inflasi biaya rutin beli',
    pCostInterestOnly: 'Biaya = bunga saja',
    pRentAmount: 'Biaya sewa',
    pRentFreq: 'Frekuensi sewa',
    pRentInflation: 'Kenaikan sewa tahunan',
    pRentOngoingCost: 'Biaya rutin (sewa)',
    pRentOngoingCostFreq: 'Frekuensi biaya rutin sewa',
    pRentOngoingCostType: 'Tipe biaya rutin sewa',
    pRentOngoingInflation: 'Inflasi biaya rutin sewa',
    pMortgageMode: 'Rincian KPR',
    pOwnCostsMode: 'Rincian biaya beli',
    pRentCostsMode: 'Rincian biaya sewa',
    segSimple: 'Sederhana',
    segDetailed: 'Rinci',
    pRatePeriodN: (k) => `Bunga, periode ${k}`,
    pSetupCostN: (k) => `Biaya awal ${k}`,
    pOwnOngoingN: (k) => `Biaya rutin beli ${k}`,
    pRentOngoingN: (k) => `Biaya rutin sewa ${k}`,
    btnAddPeriod: '+ Periode bunga',
    btnAddSetupCost: '+ Biaya awal',
    btnAddOngoingCost: '+ Biaya rutin',
    optFixed: 'Tetap',
    optFloating: 'Mengambang',
    uYr: 'Tahun',
    uToYr: 'hingga tahun',
    lblInfl: 'inflasi',
    optPerYear: '/ thn',
    optPerMonth: '/ bln',
    optPerWeek: '/ mgg',
    optPctBuyPrice: '% dari harga beli',
    notUsed: 'tidak dipakai di skenario ini',
    offNoBudget: 'Hanya jika anggaran diisi',
    offPctCost: 'Tidak dipakai untuk biaya %',
    uYrs: 'thn',
    uPctPa: '%/thn',
    uPerYr: '/thn',
    uPerMo: '/bln',
    uPerWk: '/mgg',
    phAuto: 'Otomatis',
    autoNote: '0 = otomatis',
    unitOr: ' atau ',
    uPctOfPrice: '% dari harga',
    uPctOfSale: '% harga jual',
    optPI: 'Pokok dan bunga (P&I)',
    optIO: 'Bunga saja (IO)',
    optFixedAmount: (sym) => `Jumlah tetap (${sym})`,
    optPctPropertyPrice: '% dari harga properti',
    optYearly: 'per tahun',
    optMonthly: 'per bulan',
    optWeekly: 'per minggu',
    optPctPropertyValue: '% dari nilai properti',
    optPctAnnualRent: '% dari sewa tahunan',
    pctOfRent: '% dari sewa',
    pctOfValue: '% dari nilai',
    hintMax: 'Maks.',
    hintMin: 'Min.',
  }
};
function T(key){ return LANG_SENS[lang][key] !== undefined ? LANG_SENS[lang][key] : (LANG_SENS.en[key] !== undefined ? LANG_SENS.en[key] : key); }

function applyLang(){
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const key = el.dataset.i18n;
    const val = LANG_SENS[lang][key];
    if(val !== undefined && typeof val === 'string') el.textContent = val;
  });
  /* switch tooltip text for data-tip-key elements based on language */
  if(window.RVO_APPLY_TIPS) RVO_APPLY_TIPS(tipTable());
}

// The tip table for the language on screen.
function tipTable(){
  return (lang === 'id' && window.RVO_TIPS_ID) ? RVO_TIPS_ID : (window.RVO_TIPS_EN || window.RVO_TIPS);
}

/* ── PARAMS (metadata for simple-mode rows) ──
   min/max MUST match the matching control on the main calculator (index.html),
   otherwise the same typed value is silently clamped differently on the two
   pages and the scenarios stop being reproducible there.

   A field's unit sits inside it, as on the main page (see paramAffix):
     suf      a fixed suffix ("yrs", "%/yr")
     per      money paid at a fixed period ("/mo")
     freqKey  money paid at the period another field picks
     basis    a cost that is money or a "%" of something, by its type field
     auto     0 means automatic, shown as a blank field
   activeIf(sc) is false where the engine does not read the field for that
   scenario, so its cell is shown as unused (offKey says why) rather than as
   a live input. */
const notPct = typeKey => sc => sc[typeKey] !== 'pct';
const PARAMS = [
  {key:'horizon',              labelKey:'pHorizon',              type:'integer',  suf:'uYrs',          min:5,   max:100, step:1,    tip:'horizon'},
  {key:'riskFreeRate',         labelKey:'pRiskFreeRate',         type:'percent',  suf:'uPctPa',        min:-10, max:25,  step:0.05, tip:'riskFreeRate'},
  {key:'initialCash',          labelKey:'pInitialCash',          type:'currency', auto:true,           min:0,            step:10000,tip:'initialCash'},
  {key:'monthlyBudget',        labelKey:'pMonthlyBudget',        type:'currency', auto:true, per:'monthly', min:0,       step:100,  tip:'monthlyBudget'},
  {key:'monthlyBudgetIncrease',labelKey:'pMonthlyBudgetIncrease',type:'percent',  suf:'uPctPa',        min:0,   max:25,  step:0.1,  tip:'monthlyBudgetIncrease',
    activeIf: sc => (Number(sc.monthlyBudget)||0) > 0, offKey:'offNoBudget'},
  {key:'propertyPrice',        labelKey:'pPropertyPrice',        type:'currency',                      min:50000,        step:10000,tip:'propertyPrice'},
  {key:'downPaymentPct',       labelKey:'pDownPaymentPct',       type:'percent',  suf:'uPctOfPrice',   min:0,   max:100, step:0.5,  tip:'downPaymentPct'},
  {key:'mortgageType',         labelKey:'pMortgageType',         type:'select',   options:[{v:'pi',lk:'optPI'},{v:'io',lk:'optIO'}], tip:'mortgageType'},
  {key:'mortgageRate',         labelKey:'pMortgageRate',         type:'percent',  suf:'uPctPa',        min:0,   max:25,  step:0.05, tip:'mortgageRate'},
  {key:'mortgageTerm',         labelKey:'pMortgageTerm',         type:'integer',  suf:'uYrs',          min:5,   max:50,  step:1,    tip:'mortgageTerm'},
  {key:'houseGrowth',          labelKey:'pHouseGrowth',          type:'percent',  suf:'uPctPa',        min:-10, max:25,  step:0.1,  tip:'houseGrowth'},
  {key:'sellingCostPct',       labelKey:'pSellingCost',          type:'percent',  suf:'uPctOfSale',    min:0,   max:15,  step:0.1,  tip:'sellingCost'},
  {key:'setupCost',            labelKey:'pSetupCost',            type:'currency', basis:'setup',       min:0,            step:500,  tip:'setupCost'},
  {key:'setupCostType',        labelKey:'pSetupCostType',        type:'select',   options:[{v:'dollar',lk:'optFixedAmount'},{v:'pct',lk:'optPctPropertyPrice'}]},
  {key:'ownOngoingCost',       labelKey:'pOwnOngoingCost',       type:'currency', basis:'own',         min:0,            step:100,  tip:'ownOngoingCost'},
  {key:'ownOngoingCostFreq',   labelKey:'pOwnOngoingCostFreq',   type:'select',   options:[{v:'yearly',lk:'optYearly'},{v:'monthly',lk:'optMonthly'},{v:'weekly',lk:'optWeekly'}],
    activeIf: notPct('ownOngoingCostType'), offKey:'offPctCost'},
  {key:'ownOngoingCostType',   labelKey:'pOwnOngoingCostType',   type:'select',   options:[{v:'dollar',lk:'optFixedAmount'},{v:'pct',lk:'optPctPropertyValue'}]},
  {key:'ownOngoingInflation',  labelKey:'pOwnOngoingInflation',  type:'percent',  suf:'uPctPa',        min:0,   max:15,  step:0.1,  tip:'ownOngoingInflation',
    activeIf: notPct('ownOngoingCostType'), offKey:'offPctCost'},
  {key:'costInterestOnly',     labelKey:'pCostInterestOnly',     type:'boolean',                                                    tip:'costInterestOnly'},
  {key:'rentAmount',           labelKey:'pRentAmount',           type:'currency', freqKey:'rentFreq',  min:0,            step:50,   tip:'rentAmount'},
  {key:'rentFreq',             labelKey:'pRentFreq',             type:'select',   options:[{v:'monthly',lk:'optMonthly'},{v:'weekly',lk:'optWeekly'},{v:'yearly',lk:'optYearly'}]},
  {key:'rentInflation',        labelKey:'pRentInflation',        type:'percent',  suf:'uPctPa',        min:-10, max:25,  step:0.1,  tip:'rentInflation'},
  {key:'rentOngoingCost',      labelKey:'pRentOngoingCost',      type:'currency', basis:'rent',        min:0,            step:100,  tip:'rentOngoingCost'},
  {key:'rentOngoingCostFreq',  labelKey:'pRentOngoingCostFreq',  type:'select',   options:[{v:'yearly',lk:'optYearly'},{v:'monthly',lk:'optMonthly'},{v:'weekly',lk:'optWeekly'}],
    activeIf: notPct('rentOngoingCostType'), offKey:'offPctCost'},
  {key:'rentOngoingCostType',  labelKey:'pRentOngoingCostType',  type:'select',   options:[{v:'dollar',lk:'optFixedAmount'},{v:'pct',lk:'optPctAnnualRent'}]},
  {key:'rentOngoingInflation', labelKey:'pRentOngoingInflation', type:'percent',  suf:'uPctPa',        min:0,   max:15,  step:0.1,  tip:'rentOngoingInflation',
    activeIf: notPct('rentOngoingCostType'), offKey:'offPctCost'},
];
const PARAM_MAP = {};
PARAMS.forEach(p=>{ PARAM_MAP[p.key] = p; });

/* A cost entered as money or as a "%" of something: the field that picks
   which, the frequency it is paid at as money, the suffix it wears as a "%",
   and what that "%" is a share of (see pctBase). */
const COST_BASIS = {
  setup: {amount:'setupCost',       type:'setupCostType',       freq:null,                  pctKey:'uPctOfPrice', of:'price'},
  own:   {amount:'ownOngoingCost',  type:'ownOngoingCostType',  freq:'ownOngoingCostFreq',  pctKey:'pctOfValue',  of:'price'},
  rent:  {amount:'rentOngoingCost', type:'rentOngoingCostType', freq:'rentOngoingCostFreq', pctKey:'pctOfRent',   of:'rent'},
};
const BASIS_BY_TYPE = {};
Object.keys(COST_BASIS).forEach(k=>{ BASIS_BY_TYPE[COST_BASIS[k].type] = COST_BASIS[k]; });
const PER_SUFFIX = {yearly:'uPerYr', monthly:'uPerMo', weekly:'uPerWk'};

const DEFAULT_SCENARIO = {
  name: 'Base Case',
  propertyPrice: 800000,
  downPaymentPct: 20,
  mortgageType: 'pi',
  mortgageRate: 6.0,
  mortgageTerm: 30,
  riskFreeRate: 4.5,
  houseGrowth: 5.0,
  sellingCostPct: 2.5,
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
  ratePeriods: null,
  ownSetupCosts: null,
  ownOngoingCosts: null,
  rentOngoingCosts: null,
};

/* ── STATE ── */
const cloneScenario = sc => JSON.parse(JSON.stringify(sc));
let scenarios = [cloneScenario(DEFAULT_SCENARIO), Object.assign(cloneScenario(DEFAULT_SCENARIO), {name:'Scenario 1'})];
let persist = null; // mini cache handle (assigned at init)
let metric = 'netEquity';
let viewYear = 30;
let scenarioResults = [];
// Section-level Simple/Detailed modes — apply to ALL scenarios
let modes = { mortgageMode:'simple', ownCostsMode:'simple', rentCostsMode:'simple' };

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

/* Thousands separators, keeping up to 2 decimals (mirrors formatMoneyValue() in
   the main tool). Cost fields double as "% of value" fields, so rounding here
   would silently turn 1.5% into 2%. */
function addCommas(n){
  const num = Number(n) || 0;
  const isInt = Math.abs(num % 1) < 1e-9;
  return num.toLocaleString('en-US', {minimumFractionDigits:0, maximumFractionDigits:isInt ? 0 : 2});
}

function fmtInputVal(val, type){
  const n = parseNum(val);
  if(type==='currency') return addCommas(n);
  if(type==='percent')  return n.toFixed(2);
  if(type==='integer')  return String(Math.round(n));
  return String(val ?? '');
}
// What a field shows: an automatic figure (0) is a blank field with "Auto" in
// it, as the main page shows it and as the field's tip describes it.
const isAutoZero = (p, val) => !!p.auto && !(parseNum(val) > 0);
function inputText(p, val){ return isAutoZero(p, val) ? '' : fmtInputVal(val, p.type); }

function fmtCurrency(v, sym){
  sym = sym || '$';
  const n = Number(v||0), abs = Math.abs(n), sign = n<0 ? '−' : '';
  if(abs>=1e9) return sign+sym+(abs/1e9).toFixed(2)+'b';
  if(abs>=1e6) return sign+sym+(abs/1e6).toFixed(2)+'m';
  if(abs>=1000) return sign+sym+(abs/1000).toFixed(0)+'k';
  return sign+sym+Math.round(abs);
}

function escHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
const cssVar = n => getComputedStyle(document.body).getPropertyValue(n).trim();
function escAttr(s){ return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ── COMPUTE ENGINE ──
   The model is ../engine.js, the very file the main page runs, so identical
   inputs give identical results by construction. This page only maps a
   scenario onto the engine's state object (buildStateObj). Floating rates are
   read at the band midpoint, as the main page's tables and lines are. */
function buildStateObj(sc){
  const mortgageDetailed = modes.mortgageMode === 'detailed';
  return {
    propertyPrice:       Math.max(50000, sc.propertyPrice || 800000),
    downPaymentPct:      sc.downPaymentPct ?? 20,
    // Simple mortgage mode mirrors the main tool: always P&I, cost = interest only
    mortgageType:        mortgageDetailed ? (sc.mortgageType || 'pi') : 'pi',
    mortgageRate:        sc.mortgageRate ?? 6.0,
    mortgageTerm:        sc.mortgageTerm ?? 30,
    riskFreeRate:        sc.riskFreeRate ?? 4.5,
    houseGrowth:         sc.houseGrowth ?? 5.0,
    sellingCostPct:      sc.sellingCostPct ?? 2.5,
    horizon:             Math.max(1, sc.horizon || 30),
    setupCost:           Math.max(0, sc.setupCost || 0),
    setupCostType:       sc.setupCostType || 'dollar',
    ownOngoingCost:      Math.max(0, sc.ownOngoingCost || 0),
    ownOngoingCostFreq:  sc.ownOngoingCostFreq || 'yearly',
    ownOngoingCostType:  sc.ownOngoingCostType || 'dollar',
    ownOngoingInflation: sc.ownOngoingInflation ?? 0,
    costInterestOnly:    mortgageDetailed ? sc.costInterestOnly !== false : true,
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
    mortgageMode:        modes.mortgageMode,
    ratePeriods:         sc.ratePeriods || null,
    ownCostsMode:        modes.ownCostsMode,
    ownSetupCosts:       sc.ownSetupCosts || null,
    ownOngoingCosts:     sc.ownOngoingCosts || null,
    rentCostsMode:       modes.rentCostsMode,
    rentOngoingCosts:    sc.rentOngoingCosts || null,
    rtbEnabled:          false, // Rent-Then-Buy is a main-page scenario only
    rtbBuyYear:          5,
  };
}

function computeModel(S){
  return RVOEngine.computeModel(S, 'mid');
}

/* ── HELPERS ── */
function metricLabelOf(met){
  return met==='netEquity' ? T('metricNetEquity') : met==='cash' ? T('metricLiquidCash') : T('metricAccumCost');
}
function metricLabel(){ return metricLabelOf(metric); }
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
/* Own and rent are two fair options, so the difference wears the colour of
   the one that comes out ahead (blue own, gold rent), as on the main page,
   rather than gain-and-loss blue and red. For costs, ahead means cheaper. */
function deltaColor(d){
  if(Math.abs(d) < 0.5) return '';
  const ownAhead = metric==='cost' ? d < 0 : d > 0;
  return ownAhead ? 'own-val' : 'rent-val';
}
const symOf = sc => (sc && sc.currencySymbol) || '$';

/* ── DETAILED MODE: per-scenario list seeding & helpers ── */
function seedRatePeriods(sc){
  if(!Array.isArray(sc.ratePeriods) || !sc.ratePeriods.length){
    const r = sc.mortgageRate ?? 6.0;
    sc.ratePeriods = [{toYear: sc.mortgageTerm ?? 30, type:'fixed', rate:r, rateMin:r, rateMax:r}];
  }
}
function seedOwnCostItems(sc){
  if(!Array.isArray(sc.ownSetupCosts) || !sc.ownSetupCosts.length){
    sc.ownSetupCosts = [{amount:sc.setupCost ?? 0, basis:sc.setupCostType==='pct'?'pct':'fixed'}];
  }
  if(!Array.isArray(sc.ownOngoingCosts) || !sc.ownOngoingCosts.length){
    sc.ownOngoingCosts = [{amount:sc.ownOngoingCost ?? 0, basis:sc.ownOngoingCostType==='pct'?'pct':(sc.ownOngoingCostFreq||'yearly'), inflation:sc.ownOngoingInflation ?? 0}];
  }
}
function seedRentCostItems(sc){
  if(!Array.isArray(sc.rentOngoingCosts) || !sc.rentOngoingCosts.length){
    sc.rentOngoingCosts = [{amount:sc.rentOngoingCost ?? 0, basis:sc.rentOngoingCostType==='pct'?'pct':(sc.rentOngoingCostFreq||'yearly'), inflation:sc.rentOngoingInflation ?? 0}];
  }
}
function seedDetailedLists(modeKey){
  scenarios.forEach(sc=>{
    if(modeKey==='mortgageMode')  seedRatePeriods(sc);
    if(modeKey==='ownCostsMode')  seedOwnCostItems(sc);
    if(modeKey==='rentCostsMode') seedRentCostItems(sc);
  });
}
// Display ranges (Yr from–to) for a scenario's rate periods; last extends to term.
function periodRanges(list, term){
  const out = [];
  let from = 1;
  (list||[]).forEach((p,i)=>{
    let to;
    if(i === list.length-1) to = term;
    else to = Math.min(term, Math.max(from, Math.round(Number(p.toYear)||from)));
    out.push({from, to});
    from = to + 1;
  });
  return out;
}
function addRatePeriodTo(sc){
  seedRatePeriods(sc);
  const term = sc.mortgageTerm ?? 30;
  const list = sc.ratePeriods;
  const last = list[list.length-1];
  const prevTo = list.length>=2 ? (Math.round(Number(list[list.length-2].toYear))||0) : 0;
  const mid = Math.min(term-1, Math.max(prevTo+1, Math.round((prevTo + term)/2)));
  list.splice(list.length-1, 0, {
    toYear: mid, type:'fixed',
    rate: Number(last.rate)||6, rateMin: Number(last.rateMin)||6, rateMax: Number(last.rateMax)||6,
  });
}

/* ── SCENARIO MANAGEMENT ── */
function addScenario(){
  const clone = cloneScenario(scenarios[scenarios.length-1]);
  clone.name = 'Scenario '+(scenarios.length+1);
  scenarios.push(clone);
  rerender();
}
function moveScenario(from, to){
  scenarios.splice(to, 0, scenarios.splice(from, 1)[0]);
  scenarioResults.splice(to, 0, scenarioResults.splice(from, 1)[0]);
}
function removeScenario(i){
  if(scenarios.length<=1) return;
  scenarios.splice(i,1); scenarioResults.splice(i,1); rerender();
}

/* ── UNITS ──
   The unit a scenario's field is in, as the field's prefix (a currency) and
   suffix (anything else). It follows the scenario's own choices, so a setup
   cost switched to "% of property price" reads "4 % of price", not "$ 4". */
function paramAffix(p, sc){
  const sym = symOf(sc);
  if(p.basis){
    const b = COST_BASIS[p.basis];
    if(sc[b.type]==='pct') return {pre:'', suf:T(b.pctKey)};
    return {pre:sym, suf: b.freq ? T(PER_SUFFIX[sc[b.freq]] || 'uPerYr') : ''};
  }
  if(p.type==='currency'){
    const per = p.per || (p.freqKey ? sc[p.freqKey] : null);
    return {pre:sym, suf: per ? T(PER_SUFFIX[per] || 'uPerMo') : ''};
  }
  return {pre:'', suf: p.suf ? T(p.suf) : ''};
}
const paramActive = (p, sc) => !p.activeIf || p.activeIf(sc);

// The summary CSV keeps its Unit column: one unit per row, or each one the
// scenarios use ("$ or % of price") when their type fields differ.
function csvUnit(p){
  if(p.type==='select' || p.type==='boolean') return '';
  const units = [...new Set(scenarios.map(sc=>{ const a = paramAffix(p, sc); return a.pre + a.suf; }))];
  return units.join(T('unitOr')) + (p.auto ? ` (${T('autoNote')})` : '');
}

/* ── MONEY ⇄ "%" ──
   A "%" cost is a share of something, so moving a cost between money and "%"
   restates it against that rather than keeping the figure: $32,000 on an
   $800,000 home is 4% of the price. The conversion lives in the engine, with
   the main page's, so one switch gives one figure on both pages. */
const pctBase = RVOEngine.pctBase, convertCostBasis = RVOEngine.convertCostBasis;

/* ── BUILD TABLE ── */

/* The render-row list: which table rows exist given the current modes and the
   max list lengths across scenarios. Scenarios with fewer periods/cost items
   than the max get darkened inactive cells to preserve table integrity.

   Rows where one field decides what another means share a group (`grp`): the
   deciding field first, the fields it governs after it as children, with no
   rule between them. A type decides whether a cost is money or a "%", and a
   frequency decides what period the money is per. */
function buildRenderRows(){
  const rows = [];
  const P = (key, grp, child) => ({type:'param', p:PARAM_MAP[key], grp:grp||null, child:!!child});
  rows.push({type:'sep', sepKey:'sepGeneral'});
  rows.push(P('horizon'), P('riskFreeRate'), P('initialCash'));
  rows.push(P('monthlyBudget','budget'), P('monthlyBudgetIncrease','budget',true));

  rows.push({type:'sep', sepKey:'sepOwn'});
  rows.push(P('propertyPrice'), P('downPaymentPct'));
  rows.push({type:'mode', modeKey:'mortgageMode', labelKey:'pMortgageMode', tip:'mortgageMode'});
  if(modes.mortgageMode==='detailed') rows.push(P('mortgageType','mtype'), P('costInterestOnly','mtype',true));
  rows.push(P('mortgageTerm'));
  if(modes.mortgageMode==='simple'){
    rows.push(P('mortgageRate'));
  } else {
    const maxP = Math.max(1, ...scenarios.map(sc=>(sc.ratePeriods||[]).length));
    for(let k=0;k<maxP;k++) rows.push({type:'period', idx:k, subgroup:'rate-periods', first:k===0});
    rows.push({type:'addPeriod', subgroup:'rate-periods', last:true});
  }
  rows.push(P('houseGrowth'));
  rows.push(P('sellingCostPct'));
  rows.push({type:'mode', modeKey:'ownCostsMode', labelKey:'pOwnCostsMode', tip:'ownCostsMode'});
  if(modes.ownCostsMode==='simple'){
    rows.push(P('setupCostType','setup'), P('setupCost','setup',true));
    rows.push(P('ownOngoingCostType','own'), P('ownOngoingCostFreq','own',true), P('ownOngoingCost','own',true), P('ownOngoingInflation','own',true));
  } else {
    const maxS = Math.max(1, ...scenarios.map(sc=>(sc.ownSetupCosts||[]).length));
    for(let k=0;k<maxS;k++) rows.push({type:'cost', listKey:'ownSetupCosts', kind:'setup', idx:k, labelFn:'pSetupCostN', subgroup:'own-setup', first:k===0});
    rows.push({type:'addCost', listKey:'ownSetupCosts', btnKey:'btnAddSetupCost', subgroup:'own-setup', last:true});
    const maxO = Math.max(1, ...scenarios.map(sc=>(sc.ownOngoingCosts||[]).length));
    for(let k=0;k<maxO;k++) rows.push({type:'cost', listKey:'ownOngoingCosts', kind:'ongoing', idx:k, labelFn:'pOwnOngoingN', subgroup:'own-ongoing', first:k===0});
    rows.push({type:'addCost', listKey:'ownOngoingCosts', btnKey:'btnAddOngoingCost', subgroup:'own-ongoing', last:true});
  }

  rows.push({type:'sep', sepKey:'sepRent'});
  rows.push(P('rentFreq','rent'), P('rentAmount','rent',true), P('rentInflation'));
  rows.push({type:'mode', modeKey:'rentCostsMode', labelKey:'pRentCostsMode', tip:'rentCostsMode'});
  if(modes.rentCostsMode==='simple'){
    rows.push(P('rentOngoingCostType','rentcost'), P('rentOngoingCostFreq','rentcost',true), P('rentOngoingCost','rentcost',true), P('rentOngoingInflation','rentcost',true));
  } else {
    const maxR = Math.max(1, ...scenarios.map(sc=>(sc.rentOngoingCosts||[]).length));
    for(let k=0;k<maxR;k++) rows.push({type:'cost', listKey:'rentOngoingCosts', kind:'ongoing', idx:k, labelFn:'pRentOngoingN', subgroup:'rent-ongoing', first:k===0});
    rows.push({type:'addCost', listKey:'rentOngoingCosts', btnKey:'btnAddOngoingCost', subgroup:'rent-ongoing', last:true});
  }
  return rows;
}

/* `variant` is the state the control is in, for a tip that has one per state.
   A per-scenario row cannot name one state for the whole row, so it passes
   none and gets the default state's wording. */
function tipHtmlFor(tipKey, variant){
  if(!tipKey) return '';
  const tipText = window.RVO_TIP ? RVO_TIP(tipKey, variant, tipTable()) : '';
  return tipText ? `<span class="tip-icon" data-tip-key="${escAttr(tipKey)}"`
    + (variant ? ` data-tip-variant="${escAttr(variant)}"` : '')
    + (variant && (window.RVO_OPTION_TIPS || []).includes(tipKey) ? ' data-tip-options' : '')
    + ` data-tip="${escAttr(tipText)}">?</span>` : '';
}

const INACTIVE_TD = (offKey) => `<td class="scen-td inactive-td" title="${escAttr(T('notUsed'))}">`
  + (offKey ? `<span class="inactive-note">${escHtml(T(offKey))}</span>` : '') + `</td>`;

function periodCellHTML(sc, si, k){
  const list = sc.ratePeriods || [];
  if(k >= list.length) return INACTIVE_TD();
  const p = list[k];
  const term = sc.mortgageTerm ?? 30;
  const ranges = periodRanges(list, term);
  const {from, to} = ranges[k];
  const isLast = k === list.length-1;
  const floating = p.type === 'floating';
  const beyond = from > term;
  const ratesHtml = floating
    ? `<input class="mini-input rp-min" data-si="${si}" data-idx="${k}" type="text" inputmode="decimal" value="${Number(p.rateMin)||0}"/><span class="rp-dash">–</span><input class="mini-input rp-max" data-si="${si}" data-idx="${k}" type="text" inputmode="decimal" value="${Number(p.rateMax)||0}"/><span class="mini-unit">${T('uPctPa')}</span>`
    : `<input class="mini-input rp-rate" data-si="${si}" data-idx="${k}" type="text" inputmode="decimal" value="${Number(p.rate)||0}"/><span class="mini-unit">${T('uPctPa')}</span>`;
  return `<td class="scen-td detail-td">
    <div class="dcell${beyond?' dcell-beyond':''}">
      <div class="dcell-line">
        <span class="dcell-yrs">${T('uYr')} ${from}–${to}</span>
        <select class="mini-select rp-type" data-si="${si}" data-idx="${k}">
          <option value="fixed"${!floating?' selected':''}>${T('optFixed')}</option>
          <option value="floating"${floating?' selected':''}>${T('optFloating')}</option>
        </select>
        ${isLast?'':`<span class="mini-unit">${T('uToYr')}</span><input class="mini-input rp-to" data-si="${si}" data-idx="${k}" type="text" inputmode="numeric" value="${Math.round(Number(p.toYear)||to)}"/>`}
        ${list.length>1?`<button class="btn-remove rp-del" data-si="${si}" data-idx="${k}" title="${T('removeTitle')}">✕</button>`:''}
      </div>
      <div class="dcell-line">${ratesHtml}</div>
    </div>
  </td>`;
}

function costCellHTML(sc, si, listKey, kind, k){
  const list = sc[listKey] || [];
  if(k >= list.length) return INACTIVE_TD();
  const it = list[k];
  const isPct = it.basis === 'pct';
  const sym = symOf(sc);
  const pctLabel = listKey==='ownSetupCosts' ? T('optPctBuyPrice')
    : listKey==='ownOngoingCosts' ? T('optPctPropertyValue') : T('optPctAnnualRent');
  const basisOpts = kind==='setup'
    ? [['fixed', sym], ['pct', pctLabel]]
    : [['yearly', sym+' '+T('optPerYear')], ['monthly', sym+' '+T('optPerMonth')], ['weekly', sym+' '+T('optPerWeek')], ['pct', pctLabel]];
  const optsHtml = basisOpts.map(([v,l])=>`<option value="${v}"${it.basis===v?' selected':''}>${escHtml(l)}</option>`).join('');
  const amtVal = isPct ? String(Number(it.amount)||0) : addCommas(Number(it.amount)||0);
  const inflHtml = (kind==='ongoing' && !isPct)
    ? `<div class="dcell-line"><span class="mini-unit">${T('lblInfl')}</span><input class="mini-input ci-infl" data-si="${si}" data-list="${listKey}" data-idx="${k}" type="text" inputmode="decimal" value="${Number(it.inflation)||0}"/><span class="mini-unit">${T('uPctPa')}</span></div>`
    : '';
  return `<td class="scen-td detail-td">
    <div class="dcell">
      <div class="dcell-line">
        <input class="mini-input mini-amt ci-amt" data-si="${si}" data-list="${listKey}" data-idx="${k}" type="text" inputmode="numeric" value="${escAttr(amtVal)}"/>
        <select class="mini-select ci-basis" data-si="${si}" data-list="${listKey}" data-idx="${k}">${optsHtml}</select>
        ${list.length>1?`<button class="btn-remove ci-del" data-si="${si}" data-list="${listKey}" data-idx="${k}" title="${T('removeTitle')}">✕</button>`:''}
      </div>
      ${inflHtml}
    </div>
  </td>`;
}

function buildTableHTML(){
  const n = scenarios.length;
  const colCount = n + 2;

  const thScens = scenarios.map((sc,i)=>{
    const clamped = Math.min(viewYear, sc.horizon||30);
    return `<th class="scen-th"><div class="scen-header-cell">
      <div class="scen-header-actions">
        ${n>1?`<button type="button" class="col-grip" data-col-grip="${i}" title="${escAttr(T('dragTitle'))}" aria-label="${escAttr(T('dragTitle'))}">⠿</button>`:''}
        <input class="scen-name-input" data-si="${i}" value="${escHtml(sc.name)}" placeholder="${T('scenPlaceholder')} ${i+1}"/>
        <button class="btn-dupe" data-si="${i}" title="${T('dupTitle')}">⧉</button>
        ${n>1?`<button class="btn-remove rmv-scen" data-si="${i}" title="${T('removeTitle')}">✕</button>`:''}
      </div>
      ${clamped<viewYear?`<span class="scen-header-sub">${T('cappedAt')(clamped)}</span>`:''}
    </div></th>`;
  }).join('');

  const trailTd = `<td class="trail-td"></td>`;
  const renderRows = buildRenderRows();
  let bodyHtml = '';
  renderRows.forEach((r,ri)=>{
    if(r.type==='sep'){
      const sepIcon = {sepGeneral:'general', sepOwn:'own', sepRent:'rent'}[r.sepKey];
      const icnHtml = sepIcon ? `<span class="ricon ricon-${sepIcon}" aria-hidden="true"></span>` : '';
      bodyHtml += `<tr class="group-sep-tr"><td colspan="${colCount}">${icnHtml}${T(r.sepKey)}</td></tr>`;
      return;
    }
    const prevR = renderRows[ri-1], nextR = renderRows[ri+1];
    // Detailed lists (rate periods, cost items) keep their framed subgroup.
    const sub = r.subgroup || null;
    const isFirst = sub && (r.first || !prevR || prevR.subgroup!==sub);
    const isLast  = sub && (r.last  || !nextR || nextR.subgroup!==sub);
    // A deciding field and the fields it governs: one group, no rule between.
    const grp = r.grp || null;
    const rowClass = [
      sub ? 'subgroup-row' : '',
      isFirst ? 'subgroup-first' : '',
      isLast  ? 'subgroup-last'  : '',
      grp ? 'grp' : '',
      grp && (!prevR || prevR.grp!==grp) ? 'grp-first' : '',
      grp && (!nextR || nextR.grp!==grp) ? 'grp-last'  : '',
      r.child ? 'grp-child' : '',
    ].filter(Boolean).join(' ');
    const trOpen = `<tr${rowClass?' class="'+rowClass+'"':''}>`;

    if(r.type==='mode'){
      const cur = modes[r.modeKey];
      const seg = `<div class="seg-group mode-seg" data-mode-key="${r.modeKey}">
        <button class="seg-btn${cur==='simple'?' active':''}" data-val="simple">${T('segSimple')}</button>
        <button class="seg-btn${cur==='detailed'?' active':''}" data-val="detailed">${T('segDetailed')}</button>
      </div>`;
      bodyHtml += `<tr class="mode-tr"><td class="label-td">${escHtml(T(r.labelKey))}${tipHtmlFor(r.tip, cur)}</td><td class="scen-td mode-td" colspan="${n}">${seg}</td>${trailTd}</tr>`;
      return;
    }
    if(r.type==='period'){
      const tds = scenarios.map((sc,i)=>periodCellHTML(sc,i,r.idx)).join('');
      bodyHtml += `${trOpen}<td class="label-td">${escHtml(T('pRatePeriodN')(r.idx+1))}${r.idx===0?tipHtmlFor('rateSchedule'):''}</td>${tds}${trailTd}</tr>`;
      return;
    }
    if(r.type==='addPeriod'){
      const tds = scenarios.map((sc,i)=>`<td class="scen-td add-td"><button class="btn-add add-period-btn" data-si="${i}">${T('btnAddPeriod')}</button></td>`).join('');
      bodyHtml += `${trOpen}<td class="label-td"></td>${tds}${trailTd}</tr>`;
      return;
    }
    if(r.type==='cost'){
      const tds = scenarios.map((sc,i)=>costCellHTML(sc,i,r.listKey,r.kind,r.idx)).join('');
      const tip = r.idx===0 ? tipHtmlFor(r.listKey==='ownSetupCosts'?'setupCost':r.listKey==='ownOngoingCosts'?'ownOngoingCost':'rentOngoingCost') : '';
      bodyHtml += `${trOpen}<td class="label-td">${escHtml(T(r.labelFn)(r.idx+1))}${tip}</td>${tds}${trailTd}</tr>`;
      return;
    }
    if(r.type==='addCost'){
      const tds = scenarios.map((sc,i)=>`<td class="scen-td add-td"><button class="btn-add add-cost-btn" data-si="${i}" data-list="${r.listKey}">${T(r.btnKey)}</button></td>`).join('');
      bodyHtml += `${trOpen}<td class="label-td"></td>${tds}${trailTd}</tr>`;
      return;
    }

    // r.type==='param'
    const p = r.p;
    const tds = scenarios.map((sc,i)=>{
      // A field the engine does not read for this scenario (a frequency under
      // a "%" type, say) is shown as unused, not as an input that does nothing.
      if(!paramActive(p, sc)) return INACTIVE_TD(p.offKey);
      let inp = '';
      if(p.type==='select'){
        const optLabel = o => { const l = o.lk ? T(o.lk) : o.l; return typeof l==='function' ? l(symOf(sc)) : l; };
        const opts = (p.options||[]).map(o=>`<option value="${escAttr(o.v)}"${sc[p.key]===o.v?' selected':''}>${escHtml(optLabel(o))}</option>`).join('');
        inp = `<select class="param-select" data-si="${i}" data-key="${p.key}">${opts}</select>`;
      } else if(p.type==='boolean'){
        inp = `<div class="param-bool-wrap"><input type="checkbox" class="param-bool" data-si="${i}" data-key="${p.key}"${sc[p.key]!==false?' checked':''}/><span class="param-bool-label">${T('boolEnabled')}</span></div>`;
      } else {
        const {pre, suf} = paramAffix(p, sc);
        inp = `<div class="input-wrap param-wrap">`
          + (pre ? `<span class="prefix">${escHtml(pre)}</span>` : '')
          + `<input class="param-input" type="text" inputmode="${p.type==='integer'?'numeric':'decimal'}" data-si="${i}" data-key="${p.key}" data-ptype="${p.type}" data-min="${p.min!=null?p.min:0}" data-max="${p.max!=null?p.max:1000000000000}"`
          + (p.auto ? ` placeholder="${escAttr(T('phAuto'))}"` : '')
          + ` value="${escAttr(inputText(p, sc[p.key]))}"/>`
          + (suf ? `<span class="suffix">${escHtml(suf)}</span>` : '')
          + `</div>`;
      }
      return `<td class="scen-td">${inp}</td>`;
    }).join('');

    bodyHtml += `${trOpen}<td class="label-td">${escHtml(T(p.labelKey))}${tipHtmlFor(p.tip)}</td>${tds}${trailTd}</tr>`;
  });

  const ml = metricLabel();
  const ownTds  = scenarios.map((_,i)=>{ const v=getMetricValues(i); return `<td class="scen-td num-td">${v.own!==null?fmtCurrency(v.own,symOf(scenarios[i])):'—'}</td>`; }).join('');
  const rentTds = scenarios.map((_,i)=>{ const v=getMetricValues(i); return `<td class="scen-td num-td">${v.rent!==null?fmtCurrency(v.rent,symOf(scenarios[i])):'—'}</td>`; }).join('');
  const deltaTds= scenarios.map((_,i)=>{ const v=getMetricValues(i); if(v.own===null) return `<td class="scen-td num-td">—</td>`; const d=v.own-v.rent; return `<td class="scen-td num-td ${deltaColor(d)}">${d>=0?'+':''}${fmtCurrency(d,symOf(scenarios[i]))}</td>`; }).join('');

  const actionTds = scenarios.map((_,i)=>`<td class="scen-td action-td">
      <div class="scen-actions">
        <button class="btn-scen-action dl-own" data-si="${i}" title="${escAttr(T('dlOwnTitle'))}">⬇<span class="ricon ricon-own" aria-hidden="true"></span></button>
        <button class="btn-scen-action dl-rent" data-si="${i}" title="${escAttr(T('dlRentTitle'))}">⬇<span class="ricon ricon-rent" aria-hidden="true"></span></button>
        <button class="btn-scen-action show-chart" data-si="${i}" title="${escAttr(T('chartBtnTitle'))}"><span class="ricon ricon-chart" aria-hidden="true"></span></button>
      </div>
    </td>`).join('');

  return `<table class="dt"><thead><tr>
    <th class="label-td">${T('tableHeaderParam')}</th>${thScens}
    <th style="white-space:nowrap;vertical-align:middle;"><button class="btn-add" id="addScenBtn">${T('btnAddScenario')}</button></th>
  </tr></thead><tbody>
    ${bodyHtml}
    <tr class="sep-tr"><td colspan="${colCount}"></td></tr>
    <tr class="out-own"><td class="label-td"><span class="ricon ricon-own" aria-hidden="true"></span><span class="out-lbl-text">${T('ownOutputLabel')(ml)}</span></td>${ownTds}${trailTd}</tr>
    <tr class="out-rent"><td class="label-td"><span class="ricon ricon-rent" aria-hidden="true"></span><span class="out-lbl-text">${T('rentOutputLabel')(ml)}</span></td>${rentTds}${trailTd}</tr>
    <tr class="out-delta"><td class="label-td">${T('deltaLabel')}</td>${deltaTds}${trailTd}</tr>
    <tr class="out-actions"><td class="label-td">${T('actionsLabel')}</td>${actionTds}${trailTd}</tr>
  </tbody></table>`;
}

/* ── RERENDER OUTPUT ONLY ── */
function rerenderOutputOnly(){
  const wrap = document.getElementById('tableWrap');
  if(!wrap) return;
  const ml = metricLabel();
  const ol = wrap.querySelector('tr.out-own .label-td .out-lbl-text');   if(ol) ol.textContent = T('ownOutputLabel')(ml);
  const rl = wrap.querySelector('tr.out-rent .label-td .out-lbl-text');  if(rl) rl.textContent = T('rentOutputLabel')(ml);
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

function recomputeScenario(si){
  try{ scenarioResults[si] = computeModel(buildStateObj(scenarios[si])); }catch(err){ console.error(err); }
  if(persist) persist.schedule(); // per-scenario edits — save them
}

/* ── RERENDER ── */
function rerender(){
  if(persist) persist.schedule(); // scenario edits funnel through here — save them
  scenarioResults = scenarios.map(sc=>{ try{ return computeModel(buildStateObj(sc)); }catch(e){ console.error(e); return null; } });
  const wrap = document.getElementById('tableWrap');
  if(!wrap) return;
  wrap.innerHTML = buildTableHTML();
  wireEvents();
}

/* ── CSV DOWNLOAD ── */
function describePeriod(sc, k){
  const list = sc.ratePeriods || [];
  if(k >= list.length) return '';
  const p = list[k];
  const r = periodRanges(list, sc.mortgageTerm ?? 30)[k];
  return p.type==='floating'
    ? `floating yr ${r.from}-${r.to} @ ${Number(p.rateMin)||0}-${Number(p.rateMax)||0}%`
    : `fixed yr ${r.from}-${r.to} @ ${Number(p.rate)||0}%`;
}
function describeCostItem(sc, listKey, kind, k){
  const list = sc[listKey] || [];
  if(k >= list.length) return '';
  const it = list[k];
  const amt = Number(it.amount)||0;
  if(it.basis==='pct'){
    const of = listKey==='ownSetupCosts' ? 'of buy price' : listKey==='ownOngoingCosts' ? 'of property value' : 'of annual rent';
    return `${amt}% ${of}`;
  }
  if(kind==='setup') return `${amt} fixed`;
  return `${amt} ${it.basis} (+${Number(it.inflation)||0}%/yr)`;
}
function downloadCSV(){
  const esc = v => '"'+String(v).replace(/"/g,'""')+'"';
  const lines = [];
  lines.push([esc(T('tableHeaderParam')), esc(T('tableHeaderUnit')), ...scenarios.map(sc=>esc(sc.name))].join(','));
  buildRenderRows().forEach(r=>{
    if(r.type==='sep' || r.type==='addPeriod' || r.type==='addCost') return;
    if(r.type==='mode'){
      lines.push([esc(T(r.labelKey)), esc(''), ...scenarios.map(()=>esc(modes[r.modeKey]))].join(','));
      return;
    }
    if(r.type==='period'){
      lines.push([esc(T('pRatePeriodN')(r.idx+1)), esc(''), ...scenarios.map(sc=>esc(describePeriod(sc, r.idx)))].join(','));
      return;
    }
    if(r.type==='cost'){
      lines.push([esc(T(r.labelFn)(r.idx+1)), esc(''), ...scenarios.map(sc=>esc(describeCostItem(sc, r.listKey, r.kind, r.idx)))].join(','));
      return;
    }
    const p = r.p;
    lines.push([esc(T(p.labelKey)), esc(csvUnit(p)), ...scenarios.map(sc=>{
      if(p.type==='boolean') return esc(sc[p.key]!==false?'Yes':'No');
      if(p.type==='select')  return esc(sc[p.key]||'');
      return esc(sc[p.key]??0);
    })].join(','));
  });
  lines.push('');
  const ml = metricLabel();
  // cleanCSV() renders the labels as plain ASCII: the cosmetic em-dash separator
  // is dropped ("Own — Net Equity" -> "Own Net Equity") while the functional
  // delta/minus are kept ("Δ Own − Rent" -> "Delta Own - Rent"). Empty cells
  // mark scenarios with no value.
  // The empty second cell keeps these result rows aligned with the parameter
  // rows above, which carry a "Unit" column between the label and the scenarios.
  lines.push([esc(T('ownOutputLabel')(ml)),  esc(''), ...scenarios.map((_,i)=>{ const v=getMetricValues(i); return esc(v.own!==null?fmtCurrency(v.own,symOf(scenarios[i])):''); })].join(','));
  lines.push([esc(T('rentOutputLabel')(ml)), esc(''), ...scenarios.map((_,i)=>{ const v=getMetricValues(i); return esc(v.rent!==null?fmtCurrency(v.rent,symOf(scenarios[i])):''); })].join(','));
  lines.push([esc(T('deltaLabel')),          esc(''), ...scenarios.map((_,i)=>{ const v=getMetricValues(i); if(v.own===null) return esc(''); const d=v.own-v.rent; return esc((d>=0?'+':'')+fmtCurrency(d,symOf(scenarios[i]))); })].join(','));

  const blob = new Blob([RVOExport.cleanCSV(lines.join('\n'))], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'rent-vs-own-sensitivity.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

/* ── CSV UPLOAD ──
   Rebuilds the scenarios + section modes from a CSV in the same layout produced
   by downloadCSV(). The trailing result rows (Net Equity / Δ) are optional and
   ignored, so a downloaded CSV — with or without those last 3 rows — round-trips
   back to the identical computed result. */
function parseCSVText(text){
  const rows = [];
  let row = [], field = '', inQ = false;
  for(let i=0; i<text.length; i++){
    const c = text[i];
    if(inQ){
      if(c==='"'){ if(text[i+1]==='"'){ field+='"'; i++; } else inQ=false; }
      else field += c;
      continue;
    }
    if(c==='"'){ inQ = true; }
    else if(c===','){ row.push(field); field=''; }
    else if(c==='\n' || c==='\r'){
      if(c==='\r' && text[i+1]==='\n') i++;
      row.push(field); rows.push(row); row=[]; field='';
    } else field += c;
  }
  if(field.length || row.length){ row.push(field); rows.push(row); }
  return rows;
}

// Reverse maps: translated label → param key / mode key (both languages).
/* Row labels a CSV saved before the October 2026 relabel carries. The importer
   reads rows by label, so an old file must still find its rows under the
   names it was written with, in either language. */
const LEGACY_ROW_LABELS = {
  pHorizon:       ['Horizon'],
  pHouseGrowth:   ['House Growth (RPPI)'],
  pMonthlyBudget: ['Anggaran Rumah Bulanan'],
  pMortgageType:  ['Tipe KPR'],
  pMortgageMode:  ['Mortgage Mode', 'Mode KPR'],
  pOwnCostsMode:  ['Own Costs Mode', 'Mode Biaya Beli'],
  pRentCostsMode: ['Rent Costs Mode', 'Mode Biaya Sewa'],
};
function buildReverseLabelMaps(){
  const norm = s => String(s||'').trim().toLowerCase();
  const paramByLabel = {}, modeByLabel = {};
  const MODES = [['pMortgageMode','mortgageMode'],['pOwnCostsMode','ownCostsMode'],['pRentCostsMode','rentCostsMode']];
  ['en','id'].forEach(lg=>{
    const L = LANG_SENS[lg];
    PARAMS.forEach(p=>{ const lbl = L[p.labelKey]; if(typeof lbl==='string') paramByLabel[norm(lbl)] = p.key; });
    MODES.forEach(([lk,mk])=>{
      const lbl = L[lk]; if(typeof lbl==='string') modeByLabel[norm(lbl)] = mk;
    });
  });
  PARAMS.forEach(p=>{ (LEGACY_ROW_LABELS[p.labelKey]||[]).forEach(l=>{ if(!(norm(l) in paramByLabel)) paramByLabel[norm(l)] = p.key; }); });
  MODES.forEach(([lk,mk])=>{ (LEGACY_ROW_LABELS[lk]||[]).forEach(l=>{ if(!(norm(l) in modeByLabel)) modeByLabel[norm(l)] = mk; }); });
  return {paramByLabel, modeByLabel};
}

const RE_PERIOD = /^(?:rate period|periode bunga)\s+(\d+)$/i;
const RE_SETUP  = /^(?:setup cost|biaya awal)\s+(\d+)$/i;
const RE_OWN_ON = /^(?:own ongoing cost|biaya rutin beli)\s+(\d+)$/i;
const RE_RENT_ON= /^(?:rent ongoing cost|biaya rutin sewa)\s+(\d+)$/i;

// Inverse of describePeriod(): "fixed yr 1-30 @ 6%" / "floating yr 1-5 @ 4-6%".
function parsePeriodCell(text){
  const m = String(text||'').trim().match(/^(fixed|floating)\s+yr\s+(\d+)-(\d+)\s+@\s+([\d.]+)(?:-([\d.]+))?%$/i);
  if(!m) return null;
  const toYear = parseInt(m[3],10);
  if(m[1].toLowerCase()==='floating'){
    const a = parseFloat(m[4])||0, b = parseFloat(m[5]!==undefined?m[5]:m[4])||0;
    return {toYear, type:'floating', rate:a, rateMin:Math.min(a,b), rateMax:Math.max(a,b)};
  }
  const r = parseFloat(m[4])||0;
  return {toYear, type:'fixed', rate:r, rateMin:r, rateMax:r};
}
// Inverse of describeCostItem().
function parseCostCell(text, kind){
  const s = String(text||'').trim();
  let m;
  if((m = s.match(/^([\d.]+)%\s+/))){ return {amount:parseFloat(m[1])||0, basis:'pct', inflation:0}; }
  if((m = s.match(/^([\d,]+(?:\.\d+)?)\s+fixed$/i))){ return {amount:parseNum(m[1]), basis:'fixed'}; }
  if((m = s.match(/^([\d,]+(?:\.\d+)?)\s+(yearly|monthly|weekly)\s+\(\+([\d.]+)%\/yr\)$/i))){
    return {amount:parseNum(m[1]), basis:m[2].toLowerCase(), inflation:parseFloat(m[3])||0};
  }
  return null;
}

function buildScenariosFromCSV(text){
  const rows = parseCSVText(text);
  if(!rows.length) throw new Error('empty');
  // Locate header: first row whose first cell is the Parameter header (any lang).
  const isHeader = r => r && r[0] && /^(parameter)$/i.test(String(r[0]).trim());
  let h = rows.findIndex(isHeader);
  if(h < 0) h = 0;
  const header = rows[h];
  const names = header.slice(2).map(s=>String(s||'').trim()).filter((_,i)=> header[2+i] !== undefined);
  // Trim trailing empty name columns (the result section has fewer columns).
  let nScen = names.length;
  while(nScen > 0 && names[nScen-1]==='') nScen--;
  if(nScen < 1) throw new Error('no scenarios');

  const {paramByLabel, modeByLabel} = buildReverseLabelMaps();
  const newModes = {mortgageMode:'simple', ownCostsMode:'simple', rentCostsMode:'simple'};
  const sym = (document.getElementById('currencySelect') || {}).value || '$';
  const newScen = [];
  for(let j=0;j<nScen;j++){
    const sc = cloneScenario(DEFAULT_SCENARIO);
    sc.name = names[j] || ('Scenario '+(j+1));
    sc.currencySymbol = sym;
    sc.ratePeriods = null; sc.ownSetupCosts = null; sc.ownOngoingCosts = null; sc.rentOngoingCosts = null;
    newScen.push(sc);
  }

  for(let ri=h+1; ri<rows.length; ri++){
    const r = rows[ri];
    if(!r) continue;
    const label = String(r[0]||'').trim();
    if(label==='' ){
      // Blank row marks the start of the (ignored) result section → stop.
      const allEmpty = r.every(c=>String(c||'').trim()==='');
      if(allEmpty) break;
      continue;
    }
    const lc = label.toLowerCase();
    const valAt = j => (r[2+j] !== undefined ? String(r[2+j]) : '');

    // Section mode rows (value identical across columns → read first).
    if(modeByLabel[lc]){
      const v = String(valAt(0)).trim().toLowerCase();
      newModes[modeByLabel[lc]] = (v==='detailed') ? 'detailed' : 'simple';
      continue;
    }
    // Simple-mode parameter rows.
    if(paramByLabel[lc]){
      const key = paramByLabel[lc], p = PARAM_MAP[key];
      for(let j=0;j<nScen;j++){
        const raw = valAt(j).trim();
        if(raw==='') continue;
        if(p.type==='boolean')      newScen[j][key] = /^(yes|true|1|ya)$/i.test(raw);
        else if(p.type==='select')  newScen[j][key] = raw;
        else                        newScen[j][key] = parseNum(raw);
      }
      continue;
    }
    // Detailed rate-period rows.
    let mm = label.match(RE_PERIOD);
    if(mm){
      const idx = parseInt(mm[1],10)-1;
      for(let j=0;j<nScen;j++){
        const obj = parsePeriodCell(valAt(j));
        if(!obj) continue;
        if(!Array.isArray(newScen[j].ratePeriods)) newScen[j].ratePeriods = [];
        newScen[j].ratePeriods[idx] = obj;
      }
      continue;
    }
    // Detailed cost rows.
    const costMatch = (re,listKey,kind)=>{
      const m = label.match(re); if(!m) return false;
      const idx = parseInt(m[1],10)-1;
      for(let j=0;j<nScen;j++){
        const obj = parseCostCell(valAt(j), kind);
        if(!obj) continue;
        if(!Array.isArray(newScen[j][listKey])) newScen[j][listKey] = [];
        newScen[j][listKey][idx] = obj;
      }
      return true;
    };
    if(costMatch(RE_SETUP,'ownSetupCosts','setup')) continue;
    if(costMatch(RE_OWN_ON,'ownOngoingCosts','ongoing')) continue;
    if(costMatch(RE_RENT_ON,'rentOngoingCosts','ongoing')) continue;
    // Unknown label → ignore (forward-compatible).
  }

  // Compact any sparse detailed lists (remove holes from skipped indices).
  newScen.forEach(sc=>{
    ['ratePeriods','ownSetupCosts','ownOngoingCosts','rentOngoingCosts'].forEach(k=>{
      if(Array.isArray(sc[k])){ sc[k] = sc[k].filter(Boolean); if(!sc[k].length) sc[k]=null; }
    });
  });
  return {scenarios:newScen, modes:newModes};
}

function applyUploadedCSV(text){
  let parsed;
  try{ parsed = buildScenariosFromCSV(text); }
  catch(err){ console.error(err); alert(T('csvParseError')); return; }
  if(!parsed || !parsed.scenarios || !parsed.scenarios.length){ alert(T('csvParseError')); return; }
  scenarios = parsed.scenarios;
  modes = parsed.modes;
  // Seed any detailed lists that the CSV implied but did not fully populate.
  if(modes.mortgageMode==='detailed')  seedDetailedLists('mortgageMode');
  if(modes.ownCostsMode==='detailed')  seedDetailedLists('ownCostsMode');
  if(modes.rentCostsMode==='detailed') seedDetailedLists('rentCostsMode');
  const maxH = Math.max(...scenarios.map(s=>s.horizon||1));
  const yi = document.getElementById('yearInput');
  if(yi) yi.max = maxH;
  rerender();
}

function handleCSVUpload(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => applyUploadedCSV(String(e.target.result || ''));
  reader.onerror = () => alert(T('csvParseError'));
  reader.readAsText(file);
}

/* ── PER-SCENARIO CASHFLOW CSV (shared with the main tool via RVOExport) ── */
function scenarioSlug(si){
  const s = String(scenarios[si].name || ('scenario_'+(si+1)))
    .replace(/[^a-z0-9]+/gi,'_').replace(/^_+|_+$/g,'').toLowerCase();
  return s || ('scenario_'+(si+1));
}
function downloadScenarioCashflow(si, which){
  const res = scenarioResults[si];
  if(!res || !res.rows || !res.rows.length || !global_RVOExport()) return;
  const slug = scenarioSlug(si);
  if(which==='own')  RVOExport.downloadCSV(`${slug}_own_cashflow.csv`,  RVOExport.ownCashflowCSV(res.rows));
  else               RVOExport.downloadCSV(`${slug}_rent_cashflow.csv`, RVOExport.rentCashflowCSV(res.rows));
}
function global_RVOExport(){ return typeof RVOExport !== 'undefined' && RVOExport; }

/* ── SCENARIO COMPARISON CHART POPUP ── */
let chartModal = { el:null, chart:null, si:0, met:'netEquity' };

function scenarioChartData(si, met){
  const res = scenarioResults[si];
  const rows = (res && res.rows) ? res.rows : [];
  const ownKey  = met==='netEquity' ? 'ownNetEquity'  : met==='cash' ? 'ownCash'  : 'ownAccumCost';
  const rentKey = met==='netEquity' ? 'rentNetEquity' : met==='cash' ? 'rentCash' : 'rentAccumCost';
  return {
    labels: rows.map(r=>r.year),
    series: [
      {label:T('seriesOwn'),  data:rows.map(r=>r[ownKey]||0),  color:cssVar('--line-a')},
      {label:T('seriesRent'), data:rows.map(r=>r[rentKey]||0), color:cssVar('--gold')},
    ],
  };
}
function chartModalTitle(){
  return `${scenarios[chartModal.si].name||T('scenPlaceholder')}: ${metricLabelOf(chartModal.met)}`;
}
function chartModalLegendItems(){
  // Built from the same series the chart is rendered from, so each entry
  // carries the line it stands for — solid, dashed, and in its own colour.
  return scenarioChartData(chartModal.si, chartModal.met).series.map(s=>({
    label: s.label,
    color: s.color,
    swatch: SharedLegend.spec({color:s.color, width:2.5, dash:s.dash}),
  }));
}
// A metric button's name, in full and in its phone-width form (see .lbl-short).
function metricBtnLabel(key){
  return `<span class="lbl-long">${escHtml(T(key))}</span><span class="lbl-short">${escHtml(T(key + 'Short'))}</span>`;
}
function buildChartModal(){
  if(chartModal.el) return chartModal.el;
  const overlay = document.createElement('div');
  overlay.className = 'chart-modal-overlay';
  overlay.innerHTML = `
    <div class="chart-modal card" role="dialog" aria-modal="true">
      <button class="chart-modal-close cm-close" data-act="close" title="${escAttr(T('closeTitle'))}" aria-label="${escAttr(T('closeTitle'))}">✕</button>
      <div class="chart-head">
        <h2 class="chart-modal-title"></h2>
        <div class="chart-controls">
          <button class="graph-btn cm-met" data-met="netEquity">${metricBtnLabel('metricNetEquity')}</button>
          <button class="graph-btn cm-met" data-met="cash">${metricBtnLabel('metricLiquidCash')}</button>
          <button class="graph-btn cm-met" data-met="cost">${metricBtnLabel('metricAccumCost')}</button>
        </div>
        <div class="btn-cluster">
          <button class="btn-secondary btn-sm" data-act="svg" title="${escAttr(T('btnSvgTitle'))}">⬇ SVG</button>
          <button class="btn-secondary btn-sm" data-act="png" title="${escAttr(T('btnPngTitle'))}">⬇ PNG</button>
          <button class="btn-secondary btn-sm btn-icon" data-act="copy" title="${escAttr(T('btnCopyTitle'))}">⧉</button>
          <button class="btn-secondary btn-sm btn-icon" data-act="reset" title="${escAttr(T('btnResetZoomTitle'))}">⟳</button>
        </div>
      </div>
      <div class="legend cm-legend"></div>
      <div class="canvas-wrap"><canvas class="cm-canvas"></canvas></div>
      <div class="hover-box">${escHtml(T('chartHoverHint'))}</div>
    </div>`;
  document.body.appendChild(overlay);
  chartModal.el = overlay;

  overlay.addEventListener('click', e=>{ if(e.target===overlay) closeChartModal(); });
  overlay.querySelectorAll('.cm-met').forEach(btn=>{
    btn.addEventListener('click', ()=>{ chartModal.met = btn.dataset.met; renderChartModal(); });
  });
  overlay.querySelectorAll('[data-act]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const act = btn.dataset.act;
      const canvas = overlay.querySelector('.cm-canvas');
      const meta = {title:chartModalTitle(), legendItems:chartModalLegendItems()};
      if(act==='close') closeChartModal();
      else if(act==='reset'){ if(chartModal.chart && chartModal.chart.resetZoom) chartModal.chart.resetZoom(); }
      else if(act==='png')  RVOExport.exportChartPNG(canvas, Object.assign({}, meta, {filename:`${scenarioSlug(chartModal.si)}_${chartModal.met}_chart.png`, download:true}));
      else if(act==='svg')  RVOExport.exportChartSVG(canvas, Object.assign({}, meta, {filename:`${scenarioSlug(chartModal.si)}_${chartModal.met}_chart.svg`}));
      else if(act==='copy') RVOExport.copyChartPNG(canvas, meta).then(()=>alert('PNG copied to clipboard.')).catch(err=>alert('PNG copy failed: '+err.message));
    });
  });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && chartModal.el && chartModal.el.classList.contains('open')) closeChartModal(); });
  return overlay;
}
function renderChartModal(){
  const overlay = chartModal.el;
  if(!overlay) return;
  overlay.querySelector('.chart-modal-title').textContent = chartModalTitle();
  overlay.querySelectorAll('.cm-met').forEach(b=>b.classList.toggle('active', b.dataset.met===chartModal.met));
  // Legend: one entry per series, drawn as the chart draws it
  const legendEl = overlay.querySelector('.cm-legend');
  legendEl.innerHTML = '';
  chartModalLegendItems().forEach(it=>{ legendEl.appendChild(SharedLegend.item(it.swatch, it.label)); });
  // (Re)build the chart
  const data = scenarioChartData(chartModal.si, chartModal.met);
  const sym = symOf(scenarios[chartModal.si]);
  const canvas = overlay.querySelector('.cm-canvas');
  if(chartModal.chart){ chartModal.chart.destroy(); chartModal.chart = null; }
  chartModal.chart = RVOExport.renderComparisonChart(canvas, {
    labels: data.labels, series: data.series, sym,
    yAxisTitle: `${metricLabelOf(chartModal.met)} (${sym})`,
  });
}
function openChartModal(si){
  if(!global_RVOExport() || !window.Chart){ return; }
  buildChartModal();
  chartModal.si = si;
  chartModal.met = metric; // open on the metric currently selected in the table
  chartModal.el.classList.add('open');
  document.body.style.overflow = 'hidden';
  renderChartModal();
}
function closeChartModal(){
  if(!chartModal.el) return;
  chartModal.el.classList.remove('open');
  document.body.style.overflow = '';
  if(chartModal.chart){ chartModal.chart.destroy(); chartModal.chart = null; }
}

/* ── GLOBAL MULTI-SCENARIO COMPARISON CHART ──
   One chart overlaying every (included) scenario: Own = solid, Rent = dotted,
   sharing the scenario's colour. Per-scenario include/colour pickers plus
   Own/Rent visibility toggles, all the standard graph exports (SVG/PNG/copy/
   reset) and metric switching. */
/* Scenario lines take the design system's neutral sequence (blue, gold,
   teal, rose, purple): a scenario is not good or bad, so none is red. */
function gcColour(i){ return SharedPalette.at(i); }
let globalChart = { el:null, chart:null, met:'netEquity', include:[], colors:[], showOwn:true, showRent:true };

function gcInitState(){
  globalChart.include = scenarios.map(()=>true);
  globalChart.colors  = scenarios.map((_,i)=> gcColour(i));
  globalChart.showOwn = true;
  globalChart.showRent = true;
  globalChart.met = metric;
}
function gcMetricKeys(met){
  return {
    own:  met==='netEquity' ? 'ownNetEquity'  : met==='cash' ? 'ownCash'  : 'ownAccumCost',
    rent: met==='netEquity' ? 'rentNetEquity' : met==='cash' ? 'rentCash' : 'rentAccumCost',
  };
}
function gcChartData(){
  const {own:ownKey, rent:rentKey} = gcMetricKeys(globalChart.met);
  let maxLen = 0;
  scenarios.forEach((sc,i)=>{
    if(!globalChart.include[i]) return;
    const res = scenarioResults[i];
    if(res && res.rows) maxLen = Math.max(maxLen, res.rows.length);
  });
  const labels = []; for(let y=0; y<maxLen; y++) labels.push(y);
  const series = [];
  scenarios.forEach((sc,i)=>{
    if(!globalChart.include[i]) return;
    const res = scenarioResults[i];
    const rows = (res && res.rows) ? res.rows : [];
    if(!rows.length) return;
    const color = globalChart.colors[i] || gcColour(i);
    if(globalChart.showOwn)
      series.push({label:`${sc.name||T('scenPlaceholder')}: ${T('seriesOwn')}`,  data:rows.map(r=>r[ownKey]||0),  color, dash:null});
    if(globalChart.showRent)
      series.push({label:`${sc.name||T('scenPlaceholder')}: ${T('seriesRent')}`, data:rows.map(r=>r[rentKey]||0), color, dash:[5,4]});
  });
  return {labels, series};
}
function gcTitle(){ return `${T('gcTitle')}: ${metricLabelOf(globalChart.met)}`; }
// <input type=color> takes only #rrggbb; tokens resolve to hex already, but
// keep the picker safe if one ever resolves to rgb().
function toHexColour(c){
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(String(c||''));
  if(!m) return String(c||'#5A91E8').slice(0,7);
  return '#'+[m[1],m[2],m[3]].map(n=>(+n).toString(16).padStart(2,'0')).join('');
}
function gcLegendItems(){
  // Own and rent share a scenario's colour and are told apart by the dash, so
  // the exported key has to carry the dash too.
  return gcChartData().series.map(s=>({
    label: s.label, color: s.color,
    swatch: SharedLegend.spec({color:s.color, width:2.5, dash:s.dash}),
  }));
}

function buildGlobalChartModal(){
  if(globalChart.el) return globalChart.el;
  const overlay = document.createElement('div');
  overlay.className = 'chart-modal-overlay gc-overlay';
  overlay.innerHTML = `
    <div class="chart-modal card" role="dialog" aria-modal="true">
      <button class="chart-modal-close gc-close" data-act="close" title="${escAttr(T('closeTitle'))}" aria-label="${escAttr(T('closeTitle'))}">✕</button>
      <div class="chart-head">
        <h2 class="chart-modal-title gc-title"></h2>
        <div class="chart-controls">
          <button class="graph-btn gc-met" data-met="netEquity">${metricBtnLabel('metricNetEquity')}</button>
          <button class="graph-btn gc-met" data-met="cash">${metricBtnLabel('metricLiquidCash')}</button>
          <button class="graph-btn gc-met" data-met="cost">${metricBtnLabel('metricAccumCost')}</button>
          <button class="graph-btn gc-toggle gc-own" data-series="own"><span class="ricon ricon-own" aria-hidden="true"></span>${T('gcShowOwn')}</button>
          <button class="graph-btn gc-toggle gc-rent" data-series="rent"><span class="ricon ricon-rent" aria-hidden="true"></span>${T('gcShowRent')}</button>
        </div>
        <div class="btn-cluster">
          <button class="btn-secondary btn-sm" data-act="svg" title="${escAttr(T('btnSvgTitle'))}">⬇ SVG</button>
          <button class="btn-secondary btn-sm" data-act="png" title="${escAttr(T('btnPngTitle'))}">⬇ PNG</button>
          <button class="btn-secondary btn-sm btn-icon" data-act="copy" title="${escAttr(T('btnCopyTitle'))}">⧉</button>
          <button class="btn-secondary btn-sm btn-icon" data-act="reset" title="${escAttr(T('btnResetZoomTitle'))}">⟳</button>
        </div>
      </div>
      <div class="gc-scenarios-wrap">
        <span class="gc-scenarios-label">${escHtml(T('gcScenariosLabel'))}</span>
        <div class="gc-scenarios"></div>
      </div>
      <div class="gc-line-hint"></div>
      <div class="canvas-wrap"><canvas class="gc-canvas"></canvas></div>
      <div class="hover-box">${escHtml(T('chartHoverHint'))}</div>
    </div>`;
  document.body.appendChild(overlay);
  globalChart.el = overlay;

  overlay.addEventListener('click', e=>{ if(e.target===overlay) closeGlobalChartModal(); });
  overlay.querySelectorAll('.gc-met').forEach(btn=>{
    btn.addEventListener('click', ()=>{ globalChart.met = btn.dataset.met; renderGlobalChartModal(); });
  });
  overlay.querySelectorAll('.gc-toggle').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if(btn.dataset.series==='own')  globalChart.showOwn  = !globalChart.showOwn;
      else                            globalChart.showRent = !globalChart.showRent;
      renderGlobalChartModal();
    });
  });
  overlay.querySelectorAll('[data-act]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const act = btn.dataset.act;
      const canvas = overlay.querySelector('.gc-canvas');
      const meta = {title:gcTitle(), legendItems:gcLegendItems()};
      if(act==='close') closeGlobalChartModal();
      else if(act==='reset'){ if(globalChart.chart && globalChart.chart.resetZoom) globalChart.chart.resetZoom(); }
      else if(act==='png')  RVOExport.exportChartPNG(canvas, Object.assign({}, meta, {filename:`all_scenarios_${globalChart.met}_chart.png`, download:true}));
      else if(act==='svg')  RVOExport.exportChartSVG(canvas, Object.assign({}, meta, {filename:`all_scenarios_${globalChart.met}_chart.svg`}));
      else if(act==='copy') RVOExport.copyChartPNG(canvas, meta).then(()=>alert('PNG copied to clipboard.')).catch(err=>alert('PNG copy failed: '+err.message));
    });
  });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && globalChart.el && globalChart.el.classList.contains('open')) closeGlobalChartModal(); });
  return overlay;
}
function gcRenderScenarioPickers(){
  const wrap = globalChart.el.querySelector('.gc-scenarios');
  wrap.innerHTML = scenarios.map((sc,i)=>`
    <label class="gc-scen-item">
      <input type="checkbox" class="gc-include" data-i="${i}"${globalChart.include[i]?' checked':''}/>
      <input type="color" class="gc-color" data-i="${i}" value="${escAttr(toHexColour(globalChart.colors[i]||gcColour(i)))}"/>
      <span class="gc-scen-name">${escHtml(sc.name||(T('scenPlaceholder')+' '+(i+1)))}</span>
    </label>`).join('');
  wrap.querySelectorAll('.gc-include').forEach(el=>{
    el.addEventListener('change', e=>{ globalChart.include[+e.target.dataset.i] = e.target.checked; renderGlobalChartModal(); });
  });
  wrap.querySelectorAll('.gc-color').forEach(el=>{
    el.addEventListener('input', e=>{ globalChart.colors[+e.target.dataset.i] = e.target.value; renderGlobalChartModal(); });
  });
}
function renderGlobalChartModal(){
  const overlay = globalChart.el;
  if(!overlay) return;
  overlay.querySelector('.gc-title').textContent = gcTitle();
  overlay.querySelectorAll('.gc-met').forEach(b=>b.classList.toggle('active', b.dataset.met===globalChart.met));
  overlay.querySelector('.gc-own').classList.toggle('active', globalChart.showOwn);
  overlay.querySelector('.gc-rent').classList.toggle('active', globalChart.showRent);
  // The hint said "dotted" while the chart drew a dash. It now draws the very
  // same marks, in the current theme's ink, and only for the lines on show.
  const hint = overlay.querySelector('.gc-line-hint');
  hint.innerHTML = '';
  const ink = cssVar('--text');
  if(globalChart.showOwn)  hint.appendChild(SharedLegend.item({color:ink, width:2.5}, T('seriesOwn'), 'legend-item gc-line-key'));
  if(globalChart.showRent) hint.appendChild(SharedLegend.item({color:ink, width:2.5, dash:[5,4]}, T('seriesRent'), 'legend-item gc-line-key'));
  const data = gcChartData();
  const sym = symOf(scenarios[0]);
  const canvas = overlay.querySelector('.gc-canvas');
  if(globalChart.chart){ globalChart.chart.destroy(); globalChart.chart = null; }
  globalChart.chart = RVOExport.renderComparisonChart(canvas, {
    labels: data.labels, series: data.series, sym,
    yAxisTitle: `${metricLabelOf(globalChart.met)} (${sym})`,
  });
}
function openGlobalChartModal(){
  if(!global_RVOExport() || !window.Chart){ return; }
  buildGlobalChartModal();
  gcInitState();
  gcRenderScenarioPickers();
  globalChart.el.classList.add('open');
  document.body.style.overflow = 'hidden';
  renderGlobalChartModal();
}
function closeGlobalChartModal(){
  if(!globalChart.el) return;
  globalChart.el.classList.remove('open');
  document.body.style.overflow = '';
  if(globalChart.chart){ globalChart.chart.destroy(); globalChart.chart = null; }
}

/* ── WIRE EVENTS ── */
function wireEvents(){
  document.querySelectorAll('.scen-name-input').forEach(el=>{
    el.addEventListener('input', e=>{ scenarios[+e.target.dataset.si].name = e.target.value; });
  });

  document.querySelectorAll('.param-input').forEach(el=>{
    el.addEventListener('focus', e=>{
      const p = PARAM_MAP[e.target.dataset.key];
      const val = scenarios[+e.target.dataset.si][e.target.dataset.key];
      e.target.value = p && isAutoZero(p, val) ? '' : String(val ?? '').replace(/,/g,'');
    });
    el.addEventListener('input', e=>{
      // maxDecimals:2 matches the main tool's money inputs — a currency row can
      // also hold a percentage (e.g. ongoing cost as "% of property value"),
      // and 0 decimals would turn a typed 1.5 into 15.
      if(e.target.dataset.ptype==='currency') SharedFmt.liveFormat(e.target,{maxDecimals:2});
    });
    el.addEventListener('blur', e=>{
      const si = +e.target.dataset.si, key = e.target.dataset.key, ptype = e.target.dataset.ptype;
      const p = PARAM_MAP[key];
      if(!p) return;
      const sc = scenarios[si];
      const before = activeSignature(sc);
      const raw = String(e.target.value).trim();
      // A cleared automatic field goes back to automatic; any other cleared
      // field keeps what it held.
      let val = (p.auto && raw==='') ? 0
        : ptype==='integer' ? parseIntSafe(raw, sc[key]) : parseFloatSafe(raw, sc[key]);
      const typed = val;
      if(p.min!=null) val = Math.max(p.min, val);
      if(p.max!=null) val = Math.min(p.max, val);
      // A value past either end is pulled back to it, and says so (SharedBounds' note)
      if(val !== typed && window.SharedBounds){
        const {pre, suf} = paramAffix(p, sc);
        SharedBounds.hint(e.target, T(typed > val ? 'hintMax' : 'hintMin')+' '
          + (pre ? pre+(pre.length>1?' ':'') : '') + fmtInputVal(val, ptype) + (suf ? ' '+suf : ''));
      }
      // Percentages hold two decimals, as the main page's sliders do, so any
      // scenario typed here can be set there exactly
      if(ptype==='percent') val = Math.round(val*100)/100;
      sc[key] = val;
      e.target.value = inputText(p, val);
      if(key==='horizon'){
        const maxH = Math.max(...scenarios.map(s=>s.horizon||1));
        document.getElementById('yearInput').max = maxH;
      }
      recomputeScenario(si);
      // Rebuild when the rate periods' year ranges follow the term, or when
      // this field switches another one on or off (a budget set or cleared
      // brings its annual increase into use or out of it).
      if((key==='mortgageTerm' && modes.mortgageMode==='detailed') || activeSignature(sc)!==before){
        rerender();
        refocus(e.relatedTarget);
        return;
      }
      rerenderOutputOnly();
      updateClampNote(si);
    });
    el.addEventListener('keydown', e=>{ if(e.key==='Enter') e.target.blur(); });
  });

  /* A frequency carries the money amount in the row under it, so moving one
     rescales the other: a scenario that read 2,800 a month reads 646.15 a week,
     and stays the same scenario. The old period is still in the scenario when
     the handler runs, which is what the conversion measures from. A cost on a
     "% of value" basis is a percentage rather than money per period, so it is
     left as typed.
     A cost type does the same between money and "%" (see convertCostBasis):
     $32,000 of setup on an $800,000 home becomes 4% of the price. */
  const FREQ_AMOUNT = {
    rentFreq:            {amount: 'rentAmount'},
    ownOngoingCostFreq:  {amount: 'ownOngoingCost',  type: 'ownOngoingCostType'},
    rentOngoingCostFreq: {amount: 'rentOngoingCost', type: 'rentOngoingCostType'}
  };
  document.querySelectorAll('.param-select').forEach(el=>{
    el.addEventListener('change', e=>{
      const si = +e.target.dataset.si, key = e.target.dataset.key, to = e.target.value;
      const sc = scenarios[si];
      const pair = FREQ_AMOUNT[key], cost = BASIS_BY_TYPE[key];
      if(pair && !(pair.type && sc[pair.type] === 'pct')){
        const conv = SharedFreq.convert(sc[pair.amount], sc[key], to, 2);
        if(conv !== null) sc[pair.amount] = conv;
      }
      if(cost){
        const asBasis = t => t==='pct' ? 'pct' : (cost.freq ? (sc[cost.freq] || 'yearly') : 'fixed');
        const conv = convertCostBasis(sc[cost.amount], asBasis(sc[key]), asBasis(to), pctBase(sc, cost.of));
        if(conv !== null) sc[cost.amount] = conv;
      }
      sc[key] = to;
      recomputeScenario(si);
      // A select here moves another cell (the amount, its unit, or which
      // fields are in use), so the table is rebuilt.
      rerender();
      refocus(e.target);
    });
  });

  document.querySelectorAll('.param-bool').forEach(el=>{
    el.addEventListener('change', e=>{
      const si = +e.target.dataset.si;
      scenarios[si][e.target.dataset.key] = e.target.checked;
      recomputeScenario(si);
      rerenderOutputOnly();
    });
  });

  // Section mode toggles (apply to all scenarios)
  document.querySelectorAll('.mode-seg .seg-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const modeKey = btn.closest('.mode-seg').dataset.modeKey;
      const val = btn.dataset.val;
      if(modes[modeKey] === val) return;
      modes[modeKey] = val;
      if(val === 'detailed') seedDetailedLists(modeKey);
      rerender();
    });
  });

  // Detailed mortgage: rate period controls
  const periodOf = el => scenarios[+el.dataset.si].ratePeriods[+el.dataset.idx];
  document.querySelectorAll('.rp-type').forEach(el=>{
    el.addEventListener('change', e=>{
      const p = periodOf(e.target);
      p.type = e.target.value;
      if(p.type==='floating' && (Number(p.rateMax)||0) <= (Number(p.rateMin)||0)){
        p.rateMin = Number(p.rate)||0; p.rateMax = (Number(p.rate)||0)+2;
      }
      recomputeScenario(+e.target.dataset.si);
      rerender();
    });
  });
  document.querySelectorAll('.rp-to').forEach(el=>{
    const commit = e=>{
      const si = +e.target.dataset.si;
      const p = periodOf(e.target);
      p.toYear = Math.max(1, parseIntSafe(e.target.value, p.toYear));
      recomputeScenario(si);
      rerender();
    };
    el.addEventListener('blur', commit);
    el.addEventListener('keydown', e=>{ if(e.key==='Enter') e.target.blur(); });
  });
  [['rp-rate','rate'],['rp-min','rateMin'],['rp-max','rateMax']].forEach(([cls,field])=>{
    document.querySelectorAll('.'+cls).forEach(el=>{
      el.addEventListener('blur', e=>{
        const si = +e.target.dataset.si;
        const p = periodOf(e.target);
        p[field] = Math.max(0, parseFloatSafe(e.target.value, p[field]||0));
        e.target.value = p[field];
        recomputeScenario(si);
        rerenderOutputOnly();
      });
      el.addEventListener('keydown', e=>{ if(e.key==='Enter') e.target.blur(); });
    });
  });
  document.querySelectorAll('.rp-del').forEach(el=>{
    el.addEventListener('click', ()=>{
      const si = +el.dataset.si, idx = +el.dataset.idx;
      const list = scenarios[si].ratePeriods;
      if(!list || list.length<=1) return;
      list.splice(idx,1);
      recomputeScenario(si);
      rerender();
    });
  });
  document.querySelectorAll('.add-period-btn').forEach(el=>{
    el.addEventListener('click', ()=>{
      const si = +el.dataset.si;
      addRatePeriodTo(scenarios[si]);
      recomputeScenario(si);
      rerender();
    });
  });

  // Detailed costs: per-item controls
  const costItemOf = el => scenarios[+el.dataset.si][el.dataset.list][+el.dataset.idx];
  document.querySelectorAll('.ci-amt').forEach(el=>{
    el.addEventListener('focus', e=>{ e.target.value = String(e.target.value).replace(/,/g,''); });
    el.addEventListener('input', e=>{
      SharedFmt.liveFormat(e.target,{maxDecimals:2});
    });
    el.addEventListener('blur', e=>{
      const si = +e.target.dataset.si;
      const it = costItemOf(e.target);
      it.amount = Math.max(0, parseNum(e.target.value));
      e.target.value = it.basis==='pct' ? String(it.amount) : addCommas(it.amount);
      recomputeScenario(si);
      rerenderOutputOnly();
    });
    el.addEventListener('keydown', e=>{ if(e.key==='Enter') e.target.blur(); });
  });
  document.querySelectorAll('.ci-basis').forEach(el=>{
    el.addEventListener('change', e=>{
      const si = +e.target.dataset.si;
      const it = costItemOf(e.target);
      // Same rescaling, one cost row at a time: between periods, and between
      // money and "%" of what that list's "%" is a share of.
      const conv = convertCostBasis(it.amount, it.basis, e.target.value,
        pctBase(scenarios[si], e.target.dataset.list==='rentOngoingCosts' ? 'rent' : 'price'));
      if(conv !== null) it.amount = conv;
      it.basis = e.target.value;
      recomputeScenario(si);
      rerender(); // inflation input visibility depends on basis
    });
  });
  document.querySelectorAll('.ci-infl').forEach(el=>{
    el.addEventListener('blur', e=>{
      const si = +e.target.dataset.si;
      const it = costItemOf(e.target);
      it.inflation = Math.max(0, parseFloatSafe(e.target.value, it.inflation||0));
      e.target.value = it.inflation;
      recomputeScenario(si);
      rerenderOutputOnly();
    });
    el.addEventListener('keydown', e=>{ if(e.key==='Enter') e.target.blur(); });
  });
  document.querySelectorAll('.ci-del').forEach(el=>{
    el.addEventListener('click', ()=>{
      const si = +el.dataset.si, idx = +el.dataset.idx;
      const list = scenarios[si][el.dataset.list];
      if(!list || list.length<=1) return;
      list.splice(idx,1);
      recomputeScenario(si);
      rerender();
    });
  });
  document.querySelectorAll('.add-cost-btn').forEach(el=>{
    el.addEventListener('click', ()=>{
      const si = +el.dataset.si, listKey = el.dataset.list;
      const sc = scenarios[si];
      if(listKey==='ownSetupCosts'){ seedOwnCostItems(sc); sc.ownSetupCosts.push({amount:0, basis:'fixed'}); }
      else if(listKey==='ownOngoingCosts'){ seedOwnCostItems(sc); sc.ownOngoingCosts.push({amount:0, basis:'yearly', inflation:0}); }
      else { seedRentCostItems(sc); sc.rentOngoingCosts.push({amount:0, basis:'yearly', inflation:0}); }
      recomputeScenario(si);
      rerender();
    });
  });

  const addBtn = document.getElementById('addScenBtn');
  if(addBtn) addBtn.addEventListener('click', addScenario);

  // Column drag: reorders the scenarios. Each one carries all its own inputs
  // and results, so a move is visual only and changes no figure.
  SharedColDrag.attach(document.querySelector('#tableWrap table.dt'), {
    scope: document.getElementById('tableWrap'),
    onMove: (from, to)=>{ moveScenario(from, to); rerender(); }
  });

  document.querySelectorAll('.rmv-scen').forEach(btn=>{
    btn.addEventListener('click', ()=> removeScenario(+btn.dataset.si));
  });

  document.querySelectorAll('.btn-dupe').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const si = +btn.dataset.si;
      const clone = cloneScenario(scenarios[si]);
      clone.name = scenarios[si].name+' (copy)';
      scenarios.splice(si+1, 0, clone);
      rerender();
    });
  });

  // Per-scenario actions: download Own/Rent cashflow + show comparison chart
  document.querySelectorAll('.btn-scen-action.dl-own').forEach(btn=>{
    btn.addEventListener('click', ()=> downloadScenarioCashflow(+btn.dataset.si, 'own'));
  });
  document.querySelectorAll('.btn-scen-action.dl-rent').forEach(btn=>{
    btn.addEventListener('click', ()=> downloadScenarioCashflow(+btn.dataset.si, 'rent'));
  });
  document.querySelectorAll('.btn-scen-action.show-chart').forEach(btn=>{
    btn.addEventListener('click', ()=> openChartModal(+btn.dataset.si));
  });
}

// Which fields a scenario uses, as a string, to tell when an edit changed it.
const activeSignature = sc => PARAMS.map(p => paramActive(p, sc) ? 1 : 0).join('');

/* A rebuild replaces every cell, so the control a reader was on, or moving
   to with Tab, is found again by what it edits and given the focus back. */
function refocus(el){
  if(!el || !el.dataset || el.dataset.si===undefined || !el.classList.length) return;
  const attrs = ['si','key','list','idx'].filter(k=>el.dataset[k]!==undefined).map(k=>`[data-${k}="${el.dataset[k]}"]`).join('');
  const twin = document.querySelector('#tableWrap .'+[...el.classList].join('.')+attrs);
  if(twin && twin!==document.activeElement) twin.focus();
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

  const uploadBtn = document.getElementById('uploadCSVBtn');
  const fileInput = document.getElementById('csvFileInput');
  if(uploadBtn && fileInput){
    uploadBtn.addEventListener('click', ()=> fileInput.click());
    fileInput.addEventListener('change', e=>{
      const f = e.target.files && e.target.files[0];
      handleCSVUpload(f);
      e.target.value = ''; // allow re-uploading the same file
    });
  }

  const compareBtn = document.getElementById('compareAllBtn');
  if(compareBtn) compareBtn.addEventListener('click', openGlobalChartModal);

  /* ── Mini cache ──────────────────────────────────────────────────────────
     The whole comparison is the scenarios array, so persist it and rebuild the
     table on revisit — a returning user keeps every scenario they configured. */
  if(window.Persist){
    persist = Persist.init('rentvsownhouse-sensitivity', {
      onRestore: function(){ rerender(); },
      extra: {
        save: function(){ return { scenarios: scenarios }; },
        restore: function(e){ if(e && Array.isArray(e.scenarios) && e.scenarios.length) scenarios = e.scenarios; }
      }
    });
    // No Quick Start row on this page, so save/open sit in the header.
    SharedScenario.mount('.header-right', { tool: 'rentvsownhouse-sensitivity', persist: persist });
  }
});

})();
