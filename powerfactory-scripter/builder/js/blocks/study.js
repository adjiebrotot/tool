// PowerFactory: studies (DESIGN section 9, "study"): load flow, RMS and EMT simulation, harmonic
// load flow, short circuit, the simulation events, Read time series and the contingency blocks.
//
// Type ids, setting keys, select option values, list row ids and port ids are frozen handles
// (saved in every workflow and .py); change titles, labels, descriptions and tips freely.
//
// Every runtime helper called here is described in runtime/API-pf.md (pf_studies.py, and the
// contingencies section of pf_model.py). Times are seconds whatever the project shows (the
// runtime writes them in PowerFactory's internal unit).

import { defineBlock } from '../core/registry.js';
import {
  GEN_KINDS, elementSetting, objInput, numInput, elemText, nameSetting, restoreSetting, onErrorSetting, passLabel,
  listName, pinned, routeAt, enterLoop, inLoopWith, noteFor, notesOf, noteCalc,
} from './model.js';

const CAT = 'study';

// Simulation variables a reader is likely to record: [description, unit]. Labels read
// "Bus 16 · Frequency (Hz)"; an unknown variable shows its own name.
export const VARIABLES = {
  'm:fehz': ['Frequency', 'Hz'], 'm:fe': ['Frequency', 'p.u.'],
  'm:u': ['Voltage', 'p.u.'], 'm:u1': ['Positive-sequence voltage', 'p.u.'], 'm:U': ['Voltage', 'kV'], 'm:U1': ['Positive-sequence voltage', 'kV'],
  'm:Ul': ['Line-to-line voltage', 'kV'], 'm:phiu': ['Voltage angle', 'deg'], 'm:u:A': ['Voltage, phase A', 'p.u.'], 'm:U:A': ['Voltage, phase A', 'kV'],
  's:speed': ['Speed', 'p.u.'], 's:xspeed': ['Speed', 'p.u.'], 'c:firel': ['Rotor angle', 'deg'], 's:firel': ['Rotor angle', 'deg'],
  's:P1': ['Active power', 'MW'], 's:Q1': ['Reactive power', 'Mvar'], 's:pt': ['Turbine power', 'p.u.'], 's:ve': ['Excitation voltage', 'p.u.'],
  'm:P:bus1': ['Active power', 'MW'], 'm:Q:bus1': ['Reactive power', 'Mvar'], 'm:Psum:bus1': ['Active power, total', 'MW'], 'm:Qsum:bus1': ['Reactive power, total', 'Mvar'],
  'm:I:bus1': ['Current', 'kA'], 'm:i1:bus1': ['Positive-sequence current', 'p.u.'], 'c:loading': ['Loading', '%'],
  'm:Ikss': ['Initial short-circuit current', 'kA'], 'm:Skss': ['Initial short-circuit power', 'MVA'], 'm:THD': ['Total harmonic distortion', '%'],
};
const COMBINE = [['none', 'One element'], ['mean', 'Average of the matches'], ['sum', 'Sum of the matches'], ['min', 'Lowest of the matches'], ['max', 'Highest of the matches'], ['spread', 'Spread (highest minus lowest)']];
const COMBINE_WORD = { mean: 'Average of', sum: 'Sum of', min: 'Lowest of', max: 'Highest of', spread: 'Spread of' };

export function seriesLabel(name, variable, combine) {
  const v = String(variable || '').trim();
  const d = VARIABLES[v];
  const who = String(name || '').trim() || '?';
  const head = combine && combine !== 'none' ? `${COMBINE_WORD[combine] || combine} ${who}` : who;
  return d ? `${head} · ${d[0]} (${d[1]})` : `${head} · ${v || '?'}`;
}
// The same words for an output port, whose unit the card adds by itself; with no element chosen
// yet it is just the variable.
function seriesPortLabel(name, variable, combine) {
  const v = String(variable || '').trim();
  const d = VARIABLES[v];
  const what = d ? d[0] : (v || '?');
  const who = String(name || '').trim();
  if (!who) return what;
  const head = combine && combine !== 'none' ? `${COMBINE_WORD[combine] || combine} ${who}` : who;
  return `${head} · ${what}`;
}
const unitOf = (variable) => (VARIABLES[String(variable || '').trim()] || [])[1] || '';

const RECORD_CLASSES = ['ElmTerm', 'ElmSym', 'ElmGenstat', 'ElmPvsys', 'ElmAsm', 'ElmVsc', 'ElmLne', 'ElmTr2', 'ElmTr3', 'ElmLod', 'ElmXnet', 'ElmShnt', 'ElmSvs', 'ElmDsl'];
const recordRows = (s) => (Array.isArray(s.record) ? s.record : []);
// A Record row's element { cls, name, match } (a row saved with plain cls / name columns reads too).
const rowEl = (row) => {
  const e = row && row.el && typeof row.el === 'object' ? row.el : {};
  const old = !String(e.name || '').trim() && typeof (row && row.name) === 'string' && row.name.trim();
  const match = ['one', 'first', 'all'].includes(e.match) ? e.match : 'one';
  return old ? { cls: String(row.cls || 'ElmTerm'), name: row.name.trim(), match } : { cls: String(e.cls || 'ElmTerm'), name: String(e.name || '').trim(), match };
};
const queryOf = (row) => {
  const { name, cls } = rowEl(row);
  return name.toLowerCase().endsWith('.' + cls.toLowerCase()) ? name : `${name}.${cls}`;
};
// One curve from several elements: a way to combine is chosen, or the name matches all.
const rowMany = (row) => (row.combine && row.combine !== 'none') || rowEl(row).match === 'all';
const FAULT_WORDS = { '3ph': 'three-phase', '2ph': 'two-phase', '1ph': 'single-phase to ground', '2phg': 'two-phase to ground' };

// ---------------------------------------------------------------------------------------------
// Load flow, harmonic load flow, short circuit

const AS_CASE = 'As in the study case';

