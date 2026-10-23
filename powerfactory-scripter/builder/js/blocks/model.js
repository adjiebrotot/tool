// PowerFactory: cases and data (DESIGN section 9, "model"): elements, attributes, dispatch,
// service, study cases, operation scenarios, variations and the test generator.
//
// Type ids, setting keys, select option values, list row ids and port ids are frozen handles
// (saved in every workflow and .py); change titles, labels, descriptions and tips freely.
//
// Every runtime helper called here is described in runtime/API-pf.md (pf_core.py, pf_model.py).
// study.js imports the shared pieces below (element settings, loop settings, the route notes).

import { defineBlock } from '../core/registry.js';

const CAT = 'model';

// ---------------------------------------------------------------------------------------------
// Shared pieces

export const GEN_KINDS = ['ElmSym', 'ElmGenstat', 'ElmPvsys', 'ElmAsm', 'ElmVsc'];
const EXAMPLE = { ElmSym: 'G 02', ElmGenstat: 'PV 1', ElmTerm: 'Bus 5', ElmLne: 'Line 5-7', ElmLod: 'Load A', ElmTr2: 'T1', ElmDsl: 'AVR 1' };

// The inline element picker an obj input falls back to while it is not wired (U7).
export function elementSetting(key, label, cls, o = {}) {
  const st = {
    key, label, kind: 'element', default: { cls, name: '', match: o.match || 'one' },
    placeholder: 'Exactly as in the Data Manager, e.g. ' + (o.example || EXAMPLE[cls] || 'G 02'),
    tip: o.tip || 'Used while nothing is wired in. Letter case counts; * matches anything (then choose first or all).',
  };
  if (o.more) st.more = true;
  if (o.showIf) st.showIf = o.showIf;
  return st;
}

export const objInput = (id, label, fallback, kinds, tip) => {
  const p = { id, label, type: 'obj', fallback };
  if (kinds) p.kinds = kinds;
  if (tip) p.tip = tip;
  return p;
};
export const numInput = (id, label, fallback, unit, tip) => {
  const p = { id, label, type: 'num', fallback };
  if (unit) p.unit = unit;
  if (tip) p.tip = tip;
  return p;
};

// "Bus 5", "all Bus* (ElmTerm)", "first G* (ElmSym)" for summaries. No name: "the element"
// (it may be wired in; the Problems list says when it is missing).
export function elemText(v, what) {
  const e = v && typeof v === 'object' ? v : {};
  const name = String(e.name || '').trim();
  if (!name) return what || 'the element';
  const m = e.match === 'all' ? 'all ' : e.match === 'first' ? 'first ' : '';
  return m || /[*?]/.test(name) ? `${m}${name} (${e.cls || '?'})` : name;
}

// Loops share these three settings with flow.js (same keys and option values).
export const nameSetting = (fallback) => ({
  key: 'name', label: 'Name (table column and file names)', kind: 'text', default: '', placeholder: `The block's name, or ${fallback}`,
  tip: `What each pass is called: the column in results tables, part of file names and the log label. Empty: the block's name, or "${fallback}".`,
});
export const restoreSetting = {
  key: 'restore', label: 'After each pass', kind: 'select', default: 'pass', more: true, noPin: true,
  options: [['pass', 'Put the model back (every pass starts from the same model)'], ['end', 'Put the model back after the last pass'], ['never', 'Keep the changes']],
  tip: 'What happens to values the steps changed. By default each pass starts from the same model.',
};
export const onErrorSetting = {
  key: 'onError', label: 'If a pass fails', kind: 'select', default: 'skip', more: true, noPin: true,
  options: [['skip', 'Note it and go on with the next pass'], ['stop', 'Stop the workflow']],
  tip: 'A pass fails when a step raises an error. It is noted in the log and in the results table either way.',
};
export const passLabel = (cx, fallback) => cx.lit(String(cx.s.name || '').trim() || String(cx.node.label || '').trim() || fallback);
export const listName = (cx, what) => cx.name((String(cx.node.label || '').trim() ? cx.label + ' ' : '') + what);
export const pinned = (cx, key) => Array.isArray(cx.node.pin) && cx.node.pin.includes(key);

// A select whose value `none` means "leave it to PowerFactory" (None in Python).
export function noneOr(cx, key, noneValue = 'none') {
  if (pinned(cx, key)) { const v = cx.val(key); return `(None if ${v} in ("", ${cx.lit(noneValue)}) else ${v})`; }
  const v = cx.s[key];
  return v === noneValue || v === '' || v === undefined ? 'None' : cx.lit(String(v));
}

export const UNIT_OPTIONS = [
  ['none', 'As the project shows it'], ['MW', 'MW'], ['kW', 'kW'], ['Mvar', 'Mvar'], ['kvar', 'kvar'], ['MVA', 'MVA'],
  ['kV', 'kV'], ['kA', 'kA'], ['A', 'A'], ['s', 's'], ['ms', 'ms'],
];

// Attributes an operation scenario holds (dispatch, service, set points, taps, switch states):
// written with no scenario active they change the network data every study case uses (E1).
export const OPERATIONAL = new Set(['outserv', 'pgini', 'qgini', 'plini', 'qlini', 'slini', 'coslini', 'scale0', 'usetp',
  'psetp', 'qsetp', 'nntap', 'av_mode', 'ip_ctrl', 'on_off', 'ncapx', 'cosgini', 'pgini_a', 'Pmax_uc', 'Pmin_uc', 'q_min', 'q_max',
  'iopt_lim', 'mode_inp', 'phiini', 'i_cap']);

// How Read attribute's summary names the calculation it reads (E5).
export const CALC_WORDS = { 'pf.ldf': 'load flow results', 'pf.rms': 'end of the RMS run', 'pf.emt': 'end of the EMT run', 'pf.shc': 'short-circuit results', 'pf.hldf': 'harmonic load flow results' };

const isResultAttr = (a) => /^(m|c|s|n|r|b):/.test(String(a || '').trim());

// ---------------------------------------------------------------------------------------------
// What came before on the route.
//
// The generator shows a block nothing of the steps before it, but it writes the steps of a
// route in route order (a loop's line before its passes, the passes before After all passes)
// and calls every validate() after it has written all of them. So the blocks of this file and
// study.js keep notes while they are written and turn them into problems in validate(). A new
// run of the generator is told apart by the ports object it passes each block (made new on every
// run) and by validate() having been called since. Used for the operation scenario warning (E1),
// an unbalanced fault before a simulation with a balanced network (E15) and the calculation that
// Read attribute reads (E5).
// Limits (the core is asked for a route view that removes both): branches are taken in the order
// they are written, so a route that ends without a simulation passes its fault on to the next
// branch; and a loop of another category that comes right after one of these loops (on its After
// all passes route) is taken to be inside it.

const R = { phase: '', ports: new Map(), cur: null, stack: [], notes: new Map(), last: new Map() };
const freshState = () => ({ scen: 'unknown', caseBy: null, calc: null, faults: [] });
const copyState = (st) => ({ ...st, faults: st.faults.slice() });
const findLast = (arr, fn) => { for (let k = arr.length - 1; k >= 0; k--) if (fn(arr[k])) return k; return -1; };

function resetNotes() { R.phase = 'emit'; R.ports = new Map(); R.cur = freshState(); R.stack = []; R.notes = new Map(); }

function popTo(n) {
  while (R.stack.length > n) {
    const e = R.stack.pop();
    // Loops put the study case and scenario back after them; the events and the last calculation
    // stay what the passes left.
    if (e.restore) R.cur = { ...copyState(e.saved), calc: R.cur.calc, faults: R.cur.faults };
  }
}

