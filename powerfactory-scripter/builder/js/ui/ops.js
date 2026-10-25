// Workflow edits the editor makes: pure functions from a workflow to a new workflow, so the
// store can keep every version for undo and Node can test them. Nothing here touches the DOM.
//
// A workflow is never mutated: an edit returns a new object with new `nodes` / `edges` arrays,
// and the nodes it did not touch keep their identity (the canvas reuses their drawings).
// The saved handles (node and edge ids, port ids, setting keys) follow DESIGN section 3.

import {
  getBlock, portsOf, findPort, canConnect, whyNot, hasFlowIn, settingsOf, allBlocks, familyOf, meaningOf, TYPES, visibleSettings,
} from '../core/registry.js';
import { makeNode, newNodeId, newEdgeId, missingPorts, loadWorkflow, serialize, APP_ID, FORMAT_VERSION, compareIds } from '../core/workflow.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const clone = (v) => JSON.parse(JSON.stringify(v));
export const GRID = 16;
export const snap = (v) => Math.round(Number(v || 0) / GRID) * GRID;

export function nodeById(wf, id) {
  return (wf && wf.nodes || []).find(n => n.id === id) || null;
}

// Is this a step that runs in order (flow ports), as opposed to a calculator or a note?
export function isStatementDef(def) {
  return !!def && !['pure', 'note'].includes(def.kind);
}
export function isStatement(node) {
  const def = getBlock(node && node.type);
  return def ? isStatementDef(def) : true;   // a Missing block is drawn with its wires; treat as a step
}

// ---------------------------------------------------------------------------------------------
// Ports as the canvas draws them

// { missing, flowIn, flowOuts, inputs, outputs, error }. A wire that ends on a port the block no
// longer has is kept (DESIGN 3) and drawn on a placeholder port named after it (`stray`), so the
// reader can see it and remove it. A Missing block's ports are all placeholders.
export function nodePorts(wf, node) {
  const def = getBlock(node.type);
  if (!def) {
    const m = missingPorts(wf, node.id);
    return {
      missing: true, flowIn: m.flowIn, flowOuts: [],
      inputs: m.inputs.map(id => ({ id, label: id, type: 'any', stray: true })),
      outputs: m.outputs.map(id => ({ id, label: id, type: 'any', stray: true })),
    };
  }
  const p = portsOf(node);
  const res = { missing: false, flowIn: p.flowIn, flowOuts: p.flowOuts.slice(), inputs: p.inputs.slice(), outputs: p.outputs.slice(), error: p.error };
  for (const e of wf.edges) {
    if (e.to === node.id && !findPort(node, e.in, 'in') && !res.inputs.some(x => x.id === e.in)) {
      res.inputs.push({ id: e.in, label: e.in, type: 'any', stray: true });
    }
    if (e.from === node.id && !findPort(node, e.out, 'out') && !res.outputs.some(x => x.id === e.out)) {
      res.outputs.push({ id: e.out, label: e.out, type: 'any', stray: true });
    }
  }
  return res;
}

// What the Settings tab draws for a block's inputs (README 4.1):
//   rows      the inputs that get a row: wired ones (named by their source), stray ones, those
//             whose value is typed in a field there (a fallback setting that is shown and not
//             under More options), and required ones with nothing to type;
//   toWire    the unwired inputs with nothing to type that are main ports (a graph's curves):
//             one shared line;
//   optional  the same for the ports the canvas folds (`more`): another line;
//   inInputs  the setting keys the Inputs rows stand for (not drawn again under Settings);
//   moreInputs  setting key -> input, for a fallback setting typed under More options.
// An input whose fallback setting cannot apply with these settings gets nothing at all.
// `visible` is visibleSettings() for the block as it is wired now.
export function inputPlan(wf, node, visible) {
  const def = getBlock(node && node.type);
  const ports = nodePorts(wf, node);
  const shown = new Set((visible || []).map(st => st.key));
  const wired = new Set(wf.edges.filter(e => e.to === node.id).map(e => handleIdOf(wf, node.id, e.in, 'in')));
  const rows = [], toWire = [], optional = [], inInputs = new Set(), moreInputs = new Map();
  for (const p of ports.inputs) {
    const fst = def && p.fallback ? (def.settings || []).find(z => z.key === p.fallback) : null;
    if (p.stray || wired.has(p.id)) { rows.push(p); if (fst) inInputs.add(fst.key); continue; }
    if (fst) {
      if (!shown.has(fst.key)) continue;
      if (fst.more) { moreInputs.set(fst.key, p); continue; }
      rows.push(p);
      inInputs.add(fst.key);
      continue;
    }
    if (p.required) rows.push(p); else if (p.more) optional.push(p); else toWire.push(p);
  }
  return { rows, toWire, optional, inInputs, moreInputs };
}

