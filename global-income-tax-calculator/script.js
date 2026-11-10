/* ═══════════════════════════════════════════════════════════════════════════
   Global Income Tax Calculator: the page.

   The sums are engine.js's (GSCEngine), held to the spec's golden values by
   _audit/run.mjs. This file reads the form, keeps up to four jobs, and draws
   the answer, the cards, the chart and the tables.

   Jobs. The form shows one job at a time (the active one). Each job is a flat
   object of the form's field values, keyed by the fields' Persist handles; the
   engine reads only its own country's. Switching jobs writes the form back into
   JOBS and loads the other one. The mini cache, a scenario file and a Share
   link carry the form as fields (the active job) and every job in extra, each
   as what differs from the defaults, so an old link or an AI link that names
   only fields opens as job 1.
   ═══════════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

const E = window.GSCEngine;
const $ = id => document.getElementById(id);
const cssVar = n => getComputedStyle(document.body).getPropertyValue(n).trim();
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const MAX_JOBS = 4;

/* ───────────────────────── Money ───────────────────────── */
const SYM = { USD: 'US$' };
Object.values(E.C).forEach(c => { if(!SYM[c.cur]) SYM[c.cur] = c.cur === 'EUR' ? '€' : c.sym; });
SYM.NOK = 'NOK '; SYM.SEK = 'SEK '; SYM.CHF = 'CHF '; SYM.AED = 'AED '; SYM.SAR = 'SAR '; SYM.QAR = 'QAR '; SYM.BHD = 'BHD '; SYM.KWD = 'KWD '; SYM.OMR = 'OMR ';
const symOf = cur => SYM[cur] || (cur + ' ');
function money(v, cur, compact){
  const n = Number(v), abs = Math.abs(n), sign = n < 0 ? '−' : '';
  if(!isFinite(n)) return '—';
  const s = symOf(cur);
  if(compact && abs >= 1e9) return sign + s + (abs/1e9).toFixed(abs >= 1e10 ? 0 : 1) + 'b';
  if(compact && abs >= 1e6) return sign + s + (abs/1e6).toFixed(abs >= 1e7 ? 0 : 1) + 'm';
  if(compact && abs >= 1e4) return sign + s + (abs/1e3).toFixed(0) + 'k';
  return sign + s + Math.round(abs).toLocaleString('en');
}
const pct = (v, d = 1) => isFinite(v) ? (v*100).toFixed(d) + '%' : '—';

/* ───────────────────────── Job fields ───────────────────────── */
const scope = $('jobScope');
let FIELDS = [];                 // every control inside the job scope
const DEFAULTS = {};             // their values as the page ships them
const handle = el => el.getAttribute('data-persist') || el.id;
const valueOf = el => el.type === 'checkbox' ? !!el.checked : el.value;
function setValue(el, v){
  if(el.type === 'checkbox') el.checked = v === true || v === 'true' || v === 1 || v === '1' || v === 'on';
  else el.value = String(v);
}
// Every field is kept, the other countries' too, so a job that goes to Germany
// and back still has its Australian settings, and a reload gives back exactly what was saved.
function readJob(){
  const job = {};
  FIELDS.forEach(el => { job[handle(el)] = valueOf(el); });
  return job;
}
function writeJob(job){
  FIELDS.forEach(el => setValue(el, DEFAULTS[handle(el)]));
  // Country first: a select only takes a value its options hold, and the rest follow it.
  if(job && E.C[job.country]) $('country').value = job.country;
  FIELDS.forEach(el => {
    const h = handle(el);
    if(!job || !Object.prototype.hasOwnProperty.call(job, h) || h === 'country') return;
    const v = job[h];
    if(el.tagName === 'SELECT' && ![...el.options].some(o => o.value === String(v))) return;   // gone: keep the default
    setValue(el, v);
  });
  refreshFormats();
  refreshCombos();
}
// The searchable pickers (country, state, province) show their select's value; a value set by code needs a refresh.
const COMBOS = ['country', 'usState', 'caProv'];
// A picker left open with a half-typed search (the reader clicked a Quick Start instead) closes on the new value.
function refreshCombos(){
  COMBOS.forEach(id => {
    const s = $(id), c = s && s._combo;
    if(!c) return;
    if(document.activeElement !== c.input) c.close(); else c.refresh();
  });
}
// A job as the engine reads it.
function knobsOf(job){
  const k = {};
  Object.entries(job).forEach(([h, v]) => {
    const el = FIELDS.find(f => handle(f) === h);
    if(el && (el.classList.contains('fmt-num') || el.classList.contains('fmt-pct'))) k[h] = SharedFmt.parseFormatted(String(v)) || 0;
    else k[h] = v;
  });
  return k;
}
function refreshFormats(){
  scope.querySelectorAll('.fmt-num, .fmt-pct').forEach(el => {
    const n = SharedFmt.parseFormatted(el.value);
    if(el.value !== '' && isFinite(n)) el.value = SharedFmt.formatThousands(String(n), { maxDecimals: el.classList.contains('fmt-pct') ? 3 : 2 });
  });
}

/* ───────────────────────── Visibility ───────────────────────── */
// data-show="AU SG" names the countries a row belongs to; data-if="key=a|b key!=c" adds field conditions.
function fieldVal(id){
  const el = $(id);
  if(!el) return '';
  return el.type === 'checkbox' ? (el.checked ? 'on' : 'off') : el.value;
}
function condHolds(expr){
  return expr.split(/\s+/).filter(Boolean).every(t => {
    const m = /^([A-Za-z0-9]+)(!?=)(.*)$/.exec(t);
    if(!m) return true;
    const hit = m[3].split('|').includes(fieldVal(m[1]));
    return m[2] === '=' ? hit : !hit;
  });
}
function applyVisibility(){
  const country = $('country').value;
  scope.querySelectorAll('[data-show], [data-if]').forEach(el => {
    const show = el.getAttribute('data-show'), cond = el.getAttribute('data-if');
    let on = true;
    if(show) on = show.split(/\s+/).includes(country);
    if(on && cond) on = condHolds(cond);
    el.toggleAttribute('data-hidden', !on);
  });
  scope.querySelectorAll('.field-group').forEach(g => {
    // A group shows while any of its own rows does (its own hidden mark is not a row's).
    const rows = g.querySelectorAll('.field-row, .toggle-row, .field-sub');
    g.toggleAttribute('data-hidden', ![...rows].some(r => !r.hasAttribute('data-hidden')));
  });
  const name = E.C[country].name;
  [['tab-household', 'emptyHousehold', 'No household details change the result in ' + name + '.'],
   ['tab-details', 'emptyDetails', 'Nothing more to set for ' + name + '.']].forEach(([tab, id, text]) => {
    const any = [...$(tab).querySelectorAll('.field-group')].some(g => !g.hasAttribute('data-hidden'));
    $(id).textContent = any ? '' : text;
  });
  // Money fields wear the job's own currency.
  scope.querySelectorAll('[data-cur-sym]').forEach(p => { p.textContent = E.C[country].sym; });
  fitPrefixes();
  const net = $('dir').value === 'net';
  $('amountLabel').firstChild.textContent = (net ? 'Take-home pay' : 'Gross pay') + ' ';
  $('amountTip').setAttribute('data-tip', net
    ? 'What lands in your account after income tax and employee contributions. The gross pay that leaves it is solved for.'
    : 'Before income tax and employee contributions. Contributions your employer pays on top are not part of it.');
}

// A symbol wider than the shared inset (SAR, CHF, AED) pushes the number along, so the two never touch.
function fitPrefixes(){
  scope.querySelectorAll('.affix-wrap [data-cur-sym]').forEach(p => {
    const input = p.parentNode.querySelector('.affix-input');
    if(!input) return;
    const w = p.getBoundingClientRect().width;
    // Hidden rows measure 0: they are fitted again when they show (applyVisibility runs on every change).
    input.style.paddingLeft = w ? Math.max(32, Math.ceil(p.offsetLeft + w + 7)) + 'px' : '';
  });
}

