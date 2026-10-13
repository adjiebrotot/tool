// Salary Map — end-to-end audit.
// Serves the repo over localhost and drives the REAL map page headless, then
// holds it to the documented maths and to the comparator itself:
//   M1  data: every city in the dataset has a location, and that location
//       lands inside its own country on the World Clock's map (or within
//       10 km of its coast, which the map's 2 km simplification can move)
//   M2  engine: every city's living cost, rate, salary, savings and ratio is
//       replayed from the raw JSON files, without the page's code, under
//       Simple (housing in and out) and Detailed lifestyles, both targets and
//       Global salary mode
//   M3  parity: the comparator page, driven through its own controls, quotes
//       the same required salary as the map for the same pair of cities, in
//       Detailed mode (its Quick Start budgets) and in Simple mode
//   M4  colour: cheaper is blue, dearer amber, red only in Global salary mode
//       and only where savings go below zero; your city is the neutral mid;
//       the cheapest and the dearest wear the deepest shade of their arm;
//       changing the view never repaints a city; and every view's figure is
//       ordered by the one number the colours use
//   M5  headline: a city's card and label lead with your currency and give
//       its own currency in brackets, at the figures the engine holds
//   M6  modes: Required salary opens on Required net salary; Global salary
//       has no salary view and opens on Nominal savings; each mode keeps the
//       view it was left on; Target only shows in Required salary mode, and
//       the view its target fixes in every city is dropped; the title names
//       the figure and its tip carries the rest
//   M7  labels: no two labels overlap and none leaves the map
//   M8  live rates: with a mocked feed, money crossing currencies moves to the
//       live rate while every city's own-currency living cost holds still
//   M9  gestures: a drag pans, Ctrl+wheel zooms, a plain wheel leaves the map
//       alone for the page to scroll, a click pins a city's card
//   M10 the page reloads to the same plan (mini cache)
//   M11 borders: no line inside one country where a time zone is laid over
//       another (Xinjiang, the West Bank) or filed under a neighbour
//       (northern Vietnam under Asia/Bangkok); a disputed overlap keeps both
//       claim lines
//   M13 Scaled salary: every city's salary, savings, ratio and colour is
//       replayed from wages.json for each yardstick; a city or home city
//       with no yardstick says why; the mode keeps its yardstick on a reload
//   M12 full screen: ⤢ fills the window with the map card, keeping its title,
//       View selector and legend above the map; a plain wheel zooms there;
//       Esc closes a pinned card first, then puts the map back in the page;
//       a phone gets the same with nothing pushed off the side
// Run: node run.mjs
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

const MIME = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
const server = http.createServer((req, res) => {
  let p = join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if(existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if(!existsSync(p)){ res.writeHead(404); res.end(); return; }
  res.writeHead(200, {'content-type': MIME[extname(p)] || 'application/octet-stream'});
  res.end(readFileSync(p));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const MAP = BASE + '/costofliving-comparator/map/';
const COMP = BASE + '/costofliving-comparator/';

let pass = 0, fail = 0;
const check = (name, ok, detail) => { console.log((ok ? '  PASS  ' : '✗ FAIL  ') + name + (detail ? '  — ' + detail : '')); ok ? pass++ : fail++; };

// ── The raw data, read without the page ──────────────────────────────────
const COL = JSON.parse(readFileSync(join(ROOT, 'costofliving-comparator', 'cost_of_living_indices_aggregated.json'), 'utf8')).data;
const RATE = Object.fromEntries(JSON.parse(readFileSync(join(ROOT, 'costofliving-comparator', 'currency_rates.json'), 'utf8')).data.map(r => [r.currency, r.usd_rate]));
const COORDS = JSON.parse(readFileSync(join(HERE, '..', 'city_coords.json'), 'utf8'));
const CITY = Object.fromEntries(COL.map(c => [c.city + '|' + c.country, c]));
const pos = v => (typeof v === 'number' && v > 0) ? v : null;
const med = (c, k) => c.utilities_index && c.utilities_index[k] ? pos(c.utilities_index[k].Median) : null;
// The index each category is scaled by, as the comparator documents them.
function index(c, key){
  switch(key){
    case 'rent': return pos(c.rent_index && c.rent_index.med);
    case 'groceries': return pos(c.groceries_index);
    case 'eating_out': return pos(c.eating_out_index);
    case 'electricity': return med(c, 'electricity');
    case 'water': return med(c, 'water');
    case 'gas_util': return med(c, 'gas');
    case 'fuel': return med(c, 'fuel');
    case 'coli_no_housing': return pos(c.coli_no_housing);
    case 'coli_with_housing': return pos(c.coli_with_housing);
    case 'currency_only': return 100;
    case 'utilities': {
      const parts = [[med(c, 'electricity'), .5], [med(c, 'water'), .2], [med(c, 'gas'), .3]].filter(p => p[0]);
      const w = parts.reduce((s, p) => s + p[1], 0);
      return w ? parts.reduce((s, p) => s + p[0] * p[1], 0) / w : null;
    }
  }
  throw new Error('unknown index ' + key);
}
const CAT_INDEX = { rent: 'rent', groceries: 'groceries', eating_out: 'eating_out', utilities: 'utilities', electricity: 'electricity',
  water: 'water', gas_util: 'gas_util', fuel: 'fuel', remittance: 'currency_only', intl_travel: 'currency_only', other: 'coli_no_housing' };

// Expected figures for every city, from the plan alone. Rates are units per
// USD; the index estimate rides the bundled rate, money crossing a border
// rides `fxOf` (the bundled pair unless a live rate is given).
function replay(plan, fxOf){
  const from = CITY[plan.from], fc = from.currency;
  const fe = plan.detail === 'detailed' ? plan.rows.reduce((s, r) => s + r[1], 0) : plan.expense;
  const sal = plan.salary, fSav = sal - fe, r = sal > 0 ? fSav / sal : 0;
  const out = {};
  for(const c of COL){
    const key = c.city + '|' + c.country;
    let E = null;
    const rf = RATE[fc], rd = RATE[c.currency];
    if(plan.detail === 'detailed'){
      E = 0;
      for(const [cat, amt] of plan.rows){
        if(!amt) continue;
        const fi = index(from, CAT_INDEX[cat]), ti = index(c, CAT_INDEX[cat]);
        if(!fi || !ti || !rf || !rd){ E = null; break; }
        E += amt * (rd / rf) * (ti / fi);
      }
    } else {
      const k = plan.housing === 'exclude' ? 'coli_no_housing' : 'coli_with_housing';
      const fi = index(from, k), ti = index(c, k);
      E = (fi && ti && rf && rd) ? fe * (rd / rf) * (ti / fi) : null;
    }
    const fx = fxOf ? fxOf(fc, c.currency) : (rf && rd ? rf / rd : 0);
    let s = null;
    if(E != null && fx > 0){
      if(plan.mode === 'global') s = sal / fx;
      else if(plan.target === 'nominal') s = E + fSav / fx;
      else s = (E > 0 && r < 1) ? E / (1 - r) : null;
    }
    const sav = s == null ? null : s - E;
    out[key] = { E, fx, sal: s, sav, ratio: s > 0 ? sav / s : null, q: E != null && fx > 0 && fe > 0 ? E * fx / fe : null };
  }
  return out;
}
const close = (a, b, rel = 1e-9) => (a == null && b == null) || (a != null && b != null && Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b)));

// ── The page ─────────────────────────────────────────────────────────────
const browser = await chromium.launch();
async function openPage(url, opts = {}){
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.__errors = [];
  page.on('pageerror', e => page.__errors.push(e.message));
  await page.route('**/*', route => {
    const u = route.request().url();
    if(u.startsWith(BASE)) return route.continue();
    if(opts.live && u.includes('open.er-api.com')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify(opts.live) });
    return route.abort();
  });
  if(opts.seenTour) await ctx.addInitScript(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function(k){ return /-seen$/.test(k) ? '1' : g.call(this, k); }; });
  await page.goto(url, { waitUntil: 'load' });
  return { ctx, page };
}
async function openMap(opts){
  const r = await openPage(MAP, opts);
  await r.page.waitForFunction(() => window.__colmap && window.__colmap.mapReady(), null, { timeout: 15000 });
  return r;
}
const settle = page => page.waitForTimeout(250);
async function pickFrom(page, key){
  await page.evaluate(key => {
    const input = document.getElementById('fromSearch');
    input.focus();
    input.value = key.split('|')[0];
    input.dispatchEvent(new Event('input'));
    const opt = [...document.querySelectorAll('#fromPicker .city-opt')].find(o => o.dataset.key === key);
    opt.dispatchEvent(new MouseEvent('mousedown'));
  }, key);
  await settle(page);
}
async function type(page, sel, v){
  await page.evaluate(({sel, v}) => {
    const el = document.querySelector(sel);
    el.focus(); el.value = String(v);
    el.dispatchEvent(new Event('input', {bubbles: true}));
    el.dispatchEvent(new Event('change', {bubbles: true}));
    el.blur();
  }, {sel, v});
  await settle(page);
}
const seg = async (page, group, val) => { await page.click(`#${group} .seg-btn[data-val="${val}"]`); await settle(page); };
async function applyPlan(page, plan){
  await page.click(`.quick-start-btn[data-preset="${plan.preset || 'per'}"]`);
  await settle(page);
  if(plan.from && !plan.preset) await pickFrom(page, plan.from);
  await seg(page, 'detailGroup', plan.detail);
  if(plan.detail === 'simple'){
    await type(page, '#expense', plan.expense);
    await seg(page, 'housingGroup', plan.housing);
  }
  if(!plan.preset) await type(page, '#salary', plan.salary);
  await seg(page, 'modeGroup', plan.mode);
  if(plan.mode === 'required') await seg(page, 'targetGroup', plan.target);
}
const rowsOf = page => page.evaluate(() => window.__colmap.rows());

