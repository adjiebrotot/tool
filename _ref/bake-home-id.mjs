#!/usr/bin/env node
// Writes the Indonesian home page, id/index.html, from the English one (index.html).
//
//   node _ref/bake-home-id.mjs            write id/index.html
//   node _ref/bake-home-id.mjs --check    write nothing; fail if id/index.html is out of date
//
// The Indonesian home lists every tool, not only the ones with an Indonesian page: a reader
// who arrives in Indonesian still sees the whole site. A card whose tool has an Indonesian
// page links there (hreflang="id") and has no language mark; every other card links
// to the English tool (hreflang="en") and gets a small EN beside its open button. The cards' data-*
// values stay English, so the filters and the typewriter read them as on the English home;
// the words the page shows come from LABELS, through window.HOME_I18N.
//
// Re-run after changing index.html. A card added there needs its words in CARDS first: the
// script stops on a card, a tag or a sentence it has no Indonesian for, rather than ship
// English on the Indonesian page. Indonesian copy follows the blog's voice (saya and kamu,
// never Anda; "tool" for the tools). Then run _ref/hreflang.mjs.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://tool.adjiebrotots.com/';
const CHECK = process.argv.includes('--check');
const PROBLEMS = [];

// ---- Words for the card data (status, domain, geography, tags): the filters, the
// domain headings, the visible tags and the typewriter.
const LABELS = {
  'Active': 'Aktif', 'Coming soon': 'Segera hadir', 'Deprecated': 'Tidak dilanjutkan',
  'Engineering': 'Teknik', 'Finance': 'Keuangan', 'Visualisation': 'Visualisasi', 'Others': 'Lainnya',
  'Universal': 'Global', 'Indonesia': 'Indonesia', 'Australia': 'Australia',
  'Converter': 'Konverter', 'Documents': 'Dokumen', 'Power Systems': 'Sistem tenaga listrik',
  'Tax': 'Pajak', 'Financing': 'Pembiayaan', 'Investment': 'Investasi', 'Leveraging': 'Leverage',
  'Property': 'Properti', 'Graphing': 'Grafik', 'Brainstorming Tool': 'Brainstorming', '3D': '3D', 'CAD': 'CAD',
  'Geoarbitrage': 'Geoarbitrase', 'Randomiser': 'Pengacak', 'Decision': 'Keputusan',
  'Time Zones': 'Zona waktu', 'Meetings': 'Rapat', 'Groceries': 'Belanja dapur', 'Pricing': 'Harga',
  'Superannuation': 'Superannuation',
};

