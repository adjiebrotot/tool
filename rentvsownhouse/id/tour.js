/* Konfigurasi tur berpemandu untuk alat Sewa vs Beli (versi Indonesia).
   Mesin bersama (../../tour-shared.js) membaca objek ini. Setiap langkah
   menjelaskan apa yang ada di layar, jadi langkah tentang tab membukanya dulu. */
window.__TOUR = {
  seenKey: 'rvo-id-tour-v2-seen',
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
      onEnter: function () {
        var tab = document.querySelector('.ctrl-tab[data-tab="own"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '② Angka yang Anda tahu lebih dulu',
      body: '<strong>Rumah</strong> berisi harga, uang muka, KPR, dan biaya kepemilikan. ' +
            '<strong>Sewa</strong> berisi sewa, biayanya, dan skenario opsional <strong>Sewa ' +
            'Dulu, Beli Kemudian</strong>. <strong>Asumsi</strong> berisi perkiraan masa depan: ' +
            'suku bunga bebas risiko tabungan, kenaikan harga properti, dan jangka waktu. Setiap isian ' +
            'menampilkan satuannya, dan angka slider bisa diklik lalu diketik.'
    },
    {
      target: '#verdict',
      title: '③ Jawabannya dalam satu kalimat',
      body: 'Mana yang unggul, seberapa besar dan setelah berapa lama, serta tahun ' +
            'membeli mulai unggul seterusnya. Biru untuk membeli dan emas untuk menyewa, ' +
            'di sini dan di grafik.'
    },
    {
      target: '.metrics',
      title: '④ Angka kunci',
      body: '<strong>Perbedaan kekayaan bersih</strong> antara membeli dan menyewa di akhir, ' +
            '<strong>tahun breakeven</strong>, lalu modal awal yang sama dan anggaran perumahan ' +
            'bulanan yang dipakai bersama.'
    },
    {
      target: '.chart-card',
      title: '⑤ Bandingkan dari waktu ke waktu',
      body: 'Ganti grafik antara <strong>Kekayaan bersih</strong>, <strong>Uang ' +
            'tunai</strong>, dan <strong>Biaya kumulatif</strong> untuk melihat ' +
            'bagaimana tiap jalur berjalan tahun demi tahun. Tanda ? di sebelahnya ' +
            'menjelaskan artinya. Ekspor tampilan apa pun sebagai SVG atau PNG.'
    },
    {
      target: '#detailSection',
      title: '⑥ Rinciannya, saat Anda butuh',
      body: 'Arus kas per tahun untuk membeli, menyewa, dan sewa dulu ada di balik ' +
            '<strong>Tampilkan tabel</strong>, dan tombol CSV tetap mengekspornya. ' +
            '<strong>Asumsi yang dipakai</strong>, di bawahnya, menjelaskan apa yang ' +
            'dihitung dan tidak dihitung model ini.'
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
