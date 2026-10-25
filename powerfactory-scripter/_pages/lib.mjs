// What every reading page shares: the head (SEO, JSON-LD, the site's tokens), the top bar,
// the footer, Python highlighting and the inline SVG charts. All of it is done when the page is
// written, so a page ships as plain HTML and CSS with no script of its own beyond the theme.

export const SITE = 'https://tool.adjiebrotots.com/';
export const BASE = SITE + 'powerfactory-scripter/';
export const PERSON = { '@type': 'Person', '@id': 'https://www.adjiebrotots.com/#person', name: 'Adjie Brotosukmono', url: 'https://www.adjiebrotots.com/' };

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const json = (o) => JSON.stringify(o, null, 2).replace(/</g, '\\u003c');

const GLYPH = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false" class="tool-glyph" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="var(--accent)" d="M6.5 8 3 12l3.5 4"/><path stroke="var(--accent)" d="M17.5 8 21 12l-3.5 4"/><path stroke="var(--accent2)" d="M13 4.5 9.5 12.5h4L10.5 19.5"/></svg>';

const GTAG = `  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-VYTV157ST0"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    // Analytics cookies wait for a yes in the EEA, the UK and Switzerland (asked by consent.js); no ad storage anywhere.
    gtag('consent', 'default', {analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', region: ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','IS','LI','NO','GB','CH']});
    gtag('consent', 'default', {analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'});
    try { var abtConsent = localStorage.getItem('abt-consent'); if (abtConsent) gtag('consent', 'update', {analytics_storage: abtConsent}); } catch (e) {}
    gtag('js', new Date());

    gtag('config', 'G-VYTV157ST0');
  </script>`;

// page: { path: 'reference/ElmLne/' (under powerfactory-scripter/), title, h1 (html), desc,
//   ogTitle, ogType, crumbs: [[name, path]], jsonld: [objects], body (html), script (inline js),
//   builderLink (bool) }
export function page(p) {
  const depth = p.path.split('/').filter(Boolean).length;      // reference/ElmLne/ -> 2
  const pf = '../'.repeat(depth);                               // to powerfactory-scripter/
  const root = '../'.repeat(depth + 1);                         // to the site root
  const url = BASE + p.path;
  const crumbs = [['Adjie Brotools', SITE], ['PowerFactory Scripter', BASE], ...(p.crumbs || []).map(([n, path]) => [n, BASE + path])];
  const ld = [...(p.jsonld || []), {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: crumbs.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
  }];
  const crumbHtml = crumbs.slice(1).map(([n, u], i, a) => (i === a.length - 1
    ? `<span aria-current="page">${esc(n)}</span>`
    : `<a href="${esc(rel(u, url))}">${esc(n)}</a><span aria-hidden="true">›</span>`)).join('');
  const ogDesc = p.ogDesc || p.desc;
  return `<!DOCTYPE html>
<html lang="en">
<head>
${GTAG}
  <script src="${root}consent.js" defer></script>

<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.desc)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${url}">
<link rel="sitemap" type="application/xml" href="${SITE}sitemap.xml">

<meta property="og:type" content="${p.ogType || 'article'}">
<meta property="og:title" content="${esc(p.ogTitle || p.title)}">
<meta property="og:description" content="${esc(ogDesc)}">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="Adjie Brotot Tools">
<meta property="og:image" content="${SITE}logos/logo.png">
<meta property="og:locale" content="en_AU">

<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(p.ogTitle || p.title)}">
<meta name="twitter:description" content="${esc(ogDesc)}">

${ld.map(o => `<script type="application/ld+json">\n${json(o)}\n</script>`).join('\n')}
<link rel="icon" type="image/svg+xml" href="${root}logos/logo.svg">
<link rel="manifest" href="${root}manifest.webmanifest">
<link rel="apple-touch-icon" href="${root}logos/apple-touch-icon.png">
<script src="${root}pwa.js" defer></script>
<link rel="preload" href="${root}assets/fonts/dm-sans.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${root}fonts.css">
<link rel="stylesheet" href="${root}dark.css">
<link rel="stylesheet" href="${root}light.css">
<link rel="stylesheet" href="${pf}docs.css">
</head>
<body class="light" data-no-abbr>
<script src="${root}theme.js"></script>
<div class="dx">

  <nav class="dx-top" aria-label="Site">
    <a class="btn-theme" href="${pf}">← PowerFactory Scripter</a>
    <div class="dx-top-r">
      <a class="btn-primary" href="${pf}builder/">Open Builder</a>
      <button class="btn-theme" id="themeToggle" type="button">🌙 Dark</button>
    </div>
  </nav>

  <main>
    <nav class="dx-crumb" aria-label="Breadcrumb">${crumbHtml}</nav>
    <h1>${GLYPH}${p.h1}</h1>
${p.body}
  </main>

  <footer>
    <p class="footer-collab"><strong>A hobby project, open to collaboration.</strong> This tool is free and earns me no revenue. If your organisation could use a custom tool or training, <a href="mailto:adjiebrotots@gmail.com?subject=Collaboration">let’s talk</a>. Bugs or questions: <a href="mailto:adjiebrotots@gmail.com">adjiebrotots@gmail.com</a> 🙂</p>
    <p class="footer-links"><a href="${root}disclaimer/">Disclaimer</a> · <a href="${root}privacy/">Privacy Policy</a> · <a href="https://blog.adjiebrotots.com/">Blog</a></p>
    <p>PowerFactory and DIgSILENT are trademarks of DIgSILENT GmbH. This page is independent and not endorsed by DIgSILENT. Attribute names and descriptions are as PowerFactory 2024 reports them.</p>
    <p>Licensed under <a href="https://www.gnu.org/licenses/gpl-3.0.html" rel="noopener">GNU GPL</a>, free to use, modify, and share with source code disclosed. Made in Australia by <a href="https://www.adjiebrotots.com/about/" rel="author">Adjie Brotosukmono</a>, an Indonesian engineer.</p>
  </footer>
</div>
<script>
  document.getElementById('themeToggle').addEventListener('click', function () { document.body.classList.toggle('light'); });${p.script ? '\n' + p.script : ''}
</script>
</body>
</html>
`;
}

