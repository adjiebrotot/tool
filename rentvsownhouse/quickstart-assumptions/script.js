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
// The page's own words. The Indonesian twin (id/index.html) is this page
// baked by _ref/bake-id.mjs: its static copy comes from the id keys that
// name a data-i18n* attribute in index.html (the English copy lives there),
// and window.DEFAULT_LANG='id' makes the script below speak Indonesian.
// The city notes, buyer personas, places, workings and source names come
// from ../quickstart-data.js in English on both pages (marked lang="en"
// here), so every figure keeps one home.
const LANG_QA = {
  en: {
    locale: 'en-US', units: {t:'t', b:'b', m:'m', k:'k'},
    months: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    per: {weekly:'week', monthly:'month', yearly:'year'},
    regions: {},
    city: 'City',
    notOffered: 'Not offered in this city.',
    notOfferedAria: (name, why) => name + ' not offered: ' + why,
    count: (cities, n, m) => `${cities} ${cities === 1 ? 'city' : 'cities'}, ${n} Quick Start ${n === 1 ? 'scenario' : 'scenarios'} · figures as of ${m}`,
    asOf: m => 'as of ' + m,
    buyer: 'Buyer persona:',
    homes: 'Homes',
    unitNote: (code, sym, per) => `Money in ${code} (${sym}). Rent per ${per}, running costs per year.`,
    th: per => ['Home', 'Size', 'Price', 'Rent / ' + per, 'Gross yield', 'Price growth', 'Setup cost', 'Owner costs / yr', 'Renter costs / yr'],
    land: v => 'land ' + v + ' m²',
    perFreq: per => 'per ' + per,
    tryIt: 'Try it', tryItTitle: 'Open this scenario in the calculator',
    calc: '../',
    noHome: (form, city) => `No ${form.toLowerCase()} scenario in ${city}.`,
    cityWide: 'City-wide figures', thTerms: ['Figure', 'Value', 'Basis'],
    rows: {downPaymentPct:'Down payment', mortgageRate:'Mortgage rate', ratePeriods:'Rate schedule', mortgageTerm:'Mortgage term',
      riskFreeRate:'Savings rate', sellingCostPct:'Selling cost', rentInflation:'Rent growth', ownOngoingInflation:'Owner cost inflation',
      rentOngoingInflation:'Renter cost inflation', horizon:'Horizon', houseGrowth:'Price growth', setupCost:'Setup cost',
      ownOngoingCost:'Owner costs', rentOngoingCost:'Renter costs'},
    ofPrice: v => v + ' of the price',
    rateAvg: v => v + ' a year on average over the term',
    perYear: v => v + ' a year',
    term: v => v + ' years, principal and interest',
    riskFree: v => v + ' a year on spare cash',
    ofSale: v => v + ' of the sale price',
    years: v => v + ' years',
    forTerm: v => v + ' for the term',
    schedYear: n => 'year ' + n, schedYears: (a, b) => 'years ' + a + '-' + b,
    fixed: v => ' fixed ' + v, floating: (a, b) => ' floating ' + a + ' to ' + b,
    scheduleBasis: 'Opens in Detailed mortgage mode: the loan is staged, so each period is entered as its own rate, and a floating one is drawn as a band and read at its middle. The rate above is its average over the term, which Simple mode uses.',
    perHome: 'Per home, above',
    notHere: 'Not offered here',
    caveat: 'What the calculator cannot model here:',
    more: 'Workings and sources',
    setup: 'Setup: ', running: 'Running costs: ',
    sources: 'Sources'
  },
  id: {
    /* ── static copy, baked into id/index.html ── */
    pageTitle: 'Asumsi Quick Start',
    btnBack: '← Sewa vs Beli Rumah',
    introHtml: 'Setiap Quick Start adalah pasangan satu kota dan satu jenis hunian. Angkanya tersusun dalam dua lapis: syarat KPR, pajak, dan kondisi pasar yang berlaku di kota itu, lalu harga, sewa, dan biaya rutin untuk hunian tersebut. Jenis hunian yang tidak punya pasar nyata di sebuah kota sengaja tidak disediakan, dan alasannya muncul saat kamu mengarahkan kursor ke tanda strip atau mengetuknya. Catatan per kota, rincian hitungan, dan nama sumber ditulis dalam bahasa Inggris, mengikuti sumber datanya.',
    searchPh: 'Cari kota, negara, atau mata uang (misalnya tokyo, jepang, eur)',
    searchLabel: 'Cari kota',
    formLabel: 'Jenis hunian',
    formAll: 'Semua hunian', formApt: 'Apartemen', formHouse: 'Rumah tapak',
    glanceTitle: 'Ringkasan',
    csvTitle: 'Unduh nilai input setiap skenario sebagai CSV',
    glanceNoteHtml: 'Harga yang lazim dalam mata uang setempat, dengan <em>rental yield</em> kotor (sewa setahun dibagi harga) di bawahnya. Klik sebuah angka untuk melihat rinciannya.',
    noResults: 'Tidak ada kota yang cocok dengan pencarianmu.',
    noscriptHtml: 'Tabel di halaman ini disusun langsung dari data Quick Start yang dipakai <em>tool</em>-nya, jadi JavaScript di <em>browser</em>-mu harus aktif.',
    /* ── drawn by the script ── */
    locale: 'id-ID', units: {t:' T', b:' M', m:' jt', k:' rb'},
    months: ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'],
    per: {weekly:'minggu', monthly:'bulan', yearly:'tahun'},
    regions: {'Oceania':'Oseania', 'Southeast Asia':'Asia Tenggara', 'East Asia':'Asia Timur', 'South Asia':'Asia Selatan',
      'Middle East':'Timur Tengah', 'Europe':'Eropa', 'North America':'Amerika Utara'},
    city: 'Kota',
    notOffered: 'Tidak tersedia di kota ini.',
    notOfferedAria: (name, why) => name + ' tidak tersedia: ' + why,
    count: (cities, n, m) => `${cities} kota, ${n} skenario Quick Start · data per ${m}`,
    asOf: m => 'data per ' + m,
    buyer: 'Profil pembeli:',
    homes: 'Hunian',
    unitNote: (code, sym, per) => `Semua nominal dalam ${code} (${sym}). Sewa dihitung per ${per}, biaya rutin per tahun.`,
    th: per => ['Hunian', 'Luas', 'Harga', 'Sewa / ' + per, '<em>Rental yield</em> kotor', 'Kenaikan harga', 'Biaya awal', 'Biaya pemilik / tahun', 'Biaya penyewa / tahun'],
    land: v => 'tanah ' + v + ' m²',
    perFreq: per => 'per ' + per,
    tryIt: 'Coba', tryItTitle: 'Buka skenario ini di tool Sewa vs Beli Rumah',
    calc: '../../id/',
    noHome: (form, city) => `Tidak ada skenario ${form.toLowerCase()} di ${city}.`,
    cityWide: 'Angka yang berlaku untuk seluruh kota', thTerms: ['Komponen', 'Nilai', 'Dasar'],
    rows: {downPaymentPct:'Uang Muka (DP)', mortgageRate:'Bunga KPR', ratePeriods:'Jadwal bunga KPR', mortgageTerm:'Jangka waktu KPR',
      riskFreeRate:'Suku Bunga Tabungan', sellingCostPct:'Biaya penjualan', rentInflation:'Kenaikan sewa tahunan',
      ownOngoingInflation:'Kenaikan biaya rutin pemilik', rentOngoingInflation:'Kenaikan biaya rutin penyewa', horizon:'Jangka waktu',
      houseGrowth:'Kenaikan harga properti', setupCost:'Biaya awal pembelian', ownOngoingCost:'Biaya rutin kepemilikan',
      rentOngoingCost:'Biaya rutin menyewa'},
    ofPrice: v => v + ' dari harga',
    rateAvg: v => v + ' per tahun, rata-rata sepanjang tenor',
    perYear: v => v + ' per tahun',
    term: v => v + ' tahun, pokok dan bunga',
    riskFree: v => v + ' per tahun atas dana yang menganggur',
    ofSale: v => v + ' dari harga jual',
    years: v => v + ' tahun',
    forTerm: v => v + ' sepanjang tenor',
    schedYear: n => 'tahun ' + n, schedYears: (a, b) => 'tahun ' + a + '-' + b,
    fixed: v => ' <em>fixed</em> ' + v, floating: (a, b) => ' <em>floating</em> ' + a + ' sampai ' + b,
    scheduleBasis: 'Skenario ini terbuka di mode KPR <strong>Rinci</strong> karena bunganya bertahap, jadi setiap periode diisi dengan bunganya sendiri. Periode <em>floating</em> digambar sebagai rentang dan dihitung pada nilai tengahnya. Bunga KPR di baris atas adalah rata-rata bunga sepanjang tenor, yang dipakai di mode <strong>Sederhana</strong>.',
    perHome: 'Berbeda per hunian, lihat tabel di atas',
    notHere: 'Jenis hunian yang tidak tersedia',
    caveat: 'Yang tidak masuk hitungan:',
    more: 'Rincian hitungan dan sumber',
    setup: 'Biaya awal: ', running: 'Biaya rutin: ',
    sources: 'Sumber'
  }
};
const lang = window.DEFAULT_LANG === 'id' ? 'id' : 'en';
const L = LANG_QA[lang];
// Text from the data file is English on both pages; on the Indonesian one it
// says so, for screen readers and for search engines.
const enAttr = lang === 'en' ? '' : ' lang="en"';
const enText = s => lang === 'en' ? esc(s) : '<span lang="en">' + esc(s) + '</span>';

