// What the page knows about a PSCAD component: the definitions in the Master Library, and for
// each one the parameters of its form (name, what it means, its type, its unit and the values a
// choice takes). The blocks use it to leave out a choice that cannot apply (a unit for a
// percentage, a number field for a parameter that takes one of six words), and js/ui/attrs.js
// uses the same loaded files for its parameter suggestions, so nothing is fetched twice.
//
// It reads the reference data `_audit/reference/build_reference.py` writes out of a running
// PSCAD, fetched only when something asks for it:
//   ../reference/definitions.json   one line per definition: key, name, group, parameter count
//   ../reference/params.json        the parameters of every definition, without the help text
//
// Every accessor is synchronous and gives `undefined` while the data is not in yet. A block's
// showIf() must read that as "show it": the choice appears, and once the data lands the page
// redraws (onLoad) and the choice disappears if it cannot apply. Nothing here changes the
// generated Python - a hidden setting keeps the value it had.
//
// Plain ES module, no DOM. In Node (the tests) the relative fetch fails and every accessor
// simply stays `undefined`, so a test never depends on a network read.

const ROOT = '../reference/';
const listeners = new Set();
let defsP = null, paramsP = null;
let defsRaw = null, paramsRaw = null;

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

// The short list: every definition's key, name, group and how many parameters it has (21 kB).
export function loadDefinitions() {
  if (!defsP) {
    defsP = getJson(ROOT + 'definitions.json').then(d => { defsRaw = d; announce(); return d; });
  }
  return defsP;
}

// The parameters of every definition (about 1 MB): only fetched once a block asks about one.
export function loadParams() {
  if (!paramsP) {
    paramsP = getJson(ROOT + 'params.json').then(d => { paramsRaw = d; announce(); return d; });
  }
  return paramsP;
}

// Start both loads, for the inspector when it draws a component field.
export function prime(defn) {
  loadDefinitions();
  if (defn) loadParams();
}

// [[key, name, group, parameterCount]] sorted by key, or undefined while it is loading.
export function definitions() {
  return defsRaw && Array.isArray(defsRaw.defs) ? defsRaw.defs : undefined;
}

// Which PSCAD the reference data was read from, for the footer of the reference pages.
export function readFrom() {
  const d = defsRaw || paramsRaw;
  return d ? { pscad: d.pscad || '', generated: d.generated || '' } : undefined;
}

// A definition key as the data holds it: lower-case namespace, so "Master:Resistor",
// "resistor" and "master:resistor" all find the same component.
function keyOf(defn) {
  const want = String(defn || '').trim().toLowerCase();
  if (!want) return '';
  if (!paramsRaw || !paramsRaw.defs) return want.includes(':') ? want : '';
  if (paramsRaw.defs[want]) return want;
  if (paramsRaw.defs['master:' + want]) return 'master:' + want;
  // A definition of the reader's own project is not in the Master Library data at all.
  return '';
}

function recOf(defn) {
  if (!paramsRaw || !paramsRaw.defs) return undefined;
  const key = keyOf(defn);
  return key ? paramsRaw.defs[key] : null;
}

// Every parameter of a definition as [{ name, desc, type, unit, group, default, options }],
// in form order; null when the definition is not one the data knows (a project's own),
// undefined while the data is loading.
export function paramsOf(defn) {
  const rec = recOf(defn);
  if (rec === undefined) { loadParams(); return undefined; }
  if (!rec) return null;
  return Object.keys(rec.params || {}).map(name => ({ name, ...rec.params[name] }));
}

// One parameter's record, or null / undefined as above.
export function paramOf(defn, param) {
  const rec = recOf(defn);
  if (rec === undefined) { loadParams(); return undefined; }
  if (!rec) return null;
  const name = String(param || '').trim();
  if (!name) return null;
  const params = rec.params || {};
  if (params[name]) return { name, ...params[name] };
  // PSCAD's parameter names are case sensitive, but a reader typing "r" for "R" meant R.
  const hit = Object.keys(params).find(k => k.toLowerCase() === name.toLowerCase());
  return hit ? { name: hit, ...params[hit] } : null;
}

