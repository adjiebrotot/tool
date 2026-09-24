(function(){
"use strict";

/* ── i18n ── */
let lang = (window.DEFAULT_LANG === 'id') ? 'id' : 'en';
const LANG = {
  en: {
    /* header */
    subtitle: 'Model the long-term financial outcome of renting vs buying property — comparing cash, equity, and net wealth over time.',
    btnBack: '← Other Tools',
    sensitivityHtml: 'Power user? Compare multiple scenarios side-by-side with our <a href="/rentvsownhouse/sensitivity/" style="color:var(--accent);font-weight:700;text-decoration:none;">Sensitivity Analysis Tool</a>.',
    /* sidebar */
    quickStartLabel: 'Quick Start',
    quickStartTip: 'Prefills with a median two-bedroom apartment in the city centre or inner suburbs.',
    tabGeneral: 'General',
    tabOwn: 'Own',
    tabRent: 'Rent',
    sectionCash: 'Cash',
    labelRiskFreeRate: 'Risk-Free Rate',
    unitPctPa: '% p.a.',
    labelInitialCash: 'Initial Cash',
    labelOptional: '(optional)',
    subInitialCashDefault: 'Defaults to down payment + setup cost. Any excess is invested at the risk-free rate.',
    labelMonthlyBudget: 'Monthly Housing Budget',
    labelBudgetIncrease: 'Budget Annual Increase',
    helpBudgetGrowsPrefix: 'Budget grows from',
    helpBudgetGrowsSuffix: 'at this rate each year.',
    labelTimeHorizon: 'Time Horizon',
    labelYears: 'years',
    yrsSuffix: ' yrs',
    sectionRTB: 'Rent-Then-Buy Scenario',
    labelEnableRTB: 'Enable Rent-Then-Buy',
    labelBuyAtYear: 'Buy at Year',
    unitYearsRentingFirst: 'years of renting first',
    sectionProperty: 'Property',
    labelPropertyPrice: 'Property Price',
    labelDownPayment: 'Down Payment',
    helpDownPaymentPrefix: 'Down payment = ',
    unitPctOfPrice: '% of property price',
    sectionMortgage: 'Mortgage',
    labelMortgageType: 'Mortgage Type',
    labelPI: 'Principal & Interest',
    helpPI: 'Pay down loan each period; builds equity faster.',
    labelIO: 'Interest Only',
    helpIO: 'Pay only interest; the full principal is repaid from cash at the end of the term.',
    labelCostInterestOnly: 'Cost = Interest Only',
    labelMortgageRate: 'Mortgage Rate',
    labelMortgageTerm: 'Mortgage Term',
    labelMortgageMode: 'Mortgage Mode',
    segSimple: 'Simple',
    segDetailed: 'Detailed',
    labelRateSchedule: 'Mortgage Rate Schedule',
    btnAddPeriod: '+ Add Period',
    optFixed: 'Fixed',
    optFloating: 'Floating',
    labelYear: 'Year',
    labelPeriodEnd: 'Last year of this period',
    sectionPropertyGrowth: 'Property Growth',
    labelHouseGrowth: 'House Price Growth (RPPI)',
    labelSellingCost: 'Selling Cost',
    unitPctOfValue: '% of sale price',
    labelCalcCAGR: 'Calculate CAGR from Historical Prices',
    btnShowTool: 'Show Tool',
    btnHideTool: 'Hide Tool',
    btnDelete: 'Delete',
    btnAddRow: '+ Row',
    btnCalcCAGR: 'Calc CAGR →',
    sectionCostsOwning: 'Costs of Owning',
    labelCostsMode: 'Costs Mode',
    labelSetupCosts: 'Setup Costs',
    labelOngoingCostsList: 'Ongoing Costs',
    btnAddSetupCost: '+ Add Setup Cost',
    btnAddOngoingCost: '+ Add Ongoing Cost',
    phCostName: 'Name (optional)',
    optPerYear: 'per year',
    optPerMonth: 'per month',
    optPerWeek: 'per week',
    optPctBuyPrice: '% of buy price',
    labelInflation: 'Inflation',
    labelSetupCost: 'Setup Cost (Stamp Duty, Legal, etc.)',
    optDollar: '$',
    labelOwnOngoing: 'Ongoing Costs of Owning',
    optYearly: 'Yearly',
    optMonthly: 'Monthly',
    optWeekly: 'Weekly',
    optFixedAmount: 'Fixed $ amount',
    optPctPropertyValue: '% of property value',
    labelOwnInflation: 'Own Ongoing Cost Inflation',
    sectionRentalPayments: 'Rental Payments',
    labelRentAmount: 'Rent Amount',
    rentPrefix: 'Rent = ',
    perMo: '/mo',
    labelRentInflation: 'Rent Inflation',
    sectionCostsRenting: 'Costs of Renting',
    labelRentOngoing: 'Ongoing Costs of Renting',
    optPctAnnualRent: '% of annual rent',
    labelRentOngoingInflation: 'Rent Ongoing Cost Inflation',
    labelCurrencySymbol: 'Currency Symbol',
    /* KPI */
    kpiInitialCashLabel: 'Initial Cash',
    kpiInitialCashTip: 'Starting cash in every scenario. Left blank, it is the most any scenario needs up front: deposit plus setup, a year of rent, or what Rent-Then-Buy needs today to fund its later deposit.',
    kpiInitialCashSub: 'Starting capital at Year 0',
    kpiBudgetLabel: 'Monthly Housing Budget',
    kpiBudgetSub: 'Min–max monthly budget over horizon',
    kpiBreakevenLabel: 'Breakeven Year',
    kpiBreakevenTip: 'The year Buy net equity (house plus cash) passes Rent for good: from then to the horizon, owning stays ahead.',
    kpiBreakevenSub: 'When owning net equity overtakes renting for good',
    kpiDiffLabel: 'Equity Difference',
    kpiDiffTip: 'Own net equity minus Rent net equity at the final year. Green means buying wins, red means renting and investing wins.',
    kpiDiffSub: 'Own minus Rent at final year',
    /* chart */
    chartTitle: 'Comparison',
    btnNetEquity: 'Net Equity',
    btnLiquidCash: 'Liquid Cash',
    btnAccumCost: 'Accum. Cost',
    btnZoom: '⟳',
    /* Buttons in the export cluster are glyphs or two-word labels, so the
       title attribute is what says what each one does, in the wording every
       tool on the site uses. */
    btnSvgTitle: 'Download this chart as SVG',
    btnPngTitle: 'Download this chart as PNG',
    btnCopyTitle: 'Copy PNG to clipboard',
    btnResetZoomTitle: 'Reset zoom',
    btnCsvTitle: 'Download this table as CSV',
    chartHoverHint: 'Hover over the chart to inspect a year.',
    /* summary */
    ownSnapshotTitle: 'Own — Snapshot',
    rentSnapshotTitle: 'Rent — Snapshot',
    rtbSnapshotTitle: '🔄 Rent-Then-Buy — Snapshot',
    rtbSnapshotTip: 'The Rent-Then-Buy scenario at the final year. Savings fund the deposit at the buy year, on the price by then, and a new mortgage starts.',
    /* detail tabs */
    tabOwnCashflow: 'Own Cashflow',
    tabRentCashflow: 'Rent Cashflow',
    tabRTBCashflow: 'Rent-Then-Buy Cashflow',
    btnCSV: '⬇ CSV',
    /* chart series */
    seriesOwnNetEquity: 'Own — Net Equity',
    seriesRentNetEquity: 'Rent — Net Equity',
    seriesRTBNetEquity: 'Rent-Then-Buy — Net Equity',
    seriesOwnCash: 'Own — Liquid Cash',
    seriesRentCash: 'Rent — Liquid Cash',
    seriesRTBCash: 'Rent-Then-Buy — Liquid Cash',
    seriesOwnCost: 'Own — Accum. Cost (Mortgage+Ongoing)',
    seriesRentCost: 'Rent — Accum. Cost (Rent+Ongoing)',
    seriesRTBCost: 'Rent-Then-Buy — Accum. Cost',
    seriesRateBand: 'Floating-rate range (min–max)',
    /* dynamic messages */
    kpiBreakevenYear: 'Year ',
    subInitialCashLeftover: (x) => `Leftover ${x} invested at risk-free rate from day one.`,
    subInitialCashExact: 'Exactly covers down payment + setup cost — no surplus.',
    subInitialCashAuto: (x) => `Auto: ${x} (down payment + setup cost). Any excess is invested at the risk-free rate.`,
    subInitialCashRTB: (x,y,z,n) => `Auto: ${x}. Enough, with what it saves by then, for Rent-Then-Buy's ${z} deposit and setup at Yr ${n}.`,
    warnInitialCashRTB: (x,y,z,n) => `⚠️ Initial cash ${x} is ${y} short of what Rent-Then-Buy needs today (${z}) to fund its purchase at Yr ${n}.`,
    warnShortfall: (list) => `⚠️ Cash runs below zero in ${list}. The mortgage is the only borrowing in this model, so raise the budget or initial cash, or clear them for the automatic figures.`,
    warnShortfallIO: (list) => `⚠️ Cash runs below zero in ${list}, when the interest-only balance falls due. Set a higher budget or initial cash to save for it.`,
    shortfallItem: (name, yr, amt) => `${name} from Yr ${yr} (down to ${amt})`,
    nameOwn: 'Own', nameRent: 'Rent', nameRTB: 'Rent-Then-Buy',
    warnInitialCashShort: (x,y,z) => `⚠️ Initial cash ${x} is ${y} short of down payment + setup cost (${z}). The shortfall reduces the loan equity at start.`,
    subRequiredCash: (x) => `Required: ${x} (down payment + setup cost).`,
    warnBudgetLow: (x,y,z) => `⚠️ Budget (${x}/mo) is below both total own cost (${y}/mo incl. ongoing) and rent cost (${z}/mo incl. ongoing). Surplus will be negative and cash may decline below zero.`,
    cagrResult: (x) => `CAGR: ${x}% p.a. — applied ✓`,
    cagrNeedPoints: 'Need at least 2 valid year and price points.',
    cagrEndYearError: 'End year must be after start year.',
    /* table headers */
    thYear: 'Year',
    thRate: 'Rate',
    thCashPosition: 'Cash Position',
    thMortgagePosition: 'Mortgage Position',
    thFinancialPosition: 'Financial Position',
    thBegCash: 'Beg. Cash',
    thAnnBudget: 'Ann. Budget',
    thPrincipalExp: 'Principal Exp.',
    thInterestExp: 'Interest Exp.',
    thOngoingExp: 'Ongoing Exp.',
    thInterestInc: 'Cash Interest',
    thSurplus: 'Surplus',
    thEndCash: 'End Cash',
    thPropValue: 'Prop. Value',
    thPrincipalLeft: 'Principal Left',
    thHouseEquity: 'House Equity',
    thNetEquity: 'Net Equity',
    thAccumCost: 'Accum. Cost',
    thPhase: 'Phase',
    thTotalExp: 'Total Exp.',
    thRentExp: 'Rent Exp.',
    thPurchaseOutlay: 'Purchase Outlay',
    /* summary tile labels */
    tileNetEquity: 'Net Equity',
    tileAccumCost: 'Accumulated Cost',
    tileHouseEquity: 'House Equity',
    tileLiquidCash: 'Liquid Cash',
    tileMonthlyMortgage: 'Monthly Mortgage',
    tilePrincipalRemaining: 'Principal Remaining',
    tileYearlyRent: 'Yearly Rent',
    tilePropPriceAtBuy: 'Property Price at Buy',
    /* phase labels */
    phaseRenting: 'Renting',
    phaseBought: '🔄 Bought',
    phaseOwning: 'Owning',
    /* chart tooltip */
    chartTooltipYear: 'Year ',
  },
  id: {
    /* header */
    subtitle: 'Modelkan hasil keuangan jangka panjang dari menyewa vs membeli properti — membandingkan kas, ekuitas, dan kekayaan bersih dari waktu ke waktu.',
    btnBack: '← Other Tools',
    sensitivityHtml: 'Power user? Bandingkan beberapa skenario secara berdampingan dengan <a href="/rentvsownhouse/sensitivity/id/" style="color:var(--accent);font-weight:700;text-decoration:none;">Alat Analisis Sensitivitas</a> kami.',
    /* sidebar */
    quickStartLabel: 'Mulai Cepat',
    quickStartTip: 'Isi otomatis dengan harga median apartemen 2 kamar di pusat kota atau pinggiran kota.',
    tabGeneral: 'Umum',
    tabOwn: 'Beli',
    tabRent: 'Sewa',
    sectionCash: 'Kas',
    labelRiskFreeRate: 'Suku Bunga Bebas Risiko',
    unitPctPa: '%/tahun',
    labelInitialCash: 'Modal Awal',
    labelOptional: '(opsional)',
    subInitialCashDefault: 'Default ke Uang Muka (DP) + biaya awal pembelian. Kelebihan diinvestasikan pada suku bunga bebas risiko.',
    labelMonthlyBudget: 'Anggaran Rumah Bulanan',
    labelBudgetIncrease: 'Kenaikan Anggaran Tahunan',
    helpBudgetGrowsPrefix: 'Anggaran tumbuh dari',
    helpBudgetGrowsSuffix: 'per tahun.',
    labelTimeHorizon: 'Jangka Waktu',
    labelYears: 'tahun',
    yrsSuffix: ' thn',
    sectionRTB: 'Skenario Sewa Dulu, Beli Kemudian',
    labelEnableRTB: 'Aktifkan Sewa Dulu, Beli Kemudian',
    labelBuyAtYear: 'Beli di Tahun',
    unitYearsRentingFirst: 'tahun menyewa lebih dahulu',
    sectionProperty: 'Properti',
    labelPropertyPrice: 'Harga Properti',
    labelDownPayment: 'Uang Muka (DP)',
    helpDownPaymentPrefix: 'Uang Muka (DP) = ',
    unitPctOfPrice: '% dari harga properti',
    sectionMortgage: 'KPR',
    labelMortgageType: 'Jenis KPR',
    labelPI: 'Pokok & Bunga',
    helpPI: 'Cicilan mengurangi bunga dan saldo pinjaman setiap periode; ekuitas bertambah lebih cepat.',
    labelIO: 'Bunga Saja',
    helpIO: 'Hanya membayar bunga; seluruh pokok dilunasi dari kas di akhir jangka waktu.',
    labelCostInterestOnly: 'Biaya = Bunga Saja',
    labelMortgageRate: 'Bunga KPR',
    labelMortgageTerm: 'Jangka Waktu KPR',
    labelMortgageMode: 'Mode KPR',
    segSimple: 'Sederhana',
    segDetailed: 'Rinci',
    labelRateSchedule: 'Jadwal Bunga KPR',
    btnAddPeriod: '+ Tambah Periode',
    optFixed: 'Tetap (Fixed)',
    optFloating: 'Mengambang (Floating)',
    labelYear: 'Tahun',
    labelPeriodEnd: 'Tahun terakhir periode ini',
    sectionPropertyGrowth: 'Pertumbuhan Properti',
    labelHouseGrowth: 'Kenaikan Harga Properti (RPPI)',
    labelSellingCost: 'Biaya Penjualan',
    unitPctOfValue: '% dari harga jual',
    labelCalcCAGR: 'Hitung CAGR dari Harga Historis',
    btnShowTool: 'Tampilkan Alat',
    btnHideTool: 'Sembunyikan Alat',
    btnDelete: 'Hapus',
    btnAddRow: '+ Baris',
    btnCalcCAGR: 'Hitung CAGR →',
    sectionCostsOwning: 'Biaya Kepemilikan',
    labelCostsMode: 'Mode Biaya',
    labelSetupCosts: 'Biaya Awal Pembelian',
    labelOngoingCostsList: 'Biaya Rutin',
    btnAddSetupCost: '+ Tambah Biaya Awal',
    btnAddOngoingCost: '+ Tambah Biaya Rutin',
    phCostName: 'Nama (opsional)',
    optPerYear: 'per tahun',
    optPerMonth: 'per bulan',
    optPerWeek: 'per minggu',
    optPctBuyPrice: '% dari harga beli',
    labelInflation: 'Inflasi',
    labelSetupCost: 'Biaya Awal Pembelian (BPHTB, Notaris, dll.)',
    optDollar: '$',
    labelOwnOngoing: 'Biaya Rutin Kepemilikan',
    optYearly: 'Tahunan',
    optMonthly: 'Bulanan',
    optWeekly: 'Mingguan',
    optFixedAmount: 'Jumlah Tetap',
    optPctPropertyValue: '% dari Nilai Properti',
    labelOwnInflation: 'Inflasi Biaya Rutin Kepemilikan',
    sectionRentalPayments: 'Pembayaran Sewa',
    labelRentAmount: 'Biaya Sewa',
    rentPrefix: 'Sewa = ',
    perMo: '/bln',
    labelRentInflation: 'Kenaikan Sewa Tahunan',
    sectionCostsRenting: 'Biaya Menyewa',
    labelRentOngoing: 'Biaya Rutin Menyewa',
    optPctAnnualRent: '% dari Sewa Tahunan',
    labelRentOngoingInflation: 'Inflasi Biaya Rutin Menyewa',
    labelCurrencySymbol: 'Simbol Mata Uang',
    /* KPI */
    kpiInitialCashLabel: 'Modal Awal',
    kpiInitialCashTip: 'Kas awal di semua skenario. Jika dikosongkan, dipakai kebutuhan awal terbesar: Uang Muka (DP) + biaya awal, sewa setahun, atau kas yang dibutuhkan Sewa Dulu sekarang untuk DP-nya nanti.',
    kpiInitialCashSub: 'Modal awal di Tahun 0',
    kpiBudgetLabel: 'Anggaran Perumahan Bulanan',
    kpiBudgetSub: 'Anggaran bulanan min–maks selama jangka waktu',
    kpiBreakevenLabel: 'Tahun Breakeven',
    kpiBreakevenTip: 'Tahun kekayaan bersih Beli (properti + kas) melampaui Sewa seterusnya: sejak itu hingga akhir proyeksi, membeli tetap unggul.',
    kpiBreakevenSub: 'Saat kekayaan bersih Beli melampaui Sewa seterusnya',
    kpiDiffLabel: 'Perbedaan Kekayaan Bersih',
    kpiDiffTip: 'Kekayaan Bersih Beli dikurangi Kekayaan Bersih Sewa di tahun terakhir. Hijau berarti beli menang, merah berarti sewa dan investasi menang.',
    kpiDiffSub: 'Beli dikurangi Sewa di tahun terakhir',
    /* chart */
    chartTitle: 'Perbandingan',
    btnNetEquity: 'Kekayaan Bersih',
    btnLiquidCash: 'Uang Tunai',
    btnAccumCost: 'Biaya Kumulatif',
    btnZoom: '⟳',
    btnSvgTitle: 'Unduh grafik ini sebagai SVG',
    btnPngTitle: 'Unduh grafik ini sebagai PNG',
    btnCopyTitle: 'Salin PNG ke papan klip',
    btnResetZoomTitle: 'Atur ulang zoom',
    btnCsvTitle: 'Unduh tabel ini sebagai CSV',
    chartHoverHint: 'Arahkan kursor ke grafik untuk melihat detail per tahun.',
    /* summary */
    ownSnapshotTitle: 'Beli — Ringkasan',
    rentSnapshotTitle: 'Sewa — Ringkasan',
    rtbSnapshotTitle: '🔄 Sewa Dulu, Beli Kemudian — Ringkasan',
    rtbSnapshotTip: 'Skenario Sewa Dulu, Beli Kemudian pada tahun terakhir. Tabungan menjadi Uang Muka (DP) pada harga saat itu, lalu KPR baru dimulai.',
    /* detail tabs */
    tabOwnCashflow: 'Arus Kas Beli',
    tabRentCashflow: 'Arus Kas Sewa',
    tabRTBCashflow: 'Arus Kas Sewa Dulu, Beli Kemudian',
    btnCSV: '⬇ CSV',
    /* chart series */
    seriesOwnNetEquity: 'Beli — Kekayaan Bersih',
    seriesRentNetEquity: 'Sewa — Kekayaan Bersih',
    seriesRTBNetEquity: 'Sewa Dulu, Beli Kemudian — Kekayaan Bersih',
    seriesOwnCash: 'Beli — Uang Tunai',
    seriesRentCash: 'Sewa — Uang Tunai',
    seriesRTBCash: 'Sewa Dulu, Beli Kemudian — Uang Tunai',
    seriesOwnCost: 'Beli — Biaya Kumulatif (KPR+Rutin)',
    seriesRentCost: 'Sewa — Biaya Kumulatif (Sewa+Rutin)',
    seriesRTBCost: 'Sewa Dulu, Beli Kemudian — Biaya Kumulatif',
    seriesRateBand: 'Rentang suku bunga mengambang (min–maks)',
    /* dynamic messages */
    kpiBreakevenYear: 'Tahun ',
    subInitialCashLeftover: (x) => `Sisa ${x} diinvestasikan pada suku bunga bebas risiko mulai hari pertama.`,
    subInitialCashExact: 'Tepat menutup Uang Muka (DP) + biaya awal pembelian — tidak ada sisa.',
    subInitialCashAuto: (x) => `Otomatis: ${x} (Uang Muka (DP) + biaya awal pembelian). Kelebihan diinvestasikan pada suku bunga bebas risiko.`,
    subInitialCashRTB: (x,y,z,n) => `Otomatis: ${x}. Bersama tabungannya, cukup untuk DP dan biaya awal Sewa Dulu sebesar ${z} di Thn ${n}.`,
    warnInitialCashRTB: (x,y,z,n) => `⚠️ Modal Awal ${x} kurang ${y} dari kebutuhan Sewa Dulu hari ini (${z}) untuk membeli di Thn ${n}.`,
    warnShortfall: (list) => `⚠️ Kas turun di bawah nol pada ${list}. KPR adalah satu-satunya pinjaman di model ini, jadi naikkan anggaran atau modal awal, atau kosongkan untuk angka otomatis.`,
    warnShortfallIO: (list) => `⚠️ Kas turun di bawah nol pada ${list}, saat pokok KPR bunga saja jatuh tempo. Tetapkan anggaran atau modal awal lebih tinggi untuk menabungnya.`,
    shortfallItem: (name, yr, amt) => `${name} mulai Thn ${yr} (hingga ${amt})`,
    nameOwn: 'Beli', nameRent: 'Sewa', nameRTB: 'Sewa Dulu',
    warnInitialCashShort: (x,y,z) => `⚠️ Modal Awal ${x} kurang ${y} dari Uang Muka (DP) + biaya awal pembelian (${z}). Kekurangan mengurangi ekuitas pinjaman awal.`,
    subRequiredCash: (x) => `Dibutuhkan: ${x} (Uang Muka (DP) + biaya awal pembelian).`,
    warnBudgetLow: (x,y,z) => `⚠️ Anggaran (${x}/bln) di bawah total biaya beli (${y}/bln termasuk rutin) dan biaya sewa (${z}/bln termasuk rutin). Surplus akan negatif dan kas dapat turun di bawah nol.`,
    cagrResult: (x) => `CAGR: ${x}%/thn — diterapkan ✓`,
    cagrNeedPoints: 'Butuh minimal 2 pasangan tahun dan harga yang valid.',
    cagrEndYearError: 'Tahun akhir harus setelah tahun awal.',
    /* table headers */
    thYear: 'Tahun',
    thRate: 'Bunga',
    thCashPosition: 'Posisi Kas',
    thMortgagePosition: 'Posisi KPR',
    thFinancialPosition: 'Posisi Keuangan',
    thBegCash: 'Kas Awal',
    thAnnBudget: 'Anggaran',
    thPrincipalExp: 'Pokok Pinjaman',
    thInterestExp: 'Bunga',
    thOngoingExp: 'Biaya Rutin',
    thInterestInc: 'Bunga Kas',
    thSurplus: 'Surplus',
    thEndCash: 'Kas Akhir',
    thPropValue: 'Nilai Properti',
    thPrincipalLeft: 'Sisa Pokok',
    thHouseEquity: 'Nilai Bersih Properti',
    thNetEquity: 'Kekayaan Bersih',
    thAccumCost: 'Biaya Kumulatif',
    thPhase: 'Fase',
    thTotalExp: 'Total Pengeluaran',
    thRentExp: 'Biaya Sewa',
    thPurchaseOutlay: 'Pengeluaran Beli',
    /* summary tile labels */
    tileNetEquity: 'Kekayaan Bersih',
    tileAccumCost: 'Biaya Kumulatif',
    tileHouseEquity: 'Nilai Bersih Properti',
    tileLiquidCash: 'Uang Tunai',
    tileMonthlyMortgage: 'Cicilan KPR Bulanan',
    tilePrincipalRemaining: 'Sisa Pokok Pinjaman',
    tileYearlyRent: 'Sewa Tahunan',
    tilePropPriceAtBuy: 'Harga Properti Saat Beli',
    /* phase labels */
    phaseRenting: 'Menyewa',
    phaseBought: '🔄 Baru Dibeli',
    phaseOwning: 'Memiliki',
    /* chart tooltip */
    chartTooltipYear: 'Tahun ',
  },
};
function T(key){ return LANG[lang][key] !== undefined ? LANG[lang][key] : (LANG.en[key] !== undefined ? LANG.en[key] : key); }

function applyLang(){
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const key = el.dataset.i18n;
    const val = LANG[lang][key];
    if(val === undefined || typeof val !== 'string') return;
    if(el.firstElementChild){
      /* The label carries a child of its own, a tip icon: translate the text
         beside it rather than replacing the lot. */
      const text = Array.prototype.find.call(el.childNodes, n => n.nodeType === 3);
      if(text) text.textContent = val + ' ';
      else el.insertBefore(document.createTextNode(val + ' '), el.firstChild);
      return;
    }
    el.textContent = val;
  });
  document.querySelectorAll('[data-i18n-opt]').forEach(el=>{
    const key = el.dataset.i18nOpt;
    const val = LANG[lang][key];
    if(val !== undefined) el.textContent = val;
  });
  /* the one string that carries markup of its own */
  const sensDiv = document.getElementById('sensitivityLinkDiv');
  if(sensDiv) sensDiv.innerHTML = T('sensitivityHtml');
  /* data-i18n-tip: update data-tip on tip-icons */
  document.querySelectorAll('[data-i18n-tip]').forEach(el=>{
    const key = el.dataset.i18nTip;
    const val = T(key);
    if(val) el.setAttribute('data-tip', val);
  });
  /* data-i18n-title: the native tooltip on a button whose label is a glyph */
  document.querySelectorAll('[data-i18n-title]').forEach(el=>{
    const key = el.dataset.i18nTitle;
    const val = T(key);
    if(val) el.setAttribute('title', val);
  });
  /* quick start label */
  const qsl = document.querySelector('[data-i18n="quickStartLabel"]');
  if(qsl){ qsl.textContent = T('quickStartLabel'); }
  /* CAGR show/hide button — preserve current show state */
  const cagrBtn = document.getElementById('cagrToolToggle');
  if(cagrBtn){
    const isShown = document.getElementById('cagrToolWrap')?.style.display !== 'none';
    cagrBtn.textContent = isShown ? T('btnHideTool') : T('btnShowTool');
  }
  /* rent monthly display prefix */
  const rentSub = document.getElementById('rentMonthlyDisplaySub');
  if(rentSub){
    const span = rentSub.querySelector('#rentMonthlyDisplay');
    if(span){
      rentSub.childNodes.forEach(n=>{ if(n.nodeType===3) n.remove(); });
      rentSub.insertBefore(document.createTextNode(T('rentPrefix')), span);
    }
  }
  /* help texts that have embedded dynamic spans */
  const helpBG = document.getElementById('helpBudgetGrows');
  if(helpBG){
    const span = helpBG.querySelector('#budgetIncreaseBase');
    const txt = span ? span.textContent : '—';
    if(span){
      helpBG.textContent = '';
      helpBG.appendChild(document.createTextNode(T('helpBudgetGrowsPrefix')+' '));
      const s = document.createElement('span');
      s.id='budgetIncreaseBase'; s.style.color='var(--gold)'; s.style.fontWeight='700'; s.textContent=txt;
      helpBG.appendChild(s);
      helpBG.appendChild(document.createTextNode(' '+T('helpBudgetGrowsSuffix')));
    }
  }
  const helpDP = document.getElementById('helpDownPayment');
  if(helpDP){
    const span = helpDP.querySelector('#downPaymentDollar');
    const txt = span ? span.textContent : '';
    if(span){
      helpDP.textContent = '';
      helpDP.appendChild(document.createTextNode(T('helpDownPaymentPrefix')));
      const s = document.createElement('span');
      s.id='downPaymentDollar'; s.style.color='var(--gold)'; s.style.fontWeight='700'; s.textContent=txt;
      helpDP.appendChild(s);
    }
  }
  /* update RPPI abbr title for houseGrowth label */
  const rPPIAbbr = document.querySelector('[data-i18n="labelHouseGrowth"]');
  if(rPPIAbbr) rPPIAbbr.innerHTML = T('labelHouseGrowth')+' ';
  /* switch tooltip text for data-tip-key elements based on language */
  if(window.RVO_APPLY_TIPS) RVO_APPLY_TIPS(tipTable());
}

