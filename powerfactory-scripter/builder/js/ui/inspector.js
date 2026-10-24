// The Settings tab (DESIGN 8, U16): what the selected block is, its inputs (each wired input
// names its source, with "Type a value instead"), its settings, More options folded, and
// Duplicate / Delete. With nothing selected it shows the workflow's own settings (the workflow
// name, Start's settings and the graph style) and a "How it works" card. A graph block shows
// the graph style too: both open the Graph style modal (graphstyle.js).
//
// Plain DOM. Edits go straight into the workflow (no Apply); one undo step per field, closed on
// blur. The panel is redrawn only when what it shows changes shape (another block, a wire, a
// row added...) or when the workflow changed from elsewhere (undo, the canvas); a redraw puts
// the focus and the caret back where they were.

import { $, el, esc, tipText, portTip, icon, iconButton } from './dom.js';
import { getBlock, settingsOf, visibleSettings, displayName, TYPES, optionPairs } from '../core/registry.js';
import { suggestions } from '../core/workflow.js';
import * as ops from './ops.js';
import { buildField } from './fields.js';
import { glyph, KIND_WORDS } from './glyphs.js';
import { blockIcon } from './icons.js';
import { readBytes, describe, decodeSig, fileBytes, toB64, looksExcel } from './attach.js';
import { prime as primeAttrData, onLoad as onAttrData } from '../core/attrdata.js';
import { styleOf, styleName } from '../core/graphstyle.js';
import { previewSvg } from './graphpreview.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const portLabel = (p) => (p ? (p.label || p.id) + (p.unit ? ' (' + p.unit + ')' : '') : '');

export function isEmptyValue(st, v) {
  if (st.kind === 'element') return !(isObj(v) && String(v.name || '').trim());
  if (st.kind === 'file') return !(isObj(v) && String(v.name || '').trim());
  if (st.kind === 'list' || st.kind === 'schedule') return !(Array.isArray(v) && v.length);
  if (st.kind === 'number') return v === null || v === undefined || v === '';
  if (st.kind === 'bool') return false;
  return String(v === undefined || v === null ? '' : v).trim() === '';
}

