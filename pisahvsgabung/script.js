(function(){
// Watermark logo (logos/logo.svg), preloaded for use in canvas/SVG exports
const WM_LOGO_SRC = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDY4MCA2ODAiIHJvbGU9ImltZyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8dGl0bGU+QXJjaGVkIEEgTG9nbzwvdGl0bGU+CiAgPGRlc2M+QSBzbGVlayB3aGl0ZSBsZXR0ZXIgQSB3aG9zZSBsZWdzIGZvbGxvdyB0aGUgY2lyY2xlIGN1cnZhdHVyZSwgc3Bhbm5pbmcgODAlIG9mIHRoZSBjaXJjbGUgaGVpZ2h0PC9kZXNjPgoKICA8Y2lyY2xlIGN4PSIzNDAiIGN5PSIzNDAiIHI9IjMwMCIgZmlsbD0iIzAwNTJjYyIvPgoKICA8IS0tIExlZnQgbGVnOiAxMTPCsCB0byAyNDXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyNDIsNTcwIEEgMjUwLDI1MCAwIDAgMSAyMzQsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFRvcCBhcmNoOiAyNDXCsCB0byAyOTXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyMzQsMTEzIEEgMjUwLDI1MCAwIDAgMSA0NDYsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFJpZ2h0IGxlZzogMjk1wrAgdG8gNjfCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSA0NDYsMTEzIEEgMjUwLDI1MCAwIDAgMSA0MzgsNTcwIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIENyb3NzYmFyIC0tPgogIDxsaW5lIHgxPSIxMTMiIHkxPSIzNTQiIHgyPSI1NjciIHkyPSIzNTQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNDIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K';
const wmLogoImg = new Image();
wmLogoImg.src = WM_LOGO_SRC;
const _wmMeasureCtx = document.createElement('canvas').getContext('2d');
function measureWmText(text, font){ _wmMeasureCtx.font = font; return _wmMeasureCtx.measureText(text).width; }

const $ = id => document.getElementById(id);

/* ── Translations ── */
const LANG = {
  en: {
    subtitle: 'Compare Indonesian personal income tax under separate filing (Pisah Harta) vs joint filing (Gabung Harta).',
    btnBack: '← Other Tools',
    tabInputs: '📊 Inputs',
    tabAdvanced: '📋 PTKP & Brackets',
    dependentsLabel: 'Number of Dependents (Tanggungan)',
    dep0: '0 — no dependents',
    dep1: '1 — one child (anak)',
    dep2: '2 — two children (anak)',
    dep3: '3 — three children (anak)',
    dependentsSub: 'Max 3 dependents (tanggungan). Adds Rp 4.5M per dependent to PTKP.',
    inputMethodLabel: 'Income Input Method',
    modeTotalBtn: 'Total + Split %',
    modeSplitBtn: 'Husband + Wife',
    totalSalaryLabel: 'Total Household Gross Salary',
    totalSalarySub: 'Combined annual gross salary of husband + wife.',
    wifeShareLabel: "Wife's share of income",
    wifeShareHelp: 'Percentage of total household salary earned by wife. Husband earns the remainder.',
    deductionLabel: 'Combined Annual Deductions (Pengurang)',
    deductionSub: "Biaya jabatan, iuran pensiun, or other allowable deductions. Applied to gross income before PTKP. Split proportionally by each spouse's income share.",
    husbandSalaryLabel: "Husband's Gross Salary",
    husbandSalarySub: 'Annual gross salary of the husband.',
    wifeSalaryLabel: "Wife's Gross Salary",
    wifeSalarySub: 'Annual gross salary of the wife.',
    combinedPrefix: 'Combined:',
    wifeSharePrefix: 'Wife share:',
    husbandDeductionLabel: "Husband's Annual Deductions (Pengurang)",
    husbandDeductionSub: "Applied only to husband's gross income before PTKP.",
    wifeDeductionLabel: "Wife's Annual Deductions (Pengurang)",
    wifeDeductionSub: "Applied only to wife's gross income before PTKP.",
    ptkpSectionLabel: 'PTKP Values (Rp)',
    ptkpTK0: 'TK/0 — Single (base)',
    ptkpK: 'K — Married addition',
    ptkpI: 'I — Working spouse addition',
    ptkpDep: 'Per dependent (tanggungan)',
    ptkpComputedPrefix: 'Computed PTKP → Pisah:',
    ptkpHLabel: '(H)',
    ptkpWLabel: '(W)',
    ptkpGLabel: 'Gabung:',
    bracketSectionLabel: 'Tax Brackets (PPh 21)',
    bracketFrom: 'From (Rp)',
    bracketToHtml: 'To (Rp) <span style="font-size:0.68rem">(blank=∞)</span>',
    bracketRate: 'Rate (%)',
    bracketHelp: 'Edit thresholds and rates. "From" is auto-managed. Last bracket has no upper bound.',
    infoBoxHtml: '<strong>Pisah Harta (K/0 + TK/0):</strong> Each spouse files their own SPT. Husband uses PTKP K/tanggungan, wife uses PTKP TK/0. Double bracket access.<br><br><strong>Gabung Harta (K/I/0):</strong> Combined income, single SPT. Uses PTKP K/I/tanggungan. One bracket ladder for all income.',
    resetBtn: '↺ Reset',
    kpiPisahLabel: 'Pisah Harta — Total Tax',
    kpiGabungLabel: 'Gabung Harta — Total Tax',
    kpiSavingLabel: 'Tax Savings (Cheaper Option)',
    effectiveRate: 'Effective Rate:',
    noSignificantDiff: 'No significant difference',
    pisahWins: '✅ Pisah Harta wins',
    gabungWins: '✅ Gabung Harta wins',
    posTitle: '📍 Your Current Tax Position',
    posMaxMarginal: 'Max Marginal Bracket',
    posEffPisah: 'Effective Rate — Pisah',
    posEffGabung: 'Effective Rate — Gabung',
    margFrom: 'from',
    chart1Title: 'Total Tax by Household Salary',
    chart1Sub: 'Shows total tax payable across salary range. The gap between lines = tax savings.',
    chart1XTitle: 'Total Household Salary',
    chart1YTitle: 'Total Tax Payable',
    resetZoom: '⟳ Reset zoom',
    hoverBox1: 'Hover over the chart to inspect a salary point.',
    chart2Title: 'Tax Difference (Gabung − Pisah)',
    chart2Sub: 'Positive = Gabung Harta pays more (Pisah Harta wins). Negative = Gabung Harta pays less (Gabung Harta wins).',
    chart2YTitle: 'Tax Difference (positive = Pisah wins)',
    hoverBox2: 'Hover over the chart to inspect the difference.',
    legendPisah: 'Pisah Harta (K/0 + TK/0)',
    legendGabung: 'Gabung Harta (K/I/0)',
    legendPisahWins: 'Pisah Harta wins (positive)',
    legendGabungWins: 'Gabung Harta wins (negative)',
    salaryLabel: 'Salary',
    pisahSavesPrefix: 'Pisah saves:',
    gabungSavesPrefix: 'Gabung saves:',
    summaryTitle: 'Summary at Current Salary',
    crossoverTitle: 'Crossover Analysis',
    tilePtkpHusband: 'PTKP Husband (Pisah)',
    tilePtkpWife: 'PTKP Wife (Pisah)',
    tileTotalPtkpPisah: 'Total PTKP Pisah',
    tileGrosssalary: 'Gross Salary',
    tileDeductions: 'Deductions (Pengurang)',
    tileNetIncome: 'Net Income (after deductions)',
    tileHusbandNet: 'Husband Net Income',
    tileWifeNet: 'Wife Net Income',
    crossoverWith: 'With',
    crossoverWifePct: '% wife income:',
    crossoverWastedHtml: 'The non-earning spouse\'s PTKP is entirely wasted under Pisah Harta. Gabung Harta consolidates all PTKP into one filing, making it <span class="negative">beneficial</span> at this split.',
    crossoverAdjust: 'Adjust the income split to see where Pisah Harta becomes advantageous due to double bracket access.',
    crossoverPoint: 'Crossover point:',
    crossoverBelowPre: 'Below this salary, <span class="negative">Gabung Harta (K/I/',
    crossoverBelowPost: ')</span> may pay less because the higher combined PTKP is utilized more efficiently relative to income.',
    crossoverAbovePre: 'Above this salary, <span class="positive">Pisah Harta (K/',
    crossoverAbovePost: '+ TK/0)</span> wins because each spouse accesses lower tax brackets independently.',
    crossoverNoneFound: 'No crossover found in range.',
    crossoverPisahBetterPre: 'At this income split (',
    crossoverPisahBetterPost: '%), <span class="positive">Pisah Harta</span> is better (or equal) across the entire salary range. Both schemes have the same total PTKP at even splits, but Pisah Harta benefits from dual bracket access.',
    crossoverGabungBetterHtml: 'At this income split, <span class="negative">Gabung Harta</span> appears advantageous across the range. This typically occurs when the income split is very uneven.',
    detailTitle: 'Detailed Breakdown by Salary',
    tabComparison: 'Comparison',
    tabPisah: 'Pisah Harta Detail',
    tabGabung: 'Gabung Harta Detail',
    tblSalary: 'Salary',
    tblTaxPayables: 'Tax Payables',
    tblDifference: 'Difference',
    tblWinner: 'Winner',
    tblEffRate: 'Effective Rate',
    tblNetIncome: 'Net Income',
    tblPTKP: 'PTKP',
    tblTaxableIncome: 'Taxable Income',
    tblHusband: 'Husband',
    tblWife: 'Wife',
    tblTotalTax: 'Total Tax',
    tblPisah: 'Pisah',
    tblGabung: 'Gabung',
    tblProportional: 'Tax Payables (Proportional)',
    tblSame: '—',
    tblPisahWin: 'Pisah',
    tblGabungWin: 'Gabung',
    warnWife0: "⚠️ With 0% wife income, Pisah Harta wastes wife's PTKP (Rp 54M) entirely. Gabung Harta is strongly recommended.",
    warnHusband0Pre: "⚠️ With 100% wife income (0% husband), Pisah Harta wastes husband's PTKP (K/",
    warnHusband0Post: ') entirely. Gabung Harta is strongly recommended.',
    warnDeductExceed: '⚠️ Deductions (pengurang) exceed gross salary. Net income is set to Rp 0.',
    warnSpouseExceed: '⚠️ One spouse deduction exceeds that spouse gross salary. Net income for that spouse is set to Rp 0.',
  },
  id: {
    subtitle: 'Bandingkan PPh orang pribadi di Indonesia antara skema Pisah Harta dan Gabung Harta.',
    btnBack: '← Alat Lainnya',
    tabInputs: '📊 Masukan',
    tabAdvanced: '📋 PTKP & Lapisan Pajak',
    dependentsLabel: 'Jumlah Tanggungan',
    dep0: '0 — tidak ada tanggungan',
    dep1: '1 — satu anak',
    dep2: '2 — dua anak',
    dep3: '3 — tiga anak',
    dependentsSub: 'Maksimal 3 tanggungan. Setiap tanggungan menambah Rp 4,5 juta ke PTKP.',
    inputMethodLabel: 'Cara Input Penghasilan',
    modeTotalBtn: 'Total + % Bagi',
    modeSplitBtn: 'Suami + Istri',
    totalSalaryLabel: 'Total Gaji Kotor Rumah Tangga',
    totalSalarySub: 'Total gaji kotor tahunan suami dan istri.',
    wifeShareLabel: 'Porsi penghasilan istri',
    wifeShareHelp: 'Persentase dari total gaji rumah tangga yang diperoleh istri. Suami memperoleh sisanya.',
    deductionLabel: 'Total Potongan Tahunan (Pengurang)',
    deductionSub: 'Biaya jabatan, iuran pensiun, atau pengurang lain yang diperbolehkan. Diterapkan pada penghasilan kotor sebelum PTKP. Dibagi secara proporsional sesuai porsi penghasilan masing-masing.',
    husbandSalaryLabel: 'Gaji Kotor Suami',
    husbandSalarySub: 'Gaji kotor tahunan suami.',
    wifeSalaryLabel: 'Gaji Kotor Istri',
    wifeSalarySub: 'Gaji kotor tahunan istri.',
    combinedPrefix: 'Total:',
    wifeSharePrefix: 'Porsi istri:',
    husbandDeductionLabel: 'Potongan Tahunan Suami (Pengurang)',
    husbandDeductionSub: 'Hanya diterapkan pada penghasilan kotor suami sebelum PTKP.',
    wifeDeductionLabel: 'Potongan Tahunan Istri (Pengurang)',
    wifeDeductionSub: 'Hanya diterapkan pada penghasilan kotor istri sebelum PTKP.',
    ptkpSectionLabel: 'Nilai PTKP (Rp)',
    ptkpTK0: 'TK/0 — Tidak Kawin (dasar)',
    ptkpK: 'K — Tambahan Kawin',
    ptkpI: 'I — Tambahan Istri/Suami Bekerja',
    ptkpDep: 'Per tanggungan',
    ptkpComputedPrefix: 'PTKP dihitung → Pisah:',
    ptkpHLabel: '(S)',
    ptkpWLabel: '(I)',
    ptkpGLabel: 'Gabung:',
    bracketSectionLabel: 'Lapisan Tarif PPh 21',
    bracketFrom: 'Dari (Rp)',
    bracketToHtml: 'Sampai (Rp) <span style="font-size:0.68rem">(kosong=∞)</span>',
    bracketRate: 'Tarif (%)',
    bracketHelp: 'Edit ambang batas dan tarif. Kolom "Dari" dikelola otomatis. Lapisan terakhir tidak punya batas atas.',
    infoBoxHtml: '<strong>Pisah Harta (K/0 + TK/0):</strong> Masing-masing pasangan mengajukan SPT sendiri. Suami menggunakan PTKP K/tanggungan, istri menggunakan PTKP TK/0. Keduanya mengakses lapisan tarif secara terpisah.<br><br><strong>Gabung Harta (K/I/0):</strong> Penghasilan digabung dalam satu SPT bersama. Menggunakan PTKP K/I/tanggungan. Satu tangga lapisan tarif untuk seluruh penghasilan.',
    resetBtn: '↺ Atur Ulang',
    kpiPisahLabel: 'Pisah Harta — Total Pajak',
    kpiGabungLabel: 'Gabung Harta — Total Pajak',
    kpiSavingLabel: 'Penghematan Pajak',
    effectiveRate: 'Tarif Efektif:',
    noSignificantDiff: 'Tidak ada perbedaan signifikan',
    pisahWins: '✅ Pisah Harta lebih hemat',
    gabungWins: '✅ Gabung Harta lebih hemat',
    posTitle: '📍 Posisi Pajak Anda Saat Ini',
    posMaxMarginal: 'Tarif Marginal Tertinggi',
    posEffPisah: 'Tarif Efektif — Pisah',
    posEffGabung: 'Tarif Efektif — Gabung',
    margFrom: 'dari',
    chart1Title: 'Total Pajak berdasarkan Gaji Rumah Tangga',
    chart1Sub: 'Menampilkan total pajak terutang di berbagai tingkat gaji. Selisih antar garis = penghematan pajak.',
    chart1XTitle: 'Total Gaji Rumah Tangga',
    chart1YTitle: 'Total Pajak Terutang',
    resetZoom: '⟳ Reset zoom',
    hoverBox1: 'Arahkan kursor ke grafik untuk melihat detail gaji.',
    chart2Title: 'Selisih Pajak (Gabung − Pisah)',
    chart2Sub: 'Positif = Gabung Harta bayar lebih banyak (Pisah Harta menang). Negatif = Gabung Harta bayar lebih sedikit (Gabung Harta menang).',
    chart2YTitle: 'Selisih Pajak (positif = Pisah menang)',
    hoverBox2: 'Arahkan kursor ke grafik untuk melihat selisihnya.',
    legendPisah: 'Pisah Harta (K/0 + TK/0)',
    legendGabung: 'Gabung Harta (K/I/0)',
    legendPisahWins: 'Pisah Harta menang (positif)',
    legendGabungWins: 'Gabung Harta menang (negatif)',
    salaryLabel: 'Gaji',
    pisahSavesPrefix: 'Pisah hemat:',
    gabungSavesPrefix: 'Gabung hemat:',
    summaryTitle: 'Ringkasan pada Gaji Saat Ini',
    crossoverTitle: 'Analisis Breakeven',
    tilePtkpHusband: 'PTKP Suami (Pisah)',
    tilePtkpWife: 'PTKP Istri (Pisah)',
    tileTotalPtkpPisah: 'Total PTKP Pisah',
    tileGrossalary: 'Gaji Kotor',
    tileGrosssalary: 'Gaji Kotor',
    tileDeductions: 'Potongan (Pengurang)',
    tileNetIncome: 'Penghasilan Bersih (setelah potongan)',
    tileHusbandNet: 'Penghasilan Bersih Suami',
    tileWifeNet: 'Penghasilan Bersih Istri',
    crossoverWith: 'Dengan',
    crossoverWifePct: '% penghasilan istri:',
    crossoverWastedHtml: 'PTKP pasangan yang tidak berpenghasilan terbuang sia-sia dalam skema Pisah Harta. Gabung Harta menggabungkan semua PTKP dalam satu SPT, sehingga lebih <span class="negative">menguntungkan</span> pada pembagian ini.',
    crossoverAdjust: 'Ubah pembagian penghasilan untuk melihat di mana Pisah Harta menjadi lebih menguntungkan berkat akses lapisan tarif ganda.',
    crossoverPoint: 'Breakeven:',
    crossoverBelowPre: 'Di bawah gaji ini, <span class="negative">Gabung Harta (K/I/',
    crossoverBelowPost: ')</span> bisa lebih hemat karena PTKP gabungan yang lebih besar dimanfaatkan lebih efisien relatif terhadap penghasilan.',
    crossoverAbovePre: 'Di atas gaji ini, <span class="positive">Pisah Harta (K/',
    crossoverAbovePost: '+ TK/0)</span> lebih unggul karena masing-masing pasangan mengakses lapisan tarif yang lebih rendah secara terpisah.',
    crossoverNoneFound: 'Tidak ditemukan breakeven dalam rentang ini.',
    crossoverPisahBetterPre: 'Pada pembagian penghasilan ini (',
    crossoverPisahBetterPost: '%), <span class="positive">Pisah Harta</span> lebih baik (atau sama) di seluruh rentang gaji. Kedua skema memiliki total PTKP yang sama pada pembagian merata, namun Pisah Harta diuntungkan oleh akses lapisan tarif ganda.',
    crossoverGabungBetterHtml: 'Pada pembagian penghasilan ini, <span class="negative">Gabung Harta</span> tampak lebih menguntungkan di seluruh rentang. Hal ini umumnya terjadi ketika pembagian penghasilan sangat tidak merata.',
    detailTitle: 'Rincian Detail per Gaji',
    tabComparison: 'Perbandingan',
    tabPisah: 'Detail Pisah Harta',
    tabGabung: 'Detail Gabung Harta',
    tblSalary: 'Gaji',
    tblTaxPayables: 'Pajak Terutang',
    tblDifference: 'Selisih',
    tblWinner: 'Lebih Hemat',
    tblEffRate: 'Tarif Efektif',
    tblNetIncome: 'Penghasilan Bersih',
    tblPTKP: 'PTKP',
    tblTaxableIncome: 'Penghasilan Kena Pajak',
    tblHusband: 'Suami',
    tblWife: 'Istri',
    tblTotalTax: 'Total Pajak',
    tblPisah: 'Pisah',
    tblGabung: 'Gabung',
    tblProportional: 'Pajak Terutang (Proporsional)',
    tblSame: '—',
    tblPisahWin: 'Pisah',
    tblGabungWin: 'Gabung',
    warnWife0: '⚠️ Dengan 0% penghasilan istri, PTKP istri (Rp 54 juta) terbuang sia-sia dalam Pisah Harta. Gabung Harta sangat disarankan.',
    warnHusband0Pre: '⚠️ Dengan 100% penghasilan istri (suami 0%), PTKP suami (K/',
    warnHusband0Post: ') terbuang sia-sia dalam Pisah Harta. Gabung Harta sangat disarankan.',
    warnDeductExceed: '⚠️ Potongan (pengurang) melebihi gaji kotor. Penghasilan bersih ditetapkan Rp 0.',
    warnSpouseExceed: '⚠️ Potongan salah satu pasangan melebihi gaji kotor pasangan tersebut. Penghasilan bersih pasangan itu ditetapkan Rp 0.',
  }
};

let lang = (window.DEFAULT_LANG === 'id') ? 'id' : 'en';
function T(key){ return LANG[lang][key] || LANG['en'][key] || key; }

function applyLang() {
  // Static text nodes
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const val = LANG[lang][key];
    if (val !== undefined) el.textContent = val;
  });
  // Select options
  document.querySelectorAll('[data-i18n-opt]').forEach(el => {
    const key = el.dataset.i18nOpt;
    const val = LANG[lang][key];
    if (val !== undefined) el.textContent = val;
  });
  // Info box (HTML)
  $('infoBoxContent').innerHTML = T('infoBoxHtml');
  // Bracket column headers
  $('bracketColFrom').textContent = T('bracketFrom');
  $('bracketColTo').innerHTML = T('bracketToHtml');
  $('bracketColRate').textContent = T('bracketRate');
}

