// Finance forms — site-wide check of the rules every finance tool keeps.
//
// Drives the real finance pages in headless Chromium (the real Chart.js from
// _ref/.libcache/, synthetic market data for the DCA tools), opens every input
// tab and sub-tab, and holds what is on screen to seven promises:
//
//   1. A FIELD STATES ITS UNIT. Every number a reader types or drags shows its
//      unit at the number: a currency prefix, a suffix (%, %/yr, yrs, /mo,
//      days, ×), a period select beside it, a unit word in a sentence-style
//      row ("From age 28 to 33"), or, on a slider, a readout that carries one.
//      A count or an identifier with no unit says so with data-unitless.
//   2. A FIELD STATES ITS LIMITS, AND THE FORM ENFORCES THEM. Every typed
//      number declares min and max (native, or data-min / data-max on a money
//      field), and a value typed past the max is pulled back on change.
//      data-unbounded opts a field out (a threshold in the price's own units).
//   3. A SLIDER NAMES BOTH ENDS, under it.
//   4. AN AXIS NAMES ITS UNIT. Every y axis is titled with one ($, Rp, %,
//      today's money, base 100, or a unit in brackets); indicator panes
//      (RSI, MACD, ADX) are unitless by nature and excepted. Every x axis is
//      titled.
//   5. NO EM-DASH IN PAGE TEXT, tips or placeholders. A lone "—" marking an
//      empty cell is fine.
//   6. A NEUTRAL SERIES IS NEVER RED. A series drawn in the theme's red has to
//      be one red means: money out, a loss, a requirement to clear. An option
//      a reader is choosing between that lands on red fails.
//   7. THE ANSWER LEADS AND THE CAVEATS CLOSE. A tool that shows results on
//      arrival opens them with its one-sentence answer, and every tool closes
//      with a What this assumes card.
//
// ONLY=<path> runs one page, e.g. ONLY=financialfreedom.
// Run: node _ref/form-check.mjs
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize, basename } from 'node:path';

const { chromium } = pw;
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const LIBS = join(HERE, '.libcache');
const LIB_FILES = ['chart.umd.min.js', 'chartjs-plugin-zoom.min.js', 'hammer.min.js'];
for (const f of LIB_FILES) {
  if (!existsSync(join(LIBS, f))) {
    console.error('Chart libraries are not cached in _ref/.libcache/. Run node _ref/chart-check.mjs once with network access.');
    process.exit(2);
  }
}

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  console.log((ok ? '  PASS  ' : '✗ FAIL  ') + name + (detail ? '  — ' + detail : ''));
  ok ? pass++ : fail++;
};

/* The pages, and what each one shows before a reader has typed anything. */
const PAGES = [
  { path: 'rentvsownhouse' },
  { path: 'rentvsownhouse/id' },
  // A sweep of the main page's model, not a tool of its own: its answer and
  // caveats are the main page's.
  { path: 'rentvsownhouse/sensitivity', answer: null, assumes: false },
  { path: 'pisahvsgabung' },
  { path: 'pisahvsgabung/id' },
  { path: 'borrowingcapacity' },
  { path: 'financingvscash' },
  { path: 'financialfreedom' },
  { path: 'dcasimulator' },
  { path: 'dcasimulator/portfolio' },
  { path: 'valuateeverything' },
  // No results until two cities are picked, so it picks two.
  { path: 'costofliving-comparator', answer: '#ss_summary', setup: async page => {
      await page.evaluate(() => {
        const pick = (id, q) => {
          const i = document.querySelector('#' + id + ' input'); i.value = q;
          i.dispatchEvent(new Event('input', { bubbles: true }));
          const o = document.querySelector('#' + id + ' .city-opt');
          if (o) o.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        };
        pick('fromPicker', 'Jakarta'); pick('toPicker', 'Perth');
      });
      await page.waitForTimeout(400);
      await page.evaluate(() => {
        const f = document.getElementById('ss_fs');
        if (f) { f.value = '25,000,000'; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('blur')); }
      });
      await page.waitForTimeout(300);
  } },
].filter(p => !process.env.ONLY || p.path === process.env.ONLY);

