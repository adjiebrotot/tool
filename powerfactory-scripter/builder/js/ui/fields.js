// One editor per setting kind (registry SETTING_KINDS), used by the inspector for block settings,
// input fallbacks and the columns of list rows. Each editor is plain DOM built from the site's
// components (.txt-input, .affix-wrap, select, .toggle-switch, .combo-input) and reports edits
// through spec.set(value). The inspector owns undo: an edit made while a field has the focus
// joins one undo step, closed on blur (spec.done()).
//
// spec = { st, value, set(value), done(), fid, kinds?, classOf?(), suggest?(), study? }

import { el, esc, tipText } from './dom.js';
import { optionPairs, ELEMENT_CLASSES } from '../core/registry.js';
import { attachCombo } from './combo.js';
import { attrSuggestions } from './attrs.js';

const MATCH_OPTIONS = [
  ['one', 'Exactly one (stop if none or several)'],
  ['first', 'The first one, by name'],
  ['all', 'Every match'],
];

export function parseNumber(text) {
  const t = String(text === undefined || text === null ? '' : text).trim().replace(/\s/g, '').replace(',', '.');
  if (t === '' || !/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) return NaN;
  return Number(t);
}
const fmtNumber = (v) => (typeof v === 'number' && Number.isFinite(v) ? String(v) : (v === null || v === undefined ? '' : String(v)));

function focusHooks(node, spec) {
  node.addEventListener('blur', () => { if (spec.done) spec.done(); });
  if (spec.fid) node.dataset.fid = spec.fid;
}

export function textField(spec) {
  const st = spec.st;
  const i = el('input', { type: 'text', class: 'txt-input', value: spec.value === undefined || spec.value === null ? '' : String(spec.value), placeholder: st.placeholder || '', spellcheck: 'false', 'aria-label': st.label || st.key });
  i.addEventListener('input', () => spec.set(i.value));
  focusHooks(i, spec);
  if (st.suggest && spec.suggest) {
    attachCombo(i, (q) => {
      const names = spec.suggest() || [];
      const ql = q.trim().toLowerCase();
      return names.filter(n => !ql || n.toLowerCase().includes(ql) || n === q).map(n => ({ value: n, main: n }));
    }, (it) => { i.value = it.value; spec.set(it.value); if (spec.done) spec.done(); }, { empty: 'No names in use yet: type a new one.', minWidth: 220 });
  }
  return i;
}

export function numberField(spec) {
  const st = spec.st;
  const wrap = el('div', { class: 'affix-wrap' });
  const i = el('input', { type: 'text', inputmode: 'decimal', class: 'affix-input' + (st.unit ? ' has-suffix' : ''), value: fmtNumber(spec.value), placeholder: st.placeholder || '', 'aria-label': st.label || st.key, spellcheck: 'false' });
  wrap.appendChild(i);
  if (st.unit) wrap.appendChild(el('span', { class: 'suffix', text: st.unit }));
  const hint = el('div', { class: 'field-sub pfb-num-hint', hidden: true });
  let last = spec.value;
  const say = (t) => { hint.textContent = t; hint.hidden = !t; i.classList.toggle('pfb-invalid', !!t); };
  i.addEventListener('input', () => {
    const n = parseNumber(i.value);
    if (i.value.trim() === '') { say(''); return; }
    if (!Number.isFinite(n)) { say('Type a number, e.g. 1.5'); return; }
    if (typeof st.min === 'number' && n < st.min) say('The lowest value is ' + st.min + (st.unit ? ' ' + st.unit : '') + '.');
    else if (typeof st.max === 'number' && n > st.max) say('The highest value is ' + st.max + (st.unit ? ' ' + st.unit : '') + '.');
    else say('');
    last = n;
    spec.set(n);
  });
  i.addEventListener('blur', () => {
    let n = parseNumber(i.value);
    if (i.value.trim() === '') n = (typeof st.default === 'number') ? st.default : NaN;
    if (!Number.isFinite(n)) n = typeof last === 'number' ? last : (typeof st.default === 'number' ? st.default : NaN);
    if (Number.isFinite(n)) {
      if (typeof st.min === 'number' && n < st.min) n = st.min;
      if (typeof st.max === 'number' && n > st.max) n = st.max;
      if (n !== spec.value || i.value !== String(n)) { i.value = String(n); spec.set(n); }
    }
    say('');
    if (spec.done) spec.done();
  });
  if (spec.fid) i.dataset.fid = spec.fid;
  return el('div', { class: 'pfb-num' }, wrap, hint);
}