/* ── Formatters ── */
const fmt = {
  idr(v, compact=false){
    const n=Number(v||0);const abs=Math.abs(n);const sign=n<0?'−':'';
    if(compact&&abs>=1e12) return sign+'Rp '+(abs/1e12).toFixed(2)+'T';
    if(compact&&abs>=1e9) return sign+'Rp '+(abs/1e9).toFixed(2)+'B';
    if(compact&&abs>=1e6) return sign+'Rp '+(abs/1e6).toFixed(1)+'M';
    if(compact&&abs>=1e3) return sign+'Rp '+(abs/1e3).toFixed(0)+'K';
    return sign+'Rp '+Math.abs(n).toLocaleString('en-US',{maximumFractionDigits:0});
  },
  pct(v,d=2){const n=Number(v||0);const p=Math.abs(n)<=1?n*100:n;return p.toFixed(d)+'%';},
  num(v,d=0){return Number(v||0).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});},
  salaryLabel(mio){
    if(mio>=1000) return 'Rp '+(mio/1000).toFixed(mio%1000===0?0:1)+'B';
    return 'Rp '+fmt.num(mio)+'M';
  }
};

/* ── Tax constants ── */
const PTKP_BASE_DEFAULT    = 54000000;
const PTKP_MARRIED_DEFAULT = 4500000;
const PTKP_SPOUSE_DEFAULT  = 54000000;
const PTKP_DEPENDENT_DEFAULT = 4500000;

