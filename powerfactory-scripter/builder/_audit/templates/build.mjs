// Builds the Quick Start templates (DESIGN 8.1) into builder/templates/<id>.json and
// builder/templates/index.json.
//
// Run from the repo root (D:\Repository\tool):
//   node powerfactory-scripter/builder/_audit/templates/build.mjs
// Each template is written below as a compact list of blocks and wires, then read through
// loadWorkflow() and written back with serialize(), so the files hold every declared setting
// in the saved format (app "pf-builder", v 1), exactly as the page would save them.
//
// Frozen handles (CLAUDE.md): the template ids, the file names, the block types, setting keys,
// option values and port ids. Titles, descriptions, labels and note texts are words and may
// change; a change of meaning (a different study) gets a new id.
//
// The fields a reader must fill in are left empty (the generator lists them as to-dos) and are
// pinned, so they are SETTINGS lines at the top of the script. A Record row of a simulation is
// a list setting, which cannot be pinned: its element stays a to-do on the canvas only.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILDER = path.resolve(HERE, '..', '..');
const imp = (rel) => import(pathToFileURL(path.join(BUILDER, rel)).href);
await imp('js/blocks/index.js');
const { loadWorkflow, serialize } = await imp('js/core/workflow.js');

const EL = (cls, name = '', match = 'one') => ({ cls, name, match });
const COL = 320;          // column pitch (px): blocks are 210 to 300 px wide
const ROW = 300;          // a calculator row below the flow

// nodes: { id: [type, col, row, label, settings, pin] } (col / row in grid steps, may be fractions)
// flow: 'a>b' (next) or 'a.out>b'; data: 'a.port>b.port'.
function W(name, nodes, flow, data, view) {
  const ns = Object.entries(nodes).map(([id, [type, col, row, label = '', s = {}, pin = []]]) => ({
    id, type, x: Math.round(col * COL), y: Math.round(row * ROW), label, s, pin,
  }));
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
  return { app: 'pf-builder', v: 1, name, nodes: ns, edges, view: view || { x: 40, y: 260, zoom: 0.55 } };
}

const START = (col = 0, row = 0) => ['start', col, row, '', { project: '' }];
const NOTE = (text, col = 0, row = -1) => ['note', col, row, 'About this template', { text }];

// ---------------------------------------------------------------------------------------------

export const TEMPLATES = [];

// Headroom study: the user's sentence, step by step.
TEMPLATES.push({
  id: 'headroom', title: 'Headroom study',
  desc: 'For each dispatch of generator A: a new study case, load flow, unit trip and RMS run; when the frequency settles, its nadir goes into a table.',
  wf: W('Headroom study', {
    n1: START(),
    n2: NOTE('For each dispatch of Generator A this makes a study case with its own operation scenario, runs a load flow, trips the contingency unit and runs an RMS simulation. ' +
      'A pass that does not converge or whose frequency does not settle skips to the next dispatch; the others add the nadir to the Headroom table and the frequency graph, and each study case is kept with its own operation scenario holding that dispatch. ' +
      'Fill in the project, Generator A, the contingency unit, the busbar on Run RMS simulation and the dispatch range.'),
    n3: ['flow.range', 1, 0, 'Dispatch (MW)', { from: 100, to: 300, step: 50 }, ['from', 'to', 'step']],
    n4: ['pf.case.create', 2, 0, '', { name: 'Headroom {loop values}' }],
    n5: ['pf.dispatch', 3, 0, 'Generator A', { gen: EL('ElmSym') }, ['gen']],
    n16: ['pf.scen.save', 4, 0, '', {}],
    n6: ['pf.ldf', 5, 0, '', {}],
    n7: ['pf.evt.trip', 6, 0, 'Contingency unit', { el: EL('ElmSym'), t: 1 }, ['el']],
    n8: ['pf.rms', 7, 0, '', { tstop: 20, extendTo: 60, record: [{ id: 'r1', el: EL('ElmTerm'), var: 'm:fehz', combine: 'none' }] }],
    n9: ['sig.settle', 8, 1.2, '', {}],
    n10: ['flow.if', 8, 0, 'Settles?', { op: 'true' }],
    n11: ['sig.nadir', 9, 1.2, '', { extendTo: 60 }],
    n12: ['out.table.add', 9, 0, '', { table: 'Headroom', cols: [
      { id: 'c1', name: 'Nadir (Hz)' }, { id: 'c2', name: 'Time of nadir (s)' }, { id: 'c3', name: 'Settling time (s)' }, { id: 'c4', name: 'UFLS' }] }],
    n13: ['out.plot.series', 10, 0, 'Bus frequency', { collect: 'loop', ylabel: 'Frequency' }],
    n14: ['out.table.save', 2, 2.4, '', { table: 'Headroom' }],
    n15: ['out.plot.table', 3, 2.4, 'Nadir against dispatch', { table: 'Headroom', x: 'Dispatch (MW)', ys: 'Nadir (Hz)', kind: 'line' }],
  }, [
    'n1>n3', 'n3.body>n4', 'n4>n5', 'n5>n16', 'n16>n6', 'n6.ok>n7', 'n7>n8', 'n8.ok>n10', 'n10.yes>n12', 'n12>n13', 'n3.done>n14', 'n14>n15',
  ], [
    'n3.value>n5.p', 'n8.r1>n9.series', 'n9.settles>n10.a', 'n8.r1>n11.series',
    'n11.minimum>n12.c1', 'n11.min_time>n12.c2', 'n9.time>n12.c3', 'n11.ufls>n12.c4', 'n8.r1>n13.l1',
  ]),
  todo: 4,
});

