// Power system checks (DESIGN section 9, "check"): calculators that read a time series (nadir,
// settling time, RoCoF, peak, value at a time, first crossing, spikes removed) and two branches
// that turn a value into Pass / Fail.
//
// Type ids, setting keys, select option values and port ids are frozen handles (saved in every
// workflow and .py); change titles, labels, descriptions and tips freely.
//
// Every calculator here calls one helper of the analysis runtime (runtime/signals.py, documented
// in runtime/API-analysis.md) and gives its whole result (a SigResult) one variable; each output
// reads one field of it (`pick`). The helpers never raise on missing data: an empty series gives
// the NO DATA form (None values), so a pass with no curve still writes its row.
//
// Event times: every "Event time" / "From" input defaults to the first event the workflow added
// to the run (the series carries it), so the event time is typed once, on the event block (E9).
// Frequencies: the nominal frequency comes from the input, else Start's nominal frequency
// (F_NOMINAL), else the trace itself; the collapse floor and the UFLS level are stored as
// offsets below nominal (E8), so a 60 Hz project needs no other numbers.

import { defineBlock, defineFamily } from '../core/registry.js';

const CAT = 'check';

// ---------------------------------------------------------------------------------------------
// Shared pieces

const seriesIn = (label = 'Time series', tip = 'The curve to check, for example a bus frequency recorded by Run RMS simulation.') =>
  ({ id: 'series', label, type: 'series', required: true, tip });

const EVENT_TIP = 'When the event happens. Empty: the first event the workflow added to the run (wire the event block\'s Time to be sure).';
const tEventIn = (label = 'Event time') => ({ id: 't_event', label, type: 'num', unit: 's', fallback: 't_event', tip: EVENT_TIP });
const tEventSetting = (label = 'Event time') => ({ key: 't_event', label, kind: 'number', default: null, unit: 's', placeholder: 'First event of the run', tip: EVENT_TIP });

const NOMINAL_TIP = 'Empty: the nominal frequency on Start, or 50 / 60 Hz worked out from the trace.';
const nominalIn = { id: 'nominal', label: 'Nominal frequency', type: 'num', unit: 'Hz', fallback: 'nominal', tip: NOMINAL_TIP };
const nominalSetting = { key: 'nominal', label: 'Nominal frequency', kind: 'number', default: null, unit: 'Hz', more: true, placeholder: 'From Start', tip: NOMINAL_TIP };

// The variable a check's result is kept in: the reader's label, else this hint (varName).
const resultName = (hint) => () => hint;

// A number for a summary: 10 -> "10", 0.05 -> "0.05", null -> "".
const n = (v) => (v === null || v === undefined || v === '' ? '' : String(v));

// ---------------------------------------------------------------------------------------------
defineBlock({
  type: 'sig.despike', cat: CAT, kind: 'pure',
  title: 'Remove spikes',
  desc: 'Takes measurement spikes out of a frequency trace (samples far from the running median are removed), such as the jumps an EMT bus frequency shows at a fault. Use it before Frequency nadir and RoCoF.',
  keywords: ['despike', 'spikes', 'clean', 'filter', 'glitch', 'noise', 'EMT', 'm:fehz', 'frequency', 'PLL', 'outliers', 'smooth'],
  inputs: [seriesIn('Time series', 'Meant for frequency traces (Hz, or p.u. frequency or speed). Other curves work in their own unit.')],
  outputs: [
    { id: 'series', label: 'Clean curve', type: 'series', pick: '.series', var: 'clean', tip: 'The same curve with the spike samples taken out (not filled in).' },
    { id: 'n', label: 'Spikes removed', type: 'num', pick: '.n', var: 'spikes', more: true },
    { id: 'note', label: 'Note', type: 'text', pick: '.note', var: 'spike_note', more: true, tip: 'One line saying what was removed, for a graph footnote or a table column.' },
  ],
  settings: [
    { key: 'window', label: 'Median window', kind: 'number', default: 0.2, unit: 's', min: 0, step: 0.05, tip: 'Each sample is compared with the median of the samples within half this time on each side.' },
    { key: 'trigger', label: 'Spike when further than', kind: 'number', default: 0.1, unit: 'Hz', min: 0, step: 0.01, tip: 'A sample this far from the running median is a spike (in Hz for a frequency, else the curve\'s unit).' },
    { key: 'maxStep', label: 'Or a jump steeper than', kind: 'number', default: 20, unit: 'Hz/s', min: 0, more: true, tip: 'A jump this steep that lands more than the settle distance from the median is a spike too. 0: off.' },
    { key: 'settle', label: 'Settle distance', kind: 'number', default: 0.02, unit: 'Hz', min: 0, step: 0.01, more: true, tip: 'A spike grows while the samples stay this far from the median, so its tail is removed too.' },
    { key: 'signal', label: 'The curve is', kind: 'select', default: 'auto', more: true,
      options: [['auto', 'Found from its unit and name'], ['frequency', 'A frequency or speed'], ['other', 'Something else (its own unit)']],
      tip: 'A frequency is compared in Hz even when it is in p.u.; anything else in its own unit.' },
    // A curve read in its own unit has no nominal frequency to scale by.
    { ...nominalSetting, showIf: (s) => s.signal !== 'other' },
  ],
  summary(s) { return `Spikes over ${n(s.trigger)} Hz`; },
  helpers: ['despike'],
  varName: resultName('despiked'),
  emit(cx) {
    cx.helper('despike');
    return `despike(${cx.in('series')}, window=${cx.val('window')}, trigger=${cx.val('trigger')}, max_step=${cx.val('maxStep')}, ` +
      `settle=${cx.val('settle')}, nominal=${cx.val('nominal')}, signal=${cx.val('signal')})`;
  },
});