const BRACKETS_DEFAULT = [
  { from:0,         to: 60000000,    rate: 0.05 },
  { from:60000001,  to: 250000000,   rate: 0.15 },
  { from:250000001, to: 500000000,   rate: 0.25 },
  { from:500000001, to: 5000000000,  rate: 0.30 },
  { from:5000000001,to: null,        rate: 0.35 },
];

function calcTaxProgressive(income) {
  if (income <= 0) return 0;
  let tax = 0;
  let remaining = income;
  let prev = 0;
  for (const b of S.brackets) {
    const top = b.to !== null ? b.to : Infinity;
    const width = top - prev;
    const chunk = Math.min(remaining, width);
    tax += chunk * b.rate;
    remaining -= chunk;
    prev = top;
    if (remaining <= 0) break;
  }
  return tax;
}

function marginalBracket(income) {
  if (income <= 0) return S.brackets[0];
  for (let i = S.brackets.length - 1; i >= 0; i--) {
    if (income > S.brackets[i].from) return S.brackets[i];
  }
  return S.brackets[0];
}

const DEFAULTS = {
  dependents: 0,
  splitPct: 50,
  totalSalary: 500000000,
  deduction: 0,
  husbandDeduction: 0,
  wifeDeduction: 0,
  inputMode: 'total',
  husbandSalary: 250000000,
  wifeSalary: 250000000,
  ptkpBase: PTKP_BASE_DEFAULT,
  ptkpMarried: PTKP_MARRIED_DEFAULT,
  ptkpSpouse: PTKP_SPOUSE_DEFAULT,
  ptkpDependent: PTKP_DEPENDENT_DEFAULT,
  brackets: JSON.parse(JSON.stringify(BRACKETS_DEFAULT)),
};

