// A smoke test for the PSCAD Workflow Builder's generator: every block loads, a real workflow
// generates, and the script it writes compiles with Python.
//
// Run from the repo root:   node pscad-scripter/builder/_audit/codegen/smoke.mjs
//                          node pscad-scripter/builder/_audit/codegen/smoke.mjs --print <name>
//
// It is the quick check while the blocks are being written; _audit/codegen/run.mjs is the full
// suite. Prints "smoke: N passed, M failed" and exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILDER = path.resolve(HERE, '..', '..');
const imp = (rel) => import(pathToFileURL(path.join(BUILDER, rel)).href);

await imp('js/blocks/index.js');
const { generate } = await imp('js/core/codegen.js');
const R = await imp('js/core/registry.js');
const RL = await imp('js/core/runtime-loader.js');

// generate() takes the runtime as the raw files, and slices them itself.
const RUNTIME = Object.fromEntries(RL.RUNTIME_FILES.map(
  f => [f, fs.readFileSync(path.join(BUILDER, 'runtime', f), 'utf8')]));
const LIB = RL.parseRuntime(RUNTIME);

let passed = 0;
const failed = [];
const printOnly = process.argv.includes('--print') ? process.argv[process.argv.indexOf('--print') + 1] : '';

function ok(label, cond, detail = '') {
  if (cond) { passed++; return true; }
  failed.push(label + (detail ? '  ' + detail : ''));
  console.log('  FAIL ' + label + (detail ? '  ' + detail : ''));
  return false;
}

function W(nodes, flow = [], data = [], name = 'Smoke workflow') {
  const ns = Object.entries(nodes).map(([id, [type, s = {}, extra = {}]]) =>
    ({ id, type, x: 0, y: 0, label: extra.label || '', s, pin: extra.pin || [] }));
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
  return { app: 'pscad-builder', v: 1, name, nodes: ns, edges, view: { x: 0, y: 0, zoom: 1 } };
}

const START = ['start', { project: 'C:\\work\\mycase.pscx' }];
const toCompile = [];

function gen(label, wf) {
  let r;
  try {
    r = generate(wf, { runtime: RUNTIME });
  } catch (err) {
    ok(label + ': generates', false, String(err && err.stack || err).split('\n').slice(0, 3).join(' | '));
    return null;
  }
  const errs = r.problems.filter(p => p.level === 'error');
  ok(label + ': no errors', errs.length === 0, errs.map(p => p.msg).join(' | ').slice(0, 300));
  ok(label + ': wrote code', typeof r.code === 'string' && r.code.length > 500);
  toCompile.push({ name: label, code: r.code });
  if (printOnly && printOnly === label) console.log(r.code);
  return r;
}

// ------------------------------------------------------------------ every block is defined
const all = R.allBlocks();
console.log(`registry: ${all.length} blocks, ${R.allFamilies().length} families`);
ok('every block has a title', all.every(b => b.title && b.title.length > 1));
ok('every block has a description', all.every(b => b.desc && b.desc.length > 10));
ok('no description over 200 characters', all.every(b => b.desc.length <= 200),
  all.filter(b => b.desc.length > 200).map(b => `${b.type} (${b.desc.length})`).join(', '));
ok('every block has keywords', all.every(b => Array.isArray(b.keywords) && b.keywords.length));
ok('no em dash in any block text', all.every(b => !/[\u2014\u2013]/.test(b.title + b.desc)),
  all.filter(b => /[\u2014\u2013]/.test(b.title + b.desc)).map(b => b.type).join(', '));
const pxBlocks = all.filter(b => b.type.startsWith('px.'));
ok('the PSCAD blocks are there', pxBlocks.length >= 30, `${pxBlocks.length}`);
ok('no PowerFactory block is left', !all.some(b => b.type.startsWith('pf.')),
  all.filter(b => b.type.startsWith('pf.')).map(b => b.type).join(', '));

// Every helper a block names has to exist in the runtime, or its script will not load.
const known = new Set(LIB.sections ? [...LIB.sections.keys()] : []);
for (const b of all) {
  const want = Array.isArray(b.helpers) ? b.helpers : [];
  const missing = want.filter(h => !known.has(h));
  ok(`${b.type}: its helpers exist`, missing.length === 0, missing.join(', '));
}

// ------------------------------------------------------------------ workflows
gen('start only', W({ n1: START }));

