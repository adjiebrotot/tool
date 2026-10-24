// Tests for the analysis blocks (wave 2, "analysis-blocks"): js/blocks/check.js, result.js and
// search.js (the "check", "result" and "search" categories).
//
// Run from the repo root (D:\Repository\tool):
//   node powerfactory-scripter/builder/_audit/blocks/analysis/run.mjs           offline tests
//   node powerfactory-scripter/builder/_audit/blocks/analysis/run.mjs --live    plus one live run
//                                                                               on the 39-bus sandbox
// Needs Python 3.12 as "python" with matplotlib, scipy, pandas and openpyxl. Prints
// "analysis blocks tests: N passed, M failed" and exits 1 on a failure.
//
// (a) generation: every block with its defaults, every select value, each bool flipped, inputs
//     wired and unwired, every pinnable setting pinned, inside and outside a loop: no unexpected
//     problem, and every script compiles (python -m py_compile, one process for all of them);
//     the validators (Save inside a loop, Report outside a search, NO DATA, limits, wording).
// (b) execution, offline: workflows of the real generic blocks, these blocks and the TEST-ONLY
//     fixture blocks (fixtures/: a recorded trace from a CSV, a synthetic frequency dip) are
//     generated with the REAL runtime files (base, signals, outputs, optimise), the helpers
//     requested for base.py (requested_runtime.py) and the stub PowerFactory parts of the
//     codegen tests, run with Python, and their tables (TABLES_JSON), files and log checked.
// (c) --live: Run RMS simulation (recording a bus frequency) > Frequency nadir > Add row > Save
//     on "39 Bus New England System (Builder test)", through pfrun.py and the pf blocks'
//     live_wrap.py (which audits the sandbox before and after).
//
// "Every pass on one graph" needs a small codegen addition (cx.afterStruct, this agent's
// Requests). While codegen.js does not have it, the tests that need it use a copy of codegen.js
// with exactly that patch applied (generated/codegen_patched.mjs) and say so; the real codegen
// is tested for the fallback (one graph per pass, with a warning).

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILDER = path.resolve(HERE, '..', '..', '..');
const imp = (rel) => import(pathToFileURL(path.join(BUILDER, rel)).href);
await imp('js/blocks/index.js');
await imp('_audit/blocks/analysis/fixtures/fixture-blocks.js');
const CG = await imp('js/core/codegen.js');
const REG = await imp('js/core/registry.js');
const RL = await imp('js/core/runtime-loader.js');
const RES = await imp('js/blocks/result.js');

const ARGS = process.argv.slice(2);
const LIVE = ARGS.includes('--live') && !!process.env.PFB_PFRUN;
if (!process.env.PFB_PFRUN && !ARGS.includes('--no-live')) console.log('PFB_PFRUN is not set: the live PowerFactory part is skipped.');
// The lock runner for live PowerFactory runs (one engine at a time) is a local file, not in the
// repo: point PFB_PFRUN at it. Without it the live part is skipped.
const PFRUN = process.env.PFB_PFRUN || '';
const LIVE_WRAP = path.join(BUILDER, '_audit', 'blocks', 'pf', 'live_wrap.py');
const FIX39 = path.join(BUILDER, '_audit', 'runtime', 'fixtures', '39bus_G10_trip_fehz.csv');
const FIX9 = path.join(BUILDER, '_audit', 'runtime', 'fixtures', 'nine_bus_fault_u1.csv');

const GEN_DIR = path.join(HERE, 'generated');
const OUT_DIR = path.join(HERE, 'out');
fs.rmSync(GEN_DIR, { recursive: true, force: true });
fs.rmSync(OUT_DIR, { recursive: true, force: true });
for (const d of [GEN_DIR, OUT_DIR]) fs.mkdirSync(d, { recursive: true });

// ---------------------------------------------------------------------------------------------
// Runtimes

const read = (rel) => fs.readFileSync(path.join(BUILDER, rel), 'utf8');
function withoutSections(text, skip) {
  const out = [];
  let skipping = false;
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const m = /^# @helper (\w+)\s*$/.exec(line);
    if (m) skipping = skip.has(m[1]);
    if (!skipping) out.push(line);
    if (/^# @end\s*$/.test(line)) skipping = false;
  }
  return out.join('\n');
}
const REAL_ALL = {};
for (const f of RL.RUNTIME_FILES) if (fs.existsSync(path.join(BUILDER, 'runtime', f))) REAL_ALL[f] = read('runtime/' + f);
const ANALYSIS_FILES = ['base.py', 'signals.py', 'outputs.py', 'optimise.py'];
const REAL_OFFLINE = Object.fromEntries(ANALYSIS_FILES.map(f => [f, REAL_ALL[f]]));
const realSections = (files) => new Set(RL.parseRuntime(files).sections.keys());
const REQUESTED_RAW = read('_audit/blocks/analysis/requested_runtime.py');
const FIXTURE_RT = read('_audit/blocks/analysis/fixtures/fixture_runtime.py');
const STUB_RAW = read('_audit/codegen/stub/stub_runtime.py');
const REQ_GEN = withoutSections(REQUESTED_RAW, realSections(REAL_ALL));
const REQ_OFF = withoutSections(REQUESTED_RAW, realSections(REAL_OFFLINE));
const STUB = withoutSections(STUB_RAW, realSections(REAL_OFFLINE));
// Generation: the whole real runtime (so helper names resolve as on the page) + requested + fixtures.
const RT_GEN = { ...REAL_ALL, 'zz_fixture.py': FIXTURE_RT, 'zz_requested.py': REQ_GEN };
// Execution offline: the real analysis half + requested + fixtures + the PowerFactory stubs.
const RT_RUN = { ...REAL_OFFLINE, 'zz_fixture.py': FIXTURE_RT, 'zz_requested.py': REQ_OFF, 'zz_stub.py': STUB };
const REQUESTED_STILL = [...RL.parseRuntime({ x: REQUESTED_RAW }).sections.keys()].filter(n => !realSections(REAL_ALL).has(n));

// The codegen with the requested cx.afterStruct (only while the real one lacks it).
const HAS_AFTER = /afterStruct/.test(read('js/core/codegen.js'));
let generatePatched = CG.generate;
let patchNote = 'codegen.js has cx.afterStruct';
if (!HAS_AFTER) {
  let src = read('js/core/codegen.js');
  const rep = (a, b, all = false) => {
    const k = src.split(a).length - 1;
    if (k === 0 || (!all && k !== 1)) throw new Error(`codegen patch: "${a.slice(0, 50)}" found ${k} times`);
    src = src.split(a).join(b);
  };
  rep("      skipTables: () => (env && env.struct ? skipTablesFor(env.struct.id) : []),\n",
    "      skipTables: () => (env && env.struct ? skipTablesFor(env.struct.id) : []),\n" +
    "      afterStruct: (lines) => {\n" +
    "        if (!env || !env.struct || opt.probe) return false;\n" +
    "        const q = env.struct.after || (env.struct.after = new Map());\n" +
    "        if (!q.has(X)) q.set(X, flatLines(lines));\n" +
    "        return true;\n" +
    "      },\n");
  rep("  const emitLoop = (L, env, buf) => {\n",
    "  // Lines blocks on the Each route asked for once their loop or search has ended\n" +
    "  // (cx.afterStruct; e.g. Draw time series graph with every pass on one graph), in node order.\n" +
    "  const writeAfterStruct = (struct, buf) => {\n" +
    "    if (!struct || !struct.after) return;\n" +
    "    for (const id of [...struct.after.keys()].sort(compareIds)) {\n" +
    "      const prev = buf.owner;\n" +
    "      buf.owner = id;\n" +
    "      buf.addLines(struct.after.get(id));\n" +
    "      buf.owner = prev;\n" +
    "    }\n" +
    "  };\n\n" +
    "  const emitLoop = (L, env, buf) => {\n");
  rep("    buf.addLines(r.after);\n", "    buf.addLines(r.after);\n    writeAfterStruct(benv.struct, buf);\n", true);
  src = src.replace(/from '\.\/([\w-]+\.js)'/g, (m, f) => `from '${pathToFileURL(path.join(BUILDER, 'js', 'core', f)).href}'`);
  const file = path.join(GEN_DIR, 'codegen_patched.mjs');
  fs.writeFileSync(file, src);
  generatePatched = (await import(pathToFileURL(file).href)).generate;
  patchNote = 'a copy of codegen.js with the requested cx.afterStruct (Requests R1)';
}

// ---------------------------------------------------------------------------------------------
// Harness

const results = [];
let current = null;
class Fail extends Error {}
const ok = (cond, msg) => { if (!cond) throw new Fail(msg || 'expected true'); };
const eq = (a, b, msg) => { const ja = JSON.stringify(a), jb = JSON.stringify(b); if (ja !== jb) throw new Fail(`${msg ? msg + ': ' : ''}got ${ja}, expected ${jb}`); };
const has = (text, part, msg) => { if (!String(text).includes(part)) throw new Fail((msg ? msg + ': ' : '') + `missing: ${part}`); };
const hasNot = (text, part, msg) => { if (String(text).includes(part)) throw new Fail((msg ? msg + ': ' : '') + `unexpected: ${part}`); };
const near = (a, b, tol, msg) => { if (!(Math.abs(Number(a) - Number(b)) <= tol)) throw new Fail(`${msg || 'value'}: got ${a}, expected ${b} +- ${tol}`); };
function test(name, fn) {
  current = name;
  try { fn(); results.push({ name, ok: true }); } catch (e) { results.push({ name, ok: false, msg: e instanceof Fail ? e.message : (e && e.stack) || String(e) }); }
  current = null;
}
const toCompile = [];
let genN = 0;

