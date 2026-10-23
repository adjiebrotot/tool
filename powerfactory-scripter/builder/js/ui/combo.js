// A text field with a suggestion list under it: the site's searchable combobox look
// (.combo-input + .combo-list from dropdown.css, placed by SharedDropdown.place). The field stays
// free text: a suggestion only fills it in. Used for attribute names (description first, code
// second) and for names already in use (Remember a value, results tables).
//
// attachCombo(input, getItems, onPick): getItems(query) returns (or resolves to) an array of
// { value, main, sub?, chip?, group? }; onPick(item) is called with the chosen one. opts.empty
// (text, or a function giving it) is what an empty list says.

import { el } from './dom.js';

let openCombo = null;

export function attachCombo(input, getItems, onPick, opts = {}) {
  input.classList.add('combo-input');
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  let list = null, items = [], active = -1, token = 0;

  function close() {
    if (list) { list.remove(); list = null; }
    input.setAttribute('aria-expanded', 'false');
    if (openCombo === api) openCombo = null;
  }
  function place() {
    if (!list) return;
    if (window.SharedDropdown && typeof SharedDropdown.place === 'function') SharedDropdown.place(input, list, { minWidth: opts.minWidth || 280, maxHeight: 300 });
    else {
      const r = input.getBoundingClientRect();
      Object.assign(list.style, { position: 'fixed', left: r.left + 'px', top: (r.bottom + 4) + 'px', minWidth: r.width + 'px' });
    }
  }
  function render() {
    if (!list) {
      list = el('div', { class: 'combo-list pfb-combo-list', role: 'listbox', 'data-no-abbr': true, 'data-no-persist': true });
      list.addEventListener('mousedown', (e) => e.preventDefault());   // keep the focus in the field
      document.body.appendChild(list);
      input.setAttribute('aria-expanded', 'true');
      if (openCombo && openCombo !== api) openCombo.close();
      openCombo = api;
    }
    list.textContent = '';
    if (!items.length) {
      list.appendChild(el('div', { class: 'combo-empty', text: (typeof opts.empty === 'function' ? opts.empty() : opts.empty) || 'No suggestions: type the name yourself.' }));
    }
    let lastGroup = null;
    items.forEach((it, i) => {
      if (it.group && it.group !== lastGroup) { list.appendChild(el('div', { class: 'combo-group', text: it.group })); lastGroup = it.group; }
      const row = el('div', { class: 'combo-opt' + (i === active ? ' focused' : '') + (it.value === input.value ? ' selected' : ''), role: 'option', 'aria-selected': it.value === input.value ? 'true' : 'false' },
        el('span', { class: 'combo-text' }, el('span', { class: 'combo-main', text: it.main || it.value }), it.sub ? el('span', { class: 'combo-sub', text: it.sub }) : null),
        it.chip ? el('span', { class: 'combo-chip', text: it.chip }) : null);
      row.addEventListener('click', () => pick(i));
      row.addEventListener('mousemove', () => { if (active !== i) { active = i; mark(); } });
      list.appendChild(row);
    });
    place();
  }
  function mark() {
    if (!list) return;
    [...list.querySelectorAll('.combo-opt')].forEach((r, i) => r.classList.toggle('focused', i === active));
    const f = list.querySelector('.combo-opt.focused');
    if (f && f.scrollIntoView) f.scrollIntoView({ block: 'nearest' });
  }
  function pick(i) {
    const it = items[i];
    if (!it) return;
    close();
    onPick(it);
  }
  async function refresh() {
    const my = ++token;
    let res;
    try { res = await getItems(input.value); } catch (e) { res = []; }
    if (my !== token || document.activeElement !== input) return;
    items = Array.isArray(res) ? res.slice(0, opts.max || 80) : [];
    active = -1;
    render();
  }
  input.addEventListener('focus', refresh);
  input.addEventListener('input', refresh);
  input.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== input) close(); }, 120));
  input.addEventListener('keydown', (e) => {
    if (!list) { if (e.key === 'ArrowDown') { refresh(); e.preventDefault(); } return; }
    if (e.key === 'ArrowDown') { active = Math.min(items.length - 1, active + 1); mark(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); mark(); e.preventDefault(); }
    else if (e.key === 'Enter' && active >= 0) { pick(active); e.preventDefault(); }
    else if (e.key === 'Escape') { close(); e.stopPropagation(); }
  });
  const api = { close, refresh };
  return api;
}

// The open list follows its field; any page scroll outside the list closes it (as dropdown.js does).
window.addEventListener('scroll', (e) => {
  if (openCombo && !(e.target && e.target.closest && e.target.closest('.pfb-combo-list'))) openCombo.close();
}, true);
window.addEventListener('resize', () => { if (openCombo) openCombo.close(); });