// Load flow on every study case: the busbar voltage band of each case.
TEMPLATES.push({
  id: 'ldf-cases', title: 'Load flow on every study case',
  desc: 'Runs the load flow of every study case and tables the lowest and highest busbar voltage of each, with where they are.',
  wf: W('Load flow on every study case', {
    n1: START(),
    n2: NOTE('This runs the load flow of every study case of the project (or of the cases named on For each study case, for example 0*) and reads the voltage of every busbar in service. ' +
      'Each case gets a row with its lowest and highest voltage and where they are; a case that does not converge keeps its row with the reason. Fill in the project.'),
    n3: ['pf.case.foreach', 1, 0, 'Study case', { pattern: '*' }, ['pattern']],
    n4: ['pf.ldf', 2, 0, '', {}],
    n5: ['pf.get', 3, 0, 'Busbar voltage', { el: EL('ElmTerm', '*', 'all'), attr: 'm:u' }],
    n6: ['out.table.add', 4, 0, '', { table: 'Load flow', cols: [
      { id: 'c1', name: 'Lowest voltage (p.u.)' }, { id: 'c2', name: 'Lowest at' }, { id: 'c3', name: 'Highest voltage (p.u.)' }, { id: 'c4', name: 'Highest at' }] }],
    n7: ['out.table.save', 2, 1.6, '', { table: 'Load flow' }],
  }, ['n1>n3', 'n3.body>n4', 'n4.ok>n5', 'n5>n6', 'n3.done>n7'],
  ['n5.min>n6.c1', 'n5.at_min>n6.c2', 'n5.max>n6.c3', 'n5.at_max>n6.c4']),
  todo: 1,
});

// N-1 screening: line loading and busbar voltage for each outage, with the worst one.
TEMPLATES.push({
  id: 'n-1', title: 'N-1 screening',
  desc: 'Takes out each line and transformer in turn (base case first), runs the load flow and tables the highest loading and lowest voltage.',
  wf: W('N-1 screening', {
    n1: START(),
    n2: NOTE('After a base load flow this takes out each line and transformer in service in turn (the base case first), runs the load flow and reads the loading of every line and 2-winding transformer and the voltage of every busbar. ' +
      'Each outage gets a row, also one that does not converge (with its reason); the worst outage is printed at the end. Fill in the project.'),
    n3: ['pf.ldf', 1, 0, 'Base load flow', {}],
    n4: ['pf.cont.define', 2, 1, '', { lines: true, trafos: true }],
    n5: ['pf.cont.foreach', 2, 0, 'Contingency', { base: true }],
    n6: ['pf.ldf', 3, 0, '', {}],
    n7: ['pf.get', 4, 0, 'Line loading', { el: EL('ElmLne', '*', 'all'), attr: 'c:loading' }],
    n13: ['pf.get', 5, 0, 'Transformer loading', { el: EL('ElmTr2', '*', 'all'), attr: 'c:loading' }],
    n8: ['pf.get', 6, 0, 'Busbar voltage', { el: EL('ElmTerm', '*', 'all'), attr: 'm:u' }],
    n9: ['out.table.add', 7, 0, '', { table: 'N-1', cols: [
      { id: 'c1', name: 'Highest loading (%)' }, { id: 'c2', name: 'Most loaded line' }, { id: 'c3', name: 'Lowest voltage (p.u.)' }, { id: 'c4', name: 'Lowest voltage at' },
      { id: 'c5', name: 'Highest transformer loading (%)' }, { id: 'c6', name: 'Most loaded transformer' }] }],
    n10: ['out.table.save', 3, 2, '', { table: 'N-1' }],
    n11: ['flow.log', 4, 2, 'Print the worst outage', { text: 'Worst outage: {worst}, with a line loaded to {loading:.1f} %' }],
    n12: ['out.table.column', 4, 3, 'Worst outage', { table: 'N-1', col: 'Contingency', pick: 'max', of: 'Highest loading (%)', as: 'text' }],
  }, ['n1>n3', 'n3.ok>n5', 'n5.body>n6', 'n6.ok>n7', 'n7>n13', 'n13>n8', 'n8>n9', 'n5.done>n10', 'n10>n11'],
  ['n4.conts>n5.conts', 'n7.max>n9.c1', 'n7.at_max>n9.c2', 'n8.min>n9.c3', 'n8.at_min>n9.c4', 'n13.max>n9.c5', 'n13.at_max>n9.c6', 'n12.value>n11.worst', 'n12.of>n11.loading']),
  todo: 1,
});