// Workflow DSL (as the codegen tests): nodes { id: [type, settings, { label, pin }] }, flow
// 'a>b' or 'a.out>b', data 'a.port>b.port'.
function W(nodes, flow = [], data = [], name = 'Analysis test') {
  const ns = Object.entries(nodes).map(([id, [type, s = {}, extra = {}]]) => ({ id, type, x: 0, y: 0, label: extra.label || '', s, pin: extra.pin || [] }));
  const edges = [];
  let k = 1;
  for (const f of flow) {
    const [a, b] = f.split('>');
    const [from, out] = a.includes('.') ? a.split('.') : [a, 'next'];
    edges.push({ id: 'e' + k++, from, out, to: b, in: 'in' });
  }
  for (const d of data) {
    const [a, b] = d.split('>');
    const [from, out] = a.split('.');
    const [to, inn] = b.split('.');
    edges.push({ id: 'e' + k++, from, out, to, in: inn });
  }
  return { app: 'pf-builder', v: 1, name, nodes: ns, edges, view: { x: 0, y: 0, zoom: 1 } };
}
const slug = (t) => String(t).replace(/[^A-Za-z0-9_.-]+/g, '_').slice(0, 80);
function gen(wf, tag, o = {}) {
  const g = o.patched ? generatePatched : CG.generate;
  const r = g(wf, { runtime: o.runtime || RT_GEN });
  const file = path.join(GEN_DIR, `${String(++genN).padStart(4, '0')}_${slug(tag)}.py`);
  fs.writeFileSync(file, r.code);
  toCompile.push({ file, test: current || tag });
  r.file = file;
  return r;
}
const ptext = (r) => r.problems.map(p => `[${p.level}] ${p.msg}`).join('\n');
const hasP = (r, level, re) => r.problems.some(p => p.level === level && re.test(p.msg));
const mainBody = (code) => { const a = code.indexOf('def main():'); const b = code.indexOf('# ==== HELPERS'); return code.slice(a, b); };
// Problems that are not in the allowed list (each entry [level, regex]).
const unexpected = (r, allow = []) => r.problems.filter(p => !allow.some(([lv, re]) => lv === p.level && re.test(p.msg)));

function outDir(tag) { const d = path.join(OUT_DIR, slug(tag)); fs.mkdirSync(d, { recursive: true }); return d; }
const START = (out, extra = {}) => ['start', { project: 'Analysis test', outputDir: out, fNominal: '60', ...extra }];

// Generate with the offline runtime, run it, and return what it printed and wrote.
function run(wf, tag, o = {}) {
  const r = gen(wf, tag, { runtime: RT_RUN, patched: o.patched });
  const bad = r.problems.filter(p => p.level === 'error' || p.level === 'todo');
  if (bad.length && !o.allowProblems) throw new Fail(`${tag}: problems before running:\n${ptext(r)}`);
  const cwd = o.cwd || path.dirname(r.file);
  const p = spawnSync('python', [r.file], { cwd, encoding: 'utf8', timeout: 240000, maxBuffer: 64 << 20, env: { ...process.env, PYTHONIOENCODING: 'utf-8', MPLBACKEND: 'Agg' } });
  const stdout = p.stdout || '';
  const line = stdout.split('\n').find(l => l.startsWith('TABLES_JSON '));
  const tables = line ? JSON.parse(line.slice('TABLES_JSON '.length)) : null;
  const dirLine = stdout.split('\n').find(l => /Files written: \d+ in /.test(l));
  const runDir = dirLine ? dirLine.replace(/^.*Files written: \d+ in /, '').trim() : null;
  const files = [];
  const walk = (d) => { if (!d || !fs.existsSync(d)) return; for (const f of fs.readdirSync(d)) { const q = path.join(d, f); if (fs.statSync(q).isDirectory()) walk(q); else files.push(q); } };
  walk(runDir);
  const res = { gen: r, code: p.status, stdout, stderr: p.stderr || '', tables, runDir, files };
  if (p.status !== 0 && !o.allowFail) throw new Fail(`${tag}: exit ${p.status}\n${stdout.slice(-3000)}\n${res.stderr.slice(-3000)}`);
  return res;
}
const rowsOf = (res, t) => ((res.tables || {})[t] || { rows: [] }).rows;
const colsOf = (res, t) => ((res.tables || {})[t] || { columns: [] }).columns;
const isPng = (f) => { try { const b = fs.readFileSync(f); return b.length > 3000 && b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])); } catch (e) { return false; } };
const pngs = (res) => res.files.filter(f => f.endsWith('.png'));
const csvs = (res, sub) => res.files.filter(f => f.endsWith('.csv') && (!sub || path.basename(path.dirname(f)) === sub));

// =============================================================================================
// (a) The blocks: definitions, words, kinds

const SPEC = {
  check: { 'sig.despike': 'pure', 'sig.nadir': 'pure', 'sig.peak': 'pure', 'sig.settle': 'pure', 'sig.rocof': 'pure', 'sig.at': 'pure', 'sig.final': 'pure', 'sig.cross': 'pure', 'chk.limit': 'branch', 'chk.verdict': 'branch' },
  result: { 'out.table.add': 'action', 'out.table.save': 'action', 'out.table.column': 'pure', 'out.plot.series': 'action', 'out.plot.xy': 'action', 'out.plot.3d': 'action', 'out.plot.heatmap': 'action', 'out.plot.table': 'action', 'out.plot.conv': 'action', 'out.series.save': 'action', 'data.read': 'action' },
  search: { 'opt.optimise': 'callback', 'opt.limit': 'callback', 'opt.report': 'action' },
};
const MINE = Object.values(SPEC).flatMap(o => Object.keys(o));

test('catalogue: every block of DESIGN 9 is defined with its category and kind', () => {
  for (const [cat, blocks] of Object.entries(SPEC)) {
    for (const [type, kind] of Object.entries(blocks)) {
      const b = REG.getBlock(type);
      ok(b, 'missing ' + type);
      eq([b.cat, b.kind], [cat, kind], type);
    }
    eq(REG.blocksIn(cat).map(b => b.type).sort(), Object.keys(blocks).sort(), 'no other blocks in ' + cat);
  }
});

test('words: titles, descs, tips, labels (no em-dash, desc <= 200, keywords, nouns and verbs)', () => {
  const bad = [];
  for (const type of MINE) {
    const b = REG.getBlock(type);
    const node = { id: 'n1', type, s: {} };
    const ports = REG.portsOf(node);
    const texts = [b.title, b.desc, ...b.settings.flatMap(s => [s.label, s.tip, s.placeholder, ...(s.columns || []).flatMap(c => [c.label, c.tip, c.placeholder])]),
      ...[...ports.inputs, ...ports.outputs, ...b.inputs, ...b.outputs].flatMap(p => [p.label, p.tip]), ...ports.flowOuts.flatMap(p => [p.label, p.stopMsg]),
      ...b.settings.filter(s => s.kind === 'select').flatMap(s => REG.optionPairs(s).map(o => o[1]))].filter(Boolean);
    for (const t of texts) if (/[\u2013\u2014]/.test(t)) bad.push(`${type}: dash in "${t}"`);
    if (!b.desc || b.desc.length > 200) bad.push(`${type}: desc length ${b.desc.length}`);
    for (const s of b.settings) if (s.tip && s.tip.length > 200) bad.push(`${type}.${s.key}: tip ${s.tip.length}`);
    for (const p of [...ports.inputs, ...ports.outputs]) if (p.tip && p.tip.length > 200) bad.push(`${type}.${p.id}: tip ${p.tip.length}`);
    if ((b.keywords || []).length < 5) bad.push(`${type}: few keywords`);
    for (const s of b.settings) if (s.kind === 'select') for (const [v] of REG.optionPairs(s)) if (typeof v !== 'string') bad.push(`${type}.${s.key}: option ${v}`);
    try { REG.summaryOf(node); } catch (e) { bad.push(`${type}: summary throws`); }
  }
  // Calculators are nouns, steps verbs (U13).
  for (const type of MINE) {
    const b = REG.getBlock(type);
    const verb = /^(Add|Save|Draw|Read|Report|Find|Optimise|Check)\b/.test(b.title);
    if (b.kind === 'pure' && verb) bad.push(`${type}: a calculator titled like a step: ${b.title}`);
    if (b.kind === 'action' && !verb) bad.push(`${type}: a step not titled with a verb: ${b.title}`);
  }
  eq(bad, []);
  const kw = (t) => REG.getBlock(t).keywords.join(' | ').toLowerCase();
  for (const [t, w] of [['sig.nadir', 'settles'], ['sig.nadir', 'lowest frequency'], ['sig.nadir', 'ufls'], ['sig.settle', 'settles'], ['sig.rocof', 'rate of change of frequency'],
    ['out.plot.series', 'graph'], ['out.plot.series', 'chart'], ['out.table.save', 'csv'], ['out.table.save', 'excel'], ['data.read', 'excel'], ['sig.despike', 'spikes']]) has(kw(t), w, t);
  ok(/frequency traces/.test(REG.getBlock('sig.despike').inputs[0].tip), 'despike tip says it is for frequency traces');
});

test('handles: nadir floor / UFLS are offsets below nominal, defaults match the ESS study', () => {
  const s = REG.settingsOf({ type: 'sig.nadir', s: {} });
  eq([s.floorBelow, s.uflsBelow, s.window, s.minRecovery, s.tailGuard, s.requiresUfls, s.t_event, s.extendTo, s.nominal], [5, 1, 10, 0.05, 1, true, null, null, null]);
  const d = REG.settingsOf({ type: 'sig.despike', s: {} });
  eq([d.window, d.trigger, d.maxStep, d.settle], [0.2, 0.1, 20, 0.02]);
  eq(REG.settingsOf({ type: 'sig.rocof', s: {} }).window, 0.5);
  const st = REG.settingsOf({ type: 'sig.settle', s: {} });
  eq([st.bandMode, st.band, st.hold, st.reference, st.guard], ['pct', 10, 1, 'final', 1]);
  const ports = REG.portsOf({ type: 'sig.nadir', s: {} });
  eq(ports.inputs.map(p => p.id), ['series', 't_event', 'nominal', 'extendTo']);
  eq(ports.outputs.map(p => p.id), ['nadir', 'time', 'turned', 'verdict', 'ufls', 'minimum', 'min_time', 'still', 'recovery']);
  eq(REG.portsOf({ type: 'sig.rocof', s: {} }).inputs.map(p => p.id), ['series', 't_event', 'nadir_t', 'verdict', 'nominal']);
  eq(REG.portsOf({ type: 'chk.limit', s: {} }).flowOuts.map(p => [p.id, p.label]), [['pass', 'Pass'], ['fail', 'Fail']]);
  ok(REG.portsOf({ type: 'chk.verdict', s: {}, label: 'Nadir check' }).flowOuts[1].stopMsg === 'Nadir check did not pass');
  eq(REG.portsOf({ type: 'opt.limit', s: {} }).outputs.map(p => [p.id, p.scope]), [['value', 'body'], ['limit', 'done'], ['found', 'done'], ['status', 'done'], ['passing', 'done'], ['failing', 'done'], ['history', 'done']]);
  eq(REG.portsOf({ type: 'opt.optimise', s: { vars: [{ id: 'v1', name: 'P' }, { id: 'v2', name: 'Q' }] } }).outputs.map(p => p.id), ['v1', 'v2', 'best_v1', 'best_v2', 'score', 'found', 'history']);
  ok(REG.getBlock('opt.report').within === 'callback');
  ok(REG.getBlock('out.table.save').oncePerRun && REG.getBlock('out.plot.table').oncePerRun);
  ok(REG.getBlock('out.table.column').volatile === true);
  const drSrc = REG.getBlock('data.read').settings.find(x => x.key === 'src');
  ok(drSrc && drSrc.kind === 'file' && drSrc.required && drSrc.pathKey === 'path', 'data.read: the attached file is the required setting and fills path');
  const dr = REG.getBlock('data.read').settings.find(x => x.key === 'path');
  ok(dr.pin === true && typeof dr.showIf === 'function' && dr.showIf({ src: { name: 'x.csv' } }) === false, 'data.read path: pinned by default, hidden once a file is attached');
  for (const t of ['out.plot.series', 'out.plot.xy', 'out.plot.3d', 'out.plot.heatmap', 'out.plot.table', 'out.plot.conv']) eq(REG.getBlock(t).packages, ['matplotlib'], t);
});

