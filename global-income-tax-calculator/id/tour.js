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
            start: 'Mulai', done: 'Selesai', dialog: 'Tur produk',
            guide: '📖 Panduan', seeGuide: 'Lihat Panduan', guideNote: 'Panduan lengkap ada di sini',
            guideTitle: 'Cara memakai kalkulator ini, langkah demi langkah' },
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
            '39 negara bagian AS, dan DC, dengan sumber untuk setiap baris. Sekitar satu menit.'
    },
    {
      target: '.quick-start-row',
      title: '① Mulai dari contoh',
      body: 'Sekali klik memuat empat pekerjaan berdampingan, dari kota bisnis Asia sampai negara bagian AS. ' +
            'Setelah itu, ganti angka mana pun. 💾 dan 📂 menyimpan perbandingan sebagai berkas.'
    },
    {
      target: '.jobs-bar',
      onEnter: gitcSeed,
      title: '② Hingga empat pekerjaan',
      body: '<ul><li>Setiap pekerjaan punya <strong>negara</strong>, status, dan mata uangnya sendiri</li>' +
            '<li>Klik satu pekerjaan untuk mengubahnya di tab di bawahnya</li>' +
            '<li><strong>+ Tambah pekerjaan</strong> dimulai dari salinan pekerjaan yang dipilih</li></ul>'
    },
    {
      target: '#tab-salary',
      onEnter: gitcTab('salary'),
      title: '③ Di mana dan berapa',
      body: '<ul><li>Ketik beberapa huruf untuk <strong>mencari</strong> negara, negara bagian, atau provinsi</li>' +
            '<li><strong>Hitung dari</strong>: gaji kotor, atau gaji bersih yang kamu inginkan</li>' +
            '<li>Status penduduk atau rezim pajakmu, kalau berpengaruh</li></ul>'
    },
    {
      target: '.ctrl-tabs',
      title: '④ Rumah tangga dan Detail',
      body: 'Hanya isian yang dipakai negara pekerjaan itu: anak, pasangan menikah, pajak gereja, ' +
            'tarif pensiun, atau pinjaman mahasiswa. Tab yang tidak punya isian akan memberi tahu.'
    },
    {
      target: '#verdict',
      onEnter: gitcSeed,
      title: '⑤ Jawabannya',
      body: 'Satu kalimat: pekerjaan mana yang menyisakan gaji bersih paling besar, atau gaji kotor yang dibutuhkan untuk gaji bersih tertentu. ' +
            'Kartu di bawahnya menunjukkan gaji bersih, pajak, dan iuran tiap pekerjaan.'
    },
    {
      target: '.view-bar',
      onEnter: gitcSeed,
      title: '⑥ Mata uang dan periode',
      body: '<ul><li><strong>Tampilkan dalam</strong>: mata uang tiap pekerjaan, atau satu mata uang untuk semuanya</li>' +
            '<li><strong>Per</strong>: tahun atau bulan</li>' +
            '<li>Kursnya kurs hari ini, hanya untuk memudahkan membaca</li></ul>'
    },
    {
      target: '.chart-card',
      onEnter: gitcSeed,
      title: '⑦ Di sepanjang rentang gaji',
      body: 'Setiap garis menunjukkan porsi gaji kotor yang dibawa pulang seiring naiknya gaji, dan titiknya adalah pekerjaan sesuai isianmu. ' +
            'Pekerjaan dengan mata uang berbeda mendapat <strong>satu sumbu per mata uang</strong>, yang disejajarkan dengan kurs.'
    },
    {
      target: '#linesSection',
      onEnter: gitcSeed,
      title: '⑧ Rincian gaji bersih',
      body: 'Satu pekerjaan sekali tampil, dipilih di samping judulnya: setiap pajak dan iuran, <strong>sumbernya</strong>, dan tanggal aturannya mulai berlaku, ' +
            'dengan label Resmi, Sekunder, atau Asumsi. Buka lewat tanda panahnya.'
    },
    {
      target: null,
      title: '✅ Siap dipakai',
      body: '<ul><li>Ganti contohnya dengan pekerjaanmu sendiri</li>' +
            '<li>Semua data tetap di <em>browser</em>-mu</li>' +
            '<li>Putar ulang tur ini lewat tombol 🧭</li></ul>'
    }
  ]
};
