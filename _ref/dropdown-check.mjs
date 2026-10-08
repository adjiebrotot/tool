// Dropdowns: site-wide check.
//
// Every dropdown on the site is meant to look like one component (see
// _ref/design-reference.md, "Dropdowns: one look, two kinds"). This loads
// every shipped page, the home page included, in headless Chromium (CDN
// libraries are stubbed, so it runs offline), in the dark and the light theme,
// and holds its real DOM to that:
//
//   1. THE SHARED FILES ARE LOADED. dropdown.css applies (shared.css imports
//      it; the home page links it) and dropdown.js is on the page.
//   2. EVERY SELECT IS THE SAME FIELD. Visible or hidden in another tab, a
//      <select> reads in DM Sans at weight 500, no caps, with a 1.5px border in
//      the theme's --border and the theme's field fill (--input-bg, or --panel
//      for a field sitting on a tinted group). A one-line select has the
//      chevron and room for it. A tool may size a select, never re-style it.
//   3. NO TOOL PAINTS ITS OWN OPTIONS. The browser's own list (keyboard,
//      touch) shows the shared option colours for the theme.
//   4. EVERY SEARCHABLE LIST IS THE SHARED ONE. A .combo-input and a
//      .combo-list read in DM Sans; nothing still uses the old per-tool list
//      classes alone.
//   5. A MOUSE OPENS THE SHARED LIST. On each page, a click on the first
//      visible select opens the .combo-list panel, and a pick sets the select
//      and fires exactly one change.
//
// Run: node _ref/dropdown-check.mjs           (ONLY=<path fragment> for one page)
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
    else if (name === 'index.html') out.push(p);
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


const READ = () => {
  // Chromium floors a computed border width to whole pixels (1.5px reads as
  // 1px), so the width is read from the rules that match instead.
  // A shorthand holding a var() (`border:1.5px solid var(--border)`) is not
  // split into longhands, so the width is picked out of it.
  const bw = st => {
    for (const prop of ['border-top-width', 'border-width', 'border-top', 'border']) {
      const v = st.getPropertyValue(prop);
      if (!v) continue;
      if (/^(none|0)\b/.test(v.trim())) return '0px';
      const m = v.match(/(^|\s)(\d*\.?\d+px|thin|medium|thick)(\s|$)/);
      if (m) return m[2];
    }
    return '';
  };
  const rules = [];
  const walk = list => {
    for (const r of list) {
      if (r.styleSheet) { try { walk(r.styleSheet.cssRules); } catch (e) {} }
      else if (r.media && r.cssRules) { if (matchMedia(r.media.mediaText).matches) walk(r.cssRules); }
      else if (r.cssRules && !r.selectorText) walk(r.cssRules);
      else if (r.selectorText && bw(r.style)) rules.push(r);
    }
  };
  for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch (e) {} }
  const widths = el => rules.filter(r => { try { return el.matches(r.selectorText); } catch (e) { return false; } })
    .map(r => bw(r.style));
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;left:-9999px;border:1px solid var(--border);background:var(--input-bg);color:var(--panel)';
  document.body.appendChild(probe);
  const pc = getComputedStyle(probe);
  const token = { border: pc.borderTopColor, inputBg: pc.backgroundColor, panel: pc.color };
  probe.remove();
  const light = document.body.classList.contains('light');
  const selects = [...document.querySelectorAll('select')].map(s => {
    const c = getComputedStyle(s);
    const o = s.options[0] ? getComputedStyle(s.options[0]) : null;
    return {
      name: s.id || (typeof s.className === 'string' && s.className) || s.name || '(select)',
      font: c.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
      weight: c.fontWeight, transform: c.textTransform,
      bw: widths(s), bstyle: c.borderTopStyle, bcolor: c.borderTopColor,
      bg: c.backgroundColor, chevron: c.backgroundImage.startsWith('url('),
      padR: parseFloat(c.paddingRight), list: s.multiple || s.size > 1,
      hidden: c.opacity === '0', error: s.classList.contains('error'),
      optBg: o ? o.backgroundColor : null
    };
  });
  const combos = [...document.querySelectorAll('.combo-input, .combo-list')].map(el => ({
    name: el.id || el.className, font: getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim()
  }));
  const legacy = [...document.querySelectorAll('.city-dropdown:not(.combo-list), .pf-combo-drop:not(.combo-list), .city-opt:not(.combo-opt)')].map(e => e.className);
  return { token, light, selects, combos, legacy, hasJs: !!window.SharedDropdown };
};

