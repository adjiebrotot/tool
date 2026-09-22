// Charts — site-wide check.
//
// Every tool that draws an interactive chart makes the reader the same three
// promises, and this drives the real pages in headless Chromium to hold them
// to all three:
//
//   1. THE EXPORT ROW IS ONE ROW. Every chart carries the same cluster, in the
//      same order — ⬇ SVG, ⬇ PNG, ⧉ copy, ⟳ reset zoom — drawn at the same
//      size, pinned to the right edge of its title row on a desktop and spread
//      full width on a phone. A table's ⬇ CSV sits in the same cluster beside
//      the table it exports.
//   2. A GESTURE CANNOT LEAVE THE DATA. Panning and pinching stay inside what
//      the tool actually plotted, and a pinch cannot shrink the window below a
//      handful of points, where there is nothing left to read.
//   3. THE Y AXIS FOLLOWS THE X WINDOW. Zoom into a slice and the axis is
//      sized to that slice, so the shape under the reader's nose is the shape
//      they can read — not a flat smear against a scale built for the rest of
//      the series.
//
// The real Chart.js and chartjs-plugin-zoom are used, not a stub, because the
// promises are about what those libraries do: the files are fetched once into
// _ref/.libcache/ and served from there afterwards, so later runs are offline.
// Market data is synthetic and served from a stubbed Worker, so the DCA tools
// run without touching the network either.
//
// Run: node _ref/chart-check.mjs
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize, basename } from 'node:path';

const { chromium } = pw;
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const LIBS = join(HERE, '.libcache');

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  console.log((ok ? '  PASS  ' : '✗ FAIL  ') + name + (detail ? '  — ' + detail : ''));
  ok ? pass++ : fail++;
};

/* ── The site, served the way it is served in production ─────────────────── */
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript',
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

/* ── The chart libraries, cached on first run ────────────────────────────── */
const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/chartjs-plugin-zoom/2.0.1/chartjs-plugin-zoom.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/hammer.js/2.0.8/hammer.min.js',
  // The Graph Visualiser plots with Plotly, and keeps the same two promises by
  // hand, so its library is cached here too.
  'https://cdnjs.cloudflare.com/ajax/libs/plotly.js/2.27.1/plotly.min.js',
];
mkdirSync(LIBS, { recursive: true });
for (const url of CDN) {
  const file = join(LIBS, basename(url));
  if (existsSync(file)) continue;
  process.stdout.write('fetching ' + basename(url) + '… ');
  try {
    const body = await (await fetch(url)).text();
    writeFileSync(file, body);
    console.log('cached');
  } catch (e) {
    console.log('FAILED');
    console.error('\nThe chart libraries are not cached yet and could not be fetched:\n  ' +
                  e.message + '\nRun this once with network access; afterwards it runs offline.');
    process.exit(2);
  }
}
const libBody = url => readFileSync(join(LIBS, basename(url)), 'utf8');

/* ── Synthetic market data, so the DCA tools run offline ─────────────────── */
function synthSeries(days = 900, seed = 7) {
  const dates = [], prices = [];
  let p = 100, s = seed, d = new Date(Date.UTC(2020, 0, 1));
  for (let i = 0; i < days; i++) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const r = s / 2147483648 - 0.5;
    p = Math.max(1, p * (1 + 0.0006 + r * 0.02));
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) { i--; continue; }
    dates.push(d.toISOString().slice(0, 10));
    prices.push(+p.toFixed(4));
  }
  return { dates, prices };
}

/* A small, monotonically growing table, so the Graph Visualiser has something
   whose early years a whole-run y scale would flatten. */
const DEMO_CSV = join(LIBS, 'chart-check-demo.csv');
{
  const rows = ['x,series_a,series_b'];
  let a = 10, b = 5, s = 3;
  for (let i = 0; i < 120; i++) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const r = s / 2147483648 - 0.5;
    a *= 1 + 0.015 + r * 0.03;
    b *= 1 + 0.008 + r * 0.02;
    rows.push(`${i},${a.toFixed(3)},${b.toFixed(3)}`);
  }
  writeFileSync(DEMO_CSV, rows.join('\n'));
}

