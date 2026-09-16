// Abbreviation layer — site-wide check.
//
// Loads every shipped page in headless Chromium (CDN libraries are stubbed out,
// so this runs offline) and checks the SharedAbbr decoration on the real DOM:
//
//   - no page errors once the layer is live;
//   - decoration never lands in a skipped region (links, buttons, form
//     controls, code, an element that already owns a data-tip, or anything
//     marked data-no-abbr);
//   - every decorated term carries a definition, and reads the same in the
//     page's own language;
//   - the visible text is byte-for-byte unchanged by the decoration, and
//     re-running it changes nothing (no nesting, no drift);
//   - hovering a term opens the shared tooltip with that definition;
//   - the dashed underline resolves to a real colour in dark AND light, and
//     the two themes differ.
//
// It also prints how often each term is decorated per page, which is the
// clutter budget: a term that fires dozens of times on one page is a sign the
// region should be marked data-no-abbr rather than underlined.
//
// Run: node _ref/abbr-check.mjs
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import { readdirSync, statSync, createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, extname, normalize } from 'node:path';

const { chromium } = pw;
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

/* Every tool page, i.e. every index.html below the root except the landing
   page (which carries its own inline styles and no shared layer). */
function pages(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') || name === 'node_modules' || name === '_ref' ||
        name === 'logos' || name === 'assets' || name === '_audit' || name === 'audit') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) pages(p, out);
    else if (name === 'index.html' && dir !== ROOT) out.push(p);
  }
  return out;
}

const SKIP_SELECTOR = 'a,button,input,select,textarea,option,code,pre,kbd,samp,h1,.logo,.header-title,[class*="btn"],[contenteditable],[data-no-abbr],[data-tip]';

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  console.log((ok ? '  PASS  ' : '✗ FAIL  ') + name + (detail ? '  — ' + detail : ''));
  ok ? pass++ : fail++;
};

/* Serve the repo the way the site is served, so paths (and therefore the
   glossary scope a page resolves to) are the real ones. */
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript',
               '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml',
               '.png':'image/png', '.jpg':'image/jpeg', '.xml':'application/xml', '.txt':'text/plain' };
