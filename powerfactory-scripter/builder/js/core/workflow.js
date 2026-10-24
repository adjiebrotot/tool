// The saved workflow: its format, the one loader every way in goes through, and the saver.
//
// A reader's work lives in the mini cache (Persist), in .json files, in the # PFB1 line of every
// downloaded .py and in templates, so the handles here are frozen (CLAUDE.md "Change an existing
// tool with the least damage"; DESIGN section 3):
//   { "app": "pf-builder", "v": 1, "name": "...",
//     "nodes": [ { "id", "type", "x", "y", "label", "s": {settings}, "pin": [keys], "sv" } ],
//     "edges": [ { "id", "from", "out", "to", "in" } ],
//     "view": { "x", "y", "zoom" },
//     "graph": { the graph style, core/graphstyle.js; absent = the default style } }
// The PFB1 line of a .py carries the same object without `view`, plus two keys of its own:
// "settings" (SETTINGS constant -> [nodeId, settingKey(, subKey)]; nodeId "*" is the workflow
// itself, e.g. WORKFLOW_NAME -> ["*", "name"]) and "hash" (of the WORKFLOW section, to tell the
// reader when code outside SETTINGS was edited by hand). Those two names are reserved at the
// workflow level.
//
// loadWorkflow never throws and never drops a reader's data silently: unknown block types are
// kept with all their data, wires to a port that is gone are kept and flagged, bad or repeated
// ids are given clean ones, and everything it changed or could not use is said in `notes`.
//
// Plain ES module, no DOM. Needs the blocks registered (blocks/index.js) to normalise settings;
// a block type that is not registered is simply treated as a Missing block.

import { getBlock, settingsOf, findPort, canConnect, displayName, optionPairs } from './registry.js';
import { parsePyLiteral } from './pylit.js';
import { parseValues } from './blockkit.js';
import { normalizeStyle, sameStyle, unusableKeys } from './graphstyle.js';

export const APP_ID = 'pf-builder';
export const FORMAT_VERSION = 1;

// Workflow-level migrations: MIGRATIONS[v](obj) returns the object in format v + 1. Empty while
// the format is v1; add a function here (never change one) when the format moves on.
export const MIGRATIONS = {};

const ID_RE = /^[A-Za-z][A-Za-z0-9_]*$/;

// Keys the canvas library or the UI may put on a node or edge object; never saved.
const UI_ONLY_NODE = new Set(['selected', 'dragging', 'measured', 'resizing', 'width', 'height',
  'positionAbsolute', 'internals', 'handleBounds', 'position', 'data', 'sourcePosition',
  'targetPosition', 'focusable', 'deletable', 'draggable', 'selectable', 'connectable',
  'dragHandle', 'expandParent', 'className', 'style', 'zIndex', 'ariaLabel', 'origin', 'hidden',
  'parentId', 'extent', 'initialWidth', 'initialHeight']);
const UI_ONLY_EDGE = new Set(['selected', 'animated', 'style', 'markerEnd', 'markerStart',
  'className', 'data', 'zIndex', 'interactionWidth', 'hidden', 'source', 'target',
  'sourceHandle', 'targetHandle', 'type', 'label', 'labelStyle', 'focusable', 'deletable',
  'selectable', 'reconnectable', 'pathOptions', 'ariaLabel']);
const NODE_KEYS = ['id', 'type', 'x', 'y', 'label', 's', 'pin', 'sv'];
const EDGE_KEYS = ['id', 'from', 'out', 'to', 'in'];
const WF_KEYS = ['app', 'v', 'name', 'nodes', 'edges', 'view'];
const PFB_KEYS = ['settings', 'hash'];

// ---------------------------------------------------------------------------------------------
// Ids

