/* Konfigurasi tur berpemandu untuk Kalkulator Kebebasan Finansial (versi
   Indonesia). Mesin bersama (../../tour-shared.js) membaca objek ini. Setiap
   langkah harus menggambarkan apa yang benar-benar tampil di layar, jadi
   langkah yang membahas sebuah panel membuka panel itu lebih dulu.

   seenKey-nya sendiri, terpisah dari halaman Inggris, supaya pembaca yang
   berpindah bahasa tetap mendapat turnya sekali di bahasa yang ia pilih. */
window.__TOUR = {
  seenKey: 'ff-id-tour-v1-seen',
  launchLabel: '🧭 Ikuti tur',
  labels: { skip: 'Lewati tur', back: 'Kembali', next: 'Lanjut',
            start: 'Mulai', done: 'Selesai', dialog: 'Tur produk' },
  steps: [
    {
      target: null,
      title: '👋 Berapa yang cukup?',
      body: 'Tur ini menunjukkan cara menemukan <strong>dana yang Anda butuhkan sebelum bisa ' +
            'berhenti bekerja</strong>, dan <strong>di usia berapa Anda benar-benar sampai ke ' +
            'sana</strong>. Hanya sekitar satu menit.'
    },
    {
      target: '.quick-start-row',
      title: '① Mulai dari rencana yang sudah jadi',
      body: 'Satu klik mengisi seluruh tab dengan penabung yang sudah ada: penabung ' +
            '<strong>moderat</strong> 40%, penabung <strong>hemat</strong> yang hidup dengan ' +
            'sepertiga gajinya, seorang <strong>geoarbitraser</strong> yang pensiun ke Bali ' +
            'dengan 40% biaya di rumah, penghasil besar yang tidak pernah menyentuh modalnya, ' +
            'warisan untuk keluarga, dan seorang yang <strong>mulai terlambat</strong> dan ' +
            'bersandar pada tunjangan hari tua. Setelah itu ubah angka mana pun di atasnya.'
    },
    {
      target: '#tab-you',
      onEnter: function () {
        var tab = document.querySelector('.ctrl-tab[data-tab="you"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '② Uang masuk dan keluar',
      body: 'Usia Anda, yang Anda <strong>belanjakan</strong>, dan yang Anda ' +
            '<strong>tabung</strong>. Anda bisa mengisi tabungan secara langsung, atau mengisi ' +
            'penghasilan bersih lalu membiarkan alat ini menghitung selisihnya. Keduanya model ' +
            'yang berbeda, dan catatan di bawah kolom menyebutkan mana yang sedang berjalan.'
    },
    {
      target: '#tab-invest',
      onEnter: function () {
        var tab = document.querySelector('.ctrl-tab[data-tab="invest"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '③ Uangnya diinvestasikan di mana',
      body: 'Apa yang sudah Anda miliki, dan berapa hasilnya. Pilih preset untuk memulai dari ' +
            'angka historis jangka panjang, atau ketik kode saham lalu tekan ' +
            '<strong>Ambil</strong> untuk mengukurnya dari harga sungguhan. ' +
            '<strong>Volatilitas</strong> menentukan selebar apa rentang hasilnya, dan itulah ' +
            'yang memasukkan krisis ke sebagian simulasi masa depan.'
    },
    {
      target: '#tab-goal',
      onEnter: function () {
        var tab = document.querySelector('.ctrl-tab[data-tab="goal"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '④ Uang ini untuk apa?',
      body: '<strong>Habis Saat Meninggal</strong> menghabiskan dana tepat di harapan hidup ' +
            'Anda. <strong>Tinggalkan Warisan</strong> menyisakan jumlah tertentu. ' +
            '<strong>Mati Kaya</strong> hanya membelanjakan pertumbuhan riilnya, jadi bertahan ' +
            'selamanya. Ketiganya membutuhkan dana yang sangat berbeda, dan di sini pula ' +
            'tunjangan hari tua diisi, per minggu, bulan, atau tahun, lengkap dengan saklar ' +
            'apakah ia naik mengikuti inflasi, karena banyak negara membayar angka tetap yang ' +
            'tidak pernah naik.'
    },
    {
      target: '#simBtn',
      title: '⑤ Lalu tekan Simulasikan',
      body: 'Seribu simulasi masa depan itu kerja sungguhan, jadi halaman ini tidak ' +
            'mengulanginya di tiap ketikan. Susun dulu seluruh rencananya, formulirnya tetap ' +
            'mengikuti saat Anda mengetik, lalu tekan <strong>Simulasikan</strong> untuk ' +
            'menjalankannya. Selama masih ada yang belum dijalankan, hasil di bawah meredup ' +
            'dan tombol ini menyala, sehingga Anda tidak pernah membaca kesimpulan milik ' +
            'angka yang sudah Anda ubah. <strong>Mulai Cepat</strong> berjalan sendiri, ' +
            'begitu pula penggeser pensiun di langkah ⑦, karena menyapu penggeser itu ' +
            'adalah pertanyaannya, bukan asumsinya.'
    },
    {
      target: '#boardPath',
      onEnter: function () {
        var tab = document.querySelector('.ctrl-tab[data-tab="you"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '⑥ Jalan menuju kebebasan, seberapa awal Anda bisa berhenti?',
      body: 'Garis merah adalah dana yang Anda butuhkan bila berhenti di usia tersebut, dan ia ' +
            'menurun seiring usia karena tahun yang harus dibiayai makin sedikit. Garis biru ' +
            'adalah nilai investasi Anda, dan <strong>di sini tidak ada penarikan sama ' +
            'sekali</strong>. <strong>Titik perpotongannya adalah jawaban Anda.</strong> Pita ' +
            'itu rentang simulasi masa depan, dan garis putus-putus adalah modal yang Anda ' +
            'setorkan, jadi jarak di antaranya adalah pertumbuhan yang bekerja.'
    },
    {
      target: '#retireSlider',
      title: '⑦ Arus Kas, geser usia pensiunnya',
      body: 'Penggeser ini adalah inti seluruh papan Arus Kas. Rentangnya dari ' +
            '<strong>berhenti hari ini</strong> sampai <strong>tidak pernah berhenti</strong>, ' +
            'dan semua yang di bawahnya, kesimpulan tepat di bawah gagangnya, keempat kartu, ' +
            'grafik, dan tabel, diukur pada usia tempat Anda melepasnya, sambil Anda menggeser. ' +
            'Ia <strong>dimulai pada titik perpotongan di atas</strong>: usia paling awal ' +
            'rencana ini berhasil. Titik itu dihitung dari imbal hasil rata-rata, jadi ia ' +
            'terbuka dekat lemparan koin. <strong>Geser ke kanan dan perhatikan peluangnya ' +
            'menanjak</strong>, karena tahun-tahun cadangan itulah yang sebenarnya Anda beli. ' +
            '<strong>Jalan menuju kebebasan</strong> tidak bergeser, karena seberapa awal Anda ' +
            '<em>bisa</em> berhenti tidak bergantung pada kapan Anda <em>memilih</em> berhenti.'
    },
    {
      target: '#boardCash .chart-card',
      title: '⑧ Dari mana uangnya datang, dan ke mana perginya',
      body: 'Penghasilan berbanding pengeluaran, dengan selisihnya diarsir: hijau selama Anda ' +
            'menabungnya, merah begitu dana yang harus menutupnya. Saldo yang ditinggalkannya ' +
            'berjalan di panel bawah, pada tahun yang sama, sehingga Anda bisa membaca lurus ke ' +
            'bawah dari satu arus ke akibatnya pada dana, termasuk saat menembus nol bila ' +
            'uangnya habis. <strong>Pensiun lebih awal dan penurunannya dimulai lebih ' +
            'cepat.</strong>'
    },
    {
      target: '#boardCash .detail-section',
      title: '⑨ Tabelnya selalu cocok',
      body: 'Tiap baris adalah laporan arus kas: saldo di usia itu, lalu penghasilan, ' +
            'pengeluaran, jumlah yang ditabung atau ditarik, dan imbal hasil investasi yang ' +
            'menutup tahunnya. <strong>Saldo ditambah Ditabung ditambah Pertumbuhan sama ' +
            'dengan Saldo baris berikutnya</strong>, sampai satuan terkecil, dalam satuan uang ' +
            'mana pun yang sedang Anda baca.'
    },
    {
      target: null,
      title: '✅ Itu saja isinya',
      body: 'Tidak ada data yang meninggalkan peramban Anda, dan isian Anda diingat untuk ' +
            'kunjungan berikutnya. Putar ulang tur ini kapan saja lewat <strong>Ikuti ' +
            'tur</strong> di bagian atas halaman.'
    }
  ]
};
