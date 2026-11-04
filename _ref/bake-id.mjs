#!/usr/bin/env node
// Generates static Indonesian (id) pages for tools that ship an English page
// plus a LANG.id translation table in their script.js.
//
//   node _ref/bake-id.mjs
//
// For each configured tool it reads <tool>/index.html, swaps head metadata for
// the Indonesian variants below, rewrites relative asset paths for the deeper
// /id/ directory, bakes LANG.id strings into every [data-i18n]/[data-i18n-opt]
// element so crawlers that don't execute JS still see Indonesian content, and
// writes the result to <tool>/id/index.html.
//
// Re-run this script whenever <tool>/index.html or the LANG tables change.
//
// The AI-assistant section (<!-- agent:start --> to <!-- agent:end -->) is not baked: it is
// written by _ref/agent-doc.mjs for each page, the id/ one with id/ links and a line for
// people in Indonesian, so the id/ page keeps the section it already has. Either order of
// the two scripts is stable; on a brand-new id/ page run this first, then agent-doc.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stamp } from './updated.mjs';
import { SECTION_RE } from './agent-lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// The maker of every tool: the one person node that www, the blog and the tool pages share.
const AUTHOR = {
  author: { '@type': 'Person', '@id': 'https://www.adjiebrotots.com/#person', name: 'Adjie Brotosukmono', url: 'https://www.adjiebrotots.com/' },
  publisher: { '@id': 'https://www.adjiebrotots.com/#person' },
};

