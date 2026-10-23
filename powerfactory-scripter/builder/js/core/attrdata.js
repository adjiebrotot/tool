// What the page knows about a PowerFactory attribute: its unit, and whether a class has a given
// input parameter. The blocks use it to leave out a choice that cannot apply (a unit for a
// percentage, "x ngnum" for a busbar), and js/ui/attrs.js uses the same loaded files for its
// attribute suggestions, so nothing is fetched twice.
//
// It reads the parent tool's reference data, which is only fetched when something asks for a
// class (element_params.json is about 700 kB):
//   ../element_params.json                               input data per class (e:...)
//   ../variables/elements/element_variables_index.json   which classes have a result file
//   ../variables/elements/<Class>.json                   result variables (m:, c:, n:, s:)
//
// Every accessor is synchronous and gives `undefined` while the data is not in yet. A block's
// showIf() must read that as "show it": the choice appears, and once the data lands the page
// redraws (onLoad) and the choice disappears if it cannot apply. Nothing here changes the
// generated Python — a hidden setting keeps the value it had.
//
// Plain ES module, no DOM. In Node (the tests) the relative fetch fails and every accessor
// simply stays `undefined`, so a test never depends on a network read.

const ROOT = '../';
const listeners = new Set();
let paramsP = null, indexP = null;
const classP = new Map();          // cls -> promise of the result-variable file
const paramUnits = new Map();      // cls -> Map(attr -> unit)
const resultUnits = new Map();     // cls -> Map(var -> unit)
let paramsRaw = null;

function announce() {
  for (const fn of [...listeners]) { try { fn(); } catch (e) { /* a listener of its own */ } }
}

