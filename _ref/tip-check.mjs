// Tooltip layer — site-wide check.
//
// A tooltip is read standing up, mid-decision, in a 270px bubble. So the rule
// across the site is one thought per tip: what the field is, and the one thing
// a reader would otherwise get wrong. Anything longer is a paragraph wearing a
// tooltip's clothes, and nobody reads it.
//
// This loads every shipped page in headless Chromium (CDN libraries are stubbed
// out, so it runs offline) and checks the real DOM:
//
//   - every tip is inside the length budget, measured on rendered text rather
//     than on the markup, so <strong> and <br> are not charged to the author;
//   - no tip is left empty, which is how an unwired dynamic tip shows up;
//   - no em-dash anywhere in tip copy (site-wide house rule);
//   - tips that depend on another control really do follow it: every <select>
//     and every segmented control on the page is driven through all of its
//     values, and the budget is re-checked in each state. A page that changes
//     at least one tip this way is reported as dynamic, which is the pattern a
//     long option list should be using instead of listing every option at once.
//
// It also prints the longest tips per page, which is the budget report: the
// number to watch is the median, not the maximum.
//
// Run: node _ref/tip-check.mjs
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import { readdirSync, statSync, createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, extname, normalize } from 'node:path';

const { chromium } = pw;
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

/* The budget. HARD is a failure: a tip that long is not read. SNUG is the
   number to aim at, and only reported. */
const HARD = 200;
const SNUG = 150;

/* An optional argument narrows the run to the pages whose path contains it,
   which is how you iterate on one tool: node _ref/tip-check.mjs rentvsownhouse */
const ONLY = process.argv[2] || '';

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

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  console.log((ok ? '  PASS  ' : '✗ FAIL  ') + name + (detail ? '  — ' + detail : ''));
  ok ? pass++ : fail++;
};

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

/* Read every tip on the page as the reader gets it: HTML rendered to text, the
   glossary's own abbreviation tips left out (they are generated, and their
   length is the glossary's business, not the page's). */
const READ = () => {
  const plain = html => {
    const d = document.createElement('div');
    d.innerHTML = html.replace(/<br\s*\/?>/gi, ' ');
    return (d.textContent || '').replace(/\s+/g, ' ').trim();
  };
  return [...document.querySelectorAll('[data-tip]')]
    .filter(el => !el.classList.contains('abbr'))
    .map(el => {
      const raw = el.getAttribute('data-tip') || '';
      return {
        raw,
        text: plain(raw),
        where: el.id || (el.className && String(el.className).split(' ')[0]) || el.tagName.toLowerCase(),
        label: (el.closest('.tip-wrap, .field-label, .mode-row, .slider-label, label, h2, .metric') || el)
                 .textContent.replace(/\s+/g, ' ').trim().slice(0, 40)
      };
    });
};

const allLong = [];
let grandTotal = 0, grandChars = 0;

for (const file of pages(ROOT).filter(f => f.includes(ONLY))) {
  const rel = relative(ROOT, file);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(urlFor(file), { waitUntil: 'load' });
  await page.waitForTimeout(250);

  const tips = await page.evaluate(READ);
  if (!tips.length) { await page.close(); continue; }

  /* Drive every control that another tip could depend on, and keep the worst
     state we saw. A dynamic tip is only concise if it is concise in each of
     its states, and it must never come up empty. */
  const states = await page.evaluate(async (readSrc) => {
    const read = eval('(' + readSrc + ')');
    const seen = [];
    const snap = tag => seen.push({ tag, tips: read() });
    snap('load');
    const fire = el => { el.dispatchEvent(new Event('input', {bubbles:true}));
                         el.dispatchEvent(new Event('change', {bubbles:true})); };
    for (const sel of [...document.querySelectorAll('select')].slice(0, 20)) {
      const was = sel.value;
      for (const opt of [...sel.options].slice(0, 12)) {
        if (opt.disabled) continue;
        sel.value = opt.value; fire(sel);
        await new Promise(r => setTimeout(r, 0));
        snap(sel.id + '=' + opt.value);
      }
      sel.value = was; fire(sel);
    }
    for (const g of [...document.querySelectorAll('.seg-group')].slice(0, 12)) {
      const btns = [...g.querySelectorAll('.seg-btn')];
      const was = btns.find(b => b.classList.contains('active'));
      for (const b of btns) {
        b.click();
        await new Promise(r => setTimeout(r, 0));
        snap((g.id || 'seg') + '=' + (b.dataset.val || b.textContent.trim()));
      }
      if (was) was.click();
    }
    return seen;
  }, READ.toString());

  const flat = states.flatMap(s => s.tips.map(t => ({ ...t, state: s.tag })));
  const over  = flat.filter(t => t.text.length > HARD);
  const empty = flat.filter(t => !t.text.length);
  const dash  = flat.filter(t => /—|&mdash;|&#8212;/.test(t.raw));
  const dynamic = new Set(flat.map(t => t.where + '\u0000' + t.text)).size >
                  new Set(flat.map(t => t.where)).size;

  const longest = [...tips].sort((a, b) => b.text.length - a.text.length).slice(0, 3);
  const med = [...tips].map(t => t.text.length).sort((a, b) => a - b)[Math.floor(tips.length / 2)];
  grandTotal += tips.length;
  grandChars += tips.reduce((a, t) => a + t.text.length, 0);
  allLong.push(...tips.filter(t => t.text.length > SNUG).map(t => ({ ...t, page: rel })));

  console.log(`\n${rel}  ${tips.length} tips, median ${med} chars${dynamic ? ', dynamic' : ''}`);
  for (const t of longest) console.log(`        ${String(t.text.length).padStart(3)}  ${t.label || t.where}`);

  check(`${rel} every tip fits the ${HARD}-char budget in every state`,
    over.length === 0,
    over.length ? over.slice(0, 3).map(t => `${t.state} ${t.where} ${t.text.length}: "${t.text.slice(0, 60)}…"`).join(' | ')
                : `longest ${longest[0].text.length}`);
  check(`${rel} no tip is ever empty`,
    empty.length === 0,
    empty.length ? empty.slice(0, 4).map(t => `${t.state} ${t.where}`).join(', ') : `${flat.length} readings`);
  check(`${rel} no em-dash in tip copy`,
    dash.length === 0,
    dash.length ? dash.slice(0, 3).map(t => t.where).join(', ') : 'clean');
  check(`${rel} no page errors while the tips were driven`,
    errors.length === 0, errors[0] || 'clean');

  await page.close();
}

console.log(`\n── over the ${SNUG}-char aim (${allLong.length} of ${grandTotal}) ──`);
for (const t of allLong.sort((a, b) => b.text.length - a.text.length))
  console.log(`  ${String(t.text.length).padStart(3)}  ${t.page}  ${t.label || t.where}`);

console.log(`\ntip-check: ${grandTotal} tips, mean ${Math.round(grandChars / grandTotal)} chars`);
console.log(`tip-check: ${pass} passed, ${fail} failed`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
