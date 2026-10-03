/* Konfigurasi tur berpemandu untuk kalkulator Pisah Harta vs Gabung Harta
   (versi Indonesia). Mesin bersama (../../tour-shared.js) membaca objek ini.
   v2: tur mengikuti halaman yang didesain ulang, jadi pembaca yang sudah
   mengikuti v1 ditawari lagi. */
window.__TOUR = {
  seenKey: 'pvg-id-tour-v2-seen',
  launchLabel: '🧭 Ikuti tur',
  labels: { skip: 'Lewati tur', back: 'Kembali', next: 'Lanjut',
            start: 'Mulai', done: 'Selesai', dialog: 'Tur produk' },
  steps: [
    {
      target: null,
      title: '👋 Selamat datang di Pisah vs Gabung Harta',
      body: 'Tur singkat ini menunjukkan cara membandingkan PPh 21 suami istri saat lapor terpisah ' +
            '(<strong>Pisah Harta</strong>) dan lapor digabung (<strong>Gabung Harta</strong>), ' +
            'sehingga Anda tahu mana yang pajaknya lebih kecil. Hanya sekitar satu menit.'
    },
    {
      target: '.quick-start-row',
      title: '① Mulai dari contoh',
      body: 'Pilih contoh rumah tangga. <strong>Penghasilan setara, tanpa anak</strong> adalah ' +
            'contoh saat halaman dibuka, jadi juga membawa Anda kembali ke awal. Setiap contoh ' +
            'mengembalikan PTKP dan lapisan tarif ke ketentuan.'
    },
    {
      target: '#tab-inputs',
      onEnter: function () {
        // Pastikan panel Rumah tangga tampil agar sorotan tepat mengenainya.
        var tab = document.querySelector('.ctrl-tab[data-tab="inputs"]');
        if (tab) tab.click();
      },
      title: '② Isi data rumah tangga',
      body: 'Ketuk jumlah <strong>tanggungan</strong>, lalu isi penghasilan sebagai <strong>total ' +
            'dan porsi istri</strong> atau <strong>per pasangan</strong>, lengkap dengan pengurang ' +
            'bila ada. Semua nilai dalam rupiah per tahun.'
    },
    {
      target: '#tab-advanced',
      onEnter: function () {
        // Langkah ini menjelaskan isi panel Aturan pajak, jadi buka panelnya,
        // jangan menyorot tab yang masih harus dicari pengguna.
        var tab = document.querySelector('.ctrl-tab[data-tab="advanced"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '③ Periksa aturan pajak',
      body: 'Inilah <strong>Aturan pajak</strong>, sudah kami bukakan. Nilai PTKP dan lapisan tarif ' +
            'PPh 21 dimulai dari ketentuan; ubah hanya bila ingin memodelkan aturan lain.'
    },
    {
      target: '#verdict',
      onEnter: function () {
        // Kembali ke tab Rumah tangga, agar panel sesuai dengan jawabannya.
        var tab = document.querySelector('.ctrl-tab[data-tab="inputs"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '④ Baca jawabannya',
      body: 'Kalimat di atas menyebut cara lapor mana yang lebih murah untuk rumah tangga Anda dan ' +
            'selisihnya per tahun, lalu di mana cara yang lebih murah berganti.'
    },
    {
      target: '.metrics',
      title: '⑤ Angka di baliknya',
      body: 'Kartu pertama adalah penghematannya, dengan warna cara yang lebih murah. Dua kartu lain ' +
            'adalah total pajak per tahun tiap cara dan porsinya dari gaji kotor.'
    },
    {
      target: '.chart-card',
      title: '⑥ Bandingkan di berbagai gaji',
      body: 'Grafik menggeser gaji rumah tangga dari Rp 100 juta sampai Rp 5 miliar per tahun pada ' +
            'porsi Anda. Biru adalah Pisah Harta dan emas adalah Gabung Harta; catatan di bawah grafik ' +
            'kedua menyebut di mana cara yang lebih murah berganti.'
    },
    {
      target: '#detailSection',
      title: '⑦ Buka rinciannya',
      body: '<strong>Tampilkan tabel</strong> membuka pajak pada tiap gaji, dan <strong>CSV</strong> ' +
            'mengunduhnya baik tabel terbuka maupun tidak. Halaman ditutup dengan asumsi yang dipakai.'
    },
    {
      target: null,
      title: '✅ Selesai',
      body: 'Itu seluruh alurnya, gratis, privat, dan tanpa akun. Putar ulang tur kapan saja lewat ' +
            '<strong>Ikuti tur</strong> di header.'
    }
  ]
};