// Short circuit at every busbar: fault levels and a bar chart.
TEMPLATES.push({
  id: 'shc-buses', title: 'Short circuit at every busbar',
  desc: 'Runs an IEC 60909 maximum three-phase short circuit at each busbar in turn and tables Ikss and Skss, with a bar chart of the fault currents.',
  wf: W('Short circuit at every busbar', {
    n1: START(),
    n2: NOTE('This runs an IEC 60909 maximum three-phase short circuit at each busbar in service in turn (or at the busbars named on For each element) and reads the initial short-circuit current and power there. ' +
      'Each busbar gets a row, and a bar chart of the currents is drawn at the end. Fill in the project.'),
    n3: ['pf.foreach_element', 1, 0, 'Busbar', { el: EL('ElmTerm', '*', 'all') }, ['el']],
    n4: ['pf.shc', 2, 0, '', { method: 'iec', fault: '3ph', current: 'max', at: 'element' }],
    n5: ['pf.get', 3, 0, 'Ikss', { attr: 'm:Ikss', unit: 'kA' }],
    n6: ['pf.get', 4, 0, 'Skss', { attr: 'm:Skss', unit: 'MVA' }],
    n7: ['out.table.add', 5, 0, '', { table: 'Short circuit', cols: [{ id: 'c1', name: 'Ikss (kA)' }, { id: 'c2', name: 'Skss (MVA)' }] }],
    n8: ['out.table.save', 2, 1.6, '', { table: 'Short circuit' }],
    n9: ['out.plot.xy', 3, 1.6, 'Fault current at every busbar', { kind: 'bar', lines: [{ id: 'l1', name: 'Ikss (kA)' }], xlabel: 'Busbar', ylabel: 'Initial short-circuit current', yunit: 'kA' }],
    n10: ['out.table.column', 3, 2.7, 'Busbars', { table: 'Short circuit', col: 'Busbar', as: 'text' }],
    n11: ['out.table.column', 4, 2.7, 'Fault currents', { table: 'Short circuit', col: 'Ikss (kA)' }],
  }, ['n1>n3', 'n3.body>n4', 'n4.ok>n5', 'n5>n6', 'n6>n7', 'n3.done>n8', 'n8>n9'],
  ['n3.item>n4.target', 'n3.item>n5.obj', 'n3.item>n6.obj', 'n5.value>n7.c1', 'n6.value>n7.c2', 'n10.value>n9.x', 'n11.value>n9.l1']),
  todo: 1,
});

