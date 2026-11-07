// The PSCAD study guides: python/index.html (the hub) and python/<slug>/index.html, one page per
// study, all with the same structure. A guide's words are in tasks/<slug>.mjs; the Python it
// shows is generated here by the Builder's own generator over the Quick Start the guide opens,
// so the file on the page is the file the Builder writes, character for character.
//
// There are no recorded result numbers on these pages, and that is on purpose: PSCAD is an EMT
// simulator and every number depends on the reader's own case. Each guide shows the method, the
// script and the columns the script writes, and leaves the values to the run.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { page, esc, pre, py, table, PERSON, BASE, adSlot, endAd } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PSCAD = path.resolve(HERE, '..');
const BUILDER = path.join(PSCAD, 'builder');
const UPDATED = '2026-11-07';

// The guides, in the hub's order. Their slugs are the page addresses: frozen once published.
export const ORDER = ['getting-started', 'build-and-run', 'fault-studies', 'parameter-sweep',
  'harmonics', 'snapshots-and-batch', 'control-tuning'];

// Which Quick Start each guide opens in the Builder (builder/#qs=<id>, ids frozen in
// builder/templates/index.json). A guide that covers two studies names the second in its own
// prose: fault-studies also opens cct, snapshots-and-batch also opens parallel.
export const QS = {
  'getting-started': 'build-check',
  'build-and-run': 'build-check',
  'fault-studies': 'frt',
  'parameter-sweep': 'sweep',
  'harmonics': 'harmonics',
  'snapshots-and-batch': 'snapshot',
  'control-tuning': 'damping',
};

// Sources are read with LF line ends whatever the checkout has (a Windows checkout gives CRLF),
// so the pages and the .py downloads come out the same on every machine, as the site serves them.
const lf = (s) => s.replace(/\r\n/g, '\n');

// How many Master Library definitions the component reference holds, read from the data itself.
export function definitionCount() {
  const f = path.join(PSCAD, 'reference', 'definitions.json');
  if (!fs.existsSync(f)) return 0;
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  return Array.isArray(d.defs) ? d.defs.length : Object.keys(d.defs || {}).length;
}
export function pscadVersion() {
  const f = path.join(PSCAD, 'reference', 'definitions.json');
  if (!fs.existsSync(f)) return '';
  return String(JSON.parse(fs.readFileSync(f, 'utf8')).pscad || '');
}

// ---- The Builder's own script for a Quick Start ------------------------------------------------
let gen = null;
async function generator() {
  if (gen) return gen;
  const imp = (rel) => import(pathToFileURL(path.join(BUILDER, rel)).href);
  await imp('js/blocks/index.js');
  const { generate } = await imp('js/core/codegen.js');
  const { RUNTIME_FILES } = await imp('js/core/runtime-loader.js');
  const runtime = {};
  for (const f of RUNTIME_FILES) runtime[f] = lf(fs.readFileSync(path.join(BUILDER, 'runtime', f), 'utf8'));
  const index = JSON.parse(fs.readFileSync(path.join(BUILDER, 'templates', 'index.json'), 'utf8'));
  const templates = {};
  for (const t of index.templates) {
    templates[t.id] = { ...t, json: JSON.parse(fs.readFileSync(path.join(BUILDER, 'templates', t.file), 'utf8')) };
  }
  gen = { generate, runtime, templates };
  return gen;
}

// A component query as a block's Component setting holds it: a definition name, a Name, and how
// many it may match.
const EL = (cls, name = '', match = 'one') => ({ cls, name, match });

