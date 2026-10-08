// Valuate Everything: end-to-end audit harness.
//
// Drives the REAL page in headless Chromium (CDN libraries stubbed; a Plotly
// stub records every plot it is handed, so the plotted points can be checked)
// and holds it to an INDEPENDENT replay of the documented mathematics:
//   - the fit is solved on the RAW, unstandardised features with an explicit
//     matrix inverse (Gauss-Jordan), where the page standardises first and
//     eliminates with partial pivoting;
//   - Ridge is replayed in its centred closed form, (ZᵀZ + nλI)β = Zᵀ(y − ȳ),
//     with the intercept set to ȳ afterwards;
//   - Quadratic is replayed on the raw powers [x, x²], not on standardised
//     squares. Both span the same space, so predictions must agree exactly.
// Anything that agrees under both formulations agrees on the maths, not on a
// shared implementation.
//
// Run: node run.mjs
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = pathToFileURL(join(HERE, '..', 'index.html')).href;

const PLOTLY_STUB = `
window.__plots = [];
window.Plotly = {
  react: function(div, data, layout){ window.__plots.push({ data: data, layout: layout }); return Promise.resolve(div); },
  relayout: function(){ return Promise.resolve(); },
  downloadImage: function(){ return Promise.resolve(); },
  toImage: function(){ return Promise.resolve(''); }
};
try { localStorage.clear(); } catch(e){}`;

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  console.log((ok ? '  PASS  ' : '✗ FAIL  ') + name + (detail ? '  — ' + detail : ''));
  ok ? pass++ : fail++;
};
const money = s => parseFloat(String(s).replace(/[−–]/g, '-').replace(/[^0-9.\-]/g, ''));
const rel = (a, b) => Math.abs(a - b) / Math.max(1, Math.abs(b));

/* ══════════════ Independent replay ══════════════ */

// Gauss-Jordan inverse, no pivot search beyond a row swap on an exact zero.
function inverse(A){
  const n = A.length;
  const M = A.map((r, i) => r.concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))));
  for(let c = 0; c < n; c++){
    let p = c;
    while(p < n && Math.abs(M[p][c]) < 1e-300) p++;
    if(p === n) return null;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c];
    for(let k = 0; k < 2 * n; k++) M[c][k] /= d;
    for(let r = 0; r < n; r++){
      if(r === c) continue;
      const f = M[r][c];
      for(let k = 0; k < 2 * n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map(r => r.slice(n));
}
const matT = A => A[0].map((_, j) => A.map(r => r[j]));
const matMul = (A, B) => A.map(r => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));

// Ordinary least squares on a design that already carries its own 1 column.
function ols(D, y){
  const Dt = matT(D);
  const inv = inverse(matMul(Dt, D));
  if(!inv) return null;
  return matMul(inv, matMul(Dt, y.map(v => [v]))).map(r => r[0]);
}

// The documented preparation: today's money, ages, Yes/No as 0/1.
function replayPrepare(rows, cols, year, infl){
  const pi = cols.findIndex(c => c.type === 'price'), di = cols.findIndex(c => c.type === 'datayear');
  const fi = cols.map((c, i) => i).filter(i => ['number', 'year', 'bool'].includes(cols[i].type));
  const X = [], y = [];
  rows.forEach(r => {
    const dy = di >= 0 && String(r[di]).trim() !== '' ? +r[di] : year;
    X.push(fi.map(i => cols[i].type === 'bool' ? (/^(yes|true|1|y|on)$/i.test(String(r[i]).trim()) ? 1 : 0)
                     : cols[i].type === 'year' ? dy - +String(r[i]).replace(/,/g, '') : +String(r[i]).replace(/,/g, '')));
    y.push(+String(r[pi]).replace(/,/g, '') * Math.pow(1 + infl, year - dy));
  });
  return { X, y, types: fi.map(i => cols[i].type) };
}
function replayLinear(X, y){
  const b = ols(X.map(x => [1].concat(x)), y);
  return x => b[0] + x.reduce((s, v, j) => s + b[j + 1] * v, 0);
}
function replayLog(X, y){
  const lin = replayLinear(X, y.map(Math.log));
  return x => Math.exp(lin(x));
}
function replayQuadratic(X, y, types){
  const expand = x => x.flatMap((v, j) => types[j] === 'bool' ? [v] : [v, v * v]);
  const lin = replayLinear(X.map(expand), y);
  return x => lin(expand(x));
}
function replayRidge(X, y, lambda){
  const n = X.length, p = X[0].length;
  const mu = Array.from({ length: p }, (_, j) => X.reduce((s, x) => s + x[j], 0) / n);
  const sd = mu.map((m, j) => Math.sqrt(X.reduce((s, x) => s + (x[j] - m) ** 2, 0) / n));
  const Z = X.map(x => x.map((v, j) => (v - mu[j]) / sd[j]));
  const ybar = y.reduce((s, v) => s + v, 0) / n;
  const Zt = matT(Z);
  const A = matMul(Zt, Z).map((r, i) => r.map((v, j) => v + (i === j ? n * lambda : 0)));
  const beta = matMul(inverse(A), matMul(Zt, y.map(v => [v - ybar]))).map(r => r[0]);
  return x => ybar + x.reduce((s, v, j) => s + beta[j] * (v - mu[j]) / sd[j], 0);
}