// ── M1 data ──────────────────────────────────────────────────────────────
{
  const missing = COL.filter(c => !COORDS[c.city + '|' + c.country]).map(c => c.city);
  const extra = Object.keys(COORDS).filter(k => !CITY[k]);
  check('M1 every dataset city has a location', !missing.length && !extra.length, missing.length ? 'missing ' + missing.slice(0, 5).join(', ') : extra.length ? 'stale ' + extra.slice(0, 5).join(', ') : COL.length + ' cities');

  const topo = JSON.parse(readFileSync(join(ROOT, 'worldclock', 'zones.json'), 'utf8'));
  const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
  const arcs = topo.arcs.map(a => { let x = 0, y = 0; return a.map(p => { x += p[0]; y += p[1]; return [x * sx + tx, y * sy + ty]; }); });
  const ring = r => { const pts = []; r.forEach((i, j) => { const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i]; pts.push(...(j ? a.slice(1) : a)); }); return pts; };
  const inRing = (x, y, pts) => { let s = false; for(let i = 0, j = pts.length - 1; i < pts.length; j = i++){ const [xi, yi] = pts[i], [xj, yj] = pts[j]; if((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) s = !s; } return s; };
  const geoms = topo.objects.zones.geometries.map(g => ({ cc: g.properties.cc,
    polys: (g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : []).map(p => p.map(ring)) }));
  // Country name -> ISO code, from the names the browser engine itself knows.
  const dn = new Intl.DisplayNames(['en'], { type: 'region' });
  const NAME = {};
  new Set(geoms.map(g => g.cc)).forEach(cc => { try { NAME[dn.of(cc).toLowerCase()] = cc; } catch(e) {} });
  const ALIAS = { 'turkey': 'TR', 'czech republic': 'CZ', 'ivory coast': 'CI', 'hong kong (china)': 'HK', 'macao (china)': 'MO',
    'taiwan (china)': 'TW', 'kosovo (disputed territory)': 'XK', 'bosnia and herzegovina': 'BA', 'trinidad and tobago': 'TT',
    'palestine': 'PS', 'myanmar': 'MM' };
  const ccOf = country => ALIAS[country.toLowerCase()] || NAME[country.toLowerCase()];
  const at = (lon, lat) => { for(const g of geoms) for(const p of g.polys) if(inRing(lon, lat, p[0]) && !p.slice(1).some(h => inRing(lon, lat, h))) return g.cc; return null; };
  const kmTo = (lon, lat, cc) => { let best = Infinity; for(const g of geoms) if(g.cc === cc) for(const p of g.polys) for(const [x, y] of p[0]) best = Math.min(best, Math.hypot((x - lon) * Math.cos(lat * Math.PI / 180), y - lat) * 111.2); return best; };
  // Two countries the time zone map files under a neighbour: northern
  // Vietnam lies in the Asia/Bangkok polygon and Kosovo in Europe/Belgrade's.
  // A city there may land in that neighbour's polygon, and must also sit
  // inside its own country's bounding box [south, west, north, east].
  const FILED_UNDER = { 'Vietnam': ['TH', [8.2, 102.1, 23.4, 109.5]], 'Kosovo (Disputed Territory)': ['RS', [41.8, 20.0, 43.3, 21.8]] };
  const bad = [];
  for(const c of COL){
    const key = c.city + '|' + c.country, [lat, lon] = COORDS[key] || [];
    if(lat == null) continue;
    const want = ccOf(c.country);
    if(!want){ bad.push(key + ' (unknown country)'); continue; }
    if(at(lon, lat) === want) continue;
    const fu = FILED_UNDER[c.country];
    if(fu && at(lon, lat) === fu[0]){
      const [s, w, n, e] = fu[1];
      if(lat >= s && lat <= n && lon >= w && lon <= e) continue;
    }
    const d = kmTo(lon, lat, want);
    if(!(d <= 10)) bad.push(key + ' ' + (at(lon, lat) || 'sea') + ' ' + d.toFixed(0) + ' km');
  }
  check('M1 every location lands in its own country (or within 10 km of its coast)', !bad.length, bad.slice(0, 6).join('; '));
}

