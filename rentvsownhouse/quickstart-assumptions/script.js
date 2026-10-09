/* ── QUICK START ASSUMPTIONS ──
   Draws every table on this page from ../quickstart-data.js, the same file the
   calculator's Quick Start and the Sensitivity tool read, so the page cannot
   drift from what a Quick Start loads: change a figure there and it changes
   here. Figures in a table are the RESOLVED form values (RVO_QS.preset), the
   exact numbers the calculator is given, not a copy of them. */
(function(){
'use strict';

const QS = window.RVO_QS;
const D = QS.data;
const $ = id => document.getElementById(id);
const PER_YEAR = {weekly:52, monthly:12, yearly:1};
const PER_WORD = {weekly:'week', monthly:'month', yearly:'year'};
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/* ── formatting ── */
function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
// An alphabetic symbol (Rp, RM, CHF, Dh) takes a space before the figure.
const symPre = sym => /[A-Za-z]$/.test(sym) ? sym + ' ' : sym;
const num = (v, dp) => Number(v).toLocaleString('en-US', {minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0});
function money(v, sym){ return symPre(sym) + num(Math.round(v)); }
function compact(v, sym){
  const a = Math.abs(v);
  const f = (x, u) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1).replace(/\.0$/, '') : x.toFixed(2).replace(/\.?0+$/, '')) + u;
  const s = a >= 1e12 ? f(a / 1e12, 't') : a >= 1e9 ? f(a / 1e9, 'b') : a >= 1e6 ? f(a / 1e6, 'm') : a >= 1e3 ? f(a / 1e3, 'k') : String(Math.round(a));
  return symPre(sym) + s;
}
// As many decimals as the figure has, up to two: 20%, 6.1%, 4.33%.
const pct = (v, dp) => num(v, dp == null ? (Number.isInteger(v) ? 0 : Number.isInteger(Math.round(v * 1000) / 100) ? 1 : 2) : dp) + '%';
function month(ym){
  const m = /^(\d{4})-(\d{2})/.exec(ym || '');
  return m ? MONTHS[+m[2] - 1] + ' ' + m[1] : '';
}
const grossYield = p => p.rentAmount * PER_YEAR[p.rentFreq] / p.propertyPrice * 100;
const rowId = sid => sid.replace('/', '-');

/* ── state ── */
let query = '', form = '';
const visible = c => QS.cityMatches(c, query);
const typeShown = t => !form || QS.type(t).form === form;

/* ── at a glance: every city against every home type ── */
function drawGlance(){
  const types = D.types.filter(t => typeShown(t.key));
  const forms = ['apartment', 'house'].filter(f => types.some(t => t.form === f));
  let h = '<thead><tr><th rowspan="2" class="qa-city-th">City</th>';
  forms.forEach(f => { h += `<th colspan="${types.filter(t => t.form === f).length}" class="qa-form-th">${esc(QS.formText(f))}</th>`; });
  h += '</tr><tr>';
  types.forEach(t => { h += `<th>${esc(t.label.en)}</th>`; });
  h += '</tr></thead><tbody>';
  let region = '', shown = 0;
  D.cities.forEach(c => {
    if(!visible(c)) return;
    shown++;
    if(c.region !== region){
      region = c.region;
      h += `<tr class="qa-region"><td colspan="${types.length + 1}">${esc(region)}</td></tr>`;
    }
    h += `<tr><td class="qa-city-td"><a href="#${esc(c.key)}">${esc(c.city)}</a><span class="qa-sub">${esc(c.country)} · ${esc(c.currencyCode)}</span></td>`;
    types.forEach(t => {
      const p = QS.preset(QS.id(c.key, t.key));
      if(p){
        h += `<td><a class="qa-cell" href="#${esc(rowId(p.id))}" title="${esc(c.city + ', ' + t.name.en)}"><span class="qa-price">${esc(compact(p.propertyPrice, p.currencySymbol))}</span><span class="qa-sub">${esc(pct(grossYield(p), 1))}</span></a></td>`;
      } else {
        const why = (c.unavailable && c.unavailable[t.key]) || 'Not offered in this city.';
        h += `<td class="qa-none"><span class="qa-dash" tabindex="0" role="note" aria-label="${esc(t.name.en + ' not offered: ' + why)}" data-tip="${esc(why)}">—</span></td>`;
      }
    });
    h += '</tr>';
  });
  $('glanceTable').innerHTML = h + '</tbody>';
  $('noResults').style.display = shown ? 'none' : 'block';
  $('glanceTable').style.display = shown ? '' : 'none';
  const n = D.cities.filter(visible).reduce((k, c) => k + QS.homes(c.key).filter(typeShown).length, 0);
  $('qaCount').textContent = `${shown} ${shown === 1 ? 'city' : 'cities'}, ${n} Quick Start ${n === 1 ? 'scenario' : 'scenarios'} · figures as of ${month(D.asOf)}`;
}