// The route state where this block is written (call it first in emit, before cx.in()).
export function routeAt(cx) {
  const seen = R.ports.get(cx.id);
  if (R.phase !== 'emit' || (seen !== undefined && seen !== cx.ports)) resetNotes();
  R.ports.set(cx.id, cx.ports);
  const M = cx.loopId === undefined ? null : cx.loopId;
  let k = findLast(R.stack, e => e.id === M);
  if (k >= 0) popTo(k + 1);
  else if ((k = findLast(R.stack, e => e.enclosing === M)) >= 0) popTo(k);
  else if (M === null) popTo(0);
  else R.stack.push({ id: M, enclosing: R.stack.length ? R.stack[R.stack.length - 1].id : null, saved: copyState(R.cur), restore: true });
  return R.cur;
}

// A loop of these files opens its passes (call it at the END of the loop's emit). Returns the
// state its passes start from. `flags` are kept with the loop for the steps of its passes
// (inLoopWith).
export function enterLoop(cx, restore = true, flags = {}) {
  R.stack.push({ ...flags, id: cx.id, enclosing: cx.loopId === undefined ? null : cx.loopId, saved: copyState(R.cur), restore });
  return R.cur;
}

// Is the step being written inside a loop of these files that set this flag (call routeAt first)?
export function inLoopWith(flag) {
  return R.stack.some(e => e[flag]);
}

export function noteFor(cx) {
  if (!R.notes.has(cx.id)) R.notes.set(cx.id, {});
  return R.notes.get(cx.id);
}

// In validate(): the notes this block left in this run of the generator (null when it was not
// written in this run).
export function notesOf(cx) {
  R.phase = 'validate';
  return R.ports.get(cx.id) === cx.ports ? (R.notes.get(cx.id) || {}) : null;
}

// For summaries: the calculation the steps before have run (null: none known).
export function lastCalcFor(node) {
  if (R.phase === 'emit' && R.cur) return R.cur.calc;
  return R.last.get(node && node.id) || null;
}
export function rememberCalc(cx, calc) { R.last.set(cx.id, calc); }

// A calculation block was written here.
export function noteCalc(cx, type) {
  const st = routeAt(cx);
  st.calc = { type, label: cx.label, id: cx.id };
  return st;
}

// An operating-data write (dispatch, service, set point): warn when no scenario is active.
function noteOperational(cx, force) {
  const st = routeAt(cx);
  if (force && st.scen === 'none') noteFor(cx).e1 = st.caseBy;
  return st;
}
function warnE1(cx) {
  const n = notesOf(cx);
  if (!n || !n.e1) return;
  const by = n.e1;
  const fix = `Add Activate operation scenario or Create operation scenario after ${by.label}, or let Create study case make one.`;
  if (by.sure) {
    cx.warn(`${cx.label} changes operating data while no operation scenario is active (after ${by.label}), so the change goes into the network data that every study case uses. ${fix}`);
  } else {
    cx.warn(`${cx.label} changes operating data after ${by.label} with no operation scenario made or activated by the workflow: unless that study case has its own scenario, the change goes into the network data every study case uses. ${fix}`);
  }
}
// A study case switch: the case's own scenario (if any) comes with it, so "none" is not sure.
const caseSwitch = (st, cx, sure = false) => { st.scen = 'none'; st.caseBy = { label: cx.label, sure }; };

// ---------------------------------------------------------------------------------------------
// Elements

// Elements are found again before every step that uses them (volatile: true). 'case' (again only
// after a study case, scenario or variation switch) would be enough, but the generator does not
// yet count a loop's own switch (For each study case) as one, so an element found before such a
// loop would be reused in every case (see Requests; switch back to 'case' once it does).
defineBlock({
  type: 'pf.element', cat: CAT, kind: 'pure', volatile: true,
  title: 'Element',
  desc: 'Finds a PowerFactory element by class and name, or every match of a name with *. Found again after a study case, scenario or variation switch.',
  keywords: ['element', 'find', 'object', 'generator', 'bus', 'busbar', 'line', 'load', 'all buses', 'all lines', 'ElmSym', 'ElmTerm', 'ElmLne', 'ElmLod', 'GetCalcRelevantObjects', 'pick'],
  outputs: [{ id: 'el', label: 'Element', type: 'obj', var: 'element' }],
  settings: [
    elementSetting('el', 'Element', 'ElmTerm', { tip: 'The class and the name, exactly as in the Data Manager. Letter case counts; * matches anything (choose all to get every match).' }),
    { key: 'inService', label: 'Only elements in service', kind: 'bool', default: true,
      tip: 'Leave out elements that are out of service (a name that matches only those then stops with a message).' },
  ],
  ports(s) {
    const all = s.el && s.el.match === 'all';
    return { outputs: [{ id: 'el', label: all ? 'Elements' : 'Element', type: 'obj', var: all ? 'elements' : 'element' }] };
  },
  summary(s) { return elemText(s.el, 'No element chosen yet') + (s.inService ? '' : ', also out of service'); },
  varName(s) {
    const e = s.el || {};
    const name = String(e.name || '').trim();
    if (!name || /[*?]/.test(name) || e.match === 'all') return `${e.cls || 'element'} list`;
    return name;
  },
  helpers: ['pf_find'],
  emit(cx) {
    routeAt(cx);
    const e = cx.element('el');
    return withInService(cx, e);
  },
  validate(cx) { notesOf(cx); },
});

// pf_find(...) with in_service=True when "Only elements in service" is on (or pinned, so the
// SETTINGS line decides).
function withInService(cx, e) {
  if (e === 'None' || !/\)$/.test(e)) return e;
  if (pinned(cx, 'inService')) return e.replace(/\)$/, `, in_service=${cx.val('inService')})`);
  return cx.s.inService ? e.replace(/\)$/, ', in_service=True)') : e;
}

// The elements a For each element loop goes over.
function elementList(cx) {
  if (cx.has('items')) { cx.helper('convert'); return `as_items(${cx.in('items')})`; }
  const s = cx.s;
  const attr = String(s.attr || '').trim();
  const el = s.el && typeof s.el === 'object' ? s.el : {};
  if (attr || pinned(cx, 'attr')) {
    cx.helper('find_elements');
    const name = pinned(cx, 'el') ? cx.val('el') : cx.lit(String(el.name || '').trim() || '*');
    // find_elements compares a number attribute with float(value), so the text goes as it is.
    return `find_elements(app, ${cx.lit(String(el.cls || 'ElmTerm'))}, ${name}, ${pinned(cx, 'attr') ? `${cx.val('attr')} or None` : cx.val('attr')}, ${cx.val('op')}, ${cx.val('value')}, ${cx.val('inService')})`;
  }
  cx.helper('convert');
  const e = cx.element('el');
  if (e === 'None') return '[]';
  return `as_items(${withInService(cx, e)})`;
}