// Numeric order of node ids (n2 before n10); ids not of the form n<k> come after, by text.
export function idNumber(id) {
  const m = /^[a-z](\d+)$/.exec(String(id));
  return m ? Number(m[1]) : NaN;
}
export function compareIds(a, b) {
  const na = idNumber(a), nb = idNumber(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb || (String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0);
  if (!Number.isNaN(na)) return -1;
  if (!Number.isNaN(nb)) return 1;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

function nextId(prefix, used) {
  let max = 0;
  for (const id of used) {
    const m = new RegExp('^' + prefix + '(\\d+)$').exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  let k = max + 1;
  while (used.has(prefix + k)) k++;
  return prefix + k;
}

// A node id that is not used yet: one more than the highest n<k>, so a new block never takes a
// number below an existing one (generated variable names stay put; DESIGN 6.6).
export function newNodeId(wf) {
  return nextId('n', new Set(((wf && wf.nodes) || []).map(n => n && n.id).filter(x => typeof x === 'string')));
}
export function newEdgeId(wf) {
  return nextId('e', new Set(((wf && wf.edges) || []).map(e => e && e.id).filter(x => typeof x === 'string')));
}

// ---------------------------------------------------------------------------------------------
// Making workflows and nodes

export function emptyWorkflow(name = 'My workflow') {
  return {
    app: APP_ID, v: FORMAT_VERSION, name: String(name),
    nodes: [makeNodeObject('n1', 'start', 80, 120)],
    edges: [],
    view: { x: 0, y: 0, zoom: 1 },
  };
}

function makeNodeObject(id, type, x, y) {
  const def = getBlock(type);
  return {
    id, type, x, y, label: '',
    s: def ? orderedSettings(def, settingsOf({ type, s: {} })) : {},
    pin: [],
    sv: def ? (def.version || 1) : 1,
  };
}

// A new node of `type` for this workflow (not added to it): settings filled with defaults.
export function makeNode(wf, type, x = 0, y = 0) {
  return makeNodeObject(newNodeId(wf), type, Number(x) || 0, Number(y) || 0);
}

// The ports a Missing block shows: named after the wires that touch it, so its wires can still
// be drawn and removed (DESIGN 3). { flowIn, inputs: [ids], outputs: [ids] }.
export function missingPorts(wf, nodeId) {
  const inputs = [], outputs = [];
  let flowIn = false;
  for (const e of (wf && wf.edges) || []) {
    if (!e) continue;
    if (e.to === nodeId) { if (e.in === 'in') flowIn = true; else if (!inputs.includes(e.in)) inputs.push(e.in); }
    if (e.from === nodeId && !outputs.includes(e.out)) outputs.push(e.out);
  }
  return { flowIn, inputs, outputs };
}

// The names already used for a kind of setting (a setting with `suggest: kind`, e.g. 'vars' for
// Remember / Recall a value, 'tables' for results tables), sorted, for the inspector's select.
export function suggestions(wf, kind) {
  const out = new Set();
  for (const n of (wf && wf.nodes) || []) {
    const def = n && getBlock(n.type);
    if (!def) continue;
    for (const st of def.settings || []) {
      if (st.suggest !== kind) continue;
      const v = n.s && n.s[st.key];
      if (typeof v === 'string' && v.trim()) out.add(v.trim());
    }
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

// ---------------------------------------------------------------------------------------------
// Loading

function isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function clone(v) { try { return JSON.parse(JSON.stringify(v)); } catch (e) { return undefined; } }
function finite(v, d) { const n = Number(v); return typeof v !== 'boolean' && v !== null && v !== '' && Number.isFinite(n) ? n : d; }

// Settings in the block's declared order, then any keys this version does not know (kept for a
// later version), in their saved order.
function orderedSettings(def, s) {
  const out = {};
  for (const st of def.settings || []) if (s[st.key] !== undefined) out[st.key] = s[st.key];
  for (const k of Object.keys(s)) if (!(k in out)) out[k] = s[k];
  return out;
}

// input: a workflow object, its JSON text, or the text of a .py the Builder wrote.
// Returns { wf, notes }; wf is null when nothing could be loaded (the canvas stays as it is).
export function loadWorkflow(input) {
  const notes = [];
  try {
    return loadInner(input, notes);
  } catch (e) {
    notes.push({ level: 'error', msg: 'This workflow could not be read (' + String(e && e.message || e) + '). Nothing was changed.' });
    return { wf: null, notes };
  }
}

function loadInner(input, notes) {
  const fail = (msg) => { notes.push({ level: 'error', msg }); return { wf: null, notes }; };
  let obj = input;
  let pyText = null;
  if (typeof input === 'string') {
    const text = input.replace(/^\ufeff/, '');
    const t = text.trim();
    if (t.startsWith('{')) {
      try { obj = JSON.parse(t); } catch (e) { return fail('This file is not a valid workflow file (the JSON does not read: ' + e.message + '). Nothing was changed.'); }
    } else {
      obj = extractFromPython(text);
      if (!obj) return fail('This file has no Builder workflow in it. A .py made by the Builder ends with a line that starts "# PFB1". Nothing was changed.');
      pyText = text;
    }
  }
  if (!isPlainObject(obj)) return fail('This is not a Builder workflow. Nothing was changed.');
  if (obj.app !== undefined && obj.app !== APP_ID) {
    return fail('This file was made by another tool ("' + String(obj.app).slice(0, 60) + '"), not the PowerFactory Workflow Builder. Nothing was changed.');
  }
  if (obj.app === undefined && !Array.isArray(obj.nodes)) return fail('This is not a Builder workflow (it has no blocks). Nothing was changed.');
  obj = clone(obj);
  if (!isPlainObject(obj)) return fail('This is not a Builder workflow. Nothing was changed.');

  const pfbSettings = isPlainObject(obj.settings) ? obj.settings : null;
  const pfbHash = typeof obj.hash === 'string' ? obj.hash : null;
  for (const k of PFB_KEYS) delete obj[k];

  // Format version and migrations.
  let v = obj.v === undefined ? 1 : Number(obj.v);
  if (!Number.isInteger(v) || v < 1) {
    notes.push({ level: 'warning', msg: 'The workflow format number was not readable; it was read as version 1.' });
    v = 1;
  }
  while (v < FORMAT_VERSION && typeof MIGRATIONS[v] === 'function') {
    try { obj = MIGRATIONS[v](obj) || obj; } catch (e) { notes.push({ level: 'warning', msg: 'An update of this older workflow did not finish (' + e.message + '); it was loaded as it is.' }); }
    v++;
  }
  if (v > FORMAT_VERSION) {
    notes.push({ level: 'warning', msg: 'This workflow was made with a newer version of the Builder. What this version knows is loaded; the rest is kept and saved back unchanged.' });
  }

  const wf = { app: APP_ID, v, name: typeof obj.name === 'string' ? obj.name : (obj.name === undefined ? 'My workflow' : String(obj.name)) };

  // ---- Nodes: clean ids, keep everything.
  const rawNodes = Array.isArray(obj.nodes) ? obj.nodes : [];
  if (obj.nodes !== undefined && !Array.isArray(obj.nodes)) notes.push({ level: 'warning', msg: 'The list of blocks was not readable, so no blocks were loaded.' });
  const valid = rawNodes.filter(isPlainObject);
  if (valid.length !== rawNodes.length) notes.push({ level: 'warning', msg: (rawNodes.length - valid.length) + ' entries in the list of blocks were not blocks and were left out.' });
  const used = new Set();
  const firstOf = new Set();
  for (const n of valid) {
    if (typeof n.id === 'string' && ID_RE.test(n.id) && !used.has(n.id)) { used.add(n.id); firstOf.add(n); }
  }
  const idMap = new Map();          // a bad id -> the clean id given to its first block
  const nodes = [];
  const missingTypes = new Set();
  const newerTypes = new Set();
  for (const raw of valid) {
    const node = {};
    let id = raw.id;
    if (!firstOf.has(raw)) {
      const fresh = nextId('n', used);
      used.add(fresh);
      const oldText = typeof id === 'string' || typeof id === 'number' ? String(id) : '';
      if (oldText && ID_RE.test(oldText)) {
        notes.push({ level: 'warning', msg: 'Two blocks had the same id "' + oldText + '"; the second one is now "' + fresh + '". Wires to "' + oldText + '" go to the first one: check the wires of ' + nameOf(raw) + '.', nodeId: fresh });
      } else {
        if (oldText && !idMap.has(oldText)) idMap.set(oldText, fresh);
        notes.push({ level: 'info', msg: 'A block id that cannot be used ("' + oldText.slice(0, 40) + '") was replaced by "' + fresh + '".', nodeId: fresh });
      }
      id = fresh;
    }
    node.id = id;
    node.type = typeof raw.type === 'string' ? raw.type : String(raw.type === undefined ? '' : raw.type);
    node.x = finite(raw.x, 0);
    node.y = finite(raw.y, 0);
    node.label = typeof raw.label === 'string' ? raw.label : (raw.label === undefined || raw.label === null ? '' : String(raw.label));
    node.s = isPlainObject(raw.s) ? raw.s : {};
    node.pin = Array.isArray(raw.pin) ? [...new Set(raw.pin.filter(p => typeof p === 'string'))] : [];
    if (raw.sv !== undefined) node.sv = raw.sv;
    for (const k of Object.keys(raw)) if (!NODE_KEYS.includes(k) && !UI_ONLY_NODE.has(k)) node[k] = raw[k];
    const def = getBlock(node.type);
    if (!def) {
      if (!missingTypes.has(node.type)) {
        missingTypes.add(node.type);
        notes.push({ level: 'warning', msg: 'Missing block: "' + node.type.slice(0, 60) + '" is not in this version of the Builder. It is kept with its settings and wires, but it does not run.', nodeId: node.id });
      }
    } else {
      const version = def.version || 1;
      const sv = node.sv === undefined ? undefined : Number(node.sv);
      if (sv !== undefined && Number.isFinite(sv) && sv > version) {
        // Made by a newer version of this block: keep its settings exactly as saved.
        if (!newerTypes.has(node.type)) {
          newerTypes.add(node.type);
          notes.push({ level: 'warning', msg: displayName(node) + ' was saved by a newer version of the Builder. Its settings are kept as they are; check them before you run.', nodeId: node.id });
        }
      } else {
        if (sv !== undefined && !Number.isFinite(sv)) delete node.sv;
        const full = settingsOf(node);
        // A select value this version does not know (an option a newer Builder added) is kept
        // as saved, so saving here does not lose it; the generator uses the default meanwhile.
        if (sv === undefined || sv === version) {
          for (const st of def.settings || []) {
            if (st.kind !== 'select') continue;
            const raw = node.s[st.key];
            if (raw === undefined || raw === null || typeof raw === 'object') continue;
            const known = optionPairs(st).some(([v, , was]) => v === String(raw) || was.map(String).includes(String(raw)));
            if (!known) {
              full[st.key] = String(raw);
              notes.push({ level: 'warning', msg: `${displayName(node)}: the choice "${String(raw).slice(0, 40)}" for ${st.label || st.key} is not known to this version of the Builder. It is kept; the default is used when the workflow runs.`, nodeId: node.id });
            }
          }
        }
        node.s = orderedSettings(def, full);
        node.sv = version;
      }
    }
    nodes.push(node);
  }
  wf.nodes = nodes;
  const byId = new Map(nodes.map(n => [n.id, n]));

  // ---- Edges: kept unless they cannot be drawn at all.
  const rawEdges = Array.isArray(obj.edges) ? obj.edges : [];
  if (obj.edges !== undefined && !Array.isArray(obj.edges)) notes.push({ level: 'warning', msg: 'The list of wires was not readable, so no wires were loaded.' });
  const edges = [];
  const usedE = new Set();
  const firstE = new Set();
  for (const e of rawEdges) if (isPlainObject(e) && typeof e.id === 'string' && ID_RE.test(e.id) && !usedE.has(e.id)) { usedE.add(e.id); firstE.add(e); }
  let dropped = 0;
  for (const raw of rawEdges) {
    if (!isPlainObject(raw)) { dropped++; continue; }
    const from = mapId(raw.from, idMap), to = mapId(raw.to, idMap);
    const out = typeof raw.out === 'string' ? raw.out : '';
    const inn = typeof raw.in === 'string' ? raw.in : '';
    if (!byId.has(from) || !byId.has(to) || !out || !inn) { dropped++; continue; }
    const edge = { id: raw.id, from, out, to, in: inn };
    if (!firstE.has(raw)) { edge.id = nextId('e', usedE); usedE.add(edge.id); }
    for (const k of Object.keys(raw)) if (!EDGE_KEYS.includes(k) && !UI_ONLY_EDGE.has(k)) edge[k] = raw[k];
    edges.push(edge);
  }
  if (dropped) notes.push({ level: 'warning', msg: dropped === 1 ? 'One wire did not connect two blocks of this workflow and was left out.' : dropped + ' wires did not connect two blocks of this workflow and were left out.' });
  wf.edges = edges;
  checkEdges(wf, byId, notes);

  // ---- View and anything else a newer version saved.
  const view = isPlainObject(obj.view) ? obj.view : {};
  wf.view = { x: finite(view.x, 0), y: finite(view.y, 0), zoom: finite(view.zoom, 1) > 0 ? finite(view.zoom, 1) : 1 };
  for (const k of Object.keys(obj)) if (!WF_KEYS.includes(k) && !PFB_KEYS.includes(k)) wf[k] = obj[k];

  // ---- A .py: hand edits outside SETTINGS, and SETTINGS values edited in the file.
  if (pyText !== null) {
    if (pfbHash && workflowHash(pyText) !== pfbHash) {
      notes.push({ level: 'warning', msg: 'Code outside SETTINGS was edited by hand in this file; those edits are not read back.' });
    }
    if (pfbSettings) readBackSettings(wf, pyText, pfbSettings, notes);
    readBackGraphStyle(wf, pyText, notes);
  }
  return { wf, notes };
}

function mapId(id, idMap) {
  const t = typeof id === 'string' || typeof id === 'number' ? String(id) : '';
  return idMap.has(t) ? idMap.get(t) : t;
}

function nameOf(raw) {
  const def = getBlock(raw && raw.type);
  return (raw && typeof raw.label === 'string' && raw.label.trim()) || (def ? def.title : 'a block');
}

// Notes for wires that no longer fit (kept, saved back unchanged, flagged in Problems too).
function checkEdges(wf, byId, notes) {
  const intoInput = new Set();
  const fromFlowOut = new Set();
  for (const e of wf.edges) {
    const a = byId.get(e.from), b = byId.get(e.to);
    const da = getBlock(a.type), db = getBlock(b.type);
    const pa = da ? findPort(a, e.out, 'out') : null;
    const pb = db ? findPort(b, e.in, 'in') : null;
    if (da && !pa) { notes.push({ level: 'warning', msg: 'A wire leaves ' + displayName(a) + ' from a port it no longer has ("' + e.out + '"). It is kept so you can see it: remove it and connect again.', nodeId: a.id, edgeId: e.id }); continue; }
    if (db && !pb) { notes.push({ level: 'warning', msg: 'A wire goes into ' + displayName(b) + ' at a port it no longer has ("' + e.in + '"). It is kept so you can see it: remove it and connect again.', nodeId: b.id, edgeId: e.id }); continue; }
    if (!pa || !pb) continue;
    if (!canConnect(pa.type, pb.type)) {
      notes.push({ level: 'warning', msg: 'The wire from ' + displayName(a) + ' to ' + displayName(b) + ' joins ports that do not fit together. It is kept: remove it.', nodeId: b.id, edgeId: e.id });
      continue;
    }
    if (pb.kind === 'input') {
      const k = b.id + ':' + pb.port.id;
      if (intoInput.has(k)) notes.push({ level: 'warning', msg: 'Two wires go into ' + (pb.port.label || pb.port.id) + ' of ' + displayName(b) + '. Only the first is used: remove the other.', nodeId: b.id, edgeId: e.id });
      intoInput.add(k);
    }
    if (pa.kind === 'flowOut') {
      const k = a.id + ':' + pa.port.id;
      if (fromFlowOut.has(k)) notes.push({ level: 'warning', msg: 'Two wires leave ' + (pa.port.label || 'the flow output') + ' of ' + displayName(a) + '. A step leads to one next step: only the first is used.', nodeId: a.id, edgeId: e.id });
      fromFlowOut.add(k);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Saving

// A plain object in a stable key order: workflow keys, then node keys, then edge keys in the
// order of the format above; anything a newer version saved comes after, sorted. UI-only keys
// (selected, dragging, measured, ...) are never saved. Every declared setting is saved.
export function serialize(wf) {
  const w = isPlainObject(wf) ? wf : {};
  const out = {
    app: APP_ID,
    v: Number.isInteger(w.v) && w.v >= 1 ? w.v : FORMAT_VERSION,
    name: typeof w.name === 'string' ? w.name : String(w.name === undefined ? '' : w.name),
    nodes: (Array.isArray(w.nodes) ? w.nodes : []).filter(isPlainObject).map(serializeNode),
    edges: (Array.isArray(w.edges) ? w.edges : []).filter(isPlainObject).map(serializeEdge),
  };
  const view = isPlainObject(w.view) ? w.view : {};
  out.view = { x: finite(view.x, 0), y: finite(view.y, 0), zoom: finite(view.zoom, 1) };
  for (const k of Object.keys(w).filter(k => !WF_KEYS.includes(k) && !PFB_KEYS.includes(k) && w[k] !== undefined).sort()) out[k] = clone(w[k]);
  return out;
}

function serializeNode(n) {
  const def = getBlock(n.type);
  const s0 = isPlainObject(n.s) ? n.s : {};
  let s;
  if (def && !(Number(n.sv) > (def.version || 1))) {
    const full = settingsOf({ ...n, s: s0, sv: def.version || 1 });
    s = {};
    for (const st of def.settings || []) s[st.key] = s0[st.key] !== undefined ? clone(s0[st.key]) : clone(full[st.key]);
    for (const k of Object.keys(s0)) if (!(k in s)) s[k] = clone(s0[k]);
  } else {
    s = clone(s0) || {};
  }
  const o = {
    id: String(n.id), type: String(n.type),
    x: finite(n.x, 0), y: finite(n.y, 0),
    label: typeof n.label === 'string' ? n.label : '',
    s,
    pin: Array.isArray(n.pin) ? [...new Set(n.pin.filter(p => typeof p === 'string'))] : [],
  };
  if (def) o.sv = Number(n.sv) > (def.version || 1) ? n.sv : (def.version || 1);
  else if (n.sv !== undefined) o.sv = n.sv;
  for (const k of Object.keys(n).filter(k => !NODE_KEYS.includes(k) && !UI_ONLY_NODE.has(k) && n[k] !== undefined).sort()) o[k] = clone(n[k]);
  return o;
}

function serializeEdge(e) {
  const o = { id: String(e.id), from: String(e.from), out: String(e.out), to: String(e.to), in: String(e.in) };
  for (const k of Object.keys(e).filter(k => !EDGE_KEYS.includes(k) && !UI_ONLY_EDGE.has(k) && e[k] !== undefined).sort()) o[k] = clone(e[k]);
  return o;
}

export function toJSON(wf) {
  return JSON.stringify(serialize(wf), null, 2);
}

// ---------------------------------------------------------------------------------------------
// The # PFB1 line of a generated .py

// JSON with every non-ASCII character (and U+2028/2029) escaped, so the line survives an editor
// that re-saves the file in another encoding (C24e).
function asciiJson(obj) {
  return JSON.stringify(obj).replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

// The WORKFLOW section of a generated file (from "# ==== WORKFLOW" up to "# ==== HELPERS"),
// with line endings and trailing spaces normalised, hashed (FNV-1a, 32 bit).
export function workflowHash(code) {
  const lines = String(code).replace(/\r\n?/g, '\n').split('\n');
  let a = lines.findIndex(l => /^# ==== WORKFLOW/.test(l));
  if (a < 0) a = 0;
  let b = lines.findIndex((l, i) => i > a && /^# ==== HELPERS/.test(l));
  if (b < 0) b = lines.findIndex((l, i) => i > a && /^# PFB1 /.test(l));
  if (b < 0) b = lines.length;
  const text = lines.slice(a, b).map(l => l.replace(/\s+$/, '')).join('\n');
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return 'fnv1a:' + h.toString(16).padStart(8, '0');
}

// The code with the workflow appended as its last line ("# PFB1 {...}"); an old PFB1 line at
// the end is replaced. settingsMap: SETTINGS constant -> [nodeId, key(, sub)].
export function embedInPython(code, wf, settingsMap) {
  const obj = serialize(wf);
  delete obj.view;
  // Attached data files travel in the .json and in the study package, never inside a script:
  // a .py is code to read, not a place to carry a reader's spreadsheet.
  delete obj.files;
  obj.settings = isPlainObject(settingsMap) ? settingsMap : {};
  let text = String(code === undefined || code === null ? '' : code).replace(/\s+$/, '');
  const lines = text.split('\n');
  while (lines.length && /^# PFB1 /.test(lines[lines.length - 1])) lines.pop();
  text = lines.join('\n').replace(/\s+$/, '');
  obj.hash = workflowHash(text);
  return text + '\n# PFB1 ' + asciiJson(obj) + '\n';
}

// The object in the last column-0 "# PFB1 " line, or null.
export function extractFromPython(text) {
  const lines = String(text === undefined || text === null ? '' : text).split(/\r\n|\n|\r/);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith('# PFB1 ')) {
      try {
        const obj = JSON.parse(lines[i].slice(7).trim());
        return isPlainObject(obj) ? obj : null;
      } catch (e) {
        return null;
      }
    }
  }
  return null;
}

// SETTINGS lines a reader edited in the .py (NAME = <literal>) are read back into the workflow
// (U18). Only names the PFB1 line maps are read; a value that does not fit its setting is left
// alone and named in a note.
function readBackSettings(wf, text, map, notes) {
  const lines = String(text).split(/\r\n|\n|\r/);
  const a = lines.findIndex(l => /^# ==== SETTINGS/.test(l));
  if (a < 0) return;
  let b = lines.findIndex((l, i) => i > a && /^# ==== /.test(l));
  if (b < 0) b = lines.length;
  const changed = [], unreadable = [];
  for (let i = a + 1; i < b; i++) {
    const m = /^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/.exec(lines[i]);
    if (!m || !Array.isArray(map[m[1]])) continue;
    const name = m[1];
    const lit = parsePyLiteral(m[2]);
    if (!lit) { unreadable.push(name); continue; }
    const res = applySetting(wf, map[name], lit.value);
    if (res === 'changed') changed.push(name);
    else if (res === 'bad') unreadable.push(name);
  }
  if (changed.length) notes.push({ level: 'info', msg: 'Read ' + (changed.length === 1 ? 'a value' : changed.length + ' values') + ' edited in the file: ' + changed.join(', ') + '.' });
  if (unreadable.length) notes.push({ level: 'warning', msg: 'These SETTINGS lines in the file could not be read back, so the workflow keeps its own values: ' + unreadable.join(', ') + '.' });
}

// GRAPH_STYLE = { ... } in SETTINGS, edited in the file, is read back as the workflow's graph
// style. A value that cannot be used keeps the default's (as the script itself does) and is
// named in a note; keys this version does not know are kept on the workflow as they were.
function readBackGraphStyle(wf, text, notes) {
  const lines = String(text).split(/\r\n|\n|\r/);
  const a = lines.findIndex(l => /^# ==== SETTINGS/.test(l));
  if (a < 0) return;
  let b = lines.findIndex((l, i) => i > a && /^# ==== /.test(l));
  if (b < 0) b = lines.length;
  const i0 = lines.findIndex((l, i) => i > a && i < b && /^GRAPH_STYLE\s*=/.test(l));
  if (i0 < 0) return;
  let i1 = lines.findIndex((l, i) => i >= i0 && i < b && /^\}/.test(l));
  if (i1 < 0) i1 = i0;
  const lit = parsePyLiteral(lines.slice(i0, i1 + 1).join('\n').replace(/^GRAPH_STYLE\s*=\s*/, ''));
  if (!lit || !isPlainObject(lit.value)) {
    notes.push({ level: 'warning', msg: 'GRAPH_STYLE in the file could not be read back, so the workflow keeps its own graph style.' });
    return;
  }
  const bad = unusableKeys(lit.value);
  if (bad.length) notes.push({ level: 'warning', msg: 'These GRAPH_STYLE values in the file cannot be used, so they take the Adjie Brotools style\'s: ' + bad.join(', ') + '.' });
  const next = normalizeStyle(lit.value);
  if (sameStyle(next, wf.graph)) return;
  wf.graph = { ...(isPlainObject(wf.graph) ? wf.graph : {}), ...next };
  notes.push({ level: 'info', msg: 'Read the graph style edited in the file (GRAPH_STYLE).' });
}

function applySetting(wf, ref, value) {
  const [nodeId, key, sub] = ref;
  if (nodeId === '*') {
    if (key !== 'name' || typeof value !== 'string') return 'bad';
    if (wf.name === value) return 'same';
    wf.name = value; return 'changed';
  }
  const node = wf.nodes.find(n => n.id === nodeId);
  const def = node && getBlock(node.type);
  const st = def && (def.settings || []).find(x => x.key === key);
  if (!st) return 'bad';
  const cur = node.s[key];
  let next;
  if (st.kind === 'element') {
    const field = sub || 'name';
    if (typeof value !== 'string') return 'bad';
    const el = isPlainObject(cur) ? { ...cur } : { cls: '', name: '', match: 'one' };
    if (el[field] === value) return 'same';
    el[field] = value; node.s[key] = el; return 'changed';
  }
  if (st.kind === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 'bad';
    next = value;
  } else if (st.kind === 'bool') {
    if (typeof value !== 'boolean') return 'bad';
    next = value;
  } else if (st.kind === 'select') {
    const sv = value === true ? 'True' : value === false ? 'False' : String(value);
    const hit = optionPairs(st).find(([v]) => v === sv);
    if (!hit) return 'bad';
    next = hit[0];
  } else if (st.kind === 'list') {
    return 'bad';
  } else if (Array.isArray(value) && (st.kind === 'textarea' || st.kind === 'text')) {
    // A typed list pinned as a Python list (For each item, List of values): same values = same.
    if (value.some(v => v !== null && typeof v === 'object')) return 'bad';
    if (JSON.stringify(parseValues(cur)) === JSON.stringify(value)) return 'same';
    next = value.map(v => (v === null ? '' : String(v))).join('\n');
  } else {
    if (typeof value !== 'string' && typeof value !== 'number') return 'bad';
    next = String(value);
  }
  if (cur === next) return 'same';
  node.s[key] = next;
  return 'changed';
}