// The ports the canvas folds behind "+N more" (canvas.js): { inputs: Set, outputs: Set } of ids.
// A port folds while it is unwired and either says so (`more` on the port: true, or a function
// (settings, { wired, srcPort }) for a block whose main ports depend on what it reads) or is an
// input whose value is typed under More options or cannot apply with these settings. An input
// the block cannot run without (required, or an element it looks up) never folds. `regions`:
// the generator's, for "is it in a loop" (undefined is fine).
export function foldedPorts(wf, node, regions) {
  const out = { inputs: new Set(), outputs: new Set() };
  const def = getBlock(node && node.type);
  if (!def) return out;
  const ports = nodePorts(wf, node);
  const wiredIn = new Set(), wiredOut = new Set();
  for (const e of wf.edges) {
    if (e.to === node.id) wiredIn.add(handleIdOf(wf, node.id, e.in, 'in'));
    if (e.from === node.id) wiredOut.add(handleIdOf(wf, node.id, e.out, 'out'));
  }
  const s = settingsOf(node);
  const reg = regions && regions[node.id];
  const inLoop = Array.isArray(reg) ? reg.some(r => r.kind === 'loop') : undefined;
  let shown;
  try { shown = new Set(visibleSettings(node, wiredIn, { inLoop }).map(st => st.key)); } catch (e) { shown = new Set((def.settings || []).map(st => st.key)); }
  const cx = {
    wired: wiredIn,
    srcPort: (pid) => { const e = wf.edges.find(x => x.to === node.id && handleIdOf(wf, node.id, x.in, 'in') === pid); const a = e && portAt(wf, e.from, e.out, 'out'); return a ? a.port : null; },
  };
  const says = (p) => {
    if (typeof p.more === 'function') { try { return !!p.more(s, cx); } catch (e) { return false; } }
    return !!p.more;
  };
  for (const p of ports.inputs) {
    if (p.stray || wiredIn.has(p.id) || p.required) continue;
    const fst = p.fallback ? (def.settings || []).find(z => z.key === p.fallback) : null;
    if (fst && (fst.required || (fst.kind === 'element' && p.type === 'obj'))) continue;
    if (says(p) || (fst && (fst.more || !shown.has(fst.key)))) out.inputs.add(p.id);
  }
  for (const p of ports.outputs) if (!p.stray && !wiredOut.has(p.id) && says(p)) out.outputs.add(p.id);
  return out;
}

// The port an edge end or a canvas handle refers to: { kind: 'flowIn'|'flowOut'|'input'|'output',
// type, port, node, def, stray }. Old port ids go through portAlias (findPort).
export function portAt(wf, nodeId, portId, side) {
  const node = nodeById(wf, nodeId);
  if (!node) return null;
  const def = getBlock(node.type);
  if (def) {
    const f = findPort(node, portId, side);
    if (f) return { ...f, node, def, stray: false };
  }
  if (side === 'in' && portId === 'in' && (!def || hasFlowIn(def))) return { kind: 'flowIn', type: 'flow', port: { id: 'in', label: '' }, node, def, stray: !def };
  return { kind: side === 'in' ? 'input' : 'output', type: 'any', port: { id: portId, label: portId }, node, def, stray: true };
}

export function isFlowEdge(wf, e) {
  const b = portAt(wf, e.to, e.in, 'in');
  return !!b && b.kind === 'flowIn';
}

// The handle id the canvas uses for an edge end (the current port id after portAlias).
export function handleIdOf(wf, nodeId, portId, side) {
  const p = portAt(wf, nodeId, portId, side);
  return p ? p.port.id : portId;
}

// ---------------------------------------------------------------------------------------------
// Small edits

function withNode(wf, id, fn) {
  let hit = false;
  const nodes = wf.nodes.map(n => {
    if (n.id !== id) return n;
    hit = true;
    const copy = { ...n, s: isObj(n.s) ? { ...n.s } : {}, pin: Array.isArray(n.pin) ? n.pin.slice() : [] };
    return fn(copy) || copy;
  });
  return hit ? { ...wf, nodes } : wf;
}

// ---------------------------------------------------------------------------------------------
// Attached data files (DESIGN 3: `wf.files`, a block id -> { name, mime, b64 })
//
// A file a reader attaches to a Read table from file block travels with the workflow: it is
// saved in the .json, kept in the mini cache and written into the study package beside the
// script. It is left out of the .py (workflow.js embedInPython), so a script never carries a
// reader's data; opening such a .py says the file has to be attached again.

export function fileOf(wf, id) {
  const f = wf && wf.files && wf.files[id];
  return f && typeof f === 'object' && typeof f.b64 === 'string' ? f : null;
}
export function filesOf(wf) {
  const out = {};
  for (const [id, f] of Object.entries((wf && wf.files) || {})) if (fileOf(wf, id)) out[id] = f;
  return out;
}
export function setFile(wf, id, file) {
  const files = { ...((wf && wf.files) || {}) };
  if (file) files[id] = { name: String(file.name || ''), mime: String(file.mime || ''), b64: String(file.b64 || '') };
  else delete files[id];
  if (!Object.keys(files).length) { const { files: _drop, ...rest } = wf; return rest; }
  return { ...wf, files };
}
// Keep only the files of blocks that are still there (after a delete).
function pruneFiles(wf) {
  if (!wf.files) return wf;
  const ids = new Set(wf.nodes.map(n => n.id));
  const files = {};
  for (const [id, f] of Object.entries(wf.files)) if (ids.has(id)) files[id] = f;
  if (Object.keys(files).length === Object.keys(wf.files).length) return wf;
  if (!Object.keys(files).length) { const { files: _drop, ...rest } = wf; return rest; }
  return { ...wf, files };
}