// The tip table for the language on screen.
function tipTable(){
  return (lang === 'id' && window.RVO_TIPS_ID) ? RVO_TIPS_ID : (window.RVO_TIPS_EN || window.RVO_TIPS);
}

/* Tips on dependent fields follow the state of the control they hang off, so a
   mode switch reads as the mode you are in rather than as a list of both. Run
   from refreshLabels(), i.e. on every rerender. */
const TIP_VARIANTS = {
  mortgageMode:          () => S.mortgageMode,
  mortgageType:          () => S.mortgageType,
  ownCostsMode:          () => S.ownCostsMode,
  rentCostsMode:         () => S.rentCostsMode,
  costInterestOnly:      () => S.costInterestOnly ? 'on' : 'off',
  // The budget growth slider does nothing until a manual budget exists.
  monthlyBudgetIncrease: () => S.monthlyBudget > 0 ? 'manual' : 'auto'
};

function syncTipVariants(){
  Object.entries(TIP_VARIANTS).forEach(([key, read]) => {
    document.querySelectorAll('[data-tip-key="' + key + '"]').forEach(el =>
      el.setAttribute('data-tip-variant', read()));
  });
  if(window.RVO_APPLY_TIPS) RVO_APPLY_TIPS(tipTable());
}

/* ── DEFAULTS ── */
const DEFAULTS = {
  propertyPrice: 800000,
  downPaymentPct: 20,
  monthlyBudget: 0,
  riskFreeRate: 4.5,
  horizon: 30,
  mortgageType: 'pi',
  mortgageRate: 6.0,
  mortgageTerm: 30,
  houseGrowth: 5.0,
  sellingCostPct: 2.5,
  setupCost: 32000,
  setupCostType: 'dollar',
  ownOngoingCost: 6000,
  ownOngoingCostFreq: 'yearly',
  ownOngoingCostType: 'dollar',
  ownOngoingInflation: 0,
  rentAmount: 2800,
  rentFreq: 'monthly',
  rentInflation: 3.0,
  rentOngoingCost: 1200,
  rentOngoingCostFreq: 'yearly',
  rentOngoingCostType: 'dollar',
  rentOngoingInflation: 0,
  initialCash: 0,
  costInterestOnly: true,
  rtbEnabled: false,
  rtbBuyYear: 5,
  monthlyBudgetIncrease: 0,
  currencySymbol: '$',
  mortgageMode: 'simple',
  ratePeriods: null,
  ownCostsMode: 'simple',
  rentCostsMode: 'simple',
  ownSetupCosts: null,
  ownOngoingCosts: null,
  rentOngoingCosts: null,
};

