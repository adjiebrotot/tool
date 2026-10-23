// Workflow edits the editor makes: pure functions from a workflow to a new workflow, so the
// store can keep every version for undo and Node can test them. Nothing here touches the DOM.
//
// A workflow is never mutated: an edit returns a new object with new `nodes` / `edges` arrays,
// and the nodes it did not touch keep their identity (the canvas reuses their drawings).
// The saved handles (node and edge ids, port ids, setting keys) follow DESIGN section 3.

import {
  getBlock, portsOf, findPort, canConnect, whyNot, hasFlowIn, settingsOf, allBlocks,
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
  return { wf: { ...wf, nodes, edges: wf.edges.filter(e => !(want.has(e.from) || want.has(e.to))) }, nodes: goneNodes, edges: goneEdges, refused };
}

// Wire c = { from, out, to, in }. A flow output leads to one next step and a data input takes
// one wire, so the wire already there is replaced (returned in `replaced`, for the undo toast).
// A flow input may take many wires (routes joining).
export function connect(wf, c) {
  const a = portAt(wf, c.from, c.out, 'out'), b = portAt(wf, c.to, c.in, 'in');
  if (!a || !b) return { wf, edge: null, replaced: [] };
  const outId = a.port.id, inId = b.port.id;
  const same = wf.edges.find(e => e.from === c.from && e.to === c.to && handleIdOf(wf, e.from, e.out, 'out') === outId && handleIdOf(wf, e.to, e.in, 'in') === inId);
  if (same) return { wf, edge: same, replaced: [] };
  const replaced = [];
  const edges = wf.edges.filter(e => {
    if (a.kind === 'flowOut' && e.from === c.from && handleIdOf(wf, e.from, e.out, 'out') === outId) { replaced.push(e); return false; }
    if (b.kind === 'input' && e.to === c.to && handleIdOf(wf, e.to, e.in, 'in') === inId) { replaced.push(e); return false; }
    return true;
  });
  const edge = { id: newEdgeId(wf), from: c.from, out: outId, to: c.to, in: inId };
  return { wf: { ...wf, edges: [...edges, edge] }, edge, replaced };
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
  const out = serialize({ app: APP_ID, v: FORMAT_VERSION, name: 'Copied blocks', nodes, edges });
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
  return { wf: cur, ids: nodes.map(n => n.id), notes, skippedStart };
}

export function duplicate(wf, ids, dx = 40, dy = 40) {
  return pasteFragment(wf, copyFragment(wf, ids), dx, dy);
}

// ---------------------------------------------------------------------------------------------
// Which blocks fit a dragged wire (quick-add)

function defaultPorts(def) {
  try { return portsOf({ type: def.type, s: {} }); } catch (e) { return { flowIn: hasFlowIn(def), flowOuts: def.flowOuts, inputs: def.inputs, outputs: def.outputs }; }
}

// from = { side: 'out'|'in', type }: blocks with a port on the other side that takes it.
// Returns [{ def, port: {id, ...}, kind: 'flowIn'|'flowOut'|'input'|'output' }].
export function blocksFor(from) {
  const out = [];
  for (const def of allBlocks()) {
    if (def.kind === 'start' || def.kind === 'note') continue;
    const p = defaultPorts(def);
    if (from.type === 'flow') {
      if (from.side === 'out' && p.flowIn) out.push({ def, port: { id: 'in' }, kind: 'flowIn' });
      if (from.side === 'in' && p.flowOuts.length) out.push({ def, port: p.flowOuts[0], kind: 'flowOut' });
      continue;
    }
    if (from.side === 'out') {
      const i = p.inputs.find(x => x.type === from.type) || p.inputs.find(x => canConnect(from.type, x.type));
      if (i) out.push({ def, port: i, kind: 'input' });
    } else {
      const o = p.outputs.find(x => x.type === from.type) || p.outputs.find(x => canConnect(x.type, from.type));
      if (o) out.push({ def, port: o, kind: 'output' });
    }
  }
  return out;
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
      const e = next.edges.find(z => z.from === step && handleIdOf(next, step, z.out, 'out') === used.id && isFlowEdge(next, z));
      if (e) {
        next = removeEdges(next, [e.id]);
        next = connect(next, { from: step, out: used.id, to: N.id, in: 'in' }).wf;
        next = connect(next, { from: N.id, out: 'yes', to: e.to, in: e.in }).wf;
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
