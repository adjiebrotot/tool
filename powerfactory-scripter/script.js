/* ================================================================
   TOOLTIP HELPER
================================================================ */
function tip(text, id = '') {
  const idAttr = id ? ` id="${id}"` : '';
  return `<span class="tip-icon"${idAttr} data-tip="${text.replace(/"/g, '&quot;')}">?</span>`;
}

/* ================================================================
   DYNAMIC TOOLTIP HELPERS & TEXT MAPS
================================================================ */
function setTip(id, text) {
  const el = document.getElementById(id);
  if (el) el.setAttribute('data-tip', text);
}

const TIP_PROBLEM_TYPE = {
  brute_force:  'Runs every combination of input values. Total runs = product of all step counts.',
  optimisation: 'Uses a search algorithm to find the best input combination. Configure algorithm below.',
  custom:       'Reads input values row-by-row from an Excel file. Download the template for the required format.',
  contingency:  'Takes each matched element out-of-service one at a time (N-1) or in pairs (N-2). No Excel file needed — wildcards are resolved at runtime. Study Type is locked to Steady State.',
};
const TIP_STUDY_TYPE = {
  steady_state: 'Runs a load flow (ElmLdf) each iteration. Timeseries outputs are not available.',
  dynamic_rms:  'Runs an RMS simulation (ComSim) each iteration. Enables timeseries outputs.',
  dynamic_emt:  'Runs an EMT simulation (ComSim) each iteration. Enables timeseries outputs.',
  harmonic:     'Runs a harmonic/frequency sweep (ComHlf) each iteration.',
};
const TIP_CODING_STYLE = {
  python_file: 'Wraps all code in main() for clean script execution.',
  notebook:    'Organises code into labelled cells for Jupyter or VS Code notebooks.',
};
const TIP_MAX_ITER = {
  placeholder:            'Not used in placeholder mode — fill in your own search loop.',
  scipy_nelder_mead:      'Max function evaluations. 50–200 is typical for local methods.',
  scipy_powell:           'Max function evaluations. 50–200 is typical for local methods.',
  scipy_lbfgsb:           'Max function evaluations. 50–200 is typical for local methods.',
  scipy_slsqp:            'Max function evaluations. 50–200 is typical for local methods.',
  scipy_cobyla:           'Max function evaluations. 50–200 is typical for local methods.',
  differential_evolution: 'Max generations × population. 100–500 is typical for global search.',
  gp_minimize:            'Acquisition calls. 30–100 is usually sufficient for expensive objectives.',
};
const TIP_OUTPUT_TYPE = {
  attribute:          'Read a single value after solving via obj.GetAttribute().',
  timeseries:         'Extract a scalar metric from a time signal (dynamic study only).',
  custom_calculation: 'Calls a user-defined Python function using other variable values.',
};
const TIP_OUTPUT_OBJ = {
  attribute:  'Object query for GetCalcRelevantObjects() (e.g. Grid.ElmTerm).',
  timeseries: 'Element name as shown in the ElmRes export header (e.g. HV_Bus — no path or class suffix).',
};
const TIP_OUTPUT_ATTR = {
  attribute:  'Result variable key for GetAttribute() (e.g. m:u1, c:loading, m:P).',
  timeseries: 'Variable key from PF result variable browser (e.g. m:u1, m:I:bus1).',
};
const TIP_METRIC = {
  maximum:          'Peak value of the signal over the full simulation window.',
  minimum:          'Trough value of the signal over the full simulation window.',
  mean:             'Time-averaged value across the simulation window.',
  median:           'Median value across the simulation window.',
  first_time_above: 'First time the signal rises above the threshold.',
  first_time_below: 'First time the signal falls below the threshold.',
  time_settle:      'Time until the signal stays within ±band of the reference for the full hold duration.',
};

/* ================================================================
   GLOBAL STATE — output variable counter, ace editors map
================================================================ */
let outputVarCounter = 0;
const aceEditors = {}; // keyed by output var id

/* ================================================================
   SECTION COLLAPSE TOGGLE
================================================================ */
function toggleSection(id) {
  const card = document.getElementById(id);
  const header = card.querySelector('.section-header');
  const body = card.querySelector('.section-body');
  const collapsed = header.classList.toggle('collapsed');
  body.classList.toggle('hidden', collapsed);
}

/* ================================================================
   REACTIVE UI UPDATES
================================================================ */
/* ================================================================
   CONTINGENCY CONFIG — dynamic element type rows
================================================================ */
let contingencyRowCounter = 0;

function addContingencyRow(data) {
  data = data || {};
  const idx = ++contingencyRowCounter;
  const tbody = document.getElementById('contingency-tbody');
  const tr = document.createElement('tr');
  tr.id = `cont-row-${idx}`;
  const filterAttr = String(data.filterAttr || '');
  const allowedOps = getAllowedContingencyFilterOps(filterAttr);
  const opOptions = allowedOps.map(op =>
    `<option value="${op}"${(data.filterOp||'>=')===op?' selected':''}>${op==='=='?'=':op==='!='?'≠':op}</option>`
  ).join('');
  tr.innerHTML = `
    <td style="text-align:center;color:var(--muted);font-size:12px;">${idx}</td>
    <td><input type="text" id="cont-query-${idx}" value="${(data.query||'*.ElmLne').replace(/"/g,'&quot;')}" placeholder="*.ElmLne" oninput="onContingencyQueryChange(${idx})" style="min-width:120px;" autocomplete="off" /></td>
    <td><input type="text" id="cont-filter-attr-${idx}" value="${filterAttr.replace(/"/g,'&quot;')}" placeholder="e.g. e:Unom" oninput="onContingencyFilterAttrChange(${idx})" style="min-width:100px;" autocomplete="off" /></td>
    <td><select id="cont-filter-op-${idx}" style="width:56px;">${opOptions}</select></td>
    <td><input type="text" id="cont-filter-val-${idx}" value="${(data.filterVal||'').replace(/"/g,'&quot;')}" placeholder="e.g. 66 or North*" style="min-width:100px;" autocomplete="off" /></td>
    <td><button class="btn btn-ghost btn-xs" id="cont-remove-${idx}" onclick="removeContingencyRow(${idx})" style="padding:2px 6px;">✕</button></td>
  `;
  tbody.appendChild(tr);
  // Attach comboboxes
  const queryInput = document.getElementById(`cont-query-${idx}`);
  new PFComboBox(queryInput, typed => getObjectSuggestions(typed));
  const filterAttrInput = document.getElementById(`cont-filter-attr-${idx}`);
  new PFComboBox(filterAttrInput, typed => {
    const q = document.getElementById(`cont-query-${idx}`)?.value || '';
    const m = q.match(/\.([A-Za-z][A-Za-z0-9]+)(?:\s*$)/);
    return getContingencyFilterAttrSuggestions(typed, m ? m[1] : null);
  });
  onContingencyFilterAttrChange(idx);
  updateContingencyRemoveButtons();
  onContingencyNChange();
}

function removeContingencyRow(idx) {
  const row = document.getElementById(`cont-row-${idx}`);
  if (row) row.remove();
  updateContingencyRemoveButtons();
  onContingencyNChange();
}

function updateContingencyRemoveButtons() {
  const rows = document.querySelectorAll('#contingency-tbody tr');
  rows.forEach(tr => {
    const btn = tr.querySelector('button');
    if (btn) btn.style.visibility = rows.length <= 1 ? 'hidden' : '';
  });
}


function getAllowedContingencyFilterOps(filterAttr) {
  return isInputAttrBlacklisted(filterAttr) ? ['==', '!='] : ['>=', '<=', '==', '!=', '>', '<'];
}

function onContingencyFilterAttrChange(idx) {
  const attr = (document.getElementById(`cont-filter-attr-${idx}`)?.value || '').trim();
  const opSel = document.getElementById(`cont-filter-op-${idx}`);
  if (!opSel) return;
  const prev = opSel.value || '==';
  const allowedOps = getAllowedContingencyFilterOps(attr);
  opSel.innerHTML = allowedOps.map(op =>
    `<option value="${op}">${op==='=='?'=':op==='!='?'≠':op}</option>`
  ).join('');
  opSel.value = allowedOps.includes(prev) ? prev : allowedOps[0];
}
function onContingencyQueryChange(idx) {
  // no-op for now; combobox already handles suggestions
}

function onContingencyNChange() {
  const n = document.getElementById('contingency-n')?.value;
  const rows = document.querySelectorAll('#contingency-tbody tr');
  const showCombine = n === '2' && rows.length > 1;
  document.getElementById('row-contingency-combine')?.classList.toggle('cond-hidden', !showCombine);
}

function getContingencyElementTypes() {
  const rows = document.querySelectorAll('#contingency-tbody tr');
  const result = [];
  rows.forEach(tr => {
    const idx = tr.id.replace('cont-row-', '');
    const query     = (document.getElementById(`cont-query-${idx}`)?.value || '').trim();
    const filterAttr= (document.getElementById(`cont-filter-attr-${idx}`)?.value || '').trim();
    const filterOp  = document.getElementById(`cont-filter-op-${idx}`)?.value || '>=';
    const filterVal = (document.getElementById(`cont-filter-val-${idx}`)?.value || '').trim();
    if (query) result.push({ query, filterAttr, filterOp, filterVal });
  });
  return result;
}

function getContingencyFilterAttrSuggestions(typed, elmClass) {
  const q = (typed || '').toLowerCase();
  const seen = new Set();
  const results = [];
  const addItem = item => {
    const key = String(item.var || '').toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    results.push({ var: item.var, desc: item.desc || '', unit: item.unit || '' });
  };
  // element_params entries (same as input attr suggestions)
  if (PF_REF.params && elmClass && PF_REF.params[elmClass]) {
    PF_REF.params[elmClass].forEach(item => {
      const raw = String(item.var || '').toLowerCase();
      const desc = (item.desc || '').toLowerCase();
      if (!q || raw.includes(q) || desc.includes(q)) addItem(item);
    });
  }
  // System / identity attributes always available for filtering
  const SYSTEM_ATTRS = [
    { var: 'loc_name',   desc: 'Element name (supports wildcard strings)', unit: '' },
    { var: 'outserv',    desc: 'Out of service flag (0 = in, 1 = out)',    unit: '' },
    { var: 'e:Unom',     desc: 'Nominal voltage',                          unit: 'kV' },
    { var: 'e:Un',       desc: 'Rated voltage',                            unit: 'kV' },
    { var: 'e:Inom',     desc: 'Rated current',                            unit: 'kA' },
    { var: 'fold_id',    desc: 'Parent folder reference',                  unit: '' },
    { var: 'cpSite',     desc: 'Site assignment',                          unit: '' },
    { var: 'e:cimRdfId', desc: 'CIM RDF identifier',                       unit: '' },
  ];
  SYSTEM_ATTRS.forEach(item => {
    const raw = item.var.toLowerCase();
    const desc = item.desc.toLowerCase();
    if (!q || raw.includes(q) || desc.includes(q)) addItem(item);
  });
  return results.slice(0, 50);
}

function onProblemTypeChange() {
  const pt = document.getElementById('problem-type').value;
  const isCont = pt === 'contingency';
  // Update dynamic tooltips
  setTip('tt-problem-type', TIP_PROBLEM_TYPE[pt] || '');
  const isOpt = pt === 'optimisation';
  setTip('tt-lb', isOpt ? 'Lower boundary of the search space for this variable.' : 'Start of the swept range (inclusive).');
  setTip('tt-ub', isOpt ? 'Upper boundary of the search space for this variable.' : 'End of the swept range (inclusive).');
  // Custom section
  document.getElementById('sec-custom').classList.toggle('cond-hidden', pt !== 'custom');
  // Optimisation section
  document.getElementById('sec-optim').classList.toggle('cond-hidden', pt !== 'optimisation');
  // Contingency section
  document.getElementById('sec-contingency').classList.toggle('cond-hidden', !isCont);
  // Hide input variables section in contingency mode (element query drives the loop)
  document.getElementById('sec-inputs').classList.toggle('cond-hidden', isCont);
  // Lock study type to steady state for contingency
  const stSelect = document.getElementById('study-type');
  if (isCont) {
    stSelect.value = 'steady_state';
    stSelect.disabled = true;
    onStudyTypeChange();
  } else {
    stSelect.disabled = false;
  }
  // Refresh objective dropdown when switching to optimisation
  if (pt === 'optimisation') refreshObjectiveDropdown();
  // Toggle input table column visibility
  const table = document.getElementById('input-table');
  // Optimisation: hide step size only; Custom: hide step + bounds
  table.classList.toggle('input-table-hide-step', pt === 'optimisation' || pt === 'custom');
  table.classList.toggle('input-table-hide-bounds', pt === 'custom');
}

