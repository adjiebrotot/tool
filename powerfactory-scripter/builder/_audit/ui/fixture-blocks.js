// TEST-ONLY blocks for the UI tests (_audit/ui/run.mjs). Never imported by the page itself:
// the test serves this file in place of js/blocks/start.js (page.route) and an empty module for
// every other category file, so the editor is tested against blocks that do not change while
// the real ones are being written. That is why the import below is relative to js/blocks/.
//
// One block of every kind (start, action, branch, loop, callback, pure, terminal, note), every
// setting kind (text, number with a unit, select, bool, textarea, code, list, attr, element),
// dynamic ports from a list setting and from a template, an obj input with an element
// fallback, a series output (for refused wires and converters), settings with `suggest`,
// `noPin`, `more` and `required`. The emit() functions only need to write valid Python.

import { defineBlock } from '../core/registry.js';

// ---- start
defineBlock({
  type: 'start', cat: 'start', kind: 'start', title: 'Start',
  desc: 'Where the workflow begins (test block).',
  settings: [
    { key: 'project', label: 'Project', kind: 'text', default: '', required: true, placeholder: 'e.g. Nine-bus System', tip: 'The project to open.' },
    { key: 'fNominal', label: 'Nominal frequency', kind: 'select', default: 'auto', options: [['auto', 'Find it'], ['50', '50 Hz'], ['60', '60 Hz']] },
    { key: 'undoChanges', label: 'Put changed values back at the end', kind: 'bool', default: true },
    { key: 'connectTimeout', label: 'Connect timeout', kind: 'number', default: 120, unit: 's', min: 10, more: true },
  ],
  summary(s) { return s.project ? 'Project: ' + s.project : 'Project: not set'; },
  emit(cx) {
    return {
      settings: [
        ...cx.settingLine('PROJECT', 'project', 'The project to open.'),
        ...cx.settingLine('F_NOMINAL', 'fNominal', 'Nominal frequency.', { value: cx.s.fNominal === 'auto' ? 'auto' : Number(cx.s.fNominal) }),
        ...cx.settingLine('UNDO_CHANGES', 'undoChanges', 'Put values back.'),
        ...cx.settingLine('CONNECT_TIMEOUT', 'connectTimeout', 'Seconds to wait.'),
      ],
      lines: [],
    };
  },
});

// ---- action: element fallback, number with unit, attr, select, textarea, bool
defineBlock({
  type: 'fx.set', cat: 'model', kind: 'action', title: 'Set value',
  desc: 'Sets an attribute of a generator (test block).',
  keywords: ['dispatch', 'attribute'],
  inputs: [
    { id: 'el', label: 'Generator', type: 'obj', fallback: 'el', kinds: ['ElmSym', 'ElmGenstat'] },
    { id: 'value', label: 'Value', type: 'num', fallback: 'value', unit: 'MW' },
  ],
  settings: [
    { key: 'el', label: 'Generator', kind: 'element', default: { cls: 'ElmSym', name: '', match: 'one' } },
    { key: 'value', label: 'Value', kind: 'number', default: 100, unit: 'MW', min: 0, max: 5000 },
    { key: 'attr', label: 'Attribute', kind: 'attr', default: 'pgini', required: true, attrs: 'params' },
    { key: 'mode', label: 'Mode', kind: 'select', default: 'abs', options: [['abs', 'Absolute'], ['rel', 'Relative']] },
    { key: 'note', label: 'Note', kind: 'textarea', default: '', more: true },
    { key: 'check', label: 'Check after writing', kind: 'bool', default: false, more: true },
  ],
  summary(s) { return 'Set ' + s.attr + ' to ' + s.value + ' MW'; },
  helpers: ['log'],
  emit(cx) { return [`log(${cx.lit('set')} + str(${cx.in('value')}) + str(${cx.in('el')}))`]; },
});

