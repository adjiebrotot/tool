// The Workflow Builder page: loads the blocks and the Python runtime, restores the reader's
// workflow from the mini cache, mounts the panels and holds the editor's actions (every change
// to the workflow goes through one of them, so undo, the code and the cache see it).
//
// Order at start-up (DESIGN 1.1, 3):
//   1. the runtime files are fetched (in the background; a missing file is skipped);
//   2. the block files are imported one by one, each with a catch: a file that fails leaves its
//      blocks Missing, holds autosave (so a broken file never overwrites the mini cache) and
//      shows a banner;
//   3. Persist.init restores the cached workflow (its restore runs inside init) through
//      loadWorkflow;
//   4. the panels and the canvas are mounted; the first code is written once the runtime is in.
// window.PFB exposes the editor to tour.js and the tests.

import * as R from '../core/registry.js';
import * as W from '../core/workflow.js';
import { generate } from '../core/codegen.js';
import { RUNTIME_FILES } from '../core/runtime-loader.js';
import { createStore } from './store.js';
import * as ops from './ops.js';
import { $, debounce, isPhone } from './dom.js';
import { toast } from './toasts.js';
import { openQuickAdd, closeQuickAdd } from './quickadd.js';
import { mountCanvas } from './canvas.js';
import { mountPalette } from './palette.js';
import { mountInspector } from './inspector.js';
import { mountPython } from './python.js';
import { mountProblems } from './problems.js';
import { mountFiles } from './files.js';
import { mountTemplates } from './templates.js';
import { mountKeyboard } from './keyboard.js';
import { mountLayout, initTheme } from './layout.js';

export const PERSIST_NS = 'powerfactory-scripter-builder';   // frozen handle (DESIGN 1.1)
// The category files, in palette order of their files (blocks/index.js lists the same).
export const CATEGORY_FILES = ['start', 'flow', 'values', 'model', 'study', 'check', 'result', 'search', 'advanced'];
const GEN_DEBOUNCE = 120;

function showAlert(html) {
  const a = $('pfbAlert');
  if (!a) return;
  a.innerHTML = html;
  a.classList.toggle('visible', !!html);
}

