// Results and graphs (DESIGN section 9, "result"): named results tables (Add row, Save, Table
// column, Read table from file), graphs (time series, 2D, 3D, heat map, from a table, a search's
// convergence) and the time series CSV.
//
// Type ids, setting keys, select option values, list row ids and port ids are frozen handles.
//
// Tables are named and workflow-level (U4): Add row has a "Table name" and no table port; Save
// results table, Table column, Graph from results table, For each item and Read table from file
// refer to the same name (the inspector offers the names in use: `suggest: 'tables'`). Table
// names are never pinned (noPin): the loops write skip rows into a table by its name, so the
// name in the code and the one the loop uses must stay the same.
//
// "+ drop a value" (U14): Add row, Draw time series graph, Draw 2D graph and Save time series to
// CSV have one extra input `add` (marked `grow: true`). A wire on it is used as a column (or a
// curve) named after the value it comes from. The editor can turn it into a real row with the
// block's grow(settings, src) (see this file's Requests); until then the wire still works.
//
// Python helpers: base.py's table(), outputs.py's plot_* / collect_series / draw_collected /
// plot_convergence / save_series_csv; table_pick and read_table are requested for base.py (the
// tests carry them meanwhile, _audit/blocks/analysis/requested_runtime.py).

import { defineBlock } from '../core/registry.js';

const CAT = 'result';

const rowsOf = (v) => (Array.isArray(v) ? v.filter(r => r && typeof r === 'object') : []);
const pinnedKey = (cx, key) => (cx.node.pin || []).includes(key);
const numOrNone = (v) => { if (v === '' || v === null || v === undefined || typeof v === 'boolean') return null; const x = Number(String(v).replace(',', '.')); return Number.isFinite(x) ? x : null; };
const tableName = (s) => String((s && s.table) || '').trim() || 'Results';
const tableSetting = (dflt, tip) => ({ key: 'table', label: 'Table name', kind: 'text', default: dflt, suggest: 'tables', noPin: true, placeholder: dflt, tip });

// A text setting as Python: the reader's text, else `fallback` (a pinned one may be emptied in
// the .py, so it falls back there too).
function textOr(cx, key, fallback = '') {
  const v = String(cx.s[key] === undefined || cx.s[key] === null ? '' : cx.s[key]).trim();
  if (pinnedKey(cx, key)) return fallback ? `(${cx.val(key)} or ${cx.lit(fallback)})` : cx.val(key);
  return cx.lit(v || fallback);
}
// The same, or None when empty (file names, a unit the helper works out itself).
function textOrNone(cx, key) {
  const v = String(cx.s[key] === undefined || cx.s[key] === null ? '' : cx.s[key]).trim();
  if (pinnedKey(cx, key)) return `(${cx.val(key)} or None)`;
  return v ? cx.lit(v) : 'None';
}
// A graph's title: the setting, else the reader's label on the block.
const titleOf = (cx) => textOr(cx, 'title', String(cx.node.label || '').trim());

// ---------------------------------------------------------------------------------------------
// Columns and curves from wires

// Port labels that say nothing about the value, so the block's name says it instead.
const GENERIC = /^(value|values|item|result|text|list|number|yes \/ no|time series|series|curve|clean curve)$/i;

// The column name for a value wired in: "Nadir (Hz)", "Dispatch (MW)". src = { nodeLabel (the
// reader's label on the source block, '' when none), title (its block title or display name),
// first (the port is the block's first output), port: { label, id, unit } }.
export function columnName(src) {
  const port = (src && src.port) || {};
  const plab = String(port.label || port.id || '').trim();
  const own = String((src && src.nodeLabel) || '').trim();
  const title = String((src && src.title) || '').trim();
  const generic = !plab || GENERIC.test(plab);
  let name;
  if (own) name = generic || (src && src.first) ? own : `${own} ${plab}`;
  else name = generic ? (title || plab || 'Value') : plab;
  const unit = String(port.unit || '').trim();
  if (unit && !name.includes(`(${unit})`)) name += ` (${unit})`;
  return name.slice(0, 80);
}

function nextRowId(rows, prefix) {
  const used = new Set(rows.map(r => r.id));
  let k = 1;
  while (used.has(prefix + k)) k++;
  return prefix + k;
}

// grow() for the "+ drop a value" inputs: a new row named after the value, and the input id the
// wire should go to instead. Returns { key, value } (the list setting and its new rows), the
// whole new settings `s`, and `input`.
const growRows = (key, prefix, field) => (s, src) => {
  const rows = rowsOf(s[key]);
  const id = nextRowId(rows, prefix);
  const value = [...rows, { id, [field]: columnName(src) }];
  return { key, value, s: { ...s, [key]: value }, input: id };
};

