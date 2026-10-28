#!/usr/bin/env node
// AI links — site-wide check.
//
// A reader asks their own chatbot about a tool; the chatbot reads the page's AI section
// (<tool>/agent.txt, written by _ref/agent-doc.mjs) and replies with a #load link that
// opens the tool on that scenario (SharedAgent in shared.js). Such a link lives on in the
// reader's chat history as long as a Share link does, and anyone can write one, so this
// drives the real pages in headless Chromium to hold them to what they promise:
//
//   A1. THE DOCS NAME ONLY WHAT IS THERE. Every key the generated docs list (agent.txt and
//       the folded card on the page) is a live control the mini cache saves, every choice
//       they print is one of its options, every list key is one the tool's adapter reads,
//       every Quick Start they name is one the page has, every figure they print is a value
//       its field takes, and llms.txt lists each page's agent.txt and nothing else. A
//       chatbot that follows the docs never writes a link the tool cannot read.
//   A2. A KEPT LINK KEEPS OPENING. _ref/agent-links.json keeps links as a chatbot writes
//       them (the docs' examples, each list syntax, a realistic one over a sample of the
//       Quick Starts). Each opens with no page or console error, nothing "not recognised",
//       nothing pulled into range and nothing it could not apply; every key it names is a
//       row in the banner, with its why and its note; and the fields it names hold the
//       values it expects, as the input shows them, with the page's probe (state beyond the
//       fields) matching what it names. A field renamed since fails here: the tool keeps
//       reading the old name (data-persist, or a migration in its load). Never edit a link.
//   A3. A BAD LINK STILL OPENS THE TOOL. Unknown keys (s and embed among them, which belong
//       to Share links), a number out of range, a Quick Start that does not exist,
//       malformed json and a fragment over 512 KB each open the tool normally, with no
//       error, the rest of the link applied (none of it past 512 KB, all of it at exactly
//       512 KB), and the banner saying what it skipped, clamped or refused.
//   A4. UNDO GIVES THE READER'S WORK BACK. A link opens over the tool's defaults, not the
//       reader's last scenario: that cache is kept byte for byte in abt:prev:<ns>:v<ver>,
//       and the banner's Undo restores every saved field and the state beyond them
//       exactly, and saves it again. With no earlier cache there is no Undo.
//   A5. THE DOCS ARE GENERATED. node _ref/agent-doc.mjs --check passes: what is on the
//       site is what the generator writes from the page and its notes, with no drift.
//   A6. AN ENGINEERING MODEL COMES WHOLE. Each Engineering page (a PAGES entry with a
//       solved hook) keeps a link carrying a whole custom model in json, and it opens and
//       solves.
//   A7. THE RULES ARE THE RULES. Every generated text (each agent.txt, the pre.agent-rules
//       in each page's card, the llms.txt section) carries AI_RULES verbatim, so no
//       chatbot is told it may answer the question itself; and no generated text and no
//       kept link uses the keys s, open or embed.
//   H.  THE LINK STEPS ASIDE. Once applied, the #load hash is gone from the address, and a
//       reload keeps what the reader changed after it instead of applying the link again.
//   N.  NO LINK, NO CHANGE. Without #load the page is as it was: no banner, an empty
//       report, no abt:prev: copy, and its cache restores as before.
//
// Adding a page is data, not code: its PAGES entry in _ref/agent-lib.mjs (with a probe
// for state beyond the fields, and a solved hook for an Engineering page), its notes, and
// its kept links here. Pages run in a fresh browser context with the chart libraries
// stubbed (agent-lib's openPage), so it runs offline.
//
// Run: node _ref/agent-check.mjs [page]     page: part of a PAGES page, e.g. rentvsownhouse
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  AI_RULES, PAGES, ROOT, SITE, RESERVED, FORBIDDEN, WHY_MAX, SECTION_RE, LIST_KEY_RE,
  serve, launch, openPage, readFields, defaultQuickStarts, defaultProbe
} from './agent-lib.mjs';

const FILTER = process.argv.slice(2).find(a => !a.startsWith('-')) || '';
const pages = PAGES.filter(P => !FILTER || P.page.includes(FILTER.replace(/^\/|\/$/g, '')));
if (!pages.length) { console.error(`agent-check: no page in PAGES matches "${FILTER}"`); process.exit(2); }

const AGENT_MAX = 512 * 1024;           // shared.js: a longer fragment is refused whole
const KEPT_FILE = join(ROOT, '_ref', 'agent-links.json');
const KEPT = JSON.parse(readFileSync(KEPT_FILE, 'utf8'));
const keptFor = P => KEPT.links.filter(k => k.page === P.url);

const IDS = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'H', 'N'];
const tally = Object.fromEntries(IDS.map(id => [id, { pass: 0, fail: 0 }]));
function check(id, name, ok, detail) {
  console.log((ok ? '  PASS  ' : '✗ FAIL  ') + id + ' ' + name + (detail ? '  — ' + detail : ''));
  tally[id][ok ? 'pass' : 'fail']++;
}
const short = (v, n = 60) => { const s = typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v ?? null); return s.length > n ? s.slice(0, n) + '…' : s; };
const list = (a, n = 6) => a.slice(0, n).join('; ') + (a.length > n ? `; and ${a.length - n} more` : '');