export function mountInspector(app) {
  const host = $('pfbInspector');
  const store = app.store;
  const moreOpen = new Set();
  let selfEdit = false, lastShape = null, lastFull = null;

  const wf = () => store.get().wf;

  // What a block's showIf(s, cx) is told beyond its own settings: which inputs are wired, and
  // whether it sits inside a loop (the generator keeps that on gen.regions). Anything not known
  // is left out, and a block reads a missing answer as "show it".
  function wiredSet(w, node) {
    const out = new Set();
    for (const e of w.edges) if (e.to === node.id) out.add(ops.handleIdOf(w, node.id, e.in, 'in'));
    return out;
  }
  function showCtx(s, node) {
    const regions = s.gen && s.gen.regions && s.gen.regions[node.id];
    return { inLoop: Array.isArray(regions) ? regions.some(r => r.kind === 'loop') : undefined };
  }

  function edit(next, key) {
    selfEdit = true;
    try { store.commit(next, { key }); } finally { selfEdit = false; }
  }
  const done = () => store.endCoalesce();

  // ---- What the panel shows, as text, to decide whether to redraw.
  function selected(s) {
    if (s.sel.nodes.length === 1) return { node: ops.nodeById(s.wf, s.sel.nodes[0]) };
    if (s.sel.nodes.length > 1) return { many: s.sel.nodes.slice() };
    if (s.sel.edges.length === 1) return { edge: s.wf.edges.find(e => e.id === s.sel.edges[0]) || null };
    return {};
  }
  function shapeOf(s) {
    const x = selected(s);
    if (x.many) return 'many:' + x.many.join(',');
    if (x.edge) return 'edge:' + x.edge.id + ':' + x.edge.from + ':' + x.edge.to;
    const node = x.node || s.wf.nodes.find(n => n.type === 'start') || null;
    if (!node) return 'none';
    const def = getBlock(node.type);
    if (!def) return 'missing:' + node.id;
    const ports = ops.nodePorts(s.wf, node);
    const wired = ports.inputs.map(p => p.id + '=' + s.wf.edges.filter(e => e.to === node.id && ops.handleIdOf(s.wf, node.id, e.in, 'in') === p.id).map(e => e.from + '.' + e.out).join('|'));
    const sNode = settingsOf(node);
    const vis = visibleSettings(node, wiredSet(s.wf, node), showCtx(s, node)).map(st => {
      if (st.kind === 'list') return st.key + '[' + (sNode[st.key] || []).map(r => r.id).join(',') + ']';
      // The file card is redrawn whenever what was read out of the file changes, or the file
      // itself comes or goes (its bytes live beside the workflow, not in the block).
      if (st.kind === 'file') { const f = sNode[st.key] || {}; return st.key + '[' + f.name + ':' + f.sheet + ':' + (f.cols || []).length + ':' + f.rows + ':' + (ops.fileOf(s.wf, node.id) ? 1 : 0) + ']'; }
      return st.key;
    });
    const sugg = def.settings.filter(st => st.suggest && st.suggest !== 'columns').map(st => suggestions(s.wf, st.suggest).join('|'));
    return [x.node ? 'node' : 'wf', node.id, node.type, (node.pin || []).join(','), wired.join(';'), vis.join(','), [...moreOpen].join(','), sugg.join(';'), ports.missing].join('#');
  }
  function fullOf(s) {
    const x = selected(s);
    const node = x.node || (!x.many && !x.edge ? s.wf.nodes.find(n => n.type === 'start') : null);
    return shapeOf(s) + '#' + (node ? JSON.stringify([node.label, node.s]) : '') + '#' + (x.node ? '' : s.wf.name) + '#' + JSON.stringify(s.wf.graph || null);
  }

  // The reference data landed: what a block offers may have narrowed.
  onAttrData(() => { lastShape = null; lastFull = null; render(); });

  store.subscribe((s, prev) => {
    // The script is written a moment after the workflow changes, and with it the generator says
    // which loops a block sits in: a block whose choices turn on that is drawn again then.
    if (s.sel === prev.sel && s.wf === prev.wf && s.gen === prev.gen) return;
    const shape = shapeOf(s);
    if (selfEdit && shape === lastShape) { lastFull = fullOf(s); return; }
    const full = fullOf(s);
    if (!selfEdit && full === lastFull) return;
    render();
  });

  // ---- Drawing
  function render() {
    const s = store.get();
    const active = document.activeElement;
    const fid = active && host.contains(active) && active.dataset ? active.dataset.fid : null;
    const caret = fid && typeof active.selectionStart === 'number' ? [active.selectionStart, active.selectionEnd] : null;
    const scroller = host.closest('.pfb-panels');
    const scrollTop = scroller ? scroller.scrollTop : 0;
    host.textContent = '';
    const x = selected(s);
    if (x.many) host.appendChild(renderMany(x.many));
    else if (x.edge) host.appendChild(renderEdge(x.edge));
    else if (x.node) host.appendChild(renderNode(x.node));
    else host.appendChild(renderWorkflow());
    lastShape = shapeOf(s);
    lastFull = fullOf(s);
    if (fid) {
      const back = host.querySelector('[data-fid="' + CSS.escape(fid) + '"]');
      if (back) {
        back.focus({ preventScroll: true });
        if (caret && typeof back.setSelectionRange === 'function') { try { back.setSelectionRange(caret[0], caret[1]); } catch (e) { /* not a text field */ } }
      }
    }
    if (scroller && fid) scroller.scrollTop = scrollTop;
  }

  function tipIcon(text, html) {
    if (!text && !html) return null;
    return el('span', { class: 'tip-icon', 'data-tip': html || esc(tipText(text)) }, '?');
  }
  function reqMark() { return el('span', { class: 'pfb-req', text: 'Required' }); }

  function pinButton(node, st) {
    if (!node || node.type === 'start' || st.kind === 'list' || st.kind === 'schedule' || st.kind === 'file' || st.noPin) return null;
    const on = (node.pin || []).includes(st.key);
    const label = on ? 'Shown at the top of the script: click to keep it in the workflow only' : 'Put at the top of the script';
    const b = el('button', { type: 'button', class: 'btn-bare pfb-pin' + (on ? ' on' : ''), title: label, 'aria-label': label, 'aria-pressed': on ? 'true' : 'false' });
    b.innerHTML = glyph('pin', 'ico');
    b.addEventListener('click', () => { edit(ops.togglePin(wf(), node.id, st.key)); done(); });
    return b;
  }

  function kindsFor(node, st) {
    if (Array.isArray(st.kinds) && st.kinds.length) return st.kinds;
    const ports = ops.nodePorts(wf(), node);
    const p = ports.inputs.find(i => i.fallback === st.key && Array.isArray(i.kinds));
    return p ? p.kinds : null;
  }
  // The element class an attribute field suggests for: an element in the same row, then the
  // setting named by classFrom, the block's first element setting, or a single kind of an input.
  function classOf(nodeId, st, rowId, listKey) {
    const node = ops.nodeById(wf(), nodeId);
    if (!node) return '';
    const def = getBlock(node.type);
    const s = settingsOf(node);
    if (rowId && listKey) {
      const lst = def.settings.find(z => z.key === listKey);
      const row = (s[listKey] || []).find(r => r.id === rowId) || {};
      const colKey = st.classFrom || ((lst && lst.columns) || []).filter(c => c.kind === 'element').map(c => c.key)[0];
      if (colKey && isObj(row[colKey]) && row[colKey].cls) return row[colKey].cls;
      // A row that names its class in a plain column (Record: cls = "ElmTerm").
      const clsKey = colKey && typeof row[colKey] === 'string' ? colKey : 'cls';
      if (typeof row[clsKey] === 'string' && /^[A-Z][A-Za-z0-9]*$/.test(row[clsKey])) return row[clsKey];
      const col = ((lst && lst.columns) || []).find(c => c.key === colKey);
      if (col && Array.isArray(col.kinds) && col.kinds.length === 1) return col.kinds[0];
    }
    if (st.cls) return st.cls;
    const fromKey = st.classFrom || (def.settings.find(z => z.kind === 'element') || {}).key;
    if (fromKey && isObj(s[fromKey]) && s[fromKey].cls) return s[fromKey].cls;
    const objIn = ops.nodePorts(wf(), node).inputs.find(p => p.type === 'obj' && Array.isArray(p.kinds) && p.kinds.length === 1);
    if (objIn) return objIn.kinds[0];
    const elSt = def.settings.find(z => z.key === fromKey);
    if (elSt && Array.isArray(elSt.kinds) && elSt.kinds.length === 1) return elSt.kinds[0];
    return '';
  }

  // The columns a column field can name (fields.js columnField): those of the table its block
  // reads, named by the setting `columnsOf` (default 'table'), or for '@port' the table behind
  // the row wired into that input (For each item over a table). Without a table, every table's
  // columns, grouped. From the generator's `tables` (codegen.js), so they are the names the run
  // writes; a table filled from a file has columns only the file knows.
  function columnsFor(nodeId, st) {
    const s = store.get(), tables = (s.gen && s.gen.tables) || {};
    const node = ops.nodeById(s.wf, nodeId);
    if (!node) return {};
    const from = st.columnsOf || 'table';
    let name = null;
    if (from.startsWith('@')) {
      const e = s.wf.edges.find(x => x.to === node.id && ops.handleIdOf(s.wf, node.id, x.in, 'in') === from.slice(1));
      const src = e && ops.nodeById(s.wf, e.from);
      const ss = src && getBlock(src.type) ? settingsOf(src) : null;
      if (ss && ss.source === 'table') name = String(ss.table || '').trim() || 'Results';
    } else name = String(settingsOf(node)[from] || '').trim() || 'Results';
    if (name === null) {
      const items = [];
      for (const t of Object.keys(tables).sort((a, b) => a.localeCompare(b))) for (const c of tables[t].columns) items.push({ value: c, main: c, group: t });
      return { items, known: null, empty: 'No results table has columns yet: type the name as in the table.' };
    }
    const T = tables[name];
    const items = T ? T.columns.map(c => ({ value: c, main: c })) : [];
    if (!T) return { items, known: null, table: name, empty: 'No block fills the table "' + name + '" yet: add rows to it first, or type the name.' };
    // A table read from a file knows its columns once the file is attached (the page read its
    // header row); without the file it still only knows what the header row said.
    if (T.file && !T.read) return { items, known: null, table: name, empty: '"' + name + '" is read from a file: attach it on Read table from file, or type a column name exactly as in its header row.' };
    return { items, known: T.columns, table: name, empty: '"' + name + '" has no columns yet.' };
  }

  // An attached data file: reading it, re-reading it when a decode option changed, and taking
  // it off again. Every one of these commits in one step (the setting and the file together),
  // so undo puts the block back as it was.
  function fileSpecFor(node, st) {
    const sheetKey = st.sheetKey || 'sheet';
    const optsOf = (s, sheet) => ({
      sheet: sheet !== undefined ? sheet : String(s[sheetKey] || ''),
      layout: String(s[st.layoutKey || 'layout'] || 'rows'),
      header: Number(s[st.headerKey || 'header'] || 1),
      decimalComma: !!s[st.commaKey || 'decimalComma'],
    });
    const store2 = store;
    async function apply(name, bytes, mime, sheet) {
      const s = settingsOf(ops.nodeById(wf(), node.id) || node);
      const opts = optsOf(s, sheet);
      let meta;
      try { meta = await describe(name, bytes, opts); } catch (e) { return { ok: false, error: `${name} could not be read: ${(e && e.message) || e}` }; }
      let next = ops.setSetting(wf(), node.id, st.key, meta);
      next = ops.setFile(next, node.id, { name, mime, b64: toB64(bytes) });
      // The file's own name is what the script reads, so it also fills the path setting the
      // generator already uses: the two never disagree.
      if (st.pathKey) next = ops.setSetting(next, node.id, st.pathKey, name);
      next = ops.setSetting(next, node.id, sheetKey, opts.sheet);
      edit(next, 'file:' + node.id);
      done();
      return { ok: true };
    }
    const bytesNow = () => fileBytes(ops.fileOf(store2.get().wf, node.id));
    return {
      has: !!bytesNow(),
      path: () => (st.pathKey ? String(settingsOf(ops.nodeById(wf(), node.id) || node)[st.pathKey] || '') : ''),
      pick: (f) => readBytes(f).then(b => apply(f.name, b, f.type || (looksExcel(f.name) ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv'), ''),
        (e) => ({ ok: false, error: (e && e.message) || 'the browser could not read this file' })),
      setSheet: (name) => {
        const b = bytesNow();
        const f = ops.fileOf(store2.get().wf, node.id);
        if (!b || !f) return { ok: false, error: 'This file is not attached any more: choose it again.' };
        return apply(f.name, b, f.mime, name);
      },
      clear: () => {
        let next = ops.setSetting(wf(), node.id, st.key, { name: '', size: 0, sheet: '', sheets: [], cols: [], rows: 0, sig: '' });
        next = ops.setFile(next, node.id, null);
        if (st.pathKey) next = ops.setSetting(next, node.id, st.pathKey, '');
        edit(next, 'file:' + node.id);
        done();
      },
      // A decode option changed after the file was read: read it again with the new one.
      stale: (meta) => {
        const b = bytesNow();
        if (!b || !meta || !meta.name) return;
        const want = decodeSig(optsOf(settingsOf(ops.nodeById(wf(), node.id) || node)));
        if (meta.sig === want) return;
        const f = ops.fileOf(store2.get().wf, node.id);
        apply(f.name, b, f.mime, undefined);
      },
    };
  }

  function specFor(node, st, value) {
    return {
      st, value, settings: settingsOf(node),
      fid: node.id + ':' + st.key,
      file: st.kind === 'file' ? fileSpecFor(node, st) : null,
      set: (v) => edit(ops.setSetting(wf(), node.id, st.key, v), 'f:' + node.id + ':' + st.key),
      done,
      kinds: st.kind === 'element' ? kindsFor(node, st) : null,
      classOf: () => classOf(node.id, st),
      suggest: () => suggestions(wf(), st.suggest),
      columns: () => columnsFor(node.id, st),
    };
  }

  // One setting: label line (label, tip, required, pin) and its editor.
  function settingRow(node, st, s) {
    const value = s[st.key];
    const pin = pinButton(node, st);
    const empty = st.required && isEmptyValue(st, value);
    if (st.kind === 'bool') {
      return el('div', { class: 'toggle-row pfb-set', dataset: { key: st.key } },
        el('div', { class: 'toggle-label' }, el('span', { class: 'pfb-lab' }, el('span', { text: st.label || st.key }), tipIcon(st.tip))),
        buildField(specFor(node, st, value)), pin);
    }
    if (st.kind === 'list') return listRow(node, st, s);
    return el('div', { class: 'field-row pfb-set' + (empty ? ' pfb-todo' : ''), dataset: { key: st.key } },
      el('div', { class: 'pfb-lab' }, el('span', { class: 'field-label', text: st.label || st.key }), tipIcon(st.tip), empty ? reqMark() : null, el('span', { class: 'pfb-lab-fill' }), pin),
      buildField(specFor(node, st, value)));
  }

  function listRow(node, st, s) {
    const rows = Array.isArray(s[st.key]) ? s[st.key] : [];
    const box = el('div', { class: 'field-row pfb-set pfb-listset' + (st.required && !rows.length ? ' pfb-todo' : ''), dataset: { key: st.key } },
      el('div', { class: 'pfb-lab' }, el('span', { class: 'field-label', text: st.label || st.key }), tipIcon(st.tip), st.required && !rows.length ? reqMark() : null));
    const list = el('div', { class: 'pfb-list' });
    rows.forEach((row, i) => {
      const del = iconButton('trash', 'Remove this row', 'sm');
      del.addEventListener('click', () => { edit(ops.removeRow(wf(), node.id, st.key, row.id)); done(); });
      const r = el('div', { class: 'pfb-list-row', dataset: { row: row.id } },
        el('div', { class: 'pfb-list-head' }, el('span', { class: 'pfb-list-n', text: (st.rowLabel || 'Row') + ' ' + (i + 1) }), del));
      for (const col of st.columns || []) {
        const cst = { ...col, label: col.label || col.key };
        const spec = {
          st: cst, value: row[col.key], settings: { ...s, ...row },
          fid: node.id + ':' + st.key + ':' + row.id + ':' + col.key,
          set: (v) => edit(ops.setRowField(wf(), node.id, st.key, row.id, col.key, v), 'f:' + node.id + ':' + st.key + ':' + row.id + ':' + col.key),
          done,
          kinds: Array.isArray(col.kinds) ? col.kinds : null,
          classOf: () => classOf(node.id, cst, row.id, st.key),
          suggest: () => suggestions(wf(), col.suggest),
          columns: () => columnsFor(node.id, col),
        };
        const field = buildField(spec);
        r.appendChild(el('div', { class: 'pfb-list-cell' + (col.kind === 'bool' ? ' pfb-list-bool' : '') }, el('span', { class: 'pfb-list-lab', text: cst.label }), tipIcon(col.tip), field));
      }
      list.appendChild(r);
    });
    const add = el('button', { type: 'button', class: 'btn-secondary btn-sm pfb-list-add', text: '+ Add ' + (st.addLabel || 'row') });
    add.addEventListener('click', () => { edit(ops.addRow(wf(), node.id, st.key)); done(); });
    box.appendChild(list);
    box.appendChild(add);
    return box;
  }

  function moreGroup(node, sts, s, key) {
    if (!sts.length) return null;
    const open = moreOpen.has(key);
    const btn = el('button', { type: 'button', class: 'pfb-more-btn', 'aria-expanded': open ? 'true' : 'false', text: (open ? '▾ ' : '▸ ') + 'More options (' + sts.length + ')' });
    btn.addEventListener('click', () => { if (moreOpen.has(key)) moreOpen.delete(key); else moreOpen.add(key); render(); });
    const body = el('div', { class: 'fg-sub', hidden: !open });
    for (const st of sts) body.appendChild(settingRow(node, st, s));
    return el('div', { class: 'field-group pfb-more' }, btn, body);
  }

  function actionButton(iconName, text, cls, onClick, title) {
    const b = el('button', { type: 'button', class: 'btn-secondary btn-sm has-ico ' + (cls || ''), title: title || null });
    b.innerHTML = icon(iconName) + '<span>' + esc(text) + '</span>';
    b.addEventListener('click', onClick);
    return b;
  }

  // ---- Nothing selected: the workflow
  function renderWorkflow() {
    const s = store.get();
    const frag = el('div', { class: 'pfb-insp' });
    const start = s.wf.nodes.find(n => n.type === 'start');
    frag.appendChild(el('div', { class: 'pfb-insp-head' },
      el('span', { class: 'pfb-insp-glyph', style: { '--cat': 'var(--cat-start)' }, html: blockIcon('start', 'start') }),
      el('div', { class: 'pfb-insp-titles' }, el('div', { class: 'pfb-insp-title', text: 'Workflow' }), el('div', { class: 'pfb-insp-kind', text: 'Start block' }))));
    frag.appendChild(el('p', { class: 'pfb-insp-desc', text: 'Settings of the whole workflow. They go at the top of the script. Select a block on the canvas to change its own settings.' }));
    const group = el('div', { class: 'field-group' }, el('div', { class: 'group-title', text: 'Workflow' }));
    const nameSt = { key: 'name', label: 'Workflow name', kind: 'text', placeholder: 'e.g. Headroom study', tip: 'Names the script file, the run folder and the log.' };
    group.appendChild(el('div', { class: 'field-row pfb-set', dataset: { key: 'wfname' } },
      el('div', { class: 'pfb-lab' }, el('span', { class: 'field-label', text: nameSt.label }), tipIcon(nameSt.tip)),
      buildField({ st: nameSt, value: s.wf.name, fid: 'wf:name', set: (v) => edit(ops.setName(wf(), v), 'wf:name'), done })));
    if (start && getBlock('start')) {
      const ss = settingsOf(start);
      const vis = visibleSettings(start, wiredSet(s.wf, start), showCtx(s, start));
      for (const st of vis.filter(z => !z.more)) group.appendChild(settingRow(start, st, ss));
      frag.appendChild(group);
      const more = moreGroup(start, vis.filter(z => z.more), ss, 'start');
      if (more) frag.appendChild(more);
    } else {
      frag.appendChild(group);
      const warn = el('div', { class: 'pfb-insp-note pfb-insp-error' }, el('p', { text: start ? 'The Start block did not load, so its settings cannot be shown.' : 'This workflow has no Start block. Every workflow begins at Start.' }));
      if (!start) {
        const b = el('button', { type: 'button', class: 'btn-secondary btn-sm', text: '+ Add Start' });
        b.addEventListener('click', () => app.addStart());
        warn.appendChild(b);
      }
      frag.appendChild(warn);
    }
    frag.appendChild(graphGroup());
    frag.appendChild(howItWorks());
    return frag;
  }

  // The graph style: a button showing it, which opens the Graph style modal.
  function graphButton() {
    const st = styleOf(wf());
    const name = styleName(st);
    const b = el('button', { type: 'button', class: 'btn-secondary pfb-gs-open', title: 'Edit how the graphs look', 'aria-label': 'Edit the graph style (now ' + name + ')' },
      el('span', { class: 'pfb-gs-open-thumb', html: previewSvg(st, { kind: 'series', width: 64, thumb: true }) }),
      el('span', { class: 'pfb-gs-open-name', text: name }),
      el('span', { class: 'pfb-gs-open-go', html: icon('edit') + '<span>Edit</span>' }));
    b.addEventListener('click', () => { if (app.openGraphStyle) app.openGraphStyle(b); });
    return b;
  }
  function graphGroup() {
    return el('div', { class: 'field-group pfb-gs-group' }, el('div', { class: 'group-title', text: 'Graphs' }),
      el('div', { class: 'field-row pfb-set', dataset: { key: 'graphstyle' } },
        el('div', { class: 'pfb-lab' }, el('span', { class: 'field-label', text: 'Graph style' }),
          tipIcon('How every graph of this workflow looks: colours, font, grid, key and image size. The script writes it in SETTINGS as GRAPH_STYLE.')),
        graphButton()));
  }

  function howItWorks() {
    const wire = (cls) => '<svg class="pfb-how-wire ' + cls + '" viewBox="0 0 44 12" aria-hidden="true" focusable="false"><path d="M2 6 H36"/>' + (cls === 'flow' ? '<path class="hd" d="M34 2 L42 6 L34 10 Z"/>' : '<circle cx="38" cy="6" r="3.2"/>') + '</svg>';
    return el('div', { class: 'pfb-how card' },
      el('div', { class: 'pfb-how-title', text: 'How it works' }),
      el('div', { class: 'pfb-how-row', html: wire('flow') + '<div><strong>Flow wire</strong> (thick, with an arrow): then do this. Steps run in the order of these wires, starting at Start.</div>' }),
      el('div', { class: 'pfb-how-row', html: wire('data') + '<div><strong>Data wire</strong> (thin, coloured by what it carries): use this value, such as a number, a curve or an element.</div>' }),
      el('div', { class: 'pfb-how-row pfb-how-small', html: '<div>Where a flow wire stops, that route ends: inside a loop it goes on to the next pass. The canvas says where next to each unwired output.</div>' }));
  }

  // ---- One block
  function renderNode(node) {
    const s = store.get();
    const def = getBlock(node.type);
    const frag = el('div', { class: 'pfb-insp' });
    if (!def) return renderMissing(node);
    // A block whose choices turn on a PowerFactory fact (an attribute's unit, whether the class
    // has parallel machines) reads it from core/attrdata.js: start it here, and the panel is
    // drawn again when it lands, with the choices that cannot apply gone.
    if ((def.settings || []).some(st => st.kind === 'attr' || typeof st.showIf === 'function' || typeof st.optionsFor === 'function')) {
      primeAttrData(classOf(node.id, {}));
    }
    const cat = (def.cat && ('var(--cat-' + def.cat + ')')) || 'var(--muted)';
    frag.appendChild(el('div', { class: 'pfb-insp-head' },
      el('span', { class: 'pfb-insp-glyph', style: { '--cat': cat }, html: blockIcon(def.type, def.kind) }),
      el('div', { class: 'pfb-insp-titles' }, el('div', { class: 'pfb-insp-title', text: displayName(node) }),
        el('div', { class: 'pfb-insp-kind', text: KIND_WORDS[def.kind] + (node.label && node.label.trim() && node.label.trim() !== def.title ? ' · ' + def.title : '') }))));
    if (def.desc) frag.appendChild(el('p', { class: 'pfb-insp-desc', text: def.desc }));
    if (node.type === 'start') {
      frag.appendChild(el('p', { class: 'pfb-insp-desc pfb-muted', text: 'Click an empty part of the canvas to see the workflow name with these settings.' }));
    }
    const top = el('div', { class: 'pfb-insp-tools' });
    if (def.kind !== 'note') {
      const see = el('button', { type: 'button', class: 'btn-secondary btn-sm pfb-see-py', text: 'See its Python' });
      see.addEventListener('click', () => app.seePython(node.id));
      top.appendChild(see);
    }
    frag.appendChild(top);

    const ss = settingsOf(node);
    const ports = ops.nodePorts(s.wf, node);
    const labelSt = { key: 'label', label: 'Name on the canvas', kind: 'text', placeholder: def.title };
    const g0 = el('div', { class: 'field-group' }, el('div', { class: 'group-title', text: KIND_WORDS[def.kind] || 'Block' }),
      el('div', { class: 'field-row pfb-set', dataset: { key: '_label' } },
        el('div', { class: 'pfb-lab' }, el('span', { class: 'field-label', text: labelSt.label }),
          tipIcon(def.kind === 'loop' || def.kind === 'pure' ? 'Also names its values in the script and the columns of results tables, e.g. Dispatch (MW).' : 'Shown on the canvas, in the Problems list and in the comments of the script.')),
        buildField({ st: labelSt, value: node.label || '', fid: node.id + ':_label', set: (v) => edit(ops.setLabel(wf(), node.id, v), 'f:' + node.id + ':_label'), done })));
    frag.appendChild(g0);

    // Inputs
    const fallbackKeys = new Set(ports.inputs.map(p => p.fallback).filter(Boolean));
    const visible = visibleSettings(node, wiredSet(s.wf, node), showCtx(s, node));
    if (ports.inputs.length) {
      const g = el('div', { class: 'field-group pfb-inputs' }, el('div', { class: 'group-title', text: 'Inputs' }));
      for (const p of ports.inputs) g.appendChild(inputRow(node, def, p, ss, visible));
      frag.appendChild(g);
    }
    // Settings
    const main = visible.filter(st => !st.more && !fallbackKeys.has(st.key));
    if (main.length) {
      const g = el('div', { class: 'field-group' }, el('div', { class: 'group-title', text: 'Settings' }));
      for (const st of main) g.appendChild(settingRow(node, st, ss));
      frag.appendChild(g);
    }
    const more = moreGroup(node, visible.filter(st => st.more && !fallbackKeys.has(st.key)), ss, node.type);
    if (more) frag.appendChild(more);
    if (ports.error) frag.appendChild(el('div', { class: 'pfb-insp-note pfb-insp-error', text: 'Its ports could not be worked out from these settings: ' + ports.error }));
    // A graph block: how it looks is the workflow's graph style, changed from here too.
    if ((def.helpers || []).some(h => /^plot_/.test(h))) {
      frag.appendChild(el('div', { class: 'field-group pfb-gs-group' }, el('div', { class: 'group-title', text: 'Look' }),
        el('div', { class: 'field-row pfb-set', dataset: { key: 'graphstyle' } },
          el('div', { class: 'pfb-lab' }, el('span', { class: 'field-label', text: 'Graph style' }),
            tipIcon('Every graph of the workflow shares one style. Changing it here changes them all.')),
          graphButton())));
    }

    const acts = el('div', { class: 'pfb-insp-actions' });
    if (node.type !== 'start') {
      acts.appendChild(actionButton('duplicate', 'Duplicate', '', () => app.duplicate([node.id]), 'Duplicate this block (Ctrl+D)'));
      acts.appendChild(actionButton('trash', 'Delete', 'pfb-del', () => app.deleteNodes([node.id]), 'Delete this block and its wires (Delete key)'));
    }
    frag.appendChild(acts);
    return frag;
  }

  function inputRow(node, def, p, ss, visible) {
    const s = store.get();
    const edge = s.wf.edges.find(e => e.to === node.id && ops.handleIdOf(s.wf, node.id, e.in, 'in') === p.id);
    const tip = p.stray ? '' : portTip(p.type, TYPES[p.type], p.tip || '', false);
    const fst = p.fallback ? def.settings.find(z => z.key === p.fallback) : null;
    const missingValue = !edge && p.required && !fst;
    const row = el('div', { class: 'pfb-in' + (missingValue ? ' pfb-todo' : ''), dataset: { port: p.id } },
      el('div', { class: 'pfb-lab' },
        el('span', { class: 'pfb-dot pfb-t-' + (TYPES[p.type] ? p.type : 'any') }),
        el('span', { class: 'field-label', text: portLabel(p) }), tipIcon('', tip), missingValue ? reqMark() : null,
        el('span', { class: 'pfb-lab-fill' }),
        !edge && fst ? pinButton(node, fst) : null));
    if (p.stray) {
      row.appendChild(el('div', { class: 'field-sub', text: 'This port is gone from the block. Its wire is kept so you can see it: remove it.' }));
    }
    if (edge) {
      const src = ops.nodeById(s.wf, edge.from);
      const sp = ops.portAt(s.wf, edge.from, edge.out, 'out');
      const line = el('div', { class: 'pfb-in-src' }, 'from ', el('strong', { text: src ? displayName(src) : edge.from }), sp && (sp.port.label || sp.port.id) ? ' · ' + portLabel(sp.port) : '');
      const goSrc = el('button', { type: 'button', class: 'pfb-link', text: 'Show', title: 'Select the block this value comes from' });
      goSrc.addEventListener('click', () => app.focusNode(edge.from));
      line.appendChild(goSrc);
      row.appendChild(line);
      if (fst) {
        const b = el('button', { type: 'button', class: 'btn-secondary btn-sm pfb-unwire', text: 'Type a value instead', title: 'Type the value here instead of taking it from the wire' });
        b.addEventListener('click', () => { edit(ops.removeEdges(wf(), [edge.id])); done(); });
        row.appendChild(b);
      } else {
        const b = iconButton('trash', 'Remove this wire', 'pfb-unwire-bin');
        b.addEventListener('click', () => { edit(ops.removeEdges(wf(), [edge.id])); done(); });
        line.appendChild(b);
      }
      return row;
    }
    if (fst) {
      if (visible.some(z => z.key === fst.key)) {
        row.appendChild(buildField(specFor(node, fst, ss[fst.key])));
        if (fst.required && isEmptyValue(fst, ss[fst.key])) row.classList.add('pfb-todo');
      } else {
        row.appendChild(el('div', { class: 'field-sub', text: 'Not used with these settings.' }));
      }
      return row;
    }
    if (!p.stray) row.appendChild(el('div', { class: 'field-sub', text: p.required ? 'Wire a value into it on the canvas.' : 'Not connected (optional).' }));
    return row;
  }

  function renderMissing(node) {
    const frag = el('div', { class: 'pfb-insp' });
    frag.appendChild(el('div', { class: 'pfb-insp-head' },
      el('span', { class: 'pfb-insp-glyph', style: { '--cat': 'var(--muted)' }, html: blockIcon('', 'missing') }),
      el('div', { class: 'pfb-insp-titles' }, el('div', { class: 'pfb-insp-title', text: 'Missing block' }), el('div', { class: 'pfb-insp-kind', text: String(node.type) }))));
    frag.appendChild(el('p', { class: 'pfb-insp-desc', text: 'This kind of block is not in this version of the Builder (or its file did not load). Its settings and wires are kept and saved back unchanged, but it does not run.' }));
    frag.appendChild(el('pre', { class: 'pfb-insp-raw', text: JSON.stringify(node.s || {}, null, 2).slice(0, 4000) }));
    const acts = el('div', { class: 'pfb-insp-actions' });
    acts.appendChild(actionButton('trash', 'Delete', 'pfb-del', () => app.deleteNodes([node.id]), 'Delete this block and its wires'));
    frag.appendChild(acts);
    return frag;
  }

  function renderMany(ids) {
    const frag = el('div', { class: 'pfb-insp' });
    frag.appendChild(el('div', { class: 'pfb-insp-head' }, el('div', { class: 'pfb-insp-titles' }, el('div', { class: 'pfb-insp-title', text: ids.length + ' blocks selected' }))));
    frag.appendChild(el('p', { class: 'pfb-insp-desc', text: 'Drag one of them to move them together. Ctrl+C and Ctrl+V copy them with the wires between them.' }));
    const acts = el('div', { class: 'pfb-insp-actions' });
    acts.appendChild(actionButton('duplicate', 'Duplicate', '', () => app.duplicate(ids), 'Duplicate these blocks (Ctrl+D)'));
    acts.appendChild(actionButton('trash', 'Delete', 'pfb-del', () => app.deleteNodes(ids), 'Delete these blocks and their wires'));
    frag.appendChild(acts);
    return frag;
  }

  function renderEdge(e) {
    const s = store.get();
    const frag = el('div', { class: 'pfb-insp' });
    const a = ops.nodeById(s.wf, e.from), b = ops.nodeById(s.wf, e.to);
    const pa = ops.portAt(s.wf, e.from, e.out, 'out'), pb = ops.portAt(s.wf, e.to, e.in, 'in');
    const flow = pb && pb.kind === 'flowIn';
    frag.appendChild(el('div', { class: 'pfb-insp-head' }, el('div', { class: 'pfb-insp-titles' }, el('div', { class: 'pfb-insp-title', text: flow ? 'Flow wire' : 'Data wire' }),
      el('div', { class: 'pfb-insp-kind', text: flow ? 'Then do this' : (pa && TYPES[pa.type] ? TYPES[pa.type].label : 'Value') }))));
    frag.appendChild(el('p', { class: 'pfb-insp-desc' }, 'From ', el('strong', { text: a ? displayName(a) : e.from }), pa && pa.port.label ? ' (' + portLabel(pa.port) + ')' : '', ' to ', el('strong', { text: b ? displayName(b) : e.to }), pb && pb.port.label ? ' (' + portLabel(pb.port) + ')' : '', '.'));
    const acts = el('div', { class: 'pfb-insp-actions' });
    acts.appendChild(actionButton('trash', 'Delete this wire', 'pfb-del', () => { edit(ops.removeEdges(wf(), [e.id])); done(); }, 'Delete this wire (Delete key)'));
    frag.appendChild(acts);
    return frag;
  }

  render();
  return { render };
}

// Exported for the tests: the value text a canvas shows next to an unwired input with a fallback.
// Is an input mandatory (the block cannot run without it), and is it given? Mandatory: the port
// says required, its fallback setting does, or it is an element the block looks up (codegen.js
// writes its SETTINGS line as REQUIRED). Given: wired, or its fallback setting holds a value.
export function inputNeed(node, p, wired) {
  const def = getBlock(node.type);
  const st = def && p.fallback ? def.settings.find(z => z.key === p.fallback) : null;
  const required = !!(p.required || (st && st.required) || (st && st.kind === 'element' && p.type === 'obj'));
  const given = !!wired || !!(st && !isEmptyValue(st, settingsOf(node)[st.key]));
  return { required, missing: required && !given };
}

export function fallbackText(node, p) {
  const def = getBlock(node.type);
  const st = def && p.fallback ? def.settings.find(z => z.key === p.fallback) : null;
  if (!st) return '';
  const v = settingsOf(node)[st.key];
  if (st.kind === 'element') return isObj(v) && v.name ? v.name : 'not set';
  if (st.kind === 'number') return (v === null || v === undefined || v === '') ? 'not set' : String(v) + (st.unit ? ' ' + st.unit : '');
  if (st.kind === 'bool') return v ? 'Yes' : 'No';
  if (st.kind === 'select') { const hit = optionPairs(st).find(o => o[0] === String(v)); return hit ? hit[1] : String(v); }
  const t = String(v === undefined || v === null ? '' : v);
  return t ? (t.length > 18 ? t.slice(0, 17) + '…' : t) : 'not set';
}