/* ── CITY PRESETS ──
   Values sourced from: REIWA (Perth), Urban Property Australia (Melbourne), Domain/CoreLogic (Sydney), Databoks/BI (Jakarta)
   Property prices: median 2BR apartment, city centre or inner suburbs, 2024–2025.
   Perth stamp duty: WA general rate ($360k–$725k bracket). Melbourne stamp duty: VIC general rate.
   Sydney stamp duty: NSW general rate ($372k–$1.24M bracket). Jakarta setup: BPHTB 5% + PPAT/notary ~1% + bank/admin fees. Mortgage: typical KPR floating rate.
*/
const CITY_PRESETS = {
  perth: {
    // Perth, WA: ~$750k for 2BR in city centre/inner suburbs (Subiaco, East Perth, Northbridge, West Perth, Mt Lawley)
    // WA stamp duty on $750k (>$725k bracket): $28,453 + 5.15%×$25k = $29,741 + legal ~$2,500 + misc ~$260 = ~$32,500
    // Mortgage: Big-4 owner-occ P&I variable ~6.1% (CBA 6.09%). Rent: $700/week inner Perth (REIWA 2025). RPPI: 20-yr unit CAGR ~4.5%.
    currencySymbol: '$',
    propertyPrice: 750000,
    downPaymentPct: 20,
    mortgageRate: 6.1,
    mortgageTerm: 30,
    houseGrowth: 4.5,
    sellingCostPct: 2.5, // selling: agent ~2.0% + marketing/legal ~0.5% (REIWA typical)
    setupCost: 32500,
    setupCostType: 'dollar',
    ownOngoingCost: 8500,
    ownOngoingCostFreq: 'yearly',
    ownOngoingCostType: 'dollar',
    ownOngoingInflation: 2.5,
    rentAmount: 700,
    rentFreq: 'weekly',
    rentInflation: 3.5,
    rentOngoingCost: 1500,
    rentOngoingCostFreq: 'yearly',
    rentOngoingCostType: 'dollar',
    rentOngoingInflation: 2.5,
    riskFreeRate: 4.5,
    horizon: 30,
    monthlyBudget: 0,
    monthlyBudgetIncrease: 0,
    mortgageType: 'pi',
    costInterestOnly: true,
    rtbEnabled: false,
    rtbBuyYear: 5,
    initialCash: 0,
  },
  melbourne: {
    // Melbourne, VIC: ~$800k for 2BR in city centre/inner suburbs (Richmond, Fitzroy, South Yarra, Carlton, Prahran)
    // VIC stamp duty on $800k (general rate): $2,870 + 6%×$670k = $43,070 + legal ~$2,500 = ~$45,500 (PPR concession doesn't apply >$550k)
    // Mortgage: Big-4 owner-occ P&I variable ~6.1%. Rent: $620/week inner Melbourne (Urban Property Australia Q1 2025). RPPI: 10-yr unit CAGR ~3%.
    currencySymbol: '$',
    propertyPrice: 800000,
    downPaymentPct: 20,
    mortgageRate: 6.1,
    mortgageTerm: 30,
    houseGrowth: 3.0,
    sellingCostPct: 2.5, // selling: agent ~2.0% + marketing/legal ~0.5%
    setupCost: 45500,
    setupCostType: 'dollar',
    ownOngoingCost: 9500,
    ownOngoingCostFreq: 'yearly',
    ownOngoingCostType: 'dollar',
    ownOngoingInflation: 2.5,
    rentAmount: 620,
    rentFreq: 'weekly',
    rentInflation: 3.0,
    rentOngoingCost: 1500,
    rentOngoingCostFreq: 'yearly',
    rentOngoingCostType: 'dollar',
    rentOngoingInflation: 2.5,
    riskFreeRate: 4.5,
    horizon: 30,
    monthlyBudget: 0,
    monthlyBudgetIncrease: 0,
    mortgageType: 'pi',
    costInterestOnly: true,
    rtbEnabled: false,
    rtbBuyYear: 5,
    initialCash: 0,
  },
  sydney: {
    // Sydney, NSW: ~$1.05M for 2BR in city centre/inner suburbs (Surry Hills, Pyrmont, Newtown, Glebe, Redfern)
    // NSW transfer duty on $1.05M ($372k–$1.24M bracket): $11,152 + 4.5%×$678k = $41,662 + legal ~$2,500 = ~$44,200
    // Mortgage: Big-4 owner-occ P&I variable ~6.1%. Rent: $750/week inner Sydney (Domain 2025). RPPI: 20-yr unit CAGR ~3.5% (units ~doubled over 20 yrs).
    currencySymbol: '$',
    propertyPrice: 1050000,
    downPaymentPct: 20,
    mortgageRate: 6.1,
    mortgageTerm: 30,
    houseGrowth: 3.5,
    sellingCostPct: 2.5, // selling: agent ~2.0% + marketing/legal ~0.5%
    setupCost: 44200,
    setupCostType: 'dollar',
    ownOngoingCost: 11000,
    ownOngoingCostFreq: 'yearly',
    ownOngoingCostType: 'dollar',
    ownOngoingInflation: 2.5,
    rentAmount: 750,
    rentFreq: 'weekly',
    rentInflation: 3.5,
    rentOngoingCost: 1500,
    rentOngoingCostFreq: 'yearly',
    rentOngoingCostType: 'dollar',
    rentOngoingInflation: 2.5,
    riskFreeRate: 4.5,
    horizon: 30,
    monthlyBudget: 0,
    monthlyBudgetIncrease: 0,
    mortgageType: 'pi',
    costInterestOnly: true,
    rtbEnabled: false,
    rtbBuyYear: 5,
    initialCash: 0,
  },
  singapore: {
    // Singapore: ~S$1.8M for 2BR private condo in RCR/inner suburb (iqrate.io Q1 2025: RCR median ~S$1,896 PSF; Bamboo Routes 2BR avg)
    // BSD on S$1.8M: 1%×180k+2%×180k+3%×640k+4%×500k+5%×300k = S$59,600 + legal ~S$4,000 + valuation ~S$1,400 = S$65,000
    // Mortgage: 2.5% blended (current 2-yr fixed ~1.75% from DBS/OCBC/UOB, resets to floating; SORA-based long-run avg ~2.5%). MAS LTV max 75% → 25% down.
    // ABSD: 0% for Singapore Citizens buying first property (IRAS 2025). Rent: S$5,000/mo (RCR/inner 2BR; Rentify.sg 2025: S$4,500–5,500). RPPI: 4.5% conservative (20-yr CAGR ~6.4%, EdgeProp). RFR: 3.5% (SSB/T-bills).
    currencySymbol: '$',
    propertyPrice: 1800000,
    downPaymentPct: 25,
    mortgageRate: 2.5,
    mortgageTerm: 30,
    houseGrowth: 4.5,
    sellingCostPct: 2.0, // selling: agent ~1.5–2% (CEA norm) + legal ~0.3%; no SSD after the holding period
    setupCost: 65000,
    setupCostType: 'dollar',
    ownOngoingCost: 7000,
    ownOngoingCostFreq: 'yearly',
    ownOngoingCostType: 'dollar',
    ownOngoingInflation: 3.0,
    rentAmount: 5000,
    rentFreq: 'monthly',
    rentInflation: 3.0,
    rentOngoingCost: 1500,
    rentOngoingCostFreq: 'yearly',
    rentOngoingCostType: 'dollar',
    rentOngoingInflation: 2.5,
    riskFreeRate: 3.5,
    horizon: 30,
    monthlyBudget: 0,
    monthlyBudgetIncrease: 0,
    mortgageType: 'pi',
    costInterestOnly: true,
    rtbEnabled: false,
    rtbBuyYear: 5,
    initialCash: 0,
  },
  kualalumpur: {
    // Kuala Lumpur: ~RM 1.0M for 2BR condo in Mont Kiara/Bangsar/KLCC inner suburb (Bamboo Routes 2026: RM 900k–1.3M for prime areas)
    // MOT stamp duty on RM 1.0M: 1%×100k+2%×400k+3%×500k = RM 24,000 + loan agreement stamp duty (0.5%×900k) RM 4,500 + legal ~RM 11,500 = RM 40,000
    // Mortgage: 4.3% (OPR 2.75% cut Jul 2025; SBR 2.75% + spread ~1.55%; Maybank 4.25–4.40%, CIMB 4.30–4.35%, PropCashflow 2026). Max LTV 90% → 10% down.
    // Rent: RM 4,000/mo (Mont Kiara/Bangsar 2BR; Bamboo Routes KL 2026: RM 3,800–4,500). RPPI: 3.0% (EdgeProp.my 20-yr data; post-2015 oversupply). RFR: 3.5% (MY FD/ASB).
    currencySymbol: 'RM',
    propertyPrice: 1000000,
    downPaymentPct: 10,
    mortgageRate: 4.3,
    mortgageTerm: 30,
    houseGrowth: 3.0,
    sellingCostPct: 3.0, // selling: agent up to 3% (BOVAEA cap) + legal; RPGT nil for citizens after 5 years
    setupCost: 40000,
    setupCostType: 'dollar',
    ownOngoingCost: 8000,
    ownOngoingCostFreq: 'yearly',
    ownOngoingCostType: 'dollar',
    ownOngoingInflation: 3.0,
    rentAmount: 4000,
    rentFreq: 'monthly',
    rentInflation: 3.0,
    rentOngoingCost: 1500,
    rentOngoingCostFreq: 'yearly',
    rentOngoingCostType: 'dollar',
    rentOngoingInflation: 2.5,
    riskFreeRate: 3.5,
    horizon: 30,
    monthlyBudget: 0,
    monthlyBudgetIncrease: 0,
    mortgageType: 'pi',
    costInterestOnly: true,
    rtbEnabled: false,
    rtbBuyYear: 5,
    initialCash: 0,
  },
  jakarta: {
    // Jakarta, ID: ~Rp 2B median 2BR inner suburb/central; setup: BPHTB 5%×(2B-80M) ≈ Rp 96M + PPAT/notary Rp 18M + fees Rp 6M = Rp 120M
    // KPR rate: avg SBDK major banks ~9.25–9.5% (Databoks May 2025; BCA 9.37%, BNI 9.10%). Term: 20yr typical. Rent: ~Rp 10M/mo. RFR: IDR time deposit ~5% (BI rate 4.75%).
    currencySymbol: 'Rp',
    propertyPrice: 2000000000,
    downPaymentPct: 20,
    mortgageRate: 9.5,
    mortgageTerm: 20,
    houseGrowth: 5.5,
    sellingCostPct: 5.5, // selling: agent ~3% + PPh final 2.5% on the sale (PP 34/2016)
    setupCost: 120000000,
    setupCostType: 'dollar',
    ownOngoingCost: 21000000,
    ownOngoingCostFreq: 'yearly',
    ownOngoingCostType: 'dollar',
    ownOngoingInflation: 3.5,
    rentAmount: 10000000,
    rentFreq: 'monthly',
    rentInflation: 4.0,
    rentOngoingCost: 1000000,
    rentOngoingCostFreq: 'yearly',
    rentOngoingCostType: 'dollar',
    rentOngoingInflation: 3.5,
    riskFreeRate: 5.0,
    horizon: 20,
    monthlyBudget: 0,
    monthlyBudgetIncrease: 0,
    mortgageType: 'pi',
    costInterestOnly: true,
    rtbEnabled: false,
    rtbBuyYear: 5,
    initialCash: 0,
  },
};

let S = JSON.parse(JSON.stringify(DEFAULTS));
let persist = null; // mini cache handle (assigned at init)
let latestRows = [];
let cachedRtbRows = null;
let latestHasBand = false;
let activeTable = 'own';
let activeGraph = 'netEquity';
let chartInstance = null;
let currentCurrencySymbol = '$';

/* ── HELPERS ── */
const $ = id => document.getElementById(id);
const cssVar = n => getComputedStyle(document.body).getPropertyValue(n).trim();
function moneySymbol(){ return currentCurrencySymbol || '$'; }
function moneyWithSymbol(n, {minimumFractionDigits=0, maximumFractionDigits=0}={}){
  const abs = Math.abs(Number(n||0));
  return moneySymbol() + abs.toLocaleString('en-AU', {minimumFractionDigits, maximumFractionDigits});
}

function parseNum(val){
  if(typeof val==='number') return Number.isFinite(val) ? val : 0;
  const cleaned = String(val ?? '').replace(/,/g,'').replace(/[^\d.-]/g,'').trim();
  if(cleaned==='' || cleaned==='-' || cleaned==='.' || cleaned==='-.') return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}
function parseFloatSafe(val, fallback){
  const n = parseFloat(val);
  return isNaN(n) ? fallback : n;
}
function parseIntSafe(val, fallback){
  const n = parseInt(val);
  return isNaN(n) ? fallback : n;
}
function formatMoneyValue(val){
  const n = parseNum(val);
  if(!Number.isFinite(n)) return '';
  const isInt = Math.abs(n % 1) < 1e-9;
  return n.toLocaleString('en-AU',{
    minimumFractionDigits:0,
    maximumFractionDigits:isInt ? 0 : 2
  });
}
function formatMoneyInput(el){
  if(!el) return;
  const raw = String(el.value ?? '').replace(/,/g,'').trim();
  if(raw===''){ el.value=''; return; }
  el.value = formatMoneyValue(raw);
}
function syncMoneyInputs(){
  document.querySelectorAll('[data-money="true"]').forEach(formatMoneyInput);
}

const fmt = {
  currency(v, compact=false){
    const n=Number(v||0), abs=Math.abs(n), sign=n<0?'−':'';
    if(compact&&abs>=1e9) return sign+moneySymbol()+(abs/1e9).toFixed(2)+'b';
    if(compact&&abs>=1e6) return sign+moneySymbol()+(abs/1e6).toFixed(2)+'m';
    if(compact&&abs>=1e3) return sign+moneySymbol()+(abs/1e3).toFixed(0)+'k';
    return (n<0?'−':'')+moneyWithSymbol(Math.abs(n));
  },
  pct(v,d=2){ const n=Number(v||0); return (Math.abs(n)<=1?n*100:n).toFixed(d)+'%'; },
  num(v,d=0){ return Number(v||0).toLocaleString('en-AU',{minimumFractionDigits:d,maximumFractionDigits:d}); },
};

/* The model itself lives in engine.js, shared with the Sensitivity page so
   the two can never disagree. These wrappers bind it to this page's state. */
const E = window.RVOEngine;
const toYearly = E.toYearly, toMonthly = E.toMonthly;
function getOwnRateNorm(){ return E.getRateNorm(S); }
function scheduleHasFloat(){ return E.scheduleHasFloat(S); }
function setupCostTotal(price){ return E.setupCostTotal(S, price); }
function ownOngoingYearlyAt(yr, propValue){ return E.ownOngoingYearlyAt(S, yr, propValue); }
function rentOngoingYearlyAt(yr, rentMonthly){ return E.rentOngoingYearlyAt(S, yr, rentMonthly); }
function computeModel(variant){ return E.computeModel(S, variant); }