function onStudyTypeChange() {
  const st = document.getElementById('study-type').value;
  setTip('tt-study-type', TIP_STUDY_TYPE[st] || '');
  const isDynamic = st === 'dynamic_rms' || st === 'dynamic_emt';
  document.getElementById('row-tstop').style.display = isDynamic ? 'grid' : 'none';
  if (st === 'dynamic_emt') document.getElementById('tstop').value = 0.25;
  else if (st === 'dynamic_rms') document.getElementById('tstop').value = 20;
  updateTimeseriesAvailability();
  refreshLiveWarnings();
}


function onCodingStyleChange() {
  const cs = document.getElementById('coding-style').value;
  setTip('tt-coding-style', TIP_CODING_STYLE[cs] || '');
  updateDownloadButtonLabel();
}

function onSaveIntermediateChange() {
  const checked = document.getElementById('save-intermediate').checked;
  document.getElementById('row-save-interval').classList.toggle('cond-hidden', !checked);
}

/* ================================================================
   REFERENCE DATA — loaded from variables_index.json + element_params.json
   on startup. Individual variables/ElmXxx.json files are lazy-loaded
   on demand the first time a user focuses the Attribute field for
   that element class.

   Deploy alongside index.html:
     variables_index.json      (68 KB  — gateway index, loaded on startup)
     variables/                (folder — lazy-loaded per element class)
     element_params.json       (512 KB — input param suggestions, loaded on startup)
     variables/types/          (folder — lazy-loaded per type class, e.g. TypLod, TypTr2)
     type_params.json          (input param suggestions for TypXxx classes, loaded on startup)
================================================================ */
const PF_REF = {
  index:    null,   // variables/elements/element_variables_index.json → {ElmXxx: {file, study_groups}}
  params:   null,   // element_params.json   →  {ElmXxx: [{var,unit,desc},...]}
  evtIndex: null,   // variables/events/event_variables_index.json → {EvtXxx: {file, params}}
  typIndex: null,   // variables/types/type_variables_index.json → {TypXxx: {file, params}}
  typParams: null,  // type_params.json      →  {TypXxx: [{var,unit,desc},...]}
  varFiles: {},     // cache: ElmXxx → full variables/ElmXxx.json data
  typFiles: {},     // cache: TypXxx → full variables/types/TypXxx.json data
  loading:  new Set(), // classes currently being fetched
  typLoading: new Set(), // type classes currently being fetched
};

// Map HTML study-type → variables/ElmXxx.json result_vars key
const STUDY_TYPE_KEY = {
  steady_state: 'load_flow',
  harmonic:     'frequency_sweep',
  dynamic_rms:  'dynamic_rms',
  dynamic_emt:  'dynamic_emt',   // full file HAS dynamic_emt (unlike curated variables.json)
};

async function fetchReferenceData() {
  const badge = document.getElementById('ref-data-badge');
  try {
    const [idxRes, paramsRes, evtIdxRes, typIdxRes, typParamsRes] = await Promise.all([
      fetch('variables/elements/element_variables_index.json').catch(() => null),
      fetch('element_params.json').catch(() => null),
      fetch('variables/events/event_variables_index.json').catch(() => null),
      fetch('variables/types/type_variables_index.json').catch(() => null),
      fetch('type_params.json').catch(() => null),
    ]);
    if (idxRes    && idxRes.ok)    PF_REF.index     = await idxRes.json();
    if (paramsRes && paramsRes.ok) PF_REF.params    = await paramsRes.json();
    if (evtIdxRes && evtIdxRes.ok) PF_REF.evtIndex  = await evtIdxRes.json();
    if (typIdxRes && typIdxRes.ok) PF_REF.typIndex  = await typIdxRes.json();
    if (typParamsRes && typParamsRes.ok) PF_REF.typParams = await typParamsRes.json();

    const loaded = !!(PF_REF.index || PF_REF.params);
    if (badge) {
      badge.textContent = loaded ? '⚡ Variable DB loaded' : '⚠ Variable DB offline';
      badge.className   = `ref-badge ${loaded ? 'loaded' : 'offline'}`;
      badge.title = loaded
        ? 'Smart autocomplete active. Full variable/parameter lists load on demand per element and type class.'
        : 'Deploy variables/elements/element_variables_index.json, variables/types/type_variables_index.json, variables/ folder, element_params.json, and type_params.json alongside index.html to enable smart autocomplete.';
    }
  } catch (e) {
    if (badge) { badge.textContent = '⚠ Variable DB offline'; badge.className = 'ref-badge offline'; }
    console.warn('PF reference data not loaded:', e.message);
  }
}

/**
 * Lazy-load variables/ElmXxx.json for a given class.
 * Returns the cached data if already loaded, or triggers a background fetch.
 * The onLoaded callback is called once the data is available.
 */
async function fetchElmClassVars(elmClass, onLoaded) {
  if (!PF_REF.index || !PF_REF.index[elmClass]) return;
  if (PF_REF.varFiles[elmClass]) { if (onLoaded) onLoaded(PF_REF.varFiles[elmClass]); return; }
  if (PF_REF.loading.has(elmClass)) return; // already in-flight

  PF_REF.loading.add(elmClass);
  try {
    const filePath = PF_REF.index[elmClass].file; // e.g. "variables/ElmTerm.json"
    const res = await fetch(filePath);
    if (res.ok) {
      PF_REF.varFiles[elmClass] = await res.json();
      if (onLoaded) onLoaded(PF_REF.varFiles[elmClass]);
    }
  } catch (e) {
    console.warn(`Could not load ${elmClass} variable data:`, e.message);
  } finally {
    PF_REF.loading.delete(elmClass);
  }
}

/**
 * Lazy-load variables/types/TypXxx.json for a given type class (TypLod, TypTr2, ...).
 * Mirrors fetchElmClassVars — type objects expose only static "e:" parameters
 * (no study-group result variables), which can be used as input iteration variables.
 */
async function fetchTypClassVars(typClass, onLoaded) {
  if (!PF_REF.typIndex || !PF_REF.typIndex[typClass]) return;
  if (PF_REF.typFiles[typClass]) { if (onLoaded) onLoaded(PF_REF.typFiles[typClass]); return; }
  if (PF_REF.typLoading.has(typClass)) return; // already in-flight

  PF_REF.typLoading.add(typClass);
  try {
    const filePath = PF_REF.typIndex[typClass].file; // e.g. "variables/types/TypLod.json"
    const res = await fetch(filePath);
    if (res.ok) {
      PF_REF.typFiles[typClass] = await res.json();
      if (onLoaded) onLoaded(PF_REF.typFiles[typClass]);
    }
  } catch (e) {
    console.warn(`Could not load ${typClass} variable data:`, e.message);
  } finally {
    PF_REF.typLoading.delete(typClass);
  }
}

/* ================================================================
   COMBOBOX — portal-based: dropdown appended to <body> with position:fixed
   so it escapes dyn-table-wrapper and output-var-body overflow:hidden
================================================================ */
class PFComboBox {
  constructor(inputEl, getSuggestions, onPick) {
    this.input  = inputEl;
    this.getSuggestions = getSuggestions;
    this.onPick = onPick || null;
    this.drop   = null;
    this.active = -1;
    this.items  = [];
    this._scrollHandler = () => { if (this.drop.style.display !== 'none') this._position(); };
    this._build();
  }

  _build() {
    const wrap = document.createElement('div');
    wrap.className = 'pf-combo-wrap';
    this.input.parentNode.insertBefore(wrap, this.input);
    wrap.appendChild(this.input);

    // Portal: append to body so it's never clipped by any ancestor
    this.drop = document.createElement('div');
    this.drop.className = 'pf-combo-drop';
    document.body.appendChild(this.drop);

    this.input.addEventListener('input',   () => this._refresh());
    this.input.addEventListener('focus',   () => this._refresh());
    this.input.addEventListener('keydown', e  => this._keydown(e));
    this.input.addEventListener('blur',    () => setTimeout(() => this._close(), 160));
    window.addEventListener('scroll', this._scrollHandler, true);
    window.addEventListener('resize', this._scrollHandler);
  }

  _position() {
    const r = this.input.getBoundingClientRect();
    const dropW = Math.max(r.width, 270);
    const left  = Math.min(r.left, window.innerWidth - dropW - 8);
    this.drop.style.left     = `${Math.max(4, left)}px`;
    this.drop.style.minWidth = `${r.width}px`;
    this.drop.style.width    = `${dropW}px`;
    const below = window.innerHeight - r.bottom;
    if (below >= 160 || below >= r.top) {
      this.drop.style.top    = `${r.bottom + 3}px`;
      this.drop.style.bottom = 'auto';
    } else {
      this.drop.style.top    = 'auto';
      this.drop.style.bottom = `${window.innerHeight - r.top + 3}px`;
    }
  }

  _refresh() {
    const suggestions = this.getSuggestions(this.input.value);
    this.items = suggestions.slice(0, 35);
    this.active = -1;
    if (this.items.length === 0) { this._close(); return; }

    this.drop.innerHTML = '';
    this.items.forEach((item, i) => {
      const el = document.createElement('div');
      el.className = 'pf-combo-item';
      const unit = item.unit ? `<span class="item-unit"> · ${item.unit}</span>` : '';
      const desc = item.desc ? `<span class="item-meta">${escHtml(item.desc)}${unit}</span>` : '';
      el.innerHTML = `<span class="item-var">${escHtml(item.var)}</span>${desc}`;
      el.addEventListener('mousedown', e => { e.preventDefault(); this._pick(i); });
      this.drop.appendChild(el);
    });
    this._position();
    this.drop.style.display = 'block';
  }

  _close() {
    this.drop.style.display = 'none';
    this.active = -1;
  }

  _keydown(e) {
    const open = this.drop.style.display !== 'none';
    if (e.key === 'ArrowDown') {
      if (!open) { this._refresh(); return; }
      this.active = Math.min(this.active + 1, this.items.length - 1);
      this._highlight(); e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      this.active = Math.max(this.active - 1, -1);
      this._highlight(); e.preventDefault();
    } else if (e.key === 'Enter' && this.active >= 0 && open) {
      this._pick(this.active); e.preventDefault();
    } else if (e.key === 'Escape') {
      this._close();
    }
  }

  _highlight() {
    Array.from(this.drop.children).forEach((el, i) =>
      el.classList.toggle('active', i === this.active));
    if (this.active >= 0)
      this.drop.children[this.active]?.scrollIntoView({ block: 'nearest' });
  }

  _pick(i) {
    const item = this.items[i];
    if (!item) return;
    this.input.value = item.var;
    this.input.dispatchEvent(new Event('input', { bubbles: true }));
    this._close();
    if (this.onPick) this.onPick(item);
  }