// The wired rows of a list setting plus the `add` input: [{ name, expr }], names made unique.
function wiredRows(cx, key, field, fallbackWord, opts = {}) {
  const out = [];
  rowsOf(cx.s[key]).forEach((r, k) => {
    const name = String(r[field] || '').trim();
    if (!cx.has(r.id) && !opts.keepUnwired) return;
    out.push({ name: name || (opts.defaultName ? `${fallbackWord} ${k + 1}` : ''), expr: cx.has(r.id) ? cx.in(r.id) : 'None', id: r.id });
  });
  if (cx.has('add')) {
    const src = cx.src('add');
    out.push({ name: opts.nameAdd === false ? '' : columnName({ title: src ? src.label : '', port: src ? src.port : {} }), expr: cx.in('add'), id: 'add' });
  }
  return out;
}

function uniqueNames(items) {
  const seen = new Map();
  return items.map(it => {
    if (!it.name) return it;
    const k = seen.get(it.name) || 0;
    seen.set(it.name, k + 1);
    return k ? { ...it, name: `${it.name} (${k + 1})` } : it;
  });
}

const rowInputs = (s, key, field, type, word, addLabel, tip) => [
  ...rowsOf(s[key]).map((r, k) => ({ id: r.id, label: String(r[field] || '').trim() || `${word} ${k + 1}`, type })),
  { id: 'add', label: addLabel, type, grow: true, tip },
];

// Limit lines: rows { value, label } as [(value, "label"), value ...], plus extra expressions.
const limitsSetting = {
  key: 'limits', label: 'Limit lines', kind: 'list', default: [], rowPrefix: 'h', rowLabel: 'Line', addLabel: 'limit line',
  columns: [{ key: 'value', label: 'At', kind: 'number', default: '' }, { key: 'label', label: 'Label', kind: 'text', default: '' }],
  tip: 'Dashed horizontal lines with a label, for example 59 for the UFLS level of a 60 Hz grid.',
};
function limitsLit(cx, extra = []) {
  const items = rowsOf(cx.s.limits).map(r => [numOrNone(r.value), String(r.label || '').trim()]).filter(r => r[0] !== null)
    .map(([v, l]) => (l ? `(${cx.num(v)}, ${cx.lit(l)})` : cx.num(v)));
  return '[' + [...items, ...extra].join(', ') + ']';
}

const stemSetting = { key: 'stem', label: 'File name', kind: 'text', default: '', more: true, placeholder: 'From the title', tip: 'Without the extension. Inside a loop the loop values are added, so every pass gets its own file.' };
const titleSetting = { key: 'title', label: 'Title', kind: 'text', default: '', placeholder: 'The block\'s name', tip: 'Inside a loop the loop values are written under it.' };
const fileOut = (tip) => ({ id: 'file', label: 'File', type: 'text', var: 'graph_file', tip: tip || 'The PNG written (empty when there was nothing to draw).' });

// `name = call` when the file output is used, else the call alone.
function withFile(cx, call) {
  if (!cx.used('file')) return [call];
  const f = cx.out('file');
  return [`${f} = ${call}`];
}

// ---------------------------------------------------------------------------------------------
// Results tables

const addPorts = (s) => ({ inputs: rowInputs(s, 'cols', 'name', 'cell', 'Column', '+ drop a value', 'Drop a wire here to add a column named after the value (its unit too).') });