/* ───────────────────────── Jobs ───────────────────────── */
const DEFAULT_JOBS = () => [ null, { country: 'SG', amount: '120,000', sgRes: 'ep' } ];
let JOBS = [], ACTIVE = 0, persist = null;
function fullJob(partial){
  // A partial job (a Quick Start, an old file) laid over the page's defaults.
  const j = {};
  FIELDS.forEach(el => { j[handle(el)] = DEFAULTS[handle(el)]; });
  Object.assign(j, partial || {});
  if(!E.C[j.country]) j.country = DEFAULTS.country;
  return j;
}
function syncActive(){ JOBS[ACTIVE] = readJob(); }
function compactJob(job){
  const out = { country: job.country };
  Object.keys(job).forEach(h => { if(h !== 'country' && job[h] !== DEFAULTS[h]) out[h] = job[h]; });
  return out;
}
function pickJob(i){
  if(i === ACTIVE || i < 0 || i >= JOBS.length) return;
  syncActive();
  ACTIVE = i;
  linesPick = null;
  writeJob(JOBS[ACTIVE]);
  clearQuickStart();
  if(persist) persist.schedule();
  render();
}
function addJob(){
  if(JOBS.length >= MAX_JOBS) return;
  syncActive();
  JOBS.push(JSON.parse(JSON.stringify(JOBS[ACTIVE])));
  ACTIVE = JOBS.length - 1;
  linesPick = null;
  writeJob(JOBS[ACTIVE]);
  clearQuickStart();
  if(persist) persist.schedule();
  render();
}
function removeJob(i){
  if(JOBS.length <= 1) return;
  syncActive();
  JOBS.splice(i, 1);
  linesPick = null;
  if(i < ACTIVE) ACTIVE--;
  ACTIVE = Math.min(ACTIVE, JOBS.length - 1);
  writeJob(JOBS[ACTIVE]);
  clearQuickStart();
  if(persist) persist.schedule();
  render();
}
const colourOf = i => SharedPalette.at(i);
// Where a job is, in words: the state or province where the country has more than one set of rules.
const CA_PROV = { ON: 'Ontario', BC: 'British Columbia', AB: 'Alberta', QC: 'Quebec' };
function jobPlace(job){
  if(job.country === 'US') return (job.usState === 'NY' && (job.usNyc === true || job.usNyc === 'true') ? 'New York City' : E.US_STATES[job.usState] || 'United States') + ', US';
  if(job.country === 'CA') return (CA_PROV[job.caProv] || 'Canada') + ', Canada';
  if(job.country === 'GB' && job.ukRegion === 'sco') return 'Scotland, UK';
  return E.C[job.country].name;
}
function jobTitle(job, i){ return (i + 1) + ' · ' + jobPlace(job); }
function renderJobs(results){
  const list = $('jobsList');
  list.innerHTML = '';
  JOBS.forEach((job, i) => {
    const row = document.createElement('div');
    row.className = 'job-row';
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'job-chip' + (i === ACTIVE ? ' active' : '');
    chip.setAttribute('role', 'tab');
    chip.setAttribute('aria-selected', i === ACTIVE ? 'true' : 'false');
    chip.title = 'Switch the form to job ' + (i + 1);
    const r = results[i];
    const amt = SharedFmt.parseFormatted(String(job.amount)) || 0;
    const pay = money(amt, E.C[job.country].cur, true) + (job.period === 'monthly' ? '/mo' : '/yr') + (job.dir === 'net' ? ' net' : '');
    chip.innerHTML = '<span class="job-dot" style="background:' + colourOf(i) + '"></span><span class="job-name">' + esc(jobTitle(job, i)) + '</span>'
      + '<span class="job-pay">' + esc(r && r.notSupported ? 'not loaded' : pay) + '</span>';
    chip.addEventListener('click', () => pickJob(i));
    row.appendChild(chip);
    if(JOBS.length > 1){
      const wrap = document.createElement('span');
      wrap.innerHTML = SharedIcon.button('trash', 'Remove job ' + (i + 1), 'job-del');
      const del = wrap.firstElementChild;
      del.addEventListener('click', () => removeJob(i));
      row.appendChild(del);
    }
    list.appendChild(row);
  });
  $('addJob').disabled = JOBS.length >= MAX_JOBS;
}

/* ───────────────────────── Compute ───────────────────────── */
function computeJob(job){
  const k = knobsOf(job), country = job.country;
  const amt = Math.max(0, SharedFmt.parseFormatted(String(job.amount)) || 0);
  const annual = amt*(job.period === 'monthly' ? 12 : 1);
  let r;
  if(job.dir === 'net'){
    const s = E.solveGross(country, annual, k);
    if(s.notSupported) return Object.assign({ country, cur: E.C[country].cur, job }, s);
    r = E.compute(country, s.gross, k);
    if(!r.notSupported){ r.solved = true; r.target = annual; }
  } else r = E.compute(country, annual, k);
  if(r.notSupported) return Object.assign({ country, cur: E.C[country].cur, job }, r);
  r.job = job; r.knobs = k;
  r.marginal = E.marginal(country, r.entered, k, r);
  return r;
}

/* ───────────────────────── Live exchange rates ─────────────────────────
   The same mechanism as the Cost of Living Comparator: a free, keyless,
   CORS-open daily feed read from the browser, the next source on any failure,
   and the rates bundled in engine.js when every source fails. A rate more than
   LIVE_SANITY times off the bundled one is a feed error, so that currency keeps
   the bundled rate. Every sum is still worked out in the job's own currency:
   the rates only restate it (Show amounts in, the chart's axes, the ranking).
   Kept in localStorage and asked for again after LIVE_TTL; the comparator's
   own saved rate counts too, since both pages share the site's storage. */
const FX_BUNDLED = Object.assign({}, E.FX), FX_BUNDLED_DATE = E.FX_DATE;
const FX_SRC = { name: 'open.er-api.com', url: 'https://www.exchangerate-api.com' };
const LIVE_KEY = 'global-income-tax-calculator:live-fx', COL_LIVE_KEY = 'costofliving-comparator:live-fx';
const LIVE_TTL = 6*3600*1000, LIVE_TIMEOUT = 8000, LIVE_SANITY = 5;
const LIVE_SOURCES = [
  { name: 'ExchangeRate-API', home: 'https://www.exchangerate-api.com', url: 'https://open.er-api.com/v6/latest/USD',
    parse: j => {
      if(!j || j.result !== 'success' || !j.rates) throw new Error('bad payload');
      return { date: new Date(j.time_last_update_unix*1000).toISOString().slice(0, 10), rates: j.rates };
    } },
  ...['https://latest.currency-api.pages.dev/v1/currencies/usd.min.json',
      'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json'].map(url => ({
    name: 'Fawaz Ahmed\'s Currency API', home: 'https://github.com/fawazahmed0/exchange-api', url,
    parse: j => {
      if(!j || !j.usd || !j.date) throw new Error('bad payload');
      const rates = {};
      Object.keys(j.usd).forEach(k => { rates[k.toUpperCase()] = j.usd[k]; });
      return { date: j.date, rates };
    } }))
];
const BUNDLED_ISO = '2026-11-10';
const fxDateWords = iso => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
// Only this page's currencies, each within the sanity bound; null when nothing usable is left or it is older than the bundled rates.
function cleanLive(raw, src){
  if(!raw || !raw.rates || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date) || raw.date < BUNDLED_ISO) return null;
  const rates = {};
  Object.keys(FX_BUNDLED).forEach(c => {
    const v = Number(raw.rates[c]), b = FX_BUNDLED[c];
    if(c === 'USD') return;
    if(isFinite(v) && v > 0 && v/b < LIVE_SANITY && b/v < LIVE_SANITY) rates[c] = v;
  });
  return Object.keys(rates).length ? { rates, date: raw.date, source: src.name, url: src.home } : null;
}
let LIVE = null;
function useLive(live){
  LIVE = live;
  Object.keys(FX_BUNDLED).forEach(c => { E.FX[c] = live && live.rates[c] ? live.rates[c] : FX_BUNDLED[c]; });
  E.FX_DATE = live ? fxDateWords(live.date) : FX_BUNDLED_DATE;
  FX_SRC.name = live ? live.source : 'open.er-api.com';
  FX_SRC.url = live ? live.url : 'https://www.exchangerate-api.com';
}
function readLive(key){
  try {
    const raw = JSON.parse(localStorage.getItem(key) || 'null');
    if(!raw || !raw.live || !isFinite(raw.savedAt)) return null;
    const live = cleanLive(raw.live, { name: raw.live.source, home: raw.live.url });
    return live ? { live, savedAt: raw.savedAt } : null;
  } catch(e){ return null; }
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
      if(LIVE && LIVE.date > live.date) return;   // never trade a newer rate for a lagging mirror's
      useLive(live);
      try { localStorage.setItem(LIVE_KEY, JSON.stringify({ savedAt: Date.now(), live })); } catch(e){}
      const a = document.activeElement;
      if(!(a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName))) render();
      return;
    } catch(e){ /* next source */ }
  }
}
// Called once at load: the freshest saved rate straight away (so the page never opens on the
// bundled rate and then jumps), then the feed when that one is old. A guide's demo keeps the bundled rate.
function startLive(){
  if(/[?&]demo(&|$)/.test(location.search)) return;
  const saved = [readLive(LIVE_KEY), readLive(COL_LIVE_KEY)].filter(Boolean).sort((a, b) => b.live.date.localeCompare(a.live.date) || b.savedAt - a.savedAt)[0];
  if(saved) useLive(saved.live);
  if(!saved || Date.now() - saved.savedAt > LIVE_TTL) refreshLive();
}