export async function boot() {
  // ---- 1. Runtime files, in the background.
  const runtimeP = Promise.all(RUNTIME_FILES.map(f =>
    fetch('runtime/' + f).then(r => (r.ok ? r.text() : null), () => null).then(t => [f, t])))
    .then(pairs => { const o = {}; for (const [f, t] of pairs) if (typeof t === 'string') o[f] = t; return o; });

  // ---- 2. Blocks
  const failed = [];
  for (const f of CATEGORY_FILES) {
    try { await import('../blocks/' + f + '.js'); } catch (e) { failed.push(f + '.js'); console.warn('[Builder] blocks/' + f + '.js did not load:', e && e.message ? e.message : e); }
  }

  // ---- 3. Store and the mini cache
  const theme0 = document.body.classList.contains('light') ? 'light' : 'dark';
  const store = createStore({ wf: W.emptyWorkflow('My workflow'), theme: theme0 });
  const app = { store, toast, dragging: null, held: failed.length > 0 };
  initTheme(store);

  let restoredBlob;            // what Persist found (restore runs inside init)
  let cachedExtra;             // the cached workflow as it was, kept while autosave is held
  const persistReady = typeof window.Persist === 'object' && window.Persist && typeof Persist.init === 'function';
  let persist = null;
  if (persistReady) {
    try {
      persist = Persist.init(PERSIST_NS, {
        extra: {
          save: () => (app.held ? cachedExtra : W.serialize({ ...store.get().wf, view: store.get().view })),
          restore: (obj) => { restoredBlob = obj; },
        },
      });
    } catch (e) { console.warn('[Builder] mini cache:', e && e.message ? e.message : e); persist = null; }
  }
  const restoreNotes = [];
  if (restoredBlob !== undefined) {
    try { cachedExtra = JSON.parse(JSON.stringify(restoredBlob)); } catch (e) { cachedExtra = restoredBlob; }
    const { wf, notes } = W.loadWorkflow(restoredBlob);
    if (wf) {
      store.reset(wf, { view: wf.view });
      restoreNotes.push(...notes.filter(n => n.level === 'warning' || n.level === 'error'));
    } else restoreNotes.push(...notes);
  }
  if (failed.length) {
    showAlert('<strong>Some blocks did not load</strong> (' + failed.join(', ') + '). Their blocks show as Missing and nothing is lost: ' +
      'your saved workflow in this browser is kept as it was, so <strong>changes made now are not saved here</strong>. Reload the page to try again, or save to a file.');
  }

  // ---- 4. Code generation
  let runtime = null, genFor = null;
  function runGenerate() {
    if (!runtime) return;
    const s = store.get();
    genFor = s.wf;
    const g = generate(s.wf, { runtime });
    store.set({ gen: g });
  }
  const regen = debounce(runGenerate, GEN_DEBOUNCE);
  app.flushGenerate = () => { if (regen.pending()) regen.flush(); else if (genFor !== store.get().wf) runGenerate(); };
  app.codeForDownload = () => { app.flushGenerate(); return store.get().gen ? store.get().gen.code : ''; };
  store.subscribe((s, prev) => {
    if (s.wf !== prev.wf) regen();
    if (persist && (s.wf !== prev.wf || s.view !== prev.view)) persist.schedule();
    if (s.wf !== prev.wf || s.rev !== prev.rev) syncUndo();
  });

  // ---- Editor actions
  const wf = () => store.get().wf;
  const commit = (next, opts) => store.commit(next, opts);
  const nameOf = (n) => (n ? R.displayName(n) : 'a block');
  function syncUndo() {
    $('pfbUndo').disabled = !store.canUndo();
    $('pfbRedo').disabled = !store.canRedo();
  }
  app.undo = () => { if (store.undo()) syncUndo(); };
  app.redo = () => { if (store.redo()) syncUndo(); };
  app.isPhone = isPhone;
  app.closeQuickAdd = closeQuickAdd;

  app.moveNodes = (pos, key) => { commit(ops.moveNodes(wf(), pos), { key }); };
  app.rename = (id, text) => {
    const n = ops.nodeById(wf(), id);
    const def = n && R.getBlock(n.type);
    if (!n || !def) return;
    let label = String(text || '').trim();
    if (label === def.title) label = '';
    if (label === (n.label || '')) return;
    commit(ops.setLabel(wf(), id, label));
    store.endCoalesce();
  };

  // A wire dropped on an input marked `grow` ("+ drop a value" on Add row, plot lines...) becomes
  // a new row of that block, named after what the wire brings, and the wire goes to that row's input.
  const growWire = (w, c) => {
    const tgt = ops.portAt(w, c.to, c.in, 'in');
    if (!tgt || tgt.kind !== 'input' || !tgt.port.grow || !tgt.def || typeof tgt.def.grow !== 'function') return { w, c };
    const sp = ops.portAt(w, c.from, c.out, 'out');
    const sn = ops.nodeById(w, c.from);
    const sdef = sn && R.getBlock(sn.type);
    const first = !!(sn && sp && sdef && (R.portsOf(sn).outputs[0] || {}).id === sp.port.id);
    let g = null;
    try {
      g = tgt.def.grow(R.settingsOf(tgt.node), { nodeLabel: String((sn && sn.label) || '').trim(), title: sdef ? sdef.title : '', first, port: sp ? sp.port : {} });
    } catch (e) { g = null; }
    if (!g || !g.key || !g.input) return { w, c };
    return { w: ops.setSetting(w, c.to, g.key, g.value), c: { ...c, in: g.input } };
  };

  app.connectWire = (c0) => {
    const g = growWire(wf(), c0);
    const c = g.c;
    const why = ops.wireProblem(g.w, c);
    if (why) { toast(why, { level: 'warn' }); return false; }
    const before = wf();
    const r = ops.connect(g.w, c);
    if (r.wf === before || (r.wf === g.w && !r.edge)) return false;
    commit(r.wf);
    store.endCoalesce();
    if (r.replaced.length) {
      const old = r.replaced[0];
      const flow = ops.isFlowEdge(before, old);
      const other = flow ? ops.nodeById(before, old.to) : ops.nodeById(before, old.from);
      toast(flow ? 'A step leads to one next step: the wire to ' + nameOf(other) + ' was replaced.' : 'An input takes one wire: the wire from ' + nameOf(other) + ' was replaced.', { undo: app.undo });
    }
    return true;
  };

  // A wire dropped on a port that does not take it: say why, and offer the blocks that convert.
  app.refusedWire = (c, x, y) => {
    const why = ops.wireProblem(wf(), c) || 'These two ports do not fit together.';
    const a = ops.portAt(wf(), c.from, c.out, 'out'), b = ops.portAt(wf(), c.to, c.in, 'in');
    toast(why, { level: 'warn' });
    if (!a || !b || a.stray || b.stray || a.type === 'flow' || b.type === 'flow' || !R.whyNot(a.type, b.type)) return;
    const conv = ops.convertersFor(a.type, b.type);
    if (!conv.length) return;
    openQuickAdd({
      x, y, title: 'Put a block between them',
      items: conv.map(cv => ({ main: cv.def.title, sub: (cv.input.label || cv.input.id) + ' → ' + (cv.output.label || cv.output.id), cat: cv.def.cat, kind: cv.def.kind, keywords: (cv.def.keywords || []).join(' '), cv })),
      onPick: (it) => {
        const na = ops.nodeById(wf(), c.from), nb = ops.nodeById(wf(), c.to);
        const px = na && nb ? (na.x + nb.x) / 2 : canvas.screenToFlow({ x, y }).x;
        const py = na && nb ? Math.max(na.y, nb.y) + 140 : canvas.screenToFlow({ x, y }).y;
        const r = ops.addConverter(wf(), it.cv.def.type, px, py, { nodeId: c.from, handleId: a.port.id }, { nodeId: c.to, handleId: b.port.id }, it.cv.input.id, it.cv.output.id);
        commit(r.wf, { sel: { nodes: [r.node.id], edges: [] }, lastAdded: r.node.id });
        store.endCoalesce();
      },
    });
  };

  // A wire dropped on empty canvas: the blocks that fit it.
  app.quickAddAt = (x, y, ref) => {
    const port = ops.portAt(wf(), ref.nodeId, ref.handleId, ref.side);
    if (!port || port.stray) return;
    const items = ops.blocksFor({ side: ref.side, type: port.type }).map(m => ({ main: m.def.title, sub: m.port.label && m.kind !== 'flowIn' ? 'into ' + m.port.label : (m.def.desc || '').slice(0, 70), cat: m.def.cat, kind: m.def.kind, keywords: (m.def.keywords || []).join(' '), def: m.def }));
    if (ref.side === 'out' && port.type === 'bool' && R.getBlock('flow.if')) {
      items.unshift({ main: 'Continue only if Yes', sub: 'An If after the step this comes from: Yes goes on, No skips.', kind: 'branch', cat: 'flow', first: true, special: 'ifyes' });
    }
    const p = canvas.screenToFlow({ x, y });
    openQuickAdd({
      x, y, title: port.type === 'flow' ? (ref.side === 'out' ? 'Then do' : 'Before this, do') : 'Use ' + (R.TYPES[port.type] ? R.TYPES[port.type].label.toLowerCase() : 'this value') + ' in',
      items,
      onPick: (it) => {
        let r;
        if (it.special === 'ifyes') r = ops.continueIfYes(wf(), ref.nodeId, port.port.id, p.x, p.y - 20, (store.get().gen || {}).steps);
        else r = ops.addAndWire(wf(), it.def.type, ref.side === 'out' ? p.x : p.x - 260, p.y - 24, ref);
        if (!r) return;
        commit(r.wf, { sel: { nodes: [r.node.id], edges: [] }, lastAdded: r.node.id });
        store.endCoalesce();
      },
    });
  };

  // Palette click (U15): after the selected block (or the last one added), wired.
  app.clickAdd = (type) => {
    const def = R.getBlock(type);
    if (!def) return;
    const s = store.get();
    if (def.kind === 'start' && s.wf.nodes.some(n => n.type === 'start')) { toast('This workflow already has its Start block.'); return; }
    const sizes = canvas.sizes();
    const width = (id) => ((sizes[id] && sizes[id].width) || 240);
    const selId = s.sel.nodes.length === 1 ? s.sel.nodes[0] : null;
    const sel = selId ? ops.nodeById(s.wf, selId) : null;
    const lastId = s.lastAdded && ops.nodeById(s.wf, s.lastAdded) ? s.lastAdded : null;
    const statements = s.wf.nodes.filter(n => ops.isStatement(n) && R.getBlock(n.type) && R.portsOf(n).flowOuts.length);
    const lastStatement = (lastId && ops.isStatement(ops.nodeById(s.wf, lastId)) && R.portsOf(ops.nodeById(s.wf, lastId)).flowOuts.length ? ops.nodeById(s.wf, lastId) : null)
      || statements.slice().sort((a, b) => W.compareIds(b.id, a.id))[0] || null;
    let next = s.wf, node, anchor = null;
    if (ops.isStatementDef(def) && def.kind !== 'start') {
      anchor = sel && ops.isStatement(sel) && R.getBlock(sel.type) && R.portsOf(sel).flowOuts.length ? sel : lastStatement;
      const at = anchor ? ops.freeSpot(next, anchor.x + width(anchor.id) + 70, anchor.y, sizes) : ops.freeSpot(next, canvas.viewCenter().x - 110, canvas.viewCenter().y - 50, sizes);
      ({ wf: next, node } = ops.addNode(next, type, at.x, at.y));
      if (anchor) next = ops.insertAfter(next, anchor.id, node.id);
    } else if (def.kind === 'pure') {
      const near = sel || (lastId ? ops.nodeById(s.wf, lastId) : null);
      const at = near ? ops.freeSpot(next, near.x + width(near.id) + 70, near.y + (sel ? 0 : 140), sizes) : ops.freeSpot(next, canvas.viewCenter().x - 110, canvas.viewCenter().y - 50, sizes);
      ({ wf: next, node } = ops.addNode(next, type, at.x, at.y));
      if (sel) {
        const link = ops.firstDataLink(next, sel.id, node.id);
        if (link) next = ops.connect(next, { from: sel.id, out: link[0], to: node.id, in: link[1] }).wf;
      }
    } else {
      const c = canvas.viewCenter();
      const at = ops.freeSpot(next, c.x - 110, c.y - 60, sizes);
      ({ wf: next, node } = ops.addNode(next, type, at.x, at.y));
    }
    commit(next, { sel: { nodes: [node.id], edges: [] }, lastAdded: node.id });
    store.endCoalesce();
    if (isPhone()) layout.setPalette(false);
    setTimeout(() => canvas.centerOn(node.id), 60);
  };

  // Palette drag dropped on the canvas: there, spliced into the flow wire under it if any.
  app.dropBlock = (type, pos, edgeId) => {
    const def = R.getBlock(type);
    if (!def) return;
    if (def.kind === 'start' && wf().nodes.some(n => n.type === 'start')) { toast('This workflow already has its Start block.'); return; }
    let { wf: next, node } = ops.addNode(wf(), type, pos.x, pos.y);
    if (edgeId) next = ops.spliceOnEdge(next, edgeId, node.id);
    commit(next, { sel: { nodes: [node.id], edges: [] }, lastAdded: node.id });
    store.endCoalesce();
  };
  app.spliceExisting = (nodeId, edgeId, key) => {
    const next = ops.spliceOnEdge(wf(), edgeId, nodeId);
    if (next !== wf()) commit(next, { key });
    store.endCoalesce();
  };

  app.deleteNodes = (ids) => {
    const before = wf();
    const r = ops.deleteNodes(before, ids);
    if (!r.nodes.length) {
      if (r.refused) toast('Start cannot be deleted: every workflow begins at Start.');
      return;
    }
    commit(r.wf, { sel: { nodes: [], edges: [] } });
    store.endCoalesce();
    const what = r.nodes.length === 1 ? nameOf(r.nodes[0]) : r.nodes.length + ' blocks';
    const wires = r.edges.length ? ' and ' + (r.edges.length === 1 ? 'one wire' : r.edges.length + ' wires') : '';
    toast('Deleted ' + what + wires + '.' + (r.refused ? ' Start stays: every workflow begins at Start.' : ''), { undo: app.undo });
  };
  app.deleteSelection = () => {
    const s = store.get();
    if (s.sel.nodes.length) app.deleteNodes(s.sel.nodes);
    else if (s.sel.edges.length) {
      commit(ops.removeEdges(s.wf, s.sel.edges), { sel: { nodes: [], edges: [] } });
      store.endCoalesce();
      toast(s.sel.edges.length === 1 ? 'Deleted the wire.' : 'Deleted ' + s.sel.edges.length + ' wires.', { undo: app.undo });
    }
  };
  app.copyFragment = (ids) => ops.copyFragment(wf(), ids);
  app.paste = (frag, off = 40) => {
    const r = ops.pasteFragment(wf(), frag, off, off);
    if (!r.ids.length) { if (r.skippedStart) toast('Start is not pasted: a workflow has one Start.'); return; }
    commit(r.wf, { sel: { nodes: r.ids, edges: [] }, lastAdded: r.ids[r.ids.length - 1] });
    store.endCoalesce();
    if (r.skippedStart) toast('Pasted ' + r.ids.length + ' blocks. Start is not pasted: a workflow has one Start.');
  };
  app.duplicate = (ids) => {
    const r = ops.duplicate(wf(), ids, 48, 48);
    if (!r.ids.length) { toast('Start cannot be duplicated: a workflow has one Start.'); return; }
    commit(r.wf, { sel: { nodes: r.ids, edges: [] }, lastAdded: r.ids[r.ids.length - 1] });
    store.endCoalesce();
  };
  app.addStart = () => {
    const r = ops.addStart(wf());
    if (!r.node) return;
    commit(r.wf, { sel: { nodes: [r.node.id], edges: [] } });
    store.endCoalesce();
    setTimeout(() => canvas.centerOn(r.node.id), 60);
  };
  app.applyFix = (op) => {
    if (!op) return;
    if (op.op === 'select' && op.nodeId) app.focusNode(op.nodeId);
    else if (op.op === 'removeEdge' && op.edgeId) { commit(ops.removeEdges(wf(), [op.edgeId])); store.endCoalesce(); toast('Removed the wire.', { undo: app.undo }); }
    else if (op.op === 'moveToDone' && op.edgeId && op.loopId) {
      const next = ops.moveToDone(wf(), op.edgeId, op.loopId);
      if (next !== wf()) { commit(next); store.endCoalesce(); toast('Moved it to After all passes.', { undo: app.undo }); }
    } else if (op.op === 'addStart') app.addStart();
  };
  app.clear = () => {
    const w = wf();
    if (w.nodes.every(n => n.type === 'start') && !w.edges.length) return;
    if (!confirm('Clear the whole canvas? Start keeps its settings, and Undo brings the rest back.')) return;
    commit({ ...w, nodes: w.nodes.filter(n => n.type === 'start').slice(0, 1), edges: [] }, { sel: { nodes: [], edges: [] } });
    store.endCoalesce();
    toast('Cleared the canvas.', { undo: app.undo });
  };

  // Replace the canvas (template, Open, the tour): one undo step and a toast with Undo.
  app.replaceWorkflow = (next, opts = {}) => {
    const before = wf();
    commit(next, { sel: { nodes: [], edges: [] }, lastAdded: null });
    store.endCoalesce();
    if (opts.saved) store.markSaved();
    const v = next.view;
    store.set({ view: v && Number.isFinite(v.zoom) ? v : { x: 0, y: 0, zoom: 1 } });
    if (v && (v.x || v.y || v.zoom !== 1)) canvas.setViewport(v);
    else setTimeout(() => canvas.fitView(), 80);
    if (!opts.quiet) {
      toast('Replaced "' + (before.name || 'the workflow') + '" with "' + (next.name || opts.what || 'the new one') + '".', { undo: app.undo });
      for (const n of (opts.notes || [])) if (n && n.msg && n.level !== 'info') toast(n.msg, { level: n.level === 'error' ? 'error' : 'warn', ms: 9000 });
      for (const n of (opts.notes || [])) if (n && n.msg && n.level === 'info') toast(n.msg, { ms: 7000 });
    }
  };
  app.openText = (text, filename) => {
    const { wf: next, notes } = W.loadWorkflow(text);
    if (!next) { toast((notes[0] && notes[0].msg) || ('Could not open ' + filename + '.'), { level: 'error', ms: 9000 }); return false; }
    app.replaceWorkflow(next, { what: filename, notes, saved: true });
    return true;
  };

  app.setView = (vp) => {
    const v = store.get().view;
    if (v && v.x === vp.x && v.y === vp.y && v.zoom === vp.zoom) return;
    store.set({ view: { x: vp.x, y: vp.y, zoom: vp.zoom } });
  };
  app.openTab = (name) => layout.openTab(name);
  app.openSettings = (id) => {
    store.select([id], []);
    layout.openTab('settings');
    if (isPhone()) layout.setSheet(true);
  };
  app.focusNode = (id) => {
    if (!ops.nodeById(wf(), id)) return;
    store.select([id], []);
    canvas.centerOn(id);
  };
  app.seePython = (id) => python.seePython(id);
  let canvasReadyResolve;
  const canvasReadyP = new Promise(r => { canvasReadyResolve = r; });
  app.canvasReady = () => canvasReadyResolve();

  // ---- Mount
  const layout = mountLayout(app);
  app.safeArea = () => layout.safeArea();
  const canvas = mountCanvas(app);
  app.canvas = canvas;
  mountPalette(app);
  mountInspector(app);
  const python = mountPython(app);
  mountProblems(app);
  mountFiles(app);
  const templates = mountTemplates(app);
  app.templates = templates;
  mountKeyboard(app);
  syncUndo();
  $('pfbUndo').addEventListener('click', app.undo);
  $('pfbRedo').addEventListener('click', app.redo);
  $('pfbClear').addEventListener('click', app.clear);
  $('pfbFit').addEventListener('click', () => canvas.fitView());
  $('pfbZoomIn').addEventListener('click', () => canvas.zoomIn());
  $('pfbZoomOut').addEventListener('click', () => canvas.zoomOut());
  if (!canvas.ok && !window.ReactFlow) canvasReadyResolve();
  for (const n of restoreNotes) toast(n.msg, { level: 'warn', ms: 9000 });

  // ---- The first code, once the runtime is in.
  runtimeP.then(rt => {
    runtime = rt;
    if (!Object.keys(rt).length) showAlert('<strong>The Python runtime did not load</strong>, so the script cannot be written. Check your connection and reload the page.');
    runGenerate();
  });

  // ---- For tour.js and the tests
  const api = {
    app, store, ops, registry: R, workflow: W,
    ready: true,
    failed: failed.slice(),
    canvasReady: canvasReadyP,
    runtimeReady: runtimeP,
    templatesReady: templates.ready,
    getWorkflow: () => W.serialize({ ...store.get().wf, view: store.get().view }),
    snapshot: () => ({ wf: store.get().wf, view: store.get().view, sel: store.get().sel }),
    restore: (snap) => {
      if (!snap || !snap.wf) return;
      app.replaceWorkflow(snap.wf, { quiet: true });
      if (snap.view) { store.set({ view: snap.view }); canvas.setViewport(snap.view); }
    },
    loadWorkflowObject: (obj, opts = {}) => {
      const { wf: next, notes } = W.loadWorkflow(obj);
      if (!next) return false;
      app.replaceWorkflow(next, { quiet: !!opts.quiet, notes });
      return true;
    },
    loadTemplate: (id, opts) => templates.load(id, opts),
    templates: () => templates.list(),
    showStarter: (on) => templates.showStarter(on),
    select: (ids) => store.select(ids || [], []),
    openTab: (n) => layout.openTab(n),
    openSettings: (id) => app.openSettings(id),
    focusNode: (id) => app.focusNode(id),
    fitView: () => canvas.fitView(),
    isPhone: () => isPhone(),
    setPalette: (on) => layout.setPalette(on),
    setSheet: (on) => layout.setSheet(on),
    flushGenerate: () => app.flushGenerate(),
    // Nothing worth keeping: only a Start block with its defaults (the tour leaves its demo then).
    isBlank: () => {
      const w = store.get().wf;
      if (w.edges.length || w.nodes.length !== 1 || w.nodes[0].type !== 'start' || (w.nodes[0].label || '').trim()) return false;
      if (w.name && w.name !== 'My workflow') return false;
      const fresh = W.serialize(W.emptyWorkflow()).nodes[0].s;
      return JSON.stringify(W.serialize({ ...w, nodes: [w.nodes[0]] }).nodes[0].s) === JSON.stringify(fresh) && !(w.nodes[0].pin || []).length;
    },
  };
  window.PFB = api;
  try { window.dispatchEvent(new CustomEvent('pfb:ready', { detail: api })); } catch (e) { /* old browsers */ }
  return api;
}