defineBlock({
  type: 'out.table.add', cat: CAT, kind: 'action',
  title: 'Add row to results table',
  desc: 'Adds one row to a results table: the loop values, then one column per value wired in. Drop a wire on "+ drop a value" to add a column. Saved at the end automatically.',
  keywords: ['add row', 'table', 'results', 'append', 'record', 'collect', 'log result', 'row', 'column', 'summary', 'CSV', 'Excel', 'report'],
  inputs: addPorts({ cols: [] }).inputs,
  settings: [
    tableSetting('Results', 'Rows with the same table name go into one table and one file. Save results table, Table column and Graph from results table use the name.'),
    { key: 'cols', label: 'Columns', kind: 'list', default: [], rowPrefix: 'c', rowLabel: 'Column', addLabel: 'column',
      columns: [{ key: 'name', label: 'Column name', kind: 'text', default: '' }],
      tip: 'Each column is an input of this block. A wire dropped on "+ drop a value" adds one named after the value; rename it here.' },
    { key: 'ctx', label: 'Start with the loop values', kind: 'bool', default: true, noPin: true,
      tip: 'Each row starts with the values of the loops around this block, for example Dispatch (MW) = 200.' },
    { key: 'onSkip', label: 'Keep skipped passes as rows', kind: 'bool', default: true, noPin: true,
      tip: 'A pass that ends before this block still gets a row, with the reason in a Status column, so failed cases do not go missing.' },
  ],
  ports: addPorts,
  grow: growRows('cols', 'c', 'name'),
  summary(s, node, wf) {
    const name = tableName(s);
    let t = `Into "${name}"`;
    if (wf && Array.isArray(wf.nodes) && !wf.nodes.some(m => m && m.type === 'out.table.save' && tableName(m.s) === name)) t += ', saved at the end automatically';
    return t;
  },
  helpers: ['table'],
  skipTable(s) { return s.onSkip ? tableName(s) : ''; },
  emit(cx) {
    cx.helper('table');
    const name = tableName(cx.s);
    const cols = uniqueNames(wiredRows(cx, 'cols', 'name', 'Column', { keepUnwired: true, defaultName: true }));
    const args = [];
    if (!cx.s.ctx) args.push('with_ctx=False');
    if (cx.s.onSkip && cx.skipTables().includes(name)) args.push('status=True');
    const tail = args.length ? ', ' + args.join(', ') : '';
    const head = `table(${cx.lit(name)}).add(`;
    if (cols.length <= 1) return [`${head}{${cols.map(c => `${cx.lit(c.name)}: ${c.expr}`).join(', ')}}${tail})`];
    return [`${head}{`, ...cols.map(c => `    ${cx.lit(c.name)}: ${c.expr},`), `}${tail})`];
  },
  validate(cx) {
    const rows = rowsOf(cx.s.cols);
    if (!rows.length && !cx.has('add')) {
      cx.warn(`${cx.label} has no columns yet, so its rows only hold the loop values. Drop a value on "+ drop a value".`);
    }
    rows.forEach((r, k) => {
      const nm = String(r.name || '').trim() || `Column ${k + 1}`;
      if (!cx.has(r.id)) cx.warn(`Column "${nm}" of ${cx.label} has no value wired in, so it stays empty. Wire a value into it, or remove the column.`);
    });
    const names = rows.map((r, k) => String(r.name || '').trim() || `Column ${k + 1}`);
    const dup = names.find((nm, i) => names.indexOf(nm) !== i);
    if (dup) cx.warn(`${cx.label} has two columns named "${dup}"; the second is written as "${dup} (2)". Give each column its own name.`);
  },
});

const FMT = [['csv', 'CSV (opens in Excel)'], ['xlsx', 'Excel (.xlsx)'], ['both', 'Both']];

defineBlock({
  type: 'out.table.save', cat: CAT, kind: 'action', oncePerRun: true,
  title: 'Save results table',
  desc: 'Writes a results table to the run folder as CSV (opens in Excel), an Excel file or both. Connect it to After all passes so it saves once.',
  keywords: ['save', 'export', 'write', 'CSV', 'Excel', 'xlsx', 'file', 'table', 'results', 'output', 'spreadsheet', 'report'],
  outputs: [fileOut('The path of the file written (the CSV when both).')],
  settings: [
    tableSetting('Results', 'The table to save, as named on Add row or Read table from file.'),
    { key: 'fmt', label: 'Save as', kind: 'select', default: 'csv', options: FMT, tip: 'Excel files need the pandas and openpyxl packages (the script checks before it starts).' },
    { ...stemSetting, placeholder: 'The table name' },
  ],
  summary(s) { return `"${tableName(s)}" as ${(FMT.find(f => f[0] === s.fmt) || FMT[0])[1].replace(' (opens in Excel)', '')}`; },
  helpers: ['table'],
  emit(cx) {
    cx.helper('table');
    if (pinnedKey(cx, 'fmt') || cx.s.fmt !== 'csv') cx.package('pandas', 'openpyxl');
    const call = `table(${cx.lit(tableName(cx.s))}).save(${textOrNone(cx, 'stem')}, ${cx.val('fmt')})`;
    if (!cx.used('file')) return [call];
    const p = cx.name('saved files');
    cx.out('file', `(${p}[0] if ${p} else "")`);
    return [`${p} = ${call}`];
  },
});

