// The Graph style modal (opened from the workflow's own settings, and from a graph block's):
// templates to start from, every part of the look to change, and a preview drawn the way the
// script draws (graphpreview.js). The style is one setting of the whole workflow (`graph`,
// core/graphstyle.js), so it travels with the .json, the mini cache and the .py.
//
// Edits apply as they are made, each an undo step (a colour dragged or a number typed is one
// step, closed when the field lets go), so every way out (Done, the cross, Esc, a click beside
// the modal) keeps them. Undo and redo work while it is open, and the form follows them.
//
// Plain DOM, built once on first open.

import { el, esc, tipText, iconButton, lsGet, lsSet } from './dom.js';
import { numberField, selectField, boolField } from './fields.js';
import * as G from '../core/graphstyle.js';
import { previewSvg, PREVIEW_KINDS } from './graphpreview.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const LS_KIND = 'pfb-gs-kind';

// The words of each colour field.
const COLOR_FIELDS = [
  ['background', 'Background', 'Behind the whole graph.'],
  ['plot_background', 'Plot area', 'Behind the lines, inside the axes.'],
  ['text', 'Title and key', 'The title, the key’s words and marked points.'],
  ['muted', 'Axis words', 'Axis numbers and titles, limit lines and event lines.'],
  ['grid', 'Grid lines', 'The lines behind the data.'],
  ['axis', 'Axis lines', 'The frame and the tick marks.'],
];

