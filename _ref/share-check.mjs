// Share menu — site-wide check.
//
// Every chart on the site carries one Share ⌄ menu (SharedShare in shared.js)
// in place of the old ⬇ SVG, ⬇ PNG, ⧉ row, and this drives the real pages in
// headless Chromium to hold it to what it promises:
//
//   1. ONE MENU, THE SAME EVERYWHERE. The toolbar reads Share ⌄ then ⟳, and
//      the menu lists Download as SVG, Download as PNG, Copy to clipboard,
//      Share as link and Embed as HTML in that order, opens under the button
//      on a click or the arrow keys, and closes again on Escape with the
//      focus back on Share. Share as link copies the address the embed's
//      links back point at (L1), its scenario deflated against the frozen
//      dictionary share-dict-a.txt so the link stays short, and a link
//      written before that dictionary still opens (L2).
//   2. AN EXPORT IS THE DESKTOP PICTURE. The PNG, the SVG and the copied image
//      taken on a phone have the very size and proportion a desktop gives, so
//      a chart exported on a phone is not the phone's squat one, and a wide
//      monitor exports that same picture too rather than a wider one.
//   3. AN EMBED IS THE SAME CHART, AND NOTHING ELSE. The code is one iframe
//      of the embed viewer (embed/), one credit line under it, a plain
//      followed link to the tool by its name, which is the backlink (E11),
//      and a one-line listener that lets the frame size itself to what it
//      shows (E14). The link carries the chart written down as data while
//      the tool had it (share-snapshot.js), and the viewer draws it with
//      Chart.js, Plotly or plain SVG and chart-kit.js alone: no tool, no
//      model, no market data in the other site's frame (E10). Inside a page
//      on another site it shows that one chart card and nothing else (E2),
//      draws exactly the data the reader was looking at, in their theme (E3),
//      with zoom still working and the viewer's own saved work untouched
//      (E4), and every view the card offers (data-embed-mode) draws what the
//      tool draws in that view (V1). The line back to the tool is drawn in
//      the frame under the chart, with the site's logo (E8); both links open
//      the whole tool on the scenario the embed shows (E12). The frame has no
//      background of its own (E13), and until it has drawn it says "Loading
//      data from tool.adjiebrotots.com…" rather than showing a blank (E15).
//      Opened as a page of its own, the link is the chart alone (E6). It is
//      checked again at a phone's width.
//   5. AN EMBED COSTS NOTHING. The viewer runs on the tool's own origin, so
//      the market-data Worker's origin lock would let it through, and every
//      viewer on another site would be a paid invocation. It never calls the
//      Worker (E9): the prices a chart draws are in the chart it carries.
//   4. A LINK CAN ONLY CARRY TEXT. Anyone can send one, so every string in a
//      real embed is swapped for markup and a script that would close a
//      quote in a template; the viewer has to draw it as text and run
//      nothing (E7). And a link written to attack the viewer itself, naming
//      a script, a function, a tool kit or a link out of the site, loads and
//      runs none of it (E16).
//
// Every page is moved off its defaults before it is shared, so an embed that
// dropped the scenario would draw the defaults and fail rule 3.
//
// A chart the tool draws itself (an SVG diagram) marks its element
// data-share-chart and keeps data-share-sig set to a signature of what it
// draws: E3 compares that, and E4 wheels the diagram and needs its viewBox to
// move. A page whose cluster carries ⬇ GIF (spec.gif) also has the GIF row in
// its menu (M2), and its GIF must loop and be the desktop PNG's size at 1x on
// a desktop and on a phone alike (X6, X7). Where the GIF row opens a dialog
// first, its Download is pressed as it opens.
//
// SHOT=<dir> saves every embed as it rendered; ONLY=<name> runs one page.
// The libraries are the real ones, cached by chart-check.mjs in
// _ref/.libcache/; run that once with network access first.
//
// Run: node _ref/share-check.mjs
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { dirname, join, extname, normalize, basename } from 'node:path';

const { chromium } = pw;
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const LIBS = join(HERE, '.libcache');
const SITE = 'https://tool.adjiebrotots.com';

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  console.log((ok ? '  PASS  ' : '✗ FAIL  ') + name + (detail ? '  — ' + detail : ''));
  ok ? pass++ : fail++;
};

const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.wasm':'application/wasm',
               '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml',
               '.png':'image/png', '.jpg':'image/jpeg', '.xml':'application/xml',
               '.txt':'text/plain', '.woff2':'font/woff2' };
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

/* Another site, the one the reader pastes the code into. localhost and
   127.0.0.1 are different sites, so the frame gets partitioned storage, as
   it does on a real blog. */
const hosted = new Map();
const host = createServer((req, res) => {
  const html = hosted.get(new URL(req.url, 'http://x').searchParams.get('id'));
  res.writeHead(html ? 200 : 404, { 'content-type': 'text/html' });
  res.end(html || '');
});
await new Promise(r => host.listen(0, '127.0.0.1', r));
const HOST = 'http://localhost:' + host.address().port;

const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/chartjs-plugin-zoom/2.0.1/chartjs-plugin-zoom.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/hammer.js/2.0.8/hammer.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/plotly.js/2.27.1/plotly.min.js',
  // The embed viewer loads the smallest Plotly bundle that has a figure's traces.
  'https://cdnjs.cloudflare.com/ajax/libs/plotly.js/2.27.1/plotly-basic.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/plotly.js/2.27.1/plotly-cartesian.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/plotly.js/2.27.1/plotly-gl3d.min.js',
];
for (const url of CDN) {
  if (!existsSync(join(LIBS, basename(url)))) {
    console.error('The chart libraries are not cached yet: run node _ref/chart-check.mjs once with network access.');
    process.exit(2);
  }
}
const libBody = url => readFileSync(join(LIBS, basename(url)), 'utf8');

// Daily bars from 2010 to today, as Yahoo sends them: float32 values widened
// to doubles, with OHLC, so the prices an embed carries are full size.
function synthSeries(seed = 7) {
  const dates = [], prices = [], opens = [], highs = [], lows = [];
  const today = new Date().toISOString().slice(0, 10), f = Math.fround;
  let p = 100, s = seed, d = new Date(Date.UTC(2010, 0, 1));
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  while (true) {
    d.setUTCDate(d.getUTCDate() + 1);
    const iso = d.toISOString().slice(0, 10), dow = d.getUTCDay();
    if (iso > today) break;
    if (dow === 0 || dow === 6) continue;
    const o = p * (1 + (rnd() - 0.5) * 0.01);
    p = Math.max(1, p * (1 + 0.0004 + (rnd() - 0.5) * 0.02));
    dates.push(iso); prices.push(f(p)); opens.push(f(o));
    highs.push(f(Math.max(o, p) * (1 + rnd() * 0.008))); lows.push(f(Math.min(o, p) * (1 - rnd() * 0.008)));
  }
  return { dates, prices, opens, highs, lows };
}
const DEMO_CSV = join(LIBS, 'share-check-demo.csv');
{
  const rows = ['x,series_a,series_b'];
  let a = 10, b = 5, s = 3;
  for (let i = 0; i < 80; i++) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const r = s / 2147483648 - 0.5;
    a *= 1 + 0.015 + r * 0.03; b *= 1 + 0.008 + r * 0.02;
    rows.push(`${i},${a.toFixed(3)},${b.toFixed(3)}`);
  }
  writeFileSync(DEMO_CSV, rows.join('\n'));
}

const browser = await chromium.launch();

async function newPage(viewport, { returning = true } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, acceptDownloads: true });
  // The control card opens folded (SharedCtrl); these checks drive its fields.
  await ctx.addInitScript(() => { try { localStorage.setItem('abt:ctrl:' + location.pathname.replace(/index\.html?$/, ''), '1'); } catch (e) {} });
  let worker = 0;
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
  await ctx.route('**', async route => {
    const url = route.request().url();
    if (url.startsWith(ORIGIN) || url.startsWith(HOST)) return route.continue();
    // Finance vs Cash fetches Plotly from its own CDN only when the 3D view opens.
    const lib = CDN.find(c => url.startsWith(c.split('?')[0]) || url.endsWith(basename(c))) ||
                (/\/plotly[-.\d]*\.min\.js$/.test(url) ? CDN[3] : null);
    if (lib) return route.fulfill({ status: 200, contentType: 'text/javascript', body: libBody(lib) });
    if (url.includes('yfinance') || url.includes('workers.dev')) {
      const tickers = (new URL(url).searchParams.get('tickers') || 'TEST').split(',');
      const results = {};
      worker++;
      const u = new URL(url), start = u.searchParams.get('start') || '', end = u.searchParams.get('end') || '9';
      tickers.forEach(t => {
        const s = synthSeries(7 + [...t].reduce((a, c) => a + c.charCodeAt(0), 0) * 13);
        const keep = s.dates.map((d, i) => d >= start && d <= end ? i : -1).filter(i => i >= 0);
        const pick = a => keep.map(i => a[i]);
        results[t] = { dates: pick(s.dates), prices: pick(s.prices), opens: pick(s.opens), highs: pick(s.highs),
                       lows: pick(s.lows), source: 'yahoo', kind: 'stock', basis: 'utc' };
      });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results }) });
    }
    const type = route.request().resourceType();
    if (type === 'script') return route.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
    if (type === 'stylesheet') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return route.abort();
  });
  // The reader is a returning visitor (no tour over the page); the embed's
  // viewer is a first-time one, whom the tour would greet if embed mode let it.
  if (returning) await ctx.addInitScript(() => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (k) { return /-seen$/.test(k) ? '1' : get.call(this, k); };
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  return { ctx, page, errors, worker: () => worker };
}