  destroy() {
    window.removeEventListener('scroll', this._scrollHandler, true);
    window.removeEventListener('resize', this._scrollHandler);
    if (this.drop?.parentNode) this.drop.parentNode.removeChild(this.drop);
  }
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ================================================================
   ALGORITHM METADATA & UI
================================================================ */
const SCIPY_DOC_BASE = 'https://docs.scipy.org/doc/scipy/reference/';
const DIFEV_DOC_URL  = 'https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.differential_evolution.html';
const SKOPT_GP_URL   = 'https://scikit-optimize.github.io/stable/modules/generated/skopt.gp_minimize.html';

const ALGORITHM_META = {
  'placeholder':             { label: 'Manual (Placeholder)',                     doc: null,                         method: null,          bounds: false, pyImport: '' },
  'scipy_nelder_mead':       { label: 'Nelder-Mead — Simplex (scipy)',            doc: 'optimize.minimize-neldermead', method: 'Nelder-Mead', bounds: false, pyImport: 'from scipy.optimize import minimize' },
  'scipy_powell':            { label: 'Powell — Directional Set (scipy)',          doc: 'optimize.minimize-powell',     method: 'Powell',      bounds: true,  pyImport: 'from scipy.optimize import minimize' },
  'scipy_lbfgsb':           { label: 'L-BFGS-B — Quasi-Newton (scipy)',           doc: 'optimize.minimize-lbfgsb',     method: 'L-BFGS-B',   bounds: true,  pyImport: 'from scipy.optimize import minimize' },
  'scipy_slsqp':            { label: 'SLSQP — Sequential Least Squares (scipy)',  doc: 'optimize.minimize-slsqp',      method: 'SLSQP',       bounds: true,  pyImport: 'from scipy.optimize import minimize' },
  'scipy_cobyla':           { label: 'COBYLA — Constraint Approximation (scipy)', doc: 'optimize.minimize-cobyla',     method: 'COBYLA',      bounds: false, pyImport: 'from scipy.optimize import minimize' },
  'differential_evolution': { label: 'Differential Evolution — Global (scipy)',   doc: null,                         method: null,          bounds: true,  pyImport: 'from scipy.optimize import differential_evolution' },
  'gp_minimize':            { label: 'Bayesian Optimisation (scikit-optimize)',   doc: null,                         method: null,          bounds: true,  pyImport: 'from skopt import gp_minimize\nfrom skopt.space import Real, Integer\nfrom skopt.utils import use_named_args' },
};

const ALGORITHM_TIPS = {
  'placeholder':             'Wire up evaluate_one_case() yourself — the generated code creates the evaluation function but leaves the search loop for you to fill in.',
  'scipy_nelder_mead':       'Nelder-Mead simplex — gradient-free local search. No derivatives needed. Does not natively support bounds; works best for unconstrained problems.',
  'scipy_powell':            "Powell's directional-set method — gradient-free local search with bounds support. Efficient for smooth low-dimensional problems.",
  'scipy_lbfgsb':           'L-BFGS-B — quasi-Newton method with bounds. Numerically approximates the gradient. Fast convergence near the optimum for smooth objectives.',
  'scipy_slsqp':            'SLSQP — Sequential Least Squares Programming. Supports bounds and constraints. Numerically approximates the gradient.',
  'scipy_cobyla':           'COBYLA — gradient-free constrained optimisation via linear approximations. Define bounds as inequality constraints rather than using the bounds field.',
  'differential_evolution': 'Differential Evolution — global stochastic search across the full bounds. Robust to local minima but requires more function evaluations. Seed fixed for reproducibility.',
  'gp_minimize':            'Bayesian Optimisation — builds a surrogate model of the objective to minimise expensive evaluations. Best when each simulation run is costly. Requires: pip install scikit-optimize.',
};

function updateAlgorithmUI() {
  const alg  = document.getElementById('optim-algorithm')?.value;
  if (!alg) return;
  const meta = ALGORITHM_META[alg] || {};
  const link = document.getElementById('optim-algorithm-doc');

  // Update doc link visibility and href
  let url = null;
  if (meta.doc)                              url = SCIPY_DOC_BASE + meta.doc + '.html';
  else if (alg === 'differential_evolution') url = DIFEV_DOC_URL;
  else if (alg === 'gp_minimize')            url = SKOPT_GP_URL;
  if (link) {
    link.style.display = url ? 'inline' : 'none';
    if (url) link.href = url;
  }

  // Update tooltip for the algorithm ? badge
  const tipEl = document.querySelector('#sec-optim [data-alg-tip]');
  if (tipEl) tipEl.setAttribute('data-tip', ALGORITHM_TIPS[alg] || '');
  // Update Max Iterations tooltip
  setTip('tt-max-iter', TIP_MAX_ITER[alg] || '');
}

/* ================================================================
   SUGGESTION LOGIC
================================================================ */
const ALL_ELM_CLASSES = [
  'ElmArea','ElmAsm','ElmAsmsc','ElmBbone','ElmBmu','ElmBoundary','ElmBranch',
  'ElmCabsys','ElmComp','ElmCoup','ElmDcu','ElmDsl','ElmFeeder','ElmFile','ElmFilter',
  'ElmGenstat','ElmGndswt','ElmHvdcbi','ElmHvdcvsc','ElmIac','ElmLne','ElmLnesec',
  'ElmLod','ElmLodlv','ElmLodmv','ElmMdl','ElmNec','ElmNet','ElmPvsys','ElmRecmono',
  'ElmRelay','ElmRes','ElmSecctrl','ElmShnt','ElmSind','ElmStactrl','ElmSubstat',
  'ElmSvs','ElmSym','ElmTerm','ElmTow','ElmTr2','ElmTr3','ElmTr4','ElmTrain',
  'ElmTrb','ElmTrfstat','ElmTrmult','ElmVac','ElmVoltreg','ElmVsc','ElmVscmono',
  'ElmWind','ElmXnet','ElmZone','ElmZpu','StaPll'
];

// Type classes (TypXxx) — resolved directly by name from the equipment library
const ALL_TYP_CLASSES = [
  'TypAsm','TypGeo','TypLne','TypLod','TypLodlv','TypSwitch',
  'TypSym','TypTow','TypTr2','TypTr3','TypTr4'
];

// Event classes — resolved from Simulation Events/Fault.IntEvt, not GetCalcRelevantObjects
const ALL_EVT_CLASSES = ['EvtShc','EvtSwitch','EvtLod','EvtSym','EvtParam','EvtGen','EvtTap','EvtOutage'];

const EVT_PARAMS = {
  'EvtShc': [
    { var: 'p_target', unit: 'Elm*', desc: 'Target element (bus, line, or transformer where the fault is applied)' },
    { var: 'time',     unit: 's',    desc: 'Event time in seconds' },
    { var: 'i_shc',    unit: '',     desc: 'Fault type: 0=3-phase, 1=single-phase A-E, 2=two-phase A-B, 3=two-phase A-B-E, 4=clear fault' },
    { var: 'R_f',      unit: 'Ohm',  desc: 'Fault resistance (0 = bolted fault)' },
    { var: 'X_f',      unit: 'Ohm',  desc: 'Fault reactance (usually 0 for a bolted fault)' },
    { var: 'i_p2pflt', unit: '',     desc: 'Phase-to-phase fault flag (0=no, 1=yes)' },
    { var: 'outserv',  unit: '',     desc: 'Out of service (0=active, 1=inactive)' },
    { var: 'mtime',    unit: 'min',  desc: 'Event time (absolute, minutes)' },
    { var: 'hrtime',   unit: 'h',    desc: 'Event time (absolute, hours)' },
  ],
  'EvtSwitch': [
    { var: 'p_target', unit: 'Elm*', desc: 'Target element (line, coupler, or transformer to switch)' },
    { var: 'time',     unit: 's',    desc: 'Event time in seconds' },
    { var: 'i_switch', unit: '',     desc: 'Switching action: 0=open (trip), 1=close (reclose)' },
    { var: 'i_allph',  unit: '',     desc: 'Apply to all phases (0=no, 1=yes)' },
    { var: 'i_a',      unit: '',     desc: 'Phase A switching flag' },
    { var: 'i_b',      unit: '',     desc: 'Phase B switching flag' },
    { var: 'i_c',      unit: '',     desc: 'Phase C switching flag' },
    { var: 'outserv',  unit: '',     desc: 'Out of service (0=active, 1=inactive)' },
    { var: 'mtime',    unit: 'min',  desc: 'Event time (absolute, minutes)' },
    { var: 'hrtime',   unit: 'h',    desc: 'Event time (absolute, hours)' },
  ],
  'EvtGen': [
    { var: 'time',        unit: 's',    desc: 'Event time in seconds' },
    { var: 'dP',          unit: 'MW',   desc: 'Active power change' },
    { var: 'dQ',          unit: 'Mvar', desc: 'Reactive power change' },
    { var: 'powerChange', unit: '',     desc: 'Change type flag' },
    { var: 'outserv',     unit: '',     desc: 'Out of service (0=active, 1=inactive)' },
    { var: 'mtime',       unit: 'min',  desc: 'Event time (absolute, minutes)' },
    { var: 'hrtime',      unit: 'h',    desc: 'Event time (absolute, hours)' },
  ],
  'EvtLod': [
    { var: 'time',      unit: 's',  desc: 'Event time in seconds' },
    { var: 'opt_evt',   unit: '',   desc: 'Type of event' },
    { var: 'iopt_src',  unit: '',   desc: 'Source option' },
    { var: 'iopt_type', unit: '',   desc: 'Event of load type' },
    { var: 'iopt_load', unit: '',   desc: 'Event for load option' },
    { var: 'iStage',    unit: '',   desc: 'Stage number' },
    { var: 'outserv',   unit: '',   desc: 'Out of service (0=active, 1=inactive)' },
    { var: 'mtime',     unit: 'min',desc: 'Event time (absolute, minutes)' },
    { var: 'hrtime',    unit: 'h',  desc: 'Event time (absolute, hours)' },
  ],
  'EvtSym': [
    { var: 'time',     unit: 's',     desc: 'Event time in seconds' },
    { var: 'outNgnum', unit: '',      desc: 'Machine on outage (unit number)' },
    { var: 'addmt',    unit: 'p.u.', desc: 'Additional torque' },
    { var: 'newS',     unit: '%sgn', desc: 'New maximal apparent power' },
    { var: 'outserv',  unit: '',      desc: 'Out of service (0=active, 1=inactive)' },
    { var: 'mtime',    unit: 'min',   desc: 'Event time (absolute, minutes)' },
    { var: 'hrtime',   unit: 'h',     desc: 'Event time (absolute, hours)' },
  ],
  'EvtParam': [
    { var: 'variable',       unit: '',  desc: 'Name of the variable to change (string)' },
    { var: 'value',          unit: '',  desc: 'New value for the variable' },
    { var: 'time',           unit: 's', desc: 'Event time in seconds' },
    { var: 'i_sysmat',       unit: '',  desc: 'Recompute system matrix (0=no, 1=yes)' },
    { var: 'eventHandling',  unit: '',  desc: 'Event handling mode' },
    { var: 'outserv',        unit: '',  desc: 'Out of service (0=active, 1=inactive)' },
    { var: 'mtime',          unit: 'min',desc: 'Event time (absolute, minutes)' },
    { var: 'hrtime',         unit: 'h', desc: 'Event time (absolute, hours)' },
  ],
  'EvtTap': [
    { var: 'time',   unit: 's',   desc: 'Event time in seconds' },
    { var: 'i_tap',  unit: '',    desc: 'Tap action type' },
    { var: 'ntap',   unit: '',    desc: 'Tap position' },
    { var: 'bus',    unit: '',    desc: 'Tap at busbar (0=HV, 1=LV)' },
    { var: 'outserv',unit: '',    desc: 'Out of service (0=active, 1=inactive)' },
    { var: 'mtime',  unit: 'min', desc: 'Event time (absolute, minutes)' },
    { var: 'hrtime', unit: 'h',   desc: 'Event time (absolute, hours)' },
  ],
  'EvtOutage': [
    { var: 'time',     unit: 's',    desc: 'Event time in seconds' },
    { var: 'i_what',   unit: '',     desc: 'Type of outage event' },
    { var: 'p_target', unit: 'Elm*', desc: 'Target element for outage' },
    { var: 'p_from',   unit: 'Elm*', desc: 'Event defined by element' },
    { var: 'outserv',  unit: '',     desc: 'Out of service (0=active, 1=inactive)' },
    { var: 'mtime',    unit: 'min',  desc: 'Event time (absolute, minutes)' },
    { var: 'hrtime',   unit: 'h',    desc: 'Event time (absolute, hours)' },
  ],
};

// Suggest Object query strings like "Grid.ElmTerm", "*.ElmDsl", "Fault_ON.EvtShc" etc.
// includeEvents=true for Input Variables, false for Output Variables
function getObjectSuggestions(typed, includeEvents = true) {
  const q = (typed || '').trim();
  const dotIdx = q.lastIndexOf('.');
  const namePart  = dotIdx >= 0 ? q.slice(0, dotIdx) : (q || '');
  const classPart = dotIdx >= 0 ? q.slice(dotIdx + 1).toLowerCase() : '';

  const results = [];

  // Suggest Name.ElmXxx for matching element classes
  ALL_ELM_CLASSES.forEach(cls => {
    if (!classPart || cls.toLowerCase().startsWith(classPart)) {
      const full = namePart ? `${namePart}.${cls}` : cls;
      const desc = PF_REF.index?.[cls]?.desc || cls;
      results.push({ var: full, desc, unit: '' });
    }
  });

  // Suggest Name.TypXxx for type classes — type objects live in the project's
  // equipment library and are resolved directly by name via GetProjectFolder("equip"),
  // so their static parameters (e.g. TypLod, TypTr2) can drive input/output iterations.
  ALL_TYP_CLASSES.forEach(cls => {
    if (!classPart || cls.toLowerCase().startsWith(classPart)) {
      const full = namePart ? `${namePart}.${cls}` : cls;
      const desc = PF_REF.typIndex?.[cls]?.desc || cls;
      results.push({ var: full, desc: `${desc} (equipment type library)`, unit: '' });
    }
  });

  // Suggest Name.EvtXxx for event classes (input variables only)
  if (includeEvents) {
    ALL_EVT_CLASSES.forEach(cls => {
      if (!classPart || cls.toLowerCase().startsWith(classPart)) {
        const full = namePart ? `${namePart}.${cls}` : cls;
        results.push({ var: full, desc: `Simulation event — ${cls}`, unit: 'event' });
      }
    });
  }

  // Also suggest wildcard variants when user typed something after a dot
  if (classPart) {
    ALL_ELM_CLASSES.forEach(cls => {
      if (cls.toLowerCase().startsWith(classPart)) {
        const wc = `*.${cls}`;
        if (!results.find(r => r.var === wc)) {
          const desc = PF_REF.index?.[cls]?.desc || cls;
          results.push({ var: wc, desc: `All ${desc} objects (wildcard)`, unit: '' });
        }
      }
    });
  }

  return results.slice(0, 40);
}

// Extract PF class from an object query: "Grid.ElmTerm" → "ElmTerm", "Fault.EvtShc" → "EvtShc"
function extractPfClass(objectQuery) {
  if (!objectQuery) return null;
  const m = objectQuery.match(/\.(Elm[A-Za-z0-9]+|Sta[A-Za-z0-9]+|Evt[A-Za-z0-9]+|Typ[A-Za-z0-9]+)\s*$/);
  return m ? m[1] : null;
}
// INPUT variable attribute suggestions — class-scoped params from element_params.json
// or EVT_PARAMS for event classes (EvtShc, EvtSwitch, etc.)
// Attributes that are strings, object references, or metadata — not numerically iterable
const INPUT_ATTR_BLACKLIST = new Set([
  // Identification / naming (strings)
  'loc_name', 'chr_name', 'for_name', 'dat_src', 'appr_modby', 'desc', 'desc_c',
  'cimRdfId', 'sernum', 'commissionDate', 'sShort', 'attrname',
  // File / path (strings)
  'f_name', 'f_name_abs', 'cFilename', 'cDisplayName',
  // Node / station names (strings)
  'NodeName', 'UcteNodeName', 'cStatName', 'cTimezone',
  // Tags / signals (strings)
  'ctag', 'ctagtot', 'tag', 'signal', 'carrayName', 'carrayDesc', 'cattrDesc',
  'parameterNames',
  // Type (TypXxx) descriptive / non-numeric attributes (strings or mode selectors)
  'manuf', 'model_inp', 'iner_inp', 'vecgrp',
  // Approval / workflow metadata (not design parameters)
  'appr_modif', 'appr_status', 'appr_celeby', 'appr_devby',
  // Object / folder references
  'fold_id', 'cContingency',
]);

function isInputAttrBlacklisted(varStr) {
  const attr = (varStr || '').split(':').pop();
  if (INPUT_ATTR_BLACKLIST.has(attr)) return true;
  // Object reference terminals (_bar suffix) are not numeric scalars
  if (attr.endsWith('_bar')) return true;
  return false;
}

function getInputAttrSuggestions(typed, elmClass) {
  const q = (typed || '').toLowerCase();
  const results = [];
  const seen = new Set();
  const addItem = item => {
    const key = String(item.var || '').toLowerCase();
    if (!key || seen.has(key)) return;
    if (isInputAttrBlacklisted(item.var)) return;
    seen.add(key);
    results.push({ var: item.var || '', desc: item.desc || '', unit: item.unit || '' });
  };

  // —— Event class: return EVT_PARAMS entries (direct attributes, no e: prefix) ——
  if (elmClass && elmClass.startsWith('Evt')) {
    const evtParams = EVT_PARAMS[elmClass] || [];
    evtParams.forEach(item => {
      const raw = String(item.var || '').toLowerCase();
      const desc = (item.desc || '').toLowerCase();
      if (!q || raw.includes(q) || desc.includes(q)) addItem(item);
    });
    return results;
  }

  // —— Type class: static "e:" parameters from type_params.json (e.g. TypLod, TypTr2) ——
  if (elmClass && elmClass.startsWith('Typ')) {
    if (PF_REF.typParams && PF_REF.typParams[elmClass]) {
      PF_REF.typParams[elmClass].forEach(item => {
        const raw = String(item.var || '').toLowerCase();
        const desc = (item.desc || '').toLowerCase();
        if (!q || raw.includes(q) || desc.includes(q)) addItem(item);
      });
    }
    if (!PF_REF.typFiles[elmClass]) fetchTypClassVars(elmClass, null);
    return results.slice(0, 50);
  }

  // Source: element_params.json class-specific input params (typically e:*)
  if (PF_REF.params && elmClass && PF_REF.params[elmClass]) {
    PF_REF.params[elmClass].forEach(item => {
      const raw = String(item.var || '').toLowerCase();
      const desc = (item.desc || '').toLowerCase();
      if (!q || raw.includes(q) || desc.includes(q)) addItem(item);
    });
  }

  if (elmClass && !PF_REF.varFiles[elmClass]) fetchElmClassVars(elmClass, null);

  return results.slice(0, 50);
}

// OUTPUT variable attribute suggestions — result variables (m:, c:, s:, n:)
// from lazy-loaded variables/ElmXxx.json, filtered by current study type.
// Falls back to var names in the index while the full file is loading.
function getOutputAttrSuggestions(typed, elmClass, comboInstance) {
  const q = (typed || '').toLowerCase();
  const stVal  = document.getElementById('study-type')?.value || 'steady_state';
  const jsonKey = STUDY_TYPE_KEY[stVal] || 'load_flow';
  const results = [];
  const seen = new Set();
  const addItem = item => {
    if (!seen.has(item.var)) {
      seen.add(item.var);
      results.push({ var: item.var, desc: item.desc || '', unit: item.unit || '' });
    }
  };

  if (elmClass && elmClass.startsWith('Typ')) {
    // Type objects expose only static "e:" parameters — no study-group result vars
    if (PF_REF.typParams && PF_REF.typParams[elmClass]) {
      PF_REF.typParams[elmClass].forEach(item => {
        if (isInputAttrBlacklisted(item.var)) return;
        if (!q || item.var.toLowerCase().includes(q) || (item.desc || '').toLowerCase().includes(q))
          addItem(item);
      });
    }
    if (!PF_REF.typFiles[elmClass]) fetchTypClassVars(elmClass, () => { if (comboInstance) comboInstance._refresh(); });
    return results.slice(0, 60);
  }

  if (elmClass && elmClass.startsWith('Evt')) {
    // Event objects expose only their direct attributes — no study-group result vars
    const evtParams = EVT_PARAMS[elmClass] || [];
    evtParams.forEach(item => {
      if (isInputAttrBlacklisted(item.var)) return;
      if (!q || item.var.toLowerCase().includes(q) || (item.desc || '').toLowerCase().includes(q))
        addItem(item);
    });
    return results.slice(0, 60);
  }

  if (elmClass) {
    if (PF_REF.varFiles[elmClass]) {
      // Full rich data available
      const studyVars = PF_REF.varFiles[elmClass].result_vars?.[jsonKey]
                     || PF_REF.varFiles[elmClass].result_vars?.['load_flow']
                     || {};
      Object.values(studyVars).flat().forEach(item => {
        if (!q || item.var.toLowerCase().includes(q) || (item.desc || '').toLowerCase().includes(q))
          addItem(item);
      });
    } else {
      // Fallback: show var names from index while full file loads in background
      const indexVars = PF_REF.index?.[elmClass]?.study_groups?.[jsonKey]
                     || PF_REF.index?.[elmClass]?.study_groups?.['load_flow']
                     || [];
      indexVars.forEach(varName => {
        if (!q || varName.toLowerCase().includes(q))
          addItem({ var: varName, desc: '(loading full list…)', unit: '' });
      });
      // Trigger load; re-open dropdown when data arrives so user sees descriptions
      fetchElmClassVars(elmClass, () => { if (comboInstance) comboInstance._refresh(); });
    }
  }

  // Fallback hardcoded common outputs when no class detected or DB not available
  if (results.length === 0) {
    const common = [
      { var: 'm:u1',       desc: 'Voltage magnitude (pu)',              unit: 'pu'  },
      { var: 'm:phiu',     desc: 'Voltage angle',                       unit: 'deg' },
      { var: 'm:Psum',     desc: 'Total active power injection',         unit: 'MW'  },
      { var: 'm:Qsum',     desc: 'Total reactive power injection',       unit: 'Mvar'},
      { var: 'm:P',        desc: 'Active power',                         unit: 'MW'  },
      { var: 'm:Q',        desc: 'Reactive power',                       unit: 'Mvar'},
      { var: 'm:I1',       desc: 'Positive-sequence current magnitude',  unit: 'kA'  },
      { var: 'c:loading',  desc: 'Element loading',                      unit: '%'   },
      { var: 'm:Ikss',     desc: 'Short-circuit current (sym)',          unit: 'kA'  },
      { var: 's:speed',    desc: 'Rotor speed (dynamic)',                unit: 'pu'  },
      { var: 'm:cosphi',   desc: 'Power factor',                         unit: ''    },
    ];
    common.forEach(c => {
      if (!q || c.var.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q))
        addItem(c);
    });
  }
  return results.slice(0, 60);
}