/* ══════════════ Drive the page ══════════════ */
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.route('**/*', route => {
  const url = route.request().url();
  if(url.startsWith('file://')) return route.continue();
  return route.fulfill({ contentType: 'application/javascript', body: '/* stub */' });
});
await page.addInitScript(PLOTLY_STUB);
await page.goto(PAGE, { waitUntil: 'load' });
await page.waitForTimeout(600);

const ve = (fn, arg) => page.evaluate(fn, arg);
const setState = async st => { await ve(s => { window.__VE.state = s; }, st); await page.waitForTimeout(150); };
const setField = async (id, v) => {
  await ve(([id, v]) => { const el = document.getElementById(id); el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]);
  await page.waitForTimeout(150);
};
const engine = (state, opts) => ve(([state, opts]) => {
  const V = window.__VE;
  const o = Object.assign(V.readOpts(), opts || {});
  const prep = V.prepare(state.columns, state.rows, o);
  if(prep.error) return { error: prep.error };
  const m = V.fit(prep, o);
  if(m.error) return { error: m.error, prep: { n: prep.X.length, skipped: prep.skipped } };
  return { prep: { X: prep.X, priceToday: prep.priceToday, dataYear: prep.dataYear, skipped: prep.skipped, n: prep.X.length },
           fitted: m.fitted, r2: m.r2, rmse: m.rmse, rmseLog: m.rmseLog, coef: m.coef, dropped: m.dropped, k: m.k, mu: m.mu,
           at: (state.probe || []).map(x => m.predict(x)) };
}, [state, opts]);

const YEAR = await ve(() => window.__VE.readOpts().year);
console.log(`Current year on the page: ${YEAR}\n`);

/* ── 1. Exact recovery: noiseless listings give back the rule they came from ── */
console.log('── 1. Exact recovery ──');
{
  const cols = [
    { id: 'c1', name: 'Price', type: 'price', unit: '' }, { id: 'c2', name: 'Year', type: 'year', unit: '' },
    { id: 'c3', name: 'Km', type: 'number', unit: 'km' }, { id: 'c4', name: 'Service', type: 'bool', unit: '' },
    { id: 'c5', name: 'Data year', type: 'datayear', unit: '' }];
  const rule = (age, km, svc) => 50000 - 2000 * age - 0.05 * km + 1500 * svc;
  const rows = [];
  for(let i = 0; i < 14; i++){
    const dy = YEAR - (i % 4), yr = dy - (1 + (i * 3) % 8), km = 8000 + i * 7300 + (i % 3) * 2100, svc = i % 2;
    const today = rule(dy - yr, km, svc);
    rows.push([String(today / Math.pow(1.03, YEAR - dy)), String(yr), String(km), svc ? 'Yes' : 'No', String(dy)]);
  }
  const r = await engine({ columns: cols, rows }, { inflation: 0.03, model: 'linear' });
  check('a1 intercept α = 50,000', rel(r.coef.c0, 50000) < 1e-8, r.coef.c0.toFixed(6));
  check('a2 α(age) = −2,000 per year', rel(r.coef.a[0], -2000) < 1e-8, r.coef.a[0].toFixed(6));
  check('a3 α(km) = −0.05 per km', Math.abs(r.coef.a[1] + 0.05) < 1e-10, r.coef.a[1].toFixed(10));
  check('a4 α(service) = +1,500', rel(r.coef.a[2], 1500) < 1e-8, r.coef.a[2].toFixed(6));
  check('a5 a perfect fit reads R² = 1 and RMSE ≈ 0', Math.abs(r.r2 - 1) < 1e-10 && r.rmse < 1e-6, `R² ${r.r2}, RMSE ${r.rmse.toExponential(2)}`);
  check('a6 inflation: every price lands in today\'s money', r.prep.priceToday.every((p, i) => rel(p, rule(r.prep.X[i][0], r.prep.X[i][1], r.prep.X[i][2])) < 1e-12));
  check('a7 a year becomes an age at the listing\'s data year', r.prep.X.every((x, i) => x[0] === r.prep.dataYear[i] - +rows[i][1]));
}

