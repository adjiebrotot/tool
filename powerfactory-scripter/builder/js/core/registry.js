// Block registry: the one contract between the editor, the code generator and the blocks.
//
// A block is defined once with defineBlock() and every other part reads it from here: the
// palette lists it, the canvas draws its ports, the inspector draws its settings, and the
// code generator calls its emit(). Saved workflows are keyed on a block's `type`, its setting
// keys, its select option values and its port ids, so those are frozen once shipped: change
// the words a reader sees (title, label, desc), never the handles (see CLAUDE.md). A handle
// that has to change keeps working through portAlias / settingAlias / migrate.
//
// Plain ES module with no DOM access, so Node can import it for the tests.
//
// Additions for the code generator (wave 1, "core"; all additive, nothing above changed):
// - ELEMENT_CLASSES: [cls, plain name, short group] for the element picker, plain names first;
//   elementClassName(cls) gives "Synchronous generator (ElmSym)".
// - effectsOf(node): a block's `effects` may be an object or a function (s, node) -> object
//   (Read attribute derives results / model from the attribute prefix, E5).
// - Optional block properties the generator reads (documented here so block authors find them):
//     volatile: true | 'case'   true: worked out again before every use (Recall a value);
//                               'case': again after any block that writes 'case' (elements).
//     within: 'loop' | 'callback'  the block only works inside such a structure (Report this
//                               try: 'callback'); elsewhere it is an error.
//     skipTable(s, node) -> name | ''   an Add row block that keeps skipped passes: the loops
//                               around it give ctx_pop() this table name (E6).
//     oncePerRun: true          writes files: a warning when it sits on an Each pass route.
//     itemOutput: 'item', itemList(cx) -> expr   a loop over a list: its per-item output and
//                               the whole list, so a run before the loop can record every item
//                               (DESIGN 6.5).
//     monitors(s, node) -> [{ element: inputId, variable: inputId | settingKey }]  (6.5).
//     packages: ['matplotlib']  Python packages preflight() checks before connecting.
//     varName(s, node) -> hint  a calculator's variable name when it has no label.
//     pinLiteral(key, s) -> value  what a pinned setting's SETTINGS line holds (a parsed list).
//   The full emit contract (what emit returns per kind, the cx object) is at the top of
//   core/codegen.js.
//   A setting may carry `noPin: true`: the generator uses it while writing the code (a loop's
//   restore, a formula's text), so it cannot become a SETTINGS line (the inspector hides the pin).
//   An input port may carry `required: true` (unwired with no fallback = a to-do item) and
//   `at: 'bodyEnd'` (Repeat until). A setting may carry `suggest: 'vars' | 'tables'` (the
//   inspector offers the names already used by Remember a value / Add row blocks).

// Data types a port can carry. `flow` is the control wire; the rest are data. `words` is what
// the canvas says on hover, for a reader who does not know the type names.
export const TYPES = {
  flow:   { label: 'Flow',              words: 'The order of steps: this step runs after the one before.' },
  num:    { label: 'Number',            words: 'One number.' },
  bool:   { label: 'Yes / No',          words: 'A yes or no answer.' },
  text:   { label: 'Text',              words: 'Text, such as a name.' },
  list:   { label: 'List of numbers',   words: 'Several numbers, such as the values of a table column.' },
  items:  { label: 'List',              words: 'Several values of any kind: numbers, names or elements.' },
  series: { label: 'Time series',       words: 'A curve over time from a simulation.' },
  obj:    { label: 'Element',           words: 'One PowerFactory element (or several, when a name matches many).' },
  res:    { label: 'Simulation result', words: 'The result of one simulation run.' },
  table:  { label: 'Results table',     words: 'A table of results.' },
  hist:   { label: 'Search history',    words: 'Every try of an Optimise or Find limit block.' },
  cset:   { label: 'Contingencies',     words: 'A list of outages to study.' },
  cell:   { label: 'Value',             words: 'A value for one table cell or one piece of text.' },
  any:    { label: 'Any value',         words: 'Any kind of value.' },
};

// Which source types each target type accepts besides its own. `any` takes everything except
// a simulation result (a result only goes where a block reads it, so monitors can be traced);
// `cell` takes the values a table cell or a piece of text can hold.
const ACCEPTS = {
  num:   ['bool'],
  bool:  ['num'],
  text:  ['num', 'bool'],
  list:  ['num', 'series', 'items'],
  items: ['list', 'num', 'text', 'obj', 'bool'],
  cell:  ['num', 'bool', 'text', 'obj', 'list', 'items'],
};

