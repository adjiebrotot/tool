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
//   3. AN EMBED IS THE SAME CHART. The code is one iframe of the tool's own
//      address and one credit line under it, a plain followed link to the
//      tool by its name, which is the backlink (E11). The line back to the
//      tool is also drawn inside
//      the frame, under the chart, with the site's logo, where the other site
//      cannot edit it out. Both links open the whole tool set up on the
//      scenario the embed shows (E12), and the frame has no background of
//      its own, so the other site's page shows through (E13). Opened as another site would open it,
//      inside a page on another site, it shows that one chart card and
//      nothing else, draws exactly the
//      data the reader was looking at (scenario, metric, toggles and legend),
//      in their theme, with zoom still working, and never touches the
//      viewer's own saved work. It is checked again at a phone's width.
//   5. AN EMBED COSTS NOTHING. Its frame runs on the tool's own origin, so
//      the market-data Worker's origin lock lets it through, and every viewer
//      on another site would be a paid invocation. It never calls the Worker:
//      the prices its scenario draws ride in the link (E9), and a link from
//      before they did fails in plain view rather than fetching (E10).
//   4. A LINK CAN ONLY CARRY TEXT. Anyone can send one, so every string in a
//      real scenario is swapped for markup and a script that would close a
//      quote in a template; the embed has to draw it as text and run nothing.
//      And opened as a page of its own, an embed link is just the tool.
//
// Every page is moved off its defaults before it is shared, so an embed that
// dropped the scenario would draw the defaults and fail rule 3.
//
// A chart the tool draws itself (an SVG diagram) marks its element
// data-share-chart and keeps data-share-sig set to a signature of what it
// draws: E3 compares that, and E4 wheels the diagram and needs its viewBox to
// move. A page whose cluster carries ⬇ GIF (spec.gif) also has the GIF row in
// its menu (M2), and its GIF must loop and be the desktop PNG's size at 1x on
// a desktop and on a phone alike (X6, X7).
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
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), pick(page, key, kind)]);
  return readFileSync(await dl.path());
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

/* An embed carries the scenario, never what the tool can fetch or rebuild
   (prices, simulated paths). Past this, something heavy has leaked into the
   saved state and the code is no longer one a reader can paste. */
const BUDGET = 2500;
// A tool on market prices carries them too (rule 5): the scenario's window of
// daily OHLC for each ticker, which is tens of KB a decade.
const PRICE_BUDGET = 600 * 1024;

const WORDS = {
  en: { share: 'Share', rows: ['Download as SVG', 'Download as PNG', 'Copy to clipboard', 'Share as link', 'Embed as HTML'], gif: 'Download as GIF',
        back: 'Try your own scenarios at', copied: '✓ Copied', linkCopied: '✓ Link copied' },
  id: { share: 'Bagikan', rows: ['Unduh sebagai SVG', 'Unduh sebagai PNG', 'Salin ke papan klip', 'Bagikan sebagai tautan', 'Sematkan sebagai HTML'], gif: 'Unduh sebagai GIF',
        back: 'Coba skenario Anda sendiri di', copied: '✓ Tersalin', linkCopied: '✓ Tautan tersalin' },
};

/* 4. Every string in the reader's real scenario becomes an attack: markup,
   and a quote-closer for a template that builds JS. Drawn in a frame on
   another site, none of it may run or become an element. */
const EVIL = `"><img src=x onerror="window.__pwned=1">';window.__pwned=1;//`;
async function attack(page, tag, src) {
  const s = decodeURIComponent(/&amp;s=([^&]+)$/.exec(src)[1]);
  const bad = await page.evaluate(([s, evil]) => SharedShare.unpack(s).then(p => {
    const poison = v => typeof v === 'string' ? evil : Array.isArray(v) ? v.map(poison)
      : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, poison(x)])) : v;
    // The file's own tags stay, or it is refused before anything is drawn.
    const keep = p.s ? { tool: p.s.tool, kind: p.s.kind, app: p.s.app } : {};
    p.s = poison(p.s);
    Object.keys(keep).forEach(k => { if (keep[k] !== undefined) p.s[k] = keep[k]; });
    return SharedShare.pack(p);
  }), [s, EVIL]);
  const E = await newPage({ width: 760, height: 560 }, { returning: false });
  const id = 'evil' + hosted.size;
  const base = src.split('&amp;s=')[0].replace(/&amp;/g, '&').replace(SITE, ORIGIN);
  hosted.set(id, `<!doctype html><meta charset="utf-8"><body style="margin:0"><iframe src="${base}&s=${bad}" width="760" height="560"></iframe></body>`);
  await E.page.goto(HOST + '/?id=' + id, { waitUntil: 'load' });
  const frame = await (await E.page.waitForSelector('iframe')).contentFrame();
  await frame.waitForFunction(() => !document.documentElement.classList.contains('abt-embed-wait'), null, { timeout: 45000 }).catch(() => {});
  await E.page.waitForTimeout(600);
  const r = await frame.evaluate(() => ({ ran: !!window.__pwned, imgs: document.querySelectorAll('img[src="x"]').length }));
  check(`${tag} E7 a link whose every string is markup and script draws it as text and runs none of it`,
        !r.ran && !r.imgs, `ran: ${r.ran}, injected elements: ${r.imgs}`);
  await E.ctx.close();
}

