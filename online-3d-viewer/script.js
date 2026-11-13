/* Online 3D Viewer: the page.

   Drop (or pick) files → engines/index.js finds the model among them and
   hands it to its format's engine → model.js makes the common model →
   viewer.js draws it. three.js and the engines are imported only when the
   first model opens (and warmed up once the page is idle), so the drop
   screen itself loads almost nothing.

   window.__o3v reports the last load (state, stats, size, warnings) for the
   audit harness in _audit/run.mjs. */

const $ = id => document.getElementById(id);
const dom = {
  dropZone: $('dropZone'), fileInput: $('fileInput'), sampleBtn: $('sampleBtn'),
  dropError: $('dropError'), dropBusy: $('dropBusy'), dropBusyMsg: $('dropBusyMsg'),
  workspace: $('workspace'), stage: $('stage'), stageBusy: $('stageBusy'), stageBusyMsg: $('stageBusyMsg'),
  stageNote: $('stageNote'), stageNoteText: $('stageNoteText'), stageNoteClose: $('stageNoteClose'),
  stageHint: $('stageHint'),
  fileName: $('fileName'), fileFormat: $('fileFormat'),
  edges: $('edgesToggle'), wire: $('wireToggle'), grid: $('gridToggle'), upGroup: $('upGroup'), upTip: $('upTip'),
  playBtn: $('playBtn'), resetViewBtn: $('resetViewBtn'), pngBtn: $('pngBtn'), openBtn: $('openBtn'),
  infoFormat: $('infoFormat'), infoParts: $('infoParts'), infoTris: $('infoTris'), infoVerts: $('infoVerts'),
  infoPoints: $('infoPoints'), infoPointsRow: $('infoPointsRow'), infoLines: $('infoLines'), infoLinesRow: $('infoLinesRow'),
  infoSize: $('infoSize'), sizeTip: $('sizeTip'),
  measureBtn: $('measureBtn'), measurePanel: $('measurePanel'), measureMode: $('measureMode'), measureClose: $('measureClose'),
  measureHint: $('measureHint'), measureList: $('measureList'), measureFoot: $('measureFoot'),
  measureUndo: $('measureUndo'), measureClear: $('measureClear'), measureTip: $('measureTip'), themeToggle: $('themeToggle'), header: document.querySelector('.header'),
};

const hook = window.__o3v = { state: 'idle', model: null, error: null, viewer: null, loads: 0 };
function report(state, extra) {
  Object.assign(hook, { state }, extra || {});
  document.dispatchEvent(new CustomEvent('o3v:state', { detail: { state } }));
}

// ── The 3D core, loaded on demand ────────────────────────────────────────
let corePromise = null;
function core() {
  if (!corePromise) {
    corePromise = Promise.all([import('./viewer.js'), import('./model.js'), import('./engines/index.js'), import('./measure.js')])
      .then(([v, m, e, r]) => ({ Viewer: v.Viewer, buildModel: m.buildModel, loadFiles: e.loadFiles, Measure: r.Measure }))
      .catch(err => { corePromise = null; throw err; });
  }
  return corePromise;
}
// Warm it up while the reader looks at the drop screen.
const warm = () => core().catch(() => {});
if ('requestIdleCallback' in window) window.addEventListener('load', () => requestIdleCallback(warm, { timeout: 4000 }));
else window.addEventListener('load', () => setTimeout(warm, 1500));

let viewer = null;
let ruler = null;        // the measure tool, made with the viewer
let current = null;      // the model on screen
let currentFiles = null; // its files (blob URLs live until the next model)
let busy = false;

