// The component reference: reference/index.html and one page per Master Library definition,
// reference/<slug>/, from ../reference/components.json (read out of a running PSCAD by
// _audit/reference/build_reference.py) and the curated layer in definitions.mjs.

import fs from 'node:fs';
import path from 'node:path';
import { page, esc, pre, PERSON, BASE, adSlot, endAd } from './lib.mjs';
import { CATEGORIES, NOTABLE, QUICK, UPDATED } from './definitions.mjs';

// A definition's address, frozen once published: master:xfmr-3p2w -> xfmr-3p2w.
export const slug = (key) => key.split(':').slice(1).join(':').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---- Data ----------------------------------------------------------------------------------
// PSCAD's own words come through as they are, with one exception: an em-dash or en-dash in a
// parameter's description or help is written as a hyphen, because the house rule for this site
// is that no page text carries one. Nothing else about the text is touched.
const dashes = (v) => {
  if (typeof v === 'string') return v.replace(/\s*[—–]\s*/g, ' - ');
  if (Array.isArray(v)) return v.map(dashes);
  if (v && typeof v === 'object') { for (const k of Object.keys(v)) v[k] = dashes(v[k]); return v; }
  return v;
};

export function loadAll(pxDir) {
  const raw = dashes(JSON.parse(fs.readFileSync(path.join(pxDir, 'reference', 'components.json'), 'utf8')));
  const out = {};
  for (const [key, rec] of Object.entries(raw.defs)) {
    const params = Object.values(rec.params || {}).sort((a, b) => (a.i ?? 0) - (b.i ?? 0) || a.name.localeCompare(b.name));
    // The form's own sections, in the form's own order. Older data has no `groups`: fall back
    // to the order the parameters themselves give, which is the same thing when `i` is there.
    const groups = (rec.groups && rec.groups.length ? rec.groups : [...new Set(params.map(p => p.group || ''))])
      .filter(g => params.some(p => (p.group || '') === g));
    out[key] = {
      key, slug: slug(key), name: rec.name || key, desc: rec.desc || '',
      group: rec.group || 'Other', groups, params,
      nParams: params.length,
      pscad: raw.pscad || '5.0.0',
    };
  }
  return out;
}

