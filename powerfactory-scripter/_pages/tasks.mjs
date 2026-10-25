// The Python study guides: python/index.html (the hub) and python/<slug>/index.html, one page per
// study, all with the same structure. A guide's words are in tasks/<slug>.mjs; its numbers come
// from results/<script>.json, written by running scripts/<script>.py on PowerFactory's example
// projects; its "generated Python" is the Builder's own output for the Quick Start it opens.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { page, esc, pre, py, PERSON, BASE } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILDER = path.resolve(HERE, '..', 'builder');
const UPDATED = '2026-10-25';

// The guides, in the hub's order. Their slugs are the page addresses: frozen once published.
export const ORDER = ['getting-started', 'load-flow', 'contingency-analysis', 'short-circuit', 'hosting-capacity', 'parameter-sweep', 'rms-emt-simulation'];

// ---- What every guide can use -----------------------------------------------------------------
export function results(name) {
  const f = path.join(HERE, 'results', name + '.json');
  if (!fs.existsSync(f)) throw new Error(`results/${name}.json is missing: run scripts/${name}.py on the example project`);
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (r.status !== 'ok') throw new Error(`results/${name}.json: the run did not finish (${r.status.split('\n')[0]})`);
  if (r.audit !== 'OK') throw new Error(`results/${name}.json: the project was not left as found`);
  return r;
}
// Sources are read with LF line ends whatever the checkout has (a Windows checkout gives CRLF), so
// the pages and the .py downloads come out the same on every machine, as the site serves them.
const lf = (s) => s.replace(/\r\n/g, '\n');
export const script = (name) => lf(fs.readFileSync(path.join(HERE, 'scripts', name + '.py'), 'utf8'));

// The Builder's script for a Quick Start, filled in for the example project the guide uses.
let gen = null;
async function generator() {
  if (gen) return gen;
  const imp = (rel) => import(pathToFileURL(path.join(BUILDER, rel)).href);
  await imp('js/blocks/index.js');
  const { generate } = await imp('js/core/codegen.js');
  const { RUNTIME_FILES } = await imp('js/core/runtime-loader.js');
  const { built } = await imp('_audit/templates/build.mjs');
  const runtime = {};
  for (const f of RUNTIME_FILES) runtime[f] = lf(fs.readFileSync(path.join(BUILDER, 'runtime', f), 'utf8'));
  gen = { generate, runtime, templates: Object.fromEntries(built().map(t => [t.id, t])) };
  return gen;
}
const EL = (cls, name, match = 'one') => ({ cls, name, match });
export async function builderScript(id, fill) {
  const g = await generator();
  const t = g.templates[id];
  if (!t) throw new Error('no Quick Start ' + id);
  const wf = JSON.parse(JSON.stringify(t.json));
  const set = (nid, patch) => { const n = wf.nodes.find(x => x.id === nid); n.s = { ...n.s, ...patch }; };
  fill({ set, EL });
  const r = g.generate(wf, { runtime: g.runtime });
  if (r.problems.length) throw new Error(`${id}: the filled Quick Start still has problems: ${r.problems.map(p => p.msg).join(' | ')}`);
  const code = r.code;
  const cut = code.indexOf('# ==== HELPERS');
  const lines = code.split('\n').length;
  return { title: t.title, code, readable: code.slice(0, cut).replace(/\s+$/, '') + '\n', helpers: code.slice(cut), lines };
}