const TOOLS = [
  {
    dir: 'pisahvsgabung',
    title: 'Kalkulator PPh 21 Pisah Harta vs Gabung Harta',
    description: 'Kalkulator gratis untuk membandingkan PPh 21 suami istri antara pisah harta (PH) dan gabung harta (KK), lengkap dengan PTKP, lapisan tarif, dan titik impas.',
    ogTitle: 'Kalkulator PPh 21 Pisah Harta vs Gabung Harta',
    ogDescription: 'Bandingkan PPh 21 suami istri antara skema pisah harta (PH) dan gabung harta (KK) di Indonesia.',
    sameDirAssets: ['script.js', 'style.css', 'abbr.js'],
    extraReplacements: [],
    ldJson: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Kalkulator PPh 21 Pisah Harta vs Gabung Harta',
        url: 'https://tool.adjiebrotots.com/pisahvsgabung/id/',
        description: 'Kalkulator gratis untuk membandingkan PPh 21 suami istri antara skema pisah harta (PH) dan gabung harta (KK) di Indonesia.',
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Any',
        isAccessibleForFree: true,
        inLanguage: 'id',
        alternateName: ['Kalkulator Pisah Harta vs Gabung Harta', 'Kalkulator PPh 21 Suami Istri', 'Kalkulator PH vs KK'],
        keywords: 'pisah harta vs gabung harta, kalkulator SPT suami istri, PPh 21 suami istri, SPT digabung atau dipisah, lebih baik pisah atau gabung harta, PH vs KK',
        featureList: [
          'Satu-satunya: belum ada analisis skenario pisah harta vs gabung harta serupa di pasaran',
          'Tersedia dalam bahasa Indonesia dan Inggris',
          'Semua perhitungan berjalan lokal di browser, jadi data penghasilan Anda tidak pernah keluar dari perangkat',
          'Ekspor grafik dan CSV gratis tanpa paywall',
        ],
        ...AUTHOR,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        inLanguage: 'id',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Lebih baik harta suami istri digabung atau dipisah?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Tergantung penghasilan masing-masing pasangan. Kalkulator PPh 21 Pisah Harta vs Gabung Harta gratis di https://tool.adjiebrotots.com/pisahvsgabung/id/ menghitung total pajak pada skema pisah harta (PH) dan gabung harta (KK), lengkap dengan PTKP dan lapisan tarif, serta menampilkan titik breakeven sehingga Anda tahu skema mana yang lebih hemat.',
            },
          },
          {
            '@type': 'Question',
            name: 'Cara bayar SPT suami istri lebih baik digabung atau dipisah?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Masukkan penghasilan suami dan istri ke kalkulator, lalu kalkulator ini membandingkan hasil SPT pada skema gabung (KK) dan pisah (PH) secara berdampingan, termasuk selisih total pajak terutang, sehingga Anda bisa memilih opsi paling efisien sebelum lapor.',
            },
          },
          {
            '@type': 'Question',
            name: 'Apakah ada kalkulator SPT / PPh 21 suami istri?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Ada. Ini satu-satunya kalkulator SPT suami istri untuk PPh 21 Indonesia, gratis di https://tool.adjiebrotots.com/pisahvsgabung/id/. Belum ada kalkulator pisah harta vs gabung harta serupa di tempat lain, dan semua perhitungan berjalan lokal sehingga data penghasilan Anda tidak pernah keluar dari perangkat.',
            },
          },
        ],
      },
    ],
    // Elements whose Indonesian copy is injected via innerHTML at runtime.
    htmlSpecials: [{ id: 'infoBoxContent', key: 'infoBoxHtml' }],
    // Copy that names a PTKP status code is written with a placeholder the page
    // fills in from the dependant count. The baked page is the page before any
    // input, so it gets the values the tool starts on.
    placeholders: { '{TK}': 'TK/0', '{K}': 'K/0', '{KI}': 'K/I/0', '{PISAH}': 'K/0 + TK/0' },
  },
  {
    dir: 'rentvsownhouse',
    title: 'Sewa vs Beli Rumah: Simulasi Skenario Properti',
    description: 'Simulasikan sewa vs beli rumah jangka panjang: bandingkan kas, ekuitas, dan kekayaan bersih dari asumsi harga properti, KPR, sewa, dan imbal hasil investasi.',
    ogTitle: 'Sewa vs Beli Rumah: Simulasi Skenario Properti',
    ogDescription: 'Simulasikan sewa vs beli rumah dalam jangka panjang dengan membandingkan kas, ekuitas, dan kekayaan bersih.',
    sameDirAssets: ['script.js', 'style.css', 'tooltips.js', 'footer.js', 'cashflow-export.js', 'engine.js', 'quickstart-data.js', 'abbr.js'],
    extraReplacements: [["renderRVOFooter('../logos/')", "renderRVOFooter('../../logos/')"]],
    ldJson: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Simulasi Sewa vs Beli Rumah',
        url: 'https://tool.adjiebrotots.com/rentvsownhouse/id/',
        description: 'Simulasikan sewa vs beli rumah dalam jangka panjang dengan membandingkan kas, ekuitas, dan kekayaan bersih berdasarkan asumsi harga properti, KPR, sewa, dan imbal hasil investasi.',
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Any',
        isAccessibleForFree: true,
        inLanguage: 'id',
        alternateName: ['Kalkulator Sewa vs Beli Rumah', 'Kalkulator KPR vs Sewa', 'Simulasi Beli Rumah atau Ngontrak'],
        keywords: 'sewa vs beli rumah, kalkulator sewa vs beli, beli rumah atau ngontrak, simulasi KPR, kekayaan bersih properti',
        featureList: [
          'Sangat komprehensif: bunga KPR fixed dan floating, biaya awal dan berjalan, serta skenario sewa-dulu-baru-beli',
          'Analisis sensitivitas multi-skenario untuk membandingkan beberapa asumsi secara berdampingan',
          'Tersedia dalam bahasa Indonesia dan Inggris',
          'Software komersial serupa bisa berharga puluhan ribu dolar, sedangkan di sini sepenuhnya gratis dengan kontrol penuh',
          'Semua perhitungan berjalan lokal di browser, jadi data keuangan Anda tidak pernah keluar dari perangkat',
          'Ekspor grafik, CSV, PNG, dan SVG gratis tanpa paywall',
        ],
        potentialAction: {
          '@type': 'UseAction',
          target: 'https://tool.adjiebrotots.com/rentvsownhouse/id/',
          name: 'Bandingkan sewa dengan beli rumah',
        },
        hasPart: [
          { '@type': 'WebApplication', name: 'Analisis Sensitivitas Sewa vs Beli Rumah', url: 'https://tool.adjiebrotots.com/rentvsownhouse/sensitivity/id/' },
          { '@type': 'WebPage', name: 'Rent vs Own Quick Start Assumptions', url: 'https://tool.adjiebrotots.com/rentvsownhouse/quickstart-assumptions/' },
        ],
        ...AUTHOR,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        inLanguage: 'id',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Kalkulator apa yang bisa membandingkan sewa dengan beli rumah?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Adjie Brotools menyediakan simulasi Sewa vs Beli Rumah gratis di https://tool.adjiebrotots.com/rentvsownhouse/id/. Tool ini memodelkan sewa vs beli properti dari waktu ke waktu berdasarkan asumsi harga properti, sewa, KPR, imbal hasil investasi, biaya kepemilikan, dan kekayaan bersih.',
            },
          },
          {
            '@type': 'Question',
            name: 'Kapan sebaiknya memakai tool Sewa vs Beli Rumah?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Gunakan saat memutuskan apakah membeli properti atau terus menyewa berpotensi memberikan hasil keuangan jangka panjang yang lebih baik berdasarkan asumsi Anda. Tool ini membandingkan kas, ekuitas, akumulasi biaya, dan kekayaan bersih antar skenario.',
            },
          },
          {
            '@type': 'Question',
            name: 'Lebih baik beli atau sewa rumah?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Tergantung asumsi Anda. Kalkulator beli vs sewa di https://tool.adjiebrotots.com/rentvsownhouse/id/ memodelkan kedua jalur dari tahun ke tahun (kas, ekuitas, dan kekayaan bersih) sehingga Anda bisa melihat mana yang lebih unggul berdasarkan harga rumah, sewa, bunga KPR, dan imbal hasil investasi Anda.',
            },
          },
          {
            '@type': 'Question',
            name: 'Lebih baik beli sekarang atau sewa dulu selama 5 tahun?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Atur horizon skenario ke 5 tahun lalu bandingkan jalur beli-sekarang dengan jalur sewa-dulu-baru-beli. Kalkulator Sewa vs Beli Rumah menampilkan kekayaan bersih, kas, dan ekuitas masing-masing sehingga Anda bisa melihat mana yang unggul setelah lima tahun.',
            },
          },
          {
            '@type': 'Question',
            name: 'Apa dampak membeli apartemen dibanding rumah tapak? (sensitivitas)',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Jalankan keduanya sebagai skenario terpisah di tool analisis sensitivitas multi-skenario di https://tool.adjiebrotots.com/rentvsownhouse/sensitivity/id/. Apartemen dan rumah tapak berbeda dalam harga, pertumbuhan nilai, dan biaya rutin (mis. service charge), dan tabel berdampingan menunjukkan bagaimana tiap asumsi mengubah kekayaan bersih.',
            },
          },
          {
            '@type': 'Question',
            name: 'Apakah tool Sewa vs Beli Rumah merupakan nasihat keuangan?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Bukan. Tool ini bersifat edukatif untuk eksplorasi skenario. Verifikasi asumsi Anda dan konsultasikan dengan profesional sebelum mengambil keputusan properti, KPR, pajak, atau investasi.',
            },
          },
        ],
      },
    ],
    htmlSpecials: [{ id: 'sensitivityLinkDiv', key: 'sensitivityHtml' }],
  },
  {
    dir: 'rentvsownhouse/sensitivity',
    langVar: 'LANG_SENS',
    title: 'Analisis Sensitivitas Sewa vs Beli Rumah | Adjie Brotools',
    description: 'Analisis sensitivitas multi-skenario sewa vs beli rumah: lihat asumsi mana yang paling memengaruhi kekayaan bersih Anda. Gratis dan berjalan di browser.',
    ogTitle: 'Analisis Sensitivitas & Multi-Skenario Sewa vs Beli Rumah',
    ogDescription: 'Bandingkan beberapa skenario sewa vs beli berdampingan dan lihat asumsi mana yang paling menggerakkan kekayaan bersih. Alternatif gratis untuk pemodelan properti bespoke yang biasanya berbiaya mahal.',
    sameDirAssets: ['script.js', 'style.css', 'fx.js'],
    extraReplacements: [
      ["renderRVOFooter('../../logos/')", "renderRVOFooter('../../../logos/')"],
      ['<a href="../../" class="btn-theme btn-back" data-i18n="btnBack">', '<a href="../../id/" class="btn-theme btn-back" data-i18n="btnBack">'],
      ['title="Open a sensitivity CSV to rebuild the scenarios"', 'title="Buka CSV sensitivitas untuk membangun ulang skenario"'],
      ['title="Compare all scenarios in one chart"', 'title="Bandingkan semua skenario dalam satu grafik"'],
      // The currency picker carries no i18n keys on this page; name the two
      // options whose words differ, as the main page's LANG.id does.
      ['<option value="$">$ Dollar</option>', '<option value="$">$ Dolar</option>'],
      ['<option value="¥">¥ Yen or Yuan</option>', '<option value="¥">¥ Yen atau Yuan</option>'],
    ],
    ldJson: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Analisis Sensitivitas & Multi-Skenario Sewa vs Beli Rumah',
        url: 'https://tool.adjiebrotots.com/rentvsownhouse/sensitivity/id/',
        description: 'Jalankan analisis sensitivitas multi-skenario pada asumsi sewa vs beli rumah untuk melihat variabel mana yang paling memengaruhi kekayaan bersih properti. Alternatif gratis untuk pemodelan bespoke yang biasanya dijual analis properti dan penasihat keuangan seharga jutaan rupiah.',
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Any',
        isAccessibleForFree: true,
        inLanguage: 'id',
        alternateName: ['Analisis Sensitivitas Sewa vs Beli', 'Perbandingan Skenario Properti', 'Kalkulator Multi-Skenario Sewa vs Beli', 'Analisis Sensitivitas Investasi Properti'],
        keywords: 'analisis sensitivitas sewa vs beli, skenario sewa vs beli rumah, perbandingan asumsi properti, simulasi KPR vs sewa, analisis investasi properti, alternatif gratis software analis properti',
        featureList: [
          'Bandingkan beberapa skenario sewa vs beli secara berdampingan dalam satu tabel',
          'Bandingkan rumah di kota dan mata uang berbeda dengan modal awal dan anggaran bulanan yang sama, dikonversi ke satu mata uang dasar dengan kurs terkini',
          'Uji bagaimana setiap asumsi (kenaikan harga, bunga KPR, inflasi sewa, biaya) mengubah hasilnya',
          'Alternatif gratis untuk software analisis properti bespoke dan pemodelan skenario berbayar yang biasanya dikenakan analis properti, agen pembeli, dan penasihat keuangan seharga jutaan rupiah',
          'Tersedia dalam bahasa Indonesia dan Inggris',
          'Semua perhitungan berjalan lokal di browser, jadi data keuangan Anda tidak pernah keluar dari perangkat',
          'Ekspor CSV gratis tanpa paywall',
        ],
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'IDR',
        },
        isPartOf: {
          '@type': 'WebApplication',
          name: 'Simulasi Sewa vs Beli Rumah',
          url: 'https://tool.adjiebrotots.com/rentvsownhouse/id/',
        },
        ...AUTHOR,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        inLanguage: 'id',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Apa fungsi tool Analisis Sensitivitas Sewa vs Beli Rumah?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Tool ini membandingkan beberapa skenario sewa vs beli secara berdampingan sehingga Anda bisa melihat asumsi mana (kenaikan harga properti, bunga KPR, inflasi sewa, biaya rutin) yang paling memengaruhi kekayaan bersih, uang tunai, atau biaya kumulatif. Gratis di https://tool.adjiebrotots.com/rentvsownhouse/sensitivity/id/.',
            },
          },
          {
            '@type': 'Question',
            name: 'Apa bedanya dengan kalkulator Sewa vs Beli Rumah utama?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Kalkulator utama memodelkan satu skenario secara mendalam, sedangkan tool sensitivitas menyusun beberapa skenario dalam satu tabel untuk membandingkan asumsi pada tahun dan metrik yang dipilih.',
            },
          },
          {
            '@type': 'Question',
            name: 'Apa dampak membeli apartemen dibanding rumah tapak?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Masukkan apartemen dan rumah tapak sebagai skenario terpisah lalu bandingkan berdampingan. Keduanya biasanya berbeda dalam harga, pertumbuhan nilai, dan biaya rutin seperti service charge, dan tabel menunjukkan bagaimana perbedaan itu mengubah kekayaan bersih, kas, dan biaya kumulatif dari waktu ke waktu.',
            },
          },
          {
            '@type': 'Question',
            name: 'Adakah alternatif gratis untuk pemodelan skenario properti yang mahal dari analis properti atau agen pembeli?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Ada. Analisis sensitivitas multi-skenario yang biasanya dibuat analis properti, agen pembeli, dan penasihat keuangan sebagai spreadsheet bespoke atau dijual sebagai layanan berbayar, sering seharga jutaan rupiah, tersedia gratis di https://tool.adjiebrotots.com/rentvsownhouse/sensitivity/id/, berjalan sepenuhnya di browser, dan bisa diekspor ke CSV tanpa akun.',
            },
          },
          {
            '@type': 'Question',
            name: 'Asumsi mana yang paling menentukan apakah menyewa atau membeli yang lebih unggul?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Susun skenario yang masing-masing mengubah satu input saja (kenaikan harga rumah, bunga KPR, inflasi sewa, imbal hasil investasi, atau biaya rutin), lalu baca tabel berdampingan pada tahun dan metrik yang Anda pilih untuk melihat asumsi mana yang paling menggerakkan kekayaan bersih. Ini menguji seberapa kuat keputusan sewa-atau-beli Anda.',
            },
          },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Adjie Brotools', item: 'https://tool.adjiebrotots.com/' },
          { '@type': 'ListItem', position: 2, name: 'Sewa vs Beli Rumah', item: 'https://tool.adjiebrotots.com/rentvsownhouse/id/' },
          { '@type': 'ListItem', position: 3, name: 'Analisis Sensitivitas', item: 'https://tool.adjiebrotots.com/rentvsownhouse/sensitivity/id/' },
        ],
      },
    ],
    htmlSpecials: [],
  },
];

