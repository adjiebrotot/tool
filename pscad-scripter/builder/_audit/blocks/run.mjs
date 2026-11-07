// The PSCAD blocks, end to end: a workflow is generated, written out, and run with Python
// against a real PSCAD engine on the sandbox cases. What the script leaves behind (its results
// table, its log) is then read back and checked.
//
// Run from the repo root:
//   node pscad-scripter/builder/_audit/blocks/run.mjs             everything
//   node pscad-scripter/builder/_audit/blocks/run.mjs --no-live   generate and compile only
//   node pscad-scripter/builder/_audit/blocks/run.mjs sweep       one case by name
//
// Needs PSCAD installed and licensed, mhi-pscad, and the sandbox
// (python pscad-scripter/builder/_audit/runtime/live/sandbox.py).
// Prints "blocks: N passed, M failed" and exits 1 on any failure.

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
const RL = await imp('js/core/runtime-loader.js');

const RUNTIME = Object.fromEntries(RL.RUNTIME_FILES.map(
  f => [f, fs.readFileSync(path.join(BUILDER, 'runtime', f), 'utf8')]));

const SANDBOX = process.env.PXB_SANDBOX || path.join(os.homedir(), 'pscad-sandbox');
const CASE = (name) => path.join(SANDBOX, name);
const LIVE = !process.argv.includes('--no-live');
const WANT = process.argv.slice(2).filter(a => !a.startsWith('-'));
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'pxb-blocks-'));

let passed = 0;
const failed = [];

function ok(label, cond, detail = '') {
  if (cond) { passed++; return true; }
  failed.push(label);
  console.log('    FAIL ' + label + (detail ? '  ' + String(detail).slice(0, 400) : ''));
  return false;
}

function W(nodes, flow = [], data = [], name = 'Audit workflow') {
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

// Generate, compile, and (unless --no-live) run. `check` reads what the run left behind.
function study(name, wf, check) {
  if (WANT.length && !WANT.includes(name)) return;
  console.log(`\n${name}`);
  const r = generate(wf, { runtime: RUNTIME });
  const errs = r.problems.filter(p => p.level === 'error');
  if (!ok(`${name}: generates with no errors`, errs.length === 0, errs.map(p => p.msg).join(' | '))) return;

  const dir = path.join(OUT, name);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name + '.py');
  fs.writeFileSync(file, r.code);
  const c = spawnSync('python', ['-m', 'py_compile', file], { encoding: 'utf8' });
  if (!ok(`${name}: compiles`, c.status === 0, c.stderr)) return;
  if (!LIVE) return;

  const t0 = Date.now();
  const p = spawnSync('python', [file], { encoding: 'utf8', cwd: dir, timeout: 900000 });
  const out = (p.stdout || '') + (p.stderr || '');
  const took = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`    ran in ${took}s, exit ${p.status}`);
  if (!ok(`${name}: the script ran`, p.status === 0, out.split('\n').slice(-18).join('\n'))) return;
  ok(`${name}: no error in the log`, !/\bERROR\b/.test(out), out.split('\n').filter(l => /ERROR/.test(l)).join(' | '));

  // Each run makes its own folder next to the script; take the newest.
  const runs = fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== '__pycache__')
    .map(d => path.join(dir, d.name));
  if (!ok(`${name}: wrote a run folder`, runs.length > 0, fs.readdirSync(dir).join(', '))) return;
  const run = runs.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
  if (check) {
    try {
      check({ dir: run, out, files: fs.readdirSync(run), csv: (f) => readCsv(path.join(run, f)) });
    } catch (err) {
      ok(`${name}: its results read back`, false, String(err));
    }
  }
}

