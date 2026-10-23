// Small DOM helpers shared by the editor's plain-DOM panels (palette, inspector, Python,
// Problems, quick-add, toasts). Nothing here knows about workflows.

export const $ = (id) => document.getElementById(id);

export function esc(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// el('div', { class: 'x', dataset: {...}, on: { click: fn }, text: '...' }, children...)
export function el(tag, attrs, ...children) {
  const n = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'on') for (const [ev, fn] of Object.entries(v)) n.addEventListener(ev, fn);
      else if (k === 'dataset') Object.assign(n.dataset, v);
      // Custom properties (--cat) only take setProperty; a plain assignment drops them silently.
      else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) n.style.setProperty(sk, sv); else n.style[sk] = sv; } }
      else if (k === 'value') n.value = v;
      else if (k === 'checked') n.checked = !!v;
      else if (k === 'disabled') n.disabled = !!v;
      else if (v === true) n.setAttribute(k, '');
      else n.setAttribute(k, String(v));
    }
  }
  for (const c of children.flat(Infinity)) {
    if (c === undefined || c === null || c === false) continue;
    n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return n;
}

// The site's tooltip budget is 200 rendered characters (tip-check). Text that could run longer
// (block descriptions, problem messages) is cut at a word boundary, so a long message never
// becomes a failing tip; the full text is always somewhere else on the page.
export const TIP_MAX = 200;
export function tipText(s, max = TIP_MAX - 4) {
  const t = String(s === undefined || s === null ? '' : s).replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.]+$/, '') + '…';
}
// As data-tip markup (the shared tooltip reads it as HTML).
export const tipAttr = (s) => esc(tipText(s));

// A tip with markup for values: an exact value the block gives or takes, written `TRUE` in the
// plain text, becomes a .pfb-tip-val span (code font). Escapes the rest; the budget counts
// rendered text.
export function tipRich(s, max = TIP_MAX - 4) {
  const t = tipText(s, max + 2 * (String(s || '').split('`').length - 1));
  return esc(t).replace(/`([^`]+)`/g, '<span class="pfb-tip-val">$1</span>').replace(/`/g, '');
}

// A port's tip: the data type in bold (a mandatory input's chip before it), the type's own words
// only for a type a reader may not know, then the port's tip on its own line when it adds
// something. T is a TYPES entry (or nothing: a port that is gone).
const PLAIN_TYPES = ['num', 'bool', 'text', 'any'];
export function portTip(t, T, extra, mandatory) {
  const chip = mandatory ? '<span class="pfb-tip-chip">Mandatory</span> ' : '';
  const budget = TIP_MAX - 4 - (mandatory ? 10 : 0);
  if (!T) return chip + tipRich('A port that is gone from this block.', budget);
  const words = PLAIN_TYPES.includes(t) ? '' : ': ' + T.words;
  const room = budget - T.label.length - words.length - 1;
  const more = extra && room > 12 ? '<br>' + tipRich(extra, room) : '';
  return chip + '<strong>' + esc(T.label) + '</strong>' + esc(words) + more;
}

export function icon(name) {
  return (window.SharedIcon && typeof SharedIcon.svg === 'function') ? SharedIcon.svg(name) : '';
}

// A bare icon-only button (SharedIcon.button look) as an element.
export function iconButton(name, label, cls, extra) {
  const b = el('button', { type: 'button', class: 'btn-bare' + (name === 'trash' ? ' is-delete' : '') + (cls ? ' ' + cls : ''), title: label, 'aria-label': label, ...(extra || {}) });
  b.innerHTML = icon(name);
  return b;
}

export function debounce(fn, ms) {
  let t = null;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => { t = null; fn(...a); }, ms); };
  d.flush = (...a) => { if (t) { clearTimeout(t); t = null; } fn(...a); };
  d.cancel = () => { clearTimeout(t); t = null; };
  d.pending = () => t !== null;
  return d;
}

// Save text as a file on this device (Blob + a[download]), the parent tool's pattern.
export function downloadText(text, filename, type = 'text/plain') {
  const blob = new Blob([text], { type: type + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename, style: { display: 'none' } });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

// Is the keyboard focus in a place where typing means text (so shortcuts stay away)?
export function isTyping(target) {
  const t = target || document.activeElement;
  if (!t || !t.tagName) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const ty = (t.type || 'text').toLowerCase();
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'file', 'color'].includes(ty);
  }
  return false;
}

// Keep a floating panel inside the viewport (the quick-add menu at a drop point near an edge).
export function clampToViewport(node, x, y, margin = 8) {
  node.style.left = '0px'; node.style.top = '0px';
  const r = node.getBoundingClientRect();
  const W = window.innerWidth, H = window.innerHeight;
  const left = Math.max(margin, Math.min(x, W - r.width - margin));
  const top = Math.max(margin, Math.min(y, H - r.height - margin));
  node.style.left = left + 'px'; node.style.top = top + 'px';
}

export function lsGet(key, dflt) {
  try { const v = localStorage.getItem(key); return v === null ? dflt : v; } catch (e) { return dflt; }
}
export function lsSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { /* private mode: only a convenience */ }
}

export const isPhone = () => window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