export function selectField(spec) {
  const st = spec.st;
  const s = el('select', { class: 'sel-input', 'aria-label': st.label || st.key });
  const v = spec.value === undefined || spec.value === null ? '' : String(spec.value);
  for (const [val, label] of optionPairs(st)) s.appendChild(el('option', { value: val, text: label }));
  s.value = v;
  s.addEventListener('change', () => { spec.set(s.value); if (spec.done) spec.done(); });
  if (spec.fid) s.dataset.fid = spec.fid;
  return s;
}

export function boolField(spec) {
  const st = spec.st;
  const lab = el('label', { class: 'toggle-switch' });
  const i = el('input', { type: 'checkbox', checked: !!spec.value, 'aria-label': st.label || st.key });
  i.addEventListener('change', () => { spec.set(!!i.checked); if (spec.done) spec.done(); });
  if (spec.fid) i.dataset.fid = spec.fid;
  lab.appendChild(i);
  lab.appendChild(el('span', { class: 'toggle-track' }, el('span', { class: 'toggle-knob' })));
  return lab;
}

export function textareaField(spec, code) {
  const st = spec.st;
  const t = el('textarea', { class: 'txt-input' + (code ? ' pfb-codearea' : ''), rows: String(st.rows || (code ? 8 : 3)), placeholder: st.placeholder || '', spellcheck: 'false', 'aria-label': st.label || st.key });
  t.value = spec.value === undefined || spec.value === null ? '' : String(spec.value);
  t.addEventListener('input', () => spec.set(t.value));
  if (code) {
    // Tab writes four spaces (Python indentation); Escape lets Tab move the focus on again.
    let trap = true;
    t.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { trap = false; return; }
      if (e.key === 'Tab' && trap && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        const a = t.selectionStart, b = t.selectionEnd;
        t.value = t.value.slice(0, a) + '    ' + t.value.slice(b);
        t.selectionStart = t.selectionEnd = a + 4;
        spec.set(t.value);
      }
    });
    t.addEventListener('focus', () => { trap = true; });
  }
  focusHooks(t, spec);
  return t;
}

// An attribute name: free text with suggestions for the element's class (description first,
// code second). Without a class there is nothing to suggest yet; the field says so.
export function attrField(spec) {
  const st = spec.st;
  const i = el('input', { type: 'text', class: 'txt-input', value: spec.value === undefined || spec.value === null ? '' : String(spec.value), placeholder: st.placeholder || 'e.g. m:u or pgini', spellcheck: 'false', 'aria-label': st.label || st.key });
  i.addEventListener('input', () => spec.set(i.value));
  focusHooks(i, spec);
  attachCombo(i, (q) => {
    const cls = spec.classOf ? spec.classOf() : '';
    if (!cls) return [];
    return attrSuggestions(cls, q, { attrs: st.attrs, study: st.study });
  }, (it) => { i.value = it.value; spec.set(it.value); if (spec.done) spec.done(); }, {
    empty: (spec.classOf && spec.classOf()) ? 'Nothing matches: type the attribute yourself.' : 'Choose the kind of element first to see its attributes.',
    minWidth: 320,
  });
  return i;
}