// builderScript('frt', ({ set, EL }) => set('n1', { project: '...' }))
// `fill` patches the Quick Start the way a reader would before pressing Download: the case to
// open, the component to work on, the channel names of that case. The generator then writes the
// file. A Quick Start that still has an error or a to-do after the fill stops the build, because
// the page would be showing a script that does not run.
export async function builderScript(id, fill) {
  const g = await generator();
  const t = g.templates[id];
  if (!t) throw new Error('no Quick Start ' + id);
  const wf = JSON.parse(JSON.stringify(t.json));
  const set = (nid, patch) => {
    const n = wf.nodes.find(x => x.id === nid);
    if (!n) throw new Error(`${id}: no node ${nid} to fill`);
    n.s = { ...n.s, ...patch };
  };
  if (fill) fill({ set, EL, wf });
  const r = g.generate(wf, { runtime: g.runtime });
  const bad = r.problems.filter(p => p.level === 'error' || p.level === 'todo');
  if (bad.length) throw new Error(`${id}: the filled Quick Start still has problems: ${bad.map(p => p.msg).join(' | ')}`);
  const code = lf(r.code);
  const cut = code.indexOf('# ==== HELPERS');
  if (cut < 0) throw new Error(`${id}: the generated file has no helper section to split on`);
  return {
    id, title: t.title, desc: t.desc, code,
    readable: code.slice(0, cut).replace(/\s+$/, '') + '\n',
    helpers: code.slice(cut),
    lines: code.split('\n').length,
    warnings: r.problems.filter(p => p.level === 'warning').map(p => p.msg),
  };
}

// The generated script as a reader opens it: its settings and workflow on the page, the whole
// file (with the helper functions the Builder copies in) published next to the page as a .py.
export function builderBlock(b, intro, notes, fileName) {
  b.fileName = fileName;
  const helperLines = b.helpers.split('\n').length;
  return `  <p>${intro}</p>
  <p class="dx-file"><span><code>${esc(fileName)}</code> as the Builder writes it: the settings and the workflow</span><a href="${esc(fileName)}" download>⬇ Download the full file (.py, ${b.lines.toLocaleString('en-AU')} lines)</a></p>
  <pre><code class="language-python">${py(b.readable)}</code></pre>
  <p class="dx-note">The file goes on with ${helperLines.toLocaleString('en-AU')} lines of helper functions copied from the Builder's runtime (connecting, building, running, reading the channels, the checks, tables, graphs, putting values back), only those this workflow needs. The download has them all.</p>
  <h3>How the script works</h3>
  <ul class="dx-prose">
${notes.map(n => `    <li>${n}</li>`).join('\n')}
  </ul>`;
}

// A second generated script on a page, shown without a download: the workflow part only.
export function builderExtra(b, intro, fileName) {
  if (fileName) b.fileName = fileName;
  const link = fileName
    ? `<a href="${esc(fileName)}" download>⬇ Download the full file (.py, ${b.lines.toLocaleString('en-AU')} lines)</a>`
    : '';
  return `  <p>${intro}</p>
  <p class="dx-file"><span>The ${esc(b.title)} Quick Start, as the Builder writes it</span>${link}</p>
  <pre><code class="language-python">${py(b.readable)}</code></pre>`;
}

