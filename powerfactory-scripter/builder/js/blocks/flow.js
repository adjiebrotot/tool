// Flow: loops and decisions (DESIGN section 9, "flow"), plus Remember / Recall a value.
//
// Type ids, setting keys, select option values and port ids are frozen handles (saved in every
// workflow and .py); change titles, labels, descriptions and tips freely.
//
// Loops share three settings: "name" (the label of each pass in tables, file names and the
// log), "restore" (pass / end / never: when the model is put back, E3) and "onError" (skip /
// stop). The generator reads restore and onError itself (codegen.js emitLoop).
//
// Python helpers used here that base.py does not have yet (num_range, compare, text_format)
// are listed in this agent's Requests; the test stub carries them meanwhile.

import { defineBlock } from '../core/registry.js';
import { parseValues, allNumbers, placeholders, portIdFor, clip } from '../core/blockkit.js';

const CAT = 'flow';

// Empty (the default) means: the block's label when it has one, else `fallback` ("Value"), so a
// loop labelled "Dispatch (MW)" gives a "Dispatch (MW)" column without typing it twice.
const nameSetting = (fallback) => ({
  key: 'name', label: 'Name (table column and file names)', kind: 'text', default: '', placeholder: `The block's name, or ${fallback}`,
  tip: `What each pass is called: the column in results tables, part of file names and the log label. Empty: the block's name, or "${fallback}".`,
});
const restoreSetting = {
  key: 'restore', label: 'After each pass', kind: 'select', default: 'pass', more: true, noPin: true,
  options: [['pass', 'Put the model back (every pass starts from the same model)'], ['end', 'Put the model back after the last pass'], ['never', 'Keep the changes']],
  tip: 'What happens to values the steps changed. By default each pass starts from the same model.',
};
const onErrorSetting = {
  key: 'onError', label: 'If a pass fails', kind: 'select', default: 'skip', more: true, noPin: true,
  options: [['skip', 'Note it and go on with the next pass'], ['stop', 'Stop the workflow']],
  tip: 'A pass fails when a step raises an error. It is noted in the log and in the results table either way.',
};
const passLabel = (cx, fallback) => cx.lit(String(cx.s.name || '').trim() || String(cx.node.label || '').trim() || fallback);
// "dispatch_mw_values" for a loop the reader labelled "Dispatch (MW)", else just "values".
const listName = (cx, what) => cx.name((String(cx.node.label || '').trim() ? cx.label + ' ' : '') + what);

const OPS = [['true', 'is true'], ['gt', '>'], ['ge', '≥'], ['lt', '<'], ['le', '≤'], ['eq', '='], ['ne', '≠']];
const opText = (op) => (OPS.find(o => o[0] === op) || OPS[0])[1];

// ---------------------------------------------------------------------------------------------
defineBlock({
  type: 'flow.if', cat: CAT, kind: 'branch',
  title: 'If',
  desc: 'Checks a value and goes on along Yes or No. An empty value takes No (and says so in the log).',
  keywords: ['if', 'condition', 'decision', 'branch', 'check', 'compare', 'yes no', 'only if', 'settles'],
  flowOuts: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }],
  inputs: [
    { id: 'a', label: 'Value', type: 'any', required: true },
    { id: 'b', label: 'Compare with', type: 'num', fallback: 'b', tip: 'The number to compare the value with (not used for "is true").' },
  ],
  settings: [
    { key: 'op', label: 'Check', kind: 'select', default: 'true', options: OPS, tip: '"is true" takes Yes for a yes / true / pass value; the others compare numbers.' },
    { key: 'b', label: 'Compare with', kind: 'number', default: 0, showIf: (s) => s.op !== 'true' },
    { key: 'tol', label: 'Tolerance for = and ≠', kind: 'number', default: 1e-9, more: true, showIf: (s) => s.op === 'eq' || s.op === 'ne',
      tip: 'Two numbers closer than this count as equal.' },
  ],
  ports(s) {
    return {
      inputs: [
        { id: 'a', label: 'Value', type: 'any', required: true },
        { id: 'b', label: s.op === 'true' ? 'Compare with (not used)' : 'Compare with', type: 'num', fallback: 'b' },
      ],
    };
  },
  summary(s) { return s.op === 'true' ? 'Value is true' : `Value ${opText(s.op)} ${s.b}`; },
  helpers: ['compare', 'log'],
  emit(cx) {
    const ok = cx.name(cx.label === 'If' ? 'check' : cx.label);
    const a = cx.in('a');
    // b is passed for "is true" too (compare ignores it), so a pinned Check edited in the .py works.
    const b = cx.in('b');
    cx.helper('compare', 'log');
    return {
      lines: [
        `${ok} = compare(${a}, ${cx.val('op')}, ${b}, ${cx.val('tol')})`,
        `if ${ok} is None:`,
        `    log(${cx.lit(cx.label + ': there is no value to check, so it takes No.')}, "warn")`,
      ],
      branches: [{ out: 'yes', test: ok }],
      elseOut: 'no',
    };
  },
});

