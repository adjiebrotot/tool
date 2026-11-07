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
//     reports: true             Report this try: answers for its route of a search's try, so the
//                               search's end-of-try input is not read again on that route.
//     ends: 'pass' | 'loop' | 'workflow'  what a terminal ends (Skip, Stop the loop, Stop the
//                               workflow); the palette and quick-add grey out the two that need
//                               a loop or a search where there is none (ui/ops.js whyNotHere).
//   A port may carry `more: true` (or a function (settings, { wired, srcPort })): the canvas
//   folds it behind "+N more" while it is unwired (ui/ops.js foldedPorts); and an input of type
//   'any' may carry `takes: [types]`, the values it can use, so quick-add greys it out for others.
//   A setting may carry `meaning` (default: its key) when a block family shares its key with a
//   different meaning (defineFamily below).
//   The full emit contract (what emit returns per kind, the cx object) is at the top of
//   core/codegen.js.
//   A setting may carry `noPin: true`: the generator uses it while writing the code (a loop's
//   restore, a formula's text), so it cannot become a SETTINGS line (the inspector hides the pin).
//   A setting may also carry `showIf(s)` (drawn only while this is true) and, for a select,
//   `optionsFor(s)` -> the subset of its options worth offering right now. Both only change what
//   the inspector draws: the saved value is untouched and the generator still reads it, so a
//   setting is only hidden where its value cannot change what the script does. optionsFor may
//   leave out any option; the one in use is always offered, so saved state never loses its
//   value. Where the choice turns on a PSCAD fact (a parameter's unit, whether a definition
//   has ngnum), ask core/attrdata.js, whose answers are `undefined` until its files are in: that
//   must read as "show it", and the page redraws when they land.
//   An input port may carry `required: true` (unwired with no fallback = a to-do item) and
//   `at: 'bodyEnd'` (Repeat until). A setting may carry `suggest: 'vars' | 'tables'` (the
//   inspector offers the names already used by Remember a value / Add row blocks) or
//   `suggest: 'columns'` (the columns of the table named by the setting `columnsOf`, default
//   'table'; '@port' for the table behind the row wired into that input).

// Data types a port can carry. `flow` is the control wire; the rest are data. `words` is what
// the canvas says on hover, for a reader who does not know the type names.
export const TYPES = {
  flow:   { label: 'Flow',              words: 'The order of steps: this step runs after the one before.' },
  num:    { label: 'Number',            words: 'One number.' },
  bool:   { label: 'Yes / No',          words: 'A yes or no answer.' },
  text:   { label: 'Text',              words: 'Text, such as a name.' },
  list:   { label: 'List of numbers',   words: 'Several numbers, such as the values of a table column.' },
  items:  { label: 'List',              words: 'Several values of any kind: numbers, names or elements.' },
  series: { label: 'Time series',       words: 'A curve over time, from one output channel of a run.' },
  obj:    { label: 'Component',         words: 'One PSCAD component (or several, when a definition or name matches many).' },
  res:    { label: 'Simulation result', words: 'The result of one EMT run, with the channels it recorded.' },
  table:  { label: 'Results table',     words: 'A table of results.' },
  hist:   { label: 'Search history',    words: 'Every try of an Optimise or Find limit block.' },
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
  { id: 'model',  title: 'PSCAD: model and data',         color: '--cat-model' },
  { id: 'study',  title: 'PSCAD: build and run',          color: '--cat-study' },
  { id: 'check',  title: 'Power system checks',           color: '--cat-check' },
  { id: 'result', title: 'Results and graphs',            color: '--cat-result' },
  { id: 'flow',   title: 'Flow: loops and decisions',     color: '--cat-flow' },
  { id: 'value',  title: 'Values and maths',              color: '--cat-value' },
  { id: 'search', title: 'Optimise and search',           color: '--cat-search' },
  { id: 'adv',    title: 'Advanced',                      color: '--cat-adv' },
];

export const KINDS = ['start', 'action', 'branch', 'loop', 'callback', 'pure', 'terminal', 'note'];

// Setting kinds the inspector can draw. `element` holds { cls, name, match } (a PSCAD
// class, a name with * wildcards, and one / first / all), `list` holds rows with stable ids,
// `file` holds what the page read from an attached data file ({ name, size, sheet, sheets,
// cols, rows }; the bytes live in wf.files, never in a node), and `schedule` holds the steps of
// a dynamic event ([{ id, t, v }], drawn as a table and a graph of the same rows).
export const SETTING_KINDS = ['text', 'number', 'select', 'bool', 'textarea', 'code', 'list', 'attr', 'element', 'defn', 'file', 'schedule'];

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