// ---- Bits of a page ------------------------------------------------------------------------
const UNITLESS = new Set(['', '0', '1']);
const unitOf = (p) => (p.unit && !UNITLESS.has(p.unit) ? p.unit : '');
// PSCAD writes "0" for both ends when a parameter has no range of its own.
function rangeOf(p) {
  const lo = p.min, hi = p.max;
  if (lo === undefined || hi === undefined) return '';
  if (String(lo) === '0' && String(hi) === '0') return '';
  return `${lo} to ${hi}`;
}
// A section heading reads "Monitoring of Magnetic Core:1": the :N is the column it sits in.
const groupName = (g) => (g || 'Parameters').replace(/:\d+$/, '').trim() || 'Parameters';
const groupId = (g, i) => 'g' + i + '-' + (groupName(g).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section');

// PSCAD gives a Choice's default as the position in its own list, not as the value you write.
// The page shows the value, because that is what a script passes.
function defaultOf(p) {
  const d = p.default;
  if (d === undefined || d === '') return '';
  if (p.type === 'Choice' && p.options && /^\d+$/.test(String(d))) {
    const pick = p.options[Number(d)];
    if (pick) return pick[1] && pick[1] !== pick[0] ? `${pick[0]} (${pick[1]})` : pick[0];
  }
  return String(d);
}

function paramRow(p) {
  const bits = [];
  if (p.help && p.help !== p.desc) bits.push(esc(p.help).replace(/([^.!?:])$/, '$1.'));
  if (p.options && p.options.length) {
    bits.push('Takes ' + p.options.map(([v, label]) => `<code>${esc(v)}</code>${label && label !== v ? ` ${esc(label)}` : ''}`).join(', ') + '.');
  } else if (p.choices && p.choices.length) {
    bits.push('One of: ' + p.choices.map(c => esc(String(c).replace(/^\d+\s*=\s*/, ''))).join(', ') + '.');
  }
  if (p.when) bits.push(`Used only when <code>${esc(p.when)}</code>.`);
  if (p.dim && String(p.dim) !== '1') bits.push(`An array of ${esc(p.dim)}.`);
  const more = bits.length ? `<small>${bits.join(' ')}</small>` : '';
  return `<tr><td><code>${esc(p.name)}</code></td><td>${esc(unitOf(p)) || '<span aria-label="no unit">·</span>'}</td><td>${esc(p.type || '')}</td><td>${esc(rangeOf(p)) || '·'}</td><td>${esc(defaultOf(p)) || '·'}</td><td>${esc(p.desc || '')}${more}</td></tr>`;
}
const paramTable = (rows) => `<div class="dx-tw"><table class="dx-attrs"><thead><tr><th>Parameter</th><th>Unit</th><th>Type</th><th>Range</th><th>Default</th><th>What it is</th></tr></thead><tbody>
${rows.map(paramRow).join('\n')}
</tbody></table></div>`;

// ---- The Python example ---------------------------------------------------------------------
const pyLit = (p) => {
  const u = unitOf(p);
  const d = p.default;
  if (p.type === 'Choice') {
    const pick = p.options && /^\d+$/.test(String(d)) ? p.options[Number(d)] : null;
    return JSON.stringify(String(pick ? pick[0] : (p.options && p.options[0] ? p.options[0][0] : d ?? '0')));
  }
  if (p.type === 'Text') return JSON.stringify(String(d ?? 'name'));
  const n = d !== undefined && d !== '' && !Number.isNaN(Number(d)) ? Number(d) : 1;
  return u ? JSON.stringify(`${n} [${u}]`) : String(n);
};

function snippet(d) {
  const meta = NOTABLE[d.key];
  const names = (meta && meta.common ? meta.common : d.params.filter(p => p.type === 'Real' || p.type === 'Integer').map(p => p.name)).slice(0, 3);
  const chosen = names.map(n => d.params.find(p => p.name === n)).filter(Boolean);
  const write = chosen.length
    ? `comp.parameters(${chosen.map(p => `${p.name}=${pyLit(p)}`).join(', ')})`
    : 'comp.parameters(**values)';
  const read = chosen.length ? chosen[0].name : (d.params[0] && d.params[0].name) || 'name';
  return `import mhi.pscad

pscad = mhi.pscad.connect()                # launch() starts a new PSCAD instead
project = pscad.project("mycase")

# find_all takes the definition exactly: no wildcard, and the namespace is not optional.
for comp in project.find_all("${d.key}"):
    print(comp.name, comp.parameters())

comp = project.find_all("${d.key}")[0]
${write}
print(comp.parameters()["${read}"])`;
}

// ---- One page per definition ------------------------------------------------------------------
export function defnPages(all) {
  // Published in the order of the index: group first, then the name a reader sees.
  const catOrder = new Map(CATEGORIES.map(([g], i) => [g, i]));
  const order = Object.values(all).filter(d => d.nParams > 0)
    .sort((a, b) => (catOrder.get(a.group) ?? 99) - (catOrder.get(b.group) ?? 99) || a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug))
    .map(d => d.key);
  const pages = [];
  for (let i = 0; i < order.length; i++) {
    const d = all[order[i]];
    const meta = NOTABLE[d.key];
    const title = `${d.name} (${d.key}) parameters`;
    const counts = `${d.nParams} parameter${d.nParams === 1 ? '' : 's'}`;
    const desc = `Every parameter of the PSCAD ${d.name} (${d.key}): ${counts}, with units, ranges, defaults and the Python that reads and writes them.`.slice(0, 300);
    const shortDesc = desc.length <= 160 ? desc : `All ${d.key} parameters in PSCAD ${d.pscad}: ${counts}, with units, ranges, defaults and Python.`;
    const facts = [
      ['Definition', `<code>${esc(d.key)}</code>`],
      ['PSCAD name', esc(d.name)],
      ['Library group', esc(d.group)],
      ['Parameters', `${counts}${d.groups.length > 1 ? `, in ${d.groups.length} sections of the dialog` : ''}`],
      d.desc && d.desc !== d.name ? ['Description', esc(d.desc)] : null,
    ].filter(Boolean);
    const sections = [];
    sections.push(`<section class="dx-sec dx-answer" aria-labelledby="what">
  <h2 id="what">What ${esc(d.name)} is</h2>
  <p>${meta ? meta.what : `${esc(d.name)} is a Master Library definition in the ${esc(d.group)} group of PSCAD ${esc(d.pscad)}. ${d.desc && d.desc !== d.name ? esc(d.desc) + '. ' : ''}Its ${counts} are listed below as PSCAD itself reports them, with the unit, range and default of each.`}</p>
  <dl class="dx-facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
</section>`);
    if (meta && meta.common && meta.common.length) {
      const rows = meta.common.map(n => {
        const p = d.params.find(x => x.name === n);
        if (!p) throw new Error(`definitions.mjs: ${d.key} has no parameter ${n}`);
        return p;
      });
      sections.push(`<section class="dx-sec" aria-labelledby="common">
  <h2 id="common">The ${esc(d.name)} parameters you reach for first</h2>
  ${paramTable(rows)}
</section>`);
    }
    sections.push(adSlot());
    const notes = [
      'A value carries its unit in the text: <code>"250 [MVA]"</code>. PSCAD keeps the unit you write rather than converting it, so <code>"2500 [mohm]"</code> stays in milliohms and reads back that way.',
      'A parameter read back is a subclass of <code>float</code> whose unit lives only in its text, so read it as text first if you need the unit.',
      d.params.some(p => p.when) ? 'A parameter with a condition in the last column is only used while that condition holds. Writing it otherwise is accepted and ignored by the solution.' : '',
      'The case has to be built again after a parameter changes, and <code>project.build()</code> reports the compiler\'s own lines.',
    ].filter(Boolean);
    sections.push(`<section class="dx-sec" aria-labelledby="python">
  <h2 id="python">Read and write ${esc(d.name)} in Python</h2>
  ${pre(snippet(d))}
  <ul class="dx-prose">${notes.map(n => `<li>${n}</li>`).join('')}</ul>
</section>`);
    // every parameter, one section per section of the dialog
    const toc = [];
    const groupsHtml = [];
    d.groups.forEach((g, gi) => {
      const rows = d.params.filter(p => (p.group || '') === g);
      if (!rows.length) return;
      const id = groupId(g, gi);
      const h = groupName(g);
      toc.push(`<li><a href="#${id}">${esc(h)}<span class="dx-n">${rows.length}</span></a></li>`);
      groupsHtml.push(`<section class="dx-sec dx-group" aria-labelledby="${id}">
  <h2 id="${id}">${esc(h)}</h2>
  ${paramTable(rows)}
</section>`);
    });
    const prev = order[i - 1] && all[order[i - 1]], next = order[i + 1] && all[order[i + 1]];
    const related = [
      `<li><a href="../">All ${Object.values(all).filter(x => x.nParams > 0).length} definitions in the component reference</a></li>`,
      '<li><a href="../../python/getting-started/">PSCAD Python automation: getting started</a></li>',
      d.group === 'Switching' ? '<li><a href="../../python/fault-studies/">Fault ride through and critical clearing time</a></li>' : '',
      d.group === 'Meters' ? '<li><a href="../../python/harmonics/">Harmonics and THD from an EMT run</a></li>' : '',
      ['Sources', 'Machines', 'Transformers', 'Passive', 'Lines and cables'].includes(d.group) ? '<li><a href="../../python/parameter-sweep/">Sweep a parameter and collect the results</a></li>' : '',
      d.group === 'Control' ? '<li><a href="../../python/control-tuning/">Tune a control with a search</a></li>' : '',
      '<li><a href="../../builder/">Build the script in the Workflow Builder</a></li>',
    ].filter(Boolean).join('\n    ');
    const body = endAd(`    <p class="dx-lead">Every parameter of the PSCAD ${esc(d.name)} (<code>${esc(d.key)}</code>): ${counts}, with the unit, range and default PSCAD ${esc(d.pscad)} reports for each.</p>
${sections.join('\n')}
    <div class="dx-filter" id="dxFilterRow" hidden><input id="dxFilter" type="search" placeholder="Filter by name or meaning, e.g. voltage or Tmva" aria-label="Filter the parameters"><output id="dxCount" aria-live="polite"></output></div>
    <ul class="dx-toc" aria-label="All ${esc(d.name)} parameters">${toc.join('')}</ul>
${(groupsHtml.length >= 4 ? [...groupsHtml.slice(0, 2), adSlot(), ...groupsHtml.slice(2)] : groupsHtml).join('\n')}`) + `
    <section class="dx-sec" aria-labelledby="more">
  <h2 id="more">Related</h2>
  <ul class="dx-prose">
    ${related}
  </ul>
  <p class="dx-note">${prev ? `← <a href="../${prev.slug}/">${esc(prev.name)}</a>` : ''}${prev && next ? ' · ' : ''}${next ? `<a href="../${next.slug}/">${esc(next.name)}</a> →` : ''}</p>
</section>`;
    const jsonld = [{
      '@context': 'https://schema.org', '@type': 'TechArticle',
      headline: `${d.name} (${d.key}) parameters`,
      description: shortDesc,
      url: BASE + `reference/${d.slug}/`,
      inLanguage: 'en', dateModified: UPDATED,
      about: { '@type': 'Thing', name: `${d.key} (${d.name})`, description: meta ? meta.what : `The PSCAD Master Library definition ${d.key}.` },
      keywords: [`${d.key} parameters`, `PSCAD ${d.name} parameters`, `${d.name} PSCAD`, `${d.key} Python`, ...(meta && meta.common ? meta.common.slice(0, 4).map(n => `${d.key} ${n}`) : [])].join(', '),
      isPartOf: { '@type': 'WebPage', name: 'PSCAD component reference', url: BASE + 'reference/' },
      author: PERSON, publisher: { '@id': PERSON['@id'] },
    }];
    pages.push({
      file: `reference/${d.slug}/index.html`,
      url: `reference/${d.slug}/`,
      html: page({
        path: `reference/${d.slug}/`,
        title: `${d.name} parameters (${d.key}) | Adjie Brotools`,
        h1: `${esc(d.name)}<span class="dx-h1-sub">${esc(d.key)}</span>`,
        desc: shortDesc, ogTitle: title,
        crumbs: [['Component reference', 'reference/'], [d.name, `reference/${d.slug}/`]],
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
  const defs = Object.values(all);
  const withParams = defs.filter(d => d.nParams > 0);
  const bare = defs.filter(d => d.nParams === 0).sort((a, b) => a.name.localeCompare(b.name));
  const totalParams = withParams.reduce((a, d) => a + d.nParams, 0);
  const pscad = defs[0] ? defs[0].pscad : '5.0.0';
  const quick = `<div class="dx-tw"><table><thead><tr><th>You want</th><th>Component</th><th>Parameter</th><th>Unit</th><th>Note</th></tr></thead><tbody>
${QUICK.map(([want, key, ps, unit, note]) => {
    const d = all[key];
    if (!d) throw new Error(`definitions.mjs QUICK: no definition ${key}`);
    for (const n of ps.split(', ')) if (!d.params.some(p => p.name === n) && !['R', 'L', 'C'].includes(n)) throw new Error(`definitions.mjs QUICK: ${key} has no parameter ${n}`);
    return `<tr><td>${esc(want)}</td><td><a href="${d.slug}/">${esc(d.name)}</a></td><td>${ps.split(', ').map(n => `<code>${esc(n)}</code>`).join(', ')}</td><td>${esc(unit) || '·'}</td><td>${esc(note)}</td></tr>`;
  }).join('\n')}
</tbody></table></div>`;
  const facts = [
    ['A definition name', 'Always namespaced: <code>master:tpflt</code>, never <code>tpflt</code>. <code>Project.find_all()</code> matches it exactly, with no wildcards, so a bare name or a pattern comes back empty.'],
    ['A value and its unit', 'Written together as text: <code>"250 [MVA]"</code>, <code>"2.5 [ohm]"</code>. PSCAD stores the unit you wrote rather than normalising it.'],
    ['Reading a value back', 'A unit-carrying value is a subclass of <code>float</code> and its unit lives only in its text, so read it as text before you read it as a number.'],
    ['Type', 'Real, Integer, Text, Choice, Boolean or Table, as PSCAD reports it. A Choice is written with its symbolic value, which this reference lists beside the label.'],
    ['Range and default', 'As the component dialog gives them. A range of <code>0 to 0</code> means the dialog sets none, not that the value must be zero.'],
    ['A condition', 'Some parameters only matter while another is set a certain way. The reference shows the condition PSCAD itself carries.'],
  ];
  const cats = [...CATEGORIES.map(([g]) => g), ...new Set(withParams.map(d => d.group))]
    .filter((g, i, a) => a.indexOf(g) === i);
  const catsHtml = cats.map((g) => {
    const row = CATEGORIES.find(c => c[0] === g);
    const list = order.map(k => all[k]).filter(d => d.group === g);
    if (!list.length) return '';
    const id = 'cat-' + g.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `<section class="dx-sec" aria-labelledby="${id}">
  <h2 id="${id}">${esc(row ? row[1] : g)}<span class="dx-n">${list.length}</span></h2>
  ${row ? `<p class="dx-note">${esc(row[2])}</p>` : ''}
  <ul class="dx-classes">
${list.map(d => `    <li><a href="${d.slug}/"><code>${esc(d.key)}</code><span>${esc(d.name)} · ${d.nParams} parameter${d.nParams === 1 ? '' : 's'}</span></a></li>`).join('\n')}
  </ul>
</section>`;
  }).join('\n');
  const bareHtml = bare.length ? `<section class="dx-sec" aria-labelledby="bare">
  <h2 id="bare">Definitions with nothing to set<span class="dx-n">${bare.length}</span></h2>
  <p class="dx-note">These have no parameters of their own, so they have no page. Some are the library's own pages rather than components; the rest are wires and markers, such as a ground or a jumper, that a script places and never writes to.</p>
  <p class="dx-prose">${bare.map(d => `<code>${esc(d.key)}</code>`).join(', ')}</p>
</section>` : '';
  const body = endAd(`    <p class="dx-lead">Every parameter of every PSCAD Master Library definition, read out of PSCAD ${esc(pscad)} itself rather than typed in by hand: ${withParams.length} components, ${totalParams.toLocaleString('en-AU')} parameters, each with its unit, range, default and the Python that writes it.</p>
    <section class="dx-sec dx-answer" aria-labelledby="quick">
  <h2 id="quick">The parameters people look up most</h2>
  ${quick}
  <p class="dx-note">A resistor, an inductor and a capacitor each hold one parameter, named <code>R</code>, <code>L</code> and <code>C</code>.</p>
</section>
    <section class="dx-sec" aria-labelledby="how">
  <h2 id="how">How a PSCAD parameter is named, written and read</h2>
  <dl class="dx-facts">${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>
</section>
${adSlot()}
    <section class="dx-sec" aria-labelledby="python">
  <h2 id="python">Read and write any component</h2>
  ${pre(`import mhi.pscad

pscad = mhi.pscad.connect()                # launch() starts a new PSCAD instead
project = pscad.project("mycase")

for comp in project.find_all("master:tpflt"):        # the definition, exactly
    print(comp.name, comp.parameters())

fault = project.find_all("master:tfaultn")[0]
fault.parameters(TF="1.0 [s]", DF="0.12 [s]")        # apply at 1 s, clear 120 ms later

project.build()                                       # Fortran again, before the next run
project.run()`)}
  <p>New to this? <a href="../python/getting-started/">Start with the PSCAD Python guide</a>, or <a href="../python/">see every study you can automate</a>. The <a href="../builder/">Workflow Builder</a> writes all of it for you.</p>
</section>
${catsHtml}
${bareHtml}`);
  const desc = `Every PSCAD Master Library parameter, read out of PSCAD ${pscad}: ${withParams.length} components, ${totalParams.toLocaleString('en-AU')} parameters with units, ranges, defaults and Python.`;
  const jsonld = [{
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: 'PSCAD component reference',
    description: desc, url: BASE + 'reference/', inLanguage: 'en', dateModified: UPDATED,
    isPartOf: { '@type': 'WebApplication', name: 'PSCAD Scripter', url: BASE },
    hasPart: order.map(k => ({ '@type': 'TechArticle', name: `${all[k].name} parameters`, url: BASE + `reference/${all[k].slug}/` })),
    author: PERSON, publisher: { '@id': PERSON['@id'] },
  }];
  return {
    file: 'reference/index.html', url: 'reference/',
    html: page({ path: 'reference/', title: 'PSCAD component reference: every Master Library parameter | Adjie Brotools', h1: 'PSCAD component reference', desc, ogTitle: 'PSCAD component reference', ogType: 'website', crumbs: [['Component reference', 'reference/']], jsonld, body }),
  };
}
