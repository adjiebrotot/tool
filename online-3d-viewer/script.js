/* Online 3D Viewer: the page.

   Drop (or pick) files → engines/index.js finds the model among them and
   hands it to its format's engine → model.js makes the common model →
   viewer.js draws it. three.js and the engines are imported only when the
   first model opens (and warmed up once the page is idle), so the drop
   screen itself loads almost nothing.

   The Download menu saves a picture of the view, or the model itself as
   STEP, STL or GLB (export.js), so the viewer converts too.

   A file with levels or layers (STEP layers, DGN levels; model.js gathers
   them) gets a Levels list on the stage: a legend that shows or hides each.

   The (+) button opens up to two more models in panes beside the stage, to
   compare them side by side; their cameras follow whichever view is being
   turned, each framed to its own model's size.

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
  playBtn: $('playBtn'), addBtn: $('addBtn'), stageRow: $('stageRow'), resetViewBtn: $('resetViewBtn'), pngBtn: $('pngBtn'), openBtn: $('openBtn'),
  dlBtn: $('dlBtn'), dlList: $('dlList'), stepBtn: $('stepBtn'), stlBtn: $('stlBtn'), glbBtn: $('glbBtn'),
  stepSub: $('stepSub'), stlSub: $('stlSub'), glbSub: $('glbSub'),
  infoFormat: $('infoFormat'), infoParts: $('infoParts'), infoTris: $('infoTris'), infoVerts: $('infoVerts'),
  infoPoints: $('infoPoints'), infoPointsRow: $('infoPointsRow'), infoLines: $('infoLines'), infoLinesRow: $('infoLinesRow'),
  infoSize: $('infoSize'), sizeTip: $('sizeTip'),
  measureBtn: $('measureBtn'), measurePanel: $('measurePanel'), measureMode: $('measureMode'), measureClose: $('measureClose'),
  measureHint: $('measureHint'), measureList: $('measureList'), measureFoot: $('measureFoot'),
  measureUndo: $('measureUndo'), measureClear: $('measureClear'), measureTip: $('measureTip'), themeToggle: $('themeToggle'), header: document.querySelector('.header'),
  navPad: $('navPad'), navToggle: $('navToggle'), navBody: $('navBody'),
  infoCard: $('infoCard'), levelPad: $('levelPad'), levelToggle: $('levelToggle'), levelBody: $('levelBody'), levelCount: $('levelCount'),
  levelList: $('levelList'), levelShown: $('levelShown'), levelAll: $('levelAll'), levelNone: $('levelNone'), levelTip: $('levelTip'),
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
      linkView(viewer);
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
    showLevels(model);
    showExports(model);
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
    levels: model.levels.map(l => ({ name: l.name, none: l.none, parts: l.parts, colour: l.colour, shown: levelOn(l) })),
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
  for (const p of panes) p.viewer.setEdges(dom.edges.checked);
  if (!viewer.setEdges(dom.edges.checked)) showNote(['Edges are left off for models over 3 million triangles, to keep the view smooth.'], false);
});
dom.wire.addEventListener('change', () => { if (viewer) viewer.setWireframe(dom.wire.checked); for (const p of panes) p.viewer.setWireframe(dom.wire.checked); });
dom.grid.addEventListener('change', () => { if (viewer) viewer.setGrid(dom.grid.checked); for (const p of panes) p.viewer.setGrid(dom.grid.checked); });
dom.upGroup.addEventListener('click', e => {
  const b = e.target.closest('[data-up]');
  if (!b || !viewer || !current) return;
  viewer.setUp(b.dataset.up);
  showUp();
  if (hook.model) hook.model.viewUp = viewer.up;
});
dom.resetViewBtn.addEventListener('click', () => { leader = viewer; if (viewer) viewer.resetView(); });

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

// ── Levels: the file's levels or layers, as a legend that shows and hides them ──
/* Each level's objects are shown or hidden as a whole; the ruler snaps to
   what is shown, and Download saves what is shown. Which levels are on is
   kept for the model on screen only: the next model opens with all shown. */
const levelOn = l => l.objects.some(o => o.visible);
const levelLabel = l => l.none ? 'On no level' : /^\d+$/.test(l.name) ? 'Level ' + l.name : l.name;

