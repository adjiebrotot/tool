/* ──────────────────────────────────────────────────────────────────────────
   Dropdowns: a plain <select>'s open list, drawn in the site's own panel
   Load it on every page beside dropdown.css (tools: just before shared.js).
   No setup: it listens on the document, so a select added later is covered.

   The browser draws a select's open list itself, in its own font and
   colours, which no stylesheet can reach. So a mouse press on a select opens
   a .combo-list instead (dropdown.css), the same panel a searchable combobox
   uses, and a pick goes back into the select as the user's own would: the
   value changes and `input` then `change` fire. The select stays the field
   every tool reads, so nothing that reads, sets, saves or restores it
   changes, and its width is still the browser's (sized to its longest
   option, not jumping with the pick).

   Only the mouse is taken over. Keyboard and touch keep the browser's own
   picker, which screen readers announce properly and phones show as a
   thumb-sized sheet. A select can opt out with data-native.

     SharedDropdown.place(anchor, list[, opts])
       Puts a fixed-position list under (or, short of room, over) an anchor,
       at least as wide as it, kept on screen. A combobox calls it on open,
       scroll and resize. opts: {minWidth, maxWidth, maxHeight, gap}.
   ────────────────────────────────────────────────────────────────────────── */
(function(global){
  'use strict';
  if (global.SharedDropdown) return;

  function place(anchor, list, opts){
    opts = opts || {};
    var gap = opts.gap == null ? 4 : opts.gap;
    var r = anchor.getBoundingClientRect();
    var vw = document.documentElement.clientWidth, vh = global.innerHeight;
    var maxW = Math.min(opts.maxWidth || 420, vw - 16);
    var minW = Math.min(Math.max(r.width, opts.minWidth || 0), maxW);
    list.style.position = 'fixed';
    list.style.minWidth = minW + 'px';
    list.style.maxWidth = maxW + 'px';
    if (opts.minWidth) list.style.width = minW + 'px';
    var w = list.offsetWidth;
    list.style.left = Math.max(8, Math.min(r.left, vw - w - 8)) + 'px';
    var cap = opts.maxHeight || 280;
    var below = vh - r.bottom - gap - 8, above = r.top - gap - 8;
    if (below < Math.min(cap, 160) && above > below) {
      list.style.top = '';
      list.style.bottom = (vh - r.top + gap) + 'px';
      list.style.maxHeight = Math.min(cap, above) + 'px';
    } else {
      list.style.bottom = '';
      list.style.top = (r.bottom + gap) + 'px';
      list.style.maxHeight = Math.min(cap, Math.max(below, 120)) + 'px';
    }
  }

  var sel = null, list = null, rows = [], active = -1, pointer = '';
  var typed = '', typedAt = 0;

  function usable(s){
    return s && !s.multiple && !(s.size > 1) && !s.disabled &&
      !s.hasAttribute('data-native') && s.options.length > 0;
  }

  function row(o){
    var d = document.createElement('div');
    d.className = 'combo-opt' + (o.selected ? ' selected' : '') + (o.disabled ? ' disabled' : '');
    d.setAttribute('role', 'option');
    d.setAttribute('aria-selected', o.selected ? 'true' : 'false');
    var m = document.createElement('span');
    m.className = 'combo-main';
    m.textContent = o.label || o.text;
    d.appendChild(m);
    if (o.title) d.title = o.title;
    d._index = o.index;
    d._disabled = o.disabled;
    return d;
  }

  function build(s){
    var frag = document.createDocumentFragment();
    rows = [];
    function add(o){
      if (o.hidden) return;
      var d = row(o);
      rows.push(d);
      frag.appendChild(d);
    }
    for (var i = 0; i < s.children.length; i++) {
      var c = s.children[i];
      if (c.tagName === 'OPTGROUP') {
        if (c.hidden) continue;
        var h = document.createElement('div');
        h.className = 'combo-group';
        h.setAttribute('role', 'presentation');
        h.textContent = c.label;
        frag.appendChild(h);
        for (var j = 0; j < c.children.length; j++) if (c.children[j].tagName === 'OPTION') add(c.children[j]);
      } else if (c.tagName === 'OPTION') add(c);
    }
    return frag;
  }

  function focusRow(i, scroll){
    if (active >= 0 && rows[active]) rows[active].classList.remove('focused');
    active = i;
    if (i >= 0 && rows[i]) {
      rows[i].classList.add('focused');
      if (scroll) rows[i].scrollIntoView({ block: 'nearest' });
    }
  }
  function step(from, dir){
    for (var i = from + dir; i >= 0 && i < rows.length; i += dir) if (!rows[i]._disabled) return i;
    return from;
  }

  function open(s){
    close();
    sel = s;
    list = document.createElement('div');
    list.className = 'combo-list sel-list';
    list.setAttribute('role', 'listbox');
    list.appendChild(build(s));
    // The list takes the select's own text size, within reason, as the
    // browser's picker does: a compact select gets a compact list.
    var fs = parseFloat(getComputedStyle(s).fontSize) || 14;
    list.style.fontSize = Math.max(12.5, Math.min(fs, 15)) + 'px';
    document.body.appendChild(list);
    place(s, list, { maxHeight: 300 });
    var cur = -1;
    for (var i = 0; i < rows.length; i++) if (rows[i]._index === s.selectedIndex) cur = i;
    if (cur >= 0) { focusRow(cur, false); rows[cur].scrollIntoView({ block: 'center' }); }
    // Pressing in the list keeps the select focused, so its blur still means
    // the reader has gone elsewhere.
    list.addEventListener('mousedown', function(e){ e.preventDefault(); });
    list.addEventListener('click', function(e){
      var d = e.target.closest('.combo-opt');
      if (d && !d._disabled) pick(d._index);
    });
    list.addEventListener('mousemove', function(e){
      var d = e.target.closest('.combo-opt');
      var i = d ? rows.indexOf(d) : -1;
      if (i >= 0 && i !== active && !d._disabled) focusRow(i, false);
    });
    s.addEventListener('blur', close);
    s.setAttribute('aria-expanded', 'true');
  }

  function close(){
    if (!list) return;
    if (sel) { sel.removeEventListener('blur', close); sel.removeAttribute('aria-expanded'); }
    list.remove();
    list = null; sel = null; rows = []; active = -1;
  }

  function pick(index){
    var s = sel;
    close();
    if (!s || s.selectedIndex === index) return;
    s.selectedIndex = index;
    s.dispatchEvent(new Event('input', { bubbles: true }));
    s.dispatchEvent(new Event('change', { bubbles: true }));
  }

  document.addEventListener('pointerdown', function(e){ pointer = e.pointerType || 'mouse'; }, true);

  document.addEventListener('mousedown', function(e){
    if (list && list.contains(e.target)) return;
    var s = e.target.closest ? e.target.closest('select') : null;
    if (!s) { close(); return; }
    if (e.button !== 0 || (pointer && pointer !== 'mouse') || !usable(s)) { close(); return; }
    e.preventDefault();
    if (sel === s) { close(); return; }
    s.focus({ preventScroll: true });
    open(s);
  }, true);

  document.addEventListener('keydown', function(e){
    if (!list) return;
    var k = e.key;
    if (k === 'ArrowDown' || k === 'ArrowUp') {
      e.preventDefault();
      focusRow(active < 0 ? step(-1, 1) : step(active, k === 'ArrowDown' ? 1 : -1), true);
    } else if (k === 'Home' || k === 'End') {
      e.preventDefault();
      focusRow(k === 'Home' ? step(-1, 1) : step(rows.length, -1), true);
    } else if (k === 'PageDown' || k === 'PageUp') {
      e.preventDefault();
      var i = active;
      for (var n = 0; n < 8; n++) i = step(i, k === 'PageDown' ? 1 : -1);
      focusRow(i, true);
    } else if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      if (active >= 0) pick(rows[active]._index); else close();
    } else if (k === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (k === 'Tab') {
      close();
    } else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Type to jump, as in the browser's own list.
      e.preventDefault();
      var now = Date.now();
      typed = (now - typedAt < 700 ? typed : '') + k.toLowerCase();
      typedAt = now;
      for (var t = 0; t < rows.length; t++) {
        var at = (active + (typed.length === 1 ? 1 : 0) + t) % rows.length;
        if (!rows[at]._disabled && rows[at].textContent.trim().toLowerCase().indexOf(typed) === 0) { focusRow(at, true); break; }
      }
    }
  }, true);

  // A scroll anywhere but in the list itself, or a resize, would leave the
  // list hanging away from its field, so it closes as the browser's does.
  global.addEventListener('scroll', function(e){ if (list && !list.contains(e.target)) close(); }, true);
  global.addEventListener('resize', close);
  global.addEventListener('blur', close);

  global.SharedDropdown = { place: place, open: function(s){ if (usable(s)) { s.focus({ preventScroll: true }); open(s); } }, close: close };
})(window);