// ── Opening files ────────────────────────────────────────────────────────
async function open(list) {
  if (busy || !list || !list.length) return;
  busy = true;
  hideDropError();
  const label = list.length === 1 ? list[0].name : list.length + ' files';
  setBusy('Reading ' + label + '…');
  report('loading', { error: null });
  try {
    let c;
    try { c = await core(); } catch (e) {
      throw friendly('The 3D engine could not be downloaded. Check your internet connection and try again (once loaded it also works offline).');
    }
    if (!viewer) {
      viewer = hook.viewer = new c.Viewer(dom.stage);
      applyTheme();
      viewer.setGrid(dom.grid.checked);
      viewer.setWireframe(dom.wire.checked);
      viewer.opts.edges = dom.edges.checked;
      ruler = hook.measure = new c.Measure(viewer, { format: fmtMeasure, onChange: showMeasure, onExit: () => setMeasuring(false) });
      applyTheme();
    }
    const loaded = await c.loadFiles(list, { renderer: viewer.renderer, progress: setBusyMsg });
    setBusyMsg('Preparing the view…');
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
    const model = c.buildModel(loaded);

    showWorkspace();
    viewer.resize();
    viewer.setModel(model);
    if (dom.edges.checked && !viewer.setEdges(true)) model.warnings.push('Edges are left off for models over 3 million triangles, to keep the view smooth.');
    if (currentFiles && currentFiles !== loaded.files) currentFiles.dispose();
    currentFiles = loaded.files;
    current = model;
    if (ruler) { ruler.clear(); ruler.setUnit(model.units); }

    showInfo(model);
    showNote(model.warnings, false);
    hook.loads++;
    report('ready', { model: summary(model) });
  } catch (err) {
    const msg = err && err.friendly ? err.message : 'Something went wrong while opening this (' + (err && err.message || err) + ').';
    if (!(err && err.friendly)) console.error(err);
    if (dom.workspace.classList.contains('active')) showNote([msg], true);
    else showDropError(msg);
    report('error', { error: msg });
  } finally {
    busy = false;
    setBusy(null);
    dom.fileInput.value = '';
  }
}

// The audit harness opens files with paths (as a folder drop gives them).
hook.open = list => open(list);

function friendly(message) { const e = new Error(message); e.friendly = true; return e; }

function summary(model) {
  return {
    names: model.names,
    formats: model.formats,
    kinds: model.kinds,
    up: model.up,
    units: model.units,
    size: [model.size.x, model.size.y, model.size.z],
    stats: Object.assign({}, model.stats),
    warnings: model.warnings.slice(),
    animations: model.animations.length,
  };
}

// ── Info, notes and busy states ──────────────────────────────────────────
const NUM = new Intl.NumberFormat('en-US');
const UNIT_NAMES = { 'µm': 'micrometres', mm: 'millimetres', cm: 'centimetres', m: 'metres', km: 'kilometres', in: 'inches', ft: 'feet', mi: 'miles' };

function fmtLen(v) {
  if (!Number.isFinite(v)) return '–';
  const a = Math.abs(v);
  if (a === 0) return '0';
  if (a >= 10000) return NUM.format(Math.round(v));
  return String(parseFloat(v.toPrecision(4)));
}

/* Measurements: five significant figures (a 30 mm edge reads 30, not 29.9999),
   whole numbers grouped once they are large. */
function fmtMeasure(v) {
  if (!Number.isFinite(v)) return '–';
  const a = Math.abs(v);
  if (a === 0) return '0';
  if (a >= 100000) return NUM.format(Math.round(v));
  const t = parseFloat(v.toPrecision(5));
  return Math.abs(t) >= 1000 ? NUM.format(t) : String(t);
}

function showInfo(model) {
  const names = model.names;
  dom.fileName.textContent = names.length === 1 ? names[0] : names.length + ' models';
  dom.fileName.title = names.join(', ');
  dom.fileFormat.textContent = model.formats.join(' + ');
  dom.infoFormat.textContent = model.formats.join(' + ') + (model.kinds.length === 1 && model.kinds[0] === 'cad' ? ' (CAD)' : '');
  const s = model.stats;
  dom.infoParts.textContent = NUM.format(s.parts);
  dom.infoTris.textContent = NUM.format(s.triangles);
  dom.infoVerts.textContent = NUM.format(s.vertices);
  dom.infoPointsRow.hidden = !s.points;
  dom.infoPoints.textContent = NUM.format(s.points);
  dom.infoLinesRow.hidden = !s.segments;
  dom.infoLines.textContent = NUM.format(s.segments);
  const z = model.size;
  dom.infoSize.textContent = fmtLen(z.x) + ' × ' + fmtLen(z.y) + ' × ' + fmtLen(z.z) + (model.units ? ' ' + model.units : '');
  dom.sizeTip.setAttribute('data-tip', model.units
    ? 'Width, depth and height along the file\'s own X, Y and Z axes, in ' + UNIT_NAMES[model.units] + '.'
    : 'Along the file\'s own X, Y and Z axes. ' + model.formats.join(' and ') + ' files carry no unit, so this is in the unit the model was made in, often millimetres.');
  dom.playBtn.hidden = !model.animations.length;
  setPlayLabel(true);
  showUp();
}

