// Stamps each tool page with when it last changed and what it costs, from sitemap.xml:
//   - the page's own WebApplication JSON-LD gets "dateModified" (the page's <lastmod>), an
//     "offers" of 0 if it has none (free is what the Software App rich result asks to see
//     stated), and "screenshot" (its social card, og/<card>.jpg);
//   - the footer's Disclaimer · Privacy · Blog line ends with "Updated <date>" ("Diperbarui"
//     on an Indonesian page), a <time> a reader and a crawler both see.
//   node _ref/updated.mjs            # every page that has a WebApplication block of its own
// Change a tool, bump its <lastmod> in sitemap.xml, run this. _ref/bake-id.mjs runs it on
// the /id/ pages it writes, so they keep their stamp.
import fs from 'fs';
import path from 'path';
import { cardFor } from './og.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SITE = 'https://tool.adjiebrotots.com/';
const MONTHS = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  id: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
};

let lastmods;
function lastmod(url) {
  if (!lastmods) {
    lastmods = {};
    const xml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)) lastmods[m[1]] = m[2];
  }
  return lastmods[url];
}

// html of the page at <path from the root, ending in '/'>, stamped. Unchanged when the page
// has no WebApplication block of its own or no <lastmod>.
export function stamp(html, p) {
  const url = SITE + p;
  const date = lastmod(url);
  if (!date) return html;
  const lang = /<html lang="id"/.test(html) ? 'id' : 'en';
  const shot = `${SITE}og/${cardFor(p)[0]}.jpg`;
  let found = false;
  html = html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (block, body) => {
    let j;
    try { j = JSON.parse(body); } catch { return block; }
    if (!j || j['@type'] !== 'WebApplication' || j.url !== url) return block;
    found = true;
    // Edit the text, not a re-serialised copy, so the block keeps its own layout.
    const ind = (body.match(/\n([ \t]+)"isAccessibleForFree"/) || [, '  '])[1];
    let b = body.replace(/\n[ \t]+"(?:dateModified|screenshot)": "[^"]*",?/g, '');
    const add = [`"dateModified": "${date}",`, `"screenshot": "${shot}",`];
    if (!('offers' in j)) add.push(`"offers": { "@type": "Offer", "price": "0", "priceCurrency": "${lang === 'id' ? 'IDR' : 'USD'}" },`);
    b = b.replace(/(\n[ \t]+"isAccessibleForFree": true,)/, `$1${add.map(a => '\n' + ind + a).join('')}`);
    return `<script type="application/ld+json">${b}</script>`;
  });
  if (!found) return html;
  const [y, m, d] = date.split('-').map(Number);
  const label = `${lang === 'id' ? 'Diperbarui' : 'Updated'} <time datetime="${date}">${d} ${MONTHS[lang][m - 1]} ${y}</time>`;
  html = html.replace(/ · <span class="footer-updated">[^]*?<\/span>/, '');
  html = html.replace(/(<(p|span) class="[^"]*\bfooter-links\b[^"]*">[\s\S]*?)(<\/\2>)/, `$1 · <span class="footer-updated">${label}</span>$3`);
  // A footer drawn by script (Rent vs Own's footer.js) reads the date from its section.
  html = html.replace(/(<section class="page-footer-info" id="siteFooterContent")(?: data-updated="[^"]*")?>/, `$1 data-updated="${date}">`);
  return html;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let n = 0, nofoot = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name.startsWith('_') || e.name === 'node_modules' || e.name === 'embed') continue;
      const f = path.join(d, e.name);
      if (e.isDirectory()) { walk(f); continue; }
      if (e.name !== 'index.html') continue;
      const rel = path.relative(ROOT, d).split(path.sep).join('/');
      const before = fs.readFileSync(f, 'utf8');
      const after = stamp(before, rel ? rel + '/' : '');
      if (after !== before) {
        fs.writeFileSync(f, after); n++;
        if (!/class="footer-updated"|data-updated=/.test(after)) nofoot.push(rel);
      }
    }
  })(ROOT);
  console.log(`stamped ${n} pages`);
  if (nofoot.length) console.log('no footer-links line to date:', nofoot.join(', '));
}