/* ───────────────────────── Display ───────────────────────── */
const disp = () => ({ cur: $('dispCur').value, per: $('dispPer').value });
const perDiv = () => disp().per === 'month' ? 12 : 1;
const perWord = () => disp().per === 'month' ? 'a month' : 'a year';
function shown(v, r){
  const d = disp(), cur = d.cur === 'local' ? r.cur : d.cur;
  return { v: E.convert(v, r.cur, cur)/perDiv(), cur };
}
const showMoney = (v, r, compact) => { const s = shown(v, r); return money(s.v, s.cur, compact); };
// The common currency for comparing jobs: the display pick, else the jobs' own if they share one, else US dollars.
function commonCur(results){
  const d = disp().cur;
  if(d !== 'local') return d;
  const curs = [...new Set(results.map(r => r.cur))];
  return curs.length === 1 ? curs[0] : 'USD';
}

/* ───────────────────────── Verdict ───────────────────────── */
function renderVerdict(results){
  const ok = results.map((r, i) => ({ r, i })).filter(x => !x.r.notSupported);
  if(!ok.length){
    SharedVerdict.set('verdict', { tone: 'warn', title: 'These rules are not loaded yet.', body: esc(results[0].reason) });
    return;
  }
  const ns = results.map((r, i) => ({ r, i })).filter(x => x.r.notSupported);
  const nsLine = ns.map(x => 'Job ' + (x.i + 1) + ' (' + esc(E.C[x.r.country].name) + ') is not worked out: ' + esc(x.r.reason)).join(' ');
  if(ok.length === 1){
    const { r } = ok[0], name = jobPlace(r.job);
    const net = showMoney(r.net, r), gross = showMoney(r.gross, r);
    const title = r.solved
      ? 'To take home ' + esc(showMoney(r.target, r)) + ' ' + perWord() + ' in ' + esc(name) + ' you need <span class="v-num">' + esc(gross) + '</span> gross.'
      : 'Take-home pay in ' + esc(name) + ' is <span class="v-num">' + esc(net) + '</span> ' + perWord() + ', ' + pct(r.net/r.gross) + ' of gross.';
    const body = [ 'Income tax takes ' + esc(showMoney(r.incomeTax, r)) + ' and employee contributions ' + esc(showMoney(r.social + r.other, r)) + '.' ];
    if(r.marginal != null) body.push('Of the next 1% of pay, ' + pct(r.marginal, 0) + ' goes to tax and contributions.');
    if(nsLine) body.push(nsLine);
    SharedVerdict.set('verdict', { tone: '', title, body: body.join(' ') });
    return;
  }
  // Several jobs: rank by take-home in one currency.
  const cc = commonCur(ok.map(x => x.r));
  const inCc = x => E.convert(x.r.net, x.r.cur, cc);
  const ranked = ok.slice().sort((a, b) => inCc(b) - inCc(a));
  const best = ranked[0], second = ranked[1];
  const name = x => 'Job ' + (x.i + 1) + ' (' + jobPlace(JOBS[x.i]) + ')';
  const gap = inCc(best) - inCc(second);
  const per = perDiv();
  const allNet = ok.every(x => x.r.solved) && new Set(ok.map(x => Math.round(E.convert(x.r.target, x.r.cur, cc)))).size === 1;
  let title, body = [];
  if(allNet){
    const cheapest = ok.slice().sort((a, b) => E.convert(a.r.gross, a.r.cur, cc) - E.convert(b.r.gross, b.r.cur, cc))[0];
    title = esc(name(cheapest)) + ' needs the least gross pay for the same take-home: <span class="v-num">' + esc(money(E.convert(cheapest.r.gross, cheapest.r.cur, cc)/per, cc)) + '</span> ' + perWord() + '.';
  } else if(Math.abs(gap) < 0.5){
    title = esc(name(best)) + ' and ' + esc(name(second)) + ' leave the same take-home pay.';
  } else {
    title = esc(name(best)) + ' leaves the most: <span class="v-num">' + esc(money(inCc(best)/per, cc)) + '</span> ' + perWord() + ', ' + esc(money(gap/per, cc)) + ' more than ' + esc(name(second)) + '.';
  }
  body.push('Take-home as a share of gross: ' + ok.map(x => esc(name(x)) + ' ' + pct(x.r.net/x.r.gross)).join(', ') + '.');
  if(disp().cur === 'local' && new Set(ok.map(x => x.r.cur)).size > 1) body.push('Compared in US dollars at the rates of ' + E.FX_DATE + '.');
  if(nsLine) body.push(nsLine);
  SharedVerdict.set('verdict', { tone: '', title, body: body.join(' ') });
}

/* ───────────────────────── KPI cards ───────────────────────── */
function metricCard(label, value, sub, dot){
  return '<div class="metric card"><div class="label">' + (dot ? '<span class="job-dot" style="background:' + dot + '"></span>' : '') + label + '</div>'
    + '<div class="value' + (value.length > 14 ? ' small' : '') + '">' + esc(value) + '</div><div class="sub">' + sub + '</div></div>';
}
function renderMetrics(results){
  const el = $('metrics');
  let html = '';
  if(results.length === 1){
    const r = results[0];
    if(r.notSupported){ el.innerHTML = metricCard('Take-home pay', '—', esc(r.reason)); el.className = 'metrics n2'; return; }
    html += metricCard('<span class="tip-wrap">Take-home pay <i class="tip-icon" data-tip="Gross pay less income tax, employee contributions and other deductions taken from pay, plus any tax-free bonus.">?</i></span>',
      showMoney(r.net, r), esc(perWord()) + (r.solved ? ', the target you set' : ''));
    html += metricCard('Gross pay', showMoney(r.gross, r), r.solved ? 'Solved for your take-home' : esc(perWord()));
    html += metricCard('Income tax', showMoney(r.incomeTax, r), pct(r.incomeTax/r.gross) + ' of gross, all levels');
    html += metricCard('<span class="tip-wrap">Marginal rate <i class="tip-icon" data-tip="The share of the next 1% of pay that goes to tax and contributions.">?</i></span>',
      r.marginal == null ? '—' : pct(r.marginal), 'Contributions ' + esc(showMoney(r.social + r.other, r)));
    el.className = 'metrics';
  } else {
    results.forEach((r, i) => {
      const job = JOBS[i];
      if(r.notSupported){ html += metricCard(esc(jobTitle(job, i)), 'Not loaded', esc(r.reason), colourOf(i)); return; }
      const sub = (r.solved ? 'Gross ' + esc(showMoney(r.gross, r)) + ' for this take-home' : 'From ' + esc(showMoney(r.gross, r)) + ' gross')
        + '<br>Tax ' + pct(r.incomeTax/r.gross) + ', contributions ' + pct((r.social + r.other)/r.gross);
      html += metricCard(esc(jobTitle(job, i)), showMoney(r.net, r), sub, colourOf(i));
    });
    el.className = 'metrics' + (results.length === 2 ? ' n2' : results.length === 3 ? ' n3' : '');
  }
  el.innerHTML = html;
}