defineBlock({
  type: 'out.table.column', cat: CAT, kind: 'pure', volatile: true,
  title: 'Table column',
  desc: 'The values of one column of a results table, or its value in the row where another column is highest or lowest: the worst case, the worst line.',
  keywords: ['column', 'table', 'values', 'worst', 'worst case', 'highest', 'lowest', 'lookup', 'row', 'maximum', 'minimum', 'results', 'which case'],
  outputs: [{ id: 'value', label: 'Values', type: 'list', var: 'column' }],
  settings: [
    tableSetting('Results', 'The table to read, as named on Add row or Read table from file.'),
    { key: 'col', label: 'Column', kind: 'text', default: '', required: true, placeholder: 'e.g. Nadir (Hz)', tip: 'The column name exactly as in the table, with its unit.' },
    { key: 'pick', label: 'Give', kind: 'select', default: 'all', noPin: true,
      options: [['all', 'Every value (a list)'], ['max', 'The value in the row where a column is highest'], ['min', 'The value in the row where a column is lowest']] },
    { key: 'of', label: 'Highest / lowest of column', kind: 'text', default: '', showIf: (s) => s.pick !== 'all', placeholder: 'Empty: the column itself',
      tip: 'For example Column = Contingency and this = Loading (%) gives the contingency with the highest loading.' },
    { key: 'as', label: 'The values are', kind: 'select', default: 'num', noPin: true, options: [['num', 'Numbers'], ['text', 'Text, such as names']] },
  ],
  ports(s) {
    const text = s.as === 'text';
    if (s.pick !== 'max' && s.pick !== 'min') return { outputs: [{ id: 'value', label: 'Values', type: text ? 'items' : 'list', var: 'column', tip: 'Top to bottom; an empty cell gives an empty value, so columns of one table stay in step.' }] };
    const hi = s.pick === 'max';
    return {
      outputs: [
        { id: 'value', label: 'Value', type: text ? 'text' : 'num', var: hi ? 'at_highest' : 'at_lowest' },
        { id: 'of', label: hi ? 'Highest' : 'Lowest', type: 'num', var: hi ? 'highest' : 'lowest', tip: 'The highest (or lowest) value of the compared column.' },
      ],
    };
  },
  summary(s) {
    const c = String(s.col || '').trim() || '?';
    if (s.pick === 'max' || s.pick === 'min') return `${c} where ${String(s.of || '').trim() || c} is ${s.pick === 'max' ? 'highest' : 'lowest'}`;
    return `${c} of "${tableName(s)}"`;
  },
  helpers: ['table_pick'],
  varName(s) { return String(s.col || '').trim() || 'column'; },
  emit(cx) {
    cx.helper('table_pick');
    const name = cx.lit(tableName(cx.s));
    const col = cx.val('col');
    const kind = cx.lit(cx.s.as === 'text' ? 'text' : 'num');
    if (cx.s.pick !== 'max' && cx.s.pick !== 'min') return `table_pick(${name}, ${col}, "all", None, ${kind})`;
    const of = textOrNone(cx, 'of');
    const pick = cx.lit(cx.s.pick);
    return {
      value: `table_pick(${name}, ${col}, ${pick}, ${of}, ${kind})`,
      of: `table_pick(${name}, ${of === 'None' ? col : `${of} or ${col}`}, ${pick}, ${of}, "num")`,
    };
  },
});

defineBlock({
  type: 'data.read', cat: CAT, kind: 'action',
  title: 'Read table from file',
  desc: 'Reads a CSV file or an Excel sheet into a named table, one case per row or per column, for For each item to loop over its rows. Use it for a case workbook.',
  keywords: ['read', 'import', 'load', 'open', 'CSV', 'Excel', 'xlsx', 'spreadsheet', 'workbook', 'cases', 'case table', 'input file', 'dispatch table'],
  outputs: [
    { id: 'name', label: 'Table name', type: 'text', var: 'table_name', tip: 'The name of the table it filled.' },
    { id: 'n', label: 'Rows', type: 'num', var: 'rows_read', tip: 'How many cases were read.' },
  ],
  settings: [
    tableSetting('Cases', 'The name of the table to fill. For each item (the rows of a results table) and the other table blocks use it.'),
    { key: 'path', label: 'File', kind: 'text', default: '', required: true, pin: true, placeholder: 'e.g. C:\\Studies\\cases.xlsx',
      tip: 'A .csv, .xlsx or .xlsm file. A name without a folder is looked for next to the script. Shown at the top of the script.' },
    { key: 'sheet', label: 'Sheet', kind: 'text', default: '', placeholder: 'The first sheet', tip: 'Excel only: the sheet to read.' },
    { key: 'layout', label: 'Each case is', kind: 'select', default: 'rows',
      options: [['rows', 'A row (names in the header row)'], ['columns', 'A column (names in the first column)']] },
    { key: 'header', label: 'Names are in row', kind: 'number', default: 1, min: 1, step: 1,
      tip: 'The row with the column names, 1 for the first (for one case per column: the column with the names).' },
    { key: 'decimalComma', label: 'Numbers use a decimal comma (1,5)', kind: 'bool', default: false, more: true },
  ],
  summary(s) {
    const f = String(s.path || '').trim().split(/[\\/]/).pop();
    return f ? `${f} into "${tableName(s)}"` : 'No file yet';
  },
  helpers: ['read_table'],
  emit(cx) {
    cx.helper('read_table');
    if (/\.xls[xm]\s*$/i.test(String(cx.s.path || ''))) cx.package('openpyxl');
    const name = tableName(cx.s);
    const t = cx.name(name + ' table');
    cx.out('name', cx.lit(name));
    cx.out('n', `len(${t}.rows)`);
    return [`${t} = read_table(${cx.lit(name)}, ${cx.val('path')}, sheet=${cx.val('sheet')}, layout=${cx.val('layout')}, ` +
      `header=${cx.val('header')}, decimal_comma=${cx.val('decimalComma')})`];
  },
  validate(cx) {
    if (/\.xls\s*$/i.test(String(cx.s.path || ''))) cx.error(`${cx.label} reads ${String(cx.s.path).trim()}, an old .xls file it cannot open. Save it as .xlsx (or .csv) in Excel and use that file.`);
  },
});