// ---------------------------------------------------------------------------------------------
defineBlock({
  type: 'sig.nadir', cat: CAT, kind: 'pure',
  title: 'Frequency nadir',
  desc: 'The lowest frequency after an event, and whether it turned around (settles) or collapsed, with the UFLS flag. Use it after a trip in an RMS run.',
  keywords: ['nadir', 'lowest frequency', 'minimum frequency', 'frequency dip', 'settles', 'turned around', 'collapse', 'UFLS', 'under-frequency',
    'load shedding', 'headroom', 'frequency', 'm:fehz', 'recovery', 'trip'],
  inputs: [
    seriesIn('Frequency', 'A bus frequency in Hz or p.u., for example Bus 16 m:fehz recorded by Run RMS simulation.'),
    tEventIn(),
    nominalIn,
    { id: 'extendTo', label: 'Run extended to', type: 'num', unit: 's', fallback: 'extendTo',
      tip: 'The run block\'s Extend to time, so a run still falling above the UFLS level at that time is `FALSE` instead of `UNDEFINED`. Empty: not extended.' },
  ],
  outputs: [
    { id: 'nadir', label: 'Nadir', type: 'num', unit: 'Hz', pick: '.value', var: 'nadir', tip: 'The lowest frequency when it turned around (verdict `NADIR`); empty for a collapse.' },
    { id: 'time', label: 'Nadir time', type: 'num', unit: 's', pick: '.time', var: 'nadir_time' },
    { id: 'turned', label: 'Turned around', type: 'bool', pick: '.turned', var: 'turned_around', more: true, tip: 'Yes when the frequency stopped falling and recovered: the "does it settle" check of a headroom study.' },
    { id: 'verdict', label: 'Verdict', type: 'text', pick: '.verdict', var: 'verdict', more: true, tip: '`NADIR`, `COLLAPSE` or `NO DATA`. Wire it into RoCoF too.' },
    { id: 'ufls', label: 'UFLS', type: 'text', pick: '.ufls', var: 'ufls', tip: '`TRUE` (below the UFLS level), `FALSE`, or `UNDEFINED` (the run ended while still falling above it).' },
    { id: 'minimum', label: 'Minimum', type: 'num', unit: 'Hz', pick: '.minimum', var: 'minimum', more: true, tip: 'The minimum the verdict rests on, also for a collapse.' },
    { id: 'min_time', label: 'Minimum time', type: 'num', unit: 's', pick: '.min_time', var: 'minimum_time', more: true },
    { id: 'still', label: 'Still falling', type: 'bool', pick: '.still_falling', var: 'still_falling', more: true, tip: 'Yes when the run ended still at its lowest.' },
    { id: 'recovery', label: 'Recovery', type: 'num', unit: 'Hz', pick: '.recovery', var: 'recovery', more: true, tip: 'How far the frequency rose after its minimum.' },
  ],
  settings: [
    tEventSetting(),
    { key: 'floorBelow', label: 'Collapse floor, below nominal', kind: 'number', default: 5, more: true, unit: 'Hz', min: 0, step: 0.5,
      tip: 'Falling this far below nominal is a collapse: 5 Hz is 45 Hz at 50 Hz and 55 Hz at 60 Hz. Empty: no floor.' },
    { key: 'uflsBelow', label: 'UFLS level, below nominal', kind: 'number', default: 1, unit: 'Hz', min: 0, step: 0.1,
      tip: 'Under-frequency load shedding starts this far below nominal: 1 Hz is 49 Hz at 50 Hz and 59 Hz at 60 Hz.' },
    { key: 'window', label: 'Search window', kind: 'number', default: 10, unit: 's', min: 0, more: true,
      tip: 'The nadir is looked for this long after the event (a later, deeper dip still counts). 0: to the end of the run.' },
    { key: 'minRecovery', label: 'Turned around after rising', kind: 'number', default: 0.05, unit: 'Hz', min: 0, step: 0.01, more: true,
      tip: 'The frequency must rise at least this much after its minimum to count as turned around.' },
    { key: 'tailGuard', label: 'Still falling if lowest within', kind: 'number', default: 1, unit: 's', min: 0, more: true,
      tip: 'A minimum this close to the end of the run counts as still falling (a collapse).' },
    { key: 'delay', label: 'Start looking after the event', kind: 'number', default: 0, unit: 's', min: 0, more: true },
    { key: 'requiresUfls', label: 'A shallow dip above UFLS is a nadir', kind: 'bool', default: true, more: true,
      tip: 'On: a dip that barely recovers but stays above the UFLS level counts as a nadir, not a collapse. Off: it counts as a collapse.' },
    nominalSetting,
    { key: 'extendTo', label: 'Run extended to', kind: 'number', default: null, unit: 's', more: true, placeholder: 'Not extended',
      tip: 'Type the Extend to time of the run block here (or wire it). Empty: the run was not extended.' },
  ],
  summary(s) { return `UFLS ${n(s.uflsBelow)} Hz below nominal`; },
  helpers: ['nadir'],
  varName: resultName('nadir result'),
  emit(cx) {
    cx.helper('nadir');
    return `nadir(${cx.in('series')}, t_event=${cx.in('t_event')}, nominal=${cx.in('nominal')}, delay=${cx.val('delay')}, ` +
      `window=${cx.val('window')}, min_recovery=${cx.val('minRecovery')}, tail_guard=${cx.val('tailGuard')}, ` +
      `floor_below=${cx.val('floorBelow')}, ufls_below=${cx.val('uflsBelow')}, requires_ufls=${cx.val('requiresUfls')}, ` +
      `extend_to=${cx.in('extendTo')})`;
  },
  validate(cx) {
    const f = Number(cx.s.floorBelow), u = Number(cx.s.uflsBelow);
    if (cx.s.floorBelow !== null && cx.s.uflsBelow !== null && Number.isFinite(f) && Number.isFinite(u) && f <= u) {
      cx.warn(`${cx.label}: the collapse floor (${f} Hz below nominal) is not below the UFLS level (${u} Hz below nominal). Make the floor the larger number.`);
    }
  },
});

// ---------------------------------------------------------------------------------------------
const PEAK = [['max', 'Highest value'], ['min', 'Lowest value'], ['abs', 'Furthest from zero']];

defineBlock({
  type: 'sig.peak', cat: CAT, kind: 'pure',
  title: 'Peak',
  desc: 'The highest (or lowest, or furthest from zero) value of a curve and when it happens, over the whole run or a time range.',
  keywords: ['peak', 'maximum', 'minimum', 'highest', 'lowest', 'overshoot', 'max', 'min', 'worst', 'first swing', 'curve'],
  inputs: [
    seriesIn(),
    { id: 'after', label: 'From', type: 'num', unit: 's', fallback: 'after', tip: 'Only look from this time on. Empty: from the start of the run.' },
    { id: 'before', label: 'Until', type: 'num', unit: 's', fallback: 'before', tip: 'Only look up to this time. Empty: to the end of the run.' },
  ],
  outputs: [
    { id: 'value', label: 'Peak', type: 'num', pick: '.value', var: 'peak' },
    { id: 'time', label: 'Peak time', type: 'num', unit: 's', pick: '.time', var: 'peak_time' },
  ],
  settings: [
    { key: 'kind', label: 'Look for', kind: 'select', default: 'max', options: PEAK },
    { key: 'after', label: 'From', kind: 'number', default: null, unit: 's', placeholder: 'Start of the run' },
    { key: 'before', label: 'Until', kind: 'number', default: null, unit: 's', placeholder: 'End of the run' },
  ],
  summary(s) { return (PEAK.find(p => p[0] === s.kind) || PEAK[0])[1]; },
  helpers: ['peak'],
  varName: resultName('peak result'),
  emit(cx) {
    cx.helper('peak');
    return `peak(${cx.in('series')}, kind=${cx.val('kind')}, after=${cx.in('after')}, before=${cx.in('before')})`;
  },
});