// ---------------------------------------------------------------------------------------------
defineBlock({
  type: 'flow.range', cat: CAT, kind: 'loop',
  title: 'For a range of numbers',
  desc: 'Repeats the Each pass steps for every number from First to Last in steps (both ends included), e.g. 100, 150 ... 300 MW.',
  keywords: ['for', 'loop', 'range', 'sweep', 'repeat', 'step', 'dispatch', 'each value', 'from to'],
  inputs: [
    { id: 'from', label: 'First', type: 'num', fallback: 'from' },
    { id: 'to', label: 'Last', type: 'num', fallback: 'to' },
    { id: 'step', label: 'Step', type: 'num', fallback: 'step' },
  ],
  outputs: [
    { id: 'value', label: 'Value', type: 'num', scope: 'body', var: 'value', tip: 'The number of this pass.' },
    { id: 'index', label: 'Pass no.', type: 'num', scope: 'body', var: 'pass_no', tip: 'The pass number, 1 for the first pass.' },
    { id: 'count', label: 'Number of passes', type: 'num', scope: 'done', var: 'passes' },
  ],
  settings: [
    nameSetting('Value'),
    { key: 'from', label: 'First', kind: 'number', default: 1 },
    { key: 'to', label: 'Last', kind: 'number', default: 10 },
    { key: 'step', label: 'Step', kind: 'number', default: 1, tip: 'The difference between two passes. Use a negative step to count down.' },
    restoreSetting, onErrorSetting,
  ],
  summary(s) { return `${s.from} to ${s.to}, step ${s.step}`; },
  helpers: ['num_range'],
  emit(cx) {
    const vals = listName(cx, 'values');
    const i = cx.out('index');
    const v = cx.out('value');
    cx.out('count', `len(${vals})`);
    cx.helper('num_range');
    return {
      lines: [`${vals} = num_range(${cx.in('from')}, ${cx.in('to')}, ${cx.in('step')})`],
      header: `for ${i}, ${v} in enumerate(${vals}, 1):`,
      iter: { i, n: `len(${vals})` },
      ctx: [passLabel(cx, 'Value'), v],
    };
  },
  validate(cx) {
    if (!cx.has('step') && Number(cx.s.step) === 0) cx.error(`${cx.label}: the step is 0, so the loop would never end. Use a step that is not 0.`);
  },
});

// ---------------------------------------------------------------------------------------------
const listPorts = (s) => {
  const index = { id: 'index', label: 'Pass no.', type: 'num', scope: 'body', var: 'pass_no' };
  const count = { id: 'count', label: 'Number of passes', type: 'num', scope: 'done', var: 'passes' };
  if (s.source === 'table') {
    const cols = (Array.isArray(s.cols) ? s.cols : []).map(r => ({
      id: r.id, label: String(r.name || r.id), type: r.type === 'text' ? 'text' : 'num', scope: 'body', var: String(r.name || r.id),
    }));
    return { inputs: [], outputs: [...cols, index, count] };
  }
  if (s.source === 'list') {
    const t = s.itemType === 'obj' ? 'obj' : s.itemType === 'text' ? 'text' : 'num';
    return {
      inputs: [{ id: 'items', label: 'List', type: 'items', required: true, tip: 'The list to loop over: numbers, names or elements.' }],
      outputs: [{ id: 'item', label: 'Item', type: t, scope: 'body', var: 'item' }, index, count],
    };
  }
  const vals = parseValues(s.values);
  return { inputs: [], outputs: [{ id: 'item', label: 'Item', type: allNumbers(vals) ? 'num' : 'text', scope: 'body', var: 'item' }, index, count] };
};