// ---- Each card, by its data-anim key (the tool's folder). `desc` is written for an
// Indonesian reader, not translated line by line. `id` is the tool's Indonesian page, when it
// has one; `name` replaces the card's title only where the Indonesian page has its own name.
// `menu` gives a split button's entries, by their English href.
const T = 'https://tool.adjiebrotots.com/';
const CARDS = {
  'mdtopdf': { desc: 'AI-mu menulis dalam Markdown, sementara atasanmu maunya PDF. Ubah tulisan itu menjadi PDF siap cetak, lengkap dengan rumus matematika dan diagram.' },
  'powerfactory-scripter': { desc: 'Susun skrip Python untuk DIgSILENT PowerFactory dalam hitungan menit, bukan berhari-hari, karena sebagian besar studi hanyalah urutan <em>input</em>, simulasi, dan <em>output</em>.' },
  'pscad-scripter': { desc: 'Susun skrip Python untuk mengotomatiskan PSCAD dalam hitungan menit dengan merangkai blok <em>build</em>, <em>run</em>, dan pengecekan EMT menjadi satu berkas yang siap dijalankan.' },
  'loadflow-simulator': { desc: 'Gambar diagram segaris lalu jalankan analisis aliran daya langsung di <em>browser</em>. Tegangan setiap bus dan animasi aliran dayanya bisa kamu ekspor atau sematkan.' },
  'ed-uc-simulator': { desc: 'Simulasikan <em>economic dispatch</em> dan <em>unit commitment</em> di <em>browser</em>: gambar jaringannya, lihat pembangkit mana yang beroperasi setiap jam beserta biayanya, lalu baca harga di tiap simpul.' },
  'capacity-expansion-planner': { desc: 'Pembangkit apa yang perlu dibangun, dan kapan? Cari bauran surya, angin, gas, dan baterai dengan biaya termurah untuk beban yang terus tumbuh, tahun demi tahun.' },
  'pisahvsgabung': { id: `${T}pisahvsgabung/id/`, desc: 'Pisah harta atau gabung harta? Bandingkan PPh 21 suami istri untuk kedua cara itu, karena urusan pajak sebaiknya diserahkan pada hitungan, bukan pada perasaan.' },
  'financingvscash': { desc: 'Bayar tunai, atau ambil pembiayaan lalu investasikan uang yang tidak jadi keluar itu? Hitung apakah utang itu benar-benar bekerja untukmu, bukan untuk bank.' },
  'rentvsownhouse': {
    id: `${T}rentvsownhouse/id/`, name: 'Sewa vs Beli Rumah',
    desc: 'Benarkah membeli rumah selalu lebih baik daripada menyewa? Simulasikan keduanya selama bertahun-tahun dan lihat mana yang membuat kekayaan bersihmu lebih besar.',
    menu: {
      [`${T}rentvsownhouse/`]: { href: `${T}rentvsownhouse/id/`, lang: 'id', main: 'Sewa vs Beli Rumah', sub: 'Satu skenario, tahun demi tahun' },
      [`${T}rentvsownhouse/sensitivity/`]: { href: `${T}rentvsownhouse/sensitivity/id/`, lang: 'id', main: 'Analisis Sensitivitas', sub: 'Beberapa skenario berdampingan' },
    },
  },
  'dcasimulator': {
    desc: 'Gejolak pasar terasa tidak terlalu menakutkan kalau kamu rutin membeli setiap bulan. Uji strategi <em>dollar-cost averaging</em> dengan data pasar sungguhan.',
    menu: {
      [`${T}dcasimulator/`]: { sub: 'Bandingkan aset satu per satu' },
      [`${T}dcasimulator/portfolio/`]: { sub: 'Bandingkan portofolio secara utuh' },
    },
  },
  'financialfreedom': { desc: 'Berapa dana yang cukup, dan di usia berapa kamu mencapainya? Hitung angka dan usia kebebasan finansialmu, lalu uji ketahanan rencanamu di ribuan skenario masa depan.' },
  'graphvisualiser': { desc: 'Masukkan berkas CSV atau Excel, lalu dapatkan grafik interaktif yang membuatmu tampil meyakinkan di rapat dadakan.' },
  'sankeycreator': { desc: 'Lihat ke mana saja uang, energi, atau barang mengalir lewat diagram Sankey. Susun diagramnya langsung di <em>browser</em>, lalu ekspor sebagai SVG atau PNG.' },
  'jsonvisualiser': { desc: 'Tampilkan JSON sebagai pohon yang enak dibaca. Berkat pemuatan bertahap (<em>lazy loading</em>), jutaan <em>key</em> pun tetap lancar dibuka.' },
  'canvasbuilder': { desc: 'Susun Business Model Canvas ala CEO dan <em>founder</em> langsung di <em>browser</em> dengan menempelkan catatan satu demi satu, sampai siap dipresentasikan.' },
  'online-3d-viewer': { desc: 'Punya berkas STEP, tetapi tidak punya lisensi CAD? Buka STEP, STL, OBJ, glTF, FBX, dan format lain dalam 3D langsung di <em>browser</em>.' },
  'costofliving-comparator': {
    desc: 'Gaji yang lebih tinggi di kota baru belum tentu berarti uang yang lebih banyak. Lihat daya beli penghasilanmu yang sebenarnya di kota tujuan.',
    menu: {
      [`${T}costofliving-comparator/`]: { sub: 'Beberapa kota berdampingan' },
      [`${T}costofliving-comparator/map/`]: { sub: 'Kotamu dibandingkan dengan lebih dari 500 kota di peta' },
    },
  },
  'global-income-tax-calculator': { id: `${T}global-income-tax-calculator/id/`, desc: 'Berapa sisa gaji setelah pajak penghasilan di 31 negara, termasuk 39 negara bagian AS dan Washington DC? Bandingkan beberapa tawaran kerja secara berdampingan, lalu baca penjelasan aturan pajak tiap negara dalam bahasa Indonesia.' },
  'videotogif': { desc: 'Saya enggan berlangganan aplikasi hanya untuk membuat GIF, jadi saya membuat <em>tool</em> ini sendiri. Ubah video menjadi GIF di perangkatmu, gratis dan tanpa diunggah ke mana pun.' },
  'randompicker': { desc: 'Capek memutuskan? Putar roda, lempar dadu, tarik tuas mesin slot, atau jatuhkan bola, lalu biarkan undian yang memilih satu untukmu.' },
  'worldclock': { desc: 'Kalau di Perth pukul 15.00, di Jakarta pukul berapa? Peta dunia ini menampilkan waktu setempat yang terus berjalan, lengkap dengan <em>daylight saving</em>.' },
  'eggprice': { desc: 'Yang seharusnya kamu bayar adalah proteinnya, bukan kalsium cangkangnya, jadi hitung harga tiap kemasan telur per gram isinya.' },
  'borrowingcapacity': { desc: 'Berapa besar pinjaman yang bersedia bank berikan di Australia, dan syarat mana yang membatasi plafonmu? Hitung dengan rumus yang dipakai bank-bank di sana.' },
  'valuateeverything': { desc: 'Setiap penjual mengaku harganya sudah pas. Susun model harga dari iklan yang sudah kamu lihat, lalu temukan harga wajarnya.' },
  'superdasp': { desc: 'Berencana meninggalkan Australia suatu hari nanti? Cek apakah <em>salary sacrifice</em> ke <em>super</em> masih menguntungkan setelah pajak DASP diperhitungkan.' },
};