gen('build and run', W({
  n1: START,
  n2: ['px.build', { clean: false }],
  n3: ['px.run', { duration: 0.5, step: 50, plotStep: 250 }],
  n4: ['flow.log', { text: 'ran to {t} s' }],
}, ['n1>n2', 'n2.ok>n3', 'n3.ok>n4']));

gen('read a channel and check it', W({
  n1: START,
  n2: ['px.run', { duration: 1, step: 50, plotStep: 250 }],
  n3: ['px.series', { channel: 'Load Voltage:1' }],
  n4: ['sig.peak', {}],
  n5: ['out.table.add', { table: 'Results', cols: [{ id: 'c1', name: 'Peak' }] }],
}, ['n1>n2', 'n2.ok>n5'], ['n2.result>n3.run', 'n3.series>n4.series', 'n4.value>n5.c1']));

gen('a fault sweep over durations', W({
  n1: START,
  n2: ['flow.range', { from: 0.08, to: 0.2, step: 0.04 }, { label: 'Fault duration (s)' }],
  n3: ['px.fault', { at: 1.0, duration: 0.12 }, { label: 'Fault' }],
  n4: ['px.run', { duration: 3, step: 50, plotStep: 250 }],
  n5: ['px.series', { channel: 'Machine Speed' }],
  n6: ['sig.nadir', {}],
  n7: ['out.table.add', { table: 'FRT', cols: [{ id: 'c1', name: 'Nadir' }] }],
}, ['n1>n2', 'n2.body>n3', 'n3>n4', 'n4.ok>n5x'].slice(0, 3).concat(['n3>n4', 'n4.ok>n7']),
  ['n2.value>n3.duration', 'n4.result>n5.run', 'n5.series>n6.series', 'n6.nadir>n7.c1']));

gen('a parameter sweep with a put-back', W({
  n1: START,
  n2: ['px.component', { el: { cls: 'master:resistor', name: 'Rload', match: 'one' } }],
  n3: ['flow.range', { from: 1, to: 5, step: 1 }, { label: 'R (ohm)' }],
  n4: ['px.set', { param: 'R', vtype: 'num', value: 1 }],
  n5: ['px.run', { duration: 0.2 }],
  n6: ['px.series', { channel: 'Load Current' }],
  n7: ['sig.final', {}],
  n8: ['out.table.add', { table: 'Sweep', cols: [{ id: 'c1', name: 'Final' }] }],
}, ['n1>n3', 'n3.body>n4', 'n4>n5', 'n5.ok>n8'],
  ['n2.el>n4.obj', 'n3.value>n4.value', 'n5.result>n6.run', 'n6.series>n7.series', 'n7.value>n8.c1']));

gen('layers as arrangements', W({
  n1: START,
  n2: ['px.layer.foreach', { layers: ['ArrangementA', 'ArrangementB'] }, { label: 'Arrangement' }],
  n3: ['px.run', { duration: 0.5 }],
  n4: ['px.series', { channel: 'Vbus' }],
  n5: ['sig.peak', {}],
  n6: ['out.table.add', { table: 'Arrangements', cols: [{ id: 'c1', name: 'Peak' }] }],
}, ['n1>n2', 'n2.body>n3', 'n3.ok>n6'],
  ['n3.result>n4.run', 'n4.series>n5.series', 'n5.value>n6.c1']));

gen('global substitutions', W({
  n1: START,
  n2: ['px.gs.set', { sub: 'Rfault', vtype: 'num', value: 0.5 }],
  n3: ['px.gs.get', { sub: 'f' }],
  n4: ['px.run', { duration: 0.5 }],
  n5: ['flow.log', { text: 'f = {f}' }],
}, ['n1>n2', 'n2>n3', 'n3>n4', 'n4.ok>n5']));

gen('a snapshot then two branches', W({
  n1: START,
  n2: ['px.snap.save', { at: 1.0 }],
  n3: ['px.run', { duration: 1.2 }],
  n4: ['px.snap.use', { file: 'mycase.snp' }],
  n5: ['px.run', { duration: 0.5 }],
}, ['n1>n2', 'n2>n3', 'n3.ok>n4', 'n4>n5']));

gen('a simulation set run in parallel', W({
  n1: START,
  n2: ['px.simset.create', { name: 'PXB_sweep', volley: 4 }],
  n3: ['px.simset.override', { duration: 2 }],
  n4: ['px.simset.run', {}],
}, ['n1>n2', 'n2>n3', 'n3>n4'], ['n2.set>n3.set', 'n2.set>n4.set']));

