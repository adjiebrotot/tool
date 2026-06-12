(function(){
"use strict";

// Watermark logo (logos/logo.svg), preloaded for use in canvas/SVG exports
const WM_LOGO_SRC = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDY4MCA2ODAiIHJvbGU9ImltZyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8dGl0bGU+QXJjaGVkIEEgTG9nbzwvdGl0bGU+CiAgPGRlc2M+QSBzbGVlayB3aGl0ZSBsZXR0ZXIgQSB3aG9zZSBsZWdzIGZvbGxvdyB0aGUgY2lyY2xlIGN1cnZhdHVyZSwgc3Bhbm5pbmcgODAlIG9mIHRoZSBjaXJjbGUgaGVpZ2h0PC9kZXNjPgoKICA8Y2lyY2xlIGN4PSIzNDAiIGN5PSIzNDAiIHI9IjMwMCIgZmlsbD0iIzAwNTJjYyIvPgoKICA8IS0tIExlZnQgbGVnOiAxMTPCsCB0byAyNDXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyNDIsNTcwIEEgMjUwLDI1MCAwIDAgMSAyMzQsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFRvcCBhcmNoOiAyNDXCsCB0byAyOTXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyMzQsMTEzIEEgMjUwLDI1MCAwIDAgMSA0NDYsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFJpZ2h0IGxlZzogMjk1wrAgdG8gNjfCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSA0NDYsMTEzIEEgMjUwLDI1MCAwIDAgMSA0MzgsNTcwIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIENyb3NzYmFyIC0tPgogIDxsaW5lIHgxPSIxMTMiIHkxPSIzNTQiIHgyPSI1NjciIHkyPSIzNTQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNDIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K';
const wmLogoImg = new Image();
wmLogoImg.src = WM_LOGO_SRC;
const _wmMeasureCtx = document.createElement('canvas').getContext('2d');
function measureWmText(text, font){ _wmMeasureCtx.font = font; return _wmMeasureCtx.measureText(text).width; }

/* ── i18n ── */
let lang = (window.DEFAULT_LANG === 'id') ? 'id' : 'en';
const LANG = {
  en: {
    /* header */
    subtitle: 'Model the long-term financial outcome of renting vs buying property — comparing cash, equity, and net wealth over time.',
    btnBack: '← Other Tools',
    sensitivityHtml: 'Power user? Compare multiple scenarios side-by-side with our <a href="/rentvsownhouse/sensitivity/" style="color:var(--accent);font-weight:700;text-decoration:none;">Sensitivity Analysis Tool</a>.',
    /* sidebar */
    quickStartLabel: '⚡ Quick Start',
    quickStartTip: 'Prefill with quick assumption, assuming median price for two-bedroom apartment in the city centre or inner suburbs',
    tabGeneral: '🌐 General',
    tabOwn: '🏡 Own',
    tabRent: '🏢 Rent',
    sectionCash: 'Cash',
    labelRiskFreeRate: 'Risk-Free Rate',
    unitPctPa: '% p.a.',
    helpRiskFreeRate: 'Rate at which surplus cash (not used for rent/mortgage) compounds annually.',
    labelInitialCash: 'Initial Cash',
    labelOptional: '(optional)',
    subInitialCashDefault: 'Defaults to down payment + setup cost. Any excess is invested at the risk-free rate.',
    labelMonthlyBudget: 'Monthly Housing Budget',
    subMonthlyBudget: 'If 0, auto-set to the higher of rent or mortgage payment. Leftover invested at risk-free rate.',
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
    helpBuyAtYear: 'Switch from renting to buying at this year. Property price grows at RPPI until then.',
    sectionProperty: 'Property',
    labelPropertyPrice: 'Property Price',
    subPropertyPrice: 'Purchase price of the property.',
    labelDownPayment: 'Down Payment',
    helpDownPaymentPrefix: 'Down payment = ',
    unitPctOfPrice: '% of property price',
    sectionMortgage: 'Mortgage',
    labelMortgageType: 'Mortgage Type',
    labelPI: 'Principal & Interest',
    helpPI: 'Pay down loan each period; builds equity faster.',
    labelIO: 'Interest Only',
    helpIO: 'Pay only interest; principal unchanged until term ends.',
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
    labelYr: 'Yr',
    helpRateSchedule: 'Periods always cover years 1 to the mortgage term — the last period extends automatically. Floating periods show a min–max band on the chart; lines use the band midpoint.',
    sectionPropertyGrowth: 'Property Growth',
    labelHouseGrowth: 'House Price Growth (RPPI)',
    helpRPPIRate: 'Residential Property Price Index annual growth rate.',
    labelCalcCAGR: 'Calculate CAGR from Historical Prices',
    btnShowTool: 'Show Tool',
    btnHideTool: 'Hide Tool',
    btnDelete: 'Delete',
    btnAddRow: '+ Row',
    btnCalcCAGR: 'Calc CAGR →',
    helpCagrPairs: 'Enter year & price pairs — CAGR will be applied to the House Price Growth slider above.',
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
    helpSetupCostsDetailed: 'One-time costs at purchase. % items are computed on the buy price at purchase time (incl. Rent-Then-Buy).',
    helpOwnCostsDetailed: 'Fixed amounts grow at their own inflation rate; % items track the property value.',
    helpRentCostsDetailed: 'Fixed amounts grow at their own inflation rate; % items track the annual rent.',
    labelSetupCost: 'Setup Cost (Stamp Duty, Legal, etc.)',
    optDollar: '$',
    helpSetupCost: 'One-time cost at purchase (added to initial outlay, not loan).',
    labelOwnOngoing: 'Ongoing Costs of Owning',
    optYearly: 'Yearly',
    optMonthly: 'Monthly',
    optWeekly: 'Weekly',
    optFixedAmount: 'Fixed $ amount',
    optPctPropertyValue: '% of property value',
    helpOwnOngoing: 'Council rates, insurance, maintenance, lawn, etc.',
    labelOwnInflation: 'Own Ongoing Cost Inflation',
    helpOwnInflation: 'E.g. 3% means council rates and maintenance grow 3% per year.',
    sectionRentalPayments: 'Rental Payments',
    labelRentAmount: 'Rent Amount',
    rentPrefix: 'Rent = ',
    perMo: '/mo',
    labelRentInflation: 'Rent Inflation',
    helpRentInflation: 'Annual rate at which rent grows.',
    sectionCostsRenting: 'Costs of Renting',
    labelRentOngoing: 'Ongoing Costs of Renting',
    optPctAnnualRent: '% of annual rent',
    helpRentOngoing: 'Contents insurance, extra costs renters bear (no council rates, no maintenance).',
    labelRentOngoingInflation: 'Rent Ongoing Cost Inflation',
    helpRentOngoingInflation: 'E.g. 2% means contents insurance grows 2% per year.',
    btnReset: '↺ Reset',
    labelCurrencySymbol: 'Currency Symbol',
    /* KPI */
    kpiInitialCashLabel: 'Initial Cash',
    kpiInitialCashTip: 'The starting cash used in both scenarios. If left blank in inputs, this is auto-calculated from down payment + setup requirements (and RTB needs when enabled).',
    kpiInitialCashSub: 'Starting capital at Year 0',
    kpiBudgetLabel: 'Yearly Housing Budget',
    kpiBudgetTip: 'The monthly housing budget range used across the modeled years, shown from minimum to maximum (e.g., $1k–$5k).',
    kpiBudgetSub: 'Min–max monthly budget over horizon',
    kpiBreakevenLabel: 'Breakeven Year',
    kpiBreakevenTip: "The first year when the Buy scenario's net equity (house equity + cash) overtakes the pure Rent scenario's invested savings. Before this year, renting produces higher net wealth.",
    kpiBreakevenSub: 'When owning net equity overtakes renting',
    kpiDiffLabel: 'Equity Difference',
    kpiDiffTip: 'Own Net Equity minus Rent Net Equity at the final year. Positive (green) means buying wins; negative (red) means renting & investing wins over the chosen time horizon.',
    kpiDiffSub: 'Own minus Rent at final year',
    /* chart */
    chartTitle: 'Comparison',
    btnNetEquity: 'Net Equity',
    btnLiquidCash: 'Liquid Cash',
    btnAccumCost: 'Accum. Cost',
    btnZoom: '⟳',
    chartHoverHint: 'Hover over the chart to inspect a year.',
    /* summary */
    ownSnapshotTitle: '🏡 Own — Snapshot',
    ownSnapshotTip: 'Summary of the Buy scenario at the final year of the time horizon.',
    rentSnapshotTitle: '🏢 Rent — Snapshot',
    rentSnapshotTip: 'Summary of the pure Rent scenario at the final year of the time horizon.',
    rtbSnapshotTitle: '🔄 Rent-Then-Buy — Snapshot',
    rtbSnapshotTip: 'Summary of the Rent-Then-Buy scenario. Before the buy year, cashflows match the rent scenario. At the buy year, accumulated savings fund the down payment on the then-market-price property, and a new mortgage begins.',
    /* detail tabs */
    tabOwnCashflow: '🏡 Own Cashflow',
    tabRentCashflow: '🏢 Rent Cashflow',
    tabRTBCashflow: '🔄 Rent-Then-Buy Cashflow',
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
    /* dynamic messages */
    kpiBreakevenYear: 'Year ',
    subInitialCashLeftover: (x) => `Leftover ${x} invested at risk-free rate from day one.`,
    subInitialCashExact: 'Exactly covers down payment + setup cost — no surplus.',
    subInitialCashAuto: (x) => `Auto: ${x} (down payment + setup cost). Any excess is invested at the risk-free rate.`,
    subInitialCashRTB: (x,y,z,n) => `Auto: ${x} (raised from ${y} to cover RTB future purchase of ${z} at Yr ${n}).`,
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
    thInterestInc: 'Interest Inc.',
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
    phaseRenting: '🏢 Renting',
    phaseBought: '🔄 Bought',
    phaseOwning: '🏡 Owning',
    /* chart tooltip */
    chartTooltipYear: 'Year ',
  },
  id: {
    /* header */
    subtitle: 'Modelkan hasil keuangan jangka panjang dari menyewa vs membeli properti — membandingkan kas, ekuitas, dan kekayaan bersih dari waktu ke waktu.',
    btnBack: '← Other Tools',
    sensitivityHtml: 'Power user? Bandingkan beberapa skenario secara berdampingan dengan <a href="/rentvsownhouse/sensitivity/id/" style="color:var(--accent);font-weight:700;text-decoration:none;">Alat Analisis Sensitivitas</a> kami.',
    /* sidebar */
    quickStartLabel: '⚡ Mulai Cepat',
    quickStartTip: 'Isi otomatis dengan asumsi cepat berdasarkan harga median apartemen 2 kamar di pusat kota atau pinggiran kota',
    tabGeneral: '🌐 Umum',
    tabOwn: '🏡 Beli',
    tabRent: '🏢 Sewa',
    sectionCash: 'Kas',
    labelRiskFreeRate: 'Suku Bunga Bebas Risiko',
    unitPctPa: '%/tahun',
    helpRiskFreeRate: 'Tingkat return kas yang tidak terpakai (di atas biaya sewa/KPR) yang berbunga setiap tahunnya.',
    labelInitialCash: 'Modal Awal',
    labelOptional: '(opsional)',
    subInitialCashDefault: 'Default ke Uang Muka (DP) + biaya awal pembelian. Kelebihan diinvestasikan pada suku bunga bebas risiko.',
    labelMonthlyBudget: 'Anggaran Rumah Bulanan',
    subMonthlyBudget: 'Jika 0, otomatis disesuaikan dengan cicilan KPR atau biaya sewa tertinggi. Sisa diinvestasikan pada suku bunga bebas risiko.',
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
    helpBuyAtYear: 'Beralih dari menyewa ke membeli di tahun ini. Harga properti tumbuh sesuai RPPI hingga saat itu.',
    sectionProperty: 'Properti',
    labelPropertyPrice: 'Harga Properti',
    subPropertyPrice: 'Harga beli properti.',
    labelDownPayment: 'Uang Muka (DP)',
    helpDownPaymentPrefix: 'Uang Muka (DP) = ',
    unitPctOfPrice: '% dari harga properti',
    sectionMortgage: 'KPR',
    labelMortgageType: 'Jenis KPR',
    labelPI: 'Pokok & Bunga',
    helpPI: 'Cicilan mengurangi bunga dan saldo pinjaman setiap periode; ekuitas bertambah lebih cepat.',
    labelIO: 'Bunga Saja',
    helpIO: 'Hanya membayar bunga; pokok pinjaman tidak berubah hingga akhir jangka waktu.',
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
    labelYr: 'Thn',
    helpRateSchedule: 'Periode selalu mencakup tahun 1 hingga akhir jangka waktu KPR, dengan periode terakhir diperpanjang secara otomatis. Periode mengambang menampilkan pita min–maks pada grafik; garis menggunakan titik tengah pita.',
    sectionPropertyGrowth: 'Pertumbuhan Properti',
    labelHouseGrowth: 'Kenaikan Harga Properti (RPPI)',
    helpRPPIRate: 'Tingkat pertumbuhan tahunan Indeks Harga Properti Residensial.',
    labelCalcCAGR: 'Hitung CAGR dari Harga Historis',
    btnShowTool: 'Tampilkan Alat',
    btnHideTool: 'Sembunyikan Alat',
    btnDelete: 'Hapus',
    btnAddRow: '+ Baris',
    btnCalcCAGR: 'Hitung CAGR →',
    helpCagrPairs: 'Masukkan pasangan tahun & harga — CAGR akan diterapkan pada slider Kenaikan Harga Properti di atas.',
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
    helpSetupCostsDetailed: 'Biaya satu kali saat pembelian. Item % dihitung dari harga beli pada saat transaksi (termasuk Sewa Dulu, Beli Kemudian).',
    helpOwnCostsDetailed: 'Jumlah tetap tumbuh sesuai inflasinya masing-masing; item % mengikuti nilai properti.',
    helpRentCostsDetailed: 'Jumlah tetap tumbuh sesuai inflasinya masing-masing; item % mengikuti sewa tahunan.',
    labelSetupCost: 'Biaya Awal Pembelian (BPHTB, Notaris, dll.)',
    optDollar: '$',
    helpSetupCost: 'Biaya satu kali saat pembelian (ditambahkan ke modal awal, bukan pinjaman).',
    labelOwnOngoing: 'Biaya Rutin Kepemilikan',
    optYearly: 'Tahunan',
    optMonthly: 'Bulanan',
    optWeekly: 'Mingguan',
    optFixedAmount: 'Jumlah Tetap',
    optPctPropertyValue: '% dari Nilai Properti',
    helpOwnOngoing: 'PBB, asuransi, perawatan, kebersihan, dll.',
    labelOwnInflation: 'Inflasi Biaya Rutin Kepemilikan',
    helpOwnInflation: 'Misal 3% berarti PBB dan biaya perawatan naik 3% per tahun.',
    sectionRentalPayments: 'Pembayaran Sewa',
    labelRentAmount: 'Biaya Sewa',
    rentPrefix: 'Sewa = ',
    perMo: '/bln',
    labelRentInflation: 'Kenaikan Sewa Tahunan',
    helpRentInflation: 'Tingkat kenaikan sewa per tahun.',
    sectionCostsRenting: 'Biaya Menyewa',
    labelRentOngoing: 'Biaya Rutin Menyewa',
    optPctAnnualRent: '% dari Sewa Tahunan',
    helpRentOngoing: 'Asuransi isi rumah, biaya tambahan penyewa (tidak termasuk PBB dan perawatan gedung).',
    labelRentOngoingInflation: 'Inflasi Biaya Rutin Menyewa',
    helpRentOngoingInflation: 'Misal 2% berarti asuransi isi rumah naik 2% per tahun.',
    btnReset: '↺ Atur Ulang',
    labelCurrencySymbol: 'Simbol Mata Uang',
    /* KPI */
    kpiInitialCashLabel: 'Modal Awal',
    kpiInitialCashTip: 'Kas awal yang digunakan di kedua skenario. Jika dikosongkan, dihitung otomatis dari Uang Muka (DP) + biaya awal pembelian (dan kebutuhan Sewa Dulu jika diaktifkan).',
    kpiInitialCashSub: 'Modal awal di Tahun 0',
    kpiBudgetLabel: 'Anggaran Perumahan Tahunan',
    kpiBudgetTip: 'Rentang anggaran perumahan bulanan selama periode yang dimodelkan, dari minimum hingga maksimum.',
    kpiBudgetSub: 'Anggaran bulanan min–maks selama jangka waktu',
    kpiBreakevenLabel: 'Tahun Breakeven',
    kpiBreakevenTip: 'Tahun pertama saat kekayaan bersih skenario Beli (nilai bersih properti + kas) melampaui tabungan skenario Sewa. Sebelum tahun ini, menyewa menghasilkan kekayaan bersih lebih tinggi.',
    kpiBreakevenSub: 'Saat kekayaan bersih Beli melampaui Sewa',
    kpiDiffLabel: 'Perbedaan Kekayaan Bersih',
    kpiDiffTip: 'Kekayaan Bersih Beli dikurangi Kekayaan Bersih Sewa di tahun terakhir. Positif (hijau) berarti beli lebih menguntungkan; negatif (merah) berarti sewa & investasi lebih menguntungkan.',
    kpiDiffSub: 'Beli dikurangi Sewa di tahun terakhir',
    /* chart */
    chartTitle: 'Perbandingan',
    btnNetEquity: 'Kekayaan Bersih',
    btnLiquidCash: 'Uang Tunai',
    btnAccumCost: 'Biaya Kumulatif',
    btnZoom: '⟳',
    chartHoverHint: 'Arahkan kursor ke grafik untuk melihat detail per tahun.',
    /* summary */
    ownSnapshotTitle: '🏡 Beli — Ringkasan',
    ownSnapshotTip: 'Ringkasan skenario Beli pada tahun terakhir jangka waktu.',
    rentSnapshotTitle: '🏢 Sewa — Ringkasan',
    rentSnapshotTip: 'Ringkasan skenario Sewa murni pada tahun terakhir jangka waktu.',
    rtbSnapshotTitle: '🔄 Sewa Dulu, Beli Kemudian — Ringkasan',
    rtbSnapshotTip: 'Ringkasan skenario Sewa Dulu, Beli Kemudian. Sebelum tahun pembelian, arus kas sama dengan skenario sewa. Pada tahun pembelian, tabungan terkumpul digunakan sebagai Uang Muka (DP) pada harga properti saat itu, dan KPR baru dimulai.',
    /* detail tabs */
    tabOwnCashflow: '🏡 Arus Kas Beli',
    tabRentCashflow: '🏢 Arus Kas Sewa',
    tabRTBCashflow: '🔄 Arus Kas Sewa Dulu, Beli Kemudian',
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
    /* dynamic messages */
    kpiBreakevenYear: 'Tahun ',
    subInitialCashLeftover: (x) => `Sisa ${x} diinvestasikan pada suku bunga bebas risiko mulai hari pertama.`,
    subInitialCashExact: 'Tepat menutup Uang Muka (DP) + biaya awal pembelian — tidak ada sisa.',
    subInitialCashAuto: (x) => `Otomatis: ${x} (Uang Muka (DP) + biaya awal pembelian). Kelebihan diinvestasikan pada suku bunga bebas risiko.`,
    subInitialCashRTB: (x,y,z,n) => `Otomatis: ${x} (dinaikkan dari ${y} untuk menutup pembelian Sewa Dulu sebesar ${z} di Thn ${n}).`,
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
    thInterestInc: 'Pend. Bunga',
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
    phaseRenting: '🏢 Menyewa',
    phaseBought: '🔄 Baru Dibeli',
    phaseOwning: '🏡 Memiliki',
    /* chart tooltip */
    chartTooltipYear: 'Tahun ',
  },
};
function T(key){ return LANG[lang][key] !== undefined ? LANG[lang][key] : (LANG.en[key] !== undefined ? LANG.en[key] : key); }

function applyLang(){
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const key = el.dataset.i18n;
    const val = LANG[lang][key];
    if(val !== undefined && typeof val === 'string') el.textContent = val;
  });
  document.querySelectorAll('[data-i18n-opt]').forEach(el=>{
    const key = el.dataset.i18nOpt;
    const val = LANG[lang][key];
    if(val !== undefined) el.textContent = val;
  });
  /* elements needing innerHTML (tip-icon inside label, sensitivity link) */
  const sensDiv = document.getElementById('sensitivityLinkDiv');
  if(sensDiv) sensDiv.innerHTML = T('sensitivityHtml');
  /* KPI label spans contain tip-icon child — rebuild carefully */
  ['kpiInitialCashLabel','kpiBudgetLabel','kpiBreakevenLabel','kpiDiffLabel',
   'ownSnapshotTitle','rentSnapshotTitle','rtbSnapshotTitle'].forEach(key=>{
    const el = document.querySelector('[data-i18n="'+key+'"]');
    if(!el) return;
    const tipSpan = el.querySelector('.tip-icon');
    const tipKey = tipSpan ? tipSpan.dataset.i18nTip : null;
    el.childNodes.forEach(n=>{ if(n.nodeType===3) n.textContent = ''; }); /* clear text nodes */
    const first = el.firstChild;
    if(first && first.nodeType===3) first.textContent = T(key)+' ';
    else el.insertBefore(document.createTextNode(T(key)+' '), el.firstChild);
    if(tipSpan && tipKey) tipSpan.setAttribute('data-tip', T(tipKey));
  });
  /* data-i18n-tip: update data-tip on tip-icons */
  document.querySelectorAll('[data-i18n-tip]').forEach(el=>{
    const key = el.dataset.i18nTip;
    const val = T(key);
    if(val) el.setAttribute('data-tip', val);
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
  const tips = (lang === 'id' && window.RVO_TIPS_ID) ? RVO_TIPS_ID : (window.RVO_TIPS_EN || window.RVO_TIPS);
  if(tips){
    document.querySelectorAll('[data-tip-key]').forEach(function(el){
      var k = el.getAttribute('data-tip-key');
      if(tips[k]) el.setAttribute('data-tip', tips[k]);
    });
  }
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
   principal × period rate; past the term they keep paying at the last period's rate
   while the principal is still outstanding (matches existing IO behaviour). */
function buildMortgageSchedule(loan, term, type, years, norm, variant){
  const sched = [];
  let principal = loan;
  for(let my=1; my<=years; my++){
    const band = rateBandForMortgageYear(norm, Math.min(my, term));
    const rate = rateFromBand(band, variant);
    const r12 = rate/100/12;
    let pay = 0;
    if(principal > 1e-2){
      if(type==='io') pay = principal * r12;
      else if(my <= term) pay = calcMonthlyMortgage(principal, rate, term - my + 1, 'pi');
    }
    const principalStart = principal;
    if(type!=='io' && pay > 0){
      for(let m=0;m<12;m++){
        if(principal <= 1e-2){ principal = 0; break; }
        const intr = principal * r12;
        principal = Math.max(0, principal - Math.min(pay - intr, principal));
      }
    }
    sched.push({rate, r12, monthlyPayment: pay, principalStart, principalEnd: principal});
  }
  return sched;
}
function getOwnRateNorm(){
  if(S.mortgageMode !== 'detailed') return [{from:1, to:S.mortgageTerm, min:S.mortgageRate, max:S.mortgageRate}];
  return normalizeRatePeriods(S.ratePeriods, S.mortgageTerm, S.mortgageRate);
}
function scheduleHasFloat(){
  if(S.mortgageMode !== 'detailed') return false;
  return getOwnRateNorm().some(p => p.max - p.min > 1e-9);
}

/* ── COST ITEMS (Costs of Owning / Renting — simple & detailed modes) ──
   Detailed mode stores lists of cost items; simple mode is normalised to a
   single-item list so the engine has exactly one code path.
   Setup item basis:   'fixed' ($ at purchase) | 'pct' (% of buy price at purchase time).
   Ongoing item basis: 'weekly'|'monthly'|'yearly' ($ amount, inflated p.a. by its
   own inflation rate) | 'pct' (own: % of property value; rent: % of annual rent). */
function getOwnSetupItems(){
  if(S.ownCostsMode==='detailed' && Array.isArray(S.ownSetupCosts) && S.ownSetupCosts.length) return S.ownSetupCosts;
  return [{amount:S.setupCost, basis:S.setupCostType==='pct' ? 'pct' : 'fixed'}];
}
function getOwnOngoingItems(){
  if(S.ownCostsMode==='detailed' && Array.isArray(S.ownOngoingCosts) && S.ownOngoingCosts.length) return S.ownOngoingCosts;
  return [{amount:S.ownOngoingCost, basis:S.ownOngoingCostType==='pct' ? 'pct' : S.ownOngoingCostFreq, inflation:S.ownOngoingInflation}];
}
function getRentOngoingItems(){
  if(S.rentCostsMode==='detailed' && Array.isArray(S.rentOngoingCosts) && S.rentOngoingCosts.length) return S.rentOngoingCosts;
  return [{amount:S.rentOngoingCost, basis:S.rentOngoingCostType==='pct' ? 'pct' : S.rentOngoingCostFreq, inflation:S.rentOngoingInflation}];
}
// Total one-time setup cost for a purchase at `price` (% items scale with price).
function setupCostTotal(price){
  return getOwnSetupItems().reduce((t,it)=>{
    const amt = Number(it.amount)||0;
    return t + (it.basis==='pct' ? price*amt/100 : amt);
  }, 0);
}
// Yearly ongoing cost of owning for year `yr`, given the property value at the
// start of that year (% items track the value; $ items inflate from year 1).
function ownOngoingYearlyAt(yr, propValue){
  return getOwnOngoingItems().reduce((t,it)=>{
    const amt = Number(it.amount)||0;
    if(it.basis==='pct') return t + propValue*amt/100;
    return t + toYearly(amt, it.basis) * Math.pow(1+(Number(it.inflation)||0)/100, yr-1);
  }, 0);
}
// Yearly ongoing cost of renting for year `yr`, given that year's monthly rent.
function rentOngoingYearlyAt(yr, rentMonthly){
  return getRentOngoingItems().reduce((t,it)=>{
    const amt = Number(it.amount)||0;
    if(it.basis==='pct') return t + rentMonthly*12*amt/100;
    return t + toYearly(amt, it.basis) * Math.pow(1+(Number(it.inflation)||0)/100, yr-1);
  }, 0);
}

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
  S.setupCost       = Math.max(0, parseNum($('setupCost').value)||0);
  S.setupCostType   = $('setupCostType').value;
  S.ownOngoingCost  = Math.max(0, parseNum($('ownOngoingCost').value)||0);
  S.ownOngoingCostFreq  = $('ownOngoingCostFreq').value;
  S.ownOngoingCostType  = $('ownOngoingCostType').value;
  S.rentAmount      = Math.max(0, parseNum($('rentAmount').value)||DEFAULTS.rentAmount);
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
  const dp = S.propertyPrice * S.downPaymentPct/100;
  $('downPaymentPctVal').textContent = S.downPaymentPct+'%';
  $('downPaymentDollar').textContent = fmt.currency(dp);
  $('riskFreeRateVal').textContent   = S.riskFreeRate.toFixed(2)+'%';
  $('horizonVal').textContent        = S.horizon+T('yrsSuffix');
  $('mortgageRateVal').textContent        = S.mortgageRate.toFixed(2)+'%';
  $('mortgageTermVal').textContent        = S.mortgageTerm+T('yrsSuffix');
  if(S.mortgageMode === 'detailed') syncRatePeriodLabels();
  $('houseGrowthVal').textContent         = S.houseGrowth.toFixed(2)+'%';
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

  // Initial cash: compute required and show live feedback
  const setupCostDollarUI = setupCostTotal(S.propertyPrice);
  const dpDollar = S.propertyPrice * S.downPaymentPct/100;
  const required = dpDollar + setupCostDollarUI;
  const cashWarn = $('initialCashWarn');
  const cashSub  = $('initialCashSub');
  if(S.initialCash > 0){
    const leftover = S.initialCash - required;
    if(leftover < 0){
      cashWarn.style.display='block';
      cashWarn.textContent=T('warnInitialCashShort')(fmt.currency(S.initialCash), fmt.currency(-leftover), fmt.currency(required));
      cashSub.textContent = T('subRequiredCash')(fmt.currency(required));
    } else {
      cashWarn.style.display='none';
      cashSub.textContent = leftover > 0
        ? T('subInitialCashLeftover')(fmt.currency(leftover))
        : T('subInitialCashExact');
    }
  } else {
    cashWarn.style.display='none';
    // Show auto initialCash: may be higher if RTB future purchase exceeds current required
    const rtbPriceUI = S.rtbEnabled ? (S.propertyPrice * Math.pow(1+S.houseGrowth/100, S.rtbBuyYear)) : 0;
    const rtbSetupUI = S.rtbEnabled ? setupCostTotal(rtbPriceUI) : 0;
    const rtbDPUI    = S.rtbEnabled ? rtbPriceUI * S.downPaymentPct/100 : 0;
    const rtbFutReq  = rtbDPUI + rtbSetupUI;
    const pvRTB      = (S.rtbEnabled && (1+S.riskFreeRate/100) > 0)
      ? rtbFutReq / Math.pow(1+S.riskFreeRate/100, S.rtbBuyYear)
      : rtbFutReq;
    const rentMonthlyUI     = toMonthly(S.rentAmount, S.rentFreq);
    const rentOngoingUI     = rentOngoingYearlyAt(1, rentMonthlyUI);
    const rentFirstYearUI   = rentMonthlyUI * 12 + rentOngoingUI;
    const autoIC = Math.max(required, rentFirstYearUI, pvRTB);
    if(S.rtbEnabled && pvRTB > required){
      cashSub.textContent = T('subInitialCashRTB')(fmt.currency(autoIC), fmt.currency(required), fmt.currency(rtbFutReq), S.rtbBuyYear);
    } else {
      cashSub.textContent = T('subInitialCashAuto')(fmt.currency(autoIC));
    }
  }
}

/* ── MODEL ── */
function computeModel(variant){
  variant = variant || 'mid';
  const P  = S.propertyPrice;
  const dp = P * S.downPaymentPct/100;
  const loan = P - dp;
  const rfr  = S.riskFreeRate/100;

  // Setup cost (sum of all setup items — simple mode is a single item)
  const setupCostDollar = setupCostTotal(P);

  // Mortgage rate schedule (Buy scenario, loan starts day 0).
  // Simple mode = single fixed-rate period; detailed mode = user-defined periods.
  const rateNorm = getOwnRateNorm();
  const schedYears = Math.max(S.horizon, 1);
  const ownSched = buildMortgageSchedule(loan, S.mortgageTerm, S.mortgageType, schedYears, rateNorm, variant);
  const ownPayAt = yr => ownSched[Math.min(Math.max(yr,1), ownSched.length)-1].monthlyPayment;
  const mPayment = ownPayAt(1);

  // Monthly rent (year 0)
  const rentMonthly0 = toMonthly(S.rentAmount, S.rentFreq);

  // ── Year-1 ongoing costs (needed for auto-budget baseline) ──
  const rentOngoingYearly0 = rentOngoingYearlyAt(1, rentMonthly0);

  // ── Pre-calculate RTB mortgage (if RTB enabled) ──
  // RTB property price at buyYear, DP%, setup cost, loan, and monthly payment
  const rtbEnabled   = S.rtbEnabled;
  const buyYear      = S.rtbBuyYear;
  const h            = S.houseGrowth/100;
  const ri           = S.rentInflation/100;
  const rtbPropPrice0 = rtbEnabled ? P * Math.pow(1+h, buyYear) : 0;
  const rtbSetup0     = rtbEnabled ? setupCostTotal(rtbPropPrice0) : 0;
  const rtbDP0        = rtbEnabled ? rtbPropPrice0 * S.downPaymentPct/100 : 0;
  const rtbLoan0      = rtbEnabled ? Math.max(0, rtbPropPrice0 - rtbDP0) : 0;
  // RTB schedule is indexed by mortgage year (year 1 = first year after purchase)
  const rtbSched0     = rtbEnabled
    ? buildMortgageSchedule(rtbLoan0, S.mortgageTerm, S.mortgageType, schedYears, rateNorm, variant)
    : null;

  function ownRequiredMonthly(year){
    const propValueAtYearStart = P * Math.pow(1+h, Math.max(0, year-1));
    const ownOngoingMonthly = ownOngoingYearlyAt(year, propValueAtYearStart) / 12;
    return ownPayAt(year) + ownOngoingMonthly;
  }

  function rentRequiredMonthly(year){
    const currentRentMonthly = rentMonthly0 * Math.pow(1+ri, year-1);
    return currentRentMonthly + (rentOngoingYearlyAt(year, currentRentMonthly) / 12);
  }

  function rtbRequiredMonthly(year){
    if(!rtbEnabled) return 0;
    if(year <= buyYear) return rentRequiredMonthly(year);
    const propValueAtYearStart = P * Math.pow(1+h, Math.max(0, year-1));
    const ownOngoingMonthly = ownOngoingYearlyAt(year, propValueAtYearStart) / 12;
    const yearsOwned = year - buyYear;
    const rtbMortgageMonthly = yearsOwned >= 1
      ? rtbSched0[Math.min(yearsOwned, rtbSched0.length)-1].monthlyPayment
      : 0;
    return rtbMortgageMonthly + ownOngoingMonthly;
  }

  function getAutoMonthlyBudgetForYear(year){
    return Math.max(
      ownRequiredMonthly(year),
      rentRequiredMonthly(year),
      rtbRequiredMonthly(year)
    );
  }

  // ── Monthly budget ──
  const budgetIsManual = S.monthlyBudget > 0;
  const monthlyBudget0 = S.monthlyBudget;
  const budgetGrowth   = budgetIsManual ? S.monthlyBudgetIncrease/100 : 0;

  // For KPI warnings we pass the year-1 base budget
  const monthlyBudget = budgetIsManual ? monthlyBudget0 : getAutoMonthlyBudgetForYear(1);

  // ── Auto Initial Cash ──
  // rfr already declared at top of computeModel.
  // auto cash must cover max of:
  //   A) Own: dp + setupCostDollar
  //   B) Rent: first-year rent cost (rent + ongoing) so renter is solvent year 1
  //   C) RTB: PV of (rtbDP0 + rtbSetup0) at RFR over buyYear years
  const requiredNow    = dp + setupCostDollar;
  const rentFirstYearCost = rentMonthly0 * 12 + rentOngoingYearly0;
  const requiredRTBFut = rtbEnabled ? (rtbDP0 + rtbSetup0) : 0;
  // Present value of RTB purchase cost (how much cash we need today to fund it at RFR growth)
  const pvRTBRequired  = rtbEnabled && (1+rfr) > 0
    ? requiredRTBFut / Math.pow(1+rfr, buyYear)
    : requiredRTBFut;
  const autoInitialCash = Math.max(requiredNow, rentFirstYearCost, pvRTBRequired);

  const initialCashUsed    = S.initialCash > 0 ? S.initialCash : autoInitialCash;
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
    ownHouseEquity: ownPropValue - ownPrincipal,
    ownNetEquity: ownPropValue - ownPrincipal + ownCash,
    ownAccumCost: setupCostDollar, ownAccumInterest:0,
    ownMortgagePayment:0,
    rentCash, rentNetEquity:rentCash, rentAccumCost:0, rentRent:rentMonthly0*12,
    netEquityOwn: ownPropValue - ownPrincipal + ownCash,
    netEquityRent: rentCash,
    cashOwn: ownCash,
    cashRent: rentCash,
    costOwn: setupCostDollar,
    costRent: 0,
    initialCashUsed, ownCashStart, renterStartCapital,
  });

  const rfm = Math.pow(1+rfr, 1/12)-1; // monthly risk-free

  for(let yr=1; yr<=S.horizon; yr++){
    // Mortgage rate & payment for this year (re-amortised when the rate changes)
    const yrSched = ownSched[yr-1];
    const mPayYr  = yrSched.monthlyPayment;
    const r12     = yrSched.r12;

    // Rent for this year (inflates each year)
    const currentRentMonthly = rentMonthly0 * Math.pow(1+ri, yr-1);

    // Ongoing costs — monthly equivalent; own uses PREVIOUS year prop value (before appreciation)
    const ownOngoingMonthly  = ownOngoingYearlyAt(yr, ownPropValue) / 12;
    const rentOngoingMonthly = rentOngoingYearlyAt(yr, currentRentMonthly) / 12;

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
      ownYearInterestInc  += ownCash * rfm;
      rentYearInterestInc += rentCash * rfm;

      // ── Liquid cash: cash × (1+RFR) + (budget − cost) ──
      const ownSurplus  = mBudget - mOwnCost;
      const rentSurplus = mBudget - mRentCost;
      ownCash  = ownCash  * (1+rfm) + ownSurplus;
      rentCash = rentCash * (1+rfm) + rentSurplus;

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
    // Derived year values
    const ownYearSurplus  = ownYearBudget - ownYearMortPmt - ownYearOngoingPart;
    const rentYearSurplus = ownYearBudget - rentYearCost;

    // House appreciates at end of year
    ownPropValue = ownPropValue * (1+h);

    const ownHouseEquity = ownPropValue - ownPrincipal;
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

  // Find breakeven (Own vs Rent)
  let breakeven = null;
  for(let i=1;i<rows.length;i++){
    if(rows[i].netEquityOwn>=rows[i].netEquityRent && (i===1||rows[i-1].netEquityOwn<rows[i-1].netEquityRent)){
      breakeven = rows[i].year; break;
    }
  }

  // ── RENT-THEN-BUY SCENARIO ──
  let rtbRows = null;
  if(S.rtbEnabled){
    rtbRows = computeRTB(monthlyBudget0, budgetGrowth, budgetIsManual, rentMonthly0, initialCashUsed, getAutoMonthlyBudgetForYear, rtbSched0);
  }

  // Range of in-term payments (varies under a detailed rate schedule)
  const inTermPays = ownSched.slice(0, Math.min(S.mortgageTerm, ownSched.length))
    .map(s=>s.monthlyPayment).filter(p=>p>0);
  const mPaymentMin = inTermPays.length ? Math.min(...inTermPays) : 0;
  const mPaymentMax = inTermPays.length ? Math.max(...inTermPays) : 0;

  const last = rows[rows.length-1];
  return {
    rows, breakeven,
    monthlyBudget, mPayment, mPaymentMin, mPaymentMax, rentMonthly0,
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
   Phase 1 (yr 0..buyYear-1): identical to pure rent — renter invests dp+setupCost + monthly surplus.
   Phase 2 (yr buyYear..horizon): buys at then-market price; uses accumulated cash as down payment.
     - If cash >= setupCost (at new price) + some down, uses full cash as down + setup, remainder goes to principal.
     - New mortgage on remaining principal at same rate/term.
     - From buyYear onward, cashflows mirror "own" but starting from the new property price.
*/
function computeRTB(monthlyBudget0, budgetGrowth, budgetIsManual, rentMonthly0, initialCashUsed, getAutoMonthlyBudgetForYear, rtbSched){
  const P0  = S.propertyPrice;
  const h   = S.houseGrowth/100;
  const ri  = S.rentInflation/100;
  const rfr = S.riskFreeRate/100;
  const rfm = Math.pow(1+rfr, 1/12)-1;
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
      const rentOngoingMonthly = rentOngoingYearlyAt(yr, currentRentMonthly) / 12;

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
        rtbP1YearInterestInc += rtbCash * rfm;
        const surplus = mBudget - mRentCost;
        rtbCash = rtbCash*(1+rfm) + surplus;
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
        rtbSetupCostAtBuy = setupCostTotal(rtbPropValueAtBuy);

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

        // Net Equity = house equity (propValue − loan) + remaining cash
        // Drop vs pre-buy = only the setup cost (DP converts from liquid cash to house equity)
        const rtbHouseEquity = rtbPropValue - rtbPrincipal; // = rtbDPAtBuy
        const rtbNetEquity   = rtbHouseEquity + rtbCash2;   // ≈ preBuyCash − setupCost
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
      const ownOngoingMonthly = ownOngoingYearlyAt(yr, rtbPropValue) / 12;

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
        rtbYearInterestInc2 += rtbCash2 * rfm;
        const surplus = mBudget - mOwnCost;
        rtbCash2 = rtbCash2*(1+rfm) + surplus;
        rtbYearBudget2   += mBudget;
        rtbYearOngoing2  += ownOngoingMonthly;

        const rtbCostThisMonth = S.costInterestOnly
          ? rtbInterest + ownOngoingMonthly
          : mOwnCost;
        rtbAccumCost += rtbCostThisMonth;
        rtbYearCost2 += rtbCostThisMonth;
      }
      rtbPropValue = rtbPropValue * (1+h);

      const rtbHouseEquity = rtbPropValue - rtbPrincipal;
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

/* ── CHART ── */
function buildLegend(series){
  const el = $('chartLegend');
  el.innerHTML = '';
  series.forEach(s=>{
    const d = document.createElement('div');
    d.className='legend-item';
    const isRTB = s.key && s.key.includes('RTB');
    if(isRTB){
      d.innerHTML=`<span style="display:inline-flex;align-items:center;gap:2px;margin-right:2px;">
        <span style="width:14px;height:0;border-top:2.5px dashed ${cssVar('--line-rtb-rent')};display:inline-block;"></span>
        <span style="width:14px;height:0;border-top:2.5px dashed ${cssVar('--line-rtb-own')};display:inline-block;"></span>
      </span><span>${s.label}</span>`;
    } else {
      d.innerHTML=`<span class="dot" style="background:${cssVar(s.colorVar)}"></span><span>${s.label}</span>`;
    }
    el.appendChild(d);
  });
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
  buildLegend(series);
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
        tension: 0.3,
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
      tension:0.3, fill:false,
    };
  });
  datasets.forEach((d,i)=>{ d.rvoKey = series[i].key; });

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
        tension:0.3, fill:false, isBand:true,
      });
      datasets.push({
        label: s.label+' (band)',
        data: rows.map(r=>r[loKey]??0),
        borderColor:'transparent', backgroundColor: color+'30',
        pointRadius:0, pointHoverRadius:0, borderWidth:0,
        tension:0.3, fill:'-1', isBand:true,
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
        tooltip:{
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
        },
        zoom:{
          pan:{enabled:true,mode:'x'},
          zoom:{wheel:{enabled:true,speed:.08},pinch:{enabled:true},mode:'x'},
        },
      },
      scales:{
        x:{title:{display:true,text:'Year',color:m,font:{family:"'DM Mono', monospace",size:11}},ticks:{color:m,maxTicksLimit:12,font:{family:"'DM Mono', monospace",size:11},callback:xTickCallback},grid:{color:g}},
        y:{title:{display:true,text:yAxisTitle,color:m,font:{family:"'DM Mono', monospace",size:11}},ticks:{color:m,font:{family:"'DM Mono', monospace",size:11},callback:v=>fmt.currency(v,true)},grid:{color:g}},
      },
    },
  };

  if(chartInstance){
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
    chartInstance.update('none');
  } else {
    chartInstance = new Chart($('chartCanvas'), cfg);
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
    $('kpiBudgetRange').textContent = `${fmt.currency(minBudget, true)}–${fmt.currency(maxBudget, true)}`;
  } else {
    $('kpiBudgetRange').textContent = '—';
  }
  $('kpiBreakeven').textContent = breakeven ? T('kpiBreakevenYear')+breakeven : '—';
  $('kpiBreakeven').style.color = breakeven ? cssVar('--accent') : cssVar('--muted');
  const diff = summary.diff;
  $('kpiDiff').textContent = (diff>=0?'+':'')+fmt.currency(diff, true);
  $('kpiDiff').style.color = diff>=0 ? cssVar('--data-pos-em') : cssVar('--data-neg-em');

  const warn = $('warningBanner');
  if(S.monthlyBudget > 0){
    // Year-1 ongoing costs for warning purposes
    const ownOngoingWarn  = ownOngoingYearlyAt(1, S.propertyPrice)/12;
    const rentOngoingWarn = rentOngoingYearlyAt(1, rentMonthly0)/12;
    const ownTotalWarn  = mPayment + ownOngoingWarn;
    const rentTotalWarn = rentMonthly0 + rentOngoingWarn;
    if(monthlyBudget < ownTotalWarn && monthlyBudget < rentTotalWarn){
      warn.style.display='block';
      warn.textContent=T('warnBudgetLow')(fmt.currency(monthlyBudget), fmt.currency(ownTotalWarn,true), fmt.currency(rentTotalWarn,true));
    } else { warn.style.display='none'; }
  } else { warn.style.display='none'; }
}

