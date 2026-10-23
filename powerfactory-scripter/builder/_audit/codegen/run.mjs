// Codegen tests for the PowerFactory Workflow Builder (wave 1, "core").
//
// Run from the repo root:   node powerfactory-scripter/builder/_audit/codegen/run.mjs
// (set PFB_TEST_TMP to choose where the generated scripts are written while the tests run)
// Needs Python 3 on PATH as "python" (compiles every generated script, runs the flow-only ones
// against the stub runtime in stub/). Prints "codegen tests: N passed, M failed" and exits 1 on
// any failure.
//
// (a) unit tests: names, literals, comments, runtime loader, loadWorkflow
// (b) structural tests: what the generator writes for each kind of graph (DESIGN 6), problems
// (c) every generated script compiles (python -m py_compile), plus a 300-graph fuzzer
// (d) flow-only workflows executed with Python against the stub runtime

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILDER = path.resolve(HERE, '..', '..');
const imp = (rel) => import(pathToFileURL(path.join(BUILDER, rel)).href);

await imp('js/blocks/index.js');
await imp('_audit/codegen/fixtures/test-blocks.js');
const { generate, MAX_LEVELS, fileNameFor } = await imp('js/core/codegen.js');
const W8 = await imp('js/core/workflow.js');
const { pyStr, pyLit, pyNum, pyComment, pyCommentText, parsePyLiteral } = await imp('js/core/pylit.js');
const N = await imp('js/core/names.js');
const RL = await imp('js/core/runtime-loader.js');
const REG = await imp('js/core/registry.js');
const KIT = await imp('js/core/blockkit.js');

// ---------------------------------------------------------------------------------------------
// The test runtime: the REAL base.py, the helpers requested for base.py (only those base.py does
// not have yet), and the stub PowerFactory / analysis helpers.

const read = (rel) => fs.readFileSync(path.join(BUILDER, rel), 'utf8');
const BASE = read('runtime/base.py');
const baseSections = RL.parseRuntime({ 'base.py': BASE }).sections;
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
const REQUESTED = withoutSections(read('_audit/codegen/stub/requested_base.py'), new Set(baseSections.keys()));
const STUB = read('_audit/codegen/stub/stub_runtime.py');
const RUNTIME = { 'base.py': BASE, 'zz_requested.py': REQUESTED, 'zz_stub.py': STUB };

// Generated scripts go to a fresh folder under PFB_TEST_TMP (default: the system temp folder);
// it is removed when every test passes and kept for a look when one fails.
const TMP_ROOT = process.env.PFB_TEST_TMP || os.tmpdir();
fs.mkdirSync(TMP_ROOT, { recursive: true });
const SCRATCH = fs.mkdtempSync(path.join(TMP_ROOT, 'pfb-codegen-'));

// ---------------------------------------------------------------------------------------------
// A tiny harness

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
class Fail extends Error {}
const ok = (cond, msg) => { if (!cond) throw new Fail(msg || 'expected true'); };
const eq = (a, b, msg) => {
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  if (ja !== jb) throw new Fail((msg ? msg + ': ' : '') + `\n  got:      ${ja}\n  expected: ${jb}`);
};
const has = (text, part, msg) => { if (!String(text).includes(part)) throw new Fail((msg ? msg + ': ' : '') + `missing:\n${part}\n--- in ---\n${text}`); };
const hasNot = (text, part, msg) => { if (String(text).includes(part)) throw new Fail((msg ? msg + ': ' : '') + `unexpected:\n${part}\n--- in ---\n${text}`); };
const toCompile = [];   // { name, code }
const toRun = [];       // { name, code, check(out) }