defineBlock({
  type: 'pf.foreach_element', cat: CAT, kind: 'loop',
  title: 'For each element',
  desc: 'Repeats the Each pass steps for every element of a class whose name matches (sorted by name), or for each element of a list wired in.',
  keywords: ['for each', 'loop', 'elements', 'every bus', 'every generator', 'all lines', 'iterate', 'ElmTerm', 'ElmSym', 'ElmLne', 'filter'],
  inputs: [{ id: 'items', label: 'Elements', type: 'obj', tip: 'Optional: loop over these elements instead of searching by name.' }],
  outputs: [
    { id: 'item', label: 'Element', type: 'obj', scope: 'body', var: 'element', tip: 'The element of this pass.' },
    { id: 'elname', label: 'Name', type: 'text', scope: 'body', var: 'element_name' },
    { id: 'index', label: 'Pass no.', type: 'num', scope: 'body', var: 'pass_no', tip: 'The pass number, 1 for the first pass.' },
    { id: 'count', label: 'Number of passes', type: 'num', scope: 'done', var: 'passes' },
  ],
  settings: [
    nameSetting('Element'),
    elementSetting('el', 'Elements', 'ElmTerm', { match: 'all', tip: 'The class and a name with * (for example Bus* or *). Used while nothing is wired into Elements.' }),
    { key: 'inService', label: 'Only elements in service', kind: 'bool', default: true },
    { key: 'attr', label: 'Only where this attribute', kind: 'attr', default: '', more: true, placeholder: 'e.g. uknom', tip: 'Leave empty to use every match. With an attribute, only elements whose value compares as set below.' },
    { key: 'op', label: 'Compares', kind: 'select', default: '=', more: true, options: [['=', '='], ['!=', '≠'], ['>', '>'], ['>=', '≥'], ['<', '<'], ['<=', '≤']] },
    { key: 'value', label: 'With', kind: 'text', default: '', more: true, placeholder: 'e.g. 230', tip: 'A number, or a text (with * as a pattern).' },
    restoreSetting, onErrorSetting,
  ],
  summary(s) { return 'Each of ' + elemText({ ...(s.el || {}), match: 'all' }) + (String(s.attr || '').trim() ? ` where ${s.attr} ${s.op} ${s.value}` : ''); },
  helpers: ['pf_find', 'convert'],
  itemOutput: 'item',
  itemList(cx) { return elementList(cx); },
  emit(cx) {
    routeAt(cx);
    const lst = listName(cx, 'elements');
    const i = cx.out('index');
    const it = cx.out('item');
    cx.out('elname', `${it}.loc_name`);
    cx.out('count', `len(${lst})`);
    cx.helper('log');
    const lines = [`${lst} = ${elementList(cx)}`, `if not ${lst}:`, `    log(${cx.lit(cx.label + ': no element to loop over.')}, "warn")`];
    enterLoop(cx, cx.s.restore !== 'never');
    return { lines, header: `for ${i}, ${it} in enumerate(${lst}, 1):`, iter: { i, n: `len(${lst})` }, ctx: [passLabel(cx, 'Element'), it] };
  },
  validate(cx) {
    notesOf(cx);
    if (!cx.has('items') && !String((cx.s.el || {}).name || '').trim()) cx.todo(`Type the element names for ${cx.label} (for example * for all), or wire a list into Elements.`);
  },
});

// ---------------------------------------------------------------------------------------------
// Attributes

defineBlock({
  type: 'pf.set', cat: CAT, kind: 'action',
  title: 'Set attribute',
  desc: 'Writes one attribute of an element (or of each element of a list), such as a tap position or a set point. Put back at the end of the pass or the workflow.',
  keywords: ['set', 'write', 'attribute', 'parameter', 'change', 'SetAttribute', 'set point', 'tap', 'nntap', 'usetp', 'plini', 'value'],
  inputs: [objInput('obj', 'Element', 'el'), { id: 'value', label: 'Value', type: 'num', fallback: 'value' }],
  settings: [
    elementSetting('el', 'Element', 'ElmLod'),
    { key: 'attr', label: 'Attribute', kind: 'attr', default: '', required: true, placeholder: 'e.g. plini', tip: 'The attribute name as PowerFactory shows it (hover a field in an element dialog), for example plini or nntap.' },
    { key: 'vtype', label: 'The value is', kind: 'select', default: 'num', noPin: true, options: [['num', 'A number'], ['text', 'A text']] },
    { key: 'value', label: 'Value', kind: 'number', default: 0, showIf: (s) => s.vtype !== 'text' },
    { key: 'text', label: 'Value', kind: 'text', default: '', showIf: (s) => s.vtype === 'text' },
    { key: 'unit', label: 'Unit of the value', kind: 'select', default: 'none', more: true, options: UNIT_OPTIONS,
      tip: 'The value is converted to the unit this project shows for the attribute (for example kW or ms).' },
  ],
  ports(s) {
    return { inputs: [objInput('obj', 'Element', 'el'), s.vtype === 'text' ? { id: 'value', label: 'Value', type: 'text', fallback: 'text' } : { id: 'value', label: 'Value', type: 'num', fallback: 'value' }] };
  },
  summary(s) {
    const v = s.vtype === 'text' ? `"${s.text}"` : `${s.value}${s.unit !== 'none' ? ' ' + s.unit : ''}`;
    return `${elemText(s.el)}.${s.attr || '?'} = ${v}`;
  },
  helpers: ['pf_set'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    noteOperational(cx, OPERATIONAL.has(String(cx.s.attr || '').trim().replace(/^e:/, '')));
    cx.helper('pf_set');
    return [`pf_set(${cx.in('obj')}, ${cx.val('attr')}, ${cx.in('value')}, ${noneOr(cx, 'unit')})`];
  },
  validate(cx) { warnE1(cx); },
});

defineBlock({
  type: 'pf.get', cat: CAT, kind: 'action',
  title: 'Read attribute',
  desc: 'Reads an attribute or a result (m:u, c:loading ...) of an element or a list of elements, at this step. For a list it also gives the highest, the lowest and where.',
  keywords: ['read', 'get', 'attribute', 'result', 'GetAttribute', 'voltage', 'loading', 'm:u', 'c:loading', 'm:P:bus1', 'm:Ikss', 'max', 'min', 'worst', 'all buses'],
  inputs: [objInput('obj', 'Element', 'el', null, 'One element or a list (for example Element with all).')],
  outputs: [
    { id: 'value', label: 'Value', type: 'num', var: 'value', tip: 'The value (of the first element for a list).' },
    { id: 'max', label: 'Highest', type: 'num', var: 'highest' },
    { id: 'min', label: 'Lowest', type: 'num', var: 'lowest' },
    { id: 'at_max', label: 'Where highest', type: 'obj', var: 'at_highest', tip: 'The element with the highest value.' },
    { id: 'at_min', label: 'Where lowest', type: 'obj', var: 'at_lowest', tip: 'The element with the lowest value.' },
    { id: 'values', label: 'All values', type: 'list', var: 'values' },
    { id: 'n', label: 'How many', type: 'num', var: 'count' },
  ],
  settings: [
    elementSetting('el', 'Element', 'ElmTerm'),
    { key: 'attr', label: 'Attribute', kind: 'attr', default: 'm:u', required: true, placeholder: 'e.g. m:u',
      tip: 'A result (m:u voltage, c:loading, m:P:bus1, m:Ikss ...) or element data (pgini, outserv ...). Results are those of the last calculation before this step.' },
    { key: 'unit', label: 'Unit', kind: 'select', default: 'none', more: true, options: UNIT_OPTIONS,
      tip: 'Convert from the unit this project shows (for example kW) to this one.' },
    { key: 'total', label: 'Total of the parallel machines (x ngnum)', kind: 'bool', default: false, more: true,
      tip: 'pgini, P_max and the like are per machine; this multiplies by the number of parallel machines.' },
    { key: 'skip', label: 'Leave out elements out of service or not energised', kind: 'bool', default: true, more: true,
      tip: 'So an island or an outage does not show up as a 0 p.u. voltage.' },
  ],
  summary(s, node) {
    const a = String(s.attr || '?');
    let from = '';
    if (isResultAttr(a)) {
      const c = lastCalcFor(node);
      from = c ? ` (${CALC_WORDS[c.type] || c.label})` : ' (results of the last calculation)';
    }
    return `${a} of ${elemText(s.el)}${from}`;
  },
  effects(s) { return isResultAttr(s.attr) ? { writes: [], reads: ['results'] } : { writes: [], reads: ['model'] }; },
  helpers: ['pf_get'],
  emit(cx) {
    const st = routeAt(cx);
    noteFor(cx).calc = st.calc;
    rememberCalc(cx, st.calc);
    cx.helper('pf_get');
    const rd = cx.name(cx.label === 'Read attribute' ? 'reading' : cx.label);
    for (const [id, pick] of [['value', 'value'], ['max', 'max'], ['min', 'min'], ['at_max', 'at_max'], ['at_min', 'at_min'], ['values', 'values'], ['n', 'n']]) cx.out(id, `${rd}.${pick}`);
    return [`${rd} = pf_get_all(${cx.in('obj')}, ${cx.val('attr')}, ${noneOr(cx, 'unit')}, ${cx.val('total')}, ${cx.val('skip')})`];
  },
  validate(cx) {
    const n = notesOf(cx);
    const a = String(cx.s.attr || '').trim();
    if (n && n.calc && /^m:/.test(a) && (n.calc.type === 'pf.rms' || n.calc.type === 'pf.emt')) {
      cx.warn(`${cx.label} reads ${a} after ${n.calc.label}, so it gets the value at the end of the simulation, not a load flow value. To read the load flow value, put it before the simulation or run a load flow first.`);
    }
  },
});