defineBlock({
  type: 'flow.list', cat: CAT, kind: 'loop',
  title: 'For each item',
  desc: 'Repeats the Each pass steps for every item of a list: values typed here, a list wired in, or the rows of a results table.',
  keywords: ['for each', 'loop', 'list', 'items', 'rows', 'table', 'cases', 'iterate', 'repeat'],
  inputs: [{ id: 'items', label: 'List', type: 'items' }],
  outputs: [
    { id: 'item', label: 'Item', type: 'num', scope: 'body', var: 'item' },
    { id: 'index', label: 'Pass no.', type: 'num', scope: 'body', var: 'pass_no' },
    { id: 'count', label: 'Number of passes', type: 'num', scope: 'done', var: 'passes' },
  ],
  settings: [
    nameSetting('Item'),
    { key: 'source', label: 'Loop over', kind: 'select', default: 'values', noPin: true,
      options: [['values', 'Values typed here'], ['list', 'A list wired in'], ['table', 'The rows of a results table']] },
    { key: 'values', label: 'Values', kind: 'textarea', default: '1, 2, 3', showIf: (s) => s.source === 'values',
      placeholder: 'One per line, or separated by commas', tip: 'Numbers or names, one per line or separated by commas. Use one per line for numbers with a decimal comma.' },
    { key: 'itemType', label: 'Each item is', kind: 'select', default: 'num', noPin: true, showIf: (s) => s.source === 'list',
      options: [['num', 'A number'], ['text', 'A text'], ['obj', 'A PowerFactory element']] },
    { key: 'table', label: 'Table name', kind: 'text', default: 'Results', suggest: 'tables', showIf: (s) => s.source === 'table',
      tip: 'The results table to read, filled earlier by Add row or Read table from file.' },
    { key: 'cols', label: 'Columns to use', kind: 'list', default: [{ id: 'c1', name: 'Case', type: 'text' }], rowPrefix: 'c', showIf: (s) => s.source === 'table',
      columns: [{ key: 'name', label: 'Column', kind: 'text', default: '', suggest: 'columns' }, { key: 'type', label: 'Holds', kind: 'select', default: 'num', options: [['num', 'Numbers'], ['text', 'Text']] }],
      tip: 'Each column you list here becomes an output of the loop, with that row\'s value on each pass.' },
    { key: 'runCol', label: 'Only rows where this column says yes', kind: 'text', default: '', noPin: true, suggest: 'columns', showIf: (s) => s.source === 'table', more: true,
      placeholder: 'e.g. Run?', tip: 'Leave empty to use every row. A row runs when this column holds yes, true, 1 or pass.' },
    restoreSetting, onErrorSetting,
  ],
  ports: listPorts,
  summary(s) {
    if (s.source === 'table') return `Rows of ${s.table || 'Results'}`;
    if (s.source === 'list') return 'Items of the list wired in';
    const v = parseValues(s.values);
    return v.length ? `${v.length} values: ${v.slice(0, 4).join(', ')}${v.length > 4 ? ' ...' : ''}` : 'No values yet';
  },
  helpers: ['convert'],
  itemOutput: 'item',
  itemList(cx) {
    if (cx.s.source === 'list') { cx.helper('convert'); return `as_items(${cx.in('items')})`; }
    if (cx.s.source === 'values') return cx.lit(parseValues(cx.s.values));
    return null;
  },
  pinLiteral(key, s) { return key === 'values' ? parseValues(s.values) : undefined; },
  emit(cx) {
    const s = cx.s;
    const items = listName(cx, s.source === 'table' ? 'rows' : 'items');
    const i = cx.out('index');
    cx.out('count', `len(${items})`);
    cx.helper('convert', 'log');
    const lines = [];
    let header, ctxVal;
    if (s.source === 'table') {
      cx.helper('table');
      const row = cx.name('row');
      const r = cx.name('r');
      const filter = String(s.runCol || '').trim() ? ` if as_bool(${r}.get(${cx.lit(String(s.runCol).trim())}))` : '';
      lines.push(`${items} = [${r} for ${r} in table(${(cx.node.pin || []).includes('table') ? cx.val('table') : cx.lit(s.table || 'Results')}).rows${filter}]`);
      lines.push(`if not ${items}:`, `    log(${cx.lit(`${cx.label}: the table "${s.table || 'Results'}" has no rows to loop over.`)}, "warn")`);
      header = `for ${i}, ${row} in enumerate(${items}, 1):`;
      const cols = Array.isArray(s.cols) ? s.cols : [];
      cols.forEach(c => {
        const get = `${row}.get(${cx.lit(String(c.name || ''))})`;
        cx.out(c.id, c.type === 'text' ? `as_text(${get})` : `as_float(${get})`);
      });
      ctxVal = cols.length ? `${row}.get(${cx.lit(String(cols[0].name || ''))})` : i;
    } else {
      const item = cx.out('item');
      if (s.source === 'list') {
        lines.push(`${items} = as_items(${cx.in('items')})`);
        if (s.itemType === 'num') {
          lines.push(`if any(as_float(x) is None for x in ${items}):`,
            `    log(${cx.lit(cx.label + ': some items of the list are not numbers.')}, "warn")`);
        }
      } else {
        lines.push(`${items} = ${(cx.node.pin || []).includes('values') ? cx.val('values') : cx.lit(parseValues(s.values))}`);
      }
      header = `for ${i}, ${item} in enumerate(${items}, 1):`;
      ctxVal = item;
    }
    return { lines, header, iter: { i, n: `len(${items})` }, ctx: [passLabel(cx, 'Item'), ctxVal] };
  },
  validate(cx) {
    if (cx.s.source === 'values' && !parseValues(cx.s.values).length) cx.todo(`Type the values for ${cx.label} to loop over.`);
    if (cx.s.source === 'table' && !(Array.isArray(cx.s.cols) && cx.s.cols.length)) cx.warn(`${cx.label}: no columns are listed, so the rows' values are not available to the steps.`);
  },
});

