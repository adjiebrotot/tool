// Quick-add (DESIGN 8, U6, U13): the small list that opens where a dragged wire was dropped,
// listing only the blocks that fit it. Plain DOM over the canvas (z-index below the tour).
// openQuickAdd({ x, y, title, items: [{ main, sub, cat, kind, first?, off? }], onPick(item) }).
// An item with `off` (why the block cannot work there) is greyed: it cannot be picked, and the
// arrow keys pass over it. Items are options of a listbox, not buttons: their names are block
// titles.

import { el, clampToViewport } from './dom.js';
import { blockIcon } from './icons.js';

let current = null;

export function closeQuickAdd() {
  if (!current) return;
  const c = current;
  current = null;
  c.node.remove();
  document.removeEventListener('pointerdown', c.outside, true);
  document.removeEventListener('keydown', c.keys, true);
}
export const quickAddOpen = () => !!current;

export function openQuickAdd(opts) {
  closeQuickAdd();
  const all = opts.items || [];
  const box = el('div', { class: 'pfb-qa panel-raised', role: 'dialog', 'aria-label': opts.title || 'Add a block', 'data-no-abbr': true, 'data-no-persist': true });
  const head = el('div', { class: 'pfb-qa-title', text: opts.title || 'Add a block here' });
  const search = el('input', { type: 'search', class: 'txt-input pfb-qa-search', placeholder: 'Search', 'aria-label': 'Search these blocks', autocomplete: 'off', spellcheck: 'false' });
  const list = el('div', { class: 'pfb-qa-list', role: 'listbox', tabindex: '0', 'aria-label': opts.title || 'Blocks' });
  box.appendChild(head);
  if (all.length > 6) box.appendChild(search);
  box.appendChild(list);
  if (opts.note) box.appendChild(el('div', { class: 'pfb-qa-note', text: opts.note }));
  let shown = all, active = 0;
  // The next item that can be picked from i in direction d (i itself first); -1 when none.
  const usable = (i, d) => { for (let k = i; k >= 0 && k < shown.length; k += d) if (!shown[k].off) return k; return -1; };
  function draw() {
    const q = search.value.trim().toLowerCase();
    shown = !q ? all : all.filter(it => ((it.main || '') + ' ' + (it.sub || '') + ' ' + (it.keywords || '')).toLowerCase().includes(q));
    active = Math.min(active, Math.max(0, shown.length - 1));
    if (shown[active] && shown[active].off) { const k = usable(active, 1); active = k >= 0 ? k : Math.max(0, usable(active, -1)); }
    list.textContent = '';
    if (!shown.length) list.appendChild(el('div', { class: 'pfb-qa-empty', text: all.length ? 'Nothing matches.' : 'No block fits here yet.' }));
    shown.forEach((it, i) => {
      const row = el('div', { class: 'pfb-qa-item' + (i === active && !it.off ? ' focused' : '') + (it.first ? ' pfb-qa-first' : '') + (it.off ? ' is-off' : ''), role: 'option', 'aria-selected': i === active && !it.off ? 'true' : 'false', 'aria-disabled': it.off ? 'true' : null, tabindex: '-1', style: { '--cat': it.cat ? 'var(--cat-' + it.cat + ')' : 'var(--accent)' } },
        el('span', { class: 'pfb-qa-glyph', html: blockIcon(it.special === 'ifyes' ? 'flow.if' : (it.def && it.def.type) || (it.cv && it.cv.def && it.cv.def.type) || it.type, it.kind || 'action') }),
        el('span', { class: 'pfb-qa-text' }, el('span', { class: 'pfb-qa-main', text: it.main }), it.sub ? el('span', { class: 'pfb-qa-sub', text: it.sub }) : null));
      row.addEventListener('click', () => { if (!it.off) pick(it); });
      row.addEventListener('mousemove', () => { if (active !== i && !it.off) { active = i; mark(); } });
      list.appendChild(row);
    });
  }
  function mark() {
    [...list.querySelectorAll('.pfb-qa-item')].forEach((r, i) => { const on = i === active && !(shown[i] && shown[i].off); r.classList.toggle('focused', on); r.setAttribute('aria-selected', on ? 'true' : 'false'); });
    const f = list.querySelector('.pfb-qa-item.focused');
    if (f) f.scrollIntoView({ block: 'nearest' });
  }
  function pick(it) { closeQuickAdd(); opts.onPick(it); }
  search.addEventListener('input', () => { active = 0; draw(); });
  const keys = (e) => {
    if (!current) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeQuickAdd(); return; }
    if (e.key === 'ArrowDown') { const k = usable(active + 1, 1); if (k >= 0) active = k; mark(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { const k = usable(active - 1, -1); if (k >= 0) active = k; mark(); e.preventDefault(); }
    else if (e.key === 'Enter' && shown[active] && !shown[active].off) { e.preventDefault(); pick(shown[active]); }
  };
  const outside = (e) => { if (current && !box.contains(e.target)) closeQuickAdd(); };
  draw();
  document.body.appendChild(box);
  clampToViewport(box, opts.x, opts.y);
  current = { node: box, outside, keys };
  // Registered after this pointer event has finished, so the drop that opened it does not close it.
  setTimeout(() => {
    if (current && current.node === box) {
      document.addEventListener('pointerdown', outside, true);
      document.addEventListener('keydown', keys, true);
    }
  }, 0);
  (all.length > 6 ? search : list).focus({ preventScroll: true });
  return box;
}