function readCsv(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n').trim();
  const rows = text.split('\n').map(line => line.split(',').map(c => c.replace(/^"|"$/g, '')));
  const head = rows.shift() || [];
  return rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const num = (v) => (v === undefined || v === '' ? NaN : Number(v));
const START = (file, over = {}) => ['start', { project: CASE(file), runMode: 'auto', ...over }];

// -------------------------------------------------------------------------------- the studies

// One run of the voltage divider, its mid-point voltage peak into a table. vdiv is a 70.71 kV
// rms source behind 1 ohm feeding 1 ohm, so the peak is 70.71 * sqrt(2) / 2 = 50.0 kV.
study('oneRun', W({
  n1: START('vdiv.pscx'),
  n2: ['px.run', { duration: 0.2, step: 50, plotStep: 250 }],
  n3: ['px.series', { channel: 'Mid Point Voltage' }],
  n4: ['sig.peak', { kind: 'max' }],
  n5: ['out.table.add', { table: 'Peak', cols: [{ id: 'c1', name: 'Vpeak' }] }],
}, ['n1>n2', 'n2.ok>n5'], ['n2.result>n3.run', 'n3.series>n4.series', 'n4.value>n5.c1']),
({ files, csv }) => {
  ok('oneRun: saved a table', files.some(f => /^Peak.*\.csv$/i.test(f)), files.join(', '));
  const rows = csv(files.find(f => /^Peak.*\.csv$/i.test(f)));
  ok('oneRun: one row', rows.length === 1, JSON.stringify(rows));
  const v = num(rows[0] && rows[0].Vpeak);
  ok('oneRun: the peak is the divider voltage', Math.abs(v - 50.0) < 0.2, String(v));
});

// A sweep that writes the model, runs, reads, and puts the value back each pass.
study('sweep', W({
  n1: START('vdiv.pscx'),
  n2: ['px.component', { el: { cls: 'master:resistor', name: '', match: 'one' } }],
  n3: ['flow.range', { from: 1, to: 3, step: 1 }, { label: 'R (ohm)' }],
  n4: ['px.set', { param: 'R', vtype: 'num', value: 1 }],
  n5: ['px.run', { duration: 0.1, step: 50, plotStep: 250 }],
  n6: ['px.series', { channel: 'Mid Point Voltage' }],
  n7: ['sig.peak', { kind: 'max' }],
  n8: ['out.table.add', { table: 'Sweep', cols: [{ id: 'c1', name: 'Vpeak' }] }],
}, ['n1>n3', 'n3.body>n4', 'n4>n5', 'n5.ok>n8'],
  ['n2.el>n4.obj', 'n3.value>n4.value', 'n5.result>n6.run', 'n6.series>n7.series', 'n7.value>n8.c1']),
({ files, csv }) => {
  const f = files.find(x => /^Sweep.*\.csv$/i.test(x));
  ok('sweep: saved a table', !!f, files.join(', '));
  const rows = csv(f);
  ok('sweep: three rows', rows.length === 3, JSON.stringify(rows));
  // Vpeak = 100 kV * R / (1 + R): 50.0, 66.7, 75.0 kV for R = 1, 2, 3 ohm.
  const want = [50.0, 100 * 2 / 3, 75.0];
  rows.forEach((row, i) => {
    const v = num(row.Vpeak);
    ok(`sweep: row ${i + 1} follows the divider`, Math.abs(v - want[i]) < 0.3,
      `${v} vs ${want[i].toFixed(2)}`);
  });
  ok('sweep: the loop value is a column',
    rows.every(r => Object.keys(r).some(k => /R \(ohm\)/.test(k))), Object.keys(rows[0] || {}).join(', '));
});

// A build of its own, reporting what the compiler said.
study('build', W({
  n1: START('vdiv.pscx'),
  n2: ['px.build', { clean: true }],
  n3: ['out.table.add', { table: 'Build', cols: [{ id: 'c1', name: 'Seconds' }, { id: 'c2', name: 'Built' }] }],
}, ['n1>n2', 'n2.ok>n3'], ['n2.seconds>n3.c1', 'n2.built>n3.c2']),
({ files, csv }) => {
  const f = files.find(x => /^Build.*\.csv$/i.test(x));
  ok('build: saved a table', !!f, files.join(', '));
  const rows = csv(f);
  ok('build: it built', rows.length === 1 && /true/i.test(String(rows[0].Built)), JSON.stringify(rows));
  ok('build: it took some time', num(rows[0] && rows[0].Seconds) > 0, JSON.stringify(rows));
});

// Four channels of a bigger case, each checked, and a time-series graph drawn.
study('channels', W({
  n1: START('simpleac.pscx'),
  n2: ['px.run', { duration: 0.3, step: 50, plotStep: 250 }],
  n3: ['px.series', { channel: '3 Phase Load Voltage:1', label: 'Va' }],
  n4: ['px.series', { channel: '3 Phase Load Voltage:2', label: 'Vb' }],
  n5: ['px.series', { channel: '3 Phase Load Voltage:3', label: 'Vc' }],
  n6: ['sig.peak', { kind: 'abs' }],
  n7: ['out.table.add', { table: 'Phases', cols: [{ id: 'c1', name: 'Vpeak' }] }],
  n8: ['out.plot.series', { stem: 'phases', lines: [{ id: 'l1', name: 'Va' }, { id: 'l2', name: 'Vb' }, { id: 'l3', name: 'Vc' }], ylabel: 'Voltage' }],
}, ['n1>n2', 'n2.ok>n7', 'n7>n8'],
  ['n2.result>n3.run', 'n2.result>n4.run', 'n2.result>n5.run',
    'n3.series>n6.series', 'n6.value>n7.c1',
    'n3.series>n8.l1', 'n4.series>n8.l2', 'n5.series>n8.l3']),
({ dir, files, csv }) => {
  const f = files.find(x => /^Phases.*\.csv$/i.test(x));
  ok('channels: saved a table', !!f, files.join(', '));
  const graphs = files.includes('graphs')
    ? fs.readdirSync(path.join(dir, 'graphs')) : files;
  ok('channels: drew a graph', graphs.some(x => /\.png$/i.test(x)), graphs.join(', '));
  const rows = csv(f);
  ok('channels: a phase voltage came out', num(rows[0] && rows[0].Vpeak) > 1, JSON.stringify(rows));
});

// A global substitution driving the model, with the put-back proving itself.
study('globalsub', W({
  n1: START('vdiv.pscx'),
  n2: ['px.gs.get', { sub: 'f' }],
  n3: ['out.table.add', { table: 'Freq', cols: [{ id: 'c1', name: 'f' }] }],
}, ['n1>n2', 'n2>n3'], ['n2.value>n3.c1']),
({ files, csv }) => {
  const f = files.find(x => /^Freq.*\.csv$/i.test(x));
  ok('globalsub: saved a table', !!f, files.join(', '));
  const rows = csv(f);
  ok('globalsub: vdiv states 60 Hz', Math.abs(num(rows[0] && rows[0].f) - 60) < 0.001, JSON.stringify(rows));
});

// A snapshot written, then a run started from it.
study('snapshot', W({
  n1: START('vdiv.pscx'),
  n2: ['px.snap.save', { at: 0.1 }],
  n3: ['px.run', { duration: 0.15, step: 50, plotStep: 250 }],
  n4: ['px.snap.use', { file: 'vdiv.snp' }],
  n5: ['px.run', { duration: 0.1, step: 50, plotStep: 250 }],
  n6: ['px.series', { channel: 'Mid Point Voltage' }],
  n7: ['sig.final', {}],
  n8: ['out.table.add', { table: 'Snap', cols: [{ id: 'c1', name: 'Vend' }] }],
}, ['n1>n2', 'n2>n3', 'n3.ok>n4', 'n4>n5', 'n5.ok>n8'],
  ['n5.result>n6.run', 'n6.series>n7.series', 'n7.value>n8.c1']),
({ files, csv, out }) => {
  const f = files.find(x => /^Snap.*\.csv$/i.test(x));
  ok('snapshot: saved a table', !!f, files.join(', '));
  ok('snapshot: said it saved one', /snapshot at 0\.1/.test(out), '');
  ok('snapshot: started from it', /start from the snapshot/i.test(out), '');
  const rows = csv(f);
  ok('snapshot: the second run gave a value', Number.isFinite(num(rows[0] && rows[0].Vend)),
    JSON.stringify(rows));
});

// Every component of a definition, disabled one at a time, each pass a row.
study('eachComponent', W({
  n1: START('vdiv.pscx'),
  n2: ['px.foreach_component', { el: { cls: 'master:pgb', name: '*', match: 'all' } }, { label: 'Channel' }],
  n3: ['px.get', { param: 'Name' }],
  n4: ['out.table.add', { table: 'Each', cols: [{ id: 'c1', name: 'Channel' }] }],
}, ['n1>n2', 'n2.body>n3', 'n3>n4'], ['n2.item>n3.obj', 'n3.value>n4.c1']),
({ files, csv }) => {
  const f = files.find(x => /^Each.*\.csv$/i.test(x));
  ok('eachComponent: saved a table', !!f, files.join(', '));
  const rows = csv(f);
  ok('eachComponent: a row per output channel', rows.length === 2, JSON.stringify(rows));
  const names = rows.map(r => r.Channel).sort();
  ok('eachComponent: it read their names',
    names.join('|') === 'Load Current|Mid Point Voltage', names.join('|'));
});

// A layer made, components put on it, switched off, and taken away again.
study('layers', W({
  n1: START('vdiv.pscx'),
  n2: ['px.layer.create', { layer: 'PXB_audit', state: 'Enabled', keep: false }],
  n3: ['px.component', { el: { cls: 'master:resistor', name: '', match: 'one' } }],
  n4: ['px.layer.add', { layer: 'PXB_audit' }],
  n5: ['px.layer.set', { layer: 'PXB_audit', state: 'Disabled' }],
  n6: ['out.table.add', { table: 'Layer', cols: [{ id: 'c1', name: 'State' }] }],
}, ['n1>n2', 'n2>n4', 'n4>n5', 'n5>n6'],
  ['n3.el>n4.obj', 'n2.name>n4.name', 'n5.state>n6.c1']),
({ files, csv }) => {
  const f = files.find(x => /^Layer.*\.csv$/i.test(x));
  ok('layers: saved a table', !!f, files.join(', '));
  const rows = csv(f);
  ok('layers: the state came back', String(rows[0] && rows[0].State) === 'Disabled', JSON.stringify(rows));
});

// The EMT checks on a real waveform. vdiv's mid-point voltage is a clean sine at the case's
// own frequency, so its RMS is the peak over sqrt(2) and its distortion is next to nothing:
// numbers that can be checked against the model rather than against a previous run.
study('emt', W({
  n1: START('vdiv.pscx'),
  n2: ['px.run', { duration: 0.3, step: 50, plotStep: 100 }],
  n3: ['px.series', { channel: 'Mid Point Voltage' }],
  n4: ['sig.rms', { cycles: 1 }],
  n5: ['sig.final', {}],
  n6: ['sig.thd', { cycles: 1, harmonics: 20 }],
  n7: ['out.table.add', { table: 'EMT', cols: [{ id: 'c1', name: 'Vrms' }, { id: 'c2', name: 'THD' }] }],
}, ['n1>n2', 'n2.ok>n7'],
  ['n2.result>n3.run', 'n3.series>n4.series', 'n4.series>n5.series', 'n5.value>n7.c1',
    'n3.series>n6.series', 'n6.value>n7.c2']),
({ files, csv }) => {
  const f = files.find(x => /^EMT.*[.]csv$/i.test(x));
  ok('emt: saved a table', !!f, files.join(', '));
  const rows = csv(f);
  // The peak is 50.0 kV, so the RMS of the sine is 50 / sqrt(2) = 35.36 kV.
  const rms = num(rows[0] && rows[0].Vrms);
  ok('emt: the RMS is the peak over root two', Math.abs(rms - 50 / Math.SQRT2) < 0.4, String(rms));
  // A clean sine has no harmonics worth the name.
  const t = num(rows[0] && rows[0].THD);
  ok('emt: a clean sine has almost no distortion', t >= 0 && t < 2, String(t));
});

console.log(`\nblocks: ${passed} passed, ${failed.length} failed   (scripts in ${OUT})`);
for (const f of failed) console.log('  ' + f);
if (!failed.length) fs.rmSync(OUT, { recursive: true, force: true });
process.exit(failed.length ? 1 : 0);