export function mountGraphStyle(app) {
  const store = app.store;
  let overlay = null, dialog = null, form = null, view = null, nameEl = null, capEl = null, opener = null;
  let selfEdit = false;
  let kind = lsGet(LS_KIND, 'series');
  if (!PREVIEW_KINDS.some(([k]) => k === kind)) kind = 'series';

  const cur = () => G.styleOf(store.get().wf);
  const isOpen = () => !!overlay && !overlay.hidden;

  // ---- Changing the style
  function setStyle(next, key) {
    const w = store.get().wf;
    // Keys a newer Builder saved stay on the workflow as they were.
    const keep = isObj(w.graph) ? w.graph : {};
    selfEdit = true;
    try { store.commit({ ...w, graph: { ...keep, ...G.normalizeStyle(next) } }, key ? { key: 'graph:' + key } : {}); } finally { selfEdit = false; }
    if (!key) store.endCoalesce();
    paint();
  }
  const patch = (k, v, ongoing) => setStyle({ ...cur(), [k]: v }, ongoing ? k : null);
  const done = () => store.endCoalesce();

  // ---- Building
  function build() {
    nameEl = el('span', { class: 'pfb-gs-name' });
    const close = iconButton('close', 'Close. Your changes are already kept', 'pfb-gs-close');
    close.addEventListener('click', closeIt);
    form = el('div', { class: 'pfb-gs-form' });
    // Every graph the script draws, in one dropdown: lines and bars, then maps and 3D.
    const seg = el('select', { class: 'sel-input pfb-gs-kinds', 'aria-label': 'Sample graph' });
    for (const [row, words] of [['lines', 'Lines and bars'], ['maps', 'Maps and 3D']]) {
      const group = el('optgroup', { label: words });
      for (const [k, name] of PREVIEW_KINDS.filter(x => x[2] === row)) group.appendChild(el('option', { value: k, text: name }));
      seg.appendChild(group);
    }
    seg.value = kind;
    seg.addEventListener('change', () => { kind = seg.value; lsSet(LS_KIND, kind); paintPreview(); });
    view = el('div', { class: 'pfb-gs-canvas' });
    capEl = el('p', { class: 'pfb-gs-cap' });
    const reset = el('button', { type: 'button', class: 'btn-secondary', text: '↺ Reset', title: 'Put the Adjie Brotools style back (Undo brings yours back)' });
    reset.addEventListener('click', () => {
      if (G.sameStyle(cur(), G.defaultStyle())) return;
      if (!confirm('Put the Adjie Brotools style back? Undo brings yours back.')) return;
      setStyle(G.defaultStyle());
      renderForm();
    });
    const ok = el('button', { type: 'button', class: 'btn-primary', text: '✓ Done' });
    ok.addEventListener('click', closeIt);
    dialog = el('div', { class: 'pfb-gs', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'pfbGsTitle', tabindex: '-1' },
      el('div', { class: 'pfb-gs-head' }, el('h2', { id: 'pfbGsTitle', text: 'Graph style' }), nameEl, close),
      el('div', { class: 'pfb-gs-body' },
        el('div', { class: 'pfb-gs-view' }, seg, view, capEl),
        form),
      el('div', { class: 'pfb-gs-foot' },
        el('span', { class: 'pfb-gs-note', text: 'Every graph in this workflow draws in this style. Changes are kept as you make them.' }),
        reset, ok));
    overlay = el('div', { class: 'pfb-gs-overlay', id: 'pfbGraphStyle', hidden: true, 'data-no-persist': true, 'data-no-abbr': true }, dialog);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closeIt(); });
    // On the document: a redraw of the form (after an undo) can leave the focus on the page.
    document.addEventListener('keydown', (e) => { if (isOpen()) onKey(e); });
    document.body.appendChild(overlay);
    if (typeof ResizeObserver === 'function') new ResizeObserver(() => { if (isOpen()) paintPreview(); }).observe(view);
  }

  function onKey(e) {
    // A dropdown's open list takes its own Escape first (and prevents it).
    if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); closeIt(); return; }
    if (e.key !== 'Tab') return;
    // Keep the keyboard inside the modal.
    const f = [...dialog.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // ---- The form
  function tip(text) { return text ? el('span', { class: 'tip-icon', 'data-tip': esc(tipText(text)) }, '?') : null; }
  function row(label, tipWords, field, key) {
    return el('div', { class: 'field-row pfb-set', dataset: { key } }, el('div', { class: 'pfb-lab' }, el('span', { class: 'field-label', text: label }), tip(tipWords)), field);
  }
  function toggleRow(label, tipWords, field, key) {
    return el('div', { class: 'toggle-row pfb-set', dataset: { key } }, el('div', { class: 'toggle-label' }, el('span', { class: 'pfb-lab' }, el('span', { text: label }), tip(tipWords))), field);
  }
  function group(title, ...rows) { return el('div', { class: 'field-group' }, el('div', { class: 'group-title', text: title }), ...rows); }

  const num = (s, key, label, unit, tipWords) => row(label, tipWords, numberField({
    st: { key, label, unit, min: G.RANGES[key][0], max: G.RANGES[key][1], default: G.defaultStyle()[key] },
    value: s[key], fid: 'gs:' + key, set: (v) => patch(key, v, true), done,
  }), key);
  const sel = (s, key, label, tipWords, options) => row(label, tipWords, selectField({
    st: { key, label, options: options || G.CHOICES[key] }, value: s[key], fid: 'gs:' + key,
    set: (v) => patch(key, v), done,
  }), key);
  const bool = (s, key, label, tipWords) => toggleRow(label, tipWords, boolField({
    st: { key, label }, value: s[key], fid: 'gs:' + key, set: (v) => patch(key, v), done,
  }), key);

  // A colour: the browser's picker and its hex code, kept in step.
  function colorPair(value, label, onSet) {
    const pick = el('input', { type: 'color', class: 'pfb-gs-pick', value: value.toLowerCase(), 'aria-label': label });
    const hex = el('input', { type: 'text', class: 'txt-input pfb-gs-hex', value, spellcheck: 'false', maxlength: '7', 'aria-label': label + ' (hex code)' });
    pick.addEventListener('input', () => { hex.value = pick.value.toUpperCase(); onSet(hex.value, true); });
    pick.addEventListener('change', done);
    hex.addEventListener('input', () => { const c = G.hexColor(hex.value); hex.classList.toggle('pfb-invalid', !c); if (c) { pick.value = c.toLowerCase(); onSet(c, true); } });
    hex.addEventListener('blur', () => { const c = G.hexColor(hex.value); hex.value = c || pick.value.toUpperCase(); hex.classList.remove('pfb-invalid'); done(); });
    return el('div', { class: 'pfb-gs-color' }, pick, hex);
  }

  function seriesRow(s) {
    const box = el('div', { class: 'pfb-gs-swatches' });
    s.colors.forEach((c, i) => {
      const pick = el('input', { type: 'color', class: 'pfb-gs-pick', value: c.toLowerCase(), 'aria-label': 'Colour of line ' + (i + 1), title: 'Line ' + (i + 1) + ': ' + c });
      pick.addEventListener('input', () => { const cs = [...cur().colors]; cs[i] = pick.value.toUpperCase(); pick.title = 'Line ' + (i + 1) + ': ' + cs[i]; patch('colors', cs, true); });
      pick.addEventListener('change', done);
      box.appendChild(pick);
    });
    if (s.colors.length < G.MAX_COLORS) {
      const add = el('button', { type: 'button', class: 'btn-secondary btn-sm pfb-gs-add', text: '+', title: 'Add a colour', 'aria-label': 'Add a colour' });
      add.addEventListener('click', () => {
        const cs = [...cur().colors];
        // The next colour of the palette these came from, else a mix of the first two.
        const pal = G.PALETTES.find(p => cs.every((c, k) => p.colors[k] === c) && p.colors.length > cs.length);
        cs.push(pal ? pal.colors[cs.length] : G.mixColor(cs[0], cs[cs.length - 1], 0.5).toUpperCase());
        patch('colors', cs); renderForm();
      });
      box.appendChild(add);
    }
    if (s.colors.length > 1) {
      const del = iconButton('trash', 'Remove the last colour', 'pfb-gs-del');
      del.addEventListener('click', () => { patch('colors', cur().colors.slice(0, -1)); renderForm(); });
      box.appendChild(del);
    }
    const palSel = el('select', { class: 'sel-input pfb-gs-pal', 'aria-label': 'Fill the colours from a palette' });
    palSel.appendChild(el('option', { value: '', text: 'Fill from a palette' }));
    for (const p of G.PALETTES) palSel.appendChild(el('option', { value: p.id, text: p.name + ' (' + p.colors.length + ')' }));
    palSel.addEventListener('change', () => {
      const p = G.PALETTES.find(x => x.id === palSel.value);
      if (p) { patch('colors', [...p.colors]); renderForm(); }
    });
    return el('div', { class: 'field-row pfb-set', dataset: { key: 'colors' } },
      el('div', { class: 'pfb-lab' }, el('span', { class: 'field-label', text: 'Line colours' }),
        tip('In order: the first line takes the first colour. More lines than colours take them again, paler, then the ramp below.')),
      box, palSel);
  }

  function rampRow(s) {
    const opts = Object.entries(G.RAMPS).map(([id, r]) => [id, r.name]);
    const strip = el('div', { class: 'pfb-gs-ramp', style: { background: 'linear-gradient(90deg,' + G.RAMPS[s.ramp].stops.join(',') + ')' } });
    const field = selectField({ st: { key: 'ramp', label: 'Colour ramp', options: opts }, value: s.ramp, fid: 'gs:ramp', set: (v) => { patch('ramp', v); strip.style.background = 'linear-gradient(90deg,' + G.RAMPS[v].stops.join(',') + ')'; }, done });
    return el('div', { class: 'field-row pfb-set', dataset: { key: 'ramp' } },
      el('div', { class: 'pfb-lab' }, el('span', { class: 'field-label', text: 'Colour ramp' }), tip('Heat maps, 3D surfaces and points, and a graph with more lines than twice the colours (every pass of a sweep).')),
      field, strip);
  }

  function templatesRow(s) {
    const match = G.matchTemplate(s);
    const grid = el('div', { class: 'pfb-gs-tpls', role: 'group', 'aria-label': 'Templates' });
    for (const t of G.TEMPLATES) {
      const on = !!match && match.id === t.id;
      const b = el('button', { type: 'button', class: 'pfb-gs-tpl' + (on ? ' on' : ''), dataset: { tpl: t.id }, 'aria-pressed': on ? 'true' : 'false', title: t.desc },
        // Every card at one shape, so the grid stays even (Report and Presentation are other sizes).
        el('span', { class: 'pfb-gs-thumb', html: previewSvg({ ...t.style, width: 10, height: 5.6 }, { kind: 'series', width: 128, thumb: true }) }),
        el('span', { class: 'pfb-gs-tpl-name', text: t.name }),
        t.id === G.DEFAULT_TEMPLATE ? el('span', { class: 'pfb-gs-tpl-tag', text: 'Default' }) : null);
      b.addEventListener('click', () => { setStyle(G.styleFromTemplate(t.id)); renderForm(); });
      grid.appendChild(b);
    }
    return el('div', { class: 'pfb-gs-tplbox' }, grid);
  }

  function fontRow(s) {
    const opts = G.FONTS.map(f => [f.value, f.label]);
    if (!opts.some(([v]) => v === s.font)) opts.push([s.font, s.font + ' (set in the file)']);
    return sel(s, 'font', 'Font', 'A computer without this font uses one of the same kind (Segoe UI or Arial; Times New Roman for a serif). DM Sans comes with the study package.', opts);
  }

  function renderForm() {
    if (!form) return;
    const s = cur();
    const scroll = form.scrollTop;
    // The field with the focus gets it back after the redraw (found by its data-fid or key).
    const a = document.activeElement;
    const had = a && form.contains(a) ? (a.dataset.fid ? '[data-fid="' + a.dataset.fid + '"]' : a.dataset.tpl ? '[data-tpl="' + a.dataset.tpl + '"]' : null) : null;
    const lost = a && form.contains(a);
    form.textContent = '';
    form.appendChild(group('Start from a template', templatesRow(s)));
    form.appendChild(group('Colours', seriesRow(s), rampRow(s),
      el('div', { class: 'field-row pfb-gs-colgrid' }, ...COLOR_FIELDS.map(([key, label, words]) =>
        el('div', { class: 'pfb-gs-colcell pfb-set', dataset: { key } },
          el('div', { class: 'pfb-lab' }, el('span', { class: 'field-label', text: label }), tip(words)),
          colorPair(s[key], label, (c, ongoing) => patch(key, c, ongoing)))))));
    form.appendChild(group('Text', fontRow(s),
      num(s, 'font_size', 'Text size', 'pt', 'The axis numbers. Axis titles and the key are drawn at about this size too.'),
      num(s, 'title_size', 'Title size', 'pt'),
      bool(s, 'title_bold', 'Bold title'),
      sel(s, 'title_align', 'Title position')));
    form.appendChild(group('Axes and grid',
      sel(s, 'grid_axes', 'Grid lines', 'Across: a line at each value. Up: a line at each time (or x value). Bars only ever take the lines across.'),
      sel(s, 'grid_style', 'Grid line style'),
      sel(s, 'frame', 'Frame', 'Which sides of the plot have an axis line.'),
      sel(s, 'ticks', 'Tick marks'),
      bool(s, 'thousands', 'Group thousands (1,200)', 'Write 1,200 rather than 1200 on the axes. An axis whose title says Year is left alone.')));
    form.appendChild(group('Lines and key',
      num(s, 'line_width', 'Line width', 'pt'),
      sel(s, 'markers', 'Points on 2D lines', 'A dot at each value of a 2D graph or a graph from a results table. Time series never have them.'),
      sel(s, 'line_styles', 'Line patterns', 'Solid, dashed, dotted ... in turn tells the lines apart where colour is lost: a paper printed in black and white (IEEE asks for it). Bars and points stay as they are.'),
      sel(s, 'legend', 'Key', 'Where the key (legend) goes when a graph has more than one line. Inside takes the first corner or side where it covers no line, point or bar; with none clear it goes under the graph. Lines named by one loop (Dispatch (MW) = 100, 125 ...) write its name once, over the key.'),
      bool(s, 'legend_frame', 'Box around the key')));
    const [pw, ph] = G.pixelsOf(s);
    form.appendChild(group('Image',
      num(s, 'width', 'Width', 'in', 'In inches, the size the graph is laid out at. A report page is about 6.5 in wide.'),
      num(s, 'height', 'Height', 'in'),
      num(s, 'dpi', 'Resolution', 'dpi', 'Dots per inch. 150 suits the screen; 300 suits print.'),
      el('p', { class: 'pfb-gs-px', text: 'Each PNG is ' + pw + ' × ' + ph + ' pixels.' }),
      bool(s, 'transparent', 'Transparent background', 'No background colour behind the graph, for a slide of its own colour.'),
      sel(s, 'also_save', 'Also save', 'A vector copy beside each PNG, with the same name. The block’s Path output stays the PNG.')));
    form.scrollTop = scroll;
    if (lost) {
      const back = had && form.querySelector(had);
      try { (back || dialog).focus({ preventScroll: true }); } catch (e) { /* gone */ }
    }
  }

  // ---- What follows every change (cheap): the name, the template marks, the preview.
  function paint() {
    if (!overlay) return;
    const s = cur();
    nameEl.textContent = G.styleName(s);
    const match = G.matchTemplate(s);
    for (const b of form.querySelectorAll('.pfb-gs-tpl')) { const on = !!match && match.id === b.dataset.tpl; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
    const px = form.querySelector('.pfb-gs-px');
    if (px) { const [w, h] = G.pixelsOf(s); px.textContent = 'Each PNG is ' + w + ' × ' + h + ' pixels.'; }
    paintPreview();
  }
  function paintPreview() {
    if (!view) return;
    const s = cur();
    const w = Math.max(120, Math.floor(view.clientWidth || 520));
    view.classList.toggle('pfb-gs-clear', !!s.transparent);
    view.innerHTML = previewSvg(s, { kind, width: w });
    const font = s.font === 'DM Sans' ? 'DM Sans comes with the study package (⬇ Download).' : 'Drawn in ' + s.font + ' where the computer has it.';
    capEl.textContent = 'How the script draws it, at ' + G.pixelsOf(s).join(' × ') + ' px. ' + font;
  }

  // ---- Open and close
  function open(from) {
    if (!overlay) build();
    opener = from || document.activeElement;
    overlay.hidden = false;
    document.body.classList.add('pfb-gs-open');
    renderForm();
    paint();
    requestAnimationFrame(() => {
      paintPreview();
      const first = form.querySelector('.pfb-gs-tpl.on') || form.querySelector('.pfb-gs-tpl');
      if (first) first.focus({ preventScroll: true });
    });
  }
  function closeIt() {
    if (!isOpen()) return;
    done();
    overlay.hidden = true;
    document.body.classList.remove('pfb-gs-open');
    // The button that opened it was drawn again with the new style's name: focus that one.
    const back = opener && document.body.contains(opener) ? opener : (opener && opener.classList && opener.classList.contains('pfb-gs-open') ? document.querySelector('#pfbInspector .pfb-gs-open') : null);
    if (back) { try { back.focus({ preventScroll: true }); } catch (e) { /* gone */ } }
    opener = null;
  }

  // Undo, redo, an Open or a template from elsewhere: the form follows.
  store.subscribe((s, prev) => {
    if (!isOpen() || selfEdit || s.wf === prev.wf) return;
    if (JSON.stringify(s.wf.graph || null) === JSON.stringify(prev.wf.graph || null)) return;
    renderForm();
    paint();
  });

  return { open, close: closeIt, isOpen };
}