// ---------------------------------------------------------------------------------------------
defineBlock({
  type: 'flow.repeat', cat: CAT, kind: 'loop',
  title: 'Repeat N times',
  desc: 'Repeats the Each pass steps a set number of times.',
  keywords: ['repeat', 'loop', 'times', 'n times', 'count', 'iterate'],
  inputs: [{ id: 'times', label: 'Times', type: 'num', fallback: 'times' }],
  outputs: [
    { id: 'index', label: 'Pass no.', type: 'num', scope: 'body', var: 'pass_no' },
  ],
  settings: [
    nameSetting('Pass'),
    { key: 'times', label: 'Times', kind: 'number', default: 3, min: 0, step: 1 },
    restoreSetting, onErrorSetting,
  ],
  summary(s) { return `${s.times} times`; },
  helpers: ['convert'],
  emit(cx) {
    const i = cx.out('index');
    const n = listName(cx, 'passes');
    cx.helper('convert');
    return {
      lines: [`${n} = int(as_float(${cx.in('times')}, 0) or 0)`],
      header: `for ${i} in range(1, ${n} + 1):`,
      iter: { i, n },
      ctx: [passLabel(cx, 'Pass'), i],
    };
  },
});

// ---------------------------------------------------------------------------------------------
defineBlock({
  type: 'flow.until', cat: CAT, kind: 'loop',
  title: 'Repeat until',
  desc: 'Repeats the Each pass steps until the condition is true at the end of a pass, at most Max passes times.',
  keywords: ['repeat until', 'while', 'loop', 'until', 'converge', 'condition', 'iterate'],
  inputs: [
    { id: 'cond', label: 'Until', type: 'bool', at: 'bodyEnd', required: true, tip: 'Checked at the end of every pass: when it is true, the loop ends.' },
  ],
  outputs: [
    { id: 'index', label: 'Pass no.', type: 'num', scope: 'body', var: 'pass_no' },
    { id: 'met', label: 'Condition met', type: 'bool', scope: 'done', var: 'met', tip: 'Yes when the loop ended because the condition was true.' },
  ],
  settings: [
    nameSetting('Pass'),
    { key: 'max', label: 'Max passes', kind: 'number', default: 20, min: 1, step: 1, tip: 'The loop stops after this many passes even when the condition is never true.' },
    restoreSetting, onErrorSetting,
  ],
  summary(s) { return `At most ${s.max} passes`; },
  helpers: ['convert', 'log'],
  emit(cx) {
    const i = cx.out('index');
    const met = cx.out('met');
    const pinned = (cx.node.pin || []).includes('max');
    const max = pinned ? `int(${cx.val('max')})` : String(Math.max(1, Math.floor(Number(cx.s.max) || 1)));
    cx.helper('convert', 'log');
    return {
      lines: [`${met} = False`],
      header: `for ${i} in range(1, ${max} + 1):`,
      iter: { i, n: max },
      ctx: [passLabel(cx, 'Pass'), i],
      bodyEnd: (bx) => [`if as_bool(${bx.in('cond')}):`, `    ${met} = True`, '    break'],
      orelse: [pinned
        ? `log(${cx.lit(cx.label + ' stopped after ')} + str(${max}) + ${cx.lit(' passes without the condition.')}, "warn")`
        : `log(${cx.lit(`${cx.label} stopped after ${max} passes without the condition.`)}, "warn")`],
    };
  },
});

