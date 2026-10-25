// Tests for the Quick Start templates (DESIGN 8.1): builder/templates/<id>.json and index.json.
//
// Run from the repo root (D:\Repository\tool):
//   node powerfactory-scripter/builder/_audit/templates/run.mjs                 everything
//   node powerfactory-scripter/builder/_audit/templates/run.mjs --no-live       without PowerFactory
//   node powerfactory-scripter/builder/_audit/templates/run.mjs --live=frt,cct  only these live runs
//   options: --no-page (skip the browser part), --no-tree (skip the sandbox tree check)
// Needs Python 3.12 as "python" (py_compile; the live runs also need PowerFactory 2024 and the
// two "(Builder test)" sandboxes) and Playwright for Node at D:\opt\node22 for the page part.
// Prints "template tests: N passed, M failed", exit 1 on a failure.
//
// (1) offline: index.json lists the frozen ids; every file loads through loadWorkflow with no
//     note, is in the saved format, generates with exactly the expected to-dos (each to-do field
//     pinned, a Note at the top, no em-dash in any word a reader sees), and its code compiles;
//     filled with sandbox values it generates with no problem at all and compiles.
// (2) live: each filled template is generated into live/, run on its sandbox through pfrun.py
//     with live_wrap.py around it (the sandbox audited before and after; the study cases the
//     headroom template keeps are listed and deleted there), and its run folder checked: the
//     CSV rows, columns and values, the PNGs, run.log ending with the summary, exit code 0.
// (3) page: the Builder page with the real blocks; every Quick Start button loads its template
//     with no console error, no overlapping blocks, the expected to-dos and Python code.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILDER = path.resolve(HERE, '..', '..');
const ROOT = path.resolve(BUILDER, '..', '..');
const imp = (rel) => import(pathToFileURL(path.join(BUILDER, rel)).href);
await imp('js/blocks/index.js');
const { loadWorkflow, serialize } = await imp('js/core/workflow.js');
const { generate } = await imp('js/core/codegen.js');
const { RUNTIME_FILES } = await imp('js/core/runtime-loader.js');
const { built } = await imp('_audit/templates/build.mjs');

const ARGS = process.argv.slice(2);
const NO_LIVE = ARGS.includes('--no-live') || !process.env.PFB_PFRUN;
if (!process.env.PFB_PFRUN && !ARGS.includes('--no-live')) console.log('PFB_PFRUN is not set: the live PowerFactory part is skipped.');
const NO_PAGE = ARGS.includes('--no-page');
const NO_TREE = ARGS.includes('--no-tree');
const LIVE_ONLY = (ARGS.find(a => a.startsWith('--live=')) || '').slice(7).split(',').filter(Boolean);
// The lock runner for live PowerFactory runs (one engine at a time) is a local file, not in the
// repo: point PFB_PFRUN at it. Without it the live part is skipped.
const PFRUN = process.env.PFB_PFRUN || '';
const PF_AUDIT = path.join(BUILDER, '_audit', 'blocks', 'pf');

const RUNTIME = {};
for (const f of RUNTIME_FILES) RUNTIME[f] = fs.readFileSync(path.join(BUILDER, 'runtime', f), 'utf8');

const GEN_DIR = path.join(HERE, 'generated');
const LIVE_DIR = path.join(HERE, 'live');
const LIVE_OUT = path.join(LIVE_DIR, 'out');
const LOG_DIR = path.join(HERE, 'logs');
fs.rmSync(GEN_DIR, { recursive: true, force: true });
for (const d of [GEN_DIR, LIVE_DIR, LIVE_OUT, LOG_DIR]) fs.mkdirSync(d, { recursive: true });

// ---------------------------------------------------------------------------------------------
// Harness

const results = [];
class Fail extends Error {}
const ok = (cond, msg) => { if (!cond) throw new Fail(msg || 'expected true'); };
const has = (text, part, msg) => { if (!String(text).includes(part)) throw new Fail((msg ? msg + ': ' : '') + `missing: ${part}`); };
const near = (a, b, tol, msg) => { if (!(Math.abs(Number(a) - Number(b)) <= tol)) throw new Fail(`${msg || 'value'}: got ${a}, expected ${b} +- ${tol}`); };
const between = (a, lo, hi, msg) => { if (!(Number(a) >= lo && Number(a) <= hi)) throw new Fail(`${msg || 'value'}: got ${a}, expected ${lo} to ${hi}`); };
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); } catch (e) { results.push({ name, ok: false, msg: e instanceof Fail ? e.message : (e && e.stack) || String(e) }); }
}
const ptext = (r) => r.problems.map(p => `[${p.level}] ${p.msg}`).join('\n');
const clone = (o) => JSON.parse(JSON.stringify(o));

function compileAll(files, label) {
  if (!files.length) return;
  const listFile = path.join(GEN_DIR, `_compile_${label}.txt`);
  fs.writeFileSync(listFile, files.map(x => x.file).join('\n'));
  const py = 'import py_compile,sys,json\nbad={}\nfor f in open(sys.argv[1],encoding="utf-8").read().split("\\n"):\n    try:\n        py_compile.compile(f, doraise=True, cfile=f+"c")\n    except Exception as e:\n        bad[f]=str(e)[:400]\nprint(json.dumps(bad))\n';
  const r = spawnSync('python', ['-c', py, listFile], { encoding: 'utf8', maxBuffer: 64 << 20 });
  let bad = {};
  try { bad = JSON.parse(r.stdout.trim().split('\n').pop()); } catch (e) { bad = { '(python)': (r.stderr || r.stdout || String(r.error)).slice(0, 400) }; }
  for (const x of files) {
    results.push({ name: `${x.test}: the code compiles`, ok: !bad[x.file], msg: bad[x.file] });
    try { fs.rmSync(x.file + 'c', { force: true }); } catch (e) { /* ignore */ }
  }
}

// A small CSV reader (the runtime writes UTF-8 with a BOM, quotes where needed).
function readCsv(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^\ufeff/, '');
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter(r => r.length > 1 || r[0] !== '');
  return { head, rows: body.map(r => Object.fromEntries(head.map((h, k) => [h, r[k] === undefined ? '' : r[k]]))) };
}

// ---------------------------------------------------------------------------------------------
// What each template must be

const N9 = 'Nine-bus System (Builder test)';
const N39 = '39 Bus New England System (Builder test)';
const EL = (cls, name, match = 'one') => ({ cls, name, match });
const OUT = LIVE_OUT.replace(/\\/g, '/');

