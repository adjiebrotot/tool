// TEST-ONLY blocks for the analysis blocks tests. Never imported by the page (blocks/index.js
// does not know them). They stand in for a simulation so the check, result and search blocks can
// run offline: a recorded trace from a CSV, a synthetic frequency dip that deepens with the
// power tripped, and a run that recorded nothing. Their helpers are in fixture_runtime.py.

import { defineBlock } from '../../../../js/core/registry.js';

defineBlock({
  type: 'fixa.csvseries', cat: 'study', kind: 'pure', title: 'Series from CSV (test)',
  desc: 'TEST ONLY: a time series read from a two-column CSV.', keywords: ['test'],
  outputs: [{ id: 'series', label: 'Time series', type: 'series', unit: 'Hz', var: 'trace' }],
  settings: [
    { key: 'path', label: 'CSV file', kind: 'text', default: '' },
    { key: 'label', label: 'Label', kind: 'text', default: 'Bus 16 m:fehz' },
    { key: 'unit', label: 'Unit', kind: 'text', default: 'Hz' },
    { key: 'events', label: 'Events', kind: 'text', default: '1.0:trip', tip: 'time:label, comma separated' },
  ],
  emit(cx) {
    cx.helper('fixture_series');
    const ev = String(cx.s.events || '').split(',').map(x => x.trim()).filter(Boolean).map(x => { const [t, ...l] = x.split(':'); return [Number(t), l.join(':')]; });
    return `fixture_series(${cx.lit(cx.s.path)}, ${cx.lit(cx.s.label)}, ${cx.lit(cx.s.unit)}, ${cx.lit(ev)})`;
  },
});

defineBlock({
  type: 'fixa.synth', cat: 'study', kind: 'pure', title: 'Synthetic frequency dip (test)',
  desc: 'TEST ONLY: a frequency dip that deepens with the MW tripped.', keywords: ['test'],
  inputs: [{ id: 'mw', label: 'MW tripped', type: 'num', fallback: 'mw' }],
  outputs: [{ id: 'series', label: 'Frequency', type: 'series', unit: 'Hz', var: 'freq' }],
  settings: [{ key: 'mw', label: 'MW tripped', kind: 'number', default: 100 }, { key: 'nominal', label: 'Nominal', kind: 'number', default: 60 }],
  emit(cx) { cx.helper('synth_freq'); return `synth_freq(${cx.in('mw')}, ${cx.val('nominal')})`; },
});

defineBlock({
  type: 'fixa.empty', cat: 'study', kind: 'pure', title: 'Empty series (test)',
  desc: 'TEST ONLY: a series with no samples.', keywords: ['test'],
  outputs: [{ id: 'series', label: 'Frequency', type: 'series', unit: 'Hz', var: 'nothing' }],
  emit(cx) { cx.helper('empty_series'); return 'empty_series()'; },
});
