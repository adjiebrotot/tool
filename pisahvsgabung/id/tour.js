/* Konfigurasi tur berpemandu untuk kalkulator Pisah Harta vs Gabung Harta
   (versi Indonesia). Mesin bersama (../../tour-shared.js) membaca objek ini.
   v2: tur mengikuti halaman yang didesain ulang, jadi pembaca yang sudah
   mengikuti v1 ditawari lagi. v3 meringkas tiap langkah menjadi satu kalimat
   pembuka dan daftar pendek. */
window.__TOUR = {
  seenKey: 'pvg-id-tour-v3-seen',
  launchLabel: '🧭 Ikuti tur',
  launchShort: '🧭 Tur',
  labels: { skip: 'Lewati tur', back: 'Kembali', next: 'Lanjut',
            start: 'Mulai', done: 'Selesai', dialog: 'Tur produk' },
  steps: [
    {
      target: null,
      title: '👋 Selamat datang di Pisah vs Gabung Harta',
      body: 'Cari skema PPh 21 suami istri dengan <strong>pajak lebih rendah</strong>: ' +
            'Pisah Harta atau Gabung Harta. Sekitar satu menit.'
    },
    {
      target: '.quick-start-row',
      title: '① Mulai dari contoh',
      body: '<ul><li>Tiap contoh memuat satu rumah tangga</li>' +
            '<li>Penghasilan setara, tanpa anak adalah contoh awal</li>' +
            '<li>Tiap contoh mengembalikan PTKP dan lapisan tarif ke ketentuan</li></ul>'
    },
    {
      target: '#tab-inputs',
      onEnter: function () {
        // Pastikan panel Rumah tangga tampil agar sorotan tepat mengenainya.
        var tab = document.querySelector('.ctrl-tab[data-tab="inputs"]');
        if (tab) tab.click();
      },
      title: '② Rumah tangga Anda',
      body: '<ul><li>Jumlah <strong>tanggungan</strong></li>' +
            '<li>Penghasilan sebagai total dan porsi istri, atau per pasangan</li>' +
            '<li>Pengurang bila ada; semua dalam rupiah per tahun</li></ul>'
    },
    {
      target: '#tab-advanced',
      onEnter: function () {
        // Langkah ini menjelaskan isi panel PTKP & Lapisan Pajak, jadi buka panelnya,
        // jangan menyorot tab yang masih harus dicari pengguna.
        var tab = document.querySelector('.ctrl-tab[data-tab="advanced"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '③ PTKP & Lapisan Pajak',
      body: 'Berisi nilai sesuai ketentuan. Ubah hanya untuk memodelkan aturan lain.'
    },
    {
      target: '#verdict',
      onEnter: function () {
        // Kembali ke tab Rumah tangga, agar panel sesuai dengan jawabannya.
        var tab = document.querySelector('.ctrl-tab[data-tab="inputs"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '④ Jawabannya',
      body: '<ul><li>Skema mana yang <strong>lebih murah</strong>, dan selisihnya per tahun</li>' +
            '<li>Di mana titik breakeven-nya</li></ul>'
    },
    {
      target: '.metrics',
      title: '⑤ Angkanya',
      body: '<ul><li>Penghematan pajak, dengan warna skema yang lebih murah</li>' +
            '<li>Total pajak dan tarif efektif tiap skema</li></ul>'
    },
    {
      target: '.chart-card',
      title: '⑥ Di berbagai gaji',
      body: '<ul><li>Gaji rumah tangga Rp 100 juta sampai Rp 5 miliar, pada porsi Anda</li>' +
            '<li>Biru untuk Pisah, emas untuk Gabung</li>' +
            '<li>Catatan breakeven di bawah grafik kedua menyebut titik tukarnya</li></ul>'
    },
    {
      target: '#detailSection',
      title: '⑦ Rinciannya',
      body: '<ul><li>Tombol panah membuka pajak pada tiap gaji</li>' +
            '<li><strong>CSV</strong> mengunduhnya kapan saja</li></ul>'
    },
    {
      target: null,
      title: '✅ Selesai',
      body: '<ul><li>Gratis, privat, tanpa akun</li>' +
            '<li>Putar ulang tur lewat tombol 🧭</li></ul>'
    }
  ]
};