function showLevels(model) {
  const list = model.levels || [];
  dom.levelPad.hidden = !list.length;
  if (!list.length) { dom.levelList.replaceChildren(); sizeInfo(); return; }
  const named = list.filter(l => !l.none).length;
  dom.levelCount.textContent = String(named);
  dom.levelList.replaceChildren(...list.map((l, i) => {
    const li = document.createElement('li');
    li.className = 'lv-row' + (l.none ? ' none' : '');
    li.dataset.level = String(i);
    const label = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = true;
    box.dataset.level = String(i);
    box.setAttribute('data-no-persist', '');
    const sw = document.createElement('span');
    sw.className = 'lv-swatch';
    if (l.colour) sw.style.background = l.colour;
    sw.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.className = 'lv-name';
    name.textContent = levelLabel(l);
    name.title = levelLabel(l) + ': ' + NUM.format(l.parts) + ' part' + (l.parts === 1 ? '' : 's') + (l.colour ? ', ' + l.colour.toUpperCase() : '');
    const n = document.createElement('span');
    n.className = 'lv-n';
    n.textContent = NUM.format(l.parts);
    label.append(box, sw, name, n);
    const only = document.createElement('button');
    only.type = 'button';
    only.className = 'btn-bare lv-only';
    only.dataset.only = String(i);
    only.textContent = 'Only';
    only.title = 'Show ' + levelLabel(l) + ' alone';
    li.append(label, only);
    return li;
  }));
  dom.levelTip.setAttribute('data-tip', 'The ' + (model.formats.includes('STEP') ? 'layers (levels) the STEP file' : 'levels the file') + ' puts its parts on, each in the colour most of its parts are drawn in. Untick one to hide it; Only shows that level alone. Measure and Download take what is shown.');
  syncLevels();
  sizeInfo();
}

function syncLevels() {
  if (!current) return;
  const list = current.levels;
  let on = 0;
  list.forEach((l, i) => {
    const shown = levelOn(l);
    if (shown) on++;
    const box = dom.levelList.querySelector('input[data-level="' + i + '"]');
    if (box) box.checked = shown;
    const row = box && box.closest('.lv-row');
    if (row) row.classList.toggle('off', !shown);
  });
  dom.levelShown.textContent = on + ' of ' + list.length;
  dom.levelAll.disabled = on === list.length;
  dom.levelNone.disabled = on === 0;
  if (hook.model) hook.model.levels = summary(current).levels;
}

function setLevels(fn) {
  if (!current || !viewer) return;
  current.levels.forEach((l, i) => { const v = !!fn(l, i); for (const o of l.objects) o.visible = v; });
  syncLevels();
  viewer.request();
}
hook.setLevels = names => setLevels(l => names.includes(l.name));

dom.levelList.addEventListener('change', e => {
  const box = e.target.closest('input[data-level]');
  if (!box || !current) return;
  const i = +box.dataset.level;
  setLevels((l, k) => (k === i ? box.checked : levelOn(l)));
});
dom.levelList.addEventListener('click', e => {
  const b = e.target.closest('[data-only]');
  if (b) { const i = +b.dataset.only; setLevels((l, k) => k === i); }
});
dom.levelAll.addEventListener('click', () => setLevels(() => true));
dom.levelNone.addEventListener('click', () => setLevels(() => false));

function setLevelsOpen(open) {
  dom.levelBody.hidden = !open;
  dom.levelToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  dom.levelToggle.title = open ? 'Hide the levels' : 'Show the levels: a legend of the file\'s levels, to show or hide each';
}
dom.levelToggle.addEventListener('click', () => setLevelsOpen(dom.levelBody.hidden));
// Open on a wide screen; on a phone it would cover the model, so it waits to be asked for.
setLevelsOpen(!window.matchMedia('(max-width: 720px)').matches);

// The levels stop above the info card, which shares the left side.
function sizeInfo() { dom.stage.style.setProperty('--o3v-info-h', (dom.infoCard.offsetHeight || 0) + 'px'); }

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

// ── Download: a picture, or the model in another format ──────────────────
function baseNameOf(model) {
  return (model.names.length === 1 ? model.names[0] : 'model').replace(/\.[^.]+$/, '') || 'model';
}
function save(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  hook.saved = { name, size: blob.size, type: blob.type };
}

dom.pngBtn.addEventListener('click', async () => {
  if (!viewer || !current) return;
  const blob = await viewer.snapshot();
  if (blob) save(blob, baseNameOf(current) + '.png');
});

/* What each format can carry from this model, said on its row before the
   reader picks it (a line drawing has no surfaces for an STL). */
