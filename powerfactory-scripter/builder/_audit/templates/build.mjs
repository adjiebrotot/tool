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
    n15: ['out.plot.table', 2, 2.4, 'Nadir against dispatch', { table: 'Headroom', x: 'Dispatch (MW)', ys: 'Nadir (Hz)', kind: 'line' }],
  }, [
    'n1>n3', 'n3.body>n4', 'n4>n5', 'n5>n16', 'n16>n6', 'n6.ok>n7', 'n7>n8', 'n8.ok>n10', 'n10.yes>n12', 'n12>n13', 'n3.done>n15',
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
  }, ['n1>n3', 'n3.body>n4', 'n4.ok>n5', 'n5>n6'],
  ['n5.min>n6.c1', 'n5.at_min>n6.c2', 'n5.max>n6.c3', 'n5.at_max>n6.c4']),
  todo: 1,
});

// N-1 screening: line loading and busbar voltage for each outage, with the worst one.
TEMPLATES.push({
  id: 'n-1', title: 'N-1 screening',
  desc: 'Takes out each line and transformer in turn (base case first), runs the load flow and tables the highest loading and lowest voltage.',
  wf: W('N-1 screening', {
    n1: START(),
    n2: NOTE('After a base load flow this takes out each line and transformer in service in turn (the base case first), runs the load flow and reads the loading of every line and 2-winding transformer and the voltage of every busbar (three reads side by side: they run one after another, then the row is added). ' +
      'Each outage gets a row, also one that does not converge (with its reason); the worst outage is printed at the end. Fill in the project.'),
    n3: ['pf.ldf', 1, 0, 'Base load flow', {}],
    n5: ['pf.cont.foreach', 2, 0, 'Contingency', { lines: true, trafos: true, base: true }],
    n6: ['pf.ldf', 3, 0, '', {}],
    n7: ['pf.get', 4, 0, 'Line loading', { el: EL('ElmLne', '*', 'all'), attr: 'c:loading' }],
    n13: ['pf.get', 4, 1.2, 'Transformer loading', { el: EL('ElmTr2', '*', 'all'), attr: 'c:loading' }],
    n8: ['pf.get', 4, 0.6, 'Busbar voltage', { el: EL('ElmTerm', '*', 'all'), attr: 'm:u' }],
    n9: ['out.table.add', 5, 0, '', { table: 'N-1', cols: [
      { id: 'c1', name: 'Highest loading (%)' }, { id: 'c2', name: 'Most loaded line' }, { id: 'c3', name: 'Lowest voltage (p.u.)' }, { id: 'c4', name: 'Lowest voltage at' },
      { id: 'c5', name: 'Highest transformer loading (%)' }, { id: 'c6', name: 'Most loaded transformer' }] }],
    n11: ['flow.log', 3, 2.2, 'Print the worst outage', { text: 'Worst outage: {worst}, with a line loaded to {loading:.1f} %' }],
    n12: ['out.table.column', 3, 3.1, 'Worst outage', { table: 'N-1', col: 'Contingency', pick: 'max', of: 'Highest loading (%)', as: 'text' }],
  }, ['n1>n3', 'n3.ok>n5', 'n5.body>n6', 'n6.ok>n7', 'n6.ok>n13', 'n6.ok>n8', 'n7>n9', 'n13>n9', 'n8>n9', 'n5.done>n11'],
  ['n7.max>n9.c1', 'n7.at_max>n9.c2', 'n8.min>n9.c3', 'n8.at_min>n9.c4', 'n13.max>n9.c5', 'n13.at_max>n9.c6', 'n12.value>n11.worst', 'n12.of>n11.loading']),
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
    n9: ['out.plot.xy', 2, 1.6, 'Fault current at every busbar', { kind: 'bar', lines: [{ id: 'l1', name: 'Ikss (kA)' }], xlabel: 'Busbar', ylabel: 'Initial short-circuit current', yunit: 'kA' }],
    n10: ['out.table.column', 1, 2.7, 'Busbars', { table: 'Short circuit', col: 'Busbar', as: 'text' }],
    n11: ['out.table.column', 2, 2.7, 'Fault currents', { table: 'Short circuit', col: 'Ikss (kA)' }],
  }, ['n1>n3', 'n3.body>n4', 'n4.ok>n5', 'n5>n6', 'n6>n7', 'n3.done>n9'],
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
      'Find limit reads UFLS at the end of each try (FALSE passes); a try whose load flow does not converge, or whose simulation stops early, counts as a fail. Fill in the project, Generator A (it can be the contingency unit itself), the contingency unit, the busbar on Run RMS simulation and the dispatch range.'),
    n3: ['opt.limit', 1, 0, 'Dispatch (MW)', { lower: 100, upper: 800, tol: 10, maxSteps: 12, passes: 'low', onUnknown: 'fail', passIs: 'no' }, ['lower', 'upper', 'tol']],
    n4: ['pf.dispatch', 2, 0, 'Generator A', { gen: EL('ElmSym') }, ['gen']],
    n5: ['pf.ldf', 3, 0, '', {}],
    n6: ['pf.evt.trip', 4, 0, 'Contingency unit', { el: EL('ElmSym'), t: 1 }, ['el']],
    n7: ['pf.rms', 5, 0, '', { tstop: 20, extendTo: 60, record: [{ id: 'r1', el: EL('ElmTerm'), var: 'm:fehz', combine: 'none' }] }],
    n8: ['sig.nadir', 6, 1, '', { extendTo: 60 }, ['uflsBelow']],
    n10: ['flow.log', 2, 2.4, 'Print the limit', { text: 'Largest dispatch with a safe nadir: {limit:.1f} MW (search {status})' }],
    n11: ['out.plot.conv', 3, 2.4, 'Search for the largest dispatch', { ylabel: 'Dispatch', unit: 'MW' }],
  }, ['n1>n3', 'n3.body>n4', 'n4>n5', 'n5.ok>n6', 'n6>n7', 'n3.done>n10', 'n10>n11'],
  ['n3.value>n4.p', 'n7.r1>n8.series', 'n8.ufls>n3.pass', 'n3.limit>n10.limit', 'n3.status>n10.status', 'n3.history>n11.history']),
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
    n5: ['chk.limit', 3, 0, 'LVRT curve', { against: 'curve', extend: true, goOn: true, curve: [
      { id: 'k1', x: 0.02, low: 0.5, high: '' }, { id: 'k2', x: 0.3, low: 0.5, high: '' }, { id: 'k3', x: 1.35, low: 0.85, high: '' }] }],
    n8: ['sig.cross', 3, 1.3, 'Power recovery', { direction: 'above', levelMode: 'pct', pct: 90, hold: 0.5 }],
    n9: ['chk.verdict', 4, 0, 'Power recovery time (s)', { op: 'le', limit: 1, goOn: true }, ['limit']],
    n10: ['out.table.add', 5, 0, '', { table: 'FRT', cols: [
      { id: 'c1', name: 'LVRT' }, { id: 'c2', name: 'Voltage margin (p.u.)' }, { id: 'c3', name: 'Power recovery time (s)' }, { id: 'c4', name: 'Power recovery' }] }],
    n12: ['out.plot.series', 6, 0, 'Voltage at the connection point', { ylabel: 'Voltage' }],
    n13: ['out.plot.series', 7, 0, 'Plant active power', { ylabel: 'Active power' }],
  }, ['n1>n3', 'n3>n4', 'n4.ok>n5', 'n4.early>n5', 'n5.pass>n9', 'n9.pass>n10', 'n10>n12', 'n12>n13'],
  ['n4.r1>n5.x', 'n3.t_clear>n5.x0', 'n4.r2>n8.series', 'n3.t_clear>n8.after',
    'n8.delay>n9.value', 'n5.text>n10.c1', 'n5.margin>n10.c2', 'n8.delay>n10.c3', 'n9.text>n10.c4', 'n4.r1>n12.l1', 'n4.r2>n13.l1', 'n8.threshold>n13.limit']),
  todo: 4,
});