// ── M2 engine replay ─────────────────────────────────────────────────────
const PLANS = [
  { name: 'Perth, Simple with housing, savings ratio', from: 'Perth|Australia', detail: 'simple', expense: 4550, housing: 'include', salary: 6500, mode: 'required', target: 'ratio' },
  { name: 'Jakarta, Simple without housing, nominal savings', from: 'Jakarta|Indonesia', detail: 'simple', expense: 17500000, housing: 'exclude', salary: 25000000, mode: 'required', target: 'nominal' },
  { name: 'Zurich, Simple, Global salary', from: 'Zurich|Switzerland', detail: 'simple', expense: 5200, housing: 'include', salary: 7800, mode: 'global' },
  { name: 'Perth Quick Start, Detailed, savings ratio', preset: 'per', from: 'Perth|Australia', detail: 'detailed', salary: 6500,
    rows: [['rent', 2400], ['groceries', 600], ['eating_out', 400], ['utilities', 250], ['fuel', 250], ['other', 650]], mode: 'required', target: 'ratio' },
  { name: 'Dubai Quick Start, Detailed, nominal savings', preset: 'dxb', from: 'Dubai|United Arab Emirates', detail: 'detailed', salary: 30000,
    rows: [['rent', 9000], ['groceries', 2000], ['eating_out', 2000], ['utilities', 800], ['fuel', 400], ['other', 3800]], mode: 'required', target: 'nominal' },
  { name: 'Jakarta Quick Start, Detailed, Global salary', preset: 'jkt', from: 'Jakarta|Indonesia', detail: 'detailed', salary: 25000000,
    rows: [['rent', 7000000], ['groceries', 3000000], ['eating_out', 2500000], ['utilities', 1200000], ['fuel', 800000], ['other', 3000000]], mode: 'global' },
  { name: 'Spending more than earning, Global salary', from: 'Singapore|Singapore', detail: 'simple', expense: 9000, housing: 'include', salary: 8000, mode: 'global' },
];
const { ctx: mctx, page } = await openMap();
const STATS = {};
for(const plan of PLANS){
  await applyPlan(page, plan);
  const got = Object.fromEntries((await rowsOf(page)).map(r => [r.key, r]));
  const want = replay(plan);
  const bad = [];
  for(const [key, w] of Object.entries(want)){
    const g = got[key];
    if(!g){ bad.push(key + ' missing'); continue; }
    for(const f of ['E', 'fx', 'sal', 'sav', 'ratio', 'q']){
      const gv = f === 'fx' && !(g.fx > 0) ? 0 : g[f];
      if(!close(gv, w[f])) bad.push(`${key} ${f} ${gv} vs ${w[f]}`);
    }
    // Below zero only in Global salary mode, and only when savings are.
    const neg = plan.mode === 'global' && w.sav != null && w.sav < -1e-6;
    if(g.neg !== neg) bad.push(key + ' neg ' + g.neg);
  }
  const est = Object.values(want).filter(w => w.sal != null).length;
  check('M2 ' + plan.name + ': all ' + Object.keys(want).length + ' cities match the replay', !bad.length, bad.length ? bad.slice(0, 4).join('; ') : est + ' with an estimate');
  STATS[plan.name] = { got, want };
}
// The plans above leave no city without an estimate; this one does: a gas
// row reaches cities with no gas price, and those must say so, not guess.
{
  const plan = { name: 'Detailed with gas', preset: 'per', from: 'Perth|Australia', detail: 'detailed', salary: 6500,
    rows: [['rent', 2400], ['groceries', 600], ['eating_out', 400], ['utilities', 250], ['fuel', 250], ['other', 650]], mode: 'required', target: 'ratio' };
  await applyPlan(page, plan);
  await page.click('#addRow'); await settle(page);
  // The new row is the first unused category: electricity. Make it gas.
  await page.evaluate(() => { const s = [...document.querySelectorAll('#rows .row-cat')].pop(); s.value = 'gas_util'; s.dispatchEvent(new Event('change', {bubbles: true})); });
  await settle(page);
  await type(page, '#rows .exp-row:last-child .row-amt', 80);
  plan.rows = plan.rows.concat([['gas_util', 80]]);
  const want = replay(plan), got = Object.fromEntries((await rowsOf(page)).map(r => [r.key, r]));
  const none = Object.keys(want).filter(k => want[k].E == null);
  const bad = Object.keys(want).filter(k => !close(got[k].E, want[k].E) || (want[k].E == null) !== (got[k].arm === 'nodata'));
  check('M2 a city with no index for a row has no estimate, never a guess', none.length > 0 && !bad.length, none.length + ' cities lack a gas price' + (bad.length ? '; wrong: ' + bad.slice(0, 3).join(', ') : ''));
  const card = await page.evaluate(k => { const s = window.__colmap.summary(); return s.nodata; }, none[0]);
  check('M2 the cities with no estimate are counted', card === none.length, card + ' vs ' + none.length);
}

// ── M4 colour ────────────────────────────────────────────────────────────
{
  const toks = await page.evaluate(() => { const cs = getComputedStyle(document.body); return Object.fromEntries(['--cm-cheap-3', '--cm-dear-3', '--cm-neg-3', '--cm-mid'].map(n => [n, cs.getPropertyValue(n).trim()])); });
  const rgb = h => { h = h.replace('#', ''); const n = parseInt(h, 16); return `rgb(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255})`; };
  for(const plan of [PLANS[0], PLANS[2], PLANS[5]]){
    await applyPlan(page, plan);
    const rows = (await rowsOf(page)).filter(r => r.q != null && r.sal != null);
    const bad = [];
    for(const r of rows){
      const arm = r.neg ? 'neg' : r.q < 1 - 5e-4 ? 'cheap' : r.q > 1 + 5e-4 ? 'dear' : 'mid';
      if(r.arm !== arm) bad.push(r.key + ' ' + r.arm + ' not ' + arm);
      if(plan.mode !== 'global' && r.arm === 'neg') bad.push(r.key + ' red outside Global mode');
    }
    const home = rows.find(r => r.home);
    if(home.arm !== 'mid' || home.color !== rgb(toks['--cm-mid'])) bad.push('home is ' + home.arm + ' ' + home.color);
    const byQ = rows.slice().sort((a, b) => a.q - b.q);
    if(byQ[0].color !== rgb(toks['--cm-cheap-3'])) bad.push('cheapest ' + byQ[0].key + ' is ' + byQ[0].color);
    const top = byQ[byQ.length - 1];
    const topTok = top.neg ? '--cm-neg-3' : '--cm-dear-3';
    if(top.color !== rgb(toks[topTok])) bad.push('dearest ' + top.key + ' is ' + top.color + ', not ' + topTok);
    // Every view is ordered by q: salary, living cost and (in Global mode)
    // savings and ratio move one way with it; Required-mode savings follow
    // the target.
    const monotone = (f, dir) => byQ.every((r, i) => i === 0 || dir * (f(r) - f(byQ[i - 1])) >= -1e-6 * Math.max(1, Math.abs(f(r))));
    const mono = plan.mode === 'global'
      ? [['living', r => r.E * r.fx, 1], ['savings', r => r.sav * r.fx, -1], ['ratio', r => r.ratio, -1]]
      : [['salary', r => r.sal * r.fx, 1], ['living', r => r.E * r.fx, 1], ['savings', r => r.sav * r.fx, plan.target === 'ratio' ? 1 : 0], ['ratio', r => r.ratio, plan.target === 'ratio' ? 0 : -1]];
    mono.forEach(([v, f, dir]) => { if(dir && !monotone(f, dir)) bad.push(v + ' is not ordered by q'); });
    check('M4 ' + plan.name + ': arms, home, extremes and order', !bad.length, bad.slice(0, 4).join('; '));
    // Changing the view never repaints a city.
    const views = await page.evaluate(() => [...document.querySelectorAll('#viewGroup .seg-btn')].map(b => b.dataset.val));
    const base = Object.fromEntries((await rowsOf(page)).map(r => [r.key, r.color]));
    let moved = 0;
    for(const v of views){
      await seg(page, 'viewGroup', v);
      (await rowsOf(page)).forEach(r => { if(r.color !== base[r.key]) moved++; });
    }
    check('M4 ' + plan.name + ': the ' + views.length + ' views share one colouring', moved === 0, moved + ' changes');
  }
}