/* ───────────────────────── Chart ───────────────────────── */
let chart = null, chartCur = 'USD';
// The currencies the x axis reads in. Jobs in different currencies, each shown in its own,
// get an axis per currency, lined up at the exchange rate so one point across them is one pay;
// a single display currency (Show amounts in) puts them all on one axis.
function axisCurs(ok){
  const curs = [...new Set(ok.map(x => x.r.cur))];
  return disp().cur === 'local' && curs.length > 1 ? curs : [commonCur(ok.map(x => x.r))];
}
// What the chart's y axis reads: the share of gross taken home (pct, as it always has) or the take-home itself (amount).
const chartMeasure = () => ($('chartMeasure') && $('chartMeasure').value === 'amount') ? 'amount' : 'pct';
function sweep(results){
  const amt = chartMeasure() === 'amount';
  const ok = results.map((r, i) => ({ r, i })).filter(x => !x.r.notSupported);
  const curs = axisCurs(ok);
  const cc = curs[0];   // the lines are plotted in the first axis's currency; the others restate it
  chartCur = cc;
  const maxG = Math.max(1, ...ok.map(x => E.convert(x.r.entered, x.r.cur, cc)));
  const xMax = maxG*2.5, N = 60;
  return { cc, curs, xMax, series: ok.map(({ r, i }) => {
    const pts = [];
    for(let s = 1; s <= N; s++){
      const x = xMax*s/N, local = E.convert(x, cc, r.cur);
      const v = E.compute(r.country, local, r.knobs);
      pts.push({ x, y: v.notSupported || !v.gross ? null : amt ? E.convert(v.net, r.cur, cc) : v.net/v.gross*100, net: v.notSupported ? null : v.net });
    }
    const own = { x: E.convert(r.entered, r.cur, cc), y: amt ? E.convert(r.net, r.cur, cc) : r.net/r.gross*100, net: r.net, own: true };
    pts.push(own);
    pts.sort((a, b) => a.x - b.x);
    return { i, r, pts };
  }) };
}
function renderLegend(datasets){
  const el = $('chartLegend');
  el.innerHTML = '';
  datasets.forEach((ds, idx) => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    SharedLegend.attach(item, SharedLegend.specOf(ds), ds.label);
    item.addEventListener('click', () => {
      const hidden = !item.classList.contains('hidden');
      item.classList.toggle('hidden', hidden);
      chart.setDatasetVisibility(idx, !hidden);
      chart.update();
    });
    el.appendChild(item);
  });
}
function updateChart(results){
  if(typeof Chart === 'undefined'){
    $('hoverBox').textContent = 'The chart library could not be loaded, so the chart is unavailable. Every number on this page is still correct.';
    return;
  }
  const sw = sweep(results);
  const grid = cssVar('--chart-grid'), muted = cssVar('--chart-text'), text = cssVar('--text');
  const multi = sw.curs.length > 1;
  $('chartSub').hidden = !multi;
  $('chartSub').textContent = multi ? 'One gross pay axis per currency (' + sw.curs.join(', ') + '), lined up at the exchange rates of ' + E.FX_DATE + '.' : '';
  const datasets = sw.series.map(s => {
    const c = colourOf(s.i);
    return {
      label: jobTitle(JOBS[s.i], s.i),
      data: s.pts,
      borderColor: c, backgroundColor: c, borderWidth: 2.2, tension: 0.15, spanGaps: false,
      pointRadius: s.pts.map(p => p.own ? 6 : 0),
      pointHoverRadius: s.pts.map(p => p.own ? 8 : 4),
      pointBackgroundColor: c, pointBorderColor: cssVar('--panel'), pointBorderWidth: 2
    };
  });
  const cc = sw.cc, amt = chartMeasure() === 'amount';
  // A job's take-home at a point: its share of gross, or the amount in its own currency (or the one picked to show).
  const jobCur = i => disp().cur === 'local' ? sw.series[i].r.cur : cc;
  const yText = (it, short) => {
    if(it.parsed.y == null) return 'not loaded';
    if(!amt) return it.parsed.y.toFixed(1) + (short ? '%' : '% taken home');
    const s = sw.series[it.datasetIndex], c = jobCur(it.datasetIndex);
    return money(E.convert(it.raw.net, s.r.cur, c), c) + (short ? '' : ' taken home');
  };
  // Gross pay at one point of the axis, in every axis's currency.
  const grossAt = x => sw.curs.map(c => money(E.convert(x, cc, c), c)).join(' ≈ ');
  // Axis k restates the first one in its own currency: same span, so the zoom keeps them in step.
  const AX = ['x', 'x2', 'x3', 'x4'];
  const span = c => E.convert(sw.xMax, cc, c);
  const xScales = {};
  sw.curs.forEach((c, k) => {
    xScales[AX[k]] = { type: 'linear', min: 0, max: span(c), position: k % 2 ? 'top' : 'bottom',
      // The first axis names the measure; each other one reads by its symbol, which keeps the plot tall with four currencies.
      title: { display: !k, text: sw.curs.length > 1 ? 'Gross pay a year' : 'Gross pay (' + c + ' a year)', color: muted, font: { size: 11 } },
      ticks: { color: muted, maxTicksLimit: 9, font: { size: 11 }, callback: v => money(v, c, true) },
      grid: k ? { drawOnChartArea: false, color: grid } : { color: grid } };
  });
  const zoom = SharedZoom.options({ min: 0, max: sw.xMax, points: 61 });
  if(sw.curs.length > 1 && zoom.limits){
    const base = zoom.limits.x;
    sw.curs.forEach((c, k) => { zoom.limits[AX[k]] = { min: 0, max: span(c), minRange: E.convert(base.minRange, cc, c) }; });
  }
  const options = {
    responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: SharedChartTip.options({
        backgroundColor: cssVar('--panel'), titleColor: text, bodyColor: muted, borderColor: grid, borderWidth: 1, padding: 10,
        callbacks: {
          title: items => items.length ? 'Gross ' + grossAt(items[0].parsed.x) + ' a year' + (items[0].raw && items[0].raw.own ? ' (as entered)' : '') : '',
          label: ctx => '  ' + ctx.dataset.label + ': ' + yText(ctx),
          afterBody(items){
            if(!items.length) return;
            $('hoverBox').textContent = 'Gross ' + grossAt(items[0].parsed.x) + ' a year  |  '
              + items.map(it => it.dataset.label + ': ' + yText(it, true)).join('  |  ');
          }
        }
      }),
      zoom,
      sharedYFit: { auto: { axes: ['y'] } }
    },
    scales: Object.assign(xScales, {
      y: { title: { display: true, text: amt ? 'Take-home pay (' + cc + ' a year)' : 'Take-home (% of gross)', color: muted, font: { size: 11 } },
        ticks: { color: muted, font: { size: 11 }, callback: v => amt ? money(v, cc, true) : v + '%' }, grid: { color: grid } }
    })
  };
  $('chartTitle').textContent = chartTitle();
  if(chart) chart.destroy();
  chart = new Chart($('chartCanvas'), { type: 'line', data: { datasets }, options, plugins: [SharedZoom.plugin] });
  renderLegend(datasets);
}