// ---------------------------------------------------------------------------------------------
// Block families: blocks that do one job in a few ways (the statistics, the six simulation
// events, the graphs ...). The palette lists a family once, under its own title, and a click adds
// its usual member (`dflt`); a member's Settings tab has a Kind switch between the members
// (ui/ops.js switchKind), which changes the block's type and keeps its id, name, settings, pins
// and wires. Nothing about a family is saved: a workflow holds the member's own type, as it
// always did, so a family is words and grouping only and may be regrouped freely.
//
// A setting key two members share must mean the same thing in both, because a Kind switch
// carries its value across (_audit/families/run.mjs holds this). Where it cannot, the setting
// says what it means with `meaning` (default: its key); a switch between different meanings
// gives the new kind's default instead. A value the reader left at the old kind's default takes
// the new kind's default (an RMS run of 10 s becomes an EMT run of 0.5 s).
//
// defineFamily({ id, title, desc, keywords, members: [types, in order], dflt, convert? }) after
// the members are defined; `convert` lists keys whose kind differs between members on purpose
// (the value of a Number, a Text and a Yes / No), which settingsOf converts.
const FAMILIES = new Map();
const FAMILY_OF = new Map();

export function defineFamily(fam) {
  const fail = (m) => { throw new Error(`defineFamily: "${fam && fam.id}" ${m}`); };
  if (!fam || typeof fam.id !== 'string' || !/^[a-z][a-z0-9_.]*$/.test(fam.id)) fail('needs an id');
  if (FAMILIES.has(fam.id)) fail('is defined twice');
  if (!fam.title) fail('needs a title');
  const members = Array.isArray(fam.members) ? fam.members : [];
  if (members.length < 2) fail('needs at least two members');
  const defs = members.map(t => BLOCKS.get(t) || fail(`has an unknown member "${t}" (define the blocks first)`));
  if (new Set(defs.map(d => d.cat)).size !== 1) fail('has members in different categories');
  for (const t of members) if (FAMILY_OF.has(t)) fail(`member "${t}" is already in family "${FAMILY_OF.get(t)}"`);
  const dflt = fam.dflt || members[0];
  if (!members.includes(dflt)) fail('has a default that is not a member');
  const full = Object.freeze({ keywords: [], desc: '', convert: [], ...fam, members: members.slice(), dflt, cat: defs[0].cat });
  FAMILIES.set(fam.id, full);
  for (const t of members) FAMILY_OF.set(t, fam.id);
  return full;
}
export function familyOf(type) { const id = FAMILY_OF.get(type); return id ? FAMILIES.get(id) : null; }
export function allFamilies() { return [...FAMILIES.values()]; }
// What a setting means, for a Kind switch: its `meaning`, else its key.
export function meaningOf(st) { return (st && (st.meaning || st.key)) || ''; }

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
    } else if (st.kind === 'list' || st.kind === 'schedule') {
      v = normaliseRows(Array.isArray(v) ? v : (clone(st.default) || []), st);
    } else if (st.kind === 'file') {
      const d = isPlainObject(st.default) ? st.default : {};
      const f = isPlainObject(v) ? v : d;
      v = {
        name: typeof f.name === 'string' ? f.name : '',
        size: Number.isFinite(Number(f.size)) ? Number(f.size) : 0,
        sheet: typeof f.sheet === 'string' ? f.sheet : '',
        sheets: Array.isArray(f.sheets) ? f.sheets.filter(x => typeof x === 'string') : [],
        cols: Array.isArray(f.cols) ? f.cols.filter(x => typeof x === 'string') : [],
        rows: Number.isFinite(Number(f.rows)) ? Number(f.rows) : 0,
        sig: typeof f.sig === 'string' ? f.sig : '',
      };
    } else if (st.kind === 'element') {
      v = isPlainObject(v) ? { cls: '', name: '', match: 'one', ...v } : { cls: '', name: '', match: 'one', ...(isPlainObject(st.default) ? st.default : {}) };
    } else if (v === undefined || v === null) {
      v = '';
    } else if (typeof v !== 'string' && ['text', 'textarea', 'code', 'attr', 'defn'].includes(st.kind)) {
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
//
// showIf is called as showIf(s, cx), where cx tells the block what it cannot read from its own
// settings:
//   cx.wired    a Set of the input port ids a wire goes into right now
//   cx.inLoop   true / false when the caller knows whether the block sits inside a loop,
//               `undefined` when it does not (the generator does not pass it)
// Anything cx cannot answer is `undefined`, which a block must read as "show it".
//
// A setting the reader pinned is always shown: the generator writes its SETTINGS line whether or
// not it applies (it never looks here), so a hidden pinned setting would be a line at the top of
// the script with no field behind it.
export function visibleSettings(node, wiredInputs = new Set(), ctx = null) {
  const def = getBlock(node && node.type);
  if (!def) return [];
  const s = settingsOf(node);
  const { inputs } = portsOf(node);
  const pinned = new Set(Array.isArray(node && node.pin) ? node.pin : []);
  const fallbackOfWired = new Set(inputs.filter(p => p.fallback && wiredInputs.has(p.id)).map(p => p.fallback));
  const cx = { wired: wiredInputs, inLoop: ctx && ctx.inLoop, ...(ctx || {}) };
  return def.settings.filter(st => {
    if (pinned.has(st.key)) return true;
    if (fallbackOfWired.has(st.key)) return false;
    if (typeof st.showIf === 'function') { try { return !!st.showIf(s, cx); } catch (e) { return true; } }
    return true;
  });
}

function clone(v) {
  return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v;
}

// Only for tests: start from an empty registry.
export function _resetForTests() { BLOCKS.clear(); FAMILIES.clear(); FAMILY_OF.clear(); }

// ---------------------------------------------------------------------------------------------
// Additions (wave 1, core). See the list at the top of this file.

// (replaced below by the PSCAD definition list)
// picker shows "Synchronous generator (ElmSym)"; an `obj` input's `kinds` filters this list.
// The component definitions the picker offers by name: the Master Library components an EMT
// study reaches for, plus the canvas objects PSCAD names itself (a slider, a graph, a bus).
//
// A definition is written the way PSCAD's own search takes it, namespace first and lower case:
// `master:source_3`. The list is a shortcut, not a limit - the picker lets any definition be
// typed, and `../reference/definitions.json` holds all 383 of the Master Library for the
// suggestions. These keys are frozen handles: they are saved in every workflow.
export const ELEMENT_CLASSES = [
  // Sources
  ['master:source_3',        'Three phase voltage source',        'Sources'],
  ['master:source_1',        'Single phase voltage source',       'Sources'],
  ['master:source3R',        'Three phase source, R-R//L',        'Sources'],
  ['master:src_ccin_3',      'Three phase current source',        'Sources'],
  ['master:src_ccin_1',      'Single phase current source',       'Sources'],
  ['master:battery',         'Battery',                           'Sources'],
  ['master:photovoltaic_source', 'Photovoltaic source',           'Sources'],
  ['master:wind_source',     'Wind source',                       'Sources'],
  // Passive
  ['master:resistor',        'Resistor',                          'Passive'],
  ['master:inductor',        'Inductor',                          'Passive'],
  ['master:capacitor',       'Capacitor',                         'Passive'],
  ['master:varrlc',          'Variable R, L or C',                'Passive'],
  ['master:fixed_load',      'Fixed load',                        'Passive'],
  ['master:Yload',           'Y connected load',                  'Passive'],
  ['master:Dload',           'Delta connected load',              'Passive'],
  ['master:arrester',        'Surge arrester',                    'Passive'],
  ['master:filter',          'Tuned filter',                      'Passive'],
  ['master:cfilter',         'C-type filter',                     'Passive'],
  ['master:ground',          'Ground',                            'Passive'],
  // Transformers
  ['master:xfmr-3p2w',       '3 phase 2 winding transformer',     'Transformers'],
  ['master:xfmr-3p3w',       '3 phase 3 winding transformer',     'Transformers'],
  ['master:xfmr-2w',         'Single phase 2 winding transformer', 'Transformers'],
  ['master:xfmr-3w',         'Single phase 3 winding transformer', 'Transformers'],
  ['master:umec-xfmr-2w',    'UMEC 2 winding transformer',        'Transformers'],
  ['master:xfmr_3p2w_auto',  '3 phase auto transformer',          'Transformers'],
  ['master:sat_reac',        'Saturable reactor',                 'Transformers'],
  ['master:ratio_changer_2w', 'Ideal transformer (ratio)',        'Transformers'],
  // Lines and cables
  ['master:newpi',           'Coupled PI section',                'Lines and cables'],
  ['master:pi_double_cct',   'Double circuit PI section',         'Lines and cables'],
  ['master:coupled_3lines',  'Mutually coupled 3 wires',          'Lines and cables'],
  ['master:l2g_imp',         'Line to ground impedance',          'Lines and cables'],
  ['master:l2l_imp',         'Line to line impedance',            'Lines and cables'],
  ['master:Line_ManualYZ',   'Line, manual Y and Z',              'Lines and cables'],
  ['master:Line_Berg_Options', 'Line, Bergeron model',            'Lines and cables'],
  ['master:Line_FrePhase_Options', 'Line, frequency dependent (phase)', 'Lines and cables'],
  ['master:Cable_Coax',      'Coax cable cross-section',          'Lines and cables'],
  ['TLine',                  'Transmission line (on the page)',   'Lines and cables'],
  ['Cable',                  'Cable (on the page)',               'Lines and cables'],
  // Faults and switching
  ['master:tpflt',           'Three phase fault',                 'Faults and switching'],
  ['master:fault_sw',        'Single phase fault',                'Faults and switching'],
  ['master:tfaultn',         'Timed fault logic',                 'Faults and switching'],
  ['master:breaker3',        '3 phase breaker',                   'Faults and switching'],
  ['master:breaker1',        'Single phase breaker',              'Faults and switching'],
  ['master:tbreakn',         'Timed breaker logic',               'Faults and switching'],
  ['master:switch',          'Isolation switch',                  'Faults and switching'],
  ['master:statistical_breaker', 'Statistical breaker',           'Faults and switching'],
  ['master:peswitch',        'Power electronic switch',           'Faults and switching'],
  // Machines and their controls
  ['master:sync_machine',    'Synchronous machine',               'Machines'],
  ['master:sqc100',          'Squirrel cage induction machine',   'Machines'],
  ['master:wound_rotor',     'Wound rotor induction machine',     'Machines'],
  ['master:pm_machine',      'Permanent magnet machine',          'Machines'],
  ['master:dc_mac_2w',       'DC machine',                        'Machines'],
  ['master:excst',           'Exciter, type ST',                  'Machines'],
  ['master:excac',           'Exciter, type AC',                  'Machines'],
  ['master:excdc',           'Exciter, type DC',                  'Machines'],
  ['master:hy_gov',          'Hydro governor',                    'Machines'],
  ['master:th_gov',          'Thermal governor',                  'Machines'],
  ['master:wind_turbine',    'Wind turbine',                      'Machines'],
  ['master:pss',             'Power system stabiliser',           'Machines'],
  // Meters and output
  ['master:pgb',             'Output channel',                    'Meters and output'],
  ['master:multimeter',      'Multimeter',                        'Meters and output'],
  ['master:ammeter',         'Current meter',                     'Meters and output'],
  ['master:voltmetergnd',    'Voltmeter to ground',               'Meters and output'],
  ['master:power',           'Real and reactive power meter',     'Meters and output'],
  ['master:rms3ph',          'Three phase RMS meter',             'Meters and output'],
  ['master:rms-inst',        'Single phase RMS meter',            'Meters and output'],
  ['master:freq-meas',       'Frequency, phase and RMS meter',    'Meters and output'],
  ['master:thd',             'Harmonic distortion calculator',    'Meters and output'],
  ['master:fft',             'On-line frequency scanner',         'Meters and output'],
  ['master:phasorimp',       'Harmonic impedance',                'Meters and output'],
  ['master:datalabel',       'Data signal label',                 'Meters and output'],
  ['master:datatap',         'Scalar or array tap',               'Meters and output'],
  // Control and signals
  ['master:const',           'Real constant',                     'Control and signals'],
  ['master:signalgen',       'Signal generator',                  'Control and signals'],
  ['master:timer',           'Timer',                             'Control and signals'],
  ['master:compar',          'Two input comparator',              'Control and signals'],
  ['master:time-sig',        'Simulation time',                   'Control and signals'],
  ['master:tvekta',          'Phase locked loop',                 'Control and signals'],
  ['master:var_impedance',   'Variable series impedance',         'Control and signals'],
  // Runtime controls, as PSCAD names them on the page
  ['master:var_pot',         'Rotary switch (dial source)',       'Runtime controls'],
  ['master:var_switch',      'Two state switch (source)',         'Runtime controls'],
  ['master:var_button',      'Push button (source)',              'Runtime controls'],
  ['Slider',                 'Slider on a control panel',         'Runtime controls'],
  ['Switch',                 'Switch on a control panel',         'Runtime controls'],
  ['Selector',               'Dial on a control panel',           'Runtime controls'],
  ['Button',                 'Button on a control panel',         'Runtime controls'],
  ['ControlFrame',           'Control panel',                     'Runtime controls'],
  // Multiple run and graphs
  ['master:mrun',            'Multiple Run',                      'Runs and graphs'],
  ['master:optimum_run',     'Optimum Run',                       'Runs and graphs'],
  ['master:fileread',        'File read',                         'Runs and graphs'],
  ['GraphFrame',             'Graph frame',                       'Runs and graphs'],
  ['OverlayGraph',           'Overlay graph',                     'Runs and graphs'],
  ['PolyGraph',              'Stacked polygraph',                 'Runs and graphs'],
  ['PlotFrame',              'XY plot',                           'Runs and graphs'],
  ['Curve',                  'Curve on a graph',                  'Runs and graphs'],
  ['Meter',                  'Meter on a panel',                  'Runs and graphs'],
  // The page itself
  ['Bus',                    'Bus',                               'Wiring'],
  ['Wire',                   'Wire',                              'Wiring'],
  ['WireOrthogonal',         'Wire (orthogonal)',                 'Wiring'],
  ['master:breakout',        '3 phase to single line',            'Wiring'],
  ['master:xnode',           'Node label',                        'Wiring'],
];

// "Resistor (master:resistor)", or the definition itself when it is not in the list.
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
