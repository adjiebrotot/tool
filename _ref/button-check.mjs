// Buttons: site-wide check.
//
// A reader who learns a button on one tool should be able to read it on the
// next. That only holds if a picture means one job everywhere, so this loads
// every shipped page in headless Chromium (CDN libraries are stubbed out, so
// it runs offline) and holds its real DOM to the vocabulary in
// _ref/design-reference.md, "Buttons and icons":
//
//   1. ✕ CLOSES, AND ONLY CLOSES. No control draws ✕, ×, ✖ or ⊗ as text; a
//      close is SharedIcon's cross, and any control carrying that cross is
//      named for closing (Close, Tutup).
//   2. THE BIN DELETES. A control named for removing or deleting something
//      carries the bin, and the bin is never put on anything else.
//   3. ONE PICTURE PER JOB. Duplicate is the two sheets with a plus, edit the
//      pencil, save-to-file the floppy, open-a-file the folder, clear-a-field
//      the backspace key, copy-to-clipboard ⧉. Each is checked both ways: the
//      job has its picture, and the picture is not lent to another job.
//   4. NO EMOJI OR STRAY GLYPH STANDS IN FOR AN ICON (💾 📂 📥 📊 ✏️ ✎ 🗑 ⚙ ⊡,
//      or ↓ ↑ in place of ⬇ and the folder). Decoration is still fine: the
//      🌙 / ☀️ theme toggle, 🧭 tour, 🚀 Time Travel.
//   5. AN ICON-ONLY BUTTON HAS A NAME (aria-label or title), for a screen
//      reader and for the hover hint.
//   6. BARE MEANS BARE. A .btn-bare has no fill and no border until hovered.
//
// It also holds Finance vs Cash's scenario editor to the reachability rule:
// the way out keeps the work, and it is in view however far the form scrolls.
//
//   7. A sticky control card ends on screen at first load, so the button its
//      form leads to (Simulate, Load, Reset) is visible before any scroll.
//
// and, for Finance vs Cash's editor:
//
//   8. Done is on screen with the panel scrolled to the middle of the form,
//      on a desktop and on a phone.
//   9. An edit survives every way out (Done, ✕, Esc), and there is no
//      "close without saving" control left to hit by mistake.
//
// Run: node _ref/button-check.mjs            (ONLY=<path fragment> for one page)
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import { readdirSync, statSync, createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, extname, normalize } from 'node:path';

const { chromium } = pw;
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const ONLY = process.env.ONLY || process.argv[2] || '';

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
  console.log((ok ? '  PASS  ' : '✗ FAIL  ') + name + (detail ? '  · ' + detail : ''));
  ok ? pass++ : fail++;
};

const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript',
               '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml',
               '.png':'image/png', '.jpg':'image/jpeg', '.xml':'application/xml', '.txt':'text/plain' };
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
const urlFor = file => ORIGIN + '/' + relative(ROOT, file).split('\\').join('/');

const browser = await chromium.launch();
async function newContext(opts = {}) {
  const ctx = await browser.newContext(opts);
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
    try { localStorage.clear(); } catch (e) {}
  });
  return ctx;
}

/* Every control on the page as the reader meets it: its name (aria-label,
   else title, else its text), its visible text and which shared icon it
   draws. Hidden tabs count: their buttons are a click away. */
const READ = () => {
  const SEL = 'button, [role=button], a[class*=btn], label[class*=btn], label.upload-btn, ' +
              '.fbar-del-btn, .item-del, .city-clear, .color-clear';
  const seen = new Set();
  return [...document.querySelectorAll(SEL)].filter(el => {
    if (seen.has(el) || el.closest('.pf-tour-pop, .pf-tour-overlay, [class*="tour-"]')) return false;
    seen.add(el); return true;
  }).map(el => {
    const ico = [...el.querySelectorAll('svg.ico')]
      .map(s => ([...s.classList].find(c => c.startsWith('ico-')) || '').slice(4));
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    const name = (el.getAttribute('aria-label') || el.getAttribute('title') || text).trim();
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(), id: el.id, cls: typeof el.className === 'string' ? el.className : '',
      text, name, ico,
      hasName: !!(el.getAttribute('aria-label') || el.getAttribute('title')),
      bare: el.classList.contains('btn-bare'),
      bg: cs.backgroundColor, border: parseFloat(cs.borderTopWidth) || 0
    };
  });
};