let S = JSON.parse(JSON.stringify(DEFAULTS));

const els = {
  dependents: $('dependents'),
  splitPct: $('splitPct'),
  totalSalaryInput: $('totalSalaryInput'),
  husbandSalaryInput: $('husbandSalaryInput'),
  wifeSalaryInput: $('wifeSalaryInput'),
  deductionInput: $('deductionInput'),
  husbandDeductionInput: $('husbandDeductionInput'),
  wifeDeductionInput: $('wifeDeductionInput'),
  resetBtn: $('resetBtn'),
  chart1PngBtn: $('chart1PngBtn'),
  chart1CopyPngBtn: $('chart1CopyPngBtn'),
  chart1SvgBtn: $('chart1SvgBtn'),
  chart2PngBtn: $('chart2PngBtn'),
  chart2CopyPngBtn: $('chart2CopyPngBtn'),
  chart2SvgBtn: $('chart2SvgBtn'),
  downloadBtn: $('downloadBtn'),
  bracketsContainer: $('bracketsContainer'),
  ptkpBase: $('ptkpBase'),
  ptkpMarried: $('ptkpMarried'),
  ptkpSpouse: $('ptkpSpouse'),
  ptkpDependent: $('ptkpDependent'),
};

let latestRows = [];
let activeTab = 'comparison';
let chartInstance = null;
let chartInstance2 = null;

function cssVar(name){return getComputedStyle(document.body).getPropertyValue(name).trim();}

function readInputs(){
  S.dependents = parseInt(els.dependents.value)||0;
  S.ptkpBase      = parseInt(els.ptkpBase.value.replace(/[^0-9]/g,''))||PTKP_BASE_DEFAULT;
  S.ptkpMarried   = parseInt(els.ptkpMarried.value.replace(/[^0-9]/g,''))||PTKP_MARRIED_DEFAULT;
  S.ptkpSpouse    = parseInt(els.ptkpSpouse.value.replace(/[^0-9]/g,''))||PTKP_SPOUSE_DEFAULT;
  S.ptkpDependent = parseInt(els.ptkpDependent.value.replace(/[^0-9]/g,''))||PTKP_DEPENDENT_DEFAULT;

  if (S.inputMode === 'individual') {
    S.husbandSalary = Math.max(0, SharedFmt.parseFormatted(els.husbandSalaryInput.value));
    S.wifeSalary = Math.max(0, SharedFmt.parseFormatted(els.wifeSalaryInput.value));
    S.husbandDeduction = Math.max(0, SharedFmt.parseFormatted(els.husbandDeductionInput.value));
    S.wifeDeduction = Math.max(0, SharedFmt.parseFormatted(els.wifeDeductionInput.value));
    S.totalSalary = S.husbandSalary + S.wifeSalary;
    S.deduction = S.husbandDeduction + S.wifeDeduction;
    S.splitPct = S.totalSalary > 0 ? Math.round((S.wifeSalary / S.totalSalary) * 100) : 50;
    $('combinedLabel').textContent = 'Rp ' + S.totalSalary.toLocaleString('en-US');
    $('splitDerivedLabel').textContent = (S.totalSalary > 0 ? (S.wifeSalary/S.totalSalary*100).toFixed(1) : '50.0') + '%';
  } else {
    S.splitPct = Math.max(0,Math.min(100,parseFloat(els.splitPct.value)||0));
    S.totalSalary = Math.max(0, SharedFmt.parseFormatted(els.totalSalaryInput.value));
    S.husbandDeduction = 0;
    S.wifeDeduction = 0;
    S.deduction = Math.max(0, SharedFmt.parseFormatted(els.deductionInput.value));
  }
}

function refreshSliderLabels(){
  const sv=$('splitValue');
  if(sv) sv.textContent = S.splitPct + '%';
}

function computeModel() {
  const dep = S.dependents;
  const wifePct = S.splitPct / 100;
  const husbandPct = 1 - wifePct;

  const ptkpHusband_pisah = S.ptkpBase + S.ptkpMarried + dep * S.ptkpDependent;
  const ptkpWife_pisah    = S.ptkpBase;
  const ptkpGabung        = S.ptkpBase + S.ptkpMarried + S.ptkpSpouse + dep * S.ptkpDependent;

  if($('ptkpHDisplay')) $('ptkpHDisplay').textContent = fmt.idr(ptkpHusband_pisah,true);
  if($('ptkpWDisplay')) $('ptkpWDisplay').textContent = fmt.idr(ptkpWife_pisah,true);
  if($('ptkpGDisplay')) $('ptkpGDisplay').textContent = fmt.idr(ptkpGabung,true);

  const totalDeductionRate = S.totalSalary > 0 ? S.deduction / S.totalSalary : 0;
  const husbandDeductionRate = S.inputMode === 'individual'
    ? (S.husbandSalary > 0 ? S.husbandDeduction / S.husbandSalary : 0)
    : totalDeductionRate;
  const wifeDeductionRate = S.inputMode === 'individual'
    ? (S.wifeSalary > 0 ? S.wifeDeduction / S.wifeSalary : 0)
    : totalDeductionRate;

  const rows = [];
  const salaries = [];
  for(let s=100;s<=1000;s+=20) salaries.push(s);
  for(let s=1100;s<=5000;s+=100) salaries.push(s);

  for (const salMio of salaries) {
    const totalGross = salMio * 1e6;
    const wifeGross = totalGross * wifePct;
    const husbandGross = totalGross * husbandPct;
    const husbandDeduction = husbandGross * husbandDeductionRate;
    const wifeDeduction = wifeGross * wifeDeductionRate;
    const totalDeduction = husbandDeduction + wifeDeduction;
    const husbandNet = Math.max(0, husbandGross - husbandDeduction);
    const wifeNet = Math.max(0, wifeGross - wifeDeduction);
    const netIncome = husbandNet + wifeNet;

    const taxableH_p = Math.max(0, husbandNet - ptkpHusband_pisah);
    const taxableW_p = Math.max(0, wifeNet - ptkpWife_pisah);
    const taxH_p = calcTaxProgressive(taxableH_p);
    const taxW_p = calcTaxProgressive(taxableW_p);
    const totalTax_p = taxH_p + taxW_p;

    const taxableG = Math.max(0, netIncome - ptkpGabung);
    const totalTax_g = calcTaxProgressive(taxableG);
    const taxH_g = netIncome > 0 ? totalTax_g * (husbandNet / netIncome) : 0;
    const taxW_g = netIncome > 0 ? totalTax_g * (wifeNet / netIncome) : 0;

    const diff = totalTax_g - totalTax_p;

    rows.push({
      salary: salMio, totalGross, totalDeduction, netIncome,
      pisahTax: totalTax_p, gabungTax: totalTax_g, diff,
      pisahRate: totalGross > 0 ? totalTax_p / totalGross : 0,
      gabungRate: totalGross > 0 ? totalTax_g / totalGross : 0,
      husbandGross, wifeGross,
      husbandNet, wifeNet,
      ptkpH: ptkpHusband_pisah, ptkpW: ptkpWife_pisah,
      taxableH: taxableH_p, taxableW: taxableW_p,
      taxH: taxH_p, taxW: taxW_p,
      ptkpGabung, taxableGabung: taxableG,
      taxH_g, taxW_g,
    });
  }

  let crossover = null;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i-1].diff * rows[i].diff < 0) {
      const r0=rows[i-1], r1=rows[i];
      crossover = r0.salary + (r1.salary - r0.salary) * Math.abs(r0.diff) / (Math.abs(r0.diff) + Math.abs(r1.diff));
      break;
    }
  }

  const currentHusbandGross = S.totalSalary * husbandPct;
  const currentWifeGross = S.totalSalary * wifePct;
  const currentHusbandDeduction = S.inputMode === 'individual' ? S.husbandDeduction : S.deduction * husbandPct;
  const currentWifeDeduction = S.inputMode === 'individual' ? S.wifeDeduction : S.deduction * wifePct;
  const curHusbandNet = Math.max(0, currentHusbandGross - currentHusbandDeduction);
  const curWifeNet = Math.max(0, currentWifeGross - currentWifeDeduction);
  const currentNet = curHusbandNet + curWifeNet;

  const curTxH_p = Math.max(0, curHusbandNet - ptkpHusband_pisah);
  const curTxW_p = Math.max(0, curWifeNet - ptkpWife_pisah);
  const curTaxH_p = calcTaxProgressive(curTxH_p);
  const curTaxW_p = calcTaxProgressive(curTxW_p);
  const curTaxP = curTaxH_p + curTaxW_p;

  const curTxG = Math.max(0, currentNet - ptkpGabung);
  const curTaxG = calcTaxProgressive(curTxG);

  const maxTaxableForMarginal = Math.max(curTxH_p, curTxW_p, curTxG);
  const marginal = marginalBracket(maxTaxableForMarginal);

  const current = {
    totalGross: S.totalSalary, totalDeduction: S.deduction, netIncome: currentNet,
    pisahTax: curTaxP, gabungTax: curTaxG, diff: curTaxG - curTaxP,
    pisahRate: S.totalSalary > 0 ? curTaxP / S.totalSalary : 0,
    gabungRate: S.totalSalary > 0 ? curTaxG / S.totalSalary : 0,
    husbandGross: currentHusbandGross, wifeGross: currentWifeGross,
    husbandNet: curHusbandNet, wifeNet: curWifeNet,
    ptkpH: ptkpHusband_pisah, ptkpW: ptkpWife_pisah, ptkpGabung,
    taxableH: curTxH_p, taxableW: curTxW_p, taxableGabung: curTxG,
    marginalRate: marginal.rate,
    marginalBracketFrom: marginal.from,
  };

  return { rows, summary: { current, crossover, ptkpH: ptkpHusband_pisah, ptkpW: ptkpWife_pisah, ptkpGabung } };
}