/* ── SUMMARY TILES ── */
function updateSummary(state){
  const {summary,mPayment,mPaymentMin,mPaymentMax,rentMonthly0,monthlyBudget,initialCashUsed,ownCashStart,renterStartCapital} = state;
  const yrs = S.horizon;
  // Payments vary over the term under a detailed rate schedule → show the range
  const mPayTxt = (mPaymentMax - mPaymentMin) > 0.5
    ? `${fmt.currency(mPaymentMin,true)}–${fmt.currency(mPaymentMax,true)}${T('perMo')}`
    : `${fmt.currency(mPayment)}${T('perMo')}`;

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
        <th colspan="9" class="th-group th-sep-right">${T('thCashPosition')}</th>
        <th colspan="4" class="th-group th-sep-right">${T('thMortgagePosition')}</th>
        <th colspan="2" class="th-group">${T('thFinancialPosition')}</th>
      </tr>
      <tr>
        <th>${T('thBegCash')}</th><th>${T('thAnnBudget')}</th><th>${T('thTotalExp')}</th><th>${T('thPrincipalExp')}</th><th>${T('thInterestExp')}</th><th>${T('thOngoingExp')}</th><th>${T('thInterestInc')}</th><th>${T('thSurplus')}</th><th class="th-sep-right">${T('thEndCash')}</th>
        <th>${T('thRate')}</th><th>${T('thPropValue')}</th><th>${T('thPrincipalLeft')}</th><th class="th-sep-right">${T('thHouseEquity')}</th>
        <th>${T('thNetEquity')}</th><th>${T('thAccumCost')}</th>
      </tr>
    </thead><tbody>`;
    rtbRows.forEach(r=>{
      const y0 = r.year===0;
      const phaseLabel = r.phase==='rent'?T('phaseRenting'): r.phase==='buy-transition'?T('phaseBought'):T('phaseOwning');
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
    <div class="tile"><div class="label">${T('tileMonthlyMortgage')}</div><div class="value">${fmt.currency(rtbMPayment||0)}${T('perMo')}</div></div>
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

/* ── APPLY CITY PRESET ── */
function applyPreset(cityKey){
  const p = CITY_PRESETS[cityKey];
  if(!p) return;

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
  updateMortgageModeUI();
  renderRatePeriodRows();
  updateCostsModeUI();

  document.querySelectorAll('.quick-start-btn').forEach(btn=>btn.classList.toggle('active', btn.dataset.city===cityKey));
  updateCagrToolVisibility(false);
  rerender();
}

/* ── PNG ── */
function buildChartPngCanvas(shouldDownload = true) {
  const src = document.getElementById('chartCanvas');
  if(!src) return;
  const dpr = window.devicePixelRatio || 1;
  const OUT = 3;
  const chartW = Math.round(src.width / dpr * OUT);
  const chartH = Math.round(src.height / dpr * OUT);
  const isLight = document.body.classList.contains('light');
  const bgColor = isLight ? '#ffffff' : '#0F1728';
  const fgColor = isLight ? '#2D3436' : '#EAF1FF';
  const FONT = '"DM Sans", sans-serif';

  // Determine chart title from active graph mode
  const chartTitleMap = {netEquity:'Rent vs Own — Net Equity Over Time', cash:'Rent vs Own — Liquid Cash Over Time', cost:'Rent vs Own — Accumulated Cost Over Time'};
  const chartTitle = chartTitleMap[activeGraph] || 'Rent vs Own — Financial Comparison';

  // Build legend items directly from series data for reliability
  const legendItems = getGraphSeries().map(s => ({
    label: s.label,
    color: s.key && s.key.includes('RTB') ? cssVar('--line-rtb-own') : cssVar(s.colorVar),
  }));

  const titleFontPx = Math.round(14 * OUT);
  const legendFontPx = Math.round(11 * OUT);
  const titleH = Math.round(40 * OUT);
  const legendH = legendItems.length ? Math.round(34 * OUT) : 0;

  const tmp = document.createElement('canvas');
  tmp.width = chartW;
  tmp.height = chartH + titleH + legendH;
  const ctx = tmp.getContext('2d');

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, tmp.width, tmp.height);

  ctx.font = `700 ${titleFontPx}px ${FONT}`;
  ctx.fillStyle = fgColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(chartTitle, tmp.width / 2, titleH / 2);

  ctx.drawImage(src, 0, titleH, chartW, chartH);

  if(legendItems.length){
    const ly = titleH + chartH;
    const dotR = Math.round(5 * OUT);
    const gap = Math.round(7 * OUT);
    const pad = Math.round(20 * OUT);
    ctx.font = `500 ${legendFontPx}px ${FONT}`;
    ctx.textBaseline = 'middle';
    let totalW = 0;
    legendItems.forEach((item, i) => {
      totalW += dotR * 2 + gap + ctx.measureText(item.label).width + (i < legendItems.length - 1 ? pad : 0);
    });
    let x = Math.max(Math.round(16 * OUT), (tmp.width - totalW) / 2);
    const cy = ly + legendH / 2;
    legendItems.forEach(item => {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(x + dotR, cy, dotR, 0, Math.PI * 2);
      ctx.fill();
      x += dotR * 2 + gap;
      ctx.fillStyle = fgColor;
      ctx.textAlign = 'left';
      ctx.fillText(item.label, x, cy);
      x += ctx.measureText(item.label).width + pad;
    });
  }

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.font = `500 ${Math.round(11 * OUT)}px ${FONT}`;
  ctx.fillStyle = '#1a1a1a';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  {
    const wmText = 'Made using tool.adjiebrotots.com/rentvsownhouse';
    const wmX = tmp.width - Math.round(12 * OUT);
    const wmY = tmp.height - Math.round(12 * OUT);
    const wmTextW = ctx.measureText(wmText).width;
    const wmLogoSize = Math.round(13 * OUT);
    if(wmLogoImg.complete && wmLogoImg.naturalWidth){
      ctx.drawImage(wmLogoImg, wmX - wmTextW - Math.round(4 * OUT) - wmLogoSize, wmY - wmLogoSize + Math.round(2 * OUT), wmLogoSize, wmLogoSize);
    }
    ctx.fillText(wmText, wmX, wmY);
  }
  ctx.restore();

  if(shouldDownload){
    const a = document.createElement('a');
    a.href = tmp.toDataURL('image/png');
    a.download = 'rent_vs_own_chart.png';
    document.body.appendChild(a); a.click(); a.remove();
  }
  return tmp;
}
function downloadChartPng() { buildChartPngCanvas(true); }
async function copyCanvasPngToClipboard(canvas) {
  if(!navigator.clipboard || !window.ClipboardItem) throw new Error('Clipboard image copy is not supported in this browser.');
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if(!blob) throw new Error('Could not create PNG blob.');
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
async function copyChartPng() {
  try { await copyCanvasPngToClipboard(buildChartPngCanvas(false)); alert('PNG copied to clipboard.'); }
  catch(err){ alert('PNG copy failed: ' + err.message); }
}
function downloadChartSvg() {
  const src = document.getElementById('chartCanvas');
  if(!src) return;
  const dpr = window.devicePixelRatio || 1;
  const chartW = Math.round(src.width / dpr);
  const chartH = Math.round(src.height / dpr);
  const isLight = document.body.classList.contains('light');
  const bgColor = isLight ? '#ffffff' : '#0F1728';
  const fgColor = isLight ? '#2D3436' : '#EAF1FF';
  const FONT = 'DM Sans, sans-serif';
  const chartTitleMap = {netEquity:'Rent vs Own — Net Equity Over Time', cash:'Rent vs Own — Liquid Cash Over Time', cost:'Rent vs Own — Accumulated Cost Over Time'};
  const chartTitle = chartTitleMap[activeGraph] || 'Rent vs Own — Financial Comparison';
  const legendItems = getGraphSeries().map(s => ({
    label: s.label,
    color: s.key && s.key.includes('RTB') ? cssVar('--line-rtb-own') : cssVar(s.colorVar),
  }));
  const titleH = 40;
  const legendH = legendItems.length ? 34 : 0;
  const svgW = chartW, svgH = chartH + titleH + legendH;
  const NS = 'http://www.w3.org/2000/svg', xl = 'http://www.w3.org/1999/xlink';
  const svg = document.createElementNS(NS,'svg');
  svg.setAttribute('xmlns',NS); svg.setAttribute('xmlns:xlink',xl);
  svg.setAttribute('width',svgW); svg.setAttribute('height',svgH);
  svg.setAttribute('viewBox',`0 0 ${svgW} ${svgH}`);
  const bgRect = document.createElementNS(NS,'rect');
  bgRect.setAttribute('width',svgW); bgRect.setAttribute('height',svgH); bgRect.setAttribute('fill',bgColor);
  svg.appendChild(bgRect);
  const t = document.createElementNS(NS,'text');
  t.setAttribute('x',svgW/2); t.setAttribute('y',titleH/2);
  t.setAttribute('text-anchor','middle'); t.setAttribute('dominant-baseline','middle');
  t.setAttribute('font-family',FONT); t.setAttribute('font-size','14'); t.setAttribute('font-weight','700'); t.setAttribute('fill',fgColor);
  t.textContent = chartTitle; svg.appendChild(t);
  const img = document.createElementNS(NS,'image');
  img.setAttribute('x',0); img.setAttribute('y',titleH);
  img.setAttribute('width',chartW); img.setAttribute('height',chartH);
  img.setAttributeNS(xl,'href',src.toDataURL('image/png'));
  svg.appendChild(img);
  if(legendItems.length){
    const dotR=5, gap=7, pad=20;
    const cy = titleH + chartH + legendH/2;
    const mc = document.createElement('canvas').getContext('2d');
    mc.font = '500 11px DM Sans, sans-serif';
    const totalW = legendItems.reduce((s,item,i) => s + dotR*2 + gap + mc.measureText(item.label).width + (i<legendItems.length-1?pad:0), 0);
    let x = Math.max(16, (svgW - totalW) / 2);
    legendItems.forEach(item => {
      const c = document.createElementNS(NS,'circle');
      c.setAttribute('cx',x+dotR); c.setAttribute('cy',cy); c.setAttribute('r',dotR); c.setAttribute('fill',item.color);
      svg.appendChild(c); x += dotR*2 + gap;
      const lt = document.createElementNS(NS,'text');
      lt.setAttribute('x',x); lt.setAttribute('y',cy);
      lt.setAttribute('dominant-baseline','middle'); lt.setAttribute('font-family',FONT);
      lt.setAttribute('font-size','11'); lt.setAttribute('font-weight','500'); lt.setAttribute('fill',fgColor);
      lt.textContent = item.label; svg.appendChild(lt);
      x += mc.measureText(item.label).width + pad;
    });
  }
  const wm = document.createElementNS(NS,'text');
  wm.setAttribute('x',svgW-12); wm.setAttribute('y',svgH-12);
  wm.setAttribute('text-anchor','end'); wm.setAttribute('dominant-baseline','auto');
  wm.setAttribute('font-family',FONT); wm.setAttribute('font-size','11');
  wm.setAttribute('font-weight','500'); wm.setAttribute('fill','#1a1a1a'); wm.setAttribute('opacity','0.22');
  wm.textContent = 'Made using tool.adjiebrotots.com/rentvsownhouse'; svg.appendChild(wm);
  const wmLogoSize = 13;
  const wmTextW = measureWmText(wm.textContent, '500 11px ' + FONT);
  const wmLogo = document.createElementNS(NS,'image');
  wmLogo.setAttribute('href', WM_LOGO_SRC);
  wmLogo.setAttributeNS('http://www.w3.org/1999/xlink','href', WM_LOGO_SRC);
  wmLogo.setAttribute('width', wmLogoSize);
  wmLogo.setAttribute('height', wmLogoSize);
  wmLogo.setAttribute('x', svgW - 12 - wmTextW - 4 - wmLogoSize);
  wmLogo.setAttribute('y', svgH - 12 - wmLogoSize + 2);
  wmLogo.setAttribute('opacity', '0.22');
  svg.appendChild(wmLogo);
  const xml = '<?xml version="1.0" encoding="utf-8"?>\n' + new XMLSerializer().serializeToString(svg);
  const blob = new Blob([xml],{type:'image/svg+xml;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='rent_vs_own_chart.svg';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
$('pngBtn').addEventListener('click', downloadChartPng);
$('copyPngBtn').addEventListener('click', copyChartPng);
$('svgBtn').addEventListener('click', downloadChartSvg);

/* ── CSV ── */
function downloadCsv(){
  const na='';
  let headers,lines,filename;
  if(activeTable==='own'){
    if(!latestRows.length) return;
    headers=['Year','Beg_Cash','Ann_Budget','Principal_Exp','Interest_Exp','Ongoing_Exp','Interest_Inc','Surplus','End_Cash','Rate_Pct','Prop_Value','Principal_Left','House_Equity','Net_Equity','Accum_Cost'];
    lines=latestRows.map(r=>{
      const y0=r.year===0;
      const hasLoanYr = !y0 && ((r.ownYearInterest||0)>0 || (r.ownYearPrincipal||0)>0);
      return[
      r.year,
      y0?na:(r.ownBegCash||0).toFixed(0),
      y0?na:(r.ownYearBudget||0).toFixed(0),
      y0?na:(r.ownYearPrincipal||0).toFixed(0),
      y0?na:(r.ownYearInterest||0).toFixed(0),
      y0?na:(r.ownYearOngoing||0).toFixed(0),
      y0?na:(r.ownYearInterestInc||0).toFixed(0),
      y0?na:(r.ownYearSurplus||0).toFixed(0),
      (r.ownCash||0).toFixed(0),
      (hasLoanYr && r.ownRateYr!==undefined)?r.ownRateYr.toFixed(2):na,
      (r.ownPropValue||0).toFixed(0),
      (r.ownPrincipal||0).toFixed(0),
      (r.ownHouseEquity||0).toFixed(0),
      (r.ownNetEquity||0).toFixed(0),
      (r.ownAccumCost||0).toFixed(0),
    ].join(',');});
    filename='own_cashflow.csv';
  } else if(activeTable==='rent'){
    if(!latestRows.length) return;
    headers=['Year','Beg_Cash','Ann_Budget','Rent_Exp','Ongoing_Exp','Interest_Inc','Surplus','End_Cash','Net_Equity','Accum_Cost'];
    lines=latestRows.map(r=>{const y0=r.year===0;return[
      r.year,
      y0?na:(r.rentBegCash||0).toFixed(0),
      y0?na:(r.ownYearBudget||0).toFixed(0),
      y0?na:(r.rentRent||0).toFixed(0),
      y0?na:(r.rentYearOngoing||0).toFixed(0),
      y0?na:(r.rentYearInterestInc||0).toFixed(0),
      y0?na:(r.rentYearSurplus||0).toFixed(0),
      (r.rentCash||0).toFixed(0),
      (r.rentNetEquity||0).toFixed(0),
      y0?na:(r.rentAccumCost||0).toFixed(0),
    ].join(',');});
    filename='rent_cashflow.csv';
  } else if(activeTable==='rtb'){
    if(!cachedRtbRows||!cachedRtbRows.length) return;
    headers=['Year','Phase','Beg_Cash','Ann_Budget','Total_Exp','Principal_Exp','Interest_Exp','Ongoing_Exp','Interest_Inc','Surplus','End_Cash','Rate_Pct','Prop_Value','Principal_Left','House_Equity','Net_Equity','Accum_Cost'];
    lines=cachedRtbRows.map(r=>{
      const y0=r.year===0, own=r.phase!=='rent';
      const cash=r.phase==='rent'?r.rtbCash||0:r.rtbCash2||0;
      const tot=(r.rtbYearPrincipal||0)+(r.rtbYearInterest||0)+(r.rtbYearOngoing||0);
      const rtbHasLoanYr = own && r.rtbRateYr!==undefined && ((r.rtbYearInterest||0)>0 || (r.rtbYearPrincipal||0)>0);
      return[
        r.year, r.phase,
        y0?na:(r.rtbBegCash||0).toFixed(0),
        y0?na:(r.rtbYearBudget||0).toFixed(0),
        y0?na:tot.toFixed(0),
        (y0||!own)?na:(r.rtbYearPrincipal||0).toFixed(0),
        (y0||!own)?na:(r.rtbYearInterest||0).toFixed(0),
        y0?na:(r.rtbYearOngoing||0).toFixed(0),
        y0?na:(r.rtbYearInterestInc||0).toFixed(0),
        y0?na:(r.rtbYearSurplus||0).toFixed(0),
        cash.toFixed(0),
        rtbHasLoanYr?r.rtbRateYr.toFixed(2):na,
        (y0||!own)?na:(r.rtbPropValue||0).toFixed(0),
        (y0||!own)?na:(r.rtbPrincipal||0).toFixed(0),
        (y0||!own)?na:(r.rtbHouseEquity||0).toFixed(0),
        (r.rtbNetEquity||0).toFixed(0),
        y0?na:(r.rtbAccumCost||0).toFixed(0),
      ].join(',');
    });
    filename='rent_then_buy_cashflow.csv';
  } else { return; }
  const csv='# Made using tool.adjiebrotots.com/rentvsownhouse\n'+[headers.join(','),...lines].join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  a.download=filename; document.body.appendChild(a); a.click(); a.remove();
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
  row.innerHTML = `
    <div class="rp-head">
      <span class="rp-years">${T('labelYr')} <b class="rp-from">–</b>–<b class="rp-to-lbl">–</b></span>
      <select class="rp-type">
        <option value="fixed"${!floating?' selected':''}>${T('optFixed')}</option>
        <option value="floating"${floating?' selected':''}>${T('optFloating')}</option>
      </select>
      ${isLast ? '' : `<input type="number" class="rp-to" min="1" step="1" value="${p.toYear}" title="${T('labelMortgageTerm')}"/>`}
      <button type="button" class="cagr-btn delete rp-delete" ${S.ratePeriods.length<=1?'disabled':''}>${T('btnDelete')}</button>
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
      <button type="button" class="cagr-btn delete ci-delete" ${count<=1?'disabled':''}>${T('btnDelete')}</button>
    </div>
    <div class="ci-line">
      <div class="currency-wrap">
        <span class="prefix">${isPct?'%':sym}</span>
        <input class="currency-input money-input ci-amount" type="text" inputmode="numeric" value="${formatMoneyValue(item.amount||0)}"/>
      </div>
      <select class="ci-basis">${optsHtml}</select>
    </div>${inflHtml}`;
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
    <button class="cagr-btn delete cagr-delete" type="button">${T('btnDelete')}</button>
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
['propertyPrice','downPaymentPct','monthlyBudget','riskFreeRate','horizon',
 'mortgageRate','mortgageTerm','houseGrowth','setupCost','setupCostType',
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

$('resetBtn').addEventListener('click', ()=>{ document.querySelectorAll('.quick-start-btn').forEach(b=>b.classList.remove('active')); resetAll(); });
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
 ['mortgageRate','mortgageRateVal'],['mortgageTerm','mortgageTermVal'],['houseGrowth','houseGrowthVal'],
 ['ownOngoingInflation','ownOngoingInflationVal'],['rentInflation','rentInflationVal'],
 ['rentOngoingInflation','rentOngoingInflationVal']
].forEach(([rid,vid])=>makeSliderEditable($(vid),$(rid)));

/* ── INIT ── */
// Populate data-tip from centralised RVO_TIPS (tooltips.js)
if(window.RVO_TIPS){
  document.querySelectorAll('[data-tip-key]').forEach(function(el){
    var k=el.getAttribute('data-tip-key');
    if(RVO_TIPS[k]) el.setAttribute('data-tip', RVO_TIPS[k]);
  });
}
applyLang();
syncMoneyInputs();
syncCagrDeleteButtons();
updateCagrToolVisibility(false);
updateMortgageModeUI();
updateCostsModeUI();
rerender();

})();