// Relative link from page url `from` to absolute `to` (both under SITE).
export function rel(to, from) {
  if (!to.startsWith(SITE)) return to;
  const a = from.slice(SITE.length).split('/').filter(Boolean);   // directories of the page
  const b = to.slice(SITE.length).split('#');
  const parts = b[0].split('/').filter(Boolean);
  let i = 0;
  while (i < a.length && i < parts.length && a[i] === parts[i]) i++;
  const up = '../'.repeat(a.length - i);
  const down = parts.slice(i).join('/') + (parts.length > i && b[0].endsWith('/') ? '/' : '');
  return (up + down || './') + (b[1] !== undefined ? '#' + b[1] : '');
}

// ---- Python highlighting --------------------------------------------------------------------
const KW = new Set('False None True and as assert break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield'.split(' '));
export function py(code) {
  const re = /(#[^\n]*)|([rbfRBF]{0,2}(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'))|(\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)(?=\s*\()|([A-Za-z_][A-Za-z0-9_]*)/g;
  let out = '', last = 0, m;
  while ((m = re.exec(code))) {
    out += esc(code.slice(last, m.index));
    const [t, c, s, n, f, w] = m;
    if (c) out += `<span class="py-c">${esc(c)}</span>`;
    else if (s) out += `<span class="py-s">${esc(s)}</span>`;
    else if (n) out += `<span class="py-n">${esc(n)}</span>`;
    else if (f) out += KW.has(f) ? `<span class="py-k">${esc(f)}</span>` : `<span class="py-f">${esc(f)}</span>`;
    else out += KW.has(w) ? `<span class="py-k">${esc(w)}</span>` : esc(w);
    last = m.index + t.length;
  }
  return out + esc(code.slice(last));
}
export const pre = (code, file) =>
  (file ? `<p class="dx-file"><span>${file}</span></p>\n` : '') + `<pre><code class="language-python">${py(code.replace(/\s+$/, ''))}</code></pre>`;

// ---- Charts -------------------------------------------------------------------------------
const fmt = (v) => {
  const a = Math.abs(v);
  const s = a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1).replace(/\.0$/, '') : a >= 1 ? v.toFixed(2).replace(/0$/, '').replace(/\.0$/, '') : v.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  return s === '-0' ? '0' : s.replace('-', '−');
};
function niceTicks(lo, hi, n = 5) {
  if (!(hi > lo)) { hi = lo + 1; }
  const span = hi - lo;
  const raw = span / n;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(k => k * p).find(s => span / s <= n) || 10 * p;
  const t0 = Math.floor(lo / step) * step, t1 = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let v = t0; v <= t1 + step * 1e-6; v += step) ticks.push(+v.toFixed(10));
  return ticks;
}

