// The canvas (DESIGN 1, 8): React Flow 12, vendored (window.React, ReactDOM, ReactFlow), drawn
// from the store and changing it only through the editor's actions, so undo, the code and the
// mini cache all see one workflow. React draws only this: palette, inspector, Python, Problems
// and the quick-add list are plain DOM.
//
// One memoised node component draws every block type from its definition: the category tint,
// the flow input (an arrow-shaped port in the header row) and flow outputs (right edge, with
// labels), data inputs on the left and outputs on the right with label and unit, coloured by
// type, "= value" beside an unwired input that has a fallback, the "ends" caption beside an
// unwired flow output, the step number, a problem badge and error border, the summary line, a
// mock preview of what a graph or table block makes (previews.js), the Missing block look, and
// notes as sticky notes. Behind the blocks, each loop's body is drawn as one dashed outline
// round its blocks, the loop's name on a tab (loopFrames, frames.js).
//
// Gotchas kept from the PoC (notes/reactflow-poc.md): nodeTypes built once; never call
// updateNodeInternals on mount (it breaks the first fitView), only when a node's handles change;
// every control in a node is `nodrag nopan`; onError is passed because the build is silent;
// onMoveStart blurs a focused select so a dropdown.js list never floats away from its field.
// If any vendored file failed, nothing throws: the canvas says so and the rest works.

import { getBlock, TYPES, canConnect } from '../core/registry.js';
import { settingsOf, summaryOf, displayName } from '../core/registry.js';
import * as ops from './ops.js';
import { fallbackText, inputNeed } from './inspector.js';
import { blockIcon } from './icons.js';
import { frameShape } from './frames.js';
import { previewSpec, renderPreview } from './previews.js';
import { $, esc, tipText, TIP_MAX, icon, isPhone } from './dom.js';

// A port's tip (the shared tooltip reads it as HTML); a mandatory input leads with a chip.
const typeTip = (t, extra, mandatory) => {
  const T = TYPES[t];
  const chip = mandatory ? '<span class="pfb-tip-chip">Mandatory</span> ' : '';
  return chip + esc(tipText((T ? T.label + ': ' + T.words : 'A port that is gone from this block.') + (extra ? ' ' + extra : ''), TIP_MAX - 4 - (mandatory ? 10 : 0)));
};
const portLabel = (p) => (p.label || p.id) + (p.unit ? ' (' + p.unit + ')' : '');

// The padding for fitView: the free part of the screen between the floating panels, or a plain
// 20 % when the layout cannot say.
function fitPadFor(app) {
  try { const p = app.safeArea && app.safeArea(); if (p) return p; } catch (err) { /* fall through */ }
  return 0.2;
}

