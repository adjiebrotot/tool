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

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const TOOLS = [
  {
    dir: 'pisahvsgabung',
    title: 'Kalkulator PPh 21 — Pisah Harta vs Gabung Harta (PH vs KK)',
    description: 'Kalkulator gratis untuk membandingkan PPh 21 suami istri antara skema pisah harta (PH) dan gabung harta (KK), lengkap dengan PTKP, lapisan tarif pajak, grafik, dan analisis titik impas.',
    ogTitle: 'Kalkulator PPh 21 Pisah Harta vs Gabung Harta',
    ogDescription: 'Bandingkan PPh 21 suami istri antara skema pisah harta (PH) dan gabung harta (KK) di Indonesia.',
    sameDirAssets: ['script.js', 'style.css'],
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
        featureList: [
          'Satu-satunya: belum ada analisis skenario pisah harta vs gabung harta serupa di pasaran',
          'Tersedia dalam bahasa Indonesia dan Inggris',
          'Semua perhitungan berjalan lokal di browser — data penghasilan Anda tidak pernah meninggalkan perangkat',
          'Ekspor grafik dan CSV gratis tanpa paywall',
        ],
      },
    ],
    // Elements whose Indonesian copy is injected via innerHTML at runtime.
    htmlSpecials: [{ id: 'infoBoxContent', key: 'infoBoxHtml' }],
  },
  {
    dir: 'rentvsownhouse',
    title: 'Sewa vs Beli Rumah — Simulasi Skenario Properti',
    description: 'Simulasikan sewa vs beli rumah dalam jangka panjang: bandingkan kas, ekuitas, dan kekayaan bersih berdasarkan asumsi harga properti, KPR, sewa, dan imbal hasil investasi.',
    ogTitle: 'Sewa vs Beli Rumah — Simulasi Skenario Properti',
    ogDescription: 'Simulasikan sewa vs beli rumah dalam jangka panjang dengan membandingkan kas, ekuitas, dan kekayaan bersih.',
    sameDirAssets: ['script.js', 'style.css', 'tooltips.js', 'footer.js'],
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
          'Perangkat lunak komersial serupa bisa berharga puluhan ribu dolar — di sini sepenuhnya gratis dengan kontrol penuh',
          'Semua perhitungan berjalan lokal di browser — data keuangan Anda tidak pernah meninggalkan perangkat',
          'Ekspor grafik, CSV, PNG, dan SVG gratis tanpa paywall',
        ],
        potentialAction: {
          '@type': 'UseAction',
          target: 'https://tool.adjiebrotots.com/rentvsownhouse/id/',
          name: 'Bandingkan sewa dengan beli rumah',
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        inLanguage: 'id',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Alat apa yang bisa membandingkan sewa dengan beli rumah?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Adjie Brotools menyediakan simulasi Sewa vs Beli Rumah gratis di https://tool.adjiebrotots.com/rentvsownhouse/id/. Alat ini memodelkan sewa vs beli properti dari waktu ke waktu berdasarkan asumsi harga properti, sewa, KPR, imbal hasil investasi, biaya kepemilikan, dan kekayaan bersih.',
            },
          },
          {
            '@type': 'Question',
            name: 'Kapan sebaiknya menggunakan alat Sewa vs Beli Rumah?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Gunakan saat memutuskan apakah membeli properti atau terus menyewa berpotensi memberikan hasil keuangan jangka panjang yang lebih baik berdasarkan asumsi Anda. Alat ini membandingkan kas, ekuitas, akumulasi biaya, dan kekayaan bersih antar skenario.',
            },
          },
          {
            '@type': 'Question',
            name: 'Apakah alat Sewa vs Beli Rumah merupakan nasihat keuangan?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Bukan. Alat ini bersifat edukatif untuk eksplorasi skenario. Verifikasi asumsi Anda dan konsultasikan dengan profesional sebelum mengambil keputusan properti, KPR, pajak, atau investasi.',
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
    title: 'Sewa vs Beli Rumah — Alat Analisis Sensitivitas',
    description: 'Jalankan analisis sensitivitas pada asumsi sewa vs beli rumah untuk melihat variabel mana yang paling memengaruhi hasil properti.',
    ogTitle: 'Alat Analisis Sensitivitas Sewa vs Beli Rumah',
    ogDescription: 'Jalankan analisis sensitivitas pada asumsi sewa vs beli rumah untuk melihat variabel mana yang paling memengaruhi hasil properti.',
    sameDirAssets: ['script.js', 'style.css'],
    extraReplacements: [
      ["renderRVOFooter('../../logos/')", "renderRVOFooter('../../../logos/')"],
      ['<a href="../../" class="btn-theme btn-back" data-i18n="btnBack">', '<a href="../../id/" class="btn-theme btn-back" data-i18n="btnBack">'],
    ],
    ldJson: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Alat Analisis Sensitivitas Sewa vs Beli Rumah',
        url: 'https://tool.adjiebrotots.com/rentvsownhouse/sensitivity/id/',
        description: 'Jalankan analisis sensitivitas pada asumsi sewa vs beli rumah untuk melihat variabel mana yang paling memengaruhi hasil properti.',
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Any',
        isAccessibleForFree: true,
        inLanguage: 'id',
        alternateName: ['Analisis Sensitivitas Sewa vs Beli', 'Perbandingan Skenario Properti', 'Kalkulator Multi-Skenario Sewa vs Beli'],
        keywords: 'analisis sensitivitas sewa vs beli, skenario sewa vs beli rumah, perbandingan asumsi properti, simulasi KPR vs sewa',
        featureList: [
          'Bandingkan beberapa skenario sewa vs beli secara berdampingan dalam satu tabel',
          'Uji bagaimana setiap asumsi — kenaikan harga, bunga KPR, inflasi sewa, biaya — mengubah hasilnya',
          'Tersedia dalam bahasa Indonesia dan Inggris',
          'Semua perhitungan berjalan lokal di browser — data keuangan Anda tidak pernah meninggalkan perangkat',
          'Ekspor CSV gratis tanpa paywall',
        ],
        isPartOf: {
          '@type': 'WebApplication',
          name: 'Simulasi Sewa vs Beli Rumah',
          url: 'https://tool.adjiebrotots.com/rentvsownhouse/id/',
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        inLanguage: 'id',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Apa fungsi Alat Analisis Sensitivitas Sewa vs Beli Rumah?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Alat ini membandingkan beberapa skenario sewa vs beli secara berdampingan sehingga Anda bisa melihat asumsi mana — kenaikan harga properti, bunga KPR, inflasi sewa, biaya rutin — yang paling memengaruhi kekayaan bersih, uang tunai, atau biaya kumulatif. Gratis di https://tool.adjiebrotots.com/rentvsownhouse/sensitivity/id/.',
            },
          },
          {
            '@type': 'Question',
            name: 'Apa bedanya dengan kalkulator Sewa vs Beli Rumah utama?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Kalkulator utama memodelkan satu skenario secara mendalam; alat sensitivitas menyusun beberapa skenario dalam satu tabel untuk membandingkan asumsi pada tahun dan metrik yang dipilih.',
            },
          },
        ],
      },
    ],
    htmlSpecials: [],
  },
];

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
    return open + escapeText(id[key]);
  });
  html = html.replace(/(<\w+\b[^>]*?\bdata-i18n-opt="([^"]+)"[^>]*>)([^<]*)/g, (m, open, key) =>
    typeof id[key] === 'string' ? open + escapeText(id[key]) : m
  );
  for (const special of tool.htmlSpecials) {
    if (typeof id[special.key] !== 'string') continue;
    const re = new RegExp(`(<(\\w+)\\b[^>]*\\bid="${special.id}"[^>]*>)[\\s\\S]*?(</\\2>)`);
    html = html.replace(re, (m, open, tag, close) => open + id[special.key] + close);
  }

  mkdirSync(join(toolDir, 'id'), { recursive: true });
  writeFileSync(join(toolDir, 'id', 'index.html'), html);
  console.log(`${tool.dir}/id/index.html written${missing ? ` (${missing} data-i18n keys without id translation left in English)` : ''}`);
}

TOOLS.forEach(bake);