const IDS = ['headroom', 'ldf-cases', 'n-1', 'shc-buses', 'find-limit', 'frt', 'cct', 'hosting-capacity', 'pv-curve', 'rms-batch'];
const TITLES = {
  headroom: 'Headroom study', 'ldf-cases': 'Load flow on every study case', 'n-1': 'N-1 screening', 'shc-buses': 'Short circuit at every busbar',
  'find-limit': 'Largest dispatch with a safe nadir', frt: 'Fault ride-through check', cct: 'Critical clearing time',
  'hosting-capacity': 'Hosting capacity at every busbar', 'pv-curve': 'PV curve by load scaling', 'rms-batch': 'RMS runs for several fault durations',
};
// The to-dos a reader sees after loading (exact messages) and the settings pinned for them.
const PROJECT_TODO = 'Fill in Project on Start.';
const EXPECT = {
  headroom: {
    todo: [PROJECT_TODO, 'Choose the element for Generator on Generator A.', 'Choose the element for Generator on Contingency unit.', 'Fill in the element of Record curve 1 on Run RMS simulation.'],
    pins: { n3: ['from', 'to', 'step'], n5: ['gen'], n7: ['el'] },
    types: ['flow.range', 'pf.case.create', 'pf.dispatch', 'pf.scen.save', 'pf.ldf', 'pf.evt.trip', 'pf.rms', 'sig.settle', 'flow.if', 'sig.nadir', 'out.table.add', 'out.plot.series', 'out.plot.table'],
  },
  'ldf-cases': { todo: [PROJECT_TODO], pins: { n3: ['pattern'] }, types: ['pf.case.foreach', 'pf.ldf', 'pf.get', 'out.table.add'] },
  'n-1': { todo: [PROJECT_TODO], pins: {}, types: ['pf.ldf', 'pf.cont.foreach', 'pf.get', 'out.table.add', 'out.table.column', 'flow.log'] },
  'shc-buses': { todo: [PROJECT_TODO], pins: { n3: ['el'] }, types: ['pf.foreach_element', 'pf.shc', 'pf.get', 'out.table.add', 'out.plot.xy', 'out.table.column'] },
  'find-limit': {
    todo: [PROJECT_TODO, 'Choose the element for Generator on Generator A.', 'Choose the element for Generator on Contingency unit.', 'Fill in the element of Record curve 1 on Run RMS simulation.'],
    pins: { n3: ['lower', 'upper', 'tol'], n4: ['gen'], n6: ['el'], n8: ['uflsBelow'] },
    types: ['opt.limit', 'pf.dispatch', 'pf.ldf', 'pf.evt.trip', 'pf.rms', 'sig.nadir', 'flow.log', 'out.plot.conv'],
  },
  frt: {
    todo: [PROJECT_TODO, 'Choose the element for Fault at on Connection point fault.', 'Fill in the element of Record curve 1 on Run RMS simulation.', 'Fill in the element of Record curve 2 on Run RMS simulation.'],
    pins: { n3: ['target'], n9: ['limit'] },
    types: ['pf.evt.shc', 'pf.rms', 'chk.limit', 'sig.cross', 'chk.verdict', 'out.table.add', 'out.plot.series'],
  },
  cct: {
    todo: [PROJECT_TODO, 'Choose the element for Fault at on Fault.'],
    pins: { n3: ['lower', 'upper', 'tol'], n4: ['target'], n6: ['hi'] },
    types: ['opt.limit', 'pf.evt.shc', 'pf.rms', 'chk.limit', 'opt.report', 'flow.log', 'out.plot.conv'],
  },
  'hosting-capacity': {
    todo: [PROJECT_TODO],
    pins: { n3: ['el'], n4: ['lower', 'upper', 'tol'], n10: ['hi'], n12: ['lo', 'hi'] },
    types: ['pf.get', 'math.sum', 'pf.foreach_element', 'opt.limit', 'pf.testgen', 'math.formula', 'pf.scale', 'pf.ldf', 'chk.limit', 'math.logic', 'out.table.add', 'out.plot.table'],
  },
  'pv-curve': { todo: [PROJECT_TODO], pins: { n3: ['from', 'to', 'step'] }, types: ['flow.range', 'pf.scale', 'pf.ldf', 'flow.break', 'pf.get', 'out.table.add', 'out.plot.table'] },
  'rms-batch': {
    todo: [PROJECT_TODO, 'Choose the element for Fault at on Fault.'],
    pins: { n3: ['values'], n4: ['target'], n7: ['hi'] },
    types: ['flow.list', 'pf.evt.shc', 'pf.rms', 'sig.peak', 'chk.limit', 'out.table.add', 'out.plot.series'],
  },
};

// The sandbox values that fill each template's to-dos (and a test range that runs in minutes).
const node = (wf, id) => { const n = wf.nodes.find(x => x.id === id); if (!n) throw new Error('no node ' + id); return n; };
const setS = (wf, id, patch) => { const n = node(wf, id); n.s = { ...n.s, ...patch }; };
const setRecord = (wf, id, rowId, el) => { const n = node(wf, id); n.s.record = n.s.record.map(r => (r.id === rowId ? { ...r, el } : r)); };
const start = (wf, project, studyCase = '') => setS(wf, 'n1', { project, studyCase, outputDir: OUT });
const FILL = {
  headroom(wf) {
    start(wf, N39, '2.1 Simulation Fault Bus 16 Stable');
    setS(wf, 'n3', { from: 150, to: 350, step: 100 });
    setS(wf, 'n5', { gen: EL('ElmSym', 'G 10') });
    setS(wf, 'n7', { el: EL('ElmSym', 'G 10') });
    setRecord(wf, 'n8', 'r1', EL('ElmTerm', 'Bus 16'));
  },
  'ldf-cases'(wf) { start(wf, N9); },
  'n-1'(wf) { start(wf, N39, '1. Power Flow'); },
  'shc-buses'(wf) { start(wf, N9, '01- Load Flow'); },
  'find-limit'(wf) {
    start(wf, N39, '2.1 Simulation Fault Bus 16 Stable');
    setS(wf, 'n4', { gen: EL('ElmSym', 'G 10') });
    setS(wf, 'n6', { el: EL('ElmSym', 'G 10') });
    setRecord(wf, 'n7', 'r1', EL('ElmTerm', 'Bus 16'));
  },
  frt(wf) {
    start(wf, N9, '03- Three Cycles Standard SG Model');
    setS(wf, 'n3', { target: EL('ElmTerm', 'Bus 7') });
    setRecord(wf, 'n4', 'r1', EL('ElmTerm', 'Bus 7'));
    setRecord(wf, 'n4', 'r2', EL('ElmSym', 'G2'));
  },
  cct(wf) {
    start(wf, N39, '2.3 Simulation Fault Bus 31 Stable');
    setS(wf, 'n4', { target: EL('ElmTerm', 'Bus 31') });
  },
  // The busbars of 100 kV and above, as the page's own script (_pages/scripts/hosting_capacity.py).
  'hosting-capacity'(wf) {
    start(wf, N39, '1. Power Flow');
    setS(wf, 'n3', { attr: 'uknom', op: '>=', value: '100' });
    setS(wf, 'n4', { lower: 0, upper: 2000, tol: 5 });
  },
  'pv-curve'(wf) { start(wf, N9, '01- Load Flow'); },
  'rms-batch'(wf) {
    start(wf, N39, '2.3 Simulation Fault Bus 31 Stable');
    setS(wf, 'n4', { target: EL('ElmTerm', 'Bus 31') });
  },
};