// ---- What the script on the page writes (read by index.html's own script).
const HOME_I18N = {
  labels: LABELS,
  everydayWork: 'pekerjaan sehari-hari',
  advertisement: 'Iklan',
  showingOne: 'Menampilkan 1 tool.',
  showingMany: 'Menampilkan {n} tool.',
  moreFilters: 'Filter lainnya',
  fewerFilters: 'Sembunyikan filter',
};

const OG_DESC = 'Kumpulan tool yang membantu saya mengambil keputusan sehari-hari, termasuk urusan pekerjaan, dengan perhitungan yang matang. Saya bagikan secara gratis supaya kamu juga bisa memakainya.';

// ---- Fixed text: [English as it stands in index.html, Indonesian]. Each must occur exactly
// once, so a change to the English page is noticed here.
const GLOBE = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>';
const TEXT = [
  ['<html lang="en">', '<html lang="id">'],
  ['<title>Adjie Brotools</title>', '<title>Adjie Brotools: Tool Gratis untuk Pajak, Keuangan, dan Teknik</title>'],
  ['<meta name="description" content="Free calculators and tools by Adjie Brotosukmono for tax, loans, property, power system engineering and data visualisation. Everything runs in your browser.">',
   '<meta name="description" content="Tool gratis dari Adjie Brotosukmono untuk pajak, pinjaman, properti, teknik sistem tenaga listrik, dan visualisasi data. Semua hitungannya berjalan di browser-mu.">'],
  [`<link rel="canonical" href="${SITE}">`, `<link rel="canonical" href="${SITE}id/">`],
  ['<meta property="og:title" content="Adjie Brotools">', '<meta property="og:title" content="Adjie Brotools: Tool Gratis untuk Pajak, Keuangan, dan Teknik">'],
  ['<meta property="og:description" content="Tools that actually help adjiebrotot (me) in everyday life to make intelligent, well-calculated decisions (and help with the work too). Shared to the world for you to use it as well, because why not.">',
   `<meta property="og:description" content="${OG_DESC}">`],
  [`<meta property="og:url" content="${SITE}">`, `<meta property="og:url" content="${SITE}id/">`],
  [`<meta property="og:image" content="${SITE}og/home.jpg">`, `<meta property="og:image" content="${SITE}og/home-id.jpg">`],
  ['<meta property="og:image:alt" content="Adjie Brotools, a free tool on Adjie Brotools">', '<meta property="og:image:alt" content="Adjie Brotools, kumpulan tool gratis">'],
  ['<meta property="og:locale" content="en_AU">', '<meta property="og:locale" content="id_ID">'],
  ['<meta property="og:locale:alternate" content="id_ID">', '<meta property="og:locale:alternate" content="en_AU">'],
  ['<meta name="twitter:title" content="Adjie Brotools">', '<meta name="twitter:title" content="Adjie Brotools: Tool Gratis untuk Pajak, Keuangan, dan Teknik">'],
  ['<meta name="twitter:description" content="Free browser-based tools for finance, tax, property, and engineering decisions. All calculations run locally: no uploads, no paywall.">',
   '<meta name="twitter:description" content="Tool gratis berbasis browser untuk keputusan keuangan, pajak, properti, dan teknik. Semua hitungan berjalan di perangkatmu tanpa ada data yang diunggah.">'],
  [`<meta name="twitter:image" content="${SITE}og/home.jpg">`, `<meta name="twitter:image" content="${SITE}og/home-id.jpg">`],
  ['<a class="skip-link" href="#tool-directory">Skip to tool directory</a>', '<a class="skip-link" href="#tool-directory">Langsung ke daftar tool</a>'],
  ['<nav class="family-nav" aria-label="Adjie\'s sites">', '<nav class="family-nav" aria-label="Situs Adjie">'],
  ['<a href="https://www.adjiebrotots.com/">Home</a>', '<a href="https://www.adjiebrotots.com/">Beranda</a>'],
  ['<a href="https://blog.adjiebrotots.com/">Blog</a>\n', '<a href="https://blog.adjiebrotots.com/id/" hreflang="id">Blog</a>\n'],
  [`<a class="family-lang" href="id/" hreflang="id" lang="id" title="Baca dalam Bahasa Indonesia">${GLOBE}ID</a>`,
   `<a class="family-lang" href="../" hreflang="en" lang="en" title="Read this in English">${GLOBE}EN</a>`],
  ['aria-label="Switch between day and night"', 'aria-label="Ganti tema terang atau gelap"'],
  ['data-note="tools that help me, hope they help you too"', 'data-note="tool yang membantu saya, semoga membantumu juga"'],
  ['<p class="hero-type" aria-hidden="true">They help you with <span class="typewriter">', '<p class="hero-type" aria-hidden="true">Siap membantumu soal <span class="typewriter">'],
  ['        Tools that actually help adjiebrotot (me) in everyday life to make intelligent, well-calculated decisions (and help with the work too). Shared to the world for you to use it as well, because why not.\n',
   `        ${OG_DESC}\n`],
  ['<h2 id="tool-directory-heading">Tool directory</h2>', '<h2 id="tool-directory-heading">Daftar tool</h2>'],
  ['<h2 id="filter-heading" class="visually-hidden">Filter tools</h2>', '<h2 id="filter-heading" class="visually-hidden">Saring tool</h2>'],
  ['<label for="searchFilter">Keyword</label>', '<label for="searchFilter">Kata kunci</label>'],
  ['placeholder="Search tools"', 'placeholder="Cari tool"'],
  ['aria-controls="filters" hidden>More filters</button>', 'aria-controls="filters" hidden>Filter lainnya</button>'],
  ['<option value="all">All statuses</option>', '<option value="all">Semua status</option>'],
  ['<label for="domainFilter">Domain</label>', '<label for="domainFilter">Bidang</label>'],
  ['<option value="all">All domains</option>', '<option value="all">Semua bidang</option>'],
  ['<label for="geographyFilter">Geography</label>', '<label for="geographyFilter">Wilayah</label>'],
  ['<option value="all">All geographies</option>', '<option value="all">Semua wilayah</option>'],
  ['type="reset">Reset</button>', 'type="reset">Atur ulang</button>'],
  ['aria-live="polite">Showing 5 tools.</p>', 'aria-live="polite">Menampilkan semua tool.</p>'],
  ['        No tools match your current filters. Try clearing one or more filters.\n', '        Tidak ada tool yang cocok dengan filter yang kamu pilih. Coba kosongkan satu atau beberapa filter.\n'],
  ['<p class="footer-collab"><strong>A hobby project by <a href="https://www.adjiebrotots.com/about/">Adjie</a>, open to collaboration.</strong> These tools are free to use. If your organisation could use a custom tool or training, <a href="mailto:hi@adjiebrotots.com?subject=Collaboration">let’s talk</a>; I’m based in Perth and occasionally visit Jakarta. Bugs or questions: <a href="mailto:hi@adjiebrotots.com">hi@adjiebrotots.com</a> 🙂</p>',
   '<p class="footer-collab"><strong>Ini proyek hobi saya, <a href="https://www.adjiebrotots.com/about/">Adjie</a>, dan terbuka untuk kolaborasi.</strong> Kalau organisasimu butuh <em>tool</em> khusus atau pelatihan, <a href="mailto:hi@adjiebrotots.com?subject=Kolaborasi">mari ngobrol</a>; saya tinggal di Perth dan sesekali pulang ke Jakarta. Kalau menemukan <em>bug</em> atau punya pertanyaan, kirim saja ke <a href="mailto:hi@adjiebrotots.com">hi@adjiebrotots.com</a> 🙂</p>'],
  ['<p class="footer-links"><a href="disclaimer/">Disclaimer</a> · <a href="privacy/">Privacy Policy</a> · <a href="https://blog.adjiebrotots.com/">Blog</a></p>',
   '<p class="footer-links"><a href="disclaimer/id/">Penafian</a> · <a href="privacy/id/">Kebijakan Privasi</a> · <a href="https://blog.adjiebrotots.com/id/" hreflang="id">Blog</a></p>'],
  ['alt="Australian flag"', 'alt="Bendera Australia"'],
  ['Licensed under <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener">GNU GPL</a>, free to use, modify, and share with source code disclosed.',
   'Berlisensi <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener">GNU GPL</a>: kode sumbernya terbuka dan bebas dipakai, diubah, serta dibagikan.'],
  ['alt="Indonesian badge"', 'alt="Lencana Indonesia"'],
  ['Made in Australia by <a href="https://www.adjiebrotots.com/about/" rel="author">Adjie Brotosukmono</a>, an Indonesian engineer.',
   'Dibuat di Australia oleh <a href="https://www.adjiebrotots.com/about/" rel="author">Adjie Brotosukmono</a>, insinyur asal Indonesia.'],
];

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = s => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');