// ---- branch with two flow outputs and data outputs (bool, num, series)
defineBlock({
  type: 'fx.calc', cat: 'study', kind: 'branch', title: 'Run calculation',
  desc: 'Runs a calculation (test block).',
  keywords: ['load flow'],
  flowOuts: [{ id: 'ok', label: 'Converged' }, { id: 'fail', label: 'Did not converge', stopMsg: 'Calculation did not converge' }],
  outputs: [
    { id: 'converged', label: 'Converged', type: 'bool', var: 'calc_ok' },
    { id: 'slack', label: 'Slack power', type: 'num', unit: 'MW', var: 'slack_mw' },
    { id: 'curve', label: 'Curve', type: 'series', var: 'curve' },
  ],
  settings: [{ key: 'net', label: 'Network', kind: 'select', default: 'ac', options: [['ac', 'AC balanced'], ['dc', 'DC']] }],
  summary(s) { return s.net === 'dc' ? 'DC' : 'AC balanced'; },
  emit(cx) {
    const ok = cx.out('converged');
    const lines = [`${ok} = True`];
    if (cx.used('slack')) lines.push(`${cx.out('slack')} = 1.0`);
    if (cx.used('curve')) lines.push(`${cx.out('curve')} = None`);
    return { lines, branches: [{ out: 'ok', test: ok }], elseOut: 'fail' };
  },
});

// ---- loop with number inputs (fallbacks) and per-pass outputs
defineBlock({
  type: 'fx.loop', cat: 'flow', kind: 'loop', title: 'For a range',
  desc: 'Repeats the steps for each number from first to last (test block).',
  keywords: ['repeat', 'sweep'],
  inputs: [{ id: 'from', label: 'First', type: 'num', fallback: 'from' }, { id: 'to', label: 'Last', type: 'num', fallback: 'to' }],
  outputs: [{ id: 'value', label: 'Value', type: 'num', scope: 'body', var: 'value' }, { id: 'index', label: 'Pass number', type: 'num', scope: 'body', var: 'pass_no' }],
  settings: [
    { key: 'name', label: 'Name', kind: 'text', default: '' },
    { key: 'from', label: 'First', kind: 'number', default: 1 },
    { key: 'to', label: 'Last', kind: 'number', default: 3 },
    { key: 'restore', label: 'After each pass', kind: 'select', default: 'pass', more: true, noPin: true, options: [['pass', 'Put the model back'], ['end', 'After the last pass'], ['never', 'Keep']] },
  ],
  summary(s) { return s.from + ' to ' + s.to; },
  emit(cx) {
    const v = cx.out('value');
    const i = cx.out('index');
    return { lines: [], header: `for ${i}, ${v} in enumerate(range(int(${cx.in('from')}), int(${cx.in('to')}) + 1), 1):`, iter: { i, n: null }, ctx: [cx.lit(cx.label), v] };
  },
});

// ---- callback (a search)
defineBlock({
  type: 'fx.search', cat: 'search', kind: 'callback', title: 'Find a limit',
  desc: 'Tries values to find a limit (test block).',
  outputs: [{ id: 'value', label: 'Value', type: 'num', scope: 'body', var: 'value' }, { id: 'best', label: 'Best', type: 'num', scope: 'done', var: 'best' }],
  settings: [{ key: 'lo', label: 'Lowest', kind: 'number', default: 1 }],
  emit(cx) {
    const v = cx.name('value');
    cx.out('value', v);
    const res = cx.name('search');
    cx.out('best', res);
    return { params: [v], labels: ['Value'], goal: 'max', call: [`${res} = ${cx.fn}(${Number(cx.s.lo) || 0})`] };
  },
});

// ---- pure converters: series -> number, list -> number
defineBlock({
  type: 'fx.peak', cat: 'check', kind: 'pure', title: 'Peak',
  desc: 'The highest value of a curve (test block).',
  keywords: ['maximum'],
  inputs: [{ id: 'series', label: 'Curve', type: 'series', required: true }],
  outputs: [{ id: 'value', label: 'Peak', type: 'num', unit: 'Hz' }],
  emit(cx) { return `max(${cx.in('series')} or [0])`; },
});
defineBlock({
  type: 'fx.number', cat: 'value', kind: 'pure', title: 'Number',
  desc: 'A number you type (test block).',
  outputs: [{ id: 'value', label: 'Value', type: 'num' }],
  settings: [{ key: 'value', label: 'Value', kind: 'number', default: 0 }],
  summary(s) { return String(s.value); },
  emit(cx) { return cx.val('value'); },
});

