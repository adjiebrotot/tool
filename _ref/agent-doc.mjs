#!/usr/bin/env node
// Writes the text an AI assistant reads to drive a tool with a #load link (Phase 1 of
// _ref/ai-drive-plan.md). Generated, never hand-edited: change a tool's notes or the tool,
// then run this.
//
//   node _ref/agent-doc.mjs           write every file below
//   node _ref/agent-doc.mjs --check   write nothing; exit 1 and name each file whose
//                                     generated text would differ (agent-check A5 runs it)
//
// For each page in PAGES (_ref/agent-lib.mjs) it opens the page on empty storage, reads every
// persistable control the way Persist does (key, label, unit, min/max/step, default, options,
// group) and the Quick Starts, merges the hand-written <tool>/agent-notes.md, and writes:
//   <page>/agent.txt     the full reference, plain text;
//   <page>/index.html    the folded "Use this tool with an AI assistant" card between
//                        <!-- agent:start --> and <!-- agent:end -->;
//   llms.txt             the site-wide section between the same markers: the #load protocol,
//                        the rules, one line per page.
// Every one of them carries AI_RULES verbatim (in HTML, escaped inside a <pre>).
//
// Order with _ref/bake-id.mjs: either order is stable. bake-id rebuilds an id/ page from its
// English page but keeps the id/ page's own AI section (the one this script wrote, in which
// links point at id/ and the lines for people are Indonesian), so a re-bake changes nothing
// here, and this script rewrites only that section. On a brand-new id/ page, run bake-id
// first, then this.
//
// It fails (exit 1, nothing written) when the notes name a key the page does not have, or the
// example link uses a key or value the tool would not take as it is.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  AI_RULES, PAGES, SITE, ROOT, RESERVED, FORBIDDEN, WHY_MAX, MARK_START, MARK_END, SECTION_RE, LIST_KEY_RE,
  buildLink, serve, launch, openPage, readFields, parseNotes, defaultQuickStarts
} from './agent-lib.mjs';

const CHECK = process.argv.includes('--check');
const problems = [];
const problem = (page, msg) => problems.push(page + ': ' + msg);

/* ── Words for people (the rest is for the chatbot, in English on every page) ── */
const PEOPLE = {
  en: {
    summary: 'Use this tool with an AI assistant',
    lead: 'Ask an AI assistant that can read web pages (Claude, ChatGPT, Gemini, Perplexity and others) to use this page for your question. ' +
      'It replies with a link that opens this tool on your scenario and lists what it assumed, and the tool works out the answer. ' +
      'The rest of this section is written for the assistant.',
  },
  id: {
    summary: 'Pakai alat ini dengan asisten AI',
    lead: 'Minta asisten AI yang bisa membaca halaman web (Claude, ChatGPT, Gemini, Perplexity, dan lainnya) memakai halaman ini untuk pertanyaan Anda. ' +
      'Asisten akan membalas dengan tautan yang membuka alat ini pada skenario Anda, lengkap dengan daftar asumsinya, lalu alat inilah yang menghitung hasilnya. ' +
      'Bagian di bawah ini ditulis untuk asisten AI, jadi tetap dalam bahasa Inggris.',
  },
};

