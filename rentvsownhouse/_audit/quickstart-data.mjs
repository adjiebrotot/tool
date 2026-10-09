// Rent vs Own: Quick Start data audit.
//
// ../quickstart-data.js is the one place every Quick Start figure lives. This
// holds it to the rules that file's header states, and to the form it fills,
// without trusting the pages to complain:
//
//   D1  every city carries its identity, currency and city-wide figures, and
//       its symbol is one the shared currency picker offers (a symbol the
//       picker lacks would load as an empty field)
//   D2  every home type appears exactly once per city, in homes (with the
//       figures) or in unavailable (with a reason short enough for a tip),
//       and every city has at least one home
//   D3  every scenario resolves every form value, each inside the bounds the
//       calculator's own field enforces (read from ../index.html), and each
//       choice is one of that field's options
//   D4  the figures hang together: gross yield between 1% and 10%, price and
//       rent rise with bedrooms within a form, setup cost under 20% of price
//   D5  site text rules: no em-dash anywhere a reader will see, notes and
//       reasons under 220 characters, sources are https links, asOf is YYYY-MM
//   D6  the assumptions page draws a row for every scenario, at the price
//       the calculator loads, and a dash with its reason for every gap
//   D7  a staged loan's rate schedule is one the Detailed mortgage mode can
//       hold (consecutive periods, the last ending at the term, rates inside
//       the rate rows' bounds, a floating range that is a range), its
//       mortgageRate is the schedule's average, and the calculator opens it
//       in Detailed mode on exactly those periods
//
// Run: node quickstart-data.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const RVO = join(HERE, '..');
const ROOT = join(RVO, '..');

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  console.log((ok ? '  PASS  ' : '✗ FAIL  ') + name + (detail ? '  — ' + detail : ''));
  ok ? pass++ : fail++;
};
const list = (bad, n = 4) => bad.slice(0, n).join(' | ') + (bad.length > n ? ` … (+${bad.length - n})` : '');

/* ── load the data the way a page does ── */
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(join(RVO, 'quickstart-data.js'), 'utf8'), ctx);
const D = ctx.window.RVO_QUICKSTART, Q = ctx.window.RVO_QS;

/* ── the shared currency symbols (shared.js) ── */
const shared = readFileSync(join(ROOT, 'shared.js'), 'utf8');
const SYMBOLS = [...shared.slice(shared.indexOf('var CURRENCY_SYMBOLS'), shared.indexOf('];', shared.indexOf('var CURRENCY_SYMBOLS')))
  .matchAll(/sym:'([^']*)'/g)].map(m => m[1]);

/* ── the calculator's field bounds and options (index.html) ── */
const html = readFileSync(join(RVO, 'index.html'), 'utf8');
function field(id){
  const m = new RegExp(`<(input|select)[^>]*\\bid="${id}"[^>]*>`).exec(html);
  if(!m) return null;
  const tag = m[0], attr = a => { const x = new RegExp(`\\b${a}="([^"]*)"`).exec(tag); return x ? x[1] : null; };
  const f = { tag: m[1], min: attr('data-min') ?? attr('min'), max: attr('data-max') ?? attr('max') };
  if(m[1] === 'select'){
    const body = html.slice(m.index, html.indexOf('</select>', m.index));
    f.options = [...body.matchAll(/<option value="([^"]*)"/g)].map(x => x[1]);
  }
  return f;
}
// Form values that are not a field of their own, or a radio/checkbox.
const CHOICES = { mortgageType: ['pi', 'io'], costInterestOnly: [true, false], rtbEnabled: [true, false] };
const NOT_A_FIELD = ['currencySymbol'];

/* ── D1 ── */
{
  const bad = [];
  const need = ['key', 'city', 'country', 'countryId', 'countryCode', 'region', 'currencySymbol', 'currencyCode', 'asOf', 'buyer', 'homes', 'unavailable', 'notes', 'sources'];
  const keys = new Set();
  D.cities.forEach(c => {
    need.forEach(k => { if(c[k] === undefined || c[k] === '') bad.push(`${c.key}: no ${k}`); });
    if(keys.has(c.key)) bad.push(`${c.key}: key used twice`);
    keys.add(c.key);
    if(!/^[a-z]+$/.test(c.key)) bad.push(`${c.key}: key is not plain lowercase letters`);
    if(!SYMBOLS.includes(c.currencySymbol)) bad.push(`${c.key}: symbol ${c.currencySymbol} is not in SharedCurrency`);
  });
  check(`D1 ${D.cities.length} cities carry identity, currency and a symbol the picker offers`, !bad.length, list(bad));
}