// The classes an element picker offers: the input's kinds (plain names first), else every class
// grouped. A class the workflow already holds but the list does not know stays selectable.
export function classOptions(kinds, current) {
  const known = new Map(ELEMENT_CLASSES.map(c => [c[0], c]));
  const opts = [];
  if (Array.isArray(kinds) && kinds.length) {
    for (const k of kinds) {
      const c = known.get(k);
      opts.push({ value: k, label: c ? `${c[1]} (${c[0]})` : k, group: '' });
    }
  } else {
    for (const c of ELEMENT_CLASSES) opts.push({ value: c[0], label: `${c[1]} (${c[0]})`, group: c[2] });
  }
  if (current && !opts.some(o => o.value === current)) opts.push({ value: current, label: current, group: '' });
  return opts;
}

// The element picker (DESIGN 8, U7): what kind of element, its name exactly as in the Data
// Manager, and what to do when the name matches none or several.
export function elementField(spec) {
  const st = spec.st;
  const v = spec.value && typeof spec.value === 'object' ? spec.value : { cls: '', name: '', match: 'one' };
  const cur = { cls: v.cls || '', name: v.name || '', match: v.match || 'one' };
  const kinds = spec.kinds || st.kinds;
  const opts = classOptions(kinds, cur.cls);
  // A single kind needs no choosing: it is filled in.
  if (!cur.cls && opts.length === 1) cur.cls = opts[0].value;
  const box = el('div', { class: 'pfb-elpick' });
  const cls = el('select', { class: 'sel-input pfb-el-cls', 'aria-label': (st.label || 'Element') + ': kind of element' });
  if (!cur.cls) cls.appendChild(el('option', { value: '', text: 'Choose the kind of element' }));
  let group = null, parent = cls;
  for (const o of opts) {
    if (o.group && o.group !== group) { group = o.group; parent = el('optgroup', { label: o.group }); cls.appendChild(parent); }
    else if (!o.group) parent = cls;
    parent.appendChild(el('option', { value: o.value, text: o.label }));
  }
  cls.value = cur.cls;
  const name = el('input', { type: 'text', class: 'txt-input pfb-el-name', value: cur.name, placeholder: 'Exactly as in the Data Manager, e.g. G 02', spellcheck: 'false', 'aria-label': (st.label || 'Element') + ': name' });
  const match = el('select', { class: 'sel-input sel-sm pfb-el-match', 'aria-label': (st.label || 'Element') + ': when the name matches' });
  for (const [val, label] of MATCH_OPTIONS) match.appendChild(el('option', { value: val, text: label }));
  match.value = MATCH_OPTIONS.some(m => m[0] === cur.match) ? cur.match : 'one';
  const send = (patch) => { Object.assign(cur, patch); spec.set({ ...(spec.value && typeof spec.value === 'object' ? spec.value : {}), ...cur }); };
  cls.addEventListener('change', () => { send({ cls: cls.value }); if (spec.done) spec.done(); });
  name.addEventListener('input', () => send({ name: name.value }));
  name.addEventListener('blur', () => { if (spec.done) spec.done(); });
  match.addEventListener('change', () => { send({ match: match.value }); if (spec.done) spec.done(); });
  if (spec.fid) { cls.dataset.fid = spec.fid + ':cls'; name.dataset.fid = spec.fid + ':name'; match.dataset.fid = spec.fid + ':match'; }
  box.appendChild(cls);
  box.appendChild(el('div', { class: 'pfb-el-row' },
    name,
    el('span', { class: 'tip-icon', 'data-tip': esc(tipText('Letter case counts. * matches anything, e.g. G* for every name that starts with G.')) }, '?')));
  box.appendChild(el('div', { class: 'pfb-el-row pfb-el-matchrow' }, el('span', { class: 'pfb-el-lab', text: 'If the name matches' }), match));
  // A single kind shows as chosen but is only saved with the first edit (the name is needed
  // anyway): drawing the inspector never changes the workflow.
  return box;
}

export function buildField(spec) {
  switch (spec.st.kind) {
    case 'number': return numberField(spec);
    case 'select': return selectField(spec);
    case 'bool': return boolField(spec);
    case 'textarea': return textareaField(spec, false);
    case 'code': return textareaField(spec, true);
    case 'attr': return attrField(spec);
    case 'element': return elementField(spec);
    case 'text':
    default: return textField(spec);
  }
}
