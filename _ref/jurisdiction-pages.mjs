#!/usr/bin/env node
// Writes the Global Income Tax Calculator's jurisdiction pages, one per country in two
// languages: global-income-tax-calculator/<slug>/ (English) and <slug>/id/ (Indonesian).
//
//   node _ref/jurisdiction-pages.mjs            write every page, the country lists and the sitemap
//   node _ref/jurisdiction-pages.mjs --check    write nothing; fail if a page or a list is out of date
//
// What each page holds comes from three places, so no figure is typed by hand:
//   global-income-tax-calculator/_jurisdictions/scenarios.mjs   the worked examples' inputs
//   global-income-tax-calculator/engine.js                       every amount on the page
//   global-income-tax-calculator/_jurisdictions/content/<slug>.<lang>.json   the prose
// It also writes the list of country pages, between <!-- jurisdictions:start --> and
// <!-- jurisdictions:end -->, into four pages: the calculator (index.html, English names to
// the English pages) and its Indonesian twin (id/index.html, Indonesian names to the id/
// pages: the Indonesian crawl path to them), and the guide in each language (guides/ and
// guides/id/). The calculator's id/ page itself is baked by _ref/bake-id.mjs, which keeps
// the Indonesian list this script wrote; an Indonesian country page goes back to it.
// The content files are written per language from one brief (never translated), and
// name their examples by the keys in scenarios.mjs. An example key, a slug and the
// folder names are a page's address and anchors: once published, keep them.
//
// Re-run after changing engine.js, a scenario or a content file.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES } from '../global-income-tax-calculator/_jurisdictions/scenarios.mjs';
import { run, loadLink, E } from '../global-income-tax-calculator/_jurisdictions/compute.mjs';
import { xhtmlLinks } from './hreflang.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOOL = 'global-income-tax-calculator';
const SITE = 'https://tool.adjiebrotots.com';
const BASE = `${SITE}/${TOOL}/`;
const CHECK = process.argv.includes('--check');
const DATE = '2026-11-10';
const CONTENT = join(ROOT, TOOL, '_jurisdictions', 'content');

const AUTHOR = { '@type': 'Person', '@id': 'https://www.adjiebrotots.com/#person', name: 'Adjie Brotosukmono', url: 'https://www.adjiebrotots.com/' };

// Country names as each page's reader says them.
const NAMES = {
  en: { AU: 'Australia', SG: 'Singapore', GB: 'United Kingdom', DE: 'Germany', US: 'United States', CA: 'Canada', FR: 'France', NL: 'Netherlands', BE: 'Belgium', CH: 'Switzerland', IT: 'Italy', ES: 'Spain', PT: 'Portugal', NO: 'Norway', SE: 'Sweden', FI: 'Finland', EE: 'Estonia', JP: 'Japan', KR: 'South Korea', CN: 'China', TW: 'Taiwan (China)', HK: 'Hong Kong (China)', ID: 'Indonesia', MY: 'Malaysia', TH: 'Thailand', AE: 'United Arab Emirates', SA: 'Saudi Arabia', QA: 'Qatar', BH: 'Bahrain', KW: 'Kuwait', OM: 'Oman' },
  id: { AU: 'Australia', SG: 'Singapura', GB: 'Inggris', DE: 'Jerman', US: 'Amerika Serikat', CA: 'Kanada', FR: 'Prancis', NL: 'Belanda', BE: 'Belgia', CH: 'Swiss', IT: 'Italia', ES: 'Spanyol', PT: 'Portugal', NO: 'Norwegia', SE: 'Swedia', FI: 'Finlandia', EE: 'Estonia', JP: 'Jepang', KR: 'Korea Selatan', CN: 'Tiongkok', TW: 'Taiwan (Tiongkok)', HK: 'Hong Kong (Tiongkok)', ID: 'Indonesia', MY: 'Malaysia', TH: 'Thailand', AE: 'Uni Emirat Arab', SA: 'Arab Saudi', QA: 'Qatar', BH: 'Bahrain', KW: 'Kuwait', OM: 'Oman' },
};
// Regions for the list of other countries.
const REGIONS = [
  { en: 'Asia Pacific', id: 'Asia Pasifik', cc: ['AU', 'SG', 'HK', 'JP', 'KR', 'CN', 'TW', 'ID', 'MY', 'TH'] },
  { en: 'Europe', id: 'Eropa', cc: ['GB', 'DE', 'NL', 'FR', 'BE', 'CH', 'IT', 'ES', 'PT', 'NO', 'SE', 'FI', 'EE'] },
  { en: 'North America', id: 'Amerika Utara', cc: ['US', 'CA'] },
  { en: 'Gulf states', id: 'Negara Teluk', cc: ['AE', 'SA', 'QA', 'BH', 'KW', 'OM'] },
];