const CLOSE_NAME  = /\b(close|dismiss|tutup)\b/i;
const DELETE_NAME = /\b(remove|delete|hapus|discard)\b|\bclear (all|the)\b|^clear$/i;
const DUP_NAME    = /\b(duplicate|duplikat)\b|copy this (scenario|portfolio)/i;
const EDIT_NAME   = /^(edit|ubah)\b|change method/i;
const SAVE_NAME   = /\bsave\b.*\b(file|json)\b|\bsimpan\b.*\bfile\b/i;
const OPEN_NAME   = /\bopen\b.*\b(file|json|csv|xlsx|video)\b|\bbuka\b.*\bfile\b|^open$/i;
const CLIP_NAME   = /clipboard|papan klip/i;
const X_GLYPH     = /[✕×✖⊗]/;
const STRAY       = /[💾📂📁🗂📥📤📊✏✎🗑⚙⊡]|^[↓↑]\s/u;
const label = r => (r.id ? '#' + r.id : r.tag + '.' + r.cls.trim().split(/\s+/).slice(0, 2).join('.')) + ' "' + r.name.slice(0, 40) + '"';

const list = pages(ROOT).filter(p => !ONLY || relative(ROOT, p).includes(ONLY)).sort();
const ctx = await newContext({ viewport: { width: 1400, height: 900 } });
for (const file of list) {
  const rel = relative(ROOT, file);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(urlFor(file), { waitUntil: 'load' });
  await page.waitForTimeout(350);
  const rows = await page.evaluate(READ);
  console.log('\n' + rel + '  (' + rows.length + ' controls)');

  const bad = (pred) => rows.filter(pred).map(label);
  const report = (title, offenders) => check(rel + ': ' + title, offenders.length === 0, offenders.slice(0, 6).join(', '));

  // 1. ✕ closes, and only closes.
  report('no control draws ✕ × ✖ ⊗ as text (a close is the shared cross)',
    bad(r => X_GLYPH.test(r.text.replace(/\d\s*×|×\s*\d/g, ''))));
  report('the cross is only ever on a close',
    bad(r => r.ico.includes('close') && !CLOSE_NAME.test(r.name)));
  // 2. The bin deletes.
  report('every remove / delete carries the bin',
    bad(r => DELETE_NAME.test(r.name) && !r.ico.includes('trash') && !/clear (place|the field)|^clear$/i.test(r.name) ||
             (/^clear$/i.test(r.name) && !r.ico.includes('trash') && !r.ico.includes('clear'))));
  report('the bin is only ever on a remove / delete / clear',
    bad(r => r.ico.includes('trash') && !(DELETE_NAME.test(r.name) || /\bclear\b/i.test(r.name))));
  // 3. One picture per job, both ways round.
  const pair = (what, re, ico) => {
    report(what + ' carries its picture', bad(r => re.test(r.name) && !r.ico.includes(ico)));
    report(what + "'s picture is not lent to another job", bad(r => r.ico.includes(ico) && !re.test(r.name)));
  };
  pair('duplicate', DUP_NAME, 'duplicate');
  pair('edit', EDIT_NAME, 'edit');
  pair('save to a file', SAVE_NAME, 'save');
  pair('open a file', OPEN_NAME, 'open');
  report('copy to clipboard is ⧉', bad(r => CLIP_NAME.test(r.name) && !r.text.includes('⧉')));
  report('⧉ is only ever copy to clipboard', bad(r => r.text === '⧉' && !CLIP_NAME.test(r.name)));
  report('a field is cleared with the backspace key, never the bin or ✕',
    bad(r => /city-clear/.test(r.cls) && !r.ico.includes('clear')));
  // 4. No emoji or stray glyph in place of an icon.
  report('no emoji or stray glyph stands in for an icon', bad(r => STRAY.test(r.text)));
  // 5. Icon-only buttons are named.
  report('every icon-only button has a name',
    bad(r => !r.text && !r.hasName && r.tag !== 'a'));
  // 6. Bare means bare.
  report('a .btn-bare has no fill and no border at rest',
    bad(r => r.bare && !(/rgba\(0, 0, 0, 0\)|transparent/.test(r.bg) && r.border === 0)));
  // 7. A sticky control card ends on screen before the reader scrolls.
  const hang = await page.evaluate(() => [...document.querySelectorAll('.controls, .sidebar')]
    .filter(el => getComputedStyle(el).position === 'sticky' && el.offsetHeight)
    .map(el => Math.round(el.getBoundingClientRect().bottom - innerHeight))
    .filter(d => d > 1));
  check(rel + ': a sticky control card ends on screen at first load', hang.length === 0,
    hang.length ? 'bottom hangs ' + hang.join(', ') + 'px under the fold' : '');
  check(rel + ': no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}
await ctx.close();

/* ── Finance vs Cash: the editor keeps the work and keeps the way out in view ── */
if (!ONLY || 'financingvscash'.includes(ONLY) || ONLY.includes('financingvscash')) {
  console.log('\nfinancingvscash/ scenario editor');
  for (const vp of [{ name: 'desktop', width: 1400, height: 900 }, { name: 'phone', width: 390, height: 844 }]) {
    const c = await newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await c.newPage();
    await page.goto(ORIGIN + '/financingvscash/', { waitUntil: 'load' });
    await page.waitForTimeout(300);
    const open = () => page.evaluate(() => {
      document.querySelectorAll('[class*="tour-"]').forEach(n => n.remove());
      document.querySelector('.ctrl-tab[data-tab="scenarios"]').click();
      document.querySelector('.scenario-card .sc-btn[data-action="edit"]').click();
    });
    await open();
    // Scroll to the middle of the form the way a reader would: the panel on a
    // desktop, the page on a phone.
    const seen = await page.evaluate(() => {
      const ed = document.getElementById('scenarioEditor');
      const sc = document.querySelector('.ctrl-scroll');
      if (getComputedStyle(sc).overflowY === 'auto') sc.scrollTop = sc.scrollHeight / 2;
      else window.scrollTo(0, ed.getBoundingClientRect().top + window.scrollY + ed.offsetHeight / 2 - innerHeight / 2);
      const r = document.getElementById('saveScenarioBtn').getBoundingClientRect();
      const box = (getComputedStyle(sc).overflowY === 'auto' ? sc.getBoundingClientRect() : { top: 0, bottom: innerHeight });
      const edBox = ed.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { inView: r.top >= box.top && r.bottom <= box.bottom + 1, onTop: !!hit && !!hit.closest('#saveScenarioBtn'),
               formBelow: edBox.bottom > box.bottom + 40 };
    });
    check(`fvc ${vp.name}: halfway down the form, Done is on screen and nothing covers it`,
      seen.inView && seen.onTop && seen.formBelow, JSON.stringify(seen));

    for (const [how, act] of [['Done', () => page.click('#saveScenarioBtn')],
                              ['✕', () => page.evaluate(() => document.getElementById('closeScenarioBtn').click())],
                              ['Esc', () => page.press('#scName', 'Escape')]]) {
      await open();
      const name = 'Kept via ' + how;
      await page.fill('#scName', name);
      await page.fill('#scRate', '7.25');
      await act();
      await page.waitForTimeout(250);
      const got = await page.evaluate(() => ({
        open: getComputedStyle(document.getElementById('scenarioEditor')).display !== 'none',
        card: document.querySelector('.scenario-card .sc-name').textContent.trim(),
        sub: document.querySelector('.scenario-card .sc-summary').textContent.trim()
      }));
      check(`fvc ${vp.name}: an edit survives closing with ${how}`,
        !got.open && got.card === name && /7\.25%/.test(got.sub), JSON.stringify(got));
    }
    const discard = await page.evaluate(() => [...document.querySelectorAll('#scenarioEditor button')]
      .filter(b => /cancel|without saving|discard/i.test((b.textContent || '') + (b.title || '') + (b.getAttribute('aria-label') || '')))
      .map(b => b.id || b.textContent.trim()));
    check(`fvc ${vp.name}: no "close without saving" control is left in the editor`, discard.length === 0, discard.join(', '));
    await c.close();
  }
}

await browser.close();
server.close();
console.log(`\nbutton check: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