/* ── In-page probes ── */
// The chart's card and its Share toggle, found from the chart's key.
const FIND = `(key) => {
  const el = key.charAt(0) === '.' ? document.querySelector(key) : document.getElementById(key);
  const card = el && el.closest('.chart-modal, .detail-subsection, .chart-card, .chart-panel, .card');
  const cluster = card && [...card.querySelectorAll('.btn-cluster')].find(c => c.querySelector('.share-menu'));
  return { el, card, cluster, toggle: cluster && cluster.querySelector('.share-toggle') };
}`;
const toggleOf = (page, key) => page.evaluateHandle(`(${FIND})(${JSON.stringify(key)}).toggle`);

// Exactly what the chart is drawing, so two pages can be compared.
const DRAWN = `(key) => {
  const el = (${FIND})(key).el;
  if (!el) return null;
  const r = v => typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v;
  const ch = window.Chart && window.Chart.getChart(el);
  if (ch) return JSON.stringify({
    labels: (ch.data.labels || []).map(String),
    sets: ch.data.datasets.map((d, i) => ({ label: d.label, shown: ch.isDatasetVisible(i),
      data: (d.data || []).map(v => v && typeof v === 'object' ? [r(v.x), r(v.y), r(v.o), r(v.c)] : r(v)) })),
  });
  if (el.data) return JSON.stringify(el.data.map(t => ({ type: t.type, name: t.name, visible: t.visible,
    x: t.x && Array.from(t.x).map(r), y: t.y && Array.from(t.y).map(r),
    z: t.z && Array.from(t.z).map(z => Array.isArray(z) ? z.map(r) : r(z)) })));
  if (el.hasAttribute && el.hasAttribute('data-share-sig')) return el.getAttribute('data-share-sig');
  return null;
}`;

const pngSize = buf => [buf.readUInt32BE(16), buf.readUInt32BE(20)];
function svgSize(text) {
  const tag = (text.match(/<svg\b[^>]*>/) || [''])[0];
  const w = /\swidth="([\d.]+)/.exec(tag), h = /\sheight="([\d.]+)/.exec(tag);
  if (w && h) return [+w[1], +h[1]];
  const vb = /viewBox="[\d.\s-]*?([\d.]+)\s+([\d.]+)"/.exec(tag);
  return vb ? [+vb[1], +vb[2]] : null;
}
const same = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];
// A GIF's screen size, its frames and whether it loops, read block by block.
function gifInfo(buf) {
  const out = { head: buf.slice(0, 6).toString('latin1'), w: buf.readUInt16LE(6), h: buf.readUInt16LE(8), frames: 0, loop: false };
  let i = 13;
  if (buf[10] & 0x80) i += 3 * (1 << ((buf[10] & 7) + 1));
  const subs = () => { while (i < buf.length && buf[i] !== 0) i += buf[i] + 1; i++; };
  while (i < buf.length) {
    const b = buf[i];
    if (b === 0x3B) break;
    if (b === 0x21) {
      if (buf[i + 1] === 0xFF && buf.slice(i + 3, i + 14).toString('latin1') === 'NETSCAPE2.0') out.loop = true;
      i += 2; subs();
    } else if (b === 0x2C) {
      out.frames++;
      const flags = buf[i + 9];
      i += 10;
      if (flags & 0x80) i += 3 * (1 << ((flags & 7) + 1));
      i++; subs();
    } else break;
  }
  return out;
}