defineBlock({
  type: 'pf.ldf', cat: CAT, kind: 'branch',
  title: 'Run load flow',
  desc: 'Runs the load flow (ComLdf) of the active study case with its own settings, or with the network type, reactive power limits or taps changed for this run.',
  keywords: ['load flow', 'power flow', 'ldf', 'ComLdf', 'convergence', 'converged', 'steady state', 'Newton-Raphson', 'slack', 'voltage', 'loading', 'AC', 'DC'],
  flowOuts: [{ id: 'ok', label: 'Converged' }, { id: 'fail', label: 'Did not converge', stopMsg: 'Load flow did not converge' }],
  outputs: [
    { id: 'converged', label: 'Converged', type: 'bool', var: 'converged' },
    { id: 'slack_mw', label: 'Slack power', type: 'num', unit: 'MW', var: 'slack_mw', tip: 'Active power of the reference machines and slack external grids (empty when it did not converge).' },
  ],
  settings: [
    { key: 'net', label: 'Calculation', kind: 'select', default: 'case', options: [['case', AS_CASE], ['ac', 'AC balanced'], ['unbalanced', 'AC unbalanced, 3-phase'], ['dc', 'DC']] },
    { key: 'qlim', label: 'Reactive power limits', kind: 'select', default: 'case', options: [['case', AS_CASE], ['on', 'Considered'], ['off', 'Ignored']] },
    { key: 'taps', label: 'Automatic transformer taps', kind: 'select', default: 'case', options: [['case', AS_CASE], ['on', 'On'], ['off', 'Off']] },
  ],
  summary(s) {
    const parts = [{ case: '', ac: 'AC balanced', unbalanced: 'AC unbalanced', dc: 'DC' }[s.net],
      s.qlim === 'case' ? '' : `Q limits ${s.qlim}`, s.taps === 'case' ? '' : `taps ${s.taps}`].filter(Boolean);
    return parts.length ? parts.join(', ') : 'Settings of the study case';
  },
  helpers: ['run_load_flow'],
  effects: { writes: ['results'], reads: [] },
  emit(cx) {
    noteCalc(cx, 'pf.ldf');
    cx.helper('run_load_flow');
    const r = cx.name(cx.label === 'Run load flow' ? 'ldf' : cx.label);
    cx.out('converged', `${r}.ok`);
    cx.out('slack_mw', `${r}.slack_mw`);
    return {
      lines: [`${r} = run_load_flow(app, ${cx.val('net')}, ${cx.val('qlim')}, ${cx.val('taps')})`],
      branches: [{ out: 'ok', test: `${r}.ok` }], elseOut: 'fail',
    };
  },
  validate(cx) { notesOf(cx); },
});

defineBlock({
  type: 'pf.hldf', cat: CAT, kind: 'branch',
  title: 'Run harmonic load flow',
  desc: 'Runs a harmonic load flow (ComHldf) in the active study case, with the load flow set to the same network type first. THD is then readable on busbars as m:THD.',
  keywords: ['harmonics', 'harmonic load flow', 'ComHldf', 'THD', 'distortion', 'm:THD', 'power quality', 'filter', 'hldf'],
  flowOuts: [{ id: 'ok', label: 'Finished' }, { id: 'fail', label: 'Failed', stopMsg: 'Harmonic load flow failed' }],
  outputs: [{ id: 'finished', label: 'Finished', type: 'bool', var: 'hldf_ok' }],
  settings: [{ key: 'net', label: 'Network', kind: 'select', default: 'case', options: [['case', AS_CASE], ['balanced', 'Balanced'], ['unbalanced', 'Unbalanced']] }],
  summary(s) { return s.net === 'case' ? 'Settings of the study case' : s.net === 'balanced' ? 'Balanced' : 'Unbalanced'; },
  helpers: ['run_harmonic'],
  effects: { writes: ['results'], reads: [] },
  emit(cx) {
    noteCalc(cx, 'pf.hldf');
    cx.helper('run_harmonic');
    const r = cx.name(cx.label === 'Run harmonic load flow' ? 'hldf' : cx.label);
    cx.out('finished', `${r}.ok`);
    return { lines: [`${r} = run_harmonic(app, ${cx.val('net')})`], branches: [{ out: 'ok', test: `${r}.ok` }], elseOut: 'fail' };
  },
  validate(cx) { notesOf(cx); },
});