/* 5. A link from before the prices rode in it. It would need the Worker,
   which an embed never calls, so it shows its fallback rather than half a
   chart, and costs nothing. */
async function priceless(page, tag, src) {
  const s = decodeURIComponent(/&amp;s=([^&]+)$/.exec(src)[1]);
  const old = await page.evaluate(s => SharedShare.unpack(s).then(p => { const had = !!p.d; delete p.d; return SharedShare.pack(p).then(x => [had, x]); }), s);
  const E = await newPage({ width: 760, height: 560 }, { returning: false });
  const id = 'old' + hosted.size;
  const base = src.split('&amp;s=')[0].replace(/&amp;/g, '&').replace(SITE, ORIGIN);
  hosted.set(id, `<!doctype html><meta charset="utf-8"><body style="margin:0"><iframe src="${base}&s=${old[1]}" width="760" height="560"></iframe></body>`);
  await E.page.goto(HOST + '/?id=' + id, { waitUntil: 'load' });
  const frame = await (await E.page.waitForSelector('iframe')).contentFrame();
  await frame.waitForFunction(() => !document.documentElement.classList.contains('abt-embed-wait'), null, { timeout: 45000 }).catch(() => {});
  const failed = await frame.evaluate(() => document.documentElement.classList.contains('abt-embed-failed'));
  check(`${tag} E10 a link without its prices shows its fallback and never calls the Worker`,
        old[0] && failed && E.worker() === 0, `prices were in the link: ${old[0]}, fallback: ${failed}, ${E.worker()} Worker request(s)`);
  await E.ctx.close();
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
      const vis = [...f.cluster.querySelectorAll('button')].filter(b => b.offsetParent !== null);
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
    }, null, { timeout: 10000 });
    const code = await page.$eval('.share-code', t => t.value);
    const canon = await page.$eval('link[rel="canonical"]', l => l.href);
    const src = (/src="([^"]+)"/.exec(code) || [])[1] || '';
    const height = +((/height="(\d+)"/.exec(code) || [])[1] || 0);
    const [frameCode, creditCode = ''] = code.split('\n');
    check(`${tag} E1 the code is one iframe of the tool and its credit line`,
          /^<iframe [^\n]*><\/iframe>$/.test(frameCode) && src.startsWith(canon + '#embed=' + encodeURIComponent(key) + '&amp;') &&
          height >= 380 && code.split('\n').length === 2 && frameCode.length <= (spec.prices ? PRICE_BUDGET : BUDGET) + 400 &&
          creditCode.length <= BUDGET + 400,
          `frame ${frameCode.length} characters (at most ${(spec.prices ? PRICE_BUDGET : BUDGET) + 400}), credit ${creditCode.length} (at most ${BUDGET + 400}), frame ${height}px tall`);
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
    const want = await page.evaluate(`(${DRAWN})(${JSON.stringify(key)})`);
    const T6 = await D.ctx.newPage();
    await T6.goto(src.replace(/&amp;/g, '&').replace(SITE, ORIGIN), { waitUntil: 'load' });
    check(`${tag} E6 opened as a page of its own, the link is the whole tool`,
          !(await T6.evaluate(() => document.documentElement.classList.contains('abt-embed'))));
    await T6.close();
    // E12: the link back opens the whole tool on the reader's scenario, for a
    // visitor who has none saved, fetching its own prices.
    {
      const O = await newPage({ width: 1440, height: 1000 });
      await O.page.goto(openHref.replace(SITE, ORIGIN), { waitUntil: 'load' });
      const drew = await O.page.waitForFunction(`(() => { const w = ${JSON.stringify(want)}; return (${DRAWN})(${JSON.stringify(key)}) === w; })()`,
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
    if (key === spec.charts[0] && spec.prices) await priceless(page, tag, src);
    const light = await page.evaluate(() => document.body.classList.contains('light'));

    for (const vp of [{ width: 760, height: Math.max(380, height) }, { width: 360, height: Math.max(380, height) }]) {
      const E = await newPage(vp, { returning: false });
      const id = String(hosted.size + 1);
      hosted.set(id, '<!doctype html><meta charset="utf-8"><body style="margin:0">' + code.split(SITE).join(ORIGIN) + '</body>');
      await E.page.goto(HOST + '/?id=' + id, { waitUntil: 'load' });
      const frame = await (await E.page.waitForSelector('iframe')).contentFrame();
      const ready = await frame.waitForFunction(() => document.documentElement.classList.contains('abt-embed') &&
        !document.documentElement.classList.contains('abt-embed-wait'), null, { timeout: 45000 }).then(() => true, () => false);
      await E.page.waitForTimeout(400);
      const got = await frame.evaluate(`(${DRAWN})(${JSON.stringify(key)})`);
      const view = await frame.evaluate(`(() => {
        const f = (${FIND})(${JSON.stringify(key)});
        const cr = f.card && f.card.getBoundingClientRect();
        // Any visible text outside the card is the rest of the page showing through.
        const stray = [...document.body.querySelectorAll('h1,h2,h3,p,label,button,a,input,select')]
          .filter(e => e.offsetParent !== null && !(f.card && f.card.contains(e)) && !e.closest('.share-list,.share-embed-overlay,[class*="tooltip"],[class*="chart-tip"]'))
          .map(e => (e.textContent || e.value || e.tagName).trim().slice(0, 30));
        const ch = f.el && window.Chart && window.Chart.getChart(f.el);
        return {
          failed: document.documentElement.classList.contains('abt-embed-failed'),
          fills: !!cr && cr.top <= 1 && Math.abs(cr.height - innerHeight) <= 2 && Math.abs(cr.width - innerWidth) <= 2,
          chartTall: f.el ? Math.round(f.el.getBoundingClientRect().height) : 0,
          stray, light: document.body.classList.contains('light'),
          zoom: ch ? !!(ch.options.plugins && ch.options.plugins.zoom && ch.options.plugins.zoom.zoom) : !!(f.el && f.el._fullLayout),
          saved: Object.keys(localStorage).filter(k => /^abt:save:/.test(k)),
          mark: (() => {
            const m = f.card && f.card.querySelector(':scope > .abt-embed-mark');
            if (!m || m.offsetParent === null) return null;
            const r = m.getBoundingClientRect();
            return { href: m.href, text: m.textContent.replace(/\\s+/g, ' ').trim(), logo: !!m.querySelector('svg circle'),
                     px: parseFloat(getComputedStyle(m).fontSize), inFrame: r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1 };
          })(),
          share: f.cluster ? f.cluster.querySelector('.share-menu').offsetParent !== null : false,
          wide: document.documentElement.scrollWidth > innerWidth + 1,
          bg: [document.documentElement, document.body, f.card].filter(Boolean).map(e => getComputedStyle(e).backgroundColor),
        };
      })()`);
      const where = `at ${vp.width}px`;
      // A diagram drawn by the tool zooms by the wheel: its viewBox has to move.
      const svgZoom = await frame.evaluate(`(async () => {
        const f = (${FIND})(${JSON.stringify(key)});
        if (!f.el || !f.el.hasAttribute('data-share-chart')) return null;
        const svg = f.el.querySelector('svg'), before = svg && svg.getAttribute('viewBox');
        if (!svg) return false;
        const r = svg.getBoundingClientRect();
        svg.dispatchEvent(new WheelEvent('wheel', { deltaY: -240, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true }));
        await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
        return svg.getAttribute('viewBox') !== before;
      })()`);
      if (svgZoom !== null) view.zoom = svgZoom;
      if (SHOT) await E.page.screenshot({ path: join(SHOT, `${spec.name}-${key}-${vp.width}`.replace(/[^a-z0-9]+/gi, '_') + '.png') });
      check(`${tag} E2 ${where}: the embed opens on its own chart card alone, filling the frame`,
            ready && !view.failed && view.fills && !view.stray.length && !view.share && !view.wide && view.chartTall >= 160,
            !ready ? 'never finished loading' : view.failed ? 'showed its fallback' :
            view.stray.length ? 'also shows: ' + view.stray.slice(0, 4).join(' / ') : `chart ${view.chartTall}px tall`);
      check(`${tag} E3 ${where}: it draws exactly the data the reader saw, in their theme`,
            !!want && got === want && view.light === light,
            got === want ? (light ? 'light' : 'dark') : `drawn ${got ? got.length : 0} chars vs ${want ? want.length : 0}, first difference at ${[...(got || '')].findIndex((c, i) => c !== want[i])}`);
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
      if (spec.prices) check(`${tag} E9 ${where}: it draws from the prices in its link and never calls the Worker`,
                             E.worker() === 0, `${E.worker()} Worker request(s)`);
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
  for (const k of kept) {
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
