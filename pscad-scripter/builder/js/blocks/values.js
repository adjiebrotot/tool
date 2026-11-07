// Values and maths (DESIGN section 9, "value"): constants, lists, arithmetic, formulas,
// comparisons, logic, statistics and text from a template. All of these are calculators
// (kind 'pure'): the generator works them out just before the step that needs them.
//
// Type ids, setting keys, select option values and port ids are frozen handles.
//
// Python helpers: stat() is the analysis runtime's (signals.py); num_range, compare, arith,
// func1, logic, apply_formula and text_format are requested for base.py (see this agent's
// Requests; the test stub carries them meanwhile). All of them are None-safe: an empty input
// gives an empty result instead of an error.

import { defineBlock, defineFamily } from '../core/registry.js';
import { parseValues, allNumbers, placeholders, portIdFor, parseFormula, clip } from '../core/blockkit.js';

const CAT = 'value';

// ---------------------------------------------------------------------------------------------
// Constants

defineBlock({
  type: 'val.number', cat: CAT, kind: 'pure',
  title: 'Number',
  desc: 'A number you type, such as a limit or a step size. Pin it to put it at the top of the script.',
  keywords: ['number', 'value', 'constant', 'limit', 'parameter', 'setpoint'],
  outputs: [{ id: 'value', label: 'Value', type: 'num' }],
  settings: [
    { key: 'value', label: 'Value', kind: 'number', default: 0 },
    { key: 'unit', label: 'Unit', kind: 'text', default: '', more: true, noPin: true, placeholder: 'e.g. MW', tip: 'Only for the labels: the value is used as it is.' },
  ],
  ports(s) { return { outputs: [{ id: 'value', label: 'Value', type: 'num', unit: String(s.unit || '') }] }; },
  summary(s) { return `${s.value}${s.unit ? ' ' + s.unit : ''}`; },
  emit(cx) { return cx.val('value'); },
});

defineBlock({
  type: 'val.text', cat: CAT, kind: 'pure',
  title: 'Text',
  desc: 'A text you type, such as a name or a file stem.',
  keywords: ['text', 'string', 'name', 'label', 'constant'],
  outputs: [{ id: 'value', label: 'Text', type: 'text' }],
  settings: [{ key: 'value', label: 'Text', kind: 'text', default: '' }],
  summary(s) { return s.value ? `"${clip(s.value, 60)}"` : 'Empty'; },
  emit(cx) { return cx.val('value'); },
});

defineBlock({
  type: 'val.bool', cat: CAT, kind: 'pure',
  title: 'Yes / No',
  desc: 'A yes or no you choose, for example to switch part of a workflow on or off with an If.',
  keywords: ['yes', 'no', 'true', 'false', 'switch', 'flag', 'boolean'],
  outputs: [{ id: 'value', label: 'Value', type: 'bool' }],
  settings: [{ key: 'value', label: 'Yes', kind: 'bool', default: true }],
  summary(s) { return s.value ? 'Yes' : 'No'; },
  emit(cx) { return cx.val('value'); },
});

defineBlock({
  type: 'val.list', cat: CAT, kind: 'pure',
  title: 'List of values',
  desc: 'A list you type: numbers or names, one per line or separated by commas.',
  keywords: ['list', 'values', 'array', 'numbers', 'names', 'cases'],
  outputs: [{ id: 'value', label: 'List', type: 'list', var: 'values' }],
  settings: [{ key: 'values', label: 'Values', kind: 'textarea', default: '1, 2, 3', placeholder: 'One per line, or separated by commas',
    tip: 'Numbers or names. Use one per line for numbers with a decimal comma.' }],
  ports(s) { return { outputs: [{ id: 'value', label: 'List', type: allNumbers(parseValues(s.values)) ? 'list' : 'items', var: 'values' }] }; },
  summary(s) { const v = parseValues(s.values); return `${v.length} values`; },
  pinLiteral(key, s) { return key === 'values' ? parseValues(s.values) : undefined; },
  emit(cx) {
    const pinned = (cx.node.pin || []).includes('values');
    return pinned ? cx.val('values') : cx.lit(parseValues(cx.s.values));
  },
});