// ---------------------------------------------------------------------------------------------
// Dispatch, scaling, service

// The generator a row of the table-row dispatch names: "Name.Class" (no name: the column name).
function rowGenQuery(r) {
  const g = r && r.gen && typeof r.gen === 'object' ? r.gen : { name: typeof (r && r.gen) === 'string' ? r.gen : '' };
  const cls = String(g.cls || (r && r.cls) || 'ElmSym');
  const name = String(g.name || '').trim() || String((r && r.col) || '').trim();
  return name.toLowerCase().endsWith('.' + cls.toLowerCase()) ? name : `${name}.${cls}`;
}

const BASIS = { key: 'basis', label: 'Power is for', kind: 'select', default: 'total', options: [['total', 'The whole unit (all parallel machines)'], ['machine', 'One machine']],
  tip: 'PowerFactory stores the dispatch per machine; "the whole unit" divides by the number of parallel machines (ngnum).' };

defineBlock({
  type: 'pf.dispatch', cat: CAT, kind: 'action',
  title: 'Set generator dispatch',
  desc: 'Sets the active power (and reactive power) of a generator and puts it in service, or dispatches several generators from one row of a case table.',
  keywords: ['dispatch', 'generator', 'active power', 'reactive power', 'P', 'Q', 'MW', 'Mvar', 'pgini', 'qgini', 'redispatch', 'set point', 'ngnum', 'case table', 'ElmSym', 'ElmGenstat'],
  inputs: [objInput('gen', 'Generator', 'gen', GEN_KINDS), numInput('p', 'Active power', 'p', 'MW'), numInput('q', 'Reactive power', 'q', 'Mvar')],
  settings: [
    { key: 'mode', label: 'Dispatch', kind: 'select', default: 'one', noPin: true, options: [['one', 'One generator'], ['row', 'Several generators from a table row']] },
    elementSetting('gen', 'Generator', 'ElmSym', { showIf: (s) => s.mode !== 'row' }),
    { key: 'p', label: 'Active power', kind: 'number', default: 100, unit: 'MW', showIf: (s) => s.mode !== 'row' },
    { key: 'q', label: 'Reactive power', kind: 'number', default: null, unit: 'Mvar', placeholder: 'Keep as it is', showIf: (s) => s.mode !== 'row',
      tip: 'Leave empty to keep the reactive power as it is.' },
    { key: 'cols', label: 'Columns and generators', kind: 'list', default: [], rowPrefix: 'g', showIf: (s) => s.mode === 'row',
      columns: [
        { key: 'col', label: 'Column', kind: 'text', default: '', placeholder: 'e.g. G 02', suggest: 'columns', columnsOf: '@row' },
        { key: 'gen', label: 'Generator (no name: the column name)', kind: 'element', kinds: GEN_KINDS, default: { cls: 'ElmSym', name: '', match: 'one' } },
      ],
      tip: 'Each row becomes an input: wire the column value of the table row into it. An empty cell takes that generator out of service; 0 keeps it in service at 0 MW.' },
    BASIS,
    { key: 'qmode', label: 'Reactive power control', kind: 'select', default: 'keep', options: [['keep', 'Keep as in the model'], ['pq', 'Constant Q (needed for Q to apply)']],
      tip: 'A voltage-controlled generator ignores the reactive power; constant Q switches it to av_mode constq (put back afterwards).' },
    { key: 'unit', label: 'Unit of the active power', kind: 'select', default: 'MW', more: true, options: [['MW', 'MW'], ['kW', 'kW'], ['GW', 'GW']] },
    { key: 'outerComp', label: 'Also its plant model (ElmComp)', kind: 'bool', default: true, more: true,
      tip: 'Put the outermost composite model (the controllers) in service with the unit, and out of service with it for an empty cell.' },
  ],
  ports(s) {
    if (s.mode === 'row') {
      const rows = Array.isArray(s.cols) ? s.cols : [];
      return { inputs: [
        { id: 'row', label: 'Whole row (optional)', type: 'any', tip: 'A table row with one column per generator; columns not listed below are matched to generators by name.' },
        ...rows.map(r => ({ id: r.id, label: String(r.col || r.id), type: 'num', unit: 'MW' })),
      ] };
    }
    return { inputs: [objInput('gen', 'Generator', 'gen', GEN_KINDS), numInput('p', 'Active power', 'p', 'MW'), numInput('q', 'Reactive power', 'q', 'Mvar')] };
  },
  summary(s, node, wf) {
    if (s.mode === 'row') return `From a table row: ${(s.cols || []).length} generators`;
    // A wired input is what the run uses, so the card names the wire, not the typed number.
    const wired = (id) => !!(wf && node && Array.isArray(wf.edges) && wf.edges.some(e => e && e.to === node.id && e.in === id));
    const who = wired('gen') ? 'Wired generator' : elemText(s.gen);
    const p = wired('p') ? `wired value (${s.unit})` : `${s.p} ${s.unit}`;
    const q = wired('q') ? ', wired Mvar' : (s.q === null || s.q === undefined ? '' : `, ${s.q} Mvar`);
    return `${who}: ${p}${s.basis === 'total' ? ' total' : ' per machine'}` + q;
  },
  helpers: ['set_dispatch'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    noteOperational(cx, true);
    const s = cx.s;
    if (s.mode === 'row') {
      cx.helper('dispatch_row');
      const rows = Array.isArray(s.cols) ? s.cols : [];
      const lines = [];
      let rowVar = null;
      if (cx.has('row')) { rowVar = cx.name('row'); lines.push(`${rowVar} = dict(${cx.in('row')} or {})`); }
      if (!rows.length) {
        if (!rowVar) return ['pass  # no generators listed yet'];
        lines.push(`dispatch_row(app, ${rowVar}, None, ${cx.val('basis')}, ${cx.val('unit')}, ${cx.val('outerComp')})`);
        return lines;
      }
      const vals = rows.map(r => `${cx.lit(String(r.col || ''))}: ${cx.has(r.id) ? cx.in(r.id) : rowVar ? `${rowVar}.get(${cx.lit(String(r.col || ''))})` : 'None'}`);
      const map = rows.map(r => `${cx.lit(String(r.col || ''))}: ${cx.lit(rowGenQuery(r))}`);
      lines.push(`dispatch_row(app, {${vals.join(', ')}}, {${map.join(', ')}}, ${cx.val('basis')}, ${cx.val('unit')}, ${cx.val('outerComp')})`);
      return lines;
    }
    cx.helper('set_dispatch');
    return [`set_dispatch(${cx.in('gen')}, ${cx.in('p')}, ${cx.in('q')}, ${cx.val('basis')}, ${cx.val('qmode')}, ${cx.val('unit')}, "Mvar", ${cx.val('outerComp')})`];
  },
  validate(cx) {
    warnE1(cx);
    if (cx.s.mode === 'row') {
      const rows = Array.isArray(cx.s.cols) ? cx.s.cols : [];
      if (!rows.length && !cx.has('row')) cx.todo(`List the columns and generators of ${cx.label}, or wire a whole row into it.`);
      rows.forEach((r, k) => {
        if (!String(r.col || '').trim()) cx.todo(`Fill in the column name of row ${k + 1} on ${cx.label}.`);
        else if (!cx.has(r.id) && !cx.has('row')) cx.todo(`Connect the value of column ${r.col} to ${cx.label} (an unconnected column would take that generator out of service).`);
      });
    }
  },
});

