/* Rent vs Own Sensitivity: exchange rates, for comparing homes priced in
   different currencies (window.RVOFX).

   The rates are the Cost of Living Comparator's, so the two tools can never
   quote different ones on the same day: its bundled currency_rates.json
   (units per US dollar, with the date it was priced), and the same free,
   keyless daily feeds it reads live (ExchangeRate-API first, then Fawaz
   Ahmed's Currency API and its mirror), screened by the same sanity bound and
   kept under the same localStorage key. A live rate fetched on either page
   serves both, and a failed feed falls back to the next, then to the bundled
   file, so there is always a rate unless both the file and every feed fail.

     RVOFX.cross(base, code)  units of `code` one unit of `base` buys, or 0
     RVOFX.codes()            every currency with a rate, A to Z
     RVOFX.name(code, lang)   "Australian Dollar" / "Dolar Australia"
     RVOFX.source()           {kind:'live'|'bundled', date, name, url} or null
     RVOFX.onChange(fn)       called when a rate arrives or is refreshed
     RVOFX.ready              a promise settled once the first rates are in
   ────────────────────────────────────────────────────────────────────────── */
(function(global){
'use strict';

const SCRIPT = document.currentScript && document.currentScript.src;
// fx.js sits in rentvsownhouse/sensitivity/, the Indonesian page one level
// deeper loads it from there too, so the file is found from this script.
const RATES_URL = new URL('../../costofliving-comparator/currency_rates.json', SCRIPT || location.href).href;

const LIVE_KEY = 'costofliving-comparator:live-fx'; // the comparator's own cache
const LIVE_TTL = 6 * 3600 * 1000;    // ask again after 6 hours
const LIVE_TIMEOUT = 8000;           // per source, in ms
// A live rate more than this many times off the bundled one is a feed error or
// a redenomination, never a market move: that currency keeps the bundled rate.
const LIVE_SANITY = 5;

const LIVE_SOURCES = [
  {
    name: 'ExchangeRate-API',
    home: 'https://www.exchangerate-api.com',
    url: 'https://open.er-api.com/v6/latest/USD',
    parse: j => {
      if(!j || j.result !== 'success' || !j.rates) throw new Error('bad payload');
      return { date: new Date(j.time_last_update_unix * 1000).toISOString().slice(0,10), rates: j.rates };
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

let BUNDLED = {};      // units per USD, as bundled with the comparator
let BUNDLED_DATE = ''; // YYYY-MM-DD, the floor for a live rate
let LIVE = null;       // {rates, date, source, url}
const listeners = [];
const notify = () => listeners.forEach(fn => { try { fn(); } catch(e) { console.error(e); } });

// The comparator's screen: only the currencies the bundled file knows, and
// only rates within the sanity bound of it. With no bundled file to screen
// against (it failed to load), every positive rate is kept.
function cleanLive(raw, src){
  if(!raw || !raw.rates || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date) || (BUNDLED_DATE && raw.date < BUNDLED_DATE)) return null;
  const rates = {}, known = Object.keys(BUNDLED);
  (known.length ? known : Object.keys(raw.rates)).forEach(c => {
    const v = Number(raw.rates[c]), b = BUNDLED[c];
    if(!(isFinite(v) && v > 0)) return;
    if(known.length && !(b > 0 && v/b < LIVE_SANITY && b/v < LIVE_SANITY)) return;
    rates[c] = v;
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

async function refreshLive(){
  for(const src of LIVE_SOURCES){
    try {
      const live = cleanLive(src.parse(await fetchJson(src.url)), src);
      if(!live) continue;
      // Never trade a newer saved rate for an older one from a lagging mirror.
      if(LIVE && LIVE.date > live.date) return;
      LIVE = live;
      try { localStorage.setItem(LIVE_KEY, JSON.stringify({ savedAt: Date.now(), live })); } catch(e) {}
      notify();
      return;
    } catch(e) { /* next source */ }
  }
}

const ready = (async () => {
  try {
    const j = await fetchJson(RATES_URL);
    (j.data || []).forEach(r => { if(r && r.currency && r.usd_rate > 0) BUNDLED[r.currency] = Number(r.usd_rate); });
    BUNDLED_DATE = (j.metadata && j.metadata.updated_on) || '';
  } catch(e) { /* no bundled file: live rates only */ }
  const saved = readLiveCache();
  if(saved) LIVE = saved.live;
  notify();
  if(!saved || Date.now() - saved.savedAt > LIVE_TTL) await refreshLive();
})();

function usd(code){
  const l = LIVE && LIVE.rates[code];
  return l > 0 ? l : (BUNDLED[code] || 0);
}
function cross(base, code){
  if(base === code) return 1;
  const a = usd(base), b = usd(code);
  return a > 0 && b > 0 ? b / a : 0;
}
function codes(){
  const set = new Set(Object.keys(BUNDLED));
  if(LIVE) Object.keys(LIVE.rates).forEach(c => set.add(c));
  return [...set].filter(c => /^[A-Z]{3}$/.test(c)).sort();
}
function source(){
  if(LIVE) return { kind: 'live', date: LIVE.date, name: LIVE.source, url: LIVE.url };
  if(Object.keys(BUNDLED).length) return { kind: 'bundled', date: BUNDLED_DATE, name: 'Cost of Living Comparator', url: '../../costofliving-comparator/' };
  return null;
}
const NAMES = {};
function name(code, lang){
  const l = lang === 'id' ? 'id' : 'en';
  try {
    if(!NAMES[l]) NAMES[l] = new Intl.DisplayNames([l], { type: 'currency' });
    const n = NAMES[l].of(code);
    return n && n !== code ? n : code;
  } catch(e) { return code; }
}

global.RVOFX = { ready, cross, usd, codes, name, source, onChange: fn => listeners.push(fn), refresh: refreshLive };
})(window);