export function canConnect(fromType, toType) {
  return whyNot(fromType, toType) === '';
}

// Why a wire from a port of type `fromType` cannot go into a port of type `toType`, in words a
// beginner can act on; '' when it can. The UI shows this in the refusal toast and the validator
// in Problems, so both say the same thing.
export function whyNot(fromType, toType) {
  if (!TYPES[fromType] || !TYPES[toType]) return 'One of these ports no longer exists.';
  if (fromType === 'flow' || toType === 'flow') {
    return fromType === toType ? '' : 'A flow wire (the order of steps) only joins flow ports, the arrow-shaped ones.';
  }
  if (fromType === toType) return '';
  if (toType === 'res' || fromType === 'res') {
    return 'A simulation result goes straight into a block that reads it, such as Read time series. To keep a curve, record it on the simulation block.';
  }
  if (toType === 'any') return '';
  if ((ACCEPTS[toType] || []).includes(fromType)) return '';
  if (fromType === 'series' && ['num', 'cell', 'text', 'bool'].includes(toType)) {
    return 'A time series is a whole curve; this port takes one value. Put Frequency nadir, Peak, Final value or Value at time between them.';
  }
  if (fromType === 'list' && toType === 'num') {
    return 'A list holds several numbers; this port takes one. Put Maximum, Minimum, Average or Sum between them.';
  }
  return `This port takes ${article(TYPES[toType].label)}, not ${article(TYPES[fromType].label)}.`;
}

function article(label) {
  const l = label.charAt(0).toLowerCase() + label.slice(1);
  return (/^[aeiou]/i.test(l) ? 'an ' : 'a ') + l;
}

// Palette categories, in palette order (the order follows a study; it is not a handle).
// `color` names the CSS custom property (builder/style.css, both themes) that tints the block.
export const CATEGORIES = [
  { id: 'start',  title: 'Start',                         color: '--cat-start' },
  { id: 'model',  title: 'PowerFactory: cases and data',  color: '--cat-model' },
  { id: 'study',  title: 'PowerFactory: studies',         color: '--cat-study' },
  { id: 'check',  title: 'Power system checks',           color: '--cat-check' },
  { id: 'result', title: 'Results and graphs',            color: '--cat-result' },
  { id: 'flow',   title: 'Flow: loops and decisions',     color: '--cat-flow' },
  { id: 'value',  title: 'Values and maths',              color: '--cat-value' },
  { id: 'search', title: 'Optimise and search',           color: '--cat-search' },
  { id: 'adv',    title: 'Advanced',                      color: '--cat-adv' },
];

export const KINDS = ['start', 'action', 'branch', 'loop', 'callback', 'pure', 'terminal', 'note'];

// Setting kinds the inspector can draw. `element` holds { cls, name, match } (a PowerFactory
// class, a name with * wildcards, and one / first / all), `list` holds rows with stable ids.
export const SETTING_KINDS = ['text', 'number', 'select', 'bool', 'textarea', 'code', 'list', 'attr', 'element'];

// What a block does to the model, for the "results read after the model changed" check:
// writes: 'model' (element data), 'case' (switches study case, scenario or variation),
// 'results' (runs a calculation); reads: 'results' (m:, c:, s: values), 'model'.
export const EFFECTS = ['model', 'case', 'results'];

const DEFAULT_FLOW_OUTS = {
  start:    [{ id: 'next', label: '' }],
  action:   [{ id: 'next', label: '' }],
  branch:   [],
  loop:     [{ id: 'body', label: 'Each pass' }, { id: 'done', label: 'After all passes' }],
  callback: [{ id: 'body', label: 'Each try' }, { id: 'done', label: 'After the search' }],
  pure:     [],
  terminal: [],
  note:     [],
};

const ID_RE = /^[A-Za-z][A-Za-z0-9_]*$/;
const BLOCKS = new Map();