// ---------------------------------------------------------------------------------------------
// (1) Offline

const TEMPLATE_DIR = path.join(BUILDER, 'templates');
const index = JSON.parse(fs.readFileSync(path.join(TEMPLATE_DIR, 'index.json'), 'utf8'));
const files = {};
await test('index.json lists the ten frozen ids in order, each with its title, a file and a short description', () => {
  ok(Array.isArray(index.templates), 'templates list');
  ok(JSON.stringify(index.templates.map(t => t.id)) === JSON.stringify(IDS), JSON.stringify(index.templates.map(t => t.id)));
  for (const t of index.templates) {
    ok(t.title === TITLES[t.id], `${t.id}: title ${t.title}`);
    ok(t.file === `${t.id}.json` && fs.existsSync(path.join(TEMPLATE_DIR, t.file)), `${t.id}: file ${t.file}`);
    ok(typeof t.desc === 'string' && t.desc.length > 20 && t.desc.length <= 150, `${t.id}: desc is ${t.desc && t.desc.length} characters`);
    ok(!/[\u2014\u2013]/.test(t.title + t.desc), `${t.id}: a dash in the title or description`);
    ok(/^[a-z0-9][a-z0-9-]{0,40}$/.test(t.id), `${t.id}: id the page accepts`);
    files[t.id] = fs.readFileSync(path.join(TEMPLATE_DIR, t.file), 'utf8');
  }
});
await test('the template files are what build.mjs makes (run it after editing a template)', () => {
  const b = built();
  for (const t of b) {
    ok(files[t.id] === JSON.stringify(t.json, null, 2) + '\n', `${t.id}.json differs from build.mjs: run node powerfactory-scripter/builder/_audit/templates/build.mjs`);
    const e = index.templates.find(x => x.id === t.id);
    ok(e && e.title === t.title && e.desc === t.desc, `${t.id}: index entry differs from build.mjs`);
  }
});

const toCompile = [];
const LOADED = {};
// Every string a reader sees in a template: its name, labels, the note, text settings.
function visibleStrings(wf) {
  const out = [wf.name];
  const walk = (v) => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  for (const n of wf.nodes) { out.push(n.label); walk(n.s); }
  return out;
}

for (const id of IDS) {
  const text = files[id];
  if (!text) continue;
  const E = EXPECT[id];
  await test(`${id}: loads through loadWorkflow with no note, in the saved format`, () => {
    const obj = JSON.parse(text);
    ok(obj.app === 'pf-builder' && obj.v === 1 && obj.name === TITLES[id], `app ${obj.app} v ${obj.v} name ${obj.name}`);
    const { wf, notes } = loadWorkflow(text);
    ok(wf, 'not loaded: ' + notes.map(n => n.msg).join(' | '));
    ok(!notes.length, notes.map(n => `${n.level}: ${n.msg}`).join(' | '));
    ok(JSON.stringify(serialize(wf)) === JSON.stringify(obj), 'saving it back changes it');
    LOADED[id] = wf;
  });
  const wf = LOADED[id];
  if (!wf) continue;
  await test(`${id}: uses the blocks it is described with, a Note at the top and tidy positions`, () => {
    const types = new Set(wf.nodes.map(n => n.type));
    for (const t of E.types) ok(types.has(t), `no ${t} block`);
    ok(wf.nodes.filter(n => n.type === 'start').length === 1, 'one Start');
    const notes = wf.nodes.filter(n => n.type === 'note');
    ok(notes.length === 1, 'one Note');
    const note = notes[0];
    ok(wf.nodes.every(n => n === note || n.y > note.y), 'the Note is above every block');
    const sentences = String(note.s.text).split(/(?<=[.!?])\s+/).filter(Boolean);
    ok(sentences.length >= 2 && sentences.length <= 3, `the Note has ${sentences.length} sentences`);
    ok(/Fill in/.test(note.s.text), 'the Note says what to fill in');
    const pos = new Set(wf.nodes.map(n => `${n.x},${n.y}`));
    ok(pos.size === wf.nodes.length, 'two blocks at the same place');
    for (const a of wf.nodes) for (const b of wf.nodes) {
      if (a === b || a.type === 'note' || b.type === 'note') continue;
      if (Math.abs(a.y - b.y) < 150) ok(Math.abs(a.x - b.x) >= 300, `${a.id} and ${b.id} are closer than one column`);
    }
    // The flow goes left to right: every flow wire on one row points right.
    for (const e of wf.edges.filter(e => e.in === 'in')) {
      const a = node(wf, e.from), b = node(wf, e.to);
      if (Math.abs(a.y - b.y) < 150) ok(b.x > a.x, `flow wire ${e.from} > ${e.to} points left`);
    }
  });
  await test(`${id}: no em-dash or en-dash in any word a reader sees`, () => {
    const bad = visibleStrings(wf).filter(s => /[\u2014\u2013]/.test(s));
    ok(!bad.length, bad.join(' | '));
  });
  await test(`${id}: generates with exactly its to-dos, each to-do field pinned`, () => {
    const r = generate(wf, { runtime: RUNTIME });
    const file = path.join(GEN_DIR, `${id}.py`);
    fs.writeFileSync(file, r.code);
    toCompile.push({ file, test: `${id} as loaded` });
    const got = r.problems.map(p => (p.level === 'todo' ? p.msg : `[${p.level}] ${p.msg}`));
    ok(JSON.stringify([...got].sort()) === JSON.stringify([...E.todo].sort()), 'problems:\n' + ptext(r));
    for (const [nid, keys] of Object.entries(E.pins)) {
      const n = node(wf, nid);
      ok(JSON.stringify([...n.pin].sort()) === JSON.stringify([...keys].sort()), `${nid} pins ${JSON.stringify(n.pin)}`);
    }
    ok(wf.nodes.filter(n => !E.pins[n.id]).every(n => !n.pin.length), 'a block pins a setting the test does not expect');
    // Every element to-do is a pinned element setting, so it has a SETTINGS line marked REQUIRED.
    for (const [nid, keys] of Object.entries(E.pins)) {
      const n = node(wf, nid);
      for (const k of keys) {
        const v = n.s[k];
        if (v && typeof v === 'object' && !String(v.name || '').trim()) {
          const name = Object.entries(r.settingsMap).find(([, ref]) => ref[0] === nid && ref[1] === k);
          ok(name, `${nid}.${k} has no SETTINGS line`);
          ok(new RegExp(`# REQUIRED\\. [^\\n]*\\n(#[^\\n]*\\n)*${name[0]} = ""`).test(r.code), `${name[0]} is not marked REQUIRED`);
        }
      }
    }
    has(r.code, 'def main():');
    has(r.code, '\n# PFB1 ');
  });
  await test(`${id}: filled with sandbox values it generates with no problem at all`, () => {
    const f = clone(wf);
    FILL[id](f);
    const r = generate(f, { runtime: RUNTIME });
    const file = path.join(GEN_DIR, `${id}_filled.py`);
    fs.writeFileSync(file, r.code);
    toCompile.push({ file, test: `${id} filled` });
    ok(!r.problems.length, ptext(r));
    ok(!/^PROBLEMS = \[/m.test(r.code), 'the script still lists problems');
  });
}
compileAll(toCompile, 'offline');

// ---------------------------------------------------------------------------------------------
// (2) Live

function pfrun(args, timeoutMs) {
  const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PFRUN_TIMEOUT: String(Math.round(timeoutMs / 1000) - 60) };
  const r = spawnSync('python', [PFRUN, ...args], { cwd: LIVE_DIR, encoding: 'utf8', timeout: timeoutMs + 2700 * 1000, maxBuffer: 256 << 20, env });
  return { code: r.status, text: (r.stdout || '') + (r.stderr ? '\n[stderr]\n' + r.stderr : '') + (r.error ? '\n[error] ' + r.error : '') };
}
const num = (v) => (v === '' || v === undefined || v === null ? NaN : Number(v));

