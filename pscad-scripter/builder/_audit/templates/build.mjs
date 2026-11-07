// Builds the Quick Start templates: templates/<id>.json and templates/index.json.
//
//   node pscad-scripter/builder/_audit/templates/build.mjs          write them
//   node pscad-scripter/builder/_audit/templates/build.mjs --check  only check, write nothing
//
// Each template is written here as a compact list of nodes and wires and is put through the
// real generator before it is written out, so a Quick Start that would open with errors never
// ships. Template ids are frozen: a link to builder/#qs=<id> opens one.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILDER = path.resolve(HERE, '..', '..');
const OUT = path.join(BUILDER, 'templates');
const imp = (rel) => import(pathToFileURL(path.join(BUILDER, rel)).href);

await imp('js/blocks/index.js');
const { generate } = await imp('js/core/codegen.js');
const R = await imp('js/core/registry.js');
const RL = await imp('js/core/runtime-loader.js');
const RUNTIME = Object.fromEntries(RL.RUNTIME_FILES.map(
  f => [f, fs.readFileSync(path.join(BUILDER, 'runtime', f), 'utf8')]));

const CHECK = process.argv.includes('--check');

// A node is [id, type, x, y, settings, label?]; a wire is "from.out>to.in" ("a>b" is the flow).
function build(name, nodes, wires) {
  const ns = nodes.map(([id, type, x, y, s = {}, label = '']) => {
    const node = { id, type, x, y, label, s: R.settingsOf({ type, s }), pin: [], sv: 1 };
    return node;
  });
  const edges = wires.map((w, i) => {
    const [a, b] = w.split('>');
    const [from, out] = a.includes('.') ? a.split('.') : [a, 'next'];
    const [to, inn] = b.includes('.') ? b.split('.') : [b, 'in'];
    return { id: 'e' + (i + 1), from, out, to, in: inn };
  });
  return { app: 'pscad-builder', v: 1, name, nodes: ns, edges, view: { x: 0, y: 0, zoom: 1 } };
}

const note = (id, x, y, title, text) => [id, 'note', x, y, { text }, title];

// --------------------------------------------------------------------------------- templates
const T = [];
const add = (id, title, desc, wf) => T.push({ id, title, desc, wf });

add('build-check', 'Build the case and report its errors',
  'Compiles the case and tables what the Fortran compiler said, so a model that will not build is found before anything is run.',
  build('Build the case', [
    ['n1', 'start', 0, 160],
    note('n0', 0, -180, 'About this template',
      'A PSCAD case is Fortran that EMTDC compiles before it can run, so a build has errors of '
      + 'its own: a floating input, a missing signal, a component that does not fit. This builds '
      + 'the case and writes what the compiler said into a table, which is the quickest check '
      + 'that a model someone sent you is sound.'),
    ['n2', 'px.build', 320, 160, { clean: true }],
    ['n3', 'out.table.add', 660, 60, { table: 'Build', cols: [{ id: 'c1', name: 'Built' }, { id: 'c2', name: 'Seconds' }, { id: 'c3', name: 'Warnings' }] }],
    ['n4', 'out.table.add', 660, 320, { table: 'Build', cols: [{ id: 'c1', name: 'Built' }, { id: 'c2', name: 'Errors' }] }, 'Did not build'],
  ], ['n1>n2', 'n2.ok>n3', 'n2.fail>n4', 'n2.built>n3.c1', 'n2.seconds>n3.c2',
    'n2.warnings>n3.c3', 'n2.built>n4.c1', 'n2.errors>n4.c2']));

