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
      body: 'Tur singkat ini menunjukkan cara membandingkan PPh 21 skema <strong>Pisah ' +
            'Harta</strong> dan <strong>Gabung Harta</strong> untuk pasangan suami istri, ' +
            'sehingga Anda tahu skema mana yang menghasilkan total pajak lebih rendah. ' +
            'Hanya sekitar satu menit.'
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
        // Langkah ini menjelaskan isi panel PTKP & Lapisan Pajak, jadi buka panelnya,
        // jangan menyorot tab yang masih harus dicari pengguna.
        var tab = document.querySelector('.ctrl-tab[data-tab="advanced"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '③ Periksa PTKP dan lapisan tarif',
      body: 'Inilah <strong>PTKP &amp; Lapisan Pajak</strong>, sudah kami bukakan. Nilai PTKP dan lapisan tarif ' +
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
      body: 'Kalimat di atas menyebut apakah <strong>Pisah Harta</strong> atau <strong>Gabung ' +
            'Harta</strong> yang lebih murah untuk rumah tangga Anda dan selisihnya per tahun, ' +
            'lalu di mana titik breakeven-nya.'
    },
    {
      target: '.metrics',
      title: '⑤ Angka di baliknya',
      body: 'Kartu pertama adalah penghematan pajaknya, dengan warna skema yang lebih murah. Dua ' +
            'kartu lain adalah total pajak per tahun tiap skema dan tarif efektifnya.'
    },
    {
      target: '.chart-card',
      title: '⑥ Bandingkan di berbagai gaji',
      body: 'Grafik menggeser gaji rumah tangga dari Rp 100 juta sampai Rp 5 miliar per tahun pada ' +
            'porsi Anda. Biru adalah Pisah Harta dan emas adalah Gabung Harta; analisis breakeven di ' +
            'bawah grafik kedua menyebut kapan yang satu menjadi lebih murah dari yang lain.'
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