test('columns: "+ drop a value" names a column from the source label and unit; grow() makes the row', () => {
  eq(RES.columnName({ title: 'Frequency nadir', port: { id: 'nadir', label: 'Nadir', unit: 'Hz' } }), 'Nadir (Hz)');
  eq(RES.columnName({ title: 'Dispatch (MW)', port: { id: 'value', label: 'Value' } }), 'Dispatch (MW)');
  eq(RES.columnName({ nodeLabel: 'Dispatch', title: 'For a range of numbers', first: true, port: { id: 'value', label: 'Value', unit: 'MW' } }), 'Dispatch (MW)');
  eq(RES.columnName({ nodeLabel: 'Bus 16', title: 'Frequency nadir', port: { id: 'time', label: 'Nadir time', unit: 's' } }), 'Bus 16 Nadir time (s)');
  eq(RES.columnName({ title: 'RoCoF', port: { id: 'rocof', label: 'RoCoF', unit: 'Hz/s' } }), 'RoCoF (Hz/s)');
  const def = REG.getBlock('out.table.add');
  const g = def.grow({ table: 'Results', cols: [{ id: 'c1', name: 'A' }] }, { title: 'Frequency nadir', port: { id: 'nadir', label: 'Nadir', unit: 'Hz' } });
  eq(g, { key: 'cols', value: [{ id: 'c1', name: 'A' }, { id: 'c2', name: 'Nadir (Hz)' }], s: { table: 'Results', cols: [{ id: 'c1', name: 'A' }, { id: 'c2', name: 'Nadir (Hz)' }] }, input: 'c2' });
  const ports = REG.portsOf({ type: 'out.table.add', s: g.s });
  eq(ports.inputs.map(p => [p.id, p.label]), [['c1', 'A'], ['c2', 'Nadir (Hz)'], ['add', '+ drop a value']]);
  ok(ports.inputs[2].grow === true);
  const gp = REG.getBlock('out.plot.series').grow({ lines: [{ id: 'l1', name: '' }] }, { title: 'Run RMS simulation', port: { id: 'r1', label: 'Bus 16 · Frequency', unit: 'Hz' } });
  eq(gp.input, 'l2');
  // Summary: "saved at the end automatically" while no Save block names the table (needs the workflow, Requests R3).
  const add = { type: 'out.table.add', s: { table: 'Results' } };
  eq(def.summary(REG.settingsOf(add), add, { nodes: [add] }), 'Into "Results", saved at the end automatically');
  eq(def.summary(REG.settingsOf(add), add, { nodes: [add, { type: 'out.table.save', s: { table: 'Results' } }] }), 'Into "Results"');
  eq(def.summary(REG.settingsOf(add), add), 'Into "Results"');
  eq(RES.columnList('Nadir (Hz), RoCoF (Hz/s)'), ['Nadir (Hz)', 'RoCoF (Hz/s)']);
  eq(RES.columnList('A, B\nC'), ['A, B', 'C']);
});

test('columns: the editor\'s grow step (Requests R2, done here with ops.js) turns drops on "+ drop a value" into named columns', async () => {});
const OPS = await imp('js/ui/ops.js');
// What app.connectWire does with Requests R2 applied: a wire on an input marked grow becomes a
// new row of the block and goes to that row's input.
function dropWire(wf, c) {
  const tgt = OPS.portAt(wf, c.to, c.in, 'in');
  if (tgt && tgt.kind === 'input' && tgt.port.grow && tgt.def && typeof tgt.def.grow === 'function') {
    const sp = OPS.portAt(wf, c.from, c.out, 'out');
    const sn = OPS.nodeById(wf, c.from);
    const sdef = sn && REG.getBlock(sn.type);
    const first = !!(sn && sp && sdef && (REG.portsOf(sn).outputs[0] || {}).id === sp.port.id);
    const g = tgt.def.grow(REG.settingsOf(tgt.node), { nodeLabel: String((sn && sn.label) || '').trim(), title: sdef ? sdef.title : '', first, port: sp ? sp.port : {} });
    if (g && g.key && g.input) { wf = OPS.setSetting(wf, c.to, g.key, g.value); c = { ...c, in: g.input }; }
  }
  return OPS.connect(wf, c).wf;
}
results.pop();
test('columns: the editor\'s grow step (Requests R2, done here with ops.js) turns drops on "+ drop a value" into named columns', () => {
  let wf = W({ n1: ['start', { project: 'P' }], n2: ['flow.range', {}, { label: 'Dispatch' }], n3: ['fixa.synth', {}], n4: ['sig.nadir', {}], n5: ['out.table.add', {}] },
    ['n1>n2', 'n2.body>n5'], ['n2.value>n3.mw', 'n3.series>n4.series']);
  wf = dropWire(wf, { from: 'n4', out: 'nadir', to: 'n5', in: 'add' });
  wf = dropWire(wf, { from: 'n4', out: 'ufls', to: 'n5', in: 'add' });
  wf = dropWire(wf, { from: 'n2', out: 'value', to: 'n5', in: 'add' });
  const n5 = wf.nodes.find(n => n.id === 'n5');
  eq(n5.s.cols.map(r => [r.id, r.name]), [['c1', 'Nadir (Hz)'], ['c2', 'UFLS'], ['c3', 'Dispatch']]);
  eq(wf.edges.filter(e => e.to === 'n5' && e.in !== 'in').map(e => e.in), ['c1', 'c2', 'c3']);
  const r = gen(wf, 'grow columns');
  eq(unexpected(r), [], ptext(r));
  has(mainBody(r.code), '"Nadir (Hz)": nadir_result.value,');
  has(mainBody(r.code), '"Dispatch": dispatch,');
});

// ---------------------------------------------------------------------------------------------
// (a) Generation sweep

const FILL = {
  'chk.limit': { lo: 0.9 },
  'out.table.add': { cols: [{ id: 'c1', name: 'A' }, { id: 'c2', name: 'B' }] },
  'out.table.column': { col: 'A', of: 'B' },
  'data.read': { path: 'cases.csv' },
  'out.plot.table': { x: 'A', ys: 'B, C' },
  'sig.settle': { target: 1 },
  'out.plot.series': { limits: [{ id: 'h1', value: 59, label: 'UFLS' }, { id: 'h2', value: 60, label: '' }] },
  'opt.optimise': { vars: [{ id: 'v1', name: 'x', lower: -1, upper: 1, integer: false }, { id: 'v2', name: 'n', lower: 0, upper: 5, integer: true }] },
};
const SRC = { num: ['val.number', 'value'], bool: ['val.bool', 'value'], text: ['val.text', 'value'], list: ['val.list', 'value'], items: ['val.list', 'value'], series: ['fixa.synth', 'series'], any: ['val.number', 'value'], cell: ['val.number', 'value'] };