// ---------------------------------------------------------------------------------------------
// Graphs

const curveSetting = (word, tip) => ({
  key: 'lines', label: `${word}s`, kind: 'list', default: [{ id: 'l1', name: '' }], rowPrefix: 'l', rowLabel: word, addLabel: word.toLowerCase(),
  columns: [{ key: 'name', label: 'Legend', kind: 'text', default: '', placeholder: 'The curve\'s own name' }], tip,
});

const seriesPortsOf = (s) => [
  ...rowInputs(s, 'lines', 'name', 'series', 'Curve', '+ drop a curve', 'Drop a time series here to add a curve.'),
  { id: 'mark', label: 'Mark', type: 'num', tip: 'Wire Nadir or Minimum of Frequency nadir (or a Peak) to mark that point; another value needs Mark time too.' },
  { id: 'mark_t', label: 'Mark time', type: 'num', unit: 's' },
  { id: 'limit', label: 'Limit line', type: 'num', tip: 'A dashed line at this value, for example a limit worked out by another block.' },
  { id: 't_event', label: 'Event time', type: 'num', unit: 's', tip: 'A dotted line at this time. The run\'s own events are drawn anyway.' },
  { id: 'note', label: 'Footnote', type: 'text', tip: 'A line under the graph, for example the Note of Remove spikes.' },
];

// The mark: a check result when the value comes straight from one (its time comes with it and
// the label says nadir or collapse), else (time, value).
const RESULT_PICKS = ['.value', '.minimum'];
function marksOf(cx) {
  if (!cx.has('mark')) return 'None';
  const ex = cx.in('mark');
  if (cx.has('mark_t')) return `[(${cx.in('mark_t')}, ${ex})]`;
  const src = cx.src('mark');
  const pick = src && src.port && src.port.pick;
  if (pick && RESULT_PICKS.includes(pick) && ex.endsWith(pick) && ex.length > pick.length) return `[${ex.slice(0, -pick.length)}]`;
  return 'None';
}

defineBlock({
  type: 'out.plot.series', cat: CAT, kind: 'action',
  title: 'Draw time series graph',
  desc: 'Draws curves over time to a PNG: one graph per pass, or every pass on one graph drawn after the loop. Marks a nadir, limit lines and the run\'s events.',
  keywords: ['graph', 'plot', 'chart', 'time series', 'curve', 'draw', 'PNG', 'picture', 'figure', 'frequency plot', 'overlay', 'every pass', 'matplotlib'],
  inputs: seriesPortsOf({ lines: [{ id: 'l1', name: '' }] }),
  outputs: [fileOut()],
  settings: [
    curveSetting('Curve', 'Each curve is an input of this block. A time series dropped on "+ drop a curve" adds one.'),
    { key: 'collect', label: 'Inside a loop', kind: 'select', default: 'pass', noPin: true,
      options: [['pass', 'One graph per pass'], ['loop', 'Every pass on one graph (drawn after the loop)']],
      tip: 'Every pass on one graph draws one curve per pass, named by its loop values, once the loop has ended.' },
    titleSetting,
    { key: 'ylabel', label: 'Y axis', kind: 'text', default: '', placeholder: 'e.g. Frequency' },
    { key: 'unit', label: 'Unit', kind: 'text', default: '', more: true, placeholder: 'The curves\' own unit' },
    limitsSetting,
    { key: 'events', label: 'Dotted lines at the run\'s events', kind: 'bool', default: true, more: true },
    stemSetting,
  ],
  ports(s) { return { inputs: seriesPortsOf(s) }; },
  grow: growRows('lines', 'l', 'name'),
  summary(s) {
    const k = rowsOf(s.lines).length;
    return (s.collect === 'loop' ? 'Every pass on one graph' : 'One graph per pass') + (k > 1 ? `, ${k} curves` : '');
  },
  helpers: ['plot_series'],
  packages: ['matplotlib'],
  emit(cx) {
    cx.helper('plot_series');
    const curves = wiredRows(cx, 'lines', 'name', 'Curve', { nameAdd: false });
    const list = `[${curves.map(c => c.expr).join(', ')}]`;
    const common = `title=${titleOf(cx)}, ylabel=${textOr(cx, 'ylabel')}, unit=${textOrNone(cx, 'unit')}`;
    const stem = textOrNone(cx, 'stem');
    if (cx.s.collect === 'loop' && cx.structure && typeof cx.afterStruct === 'function') {
      cx.helper('collect_series');
      const key = cx.lit(cx.id);
      cx.afterStruct([`draw_collected(${key}, ${common}, limits=${limitsLit(cx)}, events=${cx.val('events')}, stem=${stem})`]);
      return [`collect_series(${key}, ${list})`];
    }
    const labels = curves.some(c => c.name) ? `[${curves.map(c => (c.name ? cx.lit(c.name) : 'None')).join(', ')}]` : 'None';
    const extra = cx.has('limit') ? [cx.in('limit')] : [];
    return withFile(cx, `plot_series(${list}, labels=${labels}, ${common}, limits=${limitsLit(cx, extra)}, marks=${marksOf(cx)}, ` +
      `t_event=${cx.in('t_event')}, events=${cx.val('events')}, note=${cx.has('note') ? cx.in('note') : '""'}, stem=${stem})`);
  },
  validate(cx) {
    const any = rowsOf(cx.s.lines).some(r => cx.has(r.id)) || cx.has('add');
    if (!any) cx.todo(`Connect a time series to ${cx.label}.`);
    if (cx.has('mark') && !cx.has('mark_t')) {
      const src = cx.src('mark');
      if (!(src && src.port && RESULT_PICKS.includes(src.port.pick))) cx.warn(`${cx.label}: the Mark needs a Mark time too (or wire the Nadir of Frequency nadir, which knows its time).`);
    }
    if (cx.s.collect === 'loop' && cx.structure) {
      if (typeof cx.afterStruct !== 'function') {
        cx.warn(`${cx.label}: this version of the Builder cannot draw every pass on one graph yet, so it draws one graph per pass.`);
      } else if (['mark', 'mark_t', 'limit', 't_event', 'note'].some(id => cx.has(id))) {
        cx.warn(`${cx.label} draws every pass on one graph after the loop, so its Mark, Limit line, Event time and Footnote inputs are not used. Type limit lines in its settings instead.`);
      }
    }
  },
});

