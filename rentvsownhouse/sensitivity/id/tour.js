/* Konfigurasi tur berpemandu untuk tool Analisis Sensitivitas Sewa vs Beli
   (versi Indonesia). Mesin bersama (../../../tour-shared.js) membaca objek ini.
   v3 meringkas tiap langkah menjadi satu kalimat pembuka dan daftar pendek. */
window.__TOUR = {
  seenKey: 'rvos-id-tour-v3-seen',
  launchLabel: '🧭 Tur',
  guide: '../../guides/id/#same',
  labels: { skip: 'Lewati tur', back: 'Kembali', next: 'Lanjut',
            start: 'Mulai', done: 'Selesai', dialog: 'Tur singkat tool ini',
            guide: '📖 Panduan', seeGuide: 'Lihat Panduan', guideNote: 'Panduan lengkap',
            guideTitle: 'Cara memakai tool ini, langkah demi langkah' },
  steps: [
    {
      target: null,
      title: '👋 Selamat datang di Analisis Sensitivitas Sewa vs Beli',
      body: 'Bandingkan <strong>banyak skenario sewa dan beli</strong> sekaligus dalam satu tabel. ' +
            'Sekitar satu menit.'
    },
    {
      // The grid is far taller than the viewport, so spotlighting all of it
      // left nothing dimmed and read as no highlight at all. The header row
      // is what the step is about: one column per scenario, plus Add.
      target: '#tableWrap thead',
      title: '① Tiap kolom satu skenario',
      body: '<ul><li>Tambah kolom per kasus: uang muka, suku bunga, atau kota lain</li>' +
            '<li>Ubah sel mana pun, tabelnya langsung dihitung ulang</li>' +
            '<li>Tombol <strong>⚡</strong> mengisi kolom dari kota Quick Start</li></ul>'
    },
    {
      target: '#tableWrap tr.group-sep-tr',
      title: '② Isian untuk semua kolom',
      body: 'Jangka waktu, suku bunga tabungan, modal awal, dan anggaran sama untuk ' +
            'semua kolom, jadi tidak ada skenario yang unggul semata-mata karena modalnya lebih besar.' +
            '<ul><li>Jika <strong>Otomatis</strong>, modal dan anggaran mengikuti kolom ' +
            'yang kebutuhannya paling besar</li></ul>'
    },
    {
      target: '.fx-row',
      title: '③ Mata uang berbeda',
      body: '<ul><li>Centang <strong>Multi-mata uang</strong> agar tiap kolom punya mata ' +
            'uang dan kurs sendiri</li>' +
            '<li>Hasil ditampilkan dalam mata uang dasar</li></ul>'
    },
    {
      // The step names both controls, so highlight both: the year box sits
      // beside the metric buttons, in the table row above the results.
      target: ['#metricGroup', '#yearInput'],
      title: '④ Metrik dan tahun',
      body: '<ul><li>Bandingkan Kekayaan bersih, Uang tunai, atau Biaya kumulatif</li>' +
            '<li>Atur <strong>tahun</strong> pembandingnya</li>' +
            '<li>Beli dikurangi sewa: biru jika membeli unggul, emas jika menyewa</li></ul>'
    },
    {
      target: '.csv-actions',
      title: '⑤ Bandingkan dan simpan',
      body: '<ul><li>Tombol <strong>Bandingkan</strong> menampilkan semua skenario dalam satu grafik</li>' +
            '<li>Unduh tabel sebagai CSV, atau unggah CSV untuk memuat ulang tabelnya</li></ul>'
    },
    {
      target: null,
      title: '✅ Selesai',
      body: '<ul><li>Mau mengulas satu kasus lebih dalam? Buka <em>tool</em> <strong>Sewa vs Beli</strong> ' +
            'lewat tombol Kembali</li>' +
            '<li>Ulangi tur kapan saja lewat tombol 🧭</li></ul>'
    }
  ]
};