function exportable(model) {
  const s = model.stats;
  const unit = model.units ? 'millimetres' : 'the file\'s own unit';
  return {
    step: s.triangles || s.segments
      ? { ok: true, sub: 'For CAD: ' + (s.triangles ? 'faceted solids and surfaces' : 'the lines and curves') + (s.triangles && s.segments ? ', lines' : '') + ', in ' + unit }
      : { ok: false, sub: 'Nothing to save: a point cloud has no surfaces or lines' },
    stl: s.triangles
      ? { ok: true, sub: 'For 3D printing: every triangle, in ' + unit }
      : { ok: false, sub: 'No surfaces to save: this model is ' + (s.segments ? 'lines' : 'points') + ' only' },
    glb: { ok: true, sub: model.animations.length ? 'The scene with its materials and animation' : 'The scene with its materials and textures' },
  };
}

function showExports(model) {
  const x = exportable(model);
  for (const k of ['step', 'stl', 'glb']) {
    dom[k + 'Btn'].disabled = !x[k].ok;
    dom[k + 'Sub'].textContent = x[k].sub;
  }
}

let exporter = null;
const exportCore = () => exporter || (exporter = import('./export.js').catch(e => { exporter = null; throw e; }));

async function saveAs(kind) {
  if (!viewer || !current || busy) return;
  const model = current;
  const lvOn = model.levels.filter(levelOn).length;
  if (model.levels.length && !lvOn) { showNote(['Every level is hidden, so there is nothing to save. Tick the levels to save in the Levels list.'], true); return; }
  busy = true;
  setBusy('Writing the ' + { step: 'STEP', stl: 'STL', glb: 'glTF' }[kind] + ' file…');
  try {
    // Let the busy note paint before a large model ties up the page.
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
    const X = await exportCore();
    const name = baseNameOf(model);
    const up = viewer.up;   // the axis the reader sees as up
    const known = model.units && X.TO_MM[model.units];
    let blob, extra = [];
    if (kind === 'glb') {
      blob = await X.toGlb(model.content, model.animations, X.targetMatrix(up, 'y', known ? X.TO_MM[model.units] / 1000 : 1));
    } else {
      const toMm = known ? X.TO_MM[model.units] : 1;
      const data = X.collect(model.content, X.targetMatrix(up, 'z', toMm));
      if (kind === 'stl') {
        blob = X.toStl(data, name + (known ? ', millimetres' : ''));
        if (data.lines.length || data.points) extra.push('STL holds triangles only, so the ' + (data.lines.length ? 'lines' : 'points') + ' were left out.');
      } else {
        const size = model.size ? Math.max(model.size.x, model.size.y, model.size.z) * toMm : 1;
        const r = X.toStep(data, name, size);
        blob = r.blob;
        hook.lastStep = { solids: r.solids, shells: r.shells, faces: r.faces, curves: r.curves };
        if (data.triangles) extra.push('STEP from a mesh is faceted: flat faces as drawn here, not the exact curved surfaces' + (model.kinds.includes('cad') ? ' of the original CAD file' : '') + '.');
        if (data.points) extra.push('STEP holds no point clouds, so the points were left out.');
      }
      if (!known) extra.push(model.formats.join(' and ') + ' names no unit, so the numbers are saved as they are (often millimetres already).');
    }
    if (lvOn < model.levels.length) extra.unshift('Only the levels shown were saved (' + lvOn + ' of ' + model.levels.length + ').');
    save(blob, name + '.' + kind);
    if (extra.length) showNote(extra, false);
  } catch (err) {
    console.error(err);
    showNote(['The model could not be saved as ' + kind.toUpperCase() + ' (' + (err && err.message || err) + ').'], true);
  } finally {
    busy = false;
    setBusy(null);
  }
}
dom.stepBtn.addEventListener('click', () => saveAs('step'));
dom.stlBtn.addEventListener('click', () => saveAs('stl'));
dom.glbBtn.addEventListener('click', () => saveAs('glb'));
hook.saveAs = saveAs;

/* The menu: the site's dropdown list (as the Share menu on the other tools),
   under the button, closed by a pick, a click elsewhere, Esc or Tab. */