// ---------------------------------------------------------------------------------------------
defineBlock({
  type: 'sig.settle', cat: CAT, kind: 'pure',
  title: 'Settling time',
  desc: 'How long a curve takes to settle inside a band around its final value after an event, with rise time and overshoot. A curve still moving at the end does not settle.',
  keywords: ['settling time', 'settles', 'settled', 'band', 'step response', 'rise time', 'overshoot', 'steady state', 'voltage step', 'damping', 'final value'],
  inputs: [
    seriesIn(),
    tEventIn(),
    { id: 'band', label: 'Band', type: 'num', fallback: 'band', tip: 'Half the width of the band: in % of the step, or in the curve\'s unit (see Band is).' },
    { id: 'target', label: 'Final value', type: 'num', fallback: 'target', tip: 'Only for Settle around "a value I give".' },
  ],
  ports(s) {
    // Settling around the curve's own final value: there is no value to give.
    if (s.reference === 'given') return {};
    return { inputs: [seriesIn(), tEventIn(), { id: 'band', label: 'Band', type: 'num', fallback: 'band', tip: 'Half the width of the band: in % of the step, or in the unit of the curve (see Band is).' }] };
  },
  outputs: [
    { id: 'settles', label: 'Settles', type: 'bool', pick: '.settles', var: 'settles', tip: 'Yes when it is inside the band for good before the end of the run.' },
    { id: 'time', label: 'Settling time', type: 'num', unit: 's', pick: '.time', var: 'settling_time', tip: 'From the event to the moment it stays inside the band.' },
    { id: 'at', label: 'Settled at', type: 'num', unit: 's', pick: '.at', var: 'settled_at', more: true, tip: 'The simulation time it stays inside the band from.' },
    { id: 'initial', label: 'Initial value', type: 'num', pick: '.initial', var: 'initial', more: true, tip: 'The value just before the event.' },
    { id: 'final', label: 'Final value', type: 'num', pick: '.final', var: 'final', more: true },
    { id: 'rise', label: 'Rise time', type: 'num', unit: 's', pick: '.rise_time', var: 'rise_time', more: true, tip: 'From 10 % to 90 % of the step.' },
    { id: 'overshoot', label: 'Overshoot', type: 'num', unit: '%', pick: '.overshoot_pct', var: 'overshoot_pct', more: true, tip: 'How far it went past the final value, in % of the step.' },
  ],
  settings: [
    tEventSetting(),
    { key: 'bandMode', label: 'Band is', kind: 'select', default: 'pct', options: [['pct', '% of the step'], ['abs', 'In the curve\'s unit']] },
    { key: 'band', label: 'Band', kind: 'number', default: 10, min: 0, tip: 'Half the width of the band around the final value, e.g. 10 (% of the step) or 0.01 (Hz).' },
    { key: 'hold', label: 'Final value from the last', kind: 'number', default: 1, more: true, unit: 's', min: 0, showIf: (s) => s.reference !== 'given',
      tip: 'The final value is the average of the last part of the run.' },
    { key: 'reference', label: 'Settle around', kind: 'select', default: 'final', options: [['final', 'Its final value'], ['given', 'A value I give']] },
    { key: 'target', label: 'Final value', kind: 'number', default: null, showIf: (s) => s.reference === 'given' },
    { key: 'guard', label: 'Not settled if outside in the last', kind: 'number', default: 1, unit: 's', min: 0, more: true,
      tip: 'Outside the band this close to the end of the run means it is still moving, so it does not settle.' },
  ],
  summary(s) { return s.bandMode === 'abs' ? `Band ${n(s.band)}` : `Band ${n(s.band)} % of the step`; },
  helpers: ['settling'],
  varName: resultName('settling'),
  emit(cx) {
    cx.helper('settling');
    return `settling(${cx.in('series')}, band=${cx.in('band')}, band_mode=${cx.val('bandMode')}, hold=${cx.val('hold')}, ` +
      `reference=${cx.val('reference')}, target=${cx.in('target')}, t_event=${cx.in('t_event')}, guard=${cx.val('guard')})`;
  },
  validate(cx) {
    if (cx.s.reference === 'given' && !cx.has('target') && (cx.s.target === null || cx.s.target === undefined)) {
      cx.todo(`Give the final value ${cx.label} should settle around, or set Settle around to its final value.`);
    }
  },
});

// ---------------------------------------------------------------------------------------------
// The whole nadir result carries both its verdict and its time, so a Verdict wired straight
// from Frequency nadir is passed as that result (API-analysis.md, notes for block authors).
function wholeResult(cx, id, pick) {
  const ex = cx.in(id);
  const src = cx.src(id);
  if (src && src.port && src.port.pick === pick && ex.endsWith(pick) && ex.length > pick.length) return ex.slice(0, -pick.length);
  return ex;
}

defineBlock({
  type: 'sig.rocof', cat: CAT, kind: 'pure',
  title: 'RoCoF',
  desc: 'Rate of change of frequency (Hz/s): the steepest change over a rolling window from the event to the nadir. Wire Nadir time and Verdict from Frequency nadir.',
  keywords: ['RoCoF', 'rate of change of frequency', 'df/dt', 'frequency gradient', 'rolling window', 'inertia', 'frequency', 'm:fehz', 'AEMO'],
  inputs: [
    seriesIn('Frequency', 'A bus frequency in Hz or p.u.'),
    tEventIn(),
    { id: 'nadir_t', label: 'Nadir time', type: 'num', unit: 's', tip: 'From Frequency nadir: the search ends there. Empty: worked out here.' },
    { id: 'verdict', label: 'Verdict', type: 'text', tip: 'From Frequency nadir. When it is not `NADIR` the search runs for the search window instead.' },
    nominalIn,
  ],
  outputs: [
    { id: 'rocof', label: 'RoCoF', type: 'num', unit: 'Hz/s', pick: '.value', var: 'rocof', tip: 'Signed: a falling frequency gives a negative value.' },
    { id: 'time', label: 'Window start', type: 'num', unit: 's', pick: '.time', var: 'rocof_time', more: true },
    { id: 't2', label: 'Window end', type: 'num', unit: 's', pick: '.t2', var: 'rocof_end', more: true },
    { id: 'basis', label: 'Basis', type: 'text', pick: '.basis', var: 'rocof_basis', more: true, tip: 'Where the search ended: `nadir`, `window` or `tstop`; `/short` when that was shorter than the window.' },
  ],
  settings: [
    tEventSetting(),
    { key: 'window', label: 'Window', kind: 'number', default: 0.5, unit: 's', min: 0, step: 0.1, tip: 'The rolling window the change is measured over (0.5 s in most grid codes).' },
    { key: 'fallback', label: 'When there is no nadir', kind: 'select', default: 'window', more: true,
      options: [['window', 'Search for the search window'], ['tstop', 'Search to the end of the run'], ['none', 'Give no value']] },
    { key: 'searchWindow', label: 'Search window', kind: 'number', default: 10, unit: 's', min: 0, more: true, showIf: (s) => s.fallback === 'window' },
    { key: 'absolute', label: 'Always positive', kind: 'bool', default: false, more: true },
    { key: 'decimals', label: 'Decimals', kind: 'number', default: 4, min: 0, max: 12, step: 1, more: true },
    nominalSetting,
  ],
  summary(s) { return `${n(s.window)} s window`; },
  helpers: ['rocof'],
  varName: resultName('rocof result'),
  emit(cx) {
    cx.helper('rocof');
    return `rocof(${cx.in('series')}, t_event=${cx.in('t_event')}, nadir_time=${cx.in('nadir_t')}, verdict=${wholeResult(cx, 'verdict', '.verdict')}, ` +
      `window=${cx.val('window')}, fallback=${cx.val('fallback')}, search_window=${cx.val('searchWindow')}, nominal=${cx.in('nominal')}, ` +
      `absolute=${cx.val('absolute')}, decimals=${cx.val('decimals')})`;
  },
});

