#!/usr/bin/env node
// Pinpoints where a country's tax rules live, so a rule that changed (a rate, a cap, a band, a
// new component) is edited in the exact places that hold it and nowhere else.
//
//   node global-income-tax-calculator/_jurisdictions/rules.mjs                the register: every country, its rule year and its lines
//   node global-income-tax-calculator/_jurisdictions/rules.mjs TW             one country: engine section, lines, knobs, sources, pages, audit
//   node global-income-tax-calculator/_jurisdictions/rules.mjs TW 219500 12.5%   and every place each figure is written
//
// A country is its code (TW) or its page slug (taiwan). A figure is written as the rule states
// it: an amount (219500 or 219,500), a rate as a percentage (12.5%) or a fraction (0.125). The
// search tries the forms each file uses: 219500 in the engine, 219,500 and 219.500 in the
// English and Indonesian pages, 0.125 and .125 and 12.5% and 12,5% for a rate.
// Read-only: it prints, it never edits.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { PAGES } from './scenarios.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TOOL = join(HERE, '..');
const ROOT = join(TOOL, '..');
const rel = f => relative(ROOT, f);
const E = createRequire(import.meta.url)(join(TOOL, 'engine.js'));
const ENGINE = readFileSync(join(TOOL, 'engine.js'), 'utf8').split('\n');

// ---- The engine's sections: a banner per country (/* ═══ BE income 2026 ═══ */), its
// constants and function below it, up to the next banner. The Gulf states share one section,
// split by `country === 'XX'` branches.
const banners = ENGINE.map((l, i) => /^\/\* ═+ (.+?) ═+ \*\/$/.test(l) ? { i, title: l.match(/^\/\* ═+ (.+?) ═+ \*\/$/)[1] } : null).filter(Boolean);
function fnName(cc){
  const line = ENGINE.find(l => new RegExp(`^  ${cc}: \\{`).test(l));
  const m = line && line.match(/fn: (\w+)(\('(\w+)'\))?/);
  return m ? { fn: m[1], arg: m[3] || null } : null;
}
function section(cc){
  const f = fnName(cc);
  if(!f) return null;
  const start = ENGINE.findIndex(l => new RegExp(`^function ${f.fn}\\(`).test(l));
  const b = banners.filter(x => x.i <= start).pop();
  const next = banners.find(x => x.i > start);
  let lo = b ? b.i : start, hi = next ? next.i - 1 : ENGINE.length - 1;
  let branch = null;
  if(f.arg){   // one Gulf state: its own branch, plus the lines every Gulf state shares
    const s = ENGINE.findIndex((l, i) => i > start && i <= hi && l.includes(`country === '${f.arg}'`));
    let e = ENGINE.findIndex((l, i) => i > s && i <= hi && /\} else if\(country ===|return finish/.test(l));
    branch = [s, e - 1];
  }
  return { ...f, lo, hi, start, title: b ? b.title : '', branch };
}

