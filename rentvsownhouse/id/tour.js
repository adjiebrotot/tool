/* Konfigurasi tur berpemandu untuk alat Sewa vs Beli (versi Indonesia).
   Mesin bersama (../../tour-shared.js) membaca objek ini. Setiap langkah
   menjelaskan apa yang ada di layar, jadi langkah tentang tab membukanya dulu.
   v4 meringkas tiap langkah menjadi satu kalimat pembuka dan daftar pendek. */
window.__TOUR = {
  seenKey: 'rvo-id-tour-v4-seen',
  launchLabel: '🧭 Tur',
  guide: '../guides/',
  labels: { skip: 'Lewati tur', back: 'Kembali', next: 'Lanjut',
            start: 'Mulai', done: 'Selesai', dialog: 'Tur produk',
            guide: '📖 Panduan', seeGuide: 'Lihat Panduan', guideNote: 'Panduan lengkap (bahasa Inggris)',
            guideTitle: 'Cara memakai alat ini, langkah demi langkah (bahasa Inggris)' },
  steps: [
    {
      target: null,
      title: '👋 Selamat datang di Sewa vs Beli',
      body: 'Lihat apakah <strong>menyewa atau membeli</strong> rumah lebih menguntungkan ' +
            'dari waktu ke waktu. Sekitar satu menit.'
    },
    {
      target: '.quick-start-row',
      title: '① Mulai dari kota',
      body: '<ul><li>Cari kota seperti Perth, Tokyo, atau Jakarta</li>' +
            '<li>Pilih hunian yang memang ada, dari studio hingga empat kamar</li>' +
            '<li>Harga, sewa, dan syarat KPR setempat langsung terisi, dan semuanya bisa Anda ubah</li></ul>'
    },
    {
      target: '.ctrl-tabs',
      onEnter: function () {
        var tab = document.querySelector('.ctrl-tab[data-tab="own"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '② Tiga tab',
      body: '<ul><li><strong>Rumah</strong>: harga, uang muka, KPR, biaya kepemilikan</li>' +
            '<li><strong>Sewa</strong>: sewa, biayanya, opsi Sewa Dulu, Beli Kemudian</li>' +
            '<li><strong>Asumsi</strong>: bunga tabungan, kenaikan harga, jangka waktu</li></ul>'
    },
    {
      target: '#verdict',
      title: '③ Jawabannya',
      body: '<ul><li>Mana yang unggul, seberapa besar, setelah berapa lama</li>' +
            '<li>Biru untuk membeli, emas untuk menyewa</li></ul>'
    },
    {
      target: '.metrics',
      title: '④ Angka kunci',
      body: '<ul><li><strong>Perbedaan kekayaan bersih</strong> di akhir</li>' +
            '<li><strong>Tahun breakeven</strong>, saat membeli unggul seterusnya</li>' +
            '<li>Modal awal dan anggaran bulanan yang sama untuk keduanya</li></ul>'
    },
    {
      target: '.chart-card',
      title: '⑤ Dari waktu ke waktu',
      body: '<ul><li>Ganti antara Kekayaan bersih, Uang tunai, dan Biaya kumulatif</li>' +
            '<li>Tanda ? menjelaskan tiap metrik, dan grafiknya bisa diekspor sebagai SVG atau PNG</li></ul>'
    },
    {
      target: '#detailSection',
      title: '⑥ Rinciannya',
      body: '<ul><li>Tombol panah membuka arus kas per tahun, dan CSV mengunduhnya</li>' +
            '<li>Daftar Asumsi yang dipakai di bawahnya menjelaskan apa saja yang dihitung</li></ul>'
    },
    {
      target: null,
      title: '✅ Selesai',
      body: '<ul><li>Banyak skenario sekaligus? Coba <strong>tool Analisis ' +
            'Sensitivitas</strong> lewat tautan di bagian atas</li>' +
            '<li>Putar ulang tur lewat tombol 🧭</li></ul>'
    }
  ]
};