// ---------------------------------------------------------------------------------------------
defineBlock({
  type: 'sig.at', cat: CAT, kind: 'pure',
  title: 'Value at time',
  desc: 'The value of a curve at a given time, read between samples. At an event instant it is the value just before the event, e.g. the power before a fault.',
  keywords: ['value at', 'at time', 'sample', 'initial value', 'pre-fault', 'before the event', 'interpolate', 'read', 'curve'],
  inputs: [seriesIn(), { id: 't', label: 'Time', type: 'num', unit: 's', fallback: 't' }],
  outputs: [{ id: 'value', label: 'Value', type: 'num', var: 'value_at_t' }],
  settings: [{ key: 't', label: 'Time', kind: 'number', default: 0, unit: 's' }],
  summary(s) { return `At ${n(s.t)} s`; },
  helpers: ['value_at'],
  emit(cx) { cx.helper('value_at'); return `value_at(${cx.in('series')}, ${cx.in('t')})`; },
});

defineBlock({
  type: 'sig.final', cat: CAT, kind: 'pure',
  title: 'Final value',
  desc: 'The value of a curve at the end of the run, or its average over the last seconds, e.g. the voltage after recovery.',
  keywords: ['final value', 'end value', 'last value', 'steady state', 'after recovery', 'end of run', 'curve'],
  inputs: [seriesIn()],
  outputs: [{ id: 'value', label: 'Final value', type: 'num', var: 'final_value' }],
  settings: [{ key: 'last', label: 'Average over the last', kind: 'number', default: 0, unit: 's', min: 0, tip: '0: the very last sample.' }],
  summary(s) { return Number(s.last) > 0 ? `Average of the last ${n(s.last)} s` : 'Last sample'; },
  helpers: ['final_value'],
  emit(cx) { cx.helper('final_value'); return `final_value(${cx.in('series')}, ${cx.val('last')})`; },
});

// ---------------------------------------------------------------------------------------------
// The level of First time above / below is a value, or a percentage of the curve's own value at
// a time (FRT: back to 90 % of the power before the fault). The time defaults to the first event
// of the run, where the value read is the one just before the event (value_at).
const LEVEL_MODES = [['value', 'A value'], ['pct', '% of the curve\'s value at a time']];
const crossPorts = (s) => [
  seriesIn(),
  ...(s.levelMode === 'pct'
    ? [{ id: 'pct', label: 'Percent', type: 'num', unit: '%', fallback: 'pct', tip: 'The level is this percentage of the curve\'s value at the time below, for example 90.' },
      { id: 'ref_t', label: 'Of the value at', type: 'num', unit: 's', fallback: 'refT', tip: 'The time of the value the percentage is taken of. Empty: the first event of the run (the value just before it).' }]
    : [{ id: 'level', label: 'Level', type: 'num', fallback: 'level', tip: 'In the curve\'s unit, for example 0.9 (p.u.).' }]),
  { id: 'after', label: 'Look from', type: 'num', unit: 's', fallback: 'after', tip: 'Start looking at this time, for example the clearing time. Empty: the first event of the run.' },
];

defineBlock({
  type: 'sig.cross', cat: CAT, kind: 'pure',
  title: 'First time above / below',
  desc: 'When a curve first goes above (or below) a level and stays there, e.g. the voltage back to 0.9 p.u., or the power back to 90 % of its value before the fault.',
  keywords: ['crossing', 'above', 'below', 'threshold', 'level', 'recovery time', 'recovers', 'FRT', 'reaches', 'delay', 'first time', 'percent', 'pre-fault', 'active power recovery'],
  inputs: crossPorts({ levelMode: 'value' }),
  outputs: [
    { id: 'time', label: 'Time', type: 'num', unit: 's', pick: '.time', var: 'cross_time' },
    { id: 'delay', label: 'Delay', type: 'num', unit: 's', pick: '.delay', var: 'delay', tip: 'Time minus Look from.' },
    { id: 'found', label: 'Found', type: 'bool', pick: '.found', var: 'found', more: true },
    { id: 'threshold', label: 'Level', type: 'num', pick: '.level', var: 'cross_level', more: true, tip: 'The level it looked for, in the curve\'s unit (with a percentage: the value it works out to), for a limit line on a graph.' },
  ],
  settings: [
    { key: 'direction', label: 'Goes', kind: 'select', default: 'above', options: [['above', 'Above the level'], ['below', 'Below the level']] },
    { key: 'levelMode', label: 'Level is', kind: 'select', default: 'value', noPin: true, options: LEVEL_MODES },
    { key: 'level', label: 'Level', kind: 'number', default: 0.9, showIf: (s) => s.levelMode !== 'pct' },
    { key: 'pct', label: 'Percent', kind: 'number', default: 90, unit: '%', min: 0, showIf: (s) => s.levelMode === 'pct' },
    { key: 'refT', label: 'Of the value at', kind: 'number', default: null, unit: 's', placeholder: 'First event of the run', showIf: (s) => s.levelMode === 'pct',
      tip: 'The time of the value the percentage is taken of. Empty: the first event of the run (the value just before it, e.g. the power before the fault).' },
    { key: 'after', label: 'Look from', kind: 'number', default: null, unit: 's', placeholder: 'First event of the run' },
    { key: 'hold', label: 'And stays there for', kind: 'number', default: 0, more: true, unit: 's', min: 0, tip: '0: the first touch counts.' },
  ],
  ports(s) { return { inputs: crossPorts(s) }; },
  summary(s) {
    const lv = s.levelMode === 'pct' ? `${n(s.pct)} % of its value ${s.refT === null || s.refT === undefined ? 'before the first event' : `at ${n(s.refT)} s`}` : n(s.level);
    return `${s.direction === 'below' ? 'Below' : 'Above'} ${lv}`;
  },
  helpers: ['first_cross'],
  varName: resultName('crossing'),
  emit(cx) {
    cx.helper('first_cross');
    const level = cx.s.levelMode === 'pct' ? 'None' : cx.in('level');
    const pct = cx.s.levelMode === 'pct' ? `, pct=${cx.in('pct')}, ref_t=${cx.in('ref_t')}` : '';
    return `first_cross(${cx.in('series')}, ${level}, direction=${cx.val('direction')}, after=${cx.in('after')}, hold=${cx.val('hold')}${pct})`;
  },
  validate(cx) {
    if (cx.s.levelMode === 'pct' && !cx.has('pct') && (cx.s.pct === null || cx.s.pct === undefined)) cx.todo(`Give the percentage on ${cx.label}.`);
  },
});

defineFamily({
  id: 'curve', title: 'Read from a curve',
  desc: 'One value of a curve: its peak, its value at a time, its final value, or when it first goes above or below a level. Choose which under Kind.',
  keywords: ['curve', 'time series', 'peak', 'value at time', 'final value', 'first time above', 'crossing', 'recovery', 'read'],
  members: ['sig.peak', 'sig.at', 'sig.final', 'sig.cross'], dflt: 'sig.peak',
});

// ---------------------------------------------------------------------------------------------
// Pass / Fail branches. Pass only when the check says True; False and NO DATA (None) take Fail,
// and NO DATA is logged so a missing curve never reads as a quiet failure (E7).