const SHC_TARGETS = ['ElmTerm', 'ElmLne'];
defineBlock({
  type: 'pf.shc', cat: CAT, kind: 'branch',
  title: 'Run short circuit',
  desc: 'Runs a short-circuit calculation (ComShc) at every busbar or at one element. Results such as m:Ikss (kA) and m:Skss (MVA) are then readable on the faulted busbars.',
  keywords: ['short circuit', 'fault level', 'ComShc', 'IEC 60909', 'Ikss', 'Skss', 'm:Ikss', 'fault current', 'shc', 'ANSI', 'VDE', 'busbars'],
  flowOuts: [{ id: 'ok', label: 'Finished' }, { id: 'fail', label: 'Failed', stopMsg: 'Short circuit failed' }],
  inputs: [objInput('target', 'Fault at', 'target', SHC_TARGETS), numInput('rf', 'Fault resistance', 'rf', 'Ohm'), numInput('xf', 'Fault reactance', 'xf', 'Ohm')],
  outputs: [{ id: 'finished', label: 'Finished', type: 'bool', var: 'shc_ok' }],
  settings: [
    { key: 'method', label: 'Method', kind: 'select', default: 'iec', options: [['iec', 'IEC 60909'], ['vde', 'VDE 0102'], ['ansi', 'ANSI'], ['complete', 'Complete'], ['iec61363', 'IEC 61363']] },
    { key: 'fault', label: 'Fault type', kind: 'select', default: '3ph', options: [['3ph', 'Three-phase'], ['2ph', 'Two-phase'], ['1ph', 'Single-phase to ground'], ['2phg', 'Two-phase to ground']] },
    { key: 'current', label: 'Calculate', kind: 'select', default: 'max', options: [['max', 'Maximum short-circuit currents'], ['min', 'Minimum short-circuit currents']] },
    { key: 'at', label: 'Fault at', kind: 'select', default: 'all', noPin: true, options: [['all', 'Every busbar'], ['element', 'One element (or a list)']] },
    elementSetting('target', 'Fault at', 'ElmTerm', { showIf: (s) => s.at === 'element' }),
    { key: 'rf', label: 'Fault resistance', kind: 'number', default: 0, unit: 'Ohm', more: true },
    { key: 'xf', label: 'Fault reactance', kind: 'number', default: 0, unit: 'Ohm', more: true },
  ],
  ports(s) {
    const imp = [numInput('rf', 'Fault resistance', 'rf', 'Ohm'), numInput('xf', 'Fault reactance', 'xf', 'Ohm')];
    return { inputs: s.at === 'element' ? [objInput('target', 'Fault at', 'target', SHC_TARGETS), ...imp] : imp };
  },
  summary(s) {
    const m = { iec: 'IEC 60909', vde: 'VDE 0102', ansi: 'ANSI', complete: 'Complete', iec61363: 'IEC 61363' }[s.method];
    return `${m}, ${FAULT_WORDS[s.fault]}, ${s.current}, at ${s.at === 'element' ? elemText(s.target) : 'every busbar'}`;
  },
  helpers: ['run_short_circuit'],
  effects: { writes: ['results'], reads: [] },
  emit(cx) {
    noteCalc(cx, 'pf.shc');
    cx.helper('run_short_circuit');
    const r = cx.name(cx.label === 'Run short circuit' ? 'shc' : cx.label);
    cx.out('finished', `${r}.ok`);
    const target = cx.s.at === 'element' ? cx.in('target') : 'None';
    return {
      lines: [`${r} = run_short_circuit(app, ${cx.val('method')}, ${cx.val('fault')}, ${cx.val('current')}, ${target}, ${cx.in('rf')}, ${cx.in('xf')})`],
      branches: [{ out: 'ok', test: `${r}.ok` }], elseOut: 'fail',
    };
  },
  validate(cx) { notesOf(cx); },
});

// ---------------------------------------------------------------------------------------------
// RMS and EMT simulation