/* ── READ INPUTS ── */
function readInputs(){
  S.propertyPrice   = Math.max(50000, parseNum($('propertyPrice').value)||DEFAULTS.propertyPrice);
  S.downPaymentPct  = parseFloatSafe($('downPaymentPct').value, DEFAULTS.downPaymentPct);
  S.monthlyBudget   = Math.max(0, parseNum($('monthlyBudget').value)||0);
  S.riskFreeRate    = parseFloatSafe($('riskFreeRate').value, DEFAULTS.riskFreeRate);
  S.horizon         = parseIntSafe($('horizon').value, DEFAULTS.horizon);
  S.mortgageType    = document.querySelector('input[name="mortgageType"]:checked')?.value||'pi';
  S.mortgageRate    = parseFloatSafe($('mortgageRate').value, DEFAULTS.mortgageRate);
  S.mortgageTerm    = parseIntSafe($('mortgageTerm').value, DEFAULTS.mortgageTerm);
  S.houseGrowth     = parseFloatSafe($('houseGrowth').value, DEFAULTS.houseGrowth);
  S.sellingCostPct  = Math.max(0, parseFloatSafe($('sellingCostPct').value, DEFAULTS.sellingCostPct));
  S.setupCost       = Math.max(0, parseNum($('setupCost').value)||0);
  S.setupCostType   = $('setupCostType').value;
  S.ownOngoingCost  = Math.max(0, parseNum($('ownOngoingCost').value)||0);
  S.ownOngoingCostFreq  = $('ownOngoingCostFreq').value;
  S.ownOngoingCostType  = $('ownOngoingCostType').value;
  // A rent of 0 is a real answer (living rent-free); only a blank field falls back
  S.rentAmount      = String($('rentAmount').value).trim()==='' ? DEFAULTS.rentAmount : Math.max(0, parseNum($('rentAmount').value));
  S.rentFreq        = $('rentFreq').value;
  S.rentInflation   = parseFloatSafe($('rentInflation').value, DEFAULTS.rentInflation);
  S.rentOngoingCost = Math.max(0, parseNum($('rentOngoingCost').value)||0);
  S.rentOngoingCostFreq = $('rentOngoingCostFreq').value;
  S.rentOngoingCostType = $('rentOngoingCostType').value;
  S.rentOngoingInflation = parseFloatSafe($('rentOngoingInflation').value, 0);
  S.ownOngoingInflation  = parseFloatSafe($('ownOngoingInflation').value, 0);
  S.initialCash     = Math.max(0, parseNum($('initialCash').value)||0);
  S.costInterestOnly = $('costInterestOnly').checked;
  S.rtbEnabled      = $('rtbEnabled').checked;
  S.rtbBuyYear      = parseIntSafe($('rtbBuyYear').value, DEFAULTS.rtbBuyYear);
  S.monthlyBudgetIncrease = parseFloatSafe($('monthlyBudgetIncrease').value, 0);
  S.currencySymbol  = $('currencySymbol').value || '$';
  // Simple mode: always P&I, cost = interest only (their controls are hidden)
  if(S.mortgageMode !== 'detailed'){
    S.mortgageType = 'pi';
    S.costInterestOnly = true;
  } else {
    // Capture any in-progress edits to the rate schedule
    if(document.querySelector('#ratePeriodRows .rate-period-row')) readRatePeriodsFromDOM();
  }
  // Capture any in-progress edits to detailed cost item lists
  if(S.ownCostsMode==='detailed'){
    if(document.querySelector('#ownSetupCostRows .cost-item-row'))   readCostItemsFromDOM('ownSetup');
    if(document.querySelector('#ownOngoingCostRows .cost-item-row')) readCostItemsFromDOM('ownOngoing');
  }
  if(S.rentCostsMode==='detailed'){
    if(document.querySelector('#rentOngoingCostRows .cost-item-row')) readCostItemsFromDOM('rentOngoing');
  }
  currentCurrencySymbol = S.currencySymbol;
  updateCurrencyPrefixes();
}

function updateCurrencyPrefixes(){
  const sym = moneySymbol();
  ['initialCashPrefix','monthlyBudgetPrefix','propertyPricePrefix','setupCostPrefix','ownOngoingCostPrefix','rentAmountPrefix','rentOngoingCostPrefix'].forEach(id=>{
    const el = $(id);
    if(el) el.textContent = sym;
  });
  // Dynamic cost-item rows: $ items show the currency symbol, % items show %
  document.querySelectorAll('.cost-item-row').forEach(row=>{
    const pre = row.querySelector('.prefix');
    const basis = row.querySelector('.ci-basis')?.value;
    if(pre) pre.textContent = basis==='pct' ? '%' : sym;
  });
}

function refreshLabels(){
  syncTipVariants();
  const dp = S.propertyPrice * S.downPaymentPct/100;
  $('downPaymentPctVal').textContent = S.downPaymentPct+'%';
  $('downPaymentDollar').textContent = fmt.currency(dp);
  $('riskFreeRateVal').textContent   = S.riskFreeRate.toFixed(2)+'%';
  $('horizonVal').textContent        = S.horizon+T('yrsSuffix');
  $('mortgageRateVal').textContent        = S.mortgageRate.toFixed(2)+'%';
  $('mortgageTermVal').textContent        = S.mortgageTerm+T('yrsSuffix');
  if(S.mortgageMode === 'detailed') syncRatePeriodLabels();
  $('houseGrowthVal').textContent         = S.houseGrowth.toFixed(2)+'%';
  $('sellingCostPctVal').textContent      = S.sellingCostPct.toFixed(2)+'%';
  $('rentInflationVal').textContent       = S.rentInflation.toFixed(2)+'%';
  $('ownOngoingInflationVal').textContent = S.ownOngoingInflation.toFixed(2)+'%';
  $('rentOngoingInflationVal').textContent= S.rentOngoingInflation.toFixed(2)+'%';
  // Show inflation sliders only for fixed-$ mode
  $('ownOngoingInflationRow').style.display  = S.ownOngoingCostType==='dollar' ? '' : 'none';
  $('rentOngoingInflationRow').style.display = S.rentOngoingCostType==='dollar' ? '' : 'none';

  // RTB slider — clamp max to horizon-1
  const rtbSlider = $('rtbBuyYear');
  const maxRtb = Math.max(1, S.horizon - 1);
  if(parseInt(rtbSlider.max) !== maxRtb){ rtbSlider.max = maxRtb; }
  if(S.rtbBuyYear > maxRtb){ S.rtbBuyYear = maxRtb; rtbSlider.value = maxRtb; }
  $('rtbBuyYearVal').textContent = S.rtbBuyYear+T('yrsSuffix');

  const rentMonthly = toMonthly(S.rentAmount, S.rentFreq);
  $('rentMonthlyDisplay').textContent = fmt.currency(rentMonthly)+T('perMo');

  // Show/hide budget increase row only when budget is manually set
  const budgetSet = S.monthlyBudget > 0;
  $('budgetIncreaseRow').style.display = budgetSet ? 'block' : 'none';
  $('monthlyBudgetIncreaseVal').textContent = S.monthlyBudgetIncrease.toFixed(2)+'%';
  if(budgetSet){
    $('budgetIncreaseBase').textContent = fmt.currency(S.monthlyBudget)+T('perMo');
  }

  // Initial cash: the engine's own figures, so this note and the model agree
  const plan = E.initialCashPlan(S);
  const required = plan.requiredNow;
  const cashWarn = $('initialCashWarn');
  const cashSub  = $('initialCashSub');
  if(S.initialCash > 0){
    const leftover = S.initialCash - required;
    const rtbShort = S.rtbEnabled ? plan.rtbRequiredNow - S.initialCash : 0;
    if(leftover < 0){
      cashWarn.style.display='block';
      cashWarn.textContent=T('warnInitialCashShort')(fmt.currency(S.initialCash), fmt.currency(-leftover), fmt.currency(required));
      cashSub.textContent = T('subRequiredCash')(fmt.currency(required));
    } else if(rtbShort > 0.5){
      cashWarn.style.display='block';
      cashWarn.textContent=T('warnInitialCashRTB')(fmt.currency(S.initialCash), fmt.currency(rtbShort), fmt.currency(plan.rtbRequiredNow), S.rtbBuyYear);
      cashSub.textContent = T('subInitialCashLeftover')(fmt.currency(leftover));
    } else {
      cashWarn.style.display='none';
      cashSub.textContent = leftover > 0
        ? T('subInitialCashLeftover')(fmt.currency(leftover))
        : T('subInitialCashExact');
    }
  } else {
    cashWarn.style.display='none';
    if(S.rtbEnabled){
      cashSub.textContent = T('subInitialCashRTB')(fmt.currency(plan.autoInitialCash), fmt.currency(required), fmt.currency(plan.rtbFutureCost), S.rtbBuyYear);
    } else {
      cashSub.textContent = T('subInitialCashAuto')(fmt.currency(plan.autoInitialCash));
    }
  }
}

/* ── MODEL ── */
/* ── CHART ── */
/* The key shows each line as the chart strokes it: a solid line for rent and
   own, and for rent-then-buy the dashed line that changes colour at the year
   of purchase. The shaded min–max band, when a floating rate puts one on the
   chart, gets an entry of its own rather than going unexplained. */
/* The one mark a series is keyed by. The rent-then-buy swatch is the line in
   miniature: it changes colour at the marked year of purchase, exactly as the
   chart does — something no single dataset property can state, so it is said
   here once and pinned to the dataset, and the key and the hover card both
   read it from there. */
function seriesSpec(s){
  const isRTB = s.key && s.key.includes('RTB');
  return isRTB
    ? {colors:[cssVar('--line-rtb-rent'), cssVar('--line-rtb-own')], width:2.5, dash:[6,4],
       point:{shape:'circle', fill:cssVar('--line-rtb-own'), stroke:'#fff', width:1.5, radius:3}}
    : {color:cssVar(s.colorVar), width:2.5};
}

function buildLegend(series, hasBand){
  const el = $('chartLegend');
  el.innerHTML = '';
  series.forEach(s=>{
    const d = document.createElement('div');
    d.className='legend-item';
    SharedLegend.attach(d, seriesSpec(s), s.label);
    el.appendChild(d);
  });
  if(hasBand){
    const b = document.createElement('div');
    b.className='legend-item';
    SharedLegend.attach(b, {type:'area', fill:cssVar('--line-a')+'30', fill2:cssVar('--line-b')+'30'}, T('seriesRateBand'));
    el.appendChild(b);
  }
}

function getGraphSeries(){
  const haRTB = S.rtbEnabled;
  if(activeGraph==='netEquity'){
    const s = [
      {key:'netEquityOwn',  colorVar:'--line-a', label:T('seriesOwnNetEquity')},
      {key:'netEquityRent', colorVar:'--line-b', label:T('seriesRentNetEquity')},
    ];
    if(haRTB) s.push({key:'netEquityRTB', colorVar:'--line-c', label:T('seriesRTBNetEquity')});
    return s;
  }
  if(activeGraph==='cash'){
    const s = [
      {key:'cashOwn',  colorVar:'--line-a', label:T('seriesOwnCash')},
      {key:'cashRent', colorVar:'--line-b', label:T('seriesRentCash')},
    ];
    if(haRTB) s.push({key:'cashRTB', colorVar:'--line-c', label:T('seriesRTBCash')});
    return s;
  }
  const s = [
    {key:'costOwn',  colorVar:'--line-a', label:T('seriesOwnCost')},
    {key:'costRent', colorVar:'--line-b', label:T('seriesRentCost')},
  ];
  if(haRTB) s.push({key:'costRTB', colorVar:'--line-c', label:T('seriesRTBCost')});
  return s;
}