add('frt', 'Fault ride through over fault durations',
  'For each fault duration: writes the fault component’s timing, runs the EMT simulation and tables the voltage dip and the machine speed nadir, with every run on one graph.',
  build('Fault ride through', [
    ['n1', 'start', 0, 200],
    note('n0', 0, -260, 'About this template',
      'Set the Fault component to the three phase fault in your own case (its definition is '
      + 'usually master:tpflt, and a Name narrows it when the case has several), and the '
      + 'channel names to the output channels your case records. The fault start is 1 s; give '
      + 'the case long enough before it to settle.'),
    ['n2', 'flow.range', 320, 200, { from: 0.08, to: 0.24, step: 0.04 }, 'Fault duration (s)'],
    ['n3', 'px.fault', 660, 60, { el: { cls: 'master:tpflt', name: '', match: 'one' }, at: 1, duration: 0.12 }, 'Fault'],
    ['n4', 'px.run', 980, 60, { duration: 5, step: 50, plotStep: 250 }],
    ['n5', 'px.series', 1300, 300, { channel: 'Vpcc', label: 'Voltage' }],
    ['n6', 'px.series', 1300, 460, { channel: 'Machine Speed', label: 'Speed' }],
    ['n7', 'sig.peak', 1620, 300, { kind: 'min' }, 'Voltage dip'],
    ['n8', 'sig.nadir', 1620, 460, {}, 'Speed nadir'],
    ['n9', 'out.table.add', 1960, 60, { table: 'FRT', cols: [{ id: 'c1', name: 'Lowest voltage' }, { id: 'c2', name: 'Speed nadir' }, { id: 'c3', name: 'Reached (s)' }] }],
    ['n10', 'out.plot.series', 2280, 60, { stem: 'speed', collect: 'loop', ylabel: 'Machine speed', lines: [{ id: 'l1', name: 'Speed' }] }],
  ], ['n1>n2', 'n2.body>n3', 'n3>n4', 'n4.ok>n9', 'n9>n10',
    'n2.value>n3.duration', 'n4.result>n5.run', 'n4.result>n6.run',
    'n5.series>n7.series', 'n6.series>n8.series',
    'n7.value>n9.c1', 'n8.nadir>n9.c2', 'n4.tend>n9.c3', 'n6.series>n10.l1']));

add('sweep', 'Sweep one parameter',
  'Steps one component parameter through a range, runs the case at each value and tables what a channel did, with a 2D graph of the result against the parameter.',
  build('Parameter sweep', [
    ['n1', 'start', 0, 200],
    note('n0', 0, -240, 'About this template',
      'Choose the component and the parameter to sweep (the Component block takes a definition '
      + 'such as master:resistor and, when the case has several, a Name), and the channel to '
      + 'read. Each pass writes the parameter, runs the case and puts the value back, so the '
      + 'case is left as it was found.'),
    ['n2', 'px.component', 320, 440, { el: { cls: 'master:resistor', name: '', match: 'one' } }],
    ['n3', 'flow.range', 320, 200, { from: 1, to: 10, step: 1 }, 'Value'],
    ['n4', 'px.set', 660, 60, { param: 'R', vtype: 'num', value: 1 }],
    ['n5', 'px.run', 980, 60, { duration: 1, step: 50, plotStep: 250 }],
    ['n6', 'px.series', 1300, 300, { channel: 'Vbus' }],
    ['n7', 'sig.peak', 1620, 300, { kind: 'abs' }],
    ['n8', 'out.table.add', 1960, 60, { table: 'Sweep', cols: [{ id: 'c1', name: 'Peak' }] }],
    ['n9', 'out.plot.table', 2280, 60, { stem: 'sweep', table: 'Sweep', x: 'Value', ys: [{ id: 'y1', name: 'Peak' }] }],
  ], ['n1>n3', 'n3.body>n4', 'n4>n5', 'n5.ok>n8', 'n3.done>n9',
    'n2.el>n4.obj', 'n3.value>n4.value', 'n5.result>n6.run',
    'n6.series>n7.series', 'n7.value>n8.c1']));

