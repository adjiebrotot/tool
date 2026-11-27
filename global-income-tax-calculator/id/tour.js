/* Konfigurasi tur berpemandu untuk Kalkulator Gaji Bersih dan Pajak Penghasilan
   (versi Indonesia). Mesin bersama (../../tour-shared.js) membaca objek ini.

   Langkah-langkah pada hasil lebih dulu memuat Quick Start Kota bisnis Asia dalam
   mata uang tiap pekerjaan (window.__GSC_TOUR, di ../script.js), sehingga grafik
   menampilkan satu sumbu per mata uang dan setiap langkah menjelaskan apa yang ada
   di layar. Isian pembaca dikembalikan saat tur selesai, bagaimanapun tur itu berakhir. */
function gitcSeed(){
  if (window.__GSC_TOUR) window.__GSC_TOUR.seed();
}
function gitcTab(name){
  return function () {
    var tab = document.querySelector('.ctrl-tab[data-tab="' + name + '"]');
    if (tab && !tab.classList.contains('active')) tab.click();
  };
}
window.__TOUR = {
  seenKey: 'gitc-id-tour-v1-seen',
  launchLabel: '🧭 Tur',
  guide: '../guides/id/',
  labels: { skip: 'Lewati tur', back: 'Kembali', next: 'Lanjut',
            start: 'Mulai', done: 'Selesai', dialog: 'Tur singkat tool ini',
            guide: '📖 Panduan', seeGuide: 'Lihat Panduan', guideNote: 'Panduan lengkap ada di sini',
            guideTitle: 'Cara memakai tool ini, langkah demi langkah' },
  saveState: function () {
    return window.__GSC_TOUR ? window.__GSC_TOUR.saveState() : null;
  },
  restoreState: function (snap) {
    if (window.__GSC_TOUR) window.__GSC_TOUR.restoreState(snap);
  },
  steps: [
    {
      target: null,
      title: '👋 Selamat datang di Kalkulator Gaji Bersih dan Pajak Penghasilan',
      body: 'Hitung gaji bersih setelah pajak penghasilan dan iuran jaminan sosial di <strong>31 negara</strong>, ' +
            '39 negara bagian AS, dan DC, dengan sumber untuk setiap baris. Tur ini memakan waktu sekitar satu menit.'
    },
    {
      target: '.quick-start-row',
      title: '① Mulai dari contoh',
      body: 'Satu klik langsung memuat empat pekerjaan untuk dibandingkan, dari kota bisnis Asia sampai negara bagian AS. ' +
            'Setelah itu, ganti angka mana pun. 💾 dan 📂 menyimpan perbandingan sebagai berkas.'
    },
    {
      target: '.jobs-bar',
      onEnter: gitcSeed,
      title: '② Hingga empat pekerjaan',
      body: '<ul><li>Setiap pekerjaan punya <strong>negara</strong>, status, dan mata uangnya sendiri</li>' +
            '<li>Klik satu pekerjaan untuk mengubahnya di tab di bawahnya</li>' +
            '<li><strong>+ Tambah pekerjaan</strong> menyalin pekerjaan yang sedang dipilih</li></ul>'
    },
    {
      target: '#tab-salary',
      onEnter: gitcTab('salary'),
      title: '③ Tempat kerja dan gaji',
      body: '<ul><li>Ketik beberapa huruf untuk <strong>mencari</strong> negara, negara bagian, atau provinsi</li>' +
            '<li><strong>Hitung dari</strong>: gaji kotor, atau gaji bersih yang kamu inginkan</li>' +
            '<li>Status penduduk atau rezim pajakmu, kalau berpengaruh</li></ul>'
    },
    {
      target: '.ctrl-tabs',
      title: '④ Rumah tangga dan Detail',
      body: 'Kedua tab ini hanya menampilkan isian yang berlaku di negara pekerjaan itu, misalnya anak, status menikah, pajak gereja, ' +
            'iuran pensiun, atau pinjaman mahasiswa. Kalau tidak ada isian yang berlaku, tab akan memberi tahu.'
    },
    {
      target: '#verdict',
      onEnter: gitcSeed,
      title: '⑤ Jawabannya',
      body: 'Satu kalimat langsung menjawab: pekerjaan mana yang menyisakan gaji bersih paling besar, atau berapa gaji kotor yang kamu perlukan untuk gaji bersih tertentu. ' +
            'Kartu di bawahnya menunjukkan gaji bersih, pajak, dan iuran tiap pekerjaan.'
    },
    {
      target: '.view-bar',
      onEnter: gitcSeed,
      title: '⑥ Mata uang dan periode',
      body: '<ul><li><strong>Tampilkan dalam</strong>: mata uang tiap pekerjaan, atau satu mata uang untuk semuanya</li>' +
            '<li><strong>Per</strong>: tahun atau bulan</li>' +
            '<li>Kurs yang dipakai adalah kurs hari ini, hanya supaya angkanya mudah dibandingkan</li></ul>'
    },
    {
      target: '.chart-card',
      onEnter: gitcSeed,
      title: '⑦ Dari gaji rendah sampai tinggi',
      body: 'Setiap garis menunjukkan berapa persen gaji kotor yang sampai ke tanganmu ketika gaji naik, dan titiknya adalah pekerjaan sesuai isianmu. ' +
            'Kalau mata uangnya berbeda, grafik memakai <strong>satu sumbu per mata uang</strong>, yang disejajarkan dengan kurs.'
    },
    {
      target: '#linesSection',
      onEnter: gitcSeed,
      title: '⑧ Rincian gaji bersih',
      body: 'Rincian ini menampilkan satu pekerjaan, yang bisa kamu pilih di samping judulnya. Isinya setiap pajak dan iuran, <strong>sumbernya</strong>, dan tanggal aturan itu mulai berlaku, ' +
            'dengan label Resmi, Sekunder, atau Asumsi. Buka lewat tanda panahnya.'
    },
    {
      target: null,
      title: '✅ Siap dipakai',
      body: '<ul><li>Ganti contohnya dengan pekerjaanmu sendiri</li>' +
            '<li>Semua data tetap di <em>browser</em>-mu</li>' +
            '<li>Ulangi tur ini kapan saja lewat tombol 🧭</li></ul>'
    }
  ]
};
