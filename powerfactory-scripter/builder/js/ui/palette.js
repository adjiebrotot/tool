// The Blocks palette (DESIGN 8, U15): search over titles, keywords and descriptions; the
// categories in registry order, each collapsible (a category with no blocks is not shown);
// an item is the kind's picture and the title, with the description as its tip (and as a second
// line on a phone). Click adds the block after the selected one (or the last one added) and wires
// it; drag drops it on the canvas (on a flow wire it is spliced in). Start is greyed "Already on
// the canvas" while the workflow has one.
//
// A block family (core/registry.js defineFamily: the statistics, the graphs, the simulation
// events ...) is one item, under the family's title: a click adds its usual member, which the
// Settings tab's Kind switch changes. A search lists the members that match by their own words.
//
// A block that cannot work where a click would add it (Report this try outside a search, Skip to
// next pass or Stop the loop outside a loop) is greyed, says why and goes to the end of its
// category; it can still be dragged onto the canvas and wired where it works. A family's click
// takes the first member that works there.
//
// Items are options of a listbox, not buttons: a block title such as "Remove spikes" is not a
// delete button (the button checks read every button's name).

import { $, el, tipAttr, lsGet, lsSet, isPhone } from './dom.js';
import { allBlocks, CATEGORIES, familyOf, getBlock } from '../core/registry.js';
import { blockIcon } from './icons.js';
import { whyNotHere } from './ops.js';

const CLOSED_KEY = 'pfb-palette-closed';