defineBlock({
  type: 'val.range', cat: CAT, kind: 'pure',
  title: 'Range of numbers',
  desc: 'A list of numbers from First to Last in steps, both ends included, e.g. 0, 0.5 ... 3.',
  keywords: ['range', 'list', 'sequence', 'linspace', 'arange', 'from to', 'steps'],
  inputs: [
    { id: 'from', label: 'First', type: 'num', fallback: 'from' },
    { id: 'to', label: 'Last', type: 'num', fallback: 'to' },
    { id: 'step', label: 'Step', type: 'num', fallback: 'step' },
  ],
  outputs: [{ id: 'value', label: 'List', type: 'list', var: 'values' }],
  settings: [
    { key: 'from', label: 'First', kind: 'number', default: 0 },
    { key: 'to', label: 'Last', kind: 'number', default: 10 },
    { key: 'step', label: 'Step', kind: 'number', default: 1 },
  ],
  summary(s) { return `${s.from} to ${s.to}, step ${s.step}`; },
  helpers: ['num_range'],
  emit(cx) { cx.helper('num_range'); return `num_range(${cx.in('from')}, ${cx.in('to')}, ${cx.in('step')})`; },
  validate(cx) {
    if (!cx.has('step') && Number(cx.s.step) === 0) cx.error(`${cx.label}: the step is 0. Use a step that is not 0.`);
  },
});

// The five constants are one palette entry, Value, with a Kind switch; their `value` keys are a
// number, a text and a yes / no, which settingsOf converts when the kind changes.
defineFamily({
  id: 'value', title: 'Value',
  desc: 'A value you type: a number, a text, a yes / no, a list, or a range of numbers. Choose which under Kind in its settings.',
  keywords: ['value', 'constant', 'number', 'text', 'yes no', 'list', 'range', 'parameter'],
  members: ['val.number', 'val.text', 'val.bool', 'val.list', 'val.range'], dflt: 'val.number', convert: ['value'],
});

// ---------------------------------------------------------------------------------------------
// Arithmetic

const ARITH = [['add', '+'], ['sub', '−'], ['mul', '×'], ['div', '÷'], ['pow', 'power'], ['min', 'smaller of'], ['max', 'larger of'], ['mod', 'remainder']];
const eachSetting = { key: 'each', label: 'Work on each value of a list', kind: 'bool', default: false, more: true, noPin: true,
  tip: 'Take lists in and give a list out, value by value (lists of the same length, or a list and one number).' };
const numOrList = (s) => (s.each ? 'list' : 'num');

defineBlock({
  type: 'math.arith', cat: CAT, kind: 'pure',
  title: 'Arithmetic',
  desc: 'Adds, subtracts, multiplies or divides two numbers (or takes the smaller, larger, power or remainder). Empty in gives empty out.',
  keywords: ['add', 'subtract', 'multiply', 'divide', 'plus', 'minus', 'times', 'maths', 'calculate', 'power', 'difference'],
  inputs: [
    { id: 'a', label: 'A', type: 'num', fallback: 'a' },
    { id: 'b', label: 'B', type: 'num', fallback: 'b' },
  ],
  outputs: [{ id: 'value', label: 'Result', type: 'num', var: 'result' }],
  settings: [
    { key: 'op', label: 'Operation', kind: 'select', default: 'add', options: ARITH },
    { key: 'a', label: 'A', kind: 'number', default: 0 },
    { key: 'b', label: 'B', kind: 'number', default: 0 },
    eachSetting,
  ],
  ports(s) {
    const t = numOrList(s);
    return { inputs: [{ id: 'a', label: 'A', type: t, fallback: 'a' }, { id: 'b', label: 'B', type: t, fallback: 'b' }], outputs: [{ id: 'value', label: 'Result', type: t, var: 'result' }] };
  },
  summary(s) {
    const o = (ARITH.find(x => x[0] === s.op) || ARITH[0])[1];
    return /^[a-z]/.test(o) ? `${o} A and B` : `A ${o} B`;
  },
  helpers: ['arith'],
  emit(cx) { cx.helper('arith'); return `arith(${cx.val('op')}, ${cx.in('a')}, ${cx.in('b')})`; },
});