const xyPorts = (s) => [
  { id: 'x', label: 'X values', type: 'items', required: true, tip: 'Numbers, or names (one tick each, in order).' },
  ...rowInputs(s, 'lines', 'name', 'list', 'Y values', '+ drop values', 'Drop a list here to add a line.'),
];
const PLOT_KIND = [['line', 'Lines'], ['scatter', 'Points'], ['bar', 'Bars']];
const axisSettings = (axes) => axes.flatMap(([a, word]) => [
  { key: `${a}label`, label: `${word} axis`, kind: 'text', default: '' },
  { key: `${a}unit`, label: `${word} unit`, kind: 'text', default: '', more: true },
]);
const axisArgs = (cx, axes) => axes.map(([a]) => `${a}label=${textOr(cx, a + 'label')}, ${a}unit=${textOr(cx, a + 'unit')}`).join(', ');

defineBlock({
  type: 'out.plot.xy', cat: CAT, kind: 'action',
  title: 'Draw 2D graph',
  desc: 'Draws one or more lists against a list of x values (lines, points or bars) to a PNG, e.g. the nadir of every case against its dispatch.',
  keywords: ['graph', 'plot', 'chart', '2D', 'xy', 'scatter', 'bar chart', 'line chart', 'draw', 'PNG', 'against', 'matplotlib'],
  inputs: xyPorts({ lines: [{ id: 'l1', name: '' }] }),
  outputs: [fileOut()],
  settings: [
    curveSetting('Line', 'Each line is an input of this block. A list dropped on "+ drop values" adds one.'),
    { key: 'kind', label: 'Draw as', kind: 'select', default: 'line', options: PLOT_KIND },
    titleSetting,
    ...axisSettings([['x', 'X'], ['y', 'Y']]),
    limitsSetting,
    stemSetting,
  ],
  ports(s) { return { inputs: xyPorts(s) }; },
  grow: growRows('lines', 'l', 'name'),
  summary(s) { return (PLOT_KIND.find(k => k[0] === s.kind) || PLOT_KIND[0])[1]; },
  helpers: ['plot_xy'],
  packages: ['matplotlib'],
  emit(cx) {
    cx.helper('plot_xy');
    const ys = wiredRows(cx, 'lines', 'name', 'Line', {});
    const labels = ys.some(c => c.name) ? `[${ys.map(c => (c.name ? cx.lit(c.name) : 'None')).join(', ')}]` : 'None';
    return withFile(cx, `plot_xy(${cx.in('x')}, [${ys.map(c => c.expr).join(', ')}], labels=${labels}, kind=${cx.val('kind')}, title=${titleOf(cx)}, ` +
      `${axisArgs(cx, [['x'], ['y']])}, limits=${limitsLit(cx)}, stem=${textOrNone(cx, 'stem')})`);
  },
  validate(cx) {
    if (!(rowsOf(cx.s.lines).some(r => cx.has(r.id)) || cx.has('add'))) cx.todo(`Connect the Y values to ${cx.label}.`);
  },
});

const KIND3D = [['surface', 'A surface'], ['wireframe', 'A wire frame'], ['scatter', 'Points']];