function showUp() {
  const up = viewer ? viewer.up : 'y';
  dom.upGroup.querySelectorAll('.seg-btn').forEach(b => {
    const on = b.dataset.up === up;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  dom.upTip.setAttribute('data-tip', up === 'z'
    ? 'The file\'s Z axis points up, as CAD and 3D-printing files usually do. Choose Y if the model lies on its side.'
    : 'The file\'s Y axis points up, as glTF, OBJ and FBX files usually do. Choose Z if the model lies on its back.');
}

function showNote(messages, isError) {
  const list = (messages || []).filter(Boolean);
  if (!list.length) { dom.stageNote.hidden = true; return; }
  dom.stageNoteText.replaceChildren(...list.map(m => { const p = document.createElement('p'); p.textContent = m; return p; }));
  dom.stageNote.classList.toggle('is-error', !!isError);
  dom.stageNote.hidden = false;
}
dom.stageNoteClose.addEventListener('click', () => { dom.stageNote.hidden = true; });

function showDropError(msg) { dom.dropError.textContent = msg; dom.dropError.classList.add('visible'); }
function hideDropError() { dom.dropError.classList.remove('visible'); dom.dropError.textContent = ''; }

function setBusy(msg) {
  const inWorkspace = dom.workspace.classList.contains('active');
  const box = inWorkspace ? dom.stageBusy : dom.dropBusy;
  dom.stageBusy.classList.remove('visible');
  dom.dropBusy.classList.remove('visible');
  if (msg) { setBusyMsg(msg); box.classList.add('visible'); }
}
function setBusyMsg(msg) { dom.dropBusyMsg.textContent = msg; dom.stageBusyMsg.textContent = msg; }

function showWorkspace() {
  if (dom.workspace.classList.contains('active')) return;
  dom.dropZone.style.display = 'none';
  dom.workspace.classList.add('active');
  sizeToHeader();
}

// ── Dropping and picking files ───────────────────────────────────────────
/* A drop can hold folders (a glTF with a textures folder). Entries must be
   taken while the drop event lasts; reading them can wait. */
function entriesOf(dt) {
  const items = dt && dt.items ? [...dt.items].filter(i => i.kind === 'file') : [];
  const entries = items.map(i => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null));
  if (entries.length && entries.every(Boolean)) return { entries };
  return { files: dt ? [...dt.files] : [] };
}

async function readDrop(taken) {
  if (taken.files) return taken.files.map(f => ({ file: f, name: f.name, path: f.name }));
  const out = [];
  const walk = async (entry, prefix) => {
    if (entry.isFile) {
      const f = await new Promise((res, rej) => entry.file(res, rej));
      out.push({ file: f, name: f.name, path: prefix + f.name });
    } else if (entry.isDirectory && out.length < 2000) {
      const reader = entry.createReader();
      for (;;) {
        const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
        if (!batch.length) break;
        for (const e of batch) await walk(e, prefix + entry.name + '/');
      }
    }
  };
  for (const e of taken.entries) await walk(e, '');
  return out;
}

function fromInput(input) { return [...(input.files || [])].map(f => ({ file: f, name: f.name, path: f.webkitRelativePath || f.name })); }

dom.fileInput.addEventListener('change', () => open(fromInput(dom.fileInput)));

// The drop zone lights up; anywhere else on the page a drop still opens the
// model (and never makes the browser navigate to the file).
let dragDepth = 0;
const hasFiles = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
document.addEventListener('dragenter', e => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth++;
  (dom.workspace.classList.contains('active') ? dom.stage : dom.dropZone).classList.add('dragover');
  warm();
});
document.addEventListener('dragover', e => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
document.addEventListener('dragleave', e => {
  if (!hasFiles(e)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) { dom.stage.classList.remove('dragover'); dom.dropZone.classList.remove('dragover'); }
});
document.addEventListener('drop', async e => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth = 0;
  dom.stage.classList.remove('dragover');
  dom.dropZone.classList.remove('dragover');
  const taken = entriesOf(e.dataTransfer);
  open(await readDrop(taken));
});

