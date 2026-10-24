// The code generator: a workflow in, one ready-to-run Python file out (DESIGN section 6).
//
// generate(workflow, { runtime: { 'base.py': text, ... }, now }) ->
//   { code, problems, helpers, ends, regions, steps, settingsMap, spans }
// Pure (no DOM), deterministic (same input, same code; everything ordered by numeric node id),
// fast, and it never throws: an internal failure becomes a problem and the code still compiles.
//
// How it works, in the order generateInner() runs:
//   1. Read the graph: blocks, their ports and settings; wires checked and classified (flow or
//      data); a wire that no longer fits is reported and left out of the analysis.
//   2. Structure: what Start reaches, circles broken (and reported), a topological order
//      (Kahn, ready set by numeric id; C24a), the Each pass region of every loop and search
//      and the NEAREST structure of every block (C1), which values a step needs.
//   3. Emission: a structured walk from Start. Branches become guard clauses or if/elif/else
//      with a join (6.4, C10, C21); loops become for + try/except/finally with ctx_push,
//      pf_mark/pf_undo and skip tables (6.4, C13, C14); searches become def try_nN(...) with a
//      Trial (C1, C11). Calculator blocks are worked out just before the step that needs them
//      and reused only where Python can see the variable and it cannot have changed (C4).
//      Values are checked for availability on the route, results for validity after model
//      writes (E5), and simulation consumers turned into monitors (6.5).
//   4. Names: every variable is requested as a token while writing; tokens become names at the
//      end, allocated in node order so adding a block never renames another block's variables
//      (C24b). The reserved set covers Python, the runtime's names and the generator's (C5).
//   5. The file layout of 6.6, with the helpers copied from the runtime and the # PFB1 line.
//      A script that draws a graph also gets GRAPH_STYLE in SETTINGS (core/graphstyle.js).
//
// Contract for blocks (what emit returns per kind, the cx object): DESIGN 6.1 / 6.2, with these
// choices where the spec was silent (block authors: read these):
//   - loop: `header` is the whole loop line (for ... in ...:), written by the block, which uses
//     enumerate itself when it gives `iter: { i, n }` (i the pass-number name, n an expression
//     for the number of passes or null). `orelse`: lines for the loop's else (Repeat until).
//     `restore` / `onError` default to the block's settings of the same keys.
//   - callback: `cx.fn` is the name of the generated def (pass it to the search helper in
//     `call`); `labels` (optional) are the Trial's names for `params`; `ctx` (optional)
//     [labelExpr, valueExpr] for ctx_push; `bodyFinally` as for loops.
//   - pure: one expression string (outputs may carry `pick`), or an object { portId: expr }
//     giving each output its own expression.
//   - cx.val(key): the expression for a setting (its SETTINGS constant when pinned, else the
//     literal); cx.element(key[, port]): pf_find(...) for an element setting (also listed for
//     CHECK_ONLY); cx.used(outId): is that output wired; cx.inType(id) / cx.src(id): what is
//     wired into an input; cx.settingLine(NAME, key, words) (Start only); cx.consumers(outId,
//     from): the blocks an output feeds (of block `from` when given); cx.valOf(nodeId, key):
//     another block's setting as cx.val gives it; cx.check(queryExpr, match): an element the
//     block finds by itself, listed for CHECK_ONLY. cx.columns(table, names, { ctx, status,
//     file, read }): the columns this block writes into a results table (the loop values first when
//     ctx, then Status when status); `file: true` when they come from a file the page cannot
//     see. The result's `tables` collects them per table name, for the inspector's suggestions.
//   - A block's `pinLiteral(key, s)` (optional) gives the value written on its SETTINGS line
//     when that setting is pinned (a typed list as a Python list).
//   - A calculator's `varName(s, node)` (optional) gives the name hint for its variable when
//     the reader gave it no label (Recall a value: the remembered name).
//   - Python packages a block needs (matplotlib, pandas, openpyxl, scipy): `packages: [...]` on
//     the definition or cx.package(name) in emit; main() passes them to preflight([...]) so a
//     missing package stops the run before it connects.
//
// Plain ES module, no DOM.

import {
  getBlock, settingsOf, hasFlowIn, canConnect, whyNot, displayName, visibleSettings, effectsOf,
} from './registry.js';
import { pyLit, pyStr, pyNum, pyComment, pyCommentText, isAtom, isNameExpr, paren, parsePyLiteral } from './pylit.js';
import { baseReserved, allocateNames, constantName, snake } from './names.js';
import { parseRuntime, resolveHelpers } from './runtime-loader.js';
import { P, endWords } from './problems.js';
import { compareIds, embedInPython } from './workflow.js';
import { styleOf, pyStyleLines } from './graphstyle.js';

export const MAX_LINES = 20000;
export const MAX_LEVELS = 6;
export const BUILDER_URL = 'https://tool.adjiebrotots.com/powerfactory-scripter/builder/';
const IND = '    ';
const TA = '\ue000', TB = '\ue001';
const TANGLED = { tangled: true };
const STATEMENT_KINDS = ['start', 'action', 'branch', 'loop', 'callback', 'terminal', 'missing'];
const STRUCT_KINDS = ['loop', 'callback'];
// Helpers main() itself calls.
const MAIN_HELPERS = ['log', 'StopWorkflow', 'pf_connect', 'finish', 'preflight', 'check_elements'];

function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function errText(e) { return String((e && e.message) || e).slice(0, 160); }

// The file name the docstring suggests (and the UI may use for the download).
export function fileNameFor(wf) {
  return (snake(wf && wf.name, 50) || 'workflow') + '.py';
}

// Wrap words into comment lines of at most `width` characters.
function commentLines(text, width = 96) {
  const words = pyCommentText(text, 2000).split(' ').filter(Boolean);
  const out = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur.length + 1 + w.length) > width - 2) { out.push('# ' + cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) out.push('# ' + cur);
  return out.length ? out : ['#'];
}

function flatLines(x) {
  if (x === undefined || x === null || x === false) return [];
  if (typeof x === 'string') return x.split('\n');
  if (Array.isArray(x)) return x.flatMap(flatLines);
  return [String(x)];
}

// ---------------------------------------------------------------------------------------------
// Runtime parsing is cached: the UI passes the same texts on every keystroke.

let lastRuntime = null;
let lastLib = null;
function getLib(runtime) {
  const rt = isObj(runtime) ? runtime : {};
  if (lastRuntime && lastLib) {
    const a = Object.keys(lastRuntime), b = Object.keys(rt);
    if (a.length === b.length && b.every(k => lastRuntime[k] === rt[k])) return lastLib;
  }
  lastLib = parseRuntime(rt);
  lastRuntime = { ...rt };
  return lastLib;
}

// ---------------------------------------------------------------------------------------------

export function generate(workflow, opts) {
  try {
    return generateInner(workflow, isObj(opts) ? opts : {});
  } catch (e) {
    return crashResult(workflow, e);
  }
}

// The smallest file that still compiles and says what went wrong.
function crashResult(workflow, e) {
  const msg = 'The Builder could not write this workflow (' + errText(e) + '). Please report it.';
  const lines = [
    '#!/usr/bin/env python3',
    '"""Made with the PowerFactory Workflow Builder, ' + BUILDER_URL,
    'The Builder could not write this workflow. Nothing in this file talks to PowerFactory.',
    '"""',
    'PROBLEMS = [' + pyStr(msg) + ']',
    '',
    '',
    'def main():',
    '    raise SystemExit(PROBLEMS[0])',
    '',
    '',
    'if __name__ == "__main__":',
    '    main()',
  ];
  let code = lines.join('\n') + '\n';
  try { code = embedInPython(code, workflow, {}); } catch (err) { /* keep it without the PFB1 line */ }
  return { code, problems: [{ level: 'error', msg }], helpers: [], ends: {}, regions: {}, steps: {}, settingsMap: {}, spans: {} };
}