function renderChart(rows){
  const series = getGraphSeries();
  buildLegend(series, !!latestHasBand);
  const sym = $('currencySymbol').value || '$';
  const yAxisTitle = activeGraph==='netEquity' ? `Net Equity (${sym})` : activeGraph==='cash' ? `Liquid Cash (${sym})` : `Accumulated Cost (${sym})`;
  // Use integer year numbers for labels — must be plain numbers, not strings
  const labels   = rows.map(r=> (typeof r.year === 'number' && isFinite(r.year)) ? r.year : 0);
  const rtbBuyYearIdx = S.rtbEnabled ? labels.indexOf(S.rtbBuyYear) : -1;
  const datasets = series.map(s=>{
    const isRTB = s.key && s.key.includes('RTB');
    const pointRadii = rows.map((r, i) => {
      if(isRTB && i === rtbBuyYearIdx && rtbBuyYearIdx >= 0) return 5;
      return 0;
    });
    if(isRTB){
      const buyIdx = rtbBuyYearIdx;
      return {
        label: s.label,
        data: rows.map(r=>r[s.key]??0),
        borderColor: cssVar('--line-rtb-own'),
        backgroundColor: cssVar('--line-rtb-own')+'22',
        borderWidth: 2.5,
        borderDash: [6, 4],
        pointRadius: pointRadii,
        pointHoverRadius: 6,
        pointBackgroundColor: rows.map((r,i)=> i < buyIdx ? cssVar('--line-rtb-rent') : cssVar('--line-rtb-own')),
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        tension: 0.3, cubicInterpolationMode:'monotone',
        fill: false,
        segment: {
          borderColor: ctx => ctx.p0DataIndex < buyIdx
            ? cssVar('--line-rtb-rent')
            : cssVar('--line-rtb-own'),
          borderDash: () => [6, 4],
        },
      };
    }
    return {
      label: s.label,
      data: rows.map(r=>r[s.key]??0),
      borderColor: cssVar(s.colorVar),
      backgroundColor: cssVar(s.colorVar)+'22',
      borderWidth:2.5,
      pointRadius: pointRadii,
      pointHoverRadius: 6,
      pointBackgroundColor: undefined,
      pointBorderColor: undefined,
      pointBorderWidth: 0,
      tension:0.3, cubicInterpolationMode:'monotone', fill:false,
    };
  });
  datasets.forEach((d,i)=>{ d.rvoKey = series[i].key; d.legendSpec = seriesSpec(series[i]); });

  // Floating-rate band: shaded min–max range per series (appended last so it draws
  // beneath the lines — Chart.js paints datasets from last to first).
  if(latestHasBand){
    series.forEach(s=>{
      const loKey = s.key+'Low', hiKey = s.key+'High';
      if(!rows.some(r=> r[loKey]!==undefined && r[hiKey]!==undefined)) return;
      const maxDiff = rows.reduce((mx,r)=>Math.max(mx, Math.abs((r[hiKey]??0)-(r[loKey]??0))), 0);
      if(maxDiff <= 0.5) return;
      const color = (s.key && s.key.includes('RTB')) ? cssVar('--line-rtb-own') : cssVar(s.colorVar);
      datasets.push({
        label: s.label+' (band)',
        data: rows.map(r=>r[hiKey]??0),
        borderColor:'transparent', backgroundColor:'transparent',
        pointRadius:0, pointHoverRadius:0, borderWidth:0,
        tension:0.3, cubicInterpolationMode:'monotone', fill:false, isBand:true,
      });
      datasets.push({
        label: s.label+' (band)',
        data: rows.map(r=>r[loKey]??0),
        borderColor:'transparent', backgroundColor: color+'30',
        pointRadius:0, pointHoverRadius:0, borderWidth:0,
        tension:0.3, cubicInterpolationMode:'monotone', fill:'-1', isBand:true,
      });
    });
  }

  // Callback references chart's own live labels — avoids stale closure on update
  const xTickCallback = function(val, i){
    const lbl = this.chart.data.labels[i];
    return (lbl !== undefined && lbl !== null) ? `Yr ${lbl}` : '';
  };

  const g=cssVar('--chart-grid'), m=cssVar('--chart-text'), t=cssVar('--text');
  const cfg = {
    type:'line', data:{labels,datasets},
    options:{
      responsive:true, maintainAspectRatio:false, animation:{duration:200},
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{display:false},
        tooltip:SharedChartTip.options({
          filter: item => !item.dataset.isBand,
          callbacks:{
            title: ctx=>`${T('chartTooltipYear')}${ctx[0].label}`,
            label: ctx=>{
              let txt = `  ${ctx.dataset.label}: ${fmt.currency(ctx.parsed.y,true)}`;
              const k = ctx.dataset.rvoKey;
              if(k && latestHasBand){
                const row = latestRows[ctx.dataIndex];
                if(row && row[k+'Low']!==undefined && row[k+'High']!==undefined && Math.abs(row[k+'High']-row[k+'Low'])>0.5){
                  const a = Math.min(row[k+'Low'], row[k+'High']);
                  const b = Math.max(row[k+'Low'], row[k+'High']);
                  txt += ` (${fmt.currency(a,true)} – ${fmt.currency(b,true)})`;
                }
              }
              return txt;
            },
          },
          backgroundColor:cssVar('--panel')||'#162033',
          titleColor:t, bodyColor:m, borderColor:cssVar('--border'), borderWidth:1, padding:10,
        }),
        /* The shared gesture block: a pan cannot leave the years modelled,
           and the pinch has a floor, so the chart can never be zoomed past
           the data it holds (SharedZoom, shared.js). */
        zoom:SharedZoom.options({min:0,max:Math.max(0,labels.length-1),points:labels.length}),
        /* ...and the y axis follows the x window. Net equity at year 30 is
           an order of magnitude above year 3, so without this a zoom into
           the early years draws them as a flat smear along the axis. Zero
           stays on the scale: every series here is read against it. */
        sharedYFit:{auto:{axes:['y'],includeZero:true}},
      },
      scales:{
        x:{title:{display:true,text:'Year',color:m,font:{family:"'DM Mono', monospace",size:11}},ticks:{color:m,maxTicksLimit:12,font:{family:"'DM Mono', monospace",size:11},callback:xTickCallback},grid:{color:g}},
        y:{title:{display:true,text:yAxisTitle,color:m,font:{family:"'DM Mono', monospace",size:11}},ticks:{color:m,font:{family:"'DM Mono', monospace",size:11},callback:v=>fmt.currency(v,true)},grid:{color:g}},
      },
    },
  };

  if(chartInstance){
    // New data means a new view: a window left by a pan or a pinch is dropped.
    SharedZoom.resetView(chartInstance);
    chartInstance.data.labels=labels;
    chartInstance.data.datasets=datasets;
    chartInstance.options.scales.x.ticks.color=m;
    chartInstance.options.scales.x.ticks.callback=xTickCallback;
    chartInstance.options.scales.x.grid.color=g;
    chartInstance.options.scales.x.title.color=m;
    chartInstance.options.scales.y.ticks.color=m;
    chartInstance.options.scales.y.grid.color=g;
    chartInstance.options.scales.y.title.color=m;
    chartInstance.options.scales.y.title.text=yAxisTitle;
    chartInstance.options.plugins.tooltip.backgroundColor=cssVar('--panel')||'#162033';
    chartInstance.options.plugins.tooltip.titleColor=t;
    chartInstance.options.plugins.tooltip.bodyColor=m;
    chartInstance.options.plugins.tooltip.borderColor=cssVar('--border');
    // The limits travel with the data: a different horizon means a different
    // extent to pan across.
    chartInstance.options.plugins.zoom=cfg.options.plugins.zoom;
    chartInstance.update('none');
  } else {
    chartInstance = new Chart($('chartCanvas'), {...cfg, plugins:[SharedZoom.plugin]});
  }
}

/* ── KPIs ── */
function updateKPIs(state){
  const {breakeven,summary,rows,mPayment,monthlyBudget,rentMonthly0,initialCashUsed,ownCashStart,renterStartCapital} = state;
  $('kpiInitialCash').textContent = fmt.currency(initialCashUsed, true);
  const monthlyBudgets = (rows||[]).slice(1).map(r=>Number(r.yearlyBudget||0)).filter(v=>Number.isFinite(v) && v>0);
  if(monthlyBudgets.length){
    const minBudget = Math.min(...monthlyBudgets);
    const maxBudget = Math.max(...monthlyBudgets);
    $('kpiBudgetRange').textContent = (maxBudget - minBudget) > 0.5
      ? `${fmt.currency(minBudget, true)}–${fmt.currency(maxBudget, true)}`
      : fmt.currency(minBudget, true);
  } else {
    $('kpiBudgetRange').textContent = '—';
  }
  $('kpiBreakeven').textContent = breakeven ? T('kpiBreakevenYear')+breakeven : '—';
  $('kpiBreakeven').style.color = breakeven ? cssVar('--accent') : cssVar('--muted');
  const diff = summary.diff;
  $('kpiDiff').textContent = (diff>=0?'+':'')+fmt.currency(diff, true);
  $('kpiDiff').style.color = diff>=0 ? cssVar('--data-pos-em') : cssVar('--data-neg-em');

  const warn = $('warningBanner');
  const msgs = [];
  if(S.monthlyBudget > 0){
    // Year-1 ongoing costs for warning purposes
    const ownOngoingWarn  = ownOngoingYearlyAt(1, S.propertyPrice)/12;
    const rentOngoingWarn = rentOngoingYearlyAt(1, rentMonthly0)/12;
    const ownTotalWarn  = mPayment + ownOngoingWarn;
    const rentTotalWarn = rentMonthly0 + rentOngoingWarn;
    if(monthlyBudget < ownTotalWarn && monthlyBudget < rentTotalWarn){
      msgs.push(T('warnBudgetLow')(fmt.currency(monthlyBudget), fmt.currency(ownTotalWarn,true), fmt.currency(rentTotalWarn,true)));
    }
  }
  // Any scenario whose cash goes below zero on any rate path: the model does
  // not borrow beyond the mortgage, so say so rather than hide it
  const sf = state.shortfalls || {};
  const items = [['own','nameOwn'],['rent','nameRent'],['rtb','nameRTB']]
    .filter(([k])=>sf[k])
    .map(([k,nm])=>T('shortfallItem')(T(nm), sf[k].year, fmt.currency(sf[k].worst, true)));
  // With the automatic budget and cash only an interest-only balance falling
  // due can do it: they cover repayments, not the lump sum at the term's end
  const autoFigures = !(S.monthlyBudget > 0) && !(S.initialCash > 0);
  if(items.length) msgs.push(T(autoFigures ? 'warnShortfallIO' : 'warnShortfall')(items.join(', ')));
  warn.style.display = msgs.length ? 'block' : 'none';
  warn.textContent = msgs.join(' ');
}

/* ── SUMMARY TILES ── */
function payRangeText(lo, hi, single){
  return (hi - lo) > 0.5
    ? `${fmt.currency(lo)}–${fmt.currency(hi)}${T('perMo')}`
    : `${fmt.currency(single)}${T('perMo')}`;
}
function updateSummary(state){
  const {summary,mPayment,mPaymentMin,mPaymentMax,rentMonthly0,monthlyBudget,initialCashUsed,ownCashStart,renterStartCapital} = state;
  const yrs = S.horizon;
  // Payments vary over the term under a detailed rate schedule → show the range,
  // in whole dollars: a compact "$4k–$4k" would hide the very spread it reports
  const mPayTxt = payRangeText(mPaymentMin, mPaymentMax, mPayment);

  $('ownSummary').innerHTML = `
    <div class="tile"><div class="label">${T('tileNetEquity')} (${T('thYear')} ${yrs})</div><div class="value ${summary.ownNetEquity>=0?'pos':'neg'}">${fmt.currency(summary.ownNetEquity,true)}</div></div>
    <div class="tile"><div class="label">${T('tileAccumCost')} (${T('thYear')} ${yrs})</div><div class="value neg">${fmt.currency(summary.ownAccumCost,true)}</div></div>
    <div class="tile"><div class="label">${T('tileHouseEquity')} (${T('thYear')} ${yrs})</div><div class="value pos">${fmt.currency(summary.ownHouseEquity,true)}</div></div>
    <div class="tile"><div class="label">${T('tileLiquidCash')} (${T('thYear')} ${yrs})</div><div class="value">${fmt.currency(summary.ownCash,true)}</div></div>
    <div class="tile"><div class="label">${T('tileMonthlyMortgage')}</div><div class="value">${mPayTxt}</div></div>
    <div class="tile"><div class="label">${T('tilePrincipalRemaining')} (${T('thYear')} ${yrs})</div><div class="value">${fmt.currency(state.rows[state.rows.length-1].ownPrincipal,true)}</div></div>
  `;

  $('rentSummary').innerHTML = `
    <div class="tile"><div class="label">${T('tileNetEquity')} (${T('thYear')} ${yrs})</div><div class="value ${summary.rentNetEquity>=0?'pos':'neg'}">${fmt.currency(summary.rentNetEquity,true)}</div></div>
    <div class="tile"><div class="label">${T('tileAccumCost')} (${T('thYear')} ${yrs})</div><div class="value neg">${fmt.currency(summary.rentAccumCost,true)}</div></div>
    <div class="tile"><div class="label">${T('tileYearlyRent')} (${T('thYear')} 1)</div><div class="value">${fmt.currency(rentMonthly0*12,true)}</div></div>
    <div class="tile"><div class="label">${T('tileYearlyRent')} (${T('thYear')} ${yrs})</div><div class="value">${fmt.currency(state.rows[state.rows.length-1].rentRent,true)}</div></div>
    <div class="tile"><div class="label">${T('tileLiquidCash')} (${T('thYear')} 1)</div><div class="value">${fmt.currency(state.rows[1]?.rentCash||0,true)}</div></div>
    <div class="tile"><div class="label">${T('tileLiquidCash')} (${T('thYear')} ${yrs})</div><div class="value">${fmt.currency(summary.rentCash,true)}</div></div>
  `;
}

/* ── DETAIL TABLE ── */
function updateDetailTable(rows, rtbRows){
  const wrap = $('detailTableWrap');
  const na = '—';
  const c  = (v,compact=true) => fmt.currency(v,compact);
  const pos = cssVar('--data-pos-em'), neg = cssVar('--data-neg-em');
  let html = '';

  if(activeTable==='own'){
    html = `<table><thead>
      <tr>
        <th rowspan="2" class="th-sep-right">${T('thYear')}</th>
        <th colspan="8" class="th-group th-sep-right">${T('thCashPosition')}</th>
        <th colspan="4" class="th-group th-sep-right">${T('thMortgagePosition')}</th>
        <th colspan="2" class="th-group">${T('thFinancialPosition')}</th>
      </tr>
      <tr>
        <th>${T('thBegCash')}</th><th>${T('thAnnBudget')}</th><th>${T('thPrincipalExp')}</th><th>${T('thInterestExp')}</th><th>${T('thOngoingExp')}</th><th>${T('thInterestInc')}</th><th>${T('thSurplus')}</th><th class="th-sep-right">${T('thEndCash')}</th>
        <th>${T('thRate')}</th><th>${T('thPropValue')}</th><th>${T('thPrincipalLeft')}</th><th class="th-sep-right">${T('thHouseEquity')}</th>
        <th>${T('thNetEquity')}</th><th>${T('thAccumCost')}</th>
      </tr>
    </thead><tbody>`;
    rows.forEach(r=>{
      const y0 = r.year===0;
      const hasLoanYr = !y0 && ((r.ownYearInterest||0)>0 || (r.ownYearPrincipal||0)>0);
      html+=`<tr>
        <td class="td-sep-right">${r.year}</td>
        <td>${y0?na:c(r.ownBegCash||0)}</td>
        <td style="color:var(--accent)">${y0?na:c(r.ownYearBudget||0)}</td>
        <td style="color:${neg}">${y0?na:c(r.ownYearPrincipal||0)}</td>
        <td style="color:${neg}">${y0?na:c(r.ownYearInterest||0)}</td>
        <td style="color:${neg}">${y0?na:c(r.ownYearOngoing||0)}</td>
        <td style="color:${pos}">${y0?na:c(r.ownYearInterestInc||0)}</td>
        <td style="color:var(--gold)">${y0?na:c(r.ownYearSurplus||0)}</td>
        <td class="td-sep-right">${c(r.ownCash)}</td>
        <td>${hasLoanYr && r.ownRateYr!==undefined ? r.ownRateYr.toFixed(2)+'%' : na}</td>
        <td>${c(r.ownPropValue)}</td>
        <td>${c(r.ownPrincipal)}</td>
        <td class="td-sep-right" style="color:${pos}">${c(r.ownHouseEquity)}</td>
        <td style="color:${r.ownNetEquity>=0?pos:neg}">${c(r.ownNetEquity)}</td>
        <td style="color:${neg}">${c(r.ownAccumCost)}</td>
      </tr>`;
    });

  } else if(activeTable==='rent'){
    html = `<table><thead>
      <tr>
        <th rowspan="2" class="th-sep-right">${T('thYear')}</th>
        <th colspan="7" class="th-group th-sep-right">${T('thCashPosition')}</th>
        <th colspan="2" class="th-group">${T('thFinancialPosition')}</th>
      </tr>
      <tr>
        <th>${T('thBegCash')}</th><th>${T('thAnnBudget')}</th><th>${T('thRentExp')}</th><th>${T('thOngoingExp')}</th><th>${T('thInterestInc')}</th><th>${T('thSurplus')}</th><th class="th-sep-right">${T('thEndCash')}</th>
        <th>${T('thNetEquity')}</th><th>${T('thAccumCost')}</th>
      </tr>
    </thead><tbody>`;
    rows.forEach(r=>{
      const y0 = r.year===0;
      html+=`<tr>
        <td class="td-sep-right">${r.year}</td>
        <td>${y0?na:c(r.rentBegCash||0)}</td>
        <td style="color:var(--accent)">${y0?na:c(r.ownYearBudget||0)}</td>
        <td style="color:${neg}">${y0?na:c(r.rentRent||0)}</td>
        <td style="color:${neg}">${y0?na:c(r.rentYearOngoing||0)}</td>
        <td style="color:${pos}">${y0?na:c(r.rentYearInterestInc||0)}</td>
        <td style="color:var(--gold)">${y0?na:c(r.rentYearSurplus||0)}</td>
        <td class="td-sep-right">${c(r.rentCash)}</td>
        <td style="color:${pos}">${c(r.rentNetEquity)}</td>
        <td style="color:${neg}">${y0?na:c(r.rentAccumCost)}</td>
      </tr>`;
    });

  } else if(activeTable==='rtb' && rtbRows){
    html = `<table><thead>
      <tr>
        <th rowspan="2" class="th-sep-right">${T('thYear')}</th>
        <th rowspan="2" class="th-sep-right">${T('thPhase')}</th>
        <th colspan="10" class="th-group th-sep-right">${T('thCashPosition')}</th>
        <th colspan="4" class="th-group th-sep-right">${T('thMortgagePosition')}</th>
        <th colspan="2" class="th-group">${T('thFinancialPosition')}</th>
      </tr>
      <tr>
        <th>${T('thBegCash')}</th><th>${T('thAnnBudget')}</th><th>${T('thTotalExp')}</th><th>${T('thPrincipalExp')}</th><th>${T('thInterestExp')}</th><th>${T('thOngoingExp')}</th><th>${T('thInterestInc')}</th><th>${T('thSurplus')}</th><th>${T('thPurchaseOutlay')}</th><th class="th-sep-right">${T('thEndCash')}</th>
        <th>${T('thRate')}</th><th>${T('thPropValue')}</th><th>${T('thPrincipalLeft')}</th><th class="th-sep-right">${T('thHouseEquity')}</th>
        <th>${T('thNetEquity')}</th><th>${T('thAccumCost')}</th>
      </tr>
    </thead><tbody>`;
    rtbRows.forEach(r=>{
      const y0 = r.year===0;
      const phaseLabel = r.phase==='rent'?`<span class="ricon ricon-rent" aria-hidden="true"></span>${T('phaseRenting')}`: r.phase==='buy-transition'?T('phaseBought'):`<span class="ricon ricon-own" aria-hidden="true"></span>${T('phaseOwning')}`;
      const isOwning = r.phase!=='rent';
      const cash = r.phase==='rent' ? r.rtbCash||0 : r.rtbCash2||0;
      // Total expense = principal + interest + ongoing (for both renting and owning)
      const rtbTotalExp = (r.rtbYearPrincipal||0) + (r.rtbYearInterest||0) + (r.rtbYearOngoing||0);
      const rtbHasLoanYr = isOwning && r.rtbRateYr!==undefined && ((r.rtbYearInterest||0)>0 || (r.rtbYearPrincipal||0)>0);
      html+=`<tr>
        <td class="td-sep-right">${r.year}</td>
        <td class="td-sep-right">${phaseLabel}</td>
        <td>${y0?na:c(r.rtbBegCash||0)}</td>
        <td style="color:var(--accent)">${y0?na:c(r.rtbYearBudget||0)}</td>
        <td style="color:${neg}">${y0?na:c(rtbTotalExp)}</td>
        <td style="color:${neg}">${y0||!isOwning?na:c(r.rtbYearPrincipal||0)}</td>
        <td style="color:${neg}">${y0||!isOwning?na:c(r.rtbYearInterest||0)}</td>
        <td style="color:${neg}">${y0?na:c(r.rtbYearOngoing||0)}</td>
        <td style="color:${pos}">${y0?na:c(r.rtbYearInterestInc||0)}</td>
        <td style="color:var(--gold)">${y0?na:c(r.rtbYearSurplus||0)}</td>
        <td style="color:${neg}">${y0?na:c(r.rtbPurchaseOutlay||0)}</td>
        <td class="td-sep-right">${c(cash)}</td>
        <td>${rtbHasLoanYr ? r.rtbRateYr.toFixed(2)+'%' : na}</td>
        <td>${y0||!isOwning?na:c(r.rtbPropValue||0)}</td>
        <td>${y0||!isOwning?na:c(r.rtbPrincipal||0)}</td>
        <td class="td-sep-right" style="color:${pos}">${y0||!isOwning?na:c(r.rtbHouseEquity||0)}</td>
        <td style="color:${r.rtbNetEquity>=0?pos:neg}">${c(r.rtbNetEquity)}</td>
        <td style="color:${neg}">${y0?na:c(r.rtbAccumCost)}</td>
      </tr>`;
    });
  }

  html+='</tbody></table>';
  wrap.innerHTML = html;
  syncDetailHeaderLayout();
}