function simBlock(kind) {
  const rms = kind === 'rms';
  const W = rms ? 'RMS' : 'EMT';
  const type = rms ? 'pf.rms' : 'pf.emt';
  const title = `Run ${W} simulation`;
  const statics = [
    { id: 'result', label: 'Result', type: 'res', var: rms ? 'rms' : 'emt', tip: 'For Read time series, to read curves the Record list does not have.' },
    { id: 't_end', label: 'Stopped at', type: 'num', unit: 's', var: 't_end', tip: 'The simulation time reached.' },
    { id: 'status', label: 'Status', type: 'text', var: 'status', tip: 'ok, early (stopped before the stop time) or no_init (did not initialise).' },
  ];
  return {
    type, cat: CAT, kind: 'branch', title,
    desc: rms
      ? 'Runs an RMS (stability) simulation of the active study case with the events added before it. Each row of Record becomes a time series output.'
      : 'Runs an EMT (electromagnetic transients) simulation of the active study case with the events added before it. Each Record row is a time series. Keep EMT runs short.',
    keywords: rms
      ? ['RMS', 'simulation', 'dynamic', 'stability', 'transient stability', 'ComInc', 'ComSim', 'time domain', 'frequency', 'record', 'curves', 'm:fehz', 'run']
      : ['EMT', 'simulation', 'electromagnetic transients', 'instantaneous', 'ComInc', 'ComSim', 'time domain', 'record', 'curves', 'waveform', 'run'],
    flowOuts: [
      { id: 'ok', label: 'Reached the end' },
      { id: 'early', label: 'Stopped early', stopMsg: `${W} simulation stopped early` },
      { id: 'fail', label: 'Did not initialise', stopMsg: `${W} simulation did not initialise` },
    ],
    inputs: [numInput('tstop', 'Stop time', 'tstop', 's'), numInput('tstart', 'Start time', 'tstart', 's'), numInput('step', 'Step size', 'step', 's')],
    outputs: statics,
    settings: [
      { key: 'tstop', label: 'Stop time', kind: 'number', default: rms ? 10 : 0.5, unit: 's', min: 0, step: rms ? 1 : 0.05 },
      { key: 'tstart', label: 'Start time', kind: 'number', default: null, unit: 's', placeholder: AS_CASE, tip: 'Usually a little before 0, for example -0.1 s. Empty: as in the study case.' },
      { key: 'step', label: 'Step size', kind: 'number', default: null, unit: 's', placeholder: AS_CASE,
        tip: rms ? 'The RMS integration step (dtgrd), for example 0.01 s. Empty: as in the study case.' : 'The EMT integration step (dtemt), for example 0.00005 s (50 us). Empty: as in the study case.' },
      { key: 'net', label: 'Network', kind: 'select', default: 'case', options: [['case', AS_CASE], ['sym', 'Balanced, positive sequence (sym)'], ['rst', 'Unbalanced, 3-phase (rst)']],
        tip: 'Unbalanced faults (single-phase, two-phase) need the unbalanced network.' },
      { key: 'record', label: 'Record', kind: 'list', default: [], rowPrefix: 'r',
        addLabel: 'curve', rowLabel: 'Curve',
        columns: [
          { key: 'el', label: 'Element', kind: 'element', kinds: RECORD_CLASSES, default: { cls: 'ElmTerm', name: '', match: 'one' } },
          { key: 'var', label: 'Variable', kind: 'attr', default: 'm:fehz', attrs: 'results', study: rms ? 'dynamic_rms' : 'dynamic_emt', placeholder: 'e.g. m:fehz' },
          { key: 'combine', label: 'For several matches', kind: 'select', default: 'none', options: COMBINE },
        ],
        tip: 'Each row records one curve and becomes a time series output, for example Bus 16 with m:fehz (frequency). A name with * and a way to combine gives one curve from several elements.' },
      { key: 'caseEvents', label: 'The study case\'s own events', kind: 'select', default: 'auto',
        options: [['auto', 'Off when the workflow adds events'], ['keep', 'On'], ['off', 'Off']], tip: 'The case\'s own events are put back as they were after the run.' },
      { key: 'fast', label: 'Faster solver settings', kind: 'bool', default: false, more: true, tip: 'Fast solution and fast output: quicker, and can move a frequency nadir by about 1 mHz.' },
      { key: 'extendTo', label: 'Extend to', kind: 'number', default: 0, unit: 's', more: true,
        tip: 'When a recorded bus frequency is still at its lowest at the stop time (and above the under-frequency level), the same run goes on to this time. 0: off.' },
      { key: 'ufls', label: 'Under-frequency level', kind: 'number', default: null, unit: 'Hz', more: true, placeholder: 'Nominal minus 1 Hz', showIf: (s) => Number(s.extendTo) > 0 },
    ],
    ports(s) {
      return {
        outputs: [...statics, ...recordRows(s).map(r => ({
          id: r.id, label: seriesPortLabel(rowEl(r).name, r.var, r.combine), type: 'series', unit: unitOf(r.var),
          var: `${rowEl(r).name || 'record'} ${(VARIABLES[String(r.var || '').trim()] || [r.var])[0]}`,
        }))],
      };
    },
    summary(s) {
      const n = recordRows(s).length;
      return `To ${s.tstop} s` + (s.net !== 'case' ? `, ${s.net}` : '') + (n ? `, recording ${n} curve${n === 1 ? '' : 's'}` : '');
    },
    helpers: [rms ? 'run_rms' : 'run_emt'],
    effects: { writes: ['results'], reads: [] },
    emit(cx) {
      const st = noteCalc(cx, type);
      noteFor(cx).faults = st.faults.slice();
      st.faults = [];
      cx.helper(rms ? 'run_rms' : 'run_emt', 'pf_find');
      const s = cx.s;
      const lines = [];
      const mons = [], lists = [];
      const rows = recordRows(s);
      const vars = rows.map(row => {
        const el = rowEl(row);
        if (!el.name || !String(row.var || '').trim()) return null;
        const many = rowMany(row);
        const v = cx.name(`rec ${el.name}`);
        lines.push(`${v} = pf_find(app, ${cx.lit(queryOf(row))}, ${cx.lit(many ? 'all' : el.match)})`);
        cx.check(cx.lit(queryOf(row)), many ? 'all' : el.match);
        (many ? lists : mons).push(`(${v}, ${cx.lit(String(row.var).trim())})`);
        return v;
      });
      for (const m of cx.monitors()) {
        if (m.each !== undefined) lists.push(`(${m.each}, ${m.var})`);
        else mons.push(`(${m.obj}, ${m.var})`);
      }
      const r = cx.out('result');
      // In For each contingency with switch events, the base case pass adds no event, so "auto"
      // would leave the case's own events on for that pass only: off for every pass instead.
      let caseEv = cx.val('caseEvents');
      if (!pinned(cx, 'caseEvents') && s.caseEvents === 'auto' && inLoopWith('contEvents')) {
        caseEv = cx.lit('off');
        lines.push(cx.comment('The study case\'s own events stay off in every pass, the base case too (the contingencies are events).'));
      }
      const args = [cx.in('tstop'), cx.in('tstart'), cx.in('step'), `monitors=[${mons.join(', ')}]`, `monitor_lists=[${lists.join(', ')}]`,
        `net=${cx.val('net')}`, `case_events=${caseEv}`, `fast=${cx.val('fast')}`, `extend_to=${cx.val('extendTo')}`];
      if (pinned(cx, 'ufls') || (s.ufls !== null && s.ufls !== undefined)) args.push(`ufls_hz=${cx.val('ufls')}`);
      else if (pinned(cx, 'extendTo') || Number(s.extendTo) > 0) {
        // No level of its own: take the one of a Frequency nadir this run feeds (directly or through
        // Time series and Remove spikes), so "still above the UFLS level" means the same here and
        // in the nadir.
        const nadirs = [], seen = new Set(), todo = [undefined];
        while (todo.length) {
          for (const c of cx.consumers('', todo.shift())) {
            if (seen.has(c.id)) continue;
            seen.add(c.id);
            if (c.type === 'sig.nadir') nadirs.push(c.id);
            else if (c.type === 'sig.despike' || c.type === 'sig.series') todo.push(c.id);
          }
        }
        if (nadirs.length) args.push(`ufls_below=${cx.valOf(nadirs.sort()[0], 'uflsBelow')}`);
      }
      lines.push(`${r} = ${rms ? 'run_rms' : 'run_emt'}(app, ${args.join(', ')})`);
      rows.forEach((row, k) => {
        if (!cx.used(row.id)) return;
        // A row whose element or variable is not filled in yet is a to-do (validate); what it
        // feeds gets None meanwhile, so the to-do is not also reported as a missing output.
        if (!vars[k]) { cx.out(row.id, 'None'); return; }
        const many = rowMany(row);
        const label = cx.lit(seriesLabel(rowEl(row).name, row.var, row.combine));
        const sv = cx.out(row.id);
        lines.push(many
          ? `${sv} = ${r}.series_combined(${vars[k]}, ${cx.lit(String(row.var).trim())}, ${cx.lit(row.combine && row.combine !== 'none' ? row.combine : 'mean')}, ${label})`
          : `${sv} = ${r}.series(${vars[k]}, ${cx.lit(String(row.var).trim())}, ${label})`);
      });
      cx.out('t_end', `${r}.t_end`);
      cx.out('status', `${r}.status`);
      return {
        lines,
        branches: [{ out: 'ok', test: `${r}.status == "ok"` }, { out: 'early', test: `${r}.status == "early"` }],
        elseOut: 'fail',
      };
    },
    validate(cx) {
      const n = notesOf(cx);
      if (n && n.faults && n.faults.length && cx.s.net !== 'rst') {
        const f = n.faults[0];
        cx.error(`${f.label} adds a ${FAULT_WORDS[f.fault] || f.fault} fault, but ${cx.label} ${cx.s.net === 'sym' ? 'uses a balanced network' : 'uses the network of the study case, which may be balanced'}, ` +
          `where PowerFactory applies it as a three-phase fault. Set Network on ${cx.label} to Unbalanced, 3-phase (rst).`);
      }
      recordRows(cx.s).forEach((row, k) => {
        const el = rowEl(row);
        if (!el.name) cx.todo(`Fill in the element of Record curve ${k + 1} on ${cx.label}.`);
        if (!String(row.var || '').trim()) cx.todo(`Fill in the variable of Record curve ${k + 1} on ${cx.label} (for example m:fehz).`);
        if (el.match === 'all' && (!row.combine || row.combine === 'none')) {
          cx.error(`Record curve ${k + 1} on ${cx.label} takes every element named ${el.name} but records one curve. Choose how to combine them (average, sum, lowest, highest or spread), or choose one element.`);
        }
      });
      if (!rms && Number(cx.s.tstop) > 5 && !cx.has('tstop')) cx.warn(`${cx.label} runs ${cx.s.tstop} s of EMT simulation, which can take many minutes. Most EMT studies need well under a second.`);
    },
  };
}
defineBlock(simBlock('rms'));
defineBlock(simBlock('emt'));