defineBlock({
  type: 'out.plot.3d', cat: CAT, kind: 'action',
  title: 'Draw 3D graph',
  desc: 'Draws a value over two swept inputs as a 3D surface (or points) to a PNG, e.g. nadir over generator A and generator B dispatch from a 2-D sweep.',
  keywords: ['3D', 'surface', 'graph', 'plot', 'chart', 'mesh', 'wireframe', 'two sweeps', '2-D sweep', 'draw', 'PNG', 'matplotlib'],
  inputs: [
    { id: 'x', label: 'X values', type: 'list', required: true, tip: 'One value per point, for example Table column of the first loop\'s values.' },
    { id: 'y', label: 'Y values', type: 'list', required: true },
    { id: 'z', label: 'Heights', type: 'list', required: true, tip: 'The value drawn over x and y, one per point.' },
  ],
  outputs: [fileOut()],
  settings: [
    { key: 'kind', label: 'Draw as', kind: 'select', default: 'surface', options: KIND3D, tip: 'A surface needs a value at every x and y of a grid; otherwise points are drawn.' },
    titleSetting,
    ...axisSettings([['x', 'X'], ['y', 'Y'], ['z', 'Height']]),
    stemSetting,
  ],
  summary(s) { return (KIND3D.find(k => k[0] === s.kind) || KIND3D[0])[1]; },
  helpers: ['plot_3d'],
  packages: ['matplotlib'],
  emit(cx) {
    cx.helper('plot_3d');
    return withFile(cx, `plot_3d(${cx.in('x')}, ${cx.in('y')}, ${cx.in('z')}, kind=${cx.val('kind')}, title=${titleOf(cx)}, ` +
      `${axisArgs(cx, [['x'], ['y'], ['z']])}, stem=${textOrNone(cx, 'stem')})`);
  },
});

const ANNOTATE = [['auto', 'When there are few cells'], ['yes', 'Always'], ['no', 'Never']];

defineBlock({
  type: 'out.plot.heatmap', cat: CAT, kind: 'action',
  title: 'Draw heat map',
  desc: 'Draws a value over two inputs as coloured cells to a PNG, with the values written in, e.g. line loading per contingency and line.',
  keywords: ['heat map', 'heatmap', 'grid', 'matrix', 'colour map', 'cells', 'graph', 'chart', 'plot', 'draw', 'PNG', 'matplotlib'],
  inputs: [
    { id: 'x', label: 'X values', type: 'items', required: true, tip: 'Numbers or names, one per point.' },
    { id: 'y', label: 'Y values', type: 'items', required: true },
    { id: 'z', label: 'Values', type: 'list', required: true, tip: 'The value of each cell, one per point (several at one cell are averaged).' },
  ],
  outputs: [fileOut()],
  settings: [
    titleSetting,
    ...axisSettings([['x', 'X'], ['y', 'Y'], ['z', 'Colour']]),
    { key: 'annotate', label: 'Write the values in the cells', kind: 'select', default: 'auto', noPin: true, more: true, options: ANNOTATE },
    stemSetting,
  ],
  summary(s) { return String(s.zlabel || '').trim() || 'Heat map'; },
  helpers: ['plot_heatmap'],
  packages: ['matplotlib'],
  emit(cx) {
    cx.helper('plot_heatmap');
    const ann = { auto: 'None', yes: 'True', no: 'False' }[cx.s.annotate] || 'None';
    return withFile(cx, `plot_heatmap(${cx.in('x')}, ${cx.in('y')}, ${cx.in('z')}, title=${titleOf(cx)}, ` +
      `${axisArgs(cx, [['x'], ['y'], ['z']])}, stem=${textOrNone(cx, 'stem')}, annotate=${ann})`);
  },
});

// "Nadir (Hz), RoCoF (Hz/s)" or one per line -> ["Nadir (Hz)", "RoCoF (Hz/s)"]
export function columnList(text) {
  const t = String(text === undefined || text === null ? '' : text);
  const lines = t.split(/\r\n|\n|\r/).map(x => x.trim()).filter(Boolean);
  const parts = lines.length > 1 ? lines : (lines[0] || '').split(/[;,]/).map(x => x.trim());
  return parts.filter(Boolean);
}

