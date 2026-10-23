// Quick-add (DESIGN 8, U6, U13): the small list that opens where a dragged wire was dropped,
// listing only the blocks that fit it. Plain DOM over the canvas (z-index below the tour).
// openQuickAdd({ x, y, title, items: [{ main, sub, cat, kind, first? }], onPick(item) }).
// Items are options of a listbox, not buttons: their names are block titles.

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
  function draw() {
    const q = search.value.trim().toLowerCase();
    shown = !q ? all : all.filter(it => ((it.main || '') + ' ' + (it.sub || '') + ' ' + (it.keywords || '')).toLowerCase().includes(q));
    active = Math.min(active, Math.max(0, shown.length - 1));
    list.textContent = '';
    if (!shown.length) list.appendChild(el('div', { class: 'pfb-qa-empty', text: all.length ? 'Nothing matches.' : 'No block fits here yet.' }));
    shown.forEach((it, i) => {
      const row = el('div', { class: 'pfb-qa-item' + (i === active ? ' focused' : '') + (it.first ? ' pfb-qa-first' : ''), role: 'option', 'aria-selected': i === active ? 'true' : 'false', tabindex: '-1', style: { '--cat': it.cat ? 'var(--cat-' + it.cat + ')' : 'var(--accent)' } },
        el('span', { class: 'pfb-qa-glyph', html: blockIcon(it.special === 'ifyes' ? 'flow.if' : (it.def && it.def.type) || (it.cv && it.cv.def && it.cv.def.type) || it.type, it.kind || 'action') }),
        el('span', { class: 'pfb-qa-text' }, el('span', { class: 'pfb-qa-main', text: it.main }), it.sub ? el('span', { class: 'pfb-qa-sub', text: it.sub }) : null));
      row.addEventListener('click', () => pick(it));
      row.addEventListener('mousemove', () => { if (active !== i) { active = i; mark(); } });
      list.appendChild(row);
    });
  }
  function mark() {
    [...list.querySelectorAll('.pfb-qa-item')].forEach((r, i) => { r.classList.toggle('focused', i === active); r.setAttribute('aria-selected', i === active ? 'true' : 'false'); });
    const f = list.querySelector('.pfb-qa-item.focused');
    if (f) f.scrollIntoView({ block: 'nearest' });
  }
  function pick(it) { closeQuickAdd(); opts.onPick(it); }
  search.addEventListener('input', () => { active = 0; draw(); });
  const keys = (e) => {
    if (!current) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeQuickAdd(); return; }
    if (e.key === 'ArrowDown') { active = Math.min(shown.length - 1, active + 1); mark(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); mark(); e.preventDefault(); }
    else if (e.key === 'Enter' && shown[active]) { e.preventDefault(); pick(shown[active]); }
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