defineBlock({
  type: 'sig.series', cat: CAT, kind: 'pure',
  title: 'Read time series from a result',
  desc: 'Reads one curve (element and variable) from a simulation result, for curves the Record list of the run block does not have. Recorded during the run automatically.',
  keywords: ['time series', 'curve', 'result', 'ElmRes', 'read', 'variable', 'signal', 'm:fehz', 'frequency', 'voltage', 'advanced', 'monitor'],
  inputs: [
    { id: 'res', label: 'Result', type: 'res', required: true, tip: 'The Result output of Run RMS simulation or Run EMT simulation.' },
    objInput('element', 'Element', 'el', null, 'One element, or several with a way to combine them.'),
  ],
  outputs: [{ id: 'series', label: 'Time series', type: 'series', var: 'series' }],
  settings: [
    elementSetting('el', 'Element', 'ElmTerm'),
    { key: 'var', label: 'Variable', kind: 'attr', default: 'm:fehz', required: true, placeholder: 'e.g. m:fehz', tip: 'm:fehz frequency (Hz), m:u voltage (p.u.), s:speed speed (p.u.), c:firel rotor angle ...' },
    { key: 'combine', label: 'For several elements', kind: 'select', default: 'none', options: COMBINE },
    { key: 'label', label: 'Curve name', kind: 'text', default: '', more: true, placeholder: 'Element and variable' },
  ],
  ports(s) {
    const name = s.el && s.el.name ? s.el.name : 'Element';
    return { outputs: [{ id: 'series', label: seriesPortLabel(name, s.var, s.combine), type: 'series', unit: unitOf(s.var), var: 'series' }] };
  },
  summary(s) { return `${s.var} of ${elemText(s.el)}`; },
  monitors() { return [{ element: 'element', variable: 'var' }]; },
  emit(cx) {
    routeAt(cx);
    const lab = String(cx.s.label || '').trim() || pinned(cx, 'label') ? `${cx.val('label')} or None` : 'None';
    const res = cx.in('res'), el = cx.in('element'), v = cx.val('var');
    if (pinned(cx, 'combine')) {
      return `(${res}.series(${el}, ${v}, ${lab}) if ${cx.val('combine')} in ("", "none") else ${res}.series_combined(${el}, ${v}, ${cx.val('combine')}, ${lab}))`;
    }
    const many = cx.s.combine && cx.s.combine !== 'none';
    return many ? `${res}.series_combined(${el}, ${v}, ${cx.val('combine')}, ${lab})` : `${res}.series(${el}, ${v}, ${lab})`;
  },
  validate(cx) {
    notesOf(cx);
    const many = cx.s.combine && cx.s.combine !== 'none';
    const src = cx.src('element');
    const all = src ? /^Elements/.test(String((src.port && src.port.label) || '')) : (cx.s.el && cx.s.el.match === 'all');
    if (all && !many) cx.warn(`${cx.label} gets several elements but gives one curve, so it uses the first. Choose how to combine them (average, sum, lowest, highest or spread).`);
  },
});

// ---------------------------------------------------------------------------------------------
// Simulation events: each block makes or updates ONE event PFB_<node id>_<role> (E2).

const tInput = () => numInput('t', 'Time', 't', 's', 'When it happens, in seconds of simulation time.');
const tSetting = { key: 't', label: 'Time', kind: 'number', default: 1, unit: 's', step: 0.1 };
const EVENT_FX = { writes: ['model'], reads: [] };
const keyOf = (cx) => cx.lit(cx.id);
const tOut = { id: 't', label: 'Time', type: 'num', unit: 's', var: 'event_time', tip: 'The event time, for the checks after the run.' };

