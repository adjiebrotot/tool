// The component reference: reference/index.html and one page per Master Library definition,
// reference/<slug>/, from ../reference/components.json (read out of a running PSCAD by
// ../builder/_audit/reference/build_reference.py) and the curated layer in definitions.mjs.

import fs from 'node:fs';
import path from 'node:path';
import { page, esc, pre, PERSON, BASE, adSlot, endAd } from './lib.mjs';
import { slugOf, CATEGORIES, CURATED } from './definitions.mjs';

const UPDATED = '2026-11-07';

// ---- Data ----------------------------------------------------------------------------------
// { key: { key, slug, name, group, desc, params: [{ name, ...row }], groups: [[group, rows]] } },
// with the PSCAD version and the date it was read. A definition with no parameters (a palette
// page such as master:Breakers_Faults) has no page.
export function loadAll(pxDir) {
  const raw = JSON.parse(fs.readFileSync(path.join(pxDir, 'reference', 'components.json'), 'utf8'));
  const defs = {};
  // PSCAD's own texts use the odd en-dash; the site writes a hyphen (the house rule).
  const dash = (v) => (typeof v === 'string' ? v.replace(/\s*[\u2013\u2014]\s*/g, ' - ') : Array.isArray(v) ? v.map(dash) : v);
  const clean = (p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, dash(v)]));
  for (const [key, d0] of Object.entries(raw.defs)) {
    const d = clean(d0);
    const params = Object.entries(d0.params || {}).map(([name, p]) => ({ ...clean(p), name }));
    if (!params.length) continue;
    const groups = new Map();
    for (const p of params) {
      const g = p.group || 'General';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(p);
    }
    defs[key] = { key, slug: slugOf(key), name: d.name || key, group: d.group || 'Other', desc: d.desc || '', params, groups: [...groups] };
  }
  const slugs = new Map();
  for (const d of Object.values(defs)) {
    if (slugs.has(d.slug)) throw new Error(`two definitions share the address ${d.slug}: ${slugs.get(d.slug)} and ${d.key}`);
    slugs.set(d.slug, d.key);
  }
  const known = new Set(CATEGORIES.map(([k]) => k));
  for (const d of Object.values(defs)) if (!known.has(d.group)) throw new Error(`${d.key}: group "${d.group}" is not in definitions.mjs CATEGORIES`);
  return { defs, pscad: String(raw.pscad || ''), generated: String(raw.generated || '') };
}

// ---- Rows ------------------------------------------------------------------------------------
const INF = (v) => v === undefined || v === '' || /^[-+]?1(\.0*)?E\+?308$/i.test(String(v).trim());
const shown = (p) => (p.value !== undefined && p.value !== '' ? p.value : (p.default ?? ''));
function optionsOf(p) {
  if (Array.isArray(p.options) && p.options.length) return p.options.map(([sym, label]) => sym === label ? sym : `${sym} (${label})`);
  if (Array.isArray(p.choices) && p.choices.length) return p.choices;
  return [];
}
function detail(p) {
  const bits = [];
  const lo = INF(p.min) ? null : p.min, hi = INF(p.max) ? null : p.max;
  if (lo !== null && hi !== null) bits.push(`Range ${lo} to ${hi}`);
  else if (lo !== null) bits.push(`At least ${lo}`);
  else if (hi !== null) bits.push(`At most ${hi}`);
  const o = optionsOf(p);
  if (o.length) bits.push(`Written as ${o.join(', ')}`);
  if (p.when) bits.push(`Used when ${p.when}`);
  if (p.dim && p.dim !== '1') bits.push(`An array of ${p.dim}`);
  return bits;
}
function rowsHtml(rows) {
  return rows.map(p => {
    const more = detail(p);
    const help = p.help && p.help !== p.desc ? p.help : '';
    return `<tr><td><code>${esc(p.name)}</code><small>${esc(p.type || '')}</small></td><td>${esc(p.unit || '') || '<span aria-label="no unit">·</span>'}</td><td>${esc(shown(p)) || '<span aria-label="empty">·</span>'}</td><td>${esc(p.desc || '')}${help ? `<small>${esc(help)}</small>` : ''}${more.map(m => `<small>${esc(m)}</small>`).join('')}</td></tr>`;
  }).join('\n');
}
const paramTable = (rows) => `<div class="dx-tw"><table class="dx-attrs"><thead><tr><th>Parameter</th><th>Unit</th><th>Default</th><th>Description</th></tr></thead><tbody>\n${rowsHtml(rows)}\n</tbody></table></div>`;

