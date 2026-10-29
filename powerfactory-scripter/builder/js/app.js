// Entry point of the PowerFactory Workflow Builder (a module script, loaded after the site's
// classic scripts). It only starts the editor (ui/main.js) and catches a failure to load it, so
// a broken or blocked file shows a message instead of a dead page.

// The AI-link adapter registers now, not when the editor has booted: SharedAgent (shared.js) starts
// the moment the page's scripts have run and waits on the adapter's ready() for the editor.
import './ui/agent.js';

const msg = (text) => {
  const a = document.getElementById('pfbAlert');
  if (a) { a.textContent = text; a.classList.add('visible'); }
};

import('./ui/main.js')
  .then(m => m.boot())
  .catch(e => {
    console.warn('[Builder] the editor did not start:', e);
    msg('The editor did not start (' + String(e && e.message ? e.message : e).slice(0, 160) + '). Reload the page; if it keeps happening, please report it.');
  });