/* ── Values ──────────────────────────────────────────────────────────────── */
const toNumber = s => {
  const t = String(s).replace(/[\s,_$]/g, '').replace(/−/g, '-').replace(/%$/, '');
  return t === '' || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t) ? NaN : Number(t);
};
const close = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
// A field's value against what a kept link expects: the text the input shows, or the same number.
function sameValue(want, got) {
  if (typeof want === 'boolean' || typeof got === 'boolean') return want === got;
  if (String(want) === String(got ?? '')) return true;
  const a = toNumber(want), b = toNumber(got);
  return Number.isFinite(a) && Number.isFinite(b) && close(a, b);
}
// What a probe returned against what a kept link names: every key it names, lists whole.
function partial(want, got, path = '') {
  const at = path || '(probe)';
  if (Array.isArray(want)) {
    if (!Array.isArray(got)) return [`${at}: ${short(got)}, expected a list`];
    if (got.length !== want.length) return [`${at}: ${got.length} items, expected ${want.length}`];
    return want.flatMap((w, i) => partial(w, got[i], `${path}[${i}]`));
  }
  if (want && typeof want === 'object') {
    if (!got || typeof got !== 'object') return [`${at}: ${short(got)}, expected an object`];
    return Object.keys(want).flatMap(k => partial(want[k], got[k], path ? path + '.' + k : k));
  }
  if (typeof want === 'number') return typeof got === 'number' && close(want, got) ? [] : [`${at}: ${short(got)}, expected ${want}`];
  return want === got ? [] : [`${at}: ${short(got)}, expected ${short(want)}`];
}
const isNumeric = f => f.input === 'number' || f.input === 'range' || f.money || f.numeric;
// Why a field would not take this value from a link as it is, or ''.
function refuses(f, v) {
  if (f.type === 'c') return /^(true|false|1|0|on|off|yes|no)$/i.test(v) ? '' : 'not true or false';
  if (f.options) {
    const low = String(v).toLowerCase();
    return f.options.some(o => o.value === v || o.value.toLowerCase() === low || o.label.toLowerCase() === low) ? '' :
      'not one of ' + f.options.map(o => o.value).join(', ');
  }
  if (isNumeric(f)) {
    if (String(v).trim() === '') return f.input === 'range' ? 'blank' : '';
    const n = toNumber(v);
    if (!Number.isFinite(n)) return 'not a number';
    if (f.min != null && n < +f.min) return 'below ' + f.min;
    if (f.max != null && n > +f.max) return 'above ' + f.max;
  }
  return '';
}

/* ── Links ───────────────────────────────────────────────────────────────── */
// "#load&v=1&k=v..." (or a whole address) into [[key, value]], decoded as shared.js does.
function pairsOf(link) {
  const hash = String(link).slice(String(link).indexOf('#') + 1);
  const dec = s => { s = s.replace(/\+/g, ' '); try { return decodeURIComponent(s); } catch (e) { return s; } };
  return hash.replace(/^load(?:=[^&]*)?(?:[?&/]|$)/, '').split('&').filter(Boolean).map(p => {
    const eq = p.indexOf('=');
    return [dec(eq < 0 ? p : p.slice(0, eq)).trim(), eq < 0 ? '' : dec(p.slice(eq + 1))];
  });
}
// A key in one of the page's families (PAGES.families: el.<name>.<param>), which its adapter reads.
const inFamily = (live, k) => (live.families || []).some(pre => k.length > pre.length && k.startsWith(pre));
// What would stop a link the docs print from opening as written.
function linkProblems(pairs, live) {
  const out = [];
  for (const [k, v] of pairs) {
    if (FORBIDDEN.includes(k)) { out.push(`uses the forbidden key ${k}`); continue; }
    if (k === 'v') { if (v !== '1') out.push(`v=${v}`); continue; }
    if (k === 'qs') { if (!live.qs.has(v) && !live.qs.has(v.toLowerCase())) out.push(`qs=${v} is not a Quick Start`); continue; }
    if (k === 'note') { if (v.length > WHY_MAX) out.push('note is over ' + WHY_MAX); continue; }
    if (k === 'json') { try { JSON.parse(v); } catch (e) { out.push('json does not parse'); } continue; }
    if (k === 'run') continue;
    if (k.startsWith('why.')) {
      const t = k.slice(4);
      if (!live.byKey[t] && !live.lists.includes(t) && !inFamily(live, t)) out.push(`${k} explains no key`);
      if (v.length > WHY_MAX) out.push(`${k} is over ${WHY_MAX}`);
      continue;
    }
    if (live.lists.includes(k) || inFamily(live, k)) continue;
    const f = live.byKey[k];
    if (!f) { out.push(`${k} is not a key`); continue; }
    const why = refuses(f, v);
    if (why) out.push(`${k}=${v}: ${why}`);
  }
  return out;
}

/* ── The generated docs ──────────────────────────────────────────────────── */
const read = rel => (existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), 'utf8') : null);
const HEADS = ['WHAT THIS TOOL DECIDES', 'LINK FORMAT', 'EXAMPLE', 'QUICK STARTS (qs)', 'FIELDS (', 'COMPACT LISTS', 'JSON',
  'QUICK START FIGURES', 'Generated by '];