// The unit PSCAD gives a parameter ("ohm", "kV", "s"), '' when it has none, or undefined.
export function unitOf(defn, param) {
  const p = paramOf(defn, param);
  if (p === undefined) return undefined;
  return p ? String(p.unit || '') : undefined;
}

// What kind of value a parameter takes: 'Real', 'Integer', 'Choice', 'Text', 'Logical',
// 'Table'. undefined while the data is loading or when the definition is not known.
export function typeOf(defn, param) {
  const p = paramOf(defn, param);
  if (p === undefined || p === null) return undefined;
  return String(p.type || '') || undefined;
}

// The values a Choice parameter takes, as [[value, label]] with the value exactly as the
// Automation Library writes it ("BEHIND_SOURCE_IMPEDANCE"). undefined when unknown, null
// when the parameter is not a choice.
export function optionsOf(defn, param) {
  const p = paramOf(defn, param);
  if (p === undefined) return undefined;
  if (!p) return undefined;
  return Array.isArray(p.options) && p.options.length ? p.options : null;
}

// True / false / undefined: does this definition have a parameter of that name?
export function hasParam(defn, param) {
  const rec = recOf(defn);
  if (rec === undefined) { loadParams(); return undefined; }
  if (!rec) return undefined;
  const p = paramOf(defn, param);
  return p === undefined ? undefined : !!p;
}

// The groups a definition's form puts its parameters in, in order.
export function groupsOf(defn) {
  const list = paramsOf(defn);
  if (!list) return list === null ? null : undefined;
  const seen = [];
  for (const p of list) {
    const g = String(p.group || '').trim();
    if (g && !seen.includes(g)) seen.push(g);
  }
  return seen;
}

// The unit families the runtime can convert inside (runtime/px_core.py unit_factor). A unit
// outside all of them - a percentage, a per-unit value, an angle, a count - cannot be
// converted at all, so the Unit choice is not offered for it.
export const UNIT_FAMILY = {
  W: 'p', kW: 'p', MW: 'p', GW: 'p',
  var: 'q', kvar: 'q', Mvar: 'q', Gvar: 'q', VAR: 'q', kVAR: 'q', MVAR: 'q',
  VA: 's', kVA: 's', MVA: 's', GVA: 's',
  s: 't', ms: 't', us: 't', min: 't', h: 't',
  V: 'v', kV: 'v', mV: 'v',
  A: 'i', kA: 'i', mA: 'i',
  ohm: 'r', kohm: 'r', mohm: 'r',
  H: 'l', mH: 'l', uH: 'l',
  F: 'c', uF: 'c', nF: 'c', pF: 'c',
  Hz: 'f', kHz: 'f', MHz: 'f',
  Wh: 'e', kWh: 'e', MWh: 'e', GWh: 'e',
};

// Which family a unit belongs to, '' for one that converts to nothing.
export function familyOf(unit) {
  const u = String(unit || '').trim();
  if (!u) return '';
  if (UNIT_FAMILY[u]) return UNIT_FAMILY[u];
  const hit = Object.keys(UNIT_FAMILY).find(k => k.toLowerCase() === u.toLowerCase());
  return hit ? UNIT_FAMILY[hit] : '';
}

// Can a value for this parameter be given in another unit? false for a percentage, a
// per-unit value, an angle or a count; undefined while the data is not in (show the choice).
export function convertible(defn, param) {
  const u = unitOf(defn, param);
  if (u === undefined) return undefined;
  return !!familyOf(u);
}

// The tests set the data without a fetch.
export function _setForTests(defs, params) {
  defsRaw = defs || null;
  paramsRaw = params || null;
  defsP = Promise.resolve(defsRaw);
  paramsP = Promise.resolve(paramsRaw);
  announce();
}