/* ── The site, served as in production ───────────────────────────────────── */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
               '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/json' };
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

function synthSeries(days = 900, seed = 7) {
  const dates = [], prices = [];
  let p = 100, s = seed, d = new Date(Date.UTC(2020, 0, 1));
  for (let i = 0; i < days; i++) {
    s = (s * 1103515245 + 12345) % 2147483648;
    p = Math.max(1, p * (1 + 0.0006 + (s / 2147483648 - 0.5) * 0.02));
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) { i--; continue; }
    dates.push(d.toISOString().slice(0, 10)); prices.push(+p.toFixed(4));
  }
  return { dates, prices };
}

const browser = await chromium.launch();
async function openPage(path) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  await ctx.route('**', async route => {
    const url = route.request().url();
    if (url.startsWith(ORIGIN)) return route.continue();
    const lib = LIB_FILES.find(f => url.endsWith(f));
    if (lib) return route.fulfill({ status: 200, contentType: 'text/javascript', body: readFileSync(join(LIBS, lib), 'utf8') });
    if (url.includes('yfinance') || url.includes('workers.dev')) {
      const tickers = (new URL(url).searchParams.get('tickers') || 'TEST').split(',');
      const results = {};
      tickers.forEach((t, i) => { const s = synthSeries(900, 7 + i * 13); results[t] = { dates: s.dates, prices: s.prices, source: 'test', kind: 'adjusted' }; });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results }) });
    }
    const type = route.request().resourceType();
    if (type === 'script') return route.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
    if (type === 'stylesheet') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return route.abort();
  });
  // Every tour reads "<tool>-tour-v<N>-seen"; a returning visitor has seen it.
  await ctx.addInitScript(() => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (k) { return /-tour-v\d+-seen$|-seen$/.test(k) ? '1' : get.call(this, k); };
  });
  const page = await ctx.newPage();
  page.__errors = [];
  page.on('pageerror', e => page.__errors.push(e.message));
  await page.goto(ORIGIN + '/' + path + '/', { waitUntil: 'load' });
  await page.waitForTimeout(1800);
  return { ctx, page };
}

/* ── In-page probes ──────────────────────────────────────────────────────── */