/* ── Charts ── */
function buildLegend(id, series){
  const el=$(id);el.innerHTML='';
  series.forEach(s=>{
    const item=document.createElement('div');item.className='legend-item';
    item.innerHTML=`<span class="dot" style="background:${cssVar(s.colorVar)}"></span><span>${s.label}</span>`;
    el.appendChild(item);
  });
}

function renderMainChart(rows){
  const series=[
    {key:'pisahTax',colorVar:'--line-a',label:T('legendPisah')},
    {key:'gabungTax',colorVar:'--line-b',label:T('legendGabung')},
  ];
  buildLegend('chartLegend',series);
  const labels=rows.map(r=>r.salary);
  const datasets=series.map(s=>({
    label:s.label,data:rows.map(r=>r[s.key]??0),
    borderColor:cssVar(s.colorVar),backgroundColor:cssVar(s.colorVar)+'22',
    borderWidth:2.5,pointRadius:0,pointHoverRadius:5,tension:0.3,fill:false,
  }));
  const gridColor=cssVar('--chart-grid'),mutedColor=cssVar('--chart-text'),textColor=cssVar('--text');
  const config={
    type:'line',data:{labels,datasets},
    options:{
      responsive:true,maintainAspectRatio:false,animation:{duration:300},
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{display:false},
        tooltip:{
          callbacks:{
            title:ctx=>T('salaryLabel')+' '+fmt.salaryLabel(ctx[0].label),
            label:ctx=>'  '+ctx.dataset.label.split('(')[0].trim()+': '+fmt.idr(ctx.parsed.y,true),
          },
          backgroundColor:cssVar('--panel-raised'),titleColor:textColor,bodyColor:mutedColor,borderColor:gridColor,borderWidth:1,padding:10,
          onAfterBody:(items)=>{
            if(!items.length)return;
            const parts=items.map(i=>i.dataset.label.split('(')[0].trim()+': '+fmt.idr(i.parsed.y,true)).join('  |  ');
            $('hoverBox').textContent=T('salaryLabel')+' '+fmt.salaryLabel(items[0].label)+'  —  '+parts;
          }
        },
        zoom:{pan:{enabled:true,mode:'x'},zoom:{wheel:{enabled:true,speed:0.08},pinch:{enabled:true},mode:'x'}},
      },
      scales:{
        x:{ticks:{color:mutedColor,maxTicksLimit:12,font:{size:11},callback:(v,i)=>fmt.salaryLabel(labels[i])},grid:{color:gridColor},title:{display:true,text:T('chart1XTitle'),color:mutedColor}},
        y:{ticks:{color:mutedColor,font:{size:11},callback:v=>fmt.idr(v,true)},grid:{color:gridColor},title:{display:true,text:T('chart1YTitle'),color:mutedColor}},
      }
    }
  };
  if(chartInstance){
    chartInstance.data.labels=labels;chartInstance.data.datasets=datasets;
    chartInstance.options.scales.x.ticks.color=mutedColor;chartInstance.options.scales.x.grid.color=gridColor;
    chartInstance.options.scales.x.title.text=T('chart1XTitle');
    chartInstance.options.scales.y.ticks.color=mutedColor;chartInstance.options.scales.y.grid.color=gridColor;
    chartInstance.options.scales.y.title.text=T('chart1YTitle');
    chartInstance.update('none');
  } else {
    chartInstance=new Chart($('chartCanvas'),config);
  }
}

function renderDiffChart(rows){
  buildLegend('chartLegend2',[
    {colorVar:'--line-a',label:T('legendPisahWins')},
    {colorVar:'--line-b',label:T('legendGabungWins')},
  ]);
  const labels=rows.map(r=>r.salary);
  const diffData=rows.map(r=>r.diff);
  const gridColor=cssVar('--chart-grid'),mutedColor=cssVar('--chart-text'),textColor=cssVar('--text');
  const config={
    type:'line',
    data:{labels,datasets:[
      {label:T('legendPisahWins'),data:diffData.map(d=>d>=0?d:null),borderColor:cssVar('--line-a'),backgroundColor:cssVar('--line-a')+'22',borderWidth:2.5,pointRadius:0,pointHoverRadius:5,tension:0.3,fill:false,spanGaps:false},
      {label:T('legendGabungWins'),data:diffData.map(d=>d<0?d:null),borderColor:cssVar('--line-b'),backgroundColor:cssVar('--line-b')+'22',borderWidth:2.5,pointRadius:0,pointHoverRadius:5,tension:0.3,fill:false,spanGaps:false},
      {label:'Full line',data:diffData,borderColor:cssVar('--muted')+'44',borderWidth:1,pointRadius:0,tension:0.3,fill:false,borderDash:[4,4]},
    ]},
    options:{
      responsive:true,maintainAspectRatio:false,animation:{duration:300},
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{display:false},
        tooltip:{
          callbacks:{
            title:ctx=>T('salaryLabel')+' '+fmt.salaryLabel(ctx[0].label),
            label:ctx=>{
              if(ctx.datasetIndex===2)return null;
              const v=ctx.parsed.y;if(v==null)return null;
              return v>=0?'  '+T('pisahSavesPrefix')+' '+fmt.idr(v,true):'  '+T('gabungSavesPrefix')+' '+fmt.idr(-v,true);
            },
          },
          filter:item=>item.datasetIndex<2&&item.parsed.y!=null,
          backgroundColor:cssVar('--panel-raised'),titleColor:textColor,bodyColor:mutedColor,borderColor:gridColor,borderWidth:1,padding:10,
          onAfterBody:(items)=>{
            if(!items.length)return;
            const v=rows[items[0].dataIndex]?.diff||0;
            $('hoverBox2').textContent=T('salaryLabel')+' '+fmt.salaryLabel(items[0].label)+'  —  '+(v>=0?T('pisahSavesPrefix')+' '+fmt.idr(v,true):T('gabungSavesPrefix')+' '+fmt.idr(-v,true));
          }
        },
        zoom:{pan:{enabled:true,mode:'x'},zoom:{wheel:{enabled:true,speed:0.08},pinch:{enabled:true},mode:'x'}},
      },
      scales:{
        x:{ticks:{color:mutedColor,maxTicksLimit:12,font:{size:11},callback:(v,i)=>fmt.salaryLabel(labels[i])},grid:{color:gridColor},title:{display:true,text:T('chart1XTitle'),color:mutedColor}},
        y:{ticks:{color:mutedColor,font:{size:11},callback:v=>fmt.idr(v,true)},grid:{color:gridColor},title:{display:true,text:T('chart2YTitle'),color:mutedColor}},
      }
    }
  };
  if(chartInstance2){
    chartInstance2.data.labels=labels;chartInstance2.data.datasets=config.data.datasets;
    chartInstance2.options.scales.x.ticks.color=mutedColor;chartInstance2.options.scales.x.grid.color=gridColor;
    chartInstance2.options.scales.x.title.text=T('chart1XTitle');
    chartInstance2.options.scales.y.ticks.color=mutedColor;chartInstance2.options.scales.y.grid.color=gridColor;
    chartInstance2.options.scales.y.title.text=T('chart2YTitle');
    chartInstance2.update('none');
  } else {
    chartInstance2=new Chart($('chartCanvas2'),config);
  }
}