// Page text. No em-dashes (site rule).
const T = {
  en: {
    tool: 'Global Income Tax Calculator',
    back: '← Global Income Tax Calculator',
    open: 'Open the calculator',
    openOwn: 'Work out your own pay',
    langOther: 'Versi Indonesia', langOtherShort: 'ID', langOtherTitle: 'Baca dalam bahasa Indonesia',
    toc: ['Tax rules at a glance', 'Worked examples', 'Tax tips', 'What the calculator leaves out', 'Questions'],
    h2: ['Tax rules at a glance', 'Worked examples', 'Tax tips', 'What the calculator does not model', 'Frequently asked questions'],
    sources: 'Sources',
    refs: 'References', refsToc: 'References', refBack: 'Back to the text',
    rulesLine: (year, place) => `Rules for ${year}${place ? ', ' + place : ''}. Every amount below is worked out by the calculator's own engine, the same one the tool runs.`,
    gross: 'Gross pay', grossW: 'a year, before tax',
    net: 'Take-home pay',
    netW: (pct, month) => `${pct} of gross, ${month} a month`,
    band: (lo, hi, rate) => `${lo} to ${hi} at ${rate}`, rising: (a, b) => `${a} rising to ${b}`,
    bandW: 'bracket, part of the tax above', adjW: 'part of the tax above',
    kind: { tax: 'tax, taken from pay', social: 'contribution, taken from pay', other: 'taken from pay', benefit: 'added to pay', deduction: 'lowers the taxable income', credit: 'credit, already inside the tax', employer: 'paid by the employer, on top', info: 'for information' },
    openEx: 'Open this example in the calculator',
    marginal: m => `The next 1% of pay loses ${m} to tax and contributions.`,
    exList: 'Examples on this page',
    others: 'Income tax in other countries',
    end: 'Ready to work out your own?',
    endMore: 'Then see how far it goes in the Cost of Living Comparator',
    disclaimer: '<strong>General information, not tax advice.</strong> The figures follow the rules as published for the year shown. Check the ones that matter to you with the tax authority or an adviser before you sign a contract.',
    collab: '<strong>A hobby project, open to collaboration.</strong> This tool is free to use. If your organisation could use a custom tool or training, <a href="mailto:hi@adjiebrotots.com?subject=Collaboration">let’s talk</a>. Bugs or questions: <a href="mailto:hi@adjiebrotots.com">hi@adjiebrotots.com</a> 🙂',
    links: ['Disclaimer', 'Privacy Policy', 'Blog'],
    updated: 'Updated', months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    gpl: 'Licensed under <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener">GNU GPL</a>, free to use, modify, and share with source code disclosed.',
    made: 'Made in Australia by <a href="https://www.adjiebrotots.com/about/" rel="author">Adjie Brotosukmono</a>, an Indonesian engineer.',
    flagAlt: ['Australian flag', 'Indonesian badge'],
    crumbs: 'Adjie Brotools',
    ogAlt: 'Global Income Tax Calculator, a free tool on Adjie Brotools',
    locale: 'en_AU',
    bmc: 'Kept more of your pay? A coffee is deductible from my happiness, not your tax!',
  },
  id: {
    tool: 'Kalkulator Gaji Bersih dan Pajak Penghasilan',
    back: '← Kalkulator Gaji Bersih dan Pajak Penghasilan',
    open: 'Buka <em>tool</em>-nya',
    openOwn: 'Hitung gajimu sendiri',
    langOther: 'English version', langOtherShort: 'EN', langOtherTitle: 'Read in English',
    toc: ['Ringkasan aturan pajak', 'Contoh perhitungan', 'Tips pajak', 'Yang tidak dihitung', 'Tanya jawab'],
    h2: ['Ringkasan aturan pajak', 'Contoh perhitungan', 'Tips pajak', 'Yang tidak dihitung <em>tool</em> ini', 'Pertanyaan yang sering diajukan'],
    sources: 'Sumber',
    refs: 'Referensi', refsToc: 'Referensi', refBack: 'Kembali ke teks',
    rulesLine: (year, place) => `Aturan tahun ${year}${place ? ', ' + place : ''}. Semua angka di bawah ini dihitung oleh mesin hitung yang sama dengan yang dipakai tool-nya.`,
    gross: 'Gaji kotor', grossW: 'setahun, sebelum pajak',
    net: 'Gaji bersih',
    netW: (pct, month) => `${pct} dari gaji kotor, ${month} sebulan`,
    band: (lo, hi, rate) => `${lo} sampai ${hi}, tarif ${rate}`, rising: (a, b) => `${a} naik ke ${b}`,
    bandW: 'lapisan tarif, bagian dari pajak di atas', adjW: 'bagian dari pajak di atas',
    kind: { tax: 'pajak, dipotong dari gaji', social: 'iuran, dipotong dari gaji', other: 'dipotong dari gaji', benefit: 'menambah gaji', deduction: 'mengurangi penghasilan kena pajak', credit: 'kredit pajak, sudah masuk di pajaknya', employer: 'dibayar pemberi kerja, di luar gaji', info: 'keterangan' },
    openEx: 'Buka contoh ini di kalkulator',
    marginal: m => `Dari setiap tambahan 1% gaji, ${m} habis untuk pajak dan iuran.`,
    exList: 'Contoh di halaman ini',
    others: 'Pajak penghasilan di negara lain',
    end: 'Siap menghitung gajimu sendiri?',
    endMore: 'Bandingkan daya beli gaji bersihmu di <em>tool</em> Cost of Living Comparator',
    disclaimer: '<strong>Informasi umum, bukan nasihat pajak.</strong> Angka dalam hitungan ini mengikuti aturan yang diterbitkan untuk tahun pajak yang tercantum di halaman ini. Pastikan angka yang penting bagimu dengan otoritas pajak atau konsultan pajak sebelum kamu menandatangani kontrak kerja.',
    collab: '<strong>Ini proyek hobi saya dan terbuka untuk kolaborasi.</strong> <em>Tool</em> ini gratis dipakai. Kalau organisasimu butuh <em>tool</em> khusus atau pelatihan, <a href="mailto:hi@adjiebrotots.com?subject=Kolaborasi">mari ngobrol</a>. Kalau menemukan <em>bug</em> atau punya pertanyaan, kirim saja ke <a href="mailto:hi@adjiebrotots.com">hi@adjiebrotots.com</a> 🙂',
    links: ['Penafian', 'Kebijakan Privasi', 'Blog'],
    updated: 'Diperbarui', months: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
    gpl: 'Berlisensi <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener">GNU GPL</a>: kode sumbernya terbuka dan bebas dipakai, diubah, serta dibagikan.',
    made: 'Dibuat di Australia oleh <a href="https://www.adjiebrotots.com/about/" rel="author">Adjie Brotosukmono</a>, insinyur asal Indonesia.',
    flagAlt: ['Bendera Australia', 'Lencana Indonesia'],
    crumbs: 'Adjie Brotools',
    ogAlt: 'Global Income Tax Calculator, tool gratis di Adjie Brotools',
    locale: 'id_ID',
    bmc: 'Pajaknya sudah lebih hemat? Sisihkan sedikit untuk traktir saya kopi susu!',
  },
};

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const strip = s => String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
// Money as the page's reader writes it: 1,234 in English, 1.234 in Indonesian.
const SYM = { USD: 'US$', EUR: '€', NOK: 'NOK ', SEK: 'SEK ', CHF: 'CHF ', AED: 'AED ', SAR: 'SAR ', QAR: 'QAR ', BHD: 'BHD ', KWD: 'KWD ', OMR: 'OMR ' };
const symOf = cc => SYM[E.C[cc].cur] || E.C[cc].sym;
const num = (v, lang) => Math.round(v).toLocaleString(lang === 'id' ? 'id-ID' : 'en-US');
const money = (v, cc, lang) => (v < 0 ? '−' : '') + symOf(cc) + num(Math.abs(v), lang);
const pct = (v, lang) => { const s = (v * 100).toFixed(1); return (lang === 'id' ? s.replace('.', ',') : s) + '%'; };