function swap(html, from, to, what){
  const n = html.split(from).length - 1;
  if(n !== 1){ PROBLEMS.push(`${what}: expected 1 match, found ${n}: ${from.slice(0, 90)}`); return html; }
  return html.replace(from, () => to);
}

// ---- One card.
const items = [];
function card(html){
  const key = (html.match(/data-anim="([^"]+)"/) || [])[1];
  const c = CARDS[key];
  if(!c){ PROBLEMS.push(`card "${key}": no Indonesian words in CARDS`); return html; }
  const lang = c.id ? 'id' : 'en';
  const enUrl = `${T}${key}/`;

  // Title and its link. A tool with no Indonesian page keeps its English name (lang="en").
  html = html.replace(/<h3 itemprop="name">([\s\S]*?)<\/h3>/, (m, inner) => {
    const name = c.name || plain(inner).trim();
    if(/<a /.test(inner)){
      const a = inner.replace(/href="([^"]+)"/, (x, h) => `href="${h === enUrl && c.id ? c.id : h}" hreflang="${lang}"`).replace(/>[^<]*<\/a>/, `>${esc(name)}</a>`);
      return `<h3 itemprop="name"${c.name ? '' : ' lang="en"'}>${a}</h3>`;
    }
    return `<h3 itemprop="name" lang="en">${inner}</h3>`;
  });
  // The description.
  html = html.replace(/(<p class="tool-description" itemprop="description">)[\s\S]*?(<\/p>)/, (m, a, b) => a + c.desc + b);
  // Status badge.
  html = html.replace(/<span class="status-badge ([^"]+)" title="([^"]+)"><span class="visually-hidden">([^<]+)<\/span><\/span>/, (m, cls, t) => {
    const w = LABELS[t]; if(!w) PROBLEMS.push(`status "${t}": no Indonesian label`);
    return `<span class="status-badge ${cls}" title="${w || t}"><span class="visually-hidden">${w || t}</span></span>`;
  });
  // Tags.
  html = html.replace(/<ul class="tool-tags" aria-label="Categories">([\s\S]*?)(\n\s*)<\/ul>/, (m, lis, end) => {
    const out = lis.replace(/<li>([^<]+)<\/li>/g, (x, t) => {
      if(!LABELS[t]) PROBLEMS.push(`tag "${t}" (card ${key}): no Indonesian label`);
      return `<li>${LABELS[t] || t}</li>`;
    });
    return `<ul class="tool-tags" aria-label="Kategori">${out}${end}</ul>`;
  });
  // The open button (and a split button's own menu).
  html = html.replace(/(<a class="tool-link" href=")([^"]+)("[^>]*>)Open tool<\/a>/, (m, a, h, b) =>
    `${a}${h === enUrl && c.id ? c.id : h}" hreflang="${lang}${b}Buka tool</a>`);
  // A tool with no Indonesian page is marked EN beside its open button.
  if(lang === 'en' && /class="tool-link"/.test(html))
    html = html.replace(/(\n\s*)<\/div>(\n\s*<\/div>\n\s*<\/article>)/, (m, a, b) => `${a}  <span class="tool-lang" lang="en" title="Hanya tersedia dalam bahasa Inggris">EN</span>${a}</div>${b}`);
  html = html.replace(/>Coming soon<\/span>/, '>Segera hadir</span>');
  html = html.replace(/aria-label="Choose which (.+?) tool to open"/, (m, n) => `aria-label="Pilih halaman ${esc(c.name || n)} yang ingin dibuka"`);
  html = html.replace(/<a class="combo-opt" role="menuitem" href="([^"]+)"([^>]*)><span class="combo-text"><span class="combo-main">([^<]+)<\/span><span class="combo-sub">([^<]+)<\/span>/g, (m, h, rest, main, sub) => {
    const e = (c.menu || {})[h];
    if(!e){ PROBLEMS.push(`menu entry ${h} (card ${key}): no Indonesian words`); return m; }
    const l = e.lang || 'en';
    return `<a class="combo-opt" role="menuitem" href="${e.href || h}" hreflang="${l}"${rest}><span class="combo-text"><span class="combo-main"${l === 'en' ? ' lang="en"' : ''}>${e.main || main}</span><span class="combo-sub">${e.sub}</span>`;
  });

  const nameNow = plain((html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/) || ['', ''])[1]).trim();
  const url = (html.match(/<a class="tool-link" href="([^"]+)"/) || [])[1];
  if(url) items.push({ name: nameNow, url, description: plain(c.desc), inLanguage: lang });
  return html;
}