const browser = await chromium.launch();

async function newPage(viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await ctx.route('**', async route => {
    const url = route.request().url();
    if (url.startsWith(ORIGIN)) return route.continue();
    const lib = CDN.find(c => url.startsWith(c.split('?')[0]) || url.endsWith(basename(c)));
    if (lib) return route.fulfill({ status: 200, contentType: 'text/javascript', body: libBody(lib) });
    if (url.includes('yfinance') || url.includes('workers.dev')) {
      const tickers = (new URL(url).searchParams.get('tickers') || 'TEST').split(',');
      const results = {};
      tickers.forEach((t, i) => {
        const s = synthSeries(900, 7 + i * 13);
        results[t] = { dates: s.dates, prices: s.prices, source: 'test', kind: 'adjusted' };
      });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results }) });
    }
    const type = route.request().resourceType();
    if (type === 'script') return route.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
    if (type === 'stylesheet') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return route.abort();
  });
  /* The guided tour offers itself on a first visit and covers the page, so
     every tool is opened as a returning visitor would open it. */
  await ctx.addInitScript(() => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (k) {
      return /-seen$/.test(k) ? '1' : get.call(this, k);
    };
  });
  const page = await ctx.newPage();
  return { ctx, page };
}

/* ── In-page probes ──────────────────────────────────────────────────────── */

/* The export cluster, read off the rendered page: what each button says, how
   it is drawn, and where the cluster sits inside its own header row. */
const CLUSTER_PROBE = () => {
  const norm = s => (s || '').replace(/\s+/g, ' ').trim();
  return [...document.querySelectorAll('.btn-cluster')]
    .filter(c => c.offsetParent !== null)
    .map(cluster => {
      const head = cluster.parentElement;
      const hr = head.getBoundingClientRect(), cr = cluster.getBoundingClientRect();
      /* Measured against the header's CONTENT box, not its border box: a modal
         header reserves room on the right for the ✕ that sits in the corner,
         and the cluster is hard right of what it is allowed to use. */
      const hs = getComputedStyle(head);
      const padL = parseFloat(hs.paddingLeft) || 0, padR = parseFloat(hs.paddingRight) || 0;
      const card = cluster.closest('.card, .chart-modal') || head;
      const kr = card.getBoundingClientRect();
      return {
        where: (head.className || '') + ' | ' + norm((head.querySelector('h2,h3') || {}).textContent).slice(0, 40),
        buttons: [...cluster.querySelectorAll('button')].map(b => {
          const cs = getComputedStyle(b), r = b.getBoundingClientRect();
          return {
            id: b.id || b.dataset.act || '', label: norm(b.textContent), title: b.getAttribute('title') || '',
            cls: b.className, font: cs.fontSize, pad: cs.paddingTop + ' ' + cs.paddingLeft,
            radius: cs.borderTopLeftRadius, width: Math.round(r.width), right: Math.round(r.right),
          };
        }),
        clusterRight: Math.round(cr.right), headRight: Math.round(hr.right - padR),
        clusterWidth: Math.round(cr.width), headWidth: Math.round(hr.width - padL - padR),
        cardRight: Math.round(kr.right), cardLeft: Math.round(kr.left),
      };
    });
};

/* Everything the zoom promises depend on, per live chart: its limits, and what
   the y axis does when the x window is narrowed to the FIRST FIFTH of the
   data — the part of a compounding series that a whole-run scale flattens. */