/* ───────────────────────── Tables ───────────────────────── */
const STATUS = {
  official: ['badge-success', 'Official', 'Confirmed on a government or statutory page.'],
  secondary: ['badge-warning', 'Secondary', 'Confirmed by a Big Four firm, law firm, payroll vendor or a calculator citing the rule. Pending official confirmation.'],
  assumption: ['badge-info', 'Assumption', 'A modelling choice, stated so you can weigh it.']
};
const badge = s => { const b = STATUS[s] || STATUS.secondary; return '<span class="badge ' + b[0] + '" data-tip="' + esc(b[2]) + '">' + b[1] + '</span>'; };
function compareRows(results){
  const rows = [
    ['Gross pay', r => r.gross, 'total'],
    ['Income tax, all levels', r => r.incomeTax],
    ['Employee contributions', r => r.social],
    ['Other deductions from pay', r => r.other, '', rs => rs.some(r => r.other > 0)],
    ['Take-home pay', r => r.net, 'total'],
    ['Take-home share of gross', r => r.net/r.gross, 'pct'],
    ['Marginal rate, next 1% of pay', r => r.marginal, 'pct']
  ];
  return rows.filter(row => !row[3] || row[3](results.filter(r => !r.notSupported)));
}
function renderCompare(results){
  const curNote = disp().cur === 'local' ? 'own currency' : disp().cur;
  let h = '<table><thead><tr><th>Item <span class="th-unit">' + esc(perWord() + ', ' + curNote) + '</span></th>';
  results.forEach((r, i) => { h += '<th><span class="job-dot" style="background:' + colourOf(i) + '"></span>' + esc(jobTitle(JOBS[i], i)) + '</th>'; });
  h += '</tr></thead><tbody>';
  compareRows(results).forEach(([label, fn, cls]) => {
    h += '<tr' + (cls === 'total' ? ' class="total"' : '') + '><td>' + esc(label) + '</td>';
    results.forEach(r => {
      if(r.notSupported){ h += '<td>—</td>'; return; }
      const v = fn(r);
      h += '<td>' + (cls === 'pct' ? (v == null ? '—' : pct(v)) : esc(showMoney(v, r))) + '</td>';
    });
    h += '</tr>';
  });
  h += '</tbody></table>';
  $('compareWrap').innerHTML = h;
}
const KIND_WORD = { tax: 'Tax', social: 'Contribution', other: 'From pay', benefit: 'Tax-free cash', deduction: 'Deduction', credit: 'Credit', employer: 'Employer, on top', info: 'Note' };
// The breakdown shows one job at a time, picked beside its title. It follows the job the form
// shows until the reader picks another, and falls back to job 1 when the one picked is removed.
let linesPick = null;
const SRC_TIP = '<ul><li><strong>Official:</strong> confirmed on a government page.</li><li><strong>Secondary:</strong> a Big Four, law firm or payroll source citing the rule.</li><li><strong>Assumption:</strong> a stated modelling choice.</li></ul>';
function linesJobIndex(n){
  const i = linesPick == null ? ACTIVE : linesPick;
  return i >= 0 && i < n ? i : 0;
}
function renderLinesPicker(results){
  const sel = $('linesJob'), idx = linesJobIndex(results.length);
  sel.innerHTML = results.map((r, i) => '<option value="' + i + '">' + esc(jobTitle(JOBS[i], i)) + '</option>').join('');
  sel.value = String(idx);
  const many = results.length > 1;
  sel.hidden = !many; $('linesJobLabel').hidden = !many;
  return idx;
}
function renderLines(results){
  const i = renderLinesPicker(results);
  const r = results[i], job = JOBS[i], c = E.C[job.country];
  let h = '<div class="job-block">';
  h += '<p class="job-meta"><span class="job-dot" style="background:' + colourOf(i) + '"></span><strong>' + esc(jobTitle(job, i)) + '</strong>'
    + '<span class="job-meta-sep">·</span>' + esc(c.year) + (c.place ? ' · ' + esc(c.place) : '') + ' · amounts in ' + esc(r.cur) + ' ' + esc(perWord()) + '</p>';
  if(r.notSupported){ $('linesWrap').innerHTML = h + '<div class="warning ns">' + esc(r.reason) + '</div></div>'; return; }
  h += '<div class="table-wrap explainer"><table class="lines-table"><colgroup><col class="c-line"><col class="c-kind"><col class="c-amt"><col class="c-status"><col class="c-src"><col class="c-from"></colgroup>'
    + '<thead><tr><th class="l">Line</th><th class="l">Kind</th><th class="r">Amount <span class="th-unit">' + esc(r.cur) + '</span></th><th>Status</th>'
    + '<th class="l">Source <i class="tip-icon" data-tip="' + esc(SRC_TIP) + '"></i></th><th class="l">From</th></tr></thead><tbody>';
  const blank = '<td></td><td></td><td></td>';
  h += '<tr class="total"><td>Gross pay</td><td></td><td class="amt">' + esc(money(r.gross/perDiv(), r.cur)) + '</td>' + blank + '</tr>';
  r.lines.forEach(l => {
    const summed = ['tax', 'social', 'other', 'benefit'].includes(l.kind);
    const src = E.SRC[l.src] || { name: '', url: '' };
    const amt = (l.kind === 'info' && !l.amount) ? '' : (summed && l.kind !== 'benefit' ? '−' : l.kind === 'benefit' ? '+' : '') + money(l.amount/perDiv(), r.cur).replace('−', '');
    h += '<tr' + (summed ? '' : ' class="sub"') + '><td>' + esc(l.label) + '</td><td class="note">' + esc(KIND_WORD[l.kind] || '') + '</td><td class="amt">' + esc(amt) + '</td>'
      + '<td class="st">' + badge(l.status) + '</td><td class="src">' + (src.url ? '<a href="' + esc(src.url) + '" target="_blank" rel="noopener">' + esc(src.name) + '</a>' : esc(src.name)) + '</td><td class="note from">' + esc(l.from) + '</td></tr>';
  });
  h += '<tr class="total"><td>Take-home pay</td><td></td><td class="amt">' + esc(money(r.net/perDiv(), r.cur)) + '</td>' + blank + '</tr>';
  h += '</tbody></table></div>';
  if(r.notes && r.notes.length) h += '<ul class="job-notes">' + r.notes.map(n => '<li>' + esc(n) + '</li>').join('') + '</ul>';
  h += '</div>';
  $('linesWrap').innerHTML = h;
}

/* ───────────────────────── What this assumes ───────────────────────── */
const SIT_FIELDS = ['auRes','sgRes','usRes','deClass','idRes','myRes','noRes','seRes','fiRes','itImp','frCadre','esRegime','ptRegime','jpRes','krMethod','cnRes','twRes','gulfNat','beStatus','chStatus','usFiling','caProv','usState','ukRegion'];
function optionText(id, v){
  const el = $(id);
  if(!el || el.tagName !== 'SELECT') return '';
  const o = [...el.options].find(o => o.value === String(v));
  return o ? o.textContent.trim() : '';
}
function renderAssumptions(results){
  const li = [];
  results.forEach((r, i) => {
    const job = JOBS[i], c = E.C[job.country];
    const sit = SIT_FIELDS.filter(f => Object.prototype.hasOwnProperty.call(job, f)).map(f => optionText(f, job[f])).filter(Boolean);
    let line = '<strong>' + esc(jobTitle(job, i)) + ':</strong> ' + esc(c.year) + ' rules' + (c.place ? ' for ' + esc(c.place) : '') + (sit.length ? ', ' + esc(sit.join(', ').toLowerCase()) : '') + '.';
    if(r.solved) line += ' Gross pay is solved so take-home reaches ' + esc(money(r.target, r.cur)) + ' a year.';
    if(r.notSupported) line += ' Not worked out: ' + esc(r.reason);
    li.push(line);
    (r.notes || []).forEach(n => li.push('<strong>' + esc(c.name) + ':</strong> ' + esc(n)));
    const flagged = (r.lines || []).filter(l => l.status === 'assumption' && ['tax', 'social', 'credit'].includes(l.kind));
    flagged.forEach(l => li.push('<strong>' + esc(c.name) + ':</strong> ' + esc(l.label) + ' is a stated modelling choice.'));
  });
  const curs = new Set(results.map(r => r.cur));
  if(disp().cur !== 'local' || curs.size > 1)
    li.push('<strong>Exchange rates</strong> are those of ' + E.FX_DATE + ' (<a href="' + esc(FX_SRC.url) + '" target="_blank" rel="noopener">' + esc(FX_SRC.name) + '</a>' + (LIVE ? '' : ', bundled with the page') + '), for reading only: every sum is worked out in the job\'s own currency.');
  li.push('<strong>Employment income only.</strong> No bonuses, equity, benefits in kind, other income, tax treaties or foreign tax credits.');
  li.push('<strong>A full year</strong> in one job. Where a rule changes mid-year (a cap from 1 July, a rate from 1 June) each month is worked out and summed.');
  $('assumptions').innerHTML = li.map(x => '<li>' + x + '</li>').join('');
}

/* ───────────────────────── Render ───────────────────────── */
let last = null;
function render(){
  applyVisibility();
  syncActive();
  const results = JOBS.map(computeJob);
  last = { results };
  renderJobs(results);
  renderVerdict(results);
  renderMetrics(results);
  updateChart(results);
  renderCompare(results);
  renderLines(results);
  renderAssumptions(results);
}