// A workflow around one block of type `type`: its inputs fed (when `wired`), its outputs used.
function around(type, s, { wired = true, loop = false, pin = [], label = '' } = {}) {
  const def = REG.getBlock(type);
  const nodes = { n1: ['start', { project: 'P' }] };
  const flow = [];
  const data = [];
  let k = 100;
  const X = 'n50';
  nodes[X] = [type, s, { pin, label }];
  const xn = { id: X, type, s, label };
  const ports = REG.portsOf(xn);
  const feed = (target) => {
    for (const p of ports.inputs) {
      if (!wired) continue;
      if (p.type === 'hist') continue;
      const src = SRC[p.type];
      if (!src) continue;
      const id = 'n' + (k++);
      nodes[id] = [src[0], src[0] === 'val.list' ? { values: '1, 2, 3' } : {}];
      data.push(`${id}.${src[1]}>${target}.${p.id}`);
    }
  };
  // Where the block sits: in a loop's Each pass, or straight after Start.
  let head = 'n1';
  if (loop) { nodes.n2 = ['flow.range', { from: 1, to: 2, step: 1 }, { label: 'Pass value' }]; flow.push('n1>n2'); head = 'n2.body'; }
  if (type === 'opt.report') {
    nodes.n3 = ['opt.limit', { lower: 0, upper: 10, tol: 1 }];
    flow.push(`${head}>n3`, 'n3.body>' + X);
    head = null;
  } else if (type === 'out.plot.conv') {
    nodes.n3 = ['opt.limit', { lower: 0, upper: 10, tol: 1 }];
    nodes.n4 = ['opt.report', {}];
    nodes.n5 = ['math.compare', { op: 'le', b: 3 }];
    flow.push(`${head}>n3`, 'n3.body>n4', 'n3.done>' + X);
    data.push('n3.value>n5.a', 'n5.value>n4.pass');
    if (wired) data.push(`n3.history>${X}.history`);
    head = null;
  }
  if (def.kind === 'pure') {
    // Used by an Add row (values) and a graph (curves).
    nodes.n60 = ['out.table.add', { cols: [] }];
    nodes.n61 = ['out.plot.series', { lines: [] }];
    if (head) flow.push(`${head}>n60`);
    flow.push('n60>n61');
    const cols = [];
    let usedSeries = false;
    for (const p of ports.outputs) {
      if (p.type === 'series') { if (!usedSeries) { data.push(`${X}.${p.id}>n61.add`); usedSeries = true; } continue; }
      if (REG.canConnect(p.type, 'cell')) { cols.push({ id: 'c' + (cols.length + 1), name: p.label }); data.push(`${X}.${p.id}>n60.c${cols.length}`); }
    }
    nodes.n60[1].cols = cols;
    if (!usedSeries) { nodes.n62 = ['fixa.synth', {}]; data.push('n62.series>n61.add'); }
  } else if (head) {
    flow.push(`${head}>${X}`);
  }
  feed(X);
  if (def.kind === 'branch') {
    nodes.n70 = ['flow.log', { text: 'passed' }];
    nodes.n71 = ['flow.log', { text: 'failed' }];
    flow.push(`${X}.pass>n70`, `${X}.fail>n71`);
    nodes.n72 = ['flow.log', { text: 'margin {m}' }];
    flow.push('n70>n72');
    data.push(`${X}.margin>n72.m`);
  }
  if (def.kind === 'callback') {
    nodes.n80 = ['opt.report', {}];
    flow.push(`${X}.body>n80`);
    const bodyOut = ports.outputs.find(p => p.scope === 'body');
    if (bodyOut) data.push(`${X}.${bodyOut.id}>n80.score`);
    const done = ports.outputs.filter(p => p.scope === 'done' && p.type !== 'hist');
    nodes.n81 = ['flow.log', { text: done.map((p, i) => `{o${i}}`).join(' ') || 'done' }];
    flow.push(`${X}.done>n81`);
    done.forEach((p, i) => data.push(`${X}.${p.id}>n81.o${i}`));
    const hist = ports.outputs.find(p => p.type === 'hist');
    if (hist) { nodes.n82 = ['out.plot.conv', {}]; flow.push('n81>n82'); data.push(`${X}.${hist.id}>n82.history`); }
  }
  return W(nodes, flow, data, 'Gen ' + type);
}

// Problems a generation variant may show: unwired required inputs (to-dos), and the warnings
// that are the point of a setting or a place.
const ALLOW_UNWIRED = [['todo', /^Connect /], ['todo', /^Give the final value/], ['todo', /^Connect a time series to|^Connect the Y values to|^Connect a Score or a Pass/],
  ['warning', /has no value wired in, so it stays empty/], ['warning', /no columns yet/]];
const ALLOW_ALWAYS = [['warning', /runs on every pass of Pass value and writes a file each time/], ['warning', /cannot draw every pass on one graph yet/],
  ['warning', /draws every pass on one graph after the loop, so its Mark/], ['warning', /is not used: wire one of its outputs/],
  ['warning', /Bounded search works on one variable/]];

function sweep(type) {
  const def = REG.getBlock(type);
  const base = { ...(FILL[type] || {}) };
  const variants = [{ tag: 'defaults', s: base }];
  for (const st of def.settings) {
    if (st.kind === 'select') for (const [v] of REG.optionPairs(st)) if (v !== st.default) variants.push({ tag: `${st.key}=${v}`, s: { ...base, [st.key]: v } });
    if (st.kind === 'bool') variants.push({ tag: `${st.key}=${!st.default}`, s: { ...base, [st.key]: !st.default } });
  }
  const pinnable = def.settings.filter(st => st.kind !== 'list' && !st.noPin).map(st => st.key);
  for (const v of variants) {
    for (const wired of [true, false]) {
      for (const loop of [false, true]) {
        if (!wired && v.tag !== 'defaults') continue;
        const wf = around(type, v.s, { wired, loop });
        const r = gen(wf, `${type}_${v.tag}${wired ? '' : '_unwired'}${loop ? '_loop' : ''}`);
        const allow = [...ALLOW_ALWAYS, ...(wired ? [] : ALLOW_UNWIRED)];
        if (type === 'out.plot.conv' && !wired) allow.push(['todo', /^Connect a value to History/]);
        const u = unexpected(r, allow);
        if (u.length) throw new Fail(`${type} ${v.tag}${wired ? '' : ' unwired'}${loop ? ' in a loop' : ''}:\n${u.map(p => `[${p.level}] ${p.msg}`).join('\n')}`);
      }
    }
  }
  if (pinnable.length) {
    const r = gen(around(type, base, { pin: pinnable, label: 'Pinned block' }), `${type}_pinned`);
    const u = unexpected(r, ALLOW_ALWAYS);
    if (u.length) throw new Fail(`${type} pinned:\n${ptext(r)}`);
    for (const key of pinnable) {
      const st = def.settings.find(x => x.key === key);
      ok(Object.values(r.settingsMap).some(m => m[0] === 'n50' && m[1] === key), `${type}: ${key} pinned gives a SETTINGS line`);
      if (st.kind === 'number' || st.kind === 'text') { /* used by name in the code */ }
    }
  }
  return variants.length;
}
let nVariants = 0;
for (const type of MINE) test(`generate: ${type} (defaults, every option, wired / unwired, in a loop, pinned)`, () => { nVariants += sweep(type); });

// ---------------------------------------------------------------------------------------------
// (a) What the code says, and the validators

test('code: nadir and RoCoF calls; a Verdict wired from Frequency nadir passes its whole result', () => {
  const wf = W({ n1: ['start', { project: 'P' }], n2: ['fixa.synth', {}], n3: ['sig.nadir', { extendTo: 60 }], n4: ['sig.rocof', {}], n5: ['out.table.add', { cols: [{ id: 'c1', name: 'RoCoF (Hz/s)' }] }] },
    ['n1>n5'], ['n2.series>n3.series', 'n2.series>n4.series', 'n3.verdict>n4.verdict', 'n3.time>n4.nadir_t', 'n4.rocof>n5.c1', 'n3.nadir>n5.add']);
  const r = gen(wf, 'nadir rocof');
  eq(unexpected(r), [], ptext(r));
  const b = mainBody(r.code);
  has(b, 'nadir_result = nadir(freq_hz, t_event=None, nominal=None, delay=0, window=10, min_recovery=0.05, tail_guard=1, floor_below=5, ufls_below=1, requires_ufls=True, extend_to=60)');
  has(b, 'rocof(freq_hz, t_event=None, nadir_time=nadir_result.time, verdict=nadir_result, window=0.5');
  has(b, '"Nadir (Hz)": nadir_result.value,');
  has(b, 'table("Results").add({');
});

test('extended run: the UFLS level comes from the Frequency nadir it feeds, unless the run has its own', () => {
  const rec = [{ id: 'r1', el: { cls: 'ElmTerm', name: 'Bus 5', match: 'one' }, var: 'm:fehz', combine: 'none' }];
  const wf = (rms, nadir, viaDespike) => W({ n1: ['start', { project: 'P' }], n2: ['pf.rms', { record: rec, extendTo: 60, ...rms }], n3: ['sig.despike', {}], n4: ['sig.nadir', nadir], n5: ['flow.log', { text: '{v}' }] },
    ['n1>n2', 'n2.ok>n5'], viaDespike ? ['n2.r1>n3.series', 'n3.series>n4.series', 'n4.nadir>n5.v'] : ['n2.r1>n4.series', 'n4.nadir>n5.v']);
  has(mainBody(gen(wf({}, { uflsBelow: 1.5 }, false), 'ufls_direct').code), 'extend_to=60, ufls_below=1.5)');
  has(mainBody(gen(wf({}, { uflsBelow: 0.8 }, true), 'ufls_despike').code), 'extend_to=60, ufls_below=0.8)', 'through Remove spikes');
  const own = mainBody(gen(wf({ ufls: 59 }, { uflsBelow: 1.5 }, false), 'ufls_own').code);
  has(own, 'extend_to=60, ufls_hz=59)', 'the run\'s own level wins');
  has(mainBody(gen(wf({ extendTo: 0 }, { uflsBelow: 1.5 }, false), 'ufls_off').code), 'extend_to=0)', 'not extended: no level needed');
});
test('code: Add row keeps skipped passes (Status column, ctx_pop with the table) only inside a loop', () => {
  const inLoop = W({ n1: ['start', { project: 'P' }], n2: ['flow.range', {}, { label: 'Dispatch (MW)' }], n3: ['out.table.add', { table: 'Sweep', cols: [{ id: 'c1', name: 'V' }] }] },
    ['n1>n2', 'n2.body>n3'], ['n2.value>n3.c1']);
  const r = gen(inLoop, 'add row in loop');
  has(r.code, 'table("Sweep").add({"V": dispatch_mw}, status=True)');
  has(r.code, 'ctx_pop(["Sweep"])');
  const off = W({ n1: ['start', { project: 'P' }], n2: ['flow.range', {}, { label: 'Dispatch (MW)' }], n3: ['out.table.add', { table: 'Sweep', onSkip: false, ctx: false, cols: [{ id: 'c1', name: 'V' }] }] },
    ['n1>n2', 'n2.body>n3'], ['n2.value>n3.c1']);
  const r2 = gen(off, 'add row keep off');
  has(r2.code, 'table("Sweep").add({"V": dispatch_mw}, with_ctx=False)');
  hasNot(r2.code, 'ctx_pop(["Sweep"])');
  const top = gen(W({ n1: ['start', { project: 'P' }], n3: ['out.table.add', { cols: [{ id: 'c1', name: 'V' }] }], n4: ['val.number', { value: 3 }] }, ['n1>n3'], ['n4.value>n3.c1']), 'add row top');
  has(top.code, 'table("Results").add({"V": 3})');
});