// ---------------------------------------------------------------------------------------------
// Kind switch (block families, core/registry.js defineFamily)

const sameValue = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);

// Change a block to another member of its family: same id, name, pins and wires; the settings go
// across by key. A key the old kind did not have keeps what the block holds for it (from an
// earlier switch) or takes its default; one that means something else on the new kind
// (meaningOf) takes the new default; a value left at the old kind's default takes the new kind's
// default. Keys the new kind does not know stay in the block, so switching back finds them.
// Wires on ports the new kind does not have are kept and flagged, as the loader does.
export function switchKind(wf, id, type) {
  const node = nodeById(wf, id);
  const from = node && getBlock(node.type), to = getBlock(type);
  const fam = node && familyOf(node.type);
  if (!from || !to || node.type === type || !fam || !fam.members.includes(type)) return wf;
  const old = settingsOf(node);
  const s = isObj(node.s) ? { ...node.s } : {};
  for (const st of to.settings || []) {
    const ost = (from.settings || []).find(z => z.key === st.key);
    if (!ost) continue;
    if (meaningOf(ost) !== meaningOf(st)) s[st.key] = clone(st.default === undefined ? null : st.default);
    else if (sameValue(old[st.key], ost.default) && !sameValue(ost.default, st.default)) s[st.key] = clone(st.default === undefined ? null : st.default);
  }
  return withNode(wf, id, n => { n.type = type; n.s = s; n.sv = to.version || 1; });
}

// The wires a Kind switch would leave hanging: on a port the new kind does not have, or one that
// no longer takes what the wire carries. [{ edge, port, gone: true | false (does not fit) }].
export function hangingWires(wf, id, type) {
  const next = switchKind(wf, id, type);
  if (next === wf) return [];
  const fits = (w, e) => {
    const a = portAt(w, e.from, e.out, 'out'), b = portAt(w, e.to, e.in, 'in');
    return { a, b, ok: !!(a && b && !a.stray && !b.stray && !whyNot(a.type, b.type)) };
  };
  const out = [];
  for (const e of next.edges) {
    if (e.from !== id && e.to !== id) continue;
    if (!fits(wf, e).ok) continue;      // already hanging: not this switch's doing
    const { a, b, ok } = fits(next, e);
    if (ok) continue;
    const mine = e.from === id ? a : b;
    const gone = !mine || mine.stray;
    out.push({ edge: e, port: gone ? (e.from === id ? e.out : e.in) : (mine.port.label || mine.port.id), gone });
  }
  return out;
}

export function setName(wf, name) { return { ...wf, name: String(name) }; }
export function setLabel(wf, id, label) { return withNode(wf, id, n => { n.label = String(label || ''); }); }
export function setSetting(wf, id, key, value) { return withNode(wf, id, n => { n.s[key] = value; }); }
export function togglePin(wf, id, key) {
  return withNode(wf, id, n => { n.pin = n.pin.includes(key) ? n.pin.filter(k => k !== key) : [...n.pin, key]; });
}
export function moveNodes(wf, pos) {
  let changed = false;
  const nodes = wf.nodes.map(n => {
    const p = pos[n.id];
    if (!p || (p.x === n.x && p.y === n.y)) return n;
    changed = true;
    return { ...n, x: Math.round(p.x), y: Math.round(p.y) };
  });
  return changed ? { ...wf, nodes } : wf;
}

// List settings: rows keep stable ids (prefix + number) so dynamic ports keep their wires.
function rowsOf(node, key) {
  const v = node.s && node.s[key];
  return Array.isArray(v) ? v : (settingsOf(node)[key] || []);
}
export function newRowId(rows, prefix = 'c') {
  const used = new Set(rows.map(r => r && r.id));
  let k = 1;
  while (used.has(prefix + k)) k++;
  return prefix + k;
}
export function addRow(wf, id, key, init) {
  const node = nodeById(wf, id);
  const def = node && getBlock(node.type);
  const st = def && def.settings.find(s => s.key === key);
  if (!st) return wf;
  const rows = clone(rowsOf(node, key));
  const row = { id: newRowId(rows, st.rowPrefix || 'c') };
  for (const c of st.columns || []) row[c.key] = clone(c.default === undefined ? '' : c.default);
  Object.assign(row, init || {});
  rows.push(row);
  return setSetting(wf, id, key, rows);
}
export function setRowField(wf, id, key, rowId, col, value) {
  const node = nodeById(wf, id);
  if (!node) return wf;
  const rows = clone(rowsOf(node, key)).map(r => (r.id === rowId ? { ...r, [col]: value } : r));
  return setSetting(wf, id, key, rows);
}
// Removing a row is an explicit act, so the wires on the ports that row made go with it
// (one undo step). Wires on ports that vanish because of a typed template stay until removed.
export function removeRow(wf, id, key, rowId) {
  const node = nodeById(wf, id);
  if (!node) return wf;
  const before = nodePorts(wf, node);
  const rows = clone(rowsOf(node, key)).filter(r => r.id !== rowId);
  let next = setSetting(wf, id, key, rows);
  const after = portsOf(nodeById(next, id));
  const goneIn = before.inputs.filter(p => !p.stray && !after.inputs.some(q => q.id === p.id)).map(p => p.id);
  const goneOut = [...before.outputs, ...before.flowOuts].filter(p => !p.stray && !after.outputs.some(q => q.id === p.id) && !after.flowOuts.some(q => q.id === p.id)).map(p => p.id);
  const edges = next.edges.filter(e => !((e.to === id && goneIn.includes(e.in)) || (e.from === id && goneOut.includes(e.out))));
  if (edges.length !== next.edges.length) next = { ...next, edges };
  return next;
}

