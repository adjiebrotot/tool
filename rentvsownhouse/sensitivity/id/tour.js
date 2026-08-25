/* Konfigurasi tur berpemandu untuk Alat Analisis Sensitivitas Sewa vs Beli
   (versi Indonesia). Mesin bersama (../../../tour-shared.js) membaca objek ini. */
window.__TOUR = {
  seenKey: 'rvos-id-tour-v1-seen',
  launchLabel: '🧭 Ikuti tur',
  labels: { skip: 'Lewati tur', back: 'Kembali', next: 'Lanjut',
            start: 'Mulai', done: 'Selesai', dialog: 'Tur produk' },
  steps: [
    {
      target: null,
      title: '👋 Selamat datang di Alat Sensitivitas Sewa vs Beli',
      body: 'Tur singkat ini menunjukkan cara membandingkan <strong>banyak skenario ' +
            'sewa vs beli secara berdampingan</strong> dan melihat bagaimana hasilnya ' +
            'bergeser saat harga, sewa, dan suku bunga berubah. Hanya sekitar satu menit.'
    },
    {
      // The grid is far taller than the viewport, so spotlighting all of it
      // left nothing dimmed and read as no highlight at all. The header row
      // is what the step is about: one column per scenario, plus Add.
      target: '#tableWrap thead',
      title: '① Tiap kolom adalah satu skenario',
      body: 'Tambahkan kolom untuk setiap kasus yang ingin diuji, misalnya uang muka, ' +
            'suku bunga KPR, atau kota yang berbeda. Ubah asumsi apa pun secara langsung ' +
            'dan seluruh tabel dihitung ulang seketika, sehingga Anda bisa melihat faktor ' +
            'mana yang paling memengaruhi hasil.'
    },
    {
      // The step names both controls, so highlight both: the year box sits
      // in its own row beside the metric buttons.
      target: ['#metricGroup', '#yearInput'],
      title: '② Pilih metrik dan tahun',
      body: 'Bandingkan berdasarkan <strong>Ekuitas Bersih</strong>, <strong>Kas ' +
            'Likuid</strong>, atau <strong>Biaya Kumulatif</strong>, lalu atur ' +
            '<strong>tahun</strong> evaluasi. Begitulah cara menemukan titik breakeven ' +
            'antar skenario.'
    },
    {
      target: '.csv-actions',
      title: '③ Bandingkan, ekspor, dan muat ulang',
      body: 'Gunakan <strong>Bandingkan</strong> untuk menggambar semua skenario dalam ' +
            'satu grafik, unduh tabel sebagai CSV, atau unggah CSV tersimpan untuk ' +
            'membangun ulang skenario Anda nanti. Semuanya berjalan privat di browser Anda.'
    },
    {
      target: null,
      title: '✅ Selesai',
      body: 'Itu seluruh alurnya. Butuh tampilan detail untuk satu kasus? Gunakan alat ' +
            '<strong>Sewa vs Beli</strong> utama lewat tautan Kembali. Putar ulang tur ' +
            'kapan saja lewat <strong>Ikuti tur</strong>.'
    }
  ]
};