/* ── Merge the page and its notes ─────────────────────────────────────────── */
function model(P, read, qs, notes) {
  const base = SITE + P.url;
  const S = notes.sections;
  const fields = read.fields;
  const byKey = Object.fromEntries(fields.map(f => [f.key, f]));
  // List keys a tool's adapter reads (Compact lists): LIST_KEY_RE.
  const compact = [];
  for (const line of (S['compact lists'] || '').split('\n')) {
    const m = LIST_KEY_RE.exec(line);
    if (m && !byKey[m[1]] && !compact.includes(m[1])) compact.push(m[1]);
  }
  const known = k => !!byKey[k] || compact.includes(k);
  const hide = new Set(notes.entries('hide').map(e => e.key));
  hide.forEach(k => { if (!byKey[k]) problem(P.page, `Hide names "${k}", which is not a field on the page`); });
  for (const k of Object.keys(notes.fieldNotes)) if (!known(k)) problem(P.page, `Fields notes name "${k}", which the page does not have`);
  const important = notes.entries('most important').map(e => e.key);
  important.forEach(k => { if (!known(k)) problem(P.page, `Most important names "${k}", which the page does not have`); });
  if (!S['decides']) problem(P.page, 'Decides is empty');

  // Quick Starts: every key a link may carry as qs, and what each one writes.
  const qsItems = {}, qsKeys = [];
  if (qs) for (const g of qs.groups) {
    if (g.key) qsKeys.push(g.key);
    for (const it of g.items) { qsItems[it.key] = it; qsKeys.push(it.key); }
  }
  const qsAlias = {};
  if (qs) for (const g of qs.groups) if (g.key && g.alias) qsAlias[g.key] = g.alias;

  const example = parseExample(S['example'] || '');
  const M = { P, base, fields, byKey, compact, hide, important, notes, qs, qsKeys, qsItems, qsAlias, example,
    title: read.h1, source: read.source };
  checkExample(M);
  return M;
}

/* The Example section: "Request: ...", then "Link:" with one "- key=value" per pair in link
   order, then "Assumptions:" with the numbered list a reply gives, where {key} stands for the
   value that key has once the link applies (Quick Start, then the link). */
function parseExample(text) {
  const ex = { request: '', pairs: [], assumptions: [] };
  let part = '';
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    let m;
    if ((m = /^Request:\s*(.*)$/i.exec(line))) { ex.request = m[1].trim(); part = 'request'; continue; }
    if (/^Link:\s*$/i.test(line)) { part = 'link'; continue; }
    if (/^Assumptions:\s*$/i.test(line)) { part = 'assumptions'; continue; }
    if (!line.trim()) continue;
    if (part === 'link' && (m = /^[-*] +([^=\s]+)=(.*)$/.exec(line))) ex.pairs.push([m[1], m[2].trim()]);
    else if (part === 'assumptions' && (m = /^\d+\. +(.*)$/.exec(line))) ex.assumptions.push(m[1].trim());
    else if (part === 'assumptions' && ex.assumptions.length && /^\s+\S/.test(raw)) ex.assumptions[ex.assumptions.length - 1] += ' ' + line.trim();
    else if (part === 'request') ex.request += ' ' + line.trim();
  }
  return ex;
}

const TRUTHY = /^(true|false|1|0|on|off)$/i;
const toNumber = s => {
  const t = String(s).replace(/[$,_\s]/g, '').replace(/%$/, '');
  return t === '' || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t) ? NaN : Number(t);
};
const isNumeric = f => f.input === 'number' || f.input === 'range' || f.money || f.numeric;

// Why a value would not go in as written, or '' when it would.
function valueProblem(f, v) {
  if (f.type === 'c') return TRUTHY.test(v) ? '' : 'a checkbox takes true or false';
  if (f.options) {
    const hit = f.options.some(o => o.value === v || o.label.toLowerCase() === String(v).toLowerCase());
    return hit ? '' : 'not one of ' + f.options.map(o => o.value).join(', ');
  }
  if (isNumeric(f)) {
    const n = toNumber(v);
    if (!Number.isFinite(n)) return 'not a number';
    if (f.min != null && n < +f.min) return 'below the minimum ' + f.min;
    if (f.max != null && n > +f.max) return 'above the maximum ' + f.max;
  }
  return '';
}