function updateKPIs(state){
  const c=state.summary.current;
  $('kpiPisah').textContent=fmt.idr(c.pisahTax,true);
  $('kpiPisahRate').textContent=T('effectiveRate')+' '+fmt.pct(c.pisahRate);
  $('kpiGabung').textContent=fmt.idr(c.gabungTax,true);
  $('kpiGabungRate').textContent=T('effectiveRate')+' '+fmt.pct(c.gabungRate);

  const diff=c.diff;
  const absDiff=Math.abs(diff);
  if(absDiff<1000){
    $('kpiSaving').textContent='≈ Rp 0';
    $('kpiSaving').className='value';
    $('kpiWinner').textContent=T('noSignificantDiff');
  } else if(diff>0){
    $('kpiSaving').textContent=fmt.idr(absDiff,true);
    $('kpiSaving').className='value positive';
    $('kpiWinner').textContent=T('pisahWins');
  } else {
    $('kpiSaving').textContent=fmt.idr(absDiff,true);
    $('kpiSaving').className='value negative';
    $('kpiWinner').textContent=T('gabungWins');
  }

  $('posP_ptkpH').textContent = fmt.idr(c.ptkpH, true);
  $('posP_ptkpW').textContent = fmt.idr(c.ptkpW, true);
  $('posG_ptkp').textContent  = fmt.idr(c.ptkpGabung, true);
  const margRate = (c.marginalRate * 100).toFixed(0) + '%';
  const margFrom = fmt.idr(c.marginalBracketFrom, true);
  $('posMarginBracket').textContent = margRate + ' (' + T('margFrom') + ' ' + margFrom + ')';
  $('posEffPisah').textContent  = fmt.pct(c.pisahRate);
  $('posEffGabung').textContent = fmt.pct(c.gabungRate);
}

function updateSummary(state){
  const c=state.summary.current;
  const s=state.summary;
  const grid=$('summaryGrid');
  const tiles=[
    {label:T('tilePtkpHusband'),value:fmt.idr(s.ptkpH,true)},
    {label:T('tilePtkpWife'),value:fmt.idr(s.ptkpW,true)},
    {label:T('tileTotalPtkpPisah'),value:fmt.idr(s.ptkpH+s.ptkpW,true)},
    {label:'PTKP Gabung (K/I/'+S.dependents+')',value:fmt.idr(s.ptkpGabung,true)},
    {label:T('tileGrossalary'),value:fmt.idr(c.totalGross,true)},
    {label:T('tileDeductions'),value:fmt.idr(c.totalDeduction,true)},
    {label:T('tileNetIncome'),value:fmt.idr(c.netIncome,true)},
    {label:T('tileHusbandNet'),value:fmt.idr(c.husbandNet,true)},
    {label:T('tileWifeNet'),value:fmt.idr(c.wifeNet,true)},
  ];
  grid.innerHTML=tiles.map(t=>`<div class="tile"><div class="label">${t.label}</div><div class="value">${t.value}</div></div>`).join('');

  const info=$('crossoverInfo');
  if(S.splitPct===0 || S.splitPct===100){
    info.innerHTML=`<strong>${T('crossoverWith')} ${S.splitPct}${T('crossoverWifePct')}</strong><br>${T('crossoverWastedHtml')}<br><br>${T('crossoverAdjust')}`;
  } else if(s.crossover){
    info.innerHTML='<strong>'+T('crossoverPoint')+'</strong> ~'+fmt.salaryLabel(Math.round(s.crossover))+'<br><br>'+T('crossoverBelowPre')+S.dependents+T('crossoverBelowPost')+'<br><br>'+T('crossoverAbovePre')+S.dependents+'/'+T('crossoverAbovePost');
  } else {
    const last=state.rows[state.rows.length-1];
    if(last.diff>=0){
      info.innerHTML='<strong>'+T('crossoverNoneFound')+'</strong><br><br>'+T('crossoverPisahBetterPre')+S.splitPct+T('crossoverPisahBetterPost');
    } else {
      info.innerHTML='<strong>'+T('crossoverNoneFound')+'</strong><br><br>'+T('crossoverGabungBetterHtml');
    }
  }
}

function updateDetailTable(rows){
  const wrap=$('detailTable');
  const milestones=[100,150,200,250,300,400,500,600,750,1000,1250,1500,2000,2500,3000,4000,5000];
  const filtered=milestones.map(m=>rows.find(r=>r.salary>=m)).filter(Boolean);
  const seen=new Set();const unique=[];
  filtered.forEach(r=>{if(!seen.has(r.salary)){seen.add(r.salary);unique.push(r);}});

  if(activeTab==='comparison'){
    wrap.innerHTML=`<table>
      <thead>
        <tr>
          <th rowspan="2">${T('tblSalary')}</th>
          <th colspan="2" class="tbl-group-header">${T('tblTaxPayables')}</th>
          <th rowspan="2">${T('tblDifference')}</th>
          <th rowspan="2">${T('tblWinner')}</th>
          <th colspan="2" class="tbl-group-header">${T('tblEffRate')}</th>
        </tr>
        <tr>
          <th>${T('tblPisah')}</th>
          <th>${T('tblGabung')}</th>
          <th>${T('tblPisah')}</th>
          <th>${T('tblGabung')}</th>
        </tr>
      </thead>
      <tbody>${unique.map(r=>{
        const d=r.diff;const cls=d>1000?'positive':d<-1000?'negative':'';
        const w=Math.abs(d)<1000?T('tblSame'):d>0?T('tblPisahWin'):T('tblGabungWin');
        return `<tr><td>${fmt.salaryLabel(r.salary)}</td><td>${fmt.idr(r.pisahTax,true)}</td><td>${fmt.idr(r.gabungTax,true)}</td><td class="${cls}">${d>=0?'+':''}${fmt.idr(d,true)}</td><td>${w}</td><td>${fmt.pct(r.pisahRate)}</td><td>${fmt.pct(r.gabungRate)}</td></tr>`;
      }).join('')}</tbody></table>`;
  } else if(activeTab==='pisah'){
    wrap.innerHTML=`<table>
      <thead>
        <tr>
          <th rowspan="2">${T('tblSalary')}</th>
          <th colspan="2" class="tbl-group-header">${T('tblNetIncome')}</th>
          <th colspan="2" class="tbl-group-header">${T('tblPTKP')}</th>
          <th colspan="2" class="tbl-group-header">${T('tblTaxableIncome')}</th>
          <th colspan="2" class="tbl-group-header">${T('tblTaxPayables')}</th>
          <th rowspan="2">${T('tblTotalTax')}</th>
        </tr>
        <tr>
          <th>${T('tblHusband')}</th>
          <th>${T('tblWife')}</th>
          <th>${T('tblHusband')}</th>
          <th>${T('tblWife')}</th>
          <th>${T('tblHusband')}</th>
          <th>${T('tblWife')}</th>
          <th>${T('tblHusband')}</th>
          <th>${T('tblWife')}</th>
        </tr>
      </thead>
      <tbody>${unique.map(r=>`<tr><td>${fmt.salaryLabel(r.salary)}</td><td>${fmt.idr(r.husbandNet,true)}</td><td>${fmt.idr(r.wifeNet,true)}</td><td>${fmt.idr(r.ptkpH,true)}</td><td>${fmt.idr(r.ptkpW,true)}</td><td>${fmt.idr(r.taxableH,true)}</td><td>${fmt.idr(r.taxableW,true)}</td><td>${fmt.idr(r.taxH,true)}</td><td>${fmt.idr(r.taxW,true)}</td><td>${fmt.idr(r.pisahTax,true)}</td></tr>`).join('')}</tbody></table>`;
  } else {
    wrap.innerHTML=`<table>
      <thead>
        <tr>
          <th rowspan="2">${T('tblSalary')}</th>
          <th rowspan="2">${T('tblNetIncome')}</th>
          <th rowspan="2">PTKP K/I/${S.dependents}</th>
          <th rowspan="2">${T('tblTaxableIncome')}</th>
          <th rowspan="2">${T('tblTotalTax')}</th>
          <th colspan="2" class="tbl-group-header">${T('tblProportional')}</th>
        </tr>
        <tr>
          <th>${T('tblHusband')}</th>
          <th>${T('tblWife')}</th>
        </tr>
      </thead>
      <tbody>${unique.map(r=>`<tr><td>${fmt.salaryLabel(r.salary)}</td><td>${fmt.idr(r.netIncome,true)}</td><td>${fmt.idr(r.ptkpGabung,true)}</td><td>${fmt.idr(r.taxableGabung,true)}</td><td>${fmt.idr(r.gabungTax,true)}</td><td>${fmt.idr(r.taxH_g,true)}</td><td>${fmt.idr(r.taxW_g,true)}</td></tr>`).join('')}</tbody></table>`;
  }
}