dom.openBtn.addEventListener('click', () => {
  const fi = document.createElement('input');
  fi.type = 'file';
  fi.multiple = true;
  fi.accept = dom.fileInput.accept;
  fi.addEventListener('change', () => open(fromInput(fi)));
  fi.click();
});

// The sample: a small part with a few materials, shipped with the page.
dom.sampleBtn.addEventListener('click', async e => {
  e.preventDefault();
  e.stopPropagation();
  const label = dom.sampleBtn.textContent;
  dom.sampleBtn.disabled = true;
  dom.sampleBtn.textContent = 'Loading sample…';
  try {
    const res = await fetch('sample.glb');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const blob = await res.blob();
    await open([{ file: new File([blob], 'sample.glb', { type: 'model/gltf-binary' }), name: 'sample.glb', path: 'sample.glb' }]);
  } catch (err) {
    showDropError('The sample model could not be loaded (' + err.message + ').');
  } finally {
    dom.sampleBtn.disabled = false;
    dom.sampleBtn.textContent = label;
  }
});

// ── Toolbar ──────────────────────────────────────────────────────────────
dom.edges.addEventListener('change', () => {
  if (!viewer) return;
  if (!viewer.setEdges(dom.edges.checked)) showNote(['Edges are left off for models over 3 million triangles, to keep the view smooth.'], false);
});
dom.wire.addEventListener('change', () => { if (viewer) viewer.setWireframe(dom.wire.checked); });
dom.grid.addEventListener('change', () => { if (viewer) viewer.setGrid(dom.grid.checked); });
dom.upGroup.addEventListener('click', e => {
  const b = e.target.closest('[data-up]');
  if (!b || !viewer || !current) return;
  viewer.setUp(b.dataset.up);
  showUp();
  if (hook.model) hook.model.viewUp = viewer.up;
});
dom.resetViewBtn.addEventListener('click', () => { if (viewer) viewer.resetView(); });

function setPlayLabel(playing) {
  const t = playing ? 'Pause the animation' : 'Play the animation';
  dom.playBtn.textContent = playing ? '❚❚' : '▶';
  dom.playBtn.title = t;
  dom.playBtn.setAttribute('aria-label', t);
}
dom.playBtn.addEventListener('click', () => {
  if (!viewer) return;
  viewer.setPlaying(!viewer.playing);
  setPlayLabel(viewer.playing);
});

// ── Measure (the ruler) ──────────────────────────────────────────────────
function setMeasuring(on) {
  if (!ruler) return;
  on = !!on && !!current;
  ruler.setActive(on);
  dom.measureBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  dom.measureBtn.classList.toggle('active', on);
  dom.measurePanel.hidden = !on;
  if (on) hideHint();
}
dom.measureBtn.addEventListener('click', () => setMeasuring(!(ruler && ruler.active)));
dom.measureClose.addEventListener('click', () => setMeasuring(false));
dom.measureMode.addEventListener('click', e => {
  const b = e.target.closest('[data-measure]');
  if (b && ruler) ruler.setMode(b.dataset.measure);
});
dom.measureUndo.addEventListener('click', () => { if (ruler) ruler.undo(); });
dom.measureClear.addEventListener('click', () => { if (ruler) ruler.clear(); });
dom.measureList.addEventListener('click', e => {
  const b = e.target.closest('[data-del]');
  if (b && ruler) ruler.remove(+b.dataset.del);
});