defineBlock({
  type: 'pf.scale', cat: CAT, kind: 'action',
  title: 'Scale',
  desc: 'Multiplies an attribute (for example a load\'s active power) by a factor of its original value, so scaling by 1.1 twice still gives 1.1 times the original.',
  keywords: ['scale', 'factor', 'multiply', 'load', 'increase', 'percent', 'plini', 'qlini', 'scaling', 'stress'],
  inputs: [objInput('obj', 'Element', 'el'), numInput('factor', 'Factor', 'factor', '', 'For example 1.1 for +10 %.')],
  settings: [
    elementSetting('el', 'Element', 'ElmLod'),
    { key: 'attr', label: 'Attribute', kind: 'attr', default: 'plini', required: true, placeholder: 'e.g. plini' },
    { key: 'attr2', label: 'Also this attribute', kind: 'attr', default: '', placeholder: 'e.g. qlini (optional)', tip: 'A second attribute scaled by the same factor, for example qlini to keep the power factor of a load.' },
    { key: 'factor', label: 'Factor', kind: 'number', default: 1.1, step: 0.05 },
  ],
  summary(s) { return `${elemText(s.el)}: ${s.attr}${s.attr2 ? ', ' + s.attr2 : ''} x ${s.factor}`; },
  helpers: ['scale_attr'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    const a2 = String(cx.s.attr2 || '').trim();
    const two = !!a2 || pinned(cx, 'attr2');
    const op = [cx.s.attr, a2].some(a => OPERATIONAL.has(String(a || '').trim()));
    noteOperational(cx, op);
    cx.helper('scale_attr');
    const obj = cx.in('obj');
    const f = cx.in('factor');
    const lines = [];
    let o = obj, fv = f;
    if (two) {
      o = cx.name('scaled'); fv = cx.name('factor');
      lines.push(`${o} = ${obj}`, `${fv} = ${f}`);
    }
    lines.push(`scale_attr(${o}, ${cx.val('attr')}, ${fv})`);
    if (pinned(cx, 'attr2')) lines.push(`if ${cx.val('attr2')}:`, `    scale_attr(${o}, ${cx.val('attr2')}, ${fv})`);
    else if (a2) lines.push(`scale_attr(${o}, ${cx.val('attr2')}, ${fv})`);
    return lines;
  },
  validate(cx) { warnE1(cx); },
});

defineBlock({
  type: 'pf.outserv', cat: CAT, kind: 'action',
  title: 'Take out of / put back in service',
  desc: 'Takes an element (or each element of a list) out of service, or puts it back in. Put back at the end of the pass or the workflow.',
  keywords: ['out of service', 'in service', 'outserv', 'outage', 'switch off', 'disconnect', 'trip', 'remove', 'contingency', 'N-1'],
  inputs: [objInput('obj', 'Element', 'el')],
  settings: [
    elementSetting('el', 'Element', 'ElmLne'),
    { key: 'action', label: 'Do', kind: 'select', default: 'out', options: [['out', 'Take it out of service'], ['in', 'Put it in service']] },
    { key: 'outerComp', label: 'Also its plant model (ElmComp)', kind: 'bool', default: false, more: true,
      tip: 'For a generator: switch its outermost composite model (the controllers) the same way.' },
  ],
  summary(s) { return `${s.action === 'in' ? 'In service' : 'Out of service'}: ${elemText(s.el)}`; },
  helpers: ['set_service'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    noteOperational(cx, true);
    cx.helper('set_service');
    const on = pinned(cx, 'action') ? `(${cx.val('action')} == "in")` : (cx.s.action === 'in' ? 'True' : 'False');
    return [`set_service(${cx.in('obj')}, ${on}, ${cx.val('outerComp')})`];
  },
  validate(cx) { warnE1(cx); },
});

defineBlock({
  type: 'pf.undo', cat: CAT, kind: 'action',
  title: 'Put changed values back',
  desc: 'Puts back every value the workflow has changed so far (dispatch, service, attributes), each in its own study case and scenario. Loops already do this after each pass.',
  keywords: ['undo', 'restore', 'put back', 'reset', 'revert', 'original values', 'pf_undo'],
  summary() { return 'Every change so far'; },
  helpers: ['pf_undo'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) { routeAt(cx); cx.helper('pf_undo'); return ['pf_undo()']; },
  validate(cx) {
    notesOf(cx);
    if (cx.structure) cx.warn(`${cx.label} sits inside ${cx.loopLabel}, so it also puts back what was changed before the loop. Each pass already starts from the same model: remove it unless that is what you want.`);
  },
});

// ---------------------------------------------------------------------------------------------
// Study cases, operation scenarios, variations

// "{active case} {loop values}" -> "01- Load Flow Dispatch (MW) 300", worked out when it runs;
// a name equal to the active case gets " copy" so the active case is never reused by mistake.
function runtimeName(cx, inExpr, what) {
  cx.helper('ctx', 'convert', 'pf_names');
  const nm = cx.name(what + ' name');
  return { nm, lines: [
    `${nm} = str(${inExpr} or "").replace("{active case}", app.GetActiveStudyCase().loc_name if app.GetActiveStudyCase() is not None else "")`,
    `${nm} = ${nm}.replace("{loop values}", " ".join(f"{k} {as_text(v)}" for k, v in ctx_dict().items())).strip() or ${cx.lit('Workflow ' + what)}`,
    `if app.GetActiveStudyCase() is not None and pf_clean_name(${nm}) == app.GetActiveStudyCase().loc_name:`,
    `    ${nm} += " copy"`,
  ] };
}
const NAME_TIP = '{active case} becomes the name of the active study case and {loop values} the loop values of this pass (for example Dispatch 300). At most 40 characters; PowerFactory\'s refused characters become _.';
const EXISTS = (what) => ({ key: 'exists', label: `If a ${what} of that name exists`, kind: 'select', default: 'reuse', more: true,
  options: [['reuse', 'Use it'], ['replace', 'Replace it (only one the Builder made)'], ['new', 'Make a new one with a number']] });
const KEEP = (what) => ({ key: 'keep', label: `Keep the new ${what} after the run`, kind: 'bool', default: true,
  tip: `Off: the ${what} is deleted when the workflow ends.` });

defineBlock({
  type: 'pf.case.activate', cat: CAT, kind: 'action',
  title: 'Activate study case',
  desc: 'Makes a study case active by its name (or the case wired in). Its operation scenario and variations come with it. The start case is active again at the end.',
  keywords: ['study case', 'activate', 'switch case', 'IntCase', 'case', 'Activate()', 'select case'],
  inputs: [{ id: 'case_in', label: 'Study case', type: 'any', fallback: 'case', tip: 'A study case or its name, for example from Create study case.' }],
  outputs: [
    { id: 'case', label: 'Study case', type: 'obj', var: 'study_case' },
    { id: 'name', label: 'Name', type: 'text', var: 'case_name' },
  ],
  settings: [{ key: 'case', label: 'Study case', kind: 'text', default: '', required: true, placeholder: 'Exactly as in the Data Manager, e.g. 01- Load Flow', tip: 'Letter case counts.' }],
  summary(s) { return s.case || 'Study case not set'; },
  helpers: ['case_activate'],
  effects: { writes: ['case'], reads: [] },
  emit(cx) {
    caseSwitch(routeAt(cx), cx);
    cx.helper('case_activate');
    const c = cx.out('case');
    cx.out('name', `${c}.loc_name`);
    return [`${c} = case_activate(app, ${cx.in('case_in')})`];
  },
  validate(cx) { notesOf(cx); },
});