/* ── Main loop ── */
function rerender(){
  readInputs();
  refreshSliderLabels();

  const warn=$('capWarning');
  if(S.splitPct===0){
    warn.style.display='block';
    warn.textContent=T('warnWife0');
  } else if(S.splitPct===100){
    warn.style.display='block';
    warn.textContent=T('warnHusband0Pre')+S.dependents+T('warnHusband0Post');
  } else {
    warn.style.display='none';
  }

  if(S.inputMode === 'total' && S.deduction > S.totalSalary){
    warn.style.display='block';
    warn.textContent=T('warnDeductExceed');
  }
  if(S.inputMode === 'individual' && (S.husbandDeduction > S.husbandSalary || S.wifeDeduction > S.wifeSalary)){
    warn.style.display='block';
    warn.textContent=T('warnSpouseExceed');
  }

  const state=computeModel();
  latestRows=state.rows;

  renderMainChart(state.rows);
  renderDiffChart(state.rows);
  updateKPIs(state);
  updateSummary(state);
  updateDetailTable(state.rows);
}

/* ── Reset ── */
function resetAll(){
  S=JSON.parse(JSON.stringify(DEFAULTS));
  S.brackets=JSON.parse(JSON.stringify(BRACKETS_DEFAULT));
  els.dependents.value=DEFAULTS.dependents;
  els.splitPct.value=DEFAULTS.splitPct;
  els.totalSalaryInput.value=DEFAULTS.totalSalary.toLocaleString('en-US');
  els.husbandSalaryInput.value=DEFAULTS.husbandSalary.toLocaleString('en-US');
  els.wifeSalaryInput.value=DEFAULTS.wifeSalary.toLocaleString('en-US');
  els.deductionInput.value='0';
  els.husbandDeductionInput.value='0';
  els.wifeDeductionInput.value='0';
  els.ptkpBase.value=DEFAULTS.ptkpBase.toLocaleString('en-US');
  els.ptkpMarried.value=DEFAULTS.ptkpMarried.toLocaleString('en-US');
  els.ptkpSpouse.value=DEFAULTS.ptkpSpouse.toLocaleString('en-US');
  els.ptkpDependent.value=DEFAULTS.ptkpDependent.toLocaleString('en-US');
  setInputMode('total');
  buildBracketEditor();
  rerender();
}

/* ── Input mode toggle ── */
function setInputMode(mode){
  S.inputMode = mode;
  $('modeTotal').style.display = mode==='total' ? '' : 'none';
  $('modeIndividual').style.display = mode==='individual' ? '' : 'none';
  $('modeBtnTotal').classList.toggle('active', mode==='total');
  $('modeBtnSplit').classList.toggle('active', mode==='individual');
  rerender();
}

/* ── Bracket number formatting helpers ── */
function formatBracketNum(n){ return n===null||n===undefined?'':Number(n).toLocaleString('en-US'); }
function parseBracketNum(str){ return str===''?null:parseInt(str.replace(/[^0-9]/g,''),10)||0; }
function formatBracketInput(el){
  const raw=el.value.replace(/[^0-9]/g,'');
  if(raw===''){el.value='';return;}
  const n=parseInt(raw,10)||0;
  el.value=n.toLocaleString('en-US');
}

/* ── Bracket editor ── */
function buildBracketEditor(){
  const container = els.bracketsContainer;
  container.innerHTML='';
  S.brackets.forEach((b,i)=>{
    const row = document.createElement('div');
    row.className='bracket-row';

    const fromEl = document.createElement('input');
    fromEl.className='num-input-sm';
    fromEl.type='text';
    fromEl.value=formatBracketNum(b.from);
    fromEl.disabled=true;

    const toEl = document.createElement('input');
    toEl.className='num-input-sm';
    toEl.type='text';
    toEl.inputMode='numeric';
    toEl.placeholder='∞';
    if(b.to!==null) toEl.value=formatBracketNum(b.to);
    toEl.disabled=(i===S.brackets.length-1);
    toEl.addEventListener('input',function(){
      const pos=this.selectionStart, oldLen=this.value.length;
      formatBracketInput(this);
      const newLen=this.value.length;
      this.setSelectionRange(Math.max(0,pos+(newLen-oldLen)),Math.max(0,pos+(newLen-oldLen)));
    });
    toEl.addEventListener('change',()=>{
      const newTo=toEl.value===''?null:parseBracketNum(toEl.value);
      S.brackets[i].to=newTo;
      if(i+1<S.brackets.length&&newTo!==null){
        S.brackets[i+1].from=newTo+1;
      }
      buildBracketEditor();
      rerender();
    });

    const rateEl = document.createElement('input');
    rateEl.className='num-input-sm';
    rateEl.type='number';
    rateEl.min=0;rateEl.max=100;rateEl.step=0.5;
    rateEl.value=(b.rate*100).toFixed(1);
    rateEl.addEventListener('change',()=>{
      S.brackets[i].rate=Math.max(0,Math.min(100,parseFloat(rateEl.value)||0))/100;
      rerender();
    });

    row.appendChild(fromEl);
    row.appendChild(toEl);
    row.appendChild(rateEl);
    container.appendChild(row);
  });
}

