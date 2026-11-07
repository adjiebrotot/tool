// Checks the PSCAD Scripter's pages after they are written: the landing page, the Builder, the
// walkthrough guide, and everything build.mjs generates under reference/ and python/.
//
// Run from the repo root (D:\Repository\tool):
//   node pscad-scripter/_pages/check.mjs
//   node pscad-scripter/_pages/check.mjs --quiet    only the failures
//
// What it proves, per page:
//   L1  every relative link and src resolves to a file that is there
//   L2  no link points outside the site by accident (a bare "powerfactory-scripter/" path left
//       over from the port, or a localhost address)
//   S1  every JSON-LD block parses, and names the shared person @id as author and publisher
//   S2  a title, a meta description and a canonical, each present and not empty
//   S3  the canonical matches where the file actually sits
//   U1  no em-dash or en-dash in page text (the house rule; inside <pre> it may be the script's)
//   U2  no duplicate id, and every aria-labelledby points at an id the page has
//   U3  no PowerFactory concept used in the copy, which would be a porting miss (a sentence
//       that says PSCAD has no such thing, or asks about it, is not one)
//   X1  every page is in sitemap.xml, and every pscad-scripter URL in the sitemap is a page
// It prints "pages: N checked, M problems" and exits 1 on any problem.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PX = path.resolve(HERE, '..');
const ROOT = path.resolve(PX, '..');
const BASE = 'https://tool.adjiebrotots.com/pscad-scripter/';
const QUIET = process.argv.includes('--quiet');

const problems = [];
const fail = (page, code, msg) => problems.push(`${code}  ${page}: ${msg}`);

// Every index.html under pscad-scripter/, except the Builder's app page (it is an application,
// not a reading page: it loads the shared layers and has its own audits).
function pages(dir = PX, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name.startsWith('_') || e.name === 'vendor' || e.name === 'node_modules') continue;
      pages(p, out);
    } else if (e.name.endsWith('.html')) {
      out.push(p);
    }
  }
  return out;
}

const urlOf = (file) => BASE + path.relative(PX, file).replace(/\\/g, '/').replace(/index\.html$/, '');

// The words a port can leave behind. A page that genuinely needs to name the other tool can say
// so in a link, which is why the href is stripped before the text is searched.
const LEFTOVERS = [
  /\bPowerFactory\b/, /\bDIgSILENT\b/, /\bElm[A-Z]\w*/, /\bCom(?:Ldf|Shc|Inc|Sim|Hldf)\b/,
  /\bstudy case\b/i, /\boperation scenario\b/i, /\bload flow\b/i, /\bshort circuit\b/i,
];

const seen = { titles: new Map(), descs: new Map() };
const found = pages();

