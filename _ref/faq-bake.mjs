#!/usr/bin/env node
// Writes the "Questions" card under every "What this assumes" card, and the page's
// FAQPage JSON-LD to match it word for word, from the tool's faq.json.
//
//   node _ref/faq-bake.mjs           # write every page
//   node _ref/faq-bake.mjs --check   # change nothing; fail when a page is stale or a rule is broken
//
// Source: <page dir>/faq.json, { "en": [{ "q": "...", "a": ["paragraph", ...] }], "id": [...] }.
// An optional "title": { "en": "...", "id": "..." } names the card instead of "Questions".
// An /id/ page reads its parent's faq.json, the "id" list. Plain text only: the script
// escapes it. Edit the JSON and re-run, never the HTML between the faq markers.
//
// Why static: the assumptions list is drawn by script from the reader's plan, so a crawler
// that does not run JavaScript sees an empty card. The questions are written into the HTML,
// folded by SharedFold.assumes() (display:none, still in the page), and the FAQPage block
// says exactly what the page shows, as Google asks of FAQ markup.
//
// _ref/bake-id.mjs calls applyFaq() on the /id/ pages it writes, so either order is stable.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://tool.adjiebrotots.com/';
const START = '<!-- faq:start -->';
const END = '<!-- faq:end -->';
const BLOCK_RE = /[ \t]*<!-- faq:start -->[\s\S]*?<!-- faq:end -->\n?/;
const LD_RE = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
const TITLE = { en: 'Questions', id: 'Pertanyaan' };

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Every page with a "What this assumes" card, as a path from the root ending in '/'.
export function faqPages() {
  const out = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      if (name.startsWith('.') || name.startsWith('_') || name === 'node_modules') continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (name === 'index.html' && /class="assumes-card\b/.test(readFileSync(p, 'utf8')))
        out.push(relative(ROOT, dir).split('\\').join('/') + '/');
    }
  })(ROOT);
  return out.sort();
}

// The faq.json and language a page reads: an /id/ page takes its parent's "id" list.
export function sourceFor(page) {
  const isId = /(^|\/)id\/$/.test(page);
  const dir = isId ? page.replace(/id\/$/, '') : page;
  return { file: join(ROOT, dir, 'faq.json'), rel: dir + 'faq.json', lang: isId ? 'id' : 'en' };
}

function load(page) {
  const src = sourceFor(page);
  if (!existsSync(src.file)) return null;
  const json = JSON.parse(readFileSync(src.file, 'utf8'));
  const items = json[src.lang];
  const title = (json.title && json.title[src.lang]) || TITLE[src.lang];
  return items && items.length ? { ...src, items, title } : null;
}

function card(items, title) {
  const rows = items.map((it) =>
    `      <div class="faq-item">\n        <h3>${esc(it.q)}</h3>\n` +
    it.a.map((p) => `        <p>${esc(p)}</p>\n`).join('') +
    `      </div>`).join('\n');
  return `  ${START}\n  <section class="faq-card card" aria-labelledby="faqTitle">\n` +
    `    <h2 id="faqTitle">${esc(title)}</h2>\n    <div class="faq-list">\n${rows}\n    </div>\n  </section>\n  ${END}\n`;
}

function ld(items, lang, page) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    ...(lang === 'id' ? { inLanguage: 'id' } : {}),
    url: SITE + page,
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: { '@type': 'Answer', text: it.a.join('\n\n') },
    })),
  };
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;
}

const isFaqLd = (body) => { try { return JSON.parse(body)['@type'] === 'FAQPage'; } catch { return false; } };

// html of <page> with its Questions card and FAQPage block written. Unchanged without a faq.json.
export function applyFaq(html, page) {
  const f = load(page);
  if (!f) return html;
  const block = card(f.items, f.title);
  if (BLOCK_RE.test(html)) html = html.replace(BLOCK_RE, () => block);
  else {
    const m = html.match(/<section class="assumes-card\b[\s\S]*?<\/section>\n/);
    if (!m) throw new Error(`${page}: no assumes-card section to put the questions under`);
    html = html.replace(m[0], () => m[0] + block);
  }
  const script = ld(f.items, f.lang, page);
  let done = false;
  html = html.replace(LD_RE, (all, body) => {
    if (!isFaqLd(body)) return all;
    if (done) return '';            // one FAQPage a page
    done = true;
    return script;
  });
  if (!done) {
    const blocks = [...html.matchAll(LD_RE)];
    const last = blocks[blocks.length - 1];
    if (last) html = html.slice(0, last.index + last[0].length) + '\n' + script + html.slice(last.index + last[0].length);
    else html = html.replace('</head>', () => script + '\n</head>');
  }
  return html;
}

// The writing rules a faq.json is held to (see the FAQ section of _ref/design-reference.md).
function lint(f) {
  const bad = [];
  if (f.items.length < 3 || f.items.length > 6) bad.push(`${f.items.length} questions (3 to 6)`);
  const seen = new Set();
  for (const it of f.items) {
    const text = it.q + ' ' + it.a.join(' ');
    const words = it.a.join(' ').split(/\s+/).filter(Boolean).length;
    const tag = `"${it.q.slice(0, 50)}"`;
    if (!it.q.trim().endsWith('?')) bad.push(`${tag}: question does not end in "?"`);
    if (words < 30 || words > 110) bad.push(`${tag}: ${words} words (aim 40 to 90)`);
    if (/[—–]/.test(text)) bad.push(`${tag}: em or en dash`);
    if (/https?:\/\/|www\.|adjiebrotots/i.test(text)) bad.push(`${tag}: link or site name`);
    if (/<[a-z/]/i.test(text)) bad.push(`${tag}: markup`);
    if (seen.has(it.q)) bad.push(`${tag}: asked twice`);
    seen.add(it.q);
  }
  return bad;
}

function main() {
  const check = process.argv.includes('--check');
  let fail = 0;
  for (const page of faqPages()) {
    const file = join(ROOT, page, 'index.html');
    const f = load(page);
    if (!f) { console.log(`✗ ${page}: no ${sourceFor(page).rel} (${sourceFor(page).lang})`); fail++; continue; }
    for (const b of lint(f)) { console.log(`✗ ${page} (${f.rel}): ${b}`); fail++; }
    const before = readFileSync(file, 'utf8');
    const after = applyFaq(before, page);
    if (before === after) { console.log(`  ${page}: ${f.items.length} questions, up to date`); continue; }
    if (check) { console.log(`✗ ${page}: stale, run node _ref/faq-bake.mjs`); fail++; continue; }
    writeFileSync(file, after);
    console.log(`  ${page}: ${f.items.length} questions written`);
  }
  if (fail) { console.log(`\n${fail} problem(s)`); process.exit(1); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
