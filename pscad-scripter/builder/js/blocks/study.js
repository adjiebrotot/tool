// PSCAD: build and run (DESIGN section 9, "study"): compiling the case, running the EMT
// simulation, reading its output channels, the fault and switching components an EMT case uses
// instead of an event list, snapshots, and simulation sets.
//
// Type ids, setting keys, select option values, list row ids and port ids are frozen handles
// (saved in every workflow and .py); change titles, labels, descriptions and tips freely.
//
// Every runtime helper called here is described in runtime/API-px.md (px_studies.py, and the
// controls section of px_model.py). Times are seconds; a time step is microseconds, as PSCAD
// itself shows them.
//
// PSCAD is an EMT simulator: there is no load flow, no short-circuit calculation and no
// frequency-domain harmonic scan to run, so there are no blocks for them. A fault, a trip or a
// set-point change is a component already in the model whose timing a step writes, and
// harmonics come out of the time-domain result (Power system checks: THD, Harmonic spectrum).

import { defineBlock, defineFamily } from '../core/registry.js';
import { parseLines } from './start.js';
import {
  elementSetting, objInput, numInput, elemText, nameSetting, restoreSetting, onErrorSetting,
  passLabel, listName, pinned, noneOr, routeAt, enterLoop, noteFor, notesOf, noteRun,
  noteBuild, noteEvent, needRun, warnRoute, eventsPending, lastRunFor,
} from './model.js';

const CAT = 'study';

// ---------------------------------------------------------------------------------------------
// Build

defineBlock({
  type: 'px.build', cat: CAT, kind: 'branch',
  title: 'Build the case',
  desc: 'Compiles the case with its Fortran compiler and goes on along Built or Did not build. A PSCAD case is Fortran that EMTDC compiles before it can run, so the build has errors of its own.',
  keywords: ['build', 'compile', 'fortran', 'emtdc', 'make', 'errors', 'floating', 'clean', 'rebuild'],
  flowOuts: [{ id: 'ok', label: 'Built' }, { id: 'fail', label: 'Did not build', stopMsg: 'The case did not build' }],
  outputs: [
    { id: 'built', label: 'Built', type: 'bool', var: 'built', more: true },
    { id: 'errors', label: 'Errors', type: 'list', var: 'build_errors', more: true, tip: 'The error lines of the compiler, for a table row or a message.' },
    { id: 'warnings', label: 'Warnings', type: 'list', var: 'build_warnings', more: true },
    { id: 'seconds', label: 'Took', type: 'num', unit: 's', var: 'build_seconds', more: true },
  ],
  settings: [
    { key: 'clean', label: 'Throw the last build away first', kind: 'bool', default: false,
      tip: 'Slower, and the honest thing after changing a component’s definition rather than its parameters.' },
    { key: 'force', label: 'Build even if nothing changed', kind: 'bool', default: false, more: true,
      tip: 'Off: a case this script has already built is not built again, which saves the compile on every pass of a loop.' },
  ],
  summary(s) { return s.clean ? 'clean, then build' : s.force ? 'always build' : 'build if it needs it'; },
  helpers: ['px_build'],
  effects: { writes: [], reads: ['model'] },
  emit(cx) {
    noteBuild(cx);
    cx.helper('px_build');
    const r = cx.name(cx.label === 'Build the case' ? 'build' : cx.label);
    cx.out('built', `${r}.ok`);
    cx.out('errors', `${r}.errors`);
    cx.out('warnings', `${r}.warnings`);
    cx.out('seconds', `${r}.seconds`);
    return {
      lines: [`${r} = px_build(app, None, ${cx.val('clean')}, ${cx.val('force')})`],
      branches: [{ out: 'ok', test: `${r}.ok` }], elseOut: 'fail',
    };
  },
  validate(cx) { notesOf(cx); },
});

// ---------------------------------------------------------------------------------------------
// Run