// ── M5 headline, M7 labels ───────────────────────────────────────────────
{
  await applyPlan(page, PLANS[3]);
  const sg = 'Singapore|Singapore';
  await page.evaluate(k => window.__colmap.flyTo(k, 0), sg);
  await page.waitForTimeout(300);
  const [x, y] = await page.evaluate(k => window.__colmap.screenOf(k), sg);
  const box = await page.$eval('#mapCanvas', el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top }; });
  await page.mouse.move(box.x + x, box.y + y);
  await page.waitForTimeout(200);
  const card = await page.evaluate(() => window.__colmap.card());
  const r = (await rowsOf(page)).find(o => o.key === sg);
  const fmt = (v, c) => (v < 0 ? '-' : '') + c + ' ' + Math.abs(v).toLocaleString('en-AU', { maximumFractionDigits: 0 });
  const head = fmt(r.sal * r.fx, 'AUD'), local = '(' + fmt(r.sal, 'SGD') + ')';
  check('M5 the card leads with your currency, its own in brackets', !!card && card.includes(head) && card.includes(local), (card || 'no card').replace(/\n/g, ' | ').slice(0, 140));
  const labels = await page.evaluate(() => window.__colmap.labels());
  const lab = labels.find(l => l.key === sg);
  check('M5 the map label reads the same two figures', !!lab && lab.text[1] === head && lab.text[2] === local, lab ? lab.text.join(' / ') : 'Singapore not labelled');

  const t = await page.evaluate(() => window.__colmap.transform());
  const overlaps = (L) => { const o = []; L.forEach((a, i) => L.slice(i + 1).forEach(b => { if(a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) o.push(a.key + ' / ' + b.key); })); return o; };
  const outside = L => L.filter(l => l.x < 0 || l.y < 0 || l.x + l.w > t.vw || l.y + l.h > t.vh).map(l => l.key);
  const o1 = overlaps(labels), x1 = outside(labels);
  await page.click('#zoomWorld'); await page.waitForTimeout(1000);
  const world = await page.evaluate(() => window.__colmap.labels());
  const o2 = overlaps(world), x2 = outside(world);
  check('M7 no label overlaps another or leaves the map', !o1.length && !x1.length && !o2.length && !x2.length,
    `${labels.length} labels zoomed in, ${world.length} on the world` + (o1.concat(o2, x1, x2).length ? ': ' + o1.concat(o2, x1, x2).slice(0, 3).join('; ') : ''));
  check('M7 the world view labels a fair spread of cities', world.length >= 25, world.length + ' labels');
  const cur = Object.fromEntries((await rowsOf(page)).map(o => [o.key, o.cur]));
  const own = world.filter(l => cur[l.key] === 'AUD'), other = world.filter(l => cur[l.key] !== 'AUD');
  check('M5 a label in your own currency has no bracket; every other has one', own.length > 0 && own.every(l => l.text.length === 2) && other.every(l => l.text.length === 3 && /^\(.+\)$/.test(l.text[2])),
    own.map(l => l.text.join(' ')).slice(0, 2).join('; '));
}

// ── M6 modes and views ───────────────────────────────────────────────────
{
  await page.click('.quick-start-btn[data-preset="per"]'); await settle(page);
  const viewsNow = () => page.evaluate(() => ({ views: [...document.querySelectorAll('#viewGroup .seg-btn')].map(b => b.dataset.val),
    on: (document.querySelector('#viewGroup .seg-btn.active') || {}).dataset.val, target: getComputedStyle(document.getElementById('targetRow')).display !== 'none',
    title: document.getElementById('mapTitle').textContent }));
  const a = await viewsNow();
  check('M6 Required salary opens on Required net salary with a Target, and drops the Savings ratio view its ratio target fixes', a.on === 'salary' && a.views.join() === 'salary,living,savings' && a.target, JSON.stringify(a));
  await seg(page, 'targetGroup', 'nominal');
  const n = await viewsNow();
  check('M6 a Nominal savings target drops the Nominal savings view instead', n.views.join() === 'salary,living,ratio', JSON.stringify(n));
  await seg(page, 'viewGroup', 'ratio');
  await seg(page, 'modeGroup', 'global');
  const b = await viewsNow();
  check('M6 Global salary drops the salary view, opens on Nominal savings, hides Target', b.on === 'savings' && b.views.join() === 'living,savings,ratio' && !b.target, JSON.stringify(b));
  await seg(page, 'viewGroup', 'living');
  await seg(page, 'modeGroup', 'required');
  const c = await viewsNow();
  await seg(page, 'modeGroup', 'global');
  const d = await viewsNow();
  check('M6 each mode keeps the view it was left on', c.on === 'ratio' && d.on === 'living', c.on + ' / ' + d.on);
  await seg(page, 'modeGroup', 'required'); await seg(page, 'targetGroup', 'ratio');
  const e = await viewsNow();
  check('M6 a view hidden by the target falls back to the salary, and comes back with the other target', e.on === 'salary' && !e.views.includes('ratio') && e.title === 'Required net salary', JSON.stringify(e));
  await seg(page, 'targetGroup', 'nominal');
  const f = await viewsNow();
  const tip = await page.evaluate(() => document.getElementById('mapTitleTip').getAttribute('data-tip'));
  check('M6 the title stays short and its tip carries the rest', f.on === 'ratio' && f.title === 'Savings ratio' && /savings/.test(tip), f.title + ' / ' + tip);
}