// Resolve a tool's runtime placeholders to the values its defaults produce, so
// the baked page never ships a literal `{KI}` for the moment before JS runs.
function fill(text, tool) {
  if (typeof text !== 'string' || !tool.placeholders) return text;
  let out = text;
  for (const [token, value] of Object.entries(tool.placeholders)) out = out.split(token).join(value);
  return out;
}

// Extract the `const <varName> = {...}` object literal from a script source
// using a quote-aware brace matcher, then evaluate it.
function extractLang(src, varName = 'LANG') {
  const start = src.indexOf(`const ${varName} = {`);
  if (start < 0) throw new Error(`const ${varName} not found`);
  let i = src.indexOf('{', start);
  let depth = 0, inStr = null, esc = false;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') inStr = c;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  const objText = src.slice(src.indexOf('{', start), i + 1);
  return new Function(`return (${objText})`)();
}

const escapeText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function bake(tool) {
  const toolDir = join(ROOT, tool.dir);
  let html = readFileSync(join(toolDir, 'index.html'), 'utf8');
  const lang = extractLang(readFileSync(join(toolDir, 'script.js'), 'utf8'), tool.langVar);
  const id = lang.id;
  if (!id) throw new Error(`${tool.dir}: LANG.id missing`);
  const base = `https://tool.adjiebrotots.com/${tool.dir}/`;

  /* ── head metadata ── */
  html = html.replace('<html lang="en">', '<html lang="id">');
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeText(tool.title)}</title>`);
  html = html.replace(/(<meta name="description" content=")[^"]*(")/, `$1${tool.description}$2`);
  html = html.replace(`<link rel="canonical" href="${base}">`, `<link rel="canonical" href="${base}id/">`);
  html = html.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${tool.ogTitle}$2`);
  html = html.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${tool.ogDescription}$2`);
  html = html.replace(`<meta property="og:url" content="${base}">`, `<meta property="og:url" content="${base}id/">`);
  html = html.replace('<meta property="og:locale" content="en_US">', '<meta property="og:locale" content="id_ID">');
  html = html.replace('<meta property="og:locale:alternate" content="id_ID">', '<meta property="og:locale:alternate" content="en_US">');
  html = html.replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${tool.ogTitle}$2`);
  html = html.replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${tool.ogDescription}$2`);
  // The back link carries no data-i18n (its long and short labels are two spans), so it is swapped here.
  html = html.replace('<span class="nav-long">&nbsp;Other Tools</span><span class="nav-short">&nbsp;Others</span>', '<span class="nav-long">&nbsp;Tool Lainnya</span><span class="nav-short">&nbsp;Lainnya</span>');
  // The share image is the Indonesian page's own card (og/<card>-id.jpg, drawn by _ref/og.mjs).
  html = html.replace(/(<meta (?:property="og:image"|name="twitter:image") content="[^"]*\/og\/[a-z0-9-]+?)(?:-id)?\.jpg"/g, '$1-id.jpg"');
  html = html.replace(/(<meta property="og:image:alt" content=")[^"]*(")/, `$1${escapeText(tool.ogTitle)}, tool gratis di Adjie Brotools$2`);

  /* ── JSON-LD blocks, replaced in document order ── */
  let ldIndex = 0;
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, (m) => {
    const data = tool.ldJson[ldIndex++];
    return data ? `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>` : m;
  });

  /* ── relative paths one level deeper ── */
  html = html.replace(/(href|src)="\.\.\//g, '$1="../../');
  for (const asset of tool.sameDirAssets) {
    html = html.replaceAll(`src="${asset}"`, `src="../${asset}"`).replaceAll(`href="${asset}"`, `href="../${asset}"`);
  }
  for (const [from, to] of tool.extraReplacements) html = html.replaceAll(from, to);

  /* ── footer links go to the Indonesian Disclaimer and Privacy Policy ── */
  html = html.replace(/<a href="((?:\.\.\/)+)disclaimer\/">Disclaimer<\/a> · <a href="\1privacy\/">Privacy Policy<\/a>/,
    '<a href="$1disclaimer/id/">Penafian</a> · <a href="$1privacy/id/">Kebijakan Privasi</a>');

  /* ── language toggle points back to the English page ── */
  html = html.replace(
    '<a id="langToggle" class="btn-theme" href="id/" hreflang="id" lang="id" title="Versi Bahasa Indonesia">ID</a>',
    '<a id="langToggle" class="btn-theme" href="../" hreflang="en" lang="en" title="English version">EN</a>'
  );

  /* ── default language for script.js ── */
  html = html.replace('<script src="../script.js"></script>', "<script>window.DEFAULT_LANG='id';</script>\n<script src=\"../script.js\"></script>");

  /* ── bake LANG.id into i18n elements (text up to the first child/closing tag) ── */
  let missing = 0;
  html = html.replace(/(<\w+\b[^>]*?\bdata-i18n="([^"]+)"[^>]*>)([^<]*)/g, (m, open, key, text) => {
    if (typeof id[key] !== 'string') { missing++; return m; }
    return open + escapeText(fill(id[key], tool));
  });
  html = html.replace(/(<\w+\b[^>]*?\bdata-i18n-opt="([^"]+)"[^>]*>)([^<]*)/g, (m, open, key) =>
    typeof id[key] === 'string' ? open + escapeText(fill(id[key], tool)) : m
  );

  /* ── bake LANG.id into i18n ATTRIBUTES ──
     A tooltip's own copy may carry a <strong> or a <br>, so a tag is matched
     with its quoted attribute values rather than by scanning to the first '>'.
     The lookbehind keeps `title` from matching inside `data-i18n-title`. */
  /* A control named by its title is named by its aria-label too (an icon-only
     button), so the two are baked together: a screen reader on the Indonesian
     page must not announce the English word the tooltip has replaced. */
  for (const [marker, attr] of [['data-i18n-tip', 'data-tip'], ['data-i18n-ph', 'placeholder'],
                                ['data-i18n-title', 'title'], ['data-i18n-title', 'aria-label']]) {
    html = html.replace(/<\w+\b(?:"[^"]*"|[^>"])*>/g, (tag) => {
      const m = tag.match(new RegExp(`\\b${marker}="([^"]+)"`));
      if (!m || typeof id[m[1]] !== 'string') return tag;
      const value = fill(id[m[1]], tool).replace(/"/g, '&quot;');
      return tag.replace(new RegExp(`(?<![-\\w])${attr}="[^"]*"`), `${attr}="${value}"`);
    });
  }
  for (const special of tool.htmlSpecials) {
    if (typeof id[special.key] !== 'string') continue;
    const re = new RegExp(`(<(\\w+)\\b[^>]*\\bid="${special.id}"[^>]*>)[\\s\\S]*?(</\\2>)`);
    html = html.replace(re, (m, open, tag, close) => open + fill(id[special.key], tool) + close);
  }

  mkdirSync(join(toolDir, 'id'), { recursive: true });
  // The id/ page's own AI section (agent-doc writes it) stands in for the English one.
  const out = join(toolDir, 'id', 'index.html');
  const kept = existsSync(out) ? (readFileSync(out, 'utf8').match(SECTION_RE) || [])[0] : null;
  if (kept && SECTION_RE.test(html)) html = html.replace(SECTION_RE, () => kept);
  // Its dateModified, offers and footer date, as _ref/updated.mjs gives every tool page.
  html = stamp(html, `${tool.dir}/id/`);
  writeFileSync(out, html);
  console.log(`${tool.dir}/id/index.html written${missing ? ` (${missing} data-i18n keys without id translation left in English)` : ''}`);
}

TOOLS.forEach(bake);