defineBlock({
  type: 'px.run', cat: CAT, kind: 'branch',
  title: 'Run simulation',
  desc: 'Builds the case if it needs it, runs the EMT simulation, and reads its output channels back. Goes on along Reached the end, Stopped early or Did not build.',
  keywords: ['run', 'simulate', 'emt', 'emtdc', 'simulation', 'time step', 'duration', 'plot step', 'transient', 'solve'],
  flowOuts: [
    { id: 'ok', label: 'Reached the end' },
    { id: 'early', label: 'Stopped early', stopMsg: 'The simulation stopped before the end' },
    { id: 'nobuild', label: 'Did not build', stopMsg: 'The case did not build', more: true },
  ],
  outputs: [
    { id: 'result', label: 'Result', type: 'res', var: 'run', tip: 'Wire this into Read a channel to get a curve out of this run.' },
    { id: 'reached', label: 'Reached the end', type: 'bool', var: 'reached_end', more: true },
    { id: 'tend', label: 'Last time', type: 'num', unit: 's', var: 't_end', more: true },
    { id: 'took', label: 'Took', type: 'num', unit: 's', var: 'run_seconds', more: true },
    { id: 'channels', label: 'Channels', type: 'list', var: 'channel_names', more: true, tip: 'The names of the output channels the run recorded.' },
    { id: 'message', label: 'Message', type: 'text', var: 'run_message', more: true, tip: 'The last thing EMTDC said that was not ordinary progress.' },
  ],
  settings: [
    { key: 'duration', label: 'Run for', kind: 'number', default: 1, unit: 's', min: 0, step: 0.1, required: true,
      tip: 'How long to simulate, in seconds.' },
    { key: 'step', label: 'Time step', kind: 'number', default: 50, unit: 'us', min: 0.01, step: 5,
      tip: 'The EMT solution step in microseconds. 50 us is the usual starting point; a converter or a cable may need less.' },
    { key: 'plotStep', label: 'Plot step', kind: 'number', default: 250, unit: 'us', min: 0.01, step: 50,
      tip: 'How often a sample is written to the output channels, in microseconds. A bigger plot step makes smaller result files and a coarser curve.' },
    { key: 'build', label: 'Build', kind: 'select', default: 'auto', more: true,
      options: [['auto', 'If it needs it'], ['always', 'Every time'], ['never', 'Not at all']],
      tip: '"If it needs it" compiles once per run of the script, and again after any step that changed the model.' },
    { key: 'read', label: 'Read the results', kind: 'select', default: 'out', more: true,
      options: [['out', 'From PSCAD’s output files'], ['curves', 'Off the case’s graphs'], ['none', 'Do not read them']],
      tip: 'The output files need only an output channel on the signal. Reading off the graphs needs the signal drawn on one, and gives exactly what the graph shows.' },
    { key: 'keepFiles', label: 'Keep the result files', kind: 'bool', default: false, more: true,
      showIf: (s) => s.read === 'out',
      tip: 'Off: the .out files of each run are taken away once read, so a short run cannot be read as a long one. On: they stay in the case’s build folder.' },
  ],
  summary(s) {
    const bits = [`${s.duration} s`, `${s.step} us step`];
    if (s.build === 'never') bits.push('no build');
    if (s.read === 'none') bits.push('results not read');
    return bits.join(', ');
  },
  helpers: ['px_run'],
  effects: { writes: ['results'], reads: ['model'] },
  emit(cx) {
    // The event times have to be read before noteRun, which clears them: they belong to
    // the run being written, not to the next one.
    const events = eventsPending().slice();
    noteRun(cx);
    cx.helper('px_run');
    const r = cx.name(cx.label === 'Run simulation' ? 'run' : cx.label);
    cx.out('result', r);
    cx.out('reached', `${r}.ok`);
    cx.out('tend', `${r}.t_end`);
    cx.out('took', `${r}.duration`);
    cx.out('channels', `${r}.names()`);
    cx.out('message', `${r}.message`);
    const args = [
      'app', cx.val('duration'), cx.val('step'), cx.val('plotStep'), 'None',
      `events=${eventsExpr(cx, events)}`,
      `build=${cx.val('build')}`, `read=${cx.val('read')}`,
      `keep_files=${cx.val('keepFiles')}`,
    ];
    return {
      lines: [`${r} = px_run(${args.join(', ')})`],
      branches: [{ out: 'ok', test: `${r}.ok` }, { out: 'nobuild', test: `${r}.status == "failed"` }],
      elseOut: 'early',
    };
  },
  validate(cx) {
    notesOf(cx);
    if (Number(cx.s.plotStep) < Number(cx.s.step)) {
      cx.warn(`${cx.label} has a plot step (${cx.s.plotStep} us) smaller than its time step (${cx.s.step} us), so no extra samples are recorded. Make the plot step a whole multiple of the time step.`);
    }
    if (cx.s.read === 'none') {
      const reads = cx.consumers('result');
      if (reads.length) cx.warn(`${cx.label} does not read its results, so ${reads.length === 1 ? 'the block' : 'the blocks'} wired to Result get nothing. Set "Read the results" to the output files.`);
    }
  },
});