// ---------------------------------------------------------------------------------------------
// Adding and removing blocks and wires

export function addNode(wf, type, x, y, patch) {
  const node = makeNode(wf, type, snap(x), snap(y));
  if (patch) {
    if (patch.s) Object.assign(node.s, patch.s);
    if (patch.label) node.label = patch.label;
  }
  return { wf: { ...wf, nodes: [...wf.nodes, node] }, node };
}

export function removeEdges(wf, ids) {
  const set = new Set(ids);
  const edges = wf.edges.filter(e => !set.has(e.id));
  return edges.length === wf.edges.length ? wf : { ...wf, edges };
}

// Delete blocks and every wire that touches them. A workflow keeps one Start: deleting the
// last one is refused (the first Start by id is kept). Returns { wf, nodes, edges, refused }.
export function deleteNodes(wf, ids) {
  const want = new Set(ids);
  const starts = wf.nodes.filter(n => n.type === 'start').map(n => n.id).sort(compareIds);
  let refused = null;
  if (starts.length && starts.every(s => want.has(s))) { refused = starts[0]; want.delete(starts[0]); }
  const nodes = wf.nodes.filter(n => !want.has(n.id));
  const goneNodes = wf.nodes.filter(n => want.has(n.id));
  const goneEdges = wf.edges.filter(e => want.has(e.from) || want.has(e.to));
  if (!goneNodes.length) return { wf, nodes: [], edges: [], refused };
  const next = pruneFiles({ ...wf, nodes, edges: wf.edges.filter(e => !(want.has(e.from) || want.has(e.to))) });
  return { wf: next, nodes: goneNodes, edges: goneEdges, refused };
}

// Wire c = { from, out, to, in }. A data input takes one wire, so the wire already there is
// replaced (returned in `replaced`, for the undo toast). A flow output may lead to several steps:
// a new wire from a used one adds a parallel route (the wires already there are returned in
// `parallel`, so the toast can offer to replace them instead). A flow input may take many wires
// (routes joining).
export function connect(wf, c) {
  const a = portAt(wf, c.from, c.out, 'out'), b = portAt(wf, c.to, c.in, 'in');
  if (!a || !b) return { wf, edge: null, replaced: [], parallel: [] };
  const outId = a.port.id, inId = b.port.id;
  const same = wf.edges.find(e => e.from === c.from && e.to === c.to && handleIdOf(wf, e.from, e.out, 'out') === outId && handleIdOf(wf, e.to, e.in, 'in') === inId);
  if (same) return { wf, edge: same, replaced: [], parallel: [] };
  const replaced = [];
  const edges = wf.edges.filter(e => {
    if (b.kind === 'input' && e.to === c.to && handleIdOf(wf, e.to, e.in, 'in') === inId) { replaced.push(e); return false; }
    return true;
  });
  const parallel = a.kind === 'flowOut' ? edges.filter(e => e.from === c.from && handleIdOf(wf, e.from, e.out, 'out') === outId) : [];
  const edge = { id: newEdgeId(wf), from: c.from, out: outId, to: c.to, in: inId };
  return { wf: { ...wf, edges: [...edges, edge] }, edge, replaced, parallel };
}

// The flow successors of a node (targets of its flow wires).
function flowNext(wf, id) {
  return wf.edges.filter(e => e.from === id && isFlowEdge(wf, e)).map(e => e.to);
}
export function reaches(wf, fromId, toId, startOut) {
  const seen = new Set();
  const stack = startOut
    ? wf.edges.filter(e => e.from === fromId && e.out === startOut && isFlowEdge(wf, e)).map(e => e.to)
    : [fromId];
  while (stack.length) {
    const x = stack.pop();
    if (x === toId) return true;
    if (seen.has(x)) continue;
    seen.add(x);
    for (const y of flowNext(wf, x)) stack.push(y);
  }
  return false;
}

// Why the canvas refuses this new wire, in words, or '' when it may be made.
export function wireProblem(wf, c) {
  if (!c || !c.from || !c.to) return 'Wire an output into an input.';
  if (c.from === c.to) return 'A block cannot be wired to itself.';
  const a = portAt(wf, c.from, c.out, 'out'), b = portAt(wf, c.to, c.in, 'in');
  if (!a || !b) return 'One of these ports no longer exists.';
  if (!a.def || !b.def) return 'This block is missing from this version of the Builder, so it cannot take new wires.';
  if (a.stray || b.stray) return 'This port is gone from the block; it only shows an old wire. Remove that wire.';
  if (a.kind === 'input' || a.kind === 'flowIn' || b.kind === 'output' || b.kind === 'flowOut') return 'Wire an output (right side) into an input (left side).';
  const why = whyNot(a.type, b.type);
  if (why) return why;
  if (b.kind === 'flowIn') {
    if ((b.def.kind === 'loop' || b.def.kind === 'callback') && reaches(wf, c.to, c.from, 'body')) {
      return b.def.kind === 'loop'
        ? 'No need to wire back: when the Each pass route ends, the next pass starts.'
        : 'No need to wire back: when the Each try route ends, the next try starts.';
    }
    if (reaches(wf, c.to, c.from)) return 'This wire would make the steps go round in a circle. Use a loop block to repeat.';
  }
  return '';
}

