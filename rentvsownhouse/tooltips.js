// Shared tooltip definitions for the Rent vs Own calculator.
// Used by both rentvsownhouse/index.html and rentvsownhouse/sensitivity/index.html.
//
// One tip, one thought: what the field is, plus the single thing a reader would
// otherwise get wrong. A tip is read standing up in a small bubble, so anything
// longer goes unread.
//
// A tip is either a string, or a set of VARIANTS keyed by the state its control
// is in. A variant tip explains the state you are actually in and keeps one
// clause for what the other state would do, instead of listing every state at
// once and leaving the reader to find their own. The page sets the state with
// data-tip-variant and RVO_APPLY_TIPS picks it up; anything that cannot say
// which state it is in gets the first variant.
var RVO_TIPS_EN = {
  propertyPrice:        "Market price you would pay today. It sets the starting house equity and the loan size.",
  downPaymentPct:       "Share of the price paid upfront. 100% models an all-cash buy, and the renter invests the same amount instead. 20% is not always best.",
  mortgageMode: {
    simple:   "<strong>Simple:</strong> principal and interest at one rate for the whole term. Detailed adds the loan type, cost accounting and a rate schedule.",
    detailed: "<strong>Detailed:</strong> loan type, cost accounting, and a year-by-year rate schedule. Simple is one flat rate for the whole term."
  },
  mortgageType: {
    pi: "<strong>Principal &amp; Interest:</strong> every payment cuts the balance, so equity builds from the first one. Interest Only pays interest alone.",
    io: "<strong>Interest Only:</strong> payments cover interest alone, so they build no equity. The whole balance is repaid from cash when the term ends."
  },
  costInterestOnly: {
    on:  "<strong>On:</strong> Accumulated Cost counts interest and ongoing costs only, since principal becomes equity rather than money lost.",
    off: "<strong>Off:</strong> the whole repayment plus ongoing costs counts as an outgoing, principal included."
  },
  mortgageRate:         "Annual rate on the loan, held flat for the whole term. It sets the repayment and the total interest.",
  rateSchedule:         "Rates by year from today, each period <strong>Fixed</strong> or <strong>Floating</strong> in a band. A later Rent-Then-Buy loan pays the rates of the years it runs.",
  mortgageTerm:         "Years the loan is amortised over. Longer means a smaller repayment and more interest. Once it is repaid, the whole budget turns into savings.",
  sellingCost:          "Agent, marketing, legal and seller taxes if the home is sold. House and net equity are shown after it, as if sold that year.",
  houseGrowth:          "Annual property growth (RPPI). It drives house equity and the future price in Rent-Then-Buy. The CAGR tool below derives it from history.",
  ownCostsMode: {
    simple:   "<strong>Simple:</strong> one setup cost and one ongoing cost. Detailed lists each one, with its own unit, inflation or percentage basis.",
    detailed: "<strong>Detailed:</strong> each cost on its own line. Setup as $ or % of price, ongoing per week, month or year with its own inflation, or % of value."
  },
  rentCostsMode: {
    simple:   "<strong>Simple:</strong> one ongoing cost of renting. Detailed lists each one separately.",
    detailed: "<strong>Detailed:</strong> each cost on its own line, per week, month or year with its own inflation, or as a % of annual rent."
  },
  setupCost:            "One-off costs at purchase: stamp duty, conveyancing, inspection. Paid from savings. A later Rent-Then-Buy purchase scales them to its price.",
  ownOngoingCost:       "Yearly costs beyond the loan: rates, insurance, maintenance, strata, land tax. Fixed amounts grow at their own inflation, % items track the value.",
  ownOngoingInflation:  "Yearly rise in fixed-dollar ownership costs. A % of property value already grows with the house.",
  rentAmount:           "Rent as it stands today, per week, month or year. It grows each year at rent inflation, and any budget surplus above it is invested.",
  rentInflation:        "How fast rent rises each year, historically around CPI or a little above. Faster rent erodes the renter's surplus.",
  rentOngoingCost:      "Costs on top of the rent: contents and renters' insurance, connection fees. No rates or building upkeep, so well below the owner's.",
  rentOngoingInflation: "Yearly rise in fixed-dollar renting costs. A % of annual rent already grows with rent inflation.",
  riskFreeRate:         "Return on idle cash in every scenario. Cash below zero is borrowed instead, at the mortgage rate of that year.",
  initialCash:          "Cash you hold today. Buy spends it on the deposit and setup costs, Rent invests all of it. Blank means exactly deposit plus setup, nothing spare.",
  monthlyBudget:        "Monthly cash for housing. Blank follows the higher of rent or repayment each year, so a floating rate also moves what the renter invests.",
  monthlyBudgetIncrease: {
    manual: "Compounds your monthly budget each year, for wage growth or CPI. It widens the surplus, or shrinks the shortfall, over time.",
    auto:   "Grows the monthly budget each year. Inert while the budget is automatic, so set a budget above for it to bite."
  },
  horizon:              "Years to project. A longer run lets property compounding and the loan payoff play out. Up to 100.",
  rtbEnabled:           "A third scenario: rent for X years, then buy at the price by then, on the same budget. Switching it on leaves Own and Rent unchanged.",
  rtbBuyAtYear:         "Switch from renting to buying at this year. Property price grows at RPPI until then.",
  calcCagr:             "Enter year and price pairs. The resulting CAGR is applied to the House Price Growth slider above.",
};
var RVO_TIPS_ID = {
  propertyPrice:        "Harga pasar properti saat ini. Menjadi nilai awal ekuitas rumah dan besaran KPR.",
  downPaymentPct:       "Persentase harga yang dibayar di muka. 100% berarti pembelian tunai, dan penyewa menginvestasikan jumlah yang sama. 20% tidak selalu optimal.",
  mortgageMode: {
    simple:   "<strong>Sederhana:</strong> Pokok &amp; Bunga dengan satu suku bunga untuk seluruh jangka waktu. Rinci menambah jenis KPR, akuntansi biaya, dan jadwal bunga.",
    detailed: "<strong>Rinci:</strong> jenis KPR, akuntansi biaya, dan jadwal bunga per periode. Sederhana memakai satu suku bunga tetap."
  },
  mortgageType: {
    pi: "<strong>Pokok &amp; Bunga:</strong> tiap cicilan mengurangi saldo, jadi ekuitas bertambah sejak cicilan pertama. Bunga Saja hanya menutup bunga.",
    io: "<strong>Bunga Saja:</strong> cicilan hanya menutup bunga, jadi tidak membangun ekuitas. Seluruh pokok dilunasi dari kas saat jangka waktu berakhir."
  },
  costInterestOnly: {
    on:  "<strong>Aktif:</strong> Biaya Kumulatif hanya menghitung bunga dan biaya rutin, karena cicilan pokok menjadi ekuitas, bukan uang yang hilang.",
    off: "<strong>Nonaktif:</strong> seluruh cicilan ditambah biaya rutin dihitung sebagai pengeluaran, termasuk pokoknya."
  },
  mortgageRate:         "Suku bunga tahunan KPR, tetap sepanjang jangka waktu. Menentukan besar cicilan dan total bunga.",
  rateSchedule:         "Bunga per tahun sejak hari ini, tiap periode <strong>Tetap</strong> atau <strong>Mengambang</strong> dalam pita. KPR Sewa Dulu memakai bunga tahun-tahun ia berjalan.",
  mortgageTerm:         "Jumlah tahun pelunasan pinjaman. Lebih panjang berarti cicilan lebih kecil dan bunga lebih besar. Setelah lunas, seluruh anggaran menjadi tabungan.",
  sellingCost:          "Komisi agen, pemasaran, notaris dan pajak penjual jika rumah dijual. Ekuitas rumah dan bersih ditampilkan setelahnya, seolah dijual tahun itu.",
  houseGrowth:          "Pertumbuhan harga properti tahunan (RPPI). Mendorong ekuitas rumah dan harga beli pada skenario Sewa Dulu. Kalkulator CAGR di bawah menghitungnya dari data.",
  ownCostsMode: {
    simple:   "<strong>Sederhana:</strong> satu biaya awal dan satu biaya rutin. Rinci mendaftar tiap biaya dengan satuan, inflasi, atau dasar persentasenya sendiri.",
    detailed: "<strong>Rinci:</strong> tiap biaya satu baris. Biaya awal nominal atau % harga, biaya rutin per minggu, bulan atau tahun dengan inflasinya, atau % nilai."
  },
  rentCostsMode: {
    simple:   "<strong>Sederhana:</strong> satu biaya rutin menyewa. Rinci mendaftar tiap biaya satu per satu.",
    detailed: "<strong>Rinci:</strong> tiap biaya satu baris, per minggu, bulan atau tahun dengan inflasinya sendiri, atau % dari sewa tahunan."
  },
  setupCost:            "Biaya satu kali saat membeli: BPHTB, notaris, inspeksi. Dibayar dari tabungan. Pembelian Sewa Dulu di kemudian hari menyesuaikannya dengan harganya.",
  ownOngoingCost:       "Biaya tahunan di luar KPR: PBB, asuransi, perawatan, iuran pengelola. Nominal tetap naik sesuai inflasinya, item % mengikuti nilai properti.",
  ownOngoingInflation:  "Kenaikan tahunan biaya kepemilikan bernominal tetap. Item % dari nilai properti sudah naik bersama harga rumah.",
  rentAmount:           "Sewa saat ini, per minggu, bulan atau tahun. Naik tiap tahun sesuai kenaikan sewa, dan sisa anggaran di atasnya diinvestasikan.",
  rentInflation:        "Laju kenaikan sewa per tahun, secara historis sekitar CPI atau sedikit di atasnya. Semakin cepat, surplus penyewa makin terkikis.",
  rentOngoingCost:      "Biaya di luar sewa pokok: asuransi isi rumah, biaya koneksi utilitas. Tanpa PBB atau perawatan gedung, jadi jauh di bawah biaya pemilik.",
  rentOngoingInflation: "Kenaikan tahunan biaya menyewa bernominal tetap. Item % dari sewa tahunan sudah naik bersama kenaikan sewa.",
  riskFreeRate:         "Return atas kas menganggur di semua skenario. Kas di bawah nol dianggap pinjaman, dengan bunga KPR tahun itu.",
  initialCash:          "Kas yang Anda miliki sekarang. Skenario Beli memakainya untuk DP dan biaya awal, Sewa menginvestasikan semuanya. Kosong berarti tepat DP + biaya awal.",
  monthlyBudget:        "Kas bulanan untuk biaya perumahan. Kosong berarti mengikuti cicilan atau sewa tertinggi tiap tahun, jadi bunga mengambang ikut mengubah investasi penyewa.",
  monthlyBudgetIncrease: {
    manual: "Menaikkan anggaran bulanan Anda tiap tahun secara berbunga, untuk kenaikan gaji atau CPI. Surplus melebar seiring waktu.",
    auto:   "Menaikkan anggaran bulanan tiap tahun. Tidak berpengaruh selama anggaran otomatis, jadi tetapkan anggaran di atas."
  },
  horizon:              "Jumlah tahun proyeksi. Makin panjang, efek compounding properti dan pelunasan KPR makin terlihat. Hingga 100 tahun.",
  rtbEnabled:           "Skenario ketiga: menyewa X tahun, lalu membeli pada harga saat itu, dengan anggaran yang sama. Mengaktifkannya tidak mengubah Beli dan Sewa.",
  rtbBuyAtYear:         "Beralih dari menyewa ke membeli pada tahun ini. Harga properti tumbuh sesuai RPPI hingga saat itu.",
  calcCagr:             "Masukkan pasangan tahun dan harga. CAGR hasilnya diterapkan ke slider Kenaikan Harga Properti di atas.",
};
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
    var text = RVO_TIP(el.getAttribute('data-tip-key'), el.getAttribute('data-tip-variant'), tips);
    if(text) el.setAttribute('data-tip', text);
  });
}