defineBlock({
  type: 'pf.case.create', cat: CAT, kind: 'action',
  title: 'Create study case',
  desc: 'Makes a copy of the active (or a named) study case, by default with its own operation scenario, and activates it. Use it for one case per pass of a loop.',
  keywords: ['create', 'new study case', 'copy case', 'AddCopy', 'IntCase', 'operation scenario', 'IntScenario', 'case per pass', 'duplicate'],
  inputs: [
    { id: 'name_in', label: 'Name', type: 'text', fallback: 'name', tip: 'The new case name, for example from Text from a template.' },
    { id: 'template', label: 'Copy of', type: 'any', fallback: 'template', tip: 'The study case to copy (a case or its name). Empty: the active case.' },
  ],
  outputs: [
    { id: 'case', label: 'Study case', type: 'obj', var: 'new_case' },
    { id: 'scenario', label: 'Operation scenario', type: 'obj', var: 'new_scenario' },
    { id: 'name', label: 'Name', type: 'text', var: 'new_case_name', tip: 'The name PowerFactory gave it (cut to 40 characters, or numbered).' },
  ],
  settings: [
    { key: 'name', label: 'Name', kind: 'text', default: '{active case} {loop values}', tip: NAME_TIP },
    { key: 'template', label: 'Copy of', kind: 'text', default: '', placeholder: 'Empty: the active study case' },
    { key: 'scenario', label: 'Operation scenario', kind: 'select', default: 'copy',
      options: [['copy', 'Copy the case\'s scenario (a new one when it has none)'], ['new', 'A new scenario from the network data'], ['none', 'No scenario']],
      tip: 'With its own scenario, dispatch and service changes stay in this case and do not touch the network data every case uses.' },
    EXISTS('study case'),
    { key: 'activate', label: 'Activate it', kind: 'bool', default: true },
    KEEP('study case'),
  ],
  summary(s) {
    return `${s.name || 'Unnamed'}, ${s.scenario === 'none' ? 'no scenario' : s.scenario === 'new' ? 'new scenario' : 'copied scenario'}${s.keep ? ', kept after the run' : ', deleted at the end'}`;
  },
  helpers: ['case_create'],
  effects(s) { return s.activate ? { writes: ['case'], reads: [] } : { writes: [], reads: [] }; },
  emit(cx) {
    const st = routeAt(cx);
    if (cx.s.activate) {
      if (cx.s.scenario === 'none') caseSwitch(st, cx);
      else { st.scen = 'scen'; st.caseBy = { label: cx.label, sure: false }; }
    }
    cx.helper('case_create');
    const { nm, lines } = runtimeName(cx, cx.in('name_in'), 'case');
    const made = cx.name(cx.label === 'Create study case' ? 'made case' : cx.label);
    cx.out('case', `${made}.case`);
    cx.out('scenario', `${made}.scenario`);
    cx.out('name', `${made}.name`);
    lines.push(`${made} = case_create(app, ${nm}, ${cx.in('template')} or None, ${cx.val('scenario')}, ${cx.val('exists')}, ${cx.val('activate')}, ${cx.val('keep')})`);
    return lines;
  },
  validate(cx) {
    notesOf(cx);
    if (!cx.has('name_in') && !String(cx.s.name || '').trim()) cx.todo(`Give ${cx.label} a name (or keep {active case} {loop values}).`);
  },
});

defineBlock({
  type: 'pf.case.foreach', cat: CAT, kind: 'loop',
  title: 'For each study case',
  desc: 'Repeats the Each pass steps with each study case active in turn (the names matching a pattern, sorted). The case active before is active again afterwards.',
  keywords: ['for each', 'loop', 'study cases', 'every case', 'all cases', 'IntCase', 'iterate', 'cases'],
  inputs: [{ id: 'items', label: 'Study cases', type: 'items', tip: 'Optional: loop over these study cases (or their names) instead of a pattern.' }],
  outputs: [
    { id: 'case', label: 'Study case', type: 'obj', scope: 'body', var: 'study_case' },
    { id: 'casename', label: 'Name', type: 'text', scope: 'body', var: 'case_name' },
    { id: 'index', label: 'Pass no.', type: 'num', scope: 'body', var: 'pass_no' },
    { id: 'count', label: 'Number of passes', type: 'num', scope: 'done', var: 'passes' },
  ],
  settings: [
    nameSetting('Study case'),
    { key: 'pattern', label: 'Study cases named', kind: 'text', default: '*', placeholder: '* for all, e.g. 0*', tip: 'A name with * wildcards; * means every study case. Used while nothing is wired into Study cases.' },
    restoreSetting, onErrorSetting,
  ],
  summary(s) { return s.pattern === '*' || !s.pattern ? 'Every study case' : `Study cases ${s.pattern}`; },
  helpers: ['case_list', 'each_case'],
  effects: { writes: ['case'], reads: [] },
  emit(cx) {
    routeAt(cx);
    cx.helper('case_list', 'each_case', 'log', 'convert');
    const lst = listName(cx, 'cases');
    const i = cx.out('index');
    const c = cx.out('case');
    cx.out('casename', `${c}.loc_name`);
    cx.out('count', `len(${lst})`);
    const lines = [cx.has('items') ? `${lst} = as_items(${cx.in('items')})` : `${lst} = case_list(app, ${cx.val('pattern')})`,
      `if not ${lst}:`, `    log(${cx.lit(cx.label + ': no study case to loop over.')}, "warn")`];
    caseSwitch(enterLoop(cx, true), cx);
    return { lines, header: `for ${i}, ${c} in enumerate(each_case(app, ${lst}), 1):`, iter: { i, n: `len(${lst})` }, ctx: [passLabel(cx, 'Study case'), c] };
  },
  validate(cx) { notesOf(cx); },
});

defineBlock({
  type: 'pf.scen.activate', cat: CAT, kind: 'action',
  title: 'Activate operation scenario',
  desc: 'Makes an operation scenario active in the active study case, so dispatch and service changes go into it. The start scenario is active again at the end.',
  keywords: ['operation scenario', 'scenario', 'activate', 'IntScenario', 'operating point', 'switch scenario'],
  inputs: [{ id: 'scen', label: 'Scenario', type: 'any', fallback: 'scen', tip: 'An operation scenario or its name.' }],
  outputs: [{ id: 'scenario', label: 'Scenario', type: 'obj', var: 'scenario' }],
  settings: [{ key: 'scen', label: 'Operation scenario', kind: 'text', default: '', required: true, placeholder: 'Exactly as in the Data Manager' }],
  summary(s) { return s.scen || 'Scenario not set'; },
  helpers: ['scenario_activate'],
  effects: { writes: ['case'], reads: [] },
  emit(cx) {
    routeAt(cx).scen = 'scen';
    cx.helper('scenario_activate');
    return [`${cx.out('scenario')} = scenario_activate(app, ${cx.in('scen')})`];
  },
  validate(cx) { notesOf(cx); },
});