/* ================================================================
   ATTACH COMBOBOXES — called after each row/card is inserted into DOM
================================================================ */
function attachInputComboBoxes(idx) {
  const objInput  = document.getElementById(`iv-obj-${idx}`);
  const attrInput = document.getElementById(`iv-var-${idx}`);
  if (!objInput || !attrInput) return;

  // Input variables include events — pass includeEvents=true
  new PFComboBox(objInput, typed => getObjectSuggestions(typed, true));

  new PFComboBox(attrInput, typed => {
    const pfClass = extractPfClass(objInput.value);
    return getInputAttrSuggestions(typed, pfClass);
  });
}

function attachOutputComboBoxes(id) {
  const objInput    = document.getElementById(`${id}-obj`);
  const objPfxInput = document.getElementById(`${id}-obj-prefix`);
  const attrInput   = document.getElementById(`${id}-var`);

  const getElmClass = () => extractPfClass(
    (objInput?.value || objPfxInput?.value || '').trim()
  );

  if (objInput)    new PFComboBox(objInput,    typed => getObjectSuggestions(typed, false));
  if (objPfxInput) new PFComboBox(objPfxInput, typed => getObjectSuggestions(typed, false));
  if (attrInput) {
    const combo = new PFComboBox(attrInput, typed => getOutputAttrSuggestions(typed, getElmClass(), combo));
  }
}

/* ================================================================
   INPUT VARIABLE TABLE
================================================================ */
let inputRowCounter = 0;

function addInputRow(data = {}) {
  const idx = inputRowCounter++;
  const tbody = document.getElementById('input-tbody');
  const tr = document.createElement('tr');
  tr.id = `input-row-${idx}`;
  const rowNum = tbody.querySelectorAll('tr').length + 1;
  tr.innerHTML = `
    <td style="color:var(--muted);font-family:var(--mono);font-size:11px;vertical-align:middle">${rowNum}</td>
    <td><input type="text" id="iv-name-${idx}" value="${data.name||''}" placeholder="Var name" autocomplete="off" /></td>
    <td><input type="text" id="iv-obj-${idx}" value="${data.object_query||''}" placeholder="Element.ElmType" autocomplete="off" /></td>
    <td><input type="text" id="iv-var-${idx}" value="${data.variable||''}" placeholder="Attribute name" autocomplete="off" /></td>
    <td class="col-lb"><input type="number" id="iv-lb-${idx}" value="${data.lower!==undefined?data.lower:''}" placeholder="0" step="any" autocomplete="off" /></td>
    <td class="col-ub"><input type="number" id="iv-ub-${idx}" value="${data.upper!==undefined?data.upper:''}" placeholder="10" step="any" autocomplete="off" /></td>
    <td class="col-step"><input type="number" id="iv-step-${idx}" value="${data.step!==undefined?data.step:''}" placeholder="0.5" step="any" autocomplete="off" /></td>
    <td class="td-action">
      <button class="btn btn-remove btn-icon" title="Remove" onclick="removeRow('input-row-${idx}')">✕</button>
    </td>
  `;
  tbody.appendChild(tr);
  attachInputComboBoxes(idx);
}