defineBlock({
  type: 'out.plot.table', cat: CAT, kind: 'action', oncePerRun: true,
  title: 'Draw graph from results table',
  desc: 'Draws columns of a results table against another column to a PNG, e.g. Nadir (Hz) against Dispatch (MW), one line per study case. Connect it after the loop.',
  keywords: ['graph', 'plot', 'chart', 'table', 'results', 'column', 'against', 'summary graph', 'draw', 'PNG', 'sweep', 'matplotlib'],
  outputs: [fileOut()],
  settings: [
    tableSetting('Results', 'The table to draw, as named on Add row.'),
    { key: 'x', label: 'X axis column', kind: 'text', default: '', required: true, placeholder: 'e.g. Dispatch (MW)' },
    { key: 'ys', label: 'Columns to draw', kind: 'textarea', default: '', required: true, noPin: true, placeholder: 'e.g. Nadir (Hz)', tip: 'One per line, or separated by commas. Names exactly as in the table, with units.' },
    { key: 'kind', label: 'Draw as', kind: 'select', default: 'line', options: PLOT_KIND },
    { key: 'group', label: 'One line per value of column', kind: 'text', default: '', more: true, placeholder: 'e.g. Study case' },
    titleSetting,
    { key: 'ylabel', label: 'Y axis', kind: 'text', default: '', placeholder: 'The column\'s name' },
    { key: 'yunit', label: 'Y unit', kind: 'text', default: '', more: true },
    limitsSetting,
    stemSetting,
  ],
  summary(s) {
    const ys = columnList(s.ys);
    return ys.length ? `${ys.join(', ').slice(0, 40)} against ${String(s.x || '').trim() || '?'}` : 'No columns yet';
  },
  helpers: ['plot_table'],
  packages: ['matplotlib'],
  emit(cx) {
    cx.helper('plot_table');
    return withFile(cx, `plot_table(${cx.lit(tableName(cx.s))}, ${cx.val('x')}, ${cx.lit(columnList(cx.s.ys))}, kind=${cx.val('kind')}, ` +
      `group=${textOrNone(cx, 'group')}, title=${titleOf(cx)}, ylabel=${textOr(cx, 'ylabel')}, yunit=${textOr(cx, 'yunit')}, ` +
      `limits=${limitsLit(cx)}, stem=${textOrNone(cx, 'stem')})`);
  },
});

defineBlock({
  type: 'out.plot.conv', cat: CAT, kind: 'action',
  title: 'Draw convergence curve',
  desc: 'Draws how Optimise or Find limit went to a PNG: the score of every try and the best so far, or each value tried with the bracket narrowing in.',
  keywords: ['convergence', 'search', 'history', 'bisection', 'optimise', 'find limit', 'tries', 'graph', 'chart', 'plot', 'PNG', 'matplotlib'],
  inputs: [{ id: 'history', label: 'History', type: 'hist', required: true, tip: 'The History output of Optimise or Find limit (After the search).' }],
  outputs: [fileOut()],
  settings: [
    titleSetting,
    { key: 'ylabel', label: 'Y axis', kind: 'text', default: '', placeholder: 'Score, or the value searched' },
    { key: 'unit', label: 'Unit', kind: 'text', default: '', more: true },
    { key: 'kind', label: 'The search is', kind: 'select', default: 'auto', more: true, options: [['auto', 'Found from the history'], ['optimise', 'Optimise'], ['limit', 'Find limit']] },
    stemSetting,
  ],
  summary() { return 'Every try of the search'; },
  helpers: ['plot_convergence'],
  packages: ['matplotlib'],
  emit(cx) {
    cx.helper('plot_convergence');
    return withFile(cx, `plot_convergence(${cx.in('history')}, kind=${cx.val('kind')}, title=${titleOf(cx)}, ylabel=${textOr(cx, 'ylabel')}, ` +
      `unit=${textOr(cx, 'unit')}, stem=${textOrNone(cx, 'stem')})`);
  },
});

defineBlock({
  type: 'out.series.save', cat: CAT, kind: 'action',
  title: 'Save time series to CSV',
  desc: 'Writes curves to a CSV file in the run folder (one time column, one column per curve) to open in Excel or another tool. Inside a loop: one file per pass.',
  keywords: ['save', 'export', 'CSV', 'Excel', 'time series', 'curve', 'trace', 'samples', 'write', 'file', 'data'],
  inputs: rowInputs({ lines: [{ id: 'l1', name: '' }] }, 'lines', 'name', 'series', 'Curve', '+ drop a curve', 'Drop a time series here to add a column.'),
  outputs: [fileOut('The CSV written (empty when there was nothing to write).')],
  settings: [
    curveSetting('Curve', 'Each curve is an input of this block. A time series dropped on "+ drop a curve" adds one.'),
    { ...stemSetting, placeholder: 'time_series' },
  ],
  ports(s) { return { inputs: rowInputs(s, 'lines', 'name', 'series', 'Curve', '+ drop a curve', 'Drop a time series here to add a column.') }; },
  grow: growRows('lines', 'l', 'name'),
  summary(s) { const k = rowsOf(s.lines).length; return `${k} curve${k === 1 ? '' : 's'}`; },
  helpers: ['save_series_csv'],
  emit(cx) {
    cx.helper('save_series_csv');
    const curves = wiredRows(cx, 'lines', 'name', 'Curve', { nameAdd: false });
    const labels = curves.some(c => c.name) ? `[${curves.map(c => (c.name ? cx.lit(c.name) : 'None')).join(', ')}]` : 'None';
    return withFile(cx, `save_series_csv([${curves.map(c => c.expr).join(', ')}], labels=${labels}, stem=${textOrNone(cx, 'stem')})`);
  },
  validate(cx) {
    if (!(rowsOf(cx.s.lines).some(r => cx.has(r.id)) || cx.has('add'))) cx.todo(`Connect a time series to ${cx.label}.`);
  },
});
