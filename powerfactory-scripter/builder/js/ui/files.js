// Save and Open (DESIGN 1.1): the builder's own buttons, not SharedScenario, because Open must
// also read a .py the Builder wrote (its last line holds the workflow) and SharedScenario parses
// JSON before handing it over. Both go through the one loadWorkflow().
//
// Save writes the workflow as .json (the format of DESIGN 3, with the view). Open reads a .json
// or a .py; a .py also brings back the SETTINGS values edited in the file (U18). An Open replaces
// the canvas as one undo step, with a toast that offers Undo.

import { $, downloadText } from './dom.js';
import { serialize } from '../core/workflow.js';
import { fileNameFor } from '../core/codegen.js';
import { toast } from './toasts.js';

export function jsonFileName(wf) {
  return fileNameFor(wf).replace(/\.py$/, '') + '.json';
}

export function mountFiles(app) {
  const store = app.store;
  const input = $('pfbOpenInput');
  function save() {
    const s = store.get();
    const obj = serialize({ ...s.wf, view: s.view });
    const name = jsonFileName(s.wf);
    downloadText(JSON.stringify(obj, null, 2) + '\n', name, 'application/json');
    store.markSaved();
    toast('Saved the workflow as ' + name + '.');
  }
  async function openFile(file) {
    if (!file) return;
    let text;
    try { text = await file.text(); } catch (e) { toast('Could not read ' + file.name + ': ' + (e && e.message ? e.message : e), { level: 'error' }); return; }
    app.openText(text, file.name);
  }
  $('pfbSave').addEventListener('click', save);
  $('pfbOpen').addEventListener('click', () => input.click());
  input.addEventListener('change', () => { const f = input.files && input.files[0]; input.value = ''; openFile(f); });
  // A file dropped on the canvas opens too.
  const canvas = $('pfbCanvas');
  canvas.addEventListener('dragover', (e) => {
    if (app.dragging || !e.dataTransfer || ![...(e.dataTransfer.types || [])].includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  canvas.addEventListener('drop', (e) => {
    if (app.dragging || !e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
    e.preventDefault();
    openFile(e.dataTransfer.files[0]);
  });
  return { save, openFile };
}