// Anyone the page redraws when new reference data lands. Returns a function that stops it.
export function onLoad(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getJson(url) {
  if (typeof fetch !== 'function') return Promise.resolve(null);
  return fetch(url).then(r => (r.ok ? r.json() : null)).catch(() => null);
}

export function loadParams() {
  if (!paramsP) {
    paramsP = getJson(ROOT + 'element_params.json').then(d => { paramsRaw = d; announce(); return d; });
  }
  return paramsP;
}
function loadIndex() { return indexP || (indexP = getJson(ROOT + 'variables/elements/element_variables_index.json')); }

export function loadClass(cls) {
  if (!/^[A-Z][A-Za-z0-9]*$/.test(String(cls || ''))) return Promise.resolve(null);
  if (!classP.has(cls)) {
    classP.set(cls, loadIndex().then(idx => {
      // Only the classes the index lists have a file: asking for any other would be a 404.
      if (!idx || !idx[cls]) return null;
      return getJson(ROOT + 'variables/elements/' + cls + '.json');
    }).then(d => { if (d) buildResults(cls, d); announce(); return d; }));
  }
  return classP.get(cls);
}

// Start reading everything this class needs. Safe to call on every draw.
export function prime(cls) {
  loadParams();
  if (cls) loadClass(cls);
}

function buildParams(cls) {
  const list = paramsRaw && Array.isArray(paramsRaw[cls]) ? paramsRaw[cls] : null;
  const m = new Map();
  for (const v of list || []) {
    if (!v || typeof v.var !== 'string' || !v.var.startsWith('e:')) continue;
    m.set(v.var.slice(2), String(v.unit === undefined || v.unit === null ? '' : v.unit).trim());
  }
  paramUnits.set(cls, list ? m : null);
  return paramUnits.get(cls);
}

function buildResults(cls, data) {
  const rv = data && data.result_vars;
  const m = new Map();
  if (rv && typeof rv === 'object') {
    for (const byPrefix of Object.values(rv)) {
      for (const list of Object.values(byPrefix || {})) {
        for (const v of Array.isArray(list) ? list : []) {
          if (!v || typeof v.var !== 'string') continue;
          const u = String(v.unit === undefined || v.unit === null ? '' : v.unit).trim();
          if (!m.has(v.var)) m.set(v.var, u);
        }
      }
    }
  }
  resultUnits.set(cls, m);
}

// A result variable may be read at a terminal ("m:P:bus1"): the unit is the variable's own.
const baseVar = (attr) => String(attr || '').trim().replace(/:(bus\w+|Ph\w*)$/i, '');

// The unit PowerFactory gives for this attribute of this class: 'kV', '%', 'p.u.', '' (none),
// or `undefined` while the data is not in yet or the attribute is not one the page knows.
// '' and undefined are different: '' means "known to have no unit".
export function unitOf(cls, attr) {
  const c = String(cls || '');
  const a = String(attr || '').trim();
  if (!c || !a) return undefined;
  if (/^[a-z]:/.test(a) && !a.startsWith('e:')) {
    const m = resultUnits.get(c);
    if (!m) { return undefined; }
    const hit = m.get(baseVar(a));
    return hit === undefined ? undefined : hit;
  }
  const name = a.replace(/^e:/, '');
  if (!paramsRaw) return undefined;
  let m = paramUnits.get(c);
  if (m === undefined) m = buildParams(c);
  if (!m) return undefined;
  const hit = m.get(name);
  // Input data not in the list: it may still be a result variable written without its prefix.
  if (hit === undefined) {
    const r = resultUnits.get(c);
    const alt = r && r.get(baseVar(a));
    return alt === undefined ? undefined : alt;
  }
  return hit;
}

// Does this class have this input parameter (for example ngnum, the parallel machines)?
// `undefined` while the data is not in yet.
export function hasParam(cls, name) {
  const c = String(cls || '');
  if (!c || !paramsRaw) return undefined;
  let m = paramUnits.get(c);
  if (m === undefined) m = buildParams(c);
  if (!m) return undefined;
  return m.has(String(name));
}

// ---------------------------------------------------------------------------------------------
// Unit families
//
// The script converts a value only inside one family (runtime/pf_core.py unit_factor). A unit
// outside them (%, p.u., deg, Ohm, Hz, none) cannot be converted at all, so offering a unit for
// such an attribute only gets the reader a warning at run time.

export const UNIT_FAMILY = {
  W: 'P', kW: 'P', MW: 'P', GW: 'P',
  var: 'Q', kvar: 'Q', Mvar: 'Q', Gvar: 'Q',
  VA: 'S', kVA: 'S', MVA: 'S', GVA: 'S',
  s: 't', ms: 't', min: 't', h: 't',
  V: 'U', kV: 'U',
  A: 'I', kA: 'I',
  Wh: 'E', kWh: 'E', MWh: 'E', GWh: 'E',
};
const ALIAS = { MVAr: 'Mvar', MVar: 'Mvar', kVAr: 'kvar', kVar: 'kvar', sec: 's' };

// 'P' for MW, 'U' for kV ... ; '' for a unit no conversion can touch (%, p.u., deg, Ohm, none).
export function familyOf(unit) {
  const u = String(unit === undefined || unit === null ? '' : unit).trim();
  return UNIT_FAMILY[ALIAS[u] || u] || '';
}

// Can this attribute's value be given in another unit at all?
//   true  — yes, and `familyOf(unitOf(...))` says which units fit
//   false — no (a percentage, a per-unit value, an angle, a count, a name)
//   undefined — not known yet
export function convertible(cls, attr) {
  const u = unitOf(cls, attr);
  if (u === undefined) return undefined;
  return familyOf(u) !== '';
}

// ---------------------------------------------------------------------------------------------
// Only for the tests: put the reference data in by hand (nothing is fetched), or clear it again.
// `params` is element_params.json's shape ({ ElmSym: [{ var: 'e:pgini', unit: 'MW' }] }) and
// `results` a plain map per class ({ ElmLne: { 'c:loading': '%' } }).
export function _setForTests(params, results) {
  paramsRaw = params || null;
  paramUnits.clear();
  resultUnits.clear();
  if (results) for (const [cls, m] of Object.entries(results)) resultUnits.set(cls, new Map(Object.entries(m)));
  paramsP = params ? Promise.resolve(params) : null;
  indexP = null;
  classP.clear();
}