const passFailOuts = (name) => [
  { id: 'pass', label: 'Pass' },
  { id: 'fail', label: 'Fail', stopMsg: `${name} did not pass` },
];
// "Go on either way": one plain output on the Pass port's id, so a wire saved on Pass keeps
// working, and the block is written as a plain step (no early exit for a failed check).
const goOnOuts = [{ id: 'pass', label: '' }];
const goOnSetting = { key: 'goOn', label: 'Go on either way', kind: 'bool', default: false, noPin: true,
  tip: 'Pass or fail, the next step is the same: for a result that only goes into a table row. Off: Fail takes its own route, and an unwired Fail ends the pass.' };
const nameOf = (node, title) => (node && typeof node.label === 'string' && node.label.trim()) || title;

function branchLines(cx, r, call) {
  const then = cx.s.goOn ? '), so it did not pass.' : '), so it takes Fail.';
  return [
    `${r} = ${call}`,
    `if ${r}.ok is None:`,
    `    log(${cx.lit(cx.label + ': NO DATA (')} + str(${r}.get("reason") or "nothing to check") + ${cx.lit(then)}, "warn")`,
  ];
}
// The routes a check gives the generator: Pass when it passed, else Fail; one plain route when
// it goes on either way.
const checkRoutes = (cx, r) => (cx.s.goOn ? { branches: [], elseOut: 'pass' } : { branches: [{ out: 'pass', test: `${r}.ok is True` }], elseOut: 'fail' });

const LIMIT_TITLE = 'Check limits';
const curveRows = (s) => (Array.isArray(s.curve) ? s.curve : []);
const numOrNone = (v) => { if (v === '' || v === null || v === undefined) return null; const x = Number(String(v).replace(',', '.')); return Number.isFinite(x) ? x : null; };

defineBlock({
  type: 'chk.limit', cat: CAT, kind: 'branch',
  title: LIMIT_TITLE,
  desc: 'Checks a value, a list or a whole curve against a lowest and highest limit, or against a curve such as an FRT envelope, and goes on along Pass or Fail.',
  keywords: ['limit', 'limits', 'check', 'pass', 'fail', 'within', 'range', 'envelope', 'FRT', 'LVRT', 'grid code', 'compliance', 'curve', 'margin', 'voltage limits'],
  flowOuts: passFailOuts(LIMIT_TITLE),
  inputs: [
    { id: 'x', label: 'Value', type: 'list', required: true, tip: 'A number, a list of numbers or a time series.' },
    { id: 'lo', label: 'Lowest allowed', type: 'num', fallback: 'lo' },
    { id: 'hi', label: 'Highest allowed', type: 'num', fallback: 'hi' },
  ],
  outputs: [
    { id: 'ok', label: 'Passed', type: 'bool', var: 'within_limits', more: true, tip: 'Empty when there was nothing to check (`NO DATA`).' },
    { id: 'text', label: 'Result', type: 'text', var: 'limit_result', tip: '`PASS`, `FAIL` or `NO DATA`.' },
    { id: 'margin', label: 'Margin', type: 'num', var: 'margin', tip: 'The smallest distance inside the limits; negative when a limit is broken.' },
    { id: 'at', label: 'Worst at', type: 'num', var: 'worst_at', more: true, tip: 'The time (for a curve) or the position of the worst point.' },
    { id: 'worst', label: 'Worst value', type: 'num', var: 'worst_value', more: true },
  ],
  settings: [
    { key: 'against', label: 'Check against', kind: 'select', default: 'value', noPin: true,
      options: [['value', 'A lowest and a highest value'], ['curve', 'A curve of limits (x, low, high)']] },
    { key: 'lo', label: 'Lowest allowed', kind: 'number', default: null, placeholder: 'No lower limit', showIf: (s) => s.against !== 'curve' },
    { key: 'hi', label: 'Highest allowed', kind: 'number', default: null, placeholder: 'No upper limit', showIf: (s) => s.against !== 'curve' },
    { key: 'curve', label: 'Limit curve', kind: 'list', rowPrefix: 'k', rowLabel: 'Point', addLabel: 'point', showIf: (s) => s.against === 'curve',
      default: [{ id: 'k1', x: 0, low: 0, high: '' }, { id: 'k2', x: 0.15, low: 0, high: '' }, { id: 'k3', x: 0.15, low: 0.7, high: '' }, { id: 'k4', x: 1.5, low: 0.9, high: '' }],
      columns: [
        { key: 'x', label: 'x (time from Curve starts at)', kind: 'number', default: 0 },
        { key: 'low', label: 'Lowest', kind: 'number', default: '' },
        { key: 'high', label: 'Highest', kind: 'number', default: '' },
      ],
      tip: 'Points of the limit curve, joined by straight lines. Two points at the same x make a step. Leave Lowest or Highest empty for no limit there.' },
    { key: 'x0', label: 'Curve starts at', kind: 'number', default: 0, unit: 's', showIf: (s) => s.against === 'curve',
      tip: 'The time x = 0 of the curve, for example the fault clearing time (wire it from the fault block).' },
    { key: 'extend', label: 'Hold the last point after the curve ends', kind: 'bool', default: false, more: true, showIf: (s) => s.against === 'curve' },
    { key: 'after', label: 'Only a curve from', kind: 'number', default: null, unit: 's', more: true, placeholder: 'Start of the run' },
    { key: 'before', label: 'Only a curve until', kind: 'number', default: null, unit: 's', more: true, placeholder: 'End of the run' },
    goOnSetting,
  ],
  ports(s, node) {
    const name = nameOf(node, LIMIT_TITLE);
    const x = { id: 'x', label: 'Value', type: 'list', required: true, tip: 'A number, a list of numbers or a time series.' };
    const inputs = s.against === 'curve'
      ? [x, { id: 'x0', label: 'Curve starts at', type: 'num', unit: 's', fallback: 'x0' }, { id: 'xs', label: 'x of each value', type: 'list', tip: 'Only for a list of values: where each one sits on the curve.' }]
      : [x, { id: 'lo', label: 'Lowest allowed', type: 'num', fallback: 'lo' }, { id: 'hi', label: 'Highest allowed', type: 'num', fallback: 'hi' }];
    return { inputs, flowOuts: s.goOn ? goOnOuts : passFailOuts(name) };
  },
  summary(s) {
    const either = s.goOn ? ', goes on either way' : '';
    if (s.against === 'curve') return `Against a curve of ${curveRows(s).length} points${either}`;
    const lo = n(s.lo), hi = n(s.hi);
    if (lo && hi) return `Between ${lo} and ${hi}${either}`;
    if (lo) return `At least ${lo}${either}`;
    if (hi) return `At most ${hi}${either}`;
    return 'No limits yet';
  },
  helpers: ['check_limits', 'log'],
  emit(cx) {
    cx.helper('check_limits', 'log');
    const r = cx.name(String(cx.node.label || '').trim() ? cx.label + ' result' : 'limit check');
    for (const o of ['ok', 'text', 'margin', 'at', 'worst']) cx.out(o, `${r}.${o}`);
    let call;
    if (cx.s.against === 'curve') {
      const rows = curveRows(cx.s).map(k => [numOrNone(k.x), numOrNone(k.low), numOrNone(k.high)]).filter(k => k[0] !== null);
      call = `check_limits(${cx.in('x')}, curve=${cx.lit(rows)}, x0=${cx.in('x0')}, xs=${cx.in('xs')}, after=${cx.val('after')}, before=${cx.val('before')}, extend=${cx.val('extend')})`;
    } else {
      call = `check_limits(${cx.in('x')}, lo=${cx.in('lo')}, hi=${cx.in('hi')}, after=${cx.val('after')}, before=${cx.val('before')})`;
    }
    return { lines: branchLines(cx, r, call), ...checkRoutes(cx, r) };
  },
  validate(cx) {
    if (cx.s.against === 'curve') {
      const rows = curveRows(cx.s).filter(k => numOrNone(k.x) !== null);
      if (rows.length < 2) cx.todo(`Give ${cx.label} at least two points of the limit curve.`);
      else if (!rows.some(k => numOrNone(k.low) !== null || numOrNone(k.high) !== null)) cx.todo(`Give ${cx.label} a lowest or highest value on its curve.`);
    } else if (!cx.has('lo') && !cx.has('hi') && cx.s.lo === null && cx.s.hi === null) {
      cx.todo(`Give ${cx.label} a lowest or a highest allowed value.`);
    } else if (!cx.has('lo') && !cx.has('hi') && cx.s.lo !== null && cx.s.hi !== null && Number(cx.s.lo) > Number(cx.s.hi)) {
      cx.error(`${cx.label}: the lowest allowed value (${cx.s.lo}) is above the highest (${cx.s.hi}). Swap them.`);
    }
  },
});