defineBlock({
  type: 'pf.scen.create', cat: CAT, kind: 'action',
  title: 'Create operation scenario',
  desc: 'Saves the operating state in use now (dispatch, switching, service) as a new operation scenario and activates it, so later changes stay in it.',
  keywords: ['create', 'new scenario', 'operation scenario', 'IntScenario', 'SaveAsScenario', 'operating point', 'snapshot'],
  inputs: [{ id: 'name_in', label: 'Name', type: 'text', fallback: 'name' }],
  outputs: [
    { id: 'scenario', label: 'Scenario', type: 'obj', var: 'new_scenario' },
    { id: 'name', label: 'Name', type: 'text', var: 'scenario_name' },
  ],
  settings: [
    { key: 'name', label: 'Name', kind: 'text', default: '{active case} {loop values}', tip: NAME_TIP },
    EXISTS('scenario'),
    { key: 'activate', label: 'Activate it', kind: 'bool', default: true },
    KEEP('scenario'),
  ],
  summary(s) { return `${s.name || 'Unnamed'}${s.keep ? ', kept after the run' : ', deleted at the end'}`; },
  helpers: ['scenario_create'],
  effects(s) { return s.activate ? { writes: ['case'], reads: [] } : { writes: [], reads: [] }; },
  emit(cx) {
    const st = routeAt(cx);
    if (cx.s.activate) st.scen = 'scen';
    cx.helper('scenario_create');
    const { nm, lines } = runtimeName(cx, cx.in('name_in'), 'scenario');
    const sc = cx.out('scenario');
    cx.out('name', `${sc}.loc_name`);
    lines.push(`${sc} = scenario_create(app, ${nm}, ${cx.val('activate')}, ${cx.val('keep')}, ${cx.val('exists')})`);
    return lines;
  },
  validate(cx) { notesOf(cx); },
});

defineBlock({
  type: 'pf.scen.save', cat: CAT, kind: 'action',
  title: 'Save operation scenario',
  desc: 'Saves the changes of the active operation scenario into it, so they stay after the workflow puts changed values back (also at the end of a pass).',
  keywords: ['save', 'scenario', 'operation scenario', 'store', 'IntScenario', 'Save()', 'keep changes'],
  outputs: [{ id: 'saved', label: 'Saved', type: 'bool', var: 'saved' }],
  summary() { return 'The active scenario'; },
  helpers: ['scenario_save'],
  emit(cx) {
    routeAt(cx);
    cx.helper('scenario_save');
    return cx.used('saved') ? [`${cx.out('saved')} = scenario_save(app)`] : ['scenario_save(app)'];
  },
  validate(cx) { notesOf(cx); },
});

defineBlock({
  type: 'pf.scen.deactivate', cat: CAT, kind: 'action',
  title: 'Deactivate operation scenario',
  desc: 'Switches the active operation scenario off. Its unsaved changes are dropped unless you choose to save them (PowerFactory\'s own default is to drop).',
  keywords: ['deactivate', 'scenario', 'operation scenario', 'switch off', 'IntScenario', 'Deactivate()', 'network data'],
  outputs: [{ id: 'scenario', label: 'Scenario', type: 'obj', var: 'old_scenario', tip: 'The scenario that was switched off (empty when none was active).' }],
  settings: [{ key: 'save', label: 'Save its changes first', kind: 'bool', default: false }],
  summary(s) { return s.save ? 'Save, then switch off' : 'Switch off, drop unsaved changes'; },
  helpers: ['scenario_deactivate'],
  effects: { writes: ['case'], reads: [] },
  emit(cx) {
    caseSwitch(routeAt(cx), cx, true);
    cx.helper('scenario_deactivate');
    const call = `scenario_deactivate(app, ${cx.val('save')})`;
    return cx.used('scenario') ? [`${cx.out('scenario')} = ${call}`] : [call];
  },
  validate(cx) { notesOf(cx); },
});

defineBlock({
  type: 'pf.scen.foreach', cat: CAT, kind: 'loop',
  title: 'For each operation scenario',
  desc: 'Repeats the Each pass steps with each operation scenario active in turn (names matching a pattern, sorted). The scenario active before comes back afterwards.',
  keywords: ['for each', 'loop', 'scenarios', 'operation scenario', 'every scenario', 'IntScenario', 'operating points', 'iterate'],
  inputs: [{ id: 'items', label: 'Scenarios', type: 'items', tip: 'Optional: loop over these scenarios (or their names) instead of a pattern.' }],
  outputs: [
    { id: 'scenario', label: 'Scenario', type: 'obj', scope: 'body', var: 'scenario' },
    { id: 'scenname', label: 'Name', type: 'text', scope: 'body', var: 'scenario_name' },
    { id: 'index', label: 'Pass no.', type: 'num', scope: 'body', var: 'pass_no' },
    { id: 'count', label: 'Number of passes', type: 'num', scope: 'done', var: 'passes' },
  ],
  settings: [
    nameSetting('Scenario'),
    { key: 'pattern', label: 'Scenarios named', kind: 'text', default: '*', placeholder: '* for all', tip: 'A name with * wildcards; * means every operation scenario.' },
    restoreSetting, onErrorSetting,
  ],
  summary(s) { return s.pattern === '*' || !s.pattern ? 'Every operation scenario' : `Scenarios ${s.pattern}`; },
  helpers: ['scenario_list', 'each_scenario'],
  effects: { writes: ['case'], reads: [] },
  emit(cx) {
    routeAt(cx);
    cx.helper('scenario_list', 'each_scenario', 'log', 'convert');
    const lst = listName(cx, 'scenarios');
    const i = cx.out('index');
    const sc = cx.out('scenario');
    cx.out('scenname', `${sc}.loc_name`);
    cx.out('count', `len(${lst})`);
    const lines = [cx.has('items') ? `${lst} = as_items(${cx.in('items')})` : `${lst} = scenario_list(app, ${cx.val('pattern')})`,
      `if not ${lst}:`, `    log(${cx.lit(cx.label + ': no operation scenario to loop over.')}, "warn")`];
    enterLoop(cx, true).scen = 'scen';
    return { lines, header: `for ${i}, ${sc} in enumerate(each_scenario(app, ${lst}), 1):`, iter: { i, n: `len(${lst})` }, ctx: [passLabel(cx, 'Scenario'), sc] };
  },
  validate(cx) { notesOf(cx); },
});

defineBlock({
  type: 'pf.var.activate', cat: CAT, kind: 'action',
  title: 'Activate variation',
  desc: 'Activates a network variation in the active study case (alone, or with the ones already active). The case gets its own variations back at the end.',
  keywords: ['variation', 'activate', 'IntScheme', 'network variation', 'expansion stage', 'future grid', 'project'],
  inputs: [{ id: 'var_in', label: 'Variation', type: 'any', fallback: 'variation', tip: 'A variation or its name.' }],
  outputs: [{ id: 'variation', label: 'Variation', type: 'obj', var: 'variation' }],
  settings: [
    { key: 'variation', label: 'Variation', kind: 'text', default: '', required: true, placeholder: 'Exactly as in the Data Manager' },
    { key: 'alone', label: 'Deactivate the other variations', kind: 'bool', default: false },
  ],
  summary(s) { return (s.variation || 'Variation not set') + (s.alone ? ' (alone)' : ''); },
  helpers: ['variation_activate'],
  effects: { writes: ['case'], reads: [] },
  emit(cx) {
    routeAt(cx);
    cx.helper('variation_activate');
    return [`${cx.out('variation')} = variation_activate(app, ${cx.in('var_in')}, ${cx.val('alone')})`];
  },
  validate(cx) { notesOf(cx); },
});

