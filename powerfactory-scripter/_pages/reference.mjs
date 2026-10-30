// The attribute reference: reference/index.html and one page per class, reference/<Class>/,
// from the data in ../variables/ (the same files the Builder's attribute suggestions read).

import fs from 'node:fs';
import path from 'node:path';
import { page, esc, pre, PERSON, BASE, adSlot } from './lib.mjs';
import { CLASSES, CATEGORIES, GROUPS, PREFIX_WORDS, DESC_OVERRIDES } from './classes.mjs';

const KIND_DIR = { element: 'elements', type: 'types', event: 'events' };
const KIND_WORD = { element: 'element', type: 'type', event: 'event' };
const UPDATED = '2026-10-25';

// ---- Data ----------------------------------------------------------------------------------
export function loadAll(pfDir) {
  const out = {};
  for (const [kind, dir] of Object.entries(KIND_DIR)) {
    const d = path.join(pfDir, 'variables', dir);
    for (const f of fs.readdirSync(d).filter(f => f.endsWith('.json') && !f.includes('index'))) {
      const cls = f.slice(0, -5);
      const j = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'));
      const params = (j.params ? Object.values(j.params).flat() : (j.e || [])).filter(r => r && r.var);
      const groups = {};
      for (const [g] of GROUPS) {
        const byP = j.result_vars && j.result_vars[g];
        if (!byP) continue;
        const rows = [], seen = new Set();
        for (const p of ['m', 'c', 'n', 's', 'b']) for (const r of byP[p] || []) {
          const k = r.var + '|' + (r.suffix || '');
          if (seen.has(k)) continue;
          seen.add(k);
          rows.push(r);
        }
        for (const p of Object.keys(byP)) if (!['m', 'c', 'n', 's', 'b'].includes(p)) for (const r of byP[p]) rows.push(r);
        if (rows.length) groups[g] = rows;
      }
      // Only e: input parameters are listed as such; a b: entry in the parameter list belongs to basic data.
      const ps = [], seenP = new Set();
      for (const r of params) {
        if (seenP.has(r.var)) continue;
        seenP.add(r.var);
        if (r.var.startsWith('b:')) { (groups.basic = groups.basic || []); if (!groups.basic.some(x => x.var === r.var)) groups.basic.push(r); } else ps.push(r);
      }
      const nRes = Object.entries(groups).filter(([g]) => g !== 'basic').reduce((a, [, rows]) => a + rows.length, 0);
      if (!ps.length && !nRes) continue;                 // no data: no page (ElmHvdcbi, ElmHvdcvsc, ElmWind)
      out[cls] = { cls, kind, params: ps, groups, nRes, terminals: terminalsOf(cls, ps), hasSuffix: Object.values(groups).flat().some(r => r.suffix && r.suffix.includes('busN')) };
    }
  }
  return out;
}

// A branch result is read at one of its terminals: the suffix is the name of the cubicle
// attribute (bus1, bushv...), as the class's own parameter list gives them.
function terminalsOf(cls, params) {
  return params.filter(r => /^e:bus[a-z0-9]*$/i.test(r.var) && !/neutral/i.test(r.desc) && !['e:bustp', 'e:buses'].includes(r.var))
    .map(r => ({ name: r.var.slice(2), desc: r.desc }));
}

const isParam = (a) => !/^[mcnsbtr]:/.test(a);
function showName(r, d) {
  // the name to type, and a small line of the other forms it takes
  let name = r.var, more = '';
  const sfx = r.suffix || '';
  if (sfx.includes('busN')) {
    if (d.terminals.length) {
      name += ':' + d.terminals[0].name;
      if (d.terminals.length > 1) more = 'or ' + d.terminals.slice(1).map(t => ':' + t.name).join(', ');
    } else { name += ':busN'; more = 'busN: the terminal'; }
  }
  if (sfx.includes('Ph')) {
    name += ':A';
    more = (more ? more + '; ' : '') + 'per phase :A, :B, :C, unbalanced only';
  }
  return { name, more };
}
const descOf = (r) => DESC_OVERRIDES[r.var] || r.desc || '';
const unitOf = (r) => (r.unit && !/^(Elm|Typ|Sta|Int|Rel|Blk|Set|Com|Evt|Chr|Ext)/.test(r.unit) && !r.unit.includes('*') ? r.unit : '');