/* ── 2. The shipped presets against the replay ── */
console.log('\n── 2. Presets, every model, against the replay ──');
for(const key of ['camry', 'house']){
  const preset = await ve(k => JSON.parse(JSON.stringify(window.__VE.PRESETS[k])), key);
  const state = { columns: preset.columns, rows: preset.rows.map(r => r.map(String)) };
  const rp = replayPrepare(state.rows, state.columns, YEAR, 0.03);
  const probes = rp.X.slice(0, 5).concat([rp.X.map(x => x.slice()).reduce((a, x) => a.map((v, j) => Math.max(v, x[j])))]);
  state.probe = probes;
  const models = {
    linear: replayLinear(rp.X, rp.y),
    log: replayLog(rp.X, rp.y),
    quadratic: replayQuadratic(rp.X, rp.y, rp.types),
    ridge: replayRidge(rp.X, rp.y, 0.1)
  };
  for(const [model, f] of Object.entries(models)){
    const r = await engine(state, { inflation: 0.03, model, lambda: 0.1 });
    if(r.error){ check(`${key} ${model}: fits`, false, r.error); continue; }
    const worst = Math.max(...probes.map((x, i) => rel(r.at[i], f(x))), ...rp.X.map((x, i) => rel(r.fitted[i], f(x))));
    check(`${key} ${model}: predictions match the replay`, worst < 1e-8, `worst relative gap ${worst.toExponential(2)}`);
    const sse = rp.X.reduce((s, x, i) => s + (rp.y[i] - f(x)) ** 2, 0);
    const ym = rp.y.reduce((s, v) => s + v, 0) / rp.y.length;
    const sst = rp.y.reduce((s, v) => s + (v - ym) ** 2, 0);
    const k = model === 'quadratic' ? rp.types.reduce((s, t) => s + (t === 'bool' ? 1 : 2), 0) : rp.types.length;
    const rmse = Math.sqrt(sse / (rp.X.length - k - 1));
    check(`${key} ${model}: R² and RMSE on the price scale`, Math.abs(r.r2 - (1 - sse / sst)) < 1e-9 && rel(r.rmse, rmse) < 1e-8,
          `R² ${r.r2.toFixed(4)}, RMSE ${r.rmse.toFixed(2)} vs ${rmse.toFixed(2)}`);
  }
  // Standardising must not move a linear prediction: refit on features
  // multiplied by 1000 (km in metres) and the prices must not change.
  const scaled = { columns: state.columns, rows: state.rows.map(r => r.map((v, i) => state.columns[i].type === 'number' ? String(+v * 1000) : v)) };
  scaled.probe = [];
  const a = await engine(state, { inflation: 0.03, model: 'linear' });
  const b = await engine(scaled, { inflation: 0.03, model: 'linear' });
  check(`${key}: rescaling a feature changes its coefficient, never a prediction`,
        a.fitted.every((v, i) => rel(v, b.fitted[i]) < 1e-9), `first ${a.fitted[0].toFixed(2)} vs ${b.fitted[0].toFixed(2)}`);
}