function readContent(slug, lang){
  const f = join(CONTENT, `${slug}.${lang}.json`);
  if(!existsSync(f)) return null;
  // Writers sometimes italicise the Markdown way (*term*): make it HTML everywhere.
  const em = v => typeof v === 'string' ? v.replace(/(^|[^*\w])\*([^*\n]+?)\*(?![*\w])/g, '$1<em>$2</em>')
    : Array.isArray(v) ? v.map(em) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'lineLabels' ? x : em(x)])) : v;
  return em(JSON.parse(readFileSync(f, 'utf8')));
}

const PROBLEMS = [];
function problem(msg){ PROBLEMS.push(msg); }

// Numbered references, the way the blog's footnotes work: a fact carries a small superscript
// number linked to one References list at the foot of the page. A content item's `cite` is a
// list of { name, url, note? }, each naming the page that states the fact, not a home page,
// so a reader who clicks lands on the table or the rule (a #:~:text= fragment can point the
// browser at the exact words). One page, one number per URL, numbered in reading order;
// law.sources not cited anywhere else are listed after them.
function makeRefs(lang, where){
  const list = [], byUrl = new Map();
  const add = (s, w) => {
    if(!/^https:\/\/[^/]+\/./.test(s.url || '')) problem(`${where} ${w}: cite "${s.name}" is not a deep https link (${s.url || 'no url'})`);
    if(!s.name) problem(`${where} ${w}: a cite has no name`);
    if(!byUrl.has(s.url)){ list.push({ ...s, n: list.length + 1, uses: 0 }); byUrl.set(s.url, list[list.length - 1]); }
    return byUrl.get(s.url);
  };
  return {
    // Register in reading order before anything is drawn, so the numbers run 1, 2, 3 down the page.
    reg(cites, w){ (cites || []).forEach(s => add(s, w)); },
    // The superscript for a list of cites: <sup>1, 4</sup>, each linked to its reference.
    mark(cites){
      if(!cites || !cites.length) return '';
      const seen = new Set();
      const links = cites.map(s => byUrl.get(s.url) || add(s, 'late')).filter(r => !seen.has(r.n) && seen.add(r.n))
        .map(r => { r.uses++; return `<a href="#ref-${r.n}" id="cite-${r.n}-${r.uses}" role="doc-noteref">${r.n}</a>`; });
      return `<sup class="jx-fn">${links.join(', ')}</sup>`;
    },
    // Put the mark at the end of the item's last paragraph or list item.
    into(html, cites){
      const m = this.mark(cites);
      if(!m) return html || '';
      if(!html) return m;
      const i = Math.max(html.lastIndexOf('</p>'), html.lastIndexOf('</li>'));
      return i < 0 ? html + m : html.slice(0, i) + m + html.slice(i);
    },
    get has(){ return list.length > 0; },
    html(){
      if(!list.length) return '';
      const t = T[lang];
      const back = r => Array.from({ length: r.uses }, (_, k) => ` <a class="jx-back" href="#cite-${r.n}-${k + 1}" role="doc-backlink" aria-label="${t.refBack}">↩${r.uses > 1 ? `<sup>${k + 1}</sup>` : ''}</a>`).join('');
      return `
    <section class="gd-sec card jx-refs" id="references" aria-labelledby="references-h" role="doc-endnotes">
      <h2 id="references-h">${t.refs}</h2>
      <ol>
        ${list.map(r => `<li id="ref-${r.n}"><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.name)}</a>${r.note ? `, ${r.note}` : ''}${back(r)}</li>`).join('\n        ')}
      </ol>
    </section>`;
    },
  };
}