const dlRows = () => [...dom.dlList.querySelectorAll('.share-opt')].filter(b => !b.disabled);
function dlOpen() {
  if (!current) return;
  showExports(current);
  if (dom.dlList.parentNode !== document.body) document.body.appendChild(dom.dlList);
  dom.dlList.classList.add('is-open');
  dom.dlBtn.setAttribute('aria-expanded', 'true');
  if (window.SharedDropdown) SharedDropdown.place(dom.dlBtn, dom.dlList, { minWidth: 300, align: 'end', maxHeight: 360 });
}
function dlClose(refocus) {
  if (!dom.dlList.classList.contains('is-open')) return;
  dom.dlList.classList.remove('is-open');
  dom.dlBtn.setAttribute('aria-expanded', 'false');
  if (refocus) dom.dlBtn.focus({ preventScroll: true });
}
const dlIsOpen = () => dom.dlList.classList.contains('is-open');
dom.dlBtn.addEventListener('click', e => {
  e.stopPropagation();
  if (dlIsOpen()) { dlClose(); return; }
  dlOpen();
  const r = dlRows()[0];
  if (r) r.focus({ preventScroll: true });
});
dom.dlBtn.addEventListener('keydown', e => {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  e.preventDefault();
  dlOpen();
  const r = dlRows(), to = e.key === 'ArrowDown' ? r[0] : r[r.length - 1];
  if (to) to.focus({ preventScroll: true });
});
dom.dlList.addEventListener('click', e => {
  e.stopPropagation();
  const b = e.target.closest('.share-opt');
  if (b && !b.disabled) dlClose(true);
});
dom.dlList.addEventListener('mousemove', e => {
  const b = e.target.closest('.share-opt');
  if (b && !b.disabled && b !== document.activeElement && dom.dlList.contains(document.activeElement)) b.focus({ preventScroll: true });
});
dom.dlList.addEventListener('keydown', e => {
  const r = dlRows(), i = r.indexOf(document.activeElement);
  let to = null;
  if (e.key === 'ArrowDown') to = r[(i + 1) % r.length];
  else if (e.key === 'ArrowUp') to = r[(i - 1 + r.length) % r.length];
  else if (e.key === 'Home') to = r[0];
  else if (e.key === 'End') to = r[r.length - 1];
  else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); dlClose(true); return; }
  else return;
  e.preventDefault();
  if (to) to.focus();
});
document.addEventListener('click', () => dlClose());
window.addEventListener('resize', () => dlClose());
window.addEventListener('scroll', e => { if (!dom.dlList.contains(e.target)) dlClose(); }, true);

// ── Camera by button: the pad on the stage, and the keyboard ─────────────
/* A click is one step (15°, a tenth of the view, 25% zoom) that glides into
   place; held past a moment, the button keeps the model moving until it is let
   go, as the arrows on a CAD program's view cube do. */
const HOLD_AFTER = 350;   // ms before a press becomes a hold
let navHold = null;       // { timer, btn, pointerId } while a pad button is down

function navStep(op, dir, steps) {
  if (!viewer || !current) return;
  leader = viewer;
  hideHint();
  if (op === 'fit') viewer.fit();
  else viewer.nudge(op, dir * (steps || 1));
}
function navRelease() {
  if (!navHold) return;
  clearTimeout(navHold.timer);
  navHold.btn.classList.remove('held');
  if (viewer) viewer.hold(null);
  navHold = null;
}
dom.navBody.addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-nav]');
  if (!b || e.button !== 0) return;
  e.preventDefault();   // no focus ring flash, no text selection, no long-press menu
  navRelease();
  const op = b.dataset.nav, dir = +b.dataset.dir || 1;
  navStep(op, dir);
  if (op === 'fit') return;
  try { b.setPointerCapture(e.pointerId); } catch (_) {}
  navHold = { btn: b, timer: setTimeout(() => { if (viewer && current) { b.classList.add('held'); viewer.hold(op, dir); } }, HOLD_AFTER) };
});
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) dom.navBody.addEventListener(ev, navRelease);
window.addEventListener('blur', navRelease);
dom.navBody.addEventListener('contextmenu', e => { if (e.target.closest('[data-nav]')) e.preventDefault(); });
// Keyboard on a focused pad button (Enter, Space) takes one step; the pointer
// already did its own, so a click that came from a pointer is skipped.
dom.navBody.addEventListener('click', e => {
  const b = e.target.closest('[data-nav]');
  if (b && e.detail === 0) navStep(b.dataset.nav, +b.dataset.dir || 1);
  const v = e.target.closest('[data-view]');
  if (v && viewer && current) { hideHint(); leader = viewer; viewer.view(v.dataset.view); }
});