// The first flow output of a node with no wire, or null.
export function freeFlowOut(wf, nodeId) {
  const node = nodeById(wf, nodeId);
  if (!node || !getBlock(node.type)) return null;
  const outs = portsOf(node).flowOuts;
  return outs.find(o => !wf.edges.some(e => e.from === nodeId && handleIdOf(wf, nodeId, e.out, 'out') === o.id)) || null;
}

// Put step N into the flow wire `edgeId` (A -> B becomes A -> N -> B). Returns the new wf, or
// the same wf when N has no flow input or output.
export function spliceOnEdge(wf, edgeId, nodeId) {
  const e = wf.edges.find(x => x.id === edgeId);
  const node = nodeById(wf, nodeId);
  if (!e || !node || !isFlowEdge(wf, e) || e.from === nodeId || e.to === nodeId) return wf;
  const def = getBlock(node.type);
  if (!def || !hasFlowIn(def)) return wf;
  const outs = portsOf(node).flowOuts;
  if (!outs.length) return wf;
  let next = removeEdges(wf, [e.id]);
  next = connect(next, { from: e.from, out: e.out, to: nodeId, in: 'in' }).wf;
  next = connect(next, { from: nodeId, out: outs[0].id, to: e.to, in: e.in }).wf;
  return next;
}

// Wire a new step after an anchor step: into its first free flow output, or, when every one is
// used, into the wire of its first flow output (so the new step goes between).
export function insertAfter(wf, anchorId, nodeId) {
  const anchor = nodeById(wf, anchorId);
  if (!anchor || !getBlock(anchor.type)) return wf;
  const free = freeFlowOut(wf, anchorId);
  if (free) return connect(wf, { from: anchorId, out: free.id, to: nodeId, in: 'in' }).wf;
  const outs = portsOf(anchor).flowOuts;
  if (!outs.length) return wf;
  const e = wf.edges.find(x => x.from === anchorId && handleIdOf(wf, anchorId, x.out, 'out') === outs[0].id && isFlowEdge(wf, x));
  return e ? spliceOnEdge(wf, e.id, nodeId) : wf;
}

// A new block of `type` right after step `anchorId` (a Problems fix): placed below it, wired in
// after it (between it and the step it led to). Null when the anchor is gone or the type unknown.
export function addAfterStep(wf, anchorId, type, sizes) {
  const anchor = nodeById(wf, anchorId);
  if (!anchor || !getBlock(anchor.type) || !getBlock(type)) return null;
  const m = sizes && sizes[anchorId];
  const at = freeSpot(wf, anchor.x + 40, anchor.y + ((m && m.height) || 110) + 60, sizes);
  const added = addNode(wf, type, at.x, at.y);
  return { wf: insertAfter(added.wf, anchorId, added.node.id), node: added.node };
}

// The first output of `src` whose type the first possible input of `dst` takes: [outId, inId].
export function firstDataLink(wf, srcId, dstId) {
  const src = nodeById(wf, srcId), dst = nodeById(wf, dstId);
  if (!src || !dst || !getBlock(src.type) || !getBlock(dst.type)) return null;
  const outs = portsOf(src).outputs, ins = portsOf(dst).inputs;
  for (const o of outs) {
    const exact = ins.find(i => i.type === o.type && !wf.edges.some(e => e.to === dstId && e.in === i.id));
    if (exact) return [o.id, exact.id];
    const any = ins.find(i => canConnect(o.type, i.type) && i.type !== 'any' && !wf.edges.some(e => e.to === dstId && e.in === i.id));
    if (any) return [o.id, any.id];
  }
  for (const o of outs) {
    const any = ins.find(i => canConnect(o.type, i.type) && !wf.edges.some(e => e.to === dstId && e.in === i.id));
    if (any) return [o.id, any.id];
  }
  return null;
}

// Move a wire's start to "After all passes" of a loop (Problems fix). When that output already
// leads somewhere, the block goes on the end of that route.
export function moveToDone(wf, edgeId, loopId) {
  const e = wf.edges.find(x => x.id === edgeId);
  const loop = nodeById(wf, loopId);
  if (!e || !loop || !getBlock(loop.type)) return wf;
  const doneOut = portsOf(loop).flowOuts.find(o => o.id === 'done');
  if (!doneOut) return wf;
  let next = removeEdges(wf, [e.id]);
  let cur = loopId, out = 'done';
  for (let guard = 0; guard < 500; guard++) {
    const used = next.edges.find(x => x.from === cur && handleIdOf(next, cur, x.out, 'out') === out && isFlowEdge(next, x));
    if (!used) break;
    if (used.to === e.to) return next;
    cur = used.to;
    const f = freeFlowOut(next, cur);
    if (f) { out = f.id; break; }
    const outs = getBlock(nodeById(next, cur).type) ? portsOf(nodeById(next, cur)).flowOuts : [];
    if (!outs.length) return wf;
    out = outs[0].id;
  }
  return connect(next, { from: cur, out, to: e.to, in: e.in }).wf;
}