const LIVE = {
  'ldf-cases': {
    project: N9, timeout: 600,
    check(o) {
      const t = o.csv('Load flow');
      ok(JSON.stringify(t.head) === JSON.stringify(['Study case', 'Status', 'Lowest voltage (p.u.)', 'Lowest at', 'Highest voltage (p.u.)', 'Highest at']), JSON.stringify(t.head));
      ok(t.rows.length === 8, `8 study cases, got ${t.rows.length}`);
      const bad = t.rows.filter(r => r.Status !== 'OK');
      ok(bad.length === 1 && bad[0]['Study case'] === '07- Comparison Excitation Models' && /Load flow did not converge/.test(bad[0].Status), 'the case with no grid keeps its row with the reason: ' + JSON.stringify(bad));
      for (const r of t.rows.filter(r => r.Status === 'OK')) {
        between(r['Lowest voltage (p.u.)'], 0.9, 1.0, r['Study case'] + ' lowest');
        between(r['Highest voltage (p.u.)'], 1.0, 1.1, r['Study case'] + ' highest');
        ok(/^Bus \d$/.test(r['Lowest at']) && /^Bus \d$/.test(r['Highest at']), JSON.stringify(r));
      }
      o.summary(`8 rows, 7 converged (lowest ${Math.min(...t.rows.filter(r => r.Status === 'OK').map(r => num(r['Lowest voltage (p.u.)']))).toFixed(4)} p.u.), 07 skipped`);
    },
  },
  'shc-buses': {
    project: N9, timeout: 600,
    check(o) {
      const t = o.csv('Short circuit');
      ok(JSON.stringify(t.head) === JSON.stringify(['Busbar', 'Status', 'Ikss (kA)', 'Skss (MVA)']), JSON.stringify(t.head));
      ok(t.rows.length === 9 && t.rows.every(r => r.Status === 'OK'), `9 busbars, got ${t.rows.length}`);
      const b5 = t.rows.find(r => r.Busbar === 'Bus 5');
      near(b5['Ikss (kA)'], 2.256, 0.002, 'Bus 5 Ikss (kA)');
      const top = t.rows.reduce((a, b) => (num(b['Ikss (kA)']) > num(a['Ikss (kA)']) ? b : a));
      ok(top.Busbar === 'Bus 1', 'the highest current is at Bus 1: ' + top.Busbar); near(top['Ikss (kA)'], 57.0, 0.5, 'Bus 1 Ikss (kA)');
      for (const r of t.rows) ok(num(r['Skss (MVA)']) > 100, 'Skss ' + JSON.stringify(r));
      ok(o.pngs.length === 1, 'one bar chart: ' + o.pngs.join(', '));
      o.summary(`9 rows, Bus 5 ${num(b5['Ikss (kA)']).toFixed(3)} kA / ${num(b5['Skss (MVA)']).toFixed(0)} MVA, Bus 1 ${num(top['Ikss (kA)']).toFixed(2)} kA`);
    },
  },
  frt: {
    project: N9, timeout: 600,
    check(o) {
      const t = o.csv('FRT');
      ok(JSON.stringify(t.head) === JSON.stringify(['LVRT', 'Voltage margin (p.u.)', 'Power recovery time (s)', 'Power recovery']), JSON.stringify(t.head));
      ok(t.rows.length === 1, 'one row');
      const r = t.rows[0];
      ok(r.LVRT === 'PASS', 'the Bus 7 voltage stays above the LVRT curve: ' + JSON.stringify(r));
      between(r['Voltage margin (p.u.)'], 0.0, 0.3, 'voltage margin');
      // G2 is a synchronous machine: its power crosses 90 % at clearing, then swings down to about
      // 30 MW, and first stays above 90 % for 0.5 s from about 4.19 s (3.04 s after clearing), so
      // the 1 s recovery check fails (without the hold it would pass on the first crossing).
      between(r['Power recovery time (s)'], 2.5, 3.5, 'power recovery time (held 0.5 s)');
      ok(r['Power recovery'] === 'FAIL', JSON.stringify(r));
      ok(o.pngs.length === 2, 'two graphs: ' + o.pngs.join(', '));
      has(o.runlog, 'Event: 3ph fault at Bus 7 at 1 s, cleared at 1.15 s.');
      o.summary(`LVRT ${r.LVRT} (margin ${num(r['Voltage margin (p.u.)']).toFixed(3)} p.u.), P back to 90 % after ${num(r['Power recovery time (s)']).toFixed(3)} s: ${r['Power recovery']}`);
    },
  },
  'n-1': {
    project: N39, timeout: 900,
    check(o) {
      const t = o.csv('N-1');
      ok(JSON.stringify(t.head) === JSON.stringify(['Contingency', 'Status', 'Highest loading (%)', 'Most loaded line', 'Lowest voltage (p.u.)', 'Lowest voltage at', 'Highest transformer loading (%)', 'Most loaded transformer']), JSON.stringify(t.head));
      ok(t.rows.length === 1 + 34 + 12, `base case, 34 lines and 12 transformers, got ${t.rows.length}`);
      ok(t.rows[0].Contingency === 'Base case' && t.rows[0].Status === 'OK', 'base case first: ' + JSON.stringify(t.rows[0]));
      const l1011 = t.rows.find(r => r.Contingency === 'Line 10 - 11');
      ok(l1011 && l1011.Status === 'OK', 'Line 10 - 11 row');
      near(l1011['Highest loading (%)'], 107.97, 0.05, 'loading with Line 10 - 11 out (%)');
      const okRows = t.rows.filter(r => r.Status === 'OK');
      const lineRows = okRows.filter(r => /^Line /.test(r.Contingency));
      ok(lineRows.length === 34, 'every line outage converges: ' + lineRows.length);
      // The same numbers as the N-1 live run of the pf blocks (logs/live_n1.log there).
      const worstLine = lineRows.reduce((a, b) => (num(b['Highest loading (%)']) > num(a['Highest loading (%)']) ? b : a));
      ok(worstLine.Contingency === 'Line 21 - 22', 'the worst line outage is Line 21 - 22: ' + worstLine.Contingency);
      near(worstLine['Highest loading (%)'], 158.28, 0.05, 'loading with Line 21 - 22 out (%)');
      near(t.rows[0]['Highest loading (%)'], 99.08, 0.05, 'base case loading (%)');
      for (const r of okRows) { between(r['Highest loading (%)'], 20, 400, r.Contingency); between(r['Lowest voltage (p.u.)'], 0.5, 1.1, r.Contingency); }
      const worst = okRows.reduce((a, b) => (num(b['Highest loading (%)']) > num(a['Highest loading (%)']) ? b : a));
      const m = /Worst outage: (.+), with a line loaded to ([\d.]+) %/.exec(o.runlog);
      ok(m, 'the worst outage line in run.log');
      ok(m[1] === worst.Contingency, `printed worst ${m[1]} is the table's ${worst.Contingency}`);
      near(m[2], num(worst['Highest loading (%)']), 0.06, 'printed worst loading');
      const skipped = t.rows.filter(r => r.Status !== 'OK');
      o.summary(`${t.rows.length} rows (${skipped.length} not converged), Line 10 - 11 out: ${num(l1011['Highest loading (%)']).toFixed(2)} % on ${l1011['Most loaded line']}; worst overall ${worst.Contingency} ${num(worst['Highest loading (%)']).toFixed(1)} %`);
    },
  },
  headroom: {
    project: N39, timeout: 900, keep: [['IntCase', 'Headroom *'], ['IntScenario', 'Headroom *']],
    check(o) {
      const t = o.csv('Headroom');
      ok(JSON.stringify(t.head) === JSON.stringify(['Dispatch (MW)', 'Status', 'Nadir (Hz)', 'Time of nadir (s)', 'Settling time (s)', 'UFLS']), JSON.stringify(t.head));
      ok(JSON.stringify(t.rows.map(r => num(r['Dispatch (MW)']))) === JSON.stringify([150, 250, 350]), 'three passes: ' + JSON.stringify(t.rows.map(r => r['Dispatch (MW)'])));
      ok(t.rows.every(r => r.Status === 'OK'), JSON.stringify(t.rows.map(r => r.Status)));
      const f = t.rows.map(r => num(r['Nadir (Hz)']));
      near(f[1], 59.4517, 0.002, 'nadir with G 10 at 250 MW tripped (the RMS trip fixture)');
      ok(f[0] > f[1] && f[1] > f[2], 'a larger trip gives a lower nadir: ' + f.join(', '));
      between(f[2], 58.5, 59.4, 'nadir at 350 MW');
      for (const r of t.rows) {
        near(r['Time of nadir (s)'], 60, 0.05, 'lowest at the end of the extended run');
        between(r['Settling time (s)'], 5, 45, 'settling time');
        ok(r.UFLS === (num(r['Nadir (Hz)']) < 59 ? 'TRUE' : 'FALSE'), `UFLS ${r.UFLS} with a nadir of ${r['Nadir (Hz)']} Hz (the level is 59 Hz)`);
      }
      ok(o.pngs.length === 2, 'the frequency graph and the nadir graph: ' + o.pngs.join(', '));
      for (const n of ['150', '250', '350']) {
        has(o.text, `LIVE-KEPT IntCase Headroom Dispatch (MW) ${n}`, 'a kept study case per pass');
        has(o.text, `LIVE-KEPT IntScenario Headroom Dispatch (MW) ${n}`, 'its operation scenario');
      }
      has(o.text, 'LIVE-KEPT-LEFT IntCase []'); has(o.text, 'LIVE-KEPT-LEFT IntScenario []');
      o.summary(`nadir ${f.map(x => x.toFixed(4)).join(' / ')} Hz at 150 / 250 / 350 MW, settling ${t.rows.map(r => num(r['Settling time (s)']).toFixed(1)).join(' / ')} s, UFLS ${t.rows.map(r => r.UFLS).join(' / ')}; 3 cases + 3 scenarios kept, then deleted`);
    },
  },
  'find-limit': {
    project: N39, timeout: 900,
    check(o) {
      const m = /Largest dispatch with a safe nadir: ([\d.]+) MW \(search (\w[\w ]*)\)/.exec(o.runlog);
      ok(m, 'the limit line in run.log');
      ok(m[2] === 'DONE', 'search status ' + m[2]);
      // The headroom run: 250 MW keeps the frequency above 59 Hz, 350 MW does not.
      between(m[1], 250, 350, 'largest dispatch of G 10 whose trip keeps the frequency above 59 Hz (MW)');
      ok(o.pngs.length === 1, 'the convergence curve: ' + o.pngs.join(', '));
      const tries = (o.runlog.match(/Dispatch \(MW\) = /g) || []).length;
      o.summary(`limit ${m[1]} MW (search ${m[2]}${tries ? ', ' + tries + ' log lines' : ''})`);
    },
  },
  cct: {
    project: N39, timeout: 900,
    check(o) {
      const m = /Critical clearing time: ([\d.]+) s \(search (\w[\w ]*)\)/.exec(o.runlog);
      ok(m, 'the CCT line in run.log');
      ok(m[2] === 'DONE', 'search status ' + m[2]);
      // The demo cases: a bolted Bus 31 fault is stable when cleared after 0.21 s, unstable after 0.23 s.
      between(m[1], 0.2, 0.24, 'critical clearing time (s)');
      ok(o.pngs.length === 1, 'the convergence curve: ' + o.pngs.join(', '));
      o.summary(`CCT ${m[1]} s (search ${m[2]}); demo cases: stable 0.21 s, unstable 0.23 s`);
    },
  },
};

