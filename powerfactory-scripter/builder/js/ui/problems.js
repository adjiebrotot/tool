// The Problems tab (DESIGN 6.7, 8, U17): what the generator found, worst first: errors (the
// script stops before it connects), to-dos (fields to fill in, neutral while building, counted
// with the errors at download) and warnings (likely mistakes). A click selects and centres the
// block; a fix the generator offers is a button (select a block, remove a wire, move a wire to
// After all passes, add Start).
//
// Items are not role=button: their text is the message, and a message such as "remove one wire"
// is not a delete button.

import { $, el, esc, icon } from './dom.js';
import { displayName } from '../core/registry.js';
import * as ops from './ops.js';
import { isBlocking } from './python.js';

const ORDER = { error: 0, todo: 1, warning: 2 };
const HEADS = { error: 'Errors: the script stops before it connects', todo: 'To do', warning: 'Warnings' };

export function mountProblems(app) {
  const store = app.store;
  const host = $('pfbProblems'), badge = $('pfbProbCount'), warnBadge = $('pfbWarnCount');

  function render() {
    const s = store.get();
    const g = s.gen;
    const ps = ((g && g.problems) || []).slice().sort((a, b) => (ORDER[a.level] ?? 3) - (ORDER[b.level] ?? 3));
    // Two counts that never disagree with the Download label: what must be fixed (errors and
    // to-dos, the same count Download carries) and, apart, the warnings.
    const toFix = ps.filter(isBlocking).length, warns = ps.length - toFix;
    if (badge) {
      badge.hidden = !toFix;
      badge.textContent = String(toFix);
      badge.className = 'pfb-badge' + (toFix ? ' pfb-lv-' + ps[0].level : '');
      badge.setAttribute('aria-label', toFix + ' to fix');
      badge.title = toFix + (toFix === 1 ? ' problem' : ' problems') + ' to fix before the script runs';
    }
    if (warnBadge) {
      warnBadge.hidden = !warns;
      warnBadge.lastChild.textContent = String(warns);
      warnBadge.setAttribute('aria-label', warns + ' warning' + (warns === 1 ? '' : 's'));
      warnBadge.title = warns + (warns === 1 ? ' warning: a likely mistake' : ' warnings: likely mistakes') + '; the script still runs';
    }
    host.textContent = '';
    if (!g) { host.appendChild(el('p', { class: 'pfb-muted', text: 'Checking the workflow…' })); return; }
    if (!ps.length) {
      host.appendChild(el('div', { class: 'pfb-prob-none' }, el('strong', { text: 'No problems.' }), ' The script is ready to download.'));
      return;
    }
    let level = null, list = null;
    for (const p of ps) {
      if (p.level !== level) {
        level = p.level;
        const n = ps.filter(q => q.level === level).length;
        host.appendChild(el('div', { class: 'pfb-prob-head pfb-lv-' + level }, el('span', { text: HEADS[level] || 'Notes' }), el('span', { class: 'pfb-prob-head-n', text: String(n) })));
        list = el('div', { class: 'pfb-prob-list', role: 'list' });
        host.appendChild(list);
      }
      const node = p.nodeId ? ops.nodeById(s.wf, p.nodeId) : null;
      const item = el('div', { class: 'pfb-prob pfb-lv-' + p.level + (node || p.edgeId ? ' is-link' : ''), role: 'listitem', tabindex: node || p.edgeId ? '0' : null, dataset: { node: p.nodeId || '', edge: p.edgeId || '' } },
        el('span', { class: 'pfb-prob-ico', 'aria-hidden': 'true', text: p.level === 'todo' ? '○' : '⚠' }),
        el('div', { class: 'pfb-prob-body' },
          el('div', { class: 'pfb-prob-msg', text: p.msg }),
          node ? el('div', { class: 'pfb-prob-where', text: displayName(node) }) : null));
      const go = () => {
        if (p.edgeId && s.wf.edges.some(e => e.id === p.edgeId) && !node) { store.select([], [p.edgeId]); return; }
        if (node) app.focusNode(node.id);
      };
      if (node || p.edgeId) {
        item.addEventListener('click', (e) => { if (e.target.closest('button')) return; go(); });
        item.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === item) { e.preventDefault(); go(); } });
      }
      if (p.fix && p.fix.op && typeof p.fix.op === 'object') {
        const del = p.fix.op.op === 'removeEdge';
        const b = el('button', { type: 'button', class: 'btn-secondary btn-sm pfb-prob-fix' + (del ? ' has-ico' : '') });
        b.innerHTML = (del ? icon('trash') : '') + '<span>' + esc(p.fix.label || 'Fix it') + '</span>';
        b.addEventListener('click', (e) => { e.stopPropagation(); app.applyFix(p.fix.op); });
        item.querySelector('.pfb-prob-body').appendChild(b);
      }
      list.appendChild(item);
    }
  }
  store.subscribe((s, prev) => { if (s.gen !== prev.gen || (s.wf !== prev.wf && s.gen)) render(); });
  render();
  return { render };
}