// The event times the model's fault and switching steps have set since the last run: they go
// into the run so the checks can find the event and the graphs can mark it. The times come from
// those steps' own outputs, so this is a list of (time, label) pairs built in the script.
function eventsExpr(cx, pend) {
  const have = (pend || []).filter(e => e && e.at);
  if (!have.length) return '()';
  return '[' + have.map(e => `(${e.at}, ${cx.lit(e.label)})`).join(', ') + ']';
}

// ---------------------------------------------------------------------------------------------
// Reading what the run recorded

defineBlock({
  type: 'px.series', cat: CAT, kind: 'pure',
  title: 'Read a channel',
  desc: 'Takes one output channel of a run as a curve over time, for the checks and the graphs. A channel the run did not record gives an empty curve and a note, never an error.',
  keywords: ['channel', 'read', 'curve', 'series', 'pgb', 'output', 'result', 'signal', 'trace', 'waveform'],
  inputs: [{ id: 'run', label: 'Result', type: 'res', tip: 'The Result output of a Run simulation.' }],
  outputs: [{ id: 'series', label: 'Curve', type: 'series', var: 'curve' }],
  settings: [
    { key: 'channel', label: 'Channel', kind: 'text', default: '', required: true, placeholder: 'The channel name, as in PSCAD',
      tip: 'The output channel’s Title in PSCAD. A three phase channel becomes three: "Load Voltage:1", ":2", ":3".' },
    { key: 'combine', label: 'Several channels', kind: 'select', default: 'one', more: true,
      options: [['one', 'Just this one'], ['mean', 'Average of the matches'], ['sum', 'Sum of the matches'], ['min', 'Lowest of the matches'], ['max', 'Highest of the matches'], ['spread', 'Highest minus lowest']],
      tip: 'With * in the name, several channels match: this says whether to take them one by one or bring them together point by point.' },
    { key: 'label', label: 'Name it', kind: 'text', default: '', more: true, placeholder: 'Empty: the channel name',
      tip: 'What this curve is called in the graph key and the check messages.' },
  ],
  ports(s) {
    const many = s.combine !== 'one';
    return { outputs: [{ id: 'series', label: many ? 'Curve' : 'Curve', type: 'series', var: 'curve' }] };
  },
  summary(s) {
    if (!s.channel) return 'no channel chosen';
    return s.combine === 'one' ? String(s.channel) : `${s.combine} of ${s.channel}`;
  },
  varName(s) { return String(s.label || s.channel || 'curve'); },
  helpers: ['px_simresult'],
  effects: { writes: [], reads: ['results'] },
  emit(cx) {
    needRun(cx, 'a recorded channel');
    const run = cx.in('run');
    const label = cx.val('label');
    if (cx.s.combine === 'one' && !pinned(cx, 'combine')) {
      // A calculator gives back the expression itself, not a line.
      return `${run}.series(${cx.val('channel')}, ${label})`;
    }
    const names = cx.name('names');
    return {
      lines: [`${names} = [c.name for c in ${run}.channels]`],
      expr: `${run}.series_combined([n for n in ${names} if _px_like(n, ${cx.val('channel')})], ${cx.val('combine')}, ${label})`,
    };
  },
  validate(cx) {
    warnRoute(cx);
    if (!cx.has('run')) cx.todo(`Wire the Result of a Run simulation into ${cx.label}.`);
  },
});