// ---- The breakdown lines a section writes: L('id', 'label', amount, kind, src, status, from).
const LINE = /L\('(\w+)',\s*(.+?),\s*(?:.+?),\s*'(\w+)',\s*'(\w+)'(?:,\s*'(\w+)'(?:,\s*([^)]+?))?)?\)/;
function lines(sec){
  const out = [];
  const inRange = i => sec.branch ? (i >= sec.branch[0] && i <= sec.branch[1]) || (i >= sec.start && i < sec.branch[0] && /gulfTax/.test(ENGINE[i])) : i >= sec.lo && i <= sec.hi;
  ENGINE.forEach((l, i) => {
    if(!inRange(i)) return;
    // L('id', label, amount, kind, src, status, from), and the Gulf helper add('id', label, amount, src, status, from), a social line.
    const re = /\b(L|add)\('(\w+)',/g; let m;
    while((m = re.exec(l))){
      const parts = splitArgs(l.slice(m.index + m[1].length + 1));
      const q = x => (x || '').replace(/'/g, '');
      if(m[1] === 'L'){ if(parts.length < 5) continue; out.push({ line: i + 1, id: q(parts[0]), label: parts[1], kind: q(parts[3]), src: q(parts[4]), status: q(parts[5]), from: (parts[6] || '').trim() }); }
      else { if(parts.length < 4) continue; out.push({ line: i + 1, id: q(parts[0]), label: parts[1], kind: 'social', src: q(parts[3]), status: q(parts[4]) || 'secondary', from: (parts[5] || '').trim() }); }
    }
  });
  return out;
}
// Split a call's arguments at top-level commas.
function splitArgs(s){
  const out = []; let depth = 0, cur = '', q = null;
  for(const ch of s){
    if(q){ cur += ch; if(ch === q) q = null; continue; }
    if(ch === "'" || ch === '"' || ch === '`'){ q = ch; cur += ch; continue; }
    if('([{'.includes(ch)) depth++;
    if(')]}'.includes(ch)){ if(depth === 0){ out.push(cur.trim()); return out; } depth--; }
    if(ch === ',' && depth === 0){ out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur.trim()); return out;
}
const knobsOf = sec => [...new Set(ENGINE.slice(sec.lo, sec.hi + 1).join('\n').match(/\bk\.(\w+)/g) || [])].map(x => x.slice(2));
const constsOf = sec => ENGINE.slice(sec.lo, sec.start).map((l, j) => ({ line: sec.lo + j + 1, text: l })).filter(x => /^const \w+ = /.test(x.text));

// ---- Figures in every form a file writes them.
function forms(arg){
  const pct = /%$/.test(arg);
  const raw = arg.replace(/%$/, '').replace(/,/g, '');
  const v = +raw;
  if(!isFinite(v)) return { engine: [esc(arg)], text: [esc(arg)] };
  const frac = pct ? v/100 : (v < 1 && v > 0 ? v : null);
  const engine = [], text = [];
  if(frac != null){
    const f = String(+frac.toFixed(10));                      // 0.125
    engine.push(f.replace(/^0\./, '0?\\.'));                   // 0.125 or .125
    const p = String(+(frac*100).toFixed(8));                  // 12.5
    text.push(esc(p) + '\\s?%', esc(p.replace('.', ',')) + '\\s?%');
    engine.push(esc(p) + '\\s?%');                             // a label such as 'GPSSA pension (11%, ...)'
  } else {
    const int = Math.round(v), s = String(int);
    engine.push(s, group(s, ','), group(s, '_'));
    text.push(s, group(s, ','), group(s, '.'), group(s, ' '));
  }
  return { engine: [...new Set(engine)], text: [...new Set(text)] };
}
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const group = (s, sep) => s.replace(/\B(?=(\d{3})+(?!\d))/g, sep === '.' ? '.' : sep).replace(/\./g, sep === '.' ? '\\.' : '.');
const numRe = alts => new RegExp(`(?<![\\d.,])(?:${alts.join('|')})(?![\\d]|[.,]\\d)`);

function grepFile(file, re, from = 0, to = Infinity){
  if(!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').map((l, i) => ({ n: i + 1, l })).filter(x => x.n - 1 >= from && x.n - 1 <= to && re.test(x.l));
}
// JSON content: report the path to each string that holds the figure.
function grepJson(file, re){
  if(!existsSync(file)) return [];
  const out = [];
  const walk = (v, path) => {
    if(typeof v === 'string'){ if(re.test(v)) out.push({ path, text: v.replace(/<[^>]+>/g, '') }); return; }
    if(Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if(v && typeof v === 'object') for(const [k, x] of Object.entries(v)) if(k !== 'url') walk(x, path ? `${path}.${k}` : k);
  };
  walk(JSON.parse(readFileSync(file, 'utf8')), '');
  return out;
}
const around = (text, re) => { const m = text.match(re); if(!m) return text.slice(0, 120); const i = m.index; return (i > 60 ? '…' : '') + text.slice(Math.max(0, i - 60), i + 80).trim() + '…'; };

// ---- Run
const args = process.argv.slice(2);
const pick = args[0];
if(!pick){
  // The register: one block per country.
  for(const cc of Object.keys(E.C)){
    const sec = section(cc), c = E.C[cc];
    console.log(`\n${cc}  ${c.name}, ${c.year}${c.place ? ', ' + c.place : ''}  engine.js:${sec.lo + 1}-${sec.hi + 1}`);
    for(const x of lines(sec)) console.log(`  ${x.id.padEnd(10)} ${x.kind.padEnd(9)} ${x.status.padEnd(10)} ${x.src.padEnd(8)} ${x.label}${x.from ? '  from ' + x.from : ''}`);
  }
  process.exit(0);
}
const page = PAGES.find(p => p.cc === pick.toUpperCase() || p.slug === pick);
const cc = page ? page.cc : pick.toUpperCase();
const sec = section(cc);
if(!sec){ console.error(`No country "${pick}". Codes: ${Object.keys(E.C).join(' ')}`); process.exit(1); }
const c = E.C[cc];
const content = page ? ['en', 'id'].map(l => join(HERE, 'content', `${page.slug}.${l}.json`)) : [];
const AUDIT = ['run.mjs', 'page.mjs', 'README.md'].map(f => join(TOOL, '_audit', f));

console.log(`${cc}  ${c.name}  rules: ${c.year}${c.place ? ', ' + c.place : ''}`);
console.log(`\nENGINE  ${rel(join(TOOL, 'engine.js'))}:${sec.lo + 1}-${sec.hi + 1}  (${sec.title}; function ${sec.fn}${sec.arg ? `('${sec.arg}'), branch at ${sec.branch[0] + 1}-${sec.branch[1] + 1}` : ''})`);
const consts = constsOf(sec);
if(consts.length){ console.log('  constants:'); consts.forEach(x => console.log(`    :${x.line}  ${x.text.slice(0, 150)}`)); }
console.log('  lines (id, kind, status, source, label, effective from):');
const ls = lines(sec);
ls.forEach(x => console.log(`    :${x.line}  ${x.id}  ${x.kind}  ${x.status}  ${x.src}  ${x.label}${x.from ? '  from ' + x.from : ''}`));
const srcs = [...new Set(ls.map(x => x.src))];
console.log('  sources (SRC in engine.js, shown on the badges):');
srcs.flatMap(k => /^\w+$/.test(k) ? [k] : (k.match(/\b[a-z]\w*\b/g) || []).filter(x => E.SRC[x])).filter((k, i, a) => a.indexOf(k) === i).forEach(k => { const s = E.SRC[k]; const n = ENGINE.findIndex(l => new RegExp(`^  ${k}:\\s+\\{`).test(l)); console.log(`    :${n + 1}  ${k}  ${s ? s.name + '  ' + s.url : '(missing)'}`); });
const knobs = knobsOf(sec);
console.log(`  knobs read (page fields, saved state, Share and AI links: never rename): ${knobs.join(', ') || 'none'}`);
const html = readFileSync(join(TOOL, 'index.html'), 'utf8').split('\n');
knobs.forEach(k => { const n = html.findIndex(l => l.includes(`id="${k}"`)); if(n >= 0) console.log(`    index.html:${n + 1}  ${k}`); });

if(page){
  console.log(`\nPAGES  ${page.slug}/ and ${page.slug}/id/ (written by node _ref/jurisdiction-pages.mjs)`);
  content.forEach(f => console.log(`  ${rel(f)}`));
  console.log(`  worked examples (${rel(join(HERE, 'scenarios.mjs'))}): ${page.ex.map(e => `${e.key} ${e.amount} ${JSON.stringify(e.inputs)}`).join(' | ')}`);
}
const gold = JSON.parse(readFileSync(join(TOOL, '_audit', 'golden-v11.json'), 'utf8'));
const groups = [...new Set(Object.keys(gold).map(k => k.split('|')[0]))].filter(g => g.split(/[ (-]/)[0] === cc || (cc === 'GB' && g.startsWith('UK')) || (sec.arg && g === 'Gulf'));
console.log(`\nAUDIT  golden groups: ${groups.join(', ') || 'none'} (${Object.keys(gold).filter(k => groups.includes(k.split('|')[0])).length} cases)`);
for(const f of AUDIT){
  const hits = grepFile(f, new RegExp(`'${cc}\\b|'${cc}\\||\\b${cc}\\|`));
  hits.slice(0, 12).forEach(h => console.log(`  ${rel(f)}:${h.n}  ${h.l.trim().slice(0, 140)}`));
}

for(const fig of args.slice(1)){
  const f = forms(fig);
  const er = numRe(f.engine), tr = numRe(f.text);
  console.log(`\nFIGURE ${fig}  (engine forms /${er.source}/, page forms /${tr.source}/)`);
  const eng = grepFile(join(TOOL, 'engine.js'), er, sec.lo, sec.hi);
  const srcHits = grepFile(join(TOOL, 'engine.js'), tr, 0, banners[0].i);
  [...eng, ...srcHits].forEach(h => console.log(`  engine.js:${h.n}  ${h.l.trim().slice(0, 160)}`));
  for(const file of content) grepJson(file, tr).forEach(h => console.log(`  ${rel(file)}  ${h.path}  ${around(h.text, tr)}`));
  for(const file of [join(TOOL, 'index.html'), join(TOOL, 'agent-notes.md'), join(HERE, 'scenarios.mjs'), ...AUDIT])
    grepFile(file, file.endsWith('.mjs') ? er : tr).filter(h => file.endsWith('index.html') ? new RegExp(`data-show="[^"]*\\b${cc}\\b`).test(html.slice(Math.max(0, h.n - 6), h.n).join(' ')) : true)
      .forEach(h => console.log(`  ${rel(file)}:${h.n}  ${h.l.trim().slice(0, 160)}`));
}