function setNavOpen(open) {
  dom.navBody.hidden = !open;
  dom.navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  dom.navToggle.title = open ? 'Hide the camera controls' : 'Show the camera controls: turn, roll, pan, zoom and standard views';
  if (open) dom.navPad.removeAttribute('data-collapsed'); else dom.navPad.setAttribute('data-collapsed', '');
  sizeNav();
}
// The ruler's panel shares the right side; it stops above the pad.
function sizeNav() { dom.stage.style.setProperty('--o3v-nav-h', (dom.navPad.offsetHeight + 12) + 'px'); }
dom.navToggle.addEventListener('click', () => setNavOpen(dom.navBody.hidden));
// Open on a wide screen; on a phone it would cover the model, so it waits to be asked for.
setNavOpen(!window.matchMedia('(max-width: 720px)').matches);

/* Keys: arrows turn 15° (Shift: 90°), Q and E roll, Ctrl + arrows pan, + and
   − zoom, F fits, 0 to 6 the standard views. (Not Alt + arrows for the roll,
   as CAD programs have it: in a browser Alt + ← goes back a page, and the
   model with it.) Not while typing, and never with Alt or Cmd held. */
const VIEW_KEYS = { 1: 'front', 2: 'back', 3: 'left', 4: 'right', 5: 'top', 6: 'bottom', 0: 'iso' };
window.addEventListener('keydown', e => {
  if (e.defaultPrevented || e.metaKey || e.altKey || !viewer || !current || !dom.workspace.classList.contains('active')) return;
  const t = e.target;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  if (t && t.closest && t.closest('[role="menu"], [role="listbox"], .bmc-btn-container, #bmc-wbtn')) return;
  const k = e.key;
  const arrow = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[k];
  let done = true;
  if (arrow) {
    const [x, y] = arrow;
    if (e.ctrlKey) navStep(x ? 'panx' : 'pany', x || y);
    else if (x) navStep('yaw', -x, e.shiftKey ? 6 : 1);
    else navStep('pitch', y, e.shiftKey ? 6 : 1);
  } else if (e.ctrlKey) done = false;
  else if (k === 'q' || k === 'Q') navStep('roll', 1);
  else if (k === 'e' || k === 'E') navStep('roll', -1);
  else if (k === '+' || k === '=') navStep('zoom', 1);
  else if (k === '-' || k === '_') navStep('zoom', -1);
  else if (k === 'f' || k === 'F') navStep('fit', 1);
  else if (k in VIEW_KEYS) { hideHint(); leader = viewer; viewer.view(VIEW_KEYS[k]); }
  else done = false;
  if (done) e.preventDefault();
});

// The how-to hint fades after the first turn or zoom.
const hideHint = () => dom.stageHint.classList.add('gone');
dom.stage.addEventListener('pointerdown', hideHint, { once: true });
dom.stage.addEventListener('wheel', hideHint, { once: true, passive: true });

// ── Compare: more models side by side ────────────────────────────────────
/* Each pane is its own Viewer with its own model, beside the stage. The
   display switches and the theme apply to all; the ruler, levels and Download
   stay with the main model. The cameras are linked: whichever view the reader
   last turned leads, and the others take the same angle and framing, each
   scaled to its own model, so the models are seen from the same side. */
const MAX_MODELS = 3;
const panes = [];        // { el, viewer, model, files }
let leader = null;       // the view the others follow
hook.panes = panes;

function linkView(v) {
  const take = () => { leader = v; };
  v.renderer.domElement.addEventListener('pointerdown', take);
  v.renderer.domElement.addEventListener('wheel', take, { passive: true });
  v.onView = src => {
    if (src !== (leader || viewer) || !panes.length) return;
    const lp = src.linkPose();
    if (!lp) return;
    for (const o of [viewer, ...panes.map(p => p.viewer)]) if (o && o !== src && o.model) o.followPose(lp);
  };
}

function syncCompare() {
  dom.addBtn.disabled = panes.length >= MAX_MODELS - 1;
  dom.addBtn.title = dom.addBtn.disabled
    ? 'Three models are open, the most that fit side by side. Close one (×) to open another.'
    : 'Open another model beside this one, to compare them side by side (up to ' + MAX_MODELS + ')';
  dom.stageRow.classList.toggle('comparing', panes.length > 0);
  hook.compare = panes.map(p => p.model ? summary(p.model) : null);
}