// ── M13 Scaled salary mode ───────────────────────────────────────────────
// Replayed from wages.json and the cost of living files alone: your salary is
// a multiple of your city's yardstick, every city pays that multiple of its
// own, and the colour is the share of pay the lifestyle takes there over the
// share it takes at home.
{
  const WAGES = JSON.parse(readFileSync(join(HERE, '..', 'wages.json'), 'utf8'));
  const yard = (key, scale) => {
    const w = WAGES.cities[key], k = WAGES.countries[CITY[key].country];
    if(!w) return null;
    if(scale === 'min') return w.min > 0 ? w.min : null;
    if(!(w.avg > 0)) return null;
    return scale === 'avg' ? w.avg : k.ratio > 0 ? w.avg * k.ratio : null;
  };
  check('M13 every dataset city has a pay entry, and nothing else does', COL.every(c => WAGES.cities[c.city + '|' + c.country]) && Object.keys(WAGES.cities).length === COL.length,
    Object.keys(WAGES.cities).length + ' entries');
  const ny = yard('New York, NY|United States', 'avg'), hou = yard('Houston, TX|United States', 'avg');
  check('M13 average salaries are the city\'s own, not its country\'s', ny / hou > 1.1, 'New York ' + Math.round(ny) + ', Houston ' + Math.round(hou) + ' USD');
  const SPLANS = [
    { name: 'Perth, Simple, average salary', from: 'Perth|Australia', detail: 'simple', expense: 4550, housing: 'include', salary: 6500, mode: 'scaled', scale: 'avg' },
    { name: 'New York, Simple without housing, minimum wage', from: 'New York, NY|United States', detail: 'simple', expense: 5000, housing: 'exclude', salary: 7000, mode: 'scaled', scale: 'min' },
    { name: 'Jakarta Quick Start, Detailed, median salary', preset: 'jkt', from: 'Jakarta|Indonesia', detail: 'detailed', salary: 25000000,
      rows: [['rent', 7000000], ['groceries', 3000000], ['eating_out', 2500000], ['utilities', 1200000], ['fuel', 800000], ['other', 3000000]], mode: 'scaled', scale: 'median' },
    { name: 'Spending more than earning, average salary', from: 'Houston, TX|United States', detail: 'simple', expense: 5200, housing: 'include', salary: 4500, mode: 'scaled', scale: 'avg' },
  ];
  for(const plan of SPLANS){
    await applyPlan(page, plan);
    await seg(page, 'scaleGroup', plan.scale);
    const got = Object.fromEntries((await rowsOf(page)).map(r => [r.key, r]));
    const base = replay({ ...plan, mode: 'global' });
    const fe = plan.detail === 'detailed' ? plan.rows.reduce((s, r) => s + r[1], 0) : plan.expense;
    const wh = yard(plan.from, plan.scale), mult = plan.salary / wh;
    const bad = [];
    let n = 0, neg = 0;
    for(const [key, b] of Object.entries(base)){
      const W = yard(key, plan.scale), home = key === plan.from;
      const sal = b.E == null || !(b.fx > 0) ? null : home ? plan.salary : W > 0 ? mult * W : null;
      const sav = sal == null ? null : sal - b.E;
      const cq = sal > 0 && b.q != null ? (b.E / sal) / (fe / plan.salary) : null;
      const g = got[key];
      const ok = close(g.sal, sal) && close(g.sav, sav) && close(g.cq, cq, 1e-7) && close(g.W, W) &&
        g.neg === (sav != null && sav < -1e-9 * Math.max(1, Math.abs(sal))) &&
        (g.arm === 'neg') === g.neg && (g.neg || cq == null || (g.arm === 'cheap') === (cq < 1 - 5e-4));
      if(!ok) bad.push(key + ' ' + JSON.stringify({ got: [g.sal, g.cq, g.W, g.arm], want: [sal, cq, W] }));
      if(sal != null) n++;
      if(g.neg) neg++;
    }
    check('M13 ' + plan.name + ': every city replays', !bad.length, bad.length ? bad.slice(0, 2).join('; ') : n + ' cities, ' + neg + ' short');
  }
  // A city with no yardstick says why, and so does a home city with none.
  await applyPlan(page, { name: '', from: 'Perth|Australia', detail: 'simple', expense: 4550, housing: 'include', salary: 6500, mode: 'scaled' });
  await seg(page, 'scaleGroup', 'min');
  const zur = await page.evaluate(() => window.__colmap.wage('Zurich|Switzerland', 'min'));
  check('M13 a canton without a minimum wage has no estimate, and says why', zur.v == null && /canton/.test(zur.why), zur.why);
  await pickFrom(page, 'Copenhagen|Denmark');
  const vt = await page.textContent('#verdict');
  check('M13 a home city with no minimum wage says so instead of scaling', /no minimum wage for Copenhagen/i.test(vt), vt.slice(0, 90));
  await seg(page, 'scaleGroup', 'median');
  const tk = await page.evaluate(() => window.__colmap.wage('Tokyo|Japan', 'median'));
  check('M13 a country with no published median has no median estimate', tk.v == null && /Japan/.test(tk.why), tk.why);
  // Views, rows and the reload.
  await seg(page, 'scaleGroup', 'avg');
  const st = await page.evaluate(() => ({ views: [...document.querySelectorAll('#viewGroup .seg-btn')].map(b => b.dataset.val), on: window.__colmap.view(),
    scale: !document.getElementById('scaleRow').hidden, target: !document.getElementById('targetRow').hidden, title: document.getElementById('mapTitle').textContent }));
  check('M13 Scaled salary opens on the scaled salary, shows Scale by and hides Target', st.on === 'salary' && st.views.join() === 'salary,living,savings,ratio' && st.scale && !st.target, JSON.stringify(st));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__colmap && window.__colmap.mapReady(), null, { timeout: 15000 });
  await settle(page);
  const back = await page.evaluate(() => ({ s: window.__colmap.state(), x: window.__colmap.scaled() }));
  check('M13 a reload comes back in Scaled salary mode on the same yardstick', back.s.mode === 'scaled' && back.s.scale === 'avg' && back.x.mult > 0, back.s.mode + ' / ' + back.s.scale + ' / ' + (back.x.mult || 0).toFixed(3) + '×');
  // State saved before the mode existed has neither key and still opens.
  // The mini cache is rewritten as an older page saved it, then reloaded.
  await page.evaluate(() => {
    for(let i = 0; i < localStorage.length; i++){
      const k = localStorage.key(i), v = JSON.parse(localStorage.getItem(k) || 'null');
      if(!v || !v.__extra || !v.__extra.fromKey) continue;
      delete v.__extra.scale; delete v.__extra.views.scaled; v.__extra.mode = 'global';
      localStorage.setItem(k, JSON.stringify(v));
    }
  });
  // A second tab reads it, since this one saves its own plan on unload.
  const p2 = await mctx.newPage();
  await p2.route('**/*', route => route.request().url().startsWith(BASE) ? route.continue() : route.abort());
  await p2.goto(MAP, { waitUntil: 'load' });
  await p2.waitForFunction(() => window.__colmap && window.__colmap.mapReady(), null, { timeout: 15000 });
  const old = await p2.evaluate(() => window.__colmap.state());
  await p2.close();
  check('M13 a plan saved before Scaled salary existed opens as it was, with the new mode at its defaults',
    old.mode === 'global' && old.scale === 'avg' && old.views.scaled === 'salary', old.mode + ' / ' + old.scale + ' / ' + old.views.scaled);
  await applyPlan(page, { from: 'Perth|Australia', detail: 'simple', expense: 4550, housing: 'include', salary: 6500, mode: 'required', target: 'ratio' });
}