function removeRow(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function inferDtype(lower, upper, step) {
  const isInt = v => v === '' || Number.isInteger(parseFloat(v));
  return (isInt(lower) && isInt(upper) && isInt(step)) ? 'int' : 'float';
}

function getInputRows() {
  const problemType = document.getElementById('problem-type')?.value;
  const tbody = document.getElementById('input-tbody');
  return Array.from(tbody.querySelectorAll('tr')).map((tr, i) => {
    const idx = tr.id.replace('input-row-', '');
    const lower = document.getElementById(`iv-lb-${idx}`)?.value?.trim() || '0';
    const upper = document.getElementById(`iv-ub-${idx}`)?.value?.trim() || '1';
    const step  = document.getElementById(`iv-step-${idx}`)?.value?.trim() || '1';
    const rawName = document.getElementById(`iv-name-${idx}`)?.value?.trim() || '';
    const name = rawName || `input_${i}`;
    const objectQuery = document.getElementById(`iv-obj-${idx}`)?.value?.trim() || '';
    return {
      name,
      object_query: objectQuery,
      variable:     document.getElementById(`iv-var-${idx}`)?.value?.trim() || '',
      lower, upper, step,
      dtype: inferDtype(lower, upper, step),
    };
  });
}

/* ================================================================
   OUTPUT VARIABLE ITEMS
================================================================ */
const METRICS = [
  'maximum','minimum','mean','median',
  'first_time_above','first_time_below','time_settle'
];
const THRESHOLD_METRICS = ['first_time_above','first_time_below'];
const SETTLE_METRICS = ['time_settle'];
const KNOWN_ELM_OBJECT_TYPES = new Set([
  'ElmArea','ElmAsm','ElmAsmsc','ElmBbone','ElmBmu','ElmBoundary','ElmBranch',
  'ElmCabsys','ElmComp','ElmCoup','ElmDcu','ElmDsl','ElmFeeder','ElmFile','ElmFilter',
  'ElmGenstat','ElmGndswt','ElmHvdcbi','ElmHvdcvsc','ElmIac','ElmLne','ElmLnesec',
  'ElmLod','ElmLodlv','ElmLodmv','ElmMdl','ElmNec','ElmNet','ElmPvsys','ElmRecmono',
  'ElmRelay','ElmRes','ElmSecctrl','ElmShnt','ElmSind','ElmStactrl','ElmSubstat',
  'ElmSvs','ElmSym','ElmTerm','ElmTow','ElmTr2','ElmTr3','ElmTr4','ElmTrain',
  'ElmTrb','ElmTrfstat','ElmTrmult','ElmVac','ElmVoltreg','ElmVsc','ElmVscmono',
  'ElmWind','ElmXnet','ElmZone','ElmZpu'
]);

// Falls back to KNOWN_ELM_OBJECT_TYPES when the live reference index isn't loaded yet,
// so newly added element classes (e.g. via element_variables_index.json) are recognised
// without needing this set to be kept in lockstep.
function isKnownElmObjectType(objectType) {
  if (PF_REF.index && Object.prototype.hasOwnProperty.call(PF_REF.index, objectType)) return true;
  return KNOWN_ELM_OBJECT_TYPES.has(objectType);
}

const KNOWN_TYP_OBJECT_TYPES = new Set(ALL_TYP_CLASSES);

function isKnownTypObjectType(objectType) {
  if (PF_REF.typIndex && Object.prototype.hasOwnProperty.call(PF_REF.typIndex, objectType)) return true;
  return KNOWN_TYP_OBJECT_TYPES.has(objectType);
}

function metricLabel(m) {
  return m.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase());
}

function addOutputVar(data = {}) {
  const id = `ov-${outputVarCounter++}`;
  const container = document.getElementById('output-vars-container');
  const div = document.createElement('div');
  div.className = 'output-var-item';
  div.id = id;
  const type = data.type || 'attribute';
  div.innerHTML = buildOutputVarHTML(id, data, type);
  container.appendChild(div);
  reindexOutputVars();
  // init ace if custom
  if (type === 'custom_calculation') {
    initAceEditor(id, data.customFn || '');
  }
  // Attach comboboxes for object + attribute fields
  attachOutputComboBoxes(id);
  // refresh objective dropdown
  if (document.getElementById('problem-type').value === 'optimisation') {
    refreshObjectiveDropdown();
  }
  updateTimeseriesAvailability();
  refreshLiveWarnings();
}

function reindexOutputVars() {
  const items = document.querySelectorAll('#output-vars-container .output-var-item');
  items.forEach((item, i) => {
    const el = item.querySelector('.ov-index');
    if (el) el.textContent = `#${i + 1}`;
  });
}

function buildOutputVarHTML(id, data = {}, type = 'attribute') {
  const metricOptions = METRICS.map(m =>
    `<option value="${m}" ${(data.metric||'')==m?'selected':''}>${metricLabel(m)}</option>`
  ).join('');
  const isAttr = type === 'attribute';
  const isTs   = type === 'timeseries';
  const isCust = type === 'custom_calculation';
  const tsObjVal = (data.object_query || '');
  const metric = data.metric || 'maximum';
  const showThresh = THRESHOLD_METRICS.includes(metric) && !isAttr && !isCust;
  const showSettle = metric === 'time_settle' && !isAttr && !isCust;

  return `
    <div class="output-var-header">
      <span class="ov-index">#?</span>
      <select style="width:160px;font-size:12px;padding:3px 6px;" id="${id}-type" onchange="onOutputTypeChange('${id}')">
        <option value="attribute" ${type==='attribute'?'selected':''}>Scalar</option>
        <option value="timeseries" ${type==='timeseries'?'selected':''}>Timeseries</option>
        <option value="custom_calculation" ${type==='custom_calculation'?'selected':''}>Custom Calculation</option>
      </select>
      ${tip(TIP_OUTPUT_TYPE[type] || TIP_OUTPUT_TYPE.attribute, `${id}-tt-type`)}
      <input type="text" id="${id}-name" value="${data.name||''}" placeholder="Output var name"
        style="flex:1;font-size:12px;padding:3px 8px;min-width:80px;" oninput="onOutputNameChange()" autocomplete="off" />
      ${tip('Python identifier for this output. Must be unique across all inputs and outputs.')}
      <button class="btn btn-ghost btn-icon btn-xs" title="Collapse" onclick="toggleOutputVar('${id}')" id="${id}-toggle" style="font-size:14px;flex-shrink:0;">▾</button>
      <button class="btn btn-remove btn-xs" onclick="removeOutputVar('${id}')">✕</button>
    </div>
    <div class="output-var-body" id="${id}-body">
      <!-- OBJECT (hidden for custom_calculation) -->
      <div class="form-row ${isCust?'cond-hidden':''}" id="${id}-row-obj">
        <label>Object ${tip(isTs ? TIP_OUTPUT_OBJ.timeseries : TIP_OUTPUT_OBJ.attribute, `${id}-tt-obj`)}</label>
        <div id="${id}-obj-attribute-wrap" class="${isTs?'cond-hidden':''}">
          <input type="text" id="${id}-obj" value="${isTs ? '' : (data.object_query||'')}" placeholder="Element.ElmType" autocomplete="off" oninput="onOutputObjectInput('${id}')" />
        </div>
        <div id="${id}-obj-timeseries-wrap" class="${isTs?'':'cond-hidden'}" style="display:flex;align-items:center;">
          <input type="text" id="${id}-obj-prefix" value="${tsObjVal}" placeholder="Grid.ElmTerm" autocomplete="off" oninput="onOutputObjectInput('${id}')" />
        </div>
      </div>
      <!-- ATTRIBUTE (hidden for custom_calculation) -->
      <div class="form-row ${isCust?'cond-hidden':''}" id="${id}-row-var">
        <label>Attribute ${tip(isTs ? TIP_OUTPUT_ATTR.timeseries : TIP_OUTPUT_ATTR.attribute, `${id}-tt-attr`)}</label>
        <input type="text" id="${id}-var" value="${data.variable||''}" placeholder="Attribute name" autocomplete="off" />
      </div>
      <!-- METRIC (hidden for single_attribute and custom_calculation) -->
      <div class="form-row ${(isAttr||isCust)?'cond-hidden':''}" id="${id}-row-metric">
        <label>Metric ${tip(TIP_METRIC[metric] || TIP_METRIC.maximum, `${id}-tt-metric`)}</label>
        <select id="${id}-metric" onchange="onMetricChange('${id}')">
          ${metricOptions}
        </select>
      </div>
      <!-- THRESHOLD -->
      <div class="form-row ${!showThresh?'cond-hidden':''}" id="${id}-row-threshold">
        <label>Threshold ${tip('Value the signal must cross (first_time_above) or drop below (first_time_below).')}</label>
        <input type="number" id="${id}-threshold" value="${data.threshold||''}" step="any" placeholder="0.9" autocomplete="off" />
      </div>
      <!-- SETTLE PARAMS -->
      <div class="${!showSettle?'cond-hidden':''}" id="${id}-row-settle">
        <div class="form-row">
          <label>Settle Band ${tip('Half-width of the ±band: signal must stay in [ref−band, ref+band] for the full hold time.')}</label>
          <input type="number" id="${id}-settle-band" value="${data.settle_band||''}" step="any" placeholder="0.05" autocomplete="off" />
        </div>
        <div class="form-row">
          <label>Hold Time (s) ${tip('Minimum duration (s) the signal must remain inside the settle band.')}</label>
          <input type="number" id="${id}-settle-hold" value="${data.settle_hold_time||''}" step="any" placeholder="0.5" autocomplete="off" />
        </div>
        <div class="form-row">
          <label>Reference Value ${tip('Target steady-state value. Settle band = [ref−band, ref+band].')}</label>
          <input type="number" id="${id}-settle-ref" value="${data.settle_reference_value||''}" step="any" placeholder="1.0" autocomplete="off" />
        </div>
      </div>
      <!-- OUTPUT GRAPH (timeseries only) -->
      <div class="${!isTs?'cond-hidden':''}" id="${id}-row-output-graph">
        <div class="checkbox-row" style="margin-top:4px;">
          <input type="checkbox" id="${id}-output-graph" ${data.output_graph?'checked':''} />
          <label for="${id}-output-graph">Output graph (Time vs variable, saved as .png in <code>{output_dir}/graph</code>) ${tip('Save a matplotlib time-vs-variable plot per scenario. Requires pip install matplotlib.')}</label>
        </div>
      </div>
      <!-- OUTPUT RAW CSV (timeseries only) -->
      <div class="${!isTs?'cond-hidden':''}" id="${id}-row-output-raw">
        <div class="checkbox-row" style="margin-bottom:4px;">
          <input type="checkbox" id="${id}-output-raw" ${data.output_raw_csv?'checked':''} />
          <label for="${id}-output-raw">Output raw data (time vs variable, saved as .csv in <code>{output_dir}/raw</code>) ${tip('Save the full time-series as .csv per scenario in {output_dir}/raw/ for post-processing.')}</label>
        </div>
      </div>
      <!-- CUSTOM FUNCTION -->
      <div class="${!isCust?'cond-hidden':''}" id="${id}-row-custom-fn">
        <div class="sub-label" style="margin-top:8px;">Custom Function (must return exactly one scalar) ${tip('Python function whose arguments are names of other defined input or output variables.')}</div>
        <div class="hint" style="margin-bottom:6px;">Arguments must be names of defined <strong>Input Variables</strong> or other <strong>Output Variables</strong>.</div>
        <div class="ace-editor-container">
          <div class="ace-editor" id="${id}-ace"></div>
        </div>
      </div>
    </div>
  `;
}