// A key in one of the page's families (PAGES.families: el.<name>.<param>), which its adapter reads.
const inFamily = (M, k) => (M.P.families || []).some(pre => k.length > pre.length && k.startsWith(pre));
function checkExample(M) {
  const { P, example: ex, byKey } = M;
  if (!ex.request) problem(P.page, 'Example has no Request line');
  if (!ex.pairs.length) problem(P.page, 'Example has no Link pairs');
  const seen = new Set();
  for (const [k, v] of ex.pairs) {
    if (seen.has(k)) problem(P.page, `example link names "${k}" twice`);
    seen.add(k);
    if (FORBIDDEN.includes(k)) { problem(P.page, `example link uses the forbidden key "${k}"`); continue; }
    if (k === 'v') { if (v !== '1') problem(P.page, 'example link: v must be 1'); continue; }
    if (k === 'qs') { if (!M.qsKeys.includes(v)) problem(P.page, `example link: qs "${v}" is not a Quick Start`); continue; }
    if (k === 'note') { if (v.length > WHY_MAX) problem(P.page, 'example note is longer than ' + WHY_MAX); continue; }
    if (k === 'json' || k === 'run') continue;
    if (k.startsWith('why.')) {
      const t = k.slice(4);
      if (!byKey[t] && !M.compact.includes(t) && !inFamily(M, t)) problem(P.page, `example link: ${k} explains a key the page does not have`);
      if (!ex.pairs.some(([x]) => x === t)) problem(P.page, `example link: ${k} explains a key the link does not set`);
      if (v.length > WHY_MAX) problem(P.page, `example link: ${k} is longer than ${WHY_MAX} characters`);
      continue;
    }
    if (M.compact.includes(k) || inFamily(M, k)) continue;
    const f = byKey[k];
    if (!f) { problem(P.page, `example link: "${k}" is not a key on the page`); continue; }
    if (M.hide.has(k)) problem(P.page, `example link: "${k}" is hidden from the docs`);
    const why = valueProblem(f, v);
    if (why) problem(P.page, `example link: ${k}=${v} is ${why}`);
  }
  // The state the link opens on, for the {key} placeholders in the assumptions.
  const state = {};
  for (const f of M.fields) state[f.key] = f.value;
  const qsPair = ex.pairs.find(([k]) => k === 'qs');
  if (qsPair) {
    const it = M.qsItems[qsPair[1]] || M.qsItems[M.qsAlias[qsPair[1]]];
    if (it && it.values) Object.assign(state, it.values);
    else if (it) M.qsNoValues = true;
  }
  for (const [k, v] of ex.pairs) if (byKey[k]) state[k] = v;
  M.exampleState = state;
  ex.assumptions = ex.assumptions.map(a => a.replace(/\{([A-Za-z_][\w]*)\}/g, (m, k) => {
    if (!(k in state)) { problem(P.page, `example assumption names {${k}}, which is not a field`); return m; }
    if (M.qsNoValues && !ex.pairs.some(([x]) => x === k)) problem(P.page, `example assumption {${k}} needs the Quick Start's values, which its reader does not give`);
    return show(state[k]);
  }));
  M.link = buildLink(M.base, [['v', '1'], ...ex.pairs.filter(([k]) => k !== 'v')]);
}

// A value as a person reads it: 850000 as 850,000.
function show(v) {
  if (typeof v === 'boolean') return v ? 'on' : 'off';
  const n = toNumber(v);
  if (typeof v === 'number' || (Number.isFinite(n) && /^[\d.,$\s-]+$/.test(String(v)))) {
    return Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 4 }) : String(v);
  }
  return String(v);
}
// A value as a link carries it: 800,000 as 800000.
function plain(f, v) {
  if (typeof v === 'boolean') return String(v);
  if (f && f.money) { const n = toNumber(v); return Number.isFinite(n) ? String(n) : String(v); }
  return String(v);
}

/* ── Text pieces shared by agent.txt and the HTML card ─────────────────────── */
const pattern = M => M.base + '#load&v=1' + (M.qs ? '&qs=<quick start>' : '') +
  '&<key>=<value>&...&why.<key>=<your reason>&note=<one line>';

// "downPaymentPct=20 means 20% of price, not 0.2": a field of this page whose unit is a %.
function unitExample(M) {
  const order = [...M.important, ...M.fields.map(f => f.key)];
  for (const k of order) {
    const f = M.byKey[k];
    if (M.hide.has(k)) continue;
    const unit = f && (f.input === 'range' ? f.unit : f.suffix);
    const v = f && toNumber(f.value);
    if (unit && /^%/.test(unit) && Number.isFinite(v) && v > 0) return `${k}=${v} means ${v}${unit}, not ${+(v / 100).toFixed(6)}.`;
  }
  return '';
}

