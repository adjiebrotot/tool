/* Konfigurasi tur berpemandu untuk kalkulator Pisah Harta vs Gabung Harta
   (versi Indonesia). Mesin bersama (../../tour-shared.js) membaca objek ini. */
window.__TOUR = {
  seenKey: 'pvg-id-tour-v1-seen',
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
      target: '#tab-inputs',
      onEnter: function () {
        // Pastikan panel Masukan tampil agar sorotan tepat mengenainya.
        var tab = document.querySelector('.ctrl-tab[data-tab="inputs"]');
        if (tab) tab.click();
      },
      title: '① Masukkan penghasilan rumah tangga',
      body: 'Atur <strong>jumlah tanggungan</strong> dan gaji rumah tangga. Gunakan ' +
            '<strong>Total + Persentase</strong> untuk memasukkan satu angka beserta ' +
            'porsinya, atau <strong>Suami + Istri</strong> untuk memasukkan tiap gaji ' +
            'terpisah, lengkap dengan pengurang bila ada.'
    },
    {
      target: '#tab-advanced',
      onEnter: function () {
        // Langkah ini menjelaskan isi panel PTKP & Lapisan Pajak, jadi buka
        // panelnya, jangan menyorot tab yang masih harus dicari pengguna.
        var tab = document.querySelector('.ctrl-tab[data-tab="advanced"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '② Sesuaikan PTKP dan lapisan tarif',
      body: 'Inilah <strong>PTKP &amp; Lapisan Pajak</strong>, sudah kami bukakan. Di ' +
            'sini Anda bisa meninjau dan mengubah nilai PTKP serta lapisan tarif PPh 21, ' +
            'agar perhitungan selalu sesuai aturan terbaru atau asumsi Anda sendiri.'
    },
    {
      target: '.metrics',
      title: '③ Lihat skema mana yang menang',
      body: 'Kartu menampilkan total pajak untuk <strong>Pisah Harta</strong> dan ' +
            '<strong>Gabung Harta</strong>, ditambah <strong>penghematan pajak</strong> ' +
            'dari opsi yang lebih murah sesuai penghasilan dan porsi Anda.'
    },
    {
      target: '.chart-card',
      title: '④ Temukan titik silang',
      body: 'Grafik memetakan total pajak dan selisihnya di sepanjang rentang gaji, ' +
            'sehingga Anda bisa melihat <strong>titik silang</strong> saat satu skema ' +
            'menjadi lebih murah dari yang lain. Semuanya berjalan privat di browser Anda.'
    },
    {
      target: null,
      title: '✅ Selesai',
      body: 'Itu seluruh alurnya, gratis dan tanpa akun. Putar ulang tur kapan saja lewat ' +
            '<strong>Ikuti tur</strong> di header.'
    }
  ]
};