/* ───────────────────────── Exports ───────────────────────── */
function downloadBlob(content, filename, type){
  const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const q = v => '"' + String(v).replace(/"/g, '""') + '"';
function exportCsv(){
  if(!last) return;
  const { results } = last, rows = [];
  rows.push([q('Global Income Tax Calculator, tool.adjiebrotots.com/global-income-tax-calculator')]);
  rows.push([q('Amounts ' + perWord() + ', ' + (disp().cur === 'local' ? 'each job in its own currency' : disp().cur))]);
  rows.push([q('Item')].concat(results.map((r, i) => q(jobTitle(JOBS[i], i) + ' (' + (disp().cur === 'local' ? r.cur : disp().cur) + ')'))));
  compareRows(results).forEach(([label, fn, cls]) => {
    rows.push([q(label)].concat(results.map(r => {
      if(r.notSupported) return q('');
      const v = fn(r);
      return cls === 'pct' ? q(v == null ? '' : (v*100).toFixed(2) + '%') : q(Math.round(shown(v, r).v));
    })));
  });
  downloadBlob(rows.map(r => r.join(',')).join('\n'), 'global-salary-comparison.csv', 'text/csv;charset=utf-8;');
}
function exportLinesCsv(){
  if(!last) return;
  const rows = [[q('Job'), q('Country'), q('Line'), q('Kind'), q('Amount a year'), q('Currency'), q('Status'), q('Source'), q('Source URL'), q('Effective from')].join(',')];
  last.results.forEach((r, i) => {
    if(r.notSupported){ rows.push([q(i + 1), q(E.C[JOBS[i].country].name), q('Not worked out: ' + r.reason)].join(',')); return; }
    rows.push([q(i + 1), q(E.C[r.country].name), q('Gross pay'), q(''), q(r.gross.toFixed(2)), q(r.cur), q(''), q(''), q(''), q('')].join(','));
    r.lines.forEach(l => {
      const s = E.SRC[l.src] || {};
      rows.push([q(i + 1), q(E.C[r.country].name), q(l.label), q(KIND_WORD[l.kind] || l.kind), q(l.amount.toFixed(2)), q(r.cur), q(l.status), q(s.name || ''), q(s.url || ''), q(l.from)].join(','));
    });
    rows.push([q(i + 1), q(E.C[r.country].name), q('Take-home pay'), q(''), q(r.net.toFixed(2)), q(r.cur), q(''), q(''), q(''), q('')].join(','));
  });
  downloadBlob(rows.join('\n'), 'global-salary-lines.csv', 'text/csv;charset=utf-8;');
}
// The title follows the measure the chart reads (the h2 on the page and the exports alike).
const chartTitle = () => chartMeasure() === 'amount' ? 'Take-home pay across the pay range' : 'Take-home share across the pay range';
function chartSubtitle(){
  if(!last) return '';
  return last.results.map((r, i) => r.notSupported ? jobTitle(JOBS[i], i) + ': not loaded' : jobTitle(JOBS[i], i) + ' ' + pct(r.net/r.gross)).join(' · ');
}
function chartPng(){ const a = arguments; return SharedExport.atDesktopSize('chartCanvas', () => chartPngAtSize.apply(null, a)); }
function chartPngAtSize(){
  const src = $('chartCanvas');
  const pad = 28, headH = 74, footH = 34;
  const items = SharedLegend.itemsOf('chartLegend');
  const K = 1.4, markW = SharedLegend.W*K, gap = 10, itemGap = 26, legendH = items.length ? 34 : 0;
  const dpr = window.devicePixelRatio || 1, OUT = 3;
  const plotW = Math.round(src.width/dpr), plotH = Math.round(src.height/dpr);
  const outW = plotW + pad*2, outH = plotH + headH + legendH + footH + pad;
  const out = document.createElement('canvas');
  out.width = outW*OUT; out.height = outH*OUT;
  const ctx = out.getContext('2d');
  ctx.scale(OUT, OUT);
  ctx.fillStyle = cssVar('--panel') || '#fff'; ctx.fillRect(0, 0, outW, outH);
  ctx.fillStyle = cssVar('--text'); ctx.font = '700 26px "DM Sans", sans-serif';
  ctx.fillText(chartTitle(), pad, pad + 22);
  ctx.fillStyle = cssVar('--muted'); ctx.font = '400 15px "DM Sans", sans-serif';
  ctx.fillText(chartSubtitle(), pad, pad + 48);
  ctx.drawImage(src, pad, headH, plotW, plotH);
  if(items.length){
    ctx.font = '500 15px "DM Sans", sans-serif'; ctx.textBaseline = 'middle';
    const widths = items.map(it => markW + gap + ctx.measureText(it.label).width);
    const totalW = widths.reduce((a, b) => a + b, 0) + itemGap*(items.length - 1);
    let x = Math.max(pad, (outW - totalW)/2);
    const cy = headH + plotH + legendH/2;
    items.forEach((it, i) => {
      SharedLegend.paint(ctx, it.swatch || { color: it.color }, x, cy, K);
      x += markW + gap; ctx.fillStyle = cssVar('--text'); ctx.fillText(it.label, x, cy);
      x += widths[i] - markW - gap + itemGap;
    });
    ctx.textBaseline = 'alphabetic';
  }
  ctx.fillStyle = cssVar('--muted'); ctx.font = '400 13px "DM Sans", sans-serif';
  ctx.fillText('Made using tool.adjiebrotots.com/global-income-tax-calculator', pad, outH - 14);
  return out;
}
function chartSvg(){ const a = arguments; return SharedExport.atDesktopSize('chartCanvas', () => chartSvgAtSize.apply(null, a)); }
function chartSvgAtSize(){
  const src = $('chartCanvas'), NS = 'http://www.w3.org/2000/svg', XL = 'http://www.w3.org/1999/xlink';
  const dpr = window.devicePixelRatio || 1, plotW = Math.round(src.width/dpr), plotH = Math.round(src.height/dpr);
  const pad = 20, headH = 64, footH = 24;
  const items = SharedLegend.itemsOf('chartLegend');
  const markW = SharedLegend.W, gap = 7, itemGap = 19, legendH = items.length ? 24 : 0;
  const W = plotW + pad*2, H = plotH + headH + legendH + footH + pad;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('xmlns', NS); svg.setAttribute('xmlns:xlink', XL);
  svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  const text = (str, x, y, size, weight, fill, anchor) => {
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', x); t.setAttribute('y', y); t.setAttribute('font-family', '"DM Sans", sans-serif');
    t.setAttribute('font-size', size); t.setAttribute('font-weight', weight); t.setAttribute('fill', fill);
    if(anchor) t.setAttribute('dominant-baseline', anchor);
    t.textContent = str; svg.appendChild(t); return t;
  };
  const bg = document.createElementNS(NS, 'rect');
  bg.setAttribute('width', W); bg.setAttribute('height', H); bg.setAttribute('fill', cssVar('--panel') || '#fff'); svg.appendChild(bg);
  text(chartTitle(), pad, pad + 16, 19, 700, cssVar('--text'));
  text(chartSubtitle(), pad, pad + 34, 11, 400, cssVar('--muted'));
  const img = document.createElementNS(NS, 'image');
  img.setAttribute('x', pad); img.setAttribute('y', headH); img.setAttribute('width', plotW); img.setAttribute('height', plotH);
  const href = src.toDataURL('image/png');
  img.setAttribute('href', href); img.setAttributeNS(XL, 'href', href); svg.appendChild(img);
  if(items.length){
    const mc = document.createElement('canvas').getContext('2d');
    mc.font = '500 11px "DM Sans", sans-serif';
    const widths = items.map(it => markW + gap + mc.measureText(it.label).width);
    const totalW = widths.reduce((a, b) => a + b, 0) + itemGap*(items.length - 1);
    let x = Math.max(pad, (W - totalW)/2);
    const cy = headH + plotH + legendH/2;
    items.forEach((it, i) => {
      svg.appendChild(SharedLegend.svgNode(it.swatch || { color: it.color }, x, cy, 1));
      x += markW + gap; text(it.label, x, cy, 11, 500, cssVar('--text'), 'middle');
      x += widths[i] - markW - gap + itemGap;
    });
  }
  text('Made using tool.adjiebrotots.com/global-income-tax-calculator', pad, H - 10, 10, 400, cssVar('--muted'));
  const xml = '<?xml version="1.0" encoding="utf-8"?>\n' + new XMLSerializer().serializeToString(svg);
  downloadBlob(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }), 'global-income-tax-calculator.svg');
}
function exportPng(){ chartPng().toBlob(b => downloadBlob(b, 'global-income-tax-calculator.png')); }

