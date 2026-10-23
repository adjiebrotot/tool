// One editor per setting kind (registry SETTING_KINDS), used by the inspector for block settings,
// input fallbacks and the columns of list rows. Each editor is plain DOM built from the site's
// components (.txt-input, .affix-wrap, select, .toggle-switch, .combo-input) and reports edits
// through spec.set(value). The inspector owns undo: an edit made while a field has the focus
// joins one undo step, closed on blur (spec.done()).
//
// spec = { st, value, set(value), done(), fid, kinds?, classOf?(), suggest?(), columns?(), study? }
//
// A setting with `suggest: 'columns'` names a column of a results table (one per line in a
// textarea). spec.columns() gives { items: [{ value, main, group? }], known: [...] | null,
// table, empty }: the list offers `items`; when `known` is set (every column of the table is
// known), a name outside it is flagged under the field. It stays free text: a table read from
// a file has columns the page cannot see.

import { el, esc, tipText, iconButton, downloadText } from './dom.js';
import { optionPairs, ELEMENT_CLASSES } from '../core/registry.js';
import { attachCombo } from './combo.js';
import { attrSuggestions } from './attrs.js';
import { columnList } from '../core/blockkit.js';
import { templateCsv, MAX_FILE } from './attach.js';
import { scheduleField } from './schedule.js';

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
  if (st.suggest === 'columns' && spec.columns) return columnField(spec, false);
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
  // optionsFor(s) leaves out the options that cannot apply right now. The value in use is always
  // offered, so a workflow saved with an option that no longer fits still shows what it holds.
  let pairs = optionPairs(st);
  if (typeof st.optionsFor === 'function' && spec.settings) {
    try {
      const want = st.optionsFor(spec.settings);
      if (Array.isArray(want) && want.length) {
        const keep = new Set(want.map(String));
        const some = pairs.filter(p => keep.has(p[0]) || p[0] === v);
        if (some.length) pairs = some;
      }
    } catch (e) { /* keep them all */ }
  }
  for (const [val, label] of pairs) s.appendChild(el('option', { value: val, text: label }));
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
  if (!code && st.suggest === 'columns' && spec.columns) return columnField(spec, true);
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

// A column name (or, `many`, one per line / separated by commas) with the table's columns
// offered under it, and a line under the field when a name is not one of them.
function columnField(spec, many) {
  const st = spec.st;
  const value = spec.value === undefined || spec.value === null ? '' : String(spec.value);
  const i = many
    ? el('textarea', { class: 'txt-input', rows: String(st.rows || 3), placeholder: st.placeholder || '', spellcheck: 'false', 'aria-label': st.label || st.key })
    : el('input', { type: 'text', class: 'txt-input', value, placeholder: st.placeholder || '', spellcheck: 'false', 'aria-label': st.label || st.key });
  if (many) i.value = value;
  const hint = el('div', { class: 'field-sub pfb-col-hint', hidden: true });
  const names = () => (many ? columnList(i.value) : [i.value.trim()].filter(Boolean));
  const check = () => {
    const c = spec.columns() || {};
    const bad = c.known ? names().filter(n => !c.known.includes(n)) : [];
    hint.textContent = !bad.length ? '' : (bad.length === 1 ? '"' + bad[0] + '" is not a column of "' + c.table + '"' : bad.map(b => '"' + b + '"').join(', ') + ' are not columns of "' + c.table + '"') + '. Pick from the list; names must match exactly.';
    hint.hidden = !bad.length;
    i.classList.toggle('pfb-col-bad', bad.length > 0);
  };
  // In a list, what is being typed is the last line when it is not a whole column name yet.
  const partial = () => {
    if (!many) return i.value;
    const last = i.value.split(/\r?\n/).pop();
    const c = spec.columns() || {};
    return (c.items || []).some(it => it.value === last.trim()) ? '' : last;
  };
  i.addEventListener('input', () => { spec.set(i.value); check(); });
  focusHooks(i, spec);
  attachCombo(i, (q) => {
    const c = spec.columns() || {};
    const used = many ? names() : [];
    // A field that already holds a whole column name shows them all, to switch to another.
    const typed = many ? partial() : (c.items || []).some(it => it.value === q.trim()) ? '' : q;
    const ql = typed.trim().toLowerCase();
    return (c.items || []).filter(it => !used.includes(it.value) && (!ql || it.value.toLowerCase().includes(ql)));
  }, (it) => {
    if (many) {
      const lines = i.value.split(/\r?\n/);
      if (partial().trim()) lines.pop();
      while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
      i.value = [...lines, it.value].join('\n');
    } else i.value = it.value;
    spec.set(i.value);
    check();
    if (spec.done) spec.done();
  }, { empty: () => (spec.columns() || {}).empty || 'No columns known yet: type the name as in the table.', minWidth: 240 });
  check();
  return el('div', { class: 'pfb-colfield' }, i, hint);
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
  // "If the name matches" only has something to decide once the name can match more than one
  // element: a name with * or ?, or a picker already set to first or all. It appears as soon as
  // a wildcard is typed and goes again when it is taken out.
  const matchRow = el('div', { class: 'pfb-el-row pfb-el-matchrow' }, el('span', { class: 'pfb-el-lab', text: 'If the name matches' }), match);
  const manyPossible = () => /[*?]/.test(name.value) || match.value !== 'one';
  const syncMatchRow = () => { matchRow.hidden = !manyPossible(); };
  syncMatchRow();
  name.addEventListener('input', syncMatchRow);
  match.addEventListener('change', syncMatchRow);
  box.appendChild(matchRow);
  // A single kind shows as chosen but is only saved with the first edit (the name is needed
  // anyway): drawing the inspector never changes the workflow.
  return box;
}