function rowsHtml(rows, d, opts = {}) {
  return rows.map(r => {
    const { name, more } = opts.plain ? { name: r.var.replace(/^e:/, ''), more: '' } : showName(r, d);
    const refCls = /^(Elm|Typ|Sta|Int|Rel|Blk|Set)/.test(r.unit || '') ? `<small>Object: ${esc(r.unit)}</small>` : '';
    return `<tr><td><code>${esc(name)}</code>${more ? `<small>${esc(more)}</small>` : ''}</td><td>${esc(unitOf(r)) || '<span aria-label="no unit">·</span>'}</td><td>${esc(descOf(r))}${refCls}</td></tr>`;
  }).join('\n');
}
const attrTable = (rows, d, opts) => `<div class="dx-tw"><table class="dx-attrs"><thead><tr><th>Attribute</th><th>Unit</th><th>Description</th></tr></thead><tbody>\n${rowsHtml(rows, d, opts)}\n</tbody></table></div>`;

// Look an attribute up in a class's data: { row, group } or null.
function lookup(d, a) {
  if (isParam(a)) {
    const row = d.params.find(r => r.var === 'e:' + a || r.var === a);
    return row ? { row, group: 'params' } : null;
  }
  const parts = a.split(':');
  const base = parts[0] + ':' + parts[1], tail = parts.slice(2);
  for (const [g] of GROUPS) {
    for (const r of d.groups[g] || []) {
      if (r.var !== base) continue;
      const sfx = r.suffix || '';
      if (!tail.length && !sfx) return { row: r, group: g };
      if (tail.length === 1 && sfx === ':busN' && d.terminals.some(t => t.name === tail[0])) return { row: r, group: g };
    }
  }
  return null;
}
const GROUP_WORD = Object.fromEntries(GROUPS.map(([g, h]) => [g, h.replace(/ results$/, '').replace('Basic data', 'basic data')]));

// ---- Snippets --------------------------------------------------------------------------------
const VAR = { ElmLne: 'line', ElmTerm: 'bus', ElmTr2: 'trafo', ElmTr3: 'trafo', ElmTr4: 'trafo', ElmSym: 'gen', ElmGenstat: 'gen', ElmPvsys: 'pv', ElmAsm: 'motor', ElmLod: 'load', ElmXnet: 'grid', ElmShnt: 'shunt', ElmCoup: 'breaker', ElmSvs: 'svc', ElmNet: 'grid' };
const TYPE_OF = { TypLne: 'ElmLne', TypTr2: 'ElmTr2', TypTr3: 'ElmTr3', TypTr4: 'ElmTr4', TypSym: 'ElmSym', TypAsm: 'ElmAsm', TypLod: 'ElmLod', TypLodlv: 'ElmLodlv', TypSwitch: 'ElmCoup' };
const pyStr = (v) => (typeof v === 'string' ? JSON.stringify(v) : String(v));
const pad = (s, n) => s + ' '.repeat(Math.max(1, n - s.length));
// A Python name for a read value: c:loading -> loading, m:P:bus1 -> p_bus1, m:Ul -> ul.
const varName = (a) => {
  const [, base, ...rest] = a.split(':');
  const n = [base, ...rest].join('_').toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return /^(in|is|if|or|and|not|for|def|del|as|from|import|pass|try|with)$/.test(n) ? n + '_' : n;
};