/* ───────────────────────── Quick Start ───────────────────────── */
/* Each opens from the page's defaults, so none inherits what was on screen. */
const QUICK_START = {
  asia: { dispCur: 'USD', jobs: [
    { country: 'SG', amount: '180,000', sgRes: 'ep' },
    { country: 'HK', amount: '1,300,000' },
    { country: 'JP', amount: '15,000,000', jpRes: 'y2' },
    { country: 'AE', amount: '600,000', gulfNat: 'expat' } ] },
  europe: { dispCur: 'EUR', jobs: [
    { country: 'GB', amount: '95,000', ukRegion: 'ruk' },
    { country: 'NL', amount: '95,000', nlRuling: true, nlHoliday: false },
    { country: 'DE', amount: '95,000', deClass: 'I' },
    { country: 'CH', amount: '140,000', chStatus: 'single' } ] },
  us: { dispCur: 'local', jobs: [
    { country: 'US', amount: '150,000', usState: 'TX', usFiling: 'S' },
    { country: 'US', amount: '150,000', usState: 'CA', usFiling: 'S' },
    { country: 'US', amount: '150,000', usState: 'NY', usNyc: true, usFiling: 'S' },
    { country: 'US', amount: '150,000', usState: 'IL', usFiling: 'S' } ] },
  net: { dispCur: 'local', dispPer: 'month', jobs: [
    { country: 'FR', dir: 'net', amount: '4,000', period: 'monthly', frCadre: 'cadre' },
    { country: 'ES', dir: 'net', amount: '4,000', period: 'monthly' },
    { country: 'PT', dir: 'net', amount: '4,000', period: 'monthly' },
    { country: 'IT', dir: 'net', amount: '4,000', period: 'monthly' } ] },
  family: { dispCur: 'local', jobs: [
    { country: 'BE', amount: '80,000', beStatus: 'married', beKids: '2' },
    { country: 'FR', amount: '80,000', frCadre: 'cadre', frMarried: true, frKids: '2' },
    { country: 'DE', amount: '80,000', deClass: 'III', deKids: true },
    { country: 'NL', amount: '80,000', nlHoliday: false } ] }
};
function clearQuickStart(){ document.querySelectorAll('.quick-start-btn').forEach(b => b.classList.remove('active')); }
function applyQuickStart(key){
  const s = QUICK_START[key];
  if(!s) return false;
  JOBS = s.jobs.map(j => fullJob(j));
  ACTIVE = 0;
  writeJob(JOBS[0]);
  $('dispCur').value = s.dispCur || 'local';
  $('dispPer').value = s.dispPer || 'year';
  document.querySelectorAll('.quick-start-btn').forEach(b => b.classList.toggle('active', b.dataset.preset === key));
  // save(), not schedule(): what is on screen is the scenario now.
  if(persist) persist.save();
  render();
  return true;
}
window.GSC_QS = Object.keys(QUICK_START);