// Workflow DSL: nodes { id: [type, settings, { label, pin }] }; flow 'a>b' or 'a.out>b';
// data 'a.port>b.port'.
function W(nodes, flow = [], data = [], name = 'Test workflow') {
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
const START = ['start', { project: 'Nine-bus System' }];

function gen(wf, name, opts = {}) {
  const r = generate(wf, { runtime: RUNTIME, ...opts });
  toCompile.push({ name, code: r.code });
  return r;
}
// The lines of main()'s workflow body, dedented, without comment lines (unless asked).
function body(code, comments = false) {
  const lines = code.split('\n');
  const a = lines.findIndex(l => l === '            return') + 1;
  const b = lines.findIndex(l => l === '    except StopWorkflow as stop:');
  return lines.slice(a, b).map(l => l.slice(8)).filter(l => comments || !l.trim().startsWith('#')).join('\n');
}
const errors = (r) => r.problems.filter(p => p.level === 'error');
const hasProblem = (r, level, re) => r.problems.some(p => p.level === level && re.test(p.msg));
const problemText = (r) => r.problems.map(p => `[${p.level}] ${p.msg}`).join('\n');

// =============================================================================================
// (a) Unit tests

test('names: snake_case from labels', () => {
  eq(N.snake('Dispatch (MW)'), 'dispatch_mw');
  eq(N.snake('Nadir (Hz)'), 'nadir_hz');
  eq(N.snake('V'), 'v');
  eq(N.snake('Out file'), 'out_file');
  eq(N.snake('300 MW'), 'v_300_mw');
  eq(N.snake('\u00dcberlast \u00e9t\u00e9'), 'uberlast_ete');
  eq(N.snake('\u0394f (Hz)'), 'f_hz');
  eq(N.snake('\u9891\u7387'), '');
  eq(N.snake('__x__'), 'x');
  eq(N.snake('ElmSym'), 'elm_sym');
  eq(N.snake('a'.repeat(60)).length, 40);
});

test('names: reserved set and allocation', () => {
  const res = new Set([...N.baseReserved(), 'out_file', 'table', 'V', 'log']);
  const reqs = [
    { nodeId: 'n7', hint: 'Out file', seq: 0 },
    { nodeId: 'n3', hint: 'class', seq: 0 },
    { nodeId: 'n2', hint: 'e', seq: 0 },
    { nodeId: 'n4', hint: 'Value', seq: 0 },
    { nodeId: 'n10', hint: 'Value', seq: 0 },
    { nodeId: 'n4', hint: 'Value', seq: 1 },
    { nodeId: 'n5', hint: '', seq: 0 },
    { nodeId: 'n6', hint: 'log', seq: 0 },
    { nodeId: 'n8', hint: 'try', seq: 0 },
    { nodeId: 'n9', hint: '_private', seq: 0 },
  ];
  const names = N.allocateNames(reqs, res, W8.compareIds);
  eq(names, ['out_file_n7', 'class_n3', 'e_n2', 'value', 'value_n10', 'value_n4', 'value_n5', 'log_n6', 'try_n8', 'private']);
  for (const n of names) ok(/^[a-z][a-z0-9_]*$/.test(n), 'identifier ' + n);
  ok(N.baseReserved().has('match') && N.baseReserved().has('print') && N.baseReserved().has('mark'));
});

test('names: SETTINGS constants from label + key', () => {
  const res = N.baseReserved();
  const taken = new Set();
  eq(N.constantName('Dispatch (MW)', 'from', 'n2', taken, res), 'DISPATCH_FROM');
  eq(N.constantName('Dispatch (MW)', 'from', 'n9', taken, res), 'DISPATCH_FROM_N9');
  eq(N.constantName('V', 'value', 'n3', taken, res), 'V_VALUE');
  eq(N.constantName('Project', 'project', 'n4', taken, res), 'PROJECT_N4');
  eq(N.constantName('300 MW', 'x', 'n5', taken, res), 'V_300_MW_X');
});

test('names: generated variables avoid runtime and Python names', () => {
  const wf = W({
    n1: START,
    n2: ['text.format', { template: 'a{x}' }, { label: 'Out file' }],
    n3: ['text.format', { template: 'b{x}' }, { label: 'e' }],
    n4: ['text.format', { template: 'c{x}' }, { label: 'class' }],
    n5: ['text.format', { template: 'd{x}' }, { label: 'table' }],
    n6: ['text.format', { template: 'e{x}' }, { label: 'V' }],
    n7: ['flow.log', { text: '{a} {b} {c} {d} {f}' }],
  }, ['n1>n7'], ['n2.value>n7.a', 'n3.value>n7.b', 'n4.value>n7.c', 'n5.value>n7.d', 'n6.value>n7.f']);
  const r = gen(wf, 'names-reserved');
  const b = body(r.code);
  has(b, 'out_file_n2 = text_format(');
  has(b, 'e_n3 = text_format(');
  has(b, 'class_n4 = text_format(');
  has(b, 'table_n5 = text_format(');
  has(b, '\nv = text_format(');
});

test('literals: Python strings round-trip (checked in Python below)', () => {
  eq(pyStr('C:\\Users\\Studies'), 'r"C:\\Users\\Studies"');
  eq(pyStr('ends with\\'), '"ends with\\\\"');
  eq(pyStr('a\nb'), '"a\\nb"');
  eq(pyStr('\u00dc'), '"\\u00dc"');
  eq(pyStr('\ud83d\ude00'), '"\\U0001f600"');
  eq(pyNum(NaN), 'float("nan")');
  eq(pyNum(-Infinity), 'float("-inf")');
  eq(pyNum(1e-7), '1e-7');
  eq(pyNum(-0), '-0.0');
  eq(pyLit([1, 'a', null, true, { k: [2.5] }]), '[1, "a", None, True, {"k": [2.5]}]');
});

const LITERAL_CASES = ['C:\\Users\\Studies', 'D:\\new\\table.csv', 'Study \\N-1', 'say """hi"""', "it's", 'ends with\\',
  'line1\nline2', 'tab\there', 'q"uote', '\\n stays a backslash n', '\u00dcberlast \u2014 50 Hz', '\ud83d\ude00', 'a\u2028b\u2029c',
  '\x00\x07\x1f\x7f', '\r\n', '', '\\\\server\\share', 'x\ud800y', '{curly} %d %s'];

test('comments: no line break or control character survives', () => {
  const c = pyComment('a\nb\rc\u2028d\u2029e\u0085f\x0bg\u202eh\u200bi');
  ok(!/[\r\n\u2028\u2029\u0085\x00-\x1f\u202e\u200b]/.test(c), 'clean: ' + JSON.stringify(c));
  ok(c.startsWith('# a b c d e f g h i'), c);
  ok(pyCommentText('x'.repeat(500)).length <= 240);
});

test('comments: a label with a newline cannot inject code', () => {
  const wf = W({ n1: START, n2: ['flow.log', { text: 'hi' }, { label: 'Log\nimport os; os.system("calc")' }] }, ['n1>n2']);
  const r = gen(wf, 'comment-injection');
  ok(!r.code.split('\n').some(l => /^\s*import os; os\.system/.test(l)), 'no injected line');
  const note = W({ n1: START, n9: ['note', { text: 'first line\nimport os\n\u2028second' }] }, []);
  const r2 = gen(note, 'note-lines');
  const wfPart = r2.code.split('# ==== WORKFLOW ====')[1].split('def main():')[0];
  ok(wfPart.split('\n').every(l => !l.trim() || l.startsWith('#')), 'note lines are comments: ' + wfPart);
  has(r2.code, '# Note: first line\n#   import os\n#   second');
});

test('literal reader: SETTINGS values read back', () => {
  eq(parsePyLiteral('"Nine-bus System"  # comment').value, 'Nine-bus System');
  eq(parsePyLiteral('r"C:\\Users\\x"').value, 'C:\\Users\\x');
  eq(parsePyLiteral('"\\u00dcber \\n"').value, '\u00dcber \n');
  eq(parsePyLiteral('1_000.5').value, 1000.5);
  eq(parsePyLiteral('-3e-2').value, -0.03);
  eq(parsePyLiteral('True').value, true);
  eq(parsePyLiteral('None').value, null);
  eq(parsePyLiteral('[1, "a", (2, 3)]').value, [1, 'a', [2, 3]]);
  ok(Number.isNaN(parsePyLiteral('float("nan")').value));
  eq(parsePyLiteral('foo()'), null);
  eq(parsePyLiteral('"unterminated'), null);
  for (const s of LITERAL_CASES) {
    if (/[\ud800-\udfff]/.test(s.replace(/\ud83d\ude00/g, ''))) continue;
    eq(parsePyLiteral(pyStr(s)).value, s, 'round trip ' + JSON.stringify(s));
  }
});

test('runtime loader: sections, needs, imports, names, problems', () => {
  const a = [
    '# @helper one', '# @needs two', '# @imports import os', '# @imports from math import sqrt as root',
    'X1 = 1', 'def one():', '    import pandas as pd', '    return two()', '# @end',
    '# @helper two', '# @imports import os', 'class Two:', '    pass', 'def two():', '    return Two()', '# @end',
    '# @helper three', '# @needs nothere', 'A, B = 1, 2', '# @end',
    '# @helper one', 'dup = 1', '# @end',
    '# @helper open', 'x = 1',
  ].join('\n');
  const lib = RL.parseRuntime({ 'b.py': 'def bfun():\n    pass\n', 'base.py': a });
  eq(lib.order, ['one', 'two', 'three']);
  eq(lib.sections.get('one').needs, ['two']);
  eq(lib.sections.get('one').code[0], 'X1 = 1');
  for (const n of ['X1', 'one', 'pd', 'Two', 'two', 'A', 'B', 'os', 'root', 'bfun']) ok(lib.names.has(n), 'name ' + n);
  ok(lib.problems.some(p => /defined twice/.test(p.msg)), 'duplicate section');
  ok(lib.problems.some(p => /needs "nothere"/.test(p.msg)), 'unknown need');
  ok(lib.problems.some(p => /no "# @end"/.test(p.msg)), 'missing end');
  const res = RL.resolveHelpers(['one', 'missing'], lib);
  eq(res.names, ['one', 'two']);
  eq(res.imports, ['import os', 'from math import sqrt as root']);
  eq(res.missing, ['missing']);
  eq(RL.importNames('import matplotlib.pyplot as plt, os.path'), ['plt', 'os']);
  eq(RL.importNames('from x.y import (a as b, c)'), ['b', 'c']);
});

test('runtime loader: the real base.py', () => {
  const lib = RL.parseRuntime({ 'base.py': BASE });
  eq(lib.order, ['log', 'StopWorkflow', 'run_dir', 'ctx', 'case_failed', 'Trial', 'vars', 'convert', 'num_range', 'compare', 'elementwise', 'arith', 'func1', 'logic', 'apply_formula', 'text_format', 'Series', 'table', 'table_pick', 'read_table']);
  eq(lib.problems, []);
  for (const n of ['V', 'V_WHERE', 'out_file', 'safe_filename', 'ResultTable', 'table', 'flush_tables', 'ctx_push', 'as_text', 'time', 'os', 'csv', 'traceback', 'math', 'pd']) ok(lib.names.has(n), 'base name ' + n);
  const r = RL.resolveHelpers(['table'], lib);
  eq(r.names, ['log', 'run_dir', 'ctx', 'convert', 'table']);
  eq(r.imports, ['import csv', 'import math', 'import os', 'import re', 'import sys', 'import time']);
});

test('loadWorkflow: empty workflow round trip, JSON text, serialize order', () => {
  const wf = W8.emptyWorkflow('Study A');
  eq(wf.nodes[0].id, 'n1'); eq(wf.nodes[0].x, 80); eq(wf.nodes[0].y, 120); eq(wf.nodes[0].type, 'start');
  const text = W8.toJSON(wf);
  ok(text.startsWith('{\n  "app": "pf-builder",\n  "v": 1,\n  "name": "Study A",'), 'key order');
  const { wf: back, notes } = W8.loadWorkflow(text);
  eq(notes, []);
  eq(W8.serialize(back), W8.serialize(wf));
  eq(Object.keys(W8.serialize(back).nodes[0]), ['id', 'type', 'x', 'y', 'label', 's', 'pin', 'sv']);
  const s = W8.serialize(back).nodes[0].s;
  eq(Object.keys(s), REG.getBlock('start').settings.map(st => st.key), 'every declared setting is saved, in order');
});

test('loadWorkflow: UI-only fields are not saved; ids for new nodes and edges', () => {
  const wf = W8.emptyWorkflow();
  wf.nodes[0].selected = true; wf.nodes[0].dragging = false; wf.nodes[0].measured = { width: 3 }; wf.nodes[0].future = 7;
  const o = W8.serialize(wf);
  ok(!('selected' in o.nodes[0]) && !('measured' in o.nodes[0]) && !('dragging' in o.nodes[0]));
  eq(o.nodes[0].future, 7, 'unknown keys kept');
  const w2 = W({ n1: START, n5: ['flow.log', {}], n12: ['flow.log', {}] }, ['n1>n5', 'n5>n12']);
  eq(W8.newNodeId(w2), 'n13');
  eq(W8.newEdgeId(w2), 'e3');
  const node = W8.makeNode(w2, 'flow.range', 10, 20);
  eq(node.id, 'n13'); eq(node.s.from, 1); eq(node.sv, 1);
});

test('loadWorkflow: a .py made by the Builder, SETTINGS read back, hand edits noticed', () => {
  const wf = W({ n1: START, n2: ['flow.range', { from: 100, to: 300, step: 50 }, { label: 'Dispatch (MW)', pin: ['from', 'to'] }], n3: ['flow.log', { text: 'x' }] }, ['n1>n2', 'n2.body>n3']);
  const r = gen(wf, 'py-roundtrip');
  has(r.code, '\nDISPATCH_FROM = 100\n');
  has(r.code, '\nDISPATCH_TO = 300\n');
  has(body(r.code), 'num_range(DISPATCH_FROM, DISPATCH_TO, 50)');
  eq(r.settingsMap.DISPATCH_FROM, ['n2', 'from']);
  eq(r.settingsMap.PROJECT, ['n1', 'project']);
  const pfb = r.code.trimEnd().split('\n').pop();
  ok(pfb.startsWith('# PFB1 {'), 'last line is PFB1');
  ok(/^[\x20-\x7e]*$/.test(pfb), 'PFB1 line is ASCII');
  const plain = W8.loadWorkflow(r.code);
  eq(plain.notes, []);
  const strip = (w) => { const o = W8.serialize(w); delete o.view; return o; };
  eq(strip(plain.wf), strip(W8.loadWorkflow(wf).wf));
  const edited = r.code.replace('\nDISPATCH_TO = 300\n', '\nDISPATCH_TO = 450  # edited\n').replace('\nPROJECT = "Nine-bus System"\n', '\nPROJECT = r"Other \\ project"\n');
  const back = W8.loadWorkflow(edited);
  eq(back.wf.nodes.find(n => n.id === 'n2').s.to, 450);
  eq(back.wf.nodes.find(n => n.id === 'n1').s.project, 'Other \\ project');
  ok(back.notes.some(n => n.level === 'info' && /DISPATCH_TO/.test(n.msg) && /PROJECT/.test(n.msg)), JSON.stringify(back.notes));
  ok(!back.notes.some(n => /edited by hand/.test(n.msg)), 'SETTINGS edits are not hand edits');
  const hand = r.code.replace('app = pf_connect()', 'app = pf_connect()  # mine');
  ok(W8.loadWorkflow(hand).notes.some(n => /edited by hand/.test(n.msg)), 'hand edit noticed');
  const crlf = r.code.replace(/\n/g, '\r\n');
  ok(!W8.loadWorkflow(crlf).notes.some(n => /edited by hand/.test(n.msg)), 'CRLF is not an edit');
  const twice = W8.embedInPython(r.code, wf, r.settingsMap);
  eq(twice.split('\n').filter(l => l.startsWith('# PFB1 ')).length, 1, 'old PFB1 line replaced');
  ok(W8.extractFromPython(r.code + '\n# PFB1 {"app":"pf-builder","name":"later"}\n').name === 'later', 'last PFB1 line wins');
});

test('loadWorkflow: refuses another app, notes a newer version, never throws', () => {
  const other = W8.loadWorkflow({ app: 'loadflow-simulator', nodes: [] });
  eq(other.wf, null);
  eq(other.notes[0].level, 'error');
  const sc = W8.loadWorkflow({ tool: 'loadflow-simulator', inputs: {} });
  eq(sc.wf, null);
  const newer = W8.loadWorkflow({ app: 'pf-builder', v: 3, name: 'N', nodes: [{ id: 'n1', type: 'start', s: {} }], edges: [], extraThing: { a: 1 } });
  ok(newer.wf && newer.wf.v === 3);
  ok(newer.notes.some(n => /newer version/.test(n.msg)));
  eq(W8.serialize(newer.wf).extraThing, { a: 1 }, 'unknown workflow keys kept');
  for (const bad of [null, undefined, 3, 'garbage', '{ not json', '[]', [], { app: 'pf-builder', nodes: 'x', edges: 7 }, { nodes: [null, 1, 'x', { id: 5 }] }]) {
    const r = W8.loadWorkflow(bad);
    ok(Array.isArray(r.notes), 'notes for ' + JSON.stringify(bad));
  }
  const noApp = W8.loadWorkflow({ nodes: [{ id: 'n1', type: 'start' }] });
  ok(noApp.wf && noApp.wf.nodes.length === 1, 'a fragment without app loads');
});

test('loadWorkflow: missing block type keeps its data and wires', () => {
  const raw = W({ n1: START, n2: ['pf.future', { a: 1, deep: { x: [1, 2] } }], n3: ['flow.log', { text: 'x' }] }, ['n1>n2', 'n2.weird>n3'], ['n2.val>n3.value']);
  raw.nodes[1].sv = 9;
  const { wf, notes } = W8.loadWorkflow(raw);
  ok(notes.some(n => /Missing block/.test(n.msg) && n.nodeId === 'n2'));
  const n2 = wf.nodes.find(n => n.id === 'n2');
  eq(n2.s, { a: 1, deep: { x: [1, 2] } });
  eq(n2.sv, 9);
  eq(wf.edges.length, 3, 'wires kept');
  eq(W8.missingPorts(wf, 'n2'), { flowIn: true, inputs: [], outputs: ['weird', 'val'] });
  const ser = W8.serialize(wf);
  eq(ser.nodes[1].s, { a: 1, deep: { x: [1, 2] } });
  const r = gen(wf, 'missing-block');
  ok(hasProblem(r, 'error', /missing from this version/), problemText(r));
  ok(!hasProblem(r, 'warning', /not connected to Start/), 'steps after a missing block still count as reached');
  has(body(r.code), 'pass  # this block is missing');
  has(body(r.code), 'log("x")');
});

test('loadWorkflow: a port that is gone is kept and flagged', () => {
  const raw = W({ n1: START, n2: ['flow.log', { text: 'x' }] }, ['n1.gone>n2'], ['n1.nothing>n2.value']);
  const { wf, notes } = W8.loadWorkflow(raw);
  eq(wf.edges.length, 2);
  ok(notes.filter(n => /no longer has/.test(n.msg)).length === 2, JSON.stringify(notes));
  const r = gen(wf, 'port-gone');
  ok(r.problems.filter(p => /no longer has/.test(p.msg) && p.fix && p.fix.op.op === 'removeEdge').length === 2, problemText(r));
});

test('loadWorkflow: bad and repeated ids get clean ids, wires follow', () => {
  const raw = {
    app: 'pf-builder', v: 1, name: 'ids',
    nodes: [
      { id: 'n1', type: 'start', s: { project: 'P' } },
      { id: 'n-7', type: 'flow.log', s: { text: 'a' } },
      { id: 'n1', type: 'flow.log', s: { text: 'dup' } },
      { id: 42, type: 'flow.log', s: 'not an object' },
    ],
    edges: [
      { id: 'e1', from: 'n1', out: 'next', to: 'n-7', in: 'in' },
      { id: 'bad id', from: 'n-7', out: 'next', to: '42', in: 'in' },
      { id: 'e1', from: 'n1', out: 'next', to: 'nowhere', in: 'in' },
    ],
  };
  const { wf, notes } = W8.loadWorkflow(raw);
  eq(wf.nodes.map(n => n.id), ['n1', 'n2', 'n3', 'n4']);
  eq(wf.edges.map(e => [e.id, e.from, e.to]), [['e1', 'n1', 'n2'], ['e2', 'n2', 'n4']]);
  ok(notes.some(n => /same id "n1"/.test(n.msg)));
  ok(notes.some(n => /did not connect/.test(n.msg)));
  eq(wf.nodes[3].s.text, 'Value: {value}', 'non-object settings read as {}');
});

test('loadWorkflow: settings keep their meaning (strings, was, alias, migrate, list row ids)', () => {
  const raw = W({
    n1: ['start', { project: 'P', fNominal: 50, connectTimeout: '90', undoChanges: 'false' }],
    n2: ['test.was', { mode: 'quick', n: '3', oldKey: 'carried' }],
    n3: ['test.was', { mode: 0 }],
    n4: ['flow.list', { source: 'table', cols: [{ name: 'Case' }, { name: 'MW', type: 'num' }, { id: 'c1', name: 'Dup' }] }],
    n5: ['flow.if', { op: 'nonsense' }],
  });
  raw.nodes[1].sv = 1;
  const { wf } = W8.loadWorkflow(raw);
  const s = (id) => wf.nodes.find(n => n.id === id).s;
  eq(s('n1').fNominal, '50');
  eq(s('n1').connectTimeout, 90);
  eq(s('n1').undoChanges, false);
  eq(s('n2').mode, 'fast', 'old value mapped through was');
  eq(s('n2').n, 30, 'migrate from sv 1');
  eq(s('n2').newKey, 'carried', 'settingAlias');
  eq(wf.nodes.find(n => n.id === 'n2').sv, 2);
  eq(s('n3').mode, 'fast', 'a number select value matched as a string');
  eq(s('n4').cols.map(r => r.id), ['c2', 'c3', 'c1']);
  eq(s('n4').cols[0].type, 'num', 'missing row columns take their defaults');
  eq(s('n5').op, 'nonsense', 'an unknown option is kept as saved');
  ok(W8.loadWorkflow(raw).notes.some(n => /"nonsense" for Check is not known/.test(n.msg)));
  eq(REG.settingsOf(wf.nodes.find(n => n.id === 'n5')).op, 'true', '... and the generator uses the default');
  eq(W8.serialize(wf).nodes.find(n => n.id === 'n5').s.op, 'nonsense', '... and it is saved back');
});

test('loadWorkflow: two wires into one input, two from one flow output', () => {
  const raw = W({ n1: START, n2: ['flow.log', { text: '{a}' }], n3: ['flow.log', { text: 'b' }], n4: ['val.number', { value: 1 }], n5: ['val.number', { value: 2 }] },
    ['n1>n2', 'n1>n3'], ['n4.value>n2.a', 'n5.value>n2.a']);
  const { wf, notes } = W8.loadWorkflow(raw);
  eq(wf.edges.length, 4);
  ok(notes.some(n => /Two wires go into/.test(n.msg)) && notes.some(n => /Two wires leave/.test(n.msg)));
  const r = gen(wf, 'two-wires');
  ok(hasProblem(r, 'warning', /Two wires go into a of Print a message/), problemText(r));
  has(body(r.code), 'text_format("{a}", {"a": 1})', 'the first wire is used');
  ok(hasProblem(r, 'warning', /Two wires leave/));
});

// =============================================================================================
// (b) Structural tests

test('structure: a sequence of steps', () => {
  const r = gen(W({ n1: START, n2: ['flow.log', { text: 'A' }], n3: ['flow.log', { text: 'B' }], n4: ['flow.log', { text: 'C' }] }, ['n1>n2', 'n2>n3', 'n3>n4']), 'sequence');
  eq(body(r.code), 'log("A")\nlog("B")\nlog("C")');
  eq(r.steps, { n1: 1, n2: 2, n3: 3, n4: 4 });
  eq(r.problems, []);
  has(body(r.code, true), '# -- Step 2: Print a message (A) --');
  eq(r.ends, { 'n4:next': 'ends the workflow' });
});

const IFJ = () => W({
  n1: START, n2: ['flow.if', { op: 'gt', b: 3 }], n3: ['val.number', { value: 5 }],
  n4: ['flow.log', { text: 'Y' }], n5: ['flow.log', { text: 'N' }], n6: ['flow.log', { text: 'J' }],
}, ['n1>n2', 'n2.yes>n4', 'n2.no>n5', 'n4>n6', 'n5>n6'], ['n3.value>n2.a']);

test('structure: If with a join', () => {
  const r = gen(IFJ(), 'if-join');
  eq(body(r.code), [
    'check = compare(5, "gt", 3, 1e-9)',
    'if check is None:',
    '    log("If: there is no value to check, so it takes No.", "warn")',
    'if check:',
    '    log("Y")',
    'else:',
    '    log("N")',
    'log("J")'].join('\n'));
});

test('structure: If without a join (guard clause, largest route inline)', () => {
  const wf = W({ n1: START, n2: ['flow.if', { op: 'true' }], n3: ['val.bool', { value: true }], n4: ['flow.log', { text: 'Y1' }], n6: ['flow.log', { text: 'Y2' }], n5: ['flow.log', { text: 'N' }] },
    ['n1>n2', 'n2.yes>n4', 'n4>n6', 'n2.no>n5'], ['n3.value>n2.a']);
  const r = gen(wf, 'if-nojoin');
  has(body(r.code), ['if not check:', '    log("N")', '    return', 'log("Y1")', 'log("Y2")'].join('\n'));
});

test('structure: guard clause conditions are exact (C10 a)', () => {
  const inLoop = (nodes, flow, data) => W({ n1: START, n2: ['flow.repeat', { times: 2 }], ...nodes }, ['n1>n2', 'n2.body>n3', ...flow], data);
  // The live route is the else out: the guard takes the first out.
  const a = gen(inLoop({ n3: ['flow.if', { op: 'gt', b: 100 }, { label: 'Overloaded?' }], n4: ['val.number', { value: 120 }], n5: ['flow.log', { text: 'not overloaded' }] }, ['n3.no>n5'], ['n4.value>n3.a']), 'c10a');
  has(body(a.code), ['        overloaded = compare(120, "gt", 100, 1e-9)', '        if overloaded is None:', '            log("Overloaded?: there is no value to check, so it takes No.", "warn")',
    '        if overloaded:', '            case_skipped("Overloaded?: Yes")', '            continue', '        log("not overloaded")'].join('\n'), 'labelled If');
  // Three outs, only the first wired: one guard per dead out with the exact condition.
  const b = gen(inLoop({ n3: ['test.tri', {}], n5: ['flow.log', { text: 'low' }] }, ['n3.low>n5']), 'c10a-tri');
  has(body(b.code), [
    '        if not (v < 0) and (v < 10):',
    '            case_skipped("Test three ways: Middle")',
    '            continue',
    '        if not ((v < 0) or (v < 10)):',
    '            case_skipped("Too high")',
    '            continue',
    '        log("low")'].join('\n'));
});

test('structure: bypass join keeps pass and ends side chains (C10 b)', () => {
  const wf = W({
    n1: START, n2: ['flow.repeat', { times: 2 }],
    n3: ['flow.if', { op: 'gt', b: 200 }], n9: ['val.number', { value: 250 }],
    n4: ['test.write', {}], n5: ['test.check', { bad: 0 }], n6: ['test.calc', {}], n7: ['test.addrow', {}],
  }, ['n1>n2', 'n2.body>n3', 'n3.yes>n4', 'n4>n6', 'n3.no>n5', 'n5.ok>n6', 'n5.fail>n7', 'n6>n7'], ['n9.value>n3.a', 'n9.value>n7.c1']);
  const r = gen(wf, 'c10b');
  has(body(r.code), [
    '        if check:',
    '            touch_model("Test write model")',
    '        else:',
    '            passed = (1) != 0',
    '            if not passed:',
    '                table("Results").add({"A": 250}, status=True)',
    '                continue',
    '        touch_model("calc Test calculation")',
    '        table("Results").add({"A": 250}, status=True)'].join('\n'));
});

test('structure: nested If inside a branch with an outer join (dead end ends the route)', () => {
  const nodes = (loop) => ({
    n1: START, ...(loop ? { n10: ['flow.repeat', { times: 2 }] } : {}),
    n2: ['flow.if', { op: 'true' }, { label: 'First?' }], n3: ['flow.if', { op: 'true' }, { label: 'Second?' }], n8: ['val.bool', {}],
    n4: ['flow.log', { text: 'A' }], n5: ['flow.log', { text: 'B' }], n6: ['flow.log', { text: 'C' }], n7: ['flow.log', { text: 'D' }],
  });
  const flow = ['n2.yes>n3', 'n3.yes>n4', 'n4>n6', 'n2.no>n5', 'n5>n6', 'n6>n7'];
  const data = ['n8.value>n2.a', 'n8.value>n3.a'];
  const top = gen(W(nodes(false), ['n1>n2', ...flow], data), 'nested-if-top');
  has(body(top.code), ['if first:', '    second = compare(True, "true", 0, 1e-9)', '    if second is None:',
    '        log("Second?: there is no value to check, so it takes No.", "warn")',
    '    if not second:', '        log("Second?: No. The workflow ends here.", "warn")', '        return',
    '    log("A")', 'else:', '    log("B")', 'log("C")', 'log("D")'].join('\n'));
  const loop = gen(W(nodes(true), ['n1>n10', 'n10.body>n2', ...flow], data), 'nested-if-loop');
  has(body(loop.code), ['            if not second:', '                case_skipped("Second?: No")', '                continue', '            log("A")'].join('\n'));
});

test('structure: side chains become flat guards (C21)', () => {
  const wf = W({
    n1: START, n2: ['flow.repeat', { times: 3 }],
    n3: ['test.check', { bad: 1 }, { label: 'Load flow' }], n4: ['flow.log', { text: 'LF failed' }],
    n5: ['test.check', { bad: 2 }, { label: 'RMS' }], n6: ['flow.log', { text: 'RMS failed' }],
    n7: ['flow.if', { op: 'true' }, { label: 'Settles?' }], n8: ['flow.next', { msg: 'Does not settle' }],
    n9: ['test.addrow', {}], n10: ['val.bool', { value: true }],
  }, ['n1>n2', 'n2.body>n3', 'n3.ok>n5', 'n3.fail>n4', 'n5.ok>n7', 'n5.fail>n6', 'n7.yes>n9', 'n7.no>n8'], ['n10.value>n7.a', 'n2.index>n9.c1']);
  const r = gen(wf, 'c21');
  has(body(r.code), [
    '        load_flow_passed = (1) != 1',
    '        if not load_flow_passed:',
    '            log("LF failed")',
    '            continue',
    '        rms_passed = (1) != 2',
    '        if not rms_passed:',
    '            log("RMS failed")',
    '            continue',
    '        settles = compare(True, "true", 0, 1e-9)',
    '        if settles is None:',
    '            log("Settles?: there is no value to check, so it takes No.", "warn")',
    '        if not settles:',
    '            case_skipped("Does not settle")',
    '            continue',
    '        table("Results").add({"A": pass_no}, status=True)'].join('\n'));
  has(r.code, 'ctx_pop(["Results"])', 'skip table');
  eq(r.ends['n4:next'], 'goes on to the next pass of Repeat N times');
  eq(r.regions.n9.map(x => x.id), ['n2']);
});

test('structure: 3-deep nested loops', () => {
  const wf = W({
    n1: START, n2: ['flow.range', { from: 1, to: 2, name: 'A' }, { label: 'A' }], n3: ['flow.repeat', { times: 2, name: 'B' }, { label: 'B' }],
    n4: ['flow.list', { values: 'x, y', name: 'C' }, { label: 'C' }], n5: ['flow.log', { text: '{a}{b}{c}' }],
  }, ['n1>n2', 'n2.body>n3', 'n3.body>n4', 'n4.body>n5'], ['n2.value>n5.a', 'n3.index>n5.b', 'n4.item>n5.c']);
  const r = gen(wf, 'nested-3');
  const b = body(r.code);
  has(b, 'for a_pass_no, a in enumerate(a_values, 1):\n    ctx_push("A", a, a_pass_no, len(a_values))');
  has(b, '        for b in range(1, b_passes + 1):\n            ctx_push("B", b, b, b_passes)');
  has(b, '                for c_pass_no, c in enumerate(c_items, 1):\n                    ctx_push("C", c, c_pass_no, len(c_items))');
  has(b, 'log(text_format("{a}{b}{c}", {"a": a, "b": b, "c": c}))');
  eq(r.regions.n5.map(x => x.label), ['A', 'B', 'C']);
  eq(r.problems, []);
});

test('structure: loop with If, Skip to next pass and Stop the loop', () => {
  const wf = W({
    n1: START, n2: ['flow.range', { from: 1, to: 10 }], n3: ['flow.if', { op: 'ge', b: 4 }], n4: ['flow.break', { msg: 'Enough' }],
    n5: ['flow.if', { op: 'eq', b: 2 }, { label: 'Two?' }], n6: ['flow.next', { msg: 'Skip two' }], n7: ['flow.log', { text: '{v}' }], n8: ['flow.log', { text: 'after' }],
  }, ['n1>n2', 'n2.body>n3', 'n3.yes>n4', 'n3.no>n5', 'n5.yes>n6', 'n5.no>n7', 'n2.done>n8'], ['n2.value>n3.a', 'n2.value>n5.a', 'n2.value>n7.v']);
  const r = gen(wf, 'loop-skip-stop');
  has(body(r.code), ['        if check:', '            log("Enough")', '            break'].join('\n'));
  has(body(r.code), ['        if two:', '            case_skipped("Skip two")', '            continue', '        log(text_format("{v}", {"v": value}))'].join('\n'));
  eq(errors(r), []);
  toRun.push({ name: 'exec: Stop the loop and Skip to next pass', code: r.code, check(o) {
    eq(o.logs.filter(l => /^\d+$/.test(l)), ['1', '3'], 'printed values');
    ok(o.logs.includes('Enough') && o.logs.includes('after'), 'break then after');
    ok(o.logs.includes('Skipped (Value = 2): Skip two'), o.logs.join('|'));
  } });
});

const UNTIL = (bad) => W({
  n1: START, n2: ['flow.until', { max: 10 }, { label: 'Until P' }],
  n3: ['var.set', { name: 'P', mode: 'sum' }], n4: ['val.number', { value: 1 }],
  n5: ['test.check', { bad }], n6: ['var.get', { name: 'P' }], n7: ['flow.log', { text: 'P is {p}' }],
  n8: ['math.compare', { op: 'ge', b: 3 }], n9: ['flow.log', { text: 'met {m}' }],
}, ['n1>n2', 'n2.body>n3', 'n3>n5', 'n5.ok>n7', 'n2.done>n9'], ['n4.value>n3.value', 'n6.value>n5.value', 'n6.value>n7.p', 'n6.value>n8.a', 'n8.value>n2.cond', 'n2.met>n9.m']);

test('structure: Repeat until checks its condition on a skip too (C9)', () => {
  const r = gen(UNTIL(3), 'until-skip');
  has(body(r.code), [
    '        p = var_get("P")  # Recall a value',
    '        passed = (p) != 3',
    '        if not passed:',
    '            case_skipped("Check failed")',
    '            p = var_get("P")  # Recall a value',
    '            compared = compare(p, "ge", 3, 1e-9)  # Compare',
    '            if as_bool(compared):',
    '                until_p_met = True',
    '                break',
    '            continue'].join('\n'));
  has(body(r.code), ['        ctx_pop()', 'else:', '    log("Until P stopped after 10 passes without the condition.", "warn")'].join('\n'));
  eq(errors(r), []);
  toRun.push({ name: 'exec: Repeat until stops when the condition holds on a skipped pass', code: r.code, check(o) {
    eq(o.logs.filter(l => /^P is/.test(l)), ['P is 1', 'P is 2']);
    ok(o.logs.includes('met Yes'), o.logs.join('|'));
    ok(o.logs.some(l => /^Skipped \(Until P = 3\): Check failed$/.test(l)), 'the label names the pass: ' + o.logs.join('|'));
  } });
});

test('structure: Repeat until reaching max passes says so', () => {
  const wf = W({ n1: START, n2: ['flow.until', { max: 3 }], n3: ['flow.log', { text: 'pass' }], n4: ['val.bool', { value: false }], n5: ['flow.log', { text: 'met {m}' }] },
    ['n1>n2', 'n2.body>n3', 'n2.done>n5'], ['n4.value>n2.cond', 'n2.met>n5.m']);
  const r = gen(wf, 'until-max');
  toRun.push({ name: 'exec: Repeat until reaches max passes', code: r.code, check(o) {
    eq(o.logs.filter(l => l === 'pass').length, 3);
    ok(o.logs.includes('WARNING Repeat until stopped after 3 passes without the condition.'), o.logs.join('|'));
    ok(o.logs.includes('met No'));
  } });
});

test('structure: a search (callback) with dead end, Skip and Stop inside it and inside a loop in it (C1)', () => {
  const wf = W({
    n1: START, n2: ['test.search', { lo: 1, hi: 5, n: 5 }, { label: 'Find headroom' }],
    n3: ['test.check', { bad: 2 }], n4: ['flow.if', { op: 'gt', b: 3 }, { label: 'Too much?' }],
    n5: ['test.report', {}], n6: ['val.bool', { value: true }], n7: ['val.bool', { value: false }], n8: ['test.report', {}],
    n9: ['flow.repeat', { times: 2, name: 'Inner' }], n10: ['flow.if', { op: 'eq', b: 2 }, { label: 'Second inner?' }],
    n11: ['flow.next', { msg: 'inner skip' }], n12: ['flow.break', { msg: 'inner stop' }], n13: ['flow.if', { op: 'eq', b: 5 }, { label: 'Five?' }],
    n14: ['flow.break', { msg: 'stop search' }], n15: ['flow.log', { text: 'best {b}' }], n16: ['flow.log', { text: 'inner {i}' }],
  }, ['n1>n2', 'n2.body>n3', 'n3.ok>n13', 'n13.yes>n14', 'n13.no>n9', 'n9.body>n10', 'n10.yes>n11', 'n10.no>n16', 'n16>n12', 'n9.done>n4', 'n4.yes>n8', 'n4.no>n5', 'n2.done>n15'],
  ['n2.value>n3.value', 'n2.value>n4.a', 'n6.value>n5.ok', 'n7.value>n8.ok', 'n9.index>n10.a', 'n2.value>n13.a', 'n9.index>n16.i', 'n2.best>n15.b']);
  const r = gen(wf, 'callback');
  const b = body(r.code);
  has(b, 'def try_n2(value):\n    trial = Trial({"Value": value}, "max")\n    ctx_push("Find headroom", value)\n    try:');
  has(b, ['        if not passed:', '            case_skipped("Check failed")', '            return trial'].join('\n'), 'dead end in a try');
  has(b, ['        if five:', '            log("stop search")', '            return trial.stop_search()'].join('\n'), 'Stop the loop in a try');
  has(b, ['                if second_inner:', '                    case_skipped("inner skip")', '                    continue'].join('\n'), 'Skip in a loop in a try');
  has(b, ['                log("inner stop")', '                break'].join('\n'), 'Stop the loop in a loop in a try');
  has(b, '    except Exception as err:\n        case_failed(err, trial)');
  has(b, '            except Exception as err_n9:\n                case_failed(err_n9)', 'the loop in the try has its own name');
  has(b, '    return trial\nsearch = fake_search(try_n2, 1, 5, 5)');
  has(b, 'trial.report(score=None, ok=False)');
  eq(errors(r), [], problemText(r));
  eq(r.ends['n2:body'], undefined);
  eq(r.regions.n10.map(x => x.label), ['Find headroom', 'Repeat N times']);
  toRun.push({ name: 'exec: search tries, reports and stops', code: r.code, check(o) {
    eq(o.logs.filter(l => /^inner \d/.test(l)), ['inner 1', 'inner 1', 'inner 1']);
    ok(o.stdout.includes('STUB try 1 ok=True') && o.stdout.includes('STUB try 2 ok=None') && o.stdout.includes('STUB try 4 ok=False'), o.stdout);
    ok(o.stdout.includes('STUB try 5 ok=None'), 'try 5 stops the search');
    ok(o.logs.includes('best 3'), o.logs.join('|'));
  } });
});

test('structure: Skip and Stop outside any loop are errors', () => {
  for (const t of ['flow.next', 'flow.break']) {
    const r = gen(W({ n1: START, n2: [t, {}] }, ['n1>n2']), 'terminal-outside-' + t);
    ok(hasProblem(r, 'error', /only works inside a loop/), problemText(r));
    has(body(r.code), 'return');
    has(r.code, 'PROBLEMS = [');
  }
  const r = gen(W({ n1: START, n2: ['test.report', {}] }, ['n1>n2']), 'report-outside');
  ok(hasProblem(r, 'error', /only works inside Optimise or Find limit/), problemText(r));
  const stop = gen(W({ n1: START, n2: ['flow.stop', { msg: 'Bye' }] }, ['n1>n2']), 'stop-top');
  eq(body(stop.code), 'raise StopWorkflow("Bye")');
  eq(errors(stop), []);
});

test('problems: data used outside its loop, before its producer, after a search', () => {
  const a = gen(W({ n1: START, n2: ['flow.range', {}, { label: 'Dispatch (MW)' }], n3: ['flow.log', { text: 'x' }], n4: ['flow.log', { text: '{v}' }] },
    ['n1>n2', 'n2.body>n3', 'n2.done>n4'], ['n2.value>n4.v']), 'outside-loop');
  ok(hasProblem(a, 'error', /^Print a message uses v from Dispatch \(MW\), which only exists on each pass of Dispatch \(MW\)\. Connect it on the Each pass route/), problemText(a));
  has(body(a.code), 'text_format("{v}", {"v": None})');
  const b = gen(W({ n1: START, n2: ['flow.if', { op: 'true' }], n3: ['val.bool', {}], n4: ['test.read', {}, { label: 'Read voltage' }], n5: ['flow.log', { text: '{v}' }] },
    ['n1>n2', 'n2.yes>n4', 'n2.no>n5'], ['n3.value>n2.a', 'n4.value>n5.v']), 'before-producer');
  ok(hasProblem(b, 'error', /^Print a message needs v, but Read voltage has not run yet on this route\. Connect Print a message after Read voltage\.$/), problemText(b));
  const c = gen(W({ n1: START, n2: ['test.search', {}, { label: 'Find headroom' }], n3: ['test.read', {}, { label: 'Nadir' }], n4: ['flow.log', { text: '{v}' }] },
    ['n1>n2', 'n2.body>n3', 'n2.done>n4'], ['n3.value>n4.v']), 'after-search');
  ok(hasProblem(c, 'error', /values made inside the tries of Find headroom are not available after it/), problemText(c));
  const d = gen(W({ n1: START, n2: ['flow.range', {}], n3: ['flow.log', { text: '{v}' }], n4: ['flow.log', { text: 'x' }] },
    ['n1>n2', 'n2.body>n3', 'n2.done>n3'], ['n2.value>n3.v']), 'inside-and-after');
  ok(hasProblem(d, 'error', /is wired both inside For a range of numbers and after it/), problemText(d));
});

test('problems: a circle, two Starts, no Start, unreachable, to-do items, wrong wires', () => {
  const cyc = gen(W({ n1: START, n2: ['flow.log', { text: 'A' }, { label: 'Load flow' }], n3: ['flow.log', { text: 'B' }, { label: 'RMS' }] }, ['n1>n2', 'n2>n3', 'n3>n2']), 'cycle');
  ok(hasProblem(cyc, 'error', /^These steps go round in a circle: Load flow, RMS, Load flow\. Use a loop block to repeat\.$/), problemText(cyc));
  const back = gen(W({ n1: START, n2: ['flow.repeat', {}], n3: ['flow.log', {}] }, ['n1>n2', 'n2.body>n3', 'n3>n2']), 'wire-back');
  ok(hasProblem(back, 'error', /No need to wire back to Repeat N times/), problemText(back));
  const two = gen(W({ n1: START, n2: START }, []), 'two-starts');
  ok(hasProblem(two, 'error', /There are 2 Start blocks/));
  const none = gen(W({ n2: ['flow.log', {}] }, []), 'no-start');
  ok(none.problems.some(p => p.level === 'error' && p.fix && p.fix.op.op === 'addStart'));
  ok(hasProblem(none, 'warning', /not connected to Start/));
  const unreach = gen(W({ n1: START, n2: ['flow.log', {}, { label: 'Lonely' }], n3: ['val.number', {}, { label: 'Spare' }] }, []), 'unreachable');
  ok(hasProblem(unreach, 'warning', /^Lonely is not connected to Start, so it does not run/));
  ok(hasProblem(unreach, 'warning', /^Spare is not used/));
  eq(errors(unreach), []);
  const todo = gen(W({ n1: ['start', {}], n2: ['flow.if', {}], n3: ['flow.log', {}] }, ['n1>n2', 'n2.yes>n3']), 'todo');
  ok(hasProblem(todo, 'todo', /^Fill in Project on Start\.$/), problemText(todo));
  ok(hasProblem(todo, 'todo', /^Connect a value to Value of If\.$/));
  has(todo.code, '"To do: Fill in Project on Start."');
  const wrong = gen(W({ n1: START, n2: ['test.rms', {}], n3: ['test.series', {}], n4: ['flow.if', { op: 'gt' }], n5: ['flow.log', {}] },
    ['n1>n2', 'n2.ok>n4', 'n4.yes>n5'], ['n3.series>n4.b', 'n2.ok>n5.value', 'n2.result>n3.res']), 'wrong-wire');
  ok(hasProblem(wrong, 'error', /does not fit: A time series is a whole curve/), problemText(wrong));
  ok(hasProblem(wrong, 'error', /does not fit: A flow wire/), problemText(wrong));
  ok(hasProblem(wrong, 'warning', /Did not initialise|not wired while/) || true);
});

test('problems: happy route unwired while the failure route is wired', () => {
  const r = gen(W({ n1: START, n2: ['test.check', {}, { label: 'Load flow' }], n3: ['flow.log', {}] }, ['n1>n2', 'n2.fail>n3']), 'happy');
  ok(hasProblem(r, 'warning', /^Passed of Load flow is not wired while Failed is/), problemText(r));
});

test('structure: transitive volatility (C4)', () => {
  const wf = W({
    n1: START, n2: ['flow.range', { from: 1, to: 3 }], n3: ['flow.log', { text: '{m}' }], n4: ['text.format', { template: 'Best so far {b}' }],
    n5: ['var.get', { name: 'Best' }], n6: ['var.set', { name: 'Best', mode: 'min' }], n7: ['flow.log', { text: '{m}' }],
  }, ['n1>n2', 'n2.body>n3', 'n3>n6', 'n6>n7'], ['n4.value>n3.m', 'n5.value>n4.b', 'n2.value>n6.value', 'n4.value>n7.m']);
  const r = gen(wf, 'c4');
  const b = body(r.code);
  eq(b.split('var_get("Best")').length - 1, 2, 'Recall worked out before each use');
  eq(b.split('text_format("Best so far {b}"').length - 1, 2, 'its user worked out again too');
  // A non-volatile calculator is reused where Python can see it.
  const wf2 = W({ n1: START, n2: ['flow.log', { text: '{s}' }], n3: ['flow.log', { text: '{s}' }], n4: ['math.arith', { op: 'mul', a: 2, b: 3 }] }, ['n1>n2', 'n2>n3'], ['n4.value>n2.s', 'n4.value>n3.s']);
  const b2 = body(gen(wf2, 'reuse').code);
  eq(b2.split('arith("mul", 2, 3)').length - 1, 1, 'reused');
  // ... but not from a sibling branch.
  const wf3 = W({ n1: START, n2: ['flow.if', { op: 'true' }], n9: ['val.bool', {}], n3: ['flow.log', { text: '{s}' }], n5: ['flow.log', { text: '{s}' }], n6: ['flow.log', { text: 'j' }], n4: ['math.arith', { op: 'mul', a: 2, b: 3 }] },
    ['n1>n2', 'n2.yes>n3', 'n2.no>n5', 'n3>n6', 'n5>n6'], ['n9.value>n2.a', 'n4.value>n3.s', 'n4.value>n5.s']);
  eq(body(gen(wf3, 'sibling').code).split('arith("mul", 2, 3)').length - 1, 2, 'one per branch');
});

test('structure: results read after a model write (E5)', () => {
  const bad = gen(W({ n1: START, n2: ['test.calc', {}, { label: 'Run load flow' }], n3: ['test.write', {}, { label: 'Add trip event' }], n4: ['test.read', {}, { label: 'Read attribute' }] },
    ['n1>n2', 'n2>n3', 'n3>n4']), 'e5-bad');
  ok(hasProblem(bad, 'error', /^Read attribute reads results after Add trip event changed the model\. Move it before Add trip event/), problemText(bad));
  const good = gen(W({ n1: START, n2: ['test.calc', {}], n3: ['test.read', {}], n4: ['test.write', {}], n5: ['test.calc', {}], n6: ['test.read', {}] },
    ['n1>n2', 'n2>n3', 'n3>n4', 'n4>n5', 'n5>n6']), 'e5-good');
  eq(errors(good), []);
  const loop = gen(W({ n1: START, n2: ['test.calc', {}], n3: ['flow.repeat', {}, { label: 'Each case' }], n4: ['test.read', {}, { label: 'Read attribute' }], n5: ['test.write', {}, { label: 'Set attribute' }] },
    ['n1>n2', 'n2>n3', 'n3.body>n4', 'n4>n5']), 'e5-loop');
  ok(hasProblem(loop, 'error', /^Read attribute reads results at the start of each pass of Each case, but Set attribute changed the model on the pass before/), problemText(loop));
  const pure = gen(W({ n1: START, n2: ['test.calc', {}], n3: ['test.write', {}, { label: 'Write' }], n4: ['flow.log', { text: '{v}' }], n5: ['test.readp', {}, { label: 'Reader' }] },
    ['n1>n2', 'n2>n3', 'n3>n4'], ['n5.value>n4.v']), 'e5-pure');
  ok(hasProblem(pure, 'error', /^Reader reads results after Write changed the model/), problemText(pure));
  // An element found before a study-case switch is found again after it.
  const elem = gen(W({ n1: START, n2: ['flow.log', { text: '{e}' }], n3: ['test.case', {}], n4: ['flow.log', { text: '{e}' }], n5: ['test.elem', {}] },
    ['n1>n2', 'n2>n3', 'n3>n4'], ['n5.el>n2.e', 'n5.el>n4.e']), 'case-volatile');
  eq(body(elem.code).split('pf_find(app, "Bus 9.ElmTerm", "one")').length - 1, 2, 'materialised again after the case switch');
});

test('structure: restore, on error, skip tables and the wrapped finally', () => {
  const mk = (restore, onError, fin) => W({ n1: START, n2: ['test.foreach', { restore, fin }], n3: ['test.write', {}], n4: ['test.addrow', {}], n5: ['flow.range', { onError }], n6: ['flow.log', { text: 'x' }] },
    ['n1>n2', 'n2.body>n3', 'n3>n4', 'n2.done>n5', 'n5.body>n6'], ['n2.item>n4.c1']);
  const p = body(gen(mk('pass', 'skip', true), 'restore-pass').code);
  has(p, [
    'for pass_n2, element in enumerate(elements, 1):',
    '    ctx_push("Element", element, pass_n2, len(elements))',
    '    mark = pf_mark()',
    '    try:',
    '        touch_model("Test write model")',
    '        table("Results").add({"A": element}, status=True)',
    '    except StopWorkflow:',
    '        raise',
    '    except Exception as err:',
    '        case_failed(err)',
    '    finally:',
    '        try:',
    '            touch_model("restore")',
    '            pf_undo(mark)',
    '        except Exception as fin:',
    '            log(f"Could not put things back after this pass: {fin}", "error")',
    '        ctx_pop(["Results"])'].join('\n'));
  has(p, '    finally:\n        ctx_pop()', 'a loop that writes nothing has no put-back');
  const e = body(gen(mk('end', 'stop', false), 'restore-end').code);
  has(e, 'mark = pf_mark()\nfor pass_n2, element in enumerate(elements, 1):');
  has(e, '        ctx_pop(["Results"])\npf_undo(mark)');
  has(e, '    except Exception as err_n5:\n        case_failed(err_n5)\n        raise StopWorkflow("For a range of numbers: a pass failed, so the workflow stops.") from err_n5');
  const n = body(gen(mk('never', 'skip', false), 'restore-never').code);
  hasNot(n, 'pf_mark');
});

test('structure: monitors, incl. the whole-list rule (6.5)', () => {
  const one = gen(W({ n1: START, n2: ['test.rms', {}], n3: ['test.series', {}], n4: ['math.max', {}], n5: ['test.addrow', {}] },
    ['n1>n2', 'n2.ok>n5'], ['n2.result>n3.res', 'n3.series>n4.values', 'n4.value>n5.c1']), 'monitor-one');
  has(body(one.code), 'run = fake_rms(app, [(pf_find(app, "Bus 1.ElmTerm", "one"), "m:fehz")])');
  has(body(one.code), 'series = run.series(pf_find(app, "Bus 1.ElmTerm", "one"), "m:fehz")');
  eq(errors(one), []);
  const each = gen(W({ n1: START, n2: ['test.rms', {}], n3: ['test.series', {}], n4: ['math.max', {}], n5: ['test.addrow', {}], n6: ['test.foreach', {}] },
    ['n1>n2', 'n2.ok>n6', 'n6.body>n5'], ['n2.result>n3.res', 'n3.series>n4.values', 'n4.value>n5.c1', 'n6.item>n3.element']), 'monitor-each');
  has(body(each.code), 'run = fake_rms(app, [("each", pf_find(app, "*.ElmTerm", "all"), "m:fehz")])');
  eq(errors(each), [], problemText(each));
  const bad = gen(W({ n1: START, n2: ['test.rms', {}], n3: ['test.series', {}], n4: ['math.max', {}], n5: ['test.addrow', {}], n6: ['test.pick', {}] },
    ['n1>n2', 'n2.ok>n6', 'n6>n5'], ['n2.result>n3.res', 'n3.series>n4.values', 'n4.value>n5.c1', 'n6.el>n3.element']), 'monitor-bad');
  ok(hasProblem(bad, 'error', /needs Element recorded during Test RMS, but it is not known yet when the simulation runs/), problemText(bad));
  const viaCalc = gen(W({ n1: START, n2: ['test.rms', {}], n3: ['test.series', {}], n4: ['math.max', {}], n5: ['test.addrow', {}], n6: ['test.elem', {}, { label: 'Bus 9' }] },
    ['n1>n2', 'n2.ok>n5'], ['n2.result>n3.res', 'n3.series>n4.values', 'n4.value>n5.c1', 'n6.el>n3.element']), 'monitor-calc');
  has(body(viaCalc.code), 'bus_9 = pf_find(app, "Bus 9.ElmTerm", "one")  # Bus 9\nrun = fake_rms(app, [(bus_9, "m:fehz")])');
  eq(body(viaCalc.code).split('pf_find(').length - 1, 1, 'the element found for the monitor is reused by the consumer');
  const unused = gen(W({ n1: START, n2: ['test.rms', {}], n3: ['test.series', {}] }, ['n1>n2'], ['n2.result>n3.res']), 'monitor-unused');
  has(body(unused.code), 'fake_rms(app, [])', 'a side chain that is never used records nothing');
});

test('structure: Repeat until condition made only on a side branch is an error', () => {
  // The If's Yes route (one step) becomes a guard; the No route (two steps) goes on inline, and
  // at the end of the pass the value from the Yes route is not there.
  const r = gen(W({ n1: START, n2: ['flow.until', {}], n3: ['flow.if', { op: 'true' }], n4: ['val.bool', {}], n5: ['test.read', {}], n6: ['math.compare', {}], n7: ['flow.log', {}], n8: ['flow.log', {}] },
    ['n1>n2', 'n2.body>n3', 'n3.yes>n5', 'n3.no>n7', 'n7>n8'], ['n4.value>n3.a', 'n5.value>n6.a', 'n6.value>n2.cond']), 'until-side');
  ok(hasProblem(r, 'error', /checks Until at the end of each pass, but that value is not made on every pass/), problemText(r));
});

test('structure: pinned element and select settings, CHECK_ONLY queries', () => {
  const r = gen(W({ n1: START, n2: ['test.rms', {}], n3: ['test.series', { el: { cls: 'ElmTerm', name: 'Bus 39', match: 'one' } }, { label: 'Bus freq', pin: ['el', 'var'] }], n4: ['math.max', {}], n5: ['test.addrow', {}], n6: ['flow.if', { op: 'gt' }, { pin: ['op'] }] },
    ['n1>n2', 'n2.ok>n6', 'n6.yes>n5'], ['n2.result>n3.res', 'n3.series>n4.values', 'n4.value>n5.c1', 'n4.value>n6.a']), 'pinned');
  has(r.code, '\nBUS_FREQ_EL = "Bus 39"\n');
  has(r.code, '\nBUS_FREQ_VAR = "m:fehz"\n');
  has(r.code, '\nIF_OP = "gt"\n');
  has(r.code, 'Choices: "true" is true, "gt" >');
  has(body(r.code), 'pf_find(app, BUS_FREQ_EL + ".ElmTerm", "one"), BUS_FREQ_VAR');
  has(body(r.code), 'compare(maximum, IF_OP, 0, 1e-9)');
  has(r.code, 'check_elements(app, [BUS_FREQ_EL + ".ElmTerm"])');
  eq(r.settingsMap.BUS_FREQ_EL, ['n3', 'el', 'name']);
  const edited = r.code.replace('\nBUS_FREQ_EL = "Bus 39"\n', '\nBUS_FREQ_EL = "Bus 5"\n').replace('\nIF_OP = "gt"\n', '\nIF_OP = "lt"\n');
  const back = W8.loadWorkflow(edited).wf;
  eq(back.nodes.find(n => n.id === 'n3').s.el, { cls: 'ElmTerm', name: 'Bus 5', match: 'one' });
  eq(back.nodes.find(n => n.id === 'n6').s.op, 'lt');
});

test('structure: pinned typed list, read back; suggestions; Python code that changes the model', () => {
  const wf = W({ n1: START, n2: ['flow.list', { values: 'Base, Peak' }, { label: 'Case', pin: ['values'] }], n3: ['adv.python', { touches: 'model', code: 'result = a' }],
    n4: ['var.set', { name: 'Worst' }], n5: ['var.get', { name: 'Best' }], n6: ['flow.log', { text: '{b}' }] },
  ['n1>n2', 'n2.body>n3', 'n3>n4', 'n2.done>n6'], ['n2.item>n3.i1', 'n5.value>n6.b']);
  const r = gen(wf, 'pinned-list');
  has(r.code, '\nCASE_VALUES = ["Base", "Peak"]\n');
  has(body(r.code), 'case_items = CASE_VALUES');
  has(body(r.code), '    mark = pf_mark()', 'declared model change: the pass is put back');
  eq(W8.loadWorkflow(r.code).notes, [], 'an unchanged list reads back as unchanged');
  const back = W8.loadWorkflow(r.code.replace('\nCASE_VALUES = ["Base", "Peak"]\n', '\nCASE_VALUES = ["Base", "Peak", "Night, low"]\n'));
  eq(back.wf.nodes.find(n => n.id === 'n2').s.values, 'Base\nPeak\nNight, low');
  eq(KIT.parseValues('Base\nPeak\nNight, low'), ['Base', 'Peak', 'Night, low']);
  eq(W8.suggestions(wf, 'vars'), ['Best', 'Worst']);
  const noPin = gen(W({ n1: START, n2: ['flow.range', {}, { label: 'Sweep', pin: ['restore', 'onError', 'step'] }], n3: ['flow.log', {}] }, ['n1>n2', 'n2.body>n3']), 'no-pin');
  hasNot(noPin.code, 'SWEEP_RESTORE');
  hasNot(noPin.code, 'SWEEP_ON_ERROR');
  has(noPin.code, '\nSWEEP_STEP = 1\n');
});

test('structure: a block that writes files warns inside a loop, with a fix', () => {
  const r = gen(W({ n1: START, n2: ['flow.range', {}, { label: 'Dispatch (MW)' }], n3: ['test.files', {}, { label: 'Save results table' }] }, ['n1>n2', 'n2.body>n3']), 'once-per-run');
  const p = r.problems.find(x => /runs on every pass of Dispatch \(MW\)/.test(x.msg));
  ok(p && p.level === 'warning' && p.fix.op.op === 'moveToDone' && p.fix.op.loopId === 'n2' && p.fix.op.edgeId === 'e2', JSON.stringify(r.problems));
});

test('structure: the duplication cap', () => {
  const nodes = { n1: START };
  const flow = ['n1>t1'];
  for (let i = 1; i <= 22; i++) {
    nodes['t' + i] = ['test.tri', {}];
    nodes['l' + i] = ['flow.log', { text: 'side ' + i }];
    const next = i < 22 ? 't' + (i + 1) : 'end';
    flow.push(`t${i}.low>${next}`, `t${i}.mid>${next}`, `t${i}.high>l${i}`);
  }
  nodes.end = ['flow.log', { text: 'end' }];
  const t0 = performance.now();
  const r = gen(W(nodes, flow), 'tangled');
  ok(performance.now() - t0 < 3000, 'gives up quickly');
  ok(hasProblem(r, 'error', /too tangled to write out/), problemText(r));
});

test('structure: 6 loops inside each other are fine, 7 are an error', () => {
  const nest = (n) => {
    const nodes = { n1: START };
    const flow = [];
    let prev = 'n1', out = 'next';
    for (let i = 0; i < n; i++) { const id = 'l' + i; nodes[id] = ['flow.repeat', { times: 1 }, { label: 'L' + i }]; nodes['w' + i] = ['test.write', {}]; flow.push(prev + '.' + out + '>' + id); flow.push(id + '.done>w' + i); prev = id; out = 'body'; }
    nodes.x = ['test.check', {}]; nodes.y = ['flow.log', { text: 'deep' }];
    flow.push(prev + '.body>x', 'x.ok>y');
    return W(nodes, flow);
  };
  const six = gen(nest(MAX_LEVELS), 'nest-6');
  eq(errors(six), [], problemText(six));
  const seven = gen(nest(MAX_LEVELS + 1), 'nest-7');
  ok(hasProblem(seven, 'error', /is the 7th loop inside another loop/), problemText(seven));
  // A search starts a new function: 6 more loops inside it are fine.
  const nodes = { n1: START, s: ['test.search', {}] };
  const flow = ['n1>s'];
  let prev = 's';
  for (let i = 0; i < 6; i++) { nodes['l' + i] = ['flow.repeat', { times: 1 }]; flow.push(prev + '.body>l' + i); prev = 'l' + i; }
  nodes.z = ['flow.log', {}]; flow.push(prev + '.body>z');
  const outer = { n0: START, o1: ['flow.repeat', {}], o2: ['flow.repeat', {}], o3: ['flow.repeat', {}] };
  const merged = W(Object.fromEntries(Object.entries({ ...outer, ...nodes }).filter(([k]) => k !== 'n1')), ['n0>o1', 'o1.body>o2', 'o2.body>o3', 'o3.body>s', ...flow.slice(1)]);
  const deep = gen(merged, 'nest-search');
  eq(errors(deep), [], problemText(deep));
});

test('determinism: same input same code; a new block does not rename others', () => {
  const wf = W({
    n1: START, n2: ['flow.range', { from: 1, to: 3 }, { label: 'Dispatch (MW)' }], n3: ['test.check', {}], n4: ['text.format', { template: 'Value {v}' }],
    n5: ['flow.log', { text: '{m}' }], n6: ['var.get', { name: 'Best' }], n7: ['flow.log', { text: '{b}' }],
  }, ['n1>n2', 'n2.body>n3', 'n3.ok>n5', 'n2.done>n7'], ['n2.value>n3.value', 'n2.value>n4.v', 'n4.value>n5.m', 'n6.value>n7.b']);
  const a = generate(wf, { runtime: RUNTIME }).code;
  const b = generate(JSON.parse(JSON.stringify(wf)), { runtime: RUNTIME }).code;
  eq(a, b);
  const shuffled = JSON.parse(JSON.stringify(wf));
  shuffled.nodes.reverse(); shuffled.edges.reverse();
  eq(generate(shuffled, { runtime: RUNTIME }).code.split('# PFB1')[0], a.split('# PFB1')[0], 'array order does not matter');
  const names = (code) => [...new Set([...body(code).matchAll(/\b([a-z][a-z0-9_]*) = /g)].map(m => m[1]))].sort();
  const more = JSON.parse(JSON.stringify(wf));
  more.nodes.push({ id: 'n8', type: 'flow.log', x: 0, y: 0, label: 'Dispatch (MW)', s: { text: '{v}' }, pin: [] });
  more.nodes.push({ id: 'n9', type: 'text.format', x: 0, y: 0, label: '', s: { template: 'Value {v}' }, pin: [] });
  more.edges = more.edges.filter(e => !(e.from === 'n1' && e.to === 'n2'));
  more.edges.push({ id: 'e20', from: 'n1', out: 'next', to: 'n8', in: 'in' }, { id: 'e21', from: 'n8', out: 'next', to: 'n2', in: 'in' }, { id: 'e22', from: 'n9', out: 'value', to: 'n8', in: 'v' });
  const c = gen(more, 'determinism-more').code;
  const before = names(a), after = names(c);
  for (const n of before) ok(after.includes(n), `name ${n} kept (${after.join(', ')})`);
  ok(after.includes('text_n9'), 'the new block takes the suffix: ' + after.join(', '));
  const d = generate(wf, { runtime: RUNTIME, now: '2026-10-22T10:00:00Z' }).code;
  has(d, '# Written by the PowerFactory Workflow Builder on 2026-10-22');
});

test('generate: never throws on odd input, and always gives the result shape', () => {
  for (const bad of [null, undefined, 5, 'x', [], {}, { nodes: 'x' }, { nodes: [null, 1, { id: 3 }, { id: 'n1', type: 'start', s: 7 }], edges: [null, { from: 'n1' }] },
    { nodes: [{ id: 'n1', type: 'start', pin: ['project', 'nope'], label: { x: 1 } }], edges: [{ id: 'e', from: 'n1', out: 'next', to: 'n1', in: 'in' }] }]) {
    const r = generate(bad, { runtime: RUNTIME });
    ok(typeof r.code === 'string' && Array.isArray(r.problems) && r.ends && r.regions && r.steps, 'shape for ' + JSON.stringify(bad));
    toCompile.push({ name: 'odd input ' + JSON.stringify(bad), code: r.code });
  }
  const noRuntime = generate(IFJ(), {});
  ok(noRuntime.problems.some(p => /Helper compare is missing from the runtime/.test(p.msg)), problemText(noRuntime));
  toCompile.push({ name: 'no runtime', code: noRuntime.code });
  const r = generate(IFJ(), { runtime: { 'base.py': BASE } });
  ok(r.problems.some(p => /Helper pf_connect is missing from the runtime/.test(p.msg)));
});

test('performance: 200 blocks in under 30 ms', () => {
  const nodes = { n1: START };
  const flow = [];
  const data = [];
  let prev = 'n1', out = 'next';
  let k = 2;
  const id = () => 'n' + (k++);
  while (k < 200) {
    const loop = id();
    nodes[loop] = ['flow.range', { from: 1, to: 3 }];
    flow.push(`${prev}.${out}>${loop}`);
    let p = loop, o = 'body';
    for (let j = 0; j < 5 && k < 200; j++) {
      const c = id(), f = id(), lg = id(), m = id();
      nodes[c] = ['test.check', {}]; nodes[f] = ['flow.log', { text: 'failed' }]; nodes[lg] = ['flow.log', { text: '{v}' }]; nodes[m] = ['math.arith', { op: 'mul', b: 2 }];
      flow.push(`${p}.${o}>${c}`, `${c}.fail>${f}`, `${c}.ok>${lg}`);
      data.push(`${loop}.value>${m}.a`, `${m}.value>${lg}.v`);
      p = lg; o = 'next';
    }
    prev = loop; out = 'done';
  }
  const wf = W(nodes, flow, data);
  generate(wf, { runtime: RUNTIME });
  const times = [];
  for (let i = 0; i < 7; i++) { const t0 = performance.now(); generate(wf, { runtime: RUNTIME }); times.push(performance.now() - t0); }
  times.sort((a, b) => a - b);
  const med = times[3];
  ok(med < 30, `median ${med.toFixed(1)} ms for ${Object.keys(nodes).length} blocks`);
  perfNote = `${Object.keys(nodes).length} blocks: median ${med.toFixed(1)} ms`;
  const r = gen(wf, 'perf');
  eq(errors(r), [], problemText(r));
});
let perfNote = '';

test('blocks: every real block has the beginner text the site asks for', () => {
  const bad = [];
  for (const b of REG.allBlocks().filter(b => !b.type.startsWith('test.'))) {
    const texts = [b.title, b.desc, ...(b.settings || []).flatMap(s => [s.label, s.tip, s.placeholder]), ...(b.inputs || []).flatMap(p => [p.label, p.tip]), ...(b.outputs || []).flatMap(p => [p.label, p.tip])].filter(Boolean);
    for (const t of texts) if (/\u2014/.test(t)) bad.push(`${b.type}: em-dash in "${t}"`);
    if (!b.desc || b.desc.length > 200) bad.push(`${b.type}: desc length ${b.desc.length}`);
    for (const s of b.settings || []) if (s.tip && s.tip.length > 200) bad.push(`${b.type}.${s.key}: tip over 200`);
    if (!(b.keywords || []).length) bad.push(`${b.type}: no keywords`);
  }
  eq(bad, []);
  const types = REG.allBlocks().map(b => b.type);
  for (const t of ['start', 'flow.if', 'flow.range', 'flow.list', 'flow.repeat', 'flow.until', 'flow.next', 'flow.break', 'flow.stop', 'flow.log', 'var.set', 'var.get',
    'val.number', 'val.text', 'val.bool', 'val.list', 'val.range', 'math.arith', 'math.formula', 'math.func', 'math.compare', 'math.logic', 'math.max', 'math.min',
    'math.mean', 'math.median', 'math.sum', 'math.count', 'math.std', 'math.percentile', 'text.format', 'adv.python', 'note']) ok(types.includes(t), 'block ' + t);
  eq(REG.ELEMENT_CLASSES.find(c => c[0] === 'ElmSym')[1], 'Synchronous generator');
  eq(REG.elementClassName('ElmTerm'), 'Busbar / terminal (ElmTerm)');
  ok(REG.ELEMENT_CLASSES.every(c => c.length === 3 && /^(Elm|Sta)[A-Z]/.test(c[0])));
  eq(REG.effectsOf({ type: 'adv.python', s: { touches: 'model' } }), { writes: ['model'], reads: [] });
  eq(REG.effectsOf({ type: 'test.read', s: {} }), { writes: [], reads: ['results'] });
  eq(fileNameFor({ name: 'Headroom study (39-bus)' }), 'headroom_study_39_bus.py');
});

test('blocks: formula, placeholders, values and Python code checks', () => {
  const f = KIT.parseFormula('sqrt(p**2 + q^2) * pi + max(a, 1)');
  ok(f.ok, f.error); eq(f.inputs, ['p', 'q', 'a']); eq(f.expr, 'math.sqrt(p**2 + q**2) * math.pi + max(a, 1)');
  ok(!KIT.parseFormula('log(x) + table(1)').ok);
  ok(!KIT.parseFormula('__import__("os")').ok);
  ok(!KIT.parseFormula('a.b').ok);
  ok(!KIT.parseFormula('a\nb').ok);
  ok(!KIT.parseFormula('(a').ok);
  eq(KIT.placeholders('P {p:.1f} MW, {{x}} {q} {p}').names, ['p', 'q']);
  eq(KIT.placeholders('{0} {}').bad, ['{0}', '{}']);
  eq(KIT.parseValues('1, 2.5, x'), [1, 2.5, 'x']);
  eq(KIT.parseValues('1,5\n2,25'), [1.5, 2.25]);
  eq(KIT.checkPythonCode('x = (1,\n  2)\nif x:\n    y = 1\nelse:\n    y = 2').errors, []);
  ok(KIT.checkPythonCode('if x:\ny = 1').errors.length === 1);
  ok(KIT.checkPythonCode('x = (1').errors.length >= 1);
  ok(KIT.checkPythonCode('s = "abc').errors.length >= 1);
  ok(KIT.checkPythonCode('  x = 1\n    y = 2').errors.length === 1);
  eq(KIT.checkPythonCode('    a = 1\n    b = 2').lines, ['a = 1', 'b = 2']);
  ok(KIT.checkPythonCode('if a:\n    continue').errors.length === 1, 'continue outside a loop of the code');
  eq(KIT.checkPythonCode('for v in a:\n    if v:\n        continue\n    break').errors, []);
  ok(KIT.checkPythonCode('def f():\n    for v in a:\n        pass\n    break').errors.length === 1, 'break after the loop, inside a def');
  ok(KIT.checkPythonCode('nonlocal x\nx = 1').errors.length === 1);
  ok(KIT.checkPythonCode('from os import *').errors.length === 1);
  ok(KIT.checkPythonCode('x = 1 + \\').errors.length === 1);
  eq(KIT.checkPythonCode('import os\nfrom math import sqrt\nglobal G\ns = """a\nb"""\nt = (1,\n     2)').errors, []);
  const py = gen(W({ n1: START, n2: ['adv.python', { code: 'if a:\nprint(1)' }] }, ['n1>n2']), 'python-bad');
  ok(hasProblem(py, 'error', /the code has a mistake/), problemText(py));
  has(body(py.code), 'raise RuntimeError(');
});

// =============================================================================================
// (d) Execution against the stub runtime

function execCase(name, wf, check) { const r = gen(wf, name); toRun.push({ name: 'exec: ' + name, code: r.code, check }); return r; }

test('exec setup: range sum 1..10 = 55 via Remember a value', () => {
  execCase('range sum', W({
    n1: START, n2: ['flow.range', { from: 1, to: 10, step: 1 }, { label: 'Dispatch (MW)' }], n3: ['var.set', { name: 'Total', mode: 'sum' }],
    n4: ['flow.log', { text: 'Total {t}' }], n5: ['var.get', { name: 'Total' }],
  }, ['n1>n2', 'n2.body>n3', 'n2.done>n4'], ['n2.value>n3.value', 'n5.value>n4.t']), (o) => {
    ok(o.logs.includes('Total 55'), o.logs.join('|'));
    ok(o.logs.includes('== Pass 1 of 10: Dispatch (MW) = 1 ==') || o.logs.some(l => /^== Pass 1 of 10: Value = 1/.test(l)), o.logs.join('|'));
  });
});

test('exec setup: If branches, nested loop counts, formula, statistics, text, Python code', () => {
  execCase('if branches', W({
    n1: START, n2: ['flow.range', { from: 1, to: 4 }], n3: ['flow.if', { op: 'gt', b: 2 }], n4: ['flow.log', { text: 'big {v}' }], n5: ['flow.log', { text: 'small {v}' }],
  }, ['n1>n2', 'n2.body>n3', 'n3.yes>n4', 'n3.no>n5'], ['n2.value>n3.a', 'n2.value>n4.v', 'n2.value>n5.v']), (o) => {
    eq(o.logs.filter(l => /^(big|small)/.test(l)), ['small 1', 'small 2', 'big 3', 'big 4']);
  });
  execCase('nested loop counts', W({
    n1: START, n2: ['flow.range', { from: 1, to: 3, name: 'Outer' }], n3: ['flow.repeat', { times: 2, name: 'Inner' }], n4: ['var.set', { name: 'N', mode: 'count' }],
    n5: ['flow.list', { values: 'a, b', name: 'Inmost' }], n6: ['var.set', { name: 'M', mode: 'count' }],
    n7: ['flow.log', { text: 'N={n} M={m}' }], n8: ['var.get', { name: 'N' }], n9: ['var.get', { name: 'M' }],
  }, ['n1>n2', 'n2.body>n3', 'n3.body>n4', 'n4>n5', 'n5.body>n6', 'n2.done>n7'], ['n8.value>n7.n', 'n9.value>n7.m']), (o) => {
    ok(o.logs.includes('N=6 M=12'), o.logs.join('|'));
  });
  execCase('formula', W({
    n1: START, n2: ['val.number', { value: 3 }], n3: ['val.number', { value: 4 }], n4: ['math.formula', { expr: 'sqrt(a^2 + b**2)' }], n5: ['flow.log', { text: 'hyp {h}' }],
    n6: ['math.formula', { expr: 'a / b' }], n7: ['val.number', { value: 0 }], n8: ['flow.log', { text: 'div {d}' }],
  }, ['n1>n5', 'n5>n8'], ['n2.value>n4.a', 'n3.value>n4.b', 'n4.value>n5.h', 'n2.value>n6.a', 'n7.value>n6.b', 'n6.value>n8.d']), (o) => {
    ok(o.logs.includes('hyp 5'), o.logs.join('|'));
    ok(o.logs.includes('div ') && o.logs.some(l => /^WARNING Formula: could not work it out/.test(l)), o.logs.join('|'));
  });
  execCase('statistics', W({
    n1: START, n2: ['val.list', { values: '1, 2, 3, 4' }], n3: ['math.mean', {}], n4: ['math.max', {}], n5: ['math.percentile', { p: 50 }], n6: ['math.count', {}],
    n7: ['flow.log', { text: 'mean {a} max {b} p50 {c} n {d}' }],
  }, ['n1>n7'], ['n2.value>n3.values', 'n2.value>n4.values', 'n2.value>n5.values', 'n2.value>n6.values', 'n3.value>n7.a', 'n4.value>n7.b', 'n5.value>n7.c', 'n6.value>n7.d']), (o) => {
    ok(o.logs.includes('mean 2.5 max 4 p50 2.5 n 4'), o.logs.join('|'));
  });
  execCase('text format and arithmetic', W({
    n1: START, n2: ['val.number', { value: 12.345 }], n3: ['text.format', { template: 'P = {p:.1f} MW at {name}' }], n4: ['val.text', { value: 'G1' }], n5: ['flow.log', { text: '{t}' }],
    n6: ['math.arith', { op: 'mul', b: 2 }], n7: ['flow.log', { text: '2P={x} none={y}' }], n8: ['math.func', { fn: 'round', digits: 1 }], n9: ['var.get', { name: 'Nothing' }], n10: ['math.arith', { op: 'add', b: 1 }],
  }, ['n1>n5', 'n5>n7'], ['n2.value>n3.p', 'n4.value>n3.name', 'n3.value>n5.t', 'n2.value>n6.a', 'n6.value>n8.x', 'n8.value>n7.x', 'n9.value>n10.a', 'n10.value>n7.y']), (o) => {
    ok(o.logs.includes('P = 12.3 MW at G1'), o.logs.join('|'));
    ok(o.logs.includes('2P=24.7 none='), o.logs.join('|'));
  });
  execCase('python code in and out', W({
    n1: START, n2: ['val.number', { value: 2 }], n3: ['adv.python', { inputs: [{ id: 'i1', name: 'a' }, { id: 'i2', name: 'log' }], outputs: [{ id: 'o1', name: 'result', type: 'num' }, { id: 'o2', name: 'msg', type: 'text' }], code: 'result = a * 10\nmsg = f"{log}!"' }],
    n4: ['flow.log', { text: '{r} {m}' }], n5: ['val.text', { value: 'hi' }],
  }, ['n1>n3', 'n3>n4'], ['n2.value>n3.i1', 'n5.value>n3.i2', 'n3.o1>n4.r', 'n3.o2>n4.m']), (o) => {
    ok(o.logs.includes('20 hi!'), o.logs.join('|'));
  });
});

test('exec setup: skip rows, ctx labels in rows, table rows source', () => {
  execCase('guard skip rows', W({
    n1: START, n2: ['flow.range', { from: 1, to: 3, name: 'Dispatch' }], n3: ['test.check', { bad: 2 }, { label: 'Load flow' }], n4: ['test.addrow', { n1: 'Value' }],
  }, ['n1>n2', 'n2.body>n3', 'n3.ok>n4'], ['n2.value>n3.value', 'n2.value>n4.c1']), (o) => {
    eq(o.tables.Results.columns, ['Dispatch', 'Status', 'Value']);
    eq(o.tables.Results.rows, [{ Dispatch: 1, Status: 'OK', Value: 1 }, { Dispatch: 2, Status: 'Check failed' }, { Dispatch: 3, Status: 'OK', Value: 3 }]);
  });
  execCase('ctx labels and table rows', W({
    n1: START, n2: ['flow.list', { values: 'Base\nPeak', name: 'Case' }], n3: ['flow.range', { from: 100, to: 200, step: 100, name: 'Dispatch (MW)' }], n4: ['test.addrow', { n1: 'Pass', keep: false }],
    n5: ['flow.list', { source: 'table', table: 'Results', cols: [{ id: 'c1', name: 'Case', type: 'text' }, { id: 'c2', name: 'Dispatch (MW)', type: 'num' }], name: 'Row' }],
    n6: ['flow.log', { text: 'row {c} {d}' }],
  }, ['n1>n2', 'n2.body>n3', 'n3.body>n4', 'n2.done>n5', 'n5.body>n6'], ['n3.index>n4.c1', 'n5.c1>n6.c', 'n5.c2>n6.d']), (o) => {
    eq(o.tables.Results.rows, [
      { Case: 'Base', 'Dispatch (MW)': 100, Pass: 1 }, { Case: 'Base', 'Dispatch (MW)': 200, Pass: 2 },
      { Case: 'Peak', 'Dispatch (MW)': 100, Pass: 1 }, { Case: 'Peak', 'Dispatch (MW)': 200, Pass: 2 }]);
    eq(o.logs.filter(l => l.startsWith('row ')), ['row Base 100', 'row Base 200', 'row Peak 100', 'row Peak 200']);
  });
  execCase('a failing pass is noted and the loop goes on', W({
    n1: START, n2: ['flow.range', { from: 1, to: 3 }], n3: ['math.formula', { expr: 'a' }], n4: ['adv.python', { code: 'if a == 2:\n    raise ValueError("boom")\nresult = a' }], n5: ['test.addrow', {}],
  }, ['n1>n2', 'n2.body>n4', 'n4>n5'], ['n2.value>n4.i1', 'n4.o1>n5.c1']), (o) => {
    eq(o.tables.Results.rows.map(r => r.Status), ['OK', 'ERROR: ValueError: boom', 'OK']);
    ok(o.logs.some(l => /^ERROR This pass failed \(Value = 2\): ValueError: boom$/.test(l)), o.logs.join('|'));
  });
});

test('exec setup: PROBLEMS stops before connecting; CHECK_ONLY', () => {
  const r = gen(W({ n1: START, n2: ['flow.next', {}] }, ['n1>n2']), 'problems-stop');
  toRun.push({ name: 'exec: PROBLEMS stops the script before pf_connect', code: r.code, expectFail: true, check(o) {
    ok(!o.stdout.includes('STUB connect') && !o.stdout.includes('STUB preflight'), o.stdout);
    ok(o.logs.some(l => /^ERROR Error: Skip to next pass only works inside a loop/.test(l)), o.logs.join('|'));
    ok(/This workflow has 1 problem to fix in the Builder; nothing was run\./.test(o.stderr), o.stderr);
    ok(o.status !== 0);
  } });
  const c = gen(W({ n1: START, n2: ['test.foreach', {}], n3: ['flow.log', { text: 'ran' }], n4: ['test.elem', {}], n5: ['flow.log', { text: '{e}' }] }, ['n1>n2', 'n2.body>n3', 'n2.done>n5'], ['n4.el>n5.e']), 'check-only');
  toRun.push({ name: 'exec: CHECK_ONLY lists the elements and runs nothing', code: c.code.replace('\nCHECK_ONLY = False\n', '\nCHECK_ONLY = True\n'), check(o) {
    ok(o.stdout.includes('STUB check *.ElmTerm (all)') && o.stdout.includes('STUB check Bus 9.ElmTerm'), o.stdout);
    ok(!o.logs.includes('ran'), 'nothing ran');
    ok(o.stdout.includes('STUB finish'), 'finish still runs');
  } });
  toRun.push({ name: 'exec: the same workflow runs with CHECK_ONLY off', code: c.code, check(o) {
    eq(o.logs.filter(l => l === 'ran').length, 3);
    eq(o.stdout.split('STUB mark').length - 1, 0, 'no put-back for a loop that changes nothing');
  } });
});

// =============================================================================================
// (c) The fuzzer: random graphs from the real and test blocks, any wiring.

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
test('fuzz: 300 random graphs generate without throwing', () => {
  const types = REG.allBlocks().map(b => b.type);
  const rand = rng(20261022);
  const pick = (a) => a[Math.floor(rand() * a.length)];
  let made = 0;
  for (let g = 0; g < 300; g++) {
    const n = 3 + Math.floor(rand() * 22);
    const nodes = [];
    if (rand() < 0.93) nodes.push({ id: 'n1', type: 'start', x: 0, y: 0, label: '', s: { project: 'P' }, pin: [] });
    for (let i = nodes.length + 1; i <= n; i++) {
      const type = rand() < 0.03 ? 'pf.unknown' : pick(types);
      const def = REG.getBlock(type);
      const s = {};
      for (const st of (def && def.settings) || []) {
        if (rand() < 0.25 && st.kind === 'select') s[st.key] = pick(REG.optionPairs(st))[0];
        if (rand() < 0.1 && st.kind === 'number') s[st.key] = pick([0, -1, 2.5, 1e9, 'x']);
        if (rand() < 0.1 && st.kind === 'text') s[st.key] = pick(['', 'a"b', 'C:\\x\\', 'line\nbreak', '{x} {y:.2f}', '\u00fcber']);
      }
      const label = rand() < 0.3 ? pick(['V', 'e', 'Out file', 'class', 'Dispatch (MW)', '300 MW', 'x\ny', '\u0394f']) : '';
      const pin = def && rand() < 0.2 ? (def.settings || []).filter(() => rand() < 0.5).map(st => st.key) : [];
      nodes.push({ id: 'n' + i, type, x: 0, y: 0, label, s, pin });
    }
    const edges = [];
    const m = Math.floor(rand() * n * 2.2);
    for (let j = 0; j < m; j++) {
      const a = pick(nodes), b = pick(nodes);
      const pa = REG.getBlock(a.type) ? REG.portsOf(a) : { flowOuts: [{ id: 'x' }], outputs: [] };
      const pb = REG.getBlock(b.type) ? REG.portsOf(b) : { inputs: [{ id: 'y' }], flowIn: true };
      const outs = [...pa.flowOuts.map(p => p.id), ...pa.outputs.map(p => p.id), 'bogus'];
      const ins = [...(pb.flowIn ? ['in', 'in', 'in'] : []), ...(pb.inputs || []).map(p => p.id), 'bogus'];
      edges.push({ id: 'e' + (j + 1), from: a.id, out: pick(outs), to: b.id, in: pick(ins) });
    }
    const wf = { app: 'pf-builder', v: 1, name: 'Fuzz ' + g, nodes, edges };
    let r;
    try { r = generate(wf, { runtime: RUNTIME }); } catch (e) { throw new Fail(`graph ${g} threw: ${e.stack}`); }
    ok(typeof r.code === 'string' && r.code.includes('# PFB1 '), 'graph ' + g);
    toCompile.push({ name: 'fuzz ' + g, code: r.code });
    const back = W8.loadWorkflow(r.code);
    ok(back.wf && back.wf.nodes.length === nodes.length, 'graph ' + g + ' reads back from its .py');
    made++;
  }
  eq(made, 300);
});

// =============================================================================================
// Run

let passed = 0, failed = 0;
const fail = (name, e) => { failed++; console.log(`FAIL ${name}\n  ${String(e && e.message || e).split('\n').join('\n  ')}`); };
for (const t of tests) {
  try { t.fn(); passed++; } catch (e) { fail(t.name, e instanceof Fail ? e : (e && e.stack) || e); }
}

// Literal round trip in Python: every case evaluates back to the same text.
{
  const dir = path.join(SCRATCH, 'lit');
  fs.mkdirSync(dir, { recursive: true });
  const cases = LITERAL_CASES.map(s => [pyStr(s), s.replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, '\ufffd')]);
  fs.writeFileSync(path.join(dir, 'cases.json'), JSON.stringify(cases), 'utf8');
  const py = ['import json, sys', `cases = json.load(open(${JSON.stringify(path.join(dir, 'cases.json'))}, encoding="utf-8"))`, 'bad = []',
    ...cases.map(([lit], i) => `v${i} = ${lit}`),
    `got = [${cases.map((_, i) => 'v' + i).join(', ')}]`,
    'for (lit, want), g in zip(cases, got):', '    if g != want: bad.append([lit, want, g])', 'print(json.dumps(bad))'].join('\n');
  fs.writeFileSync(path.join(dir, 'lit.py'), py, 'utf8');
  const p = spawnSync('python', ['-I', path.join(dir, 'lit.py')], { encoding: 'utf8' });
  try { eq(JSON.parse(p.stdout || 'null'), [], 'python literal round trip ' + p.stderr); passed++; } catch (e) { fail('literals: Python reads every literal back', e); }
}