// ---- One guide page ---------------------------------------------------------------------------
// spec: { slug, crumb, card, title, h1, desc, lead, qs, qsTitle, keywords, about, level,
//   whatTitle, sections: { what, method, builder, pitfalls[], faq[[q, a]] } }
function guidePage(spec, specs) {
  const s = spec.sections;
  const toc = [['what', spec.whatTitle], ['method', spec.methodTitle || 'The method'],
    ['builder', 'The full Python script'], ['pitfalls', 'Pitfalls'], ['faq', 'Questions']]
    .filter(([id]) => id !== 'faq' || (s.faq && s.faq.length));
  const cta = spec.qs ? `<div class="dx-cta">
  <p><strong>Open this in the Builder.</strong> The ${esc(spec.qsTitle)} Quick Start loads in the PSCAD Workflow Builder, ready for your own case. Change any block and download the Python file.</p>
  <a class="btn-primary" href="../../builder/#qs=${esc(spec.qs)}">Open in the Builder</a>
</div>` : '';
  const others = ORDER.filter(x => x !== spec.slug).map(x => specs[x])
    .map(o => `<li><a href="../${o.slug}/">${esc(o.card)}</a></li>`).join('\n    ');
  const body = endAd(`    <p class="dx-lead">${spec.lead}</p>
    <ul class="dx-toc" aria-label="On this page">${toc.map(([id, t]) => `<li><a href="#${id}">${esc(t)}</a></li>`).join('')}</ul>
    <section class="dx-sec dx-answer" aria-labelledby="what">
  <h2 id="what">${esc(spec.whatTitle)}</h2>
${s.what}
</section>
${adSlot()}
    <section class="dx-sec" aria-labelledby="method">
  <h2 id="method">${esc(spec.methodTitle || 'The method')}</h2>
${s.method}
</section>
${cta}
    <section class="dx-sec" aria-labelledby="builder">
  <h2 id="builder">${esc(spec.builderTitle || 'The full Python script from the Builder')}</h2>
${s.builder}
</section>
${adSlot()}
    <section class="dx-sec" aria-labelledby="pitfalls">
  <h2 id="pitfalls">Pitfalls</h2>
  <ul class="dx-prose">
${s.pitfalls.map(p => `    <li>${p}</li>`).join('\n')}
  </ul>
</section>
${s.faq && s.faq.length ? `    <section class="dx-sec" aria-labelledby="faq">
  <h2 id="faq">Questions</h2>
${s.faq.map(([q, a]) => `  <h3>${esc(q)}</h3>\n  <p>${a}</p>`).join('\n')}
</section>` : ''}`) + `
    <section class="dx-sec" aria-labelledby="more">
  <h2 id="more">Related</h2>
  <ul class="dx-prose">
    <li><a href="../">Automate PSCAD studies with Python: every guide</a></li>
    ${others}
  </ul>
  <p>Every parameter name a script writes is in the <a href="../../reference/">component reference</a>, read out of PSCAD itself. The <a href="../../builder/">Workflow Builder</a> writes the Python from blocks.</p>
</section>`;
  const plain = (h) => String(h).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
  const jsonld = [{
    '@context': 'https://schema.org', '@type': 'TechArticle',
    headline: spec.h1Plain || plain(spec.h1),
    description: spec.desc, url: BASE + `python/${spec.slug}/`, inLanguage: 'en', dateModified: UPDATED,
    proficiencyLevel: spec.level || 'Beginner',
    dependencies: 'PSCAD 5 with the EMTDC solver, and the PSCAD Automation Library (mhi-pscad) on Python 3.7 or newer',
    keywords: (spec.keywords || []).join(', '),
    about: (spec.about || []).map(a => ({ '@type': 'Thing', name: a })),
    isPartOf: { '@type': 'WebPage', name: 'Automate PSCAD studies with Python', url: BASE + 'python/' },
    author: PERSON, publisher: { '@id': PERSON['@id'] },
  }];
  if (s.faq && s.faq.length) jsonld.push({
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: s.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: plain(a) } })),
  });
  const extra = (spec.builderFiles || []).map(f => ({ file: `python/${spec.slug}/${f.name}`, content: f.code }));
  return {
    file: `python/${spec.slug}/index.html`, url: `python/${spec.slug}/`, extra,
    html: page({
      path: `python/${spec.slug}/`, title: spec.title, h1: spec.h1, desc: spec.desc,
      ogTitle: spec.h1Plain || plain(spec.h1),
      crumbs: [['Python automation', 'python/'], [spec.crumb, `python/${spec.slug}/`]], jsonld, body,
    }),
  };
}

// ---- Every page ------------------------------------------------------------------------------
// `all` is the reference data when the build has it; the guides do not need it, so a build that
// only writes the guides may leave it out.
export async function taskPages(all) {
  const specs = {};
  for (const slug of ORDER) {
    const made = [];
    const ctx = {
      esc, pre, py, table, adSlot, builderBlock, builderExtra, all,
      qs: QS[slug],
      builderScript: async (id, fill) => { const b = await builderScript(id, fill); made.push(b); return b; },
    };
    const mod = await import(pathToFileURL(path.join(HERE, 'tasks', slug + '.mjs')).href);
    specs[slug] = await mod.default(ctx);
    if (specs[slug].slug !== slug) throw new Error(`tasks/${slug}.mjs says it is ${specs[slug].slug}`);
    specs[slug].builderFiles = made.filter(b => b.fileName).map(b => ({ name: b.fileName, code: b.code }));
    if (!specs[slug].qs) specs[slug].qs = QS[slug];
  }
  const pages = ORDER.map(slug => guidePage(specs[slug], specs));
  const hub = await import(pathToFileURL(path.join(HERE, 'tasks', 'hub.mjs')).href);
  pages.unshift(await hub.default({
    specs, ORDER, QS, page, PERSON, BASE, UPDATED, esc, pre, py, table, adSlot, all,
    definitionCount, pscadVersion,
  }));
  return pages;
}