function build(){
  let html = readFileSync(join(ROOT, 'index.html'), 'utf8');

  for(const [from, to] of TEXT) html = swap(html, from, to, 'text');

  // The cards. (The grid's comment names "<article class=...>" on one line; the cards break
  // the tag over lines, so the comment is never taken for one.)
  html = html.replace(/<article\s*\n\s*class="tool-card"[\s\S]*?<\/article>/g, card);

  // Structured data: this page as an Indonesian collection of every tool. The site and its
  // maker are described once, on the English home, and named here by their @id.
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Adjie Brotools',
    url: `${SITE}id/`,
    description: 'Kumpulan tool gratis berbasis browser untuk keputusan keuangan, pajak, properti, teknik, dan visualisasi data. Semua hitungan berjalan lokal di browser tanpa unggah data.',
    inLanguage: 'id',
    isPartOf: { '@id': `${SITE}#website` },
    publisher: { '@id': 'https://www.adjiebrotots.com/#person' },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: items.map((it, i) => ({
        '@type': 'ListItem', position: i + 1,
        item: { '@type': 'WebApplication', name: it.name, url: it.url, description: it.description, inLanguage: it.inLanguage, isAccessibleForFree: true },
      })),
    },
  };
  let n = 0;
  html = html.replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, () =>
    n++ ? '' : `\n  <script type="application/ld+json">\n${JSON.stringify(ld, null, 2)}\n  </script>`);

  // The words the page's own script writes, set before it runs.
  html = swap(html, '\n  <script>\n    // The words this script writes.',
    `\n  <script>window.HOME_I18N = ${JSON.stringify(HOME_I18N)};</script>\n  <script>\n    // The words this script writes.`, 'script');

  // Paths one level deeper. "./" stays: on this page it is the Indonesian home itself.
  html = html.replace(/\b(href|src)="(?!https?:|#|mailto:|data:|\/|\.\/|\.\.\/)([^"]+)"/g, '$1="../$2"');

  // Anything still English that should not be.
  for(const left of ['>Open tool<', 'aria-label="Categories"', 'Choose which', '>Tool directory<'])
    if(html.includes(left)) PROBLEMS.push(`left in English: ${left}`);

  return html.replace('<head>', '<head>\n  <!-- Generated by _ref/bake-home-id.mjs from index.html: edit that (and the Indonesian words in the script), then run it. -->');
}

const html = build();
if(PROBLEMS.length){ console.error(PROBLEMS.map(s => '  ' + s).join('\n')); process.exit(1); }
const out = join(ROOT, 'id', 'index.html');
const old = existsSync(out) ? readFileSync(out, 'utf8') : '';
if(CHECK){
  if(old !== html){ console.error('out of date: id/index.html (run node _ref/bake-home-id.mjs)'); process.exit(1); }
  console.log('id/index.html is up to date.');
} else {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log(`id/index.html ${old === html ? 'unchanged' : 'written'} (${items.length} tools).`);
}
