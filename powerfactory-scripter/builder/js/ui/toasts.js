// Toasts: one line of news at the bottom of the page, some with "↶ Undo" (6 s, DESIGN 8).
// The region is role="status" aria-live="polite" (index.html), so screen readers hear them.

import { $, el, iconButton } from './dom.js';

let host = null;
const MAX = 3;

export function toast(msg, opts = {}) {
  host = host || $('pfbToasts');
  if (!host) return null;
  const level = opts.level || 'info';
  const t = el('div', { class: 'pfb-toast pfb-toast-' + level, role: level === 'error' ? 'alert' : null });
  t.appendChild(el('span', { class: 'pfb-toast-msg', text: String(msg) }));
  let timer = null;
  const close = () => { clearTimeout(timer); t.classList.remove('show'); setTimeout(() => t.remove(), 250); };
  // A second choice beside Undo: { label, run }.
  if (opts.action && typeof opts.action.run === 'function') {
    const a = el('button', { type: 'button', class: 'btn-secondary btn-sm pfb-toast-act', text: String(opts.action.label || 'Do it') });
    a.addEventListener('click', () => { close(); opts.action.run(); });
    t.appendChild(a);
  }
  if (typeof opts.undo === 'function') {
    const b = el('button', { type: 'button', class: 'btn-secondary btn-sm pfb-toast-undo', text: '↶ Undo', title: 'Undo this' });
    b.addEventListener('click', () => { close(); opts.undo(); });
    t.appendChild(b);
  }
  const x = iconButton('close', 'Close this message', 'pfb-toast-x');
  x.addEventListener('click', close);
  t.appendChild(x);
  host.appendChild(t);
  while (host.children.length > MAX) host.firstElementChild.remove();
  requestAnimationFrame(() => t.classList.add('show'));
  timer = setTimeout(close, opts.ms || (opts.undo ? 6000 : level === 'error' ? 7000 : 3500));
  t.addEventListener('mouseenter', () => clearTimeout(timer));
  t.addEventListener('mouseleave', () => { clearTimeout(timer); timer = setTimeout(close, 2500); });
  return { close, el: t };
}
