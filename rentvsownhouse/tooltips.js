// Shared tooltip definitions for the Rent vs Own calculator.
// Used by both rentvsownhouse/index.html and rentvsownhouse/sensitivity/index.html.
//
// One tip, one thought: what the field is, plus the single thing a reader would
// otherwise get wrong. A tip is read standing up in a small bubble, so anything
// longer goes unread.
//
// A tip that explains options lists them, <strong>name:</strong> first, in a
// <ul> of at most three short items. Past that, it is a set of VARIANTS keyed
// by the option selected, and explains that option only; RVO_OPTION_TIPS names
// those, and the shared tooltip adds a small line saying the other options
// have their own. A variant can also follow a state rather than an option
// (monthlyBudgetIncrease). The page sets the state with data-tip-variant and
// RVO_APPLY_TIPS picks it up; anything that cannot say which state it is in
// gets the first variant.
var RVO_TIPS_EN = {
  propertyPrice:        "Market price you would pay today. It sets the starting house equity and the loan size.",
  downPaymentPct:       "Share of the price paid upfront. 100% models an all-cash buy, and the renter invests the same amount instead. 20% is not always best.",
  mortgageMode: {
    simple:   "<strong>Simple:</strong> principal and interest at one rate for the whole term.",
    detailed: "<strong>Detailed:</strong> adds the loan type, cost accounting, and a year-by-year rate schedule."
  },
  mortgageType:         "<ul><li><strong>Principal &amp; Interest:</strong> each payment cuts the balance, building equity.</li><li><strong>Interest Only:</strong> builds no equity. The balance is repaid from cash at the end.</li></ul>",
  costInterestOnly:     "What Accumulated cost counts.<ul><li><strong>On:</strong> interest and ongoing costs, since principal becomes equity.</li><li><strong>Off:</strong> the whole repayment and ongoing costs.</li></ul>",
  mortgageRate:         "Annual rate on the loan, held flat for the whole term. It sets the repayment and the total interest.",
  rateSchedule:         "Rates by year of the loan, each period <strong>Fixed</strong> or <strong>Floating</strong> in a band. Rent-Then-Buy starts this schedule at its year 1 when it buys.",
  mortgageTerm:         "Years the loan is amortised over. Longer means a smaller repayment and more interest. Once it is repaid, the whole budget turns into savings.",
  sellingCost:          "Agent, marketing, legal and seller taxes if the home is sold. House and net equity are shown after it, as if sold that year.",
  houseGrowth:          "How fast house prices grow each year (RPPI). It drives house equity and the Rent-Then-Buy price. The tool below works it out from past prices.",
  ownCostsMode: {
    simple:   "<strong>Simple:</strong> one setup cost and one ongoing cost.",
    detailed: "<strong>Detailed:</strong> each cost on its own line. Setup as $ or % of price, ongoing per week, month or year with its own inflation, or % of value."
  },
  rentCostsMode: {
    simple:   "<strong>Simple:</strong> one ongoing cost of renting.",
    detailed: "<strong>Detailed:</strong> each cost on its own line, per week, month or year with its own inflation, or as a % of annual rent."
  },
  setupCost:            "One-off costs at purchase: stamp duty, conveyancing, inspection. Paid from savings. A later Rent-Then-Buy purchase scales them to its price.",
  ownOngoingCost:       "Yearly costs beyond the loan: rates, insurance, maintenance, strata, land tax. Fixed amounts grow at their own inflation, % items track the value.",
  ownOngoingInflation:  "Yearly rise in fixed-dollar ownership costs. A % of property value already grows with the house.",
  rentAmount:           "Rent as it stands today, per week, month or year. It grows each year at rent inflation, and any budget surplus above it is invested.",
  rentInflation:        "How fast rent rises each year, historically around CPI or a little above. Faster rent erodes the renter's surplus.",
  rentOngoingCost:      "Costs on top of the rent: contents and renters' insurance, connection fees. No rates or building upkeep, so well below the owner's.",
  rentOngoingInflation: "Yearly rise in fixed-dollar renting costs. A % of annual rent already grows with rent inflation.",
  riskFreeRate:         "What spare cash earns each year, like a savings account. It applies in every scenario.",
  initialCash:          "Cash you hold today. Owning spends it on the deposit and setup cost, renting invests all of it. Blank covers what every scenario needs up front, a later deposit included.",
  monthlyBudget:        "Monthly cash for housing. Blank follows the highest cost of any scenario each year, repayments at the top of a floating range, so every scenario can pay at any rate.",
  monthlyBudgetIncrease: {
    manual: "Compounds your monthly budget each year, for wage growth or CPI. It widens the surplus, or shrinks the shortfall, over time.",
    auto:   "Grows the monthly budget each year. Inert while the budget is automatic, so set a budget above for it to bite."
  },
  horizon:              "How many years the comparison runs, up to 100. A longer run lets property growth and the loan payoff play out.",
  rtbEnabled:           "A third scenario: rent for some years, then buy at the price by then, on the same budget. A blank budget or cash grows to fund it, which also moves Own and Rent.",
  rtbBuyAtYear:         "Buy at the end of this year, at the price grown by RPPI. The mortgage starts then as a new loan: full term, rate schedule from its year 1.",
  calcCagr:             "Enter year and price pairs. The yearly growth they imply (CAGR) is applied to House price growth above.",
  graphMetric:          "<ul><li><strong>Net equity:</strong> the home if sold, minus the loan, plus cash.</li><li><strong>Liquid cash:</strong> cash in the bank.</li><li><strong>Accumulated cost:</strong> what housing has cost so far.</li></ul>",
  cashflowTable:        "<ul><li><strong>Cash position:</strong> cash in and out that year.</li><li><strong>Mortgage position:</strong> the home and the loan.</li><li><strong>Financial position:</strong> net equity and accumulated cost.</li></ul>",
  // Sensitivity page: the figures every column shares, and multi-currency mode.
  sensRiskFree: {
    single: "What spare cash earns each year, like a savings account. One rate for every column, so no column wins on interest alone.",
    multi:  "What spare cash earns each year, one rate per currency. Every column in a currency shares its rate."
  },
  sensInitialCash: {
    single: "Cash you hold today, the same in every column. Owning spends it on the deposit and setup, renting invests it. Blank takes the most any column needs.",
    multi:  "Cash you hold today in the base currency, the same in every column at its exchange rate. Blank takes the most any column needs up front."
  },
  sensMonthlyBudget: {
    single: "Monthly cash for housing, the same in every column. Blank takes, each month, the most any column needs, so a cheaper home banks the difference.",
    multi:  "Monthly cash for housing in the base currency, the same in every column at its exchange rate. Blank takes the most any column needs each month."
  },
  fxMode:       "Compare homes priced in different currencies. Results and charts are in the base currency, and every column gets the same cash and budget at its exchange rate.",
  scenCurrency: "The currency this column's prices, rents and costs are in. Changing it relabels the figures, it does not convert them.",
  fxRate:       "Units of this column's currency one unit of the base buys today, from ExchangeRate-API. Type your own, or clear it for the live rate.",
  fxPath:       "<ul><li><strong>Moves with the rate gap:</strong> a currency paying more interest weakens by the gap, so interest alone wins nothing.</li><li><strong>Held at today's rate:</strong> it never moves.</li><li><strong>Expected appreciation/depreciation:</strong> it moves by the yearly change you expect for each currency.</li></ul>",
  fxTrend:      "How much each currency is expected to gain or lose against the base every year. Minus is depreciation, plus is appreciation: -2% means 1 unit of the base buys 2% more of it each year.",
};
var RVO_TIPS_ID = {
  propertyPrice:        "Harga pasar properti saat ini. Menjadi nilai awal ekuitas rumah dan besaran KPR.",
  downPaymentPct:       "Persentase harga yang dibayar di muka. 100% berarti pembelian tunai, dan penyewa menginvestasikan jumlah yang sama. 20% tidak selalu optimal.",
  mortgageMode: {
    simple:   "<strong>Sederhana:</strong> Pokok &amp; Bunga dengan satu suku bunga untuk seluruh jangka waktu.",
    detailed: "<strong>Rinci:</strong> menambah jenis KPR, akuntansi biaya, dan jadwal bunga per periode."
  },
  mortgageType:         "<ul><li><strong>Pokok &amp; Bunga:</strong> tiap cicilan mengurangi saldo, membangun ekuitas.</li><li><strong>Bunga Saja:</strong> tidak membangun ekuitas. Pokok dilunasi dari kas di akhir.</li></ul>",
  costInterestOnly:     "Yang dihitung Biaya kumulatif.<ul><li><strong>Aktif:</strong> bunga dan biaya rutin, karena pokok menjadi ekuitas.</li><li><strong>Nonaktif:</strong> seluruh cicilan dan biaya rutin.</li></ul>",
  mortgageRate:         "Suku bunga tahunan KPR, tetap sepanjang jangka waktu. Menentukan besar cicilan dan total bunga.",
  rateSchedule:         "Bunga per tahun KPR, tiap periode <strong>Tetap</strong> atau <strong>Mengambang</strong> dalam pita. KPR Sewa Dulu memulai jadwal ini dari tahun ke-1 saat membeli.",
  mortgageTerm:         "Jumlah tahun pelunasan pinjaman. Lebih panjang berarti cicilan lebih kecil dan bunga lebih besar. Setelah lunas, seluruh anggaran menjadi tabungan.",
  sellingCost:          "Komisi agen, pemasaran, notaris dan pajak penjual jika rumah dijual. Ekuitas rumah dan bersih ditampilkan setelahnya, seolah dijual tahun itu.",
  houseGrowth:          "Kenaikan harga properti per tahun (RPPI). Mendorong nilai bersih properti dan harga beli Sewa Dulu. Alat di bawah menghitungnya dari harga historis.",
  ownCostsMode: {
    simple:   "<strong>Sederhana:</strong> satu biaya awal dan satu biaya rutin.",
    detailed: "<strong>Rinci:</strong> tiap biaya satu baris. Biaya awal nominal atau % harga, biaya rutin per minggu, bulan atau tahun dengan inflasinya, atau % nilai."
  },
  rentCostsMode: {
    simple:   "<strong>Sederhana:</strong> satu biaya rutin menyewa.",
    detailed: "<strong>Rinci:</strong> tiap biaya satu baris, per minggu, bulan atau tahun dengan inflasinya sendiri, atau % dari sewa tahunan."
  },
  setupCost:            "Biaya satu kali saat membeli: BPHTB, notaris, inspeksi. Dibayar dari tabungan. Pembelian Sewa Dulu di kemudian hari menyesuaikannya dengan harganya.",
  ownOngoingCost:       "Biaya tahunan di luar KPR: PBB, asuransi, perawatan, iuran pengelola. Nominal tetap naik sesuai inflasinya, item % mengikuti nilai properti.",
  ownOngoingInflation:  "Kenaikan tahunan biaya kepemilikan bernominal tetap. Item % dari nilai properti sudah naik bersama harga rumah.",
  rentAmount:           "Sewa saat ini, per minggu, bulan atau tahun. Naik tiap tahun sesuai kenaikan sewa, dan sisa anggaran di atasnya diinvestasikan.",
  rentInflation:        "Laju kenaikan sewa per tahun, secara historis sekitar CPI atau sedikit di atasnya. Semakin cepat, surplus penyewa makin terkikis.",
  rentOngoingCost:      "Biaya di luar sewa pokok: asuransi isi rumah, biaya koneksi utilitas. Tanpa PBB atau perawatan gedung, jadi jauh di bawah biaya pemilik.",
  rentOngoingInflation: "Kenaikan tahunan biaya menyewa bernominal tetap. Item % dari sewa tahunan sudah naik bersama kenaikan sewa.",
  riskFreeRate:         "Imbal hasil kas yang tidak terpakai per tahun, seperti tabungan atau deposito. Berlaku di semua skenario.",
  initialCash:          "Kas yang Anda miliki sekarang. Skenario Beli memakainya untuk DP dan biaya awal, Sewa menginvestasikan semuanya. Kosong berarti cukup untuk kebutuhan awal semua skenario, termasuk DP Sewa Dulu nanti.",
  monthlyBudget:        "Kas bulanan untuk biaya perumahan. Kosong berarti mengikuti biaya tertinggi semua skenario tiap tahun, cicilan pada batas atas bunga mengambang, jadi semua skenario sanggup membayar.",
  monthlyBudgetIncrease: {
    manual: "Menaikkan anggaran bulanan Anda tiap tahun secara berbunga, untuk kenaikan gaji atau CPI. Surplus melebar seiring waktu.",
    auto:   "Menaikkan anggaran bulanan tiap tahun. Tidak berpengaruh selama anggaran otomatis, jadi tetapkan anggaran di atas."
  },
  horizon:              "Berapa tahun perbandingan dijalankan, hingga 100 tahun. Makin panjang, efek kenaikan properti dan pelunasan KPR makin terlihat.",
  rtbEnabled:           "Skenario ketiga: menyewa X tahun, lalu membeli pada harga saat itu, dengan anggaran yang sama. Anggaran atau modal awal kosong ikut naik untuk mendanainya, jadi Beli dan Sewa ikut berubah.",
  rtbBuyAtYear:         "Membeli di akhir tahun ini, pada harga yang tumbuh sesuai RPPI. KPR baru dimulai saat itu: jangka waktu penuh, jadwal bunga dari tahun ke-1.",
  calcCagr:             "Masukkan pasangan tahun dan harga. Kenaikan tahunan (CAGR) hasilnya diterapkan ke Kenaikan harga properti di atas.",
  graphMetric:          "<ul><li><strong>Kekayaan bersih:</strong> rumah jika dijual, dikurangi pinjaman, ditambah kas.</li><li><strong>Uang tunai:</strong> kas di bank.</li><li><strong>Biaya kumulatif:</strong> total biaya perumahan sejauh ini.</li></ul>",
  cashflowTable:        "<ul><li><strong>Posisi kas:</strong> kas masuk dan keluar tahun itu.</li><li><strong>Posisi KPR:</strong> rumah dan pinjaman.</li><li><strong>Posisi keuangan:</strong> kekayaan bersih dan biaya kumulatif.</li></ul>",
  sensRiskFree: {
    single: "Imbal hasil kas yang tidak terpakai per tahun, seperti deposito. Satu suku bunga untuk semua kolom, jadi tak ada kolom yang menang hanya karena bunga.",
    multi:  "Imbal hasil kas yang tidak terpakai per tahun, satu suku bunga per mata uang. Semua kolom dalam mata uang yang sama memakai suku bunga yang sama."
  },
  sensInitialCash: {
    single: "Kas yang Anda miliki sekarang, sama di semua kolom. Beli memakainya untuk DP dan biaya awal, Sewa menginvestasikannya. Kosong berarti kebutuhan terbesar semua kolom.",
    multi:  "Kas yang Anda miliki sekarang dalam mata uang dasar, sama di semua kolom sesuai kursnya. Kosong berarti kebutuhan awal terbesar semua kolom."
  },
  sensMonthlyBudget: {
    single: "Kas bulanan untuk perumahan, sama di semua kolom. Kosong berarti kebutuhan terbesar semua kolom tiap bulan, jadi rumah yang lebih murah menabung selisihnya.",
    multi:  "Kas bulanan untuk perumahan dalam mata uang dasar, sama di semua kolom sesuai kursnya. Kosong berarti kebutuhan terbesar semua kolom tiap bulan."
  },
  fxMode:       "Bandingkan rumah dengan mata uang berbeda. Hasil dan grafik dalam mata uang dasar, dan tiap kolom mendapat kas dan anggaran yang sama sesuai kursnya.",
  scenCurrency: "Mata uang harga, sewa dan biaya kolom ini. Menggantinya hanya mengganti label angka, tidak mengonversinya.",
  fxRate:       "Jumlah mata uang kolom ini untuk satu unit mata uang dasar hari ini, dari ExchangeRate-API. Isi kurs sendiri, atau kosongkan untuk kurs terkini.",
  fxPath:       "<ul><li><strong>Mengikuti selisih bunga:</strong> mata uang berbunga lebih tinggi melemah sebesar selisihnya, jadi bunga saja tidak membuat menang.</li><li><strong>Tetap di kurs hari ini:</strong> kurs tidak bergerak.</li><li><strong>Perkiraan penguatan/pelemahan:</strong> kurs bergerak sesuai perubahan tahunan yang Anda perkirakan untuk tiap mata uang.</li></ul>",
  fxTrend:      "Seberapa besar tiap mata uang diperkirakan menguat atau melemah terhadap mata uang dasar setiap tahun. Minus berarti melemah, plus berarti menguat: -2% berarti 1 unit mata uang dasar mendapat 2% lebih banyak mata uang itu setiap tahun.",
};
// Variant tips keyed by the option selected: explained one option at a time,
// with the shared "change the option" line under them (data-tip-options).
var RVO_OPTION_TIPS = ['mortgageMode', 'ownCostsMode', 'rentCostsMode'];

// RVO_TIPS returns EN by default; pages switch to ID via RVO_TIPS_ID when needed
var RVO_TIPS = RVO_TIPS_EN;

/* Resolve one tip to the text a reader should see. `variant` is the state the
   control is in ('detailed', 'io', 'on'…); an unknown or missing one falls back
   to the first variant, which is what a page that cannot tell its state gets. */
function RVO_TIP(key, variant, tips){
  var v = (tips || RVO_TIPS)[key];
  if(v === undefined || v === null) return '';
  if(typeof v === 'string') return v;
  return (variant && v[variant]) || v[Object.keys(v)[0]] || '';
}

/* Write every [data-tip-key] element's tip, reading each one's own
   data-tip-variant. Safe to re-run: it is how both a language switch and a
   state change land. */
function RVO_APPLY_TIPS(tips, root){
  (root || document).querySelectorAll('[data-tip-key]').forEach(function(el){
    var key = el.getAttribute('data-tip-key');
    var text = RVO_TIP(key, el.getAttribute('data-tip-variant'), tips);
    if(text) el.setAttribute('data-tip', text);
    el.toggleAttribute('data-tip-options', RVO_OPTION_TIPS.indexOf(key) >= 0);
  });
}