const server = createServer((req, res) => {
  let rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  let file = join(ROOT, rel);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const urlFor = file => ORIGIN + '/' + relative(ROOT, file).split('\\').join('/');

const browser = await chromium.launch();
const ctx = await browser.newContext();
// No network here, so every CDN library is replaced by a self-returning stub:
// the tools still run their render paths instead of dying on a missing global.
await ctx.route('**', route => {
  const url = route.request().url();
  if (url.startsWith(ORIGIN)) return route.continue();
  const type = route.request().resourceType();
  if (type === 'script') return route.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
  if (type === 'stylesheet') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
  return route.abort();
});
await ctx.addInitScript(() => {
  const stub = name => {
    const target = function () {};
    const proxy = new Proxy(target, {
      get: (t, p) => (p === Symbol.toPrimitive ? () => name
                    : p === 'then' ? undefined
                    : p === 'toString' ? () => name : proxy),
      apply: () => proxy,
      construct: () => proxy,
      has: () => true
    });
    return proxy;
  };
  for (const name of ['Chart', 'd3', 'Plotly', 'XLSX', 'marked', 'DOMPurify', 'hljs',
                      'mermaid', 'katex', 'renderMathInElement', 'html2canvas', 'Papa',
                      'THREE', 'ace', 'Hammer', 'ChartZoom', 'gtag'])
    if (!(name in window)) window[name] = stub(name);
});

const totals = new Map();

for (const file of pages(ROOT)) {
  const rel = relative(ROOT, file);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(urlFor(file), { waitUntil: 'load' });
  await page.waitForTimeout(250);

  const report = await page.evaluate((skipSel) => {
    const out = { has: typeof window.SharedAbbr !== 'undefined', counts: {}, bad: [], missing: 0, nested: 0 };
    if (!out.has) return out;
    const all = [...document.querySelectorAll('abbr.abbr')];
    out.total = all.length;
    for (const el of all) {
      const term = el.getAttribute('data-abbr');
      out.counts[term] = (out.counts[term] || 0) + 1;
      if (!el.getAttribute('data-tip')) out.missing++;
      if (el.parentElement && el.parentElement.closest(skipSel)) out.bad.push(term + ' in <' + el.parentElement.tagName.toLowerCase() + '>');
      if (el.querySelector('abbr')) out.nested++;
    }
    // Text must survive decoration untouched, and so must the layout: the
    // underline is drawn inside the existing box, nothing reflows.
    const withAbbr = document.body.textContent;
    const boxes = all.map(el => {
      let host = el.parentElement;
      while (host && host.classList.contains('abbr-run')) host = host.parentElement;   // the wrapper goes too
      const r = host.getBoundingClientRect();
      return { host, w: r.width, h: r.height };
    });
    window.SharedAbbr.undecorate(document.body);
    out.textStable = withAbbr === document.body.textContent;
    out.shifted = boxes.filter(b => {
      const r = b.host.getBoundingClientRect();
      return Math.abs(r.width - b.w) > 0.5 || Math.abs(r.height - b.h) > 0.5;
    }).length;
    out.strippedAll = document.querySelectorAll('abbr.abbr').length === 0;
    // Re-decorating must reproduce exactly the same count, with no nesting.
    window.SharedAbbr.refresh();
    out.rerun = document.querySelectorAll('abbr.abbr').length;
    out.rerunNested = document.querySelectorAll('abbr.abbr abbr').length;
    out.lang = document.documentElement.lang || '';
    out.terms = window.SharedAbbr.terms().length;
    return out;
  }, SKIP_SELECTOR);

  check(rel + ' — loads clean', errors.length === 0, errors[0]);
  check(rel + ' — shared layer present', report.has === true);
  if (report.has) {
    for (const [t, n] of Object.entries(report.counts)) totals.set(t, (totals.get(t) || 0) + n);
    check(rel + ' — every term defined', report.missing === 0, report.missing + ' without a definition');
    check(rel + ' — nothing decorated in a skipped region', report.bad.length === 0, report.bad.slice(0, 3).join('; '));
    check(rel + ' — no nesting', report.nested === 0 && report.rerunNested === 0);
    check(rel + ' — visible text unchanged', report.textStable === true);
    check(rel + ' — layout unchanged', report.shifted === 0, report.shifted + ' element(s) resized');
    check(rel + ' — undecorate is complete', report.strippedAll === true);
    check(rel + ' — decoration is idempotent', report.rerun === report.total, report.total + ' then ' + report.rerun);
    const counts = Object.entries(report.counts).sort((a, b) => b[1] - a[1]);
    console.log('        ' + (counts.length
      ? report.total + ' terms: ' + counts.map(([t, n]) => t + (n > 1 ? '×' + n : '')).join(', ')
      : 'no glossary terms on this page') + (report.lang ? '  [lang=' + report.lang + ']' : ''));
  }
  await page.close();
}

/* ── Behaviour, on the page with the densest glossary ── */
const page = await ctx.newPage();
await page.goto(ORIGIN + '/borrowingcapacity/', { waitUntil: 'load' });
await page.waitForTimeout(250);

const hover = await page.evaluate(async () => {
  const el = [...document.querySelectorAll('abbr.abbr')].find(a => a.getAttribute('data-abbr') === 'LVR');
  if (!el) return { found: false };
  el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  await new Promise(r => setTimeout(r, 50));
  const tip = document.getElementById('globalTooltip');
  const shown = tip && tip.classList.contains('visible') ? tip.querySelector('.tt-text').innerHTML : '';
  el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
  await new Promise(r => setTimeout(r, 50));
  return { found: true, shown, hidden: !tip.classList.contains('visible') };
});
check('hover opens the shared tooltip', hover.found && /Loan-to-Value Ratio/.test(hover.shown), hover.shown);
check('mouseout closes it', hover.hidden === true);

const styles = await page.evaluate(async () => {
  const el = document.querySelector('abbr.abbr');
  // The underline colour transitions, so settle before reading it.
  const read = async () => {
    await new Promise(r => setTimeout(r, 300));
    const cs = getComputedStyle(el);
    return { style: cs.textDecorationStyle, line: cs.textDecorationLine, color: cs.textDecorationColor, cursor: cs.cursor };
  };
  document.body.classList.remove('light');
  const dark = await read();
  document.body.classList.add('light');
  const light = await read();
  document.body.classList.remove('light');
  return { dark, light };
});
check('dashed underline in dark', styles.dark.style === 'dashed' && styles.dark.line.includes('underline'), JSON.stringify(styles.dark));
check('dashed underline in light', styles.light.style === 'dashed' && styles.light.line.includes('underline'), JSON.stringify(styles.light));
check('underline colour is theme-aware', styles.dark.color !== styles.light.color, styles.dark.color + ' vs ' + styles.light.color);
check('underline colour is soft, not solid text', !/^rgba?\(\s*(255,\s*255,\s*255|0,\s*0,\s*0)\s*\)$/.test(styles.dark.color));
check('cursor is help', styles.dark.cursor === 'help');

/* Terms rendered after load (a tool re-rendering its results) get decorated. */
const dynamic = await page.evaluate(async () => {
  const host = document.createElement('div');
  host.className = 'field-label';
  document.body.appendChild(host);
  host.textContent = 'Maximum LVR and the DTI cap';
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const out = [...host.querySelectorAll('abbr.abbr')].map(a => a.getAttribute('data-abbr'));
  const text = host.textContent;
  host.remove();
  return { out, text };
});
check('new DOM is decorated automatically', dynamic.out.join(',') === 'LVR,DTI', dynamic.out.join(','));
check('dynamic text is unchanged', dynamic.text === 'Maximum LVR and the DTI cap', dynamic.text);

/* A term inside user content stays plain. */
const optOut = await page.evaluate(async () => {
  const host = document.createElement('div');
  host.setAttribute('data-no-abbr', '');
  document.body.appendChild(host);
  host.textContent = 'LVR DTI HEM from an uploaded file';
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const n = host.querySelectorAll('abbr.abbr').length;
  host.remove();
  return n;
});
check('data-no-abbr region stays plain', optOut === 0, optOut + ' decorated');

/* Boundary rules: tickers, file suffixes and longer words must not match. */
const boundaries = await page.evaluate(async () => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  host.textContent = 'AAA.LVR file.CSV LVRX xLVR CSVs and LVR.';
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const out = [...host.querySelectorAll('abbr.abbr')].map(a => a.textContent);
  host.remove();
  return out;
});
check('boundaries respected', JSON.stringify(boundaries) === JSON.stringify(['CSVs', 'LVR']), JSON.stringify(boundaries));

/* The documented escape hatches: a page can borrow another tool's scope, and a
   tool can register terms of its own at runtime. */
const api = await page.evaluate(async () => {
  const out = {};
  window.SharedAbbr.add({ WACC: ['Weighted Average Cost of Capital', 'the blended cost of debt and equity'] });
  const host = document.createElement('div');
  document.body.appendChild(host);
  host.textContent = 'The WACC sits above it';
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  out.added = host.querySelector('abbr.abbr') ? host.querySelector('abbr.abbr').getAttribute('data-abbr') : '';
  host.remove();

  document.body.setAttribute('data-abbr-scope', 'wemconstraint-checker');
  window.SharedAbbr.refresh();
  out.scoped = window.SharedAbbr.define('RHS').includes('Right-Hand Side');
  out.scopedOut = window.SharedAbbr.define('LVR') === '';
  document.body.removeAttribute('data-abbr-scope');
  window.SharedAbbr.refresh();
  return out;
});
check('SharedAbbr.add registers a term', api.added === 'WACC', api.added);
check('data-abbr-scope switches the glossary', api.scoped === true && api.scopedOut === true, JSON.stringify(api));

await page.close();

/* Indonesian pages must read their own definitions. */
const idPage = await ctx.newPage();
await idPage.goto(ORIGIN + '/pisahvsgabung/id/', { waitUntil: 'load' });
await idPage.waitForTimeout(250);
const idTip = await idPage.evaluate(() => {
  const el = [...document.querySelectorAll('abbr.abbr')].find(a => a.getAttribute('data-abbr') === 'PTKP');
  return el ? el.getAttribute('data-tip') : '';
});
check('Indonesian page uses Indonesian definitions', /penghasilan setahun/.test(idTip), idTip);
await idPage.close();

await browser.close();
server.close();

console.log('\n── Decorations across the site ──');
for (const [t, n] of [...totals].sort((a, b) => b[1] - a[1])) console.log('  ' + String(n).padStart(4) + '  ' + t);
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
