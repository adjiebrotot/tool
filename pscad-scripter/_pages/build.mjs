// Writes the PSCAD Scripter reading pages: the component reference (reference/) and the Python
// study guides (python/). Plain static HTML, one small stylesheet (../docs.css), no framework
// and no chart library: a page is fast because there is nothing to load.
//
// Run from the repo root (D:\Repository\tool):
//   node pscad-scripter/_pages/build.mjs
// It reads ../reference/components.json (the Master Library, read out of a running PSCAD by
// _audit/reference/build_reference.py), definitions.mjs (the curated layer) and tasks/*.mjs
// (the study guides), and prints the URLs it wrote, for sitemap.xml. This folder starts with
// "_" so the site does not publish it.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadAll, defnPages, indexPage } from './reference.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PX = path.resolve(HERE, '..');

function write(file, html) {
  const f = path.join(PX, file);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  // An em-dash in page text is a house-rule breach; inside a <pre> it may be the script's own.
  if (/[\u2014\u2013]/.test(html.replace(/<pre>[\s\S]*?<\/pre>/g, ''))) {
    throw new Error(`${file}: an em-dash or en-dash in page text`);
  }
  fs.writeFileSync(f, html);
  return html.length;
}

const all = loadAll(PX);
const { pages, order } = defnPages(all);
const out = [indexPage(all, order), ...pages];

// The study guides, when they are there.
const TASKS = path.join(HERE, 'tasks');
if (fs.existsSync(TASKS)) {
  const { taskPages } = await import(pathToFileURL(path.join(HERE, 'tasks.mjs')).href);
  out.push(...(await taskPages(all)));
}

let bytes = 0, biggest = ['', 0];
for (const p of out) {
  for (const x of p.extra || []) {
    fs.mkdirSync(path.dirname(path.join(PX, x.file)), { recursive: true });
    fs.writeFileSync(path.join(PX, x.file), x.content);
  }
  const n = write(p.file, p.html);
  bytes += n;
  if (n > biggest[1]) biggest = [p.file, n];
}
console.log(`wrote ${out.length} pages, ${(bytes / 1024).toFixed(0)} kB in all; biggest ${biggest[0]} ${(biggest[1] / 1024).toFixed(0)} kB`);
if (process.argv.includes('--urls')) for (const p of out) console.log('https://tool.adjiebrotots.com/pscad-scripter/' + p.url);

// --sitemap: put this generator's pages in ../../sitemap.xml (after the tool's other pages, by
// path), replacing the ones it put there before, so a new definition or guide is listed by a
// rebuild.
if (process.argv.includes('--sitemap')) {
  const BASE = 'https://tool.adjiebrotots.com/pscad-scripter/';
  const file = path.join(PX, '..', 'sitemap.xml');
  const xml = fs.readFileSync(file, 'utf8');
  const blocks = xml.split(/(?=  <url>)/);
  const mine = (b) => /<loc>https:\/\/tool\.adjiebrotots\.com\/pscad-scripter\/(python|reference)\//.test(b);
  const kept = blocks.filter(b => !mine(b));
  const last = kept.map(b => /<loc>https:\/\/tool\.adjiebrotots\.com\/pscad-scripter\//.test(b)).lastIndexOf(true);
  if (last < 0) throw new Error('sitemap.xml has no pscad-scripter entry to follow; add the tool\'s own pages first');
  const today = new Date().toISOString().slice(0, 10);
  const prio = (u) => (u === 'python/' ? '0.8' : u.startsWith('python/') || u === 'reference/' ? '0.7' : '0.5');
  const nl = xml.includes('\r\n') ? '\r\n' : '\n';   // the file's own line ends (a Windows checkout has CRLF)
  const entries = out.map(p => p.url).sort().map(u => ['  <url>', `    <loc>${BASE}${u}</loc>`, `    <lastmod>${today}</lastmod>`,
    '    <changefreq>monthly</changefreq>', `    <priority>${prio(u)}</priority>`, '  </url>', ''].join(nl));
  // The last kept tool entry may carry the closing </urlset>: insert right after its </url>.
  const lb = kept[last];
  const cut = lb.indexOf('</url>') + ('</url>' + nl).length;
  kept[last] = lb.slice(0, cut) + entries.join('') + lb.slice(cut);
  fs.writeFileSync(file, kept.join(''));
  console.log(`sitemap.xml: ${entries.length} entries for python/ and reference/`);
}