// ── Q  Quick Start is the page's reset ───────────────────────────────────
// No Reset button, on one claim: each scenario opens from the defaults, so
// over a messy page it lands exactly where it lands on a fresh one.
{
  const presets = await page.evaluate(() => [...document.querySelectorAll('.quick-start-btn')].map(b => b.dataset.preset));
  const snap = p => p.evaluate(() => ({ s: window.__colmap.state(), v: document.getElementById('verdict').innerText,
    on: [...document.querySelectorAll('.seg-btn.active')].map(b => b.dataset.val).join('|') }));
  const bad = [];
  for(const id of presets){
    const { ctx: fc, page: fresh } = await openMap();
    await fresh.click(`.quick-start-btn[data-preset="${id}"]`); await settle(fresh);
    const want = await snap(fresh);
    await fc.close();
    await pickFrom(page, 'Zurich|Switzerland');
    await type(page, '#salary', 123);
    await seg(page, 'modeGroup', 'global'); await seg(page, 'viewGroup', 'ratio');
    await seg(page, 'modeGroup', 'required'); await seg(page, 'targetGroup', 'nominal'); await seg(page, 'viewGroup', 'living');
    await seg(page, 'detailGroup', 'simple'); await type(page, '#expense', 77); await seg(page, 'housingGroup', 'exclude');
    await seg(page, 'detailGroup', 'detailed'); await page.click('#addRow'); await settle(page);
    await page.click(`.quick-start-btn[data-preset="${id}"]`); await settle(page);
    const got = await snap(page);
    if(JSON.stringify(got) !== JSON.stringify(want)) bad.push(id);
  }
  check('Q  every Quick Start opens the same over a messy page as on a fresh one', !bad.length, bad.length ? 'differs: ' + bad.join(', ') : presets.length + ' scenarios');
}

// ── M9 gestures, M10 reload ──────────────────────────────────────────────
{
  await page.click('#zoomWorld'); await page.waitForTimeout(900);
  const box = await page.$eval('#mapCanvas', el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.evaluate(() => window.scrollTo(0, 0));
  const T0 = await page.evaluate(() => window.__colmap.transform());
  const b2 = await page.$eval('#mapCanvas', el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const cx = b2.x + b2.w / 2, cy = b2.y + b2.h / 2;
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 120, cy + 10, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(150);
  const T1 = await page.evaluate(() => window.__colmap.transform());
  check('M9 a drag pans the map', Math.abs(T1.x - T0.x) > 60 && T1.k === T0.k, `x ${T0.x.toFixed(0)} → ${T1.x.toFixed(0)}`);
  const sy0 = await page.evaluate(() => window.scrollY);
  await page.mouse.move(cx, cy); await page.mouse.wheel(0, 300); await page.waitForTimeout(250);
  const T2 = await page.evaluate(() => window.__colmap.transform());
  const sy1 = await page.evaluate(() => window.scrollY);
  check('M9 a plain wheel leaves the map alone and scrolls the page', T2.k === T1.k && sy1 > sy0, `k ${T1.k.toFixed(3)} → ${T2.k.toFixed(3)}, scroll ${sy0} → ${sy1}`);
  const b3 = await page.$eval('#mapCanvas', el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(b3.x, b3.y);
  await page.keyboard.down('Control'); await page.mouse.wheel(0, -400); await page.keyboard.up('Control');
  await page.waitForTimeout(250);
  const T3 = await page.evaluate(() => window.__colmap.transform());
  check('M9 Ctrl and the wheel zooms the map', T3.k > T2.k * 1.5, `k ${T2.k.toFixed(3)} → ${T3.k.toFixed(3)}`);
  const key = 'Perth|Australia';
  await page.evaluate(k => window.__colmap.flyTo(k, 0), key); await page.waitForTimeout(250);
  const [px, py] = await page.evaluate(k => window.__colmap.screenOf(k), key);
  const b4 = await page.$eval('#mapCanvas', el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top }; });
  await page.mouse.click(b4.x + px, b4.y + py); await page.waitForTimeout(200);
  const pinned = await page.evaluate(() => ({ text: window.__colmap.card(), pinned: document.getElementById('placeCard').classList.contains('pinned') }));
  check('M9 a click pins the city\'s card', pinned.pinned && /Perth/.test(pinned.text || ''), (pinned.text || '').split('\n')[0]);

  // Picking a city flies the map to that city, not the one before it.
  await pickFrom(page, 'Tokyo|Japan');
  await page.waitForTimeout(1300);
  const tk = await page.evaluate(() => { const t = window.__colmap.transform(), p = window.__colmap.screenOf('Tokyo|Japan'); return { p, vw: t.vw, vh: t.vh, k: t.k, minK: t.minK }; });
  check('M9 picking a city flies the map to it', tk.k > tk.minK * 1.5 && Math.abs(tk.p[0] - tk.vw / 2) < tk.vw * 0.2 && Math.abs(tk.p[1] - tk.vh / 2) < tk.vh * 0.2,
    `Tokyo at ${tk.p.map(v => v.toFixed(0)).join(',')} of ${tk.vw}x${tk.vh}`);

  await fullScreenChecks(page, 'desktop');

  const before = await page.evaluate(() => ({ s: window.__colmap.state(), v: document.getElementById('verdict').innerText }));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__colmap && window.__colmap.mapReady());
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({ s: window.__colmap.state(), v: document.getElementById('verdict').innerText }));
  check('M10 a reload comes back to the same plan and answer', JSON.stringify(before) === JSON.stringify(after), after.v.slice(0, 80));

  // M11 borders, held to the zone file read here without the page's code.
  {
    const kinds = await page.evaluate(() => window.__colmap.arcKinds());
    const topo = JSON.parse(readFileSync(join(ROOT, 'worldclock', 'zones.json'), 'utf8'));
    const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
    const arcs = topo.arcs.map(a => { let x = 0, y = 0; return a.map(p => { x += p[0]; y += p[1]; return [x * sx + tx, y * sy + ty]; }); });
    const polysOf = g => g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : [];
    const own = arcs.map(() => []);
    topo.objects.zones.geometries.forEach(g => polysOf(g).forEach(p => p.forEach(r => r.forEach(a => own[a < 0 ? ~a : a].push(g.properties.id)))));
    const only = (...ids) => own.map((o, i) => i).filter(i => own[i].length === ids.length && ids.every(id => own[i].includes(id)));
    const within = (i, [w, s, e, n]) => arcs[i].every(([x, y]) => x >= w && x <= e && y >= s && y <= n);
    const name = k => ({ '-1': 'hidden', '0': 'coast', '1': 'border' })[k];
    const all = (ids, want) => ids.length > 0 && ids.every(i => kinds[i] === want);
    const show = ids => ids.length + ' edges: ' + [...new Set(ids.map(i => name(kinds[i])))].join('/');
    // Asia/Urumqi is laid over Asia/Shanghai; its own edge runs through China.
    const xj = only('Asia/Urumqi');
    check('M11 no line splits Xinjiang from the rest of China', all(xj, -1), show(xj));
    // Asia/Hebron is laid over Asia/Jerusalem; Jerusalem's holes in it are
    // settlement areas, not a border.
    const wb = only('Asia/Jerusalem').filter(i => within(i, [34.88, 31.34, 35.57, 32.55]));
    check('M11 the West Bank is drawn whole, with no rings inside it', all(wb, -1), show(wb));
    // tzdb files northern Vietnam under Asia/Bangkok.
    const vn = only('Asia/Bangkok', 'Asia/Ho_Chi_Minh');
    check('M11 no border across Vietnam', all(vn, -1), show(vn));
    // Where two countries' zones overlap the border is disputed; both lines stay.
    const sd = [...only('Africa/Juba'), ...only('Africa/Khartoum')].filter(i => within(i, [22, 8, 30, 11]));
    check('M11 a disputed area (Abyei, Kafia Kingi) keeps both claim lines', all(sd, 1), show(sd));
    const np = [...only('Asia/Kathmandu'), ...only('Asia/Kolkata')].filter(i => within(i, [80, 29.5, 81.5, 31]));
    check('M11 a disputed area (Kalapani) keeps both claim lines', all(np, 1), show(np));
  }
  check('M  no page errors on the map', !page.__errors.length, page.__errors.slice(0, 3).join('; '));
}
await mctx.close();