// ---- Python ------------------------------------------------------------------------------------
const pad = (s, n) => s + ' '.repeat(Math.max(1, n - s.length));
const pyStr = (v) => JSON.stringify(String(v));

// The parameter a page's example reads and writes: the first curated one, else the first number
// with a unit, else the first number, else the first parameter.
function exampleParam(d) {
  const cur = CURATED[d.key];
  const byName = (n) => d.params.find(p => p.name === n);
  for (const [n] of (cur && cur.common) || []) if (byName(n)) return byName(n);
  return d.params.find(p => p.type === 'Real' && p.unit) || d.params.find(p => p.type === 'Real' || p.type === 'Integer') || d.params[0];
}
function writeValue(p, d) {
  if (p.type === 'Choice') {
    const o = Array.isArray(p.options) ? p.options : [];
    const other = o.find(([sym]) => sym !== p.value) || o[0];
    return other ? [pyStr(other[0]), 'a Choice is written as its symbol'] : [pyStr(shown(p)), ''];
  }
  if (p.type === 'Real' || p.type === 'Integer') {
    const n = Number(shown(p));
    const v = Number.isFinite(n) && n !== 0 ? n * 2 : 1;
    const txt = p.type === 'Integer' ? String(Math.round(v)) : String(+v.toPrecision(6));
    return p.unit ? [pyStr(`${txt} [${p.unit}]`), 'a value that carries a unit is written with it'] : [pyStr(txt), 'written as text'];
  }
  return [pyStr(p.name === 'Name' ? (d.key === 'master:pgb' ? 'Vbus' : 'F1') : 'my_signal'), ''];
}
function snippet(d) {
  const p = exampleParam(d);
  const [val, why] = writeValue(p, d);
  const desc = (p.desc || p.name) + (p.unit ? `, in ${p.unit}` : '');
  let s = `import mhi.pscad

pscad = mhi.pscad.connect()              # the PSCAD that is open; launch() starts one
project = pscad.project("my_case")       # a case loaded in the workspace

for comp in project.find_all("${d.key}"):   # the exact definition, namespace first
    params = comp.parameters()           # every parameter, as PSCAD holds it
${pad(`    print(str(params[${pyStr(p.name)}]))`, 41)}# ${desc}

comp = project.find_all("${d.key}")[0]
${pad(`comp.parameters(${p.name}=${val})`, 41)}# ${why || 'write one parameter'}
`;
  return s;
}

// ---- Pages -----------------------------------------------------------------------------------
const GUIDE = [
  [/^master:(tpflt|tfaultn|tfault|fault_sw|breaker3|breaker1|tbreakn|tbreak|Sequencer_Fault|Sequencer_Breaker)$/, 'fault-studies', 'Fault studies in PSCAD with Python: ride through and critical clearing time'],
  [/^master:(resistor|inductor|capacitor|const|var_switch|fixed_load|source_1|source3|source_3)$/, 'parameter-sweep', 'Sweep a PSCAD parameter with Python'],
  [/^master:(thd|fft|harmdiffmag|cinj|phasorimp|filter|filter-hp|filter-band|cfilter)$/, 'harmonics', 'Harmonics and THD from a PSCAD run'],
  [/^master:(mrun|optimum_run|fileread)$/, 'snapshots-and-batch', 'Snapshots, simulation sets and batch runs'],
  [/^master:(exc\w*|pss|hy_gov|th_gov|hydro_gov|wind_governor|sync_machine|pi_ctlr|Zpi_ctlr|Zleadlag|Zrealpole|Ztrans_fcnZ)$/, 'control-tuning', 'Control tuning: overshoot, rise time and damping'],
  [/^master:(pgb|multimeter|rms3ph|rms-inst|freq-meas|power)$/, 'build-and-run', 'Build and run a PSCAD case from Python'],
];