// Critical clearing time: bisection on the fault duration.
TEMPLATES.push({
  id: 'cct', title: 'Critical clearing time',
  desc: 'Searches the longest fault duration at a busbar for which the rotor angle spread of the generators stays below a limit, by halving the gap.',
  wf: W('Critical clearing time', {
    n1: START(),
    n2: NOTE('This searches the longest three-phase fault at a busbar that the system survives: each try applies the fault for the duration tried, runs an RMS simulation and checks that the rotor angle spread of all synchronous generators stays below the limit (180 degrees). ' +
      'Find limit reads the angle check at the end of each try; a simulation that stops early reports a fail (unstable). Fill in the project and the faulted busbar.'),
    n3: ['opt.limit', 1, 0, 'Fault duration (s)', { lower: 0.05, upper: 0.5, tol: 0.01, maxSteps: 12, passes: 'low' }, ['lower', 'upper', 'tol']],
    n4: ['pf.evt.shc', 2, 0, 'Fault', { target: EL('ElmTerm'), t: 1, fault: '3ph', clear: 'fault' }, ['target']],
    n5: ['pf.rms', 3, 0, '', { tstop: 5, record: [{ id: 'r1', el: EL('ElmSym', '*', 'all'), var: 'c:firel', combine: 'spread' }] }],
    n6: ['chk.limit', 4, 0, 'Rotor angle spread (deg)', { against: 'value', hi: 180, goOn: true }, ['hi']],
    n8: ['opt.report', 4, 1.3, 'Unstable', { answer: 'fail' }],
    n10: ['flow.log', 2, 2.4, 'Print the CCT', { text: 'Critical clearing time: {cct:.3f} s (search {status})' }],
    n11: ['out.plot.conv', 3, 2.4, 'Search for the critical clearing time', { ylabel: 'Fault duration', unit: 's' }],
  }, ['n1>n3', 'n3.body>n4', 'n4>n5', 'n5.ok>n6', 'n5.early>n8', 'n3.done>n10', 'n10>n11'],
  ['n3.value>n4.duration', 'n5.r1>n6.x', 'n6.ok>n3.pass', 'n3.limit>n10.cct', 'n3.status>n10.status', 'n3.history>n11.history']),
  todo: 2,
});

