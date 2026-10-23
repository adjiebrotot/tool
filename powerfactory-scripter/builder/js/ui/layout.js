// Page layout (DESIGN 8, revised to the World Clock's map layout): the canvas fills the screen and
// everything else floats over it. The Blocks panel (left) and the Settings / Python / Problems
// panel (right) are docks: drag a title bar to move one, its chevron folds it, a double-click on
// the title bar puts it back on its side. Where they sit and whether they are folded is a
// per-viewer convenience kept in localStorage. On a phone the Blocks panel starts folded and the
// right panel is a bottom sheet (its tab bar always shows, the panel opens over the canvas).
// The right panel's left edge drags to make it wider or narrower (a double-click puts the width
// back), so the Python reads without scrolling sideways; the width is kept with the dock state.
// Also the tabs, the wire legend and the theme toggle (shared with the parent: 'pf-theme').

import { $, el, lsGet, lsSet, isPhone } from './dom.js';
import { TYPES } from '../core/registry.js';

const DOCK_KEY = 'pfb-docks';
const MARGIN = 12;          // px between a dock and the screen edge
const FOOT = 40;            // px kept free at the bottom for the footer line
const SIDE_MIN = 320;       // px, the narrowest the right panel is made by hand

export function initTheme(store) {
  const btn = $('themeToggle');
  const apply = (light) => {
    document.body.classList.toggle('light', light);
    if (btn) btn.textContent = light ? '🌙 Dark' : '☀️ Light';
    if (store) store.set({ theme: light ? 'light' : 'dark' });
  };
  apply(lsGet('pf-theme', 'light') !== 'dark');
  if (btn && !btn.dataset.pfbWired) {
    btn.dataset.pfbWired = '1';
    btn.addEventListener('click', () => {
      const next = !document.body.classList.contains('light');
      apply(next);
      lsSet('pf-theme', next ? 'light' : 'dark');
    });
  }
  return document.body.classList.contains('light') ? 'light' : 'dark';
}