function protocolLines(M) {
  return [
    'After #load come key=value pairs joined by &. Percent-encode each value (a space is %20, & is %26, # is %23, + is %2B).',
    'v=1 is the format version.' + (M.qs ? ' qs=<key> starts from that Quick Start; without it the tool starts from its defaults.' : ' The tool starts from its defaults.'),
    ('Then each key in the link is set, in the units its label shows on screen. ' + unitExample(M)).trim() + ' Numbers may carry $, commas and a trailing %. A checkbox takes true or false. A select or a choice takes the value listed, or its visible label.',
    'Anything the link does not name keeps the value it started from, so send only what differs.',
    `why.<key>=<text>: your reason for that value, shown to the user beside it (${WHY_MAX} characters at most). note=<text>: one line shown above the list, for example the place and the date.`,
    'A number outside a field\'s range is pulled into range and the user is told; a key the tool does not know is skipped and listed. Never use the keys s, open or embed.',
  ];
}

/* ── agent.txt ───────────────────────────────────────────────────────────── */
// "$ Dollar" rather than "$ ($ Dollar)"; "dollar (Fixed amount)".
const optText = o => !o.value ? '(blank)' + (o.label ? ` (${o.label})` : '')
  : !o.label || o.label === o.value ? o.value
  : o.label.startsWith(o.value + ' ') ? o.label : `${o.value} (${o.label})`;
const orList = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' or ' + a[a.length - 1];
// A select that shares its row's label with the amount beside it is named by its options:
// "Rent amount (a month, a week or a year)".
function labelOf(f, M) {
  const label = f.label || f.key;
  if (!f.options || f.type === 'r') return label;
  const twin = M.fields.some(o => o !== f && o.label === f.label);
  return twin && f.options.length <= 4 ? `${label} (${orList(f.options.map(o => o.label || o.value))})` : label;
}

function fieldKind(f, M) {
  const pairsWith = f.pairs.filter(k => M.byKey[k] && !M.hide.has(k));
  let s;
  if (f.type === 'c') s = 'Checkbox: true or false.';
  else if (f.options) s = 'One of: ' + f.options.map(optText).join(', ') + '.';
  else {
    const unit = f.input === 'range' ? f.unit : [f.prefix && f.prefix + ' before it', f.suffix && f.suffix + ' after it'].filter(Boolean).join(', ');
    const kind = f.input === 'range' ? 'Slider' : f.money ? 'Amount' : f.input === 'number' || f.numeric ? 'Number' : f.input === 'date' ? 'Date as YYYY-MM-DD' : 'Text';
    s = kind + (unit ? ` (${unit})` : '') + '.';
    if (f.min != null && f.max != null) s += ` ${show(f.min)} to ${show(f.max)}` + (f.step && f.step !== 'any' && f.input !== 'range' ? `, step ${f.step}` : '') + '.';
    else if (f.min != null) s += ` At least ${show(f.min)}.`;
    else if (f.max != null) s += ` At most ${show(f.max)}.`;
  }
  if (pairsWith.length) s += (f.tag === 'select' ? ' Sets the unit of ' : ' Its unit is set by ') + pairsWith.join(' and ') + '.';
  // A date field opens on a day counted from today, so its value would change the docs daily: say so instead.
  const def = f.input === 'date' ? 'a day the page sets from today (see below)'
    : f.value === '' || f.value == null ? 'blank' : f.type === 'c' ? String(f.value) : plain(f, f.value);
  return s + ' Default ' + def + '.';
}