add('harmonics', 'Harmonics and THD from an EMT run',
  'Runs the case, takes the harmonic spectrum of a voltage once it has settled, and tables the THD, the worst harmonic and every order, with a bar chart of the spectrum.',
  build('Harmonics', [
    ['n1', 'start', 0, 160],
    note('n0', 0, -260, 'About this template',
      'PSCAD has no frequency-domain harmonic scan: harmonics come out of the time-domain '
      + 'result. Give the run long enough to settle and take the window at the end. The plot '
      + 'step sets how far up the spectrum is real: 100 us resolves to about 5 kHz, so lower it '
      + 'for high orders.'),
    ['n2', 'px.run', 320, 160, { duration: 1, step: 20, plotStep: 50 }],
    ['n3', 'px.series', 660, 400, { channel: 'Vbus' }],
    ['n4', 'sig.thd', 980, 400, { cycles: 2, harmonics: 50 }],
    ['n5', 'out.table.add', 1300, 160, { table: 'Harmonics', cols: [{ id: 'c1', name: 'THD (%)' }, { id: 'c2', name: 'Worst (%)' }, { id: 'c3', name: 'Worst order' }] }],
    ['n6', 'out.plot.xy', 1620, 160, { stem: 'spectrum', shape: 'bars', xlabel: 'Harmonic order', ylabel: 'Percent of the fundamental', lines: [{ id: 'l1', name: 'Harmonic' }] }],
  ], ['n1>n2', 'n2.ok>n5', 'n5>n6', 'n2.result>n3.run', 'n3.series>n4.series',
    'n4.value>n5.c1', 'n4.worst>n5.c2', 'n4.order>n5.c3',
    'n4.orders>n6.x', 'n4.pct>n6.l1']));

add('cct', 'Critical clearing time',
  'Halves the gap to find the longest fault the case rides through: for each try the fault duration is written, the case is run and the machine speed decides pass or fail.',
  build('Critical clearing time', [
    ['n1', 'start', 0, 200],
    note('n0', 0, -260, 'About this template',
      'Find limit halves the gap between a duration that passes and one that fails, so it finds '
      + 'the critical clearing time in about eight runs instead of a sweep of thirty. Set the '
      + 'pass test to what your case calls staying in step: a speed band, an angle, a voltage '
      + 'that comes back.'),
    ['n2', 'opt.limit', 320, 200, { from: 0.05, to: 0.5, tol: 0.005 }, 'Fault duration (s)'],
    ['n3', 'px.fault', 660, 60, { el: { cls: 'master:tpflt', name: '', match: 'one' }, at: 1, duration: 0.12 }, 'Fault'],
    ['n4', 'px.run', 980, 60, { duration: 5, step: 50, plotStep: 250 }],
    ['n5', 'px.series', 1300, 300, { channel: 'Machine Speed' }],
    ['n6', 'sig.peak', 1620, 300, { kind: 'max' }],
    ['n7', 'chk.verdict', 1960, 60, { op: '<=', limit: 1.05 }, 'Stays in step'],
    ['n8', 'out.table.add', 2280, 60, { table: 'CCT', cols: [{ id: 'c1', name: 'Highest speed' }] }],
  ], ['n1>n2', 'n2.body>n3', 'n3>n4', 'n4.ok>n7', 'n7.pass>n8',
    'n2.value>n3.duration', 'n4.result>n5.run', 'n5.series>n6.series',
    'n6.value>n7.value', 'n7.ok>n2.pass', 'n6.value>n8.c1']));

add('layers', 'Run every network arrangement',
  'Puts each layer of the case in turn and leaves the others out, runs the EMT simulation for each and tables what a channel did: one case, every arrangement.',
  build('Every arrangement', [
    ['n1', 'start', 0, 200],
    note('n0', 0, -240, 'About this template',
      'A PSCAD layer switches a whole group of components in or out of the build together, so '
      + 'one case can hold several network arrangements. Type the layer names of your own case, '
      + 'or leave a single * to go over every layer there is.'),
    ['n2', 'px.layer.foreach', 320, 200, { layers: '*', state: 'Enabled', others: 'Disabled' }, 'Arrangement'],
    ['n3', 'px.run', 660, 60, { duration: 2, step: 50, plotStep: 250 }],
    ['n4', 'px.series', 980, 300, { channel: 'Vbus' }],
    ['n5', 'sig.peak', 1300, 300, { kind: 'abs' }],
    ['n6', 'out.table.add', 1620, 60, { table: 'Arrangements', cols: [{ id: 'c1', name: 'Peak' }, { id: 'c2', name: 'Reached (s)' }] }],
  ], ['n1>n2', 'n2.body>n3', 'n3.ok>n6', 'n3.result>n4.run', 'n4.series>n5.series',
    'n5.value>n6.c1', 'n3.tend>n6.c2']));