export function mountPalette(app) {
  const store = app.store;
  const list = $('pfbPalList'), search = $('pfbPalSearch');
  let closed;
  try { closed = new Set(JSON.parse(lsGet(CLOSED_KEY, '["value","adv"]'))); } catch (e) { closed = new Set(['value', 'adv']); }
  let lastKey = null;

  const famText = (f) => f.title + ' ' + (f.keywords || []).join(' ') + ' ' + (f.desc || '');
  function score(def, q) {
    const t = def.title.toLowerCase();
    if (t === q) return 4;
    if (t.includes(q)) return 3;
    if ((def.keywords || []).some(k => String(k).toLowerCase().includes(q))) return 2;
    if (String(def.desc || '').toLowerCase().includes(q)) return 1;
    return 0;
  }
  const titleHas = (title, q) => q.split(/\s+/).filter(Boolean).every(w => String(title).toLowerCase().includes(w));
  function matches(def, q) {
    const words = q.split(/\s+/).filter(Boolean);
    const hay = (def.title + ' ' + (def.keywords || []).join(' ') + ' ' + (def.desc || '') + ' ' + (def.type || '')).toLowerCase();
    return words.every(w => hay.includes(w));
  }

  // The palette's entries of one category: { def (what a click adds), fam, off (why not here),
  // title, desc, kinds }.
  function entries(catId, q, hasStart, chain) {
    const blocks = allBlocks().filter(b => b.cat === catId);
    const out = [];
    const famsSeen = new Set();
    for (const def of blocks) {
      const fam = familyOf(def.type);
      if (q) {
        // A member is found by its own words; when its family matches too, only by its own name
        // (searching "statistics" gives the Statistics entry, "median" gives Median as well).
        const famHit = !!fam && matches({ title: fam.title, keywords: fam.keywords, desc: fam.desc }, q);
        if (matches(def, q) && (!famHit || titleHas(def.title, q))) out.push({ def, fam: null, title: def.title, desc: def.desc, s: score(def, q) });
        if (famHit && !famsSeen.has(fam.id)) {
          famsSeen.add(fam.id);
          out.push({ def: getBlock(fam.dflt), fam, title: fam.title, desc: fam.desc, s: score({ title: fam.title, keywords: fam.keywords, desc: fam.desc }, q) });
        }
        continue;
      }
      if (!fam) { out.push({ def, fam: null, title: def.title, desc: def.desc }); continue; }
      if (famsSeen.has(fam.id)) continue;
      famsSeen.add(fam.id);
      out.push({ def: getBlock(fam.dflt), fam, title: fam.title, desc: fam.desc });
    }
    for (const it of out) {
      if (it.def.kind === 'start' && hasStart) { it.off = 'Already on the canvas'; it.hard = true; continue; }
      if (it.fam) {
        // The usual member if it works where a click adds it, else the first one that does.
        const order = [it.fam.dflt, ...it.fam.members.filter(t => t !== it.fam.dflt)].map(getBlock).filter(Boolean);
        const ok = order.find(d => !whyNotHere(d, chain));
        if (ok) it.def = ok; else it.off = whyNotHere(order[0], chain);
        it.kinds = it.fam.members.length;
      } else it.off = whyNotHere(it.def, chain);
    }
    const idx = new Map(out.map((it, i) => [it, i]));
    return out.sort((a, b) => ((a.off ? 1 : 0) - (b.off ? 1 : 0)) || (q ? (b.s - a.s) : 0) || (idx.get(a) - idx.get(b)));
  }

  function item(it) {
    const def = it.def;
    const hard = !!it.hard;
    const tip = (it.off && !hard ? it.off + '. ' : '') + (it.desc || '');
    const sub = it.off ? el('span', { class: 'pfb-pal-desc pfb-pal-off', text: it.off })
      : (it.desc ? el('span', { class: 'pfb-pal-desc', text: it.desc }) : null);
    const n = el('div', {
      class: 'pfb-pal-item' + (hard ? ' is-off' : it.off ? ' is-dim' : ''), role: 'option', tabindex: '0', 'aria-selected': 'false',
      'aria-disabled': it.off ? 'true' : null, draggable: hard ? null : 'true',
      dataset: { type: def.type, ...(it.fam ? { family: it.fam.id } : {}) },
      'data-tip': hard ? null : (tip ? tipAttr(tip) : null),
      style: { '--cat': 'var(--cat-' + def.cat + ')' },
    },
    el('span', { class: 'pfb-pal-glyph', html: blockIcon(def.type, def.kind) }),
    el('span', { class: 'pfb-pal-text' },
      el('span', { class: 'pfb-pal-title' }, it.title, it.kinds ? el('span', { class: 'pfb-pal-kinds', text: it.kinds + ' kinds' }) : null),
      sub));
    if (hard) return n;
    const add = () => { if (it.off) { app.toast(it.off + ': drag it onto the canvas and wire it there.'); return; } app.clickAdd(def.type); };
    n.addEventListener('click', add);
    n.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); add(); } });
    n.addEventListener('dragstart', (e) => {
      app.dragging = def.type;
      try { e.dataTransfer.setData('application/x-pfb-block', def.type); e.dataTransfer.setData('text/plain', it.title); e.dataTransfer.effectAllowed = 'copy'; } catch (err) { /* old browsers */ }
    });
    n.addEventListener('dragend', () => { setTimeout(() => { app.dragging = null; }, 0); });
    return n;
  }

  // Where a click would add a block: the loops and searches around that spot (null: not known
  // yet, which greys nothing).
  const chainNow = () => (typeof app.addContext === 'function' ? app.addContext() : null);
  const keyOf = (hasStart, chain) => (hasStart ? 's' : '') + '|' + (chain ? chain.map(c => c.kind).join(',') : '?');

  function render() {
    const q = search.value.trim().toLowerCase();
    const hasStart = store.get().wf.nodes.some(n => n.type === 'start');
    const chain = chainNow();
    lastKey = keyOf(hasStart, chain);
    list.textContent = '';
    let shown = 0;
    for (const cat of CATEGORIES) {
      const items = entries(cat.id, q, hasStart, chain);
      if (!items.length) continue;
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
      for (const it of items) box.appendChild(item(it));
      list.appendChild(el('div', { class: 'pfb-cat', dataset: { cat: cat.id } }, head, box));
      shown += items.length;
    }
    if (!shown) list.appendChild(el('div', { class: 'pfb-pal-empty', text: q ? 'No block matches "' + search.value.trim() + '". Try another word, e.g. frequency or table.' : 'The blocks did not load. Reload the page to try again.' }));
  }
  search.addEventListener('input', render);
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { search.value = ''; render(); }
    if (e.key === 'Enter') { const first = list.querySelector('.pfb-pal-item:not(.is-off):not(.is-dim)'); if (first) { e.preventDefault(); app.clickAdd(first.dataset.type); } }
  });
  // Redrawn when Start comes or goes, or the spot a click adds to moves in or out of a loop.
  store.subscribe((s, prev) => {
    if (s.wf === prev.wf && s.sel === prev.sel && s.gen === prev.gen && s.lastAdded === prev.lastAdded) return;
    const k = keyOf(s.wf.nodes.some(n => n.type === 'start'), chainNow());
    if (k !== lastKey) render();
  });
  render();
  return { render, isPhone };
}