const ZOOM_PROBE = (canvasIds) => {
  const out = [];
  for (const id of canvasIds) {
    const cv = document.getElementById(id) || document.querySelector(id);
    const chart = cv && window.Chart.getChart(cv);
    if (!chart) { out.push({ id, missing: true }); continue; }
    const z = (chart.options.plugins || {}).zoom || {};
    const lim = (z.limits || {}).x;
    const rec = {
      id, lim: lim ? { min: lim.min, max: lim.max, minRange: lim.minRange } : null,
      panMode: z.pan && z.pan.mode, zoomMode: z.zoom && z.zoom.mode,
      wheel: !!(z.zoom && z.zoom.wheel && z.zoom.wheel.enabled),
      pinch: !!(z.zoom && z.zoom.pinch && z.zoom.pinch.enabled),
      fitted: !!(chart.$fitY || chart.$autoFitY ||
                 ((chart.options.plugins || {}).sharedYFit)),
      plugged: (chart.config.plugins || []).some(p => p && p.id === 'sharedYFit') ||
               !!window.Chart.registry.plugins.get('sharedYFit'),
    };
    if (!lim) { out.push(rec); continue; }

    // The axis, zoomed all the way out.
    chart.resetZoom();
    const yIds = Object.keys(chart.scales).filter(k => chart.scales[k].axis === 'y');
    rec.full = {};
    yIds.forEach(k => { rec.full[k] = { min: chart.scales[k].min, max: chart.scales[k].max }; });

    /* Push past both ends of the data and past the pinch floor, through the
       same calls a wheel, a drag and a pinch make — chart.zoom/chart.pan —
       rather than the programmatic zoomScale, which is documented to ignore
       the limits. */
    const span = lim.max - lim.min;
    for (let i = 0; i < 12; i++) chart.zoom(0.5, 'none');          // pinch out, hard
    rec.pastEnds = { min: chart.scales.x.min, max: chart.scales.x.max };
    chart.resetZoom();
    chart.pan({ x: 100000 }, undefined, 'none');
    rec.pannedLeft = { min: chart.scales.x.min, max: chart.scales.x.max };
    chart.resetZoom();
    chart.pan({ x: -100000 }, undefined, 'none');
    rec.pannedRight = { min: chart.scales.x.min, max: chart.scales.x.max };
    chart.resetZoom();
    for (let i = 0; i < 40; i++) chart.zoom(1.6, 'none');          // pinch in, hard
    rec.pinchedIn = chart.scales.x.max - chart.scales.x.min;

    // Zoom to the first fifth and see what the y axes did.
    chart.resetZoom();
    const wMin = lim.min, wMax = lim.min + span / 5;
    chart.zoomScale('x', { min: wMin, max: wMax }, 'none');
    rec.window = { min: wMin, max: wMax };
    rec.zoomed = {};
    yIds.forEach(k => { rec.zoomed[k] = { min: chart.scales[k].min, max: chart.scales[k].max }; });

    // What is actually IN that window, per y axis, so the axis can be checked
    // against the data rather than against itself.
    rec.data = {};
    chart.data.datasets.forEach((ds, i) => {
      if (!chart.isDatasetVisible(i)) return;
      // A series marked noAutoFit is one the tool deliberately lets run off
      // the top — a simulated band's best decile, say — and says so in the
      // chart's own subtitle. It is not the axis's to hold.
      if (ds.noAutoFit) return;
      const ax = ds.yAxisID || 'y';
      const d = rec.data[ax] || (rec.data[ax] = { winMin: null, winMax: null, allMax: null, allMin: null });
      (ds.data || []).forEach((p, k) => {
        let x = k, y = p;
        if (p && typeof p === 'object') { x = typeof p.x === 'number' ? p.x : k; y = p.y; }
        if (typeof y !== 'number' || !isFinite(y)) return;
        if (d.allMax === null || y > d.allMax) d.allMax = y;
        if (d.allMin === null || y < d.allMin) d.allMin = y;
        if (x < wMin || x > wMax) return;
        if (d.winMax === null || y > d.winMax) d.winMax = y;
        if (d.winMin === null || y < d.winMin) d.winMin = y;
      });
    });
    rec.stacked = {};
    yIds.forEach(k => { rec.stacked[k] = !!chart.options.scales[k].stacked; });
    chart.resetZoom();
    out.push(rec);
  }
  return out;
};

