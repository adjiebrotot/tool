// Keyboard shortcuts and the clipboard (DESIGN 8): Ctrl+Z undo, Ctrl+Y / Ctrl+Shift+Z redo,
// Delete / Backspace delete the selection (Start refuses), Ctrl+C / Ctrl+X / Ctrl+V copy, cut and
// paste blocks with the wires between them, Ctrl+D duplicates, Ctrl+A selects every block,
// Escape clears the selection. None of them fire while the focus is in a text field, so text
// editing keeps its own undo and copy. While the Graph style modal is open only undo and redo
// do (it changes the workflow too); the rest would act on a canvas the reader cannot see.
//
// The clipboard holds a small workflow (JSON), so blocks copied here paste into another tab of
// the Builder too; it is read back through loadWorkflow() like any other way in.

import { isTyping } from './dom.js';
import { APP_ID } from '../core/workflow.js';
import { quickAddOpen } from './quickadd.js';

export function looksLikeFragment(text) {
  const t = String(text || '').trim();
  if (!t.startsWith('{') || t.indexOf('"' + APP_ID + '"') < 0) return false;
  try { const o = JSON.parse(t); return !!o && o.app === APP_ID && Array.isArray(o.nodes); } catch (e) { return false; }
}

export function mountKeyboard(app) {
  const store = app.store;
  let clip = null, clipCount = 0, pasteSeen = false, inCanvas = false;
  const canvas = document.getElementById('pfbCanvas');
  document.addEventListener('pointerdown', (e) => { inCanvas = !!(canvas && canvas.contains(e.target)); }, true);
  const tourOpen = () => !!document.querySelector('.pf-tour-backdrop, .pf-tour-tooltip');
  const textSelected = () => { const s = window.getSelection && window.getSelection(); return !!(s && !s.isCollapsed && String(s).trim()); };
  const canvasFocus = () => inCanvas || (canvas && canvas.contains(document.activeElement));

  function copySelection() {
    const ids = store.get().sel.nodes;
    if (!ids.length) return null;
    clip = app.copyFragment(ids);
    clipCount = 0;
    return clip;
  }
  function pasteClip(text) {
    const frag = text || clip;
    if (!frag) return;
    if (!text) clipCount++;
    const off = 40 * (text ? 1 : clipCount);
    app.paste(frag, off);
  }

  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || tourOpen() || quickAddOpen()) return;
    if (isTyping(e.target)) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = (e.key || '').toLowerCase();
    const sel = store.get().sel;
    if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); app.undo(); return; }
    if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); app.redo(); return; }
    if (app.graphStyleOpen && app.graphStyleOpen()) return;
    if (mod && k === 'd') { if (sel.nodes.length) { e.preventDefault(); app.duplicate(sel.nodes); } return; }
    if (mod && k === 'a' && canvasFocus()) { e.preventDefault(); store.select(store.get().wf.nodes.map(n => n.id), []); return; }
    if (!mod && !e.altKey && (e.key === 'Delete' || e.key === 'Backspace')) {
      if (sel.nodes.length || sel.edges.length) { e.preventDefault(); app.deleteSelection(); }
      return;
    }
    if (e.key === 'Escape') { if (sel.nodes.length || sel.edges.length) store.select([], []); return; }
    if (mod && k === 'c' && !textSelected() && sel.nodes.length) { copySelection(); return; }
    if (mod && k === 'x' && !textSelected() && sel.nodes.length) { if (copySelection()) { e.preventDefault(); app.deleteSelection(); } return; }
    if (mod && k === 'v' && (canvasFocus() || !textSelected())) {
      pasteSeen = false;
      // The paste event (below) brings the system clipboard; when the browser gives none, the
      // blocks copied in this tab are pasted instead.
      setTimeout(() => { if (!pasteSeen && clip) pasteClip(null); }, 80);
    }
  });
  document.addEventListener('copy', (e) => {
    if (isTyping(e.target) || textSelected() || tourOpen() || (app.graphStyleOpen && app.graphStyleOpen())) return;
    const ids = store.get().sel.nodes;
    if (!ids.length) return;
    const frag = copySelection();
    if (!frag || !e.clipboardData) return;
    e.clipboardData.setData('text/plain', JSON.stringify(frag));
    e.preventDefault();
  });
  document.addEventListener('paste', (e) => {
    if (isTyping(e.target) || tourOpen() || (app.graphStyleOpen && app.graphStyleOpen())) return;
    const text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
    if (!looksLikeFragment(text)) return;
    pasteSeen = true;
    e.preventDefault();
    if (clip && JSON.stringify(clip) === text.trim()) pasteClip(null);
    else pasteClip(text);
  });
}