const OPT_BG = { dark: 'rgb(22, 32, 51)', light: 'rgb(255, 255, 255)' };
const files = pages(ROOT).filter(f => relative(ROOT, f).includes(ONLY)).sort();
let opened = 0;
for (const theme of ['dark', 'light']) {
  const ctx = await newContext({ viewport: { width: 1280, height: 900 } });
  for (const file of files) {
    const rel = relative(ROOT, file).split('\\').join('/') || 'index.html';
    const page = await ctx.newPage();
    await page.goto(urlFor(file), { waitUntil: 'load' });
    await page.waitForTimeout(400);
    // Tool pages switch theme with body.light; the home page is light only.
    const isHome = rel === 'index.html';
    if (isHome && theme === 'dark') { await page.close(); continue; }
    // A first-visit tour would cover the page; it is not what is checked here.
    await page.addStyleTag({ content: '[class*="tour-"]:not(html):not(body){display:none!important}' });
    if (!isHome) await page.evaluate(t => document.body.classList.toggle('light', t === 'light'), theme);
    await page.waitForTimeout(350);   // let colour transitions settle
    const r = await page.evaluate(READ);
    const tag = `${theme} ${rel}`;
    if (!r.selects.length && !r.combos.length) { await page.close(); continue; }
    check(`${tag}: dropdown.js is loaded`, r.hasJs);
    const bad = [];
    for (const s of r.selects) {
      const why = [];
      if (s.font !== 'DM Sans') why.push('font ' + s.font);
      if (s.weight !== '500') why.push('weight ' + s.weight);
      if (s.transform !== 'none') why.push('text-transform ' + s.transform);
      if (s.optBg && s.optBg !== OPT_BG[theme] && !s.list) why.push('option bg ' + s.optBg);
      if (!s.hidden) {
        const odd = s.bw.filter(w => w !== '1.5px');
        if (!s.bw.length || odd.length || s.bstyle !== 'solid') why.push(`border ${odd.join('/') || 'none'} ${s.bstyle}`);
        if (!s.error && s.bcolor !== r.token.border) why.push('border colour ' + s.bcolor);
        if (s.bg !== r.token.inputBg && s.bg !== r.token.panel) why.push('fill ' + s.bg);
        if (!s.list && !s.chevron) why.push('no chevron');
        if (!s.list && s.padR < 18) why.push('no room for the chevron (' + s.padR + 'px)');
      }
      if (why.length) bad.push(s.name + ': ' + why.join(', '));
    }
    if (r.selects.length) check(`${tag}: ${r.selects.length} selects share the field look`, !bad.length, bad.slice(0, 6).join(' | '));
    const badCombo = r.combos.filter(c => c.font !== 'DM Sans');
    if (r.combos.length) check(`${tag}: ${r.combos.length} combobox parts use the shared look`, !badCombo.length, badCombo.map(c => c.name + ' ' + c.font).join(' | '));
    check(`${tag}: no list left on the old per-tool classes`, !r.legacy.length, r.legacy.slice(0, 3).join(' | '));

    // One mouse open per page and theme.
    const vis = page.locator('select:visible:not([multiple]):not([disabled]):not([data-native])');
    if (await vis.count()) {
      const s = vis.first();
      const box = await s.boundingBox();
      const visible = box && (await s.evaluate(el => getComputedStyle(el).opacity !== '0'));
      if (visible && box.y > 0 && box.y < 880) {
        await page.evaluate(() => { window.__chg = 0; document.addEventListener('change', () => window.__chg++, true); });
        const before = await s.inputValue();
        await s.click();
        await page.waitForTimeout(120);
        const n = await page.locator('.combo-list.sel-list').count();
        const rows = page.locator('.sel-list .combo-opt:not(.selected):not(.disabled)');
        let after = before, chg = 0;
        if (n && await rows.count()) {
          await rows.first().click();
          await page.waitForTimeout(120);
          after = await s.inputValue().catch(() => '(re-rendered)');
          chg = await page.evaluate(() => window.__chg);
        }
        const one = n === 1 && after !== before && chg === 1 && !(await page.locator('.sel-list').count());
        check(`${tag}: a mouse opens the shared list and a pick fires one change`, one,
              `list ${n}, value ${before} → ${after}, change ×${chg}`);
        opened++;
      }
    }
    await page.close();
  }
  await ctx.close();
}

await browser.close();
server.close();
console.log(`\ndropdown check: ${pass} passed, ${fail} failed (${files.length} pages, ${opened} opened with the mouse)`);
process.exit(fail ? 1 : 0);