// Hosting capacity: at each busbar, the largest injection of a test generator that keeps every
// line and transformer within its rating and every busbar voltage within the band.
TEMPLATES.push({
  id: 'hosting-capacity', title: 'Hosting capacity at every busbar',
  desc: 'At each busbar, searches the largest test generator output that keeps lines, transformers and voltages within limits, by halving the gap.',
  wf: W('Hosting capacity at every busbar', {
    n1: START(),
    n2: NOTE('At each busbar of Connection point this connects a test generator at unity power factor and searches its largest output for which the load flow converges, no line or 2-winding transformer is above 100 % and every busbar stays between 0.9 and 1.1 p.u., turning the generators already dispatched down pro rata by the same amount (delete Other generators to let the slack take it, as for an upstream grid). ' +
      'Each busbar gets a row with its hosting capacity and a bar chart is drawn at the end; the dispatch is put back and the test generator deleted. Fill in the project, then narrow the busbars and set the search range and limits to your network.'),
    n3: ['pf.foreach_element', 2, 0, 'Connection point', { el: EL('ElmTerm', '*', 'all') }, ['el']],
    n4: ['opt.limit', 3, 0, 'Generation (MW)', { lower: 0, upper: 1000, tol: 5, maxSteps: 20, passes: 'low', onUnknown: 'fail' }, ['lower', 'upper', 'tol']],
    n5: ['pf.testgen', 4, 0, 'Test generator', {}],
    n6: ['pf.ldf', 6, 0, '', {}],
    n7: ['pf.get', 7, 0, 'Line loading', { el: EL('ElmLne', '*', 'all'), attr: 'c:loading' }],
    n8: ['pf.get', 7, 0.6, 'Transformer loading', { el: EL('ElmTr2', '*', 'all'), attr: 'c:loading' }],
    n9: ['pf.get', 7, 1.2, 'Busbar voltage', { el: EL('ElmTerm', '*', 'all'), attr: 'm:u' }],
    n10: ['chk.limit', 8, 0, 'Line thermal limit', { against: 'value', hi: 100, goOn: true }, ['hi']],
    n11: ['chk.limit', 8, 0.7, 'Transformer thermal limit', { against: 'value', hi: 100, goOn: true }],
    n12: ['chk.limit', 8, 1.4, 'Voltage limits', { against: 'value', lo: 0.9, hi: 1.1, goOn: true }, ['lo', 'hi']],
    n13: ['math.logic', 9, 1, 'Thermal limits', { op: 'and' }],
    n14: ['math.logic', 10, 1.5, 'All limits', { op: 'and' }],
    n15: ['out.table.add', 4, 2.5, '', { table: 'Hosting capacity', cols: [{ id: 'c1', name: 'Hosting capacity (MW)' }, { id: 'c2', name: 'Search' }] }],
    n16: ['out.plot.table', 3, 3.5, 'Hosting capacity at each busbar', { table: 'Hosting capacity', x: 'Connection point', ys: 'Hosting capacity (MW)', kind: 'bar', ylabel: 'Hosting capacity', yunit: 'MW' }],
    n17: ['pf.get', 1, 0, 'Generator dispatch', { el: EL('ElmSym', '*', 'all'), attr: 'pgini' }],
    n18: ['math.sum', 1, 1, 'Total dispatch', {}],
    n19: ['math.formula', 5, 1.1, 'Share kept', { expr: '1 - p / total' }],
    n20: ['pf.scale', 5, 0, 'Other generators', { el: EL('ElmSym', '*', 'all'), attr: 'pgini' }],
  }, ['n1>n17', 'n17>n3', 'n3.body>n4', 'n4.body>n5', 'n5>n20', 'n20>n6', 'n6.ok>n7', 'n7>n8', 'n8>n9', 'n9>n10', 'n10.pass>n11', 'n11.pass>n12', 'n4.done>n15', 'n3.done>n16'],
  ['n3.item>n5.bus', 'n4.value>n5.p', 'n17.values>n18.values', 'n4.value>n19.p', 'n18.value>n19.total', 'n19.value>n20.factor', 'n7.values>n10.x', 'n8.values>n11.x', 'n9.values>n12.x',
    'n10.ok>n13.a', 'n11.ok>n13.b', 'n13.value>n14.a', 'n12.ok>n14.b', 'n14.value>n4.pass', 'n4.limit>n15.c1', 'n4.status>n15.c2']),
  todo: 1,
});