// ---------------------------------------------------------------------------------------------
// The components an EMT case faults and switches with

defineBlock({
  type: 'px.fault', cat: CAT, kind: 'action',
  title: 'Set a fault',
  desc: 'Writes when a fault component in the model starts and how long it lasts. PSCAD has no event list: the fault is already drawn in the case, and this sets its timing for the next run.',
  keywords: ['fault', 'short circuit', 'tpflt', 'tfault', 'timed fault', 'event', 'fault time', 'clearing', 'duration', 'frt'],
  inputs: [objInput('obj', 'Fault component', 'el'), numInput('at', 'Starts at', 'at', 's'), numInput('duration', 'Lasts', 'duration', 's')],
  outputs: [
    { id: 'at', label: 'Starts at', type: 'num', unit: 's', var: 'fault_at', more: true },
    { id: 'clear', label: 'Cleared at', type: 'num', unit: 's', var: 'fault_clear', more: true },
  ],
  settings: [
    elementSetting('el', 'Fault component', 'master:tpflt', { example: 'F1' }),
    { key: 'at', label: 'Starts at', kind: 'number', default: 1, unit: 's', min: 0, step: 0.1, required: true },
    { key: 'duration', label: 'Lasts', kind: 'number', default: 0.12, unit: 's', min: 0, step: 0.01, required: true,
      tip: 'How long the fault stays on. The clearing time is the start plus this.' },
    { key: 'phases', label: 'Phases', kind: 'text', default: '', more: true, placeholder: 'Leave empty to keep what the component has',
      tip: 'Which phases the fault is on, as the component names it: ABC, AB, A. Only written when the component has such a parameter.' },
    { key: 'resistance', label: 'Fault resistance', kind: 'number', default: null, unit: 'ohm', min: 0, step: 0.01, more: true,
      tip: 'Leave empty to keep the component’s own value. Only written when the component has such a parameter.' },
    { key: 'on', label: 'Switch the fault on', kind: 'bool', default: true, more: true,
      tip: 'Off: the fault component is disabled for the next run, which is how a base case runs with the fault left in the model.' },
  ],
  summary(s) {
    const at = Number(s.at), d = Number(s.duration);
    const times = Number.isFinite(at) && Number.isFinite(d) ? `${at} to ${(at + d).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')} s` : `${s.at} s`;
    return `${elemText(s.el, 'the fault')}: ${s.on ? times : 'off'}`;
  },
  helpers: ['px_events'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    const at = cx.in('at');
    const st = noteEvent(cx, String(cx.node.label || '').trim() || 'Fault');
    st.events[st.events.length - 1].at = at;
    cx.helper('px_events');
    const el = cx.s.el || {};
    const r = cx.name('fault');
    cx.out('at', `${r}[0]`);
    cx.out('clear', `${r}[1]`);
    const phases = String(cx.s.phases || '').trim() || pinned(cx, 'phases') ? noneOr(cx, 'phases', '') : 'None';
    const res = cx.s.resistance === null || cx.s.resistance === undefined || cx.s.resistance === '' ? 'None' : cx.val('resistance');
    const m = el.match === 'all' ? 'all' : el.match === 'first' ? 'first' : 'one';
    return [`${r} = set_fault(app, ${cx.lit(String(el.cls || 'master:tpflt'))}, ${cx.lit(String(el.name || '').trim())}, ${at}, ${cx.in('duration')}, ${cx.val('on')}, ${cx.lit(m)}, ${phases}, ${res})`];
  },
  validate(cx) { warnRoute(cx); },
});