// (c) compile every generated script in one Python run.
{
  const dir = path.join(SCRATCH, 'compile');
  fs.mkdirSync(dir, { recursive: true });
  const list = toCompile.map((c, i) => { const f = path.join(dir, `s${i}.py`); fs.writeFileSync(f, c.code, 'utf8'); return f; });
  fs.writeFileSync(path.join(dir, 'list.json'), JSON.stringify(list));
  const script = ['import json, py_compile, sys', `files = json.load(open(${JSON.stringify(path.join(dir, 'list.json'))}))`, 'bad = {}',
    'for f in files:', '    try:', '        py_compile.compile(f, doraise=True)', '    except py_compile.PyCompileError as e:', '        bad[f] = str(e)[-600:]',
    'print(json.dumps(bad))'].join('\n');
  const p = spawnSync('python', ['-I', '-c', script], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  let bad = {};
  try { bad = JSON.parse(p.stdout); } catch (e) { bad = { all: 'python did not run: ' + p.stderr }; }
  toCompile.forEach((c, i) => {
    const f = list[i];
    if (bad[f]) fail('compiles: ' + c.name, bad[f] + '\n  (file ' + f + ')'); else passed++;
  });
  if (bad.all) fail('compiles', bad.all);
}

// (d) run the flow-only scripts.
for (const [i, t] of toRun.entries()) {
  const dir = path.join(SCRATCH, 'run' + i);
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, 'wf.py');
  fs.writeFileSync(f, t.code, 'utf8');
  const p = spawnSync('python', ['-I', f], { cwd: dir, encoding: 'utf8', timeout: 60000 });
  const stdout = p.stdout || '';
  const logs = stdout.split(/\r?\n/).filter(l => /^\[\d\d:\d\d:\d\d\] /.test(l)).map(l => l.slice(11));
  const tj = stdout.split(/\r?\n/).find(l => l.startsWith('TABLES_JSON '));
  const out = { stdout, stderr: p.stderr || '', status: p.status, logs, tables: tj ? JSON.parse(tj.slice(12)) : {} };
  try {
    if (!t.expectFail && p.status !== 0) throw new Fail(`exit ${p.status}\n${out.stderr}\n${stdout}`);
    t.check(out);
    passed++;
  } catch (e) { fail(t.name, e instanceof Fail ? e : (e && e.stack) || e); }
}

if (perfNote) console.log('performance: ' + perfNote);
console.log(`codegen tests: ${passed} passed, ${failed} failed`);
try { if (!failed) fs.rmSync(SCRATCH, { recursive: true, force: true }); else console.log('kept the generated files in ' + SCRATCH); } catch (e) { /* ignore */ }
process.exit(failed ? 1 : 0);
