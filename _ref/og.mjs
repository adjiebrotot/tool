// Draws the social preview images (1200x630) that og:image and twitter:image point at:
// one per tool, from the tool itself as it opens, and one for the home page.
//   python3 -m http.server 8412 &        # from the repository root
//   node _ref/og.mjs                     # writes og/<name>.jpg for every entry in CARDS
//   node _ref/og.mjs borrowingcapacity   # only the cards whose name starts with that
// Pages without a card of their own (guides, the PowerFactory reference, sub-pages) use their
// tool's card: `node _ref/og.mjs --tags` writes the og:image / twitter tags into every page.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = createRequire('/opt/node22/lib/node_modules/')('playwright'); }

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SITE = 'https://tool.adjiebrotots.com/';
const BASE = process.env.BASE || 'http://localhost:8412';

// [card name, the page it is drawn from]. A page is shown with the card whose page is its
// nearest ancestor (or itself), so a new tool needs one line here.
export const CARDS = [
  ['home', ''],
  ['borrowingcapacity', 'borrowingcapacity/'],
  ['canvasbuilder', 'canvasbuilder/'],
  ['capacity-expansion-planner', 'capacity-expansion-planner/'],
  ['costofliving-comparator', 'costofliving-comparator/'],
  ['costofliving-comparator-map', 'costofliving-comparator/map/'],
  ['dcasimulator', 'dcasimulator/'],
  ['dcasimulator-portfolio', 'dcasimulator/portfolio/'],
  ['dcasimulator-ticker', 'dcasimulator/ticker/'],
  ['ed-uc-simulator', 'ed-uc-simulator/'],
  ['eggprice', 'eggprice/'],
  ['financialfreedom', 'financialfreedom/'],
  ['financingvscash', 'financingvscash/'],
  ['financingvscash-loan-types', 'financingvscash/loan-types/'],
  ['graphvisualiser', 'graphvisualiser/'],
  ['jsonvisualiser', 'jsonvisualiser/'],
  ['loadflow-simulator', 'loadflow-simulator/'],
  ['mdtopdf', 'mdtopdf/'],
  ['pisahvsgabung', 'pisahvsgabung/'],
  ['pisahvsgabung-id', 'pisahvsgabung/id/'],
  ['powerfactory-scripter', 'powerfactory-scripter/'],
  ['powerfactory-scripter-builder', 'powerfactory-scripter/builder/'],
  ['randompicker', 'randompicker/'],
  ['rentvsownhouse', 'rentvsownhouse/'],
  ['rentvsownhouse-id', 'rentvsownhouse/id/'],
  ['rentvsownhouse-sensitivity', 'rentvsownhouse/sensitivity/'],
  ['rentvsownhouse-sensitivity-id', 'rentvsownhouse/sensitivity/id/'],
  ['sankeycreator', 'sankeycreator/'],
  ['valuateeverything', 'valuateeverything/'],
  ['videotogif', 'videotogif/'],
  ['wemconstraint-checker', 'wemconstraint-checker/'],
  ['worldclock', 'worldclock/'],
];