defineBlock({
  type: 'math.formula', cat: CAT, kind: 'pure',
  title: 'Formula',
  desc: 'Works out a formula such as sqrt(p**2 + q**2). Each name in it becomes an input. Knows abs, min, max, round, sqrt, log, log10, exp, pi.',
  keywords: ['formula', 'expression', 'equation', 'calculate', 'maths', 'sqrt', 'custom'],
  inputs: [],
  outputs: [{ id: 'value', label: 'Result', type: 'num', var: 'result' }],
  settings: [
    { key: 'expr', label: 'Formula', kind: 'text', default: 'a * b', noPin: true, placeholder: 'e.g. sqrt(p**2 + q**2)',
      tip: 'Use names for the inputs. ** or ^ is power. Functions: abs, min, max, round, sqrt, log, log10, exp, sin, cos, tan; constants pi and e.' },
    eachSetting,
  ],
  ports(s) {
    const f = parseFormula(s.expr);
    const t = numOrList(s);
    return { inputs: f.inputs.map(n => ({ id: portIdFor(n), label: n, type: t })), outputs: [{ id: 'value', label: 'Result', type: t, var: 'result' }] };
  },
  summary(s) { return clip(s.expr); },
  helpers: ['apply_formula'],
  emit(cx) {
    const f = parseFormula(cx.s.expr);
    if (!f.ok) return 'None';
    cx.helper('apply_formula');
    if (f.usesMath) cx.imp('import math');
    const args = f.inputs.map(n => cx.in(portIdFor(n)));
    return `apply_formula(lambda ${f.inputs.join(', ')}: ${f.expr}, [${args.join(', ')}], ${cx.s.each ? 'True' : 'False'}, ${cx.lit(cx.label)})`;
  },
  validate(cx) {
    const f = parseFormula(cx.s.expr);
    if (!f.ok) cx.error(`${cx.label}: ${f.error}.`);
  },
});

const FUNCS = [['abs', 'Absolute value'], ['round', 'Round'], ['sqrt', 'Square root'], ['neg', 'Negate (−x)'], ['floor', 'Round down'], ['ceil', 'Round up'], ['log10', 'Log base 10'], ['exp', 'e to the power']];

defineBlock({
  type: 'math.func', cat: CAT, kind: 'pure',
  title: 'Function',
  desc: 'Applies one function to a number: absolute value, round, square root, negate, round down or up, log10, exp.',
  keywords: ['abs', 'absolute', 'round', 'sqrt', 'square root', 'negate', 'floor', 'ceil', 'log', 'exp', 'function'],
  inputs: [{ id: 'x', label: 'X', type: 'num', fallback: 'x' }],
  outputs: [{ id: 'value', label: 'Result', type: 'num', var: 'result' }],
  settings: [
    { key: 'fn', label: 'Function', kind: 'select', default: 'abs', options: FUNCS },
    { key: 'x', label: 'X', kind: 'number', default: 0 },
    { key: 'digits', label: 'Decimals', kind: 'number', default: 2, min: 0, step: 1, showIf: (s) => s.fn === 'round' },
    eachSetting,
  ],
  ports(s) {
    const t = numOrList(s);
    return { inputs: [{ id: 'x', label: 'X', type: t, fallback: 'x' }], outputs: [{ id: 'value', label: 'Result', type: t, var: 'result' }] };
  },
  summary(s) { const f = (FUNCS.find(x => x[0] === s.fn) || FUNCS[0])[1]; return s.fn === 'round' ? `${f} to ${s.digits} decimals` : f; },
  helpers: ['func1'],
  emit(cx) {
    cx.helper('func1');
    const pinned = (cx.node.pin || []).includes('fn') || (cx.node.pin || []).includes('digits');
    const n = pinned || cx.s.fn === 'round' ? `, ${cx.val('digits')}` : '';
    return `func1(${cx.val('fn')}, ${cx.in('x')}${n})`;
  },
});