// ---------------------------------------------------------------------------------------------
defineBlock({
  type: 'flow.next', cat: CAT, kind: 'terminal',
  title: 'Skip to next pass',
  desc: 'Ends this pass of the loop now and goes on with the next pass. The reason goes into the log and the results table.',
  keywords: ['skip', 'continue', 'next pass', 'next', 'ignore'],
  settings: [{ key: 'msg', label: 'Reason', kind: 'text', default: '', noPin: true, placeholder: 'e.g. Load flow did not converge', tip: 'Shown in the log and in the Status column of the results table.' }],
  summary(s) { return s.msg ? s.msg : ''; },
  emit(cx) { return { kind: 'continue', msg: String(cx.s.msg || '').trim() || 'Skipped' }; },
});

defineBlock({
  type: 'flow.break', cat: CAT, kind: 'terminal',
  title: 'Stop the loop',
  desc: 'Ends the loop now: no more passes. The steps wired to After all passes run next.',
  keywords: ['break', 'stop loop', 'exit loop', 'end loop', 'found'],
  settings: [{ key: 'msg', label: 'Message', kind: 'text', default: '', noPin: true, placeholder: 'e.g. Limit found' }],
  summary(s) { return s.msg ? s.msg : ''; },
  emit(cx) { return { kind: 'break', msg: String(cx.s.msg || '').trim() || `${cx.label}: no more passes.` }; },
});

defineBlock({
  type: 'flow.stop', cat: CAT, kind: 'terminal',
  title: 'Stop the workflow',
  desc: 'Stops the whole workflow cleanly: changed values are put back and the tables are saved.',
  keywords: ['stop', 'end', 'exit', 'abort', 'quit'],
  settings: [{ key: 'msg', label: 'Message', kind: 'text', default: 'Stopped by the workflow', noPin: true, tip: 'Shown in the log.' }],
  summary(s) { return s.msg ? s.msg : ''; },
  emit(cx) { return { kind: 'stop', msg: String(cx.s.msg || '').trim() || 'Stopped by the workflow' }; },
});

// ---------------------------------------------------------------------------------------------
const textInputs = (template) => placeholders(template).names.map(n => ({ id: portIdFor(n), label: n, type: 'cell' }));
const valuesDict = (cx, template) => '{' + placeholders(template).names.map(n => `${cx.lit(n)}: ${cx.in(portIdFor(n))}`).join(', ') + '}';

defineBlock({
  type: 'flow.log', cat: CAT, kind: 'action',
  title: 'Print a message',
  desc: 'Writes a line to the log (screen and run.log). Put {name} in the text and wire a value into the input of that name.',
  keywords: ['print', 'log', 'message', 'show', 'debug', 'text'],
  settings: [
    { key: 'text', label: 'Message', kind: 'text', default: 'Value: {value}', tip: 'Each {name} becomes an input; {name:.2f} shows a number with 2 decimals.' },
    { key: 'level', label: 'As', kind: 'select', default: 'info', options: [['info', 'Information'], ['warn', 'Warning'], ['error', 'Error']] },
  ],
  ports(s) { return { inputs: textInputs(s.text) }; },
  summary(s) { return clip(s.text); },
  helpers: ['log'],
  emit(cx) {
    const pinnedLevel = (cx.node.pin || []).includes('level');
    const level = pinnedLevel || cx.s.level === 'warn' || cx.s.level === 'error' ? `, ${cx.val('level')}` : '';
    const p = placeholders(cx.s.text);
    if (!p.names.length) return [`log(${cx.val('text')}${level})`];
    cx.helper('text_format');
    return [`log(text_format(${cx.val('text')}, ${valuesDict(cx, cx.s.text)})${level})`];
  },
  validate(cx) {
    const p = placeholders(cx.s.text);
    if (p.bad.length) cx.error(`${cx.label}: ${p.bad[0]} is not a placeholder it can fill. Use a name in braces, such as {value}, or {{ and }} for a brace.`);
  },
});