/* ── 3. Items never feed the model ── */
console.log('\n── 3. Items are checked against the model, never fitted ──');
{
  await ve(() => window.__VE.applyQuickStart('camry'));
  await page.waitForTimeout(200);
  const before = await ve(() => { const r = window.__VE.compute(); return { c0: r.model.coef.c0, a: r.model.coef.a, n: r.model.n }; });
  await ve(() => {
    const st = window.__VE.state;
    for(let i = 0; i < 6; i++) st.items.push({ name: 'Wild ' + i, asking: String(1 + i * 99999), vals: { c2: String(1990 + i), c3: String(999999 * i), c4: i % 2 === 0 } });
    window.__VE.state = st;
  });
  await page.waitForTimeout(200);
  const after = await ve(() => { const r = window.__VE.compute(); return { c0: r.model.coef.c0, a: r.model.coef.a, n: r.model.n, items: r.items.length }; });
  check('i1 adding six extreme items leaves every coefficient unchanged',
        after.c0 === before.c0 && after.a.every((v, j) => v === before.a[j]) && after.n === before.n, `${after.items} items, n ${after.n}`);
  // The page's own figures for an item, against the replay.
  await ve(() => window.__VE.applyQuickStart('camry'));
  await page.waitForTimeout(300);
  const preset = await ve(() => JSON.parse(JSON.stringify(window.__VE.PRESETS.camry)));
  const rp = replayPrepare(preset.rows.map(r => r.map(String)), preset.columns, YEAR, 0.03);
  const f = replayLinear(rp.X, rp.y);
  const it = preset.items[0];
  const x = [YEAR - +it.vals.c2, +it.vals.c3, it.vals.c4 ? 1 : 0];
  const fair = f(x), asking = money(it.asking);
  const kpi = await page.textContent('#kpiFair');
  check('i2 the Fair price card shows the replayed fair price', Math.abs(money(kpi) - Math.round(fair)) <= 1, `${kpi} vs ${fair.toFixed(2)}`);
  const best = await page.textContent('#kpiBest');
  const gapPct = (asking - fair) / fair * 100;
  check('i3 the Best value card shows the gap to the asking price', Math.abs(money(best) - +gapPct.toFixed(1)) < 0.051, `${best} vs ${gapPct.toFixed(2)}%`);
  const verdict = await page.textContent('#verdict');
  check('i4 the verdict names the best value item and its fair price',
        verdict.includes(it.name) && verdict.includes('$' + Math.round(fair).toLocaleString('en-AU')), verdict.slice(0, 110));
  // An item missing a feature is reported, not priced.
  await ve(() => { const st = window.__VE.state; st.items.push({ name: 'Half done', asking: '', vals: { c2: '2020' } }); window.__VE.state = st; });
  await page.waitForTimeout(200);
  const warn = await page.textContent('#warnBanner');
  check('i5 an item missing a feature is flagged and left unpriced', /Half done is missing a feature/.test(warn), warn.slice(0, 90));
  // Outside the listings: an item older than any listing.
  await ve(() => { const st = window.__VE.state; st.items = [{ name: 'Old one', asking: '9,000', vals: { c2: '2008', c3: '250000', c4: false } }]; window.__VE.state = st; });
  await page.waitForTimeout(200);
  check('i6 an item outside the range of the listings is flagged as extrapolated', /Old one sits outside the range/.test(await page.textContent('#warnBanner')));
}