const AXES = ['X', 'Y', 'Z'];
const SNAP_TIP = 'Snaps to corners, midpoints, centres of holes, arcs and faces, perpendiculars and edges. Shift: no snap. ';
function showMeasure(st) {
  dom.measureMode.querySelectorAll('[data-measure]').forEach(b => {
    const on = b.dataset.measure === st.mode;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  const u = st.unit ? ' ' + st.unit : '', u2 = st.unit ? ' ' + st.unit + '²' : '';
  const n = st.draft.count;
  dom.measureHint.textContent = st.mode === 'distance'
    ? (n ? 'Click the second point. Esc cancels.' : 'Click two points on the model.')
    : n >= 3 ? 'Click the first corner, double-click or press Enter to close the area (' + n + ' corners).'
      : n ? 'Click the next corner (' + n + ' so far).' : 'Click the corners of the area, in order.';
  dom.measureTip.setAttribute('data-tip', SNAP_TIP
    + (st.unit ? 'Figures are along the file\'s own axes, in ' + UNIT_NAMES[st.unit] + '.' : 'Figures are along the file\'s own axes, in its own unit (the file names none).'));
  const rows = st.items.map((f, i) => {
    const li = document.createElement('li');
    const main = document.createElement('div');
    main.className = 'mp-row';
    const name = document.createElement('span');
    name.className = 'mp-name';
    name.textContent = (i + 1) + '. ' + (f.kind === 'area' ? 'Area' : 'Distance');
    const val = document.createElement('span');
    val.className = 'mp-val';
    val.textContent = fmtMeasure(f.value) + (f.kind === 'area' ? u2 : u);
    main.append(name, val);
    main.insertAdjacentHTML('beforeend', SharedIcon.button('trash', 'Remove this measurement', 'mp-del', 'data-del="' + i + '"'));
    const sub = document.createElement('div');
    sub.className = 'mp-sub';
    sub.textContent = f.kind === 'area'
      ? 'Perimeter ' + fmtMeasure(f.perimeter) + u + ' · ' + f.corners + ' corners' + (f.planar ? '' : ' · not flat: area of the best-fit plane')
      : f.delta.map((d, k) => 'Δ' + AXES[k] + ' ' + fmtMeasure(Math.abs(d))).join(' · ');
    li.append(main, sub);
    return li;
  });
  const dists = st.items.filter(f => f.kind === 'distance');
  if (dists.length > 1) {
    const li = document.createElement('li');
    li.className = 'mp-total';
    li.innerHTML = '<div class="mp-row"><span class="mp-name">Total distance</span><span class="mp-val"></span></div>';
    li.querySelector('.mp-val').textContent = fmtMeasure(dists.reduce((a, f) => a + f.value, 0)) + u;
    rows.push(li);
  }
  dom.measureList.replaceChildren(...rows);
  dom.measureFoot.hidden = !st.items.length && !n;
  dom.measureUndo.disabled = !st.items.length && !n;
  hook.measured = st.items;
}

dom.pngBtn.addEventListener('click', async () => {
  if (!viewer || !current) return;
  const blob = await viewer.snapshot();
  if (!blob) return;
  const base = (current.names.length === 1 ? current.names[0] : 'model').replace(/\.[^.]+$/, '') || 'model';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = base + '.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});

// The how-to hint fades after the first turn or zoom.
const hideHint = () => dom.stageHint.classList.add('gone');
dom.stage.addEventListener('pointerdown', hideHint, { once: true });
dom.stage.addEventListener('wheel', hideHint, { once: true, passive: true });

// ── Theme and layout ─────────────────────────────────────────────────────
function token(name) { return getComputedStyle(document.body).getPropertyValue(name).trim(); }
function applyTheme() {
  if (!viewer) return;
  viewer.setTheme({
    bg: token('--o3v-stage'), bg2: token('--o3v-stage2'), model: token('--o3v-model'), grid: token('--o3v-grid'), grid2: token('--o3v-grid2'),
    line: token('--text'), edge: token('--o3v-edge'),
  });
  if (ruler) ruler.setColours({ line: token('--o3v-measure'), halo: token('--panel'), text: token('--text'), panel: token('--panel'), border: token('--border') });
}
new MutationObserver(applyTheme).observe(document.body, { attributes: true, attributeFilter: ['class'] });
dom.themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light');
  dom.themeToggle.textContent = document.body.classList.contains('light') ? '🌙 Dark' : '☀️ Light';
});

// The stage fills the screen below the header.
function sizeToHeader() {
  document.documentElement.style.setProperty('--o3v-header', dom.header.offsetHeight + 'px');
}
window.addEventListener('resize', sizeToHeader);
sizeToHeader();

// ── Mini cache: the display switches (edges, wireframe, grid) ────────────
if (window.Persist) Persist.init('online-3d-viewer');