function syncDetailHeaderLayout(){
  const wrap = $('detailTableWrap');
  if(!wrap) return;
  const firstHeaderRow = wrap.querySelector('table thead tr:first-child');
  if(!firstHeaderRow) return;
  const h = Math.ceil(firstHeaderRow.getBoundingClientRect().height || 34);
  wrap.style.setProperty('--thead-row1-height', `${h}px`);
}

/* ── RTB SUMMARY ── */
function updateRTBSummary(state){
  if(!state.rtbRows) return;
  const {rows, rtbMPayment, rtbPropValueAtBuy, rtbSetupCostAtBuy, rtbDPAtBuy, rtbLoanAtBuy} = state.rtbRows;
  const last = rows[rows.length-1];
  const yrs = S.horizon;
  $('rtbSummary').innerHTML = `
    <div class="tile"><div class="label">${T('tileNetEquity')} (${T('thYear')} ${yrs})</div><div class="value ${last.rtbNetEquity>=0?'pos':'neg'}">${fmt.currency(last.rtbNetEquity,true)}</div></div>
    <div class="tile"><div class="label">${T('tileAccumCost')} (${T('thYear')} ${yrs})</div><div class="value neg">${fmt.currency(last.rtbAccumCost||0,true)}</div></div>
    <div class="tile"><div class="label">${T('tileHouseEquity')} (${T('thYear')} ${yrs})</div><div class="value pos">${fmt.currency(last.rtbHouseEquity||0,true)}</div></div>
    <div class="tile"><div class="label">${T('tileLiquidCash')} (${T('thYear')} ${yrs})</div><div class="value">${fmt.currency((last.rtbCash2||last.rtbCash||0),true)}</div></div>
    <div class="tile"><div class="label">${T('tilePropPriceAtBuy')} (${T('thYear')} ${S.rtbBuyYear})</div><div class="value">${fmt.currency(rtbPropValueAtBuy||0,true)}</div></div>
    <div class="tile"><div class="label">${T('tileMonthlyMortgage')}</div><div class="value">${payRangeText(state.rtbPaymentMin, state.rtbPaymentMax, rtbMPayment||0)}</div></div>
  `;
}

/* ── MAIN RERENDER ── */
function rerender(){
  readInputs();
  refreshLabels();
  const state = computeModel('mid');
  latestRows = state.rows;
  cachedRtbRows = state.rtbRows ? state.rtbRows.rows : null;

  // Merge RTB data into main rows for chart rendering
  if(state.rtbRows){
    const rtbByYear = {};
    state.rtbRows.rows.forEach(r=>{ rtbByYear[r.year]=r; });
    latestRows = latestRows.map(r=>{
      const rtbR = rtbByYear[r.year];
      if(rtbR){
        return Object.assign({}, r, {
          netEquityRTB: rtbR.netEquityRTB,
          cashRTB: rtbR.cashRTB,
          costRTB: rtbR.costRTB,
        });
      }
      return r;
    });
  }

  // Floating-rate band: simulate the full model at the min and max rate paths
  latestHasBand = scheduleHasFloat();
  if(latestHasBand){
    const lowState  = computeModel('low');
    const highState = computeModel('high');
    const bandKeys  = ['netEquityOwn','cashOwn','costOwn','netEquityRent','cashRent','costRent'];
    const lowRtbByYear = {}, highRtbByYear = {};
    if(lowState.rtbRows)  lowState.rtbRows.rows.forEach(r=>{ lowRtbByYear[r.year]=r; });
    if(highState.rtbRows) highState.rtbRows.rows.forEach(r=>{ highRtbByYear[r.year]=r; });
    latestRows = latestRows.map((r,i)=>{
      const o = Object.assign({}, r);
      bandKeys.forEach(k=>{
        o[k+'Low']  = lowState.rows[i][k];
        o[k+'High'] = highState.rows[i][k];
      });
      const lo = lowRtbByYear[r.year], hi = highRtbByYear[r.year];
      if(lo && hi){
        ['netEquityRTB','cashRTB','costRTB'].forEach(k=>{
          o[k+'Low'] = lo[k]; o[k+'High'] = hi[k];
        });
      }
      return o;
    });
    // Shortfall warnings cover every rate path, not just the mid one
    [lowState, highState].forEach(v=>{
      Object.keys(v.shortfalls).forEach(k=>{
        const a = state.shortfalls[k], b = v.shortfalls[k];
        if(b) state.shortfalls[k] = a ? {year: Math.min(a.year, b.year), worst: Math.min(a.worst, b.worst)} : b;
      });
    });
    // The repayment tiles span every repayment the band can reach, not just the mid path
    [lowState, highState].forEach(v=>{
      [['mPaymentMin','mPaymentMax'],['rtbPaymentMin','rtbPaymentMax']].forEach(([a,b])=>{
        if(v[b] > 0){
          state[a] = state[b] > 0 ? Math.min(state[a], v[a]) : v[a];
          state[b] = Math.max(state[b], v[b]);
        }
      });
    });
  }

  renderChart(latestRows);
  updateKPIs(state);
  updateSummary(state);
  updateDetailTable(latestRows, cachedRtbRows);
  // Show/hide RTB UI
  $('rtbParams').style.display = S.rtbEnabled ? 'block' : 'none';
  $('rtbSummarySection').style.display = S.rtbEnabled ? 'block' : 'none';
  $('rtbTableTab').style.display = S.rtbEnabled ? 'inline-block' : 'none';
  if(!S.rtbEnabled && activeTable==='rtb'){ activeTable='own'; document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active', b.dataset.table==='own')); }
  updateRTBSummary(state);
  if(persist) persist.schedule(); // rerender is the universal funnel — save any state change
}

/* ── RESET ── */
function resetAll(){
  S = JSON.parse(JSON.stringify(DEFAULTS));
  $('propertyPrice').value  = formatMoneyValue(DEFAULTS.propertyPrice);
  $('downPaymentPct').value = DEFAULTS.downPaymentPct;
  $('monthlyBudget').value  = formatMoneyValue(DEFAULTS.monthlyBudget);
  $('riskFreeRate').value   = DEFAULTS.riskFreeRate;
  $('horizon').value        = DEFAULTS.horizon;
  $('mortgageRate').value   = DEFAULTS.mortgageRate;
  $('mortgageTerm').value   = DEFAULTS.mortgageTerm;
  $('houseGrowth').value    = DEFAULTS.houseGrowth;
  $('sellingCostPct').value = DEFAULTS.sellingCostPct;
  $('setupCost').value      = formatMoneyValue(DEFAULTS.setupCost);
  $('setupCostType').value  = DEFAULTS.setupCostType;
  $('ownOngoingCost').value = formatMoneyValue(DEFAULTS.ownOngoingCost);
  $('ownOngoingCostFreq').value = DEFAULTS.ownOngoingCostFreq;
  $('ownOngoingCostType').value = DEFAULTS.ownOngoingCostType;
  $('rentAmount').value     = formatMoneyValue(DEFAULTS.rentAmount);
  $('rentFreq').value       = DEFAULTS.rentFreq;
  $('rentInflation').value  = DEFAULTS.rentInflation;
  $('rentOngoingCost').value= formatMoneyValue(DEFAULTS.rentOngoingCost);
  $('rentOngoingCostFreq').value = DEFAULTS.rentOngoingCostFreq;
  $('rentOngoingCostType').value = DEFAULTS.rentOngoingCostType;
  $('rentOngoingInflation').value= DEFAULTS.rentOngoingInflation;
  $('ownOngoingInflation').value = DEFAULTS.ownOngoingInflation;
  $('currencySymbol').value     = DEFAULTS.currencySymbol;
  currentCurrencySymbol         = DEFAULTS.currencySymbol;
  $('initialCash').value     = '';
  $('costInterestOnly').checked = DEFAULTS.costInterestOnly;
  $('rtbEnabled').checked   = DEFAULTS.rtbEnabled;
  $('rtbBuyYear').value     = DEFAULTS.rtbBuyYear;
  $('monthlyBudgetIncrease').value = DEFAULTS.monthlyBudgetIncrease;
  document.querySelector('input[name="mortgageType"][value="pi"]').checked=true;
  $('radioPI').classList.add('selected'); $('radioIO').classList.remove('selected');
  updateMortgageModeUI();
  renderRatePeriodRows();
  updateCostsModeUI();
  updateCagrToolVisibility(false);
  rerender();
}

/* ── APPLY CITY PRESET ──
   resetAll() first, so a city never inherits a field the last one did not set.
   It is also what lets the page do without a Reset button: every Quick Start is
   a full reset with a scenario laid on top, so any one of them already returns
   the form to a clean, known state. */
function applyPreset(cityKey){
  const p = CITY_PRESETS[cityKey];
  if(!p) return;

  resetAll();

  currentCurrencySymbol = p.currencySymbol;
  $('currencySymbol').value      = p.currencySymbol;
  $('propertyPrice').value       = formatMoneyValue(p.propertyPrice);
  $('downPaymentPct').value      = p.downPaymentPct;
  $('monthlyBudget').value       = formatMoneyValue(p.monthlyBudget);
  $('riskFreeRate').value        = p.riskFreeRate;
  $('horizon').value             = p.horizon;
  $('mortgageRate').value        = p.mortgageRate;
  $('mortgageTerm').value        = p.mortgageTerm;
  $('houseGrowth').value         = p.houseGrowth;
  $('sellingCostPct').value      = p.sellingCostPct;
  $('setupCost').value           = formatMoneyValue(p.setupCost);
  $('setupCostType').value       = p.setupCostType;
  $('ownOngoingCost').value      = formatMoneyValue(p.ownOngoingCost);
  $('ownOngoingCostFreq').value  = p.ownOngoingCostFreq;
  $('ownOngoingCostType').value  = p.ownOngoingCostType;
  $('ownOngoingInflation').value = p.ownOngoingInflation;
  $('rentAmount').value          = formatMoneyValue(p.rentAmount);
  $('rentFreq').value            = p.rentFreq;
  $('rentInflation').value       = p.rentInflation;
  $('rentOngoingCost').value     = formatMoneyValue(p.rentOngoingCost);
  $('rentOngoingCostFreq').value = p.rentOngoingCostFreq;
  $('rentOngoingCostType').value = p.rentOngoingCostType;
  $('rentOngoingInflation').value= p.rentOngoingInflation;
  $('initialCash').value         = '';
  $('costInterestOnly').checked  = p.costInterestOnly;
  $('rtbEnabled').checked        = p.rtbEnabled;
  $('rtbBuyYear').value          = p.rtbBuyYear;
  $('monthlyBudgetIncrease').value = p.monthlyBudgetIncrease;
  document.querySelectorAll('input[name="mortgageType"]').forEach(r=>{ r.checked = r.value===p.mortgageType; });
  $('radioPI').classList.toggle('selected', p.mortgageType==='pi');
  $('radioIO').classList.toggle('selected', p.mortgageType==='io');
  // City presets use the simple single-rate mortgage and simple costs
  S.mortgageMode = 'simple';
  S.ratePeriods = null;
  S.ownCostsMode = 'simple';
  S.rentCostsMode = 'simple';
  S.ownSetupCosts = null;
  S.ownOngoingCosts = null;
  S.rentOngoingCosts = null;
  /* Pull the preset off the form and into S BEFORE the detail rows are rebuilt.
     defaultRatePeriods() and defaultCostItems() seed themselves from S, so
     without this they would seed from whatever the previous scenario left
     behind and the advanced tabs would open on a rate and costs the chosen
     city never had. rerender() below calls this again; it is idempotent, and
     the modes above are already 'simple', so it cannot read the stale rows. */
  readInputs();
  updateMortgageModeUI();
  renderRatePeriodRows();
  updateCostsModeUI();

  document.querySelectorAll('.quick-start-btn').forEach(btn=>btn.classList.toggle('active', btn.dataset.city===cityKey));
  updateCagrToolVisibility(false);
  rerender();
}

/* ── PNG ── */
// Title + legend metadata for the current chart view, shared by the PNG/SVG/copy
// exporters. The heavy lifting (canvas/SVG composition, watermark) lives in the
// shared RVOExport module so the main tool and sensitivity tool export identically.
function chartExportMeta(){
  const chartTitleMap = {netEquity:'Rent vs Own — Net Equity Over Time', cash:'Rent vs Own — Liquid Cash Over Time', cost:'Rent vs Own — Accumulated Cost Over Time'};
  return {
    title: chartTitleMap[activeGraph] || 'Rent vs Own — Financial Comparison',
    // Read off the key on the page, so the export carries the same marks the
    // reader just saw — dashed two-colour line and shaded band included.
    legendItems: SharedLegend.itemsOf('chartLegend'),
  };
}
function downloadChartPng() {
  const src = document.getElementById('chartCanvas');
  const m = chartExportMeta();
  RVOExport.exportChartPNG(src, {title:m.title, legendItems:m.legendItems, filename:'rent_vs_own_chart.png', download:true});
}
async function copyChartPng() {
  try {
    const src = document.getElementById('chartCanvas');
    const m = chartExportMeta();
    await RVOExport.copyChartPNG(src, {title:m.title, legendItems:m.legendItems});
    alert('PNG copied to clipboard.');
  } catch(err){ alert('PNG copy failed: ' + err.message); }
}
function downloadChartSvg() {
  const src = document.getElementById('chartCanvas');
  const m = chartExportMeta();
  RVOExport.exportChartSVG(src, {title:m.title, legendItems:m.legendItems, filename:'rent_vs_own_chart.svg'});
}
$('pngBtn').addEventListener('click', downloadChartPng);
$('copyPngBtn').addEventListener('click', copyChartPng);
$('svgBtn').addEventListener('click', downloadChartSvg);

/* ── CSV ── (built by the shared RVOExport module so the main tool and the
   sensitivity tool emit byte-identical cashflow CSVs) */
function downloadCsv(){
  let csv, filename;
  if(activeTable==='own'){
    if(!latestRows.length) return;
    csv = RVOExport.ownCashflowCSV(latestRows); filename='own_cashflow.csv';
  } else if(activeTable==='rent'){
    if(!latestRows.length) return;
    csv = RVOExport.rentCashflowCSV(latestRows); filename='rent_cashflow.csv';
  } else if(activeTable==='rtb'){
    if(!cachedRtbRows||!cachedRtbRows.length) return;
    csv = RVOExport.rtbCashflowCSV(cachedRtbRows); filename='rent_then_buy_cashflow.csv';
  } else { return; }
  RVOExport.downloadCSV(filename, csv);
}

/* ── DETAILED MORTGAGE MODE UI ── */
// Default rate periods derived from the current single rate + term, used the
// first time a user switches to detailed mode.
function defaultRatePeriods(){
  const term = S.mortgageTerm;
  if(term <= 5){
    return [{toYear:term, type:'fixed', rate:S.mortgageRate, rateMin:S.mortgageRate, rateMax:S.mortgageRate+3}];
  }
  return [
    {toYear:5,    type:'fixed',    rate:S.mortgageRate,     rateMin:S.mortgageRate, rateMax:S.mortgageRate},
    {toYear:term, type:'floating', rate:S.mortgageRate+1.5, rateMin:S.mortgageRate, rateMax:S.mortgageRate+3},
  ];
}

function updateMortgageModeUI(){
  const detailed = S.mortgageMode === 'detailed';
  document.querySelectorAll('#mortgageModeGroup .seg-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.val === (detailed ? 'detailed' : 'simple'));
  });
  // Detailed-only controls
  $('mortgageTypeRow').style.display = detailed ? '' : 'none';
  $('rateScheduleRow').style.display = detailed ? '' : 'none';
  // The single-rate slider is only used in simple mode
  $('mortgageRateRow').style.display = detailed ? 'none' : '';
}