// Largest dispatch with a safe nadir: bisection on the dispatch of generator A.
TEMPLATES.push({
  id: 'find-limit', title: 'Largest dispatch with a safe nadir',
  desc: 'Searches the largest dispatch of generator A for which the frequency after a unit trip stays above the UFLS level, by halving the gap.',
  wf: W('Largest dispatch with a safe nadir', {
    n1: START(),
    n2: NOTE('This searches the largest dispatch of Generator A for which the frequency after the contingency unit trips stays above the UFLS level (1 Hz below nominal, set on Frequency nadir), by halving the gap between a passing and a failing dispatch. ' +
      'A try whose load flow does not converge counts as a fail. Fill in the project, Generator A (it can be the contingency unit itself), the contingency unit, the busbar on Run RMS simulation and the dispatch range.'),
    n3: ['opt.limit', 1, 0, 'Dispatch (MW)', { lower: 100, upper: 800, tol: 10, maxSteps: 12, passes: 'low', onUnknown: 'fail' }, ['lower', 'upper', 'tol']],
    n4: ['pf.dispatch', 2, 0, 'Generator A', { gen: EL('ElmSym') }, ['gen']],
    n5: ['pf.ldf', 3, 0, '', {}],
    n6: ['pf.evt.trip', 4, 0, 'Contingency unit', { el: EL('ElmSym'), t: 1 }, ['el']],
    n7: ['pf.rms', 5, 0, '', { tstop: 20, extendTo: 60, record: [{ id: 'r1', el: EL('ElmTerm'), var: 'm:fehz', combine: 'none' }] }],
    n8: ['sig.nadir', 6, 1, '', { extendTo: 60 }, ['uflsBelow']],
    n9: ['opt.report', 6, 0, '', { passIs: 'no' }],
    n10: ['flow.log', 2, 2.4, 'Print the limit', { text: 'Largest dispatch with a safe nadir: {limit:.1f} MW (search {status})' }],
    n11: ['out.plot.conv', 3, 2.4, 'Search for the largest dispatch', { ylabel: 'Dispatch', unit: 'MW' }],
  }, ['n1>n3', 'n3.body>n4', 'n4>n5', 'n5.ok>n6', 'n6>n7', 'n7.ok>n9', 'n3.done>n10', 'n10>n11'],
  ['n3.value>n4.p', 'n7.r1>n8.series', 'n8.ufls>n9.pass', 'n3.limit>n10.limit', 'n3.status>n10.status', 'n3.history>n11.history']),
  todo: 4,
});

// Fault ride-through: a fault at the connection point, the voltage against an LVRT curve and
// the active power recovery.
TEMPLATES.push({
  id: 'frt', title: 'Fault ride-through check',
  desc: 'A 150 ms fault at the connection point: checks the voltage against an LVRT curve and the time the plant power takes to recover to 90 %.',
  wf: W('Fault ride-through check', {
    n1: START(),
    n2: NOTE('This applies a 150 ms three-phase fault at the connection point busbar, runs an RMS simulation and checks the busbar voltage against an LVRT curve that starts at the clearing time (an example: type your grid code\'s points on LVRT curve). ' +
      'It also checks that the plant active power is back to 90 % of its pre-fault value, and stays there for 0.5 s, within 1 s of clearing; a run that stops early (loss of synchronism) still gets its row, with the curves it reached. Fill in the project, the busbar and the two Record rows on Run RMS simulation.'),
    n3: ['pf.evt.shc', 1, 0, 'Connection point fault', { target: EL('ElmTerm'), t: 1, duration: 0.15, fault: '3ph', clear: 'fault' }, ['target']],
    n4: ['pf.rms', 2, 0, '', { tstop: 5, record: [
      { id: 'r1', el: EL('ElmTerm'), var: 'm:u1', combine: 'none' }, { id: 'r2', el: EL('ElmGenstat'), var: 'm:P:bus1', combine: 'none' }] }],
    n5: ['chk.limit', 3, 0, 'LVRT curve', { against: 'curve', extend: true, curve: [
      { id: 'k1', x: 0.02, low: 0.5, high: '' }, { id: 'k2', x: 0.3, low: 0.5, high: '' }, { id: 'k3', x: 1.35, low: 0.85, high: '' }] }],
    n6: ['sig.at', 3, 1.3, 'Pre-fault power', {}],
    n7: ['math.arith', 4, 1.3, '90 % of pre-fault power', { op: 'mul', b: 0.9 }],
    n8: ['sig.cross', 4, 2.3, 'Power recovery', { direction: 'above', hold: 0.5 }],
    n9: ['chk.verdict', 4, 0, 'Power recovery time (s)', { op: 'le', limit: 1 }, ['limit']],
    n10: ['out.table.add', 5, 0, '', { table: 'FRT', cols: [
      { id: 'c1', name: 'LVRT' }, { id: 'c2', name: 'Voltage margin (p.u.)' }, { id: 'c3', name: 'Power recovery time (s)' }, { id: 'c4', name: 'Power recovery' }] }],
    n11: ['out.table.save', 6, 0, '', { table: 'FRT' }],
    n12: ['out.plot.series', 7, 0, 'Voltage at the connection point', { ylabel: 'Voltage' }],
    n13: ['out.plot.series', 8, 0, 'Plant active power', { ylabel: 'Active power' }],
  }, ['n1>n3', 'n3>n4', 'n4.ok>n5', 'n4.early>n5', 'n5.pass>n9', 'n5.fail>n9', 'n9.pass>n10', 'n9.fail>n10', 'n10>n11', 'n11>n12', 'n12>n13'],
  ['n4.r1>n5.x', 'n3.t_clear>n5.x0', 'n4.r2>n6.series', 'n3.t_fault>n6.t', 'n6.value>n7.a', 'n4.r2>n8.series', 'n7.value>n8.level', 'n3.t_clear>n8.after',
    'n8.delay>n9.value', 'n5.text>n10.c1', 'n5.margin>n10.c2', 'n8.delay>n10.c3', 'n9.text>n10.c4', 'n4.r1>n12.l1', 'n4.r2>n13.l1', 'n7.value>n13.limit']),
  todo: 4,
});