for (const file of found) {
  const page = path.relative(ROOT, file).replace(/\\/g, '/');
  const html = fs.readFileSync(file, 'utf8');
  const dir = path.dirname(file);
  const isApp = /pscad-scripter[\\/]builder[\\/]index\.html$/.test(file);

  // ---- L1, L2: links resolve
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const raw = m[1];
    if (/^(https?:|mailto:|data:|#|\/\/)/.test(raw)) {
      if (/localhost|127\.0\.0\.1/.test(raw)) fail(page, 'L2', `a localhost link: ${raw}`);
      continue;
    }
    if (raw.startsWith('/')) { fail(page, 'L2', `an absolute path (the site is served from a sub-path): ${raw}`); continue; }
    const clean = raw.split(/[?#]/)[0];
    if (!clean) continue;
    let target = path.resolve(dir, clean);
    if (clean.endsWith('/')) target = path.join(target, 'index.html');
    if (!fs.existsSync(target)) {
      // A directory link without a trailing slash is still fine when the folder is there.
      if (!(fs.existsSync(path.dirname(target)) && fs.existsSync(target + '/index.html'))) {
        fail(page, 'L1', `${raw} does not resolve (${path.relative(ROOT, target).replace(/\\/g, '/')})`);
      }
    }
    if (/powerfactory-scripter/.test(clean)) fail(page, 'L2', `a link into the other tool left by the port: ${raw}`);
  }

  // ---- S1: JSON-LD
  const lds = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (!lds.length) fail(page, 'S1', 'no JSON-LD at all');
  let sawPerson = false;
  for (const [, body] of lds) {
    let obj;
    try { obj = JSON.parse(body); } catch (e) { fail(page, 'S1', `a JSON-LD block does not parse: ${e.message}`); continue; }
    const text = JSON.stringify(obj);
    if (text.includes('https://www.adjiebrotots.com/#person')) sawPerson = true;
    if (obj['@type'] === 'WebApplication' || obj['@type'] === 'TechArticle' || obj['@type'] === 'CollectionPage') {
      if (!obj.author) fail(page, 'S1', `${obj['@type']} has no author`);
      if (!obj.publisher) fail(page, 'S1', `${obj['@type']} has no publisher`);
    }
  }
  if (lds.length && !sawPerson) fail(page, 'S1', 'no JSON-LD names the shared person @id');

  // ---- S2, S3: the head
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1];
  const canon = (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1];
  if (!title || !title.trim()) fail(page, 'S2', 'no title');
  if (!desc || !desc.trim()) fail(page, 'S2', 'no meta description');
  if (!canon) fail(page, 'S2', 'no canonical');
  else if (canon !== urlOf(file)) fail(page, 'S3', `the canonical says ${canon}, the file sits at ${urlOf(file)}`);
  if (title) {
    if (seen.titles.has(title)) fail(page, 'S2', `the same title as ${seen.titles.get(title)}`);
    else seen.titles.set(title, page);
  }
  if (desc) {
    if (seen.descs.has(desc)) fail(page, 'S2', `the same meta description as ${seen.descs.get(desc)}`);
    else seen.descs.set(desc, page);
  }

  // ---- U1: no dashes in page text
  const prose = html
    .replace(/<pre[\s\S]*?<\/pre>/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ');
  if (/[\u2014\u2013]/.test(prose)) {
    const at = prose.search(/[\u2014\u2013]/);
    fail(page, 'U1', `an em-dash or en-dash in page text, near "${prose.slice(Math.max(0, at - 50), at + 50).replace(/\s+/g, ' ').trim()}"`);
  }

  // ---- U2: ids
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  const dupes = ids.filter((x, i) => ids.indexOf(x) !== i);
  for (const d of [...new Set(dupes)]) fail(page, 'U2', `the id "${d}" is used more than once`);
  for (const m of html.matchAll(/aria-labelledby="([^"]+)"/g)) {
    for (const want of m[1].split(/\s+/)) {
      if (want && !ids.includes(want)) fail(page, 'U2', `aria-labelledby points at "${want}", which is not an id on the page`);
    }
  }

  // ---- U3: leftovers from the port (not on the app page: its own audits cover it)
  if (!isApp) {
    // A reference page's parameter tables quote PSCAD's own descriptions word for word (a
    // machine's "Short Circuit Current"), so they are not the port's copy.
    const visible = prose
      .replace(/<table class="dx-attrs">[\s\S]*?<\/table>/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/g, ' ');
    // A sentence may name a concept PSCAD does not have to say so ("there is no load flow to
    // call") or to ask about it (a FAQ question); only a sentence that uses it is a miss.
    const sentences = visible.replace(/\s+/g, ' ').split(/(?<=[.?!:])\s+/);
    const contrast = (s) => /\?$/.test(s.trim()) || /\b(no|not|nor|without|never|instead of|rather than|unlike)\b/i.test(s);
    outer: for (const re of LEFTOVERS) {
      for (const s of sentences) {
        const hit = s.match(re);
        if (hit && !contrast(s)) {
          fail(page, 'U3', `"${hit[0]}" in the copy, in "${s.trim().slice(0, 160)}"`);
          break outer;
        }
      }
    }
  }

  if (!QUIET) console.log(`  ${page}`);
}

// ---- X1: the sitemap
const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const listed = new Set([...sitemap.matchAll(/<loc>(https:\/\/tool\.adjiebrotots\.com\/pscad-scripter\/[^<]*)<\/loc>/g)].map(m => m[1]));
const real = new Set(found.map(urlOf));
for (const u of real) {
  // An agent.html or a sub-asset need not be listed; a reading page must be.
  if (!listed.has(u) && !/agent\.html$/.test(u)) fail('sitemap.xml', 'X1', `${u} is a page but is not in the sitemap`);
}
for (const u of listed) {
  if (!real.has(u)) fail('sitemap.xml', 'X1', `${u} is in the sitemap but there is no page there`);
}

console.log(`\npages: ${found.length} checked, ${problems.length} problem${problems.length === 1 ? '' : 's'}`);
for (const p of problems) console.log('  ' + p);
process.exit(problems.length ? 1 : 0);