// Every number field on screen now, with what it states about itself. Fields
// already seen (on an earlier tab) are skipped by a mark.
const FIELD_PROBE = () => {
  const shown = el => !!el && el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden';
  const txt = el => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const UNIT_WORD = /(%|×|\bx\b|\byrs?\b|\byears?\b|\bmonths?\b|\bweeks?\b|\bdays?\b|\bage\b|\/mo\b|\/yr\b|\/wk\b|[$€£¥₩฿]|\bRp\b|\bRM\b|\bpaths\b|\bpoints\b|\bpayments?\b|\bper\b|\ba (week|month|year)\b|[A-Z]{3}\b)/i;
  const sel = 'input[type=number],input[type=range],input.currency-input,input.money-input,input.fmt-num,' +
              'input[inputmode=decimal],input[inputmode=numeric]';
  const out = [];
  document.querySelectorAll(sel).forEach(el => {
    if (el.__formSeen || !shown(el) || el.readOnly || el.disabled) return;
    if (el.classList.contains('slider-val-edit') || el.type === 'date' || el.type === 'checkbox') return;
    if (el.closest('[class*="tour-"]')) return;
    el.__formSeen = true;
    const wrap = el.closest('.currency-wrap, .input-wrap');
    const affix = wrap ? [...wrap.querySelectorAll('.prefix,.suffix,.curr-tag,.per-tag')]
      .filter(a => !a.hidden && getComputedStyle(a).display !== 'none' && txt(a)).map(txt).join(' ') : '';
    const row = el.closest('.inline-row, .stage-ages, .stage-grow, .param-row, .sec-row, .field-row, .slider-block, .slider-head, .sc-field, .retire-slider, td, .add-sec-row, .row');
    const periodSel = row ? [...row.querySelectorAll('select')].some(shown) : false;
    // A label inside the same small row, read as a sentence ("From age … to").
    const rowLabels = row ? [...row.querySelectorAll('.stage-lbl, label, .param-lbl')].map(txt).join(' ') : '';
    let readout = '';
    if (el.type === 'range') {
      const id = el.getAttribute('data-readout');
      const box = id ? document.getElementById(id)
        : (el.closest('.slider-block, .field-row, .sc-field, .slider-wrap, .retire-slider') || el.parentElement).querySelector('.slider-value, .slider-val');
      readout = txt(box);
    }
    const ends = el.type === 'range'
      ? (el.nextElementSibling && /range-ends|slider-scale/.test(el.nextElementSibling.className || '') ? txt(el.nextElementSibling) : '')
      : '';
    const label = txt((el.closest('.field-row, .slider-block, .param-row, .sec-row, .sc-field, td') || {}).querySelector
      ? (el.closest('.field-row, .slider-block, .param-row, .sec-row, .sc-field') || el.parentElement).querySelector('.field-label, .slider-label, label') : null);
    const unitless = !!el.closest('[data-unitless]');
    const own = el.getAttribute('data-unit') || '';
    const unit = unitless ? 'unitless'
      : own ? own
      : affix ? affix
      : periodSel ? 'period select'
      : (el.type === 'range' && UNIT_WORD.test(readout.replace(/[\d.,\s−+-]/g, ' '))) ? 'readout ' + readout
      : UNIT_WORD.test(rowLabels) ? 'row words: ' + rowLabels.slice(0, 30)
      : '';
    const num = n => n == null || n === '' ? null : n;
    out.push({
      key: el.id || el.className.split(' ').slice(-1)[0] || el.name || '?',
      label: label.slice(0, 40), type: el.type, unit,
      min: num(el.getAttribute('data-min')) ?? (el.type === 'number' || el.type === 'range' ? num(el.getAttribute('min')) : null),
      max: num(el.getAttribute('data-max')) ?? (el.type === 'number' || el.type === 'range' ? num(el.getAttribute('max')) : null),
      unbounded: !!el.closest('[data-unbounded]'), ends, id: el.id || null,
    });
  });
  return out;
};

// Click every tab and sub-tab in turn, collecting the fields each one shows.
async function allFields(page) {
  const fields = await page.evaluate(FIELD_PROBE);
  const tabs = await page.evaluate(() => [...document.querySelectorAll('.ctrl-tab, .sub-tab')].map((t, i) => i));
  for (const i of tabs) {
    await page.evaluate(k => { const t = document.querySelectorAll('.ctrl-tab, .sub-tab')[k]; if (t && t.offsetParent !== null) t.click(); }, i);
    await page.waitForTimeout(120);
    fields.push(...await page.evaluate(FIELD_PROBE));
    // A tab can hold sub-tabs: open each of those under it too.
    const subs = await page.evaluate(() => [...document.querySelectorAll('.sub-tab')].filter(t => t.offsetParent !== null).length);
    for (let j = 0; j < subs; j++) {
      await page.evaluate(k => { const t = [...document.querySelectorAll('.sub-tab')].filter(x => x.offsetParent !== null)[k]; if (t) t.click(); }, j);
      await page.waitForTimeout(100);
      fields.push(...await page.evaluate(FIELD_PROBE));
    }
  }
  return fields;
}