defineBlock({
  type: 'pf.var.deactivate', cat: CAT, kind: 'action',
  title: 'Deactivate variation',
  desc: 'Deactivates one network variation, or every active one, in the active study case. The case gets its own variations back at the end.',
  keywords: ['variation', 'deactivate', 'IntScheme', 'switch off', 'base network', 'network variation'],
  inputs: [{ id: 'var_in', label: 'Variation', type: 'any', fallback: 'variation', tip: 'A variation or its name.' }],
  outputs: [{ id: 'count', label: 'How many', type: 'num', var: 'deactivated' }],
  settings: [
    { key: 'which', label: 'Deactivate', kind: 'select', default: 'one', noPin: true, options: [['one', 'This variation'], ['all', 'Every active variation']] },
    { key: 'variation', label: 'Variation', kind: 'text', default: '', placeholder: 'Exactly as in the Data Manager', showIf: (s) => s.which !== 'all' },
  ],
  ports(s) { return { inputs: s.which === 'all' ? [] : [{ id: 'var_in', label: 'Variation', type: 'any', fallback: 'variation', tip: 'A variation or its name.' }] }; },
  summary(s) { return s.which === 'all' ? 'Every active variation' : (s.variation || 'Variation not set'); },
  helpers: ['variation_deactivate'],
  effects: { writes: ['case'], reads: [] },
  emit(cx) {
    routeAt(cx);
    cx.helper('variation_deactivate');
    const call = `variation_deactivate(app, ${cx.s.which === 'all' ? 'None' : cx.in('var_in')})`;
    return cx.used('count') ? [`${cx.out('count')} = ${call}`] : [call];
  },
  validate(cx) {
    notesOf(cx);
    if (cx.s.which !== 'all' && !cx.has('var_in') && !String(cx.s.variation || '').trim()) cx.todo(`Fill in Variation on ${cx.label}.`);
  },
});

defineBlock({
  type: 'pf.var.create', cat: CAT, kind: 'action',
  title: 'Create variation',
  desc: 'Makes a network variation with one expansion stage at the study time and activates it, so new elements and type changes are recorded in it, not in the base network.',
  keywords: ['create', 'new variation', 'IntScheme', 'expansion stage', 'NewStage', 'record changes', 'network variation'],
  inputs: [{ id: 'name_in', label: 'Name', type: 'text', fallback: 'name' }],
  outputs: [
    { id: 'variation', label: 'Variation', type: 'obj', var: 'new_variation' },
    { id: 'name', label: 'Name', type: 'text', var: 'variation_name' },
  ],
  settings: [
    { key: 'name', label: 'Name', kind: 'text', default: '{active case} {loop values}', tip: NAME_TIP },
    { key: 'stage', label: 'Stage name', kind: 'text', default: '', more: true, placeholder: 'Empty: the variation name' },
    EXISTS('variation'),
    { key: 'activate', label: 'Activate it (recording)', kind: 'bool', default: true },
    KEEP('variation'),
  ],
  summary(s) { return `${s.name || 'Unnamed'}${s.keep ? ', kept after the run' : ', deleted at the end'}`; },
  helpers: ['variation_create'],
  effects(s) { return s.activate ? { writes: ['case'], reads: [] } : { writes: [], reads: [] }; },
  emit(cx) {
    routeAt(cx);
    cx.helper('variation_create');
    const { nm, lines } = runtimeName(cx, cx.in('name_in'), 'variation');
    const v = cx.out('variation');
    cx.out('name', `${v}.loc_name`);
    const stage = String(cx.s.stage || '').trim() || pinned(cx, 'stage') ? `${cx.val('stage')} or None` : 'None';
    lines.push(`${v} = variation_create(app, ${nm}, ${stage}, ${cx.val('activate')}, ${cx.val('keep')}, ${cx.val('exists')})`);
    return lines;
  },
  validate(cx) { notesOf(cx); },
});

defineBlock({
  type: 'pf.var.foreach', cat: CAT, kind: 'loop',
  title: 'For each variation',
  desc: 'Repeats the Each pass steps with each network variation active in turn (names matching a pattern, sorted). The case\'s own variations come back afterwards.',
  keywords: ['for each', 'loop', 'variations', 'IntScheme', 'every variation', 'expansion', 'iterate', 'network variation'],
  inputs: [{ id: 'items', label: 'Variations', type: 'items', tip: 'Optional: loop over these variations (or their names) instead of a pattern.' }],
  outputs: [
    { id: 'variation', label: 'Variation', type: 'obj', scope: 'body', var: 'variation' },
    { id: 'varname', label: 'Name', type: 'text', scope: 'body', var: 'variation_name' },
    { id: 'index', label: 'Pass no.', type: 'num', scope: 'body', var: 'pass_no' },
    { id: 'count', label: 'Number of passes', type: 'num', scope: 'done', var: 'passes' },
  ],
  settings: [
    nameSetting('Variation'),
    { key: 'pattern', label: 'Variations named', kind: 'text', default: '*', placeholder: '* for all', tip: 'A name with * wildcards; * means every variation.' },
    { key: 'alone', label: 'Only that variation active', kind: 'bool', default: true, tip: 'Off: each one is added to the variations the case already has active.' },
    restoreSetting, onErrorSetting,
  ],
  summary(s) { return (s.pattern === '*' || !s.pattern ? 'Every variation' : `Variations ${s.pattern}`) + (s.alone ? ', one at a time' : ''); },
  helpers: ['variation_list', 'each_variation'],
  effects: { writes: ['case'], reads: [] },
  emit(cx) {
    routeAt(cx);
    cx.helper('variation_list', 'each_variation', 'log', 'convert');
    const lst = listName(cx, 'variations');
    const i = cx.out('index');
    const v = cx.out('variation');
    cx.out('varname', `${v}.loc_name`);
    cx.out('count', `len(${lst})`);
    const lines = [cx.has('items') ? `${lst} = as_items(${cx.in('items')})` : `${lst} = variation_list(app, ${cx.val('pattern')})`,
      `if not ${lst}:`, `    log(${cx.lit(cx.label + ': no variation to loop over.')}, "warn")`];
    enterLoop(cx, true);
    return { lines, header: `for ${i}, ${v} in enumerate(each_variation(app, ${lst}, ${cx.val('alone')}), 1):`, iter: { i, n: `len(${lst})` }, ctx: [passLabel(cx, 'Variation'), v] };
  },
  validate(cx) { notesOf(cx); },
});

// ---------------------------------------------------------------------------------------------
// Test generator (hosting capacity, E21)

defineBlock({
  type: 'pf.testgen', cat: CAT, kind: 'action',
  title: 'Add test generator at a bus',
  desc: 'Connects a static generator (constant Q) to a busbar for hosting capacity studies; feed it to Set generator dispatch to change P. Deleted at the end.',
  keywords: ['test generator', 'hosting capacity', 'static generator', 'ElmGenstat', 'new generator', 'connection', 'busbar', 'injection'],
  inputs: [objInput('bus', 'Busbar', 'bus', ['ElmTerm']), numInput('p', 'Active power', 'p', 'MW'), numInput('q', 'Reactive power', 'q', 'Mvar')],
  outputs: [{ id: 'gen', label: 'Test generator', type: 'obj', var: 'test_generator' }],
  settings: [
    elementSetting('bus', 'Busbar', 'ElmTerm'),
    { key: 'p', label: 'Active power', kind: 'number', default: 0, unit: 'MW' },
    { key: 'q', label: 'Reactive power', kind: 'number', default: 0, unit: 'Mvar' },
    { key: 'rating', label: 'Rating', kind: 'number', default: null, unit: 'MVA', more: true, placeholder: 'Automatic', tip: 'Empty: the larger of 100 MVA and 1.5 times the apparent power.' },
  ],
  summary(s) { return `At ${elemText(s.bus)}: ${s.p} MW, ${s.q} Mvar`; },
  helpers: ['add_test_generator'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    routeAt(cx);
    cx.helper('add_test_generator');
    const call = `add_test_generator(app, ${cx.in('bus')}, ${cx.in('p')}, ${cx.in('q')}, ${cx.lit(cx.id)}, ${cx.val('rating')})`;
    return cx.used('gen') ? [`${cx.out('gen')} = ${call}`] : [call];
  },
  validate(cx) { notesOf(cx); },
});