// What the reading pages' own scripts computed on the same sandboxes (powerfactory-scripter/_pages/
// scripts, run by hand through pfrun.py): the Quick Starts must agree with them.
function pageResult(name) {
  const f = path.join(ROOT, 'powerfactory-scripter', '_pages', 'results', name + '.json');
  ok(fs.existsSync(f), `no ${f}`);
  return JSON.parse(fs.readFileSync(f, 'utf8')).data;
}
LIVE['hosting-capacity'] = {
  project: N39, timeout: 1500,
  check(o) {
    const t = o.csv('Hosting capacity');
    ok(JSON.stringify(t.head) === JSON.stringify(['Connection point', 'Status', 'Hosting capacity (MW)', 'Search']), JSON.stringify(t.head));
    const want = pageResult('hosting_capacity').results;
    ok(t.rows.length === want.length, `one row per busbar of 100 kV and above: ${t.rows.length}, the page script has ${want.length}`);
    for (const w of want) {
      const r = t.rows.find(x => x['Connection point'] === w.Busbar);
      ok(r, 'no row for ' + w.Busbar);
      ok(r.Status === 'OK' && r.Search === 'DONE', `${w.Busbar}: ${r.Status} / ${r.Search}`);
      near(r['Hosting capacity (MW)'], w['Hosting capacity (MW)'], 7.5, `${w.Busbar} hosting capacity (MW) against the page script`);
    }
    ok(o.pngs.length === 1, 'the bar chart: ' + o.pngs.join(', '));
    const lo = t.rows.reduce((a, b) => (num(b['Hosting capacity (MW)']) < num(a['Hosting capacity (MW)']) ? b : a));
    o.summary(`${t.rows.length} busbars, all within 7.5 MW of the page script; lowest ${lo['Connection point']} ${num(lo['Hosting capacity (MW)']).toFixed(0)} MW`);
  },
};
LIVE['pv-curve'] = {
  project: N9, timeout: 600,
  check(o) {
    const t = o.csv('PV curve');
    ok(JSON.stringify(t.head) === JSON.stringify(['Load scaling', 'Status', 'Lowest voltage (p.u.)', 'Lowest at']), JSON.stringify(t.head));
    const want = pageResult('pv_curve').curve;
    const okRows = t.rows.filter(r => r.Status === 'OK');
    ok(okRows.length === want.length, `${okRows.length} converged points, the page script has ${want.length}`);
    for (const w of want) {
      const r = okRows.find(x => Math.abs(num(x['Load scaling']) - w.Scale) < 1e-6);
      ok(r, 'no row for scaling ' + w.Scale);
      const lowest = Math.min(w['Bus 5'], w['Bus 6'], w['Bus 8']);
      near(r['Lowest voltage (p.u.)'], lowest, 0.0005, `lowest voltage at ${w.Scale} x`);
    }
    has(o.runlog, 'the nose of the PV curve');
    ok(o.pngs.length === 1, 'the PV curve: ' + o.pngs.join(', '));
    const last = okRows[okRows.length - 1];
    o.summary(`${okRows.length} points, nose at ${num(last['Load scaling']).toFixed(2)} x (${num(last['Lowest voltage (p.u.)']).toFixed(4)} p.u. at ${last['Lowest at']}), as the page script`);
  },
};
LIVE['rms-batch'] = {
  project: N39, timeout: 1200,
  check(o) {
    const t = o.csv('RMS runs');
    ok(JSON.stringify(t.head) === JSON.stringify(['Fault duration (s)', 'Status', 'Peak rotor angle spread (deg)', 'Stable']), JSON.stringify(t.head));
    ok(JSON.stringify(t.rows.map(r => num(r['Fault duration (s)']))) === JSON.stringify([0.1, 0.15, 0.2, 0.25]), 'four runs: ' + JSON.stringify(t.rows.map(r => r['Fault duration (s)'])));
    const want = pageResult('rms_batch').runs;
    for (const [k, w] of want.entries()) {
      const r = t.rows[k];
      if (w.Stable) {
        ok(r.Stable === 'PASS', `${w['Clearing time (s)']} s: ${r.Stable}`);
        near(r['Peak rotor angle spread (deg)'], w['Peak spread (deg)'], 2, `peak spread with the fault cleared after ${w['Clearing time (s)']} s, against the page script`);
      } else {
        ok(r.Stable === 'FAIL', `${w['Clearing time (s)']} s loses synchronism: ${r.Stable}`);
      }
    }
    ok(o.pngs.length === 1, 'one graph of all runs: ' + o.pngs.join(', '));
    o.summary(`peak spread ${t.rows.map(r => num(r['Peak rotor angle spread (deg)']).toFixed(1)).join(' / ')} deg at 0.10 / 0.15 / 0.20 / 0.25 s: ${t.rows.map(r => r.Stable).join(' / ')}`);
  },
};