// ---- One guide page ---------------------------------------------------------------------------
// spec: { slug, title, h1, desc, lead, qs, sections: { what, method, builderIntro, builderNotes[],
//   pitfalls[], faq[[q, a]] }, refs: [Class], keywords: [] }
function guidePage(spec, all, specs) {
  const s = spec.sections;
  const toc = [['what', `What ${spec.short || 'it'} is`], ['method', 'The method'], ['builder', 'The full Python script'], ['pitfalls', 'Pitfalls'], ['faq', 'Questions']]
    .filter(([id]) => id !== 'faq' || (s.faq && s.faq.length));
  const cta = spec.qs ? `<div class="dx-cta">
  <p><strong>Open this in the Builder.</strong> The ${esc(spec.qsTitle)} Quick Start loads in the PowerFactory Workflow Builder, ready for your project. Change any block and download the Python file.</p>
  <a class="btn-primary" href="../../builder/#qs=${spec.qs}">Open in the Builder</a>
</div>` : '';
  const refs = (spec.refs || []).filter(c => all[c]).map(c => `<a href="../../reference/${c}/"><code>${c}</code></a>`);
  const others = ORDER.filter(x => x !== spec.slug).map(x => specs[x]).map(o => `<li><a href="../${o.slug}/">${esc(o.card)}</a></li>`).join('\n    ');
  const body = `    <p class="dx-lead">${spec.lead}</p>
    <ul class="dx-toc" aria-label="On this page">${toc.map(([id, t]) => `<li><a href="#${id}">${esc(t)}</a></li>`).join('')}</ul>
    <section class="dx-sec dx-answer" aria-labelledby="what">
  <h2 id="what">${esc(spec.whatTitle)}</h2>
${s.what}
</section>
    <section class="dx-sec" aria-labelledby="method">
  <h2 id="method">${esc(spec.methodTitle || 'The method')}</h2>
${s.method}
</section>
${cta}
    <section class="dx-sec" aria-labelledby="builder">
  <h2 id="builder">${esc(spec.builderTitle || 'The full Python script from the Builder')}</h2>
${s.builder}
</section>
    <section class="dx-sec" aria-labelledby="pitfalls">
  <h2 id="pitfalls">Pitfalls</h2>
  <ul class="dx-prose">
${s.pitfalls.map(p => `    <li>${p}</li>`).join('\n')}
  </ul>
</section>
${s.faq && s.faq.length ? `    <section class="dx-sec" aria-labelledby="faq">
  <h2 id="faq">Questions</h2>
${s.faq.map(([q, a]) => `  <h3>${esc(q)}</h3>\n  <p>${a}</p>`).join('\n')}
</section>` : ''}
    <section class="dx-sec" aria-labelledby="more">
  <h2 id="more">Related</h2>
  <ul class="dx-prose">
    <li><a href="../">Automate PowerFactory studies with Python: every guide</a></li>
    ${others}
  </ul>
  ${refs.length ? `<p>Attributes used on this page: ${refs.join(', ')}. <a href="../../reference/">All attributes</a>.</p>` : ''}
</section>`;
  const plain = (h) => String(h).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
  const jsonld = [{
    '@context': 'https://schema.org', '@type': 'TechArticle',
    headline: spec.h1Plain || plain(spec.h1),
    description: spec.desc, url: BASE + `python/${spec.slug}/`, inLanguage: 'en', dateModified: UPDATED,
    proficiencyLevel: spec.level || 'Beginner',
    dependencies: 'DIgSILENT PowerFactory 2024 (Python 3.12 API)',
    keywords: (spec.keywords || []).join(', '),
    about: (spec.about || []).map(a => ({ '@type': 'Thing', name: a })),
    isPartOf: { '@type': 'WebPage', name: 'Automate PowerFactory studies with Python', url: BASE + 'python/' },
    author: PERSON, publisher: { '@id': PERSON['@id'] },
  }];
  if (s.faq && s.faq.length) jsonld.push({
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: s.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: plain(a) } })),
  });
  const extra = spec.builderFile ? [{ file: `python/${spec.slug}/${spec.builderFile.name}`, content: spec.builderFile.code }] : [];
  return {
    file: `python/${spec.slug}/index.html`, url: `python/${spec.slug}/`, extra,
    html: page({ path: `python/${spec.slug}/`, title: spec.title, h1: spec.h1, desc: spec.desc, ogTitle: spec.h1Plain || plain(spec.h1),
      crumbs: [['Python automation', 'python/'], [spec.crumb, `python/${spec.slug}/`]], jsonld, body }),
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
  <p class="dx-note">The file goes on with ${helperLines.toLocaleString('en-AU')} lines of helper functions copied from the Builder's runtime (connecting, logging, tables, graphs, putting values back), only those this workflow needs. The download has them all.</p>
  <h3>How the script works</h3>
  <ul class="dx-prose">
${notes.map(n => `    <li>${n}</li>`).join('\n')}
  </ul>`;
}

export async function taskPages(all) {
  const specs = {};
  const ctx = { results, script, builderScript, builderBlock, all, esc, pre };
  for (const slug of ORDER) {
    const mod = await import(pathToFileURL(path.join(HERE, 'tasks', slug + '.mjs')).href);
    const made = [];
    specs[slug] = await mod.default({ ...ctx, builderScript: async (id, fill) => { const b = await builderScript(id, fill); made.push(b); return b; } });
    const b = made.find(x => x.fileName);
    if (b) specs[slug].builderFile = { name: b.fileName, code: b.code };
    if (specs[slug].slug !== slug) throw new Error(`tasks/${slug}.mjs says it is ${specs[slug].slug}`);
  }
  const pages = ORDER.map(slug => guidePage(specs[slug], all, specs));
  const hub = await import(pathToFileURL(path.join(HERE, 'tasks', 'hub.mjs')).href);
  pages.unshift(await hub.default({ ...ctx, specs, ORDER, page, PERSON, BASE, UPDATED }));
  return pages;
}