export function mountLayout(app) {
  const store = app.store;
  const shell = $('pfbApp');
  const top = shell.querySelector('.pfb-top');
  const docks = { pal: $('pfbPalette'), side: $('pfbSide') };
  const folds = { pal: $('pfbPalToggle'), side: $('pfbSheetToggle') };
  const foldWords = { pal: 'the Blocks panel', side: 'this panel' };
  const sizer = docks.side ? docks.side.appendChild(el('div', {
    class: 'pfb-side-size', role: 'separator', tabindex: '0', 'aria-orientation': 'vertical',
    'aria-label': 'Panel width', 'aria-valuemin': String(SIDE_MIN),
    title: 'Drag to make this panel wider or narrower. Double-click to reset.',
  })) : null;

  // ---- Saved dock state: { pal: { folded, free, x, y }, side: { ..., w (px, 0: the default) } }
  let saved = {};
  try { saved = JSON.parse(lsGet(DOCK_KEY, '{}')) || {}; } catch (e) { saved = {}; }
  const state = {
    pal: { folded: false, free: false, x: 0, y: 0, ...(saved.pal || {}) },
    side: { folded: false, free: false, x: 0, y: 0, w: 0, ...(saved.side || {}) },
  };
  if (!Number.isFinite(state.side.w)) state.side.w = 0;
  // A phone starts with the Blocks panel folded and the sheet closed, whatever a desktop saved.
  if (isPhone()) { state.pal.folded = true; state.side.folded = true; }
  const save = () => { if (!isPhone()) lsSet(DOCK_KEY, JSON.stringify(state)); };

  // ---- The top of the docks follows the height of the top bar (it wraps on narrow screens).
  function placeTop() {
    const h = top ? top.getBoundingClientRect().bottom - shell.getBoundingClientRect().top : 64;
    shell.style.setProperty('--pfb-dock-top', Math.round(h + 10) + 'px');
  }

  function apply(key) {
    const d = docks[key], s = state[key];
    if (!d) return;
    const phone = isPhone();
    d.classList.toggle('is-folded', !!s.folded);
    const free = s.free && !phone;
    d.classList.toggle('is-free', free);
    if (key === 'side') {
      if (s.w && !phone) { s.w = sideWidth(s.w); d.style.setProperty('--pfb-side-w', s.w + 'px'); }
      else d.style.removeProperty('--pfb-side-w');
      if (sizer) sizer.setAttribute('aria-valuenow', String(Math.round(d.offsetWidth)));
    }
    if (free) {
      const p = clamp(key, s.x, s.y);
      s.x = p.x; s.y = p.y;
      d.style.left = p.x + 'px';
      d.style.top = p.y + 'px';
      d.style.setProperty('--pfb-free-top', p.y + 'px');
    } else {
      d.style.left = ''; d.style.top = '';
      d.style.removeProperty('--pfb-free-top');
    }
    const b = folds[key];
    if (b) {
      const open = !s.folded;
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
      const verb = open ? 'Fold ' : 'Open ';
      b.title = verb + foldWords[key];
      b.setAttribute('aria-label', verb + foldWords[key]);
    }
    updateSafe();
  }

  // Keep a moved dock on screen (at least its title bar).
  function clamp(key, x, y) {
    const d = docks[key];
    const W = shell.clientWidth, H = shell.clientHeight;
    const w = d.offsetWidth || 260;
    const headH = (d.querySelector('.pfb-dock-head') || d).offsetHeight || 40;
    return {
      x: Math.round(Math.max(MARGIN - w + 80, Math.min(W - 80, x))),
      y: Math.round(Math.max(MARGIN, Math.min(H - headH - MARGIN, y))),
    };
  }

  // A width for the right panel that leaves the canvas some room (and the Blocks panel beside it).
  function sideWidth(w) {
    const pal = docks.pal && !state.pal.folded && !state.pal.free ? docks.pal.offsetWidth + MARGIN : 0;
    const most = Math.max(SIDE_MIN, shell.clientWidth - pal - 2 * MARGIN - 160);
    return Math.round(Math.max(SIDE_MIN, Math.min(most, w)));
  }

  // Room the canvas keeps clear of the docks (fit view, the minimap, the legend).
  function updateSafe() {
    const sr = shell.getBoundingClientRect();
    const occupied = (key) => {
      const d = docks[key], s = state[key];
      if (!d || s.folded || s.free || isPhone()) return 0;
      const r = d.getBoundingClientRect();
      return key === 'pal' ? Math.max(0, r.right - sr.left) : Math.max(0, sr.right - r.left);
    };
    const left = occupied('pal'), right = occupied('side');
    shell.style.setProperty('--pfb-safe-left', Math.round(left ? left + MARGIN : MARGIN) + 'px');
    shell.style.setProperty('--pfb-safe-right', Math.round(right ? right + MARGIN : MARGIN) + 'px');
  }

  function safeArea() {
    const cs = getComputedStyle(shell);
    const px = (v, d) => { const n = parseFloat(cs.getPropertyValue(v)); return Number.isFinite(n) ? n : d; };
    const phone = isPhone();
    return {
      top: Math.round(px('--pfb-dock-top', 70) + 8) + 'px',
      left: Math.round(px('--pfb-safe-left', MARGIN) + 16) + 'px',
      right: Math.round(px('--pfb-safe-right', MARGIN) + 16) + 'px',
      bottom: (phone ? 70 : FOOT + 16) + 'px',
    };
  }

  function setFolded(key, folded) {
    state[key].folded = !!folded;
    apply(key);
    save();
  }

  for (const key of Object.keys(docks)) {
    const d = docks[key];
    if (!d) continue;
    const head = d.querySelector('.pfb-dock-head');
    folds[key] && folds[key].addEventListener('click', (e) => { e.stopPropagation(); setFolded(key, !state[key].folded); });

    // Drag by the title bar (not by its buttons or tabs).
    head && head.addEventListener('pointerdown', (e) => {
      if (isPhone() || e.button !== 0 || e.target.closest('button, a, input, select, textarea')) return;
      e.preventDefault();
      const sr = shell.getBoundingClientRect(), r = d.getBoundingClientRect();
      const dx = e.clientX - r.left, dy = e.clientY - r.top;
      let moved = false;
      try { head.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
      const move = (ev) => {
        const x = ev.clientX - sr.left - dx, y = ev.clientY - sr.top - dy;
        if (!moved && Math.abs(ev.clientX - e.clientX) + Math.abs(ev.clientY - e.clientY) < 4) return;
        if (!moved) { moved = true; d.classList.add('is-dragging'); }
        state[key].free = true;
        state[key].x = x; state[key].y = y;
        apply(key);
      };
      const up = () => {
        head.removeEventListener('pointermove', move);
        head.removeEventListener('pointerup', up);
        head.removeEventListener('pointercancel', up);
        d.classList.remove('is-dragging');
        if (moved) save();
      };
      head.addEventListener('pointermove', move);
      head.addEventListener('pointerup', up);
      head.addEventListener('pointercancel', up);
    });
    head && head.addEventListener('dblclick', (e) => {
      if (e.target.closest('button, a, input, select, textarea')) return;
      state[key].free = false;
      apply(key);
      save();
    });
  }

  // ---- The right panel's width: drag its left edge, or arrow keys on it; a double-click resets.
  function setSideWidth(w) {
    const d = docks.side, s = state.side;
    const right = d.getBoundingClientRect().right - shell.getBoundingClientRect().left;
    s.w = sideWidth(w);
    if (s.free) s.x = right - s.w;     // a moved panel keeps its right edge where it was
    apply('side');
  }
  if (sizer) {
    sizer.addEventListener('pointerdown', (e) => {
      if (isPhone() || e.button !== 0) return;
      e.preventDefault();
      const d = docks.side, w0 = d.offsetWidth, x0 = e.clientX;
      try { sizer.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
      d.classList.add('is-sizing');
      const move = (ev) => setSideWidth(w0 + (x0 - ev.clientX));
      const up = () => {
        sizer.removeEventListener('pointermove', move);
        sizer.removeEventListener('pointerup', up);
        sizer.removeEventListener('pointercancel', up);
        d.classList.remove('is-sizing');
        save();
      };
      sizer.addEventListener('pointermove', move);
      sizer.addEventListener('pointerup', up);
      sizer.addEventListener('pointercancel', up);
    });
    sizer.addEventListener('dblclick', () => {
      const d = docks.side, right = d.getBoundingClientRect().right - shell.getBoundingClientRect().left;
      state.side.w = 0;
      apply('side');
      if (state.side.free) { state.side.x = right - d.offsetWidth; apply('side'); }
      save();
    });
    sizer.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 96 : 24;
      const by = e.key === 'ArrowLeft' ? step : e.key === 'ArrowRight' ? -step : 0;
      if (!by) return;
      e.preventDefault();
      setSideWidth(docks.side.offsetWidth + by);
      save();
    });
  }

  placeTop();
  for (const k of Object.keys(docks)) apply(k);
  const relayout = () => { placeTop(); for (const k of Object.keys(docks)) apply(k); };
  window.addEventListener('resize', relayout);
  if (window.ResizeObserver && top) new ResizeObserver(relayout).observe(top);

  // ---- Tabs (a tab opens its panel if the dock is folded)
  const tabs = [...document.querySelectorAll('.pfb-tabs .ctrl-tab')];
  function openTab(name) {
    for (const t of tabs) {
      const on = t.dataset.tab === name;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      const panel = $('tab-' + t.dataset.tab);
      if (panel) panel.classList.toggle('active', on);
    }
    if (store.get().tab !== name) store.set({ tab: name });
  }
  for (const t of tabs) {
    t.addEventListener('click', () => {
      openTab(t.dataset.tab);
      if (state.side.folded) setFolded('side', false);
    });
  }

  // ---- Quick start: a popover under the action bar (closes on a pick, outside click or Esc).
  const qsBtn = $('pfbQsBtn'), qs = $('pfbQuickStart'), qsList = $('pfbTemplates');
  function setQuickStart(open) {
    if (!qs || !qsBtn) return;
    qs.hidden = !open;
    qsBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      const r = qsBtn.getBoundingClientRect(), sr = shell.getBoundingClientRect();
      const w = qs.offsetWidth || 300;
      qs.style.top = Math.round(r.bottom - sr.top + 8) + 'px';
      qs.style.left = Math.round(Math.max(MARGIN, Math.min(shell.clientWidth - w - MARGIN, r.left - sr.left + r.width / 2 - w / 2))) + 'px';
    }
  }
  if (qsBtn && qs) {
    qsBtn.addEventListener('click', (e) => { e.stopPropagation(); setQuickStart(qs.hidden); });
    qs.addEventListener('click', (e) => { if (e.target.closest('.quick-start-btn')) setTimeout(() => setQuickStart(false), 0); });
    document.addEventListener('pointerdown', (e) => { if (!qs.hidden && !qs.contains(e.target) && !qsBtn.contains(e.target)) setQuickStart(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !qs.hidden) setQuickStart(false); });
    // The button only shows once there are templates to open.
    const showBtn = () => { qsBtn.hidden = !(qsList && qsList.children.length); };
    showBtn();
    if (qsList && window.MutationObserver) new MutationObserver(showBtn).observe(qsList, { childList: true });
  }

  // ---- The footer: on narrower screens some items hide; the info button shows them all.
  const foot = $('pfbFoot'), footBtn = $('pfbFootMore');
  if (foot && footBtn) {
    const setFoot = (open) => {
      foot.classList.toggle('is-open', open);
      footBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      footBtn.setAttribute('aria-label', open ? 'Show less of the footer' : 'Show the whole footer');
    };
    footBtn.addEventListener('click', () => setFoot(!foot.classList.contains('is-open')));
    document.addEventListener('pointerdown', (e) => { if (foot.classList.contains('is-open') && !foot.contains(e.target)) setFoot(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && foot.classList.contains('is-open')) setFoot(false); });
  }

  // ---- The wire legend (U24).
  const legend = $('pfbLegendList');
  if (legend) {
    legend.textContent = '';
    for (const [t, T] of Object.entries(TYPES)) {
      legend.appendChild(el('li', { class: 'pfb-leg', title: T.words },
        el('span', { class: 'pfb-leg-sw pfb-t-' + t + (t === 'flow' ? ' is-flow' : '') }),
        el('span', { class: 'pfb-leg-name', text: T.label })));
    }
  }

  return {
    openTab,
    setPalette: (open) => setFolded('pal', !open),
    setSheet: (open) => setFolded('side', !open),
    safeArea,
    fit: relayout,
  };
}