// ---------------------------------------------------------------------------------------------
const VAR_MODES = [['set', 'Set it to the value'], ['append', 'Add the value to a list'], ['min', 'Keep the lowest'], ['max', 'Keep the highest'], ['sum', 'Add up'], ['count', 'Count (add 1)']];

defineBlock({
  type: 'var.set', cat: CAT, kind: 'action',
  title: 'Remember a value',
  desc: 'Keeps a value under a name for later steps, also across loop passes: set it, add to a list, keep the lowest or highest, add up or count.',
  keywords: ['remember', 'variable', 'store', 'save value', 'keep', 'minimum', 'maximum', 'sum', 'count', 'accumulate', 'worst'],
  inputs: [{ id: 'value', label: 'Value', type: 'any' }],
  outputs: [],
  settings: [
    { key: 'name', label: 'Name', kind: 'text', default: 'Result', suggest: 'vars', tip: 'Recall a value with the same name gives it back.' },
    { key: 'mode', label: 'How', kind: 'select', default: 'set', options: VAR_MODES },
  ],
  ports(s) {
    const t = s.mode === 'append' ? 'items' : ['min', 'max', 'sum', 'count'].includes(s.mode) ? 'num' : null;
    return {
      inputs: s.mode === 'count' ? [] : [{ id: 'value', label: 'Value', type: 'any' }],
      outputs: t ? [{ id: 'now', label: 'Now', type: t, var: 'now', tip: 'The remembered value after this step.' }] : [],
    };
  },
  summary(s) { return `${(VAR_MODES.find(m => m[0] === s.mode) || VAR_MODES[0])[1]}: ${s.name}`; },
  helpers: ['vars'],
  emit(cx) {
    const call = `var_set(${cx.val('name')}, ${cx.in('value')}, ${cx.val('mode')})`;
    cx.helper('vars');
    if (cx.ports.outputs.length && cx.used('now')) return [`${cx.out('now')} = ${call}`];
    return [call];
  },
  validate(cx) {
    if (!String(cx.s.name || '').trim()) cx.todo(`Give ${cx.label} a name.`);
  },
});

defineBlock({
  type: 'var.get', cat: CAT, kind: 'pure', volatile: true,
  title: 'Recall a value',
  desc: 'Gives back the value Remember a value kept under this name, as it is at the step that uses it.',
  keywords: ['recall', 'variable', 'get value', 'remembered', 'read value', 'where'],
  outputs: [
    { id: 'value', label: 'Value', type: 'num' },
    { id: 'where', label: 'Where', type: 'text', tip: 'For Keep the lowest / highest: the loop values of the pass that set it.' },
  ],
  settings: [
    { key: 'name', label: 'Name', kind: 'text', default: 'Result', suggest: 'vars' },
    { key: 'as', label: 'The value is', kind: 'select', default: 'num', noPin: true,
      options: [['num', 'A number'], ['text', 'A text'], ['list', 'A list of numbers'], ['items', 'A list'], ['bool', 'Yes / No'], ['any', 'Anything']] },
    { key: 'dflt', label: 'If nothing is remembered yet', kind: 'text', default: '', more: true, noPin: true, placeholder: 'Empty', tip: 'The value given while nothing has been remembered under this name.' },
  ],
  ports(s) {
    const t = ['num', 'text', 'list', 'items', 'bool', 'any'].includes(s.as) ? s.as : 'num';
    return { outputs: [{ id: 'value', label: 'Value', type: t }, { id: 'where', label: 'Where', type: 'text' }] };
  },
  summary(s) { return s.name; },
  helpers: ['vars'],
  varName(s) { return s.name; },
  emit(cx) {
    cx.helper('vars');
    const name = cx.val('name');
    const d = String(cx.s.dflt || '').trim();
    const dflt = d === '' ? '' : ', ' + cx.lit(/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(d) ? Number(d) : d);
    return { value: `var_get(${name}${dflt})`, where: `var_where(${name})` };
  },
});