function qsLines(M) {
  const out = [];
  const { qs } = M;
  const all = qs.groups.flatMap(g => g.items);
  const valued = all.length > 1 && all.every(it => it.values);
  const same = (items, k) => items.length > 0 && items.every(it => JSON.stringify(it.values[k]) === JSON.stringify(items[0].values[k]));
  const kv = (values, keys) => keys.map(k => `${k}=${plain(M.byKey[k], values[k])}`).join(' ');
  const keysOf = it => Object.keys(it.values || {}).filter(k => (M.byKey[k] || M.compact.includes(k)) && !M.hide.has(k));
  const shared = valued ? keysOf(all[0]).filter(k => same(all, k)) : [];
  if (shared.length) out.push('Every Quick Start sets: ' + kv(all[0].values, shared), '');
  for (const g of qs.groups) {
    const groupShared = valued ? keysOf(g.items[0] || {}).filter(k => !shared.includes(k) && same(g.items, k)) : [];
    const groupExtra = g.items.length > 1 && g.items.every(it => it.extra === g.items[0].extra) ? g.items[0].extra : '';
    if (g.title || g.key) {
      let head = (g.key ? g.key + ': ' : '') + (g.title || '');
      if (g.key && g.alias) head += `. qs=${g.key} alone loads ${g.alias}`;
      out.push(head + '.');
      if (groupShared.length) out.push('  Sets: ' + kv(g.items[0].values, groupShared));
      if (groupExtra) out.push('  ' + (g.items[0].extraLabel || 'Loan') + ': ' + groupExtra + '.');
    }
    for (const it of g.items) {
      const own = valued ? keysOf(it).filter(k => !shared.includes(k) && !groupShared.includes(k)) : [];
      let line = (g.title || g.key ? '  ' : '') + it.key + ': ' + it.title + '.';
      if (own.length) line += ' ' + kv(it.values, own);
      if (it.extra && !groupExtra) line += ' ' + (it.extraLabel || 'Loan') + ': ' + it.extra + '.';
      out.push(line);
    }
  }
  return out;
}

// Wrap at width; a line that opens with "- " or "1. " hangs its continuation under its text.
function wrapText(s, width = 100, indent = '') {
  const words = String(s).split(/\s+/).filter(Boolean);
  const hang = /^([-*]|\d+\.)$/.test(words[0] || '') ? ' '.repeat(words[0].length + 1) : '';
  const lines = [];
  let cur = '';
  for (const w of words) {
    const pre = lines.length ? indent + hang : indent;
    if (cur && (pre + cur + ' ' + w).length > width) { lines.push(pre + cur); cur = w; }
    else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) lines.push((lines.length ? indent + hang : indent) + cur);
  return lines;
}