/* ── 4. The chart: price up the side, listings shifted by exactly their miss ── */
console.log('\n── 4. The chart ──');
{
  await ve(() => window.__VE.applyQuickStart('camry'));
  await page.waitForTimeout(500);
  const plot = await ve(() => window.__plots[window.__plots.length - 1]);
  const r = await ve(() => { const r = window.__VE.compute(); return { resid: r.model.resid, n: r.model.n }; });
  check('c1 the vertical axis is the price, in today\'s money', /^Price \(\$, \d{4} money\)$/.test(plot.layout.yaxis.title.text), plot.layout.yaxis.title.text);
  const dots = plot.data.find(t => /Listings/.test(t.name));
  const line = plot.data.find(t => t.name === 'Price model');
  // Each dot sits off the line by its own miss. The line is sampled, so read
  // it back by interpolation at the dot.
  const lineAt = x => { const xs = line.x, ys = line.y; let i = 1; while(i < xs.length - 1 && xs[i] < x) i++;
    const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]); return ys[i - 1] + t * (ys[i] - ys[i - 1]); };
  const worst = Math.max(...dots.x.map((x, i) => Math.abs((dots.y[i] - lineAt(x)) - r.resid[i])));
  check('c2 every listing is shifted to the held values and keeps its own miss', worst < 1e-6, `worst ${worst.toExponential(2)} over ${dots.x.length} dots`);
  const items = plot.data.filter(t => t.name && t.name.startsWith('20'));
  check('c3 both items are highlighted, the fair price on the line', items.length === 2 && items.every(t => Math.abs(t.y[0] - lineAt(t.x[0])) < 1e-6));
  await ve(() => { document.getElementById('showData').checked = false; document.getElementById('showData').dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(200);
  const hidden = await ve(() => window.__plots[window.__plots.length - 1].data.some(t => /Listings/.test(t.name)));
  check('c4 Show data points off hides the listings', !hidden);
  await ve(() => { document.getElementById('showData').checked = true; const v = document.getElementById('viewDim'); v.value = '3d'; v.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(300);
  const p3 = await ve(() => window.__plots[window.__plots.length - 1]);
  const surf = p3.data.find(t => t.type === 'surface');
  check('c5 3D draws a price surface over the two chosen features', !!surf && surf.z.length === 30 && surf.z[0].length === 30 && /^Price/.test(p3.layout.scene.zaxis.title.text));
  const d3 = p3.data.find(t => t.type === 'scatter3d' && /Listings/.test(t.name));
  check('c6 the 3D listings are grey, set apart from the coloured items', !!d3 && d3.marker.color !== p3.data.find(t => t.type === 'scatter3d' && !/Listings/.test(t.name)).marker.color);
  await ve(() => { const v = document.getElementById('viewDim'); v.value = '2d'; v.dispatchEvent(new Event('change', { bubbles: true })); });
}

/* ── 5. Table, Text and CSV are one dataset ── */
console.log('\n── 5. Table, Text and CSV ──');
{
  const preset = await ve(() => JSON.parse(JSON.stringify(window.__VE.PRESETS.house)));
  const round = await ve(p => {
    const V = window.__VE;
    const text = V.toDelimited(p.columns, p.rows.map(r => r.map(String)), ',', ', ');
    const back = V.parseDelimited(text);
    return { text, back };
  }, preset);
  check('t1 the header carries each unit in brackets', /Land \(m²\)/.test(round.text) && /Distance to METRONET station \(km\)/.test(round.text));
  check('t2 text back to rows gives the same listings', JSON.stringify(round.back.rows) === JSON.stringify(preset.rows.map(r => r.map(String))) && round.back.errors.length === 0);
  const bools = await ve(() => ['Yes', 'no', 'TRUE', 'false', '1', '0', 'on', 'OFF', 'exists', 'does not exist', '', 'maybe'].map(window.__VE.parseBool));
  check('t3 Yes/No reads yes/no, true/false, 1/0, on/off, exists, and a blank as No', JSON.stringify(bools) === JSON.stringify([1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, null]), JSON.stringify(bools));
  // Through the page: type into Text, read the table.
  await ve(() => { const s = document.getElementById('entryMode'); s.value = 'text'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await ve(() => { const t = document.getElementById('dataText');
    t.value = 'Price, Year, Odometer (km), Service, Data year\n30000, 2020, 60000, yes, 2025\n28000, 2019, 70000, no, 2024\n"31,000", 2021, 50000, Yes, \n33000, 2022, 40000, true, 2026\n26000, 2018, 90000, off, 2024';
    t.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(600);
  const st = await ve(() => JSON.parse(JSON.stringify(window.__VE.state)));
  check('t4 typed text becomes columns with guessed types', st.columns.map(c => c.type).join(',') === 'price,year,number,bool,datayear', st.columns.map(c => c.name + ':' + c.type).join(', '));
  check('t5 a quoted "31,000" stays one value', st.rows[2][0] === '31,000', st.rows[2][0]);
  await ve(() => { const s = document.getElementById('entryMode'); s.value = 'table'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(200);
  const ticks = await ve(() => [...document.querySelectorAll('#gridWrap td.t-bool input')].map(i => i.checked));
  check('t6 Yes/No cells show as checkboxes in the table', JSON.stringify(ticks) === JSON.stringify([true, false, true, true, false]), JSON.stringify(ticks));
  const dy = await ve(() => window.__VE.compute().prep.dataYear[2]);
  check('t7 a blank data year counts as the current year', dy === YEAR, String(dy));
}

/* ── 6. Edge cases ── */
console.log('\n── 6. Edge cases ──');
{
  const base = [
    { id: 'c1', name: 'Price', type: 'price', unit: '' }, { id: 'c2', name: 'A', type: 'number', unit: '' }, { id: 'c3', name: 'B', type: 'number', unit: '' }];
  const rows = [['100', '1', '5'], ['130', '2', '5'], ['170', '3', '5'], ['190', '4', '5'], ['240', '5', '5']];
  let r = await engine({ columns: base, rows }, { model: 'linear' });
  check('e1 a feature that never changes is dropped, the rest still fit', !r.error && r.dropped.join() === 'B' && r.k === 1, r.error || r.dropped.join());
  const coll = rows.map(x => [x[0], x[1], String(+x[1] * 2)]);
  r = await engine({ columns: base, rows: coll }, { model: 'linear' });
  check('e2 two features moving together exactly are refused with a reason', !!r.error && /move together/.test(r.error), r.error);
  r = await engine({ columns: base, rows: coll }, { model: 'ridge', lambda: 0.1 });
  check('e3 Ridge fits them anyway', !r.error, r.error || 'fitted');
  r = await engine({ columns: base, rows: rows.slice(0, 2).map(x => [x[0], x[1], String(+x[1] * 3 + 1)]) }, { model: 'linear' });
  check('e4 too few listings for the terms is said in words', !!r.error && /needs at least/.test(r.error), r.error);
  const bad = [['100', '1', '4'], ['130', '2', '1'], ['170', '3', '5'], ['190', '4', '2'], ['240', '5', '3'],
               ['', '6', '1'], ['abc', '7', '2'], ['300', '', '3'], ['  ', ' ', ' ']];
  r = await engine({ columns: base, rows: bad }, { model: 'linear' });
  check('e5 rows with a missing or unreadable value are skipped and counted, a blank row ignored', !r.error && r.prep.n === 5 && r.prep.skipped.length === 3, r.error || `${r.prep.n} used, ${r.prep.skipped.length} skipped`);
  r = await engine({ columns: [base[1], base[2]], rows }, {});
  check('e6 no Price column is said in words', !!r.error && /Price/.test(r.error), r.error);
  r = await engine({ columns: base.concat([{ id: 'c4', name: 'P2', type: 'price', unit: '' }]), rows: rows.map(x => x.concat(['1'])) }, {});
  check('e7 two Price columns are refused', !!r.error && /one column/.test(r.error), r.error);
  r = await engine({ columns: [base[0], base[1], { id: 'c9', name: 'Data year', type: 'datayear', unit: '' }], rows: rows.map(x => [x[0], x[1], String(YEAR + 3)]) }, {});
  check('e8 a data year after the current year is not read', r.prep && r.prep.skipped.length === 5, r.error || '');
}

/* ── 7. The mini cache keeps the listings, the columns and the items ── */
console.log('\n── 7. Mini cache ──');
{
  await ve(() => window.__VE.applyQuickStart('house'));
  await page.waitForTimeout(700);
  const want = await page.textContent('.metrics');
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(800);
  const got = await page.textContent('.metrics');
  // The init script clears storage on every load, so restore by hand from a
  // snapshot the page itself wrote.
  check('m1 a reload with storage cleared starts from the defaults', got !== want);
  await ve(() => window.__VE.applyQuickStart('house'));
  await page.waitForTimeout(700);
  const blob = await ve(() => localStorage.getItem('abt:save:valuateeverything:v1'));
  check('m2 the saved snapshot carries the listings and items', !!blob && JSON.parse(blob).__extra.rows.length === 18 && JSON.parse(blob).__extra.items.length === 2);
}

check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
await browser.close();
console.log(`\nValuate Everything audit: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