/* ───────────────────────── Wiring ───────────────────────── */
function sanitizeJobs(list){
  if(!Array.isArray(list)) return null;
  const out = list.filter(j => j && typeof j === 'object').slice(0, MAX_JOBS).map(j => fullJob(j));
  return out.length ? out : null;
}
function init(){
  FIELDS = [...scope.querySelectorAll('input, select')].filter(el => el.id && !el.closest('[data-no-persist]'));
  FIELDS.forEach(el => { DEFAULTS[handle(el)] = valueOf(el); });

  // Counts read in figures; a choice in words (Gross pay, Year) keeps the page's own font.
  document.querySelectorAll('select.seg-src').forEach(sel => SharedSeg.fromSelect(sel, {
    labelOf: o => o.textContent.trim(),
    className: /^\d/.test(sel.options[0].value) ? '' : 'seg-words',
    ariaLabel: (sel.closest('.field-row, .view-opt') && sel.closest('.field-row, .view-opt').querySelector('.field-label, .view-label') || {}).textContent || sel.id
  }));
  // Country, state and province are searchable: type a few letters instead of scrolling. The select stays the field of record.
  if(window.SharedDropdown && SharedDropdown.searchable){
    SharedDropdown.searchable($('country'), { placeholder: 'Search country…', chip: o => (E.C[o.value] || {}).cur || '' });
    SharedDropdown.searchable($('usState'), { placeholder: 'Search state…', chip: o => o.value });
    SharedDropdown.searchable($('caProv'), { placeholder: 'Search province…', chip: o => o.value });
  }
  scope.querySelectorAll('.fmt-num').forEach(el => SharedFmt.attachCurrencyInput(el, { maxDecimals: 2 }));
  scope.querySelectorAll('.fmt-pct').forEach(el => SharedFmt.attachCurrencyInput(el, { maxDecimals: 3 }));
  SharedFreq.attachSelect($('period'), $('amount'), { maxDecimals: 2 });

  document.querySelectorAll('.ctrl-tab').forEach(tab => tab.addEventListener('click', () => {
    document.querySelectorAll('.ctrl-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.ctrl-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    $('tab-' + tab.dataset.tab).classList.add('active');
    fitPrefixes();
  }));

  // Typing a search into a picker is not a change: the pick itself fires on its select.
  const fromForm = e => !(e.target && e.target.classList && e.target.classList.contains('combo-input'));
  scope.addEventListener('input', e => { if(fromForm(e)){ clearQuickStart(); render(); } });
  scope.addEventListener('change', e => { if(fromForm(e)){ clearQuickStart(); render(); } });
  $('dispCur').addEventListener('change', render);
  $('dispPer').addEventListener('change', render);
  $('addJob').addEventListener('click', addJob);

  $('themeToggle').addEventListener('click', () => {
    document.body.classList.toggle('light');
    $('themeToggle').textContent = document.body.classList.contains('light') ? '🌙 Dark' : '☀️ Light';
    if(last) updateChart(last.results);
  });
  $('csvBtn').addEventListener('click', exportCsv);
  $('linesCsvBtn').addEventListener('click', exportLinesCsv);
  $('linesJob').addEventListener('change', () => { linesPick = Number($('linesJob').value); if(last) renderLines(last.results); });
  $('chartMeasure').addEventListener('change', () => { if(last) updateChart(last.results); });
  $('svgBtn').addEventListener('click', chartSvg);
  $('pngBtn').addEventListener('click', exportPng);
  $('copyBtn').addEventListener('click', () => SharedShare.copyImage(() => chartPng(), $('copyBtn')));
  $('resetZoomBtn').addEventListener('click', () => { if(chart) chart.resetZoom(); });
  $('chartCanvas').addEventListener('mouseleave', () => { $('hoverBox').textContent = 'Hover the chart to read each job\'s take-home at that gross pay.'; });
  document.querySelectorAll('.quick-start-btn').forEach(b => b.addEventListener('click', () => applyQuickStart(b.dataset.preset)));

  startLive();
  JOBS = DEFAULT_JOBS().map(j => j ? fullJob(j) : readJob());
  ACTIVE = 0;

  let restoredJobs = null, restoredAgent = false;
  persist = Persist.init('global-salary-calculator', {
    onRestore: () => {
      // The fields are the active job as saved (or as an AI link set it); they win over its copy in extra.
      if(restoredJobs){ JOBS = restoredJobs; ACTIVE = Math.min(Math.max(0, ACTIVE), JOBS.length - 1); }
      else { JOBS = [readJob()]; ACTIVE = 0; }
      // An AI link's json jobs already carry the fields it named; anywhere else the fields win.
      if(!restoredAgent) JOBS[ACTIVE] = fullJob(readJob());
      writeJob(JOBS[ACTIVE]);
      restoredJobs = null; restoredAgent = false;
      render();
    },
    extra: {
      // Each job keeps only what differs from the page's defaults (and its country), so links stay short.
      save: () => { syncActive(); return { jobs: JOBS.map(compactJob), active: ACTIVE }; },
      restore: saved => {
        restoredAgent = !!(saved && saved.agentJobs);
        restoredJobs = saved && sanitizeJobs(saved.jobs);
        ACTIVE = saved && Number.isInteger(saved.active) ? saved.active : 0;
      }
    }
  });
  SharedScenario.mount('.quick-start-row', { tool: 'global-salary-calculator', persist });
  SharedFold.attach($('linesSection'), { key: 'global-salary-calculator-lines', bodies: ['.lines-body'] });
  render();

  openFromComparator();

  // The tour's example and its hand-back (tour.js): Asia hubs in each job's own currency.
  window.__GSC_TOUR = {
    seed(){ applyQuickStart('asia'); $('dispCur').value = 'local'; $('dispCur').dispatchEvent(new Event('change')); },
    saveState(){ syncActive(); return { jobs: JSON.parse(JSON.stringify(JOBS)), active: ACTIVE, dispCur: $('dispCur').value, dispPer: $('dispPer').value,
      qs: (document.querySelector('.quick-start-btn.active') || {}).dataset }; },
    restoreState(snap){
      if(!snap || !Array.isArray(snap.jobs) || !snap.jobs.length) return;
      JOBS = snap.jobs; ACTIVE = Math.min(snap.active || 0, JOBS.length - 1);
      writeJob(JOBS[ACTIVE]);
      $('dispCur').value = snap.dispCur || 'local';
      $('dispPer').value = snap.dispPer || 'year';
      $('dispPer').dispatchEvent(new Event('change'));
      clearQuickStart();
      if(snap.qs && snap.qs.preset) document.querySelectorAll('.quick-start-btn').forEach(b => b.classList.toggle('active', b.dataset.preset === snap.qs.preset));
      if(persist) persist.save();
      render();
    }
  };

  window.__GSC = { E, JOBS: () => JOBS, active: () => ACTIVE, compute: computeJob, readJob, writeJob, applyQuickStart, pickJob, addJob, removeJob, render };
}

/* ═════════════════════ From the Cost of Living Comparator ═════════════════════
   The comparator points here under a salary in a city whose rules are loaded
   (gitcHint in costofliving-comparator/script.js), with the city as fields:
     #from=col&country=US&usState=CA[&usNyc=true|caProv=ON|ukRegion=sco]
       &dir=gross|net[&amount=<monthly>]&period=monthly
   It opens one job on that place, per month, and the hash leaves the address
   so a reload keeps the reader's own edits. Only these keys are read; a value
   the form does not hold is skipped, never thrown on. */
const FROM_COL_KEYS = ['country', 'usState', 'usNyc', 'caProv', 'ukRegion', 'dir', 'amount', 'period'];
function openFromComparator(){
  const h = location.hash || '';
  if(!/^#from=col(&|$)/.test(h)) return;
  const q = new URLSearchParams(h.slice(1));
  try { history.replaceState(null, '', location.pathname + location.search); } catch(e){}
  const country = String(q.get('country') || '').toUpperCase();
  if(!E.C[country]) return;
  const job = { country };
  FROM_COL_KEYS.forEach(k => {
    if(k === 'country' || !q.has(k)) return;
    const el = FIELDS.find(f => handle(f) === k), v = q.get(k);
    if(!el) return;
    if(el.tagName === 'SELECT' && ![...el.options].some(o => o.value === v)) return;
    if(k === 'amount'){
      const n = Number(v);
      if(isFinite(n) && n > 0) job.amount = SharedFmt.formatThousands(String(Math.min(n, 1e11)), { maxDecimals: 2 });
      return;
    }
    job[k] = el.type === 'checkbox' ? v === 'true' : v;
  });
  if(!job.amount) job.amount = job.period === 'monthly' ? '10,000' : DEFAULTS.amount;
  JOBS = [fullJob(job)];
  ACTIVE = 0;
  writeJob(JOBS[0]);
  $('dispCur').value = 'local';
  $('dispPer').value = job.period === 'monthly' ? 'month' : 'year';
  $('dispPer').dispatchEvent(new Event('change'));
  clearQuickStart();
  if(persist) persist.save();
  render();
  const place = jobPlace(JOBS[0]);
  const note = document.createElement('div');
  note.className = 'from-col card';
  note.setAttribute('role', 'status');
  note.innerHTML = '<span class="from-col-text"><strong>Opened from the Cost of Living Comparator</strong> on ' + esc(place) + ', per month. '
    + (job.dir === 'net' ? 'The gross pay shown is what leaves the net income it needs.' : 'Enter the gross salary to see the take-home pay.')
    + ' Set residency and household on the left to match you.</span>' + SharedIcon.button('close', 'Dismiss', 'from-col-close');
  note.querySelector('.from-col-close').addEventListener('click', () => note.remove());
  $('verdict').insertAdjacentElement('beforebegin', note);
  if(job.dir !== 'net') setTimeout(() => { try { $('amount').focus({ preventScroll: true }); $('amount').select(); } catch(e){} }, 300);
}

/* ═════════════════════ AI links ═════════════════════
   A #load link (SharedAgent, shared.js) names fields by their ids: those set
   job 1, the job the form shows. Three ways a link can describe the jobs:
   - fields alone: one job, the one the fields describe;
   - qs=<Quick Start>: its four jobs, with any field named laid over job 1;
   - json={"jobs":[{...},...]}: up to four jobs, each an object of the same
     field ids, with any field named outside the json laid over job 1.
   The adapter leaves a mark (agentJobs) in extra so the load keeps the jobs as
   the link gave them; save() never writes it. */
let agentQs = false, agentJson = false;
function agentValue(el, raw, api, label){
  if(el.type === 'checkbox'){
    const t = String(raw).trim().toLowerCase();
    if(['true', '1', 'on', 'yes'].includes(t) || raw === true) return true;
    if(['false', '0', 'off', 'no'].includes(t) || raw === false) return false;
    api.error(label + ': not true or false'); return undefined;
  }
  if(el.tagName === 'SELECT'){
    const v = String(raw).trim(), opts = [...el.options];
    const o = opts.find(o => o.value === v) || opts.find(o => o.textContent.trim().toLowerCase() === v.toLowerCase());
    if(!o){ api.error(label + ' "' + v.slice(0, 30) + '": not one of ' + opts.map(o => o.value).join(', ')); return undefined; }
    return o.value;
  }
  const n = api.number(String(raw));
  if(!isFinite(n)){ api.error(label + ': not a number'); return undefined; }
  const lo = +el.getAttribute('data-min'), hi = +el.getAttribute('data-max');
  const used = Math.min(isFinite(hi) ? hi : Infinity, Math.max(isFinite(lo) ? lo : -Infinity, n));
  if(used !== n) api.clamp(label, n, used);
  return SharedFmt.formatThousands(String(used), { maxDecimals: el.classList.contains('fmt-pct') ? 3 : 2 });
}
function agentJsonJobs(obj, extra, api){
  const list = obj && (Array.isArray(obj.jobs) ? obj.jobs : Array.isArray(obj) ? obj : null);
  if(!list){ api.error('json: send {"jobs":[{"country":"SG","amount":150000}, ...]}'); return false; }
  if(list.length > MAX_JOBS) api.error('json: only the first ' + MAX_JOBS + ' jobs are used');
  const jobs = [];
  list.slice(0, MAX_JOBS).forEach((j, n) => {
    const tag = 'job ' + (n + 1);
    if(!j || typeof j !== 'object' || !E.C[String(j.country || '').toUpperCase()]){ api.error(tag + ': country must be one of ' + Object.keys(E.C).join(', ')); return; }
    const out = { country: String(j.country).toUpperCase() };
    Object.keys(j).forEach(h => {
      if(h === 'country') return;
      const el = FIELDS.find(f => handle(f) === h);
      if(!el){ api.unknown('json.' + h); return; }
      const v = agentValue(el, j[h], api, tag + ' ' + h);
      if(v !== undefined) out[h] = v;
    });
    jobs.push(out);
  });
  if(!jobs.length) return false;
  extra.jobs = jobs; extra.active = 0; agentJson = true;
  return { value: jobs.length + (jobs.length > 1 ? ' jobs: ' : ' job: ') + jobs.map((j, i) => jobPlace(fullJob(j))).join(', ') };
}
if(window.SharedAgent) SharedAgent.register({
  tool: 'global-salary-calculator',
  preset: key => {
    if(!applyQuickStart(key)) return false;
    agentQs = true;
    return (document.querySelector('.quick-start-btn[data-preset="' + key + '"]') || {}).textContent || true;
  },
  json: agentJsonJobs,
  patch: (extra, api) => {
    if(agentJson){
      const j0 = extra.jobs[0];
      FIELDS.forEach(el => { const h = handle(el); if(api.given(h) && api.applied(h)) j0[h] = api.field(h); });
      extra.agentJobs = true;
    } else if(!agentQs){
      extra.jobs = null; extra.active = 0;     // the fields describe the one job
    }
  },
  describe: key => key === 'json' ? { label: 'Jobs', el: $('jobsList') } : null
});

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();
