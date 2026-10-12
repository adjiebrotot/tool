// Share as link — builds a dictionary the links are compressed against.
//
// A link carries the reader's scenario as deflated JSON (SharedShare.pack in
// shared.js). On its own a scenario of a few hundred bytes barely compresses:
// deflate has seen none of it before, so every key and every value is spelt
// out. Primed with a dictionary, a run of text that is also in the dictionary
// is written as one back-reference (a length and a distance, 2 to 4 bytes)
// however long the run is, which is where nearly all of a scenario lives:
// the field names, the tools' default values, the preset scenarios, the
// legend labels.
//
// So the dictionary is what the tools save: every page with a Share menu,
// on its defaults and on each Quick Start preset, packed the way Share as
// link packs it. A list of objects that repeat one shape (scenarios, assets)
// keeps its first, since the rest add nothing deflate has not already seen,
// and payloads are added most-uncovered first until the dictionary is full.
//
// A dictionary is frozen once it ships: every link made with it decodes only
// against those exact bytes. So this never rewrites one. To make a better one
// later, build the next letter, add it to DICTS in shared.js, and keep every
// earlier file in place so the links made with it still open.
//
// Run: node _ref/share-dict.mjs <letter>     (writes share-dict-<letter>.txt)
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize, basename } from 'node:path';
import zlib from 'node:zlib';

const { chromium } = pw;
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const LIBS = join(HERE, '.libcache');

const letter = process.argv[2];
if (!/^[a-i]$/.test(letter || '')) { console.error('Usage: node _ref/share-dict.mjs <letter a-i>'); process.exit(2); }
const OUT = join(ROOT, 'share-dict-' + letter + '.txt');
if (existsSync(OUT)) { console.error(basename(OUT) + ' has shipped and is frozen: links made with it decode only against it. Build the next letter.'); process.exit(2); }

// deflate reaches back 32 KB. Past this, a long scenario's own text would
// push the dictionary's far end out of reach.
const MAX = 24 * 1024;

const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
               '.svg':'image/svg+xml', '.png':'image/png', '.txt':'text/plain', '.woff2':'font/woff2' };
const server = createServer((req, res) => {
  const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  let file = join(ROOT, rel);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;

const CDN = ['chart.umd.min.js', 'chartjs-plugin-zoom.min.js', 'hammer.min.js', 'plotly.min.js'];
if (CDN.some(f => !existsSync(join(LIBS, f)))) {
  console.error('The chart libraries are not cached yet: run node _ref/chart-check.mjs once with network access.');
  process.exit(2);
}

// Every page with a Share menu. after() draws the charts the menu reads.
const sim = async page => {
  await page.evaluate(() => document.getElementById('simBtn').click());
  await page.waitForFunction(() => [...document.querySelectorAll('canvas')].some(c => window.Chart.getChart(c)), null, { timeout: 60000 });
};
const PAGES = [
  { url: '/borrowingcapacity/' },
  { url: '/financialfreedom/', after: sim },
  { url: '/financingvscash/' },
  { url: '/pisahvsgabung/' }, { url: '/pisahvsgabung/id/' },
  { url: '/rentvsownhouse/' }, { url: '/rentvsownhouse/id/' },
  { url: '/dcasimulator/', after: sim },
  { url: '/dcasimulator/portfolio/', after: sim },
  { url: '/graphvisualiser/', after: async page => {
    await page.click('#sampleBtn');
    await page.waitForTimeout(800);
    await page.click('#renderBtn');
    await page.waitForFunction(() => { const d = document.getElementById('plotDiv'); return d && d.data && d.data.length; }, null, { timeout: 20000 });
  } },
  { url: '/valuateeverything/' },
  { url: '/rentvsownhouse/sensitivity/', after: async page => {
    await page.waitForSelector('.show-chart[data-si="0"]', { timeout: 20000 });
    await page.click('.show-chart[data-si="0"]');
  } },
  { url: '/rentvsownhouse/sensitivity/id/', after: async page => {
    await page.waitForSelector('.show-chart[data-si="0"]', { timeout: 20000 });
    await page.click('.show-chart[data-si="0"]');
  } },
];

const browser = await chromium.launch();
async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.route('**', async route => {
    const url = route.request().url();
    if (url.startsWith(ORIGIN)) return route.continue();
    const lib = CDN.find(f => url.endsWith('/' + f));
    if (lib) return route.fulfill({ status: 200, contentType: 'text/javascript', body: readFileSync(join(LIBS, lib), 'utf8') });
    if (url.includes('workers.dev')) {
      // A flat year of prices: the scenario is what is saved, not the market.
      const u = new URL(url), results = {};
      const dates = [];
      for (let d = new Date(Date.UTC(2015, 0, 1)); d < new Date(); d.setUTCDate(d.getUTCDate() + 1))
        if (d.getUTCDay() % 6) dates.push(d.toISOString().slice(0, 10));
      const p = dates.map((_, i) => 100 + i * 0.01);
      (u.searchParams.get('tickers') || 'X').split(',').forEach(t => {
        results[t] = { dates, prices: p, opens: p, highs: p, lows: p, source: 'yahoo', kind: 'stock', basis: 'utc' };
      });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results }) });
    }
    const type = route.request().resourceType();
    if (type === 'script') return route.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
    if (type === 'stylesheet') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return route.abort();
  });
  await ctx.addInitScript(() => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (k) { return /-seen$/.test(k) ? '1' : get.call(this, k); };
  });
  return { ctx, page: await ctx.newPage() };
}