const CMP = [['gt', '>'], ['ge', '≥'], ['lt', '<'], ['le', '≤'], ['eq', '='], ['ne', '≠']];

defineBlock({
  type: 'math.compare', cat: CAT, kind: 'pure',
  title: 'Compare',
  desc: 'Compares two numbers and gives Yes or No (empty when a number is missing).',
  keywords: ['compare', 'greater', 'less', 'equal', 'above', 'below', 'condition', 'check'],
  inputs: [
    { id: 'a', label: 'A', type: 'num', fallback: 'a' },
    { id: 'b', label: 'B', type: 'num', fallback: 'b' },
  ],
  outputs: [{ id: 'value', label: 'Yes / No', type: 'bool', var: 'compared' }],
  settings: [
    { key: 'op', label: 'Check', kind: 'select', default: 'gt', options: CMP },
    { key: 'a', label: 'A', kind: 'number', default: 0 },
    { key: 'b', label: 'B', kind: 'number', default: 0 },
    { key: 'tol', label: 'Tolerance for = and ≠', kind: 'number', default: 1e-9, more: true, showIf: (s) => s.op === 'eq' || s.op === 'ne' },
  ],
  summary(s) { return `A ${(CMP.find(x => x[0] === s.op) || CMP[0])[1]} B`; },
  helpers: ['compare'],
  emit(cx) { cx.helper('compare'); return `compare(${cx.in('a')}, ${cx.val('op')}, ${cx.in('b')}, ${cx.val('tol')})`; },
});

const LOGIC = [['and', 'Both (and)'], ['or', 'Either (or)'], ['not', 'Not']];

defineBlock({
  type: 'math.logic', cat: CAT, kind: 'pure',
  title: 'And / or / not',
  desc: 'Combines yes / no values: both, either, or the opposite. An unknown value stays unknown unless the answer is clear without it.',
  keywords: ['and', 'or', 'not', 'logic', 'boolean', 'both', 'either', 'combine'],
  inputs: [
    { id: 'a', label: 'A', type: 'bool' },
    { id: 'b', label: 'B', type: 'bool' },
  ],
  outputs: [{ id: 'value', label: 'Yes / No', type: 'bool', var: 'combined' }],
  settings: [{ key: 'op', label: 'Combine', kind: 'select', default: 'and', options: LOGIC }],
  ports(s) {
    return { inputs: s.op === 'not' ? [{ id: 'a', label: 'A', type: 'bool' }] : [{ id: 'a', label: 'A', type: 'bool' }, { id: 'b', label: 'B', type: 'bool' }] };
  },
  summary(s) { return (LOGIC.find(x => x[0] === s.op) || LOGIC[0])[1]; },
  helpers: ['logic'],
  emit(cx) {
    cx.helper('logic');
    return `logic(${cx.val('op')}, ${cx.in('a')}, ${cx.in('b')})`;
  },
});

// ---------------------------------------------------------------------------------------------
// Statistics: one block per kind, so quick-add can offer "Maximum, Minimum, Average or Sum".

