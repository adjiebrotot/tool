/* Konfigurasi tur berpemandu untuk alat Sewa vs Beli (versi Indonesia).
   Mesin bersama (../../tour-shared.js) membaca objek ini. */
window.__TOUR = {
  seenKey: 'rvo-id-tour-v1-seen',
  launchLabel: '🧭 Ikuti tur',
  labels: { skip: 'Lewati tur', back: 'Kembali', next: 'Lanjut',
            start: 'Mulai', done: 'Selesai', dialog: 'Tur produk' },
  steps: [
    {
      target: null,
      title: '👋 Selamat datang di Sewa vs Beli',
      body: 'Tur singkat ini menunjukkan cara memodelkan hasil jangka panjang antara ' +
            '<strong>menyewa dan membeli rumah</strong>, membandingkan kas, ekuitas, dan ' +
            'kekayaan bersih dari waktu ke waktu, sehingga Anda tahu pilihan mana yang ' +
            'lebih menguntungkan. Hanya sekitar satu menit.'
    },
    {
      target: '.quick-start-row',
      title: '① Mulai dari kota preset',
      body: 'Satu klik memuat harga, sewa, dan suku bunga yang realistis untuk kota ' +
            'seperti <strong>Perth</strong>, <strong>Sydney</strong>, ' +
            '<strong>Singapura</strong>, atau <strong>Jakarta</strong>. Titik awal cepat ' +
            'yang bisa Anda sesuaikan dengan angka Anda sendiri.'
    },
    {
      target: '.ctrl-tabs',
      title: '② Isi asumsi Anda',
      body: 'Input dikelompokkan menjadi <strong>Umum</strong> (kas, suku bunga bebas ' +
            'risiko, jangka waktu), <strong>Beli</strong> (harga, uang muka, KPR, biaya), ' +
            'dan <strong>Sewa</strong> (sewa, kenaikan, biaya rutin). Anda bahkan bisa ' +
            'memodelkan skenario sewa lalu beli.'
    },
    {
      target: '.metrics',
      title: '③ Lihat angka kunci',
      body: 'Kartu KPI menampilkan <strong>tahun breakeven</strong>, yaitu tahun saat ' +
            'ekuitas bersih kepemilikan melampaui menyewa, dan <strong>selisih ' +
            'ekuitas</strong> antara membeli dan menyewa di akhir jangka waktu Anda.'
    },
    {
      target: '.chart-card',
      title: '④ Bandingkan dari waktu ke waktu',
      body: 'Ganti grafik antara <strong>Ekuitas Bersih</strong>, <strong>Kas ' +
            'Likuid</strong>, dan <strong>Biaya Kumulatif</strong> untuk melihat bagaimana ' +
            'tiap jalur berjalan tahun demi tahun. Ekspor tampilan apa pun sebagai SVG ' +
            'atau PNG.'
    },
    {
      target: null,
      title: '✅ Selesai',
      body: 'Itu seluruh alurnya, dan semuanya berjalan secara privat di browser Anda, ' +
            'gratis. Ingin membandingkan banyak skenario sekaligus? Coba <strong>Alat ' +
            'Analisis Sensitivitas</strong> di bagian atas. Putar ulang tur kapan saja ' +
            'lewat <strong>Ikuti tur</strong>.'
    }
  ]
};