test('validator: Save results table and Graph from results table inside a loop warn, with the fix', () => {
  for (const type of ['out.table.save', 'out.plot.table']) {
    const wf = W({ n1: ['start', { project: 'P' }], n2: ['flow.range', {}, { label: 'Dispatch (MW)' }], n3: ['out.table.add', { cols: [] }], n4: [type, FILL[type] || {}] },
      ['n1>n2', 'n2.body>n3', 'n3>n4']);
    const r = gen(wf, type + ' in loop');
    const p = r.problems.find(x => x.level === 'warning' && /runs on every pass of Dispatch \(MW\) and writes a file each time\. To save once, connect it to After all passes of Dispatch \(MW\)\./.test(x.msg));
    ok(p, ptext(r));
    eq(p.fix && p.fix.op && p.fix.op.op, 'moveToDone');
    eq(p.fix.op.loopId, 'n2');
    const after = gen(W({ n1: ['start', { project: 'P' }], n2: ['flow.range', {}], n3: ['out.table.add', { cols: [] }], n4: [type, FILL[type] || {}] }, ['n1>n2', 'n2.body>n3', 'n2.done>n4']), type + ' after loop');
    ok(!hasP(after, 'warning', /writes a file each time/), ptext(after));
  }
});

test('validator: Report this try outside a search is an error; inside a loop inside a search it reports to the search', () => {
  const r = gen(W({ n1: ['start', { project: 'P' }], n2: ['opt.report', {}], n3: ['val.number', { value: 1 }] }, ['n1>n2'], ['n3.value>n2.score']), 'report outside');
  ok(hasP(r, 'error', /Report this try only works inside Optimise or Find limit/), ptext(r));
  has(mainBody(r.code), 'pass  # Report this try only works');
  const r2 = gen(W({ n1: ['start', { project: 'P' }], n2: ['opt.limit', {}], n3: ['flow.repeat', { times: 2 }], n4: ['opt.report', {}], n5: ['val.bool', {}] },
    ['n1>n2', 'n2.body>n3', 'n3.body>n4'], ['n5.value>n4.pass']), 'report in loop in search');
  eq(unexpected(r2), [], ptext(r2));
  has(mainBody(r2.code), 'trial.report(score=None, ok=True)');
  const r3 = gen(W({ n1: ['start', { project: 'P' }], n2: ['opt.limit', {}], n4: ['opt.report', { passIs: 'no' }], n5: ['val.text', { value: 'FALSE' }] },
    ['n1>n2', 'n2.body>n4'], ['n5.value>n4.pass']), 'report opposite');
  has(mainBody(r3.code), 'trial.report(score=None, ok=logic("not", "FALSE"))');
  const r4 = gen(W({ n1: ['start', { project: 'P' }], n2: ['opt.limit', {}], n4: ['opt.report', {}] }, ['n1>n2', 'n2.body>n4']), 'report nothing wired');
  ok(hasP(r4, 'todo', /Connect a Score or a Pass to Report this try/), ptext(r4));
});

test('validator: NO DATA handling is in the code: Pass only on True, None takes Fail and logs', () => {
  const wf = W({ n1: ['start', { project: 'P' }], n2: ['chk.verdict', { op: 'ge', limit: 59 }], n3: ['flow.log', { text: 'ok' }] }, ['n1>n2', 'n2.pass>n3']);
  const r = gen(wf, 'verdict unwired');
  ok(hasP(r, 'todo', /Connect a value to Value of Pass \/ fail/), ptext(r));
  const b = mainBody(r.code);
  has(b, 'pass_fail = verdict(None, "ge", 59, 0)');
  has(b, 'if pass_fail.ok is None:');
  has(b, 'NO DATA (');
  has(b, 'if not (pass_fail.ok is True):');
  has(b, 'log("Pass / fail did not pass. The workflow ends here.", "warn")');
});