/* ── one section per city ── */
// The city-wide form values a home may override, and how to say each.
const CITY_ROWS = [
  {f:'downPaymentPct', label:'Down payment', note:'downPaymentPct', show:(v) => pct(v) + ' of the price'},
  {f:'mortgageRate', label:'Mortgage rate', note:'mortgageRate', show:(v, c) => pct(v) + ' a year'},
  {f:'mortgageTerm', label:'Mortgage term', show:(v) => v + ' years, principal and interest'},
  {f:'riskFreeRate', label:'Risk-free rate', note:'riskFreeRate', show:(v) => pct(v) + ' a year on spare cash'},
  {f:'sellingCostPct', label:'Selling cost', note:'sellingCostPct', show:(v) => pct(v) + ' of the sale price'},
  {f:'rentInflation', label:'Rent growth', note:'rentInflation', show:(v) => pct(v) + ' a year'},
  {f:'ownOngoingInflation', label:'Owner cost inflation', show:(v) => pct(v) + ' a year'},
  {f:'rentOngoingInflation', label:'Renter cost inflation', show:(v) => pct(v) + ' a year'},
  {f:'horizon', label:'Horizon', show:(v) => v + ' years'},
];
// The per-home figures, each with the note on the city that explains it.
const HOME_NOTES = [
  ['houseGrowth', 'Price growth'], ['setupCost', 'Setup cost'],
  ['ownOngoingCost', 'Owner costs'], ['rentOngoingCost', 'Renter costs'],
];

function cityValue(c, row){
  const base = c[row.f] !== undefined ? c[row.f] : D.defaults[row.f];
  let s = esc(row.show(base, c));
  // A home that overrides the city's figure says so beside it.
  const odd = QS.homes(c.key).map(t => QS.preset(QS.id(c.key, t))).filter(p => p[row.f] !== base);
  if(odd.length) s += '<span class="qa-sub">' + odd.map(p => esc(QS.type(p.typeKey).short.en + ': ' + row.show(p[row.f], c))).join('; ') + '</span>';
  return s;
}

