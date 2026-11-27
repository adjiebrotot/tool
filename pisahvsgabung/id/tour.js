/* Konfigurasi tur berpemandu untuk kalkulator Pisah Harta vs Gabung Harta
   (versi Indonesia). Mesin bersama (../../tour-shared.js) membaca objek ini.
   v2: tur mengikuti halaman yang didesain ulang, jadi pembaca yang sudah
   mengikuti v1 ditawari lagi. v3 meringkas tiap langkah menjadi satu kalimat
   pembuka dan daftar pendek. */
window.__TOUR = {
  seenKey: 'pvg-id-tour-v3-seen',
  launchLabel: '🧭 Tur',
  guide: '../guides/id/',
  labels: { skip: 'Lewati tur', back: 'Kembali', next: 'Lanjut',
            start: 'Mulai', done: 'Selesai', dialog: 'Tur singkat tool ini',
            guide: '📖 Panduan', seeGuide: 'Lihat Panduan', guideNote: 'Panduan lengkap',
            guideTitle: 'Cara memakai tool ini, langkah demi langkah' },
  steps: [
    {
      target: null,
      title: '👋 Selamat datang di Pisah vs Gabung Harta',
      body: 'Cari tahu cara mana yang membuat PPh 21 suami istri <strong>lebih rendah</strong>: ' +
            'Gabung Harta atau Pisah Harta. Cukup sekitar satu menit.'
    },
    {
      target: '.quick-start-row',
      title: '① Mulai dari contoh',
      body: '<ul><li>Setiap contoh mewakili satu rumah tangga</li>' +
            '<li>Contoh yang terpilih pertama adalah Penghasilan setara, tanpa anak</li>' +
            '<li>Setiap contoh juga mengatur ulang PTKP dan lapisan tarif ke aturan yang berlaku</li></ul>'
    },
    {
      target: '#tab-inputs',
      onEnter: function () {
        // Pastikan panel Rumah tangga tampil agar sorotan tepat mengenainya.
        var tab = document.querySelector('.ctrl-tab[data-tab="inputs"]');
        if (tab) tab.click();
      },
      title: '② Rumah tanggamu',
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
      body: 'Isinya sudah sesuai aturan yang berlaku. Ubah hanya kalau kamu ingin menghitung dengan aturan lain.'
    },
    {
      target: '#verdict',
      onEnter: function () {
        // Kembali ke tab Rumah tangga, agar panel sesuai dengan jawabannya.
        var tab = document.querySelector('.ctrl-tab[data-tab="inputs"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '④ Jawabannya',
      body: '<ul><li>Cara mana yang <strong>lebih murah</strong>, dan selisihnya per tahun</li>' +
            '<li>Pada gaji berapa <em>breakeven</em> terjadi</li></ul>'
    },
    {
      target: '.metrics',
      title: '⑤ Angkanya',
      body: '<ul><li>Penghematan pajak, berwarna sesuai cara yang lebih murah</li>' +
            '<li>Total pajak dan tarif efektif tiap cara</li></ul>'
    },
    {
      target: '.chart-card',
      title: '⑥ Di berbagai gaji',
      body: '<ul><li>Gaji rumah tangga dari Rp 100 juta sampai Rp 5 miliar, dengan porsi gaji istri yang kamu isi</li>' +
            '<li>Biru untuk Gabung, emas untuk Pisah</li>' +
            '<li>Catatan <em>breakeven</em> di bawah grafik kedua menyebut titik baliknya</li></ul>'
    },
    {
      target: '#detailSection',
      title: '⑦ Rinciannya',
      body: '<ul><li>Tombol panah membuka rincian pajak pada tiap tingkat gaji</li>' +
            '<li>Tombol <strong>CSV</strong> mengunduh rincian itu kapan saja</li></ul>'
    },
    {
      target: null,
      title: '✅ Selesai',
      body: '<ul><li>Gratis, privat, tanpa akun</li>' +
            '<li>Ulangi tur kapan saja lewat tombol 🧭</li></ul>'
    }
  ]
};