defineBlock({
  type: 'px.switching', cat: CAT, kind: 'action',
  title: 'Set a switching time',
  desc: 'Writes when a breaker or switch in the model operates. As with a fault, the timing lives in the component, so this sets it for the next run.',
  keywords: ['breaker', 'switch', 'open', 'close', 'trip', 'timed breaker', 'tbreak', 'event', 'switching', 'outage'],
  inputs: [objInput('obj', 'Breaker component', 'el'), numInput('at', 'At', 'at', 's')],
  outputs: [{ id: 'at', label: 'At', type: 'num', unit: 's', var: 'switch_at', more: true }],
  settings: [
    elementSetting('el', 'Breaker component', 'master:tbreakn', { example: 'BRK1' }),
    { key: 'at', label: 'At', kind: 'number', default: 1, unit: 's', min: 0, step: 0.1, required: true },
    { key: 'action', label: 'It', kind: 'select', default: 'open', options: [['open', 'Opens'], ['close', 'Closes']] },
  ],
  summary(s) { return `${elemText(s.el, 'the breaker')} ${s.action === 'close' ? 'closes' : 'opens'} at ${s.at} s`; },
  helpers: ['px_events'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    const at = cx.in('at');
    const label = String(cx.node.label || '').trim() || (cx.s.action === 'close' ? 'Close' : 'Open');
    const st = noteEvent(cx, label);
    st.events[st.events.length - 1].at = at;
    cx.helper('px_events');
    const el = cx.s.el || {};
    const m = el.match === 'all' ? 'all' : el.match === 'first' ? 'first' : 'one';
    return [`${cx.out('at')} = set_switching(app, ${cx.lit(String(el.cls || ''))}, ${cx.lit(String(el.name || '').trim())}, ${at}, ${cx.val('action')}, ${cx.lit(m)})`];
  },
  validate(cx) { warnRoute(cx); },
});

// ---------------------------------------------------------------------------------------------
// Snapshots

defineBlock({
  type: 'px.snap.save', cat: CAT, kind: 'action',
  title: 'Save a snapshot',
  desc: 'Has the next run save the whole state of the case at one instant. Every later run can start from it, so a long start-up is simulated once and the cases branch from there.',
  keywords: ['snapshot', 'save', 'snp', 'initialise', 'start', 'state', 'warm start', 'speed'],
  inputs: [numInput('at', 'At', 'at', 's')],
  outputs: [{ id: 'file', label: 'Snapshot', type: 'text', var: 'snapshot', more: true }],
  settings: [
    { key: 'at', label: 'At', kind: 'number', default: 1, unit: 's', min: 0, step: 0.1, required: true,
      tip: 'When to take the snapshot. Give the case long enough to settle first.' },
    { key: 'file', label: 'File', kind: 'text', default: '', more: true, placeholder: 'Empty: named after the case',
      tip: 'The .snp file, written in the case’s build folder.' },
  ],
  summary(s) { return `at ${s.at} s${s.file ? ` as ${s.file}` : ''}`; },
  helpers: ['snapshots'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    routeAt(cx);
    cx.helper('snapshots');
    return [`${cx.out('file')} = snapshot_save(app, ${cx.in('at')}, None, ${cx.val('file')})`];
  },
  validate(cx) { notesOf(cx); },
});

defineBlock({
  type: 'px.snap.use', cat: CAT, kind: 'action',
  title: 'Start from a snapshot',
  desc: 'Has the runs after it start from a snapshot file instead of from zero, which skips the start-up every time.',
  keywords: ['snapshot', 'start from', 'snp', 'warm start', 'initialise', 'resume', 'speed'],
  inputs: [{ id: 'file', label: 'Snapshot', type: 'text', fallback: 'file' }],
  outputs: [{ id: 'path', label: 'Snapshot', type: 'text', var: 'snapshot', more: true }],
  settings: [
    { key: 'file', label: 'Snapshot', kind: 'text', default: '', required: true, placeholder: 'e.g. mycase.snp',
      tip: 'The .snp file in the case’s build folder, usually the one Save a snapshot wrote.' },
  ],
  summary(s) { return s.file || 'no snapshot chosen'; },
  helpers: ['snapshots'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    routeAt(cx);
    cx.helper('snapshots');
    return [`${cx.out('path')} = snapshot_use(app, ${cx.in('file')})`];
  },
  validate(cx) { notesOf(cx); },
});