/* ── PNG ── */
function downloadChartPng(canvasId, filename, chartTitle, legendId, shouldDownload = true) {
  const src = document.getElementById(canvasId);
  if(!src) return;
  const dpr = window.devicePixelRatio || 1;
  const OUT = 3;
  const chartW = Math.round(src.width / dpr * OUT);
  const chartH = Math.round(src.height / dpr * OUT);
  const isLight = document.body.classList.contains('light');
  const bgColor = isLight ? '#ffffff' : '#0F1728';
  const fgColor = isLight ? '#2D3436' : '#EAF1FF';
  const FONT = '"DM Sans", sans-serif';

  const legendItems = [];
  if(legendId){
    const legendEl = document.getElementById(legendId);
    if(legendEl){
      legendEl.querySelectorAll('.legend-item:not(.hidden)').forEach(item => {
        const dot = item.querySelector('.dot');
        const label = item.textContent.trim();
        const color = dot ? window.getComputedStyle(dot).backgroundColor : '#888888';
        if(label) legendItems.push({ label, color });
      });
    }
  }

  const titleFontPx = Math.round(14 * OUT);
  const legendFontPx = Math.round(11 * OUT);
  const titleH = chartTitle ? Math.round(40 * OUT) : 0;
  const legendH = legendItems.length ? Math.round(34 * OUT) : 0;

  const tmp = document.createElement('canvas');
  tmp.width = chartW;
  tmp.height = chartH + titleH + legendH;
  const ctx = tmp.getContext('2d');

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, tmp.width, tmp.height);

  if(chartTitle){
    ctx.font = `700 ${titleFontPx}px ${FONT}`;
    ctx.fillStyle = fgColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(chartTitle, tmp.width / 2, titleH / 2);
  }

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
    const wmText = 'Made using tool.adjiebrotots.com/pisahvsgabung';
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
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
  }
  return tmp;
}
async function copyCanvasPngToClipboard(canvas) {
  if(!navigator.clipboard || !window.ClipboardItem) throw new Error('Clipboard image copy is not supported in this browser.');
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if(!blob) throw new Error('Could not create PNG blob.');
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

function downloadChartSvg(canvasId, filename, chartTitle, legendId) {
  const src = document.getElementById(canvasId);
  if(!src) return;
  const dpr = window.devicePixelRatio || 1;
  const chartW = Math.round(src.width / dpr);
  const chartH = Math.round(src.height / dpr);
  const isLight = document.body.classList.contains('light');
  const bgColor = isLight ? '#ffffff' : '#0F1728';
  const fgColor = isLight ? '#2D3436' : '#EAF1FF';
  const FONT = 'DM Sans, sans-serif';
  const legendItems = [];
  if(legendId){
    const legendEl = document.getElementById(legendId);
    if(legendEl){
      legendEl.querySelectorAll('.legend-item:not(.hidden)').forEach(item => {
        const dot = item.querySelector('.dot');
        const label = item.textContent.trim();
        const color = dot ? window.getComputedStyle(dot).backgroundColor : '#888888';
        if(label) legendItems.push({ label, color });
      });
    }
  }
  const titleH = chartTitle ? 40 : 0;
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
  if(chartTitle){
    const t = document.createElementNS(NS,'text');
    t.setAttribute('x',svgW/2); t.setAttribute('y',titleH/2);
    t.setAttribute('text-anchor','middle'); t.setAttribute('dominant-baseline','middle');
    t.setAttribute('font-family',FONT); t.setAttribute('font-size','14'); t.setAttribute('font-weight','700'); t.setAttribute('fill',fgColor);
    t.textContent = chartTitle; svg.appendChild(t);
  }
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
  wm.textContent = 'Made using tool.adjiebrotots.com/pisahvsgabung'; svg.appendChild(wm);
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
  const a = document.createElement('a'); a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
els.chart1PngBtn.addEventListener('click', () => downloadChartPng('chartCanvas', 'pisah_vs_gabung_chart1.png', T('chart1Title'), 'chartLegend'));
els.chart1CopyPngBtn.addEventListener('click', async () => {
  try { await copyCanvasPngToClipboard(downloadChartPng('chartCanvas', 'pisah_vs_gabung_chart1.png', T('chart1Title'), 'chartLegend', false)); alert('PNG copied to clipboard.'); }
  catch(err){ alert('PNG copy failed: ' + err.message); }
});
els.chart2PngBtn.addEventListener('click', () => downloadChartPng('chartCanvas2', 'pisah_vs_gabung_chart2.png', T('chart2Title'), 'chartLegend2'));
els.chart2CopyPngBtn.addEventListener('click', async () => {
  try { await copyCanvasPngToClipboard(downloadChartPng('chartCanvas2', 'pisah_vs_gabung_chart2.png', T('chart2Title'), 'chartLegend2', false)); alert('PNG copied to clipboard.'); }
  catch(err){ alert('PNG copy failed: ' + err.message); }
});
els.chart1SvgBtn.addEventListener('click', () => downloadChartSvg('chartCanvas', 'pisah_vs_gabung_chart1.svg', T('chart1Title'), 'chartLegend'));
els.chart2SvgBtn.addEventListener('click', () => downloadChartSvg('chartCanvas2', 'pisah_vs_gabung_chart2.svg', T('chart2Title'), 'chartLegend2'));

/* ── CSV ── */
function downloadCsv(){
  if(!latestRows.length)return;
  const h=['Salary_Mio','HusbandGross','WifeGross','Deduction','NetIncome','PTKP_H_Pisah','PTKP_W_Pisah','TaxableH_Pisah','TaxableW_Pisah','TaxH_Pisah','TaxW_Pisah','TotalTax_Pisah','PTKP_Gabung','Taxable_Gabung','TotalTax_Gabung','Difference','Winner','EffRate_Pisah','EffRate_Gabung'];
  const lines=latestRows.map(r=>{
    const w=Math.abs(r.diff)<1000?'Same':r.diff>0?'Pisah':'Gabung';
    return [r.salary,r.husbandGross,r.wifeGross,r.totalDeduction,r.netIncome,r.ptkpH,r.ptkpW,r.taxableH,r.taxableW,r.taxH,r.taxW,r.pisahTax,r.ptkpGabung,r.taxableGabung,r.gabungTax,r.diff,w,(r.pisahRate*100).toFixed(2)+'%',(r.gabungRate*100).toFixed(2)+'%'].join(',');
  });
  const csv='# Made using tool.adjiebrotots.com/pisahvsgabung\n'+[h.join(','),...lines].join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='pisah_vs_gabung_harta.csv';
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}

/* ── Event wiring ── */
['input','change'].forEach(evt=>{
  els.splitPct.addEventListener(evt,rerender);
});

[els.totalSalaryInput, els.deductionInput, els.husbandSalaryInput, els.wifeSalaryInput, els.husbandDeductionInput, els.wifeDeductionInput].forEach(el=>{
  SharedFmt.attachCurrencyInput(el, {maxDecimals:0, onChange: rerender});
});

[els.ptkpBase, els.ptkpMarried, els.ptkpSpouse, els.ptkpDependent].forEach(el=>{
  el.addEventListener('input',function(){
    const pos=this.selectionStart, oldLen=this.value.length;
    formatBracketInput(this);
    const newLen=this.value.length;
    this.setSelectionRange(Math.max(0,pos+(newLen-oldLen)),Math.max(0,pos+(newLen-oldLen)));
    rerender();
  });
  el.addEventListener('blur',function(){ formatBracketInput(this); rerender(); });
});

$('modeBtnTotal').addEventListener('click',()=>setInputMode('total'));
$('modeBtnSplit').addEventListener('click',()=>setInputMode('individual'));

els.dependents.addEventListener('change',rerender);
els.resetBtn.addEventListener('click',resetAll);
els.downloadBtn.addEventListener('click',downloadCsv);

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
    activeTab=btn.dataset.scenario;
    if(latestRows.length)updateDetailTable(latestRows);
  });
});

$('themeToggle').addEventListener('click',()=>{
  document.body.classList.toggle('light');
  $('themeToggle').textContent=document.body.classList.contains('light')?'🌙 Dark':'☀️ Light';
  if(latestRows&&latestRows.length){
    if(chartInstance){chartInstance.destroy();chartInstance=null;}
    if(chartInstance2){chartInstance2.destroy();chartInstance2=null;}
    rerender();
  }
});

$('chartResetZoom').addEventListener('click',()=>{if(chartInstance)chartInstance.resetZoom();});
$('chartResetZoom2').addEventListener('click',()=>{if(chartInstance2)chartInstance2.resetZoom();});

$('chartCanvas').addEventListener('mouseleave',()=>{$('hoverBox').textContent=T('hoverBox1');});
$('chartCanvas2').addEventListener('mouseleave',()=>{$('hoverBox2').textContent=T('hoverBox2');});

/* ── Init ── */
buildBracketEditor();
rerender();

})();