// ---------------------------------------------------------------------------------------------
const VERDICT_TITLE = 'Pass / fail';
const VOPS = [['ge', '≥'], ['gt', '>'], ['le', '≤'], ['lt', '<'], ['eq', '='], ['ne', '≠'], ['true', 'is true'], ['false', 'is false']];
const vopText = (op) => (VOPS.find(o => o[0] === op) || VOPS[0])[1];
const noLimit = (op) => op === 'true' || op === 'false';

defineBlock({
  type: 'chk.verdict', cat: CAT, kind: 'branch',
  title: VERDICT_TITLE,
  desc: 'Checks one value against a limit (for example nadir ≥ 49.2 Hz, or UFLS is false) and goes on along Pass or Fail. An empty value takes Fail and says NO DATA.',
  keywords: ['pass', 'fail', 'verdict', 'check', 'criterion', 'compliance', 'limit', 'compare', 'PASS FAIL', 'requirement', 'UFLS'],
  flowOuts: passFailOuts(VERDICT_TITLE),
  inputs: [
    { id: 'value', label: 'Value', type: 'any', required: true, tip: 'A number (or every value of a list or curve), or a yes / no or `TRUE` / `FALSE` for "is true" and "is false".' },
    { id: 'limit', label: 'Limit', type: 'num', fallback: 'limit' },
  ],
  outputs: [
    { id: 'ok', label: 'Passed', type: 'bool', var: 'passed', more: true, tip: 'Empty when there was no value (`NO DATA`).' },
    { id: 'text', label: 'Result', type: 'text', var: 'result_text', tip: '`PASS`, `FAIL` or `NO DATA`.' },
    { id: 'margin', label: 'Margin', type: 'num', var: 'margin', more: true, tip: 'How far inside the limit the value is; negative when it fails.' },
  ],
  settings: [
    { key: 'op', label: 'Pass when the value', kind: 'select', default: 'ge', options: VOPS },
    { key: 'limit', label: 'Limit', kind: 'number', default: 0, showIf: (s) => !noLimit(s.op) },
    { key: 'tol', label: 'Tolerance for = and ≠', kind: 'number', default: 0, more: true, showIf: (s) => s.op === 'eq' || s.op === 'ne' },
    goOnSetting,
  ],
  ports(s, node) {
    const name = nameOf(node, VERDICT_TITLE);
    const value = { id: 'value', label: 'Value', type: 'any', required: true, tip: 'A number (or every value of a list or curve), or a yes / no or `TRUE` / `FALSE` for "is true" and "is false".' };
    return { inputs: noLimit(s.op) ? [value] : [value, { id: 'limit', label: 'Limit', type: 'num', fallback: 'limit' }], flowOuts: s.goOn ? goOnOuts : passFailOuts(name) };
  },
  summary(s) { return (noLimit(s.op) ? `Value ${vopText(s.op)}` : `Value ${vopText(s.op)} ${n(s.limit)}`) + (s.goOn ? ', goes on either way' : ''); },
  helpers: ['verdict', 'log'],
  emit(cx) {
    cx.helper('verdict', 'log');
    const r = cx.name(String(cx.node.label || '').trim() ? cx.label + ' result' : 'pass fail');
    cx.out('ok', `${r}.ok`);
    cx.out('text', `${r}.text`);
    cx.out('margin', `${r}.margin`);
    // The limit is passed for "is true" / "is false" too (verdict ignores it), so a pinned
    // operator edited in the .py still works.
    const limit = cx.ports.inputs.some(p => p.id === 'limit') ? cx.in('limit') : cx.val('limit');
    const call = `verdict(${cx.in('value')}, ${cx.val('op')}, ${limit}, ${cx.val('tol')})`;
    return { lines: branchLines(cx, r, call), ...checkRoutes(cx, r) };
  },
});

// ---------------------------------------------------------------------------------------------
// EMT checks: what an instantaneous waveform has to be turned into before it can be assessed.
//
// PSCAD simulates the waveform itself, not a phasor, so a voltage comes out of a run as the
// wave. These five turn that into the numbers an assessment is written against: an RMS value,
// a harmonic spectrum and its THD, a sequence component, the overshoot and rise time of a
// control response, and the damping of a ringdown.

// The fundamental frequency a harmonic or sequence check works at. Where neither a wire nor a
// typed value gives one, the script calls f_nominal(), which reads the case's own global
// substitution: the runtime's own last-resort 50 Hz would quietly analyse a 60 Hz waveform over
// the wrong window, and a window that is not a whole number of cycles smears one harmonic over
// its neighbours.
function freqArg(cx) {
  const wired = cx.has('frequency');
  const typed = cx.s.frequency !== null && cx.s.frequency !== undefined && cx.s.frequency !== '';
  if (wired || typed) return cx.in('frequency');
  cx.helper('f_nominal');
  return 'f_nominal(app)';
}

const FREQ_IN = {
  id: 'frequency', label: 'Frequency', type: 'num', unit: 'Hz', fallback: 'frequency',
  more: true, tip: 'The fundamental frequency. Empty: the workflow’s nominal frequency, from Start.',
};
const freqSetting = {
  key: 'frequency', label: 'Frequency', kind: 'number', default: null, unit: 'Hz', min: 0.1, step: 10,
  more: true, placeholder: 'The nominal frequency',
  tip: 'The fundamental the window is measured in cycles of. Empty: the nominal frequency set on Start.',
};
const cyclesSetting = (dflt, tip) => ({
  key: 'cycles', label: 'Window', kind: 'number', default: dflt, unit: 'cycles', min: 0.25, step: 0.5,
  more: true, tip,
});