defineBlock({
  type: 'pf.evt.shc', cat: CAT, kind: 'action',
  title: 'Add short circuit',
  desc: 'Adds a short-circuit event on a busbar or line for the next simulation, cleared after the duration (by clearing the fault, or by opening the faulted line).',
  keywords: ['short circuit', 'fault', 'event', 'EvtShc', 'three-phase fault', 'single-phase fault', 'clearing', 'fault clearing time', 'FRT', 'CCT', 'trip line'],
  inputs: [
    objInput('target', 'Fault at', 'target', ['ElmTerm', 'ElmLne']), tInput(),
    numInput('duration', 'Duration', 'duration', 's', 'How long the fault lasts; 0 keeps it to the end of the run.'),
    numInput('rf', 'Fault resistance', 'rf', 'Ohm'), numInput('xf', 'Fault reactance', 'xf', 'Ohm'),
    numInput('loc', 'Location on the line', 'loc', '%'),
  ],
  outputs: [
    { id: 't_fault', label: 'Fault time', type: 'num', unit: 's', var: 't_fault' },
    { id: 't_clear', label: 'Clearing time', type: 'num', unit: 's', var: 't_clear', tip: 'Empty when the fault is not cleared.' },
  ],
  settings: [
    elementSetting('target', 'Fault at', 'ElmTerm'),
    tSetting,
    { key: 'duration', label: 'Duration', kind: 'number', default: 0.1, unit: 's', step: 0.01, tip: 'The fault clearing time; 0 keeps the fault to the end of the run.' },
    { key: 'fault', label: 'Fault type', kind: 'select', default: '3ph', options: [['3ph', 'Three-phase'], ['2ph', 'Two-phase'], ['1ph', 'Single-phase to ground'], ['2phg', 'Two-phase to ground']],
      tip: 'Unbalanced faults need a simulation with the unbalanced network (rst).' },
    { key: 'phase1', label: 'Phase', kind: 'select', default: 'a', options: [['a', 'a'], ['b', 'b'], ['c', 'c']], showIf: (s) => s.fault === '1ph' },
    { key: 'phase2', label: 'Phases', kind: 'select', default: 'ab', options: [['ab', 'a-b'], ['bc', 'b-c'], ['ca', 'c-a']], showIf: (s) => s.fault === '2ph' || s.fault === '2phg' },
    { key: 'clear', label: 'Cleared by', kind: 'select', default: 'fault', options: [['fault', 'Clearing the fault'], ['trip', 'Opening the faulted line (and clearing)']] },
    { key: 'rf', label: 'Fault resistance', kind: 'number', default: 0, unit: 'Ohm', more: true },
    { key: 'xf', label: 'Fault reactance', kind: 'number', default: 0, unit: 'Ohm', more: true },
    { key: 'loc', label: 'Location on the line', kind: 'number', default: null, unit: '%', more: true, placeholder: 'As set in PowerFactory', tip: 'Only for a line: where along it the fault is.' },
  ],
  summary(s) {
    const d = Number(s.duration) > 0 ? `, cleared after ${s.duration} s` + (s.clear === 'trip' ? ' (line opened)' : '') : ', not cleared';
    return `${FAULT_WORDS[s.fault]} at ${elemText(s.target)} at ${s.t} s${d}`;
  },
  helpers: ['add_short_circuit'],
  effects: EVENT_FX,
  emit(cx) {
    const st = routeAt(cx);
    const s = cx.s;
    if (s.fault !== '3ph') st.faults.push({ label: cx.label, fault: s.fault, id: cx.id });
    cx.helper('add_short_circuit');
    let phase;
    if (pinned(cx, 'fault') || pinned(cx, 'phase1') || pinned(cx, 'phase2')) phase = `{"1ph": ${cx.val('phase1')}, "2ph": ${cx.val('phase2')}, "2phg": ${cx.val('phase2')}}.get(${cx.val('fault')})`;
    else phase = s.fault === '1ph' ? cx.val('phase1') : s.fault === '3ph' ? 'None' : cx.val('phase2');
    const call = `add_short_circuit(app, ${keyOf(cx)}, ${cx.in('target')}, ${cx.in('t')}, ${cx.in('duration')}, ${cx.in('rf')}, ${cx.in('xf')}, ${cx.in('loc')}, ${cx.val('clear')}, ${cx.val('fault')}, ${phase})`;
    if (!cx.used('t_fault') && !cx.used('t_clear')) return [call];
    return [`${cx.out('t_fault')}, ${cx.out('t_clear')} = ${call}`];
  },
  validate(cx) { notesOf(cx); },
});

defineBlock({
  type: 'pf.evt.switch', cat: CAT, kind: 'action',
  title: 'Add switch event',
  desc: 'Opens (or closes) a breaker, a switch or a whole element (all phases) at a time in the next simulation.',
  keywords: ['switch', 'breaker', 'open', 'close', 'event', 'EvtSwitch', 'disconnect', 'line trip', 'switching'],
  inputs: [objInput('element', 'Element', 'el', ['ElmCoup', 'StaSwitch', 'ElmLne', 'ElmTr2', 'ElmTr3', 'ElmSym', 'ElmGenstat', 'ElmLod']), tInput()],
  outputs: [tOut],
  settings: [
    elementSetting('el', 'Element', 'ElmCoup'),
    tSetting,
    { key: 'action', label: 'Do', kind: 'select', default: 'open', options: [['open', 'Open'], ['close', 'Close']] },
  ],
  summary(s) { return `${s.action === 'close' ? 'Close' : 'Open'} ${elemText(s.el)} at ${s.t} s`; },
  helpers: ['add_switch_event'],
  effects: EVENT_FX,
  emit(cx) {
    routeAt(cx);
    cx.helper('add_switch_event');
    const call = `add_switch_event(app, ${keyOf(cx)}, ${cx.in('element')}, ${cx.in('t')}, ${cx.val('action')})`;
    return cx.used('t') ? [`${cx.out('t')} = ${call}`] : [call];
  },
  validate(cx) { notesOf(cx); },
});

defineBlock({
  type: 'pf.evt.trip', cat: CAT, kind: 'action',
  title: 'Add trip event',
  desc: 'Trips a generator (all its parallel machines) or opens another element at a time in the next simulation. Gives the active power tripped.',
  keywords: ['trip', 'generator trip', 'loss of generation', 'outage', 'event', 'EvtSwitch', 'contingency', 'frequency', 'design contingency', 'unit'],
  inputs: [objInput('element', 'Generator', 'el', [...GEN_KINDS, 'ElmLod', 'ElmLne', 'ElmTr2', 'ElmXnet']), tInput()],
  outputs: [
    { id: 'mw', label: 'Power tripped', type: 'num', unit: 'MW', var: 'tripped', tip: 'From the dispatch: P per machine times the parallel machines (a load: its active power).' },
    tOut,
  ],
  settings: [elementSetting('el', 'Generator', 'ElmSym'), tSetting],
  summary(s) { return `Trip ${elemText(s.el)} at ${s.t} s (all units)`; },
  helpers: ['add_trip'],
  effects: EVENT_FX,
  emit(cx) {
    routeAt(cx);
    cx.helper('add_trip');
    const lines = [];
    let t = cx.in('t');
    if (cx.used('t')) { const tv = cx.out('t'); lines.push(`${tv} = ${t}`); t = tv; }
    const call = `add_trip(app, ${keyOf(cx)}, ${cx.in('element')}, ${t})`;
    lines.push(cx.used('mw') ? `${cx.out('mw')} = ${call}` : call);
    return lines;
  },
  validate(cx) { notesOf(cx); },
});