function sectionsOf(txt) {
  const out = {}, lines = txt.split('\n');
  let cur = '';
  for (const line of lines) {
    const h = HEADS.find(x => line.startsWith(x));
    if (h) { cur = h.replace(/ \($|\s+$/, ''); out[cur] = []; continue; }
    if (cur) out[cur].push(line);
  }
  return out;
}
// A paren-balanced split of "a, b (c, d), e".
function splitTop(s) {
  const out = [];
  let depth = 0, cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') depth++;
    if (c === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && s.startsWith(', ', i)) { out.push(cur); cur = ''; i++; continue; }
    cur += c;
  }
  if (cur) out.push(cur);
  return out;
}
function parseDocs(txt) {
  const S = sectionsOf(txt);
  const D = { fields: [], important: [], lists: [], listNotes: [], qs: [], figures: [], links: [] };
  // Fields: "key: label", its description indented under it.
  let cur = null, imp = null;
  for (const line of S['FIELDS'] || []) {
    if (/^Most important: /.test(line)) { imp = line; continue; }
    if (imp != null) { if (line.trim()) { imp += ' ' + line.trim(); continue; } D.important = imp.replace(/^Most important: /, '').replace(/\.$/, '').split(/,\s*/); imp = null; }
    const m = /^([A-Za-z_][\w.-]*): (.*)$/.exec(line);
    if (m) { cur = { key: m[1], body: '' }; D.fields.push(cur); continue; }
    if (cur && /^ {2}\S/.test(line)) cur.body += ' ' + line.trim();
    else if (!line.trim() || /^\[/.test(line)) cur = null;
  }
  for (const f of D.fields) {
    const m = /One of: (.*?)\. (?:Sets the unit of [^.]*\. )?Default /.exec(f.body);
    if (m) f.options = splitTop(m[1]);
  }
  for (const line of S['COMPACT LISTS'] || []) {
    const m = LIST_KEY_RE.exec(line);
    if (m && !D.lists.includes(m[1])) D.lists.push(m[1]);
    const n = /^([A-Za-z_]\w*): /.exec(line);
    if (n) D.listNotes.push(n[1]);
  }
  // Quick Starts: the keys a figures line names, and its key=value figures.
  const figs = (line, from) => {
    for (const m of line.slice(from).matchAll(/(?:^|\s)([A-Za-z_][\w.]*)=(\S+)/g)) D.figures.push([m[1], m[2], line.trim().slice(0, 50)]);
  };
  for (const line of S['QUICK START FIGURES'] || []) {
    let m;
    if ((m = /^Every Quick Start sets: /.exec(line))) figs(line, m[0].length);
    else if ((m = /^ {2}Sets: /.exec(line))) figs(line, m[0].length);
    else if (/^ {2}Loan: /.test(line)) continue;
    else if ((m = /^ {0,2}(\S+): /.exec(line))) { D.qs.push(m[1]); figs(line, m[0].length); }
  }
  const qsPara = (S['QUICK STARTS'] || []).join(' ');
  const one = /qs takes one of: (.*?)\.(?:\s|$)/.exec(qsPara);
  if (one) D.qs.push(...one[1].split(/,\s*/));
  D.qs = [...new Set(D.qs)];
  D.links = [...new Set((txt.match(/https?:\/\/\S*#load[^\s`]*/g) || []).filter(l => !l.includes('<')))];
  return D;
}

/* ── Pages ───────────────────────────────────────────────────────────────── */
const srv = await serve();
const browser = await launch();

async function settled(page) {
  await page.waitForFunction(() => document.documentElement.dataset.agentLoad === 'done', null, { timeout: 30000 });
  await page.waitForTimeout(250);
}
// Once a #load link has applied; V.failed says why it never did.
async function arrived(V, fragment) {
  V.failed = '';
  if (fragment && fragment.startsWith('#load')) await settled(V.page).catch(e => { V.failed = 'the link never finished applying: ' + e.message.split('\n')[0]; });
  return V;
}
// A page in a fresh context (empty storage), or the same tab again (its storage kept).
const visit = async (P, fragment) => {
  const V = await openPage(browser, srv.origin, P.url + (fragment || ''), { prices: !!P.prices });
  V.page.__P = P;   // valuesOf and type reach a page's virtual fields through it
  return arrived(V, fragment);
};
async function goTo(V, P, fragment) {
  await V.page.goto('about:blank');
  await V.page.goto(srv.origin + P.url + (fragment || ''), { waitUntil: 'load' });
  await V.page.waitForTimeout(400);
  return arrived(V, fragment);
}
const valuesOf = async page => {
  const vals = Object.fromEntries((await page.evaluate(readFields)).fields.map(f => [f.key, f.value]));
  // A page with no form fields of its own reads its virtual ones (PAGES.virtual in agent-lib.mjs).
  const P = page.__P;
  if (P && P.virtual) for (const v of P.virtual) if (!(v.key in vals)) vals[v.key] = await page.evaluate(P.virtualRead, v.key);
  return vals;
};
const probeOf = (page, P) => page.evaluate(P.probe || defaultProbe);
const snapshot = page => page.evaluate(() => ({
  report: window.SharedAgent ? SharedAgent.report : undefined,
  link: window.SharedAgent ? SharedAgent.link : undefined,
  hash: location.hash,
  flag: document.documentElement.dataset.agentLoad || '',
  banner: !!document.querySelector('.agent-banner'),
  note: (document.querySelector('.agent-banner .agent-note') || {}).textContent || '',
  rows: Array.from(document.querySelectorAll('.agent-banner .agent-row[data-key]')).map(r => r.getAttribute('data-key')),
  unknown: (document.querySelector('.agent-banner .agent-unknown') || {}).textContent || '',
  clamped: (document.querySelector('.agent-banner .agent-clamped') || {}).textContent || '',
  errors: (document.querySelector('.agent-banner .agent-errors') || {}).textContent || '',
  undo: !!document.querySelector('.agent-banner .agent-undo'),
  storage: Object.fromEntries(Object.keys(localStorage).filter(k => /^abt:(save|prev):/.test(k)).map(k => [k, localStorage.getItem(k)]))
}));
const errorsOf = V => [...V.errors, ...V.consoleErrors];
// A field a person would type into, for the edits these checks make by hand: a number box
// with a range, not one the link names.
function editable(live, skip = []) {
  const f = live.fields.find(f => f.type === 'v' && f.input === 'number' && f.min != null && f.max != null && !skip.includes(f.key)) ||
    live.fields.find(f => f.type === 'v' && f.input === 'range' && f.min != null && f.max != null && !skip.includes(f.key)) ||
    // A typed amount with a range (a currency field), when the page has no number box or slider.
    live.fields.find(f => f.type === 'v' && f.numeric && f.min != null && f.max != null && !skip.includes(f.key));
  return f || null;
}
// A value one away from `from`, inside the field's range.
function nudged(f, from) {
  const n = Number.isFinite(toNumber(from)) ? toNumber(from) : +f.min;
  // A slider lands on its step, so move it one step; any other field, one. A range too narrow to move
  // by one (0.5 to 1 p.u.) moves by the field's own step, else a tenth of the range.
  const span = f.max != null && f.min != null ? +f.max - +f.min : Infinity;
  const st = f.input === 'range' && +f.step > 0 ? +f.step : span < 2 ? (+f.step > 0 ? +f.step : span / 10) : 1;
  const v = n + st <= +f.max ? n + st : n - st;
  return String(+v.toFixed(6));
}
// Type a value into a field as a person would: input, then change and blur.
const type = (page, key, value) => page.__P && page.__P.virtual && page.__P.virtual.some(v => v.key === key) ? page.evaluate(page.__P.virtualWrite, [key, value]) : page.evaluate(([key, value]) => {
  const f = SharedAgent.fields().find(x => x.key === key);
  f.el.value = value;
  f.el.dispatchEvent(new Event('input', { bubbles: true }));
  f.el.dispatchEvent(new Event('change', { bubbles: true }));
  f.el.dispatchEvent(new FocusEvent('blur'));
  f.el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
}, [key, value]);

/* What a page has, read once: its fields, Quick Starts, the list keys its docs name. */
async function liveOf(P) {
  const V = await visit(P);
  const got = await V.page.evaluate(readFields);
  const real = new Set(got.fields.map(f => f.key));
  // Compact keys that stand in as number boxes on a page with no form fields (PAGES.virtual).
  for (const v of P.virtual || []) if (!real.has(v.key)) {
    got.fields.push({ key: v.key, type: 'v', tag: 'input', input: 'number', label: v.key, group: '', prefix: '', suffix: '', unit: '',
      money: false, numeric: true, min: v.min, max: v.max, step: null, value: v.value, options: null, pairs: [], tip: '', virtual: true });
  }
  const qsRead = await V.page.evaluate(P.quickStarts || defaultQuickStarts, P.lang);
  const card = await V.page.evaluate(() => {
    const box = document.getElementById('agentHelp');
    return box ? {
      keys: Array.from(box.querySelectorAll('.agent-keys code')).map(c => c.textContent.trim()),
      pres: Array.from(box.querySelectorAll('pre.agent-pre')).map(p => p.textContent),
      rules: (box.querySelector('pre.agent-rules') || {}).textContent || null
    } : null;
  });
  const errs = errorsOf(V);
  await V.close();
  const qs = new Set();
  if (qsRead) for (const g of qsRead.groups) { if (g.key) qs.add(g.key); for (const it of g.items) qs.add(it.key); }
  const txt = read(P.page + '/agent.txt');
  const docs = txt ? parseDocs(txt) : null;
  return { fields: got.fields, byKey: Object.fromEntries(got.fields.map(f => [f.key, f])), qs, card, docs, txt,
    lists: docs ? docs.lists.filter(k => !real.has(k)) : [], families: P.families || [], errs };
}

/* ── A5: no drift (one run covers every page) ─────────────────────────────── */
console.log('── A5 the docs are what the generator writes ──');
{
  const r = spawnSync(process.execPath, [join(ROOT, '_ref', 'agent-doc.mjs'), '--check'], { encoding: 'utf8' });
  const out = (r.stdout + r.stderr).trim().split('\n').map(s => s.trim()).filter(Boolean);
  check('A5', 'node _ref/agent-doc.mjs --check', r.status === 0, r.status === 0 ? out[0] : list(out, 8));
}

/* ── A7: the rules, verbatim; no forbidden keys (files only) ──────────────── */
console.log('\n── A7 the rules, verbatim ──');
const unescape = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const forbiddenIn = text => [...new Set([...String(text).matchAll(/(?:[#&?\s]|^)(s|open|embed)=/gm)].map(m => m[1]))];
const llms = read('llms.txt') || '';
const llmsSec = (llms.match(SECTION_RE) || [''])[0];
for (const P of pages) {
  const txt = read(P.page + '/agent.txt');
  check('A7', `${P.page}/agent.txt carries AI_RULES verbatim`, !!txt && txt.includes(AI_RULES), !txt ? 'missing' : txt.includes(AI_RULES) ? '' : 'lacks or alters it');
  const html = read(P.page + '/index.html') || '';
  const sec = (html.match(SECTION_RE) || [''])[0];
  const pres = [...sec.matchAll(/<pre class="[^"]*\bagent-rules\b[^"]*">([\s\S]*?)<\/pre>/g)].map(m => unescape(m[1]));
  check('A7', `${P.page}/index.html card's pre.agent-rules is AI_RULES verbatim`, pres.length === 1 && pres[0] === AI_RULES,
    !sec ? 'no agent section' : pres.length !== 1 ? `${pres.length} pre.agent-rules` : pres[0] === AI_RULES ? '' : 'altered');
  const bad = [...forbiddenIn(txt || ''), ...forbiddenIn(unescape(sec))];
  check('A7', `${P.page} docs use no key s, open or embed`, bad.length === 0, bad.join(', '));
  const keptBad = keptFor(P).flatMap(k => pairsOf(k.link).filter(([key]) => FORBIDDEN.includes(key)).map(([key]) => `${k.name}: ${key}`));
  check('A7', `${P.page} kept links use no key s, open or embed`, keptBad.length === 0, list(keptBad));
}
check('A7', 'llms.txt section carries AI_RULES verbatim', !!llmsSec && llmsSec.includes(AI_RULES),
  !llmsSec ? 'no agent section' : llmsSec.includes(AI_RULES) ? '' : 'lacks or alters it');
check('A7', 'llms.txt section uses no key s, open or embed', forbiddenIn(llmsSec).length === 0, forbiddenIn(llmsSec).join(', '));

/* ── A6 bookkeeping: which pages solve ────────────────────────────────────── */
const solvedSeen = new Map();   // page -> number of model links that solved

try {
  for (const P of pages) {
    console.log(`\n── ${P.page} ──`);
    const live = await liveOf(P);
    const D = live.docs;
    const kept = keptFor(P);

    /* ── A1: every key the docs list is live ── */
    if (!D) check('A1', `${P.page} has agent.txt`, false, 'missing: run node _ref/agent-doc.mjs');
    else {
      check('A1', `${P.page} opens with no error`, live.errs.length === 0, list(live.errs, 2));
      const gone = D.fields.filter(f => !live.byKey[f.key]).map(f => f.key);
      check('A1', `${P.page} agent.txt: each of its ${D.fields.length} fields is a live saved control`, D.fields.length + live.lists.length > 0 && gone.length === 0, gone.length ? list(gone) : '');
      const badOpts = [];
      for (const f of D.fields.filter(f => f.options)) {
        const lf = live.byKey[f.key];
        if (!lf) continue;
        const vals = (lf.options || []).map(o => o.value).sort((a, b) => b.length - a.length);
        for (const tok of f.options) {
          const hit = tok.startsWith('(blank)') ? vals.includes('') : vals.some(v => v && (tok === v || tok.startsWith(v + ' ')));
          if (!hit) badOpts.push(`${f.key}: ${tok}`);
        }
      }
      const nOpts = D.fields.reduce((n, f) => n + (f.options ? f.options.length : 0), 0);
      check('A1', `${P.page} agent.txt: each of the ${nOpts} choices it prints is a live option`, badOpts.length === 0, list(badOpts));
      const impGone = D.important.filter(k => !live.byKey[k] && !live.lists.includes(k));
      check('A1', `${P.page} agent.txt: the most important keys are live`, impGone.length === 0, list(impGone));
      // List keys: the tool's adapter reads each one (a link naming it is not "not recognised").
      if (live.lists.length) {
        const V = await visit(P, '#load&v=1&' + live.lists.map(k => k + '=%7E').join('&'));
        const s = await snapshot(V.page);
        const unread = live.lists.filter(k => !s.report || s.report.unknown.includes(k));
        check('A1', `${P.page} agent.txt: its list keys (${live.lists.join(', ')}) are read by the tool`, !V.failed && unread.length === 0,
          V.failed || list(unread));
        await V.close();
      } else check('A1', `${P.page} agent.txt: list keys`, true, 'none');
      // A family of keys (el.<name>.<param>): the tool's adapter reads the prefix, so a key in it is never "not recognised".
      for (const pre of live.families) {
        const key = pre + 'zzNoSuch.zz';
        const V = await visit(P, '#load&v=1&' + encodeURIComponent(key).replace(/%2E/g, '.') + '=1');
        const s = await snapshot(V.page);
        check('A1', `${P.page} agent.txt: the tool reads the ${pre}* keys`, !V.failed && !!s.report && !s.report.unknown.includes(key) && s.report.errors.length > 0,
          V.failed || (!s.report ? 'no report' : s.report.unknown.includes(key) ? 'not recognised' : 'no error for a part that is not there'));
        await V.close();
      }
      const strayNotes = D.listNotes.filter(k => !live.byKey[k] && !live.lists.includes(k));
      check('A1', `${P.page} agent.txt: the keys its list notes explain are live`, strayNotes.length === 0, list(strayNotes));
      const qsGone = D.qs.filter(k => !live.qs.has(k));
      check('A1', `${P.page} agent.txt: each of its ${D.qs.length} Quick Starts is live`, qsGone.length === 0, list(qsGone));
      const figBad = D.figures.map(([k, v, where]) => {
        if (k === 'qs') return live.qs.has(v) ? '' : `qs=${v} (${where})`;
        const f = live.byKey[k];
        if (!f && live.lists.includes(k)) return '';   // a list key a Quick Start sets (the tool's adapter reads it)
        if (!f) return `${k} is not a field (${where})`;
        const why = refuses(f, v);
        return why ? `${k}=${v}: ${why}` : '';
      }).filter(Boolean);
      check('A1', `${P.page} agent.txt: each of its ${D.figures.length} Quick Start figures is a value its field takes`, figBad.length === 0, list(figBad));
      const linkBad = D.links.flatMap(l => linkProblems(pairsOf(l), live));
      check('A1', `${P.page} agent.txt: its ${D.links.length} example link(s) use live keys and values`, D.links.length > 0 && linkBad.length === 0,
        D.links.length ? list(linkBad) : 'no example link');
      if (!live.card) check('A1', `${P.page} has the folded AI card`, false, 'no #agentHelp');
      else {
        const cardGone = live.card.keys.filter(k => !live.byKey[k] && !live.lists.includes(k));
        check('A1', `${P.page} card: each of its ${live.card.keys.length} main keys is live`, cardGone.length === 0, list(cardGone));
        const cardLinks = live.card.pres.filter(t => /#load/.test(t) && !t.includes('<')).map(t => t.trim());
        const cardBad = cardLinks.flatMap(l => linkProblems(pairsOf(l), live));
        check('A1', `${P.page} card: its example link uses live keys and values`, cardLinks.length > 0 && cardBad.length === 0,
          cardLinks.length ? list(cardBad) : 'no example link');
        check('A7', `${P.page} card on the page shows AI_RULES verbatim`, live.card.rules === AI_RULES,
          live.card.rules === AI_RULES ? '' : live.card.rules == null ? 'no pre.agent-rules' : 'altered');
      }
      const listed = new RegExp('^- .*: ' + (SITE + P.url + 'agent.txt').replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '$', 'm');
      check('A1', `llms.txt lists ${P.url}agent.txt`, listed.test(llmsSec), '');
    }

    /* ── A2 (and H, A6): every kept link ── */
    if (!kept.length) check('A2', `${P.page} has kept links in _ref/agent-links.json`, false, 'none');
    for (const k of kept) {
      const tag = `${P.page} "${k.name}"`;
      const pairs = pairsOf(k.link);
      if (!/^#load(?:&|$)/.test(k.link)) { check('A2', `${tag} is a #load fragment`, false, k.link.slice(0, 40)); continue; }
      const V = await visit(P, k.link);
      const s = await snapshot(V.page);
      const rep = s.report || { applied: [], unknown: [], clamped: [], errors: ['no report'] };
      const errs = errorsOf(V);
      const opens = [V.failed, ...errs.map(e => 'error: ' + e),
        ...rep.unknown.map(u => 'not recognised: ' + u), ...rep.errors.map(e => 'not applied: ' + e),
        ...rep.clamped.map(c => `clamped: ${c.key} ${c.given} → ${c.used}`), s.banner ? '' : 'no banner'].filter(Boolean);
      check('A2', `${tag} opens clean`, opens.length === 0, list(opens, 4));
      check('H', `${tag} leaves the address`, s.hash === '' && s.flag === 'done', s.hash ? 'hash still ' + s.hash.slice(0, 30) : '');
      // Every key it names is a row, with its why; its note heads the banner.
      const named = pairs.filter(([key]) => !RESERVED.includes(key) && !key.startsWith('why.')).map(([key]) => key);
      const rows = [];
      for (const key of named) if (!s.rows.includes(key)) rows.push(`no row for ${key}`);
      for (const [key, v] of pairs.filter(([key]) => key.startsWith('why.'))) {
        const row = rep.applied.find(a => a.key === key.slice(4));
        const want = v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, WHY_MAX);
        if (!row || row.why !== want) rows.push(`${key} shows ${short(row ? row.why : null, 30)}`);
      }
      const note = pairs.find(([key]) => key === 'note');
      if (note && s.note !== note[1].replace(/\s+/g, ' ').trim().slice(0, WHY_MAX)) rows.push(`note shows ${short(s.note, 30)}`);
      // The fields it names hold what it expects.
      const values = await valuesOf(V.page);
      const off = Object.entries(k.expect || {}).filter(([key, want]) => !(key in values) || !sameValue(want, values[key]))
        .map(([key, want]) => key in values ? `${key} is ${short(values[key], 24)}, expected ${short(want, 24)}` : `${key} is not a field any more`);
      check('A2', `${tag} sets ${Object.keys(k.expect || {}).length} field(s) as expected, a row for each key`,
        !V.failed && off.length + rows.length === 0, list([...off, ...rows], 4));
      if (k.probe) {
        const got = await probeOf(V.page, P);
        const diff = partial(k.probe, got);
        check('A2', `${tag} probe matches`, diff.length === 0, list(diff, 4));
      }
      if (P.solved && k.model) {
        const ok = await V.page.waitForFunction(P.solved, null, { timeout: 120000 }).then(() => true, () => false);
        check('A6', `${tag} opens a whole model and solves`, ok && opens.length === 0, ok ? '' : 'not solved in 120 s');
        if (ok) solvedSeen.set(P.page, (solvedSeen.get(P.page) || 0) + 1);
      }
      await V.close();
    }
    if (P.solved) {
      const models = kept.filter(k => k.model && pairsOf(k.link).some(([key]) => key === 'json'));
      if (!models.length) check('A6', `${P.page} keeps a link with a whole model in json`, false, 'none marked "model": true');
    }

    /* ── A3: a bad link still opens the tool ── */
    const other = editable(live);
    // A typed amount with a range (a currency field) is a numeric field to try as well.
    const num = live.fields.find(f => f.type === 'v' && (f.input === 'range' || f.input === 'number' || f.numeric) && f.min != null && f.max != null &&
      (!other || f.key !== other.key));
    if (!other || !num) check('A3', `${P.page} has a numeric field to try`, false, 'none');
    else {
      const good = nudged(other, other.value);
      const cases = [
        { name: 'unknown keys (s and embed too)', frag: `#load&v=1&zzNoSuchKey=1&why.zzNoSuchKey=x&s=zz&embed=zz&${other.key}=${good}`,
          want: (s, r) => ['zzNoSuchKey', 's', 'embed'].filter(u => !r.unknown.includes(u)).map(u => u + ' not listed').concat(s.unknown ? [] : ['no "not recognised" line']) },
        { name: `a number out of range (${num.key})`, frag: `#load&v=1&${num.key}=${+num.max + Math.max(10, +num.max - +num.min)}&${other.key}=${good}`,
          want: (s, r, vals) => {
            const c = r.clamped.find(x => x.key === num.key);
            return [c && close(+c.used, +num.max) ? '' : 'not clamped to ' + num.max, sameValue(num.max, vals[num.key]) ? '' : `${num.key} is ${vals[num.key]}`,
              s.clamped ? '' : 'no "adjusted" line'].filter(Boolean);
          } },
        { name: 'a Quick Start that does not exist', frag: `#load&v=1&qs=zz-no-such-quick-start&${other.key}=${good}`,
          want: (s, r) => [r.qs && r.qs.ok === false ? '' : 'qs not refused', /zz-no-such-quick-start/.test(s.errors) ? '' : 'not in the banner'].filter(Boolean) },
        { name: 'malformed json', frag: `#load&v=1&json=%7B%22broken%22%3A%5B1%2C&${other.key}=${good}`,
          want: (s, r) => [r.errors.length ? '' : 'no error reported', s.errors ? '' : 'not in the banner'].filter(Boolean) },
        { name: 'a fragment of exactly 512 KB', size: AGENT_MAX, frag: `#load&v=1&${other.key}=${good}&zzPad=`,
          want: (s, r) => [r.unknown.includes('zzPad') ? '' : 'zzPad not listed', r.errors.length ? 'refused: ' + r.errors[0] : ''].filter(Boolean) },
        { name: 'a fragment over 512 KB', size: AGENT_MAX + 1, frag: `#load&v=1&${other.key}=${good}&zzPad=`, applies: false,
          want: (s, r) => [r.errors.length ? '' : 'no error reported', s.errors ? '' : 'not in the banner', r.applied.length ? 'applied ' + r.applied.length : ''].filter(Boolean) },
      ];
      for (const c of cases) {
        const frag = c.size ? c.frag + 'x'.repeat(c.size - c.frag.length) : c.frag;
        const V = await visit(P, frag);
        const s = await snapshot(V.page);
        const r = s.report || { applied: [], unknown: [], clamped: [], errors: [], qs: null };
        const vals = await valuesOf(V.page);
        const applied = c.applies === false ? sameValue(other.value, vals[other.key]) : sameValue(good, vals[other.key]);
        const bad = [V.failed, ...errorsOf(V).map(e => 'error: ' + e), s.banner ? '' : 'no banner', s.hash ? 'hash left' : '',
          applied ? '' : c.applies === false ? `${other.key} changed to ${vals[other.key]}` : `${other.key} is ${vals[other.key]}, not ${good}`,
          ...c.want(s, r, vals)].filter(Boolean);
        check('A3', `${P.page} ${c.name}: opens normally, said in the banner`, bad.length === 0, list(bad, 4));
        await V.close();
      }
    }

    /* ── A4: the reader's cache, kept and given back ── */
    const k1 = kept.find(k => k.probe) || kept[0], k2 = kept.find(k => k !== k1);
    if (!k1 || !k2 || !other) check('A4', `${P.page} has two kept links and a field to edit`, false, '');
    else {
      const named1 = pairsOf(k1.link).map(([key]) => key), named2 = pairsOf(k2.link).map(([key]) => key);
      const ed = editable(live, [...named1, ...named2]) || other;
      // The reader's work: an AI link, then an edit of their own, then a later visit.
      const V = await visit(P, k1.link);
      const before = await valuesOf(V.page);
      const mine = nudged(ed, before[ed.key]);
      await type(V.page, ed.key, mine);
      await V.page.waitForTimeout(900);
      await goTo(V, P, '');
      const s0 = await snapshot(V.page);
      const v0 = await valuesOf(V.page), p0 = await probeOf(V.page, P);
      const saves = Object.keys(s0.storage).filter(key => key.startsWith('abt:save:'));
      // An AI link over it.
      await goTo(V, P, k2.link);
      const s1 = await snapshot(V.page);
      const lost = saves.filter(key => s1.storage[key.replace(/^abt:save:/, 'abt:prev:')] !== s0.storage[key]);
      check('A4', `${P.page} the reader's cache is kept in abt:prev: as it was`, !V.failed && saves.length > 0 && lost.length === 0,
        V.failed || (!saves.length ? 'the reader had no abt:save: cache' : lost.length ? 'differs: ' + list(lost) : saves.join(', ')));
      check('A4', `${P.page} the banner offers Undo`, s1.undo, '');
      if (s1.undo) {
        await V.page.click('.agent-banner .agent-undo');
        await V.page.waitForTimeout(900);
        const v1 = await valuesOf(V.page), p1 = await probeOf(V.page, P);
        const s2 = await snapshot(V.page);
        const fieldDiff = Object.keys({ ...v0, ...v1 }).filter(key => JSON.stringify(v0[key]) !== JSON.stringify(v1[key]))
          .map(key => `${key}: ${short(v1[key], 20)}, was ${short(v0[key], 20)}`);
        const probeDiff = JSON.stringify(p0) === JSON.stringify(p1) ? [] : partial(p0, p1);
        check('A4', `${P.page} Undo restores every field and the state beyond them exactly`,
          fieldDiff.length + probeDiff.length === 0 && !s2.banner && v1[ed.key] === v0[ed.key],
          list([...fieldDiff, ...probeDiff, s2.banner ? 'the banner stayed' : ''].filter(Boolean), 4));
        const parse = t => { try { return JSON.parse(t); } catch (e) { return null; } };
        const cacheDiff = saves.filter(key => {
          const a = parse(s0.storage[key]), b = parse(s2.storage[key]);
          return !a || !b || JSON.stringify(a.__fields || a) !== JSON.stringify(b.__fields || b) || JSON.stringify(a.__extra) !== JSON.stringify(b.__extra);
        });
        check('A4', `${P.page} and the cache holds it again`, cacheDiff.length === 0, list(cacheDiff));
      }
      await V.close();
      // A first visit: nothing to go back to.
      const F = await visit(P, k1.link);
      const f1 = await snapshot(F.page);
      const prev = Object.keys(f1.storage).filter(key => key.startsWith('abt:prev:'));
      check('A4', `${P.page} with no earlier cache there is no Undo and no abt:prev:`, !F.failed && !f1.undo && prev.length === 0,
        F.failed || [f1.undo ? 'Undo shown' : '', ...prev].filter(Boolean).join(', '));
      await F.close();
    }

    /* ── H: a reload keeps the reader's edits ── */
    if (k1 && other) {
      const named = pairsOf(k1.link).map(([key]) => key);
      const ed = editable(live, named) || other;
      const V = await visit(P, k1.link);
      const mine = nudged(ed, (await valuesOf(V.page))[ed.key]);
      await type(V.page, ed.key, mine);
      await V.page.waitForTimeout(900);
      await V.page.reload({ waitUntil: 'load' });
      await V.page.waitForTimeout(600);
      const s = await snapshot(V.page);
      const vals = await valuesOf(V.page);
      const off = Object.entries(k1.expect || {}).filter(([key, want]) => !sameValue(want, vals[key])).map(([key]) => key);
      const bad = [V.failed, s.link ? 'read a link again' : '', s.banner ? 'banner again' : '',
        sameValue(mine, vals[ed.key]) ? '' : `${ed.key} is ${vals[ed.key]}, not ${mine}`, off.length ? 'lost ' + off.join(', ') : '',
        ...errorsOf(V)].filter(Boolean);
      check('H', `${P.page} a reload keeps the reader's edit (${ed.key}) and the link's values, with no banner`, bad.length === 0, list(bad, 4));
      await V.close();
    }

    /* ── N: no #load, no change ── */
    {
      const V = await visit(P, '');
      const s = await snapshot(V.page);
      const done = await V.page.evaluate(() => Promise.race([SharedAgent.done.then(() => 'done'), new Promise(r => setTimeout(() => r('pending'), 2000))]));
      const prev = Object.keys(s.storage).filter(key => key.startsWith('abt:prev:'));
      check('N', `${P.page} without #load: no banner, no report, done at once`,
        s.link === false && s.report === null && !s.banner && !s.flag && done === 'done' && prev.length === 0 && errorsOf(V).length === 0,
        [s.link !== false ? 'link read' : '', s.report !== null ? 'report ' + short(s.report) : '', s.banner ? 'banner' : '', s.flag ? 'flagged ' + s.flag : '',
          done !== 'done' ? 'done pending' : '', ...prev, ...errorsOf(V)].filter(Boolean).join(', '));
      if (other) {
        const mine = nudged(other, other.value);
        await type(V.page, other.key, mine);
        await V.page.waitForTimeout(900);
        await V.page.reload({ waitUntil: 'load' });
        await V.page.waitForTimeout(600);
        const vals = await valuesOf(V.page);
        const s2 = await snapshot(V.page);
        const prev2 = Object.keys(s2.storage).filter(key => key.startsWith('abt:prev:'));
        check('N', `${P.page} without #load the cache restores as before`, sameValue(mine, vals[other.key]) && !s2.banner && prev2.length === 0,
          [sameValue(mine, vals[other.key]) ? '' : `${other.key} is ${vals[other.key]}, not ${mine}`, s2.banner ? 'banner' : '', ...prev2].filter(Boolean).join(', '));
      }
      await V.close();
    }
  }

  /* ── A6: the Engineering pages ── */
  const eng = pages.filter(P => P.solved);
  if (!eng.length) check('A6', 'a whole custom model per Engineering page', true, 'no pages yet');
  for (const P of eng) check('A6', `${P.page} solved at least one kept model`, (solvedSeen.get(P.page) || 0) > 0, '');

  /* ── A1/A2: the files themselves ── */
  const orphans = KEPT.links.filter(k => !PAGES.some(P => P.url === k.page)).map(k => `${k.page} "${k.name}"`);
  check('A2', 'every kept link names a page in PAGES', orphans.length === 0, list(orphans));
  const listedUrls = [...llmsSec.matchAll(/^- .*: (\S+)agent\.txt$/gm)].map(m => m[1]);
  const strays = listedUrls.filter(u => !PAGES.some(P => SITE + P.url === u) || !existsSync(join(ROOT, u.slice(SITE.length), 'agent.txt')));
  check('A1', `llms.txt lists only pages with an agent.txt (${listedUrls.length})`, strays.length === 0, list(strays));
} finally {
  await browser.close();
  await srv.close();
}

console.log('\n── summary ──');
for (const id of IDS) {
  const t = tally[id];
  console.log(`  ${id.padEnd(3)} ${String(t.pass).padStart(3)} passed${t.fail ? `, ${t.fail} FAILED` : ''}`);
}
const pass = IDS.reduce((n, id) => n + tally[id].pass, 0), fail = IDS.reduce((n, id) => n + tally[id].fail, 0);
console.log(`\nagent check: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