/* ── D2 ── */
{
  const bad = [];
  const TYPES = D.types.map(t => t.key);
  D.cities.forEach(c => {
    TYPES.forEach(t => {
      const n = (c.homes[t] ? 1 : 0) + (c.unavailable[t] ? 1 : 0);
      if(n !== 1) bad.push(`${c.key}/${t} appears ${n}×`);
    });
    Object.keys(c.homes).concat(Object.keys(c.unavailable)).forEach(t => { if(!TYPES.includes(t)) bad.push(`${c.key}: unknown type ${t}`); });
    if(!Object.keys(c.homes).length) bad.push(`${c.key}: no homes at all`);
  });
  check('D2 every home type is accounted for once per city, and every city has a home', !bad.length, list(bad));
}

/* ── D3 ── */
const all = Q.all();
{
  const bad = [];
  all.forEach(sid => {
    const p = Q.preset(sid);
    Q.FIELDS.forEach(f => {
      const v = p[f];
      if(v === undefined || v === null || (typeof v === 'number' && !isFinite(v))) { bad.push(`${sid}: ${f} unset`); return; }
      if(NOT_A_FIELD.includes(f)) return;
      if(CHOICES[f]){ if(!CHOICES[f].includes(v)) bad.push(`${sid}: ${f}=${v}`); return; }
      const F = field(f);
      if(!F){ bad.push(`${sid}: no field #${f} on the page`); return; }
      if(F.options){ if(!F.options.includes(String(v))) bad.push(`${sid}: ${f}=${v} not an option (${F.options})`); return; }
      if(typeof v !== 'number'){ bad.push(`${sid}: ${f}=${JSON.stringify(v)} is not a number`); return; }
      // A setup cost in % is a share of the price, not money: 0 to 100.
      const lo = f === 'setupCost' && p.setupCostType === 'pct' ? 0 : Number(F.min);
      const hi = f === 'setupCost' && p.setupCostType === 'pct' ? 100 : Number(F.max);
      if(F.min !== null && v < lo) bad.push(`${sid}: ${f}=${v} below ${lo}`);
      if(F.max !== null && v > hi) bad.push(`${sid}: ${f}=${v} above ${hi}`);
    });
  });
  check(`D3 all ${all.length} scenarios set every form value inside the field's own bounds`, !bad.length, list(bad));
}

/* ── D4 ── */
const PER_YEAR = { weekly: 52, monthly: 12, yearly: 1 };
const yieldOf = p => p.rentAmount * PER_YEAR[p.rentFreq] / p.propertyPrice * 100;
{
  const bad = [], order = [];
  all.forEach(sid => {
    const p = Q.preset(sid), y = yieldOf(p);
    if(y < 1 || y > 10) bad.push(`${sid}: gross yield ${y.toFixed(2)}%`);
    if(p.setupCost > 20) bad.push(`${sid}: setup ${p.setupCost}%`);
  });
  D.cities.forEach(c => ['apartment', 'house'].forEach(form => {
    const ks = Q.homes(c.key).filter(t => Q.type(t).form === form);
    for(let i = 1; i < ks.length; i++){
      const a = Q.preset(Q.id(c.key, ks[i - 1])), b = Q.preset(Q.id(c.key, ks[i]));
      if(!(b.propertyPrice > a.propertyPrice)) order.push(`${c.key}: ${ks[i]} price ≤ ${ks[i - 1]}`);
      if(!(b.rentAmount * PER_YEAR[b.rentFreq] > a.rentAmount * PER_YEAR[a.rentFreq])) order.push(`${c.key}: ${ks[i]} rent ≤ ${ks[i - 1]}`);
    }
  }));
  check('D4 every gross yield is 1–10% and every setup cost under 20%', !bad.length, list(bad));
  check('D4 within a form, price and rent rise with bedrooms', !order.length, list(order));
}