defineBlock({
  type: 'pf.evt.load', cat: CAT, kind: 'action',
  title: 'Add load step',
  desc: 'Steps a load\'s active and reactive power by a percentage of its value at a time in the next simulation (a load event).',
  keywords: ['load step', 'load event', 'EvtLod', 'step change', 'load increase', 'load rejection', 'dP', 'dQ', 'event'],
  inputs: [objInput('load', 'Load', 'load', ['ElmLod']), tInput(), numInput('dp', 'Active power step', 'dp', '%'), numInput('dq', 'Reactive power step', 'dq', '%')],
  outputs: [tOut],
  settings: [
    elementSetting('load', 'Load', 'ElmLod'),
    tSetting,
    { key: 'dp', label: 'Active power step', kind: 'number', default: 10, unit: '%', tip: 'Percent of the load\'s power; negative to reduce.' },
    { key: 'dq', label: 'Reactive power step', kind: 'number', default: 0, unit: '%' },
  ],
  summary(s) { return `${elemText(s.load)} ${Number(s.dp) >= 0 ? '+' : ''}${s.dp} % P at ${s.t} s`; },
  helpers: ['add_load_step'],
  effects: EVENT_FX,
  emit(cx) {
    routeAt(cx);
    cx.helper('add_load_step');
    const call = `add_load_step(app, ${keyOf(cx)}, ${cx.in('load')}, ${cx.in('t')}, ${cx.in('dp')}, ${cx.in('dq')})`;
    return cx.used('t') ? [`${cx.out('t')} = ${call}`] : [call];
  },
  validate(cx) { notesOf(cx); },
});

defineBlock({
  type: 'pf.evt.param', cat: CAT, kind: 'action',
  title: 'Add DSL parameter change',
  desc: 'Changes a parameter of a DSL model (such as a voltage or power set point) at a time in the next simulation: to a value, by adding to it, or by a factor.',
  keywords: ['parameter event', 'EvtParam', 'DSL', 'set point', 'step', 'voltage step', 'reference', 'controller', 'ElmDsl', 'event'],
  inputs: [objInput('element', 'DSL model', 'el', ['ElmDsl']), tInput(), { id: 'value', label: 'Value', type: 'num', fallback: 'value' }],
  outputs: [tOut],
  settings: [
    elementSetting('el', 'DSL model', 'ElmDsl'),
    tSetting,
    { key: 'param', label: 'Parameter', kind: 'text', default: '', required: true, placeholder: 'e.g. Vref', tip: 'The parameter name as in the DSL model\'s parameter list.' },
    { key: 'mode', label: 'Change', kind: 'select', default: 'absolute', options: [['absolute', 'Set it to the value'], ['add', 'Add the value to it'], ['times', 'Multiply it by the value']] },
    { key: 'value', label: 'Value', kind: 'number', default: 1 },
  ],
  summary(s) { return `${s.param || '?'} of ${elemText(s.el)}: ${s.mode === 'add' ? '+' : s.mode === 'times' ? 'x ' : '= '}${s.value} at ${s.t} s`; },
  helpers: ['add_param_event'],
  effects: EVENT_FX,
  emit(cx) {
    routeAt(cx);
    cx.helper('add_param_event');
    const call = `add_param_event(app, ${keyOf(cx)}, ${cx.in('element')}, ${cx.in('t')}, ${cx.val('param')}, ${cx.in('value')}, ${cx.val('mode')})`;
    return cx.used('t') ? [`${cx.out('t')} = ${call}`] : [call];
  },
  validate(cx) { notesOf(cx); },
});

// ---------------------------------------------------------------------------------------------
// Contingencies

const GROUPS = [['lines', '*.ElmLne'], ['trafos', '*.ElmTr2', '*.ElmTr3'], ['gens', '*.ElmSym'], ['xnets', '*.ElmXnet']];