defineBlock({
  type: 'px.snap.off', cat: CAT, kind: 'action',
  title: 'Start from zero again',
  desc: 'Puts the case back to starting its runs from zero, after a Start from a snapshot.',
  keywords: ['snapshot', 'off', 'zero', 'standard', 'cold start', 'reset'],
  settings: [],
  summary() { return 'runs start from zero'; },
  helpers: ['snapshots'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    routeAt(cx);
    cx.helper('snapshots');
    return ['snapshot_off(app)'];
  },
  validate(cx) { notesOf(cx); },
});

// ---------------------------------------------------------------------------------------------
// Simulation sets

defineBlock({
  type: 'px.simset.create', cat: CAT, kind: 'action',
  title: 'Make a simulation set',
  desc: 'Gathers cases into a simulation set and says how many run at the same time. This is where a PSCAD study gets real parallelism: four at a time finish in about the time of one.',
  keywords: ['simulation set', 'simset', 'parallel', 'volley', 'batch', 'many cases', 'at once', 'tasks'],
  inputs: [{ id: 'cases', label: 'Cases', type: 'text', fallback: 'cases', more: true, tip: 'The case names to put in. Empty: the case the workflow works on.' }],
  outputs: [{ id: 'set', label: 'Set', type: 'obj', var: 'sim_set' }],
  settings: [
    { key: 'name', label: 'Name', kind: 'text', default: 'PXB_set', required: true,
      tip: 'A name PSCAD accepts. A set of that name that is already there is replaced.' },
    { key: 'cases', label: 'Cases', kind: 'textarea', default: '', more: true, placeholder: 'One case name per line (empty: the case in use)' },
    { key: 'volley', label: 'Run at the same time', kind: 'number', default: 1, min: 1, step: 1,
      tip: 'How many of the set’s cases run at once. Keep it at or below the number of processor cores the machine has.' },
    { key: 'keep', label: 'Keep the set after the run', kind: 'bool', default: false, more: true },
  ],
  summary(s) {
    const n = parseLines(s.cases).length;
    return `${s.name || 'set'}: ${n || 'the case in use'}${n ? ` case${n === 1 ? '' : 's'}` : ''}, ${s.volley} at a time`;
  },
  helpers: ['simsets'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    routeAt(cx);
    cx.helper('simsets', 'projects');
    const typed = parseLines(cx.s.cases);
    const cases = cx.has('cases') ? `[project_use(app, n) for n in as_items(${cx.in('cases')})]`
      : (typed.length ? `[project_use(app, n) for n in ${cx.lit(typed)}]` : '()');
    if (cx.has('cases')) cx.helper('convert');
    return [`${cx.out('set')} = simset_create(app, ${cx.val('name')}, ${cases}, ${cx.val('volley')}, ${cx.val('keep')})`];
  },
  validate(cx) { notesOf(cx); },
});