function onOutputTypeChange(id) {
  const type = document.getElementById(`${id}-type`).value;
  const isAttr = type === 'attribute';
  const isTs   = type === 'timeseries';
  const isCust = type === 'custom_calculation';

  // Show/hide object/variable (hidden for custom_calculation)
  document.getElementById(`${id}-row-obj`)?.classList.toggle('cond-hidden', isCust);
  document.getElementById(`${id}-row-var`)?.classList.toggle('cond-hidden', isCust);
  // Show/hide metric (hidden for attribute and custom_calculation)
  document.getElementById(`${id}-row-metric`)?.classList.toggle('cond-hidden', isAttr || isCust);
  // Show/hide output graph and raw CSV (timeseries only)
  document.getElementById(`${id}-row-output-graph`)?.classList.toggle('cond-hidden', !isTs);
  document.getElementById(`${id}-row-output-raw`)?.classList.toggle('cond-hidden', !isTs);
  // Show/hide custom fn
  document.getElementById(`${id}-row-custom-fn`)?.classList.toggle('cond-hidden', !isCust);
  document.getElementById(`${id}-obj-attribute-wrap`)?.classList.toggle('cond-hidden', isTs);
  document.getElementById(`${id}-obj-timeseries-wrap`)?.classList.toggle('cond-hidden', !isTs);
  // Reinit ace if custom and not yet created
  if (isCust && !aceEditors[id]) {
    initAceEditor(id, '');
  }

  // Metric-based conditionals (only relevant for timeseries)
  const metric = document.getElementById(`${id}-metric`)?.value || '';
  const showThresh = !isAttr && !isCust && THRESHOLD_METRICS.includes(metric);
  const showSettle = !isAttr && !isCust && metric === 'time_settle';
  document.getElementById(`${id}-row-threshold`)?.classList.toggle('cond-hidden', !showThresh);
  document.getElementById(`${id}-row-settle`)?.classList.toggle('cond-hidden', !showSettle);

  // Update dynamic tooltips for this output var
  setTip(`${id}-tt-type`, TIP_OUTPUT_TYPE[type] || '');
  setTip(`${id}-tt-obj`, TIP_OUTPUT_OBJ[type] || TIP_OUTPUT_OBJ.attribute);
  setTip(`${id}-tt-attr`, TIP_OUTPUT_ATTR[type] || TIP_OUTPUT_ATTR.attribute);

  if (document.getElementById('problem-type').value === 'optimisation') refreshObjectiveDropdown();
  refreshLiveWarnings();
}

function onMetricChange(id) {
  const metric = document.getElementById(`${id}-metric`)?.value || '';
  setTip(`${id}-tt-metric`, TIP_METRIC[metric] || '');
  const showThresh = THRESHOLD_METRICS.includes(metric);
  const showSettle = metric === 'time_settle';
  document.getElementById(`${id}-row-threshold`)?.classList.toggle('cond-hidden', !showThresh);
  document.getElementById(`${id}-row-settle`)?.classList.toggle('cond-hidden', !showSettle);
  refreshLiveWarnings();
}

function onOutputObjectInput(id) {
  // No enforcement needed — timeseries object is the raw object name from ElmRes export
}

function onOutputNameChange() {
  if (document.getElementById('problem-type').value === 'optimisation') refreshObjectiveDropdown();
  refreshLiveWarnings();
}

function removeOutputVar(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
  if (aceEditors[id]) { aceEditors[id].destroy(); delete aceEditors[id]; }
  reindexOutputVars();
  if (document.getElementById('problem-type').value === 'optimisation') refreshObjectiveDropdown();
  refreshLiveWarnings();
}

function toggleOutputVar(id) {
  const body = document.getElementById(`${id}-body`);
  const btn  = document.getElementById(`${id}-toggle`);
  if (!body) return;
  const isHidden = body.classList.toggle('hidden');
  btn.textContent = isHidden ? '▸' : '▾';
}

function initAceEditor(id, initialValue) {
  setTimeout(() => {
    const aceEl = document.getElementById(`${id}-ace`);
    if (!aceEl) return;
    const editor = ace.edit(aceEl);
    editor.setTheme('ace/theme/tomorrow_night');
    editor.session.setMode('ace/mode/python');
    editor.setOptions({ showLineNumbers: true, tabSize: 4, useSoftTabs: true, fontSize: '12px' });
    editor.setValue(initialValue || `def output_name(arg1, arg2):\n    return arg1 + arg2`, -1);
    aceEditors[id] = editor;
  }, 50);
}

function getOutputVars() {
  const container = document.getElementById('output-vars-container');
  const items = container.querySelectorAll('.output-var-item');
  return Array.from(items).map(div => {
    const id = div.id;
    const type = document.getElementById(`${id}-type`)?.value || 'attribute';
    const name = document.getElementById(`${id}-name`)?.value?.trim() || '';
    const objInput = document.getElementById(`${id}-obj`);
    const objPrefixInput = document.getElementById(`${id}-obj-prefix`);
    const obj  = type === 'timeseries'
      ? (objPrefixInput?.value?.trim() || objInput?.value?.trim() || '')
      : (objInput?.value?.trim() || '');
    const varN = document.getElementById(`${id}-var`)?.value?.trim() || '';
    const metric = document.getElementById(`${id}-metric`)?.value || '';
    const threshold = document.getElementById(`${id}-threshold`)?.value?.trim() || '';
    const settle_band = document.getElementById(`${id}-settle-band`)?.value?.trim() || '';
    const settle_hold = document.getElementById(`${id}-settle-hold`)?.value?.trim() || '';
    const settle_ref  = document.getElementById(`${id}-settle-ref`)?.value?.trim() || '';
    const customFn = aceEditors[id] ? aceEditors[id].getValue() : '';
    const output_graph   = document.getElementById(`${id}-output-graph`)?.checked || false;
    const output_raw_csv = document.getElementById(`${id}-output-raw`)?.checked || false;
    return { id, type, name, object_query: obj, variable: varN, metric, threshold,
             settle_band, settle_hold_time: settle_hold, settle_reference_value: settle_ref,
             customFn, output_graph, output_raw_csv };
  });
}

/* ================================================================
   CONSTRAINT TABLE
================================================================ */
let constraintCounter = 0;

function addConstraint(data = {}) {
  const idx = constraintCounter++;
  const tbody = document.getElementById('constraint-tbody');
  const tr = document.createElement('tr');
  tr.id = `con-row-${idx}`;

  // Build output var options
  const outputVars = getOutputVars();
  const options = outputVars.map(ov =>
    `<option value="${ov.name}" ${data.output===ov.name?'selected':''}>${ov.name||'(unnamed)'}</option>`
  ).join('');

  tr.innerHTML = `
    <td>
      <select id="con-out-${idx}">
        <option value="">— select —</option>
        ${options}
      </select>
    </td>
    <td>
      <select id="con-op-${idx}">
        <option value=">=" ${data.operator==='>='?'selected':''}>>=</option>
        <option value="<=" ${data.operator==='<='?'selected':''}><=</option>
        <option value="==" ${data.operator==='=='?'selected':''}>==</option>
      </select>
    </td>
    <td><input type="number" id="con-val-${idx}" value="${data.value||''}" step="any" placeholder="0.95" autocomplete="off" /></td>
    <td class="td-action">
      <button class="btn btn-remove btn-icon" onclick="removeRow('con-row-${idx}')">✕</button>
    </td>
  `;
  tbody.appendChild(tr);
}

function getConstraints() {
  const tbody = document.getElementById('constraint-tbody');
  return Array.from(tbody.querySelectorAll('tr')).map(tr => {
    const idx = tr.id.replace('con-row-','');
    return {
      output:   document.getElementById(`con-out-${idx}`)?.value || '',
      operator: document.getElementById(`con-op-${idx}`)?.value || '>=',
      value:    document.getElementById(`con-val-${idx}`)?.value?.trim() || '0',
    };
  });
}

function refreshObjectiveDropdown() {
  const sel = document.getElementById('optim-objective');
  const current = sel.value;
  const outputVars = getOutputVars();
  sel.innerHTML = '<option value="">— select output variable —</option>';
  outputVars.forEach(ov => {
    const opt = document.createElement('option');
    opt.value = ov.name;
    opt.textContent = ov.name || '(unnamed)';
    if (ov.name === current) opt.selected = true;
    sel.appendChild(opt);
  });
}

/* ================================================================
   READ CONFIG FROM FORM
================================================================ */
function readConfig() {
  const codingStyle = document.getElementById('coding-style').value;
  return {
    initialisation: {
      powerfactoryApiPath: document.getElementById('pf-api-path').value.trim(),
      username:            document.getElementById('pf-username').value.trim(),
      outputDir:           document.getElementById('output-dir').value.trim(),
      problemType:         document.getElementById('problem-type').value,
      studyType:           document.getElementById('study-type').value,
      codingStyle:         codingStyle,
      tstop:               document.getElementById('tstop').value.trim(),
    },
    inputVariables:  getInputRows(),
    outputVariables: getOutputVars(),
    optimisation: {
      sense:              document.getElementById('optim-sense').value,
      objectiveOutputName: document.getElementById('optim-objective').value,
      algorithm:          document.getElementById('optim-algorithm').value,
      maxIterations:      document.getElementById('optim-max-iter').value,
      constraints:        getConstraints(),
    },
    customMode: {
      scenarioFilePath: document.getElementById('scenario-file-path').value.trim(),
    },
    contingencyMode: {
      elementTypes:  getContingencyElementTypes(),
      contingencyN:  document.getElementById('contingency-n')?.value || '1',
      combineTypes:  document.getElementById('contingency-combine')?.checked || false,
    },
    additionalConfig: {
      iterateStudyCases:        document.getElementById('iterate-study-cases').checked,
      iterateOperatingScenarios:document.getElementById('iterate-operating-scenarios').checked,
      useProgressBar:           document.getElementById('use-progress-bar').checked,
      openPowerFactoryWindow:   document.getElementById('open-pf-window').checked,
      saveIntermediateEnabled:  document.getElementById('save-intermediate').checked,
      saveIntermediateMinutes:  document.getElementById('save-interval-minutes').value.trim(),
    }
  };
}

/* ================================================================
   LOAD CONFIG INTO FORM
================================================================ */
function loadConfig(cfg) {
  const init = cfg.initialisation || {};
  document.getElementById('pf-api-path').value      = init.powerfactoryApiPath || '';
  document.getElementById('pf-username').value      = init.username || '';
  document.getElementById('output-dir').value       = init.outputDir || '';
  document.getElementById('problem-type').value     = init.problemType || 'brute_force';
  document.getElementById('study-type').value       = init.studyType || 'steady_state';
  document.getElementById('coding-style').value     = init.codingStyle || 'python_file';
  document.getElementById('tstop').value            = init.tstop || '20';

  // Input variables
  document.getElementById('input-tbody').innerHTML = '';
  inputRowCounter = 0;
  (cfg.inputVariables || []).forEach(iv => addInputRow(iv));

  // Output variables
  document.getElementById('output-vars-container').innerHTML = '';
  outputVarCounter = 0;
  Object.keys(aceEditors).forEach(k => { aceEditors[k].destroy(); delete aceEditors[k]; });
  (cfg.outputVariables || []).forEach(ov => addOutputVar(ov));

  const opt = cfg.optimisation || {};
  document.getElementById('optim-sense').value       = opt.sense || 'minimise';
  let algVal = opt.algorithm || 'placeholder';
  if (algVal === 'scipy_minimize') algVal = 'scipy_lbfgsb'; // legacy key migration
  document.getElementById('optim-algorithm').value   = algVal;
  document.getElementById('optim-max-iter').value    = opt.maxIterations || 50;
  refreshObjectiveDropdown();
  document.getElementById('optim-objective').value   = opt.objectiveOutputName || '';
  updateAlgorithmUI();

  document.getElementById('constraint-tbody').innerHTML = '';
  constraintCounter = 0;
  (opt.constraints || []).forEach(c => addConstraint(c));

  const cm = cfg.customMode || {};
  document.getElementById('scenario-file-path').value  = cm.scenarioFilePath || '';

  const cont = cfg.contingencyMode || {};
  document.getElementById('contingency-tbody').innerHTML = '';
  contingencyRowCounter = 0;
  const contTypes = cont.elementTypes && cont.elementTypes.length > 0
    ? cont.elementTypes
    : [{ query: '*.ElmLne', filterAttr: '', filterOp: '>=', filterVal: '' }];
  contTypes.forEach(et => addContingencyRow(et));
  const contNEl = document.getElementById('contingency-n');
  if (contNEl) contNEl.value = cont.contingencyN || '1';
  const contCombEl = document.getElementById('contingency-combine');
  if (contCombEl) contCombEl.checked = !!cont.combineTypes;
  onContingencyNChange();

  const ac = cfg.additionalConfig || {};
  document.getElementById('iterate-study-cases').checked         = !!ac.iterateStudyCases;
  document.getElementById('iterate-operating-scenarios').checked = !!ac.iterateOperatingScenarios;
  document.getElementById('use-progress-bar').checked           = ac.useProgressBar !== false;
  document.getElementById('open-pf-window').checked             = !!ac.openPowerFactoryWindow;
  document.getElementById('save-intermediate').checked          = !!ac.saveIntermediateEnabled;
  document.getElementById('save-interval-minutes').value        = ac.saveIntermediateMinutes || 30;

  onProblemTypeChange();
  onStudyTypeChange();
  onSaveIntermediateChange();
  onCodingStyleChange();
}