// Build the editable list of rate periods from S.ratePeriods.
function renderRatePeriodRows(){
  const wrap = $('ratePeriodRows');
  if(!wrap) return;
  if(!Array.isArray(S.ratePeriods) || !S.ratePeriods.length){
    S.ratePeriods = defaultRatePeriods();
  }
  wrap.innerHTML = '';
  S.ratePeriods.forEach((p,idx)=>{
    wrap.appendChild(buildRatePeriodRow(p, idx));
  });
  syncRatePeriodLabels();
}

function buildRatePeriodRow(p, idx){
  const row = document.createElement('div');
  row.className = 'rate-period-row';
  row.dataset.idx = idx;
  const isLast = idx === S.ratePeriods.length-1;
  const floating = p.type === 'floating';
  // The last period always stretches to the mortgage term, so its end is read-only
  // text; every other period ends where the reader types, inside the range itself.
  const end = isLast
    ? `<b class="rp-to-lbl">–</b>`
    : `<input type="number" class="rp-to" min="1" step="1" value="${p.toYear}" aria-label="${T('labelPeriodEnd')}" title="${T('labelPeriodEnd')}"/>`;
  row.innerHTML = `
    <div class="rp-head">
      <span class="rp-years">${T('labelYear')} <b class="rp-from">–</b><span class="rp-sep">–</span>${end}</span>
      <select class="sel-input rp-type">
        <option value="fixed"${!floating?' selected':''}>${T('optFixed')}</option>
        <option value="floating"${floating?' selected':''}>${T('optFloating')}</option>
      </select>
      <button type="button" class="btn-secondary btn-sm btn-icon rp-delete" ${S.ratePeriods.length<=1?'disabled':''} aria-label="${T('btnDelete')}" title="${T('btnDelete')}">✕</button>
    </div>
    <div class="rp-rates">
      <span class="rp-fixed-wrap" style="${floating?'display:none':''}">
        <input type="number" class="rp-rate" min="0" max="40" step="0.01" value="${(p.rate??0)}"/>
        <span class="rp-unit">${T('unitPctPa')}</span>
      </span>
      <span class="rp-float-wrap" style="${floating?'':'display:none'}">
        <input type="number" class="rp-min" min="0" max="40" step="0.01" value="${(p.rateMin??0)}"/>
        <span class="rp-dash">–</span>
        <input type="number" class="rp-max" min="0" max="40" step="0.01" value="${(p.rateMax??0)}"/>
        <span class="rp-unit">${T('unitPctPa')}</span>
      </span>
    </div>`;
  return row;
}

// Read the editable rows back into S.ratePeriods.
function readRatePeriodsFromDOM(){
  const rows = Array.from(document.querySelectorAll('#ratePeriodRows .rate-period-row'));
  const out = [];
  rows.forEach((row,i)=>{
    const type = row.querySelector('.rp-type').value;
    const toEl = row.querySelector('.rp-to');
    const toYear = toEl ? (parseIntSafe(toEl.value, S.mortgageTerm)) : S.mortgageTerm;
    const rate = parseFloatSafe(row.querySelector('.rp-rate')?.value, 0);
    const rateMin = parseFloatSafe(row.querySelector('.rp-min')?.value, 0);
    const rateMax = parseFloatSafe(row.querySelector('.rp-max')?.value, 0);
    out.push({toYear, type, rate, rateMin, rateMax});
  });
  S.ratePeriods = out;
}

// Recompute the "Yr X–Y" labels and disabled state shown on each period.
function syncRatePeriodLabels(){
  const wrap = $('ratePeriodRows');
  if(!wrap) return;
  const rows = Array.from(wrap.querySelectorAll('.rate-period-row'));
  const term = S.mortgageTerm;
  let from = 1;
  rows.forEach((row,i)=>{
    const isLast = i === rows.length-1;
    const toEl = row.querySelector('.rp-to');
    let to;
    if(isLast){ to = term; }
    else {
      to = parseIntSafe(toEl?.value, from);
      to = Math.min(term, Math.max(from, to));
    }
    const fromB = row.querySelector('.rp-from');
    const toB   = row.querySelector('.rp-to-lbl');
    if(fromB) fromB.textContent = from;
    if(toB)   toB.textContent = to;
    // Periods that start beyond the term are inactive
    row.classList.toggle('rp-beyond', from > term);
    from = to+1;
  });
}

function addRatePeriod(){
  readRatePeriodsFromDOM();
  const last = S.ratePeriods[S.ratePeriods.length-1] || {toYear:S.mortgageTerm, type:'fixed', rate:S.mortgageRate, rateMin:S.mortgageRate, rateMax:S.mortgageRate};
  // Insert a new period before the (auto-extending) last one, splitting the range.
  const prevTo = S.ratePeriods.length>=2 ? S.ratePeriods[S.ratePeriods.length-2].toYear : 0;
  const mid = Math.min(S.mortgageTerm-1, Math.max(prevTo+1, Math.round((prevTo + S.mortgageTerm)/2)));
  S.ratePeriods.splice(S.ratePeriods.length-1, 0, {
    toYear: mid, type:'fixed',
    rate:last.rate||S.mortgageRate, rateMin:last.rateMin||S.mortgageRate, rateMax:last.rateMax||S.mortgageRate,
  });
  renderRatePeriodRows();
  rerender();
}

function deleteRatePeriod(idx){
  readRatePeriodsFromDOM();
  if(S.ratePeriods.length <= 1) return;
  S.ratePeriods.splice(idx,1);
  renderRatePeriodRows();
  rerender();
}

/* ── DETAILED COSTS MODE UI ── */
// Config for the three editable cost lists. kind 'setup' items have basis
// fixed|pct; 'ongoing' items have basis weekly|monthly|yearly|pct + inflation.
const COST_LISTS = {
  ownSetup:    {rowsId:'ownSetupCostRows',   stateKey:'ownSetupCosts',   kind:'setup',   pctKey:'optPctBuyPrice'},
  ownOngoing:  {rowsId:'ownOngoingCostRows', stateKey:'ownOngoingCosts', kind:'ongoing', pctKey:'optPctPropertyValue'},
  rentOngoing: {rowsId:'rentOngoingCostRows',stateKey:'rentOngoingCosts',kind:'ongoing', pctKey:'optPctAnnualRent'},
};

// Seed detailed lists from the current simple inputs the first time the user
// switches modes, so results are identical at the moment of switching.
function defaultCostItems(key){
  if(key==='ownSetup')   return [{name:'', amount:S.setupCost, basis:S.setupCostType==='pct'?'pct':'fixed'}];
  if(key==='ownOngoing') return [{name:'', amount:S.ownOngoingCost, basis:S.ownOngoingCostType==='pct'?'pct':S.ownOngoingCostFreq, inflation:S.ownOngoingInflation}];
  return [{name:'', amount:S.rentOngoingCost, basis:S.rentOngoingCostType==='pct'?'pct':S.rentOngoingCostFreq, inflation:S.rentOngoingInflation}];
}

function ensureDetailedCostLists(side){
  const keys = side==='own' ? ['ownSetup','ownOngoing'] : ['rentOngoing'];
  keys.forEach(key=>{
    const sk = COST_LISTS[key].stateKey;
    if(!Array.isArray(S[sk]) || !S[sk].length) S[sk] = defaultCostItems(key);
  });
}

function updateCostsModeUI(){
  const ownDetailed  = S.ownCostsMode === 'detailed';
  const rentDetailed = S.rentCostsMode === 'detailed';
  document.querySelectorAll('#ownCostsModeGroup .seg-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.val === (ownDetailed ? 'detailed' : 'simple'));
  });
  document.querySelectorAll('#rentCostsModeGroup .seg-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.val === (rentDetailed ? 'detailed' : 'simple'));
  });
  $('ownCostsSimple').style.display    = ownDetailed ? 'none' : '';
  $('ownCostsDetailed').style.display  = ownDetailed ? '' : 'none';
  $('rentCostsSimple').style.display   = rentDetailed ? 'none' : '';
  $('rentCostsDetailed').style.display = rentDetailed ? '' : 'none';
}

function buildCostItemRow(key, item, idx, count){
  const cfg = COST_LISTS[key];
  const row = document.createElement('div');
  row.className = 'cost-item-row';
  row.dataset.idx = idx;
  const isPct = item.basis === 'pct';
  const sym = moneySymbol();
  const basisOpts = cfg.kind === 'setup'
    ? [['fixed', sym], ['pct', T(cfg.pctKey)]]
    : [['yearly', T('optPerYear')], ['monthly', T('optPerMonth')], ['weekly', T('optPerWeek')], ['pct', T(cfg.pctKey)]];
  const optsHtml = basisOpts.map(([v,l])=>`<option value="${v}"${item.basis===v?' selected':''}>${l}</option>`).join('');
  const inflHtml = cfg.kind === 'ongoing' ? `
    <div class="ci-line ci-infl-wrap" style="${isPct?'display:none':''}">
      <span class="ci-infl-label">${T('labelInflation')}</span>
      <input type="number" class="ci-infl" min="0" max="30" step="0.1" value="${Number(item.inflation)||0}"/>
      <span class="rp-unit">${T('unitPctPa')}</span>
    </div>` : '';
  row.innerHTML = `
    <div class="ci-head">
      <input type="text" class="ci-name" placeholder="${T('phCostName')}" value="${String(item.name||'').replace(/"/g,'&quot;')}"/>
      <button type="button" class="cagr-btn delete ci-delete" ${count<=1?'disabled':''} aria-label="${T('btnDelete')}" title="${T('btnDelete')}">✕</button>
    </div>
    <div class="ci-line">
      <div class="currency-wrap">
        <span class="prefix">${isPct?'%':sym}</span>
        <input class="currency-input money-input ci-amount" type="text" inputmode="numeric" value="${formatMoneyValue(item.amount||0)}"/>
      </div>
      <select class="ci-basis">${optsHtml}</select>
    </div>${inflHtml}`;
  // The period this row's amount was entered against, read back off the select
  // so an item that arrived without a basis records the one it actually shows.
  const basisSel = row.querySelector('.ci-basis');
  if(basisSel) basisSel.dataset.prev = basisSel.value;
  return row;
}

function renderCostItemRows(key){
  const cfg = COST_LISTS[key];
  const wrap = $(cfg.rowsId);
  if(!wrap) return;
  if(!Array.isArray(S[cfg.stateKey]) || !S[cfg.stateKey].length) S[cfg.stateKey] = defaultCostItems(key);
  wrap.innerHTML = '';
  S[cfg.stateKey].forEach((item,idx)=>{
    wrap.appendChild(buildCostItemRow(key, item, idx, S[cfg.stateKey].length));
  });
}

function readCostItemsFromDOM(key){
  const cfg = COST_LISTS[key];
  const rows = Array.from(document.querySelectorAll('#'+cfg.rowsId+' .cost-item-row'));
  if(!rows.length) return;
  S[cfg.stateKey] = rows.map(row=>{
    const item = {
      name:   row.querySelector('.ci-name')?.value || '',
      amount: Math.max(0, parseNum(row.querySelector('.ci-amount')?.value)),
      basis:  row.querySelector('.ci-basis')?.value || (cfg.kind==='setup'?'fixed':'yearly'),
    };
    if(cfg.kind === 'ongoing') item.inflation = Math.max(0, parseFloatSafe(row.querySelector('.ci-infl')?.value, 0));
    return item;
  });
}

function addCostItem(key){
  const cfg = COST_LISTS[key];
  readCostItemsFromDOM(key);
  if(!Array.isArray(S[cfg.stateKey])) S[cfg.stateKey] = defaultCostItems(key);
  S[cfg.stateKey].push(cfg.kind==='setup'
    ? {name:'', amount:0, basis:'fixed'}
    : {name:'', amount:0, basis:'yearly', inflation:0});
  renderCostItemRows(key);
  rerender();
}