defineBlock({
  type: 'px.simset.override', cat: CAT, kind: 'action',
  title: 'Override a set’s settings',
  desc: 'Changes the simulation settings of a simulation set’s tasks, so one set runs the same case at several durations or time steps without touching the case.',
  keywords: ['simulation set', 'override', 'duration', 'time step', 'plot step', 'task', 'settings'],
  inputs: [{ id: 'set', label: 'Set', type: 'obj' }],
  settings: [
    { key: 'task', label: 'Task', kind: 'text', default: '', more: true, placeholder: 'Empty: every task in the set' },
    { key: 'duration', label: 'Run for', kind: 'number', default: null, unit: 's', min: 0, step: 0.1,
      tip: 'Leave empty to keep the case’s own duration.' },
    { key: 'step', label: 'Time step', kind: 'number', default: null, unit: 'us', min: 0.01, step: 5 },
    { key: 'plotStep', label: 'Plot step', kind: 'number', default: null, unit: 'us', min: 0.01, step: 50 },
  ],
  summary(s) {
    const bits = [s.duration === null || s.duration === '' ? '' : `${s.duration} s`,
      s.step === null || s.step === '' ? '' : `${s.step} us step`,
      s.plotStep === null || s.plotStep === '' ? '' : `${s.plotStep} us plot`].filter(Boolean);
    return bits.length ? bits.join(', ') : 'nothing overridden';
  },
  helpers: ['simsets'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    routeAt(cx);
    cx.helper('simsets');
    const num = (k) => (cx.s[k] === null || cx.s[k] === undefined || cx.s[k] === '' ? 'None' : cx.val(k));
    return [`simset_override(app, ${cx.in('set')}, ${noneOr(cx, 'task', '')}, ${num('duration')}, ${num('step')}, ${num('plotStep')})`];
  },
  validate(cx) {
    notesOf(cx);
    if (!cx.has('set')) cx.todo(`Wire the Set of a Make a simulation set into ${cx.label}.`);
  },
});

defineBlock({
  type: 'px.simset.run', cat: CAT, kind: 'branch',
  title: 'Run a simulation set',
  desc: 'Builds and runs every case of a simulation set, as many at a time as its volley says. Its results are read with Read a channel after a Run simulation on each case, not from the set itself.',
  keywords: ['simulation set', 'run', 'parallel', 'volley', 'batch', 'all cases', 'at once'],
  inputs: [{ id: 'set', label: 'Set', type: 'obj' }],
  flowOuts: [{ id: 'ok', label: 'Finished' }, { id: 'fail', label: 'Had errors', stopMsg: 'The simulation set had errors' }],
  outputs: [
    { id: 'finished', label: 'Finished', type: 'bool', var: 'set_ok', more: true },
    { id: 'errors', label: 'Errors', type: 'list', var: 'set_errors', more: true },
    { id: 'took', label: 'Took', type: 'num', unit: 's', var: 'set_seconds', more: true },
  ],
  settings: [],
  summary() { return 'every case in the set'; },
  helpers: ['simsets'],
  effects: { writes: ['results'], reads: ['model'] },
  emit(cx) {
    noteRun(cx);
    cx.helper('simsets');
    const r = cx.name('set_run');
    cx.out('finished', `${r}.ok`);
    cx.out('errors', `${r}.errors`);
    cx.out('took', `${r}.seconds`);
    return {
      lines: [`${r} = simset_run(app, ${cx.in('set')})`],
      branches: [{ out: 'ok', test: `${r}.ok` }], elseOut: 'fail',
    };
  },
  validate(cx) {
    notesOf(cx);
    if (!cx.has('set')) cx.todo(`Wire the Set of a Make a simulation set into ${cx.label}.`);
  },
});

// ---------------------------------------------------------------------------------------------
// Families

defineFamily({
  id: 'snapshot', title: 'Snapshot',
  desc: 'Save the state of the case at one instant, start later runs from it, or go back to starting from zero. Choose which under Kind.',
  keywords: ['snapshot', 'snp', 'warm start', 'initialise', 'save', 'start from', 'speed'],
  members: ['px.snap.save', 'px.snap.use', 'px.snap.off'], dflt: 'px.snap.save',
});
defineFamily({
  id: 'simset', title: 'Simulation set',
  desc: 'Gather cases into a set, override their settings, or run the set with several cases at a time. Choose which under Kind.',
  keywords: ['simulation set', 'simset', 'parallel', 'volley', 'batch', 'tasks'],
  members: ['px.simset.create', 'px.simset.override', 'px.simset.run'], dflt: 'px.simset.create',
});
defineFamily({
  id: 'timing', title: 'Set an event time',
  desc: 'Write when a fault starts and clears, or when a breaker opens or closes. Choose which under Kind.',
  keywords: ['fault', 'breaker', 'switch', 'event', 'time', 'timing', 'trip', 'clearing'],
  members: ['px.fault', 'px.switching'], dflt: 'px.fault',
});
