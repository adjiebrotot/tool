// The editor's one source of truth: the workflow, the selection, the view and what the code
// generator last said about it, plus undo / redo. React (the canvas) reads it through
// useSyncExternalStore; the plain-DOM panels subscribe to it. Every change replaces `state`
// (and the workflow object when it changed), so "did X change" is an identity check.
//
// Undo granularity (DESIGN 8): one step per drag end, per connect / disconnect, per inspector
// field (coalesced: edits made with the same `key` follow each other into one step until
// endCoalesce(), which the inspector calls on blur), per template / Open / Clear.

const MAX_HISTORY = 200;

export function createStore(init) {
  let state = {
    wf: init.wf,
    view: init.view || { x: 0, y: 0, zoom: 1 },
    sel: { nodes: [], edges: [] },
    gen: null,            // the last generate() result
    measured: {},         // node id -> { width, height } as the canvas measured it
    theme: init.theme || 'light',
    rev: 0,               // counts workflow changes (for "changed since the last save")
    savedRev: 0,
    tab: 'settings',
    held: false,          // autosave held (a block file failed to load)
    lastAdded: null,      // the block added last in this session (palette click chains after it)
    connecting: null,     // a wire being dragged: { nodeId, handleId, side, type }
  };
  const subs = new Set();
  const past = [], future = [];
  let lastKey = null;

  function emit(prev) { for (const f of [...subs]) { try { f(state, prev); } catch (e) { console.error(e); } } }
  function set(patch) {
    const prev = state;
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
    emit(prev);
  }
  function selFor(wf, sel) {
    const ids = new Set(wf.nodes.map(n => n.id)), eids = new Set(wf.edges.map(e => e.id));
    const nodes = sel.nodes.filter(i => ids.has(i)), edges = sel.edges.filter(i => eids.has(i));
    return nodes.length === sel.nodes.length && edges.length === sel.edges.length ? sel : { nodes, edges };
  }

  return {
    get: () => state,
    set,
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },

    // Change the workflow as one undo step (or fold it into the step under the same key).
    commit(wf, opts = {}) {
      if (!wf || wf === state.wf) return false;
      if (!(opts.key && opts.key === lastKey)) {
        past.push(state.wf);
        if (past.length > MAX_HISTORY) past.shift();
      }
      future.length = 0;
      lastKey = opts.key || null;
      const patch = { wf, rev: state.rev + 1, sel: opts.sel ? opts.sel : selFor(wf, state.sel) };
      if (opts.lastAdded !== undefined) patch.lastAdded = opts.lastAdded;
      set(patch);
      return true;
    },
    endCoalesce() { lastKey = null; },
    // Replace the workflow without an undo step (the cached workflow at start-up).
    reset(wf, opts = {}) {
      past.length = 0; future.length = 0; lastKey = null;
      set({ wf, rev: 0, savedRev: 0, sel: { nodes: [], edges: [] }, lastAdded: null, ...(opts.view ? { view: opts.view } : {}) });
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    undo() {
      if (!past.length) return false;
      future.push(state.wf);
      lastKey = null;
      const wf = past.pop();
      set({ wf, rev: state.rev + 1, sel: selFor(wf, state.sel) });
      return true;
    },
    redo() {
      if (!future.length) return false;
      past.push(state.wf);
      lastKey = null;
      const wf = future.pop();
      set({ wf, rev: state.rev + 1, sel: selFor(wf, state.sel) });
      return true;
    },
    select(nodes = [], edges = []) {
      const cur = state.sel;
      if (cur.nodes.length === nodes.length && cur.edges.length === edges.length &&
          nodes.every((x, i) => cur.nodes[i] === x) && edges.every((x, i) => cur.edges[i] === x)) return;
      set({ sel: { nodes: [...nodes], edges: [...edges] } });
    },
    markSaved() { set({ savedRev: state.rev }); },
  };
}