// ── M3 parity with the comparator ────────────────────────────────────────
{
  const fmtC = (v, c) => (v < 0 ? '-' : '') + c + ' ' + Math.abs(v).toLocaleString('en-AU', { maximumFractionDigits: 0 });
  // Detailed: the comparator's Quick Start budgets against the map's.
  const PAIRS = [['sg-au', 'sg'], ['sea', 'jkt'], ['us', 'nyc'], ['eu', 'lon'], ['me', 'dxb']];
  const { ctx: cctx, page: cp } = await openPage(COMP, { seenTour: true });
  await cp.waitForFunction(() => document.getElementById('dataUpdatedText').textContent.length > 0);
  const { ctx: m2, page: mp } = await openMap();
  const bad = []; let n = 0;
  for(const [cq, mq] of PAIRS){
    await cp.click(`.quick-start-btn[data-preset="${cq}"]`); await cp.waitForTimeout(300);
    const comp = await cp.evaluate(() => {
      const cities = [...document.querySelectorAll('#detailSec thead .city-th input.city-search')].map(i => i.value);
      const req = [...document.querySelectorAll('#detailSec tr.salary-tr td.num-td')].map(td => td.querySelector('span').textContent.trim());
      const rat = [...document.querySelectorAll('#detailSec tr.savings-tr td.dt-sav .sub-num')].map(d => d.textContent.trim());
      return { cities, req, rat };
    });
    await mp.click(`.quick-start-btn[data-preset="${mq}"]`); await mp.waitForTimeout(300);
    const rows = await mp.evaluate(() => window.__colmap.rows());
    comp.cities.slice(1).forEach((label, i) => {
      const r = rows.find(o => (o.key.split('|')[0] + ', ' + o.key.split('|')[1]) === label);
      if(!r){ bad.push(label + ' not on the map'); return; }
      n++;
      const mine = fmtC(r.sal, r.cur), ratio = (r.ratio * 100).toFixed(1) + '% ratio';
      if(mine !== comp.req[i]) bad.push(`${cq} ${label}: map ${mine}, comparator ${comp.req[i]}`);
      if(ratio !== comp.rat[i]) bad.push(`${cq} ${label}: ratio map ${ratio}, comparator ${comp.rat[i]}`);
    });
  }
  check('M3 Detailed: the comparator and the map quote the same required salary', !bad.length && n >= 15, bad.length ? bad.slice(0, 3).join('; ') : n + ' cities across 5 budgets');

  // Simple: pick two cities in the comparator, as a reader would.
  const SIMPLE = [
    { from: 'Perth|Australia', to: 'Singapore|Singapore', sal: 6500, exp: 4550, housing: 'include', target: 'ratio' },
    { from: 'Perth|Australia', to: 'Jakarta|Indonesia', sal: 6500, exp: 4550, housing: 'exclude', target: 'nominal' },
    { from: 'London|United Kingdom', to: 'Paris|France', sal: 4500, exp: 3600, housing: 'include', target: 'nominal' },
    { from: 'Berlin|Germany', to: 'Paris|France', sal: 3200, exp: 2300, housing: 'include', target: 'ratio' },
  ];
  const sbad = [];
  for(const p of SIMPLE){
    await cp.evaluate(() => { document.querySelector('#modeGroup .seg-btn[data-val="simple"]').click(); document.querySelector('#goalGroup .seg-btn[data-val="earn"]').click(); });
    await cp.click(`#housingGroup .seg-btn[data-val="${p.housing}"]`);
    for(const [id, key] of [['fromPicker', p.from], ['toPicker', p.to]]){
      await cp.evaluate(({id, key}) => {
        const input = document.querySelector('#' + id + ' input.city-search');
        input.value = key.split('|')[0]; input.dispatchEvent(new Event('input'));
        [...document.querySelectorAll('#' + id + ' .city-opt')].find(o => o.dataset.key === key).dispatchEvent(new MouseEvent('mousedown'));
      }, {id, key});
      await cp.waitForTimeout(80);
    }
    for(const [id, v] of [['se_fs', p.sal], ['se_fe', p.exp]]){
      await cp.evaluate(({id, v}) => { const el = document.getElementById(id); el.value = String(v); el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('blur')); }, {id, v});
      await cp.waitForTimeout(80);
    }
    await cp.click(`#targetGroup .seg-btn[data-val="${p.target}"]`); await cp.waitForTimeout(150);
    const comp = await cp.evaluate(() => ({ req: document.querySelector('.req-val').textContent.trim(),
      est: document.querySelectorAll('.sav-val.mono')[0].textContent.trim() }));
    await applyPlan(mp, { from: p.from, detail: 'simple', expense: p.exp, housing: p.housing, salary: p.sal, mode: 'required', target: p.target });
    const r = (await mp.evaluate(() => window.__colmap.rows())).find(o => o.key === p.to);
    const mine = { req: fmtC(r.sal, r.cur), est: fmtC(r.E, r.cur) };
    if(mine.req !== comp.req || mine.est !== comp.est) sbad.push(`${p.from} → ${p.to}: map ${mine.req} / ${mine.est}, comparator ${comp.req} / ${comp.est}`);
  }
  check('M3 Simple: the comparator and the map agree on living cost and required salary', !sbad.length, sbad.length ? sbad.join('; ') : SIMPLE.length + ' pairs, both targets, housing in and out');
  check('M3 no page errors on the comparator', !cp.__errors.length, cp.__errors.slice(0, 2).join('; '));
  await cctx.close(); await m2.close();
}

