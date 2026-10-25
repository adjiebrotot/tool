// Quick start templates (DESIGN 8.1) and the empty-canvas starter card.
//
// templates/index.json = { "templates": [ { "id": "headroom", "title": "Headroom study",
//   "desc": "<= 200 characters, shown as the button's tip", "file": "headroom.json" } ] }
// Ids are frozen handles (data-preset); each file is a workflow read through loadWorkflow().
// A template replaces the canvas as one undo step; it asks first when the canvas has more than
// Start and changed since it was last saved or opened.

import { $, el, tipAttr } from './dom.js';
import { loadWorkflow } from '../core/workflow.js';

const ID_RE = /^[a-z0-9][a-z0-9-]{0,40}$/;
const FILE_RE = /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,80}\.json$/;

export function mountTemplates(app) {
  const store = app.store;
  const row = $('pfbQuickStart'), btns = $('pfbTemplates');
  const starter = $('pfbStarter'), starterBtns = $('pfbStarterBtns'), blank = $('pfbStarterBlank');
  let list = [];
  let dismissed = false;
  let activeId = null, activeRev = -1;

  const ready = fetch('templates/index.json')
    .then(r => (r.ok ? r.json() : null))
    .catch(() => null)
    .then(j => {
      list = (j && Array.isArray(j.templates) ? j.templates : []).filter(t => t && ID_RE.test(String(t.id)) && FILE_RE.test(String(t.file)) && t.title);
      draw();
      return list;
    });

  function draw() {
    btns.textContent = '';
    starterBtns.textContent = '';
    // The row is the Quick start popover (layout.js opens and closes it; its button hides while
    // there are no templates), so it is not shown here.
    void row;
    for (const t of list) {
      const b = el('button', { type: 'button', class: 'quick-start-btn', dataset: { preset: t.id }, 'data-tip': t.desc ? tipAttr(t.desc) : null, text: t.title });
      b.addEventListener('click', () => load(t.id));
      btns.appendChild(b);
      const s = el('button', { type: 'button', class: 'btn-secondary btn-sm pfb-starter-tpl', dataset: { preset: t.id }, text: t.title });
      s.addEventListener('click', () => load(t.id));
      starterBtns.appendChild(s);
    }
    const p = starter.querySelector('p');
    if (p) p.textContent = list.length
      ? 'Open a worked example, or click blocks in the Blocks panel: each one joins the end of the flow.'
      : 'Click blocks in the Blocks panel: each one joins the end of the flow. Or drag them onto the canvas and wire them.';
    markActive();
    starterVisibility();
  }
  function markActive() {
    const rev = store.get().rev;
    if (activeId && rev !== activeRev) activeId = null;
    btns.querySelectorAll('.quick-start-btn').forEach(b => b.classList.toggle('active', b.dataset.preset === activeId));
  }

  const onlyStart = (wf) => wf.nodes.every(n => n.type === 'start');
  function starterVisibility() {
    const show = !dismissed && onlyStart(store.get().wf);
    starter.hidden = !show;
  }

  // opts.ask false: no confirm (the tour keeps the reader's work itself); 'always': confirm
  // whenever the canvas holds more than Start (a link, below); opts.quiet: no toast.
  async function load(id, opts = {}) {
    await ready;
    const t = list.find(x => x.id === id);
    if (!t) return false;
    let text = null;
    try { const r = await fetch('templates/' + t.file); if (r.ok) text = await r.text(); } catch (e) { text = null; }
    if (text === null) { if (!opts.quiet) app.toast('The template "' + t.title + '" did not load. Check your connection and try again.', { level: 'error' }); return false; }
    const { wf, notes } = loadWorkflow(text);
    if (!wf) { if (!opts.quiet) app.toast(notes.map(n => n.msg).join(' ') || 'The template could not be read.', { level: 'error' }); return false; }
    const s = store.get();
    if (opts.ask === 'always' ? !onlyStart(s.wf) : (opts.ask !== false && !onlyStart(s.wf) && s.rev !== s.savedRev)) {
      if (!confirm('Replace the workflow on the canvas with "' + t.title + '"? Undo brings yours back.')) return false;
    }
    app.replaceWorkflow(wf, { what: t.title, notes, saved: true, quiet: !!opts.quiet });
    activeId = id; activeRev = store.get().rev;
    markActive();
    return true;
  }

  blank.addEventListener('click', () => {
    dismissed = true;
    starterVisibility();
    const search = $('pfbPalSearch');
    if (search && !app.isPhone()) search.focus();
  });
  store.subscribe((s, prev) => {
    if (s.wf !== prev.wf) { starterVisibility(); markActive(); }
  });
  starterVisibility();

  // A link opens a Quick start: builder/#qs=<id> (the study guides in ../python/ use it). The hash
  // is cleared once read, so a reload keeps the reader's edits; work of the reader's own on the
  // canvas (from the mini cache) is only replaced after a confirm. tour.js holds its first-visit
  // start while window.__PFB_QS is set, so the tour does not load its demo over the example.
  const linked = /(?:^#|&)qs=([a-z0-9][a-z0-9-]{0,40})(?:&|$)/.exec(location.hash || '');
  if (linked) {
    const id = linked[1];
    window.__PFB_QS = id;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* a file: page */ }
    ready.then(() => {
      if (!list.some(x => x.id === id)) { app.toast('There is no Quick start called "' + id + '". Pick one from Quick start.', { level: 'warn' }); return; }
      return load(id, { ask: 'always' });
    });
  }

  return {
    ready, load,
    list: () => list.slice(),
    showStarter(on = true) { dismissed = !on; starterVisibility(); },
  };
}