const liveSummaries = {};
function runLive(id, L) {
  const f = clone(LOADED[id]);
  FILL[id](f);
  const r = generate(f, { runtime: RUNTIME });
  const file = path.join(LIVE_DIR, `${id}.py`);
  fs.writeFileSync(file, r.code);
  if (r.problems.length) { results.push({ name: `live ${id}: generates`, ok: false, msg: ptext(r) }); return; }
  const opts = { keep: L.keep || [], opval: '', save: '' };
  let res;
  for (let attempt = 1; attempt <= 3; attempt++) {
    res = pfrun([path.join(PF_AUDIT, 'live_wrap.py'), file, JSON.stringify(opts)], (L.timeout + 120) * 1000);
    fs.writeFileSync(path.join(LOG_DIR, `live_${id}${attempt > 1 ? '_try' + attempt : ''}.log`), res.text);
    if (res.code !== 3) break;
  }
  const lines = res.text.split(/\r?\n/);
  const rd = ((/LIVE-RUNDIR (.+)$/m.exec(res.text) || [])[1] || '').trim();
  const o = {
    text: res.text, lines, code: res.code, dir: rd,
    runlog: rd && fs.existsSync(path.join(rd, 'run.log')) ? fs.readFileSync(path.join(rd, 'run.log'), 'utf8') : '',
    pngs: rd && fs.existsSync(rd) ? fs.readdirSync(rd, { recursive: true }).map(String).filter(x => /\.png$/i.test(x)) : [],
    // The runtime makes file names safe (Load flow -> Load_flow.csv).
    csv(name) { const p = path.join(rd, `${name.replace(/[^A-Za-z0-9_.-]+/g, '_')}.csv`); ok(fs.existsSync(p), `no CSV for ${name} in ${rd}: ${fs.existsSync(rd) ? fs.readdirSync(rd).join(', ') : ''}`); return readCsv(p); },
    summary(s) { liveSummaries[id] = s; },
  };
  results.push({ name: `live ${id}: main() ends normally, exit code 0`, ok: /LIVE-EXIT 0/.test(res.text) && res.code === 0, msg: `exit ${res.code}\n${res.text.slice(-3000)}` });
  results.push({ name: `live ${id}: sandbox left as found`, ok: /LIVE-AUDIT OK/.test(res.text), msg: lines.filter(l => /LIVE-(AUDIT|DIFF|DELETE)/.test(l)).join('\n') || res.text.slice(-2000) });
  // The summary, then only its "skipped ..." detail lines and the files line.
  const logLines = o.runlog.trim().split(/\r?\n/);
  const at = logLines.map(l => /Passes run: \d+, skipped: \d+, failed: 0, warnings: \d+, errors: 0\.$/.test(l)).lastIndexOf(true);
  const after = at < 0 ? [] : logLines.slice(at + 1);
  const tailOk = at >= 0 && after.length >= 1 && /\] Files written: \d+ in /.test(after[after.length - 1]) && after.slice(0, -1).every(l => /^\[[\d:]+\] {3}(skipped|failed) /.test(l));
  results.push({ name: `live ${id}: run.log ends with the summary`, ok: tailOk, msg: logLines.slice(-6).join('\n') || '(no run.log)' });
  const errs = o.runlog.split(/\r?\n/).filter(l => / ERROR /.test(l) || /Traceback/.test(l));
  results.push({ name: `live ${id}: no error line in run.log`, ok: !errs.length, msg: errs.join('\n') });
  try { L.check(o); results.push({ name: `live ${id}: results`, ok: true }); } catch (e) { results.push({ name: `live ${id}: results`, ok: false, msg: e instanceof Fail ? e.message : e.stack }); }
}