/* ── D5 ── */
{
  const dash = [], long = [], src = [], asof = [];
  const texts = [];
  D.cities.forEach(c => {
    texts.push([c.key + '.buyer', c.buyer]);
    Object.entries(c.notes).forEach(([k, v]) => texts.push([`${c.key}.notes.${k}`, v, 220]));
    Object.entries(c.unavailable).forEach(([k, v]) => texts.push([`${c.key}.unavailable.${k}`, v, 200]));
    Object.entries(c.homes).forEach(([k, h]) => ['where', 'setupCalc', 'costCalc'].forEach(f => h[f] && texts.push([`${c.key}.${k}.${f}`, h[f]])));
    c.sources.concat(...Object.values(c.homes).map(h => h.sources || [])).forEach(s => {
      if(!s || !/^https:\/\/[^\s]+$/.test(s.url || '') || !s.name) src.push(`${c.key}: ${JSON.stringify(s)}`);
    });
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(c.asOf)) asof.push(`${c.key}: ${c.asOf}`);
  });
  texts.forEach(([where, t, max]) => {
    if(/—/.test(t)) dash.push(where);
    if(max && t.length > max) long.push(`${where} ${t.length}`);
  });
  check('D5 no em-dash in any note, reason, place or working', !dash.length, list(dash));
  check('D5 notes under 220 characters, reasons under 200 (they show in tips)', !long.length, list(long));
  check('D5 every source is a named https link', !src.length, list(src));
  check('D5 every asOf is YYYY-MM', !asof.length && /^\d{4}-\d{2}$/.test(D.asOf), list(asof));
}

/* ── D6: the assumptions page follows the data ── */
{
  const browser = await pw.chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('**://*/**', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, body: '' }));
  await page.goto(pathToFileURL(join(RVO, 'quickstart-assumptions', 'index.html')).href);
  await page.waitForTimeout(400);
  const got = await page.evaluate(() => {
    const Q = window.RVO_QS, bad = [];
    Q.all().forEach(sid => {
      const row = document.getElementById(sid.replace('/', '-'));
      if(!row){ bad.push(sid + ': no row'); return; }
      const p = Q.preset(sid);
      const price = row.children[2].textContent.replace(/[^0-9]/g, '');
      if(price !== String(Math.round(p.propertyPrice))) bad.push(sid + ': price ' + price + ' vs ' + p.propertyPrice);
      const open = row.querySelector('.qa-open');
      if(!open || decodeURIComponent(open.getAttribute('href')) !== '../?qs=' + sid) bad.push(sid + ': open link');
    });
    const gaps = Q.data.cities.reduce((n, c) => n + Object.keys(c.unavailable).length, 0);
    const dashes = [...document.querySelectorAll('.qa-dash')].filter(d => d.getAttribute('data-tip')).length;
    return { rows: document.querySelectorAll('.qa-homes tbody tr').length, cells: document.querySelectorAll('.qa-cell').length, n: Q.all().length, gaps, dashes, bad };
  });
  check(`D6 the assumptions page draws all ${got.n} scenarios, each at the price the calculator loads`,
    got.rows === got.n && got.cells === got.n && !got.bad.length && !errors.length, list(got.bad.concat(errors)) || `${got.rows} rows, ${got.cells} cells`);
  check('D6 every missing home shows a dash with its reason', got.dashes === got.gaps, `${got.dashes} dashes for ${got.gaps} gaps`);
  await browser.close();
}