// The card a page (path from the site root, ending in '/') is shown with.
export function cardFor(p) {
  let best = CARDS[0];
  for (const c of CARDS) if (p.startsWith(c[1]) && c[1].length >= best[1].length) best = c;
  return best;
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The first sentence of the description, or as much as reads well on the card.
function tagline(d) {
  const first = (d.match(/^.*?[.!?](\s|$)/) || [d])[0].trim();
  return first.length > 40 ? first : d;
}

async function draw(only) {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'light', reducedMotion: 'reduce', timezoneId: 'Australia/Perth', locale: 'en-AU' });
  const shot = await ctx.newPage();
  const card = await browser.newPage({ viewport: { width: 1200, height: 630 }, colorScheme: 'light' });
  fs.mkdirSync(path.join(ROOT, 'og'), { recursive: true });
  for (const [name, page] of CARDS) {
    if (only && !name.startsWith(only)) continue;
    await shot.goto(`${BASE}/${page}`, { waitUntil: 'load' });
    await shot.addStyleTag({ content: '.pf-tour-backdrop,.pf-tour-spotlight,.pf-tour-tooltip,#abtConsent,.abt-consent,#globalTooltip{display:none!important} *{transition:none!important;animation:none!important}' });
    await shot.waitForTimeout(2500);
    const info = await shot.evaluate(() => {
      const h1 = document.querySelector('h1');
      const glyph = document.querySelector('h1 svg') || document.querySelector('.brand-icon svg');
      const meta = n => (document.querySelector(`meta[property="${n}"]`) || document.querySelector(`meta[name="${n}"]`) || {}).content || '';
      return {
        title: (h1 ? h1.textContent : meta('og:title')).replace(/\s+/g, ' ').trim() || meta('og:title'),
        desc: meta('og:description') || meta('description'),
        glyph: glyph ? glyph.outerHTML.replace(/stroke="#fff"/g, 'stroke="var(--accent)"') : '',
        lang: document.documentElement.lang || 'en',
      };
    });
    const png = (await shot.screenshot({ type: 'png' })).toString('base64');
    const home = name === 'home';
    await card.goto(`${BASE}/404.html`);
    await card.setContent(`<!DOCTYPE html><html lang="${esc(info.lang)}"><head>
<link rel="stylesheet" href="${BASE}/fonts.css"><link rel="stylesheet" href="${BASE}/light.css">
<style>
  html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
  body { background: var(--bg); color: var(--text); font-family: 'DM Sans', system-ui, sans-serif; position: relative; }
  .txt { position: absolute; left: 64px; top: 64px; width: 470px; height: 502px; display: flex; flex-direction: column; }
  .glyph svg { width: 76px; height: 76px; margin: 0 0 26px; vertical-align: 0; }
  h1 { font-size: ${info.title.length > 26 ? 50 : 60}px; line-height: 1.02; letter-spacing: -.035em; margin: 0 0 20px; font-weight: 800; }
  p { font-size: 25px; line-height: 1.32; color: var(--muted); margin: 0; display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden; }
  .brand { margin-top: auto; display: flex; align-items: center; gap: 14px; font-size: 23px; font-weight: 700; }
  .brand img { width: 44px; height: 44px; }
  .brand span { color: var(--muted); font-weight: 500; }
  .shot { position: absolute; left: 580px; top: 64px; width: 720px; height: 450px; border: 2px solid var(--ink-line); border-radius: 18px; box-shadow: 6px 6px 0 var(--ink-line); overflow: hidden; background: var(--panel); }
  .shot img { width: 100%; display: block; }
</style></head><body class="light">
  <div class="txt">
    ${home ? "" : `<div class="glyph">${info.glyph}</div>`}
    <h1>${esc(home ? 'Adjie Brotools' : info.title)}</h1>
    <p>${esc(home ? 'Free calculators and tools for money, tax, property and power system engineering. Everything runs in your browser.' : tagline(info.desc))}</p>
    <div class="brand"><img src="${BASE}/logos/logo.svg" alt="">Adjie Brotools <span>tool.adjiebrotots.com</span></div>
  </div>
  <div class="shot"><img src="data:image/png;base64,${png}"></div>
</body></html>`, { waitUntil: 'load' });
    await card.evaluate(() => document.fonts.ready);
    await card.screenshot({ path: path.join(ROOT, 'og', `${name}.jpg`), type: 'jpeg', quality: 86 });
    console.log('wrote og/' + name + '.jpg', '·', info.title);
  }
  await browser.close();
}

// Every published page: its og:image is its card, with the size, an alt and the large
// Twitter card. Pages that are moved stubs (noindex) are left alone.
function tags() {
  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name.startsWith('_') || e.name === 'node_modules' || e.name === 'embed' || e.name === 'audit') continue;
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.name === 'index.html') files.push(f);
    }
  })(ROOT);
  let n = 0;
  for (const f of files) {
    let h = fs.readFileSync(f, 'utf8');
    if (/<meta name="robots" content="noindex/.test(h) || !/<meta property="og:title"/.test(h)) continue;
    const rel = path.relative(ROOT, path.dirname(f)).split(path.sep).join('/');
    const p = rel ? rel + '/' : '';
    const [name] = cardFor(p);
    const [, cardPage] = cardFor(p);
    const cardHtml = fs.readFileSync(path.join(ROOT, cardPage, 'index.html'), 'utf8');
    const title = name === 'home' ? 'Adjie Brotools' : (cardHtml.match(/<meta property="og:title" content="([^"]*)"/) || [, 'Adjie Brotools'])[1].replace(/&(?![a-z0-9#]+;)/gi, '&amp;');
    const img = `${SITE}og/${name}.jpg`;
    const indent = (h.match(/\n([ \t]*)<meta property="og:title"/) || [, ''])[1];
    const og = [`<meta property="og:image" content="${img}">`, '<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">', `<meta property="og:image:alt" content="${title}, ${/<html lang="id"/.test(h) ? 'tool gratis di' : 'a free tool on'} Adjie Brotools">`];
    const before = h;
    h = h.replace(/[ \t]*<meta property="og:image(?::[a-z]+)?" content="[^"]*">\n/g, '');
    h = h.replace(/[ \t]*<meta name="twitter:image(?::alt)?" content="[^"]*">\n/g, '');
    h = h.replace(/(<meta property="og:site_name" content="[^"]*">\n|<meta property="og:url" content="[^"]*">\n)(?![\s\S]*<meta property="og:site_name")/, m => m + og.map(t => indent + t).join('\n') + '\n');
    h = h.replace(/<meta name="twitter:card" content="summary">/, '<meta name="twitter:card" content="summary_large_image">');
    h = h.replace(/([ \t]*)(<meta name="twitter:description" content="[^"]*">\n)/, (m, ind, t) => ind + t + ind + `<meta name="twitter:image" content="${img}">\n`);
    if (h !== before) { fs.writeFileSync(f, h); n++; }
  }
  console.log(`tagged ${n} of ${files.length} pages`);
}

const arg = process.argv[2];
if (import.meta.url === `file://${process.argv[1]}`) {
  if (arg === '--tags') tags(); else await draw(arg);
}