/* ── What each page has to show before it can be checked ─────────────────── */
const PAGES = [
  {
    name: 'financialfreedom',
    url: '/financialfreedom/',
    charts: ['ffChart', 'ddChart'],
    async prep(page) {
      await page.click('#simBtn');
      await page.waitForFunction(() => !!window.Chart.getChart(document.getElementById('ffChart')));
    },
  },
  {
    name: 'borrowingcapacity',
    url: '/borrowingcapacity/',
    charts: ['chartCanvas'],
  },
  {
    name: 'financingvscash',
    url: '/financingvscash/',
    charts: ['chartCanvas'],
  },
  {
    name: 'pisahvsgabung',
    url: '/pisahvsgabung/',
    charts: ['chartCanvas', 'chartCanvas2'],
  },
  {
    name: 'rentvsownhouse',
    url: '/rentvsownhouse/',
    charts: ['chartCanvas'],
  },
  {
    name: 'dcasimulator',
    url: '/dcasimulator/',
    charts: ['priceCanvas', 'equityCanvas'],
    async prep(page) {
      // Load one ticker (the Worker is stubbed above), then run the default
      // scenarios the page seeds against it.
      await page.fill('#tickerPoolInput', 'TEST');
      await page.click('#loadTickersBtn');
      await page.waitForTimeout(1200);
      await page.click('.ctrl-tab[data-tab="securities"]');
      await page.click('#simBtn');
      await page.waitForFunction(
        () => !!window.Chart.getChart(document.getElementById('equityCanvas')), null, { timeout: 60000 });
    },
  },
  {
    name: 'dcasimulator/portfolio',
    url: '/dcasimulator/portfolio/',
    charts: ['valueCanvas', 'compCanvas', 'priceCanvas'],
    async prep(page) {
      await page.fill('#tickerPoolInput', 'TEST');
      await page.click('#loadTickersBtn');
      await page.waitForTimeout(1200);
      await page.click('.ctrl-tab[data-tab="portfolios"]');
      await page.click('#simBtn');
      await page.waitForFunction(
        () => !!window.Chart.getChart(document.getElementById('valueCanvas')), null, { timeout: 60000 });
      // The per-portfolio breakdown charts are drawn under the detail section.
      await page.waitForFunction(
        () => !!window.Chart.getChart(document.getElementById('compCanvas')), null, { timeout: 60000 });
    },
  },
  {
    name: 'graphvisualiser',
    url: '/graphvisualiser/',
    plotly: true,
    charts: [],
    async prep(page) {
      await page.setInputFiles('#fileInput', DEMO_CSV);
      await page.waitForTimeout(800);
      await page.click('#renderBtn');
      await page.waitForFunction(() => {
        const d = document.getElementById('plotDiv');
        return d && d.layout && d.layout.xaxis && d.layout.xaxis.range;
      }, null, { timeout: 20000 });
    },
  },
  {
    name: 'rentvsownhouse/sensitivity',
    url: '/rentvsownhouse/sensitivity/',
    charts: ['.cm-canvas'],
    async prep(page) {
      // This tool draws its chart in a popup, one scenario at a time.
      await page.waitForSelector('.show-chart', { timeout: 20000 });
      await page.click('.show-chart');
      await page.waitForFunction(
        () => !!window.Chart.getChart(document.querySelector('.cm-canvas')), null, { timeout: 20000 });
    },
  },
  {
    name: 'rentvsownhouse/sensitivity (all scenarios)',
    url: '/rentvsownhouse/sensitivity/',
    charts: ['.gc-canvas'],
    async prep(page) {
      await page.click('#compareAllBtn');
      await page.waitForFunction(
        () => !!window.Chart.getChart(document.querySelector('.gc-canvas')), null, { timeout: 20000 });
    },
  },
  /* The Indonesian pages are baked from the English ones, so they carry the
     same row and the same charts — and have to prove it. */
  { name: 'pisahvsgabung/id', url: '/pisahvsgabung/id/', charts: ['chartCanvas', 'chartCanvas2'] },
  { name: 'rentvsownhouse/id', url: '/rentvsownhouse/id/', charts: ['chartCanvas'] },
];