// Register a block. Throws on a malformed definition: that is a programming error caught by
// the tests, never something a reader's saved state can trigger.
export function defineBlock(def) {
  const where = `block "${def && def.type}"`;
  const fail = (m) => { throw new Error(`defineBlock: ${where} ${m}`); };
  if (!def || typeof def.type !== 'string' || !/^[a-z][a-z0-9_.]*$/.test(def.type)) throw new Error(`defineBlock: bad type "${def && def.type}"`);
  if (BLOCKS.has(def.type)) fail('is defined twice');
  if (!KINDS.includes(def.kind)) fail(`has unknown kind "${def.kind}"`);
  if (!CATEGORIES.some(c => c.id === def.cat)) fail(`has unknown category "${def.cat}"`);
  if (!def.title) fail('needs a title');
  if (def.kind !== 'note' && def.kind !== 'start' && typeof def.emit !== 'function') fail('needs emit()');
  for (const st of def.settings || []) {
    if (!st.key || !ID_RE.test(st.key) || !SETTING_KINDS.includes(st.kind)) fail(`setting "${st.key}" has a bad key or kind "${st.kind}"`);
    if (st.kind === 'select') {
      if (!(Array.isArray(st.options) && st.options.length)) fail(`select "${st.key}" needs options`);
      for (const [v] of optionPairs(st)) if (typeof v !== 'string') fail(`select "${st.key}" option values must be strings (got ${JSON.stringify(v)})`);
      if (typeof st.default !== 'string' || !optionPairs(st).some(([v]) => v === st.default)) fail(`select "${st.key}" default must be one of its option values`);
    }
  }
  if ((def.settings || []).filter((s, i, a) => a.findIndex(x => x.key === s.key) !== i).length) fail('has two settings with the same key');
  const full = {
    keywords: [], inputs: [], outputs: [], settings: [], helpers: [], volatile: false, desc: '',
    effects: { writes: [], reads: [] }, portAlias: {}, settingAlias: {},
    ...def,
    flowOuts: def.flowOuts || DEFAULT_FLOW_OUTS[def.kind],
  };
  checkPorts(full.flowOuts, full.inputs, full.outputs, fail);
  BLOCKS.set(def.type, Object.freeze(full));
  return full;
}

function checkPorts(flowOuts, inputs, outputs, fail) {
  for (const p of [...inputs, ...outputs]) {
    if (!p.id || !ID_RE.test(p.id) || !TYPES[p.type] || p.type === 'flow') fail(`port "${p.id}" has a bad id or type "${p.type}"`);
  }
  for (const p of flowOuts) if (!p.id || !ID_RE.test(p.id)) fail(`flow output "${p.id}" has a bad id`);
  if (inputs.some(p => p.id === 'in')) fail('a data input may not be called "in" (that is the flow input)');
  const outIds = [...flowOuts.map(p => p.id), ...outputs.map(p => p.id)];
  if (new Set(outIds).size !== outIds.length) fail('has two output ports with the same id');
  const inIds = inputs.map(p => p.id);
  if (new Set(inIds).size !== inIds.length) fail('has two input ports with the same id');
}

export function getBlock(type) { return BLOCKS.get(type); }
export function allBlocks() { return [...BLOCKS.values()]; }
export function blocksIn(cat) { return allBlocks().filter(b => b.cat === cat); }

// Does this kind of block take the flow input `in`?
export function hasFlowIn(def) {
  return !!def && !['start', 'pure', 'note'].includes(def.kind);
}

// A select's options are [value, label] pairs (or plain strings, value = label). An option may
// carry `was: [...]` (third element, or {value, label, was}) listing values it replaced, so old
// saved values map to it.
export function optionPairs(st) {
  return (st.options || []).map(o => {
    if (Array.isArray(o)) return [o[0], o[1] === undefined ? String(o[0]) : o[1], o[2] || []];
    if (o && typeof o === 'object') return [o.value, o.label === undefined ? String(o.value) : o.label, o.was || []];
    return [o, String(o), []];
  });
}

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