export function addStart(wf) {
  if (wf.nodes.some(n => n.type === 'start')) return { wf, node: null };
  const xs = wf.nodes.map(n => n.x), ys = wf.nodes.map(n => n.y);
  const x = xs.length ? Math.min(...xs) - 320 : 80, y = ys.length ? Math.min(...ys) : 120;
  return addNode(wf, 'start', x, y);
}

// ---------------------------------------------------------------------------------------------
// Copy, paste, duplicate (the clipboard holds a small workflow, read back through loadWorkflow)

export function copyFragment(wf, ids) {
  const set = new Set(ids);
  const nodes = wf.nodes.filter(n => set.has(n.id) && n.type !== 'start');
  const keep = new Set(nodes.map(n => n.id));
  const edges = wf.edges.filter(e => keep.has(e.from) && keep.has(e.to));
  const files = {};
  for (const n of nodes) { const f = fileOf(wf, n.id); if (f) files[n.id] = f; }
  const out = serialize({ app: APP_ID, v: FORMAT_VERSION, name: 'Copied blocks', nodes, edges, ...(Object.keys(files).length ? { files } : {}) });
  delete out.view;
  return out;
}

// Paste a fragment (object or JSON text) offset by dx, dy. New ids for every block and wire;
// a Start in the fragment is left out (a workflow has one). Returns { wf, ids, notes, skippedStart }.
export function pasteFragment(wf, frag, dx = 40, dy = 40) {
  const { wf: f, notes } = loadWorkflow(frag);
  if (!f) return { wf, ids: [], notes, skippedStart: false };
  let cur = wf;
  const map = new Map();
  const nodes = [];
  let skippedStart = false;
  for (const n of f.nodes) {
    if (n.type === 'start') { skippedStart = true; continue; }
    const id = newNodeId({ nodes: [...cur.nodes, ...nodes] });
    map.set(n.id, id);
    nodes.push({ ...n, id, x: snap(n.x + dx), y: snap(n.y + dy) });
  }
  cur = { ...cur, nodes: [...cur.nodes, ...nodes] };
  const edges = [];
  for (const e of f.edges) {
    if (!map.has(e.from) || !map.has(e.to)) continue;
    const id = newEdgeId({ edges: [...cur.edges, ...edges] });
    edges.push({ ...e, id, from: map.get(e.from), to: map.get(e.to) });
  }
  cur = { ...cur, edges: [...cur.edges, ...edges] };
  // An attached data file comes along with the block it belongs to.
  for (const [oldId, att] of Object.entries(f.files || {})) {
    const id = map.get(oldId);
    if (id && att && typeof att === 'object' && typeof att.b64 === 'string') cur = setFile(cur, id, att);
  }
  return { wf: cur, ids: nodes.map(n => n.id), notes, skippedStart };
}

export function duplicate(wf, ids, dx = 40, dy = 40) {
  return pasteFragment(wf, copyFragment(wf, ids), dx, dy);
}

// ---------------------------------------------------------------------------------------------
// Where a new block would sit: the loops and searches around it

// Why a block cannot work at a spot whose surrounding loops and searches are `chain` (outermost
// first, [{ kind: 'loop' | 'callback' }]); '' when it can, or when the spot is not known (null).
// Report this try needs a search around it; Skip to next pass and Stop the loop a loop or a
// search (codegen.js: withinOnly, terminalOutside).
export function whyNotHere(def, chain) {
  if (!def || !Array.isArray(chain)) return '';
  if (def.within === 'callback' && !chain.some(c => c.kind === 'callback')) return 'Only inside Optimise or Find limit';
  if (def.within === 'loop' && !chain.some(c => c.kind === 'loop')) return 'Only inside a loop';
  if ((def.ends === 'pass' || def.ends === 'loop') && !chain.length) return 'Only inside a loop or a search';
  return '';
}

// The loops and searches around a block wired after `nodeId`'s flow output `out` (the generator's
// regions; null when they are not known yet). Each pass / Each try of a loop or search is inside
// it, After all passes is not.
export function chainAfterPort(wf, regions, nodeId, out) {
  if (!regions) return null;
  const node = nodeById(wf, nodeId);
  const def = node && getBlock(node.type);
  const base = Array.isArray(regions[nodeId]) ? regions[nodeId] : [];
  if (def && (def.kind === 'loop' || def.kind === 'callback') && out === 'body') return [...base, { id: nodeId, kind: def.kind }];
  return base;
}

// The same for a palette click, which wires the new block after `anchorId` (insertAfter): into
// its first free flow output, else into the wire of its first one.
export function chainAfterStep(wf, regions, anchorId) {
  if (!regions) return null;
  if (!anchorId) return [];
  const anchor = nodeById(wf, anchorId);
  if (!anchor || !getBlock(anchor.type)) return [];
  const free = freeFlowOut(wf, anchorId);
  const outs = portsOf(anchor).flowOuts;
  const out = free ? free.id : (outs[0] ? outs[0].id : null);
  return chainAfterPort(wf, regions, anchorId, out);
}

// ---------------------------------------------------------------------------------------------
// Which blocks fit a dragged wire (quick-add)