// ---- list setting with element / attr / select / bool columns, rows giving dynamic inputs;
// a table name that suggests the names in use.
defineBlock({
  type: 'fx.rows', cat: 'result', kind: 'action', title: 'Add row',
  desc: 'Adds a row to a results table (test block).',
  settings: [
    { key: 'table', label: 'Table name', kind: 'text', default: 'Results', suggest: 'tables' },
    { key: 'cols', label: 'Columns', kind: 'list', rowPrefix: 'c', default: [{ id: 'c1', name: 'A', holds: 'num' }],
      columns: [
        { key: 'name', label: 'Column', kind: 'text', default: '' },
        { key: 'holds', label: 'Holds', kind: 'select', default: 'num', options: [['num', 'Numbers'], ['text', 'Text']] },
        { key: 'el', label: 'Element', kind: 'element', default: { cls: 'ElmLne', name: '', match: 'one' }, kinds: ['ElmLne', 'ElmTr2'] },
        { key: 'var', label: 'Variable', kind: 'attr', default: '', attrs: 'results' },
        { key: 'keep', label: 'Keep', kind: 'bool', default: true },
      ] },
  ],
  ports(s) { return { inputs: (Array.isArray(s.cols) ? s.cols : []).map(r => ({ id: r.id, label: r.name || r.id, type: 'cell' })) }; },
  summary(s) { return 'Table ' + s.table; },
  emit(cx) { return [`log(${cx.lit('row for ' + cx.s.table)})`]; },
});

// ---- remember a value (a name with suggestions), code
defineBlock({
  type: 'fx.remember', cat: 'flow', kind: 'action', title: 'Remember a value',
  desc: 'Keeps a value under a name (test block).',
  inputs: [{ id: 'value', label: 'Value', type: 'any' }],
  settings: [{ key: 'name', label: 'Name', kind: 'text', default: 'best', suggest: 'vars' }],
  summary(s) { return 'As ' + s.name; },
  emit(cx) { return [`log(${cx.lit('remember ' + cx.s.name)})`]; },
});
defineBlock({
  type: 'fx.code', cat: 'adv', kind: 'action', title: 'Python code',
  desc: 'Your own Python lines (test block).',
  settings: [{ key: 'code', label: 'Code', kind: 'code', default: 'x = 1', noPin: true }],
  emit(cx) { return String(cx.s.code || 'pass').split('\n').map(l => l.replace(/\s+$/, '')).filter(Boolean).concat(['pass']); },
});

// ---- the If the UI's "Continue only if Yes" uses (same type, ports and option values as the
// real flow.if: a any, b num; op 'true')
defineBlock({
  type: 'flow.if', cat: 'flow', kind: 'branch', title: 'If',
  desc: 'Checks a value and goes on along Yes or No (test block).',
  flowOuts: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }],
  inputs: [{ id: 'a', label: 'Value', type: 'any', required: true }, { id: 'b', label: 'Compare with', type: 'num', fallback: 'b' }],
  settings: [
    { key: 'op', label: 'Check', kind: 'select', default: 'gt', options: [['true', 'is true'], ['gt', '>'], ['lt', '<']] },
    { key: 'b', label: 'Compare with', kind: 'number', default: 0, showIf: (s) => s.op !== 'true' },
  ],
  summary(s) { return s.op === 'true' ? 'Value is true' : 'Value ' + (s.op === 'gt' ? '>' : '<') + ' ' + s.b; },
  emit(cx) {
    const t = cx.name('check');
    const a = cx.in('a');
    const test = cx.s.op === 'true' ? `bool(${a})` : `(${a} or 0) ${cx.s.op === 'gt' ? '>' : '<'} ${cx.in('b')}`;
    return { lines: [`${t} = ${test}`], branches: [{ out: 'yes', test: t }], elseOut: 'no' };
  },
});

// ---- dynamic inputs from a template (like Print a message)
defineBlock({
  type: 'fx.log', cat: 'flow', kind: 'action', title: 'Print a message',
  desc: 'Writes a line to the log (test block).',
  settings: [{ key: 'text', label: 'Message', kind: 'text', default: 'Value {a}' }],
  ports(s) { return { inputs: (String(s.text || '').match(/\{([A-Za-z]\w*)\}/g) || []).map(m => m.slice(1, -1)).filter((x, i, a) => a.indexOf(x) === i).map(n => ({ id: n, label: n, type: 'cell' })) }; },
  summary(s) { return String(s.text || '').slice(0, 40); },
  emit(cx) { return [`log(${cx.lit(cx.s.text)})`]; },
});

// ---- terminal and note
defineBlock({
  type: 'fx.next', cat: 'flow', kind: 'terminal', title: 'Skip to next pass',
  desc: 'Ends this pass of the loop (test block).',
  emit() { return { kind: 'continue' }; },
});
defineBlock({
  type: 'note', cat: 'adv', kind: 'note', title: 'Note',
  desc: 'A sticky note on the canvas (test block).',
  settings: [{ key: 'text', label: 'Text', kind: 'textarea', default: '' }],
});