/* ── D7: rate schedules ── */
{
  const bad = [], avg = [];
  const staged = all.filter(sid => Q.preset(sid).ratePeriods);
  all.forEach(sid => {
    const p = Q.preset(sid), ps = p.ratePeriods;
    if(!ps){ if(p.mortgageMode !== 'simple') bad.push(sid + ': no schedule but ' + p.mortgageMode); return; }
    if(p.mortgageMode !== 'detailed') bad.push(sid + ': schedule but ' + p.mortgageMode);
    let prev = 0, sum = 0;
    ps.forEach((r, i) => {
      if(!(Number.isInteger(r.toYear) && r.toYear > prev)) bad.push(`${sid}: period ${i + 1} ends at ${r.toYear}`);
      if(!['fixed', 'floating'].includes(r.type)) bad.push(`${sid}: period ${i + 1} type ${r.type}`);
      [r.rate, r.rateMin, r.rateMax].forEach(v => { if(!(v >= 0 && v <= 40)) bad.push(`${sid}: period ${i + 1} rate ${v}`); });
      if(r.type === 'floating' && !(r.rateMax > r.rateMin)) bad.push(`${sid}: period ${i + 1} floating ${r.rateMin}-${r.rateMax}`);
      if(r.type === 'fixed' && !(r.rateMin === r.rate && r.rateMax === r.rate)) bad.push(`${sid}: period ${i + 1} fixed range`);
      sum += (Math.min(r.toYear, p.mortgageTerm) - prev) * (r.rateMin + r.rateMax) / 2;
      prev = r.toYear;
    });
    if(prev !== p.mortgageTerm) bad.push(`${sid}: schedule ends at ${prev}, term ${p.mortgageTerm}`);
    if(Math.abs(sum / p.mortgageTerm - p.mortgageRate) > 0.006) avg.push(`${sid}: average ${(sum / p.mortgageTerm).toFixed(3)} vs ${p.mortgageRate}`);
  });
  // A page edits its periods in place, so each preset must hand out its own copy.
  if(staged.length && Q.preset(staged[0]).ratePeriods === Q.preset(staged[0]).ratePeriods) bad.push('schedule is shared, not copied');
  check(`D7 ${staged.length} scenarios carry a rate schedule the Detailed mode can hold`, staged.length > 0 && !bad.length, list(bad));
  check('D7 a staged scenario\'s mortgageRate is its schedule\'s average over the term', !avg.length, list(avg));

  const browser = await pw.chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('**://*/**', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, body: '' }));
  // The page only needs Chart to exist, not to draw.
  await page.addInitScript(() => {
    class Chart {
      constructor(ctx, cfg){ this.config = cfg; this.data = (cfg && cfg.data) || { datasets: [] }; this.options = (cfg && cfg.options) || {}; this.scales = this.options.scales || {}; }
      update(){} destroy(){} resetZoom(){} isDatasetVisible(){ return true; } setDatasetVisibility(){}
      getDatasetMeta(){ return { data: [], hidden: false }; }
    }
    Chart.register = () => {};
    Chart.Interaction = { modes: {} };
    Chart.helpers = { getRelativePosition: e => e };
    window.Chart = Chart;
    try { localStorage.clear(); } catch(e){}
  });
  // Each city's default home, opened the way the assumptions page links it.
  const got = [];
  for(const c of Q.data.cities){
    const sid = Q.id(c.key, Q.defaultType(c.key));
    await page.goto(pathToFileURL(join(RVO, 'index.html')).href + '?qs=' + encodeURIComponent(sid));
    await page.waitForTimeout(300);
    got.push(await page.evaluate(sid => ({
      sid,
      mode: document.querySelector('#mortgageModeGroup .seg-btn.active').dataset.val,
      shown: document.getElementById('rateScheduleRow').style.display !== 'none',
      rows: [...document.querySelectorAll('#ratePeriodRows .rate-period-row')].map(r => ({
        type: r.querySelector('.rp-type').value, rate: +r.querySelector('.rp-rate').value,
        rateMin: +r.querySelector('.rp-min').value, rateMax: +r.querySelector('.rp-max').value }))
    }), sid));
  }
  const off = [];
  got.forEach(g => {
    const p = Q.preset(g.sid);
    if(g.mode !== p.mortgageMode) off.push(`${g.sid}: opens ${g.mode}`);
    if(g.shown !== (p.mortgageMode === 'detailed')) off.push(`${g.sid}: schedule row ${g.shown ? 'shown' : 'hidden'}`);
    if(p.ratePeriods){
      const want = p.ratePeriods.map(r => ({ type: r.type, rate: r.rate, rateMin: r.rateMin, rateMax: r.rateMax }));
      if(JSON.stringify(want) !== JSON.stringify(g.rows)) off.push(`${g.sid}: rows ${JSON.stringify(g.rows)}`);
    }
  });
  check('D7 the calculator opens each staged scenario in Detailed mode on its own periods, and the rest in Simple',
    !off.length && !errors.length, list(off.concat(errors)) || `${got.filter(g => g.mode === 'detailed').length} of ${got.length} city defaults staged`);
  await browser.close();
}

console.log(`\nquick start data: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