add('snapshot', 'Initialise once, then branch',
  'Runs the case to a settled state and saves a snapshot, then starts each fault from it instead of simulating the start-up again every time.',
  build('Snapshot then branch', [
    ['n1', 'start', 0, 200],
    note('n0', 0, -260, 'About this template',
      'A snapshot is the whole state of the case at one instant. A long start-up is simulated '
      + 'once, and each case after it begins there, which is often most of the run time of a '
      + 'study saved. Set the snapshot time past the point where your case has settled.'),
    ['n2', 'px.snap.save', 320, 200, { at: 2 }],
    ['n3', 'px.run', 660, 200, { duration: 2.2, step: 50, plotStep: 250 }, 'Initialise'],
    ['n4', 'px.snap.use', 980, 200, { file: '' }],
    ['n5', 'flow.range', 1300, 200, { from: 0.08, to: 0.2, step: 0.04 }, 'Fault duration (s)'],
    ['n6', 'px.fault', 1620, 60, { el: { cls: 'master:tpflt', name: '', match: 'one' }, at: 0.1, duration: 0.12 }, 'Fault'],
    ['n7', 'px.run', 1940, 60, { duration: 2, step: 50, plotStep: 250 }],
    ['n8', 'px.series', 2260, 300, { channel: 'Vbus' }],
    ['n9', 'sig.peak', 2580, 300, { kind: 'min' }],
    ['n10', 'out.table.add', 2900, 60, { table: 'Snapshot', cols: [{ id: 'c1', name: 'Lowest voltage' }] }],
  ], ['n1>n2', 'n2>n3', 'n3.ok>n4', 'n4>n5', 'n5.body>n6', 'n6>n7', 'n7.ok>n10',
    'n2.file>n4.file', 'n5.value>n6.duration', 'n7.result>n8.run',
    'n8.series>n9.series', 'n9.value>n10.c1']));

add('substitutions', 'A run for each parameter set',
  'Switches the case to each of its global substitution sets in turn and runs it, so one model covers every parameter set it was built with.',
  build('Every parameter set', [
    ['n1', 'start', 0, 200],
    note('n0', 0, -240, 'About this template',
      'A global substitution is one named value every component writing $(name) reads, and a '
      + 'set holds one value for each. Make the sets once in PSCAD (Project Settings, '
      + 'Substitutions) or load them from a CSV; this goes over whatever the case has.'),
    ['n2', 'px.gs.foreach', 320, 200, {}, 'Parameter set'],
    ['n3', 'px.run', 660, 60, { duration: 2, step: 50, plotStep: 250 }],
    ['n4', 'px.series', 980, 300, { channel: 'Vbus' }],
    ['n5', 'sig.final', 1300, 300, {}],
    ['n6', 'out.table.add', 1620, 60, { table: 'Sets', cols: [{ id: 'c1', name: 'Final value' }] }],
  ], ['n1>n2', 'n2.body>n3', 'n3.ok>n6', 'n3.result>n4.run', 'n4.series>n5.series',
    'n5.value>n6.c1']));

add('parallel', 'Run several cases at once',
  'Puts cases into a simulation set and runs them several at a time. This is where a PSCAD study gets real parallelism: four at a time finish in about the time of one.',
  build('Several cases at once', [
    ['n1', 'start', 0, 160],
    note('n0', 0, -240, 'About this template',
      'List the cases to run in the simulation set and load each of them in Start under '
      + 'Libraries, so they are in the workspace. Keep the volley at or below the number of '
      + 'processor cores: more than that and they slow each other down.'),
    ['n2', 'px.simset.create', 320, 160, { name: 'PXB_batch', volley: 4 }],
    ['n3', 'px.simset.override', 660, 160, { duration: 5 }],
    ['n4', 'px.simset.run', 980, 160, {}],
    ['n5', 'out.table.add', 1300, 60, { table: 'Batch', cols: [{ id: 'c1', name: 'Finished' }, { id: 'c2', name: 'Seconds' }] }],
  ], ['n1>n2', 'n2>n3', 'n3>n4', 'n4.ok>n5', 'n2.set>n3.set', 'n2.set>n4.set',
    'n4.finished>n5.c1', 'n4.took>n5.c2']));