// Settings with defaults filled in. Saved values keep their meaning: a select value is matched
// as a string, a value an option replaced maps to that option, anything unknown falls back to
// the default; a number arriving as text becomes a number; list rows get stable ids. Unknown
// keys in the saved object are carried along untouched so a later version can still read them.
export function settingsOf(node) {
  const def = getBlock(node && node.type);
  const saved0 = isPlainObject(node && node.s) ? node.s : {};
  const saved = { ...saved0 };
  if (!def) return saved;
  for (const [oldKey, newKey] of Object.entries(def.settingAlias || {})) {
    if (saved[newKey] === undefined && saved[oldKey] !== undefined) saved[newKey] = saved[oldKey];
  }
  const out = { ...saved };
  for (const st of def.settings) {
    const raw = saved[st.key];
    const has = raw !== undefined && raw !== null;
    let v = has ? raw : clone(st.default);
    if (st.kind === 'select') {
      const pairs = optionPairs(st);
      const sv = v === undefined || v === null ? '' : String(v);
      const hit = pairs.find(([val]) => val === sv) || pairs.find(([, , was]) => was.map(String).includes(sv));
      v = hit ? hit[0] : st.default;
    } else if (st.kind === 'bool') {
      v = v === true || v === 'true' || v === 1 || v === '1';
    } else if (st.kind === 'number') {
      if (v === '' || v === undefined || v === null) v = st.default === undefined ? null : st.default;
      else { const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.')); v = Number.isFinite(n) ? n : (st.default === undefined ? null : st.default); }
    } else if (st.kind === 'list') {
      v = normaliseRows(Array.isArray(v) ? v : (clone(st.default) || []), st);
    } else if (st.kind === 'element') {
      v = isPlainObject(v) ? { cls: '', name: '', match: 'one', ...v } : { cls: '', name: '', match: 'one', ...(isPlainObject(st.default) ? st.default : {}) };
    } else if (v === undefined || v === null) {
      v = '';
    } else if (typeof v !== 'string' && ['text', 'textarea', 'code', 'attr'].includes(st.kind)) {
      v = String(v);
    }
    out[st.key] = v;
  }
  if (typeof def.migrate === 'function' && node && node.sv !== undefined && node.sv !== def.version) {
    try { Object.assign(out, def.migrate(out, node.sv) || {}); } catch (e) { /* keep what we have */ }
  }
  return out;
}

// List rows are objects with a stable `id` (c1, c2 ...): ids are given by position to rows that
// lack one, skipping ids already used, and missing columns take their defaults.
function normaliseRows(rows, st) {
  const used = new Set(rows.map(r => (isPlainObject(r) && typeof r.id === 'string' && ID_RE.test(r.id)) ? r.id : null).filter(Boolean));
  const prefix = st.rowPrefix || 'c';
  const seen = new Set();
  let n = 1;
  return rows.filter(isPlainObject).map(r => {
    const row = { ...r };
    if (!(typeof row.id === 'string' && ID_RE.test(row.id)) || seen.has(row.id)) {
      while (used.has(prefix + n)) n++;
      row.id = prefix + n; used.add(row.id);
    }
    seen.add(row.id);
    for (const c of st.columns || []) if (row[c.key] === undefined) row[c.key] = clone(c.default === undefined ? '' : c.default);
    return row;
  });
}

// The ports a node has right now (dynamic blocks compute theirs from their settings). A ports()
// that throws on odd saved data falls back to the static ports (the validator reports it).
export function portsOf(node) {
  const def = getBlock(node && node.type);
  if (!def) return { flowIn: false, flowOuts: [], inputs: [], outputs: [], missing: true };
  const s = settingsOf(node);
  let dyn = {};
  if (typeof def.ports === 'function') {
    try { dyn = def.ports(s, node) || {}; } catch (e) { dyn = { error: String(e && e.message || e) }; }
  }
  return {
    flowIn: hasFlowIn(def),
    flowOuts: dyn.flowOuts || def.flowOuts,
    inputs: dyn.inputs || def.inputs,
    outputs: dyn.outputs || def.outputs,
    error: dyn.error,
  };
}

// The port a saved edge end refers to, following portAlias for renamed ports. Returns
// { port, kind: 'flowIn'|'flowOut'|'input'|'output', type } or null.
export function findPort(node, portId, side) {
  const def = getBlock(node && node.type);
  if (!def) return null;
  const id = (def.portAlias && def.portAlias[portId]) || portId;
  const p = portsOf(node);
  if (side === 'in') {
    if (id === 'in' && p.flowIn) return { port: { id: 'in', label: '' }, kind: 'flowIn', type: 'flow' };
    const d = p.inputs.find(x => x.id === id);
    return d ? { port: d, kind: 'input', type: d.type } : null;
  }
  const f = p.flowOuts.find(x => x.id === id);
  if (f) return { port: f, kind: 'flowOut', type: 'flow' };
  const d = p.outputs.find(x => x.id === id);
  return d ? { port: d, kind: 'output', type: d.type } : null;
}

// A short line for the canvas under the block title.
// `wf` (optional) is the whole workflow, for summaries that depend on other blocks (Add row says
// "saved at the end automatically" while no Save results table block names its table).
export function summaryOf(node, wf) {
  const def = getBlock(node && node.type);
  if (!def || typeof def.summary !== 'function') return '';
  try { return String(def.summary(settingsOf(node), node, wf) || ''); } catch (e) { return ''; }
}

// The name shown for a node: its own label when the reader gave one, else the block title.
export function displayName(node) {
  const def = getBlock(node && node.type);
  return (node && typeof node.label === 'string' && node.label.trim()) || (def ? def.title : `Missing block (${node && node.type})`);
}

// Settings that apply right now (a setting with showIf hidden by another setting is skipped,
// and an input fallback is only shown while that input is not wired). `more: true` settings
// are returned too; the inspector folds them under "More options".
export function visibleSettings(node, wiredInputs = new Set()) {
  const def = getBlock(node && node.type);
  if (!def) return [];
  const s = settingsOf(node);
  const { inputs } = portsOf(node);
  const fallbackOfWired = new Set(inputs.filter(p => p.fallback && wiredInputs.has(p.id)).map(p => p.fallback));
  return def.settings.filter(st => {
    if (fallbackOfWired.has(st.key)) return false;
    if (typeof st.showIf === 'function') { try { return !!st.showIf(s); } catch (e) { return true; } }
    return true;
  });
}

function clone(v) {
  return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v;
}

// Only for tests: start from an empty registry.
export function _resetForTests() { BLOCKS.clear(); }

// ---------------------------------------------------------------------------------------------
// Additions (wave 1, core). See the list at the top of this file.

// PowerFactory element classes for the element picker: [class, plain name, short group]. The
// picker shows "Synchronous generator (ElmSym)"; an `obj` input's `kinds` filters this list.
export const ELEMENT_CLASSES = [
  ['ElmSym',     'Synchronous generator',    'Generation'],
  ['ElmGenstat', 'Static generator',         'Generation'],
  ['ElmPvsys',   'PV system',                'Generation'],
  ['ElmAsm',     'Asynchronous machine',     'Generation'],
  ['ElmVsc',     'Converter (VSC)',          'Generation'],
  ['ElmXnet',    'External grid',            'Generation'],
  ['ElmVac',     'AC voltage source',        'Generation'],
  ['ElmIac',     'AC current source',        'Generation'],
  ['ElmLod',     'Load',                     'Loads'],
  ['ElmLodlv',   'Low-voltage load',         'Loads'],
  ['ElmLodmv',   'Medium-voltage load',      'Loads'],
  ['ElmTerm',    'Busbar / terminal',        'Buses and grids'],
  ['StaCubic',   'Cubicle',                  'Buses and grids'],
  ['ElmNet',     'Grid',                     'Buses and grids'],
  ['ElmSubstat', 'Substation',               'Buses and grids'],
  ['ElmSite',    'Site',                     'Buses and grids'],
  ['ElmZone',    'Zone',                     'Buses and grids'],
  ['ElmArea',    'Area',                     'Buses and grids'],
  ['ElmLne',     'Line',                     'Branches'],
  ['ElmTr2',     '2-winding transformer',    'Branches'],
  ['ElmTr3',     '3-winding transformer',    'Branches'],
  ['ElmCoup',    'Switch / breaker',         'Branches'],
  ['StaSwitch',  'Switch in a cubicle',      'Branches'],
  ['ElmZpu',     'Common impedance',         'Branches'],
  ['ElmSind',    'Series reactor',           'Branches'],
  ['ElmScap',    'Series capacitor',         'Branches'],
  ['ElmBranch',  'Branch',                   'Branches'],
  ['ElmShnt',    'Shunt',                    'Compensation'],
  ['ElmSvs',     'Static var system',        'Compensation'],
  ['ElmFilter',  'Harmonic filter',          'Compensation'],
  ['ElmComp',    'Composite model',          'Control'],
  ['ElmDsl',     'DSL model',                'Control'],
  ['ElmStactrl', 'Station controller',       'Control'],
  ['ElmRelay',   'Relay',                    'Control'],
];

// "Synchronous generator (ElmSym)", or the class itself when it is not in the list.
export function elementClassName(cls) {
  const hit = ELEMENT_CLASSES.find(c => c[0] === cls);
  return hit ? `${hit[1]} (${hit[0]})` : String(cls || '');
}

// What a node does to the model ({ writes: [...], reads: [...] }), whether the block gives it
// as an object or works it out from its settings.
export function effectsOf(node) {
  const def = getBlock(node && node.type);
  if (!def) return { writes: [], reads: [] };
  let e = def.effects;
  if (typeof e === 'function') {
    try { e = e(settingsOf(node), node); } catch (err) { e = null; }
  }
  return {
    writes: Array.isArray(e && e.writes) ? e.writes : [],
    reads: Array.isArray(e && e.reads) ? e.reads : [],
  };
}