// PV curve: scale every load up until the load flow stops converging (the nose of the curve).
TEMPLATES.push({
  id: 'pv-curve', title: 'PV curve by load scaling',
  desc: 'Scales every load up in steps and tables the lowest busbar voltage until the load flow no longer converges: the nose of the PV curve.',
  wf: W('PV curve by load scaling', {
    n1: START(),
    n2: NOTE('For each scaling factor this multiplies the active and reactive power of every load (or of the loads named on Loads) by the factor, from their original values, runs the load flow and reads the lowest busbar voltage and where it is; the loads are put back after each pass. ' +
      'The loop stops at the first factor whose load flow does not converge: the nose of the PV curve, the loadability limit. Fill in the project, and widen Load scaling when the nose lies beyond it.'),
    n3: ['flow.range', 1, 0, 'Load scaling', { from: 1, to: 3, step: 0.05 }, ['from', 'to', 'step']],
    n4: ['pf.scale', 2, 0, 'Loads', { el: EL('ElmLod', '*', 'all'), attr: 'plini', attr2: 'qlini' }],
    n5: ['pf.ldf', 3, 0, '', {}],
    n6: ['flow.break', 4, 1, 'Nose of the curve', { msg: 'The load flow no longer converges: the nose of the PV curve' }],
    n7: ['pf.get', 4, 0, 'Busbar voltage', { el: EL('ElmTerm', '*', 'all'), attr: 'm:u' }],
    n8: ['out.table.add', 5, 0, '', { table: 'PV curve', cols: [{ id: 'c1', name: 'Lowest voltage (p.u.)' }, { id: 'c2', name: 'Lowest at' }] }],
    n9: ['out.plot.table', 2, 2.2, 'PV curve', { table: 'PV curve', x: 'Load scaling', ys: 'Lowest voltage (p.u.)', kind: 'line', ylabel: 'Lowest busbar voltage', yunit: 'p.u.' }],
  }, ['n1>n3', 'n3.body>n4', 'n4>n5', 'n5.ok>n7', 'n5.fail>n6', 'n7>n8', 'n3.done>n9'],
  ['n3.value>n4.factor', 'n7.min>n8.c1', 'n7.at_min>n8.c2']),
  todo: 1,
});

// A batch of RMS runs: one fault, several clearing times, the rotor angle swings drawn together.
TEMPLATES.push({
  id: 'rms-batch', title: 'RMS runs for several fault durations',
  desc: 'Runs one RMS simulation per fault duration at a busbar, tables the peak rotor angle spread of the generators and draws every run on one graph.',
  wf: W('RMS runs for several fault durations', {
    n1: START(),
    n2: NOTE('For each fault duration this applies a three-phase fault at the busbar, runs an RMS simulation for 5 s and records the rotor angle spread of all synchronous generators (the largest minus the smallest rotor angle). ' +
      'Each run gets a row with its peak spread and whether it stayed below 180 degrees (a run that stops early keeps its row), and every run is drawn on one graph. Fill in the project and the faulted busbar.'),
    n3: ['flow.list', 1, 0, 'Fault duration (s)', { values: '0.1, 0.15, 0.2, 0.25' }, ['values']],
    n4: ['pf.evt.shc', 2, 0, 'Fault', { target: EL('ElmTerm'), t: 1, fault: '3ph', clear: 'fault' }, ['target']],
    n5: ['pf.rms', 3, 0, '', { tstop: 5, record: [{ id: 'r1', el: EL('ElmSym', '*', 'all'), var: 'c:firel', combine: 'spread' }] }],
    n6: ['sig.peak', 4, 1.2, 'Peak spread', { kind: 'max' }],
    n7: ['chk.limit', 4, 0, 'Rotor angle spread (deg)', { against: 'value', hi: 180, goOn: true }, ['hi']],
    n8: ['out.table.add', 5, 0, '', { table: 'RMS runs', cols: [{ id: 'c1', name: 'Peak rotor angle spread (deg)' }, { id: 'c2', name: 'Stable' }] }],
    n9: ['out.plot.series', 6, 0, 'Rotor angle spread', { collect: 'loop', ylabel: 'Rotor angle spread' }],
  }, ['n1>n3', 'n3.body>n4', 'n4>n5', 'n5.ok>n7', 'n5.early>n7', 'n7.pass>n8', 'n8>n9'],
  ['n3.item>n4.duration', 'n5.r1>n6.series', 'n5.r1>n7.x', 'n6.value>n8.c1', 'n7.text>n8.c2', 'n5.r1>n9.l1']),
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