async function openMenu(page, key) {
  const t = await toggleOf(page, key);
  // Centred, so the list has room and reaching a row needs no scroll (a
  // scroll closes the menu, as it closes every dropdown on the site).
  await t.evaluate(el => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(80);
  await t.asElement().click();
  await page.waitForSelector('.share-list.is-open', { timeout: 3000 });
}
async function pick(page, key, kind) {
  await openMenu(page, key);
  await page.click(`.share-list.is-open .share-opt[data-kind="${kind}"]`);
}
async function download(page, key, kind) {
  const dl = page.waitForEvent('download', { timeout: 20000 });
  await pick(page, key, kind);
  // A GIF may ask first (the ED/UC Simulator: the diagram, or the hours with
  // charts): its Download takes what it offers, the diagram as it is.
  if (kind === 'gif') await page.locator('.share-embed-overlay.is-open .gif-dlg-go').click({ timeout: 1500 }).catch(() => {});
  return readFileSync(await (await dl).path());
}
async function clipboardSize(page, key) {
  await page.evaluate(() => navigator.clipboard.writeText('-'));
  await pick(page, key, 'copy');
  // waitForFunction does not wait on an async predicate, so poll from here.
  for (let i = 0; i < 75; i++) {
    const got = await page.evaluate(async () => {
      try {
        const it = await navigator.clipboard.read();
        if (!it[0] || !it[0].types.includes('image/png')) return null;
        const bmp = await createImageBitmap(await it[0].getType('image/png'));
        return [bmp.width, bmp.height];
      } catch (e) { return null; }
    });
    if (got) return got;
    await page.waitForTimeout(200);
  }
  throw new Error('nothing reached the clipboard');
}

/* ── The pages, each moved off its defaults before it is shared ── */
// A preset on real tickers, so the scenario draws prices from the Worker.
const dcaPrep = (tab, preset) => async page => {
  await page.click(`.quick-start-btn[data-preset="${preset}"]`);
  await page.waitForTimeout(1500);
  await page.click(`.ctrl-tab[data-tab="${tab}"]`);
};
const PAGES = [
  {
    name: 'borrowingcapacity', url: '/borrowingcapacity/', charts: ['chartCanvas'],
    async prep(page) { await page.click('.quick-start-btn[data-preset="couple"]'); },
  },
  {
    name: 'financialfreedom', url: '/financialfreedom/', charts: ['ffChart', 'ddChart'],
    async prep(page) {
      await page.click('.quick-start-btn[data-preset="legacy"]');
      await page.waitForTimeout(300);
      await page.click('#simBtn');
      await page.waitForFunction(() => !!window.Chart.getChart(document.getElementById('ddChart')));
    },
  },
  {
    name: 'financingvscash', url: '/financingvscash/', charts: ['chartCanvas'],
    async prep(page) {
      await page.click('.quick-start-btn[data-preset="car"]');
      await page.selectOption('#chartMetric', 'netBenefit');
    },
  },
  {
    // Optimise on one setting draws its line on the same card, and the swept
    // range and the objective have to ride in the link.
    name: 'financingvscash (optimise)', url: '/financingvscash/', charts: ['chartCanvas'],
    async prep(page) {
      await page.click('.quick-start-btn[data-preset="car"]');
      await page.click('.ctrl-tab[data-tab="scenarios"]');
      await page.click('.opt-btn[data-opt="downPaymentPct"]');
      await page.click('#optDoneBtn');
      await page.click('#simBtn');
      await page.selectOption('#optMetric', 'totalInterest');
      await page.waitForFunction(() => { const c = window.Chart.getChart(document.getElementById('chartCanvas')); return !!c && /Down Payment/.test(c.options.scales.x.title.text); }, null, { timeout: 20000 });
    },
  },
  {
    name: 'financingvscash (3D)', url: '/financingvscash/', charts: ['optSurface'],
    async prep(page) {
      await page.click('.quick-start-btn[data-preset="house"]');
      await page.click('.ctrl-tab[data-tab="scenarios"]');
      await page.click('.opt-btn[data-opt="term"]');
      await page.click('#optDoneBtn');
      await page.click('.ctrl-tab[data-tab="assume"]');
      await page.click('.opt-btn[data-opt="riskFreeRate"]');
      await page.click('#optDoneBtn');
      await page.click('#simBtn');
      await page.waitForFunction(() => { const d = document.getElementById('optSurface'); return d && d.data && d.data.length; }, null, { timeout: 20000 });
    },
  },
  {
    name: 'pisahvsgabung', url: '/pisahvsgabung/', charts: ['chartCanvas', 'chartCanvas2'],
    async prep(page) { await page.click('.quick-start-btn[data-preset="double"]'); },
  },
  {
    name: 'rentvsownhouse', url: '/rentvsownhouse/', charts: ['chartCanvas'],
    async prep(page) {
      await page.evaluate(() => {
        const el = document.getElementById('downPaymentPct');
        el.value = '35'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await page.click('#graphCash');
    },
  },
  {
    name: 'dcasimulator', url: '/dcasimulator/', charts: ['priceCanvas', 'equityCanvas'], prices: true,
    async prep(page) {
      await dcaPrep('securities', 'stock-etf')(page);
      await page.click('#simBtn');
      await page.waitForFunction(() => !!window.Chart.getChart(document.getElementById('equityCanvas')), null, { timeout: 60000 });
      await page.click('#showDepositedToggle', { force: true }).catch(() => {});
      await page.evaluate(() => { const t = document.getElementById('showDepositedToggle'); t.checked = false; t.dispatchEvent(new Event('change', { bubbles: true })); });
    },
  },
  {
    // Optimise mode: one swept setting draws the sweep as a line in its own
    // card, read here by its Sharpe.
    name: 'dcasimulator (optimise)', url: '/dcasimulator/', charts: ['optCanvas'], prices: true,
    async prep(page) {
      await dcaPrep('securities', 'stock-etf')(page);
      await page.click('.opt-btn[data-opt="dayOfMonth"]');
      await page.fill('#optSteps', '6'); await page.dispatchEvent('#optSteps', 'input');
      await page.click('#optDoneBtn');
      await page.click('#simBtn');
      await page.waitForFunction(() => !document.getElementById('optCard').hidden && !!window.Chart.getChart(document.getElementById('optCanvas')), null, { timeout: 60000 });
      await page.selectOption('#optMetric', 'sharpe');
    },
  },
  {
    // Two swept settings draw a Plotly surface in the same card.
    name: 'dcasimulator (optimise 3D)', url: '/dcasimulator/', charts: ['optSurface'], prices: true,
    async prep(page) {
      await dcaPrep('securities', 'stock-etf')(page);
      await page.click('.opt-btn[data-opt="dayOfMonth"]');
      await page.fill('#optSteps', '5'); await page.dispatchEvent('#optSteps', 'input');
      await page.click('#optDoneBtn');
      await page.click('.opt-btn[data-opt="yearlyIncrease"]');
      await page.fill('#optSteps', '4'); await page.dispatchEvent('#optSteps', 'input');
      await page.click('#optDoneBtn');
      await page.click('#simBtn');
      await page.waitForFunction(() => { const d = document.getElementById('optSurface'); return d && d.data && d.data.length; }, null, { timeout: 60000 });
    },
  },
  {
    name: 'dcasimulator/portfolio', url: '/dcasimulator/portfolio/', charts: ['valueCanvas', 'compCanvas', 'priceCanvas'], prices: true,
    async prep(page) {
      await dcaPrep('portfolios', 'rebal-freq')(page);
      await page.click('#simBtn');
      await page.waitForFunction(() => !!window.Chart.getChart(document.getElementById('compCanvas')), null, { timeout: 60000 });
      await page.click('#compViewToggle .seg-btn[data-cv="percent"]');
    },
  },
  {
    // Optimise mode: one swept setting draws the sweep as a line in the value
    // card, read here by its Sharpe.
    name: 'dcasimulator/portfolio (optimise)', url: '/dcasimulator/portfolio/', charts: ['valueCanvas'], prices: true,
    async prep(page) {
      await dcaPrep('portfolios', 'rebal-freq')(page);
      await page.click('.sub-tab[data-sub="rebal"]');
      await page.click('.opt-btn[data-opt="weight:1"]');
      await page.click('#optDoneBtn');
      await page.click('#simBtn');
      await page.waitForFunction(() => document.getElementById('valueTitle').textContent.startsWith('Optimisation') && !!window.Chart.getChart(document.getElementById('valueCanvas')), null, { timeout: 60000 });
      await page.selectOption('#optMetric', 'sharpe');
    },
  },
  {
    // Two swept settings draw a Plotly surface in the same card.
    name: 'dcasimulator/portfolio (optimise 3D)', url: '/dcasimulator/portfolio/', charts: ['optSurface'], prices: true,
    async prep(page) {
      await dcaPrep('portfolios', 'rebal-freq')(page);
      await page.click('.sub-tab[data-sub="rebal"]');
      await page.click('.opt-btn[data-opt="weight:1"]');
      await page.fill('#optSteps', '5'); await page.dispatchEvent('#optSteps', 'input');
      await page.click('#optDoneBtn');
      await page.click('.opt-btn[data-opt="rebal.buyFee"]');
      await page.fill('#optSteps', '4'); await page.dispatchEvent('#optSteps', 'input');
      await page.click('#optDoneBtn');
      await page.click('#simBtn');
      await page.waitForFunction(() => { const d = document.getElementById('optSurface'); return d && d.data && d.data.length; }, null, { timeout: 60000 });
    },
  },
  {
    name: 'graphvisualiser', url: '/graphvisualiser/', charts: ['plotDiv'],
    async prep(page) {
      await page.setInputFiles('#fileInput', DEMO_CSV);
      await page.waitForTimeout(800);
      await page.evaluate(() => { const y = document.getElementById('axisY'); [...y.options].forEach((o, i) => { o.selected = i === 1 || i === 2; }); });
      await page.evaluate(() => { document.getElementById('chartTitle').value = 'Two series'; });
      await page.click('#renderBtn');
      await page.waitForFunction(() => { const d = document.getElementById('plotDiv'); return d && d.data && d.data.length === 2; }, null, { timeout: 20000 });
    },
  },
  {
    // An SVG diagram with an animated GIF export. The HVDC preset (two islands
    // and a link), its flows animated and the branch loading labelled.
    name: 'loadflow-simulator', url: '/loadflow-simulator/', charts: ['sldStage'], gif: true,
    async prep(page) {
      await page.click('.quick-start-btn[data-preset="hvdc"]');
      await page.waitForFunction(() => /\S/.test(document.getElementById('sldStage').getAttribute('data-share-sig') || ''), null, { timeout: 20000 });
      await page.evaluate(() => {
        for (const [id, v] of [['animP', true], ['animQ', true], ['lb_Line_load', true], ['colourBy', 'loading']]) {
          const el = document.getElementById(id);
          if (el.type === 'checkbox') el.checked = v; else el.value = v;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      await page.waitForTimeout(300);
    },
  },
  {
    // The ED/UC Simulator's diagram: an SVG with a GIF export, like the load
    // flow's. The solar and battery preset, so the diagram shows a storage
    // unit, a unit off and its flows.
    name: 'ed-uc-simulator', url: '/ed-uc-simulator/', charts: ['sldStage'], gif: true,
    async prep(page) {
      await page.click('.quick-start-btn[data-preset="solar"]');
      await page.waitForFunction(() => /\S/.test(document.getElementById('sldStage').getAttribute('data-share-sig') || '') && window.Chart && Chart.getChart('storeCanvas'), null, { timeout: 30000 });
      await page.waitForTimeout(300);
    },
  },
  {
    // Its four Chart.js charts (no GIF): dispatch, prices, commitment, storage.
    // Two areas over three days, with its HVDC link congested, has prices that
    // split; the storage chart needs the solar preset, so that one is opened
    // there.
    name: 'ed-uc-simulator/charts', url: '/ed-uc-simulator/', charts: ['dispCanvas', 'priceCanvas', 'commitCanvas', 'storeCanvas'],
    async prep(page) {
      await page.click('.quick-start-btn[data-preset="solar"]');
      await page.waitForFunction(() => window.Chart && Chart.getChart('storeCanvas') && Chart.getChart('commitCanvas'), null, { timeout: 30000 });
      await page.waitForTimeout(400);
    },
  },
  {
    // The Capacity Expansion Planner's four charts on the coal exit preset, the
    // typical days (a panel under the energy chart, folded until opened)
    // opened on its second decision year (the link carries it).
    name: 'capacity-expansion-planner', url: '/capacity-expansion-planner/', charts: ['capCanvas', 'energyCanvas', 'dayCanvas', 'costCanvas'],
    async prep(page) {
      await page.click('.quick-start-btn[data-preset="coal"]');
      await page.waitForFunction(() => window.__cx && __cx.app.res && __cx.app.res.report.ok && __cx.app.res.report.opts.peak === 4000 && !document.getElementById('runBtn').disabled && Chart.getChart('dayCanvas'), null, { timeout: 60000 });
      await page.evaluate(() => { window.__cx.unfold('day'); window.__cx.setYear(1); });
      await page.waitForTimeout(400);
    },
  },
  {
    name: 'valuateeverything', url: '/valuateeverything/', charts: ['plotDiv'],
    async prep(page) {
      await page.click('.quick-start-btn[data-preset="house"]');
      await page.waitForFunction(() => { const d = document.getElementById('plotDiv'); return d && d.data && d.data.length >= 2; }, null, { timeout: 20000 });
    },
  },
  {
    name: 'rentvsownhouse/sensitivity', url: '/rentvsownhouse/sensitivity/', charts: ['.cm-canvas'],
    async prep(page) {
      await page.waitForSelector('.show-chart[data-si="1"]', { timeout: 20000 });
      await page.click('.show-chart[data-si="1"]');
      await page.click('.cm-met[data-met="cost"]');
      await page.waitForFunction(() => !!window.Chart.getChart(document.querySelector('.cm-canvas')), null, { timeout: 20000 });
    },
  },
  {
    name: 'rentvsownhouse/sensitivity (all scenarios)', url: '/rentvsownhouse/sensitivity/', charts: ['.gc-canvas'],
    async prep(page) {
      await page.click('#compareAllBtn');
      await page.waitForFunction(() => !!window.Chart.getChart(document.querySelector('.gc-canvas')), null, { timeout: 20000 });
      await page.click('.gc-toggle[data-series="rent"]');
      await page.click('.gc-met[data-met="cash"]');
    },
  },
  { name: 'rentvsownhouse/sensitivity/id', url: '/rentvsownhouse/sensitivity/id/', charts: ['.cm-canvas'], lang: 'id',
    async prep(page) {
      await page.waitForSelector('.show-chart[data-si="0"]', { timeout: 20000 });
      await page.click('.show-chart[data-si="0"]');
      await page.click('.cm-met[data-met="cash"]');
      await page.waitForFunction(() => !!window.Chart.getChart(document.querySelector('.cm-canvas')), null, { timeout: 20000 });
    },
  },
  { name: 'pisahvsgabung/id', url: '/pisahvsgabung/id/', charts: ['chartCanvas'], lang: 'id',
    async prep(page) { await page.click('.quick-start-btn[data-preset="single"]'); } },
  { name: 'rentvsownhouse/id', url: '/rentvsownhouse/id/', charts: ['chartCanvas'], lang: 'id',
    async prep(page) { await page.click('#graphCost'); } },
];

/* An embed carries the chart it draws, written down as data: the views the
   card offers, the hover card and the key. Past this, something heavy has
   leaked into it and the code is no longer one a reader can paste. A chart
   of daily prices carries a decade of them. */
const BUDGET = 120 * 1024;
const PRICE_BUDGET = 600 * 1024;
// The credit line and its link back carry the scenario alone.
const CREDIT_BUDGET = 2500;

const WORDS = {
  en: { share: 'Share', rows: ['Download as SVG', 'Download as PNG', 'Copy to clipboard', 'Share as link', 'Embed as HTML'], gif: 'Download as GIF',
        back: 'Try your own scenarios at', copied: '✓ Copied', linkCopied: '✓ Link copied' },
  id: { share: 'Bagikan', rows: ['Unduh sebagai SVG', 'Unduh sebagai PNG', 'Salin ke papan klip', 'Bagikan sebagai tautan', 'Sematkan sebagai HTML'], gif: 'Unduh sebagai GIF',
        back: 'Coba skenario Anda sendiri di', copied: '✓ Tersalin', linkCopied: '✓ Tautan tersalin' },
};

/* The viewer's own probes: the chart it drew, its card, its views. */
const VIEW = `(() => {
  const r = v => typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v;
  const cv = document.querySelector('.card .stage canvas');
  const ch = cv && window.Chart && window.Chart.getChart(cv);
  if (ch) return JSON.stringify({
    labels: (ch.data.labels || []).map(String),
    sets: ch.data.datasets.map((d, i) => ({ label: d.label, shown: ch.isDatasetVisible(i),
      data: (d.data || []).map(v => v && typeof v === 'object' ? [r(v.x), r(v.y), r(v.o), r(v.c)] : r(v)) })),
  });
  const pl = document.querySelector('.card .js-plotly-plot');
  if (pl && pl.data) return JSON.stringify(pl.data.map(t => ({ type: t.type, name: t.name, visible: t.visible,
    x: t.x && Array.from(t.x).map(r), y: t.y && Array.from(t.y).map(r),
    z: t.z && Array.from(t.z).map(z => Array.isArray(z) ? z.map(r) : r(z)) })));
  const svg = document.querySelector('.card svg.diagram');
  return svg ? 'svg|' + [...svg.querySelectorAll('text')].map(t => t.textContent.replace(/\\s+/g, ' ').trim()).join('|') : null;
}) ()`;
// The tool's side of the same comparison: a diagram by the words it draws.
const DRAWN_ANY = `(key) => {
  const el = (${FIND})(key).el;
  if (el && el.hasAttribute('data-share-chart')) { const svg = el.querySelector('svg'); return svg ? 'svg|' + [...svg.querySelectorAll('text')].map(t => t.textContent.replace(/\\s+/g, ' ').trim()).join('|') : null; }
  return (${DRAWN})(key);
}`;
/* The viewer draws values to eight significant figures: two drawings are the
   same when every number agrees to a part in a million (at the 1e-6 the
   probes round to) and everything else matches exactly. */
function sameDrawing(a, b) {
  if (a === b) return true;
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.startsWith('svg|') || b.startsWith('svg|')) return a === b;
  let x, y;
  try { x = JSON.parse(a); y = JSON.parse(b); } catch (e) { return false; }
  const near = (p, q) => {
    if (typeof p === 'number' && typeof q === 'number') return Math.abs(p - q) <= 2e-6 * Math.max(1, Math.abs(p), Math.abs(q));
    if (Array.isArray(p) && Array.isArray(q)) return p.length === q.length && p.every((v, i) => near(v, q[i]));
    if (p && q && typeof p === 'object' && typeof q === 'object') {
      const kp = Object.keys(p), kq = Object.keys(q);
      return kp.length === kq.length && kp.every(k => near(p[k], q[k]));
    }
    return p === q;
  };
  return near(x, y);
}
function hostPage(id, src, vp) {
  hosted.set(id, `<!doctype html><meta charset="utf-8"><body style="margin:0"><iframe src="${src}" width="${vp.width}" height="${vp.height}"></iframe></body>`);
  return HOST + '/?id=' + id;
}
const viewerSrc = src => src.replace(/&amp;/g, '&').replace(SITE, ORIGIN);

/* 4. Every string in the reader's real embed becomes an attack: markup, and
   a quote-closer for a template that builds JS. Drawn in a frame on another
   site, none of it may run or become an element. */
const EVIL = `"><img src=x onerror="window.__pwned=1">';window.__pwned=1;//`;
// A link as the viewer reads it: deflated alone (z), as Embed as HTML writes it.
const ZPACK = `(async o => {
  const bytes = new TextEncoder().encode(JSON.stringify(o));
  const z = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
  let bin = ''; z.forEach(b => { bin += String.fromCharCode(b); });
  return 'z' + btoa(bin).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
})`;
// The words that say what a thing is, rather than what it reads, stay.
const STRUCTURE = new Set(['kind', 'k', 'type', 'by', 'l', 'th', 'n', 'kit']);
async function attack(page, tag, src) {
  const s = decodeURIComponent(/[#&]s=([^&]+)$/.exec(viewerSrc(src))[1]);
  const bad = await page.evaluate(`SharedShare.unpack(${JSON.stringify(s)}).then(p => {
    const keep = new Set(${JSON.stringify([...STRUCTURE])}), evil = ${JSON.stringify(EVIL)};
    const poison = (v, key) => typeof v === 'string' ? (keep.has(key) ? v : evil)
      : Array.isArray(v) ? v.map((x, i) => (i === 0 && typeof x === 'string' && Array.isArray(v[2])) ? x : poison(x, key))
      : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, poison(x, k)])) : v;
    return (${ZPACK})(poison(p));
  })`);
  const E = await newPage({ width: 760, height: 560 }, { returning: false });
  const base = viewerSrc(src).replace(/([#&])s=[^&]+$/, '$1s=' + bad);
  await E.page.goto(hostPage('evil' + hosted.size, base, { width: 760, height: 560 }), { waitUntil: 'load' });
  const frame = await (await E.page.waitForSelector('iframe')).contentFrame();
  await frame.waitForFunction(() => !document.documentElement.classList.contains('wait'), null, { timeout: 30000 }).catch(() => {});
  await E.page.waitForTimeout(600);
  const r = await frame.evaluate(() => ({ ran: !!window.__pwned, imgs: document.querySelectorAll('img[src="x"]').length }));
  check(`${tag} E7 a link whose every string is markup and script draws it as text and runs none of it`,
        !r.ran && !r.imgs, `ran: ${r.ran}, injected elements: ${r.imgs}`);
  await E.ctx.close();
}

/* A link written to attack the viewer itself: a tool kit from outside the
   site, a function by a name nothing registered, a diagram carrying a script,
   an event handler and a link out, a watermark pointing at javascript:. */
async function hostile(page, tag) {
  const bad = await page.evaluate(`(${ZPACK})({
    v: 1, kind: 'svg', l: 'en', th: 'dark', t: 'x', n: 'x', w: 'x', back: 'javascript:window.__pwned=1',
    modes: [], map: {}, pool: [],
    frames: [{ vb: '0 0 100 50', svg: ['svg', { viewBox: '0 0 100 50', onload: 'window.__pwned=1' }, [
      ['script', {}, ['window.__pwned=1']],
      ['foreignObject', {}, [['img', { src: 'x', onerror: 'window.__pwned=1' }, []]]],
      ['a', { href: 'javascript:window.__pwned=1' }, [['text', { x: '10', y: '20' }, ['x']]]],
      ['use', { href: 'https://evil.example/x.svg#a' }, []],
      ['rect', { x: '0', y: '0', width: '10', height: '10', onclick: 'window.__pwned=1', fill: 'url(https://evil.example/x)' }, []],
      ['animate', { attributeName: 'href', values: 'javascript:window.__pwned=1', begin: 'click' }, []],
      ['set', { attributeName: 'onload', to: 'window.__pwned=1' }, []],
    ]] }],
  })`);
  const chartBad = await page.evaluate(`(${ZPACK})({
    v: 1, kind: 'chartjs', l: 'en', th: 'dark', t: 'x', n: 'x', w: 'x', back: 'https://evil.example/', modes: [], map: {}, pool: [],
    frames: [{ type: 'line', labels: ['a'], datasets: [{ label: '<img src=x onerror="window.__pwned=1">', data: [1],
      borderColor: { $k: { n: 'Function', a: ['window.__pwned=1'] } } }],
      options: { plugins: { tooltip: { external: { $k: { n: 'eval' } } } } }, plugins: ['constructor', '__proto__'],
      legend: [{ l: '<img src=x onerror="window.__pwned=1">', sw: { color: 'red" onload="window.__pwned=1', type: 'line' }, ds: [0] }] }],
  })`);
  const E = await newPage({ width: 760, height: 560 }, { returning: false });
  const requests = [];
  E.page.on('request', r => requests.push(r.url()));
  const url = hostPage('hostile' + hosted.size, `${ORIGIN}/embed/#t=c&kit=..%2F..%2Fevil&l=en&s=${chartBad}`, { width: 760, height: 560 });
  await E.page.goto(url, { waitUntil: 'load' });
  await E.page.waitForTimeout(1200);
  const f1 = await (await E.page.waitForSelector('iframe')).contentFrame();
  const r1 = await f1.evaluate(() => ({ ran: !!window.__pwned, imgs: document.querySelectorAll('img').length,
    mark: (document.querySelector('.mark') || {}).href || '' })).catch(e => ({ ran: false, imgs: 0, mark: e.message }));
  await E.page.goto(hostPage('hostile' + hosted.size, `${ORIGIN}/embed/#t=d&l=en&s=${bad}`, { width: 760, height: 560 }), { waitUntil: 'load' });
  await E.page.waitForTimeout(1200);
  const f2 = await (await E.page.waitForSelector('iframe')).contentFrame();
  const r2 = await f2.evaluate(() => ({ ran: !!window.__pwned, bad: document.body.querySelectorAll('script, foreignObject, a[href^="javascript"], [onload], [onclick], set').length,
    use: [...document.querySelectorAll('use')].map(u => u.getAttribute('href')).filter(Boolean), mark: (document.querySelector('.mark') || {}).href || '' }));
  const outside = requests.filter(u => !u.startsWith(ORIGIN) && !u.startsWith(HOST) && !/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com/.test(u));
  const kit = requests.filter(u => /evil/.test(u));
  check(`${tag} E16 a link that names a script, a function, a tool kit or a link out of the site loads and runs none of it`,
        !r1.ran && !r2.ran && !r1.imgs && !r2.bad && !r2.use.length && !kit.length && !outside.length &&
        !/^javascript:|evil/.test(r1.mark) && !/^javascript:/.test(r2.mark),
        `ran ${r1.ran || r2.ran}, elements ${r1.imgs + r2.bad}, use ${r2.use.join(' ')}, fetched ${kit.concat(outside).slice(0, 2).join(' ')}, marks ${r1.mark} ${r2.mark}`);
  await E.ctx.close();
}

/* While the frame loads it says so, in the page's language, rather than
   showing a blank: the viewer's script is held back so the first paint is
   caught. */
async function loading(tag, src) {
  const E = await newPage({ width: 760, height: 560 }, { returning: false });
  let release;
  const held = new Promise(r => { release = r; });
  await E.ctx.route(/\/embed\/embed\.js$/, async route => { await held; route.continue(); });
  await E.page.goto(hostPage('wait' + hosted.size, viewerSrc(src), { width: 760, height: 560 }), { waitUntil: 'domcontentloaded' });
  const frame = await (await E.page.waitForSelector('iframe')).contentFrame();
  await frame.waitForFunction(() => getComputedStyle(document.documentElement, '::before').content !== 'none', null, { timeout: 15000 }).catch(() => {});
  const r = await frame.evaluate(() => ({
    text: getComputedStyle(document.documentElement, '::before').content,
    hidden: !document.body || getComputedStyle(document.body).visibility === 'hidden',
    lang: document.documentElement.lang,
  })).catch(e => ({ text: e.message }));
  release();
  const want = /^id/.test(r.lang || '') ? 'Memuat data dari tool.adjiebrotots.com' : 'Loading data from tool.adjiebrotots.com';
  check(`${tag} E15 while it loads, the frame says "${want}…" and hides the page`,
        (r.text || '').includes(want) && r.hidden, `${r.text}, page ${r.hidden ? 'hidden' : 'showing'}`);
  await E.ctx.close();
}

/* V1: every view the card offers draws in the viewer what the tool draws in
   it. Each choice of each view is picked in the frame and set in the tool
   (the others as the reader left them), and the two drawings compared. */
async function views(page, tag, key, frame) {
  const offered = await frame.evaluate(() => [...document.querySelectorAll('.modes > *')].map(e =>
    e.matches('.seg') ? { kind: 'seg', n: e.children.length } : e.matches('select') ? { kind: 'select', n: e.options.length }
      : e.matches('.range') ? { kind: 'range', n: +e.querySelector('input').max + 1 } : { kind: 'check', n: 2 }));
  if (!offered.length) return;
  const tool = await page.evaluate(`(() => {
    const f = (${FIND})(${JSON.stringify(key)}), extra = f.card.getAttribute('data-share-view');
    // In the order SharedShare reads them: the card, with the boxes it names put first.
    const roots = [f.card];
    if (extra) document.querySelectorAll(extra).forEach(r => { if (!roots.includes(r)) roots.unshift(r); });
    window.__modes = SharedSnapshot.modes(roots);
    return window.__modes.map(m => ({ kind: m.kind, n: m.opts.length, own: m.get() }));
  })()`);
  let bad = [], tried = 0;
  const offeredIdx = tool.map((m, i) => i).filter(i => true);
  for (let mi = 0; mi < Math.min(tool.length, offered.length); mi++) {
    const n = Math.min(tool[mi].n, 4), own = tool[mi].own;
    for (let j = 0; j < n; j++) {
      if (j === own && n > 1) continue;
      await page.evaluate(([mi, j]) => window.__modes[mi].set(j), [mi, j]);
      let want = null;
      for (let t = 0, last = null; t < 60; t++) {
        await page.waitForTimeout(120);
        const d = await page.evaluate(`(${DRAWN_ANY})(${JSON.stringify(key)})`);
        if (d && d === last) { want = d; break; }
        last = d;
      }
      await frame.evaluate(([mi, j]) => {
        const c = document.querySelectorAll('.modes > *')[mi];
        if (c.matches('.seg')) c.children[j].click();
        else if (c.matches('select')) { c.value = String(j); c.dispatchEvent(new Event('change')); }
        else if (c.matches('.range')) { const r = c.querySelector('input'); r.value = String(j); r.dispatchEvent(new Event('input')); }
        else if ((c.getAttribute('aria-pressed') === 'true') !== !!j) c.click();
      }, [mi, j]);
      await frame.waitForTimeout(250);
      const got = await frame.evaluate(VIEW);
      tried++;
      if (!sameDrawing(want, got)) bad.push(`view ${mi + 1} choice ${j + 1}`);
      // Put both back as the reader had them.
      await page.evaluate(([mi, own]) => window.__modes[mi].set(own), [mi, own]);
      await frame.evaluate(([mi, own]) => {
        const c = document.querySelectorAll('.modes > *')[mi];
        if (c.matches('.seg')) c.children[own].click();
        else if (c.matches('select')) { c.value = String(own); c.dispatchEvent(new Event('change')); }
        else if (c.matches('.range')) { const r = c.querySelector('input'); r.value = String(own); r.dispatchEvent(new Event('input')); }
        else if ((c.getAttribute('aria-pressed') === 'true') !== !!own) c.click();
      }, [mi, own]);
      await page.waitForTimeout(400);
    }
  }
  check(`${tag} V1 every view the card offers draws in the frame what the tool draws in it`,
        offered.length === tool.length && !bad.length,
        offered.length !== tool.length ? `${offered.length} offered, the card marks ${tool.length}` : `${tried} choices${bad.length ? '; differ: ' + bad.join(', ') : ''}`);
}

async function reach(spec, viewport) {
  const s = await newPage(viewport);
  await s.page.goto(ORIGIN + spec.url, { waitUntil: 'load' });
  await s.page.waitForTimeout(500);
  if (spec.prep) await spec.prep(s.page);
  await s.page.waitForTimeout(700);
  return s;
}

const ONLY = process.env.ONLY;
const SHOT = process.env.SHOT;
if (SHOT) mkdirSync(SHOT, { recursive: true });

for (const spec of PAGES) {
  if (ONLY && !spec.name.includes(ONLY)) continue;
  console.log('\n── ' + spec.name + ' ──');
  const W = WORDS[spec.lang || 'en'];

  /* ── 1 and 3, on a desktop ── */
  let D;
  try { D = await reach(spec, { width: 1440, height: 1000 }); }
  catch (e) { check(spec.name + ': the page reaches its charts', false, e.message); continue; }
  const { page } = D;
  const desk = {};

  for (const key of spec.charts) {
    const tag = `${spec.name} [${key}]`;
    const row = await page.evaluate(`(() => {
      const f = (${FIND})(${JSON.stringify(key)});
      if (!f.cluster) return null;
      // A card that folds (SharedFold) ends the row with its chevron; it is not part of the toolbar.
      const vis = [...f.cluster.querySelectorAll('button:not(.fold-btn)')].filter(b => b.offsetParent !== null);
      return vis.map(b => (b.textContent || '').replace(/\\s+/g, ' ').trim());
    })()`);
    check(`${tag} M1 the toolbar reads ${W.share} then ⟳`, !!row && row[0] === W.share && row.slice(1).every(l => l === '⟳'),
          row ? row.join(' | ') : 'no Share menu in the card');
    if (!row) continue;

    await openMenu(page, key);
    const menu = await page.evaluate(`(() => {
      const list = document.querySelector('.share-list.is-open'), t = (${FIND})(${JSON.stringify(key)}).toggle;
      const lr = list.getBoundingClientRect(), tr = t.getBoundingClientRect();
      return { rows: [...list.querySelectorAll('.share-opt .combo-main')].map(e => e.textContent.trim()),
               expanded: t.getAttribute('aria-expanded'), focused: document.activeElement && document.activeElement.dataset.kind,
               rightGap: Math.round(tr.right - lr.right), below: Math.round(lr.top - tr.bottom),
               inView: lr.left >= 0 && lr.right <= innerWidth };
    })()`);
    const wantRows = spec.gif ? [...W.rows.slice(0, 2), W.gif, ...W.rows.slice(2)] : W.rows;
    check(`${tag} M2 the menu lists SVG, PNG, ${spec.gif ? 'GIF, ' : ''}copy, link, embed, in that order`, JSON.stringify(menu.rows) === JSON.stringify(wantRows), menu.rows.join(' | '));
    check(`${tag} M3 and opens under Share, flush with its right edge`,
          menu.expanded === 'true' && menu.focused === 'svg' && Math.abs(menu.rightGap) <= 2 && menu.below >= 0 && menu.below <= 8 && menu.inView,
          `gap ${menu.rightGap}px, ${menu.below}px below, first row focused: ${menu.focused}`);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    const shut = await page.evaluate(`(() => { const t = (${FIND})(${JSON.stringify(key)}).toggle;
      return { open: !!document.querySelector('.share-list.is-open'), back: document.activeElement === t }; })()`);
    check(`${tag} M4 Escape closes it and gives the focus back to Share`, !shut.open && shut.back, JSON.stringify(shut));

    const png = await download(page, key, 'png').catch(e => (check(`${tag} X1 PNG`, false, e.message), null));
    const svg = await download(page, key, 'svg').catch(e => (check(`${tag} X1 SVG`, false, e.message), null));
    desk[key] = { png: png && pngSize(png), svg: svg && svgSize(svg.toString('utf8')) };
    check(`${tag} X1 a desktop downloads a PNG and an SVG`, !!desk[key].png && !!desk[key].svg,
          `PNG ${desk[key].png}, SVG ${desk[key].svg}`);
    if (spec.gif) {
      const gif = await download(page, key, 'gif').then(gifInfo, e => ({ err: e.message }));
      desk[key].gif = gif.err ? null : [gif.w, gif.h];
      check(`${tag} X6 the GIF loops, moves, and is the PNG's picture at 1x`,
            !gif.err && gif.head === 'GIF89a' && gif.frames >= 2 && gif.loop && !!desk[key].png &&
            gif.w * 2 === desk[key].png[0] && gif.h * 2 === desk[key].png[1],
            gif.err || `${gif.head} ${gif.w}x${gif.h}, ${gif.frames} frames, loop ${gif.loop}`);
    }

    /* ── 3. the embed ── */
    await pick(page, key, 'embed');
    await page.waitForFunction(() => {
      const d = document.querySelector('.share-embed-overlay.is-open .share-code');
      return d && /^<iframe/.test(d.value);
    }, null, { timeout: 60000 });
    const code = await page.$eval('.share-code', t => t.value);
    const canon = await page.$eval('link[rel="canonical"]', l => l.href);
    const src = (/src="([^"]+)"/.exec(code) || [])[1] || '';
    const height = +((/height="(\d+)"/.exec(code) || [])[1] || 0);
    const [frameCode, creditCode = '', sizeCode = ''] = code.split('\n');
    const origin = canon.replace(/^(https?:\/\/[^/]+).*$/, '$1');
    const budget = spec.prices ? PRICE_BUDGET : BUDGET;
    check(`${tag} E1 the code is one iframe of the embed viewer, its credit line and the script that sizes it`,
          /^<iframe [^\n]*><\/iframe>$/.test(frameCode) && src.startsWith(SITE + '/embed/#t=') && /&amp;s=[jz]/.test(src) &&
          height >= 160 && code.split('\n').length === 3 && frameCode.length <= budget + 400 &&
          creditCode.length <= CREDIT_BUDGET + 400 &&
          /^<script>[^<]*<\/script>$/.test(sizeCode) && sizeCode.includes(`e.origin!=="${origin}"`) && sizeCode.length <= 400,
          `frame ${(frameCode.length / 1024).toFixed(1)} KB (at most ${budget / 1024} KB), credit ${creditCode.length} (at most ${CREDIT_BUDGET + 400}), sizer ${sizeCode.length}, frame ${height}px tall`);
    // The backlink: a plain, visible, followed link on the other site's page,
    // named for the tool rather than for keywords.
    const name = await page.evaluate(() => document.querySelector('meta[property="og:title"]').content.trim());
    const site = await page.evaluate(() => document.querySelector('meta[property="og:site_name"]').content.trim());
    const links = [...creditCode.matchAll(/<a\b[^>]*>/g)].map(m => m[0]);
    const openHref = ((/^<a href="([^"]+)">$/.exec(links[0] || '') || [])[1] || '').replace(/&amp;/g, '&');
    check(`${tag} E11 a credit line under the frame links back to the tool by its name, followed`,
          /^<p style="[^"]*">[^<]*<a href="[^"]+">[^<]+<\/a>[^<]*<\/p>$/.test(creditCode) && links.length === 1 &&
          openHref.startsWith(canon + '#open=' + encodeURIComponent(key) + '&s=') &&
          creditCode.includes(`>${name.replace(/&/g, '&amp;')}</a>`) && creditCode.includes(site) &&
          !/rel=|display:\s*none|visibility|opacity/.test(creditCode),
          creditCode.replace(/<[^>]+>/g, ''));
    await page.keyboard.press('Escape');
    const want = await page.evaluate(`(${DRAWN_ANY})(${JSON.stringify(key)})`);
    // E6: the link opened as a page of its own is the chart alone, as the frame shows it.
    {
      const T6 = await newPage({ width: 1000, height: 700 }, { returning: false });
      await T6.page.goto(viewerSrc(src), { waitUntil: 'load' });
      await T6.page.waitForFunction(() => !document.documentElement.classList.contains('wait'), null, { timeout: 30000 }).catch(() => {});
      const alone = await T6.page.evaluate(VIEW).catch(() => null);
      check(`${tag} E6 opened as a page of its own, the link is the chart alone`,
            sameDrawing(want, alone) && T6.errors.length === 0, T6.errors.slice(0, 2).join(' | ') || (alone ? 'drew something else' : 'drew nothing'));
      await T6.ctx.close();
    }
    // E12: the link back opens the whole tool on the reader's scenario, for a
    // visitor who has none saved, fetching its own prices.
    {
      const O = await newPage({ width: 1440, height: 1000 });
      await O.page.goto(openHref.replace(SITE, ORIGIN), { waitUntil: 'load' });
      const drew = await O.page.waitForFunction(`(() => { const w = ${JSON.stringify(want)}; return (${DRAWN_ANY})(${JSON.stringify(key)}) === w; })()`,
        null, { timeout: 20000 }).then(() => true, () => false);
      const st = await O.page.evaluate(() => ({ embed: document.documentElement.classList.contains('abt-embed'), hash: location.hash }));
      check(`${tag} E12 the link back opens the whole tool on the scenario the embed shows`,
            drew && !st.embed && st.hash === '' && O.errors.length === 0,
            !drew ? 'drew something else' : st.embed ? 'opened in embed mode' : st.hash ? 'kept ' + st.hash.slice(0, 20) : O.errors.slice(0, 2).join(' | '));
      await O.ctx.close();
    }
    // L1: Share as link copies that same address, the tool on the reader's
    // scenario, so E12 holds for it too.
    {
      await page.evaluate(() => navigator.clipboard.writeText('-'));
      await pick(page, key, 'link');
      let got = '-';
      for (let i = 0; i < 50 && got === '-'; i++) {
        await page.waitForTimeout(100);
        got = await page.evaluate(() => navigator.clipboard.readText());
      }
      const label = await page.evaluate(`(${FIND})(${JSON.stringify(key)}).toggle.textContent.trim()`);
      check(`${tag} L1 Share as link copies the link back to the tool on this scenario`,
            got === openHref && /#open=/.test(got) && label === W.linkCopied,
            got === openHref ? 'Share reads ' + label : got.slice(0, 80) + '…');
      // L2: it is deflated against the dictionary wherever that comes out
      // shorter than deflating it alone, and a link written the old way,
      // deflated alone, still opens on the same scenario.
      const L2 = await page.evaluate(async u => {
        const s = decodeURIComponent((/&s=([^&]+)$/.exec(u) || [])[1] || '');
        const p = await SharedShare.unpack(s);
        const bytes = new TextEncoder().encode(JSON.stringify(p));
        const z = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
        let bin = '';
        z.forEach(b => { bin += String.fromCharCode(b); });
        const old = 'z' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const back = await SharedShare.unpack(old);
        return { how: s.charAt(0), len: s.length, old: old.length, same: JSON.stringify(back) === JSON.stringify(p) };
      }, got).catch(e => ({ error: e.message }));
      check(`${tag} L2 the link is deflated against the dictionary where that is shorter, and an old link still opens`,
            (L2.how === 'a' ? L2.len < L2.old : L2.how === 'z' && L2.len === L2.old) && L2.same,
            L2.error || `${L2.how}: ${L2.len} characters, ${L2.old} deflated alone, old link ${L2.same ? 'opens the same' : 'differs'}`);
    }
    if (key === spec.charts[0]) await attack(page, tag, src);
    if (key === spec.charts[0]) await loading(tag, src);
    if (key === spec.charts[0] && spec === PAGES[0]) await hostile(page, tag);
    const light = await page.evaluate(() => document.body.classList.contains('light'));

    for (const vp of [{ width: 760, height: Math.max(380, height) }, { width: 360, height: Math.max(380, height) }]) {
      const E = await newPage(vp, { returning: false });
      const fetched = [];
      E.page.on('request', r => fetched.push(r.url()));
      const id = String(hosted.size + 1);
      hosted.set(id, '<!doctype html><meta charset="utf-8"><body style="margin:0">' + code.split(SITE).join(ORIGIN) + '</body>');
      await E.page.goto(HOST + '/?id=' + id, { waitUntil: 'load' });
      const frame = await (await E.page.waitForSelector('iframe')).contentFrame();
      const ready = await frame.waitForFunction(() => !document.documentElement.classList.contains('wait'), null, { timeout: 30000 }).then(() => true, () => false);
      await E.page.waitForTimeout(400);
      const got = await frame.evaluate(VIEW);
      const view = await frame.evaluate(`(() => {
        const card = document.querySelector('body > .card'), cr = card && card.getBoundingClientRect();
        const el = card && card.querySelector('.stage canvas, .stage .js-plotly-plot, .stage svg.diagram');
        // Any visible text outside the card would be something else showing.
        const stray = [...document.body.querySelectorAll('h1,h2,h3,p,label,button,a,input,select')]
          .filter(e => e.offsetParent !== null && !(card && card.contains(e)) && !e.closest('[class*="chart-tip"]'))
          .map(e => (e.textContent || e.value || e.tagName).trim().slice(0, 30));
        const ch = el && el.tagName === 'CANVAS' && window.Chart && window.Chart.getChart(el);
        return {
          failed: document.documentElement.classList.contains('failed'),
          fills: !!cr && cr.top <= 1 && Math.abs(cr.height - innerHeight) <= 2 && Math.abs(cr.width - innerWidth) <= 2,
          chartTall: el ? Math.round(el.getBoundingClientRect().height) : 0,
          stray, light: document.body.classList.contains('light'),
          zoom: ch ? !!(ch.options.plugins && ch.options.plugins.zoom && ch.options.plugins.zoom.zoom) : !!(el && el._fullLayout),
          saved: Object.keys(localStorage).filter(k => /^abt:save:/.test(k)),
          mark: (() => {
            const m = card && card.querySelector(':scope > .mark');
            if (!m || m.offsetParent === null) return null;
            const r = m.getBoundingClientRect();
            return { href: m.href, text: m.textContent.replace(/\\s+/g, ' ').trim(), logo: !!m.querySelector('svg circle'),
                     px: parseFloat(getComputedStyle(m).fontSize), inFrame: r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1 };
          })(),
          wide: document.documentElement.scrollWidth > innerWidth + 1,
          bg: [document.documentElement, document.body, card].filter(Boolean).map(e => getComputedStyle(e).backgroundColor),
        };
      })()`);
      const where = `at ${vp.width}px`;
      // E14: the other site's page sizes the frame to the card: nothing cut,
      // no band of empty frame, and a diagram fills its stage edge to edge
      // but for its margin (28px, 42 at its largest zoom).
      const fit = await frame.evaluate(`(() => {
        const card = document.querySelector('body > .card');
        if (!card) return null;
        const out = { inner: innerHeight, content: card.scrollHeight };
        const svg = card.querySelector('svg.diagram');
        if (svg) {
          const vb = svg.viewBox.baseVal, k = Math.min(svg.clientWidth / vb.width, svg.clientHeight / vb.height);
          const g = [...svg.children].filter(n => { try { const b = n.getBBox(); return b.width < 20000 && b.height < 20000; } catch (e) { return false; } });
          let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
          g.forEach(n => { const b = n.getBBox(); if (!b.width && !b.height) return; x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height); });
          const shownH = svg.clientHeight / k;
          out.gaps = [Math.round((y0 - (vb.y + vb.height / 2 - shownH / 2)) * k), Math.round(((vb.y + vb.height / 2 + shownH / 2) - y1) * k)];
          out.stage = svg.clientHeight;
          out.cut = x0 < vb.x - 1 || x1 > vb.x + vb.width + 1 || Math.min(...out.gaps) < -1;
        }
        return out;
      })()`);
      const sized = await E.page.$eval('iframe', f => ({ style: f.style.height, h: Math.round(f.getBoundingClientRect().height) }));
      check(`${tag} E14 ${where}: the host's script sizes the frame to the chart, ${fit && fit.gaps ? 'the diagram filling its stage' : 'nothing cut or left empty'}`,
            !!fit && !!sized.style && Math.abs(sized.h - fit.inner) <= 1 && fit.content <= fit.inner + 1 &&
            (!fit.gaps || (!fit.cut && (Math.max(...fit.gaps) <= 50 || (fit.stage <= 165 && Math.max(...fit.gaps) <= 70)))),
            !fit ? 'no card' : `frame ${sized.style || 'not sized'} (${sized.h}px), card ${fit.content}px` +
              (fit.gaps ? `, empty stage above/below ${fit.gaps.join('/')}px of ${fit.stage}px${fit.cut ? ', drawing cut' : ''}` : ''));
      if (SHOT) await E.page.screenshot({ fullPage: true, path: join(SHOT, `${spec.name}-${key}-${vp.width}`.replace(/[^a-z0-9]+/gi, '_') + '.png') });
      // A diagram zooms by the wheel: its viewBox has to move.
      const svgZoom = await frame.evaluate(`(async () => {
        const svg = document.querySelector('.card svg.diagram');
        if (!svg) return null;
        const before = svg.getAttribute('viewBox'), r = svg.getBoundingClientRect();
        svg.parentElement.dispatchEvent(new WheelEvent('wheel', { deltaY: -240, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true }));
        await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
        return svg.getAttribute('viewBox') !== before;
      })()`);
      if (svgZoom !== null) view.zoom = svgZoom;
      check(`${tag} E2 ${where}: the embed opens on its own chart card alone, filling the frame`,
            ready && !view.failed && view.fills && !view.stray.length && !view.wide && view.chartTall >= 160,
            !ready ? 'never finished loading' : view.failed ? 'showed its fallback' :
            view.stray.length ? 'also shows: ' + view.stray.slice(0, 4).join(' / ') : `chart ${view.chartTall}px tall`);
      check(`${tag} E3 ${where}: it draws exactly the data the reader saw, in their theme`,
            !!want && sameDrawing(want, got) && view.light === light,
            sameDrawing(want, got) ? (light ? 'light' : 'dark') : `drawn ${got ? got.length : 0} chars vs ${want ? want.length : 0}`);
      check(`${tag} E4 ${where}: zoom still works, and the viewer's saved work is left alone`,
            view.zoom && !view.saved.length, view.saved.length ? 'wrote ' + view.saved.join(', ') : '');
      const host = canon.replace(/^https?:\/\//, '').replace(/\/$/, '');
      check(`${tag} E8 ${where}: the frame carries its own watermark, logo and "${W.back} ${host}", small and in view`,
            !!view.mark && view.mark.href === openHref && view.mark.text === `${W.back} ${host}` && view.mark.logo &&
            view.mark.px <= 11 && view.mark.inFrame,
            view.mark ? `${view.mark.px}px "${view.mark.text}" → ${view.mark.href}` : 'no watermark in the card');
      check(`${tag} E13 ${where}: the frame has no background of its own`,
            view.bg.every(c => c === 'rgba(0, 0, 0, 0)' || c === 'transparent'), view.bg.join(', '));
      check(`${tag} E5 ${where}: no page errors`, E.errors.length === 0, E.errors.slice(0, 2).join(' | '));
      // E10: the frame loads the viewer, its libraries, the chart kits and
      // fonts (the site's own, fonts.css and assets/fonts/); nothing of the
      // tool, and no data.
      const tool = fetched.filter(u => u.startsWith(ORIGIN) && !/\/embed\/|\/chart-kit\.js$|\/(dark|light|fonts)\.css$|\/logos\/|\/assets\/fonts\//.test(u.split('?')[0]));
      check(`${tag} E10 ${where}: the frame fetches nothing of the tool, only the viewer and its libraries`,
            !tool.length, tool.slice(0, 3).map(u => u.replace(ORIGIN, '')).join(', '));
      if (spec.prices) check(`${tag} E9 ${where}: it draws from the prices in its link and never calls the Worker`,
                             E.worker() === 0, `${E.worker()} Worker request(s)`);
      if (vp.width === 760) await views(page, tag, key, frame);
      await E.ctx.close();
    }
  }
  check(spec.name + ' E no page errors', D.errors.length === 0, D.errors.slice(0, 2).join(' | '));
  await D.ctx.close();

  /* ── 2. a wide monitor exports the same picture ── */
  let Wd;
  try { Wd = await reach(spec, { width: 1920, height: 1080 }); }
  catch (e) { check(spec.name + ': the page reaches its charts on a wide monitor', false, e.message); continue; }
  for (const key of spec.charts) {
    if (!desk[key]) continue;
    const png = await download(Wd.page, key, 'png').then(pngSize, e => e.message);
    check(`${spec.name} [${key}] X5 a 1920px monitor's PNG is the same ${desk[key].png}`, same(png, desk[key].png), String(png));
  }
  await Wd.ctx.close();

  /* ── 2. a phone exports the desktop picture ── */
  let P;
  try { P = await reach(spec, { width: 390, height: 844 }); }
  catch (e) { check(spec.name + ': the page reaches its charts on a phone', false, e.message); continue; }
  for (const key of spec.charts) {
    const tag = `${spec.name} [${key}]`;
    if (!desk[key]) continue;
    const png = await download(P.page, key, 'png').then(pngSize, e => e.message);
    const svg = await download(P.page, key, 'svg').then(b => svgSize(b.toString('utf8')), e => e.message);
    check(`${tag} X2 a phone's PNG is the desktop's, ${desk[key].png}`, same(png, desk[key].png), String(png));
    check(`${tag} X3 a phone's SVG is the desktop's, ${desk[key].svg}`, same(svg, desk[key].svg), String(svg));
    if (spec.gif) {
      const gif = await download(P.page, key, 'gif').then(gifInfo, e => ({ err: e.message }));
      check(`${tag} X7 a phone's GIF is the desktop's, ${desk[key].gif}`, !gif.err && same([gif.w, gif.h], desk[key].gif), gif.err || `${gif.w}x${gif.h}`);
    }
    const copied = await clipboardSize(P.page, key).catch(e => e.message);
    const label = await P.page.evaluate(`(${FIND})(${JSON.stringify(key)}).toggle.textContent.trim()`);
    check(`${tag} X4 and what it copies is that same PNG, with ${W.copied} on Share`,
          same(copied, desk[key].png) && label === W.copied, `${copied}; Share reads "${label}"`);
  }
  check(spec.name + ' E no page errors on a phone', P.errors.length === 0, P.errors.slice(0, 2).join(' | '));
  await P.ctx.close();
}

/* ── 6. A link once sent keeps opening ──
   A link lives on in chats and on other sites long after the tool moves on,
   so _ref/share-links.json keeps real links as they were copied, in every
   format the site has written (z: deflated alone, a: against share-dict-a),
   with a hash of what each held. Never edit or drop one; add new ones.
   F1: the dictionary is byte for byte the file links were made with, and
       every kept link still decodes to exactly what it held.
   F2: what it holds still has somewhere to land: every saved field names an
       input still on the page, a select's saved value is still one of its
       options, and the chart and the view's fields and buttons are still
       there. A field renamed or removed fails here, so the tool can keep
       reading the old name (a migration in its load) before it ships. */
const DICT_SHA256 = { a: '4d72827e85280530d51be554f9df8295152278423b8e8d1ab532252d58c61c03' };
{
  console.log('\n── kept links ──');
  for (const [letter, want] of Object.entries(DICT_SHA256)) {
    const file = join(ROOT, `share-dict-${letter}.txt`);
    const got = existsSync(file) ? createHash('sha256').update(readFileSync(file)).digest('hex') : 'missing';
    check(`F1 share-dict-${letter}.txt is the file links were made with`, got === want, got.slice(0, 16));
  }
  const kept = JSON.parse(readFileSync(join(HERE, 'share-links.json'), 'utf8'));
  // A kept link made at a tool's old address is checked where the tool lives
  // now. (/capacityexpansion-planner/ no longer forwards: it was removed before
  // the planner went on the home page.)
  const MOVED = { '/capacityexpansion-planner/': '/capacity-expansion-planner/' };
  for (const kept0 of kept) {
    const k = { ...kept0, page: MOVED[kept0.page] || kept0.page };
    if (ONLY && !k.page.includes(ONLY) && ONLY !== "kept") continue;
    const tag = `${k.page} [${k.chart}] ${k.s.charAt(0)}-link`;
    const K = await newPage({ width: 1440, height: 1000 });
    await K.page.goto(ORIGIN + k.page, { waitUntil: 'load' });
    await K.page.waitForTimeout(500);
    const r = await K.page.evaluate(async s => {
      const p = await SharedShare.unpack(s);
      const text = JSON.stringify(p);
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))]
        .map(b => b.toString(16).padStart(2, '0')).join('');
      const lost = [];
      const byHandle = id => document.querySelector(`[data-persist="${CSS.escape(id)}"]`) || document.getElementById(id) || document.getElementsByName(id)[0];
      const fields = (p.s && p.s.state && p.s.state.__fields) || {};
      for (const [key, v] of Object.entries(fields)) {
        const kind = key.charAt(0), id = key.slice(2);
        if (kind === 'r') {
          const group = [...document.getElementsByName(id)];
          if (!group.some(e => e.value === v)) lost.push(group.length ? `${key}=${v}` : key);
          continue;
        }
        const el = byHandle(id);
        if (!el) lost.push(key);
        else if (el.tagName === 'SELECT' && !el.multiple && ![...el.options].some(o => o.value === v)) lost.push(`${key}=${v}`);
      }
      for (const key of Object.keys((p.u && p.u.f) || {})) {
        const el = key.charAt(0) === '#' ? document.getElementById(key.slice(1)) : document.getElementsByName(key.split('=')[0])[0];
        if (!el) lost.push('view ' + key);
      }
      return { hash, lost, ids: [...((p.u && p.u.on) || []), ...((p.u && p.u.off) || [])] };
    }, k.s).catch(e => ({ error: e.message }));
    check(`${tag} F1 still decodes to what it held`, !r.error && r.hash === k.sha256, r.error || (r.hash === k.sha256 ? '' : 'decodes to something else'));
    if (r.error) { await K.ctx.close(); continue; }
    // The chart and the view's buttons may only be drawn later (a popup, a
    // simulation), so they are looked for in the page's own files.
    const dir = join(ROOT, k.page);
    const own = [join(dir, 'index.html'), join(dir, 'script.js'), join(dir, '..', 'script.js')]
      .filter(f => existsSync(f)).map(f => readFileSync(f, 'utf8')).join('\n');
    const named = sel => own.includes(sel.replace(/^[#.]/, '').replace(/^\w+\[([\w-]+)="([^"]*)"\]$/, '$2'));
    const lost = r.lost.concat(named(k.chart) ? [] : ['chart ' + k.chart], r.ids.filter(sel => !named(sel)).map(sel => 'button ' + sel));
    check(`${tag} F2 every field, the chart and the view it carries are still on the page`, lost.length === 0, lost.slice(0, 6).join(', '));
    await K.ctx.close();
  }
}

await browser.close();
server.close();
host.close();
console.log(`\nshare check: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