function snippet(cls, d, meta) {
  const head = 'import powerfactory\n\napp = powerfactory.GetApplication()          # GetApplicationExt() from outside PowerFactory\n';
  if (d.kind === 'element') {
    if (cls === 'ElmRes') {
      return head + `
case = app.GetActiveStudyCase()                # a study case with a simulation set up
inc, sim = app.GetFromStudyCase("ComInc"), app.GetFromStudyCase("ComSim")
bus = app.GetCalcRelevantObjects("*.ElmTerm")[0]

res = case.CreateObject("ElmRes", "My results")  # a results object of your own
res.AddVariable(bus, "m:fehz")                 # what to record: the busbar frequency
inc.SetAttribute("p_resvar", res)              # the simulation writes to it
inc.Execute()
sim.Execute()

res.Load()
col = res.FindColumn(bus, "m:fehz")            # -1 when it was not recorded
rows = range(res.GetNumberOfRows())
t = [res.GetValue(row, -1)[1] for row in rows] # column -1 is the time, s
f = [res.GetValue(row, col)[1] for row in rows]
res.Release()`;
    }
    const v = VAR[cls] || 'obj';
    const reads = (meta.common || []).map(([a]) => a).filter(a => !isParam(a) && lookup(d, a) && lookup(d, a).group === 'load_flow').slice(0, 2);
    if (!reads.length && d.groups.load_flow) {
      const c = d.groups.load_flow.find(r => r.var === 'c:loading') || d.groups.load_flow.find(r => r.var.startsWith('m:') && (!r.suffix || r.suffix === ':busN'));
      if (c) reads.push(showName(c, d).name);
    }
    const set = meta.set;
    let s = head;
    if (reads.length) {
      s += 'app.GetFromStudyCase("ComLdf").Execute()      # results exist after a calculation\n\n';
      s += `for ${v} in app.GetCalcRelevantObjects("*.${cls}"):\n`;
      const names = reads.map(varName);
      reads.forEach((a, i) => {
        const r = lookup(d, a).row;
        s += `    ${pad(`${names[i]} = ${v}.GetAttribute("${a}")`, 46)}# ${descOf(r)}${unitOf(r) ? ', ' + unitOf(r) : ''}\n`;
      });
      s += `    print(${v}.loc_name, ${names.join(', ')})\n`;
    } else {
      const p = (meta.common || []).map(([a]) => a).find(a => isParam(a) && lookup(d, a)) || (d.params.find(r => r.var === 'e:loc_name') ? 'loc_name' : d.params[0].var.replace(/^e:/, ''));
      const r = lookup(d, p) ? lookup(d, p).row : null;
      s += `\nfor ${v} in app.GetCalcRelevantObjects("*.${cls}"):\n    ${pad(`print(${v}.loc_name, ${v}.GetAttribute("${p}"))`, 46)}# ${r ? descOf(r) : p}\n`;
    }
    if (set && lookup(d, set[0])) {
      s += `\n${v} = app.GetCalcRelevantObjects("*.${cls}")[0]\n${pad(`${v}.SetAttribute("${set[0]}", ${pyStr(set[1])})`, 46)}# ${set[2]}\n`;
    }
    return s;
  }
  if (d.kind === 'type') {
    const el = TYPE_OF[cls];
    const p = (meta.common || []).map(([a]) => a).find(a => lookup(d, a)) || 'loc_name';
    const r = lookup(d, p) ? lookup(d, p).row : null;
    let s = head + `\n# Types live in the equipment library of the project.\ntypes = app.GetProjectFolder("equip").GetContents("*.${cls}", 1)\nfor typ in types:\n    ${pad(`print(typ.loc_name, typ.GetAttribute("${p}"))`, 46)}# ${r ? descOf(r) : p}${r && unitOf(r) ? ', ' + unitOf(r) : ''}\n`;
    if (el) {
      const ev = VAR[el] || 'obj';
      s += `\n# An element points to its type with typ_id; t: reads a type value through the element.\nfor ${ev} in app.GetCalcRelevantObjects("*.${el}"):\n    print(${ev}.loc_name, ${ev}.typ_id.loc_name, ${ev}.GetAttribute("t:${p}"))\n`;
    }
    if (meta.set && lookup(d, meta.set[0])) s += `\n${pad(`types[0].SetAttribute("${meta.set[0]}", ${pyStr(meta.set[1])})`, 46)}# ${meta.set[2]}${meta.set[0] === 'loc_name' ? '' : ': every element of this type changes'}\n`;
    return s;
  }
  // events
  const tgt = { EvtShc: ['ElmTerm', 'bus'], EvtSwitch: ['ElmLne', 'line'], EvtParam: ['ElmSym', 'gen'], EvtLod: ['ElmLod', 'load'], EvtGen: ['ElmSym', 'gen'], EvtOutage: ['ElmLne', 'line'], EvtTap: ['ElmTr2', 'trafo'], EvtSym: ['ElmSym', 'gen'] }[cls] || ['ElmTerm', 'obj'];
  const extra = {
    EvtShc: [['i_shc', 0, '0 three-phase, 1 two-phase, 2 single-phase to ground, 3 two-phase to ground, 4 clears the fault']],
    EvtSwitch: [['i_switch', 0, '0 opens, 1 closes'], ['i_allph', 1, 'all phases']],
    EvtParam: [['variable', 'pgini', 'the input parameter to change'], ['value', '120', 'its new value, written as text']],
    EvtLod: [['dP', 10.0, 'active power step, %'], ['dQ', 10.0, 'reactive power step, %']],
    EvtGen: [['dP', 20.0, 'active power change, MW']],
    EvtOutage: [['i_what', 0, 'type of outage event']],
    EvtTap: [['ntap', 2, 'tap position']],
    EvtSym: [['addmt', 0.1, 'additional torque, p.u.']],
  }[cls] || [];
  let s = head + `
inc = app.GetFromStudyCase("ComInc")
events = inc.GetAttribute("p_event")          # the event list the simulation reads
${tgt[1]} = app.GetCalcRelevantObjects("*.${tgt[0]}")[0]
ev = events.CreateObject("${cls}", "My ${CLASSES[cls].name.toLowerCase()}")
ev.SetAttribute("p_target", ${tgt[1]})
app.SetAttributeModeInternal(1)               # write the time in seconds, whatever unit the project shows
ev.SetAttribute("time", 1.0)
app.SetAttributeModeInternal(0)
`;
  for (const [a, val, c] of extra) if (lookup(d, a)) s += `${pad(`ev.SetAttribute("${a}", ${pyStr(val)})`, 46)}# ${c}\n`;
  return s;
}