function drawCity(c){
  const notes = c.notes || {};
  const freq = c.rentFreq || D.defaults.rentFreq;
  const homes = QS.homes(c.key).filter(typeShown);
  let h = `<section class="card qa-city" id="${esc(c.key)}">`;
  h += `<div class="qa-head"><h2>${esc(c.city)}<span class="qa-h-sub">${esc(c.country)}</span></h2>`;
  h += `<span class="qa-chips"><span class="qa-chip">${esc(c.region)}</span><span class="qa-chip">${esc(c.currencyCode)} (${esc(c.currencySymbol)})</span><span class="qa-chip">as of ${esc(month(c.asOf))}</span></span></div>`;
  if(notes.market) h += `<p class="qa-lead">${esc(notes.market)}</p>`;
  if(c.buyer) h += `<p class="qa-buyer"><strong>Buyer:</strong> ${esc(c.buyer)}</p>`;

  // Homes first: they are what a reader picked.
  if(homes.length){
    const sym = c.currencySymbol;
    h += `<h3>Homes</h3><p class="unit-note">Money in ${esc(c.currencyCode)} (${esc(sym)}). Rent per ${PER_WORD[freq]}, running costs per year.</p>`;
    h += `<div class="qa-table-wrap"><table class="qa-table qa-homes"><thead><tr>
      <th>Home</th><th>Size</th><th>Price</th><th>Rent / ${PER_WORD[freq]}</th><th>Gross yield</th><th>Price growth</th>
      <th>Setup cost</th><th>Owner costs / yr</th><th>Renter costs / yr</th><th></th></tr></thead><tbody>`;
    homes.forEach(t => {
      const sid = QS.id(c.key, t), p = QS.preset(sid), home = c.homes[t];
      const size = home.sqm ? num(home.sqm) + ' m²' + (home.landSqm ? '<span class="qa-sub">land ' + num(home.landSqm) + ' m²</span>' : '') : '—';
      h += `<tr id="${esc(rowId(sid))}">
        <td class="qa-home"><strong>${esc(QS.type(t).name.en)}</strong>${home.where ? `<span class="qa-sub">${esc(home.where)}</span>` : ''}</td>
        <td>${size}</td>
        <td>${esc(money(p.propertyPrice, sym))}</td>
        <td>${esc(money(p.rentAmount, sym))}${p.rentFreq !== freq ? `<span class="qa-sub">per ${PER_WORD[p.rentFreq]}</span>` : ''}</td>
        <td>${esc(pct(grossYield(p), 1))}</td>
        <td>${esc(pct(p.houseGrowth))}</td>
        <td>${esc(pct(p.setupCost, 2))}<span class="qa-sub">${esc(money(p.setupCost / 100 * p.propertyPrice, sym))}</span></td>
        <td>${esc(money(p.ownOngoingCost, sym))}</td>
        <td>${esc(money(p.rentOngoingCost, sym))}</td>
        <td><a class="qa-open" href="../?qs=${encodeURIComponent(sid)}" title="Open this scenario in the calculator">Open →</a></td>
      </tr>`;
    });
    h += '</tbody></table></div>';
  } else {
    h += `<p class="qa-buyer">No ${esc(QS.formText(form).toLowerCase())} scenario in ${esc(c.city)}.</p>`;
  }

  // The city's loan, tax and market terms, each with its basis.
  h += `<h3>City-wide figures</h3><div class="qa-table-wrap"><table class="qa-table qa-terms"><thead><tr><th>Figure</th><th>Value</th><th>Basis</th></tr></thead><tbody>`;
  CITY_ROWS.forEach(r => {
    h += `<tr><td>${esc(r.label)}</td><td class="qa-val">${cityValue(c, r)}</td><td class="qa-basis">${r.note && notes[r.note] ? esc(notes[r.note]) : ''}</td></tr>`;
  });
  HOME_NOTES.forEach(([k, label]) => {
    if(notes[k]) h += `<tr><td>${esc(label)}</td><td class="qa-val">Per home, above</td><td class="qa-basis">${esc(notes[k])}</td></tr>`;
  });
  h += '</tbody></table></div>';

  // Types this market does not have, and why.
  const missing = D.types.filter(t => typeShown(t.key) && c.unavailable && c.unavailable[t.key]);
  if(missing.length){
    h += `<h3>Not offered here</h3><ul class="qa-list">`;
    missing.forEach(t => { h += `<li><strong>${esc(t.name.en)}:</strong> ${esc(c.unavailable[t.key])}</li>`; });
    h += '</ul>';
  }
  if(notes.caveat) h += `<p class="qa-caveat"><strong>What the calculator cannot model here:</strong> ${esc(notes.caveat)}</p>`;

  // The arithmetic behind each home, and the sources: open on request.
  const work = homes.filter(t => c.homes[t].setupCalc || c.homes[t].costCalc);
  const srcs = (c.sources || []).concat(...homes.map(t => c.homes[t].sources || []));
  if(work.length || srcs.length){
    h += `<div class="qa-more"><button type="button" class="qa-more-btn" aria-expanded="false">Workings and sources ▾</button><div class="qa-more-body" hidden>`;
    if(work.length){
      h += '<ul class="qa-list">';
      work.forEach(t => {
        const x = c.homes[t];
        h += `<li><strong>${esc(QS.type(t).name.en)}.</strong> ${x.setupCalc ? 'Setup: ' + esc(x.setupCalc) + ' ' : ''}${x.costCalc ? 'Running costs: ' + esc(x.costCalc) : ''}</li>`;
      });
      h += '</ul>';
    }
    if(srcs.length){
      const seen = new Set();
      h += '<h4>Sources</h4><ul class="qa-list qa-sources">';
      srcs.forEach(s => {
        if(!s || !s.url || seen.has(s.url)) return;
        seen.add(s.url);
        h += `<li><a href="${esc(s.url)}" target="_blank" rel="noopener nofollow">${esc(s.name || s.url)}</a></li>`;
      });
      h += '</ul>';
    }
    h += '</div></div>';
  }
  return h + '</section>';
}