const STATS = [
  ['max', 'Maximum', 'The largest of the values.', ['maximum', 'max', 'largest', 'highest', 'peak', 'worst'], 'maximum'],
  ['min', 'Minimum', 'The smallest of the values.', ['minimum', 'min', 'smallest', 'lowest', 'worst'], 'minimum'],
  ['mean', 'Average', 'The average (mean) of the values.', ['average', 'mean'], 'average'],
  ['median', 'Median', 'The middle value: half of the values are below it.', ['median', 'middle'], 'median'],
  ['sum', 'Sum', 'All the values added up.', ['sum', 'total', 'add up'], 'total'],
  ['count', 'Count', 'How many values there are.', ['count', 'number of', 'how many', 'length'], 'count'],
  ['std', 'Standard deviation', 'How far the values spread around their average (standard deviation).', ['standard deviation', 'std', 'spread', 'sigma'], 'std_dev'],
  ['percentile', 'Percentile', 'The value below which the given percentage of the values lie, e.g. the 95th percentile.', ['percentile', 'p95', 'quantile'], 'percentile'],
];

for (const [kind, title, what, kw, varName] of STATS) {
  const pct = kind === 'percentile';
  defineBlock({
    type: 'math.' + kind, cat: CAT, kind: 'pure',
    title,
    desc: `${what} Takes a list, a time series (its values) or one number; empty values are left out.`,
    keywords: [...kw, 'statistics', 'list', 'values'],
    inputs: [
      { id: 'values', label: 'Values', type: 'list', required: true },
      ...(pct ? [{ id: 'p', label: 'Percent', type: 'num', fallback: 'p', unit: '%' }] : []),
    ],
    outputs: [{ id: 'value', label: title, type: 'num', var: varName }],
    settings: pct ? [{ key: 'p', label: 'Percent', kind: 'number', default: 95, min: 0, max: 100, unit: '%' }] : [],
    summary(s) { return pct ? `${s.p} %` : ''; },
    helpers: ['stat'],
    emit(cx) {
      cx.helper('stat');
      return pct ? `stat("percentile", ${cx.in('values')}, ${cx.in('p')})` : `stat(${cx.lit(kind)}, ${cx.in('values')})`;
    },
  });
}

defineFamily({
  id: 'stats', title: 'Statistics',
  desc: 'The maximum, minimum, average, median, sum, count, standard deviation or a percentile of a list or a time series. Choose which under Kind.',
  keywords: ['statistics', 'maximum', 'minimum', 'average', 'mean', 'median', 'sum', 'count', 'standard deviation', 'percentile', 'worst'],
  members: STATS.map(x => 'math.' + x[0]), dflt: 'math.max',
});

// ---------------------------------------------------------------------------------------------
defineBlock({
  type: 'text.format', cat: CAT, kind: 'pure',
  title: 'Text from a template',
  desc: 'Builds a text from a template such as "Dispatch {p} MW". Each {name} becomes an input; {p:.1f} shows 1 decimal.',
  keywords: ['text', 'format', 'template', 'string', 'name', 'join', 'caption', 'title'],
  inputs: [],
  outputs: [{ id: 'value', label: 'Text', type: 'text', var: 'text' }],
  settings: [{ key: 'template', label: 'Template', kind: 'text', default: 'Dispatch {p} MW',
    tip: 'Each {name} becomes an input. {name:.2f} shows a number with 2 decimals; {{ and }} give a brace.' }],
  ports(s) { return { inputs: placeholders(s.template).names.map(n => ({ id: portIdFor(n), label: n, type: 'cell' })) }; },
  summary(s) { return clip(s.template); },
  helpers: ['text_format'],
  emit(cx) {
    const p = placeholders(cx.s.template);
    if (!p.names.length && !(cx.node.pin || []).includes('template')) return cx.lit(String(cx.s.template || '').replace(/\{\{/g, '{').replace(/\}\}/g, '}'));
    cx.helper('text_format');
    return `text_format(${cx.val('template')}, {${p.names.map(n => `${cx.lit(n)}: ${cx.in(portIdFor(n))}`).join(', ')}})`;
  },
  validate(cx) {
    const p = placeholders(cx.s.template);
    if (p.bad.length) cx.error(`${cx.label}: ${p.bad[0]} is not a placeholder it can fill. Use a name in braces, such as {value}, or {{ and }} for a brace.`);
  },
});