// ---- Pages -----------------------------------------------------------------------------------
export function classPages(all) {
  const names = Object.keys(all).filter(c => CLASSES[c]);
  const missing = Object.keys(all).filter(c => !CLASSES[c]);
  if (missing.length) throw new Error('classes.mjs has no entry for: ' + missing.join(', '));
  // every curated attribute must exist
  const bad = [];
  for (const c of names) for (const [a] of CLASSES[c].common || []) if (!lookup(all[c], a)) bad.push(c + ' ' + a);
  for (const c of names) if (CLASSES[c].set && all[c].kind !== 'event' && !lookup(all[c], CLASSES[c].set[0])) bad.push(c + ' set ' + CLASSES[c].set[0]);
  if (bad.length) throw new Error('attributes not in the data: ' + bad.join('; '));

  const order = CATEGORIES.flatMap(([k]) => names.filter(c => CLASSES[c].cat === k));
  const pages = [];
  for (const [i, cls] of order.entries()) {
    const d = all[cls], meta = CLASSES[cls];
    const nGroups = Object.keys(d.groups).filter(g => g !== 'basic').length;
    const resWords = d.nRes ? `${d.nRes} result variables` : '';
    const parWords = d.params.length ? `${d.params.length} ${d.kind === 'event' ? 'event parameters' : 'input parameters'}` : '';
    const counts = [parWords, resWords].filter(Boolean).join(' and ');
    const title = d.kind === 'element' ? `${cls} attributes: PowerFactory ${meta.name} parameters and result variables` : d.kind === 'type' ? `${cls} attributes: PowerFactory ${meta.name} parameters` : `${cls} attributes: PowerFactory ${meta.name} parameters`;
    // The longest that fits a search result (about 160 characters): drop the least telling words first.
    const n = counts.replace(/(\d{4,})/g, x => Number(x).toLocaleString('en-AU'));
    const desc = [
      `All ${cls} attributes in PowerFactory (${meta.name}): ${n}, with units and meaning, for GetAttribute and SetAttribute.`,
      `All ${cls} attributes in PowerFactory (${meta.name}): ${n}, with units, for GetAttribute and SetAttribute.`,
      `All ${cls} attributes (PowerFactory ${meta.name}): ${n.replace(/ input parameters/, ' parameters').replace(/ result variables/, ' results')}, with units.`,
    ].find(d => d.length <= 160) || `All ${cls} attributes in PowerFactory: ${n}, with units.`;
    const sections = [];
    // what it is + facts
    const typeLink = meta.type && all[meta.type] ? `<a href="../${meta.type}/"><code>${meta.type}</code></a>, through <code>typ_id</code>` : meta.type ? `<code>${meta.type}</code>, through <code>typ_id</code>` : '';
    const usedBy = Object.entries(CLASSES).filter(([c, m]) => m.type === cls && all[c]).map(([c]) => `<a href="../${c}/"><code>${c}</code></a>`);
    const facts = [
      ['Class', `<code>${cls}</code>, ${KIND_WORD[d.kind]} class`],
      ['PowerFactory name', esc(meta.name)],
      typeLink ? ['Type', typeLink] : null,
      usedBy.length ? ['Used by', usedBy.join(', ')] : null,
      d.hasSuffix ? ['Terminal suffix', d.terminals.length ? d.terminals.map(t => `<code>:${esc(t.name)}</code> ${esc(t.desc.toLowerCase())}`).join(', ') : 'the name of the terminal, as <code>:busN</code>'] : null,
      ['Attributes', esc(counts) + (nGroups ? `, in ${nGroups} calculation${nGroups > 1 ? 's' : ''}` : '')],
    ].filter(Boolean);
    sections.push(`<section class="dx-sec dx-answer" aria-labelledby="what">
  <h2 id="what">What ${cls} is</h2>
  <p>${esc(meta.what)}</p>
  <dl class="dx-facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
</section>`);
    // most used
    if (meta.common && meta.common.length) {
      const rows = meta.common.map(([a, note]) => {
        const { row, group } = lookup(d, a);
        return `<tr><td><code>${esc(a)}</code></td><td>${esc(unitOf(row)) || '·'}</td><td>${esc(descOf(row))}${note ? `<small>${esc(note)}</small>` : ''}</td><td>${group === 'params' ? (d.kind === 'event' ? 'event data' : 'input data') : esc(GROUP_WORD[group])}</td></tr>`;
      }).join('\n');
      sections.push(`<section class="dx-sec" aria-labelledby="common">
  <h2 id="common">Most used ${cls} attributes</h2>
  <div class="dx-tw"><table class="dx-attrs"><thead><tr><th>Attribute</th><th>Unit</th><th>Description</th><th>Where</th></tr></thead><tbody>
${rows}
</tbody></table></div>
</section>`);
    }
    // Python
    const notes = [];
    if (d.kind === 'element' && d.hasSuffix) notes.push(`A result at a terminal of the ${esc(meta.name.toLowerCase())} needs the terminal in its name: <code>${esc(showName({ var: 'm:P', suffix: ':busN' }, d).name)}</code>, not <code>m:P</code>, which raises <code>AttributeError</code>.`);
    if (d.kind !== 'event') notes.push('An input parameter is read and written with or without its <code>e:</code> prefix: <code>GetAttribute("outserv")</code> and <code>GetAttribute("e:outserv")</code> give the same value.');
    if (d.kind === 'type') notes.push('A type is shared: a change to it changes every element that uses it. Read a type value through an element with the <code>t:</code> prefix.');
    if (d.kind === 'event') notes.push('Times are written in the unit the project shows (some show milliseconds); <code>SetAttributeModeInternal(1)</code> makes it seconds. A fault is cleared by a second <code>EvtShc</code> with <code>i_shc</code> 4: <code>i_clearShc</code> does not clear it in an RMS or EMT run.');
    if (d.groups.dynamic_rms || d.groups.dynamic_emt) notes.push('RMS and EMT variables change over time: record them in a results object (<a href="../ElmRes/"><code>ElmRes</code></a>) to read the whole curve. <code>GetAttribute</code> after a run gives the value at the last time step.');
    sections.push(adSlot());
    sections.push(`<section class="dx-sec" aria-labelledby="python">
  <h2 id="python">Read and write ${cls} in Python</h2>
  ${pre(snippet(cls, d, meta))}
  <ul class="dx-prose">${notes.map(n => `<li>${n}</li>`).join('')}</ul>
</section>`);
    // all attributes
    const toc = [];
    const groupsHtml = [];
    const add = (id, h2, rows, intro, opts) => {
      toc.push(`<li><a href="#${id}">${esc(h2)}<span class="dx-n">${rows.length}</span></a></li>`);
      groupsHtml.push(`<section class="dx-sec dx-group" aria-labelledby="${id}">
  <h2 id="${id}">${esc(cls)} ${esc(h2.toLowerCase())}</h2>
  ${intro ? `<p class="dx-note">${intro}</p>` : ''}
  ${attrTable(rows, d, opts)}
</section>`);
    };
    if (d.params.length) add('params', d.kind === 'event' ? 'Event parameters' : 'Input parameters', d.params, d.kind === 'event' ? 'Set these on the event before the simulation runs. Names are typed without the <code>e:</code> shown in variable lists.' : 'The element data, as typed in <code>GetAttribute</code> and <code>SetAttribute</code> (the <code>e:</code> prefix is optional). Setting one changes the model.', { plain: true });
    for (const [g, h, cmd] of GROUPS) {
      if (!d.groups[g] || g === 'basic') continue;
      add(g.replace(/_/g, '-'), h, d.groups[g], `Read after ${cmd ? `<code>${esc(cmd.split(',')[0].split(' and ')[0])}</code>` : 'the calculation'}${cmd && cmd.includes(',') ? ` (${esc(cmd.split(', ')[1])})` : ''} with <code>GetAttribute</code>. ${[...new Set(d.groups[g].map(r => r.var.split(':')[0]))].map(p => `<code>${p}:</code> ${esc(PREFIX_WORDS[p] ? PREFIX_WORDS[p].toLowerCase() : p)}`).join(', ')}.`);
    }
    if (d.groups.basic) add('basic', 'Basic data', d.groups.basic, '<code>b:</code> values are worked out from the input data. Read them; they are not set.');
    const prev = order[i - 1], next = order[i + 1];
    const related = [
      `<li><a href="../">All ${Object.keys(all).length} classes in the attribute reference</a></li>`,
      d.kind === 'element' && d.groups.load_flow ? '<li><a href="../../python/load-flow/">Run a load flow and export the results with Python</a></li>' : '',
      ['ElmLne', 'ElmTr2', 'ElmTerm'].includes(cls) ? '<li><a href="../../python/contingency-analysis/">N-1 contingency analysis in Python</a></li>' : '',
      d.groups.short_circuit && ['ElmTerm', 'ElmLne', 'ElmSym', 'ElmXnet'].includes(cls) ? '<li><a href="../../python/short-circuit/">Short-circuit automation in Python</a></li>' : '',
      d.kind === 'event' || ['ElmSym', 'ElmRes', 'ElmDsl', 'ElmTerm'].includes(cls) ? '<li><a href="../../python/rms-emt-simulation/">RMS and EMT simulation batch runs in Python</a></li>' : '',
      ['ElmGenstat', 'ElmPvsys', 'ElmTerm', 'ElmLne'].includes(cls) ? '<li><a href="../../python/hosting-capacity/">Hosting capacity study</a></li>' : '',
      '<li><a href="../../python/getting-started/">PowerFactory Python API: getting started</a></li>',
    ].filter(Boolean).join('\n    ');
    const body = `    <p class="dx-lead">Every attribute of the PowerFactory ${esc(meta.name)} (<code>${cls}</code>): ${esc(counts)}, with units and meaning. Copy a name into <code>GetAttribute</code> or <code>SetAttribute</code>.</p>
${sections.join('\n')}
    <div class="dx-filter" id="dxFilterRow" hidden><input id="dxFilter" type="search" placeholder="Filter by name or meaning, e.g. loading or m:P" aria-label="Filter the attributes"><output id="dxCount" aria-live="polite"></output></div>
    <ul class="dx-toc" aria-label="All ${esc(cls)} attributes">${toc.join('')}</ul>
${(groupsHtml.length >= 4 ? [...groupsHtml.slice(0, 2), adSlot(), ...groupsHtml.slice(2)] : groupsHtml).join('\n')}
    <section class="dx-sec" aria-labelledby="more">
  <h2 id="more">Related</h2>
  <ul class="dx-prose">
    ${related}
  </ul>
  <p class="dx-note">${prev ? `← <a href="../${prev}/"><code>${prev}</code> ${esc(CLASSES[prev].name)}</a>` : ''}${prev && next ? ' · ' : ''}${next ? `<a href="../${next}/"><code>${next}</code> ${esc(CLASSES[next].name)}</a> →` : ''}</p>
</section>`;
    const jsonld = [{
      '@context': 'https://schema.org', '@type': 'TechArticle',
      headline: `${cls} attributes (PowerFactory ${meta.name})`,
      description: desc,
      url: BASE + `reference/${cls}/`,
      inLanguage: 'en', dateModified: UPDATED,
      about: { '@type': 'Thing', name: `${cls} (${meta.name})`, description: meta.what },
      keywords: [`${cls} attributes`, `${cls} parameters`, `${cls} result variables`, `PowerFactory ${meta.name} attributes`, `${cls} GetAttribute`, ...(meta.common || []).slice(0, 4).map(([a]) => `${a} ${cls}`)].join(', '),
      isPartOf: { '@type': 'WebPage', name: 'PowerFactory attribute reference', url: BASE + 'reference/' },
      author: PERSON, publisher: { '@id': PERSON['@id'] },
    }];
    pages.push({
      file: `reference/${cls}/index.html`,
      html: page({ path: `reference/${cls}/`, title: `${cls} attributes: PowerFactory ${meta.name} | Adjie Brotools`, h1: `${cls} attributes<span class="dx-h1-sub">PowerFactory ${esc(meta.name)}</span>`, desc, ogTitle: title, crumbs: [['Attribute reference', 'reference/'], [cls, `reference/${cls}/`]], jsonld, body, script: FILTER_JS }),
      url: `reference/${cls}/`,
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
  const n = order.length;
  const totals = order.reduce((a, c) => a + all[c].params.length + all[c].nRes, 0);
  const nEl = order.filter(c => all[c].kind === 'element').length, nTy = order.filter(c => all[c].kind === 'type').length, nEv = order.filter(c => all[c].kind === 'event').length;
  const QUICK = [
    ['Loading of a line or transformer', 'c:loading', '%', 'ElmLne, ElmTr2, ElmTr3, ElmSym', 'Load flow'],
    ['Busbar voltage, per unit', 'm:u', 'p.u.', 'ElmTerm', 'Load flow'],
    ['Busbar voltage, line-line', 'm:Ul', 'kV', 'ElmTerm', 'Load flow'],
    ['Voltage angle', 'm:phiu', 'deg', 'ElmTerm', 'Load flow'],
    ['Active power at a line end', 'm:P:bus1', 'MW', 'ElmLne (ElmTr2: m:P:bushv, m:P:buslv)', 'Load flow'],
    ['Reactive power at a line end', 'm:Q:bus1', 'Mvar', 'ElmLne, ElmSym, ElmLod...', 'Load flow'],
    ['Current at a line end', 'm:I:bus1', 'kA', 'ElmLne', 'Load flow'],
    ['Losses', 'c:Ploss', 'MW', 'ElmLne, ElmTr2', 'Load flow'],
    ['Generator dispatch (input)', 'pgini', 'MW', 'ElmSym, ElmGenstat (ElmPvsys in kW)', 'Input data'],
    ['Load demand (input)', 'plini, qlini', 'MW, Mvar', 'ElmLod', 'Input data'],
    ['Out of service', 'outserv', '1 or 0', 'every element', 'Input data'],
    ['Breaker open or closed', 'on_off', '1 closed, 0 open', 'ElmCoup', 'Input data'],
    ['Tap position', 'nntap', '', 'ElmTr2', 'Input data'],
    ['Line length', 'dline', 'km', 'ElmLne', 'Input data'],
    ['Initial short-circuit current', 'm:Ikss', 'kA', 'ElmTerm', 'Short circuit'],
    ['Initial short-circuit power', 'm:Skss', 'MVA', 'ElmTerm', 'Short circuit'],
    ['Peak short-circuit current', 'm:ip', 'kA', 'ElmTerm', 'Short circuit'],
    ['Frequency', 'm:fehz', 'Hz', 'ElmTerm', 'RMS simulation'],
    ['Rotor angle', 'c:firel', 'deg', 'ElmSym', 'RMS simulation'],
    ['Speed', 's:speed', 'p.u.', 'ElmSym', 'RMS simulation'],
  ];
  const quick = `<div class="dx-tw"><table><thead><tr><th>You want</th><th>Attribute</th><th>Unit</th><th>Class</th><th>After</th></tr></thead><tbody>
${QUICK.map(([w, a, u, c, s]) => `<tr><td>${esc(w)}</td><td>${a.split(', ').map(x => `<code>${esc(x)}</code>`).join(', ')}</td><td>${esc(u) || '·'}</td><td>${c.split(/(Elm[A-Za-z0-9]+)/).map(p => (/^Elm/.test(p) && all[p] ? `<a href="${p}/"><code>${p}</code></a>` : esc(p))).join('')}</td><td>${esc(s)}</td></tr>`).join('\n')}
</tbody></table></div>`;
  const prefixes = [
    ['e:', 'Input parameter: the data of the element. Optional when you type it: <code>GetAttribute("dline")</code> and <code>GetAttribute("e:dline")</code> are the same.'],
    ['m:', 'Currents, voltages and powers. On a branch it names the terminal: <code>m:P:bus1</code>, <code>m:P:bushv</code>. Without it, <code>m:P</code> on a line raises <code>AttributeError</code>.'],
    ['c:', 'Calculation parameter: a result worked out from the others, such as <code>c:loading</code> and <code>c:Ploss</code>.'],
    ['n:', 'Bus result: the result of the terminal at one end of a branch, such as <code>n:u:bus1</code>.'],
    ['s:', 'Signal: a state or model variable of an RMS or EMT simulation, such as <code>s:speed</code>.'],
    ['b:', 'Basic data: values derived from the input data (read only).'],
    ['t:', 'Type parameter read through the element: <code>line.GetAttribute("t:uline")</code> is the rated voltage of the line\'s type.'],
    [':A :B :C', 'Per phase, in an unbalanced calculation only: <code>m:u:A</code>, <code>m:I:bus1:A</code> (capitals; <code>:a</code> raises <code>AttributeError</code>).'],
  ];
  const cats = CATEGORIES.map(([k, h]) => {
    const list = order.filter(c => CLASSES[c].cat === k);
    if (!list.length) return '';
    return `<section class="dx-sec" aria-labelledby="cat-${k}">
  <h2 id="cat-${k}">${esc(h)}</h2>
  <ul class="dx-classes">
${list.map(c => `    <li><a href="${c}/"><code>${c}</code><span>${esc(CLASSES[c].name)} · ${all[c].params.length + all[c].nRes} attributes</span></a></li>`).join('\n')}
  </ul>
</section>`;
  }).join('\n');
  const body = `    <p class="dx-lead">Every attribute name you can pass to <code>GetAttribute</code> and <code>SetAttribute</code> in DIgSILENT PowerFactory 2024, with units and meaning: ${nEl} element classes, ${nTy} types and ${nEv} simulation events, ${totals.toLocaleString('en-AU')} names in all.</p>
    <section class="dx-sec dx-answer" aria-labelledby="quick">
  <h2 id="quick">The attribute names people look up most</h2>
  ${quick}
  <p class="dx-note">Results (<code>m:</code>, <code>c:</code>, <code>n:</code>) exist only after the calculation named in the last column has run in the active study case.</p>
</section>
    <section class="dx-sec" aria-labelledby="prefixes">
  <h2 id="prefixes">What the prefix of an attribute name means</h2>
  <dl class="dx-facts">${prefixes.map(([p, t]) => `<dt><code>${esc(p)}</code></dt><dd>${t}</dd>`).join('')}</dl>
  <p class="dx-note">Each rule above was checked on the PowerFactory 2024 engine. A name a class does not have raises <code>AttributeError</code>.</p>
</section>
${adSlot()}
    <section class="dx-sec" aria-labelledby="python">
  <h2 id="python">Read and write any attribute</h2>
  ${pre(`import powerfactory

app = powerfactory.GetApplication()          # inside PowerFactory; GetApplicationExt() from your own Python
app.GetFromStudyCase("ComLdf").Execute()      # results need a calculation first

for line in app.GetCalcRelevantObjects("*.ElmLne"):
    print(line.loc_name, line.GetAttribute("c:loading"), line.GetAttribute("m:P:bus1"))

for bus in app.GetCalcRelevantObjects("*.ElmTerm"):
    print(bus.loc_name, bus.GetAttribute("m:u"))

load = app.GetCalcRelevantObjects("*.ElmLod")[0]
load.SetAttribute("plini", 140.0)             # input data: the next load flow uses it`)}
  <p>New to the API? <a href="../python/getting-started/">Start with the PowerFactory Python API guide</a>, or <a href="../python/">see every study you can automate</a>.</p>
</section>
${cats}`;
  const desc = `Every DIgSILENT PowerFactory attribute name for GetAttribute and SetAttribute: ${nEl} element classes, ${nTy} types, ${nEv} events, with units and Python examples.`;
  const jsonld = [{
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: 'PowerFactory attribute reference',
    description: desc, url: BASE + 'reference/', inLanguage: 'en', dateModified: UPDATED,
    isPartOf: { '@type': 'WebApplication', name: 'PowerFactory Scripter', url: BASE },
    hasPart: order.map(c => ({ '@type': 'TechArticle', name: `${c} attributes`, url: BASE + `reference/${c}/` })),
    author: PERSON, publisher: { '@id': PERSON['@id'] },
  }];
  return {
    file: 'reference/index.html', url: 'reference/',
    html: page({ path: 'reference/', title: 'PowerFactory attribute reference: every GetAttribute name | Adjie Brotools', h1: 'PowerFactory attribute reference', desc, ogTitle: 'PowerFactory attribute reference', crumbs: [['Attribute reference', 'reference/']], jsonld, body }),
  };
}