test('validator: limits, variables, files and settling targets that cannot work', () => {
  const g1 = gen(W({ n1: ['start', { project: 'P' }], n2: ['chk.limit', { lo: 2, hi: 1 }], n3: ['val.number', {}] }, ['n1>n2'], ['n3.value>n2.x']), 'limit swapped');
  ok(hasP(g1, 'error', /the lowest allowed value \(2\) is above the highest \(1\)/), ptext(g1));
  const g2 = gen(W({ n1: ['start', { project: 'P' }], n2: ['chk.limit', {}], n3: ['val.number', {}] }, ['n1>n2'], ['n3.value>n2.x']), 'limit none');
  ok(hasP(g2, 'todo', /Give Check limits a lowest or a highest allowed value/), ptext(g2));
  const g3 = gen(W({ n1: ['start', { project: 'P' }], n2: ['opt.optimise', { vars: [{ id: 'v1', name: 'x', lower: 3, upper: 1 }] }], n3: ['opt.report', {}] }, ['n1>n2', 'n2.body>n3'], ['n2.v1>n3.score']), 'optimise bounds');
  ok(hasP(g3, 'error', /the lowest value \(3\) must be below the highest \(1\)/), ptext(g3));
  const g4 = gen(W({ n1: ['start', { project: 'P' }], n2: ['data.read', { path: 'C:\\old\\cases.xls' }] }, ['n1>n2']), 'read xls');
  ok(hasP(g4, 'error', /an old \.xls file/), ptext(g4));
  const g5 = gen(W({ n1: ['start', { project: 'P' }], n2: ['data.read', {}] }, ['n1>n2']), 'read no file');
  ok(hasP(g5, 'todo', /Attach the data file for Read table from file/), ptext(g5));
  // A file attached in the page: the script still reads it by name, and the generator now knows
  // the table's columns, so a column field can offer them.
  const g5b = gen(W({ n1: ['start', { project: 'P' }], n2: ['data.read', { table: 'Cases', path: 'cases.csv', src: { name: 'cases.csv', size: 40, sheet: '', sheets: [], cols: ['Case', 'P (MW)'], rows: 2, sig: '|rows|1|0' } }] }, ['n1>n2']), 'read attached');
  ok(!(g5b.problems || []).some(p => p.level === 'error' || p.level === 'todo'), ptext(g5b));
  eq(g5b.tables.Cases.columns, ['Case', 'P (MW)'], 'attached file columns');
  ok(g5b.tables.Cases.file === true && g5b.tables.Cases.read === true, 'attached file table is marked read');
  // The columns travel in the .py (they are small and Open needs them); the file's own bytes
  // never do, so a script is code and not somebody's spreadsheet.
  const pfb1 = (g5b.code.match(/^# PFB1 .*$/m) || [""])[0];
  has(pfb1, '"cols"', 'the PFB1 line keeps the columns');
  hasNot(pfb1, '"files"', 'the PFB1 line carries no attached file');
  const g6 = gen(W({ n1: ['start', { project: 'P' }], n2: ['data.read', { path: 'C:\\Studies\\cases.xlsx' }, { pin: ['path'] }] }, ['n1>n2']), 'read pinned');
  has(g6.code, '\nCASES_TABLE_FILE = r"C:\\Studies\\cases.xlsx"\n'.replace('CASES_TABLE_FILE', Object.keys(g6.settingsMap).find(k => g6.settingsMap[k][0] === 'n2')));
  has(g6.code, 'preflight(["openpyxl"])');
  const g7 = gen(W({ n1: ['start', { project: 'P' }], n2: ['fixa.synth', {}], n3: ['sig.settle', { reference: 'given' }], n4: ['out.table.add', { cols: [{ id: 'c1', name: 'T' }] }] }, ['n1>n4'], ['n2.series>n3.series', 'n3.time>n4.c1']), 'settle given');
  ok(hasP(g7, 'todo', /Give the final value Settling time should settle around/), ptext(g7));
  const g8 = gen(W({ n1: ['start', { project: 'P' }], n2: ['fixa.synth', {}], n3: ['sig.nadir', { floorBelow: 1, uflsBelow: 1 }], n4: ['out.table.add', { cols: [{ id: 'c1', name: 'N' }] }] }, ['n1>n4'], ['n2.series>n3.series', 'n3.nadir>n4.c1']), 'nadir floor');
  ok(hasP(g8, 'warning', /the collapse floor \(1 Hz below nominal\) is not below the UFLS level/), ptext(g8));
});

test('packages: graphs need matplotlib, Excel pandas + openpyxl, Optimise scipy (not for a grid)', () => {
  const pre = (r) => (/preflight\((\[[^\]]*\])\)/.exec(r.code) || [])[1];
  const plot = gen(around('out.plot.series', {}), 'pkg plot');
  eq(pre(plot), '["matplotlib"]');
  const xl = gen(W({ n1: ['start', { project: 'P' }], n2: ['out.table.save', { fmt: 'xlsx' }] }, ['n1>n2']), 'pkg xlsx');
  eq(pre(xl), '["openpyxl", "pandas"]');
  const csv = gen(W({ n1: ['start', { project: 'P' }], n2: ['out.table.save', {}] }, ['n1>n2']), 'pkg csv');
  eq(pre(csv), '[]');
  const de = gen(around('opt.optimise', FILL['opt.optimise']), 'pkg de');
  ok(/"scipy"/.test(pre(de)), pre(de));
  const grid = gen(around('opt.optimise', { ...FILL['opt.optimise'], method: 'grid' }), 'pkg grid');
  ok(!/scikit|scipy/.test(pre(grid)), pre(grid));
  ok(!/scikit/.test(de.code.split('# ==== HELPERS')[0]), 'never scikit-optimize in preflight');
});

test('every pass on one graph: real codegen falls back to one graph per pass and says so; with cx.afterStruct it draws after the loop', () => {
  const wf = W({ n1: ['start', { project: 'P' }], n2: ['flow.range', {}, { label: 'Trip (MW)' }], n3: ['fixa.synth', {}], n4: ['out.plot.series', { collect: 'loop', title: 'All passes' }] },
    ['n1>n2', 'n2.body>n4'], ['n2.value>n3.mw', 'n3.series>n4.l1']);
  const real = gen(wf, 'collect real');
  if (HAS_AFTER) {
    eq(unexpected(real), [], ptext(real));
  } else {
    ok(hasP(real, 'warning', /cannot draw every pass on one graph yet, so it draws one graph per pass/), ptext(real));
    has(mainBody(real.code), 'plot_series([freq_hz]');
  }
  const pat = gen(wf, 'collect patched', { patched: true });
  eq(unexpected(pat), [], ptext(pat));
  const b = mainBody(pat.code);
  has(b, 'collect_series("n4", [freq_hz])');
  const i = b.indexOf('draw_collected("n4", title="All passes"');
  ok(i > b.indexOf('ctx_pop()') && i > 0, 'draw_collected after the loop');
  ok(/\n        draw_collected\(/.test(b), 'at the loop\'s own indentation');
});

// =============================================================================================
// (b) Execution, offline

test('run: 39-bus G 10 trip (real trace): COLLAPSE still falling at 59.4517 Hz / 60 s, UFLS UNDEFINED, FALSE when extended to 60 s, settles within 10 mHz at about 29.4 s, RoCoF', () => {
  const out = outDir('r39');
  const wf = W({
    n1: START(out), n2: ['fixa.csvseries', { path: FIX39, label: 'Bus 16 m:fehz', unit: 'Hz', events: '1.0:G 10 trip' }],
    n3: ['sig.nadir', {}], n4: ['sig.nadir', { extendTo: 60 }, { label: 'Nadir extended' }],
    n5: ['sig.settle', { bandMode: 'abs', band: 0.01, hold: 1 }], n6: ['sig.rocof', {}], n7: ['sig.despike', {}],
    n8: ['out.table.add', { table: 'R39', cols: ['Verdict', 'UFLS', 'Minimum', 'Min time', 'Still', 'Turned', 'Nadir', 'UFLS ext', 'Settles', 'At', 'RoCoF', 'Basis', 'Spikes'].map((name, i) => ({ id: 'c' + (i + 1), name })) }],
    n9: ['out.plot.series', { title: '39-bus G 10 trip', ylabel: 'Frequency', limits: [{ id: 'h1', value: 59, label: 'UFLS 59 Hz' }] }],
    n10: ['out.table.save', { table: 'R39', fmt: 'both' }],
    n11: ['out.series.save', { stem: 'bus16' }],
  }, ['n1>n8', 'n8>n9', 'n9>n10', 'n10>n11'], [
    'n2.series>n3.series', 'n2.series>n4.series', 'n2.series>n5.series', 'n2.series>n6.series', 'n2.series>n7.series', 'n3.verdict>n6.verdict',
    'n3.verdict>n8.c1', 'n3.ufls>n8.c2', 'n3.minimum>n8.c3', 'n3.min_time>n8.c4', 'n3.still>n8.c5', 'n3.turned>n8.c6', 'n3.nadir>n8.c7', 'n4.ufls>n8.c8',
    'n5.settles>n8.c9', 'n5.at>n8.c10', 'n6.rocof>n8.c11', 'n6.basis>n8.c12', 'n7.n>n8.c13',
    'n2.series>n9.l1', 'n3.minimum>n9.mark', 'n7.note>n9.note', 'n2.series>n11.l1',
  ], '39 bus nadir');
  const res = run(wf, 'run 39-bus');
  const [row] = rowsOf(res, 'R39');
  ok(row, JSON.stringify(res.tables));
  eq([row.Verdict, row.UFLS, row.Still, row.Turned, row.Nadir], ['COLLAPSE', 'UNDEFINED', true, false, null]);
  near(row.Minimum, 59.4517, 1e-4, 'minimum');
  near(row['Min time'], 60, 1e-9, 'minimum time');
  eq(row['UFLS ext'], 'FALSE');
  eq(row.Settles, true);
  ok(row.At > 28.5 && row.At < 30.5, 'settled at ' + row.At);
  ok(row.RoCoF < 0 && row.Basis === 'window', `RoCoF ${row.RoCoF} ${row.Basis}`);
  eq(row.Spikes, 0);
  has(res.gen.code, 'verdict=nadir_result,');
  eq(pngs(res).length, 1, res.files.join('\n'));
  ok(isPng(pngs(res)[0]));
  eq(res.files.filter(f => /R39\.(csv|xlsx)$/.test(f)).length, 2, res.files.join('\n'));
  eq(csvs(res, 'series').length, 1, 'time series CSV');
  const head = fs.readFileSync(csvs(res, 'series')[0], 'utf8').split(/\r?\n/)[0];
  has(head, 'Time (s)');
});

test('run: Nine-bus fault (real trace): LVRT curve passes, recovery above 0.9 p.u., value before the fault', () => {
  const out = outDir('r9');
  const wf = W({
    n1: START(out, { fNominal: 'auto' }), n2: ['fixa.csvseries', { path: FIX9, label: 'Bus 7 m:u1', unit: 'p.u.', events: '1.0:fault, 1.1:clear' }],
    n3: ['chk.limit', { against: 'curve', x0: 1.0, after: 1.0 }, { label: 'LVRT' }],
    n4: ['sig.cross', { level: 0.9, after: 1.1, hold: 0.1 }], n5: ['sig.at', { t: 0.5 }],
    n6: ['chk.limit', { lo: 1.0, hi: 1.05 }, { label: 'Pre-fault voltage' }],
    n7: ['out.table.add', { table: 'FRT', cols: ['LVRT', 'Margin', 'Found', 'Time', 'U0', 'Pre'].map((name, i) => ({ id: 'c' + (i + 1), name })) }],
    n8: ['flow.log', { text: 'LVRT FAILED' }],
  }, ['n1>n3', 'n3.pass>n6', 'n3.fail>n8', 'n6.pass>n7'], [
    'n2.series>n3.x', 'n2.series>n4.series', 'n2.series>n5.series', 'n5.value>n6.x',
    'n3.text>n7.c1', 'n3.margin>n7.c2', 'n4.found>n7.c3', 'n4.time>n7.c4', 'n5.value>n7.c5', 'n6.text>n7.c6',
  ], 'Nine bus FRT');
  const res = run(wf, 'run nine-bus');
  const [row] = rowsOf(res, 'FRT');
  ok(row, res.stdout.slice(-2000));
  eq([row.LVRT, row.Found, row.Pre], ['PASS', true, 'PASS']);
  ok(row.Margin >= 0, 'margin ' + row.Margin);
  ok(row.Time > 1.1 && row.Time < 2.0, 'recovery time ' + row.Time);
  near(row.U0, 1.025769, 1e-6, 'value before the fault');
  hasNot(res.stdout, 'LVRT FAILED');
});

function sweepWorkflow(out, collect) {
  return W({
    n1: START(out), n2: ['flow.range', { from: 100, to: 300, step: 100 }, { label: 'Trip (MW)' }], n3: ['fixa.synth', {}], n4: ['sig.nadir', {}],
    n5: ['chk.verdict', { op: 'ge', limit: 59.2 }, { label: 'Nadir check' }],
    n6: ['out.table.add', { table: 'Sweep', cols: [{ id: 'c1', name: 'UFLS' }, { id: 'c2', name: 'Check' }] }],
    n7: ['out.table.save', { table: 'Sweep' }],
    n8: ['out.plot.series', { title: 'Frequency', ylabel: 'Frequency' }],
    n9: ['out.plot.series', { collect, title: 'Every pass', limits: [{ id: 'h1', value: 59, label: 'UFLS' }] }],
    n10: ['out.table.column', { table: 'Sweep', col: 'Trip (MW)', pick: 'min', of: 'Nadir (Hz)' }],
    n11: ['flow.log', { text: 'worst case {w} MW' }],
  }, ['n1>n2', 'n2.body>n5', 'n5.pass>n6', 'n6>n8', 'n8>n9', 'n2.done>n7', 'n7>n11'], [
    'n2.value>n3.mw', 'n3.series>n4.series', 'n4.nadir>n5.value', 'n4.ufls>n6.c1', 'n5.text>n6.c2', 'n4.nadir>n6.add',
    'n3.series>n8.l1', 'n4.nadir>n8.mark', 'n3.series>n9.l1', 'n10.value>n11.w',
  ], 'Sweep test');
}

test(`run: a range sweep with a guard skip: Status column and a skip row in one CSV saved after the loop; graphs per pass and every pass on one graph (${patchNote})`, () => {
  const out = outDir('sweep');
  const res = run(sweepWorkflow(out, 'loop'), 'run sweep', { patched: true });
  const rows = rowsOf(res, 'Sweep');
  eq(rows.length, 3, JSON.stringify(rows));
  eq(colsOf(res, 'Sweep'), ['Trip (MW)', 'Status', 'UFLS', 'Check', 'Nadir (Hz)']);
  eq(rows.map(r => r['Trip (MW)']), [100, 200, 300]);
  eq(rows.map(r => r.Status), ['OK', 'OK', 'Nadir check did not pass']);
  eq(rows.map(r => r.Check), ['PASS', 'PASS', undefined]);
  ok(rows[0]['Nadir (Hz)'] > rows[1]['Nadir (Hz)'] && rows[1]['Nadir (Hz)'] >= 59.2, JSON.stringify(rows));
  const tableCsv = csvs(res).filter(f => /Sweep/.test(path.basename(f)));
  eq(tableCsv.length, 1, 'one CSV: ' + res.files.join('\n'));
  const text = fs.readFileSync(tableCsv[0], 'utf8');
  has(text.split(/\r?\n/)[0], 'Status');
  has(text, 'Nadir check did not pass');
  hasNot(res.stdout, 'has rows that were not saved');
  const p = pngs(res);
  eq(p.length, 3, p.join('\n'));
  ok(p.every(isPng), 'PNG files');
  eq(p.filter(f => /Every_pass/.test(path.basename(f))).length, 1, 'one graph with every pass');
  has(res.stdout, 'worst case 200 MW');
});

test('run: the same sweep with the real codegen: every pass on one graph falls back to one graph per pass (until Requests R1)', () => {
  const out = outDir('sweep_real');
  const res = run(sweepWorkflow(out, 'loop'), 'run sweep real');
  const p = pngs(res);
  if (HAS_AFTER) eq(p.length, 3, p.join('\n'));
  else eq(p.length, 4, p.join('\n'));
  eq(rowsOf(res, 'Sweep').length, 3);
});

test('run: a 3D graph, a heat map and a graph from the table of a 2-D sweep; Table column picks the worst row', () => {
  const out = outDir('grid');
  const wf = W({
    n1: START(out), n2: ['flow.range', { from: 1, to: 3, step: 1 }, { label: 'P (MW)' }], n3: ['flow.range', { from: 1, to: 3, step: 1 }, { label: 'Q (Mvar)' }],
    n4: ['math.formula', { expr: 'p * q + p' }], n5: ['out.table.add', { table: 'Grid', cols: [{ id: 'c1', name: 'Z' }] }],
    n6: ['out.plot.3d', { title: '3D', xlabel: 'P', xunit: 'MW', ylabel: 'Q', yunit: 'Mvar', zlabel: 'Z' }],
    n7: ['out.table.column', { table: 'Grid', col: 'P (MW)' }], n8: ['out.table.column', { table: 'Grid', col: 'Q (Mvar)' }], n9: ['out.table.column', { table: 'Grid', col: 'Z' }],
    n10: ['out.plot.heatmap', { title: 'Heat', zlabel: 'Z' }], n11: ['out.plot.table', { table: 'Grid', x: 'P (MW)', ys: 'Z', group: 'Q (Mvar)', title: 'Z against P' }],
    n12: ['out.table.column', { table: 'Grid', col: 'Q (Mvar)', pick: 'max', of: 'Z' }], n13: ['flow.log', { text: 'worst Q {q} at Z {z}' }],
    n14: ['out.plot.xy', { kind: 'scatter', title: 'XY' }], n15: ['out.table.save', { table: 'Grid' }],
  }, ['n1>n2', 'n2.body>n3', 'n3.body>n5', 'n2.done>n6', 'n6>n10', 'n10>n11', 'n11>n13', 'n13>n14', 'n14>n15'], [
    'n2.value>n4.p', 'n3.value>n4.q', 'n4.value>n5.c1', 'n7.value>n6.x', 'n8.value>n6.y', 'n9.value>n6.z',
    'n7.value>n10.x', 'n8.value>n10.y', 'n9.value>n10.z', 'n12.value>n13.q', 'n12.of>n13.z', 'n7.value>n14.x', 'n9.value>n14.l1',
  ], 'Grid test');
  const res = run(wf, 'run grid');
  eq(rowsOf(res, 'Grid').length, 9);
  const names = pngs(res).map(f => path.basename(f));
  eq(names.length, 4, names.join(', '));
  ok(pngs(res).every(isPng));
  for (const k of ['3D', 'Heat', 'Z_against_P', 'XY']) ok(names.some(n => n.startsWith(k)), k + ' in ' + names.join(', '));
  has(res.stdout, 'worst Q 3 at Z 12');
});

test('run: Find limit on a pass / fail rule converges to the known threshold; the convergence curve is drawn', () => {
  const out = outDir('limit');
  const wf = W({
    n1: START(out), n2: ['opt.limit', { lower: 0, upper: 200, tol: 0.5, maxSteps: 30, name: 'Dispatch (MW)' }], n3: ['math.compare', { op: 'le', b: 137.5 }],
    n4: ['opt.report', {}], n5: ['out.plot.conv', { title: 'Bisection' }], n6: ['flow.log', { text: 'LIMIT {lim} {st} {found}' }],
    n7: ['out.table.add', { table: 'Tries', cols: [{ id: 'c1', name: 'Pass' }] }],
  }, ['n1>n2', 'n2.body>n4', 'n4>n7', 'n2.done>n5', 'n5>n6'], ['n2.value>n3.a', 'n3.value>n4.pass', 'n3.value>n7.c1', 'n2.history>n5.history', 'n2.limit>n6.lim', 'n2.status>n6.st', 'n2.found>n6.found'], 'Limit test');
  const res = run(wf, 'run limit');
  const m = /LIMIT ([\d.]+) (\S+) (\S+)/.exec(res.stdout);
  ok(m, res.stdout.slice(-2000));
  ok(Number(m[1]) <= 137.5 && Number(m[1]) > 137.0, 'limit ' + m[1]);
  eq([m[2], m[3]], ['DONE', 'Yes']);
  const tries = rowsOf(res, 'Tries');
  ok(tries.length >= 9 && tries.every(r => typeof r['Dispatch (MW)'] === 'number'), JSON.stringify(tries.slice(0, 3)));
  eq(pngs(res).length, 1);
  ok(isPng(pngs(res)[0]));
});

test('run: Find limit on the headroom rule (UFLS FALSE passes, Report this try with "the opposite") finds where UFLS starts', () => {
  const out = outDir('headroom');
  const wf = W({
    n1: START(out), n2: ['opt.limit', { lower: 100, upper: 400, tol: 1, maxSteps: 20 }, { label: 'Trip (MW)' }], n3: ['fixa.synth', {}], n4: ['sig.nadir', {}],
    n5: ['opt.report', { passIs: 'no' }], n6: ['flow.log', { text: 'HEADROOM {lim} {st}' }],
  }, ['n1>n2', 'n2.body>n5', 'n2.done>n6'], ['n2.value>n3.mw', 'n3.series>n4.series', 'n4.ufls>n5.pass', 'n2.limit>n6.lim', 'n2.status>n6.st'], 'Headroom test');
  const res = run(wf, 'run headroom');
  const m = /HEADROOM ([\d.]+) (\S+)/.exec(res.stdout);
  ok(m, res.stdout.slice(-2000));
  eq(m[2], 'DONE');
  near(Number(m[1]), 284.1, 1.5, 'UFLS starts near 284 MW');
});

test('run: Optimise finds the minimum of a quadratic (differential evolution, and a grid without scipy)', () => {
  for (const [method, extra, tolXY] of [['de', { maxTries: 120 }, 0.3], ['grid', { gridSteps: 9, maxTries: 100 }, 0.3]]) {
    const out = outDir('opt_' + method);
    const wf = W({
      n1: START(out), n2: ['opt.optimise', { vars: [{ id: 'v1', name: 'x', lower: -5, upper: 5 }, { id: 'v2', name: 'y', lower: -5, upper: 5 }], method, ...extra }],
      n3: ['math.formula', { expr: '(x - 1.5)**2 + (y + 2)**2 + 3' }], n4: ['opt.report', {}],
      n5: ['out.table.add', { table: 'Best', ctx: false, cols: [{ id: 'c1', name: 'x' }, { id: 'c2', name: 'y' }, { id: 'c3', name: 'score' }, { id: 'c4', name: 'found' }] }],
      n6: ['out.plot.conv', {}],
    }, ['n1>n2', 'n2.body>n4', 'n2.done>n5', 'n5>n6'], ['n2.v1>n3.x', 'n2.v2>n3.y', 'n3.value>n4.score', 'n2.best_v1>n5.c1', 'n2.best_v2>n5.c2', 'n2.score>n5.c3', 'n2.found>n5.c4', 'n2.history>n6.history'], 'Optimise ' + method);
    const res = run(wf, 'run optimise ' + method);
    const [b] = rowsOf(res, 'Best');
    ok(b && b.found === true, JSON.stringify(res.tables));
    near(b.x, method === 'grid' ? 1.25 : 1.5, tolXY, method + ' x');
    near(b.y, method === 'grid' ? -2.5 : -2, tolXY, method + ' y');
    ok(b.score < (method === 'grid' ? 3.32 : 3.1), method + ' score ' + b.score);
    eq(pngs(res).length, 1);
    if (method === 'grid') has(res.stdout, 'STUB preflight [\'matplotlib\']');
    else has(res.stdout, 'scipy');
  }
});

test('run: Read table from file reads a CSV (decimal comma, ";") and an Excel sheet (one case per column); For each item loops their rows', () => {
  const out = outDir('read');
  fs.writeFileSync(path.join(out, 'cases.csv'), '\ufeffCase;P (MW);Run?\nA;100,5;yes\nB;;no\nC;250;yes\n;;\n', 'utf8');
  const xl = path.join(out, 'cases.xlsx');
  const py = spawnSync('python', ['-c', [
    'import openpyxl, sys', 'wb = openpyxl.Workbook()', 'ws = wb.active', 'ws.title = "Notes"', 'ws2 = wb.create_sheet("Dispatch")',
    'for r in [["Case", "Low", "Mid", "High"], ["P (MW)", 100, 200.5, 300], ["Code", "007", "C1", None]]: ws2.append(r)', 'wb.save(sys.argv[1])'].join('\n'), xl], { encoding: 'utf8' });
  ok(py.status === 0, py.stderr);
  const wf = W({
    n1: START(out), n2: ['data.read', { table: 'Cases', path: 'cases.csv', decimalComma: true }],
    n3: ['flow.list', { source: 'table', table: 'Cases', cols: [{ id: 'c1', name: 'Case', type: 'text' }, { id: 'c2', name: 'P (MW)', type: 'num' }], runCol: 'Run?' }, { label: 'Case' }],
    n4: ['out.table.add', { table: 'Out', cols: [{ id: 'c1', name: 'P' }] }],
    n5: ['data.read', { table: 'Disp', path: xl, sheet: 'Dispatch', layout: 'columns' }],
    n6: ['flow.list', { source: 'table', table: 'Disp', cols: [{ id: 'c1', name: 'Case', type: 'text' }, { id: 'c2', name: 'P (MW)', type: 'num' }, { id: 'c3', name: 'Code', type: 'text' }] }, { label: 'Dispatch case' }],
    n7: ['out.table.add', { table: 'Out2', cols: [{ id: 'c1', name: 'P' }, { id: 'c2', name: 'Code' }] }],
    n8: ['flow.log', { text: 'read {n} rows into {t}' }],
  }, ['n1>n2', 'n2>n8', 'n8>n3', 'n3.body>n4', 'n3.done>n5', 'n5>n6', 'n6.body>n7'], ['n3.c2>n4.c1', 'n6.c2>n7.c1', 'n6.c3>n7.c2', 'n2.n>n8.n', 'n2.name>n8.t'], 'Read test');
  const res = run(wf, 'run read', { cwd: out });
  has(res.stdout, 'read 3 rows into Cases');
  eq(rowsOf(res, 'Out').map(r => [r.Case, r.P]), [['A', 100.5], ['C', 250]]);
  eq(rowsOf(res, 'Out2').map(r => [r['Dispatch case'], r.P, r.Code]), [['Low', 100, '007'], ['Mid', 200.5, 'C1'], ['High', 300, '']]);
  eq(rowsOf(res, 'Cases').length, 3);
  ok(!res.files.some(f => /Cases|Disp/.test(path.basename(f))), 'the tables read are not written back: ' + res.files.join(', '));
  has(res.stdout, 'STUB preflight [\'openpyxl\']');
});

test('run: Read table from file with a missing file stops the workflow cleanly with a plain message', () => {
  const out = outDir('read_missing');
  const res = run(W({ n1: START(out), n2: ['data.read', { path: 'nothere.csv' }], n3: ['flow.log', { text: 'not reached' }] }, ['n1>n2', 'n2>n3']), 'run read missing', { cwd: out });
  has(res.stdout, 'Stopped: Read table from file: cannot find');
  hasNot(res.stdout, 'not reached');
  has(res.stdout, 'STUB finish');
});

test('run: NO DATA: an empty curve gives NO DATA, Pass / fail and Check limits take Fail and log it', () => {
  const out = outDir('nodata');
  const wf = W({
    n1: START(out), n2: ['fixa.empty', {}], n3: ['sig.nadir', {}], n4: ['chk.verdict', { op: 'ge', limit: 59 }],
    n5: ['flow.log', { text: 'VERDICT PASSED' }], n6: ['flow.log', { text: 'VERDICT FAILED {t} {p}' }],
    n7: ['chk.limit', { lo: 59 }], n8: ['flow.log', { text: 'LIMIT PASSED' }], n9: ['flow.log', { text: 'LIMIT FAILED {t}' }],
    n10: ['sig.rocof', {}], n11: ['sig.settle', {}], n12: ['out.table.add', { table: 'ND', cols: ['Verdict', 'RoCoF', 'Settles', 'UFLS'].map((name, i) => ({ id: 'c' + (i + 1), name })) }],
    n13: ['out.plot.series', {}],
  }, ['n1>n4', 'n4.pass>n5', 'n4.fail>n6', 'n6>n7', 'n7.pass>n8', 'n7.fail>n9', 'n9>n12', 'n12>n13'], [
    'n2.series>n3.series', 'n3.nadir>n4.value', 'n4.text>n6.t', 'n4.ok>n6.p', 'n3.minimum>n7.x', 'n7.text>n9.t',
    'n2.series>n10.series', 'n2.series>n11.series', 'n3.verdict>n12.c1', 'n10.rocof>n12.c2', 'n11.settles>n12.c3', 'n3.ufls>n12.c4', 'n2.series>n13.l1',
  ], 'No data');
  const res = run(wf, 'run nodata');
  has(res.stdout, 'WARNING Pass / fail: NO DATA (');
  has(res.stdout, 'so it takes Fail.');
  has(res.stdout, 'VERDICT FAILED NO DATA');
  has(res.stdout, 'WARNING Check limits: NO DATA (');
  has(res.stdout, 'LIMIT FAILED NO DATA');
  hasNot(res.stdout, 'PASSED');
  eq(rowsOf(res, 'ND').map(r => [r.Verdict, r.RoCoF, r.Settles, r.UFLS]), [['NO DATA', null, null, 'UNDEFINED']]);
  eq(pngs(res).length, 0, 'nothing to draw: no PNG, no error');
  ok(res.code === 0);
});

test('run: a sweep inside a search: Add row in the tries keeps every try, Save after the search writes one file', () => {
  const out = outDir('search_rows');
  const wf = W({
    n1: START(out), n2: ['opt.limit', { lower: 0, upper: 8, tol: 1 }, { label: 'Level' }], n3: ['flow.range', { from: 1, to: 2, step: 1 }, { label: 'Case' }],
    n4: ['math.compare', { op: 'le', b: 5 }], n5: ['opt.report', {}], n6: ['out.table.add', { table: 'T', cols: [{ id: 'c1', name: 'ok' }] }], n7: ['out.table.save', { table: 'T' }],
  }, ['n1>n2', 'n2.body>n3', 'n3.body>n5', 'n5>n6', 'n2.done>n7'], ['n2.value>n4.a', 'n4.value>n5.pass', 'n4.value>n6.c1'], 'Search rows');
  const res = run(wf, 'run search rows');
  const rows = rowsOf(res, 'T');
  ok(rows.length >= 6 && rows.every(r => 'Level' in r && 'Case' in r), JSON.stringify(rows.slice(0, 4)));
  eq(csvs(res).filter(f => /^T/.test(path.basename(f))).length, 1);
});

// =============================================================================================
// (a) Compile every generated script

test('compile: every generated script compiles (python -m py_compile)', () => {
  const list = path.join(GEN_DIR, '_compile_list.txt');
  fs.writeFileSync(list, toCompile.map(t => t.file).join('\n'));
  const py = 'import py_compile, sys\nbad = 0\nfor f in open(sys.argv[1], encoding="utf-8").read().split("\\n"):\n    try:\n        py_compile.compile(f, doraise=True)\n    except py_compile.PyCompileError as e:\n        bad += 1\n        print("BAD", f, str(e)[:400])\nprint("COMPILED", bad)';
  const r = spawnSync('python', ['-c', py, list], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const bad = (r.stdout || '').split('\n').filter(l => l.startsWith('BAD'));
  eq(bad, [], 'scripts that do not compile');
  has(r.stdout, 'COMPILED 0');
});

test('runtime: the requested helpers pass the runtime\'s static audit (loader.check) with the real files', () => {
  const py = [
    'import os, sys', `sys.path.insert(0, ${JSON.stringify(path.join(BUILDER, '_audit', 'runtime', 'live'))})`, 'import loader',
    // Once the requested sections are in the runtime (base.py), audit the real files only.
    `extra = [os.path.relpath(${JSON.stringify(path.join(HERE, 'requested_runtime.py'))}, loader.RUNTIME)]`,
    'base = open(os.path.join(loader.RUNTIME, "base.py"), encoding="utf-8").read()',
    'files = loader.FILES + ([] if "# @helper table_pick" in base else extra)',
    'lib = loader.parse(files)', 'probs = [p for p in loader.check(lib, files) if "requested_runtime" in p or "table_pick" in p or "read_table" in p]',
    'probs += [p for p in loader.each_section_alone(lib) if "table_pick" in p or "read_table" in p]', 'print("AUDIT", len(probs))', 'for p in probs: print("PROBLEM", p)'].join('\n');
  const r = spawnSync('python', ['-c', py], { encoding: 'utf8' });
  has(r.stdout, 'AUDIT 0', r.stdout + r.stderr);
});

// =============================================================================================
// (c) Live: one end-to-end run on the 39-bus sandbox

if (LIVE) {
  test('live: 39-bus sandbox: Run RMS simulation (Bus 16 m:fehz) > Frequency nadir > Add row > Save; sandbox left as found', () => {
    const N39 = '39 Bus New England System (Builder test)';
    const out = outDir('live39');
    const wf = W({
      n1: ['start', { project: N39, outputDir: out, fNominal: '60' }],
      n2: ['pf.evt.trip', { el: { cls: 'ElmSym', name: 'G 10', match: 'one' }, t: 1.0 }],
      n3: ['pf.rms', { tstop: 20, tstart: -0.1, record: [{ id: 'r1', cls: 'ElmTerm', name: 'Bus 16', var: 'm:fehz', combine: 'none' }] }],
      n4: ['sig.nadir', {}], n5: ['sig.rocof', {}],
      n6: ['out.table.add', { table: 'Live', cols: ['Verdict', 'UFLS', 'Minimum', 'Min time', 'Still', 'RoCoF', 'Basis'].map((name, i) => ({ id: 'c' + (i + 1), name })) }],
      n7: ['out.table.save', { table: 'Live' }],
      n8: ['out.plot.series', { title: '39-bus G 10 trip', ylabel: 'Frequency' }],
    }, ['n1>n2', 'n2>n3', 'n3.ok>n6', 'n6>n8', 'n8>n7'], [
      'n3.r1>n4.series', 'n3.r1>n5.series', 'n4.verdict>n5.verdict', 'n2.t>n4.t_event', 'n2.t>n5.t_event',
      'n4.verdict>n6.c1', 'n4.ufls>n6.c2', 'n4.minimum>n6.c3', 'n4.min_time>n6.c4', 'n4.still>n6.c5', 'n5.rocof>n6.c6', 'n5.basis>n6.c7', 'n3.r1>n8.l1', 'n4.minimum>n8.mark',
    ], 'Live 39-bus nadir');
    const r = gen(wf, 'live 39-bus', { runtime: { ...REAL_ALL, 'zz_requested.py': REQ_GEN } });
    eq(r.problems.filter(p => p.level !== 'warning'), [], ptext(r));
    let res;
    for (let k = 0; k < 3; k++) {
      res = spawnSync('python', [PFRUN, LIVE_WRAP, r.file], { cwd: path.dirname(LIVE_WRAP), encoding: 'utf8', timeout: 1200000, maxBuffer: 256 << 20, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
      if (res.status !== 3) break;
    }
    const outText = (res.stdout || '') + (res.stderr || '');
    fs.writeFileSync(path.join(out, 'live_stdout.txt'), outText);
    has(outText, 'LIVE-EXIT 0', outText.slice(-3000));
    has(outText, 'LIVE-AUDIT OK', outText.slice(-3000));
    const rd = (/LIVE-RUNDIR (.+)/.exec(outText) || [])[1];
    ok(rd && fs.existsSync(rd.trim()), 'run folder ' + rd);
    const csv = fs.readdirSync(rd.trim()).filter(f => /^Live.*\.csv$/.test(f));
    eq(csv.length, 1, 'one CSV');
    const lines = fs.readFileSync(path.join(rd.trim(), csv[0]), 'utf8').replace(/^\ufeff/, '').trim().split(/\r?\n/);
    const head = lines[0].split(','), vals = lines[1].split(',');
    const row = Object.fromEntries(head.map((h, i) => [h, vals[i]]));
    eq(row.Verdict, 'COLLAPSE', lines.join('\n'));
    ok(row.Still === 'True' && Number(row.Minimum) > 59 && Number(row.Minimum) < 60, lines.join('\n'));
    ok(Number(row.RoCoF) < 0, 'RoCoF ' + row.RoCoF);
    ok(fs.readdirSync(path.join(rd.trim(), 'graphs')).some(f => f.endsWith('.png')), 'graph');
  });
}

// =============================================================================================
// Report

let passed = 0, failed = 0;
for (const r of results) {
  if (r.ok) { passed++; continue; }
  failed++;
  console.log(`FAIL ${r.name}\n  ${String(r.msg).split('\n').slice(0, 40).join('\n  ')}`);
}
console.log(`(${toCompile.length} scripts generated, ${nVariants} setting variants; requested helpers still missing from the runtime: ${REQUESTED_STILL.join(', ') || 'none'}; every pass on one graph tested with ${patchNote})`);
console.log(`analysis blocks tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