/* ── formatting ── */
function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
// An alphabetic symbol (Rp, RM, CHF, Dh) takes a space before the figure.
const symPre = sym => /[A-Za-z]$/.test(sym) ? sym + ' ' : sym;
const num = (v, dp) => Number(v).toLocaleString(L.locale, {minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0});
function money(v, sym){ return symPre(sym) + num(Math.round(v)); }
function compact(v, sym){
  const a = Math.abs(v);
  const U = L.units;
  const f = (x, u) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1).replace(/\.0$/, '') : x.toFixed(2).replace(/\.?0+$/, '')).replace('.', lang === 'id' ? ',' : '.') + u;
  const s = a >= 1e12 ? f(a / 1e12, U.t) : a >= 1e9 ? f(a / 1e9, U.b) : a >= 1e6 ? f(a / 1e6, U.m) : a >= 1e3 ? f(a / 1e3, U.k) : String(Math.round(a));
  return symPre(sym) + s;
}
// As many decimals as the figure has, up to two: 20%, 6.1%, 4.33%.
const pct = (v, dp) => num(v, dp == null ? (Number.isInteger(v) ? 0 : Number.isInteger(Math.round(v * 1000) / 100) ? 1 : 2) : dp) + '%';
function month(ym){
  const m = /^(\d{4})-(\d{2})/.exec(ym || '');
  return m ? L.months[+m[2] - 1] + ' ' + m[1] : '';
}
// A staged loan, period by period: "years 1-5 fixed 8.5%; years 6-20
// floating 11% to 13%". Floating periods run at their middle in the calculator.
// In the page's words (W, HTML-safe: the Indonesian ones italicise fixed and
// floating), or plain English for the CSV.
function schedule(periods, term, W){
  let from = 1;
  return periods.map((p, i) => {
    const to = i === periods.length - 1 ? term : p.toYear;
    const yrs = from === to ? W.schedYear(from) : W.schedYears(from, to);
    from = to + 1;
    return (i ? yrs : yrs[0].toUpperCase() + yrs.slice(1)) + (p.type === 'floating' ? W.floating(pct(p.rateMin), pct(p.rateMax)) : W.fixed(pct(p.rate)));
  }).join('; ');
}
const scheduleText = (p, W) => p.ratePeriods ? schedule(p.ratePeriods, p.mortgageTerm, W || L) : '';
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
  let h = `<thead><tr><th rowspan="2" class="qa-city-th">${esc(L.city)}</th>`;
  forms.forEach(f => { h += `<th colspan="${types.filter(t => t.form === f).length}" class="qa-form-th">${esc(QS.formText(f, lang))}</th>`; });
  h += '</tr><tr>';
  types.forEach(t => { h += `<th>${esc(t.label[lang])}</th>`; });
  h += '</tr></thead><tbody>';
  let region = '', shown = 0;
  D.cities.forEach(c => {
    if(!visible(c)) return;
    shown++;
    if(c.region !== region){
      region = c.region;
      h += `<tr class="qa-region"><td colspan="${types.length + 1}">${esc(L.regions[region] || region)}</td></tr>`;
    }
    h += `<tr><td class="qa-city-td"><a href="#${esc(c.key)}">${esc(c.city)}</a><span class="qa-sub">${esc(QS.countryText(c, lang))} · ${esc(c.currencyCode)}</span></td>`;
    types.forEach(t => {
      const p = QS.preset(QS.id(c.key, t.key));
      if(p){
        h += `<td><a class="qa-cell" href="#${esc(rowId(p.id))}" title="${esc(c.city + ', ' + t.name[lang])}"><span class="qa-price">${esc(compact(p.propertyPrice, p.currencySymbol))}</span><span class="qa-sub">${esc(pct(grossYield(p), 1))}</span></a></td>`;
      } else {
        const why = (c.unavailable && c.unavailable[t.key]) || L.notOffered;
        h += `<td class="qa-none"><span class="qa-dash" tabindex="0" role="note" aria-label="${esc(L.notOfferedAria(t.name[lang], why))}" data-tip="${esc(why)}">—</span></td>`;
      }
    });
    h += '</tr>';
  });
  $('glanceTable').innerHTML = h + '</tbody>';
  $('noResults').style.display = shown ? 'none' : 'block';
  $('glanceTable').style.display = shown ? '' : 'none';
  const n = D.cities.filter(visible).reduce((k, c) => k + QS.homes(c.key).filter(typeShown).length, 0);
  $('qaCount').textContent = L.count(shown, n, month(D.asOf));
}

