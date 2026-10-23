// The Blocks palette (DESIGN 8, U15): search over titles, keywords and descriptions; the
// categories in registry order, each collapsible (a category with no blocks is not shown);
// an item is the kind's picture and the title, with the description as its tip (and as a second
// line on a phone). Click adds the block after the selected one (or the last one added) and wires
// it; drag drops it on the canvas (on a flow wire it is spliced in). Start is greyed "Already on
// the canvas" while the workflow has one.
//
// Items are options of a listbox, not buttons: a block title such as "Remove spikes" is not a
// delete button (the button checks read every button's name).

import { $, el, tipAttr, lsGet, lsSet, isPhone } from './dom.js';
import { allBlocks, CATEGORIES } from '../core/registry.js';
import { blockIcon } from './icons.js';

const CLOSED_KEY = 'pfb-palette-closed';

export function mountPalette(app) {
  const store = app.store;
  const list = $('pfbPalList'), search = $('pfbPalSearch');
  let closed;
  try { closed = new Set(JSON.parse(lsGet(CLOSED_KEY, '["value","adv"]'))); } catch (e) { closed = new Set(['value', 'adv']); }
  let lastHasStart = null;

  function score(def, q) {
    const t = def.title.toLowerCase();
    if (t === q) return 4;
    if (t.includes(q)) return 3;
    if ((def.keywords || []).some(k => String(k).toLowerCase().includes(q))) return 2;
    if (String(def.desc || '').toLowerCase().includes(q)) return 1;
    return 0;
  }
  function matches(def, q) {
    const words = q.split(/\s+/).filter(Boolean);
    const hay = (def.title + ' ' + (def.keywords || []).join(' ') + ' ' + (def.desc || '') + ' ' + def.type).toLowerCase();
    return words.every(w => hay.includes(w));
  }

  function item(def, hasStart) {
    const off = def.kind === 'start' && hasStart;
    const n = el('div', {
      class: 'pfb-pal-item' + (off ? ' is-off' : ''), role: 'option', tabindex: '0', 'aria-selected': 'false',
      'aria-disabled': off ? 'true' : null, draggable: off ? null : 'true', dataset: { type: def.type },
      'data-tip': off ? null : (def.desc ? tipAttr(def.desc) : null),
      style: { '--cat': 'var(--cat-' + def.cat + ')' },
    },
    el('span', { class: 'pfb-pal-glyph', html: blockIcon(def.type, def.kind) }),
    el('span', { class: 'pfb-pal-text' },
      el('span', { class: 'pfb-pal-title', text: def.title }),
      off ? el('span', { class: 'pfb-pal-desc pfb-pal-off', text: 'Already on the canvas' }) : (def.desc ? el('span', { class: 'pfb-pal-desc', text: def.desc }) : null)));
    if (off) return n;
    n.addEventListener('click', () => app.clickAdd(def.type));
    n.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); app.clickAdd(def.type); } });
    n.addEventListener('dragstart', (e) => {
      app.dragging = def.type;
      try { e.dataTransfer.setData('application/x-pfb-block', def.type); e.dataTransfer.setData('text/plain', def.title); e.dataTransfer.effectAllowed = 'copy'; } catch (err) { /* old browsers */ }
    });
    n.addEventListener('dragend', () => { setTimeout(() => { app.dragging = null; }, 0); });
    return n;
  }

  function render() {
    const q = search.value.trim().toLowerCase();
    const hasStart = store.get().wf.nodes.some(n => n.type === 'start');
    lastHasStart = hasStart;
    const blocks = allBlocks();
    list.textContent = '';
    let shown = 0;
    for (const cat of CATEGORIES) {
      let items = blocks.filter(b => b.cat === cat.id);
      if (!items.length) continue;
      if (q) {
        items = items.filter(b => matches(b, q));
        if (!items.length) continue;
        items = items.map((b, i) => [b, i]).sort((a, b) => (score(b[0], q) - score(a[0], q)) || (a[1] - b[1])).map(x => x[0]);
      }
      const open = q ? true : !closed.has(cat.id);
      const head = el('button', { type: 'button', class: 'pfb-cat-head', 'aria-expanded': open ? 'true' : 'false', style: { '--cat': 'var(' + cat.color + ')' } },
        el('span', { class: 'pfb-cat-dot' }), el('span', { class: 'pfb-cat-title', text: cat.title }), el('span', { class: 'pfb-cat-n', text: String(items.length) }), el('span', { class: 'pfb-cat-chev', text: open ? '▾' : '▸' }));
      head.addEventListener('click', () => {
        if (q) return;
        if (closed.has(cat.id)) closed.delete(cat.id); else closed.add(cat.id);
        lsSet(CLOSED_KEY, JSON.stringify([...closed]));
        render();
      });
      const box = el('div', { class: 'pfb-cat-items', role: 'listbox', 'aria-label': cat.title, hidden: !open });
      for (const def of items) box.appendChild(item(def, hasStart));
      list.appendChild(el('div', { class: 'pfb-cat', dataset: { cat: cat.id } }, head, box));
      shown += items.length;
    }
    if (!shown) list.appendChild(el('div', { class: 'pfb-pal-empty', text: q ? 'No block matches "' + search.value.trim() + '". Try another word, e.g. frequency or table.' : 'The blocks did not load. Reload the page to try again.' }));
  }
  search.addEventListener('input', render);
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { search.value = ''; render(); }
    if (e.key === 'Enter') { const first = list.querySelector('.pfb-pal-item:not(.is-off)'); if (first) { e.preventDefault(); app.clickAdd(first.dataset.type); } }
  });
  store.subscribe((s, prev) => {
    if (s.wf === prev.wf) return;
    const hasStart = s.wf.nodes.some(n => n.type === 'start');
    if (hasStart !== lastHasStart) render();
  });
  render();
  return { render, isPhone };
}