// opts: { title (a11y), series: [{ name, pts: [[x,y],...], c: 1..5, dots }], x: {label, unit, min, max},
//   y: {label, unit, min, max}, limits: [{ y | x, label }], w, h, caption, legend (default when >1) }
export function lineChart(o) {
  const W = o.w || 760, H = o.h || 360, L = 64, R = 18, T = 16, B = 52;
  const xs = o.series.flatMap(s => s.pts.map(p => p[0])), ys = o.series.flatMap(s => s.pts.map(p => p[1]));
  for (const l of o.limits || []) { if (l.y !== undefined) ys.push(l.y); if (l.x !== undefined) xs.push(l.x); }
  const xt = niceTicks(o.x.min ?? Math.min(...xs), o.x.max ?? Math.max(...xs), o.x.ticks || 6);
  const yt = niceTicks(o.y.min ?? Math.min(...ys), o.y.max ?? Math.max(...ys), o.y.ticks || 5);
  const x0 = o.x.min ?? xt[0], x1 = o.x.max ?? xt[xt.length - 1], y0 = o.y.min ?? yt[0], y1 = o.y.max ?? yt[yt.length - 1];
  const X = (v) => L + (v - x0) / (x1 - x0) * (W - L - R), Y = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  let g = '';
  for (const v of yt) if (v >= y0 - 1e-9 && v <= y1 + 1e-9) g += `<line class="ch-grid" x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="ch-t" x="${L - 8}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${fmt(v)}</text>`;
  for (const v of xt) if (v >= x0 - 1e-9 && v <= x1 + 1e-9) g += `<text class="ch-t" x="${X(v).toFixed(1)}" y="${H - B + 18}" text-anchor="middle">${fmt(v)}</text>`;
  g += `<line class="ch-axis" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/>`;
  g += `<text class="ch-tt" x="${(L + W - R) / 2}" y="${H - 10}" text-anchor="middle">${esc(o.x.label)}${o.x.unit ? ` (${esc(o.x.unit)})` : ''}</text>`;
  g += `<text class="ch-tt" transform="translate(16 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle">${esc(o.y.label)}${o.y.unit ? ` (${esc(o.y.unit)})` : ''}</text>`;
  for (const l of o.limits || []) {
    const lt = l.legend ? '' : esc(l.label || '');
    if (l.y !== undefined) g += `<line class="ch-lim" x1="${L}" x2="${W - R}" y1="${Y(l.y).toFixed(1)}" y2="${Y(l.y).toFixed(1)}"/>` + (lt ? `<text class="ch-limt" x="${W - R - 4}" y="${(Y(l.y) - 6).toFixed(1)}" text-anchor="end">${lt}</text>` : '');
    if (l.x !== undefined) g += `<line class="ch-lim" y1="${T}" y2="${H - B}" x1="${X(l.x).toFixed(1)}" x2="${X(l.x).toFixed(1)}"/>` + (lt ? `<text class="ch-limt" x="${(X(l.x) + 5).toFixed(1)}" y="${T + 12}">${lt}</text>` : '');
  }
  o.series.forEach((s, i) => {
    const c = s.c || (i % 5) + 1;
    const d = s.pts.map((p, k) => (k ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join('');
    g += `<path class="ch-l ch-c${c}" d="${d}"/>`;
    if (s.dots) for (const p of s.pts) g += `<circle class="ch-dot ch-f${c}" cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="3.6"/>`;
  });
  const legend = (o.legend ?? o.series.length > 1) || (o.limits || []).some(l => l.legend);
  return figure(W, H, g, o, legend ? o.series.map((s, i) => [`k${s.c || (i % 5) + 1}`, s.name]).concat((o.limits || []).filter(l => l.legend).map(l => ['klim', l.legend])) : null);
}

// opts: { title, bars: [{ label, v }], y: {label, unit, min, max}, x: {label}, limit: {y, label}, w, h, caption, c }
export function barChart(o) {
  const W = o.w || 760, L = 64, R = 18, T = 16;
  const longest = Math.max(...o.bars.map(b => String(b.label).length));
  const tilt = o.bars.length > 12 || longest * 6.6 > (W - L - R) / o.bars.length - 6;
  const B = tilt ? Math.min(150, 26 + longest * 5.2) : 58;
  const H = (o.h || 360) + (tilt ? B - 58 : 0);
  const vs = o.bars.map(b => b.v).concat(o.limit ? [o.limit.y] : []);
  const yt = niceTicks(o.y.min ?? Math.min(0, ...vs), o.y.max ?? Math.max(...vs), 5);
  const y0 = o.y.min ?? yt[0], y1 = o.y.max ?? yt[yt.length - 1];
  const Y = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  const bw = (W - L - R) / o.bars.length;
  let g = '';
  for (const v of yt) g += `<line class="ch-grid" x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="ch-t" x="${L - 8}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${fmt(v)}</text>`;
  o.bars.forEach((b, i) => {
    const x = L + i * bw + bw * 0.16, w = bw * 0.68, y = Y(Math.max(b.v, y0)), h = Y(y0) - y;
    g += `<rect class="ch-f${b.c || o.c || 1}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="2"><title>${esc(b.label)}: ${fmt(b.v)}${o.y.unit ? ' ' + esc(o.y.unit) : ''}</title></rect>`;
    const tx = L + i * bw + bw / 2;
    g += tilt
      ? `<text class="ch-t" transform="translate(${tx.toFixed(1)} ${H - B + 12}) rotate(-50)" text-anchor="end">${esc(b.label)}</text>`
      : `<text class="ch-t" x="${tx.toFixed(1)}" y="${H - B + 18}" text-anchor="middle">${esc(b.label)}</text>`;
  });
  g += `<line class="ch-axis" x1="${L}" x2="${W - R}" y1="${Y(y0)}" y2="${Y(y0)}"/>`;
  if (o.x && o.x.label) g += `<text class="ch-tt" x="${(L + W - R) / 2}" y="${H - 8}" text-anchor="middle">${esc(o.x.label)}</text>`;
  g += `<text class="ch-tt" transform="translate(16 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle">${esc(o.y.label)}${o.y.unit ? ` (${esc(o.y.unit)})` : ''}</text>`;
  if (o.limit) g += `<line class="ch-lim" x1="${L}" x2="${W - R}" y1="${Y(o.limit.y).toFixed(1)}" y2="${Y(o.limit.y).toFixed(1)}"/>`;
  const keys = (o.keys || []).concat(o.limit ? [['klim', o.limit.label]] : []);
  return figure(W, H, g, o, keys.length ? keys : null);
}

function figure(W, H, g, o, legend) {
  const id = 'ch' + Math.abs(hash(o.title)).toString(36);
  const leg = legend ? `<ul class="dx-legend">${legend.map(([k, n]) => `<li><i class="${k}"></i>${esc(n)}</li>`).join('')}</ul>` : '';
  return `<figure class="dx-chart"><div class="dx-chart-sc"><svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}" xmlns="http://www.w3.org/2000/svg"><title id="${id}">${esc(o.title)}</title>${g}</svg></div>${leg}${o.caption ? `<figcaption>${o.caption}</figcaption>` : ''}</figure>`;
}
function hash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }

// A results table: cols [{ h, unit, num, key | fn }], rows [objects]
export function table(cols, rows, cls = '') {
  const head = cols.map(c => `<th${c.num ? ' class="num"' : ''}>${esc(c.h)}${c.unit ? ` <span class="th-unit">${esc(c.unit)}</span>` : ''}</th>`).join('');
  const body = rows.map(r => '<tr>' + cols.map(c => {
    const v = c.fn ? c.fn(r) : r[c.key];
    return `<td${c.num ? ' class="num"' : ''}>${c.html ? v : esc(v)}</td>`;
  }).join('') + '</tr>').join('\n');
  return `<div class="dx-tw"><table${cls ? ` class="${cls}"` : ''}><thead><tr>${head}</tr></thead><tbody>\n${body}\n</tbody></table></div>`;
}