/* ── one section per city ── */
// The city-wide form values a home may override, and how to say each.
const CITY_ROWS = [
  {f:'downPaymentPct', note:'downPaymentPct', show:(v) => L.ofPrice(pct(v))},
  {f:'mortgageRate', note:'mortgageRate', show:(v, c) => c.ratePeriods ? L.rateAvg(pct(v)) : L.perYear(pct(v))},
  {f:'ratePeriods', when: c => QS.homes(c.key).some(t => QS.preset(QS.id(c.key, t)).ratePeriods),
    value: c => {
      const ps = QS.homes(c.key).map(t => QS.preset(QS.id(c.key, t)));
      const texts = [...new Set(ps.map(p => scheduleText(p)))];
      return texts.length === 1
        ? texts[0]
        : ps.map(p => esc(QS.type(p.typeKey).short[lang] + ': ') + (scheduleText(p) || esc(L.forTerm(pct(p.mortgageRate))))).join('<br>');
    },
    basis: () => L.scheduleBasis},
  {f:'mortgageTerm', show:(v) => L.term(v)},
  {f:'riskFreeRate', note:'riskFreeRate', show:(v) => L.riskFree(pct(v))},
  {f:'sellingCostPct', note:'sellingCostPct', show:(v) => L.ofSale(pct(v))},
  {f:'rentInflation', note:'rentInflation', show:(v) => L.perYear(pct(v))},
  {f:'ownOngoingInflation', show:(v) => L.perYear(pct(v))},
  {f:'rentOngoingInflation', show:(v) => L.perYear(pct(v))},
  {f:'horizon', show:(v) => L.years(v)},
];
// The per-home figures, each with the note on the city that explains it.
const HOME_NOTES = ['houseGrowth', 'setupCost', 'ownOngoingCost', 'rentOngoingCost'];