function generateInner(workflow, opts) {
  const wf = isObj(workflow) ? workflow : {};
  const wfName = typeof wf.name === 'string' ? wf.name : '';
  const lib = getLib(opts.runtime);
  const problems = [];
  const addProblem = (p) => { if (p && p.msg) problems.push(p); };
  for (const rp of lib.problems) addProblem(P.runtimeProblem(rp.msg));

  // ===========================================================================================
  // 1. The graph

  const nodes = new Map();
  for (const n of Array.isArray(wf.nodes) ? wf.nodes : []) {
    if (isObj(n) && typeof n.id === 'string' && n.id && !nodes.has(n.id)) nodes.set(n.id, n);
  }
  const order = [...nodes.keys()].sort(compareIds);
  const info = new Map();
  for (const id of order) {
    const node = nodes.get(id);
    const def = getBlock(node.type);
    if (!def) {
      info.set(id, { id, node, def: null, kind: 'missing', s: {}, label: displayName(node),
        ports: { flowIn: true, flowOuts: [], inputs: [], outputs: [] } });
      continue;
    }
    let s;
    try { s = settingsOf(node); } catch (e) { s = {}; }
    let dyn = {};
    if (typeof def.ports === 'function') {
      try { dyn = def.ports(s, node) || {}; } catch (e) { dyn = { error: errText(e) }; }
    }
    const ports = {
      flowIn: hasFlowIn(def),
      flowOuts: Array.isArray(dyn.flowOuts) ? dyn.flowOuts : def.flowOuts,
      inputs: Array.isArray(dyn.inputs) ? dyn.inputs : def.inputs,
      outputs: Array.isArray(dyn.outputs) ? dyn.outputs : def.outputs,
    };
    const I = { id, node, def, kind: def.kind, s, ports, label: displayName(node) };
    info.set(id, I);
    if (dyn.error) addProblem(P.internal(I.label, 'its ports could not be worked out: ' + dyn.error, id));
  }

  function findP(I, portId, side) {
    if (!I.def) return null;
    const id = (I.def.portAlias && I.def.portAlias[portId]) || portId;
    if (side === 'in') {
      if (id === 'in' && I.ports.flowIn) return { port: { id: 'in', label: '' }, kind: 'flowIn', type: 'flow' };
      const d = I.ports.inputs.find(x => x.id === id);
      return d ? { port: d, kind: 'input', type: d.type } : null;
    }
    const f = I.ports.flowOuts.find(x => x.id === id);
    if (f) return { port: f, kind: 'flowOut', type: 'flow' };
    const d = I.ports.outputs.find(x => x.id === id);
    return d ? { port: d, kind: 'output', type: d.type } : null;
  }

  const flowOut = new Map();      // 'id:out' -> { to, edge }
  const flowIn = new Map();       // to id -> [{ from, out, edge }]
  const dataIn = new Map();       // 'id:input' -> { from, port, type, edge, to, input }
  const dataOut = new Map();      // from id -> [same objects]
  const missOuts = new Map();     // missing node id -> number of flow-like wires out of it
  const addFlow = (from, out, to, edge) => {
    flowOut.set(from + ':' + out, { to, edge });
    if (!flowIn.has(to)) flowIn.set(to, []);
    flowIn.get(to).push({ from, out, edge });
  };
  for (const e of Array.isArray(wf.edges) ? wf.edges : []) {
    if (!isObj(e)) continue;
    const A = info.get(e.from), B = info.get(e.to);
    if (!A || !B) continue;
    const eid = typeof e.id === 'string' ? e.id : undefined;
    if (A.kind === 'missing' || B.kind === 'missing') {
      // Wires on a Missing block carry nothing, but flow wires keep the steps after it reached.
      if (e.in === 'in' && (B.kind === 'missing' || B.ports.flowIn)) {
        if (A.kind === 'missing') {
          const k = missOuts.get(A.id) || 0;
          missOuts.set(A.id, k + 1);
          addFlow(A.id, '#' + k, B.id, e);
        } else {
          const pa = findP(A, e.out, 'out');
          if (pa && pa.kind === 'flowOut' && !flowOut.has(A.id + ':' + pa.port.id)) addFlow(A.id, pa.port.id, B.id, e);
        }
      }
      continue;
    }
    const pa = findP(A, e.out, 'out');
    if (!pa) { addProblem(P.portGone(A.label, e.out, A.id, eid)); continue; }
    const pb = findP(B, e.in, 'in');
    if (!pb) { addProblem(P.portGone(B.label, e.in, B.id, eid)); continue; }
    if (pa.type === 'flow' || pb.type === 'flow') {
      if (pa.kind !== 'flowOut' || pb.kind !== 'flowIn') {
        addProblem(P.wrongWire(A.label, pa.port, B.label, pb.port, whyNot(pa.type, pb.type) || 'a flow wire only joins flow ports.', B.id, eid));
        continue;
      }
      if (flowOut.has(A.id + ':' + pa.port.id)) { addProblem(P.twoFromFlowOut(A.label, pa.port, A.id, eid)); continue; }
      addFlow(A.id, pa.port.id, B.id, e);
    } else {
      if (!canConnect(pa.type, pb.type)) {
        addProblem(P.wrongWire(A.label, pa.port, B.label, pb.port, whyNot(pa.type, pb.type), B.id, eid));
        continue;
      }
      const k = B.id + ':' + pb.port.id;
      if (dataIn.has(k)) { addProblem(P.twoIntoInput(B.label, pb.port, B.id, eid)); continue; }
      const d = { from: A.id, port: pa.port, type: pa.type, edge: e, to: B.id, input: pb.port };
      dataIn.set(k, d);
      if (!dataOut.has(A.id)) dataOut.set(A.id, []);
      dataOut.get(A.id).push(d);
    }
  }

  const back = new Set();         // 'id:out' of wires left out to break a circle
  const outsOf = (id) => {
    const I = info.get(id);
    if (I.kind === 'missing') return Array.from({ length: missOuts.get(id) || 0 }, (_, k) => '#' + k);
    return I.ports.flowOuts.map(p => p.id);
  };
  const rawSucc = (id, out) => { const f = flowOut.get(id + ':' + out); return f ? f.to : null; };
  const succ = (id, out) => (back.has(id + ':' + out) ? null : rawSucc(id, out));
  const isStmt = (id) => STATEMENT_KINDS.includes(info.get(id).kind);
  const isStruct = (id) => STRUCT_KINDS.includes(info.get(id).kind);
  const allSuccs = (id) => outsOf(id).map(o => succ(id, o)).filter(v => v !== null);
  const firstOut = (id) => { const o = outsOf(id); return o.length ? o[0] : null; };

  // ===========================================================================================
  // 2. Structure

  const starts = order.filter(id => info.get(id).kind === 'start');
  if (!starts.length) addProblem(P.noStart());
  else if (starts.length > 1) addProblem(P.twoStarts(starts.length, starts[0]));
  const startId = starts[0] || null;

  // What Start reaches.
  const reached = new Set();
  if (startId) {
    const st = [startId];
    while (st.length) {
      const u = st.pop();
      if (reached.has(u)) continue;
      reached.add(u);
      for (const o of outsOf(u)) { const v = rawSucc(u, o); if (v !== null && !reached.has(v)) st.push(v); }
    }
  }

  // Circles: a depth-first walk in declared port order; each wire that closes a circle is
  // reported and left out, so the rest still generates.
  if (startId) {
    const color = new Map();
    const path = [];
    const dfs = (u) => {
      color.set(u, 1);
      path.push(u);
      for (const o of outsOf(u)) {
        const v = rawSucc(u, o);
        if (v === null) continue;
        const c = color.get(v) || 0;
        if (c === 1) {
          back.add(u + ':' + o);
          const at = path.indexOf(v);
          const loopBack = isStruct(v) && path[at + 1] !== undefined && rawSucc(v, 'body') === path[at + 1];
          const edge = flowOut.get(u + ':' + o).edge;
          if (loopBack) addProblem(P.wireBack(info.get(v).label, u, edge && edge.id));
          else addProblem(P.cycle([...path.slice(at), v].map(x => info.get(x).label), v));
        } else if (c === 0) {
          dfs(v);
        }
      }
      path.pop();
      color.set(u, 2);
    };
    dfs(startId);
  }

  // Topological order of the reached steps (Kahn; ready set in numeric id order).
  const topo = new Map();
  {
    const indeg = new Map([...reached].map(id => [id, 0]));
    for (const u of reached) for (const v of allSuccs(u)) if (indeg.has(v)) indeg.set(v, indeg.get(v) + 1);
    let ready = [...reached].filter(id => indeg.get(id) === 0).sort(compareIds);
    let k = 0;
    while (ready.length) {
      const u = ready.shift();
      topo.set(u, k++);
      for (const v of allSuccs(u)) {
        if (!indeg.has(v)) continue;
        indeg.set(v, indeg.get(v) - 1);
        if (indeg.get(v) === 0) { ready.push(v); ready.sort(compareIds); }
      }
    }
    for (const id of [...reached].sort(compareIds)) if (!topo.has(id)) topo.set(id, k++);
  }

  // The Each pass / Each try region of every reached loop and search.
  const structs = [...reached].filter(isStruct).sort(compareIds);
  const region = new Map();
  for (const L of structs) {
    const set = new Set();
    const b = succ(L, 'body');
    const st = b !== null ? [b] : [];
    while (st.length) {
      const u = st.pop();
      if (u === L || set.has(u)) continue;
      set.add(u);
      for (const v of allSuccs(u)) if (!set.has(v)) st.push(v);
    }
    region.set(L, set);
  }
  const inRegion = (x, L) => { const r = region.get(L); return !!r && r.has(x); };
  const nearest = new Map();
  for (const X of reached) {
    let best = null;
    for (const L of structs) {
      if (!inRegion(X, L)) continue;
      if (best === null || region.get(L).size < region.get(best).size ||
          (region.get(L).size === region.get(best).size && topo.get(L) > topo.get(best))) best = L;
    }
    nearest.set(X, best);
  }
  const chainOf = (X) => {
    const out = [];
    const seen = new Set();
    let L = nearest.get(X) || null;
    while (L && !seen.has(L)) { seen.add(L); out.unshift(L); L = nearest.get(L) || null; }
    return out;
  };

  // Every step inside a region must be entered from the region (or the structure's Each port).
  for (const L of structs) {
    let doneReach = null;
    for (const X of [...region.get(L)].sort(compareIds)) {
      for (const inc of flowIn.get(X) || []) {
        if (back.has(inc.from + ':' + inc.out) || !reached.has(inc.from)) continue;
        if (inc.from === L && inc.out === 'body') continue;
        if (inRegion(inc.from, L)) continue;
        if (doneReach === null) {
          doneReach = new Set();
          const st = succ(L, 'done') !== null ? [succ(L, 'done')] : [];
          while (st.length) { const u = st.pop(); if (doneReach.has(u)) continue; doneReach.add(u); for (const v of allSuccs(u)) st.push(v); }
        }
        const eid = inc.edge && inc.edge.id;
        if (inc.from === L || doneReach.has(inc.from)) addProblem(P.insideAndAfter(info.get(X).label, info.get(L).label, X, eid, L));
        else addProblem(P.insideAndOutside(info.get(X).label, info.get(L).label, X, eid));
      }
    }
  }

  // Calculators a reached step needs (directly or through other calculators).
  const needed = new Set();
  {
    const st = [...reached];
    while (st.length) {
      const u = st.pop();
      for (const p of info.get(u).ports.inputs) {
        const d = dataIn.get(u + ':' + p.id);
        if (d && info.get(d.from).kind === 'pure' && !needed.has(d.from)) { needed.add(d.from); st.push(d.from); }
      }
    }
  }
  // Circles among calculators.
  {
    const color = new Map();
    const path = [];
    const dfs = (u) => {
      color.set(u, 1); path.push(u);
      for (const p of info.get(u).ports.inputs) {
        const d = dataIn.get(u + ':' + p.id);
        if (!d || info.get(d.from).kind !== 'pure') continue;
        const c = color.get(d.from) || 0;
        if (c === 1) { const at = path.indexOf(d.from); addProblem(P.pureCycle([...path.slice(at), d.from].map(x => info.get(x).label), d.from)); }
        else if (c === 0) dfs(d.from);
      }
      path.pop(); color.set(u, 2);
    };
    for (const id of [...needed].sort(compareIds)) if (!color.get(id)) dfs(id);
  }

  // Volatility (transitive, C4): true = worked out again before every use; 'case' = again
  // after a block that switches study case, scenario or variation.
  const volMemo = new Map(), caseMemo = new Map();
  const effVol = (id, seen = new Set()) => {
    if (volMemo.has(id)) return volMemo.get(id);
    if (seen.has(id)) return false;
    seen.add(id);
    const I = info.get(id);
    let v = !!I.def && I.def.volatile === true;
    if (!v) for (const p of I.ports.inputs) {
      const d = dataIn.get(id + ':' + p.id);
      if (d && info.get(d.from).kind === 'pure' && effVol(d.from, seen)) { v = true; break; }
    }
    volMemo.set(id, v);
    return v;
  };
  const effCase = (id, seen = new Set()) => {
    if (caseMemo.has(id)) return caseMemo.get(id);
    if (seen.has(id)) return false;
    seen.add(id);
    const I = info.get(id);
    let v = !!I.def && I.def.volatile === 'case';
    if (!v) for (const p of I.ports.inputs) {
      const d = dataIn.get(id + ':' + p.id);
      if (d && info.get(d.from).kind === 'pure' && effCase(d.from, seen)) { v = true; break; }
    }
    caseMemo.set(id, v);
    return v;
  };

  // What the steps inside a region do to the model.
  const regionFx = new Map();
  const fxOf = (L) => {
    if (regionFx.has(L)) return regionFx.get(L);
    const r = { model: false, case: false, calc: false, writer: null };
    for (const X of [...region.get(L)].sort((a, b) => topo.get(a) - topo.get(b))) {
      const fx = effectsOf(info.get(X).node);
      if (fx.writes.includes('results')) r.calc = true;
      if (fx.writes.includes('model') || fx.writes.includes('case')) {
        if (fx.writes.includes('model')) r.model = true;
        if (fx.writes.includes('case')) r.case = true;
        if (!r.writer) r.writer = X;
      }
    }
    regionFx.set(L, r);
    return r;
  };

  // ---- Static checks that do not need the walk.
  for (const id of order) {
    const I = info.get(id);
    if (I.kind === 'missing') addProblem(P.missingBlock(I.node.type, id));
    if (isStmt(id) && !reached.has(id) && !(I.kind === 'start' && startId)) addProblem(P.notReached(I.label, id));
    if (I.kind === 'pure' && !needed.has(id) && !(dataOut.get(id) || []).length) addProblem(P.pureUnused(I.label, id));
  }
  for (const id of order) {
    if (!reached.has(id) && !needed.has(id)) continue;
    const I = info.get(id);
    if (!I.def) continue;
    if (I.kind === 'branch') {
      const fo = I.ports.flowOuts;
      if (fo.length > 1 && succ(id, fo[0].id) === null) {
        const wiredFail = fo.slice(1).find(p => p.stopMsg && succ(id, p.id) !== null);
        if (wiredFail) addProblem(P.happyUnwired(I.label, fo[0].label || fo[0].id, wiredFail.label || wiredFail.id, id));
      }
    }
    if (I.def.within) {
      const ch = chainOf(id).map(L => info.get(L).kind);
      if (!ch.includes(I.def.within)) addProblem(P.withinOnly(I.label, I.def.within, id));
    }
    if (I.def.oncePerRun && nearest.get(id) && info.get(nearest.get(id)).kind === 'loop') {
      const inc = (flowIn.get(id) || [])[0];
      addProblem(P.inLoopWritesFiles(I.label, info.get(nearest.get(id)).label, id, inc && inc.edge && inc.edge.id, nearest.get(id)));
    }
    const wired = new Set(I.ports.inputs.filter(p => dataIn.has(id + ':' + p.id)).map(p => p.id));
    let vis = [];
    try { vis = visibleSettings(I.node, wired); } catch (e) { vis = []; }
    for (const st of vis) {
      if (!st.required) continue;
      const v = I.s[st.key];
      const empty = v === undefined || v === null || (typeof v === 'string' && !v.trim()) ||
        (Array.isArray(v) && !v.length) || (isObj(v) && st.kind === 'element' && !String(v.name || '').trim());
      if (empty) addProblem(P.fillIn(I.label, st.label || st.key, id));
    }
  }

  // ---- SETTINGS constants for pinned settings (allocated for every block, in node order, so
  // they do not change when a block becomes reachable).
  const reservedConst = new Set([...baseReserved(), ...lib.names]);
  const constTaken = new Set();
  const pinName = new Map();
  for (const id of order) {
    const I = info.get(id);
    if (!I.def || I.kind === 'start' || !Array.isArray(I.node.pin)) continue;
    const keys = (I.def.settings || []).filter(st => I.node.pin.includes(st.key) && st.kind !== 'list' && !st.noPin).map(st => st.key);
    for (const key of keys) pinName.set(id + ':' + key, constantName(I.label, key, id, constTaken, reservedConst));
  }

  // ===========================================================================================
  // 3. Emission

  const reqs = [];
  const reqIdx = new Map();
  const seqOf = new Map();
  // own: a name the generator itself uses (mark, trial, err, fin), which a block label may
  // never take but the generator may, for the first structure that asks.
  const tok = (nodeId, key, hint, own = false) => {
    const k = nodeId + '\u0000' + key;
    let i = reqIdx.get(k);
    if (i === undefined) {
      const seq = seqOf.get(nodeId) || 0;
      seqOf.set(nodeId, seq + 1);
      i = reqs.length;
      reqs.push({ nodeId, hint: String(hint || 'value'), seq, own });
      reqIdx.set(k, i);
    }
    return TA + i + TB;
  };

  let lineCount = 0;
  const helpers = new Set(MAIN_HELPERS);
  const extraImports = new Set();
  const checkQueries = [];
  const checkSeen = new Set();
  const elementsUsed = new Set(); // "nodeId:key" of element settings the code looks up (REQUIRED when pinned)
  const packages = new Set();     // Python packages preflight() checks before connecting
  const steps = new Map();
  let stepN = 0;
  const settingsMap = { WORKFLOW_NAME: ['*', 'name'] };
  let startSettingLines = [];
  const materialising = new Set();
  const pureForm = new Map();
  let epochN = 0;
  const newEpoch = () => ++epochN;
  const once = new Set();
  const onceProblem = (key, p) => { if (!once.has(key)) { once.add(key); addProblem(p); } };

  class Buf {
    constructor(ind, owner) { this.ind = ind; this.lines = []; this.count = 0; this.owner = owner === undefined ? null : owner; }
    add(text, rel = 0, owner) {
      if (this.ind + rel > 90) throw TANGLED;
      for (const t of String(text).split('\n')) {
        const s = t.replace(/\s+$/, '');
        this.lines.push({ t: s ? IND.repeat(this.ind + rel) + s : '', o: owner === undefined ? this.owner : owner });
        if (s && !s.trimStart().startsWith('#')) this.count++;
        if (++lineCount > MAX_LINES) throw TANGLED;
      }
    }
    addLines(arr, rel = 0) { for (const l of flatLines(arr)) this.add(l, rel); }
    append(child) { for (const l of child.lines) this.lines.push(l); this.count += child.count; }
    sub(owner) { return new Buf(this.ind + 1, owner === undefined ? this.owner : owner); }
  }
  // A suite: header line, then the child's lines (or `pass` when it has no statement; C13).
  const writeSuite = (buf, header, child) => {
    buf.add(header);
    if (child.count === 0) child.add('pass');
    for (const l of child.lines) buf.lines.push(l);
  };

  const newFrame = (parent) => ({ parent, outs: new Map(), pures: new Map() });
  const lookupOut = (frame, key) => {
    for (let f = frame; f; f = f.parent) if (f.outs.has(key)) return f.outs.get(key);
    return undefined;
  };
  const lookupPure = (frame, key, epoch) => {
    for (let f = frame; f; f = f.parent) {
      const b = f.pures.get(key);
      if (b) return epoch === null || b.epoch === epoch ? b : null;
    }
    return null;
  };
  const copyRs = (rs) => ({ ...rs });

  const stepOf = (X) => { if (!steps.has(X)) steps.set(X, ++stepN); return steps.get(X); };
  const summaryText = (I) => {
    if (!I.def || typeof I.def.summary !== 'function') return '';
    try { return String(I.def.summary(I.s, I.node) || ''); } catch (e) { return ''; }
  };
  const stepComment = (X) => {
    const I = info.get(X);
    const sm = summaryText(I);
    return pyComment('-- Step ' + stepOf(X) + ': ' + I.label + (sm ? ' (' + sm + ')' : '') + ' --', 200);
  };

  const outHint = (I, portId) => {
    const outs = I.ports.outputs;
    const p = outs.find(x => x.id === portId) || { id: portId };
    const lab = typeof I.node.label === 'string' ? I.node.label.trim() : '';
    if (lab) {
      // The label names the value itself for a calculator, a loop's own value and a step with
      // one output ("Dispatch (MW)" -> dispatch_mw); a branch's outputs are about the step, so
      // they get the port's name too ("Run load flow" -> run_load_flow_converged).
      const first = outs.length && outs[0].id === portId;
      const bare = first && (I.kind === 'pure' || STRUCT_KINDS.includes(I.kind) || (I.kind === 'action' && outs.length === 1));
      return bare ? lab : lab + ' ' + (p.var || p.label || p.id);
    }
    return (p.var || p.label || p.id) + (p.unit ? ' ' + p.unit : '');
  };
  const pureHint = (I) => {
    const lab = typeof I.node.label === 'string' ? I.node.label.trim() : '';
    if (lab) return lab;
    if (I.def && typeof I.def.varName === 'function') {
      try { const h = I.def.varName(I.s, I.node); if (h && snake(h)) return String(h); } catch (e) { /* use the port name */ }
    }
    const p = I.ports.outputs[0];
    return p ? (p.var || p.label || p.id) + (p.unit ? ' ' + p.unit : '') : (I.def ? I.def.title : 'value');
  };
  const cleanExpr = (r) => {
    if (typeof r !== 'string' && typeof r !== 'number') return 'None';
    const e = String(r).replace(/\s*\n\s*/g, ' ').trim();
    return e || 'None';
  };

  // ---- Expressions for settings and elements
  const settingExpr = (X, key) => {
    const I = info.get(X);
    const pin = pinName.get(X + ':' + key);
    if (pin) return pin;
    const st = I.def && (I.def.settings || []).find(x => x.key === key);
    const v = I.s[key];
    if (!st) return pyLit(v);
    if (st.kind === 'number') return v === null || v === undefined ? 'None' : pyNum(v);
    if (st.kind === 'bool') return v ? 'True' : 'False';
    if (st.kind === 'list' || st.kind === 'element') return pyLit(v);
    return pyStr(v);
  };
  const elementExpr = (X, key, port, o) => {
    const I = info.get(X);
    const st = I.def && (I.def.settings || []).find(x => x.key === key);
    const v = isObj(I.s[key]) ? I.s[key] : {};
    const name = String(v.name || '').trim();
    const cls = String(v.cls || '').trim();
    const match = ['one', 'first', 'all'].includes(v.match) ? v.match : 'one';
    if (!(o && o.probe)) elementsUsed.add(X + ':' + key);
    if (!name) {
      if (!(o && o.probe)) addProblem(P.chooseElement(I.label, port || { label: st ? st.label : key }, X));
      return 'None';
    }
    helpers.add('pf_find');
    const suffix = cls && !name.toLowerCase().endsWith('.' + cls.toLowerCase()) ? '.' + cls : '';
    const pin = pinName.get(X + ':' + key);
    const q = pin ? (suffix ? pin + ' + ' + pyStr(suffix) : pin) : pyStr(name + suffix);
    checkFind(q, match);
    return 'pf_find(app, ' + q + ', ' + pyStr(match) + ')';
  };
  // CHECK_ONLY: a plain "Name.Class" expects one element; other matches go as (query, match).
  // q is the query as Python.
  function checkFind(q, match) {
    const entry = match === 'one' ? q : '(' + q + ', ' + pyStr(match) + ')';
    if (!checkSeen.has(entry)) { checkSeen.add(entry); checkQueries.push(entry); }
  }
  const settingLine = (X, NAME, key, words, so = {}) => {
    const I = info.get(X);
    const st = I.def && (I.def.settings || []).find(x => x.key === key);
    const v = so.value !== undefined ? so.value : I.s[key];
    const req = so.required !== undefined ? so.required : !!(st && st.required);
    settingsMap[NAME] = [X, key];
    return [...commentLines((req ? 'REQUIRED. ' : 'OPTIONAL. ') + words), NAME + ' = ' + pyLit(v)];
  };

  // ---- Route state: are results valid here (E5), and which study-case "epoch" are we in.
  const checkReads = (X, env) => {
    const fx = effectsOf(info.get(X).node);
    if (!fx.reads.includes('results') || env.rs.results !== 'invalid' || !env.rs.writer) return;
    const I = info.get(X);
    const W = info.get(env.rs.writer);
    if (env.rs.loopStart) addProblem(P.resultsAfterWriteInLoop(I.label, W.label, env.rs.loopStart, X));
    else addProblem(P.resultsAfterWrite(I.label, W.label, X));
  };
  const applyWrites = (X, env) => {
    const fx = effectsOf(info.get(X).node);
    if (fx.writes.includes('results')) { env.rs.results = 'valid'; env.rs.writer = null; env.rs.loopStart = null; }
    if (fx.writes.includes('model')) { env.rs.results = 'invalid'; env.rs.writer = X; env.rs.loopStart = null; }
    if (fx.writes.includes('case')) { env.rs.results = 'invalid'; env.rs.writer = X; env.rs.loopStart = null; env.rs.epoch = newEpoch(); }
  };

  // ---- The cx object a block's emit() receives (6.1)
  const makeCx = (X, env, o) => {
    const I = info.get(X);
    const outs = new Map();
    const occ = new Map();
    const opt = o || {};
    const cx = {
      node: I.node, def: I.def, s: I.s, id: X, label: I.label, title: I.def ? I.def.title : '',
      step: steps.get(X) || 0, app: 'app', ports: I.ports, workflowName: wfName,
      structure: env && env.struct ? env.struct.kind : null,
      loopLabel: env && env.struct ? env.struct.label : '',
      loopId: env && env.struct ? env.struct.id : null,
      trial: (env && env.trial) || null,
      fn: null,
      lit: pyLit, str: pyStr, num: pyNum,
      comment: (t) => pyComment(t),
      in: (id) => (env ? resolveInput(X, id, env, opt) : 'None'),
      has: (id) => dataIn.has(X + ':' + id),
      used: (id) => (dataOut.get(X) || []).some(d => d.port.id === id),
      // The blocks fed by a data output of this block (or of block `from`): [{ id, type, input }],
      // every output when id is empty; and a setting of another block as Python (its SETTINGS
      // name when pinned).
      consumers: (id, from) => (dataOut.get(from || X) || []).filter(d => !id || d.port.id === id)
        .map(d => ({ id: d.to, type: info.get(d.to).node.type, input: d.input.id })),
      // An element the block looks up by itself (not through cx.element), for CHECK_ONLY.
      check: (q, match) => checkFind(q, ['one', 'first', 'all'].includes(match) ? match : 'one'),
      valOf: (nodeId, key) => (info.has(nodeId) && info.get(nodeId).def ? settingExpr(nodeId, key) : 'None'),
      src: (id) => { const d = dataIn.get(X + ':' + id); return d ? { id: d.from, label: info.get(d.from).label, port: d.port, type: d.type } : null; },
      inType: (id) => { const d = dataIn.get(X + ':' + id); return d ? d.type : null; },
      name: (hint) => { const h = String(hint === undefined || hint === null ? 'value' : hint); const k = occ.get(h) || 0; occ.set(h, k + 1); return tok(X, 'name:' + h + '#' + k, h); },
      out: (id, expr) => {
        if (expr !== undefined && expr !== null) { outs.set(id, String(expr)); return String(expr); }
        const t = tok(X, 'out:' + id, outHint(I, id));
        outs.set(id, t);
        return t;
      },
      helper: (...ns) => { for (const n of ns.flat()) if (n) helpers.add(String(n)); },
      package: (...ns) => { for (const n of ns.flat()) if (n && /^[A-Za-z_][\w.]*$/.test(String(n))) packages.add(String(n)); },
      imp: (line) => { if (line && String(line).trim()) extraImports.add(String(line).trim()); },
      error: (m, extra) => { if (!opt.probe) addProblem({ level: 'error', msg: String(m), nodeId: X, ...(extra || {}) }); },
      warn: (m, extra) => { if (!opt.probe) addProblem({ level: 'warning', msg: String(m), nodeId: X, ...(extra || {}) }); },
      todo: (m, extra) => { if (!opt.probe) addProblem({ level: 'todo', msg: String(m), nodeId: X, ...(extra || {}) }); },
      val: (key) => settingExpr(X, key),
      element: (key, port) => elementExpr(X, key, port, opt),
      monitors: () => (env ? collectMonitors(X, env, opt.pre || []) : []),
      skipTables: () => (env && env.struct ? skipTablesFor(env.struct.id) : []),
      columns: (table, names, o) => {
        if (opt.probe) return;
        tableRecs.set(X, { table: String(table), names: (names || []).map(String).filter(Boolean), ctx: !!(o && o.ctx), status: !!(o && o.status), file: !!(o && o.file), read: !!(o && o.read) });
      },
      // Lines to write once the nearest loop or search has ended (for example "every pass on
      // one graph"): queued per block, written after the structure's own after-lines.
      afterStruct: (lines) => {
        if (!env || !env.struct || opt.probe) return false;
        const q = env.struct.after || (env.struct.after = new Map());
        if (!q.has(X)) q.set(X, flatLines(lines));
        return true;
      },
      settingLine: (NAME, key, words, so) => settingLine(X, NAME, key, words, so),
    };
    cx._outs = outs;
    return cx;
  };

  const resolveInput = (X, id, env, o) => {
    const I = info.get(X);
    const port = I.ports.inputs.find(p => p.id === id);
    if (!port) return 'None';
    if (port.at === 'bodyEnd' && !o.bodyEnd) return 'None';
    const d = dataIn.get(X + ':' + id);
    if (d) {
      const S = info.get(d.from);
      if (S.kind === 'pure') return materialise(d.from, d.port, env, o);
      const b = lookupOut(env.frame, d.from + ':' + d.port.id);
      if (b !== undefined) return b;
      if (o.probe) { if (o.fail) o.fail.failed = true; } else availabilityError(X, port, d, o.stmt || X, o.bodyEnd);
      return 'None';
    }
    if (port.fallback && I.def) {
      const st = (I.def.settings || []).find(x => x.key === port.fallback);
      if (st) return st.kind === 'element' || port.type === 'obj' ? elementExpr(X, port.fallback, port, o) : settingExpr(X, port.fallback);
    }
    if (port.required && !o.probe) addProblem(P.connectInput(I.label, port, X));
    return 'None';
  };

  const availabilityError = (X, port, d, stmt, bodyEnd) => {
    const I = info.get(X), S = info.get(d.from);
    const eid = d.edge && d.edge.id;
    if (bodyEnd) {
      // Name the loop and its end-of-pass input, also when the value comes through calculators.
      const LI = info.get(stmt) || I;
      const lp = LI.ports.inputs.find(p => p.at === 'bodyEnd') || port;
      addProblem(P.bodyEndOutside(LI.label, lp, LI.id));
      return;
    }
    const scope = d.port.scope || 'after';
    if (isStruct(d.from) && scope === 'body' && !inRegion(stmt, d.from)) {
      addProblem(S.kind === 'loop' ? P.onlyInLoop(I.label, port, S.label, S.label, X, eid) : P.insideSearch(I.label, port, S.label, S.label, X, eid));
      return;
    }
    for (const L of [...chainOf(d.from)].reverse()) {
      if (!inRegion(stmt, L)) {
        const LI = info.get(L);
        addProblem(LI.kind === 'loop' ? P.onlyInLoop(I.label, port, S.label, LI.label, X, eid) : P.insideSearch(I.label, port, S.label, LI.label, X, eid));
        return;
      }
    }
    addProblem(P.notYet(I.label, port, S.label, info.get(stmt) ? info.get(stmt).label : I.label, X, eid));
  };

  // Work out a calculator where it is needed, or reuse it (C4, 6.4 "Materialising").
  const materialise = (Pid, port, env, o) => {
    const I = info.get(Pid);
    const cache = o.stmtCache;
    const keyFor = (form) => (form === 'obj' ? Pid + '#' + port.id : Pid);
    let key = keyFor(pureForm.get(Pid));
    const pick = (b) => (b.port !== undefined ? b.port : b.base + (port.pick || ''));
    if (cache && cache.has(key)) return pick(cache.get(key));
    if (materialising.has(Pid)) return 'None';
    if (!effVol(Pid)) {
      const b = lookupPure(env.frame, key, effCase(Pid) ? env.rs.epoch : null);
      if (b) return pick(b);
    }
    if (!o.probe) checkReads(Pid, env);
    materialising.add(Pid);
    const pcx = makeCx(Pid, env, o);
    if (Array.isArray(I.def.packages)) pcx.package(I.def.packages);
    let r;
    try { r = I.def.emit(pcx); } catch (e) { if (!o.probe) addProblem(P.internal(I.label, errText(e), Pid)); r = 'None'; }
    materialising.delete(Pid);
    let b;
    if (isObj(r)) {
      pureForm.set(Pid, 'obj');
      key = keyFor('obj');
      let e = cleanExpr(r[port.id]);
      if (!isAtom(e)) {
        const first = I.ports.outputs.length && I.ports.outputs[0].id === port.id;
        const v = tok(Pid, 'pure:' + port.id, first ? pureHint(I) : pureHint(I) + ' ' + (port.var || port.label || port.id));
        (o.pre || []).push({ t: v + ' = ' + e + '  ' + pyComment(I.label, 60), o: Pid });
        e = v;
      }
      b = { port: e };
    } else {
      pureForm.set(Pid, 'str');
      key = keyFor('str');
      let e = cleanExpr(r);
      const anyPick = I.ports.outputs.some(p => p.pick);
      if (!isAtom(e) || (anyPick && !isNameExpr(e))) {
        const v = tok(Pid, 'pure', pureHint(I));
        (o.pre || []).push({ t: v + ' = ' + e + '  ' + pyComment(I.label, 60), o: Pid });
        e = v;
      }
      b = { base: e };
    }
    b.epoch = env.rs.epoch;
    env.frame.pures.set(key, b);
    if (cache) cache.set(key, b);
    return pick(b);
  };

  // Monitors for a simulation step (6.5): every consumer of its result that will be written,
  // evaluated where the simulation runs; a per-item loop value after the run becomes the
  // whole list.
  const collectMonitors = (R, env, pre) => {
    const RI = info.get(R);
    const consumers = [...new Set((dataOut.get(R) || []).filter(d => d.type === 'res').map(d => d.to))]
      .filter(C => (reached.has(C) || needed.has(C)) && info.get(C).def && typeof info.get(C).def.monitors === 'function')
      .sort(compareIds);
    const entries = [];
    const seen = new Set();
    // Work an input out where the simulation runs, without leaving anything behind when that is
    // not possible; on success the calculators it needed are written before the run and kept in
    // its frame, so the consumer later reuses them.
    const scratchOf = new Map();
    const commit = (scratch, tmp) => { pre.push(...tmp); for (const [k, v] of scratch.pures) env.frame.pures.set(k, v); };
    const probe = (C, inputId) => {
      const fail = { failed: false };
      const tmp = [];
      const scratch = newFrame(env.frame);
      const ex = resolveInput(C, inputId, { ...env, frame: scratch }, { pre: tmp, stmt: R, probe: true, fail, stmtCache: new Map() });
      if (fail.failed) return null;
      scratchOf.set(tmp, scratch);
      return { ex, tmp };
    };
    for (const C of consumers) {
      const CI = info.get(C);
      let specs = [];
      try { specs = CI.def.monitors(CI.s, CI.node) || []; } catch (e) { addProblem(P.internal(CI.label, errText(e), C)); }
      for (const spec of specs) {
        if (!spec) continue;
        // The variable: a wired input, an input's fallback, a setting, or the text itself.
        let varExpr;
        let varProbe = null;
        const vin = CI.ports.inputs.find(p => p.id === spec.variable);
        if (vin) {
          varProbe = probe(C, spec.variable);
          if (!varProbe) { addProblem(P.monitorUnavailable(CI.label, vin, RI.label, C)); continue; }
          varExpr = varProbe.ex;
        } else if (CI.def.settings.some(st => st.key === spec.variable)) {
          varExpr = settingExpr(C, spec.variable);
        } else {
          varExpr = pyStr(spec.variable || '');
        }
        const ein = CI.ports.inputs.find(p => p.id === spec.element) || { id: spec.element, label: spec.element };
        const dEl = dataIn.get(C + ':' + spec.element);
        let entry = null;
        if (dEl && isStruct(dEl.from) && info.get(dEl.from).def.itemOutput === dEl.port.id &&
            lookupOut(env.frame, dEl.from + ':' + dEl.port.id) === undefined) {
          const L = dEl.from, LI = info.get(L);
          let lst = null;
          if (typeof LI.def.itemList === 'function') {
            const fail = { failed: false };
            const tmp = [];
            const scratch = newFrame(env.frame);
            const lcx = makeCx(L, { ...env, frame: scratch }, { pre: tmp, stmt: R, probe: true, fail, stmtCache: new Map() });
            try { lst = LI.def.itemList(lcx); } catch (e) { lst = null; }
            if (fail.failed || !lst || cleanExpr(lst) === 'None') lst = null;
            else { if (varProbe) commit(scratchOf.get(varProbe.tmp), varProbe.tmp); commit(scratch, tmp); lst = cleanExpr(lst); }
          }
          if (!lst) { addProblem(P.monitorUnavailable(CI.label, ein, RI.label, C)); continue; }
          entry = { each: lst, var: varExpr };
        } else {
          const r = probe(C, spec.element);
          if (!r) { addProblem(P.monitorUnavailable(CI.label, ein, RI.label, C)); continue; }
          if (r.ex === 'None') continue;   // nothing chosen yet: the consumer reports it
          if (varProbe) commit(scratchOf.get(varProbe.tmp), varProbe.tmp);
          commit(scratchOf.get(r.tmp), r.tmp);
          entry = { obj: r.ex, var: varExpr };
        }
        const k = (entry.each !== undefined ? 'each:' + entry.each : entry.obj) + '|' + entry.var;
        if (!seen.has(k)) { seen.add(k); entries.push(entry); }
      }
    }
    return entries;
  };

  // Results tables, for the result's `tables`: what each block writes (cx.columns) and the label
  // each loop or search pushes (a Python string literal, read back).
  const tableRecs = new Map(), ctxLabels = new Map();
  const noteCtx = (L, expr) => {
    const v = parsePyLiteral(String(expr));
    if (v && typeof v.value === 'string') ctxLabels.set(L, v.value);
  };
  const skipTablesFor = (L) => {
    const names = [];
    const r = region.get(L);
    if (!r) return names;
    for (const id of order) {
      if (!r.has(id)) continue;
      const I = info.get(id);
      if (!I.def || typeof I.def.skipTable !== 'function') continue;
      let n = '';
      try { n = I.def.skipTable(I.s, I.node); } catch (e) { n = ''; }
      if (n && !names.includes(String(n))) names.push(String(n));
    }
    return names;
  };

  // Outputs bound by cx.out go into the frame where Python can see them (6.4 "Availability").
  const bindOuts = (X, cx, frames) => {
    const I = info.get(X);
    for (const p of I.ports.outputs) {
      const scope = p.scope || 'after';
      const frame = scope === 'body' ? frames.body : frames.after;
      if (!frame) continue;
      if (cx._outs.has(p.id)) frame.outs.set(X + ':' + p.id, cx._outs.get(p.id));
      else if ((dataOut.get(X) || []).some(d => d.port.id === p.id && (reached.has(d.to) || needed.has(d.to)))) {
        onceProblem('noout:' + X + ':' + p.id, P.noOutput(I.label, p, X));
        frame.outs.set(X + ':' + p.id, 'None');
      }
    }
  };

  const callEmit = (X, cx) => {
    const I = info.get(X);
    if (I.def && Array.isArray(I.def.packages)) cx.package(I.def.packages);
    if (!I.def || typeof I.def.emit !== 'function') return null;
    try { return I.def.emit(cx); } catch (e) { onceProblem('emit:' + X, P.internal(I.label, errText(e), X)); return null; }
  };
  const writePre = (buf, pre) => { for (const l of pre) buf.add(l.t, 0, l.o); };

  // ---- Terminators: the NEAREST structure decides (C1).
  const writeTerminator = (env, buf, kind) => {
    const s = env.struct;
    if (!s) { buf.add('return'); return; }
    if (s.kind === 'callback') { buf.add(kind === 'stop' ? 'return ' + s.trial + '.stop_search()' : 'return ' + s.trial); return; }
    if (kind === 'stop') { buf.add('break'); return; }
    if (s.bodyEnd) writeBodyEnd(env, buf, true);
    buf.add('continue');
  };

  // Repeat until's check at the end of a pass; also before a `continue` when every value it
  // needs is there (C9), otherwise a plain continue and one warning.
  const writeBodyEnd = (env, buf, onSkip) => {
    const s = env.struct;
    const pre = [];
    const fail = { failed: false };
    const benv = { ...env, frame: newFrame(env.frame) };
    const cx = makeCx(s.id, benv, { pre, stmt: s.id, bodyEnd: true, probe: onSkip, fail, stmtCache: new Map() });
    let lines = [];
    try { lines = flatLines(s.bodyEnd(cx)); } catch (e) { onceProblem('bodyend:' + s.id, P.internal(s.label, errText(e), s.id)); return; }
    if (onSkip && fail.failed) {
      if (!s.warnedSkip) { s.warnedSkip = true; addProblem(P.bodyEndOnSkip(s.label, s.id)); }
      return;
    }
    const prev = buf.owner;
    buf.owner = s.id;
    writePre(buf, pre);
    buf.addLines(lines);
    buf.owner = prev;
  };

  // ---- The walk
  const emitChain = (start, stop, env, buf) => {
    let cur = start;
    const seen = new Set();
    while (cur !== null && cur !== stop) {
      if (seen.has(cur)) break;
      seen.add(cur);
      const kind = info.get(cur).kind;
      if (kind === 'start' || kind === 'action') { emitAction(cur, env, buf); cur = firstOut(cur) === null ? null : succ(cur, firstOut(cur)); }
      else if (kind === 'missing') { emitMissing(cur, buf); cur = firstOut(cur) === null ? null : succ(cur, firstOut(cur)); }
      else if (kind === 'terminal') { emitTerminal(cur, env, buf); return { end: 'term' }; }
      else if (kind === 'branch') { const r = emitBranch(cur, stop, env, buf); if (r.end) return r; cur = r.next; }
      else if (kind === 'loop') { emitLoop(cur, env, buf); cur = succ(cur, 'done'); }
      else if (kind === 'callback') { emitCallback(cur, env, buf); cur = succ(cur, 'done'); }
      else cur = null;
    }
    if (cur !== null && cur === stop) return { end: 'stop' };
    if (env.pending) { writeTerminator(env, buf, 'skip'); return { end: 'term' }; }
    return { end: 'dead' };
  };

  const emitMissing = (X, buf) => {
    const prev = buf.owner;
    buf.owner = X;
    buf.add(pyComment('-- Step ' + stepOf(X) + ': ' + info.get(X).label + ' --'));
    buf.add('pass  # this block is missing from this version of the Builder, so it does nothing');
    buf.owner = prev;
  };

  const emitAction = (X, env, buf) => {
    const I = info.get(X);
    const prev = buf.owner;
    buf.owner = X;
    buf.add(stepComment(X));
    checkReads(X, env);
    const pre = [];
    const cx = makeCx(X, env, { pre, stmt: X, stmtCache: new Map() });
    const r = callEmit(X, cx);
    let lines;
    if (I.kind === 'start') {
      const rr = isObj(r) ? r : {};
      if (X === startId) startSettingLines = flatLines(rr.settings);
      lines = flatLines(rr.lines);
    } else {
      lines = flatLines(Array.isArray(r) || typeof r === 'string' ? r : (isObj(r) ? r.lines : []));
    }
    writePre(buf, pre);
    buf.addLines(lines);
    bindOuts(X, cx, { after: env.frame, body: env.frame });
    applyWrites(X, env);
    buf.owner = prev;
  };

  const emitTerminal = (X, env, buf) => {
    const I = info.get(X);
    const prev = buf.owner;
    buf.owner = X;
    buf.add(stepComment(X));
    const cx = makeCx(X, env, { pre: [], stmt: X, stmtCache: new Map() });
    const r = callEmit(X, cx) || {};
    const kind = ['continue', 'break', 'stop'].includes(r.kind) ? r.kind : 'stop';
    const msg = String(r.msg || I.label);
    if (kind === 'stop') {
      helpers.add('StopWorkflow');
      buf.add('raise StopWorkflow(' + pyStr(msg) + ')');
    } else if (!env.struct) {
      onceProblem('term:' + X, P.terminalOutside(I.label, X));
      buf.add('return');
    } else if (kind === 'continue') {
      helpers.add('ctx');
      buf.add('case_skipped(' + pyStr(msg) + ')');
      writeTerminator(env, buf, 'skip');
    } else {
      buf.add('log(' + pyStr(msg) + ')');
      writeTerminator(env, buf, 'stop');
    }
    buf.owner = prev;
  };

  // Reach sets bounded by `stop` (stop included, not passed), loops and searches as one step.
  const reachMemo = new Map();
  const reachOf = (start, stop) => {
    const k = start + '|' + stop;
    if (reachMemo.has(k)) return reachMemo.get(k);
    const set = new Set();
    const st = [start];
    while (st.length) {
      const u = st.pop();
      if (set.has(u)) continue;
      set.add(u);
      if (u === stop) continue;
      const kind = info.get(u).kind;
      const nexts = STRUCT_KINDS.includes(kind) ? [succ(u, 'done')] : kind === 'terminal' ? [] : allSuccs(u);
      for (const v of nexts) if (v !== null && !set.has(v)) st.push(v);
    }
    reachMemo.set(k, set);
    return set;
  };

  const emitBranch = (X, stop, env, buf) => {
    const I = info.get(X);
    const prev = buf.owner;
    buf.owner = X;
    buf.add(stepComment(X));
    checkReads(X, env);
    const pre = [];
    const cx = makeCx(X, env, { pre, stmt: X, stmtCache: new Map() });
    const r = callEmit(X, cx) || {};
    writePre(buf, pre);
    buf.addLines(r.lines);
    bindOuts(X, cx, { after: env.frame, body: env.frame });
    applyWrites(X, env);

    const declared = I.ports.flowOuts.map(p => p.id);
    let branches = (Array.isArray(r.branches) ? r.branches : []).filter(b => b && declared.includes(b.out) && typeof b.test === 'string' && b.test.trim());
    let elseOut = declared.includes(r.elseOut) ? r.elseOut : null;
    if (!elseOut && branches.length) elseOut = branches.pop().out;   // the last one acts as else
    if (!elseOut) elseOut = declared[declared.length - 1] || null;
    const outs = [...branches.map(b => b.out), ...(elseOut && !branches.some(b => b.out === elseOut) ? [elseOut] : [])];
    const tests = branches.map(b => b.test.trim());
    const cond = (o) => {
      const k = branches.findIndex(b => b.out === o);
      const prevT = k < 0 ? tests : tests.slice(0, k);
      const notPrev = prevT.length === 0 ? '' : prevT.length === 1 ? 'not ' + paren(prevT[0]) : 'not (' + prevT.map(paren).join(' or ') + ')';
      if (k < 0) return notPrev || 'True';
      return notPrev ? notPrev + ' and ' + paren(tests[k]) : tests[k];
    };
    const portOf = (o) => I.ports.flowOuts.find(p => p.id === o) || { id: o, label: o };
    const outLabel = (o) => portOf(o).label || o;
    const stopMsg = (o) => portOf(o).stopMsg || '';
    const connected = outs.filter(o => succ(X, o) !== null);

    const guard = (o) => {
      const t = succ(X, o);
      if (t === null) {
        buf.add(pyComment(outLabel(o) + ': ' + endWords(env.struct && env.struct.kind, env.struct && env.struct.label, true)));
        const child = buf.sub();
        const msg = stopMsg(o) || (I.label + ': ' + outLabel(o));
        if (env.struct) { helpers.add('ctx'); child.add('case_skipped(' + pyStr(msg) + ')'); }
        else child.add('log(' + pyStr(msg + '. The workflow ends here.') + ', "warn")');
        writeTerminator(env, child, 'skip');
        writeSuite(buf, 'if ' + cond(o) + ':', child);
      } else {
        buf.add(pyComment(I.label + ': ' + outLabel(o)));
        const child = buf.sub();
        const cenv = { ...env, frame: newFrame(env.frame), pending: true, rs: copyRs(env.rs) };
        emitChain(t, stop, cenv, child);
        writeSuite(buf, 'if ' + cond(o) + ':', child);
      }
    };

    const ifChain = (chainOuts, J) => {
      const suites = chainOuts.map(o => {
        const child = buf.sub();
        child.add(pyComment(outLabel(o)));
        const cenv = { ...env, frame: newFrame(env.frame), pending: true, rs: copyRs(env.rs) };
        const res = emitChain(succ(X, o), J, cenv, child);
        return { o, child, res, rs: cenv.rs };
      });
      // Merge what the suites that reach the join did to the route.
      const live = suites.filter(s => s.res.end === 'stop');
      if (live.length) {
        const inv = live.find(s => s.rs.results === 'invalid');
        env.rs.results = inv ? 'invalid' : live.some(s => s.rs.results === 'valid') ? 'valid' : 'none';
        env.rs.writer = inv ? inv.rs.writer : env.rs.writer;
        env.rs.loopStart = inv ? inv.rs.loopStart : null;
        if (live.some(s => s.rs.epoch !== env.rs.epoch)) env.rs.epoch = newEpoch();
      }
      const nonEmpty = suites.filter(s => s.child.count > 0);
      if (!nonEmpty.length) return;
      const plain = nonEmpty.length === suites.length && chainOuts.length === outs.length && chainOuts.every((o, k) => o === outs[k]);
      nonEmpty.forEach((s, k) => {
        let header;
        if (plain) {
          if (k === 0) header = 'if ' + (s.o === elseOut ? cond(s.o) : tests[branches.findIndex(b => b.out === s.o)]) + ':';
          else if (s.o === elseOut && k === nonEmpty.length - 1) header = 'else:';
          else header = 'elif ' + tests[branches.findIndex(b => b.out === s.o)] + ':';
        } else {
          header = (k === 0 ? 'if ' : 'elif ') + cond(s.o) + ':';
        }
        writeSuite(buf, header, s.child);
      });
    };

    let result;
    if (!connected.length) {
      // Nothing wired: say what happened, then the route ends here.
      for (const o of outs) {
        if (!stopMsg(o)) continue;
        const child = buf.sub();
        child.add('log(' + pyStr(stopMsg(o)) + ', "warn")');
        writeSuite(buf, 'if ' + cond(o) + ':', child);
      }
      result = { next: null };
    } else {
      const continuing = stop === null ? [] : connected.filter(o => reachOf(succ(X, o), stop).has(stop));
      const lowest = (sets) => {
        let J = null;
        const [first, ...rest] = sets;
        for (const v of first) if (rest.every(s => s.has(v)) && (J === null || topo.get(v) < topo.get(J))) J = v;
        return J;
      };
      if (continuing.length >= 2) {
        const J = lowest(continuing.map(o => reachOf(succ(X, o), stop)));
        for (const o of outs) if (!continuing.includes(o)) guard(o);
        ifChain(continuing, J);
        result = { next: J };
      } else if (continuing.length === 1) {
        for (const o of outs) if (o !== continuing[0]) guard(o);
        result = { next: succ(X, continuing[0]) };
      } else if (connected.length === 1) {
        for (const o of outs) if (o !== connected[0]) guard(o);
        result = { next: succ(X, connected[0]) };
      } else {
        const J = lowest(connected.map(o => reachOf(succ(X, o), stop)));
        if (J !== null) {
          for (const o of outs) if (!connected.includes(o)) guard(o);
          ifChain(connected, J);
          result = { next: J };
        } else {
          // No join: the biggest route goes on inline, the others become guard clauses (C21).
          // A route that is only a Skip / Stop block makes the best guard, so it never goes inline.
          const size = (o) => { const r = reachOf(succ(X, o), stop); return [...r].every(v => info.get(v).kind === 'terminal') ? 0 : r.size; };
          let inline = connected[0];
          for (const o of connected) if (size(o) > size(inline)) inline = o;
          for (const o of outs) if (o !== inline) guard(o);
          result = { next: succ(X, inline) };
        }
      }
    }
    buf.owner = prev;
    return result;
  };

  // The lines around a pass or try: except clauses, then finally with the put-back and ctx_pop.
  const writeTryBody = (X, body, tryBuf, o) => {
    writeSuite(body, 'try:', tryBuf);
    const errTok = tok(X, 'err', 'err', true);
    body.add('except StopWorkflow:');
    body.add('raise', 1);
    body.add('except Exception as ' + errTok + ':');
    body.add('case_failed(' + errTok + (o.trial ? ', ' + o.trial : '') + ')', 1);
    if (o.onError === 'stop') body.add('raise StopWorkflow(' + pyStr(o.label + ': a pass failed, so the workflow stops.') + ') from ' + errTok, 1);
    const fin = body.sub();
    const inner = [...o.bodyFinally];
    if (o.markTok && o.undoEach) inner.push('pf_undo(' + o.markTok + ')');
    const popLine = o.ctx ? 'ctx_pop(' + (o.tables.length ? pyLit(o.tables) : '') + ')' : null;
    if (inner.length) {
      const finTok = tok(X, 'fin', 'fin', true);
      const t = fin.sub();
      t.addLines(inner);
      writeSuite(fin, 'try:', t);
      fin.add('except Exception as ' + finTok + ':');
      fin.add('log(f"Could not put things back after this pass: {' + finTok + '}", "error")', 1);
      if (o.onError === 'stop') {
        if (popLine) fin.add(popLine, 1);
        fin.add('raise StopWorkflow(' + pyStr(o.label + ': could not put things back after a pass.') + ') from ' + finTok, 1);
      }
    }
    if (popLine) fin.add(popLine);
    if (fin.count) { body.add('finally:'); body.append(fin); }
  };

  const loopRs = (env, L) => {
    const fx = fxOf(L);
    const writes = fx.model || fx.case;
    return {
      body: {
        results: writes ? (env.rs.results === 'none' ? 'none' : 'invalid') : env.rs.results,
        writer: writes ? fx.writer : env.rs.writer,
        epoch: fx.case ? newEpoch() : env.rs.epoch,
        loopStart: writes ? info.get(L).label : env.rs.loopStart,
      },
      after: {
        results: writes ? 'invalid' : (fx.calc ? 'valid' : env.rs.results),
        writer: writes ? fx.writer : env.rs.writer,
        epoch: fx.case ? newEpoch() : env.rs.epoch,
        loopStart: null,
      },
    };
  };

  // Lines blocks on the Each route asked for once their loop or search has ended
  // (cx.afterStruct; e.g. Draw time series graph with every pass on one graph), in node order.
  const writeAfterStruct = (struct, buf) => {
    if (!struct || !struct.after) return;
    for (const id of [...struct.after.keys()].sort(compareIds)) {
      const prev = buf.owner;
      buf.owner = id;
      buf.addLines(struct.after.get(id));
      buf.owner = prev;
    }
  };

  const emitLoop = (L, env, buf) => {
    const I = info.get(L);
    const prev = buf.owner;
    buf.owner = L;
    buf.add(stepComment(L));
    if (env.depth >= MAX_LEVELS) {
      onceProblem('deep:' + L, P.tooDeep(I.label, L));
      buf.add('pass  # too many loops inside each other: see Problems');
      buf.owner = prev;
      return;
    }
    checkReads(L, env);
    const pre = [];
    const cx = makeCx(L, env, { pre, stmt: L, stmtCache: new Map() });
    const r = callEmit(L, cx) || {};
    writePre(buf, pre);
    buf.addLines(r.lines);
    const fx = fxOf(L);
    const restore = ['pass', 'end', 'never'].includes(r.restore) ? r.restore : (['pass', 'end', 'never'].includes(I.s.restore) ? I.s.restore : 'pass');
    const onError = ['skip', 'stop'].includes(r.onError) ? r.onError : (I.s.onError === 'stop' ? 'stop' : 'skip');
    const markTok = restore !== 'never' && (fx.model || fx.case) ? tok(L, 'mark', 'mark', true) : null;
    if (markTok) helpers.add('pf_mark').add('pf_undo');
    helpers.add('ctx').add('case_failed').add('StopWorkflow');
    if (markTok && restore === 'end') buf.add(markTok + ' = pf_mark()');
    let header = String(r.header || '').trim();
    if (!header) { header = 'for ' + tok(L, 'nothing', 'item') + ' in ():'; onceProblem('hdr:' + L, P.internal(I.label, 'it gave no loop line', L)); }
    if (!header.endsWith(':')) header += ':';
    buf.add(header);
    const body = buf.sub();
    const ctx = Array.isArray(r.ctx) && r.ctx.length >= 2 ? r.ctx : null;
    if (ctx) {
      const it = isObj(r.iter) && r.iter.i ? ', ' + r.iter.i + ', ' + (r.iter.n ? r.iter.n : 'None') : '';
      body.add('ctx_push(' + ctx[0] + ', ' + ctx[1] + it + ')');
      noteCtx(L, ctx[0]);
    }
    if (markTok && restore === 'pass') body.add(markTok + ' = pf_mark()');
    const tryBuf = body.sub();
    tryBuf.addLines(r.bodyStart);
    const bodyFrame = newFrame(env.frame);
    bindOuts(L, cx, { body: bodyFrame, after: null });
    const rs = loopRs(env, L);
    const benv = {
      frame: bodyFrame, pending: false, depth: env.depth + 1, rs: rs.body, trial: env.trial,
      struct: { kind: 'loop', id: L, label: I.label, bodyEnd: typeof r.bodyEnd === 'function' ? r.bodyEnd : null, warnedSkip: false },
    };
    const b = succ(L, 'body');
    const res = b !== null ? emitChain(b, null, benv, tryBuf) : { end: 'dead' };
    if (res.end !== 'term' && benv.struct.bodyEnd) writeBodyEnd(benv, tryBuf, false);
    writeTryBody(L, body, tryBuf, {
      onError, label: I.label, markTok, undoEach: restore === 'pass', ctx,
      bodyFinally: flatLines(r.bodyFinally), tables: ctx ? skipTablesFor(L) : [],
    });
    for (const l of body.lines) buf.lines.push(l);
    const orelse = flatLines(r.orelse);
    if (orelse.length) { buf.add('else:'); buf.addLines(orelse, 1); }
    if (markTok && restore === 'end') buf.add('pf_undo(' + markTok + ')');
    buf.addLines(r.after);
    writeAfterStruct(benv.struct, buf);
    bindOuts(L, cx, { body: null, after: env.frame });
    Object.assign(env.rs, rs.after);
    buf.owner = prev;
  };

  const emitCallback = (C, env, buf) => {
    const I = info.get(C);
    const prev = buf.owner;
    buf.owner = C;
    buf.add(stepComment(C));
    checkReads(C, env);
    const pre = [];
    const cx = makeCx(C, env, { pre, stmt: C, stmtCache: new Map() });
    const fnTok = tok(C, 'def', 'try');
    const trialTok = tok(C, 'trial', 'trial', true);
    cx.fn = fnTok;
    const r = callEmit(C, cx) || {};
    writePre(buf, pre);
    buf.addLines(r.lines);
    const fx = fxOf(C);
    const markTok = fx.model || fx.case ? tok(C, 'mark', 'mark', true) : null;
    if (markTok) helpers.add('pf_mark').add('pf_undo');
    helpers.add('Trial').add('ctx').add('case_failed').add('StopWorkflow');
    const params = (Array.isArray(r.params) ? r.params : []).map(String);
    const labels = Array.isArray(r.labels) ? r.labels : params.map((p, k) => 'Value ' + (k + 1));
    buf.add('def ' + fnTok + '(' + params.join(', ') + '):');
    const body = buf.sub();
    const dict = '{' + params.map((p, k) => pyStr(labels[k] === undefined ? 'Value ' + (k + 1) : labels[k]) + ': ' + p).join(', ') + '}';
    body.add(trialTok + ' = Trial(' + dict + ', ' + pyStr(r.goal === 'max' ? 'max' : 'min') + ')');
    let ctx = Array.isArray(r.ctx) && r.ctx.length >= 2 ? r.ctx : null;
    if (!ctx) {
      helpers.add('convert');
      ctx = [pyStr(I.label), params.length === 1 ? params[0] : params.length ? '", ".join(as_text(v) for v in (' + params.join(', ') + ',))' : 'None'];
    }
    body.add('ctx_push(' + ctx[0] + ', ' + ctx[1] + ')');
    noteCtx(C, ctx[0]);
    if (markTok) body.add(markTok + ' = pf_mark()');
    const tryBuf = body.sub();
    tryBuf.addLines(r.bodyStart);
    const bodyFrame = newFrame(env.frame);
    bindOuts(C, cx, { body: bodyFrame, after: null });
    const rs = loopRs(env, C);
    const benv = {
      frame: bodyFrame, pending: false, depth: 0, rs: rs.body, trial: trialTok,
      struct: { kind: 'callback', id: C, label: I.label, trial: trialTok, bodyEnd: null },
    };
    const b = succ(C, 'body');
    if (b !== null) emitChain(b, null, benv, tryBuf);
    writeTryBody(C, body, tryBuf, {
      onError: 'skip', label: I.label, markTok, undoEach: true, ctx, trial: trialTok,
      bodyFinally: flatLines(r.bodyFinally), tables: skipTablesFor(C),
    });
    body.add('return ' + trialTok);
    for (const l of body.lines) buf.lines.push(l);
    buf.addLines(r.call);
    buf.addLines(r.after);
    writeAfterStruct(benv.struct, buf);
    bindOuts(C, cx, { body: null, after: env.frame });
    Object.assign(env.rs, rs.after);
    buf.owner = prev;
  };

  // ---- Run the walk.
  let mainBuf = new Buf(2, null);
  try {
    if (startId) {
      const rootEnv = { frame: newFrame(null), struct: null, pending: false, depth: 0, trial: null,
        rs: { results: 'none', writer: null, epoch: 0, loopStart: null } };
      emitChain(startId, null, rootEnv, mainBuf);
    }
  } catch (e) {
    if (e !== TANGLED) throw e;
    addProblem(P.tooTangled());
    lineCount = 0;
    mainBuf = new Buf(2, null);
    mainBuf.add('pass  # this workflow is too tangled to write out: see PROBLEMS');
  }

  // Block-level checks (validate hooks), after the walk so they see the step numbers.
  for (const id of order) {
    if (!reached.has(id) && !needed.has(id)) continue;
    const I = info.get(id);
    if (!I.def || typeof I.def.validate !== 'function') continue;
    const L = nearest.get(id);
    const vcx = makeCx(id, null, { probe: false });
    vcx.structure = L ? info.get(L).kind : null;
    vcx.loopLabel = L ? info.get(L).label : '';
    try { I.def.validate(vcx); } catch (e) { addProblem(P.internal(I.label, errText(e), id)); }
  }

  // ===========================================================================================
  // 4. Helpers, names, problems

  const resolved = resolveHelpers([...helpers], lib);
  for (const m of resolved.missing) addProblem(P.helperMissing(m));

  // Problems: deduplicated, workflow-level first, then in node order (stable).
  const seenP = new Set();
  const finalProblems = [];
  problems.forEach((p, i) => {
    const k = p.level + '|' + p.msg + '|' + (p.nodeId || '') + '|' + (p.edgeId || '');
    if (seenP.has(k)) return;
    seenP.add(k);
    const out = { level: ['error', 'warning', 'todo'].includes(p.level) ? p.level : 'warning', msg: p.msg };
    if (p.nodeId) out.nodeId = p.nodeId;
    if (p.edgeId) out.edgeId = p.edgeId;
    if (p.fix) out.fix = p.fix;
    finalProblems.push({ p: out, i });
  });
  finalProblems.sort((a, b) => {
    const na = a.p.nodeId, nb = b.p.nodeId;
    if (!na && nb) return -1;
    if (na && !nb) return 1;
    if (na && nb) { const c = compareIds(na, nb); if (c) return c; }
    return a.i - b.i;
  });
  const problemList = finalProblems.map(x => x.p);
  const blocking = problemList.filter(p => p.level === 'error' || p.level === 'todo');

  // ===========================================================================================
  // 5. The file (6.6)

  const L = [];
  const add = (t, o = null) => { for (const s of String(t).split('\n')) L.push({ t: s, o }); };
  add('#!/usr/bin/env python3');
  add(pyComment(wfName || 'Workflow'));
  if (opts.now) {
    const d = opts.now instanceof Date ? opts.now : new Date(opts.now);
    if (!Number.isNaN(d.getTime())) add('# Written by the PowerFactory Workflow Builder on ' + d.toISOString().slice(0, 10));
  }
  add('"""Made with the PowerFactory Workflow Builder, ' + BUILDER_URL);
  add('');
  add('BEFORE YOU RUN');
  add('  1. Check the SETTINGS below (lines marked REQUIRED).');
  add('  2. Close PowerFactory, or run this file from inside PowerFactory (see RUN_MODE).');
  add('  3. Run it with the Python that matches your PowerFactory, e.g.  py -3.12 ' + fileNameFor(wf));
  add('Results and run.log go to a new folder next to this file (or in OUTPUT_DIR).');
  add('"""');
  add('# ==== IMPORTS ====');
  const plainImp = new Set(resolved.imports.filter(l => !/^from\s/.test(l)));
  const fromImp = new Set(resolved.imports.filter(l => /^from\s/.test(l)));
  for (const l of extraImports) (/^from\s/.test(l) ? fromImp : plainImp).add(l);
  for (const l of [...[...plainImp].sort(), ...[...fromImp].sort()]) add(l);
  add('');
  add('# ==== SETTINGS (edit here) ====');
  add(commentLines('The name of this workflow: used for the run folder and in the log.').join('\n'));
  add('WORKFLOW_NAME = ' + pyStr(wfName));
  for (const l of startSettingLines) add(l);
  // How the graphs look (Workflow > Graph style), only when the script draws one.
  if (resolved.names.includes('plot_common')) {
    add('');
    for (const l of pyStyleLines(styleOf(wf), { pyLit, commentLines })) add(l);
  }
  // Pinned settings of the blocks that run.
  for (const id of order) {
    if (!reached.has(id) && !needed.has(id)) continue;
    const I = info.get(id);
    if (!I.def || I.kind === 'start') continue;
    for (const st of I.def.settings || []) {
      const NAME = pinName.get(id + ':' + st.key);
      if (!NAME) continue;
      let v = I.s[st.key];
      if (typeof I.def.pinLiteral === 'function') { try { const pv = I.def.pinLiteral(st.key, I.s); if (pv !== undefined) v = pv; } catch (e) { /* keep the value */ } }
      let sub;
      if (st.kind === 'element') { v = isObj(v) ? String(v.name || '') : ''; sub = 'name'; }
      settingsMap[NAME] = sub ? [id, st.key, sub] : [id, st.key];
      let words = I.label + ': ' + (st.label || st.key) + (st.unit ? ' (' + st.unit + ')' : '') + '.';
      if (st.kind === 'element') {
        const e = isObj(I.s[st.key]) ? I.s[st.key] : {};
        const cls = e.cls ? ' (' + e.cls + ')' : '';
        if (e.match === 'all') words += ' A name' + cls + ', exactly as in the Data Manager, or a pattern with * and ?: every element that matches is used.';
        else if (e.match === 'first') words += ' A name' + cls + ', exactly as in the Data Manager, or a pattern with * and ?: the first match by name is used.';
        else words += ' The name of the element' + cls + ', exactly as in the Data Manager.';
      }
      if (st.kind === 'select') {
        const opt = (st.options || []).map(x => Array.isArray(x) ? '"' + x[0] + '" ' + (x[1] || '') : isObj(x) ? '"' + x.value + '" ' + (x.label || '') : '"' + x + '"');
        words += ' Choices: ' + opt.join(', ') + '.';
      }
      add('');
      // An element the code looks up is needed too (it has no `required`: it is the fallback of
      // an input that is not wired), so its line says REQUIRED.
      const req = st.required || (st.kind === 'element' && elementsUsed.has(id + ':' + st.key));
      add(commentLines((req ? 'REQUIRED. ' : 'OPTIONAL. ') + words).join('\n'));
      add(NAME + ' = ' + pyLit(v));
    }
  }
  if (blocking.length) {
    add('');
    add(commentLines('This workflow has ' + blocking.length + (blocking.length === 1 ? ' problem' : ' problems') +
      ' to fix in the Builder (listed below), so main() stops before it connects to PowerFactory. To run anyway (not advised), make the list empty: PROBLEMS = []').join('\n'));
    add('PROBLEMS = [');
    for (const p of blocking) add('    ' + pyStr((p.level === 'todo' ? 'To do: ' : 'Error: ') + p.msg) + ',');
    add(']');
  }
  add('');
  add(commentLines('True: connect, find every element named in this workflow, say what was found, then stop without running anything.').join('\n'));
  add('CHECK_ONLY = False');
  add('');
  add('');
  add('# ==== WORKFLOW ====');
  const notes = order.filter(id => info.get(id).kind === 'note');
  for (const id of notes) {
    const I = info.get(id);
    const text = String(I.s.text === undefined ? '' : I.s.text);
    const lines = text.split(/\r\n|\n|\r|\u2028|\u2029|\u0085/).map(t => pyCommentText(t, 200)).filter(Boolean);
    if (!lines.length) continue;
    add(pyComment('Note: ' + lines[0]), id);
    for (const t of lines.slice(1)) add('#   ' + t, id);
  }
  add('def main():');
  if (blocking.length) {
    add('    if PROBLEMS:');
    add('        for problem in PROBLEMS:');
    add('            log(problem, "error")');
    add('        raise SystemExit(f"This workflow has {len(PROBLEMS)} problem{\'s\' if len(PROBLEMS) != 1 else \'\'} to fix in the Builder; nothing was run.")');
  }
  add('    preflight([' + [...packages].sort().map(pyStr).join(', ') + '])');
  add('    app = pf_connect()');
  add('    try:');
  add('        if CHECK_ONLY:');
  add('            check_elements(app, [' + checkQueries.join(', ') + '])');
  add('            return');
  for (const l of mainBuf.lines) L.push(l);
  add('    except StopWorkflow as stop:');
  add('        log(f"Stopped: {stop}")');
  add('    finally:');
  add('        finish(app)');
  add('');
  add('');
  add('# ==== HELPERS (copied from the Builder runtime; you do not need to read these) ====');
  for (const s of resolved.sections) {
    add('');
    for (const l of s.code) add(l);
  }
  add('');
  add('');
  add('if __name__ == "__main__":');
  add('    main()');

  // Names: tokens become identifiers, allocated in node order (C24b).
  const reserved = new Set([...baseReserved(), ...lib.names, ...constTaken, ...Object.keys(settingsMap)]);
  const names = allocateNames(reqs, reserved, compareIds, new Set(['mark', 'trial', 'err', 'fin']));
  const spans = {};
  const out = [];
  L.forEach((l, i) => {
    const t = l.t.indexOf(TA) >= 0 ? l.t.replace(/\ue000(\d+)\ue001/g, (m, k) => names[Number(k)] || 'None') : l.t;
    out.push(t.replace(/[\ue000\ue001]/g, '?'));
    if (l.o) {
      const sp = spans[l.o] || (spans[l.o] = []);
      const last = sp[sp.length - 1];
      if (last && last[1] === i) last[1] = i + 1;
      else sp.push([i + 1, i + 1]);
    }
  });
  const code = embedInPython(out.join('\n') + '\n', wf, settingsMap);

  // ===========================================================================================
  // Results for the canvas

  const ends = {};
  const structLabel = (X) => { const s = nearest.get(X); return s ? [info.get(s).kind, info.get(s).label] : [null, '']; };
  for (const id of order) {
    const I = info.get(id);
    if (!I.def || !isStmt(id)) continue;
    for (const p of I.ports.flowOuts) {
      if (rawSucc(id, p.id) !== null) continue;
      let words;
      if (isStruct(id) && p.id === 'body') words = I.kind === 'loop' ? 'nothing runs on each pass yet' : 'nothing runs on each try yet';
      else if (isStruct(id)) { const [k, lab] = structLabel(id); words = endWords(k, lab, false); }
      else { const [k, lab] = structLabel(id); words = endWords(k, lab, I.kind === 'branch'); }
      ends[id + ':' + p.id] = words;
    }
  }
  const regions = {};
  for (const id of order) {
    const I = info.get(id);
    let ch = reached.has(id) ? chainOf(id) : [];
    if (I.kind === 'pure' && needed.has(id)) {
      // A calculator sits in the loops all its users share.
      const users = (dataOut.get(id) || []).map(d => d.to).filter(t => reached.has(t));
      if (users.length) {
        ch = chainOf(users[0]);
        for (const u of users.slice(1)) { const c = chainOf(u); let k = 0; while (k < ch.length && ch[k] === c[k]) k++; ch = ch.slice(0, k); }
      }
    }
    regions[id] = ch.map(x => ({ id: x, label: info.get(x).label, kind: info.get(x).kind }));
  }
  const stepsObj = {};
  for (const [k, v] of steps) stepsObj[k] = v;

  // The columns of each results table, in the order the run first writes them (ResultTable.add:
  // the loop values outermost first, a repeated label numbered as ctx_dict does, then Status,
  // then the row's own columns). A table filled from a file is marked: its columns are unknown.
  const tables = {};
  for (const id of order) {
    const t = tableRecs.get(id);
    if (!t) continue;
    const T = tables[t.table] || (tables[t.table] = { columns: [], file: false, read: false });
    if (t.file) T.file = true;
    // `read` says the page has read the file itself, so its column names are the real ones.
    if (t.read) T.read = true;
    const row = [];
    if (t.ctx) {
      const seen = new Set();
      for (const r of regions[id] || []) {
        const lab = ctxLabels.get(r.id);
        if (lab === undefined) continue;
        let key = lab, k = 2;
        while (seen.has(key)) key = lab + ' (' + (k++) + ')';
        seen.add(key); row.push(key);
      }
    }
    if (t.status) row.push('Status');
    row.push(...t.names);
    for (const c of row) if (!T.columns.includes(c)) T.columns.push(c);
  }

  return {
    code,
    problems: problemList,
    helpers: resolved.names,
    ends,
    regions,
    steps: stepsObj,
    settingsMap,
    spans,
    tables,
  };
}