function drawCities(){
  $('cities').innerHTML = D.cities.filter(visible).map(drawCity).join('');
}

function draw(){
  drawGlance();
  drawCities();
}

/* ── CSV: every scenario, every form value it sets ── */
function csv(){
  const cols = ['id', 'city', 'country', 'region', 'home', 'form', 'bedrooms', 'sqm', 'landSqm', 'where', 'currencyCode', 'asOf']
    .concat(QS.FIELDS).concat(['grossYieldPct']);
  const cell = v => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [cols.join(',')];
  QS.all().forEach(sid => {
    const p = QS.preset(sid), c = QS.city(p.cityKey), t = QS.type(p.typeKey), home = c.homes[p.typeKey];
    const row = {id: sid, city: c.city, country: c.country, region: c.region, home: t.name.en, form: t.form,
      bedrooms: t.beds, sqm: home.sqm, landSqm: home.landSqm, where: home.where, currencyCode: c.currencyCode,
      asOf: c.asOf, grossYieldPct: grossYield(p).toFixed(2)};
    QS.FIELDS.forEach(f => { row[f] = p[f]; });
    lines.push(cols.map(k => cell(row[k])).join(','));
  });
  const blob = new Blob(['﻿' + lines.join('\n')], {type: 'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'rentvsown-quickstart-assumptions-' + D.asOf + '.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ── wiring ── */
$('qaSearch').addEventListener('input', e => { query = e.target.value; draw(); });
$('qaForm').addEventListener('click', e => {
  const b = e.target.closest('.seg-btn');
  if(!b) return;
  form = b.dataset.form;
  document.querySelectorAll('#qaForm .seg-btn').forEach(x => x.classList.toggle('active', x === b));
  draw();
});
$('qaCsv').addEventListener('click', csv);
// Each city's workings open on request; the cities are redrawn on every
// filter, so one listener on their container serves them all.
$('cities').addEventListener('click', e => {
  const b = e.target.closest('.qa-more-btn');
  if(!b) return;
  const body = b.nextElementSibling, open = body.hidden;
  body.hidden = !open;
  b.setAttribute('aria-expanded', String(open));
  b.textContent = 'Workings and sources ' + (open ? '▴' : '▾');
});

const themeBtn = $('themeToggle');
themeBtn.addEventListener('click', () => {
  document.body.classList.toggle('light');
  const light = document.body.classList.contains('light');
  themeBtn.textContent = light ? '🌙 Dark' : '☀️ Light';
  try { localStorage.setItem('pf-theme', light ? 'light' : 'dark'); } catch(e){}
});
try { if(localStorage.getItem('pf-theme') === 'dark'){ document.body.classList.remove('light'); themeBtn.textContent = '☀️ Light'; } } catch(e){}

draw();

/* A link from the calculator lands on one home's row: the rows are drawn
   by script, so the browser's own jump to the anchor has nothing to land on. */
function land(){
  const id = decodeURIComponent(location.hash.slice(1));
  const el = id && document.getElementById(id);
  if(!el) return;
  document.querySelectorAll('.qa-target').forEach(x => x.classList.remove('qa-target'));
  el.classList.add('qa-target');
  el.scrollIntoView({block: el.tagName === 'TR' ? 'center' : 'start'});
}
window.addEventListener('hashchange', land);
land();
})();