/* The Graph Visualiser plots with Plotly, which has no zoom plugin to hand the
   two promises to, so the tool keeps them itself: this drives the same three
   gestures against it and reads the axis ranges back. */
const PLOTLY_PROBE = async () => {
  const div = document.getElementById('plotDiv');
  const ranges = () => ({ x: div.layout.xaxis.range.slice(), y: div.layout.yaxis.range.slice() });
  const settle = () => new Promise(r => setTimeout(r, 250));
  const opened = ranges();
  const span = opened.x[1] - opened.x[0];
  await Plotly.relayout(div, { 'xaxis.range': [opened.x[1] + span, opened.x[1] + span * 2] });
  await settle();
  const pannedPast = ranges();
  await Plotly.relayout(div, { 'xaxis.range': [opened.x[0] - span * 3, opened.x[1] + span * 3] });
  await settle();
  const zoomedOut = ranges();
  const wMin = opened.x[0], wMax = opened.x[0] + span / 5;
  await Plotly.relayout(div, { 'xaxis.range': [wMin, wMax] });
  await settle();
  const zoomedIn = ranges();
  // What is in that window, read off the traces the plot is drawing.
  let winMax = null, allMax = null;
  div.data.forEach(t => (t.y || []).forEach((y, i) => {
    const x = typeof t.x[i] === 'number' ? t.x[i] : i;
    if (typeof y !== 'number') return;
    if (allMax === null || y > allMax) allMax = y;
    if (x < wMin || x > wMax) return;
    if (winMax === null || y > winMax) winMax = y;
  }));
  await Plotly.relayout(div, { 'xaxis.range': opened.x.slice() });
  return { opened, pannedPast, zoomedOut, zoomedIn, winMax, allMax };
};

/* The order every export cluster reads in. A cluster may carry a subset (a
   table has only CSV), but never a different order. */
const ORDER = ['⬇ SVG', '⬇ PNG', '⧉', '⟳', '⬇ CSV'];
const rank = label => {
  const i = ORDER.findIndex(o => label.startsWith(o));
  return i < 0 ? 99 : i;
};

const styles = new Map();   // font/padding seen across the whole site

