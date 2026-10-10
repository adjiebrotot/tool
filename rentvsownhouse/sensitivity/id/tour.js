/* Konfigurasi tur berpemandu untuk Alat Analisis Sensitivitas Sewa vs Beli
   (versi Indonesia). Mesin bersama (../../../tour-shared.js) membaca objek ini. */
window.__TOUR = {
  seenKey: 'rvos-id-tour-v2-seen',
  launchLabel: '🧭 Ikuti tur',
  launchShort: '🧭 Tur',
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
            'mana yang paling memengaruhi hasil. Pilihan <strong>⚡</strong> di tiap kolom ' +
            'mencari semua kota dan hunian Mulai Cepat lalu mengisi kolom itu.'
    },
    {
      target: '#tableWrap tr.group-sep-tr',
      title: '② Uang yang sama di tiap kolom',
      body: 'Jangka waktu, suku bunga bebas risiko, modal awal dan anggaran adalah satu baris ' +
            'untuk seluruh tabel, jadi tak ada skenario yang menang karena modal lebih besar. ' +
            'Jika <strong>Otomatis</strong>, modal dan anggaran mengikuti kebutuhan terbesar ' +
            'semua kolom dan menyebut kolomnya; rumah yang lebih murah menabung selisihnya.'
    },
    {
      target: '.fx-row',
      title: '③ Rumah dengan mata uang berbeda',
      body: 'Centang <strong>Multi-mata uang</strong> agar tiap kolom punya mata uang dan kurs ' +
            'sendiri (terkini dari ExchangeRate-API, atau isi sendiri). Semua hasil dan grafik ' +
            'lalu dalam mata uang dasar, dan tiap kolom mendapat modal dan anggaran yang sama sesuai kursnya.'
    },
    {
      // The step names both controls, so highlight both: the year box sits
      // beside the metric buttons, in the table row above the results.
      target: ['#metricGroup', '#yearInput'],
      title: '④ Pilih metrik dan tahun',
      body: 'Bandingkan berdasarkan <strong>Kekayaan bersih</strong>, <strong>Uang ' +
            'tunai</strong>, atau <strong>Biaya kumulatif</strong>, lalu atur ' +
            '<strong>tahun</strong> evaluasinya. <strong>Beli dikurangi sewa</strong> di ' +
            'bawah berwarna sesuai pilihan yang unggul: biru untuk membeli, emas untuk menyewa.'
    },
    {
      target: '.csv-actions',
      title: '⑤ Bandingkan, ekspor, dan muat ulang',
      body: 'Gunakan <strong>Bandingkan</strong> untuk menggambar semua skenario dalam ' +
            'satu grafik, unduh tabel sebagai CSV, atau unggah CSV tersimpan untuk ' +
            'membangun ulang skenario Anda nanti. Semuanya berjalan privat di browser Anda.'
    },
    {
      target: null,
      title: '✅ Selesai',
      body: 'Itu seluruh alurnya. Butuh tampilan detail untuk satu kasus? Gunakan alat ' +
            '<strong>Sewa vs Beli</strong> utama lewat tautan Kembali. Putar ulang tur ' +
            'kapan saja lewat tombol <strong>🧭</strong>.'
    }
  ]
};