const CHART_PROBE = () => {
  const out = [];
  const C = window.Chart;
  if (!C || !C.instances) return out;
  // Colours read back through a canvas, so "#E63939", "rgb(230,57,57)" and a
  // token all compare as the same three numbers.
  const cx = document.createElement('canvas').getContext('2d');
  const rgb = c => { if (typeof c !== 'string' || !c || c === 'transparent') return null; cx.fillStyle = '#000'; cx.fillStyle = c;
    const v = cx.fillStyle; const m = v.match(/^#([0-9a-f]{6})$/i); if (m) { const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    const r = v.match(/rgba?\(([^)]+)\)/); if (r) { const p = r[1].split(',').map(Number); return p[3] === 0 ? null : p.slice(0, 3); } return null; };
  const cs = getComputedStyle(document.body);
  const reds = ['--line-b', '--negative', '--negative-em', '--data-neg-em', '--data-neg']
    .map(v => rgb(cs.getPropertyValue(v).trim())).concat(['#ef4444', '#ef5350', '#E63939', '#FF8B8B', '#dc2626'].map(rgb)).filter(Boolean);
  const isRed = c => { const v = rgb(c); return !!v && reds.some(r => Math.abs(r[0] - v[0]) + Math.abs(r[1] - v[1]) + Math.abs(r[2] - v[2]) < 24); };
  Object.values(C.instances).forEach(ch => {
    const canvas = ch.canvas;
    const scales = Object.entries((ch.options && ch.options.scales) || {}).map(([id, s]) => ({
      id, axis: (ch.scales[id] && ch.scales[id].axis) || (id.startsWith('x') ? 'x' : 'y'),
      display: s.display !== false, title: s.title && s.title.display ? String(s.title.text || '') : '' }));
    const red = (ch.data.datasets || []).filter(d => isRed(d.borderColor) || (typeof d.backgroundColor === 'string' && isRed(d.backgroundColor) && d.fill !== false))
      .map(d => d.label || '(unlabelled)');
    out.push({ canvas: canvas.id || '(no id)', type: ch.config.type, scales, red });
  });
  return out;
};

const TEXT_PROBE = () => {
  const hits = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const v = n.nodeValue;
    if (!v.includes('—') || v.trim() === '—') continue;
    if (n.parentElement.closest('script,style')) continue;
    hits.push(v.replace(/\s+/g, ' ').trim().slice(0, 70));
  }
  document.querySelectorAll('[data-tip],[placeholder],[title],[aria-label]').forEach(el => {
    ['data-tip', 'placeholder', 'title', 'aria-label'].forEach(a => {
      const v = el.getAttribute(a);
      if (v && v.includes('—') && v.trim() !== '—') hits.push('[' + a + '] ' + v.slice(0, 60));
    });
  });
  return [...new Set(hits)];
};

/* ── Run ─────────────────────────────────────────────────────────────────── */
const AXIS_UNIT = /[$€£¥₩฿]|\bRp\b|\bRM\b|%|money|base 100|\(.+\)|\bdollars?\b/i;
const OSC = /^yOsc|osc|Gap$/i;
const DIRECTION = /spend|spending|expense|cost|pot needed|need|loss|shortfall|drawn|withdraw|down|negative|deficit|debt|interest|fee|tax|outflow|worst|deposit/i;

for (const P of PAGES) {
  console.log('\n── ' + P.path + ' ──');
  const { ctx, page } = await openPage(P.path);
  if (P.setup) await P.setup(page);

  const fields = await allFields(page);
  const noUnit = fields.filter(f => !f.unit);
  check(`${P.path} 1 every number field states its unit`, noUnit.length === 0,
    noUnit.length ? noUnit.map(f => `${f.key}${f.label ? ' (' + f.label + ')' : ''}`).join(', ') : `${fields.length} fields`);
  const typed = fields.filter(f => f.type !== 'range');
  const noLimit = typed.filter(f => !f.unbounded && (f.min == null || f.max == null));
  check(`${P.path} 2 every typed number declares its min and max`, noLimit.length === 0,
    noLimit.length ? noLimit.map(f => `${f.key}${f.label ? ' (' + f.label + ')' : ''} [${f.min ?? '-'}..${f.max ?? '-'}]`).join(', ') : `${typed.length} typed fields`);
  const sliders = fields.filter(f => f.type === 'range');
  const noEnds = sliders.filter(f => !f.ends);
  check(`${P.path} 3 every slider names both ends`, noEnds.length === 0,
    noEnds.length ? noEnds.map(f => f.key).join(', ') : `${sliders.length} sliders`);

  const charts = await page.evaluate(CHART_PROBE);
  const axisBad = [];
  charts.forEach(c => c.scales.forEach(s => {
    if (!s.display || OSC.test(s.id) || c.type === 'pie' || c.type === 'doughnut') return;
    if (s.axis === 'y' && !AXIS_UNIT.test(s.title)) axisBad.push(`${c.canvas}.${s.id} "${s.title}"`);
    if (s.axis === 'x' && !s.title) axisBad.push(`${c.canvas}.${s.id} untitled`);
  }));
  check(`${P.path} 4 every chart axis is titled, every y axis with a unit`, axisBad.length === 0,
    axisBad.length ? axisBad.join(', ') : `${charts.length} charts`);
  const redBad = [];
  charts.forEach(c => c.red.forEach(l => { if (!DIRECTION.test(l)) redBad.push(`${c.canvas}: ${l}`); }));
  check(`${P.path} 6 red is only drawn for money out, a loss or a bar to clear`, redBad.length === 0,
    redBad.length ? redBad.join(', ') : (charts.flatMap(c => c.red).join(', ') || 'no red series'));

  const dashes = await page.evaluate(TEXT_PROBE);
  check(`${P.path} 5 no em-dash in page text, tips or placeholders`, dashes.length === 0, dashes.slice(0, 4).join(' | ') || 'clean');

  const answerSel = P.answer === undefined ? '.verdict' : P.answer;
  if (answerSel) {
    const a = await page.evaluate(sel => { const el = document.querySelector(sel);
      return el ? { shown: el.offsetParent !== null && getComputedStyle(el).display !== 'none', text: (el.textContent || '').trim().slice(0, 90),
        firstInMain: (() => { const main = el.closest('main, #analysisArea, .analysis-card'); return !!main; })() } : null; }, answerSel);
    check(`${P.path} 7 the answer is on screen, in one sentence`, !!a && a.shown && a.text.length > 15, a ? a.text : 'missing');
  }
  if (P.assumes !== false) {
    const n = await page.evaluate(() => { const c = document.querySelector('.assumes-card');
      return c && c.offsetParent !== null ? c.querySelectorAll('li').length : -1; });
    check(`${P.path} 7b a What this assumes card closes the page`, n >= 3, n < 0 ? 'missing' : n + ' items');
  }

  // Enforcement, last because it changes the plan: a value typed past a typed
  // field's max is pulled back on change.
  const enforced = await page.evaluate(() => {
    const bad = [], tried = [];
    const shown = el => !!el && el.offsetParent !== null;
    document.querySelectorAll('.ctrl-tab, .sub-tab').forEach(t => { if (shown(t)) { t.click(); } });
    const fields = [...document.querySelectorAll('input[data-max], input[type=number][max]')].filter(el => el.id && !el.readOnly && !el.disabled);
    fields.slice(0, 40).forEach(el => {
      const max = parseFloat(el.getAttribute('data-max') ?? el.getAttribute('max'));
      if (!isFinite(max)) return;
      const was = el.value;
      el.value = String(max * 10 + 7);
      el.dispatchEvent(new Event('change', { bubbles: true }));
      const got = parseFloat(String(el.value).replace(/,/g, '').replace(/−/g, '-'));
      tried.push(el.id);
      if (!(got <= max + 1e-9)) bad.push(`${el.id}: ${el.value} > ${max}`);
      el.value = was;
    });
    return { bad, tried: tried.length };
  });
  check(`${P.path} 2b a value typed past the max is pulled back`, enforced.bad.length === 0,
    enforced.bad.join(', ') || `${enforced.tried} fields tried`);
  check(`${P.path} no page errors`, page.__errors.length === 0, page.__errors.slice(0, 2).join(' | ') || 'clean');
  await ctx.close();
}

await browser.close();
server.close();
console.log(`\nform-check: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