function liveTree(tag) {
  const probe = path.join(LIVE_DIR, 'tree_probe.py');
  const W0 = { app: 'pf-builder', v: 1, name: 'template tree probe', nodes: [{ id: 'n1', type: 'start', x: 0, y: 0, s: { project: N9, outputDir: OUT } }], edges: [] };
  fs.writeFileSync(probe, generate(W0, { runtime: RUNTIME }).code);
  const out = path.join(LIVE_OUT, `tree_${tag}.json`);
  fs.rmSync(out, { force: true });
  const r = pfrun([path.join(PF_AUDIT, 'live_tree.py'), probe, out], 400 * 1000);
  fs.writeFileSync(path.join(LOG_DIR, `live_tree_${tag}.log`), r.text);
  return fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : null;
}

if (!NO_LIVE) {
  const order = ['ldf-cases', 'shc-buses', 'frt', 'n-1', 'headroom', 'find-limit', 'cct', 'pv-curve', 'hosting-capacity', 'rms-batch'];
  const todo = order.filter(id => LOADED[id] && (!LIVE_ONLY.length || LIVE_ONLY.includes(id)));
  const treeBefore = NO_TREE ? null : liveTree('before');
  for (const id of todo) {
    const t0 = Date.now();
    runLive(id, LIVE[id]);
    console.log(`live ${id}: ${((Date.now() - t0) / 1000).toFixed(0)} s${liveSummaries[id] ? ': ' + liveSummaries[id] : ''}`);
  }
  if (!NO_TREE) {
    const treeAfter = liveTree('after');
    await test('live: both sandboxes hold the same objects as before the template runs (against their demo projects)', () => {
      ok(treeBefore && treeAfter, 'the tree check did not run (see logs/live_tree_*.log)');
      for (const box of [N9, N39]) {
        const a = treeBefore[box], b = treeAfter[box];
        ok(JSON.stringify(a.extra) === JSON.stringify(b.extra) && JSON.stringify(a.missing) === JSON.stringify(b.missing),
          `${box}: extra ${JSON.stringify(b.extra.filter(x => !a.extra.includes(x)))}, missing ${JSON.stringify(b.missing.filter(x => !a.missing.includes(x)))}`);
      }
    });
  }
  fs.writeFileSync(path.join(LOG_DIR, 'live_summary.json'), JSON.stringify(liveSummaries, null, 2));
}

// ---------------------------------------------------------------------------------------------
// (3) Page