/* ================================================================
   VALIDATION
================================================================ */
function validateConfig(cfg) {
  const errors = [];
  const init = cfg.initialisation;
  if (!init.problemType) errors.push('Problem type is required.');
  if (!init.studyType)   errors.push('Study type is required.');
  if (!init.codingStyle) errors.push('Coding style is required.');

  if (init.problemType !== 'contingency' && cfg.inputVariables.length === 0)
    errors.push('At least one input variable is required.');
  if (cfg.outputVariables.length === 0) errors.push('At least one output variable is required.');

  // ── Duplicate name detection across inputs AND outputs ────────────
  const allInputNames  = cfg.inputVariables.map((iv, i) => iv.name || `input_${i}`);
  const allOutputNames = cfg.outputVariables.map(ov => ov.name).filter(Boolean);

  // Duplicates within input variables
  const seenInputNames = new Set();
  allInputNames.forEach((n, i) => {
    if (seenInputNames.has(n)) errors.push(`Input variable #${i + 1}: Name "${n}" is already used by another input variable.`);
    seenInputNames.add(n);
  });

  // Duplicates within output variables
  const seenOutputNames = new Set();
  allOutputNames.forEach((n, i) => {
    if (seenOutputNames.has(n)) errors.push(`Output variable #${i + 1}: Name "${n}" is already used by another output variable.`);
    seenOutputNames.add(n);
  });

  // Cross-collision: input name used as output name or vice versa
  const inputNameSet = new Set(allInputNames);
  allOutputNames.forEach(n => {
    if (inputNameSet.has(n)) {
      errors.push(`Name "${n}" is used by both an input variable and an output variable. All variable names must be unique.`);
    }
  });
  // ──────────────────────────────────────────────────────────────────

  cfg.inputVariables.forEach((iv, i) => {
    if (!iv.object_query) errors.push(`Input variable #${i + 1}: Object is required.`);
    if (!iv.variable)     errors.push(`Input variable #${i + 1}: Variable is required.`);
  });

  cfg.outputVariables.forEach((ov, i) => {
    if (!ov.name) errors.push(`Output variable #${i + 1}: Name is required.`);
    if (!isPythonIdentifier(sanitizeName(ov.name)) && ov.name) {
      errors.push(`Output variable #${i + 1}: Name "${ov.name}" is not a valid Python identifier (will be sanitized).`);
    }
    if (ov.type !== 'custom_calculation' && !ov.object_query)
      errors.push(`Output variable #${i + 1} "${ov.name}": Object is required.`);
    if (ov.type === 'timeseries' && THRESHOLD_METRICS.includes(ov.metric) && !ov.threshold)
      errors.push(`Output variable "${ov.name}": Threshold is required for metric "${ov.metric}".`);
    if (ov.type === 'timeseries' && ov.metric === 'time_settle') {
      if (!ov.settle_band)          errors.push(`Output variable "${ov.name}": Settle Band is required for Time Settle.`);
      if (!ov.settle_hold_time)     errors.push(`Output variable "${ov.name}": Hold Time is required for Time Settle.`);
      if (!ov.settle_reference_value) errors.push(`Output variable "${ov.name}": Reference Value is required for Time Settle.`);
    }
    if (ov.type === 'custom_calculation' && (!ov.customFn || ov.customFn.trim().length < 5))
      errors.push(`Output variable "${ov.name}": Custom function body is required.`);
  });

  // ── Duplicate custom function name detection ───────────────────────
  const seenFnNames = new Set();
  cfg.outputVariables.forEach(ov => {
    if (ov.type !== 'custom_calculation') return;
    const firstLine = (ov.customFn || '').trim().split('\n')[0];
    const defMatch  = firstLine.match(/^def\s+(\w+)\s*\(/);
    if (!defMatch) return;
    const fnName = defMatch[1];
    if (seenFnNames.has(fnName)) {
      errors.push(`Custom function name "${fnName}" is defined more than once. Each custom calculation must use a unique function name.`);
    }
    seenFnNames.add(fnName);
  });
  // ──────────────────────────────────────────────────────────────────

  if (init.problemType === 'optimisation') {
    if (!cfg.optimisation.sense)               errors.push('Optimisation: Sense is required.');
    if (!cfg.optimisation.objectiveOutputName) errors.push('Optimisation: Objective output variable is required.');
  }

  if (init.problemType === 'custom') {
    if (!cfg.customMode.scenarioFilePath) errors.push('Custom mode: Scenario file path is required.');
    // Wildcard inputs ARE supported in Custom mode: the same scenario value is applied to all
    // matched objects. Extra objects can be controlled by adding more columns to the spreadsheet.
  }

  if (init.problemType === 'contingency') {
    const types = cfg.contingencyMode.elementTypes || [];
    if (types.length === 0 || !types.some(t => t.query))
      errors.push('Contingency: at least one element query is required (e.g. *.ElmLne).');
    types.forEach((t, i) => {
      if (t.filterAttr && (t.filterVal === '' || t.filterVal === null || t.filterVal === undefined))
        errors.push(`Contingency element type ${i + 1}: filter value is required when a filter attribute is set.`);
    });
  }

  return errors;
}

function showValidationErrors(errors) {
  const box = document.getElementById('validation-errors');
  const ul  = document.getElementById('validation-list');
  if (errors.length === 0) { box.style.display = 'none'; return; }
  ul.innerHTML = errors.map(e => `<li>${e}</li>`).join('');
  box.style.display = 'block';
  box.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

function validateCustomCalcWarnings(cfg) {
  const warnings = [];
  const inputNames = cfg.inputVariables.map(iv => iv.name).filter(Boolean);
  const allOutputVars = cfg.outputVariables;

  cfg.outputVariables.forEach((ov, i) => {
    if (ov.type !== 'custom_calculation') return;
    const fn = (ov.customFn || '').trim();
    if (!fn) return;

    // All valid argument names = input var names + other output var names
    const otherOutputNames = allOutputVars
      .filter((_, j) => j !== i)
      .map(o => o.name)
      .filter(Boolean);
    const validArgs = new Set([...inputNames, ...otherOutputNames]);

    // Extract function arguments from def line
    const defMatch = fn.match(/^def\s+\w+\s*\(([^)]*)\)/m);
    if (defMatch) {
      const args = defMatch[1].split(',').map(a => a.trim()).filter(Boolean);
      args.forEach(arg => {
        if (!validArgs.has(arg)) {
          warnings.push(`Output "${ov.name}": Function argument "${arg}" is not a defined input or output variable name.`);
        }
      });
    }

    // Check for multiple return values (return with comma not inside brackets)
    const returnMatches = fn.match(/\breturn\b[^\n]+/g);
    if (returnMatches) {
      returnMatches.forEach(ret => {
        const retVal = ret.replace(/#[^\n]*$/, '').trim();
        if (hasMultipleReturnValues(retVal)) {
          warnings.push(`Output "${ov.name}": Function must return exactly one value (no tuples). Found: "${ret.trim()}"`);
        }
      });
    }
  });

  return warnings;
}

function buildObjectTypeWarnings(cfg) {
  const warnings = [];
  const checkObjectQuery = (objectQuery, label, allowEvt = false) => {
    if (!objectQuery) return;
    const objectType = objectQuery.trim().split('.').pop();
    const isElm = objectType && objectType.startsWith('Elm');
    const isSta = objectType && objectType.startsWith('Sta');
    const isEvt = objectType && objectType.startsWith('Evt');
    const isTyp = objectType && objectType.startsWith('Typ');
    if (!objectType || (!isElm && !isSta && !isTyp && !(allowEvt && isEvt))) {
      const evtHint = allowEvt ? ', ".EvtShc", ".EvtSwitch"' : '';
      warnings.push(`${label}: Object "${objectQuery}" should end with a PowerFactory object type (e.g., ".ElmTerm", ".ElmDsl"${evtHint}).`);
      return;
    }
    if (isElm && !isKnownElmObjectType(objectType)) {
      warnings.push(`${label}: Object type "${objectType}" is not recognised from the PowerFactory API reference. Check for typos.`);
    }
    if (isTyp && !isKnownTypObjectType(objectType)) {
      warnings.push(`${label}: Object type "${objectType}" is not recognised from the PowerFactory API reference. Check for typos.`);
    }
  };

  cfg.inputVariables.forEach((iv, i) => checkObjectQuery(iv.object_query, `Input variable #${i + 1}`, true));
  cfg.outputVariables.forEach((ov, i) => {
    if (ov.type === 'custom_calculation') return;
    checkObjectQuery(ov.object_query, `Output variable #${i + 1} "${ov.name || '(unnamed)'}"`, false);
  });

  return warnings;
}

function updateTimeseriesAvailability() {
  const st = document.getElementById('study-type').value;
  const isDynamic = st === 'dynamic_rms' || st === 'dynamic_emt';
  document.querySelectorAll('#output-vars-container .output-var-item').forEach(div => {
    const id = div.id;
    const typeSelect = document.getElementById(`${id}-type`);
    const tsOption = typeSelect?.querySelector('option[value="timeseries"]');
    if (tsOption) tsOption.disabled = !isDynamic;
    if (!isDynamic && typeSelect?.value === 'timeseries') {
      typeSelect.value = 'attribute';
      onOutputTypeChange(id);
    }
  });
}

function getLiveWarnings(cfg) {
  const warnings = [...validateCustomCalcWarnings(cfg), ...buildObjectTypeWarnings(cfg)];
  const st = cfg.initialisation.studyType;
  const isDynamic = st === 'dynamic_rms' || st === 'dynamic_emt';
  if (!isDynamic && cfg.outputVariables.some(ov => ov.type === 'timeseries')) {
    warnings.push('Timeseries output variables are available only for Dynamic RMS or Dynamic EMT study types.');
  }
  return warnings;
}

function refreshLiveWarnings() {
  updateTimeseriesAvailability();
  const cfg = readConfig();
  const warnings = getLiveWarnings(cfg);
  showValidationWarnings(warnings);
}

function hasMultipleReturnValues(retStr) {
  const val = retStr.replace(/^return\s+/, '').trim();
  let depth = 0;
  for (let i = 0; i < val.length; i++) {
    const c = val[i];
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (c === ',' && depth === 0) return true;
  }
  return false;
}

function showValidationWarnings(warnings) {
  const box = document.getElementById('validation-warnings');
  const ul  = document.getElementById('validation-warning-list');
  if (!warnings || warnings.length === 0) { box.style.display = 'none'; return; }
  ul.innerHTML = warnings.map(w => `<li>${w}</li>`).join('');
  box.style.display = 'block';
}

function isPythonIdentifier(name) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

function sanitizeName(name) {
  if (!name) return 'unnamed_output';
  return name.replace(/[^A-Za-z0-9_]/g, '_').replace(/^([0-9])/, '_$1');
}

/* ================================================================
   DETERMINISTIC CODE BUILDER FUNCTIONS
   ----------------------------------------------------------------
   MOVED to pf-script-builder.js — the standalone PowerFactory
   Python API building block. All buildXxx() helpers and the
   buildPowerFactoryScript(cfg) entry point now live there. Add or
   modify generated-Python patterns in that file. This file keeps
   the shared helpers they rely on (sanitizeName, ALGORITHM_META).
================================================================ */

/* ================================================================
   MASTER GENERATE CODE FUNCTION
================================================================ */
function generateCode() {
  const cfg = readConfig();
  const errors = validateConfig(cfg);
  showValidationErrors(errors);
  if (errors.length > 0) return;
  const warnings = getLiveWarnings(cfg);
  showValidationWarnings(warnings);

  // Build the PowerFactory Python script (pure assembly lives in pf-script-builder.js)
  const finalCode = buildPowerFactoryScript(cfg);

  // Store for download
  window._generatedCode = finalCode;

  const preEl = document.getElementById('code-preview');
  const nbEl  = document.getElementById('nb-preview');
  const isNotebook = cfg.initialisation.codingStyle === 'notebook';

  if (isNotebook) {
    // Notebook style → render one Jupyter-like cell per section.
    const cells = buildPowerFactoryNotebookCells(cfg);
    window._generatedCells = cells;
    renderNotebookCells(cells, nbEl);
    preEl.style.display = 'none';
    nbEl.style.display = '';
  } else {
    window._generatedCells = null;
    preEl.innerHTML = `<code class="language-python">${escapeHtml(finalCode)}</code>`;
    hljs.highlightElement(preEl.querySelector('code'));
    preEl.style.display = '';
    nbEl.style.display = 'none';
  }
  updateDownloadButtonLabel();
  showToast('generate-toast');
}

/* Render the notebook cells as individual code cells (Jupyter-style). */
function renderNotebookCells(cells, container) {
  let html = '';
  cells.forEach((cell, i) => {
    html += `<div class="nb-md-heading">Cell ${i + 1} — ${escapeHtml(cell.name)}</div>`;
    html += `<div class="nb-cell">` +
              `<div class="nb-prompt">In [ ]:</div>` +
              `<pre class="nb-source"><code class="language-python">${escapeHtml(cell.source)}</code></pre>` +
            `</div>`;
  });
  container.innerHTML = html;
  container.querySelectorAll('code').forEach(el => hljs.highlightElement(el));
}

/* Toolbar download button reflects the selected coding style (.py vs .ipynb). */
function updateDownloadButtonLabel() {
  const btn = document.getElementById('download-btn');
  if (!btn) return;
  const cs = document.getElementById('coding-style').value;
  btn.textContent = cs === 'notebook' ? '↓ .ipynb' : '↓ .py';
}

function escapeHtml(str) {
  return str
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}


function showToast(toastId) {
  const allToasts = document.querySelectorAll('.toast');
  allToasts.forEach(t => t.classList.remove('show'));
  const toast = document.getElementById(toastId);
  if (!toast) return;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

/* ================================================================
   COPY / DOWNLOAD
================================================================ */
function copyCode() {
  const code = window._generatedCode;
  if (!code) { alert('Generate code first.'); return; }
  navigator.clipboard.writeText(code).then(() => {
    showToast('copy-toast');
  });
}

/* Route the toolbar download to .ipynb when the code was generated in
   Notebook style, otherwise to a plain .py file. */
function downloadCode() {
  if (window._generatedCells) { downloadIpynb(); return; }
  downloadPy();
}

function downloadPy() {
  if (!window._generatedCode) { alert('Generate code first.'); return; }
  const marked = '# Made using tool.adjiebrotots.com/powerfactory-scripter\n' + window._generatedCode;
  download(marked, 'powerfactory_script.py', 'text/plain');
}

/* Build a valid Jupyter notebook (.ipynb v4) from the generated cells —
   each section becomes a markdown heading cell + a code cell. */
function downloadIpynb() {
  if (!window._generatedCells) { alert('Generate code first.'); return; }
  const credit = '# Made using tool.adjiebrotots.com/powerfactory-scripter';
  const toSource = text => {
    const lines = String(text).replace(/\s+$/, '').split('\n');
    return lines.map((l, i) => i === lines.length - 1 ? l : l + '\n');
  };
  const nbCells = [];
  window._generatedCells.forEach((cell, i) => {
    nbCells.push({ cell_type: 'markdown', id: `md-${i + 1}`, metadata: {}, source: toSource(`## Cell ${i + 1} — ${cell.name}`) });
    const body = i === 0 ? credit + '\n' + cell.source : cell.source;
    nbCells.push({ cell_type: 'code', id: `code-${i + 1}`, metadata: {}, execution_count: null, outputs: [], source: toSource(body) });
  });
  const notebook = {
    cells: nbCells,
    metadata: {
      kernelspec: { display_name: 'Python 3', language: 'python', name: 'python3' },
      language_info: { name: 'python' }
    },
    nbformat: 4,
    nbformat_minor: 5
  };
  download(JSON.stringify(notebook, null, 1), 'powerfactory_script.ipynb', 'application/x-ipynb+json');
}

function download(content, filename, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = filename;
  a.click();
}

function downloadCustomTemplate() {
  const inputs = getInputRows();
  const validInputs = inputs.filter(iv => iv.object_query && iv.variable);
  if (validInputs.length === 0) {
    alert('Add input variables (with Object and Variable filled) first.');
    return;
  }
  // 3-row header system:
  //   Row 1: "Variable name" | var_name_1 | var_name_2 | ...
  //   Row 2: "Object"        | obj_query_1 | obj_query_2 | ...
  //   Row 3: "Attribute"     | attribute_1 | attribute_2 | ...
  //   Rows 4+: scenario label | value | value | ...
  const varNameRow  = ['Variable name', ...validInputs.map((iv, i) => iv.name || `input_${i}`)];
  const objectRow   = ['Object',        ...validInputs.map(iv => iv.object_query || '')];
  const attributeRow= ['Attribute',     ...validInputs.map(iv => iv.variable || '')];
  // Pre-fill 4 scenario data rows
  const dataRows = [1, 2, 3, 4].map(n => [n, ...validInputs.map(() => '')]);
  const allRows = [varNameRow, objectRow, attributeRow, ...dataRows];

  if (typeof XLSX !== 'undefined') {
    const ws = XLSX.utils.aoa_to_sheet(allRows);
    // Column widths based on widest value in each column
    const numCols = varNameRow.length;
    ws['!cols'] = Array.from({ length: numCols }, (_, ci) => {
      const maxLen = allRows.reduce((m, r) => Math.max(m, String(r[ci] || '').length), 0);
      return { wch: Math.max(maxLen + 4, 14) };
    });
    // Bold the 3 header rows
    for (let ri = 0; ri < 3; ri++) {
      for (let ci = 0; ci < numCols; ci++) {
        const cellAddr = XLSX.utils.encode_cell({ r: ri, c: ci });
        if (ws[cellAddr]) ws[cellAddr].s = { font: { bold: true } };
      }
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, 'scenario_template.xlsx');
  } else {
    // CSV fallback
    const csvContent = allRows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    download(csvContent, 'scenario_template.csv', 'text/csv');
  }
}

/* ================================================================
   EXPORT / IMPORT CONFIG JSON
================================================================ */
function exportConfigJSON() {
  const cfg = readConfig();
  download(JSON.stringify(cfg, null, 2), 'powerfactory_config.json', 'application/json');
}

function importConfigJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const cfg = JSON.parse(e.target.result);
      loadConfig(cfg);
      refreshLiveWarnings();
      showToast('import-toast');
    } catch(err) {
      alert('Invalid JSON file: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

/* ================================================================
   RESET FORM
================================================================ */
function resetForm() {
  if (!confirm('Reset all fields to defaults?')) return;
  loadConfig({
    initialisation: { powerfactoryApiPath:'', username:'', outputDir:'', problemType:'brute_force', studyType:'steady_state', codingStyle:'python_file', tstop:'20' },
    inputVariables: [],
    outputVariables: [],
    optimisation: { sense:'minimise', objectiveOutputName:'', algorithm:'placeholder', maxIterations:50, constraints:[] },
    customMode: { scenarioFilePath:'' },
    contingencyMode: { elementTypes:[{ query:'*.ElmLne', filterAttr:'', filterOp:'>=', filterVal:'' }], contingencyN:'1', combineTypes:false },
    additionalConfig: { iterateStudyCases:false, iterateOperatingScenarios:false, useProgressBar:true, openPowerFactoryWindow:false, saveIntermediateEnabled:false, saveIntermediateMinutes:30 }
  });
  window._generatedCode = '';
  window._generatedCells = null;
  const preEl = document.getElementById('code-preview');
  const nbEl  = document.getElementById('nb-preview');
  preEl.innerHTML = `<code class="language-python">
<div class="placeholder-msg">
  <span class="big">⚡</span>
  <span>Configure inputs and click <strong>Generate Code</strong></span>
</div>
  </code>`;
  preEl.style.display = '';
  if (nbEl) { nbEl.style.display = 'none'; nbEl.innerHTML = ''; }
  updateDownloadButtonLabel();
  document.getElementById('validation-errors').style.display = 'none';
  document.getElementById('validation-warnings').style.display = 'none';
}

/* ================================================================
   INFO BOX — collapsible extra detail
================================================================ */
function toggleInfoExtra(extraId, btn) {
  const el = document.getElementById(extraId);
  if (!el) return;
  const open = el.classList.toggle('open');
  btn.textContent = open ? 'Less ▴' : 'More ▾';
}

/* ================================================================
   QUICK START — one-click worked examples loaded from samples/
================================================================ */
async function applyQuickStart(key) {
  const res = await fetch(`samples/json-samples/${key}.json`);
  if (!res.ok) throw new Error(`Could not load ${key}.json`);
  const cfg = await res.json();
  loadConfig(cfg);
  refreshLiveWarnings();
  document.querySelectorAll('.quick-start-btn').forEach(b => b.classList.toggle('active', b.dataset.preset === key));
  showToast('import-toast');
}

document.querySelectorAll('.quick-start-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    if (btn.disabled) return;
    const all = [...document.querySelectorAll('.quick-start-btn')];
    all.forEach(b => b.disabled = true);
    try { await applyQuickStart(btn.dataset.preset); }
    catch (err) { alert('Could not load sample: ' + err.message); }
    finally { all.forEach(b => b.disabled = false); }
  });
});

/* ================================================================
   PANE RESIZER — drag handle between left and right panes
================================================================ */
(function initPaneResizer() {
  const resizer  = document.getElementById('pane-resizer');
  const leftPane = document.getElementById('left-pane');
  if (!resizer || !leftPane) return;

  let startX = 0, startW = 0;

  resizer.addEventListener('mousedown', e => {
    startX = e.clientX;
    startW = leftPane.offsetWidth;
    resizer.classList.add('dragging');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
  });

  function onDrag(e) {
    const newW = startW + (e.clientX - startX);
    const min  = 260;
    const max  = Math.floor(window.innerWidth * 0.72);
    leftPane.style.width    = `${Math.max(min, Math.min(max, newW))}px`;
    leftPane.style.minWidth = '0';
    leftPane.style.maxWidth = 'none';
    leftPane.style.flexShrink = '0';
  }

  function onUp() {
    resizer.classList.remove('dragging');
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', onUp);
  }
})();

/* ================================================================
   THEME TOGGLE
================================================================ */
(function initTheme() {
  const btn = document.getElementById('themeToggle');
  const hljsTheme = document.getElementById('hljs-theme');
  const HLJS_DARK  = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css';
  const HLJS_LIGHT = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-light.min.css';
  const apply = (light) => {
    document.body.classList.toggle('light', light);
    btn.textContent = light ? '🌙 Dark' : '☀️ Light';
    hljsTheme.href = light ? HLJS_LIGHT : HLJS_DARK;
  };
  apply(localStorage.getItem('pf-theme') !== 'dark');
  btn.addEventListener('click', () => {
    const next = !document.body.classList.contains('light');
    apply(next);
    localStorage.setItem('pf-theme', next ? 'light' : 'dark');
  });
})();

/* ================================================================
   INIT — add default rows on load
================================================================ */
(function init() {
  // Kick off reference data fetch (comboboxes degrade gracefully if files absent)
  fetchReferenceData();
  addInputRow({ name: 'Q_gen', object_query: 'Gen.ElmSym', variable: 'e:qgini', lower: -50, upper: 50, step: 5 });
  addOutputVar({ type: 'attribute', name: 'Bus_voltage', object_query: 'Grid.ElmTerm', variable: 'm:u' });
  addContingencyRow({ query: '*.ElmLne' });
  onProblemTypeChange();
  onStudyTypeChange();
  updateAlgorithmUI();
  document.addEventListener('input', () => refreshLiveWarnings());
  document.addEventListener('change', () => refreshLiveWarnings());
  refreshLiveWarnings();

  /* ── Mini cache ────────────────────────────────────────────────────────
     Persist the whole scripter configuration using the same readConfig/
     loadConfig pair the sample loader uses, so a returning user finds their
     inputs, output variables, contingencies and settings still in place. The
     generated script isn't stored — it regenerates on demand from the config. */
  if (window.Persist) {
    Persist.init('powerfactory-scripter', {
      onRestore: function(){ refreshLiveWarnings(); },
      extra: {
        save: function(){ try { return readConfig(); } catch(e){ return null; } },
        restore: function(cfg){ if(cfg && typeof cfg === 'object'){ loadConfig(cfg); } }
      }
    });
  }
})();