defineBlock({
  type: 'sig.rms', cat: CAT, kind: 'pure',
  title: 'RMS of a waveform',
  desc: 'Turns an instantaneous waveform into its RMS value over a sliding window, as a curve. An EMT run records the wave itself, and an assessment is written against the RMS.',
  keywords: ['rms', 'root mean square', 'waveform', 'instantaneous', 'magnitude', 'voltage', 'current', 'sliding window', 'envelope'],
  inputs: [seriesIn('Waveform', 'The instantaneous waveform, for example a phase voltage recorded by Run simulation.'), FREQ_IN],
  outputs: [{ id: 'series', label: 'RMS curve', type: 'series', var: 'rms' }],
  settings: [
    freqSetting,
    cyclesSetting(1, 'How many cycles the RMS is taken over. One cycle follows a fault closely; more cycles is smoother.'),
    { key: 'label', label: 'Name it', kind: 'text', default: '', more: true, placeholder: 'The waveform’s name, RMS' },
  ],
  summary(s) { return `${n(s.cycles) || 1} cycle window`; },
  varName: resultName('rms'),
  helpers: ['window_rms', 'f_nominal'],
  emit(cx) {
    cx.helper('window_rms');
    return `window_rms(${cx.in('series')}, frequency=${freqArg(cx)}, cycles=${cx.val('cycles')}, label=${cx.val('label')})`;
  },
});

defineBlock({
  type: 'sig.thd', cat: CAT, kind: 'pure',
  title: 'Harmonic distortion (THD)',
  desc: 'The total harmonic distortion of a waveform at one instant, as a percentage of the fundamental, with the worst harmonic named. This is how harmonics come out of an EMT run.',
  keywords: ['thd', 'harmonics', 'distortion', 'power quality', 'spectrum', 'fft', 'fundamental', 'percent', 'grid code', 'compliance'],
  inputs: [
    seriesIn('Waveform', 'The instantaneous waveform to analyse, after the case has settled.'),
    FREQ_IN,
    { id: 'at', label: 'At', type: 'num', unit: 's', fallback: 'at', more: true, tip: 'The instant the window ends. Empty: the end of the run.' },
  ],
  outputs: [
    { id: 'value', label: 'THD', type: 'num', unit: '%', pick: '.value', var: 'thd' },
    { id: 'worst', label: 'Worst harmonic', type: 'num', unit: '%', pick: '.worst', var: 'worst_harmonic', more: true },
    { id: 'order', label: 'Its order', type: 'num', pick: '.worst_order', var: 'worst_order', more: true },
    { id: 'fundamental', label: 'Fundamental', type: 'num', pick: '.fundamental', var: 'fundamental', more: true },
    { id: 'pct', label: 'Every harmonic', type: 'list', pick: '.pct', var: 'harmonics', more: true, tip: 'Harmonics 1 upwards, each as a percentage of the fundamental, for a table or a bar chart.' },
    { id: 'orders', label: 'Harmonic numbers', type: 'list', pick: '.orders', var: 'orders', more: true, tip: '1, 2, 3 and so on, the x axis a spectrum bar chart is drawn against.' },
  ],
  settings: [
    freqSetting,
    { key: 'at', label: 'At', kind: 'number', default: null, unit: 's', placeholder: 'End of the run',
      tip: 'The instant the window ends. Take it once the case has settled, not during a transient.' },
    cyclesSetting(1, 'A whole number of cycles, which is what makes the harmonic magnitudes come out right.'),
    { key: 'harmonics', label: 'Up to harmonic', kind: 'number', default: 50, min: 2, max: 200, step: 5, more: true,
      tip: 'The highest order to work out. The run’s plot step sets the real limit: a 250 us plot step reaches about 2 kHz.' },
    { key: 'includeDc', label: 'Count the DC component', kind: 'bool', default: false, more: true,
      tip: 'Off by default, as a grid code states THD. On, the DC component is added to the sum.' },
  ],
  summary(s) { return `up to harmonic ${n(s.harmonics) || 50}${s.at === null || s.at === '' ? '' : `, at ${s.at} s`}`; },
  varName: resultName('thd result'),
  helpers: ['spectrum', 'f_nominal'],
  emit(cx) {
    cx.helper('spectrum');
    return `thd(${cx.in('series')}, frequency=${freqArg(cx)}, at=${cx.in('at')}, cycles=${cx.val('cycles')}, harmonics=${cx.val('harmonics')}, include_dc=${cx.val('includeDc')})`;
  },
  validate(cx) {
    const h = Number(cx.s.harmonics);
    if (h > 50) cx.warn(`${cx.label} asks for harmonic ${h}. A run only resolves up to half its plot step rate, so check the plot step on Run simulation is small enough.`);
  },
});

defineBlock({
  type: 'sig.sequence', cat: CAT, kind: 'pure',
  title: 'Sequence component',
  desc: 'The positive, negative or zero sequence of three instantaneous phases, as a curve, with the unbalance factor. An EMT run gives three separate phase channels, not one phasor.',
  keywords: ['sequence', 'symmetrical components', 'positive', 'negative', 'zero', 'unbalance', 'three phase', 'phasor', 'asymmetry'],
  inputs: [
    { id: 'a', label: 'Phase A', type: 'series', required: true, tip: 'The instantaneous waveform of phase A.' },
    { id: 'b', label: 'Phase B', type: 'series', required: true },
    { id: 'c', label: 'Phase C', type: 'series', required: true },
    FREQ_IN,
  ],
  outputs: [
    { id: 'series', label: 'Sequence curve', type: 'series', var: 'sequence' },
  ],
  settings: [
    { key: 'which', label: 'Which sequence', kind: 'select', default: 'negative',
      options: [['negative', 'Negative'], ['positive', 'Positive'], ['zero', 'Zero']] },
    freqSetting,
    cyclesSetting(1, 'A whole cycle window, which is what makes the phasor come out right.'),
    { key: 'label', label: 'Name it', kind: 'text', default: '', more: true },
  ],
  summary(s) { return `${s.which || 'negative'} sequence`; },
  varName: resultName('sequence'),
  helpers: ['sequence', 'f_nominal'],
  emit(cx) {
    cx.helper('sequence');
    return `sequence(${cx.in('a')}, ${cx.in('b')}, ${cx.in('c')}, frequency=${freqArg(cx)}, cycles=${cx.val('cycles')}, which=${cx.val('which')}, label=${cx.val('label')})`;
  },
});