export function mountCanvas(app) {
  const fitPad = () => fitPadFor(app);
  const store = app.store;
  const host = $('pfbFlow'), section = $('pfbCanvas'), msg = $('pfbCanvasMsg');
  const api = {
    ok: false, rf: null,
    fitView() {}, zoomIn() {}, zoomOut() {}, centerOn() {}, setViewport() {},
    sizes: () => measuredRef.current,
    screenToFlow: (p) => p,
    viewCenter: () => ({ x: 240, y: 200 }),
    edgeAt,
  };
  const measuredRef = { current: {} };
  const fail = (why) => {
    if (msg) msg.hidden = false;
    if (host) host.hidden = true;
    if (why) console.warn('[Builder] canvas: ' + why);
    api.ok = false;
  };
  const RF = window.ReactFlow, React = window.React, ReactDOM = window.ReactDOM;
  if (!host || !React || !ReactDOM || !RF || !RF.ReactFlow || !RF.ReactFlowProvider || typeof ReactDOM.createRoot !== 'function') {
    fail();
    return api;
  }
  const h = React.createElement;

  // ---- Wire-highlight while dragging: one style rule names the port types that fit.
  const connStyle = document.createElement('style');
  connStyle.id = 'pfbConnStyle';
  document.head.appendChild(connStyle);
  const hotStyle = document.createElement('style');
  hotStyle.id = 'pfbHotStyle';
  document.head.appendChild(hotStyle);
  function setConnecting(c) {
    section.classList.toggle('pfb-connecting', !!c);
    if (!c) { connStyle.textContent = ''; return; }
    const ok = Object.keys(TYPES).filter(t => (c.side === 'out' ? canConnect(c.type, t) : canConnect(t, c.type)));
    const side = c.side === 'out' ? 'target' : 'source';
    connStyle.textContent = ok.length
      ? `.pfb-connecting .react-flow__handle.pfb-h.${side}:is(${ok.map(t => '[data-pt="' + t + '"]').join(',')}){opacity:1;box-shadow:0 0 0 4px var(--pfb-glow)}`
      : '';
  }
  function setHotEdge(id) {
    hotStyle.textContent = id ? `.react-flow__edge[data-id="${CSS.escape(id)}"] .react-flow__edge-path{stroke:var(--accent)!important;stroke-width:5px!important}` : '';
  }
  // The flow wire under a screen point, if any (for splicing a dropped step into it).
  function edgeAt(x, y, flowOnly = true) {
    let els = [];
    try { els = document.elementsFromPoint(x, y); } catch (e) { return null; }
    for (const n of els) {
      const g = n.closest && n.closest('.react-flow__edge');
      if (g && g.getAttribute('data-id')) {
        const id = g.getAttribute('data-id');
        const e = store.get().wf.edges.find(z => z.id === id);
        if (e && (!flowOnly || ops.isFlowEdge(store.get().wf, e))) return id;
      }
    }
    return null;
  }

  // ---- Decorations from the workflow and the last generate(), memoised per node so a block's
  // drawing only changes when something it shows changed.
  const decoCache = new Map();
  let decoMemo = { wf: null, gen: null, measured: null, map: new Map(), errEdges: new Set() };
  function decorations(s, measured) {
    if (decoMemo.wf === s.wf && decoMemo.gen === s.gen && decoMemo.measured === measured) return decoMemo;
    const gen = s.gen || {};
    const frames = loopFrames(s.wf, gen, {}, measured);
    const probs = new Map();
    const errEdges = new Set();
    for (const p of gen.problems || []) {
      if (p.nodeId) { if (!probs.has(p.nodeId)) probs.set(p.nodeId, []); probs.get(p.nodeId).push(p); }
      if (p.edgeId && p.level === 'error') errEdges.add(p.edgeId);
    }
    const map = new Map();
    for (const n of s.wf.nodes) {
      const def = getBlock(n.type);
      const ports = ops.nodePorts(s.wf, n);
      const wiredIn = new Set(), wiredOut = new Set();
      for (const e of s.wf.edges) {
        if (e.to === n.id) wiredIn.add(ops.handleIdOf(s.wf, n.id, e.in, 'in'));
        if (e.from === n.id) wiredOut.add(ops.handleIdOf(s.wf, n.id, e.out, 'out'));
      }
      const ends = {};
      for (const o of ports.flowOuts) {
        const k = n.id + ':' + o.id;
        if (!wiredOut.has(o.id) && gen.ends && gen.ends[k]) ends[o.id] = gen.ends[k];
      }
      const fb = {};
      for (const p of ports.inputs) if (!wiredIn.has(p.id) && p.fallback) fb[p.id] = fallbackText(n, p);
      const ps = probs.get(n.id) || [];
      const level = ps.some(p => p.level === 'error') ? 'error' : ps.some(p => p.level === 'warning') ? 'warning' : ps.some(p => p.level === 'todo') ? 'todo' : '';
      const reg = (gen.regions && gen.regions[n.id]) || [];
      // The frames say which loop a block runs in; a block that only sits inside a frame it does
      // not run under keeps a chip saying where it does run.
      const inside = frames.find(F => !F.members.has(n.id) && F.id !== n.id && titleIn(rectOf(n, {}, measured), F));
      const chain = reg.map(r => r.label).join(' › ');
      const needOf = (p) => {
        const x = def && !p.stray ? inputNeed(n, p, wiredIn.has(p.id)) : { required: false, missing: false };
        return { mandatory: x.required, missing: x.missing };
      };
      const d = {
        kind: def ? def.kind : 'missing', type: n.type, cat: def ? def.cat : '', title: def ? def.title : 'Missing block',
        name: def ? displayName(n) : 'Missing block', summary: def ? summaryOf(n, s.wf) : String(n.type),
        missing: !def,
        ports: {
          flowIn: !!ports.flowIn,
          flowOuts: ports.flowOuts.map(p => ({ id: p.id, label: p.label || '' })),
          inputs: ports.inputs.map(p => ({ id: p.id, label: p.label || p.id, unit: p.unit || '', type: TYPES[p.type] ? p.type : 'any', stray: !!p.stray, required: !!p.required, tip: p.tip || '', ...needOf(p) })),
          outputs: ports.outputs.map(p => ({ id: p.id, label: p.label || p.id, unit: p.unit || '', type: TYPES[p.type] ? p.type : 'any', stray: !!p.stray, tip: p.tip || '' })),
        },
        wiredIn: [...wiredIn].sort(), ends, fb, level,
        msgs: ps.filter(p => p.level === level).map(p => p.msg),
        step: gen.steps && gen.steps[n.id] !== undefined ? gen.steps[n.id] : null,
        chip: !inside ? '' : reg.length ? '↻ ' + chain : 'Not in ↻ ' + inside.label,
        chipTip: !inside ? '' : reg.length ? 'Runs on each ' + (reg[reg.length - 1].kind === 'callback' ? 'try' : 'pass') + ' of ' + chain : 'Drawn inside the frame of ' + inside.label + ', but it does not run on its ' + (inside.kind === 'callback' ? 'tries' : 'passes'),
        text: n.type === 'note' ? String(settingsOf(n).text || '') : '',
        preview: def ? previewSpec(s.wf, gen, n) : null,
      };
      const key = JSON.stringify(d);
      const c = decoCache.get(n.id);
      if (c && c.key === key) map.set(n.id, c.deco);
      else { decoCache.set(n.id, { key, deco: d }); map.set(n.id, d); }
    }
    for (const id of [...decoCache.keys()]) if (!map.has(id)) decoCache.delete(id);
    decoMemo = { wf: s.wf, gen: s.gen, measured, map, errEdges };
    return decoMemo;
  }

  // ---- Loop frames. A loop's body (every block that runs on each pass or try: the generator's
  // regions) is drawn as one dashed, tinted outline that hugs its blocks (frames.js), with the
  // loop's name on a tab sitting on the line. An outer loop's margin is wider by a step for each
  // loop inside it, so its outline runs round the inner ones. The loop block itself stays
  // outside, its Each pass / Each try wire leading in.
  const SIZE0 = { width: 220, height: 100 };
  function rectOf(n, dragPos, measured) {
    const p = dragPos[n.id] || { x: n.x, y: n.y }, m = measured[n.id] || SIZE0;
    return { x1: p.x, y1: p.y, x2: p.x + m.width, y2: p.y + m.height };
  }
  // A block reads as part of a frame when its title sits inside it. (Its title, not its whole
  // box: the chip this decides makes the block taller, and must not undo itself.)
  const titleIn = (a, F) => F.shape.hit((a.x1 + a.x2) / 2, a.y1 + 16);
  function loopFrames(wf, gen, dragPos, measured) {
    const regions = (gen && gen.regions) || {};
    const byId = new Map(wf.nodes.map(n => [n.id, n]));
    const loops = new Map();
    for (const n of wf.nodes) {
      (regions[n.id] || []).forEach((r, depth) => {
        if (!byId.has(r.id)) return;
        if (!loops.has(r.id)) loops.set(r.id, { id: r.id, label: r.label, kind: r.kind, depth, members: new Set(), inner: 0 });
        loops.get(r.id).members.add(n.id);
      });
    }
    // How many loops deep each loop's body goes (0: no loop inside it).
    const sorted = [...loops.values()].sort((a, b) => b.depth - a.depth);
    for (const L of sorted) for (const M of sorted) if (M !== L && L.members.has(M.id)) L.inner = Math.max(L.inner, M.inner + 1);
    const frames = [];
    for (const L of sorted) {
      const shape = frameShape([...L.members].map(id => rectOf(byId.get(id), dragPos, measured)), { pad: 14 + 20 * L.inner, bridge: 160 });
      if (!shape) continue;
      const def = getBlock(byId.get(L.id).type);
      frames.push({ ...L, cat: def ? def.cat : 'flow', shape });
    }
    return frames.reverse();   // outer first, so an inner frame is drawn over its outer one
  }
  function LoopFrames({ frames, sel }) {
    return h(RF.ViewportPortal, null, h('div', { className: 'pfb-frames', 'aria-hidden': 'true' }, frames.map(F => {
      const b = F.shape.box, w = b.x2 - b.x1, ht = b.y2 - b.y1;
      const each = F.kind === 'callback' ? 'Each try' : 'Each pass';
      const tip = 'These blocks run on each ' + (F.kind === 'callback' ? 'try' : 'pass') + ' of ' + F.label + '. Click to select it.';
      return h('div', {
        key: F.id, className: 'pfb-frame' + (sel.has(F.id) ? ' is-sel' : ''), 'data-loop': F.id,
        style: { transform: `translate(${b.x1}px, ${b.y1}px)`, width: w + 'px', height: ht + 'px', '--cat': 'var(--cat-' + F.cat + ')' },
      },
      h('svg', { className: 'pfb-frame-line', width: w, height: ht, viewBox: `${b.x1} ${b.y1} ${w} ${ht}` }, h('path', { d: F.shape.d })),
      F.shape.tabs.map((t, i) => h('span', {
        key: i, className: 'pfb-frame-tab', title: tip, onClick: () => store.select([F.id], []),
        style: { left: (t.x - b.x1 + 14) + 'px', top: (t.y - b.y1) + 'px' },
      }, h('span', { className: 'pfb-frame-ico' }, '↻'), h('span', null, each), h('span', { className: 'pfb-frame-sep' }, '·'), h('span', { className: 'pfb-frame-name' }, F.label))));
    })));
  }

  const nodeCache = new Map();
  function rfNodes(s, deco, dragPos, measured) {
    const sel = new Set(s.sel.nodes);
    const out = s.wf.nodes.map(n => {
      const d = deco.map.get(n.id);
      const pos = dragPos[n.id];
      const m = measured[n.id];
      const selected = sel.has(n.id);
      const c = nodeCache.get(n.id);
      if (c && c.n === n && c.d === d && c.pos === pos && c.m === m && c.selected === selected) return c.rf;
      const rf = { id: n.id, type: 'pfb', position: pos || { x: n.x, y: n.y }, data: { node: n, deco: d }, selected };
      if (m) rf.measured = m;
      if (pos) rf.dragging = true;
      if (d.kind === 'note') rf.className = 'pfb-rf-note';
      nodeCache.set(n.id, { n, d, pos, m, selected, rf });
      return rf;
    });
    return out;
  }

  const MARKER = { type: (RF.MarkerType && RF.MarkerType.ArrowClosed) || 'arrowclosed', width: 18, height: 18, color: 'currentColor' };
  const edgeCache = new Map();
  function rfEdges(s, deco) {
    const sel = new Set(s.sel.edges);
    return s.wf.edges.map(e => {
      const a = ops.portAt(s.wf, e.from, e.out, 'out'), b = ops.portAt(s.wf, e.to, e.in, 'in');
      const flow = !!b && b.kind === 'flowIn';
      const t = flow ? 'flow' : (a && a.type !== 'any' ? a.type : (b ? b.type : 'any'));
      const stray = (a && a.stray) || (b && b.stray);
      const cls = (flow ? 'pfb-e-flow' : 'pfb-e-data pfb-t-' + t) + (deco.errEdges.has(e.id) ? ' pfb-e-err' : '') + (stray ? ' pfb-e-stray' : '');
      const sh = a ? a.port.id : e.out, th = b ? b.port.id : e.in;
      const selected = sel.has(e.id);
      const key = [e.id, e.from, sh, e.to, th, cls, selected].join('|');
      const c = edgeCache.get(e.id);
      if (c && c.key === key) return c.rf;
      const rf = { id: e.id, source: e.from, sourceHandle: sh, target: e.to, targetHandle: th, className: cls, selected, interactionWidth: 18, zIndex: flow ? 0 : 1 };
      if (flow) rf.markerEnd = MARKER;
      edgeCache.set(e.id, { key, rf });
      return rf;
    });
  }

  // ---- The block component
  const Handle = RF.Handle, Pos = RF.Position;
  function H(type, position, id, cls, pt, tip) {
    return h(Handle, { key: type + ':' + id, type, position, id, className: 'pfb-h ' + cls, 'data-pt': pt, 'data-tip': tip, isConnectable: pt !== 'stray' });
  }
  const flowTip = typeTip('flow');

  // The phone toolbar over the selected block; under it when the block sits at the top of the
  // canvas, where a toolbar above would be cut off.
  // It starts at the block's left edge (so it stays on screen when the block runs off the right
  // side), or ends at its right edge when the block's left edge is off screen.
  const selTransform = (st) => st.transform.join(',');
  function NodeTools({ id, x, y }) {
    const t = RF.useStore(selTransform).split(',').map(Number);
    const below = y * t[2] + t[1] < 56;
    const align = x * t[2] + t[0] < 8 ? 'end' : 'start';
    const btn = (iconName, label, onClick, cls) => h('button', { key: label, type: 'button', className: 'btn-bare nodrag nopan ' + (cls || ''), title: label, 'aria-label': label, onClick, dangerouslySetInnerHTML: { __html: icon(iconName) } });
    return h(RF.NodeToolbar, { isVisible: true, position: below ? Pos.Bottom : Pos.Top, align, className: 'pfb-ntb', offset: 8 },
      h('button', { key: 's', type: 'button', className: 'btn-secondary btn-sm nodrag nopan', onClick: () => app.openSettings(id) }, 'Settings'),
      btn('duplicate', 'Duplicate this block', () => app.duplicate([id])),
      btn('trash', 'Delete this block', () => app.deleteNodes([id]), 'is-delete'));
  }

  const BlockNode = React.memo(function BlockNode(props) {
    const { id, data, selected } = props;
    const d = data.deco;
    const P = d.ports;
    const uni = RF.useUpdateNodeInternals();
    const first = React.useRef(true);
    const sig = (P.flowIn ? 'i' : '') + '|' + P.flowOuts.map(o => o.id + (o.label ? '+' : '')).join(',') + '|' + P.inputs.map(p => p.id).join(',') + '|' + P.outputs.map(p => p.id).join(',') + '|' + Object.keys(d.ends).join(',') + '|' + (d.summary ? 1 : 0) + (d.chip ? 1 : 0);
    React.useEffect(() => { if (first.current) { first.current = false; return; } uni(id); }, [sig]);
    const [editing, setEditing] = React.useState(false);
    const cancel = React.useRef(false);
    const phone = React.useContext(PhoneCtx);
    const tools = selected && phone && d.kind !== 'start' ? h(NodeTools, { id, x: props.positionAbsoluteX || 0, y: props.positionAbsoluteY || 0 }) : null;

    if (d.kind === 'note') {
      return h('div', { className: 'pfb-note' + (selected ? ' is-sel' : '') },
        tools,
        h('div', { className: 'pfb-note-head' }, h('span', { className: 'pfb-n-glyph', dangerouslySetInnerHTML: { __html: blockIcon('note', 'note') } }), h('span', { className: 'pfb-n-title' }, d.name)),
        h('div', { className: 'pfb-note-text nowheel' }, d.text || 'Double-click to write a note.'));
    }

    const titleEl = editing
      ? h('input', {
          className: 'nodrag nopan pfb-n-rename', defaultValue: d.name, autoFocus: true, 'aria-label': 'Name on the canvas',
          onKeyDown: (e) => { e.stopPropagation(); if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { cancel.current = true; e.currentTarget.blur(); } },
          onBlur: (e) => { if (!cancel.current) app.rename(id, e.currentTarget.value); cancel.current = false; setEditing(false); },
          onFocus: (e) => e.currentTarget.select(),
        })
      : h('span', { className: 'pfb-n-title', title: 'Double-click to rename', onDoubleClick: (e) => { if (d.missing) return; e.stopPropagation(); setEditing(true); } }, d.name);

    const headOut = P.flowOuts.length === 1 && !P.flowOuts[0].label ? P.flowOuts[0] : null;
    const badge = d.level && d.msgs.length
      ? h('span', { className: 'pfb-n-badge pfb-lv-' + d.level, 'data-tip': esc(tipText(d.msgs.join(' '))), role: 'img', 'aria-label': d.level === 'todo' ? 'To do' : 'Problem' }, d.level === 'todo' ? 'To do' : '⚠')
      : null;
    const head = h('div', { className: 'pfb-n-head' },
      P.flowIn ? H('target', Pos.Left, 'in', 'pfb-h-flow', 'flow', flowTip) : null,
      h('span', { className: 'pfb-n-glyph', dangerouslySetInnerHTML: { __html: blockIcon(d.missing ? '' : d.type, d.missing ? 'missing' : d.kind) } }),
      titleEl,
      d.step ? h('span', { className: 'pfb-n-step', title: 'Step ' + d.step + ' in the script' }, String(d.step)) : null,
      badge,
      headOut ? H('source', Pos.Right, headOut.id, 'pfb-h-flow', 'flow', flowTip) : null);

    const kids = [tools, head];
    if (headOut && d.ends[headOut.id]) kids.push(h('div', { key: 'he', className: 'pfb-n-endrow' }, h('span', { className: 'pfb-end' }, d.ends[headOut.id])));
    if (d.summary) kids.push(h('div', { key: 'sum', className: 'pfb-n-sum' }, d.summary));
    if (!headOut && P.flowOuts.length) {
      kids.push(h('div', { key: 'fo', className: 'pfb-n-flows' }, P.flowOuts.map(o => h('div', { key: o.id, className: 'pfb-n-fout' },
        h('span', { className: 'pfb-n-ftext' }, h('span', { className: 'pfb-n-flabel' }, o.label || 'Next'), d.ends[o.id] ? h('span', { className: 'pfb-end' }, d.ends[o.id]) : null),
        H('source', Pos.Right, o.id, 'pfb-h-flow', 'flow', flowTip)))));
    }
    const nrows = Math.max(P.inputs.length, P.outputs.length);
    if (nrows) {
      const rows = [];
      for (let i = 0; i < nrows; i++) {
        const p = P.inputs[i], q = P.outputs[i];
        const wired = p && d.wiredIn.includes(p.id);
        rows.push(h('div', { key: i, className: 'pfb-n-row' },
          p ? h('div', { className: 'pfb-n-in' + (p.stray ? ' is-stray' : '') + (p.mandatory ? ' is-req' : '') + (p.missing ? ' is-missing' : '') },
            H('target', Pos.Left, p.id, 'pfb-h-data pfb-t-' + (p.stray ? 'any' : p.type) + (p.mandatory ? ' is-req' : ''), p.stray ? 'stray' : p.type, p.stray ? typeTip('none') : typeTip(p.type, p.tip, p.mandatory)),
            h('span', { className: 'pfb-n-plab', title: portLabel(p) }, portLabel(p)),
            !wired && d.fb[p.id] !== undefined ? h('span', { className: 'pfb-n-fb', title: String(d.fb[p.id]) }, '= ' + d.fb[p.id]) : null,
            !wired && p.required && d.fb[p.id] === undefined ? h('span', { className: 'pfb-n-need' }, 'needs a value') : null) : h('div', { className: 'pfb-n-in pfb-n-empty' }),
          q ? h('div', { className: 'pfb-n-out' + (q.stray ? ' is-stray' : '') },
            h('span', { className: 'pfb-n-plab', title: portLabel(q) }, portLabel(q)),
            H('source', Pos.Right, q.id, 'pfb-h-data pfb-t-' + (q.stray ? 'any' : q.type), q.stray ? 'stray' : q.type, q.stray ? typeTip('none') : typeTip(q.type, q.tip))) : h('div', { className: 'pfb-n-out pfb-n-empty' })));
      }
      kids.push(h('div', { key: 'io', className: 'pfb-n-io' }, rows));
    }
    // What the block makes, drawn with mock values and the reader's names (previews.js).
    if (d.preview) kids.push(h('div', { key: 'pv', className: 'pfb-pv', title: 'What it makes: your names, mock values' }, renderPreview(h, d.preview)));
    if (d.chip) kids.push(h('div', { key: 'chip', className: 'pfb-n-chip', title: d.chipTip }, d.chip));
    if (d.missing) kids.push(h('div', { key: 'miss', className: 'pfb-n-miss' }, 'Not in this version of the Builder: kept, but it does not run.'));
    const cls = 'pfb-node pfb-k-' + d.kind + (d.missing ? ' pfb-missing' : '') + (d.level ? ' pfb-lv-' + d.level : '') + (selected ? ' is-sel' : '');
    return h('div', { className: cls, style: { '--cat': d.cat ? 'var(--cat-' + d.cat + ')' : 'var(--muted)' } }, kids);
  });
  const nodeTypes = { pfb: BlockNode };
  const PhoneCtx = React.createContext(false);

  // ---- The canvas component
  let dragKey = null, dragSeq = 0;
  function Flow() {
    const s = React.useSyncExternalStore(store.subscribe, store.get);
    const rf = RF.useReactFlow();
    const [dragPos, setDragPos] = React.useState({});
    const [measured, setMeasured] = React.useState({});
    const [phone, setPhone] = React.useState(isPhone());
    const dragRef = React.useRef(dragPos);
    dragRef.current = dragPos;
    measuredRef.current = measured;
    React.useEffect(() => {
      const mq = window.matchMedia('(max-width: 767px)');
      const on = () => setPhone(mq.matches);
      if (mq.addEventListener) mq.addEventListener('change', on); else mq.addListener(on);
      return () => { if (mq.removeEventListener) mq.removeEventListener('change', on); else mq.removeListener(on); };
    }, []);
    const deco = decorations(s, measured);
    const nodes = React.useMemo(() => rfNodes(s, deco, dragPos, measured), [s.wf, s.sel, deco, dragPos, measured]);
    const frames = React.useMemo(() => loopFrames(s.wf, s.gen, dragPos, measured), [s.wf, s.gen, dragPos, measured]);
    const selSet = React.useMemo(() => new Set(s.sel.nodes), [s.sel]);
    const edges = React.useMemo(() => rfEdges(s, deco), [s.wf, s.sel, deco]);

    const onNodesChange = React.useCallback((changes) => {
      let dims = null, drag = null, ends = null, selCh = false;
      for (const c of changes) {
        if (c.type === 'dimensions' && c.dimensions) (dims = dims || {})[c.id] = { width: c.dimensions.width, height: c.dimensions.height };
        else if (c.type === 'position') {
          if (c.dragging) { if (c.position) (drag = drag || {})[c.id] = c.position; }
          else (ends = ends || {})[c.id] = c.position || dragRef.current[c.id] || null;
        } else if (c.type === 'select') selCh = true;
      }
      if (dims) {
        setMeasured(m => {
          let changed = false; const next = { ...m };
          for (const [id, dd] of Object.entries(dims)) { const o = m[id]; if (!o || o.width !== dd.width || o.height !== dd.height) { next[id] = dd; changed = true; } }
          return changed ? next : m;
        });
      }
      if (drag) setDragPos(p => ({ ...p, ...drag }));
      if (ends) {
        const pos = {};
        let wasDrag = false;
        for (const [id, p] of Object.entries(ends)) { if (p) pos[id] = p; if (dragRef.current[id]) wasDrag = true; }
        dragKey = wasDrag ? 'drag:' + (++dragSeq) : 'keys:' + Object.keys(pos).sort().join(',');
        app.moveNodes(pos, dragKey);
        if (wasDrag) store.endCoalesce();
        setDragPos(p => { const n = { ...p }; for (const id of Object.keys(ends)) delete n[id]; return n; });
      }
      if (selCh) {
        const cur = new Set(store.get().sel.nodes);
        for (const c of changes) if (c.type === 'select') { if (c.selected) cur.add(c.id); else cur.delete(c.id); }
        const ordered = store.get().wf.nodes.map(n => n.id).filter(x => cur.has(x));
        store.select(ordered, ordered.length ? [] : store.get().sel.edges);
      }
    }, []);
    const onEdgesChange = React.useCallback((changes) => {
      const sel = changes.filter(c => c.type === 'select');
      if (!sel.length) return;
      const cur = new Set(store.get().sel.edges);
      for (const c of sel) { if (c.selected) cur.add(c.id); else cur.delete(c.id); }
      const ordered = store.get().wf.edges.map(e => e.id).filter(x => cur.has(x));
      store.select(ordered.length ? [] : store.get().sel.nodes, ordered);
    }, []);
    const isValidConnection = React.useCallback((c) => !ops.wireProblem(store.get().wf, { from: c.source, out: c.sourceHandle, to: c.target, in: c.targetHandle }), []);
    const onConnect = React.useCallback((c) => app.connectWire({ from: c.source, out: c.sourceHandle, to: c.target, in: c.targetHandle }), []);
    const onConnectStart = React.useCallback((e, p) => {
      if (!p || !p.nodeId) return;
      const side = p.handleType === 'source' ? 'out' : 'in';
      const port = ops.portAt(store.get().wf, p.nodeId, p.handleId || 'in', side);
      setConnecting(port && !port.stray ? { side, type: port.type } : null);
    }, []);
    const onConnectEnd = React.useCallback((e, cs) => {
      setConnecting(null);
      if (!cs || cs.isValid || !cs.fromHandle) return;
      const pt = (e && e.changedTouches && e.changedTouches.length) ? e.changedTouches[0] : e;
      const from = cs.fromHandle;
      const side = from.type === 'source' ? 'out' : 'in';
      const ref = { nodeId: from.nodeId, handleId: from.id || 'in', side };
      if (cs.toHandle && cs.toHandle.nodeId) {
        const to = cs.toHandle;
        const c = side === 'out' ? { from: from.nodeId, out: from.id, to: to.nodeId, in: to.id || 'in' } : { from: to.nodeId, out: to.id, to: from.nodeId, in: from.id || 'in' };
        app.refusedWire(c, pt.clientX, pt.clientY);
        return;
      }
      const t = e && e.target;
      if (t && t.classList && t.classList.contains('react-flow__pane')) app.quickAddAt(pt.clientX, pt.clientY, ref);
    }, []);
    const onDragOver = React.useCallback((e) => {
      if (!app.dragging) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      const def = getBlock(app.dragging);
      setHotEdge(def && ops.isStatementDef(def) && def.kind !== 'start' ? edgeAt(e.clientX, e.clientY) : null);
    }, []);
    const onDragLeave = React.useCallback(() => setHotEdge(null), []);
    const onDrop = React.useCallback((e) => {
      const type = (e.dataTransfer && e.dataTransfer.getData('application/x-pfb-block')) || app.dragging;
      setHotEdge(null);
      if (!type) return;
      e.preventDefault();
      const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const def = getBlock(type);
      const edgeId = def && ops.isStatementDef(def) ? edgeAt(e.clientX, e.clientY) : null;
      app.dropBlock(type, p, edgeId);
      app.dragging = null;
    }, []);
    const onNodeDragStop = React.useCallback((e, node, many) => {
      if (!e || (many && many.length > 1)) return;
      const wf = store.get().wf;
      const n = ops.nodeById(wf, node.id);
      const def = n && getBlock(n.type);
      if (!def || !ops.isStatementDef(def) || def.kind === 'start') return;
      if (wf.edges.some(x => (x.from === n.id || x.to === n.id) && ops.isFlowEdge(wf, x))) return;
      const id = edgeAt(e.clientX, e.clientY);
      if (id) app.spliceExisting(n.id, id, dragKey);
    }, []);
    const onMoveStart = React.useCallback(() => { const a = document.activeElement; if (a && a.tagName === 'SELECT') a.blur(); }, []);
    const onMoveEnd = React.useCallback((e, vp) => { if (vp) app.setView(vp); }, []);
    const onPaneClick = React.useCallback(() => { store.select([], []); app.closeQuickAdd(); }, []);
    const onNodeDoubleClick = React.useCallback((e, n) => app.openSettings(n.id), []);
    const onInit = React.useCallback((inst) => {
      api.rf = inst;
      api.ok = true;
      const v = store.get().view;
      if (v && (v.x || v.y || v.zoom !== 1)) inst.setViewport(v);
      else setTimeout(() => api.fitView({ maxZoom: 1.1, duration: 0 }), 30);
      app.canvasReady();
    }, []);
    const onError = React.useCallback((code, m) => console.warn('[React Flow ' + code + '] ' + m), []);

    return h(PhoneCtx.Provider, { value: phone }, h(RF.ReactFlow, {
      nodes, edges, nodeTypes, colorMode: s.theme === 'light' ? 'light' : 'dark',
      onNodesChange, onEdgesChange, isValidConnection, onConnect, onConnectStart, onConnectEnd,
      onDragOver, onDragLeave, onDrop, onNodeDragStop, onMoveStart, onMoveEnd, onPaneClick, onNodeDoubleClick, onInit, onError,
      connectionMode: RF.ConnectionMode ? RF.ConnectionMode.Strict : 'strict',
      connectionRadius: phone ? 30 : 22, connectOnClick: true,
      deleteKeyCode: null, selectionKeyCode: 'Shift', multiSelectionKeyCode: ['Meta', 'Control'],
      zoomOnDoubleClick: false, snapToGrid: true, snapGrid: [ops.GRID, ops.GRID], minZoom: 0.2, maxZoom: 2,
      defaultViewport: store.get().view, nodeDragThreshold: 3, elevateEdgesOnSelect: true,
      proOptions: { hideAttribution: true }, ariaLabelConfig: undefined,
    },
    h(RF.Background, { variant: RF.BackgroundVariant ? RF.BackgroundVariant.Dots : 'dots', gap: ops.GRID, size: 1.3 }),
    RF.ViewportPortal ? h(LoopFrames, { frames, sel: selSet }) : null,
    phone ? null : h(RF.MiniMap, { pannable: true, zoomable: true, ariaLabel: 'Map of the whole workflow', nodeClassName: (n) => 'pfb-mm pfb-mm-' + ((n.data && n.data.deco && n.data.deco.cat) || 'x'), nodeBorderRadius: 4 })));
  }

  class Boundary extends React.Component {
    constructor(p) { super(p); this.state = { broken: false }; }
    static getDerivedStateFromError() { return { broken: true }; }
    componentDidCatch(err) { fail(String(err && err.message || err)); }
    render() { return this.state.broken ? null : this.props.children; }
  }

  try {
    const root = ReactDOM.createRoot(host);
    root.render(h(Boundary, null, h(RF.ReactFlowProvider, null, h(Flow))));
  } catch (e) {
    fail(String(e && e.message || e));
    return api;
  }

  // ---- What the rest of the page may ask the canvas.
  // Fit into the part of the screen the floating panels leave free (layout.safeArea()), but never
  // below a readable zoom: a workflow wider than that shows its start (the left end), centred
  // vertically, and the reader pans along it.
  api.fitView = (opts = {}) => {
    const rf = api.rf;
    if (!rf) return;
    const nodes = rf.getNodes();
    const host = $('pfbFlow');
    const RFX = window.ReactFlow || {};
    const bounds = typeof rf.getNodesBounds === 'function' ? (n) => rf.getNodesBounds(n) : (typeof RFX.getNodesBounds === 'function' ? (n) => RFX.getNodesBounds(n) : null);
    if (!nodes.length || !host || !bounds) { rf.fitView({ padding: fitPad(), maxZoom: 1.2, duration: opts.duration === undefined ? 250 : opts.duration }); return; }
    const pad = fitPad();
    const px = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
    const P = typeof pad === 'object' ? { t: px(pad.top, 40), r: px(pad.right, 40), b: px(pad.bottom, 40), l: px(pad.left, 40) } : { t: 40, r: 40, b: 40, l: 40 };
    const W = host.clientWidth, H = host.clientHeight;
    const aw = Math.max(120, W - P.l - P.r), ah = Math.max(120, H - P.t - P.b);
    const B = bounds(nodes);
    const MIN = 0.5, MAX = opts.maxZoom || 1.2;
    const zoom = Math.max(MIN, Math.min(MAX, aw / Math.max(1, B.width), ah / Math.max(1, B.height)));
    const fitsW = B.width * zoom <= aw + 1;
    const x = fitsW ? P.l + (aw - B.width * zoom) / 2 - B.x * zoom : P.l - B.x * zoom;
    const y = B.height * zoom <= ah + 1 ? P.t + (ah - B.height * zoom) / 2 - B.y * zoom : P.t - B.y * zoom;
    rf.setViewport({ x, y, zoom }, { duration: opts.duration === undefined ? 250 : opts.duration });
  };
  api.zoomIn = () => { if (api.rf) api.rf.zoomIn({ duration: 150 }); };
  api.zoomOut = () => { if (api.rf) api.rf.zoomOut({ duration: 150 }); };
  api.setViewport = (v) => { if (api.rf && v) api.rf.setViewport(v); };
  api.screenToFlow = (p) => (api.rf ? api.rf.screenToFlowPosition(p) : p);
  api.viewCenter = () => {
    const r = host.getBoundingClientRect();
    return api.rf ? api.rf.screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 }) : { x: 240, y: 200 };
  };
  api.centerOn = (id) => {
    if (!api.rf) return;
    const n = ops.nodeById(store.get().wf, id);
    if (!n) return;
    const m = measuredRef.current[id] || { width: 220, height: 100 };
    const z = Math.max(api.rf.getZoom ? api.rf.getZoom() : 1, 0.8);
    api.rf.setCenter(n.x + m.width / 2, n.y + m.height / 2, { zoom: z, duration: 300 });
  };
  api.setConnecting = setConnecting;
  return api;
}