export function defnPages(all) {
  const { defs } = all;
  const bad = [];
  for (const [key, c] of Object.entries(CURATED)) {
    if (!defs[key]) { bad.push(key); continue; }
    for (const [n] of c.common || []) if (!defs[key].params.some(p => p.name === n)) bad.push(`${key} ${n}`);
  }
  if (bad.length) throw new Error('definitions.mjs names what the reference data does not have: ' + bad.join('; '));

  const order = CATEGORIES.flatMap(([k]) => Object.values(defs).filter(d => d.group === k)
    .sort((a, b) => a.name.localeCompare(b.name, 'en') || a.key.localeCompare(b.key, 'en')).map(d => d.key));
  const catWords = Object.fromEntries(CATEGORIES.map(([k, h]) => [k, h]));
  const pages = [];
  for (const [i, key] of order.entries()) {
    const d = defs[key], cur = CURATED[key];
    const n = d.params.length;
    const nGroups = d.groups.length;
    const nUnit = d.params.filter(p => p.unit).length;
    const what = cur ? cur.what : `${d.name}${d.desc && d.desc !== d.name ? ` (${d.desc})` : ''}, a component of PSCAD's Master Library, filed under ${catWords[d.group].toLowerCase()}.`;
    const desc = [
      `Every parameter of ${key} (${d.name}) in PSCAD: ${n} names with units, defaults, ranges and meaning, and the Python that reads and writes them.`,
      `Every parameter of ${key} (${d.name}) in PSCAD: ${n} names with units, defaults and meaning, with Python.`,
      `All ${n} parameters of ${key} (${d.name}) in PSCAD, with units and defaults.`,
      `All ${n} parameters of ${key} in PSCAD, with units and defaults.`,
    ].find(x => x.length <= 160) || `All parameters of ${key} in PSCAD.`;
    const sections = [];
    const facts = [
      ['Definition', `<code>${esc(key)}</code>`],
      ['PSCAD name', esc(d.name)],
      ['Category', esc(catWords[d.group])],
      ['Parameters', `${n}, in ${nGroups} group${nGroups === 1 ? '' : 's'}${nUnit ? `; ${nUnit} carry a unit` : ''}`],
      ['Read from', `PSCAD ${esc(all.pscad)}, ${esc(all.generated)}`],
    ];
    sections.push(`<section class="dx-sec dx-answer" aria-labelledby="what">
  <h2 id="what">What ${esc(key)} is</h2>
  <p>${esc(what)}</p>
  <dl class="dx-facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
</section>`);
    if (cur && cur.common && cur.common.length) {
      const rows = cur.common.map(([pn, note]) => {
        const p = d.params.find(x => x.name === pn);
        return `<tr><td><code>${esc(pn)}</code></td><td>${esc(p.unit || '') || '·'}</td><td>${esc(p.desc || '')}${note ? `<small>${esc(note)}</small>` : ''}</td></tr>`;
      }).join('\n');
      sections.push(`<section class="dx-sec" aria-labelledby="common">
  <h2 id="common">Most used ${esc(key)} parameters</h2>
  <div class="dx-tw"><table class="dx-attrs"><thead><tr><th>Parameter</th><th>Unit</th><th>Description</th></tr></thead><tbody>
${rows}
</tbody></table></div>
</section>`);
    }
    const notes = [
      'A parameter is named exactly as in the table, letter case included: <code>parameters()</code> gives every one of them in a dictionary, and a name the component does not have is refused.',
      'A value that carries a unit comes back as a number whose unit is only in its text, so read it as text first (<code>str(...)</code>) or the unit is lost. PSCAD keeps a written unit as it is given: <code>"2500 [mohm]"</code> stays in mohm.',
      'A Choice is read and written as its symbol (the capitals in "Written as"), not as the words PSCAD shows in the dialog.',
      '<code>find_all()</code> takes the exact definition only. A wildcard or a bare name without <code>master:</code> comes back empty; the Builder\'s <code>px_find</code> walks the pages for those.',
    ];
    sections.push(adSlot());
    sections.push(`<section class="dx-sec" aria-labelledby="python">
  <h2 id="python">Read and write ${esc(key)} in Python</h2>
  ${pre(snippet(d))}
  <ul class="dx-prose">${notes.map(x => `<li>${x}</li>`).join('')}</ul>
  <p>The Builder's runtime does the same with the unit handled for you: <code>px_get(comp, "${esc(exampleParam(d).name)}")</code> and <code>px_set(...)</code>, which also records the old value so the case is put back at the end. <a href="../../python/getting-started/">Getting started</a> shows them.</p>
</section>`);
    const toc = [], groupsHtml = [];
    for (const [gi, [g, rows]] of d.groups.entries()) {
      const id = 'g' + (gi + 1);
      toc.push(`<li><a href="#${id}">${esc(g)}<span class="dx-n">${rows.length}</span></a></li>`);
      groupsHtml.push(`<section class="dx-sec dx-group" aria-labelledby="${id}">
  <h2 id="${id}">${esc(g)}</h2>
  ${paramTable(rows)}
</section>`);
    }
    const prev = order[i - 1], next = order[i + 1];
    const guide = GUIDE.find(([re]) => re.test(key));
    const related = [
      `<li><a href="../">All ${order.length} definitions in the component reference</a></li>`,
      guide ? `<li><a href="../../python/${guide[1]}/">${esc(guide[2])}</a></li>` : '',
      '<li><a href="../../python/getting-started/">PSCAD automation with Python: getting started</a></li>',
    ].filter(Boolean).join('\n    ');
    const body = endAd(`    <p class="dx-lead">Every parameter of the PSCAD ${esc(d.name)} (<code>${esc(key)}</code>): ${n} names, with the unit, the default and the meaning PSCAD gives each one. Copy a name into <code>parameters()</code>.</p>
${sections.join('\n')}
    <div class="dx-filter" id="dxFilterRow" hidden><input id="dxFilter" type="search" placeholder="Filter by name or meaning, e.g. resistance" aria-label="Filter the parameters"><output id="dxCount" aria-live="polite"></output></div>
    <ul class="dx-toc" aria-label="All ${esc(key)} parameters">${toc.join('')}</ul>
${(groupsHtml.length >= 4 ? [...groupsHtml.slice(0, 2), adSlot(), ...groupsHtml.slice(2)] : groupsHtml).join('\n')}`) + `
    <section class="dx-sec" aria-labelledby="more">
  <h2 id="more">Related</h2>
  <ul class="dx-prose">
    ${related}
  </ul>
  <p class="dx-note">${prev ? `← <a href="../${defs[prev].slug}/"><code>${esc(prev)}</code> ${esc(defs[prev].name)}</a>` : ''}${prev && next ? ' · ' : ''}${next ? `<a href="../${defs[next].slug}/"><code>${esc(next)}</code> ${esc(defs[next].name)}</a> →` : ''}</p>
</section>`;
    const jsonld = [{
      '@context': 'https://schema.org', '@type': 'TechArticle',
      headline: `${key} parameters (PSCAD ${d.name})`,
      description: desc, url: BASE + `reference/${d.slug}/`, inLanguage: 'en', dateModified: UPDATED,
      about: { '@type': 'Thing', name: `${key} (${d.name})`, description: what },
      keywords: [`${key} parameters`, `PSCAD ${d.name} parameters`, `${d.name} PSCAD`, `${key} mhi.pscad`, ...((cur && cur.common) || []).slice(0, 4).map(([p]) => `${p} ${key}`)].join(', '),
      isPartOf: { '@type': 'WebPage', name: 'PSCAD component reference', url: BASE + 'reference/' },
      author: PERSON, publisher: { '@id': PERSON['@id'] },
    }];
    pages.push({
      file: `reference/${d.slug}/index.html`, url: `reference/${d.slug}/`,
      html: page({
        path: `reference/${d.slug}/`, title: `${key} parameters: PSCAD ${d.name} | Adjie Brotools`,
        h1: `${esc(key)} parameters<span class="dx-h1-sub">PSCAD ${esc(d.name)}</span>`, desc,
        ogTitle: `${key} parameters (PSCAD ${d.name})`, crumbs: [['Component reference', 'reference/'], [key, `reference/${d.slug}/`]],
        jsonld, body, script: FILTER_JS,
      }),
    });
  }
  return { pages, order };
}