function wireCostListEvents(key){
  const cfg = COST_LISTS[key];
  const wrap = $(cfg.rowsId);
  if(!wrap) return;
  /* Same rescaling as the simple fields above, one row at a time: the period a
     row's amount was entered against lives on the select, because the row is
     rebuilt from state rather than kept around. A move to or from the "% of
     value" basis is not a change of period, and SharedFreq.convert returns
     null for it, so the amount stays as typed. Registered before the handlers
     below, and on `input` as well as `change`, so the converted amount is in
     the row before either rerenders. */
  const convertBasis = e=>{
    const sel = e.target;
    if(!sel.classList || !sel.classList.contains('ci-basis')) return;
    const from = sel.dataset.prev, to = sel.value;
    sel.dataset.prev = to;
    if(from === to) return;
    const amt = sel.closest('.cost-item-row')?.querySelector('.ci-amount');
    if(!amt) return;
    const next = SharedFreq.convert(parseNum(amt.value), from, to, 2);
    if(next !== null) amt.value = formatMoneyValue(next);
  };
  wrap.addEventListener('input', convertBasis);
  wrap.addEventListener('change', convertBasis);
  wrap.addEventListener('click', e=>{
    const del = e.target.closest('.ci-delete');
    if(!del) return;
    readCostItemsFromDOM(key);
    const idx = parseInt(del.closest('.cost-item-row').dataset.idx);
    if(S[cfg.stateKey].length <= 1) return;
    S[cfg.stateKey].splice(idx,1);
    renderCostItemRows(key);
    rerender();
  });
  wrap.addEventListener('change', e=>{
    if(e.target.classList.contains('ci-basis')){
      const row = e.target.closest('.cost-item-row');
      const pct = e.target.value === 'pct';
      const pre = row.querySelector('.prefix');
      if(pre) pre.textContent = pct ? '%' : moneySymbol();
      const infl = row.querySelector('.ci-infl-wrap');
      if(infl) infl.style.display = pct ? 'none' : '';
    }
    rerender();
  });
  wrap.addEventListener('input', e=>{
    if(e.target.classList.contains('ci-amount')) SharedFmt.liveFormat(e.target, {maxDecimals:2});
    rerender();
  });
  wrap.addEventListener('blur', e=>{
    if(e.target.classList && e.target.classList.contains('ci-amount')) formatMoneyInput(e.target);
  }, true);
}

/* ── CAGR CALCULATOR ── */
function syncCagrDeleteButtons(){
  const rows = document.querySelectorAll('#cagrRows .cagr-row');
  rows.forEach(row=>{
    const btn = row.querySelector('.cagr-delete');
    if(btn) btn.disabled = rows.length <= 2;
  });
}
function buildCagrRow(year='', price=''){
  const row=document.createElement('div');
  row.className='cagr-row';
  row.innerHTML = `
    <input type="number" placeholder="Year e.g. 2020" class="cagr-year" value="${year}"/>
    <input type="text" inputmode="numeric" placeholder="Price e.g. 450,000" class="cagr-price money-input" data-money="true" value="${price}"/>
    <button class="cagr-btn delete cagr-delete" type="button" aria-label="${T('btnDelete')}" title="${T('btnDelete')}">✕</button>
  `;
  const priceEl = row.querySelector('.cagr-price');
  formatMoneyInput(priceEl);
  priceEl.addEventListener('input', ()=>{ SharedFmt.liveFormat(priceEl, {maxDecimals:2}); });
  priceEl.addEventListener('blur', ()=>{ formatMoneyInput(priceEl); rerender(); });
  return row;
}
function calcCAGR(){
  const pairs = Array.from(document.querySelectorAll('#cagrRows .cagr-row'))
    .map(row=>({
      y: parseFloat(row.querySelector('.cagr-year')?.value),
      p: parseNum(row.querySelector('.cagr-price')?.value)
    }))
    .filter(item=>!isNaN(item.y) && item.p>0);

  if(pairs.length < 2){ $('cagrResult').textContent=T('cagrNeedPoints'); return; }

  pairs.sort((a,b)=>a.y-b.y);
  const first=pairs[0], last=pairs[pairs.length-1];
  const n=last.y-first.y;
  if(n<=0){ $('cagrResult').textContent=T('cagrEndYearError'); return; }

  const cagr=(Math.pow(last.p/first.p, 1/n)-1)*100;
  $('cagrResult').textContent=T('cagrResult')(cagr.toFixed(2));
  $('houseGrowth').value=cagr.toFixed(2);
  rerender();
}
function updateCagrToolVisibility(show){
  const wrap = $('cagrToolWrap');
  const btn = $('cagrToolToggle');
  if(!wrap || !btn) return;
  wrap.style.display = show ? 'grid' : 'none';
  btn.textContent = show ? T('btnHideTool') : T('btnShowTool');
}

/* ── EVENTS ── */
/* An amount entered against one frequency is rescaled when that frequency
   moves, so $2,800 a month becomes $646.15 a week rather than quietly turning
   into a quarter of the rent. Wired first, so the amount in the field is
   already the converted one by the time the rerender below reads the form.
   A cost switched to a "% of value" basis is not money per period, so its
   frequency is left alone while that basis is selected. */
[['ownOngoingCost','ownOngoingCostFreq','ownOngoingCostType'],
 ['rentAmount','rentFreq',null],
 ['rentOngoingCost','rentOngoingCostFreq','rentOngoingCostType']
].forEach(([amountId, freqId, typeId])=>{
  SharedFreq.attachSelect($(freqId), $(amountId), {
    maxDecimals: 2,
    format: formatMoneyValue,
    skip: typeId ? (()=>$(typeId).value === 'pct') : null
  });
});

['propertyPrice','downPaymentPct','monthlyBudget','riskFreeRate','horizon',
 'mortgageRate','mortgageTerm','houseGrowth','sellingCostPct','setupCost','setupCostType',
 'ownOngoingCost','ownOngoingCostFreq','ownOngoingCostType','ownOngoingInflation',
 'rentAmount','rentFreq','rentInflation','rentOngoingCost','rentOngoingCostFreq','rentOngoingCostType','rentOngoingInflation',
 'rtbBuyYear','monthlyBudgetIncrease','initialCash','currencySymbol'
].forEach(id=>{
  const el=$(id); if(!el) return;
  ['input','change'].forEach(ev=>el.addEventListener(ev, ()=>{
    if(el.matches('[data-money="true"]') && ev==='change') formatMoneyInput(el);
    rerender();
  }));
});

$('rtbEnabled').addEventListener('change', rerender);
$('costInterestOnly').addEventListener('change', rerender);

document.querySelectorAll('[data-money="true"]').forEach(el=>{
  el.addEventListener('input', ()=>{ SharedFmt.liveFormat(el, {maxDecimals:2}); });
  el.addEventListener('blur', ()=>{ formatMoneyInput(el); rerender(); });
});

document.querySelectorAll('input[name="mortgageType"]').forEach(r=>{
  r.addEventListener('change',()=>{
    document.querySelectorAll('.radio-opt').forEach(o=>o.classList.remove('selected'));
    r.closest('.radio-opt').classList.add('selected');
    rerender();
  });
});

// Mortgage mode segmented control (Simple / Detailed)
document.querySelectorAll('#mortgageModeGroup .seg-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const mode = btn.dataset.val;
    if(mode === S.mortgageMode) return;
    S.mortgageMode = mode;
    if(mode === 'detailed' && (!Array.isArray(S.ratePeriods) || !S.ratePeriods.length)){
      S.ratePeriods = defaultRatePeriods();
    }
    updateMortgageModeUI();
    if(mode === 'detailed') renderRatePeriodRows();
    rerender();
  });
});

// Costs mode segmented controls (Simple / Detailed)
[['ownCostsModeGroup','ownCostsMode','own'],['rentCostsModeGroup','rentCostsMode','rent']].forEach(([groupId, modeKey, side])=>{
  document.querySelectorAll('#'+groupId+' .seg-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const mode = btn.dataset.val;
      if(mode === S[modeKey]) return;
      S[modeKey] = mode;
      if(mode === 'detailed'){
        ensureDetailedCostLists(side);
        if(side==='own'){ renderCostItemRows('ownSetup'); renderCostItemRows('ownOngoing'); }
        else { renderCostItemRows('rentOngoing'); }
      }
      updateCostsModeUI();
      rerender();
    });
  });
});

// Detailed costs: add items
$('addOwnSetupCost').addEventListener('click', ()=>addCostItem('ownSetup'));
$('addOwnOngoingCost').addEventListener('click', ()=>addCostItem('ownOngoing'));
$('addRentOngoingCost').addEventListener('click', ()=>addCostItem('rentOngoing'));
Object.keys(COST_LISTS).forEach(wireCostListEvents);

// Rate schedule: add a period
$('addRatePeriod').addEventListener('click', addRatePeriod);

// Rate schedule: edit / delete / change type (event delegation)
$('ratePeriodRows').addEventListener('click',(e)=>{
  const del = e.target.closest('.rp-delete');
  if(del){
    const row = del.closest('.rate-period-row');
    deleteRatePeriod(parseInt(row.dataset.idx));
  }
});
$('ratePeriodRows').addEventListener('change',(e)=>{
  if(e.target.classList.contains('rp-type')){
    // Toggle fixed/floating inputs for this row, then recompute
    const row = e.target.closest('.rate-period-row');
    const floating = e.target.value === 'floating';
    row.querySelector('.rp-fixed-wrap').style.display = floating ? 'none' : '';
    row.querySelector('.rp-float-wrap').style.display = floating ? '' : 'none';
  }
  rerender();
});
$('ratePeriodRows').addEventListener('input',(e)=>{
  if(e.target.classList.contains('rp-to')) syncRatePeriodLabels();
  rerender();
});

document.querySelectorAll('.ctrl-tab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.ctrl-tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.ctrl-panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    $('tab-'+btn.dataset.tab).classList.add('active');
  });
});

document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    activeTable=btn.dataset.table;
    const state = { rows: latestRows, rtbRows: null };
    // Re-derive rtbRows from latestRows is complex — just call updateDetailTable with cached rtbRows
    if(latestRows.length) updateDetailTable(latestRows, cachedRtbRows);
  });
});

document.querySelectorAll('.graph-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.graph-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    activeGraph=btn.dataset.graph;
    if(latestRows.length){ renderChart(latestRows); }
  });
});

document.querySelectorAll('.quick-start-btn').forEach(btn=>btn.addEventListener('click', ()=>applyPreset(btn.dataset.city)));
$('downloadBtn').addEventListener('click', downloadCsv);
$('chartResetZoom').addEventListener('click',()=>{ if(chartInstance) chartInstance.resetZoom(); });
$('themeToggle').addEventListener('click',()=>{
  document.body.classList.toggle('light');
  $('themeToggle').textContent = document.body.classList.contains('light') ? '🌙 Dark' : '☀️ Light';
  localStorage.setItem('pf-theme', document.body.classList.contains('light') ? 'light' : 'dark');
  syncDetailHeaderLayout();
  if(latestRows.length) renderChart(latestRows);
});
// Apply persisted theme on load (body defaults to light; remove class if stored dark)
if(localStorage.getItem('pf-theme')==='dark'){document.body.classList.remove('light');$('themeToggle').textContent='☀️ Light';}
window.addEventListener('resize', syncDetailHeaderLayout);
$('chartCanvas').addEventListener('mouseleave',()=>{ $('hoverBox').textContent='Hover over the chart to inspect a year.'; });
$('cagrCalc').addEventListener('click', calcCAGR);
$('cagrToolToggle').addEventListener('click',()=>{
  const show = $('cagrToolWrap').style.display === 'none';
  updateCagrToolVisibility(show);
});
$('cagrAddRow').addEventListener('click',()=>{
  $('cagrRows').appendChild(buildCagrRow());
  syncCagrDeleteButtons();
});
$('cagrRows').addEventListener('click',(e)=>{
  const btn = e.target.closest('.cagr-delete');
  if(!btn) return;
  const rows = document.querySelectorAll('#cagrRows .cagr-row');
  if(rows.length <= 2) return;
  btn.closest('.cagr-row')?.remove();
  syncCagrDeleteButtons();
});
$('cagrRows').addEventListener('blur',(e)=>{
  const input = e.target.closest('.cagr-price');
  if(!input) return;
  formatMoneyInput(input);
}, true);

/* ── SLIDER EDITABLE ── */
function makeSliderEditable(valSpan,rangeEl){
  if(!valSpan||!rangeEl)return;
  const inp=document.createElement('input');
  inp.type='text';inp.className='slider-val-edit';
  valSpan.parentNode.insertBefore(inp,valSpan.nextSibling);
  valSpan.addEventListener('click',()=>{
    inp.value=parseFloat(rangeEl.value);
    valSpan.style.display='none';inp.style.display='inline';
    inp.focus();inp.select();
  });
  function commit(){
    const raw=parseFloat(inp.value);
    if(!isNaN(raw)){
      const mn=parseFloat(rangeEl.min),mx=parseFloat(rangeEl.max),st=parseFloat(rangeEl.step)||1;
      const v=+(Math.round(Math.min(mx,Math.max(mn,raw))/st)*st).toFixed(10);
      rangeEl.value=v;
      rangeEl.dispatchEvent(new Event('input',{bubbles:true}));
      rangeEl.dispatchEvent(new Event('change',{bubbles:true}));
    }
    inp.style.display='none';valSpan.style.display='';
  }
  inp.addEventListener('blur',commit);
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();inp.blur();}else if(e.key==='Escape'){inp.value='';commit();}});
}
[['riskFreeRate','riskFreeRateVal'],['monthlyBudgetIncrease','monthlyBudgetIncreaseVal'],
 ['horizon','horizonVal'],['rtbBuyYear','rtbBuyYearVal'],['downPaymentPct','downPaymentPctVal'],
 ['mortgageRate','mortgageRateVal'],['mortgageTerm','mortgageTermVal'],['houseGrowth','houseGrowthVal'],['sellingCostPct','sellingCostPctVal'],
 ['ownOngoingInflation','ownOngoingInflationVal'],['rentInflation','rentInflationVal'],
 ['rentOngoingInflation','rentOngoingInflationVal']
].forEach(([rid,vid])=>makeSliderEditable($(vid),$(rid)));

/* ── INIT ── */
// Populate data-tip from centralised RVO_TIPS (tooltips.js)
if(window.RVO_APPLY_TIPS) RVO_APPLY_TIPS(RVO_TIPS);
applyLang();
syncMoneyInputs();
syncCagrDeleteButtons();
updateCagrToolVisibility(false);
updateMortgageModeUI();
updateCostsModeUI();
rerender();

/* The page has no Reset button — every Quick Start city already opens with a
   full resetAll() — but the audit harness still needs a documented way back to
   the default model before it checks the engine against its replay. */
window.__RVO = { resetAll: resetAll };

/* ── Mini cache ────────────────────────────────────────────────────────────
   Persist the scalar inputs (form controls, read back into S by readInputs)
   plus the parts of S that live only in JS — the mortgage/costs modes and the
   editable rate-period and cost-item collections — so a returning user keeps
   their full model. */
persist = Persist.init('rentvsownhouse', {
  onRestore: function(){
    updateMortgageModeUI();
    renderRatePeriodRows();
    updateCostsModeUI();
    rerender();
  },
  extra: {
    save: function(){
      return {
        mortgageMode: S.mortgageMode, ratePeriods: S.ratePeriods,
        ownCostsMode: S.ownCostsMode, rentCostsMode: S.rentCostsMode,
        ownSetupCosts: S.ownSetupCosts, ownOngoingCosts: S.ownOngoingCosts,
        rentOngoingCosts: S.rentOngoingCosts
      };
    },
    restore: function(e){
      if(!e || typeof e !== 'object') return;
      ['mortgageMode','ratePeriods','ownCostsMode','rentCostsMode',
       'ownSetupCosts','ownOngoingCosts','rentOngoingCosts'].forEach(function(k){
        if(e[k] !== undefined) S[k] = e[k];
      });
    }
  }
});
// One namespace for the English and Indonesian pages, so a file saved on one
// opens on the other.
SharedScenario.mount('.quick-start-row', { tool: 'rentvsownhouse', persist: persist });

})();