function exampleHtml(p, ex, c, lang, refs){
  const t = T[lang], cc = p.cc;
  const r = run(cc, ex);
  const say = text => {
    if(lang === 'en') return text;
    const m = c.lineLabels && c.lineLabels[text];
    if(!m) problem(`${p.slug}.${lang}: no Indonesian for line "${text}"`);
    return m || text;
  };
  const label = l => say(l.label);
  const rate = v => Array.isArray(v) ? t.rising(rate(v[0]), rate(v[1])) : (lang === 'id' ? String(+(v*100).toFixed(4)).replace('.', ',') : String(+(v*100).toFixed(4))) + '%';
  // A tax line worked out on marginal brackets, bracket by bracket (the engine's l.brackets, as the
  // calculator's breakdown shows it): each bracket the base reaches, then what turns their sum into
  // the line (credits, surcharges), then any rounding the rules make.
  const bandRows = l => {
    const b = l.brackets;
    if(!b || !(b.base > 0)) return [];
    const li = (text, w, v) => `<li class="jx-k-band"><span class="gd-calc-l">${esc(text)}</span><span class="gd-calc-w">${w}</span><b>${v}</b></li>`;
    return b.rows.map(x => li(t.band(money(x.lo, cc, lang), money(x.hi, cc, lang), rate(x.rate)), t.bandW, money(x.amount, cc, lang)))
      .concat(b.adj.map(a => li(say(a.label), t.adjW, money(Math.abs(a.amount), cc, lang))))
      .concat(b.rest ? [li(say(b.restLabel), t.adjW, money(b.rest, cc, lang))] : []);
  };
  const amt = l => {
    if(['tax', 'social', 'other'].includes(l.kind)) return l.amount ? money(-l.amount, cc, lang) : money(0, cc, lang);
    if(l.kind === 'benefit') return '+' + money(l.amount, cc, lang);
    return money(l.amount, cc, lang);
  };
  const rows = [`<li><span class="gd-calc-l">${t.gross}</span><span class="gd-calc-w">${t.grossW}</span><b>${money(ex.amount, cc, lang)}</b></li>`];
  for(const l of r.lines){
    if(l.inBrackets) continue;     // already a row under its tax line's brackets
    // An info line with nothing to add is said in its label alone.
    rows.push(`<li class="jx-k-${l.kind}"><span class="gd-calc-l">${esc(label(l))}</span><span class="gd-calc-w">${t.kind[l.kind] || ''}</span><b>${amt(l)}</b></li>`);
    rows.push(...bandRows(l));
  }
  // The engine's net can include a holiday allowance added on top (the Netherlands).
  rows.push(`<li class="gd-calc-total"><span class="gd-calc-l">${t.net}</span><span class="gd-calc-w">${t.netW(pct(r.net / ex.amount, lang), money(r.net / 12, cc, lang))}</span><b>${money(r.net, cc, lang)}</b></li>`);
  const note = `${NAMES[lang][cc]}: ${strip(ex.titleText)}`;
  const href = (lang === 'id' ? '../../id/' : '../') + loadLink(cc, ex, note);
  const marg = r.marginal == null ? '' : ` ${t.marginal(pct(r.marginal, lang))}`;
  return `
      <article class="gd-calc jx-ex" id="${ex.key}" aria-labelledby="${ex.key}-h">
        <h3 id="${ex.key}-h">${ex.title}</h3>
        ${ex.intro || ex.cite ? `<div class="jx-prose">${refs.into(ex.intro || '', ex.cite)}</div>` : ''}
        <ol>
          ${rows.join('\n          ')}
        </ol>
        ${ex.after ? `<div class="jx-prose jx-after">${ex.after}</div>` : ''}
        <p class="jx-open"><a href="${esc(href)}">${t.openEx} →</a><span class="jx-marg">${marg}</span></p>
      </article>`;
}