if (!NO_PAGE) {
  const { createServer } = await import('node:http');
  let pw;
  try { pw = (await import('file:///D:/opt/node22/lib/node_modules/playwright/index.js')).default; } catch (e) { results.push({ name: 'page: Playwright loads', ok: false, msg: String(e) }); }
  if (pw) {
    const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.py': 'text/plain', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml' };
    const server = createServer((req, res) => {
      const rel = path.normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
      let file = path.join(ROOT, rel);
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(file).pipe(res);
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const ORIGIN = 'http://127.0.0.1:' + server.address().port;
    const browser = await pw.chromium.launch();
    try {
      for (const [width, height] of [[1440, 900], [375, 812]]) {
        const tag = width < 768 ? 'phone' : 'desktop';
        const ctx = await browser.newContext({ viewport: { width, height } });
        await ctx.route('**/*', route => {
          const url = route.request().url();
          if (url.startsWith(ORIGIN)) return route.continue();
          const type = route.request().resourceType();
          if (type === 'script') return route.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
          if (type === 'stylesheet') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
          return route.abort();
        });
        await ctx.addInitScript(() => { try { localStorage.setItem('pf-builder-tour-v1-seen', '1'); } catch (e) { /* fine */ } });
        const page = await ctx.newPage();
        const errors = [];
        page.on('console', m => {
          if (m.type() !== 'error') return;
          const where = (m.location() && m.location().url) || '';
          if (/Failed to load resource/.test(m.text()) && where && !where.startsWith(ORIGIN)) return;
          errors.push('console: ' + m.text() + (where ? ' @ ' + where : ''));
        });
        page.on('pageerror', e => errors.push('pageerror: ' + e.message));
        page.on('dialog', d => d.accept().catch(() => {}));
        await page.goto(ORIGIN + '/powerfactory-scripter/builder/');
        await page.waitForFunction(() => window.PFB && window.PFB.ready, null, { timeout: 20000 });
        await page.evaluate(() => Promise.all([PFB.canvasReady, PFB.runtimeReady, PFB.templatesReady]));
        await page.waitForTimeout(300);
        await test(`page (${tag}): the Quick start row and the starter card list the seven templates`, async () => {
          const list = await page.evaluate(() => PFB.templates().map(t => t.id));
          ok(JSON.stringify(list) === JSON.stringify(IDS), JSON.stringify(list));
          const btns = await page.$$eval('#pfbTemplates .quick-start-btn', ns => ns.map(n => [n.dataset.preset, n.textContent, n.getAttribute('data-tip')]));
          ok(JSON.stringify(btns.map(b => b[0])) === JSON.stringify(IDS), JSON.stringify(btns));
          for (const [id, text, tip] of btns) ok(text === TITLES[id] && tip && tip.length <= 200, `${id}: ${text} / ${tip}`);
          const starter = await page.$$eval('#pfbStarterBtns .pfb-starter-tpl', ns => ns.map(n => n.dataset.preset));
          ok(JSON.stringify(starter) === JSON.stringify(IDS), 'starter card: ' + JSON.stringify(starter));
        });
        for (const id of IDS) {
          await test(`page (${tag}): Quick start "${TITLES[id]}" loads the template, no console error, Python written`, async () => {
            const before = errors.length;
            const qsHidden = await page.evaluate(() => document.getElementById('pfbQuickStart').hidden);
            if (qsHidden) await page.click('#pfbQsBtn');
            await page.waitForSelector(`#pfbTemplates .quick-start-btn[data-preset="${id}"]`, { state: 'visible', timeout: 5000 });
            await page.click(`#pfbTemplates .quick-start-btn[data-preset="${id}"]`);
            const n = LOADED[id].nodes.length;
            await page.waitForFunction(([name, k]) => PFB.store.get().wf.name === name && document.querySelectorAll('.react-flow__node').length === k, [TITLES[id], n], { timeout: 10000 });
            await page.waitForFunction(() => { const g = PFB.store.get().gen; return g && /def main\(\):/.test(g.code); }, null, { timeout: 10000 });
            await page.waitForTimeout(500);
            const info = await page.evaluate(() => ({
              wf: PFB.store.get().wf,
              probs: PFB.store.get().gen.problems.map(p => (p.level === 'todo' ? p.msg : '[' + p.level + '] ' + p.msg)),
              missing: document.querySelectorAll('.pfb-missing').length,
              boxes: [...document.querySelectorAll('.react-flow__node')].map(el => { const r = el.getBoundingClientRect(); return { id: el.dataset.id, x: r.left, y: r.top, w: r.width, h: r.height }; }),
              zoom: (PFB.store.get().wf.view || {}).zoom,
            }));
            ok(info.missing === 0, 'Missing blocks: ' + info.missing);
            ok(JSON.stringify(info.wf.nodes.map(x => [x.id, x.type, x.x, x.y])) === JSON.stringify(LOADED[id].nodes.map(x => [x.id, x.type, x.x, x.y])), 'the canvas holds the template');
            ok(JSON.stringify([...info.probs].sort()) === JSON.stringify([...EXPECT[id].todo].sort()), 'problems on the page: ' + info.probs.join(' | '));
            // Blocks drawn on the canvas do not overlap (measured as drawn, at any zoom).
            const over = [];
            for (let i = 0; i < info.boxes.length; i++) for (let j = i + 1; j < info.boxes.length; j++) {
              const a = info.boxes[i], b = info.boxes[j];
              if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) over.push(a.id + '/' + b.id);
            }
            ok(!over.length, 'overlapping blocks: ' + over.join(', '));
            if (tag === 'desktop') {
              await page.click('.ctrl-tab[data-tab="python"]');
              await page.waitForTimeout(250);
              const code = await page.textContent('#pfbCodeInner');
              ok(/def main\(\):/.test(code) && /# PFB1 /.test(code) && code.includes('WORKFLOW_NAME = "' + TITLES[id] + '"'), 'the Python tab shows the script');
            }
            ok(errors.length === before, errors.slice(before).join(' | '));
          });
        }
        await ctx.close();
      }
    } finally {
      await browser.close();
      server.close();
    }
  }
}

// ---------------------------------------------------------------------------------------------

const failed = results.filter(r => !r.ok);
for (const f of failed) console.log(`FAIL ${f.name}\n  ${String(f.msg).split('\n').join('\n  ')}`);
const line = `template tests: ${results.length - failed.length} passed, ${failed.length} failed`;
console.log(line);
fs.writeFileSync(path.join(LOG_DIR, 'last_summary.txt'), line + '\n' + failed.map(f => 'FAIL ' + f.name + '\n  ' + f.msg).join('\n') + '\n');
process.exit(failed.length ? 1 : 0);