add('damping', 'Damping of a ringdown',
  'Disturbs the case, measures the damping ratio and frequency of the oscillation that follows, and fails the pass when it is growing: a control interaction check.',
  build('Damping check', [
    ['n1', 'start', 0, 200],
    note('n0', 0, -260, 'About this template',
      'A control interaction, a subsynchronous oscillation or a badly tuned loop shows up as an '
      + 'oscillation that does not decay. Start the damping window after the disturbance itself, '
      + 'so its own step is not read as a peak. A negative damping ratio means the oscillation '
      + 'is growing.'),
    ['n2', 'px.fault', 320, 60, { el: { cls: 'master:tpflt', name: '', match: 'one' }, at: 1, duration: 0.05 }, 'Disturbance'],
    ['n3', 'px.run', 660, 60, { duration: 10, step: 50, plotStep: 500 }],
    ['n4', 'px.series', 980, 300, { channel: 'Machine Speed' }],
    ['n5', 'sig.damping', 1300, 300, { t_start: 1.2 }],
    ['n6', 'chk.verdict', 1620, 60, { op: '>=', limit: 0.03 }, 'Well damped'],
    ['n7', 'out.table.add', 1940, 60, { table: 'Damping', cols: [{ id: 'c1', name: 'Damping ratio' }, { id: 'c2', name: 'Mode (Hz)' }] }],
  ], ['n1>n2', 'n2>n3', 'n3.ok>n6', 'n6.pass>n7', 'n6.fail>n7',
    'n3.result>n4.run', 'n4.series>n5.series', 'n5.value>n6.value',
    'n5.value>n7.c1', 'n5.frequency>n7.c2']));

// --------------------------------------------------------------------------------- check
let bad = 0;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pxb-tpl-'));
for (const t of T) {
  const r = generate(t.wf, { runtime: RUNTIME });
  const errs = r.problems.filter(p => p.level === 'error');
  const todos = r.problems.filter(p => p.level === 'todo');
  const file = path.join(tmp, t.id + '.py');
  fs.writeFileSync(file, r.code);
  const c = spawnSync('python', ['-m', 'py_compile', file], { encoding: 'utf8' });
  const ok = errs.length === 0 && c.status === 0;
  if (!ok) bad++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${t.id.padEnd(15)} ${todos.length} to-do${todos.length === 1 ? '' : 's'}`
    + (errs.length ? '  ERRORS: ' + errs.map(p => p.msg).join(' | ') : '')
    + (c.status !== 0 ? '  DID NOT COMPILE: ' + (c.stderr || '').split('\n')[1] : ''));
  // Start's project is empty in every template on purpose: the reader puts their own case in,
  // and that is the one to-do a Quick Start is allowed to open with.
  for (const p of todos) {
    if (!/PSCAD case|Case|project/i.test(p.msg)) console.log(`         to-do: ${p.msg}`);
  }
}

if (!CHECK) {
  for (const t of T) {
    fs.writeFileSync(path.join(OUT, t.id + '.json'), JSON.stringify(t.wf, null, 1) + '\n');
  }
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({
    templates: T.map(t => ({ id: t.id, title: t.title, desc: t.desc, file: t.id + '.json' })),
  }, null, 2) + '\n');
  // Templates of the tool this one was ported from have no place here.
  for (const f of fs.readdirSync(OUT)) {
    if (f.endsWith('.json') && f !== 'index.json' && !T.some(t => t.id + '.json' === f)) {
      fs.rmSync(path.join(OUT, f));
      console.log('  removed ' + f);
    }
  }
  console.log(`\nwrote ${T.length} templates to ${OUT}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`templates: ${T.length - bad} ok, ${bad} failed`);
process.exit(bad ? 1 : 0);