// Critical clearing time: bisection on the fault duration.
TEMPLATES.push({
  id: 'cct', title: 'Critical clearing time',
  desc: 'Searches the longest fault duration at a busbar for which the rotor angle spread of the generators stays below a limit, by halving the gap.',
  wf: W('Critical clearing time', {
    n1: START(),
    n2: NOTE('This searches the longest three-phase fault at a busbar that the system survives: each try applies the fault for the duration tried, runs an RMS simulation and checks that the rotor angle spread of all synchronous generators stays below the limit (180 degrees). ' +
      'A simulation that stops early counts as unstable. Fill in the project and the faulted busbar.'),
    n3: ['opt.limit', 1, 0, 'Fault duration (s)', { lower: 0.05, upper: 0.5, tol: 0.01, maxSteps: 12, passes: 'low' }, ['lower', 'upper', 'tol']],
    n4: ['pf.evt.shc', 2, 0, 'Fault', { target: EL('ElmTerm'), t: 1, fault: '3ph', clear: 'fault' }, ['target']],
    n5: ['pf.rms', 3, 0, '', { tstop: 5, record: [{ id: 'r1', el: EL('ElmSym', '*', 'all'), var: 'c:firel', combine: 'spread' }] }],
    n6: ['chk.limit', 4, 0, 'Rotor angle spread (deg)', { against: 'value', hi: 180 }, ['hi']],
    n7: ['opt.report', 5, 0, '', {}],
    n8: ['opt.report', 4, 1.3, 'Unstable', {}],
    n9: ['val.bool', 3, 1.3, 'Stable', { value: false }],
    n10: ['flow.log', 2, 2.4, 'Print the CCT', { text: 'Critical clearing time: {cct:.3f} s (search {status})' }],
    n11: ['out.plot.conv', 3, 2.4, 'Search for the critical clearing time', { ylabel: 'Fault duration', unit: 's' }],
  }, ['n1>n3', 'n3.body>n4', 'n4>n5', 'n5.ok>n6', 'n6.pass>n7', 'n6.fail>n7', 'n5.early>n8', 'n3.done>n10', 'n10>n11'],
  ['n3.value>n4.duration', 'n5.r1>n6.x', 'n6.ok>n7.pass', 'n9.value>n8.pass', 'n3.limit>n10.cct', 'n3.status>n10.status', 'n3.history>n11.history']),
  todo: 2,
});

// ---------------------------------------------------------------------------------------------

export function built() {
  return TEMPLATES.map(t => {
    const { wf, notes } = loadWorkflow(t.wf);
    return { ...t, json: serialize(wf), notes };
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = path.join(BUILDER, 'templates');
  const index = { templates: [] };
  for (const t of built()) {
    if (t.notes.length) console.log(`${t.id}: ${t.notes.map(n => n.level + ' ' + n.msg).join(' | ')}`);
    fs.writeFileSync(path.join(dir, `${t.id}.json`), JSON.stringify(t.json, null, 2) + '\n');
    index.templates.push({ id: t.id, title: t.title, desc: t.desc, file: `${t.id}.json` });
  }
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  console.log(`wrote ${index.templates.length} templates to ${dir}`);
}