// A small filter over the long tables; the page works without it (find in page does the same).
const FILTER_JS = `  (function () {
    var box = document.getElementById('dxFilter'), row = document.getElementById('dxFilterRow'), out = document.getElementById('dxCount');
    if (!box) return;
    row.hidden = false;
    var rows = [].slice.call(document.querySelectorAll('.dx-group tbody tr'));
    var secs = [].slice.call(document.querySelectorAll('.dx-group'));
    var timer;
    box.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var q = box.value.trim().toLowerCase(), n = 0;
        rows.forEach(function (tr) { var hit = !q || tr.textContent.toLowerCase().indexOf(q) >= 0; tr.hidden = !hit; if (hit) n++; });
        secs.forEach(function (s) { s.hidden = !!q && !s.querySelector('tbody tr:not([hidden])'); s.style.contentVisibility = q ? 'visible' : ''; });
        out.textContent = q ? n + ' found' : '';
      }, 120);
    });
  })();`;

// ---- The index -------------------------------------------------------------------------------
export function indexPage(all, order) {
  const { defs } = all;
  const n = order.length;
  const total = order.reduce((a, k) => a + defs[k].params.length, 0);
  const QUICK = [
    ['Time a fault', 'TF, DF', 's', 'master:tfaultn'],
    ['Which phases a fault is on', 'A, B, C, G', 'YES or NO', 'master:tpflt'],
    ['Fault resistance', 'RON', 'ohm', 'master:tpflt'],
    ['Time a breaker', 'TO1, TO2', 's', 'master:tbreakn'],
    ['Breaker state at the start', 'BOpen1', 'OPEN or CLOSE', 'master:breaker3'],
    ['A resistance, inductance or capacitance', 'R, L, C', 'ohm, H, uF', 'master:resistor, master:inductor, master:capacitor'],
    ['Grid source voltage', 'Es', 'kV', 'master:source3'],
    ['Single phase source voltage and frequency', 'Vm, f', 'kV, Hz', 'master:source_1'],
    ['The name a channel is read by', 'Name', '', 'master:pgb'],
    ['A set-point held in a constant', 'Value', '', 'master:const'],
    ['Load power', 'PO, QO', 'MW, MVAR', 'master:fixed_load'],
    ['Machine inertia', 'H', 's', 'master:sync_machine'],
    ['Transformer saturation on or off', 'Enab', '', 'master:xfmr-3p2w'],
  ];
  // Each parameter must be on some definition of its row (R, L, C pair with the three passives).
  for (const [, ps, , ks] of QUICK) for (const p of ps.split(', ')) {
    const keys = ks.split(', ');
    for (const k of keys) if (!defs[k]) throw new Error(`reference index: no definition ${k}`);
    if (!keys.some(k => defs[k].params.some(x => x.name === p))) throw new Error(`reference index: no ${p} on ${ks}`);
  }
  const link = (k) => `<a href="${defs[k].slug}/"><code>${esc(k)}</code></a>`;
  const quick = `<div class="dx-tw"><table><thead><tr><th>You want</th><th>Parameter</th><th>Unit or value</th><th>Definition</th></tr></thead><tbody>
${QUICK.map(([w, p, u, k]) => `<tr><td>${esc(w)}</td><td>${p.split(', ').map(x => `<code>${esc(x)}</code>`).join(', ')}</td><td>${esc(u) || '·'}</td><td>${k.split(', ').map(link).join(', ')}</td></tr>`).join('\n')}
</tbody></table></div>`;
  const cats = CATEGORIES.map(([k, h, blurb]) => {
    const list = order.filter(key => defs[key].group === k);
    if (!list.length) return '';
    return `<section class="dx-sec" aria-labelledby="cat-${slugOf(k)}">
  <h2 id="cat-${slugOf(k)}">${esc(h)}</h2>
  <p class="dx-note">${esc(blurb)}</p>
  <ul class="dx-classes">
${list.map(key => `    <li><a href="${defs[key].slug}/"><code>${esc(key)}</code><span>${esc(defs[key].name)} · ${defs[key].params.length} parameters</span></a></li>`).join('\n')}
  </ul>
</section>`;
  }).join('\n');
  const body = `    <p class="dx-lead">Every parameter of every component in PSCAD's Master Library, read out of PSCAD ${esc(all.pscad)} itself: ${n} definitions and ${total.toLocaleString('en-AU')} parameters, each with its unit, default, range and meaning, and the symbol each Choice is written as from a script.</p>
    <section class="dx-sec dx-answer" aria-labelledby="quick">
  <h2 id="quick">The parameters people look up most</h2>
  ${quick}
  <p class="dx-note">PSCAD has no event list: a fault or a switching is a component drawn in the case, and a script times it by writing that component's parameters. The Three Phase Fault takes its timing from the Timed Fault Logic wired to it, which is why the timing is on <code>master:tfaultn</code>.</p>
</section>
    <section class="dx-sec" aria-labelledby="names">
  <h2 id="names">How a definition and a parameter are named</h2>
  <dl class="dx-facts">
    <dt>Definition</dt><dd>Namespace first, then the name, as PSCAD writes it: <code>master:resistor</code>, <code>master:xfmr-3p2w</code>. A component defined in the case itself has the case's own namespace.</dd>
    <dt>Parameter</dt><dd>The short name in the first column, letter case included: <code>R</code>, <code>RON</code>, <code>Vm</code>. The description is what the component's dialog shows.</dd>
    <dt>Unit</dt><dd>A number that carries a unit is written with it, <code>"0.05 [ohm]"</code>, and PSCAD keeps the unit you give rather than converting it.</dd>
    <dt>Choice</dt><dd>Written as its symbol: <code>"YES"</code>, <code>"BEHIND_SOURCE_IMPEDANCE"</code>. The words in the dialog are not accepted.</dd>
    <dt>Used when</dt><dd>A parameter that only counts in some settings of another one, as the dialog shows or hides it.</dd>
  </dl>
</section>
${adSlot()}
    <section class="dx-sec" aria-labelledby="python">
  <h2 id="python">Read and write any parameter</h2>
  ${pre(`import mhi.pscad

pscad = mhi.pscad.connect()                # the PSCAD that is open; launch() starts one
project = pscad.project("my_case")         # a case loaded in the workspace

for r in project.find_all("master:resistor"):
    print(str(r.parameters()["R"]))         # its text carries the unit

flt = project.find_all("master:tfaultn")[0]
flt.parameters(TF="1.0 [s]", DF="0.12 [s]")  # fault at 1 s for 120 ms

project.run()                              # build if needed, then run the EMT simulation`)}
  <p>New to it? <a href="../python/getting-started/">Start with the PSCAD Python guide</a>, or <a href="../python/">see every study you can automate</a>. The <a href="../builder/">Workflow Builder</a> writes the whole script from blocks, and its component picker reads these same definitions.</p>
</section>
${cats}`;
  const desc = `Every PSCAD Master Library component parameter for Python scripting: ${n} definitions, ${total.toLocaleString('en-AU')} parameters with units, defaults and Choice symbols.`;
  const jsonld = [{
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: 'PSCAD component reference', description: desc, url: BASE + 'reference/', inLanguage: 'en', dateModified: UPDATED,
    isPartOf: { '@type': 'WebApplication', name: 'PSCAD Scripter', url: BASE },
    hasPart: order.map(k => ({ '@type': 'TechArticle', name: `${k} parameters`, url: BASE + `reference/${defs[k].slug}/` })),
    author: PERSON, publisher: { '@id': PERSON['@id'] },
  }];
  return {
    file: 'reference/index.html', url: 'reference/',
    html: page({ path: 'reference/', title: 'PSCAD component reference: every parameter name | Adjie Brotools', h1: 'PSCAD component reference', desc, ogTitle: 'PSCAD component reference', crumbs: [['Component reference', 'reference/']], jsonld, body }),
  };
}