gen('a case built from nothing', W({
  n1: START,
  n2: ['px.project.new', { path: 'built.pscx' }],
  n3: ['px.add.component', { defn: 'master:source_3', x: 10, y: 10, name: 'Src' }],
  n4: ['px.add.component', { defn: 'master:resistor', x: 18, y: 10 }],
  n5: ['px.add.wire', { points: ['10, 10', '18, 10'] }],
  n6: ['px.add.channel', { name: 'Vsrc', x: 24, y: 10, units: 'kV' }],
  n7: ['px.add.graph', { x: 30, y: 10 }],
  n8: ['px.project.save', {}],
}, ['n1>n2', 'n2>n3', 'n3>n4', 'n4>n5', 'n5>n6', 'n6>n7', 'n7>n8'], ['n6.el>n7.obj']));

gen('controls and a multiple run', W({
  n1: START,
  n2: ['px.control', { el: { cls: 'Slider', name: 'Pref', match: 'one' }, kind: 'slider', value: 0.8 }],
  n3: ['px.control', { el: { cls: 'Switch', name: 'Enable', match: 'one' }, kind: 'switch', on: 'on' }],
  n4: ['px.mrun.sweep', { variable: 1, mode: 'range', first: 0, last: 1, steps: 5 }],
  n5: ['px.run', { duration: 0.5 }],
}, ['n1>n2', 'n2>n3', 'n3>n4', 'n4>n5']));

gen('every component of a definition', W({
  n1: START,
  n2: ['px.foreach_component', { el: { cls: 'master:breaker3', name: '*', match: 'all' } }, { label: 'Breaker' }],
  n3: ['px.enable', { on: 'off' }],
  n4: ['px.run', { duration: 0.5 }],
  n5: ['out.table.add', { table: 'N-1', cols: [{ id: 'c1', name: 'Done' }] }],
}, ['n1>n2', 'n2.body>n3', 'n3>n4', 'n4.ok>n5'], ['n2.item>n3.obj']));

// Problems the generator must find.
const stale = generate(W({
  n1: START,
  n2: ['px.run', { duration: 1 }],
  n3: ['px.component', { el: { cls: 'master:resistor', name: '', match: 'one' } }],
  n4: ['px.set', { param: 'R', vtype: 'num', value: 2 }],
  n5: ['px.series', { channel: 'Vbus' }],
  n6: ['sig.peak', {}],
  n7: ['out.table.add', { table: 'T', cols: [{ id: 'c1', name: 'Peak' }] }],
}, ['n1>n2', 'n2.ok>n4', 'n4>n7'], ['n3.el>n4.obj', 'n2.result>n5.run', 'n5.series>n6.series', 'n6.value>n7.c1']),
{ runtime: RUNTIME });
ok('a channel read after a model change is an error',
  stale.problems.some(p => p.level === 'error' && /model was changed after/.test(p.msg)),
  stale.problems.map(p => `${p.level}:${p.msg}`).join(' | ').slice(0, 240));

const norun = generate(W({
  n1: START,
  n2: ['px.series', { channel: 'Vbus' }],
  n3: ['sig.peak', {}],
  n4: ['out.table.add', { table: 'T', cols: [{ id: 'c1', name: 'Peak' }] }],
}, ['n1>n4'], ['n2.series>n3.series', 'n3.value>n4.c1']), { runtime: RUNTIME });
ok('a channel read with no run is an error',
  norun.problems.some(p => p.level === 'error' && /nothing has run a simulation/.test(p.msg)),
  norun.problems.map(p => `${p.level}:${p.msg}`).join(' | ').slice(0, 240));

// ------------------------------------------------------------------ every script compiles
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pxb-smoke-'));
let compiled = 0;
for (const { name, code } of toCompile) {
  const file = path.join(tmp, name.replace(/[^\w]+/g, '_') + '.py');
  fs.writeFileSync(file, code);
  const r = spawnSync('python', ['-m', 'py_compile', file], { encoding: 'utf8' });
  if (ok(`${name}: compiles`, r.status === 0, (r.stderr || '').split('\n').slice(0, 4).join(' | '))) compiled++;
}
console.log(`compiled ${compiled}/${toCompile.length} generated scripts (in ${tmp})`);
if (!failed.length) fs.rmSync(tmp, { recursive: true, force: true });

console.log(`\nsmoke: ${passed} passed, ${failed.length} failed`);
for (const f of failed) console.log('  ' + f);
process.exit(failed.length ? 1 : 0);