function cityValue(c, row){
  const base = c[row.f] !== undefined ? c[row.f] : D.defaults[row.f];
  let s = esc(row.show(base, c));
  // A home that overrides the city's figure says so beside it.
  const odd = QS.homes(c.key).map(t => QS.preset(QS.id(c.key, t))).filter(p => p[row.f] !== base);
  if(odd.length) s += '<span class="qa-sub">' + odd.map(p => esc(QS.type(p.typeKey).short[lang] + ': ' + row.show(p[row.f], c))).join('; ') + '</span>';
  return s;
}

function drawCity(c){
  const notes = c.notes || {};
  const freq = c.rentFreq || D.defaults.rentFreq;
  const homes = QS.homes(c.key).filter(typeShown);
  let h = `<section class="card qa-city" id="${esc(c.key)}">`;
  h += `<div class="qa-head"><h2>${esc(c.city)}<span class="qa-h-sub">${esc(QS.countryText(c, lang))}</span></h2>`;
  h += `<span class="qa-chips"><span class="qa-chip">${esc(L.regions[c.region] || c.region)}</span><span class="qa-chip">${esc(c.currencyCode)} (${esc(c.currencySymbol)})</span><span class="qa-chip">${esc(L.asOf(month(c.asOf)))}</span></span></div>`;
  if(notes.market) h += `<p class="qa-lead"${enAttr}>${esc(notes.market)}</p>`;
  if(c.buyer) h += `<p class="qa-buyer"><strong>${esc(L.buyer)}</strong> ${enText(c.buyer)}</p>`;

  // Homes first: they are what a reader picked.
  if(homes.length){
    const sym = c.currencySymbol;
    h += `<h3>${esc(L.homes)}</h3><p class="unit-note">${esc(L.unitNote(c.currencyCode, sym, L.per[freq]))}</p>`;
    h += `<div class="table-wrap qa-table-wrap"><table class="qa-table qa-homes"><thead><tr>
      ${L.th(L.per[freq]).map(x => `<th>${x}</th>`).join('')}<th></th></tr></thead><tbody>`;
    homes.forEach(t => {
      const sid = QS.id(c.key, t), p = QS.preset(sid), home = c.homes[t];
      const size = home.sqm ? num(home.sqm) + ' m²' + (home.landSqm ? '<span class="qa-sub">' + esc(L.land(num(home.landSqm))) + '</span>' : '') : '—';
      h += `<tr id="${esc(rowId(sid))}">
        <td class="qa-home"><strong>${esc(QS.type(t).name[lang])}</strong>${home.where ? `<span class="qa-sub"${enAttr}>${esc(home.where)}</span>` : ''}</td>
        <td>${size}</td>
        <td>${esc(money(p.propertyPrice, sym))}</td>
        <td>${esc(money(p.rentAmount, sym))}${p.rentFreq !== freq ? `<span class="qa-sub">${esc(L.perFreq(L.per[p.rentFreq]))}</span>` : ''}</td>
        <td>${esc(pct(grossYield(p), 1))}</td>
        <td>${esc(pct(p.houseGrowth))}</td>
        <td>${esc(pct(p.setupCost, 2))}<span class="qa-sub">${esc(money(p.setupCost / 100 * p.propertyPrice, sym))}</span></td>
        <td>${esc(money(p.ownOngoingCost, sym))}</td>
        <td>${esc(money(p.rentOngoingCost, sym))}</td>
        <td><a class="dl-json-link qa-open" href="${L.calc}?qs=${encodeURIComponent(sid)}" title="${esc(L.tryItTitle)}">${esc(L.tryIt)}</a></td>
      </tr>`;
    });
    h += '</tbody></table></div>';
  } else {
    h += `<p class="qa-buyer">${esc(L.noHome(QS.formText(form, lang), c.city))}</p>`;
  }

  // The city's loan, tax and market terms, each with its basis.
  h += `<h3>${esc(L.cityWide)}</h3><div class="table-wrap explainer qa-table-wrap"><table class="qa-table qa-terms"><thead><tr>${L.thTerms.map(x => `<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>`;
  CITY_ROWS.forEach(r => {
    if(r.when && !r.when(c)) return;
    const val = r.value ? r.value(c) : cityValue(c, r);
    // A basis of the page's own (HTML) or the city's note (English data).
    const basis = r.basis ? `<td class="qa-basis">${r.basis()}</td>`
      : `<td class="qa-basis"${r.note && notes[r.note] ? enAttr : ''}>${esc((r.note && notes[r.note]) || '')}</td>`;
    h += `<tr><td>${esc(L.rows[r.f])}</td><td class="qa-val">${val}</td>${basis}</tr>`;
  });
  HOME_NOTES.forEach(k => {
    if(notes[k]) h += `<tr><td>${esc(L.rows[k])}</td><td class="qa-val">${esc(L.perHome)}</td><td class="qa-basis"${enAttr}>${esc(notes[k])}</td></tr>`;
  });
  h += '</tbody></table></div>';

  // Types this market does not have, and why.
  const missing = D.types.filter(t => typeShown(t.key) && c.unavailable && c.unavailable[t.key]);
  if(missing.length){
    h += `<h3>${esc(L.notHere)}</h3><ul class="qa-list">`;
    missing.forEach(t => { h += `<li><strong>${esc(t.name[lang])}:</strong> ${enText(c.unavailable[t.key])}</li>`; });
    h += '</ul>';
  }
  if(notes.caveat) h += `<p class="qa-caveat"><strong>${esc(L.caveat)}</strong> ${enText(notes.caveat)}</p>`;

  // The arithmetic behind each home, and the sources: open on request.
  const work = homes.filter(t => c.homes[t].setupCalc || c.homes[t].costCalc);
  const srcs = (c.sources || []).concat(...homes.map(t => c.homes[t].sources || []));
  if(work.length || srcs.length){
    h += `<div class="qa-more"><button type="button" class="qa-more-btn" aria-expanded="false">${esc(L.more)} ▾</button><div class="qa-more-body" hidden>`;
    if(work.length){
      h += '<ul class="qa-list">';
      work.forEach(t => {
        const x = c.homes[t];
        h += `<li><strong>${esc(QS.type(t).name[lang])}.</strong> ${x.setupCalc ? esc(L.setup) + enText(x.setupCalc) + ' ' : ''}${x.costCalc ? esc(L.running) + enText(x.costCalc) : ''}</li>`;
      });
      h += '</ul>';
    }
    if(srcs.length){
      const seen = new Set();
      h += `<h4>${esc(L.sources)}</h4><ul class="qa-list qa-sources"${enAttr}>`;
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
    .concat(QS.FIELDS).concat(['mortgageMode', 'rateSchedule', 'grossYieldPct']);
  const cell = v => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [cols.join(',')];
  QS.all().forEach(sid => {
    const p = QS.preset(sid), c = QS.city(p.cityKey), t = QS.type(p.typeKey), home = c.homes[p.typeKey];
    const row = {id: sid, city: c.city, country: c.country, region: c.region, home: t.name.en, form: t.form,
      bedrooms: t.beds, sqm: home.sqm, landSqm: home.landSqm, where: home.where, currencyCode: c.currencyCode,
      asOf: c.asOf, mortgageMode: p.mortgageMode, rateSchedule: scheduleText(p, LANG_QA.en), grossYieldPct: grossYield(p).toFixed(2)};
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
// The language toggle keeps the city or home the reader is on.
const langTog = $('langToggle');
if(langTog) langTog.addEventListener('click', () => { langTog.href = langTog.getAttribute('href').split('#')[0] + location.hash; });
// Each city's workings open on request; the cities are redrawn on every
// filter, so one listener on their container serves them all.
$('cities').addEventListener('click', e => {
  const b = e.target.closest('.qa-more-btn');
  if(!b) return;
  const body = b.nextElementSibling, open = body.hidden;
  body.hidden = !open;
  b.setAttribute('aria-expanded', String(open));
  b.textContent = L.more + ' ' + (open ? '▴' : '▾');
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
