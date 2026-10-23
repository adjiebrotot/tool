// The Python tab (DESIGN 8): the script, written live as the workflow changes (the generator
// runs about 120 ms after the last edit; the code view only redraws while the tab is open),
// highlighted with highlight.js when it has arrived from the CDN and plain text otherwise
// (the page never waits for it). ⧉ copies, ⬇ downloads, and "See its Python" from a block
// scrolls to its lines and marks them (the generator's spans; the "# -- Step n:" comments as a
// fallback). A download with problems says so once and carries the count on its label.

import { $, el, downloadText } from './dom.js';
import { fileNameFor } from '../core/codegen.js';
import { toast } from './toasts.js';

export function blockingCount(gen) {
  return ((gen && gen.problems) || []).filter(p => p.level === 'error' || p.level === 'todo').length;
}

export function mountPython(app) {
  const store = app.store;
  const code = $('pfbCodeInner'), pre = $('pfbCode'), wrap = $('pfbCodeWrap'), status = $('pfbPyStatus');
  const dl1 = $('pfbDownload'), dl2 = $('pfbDownload2'), copyBtn = $('pfbCopy');
  let shownCode = null, marked = null, askedFor = null;

  const isOpen = () => store.get().tab === 'python';
  function highlight(text) {
    const H = window.hljs;
    try {
      if (H && typeof H.highlight === 'function') {
        const r = H.highlight(text, { language: 'python', ignoreIllegals: true });
        if (r && typeof r.value === 'string') return r.value;
      }
    } catch (e) { /* a stub or an old version: plain text */ }
    return null;
  }
  function render(force) {
    const g = store.get().gen;
    if (!g) { if (!shownCode) code.textContent = 'Writing the script…'; return; }
    if (!isOpen() && !force) return;
    if (!force && g.code === shownCode) return;
    shownCode = g.code;
    const hl = highlight(g.code);
    if (hl !== null) { code.innerHTML = hl; code.classList.add('hljs'); } else { code.textContent = g.code; code.classList.remove('hljs'); }
    if (marked) markNode(marked, false);
  }
  const hl = $('pfbHljs');
  if (hl) hl.addEventListener('load', () => { if (shownCode !== null) { shownCode = null; render(true); } });

  function labels() {
    const g = store.get().gen;
    const n = blockingCount(g);
    const t = '⬇ Download .py' + (n ? ' (' + n + ' problem' + (n === 1 ? '' : 's') + ')' : '');
    // The words sit in spans so a phone can show the short form, "⬇ .py (2)", from CSS alone.
    if (dl1.textContent !== t) {
      dl1.innerHTML = '⬇ <span class="pfb-dl-word">Download </span>.py' +
        (n ? ' <span class="pfb-dl-n">(' + n + '<span class="pfb-dl-word"> problem' + (n === 1 ? '' : 's') + '</span>)</span>' : '');
    }
    dl1.title = n ? 'Download the Python file. It stops before it connects to PowerFactory until the problems are fixed.' : 'Download the Python file';
    dl1.classList.toggle('pfb-has-problems', !!n);
    if (status) {
      status.textContent = !g ? 'Writing the script…'
        : n ? 'This script stops before it connects until ' + (n === 1 ? 'one problem is' : n + ' problems are') + ' fixed (see Problems).'
        : 'Written as you build. Ready to run.';
      status.classList.toggle('pfb-py-warn', !!n);
    }
  }

  store.subscribe((s, prev) => {
    if (s.gen !== prev.gen) { labels(); render(false); }
    if (s.tab !== prev.tab && s.tab === 'python') render(false);
  });
  labels();

  // ---- Marking a block's lines
  function lineBox() {
    const cs = getComputedStyle(pre);
    const lh = parseFloat(cs.lineHeight) || 18;
    return { lh, top: pre.offsetTop + (parseFloat(cs.paddingTop) || 0) };
  }
  function spansFor(id) {
    const g = store.get().gen;
    if (!g) return [];
    if (g.spans && Array.isArray(g.spans[id]) && g.spans[id].length) return g.spans[id];
    const step = g.steps && g.steps[id];
    if (!step) return [];
    const lines = g.code.split('\n');
    const a = lines.findIndex(l => l.trim().startsWith('# -- Step ' + step + ':'));
    if (a < 0) return [];
    let b = lines.findIndex((l, i) => i > a && /^\s*# -- Step \d+:/.test(l));
    if (b < 0) b = Math.min(lines.length, a + 12);
    return [[a + 1, b]];
  }
  function clearMarks() { wrap.querySelectorAll('.pfb-code-mark').forEach(m => { if (m.id === 'pfbCodeMark') m.hidden = true; else m.remove(); }); }
  function markNode(id, scroll) {
    clearMarks();
    const spans = spansFor(id);
    marked = id;
    if (!spans.length) return false;
    const { lh, top } = lineBox();
    spans.forEach((sp, i) => {
      const m = i === 0 ? $('pfbCodeMark') : el('div', { class: 'pfb-code-mark' });
      m.classList.add('pfb-code-mark');
      m.hidden = false;
      m.style.top = (top + (sp[0] - 1) * lh) + 'px';
      m.style.height = ((sp[1] - sp[0] + 1) * lh) + 'px';
      if (i) wrap.insertBefore(m, pre);
    });
    if (scroll) wrap.scrollTop = Math.max(0, top + (spans[0][0] - 1) * lh - wrap.clientHeight / 3);
    return true;
  }

  function seePython(id) {
    app.openTab('python');
    app.flushGenerate();
    render(true);
    requestAnimationFrame(() => {
      if (!markNode(id, true)) toast('This block writes no lines of its own yet: connect it after Start (or into a step that uses it).');
    });
  }

  // ---- Copy and download
  function copy() {
    app.flushGenerate();
    const g = store.get().gen;
    if (!g) return;
    const ok = () => toast('Copied the Python to the clipboard.');
    const failed = (e) => alert('Copy failed: ' + (e && e.message ? e.message : 'the browser did not allow it') + '. Use Download .py instead.');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(g.code).then(ok, failed);
    else {
      try {
        const t = el('textarea', { style: { position: 'fixed', left: '-9999px' } });
        t.value = g.code; document.body.appendChild(t); t.select();
        const done = document.execCommand('copy'); t.remove();
        if (done) ok(); else failed();
      } catch (e) { failed(e); }
    }
  }
  function download() {
    app.flushGenerate();
    const s = store.get(), g = s.gen;
    if (!g) return;
    const probs = (g.problems || []).filter(p => p.level === 'error' || p.level === 'todo');
    const sig = probs.map(p => p.level + p.msg).join('\n');
    if (probs.length && askedFor !== sig) {
      const first = probs.slice(0, 3).map(p => '• ' + p.msg).join('\n');
      const yes = confirm('This workflow has ' + (probs.length === 1 ? 'one problem' : probs.length + ' problems') + ' to fix:\n' + first + (probs.length > 3 ? '\n…' : '') +
        '\n\nThe script will stop before connecting until these are fixed. Download it anyway?');
      if (!yes) { app.openTab('problems'); return; }
      askedFor = sig;
    }
    downloadText(g.code, fileNameFor(s.wf), 'text/x-python');
  }
  copyBtn.addEventListener('click', copy);
  dl1.addEventListener('click', download);
  dl2.addEventListener('click', download);

  return { render, seePython, download, copy, markNode };
}