function page(p, lang){
  const c = readContent(p.slug, lang);
  if(!c) return null;
  const t = T[lang], cc = p.cc, C = E.C[cc];
  const up = lang === 'id' ? '../../../' : '../../';
  const toolRel = lang === 'id' ? '../../' : '../';
  // The calculator in the page's own language (its Indonesian twin is id/).
  const calcRel = lang === 'id' ? '../../id/' : '../';
  const url = `${BASE}${p.slug}/${lang === 'id' ? 'id/' : ''}`;
  const urlEn = `${BASE}${p.slug}/`, urlId = `${BASE}${p.slug}/id/`;
  const hasOther = !!readContent(p.slug, lang === 'id' ? 'en' : 'id');
  const exByKey = Object.fromEntries((c.examples || []).map(e => [e.key, e]));
  for(const ex of p.ex) if(!exByKey[ex.key]) problem(`${p.slug}.${lang}: no text for example "${ex.key}"`);
  for(const k of Object.keys(exByKey)) if(!p.ex.some(e => e.key === k)) problem(`${p.slug}.${lang}: example "${k}" is not in scenarios.mjs`);
  const exs = p.ex.filter(e => exByKey[e.key]).map(e => ({ ...e, ...exByKey[e.key], titleText: exByKey[e.key].title }));
  for(const [k, n] of [['title', 70], ['description', 165]]) if(strip(c[k] || '').length > n) problem(`${p.slug}.${lang}: ${k} is ${strip(c[k]).length} characters (aim ${n} or fewer)`);
  if(/—/.test(JSON.stringify(c))) problem(`${p.slug}.${lang}: an em-dash in the text`);

  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'Article',
      headline: strip(c.h1), description: strip(c.description), url, inLanguage: lang,
      datePublished: DATE, dateModified: DATE,
      image: `${SITE}/og/${TOOL}.jpg`,
      about: { '@type': 'Country', name: NAMES.en[cc] },
      mainEntityOfPage: url,
      isPartOf: { '@type': 'WebApplication', name: t.tool, url: lang === 'id' ? `${BASE}id/` : BASE },
      author: AUTHOR, publisher: { '@id': AUTHOR['@id'] },
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: t.crumbs, item: lang === 'id' ? `${SITE}/id/` : `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: t.tool, item: lang === 'id' ? `${BASE}id/` : BASE },
        { '@type': 'ListItem', position: 3, name: strip(c.h1), item: url },
      ],
    },
  ];
  if(c.faq && c.faq.length) ld.push({
    '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: lang,
    mainEntity: c.faq.map(f => ({ '@type': 'Question', name: strip(f.q), acceptedAnswer: { '@type': 'Answer', text: strip(f.a) } })),
  });

  const law = c.law || {};
  const refs = makeRefs(lang, `${p.slug}.${lang}`);
  refs.reg(law.introCite, 'law intro');
  (law.blocks || []).forEach((b, i) => refs.reg(b.cite, `law block ${i + 1}`));
  exs.forEach(e => refs.reg(e.cite, `example ${e.key}`));
  (c.strategies || []).forEach(x => refs.reg(x.cite, `tip "${strip(x.h3)}"`));
  (c.faq || []).forEach(x => refs.reg(x.cite, `question "${strip(x.q)}"`));
  refs.reg(law.sources, 'sources');
  const lawBlocks = (law.blocks || []).map((b, bi) => `
      <h3>${b.h3}${b.html ? '' : refs.mark(b.cite)}</h3>
      ${b.html ? `<div class="jx-prose">${refs.into(b.html, b.cite)}</div>` : ''}${b.table ? `
      <div class="gd-table-wrap"><table class="gd-table jx-table">
        <thead><tr>${b.table.head.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead>
        <tbody>${b.table.rows.map(row => `<tr>${row.map((cell, i) => i === 0 ? `<th scope="row">${cell}</th>` : `<td data-l="${esc(strip(b.table.head[i]))}">${cell}</td>`).join('')}</tr>`).join('\n          ')}</tbody>
      </table></div>` : ''}`).join('\n');

  const others = REGIONS.map(g => {
    const items = g.cc.filter(x => x !== cc).map(x => PAGES.find(q => q.cc === x)).filter(q => q && readContent(q.slug, lang))
      .map(q => `<li><a href="${up}${TOOL}/${q.slug}/${lang === 'id' ? 'id/' : ''}">${NAMES[lang][q.cc]}</a></li>`);
    return items.length ? `<div class="jx-region"><h3>${g[lang]}</h3><ul>${items.join('')}</ul></div>` : '';
  }).join('\n        ');

  const updated = (() => { const [y, m, d] = DATE.split('-').map(Number); return `${t.updated} <time datetime="${DATE}">${d} ${t.months[m - 1]} ${y}</time>`; })();
  const glyph = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false" class="tool-glyph" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle stroke="var(--accent)" cx="10" cy="10" r="7"/><path stroke="var(--accent)" d="M3 10h14M10 3c1.9 2 2.9 4.4 2.9 7s-1 5-2.9 7c-1.9-2-2.9-4.4-2.9-7s1-5 2.9-7z"/><path stroke="var(--accent2)" d="M15.5 16.5h6M15.5 19.5h6M18.5 13.5v9"/></svg>`;
  const ownLink = `${calcRel}#load&v=1&country=${cc}`;
  const adIn = `
    <!-- In-article 3: between the cards of a reading page (.ad-slot in shared.css) -->
    <div class="ad-slot">
      <ins class="adsbygoogle" style="display:block; text-align:center;" data-ad-layout="in-article" data-ad-format="fluid" data-ad-client="ca-pub-8730116101825381" data-ad-slot="1433722275"></ins>
      <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </div>`;
  const adMulti = `
    <!-- Multiplex 2: near the end of a long reading page (.ad-slot in shared.css) -->
    <div class="ad-slot">
      <ins class="adsbygoogle" style="display:block" data-ad-format="autorelaxed" data-ad-client="ca-pub-8730116101825381" data-ad-slot="4659267360"></ins>
      <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </div>`;

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <!-- Generated by _ref/jurisdiction-pages.mjs from ${TOOL}/_jurisdictions/ (scenarios.mjs, content/${p.slug}.${lang}.json) and engine.js: edit those, then run it. -->
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-VYTV157ST0"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    // Analytics cookies wait for a yes in the EEA, the UK and Switzerland (asked by consent.js); ads there are non-personalised until Google's consent message says otherwise.
    gtag('consent', 'default', {analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', region: ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','IS','LI','NO','GB','CH']});
    gtag('consent', 'default', {analytics_storage: 'granted', ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted'});
    try { var abtConsent = localStorage.getItem('abt-consent'); if (abtConsent) gtag('consent', 'update', {analytics_storage: abtConsent}); } catch (e) {}
    gtag('js', new Date());

    gtag('config', 'G-VYTV157ST0');
  </script>
  <!-- Google AdSense -->
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8730116101825381"
       crossorigin="anonymous"></script>
  <script src="${up}consent.js" defer></script>

<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(strip(c.title))} | Adjie Brotools</title>
<meta name="description" content="${esc(strip(c.description))}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${url}">
${hasOther || lang === 'en' ? `<link rel="alternate" hreflang="en" href="${urlEn}">
${readContent(p.slug, 'id') ? `<link rel="alternate" hreflang="id" href="${urlId}">
` : ''}<link rel="alternate" hreflang="x-default" href="${urlEn}">` : ''}
<link rel="sitemap" type="application/xml" href="${SITE}/sitemap.xml">

<meta property="og:type" content="article">
<meta property="og:title" content="${esc(strip(c.h1))}">
<meta property="og:description" content="${esc(strip(c.description))}">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="Adjie Brotot Tools">
<meta property="og:image" content="${SITE}/og/${TOOL}.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(t.ogAlt)}">
<meta property="og:locale" content="${t.locale}">
${hasOther ? `<meta property="og:locale:alternate" content="${T[lang === 'id' ? 'en' : 'id'].locale}">
` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(strip(c.h1))}">
<meta name="twitter:description" content="${esc(strip(c.description))}">
<meta name="twitter:image" content="${SITE}/og/${TOOL}.jpg">

${ld.map(o => `<script type="application/ld+json">\n${JSON.stringify(o, null, 2)}\n</script>`).join('\n')}
<link rel="icon" type="image/svg+xml" href="${up}logos/logo.svg">
<link rel="manifest" href="${up}manifest.webmanifest">
<link rel="apple-touch-icon" href="${up}logos/apple-touch-icon.png">
<script src="${up}pwa.js" defer></script>
<link rel="preload" href="${up}assets/fonts/dm-sans.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${up}fonts.css">
<link rel="stylesheet" href="${up}dark.css">
<link rel="stylesheet" href="${up}light.css">
<link rel="stylesheet" href="${up}shared.css">
<link rel="stylesheet" href="${up}guide-shared.css">
<link rel="stylesheet" href="${toolRel}jurisdiction.css">
</head>
<body class="light">
<!--email_off--><!-- Cloudflare: show the email address as written, so readers and crawlers see it -->
<script src="${up}theme.js"></script>
<div class="container gd jx">

  <nav class="gd-top" aria-label="Site">
    <a class="btn-theme btn-back" href="${calcRel}">${t.back}</a>
    <div class="gd-top-r">
      <a class="btn-primary gd-open gd-open-top" href="${esc(ownLink)}">${t.open}</a>
      ${hasOther ? `<a id="langToggle" class="btn-theme" href="${lang === 'id' ? '../' : 'id/'}" hreflang="${lang === 'id' ? 'en' : 'id'}" lang="${lang === 'id' ? 'en' : 'id'}" title="${t.langOtherTitle}">${t.langOtherShort}</a>` : ''}
      <button class="btn-theme" id="themeToggle" type="button">🌙 Dark</button>
    </div>
  </nav>

  <main>
    <header class="gd-hero">
      <h1>${glyph}${c.h1}</h1>
      <div class="jx-lede">${c.lede}</div>
      <div class="gd-hero-btns">
        <a class="btn-primary gd-open" href="${esc(ownLink)}">${t.openOwn}</a>
      </div>
    </header>

    <nav class="gd-toc jx-toc" aria-label="${lang === 'id' ? 'Di halaman ini' : 'On this page'}">
      <a href="#law">${t.toc[0]}</a>
      <a href="#examples">${t.toc[1]}</a>
      <a href="#strategy">${t.toc[2]}</a>
      <a href="#limits">${t.toc[3]}</a>
      <a href="#faq">${t.toc[4]}</a>
      ${refs.has ? `<a href="#references">${t.refsToc}</a>` : ''}
    </nav>

    <section class="gd-sec card" id="law" aria-labelledby="law-h">
      <h2 id="law-h">${t.h2[0]}</h2>
      ${law.intro ? `<div class="jx-prose">${refs.into(law.intro, law.introCite)}</div>` : ''}
${lawBlocks}
    </section>
${adIn}

    <section class="gd-sec card" id="examples" aria-labelledby="examples-h">
      <h2 id="examples-h">${t.h2[1]}</h2>
      <p class="gd-sub">${esc(t.rulesLine(C.year, C.place && lang === 'en' ? C.place : (c.place || '')))}</p>
      <nav class="jx-exlist" aria-label="${t.exList}">
        <ul>
          ${exs.map(e => `<li><a href="#${e.key}">${strip(e.title)}</a></li>`).join('\n          ')}
        </ul>
      </nav>
${exs.map(e => exampleHtml(p, e, c, lang, refs)).join('\n')}
    </section>

    <section class="gd-sec card" id="strategy" aria-labelledby="strategy-h">
      <h2 id="strategy-h">${t.h2[2]}</h2>
      ${c.strategyIntro ? `<div class="jx-prose">${c.strategyIntro}</div>` : ''}
      ${(c.strategies || []).map(s => `<div class="jx-item">
        <h3>${s.h3}</h3>
        ${refs.into(s.html, s.cite)}
      </div>`).join('\n      ')}
    </section>

    <section class="gd-sec card" id="limits" aria-labelledby="limits-h">
      <h2 id="limits-h">${t.h2[3]}</h2>
      <ul class="gd-facts">
        ${(c.limits || []).map(l => `<li>${l}</li>`).join('\n        ')}
      </ul>
      <p class="gd-note">${t.disclaimer}</p>
    </section>
${adMulti}

    <section class="gd-sec card" id="faq" aria-labelledby="faq-h">
      <h2 id="faq-h">${t.h2[4]}</h2>
      ${(c.faq || []).map(f => `<div class="jx-item">
        <h3>${f.q}</h3>
        ${refs.into(/^\s*</.test(f.a) ? f.a : `<p>${f.a}</p>`, f.cite)}
      </div>`).join('\n      ')}
    </section>
${refs.html()}

    <section class="gd-sec card jx-others" aria-labelledby="others-h">
      <h2 id="others-h">${t.others}</h2>
      <div class="jx-regions">
        ${others}
      </div>
    </section>

    <section class="gd-end">
      <p>${t.end}</p>
      <a class="btn-primary gd-open" href="${esc(ownLink)}">${t.open}</a>
      <a class="gd-more" href="${up}costofliving-comparator/">${t.endMore}</a>
    </section>
  </main>

  <footer>
    <p class="footer-collab">${t.collab}</p>
    <p class="footer-links"><a href="${up}disclaimer/${lang === 'id' ? 'id/' : ''}">${t.links[0]}</a> · <a href="${up}privacy/${lang === 'id' ? 'id/' : ''}">${t.links[1]}</a> · <a href="https://blog.adjiebrotots.com/${lang === 'id' ? 'id/' : ''}"${lang === 'id' ? ' hreflang="id"' : ''}>${t.links[2]}</a> · <span class="footer-updated">${updated}</span></p>
    <div class="gd-made">
      <img loading="lazy" src="${up}logos/australian.png" alt="${t.flagAlt[0]}" class="gd-flag">
      <div><img loading="lazy" src="${up}logos/gpl.png" alt="GNU GPL"><span>${t.gpl}</span></div>
      <div><img loading="lazy" src="${up}logos/indonesian.png" alt="${t.flagAlt[1]}"><span>${t.made}</span></div>
    </div>
  </footer>
</div>
<!-- Deferred: the page paints without them. They add the abbreviation tooltips and flip the theme. -->
<script src="${up}shared.js" defer></script>
<script src="${toolRel}abbr.js" defer></script>
<script src="${toolRel}jurisdiction.js" defer></script>
<!--/email_off-->
<script src="${up}bmc.js" defer></script>
<script data-name="BMC-Widget" data-cfasync="false" src="https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js" data-id="adjiebrotot" data-description="Support me on Buy me a coffee!" data-message="${esc(c.bmc || t.bmc)}" data-color="#FF813F" data-position="Right" data-x_margin="16" data-y_margin="16"></script>
</body>
</html>
`;
}

// ---- The lists of country pages, by region, between the jurisdictions markers.
const block = inner => `<!-- jurisdictions:start (written by _ref/jurisdiction-pages.mjs) -->
      <div class="jx-regions">
          ${inner}
      </div>
      <!-- jurisdictions:end -->`;
const MARKS = /<!-- jurisdictions:start[\s\S]*?<!-- jurisdictions:end -->/;
// One region's list: each page that exists in that language, as `item` writes it.
const regions = (lang, item) => REGIONS.map(g => {
  const li = g.cc.map(x => PAGES.find(q => q.cc === x)).filter(q => q && readContent(q.slug, lang)).map(item);
  return li.length ? `<div class="jx-region"><h3>${g[lang]}</h3><ul>${li.join('')}</ul></div>` : '';
}).join('\n          ');
// The guide (guides/, replacing its old Worked examples card): English names, an ID mark for the Indonesian page.
function guideList(){
  return block(regions('en', q => `<li><a href="../${q.slug}/">${NAMES.en[q.cc]}</a>${readContent(q.slug, 'id') ? ` <a class="jx-id" href="../${q.slug}/id/" hreflang="id" lang="id" title="${esc(NAMES.id[q.cc])}, bahasa Indonesia">ID</a>` : ''}</li>`));
}
// The Indonesian guide (guides/id/): Indonesian names to the id/ pages, an EN mark for the English one.
function guideListId(){
  return block(regions('id', q => `<li><a href="../../${q.slug}/id/">${NAMES.id[q.cc]}</a>${readContent(q.slug, 'en') ? ` <a class="jx-id" href="../../${q.slug}/" hreflang="en" lang="en" title="${esc(NAMES.en[q.cc])}, in English">EN</a>` : ''}</li>`));
}
// The calculator's card of country pages: on the English page the English ones, on id/ the Indonesian ones.
function calcList(lang){
  return block(regions(lang, q => lang === 'id'
    ? `<li><a href="../${q.slug}/id/">${NAMES.id[q.cc]}</a></li>`
    : `<li><a href="${q.slug}/">${NAMES.en[q.cc]}</a></li>`));
}

// ---- Run
const outputs = [];
for(const p of PAGES){
  for(const lang of ['en', 'id']){
    const html = page(p, lang);
    const both = readContent(p.slug, 'en') && readContent(p.slug, 'id');
    if(html) outputs.push([join(ROOT, TOOL, p.slug, ...(lang === 'id' ? ['id'] : []), 'index.html'), html, `${BASE}${p.slug}/${lang === 'id' ? 'id/' : ''}`,
      both ? { en: `${BASE}${p.slug}/`, id: `${BASE}${p.slug}/id/`, 'x-default': `${BASE}${p.slug}/` } : null]);
  }
}
// The lists, each written between its markers only (the rest of those pages is someone else's).
const LISTS = [
  ['index.html', calcList('en')],
  ['id/index.html', calcList('id')],
  ['guides/index.html', guideList()],
  ['guides/id/index.html', guideListId()],
].map(([rel, list]) => {
  const f = join(ROOT, TOOL, rel);
  if(!existsSync(f)) return null;
  const old = readFileSync(f, 'utf8');
  if(!MARKS.test(old)){ problem(`${TOOL}/${rel}: no jurisdictions markers to write the list between`); return null; }
  return [f, old, old.replace(MARKS, () => list)];
}).filter(Boolean);
// The sitemap: one entry per country page, after the tool's own (entries run by path). The
// calculator's id/ page is not one of them: it is the tool's own Indonesian twin (bake-id.mjs).
const smPath = join(ROOT, 'sitemap.xml');
let sm = readFileSync(smPath, 'utf8');
sm = sm.replace(new RegExp(`\\s*<url>\\s*<loc>${BASE.replace(/[.]/g, '\\.')}(?!guides/|ai/|id/)[a-z0-9-]+/(?:id/)?</loc>[\\s\\S]*?</url>`, 'g'), '');
const entries = outputs.slice().sort((a, b) => a[2] < b[2] ? -1 : 1).map(([, , u, alts]) => `
  <url>
    <loc>${u}</loc>
    <lastmod>${DATE}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>${alts ? xhtmlLinks(alts) : ''}
  </url>`).join('');
// After the tool's AI page and its Indonesian twin (ai/id/), when there is one.
sm = sm.replace(new RegExp(`(<url>\\s*<loc>${BASE.replace(/[.]/g, '\\.')}ai/</loc>[\\s\\S]*?</url>(?:\\s*<url>\\s*<loc>${BASE.replace(/[.]/g, '\\.')}ai/id/</loc>[\\s\\S]*?</url>)?)`), `$1${entries}`);

if(PROBLEMS.length){ console.error(PROBLEMS.map(s => '  ' + s).join('\n')); }
let stale = 0;
for(const [f, html] of outputs){
  const old = existsSync(f) ? readFileSync(f, 'utf8') : '';
  if(old === html) continue;
  stale++;
  if(CHECK){ console.error('out of date: ' + f.slice(ROOT.length + 1)); continue; }
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, html);
}
for(const [f, old, now] of LISTS){
  if(now === old) continue;
  stale++;
  if(CHECK) console.error('out of date (country list): ' + f.slice(ROOT.length + 1)); else writeFileSync(f, now);
}
if(sm !== readFileSync(smPath, 'utf8')){ stale++; if(CHECK) console.error('out of date: sitemap.xml'); else writeFileSync(smPath, sm); }
console.log(`${outputs.length} pages${CHECK ? `, ${stale} out of date` : `, ${stale} written`}${PROBLEMS.length ? `, ${PROBLEMS.length} problems` : ''}.`);
if(CHECK && stale) process.exit(1);
if(PROBLEMS.length) process.exitCode = 1;