function agentTxt(M) {
  const { P, notes } = M;
  const S = notes.sections;
  const L = [];
  const para = (s, indent = '') => L.push(...wrapText(s, 100, indent));
  L.push(`${M.title}: use this tool with an AI assistant`, M.base, '');
  if (P.lang !== 'en') { para(PEOPLE[P.lang].lead); L.push(''); }
  para('For people: ' + PEOPLE.en.lead);
  L.push('', 'WHAT THIS TOOL DECIDES');
  para(S['decides']);
  L.push('', AI_RULES, '', 'LINK FORMAT', pattern(M));
  for (const l of protocolLines(M)) para('- ' + l, '');
  L.push('', 'EXAMPLE');
  para('Request: ' + M.example.request);
  L.push('A reply in that form:');
  M.example.assumptions.forEach((a, i) => para(`${i + 1}. ${a}`));
  L.push(M.link, '```', M.link, '```', 'Open the link to see the result.');
  // The Quick Starts in brief here; their figures, which can run long, close the file, so a
  // reader that stops early still has every field.
  if (M.qs) {
    L.push('', 'QUICK STARTS (qs)');
    if (S['quick starts']) for (const p of S['quick starts'].split(/\n\s*\n/)) para(p);
    for (const l of M.qs.short || ['qs takes one of: ' + M.qsKeys.join(', ') + '.']) para(l);
    if (M.qs.groups.some(g => g.items.some(it => it.values))) para('What each Quick Start sets is listed under QUICK START FIGURES at the end.');
  }
  L.push('', 'FIELDS (key: label on the page)');
  if (M.important.length) para('Most important: ' + M.important.join(', ') + '.');
  let group = null, lastTip = '';
  for (const f of M.fields) {
    if (M.hide.has(f.key)) continue;
    const g = f.group || 'Other';
    if (g !== group) { L.push('', `[${g}]`); group = g; }
    L.push(`${f.key}: ${labelOf(f, M)}${M.important.includes(f.key) ? '  (most important)' : ''}`);
    para(fieldKind(f, M), '  ');
    if (M.notes.fieldNotes[f.key]) para(M.notes.fieldNotes[f.key], '  ');
    // Fields in one row share its tip: say it once.
    if (f.tip && f.tip !== lastTip) para('Tip on the page: ' + f.tip, '  ');
    lastTip = f.tip;
  }
  const extraNotes = Object.keys(M.notes.fieldNotes).filter(k => !M.byKey[k]);
  if (S['compact lists']) {
    L.push('', 'COMPACT LISTS');
    for (const line of S['compact lists'].split('\n')) L.push(line);
  }
  for (const k of extraNotes) { L.push(''); para(`${k}: ${M.notes.fieldNotes[k]}`); }
  if (S['json']) {
    L.push('', 'JSON');
    for (const line of S['json'].split('\n')) L.push(line);
  }
  if (M.qs && M.qs.groups.some(g => g.items.some(it => it.values))) {
    L.push('', 'QUICK START FIGURES (what each qs sets, as a link would carry them)');
    para('A heading line holds what all the Quick Starts under it share; each Quick Start\'s own line holds the rest.');
    L.push('', ...qsLines(M));
  }
  // Generated reference sections a page asks for (PAGES.reference: the builder's block types), last.
  for (const r of M.reference || []) {
    L.push('', 'REFERENCE: ' + r.title);
    for (const line of r.lines) L.push(line);
  }
  L.push('', 'Generated by _ref/agent-doc.mjs from the page and its agent-notes.md.');
  return L.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}