function defaultPorts(def) {
  try { return portsOf({ type: def.type, s: {} }); } catch (e) { return { flowIn: hasFlowIn(def), flowOuts: def.flowOuts, inputs: def.inputs, outputs: def.outputs }; }
}

// An input that takes any value but only makes sense with some (`takes` on the port: Activate
// study case takes a study case or its name, not a curve): why it cannot use `type`, or ''.
function takesWhy(port, type) {
  if (!port || port.type !== 'any' || !Array.isArray(port.takes) || port.takes.includes(type)) return '';
  const what = TYPES[type] ? TYPES[type].label.toLowerCase() : 'this';
  return 'Its ' + String(port.label || port.id) + ' input does not take ' + (/^[aeiou]/.test(what) ? 'an ' : 'a ') + what;
}

// from = { side: 'out'|'in', type }: blocks with a port on the other side that takes it, best
// first: a port of exactly that type, then one that takes it, then one that takes any value.
// A block that cannot work there says why in `off` and goes last: an input that takes any value
// but not this one (takesWhy), or a step that needs a loop or a search around it (whyNotHere;
// opts.chain: the loops and searches at that spot, null when not known).
// Returns [{ def, port: {id, ...}, kind: 'flowIn'|'flowOut'|'input'|'output', rank, off }].
export function blocksFor(from, opts = {}) {
  const out = [];
  const rankOf = (have, want) => (have === want ? 0 : want === 'any' || have === 'any' ? 2 : 1);
  for (const def of allBlocks()) {
    if (def.kind === 'start' || def.kind === 'note') continue;
    const p = defaultPorts(def);
    if (from.type === 'flow') {
      if (from.side === 'out' && p.flowIn) out.push({ def, port: { id: 'in' }, kind: 'flowIn', rank: 0, off: whyNotHere(def, opts.chain) });
      if (from.side === 'in' && p.flowOuts.length) out.push({ def, port: p.flowOuts[0], kind: 'flowOut', rank: 0, off: whyNotHere(def, opts.chain) });
      continue;
    }
    if (from.side === 'out') {
      const i = p.inputs.find(x => x.type === from.type) || p.inputs.find(x => x.type !== 'any' && canConnect(from.type, x.type)) || p.inputs.find(x => canConnect(from.type, x.type));
      if (i) out.push({ def, port: i, kind: 'input', rank: rankOf(from.type, i.type), off: takesWhy(i, from.type) });
    } else {
      const o = p.outputs.find(x => x.type === from.type) || p.outputs.find(x => x.type !== 'any' && canConnect(x.type, from.type)) || p.outputs.find(x => canConnect(x.type, from.type));
      if (o) out.push({ def, port: o, kind: 'output', rank: rankOf(o.type, from.type), off: '' });
    }
  }
  const at = new Map(out.map((m, k) => [m, k]));
  return out.sort((a, b) => ((a.off ? 1 : 0) - (b.off ? 1 : 0)) || (a.rank - b.rank) || (at.get(a) - at.get(b)));
}

// Blocks that turn a value of type `ta` into one `tb` takes (a refused wire's converters).
export function convertersFor(ta, tb) {
  const out = [];
  if (ta === 'flow' || tb === 'flow') return out;
  for (const def of allBlocks()) {
    if (def.kind === 'start' || def.kind === 'note') continue;
    const p = defaultPorts(def);
    const i = p.inputs.find(x => x.type === ta) || p.inputs.find(x => canConnect(ta, x.type) && x.type !== 'any');
    if (!i) continue;
    const o = p.outputs.find(x => canConnect(x.type, tb));
    if (!o) continue;
    out.push({ def, input: i, output: o });
  }
  return out;
}

// Add a block of `type` at (x, y) and wire it to the end a wire was dragged from.
// from = { nodeId, handleId, side: 'out'|'in' }.
export function addAndWire(wf, type, x, y, from) {
  const added = addNode(wf, type, x, y);
  let next = added.wf;
  const N = added.node;
  if (from && from.nodeId) {
    const p = portsOf(N);
    const src = portAt(next, from.nodeId, from.handleId, from.side);
    if (src && !src.stray) {
      if (src.type === 'flow') {
        if (from.side === 'out' && p.flowIn) next = connect(next, { from: from.nodeId, out: src.port.id, to: N.id, in: 'in' }).wf;
        if (from.side === 'in' && p.flowOuts.length) next = connect(next, { from: N.id, out: p.flowOuts[0].id, to: from.nodeId, in: src.port.id }).wf;
      } else if (from.side === 'out') {
        const i = p.inputs.find(q => q.type === src.type) || p.inputs.find(q => canConnect(src.type, q.type));
        if (i) next = connect(next, { from: from.nodeId, out: src.port.id, to: N.id, in: i.id }).wf;
      } else {
        const o = p.outputs.find(q => q.type === src.type) || p.outputs.find(q => canConnect(q.type, src.type));
        if (o) next = connect(next, { from: N.id, out: o.id, to: from.nodeId, in: src.port.id }).wf;
      }
    }
  }
  return { wf: next, node: N };
}

// Put a converter between a refused wire's two ends: A.out -> N.input, N.output -> B.in.
export function addConverter(wf, type, x, y, a, b, inputId, outputId) {
  const added = addNode(wf, type, x, y);
  let next = added.wf;
  next = connect(next, { from: a.nodeId, out: a.handleId, to: added.node.id, in: inputId }).wf;
  next = connect(next, { from: added.node.id, out: outputId, to: b.nodeId, in: b.handleId }).wf;
  return { wf: next, node: added.node };
}

