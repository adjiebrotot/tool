#!/usr/bin/env node
// Language pairs (hreflang) across the site: one place that reads them and writes them into
// the sitemap, the way the blog's _includes/alternates.html does for its posts.
//
//   node _ref/hreflang.mjs            check every pair, then write the sitemap's xhtml:link lines
//   node _ref/hreflang.mjs --check    write nothing; fail on a broken pair or a stale sitemap
//
// The pages are the source: each page in a pair names itself and its twin in its <head>
// (<link rel="alternate" hreflang="en|id|x-default">). This script checks that every pair is
// whole (both pages exist, name each other and the same x-default, each page's <html lang>
// matches its own hreflang, and each carries og:locale:alternate) and that both pages are in
// sitemap.xml, then gives each pair's sitemap entries the same xhtml:link lines and takes them
// off any entry whose page has no pair.
//
// Run it after any generator that writes a paired page or the sitemap (bake-id.mjs,
// bake-home-id.mjs, jurisdiction-pages.mjs), or after a hand-made pair (disclaimer/id/).

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://tool.adjiebrotots.com/';
const ORDER = ['en', 'id', 'x-default'];

// The sitemap lines for one pair, in a fixed order (also used by jurisdiction-pages.mjs).
export function xhtmlLinks(alts){
  const keys = Object.keys(alts).sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b));
  return keys.map(k => `\n    <xhtml:link rel="alternate" hreflang="${k}" href="${alts[k]}"/>`).join('');
}

function pagesOnDisk(dir = ROOT, out = []){
  for(const e of readdirSync(dir, { withFileTypes: true })){
    if(e.name.startsWith('.') || e.name.startsWith('_') || e.name === 'node_modules') continue;
    const p = join(dir, e.name);
    if(e.isDirectory()) pagesOnDisk(p, out);
    else if(e.name === 'index.html') out.push(p);
  }
  return out;
}
const urlOf = file => SITE + relative(ROOT, dirname(file)).split(sep).filter(Boolean).map(s => s + '/').join('');

function readPage(file){
  const head = (readFileSync(file, 'utf8').match(/<head>[\s\S]*?<\/head>/) || [''])[0];
  const html = readFileSync(file, 'utf8').slice(0, 300);
  const alts = {};
  for(const m of head.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)) alts[m[1]] = m[2];
  return {
    file, url: urlOf(file), alts,
    lang: (html.match(/<html lang="([^"]+)"/) || [])[1],
    canonical: (head.match(/<link rel="canonical" href="([^"]+)">/) || [])[1],
    localeAlt: /<meta property="og:locale:alternate" content="[^"]+">/.test(head),
  };
}

function main(){
  const CHECK = process.argv.includes('--check');
  const problems = [];
  const pages = pagesOnDisk().map(readPage);
  const byUrl = new Map(pages.map(p => [p.url, p]));
  const paired = pages.filter(p => Object.keys(p.alts).length);
  const sameSet = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

  for(const p of paired){
    const where = relative(ROOT, p.file);
    const own = Object.entries(p.alts).filter(([k, v]) => k !== 'x-default' && v === p.url).map(([k]) => k);
    if(p.canonical !== p.url) problems.push(`${where}: canonical ${p.canonical} is not the page's own address`);
    if(!own.length) problems.push(`${where}: its hreflang links do not name the page itself`);
    else if(own[0] !== p.lang) problems.push(`${where}: <html lang="${p.lang}"> but its own hreflang is "${own[0]}"`);
    if(!p.alts['x-default']) problems.push(`${where}: no hreflang="x-default"`);
    if(Object.keys(p.alts).filter(k => k !== 'x-default').length < 2) problems.push(`${where}: hreflang names only one language`);
    if(!p.localeAlt) problems.push(`${where}: no og:locale:alternate for its twin`);
    for(const [k, v] of Object.entries(p.alts)){
      const twin = byUrl.get(v);
      if(!twin){ problems.push(`${where}: hreflang="${k}" points at ${v}, which is not a page here`); continue; }
      if(!sameSet(twin.alts, p.alts)) problems.push(`${where}: its twin ${relative(ROOT, twin.file)} lists different hreflang links`);
    }
  }

  // The sitemap: each paired page's entry gets the pair's lines; every other entry gets none.
  const smPath = join(ROOT, 'sitemap.xml');
  const sm = readFileSync(smPath, 'utf8');
  const inMap = new Set();
  const next = sm.replace(/<url>\s*<loc>([^<]+)<\/loc>[\s\S]*?<\/url>/g, (block, loc) => {
    inMap.add(loc);
    const bare = block.replace(/\n\s*<xhtml:link [^>]*\/>/g, '');
    const p = byUrl.get(loc);
    if(!p || !Object.keys(p.alts).length) return bare;
    return bare.replace(/\n\s*<\/url>$/, m => xhtmlLinks(p.alts) + m);
  });
  for(const p of paired) if(!inMap.has(p.url)) problems.push(`sitemap.xml: no entry for ${p.url}, which has a language twin`);

  const stale = next !== sm;
  if(problems.length) console.error(problems.map(s => '  ' + s).join('\n'));
  const pairs = paired.length;
  if(CHECK){
    if(stale) console.error('  sitemap.xml: hreflang lines out of date (run node _ref/hreflang.mjs)');
    console.log(`${pairs} paired pages, ${problems.length} problems${stale ? ', sitemap out of date' : ''}.`);
    if(problems.length || stale) process.exit(1);
    return;
  }
  if(stale) writeFileSync(smPath, next);
  console.log(`${pairs} paired pages, ${problems.length} problems, sitemap ${stale ? 'written' : 'unchanged'}.`);
  if(problems.length) process.exitCode = 1;
}

if(process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
