/* ============================================================
   SALARY MAP — script.js
   The Cost of Living Comparator, run from one city against every
   other city at once and drawn on a world map.

   The money is the comparator's own: the same dataset, the same
   index estimates, the same live exchange rates under the same
   cache key, the same required-salary formulas. Its maths is
   copied here function for function rather than shared, so this
   page can never move the comparator's figures, and
   _audit/run.mjs holds the two pages to the same answer for the
   same pair of cities.

   The map is the World Clock's (../../worldclock/zones.json, in
   the same plain Mercator), drawn on one canvas: land and borders,
   then a dot per city coloured by how dear it is against yours,
   then as many labels as fit.
   ============================================================ */
(function(){
'use strict';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

// ═══════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════
let CITIES = [];
const CITY_MAP = {};
let RATES = {};      // bundled: units per USD the indices were priced at
let LIVE = null;     // {rates, date, source, url}: market units per USD, or null
let META_COL = '', META_RATE = '', RATE_DATE = '';
let HEALTH_META = null;  // health_price_index.json's source line, for the footer
let COORDS = {};     // "city|country" -> [lat, lon, population]
let dataReady = false;

async function getJson(url){
  const r = await fetch(url);
  if(!r.ok) throw new Error(url + ': HTTP ' + r.status);
  return r.json();
}

async function loadData(){
  const [colJson, rateJson, coords, healthJson] = await Promise.all([
    getJson('../cost_of_living_indices_aggregated.json'),
    getJson('../currency_rates.json'),
    getJson('city_coords.json'),
    // The comparator's health prices (see its HEALTH PRICES note). Optional: a
    // failed load leaves the medical rows without an estimate.
    getJson('../health_price_index.json').catch(() => null),
  ]);
  const health = {};
  ((healthJson && healthJson.data) || []).forEach(d => { health[d.country] = d.health_ratio; });
  HEALTH_META = healthJson && healthJson.metadata || null;
  META_COL = parseMonthYear(colJson.metadata.updated_on);
  META_RATE = parseMonthYear(rateJson.metadata.updated_on);
  RATE_DATE = rateJson.metadata.updated_on || '';
  COORDS = coords;
  // The comparator's own reading of the file, field for field.
  CITIES = colJson.data.map(c => ({
    city: c.city,
    country: c.country,
    currency: c.currency,
    coli_no_housing: c.coli_no_housing,
    coli_with_housing: c.coli_with_housing,
    housing_index: c.housing_index,
    rent_index_med: c.rent_index && c.rent_index.med != null ? c.rent_index.med : null,
    groceries_index: c.groceries_index,
    eating_out_index: c.eating_out_index,
    lpp: c.local_purchasing_power_index,
    elec: c.utilities_index && c.utilities_index.electricity ? c.utilities_index.electricity.Median || null : null,
    water: c.utilities_index && c.utilities_index.water ? c.utilities_index.water.Median || null : null,
    gas: c.utilities_index && c.utilities_index.gas ? c.utilities_index.gas.Median || null : null,
    fuel: c.utilities_index && c.utilities_index.fuel ? c.utilities_index.fuel.Median || null : null,
    health: health[c.country] > 0 && c.coli_no_housing > 0 ? health[c.country] * c.coli_no_housing : null,
  })).filter(c => c.city && c.country);
  CITIES.sort((a, b) => a.city.localeCompare(b.city));
  CITIES.forEach(c => {
    CITY_MAP[c.city + '|' + c.country] = c;
    const co = COORDS[c.city + '|' + c.country];
    c.lat = co ? co[0] : null; c.lon = co ? co[1] : null; c.pop = co ? co[2] : 0;
  });
  rateJson.data.forEach(r => { RATES[r.currency] = r.usd_rate; });

  const saved = readLiveCache();
  if(saved) LIVE = saved.live;
  dataReady = true;
  updateDataText();
  init();
  if(!saved || Date.now() - saved.savedAt > LIVE_TTL) refreshLiveRates();
}

function parseMonthYear(dateStr){
  if(!dateStr) return '';
  const p = dateStr.split('-');
  return (MONTHS[parseInt(p[1], 10) - 1] || p[1]) + ' ' + p[0];
}
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function fmtDay(iso){
  const p = String(iso).split('-');
  return parseInt(p[2], 10) + ' ' + (MONTHS[parseInt(p[1], 10) - 1] || p[1]) + ' ' + p[0];
}

// ═══════════════════════════════════════════════════════════
// LIVE EXCHANGE RATES
// The comparator's feeds, screen and cache key, so the two pages quote one
// rate on one day and a rate fetched on either serves both. The bundled file
// stays the rate the indices were priced at; only money crossing a border
// moves at the market rate.
// ═══════════════════════════════════════════════════════════
const LIVE_KEY = 'costofliving-comparator:live-fx';
const LIVE_TTL = 6 * 3600 * 1000;
const LIVE_TIMEOUT = 8000;
const LIVE_SANITY = 5;
const LIVE_SOURCES = [
  {
    name: 'ExchangeRate-API',
    home: 'https://www.exchangerate-api.com',
    url: 'https://open.er-api.com/v6/latest/USD',
    parse: j => {
      if(!j || j.result !== 'success' || !j.rates) throw new Error('bad payload');
      return { date: new Date(j.time_last_update_unix * 1000).toISOString().slice(0, 10), rates: j.rates };
    }
  },
  ...['https://latest.currency-api.pages.dev/v1/currencies/usd.min.json',
      'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json'
  ].map(url => ({
    name: 'Fawaz Ahmed\'s Currency API',
    home: 'https://github.com/fawazahmed0/exchange-api',
    url,
    parse: j => {
      if(!j || !j.usd || !j.date) throw new Error('bad payload');
      const rates = {};
      Object.keys(j.usd).forEach(k => { rates[k.toUpperCase()] = j.usd[k]; });
      return { date: j.date, rates };
    }
  })),
];
function cleanLive(raw, src){
  if(!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date) || raw.date < RATE_DATE) return null;
  const rates = {};
  Object.keys(RATES).forEach(c => {
    const v = Number(raw.rates[c]), b = RATES[c];
    if(isFinite(v) && v > 0 && b > 0 && v/b < LIVE_SANITY && b/v < LIVE_SANITY) rates[c] = v;
  });
  if(!Object.keys(rates).length) return null;
  return { rates, date: raw.date, source: src.name, url: src.home };
}
function readLiveCache(){
  try {
    const raw = JSON.parse(localStorage.getItem(LIVE_KEY) || 'null');
    if(!raw || !raw.live || !raw.live.rates || !isFinite(raw.savedAt)) return null;
    const live = cleanLive(raw.live, { name: raw.live.source, home: raw.live.url });
    return live ? { live, savedAt: raw.savedAt } : null;
  } catch(e) { return null; }
}
async function fetchJson(url){
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const t = ctl ? setTimeout(() => ctl.abort(), LIVE_TIMEOUT) : 0;
  try {
    const res = await fetch(url, { cache: 'no-cache', signal: ctl ? ctl.signal : undefined });
    if(!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally { clearTimeout(t); }
}
async function refreshLiveRates(){
  for(const src of LIVE_SOURCES){
    try {
      const live = cleanLive(src.parse(await fetchJson(src.url)), src);
      if(!live) continue;
      if(LIVE && LIVE.date > live.date) return;
      LIVE = live;
      try { localStorage.setItem(LIVE_KEY, JSON.stringify({ savedAt: Date.now(), live })); } catch(e) {}
      updateDataText();
      requestRender();
      return;
    } catch(e) { /* next source */ }
  }
}
function updateDataText(){
  const el = $('dataUpdatedText');
  if(!el) return;
  el.textContent = 'Cost of living data updated ' + META_COL + '. ';
  if(LIVE){
    el.append('Live exchange rates as of ' + fmtDay(LIVE.date) + ', from ');
    const a = document.createElement('a');
    a.href = LIVE.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = LIVE.source;
    el.append(a, '.');
  } else {
    el.append('Exchange rates updated ' + META_RATE + ' (live rates unavailable).');
  }
  if(HEALTH_META){
    const a = document.createElement('a');
    a.href = HEALTH_META.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'World Bank ICP ' + HEALTH_META.year;
    el.append(' Health care prices from the ', a, '.');
  }
}

// ═══════════════════════════════════════════════════════════
// THE COMPARATOR'S MATHS
// Copied from ../script.js. Change both or neither: _audit/run.mjs replays
// every city from the raw files and against the comparator page itself.
// ═══════════════════════════════════════════════════════════
function getCity(key){ return key ? CITY_MAP[key] : null; }
function cityKey(c){ return c.city + '|' + c.country; }
function getRate(curr){ return RATES[curr] || 0; }
// fromCurr per 1 toCurr at today's market rate: the live feed when it has
// both currencies, else the bundled pair, never one of each. 0 when unknown.
function marketFx(fromCurr, toCurr){
  const lf = LIVE && LIVE.rates[fromCurr], lt = LIVE && LIVE.rates[toCurr];
  if(lf && lt) return lf / lt;
  const fr = getRate(fromCurr), tr = getRate(toCurr);
  return (fr && tr) ? fr / tr : 0;
}
const UTIL_PARTS = [['electricity','elec',0.5],['water','water',0.2],['gas','gas',0.3]];
function idxInfo(city, key){
  if(!city) return {idx: null, missing: []};
  const val = v => ({idx: (v != null && v > 0) ? v : null, missing: []});
  if(key === 'rent') return val(city.rent_index_med);
  if(key === 'groceries') return val(city.groceries_index);
  if(key === 'eating_out') return val(city.eating_out_index);
  if(key === 'electricity') return val(city.elec);
  if(key === 'water') return val(city.water);
  if(key === 'gas_util') return val(city.gas);
  if(key === 'fuel') return val(city.fuel);
  if(key === 'health') return val(city.health);
  if(key === 'coli_no_housing') return val(city.coli_no_housing);
  if(key === 'coli_with_housing') return val(city.coli_with_housing);
  if(key === 'currency_only') return {idx: 100, missing: []};
  if(key === 'utilities'){
    let acc = 0, wt = 0; const missing = [];
    UTIL_PARTS.forEach(([label, prop, w]) => {
      const v = city[prop];
      if(v != null && v > 0){ acc += w * v; wt += w; } else missing.push(label);
    });
    return {idx: wt > 0 ? acc / wt : null, missing};
  }
  return {idx: null, missing: []};
}
function getIdx(city, key){ return idxInfo(city, key).idx; }
// One expense row from one city to another, at the rate the indices were
// priced at. null when no honest estimate exists.
function convertExpense(amount, fromCity, toCity, indexKey){
  if(!fromCity || !toCity) return null;
  if(!amount) return 0;
  const fi = getIdx(fromCity, indexKey), ti = getIdx(toCity, indexKey);
  if(fi == null || ti == null || fi <= 0) return null;
  const fr = getRate(fromCity.currency), tr = getRate(toCity.currency);
  if(!fr || !tr) return null;
  return amount / fr * (ti / fi) * tr;
}
const CATS = [
  {id:'rent',        label:'Rent',                 index:'rent'},
  {id:'groceries',   label:'Groceries',            index:'groceries'},
  {id:'eating_out',  label:'Eating out',           index:'eating_out'},
  {id:'utilities',   label:'Utilities',            index:'utilities'},
  {id:'electricity', label:'Electricity',          index:'electricity'},
  {id:'water',       label:'Water',                index:'water'},
  {id:'gas_util',    label:'Gas',                  index:'gas_util'},
  {id:'fuel',        label:'Fuel',                 index:'fuel'},
  {id:'medical',     label:'Medical care',         index:'health'},
  {id:'health_insurance', label:'Health insurance', index:'health'},
  {id:'remittance',  label:'Remittance',           index:'currency_only'},
  {id:'intl_travel', label:'International travel', index:'currency_only'},
  {id:'other',       label:'Other',                index:'coli_no_housing'},
];
const catOf = id => CATS.find(c => c.id === id) || CATS[CATS.length - 1];

// ═══════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════
const VIEWS = {
  required: [['salary', 'Required net salary'], ['living', 'Living cost'], ['savings', 'Nominal savings'], ['ratio', 'Savings ratio']],
  global:   [['living', 'Living cost'], ['savings', 'Nominal savings'], ['ratio', 'Savings ratio']],
};
const VIEW_DEFAULT = { required: 'salary', global: 'savings' };
const S = {
  fromKey: '', salary: 0,
  detail: 'simple', expense: 0, housing: 'include',
  rows: [{catId: 'rent', amount: 0}],
  mode: 'required', target: 'ratio',
  views: clone(VIEW_DEFAULT),     // the view each mode was last left on
};
const S_DEFAULTS = clone(S);
let persist = null;

// Repairs a restored or hand-edited state so every field holds a value the
// page can draw.
function normalise(){
  const num = v => { const n = Number(v); return isFinite(n) && n > 0 ? n : 0; };
  if(!getCity(S.fromKey)) S.fromKey = '';
  S.salary = num(S.salary); S.expense = num(S.expense);
  if(S.detail !== 'detailed') S.detail = 'simple';
  if(S.housing !== 'exclude') S.housing = 'include';
  if(S.mode !== 'global') S.mode = 'required';
  if(S.target !== 'nominal') S.target = 'ratio';
  if(!Array.isArray(S.rows) || !S.rows.length) S.rows = clone(S_DEFAULTS.rows);
  S.rows = S.rows.map(r => ({catId: catOf(r && r.catId).id, amount: num(r && r.amount)}));
  if(!S.views || typeof S.views !== 'object') S.views = clone(VIEW_DEFAULT);
  ['required', 'global'].forEach(m => {
    if(!VIEWS[m].some(v => v[0] === S.views[m])) S.views[m] = VIEW_DEFAULT[m];
  });
}
const view = () => S.views[S.mode];
const fromExpense = () => S.detail === 'detailed' ? S.rows.reduce((s, r) => s + (r.amount || 0), 0) : (S.expense || 0);
const coliKey = () => S.housing === 'include' ? 'coli_with_housing' : 'coli_no_housing';

// ═══════════════════════════════════════════════════════════
// ENGINE
// Every city's month, worked out the way the comparator works out one
// column. All money is a month, net of tax.
//
//   E     the same lifestyle's cost there, in its own currency
//   fx    your currency per 1 of its currency, at today's market rate
//   Required salary mode, Savings ratio target:   salary = E / (1 - r)
//   Required salary mode, Nominal savings target: salary = E + savings / fx
//   Global salary mode:                           salary = your salary / fx
//
// where r is the share of pay you save now. Savings are salary - E, the ratio
// savings / salary. Every figure is shown in your currency (x fx) first.
//
// One number orders every view: q, the city's living cost in your currency
// over yours. Each view is a monotone function of it, so the dots are
// coloured on q alone and keep their colour as the view changes.
// ═══════════════════════════════════════════════════════════
function destExpense(from, to, fe){
  if(S.detail === 'detailed'){
    let tot = 0;
    for(const row of S.rows){
      const v = convertExpense(row.amount || 0, from, to, catOf(row.catId).index);
      if(v == null || !isFinite(v)) return null;
      tot += v;
    }
    return tot;
  }
  // The comparator's estDestExpense: a ratio of local prices.
  if(!fe) return 0;
  const ck = coliKey(), fi = getIdx(from, ck), ti = getIdx(to, ck);
  const fr = getRate(from.currency), tr = getRate(to.currency);
  const priced = (fr && tr) ? fr / tr : NaN;
  if(!fi || !ti || !isFinite(priced)) return null;
  return fe * (1 / priced) * (ti / fi);
}

let RESULT = null;
function compute(){
  const from = getCity(S.fromKey);
  if(!from || !CITIES.length) return null;
  const fc = from.currency;
  const fe = fromExpense(), sal = S.salary || 0, fSav = sal - fe;
  const r = sal > 0 ? fSav / sal : 0;
  const ready = sal > 0 && fe > 0;
  const rows = CITIES.map(c => {
    const o = { key: cityKey(c), c, cur: c.currency, home: c === from, E: null, fx: 0, sal: null, sav: null, ratio: null, q: null, neg: false };
    o.E = destExpense(from, c, fe);
    o.fx = marketFx(fc, c.currency);
    if(o.E == null || !(o.fx > 0)) return o;
    if(S.mode === 'global'){
      o.sal = sal / o.fx;
    } else if(S.target === 'ratio'){
      // A 100% ratio, or a city with nothing to spend, is matched at any
      // salary, so there is no single figure.
      o.sal = (o.E > 0 && r < 1) ? o.E / (1 - r) : null;
    } else {
      // Written as each comparator mode writes it, so the two agree to the
      // last binary digit: Simple multiplies by 1/rate, Detailed divides.
      o.sal = o.E + (S.detail === 'detailed' ? fSav / o.fx : fSav * (1 / o.fx));
    }
    if(o.sal != null){
      o.sav = o.sal - o.E;
      o.ratio = o.sal > 0 ? o.sav / o.sal : null;
    }
    if(fe > 0) o.q = o.E * o.fx / fe;
    // Below zero by more than rounding noise: the city costs more than the
    // salary that is kept in Global mode.
    o.neg = S.mode === 'global' && o.sav != null && o.sav < -1e-9 * Math.max(1, Math.abs(o.sal));
    return o;
  });
  const home = rows.find(o => o.home);
  const valid = rows.filter(o => o.q != null && isFinite(o.q) && o.sal != null);
  const byQ = valid.slice().sort((a, b) => a.q - b.q || a.c.city.localeCompare(b.c.city));
  const cheaper = valid.filter(o => !o.home && o.q < 1 - 5e-4).length;
  const dearer = valid.filter(o => !o.home && o.q > 1 + 5e-4).length;
  const short = valid.filter(o => o.neg).length;
  RESULT = { from, fc, fe, sal, fSav, r, ready, rows, home, valid, byQ, cheaper, dearer, short,
             nodata: rows.filter(o => o.q == null || o.sal == null).length };
  RESULT.scale = buildScale(RESULT);
  return RESULT;
}

// The figure a view shows for a city: [in your currency, in its own] or a
// ratio. null when the city has none.
function viewValue(o, v){
  v = v || view();
  if(v === 'ratio') return o.ratio == null ? null : { ratio: o.ratio };
  const local = v === 'salary' ? o.sal : v === 'living' ? o.E : o.sav;
  if(local == null || !isFinite(local) || !(o.fx > 0)) return null;
  return { from: local * o.fx, local };
}

// ═══════════════════════════════════════════════════════════
// COLOUR
// A diverging scale on log q around your city: blue for cheaper, amber for
// dearer, each arm stretched to its own most extreme city so the cheapest
// and the dearest wear the deepest shade. In Global salary mode a city whose
// costs outrun the salary takes the red arm instead, from break-even out to
// the dearest city.
// ═══════════════════════════════════════════════════════════
let C = {};
function readColors(){
  const cs = getComputedStyle(document.body), v = n => cs.getPropertyValue(n).trim();
  C = {
    sea: v('--cm-sea'), land: v('--cm-land'), border: v('--cm-border'), coast: v('--cm-coast'),
    label: v('--cm-label'), muted: v('--cm-label-muted'), halo: v('--cm-halo'),
    mid: v('--cm-mid'), home: v('--cm-home'), nodata: v('--cm-nodata'), ring: v('--cm-ring'), hover: v('--cm-hover'),
    cheap: [1, 2, 3].map(i => v('--cm-cheap-' + i)),
    dear: [1, 2, 3].map(i => v('--cm-dear-' + i)),
    neg: [1, 2, 3].map(i => v('--cm-neg-' + i)),
  };
}
function hexRgb(h){
  h = String(h).replace('#', '');
  if(h.length === 3) h = h.split('').map(x => x + x).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
// t in 0..1 along mid -> stop1 -> stop2 -> stop3.
function ramp(stops, t){
  const pts = [C.mid].concat(stops).map(hexRgb);
  t = Math.max(0, Math.min(1, t)) * 3;
  const i = Math.min(2, Math.floor(t)), f = t - i, a = pts[i], b = pts[i + 1];
  return 'rgb(' + a.map((x, j) => Math.round(x + (b[j] - x) * f)).join(',') + ')';
}
function buildScale(R){
  const qs = R.valid.map(o => o.q).filter(q => q > 0);
  const lo = Math.min(1, ...qs), hi = Math.max(1, ...qs);
  // In Global mode the break-even q is salary over living cost.
  const qb = S.mode === 'global' && R.fe > 0 ? R.sal / R.fe : Infinity;
  const dearTop = Math.max(1, Math.min(hi, qb));
  return { lo, hi, qb, dearTop };
}
// 0..1 along an arm. Mid-scale cities get a slight lift (t^0.8) so a city
// 10% off yours already reads as a colour.
const lift = t => Math.pow(Math.max(0, Math.min(1, t)), 0.8);
function colorOf(o){
  const R = RESULT, sc = R && R.scale;
  if(!sc || o.q == null || o.sal == null || !(o.q > 0)) return null;
  if(o.neg){
    const span = Math.log(sc.hi / sc.qb);
    return ramp(C.neg, span > 0 ? 0.25 + 0.75 * lift(Math.log(o.q / sc.qb) / span) : 1);
  }
  if(o.q < 1){
    const span = Math.log(sc.lo);
    return span < 0 ? ramp(C.cheap, lift(Math.log(o.q) / span)) : C.mid;
  }
  const span = Math.log(sc.dearTop);
  return span > 0 ? ramp(C.dear, lift(Math.log(o.q) / span)) : C.mid;
}
// Which arm a city is on, for the audit and the legend: cheap, dear, neg, mid.
function armOf(o){
  if(o.q == null || o.sal == null) return 'nodata';
  if(o.neg) return 'neg';
  if(o.q < 1 - 5e-4) return 'cheap';
  if(o.q > 1 + 5e-4) return 'dear';
  return 'mid';
}

// ═══════════════════════════════════════════════════════════
// FORMATTERS
// ═══════════════════════════════════════════════════════════
function fmtN(v, d = 0){
  if(v == null || !isFinite(v)) return '—';
  return Number(v).toLocaleString('en-AU', {minimumFractionDigits: d, maximumFractionDigits: d});
}
function fmtC(v, curr, compact){
  if(v == null || !isFinite(v)) return '—';
  const n = Number(v), abs = Math.abs(n), sign = n < 0 ? '-' : '';
  if(compact && abs >= 1e9) return sign + curr + ' ' + (abs / 1e9).toFixed(1) + 'B';
  if(compact && abs >= 1e6) return sign + curr + ' ' + (abs / 1e6).toFixed(abs >= 1e8 ? 0 : 1) + 'M';
  if(compact && abs >= 1e5) return sign + curr + ' ' + Math.round(abs / 1e3) + 'K';
  return sign + curr + ' ' + fmtN(abs);
}
const fmtP = (v, d = 1) => (v != null && isFinite(v)) ? (v * 100).toFixed(d) + '%' : '—';
// "23% cheaper than Perth" from q.
function relText(o, homeName){
  if(o.home) return 'Your city, the baseline';
  if(o.q == null) return '';
  const d = o.q - 1;
  if(Math.abs(d) < 5e-4) return 'Same living cost as ' + homeName;
  return Math.round(Math.abs(d) * 100) + '% ' + (d < 0 ? 'cheaper' : 'dearer') + ' than ' + homeName;
}
const pctRel = q => (q < 1 ? '-' : '+') + Math.round(Math.abs(q - 1) * 100) + '%';

// ═══════════════════════════════════════════════════════════
// MONEY FIELDS
// ═══════════════════════════════════════════════════════════
const MONEY_FMT = {maxDecimals: 2};
function parseNum(val){
  if(typeof val === 'number') return isFinite(val) ? val : 0;
  const n = Number(String(val == null ? '' : val).replace(/,/g, '').replace(/[^\d.]/g, ''));
  return isFinite(n) ? n : 0;
}
const moneyText = n => n > 0 ? Number(n).toLocaleString('en-AU', {minimumFractionDigits: 0, maximumFractionDigits: 2}) : '';
function wireMoney(el, onValue){
  el.addEventListener('input', () => {
    if(String(el.value).trim() !== '') SharedFmt.liveFormat(el, MONEY_FMT);
    onValue(parseNum(el.value));
    requestRender();
  });
  // SharedBounds pulls a value past data-max back on change; follow it.
  el.addEventListener('change', () => { onValue(parseNum(el.value)); requestRender(); });
  el.addEventListener('blur', () => { el.value = moneyText(parseNum(el.value)); });
}

// ═══════════════════════════════════════════════════════════
// CITY PICKER (the comparator's searchable combobox)
// ═══════════════════════════════════════════════════════════
function placeOpenCityDrops(){ document.querySelectorAll('.city-dropdown.open').forEach(d => d._place && d._place()); }
window.addEventListener('scroll', placeOpenCityDrops, {passive: true, capture: true});
window.addEventListener('resize', placeOpenCityDrops, {passive: true});
function buildCityPicker(containerId, currentKey, onSelect){
  const wrap = $(containerId);
  if(!wrap) return;
  const current = getCity(currentKey);
  const input = document.createElement('input');
  input.type = 'text'; input.className = 'city-search combo-input txt-input'; input.placeholder = 'Search city…';
  input.autocomplete = 'off'; input.id = 'fromSearch';
  input.setAttribute('aria-label', 'Your city');
  if(current){ input.value = current.city + ', ' + current.country; input.classList.add('has-value'); }
  const drop = document.createElement('div');
  drop.className = 'city-dropdown combo-list';
  drop.setAttribute('role', 'listbox');
  const btnClear = document.createElement('button');
  btnClear.type = 'button'; btnClear.className = 'city-clear'; btnClear.innerHTML = SharedIcon.svg('clear');
  btnClear.setAttribute('tabindex', '-1'); btnClear.setAttribute('aria-label', 'Clear'); btnClear.title = 'Clear';
  btnClear.addEventListener('mousedown', e => {
    e.preventDefault();
    input.value = ''; input.classList.remove('has-value');
    drop.classList.remove('open');
    onSelect(null);
    input.focus();
  });
  wrap.innerHTML = ''; wrap.appendChild(input); wrap.appendChild(btnClear); wrap.appendChild(drop);
  let focusIdx = -1;
  function renderDrop(q){
    const terms = q.toLowerCase().split(/[\s,]+/).filter(Boolean);
    const filtered = CITIES.filter(c => {
      const hay = (c.city + ' ' + c.country + ' ' + c.currency).toLowerCase();
      return terms.every(t => hay.includes(t));
    }).slice(0, 60);
    const curKey = current ? cityKey(current) : '';
    drop.innerHTML = filtered.length
      ? filtered.map((c, i) => { const k = cityKey(c); return `<div class="city-opt combo-opt${k === curKey ? ' selected' : ''}" role="option" data-key="${esc(k)}" data-idx="${i}"><span class="combo-main">${esc(c.city)}</span><span class="combo-chip" title="${esc(c.country)}">${esc(c.country)}</span></div>`; }).join('')
      : '<div class="combo-empty">No city matches</div>';
    focusIdx = -1;
    drop.querySelectorAll('.city-opt').forEach(el => {
      el.addEventListener('mousedown', e => {
        e.preventDefault();
        const city = getCity(el.dataset.key);
        input.value = city.city + ', ' + city.country; input.classList.add('has-value');
        drop.classList.remove('open');
        input.blur();
        onSelect(el.dataset.key);
      });
    });
  }
  function placeDrop(){ if(drop.classList.contains('open')) SharedDropdown.place(input, drop, {minWidth: 300, maxHeight: 260}); }
  drop._place = placeDrop;
  function openDrop(){ drop.classList.add('open'); placeDrop(); }
  input.addEventListener('focus', () => { input.select(); renderDrop(''); openDrop(); });
  input.addEventListener('input', () => { renderDrop(input.value); openDrop(); input.classList.remove('has-value'); });
  input.addEventListener('blur', () => setTimeout(() => {
    drop.classList.remove('open');
    const c = getCity(S.fromKey);
    input.value = c ? c.city + ', ' + c.country : '';
    input.classList.toggle('has-value', !!c);
  }, 150));
  input.addEventListener('keydown', e => {
    const opts = drop.querySelectorAll('.city-opt');
    if(e.key === 'ArrowDown'){ e.preventDefault(); focusIdx = Math.min(focusIdx + 1, opts.length - 1); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); focusIdx = Math.max(focusIdx - 1, -1); }
    else if(e.key === 'Enter'){ e.preventDefault(); const o = opts[focusIdx < 0 ? 0 : focusIdx]; if(o) o.dispatchEvent(new MouseEvent('mousedown')); return; }
    else if(e.key === 'Escape'){ input.blur(); return; }
    opts.forEach((o, i) => o.classList.toggle('focused', i === focusIdx));
    if(focusIdx >= 0) opts[focusIdx].scrollIntoView({block: 'nearest'});
  });
}
function mountFromPicker(){
  buildCityPicker('fromPicker', S.fromKey, key => {
    S.fromKey = key || '';
    clearPresetMark();
    syncInputs();
    requestRender();
    if(key && mapReady) flyTo(homeTransform(), 900);
  });
}

// ═══════════════════════════════════════════════════════════
// INPUTS
// ═══════════════════════════════════════════════════════════
const TIPS = {
  detail: {
    simple: '<strong>Simple:</strong> one monthly figure, scaled by each city\'s overall cost-of-living index.',
    detailed: '<strong>Detailed:</strong> rent, groceries, utilities and more as separate rows, each scaled by its own index.',
  },
  housing: {
    include: '<strong>Include:</strong> rent or a mortgage is part of your living cost, scaled by the index with housing.',
    exclude: '<strong>Exclude:</strong> your living cost leaves housing out, as when an employer pays for it.',
  },
  mode: {
    required: '<strong>Required salary:</strong> the net salary each city needs for your lifestyle and your savings target.',
    global: '<strong>Global salary:</strong> your own salary in every city, at today\'s exchange rate, and what it leaves you after the same lifestyle.',
  },
  target: {
    ratio: '<strong>Savings ratio:</strong> each city\'s salary saves the same share of pay as you save now.',
    nominal: '<strong>Nominal savings:</strong> each city\'s salary saves the same amount as you save now, at today\'s exchange rate.',
  },
};
function setSeg(groupId, val){
  document.querySelectorAll('#' + groupId + ' .seg-btn').forEach(b => {
    const on = b.dataset.val === val;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}
function syncInputs(){
  const from = getCity(S.fromKey);
  const cur = from ? from.currency : '';
  document.querySelectorAll('.cur-tag').forEach(t => { t.textContent = cur || '¤'; });
  $('fromCurrNote').textContent = from ? 'Every figure leads with ' + cur + ', the ' + from.city + ' currency.' : 'Its currency is the one every figure leads with.';
  if(document.activeElement !== $('salary')) $('salary').value = moneyText(S.salary);
  if(document.activeElement !== $('expense')) $('expense').value = moneyText(S.expense);
  setSeg('detailGroup', S.detail); setSeg('housingGroup', S.housing);
  setSeg('modeGroup', S.mode); setSeg('targetGroup', S.target);
  $('detailTip').setAttribute('data-tip', TIPS.detail[S.detail]);
  $('housingTip').setAttribute('data-tip', TIPS.housing[S.housing]);
  $('modeTip').setAttribute('data-tip', TIPS.mode[S.mode]);
  $('targetTip').setAttribute('data-tip', TIPS.target[S.target]);
  $('simpleBox').hidden = S.detail !== 'simple';
  $('detailBox').hidden = S.detail !== 'detailed';
  $('targetRow').hidden = S.mode !== 'required';
  renderRows();
  renderViewSeg();
}
function renderRows(){
  const box = $('rows'), cur = (getCity(S.fromKey) || {}).currency || '¤';
  const active = document.activeElement;
  if(active && box.contains(active) && active.classList.contains('row-amt')) { updateRowsTotal(); return; }
  box.innerHTML = S.rows.map((r, i) => `
    <div class="exp-row" data-i="${i}">
      <select class="row-cat" aria-label="Category of row ${i + 1}">${CATS.map(c => `<option value="${c.id}"${c.id === r.catId ? ' selected' : ''}>${c.label}</option>`).join('')}</select>
      <div class="currency-wrap"><span class="prefix cur-tag">${esc(cur)}</span><input class="currency-input row-amt" type="text" inputmode="decimal" data-min="0" data-max="100000000000" placeholder="0" autocomplete="off" value="${moneyText(r.amount)}" aria-label="${esc(catOf(r.catId).label)} a month"/></div>
      ${S.rows.length > 1 ? SharedIcon.button('trash', 'Remove this row', 'row-del', `data-i="${i}"`) : '<span></span>'}
    </div>`).join('');
  box.querySelectorAll('.exp-row').forEach(el => {
    const i = +el.dataset.i;
    el.querySelector('.row-cat').addEventListener('change', e => { S.rows[i].catId = catOf(e.target.value).id; clearPresetMark(); syncInputs(); requestRender(); });
    wireMoney(el.querySelector('.row-amt'), v => { S.rows[i].amount = v; clearPresetMark(); updateRowsTotal(); });
    const del = el.querySelector('.row-del');
    if(del) del.addEventListener('click', () => { S.rows.splice(i, 1); clearPresetMark(); syncInputs(); requestRender(); });
  });
  updateRowsTotal();
}
function updateRowsTotal(){
  const cur = (getCity(S.fromKey) || {}).currency || '¤';
  $('rowsTotal').innerHTML = '<span>Living cost</span><strong>' + fmtC(fromExpense(), cur) + ' /mo</strong>';
}
function renderViewSeg(){
  const g = $('viewGroup');
  const want = VIEWS[S.mode].map(v => v[0]).join(',');
  if(g.dataset.views !== want){
    g.dataset.views = want;
    g.innerHTML = VIEWS[S.mode].map(([k, l]) => `<button class="seg-btn" type="button" data-val="${k}">${l}</button>`).join('');
  }
  setSeg('viewGroup', view());
}
function wireInputs(){
  wireMoney($('salary'), v => { S.salary = v; clearPresetMark(); });
  wireMoney($('expense'), v => { S.expense = v; clearPresetMark(); });
  const seg = (id, fn) => $(id).addEventListener('click', e => {
    const b = e.target.closest('.seg-btn');
    if(!b) return;
    fn(b.dataset.val);
    syncInputs();
    requestRender();
  });
  seg('detailGroup', v => { S.detail = v; clearPresetMark(); });
  seg('housingGroup', v => { S.housing = v; clearPresetMark(); });
  seg('modeGroup', v => { S.mode = v; clearPresetMark(); });
  seg('targetGroup', v => { S.target = v; clearPresetMark(); });
  seg('viewGroup', v => { S.views[S.mode] = v; });
  $('addRow').addEventListener('click', () => {
    const used = new Set(S.rows.map(r => r.catId));
    const next = CATS.find(c => !used.has(c.id)) || catOf('other');
    S.rows.push({catId: next.id, amount: 0});
    clearPresetMark(); syncInputs(); requestRender();
    const amts = document.querySelectorAll('#rows .row-amt');
    if(amts.length) amts[amts.length - 1].focus();
  });
  $('themeToggle').addEventListener('click', () => {
    document.body.classList.toggle('light');
    $('themeToggle').textContent = document.body.classList.contains('light') ? '🌙 Dark' : '☀️ Light';
    readColors();
    requestRender();
  });
}

// ═══════════════════════════════════════════════════════════
// QUICK START
// A single professional's month, net of tax, in each home city's currency,
// leaving a round savings ratio. Five are the comparator's own budgets; Perth
// is a one-bedroom renter driving to work. Each opens from the defaults.
// ═══════════════════════════════════════════════════════════
const QUICK_START = {
  sg:  {from: ['Singapore', 'Singapore'], salary: 8000,
        rows: [['rent', 3500], ['groceries', 600], ['eating_out', 700], ['utilities', 200], ['other', 1000]]},
  jkt: {from: ['Jakarta', 'Indonesia'], salary: 25000000,
        rows: [['rent', 7000000], ['groceries', 3000000], ['eating_out', 2500000], ['utilities', 1200000], ['fuel', 800000], ['other', 3000000]]},
  per: {from: ['Perth', 'Australia'], salary: 6500,
        rows: [['rent', 2400], ['groceries', 600], ['eating_out', 400], ['utilities', 250], ['fuel', 250], ['other', 650]]},
  nyc: {from: ['New York, NY', 'United States'], salary: 8500,
        rows: [['rent', 4000], ['groceries', 600], ['eating_out', 700], ['utilities', 200], ['other', 1300]]},
  lon: {from: ['London', 'United Kingdom'], salary: 4500,
        rows: [['rent', 2100], ['groceries', 350], ['eating_out', 400], ['utilities', 250], ['other', 500]]},
  dxb: {from: ['Dubai', 'United Arab Emirates'], salary: 30000,
        rows: [['rent', 9000], ['groceries', 2000], ['eating_out', 2000], ['utilities', 800], ['fuel', 400], ['other', 3800]]},
};
function applyQuickStart(id){
  const q = QUICK_START[id];
  if(!q || !CITIES.length) return;
  Object.keys(S).forEach(k => { delete S[k]; });
  Object.assign(S, clone(S_DEFAULTS));
  const c = CITIES.find(x => x.city === q.from[0] && x.country === q.from[1]);
  S.fromKey = c ? cityKey(c) : '';
  S.salary = q.salary;
  S.detail = 'detailed';
  S.rows = q.rows.map(([catId, amount]) => ({catId, amount}));
  // The same budget as one figure, for a reader who switches to Simple.
  S.expense = S.rows.reduce((s, r) => s + r.amount, 0);
  mountFromPicker();
  syncInputs();
  document.querySelectorAll('.quick-start-btn').forEach(b => b.classList.toggle('active', b.dataset.preset === id));
  render();
  if(persist) persist.save();
  if(mapReady) flyTo(homeTransform(), 900);
}
function clearPresetMark(){ document.querySelectorAll('.quick-start-btn.active').forEach(b => b.classList.remove('active')); }

// ═══════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════
let renderQueued = false;
function requestRender(){
  if(renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; render(); });
}
function render(){
  if(!dataReady) return;
  normalise();
  if(persist) persist.schedule();
  compute();
  renderVerdict();
  renderMetrics();
  renderMapHead();
  renderTable();
  renderAssumptions();
  if(cardKey) renderCard();
  requestDraw();
}

const VIEW_WORD = { salary: 'net salary', living: 'living cost', savings: 'savings', ratio: 'savings ratio' };
function mapTitle(){
  const R = RESULT, v = view();
  if(S.mode === 'global'){
    const on = R && R.sal > 0 ? ' on ' + fmtC(R.sal, R.fc) : '';
    return { living: 'Living cost', savings: 'Nominal savings' + on, ratio: 'Savings ratio' + on }[v] + (v === 'ratio' ? '' : ', a month');
  }
  return { salary: 'Required net salary', living: 'Living cost', savings: 'Nominal savings', ratio: 'Savings ratio' }[v] + (v === 'ratio' ? '' : ', a month');
}

function renderVerdict(){
  const R = RESULT;
  if(!R){ SharedVerdict.set('verdict', { tone: '', title: 'Pick your city to map the world against it.', body: 'Then enter your net salary and living cost, or press a Quick Start.' }); return; }
  const name = R.from.city, fc = R.fc;
  if(!(R.sal > 0) || !(R.fe > 0)){
    SharedVerdict.set('verdict', { tone: '', title: 'Enter your ' + (!(R.sal > 0) && !(R.fe > 0) ? 'net salary and living cost' : !(R.sal > 0) ? 'net salary' : 'living cost') + ' in ' + esc(name) + ' to fill the map.', body: 'Every city then shows what it takes to live as you do.' });
    return;
  }
  const lo = R.byQ[0], hi = R.byQ[R.byQ.length - 1];
  if(!lo || !hi){ SharedVerdict.set('verdict', { tone: '', title: 'No city can be estimated from ' + esc(name) + '.', body: 'The dataset lacks an index your lifestyle needs.' }); return; }
  const num = (v, c) => '<span class="v-num">' + fmtC(v, c) + '</span>';
  const others = R.valid.length - 1;
  const short = R.fSav < 0 ? ' Your living cost is more than your salary, so every figure carries that shortfall.' : '';
  if(S.mode === 'global'){
    const fs = o => o.sav * o.fx;
    const loS = fs(lo), hiS = fs(hi);
    const title = 'On ' + num(R.sal, fc) + ' a month, you would save the most in ' + esc(lo.c.city) + ', ' + num(loS, fc) +
      (hiS < 0 ? ', and fall furthest short in ' + esc(hi.c.city) + ', by ' + num(-hiS, fc) + ' a month.'
               : ', and the least in ' + esc(hi.c.city) + ', ' + num(hiS, fc) + '.');
    let body = 'In ' + esc(name) + ' you save ' + fmtC(R.fSav, fc) + ' (' + fmtP(R.r) + '). ' +
      R.cheaper + ' of ' + others + ' cities let you save more' +
      (R.short ? '; in ' + R.short + ' your salary does not cover the same lifestyle.' : ', and your salary covers the lifestyle in every one.');
    SharedVerdict.set('verdict', { tone: '', title, body: body + short });
    return;
  }
  const keep = S.target === 'ratio' ? 'keep your ' + fmtP(R.r) + ' savings ratio' : 'keep saving ' + num(R.fSav, fc) + ' a month';
  const fv = o => o.sal * o.fx;
  const title = 'To live as you do and ' + keep + ', you need ' + num(fv(lo), fc) + ' a month in ' + esc(lo.c.city) +
    ' and ' + num(fv(hi), fc) + ' in ' + esc(hi.c.city) + ', against ' + num(R.sal, fc) + ' in ' + esc(name) + '.';
  const body = R.cheaper + ' of ' + others + ' cities need less than you earn now and ' + R.dearer + ' need more. ' +
    'Hover or tap a city for its figures.';
  SharedVerdict.set('verdict', { tone: R.fSav < 0 ? 'warn' : '', title, body: body + short });
}

function setMetric(i, label, value, sub, neg){
  $('mLabel' + i).textContent = label;
  const v = $('mVal' + i);
  v.innerHTML = value;
  v.classList.toggle('neg', !!neg);
  $('mSub' + i).innerHTML = sub || '';
}
function fmtView(o, v, compact){
  const x = viewValue(o, v);
  if(!x) return '—';
  if('ratio' in x) return fmtP(x.ratio);
  return fmtC(x.from, RESULT.fc, compact);
}
function localOf(o, v){
  const x = viewValue(o, v);
  if(!x || 'ratio' in x || o.cur === RESULT.fc) return '';
  return '<span class="nowrap">(' + fmtC(x.local, o.cur) + ')</span>';
}
function renderMetrics(){
  const R = RESULT;
  if(!R || !R.ready || !R.byQ.length){
    ['Your city', 'Cheapest', 'Dearest', 'Cheaper than you'].forEach((l, i) => setMetric(i, l, '—', ''));
    return;
  }
  const v = view(), lo = R.byQ[0], hi = R.byQ[R.byQ.length - 1], others = R.valid.length - 1;
  const isNeg = o => { const x = viewValue(o, v); return !!x && ('ratio' in x ? x.ratio < 0 : x.from < 0); };
  if(S.mode === 'global'){
    setMetric(0, 'Your salary', fmtC(R.sal, R.fc), 'Saves ' + fmtC(R.fSav, R.fc) + ' in ' + esc(R.from.city) + ' (' + fmtP(R.r) + ')', false);
    setMetric(1, 'Saves the most', fmtView(lo, v), esc(lo.c.city) + ', ' + esc(lo.c.country) + ' ' + localOf(lo, v), isNeg(lo));
    setMetric(2, hi.neg ? 'Falls furthest short' : 'Saves the least', fmtView(hi, v), esc(hi.c.city) + ', ' + esc(hi.c.country) + ' ' + localOf(hi, v), isNeg(hi));
    setMetric(3, 'Falls short in', R.short + ' of ' + others, R.short ? 'cities where ' + fmtC(R.sal, R.fc) + ' does not cover the lifestyle' : 'Your salary covers it everywhere', R.short > 0);
    return;
  }
  setMetric(0, 'Your city', fmtView(R.home, v), esc(R.from.city) + ', the baseline', isNeg(R.home));
  setMetric(1, 'Cheapest', fmtView(lo, v), esc(lo.c.city) + ', ' + esc(lo.c.country) + ' ' + localOf(lo, v), isNeg(lo));
  setMetric(2, 'Dearest', fmtView(hi, v), esc(hi.c.city) + ', ' + esc(hi.c.country) + ' ' + localOf(hi, v), isNeg(hi));
  setMetric(3, 'Cheaper than ' + R.from.city, R.cheaper + ' of ' + others, R.dearer + ' cities are dearer', false);
}

function renderMapHead(){
  const R = RESULT, v = view();
  $('mapTitle').textContent = mapTitle();
  // A view that is the target itself reads the same in every city.
  let note = '';
  if(R && R.ready && S.mode === 'required' && S.target === 'ratio' && v === 'ratio')
    note = 'Savings ratio is your target, so every city keeps your ' + fmtP(R.r) + '. The colours still show living cost against ' + R.from.city + '.';
  if(R && R.ready && S.mode === 'required' && S.target === 'nominal' && v === 'savings')
    note = 'Nominal savings is your target, so every city keeps your ' + fmtC(R.fSav, R.fc) + ' a month. The colours still show living cost against ' + R.from.city + '.';
  $('mapNote').hidden = !note;
  $('mapNote').textContent = note;
  renderLegend();
}
function renderLegend(){
  const R = RESULT, el = $('legend');
  if(!R || !R.ready || !R.byQ.length){
    el.innerHTML = '<div class="lg-keys"><span class="lg-key"><span class="lg-dot nodata"></span>Pick your city and enter your salary and living cost to colour the map.</span></div>';
    return;
  }
  const sc = R.scale, name = esc(R.from.city);
  const steps = (stops, n, from, to) => Array.from({length: n}, (_, i) => ramp(stops, from + (to - from) * (i + 0.5) / n));
  const cheapCols = steps(C.cheap, 6, 1, 0), dearCols = steps(C.dear, 6, 0, 1);
  const negOn = S.mode === 'global' && R.short > 0;
  // Each arm's width follows its share of the log range, so the bar reads
  // like the scale it stands for.
  const lc = Math.max(0, -Math.log(sc.lo)), ld = Math.max(0, Math.log(sc.dearTop)), ln = negOn ? Math.max(0, Math.log(sc.hi / sc.qb)) : 0;
  const tot = (lc + ld + ln) || 1;
  const seg = (cols, w) => cols.map(c => `<span style="background:${c};width:${(w / cols.length * 100 / tot).toFixed(3)}%"></span>`).join('');
  const bar = seg(cheapCols, lc) + seg(dearCols, ld) + (negOn ? seg(steps(C.neg, 6, 0.25, 1), ln) : '');
  // Your city sits where the arms meet; its tick is kept clear of the ends.
  const at = lc / tot * 100, tickAt = Math.max(24, Math.min(76, at));
  el.innerHTML = `
    <div class="lg-scale">
      <div class="lg-title">Living cost against ${name}, for the same lifestyle</div>
      <div class="lg-barwrap"><div class="lg-bar" aria-hidden="true">${bar}</div><span class="lg-mark" style="left:${at.toFixed(2)}%"></span></div>
      <div class="lg-ticks"><span class="t-lo">${pctRel(sc.lo)} cheapest</span><span class="t-mid" style="left:${tickAt.toFixed(2)}%">${name}</span><span class="t-hi">dearest ${pctRel(sc.hi)}</span></div>
    </div>
    <div class="lg-keys">
      <span class="lg-key"><span class="lg-dot" style="background:${ramp(C.cheap, 1)}"></span>Cheaper</span>
      <span class="lg-key"><span class="lg-dot" style="background:${ramp(C.dear, 1)}"></span>Dearer</span>
      ${negOn ? `<span class="lg-key"><span class="lg-tri"></span>Salary does not cover it</span>` : ''}
      <span class="lg-key"><span class="lg-dot home"></span>${name}</span>
      ${R.nodata ? `<span class="lg-key"><span class="lg-dot nodata"></span>No estimate (${R.nodata})</span>` : ''}
    </div>`;
  // On a narrow legend your city's name would run into an end label; the
  // mark on the bar and the key below still say where it is.
  const mid = el.querySelector('.t-mid'), a = mid.getBoundingClientRect();
  if(['.t-lo', '.t-hi'].some(s => { const b = el.querySelector(s).getBoundingClientRect(); return a.left < b.right + 6 && a.right + 6 > b.left; })) mid.hidden = true;
}

// ── Table ────────────────────────────────────────────────────────────────
const COLS = () => {
  const fc = RESULT ? RESULT.fc : '';
  const salHead = S.mode === 'global' ? 'Your salary there' : 'Net salary needed';
  return [
    {k: 'city', h: 'City'}, {k: 'country', h: 'Country'},
    {k: 'salF', h: salHead + ' (' + fc + ')', num: 1}, {k: 'salL', h: salHead + ' (local)', num: 1},
    {k: 'liveF', h: 'Living cost (' + fc + ')', num: 1}, {k: 'liveL', h: 'Living cost (local)', num: 1},
    {k: 'savF', h: 'Savings (' + fc + ')', num: 1}, {k: 'ratio', h: 'Savings ratio', num: 1},
    {k: 'rel', h: 'Living cost vs ' + (RESULT ? RESULT.from.city : 'yours'), num: 1},
  ];
};
let tableFilter = '';
function tableRowsOrdered(){
  const R = RESULT;
  if(!R) return [];
  const rest = R.rows.filter(o => !R.valid.includes(o)).sort((a, b) => a.c.city.localeCompare(b.c.city));
  return R.byQ.concat(rest);
}
function renderTable(){
  const R = RESULT, cols = COLS();
  $('tableHead').innerHTML = cols.map(c => `<th class="${c.num ? 'num' : ''}">${esc(c.h)}</th>`).join('');
  if(!R || !R.ready){
    $('tableRows').innerHTML = `<tr><td colspan="${cols.length}" class="ctry">Pick your city and enter your salary and living cost.</td></tr>`;
    return;
  }
  const terms = tableFilter.toLowerCase().split(/[\s,]+/).filter(Boolean);
  const fc = R.fc;
  const html = tableRowsOrdered().filter(o => {
    if(!terms.length) return true;
    const hay = (o.c.city + ' ' + o.c.country + ' ' + o.cur).toLowerCase();
    return terms.every(t => hay.includes(t));
  }).map(o => {
    const col = colorOf(o);
    const sw = col ? `<span class="sw" style="background:${col}"></span>` : '<span class="sw" style="border:1.5px solid var(--cm-nodata)"></span>';
    const money = (v, c) => v == null || !isFinite(v) ? '—' : `<span class="${v < 0 ? 'neg' : ''}">${fmtC(v, c)}</span>`;
    const ok = o.sal != null && o.fx > 0;
    return `<tr data-key="${esc(o.key)}" class="${o.home ? 'home' : ''}">
      <td class="name">${sw}${esc(o.c.city)}</td><td class="ctry">${esc(o.c.country)}</td>
      <td class="num">${ok ? money(o.sal * o.fx, fc) : '—'}</td><td class="num">${ok ? money(o.sal, o.cur) : '—'}</td>
      <td class="num">${o.E != null && o.fx > 0 ? money(o.E * o.fx, fc) : '—'}</td><td class="num">${o.E != null ? money(o.E, o.cur) : '—'}</td>
      <td class="num">${ok && o.sav != null ? money(o.sav * o.fx, fc) : '—'}</td>
      <td class="num">${o.ratio != null ? `<span class="${o.ratio < 0 ? 'neg' : ''}">${fmtP(o.ratio)}</span>` : '—'}</td>
      <td class="num">${o.home ? 'baseline' : o.q != null ? pctRel(o.q) : 'no estimate'}</td>
    </tr>`;
  }).join('');
  $('tableRows').innerHTML = html || `<tr><td colspan="${cols.length}" class="ctry">No city matches.</td></tr>`;
}
function wireTable(){
  $('tableFind').addEventListener('input', e => { tableFilter = e.target.value; renderTable(); });
  $('tableRows').addEventListener('click', e => {
    const tr = e.target.closest('tr[data-key]');
    if(!tr || !mapReady) return;
    const o = RESULT && RESULT.rows.find(x => x.key === tr.dataset.key);
    if(!o || o.c.lat == null) return;
    $('mapCard').scrollIntoView({behavior: reduceMotion ? 'auto' : 'smooth', block: 'center'});
    flyTo(cityTransform(o.c), 900).then(() => {
      const [x, y] = screenOf(o.c);
      showCard(o.key, x, y, true);
    });
  });
  $('csvBtn').addEventListener('click', downloadCsv);
  SharedFold.attach($('tableCard'), { key: 'costofliving-map', bodies: [$('tableBody')] });
}
function downloadCsv(){
  const R = RESULT;
  if(!R || !R.ready) return;
  const fc = R.fc, n = v => v == null || !isFinite(v) ? '' : (Math.round(v * 100) / 100).toFixed(2);
  const head = ['City', 'Country', 'Currency', (S.mode === 'global' ? 'Salary' : 'Net salary needed') + ' (' + fc + ')', 'Salary (local)',
    'Living cost (' + fc + ')', 'Living cost (local)', 'Savings (' + fc + ')', 'Savings (local)', 'Savings ratio (%)',
    'Living cost vs ' + R.from.city + ' (%)', fc + ' per 1 local'];
  const q = s => /[",\n]/.test(s) ? '"' + String(s).replace(/"/g, '""') + '"' : s;
  const lines = [head.map(q).join(',')].concat(tableRowsOrdered().map(o => {
    const ok = o.sal != null && o.fx > 0;
    return [o.c.city, o.c.country, o.cur,
      ok ? n(o.sal * o.fx) : '', ok ? n(o.sal) : '',
      o.E != null && o.fx > 0 ? n(o.E * o.fx) : '', o.E != null ? n(o.E) : '',
      ok && o.sav != null ? n(o.sav * o.fx) : '', ok && o.sav != null ? n(o.sav) : '',
      o.ratio != null ? n(o.ratio * 100) : '', o.q != null ? n((o.q - 1) * 100) : '', o.fx > 0 ? String(o.fx) : ''].map(q).join(',');
  }));
  const blob = new Blob([lines.join('\n') + '\n'], {type: 'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'salary-map-' + R.from.city.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase() + '.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ── What this assumes ────────────────────────────────────────────────────
function renderAssumptions(){
  const ul = $('assumptions'), R = RESULT, items = [];
  if(!R){
    items.push('<strong>Pick your city</strong> to see what the map rests on.');
  } else {
    const fc = R.fc, name = esc(R.from.city), updated = META_COL ? ', updated ' + META_COL : '';
    if(R.fe > 0){
      if(S.detail === 'simple'){
        items.push('<strong>Each city\'s living cost is your ' + fmtC(R.fe, fc) + ' a month scaled by its cost-of-living index ' +
          (S.housing === 'include' ? 'with housing' : 'without housing, as when an employer pays for it') + '</strong>' + updated + ', for the same lifestyle.');
      } else {
        const used = S.rows.filter(r => r.amount > 0).map(r => catOf(r.catId));
        const scaled = [...new Set(used.filter(c => c.index !== 'currency_only').map(c => c.label.toLowerCase()))];
        const fxOnly = [...new Set(used.filter(c => c.index === 'currency_only').map(c => c.label.toLowerCase()))];
        let t = '<strong>Each of your ' + used.length + ' expense ' + (used.length === 1 ? 'row is' : 'rows is') + ' scaled by its own category index</strong>' + updated;
        if(scaled.length) t += ': ' + scaled.join(', ');
        t += '.';
        if(fxOnly.length) t += ' ' + fxOnly.join(' and ').replace(/^./, c => c.toUpperCase()) + ' change only by the exchange rate.';
        items.push(t);
        if(used.some(c => c.index === 'utilities'))
          items.push('<strong>Utilities blend electricity 50%, water 20% and gas 30%.</strong> Where a city has no price for one, the other two are reweighted.');
      }
    }
    if(R.sal > 0) items.push('<strong>Salaries are after tax, as you entered them:</strong> ' + fmtC(R.sal, fc) + ' a month in ' + name + '. Nothing here works out tax.');
    if(R.ready){
      if(S.mode === 'global') items.push('<strong>Your ' + fmtC(R.sal, fc) + ' is converted to each city\'s currency at today\'s rate</strong> and spends on the same lifestyle there.');
      else if(S.target === 'ratio') items.push('<strong>Each city\'s salary keeps your ' + fmtP(R.r) + ' savings ratio,</strong> the share of pay you save now.');
      else items.push('<strong>Each city\'s salary keeps your ' + fmtC(R.fSav, fc) + ' a month of savings,</strong> converted at today\'s rate.');
    }
    const crossing = R.valid.some(o => o.cur !== fc);
    if(crossing){
      items.push('<strong>Money crossing currencies converts at ' + (LIVE ? 'the live rate of ' + fmtDay(LIVE.date) : 'the rate of ' + (META_RATE || 'the dataset')) +
        '.</strong> City estimates keep the rate the index was priced at, since local prices do not move with the exchange rate.');
    }
    if(R.ready && R.nodata) items.push('<strong>' + R.nodata + (R.nodata === 1 ? ' city has' : ' cities have') + ' no estimate</strong> for this lifestyle: the dataset lacks an index it needs, or an exchange rate.');
  }
  ul.innerHTML = items.map(t => '<li>' + t + '</li>').join('');
}

// ═══════════════════════════════════════════════════════════
// THE MAP
// The World Clock's projection and geometry: plain Mercator in "base units",
// the world W wide, cropped to 82°N and 58°S. The land is every time zone
// polygon filled; a country border is an edge two zones of different
// countries share.
// ═══════════════════════════════════════════════════════════
const W = 1024, RAD = Math.PI / 180, RW = W / (2 * Math.PI);
const projX = lon => (lon + 180) / 360 * W;
const projY = lat => W / 2 - RW * Math.log(Math.tan(Math.PI / 4 + Math.max(-85, Math.min(85, lat)) * RAD / 2));
const Y0 = projY(82), Y1 = projY(-58), H = Y1 - Y0;
const LOD_TOL = [0.35, 0.1, 0];
const MAX_K = 80;
const cv = $('mapCanvas'), ctx = cv.getContext('2d'), wrapEl = $('mapWrap');
let geo = null, mapReady = false;
let T = {x: 0, y: 0, k: 1}, minK = 1, vw = 0, vh = 0, DPR = 1;

function simplify(a, tol){
  const n = a.length / 2;
  if(!tol || n <= 2) return a;
  const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
  const stack = [0, n - 1], t2 = tol * tol;
  while(stack.length){
    const b = stack.pop(), s = stack.pop();
    const ax = a[2 * s], ay = a[2 * s + 1], dx = a[2 * b] - ax, dy = a[2 * b + 1] - ay, L = dx * dx + dy * dy;
    let max = 0, idx = -1;
    for(let i = s + 1; i < b; i++){
      const px = a[2 * i] - ax, py = a[2 * i + 1] - ay;
      let u = L ? (px * dx + py * dy) / L : 0;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const ex = px - u * dx, ey = py - u * dy, d = ex * ex + ey * ey;
      if(d > max){ max = d; idx = i; }
    }
    if(max > t2){ keep[idx] = 1; stack.push(s, idx, idx, b); }
  }
  let m = 0;
  for(let i = 0; i < n; i++) m += keep[i];
  const out = new Float64Array(m * 2);
  for(let i = 0, j = 0; i < n; i++) if(keep[i]){ out[j++] = a[2 * i]; out[j++] = a[2 * i + 1]; }
  return out;
}
function buildGeo(topo){
  const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
  const full = topo.arcs.map(arc => {
    const out = new Float64Array(arc.length * 2);
    let x = 0, y = 0;
    for(let i = 0; i < arc.length; i++){
      x += arc[i][0]; y += arc[i][1];
      out[2 * i] = projX(x * sx + tx); out[2 * i + 1] = projY(y * sy + ty);
    }
    return out;
  });
  const polysOf = g => g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : [];
  // Time zones are not countries: tzdb files northern Vietnam under
  // Asia/Bangkok, so the parts of that zone east of Thailand's easternmost
  // point (105.64°E) are Vietnam's, or the map would draw a border across it.
  const ccOf = (g, p) => g.properties.id === 'Asia/Bangkok' && p[0].some(a => full[a < 0 ? ~a : a].some((v, q) => !(q & 1) && v > projX(105.7))) ? 'VN' : g.properties.cc;
  const owners = full.map(() => new Set());
  const zones = topo.objects.zones.geometries.map((g, i) => {
    const polys = polysOf(g), ccs = polys.map(p => ccOf(g, p));
    polys.forEach((p, pi) => p.forEach(r => r.forEach(a => owners[a < 0 ? ~a : a].add(ccs[pi]))));
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    polys.forEach(p => p[0].forEach(a => {
      const arr = full[a < 0 ? ~a : a];
      for(let q = 0; q < arr.length; q += 2){
        if(arr[q] < b[0]) b[0] = arr[q]; if(arr[q] > b[2]) b[2] = arr[q];
        if(arr[q + 1] < b[1]) b[1] = arr[q + 1]; if(arr[q + 1] > b[3]) b[3] = arr[q + 1];
      }
    }));
    return { gi: i, polys, ccs, bbox: b, paths: [] };
  }).filter(z => z.polys.length);
  // An edge between two countries is a border; one owned by a single zone
  // is coast. Edges inside one country are not drawn.
  const kind = owners.map(s => s.size >= 2 ? 1 : 0);
  const refs = full.map(() => 0);
  topo.objects.zones.geometries.forEach(g => polysOf(g).forEach(p => p.forEach(r => r.forEach(a => { refs[a < 0 ? ~a : a]++; }))));
  refs.forEach((n, i) => { if(n !== 1 && kind[i] === 0) kind[i] = -1; });
  // An edge only one zone uses is not always coast. Two zones are laid on top
  // of another rather than cut out of it (Asia/Urumqi over Asia/Shanghai
  // across Xinjiang, Asia/Hebron over Asia/Jerusalem across the West Bank),
  // and neighbours' edges do not always meet, often where a border is
  // disputed. So look just off each side of it: sea on one side is coast, the
  // same one country on both is nothing, anything else a border. Where an
  // overlay lies, it alone decides the country; where two countries' zones
  // overlap, both count, so a disputed area keeps both lines.
  // An overlay is found as the World Clock finds it: every edge it shares
  // with other zones runs the same way as one zone's, its base's.
  const geoms = topo.objects.zones.geometries, tally = full.map(() => new Map()), baseOf = new Map();
  geoms.forEach((g, i) => polysOf(g).forEach(p => p.forEach(r => r.forEach(a => {
    const m = tally[a < 0 ? ~a : a]; m.set(i, (m.get(i) || 0) + (a < 0 ? -1 : 1));
  }))));
  geoms.forEach((g, i) => {
    let base = -1, ok = true;
    polysOf(g).forEach(p => p.forEach(r => r.forEach(a => {
      const m = tally[a < 0 ? ~a : a];
      if(m.size === 1) return;
      const same = [...m].filter(([j, s]) => j !== i && Math.sign(s) === Math.sign(m.get(i))).map(([j]) => j);
      if(base < 0 && same.length === 1) base = same[0];
      if(!same.includes(base)) ok = false;
    })));
    if(ok && base >= 0) baseOf.set(i, base);
  });
  const ringsOf = zones.map(z => z.polys.map(p => p.map(r => ringPoints(r, full))));
  const inRing = (x, y, r) => {
    let c = false;
    for(let i = 0, j = r.length - 2; i < r.length; j = i, i += 2){
      const yi = r[i + 1], yj = r[j + 1];
      if((yi > y) !== (yj > y) && x < (r[j] - r[i]) * (y - yi) / (yj - yi) + r[i]) c = !c;
    }
    return c;
  };
  const ccsAt = (x, y) => {
    const hits = [];
    zones.forEach((z, zi) => {
      const b = z.bbox;
      if(x < b[0] || x > b[2] || y < b[1] || y > b[3]) return;
      ringsOf[zi].forEach((p, pi) => { if(p.reduce((c, r) => inRing(x, y, r) ? !c : c, false)) hits.push([z.gi, z.ccs[pi]]); });
    });
    const under = new Set(hits.map(([gi]) => baseOf.get(gi)));
    return [...new Set(hits.filter(([gi]) => !under.has(gi)).map(([, cc]) => cc))].sort().join();
  };
  refs.forEach((n, i) => {
    if(n !== 1) return;
    const a = full[i];
    if(a.length < 4) return;
    let q = 0, len = -1;
    for(let p = 0; p + 3 < a.length; p += 2){
      const d = Math.hypot(a[p + 2] - a[p], a[p + 3] - a[p + 1]);
      if(d > len){ len = d; q = p; }
    }
    if(!(len > 0)) return;
    const mx = (a[q] + a[q + 2]) / 2, my = (a[q + 1] + a[q + 3]) / 2;
    const e = Math.min(0.004, len / 4), nx = -(a[q + 3] - a[q + 1]) / len * e, ny = (a[q + 2] - a[q]) / len * e;
    const c1 = ccsAt(mx + nx, my + ny), c2 = ccsAt(mx - nx, my - ny);
    if(c1 && c2) kind[i] = c1 === c2 && !c1.includes(',') ? -1 : 1;
  });
  geo = { full, arcsLod: [], zones, kind, lines: [] };
  geo.arcsLod[LOD_TOL.length - 1] = full;
}
function arcsAt(l){
  if(!geo.arcsLod[l]) geo.arcsLod[l] = geo.full.map(a => simplify(a, LOD_TOL[l]));
  return geo.arcsLod[l];
}
function ringPoints(ring, arcs){
  const pts = [];
  ring.forEach((i, j) => {
    const a = arcs[i < 0 ? ~i : i], n = a.length / 2;
    if(i >= 0) for(let p = j ? 1 : 0; p < n; p++) pts.push(a[2 * p], a[2 * p + 1]);
    else for(let p = n - (j ? 2 : 1); p >= 0; p--) pts.push(a[2 * p], a[2 * p + 1]);
  });
  return pts;
}
function zonePath(z, l){
  if(z.paths[l]) return z.paths[l];
  const arcs = arcsAt(l), path = new Path2D();
  for(const poly of z.polys) for(const ring of poly){
    const pts = ringPoints(ring, arcs);
    if(pts.length < 6) continue;
    path.moveTo(pts[0], pts[1]);
    for(let i = 2; i < pts.length; i += 2) path.lineTo(pts[i], pts[i + 1]);
    path.closePath();
  }
  return (z.paths[l] = path);
}
function linesAt(l){
  if(geo.lines[l]) return geo.lines[l];
  const arcs = arcsAt(l), coast = new Path2D(), border = new Path2D();
  arcs.forEach((a, i) => {
    const k = geo.kind[i];
    if(k < 0 || a.length < 4) return;
    const p = k === 1 ? border : coast;
    p.moveTo(a[0], a[1]);
    for(let q = 2; q < a.length; q += 2) p.lineTo(a[q], a[q + 1]);
  });
  return (geo.lines[l] = { coast, border });
}
function lodFor(k){
  for(let l = 0; l < LOD_TOL.length - 1; l++) if(LOD_TOL[l] * k <= 0.5) return l;
  return LOD_TOL.length - 1;
}

// ── View transform ───────────────────────────────────────────────────────
function constrain(t){
  const k = Math.max(minK, Math.min(MAX_K, t.k));
  const hi = -Y0 * k, lo = vh - Y1 * k;
  const y = lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, t.y));
  // x wraps: keep it within one world width so it never drifts far.
  const wk = W * k;
  let x = t.x;
  x = ((x % wk) + wk) % wk - wk;
  return {x, y, k};
}
function copies(){
  const wk = W * T.k, out = [];
  for(let c = Math.floor(-T.x / wk) - 1; c <= Math.floor((vw - T.x) / wk) + 1; c++) out.push(c);
  return out;
}
function centreX(){ return (vw / 2 - T.x) / T.k; }
function worldTransform(lon){
  const cx = lon == null ? centreX() : projX(lon);
  return constrain({x: vw / 2 - cx * minK, y: vh / 2 - (Y0 + H / 2) * minK, k: minK});
}
function boxTransform(cx, cy, bw, bh){
  const k = Math.max(minK, Math.min(MAX_K, Math.min(vw / bw, vh / bh)));
  // The nearest copy of the place, so a fly never spins the globe.
  const cur = centreX();
  cx += Math.round((cur - cx) / W) * W;
  return constrain({x: vw / 2 - cx * k, y: vh / 2 - cy * k, k});
}
// Your region: about 70° by 36° around your city.
function homeTransform(){
  // From the state, not the last result: a new city flies before the redraw.
  const c = getCity(S.fromKey);
  if(!c || c.lat == null) return worldTransform();
  const x = projX(c.lon), y = projY(c.lat);
  return boxTransform(x, y, W * 70 / 360, Math.abs(projY(Math.min(84, c.lat + 18)) - projY(Math.max(-84, c.lat - 18))));
}
function cityTransform(c){
  const x = projX(c.lon), y = projY(c.lat);
  return boxTransform(x, y, W * 24 / 360, Math.abs(projY(Math.min(84, c.lat + 7)) - projY(Math.max(-84, c.lat - 7))));
}
function screenOf(c){
  const bx = projX(c.lon), wk = W * T.k;
  let x = T.x + bx * T.k;
  x = x - Math.floor((x - 0) / wk) * wk;   // first copy right of the left edge
  if(x > vw) x -= wk;
  // Pick the copy nearest the centre.
  const alt = x + wk;
  if(Math.abs(alt - vw / 2) < Math.abs(x - vw / 2)) x = alt;
  return [x, T.y + projY(c.lat) * T.k];
}
let flyRaf = 0;
function setT(t){ T = constrain(t); requestDraw(); followCard(); }
function flyTo(target, dur){
  cancelAnimationFrame(flyRaf);
  if(reduceMotion || !dur || !vw){ setT(target); return Promise.resolve(); }
  const from = {...T}, t0 = performance.now();
  // Interpolate in log scale, about the screen centre, so the fly reads as one move.
  const cxF = (vw / 2 - from.x) / from.k, cyF = (vh / 2 - from.y) / from.k;
  let cxT = (vw / 2 - target.x) / target.k;
  cxT += Math.round((cxF - cxT) / W) * W;
  const cyT = (vh / 2 - target.y) / target.k;
  return new Promise(res => {
    const step = now => {
      const u = Math.min(1, (now - t0) / dur), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      const k = Math.exp(Math.log(from.k) + (Math.log(target.k) - Math.log(from.k)) * e);
      const cx = cxF + (cxT - cxF) * e, cy = cyF + (cyT - cyF) * e;
      setT({x: vw / 2 - cx * k, y: vh / 2 - cy * k, k});
      if(u < 1) flyRaf = requestAnimationFrame(step); else res();
    };
    flyRaf = requestAnimationFrame(step);
  });
}
function zoomAt(px, py, f){
  const k2 = Math.max(minK, Math.min(MAX_K, T.k * f));
  setT({x: px - (px - T.x) * k2 / T.k, y: py - (py - T.y) * k2 / T.k, k: k2});
}

// ── Drawing ──────────────────────────────────────────────────────────────
let drawQueued = false;
function requestDraw(){
  if(drawQueued) return;
  drawQueued = true;
  requestAnimationFrame(() => { drawQueued = false; draw(); });
}
const F_NAME = '600 10.5px "DM Sans", system-ui, sans-serif';
const F_HEAD = '700 12px "DM Mono", ui-monospace, monospace';
const F_HOME = '700 13px "DM Mono", ui-monospace, monospace';
const F_LOCAL = '500 10px "DM Mono", ui-monospace, monospace';
const twCache = new Map();
function tw(font, s){
  const key = font + '|' + s;
  let w = twCache.get(key);
  if(w === undefined){ ctx.font = font; w = ctx.measureText(s).width; twCache.set(key, w); }
  return w;
}
let lastLabels = [], hoverKey = null, dotsOnScreen = [];
function dotRadius(){ return Math.max(2.8, Math.min(6, 2.8 + Math.log2(T.k / minK) * 0.9)); }
function draw(){
  if(!vw || !vh) return;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = C.sea;
  ctx.fillRect(0, 0, vw, vh);
  if(geo){
    const k = T.k, l = lodFor(k), L = linesAt(l);
    for(const c of copies()){
      const ox = T.x + c * W * k;
      const x0 = -ox / k, x1 = (vw - ox) / k, y0 = -T.y / k, y1 = (vh - T.y) / k;
      if(x1 < 0 || x0 > W) continue;
      ctx.setTransform(DPR * k, 0, 0, DPR * k, DPR * ox, DPR * T.y);
      ctx.fillStyle = C.land;
      for(const z of geo.zones){
        const b = z.bbox;
        if(b[2] < x0 || b[0] > x1 || b[3] < y0 || b[1] > y1) continue;
        ctx.fill(zonePath(z, l), 'evenodd');
      }
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.strokeStyle = C.coast; ctx.lineWidth = 0.7 / k; ctx.stroke(L.coast);
      ctx.strokeStyle = C.border; ctx.lineWidth = 0.9 / k; ctx.stroke(L.border);
    }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  drawCities();
}
function drawCities(){
  const R = RESULT;
  dotsOnScreen = [];
  lastLabels = [];
  if(!R) return;
  const r = dotRadius(), wk = W * T.k, cs = copies();
  const shown = [];
  for(const o of R.rows){
    if(o.c.lat == null) continue;
    const bx = projX(o.c.lon), sy = T.y + projY(o.c.lat) * T.k;
    if(sy < -20 || sy > vh + 20) continue;
    for(const c of cs){
      const sx = T.x + (bx + c * W) * T.k;
      if(sx < -20 || sx > vw + 20) continue;
      shown.push({o, sx, sy, col: R.ready ? colorOf(o) : null});
    }
  }
  // Dearest drawn last, then home on top of all.
  shown.sort((a, b) => (a.o.home - b.o.home) || ((a.o.q || 0) - (b.o.q || 0)));
  for(const d of shown){
    const {o, sx, sy, col} = d;
    const hov = o.key === hoverKey || o.key === cardKey;
    const rr = o.home ? r + 2 : hov ? r + 1.5 : r;
    ctx.beginPath();
    if(o.neg){
      // Secondary encoding: below zero is a downward triangle, not only red.
      const h = rr * 1.25;
      ctx.moveTo(sx - h, sy - h * 0.75); ctx.lineTo(sx + h, sy - h * 0.75); ctx.lineTo(sx, sy + h); ctx.closePath();
    } else ctx.arc(sx, sy, rr, 0, 2 * Math.PI);
    if(col){ ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = C.ring; ctx.stroke(); }
    else { ctx.lineWidth = 1.4; ctx.strokeStyle = C.nodata; ctx.stroke(); }
    if(o.home){
      ctx.beginPath(); ctx.arc(sx, sy, rr + 2.2, 0, 2 * Math.PI);
      ctx.lineWidth = 2; ctx.strokeStyle = C.home; ctx.stroke();
    } else if(hov){
      ctx.beginPath(); ctx.arc(sx, sy, rr + 2, 0, 2 * Math.PI);
      ctx.lineWidth = 1.6; ctx.strokeStyle = C.hover; ctx.stroke();
    }
    dotsOnScreen.push({key: o.key, sx, sy});
  }
  if(R.ready) drawLabels(shown);
}
// Labels: home first, then the city under the pointer, then by population,
// each tried right, left, above and below its dot, and dropped when it would
// sit on one already placed.
function drawLabels(shown){
  const R = RESULT, v = view(), r = dotRadius();
  const obstacles = [];
  const zb = document.querySelector('.map-zoom');
  if(zb){ const a = wrapEl.getBoundingClientRect(), b = zb.getBoundingClientRect(); obstacles.push({x: b.left - a.left - 4, y: b.top - a.top - 4, w: b.width + 8, h: b.height + 8}); }
  const cands = shown.filter(d => d.col && viewValue(d.o, v)).map(d => ({...d,
    pri: d.o.home ? 3e12 : d.o.key === cardKey || d.o.key === hoverKey ? 2e12 : (d.o.c.pop || 0)}));
  cands.sort((a, b) => b.pri - a.pri);
  const placed = [];
  const hits = b => obstacles.concat(placed).some(p => b.x < p.x + p.w + 2 && b.x + b.w + 2 > p.x && b.y < p.y + p.h + 1 && b.y + b.h + 1 > p.y);
  ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const seen = new Set();
  for(const d of cands){
    if(seen.has(d.o.key) && !d.o.home) continue;
    const x = viewValue(d.o, v);
    const lines = [{t: d.o.c.city.replace(/, [A-Z]{2}$/, ''), f: F_NAME, h: 13, c: C.muted}];
    if('ratio' in x) lines.push({t: fmtP(x.ratio), f: d.o.home ? F_HOME : F_HEAD, h: 15, c: C.label});
    else {
      lines.push({t: fmtC(x.from, R.fc, true), f: d.o.home ? F_HOME : F_HEAD, h: 15, c: C.label});
      if(d.o.cur !== R.fc) lines.push({t: '(' + fmtC(x.local, d.o.cur, true) + ')', f: F_LOCAL, h: 12, c: C.muted});
    }
    let w = 0, h = 0;
    for(const ln of lines){ w = Math.max(w, tw(ln.f, ln.t)); h += ln.h; }
    w += 4;
    const gap = r + 4;
    const tries = [
      {x: d.sx + gap, y: d.sy - h / 2, align: 'left'},
      {x: d.sx - gap - w, y: d.sy - h / 2, align: 'left'},
      {x: d.sx - w / 2, y: d.sy - gap - h, align: 'left'},
      {x: d.sx - w / 2, y: d.sy + gap, align: 'left'},
    ];
    for(const b of tries){
      const box = {x: b.x, y: b.y, w, h};
      if(box.x < 2 || box.y < 2 || box.x + w > vw - 2 || box.y + h > vh - 2 || hits(box)) continue;
      placed.push(box);
      seen.add(d.o.key);
      lastLabels.push({key: d.o.key, x: box.x, y: box.y, w, h, text: lines.map(ln => ln.t)});
      let y = box.y;
      ctx.textAlign = 'left';
      for(const ln of lines){
        ctx.font = ln.f;
        ctx.lineWidth = 3.2; ctx.strokeStyle = C.halo; ctx.strokeText(ln.t, box.x + 2, y + ln.h / 2);
        ctx.fillStyle = ln.c; ctx.fillText(ln.t, box.x + 2, y + ln.h / 2);
        y += ln.h;
      }
      break;
    }
  }
}

// ── Hover and tap card ───────────────────────────────────────────────────
let cardKey = null, cardPinned = false, cardMap = null;
function cityAt(x, y){
  let best = null, bd = 11 * 11;
  for(const d of dotsOnScreen){
    const dd = (d.sx - x) ** 2 + (d.sy - y) ** 2;
    if(dd <= bd){ bd = dd; best = d.key; }
  }
  return best;
}
function showCard(key, x, y, pin){
  cardKey = key; cardPinned = !!pin;
  cardMap = [(x - T.x) / T.k, (y - T.y) / T.k];
  const card = $('placeCard');
  card.hidden = false;
  card.classList.toggle('pinned', cardPinned);
  renderCard();
  placeCard(x, y);
  requestDraw();
}
function hideCard(){
  cardKey = null; cardPinned = false;
  $('placeCard').hidden = true;
  requestDraw();
}
function placeCard(x, y){
  const card = $('placeCard'), w = card.offsetWidth, h = card.offsetHeight;
  let left = x + 14, top = y + 14;
  if(left + w > vw - 8) left = x - w - 14;
  if(top + h > vh - 8) top = y - h - 14;
  card.style.transform = 'translate(' + Math.max(8, left) + 'px,' + Math.max(8, top) + 'px)';
}
function followCard(){
  if(!cardKey || !cardMap) return;
  const x = T.x + cardMap[0] * T.k, y = T.y + cardMap[1] * T.k;
  if(x < 0 || y < 0 || x > vw || y > vh){ hideCard(); return; }
  placeCard(x, y);
}
function noEstimateWhy(o){
  const R = RESULT, from = R.from;
  if(!(o.fx > 0)) return 'No exchange rate for ' + o.cur + '.';
  if(S.detail === 'detailed'){
    const miss = S.rows.filter(r => r.amount > 0).map(r => catOf(r.catId)).filter(c => getIdx(o.c, c.index) == null || getIdx(from, c.index) == null);
    if(miss.length) return 'No ' + miss[0].label.toLowerCase() + ' data for ' + (getIdx(o.c, miss[0].index) == null ? o.c.city : from.city) + ' in the dataset.';
  } else if(getIdx(o.c, coliKey()) == null) return 'No cost-of-living index for ' + o.c.city + ' in the dataset.';
  if(S.mode === 'required' && S.target === 'ratio' && o.E != null && o.E <= 0) return 'With nothing to spend, any salary keeps the ratio.';
  return 'Not enough data for an estimate.';
}
function renderCard(){
  const R = RESULT, card = $('placeCard');
  const o = R && R.rows.find(x => x.key === cardKey);
  if(!o){ hideCard(); return; }
  const close = cardPinned ? SharedIcon.button('close', 'Close', 'pop-x', 'data-close') : '';
  let html = '<div class="pop-head"><div><div class="pop-name">' + esc(o.c.city) + '</div><div class="pop-country">' + esc(o.c.country) + ' · ' + esc(o.cur) + '</div></div>' + close + '</div>';
  if(!R.ready){
    html += '<div class="pop-what">Enter your salary and living cost to see this city\'s figures.</div>';
  } else if(o.sal == null || o.q == null){
    html += '<div class="pop-what">No estimate. ' + esc(noEstimateWhy(o)) + '</div>';
  } else {
    const v = view(), x = viewValue(o, v), fc = R.fc;
    const neg = n => n < 0 ? ' class="neg"' : '';
    const both = (vl) => fmtC(vl * o.fx, fc) + (o.cur !== fc ? ' <span class="pop-local">(' + fmtC(vl, o.cur) + ')</span>' : '');
    if('ratio' in x) html += '<div class="pop-big"' + neg(x.ratio) + '>' + fmtP(x.ratio) + '</div>';
    else html += '<div class="pop-big"' + neg(x.from) + '>' + fmtC(x.from, fc) + '</div>' + (o.cur !== fc ? '<div class="pop-local">(' + fmtC(x.local, o.cur) + ')</div>' : '');
    html += '<div class="pop-what">' + esc(mapTitle()) + '</div><div class="pop-rows">';
    const rows = [];
    if(v !== 'salary') rows.push([S.mode === 'global' ? 'Your salary' : 'Net salary needed', both(o.sal)]);
    if(v !== 'living') rows.push(['Living cost', both(o.E)]);
    if(v !== 'savings') rows.push(['Savings', '<span' + neg(o.sav) + '>' + both(o.sav) + '</span>']);
    if(v !== 'ratio') rows.push(['Savings ratio', '<span' + neg(o.ratio) + '>' + fmtP(o.ratio) + '</span>']);
    if(o.cur !== fc) rows.push(['Rate', '1 ' + esc(o.cur) + ' = ' + fmtFx(o.fx) + ' ' + esc(fc)]);
    html += rows.map(([a, b]) => '<span>' + a + '</span><span>' + b + '</span>').join('') + '</div>';
    html += '<div class="pop-rel">' + esc(relText(o, R.from.city)) + (o.neg ? '. Your salary does not cover the lifestyle here.' : '') + '</div>';
  }
  card.innerHTML = html;
}
function fmtFx(v){
  if(!isFinite(v) || v <= 0) return '—';
  if(v >= 1) return fmtN(v, 2);
  const d = Math.min(12, Math.max(2, -Math.floor(Math.log10(v)) + 1));
  return Number(v).toLocaleString('en-AU', {minimumFractionDigits: 2, maximumFractionDigits: d});
}

// ── Gestures ─────────────────────────────────────────────────────────────
// Drag pans. Ctrl or ⌘ with the wheel zooms (a trackpad pinch arrives as
// that too); a plain wheel scrolls the page, as a map inside a page should.
// On a phone one finger scrolls the page up and down and pans sideways, and
// two fingers pinch. With the map filling the screen there is no page to
// scroll, so a plain wheel zooms and one finger pans either way.
const ptrs = new Map();
let drag = null, pinch = null, hintTimer = 0, lastTap = 0;
function localXY(e){ const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
function hint(text){
  const h = $('mapHint');
  h.textContent = text; h.hidden = false;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { h.hidden = true; }, 1300);
}
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
cv.addEventListener('wheel', e => {
  if(!mapReady) return;
  if(e.ctrlKey || e.metaKey || mapFull){
    e.preventDefault();
    const [x, y] = localXY(e);
    zoomAt(x, y, Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0022)));
  } else if(Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    hint(isMac ? 'Hold ⌘ and scroll to zoom the map' : 'Hold Ctrl and scroll to zoom the map');
  }
}, {passive: false});
cv.addEventListener('pointerdown', e => {
  if(!mapReady) return;
  const [x, y] = localXY(e);
  ptrs.set(e.pointerId, {x, y});
  try { cv.setPointerCapture(e.pointerId); } catch(err) {}
  if(ptrs.size === 1){ drag = {x, y, sx: x, sy: y, moved: false, type: e.pointerType}; }
  else if(ptrs.size === 2){
    const [a, b] = [...ptrs.values()];
    pinch = {d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2};
    drag = null;
  }
});
cv.addEventListener('pointermove', e => {
  if(!mapReady) return;
  const [x, y] = localXY(e);
  if(ptrs.has(e.pointerId)) ptrs.set(e.pointerId, {x, y});
  if(pinch && ptrs.size === 2){
    const [a, b] = [...ptrs.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    setT({x: T.x + cx - pinch.cx, y: T.y + cy - pinch.cy, k: T.k});
    if(pinch.d > 0) zoomAt(cx, cy, d / pinch.d);
    pinch = {d, cx, cy};
    return;
  }
  if(drag && ptrs.has(e.pointerId)){
    if(!drag.moved && Math.hypot(x - drag.sx, y - drag.sy) > 4){ drag.moved = true; cv.classList.add('dragging'); if(!cardPinned) hideCard(); }
    if(drag.moved){ setT({x: T.x + x - drag.x, y: T.y + y - drag.y, k: T.k}); }
    drag.x = x; drag.y = y;
    return;
  }
  if(e.pointerType === 'mouse' && !e.buttons){
    const key = cityAt(x, y);
    cv.classList.toggle('over-city', !!key);
    if(key !== hoverKey){ hoverKey = key; requestDraw(); }
    if(cardPinned) return;
    if(key) showCard(key, x, y, false); else if(cardKey) hideCard();
  }
});
function endPointer(e){
  const wasDrag = drag, [x, y] = localXY(e);
  ptrs.delete(e.pointerId);
  if(ptrs.size < 2) pinch = null;
  if(ptrs.size === 0){
    cv.classList.remove('dragging');
    drag = null;
    if(e.type === 'pointerup' && wasDrag && !wasDrag.moved){
      const now = performance.now();
      if(now - lastTap < 300 && e.pointerType !== 'mouse'){ zoomAt(x, y, 2); lastTap = 0; return; }
      lastTap = now;
      const key = cityAt(x, y);
      if(key){ hoverKey = key; showCard(key, x, y, true); }
      else { hoverKey = null; hideCard(); }
    }
  } else if(ptrs.size === 1){
    const [p] = [...ptrs.values()];
    drag = {x: p.x, y: p.y, sx: p.x, sy: p.y, moved: true};
  }
}
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', endPointer);
cv.addEventListener('pointerleave', e => {
  if(e.pointerType !== 'mouse') return;
  if(hoverKey){ hoverKey = null; requestDraw(); }
  if(!cardPinned && cardKey) hideCard();
});
cv.addEventListener('dblclick', e => { if(!mapReady) return; const [x, y] = localXY(e); zoomAt(x, y, 2); });
$('placeCard').addEventListener('click', e => { if(e.target.closest('[data-close]')){ hoverKey = null; hideCard(); } });
const zoomBy = f => { if(mapReady) flyTo(constrain({x: vw / 2 - (vw / 2 - T.x) * f, y: vh / 2 - (vh / 2 - T.y) * f, k: T.k * f}), 250); };
$('zoomIn').addEventListener('click', () => zoomBy(1.8));
$('zoomOut').addEventListener('click', () => zoomBy(1 / 1.8));
$('zoomHome').addEventListener('click', () => { if(mapReady) flyTo(homeTransform(), 900); });
$('zoomWorld').addEventListener('click', () => { if(mapReady) flyTo(worldTransform(), 700); });

// ⤢ lifts the map card (title, View, legend and map) out of the page to fill
// the window and puts it back on a second press or Esc. It is the same card,
// so the view, the pinned city and the position all carry over; the
// ResizeObserver below refits the canvas and keeps the same spot centred.
let mapFull = false;
function setMapFull(on){
  on = !!on;
  if(on === mapFull) return;
  mapFull = on;
  $('mapCard').classList.toggle('is-full', on);
  document.documentElement.classList.toggle('map-full-open', on);
  const b = $('mapFull'), label = on ? 'Put the map back in the page' : 'Enlarge the map to fill the screen';
  b.setAttribute('aria-pressed', String(on));
  b.title = label; b.setAttribute('aria-label', label);
  if(!on) $('mapCard').scrollIntoView({block: 'nearest'});
}
$('mapFull').addEventListener('click', () => setMapFull(!mapFull));
document.addEventListener('keydown', e => {
  if(e.key !== 'Escape' || !mapFull || e.defaultPrevented) return;
  if(cardPinned){ hoverKey = null; hideCard(); return; }
  setMapFull(false);
});

function resize(){
  const oldW = vw, oldH = vh;
  vw = wrapEl.clientWidth; vh = wrapEl.clientHeight;
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(vw * DPR); cv.height = Math.round(vh * DPR);
  minK = Math.min(vw / W, vh / H);
  if(oldW && T) T = constrain({x: T.x + (vw - oldW) / 2, y: T.y + (vh - oldH) / 2, k: Math.max(minK, T.k)});
  requestDraw();
}
if(window.ResizeObserver) new ResizeObserver(() => resize()).observe(wrapEl);
else window.addEventListener('resize', resize);

function loadMap(){
  fetch('../../worldclock/zones.json')
    .then(r => { if(!r.ok) throw new Error(r.status); return r.json(); })
    .then(topo => {
      buildGeo(topo);
      resize();
      const c = getCity(S.fromKey);
      T = worldTransform(c && c.lon != null ? c.lon : 20);
      mapReady = true;
      $('mapLoading').hidden = true;
      requestDraw();
    })
    .catch(err => { console.error(err); $('mapLoading').textContent = 'The map could not load. The table below has every city.'; });
  if(document.fonts && document.fonts.load){
    Promise.all([document.fonts.load(F_HEAD), document.fonts.load(F_NAME), document.fonts.load(F_LOCAL)])
      .then(() => { twCache.clear(); requestDraw(); }).catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════
function init(){
  readColors();
  mountFromPicker();
  wireInputs();
  wireTable();
  document.querySelectorAll('.quick-start-btn').forEach(b => b.addEventListener('click', () => applyQuickStart(b.dataset.preset)));
  syncInputs();
  render();
  // The whole plan lives in S; the form is redrawn from it on a revisit.
  persist = Persist.init('costofliving-comparator-map', {
    onRestore(){ normalise(); mountFromPicker(); syncInputs(); render(); },
    extra: {
      save(){ return S; },
      restore(e){ if(e && typeof e === 'object'){ Object.keys(S).forEach(k => { delete S[k]; }); Object.assign(S, clone(S_DEFAULTS), clone(e)); } }
    }
  });
  SharedScenario.mount('.quick-start-row', { tool: 'costofliving-comparator-map', persist });
  loadMap();

  // Test hook for the audit harness: read-only views of the live state.
  window.__colmap = {
    state: () => clone(S),
    rows: () => (RESULT ? RESULT.rows.map(o => ({ key: o.key, cur: o.cur, home: o.home, E: o.E, fx: o.fx, sal: o.sal, sav: o.sav,
      ratio: o.ratio, q: o.q, neg: o.neg, arm: armOf(o), color: colorOf(o), lat: o.c.lat, lon: o.c.lon })) : []),
    summary: () => (RESULT ? { from: RESULT.from && cityKey(RESULT.from), fc: RESULT.fc, fe: RESULT.fe, sal: RESULT.sal, r: RESULT.r,
      cheaper: RESULT.cheaper, dearer: RESULT.dearer, short: RESULT.short, nodata: RESULT.nodata, scale: RESULT.scale } : null),
    live: () => LIVE && { date: LIVE.date, source: LIVE.source },
    marketFx,
    view,
    labels: () => clone(lastLabels),
    transform: () => ({ ...T, minK, vw, vh }),
    mapReady: () => mapReady,
    arcKinds: () => (geo ? Array.from(geo.kind) : null),
    screenOf: key => { const c = getCity(key); return c && c.lat != null ? screenOf(c) : null; },
    flyTo: (key, dur) => { const c = getCity(key); return c ? flyTo(cityTransform(c), dur || 0) : Promise.resolve(); },
    card: () => (cardKey && !$('placeCard').hidden ? $('placeCard').innerText : null),
    full: () => mapFull,
  };
}

loadData().catch(err => {
  console.error(err);
  SharedVerdict.set('verdict', { tone: 'warn', title: 'The cost of living data could not load.', body: 'Check your connection and reload the page.' });
});
})();