/* ── The HTML card ───────────────────────────────────────────────────────── */
// Text inside an element; attr() for an attribute value.
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = s => esc(s).replace(/"/g, '&quot;');

function keyLine(f, M) {
  if (!f) return '';
  let unit = '';
  if (f.type === 'c') unit = 'true or false';
  else if (f.options && f.options.length <= 6) unit = f.options.map(o => o.label && o.label !== o.value ? `${o.value} = ${o.label}` : o.value).join(', ');
  else if (f.options) unit = f.options.map(o => o.value).filter(Boolean).join(', ');
  else {
    const u = f.input === 'range' ? f.unit : [f.prefix, f.suffix].filter(Boolean).join(' ');
    const by = f.pairs.filter(k => M.byKey[k] && M.byKey[k].tag === 'select').map(k => 'unit set by ' + k);
    unit = [u, ...by, f.min != null && f.max != null ? `${show(f.min)} to ${show(f.max)}` : ''].filter(Boolean).join(', ');
  }
  // On an id/ page the labels are the page's own Indonesian ones.
  const label = esc(f.label || f.key);
  return `<li><code>${esc(f.key)}</code> ${M.P.lang !== 'en' ? `<span lang="${M.P.lang}">${label}</span>` : label}` +
    `${unit ? ` <span class="agent-unit">(${esc(unit)})</span>` : ''}</li>`;
}

function section(M) {
  const { P, notes } = M;
  const S = notes.sections;
  const txtUrl = M.base + 'agent.txt';
  const qsShort = M.qs ? (M.qs.short || ['qs takes one of: ' + M.qsKeys.join(', ') + '.']) : [];
  const keys = M.important.filter(k => M.byKey[k]).map(k => keyLine(M.byKey[k], M));
  const compactKeys = M.important.filter(k => M.compact.includes(k));
  const H = [];
  H.push(MARK_START);
  H.push(`<!-- Generated by _ref/agent-doc.mjs from ${P.notes} and the page itself: edit those, then run it. -->`);
  H.push('<details class="card agent-card" id="agentHelp" data-no-abbr>');
  H.push(`<summary class="agent-sum"><span>${esc(PEOPLE[P.lang].summary)}</span><svg class="agent-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary>`);
  H.push('<div class="agent-body">');
  H.push(`<p>${esc(PEOPLE[P.lang].lead)}</p>`);
  if (P.lang !== 'en') H.push('<div lang="en">');
  H.push(`<p><strong>What this tool decides:</strong> ${esc(S['decides'])}</p>`);
  H.push(`<pre class="agent-pre agent-rules">${esc(AI_RULES)}</pre>`);
  H.push('<p><strong>Link format</strong></p>');
  H.push(`<pre class="agent-pre">${esc(pattern(M))}</pre>`);
  H.push(`<p>${esc(protocolLines(M).slice(1).join(' '))}</p>`);
  H.push(`<p><strong>Example</strong> for: "${esc(M.example.request)}"</p>`);
  H.push(`<pre class="agent-pre">${esc(M.link)}</pre>`);
  if (qsShort.length) H.push(`<p><strong>Quick Starts</strong> ${esc(qsShort.join(' '))}</p>`);
  if (keys.length) {
    H.push('<p><strong>Main keys</strong></p>');
    H.push('<ul class="agent-keys">' + keys.join('') + '</ul>');
  }
  if (compactKeys.length) H.push(`<p>Lists: ${esc(compactKeys.join(', '))}; their syntax is in agent.txt.</p>`);
  if ((M.reference || []).length) H.push(`<p>Also in agent.txt: ${esc(M.reference.map(r => r.title.toLowerCase()).join(' and '))}.</p>`);
  if ((P.families || []).length) H.push(`<p>Keys that start with ${esc(P.families.join(' or '))} change a part of the tool by its name; their syntax is in agent.txt.</p>`);
  H.push(`<p>Every key with its range and default${M.qs ? ', each Quick Start\'s figures' : ''} and the list syntaxes: <a href="${attr(txtUrl)}">${esc(txtUrl)}</a></p>`);
  if (P.lang !== 'en') H.push('</div>');
  H.push('</div>');
  H.push('</details>');
  H.push(MARK_END);
  return H.join('\n');
}

function withSection(html, M) {
  const sec = section(M);
  if (SECTION_RE.test(html)) return html.replace(SECTION_RE, () => sec);
  const at = html.indexOf(M.P.insertBefore || '\u0000');
  if (at < 0) { problem(M.P.page, 'index.html has no agent markers and no insertBefore anchor'); return html; }
  return html.slice(0, at) + sec + '\n\n' + html.slice(at);
}

/* ── llms.txt ────────────────────────────────────────────────────────────── */
function llmsSection() {
  const L = [MARK_START, '## Use a tool through an AI assistant (the #load link)', ''];
  L.push(
    'An AI assistant can open a tool on the user\'s own scenario with one link, and the tool computes the answer in the user\'s browser. Each tool page carries a folded "Use this tool with an AI assistant" section, and the full reference for each page (every key, its range and default, the Quick Starts and an example) is in that page\'s agent.txt, listed below.',
    '',
    AI_RULES,
    '',
    'Link format (version 1):',
    SITE + '/<tool>/#load&v=1&qs=<quick start>&<key>=<value>&...&why.<key>=<your reason>&note=<one line>',
    '- The fragment starts with load, then key=value pairs joined by &, each value percent-encoded. No base64, no compression.',
    '- Keys are the tool\'s own field keys, listed in its agent.txt. Reserved keys: v (format version, 1), qs (a Quick Start to start from), why.<key> (your reason for a value, shown to the user, ' + WHY_MAX + ' characters at most), note (one line shown at the top), json (structured state, for tools whose agent.txt defines it), run (0 opens a heavy optimiser without solving). Never use s, open or embed: they belong to Share links and embeds.',
    '- Values are what the field shows on screen, in the units of its label: mortgageRate=6.1 means 6.1 %/yr, not 0.061.',
    '- Base, then overrides: the Quick Start (or the tool\'s defaults), then each key in the link. Anything not named keeps its base value, so send only what differs.',
    '- Long links are fine: everything after # stays in the browser. Give a long link both as a link and inside a code block.',
    '',
    'Pages with an agent.txt:',
  );
  for (const M of models) {
    const lang = M.P.lang === 'id' ? ' (Indonesian page)' : '';
    L.push(`- ${M.title}${lang}: ${M.base}agent.txt`);
  }
  L.push(MARK_END);
  return L.join('\n');
}

function withLlms(text) {
  const sec = llmsSection();
  if (SECTION_RE.test(text)) return text.replace(SECTION_RE, () => sec);
  // First time: right after the disambiguation note, before the long tool descriptions.
  const at = text.indexOf('## Why these tools stand out');
  if (at < 0) { problem('llms.txt', 'no agent markers and no "## Why these tools stand out" heading to put them before'); return text; }
  return text.slice(0, at) + sec + '\n\n' + text.slice(at);
}

/* ── Read every page ─────────────────────────────────────────────────────── */
const srv = await serve();
const browser = await launch();
const models = [];
try {
  for (const P of PAGES) {
    const { page, errors, close } = await openPage(browser, srv.origin, P.url);
    const read = await page.evaluate(readFields);
    const qs = await page.evaluate(P.quickStarts || defaultQuickStarts, P.lang);
    const reference = P.reference ? await page.evaluate(P.reference) : null;
    await close();
    if (errors.length) problem(P.page, 'page error while reading it: ' + errors[0]);
    const notesPath = join(ROOT, P.notes);
    if (!existsSync(notesPath)) { problem(P.page, P.notes + ' is missing'); continue; }
    const M = model(P, read, qs, parseNotes(readFileSync(notesPath, 'utf8')));
    M.reference = reference || [];
    models.push(M);
  }
} finally {
  await browser.close();
  await srv.close();
}

/* ── Write, or compare ───────────────────────────────────────────────────── */
const outputs = [];
for (const M of models) {
  outputs.push([join(M.P.page, 'agent.txt'), agentTxt(M)]);
  const htmlPath = join(ROOT, M.P.page, 'index.html');
  outputs.push([join(M.P.page, 'index.html'), withSection(readFileSync(htmlPath, 'utf8'), M)]);
}
outputs.push(['llms.txt', withLlms(readFileSync(join(ROOT, 'llms.txt'), 'utf8'))]);

// Every generated text carries the rules exactly (check A7 in agent-check holds them to it too).
for (const [rel, text] of outputs) {
  const body = rel.endsWith('.html') ? (text.match(SECTION_RE) || [''])[0] : text;
  const rules = rel.endsWith('.html') ? esc(AI_RULES) : AI_RULES;
  if (!body.includes(rules)) problem(rel, 'the generated text lacks the rules block');
}

if (problems.length) {
  console.error('agent-doc: nothing written.\n' + problems.map(p => '  ' + p).join('\n'));
  process.exit(1);
}

const stale = [];
for (const [rel, text] of outputs) {
  const file = join(ROOT, rel);
  const now = existsSync(file) ? readFileSync(file, 'utf8') : null;
  if (now === text) continue;
  stale.push(rel);
  if (!CHECK) writeFileSync(file, text);
}
const via = [...new Set(models.map(M => M.source))].join(', ');
if (CHECK) {
  if (stale.length) {
    console.error('agent-doc --check: these files differ from what node _ref/agent-doc.mjs would write:\n' + stale.map(s => '  ' + s).join('\n'));
    process.exit(1);
  }
  console.log(`agent-doc --check: ${outputs.length} files up to date (fields read via ${via}).`);
} else {
  console.log(stale.length ? stale.map(s => s + ' written').join('\n') : 'agent-doc: every file already up to date.');
  console.log(`(fields read via ${via})`);
}