for (const spec of PAGES) {
  console.log('\n── ' + spec.name + ' ──');
  const { ctx, page } = await newPage({ width: 1440, height: 1000 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(ORIGIN + spec.url, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  if (spec.prep) {
    try { await spec.prep(page); }
    catch (e) { check(spec.name + ': the page reaches a chart', false, e.message); await ctx.close(); continue; }
  }
  await page.waitForTimeout(500);

  /* ── 1. the export row ── */
  const clusters = await page.evaluate(CLUSTER_PROBE);
  check(spec.name + ' C1 every chart and table carries an export cluster', clusters.length > 0,
        clusters.length + ' cluster(s)');

  let orderOk = true, styleOk = true, titleOk = true, rightOk = true, insideOk = true;
  const problems = [];
  for (const c of clusters) {
    const ranks = c.buttons.map(b => rank(b.label));
    if (ranks.some(r => r === 99)) { orderOk = false; problems.push(c.where + ': unknown button ' + c.buttons.map(b => b.label).join('/')); }
    for (let i = 1; i < ranks.length; i++) if (ranks[i] < ranks[i - 1]) { orderOk = false; problems.push(c.where + ': out of order'); }
    for (const b of c.buttons) {
      if (!/btn-secondary/.test(b.cls) || !/btn-sm/.test(b.cls)) { styleOk = false; problems.push(c.where + '/' + b.label + ': ' + b.cls); }
      if (!b.title) { titleOk = false; problems.push(c.where + '/' + b.label + ': no title'); }
      styles.set(b.font + ' | ' + b.pad + ' | ' + b.radius, (styles.get(b.font + ' | ' + b.pad + ' | ' + b.radius) || 0) + 1);
      if (b.right > c.cardRight + 1) { insideOk = false; problems.push(c.where + '/' + b.label + ': overflows the card'); }
    }
    if (c.clusterRight < c.headRight - 2) { rightOk = false; problems.push(c.where + ': cluster not at the right edge (' + c.clusterRight + ' vs ' + c.headRight + ')'); }
  }
  check(spec.name + ' C2 the cluster reads SVG, PNG, copy, reset (CSV for a table)', orderOk, problems.filter(p => /order|unknown/.test(p)).join('; '));
  check(spec.name + ' C3 every button is drawn at the shared size', styleOk, problems.filter(p => /btn-/.test(p)).join('; '));
  check(spec.name + ' C4 and says what it does on hover', titleOk, problems.filter(p => /no title/.test(p)).join('; '));
  check(spec.name + ' C5 the cluster sits hard right of its title row', rightOk, problems.filter(p => /right edge/.test(p)).join('; '));
  check(spec.name + ' C6 and nothing overflows the card', insideOk, problems.filter(p => /overflows/.test(p)).join('; '));

  /* ── 2 and 3. the gestures ── */
  const charts = await page.evaluate(ZOOM_PROBE, spec.charts);
  for (const r of charts) {
    const tag = spec.name + ' [' + r.id + ']';
    if (r.missing) { check(tag + ' Z0 the chart exists', false, 'no Chart.js instance'); continue; }
    check(tag + ' Z1 pan and pinch are bounded by the data',
          !!r.lim && isFinite(r.lim.min) && isFinite(r.lim.max) && r.lim.max > r.lim.min && r.lim.minRange > 0,
          r.lim ? `${r.lim.min}..${r.lim.max}, floor ${Number(r.lim.minRange).toFixed(3)}` : 'no limits');
    if (!r.lim) continue;
    check(tag + ' Z2 the gestures are the shared ones',
          r.panMode === 'x' && r.zoomMode === 'x' && r.wheel && r.pinch,
          `pan ${r.panMode}, zoom ${r.zoomMode}, wheel ${r.wheel}, pinch ${r.pinch}`);
    const eps = 1e-6;
    check(tag + ' Z3 zooming out cannot pull past the data',
          r.pastEnds.min >= r.lim.min - eps && r.pastEnds.max <= r.lim.max + eps,
          `${r.pastEnds.min.toFixed(2)}..${r.pastEnds.max.toFixed(2)} inside ${r.lim.min}..${r.lim.max}`);
    check(tag + ' Z4 nor can panning either way',
          r.pannedLeft.min >= r.lim.min - eps && r.pannedRight.max <= r.lim.max + eps,
          `left ${r.pannedLeft.min.toFixed(2)}, right ${r.pannedRight.max.toFixed(2)}`);
    check(tag + ' Z5 a pinch stops at the floor, not at a sliver',
          r.pinchedIn >= r.lim.minRange - 1e-3,
          `${r.pinchedIn.toFixed(3)} vs floor ${Number(r.lim.minRange).toFixed(3)}`);
    check(tag + ' Z6 the chart carries the shared y-axis refit', r.fitted && r.plugged,
          r.fitted ? 'sharedYFit' : 'no fitter');

    // The refit itself, axis by axis: nothing in the window may be cut off,
    // and where the window is materially smaller than the whole series the
    // axis has to have come down to it.
    for (const ax of Object.keys(r.zoomed)) {
      const d = r.data[ax];
      if (!d || d.winMax === null) continue;                 // nothing on this axis in the window
      if (r.stacked[ax]) continue;                           // sized by sums, checked by eye
      const z = r.zoomed[ax], f = r.full[ax];
      const pad = Math.max((d.winMax - d.winMin) * 0.25, Math.abs(d.winMax) * 0.05, 1e-9);
      check(`${tag} Z7 ${ax}: the window's own data fits inside the axis`,
            z.max >= d.winMax - 1e-6 && z.min <= d.winMin + 1e-6,
            `axis ${z.min.toFixed(0)}..${z.max.toFixed(0)} holds data ${d.winMin.toFixed(0)}..${d.winMax.toFixed(0)}`);
      const worthIt = d.allMax !== null && d.winMax < d.allMax * 0.6;
      if (worthIt) {
        check(`${tag} Z8 ${ax}: and comes down to it instead of keeping the whole-run scale`,
              z.max < f.max - 1e-6 && z.max <= d.winMax + pad * 4,
              `zoomed max ${z.max.toFixed(0)} vs whole run ${f.max.toFixed(0)} (window data ${d.winMax.toFixed(0)})`);
      }
    }
  }

  /* ── a Plotly plot keeps the same promises by hand ── */
  if (spec.plotly) {
    const r = await page.evaluate(PLOTLY_PROBE);
    const eps = 1e-6;
    const tag = spec.name + ' [plotDiv]';
    check(tag + ' Z3 zooming out cannot pull past the data',
          r.zoomedOut.x[0] >= r.opened.x[0] - eps && r.zoomedOut.x[1] <= r.opened.x[1] + eps,
          `${r.zoomedOut.x[0].toFixed(1)}..${r.zoomedOut.x[1].toFixed(1)} inside ${r.opened.x[0]}..${r.opened.x[1]}`);
    check(tag + ' Z4 nor can panning off the end',
          r.pannedPast.x[1] <= r.opened.x[1] + eps && r.pannedPast.x[0] >= r.opened.x[0] - eps,
          `${r.pannedPast.x[0].toFixed(1)}..${r.pannedPast.x[1].toFixed(1)}`);
    check(tag + ' Z7 the window\u2019s own data fits inside the axis',
          r.winMax !== null && r.zoomedIn.y[1] >= r.winMax - eps,
          `axis top ${r.zoomedIn.y[1].toFixed(2)} vs window data ${Number(r.winMax).toFixed(2)}`);
    check(tag + ' Z8 and comes down to it instead of keeping the whole-run scale',
          r.winMax !== null && r.allMax !== null && r.winMax < r.allMax * 0.6 &&
          r.zoomedIn.y[1] < r.opened.y[1] - eps,
          `zoomed top ${r.zoomedIn.y[1].toFixed(2)} vs whole run ${r.opened.y[1].toFixed(2)}`);
  }

  /* ── the phone ── */
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const mob = await page.evaluate(CLUSTER_PROBE);
  let fullWidth = true, fits = true;
  const mProblems = [];
  for (const c of mob) {
    if (c.clusterWidth < c.headWidth - 4) { fullWidth = false; mProblems.push(c.where + ': ' + c.clusterWidth + '/' + c.headWidth); }
    for (const b of c.buttons) if (b.right > c.cardRight + 1) { fits = false; mProblems.push(c.where + '/' + b.label + ' overflows'); }
  }
  check(spec.name + ' M1 on a phone the cluster takes the full width', fullWidth, mProblems.filter(p => !/overflows/.test(p)).join('; '));
  check(spec.name + ' M2 and every button stays inside the card', fits, mProblems.filter(p => /overflows/.test(p)).join('; '));

  check(spec.name + ' E no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

/* One size for the whole site: every export button on every page has to have
   come back with the same font, padding and corner. */
console.log('\n── across the site ──');
check('S1 every export button is drawn identically everywhere', styles.size === 1,
      [...styles.entries()].map(([k, n]) => `${k} ×${n}`).join('  |  '));

await browser.close();
server.close();
console.log(`\nchart check: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