// "Continue only if Yes" (U13): an If (is true) checks a Yes / No value, spliced into the flow
// right after the step the value comes from; Yes takes over that step's next wire and No is left
// unwired (it skips to the next pass, or ends the workflow). steps: generate()'s step numbers.
export function continueIfYes(wf, srcNodeId, srcOut, x, y, steps) {
  const ifDef = getBlock('flow.if');
  if (!ifDef) return null;
  const added = addNode(wf, 'flow.if', x, y, { s: { op: 'true' } });
  let next = added.wf;
  const N = added.node;
  next = connect(next, { from: srcNodeId, out: srcOut, to: N.id, in: 'a' }).wf;
  const step = stepBehind(next, srcNodeId, steps || {});
  if (step) {
    const sn = nodeById(next, step);
    const outs = portsOf(sn).flowOuts;
    // The output the route goes on along: the first wired one, else the first.
    const used = outs.find(o => next.edges.some(e => e.from === step && handleIdOf(next, step, e.out, 'out') === o.id)) || outs[0];
    if (used) {
      // Every step it led to (one, or several parallel routes) now follows Yes.
      const es = next.edges.filter(z => z.from === step && handleIdOf(next, step, z.out, 'out') === used.id && isFlowEdge(next, z));
      if (es.length) {
        next = removeEdges(next, es.map(e => e.id));
        next = connect(next, { from: step, out: used.id, to: N.id, in: 'in' }).wf;
        for (const e of es) next = connect(next, { from: N.id, out: 'yes', to: e.to, in: e.in }).wf;
      } else {
        next = connect(next, { from: step, out: used.id, to: N.id, in: 'in' }).wf;
      }
    }
  }
  return { wf: next, node: N };
}

// The step a value comes from: the node itself when it is a step, else the latest step (by step
// number) found upstream through the data wires of a calculator.
function stepBehind(wf, nodeId, steps) {
  const n = nodeById(wf, nodeId);
  if (!n) return null;
  const def = getBlock(n.type);
  if (def && isStatementDef(def) && portsOf(n).flowOuts.length) return nodeId;
  const seen = new Set([nodeId]);
  const queue = [nodeId];
  let best = null, bestStep = -1;
  while (queue.length) {
    const x = queue.shift();
    for (const e of wf.edges) {
      if (e.to !== x || seen.has(e.from) || isFlowEdge(wf, e)) continue;
      seen.add(e.from);
      const m = nodeById(wf, e.from);
      const md = m && getBlock(m.type);
      if (md && isStatementDef(md) && portsOf(m).flowOuts.length) {
        const st = Number(steps[e.from] || 0);
        if (st > bestStep) { best = e.from; bestStep = st; }
      } else queue.push(e.from);
    }
  }
  return best;
}

// A free spot near (x, y) for a block about w x h (no other block's box overlaps it).
export function freeSpot(wf, x, y, sizes, w = 240, h = 110) {
  const box = (n) => {
    const m = sizes && sizes[n.id];
    return { x: n.x, y: n.y, w: (m && m.width) || 240, h: (m && m.height) || 110 };
  };
  const hits = (px, py) => wf.nodes.some(n => {
    const b = box(n);
    return px < b.x + b.w + 20 && px + w + 20 > b.x && py < b.y + b.h + 20 && py + h + 20 > b.y;
  });
  let px = snap(x), py = snap(y);
  for (let i = 0; i < 40 && hits(px, py); i++) py = snap(py + 64);
  return { x: px, y: py };
}

// The blocks to move when block `id` has grown from its box `before` ({ x, y, w, h }) to its
// size in `sizes` ("+N more" opened): each block the new box covers, and the old one did not, is
// pushed down below it (or right of it, when it starts above the grown block's top), and every
// block a pushed block then lands on is pushed down below that one, and so on. Blocks the reader
// had already overlapped with the opened block stay put.
// Returns { [id]: { x, y } } for the blocks that move; empty when none does.
export function pushClear(wf, id, sizes, before, gap = 32) {
  const at = {};
  const box = (n) => {
    const m = sizes && sizes[n.id], p = at[n.id] || n;
    return { x: p.x, y: p.y, w: (m && m.width) || 240, h: (m && m.height) || 110 };
  };
  const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const up = (v) => Math.ceil(v / GRID) * GRID;
  const grown = wf.nodes.find(n => n.id === id);
  if (!grown) return at;
  const queue = [{ n: grown, old: before || box(grown) }];
  for (let guard = 0; queue.length && guard < 2000; guard++) {
    const { n: o, old } = queue.shift();
    const ob = box(o);
    for (const b of wf.nodes) {
      if (b.id === o.id || b.id === id) continue;
      const bb = box(b);
      if (!hit(bb, ob) || (old && hit(bb, old))) continue;
      const p = old === null || bb.y >= ob.y ? { x: bb.x, y: up(ob.y + ob.h + gap) } : { x: up(ob.x + ob.w + gap), y: bb.y };
      at[b.id] = p;
      queue.push({ n: b, old: null });
    }
  }
  return at;
}