function makePane() {
  const el = document.createElement('div');
  el.className = 'cmp-pane';
  el.innerHTML = '<div class="cmp-head" data-no-abbr><span class="cmp-name">…</span><span class="fmt-badge"></span><span class="cmp-size"></span>'
    + SharedIcon.button('close', 'Close this model', 'cmp-close') + '</div>'
    + '<div class="busy visible" aria-live="polite"><span class="spinner" aria-hidden="true"></span><span class="busy-msg">Reading…</span></div>';
  dom.stageRow.appendChild(el);
  return el;
}

function closePane(pane) {
  const i = panes.indexOf(pane);
  if (i < 0) return;
  panes.splice(i, 1);
  if (leader === pane.viewer) leader = viewer;
  pane.viewer.dispose();
  if (pane.files) pane.files.dispose();
  pane.el.remove();
  syncCompare();
}

async function openCompare(list) {
  if (!list || !list.length || !current || panes.length >= MAX_MODELS - 1) return;
  const c = await core();
  const el = makePane();
  const pane = { el, viewer: new c.Viewer(el), model: null, files: null };
  if (!panes.length) setNavOpen(false);   // the main view narrows: the pad would cover its model
  panes.push(pane);
  syncCompare();
  const v = pane.viewer;
  v.setTheme(themeOf());
  v.setGrid(dom.grid.checked);
  v.setWireframe(dom.wire.checked);
  v.opts.edges = dom.edges.checked;
  linkView(v);
  el.querySelector('.cmp-close').addEventListener('click', () => closePane(pane));
  const msg = el.querySelector('.busy-msg');
  try {
    const loaded = await c.loadFiles(list, { renderer: v.renderer, progress: m => { msg.textContent = m; } });
    if (!panes.includes(pane)) { loaded.files.dispose(); return; }
    msg.textContent = 'Preparing the view…';
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
    const model = c.buildModel(loaded);
    pane.model = model;
    pane.files = loaded.files;
    v.setModel(model);
    if (dom.edges.checked) v.setEdges(true);
    const name = model.names.length === 1 ? model.names[0] : model.names.length + ' models';
    el.querySelector('.cmp-name').textContent = name;
    el.querySelector('.cmp-name').title = model.names.join(', ');
    el.querySelector('.fmt-badge').textContent = model.formats.join(' + ');
    const z = model.size;
    el.querySelector('.cmp-size').textContent = fmtLen(z.x) + ' × ' + fmtLen(z.y) + ' × ' + fmtLen(z.z) + (model.units ? ' ' + model.units : '');
    // Every view just got narrower: fit the main model again from where it
    // is seen, and the panes follow it there.
    if (viewer && viewer.model) { viewer.resize(); v.followPose(viewer.linkPose()); leader = viewer; viewer.fit(); }
    syncCompare();
  } catch (err) {
    const m = err && err.friendly ? err.message : 'This could not be opened (' + (err && err.message || err) + ').';
    if (!(err && err.friendly)) console.error(err);
    const p = document.createElement('p');
    p.className = 'cmp-error';
    p.setAttribute('role', 'alert');
    p.textContent = m;
    el.appendChild(p);
  } finally {
    el.querySelector('.busy').classList.remove('visible');
  }
}
hook.openCompare = list => openCompare(list);

dom.addBtn.addEventListener('click', () => {
  if (dom.addBtn.disabled) return;
  const fi = document.createElement('input');
  fi.type = 'file';
  fi.multiple = true;
  fi.accept = dom.fileInput.accept;
  fi.addEventListener('change', () => openCompare(fromInput(fi)));
  fi.click();
});
syncCompare();

// ── Theme and layout ─────────────────────────────────────────────────────
function token(name) { return getComputedStyle(document.body).getPropertyValue(name).trim(); }
function themeOf() {
  return {
    bg: token('--o3v-stage'), bg2: token('--o3v-stage2'), model: token('--o3v-model'), grid: token('--o3v-grid'), grid2: token('--o3v-grid2'),
    line: token('--text'), edge: token('--o3v-edge'),
  };
}
function applyTheme() {
  if (!viewer) return;
  const t = themeOf();
  viewer.setTheme(t);
  for (const p of panes) p.viewer.setTheme(t);
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
  if (dom.navPad) sizeNav();
  if (dom.infoCard) sizeInfo();
}
window.addEventListener('resize', sizeToHeader);
sizeToHeader();

// ── Mini cache: the display switches (edges, wireframe, grid) ────────────
if (window.Persist) Persist.init('online-3d-viewer');
