// PSCAD: model and data (DESIGN section 9, "model"): components and their parameters, layers,
// scenarios, global substitutions, the input controls a running case is driven by, the Multiple
// Run component, the cases in the workspace, and building a page from the script.
//
// Type ids, setting keys, select option values, list row ids and port ids are frozen handles
// (saved in every workflow and .py); change titles, labels, descriptions and tips freely.
//
// Every runtime helper called here is described in runtime/API-px.md (px_core.py, px_model.py).
// study.js imports the shared pieces below (component settings, loop settings, route notes).

import { defineBlock, defineFamily } from '../core/registry.js';
import { convertible, unitOf, familyOf, typeOf, optionsOf, hasParam } from '../core/attrdata.js';
import { parseLines } from './start.js';

const CAT = 'model';

// ---------------------------------------------------------------------------------------------
// Shared pieces

const EXAMPLE = {
  'master:source_3': 'Src1', 'master:resistor': 'Rload', 'master:pgb': 'Vbus',
  'master:tpflt': 'F1', 'master:breaker3': 'BRK1', 'master:xfmr-3p2w': 'T1',
  'master:sync_machine': 'G1', 'Slider': 'Pref', 'Switch': 'Enable',
};

// The inline component picker an obj input falls back to while it is not wired (U7).
//
// `cls` holds a PSCAD definition ("master:resistor"). A PSCAD component very often has no Name
// at all, so a definition on its own is a complete answer and the name is optional throughout.
export function elementSetting(key, label, cls, o = {}) {
  const st = {
    key, label, kind: 'element', default: { cls, name: '', match: o.match || 'one' },
    placeholder: 'A Name, e.g. ' + (o.example || EXAMPLE[cls] || 'Src1') + ' (or leave empty)',
    tip: o.tip || 'Used while nothing is wired in. The definition alone is enough when only one component of it is in the case; a Name narrows it. Letter case counts in a Name; * matches anything (then choose first or all).',
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

// "Rload", "all master:resistor", "first BRK* (master:breaker3)" for summaries. Nothing chosen:
// "the component" (it may be wired in; the Problems list says when it is missing).
export function elemText(v, what) {
  const e = v && typeof v === 'object' ? v : {};
  const name = String(e.name || '').trim();
  const cls = String(e.cls || '').trim();
  const m = e.match === 'all' ? 'all ' : e.match === 'first' ? 'first ' : '';
  if (!name && !cls) return what || 'the component';
  if (!name) return `${m || (e.match === 'one' ? '' : m)}${cls}`;
  if (!cls) return `${m}${name}`;
  return m || /[*?]/.test(name) ? `${m}${name} (${cls})` : name;
}

// Loops share these three settings with flow.js (same keys and option values).
export const nameSetting = (fallback) => ({
  key: 'name', label: 'Name (table column and file names)', kind: 'text', default: '', more: true, meaning: 'passName', placeholder: `The name on the canvas, or ${fallback}`,
  tip: `What each pass is called in results tables, file names and the log, when that is not the name on the canvas. Empty: the name on the canvas, or "${fallback}".`,
});
export const restoreSetting = {
  key: 'restore', label: 'After each pass', kind: 'select', default: 'pass', more: true, noPin: true,
  options: [['pass', 'Put the model back (every pass starts from the same model)'], ['end', 'Put the model back after the last pass'], ['never', 'Keep the changes']],
  tip: 'What happens to parameters, layer states and substitutions the steps changed. By default each pass starts from the same model.',
};
export const onErrorSetting = {
  key: 'onError', label: 'If a pass fails', kind: 'select', default: 'skip', more: true, noPin: true,
  options: [['skip', 'Note it and go on with the next pass'], ['stop', 'Stop the workflow']],
  tip: 'A pass fails when a step raises an error. It is noted in the log and in the results table either way.',
};
export const passLabel = (cx, fallback) => cx.lit(String(cx.s.name || '').trim() || String(cx.node.label || '').trim() || fallback);
export const listName = (cx, what) => cx.name((String(cx.node.label || '').trim() ? cx.label + ' ' : '') + what);
export const pinned = (cx, key) => Array.isArray(cx.node.pin) && cx.node.pin.includes(key);

// A select whose value `none` means "leave it to PSCAD" (None in Python).
export function noneOr(cx, key, noneValue = 'none') {
  if (pinned(cx, key)) { const v = cx.val(key); return `(None if ${v} in ("", ${cx.lit(noneValue)}) else ${v})`; }
  const v = cx.s[key];
  return v === noneValue || v === '' || v === undefined ? 'None' : cx.lit(String(v));
}

// The units a parameter's value can be given in. PSCAD carries the unit in the value itself
// ("2.5 [ohm]"), and the script converts only inside one kind (runtime/px_core.py unit_factor:
// power, time, voltage, current, resistance, inductance, capacitance, frequency, energy). A
// percentage, a per-unit value, an angle or a count is outside all of them, so the choice is
// only offered where it can work, and then only with the units of the parameter's own kind.
export const UNIT_OPTIONS = [
  ['none', 'As PSCAD holds it'],
  ['MW', 'MW'], ['kW', 'kW'], ['Mvar', 'Mvar'], ['kvar', 'kvar'], ['MVA', 'MVA'], ['kVA', 'kVA'],
  ['kV', 'kV'], ['V', 'V'], ['kA', 'kA'], ['A', 'A'],
  ['ohm', 'ohm'], ['kohm', 'kohm'], ['mohm', 'mohm'],
  ['H', 'H'], ['mH', 'mH'], ['uH', 'uH'],
  ['uF', 'uF'], ['nF', 'nF'],
  ['s', 's'], ['ms', 'ms'], ['us', 'us'], ['Hz', 'Hz'],
];

const elemClass = (s, key) => (s && s[key] && typeof s[key] === 'object' && s[key].cls) || '';

// showIf for a unit setting: `elKey` is the component setting, `port` the input that replaces it.
export const unitApplies = (elKey, port) => (s, cx) => {
  if (cx && cx.wired && cx.wired.has(port)) return true;
  return convertible(elemClass(s, elKey), s.param) !== false;
};

// optionsFor for a unit setting: the units of the parameter's own kind, and "as PSCAD holds it".
// Null (every unit) while the kind is not known.
export const unitOptions = (elKey) => (s) => {
  const u = unitOf(elemClass(s, elKey), s.param);
  const fam = u === undefined ? '' : familyOf(u);
  if (!fam) return null;
  return ['none', ...UNIT_OPTIONS.map(o => o[0]).filter(v => v !== 'none' && familyOf(v) === fam)];
};

// What kind of value a parameter takes, when the reference data knows: a Choice parameter takes
// one of a few words and never a number, so "The value is" leaves the number out for it.
export const valueKinds = (elKey) => (s, cx) => {
  if (cx && cx.wired && cx.wired.has('obj')) return null;
  const t = typeOf(elemClass(s, elKey), s.param);
  if (t === undefined) return null;
  if (t === 'Choice' || t === 'Text') return ['text'];
  if (t === 'Real' || t === 'Integer') return ['num'];
  return null;
};

// The words a Choice parameter takes, for the Value field's own suggestions.
export const choiceOptions = (elKey) => (s) => {
  const got = optionsOf(elemClass(s, elKey), s.param);
  return Array.isArray(got) ? got : null;
};

// ---------------------------------------------------------------------------------------------
// What came before on the route.
//
// The generator shows a block nothing of the steps before it, but it writes the steps of a
// route in route order, so a block can keep notes as the file is written and read them back in
// validate(). That is how a channel read knows whether a run has happened since the model last
// changed, which in PSCAD is the difference between a real result and the one before it.

const R = {
  phase: '', cur: null, stack: [], notes: new Map(), ports: new Map(), last: new Map(),
};

function blankState() {
  return { run: null, built: false, dirty: false, scen: '', events: [] };
}
function copyState(st) {
  return { ...st, events: [...(st.events || [])] };
}
function resetNotes() {
  R.phase = 'emit';
  R.cur = blankState();
  R.stack = [];
  R.notes = new Map();
  R.ports = new Map();
}
resetNotes();

const findLast = (arr, fn) => { for (let i = arr.length - 1; i >= 0; i--) if (fn(arr[i])) return i; return -1; };

function popTo(k) {
  while (R.stack.length > k) {
    const e = R.stack.pop();
    // A loop puts the model back after it, so what its passes changed is not in force after it;
    // the run and the build state stay what the passes left.
    if (e.restore) R.cur = { ...copyState(e.saved), run: R.cur.run, built: R.cur.built, dirty: R.cur.dirty };
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

// A loop of these files opens its passes (call it at the END of the loop's emit).
export function enterLoop(cx, restore = true, flags = {}) {
  R.stack.push({ ...flags, id: cx.id, enclosing: cx.loopId === undefined ? null : cx.loopId, saved: copyState(R.cur), restore });
  return R.cur;
}

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

// For summaries: the run the steps before have done (null: none known).
export function lastRunFor(node) {
  if (R.phase === 'emit' && R.cur) return R.cur.run;
  return R.last.get(node && node.id) || null;
}
export function rememberRun(cx, run) { R.last.set(cx.id, run); }

// A run block was written here: results can be read after it, and the build is up to date.
export function noteRun(cx) {
  const st = routeAt(cx);
  st.run = { label: cx.label, id: cx.id, events: [...(st.events || [])] };
  st.built = true;
  st.dirty = false;
  st.events = [];
  return st;
}

// A build block was written here.
export function noteBuild(cx) {
  const st = routeAt(cx);
  st.built = true;
  st.dirty = false;
  return st;
}

// A step that changes the model: the case has to be built again before the next run, and any
// result read before the next run belongs to the model as it was.
export function noteModelChange(cx, o = {}) {
  const st = routeAt(cx);
  st.dirty = true;
  if (o.rebuild) st.built = false;
  if (st.run) noteFor(cx).afterRun = st.run.label;
  return st;
}

// A fault or switching time was set: it reaches the next run, and the run records it so the
// checks can find the event and the graphs can mark it.
export function noteEvent(cx, label) {
  const st = noteModelChange(cx);
  st.events.push({ id: cx.id, label: label || cx.label });
  return st;
}

// The events set since the last run, for px_run's `events` argument.
export function eventsPending() {
  return R.cur && Array.isArray(R.cur.events) ? R.cur.events : [];
}

// A result read: it needs a run on the route, and that run has to be after the last model change.
export function needRun(cx, what) {
  const st = routeAt(cx);
  const n = noteFor(cx);
  if (!st.run) n.noRun = true;
  else if (st.dirty) n.stale = st.run.label;
  n.what = what || 'a result';
  return st;
}

// The warnings and errors the notes above ask for (call from validate()).
export function warnRoute(cx) {
  const n = notesOf(cx);
  if (!n) return;
  if (n.noRun) {
    cx.error(`${cx.label} reads ${n.what} but nothing has run a simulation before it on this route. Add Run simulation first.`,
      { fix: { label: 'Add Run simulation before this', op: { op: 'insertBefore', nodeId: cx.id, type: 'px.run' } } });
  } else if (n.stale) {
    cx.error(`${cx.label} reads ${n.what} from ${n.stale}, but the model was changed after that run, so the result is the one from before the change. Add Run simulation between them.`,
      { fix: { label: 'Add Run simulation before this', op: { op: 'insertBefore', nodeId: cx.id, type: 'px.run' } } });
  }
  if (n.afterRun) {
    cx.warn(`${cx.label} changes the model after ${n.afterRun} has run, so that run does not include the change. The next Run simulation builds the case again and does.`);
  }
}

// ---------------------------------------------------------------------------------------------
// Components

// Components are found again before every step that uses them (volatile: true): a case that
// switched scenario, layer state or project has other components in it.
defineBlock({
  type: 'px.component', cat: CAT, kind: 'pure', volatile: true,
  title: 'Component',
  desc: 'Finds a component in the case by its definition and Name, or every match. Looks on every page, module pages included.',
  keywords: ['component', 'find', 'definition', 'master', 'source', 'resistor', 'breaker', 'fault', 'machine', 'transformer', 'pick', 'find_all'],
  outputs: [{ id: 'el', label: 'Component', type: 'obj', var: 'component' }],
  settings: [
    elementSetting('el', 'Component', 'master:source_3'),
    { key: 'enabled', label: 'Only components that are enabled', kind: 'bool', default: false, more: true,
      tip: 'Leave out disabled components and those on a layer that is not Enabled (a match that is only those then stops with a message).' },
    { key: 'page', label: 'Only on this page', kind: 'text', default: '', more: true, placeholder: 'e.g. Main (empty: every page)',
      tip: 'Search one page by its definition name instead of the whole case. Empty looks everywhere, module pages included.' },
  ],
  ports(s) {
    const all = s.el && s.el.match === 'all';
    return { outputs: [{ id: 'el', label: all ? 'Components' : 'Component', type: 'obj', var: all ? 'components' : 'component' }] };
  },
  summary(s) {
    const bits = [elemText(s.el, 'No component chosen yet')];
    if (s.enabled) bits.push('enabled only');
    if (String(s.page || '').trim()) bits.push(`on ${s.page}`);
    return bits.join(', ');
  },
  varName(s) {
    const e = s.el || {};
    const name = String(e.name || '').trim();
    if (name && !/[*?]/.test(name) && e.match !== 'all') return name;
    const cls = String(e.cls || '').split(':').pop() || 'component';
    return e.match === 'all' ? `${cls} list` : cls;
  },
  helpers: ['px_find'],
  emit(cx) {
    routeAt(cx);
    // A calculator gives back the expression itself, not a line.
    return withFindOpts(cx, cx.element('el'));
  },
  validate(cx) { notesOf(cx); },
});

// px_find(...) with the extra arguments the settings ask for.
function withFindOpts(cx, e) {
  if (e === 'None' || !/\)$/.test(e)) return e;
  const extra = [];
  if (pinned(cx, 'enabled')) extra.push(`enabled=${cx.val('enabled')}`);
  else if (cx.s.enabled) extra.push('enabled=True');
  const page = String(cx.s.page || '').trim();
  if (pinned(cx, 'page')) extra.push(`page=${cx.val('page')}`);
  else if (page) extra.push(`page=${cx.lit(page)}`);
  return extra.length ? e.replace(/\)$/, ', ' + extra.join(', ') + ')') : e;
}

// The components a For each component loop goes over.
function componentList(cx) {
  if (cx.has('items')) { cx.helper('convert'); return `as_items(${cx.in('items')})`; }
  const s = cx.s;
  const param = String(s.param || '').trim();
  const el = s.el && typeof s.el === 'object' ? s.el : {};
  if (param || pinned(cx, 'param')) {
    cx.helper('find_components');
    const cls = pinned(cx, 'el') ? cx.val('el') : cx.lit(String(el.cls || ''));
    const name = cx.lit(String(el.name || '').trim());
    return `find_components(app, ${cls}, ${name}, ${pinned(cx, 'param') ? `${cx.val('param')} or None` : cx.val('param')}, ${cx.val('op')}, ${cx.val('value')}, ${cx.val('enabled')})`;
  }
  cx.helper('convert');
  const e = cx.element('el');
  if (e === 'None') return '[]';
  return `as_items(${withFindOpts(cx, e)})`;
}

defineBlock({
  type: 'px.foreach_component', cat: CAT, kind: 'loop',
  title: 'For each component',
  desc: 'Repeats the Each pass steps for every component of a definition (sorted by name), or for each component of a list wired in.',
  keywords: ['for each', 'loop', 'components', 'every source', 'every breaker', 'all faults', 'iterate', 'filter'],
  inputs: [{ id: 'items', label: 'Components', type: 'obj', fallback: 'el', tip: 'Optional: loop over these components instead of searching.' }],
  outputs: [
    { id: 'item', label: 'Component', type: 'obj', scope: 'body', var: 'component', tip: 'The component of this pass.' },
    { id: 'elname', label: 'Name', type: 'text', scope: 'body', var: 'component_name', more: true },
    { id: 'index', label: 'Pass no.', type: 'num', scope: 'body', var: 'pass_no', more: true, tip: 'The pass number, 1 for the first pass.' },
    { id: 'count', label: 'Number of passes', type: 'num', scope: 'done', var: 'passes', more: true },
  ],
  settings: [
    nameSetting('Component'),
    elementSetting('el', 'Components', 'master:breaker3', { match: 'all', tip: 'The definition, and a Name with * when only some of them. Used while nothing is wired into Components.' }),
    { key: 'enabled', label: 'Only components that are enabled', kind: 'bool', default: false, showIf: (s, cx) => !(cx && cx.wired && cx.wired.has('items')) },
    { key: 'param', label: 'Only where this parameter', kind: 'attr', default: '', more: true, placeholder: 'e.g. R',
      showIf: (s, cx) => !(cx && cx.wired && cx.wired.has('items')),
      tip: 'Leave empty to use every match. With a parameter, only components whose value compares as set below.' },
    { key: 'op', label: 'Compares', kind: 'select', default: '=', more: true, options: [['=', '='], ['!=', '≠'], ['>', '>'], ['>=', '≥'], ['<', '<'], ['<=', '≤']],
      showIf: (s, cx) => !!String(s.param || '').trim() && !(cx && cx.wired && cx.wired.has('items')),
      optionsFor: (s) => (/[*?]/.test(String(s.value || '')) ? ['=', '!='] : null) },
    { key: 'value', label: 'With', kind: 'text', default: '', more: true, placeholder: 'e.g. 1.0',
      showIf: (s, cx) => !!String(s.param || '').trim() && !(cx && cx.wired && cx.wired.has('items')),
      tip: 'A number, or a text (with * as a pattern).' },
    restoreSetting, onErrorSetting,
  ],
  summary(s) { return 'Each of ' + elemText({ ...(s.el || {}), match: 'all' }) + (String(s.param || '').trim() ? ` where ${s.param} ${s.op} ${s.value}` : ''); },
  helpers: ['px_find', 'convert'],
  itemOutput: 'item',
  itemList(cx) { return componentList(cx); },
  emit(cx) {
    routeAt(cx);
    const lst = listName(cx, 'components');
    const i = cx.out('index');
    const it = cx.out('item');
    cx.helper('px_get');
    cx.out('elname', `px_get(${it}, "Name", default="")`);
    cx.out('count', `len(${lst})`);
    cx.helper('log');
    const lines = [`${lst} = ${componentList(cx)}`, `if not ${lst}:`, `    log(${cx.lit(cx.label + ': no component to loop over.')}, "warn")`];
    enterLoop(cx, cx.s.restore !== 'never');
    return { lines, header: `for ${i}, ${it} in enumerate(${lst}, 1):`, iter: { i, n: `len(${lst})` }, ctx: [passLabel(cx, 'Component'), it] };
  },
  validate(cx) {
    notesOf(cx);
    const el = cx.s.el || {};
    if (!cx.has('items') && !String(el.cls || '').trim() && !String(el.name || '').trim()) {
      cx.todo(`Choose the components for ${cx.label}, or wire a list into Components.`);
    }
  },
});

// ---------------------------------------------------------------------------------------------
// Parameters

defineBlock({
  type: 'px.set', cat: CAT, kind: 'action',
  title: 'Set parameter',
  desc: 'Writes one parameter of a component (or of each component of a list), such as a resistance, a set point or a fault duration. Put back at the end of the pass or the workflow.',
  keywords: ['set', 'write', 'parameter', 'change', 'value', 'resistance', 'set point', 'duration', 'parameters'],
  inputs: [objInput('obj', 'Component', 'el'), { id: 'value', label: 'Value', type: 'num', fallback: 'value' }],
  settings: [
    elementSetting('el', 'Component', 'master:resistor'),
    { key: 'param', label: 'Parameter', kind: 'attr', default: '', required: true, placeholder: 'e.g. R',
      tip: 'The parameter name as PSCAD holds it, from the component’s own dialog. Letter case counts.' },
    { key: 'vtype', label: 'The value is', kind: 'select', default: 'num', noPin: true, options: [['num', 'A number'], ['text', 'A text or a choice']],
      optionsFor: valueKinds('el') },
    { key: 'value', label: 'Value', kind: 'number', default: 0, showIf: (s) => s.vtype !== 'text' },
    { key: 'text', label: 'Value', kind: 'text', default: '', showIf: (s) => s.vtype === 'text',
      tip: 'A choice is written the way the Automation Library names it, in capitals: RESISTIVE, YES, BEHIND_SOURCE_IMPEDANCE.' },
    { key: 'unit', label: 'Unit of the value', kind: 'select', default: 'none', more: true, options: UNIT_OPTIONS,
      showIf: (s, cx) => s.vtype !== 'text' && unitApplies('el', 'obj')(s, cx), optionsFor: unitOptions('el'),
      tip: 'The value is converted into the unit PSCAD holds the parameter in, so 2500 mohm goes in as 2.5 ohm.' },
  ],
  ports(s) {
    return { inputs: [objInput('obj', 'Component', 'el'), s.vtype === 'text' ? { id: 'value', label: 'Value', type: 'text', fallback: 'text' } : { id: 'value', label: 'Value', type: 'num', fallback: 'value' }] };
  },
  summary(s) {
    const v = s.vtype === 'text' ? `"${s.text}"` : `${s.value}${s.unit !== 'none' ? ' ' + s.unit : ''}`;
    return `${elemText(s.el)}.${s.param || '?'} = ${v}`;
  },
  helpers: ['px_set'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    noteModelChange(cx, { rebuild: true });
    cx.helper('px_set');
    return [`px_set(${cx.in('obj')}, ${cx.val('param')}, ${cx.in('value')}, ${noneOr(cx, 'unit')})`];
  },
  validate(cx) {
    warnRoute(cx);
    const el = cx.s.el || {};
    const param = String(cx.s.param || '').trim();
    if (param && !cx.has('obj') && hasParam(el.cls, param) === false) {
      cx.warn(`${el.cls} has no parameter called "${param}". Check the name in the component’s dialog in PSCAD; letter case counts.`);
    }
  },
});

defineBlock({
  type: 'px.get', cat: CAT, kind: 'action',
  title: 'Read parameter',
  desc: 'Reads one parameter of a component, or of every component of a list (its highest, lowest or all values).',
  keywords: ['read', 'get', 'parameter', 'value', 'parameters', 'rating', 'impedance'],
  inputs: [objInput('obj', 'Component', 'el')],
  outputs: [{ id: 'value', label: 'Value', type: 'num', var: 'value' }],
  settings: [
    elementSetting('el', 'Component', 'master:resistor'),
    { key: 'param', label: 'Parameter', kind: 'attr', default: '', required: true, placeholder: 'e.g. R',
      tip: 'The parameter name as PSCAD holds it, from the component’s own dialog. Letter case counts.' },
    { key: 'pick', label: 'From a list, take', kind: 'select', default: 'all', more: true,
      options: [['all', 'Every value'], ['max', 'The highest'], ['min', 'The lowest']],
      showIf: (s, cx) => (cx && cx.wired && cx.wired.has('obj')) || (s.el && s.el.match === 'all'),
      tip: 'What to give back when several components are read: the list, or one of them.' },
    { key: 'unit', label: 'Read it in', kind: 'select', default: 'none', more: true, options: UNIT_OPTIONS,
      showIf: unitApplies('el', 'obj'), optionsFor: unitOptions('el'),
      tip: 'Convert the value into this unit. Only possible inside one kind, so a resistance can be read in kohm but a percentage cannot be converted at all.' },
  ],
  ports(s) {
    const many = s.el && s.el.match === 'all';
    const outs = [{ id: 'value', label: many && s.pick === 'all' ? 'Values' : 'Value', type: 'num', var: 'value' }];
    if (many) {
      outs.push({ id: 'at', label: 'Component', type: 'obj', var: 'at_component', more: true, tip: 'The component the highest or lowest value came from.' });
      outs.push({ id: 'n', label: 'How many', type: 'num', var: 'how_many', more: true });
    }
    return { outputs: outs };
  },
  summary(s) {
    const pick = s.el && s.el.match === 'all' && s.pick !== 'all' ? (s.pick === 'max' ? 'highest ' : 'lowest ') : '';
    return `${pick}${elemText(s.el)}.${s.param || '?'}`;
  },
  varName(s) { return String(s.param || 'value'); },
  helpers: ['px_get'],
  effects: { writes: [], reads: ['model'] },
  emit(cx) {
    routeAt(cx);
    const many = (cx.s.el && cx.s.el.match === 'all') || cx.inType('obj') === 'obj' && false;
    cx.helper('px_get');
    if (!many) return [`${cx.out('value')} = px_get(${cx.in('obj')}, ${cx.val('param')}, ${noneOr(cx, 'unit')})`];
    const r = cx.name('reading');
    const pick = cx.s.pick === 'max' ? '.max' : cx.s.pick === 'min' ? '.min' : '.values';
    cx.out('value', r + pick);
    cx.out('at', r + (cx.s.pick === 'min' ? '.at_min' : '.at_max'));
    cx.out('n', r + '.n');
    return [`${r} = px_get_all(${cx.in('obj')}, ${cx.val('param')}, ${noneOr(cx, 'unit')})`];
  },
  validate(cx) {
    warnRoute(cx);
    const el = cx.s.el || {};
    const param = String(cx.s.param || '').trim();
    if (param && !cx.has('obj') && hasParam(el.cls, param) === false) {
      cx.warn(`${el.cls} has no parameter called "${param}". Check the name in the component’s dialog in PSCAD; letter case counts.`);
    }
  },
});

defineBlock({
  type: 'px.enable', cat: CAT, kind: 'action',
  title: 'Enable or disable component',
  desc: 'Takes a component out of the build, or puts it back. A disabled component is not in the compiled case at all, which is how PSCAD takes a branch, a machine or a control block out.',
  keywords: ['enable', 'disable', 'out of service', 'remove', 'bypass', 'outage', 'n-1'],
  inputs: [objInput('obj', 'Component', 'el')],
  outputs: [{ id: 'n', label: 'How many changed', type: 'num', var: 'changed', more: true }],
  settings: [
    elementSetting('el', 'Component', 'master:breaker3'),
    { key: 'on', label: 'Make it', kind: 'select', default: 'off', options: [['off', 'Disabled (out of the build)'], ['on', 'Enabled']] },
  ],
  summary(s) { return `${elemText(s.el)}: ${s.on === 'on' ? 'enabled' : 'disabled'}`; },
  helpers: ['set_enabled'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    noteModelChange(cx, { rebuild: true });
    cx.helper('set_enabled');
    const on = pinned(cx, 'on') ? `(${cx.val('on')} == "on")` : (cx.s.on === 'on' ? 'True' : 'False');
    return [`${cx.out('n')} = set_enabled(${cx.in('obj')}, ${on})`];
  },
  validate(cx) { warnRoute(cx); },
});

defineBlock({
  type: 'px.undo', cat: CAT, kind: 'action',
  title: 'Put changed values back',
  desc: 'Puts back every parameter, layer state and substitution the workflow has changed so far, now rather than at the end.',
  keywords: ['undo', 'restore', 'put back', 'revert', 'reset', 'original'],
  outputs: [{ id: 'n', label: 'How many put back', type: 'num', var: 'put_back', more: true }],
  settings: [],
  summary() { return 'Everything changed so far'; },
  helpers: ['px_undo'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    noteModelChange(cx, { rebuild: true });
    cx.helper('px_undo');
    return [`${cx.out('n')} = px_undo()`];
  },
  validate(cx) { notesOf(cx); },
});

// ---------------------------------------------------------------------------------------------
// Layers

defineBlock({
  type: 'px.layer.set', cat: CAT, kind: 'action',
  title: 'Set layer state',
  desc: 'Puts one layer of the case into a state. A layer switches a whole group of components together, which is how one case holds alternative network arrangements.',
  keywords: ['layer', 'state', 'enable', 'disable', 'invisible', 'configuration', 'variant', 'arrangement'],
  inputs: [{ id: 'name', label: 'Layer', type: 'text', fallback: 'layer' }],
  outputs: [{ id: 'state', label: 'State', type: 'text', var: 'layer_state', more: true }],
  settings: [
    { key: 'layer', label: 'Layer', kind: 'text', default: '', required: true, placeholder: 'Exactly as in PSCAD',
      tip: 'The layer name as the case holds it. Letter case does not matter for the state, but it does for the name.' },
    { key: 'state', label: 'State', kind: 'select', default: 'Enabled', options: [['Enabled', 'Enabled'], ['Disabled', 'Disabled'], ['Invisible', 'Invisible']],
      tip: 'Enabled builds the layer in, Disabled leaves it out of the build, Invisible also hides it on the page. A state the layer does not have is matched to its nearest.' },
  ],
  summary(s) { return `${s.layer || 'layer'}: ${s.state}`; },
  helpers: ['layers'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    noteModelChange(cx, { rebuild: true });
    cx.helper('layers');
    return [`${cx.out('state')} = layer_set(app, ${cx.in('name')}, ${cx.val('state')})`];
  },
  validate(cx) { warnRoute(cx); },
});

defineBlock({
  type: 'px.layer.create', cat: CAT, kind: 'action',
  title: 'Create layer',
  desc: 'Makes a layer in the case and gives it back, so later steps can put components on it and switch it.',
  keywords: ['layer', 'create', 'new', 'group', 'configuration'],
  inputs: [{ id: 'name', label: 'Name', type: 'text', fallback: 'layer' }],
  outputs: [{ id: 'name', label: 'Layer', type: 'text', var: 'layer' }],
  settings: [
    { key: 'layer', label: 'Name', kind: 'text', default: 'PXB_layer', required: true,
      tip: 'A name PSCAD accepts: letters, digits and underscores, starting with a letter. Anything else is turned into one.' },
    { key: 'state', label: 'Starting state', kind: 'select', default: 'Enabled', more: true, options: [['Enabled', 'Enabled'], ['Disabled', 'Disabled'], ['Invisible', 'Invisible']] },
    { key: 'keep', label: 'Keep it after the run', kind: 'bool', default: false, more: true,
      tip: 'Off: the layer is taken away when the workflow ends, so the case is left as it was found.' },
    { key: 'ifExists', label: 'If it is already there', kind: 'select', default: 'reuse', more: true,
      options: [['reuse', 'Use the one that is there'], ['new', 'Make another with a number']] },
  ],
  summary(s) { return `${s.layer || 'layer'} (${s.state})${s.keep ? ', kept' : ''}`; },
  helpers: ['layers'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    noteModelChange(cx);
    cx.helper('layers');
    return [`${cx.out('name')} = layer_create(app, ${cx.in('name')}, ${cx.val('state')}, ${cx.val('keep')}, ${cx.val('ifExists')}).name`];
  },
  validate(cx) { notesOf(cx); },
});

defineBlock({
  type: 'px.layer.add', cat: CAT, kind: 'action',
  title: 'Put components on a layer',
  desc: 'Adds a component (or every component of a list) to a layer, so one switch takes them all out of the build together.',
  keywords: ['layer', 'add', 'group', 'put on'],
  inputs: [objInput('obj', 'Components', 'el'), { id: 'name', label: 'Layer', type: 'text', fallback: 'layer' }],
  outputs: [{ id: 'n', label: 'How many', type: 'num', var: 'added', more: true }],
  settings: [
    elementSetting('el', 'Components', 'master:breaker3', { match: 'all' }),
    { key: 'layer', label: 'Layer', kind: 'text', default: '', required: true },
  ],
  summary(s) { return `${elemText(s.el)} → ${s.layer || 'layer'}`; },
  helpers: ['layers'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    noteModelChange(cx);
    cx.helper('layers');
    return [`${cx.out('n')} = layer_add(app, ${cx.in('obj')}, ${cx.in('name')})`];
  },
  validate(cx) { notesOf(cx); },
});

defineBlock({
  type: 'px.layer.foreach', cat: CAT, kind: 'loop',
  title: 'For each layer',
  desc: 'Repeats the Each pass steps with each layer enabled in turn and the others disabled, so one case runs each of its arrangements.',
  keywords: ['for each', 'loop', 'layer', 'every arrangement', 'variant', 'configuration', 'n-1'],
  inputs: [{ id: 'items', label: 'Layers', type: 'text', fallback: 'layers', tip: 'Optional: a list of layer names to go over instead of the names typed here.' }],
  outputs: [
    { id: 'item', label: 'Layer', type: 'text', scope: 'body', var: 'layer', tip: 'The layer of this pass.' },
    { id: 'index', label: 'Pass no.', type: 'num', scope: 'body', var: 'pass_no', more: true },
    { id: 'count', label: 'Number of passes', type: 'num', scope: 'done', var: 'passes', more: true },
  ],
  settings: [
    nameSetting('Layer'),
    { key: 'layers', label: 'Layers', kind: 'textarea', default: '*', placeholder: 'One layer name per line, or * for every layer',
      tip: 'Which layers to go over. A single * means every layer in the case.' },
    { key: 'state', label: 'Each pass makes its layer', kind: 'select', default: 'Enabled', more: true, options: [['Enabled', 'Enabled'], ['Disabled', 'Disabled'], ['Invisible', 'Invisible']] },
    { key: 'others', label: 'And the other layers', kind: 'select', default: 'Disabled', more: true,
      options: [['Disabled', 'Disabled'], ['Invisible', 'Invisible'], ['none', 'Leave them as they are']],
      tip: 'By default only one layer of the list is in at a time, which is what makes each pass one arrangement.' },
    restoreSetting, onErrorSetting,
  ],
  summary(s) {
    const rows = parseLines(s.layers);
    const every = rows.length === 1 && rows[0] === '*';
    return every ? 'Each layer in the case' : `Each of ${rows.length || 'no'} layer${rows.length === 1 ? '' : 's'}`;
  },
  helpers: ['layers', 'convert'],
  itemOutput: 'item',
  itemList(cx) { return layerList(cx); },
  emit(cx) {
    routeAt(cx);
    const lst = listName(cx, 'layers');
    const i = cx.out('index');
    const it = cx.out('item');
    cx.out('count', `len(${lst})`);
    cx.helper('layers', 'log', 'convert');
    const lines = [`${lst} = ${layerList(cx)}`, `if not ${lst}:`, `    log(${cx.lit(cx.label + ': no layer to loop over.')}, "warn")`];
    enterLoop(cx, cx.s.restore !== 'never');
    return {
      lines,
      header: `for ${i}, ${it} in enumerate(each_layer(app, ${lst}, ${cx.val('state')}, ${noneOr(cx, 'others')}), 1):`,
      iter: { i, n: `len(${lst})` }, ctx: [passLabel(cx, 'Layer'), it],
    };
  },
  validate(cx) {
    notesOf(cx);
    if (!cx.has('items') && !parseLines(cx.s.layers).length) {
      cx.todo(`Type the layer names for ${cx.label} (or a single * for every layer), or wire a list in.`);
    }
  },
});

function layerList(cx) {
  if (cx.has('items')) return `as_items(${cx.in('items')})`;
  const rows = parseLines(cx.s.layers);
  if (pinned(cx, 'layers')) return `as_items(${cx.val('layers')})`;
  // A single * is every layer the case has, worked out when the script runs.
  if (rows.length === 1 && rows[0] === '*') return 'list(layer_list(app, "*"))';
  return cx.lit(rows);
}

// ---------------------------------------------------------------------------------------------
// Scenarios

defineBlock({
  type: 'px.scen.activate', cat: CAT, kind: 'action',
  title: 'Activate scenario',
  desc: 'Switches the case to one of its scenarios, which brings back every component value that scenario holds.',
  keywords: ['scenario', 'activate', 'switch', 'operating point', 'dispatch', 'case'],
  inputs: [{ id: 'name', label: 'Scenario', type: 'text', fallback: 'scenario' }],
  outputs: [{ id: 'name', label: 'Scenario', type: 'text', var: 'scenario', more: true }],
  settings: [
    { key: 'scenario', label: 'Scenario', kind: 'text', default: '', required: true, placeholder: 'Exactly as in PSCAD',
      tip: 'A scenario the case already has. PSCAD 5.0 cannot make one from a script, so make it once in PSCAD.' },
  ],
  summary(s) { return s.scenario || 'no scenario chosen'; },
  helpers: ['scenarios'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    noteModelChange(cx, { rebuild: true });
    cx.helper('scenarios');
    return [`${cx.out('name')} = scenario_activate(app, ${cx.in('name')})`];
  },
  validate(cx) { warnRoute(cx); },
});

defineBlock({
  type: 'px.scen.save', cat: CAT, kind: 'action',
  title: 'Save scenario',
  desc: 'Saves the values in use now into the current scenario, so they are there the next time it is activated.',
  keywords: ['scenario', 'save', 'keep', 'store', 'operating point'],
  inputs: [{ id: 'name', label: 'Save as', type: 'text', fallback: 'scenario', more: true }],
  outputs: [{ id: 'ok', label: 'Saved', type: 'bool', var: 'saved', more: true }],
  settings: [
    { key: 'scenario', label: 'Save as', kind: 'text', default: '', placeholder: 'Empty: the scenario in use now',
      tip: 'Empty saves into the scenario that is active. A new name needs PSCAD 5.1 or newer; on 5.0 the step says so and goes on.' },
  ],
  summary(s) { return s.scenario ? `as ${s.scenario}` : 'the one in use now'; },
  helpers: ['scenarios'],
  effects: { writes: ['model'], reads: ['model'] },
  emit(cx) {
    routeAt(cx);
    cx.helper('scenarios');
    return [`${cx.out('ok')} = scenario_save(app, ${cx.in('name')})`];
  },
  validate(cx) { notesOf(cx); },
});

defineBlock({
  type: 'px.scen.foreach', cat: CAT, kind: 'loop',
  title: 'For each scenario',
  desc: 'Repeats the Each pass steps with each scenario of the case active in turn.',
  keywords: ['for each', 'loop', 'scenario', 'every operating point', 'dispatch', 'cases'],
  inputs: [{ id: 'items', label: 'Scenarios', type: 'text', fallback: 'scenarios' }],
  outputs: [
    { id: 'item', label: 'Scenario', type: 'text', scope: 'body', var: 'scenario' },
    { id: 'index', label: 'Pass no.', type: 'num', scope: 'body', var: 'pass_no', more: true },
    { id: 'count', label: 'Number of passes', type: 'num', scope: 'done', var: 'passes', more: true },
  ],
  settings: [
    nameSetting('Scenario'),
    { key: 'match', label: 'Scenarios', kind: 'text', default: '*', placeholder: '* for every one, or Base*',
      tip: 'Which of the case’s scenarios to go over. * matches anything.' },
    restoreSetting, onErrorSetting,
  ],
  summary(s) { return String(s.match || '*') === '*' ? 'Each scenario of the case' : `Each scenario matching ${s.match}`; },
  helpers: ['scenarios', 'convert'],
  itemOutput: 'item',
  itemList(cx) { return scenarioList(cx); },
  emit(cx) {
    routeAt(cx);
    const lst = listName(cx, 'scenarios');
    const i = cx.out('index');
    const it = cx.out('item');
    cx.out('count', `len(${lst})`);
    cx.helper('scenarios', 'log', 'convert');
    const lines = [`${lst} = ${scenarioList(cx)}`, `if not ${lst}:`, `    log(${cx.lit(cx.label + ': the case has no scenario to loop over.')}, "warn")`];
    enterLoop(cx, cx.s.restore !== 'never');
    return {
      lines, header: `for ${i}, ${it} in enumerate(each_scenario(app, ${lst}), 1):`,
      iter: { i, n: `len(${lst})` }, ctx: [passLabel(cx, 'Scenario'), it],
    };
  },
  validate(cx) { notesOf(cx); },
});

function scenarioList(cx) {
  if (cx.has('items')) return `as_items(${cx.in('items')})`;
  return `scenario_list(app, ${cx.val('match')})`;
}

// ---------------------------------------------------------------------------------------------
// Global substitutions

defineBlock({
  type: 'px.gs.set', cat: CAT, kind: 'action',
  title: 'Set global substitution',
  desc: 'Sets one named value of the case. Every component whose parameter writes $(name) reads it, so one write changes the whole model at once.',
  keywords: ['global substitution', 'substitution', 'parameter', 'variable', 'dollar', 'freq', 'set', 'case parameter'],
  inputs: [{ id: 'value', label: 'Value', type: 'num', fallback: 'value' }, { id: 'name', label: 'Name', type: 'text', fallback: 'sub', more: true }],
  outputs: [{ id: 'value', label: 'Value', type: 'num', var: 'value', more: true }],
  settings: [
    { key: 'sub', label: 'Name', kind: 'text', default: '', required: true, placeholder: 'e.g. Rfault',
      tip: 'The substitution name without the $( ). A component reads it by writing $(Rfault) in one of its parameters.' },
    { key: 'vtype', label: 'The value is', kind: 'select', default: 'num', noPin: true, options: [['num', 'A number'], ['text', 'A text']] },
    { key: 'value', label: 'Value', kind: 'number', default: 0, showIf: (s) => s.vtype !== 'text' },
    { key: 'text', label: 'Value', kind: 'text', default: '', showIf: (s) => s.vtype === 'text',
      tip: 'A text value may carry its own unit, as PSCAD writes it: 2.5 [ohm].' },
    { key: 'create', label: 'Make it if the case has none', kind: 'bool', default: true, more: true,
      tip: 'Off: a name the case does not have is an error instead, which catches a typo.' },
    { key: 'set', label: 'In the substitution set', kind: 'text', default: '', more: true, placeholder: 'Empty: the active set',
      tip: 'Which set to write in. Empty writes in the set that is active, or in the case’s one unnamed set.' },
  ],
  ports(s) {
    return { inputs: [s.vtype === 'text' ? { id: 'value', label: 'Value', type: 'text', fallback: 'text' } : { id: 'value', label: 'Value', type: 'num', fallback: 'value' },
      { id: 'name', label: 'Name', type: 'text', fallback: 'sub', more: true }] };
  },
  summary(s) { return `$(${s.sub || '?'}) = ${s.vtype === 'text' ? `"${s.text}"` : s.value}`; },
  helpers: ['globalsub'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    noteModelChange(cx, { rebuild: true });
    cx.helper('globalsub');
    const set = String(cx.s.set || '').trim() || pinned(cx, 'set') ? noneOr(cx, 'set', '') : 'None';
    return [`${cx.out('value')} = gs_set(app, ${cx.in('name')}, ${cx.in('value')}, ${cx.val('create')}, ${set})`];
  },
  validate(cx) { warnRoute(cx); },
});

defineBlock({
  type: 'px.gs.get', cat: CAT, kind: 'action',
  title: 'Read global substitution',
  desc: 'Reads one named value of the case, as a number where it is one.',
  keywords: ['global substitution', 'substitution', 'read', 'get', 'variable', 'case parameter'],
  inputs: [{ id: 'name', label: 'Name', type: 'text', fallback: 'sub', more: true }],
  outputs: [{ id: 'value', label: 'Value', type: 'num', var: 'value' }],
  settings: [
    { key: 'sub', label: 'Name', kind: 'text', default: '', required: true, placeholder: 'e.g. f' },
    { key: 'set', label: 'In the substitution set', kind: 'text', default: '', more: true, placeholder: 'Empty: the active set' },
  ],
  summary(s) { return `$(${s.sub || '?'})`; },
  varName(s) { return String(s.sub || 'value'); },
  helpers: ['globalsub'],
  effects: { writes: [], reads: ['model'] },
  emit(cx) {
    routeAt(cx);
    cx.helper('globalsub');
    const set = String(cx.s.set || '').trim() || pinned(cx, 'set') ? noneOr(cx, 'set', '') : 'None';
    return [`${cx.out('value')} = gs_get(app, ${cx.in('name')}, None, ${set})`];
  },
  validate(cx) { notesOf(cx); },
});

defineBlock({
  type: 'px.gs.setactive', cat: CAT, kind: 'action',
  title: 'Activate substitution set',
  desc: 'Switches the case to one of its sets of global substitutions, so every $(name) in the model takes that set’s value.',
  keywords: ['global substitution', 'set', 'activate', 'switch', 'parameter set', 'variant'],
  inputs: [{ id: 'name', label: 'Set', type: 'text', fallback: 'set' }],
  outputs: [{ id: 'name', label: 'Set', type: 'text', var: 'sub_set', more: true }],
  settings: [
    { key: 'set', label: 'Set', kind: 'text', default: '', required: true, placeholder: 'Exactly as in PSCAD',
      tip: 'A set the case already has. Making one from a script closes PSCAD 5.0’s connection, so the sets are made in PSCAD or loaded from a CSV file.' },
  ],
  summary(s) { return s.set || 'no set chosen'; },
  helpers: ['globalsub'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    noteModelChange(cx, { rebuild: true });
    cx.helper('globalsub');
    return [`${cx.out('name')} = gs_set_active(app, ${cx.in('name')})`];
  },
  validate(cx) { warnRoute(cx); },
});

defineBlock({
  type: 'px.gs.foreach', cat: CAT, kind: 'loop',
  title: 'For each substitution set',
  desc: 'Repeats the Each pass steps with each set of global substitutions active in turn: one case, one run per parameter set.',
  keywords: ['for each', 'loop', 'global substitution', 'set', 'parameter set', 'sweep', 'variant'],
  inputs: [{ id: 'items', label: 'Sets', type: 'text', fallback: 'sets' }],
  outputs: [
    { id: 'item', label: 'Set', type: 'text', scope: 'body', var: 'sub_set' },
    { id: 'index', label: 'Pass no.', type: 'num', scope: 'body', var: 'pass_no', more: true },
    { id: 'count', label: 'Number of passes', type: 'num', scope: 'done', var: 'passes', more: true },
  ],
  settings: [nameSetting('Set'), restoreSetting, onErrorSetting],
  summary() { return 'Each substitution set of the case'; },
  helpers: ['globalsub', 'convert'],
  itemOutput: 'item',
  itemList(cx) { return cx.has('items') ? `as_items(${cx.in('items')})` : 'gs_sets(app)'; },
  emit(cx) {
    routeAt(cx);
    const lst = listName(cx, 'sets');
    const i = cx.out('index');
    const it = cx.out('item');
    cx.out('count', `len(${lst})`);
    cx.helper('globalsub', 'log', 'convert');
    const lines = [`${lst} = [n for n in ${cx.has('items') ? `as_items(${cx.in('items')})` : 'gs_sets(app)'} if n]`,
      `if not ${lst}:`,
      `    log(${cx.lit(cx.label + ': the case has no named substitution set to loop over.')}, "warn")`];
    enterLoop(cx, cx.s.restore !== 'never');
    return {
      lines, header: `for ${i}, ${it} in enumerate(each_gs_set(app, ${lst}), 1):`,
      iter: { i, n: `len(${lst})` }, ctx: [passLabel(cx, 'Set'), it],
    };
  },
  validate(cx) { notesOf(cx); },
});

// ---------------------------------------------------------------------------------------------
// Input controls

defineBlock({
  type: 'px.control', cat: CAT, kind: 'action',
  title: 'Set a control',
  desc: 'Sets a slider, switch, dial or button on the case’s control panel. PSCAD drives a case through its controls rather than an event list, so this is how a script changes a set point or closes a switch.',
  keywords: ['slider', 'switch', 'dial', 'button', 'control', 'panel', 'set point', 'runtime', 'knob', 'press'],
  inputs: [objInput('obj', 'Control', 'el'), { id: 'value', label: 'Value', type: 'num', fallback: 'value' }],
  outputs: [{ id: 'value', label: 'Value', type: 'num', var: 'value', more: true }],
  settings: [
    elementSetting('el', 'Control', 'Slider', { example: 'Pref' }),
    { key: 'kind', label: 'It is a', kind: 'select', default: 'auto',
      options: [['auto', 'Work it out'], ['slider', 'Slider (a number)'], ['switch', 'Switch (on or off)'], ['dial', 'Dial (a position)'], ['button', 'Button (press it)']],
      tip: '"Work it out" reads what the control is from PSCAD, which is right whenever the control was found by its own definition.' },
    { key: 'value', label: 'Value', kind: 'number', default: 0, showIf: (s) => s.kind === 'slider' || s.kind === 'auto' },
    { key: 'on', label: 'Position', kind: 'select', default: 'on', options: [['on', 'On'], ['off', 'Off']], showIf: (s) => s.kind === 'switch' },
    { key: 'pos', label: 'Position', kind: 'number', default: 1, min: 1, step: 1, showIf: (s) => s.kind === 'dial',
      tip: 'Which position of the dial, counting from 1.' },
  ],
  ports(s) {
    if (s.kind === 'button') return { inputs: [objInput('obj', 'Control', 'el')] };
    if (s.kind === 'switch') return { inputs: [objInput('obj', 'Control', 'el'), { id: 'value', label: 'On', type: 'bool', fallback: 'on' }] };
    return { inputs: [objInput('obj', 'Control', 'el'), { id: 'value', label: 'Value', type: 'num', fallback: s.kind === 'dial' ? 'pos' : 'value' }] };
  },
  summary(s) {
    const what = elemText(s.el, 'the control');
    if (s.kind === 'button') return `press ${what}`;
    if (s.kind === 'switch') return `${what}: ${s.on}`;
    if (s.kind === 'dial') return `${what}: position ${s.pos}`;
    return `${what} = ${s.value}`;
  },
  helpers: ['controls'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    noteModelChange(cx);
    cx.helper('controls');
    const k = cx.s.kind;
    let value = 'None';
    if (k === 'button') value = 'None';
    else if (k === 'switch') value = cx.has('value') ? cx.in('value') : (pinned(cx, 'on') ? `(${cx.val('on')} == "on")` : (cx.s.on === 'on' ? 'True' : 'False'));
    else value = cx.in('value');
    const e = cx.element('el');
    const m = (cx.s.el || {}).match === 'all' ? 'all' : (cx.s.el || {}).match === 'first' ? 'first' : 'one';
    if (cx.has('obj')) return [`${cx.out('value')} = _control_one(${cx.in('obj')}, ${value}, ${cx.val('kind')})`];
    const el = cx.s.el || {};
    return [`${cx.out('value')} = control_set(app, ${cx.lit(String(el.cls || ''))}, ${cx.lit(String(el.name || '').trim())}, ${value}, ${cx.val('kind')}, ${cx.lit(m)})`];
  },
  validate(cx) {
    warnRoute(cx);
    const el = cx.s.el || {};
    if (!cx.has('obj') && !String(el.cls || '').trim() && !String(el.name || '').trim()) {
      cx.todo(`Choose the control for ${cx.label}, or wire one into Control.`);
    }
  },
});

defineBlock({
  type: 'px.control.limits', cat: CAT, kind: 'action',
  title: 'Set slider limits',
  desc: 'Widens or narrows a slider’s range, so a sweep can reach a value outside the range the model was drawn with.',
  keywords: ['slider', 'limits', 'range', 'minimum', 'maximum', 'control'],
  inputs: [objInput('obj', 'Slider', 'el'), numInput('lo', 'Lowest', 'lo'), numInput('hi', 'Highest', 'hi')],
  settings: [
    elementSetting('el', 'Slider', 'Slider', { example: 'Pref' }),
    { key: 'lo', label: 'Lowest', kind: 'number', default: 0 },
    { key: 'hi', label: 'Highest', kind: 'number', default: 1 },
  ],
  summary(s) { return `${elemText(s.el, 'the slider')}: ${s.lo} to ${s.hi}`; },
  helpers: ['controls'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    noteModelChange(cx);
    cx.helper('controls');
    const el = cx.s.el || {};
    return [`control_limits(app, ${cx.lit(String(el.cls || ''))}, ${cx.lit(String(el.name || '').trim())}, ${cx.in('lo')}, ${cx.in('hi')})`];
  },
  validate(cx) { warnRoute(cx); },
});

// ---------------------------------------------------------------------------------------------
// The cases in the workspace

defineBlock({
  type: 'px.project.use', cat: CAT, kind: 'action',
  title: 'Use another case',
  desc: 'Makes another case in the workspace the one the workflow works on, so later steps find its components and run it.',
  keywords: ['case', 'project', 'switch', 'use', 'workspace', 'another'],
  inputs: [{ id: 'name', label: 'Case', type: 'text', fallback: 'project' }],
  outputs: [{ id: 'name', label: 'Case', type: 'text', var: 'project', more: true }],
  settings: [
    { key: 'project', label: 'Case', kind: 'text', default: '', required: true, placeholder: 'The case name, not its file',
      tip: 'A case already in the workspace, by name. Load it in Start’s Libraries, or open it in PSCAD first.' },
  ],
  summary(s) { return s.project || 'no case chosen'; },
  helpers: ['projects'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    const st = noteModelChange(cx, { rebuild: true });
    st.run = null;
    cx.helper('projects');
    return [`${cx.out('name')} = project_use(app, ${cx.in('name')}).name`];
  },
  validate(cx) { notesOf(cx); },
});

defineBlock({
  type: 'px.project.save', cat: CAT, kind: 'action',
  title: 'Save the case',
  desc: 'Writes what the workflow changed into the case’s own file. Without this every change is put back when the workflow ends.',
  keywords: ['save', 'case', 'project', 'write', 'keep', 'pscx'],
  outputs: [{ id: 'ok', label: 'Saved', type: 'bool', var: 'saved', more: true }],
  settings: [],
  summary() { return 'the case in use'; },
  helpers: ['projects'],
  effects: { writes: [], reads: ['model'] },
  emit(cx) {
    routeAt(cx);
    cx.helper('projects');
    return [`${cx.out('ok')} = project_save(app)`];
  },
  validate(cx) {
    notesOf(cx);
    if (cx.startSetting('undoChanges') !== false) {
      cx.warn(`${cx.label} saves the case, but Start puts every changed value back when the workflow ends, so what is saved is the model as the workflow left it and the put-back then changes it again. Turn "Put changed values back at the end" off in Start, or use Save the case as.`);
    }
  },
});

defineBlock({
  type: 'px.project.saveas', cat: CAT, kind: 'action',
  title: 'Save the case as',
  desc: 'Writes the case to a new .pscx file, so a workflow keeps the model it built or changed without touching the reader’s own file.',
  keywords: ['save as', 'copy', 'case', 'project', 'new file', 'pscx', 'keep'],
  inputs: [{ id: 'path', label: 'File', type: 'text', fallback: 'path' }],
  outputs: [{ id: 'name', label: 'Case', type: 'text', var: 'project', more: true }],
  settings: [
    { key: 'path', label: 'File', kind: 'text', default: '', required: true, placeholder: 'e.g. out\\case_{pass}.pscx',
      tip: 'Where to write it. A relative path goes under the run folder; {pass} and the loop names are filled in.' },
  ],
  summary(s) { return s.path || 'no file chosen'; },
  helpers: ['projects'],
  effects: { writes: [], reads: ['model'] },
  emit(cx) {
    routeAt(cx);
    cx.helper('projects', 'ctx');
    return [`${cx.out('name')} = project_save_as(app, run_path(${cx.in('path')})).name`];
  },
  validate(cx) { notesOf(cx); },
});

defineBlock({
  type: 'px.project.new', cat: CAT, kind: 'action',
  title: 'New empty case',
  desc: 'Makes an empty case in the workspace and works on it, for a model the workflow builds from nothing.',
  keywords: ['new', 'case', 'project', 'empty', 'create', 'build', 'from scratch'],
  inputs: [{ id: 'path', label: 'File', type: 'text', fallback: 'path' }],
  outputs: [{ id: 'name', label: 'Case', type: 'text', var: 'project', more: true }],
  settings: [
    { key: 'path', label: 'File', kind: 'text', default: '', required: true, placeholder: 'e.g. built\\case_{pass}.pscx' },
    { key: 'keep', label: 'Keep it after the run', kind: 'bool', default: true, more: true,
      tip: 'Off: the case is taken out of the workspace when the workflow ends. Its file is left on disk either way.' },
  ],
  summary(s) { return s.path || 'no file chosen'; },
  helpers: ['projects'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    const st = noteModelChange(cx, { rebuild: true });
    st.run = null;
    cx.helper('projects', 'ctx');
    const name = cx.name('made');
    return [
      `${name} = project_new(app, run_path(${cx.in('path')}), ${cx.val('keep')})`,
      `${cx.out('name')} = project_use(app, ${name}.name).name`,
    ];
  },
  validate(cx) { notesOf(cx); },
});

// ---------------------------------------------------------------------------------------------
// Building a page

const PAGE_SETTING = {
  key: 'page', label: 'Page', kind: 'text', default: 'Main', more: true,
  tip: 'Which page of the case to draw on, by its definition name. Main is the top page.',
};
const XY = [
  { key: 'x', label: 'Across', kind: 'number', default: 10, min: 0, step: 1, unit: 'grid', tip: 'Where to put it, in PSCAD’s own grid units, counted from the left of the page.' },
  { key: 'y', label: 'Down', kind: 'number', default: 10, min: 0, step: 1, unit: 'grid' },
];
const KEEP_SETTING = {
  key: 'keep', label: 'Keep it after the run', kind: 'bool', default: false, more: true,
  tip: 'Off: what this step drew is taken off the page when the workflow ends, so a script that only instruments a case leaves it as it was.',
};

defineBlock({
  type: 'px.add.component', cat: CAT, kind: 'action',
  title: 'Add component',
  desc: 'Draws a component on a page of the case and gives it back, for a model the workflow builds or extends.',
  keywords: ['add', 'draw', 'place', 'component', 'new', 'build', 'create', 'page'],
  inputs: [numInput('x', 'Across', 'x'), numInput('y', 'Down', 'y')],
  outputs: [{ id: 'el', label: 'Component', type: 'obj', var: 'component' }],
  settings: [
    { key: 'defn', label: 'Definition', kind: 'defn', default: 'master:resistor', required: true,
      tip: 'Which component to draw, as PSCAD names its definition: master:resistor, master:source_3.' },
    ...XY,
    { key: 'name', label: 'Name it', kind: 'text', default: '', more: true, placeholder: 'Leave empty for no Name',
      tip: 'Sets the component’s Name parameter, so later steps can find it by name.' },
    { key: 'orient', label: 'Turned', kind: 'select', default: '0', more: true,
      options: [['0', 'As drawn'], ['1', 'Right'], ['2', 'Upside down'], ['3', 'Left']] },
    PAGE_SETTING, KEEP_SETTING,
  ],
  summary(s) { return `${s.defn || '?'} at (${s.x}, ${s.y})`; },
  varName(s) { return String(s.name || '').trim() || String(s.defn || 'component').split(':').pop(); },
  helpers: ['build_page'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    noteModelChange(cx, { rebuild: true });
    cx.helper('build_page');
    const extra = String(cx.s.name || '').trim() || pinned(cx, 'name') ? `, Name=${cx.val('name')}` : '';
    return [`${cx.out('el')} = add_component(app, ${cx.val('defn')}, ${cx.in('x')}, ${cx.in('y')}, ${cx.val('page')}, ${cx.val('orient')}, ${cx.val('keep')}${extra})`];
  },
  validate(cx) { warnRoute(cx); },
});

defineBlock({
  type: 'px.add.wire', cat: CAT, kind: 'action',
  title: 'Add wire',
  desc: 'Draws a wire through a list of grid points, to connect components the workflow has placed.',
  keywords: ['add', 'wire', 'connect', 'draw', 'build', 'page', 'signal'],
  outputs: [{ id: 'el', label: 'Wire', type: 'obj', var: 'wire', more: true }],
  settings: [
    { key: 'points', label: 'Points', kind: 'textarea', default: '10, 10\n16, 10', required: true,
      placeholder: 'One "across, down" pair per line',
      tip: 'The grid points the wire runs through, two or more. Two points make a straight wire.' },
    PAGE_SETTING, KEEP_SETTING,
  ],
  summary(s) { const n = pointPairs(s.points).length; return `${n} point${n === 1 ? '' : 's'}`; },
  helpers: ['build_page'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    noteModelChange(cx, { rebuild: true });
    cx.helper('build_page');
    return [`${cx.out('el')} = add_wire(app, *${pointList(cx)}, page=${cx.val('page')}, keep=${cx.val('keep')})`];
  },
  validate(cx) {
    warnRoute(cx);
    if (pointPairs(cx.s.points).length < 2) cx.todo(`${cx.label} needs at least two points, each written "across, down".`);
  },
});

defineBlock({
  type: 'px.add.bus', cat: CAT, kind: 'action',
  title: 'Add bus',
  desc: 'Draws a bus through a list of grid points and names it, for a model the workflow builds.',
  keywords: ['add', 'bus', 'busbar', 'draw', 'build', 'page', 'node'],
  outputs: [{ id: 'el', label: 'Bus', type: 'obj', var: 'bus' }],
  settings: [
    { key: 'points', label: 'Points', kind: 'textarea', default: '10, 20\n24, 20', required: true, placeholder: 'One "across, down" pair per line' },
    { key: 'name', label: 'Name it', kind: 'text', default: '', placeholder: 'e.g. BUS1' },
    PAGE_SETTING, KEEP_SETTING,
  ],
  summary(s) { return s.name ? String(s.name) : 'an unnamed bus'; },
  varName(s) { return String(s.name || 'bus'); },
  helpers: ['build_page'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    noteModelChange(cx, { rebuild: true });
    cx.helper('build_page');
    return [`${cx.out('el')} = add_bus(app, *${pointList(cx)}, page=${cx.val('page')}, keep=${cx.val('keep')}, name=${cx.val('name')})`];
  },
  validate(cx) {
    warnRoute(cx);
    if (pointPairs(cx.s.points).length < 2) cx.todo(`${cx.label} needs at least two points, each written "across, down".`);
  },
});

// "10, 10" rows into [(10, 10), ...]; a row that is not a pair of numbers is left out and the
// block's validate() says so.
function pointPairs(text) {
  const out = [];
  for (const row of String(text === undefined || text === null ? '' : text).split(/[\n;]+/)) {
    const m = row.match(/^\s*(-?\d+)\s*[, ]\s*(-?\d+)\s*$/);
    if (m) out.push([Number(m[1]), Number(m[2])]);
  }
  return out;
}
function pointList(cx) {
  if (pinned(cx, 'points')) return cx.val('points');
  return cx.lit(pointPairs(cx.s.points));
}

defineBlock({
  type: 'px.add.channel', cat: CAT, kind: 'action',
  title: 'Add output channel',
  desc: 'Draws an output channel on a page, so a run records that signal. A signal with no output channel cannot be read back at all.',
  keywords: ['add', 'output channel', 'pgb', 'record', 'measure', 'signal', 'monitor', 'instrument'],
  inputs: [numInput('x', 'Across', 'x'), numInput('y', 'Down', 'y')],
  outputs: [{ id: 'el', label: 'Channel', type: 'obj', var: 'channel' }],
  settings: [
    { key: 'name', label: 'Name', kind: 'text', default: '', required: true, placeholder: 'e.g. Vbus',
      tip: 'What the channel is called. Read a Series by this name after the run.' },
    ...XY,
    { key: 'units', label: 'Unit', kind: 'text', default: '', more: true, placeholder: 'e.g. kV',
      tip: 'What the signal is in. It travels with the Series, so a graph can name its axis.' },
    { key: 'group', label: 'Group', kind: 'text', default: '', more: true, placeholder: 'Empty: the name' },
    PAGE_SETTING, KEEP_SETTING,
  ],
  summary(s) { return `${s.name || '?'}${s.units ? ` (${s.units})` : ''} at (${s.x}, ${s.y})`; },
  varName(s) { return String(s.name || 'channel'); },
  helpers: ['build_page'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    noteModelChange(cx, { rebuild: true });
    cx.helper('build_page');
    return [`${cx.out('el')} = add_channel(app, ${cx.val('name')}, ${cx.in('x')}, ${cx.in('y')}, ${cx.val('page')}, ${cx.val('group')}, ${cx.val('units')}, None, None, ${cx.val('keep')})`];
  },
  validate(cx) {
    warnRoute(cx);
    cx.warn(`${cx.label} draws the channel but cannot wire it to a signal: in PSCAD its input has to be connected, or it has to sit on a data label of the same name. A channel with a floating input is a build error.`,
      { level: 'warning' });
  },
});

defineBlock({
  type: 'px.add.graph', cat: CAT, kind: 'action',
  title: 'Add graph',
  desc: 'Draws a graph frame on a page, with a curve of an output channel when one is wired in.',
  keywords: ['add', 'graph', 'plot', 'frame', 'curve', 'draw', 'page'],
  inputs: [objInput('obj', 'Channel', 'el'), numInput('x', 'Across', 'x'), numInput('y', 'Down', 'y')],
  outputs: [{ id: 'el', label: 'Graph', type: 'obj', var: 'graph', more: true }],
  settings: [
    elementSetting('el', 'Channel', 'master:pgb', { more: true, example: 'Vbus' }),
    ...XY,
    { key: 'title', label: 'Title', kind: 'text', default: '', more: true },
    PAGE_SETTING, KEEP_SETTING,
  ],
  summary(s) { return `${s.title || 'a graph'} at (${s.x}, ${s.y})`; },
  helpers: ['build_page'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    noteModelChange(cx, { rebuild: true });
    cx.helper('build_page');
    const ch = cx.has('obj') || String((cx.s.el || {}).cls || '').trim() || String((cx.s.el || {}).name || '').trim() ? cx.in('obj') : 'None';
    return [`${cx.out('el')} = add_graph(app, ${ch}, ${cx.in('x')}, ${cx.in('y')}, ${cx.val('page')}, ${cx.val('keep')}, ${cx.val('title')})`];
  },
  validate(cx) { warnRoute(cx); },
});

defineBlock({
  type: 'px.delete', cat: CAT, kind: 'action',
  title: 'Delete component',
  desc: 'Takes a component (or every component of a list) off its page. Use it to strip a case down, or to undo what the workflow drew.',
  keywords: ['delete', 'remove', 'component', 'page', 'strip'],
  inputs: [objInput('obj', 'Components', 'el')],
  outputs: [{ id: 'n', label: 'How many', type: 'num', var: 'deleted', more: true }],
  settings: [elementSetting('el', 'Components', 'master:resistor', { match: 'all' })],
  summary(s) { return elemText(s.el); },
  helpers: ['build_page'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    noteModelChange(cx, { rebuild: true });
    cx.helper('build_page');
    return [`${cx.out('n')} = delete_component(app, ${cx.in('obj')})`];
  },
  validate(cx) { warnRoute(cx); },
});

defineBlock({
  type: 'px.copy', cat: CAT, kind: 'action',
  title: 'Copy component',
  desc: 'Copies one component to another spot on its page and gives the copy back, for a model that repeats a piece.',
  keywords: ['copy', 'duplicate', 'clone', 'component', 'page', 'repeat'],
  inputs: [objInput('obj', 'Component', 'el'), numInput('x', 'Across', 'x'), numInput('y', 'Down', 'y')],
  outputs: [{ id: 'el', label: 'Copy', type: 'obj', var: 'copy' }],
  settings: [elementSetting('el', 'Component', 'master:resistor'), ...XY],
  summary(s) { return `${elemText(s.el)} to (${s.x}, ${s.y})`; },
  helpers: ['build_page'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    noteModelChange(cx, { rebuild: true });
    cx.helper('build_page');
    return [`${cx.out('el')} = copy_component(app, ${cx.in('obj')}, ${cx.in('x')}, ${cx.in('y')})`];
  },
  validate(cx) { warnRoute(cx); },
});

// ---------------------------------------------------------------------------------------------
// The Multiple Run component

defineBlock({
  type: 'px.mrun.sweep', cat: CAT, kind: 'action',
  title: 'Set up a Multiple Run sweep',
  desc: 'Drives PSCAD’s own Multiple Run component: one variable over a list or a range, inside one build. The case has to have a Multiple Run component wired to what it changes.',
  keywords: ['multiple run', 'mrun', 'sweep', 'parametric', 'batch', 'variable', 'range', 'list'],
  inputs: [{ id: 'values', label: 'Values', type: 'list', fallback: 'values', tip: 'The numbers to sweep (at most 10, as the component holds).' }],
  outputs: [{ id: 'values', label: 'Values', type: 'list', var: 'values', more: true }],
  settings: [
    { key: 'variable', label: 'Variable', kind: 'number', default: 1, min: 1, max: 6, step: 1,
      tip: 'Which of the Multiple Run component’s six variables to drive.' },
    { key: 'mode', label: 'Sweep', kind: 'select', default: 'list', options: [['list', 'A list of values'], ['range', 'A range']] },
    { key: 'values', label: 'Values', kind: 'textarea', default: '', showIf: (s) => s.mode !== 'range', placeholder: 'One number per line (at most 10)' },
    { key: 'first', label: 'First', kind: 'number', default: 0, showIf: (s) => s.mode === 'range' },
    { key: 'last', label: 'Last', kind: 'number', default: 1, showIf: (s) => s.mode === 'range' },
    { key: 'steps', label: 'Steps', kind: 'number', default: 10, min: 1, step: 1, showIf: (s) => s.mode === 'range' },
    elementSetting('el', 'Multiple Run component', 'master:mrun', { more: true, match: 'first' }),
  ],
  ports(s) {
    return s.mode === 'range' ? { inputs: [] } : { inputs: [{ id: 'values', label: 'Values', type: 'list', fallback: 'values' }] };
  },
  summary(s) {
    if (s.mode === 'range') return `variable ${s.variable}: ${s.first} to ${s.last} in ${s.steps}`;
    const n = parseLines(s.values).length;
    return `variable ${s.variable}: ${n} value${n === 1 ? '' : 's'}`;
  },
  helpers: ['multirun'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    noteModelChange(cx, { rebuild: true });
    cx.helper('multirun');
    const el = cx.s.el || {};
    const where = `${cx.lit(String(el.cls || 'master:mrun'))}, ${cx.lit(String(el.name || '').trim())}, ${cx.lit(el.match === 'one' ? 'one' : 'first')}`;
    if (cx.s.mode === 'range') {
      return [`${cx.out('values')} = mrun_range(app, ${cx.val('variable')}, ${cx.val('first')}, ${cx.val('last')}, ${cx.val('steps')}, ${where})`];
    }
    const vals = cx.has('values') ? cx.in('values') : cx.lit(parseLines(cx.s.values).map(Number));
    return [`${cx.out('values')} = mrun_sweep(app, ${cx.val('variable')}, ${vals}, ${where})`];
  },
  validate(cx) {
    warnRoute(cx);
    const n = parseLines(cx.s.values).length;
    if (cx.s.mode !== 'range' && !cx.has('values') && n > 10) {
      cx.warn(`A Multiple Run variable holds 10 values; ${cx.label} has ${n}, and the first 10 are used.`);
    }
  },
});

defineBlock({
  type: 'px.mrun.count', cat: CAT, kind: 'action',
  title: 'Set how many runs',
  desc: 'How many times the case runs in one go, PSCAD’s Multiple Run count. One puts it back to a single run.',
  keywords: ['multiple run', 'mrun', 'count', 'runs', 'batch', 'how many'],
  inputs: [numInput('runs', 'Runs', 'runs')],
  outputs: [{ id: 'runs', label: 'Runs', type: 'num', var: 'runs', more: true }],
  settings: [{ key: 'runs', label: 'Runs', kind: 'number', default: 1, min: 1, step: 1 }],
  summary(s) { return `${s.runs} run${Number(s.runs) === 1 ? '' : 's'} in one go`; },
  helpers: ['multirun'],
  effects: { writes: ['model'], reads: [] },
  emit(cx) {
    noteModelChange(cx);
    cx.helper('multirun');
    return [`${cx.out('runs')} = mrun_count(app, ${cx.in('runs')})`];
  },
  validate(cx) { warnRoute(cx); },
});

// ---------------------------------------------------------------------------------------------
// Families: one palette entry, a Kind switch between the members

defineFamily({
  id: 'layer', title: 'Layer', members: ['px.layer.set', 'px.layer.create', 'px.layer.add', 'px.layer.foreach'],
  desc: 'Switch, make or go over the layers that hold a case’s alternative arrangements.',
});
defineFamily({
  id: 'scenario', title: 'Scenario', members: ['px.scen.activate', 'px.scen.save', 'px.scen.foreach'],
  desc: 'Switch, save or go over the case’s scenarios.',
});
defineFamily({
  id: 'globalsub', title: 'Global substitution', members: ['px.gs.set', 'px.gs.get', 'px.gs.setactive', 'px.gs.foreach'],
  desc: 'The named values every $(name) in the model reads.',
});
defineFamily({
  id: 'addpage', title: 'Add to a page', members: ['px.add.component', 'px.add.wire', 'px.add.bus', 'px.add.channel', 'px.add.graph'],
  desc: 'Draw on a page of the case: a component, a wire, a bus, an output channel or a graph.',
});
defineFamily({
  id: 'case', title: 'Case', members: ['px.project.use', 'px.project.save', 'px.project.saveas', 'px.project.new'],
  desc: 'The cases in the workspace: which one to work on, and writing one out.',
});
defineFamily({
  id: 'multirun', title: 'Multiple Run', members: ['px.mrun.sweep', 'px.mrun.count'],
  desc: 'PSCAD’s own Multiple Run component: a sweep inside one build.',
});
defineFamily({
  id: 'control', title: 'Control', members: ['px.control', 'px.control.limits'],
  desc: 'The sliders, switches, dials and buttons a running case is driven by.',
});