defineBlock({
  // Worked out again where it is used (see pf.element in model.js for why not 'case' yet).
  type: 'pf.cont.define', cat: CAT, kind: 'pure', volatile: true,
  title: 'Contingencies',
  desc: 'Lists N-1 (or N-2) outages of the lines, transformers, generators or other elements in service, for For each contingency. Elements already out are left out.',
  keywords: ['contingency', 'contingencies', 'N-1', 'N-2', 'outage', 'security', 'define', 'lines', 'transformers', 'ElmLne', 'ElmTr2', 'set'],
  inputs: [objInput('elements', 'Also these elements', null, null, 'Optional: more elements to take out, for example from Element with all.')],
  outputs: [{ id: 'conts', label: 'Contingencies', type: 'cset', var: 'contingencies' }],
  settings: [
    { key: 'lines', label: 'Lines', kind: 'bool', default: true },
    { key: 'trafos', label: 'Transformers', kind: 'bool', default: false },
    { key: 'gens', label: 'Synchronous generators', kind: 'bool', default: false },
    { key: 'xnets', label: 'External grids', kind: 'bool', default: false },
    { key: 'query', label: 'Other elements', kind: 'text', default: '', placeholder: 'e.g. Line 1*.ElmLne, T*.ElmTr2', tip: 'Name.Class with * wildcards, separated by commas.' },
    { key: 'order', label: 'Outages at a time', kind: 'select', default: '1', options: [['1', 'One (N-1)'], ['2', 'Two (N-2, every pair)']] },
    { key: 'inService', label: 'Only elements in service', kind: 'bool', default: true, more: true, tip: 'Elements already out of service are left out (and named in the log), so nothing out is ever put in service.' },
  ],
  summary(s) {
    const what = GROUPS.filter(g => s[g[0]]).map(g => ({ lines: 'lines', trafos: 'transformers', gens: 'generators', xnets: 'external grids' })[g[0]]);
    if (String(s.query || '').trim()) what.push(String(s.query).trim());
    return `N-${s.order}: ${what.join(', ') || 'nothing chosen yet'}`;
  },
  helpers: ['contingencies'],
  emit(cx) {
    routeAt(cx);
    cx.helper('contingencies');
    const groups = [];
    for (const [key, ...qs] of GROUPS) {
      if (pinned(cx, key)) groups.push(`*(${cx.lit(qs)} if ${cx.val(key)} else [])`);
      else if (cx.s[key]) for (const q of qs) groups.push(cx.lit(q));
    }
    if (pinned(cx, 'query')) groups.push(`*[q.strip() for q in str(${cx.val('query')}).split(",") if q.strip()]`);
    else for (const q of String(cx.s.query || '').split(',').map(x => x.trim()).filter(Boolean)) groups.push(cx.lit(q));
    if (cx.has('elements')) groups.push(cx.in('elements'));
    return `define_contingencies(app, [${groups.join(', ')}], int(${cx.val('order')}), ${cx.val('inService')})`;
  },
  validate(cx) {
    notesOf(cx);
    if (!GROUPS.some(g => cx.s[g[0]]) && !String(cx.s.query || '').trim() && !cx.has('elements')) cx.todo(`Choose what ${cx.label} takes out (lines, transformers, generators or other elements).`);
  },
});

defineBlock({
  type: 'pf.cont.foreach', cat: CAT, kind: 'loop',
  title: 'For each contingency',
  desc: 'Repeats the Each pass steps for each outage: the base case first, then each contingency taken out of service (or opened by an event for a simulation). Always put back after.',
  keywords: ['for each', 'contingency', 'N-1', 'N-2', 'outage', 'loop', 'security assessment', 'trip', 'restore', 'base case', 'contingency analysis'],
  inputs: [
    { id: 'conts', label: 'Contingencies', type: 'cset', tip: 'From Contingencies. Not wired: N-1 of the elements named in the settings.' },
    numInput('t', 'Outage time', 't', 's', 'For a simulation: when the elements open.'),
  ],
  outputs: [
    { id: 'cont', label: 'Contingency', type: 'cell', scope: 'body', var: 'contingency', tip: 'The contingency of this pass (shows its name in tables and messages).' },
    { id: 'contname', label: 'Name', type: 'text', scope: 'body', var: 'contingency_name' },
    { id: 'elements', label: 'Elements out', type: 'obj', scope: 'body', var: 'elements_out' },
    { id: 'index', label: 'Pass no.', type: 'num', scope: 'body', var: 'pass_no' },
    { id: 'count', label: 'Number of passes', type: 'num', scope: 'done', var: 'passes' },
  ],
  settings: [
    nameSetting('Contingency'),
    { key: 'group', label: 'When nothing is wired: N-1 of', kind: 'text', default: '*.ElmLne', placeholder: 'e.g. *.ElmLne', tip: 'Name.Class with * wildcards; every matching element in service is one contingency.' },
    { key: 'how', label: 'Take out by', kind: 'select', default: 'outserv', noPin: true,
      options: [['outserv', 'Setting it out of service (load flow, short circuit)'], ['event', 'A switch event at the outage time (simulation)']] },
    { key: 't', label: 'Outage time', kind: 'number', default: 1, unit: 's', showIf: (s) => s.how === 'event' },
    { key: 'base', label: 'Base case first (nothing out)', kind: 'bool', default: true },
    restoreSetting, onErrorSetting,
  ],
  ports(s) {
    return {
      inputs: [
        { id: 'conts', label: 'Contingencies', type: 'cset', tip: 'From Contingencies. Not wired: N-1 of the elements named in the settings.' },
        ...(s.how === 'event' ? [numInput('t', 'Outage time', 't', 's', 'For a simulation: when the elements open.')] : []),
      ],
    };
  },
  summary(s) { return `${s.base ? 'Base case, then ' : ''}each outage` + (s.how === 'event' ? ` as events at ${s.t} s` : ''); },
  helpers: ['contingencies'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    routeAt(cx);
    cx.helper('contingencies', 'log');
    const s = cx.s;
    const conts = listName(cx, 'contingencies');
    const i = cx.out('index');
    const c = cx.out('cont');
    cx.out('contname', `${c}.name`);
    cx.out('elements', `${c}.elements`);
    const lines = [`${conts} = ${cx.has('conts') ? `list(${cx.in('conts')} or [])` : `define_contingencies(app, [${cx.val('group')}], 1, True)`}`];
    const base = cx.val('base');
    const n = `len(${conts}) + (1 if ${base} else 0)`;
    cx.out('count', n);
    let header, bodyStart = [];
    if (s.how === 'event') {
      cx.helper('add_contingency_events');
      const passes = listName(cx, 'passes');
      lines.push(`${passes} = ([Contingency("Base case", [], "")] if ${base} else []) + ${conts}`);
      header = `for ${i}, ${c} in enumerate(${passes}, 1):`;
      bodyStart = [`add_contingency_events(app, ${keyOf(cx)}, ${c}, ${cx.in('t')})`];
    } else {
      header = `for ${i}, ${c} in enumerate(each_contingency(app, ${conts}, ${base}), 1):`;
    }
    enterLoop(cx, s.restore !== 'never', { contEvents: s.how === 'event' });
    return { lines, header, iter: { i, n }, ctx: [passLabel(cx, 'Contingency'), c], bodyStart };
  },
  validate(cx) {
    notesOf(cx);
    if (!cx.has('conts') && !String(cx.s.group || '').trim()) cx.todo(`Wire Contingencies into ${cx.label}, or name the elements for its N-1 (for example *.ElmLne).`);
  },
});