defineBlock({
  type: 'sig.unbalance', cat: CAT, kind: 'pure',
  title: 'Unbalance factor',
  desc: 'The negative sequence as a percentage of the positive, at one instant: the number an unbalance limit is written against.',
  keywords: ['unbalance', 'imbalance', 'negative sequence', 'VUF', 'percent', 'three phase', 'power quality', 'grid code'],
  inputs: [
    { id: 'a', label: 'Phase A', type: 'series', required: true },
    { id: 'b', label: 'Phase B', type: 'series', required: true },
    { id: 'c', label: 'Phase C', type: 'series', required: true },
    FREQ_IN,
    { id: 'at', label: 'At', type: 'num', unit: 's', fallback: 'at', more: true, tip: 'The instant to read it. Empty: the end of the run.' },
  ],
  outputs: [
    { id: 'value', label: 'Unbalance', type: 'num', unit: '%', pick: '.value', var: 'unbalance' },
    { id: 'negative', label: 'Negative sequence', type: 'num', pick: '.negative', var: 'negative', more: true },
    { id: 'positive', label: 'Positive sequence', type: 'num', pick: '.positive', var: 'positive', more: true },
  ],
  settings: [
    freqSetting,
    { key: 'at', label: 'At', kind: 'number', default: null, unit: 's', placeholder: 'End of the run' },
    cyclesSetting(1, 'A whole cycle window, which is what makes the phasors come out right.'),
  ],
  summary(s) { return s.at === null || s.at === '' ? 'at the end of the run' : `at ${s.at} s`; },
  varName: resultName('unbalance result'),
  helpers: ['sequence', 'f_nominal'],
  emit(cx) {
    cx.helper('sequence');
    return `unbalance(${cx.in('a')}, ${cx.in('b')}, ${cx.in('c')}, frequency=${freqArg(cx)}, cycles=${cx.val('cycles')}, at=${cx.in('at')})`;
  },
});

defineBlock({
  type: 'sig.overshoot', cat: CAT, kind: 'pure',
  title: 'Overshoot and rise time',
  desc: 'How far past its final value a step response goes, as a percentage of the step, and how long it takes to go from 10 % to 90 % of it.',
  keywords: ['overshoot', 'rise time', 'step response', 'control', 'tuning', 'damping', 'set point', 'controller', 'response'],
  inputs: [
    seriesIn('Response', 'The curve that responds to the step, for example a measured power following its set point.'),
    tEventIn('Step at'),
    { id: 'target', label: 'Final value', type: 'num', fallback: 'target', more: true, tip: 'What it should settle at. Empty: the average of the last second of the run.' },
  ],
  outputs: [
    { id: 'value', label: 'Overshoot', type: 'num', unit: '%', pick: '.value', var: 'overshoot' },
    { id: 'rise', label: 'Rise time', type: 'num', unit: 's', pick: '.rise', var: 'rise_time' },
    { id: 'peak', label: 'Peak', type: 'num', pick: '.peak', var: 'peak', more: true },
    { id: 'time', label: 'Peak time', type: 'num', unit: 's', pick: '.time', var: 'peak_time', more: true },
    { id: 'final', label: 'Final value', type: 'num', pick: '.final', var: 'final_value', more: true },
    { id: 'step', label: 'Step size', type: 'num', pick: '.step', var: 'step_size', more: true },
  ],
  settings: [
    { key: 't_event', label: 'Step at', kind: 'number', default: null, unit: 's', placeholder: 'The run’s first event' },
    { key: 'reference', label: 'Settles at', kind: 'select', default: 'final',
      options: [['final', 'What the run ends at'], ['given', 'A value I type']] },
    { key: 'target', label: 'Final value', kind: 'number', default: null, showIf: (s) => s.reference === 'given' },
    { key: 'hold', label: 'Averaged over', kind: 'number', default: 1, unit: 's', min: 0.001, step: 0.5, more: true,
      showIf: (s) => s.reference !== 'given',
      tip: 'How much of the end of the run is averaged to get the final value.' },
  ],
  summary(s) { return s.reference === 'given' ? `settles at ${n(s.target)}` : 'settles at what the run ends at'; },
  varName: resultName('overshoot result'),
  helpers: ['overshoot'],
  emit(cx) {
    cx.helper('overshoot');
    return `overshoot(${cx.in('series')}, t_event=${cx.in('t_event')}, reference=${cx.val('reference')}, target=${cx.in('target')}, hold=${cx.val('hold')})`;
  },
});

defineBlock({
  type: 'sig.damping', cat: CAT, kind: 'pure',
  title: 'Damping of a ringdown',
  desc: 'The damping ratio and frequency of an oscillation, from the peaks of its envelope. A negative ratio means the oscillation is growing, which is what a control interaction looks like.',
  keywords: ['damping', 'ringdown', 'oscillation', 'stability', 'subsynchronous', 'SSR', 'SSCI', 'control interaction', 'damping ratio', 'growing', 'unstable', 'mode'],
  inputs: [
    seriesIn('Oscillation', 'The curve that rings, for example a machine speed or a converter current after a disturbance.'),
    { id: 't_start', label: 'From', type: 'num', unit: 's', fallback: 't_start', tip: 'Start looking here, after the disturbance itself. Empty: the start of the run.' },
    { id: 't_end', label: 'Until', type: 'num', unit: 's', fallback: 't_end', more: true, tip: 'Empty: the end of the run.' },
  ],
  outputs: [
    { id: 'value', label: 'Damping ratio', type: 'num', pick: '.value', var: 'damping' },
    { id: 'frequency', label: 'Frequency', type: 'num', unit: 'Hz', pick: '.frequency', var: 'mode_hz' },
    { id: 'stable', label: 'Damped', type: 'bool', pick: '.stable', var: 'damped', tip: 'Yes when the oscillation decays, no when it grows.' },
    { id: 'peaks', label: 'Peaks used', type: 'num', pick: '.peaks', var: 'peaks', more: true },
  ],
  settings: [
    { key: 't_start', label: 'From', kind: 'number', default: null, unit: 's', placeholder: 'Start of the run',
      tip: 'Start after the disturbance that set the oscillation off, so its own step is not read as a peak.' },
    { key: 't_end', label: 'Until', kind: 'number', default: null, unit: 's', placeholder: 'End of the run' },
    { key: 'minPeaks', label: 'At least this many peaks', kind: 'number', default: 3, min: 2, max: 50, step: 1, more: true,
      tip: 'Below this the check says the signal may not be oscillating instead of inventing a ratio.' },
  ],
  summary(s) {
    const a = n(s.t_start), b = n(s.t_end);
    return a || b ? `${a || 'start'} to ${b || 'end'} s` : 'the whole run';
  },
  varName: resultName('damping result'),
  helpers: ['damping'],
  emit(cx) {
    cx.helper('damping');
    return `damping(${cx.in('series')}, t_start=${cx.in('t_start')}, t_end=${cx.in('t_end')}, min_peaks=${cx.val('minPeaks')})`;
  },
});

defineFamily({
  id: 'emt', title: 'Read an EMT waveform',
  desc: 'Turn an instantaneous waveform into what an assessment is written against: an RMS value, harmonic distortion, a sequence component or an unbalance factor. Choose which under Kind.',
  keywords: ['rms', 'thd', 'harmonics', 'sequence', 'unbalance', 'waveform', 'instantaneous', 'emt', 'power quality'],
  members: ['sig.rms', 'sig.thd', 'sig.sequence', 'sig.unbalance'], dflt: 'sig.rms',
});
defineFamily({
  id: 'response', title: 'Read a control response',
  desc: 'The overshoot and rise time of a step response, or the damping of a ringdown. Choose which under Kind.',
  keywords: ['overshoot', 'rise time', 'damping', 'ringdown', 'control', 'tuning', 'stability', 'oscillation'],
  members: ['sig.overshoot', 'sig.damping'], dflt: 'sig.overshoot',
});