// What Share as link packs, for every chart on the page.
const PAYLOADS = `(async () => {
  const out = [];
  for (const c of document.querySelectorAll('.btn-cluster')) {
    if (!c.__share) continue;
    const url = await SharedShare.shareLink(c).catch(() => '');
    const s = /&s=([^&]+)$/.exec(url);
    if (s) out.push(await SharedShare.unpack(decodeURIComponent(s[1])));
  }
  return out;
})()`;

// A list of objects that repeat one shape keeps its first; a table keeps
// its header and two rows.
const trim = v => Array.isArray(v)
  ? (v.length > 1 && v.every(x => x && typeof x === 'object') ? (Array.isArray(v[0]) ? v.slice(0, 3) : [trim(v[0])]) : v.map(trim))
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trim(x)])) : v;

const samples = [], seen = new Set();
for (const spec of PAGES) {
  const { ctx, page } = await newPage();
  await page.goto(ORIGIN + spec.url, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const presets = await page.evaluate(() => [...document.querySelectorAll('.quick-start-btn[data-preset]')].map(b => b.dataset.preset));
  for (const preset of [null, ...presets]) {
    if (preset) { await page.click(`.quick-start-btn[data-preset="${preset}"]`); await page.waitForTimeout(1200); }
    if (spec.after) await spec.after(page).catch(e => console.warn('  ' + spec.url + ' ' + preset + ': ' + e.message));
    await page.waitForTimeout(500);
    let n = 0;
    for (const p of await page.evaluate(PAYLOADS)) {
      const json = JSON.stringify(trim(p));
      if (seen.has(json)) continue;
      seen.add(json); samples.push(json); n++;
    }
    console.log(spec.url.padEnd(34), (preset || 'defaults').padEnd(18), n + ' new');
  }
  await ctx.close();
}
await browser.close();
server.close();

// Most uncovered first: each round adds the payload that the dictionary so
// far leaves most of to spell out, until it is full. What goes in first sits
// nearest the scenario, where a back-reference is cheapest.
const size = (s, dict) => zlib.deflateRawSync(Buffer.from(s), { level: 9, dictionary: dict.length ? dict : Buffer.from(' ') }).length;
let picked = [], dict = Buffer.alloc(0), left = samples.slice();
while (left.length) {
  const next = left.map(s => ({ s, open: size(s, dict) })).sort((a, b) => b.open - a.open)[0].s;
  left = left.filter(s => s !== next);
  if (dict.length + Buffer.byteLength(next) > MAX) continue;
  picked.push(next);
  dict = Buffer.from(picked.join(''));
}
const text = picked.reverse().join('');
writeFileSync(OUT, text);
console.log(`\n${basename(OUT)}: ${Buffer.byteLength(text)} bytes from ${picked.length} of ${samples.length} payloads`);