// ── M8 live rates ────────────────────────────────────────────────────────
{
  const today = new Date().toISOString().slice(0, 10);
  // The market moved: AUD 10% stronger against the USD, every other rate as bundled.
  const rates = { ...RATE, AUD: RATE.AUD / 1.1 };
  const live = { result: 'success', time_last_update_unix: Math.floor(Date.parse(today + 'T00:00:00Z') / 1000), rates };
  const { ctx, page: lp } = await openMap({ live });
  await lp.waitForFunction(() => window.__colmap.live() != null, null, { timeout: 10000 });
  await applyPlan(lp, PLANS[3]);
  const got = Object.fromEntries((await lp.evaluate(() => window.__colmap.rows())).map(r => [r.key, r]));
  const want = replay(PLANS[3], (f, t) => rates[f] / rates[t]);
  const wantBundled = replay(PLANS[3]);
  const bad = [];
  for(const [k, w] of Object.entries(want)){
    for(const f of ['E', 'fx', 'sal', 'sav', 'ratio', 'q']) if(!close(got[k][f], w[f])) bad.push(`${k} ${f} ${got[k][f]} vs ${w[f]}`);
    if(!close(got[k].E, wantBundled[k].E)) bad.push(k + ' living cost moved with the rate');
  }
  const sg = got['Singapore|Singapore'];
  check('M8 a live rate moves money across the border and leaves local prices alone', !bad.length && !close(sg.fx, wantBundled['Singapore|Singapore'].fx),
    bad.length ? bad.slice(0, 3).join('; ') : `Singapore: 1 SGD = ${sg.fx.toFixed(4)} AUD live, ${wantBundled['Singapore|Singapore'].fx.toFixed(4)} bundled`);
  await ctx.close();
}

// ── M12 full screen ──────────────────────────────────────────────────────
async function fullScreenChecks(page, tag){
  const inPage = await page.$eval('#mapWrap', el => el.getBoundingClientRect().height);
  await page.click('#mapFull'); await page.waitForTimeout(300);
  const g = await page.evaluate(() => {
    const r = s => { const el = document.querySelector(s); if(!el) return null; const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
    return { full: window.__colmap.full(), W: innerWidth, H: innerHeight, card: r('#mapCard'), wrap: r('#mapWrap'),
      title: r('#legend .lg-title'), bar: r('#legend .lg-bar'), view: r('#viewGroup'), zoom: r('.map-zoom'),
      titleText: (document.querySelector('#legend .lg-title') || {}).textContent || '',
      views: document.querySelectorAll('#viewGroup .seg-btn').length, t: window.__colmap.transform(),
      sw: document.documentElement.scrollWidth, pressed: document.getElementById('mapFull').getAttribute('aria-pressed') };
  });
  const near = (a, b) => Math.abs(a - b) <= 1;
  check(`M12 ${tag}: ⤢ fills the window with the map card`, g.full && g.pressed === 'true' && near(g.card.l, 0) && near(g.card.t, 0) && near(g.card.w, g.W) && near(g.card.h, g.H),
    `card ${g.card.w.toFixed(0)}x${g.card.h.toFixed(0)} in ${g.W}x${g.H}`);
  check(`M12 ${tag}: the map takes most of the screen and the canvas follows it`, g.wrap.h > g.H * 0.55 && g.wrap.h > inPage && near(g.t.vw, g.wrap.w - 2) && near(g.t.vh, g.wrap.h - 2) && g.wrap.b <= g.H + 1,
    `map ${g.wrap.w.toFixed(0)}x${g.wrap.h.toFixed(0)} (was ${inPage.toFixed(0)} tall), canvas ${g.t.vw}x${g.t.vh}`);
  const above = b => b && b.h > 0 && b.b <= g.wrap.t + 1 && b.l >= -1 && b.r <= g.W + 1;
  check(`M12 ${tag}: the legend and View selector stay on screen above the map`, /^Living cost against .+, for the same lifestyle$/.test(g.titleText) && above(g.title) && above(g.bar) && above(g.view) && g.views >= 2,
    `"${g.titleText}", ${g.views} views`);
  check(`M12 ${tag}: the zoom buttons sit inside the map, nothing pushed sideways`, g.zoom.t >= g.wrap.t && g.zoom.b <= g.wrap.b && g.zoom.r <= g.wrap.r && g.sw <= g.W, `page ${g.sw}px wide`);
  // Switching the view in full screen keeps it full and redraws the labels.
  const v0 = await page.evaluate(() => window.__colmap.view());
  const other = await page.$$eval('#viewGroup .seg-btn', bs => (bs.find(b => !b.classList.contains('active')) || {}).dataset.val);
  await page.click(`#viewGroup .seg-btn[data-val="${other}"]`); await page.waitForTimeout(250);
  const v1 = await page.evaluate(() => ({ v: window.__colmap.view(), full: window.__colmap.full() }));
  check(`M12 ${tag}: the View selector works in full screen`, v1.full && v1.v === other && v1.v !== v0, `${v0} → ${v1.v}`);
  await page.click(`#viewGroup .seg-btn[data-val="${v0}"]`); await page.waitForTimeout(150);
  if(tag === 'desktop'){
    const k0 = (await page.evaluate(() => window.__colmap.transform())).k, sy0 = await page.evaluate(() => scrollY);
    await page.mouse.move(g.wrap.l + g.wrap.w / 2, g.wrap.t + g.wrap.h / 2); await page.mouse.wheel(0, -300); await page.waitForTimeout(250);
    const k1 = (await page.evaluate(() => window.__colmap.transform())).k, sy1 = await page.evaluate(() => scrollY);
    check('M12 desktop: a plain wheel zooms the full-screen map', k1 > k0 * 1.2 && sy1 === sy0, `k ${k0.toFixed(3)} → ${k1.toFixed(3)}`);
    const key = 'Perth|Australia';
    await page.evaluate(k => window.__colmap.flyTo(k, 0), key); await page.waitForTimeout(250);
    const [px, py] = await page.evaluate(k => window.__colmap.screenOf(k), key);
    await page.mouse.click(g.wrap.l + 1 + px, g.wrap.t + 1 + py); await page.waitForTimeout(200);
    const pinned = await page.evaluate(() => !!window.__colmap.card());
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    const e1 = await page.evaluate(() => ({ card: !!window.__colmap.card(), full: window.__colmap.full() }));
    check('M12 desktop: Esc closes a pinned card first and keeps the map full', pinned && !e1.card && e1.full);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  } else {
    await page.click('#mapFull'); await page.waitForTimeout(300);
  }
  const back = await page.evaluate(() => ({ full: window.__colmap.full(), h: document.getElementById('mapWrap').getBoundingClientRect().height,
    lock: document.documentElement.classList.contains('map-full-open'), pressed: document.getElementById('mapFull').getAttribute('aria-pressed') }));
  check(`M12 ${tag}: ${tag === 'desktop' ? 'Esc' : 'the button'} puts the map back in the page`, !back.full && !back.lock && back.pressed === 'false' && Math.abs(back.h - inPage) <= 1,
    `map ${back.h.toFixed(0)} tall again`);
}

// ── Phone ────────────────────────────────────────────────────────────────
{
  const { ctx, page: pp } = await openMap({ viewport: { width: 390, height: 844 } });
  await pp.click('.quick-start-btn[data-preset="sg"]'); await pp.waitForTimeout(500);
  const w = await pp.evaluate(() => document.documentElement.scrollWidth);
  check('M  a phone (390px) gets no sideways scroll', w <= 390, 'page is ' + w + 'px wide');
  await fullScreenChecks(pp, 'phone');
  await ctx.close();
}

await browser.close();
server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