// ---------------------------------------------------------------------------------------------
// An attached data file (a case table). The card is the whole story: the file, what was read
// out of it, and the line that says the file stays in this browser.
//
// spec.file = { has, pick(File), clear(), setSheet(name), redecode(), bytes(), error }
// pick / setSheet / redecode return a promise of { ok, error }.

// The file's own name out of a path, whichever slash it uses.
const baseName = (p) => String(p || '').split('/').pop().split(String.fromCharCode(92)).pop();

const kb = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + ' MB' : n >= 1000 ? Math.round(n / 1000) + ' kB' : n + ' B');

const PRIVACY = 'This page has no server: the file is read here in your browser and kept inside your own workflow. Nothing is uploaded anywhere.';

export function fileField(spec) {
  const st = spec.st, F = spec.file || {};
  const meta = spec.value && typeof spec.value === 'object' ? spec.value : {};
  const box = el('div', { class: 'pfb-file' });
  const input = el('input', { type: 'file', accept: st.accept || '.csv,.txt,.tsv,.xlsx,.xlsm', hidden: true });
  const msg = el('div', { class: 'field-sub pfb-file-msg', hidden: true });
  const say = (text, bad) => { msg.textContent = text || ''; msg.hidden = !text; msg.classList.toggle('pfb-file-bad', !!bad); };
  let busy = false;
  const run = (p, working) => {
    if (busy) return;
    busy = true;
    say(working);
    Promise.resolve(p).then((r) => { busy = false; if (r && r.ok === false) say(r.error || 'The file could not be read.', true); else say(''); },
      (e) => { busy = false; say((e && e.message) || 'The file could not be read.', true); });
  };
  input.addEventListener('change', () => {
    const f = input.files && input.files[0];
    input.value = '';
    if (!f) return;
    if (f.size > MAX_FILE) { say(`${f.name} is ${kb(f.size)}. Files up to ${kb(MAX_FILE)} can be attached; for a bigger one keep it next to the script and type its name below.`, true); return; }
    run(F.pick(f), 'Reading ' + f.name + '…');
  });
  box.appendChild(input);

  if (!meta.name) {
    const named = String((F.path && F.path()) || '').trim();
    const drop = el('button', { type: 'button', class: 'pfb-file-drop', 'aria-label': 'Attach a data file' },
      el('span', { class: 'pfb-file-drop-main', text: named ? '⬆ Attach ' + baseName(named) : '⬆ Choose a CSV or Excel file' }),
      el('span', { class: 'pfb-file-drop-sub', text: named
        ? 'The script reads it where it runs. Attach it to put it in the study package and to see its columns here.'
        : 'or drop it here. The columns are read here in your browser.' }));
    drop.addEventListener('click', () => input.click());
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
    drop.addEventListener('dragover', (e) => { stop(e); e.dataTransfer.dropEffect = 'copy'; drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => {
      stop(e);
      drop.classList.remove('over');
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) run(F.pick(f), 'Reading ' + f.name + '…');
    });
    if (spec.fid) drop.dataset.fid = spec.fid;
    box.appendChild(drop);
  } else {
    const head = el('div', { class: 'pfb-file-head' },
      el('span', { class: 'pfb-file-name', text: meta.name, title: meta.name }),
      el('span', { class: 'pfb-file-size', text: meta.size ? kb(meta.size) : '' }));
    const swap = el('button', { type: 'button', class: 'btn-bare pfb-file-swap', text: 'Replace' });
    swap.addEventListener('click', () => input.click());
    const del = iconButton('trash', 'Remove this file', 'sm');
    del.addEventListener('click', () => { F.clear(); });
    head.appendChild(swap);
    head.appendChild(del);
    if (spec.fid) swap.dataset.fid = spec.fid;
    box.appendChild(head);

    if (!F.has) {
      box.appendChild(el('div', { class: 'pfb-file-note pfb-file-bad' },
        el('span', { text: 'This workflow came from a .py, which never carries data. Replace to attach ' + meta.name + ' again, or leave it: the script still reads that file name where it runs.' })));
    }
    if (Array.isArray(meta.sheets) && meta.sheets.length > 1) {
      const sel = el('select', { class: 'sel-input sel-sm', 'aria-label': 'Sheet' });
      for (const nm of meta.sheets) sel.appendChild(el('option', { value: nm, text: nm }));
      sel.value = meta.sheet || meta.sheets[0];
      sel.disabled = !F.has;
      sel.addEventListener('change', () => run(F.setSheet(sel.value), 'Reading ' + sel.value + '…'));
      box.appendChild(el('div', { class: 'pfb-file-row' }, el('span', { class: 'pfb-file-lab', text: 'Sheet' }), sel));
    }
    const cols = Array.isArray(meta.cols) ? meta.cols : [];
    if (cols.length) {
      const chips = el('div', { class: 'pfb-file-cols' });
      for (const c of cols.slice(0, 24)) chips.appendChild(el('span', { class: 'pfb-chip', text: c, title: c }));
      if (cols.length > 24) chips.appendChild(el('span', { class: 'pfb-chip pfb-chip-more', text: '+' + (cols.length - 24) + ' more' }));
      box.appendChild(el('div', { class: 'pfb-file-sum', text: `${meta.rows} ${meta.rows === 1 ? 'row' : 'rows'}, ${cols.length} ${cols.length === 1 ? 'column' : 'columns'}:` }));
      box.appendChild(chips);
      box.appendChild(el('div', { class: 'pfb-file-note' },
        el('span', { text: 'Every column can be used as a value: Table column reads one, and For each item loops over the rows.' })));
    } else if (F.has) {
      box.appendChild(el('div', { class: 'pfb-file-sum pfb-file-bad', text: 'No columns were found. Check which row holds the names under More options.' }));
    }
  }

  const tmpl = el('button', { type: 'button', class: 'btn-bare pfb-file-tmpl', text: '⬇ Example file' });
  tmpl.addEventListener('click', () => downloadText(templateCsv(meta.cols), 'case-table-template.csv', 'text/csv'));
  box.appendChild(el('div', { class: 'pfb-file-foot' },
    el('span', { class: 'pfb-file-priv' },
      el('span', { class: 'pfb-lock', 'aria-hidden': 'true', text: '🔒' }),
      el('span', { text: 'Read in your browser. Nothing is uploaded.' }),
      el('span', { class: 'tip-icon', 'data-tip': esc(tipText(PRIVACY)) }, '?')),
    tmpl));
  box.appendChild(msg);
  // A decode option changed under the card (which row holds the names, the decimal comma):
  // the file is still here, so read it again rather than showing columns that are out of date.
  if (meta.name && F.has && F.stale) setTimeout(() => F.stale(meta), 0);
  return box;
}

export function buildField(spec) {
  switch (spec.st.kind) {
    case 'number': return numberField(spec);
    case 'file': return fileField(spec);
    case 'schedule': return scheduleField(spec);
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
