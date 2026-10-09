/* ═══════════════════════════════════════════════════════════════════════════
   Valuate Everything — what a secondhand item should cost.

   Two inputs that never mix:
     1. MARKET DATA: listings the reader has seen, one row each, with a price
        and the features that drive it. The model is fitted to these only.
     2. ITEMS TO BUY: what the reader is weighing up. Each is priced by the
        model and its asking price is judged against that. Never fitted.

   The maths, step by step (compute() and fit() below):

   1. Today's money. A listing seen in data year Y at price P is restated in the
      current year C at the inflation rate i:   P* = P · (1 + i)^(C − Y).
      A blank data year is the current year. With no Data year column at all,
      every listing is taken as seen this calendar year and C is that year.
   2. Features. A Number is used as it is. A Year becomes an age at the time
      the listing was seen (Y − year); for an item to buy, at the current year
      (C − year). A Yes/No is 1 or 0, a blank one is No.
   3. Standardise. Each feature x_j becomes z_j = (x_j − μ_j) / σ_j, with μ and
      σ (population) taken over the listings only, so km cannot swamp
      bedrooms. A feature that never varies is dropped. Quadratic adds z_j² for
      every Number and Year, itself standardised again.
   4. Fit. With design S = [1, s_1 … s_k] and target y (P*, or ln P* for
      Log-linear), solve (SᵀS + nλD) β = Sᵀy by Gaussian elimination with
      partial pivoting. D = diag(0, 1, …, 1) leaves the intercept free; λ is
      zero except for Ridge.
   5. Back to the reader's units. The fitted β are unwound into
      P = α + Σ α_j x_j (+ Σ α_jj x_j² for Quadratic), in today's money, or in
      ln P for Log-linear, where e^α_j − 1 is the change per unit.
   6. Fit quality on the price scale: R² = 1 − SSE / SST, and the typical error
      RMSE = √(SSE / (n − k − 1)), where k counts the terms fitted.
   7. Items. Fair price F = model(x). Range F ± RMSE (Log-linear: F · e^{±s},
      s the same figure on ln P). Gap = asking − F, and Gap % = gap / F.

   The chart holds every feature not on an axis at one value (the data average
   or an item) and shifts each listing to it before plotting, a partial
   residual: P*_i − model(x_i) + model(x_i with the others held), or the same
   as a ratio for Log-linear. A dot then sits off the line by exactly its own
   miss, so the cloud compares like for like with the line.
   ═══════════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

// Watermark logo (logos/logo.svg), used in Plotly chart export watermarks
const WM_LOGO_SRC = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDY4MCA2ODAiIHJvbGU9ImltZyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8dGl0bGU+QXJjaGVkIEEgTG9nbzwvdGl0bGU+CiAgPGRlc2M+QSBzbGVlayB3aGl0ZSBsZXR0ZXIgQSB3aG9zZSBsZWdzIGZvbGxvdyB0aGUgY2lyY2xlIGN1cnZhdHVyZSwgc3Bhbm5pbmcgODAlIG9mIHRoZSBjaXJjbGUgaGVpZ2h0PC9kZXNjPgoKICA8Y2lyY2xlIGN4PSIzNDAiIGN5PSIzNDAiIHI9IjMwMCIgZmlsbD0iIzAwNTJjYyIvPgoKICA8IS0tIExlZnQgbGVnOiAxMTPCsCB0byAyNDXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyNDIsNTcwIEEgMjUwLDI1MCAwIDAgMSAyMzQsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFRvcCBhcmNoOiAyNDXCsCB0byAyOTXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyMzQsMTEzIEEgMjUwLDI1MCAwIDAgMSA0NDYsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFJpZ2h0IGxlZzogMjk1wrAgdG8gNjfCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSA0NDYsMTEzIEEgMjUwLDI1MCAwIDAgMSA0MzgsNTcwIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIENyb3NzYmFyIC0tPgogIDxsaW5lIHgxPSIxMTMiIHkxPSIzNTQiIHgyPSI1NjciIHkyPSIzNTQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNDIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K';
function wmPlotlyImage(){
  return { source: WM_LOGO_SRC, xref:'paper', yref:'paper', x:1, y:0.07, xanchor:'right', yanchor:'bottom',
    sizex:0.035, sizey:0.05, sizing:'contain', opacity:0.22, layer:'above' };
}

const $ = id => document.getElementById(id);
const cssVar = n => getComputedStyle(document.body).getPropertyValue(n).trim();
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const THIS_YEAR = new Date().getFullYear();
const BIG = 1e12;

/* ───────────────────────── Formatters ───────────────────────── */
const fmt = {
  money(v, sym, compact){
    if(v == null || !isFinite(v)) return '—';
    const n = Number(v), abs = Math.abs(n), sign = n < 0 ? '−' : '';
    if(compact && abs >= 1e9) return sign + sym + (abs/1e9).toFixed(2) + 'b';
    if(compact && abs >= 1e6) return sign + sym + (abs/1e6).toFixed(2) + 'm';
    return sign + sym + abs.toLocaleString('en-AU', { maximumFractionDigits: 0 });
  },
  signedMoney(v, sym){ return (v > 0 ? '+' : '') + fmt.money(v, sym); },
  pct(v, d = 1){ return v == null || !isFinite(v) ? '—' : (v < 0 ? '−' : (v > 0 ? '+' : '')) + Math.abs(v*100).toFixed(d) + '%'; },
  num(v, d = 2){
    if(v == null || !isFinite(v)) return '—';
    const a = Math.abs(v);
    const dp = a === 0 ? 0 : a >= 1000 ? 0 : a >= 100 ? 1 : a >= 1 ? d : Math.min(6, Math.max(d, 1 - Math.floor(Math.log10(a)) + 2));
    return (v < 0 ? '−' : '') + a.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: dp });
  },
  plain(v){ return v == null || !isFinite(v) ? '' : String(+(+v).toPrecision(10)); }
};

/* ───────────────────────── Parsing ───────────────────────── */
const BOOL_TRUE  = /^(yes|y|true|t|1|on|exists?|present|with|ada|ya)$/i;
const BOOL_FALSE = /^(no|n|false|f|0|off|none|absent|without|not exists?|does not exist|tidak|-)$/i;
// A blank Yes/No is a No: a checkbox nobody ticked.
function parseBool(v){
  if(v === true) return 1;
  if(v === false || v == null) return 0;
  const s = String(v).trim();
  if(s === '') return 0;
  if(BOOL_TRUE.test(s)) return 1;
  if(BOOL_FALSE.test(s)) return 0;
  return null;
}
function parseNum(v){
  if(typeof v === 'number') return isFinite(v) ? v : null;
  const s = String(v == null ? '' : v).trim().replace(/−/g, '-').replace(/^Rp/i, '').replace(/[,\s$€£¥₹₩₱฿₫]/g, '');
  if(s === '' || s === '-' || s === '.') return null;
  const n = Number(s);
  return isFinite(n) ? n : null;
}

/* ───────────────────────── Engine ───────────────────────── */
const FEATURE_TYPES = ['number', 'year', 'bool'];

/* The market data as the model sees it: one feature vector and one price in
   today's money per complete listing. Rows that cannot be read are skipped
   and counted, never guessed at. */
function prepare(columns, rows, o){
  const prices = columns.filter(c => c.type === 'price');
  const dys = columns.filter(c => c.type === 'datayear');
  if(prices.length !== 1) return { error: prices.length ? 'Only one column can be the Price.' : 'Mark one column as the Price.' };
  if(dys.length > 1) return { error: 'Only one column can be the Data year.' };
  const pi = columns.indexOf(prices[0]);
  const di = dys.length ? columns.indexOf(dys[0]) : -1;
  const feats = columns.map((c, i) => ({ c, i })).filter(f => FEATURE_TYPES.includes(f.c.type));
  const out = {
    features: feats.map(f => ({ id: f.c.id, name: f.c.name, type: f.c.type, unit: f.c.unit || '' })),
    X: [], price: [], priceToday: [], dataYear: [], row: [], skipped: [], negAge: 0
  };
  rows.forEach((r, ri) => {
    if(r.every(v => String(v == null ? '' : v).trim() === '')) return;
    const p = parseNum(r[pi]);
    if(p === null || p <= 0){ out.skipped.push({ row: ri + 1, why: prices[0].name || 'Price' }); return; }
    let dy = o.year;
    if(di >= 0 && String(r[di] == null ? '' : r[di]).trim() !== ''){
      const d = parseNum(r[di]);
      if(d === null || d < 1900 || d > o.year){ out.skipped.push({ row: ri + 1, why: dys[0].name || 'Data year' }); return; }
      dy = Math.round(d);
    }
    const x = [];
    for(const f of feats){
      const raw = r[f.i];
      let v;
      if(f.c.type === 'bool') v = parseBool(raw);
      else {
        const n = parseNum(raw);
        v = n === null ? null : (f.c.type === 'year' ? dy - n : n);
        if(v !== null && f.c.type === 'year' && v < 0) out.negAge++;
      }
      if(v === null){ out.skipped.push({ row: ri + 1, why: f.c.name || 'a feature' }); return; }
      x.push(v);
    }
    out.X.push(x);
    out.price.push(p);
    out.dataYear.push(dy);
    out.priceToday.push(p * Math.pow(1 + o.inflation, o.year - dy));
    out.row.push(ri + 1);
  });
  return out;
}

// An item to buy, as a feature vector in the model's order. Always this year.
function itemVector(item, features, year){
  return features.map(f => {
    const v = item.vals ? item.vals[f.id] : undefined;
    if(f.type === 'bool') return v ? 1 : 0;
    const n = parseNum(v);
    if(n === null) return null;
    return f.type === 'year' ? year - n : n;
  });
}

// Gaussian elimination with partial pivoting. Null when the system is singular.
function solve(A, b){
  const n = b.length;
  const M = A.map((row, i) => row.concat([b[i]]));
  let scale = 0;
  for(let i = 0; i < n; i++) scale = Math.max(scale, Math.abs(M[i][i]));
  const tol = 1e-9 * (scale || 1);
  for(let c = 0; c < n; c++){
    let p = c;
    for(let r = c + 1; r < n; r++) if(Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if(Math.abs(M[p][c]) < tol) return null;
    if(p !== c){ const t = M[p]; M[p] = M[c]; M[c] = t; }
    for(let r = c + 1; r < n; r++){
      const f = M[r][c] / M[c][c];
      if(f === 0) continue;
      for(let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for(let r = n - 1; r >= 0; r--){
    let s = M[r][n];
    for(let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return x;
}

const mean = a => a.reduce((s, v) => s + v, 0) / (a.length || 1);

function fit(prep, opt){
  const model = opt.model;
  const lambda = model === 'ridge' ? Math.max(0, opt.lambda || 0) : 0;
  const F = prep.features, X = prep.X, n = X.length;
  const yP = prep.priceToday;

  // 3. Standardise each feature over the listings.
  const mu = [], sd = [], keep = [], dropped = [];
  F.forEach((f, j) => {
    const col = X.map(r => r[j]);
    const m = mean(col);
    const s = Math.sqrt(mean(col.map(v => (v - m) * (v - m))));
    mu.push(m); sd.push(s);
    if(s > 1e-12 * Math.max(1, Math.abs(m))) keep.push(j); else dropped.push(f.name);
  });
  let terms = keep.map(j => ({ j, pow: 1 }));
  if(model === 'quadratic') keep.forEach(j => { if(F[j].type !== 'bool') terms.push({ j, pow: 2 }); });
  const rawTerms = x => terms.map(t => { const z = (x[t.j] - mu[t.j]) / sd[t.j]; return t.pow === 1 ? z : z * z; });
  let T = X.map(rawTerms);
  // A square that never varies (a feature with two values, evenly split) adds nothing.
  const tStats = terms.map((t, k) => {
    const col = T.map(r => r[k]); const m = mean(col);
    return { m, s: Math.sqrt(mean(col.map(v => (v - m) * (v - m)))) };
  });
  const live = terms.map((t, k) => tStats[k].s > 1e-9);
  terms = terms.filter((t, k) => live[k]);
  const tm = tStats.filter((s, k) => live[k]).map(s => s.m);
  const ts = tStats.filter((s, k) => live[k]).map(s => s.s);
  T = X.map(rawTerms);
  const S = T.map(r => r.map((v, k) => (v - tm[k]) / ts[k]));
  const k = terms.length;

  if(!keep.length) return { error: 'Every feature has the same value in every listing, so there is nothing to fit.' };
  if(lambda === 0 && n < k + 2) return { error: `This model fits ${k + 1} terms, so it needs at least ${k + 2} complete listings. There are ${n}.` };
  if(n < 2) return { error: 'Enter at least two complete listings.' };

  const y = model === 'log' ? yP.map(Math.log) : yP.slice();

  // 4. Normal equations.
  const dim = k + 1;
  const A = Array.from({ length: dim }, () => new Array(dim).fill(0));
  const b = new Array(dim).fill(0);
  for(let i = 0; i < n; i++){
    const row = [1].concat(S[i]);
    for(let a = 0; a < dim; a++){
      b[a] += row[a] * y[i];
      for(let c = a; c < dim; c++) A[a][c] += row[a] * row[c];
    }
  }
  for(let a = 0; a < dim; a++) for(let c = 0; c < a; c++) A[a][c] = A[c][a];
  for(let a = 1; a < dim; a++) A[a][a] += n * lambda;
  const beta = solve(A, b);
  if(!beta) return { error: 'Two or more features move together exactly, so their effects cannot be told apart. Remove one, or use Ridge.' };

  const link = s => beta[0] + s.reduce((acc, v, q) => acc + beta[q + 1] * v, 0);
  const linear = x => link(rawTerms(x).map((v, q) => (v - tm[q]) / ts[q]));
  const predict = x => model === 'log' ? Math.exp(linear(x)) : linear(x);

  // 6. Fit quality, on the price scale.
  const fitted = X.map(predict);
  const resid = yP.map((p, i) => p - fitted[i]);
  const sse = resid.reduce((s, r) => s + r * r, 0);
  const pm = mean(yP);
  const sst = yP.reduce((s, p) => s + (p - pm) * (p - pm), 0);
  const dof = n - k - 1;
  const rmse = Math.sqrt(sse / (dof > 0 ? dof : n));
  let rmseLog = null;
  if(model === 'log'){
    const sseL = X.reduce((s, x, i) => { const r = y[i] - linear(x); return s + r * r; }, 0);
    rmseLog = Math.sqrt(sseL / (dof > 0 ? dof : n));
  }

  // 5. Unwind into the reader's units: c0 + Σ a_j x_j + Σ q_j x_j².
  const a = new Array(F.length).fill(0), q = new Array(F.length).fill(0);
  let c0 = beta[0];
  terms.forEach((t, kk) => {
    const B = beta[kk + 1] / ts[kk], m = mu[t.j], s = sd[t.j];
    c0 -= B * tm[kk];
    if(t.pow === 1){ a[t.j] += B / s; c0 -= B * m / s; }
    else { q[t.j] += B / (s * s); a[t.j] -= 2 * B * m / (s * s); c0 += B * m * m / (s * s); }
  });

  const min = F.map((f, j) => Math.min.apply(null, X.map(r => r[j])));
  const max = F.map((f, j) => Math.max.apply(null, X.map(r => r[j])));
  return {
    ok: true, model, lambda, n, k, terms, beta, mu, sd, tm, ts, dropped,
    predict, linear, fitted, resid, sse, sst,
    r2: sst > 0 ? 1 - sse / sst : null, rmse, rmseLog, dof,
    coef: { c0, a, q }, min, max
  };
}

/* Move a price from one point of the model to another, keeping its miss:
   an amount for an additive model, a ratio for Log-linear. */
function shiftPrice(model, price, from, to){
  return model.model === 'log' ? price * to / from : price - from + to;
}

function evaluateItem(item, k, prep, model, o){
  const vec = itemVector(item, prep.features, o.year);
  const name = (item.name || '').trim() || ('Item ' + (k + 1));
  const missing = prep.features.filter((f, j) => vec[j] === null).map(f => f.name);
  if(missing.length) return { k, name, incomplete: true, missing };
  const fair = model.predict(vec);
  const range = model.model === 'log'
    ? [fair * Math.exp(-model.rmseLog), fair * Math.exp(model.rmseLog)]
    : [fair - model.rmse, fair + model.rmse];
  const ask = parseNum(item.asking);
  const asking = ask !== null && ask > 0 ? ask : null;
  const gap = asking === null ? null : asking - fair;
  const outside = prep.features.filter((f, j) =>
    !model.dropped.includes(f.name) && (vec[j] < model.min[j] - 1e-9 || vec[j] > model.max[j] + 1e-9)).map(f => f.name);
  const negAge = prep.features.some((f, j) => f.type === 'year' && vec[j] < 0);
  return { k, name, vec, fair, range, asking, gap, gapPct: gap === null || !(fair > 0) ? null : gap / fair, outside, negAge, bad: !(fair > 0) };
}

/* ───────────────────────── Text and CSV ───────────────────────── */
function detectDelimiter(line){
  const counts = { '\t': (line.match(/\t/g) || []).length, ',': (line.match(/,/g) || []).length, ';': (line.match(/;/g) || []).length };
  if(counts['\t']) return '\t';
  return counts[';'] > counts[','] ? ';' : ',';
}
function splitLine(line, delim){
  const out = []; let cur = '', inQ = false;
  for(let i = 0; i < line.length; i++){
    const ch = line[i];
    if(ch === '"'){ if(inQ && line[i + 1] === '"'){ cur += '"'; i++; } else inQ = !inQ; }
    else if(ch === delim && !inQ){ out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}
// "Odometer (km)" is the column Odometer in km.
function splitHeader(h){
  const m = String(h).match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  return m && m[1].trim() ? { name: m[1].trim(), unit: m[2].trim() } : { name: String(h).trim(), unit: '' };
}
function parseDelimited(text){
  const lines = String(text || '').split(/\r?\n/).map((l, i) => ({ l, n: i + 1 })).filter(x => x.l.trim() && !/^\s*#/.test(x.l));
  if(!lines.length) return { columns: [], rows: [], errors: ['No header line yet.'] };
  const delim = detectDelimiter(lines[0].l);
  const header = splitLine(lines[0].l, delim).map(splitHeader);
  const errors = [];
  if(header.some(h => !h.name)) errors.push(`Line ${lines[0].n}: every column needs a name.`);
  const rows = [];
  lines.slice(1).forEach(x => {
    const cells = splitLine(x.l, delim);
    if(cells.length > header.length){ errors.push(`Line ${x.n}: ${cells.length} values for ${header.length} columns.`); return; }
    while(cells.length < header.length) cells.push('');
    rows.push(cells);
  });
  return { columns: header, rows, errors };
}
const csvCell = (v, delim) => {
  const s = String(v == null ? '' : v);
  return (s.includes(delim) || /["\n]/.test(s)) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
function headerOf(c){ return c.unit ? `${c.name} (${c.unit})` : c.name; }
function cellOut(c, v){
  if(c.type === 'bool'){ const b = parseBool(v); return b === null ? String(v == null ? '' : v) : (b ? 'Yes' : 'No'); }
  return String(v == null ? '' : v);
}
function toDelimited(columns, rows, delim, sep){
  const join = cells => cells.map(v => csvCell(v, delim)).join(sep);
  return [join(columns.map(headerOf))].concat(rows.map(r => join(columns.map((c, i) => cellOut(c, r[i]))))).join('\n');
}
// Spreadsheets open plain ASCII without guessing at an encoding.
const cleanCSV = s => String(s).replace(/−/g, '-').replace(/²/g, '2').replace(/³/g, '3').replace(/×/g, 'x')
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E\n\r\t]/g, '');
function downloadText(name, text){
  const blob = new Blob([cleanCSV(text)], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* ───────────────────────── Column types ─────────────────────────
   Price is always there, exactly once, first. Data year is there at most
   once, last; the reader can delete it (every listing is then seen this
   year) and add it back. Neither is a type the reader picks: only the
   columns in between are, from PICK_TYPES. */
const TYPES = [
  { v: 'price',    label: 'Price' },
  { v: 'number',   label: 'Number' },
  { v: 'year',     label: 'Year' },
  { v: 'bool',     label: 'Yes/No' },
  { v: 'datayear', label: 'Data year' },
  { v: 'ignore',   label: 'Ignore' }
];
const FIXED_TYPES = ['price', 'datayear'];
const PICK_TYPES = TYPES.filter(t => !FIXED_TYPES.includes(t.v));

/* Put a column set (and its rows) in the one shape the editors assume. A
   second Price or Data year becomes a Number; a missing Price is added
   blank. A missing Data year stays missing. */
function ensureFixed(columns, rows){
  const cols = columns.map(c => Object.assign({}, c));
  FIXED_TYPES.forEach(t => {
    let seen = false;
    cols.forEach(c => { if(c.type === t){ if(seen) c.type = 'number'; seen = true; } });
  });
  let n = 0;
  cols.forEach(c => { const m = /^c(\d+)$/.exec(c.id); if(m) n = Math.max(n, +m[1]); });
  const src = cols.map((c, i) => i);
  if(!cols.some(c => c.type === 'price')){ cols.push({ id: 'c' + (++n), name: 'Price', type: 'price', unit: '' }); src.push(-1); }
  const rank = c => c.type === 'price' ? 0 : c.type === 'datayear' ? 2 : 1;
  const order = cols.map((c, i) => i).sort((a, b) => rank(cols[a]) - rank(cols[b]) || a - b);
  return {
    columns: order.map(i => cols[i]),
    rows: rows.map(r => order.map(i => src[i] < 0 ? '' : String(r[src[i]] == null ? '' : r[src[i]])))
  };
}
function guessType(name, values, taken){
  const n = String(name || '').toLowerCase();
  const vals = values.filter(v => String(v == null ? '' : v).trim() !== '');
  if(!taken.price && /price|cost|sold for|value|amount|harga/.test(n)) return 'price';
  if(!taken.datayear && /data ?year|sale ?year|sold ?year|year ?sold|listing ?year|year ?seen|seen/.test(n)) return 'datayear';
  if(vals.length && vals.every(v => parseBool(v) !== null) && vals.some(v => !/^[01]$/.test(String(v).trim()))) return 'bool';
  if(/\byear\b|model ?year|\bbuilt\b|^yr$/.test(n)) return 'year';
  if(vals.length && vals.every(v => { const x = parseNum(v); return x !== null && Number.isInteger(x) && x >= 1900 && x <= THIS_YEAR + 1; })) return 'year';
  if(vals.length && vals.some(v => parseNum(v) === null)) return 'ignore';
  return 'number';
}

/* ───────────────────────── Quick Start ─────────────────────────
   Real market data, gathered on 9 October 2026. Every row is one real listing
   or sale; _audit/quickstart-sources.md links each one to its page.
   Camry: Toyota dealer and Cars24 asking prices, excluding government charges.
   House: REIWA sold prices for freehold houses in Morley, WA, 2023 to 2026.
   Camera: MPB UK prices for used Sony A7 II, III and IV bodies, no lens.
   Hotel: one night in Perth CBD, Wed 11 Nov 2026, two adults, incl. taxes. */
const PRESETS = {
  camry: {
    fields: { currency: '$', itemWhat: 'Toyota Camry Hybrid' },
    columns: [
      { id: 'c1', name: 'Price', type: 'price', unit: '' },
      { id: 'c2', name: 'Year', type: 'year', unit: '' },
      { id: 'c3', name: 'Odometer', type: 'number', unit: 'km' },
      { id: 'c4', name: 'Above Ascent grade', type: 'bool', unit: '' },
      { id: 'c5', name: 'Data year', type: 'datayear', unit: '' }
    ],
    rows: [[35980,2021,82984,'Yes',2026],[31777,2020,57592,'Yes',2026],[34990,2024,40013,'No',2026],[34490,2024,44679,'No',2026],
           [35890,2021,71063,'Yes',2026],[34255,2022,50419,'Yes',2026],[29990,2021,84890,'No',2026],[24990,2019,103293,'No',2026],
           [35990,2022,16306,'No',2026],[28990,2019,85438,'No',2026],[31990,2020,57001,'No',2026],[30990,2019,81095,'Yes',2026],
           [34490,2024,53711,'No',2026],[33990,2024,57791,'No',2026],[32990,2023,95985,'No',2026],[31490,2023,19931,'No',2026],
           [28490,2022,83762,'No',2026],[33490,2023,34756,'No',2026]],
    items: [
      { name: '2021 Ascent Sport, 52,771 km', asking: '32369', vals: { c2: '2021', c3: '52771', c4: true } },
      { name: '2020 SL, 61,444 km', asking: '31490', vals: { c2: '2020', c3: '61444', c4: true } }
    ],
    chart: { x: 'c3', y: 'c2', hold: 'mean' }
  },
  house: {
    fields: { currency: '$', itemWhat: 'House in Morley, Perth' },
    columns: [
      { id: 'c1', name: 'Price', type: 'price', unit: '' },
      { id: 'c2', name: 'Bedrooms', type: 'number', unit: '' },
      { id: 'c3', name: 'Bathrooms', type: 'number', unit: '' },
      { id: 'c4', name: 'Land', type: 'number', unit: 'm²' },
      { id: 'c5', name: 'Floor area', type: 'number', unit: 'm²' },
      { id: 'c6', name: 'Data year', type: 'datayear', unit: '' }
    ],
    rows: [[515000,3,1,318,106,2023],[699000,3,1,743,123,2023],[755000,5,2,869,215,2023],[849888,4,2,403,213,2023],
           [800000,4,3,564,289,2023],[540000,3,2,186,97,2023],[800000,3,1,860,100,2024],[840000,4,2,724,332,2025],
           [790000,3,2,315,186,2024],[930000,4,2,395,235,2024],[713500,4,1,429,104,2024],[870000,4,2,1027,185,2024],
           [637000,2,1,503,67,2025],[990000,4,2,336,195,2025],[975000,4,2,705,222,2025],[1070000,5,2,405,171,2025],
           [818000,3,1,306,122,2025],[770000,2,1,491,66,2026],[1110000,4,1,735,148,2026],[1200000,4,2,520,248,2026],
           [1020000,3,2,510,144,2026],[1270000,5,2,417,194,2026],[740000,3,1,324,133,2026]],
    items: [
      { name: '11 Pitt Court, 4x2 on 709 m²', asking: '990000', vals: { c2: '4', c3: '2', c4: '709', c5: '153' } },
      { name: '14 Netley Street, 4x2 on 355 m²', asking: '890000', vals: { c2: '4', c3: '2', c4: '355', c5: '151' } }
    ],
    chart: { x: 'c4', y: 'c5', hold: 'mean' }
  },
  camera: {
    fields: { currency: '£', itemWhat: 'Sony A7 body, used' },
    columns: [
      { id: 'c1', name: 'Price', type: 'price', unit: '' },
      { id: 'c2', name: 'Release year', type: 'year', unit: '' },
      { id: 'c3', name: 'Shutter count', type: 'number', unit: 'shots' },
      { id: 'c4', name: 'Like new or Excellent', type: 'bool', unit: '' },
      { id: 'c5', name: 'Original box', type: 'bool', unit: '' },
      { id: 'c6', name: 'Data year', type: 'datayear', unit: '' }
    ],
    rows: [[439,2014,10089,'Yes','Yes',2026],[439,2014,19875,'Yes','Yes',2026],[439,2014,2466,'Yes','Yes',2026],
           [434,2014,8387,'No','Yes',2026],[424,2014,12433,'Yes','No',2026],[419,2014,8106,'Yes','Yes',2026],
           [354,2014,11114,'No','No',2026],[934,2018,1889,'Yes','No',2026],[919,2018,22031,'Yes','Yes',2026],
           [909,2018,8869,'Yes','No',2026],[894,2018,26625,'Yes','No',2026],[889,2018,10600,'Yes','Yes',2026],
           [874,2018,39719,'Yes','Yes',2026],[744,2018,135838,'No','No',2026],[739,2018,25384,'No','Yes',2026],
           [574,2018,138259,'No','Yes',2026],[1279,2021,30740,'Yes','Yes',2026],[1269,2021,48934,'Yes','Yes',2026],
           [1269,2021,9684,'Yes','Yes',2026],[1249,2021,47270,'Yes','Yes',2026],[1189,2021,122246,'No','Yes',2026],
           [1169,2021,80635,'No','Yes',2026],[1169,2021,99851,'No','Yes',2026],[1139,2021,94923,'Yes','No',2026]],
    items: [
      { name: 'A7 III, 4,354 shots, Like new', asking: '934', vals: { c2: '2018', c3: '4354', c4: true, c5: true } },
      { name: 'A7 IV, 10,513 shots, Excellent', asking: '1269', vals: { c2: '2021', c3: '10513', c4: true, c5: true } }
    ],
    chart: { x: 'c3', y: 'c2', hold: 'mean' }
  },
  hotel: {
    fields: { currency: '$', itemWhat: 'Hotel night in Perth CBD' },
    columns: [
      { id: 'c1', name: 'Price', type: 'price', unit: '' },
      { id: 'c2', name: 'Room size', type: 'number', unit: 'm²' },
      { id: 'c3', name: 'Star rating', type: 'number', unit: '' },
      { id: 'c4', name: 'Breakfast included', type: 'bool', unit: '' },
      { id: 'c5', name: 'Bathtub', type: 'bool', unit: '' },
      { id: 'c6', name: 'Data year', type: 'datayear', unit: '' }
    ],
    rows: [[499,42,5,'No','No',2026],[539,45,5,'No','No',2026],[539,42,5,'No','No',2026],[619,42,5,'No','No',2026],
           [899,105,5,'No','Yes',2026],[549,50,5,'No','Yes',2026],[649,50,5,'No','Yes',2026],[729,50,5,'No','Yes',2026],
           [849,64,5,'No','Yes',2026],[1099,64,5,'No','Yes',2026],[450,27,5,'No','No',2026],[520,27,5,'Yes','No',2026],
           [480,26,5,'No','No',2026],[510,33,5,'No','No',2026],[580,33,5,'Yes','No',2026],[875,55,5,'Yes','Yes',2026],
           [1397,75,5,'Yes','Yes',2026],[422,28,5,'No','No',2026],[440,34,5,'No','No',2026],[159,12,3,'No','No',2026],
           [189,18,3,'No','No',2026],[355,24,4,'No','No',2026]],
    items: [
      { name: 'InterContinental City View, with breakfast', asking: '550', vals: { c2: '26', c3: '5', c4: true, c5: false } },
      { name: 'Ritz-Carlton River View, 2 Double', asking: '669', vals: { c2: '50', c3: '5', c4: false, c5: true } }
    ],
    chart: { x: 'c2', y: 'c3', hold: 'mean' }
  }
};
function presetState(key){
  const p = PRESETS[key];
  const fixed = ensureFixed(p.columns, p.rows.map(r => r.map(v => String(v))));
  return {
    columns: fixed.columns,
    rows: fixed.rows,
    items: clone(p.items),
    chart: clone(p.chart)
  };
}

/* ───────────────────────── State ───────────────────────── */
let S = presetState('camry');
let persist = null;
let last = null;

function nextColId(){
  let n = 0;
  S.columns.forEach(c => { const m = /^c(\d+)$/.exec(c.id); if(m) n = Math.max(n, +m[1]); });
  return 'c' + (n + 1);
}
function featureColumns(){ return S.columns.filter(c => FEATURE_TYPES.includes(c.type)); }
const hasDataYear = () => S.columns.some(c => c.type === 'datayear');
function sym(){ return $('currency').value || ''; }

// A restored or opened state is checked field by field rather than trusted.
function normaliseState(s){
  if(!s || typeof s !== 'object' || !Array.isArray(s.columns) || !Array.isArray(s.rows)) return null;
  const types = TYPES.map(t => t.v);
  const columns = s.columns.filter(c => c && typeof c === 'object').map((c, i) => ({
    id: typeof c.id === 'string' && c.id ? c.id : 'c' + (i + 1),
    name: String(c.name == null ? '' : c.name).slice(0, 80),
    type: types.includes(c.type) ? c.type : 'number',
    unit: String(c.unit == null ? '' : c.unit).slice(0, 20)
  }));
  const rows = s.rows.filter(Array.isArray).map(r => columns.map((c, i) => String(r[i] == null ? '' : r[i])));
  const items = (Array.isArray(s.items) ? s.items : []).filter(it => it && typeof it === 'object').map(it => ({
    name: String(it.name == null ? '' : it.name).slice(0, 80),
    asking: String(it.asking == null ? '' : it.asking),
    vals: it.vals && typeof it.vals === 'object' ? it.vals : {}
  }));
  const chart = s.chart && typeof s.chart === 'object' ? { x: s.chart.x || '', y: s.chart.y || '', hold: s.chart.hold || 'mean' } : { x: '', y: '', hold: 'mean' };
  const fixed = ensureFixed(columns, rows);
  return { columns: fixed.columns, rows: fixed.rows, items, chart };
}

/* ───────────────────────── Inputs ───────────────────────── */
/* Without a Data year column every listing is seen this year, so the
   current year is this calendar year whatever the hidden field holds. */
function readOpts(){
  const y = parseInt($('curYear').value, 10);
  const dated = hasDataYear();
  return {
    dated,
    year: !dated ? THIS_YEAR : isFinite(y) ? Math.min(2100, Math.max(1950, y)) : THIS_YEAR,
    inflation: (parseFloat($('inflation').value) || 0) / 100,
    model: $('model').value,
    lambda: parseFloat($('lambda').value) || 0,
    sym: sym()
  };
}

const MODEL_TIPS = {
  linear: '<strong>Linear regression:</strong> each feature adds a fixed amount to the price, P = α + α₁x₁ + α₂x₂ + …',
  log: '<strong>Log-linear:</strong> each feature changes the price by a fixed percentage, so the price never drops below zero. Suits depreciation.',
  ridge: '<strong>Ridge regression:</strong> linear, with every effect pulled toward zero. Steadier with few listings or features that move together, like age and km.',
  quadratic: '<strong>Quadratic terms:</strong> adds a squared term for every number and year, so the line can bend. Needs more listings than linear.'
};
/* ───────────────────────── Typed numbers ─────────────────────────
   Every typed figure shows its thousands separators and its unit as a prefix
   or suffix. The state keeps the plain number, so Text, CSV and a saved
   scenario never carry a grouping comma. */
const KIND_DP = { price: 2, number: 6 };
function fieldKind(c){
  if(c.type === 'price') return 'price';
  if(c.type === 'year' || c.type === 'datayear') return 'year';
  return c.type === 'number' ? 'number' : null;
}
function showNum(v, kind){
  const s = String(v == null ? '' : v).trim();
  if(s === '' || !KIND_DP[kind]) return s;
  const n = parseNum(s);
  if(n === null) return s;
  return SharedFmt.formatThousands(fmt.plain(n), { maxDecimals: KIND_DP[kind], allowNegative: kind === 'number' });
}
// Group as the reader types, but leave a half-typed "-", "." or "-0." alone.
function liveFmt(el, kind){
  if(!KIND_DP[kind] || /^\s*-?0?\.?0*\s*$/.test(el.value)) return;
  SharedFmt.liveFormat(el, { maxDecimals: KIND_DP[kind], allowNegative: kind === 'number' });
}
const rawNum = v => String(v == null ? '' : v).replace(/,/g, '').trim();

/* ───────────────────────── Editors ───────────────────────── */
// An edit only marks the answer out of date. Valuate is what runs it.
function touched(){
  if(persist) persist.schedule();
  markStale();
}

function buildColumns(){
  const list = $('colList');
  list.innerHTML = '';
  S.columns.forEach((c, i) => {
    const fixed = FIXED_TYPES.includes(c.type);
    const row = document.createElement('div');
    row.className = 'col-row' + (fixed ? ' col-fixed' : '');
    const del = c.type === 'datayear'
      ? SharedIcon.button('trash', 'Delete the data year: every listing is then taken as seen this year', 'col-del')
      : SharedIcon.button('trash', 'Delete this column', 'col-del');
    row.innerHTML =
      `<input class="txt-input col-name" type="text" maxlength="80" aria-label="Column name" value="${esc(c.name)}">` +
      (fixed
        ? `<span class="col-type-fixed">${esc(TYPES.find(t => t.v === c.type).label)}</span>` +
          `<span class="col-unit-fixed">${c.type === 'price' ? esc(sym()) : ''}</span>` +
          (c.type === 'price' ? '<span aria-hidden="true"></span>' : del)
        : `<select class="col-type" aria-label="Column type">${PICK_TYPES.map(t => `<option value="${t.v}"${t.v === c.type ? ' selected' : ''}>${t.label}</option>`).join('')}</select>` +
          `<input class="txt-input col-unit" type="text" maxlength="20" aria-label="Unit" placeholder="unit" value="${esc(c.unit)}"${c.type === 'number' ? '' : ' disabled'}>` +
          del);
    row.querySelector('.col-name').addEventListener('input', e => {
      c.name = e.target.value;
      buildGrid(); buildItems(); touched();
    });
    const delBtn = row.querySelector('.col-del');
    if(delBtn) delBtn.addEventListener('click', () => {
      S.columns.splice(i, 1);
      S.rows.forEach(r => r.splice(i, 1));
      S.items.forEach(it => { delete it.vals[c.id]; });
      buildAll(); syncUI(); touched();
    });
    if(fixed){ list.appendChild(row); return; }
    row.querySelector('.col-type').addEventListener('change', e => {
      c.type = e.target.value;
      if(c.type !== 'number') c.unit = '';
      buildColumns(); buildGrid(); buildItems(); touched();
    });
    row.querySelector('.col-unit').addEventListener('input', e => {
      c.unit = e.target.value;
      buildGrid(); buildItems(); touched();
    });
    list.appendChild(row);
  });
  // No data year: "+ Add data year" brings it back, and the current year
  // and inflation have nothing to do, so they step out of Assumptions.
  const dated = hasDataYear();
  $('addDataYearBtn').hidden = dated;
  $('curYearRow').hidden = !dated;
  $('inflationBlock').hidden = !dated;
}

function cellControl(c, v){
  if(c.type === 'bool'){
    return `<input type="checkbox" class="cell-chk" aria-label="${esc(c.name)}"${parseBool(v) === 1 ? ' checked' : ''}>`;
  }
  if(c.type === 'ignore'){
    return `<input type="text" class="cell cell-text" aria-label="${esc(c.name)}" value="${esc(v)}">`;
  }
  const kind = fieldKind(c);
  let bounds, pre = '', suf = '';
  if(kind === 'price'){ bounds = `data-min="0" data-max="${BIG}"`; pre = sym(); }
  else if(kind === 'year'){ bounds = 'data-min="1900" data-max="2100" data-step="1"'; }
  else { bounds = `data-min="-${BIG}" data-max="${BIG}"`; suf = c.unit || ''; }
  const unit = pre || suf ? '' : kind === 'price' ? ' data-unit="price"' : kind === 'year' ? ' data-unit="year"' : ' data-unitless';
  const ph = c.type === 'datayear' ? ` placeholder="${readOpts().year}"` : '';
  return `<div class="input-wrap cell-wrap">${pre ? `<span class="prefix">${esc(pre)}</span>` : ''}` +
    `<input type="text" inputmode="${kind === 'year' ? 'numeric' : 'decimal'}" class="cell" aria-label="${esc(c.name)}" data-kind="${kind}" ${bounds}${unit}${ph} value="${esc(showNum(v, kind))}">` +
    `${suf ? `<span class="suffix">${esc(suf)}</span>` : ''}</div>`;
}

function buildGrid(){
  const wrap = $('gridWrap');
  const head = S.columns.map(c => `<th class="t-${c.type}">${esc(c.name || '(no name)')}</th>`).join('');
  const body = S.rows.map((r, ri) => '<tr data-r="' + ri + '">' +
    S.columns.map((c, ci) => `<td data-c="${ci}" class="t-${c.type}">${cellControl(c, r[ci])}</td>`).join('') +
    `<td class="t-del">${SharedIcon.button('trash', 'Delete this listing', 'sm row-del')}</td></tr>`).join('');
  wrap.innerHTML = `<table class="grid"><thead><tr>${head}<th aria-label="Delete"></th></tr></thead><tbody>${body}</tbody></table>`;
  const n = S.rows.length;
  $('gridCount').textContent = $('gridModalCount').textContent = `${n} listing${n === 1 ? '' : 's'}, ${S.columns.length} columns`;
}

/* ─── The table, enlarged ───
   ⤢ lifts the table (with its + Add listing) into a full-screen modal and
   puts it back on close. It is the same element, so edits made there are
   the same edits; every way out (Done, ✕, Esc, the backdrop) keeps them. */
let gridReturnFocus = null;
function openGridModal(){
  const what = ($('itemWhat').value || '').trim();
  $('gridModalTitle').textContent = 'Listings' + (what ? ': ' + what : '');
  $('gridModalBody').appendChild($('gridShell'));
  $('gridModal').hidden = false;
  document.body.classList.add('grid-modal-open');
  gridReturnFocus = document.activeElement;
  $('gridCloseBtn').focus();
}
function closeGridModal(){
  if($('gridModal').hidden) return;
  $('entry-table').appendChild($('gridShell'));
  $('gridModal').hidden = true;
  document.body.classList.remove('grid-modal-open');
  if(gridReturnFocus && gridReturnFocus.focus) gridReturnFocus.focus();
  gridReturnFocus = null;
}

function onGridEvent(e){
  const el = e.target;
  const td = el.closest('td[data-c]');
  const tr = el.closest('tr[data-r]');
  if(!td || !tr) return;
  const r = +tr.dataset.r, c = +td.dataset.c;
  if(!S.rows[r]) return;
  if(el.type === 'checkbox') S.rows[r][c] = el.checked ? 'Yes' : 'No';
  else if(KIND_DP[el.dataset.kind]){ liveFmt(el, el.dataset.kind); S.rows[r][c] = rawNum(el.value); }
  else S.rows[r][c] = el.value;
  touched();
}

function addListing(){
  S.rows.push(S.columns.map(c => c.type === 'bool' ? 'No' : ''));
  buildGrid(); touched();
  const rows = $('gridWrap').querySelectorAll('tbody tr');
  const lastRow = rows[rows.length - 1];
  if(lastRow){ lastRow.scrollIntoView({ block: 'nearest' }); const f = lastRow.querySelector('input:not([type=checkbox])'); if(f) f.focus(); }
}

function syncText(){
  $('dataText').value = toDelimited(S.columns, S.rows, ',', ', ');
  $('textStatus').innerHTML = '';
}

/* Text and CSV name their columns; a name that already exists keeps its id
   and type, so the items to buy and the reader's own type choices survive a
   paste. A new name gets its type guessed from its values. */
function applyParsed(parsed){
  const taken = {};
  const used = new Set();
  const cols = parsed.columns.map((h, i) => {
    const old = S.columns.find(c => !used.has(c.id) && c.name.trim().toLowerCase() === h.name.toLowerCase());
    if(old){ used.add(old.id); if(old.type === 'price' || old.type === 'datayear') taken[old.type] = true; return { id: old.id, name: h.name, type: old.type, unit: old.type === 'number' ? h.unit : '', _i: i }; }
    return { id: null, name: h.name, unit: h.unit, _i: i };
  });
  let idn = 0;
  S.columns.forEach(c => { const m = /^c(\d+)$/.exec(c.id); if(m) idn = Math.max(idn, +m[1]); });
  cols.forEach(c => {
    if(c.id) return;
    c.id = 'c' + (++idn);
    c.type = guessType(c.name, parsed.rows.map(r => r[c._i]), taken);
    if(c.type === 'price' || c.type === 'datayear') taken[c.type] = true;
    if(c.type !== 'number') c.unit = '';
  });
  if(!cols.some(c => c.type === 'price')){
    const first = cols.find(c => c.type === 'number');
    if(first) first.type = 'price';
  }
  const fixed = ensureFixed(cols.map(c => ({ id: c.id, name: c.name, type: c.type, unit: c.unit })), parsed.rows.map(r => r.map(rawNum)));
  S.columns = fixed.columns;
  S.rows = fixed.rows;
  const live = new Set(S.columns.map(c => c.id));
  S.items.forEach(it => Object.keys(it.vals).forEach(id => { if(!live.has(id)) delete it.vals[id]; }));
}

function statusHtml(ok, msg){
  return `<span class="${ok ? 'status-ok' : 'status-err'}">${ok ? '✓' : '⚠'} ${esc(msg)}</span>`;
}

let textTimer = null;
function onTextInput(){
  clearTimeout(textTimer);
  textTimer = setTimeout(() => {
    const parsed = parseDelimited($('dataText').value);
    if(!parsed.columns.length){ $('textStatus').innerHTML = statusHtml(false, parsed.errors[0]); return; }
    applyParsed(parsed);
    $('textStatus').innerHTML = parsed.errors.length
      ? statusHtml(false, parsed.errors[0] + (parsed.errors.length > 1 ? ` (+${parsed.errors.length - 1} more)` : ''))
      : statusHtml(true, `${parsed.rows.length} listings, ${parsed.columns.length} columns`);
    buildColumns(); buildGrid(); buildItems();
    touched();
  }, 300);
}

function loadCsvFile(file){
  if(!file) return;
  const rd = new FileReader();
  rd.onload = () => {
    const parsed = parseDelimited(String(rd.result || '').replace(/^﻿/, ''));
    if(!parsed.columns.length){ $('csvStatus').innerHTML = statusHtml(false, 'That file has no header row.'); return; }
    applyParsed(parsed);
    $('csvStatus').innerHTML = parsed.errors.length
      ? statusHtml(false, `${parsed.rows.length} listings read. ${parsed.errors[0]}`)
      : statusHtml(true, `${parsed.rows.length} listings, ${parsed.columns.length} columns from ${file.name}`);
    buildColumns(); buildGrid(); buildItems(); syncText();
    touched();
  };
  rd.readAsText(file);
}

function showEntry(){
  const mode = $('entryMode').value;
  ['table', 'text', 'csv'].forEach(m => { $('entry-' + m).hidden = m !== mode; });
  if(mode === 'text') syncText();
}

const ageNote = (v, year) => { const n = parseNum(v); return n === null ? '' : 'Age <b>' + fmt.num(year - n, 0) + ' yrs</b> in ' + year; };
function buildItems(){
  const list = $('itemList');
  const feats = featureColumns();
  const year = readOpts().year;
  const s = sym();
  list.innerHTML = '';
  if(!S.items.length){
    list.innerHTML = '<p class="empty-note">No items yet. Add the ones you are weighing up.</p>';
  }
  S.items.forEach((it, k) => {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.style.setProperty('--item-colour', SharedPalette.at(k));
    // Features sit two to a row, each label over its own field, so a card is
    // half as tall as a stack of full-width rows.
    const fields = feats.map(c => {
      const v = it.vals[c.id];
      const label = `<div class="field-label">${esc(c.name || '(no name)')}</div>`;
      if(c.type === 'bool'){
        return `<label class="item-field item-chk"><span class="chk-line"><input type="checkbox" data-col="${c.id}"${v ? ' checked' : ''}><span>${esc(c.name || '(no name)')}</span></span></label>`;
      }
      if(c.type === 'year'){
        return `<div class="item-field">${label}` +
          `<div class="currency-wrap" data-unitless><input class="currency-input has-suffix" type="text" inputmode="numeric" data-col="${c.id}" data-min="1900" data-max="${year}" data-step="1" value="${esc(v == null ? '' : v)}" placeholder="e.g. ${year - 3}"></div>` +
          `<div class="derived" data-age="${c.id}">${ageNote(v, year)}</div></div>`;
      }
      const input = `<input class="currency-input has-suffix${(c.unit || '').length > 3 ? ' wide-suffix' : ''}" type="text" inputmode="decimal" data-col="${c.id}" data-kind="number" data-min="-${BIG}" data-max="${BIG}" value="${esc(showNum(v, 'number'))}">`;
      return `<div class="item-field">${label}` + (c.unit
        ? `<div class="currency-wrap">${input}<span class="suffix">${esc(c.unit)}</span></div>`
        : `<div class="currency-wrap" data-unitless>${input}</div>`) + '</div>';
    }).join('');
    card.innerHTML =
      `<div class="item-head"><span class="item-dot" aria-hidden="true"></span>` +
      `<input class="txt-input item-name" type="text" maxlength="80" aria-label="Item name" value="${esc(it.name)}" placeholder="Item ${k + 1}">` +
      SharedIcon.button('duplicate', 'Duplicate this item', 'item-dup') + SharedIcon.button('trash', 'Delete this item', 'item-del') + '</div>' +
      `<div class="item-fields">` +
      `<div class="item-field item-ask-field"><div class="field-label">Asking price</div>` +
      `<div class="currency-wrap"><span class="prefix">${esc(s)}</span><input class="currency-input item-ask" type="text" inputmode="decimal" data-kind="price" data-min="0" data-max="${BIG}" value="${esc(showNum(it.asking, 'price'))}" placeholder="optional"></div></div>` +
      fields + '</div>';
    card.querySelector('.item-name').addEventListener('input', e => { it.name = e.target.value; touched(); });
    card.querySelector('.item-ask').addEventListener('input', e => { liveFmt(e.target, 'price'); it.asking = rawNum(e.target.value); touched(); });
    card.querySelectorAll('[data-col]').forEach(el => {
      const ev = el.type === 'checkbox' ? 'change' : 'input';
      el.addEventListener(ev, () => {
        if(el.type === 'checkbox') it.vals[el.dataset.col] = el.checked;
        else if(el.dataset.kind === 'number'){ liveFmt(el, 'number'); it.vals[el.dataset.col] = rawNum(el.value); }
        else it.vals[el.dataset.col] = el.value;
        const ageEl = card.querySelector(`[data-age="${el.dataset.col}"]`);
        if(ageEl) ageEl.innerHTML = ageNote(el.value, year);
        touched();
      });
    });
    card.querySelector('.item-dup').addEventListener('click', () => {
      const copy = clone(it);
      copy.name = (it.name || 'Item ' + (k + 1)) + ' (copy)';
      S.items.splice(k + 1, 0, copy);
      buildItems(); touched();
    });
    card.querySelector('.item-del').addEventListener('click', () => {
      S.items.splice(k, 1);
      if(S.chart.hold && S.chart.hold.indexOf('item:') === 0) S.chart.hold = 'mean';
      buildItems(); touched();
    });
    list.appendChild(card);
  });
}

/* ───────────────────────── Chart controls ─────────────────────────
   Built from the last valuation, not the form, so a column or an item added
   since cannot be picked before the model knows about it. */
function chartFeatures(r){
  return r && r.prep && r.prep.features ? r.prep.features : featureColumns();
}
function refreshChartControls(r){
  const feats = chartFeatures(r);
  const ids = feats.map(c => c.id);
  if(!ids.includes(S.chart.x)) S.chart.x = ids[0] || '';
  if(!ids.includes(S.chart.y) || S.chart.y === S.chart.x) S.chart.y = ids.find(id => id !== S.chart.x) || '';
  const label = c => c.name || '(no name)';
  $('axisX').innerHTML = feats.map(c => `<option value="${c.id}">${esc(label(c))}</option>`).join('');
  $('axisX').value = S.chart.x;
  $('axisY').innerHTML = feats.filter(c => c.id !== S.chart.x).map(c => `<option value="${c.id}">${esc(label(c))}</option>`).join('');
  $('axisY').value = S.chart.y;
  refreshHoldOptions(r);
}
// With one item to buy or none there is nothing to choose: the chart holds
// the other features at that item, or at the data average.
function refreshHoldOptions(r){
  const items = r && r.items ? r.items : [];
  $('holdWrap').hidden = items.length < 2;
  if(items.length < 2) return;
  const opts = ['<option value="mean">Data average</option>'].concat(items.map((it, k) =>
    `<option value="item:${k}">${esc(it.name)}</option>`));
  $('holdAt').innerHTML = opts.join('');
  if(!/^mean$|^item:\d+$/.test(S.chart.hold) || (S.chart.hold.indexOf('item:') === 0 && !items[+S.chart.hold.slice(5)])) S.chart.hold = 'mean';
  $('holdAt').value = S.chart.hold;
}

function buildAll(){
  buildColumns();
  buildGrid();
  buildItems();
  refreshChartControls(last);
  showEntry();
}

/* ───────────────────────── Compute + render ───────────────────────── */
function compute(){
  const o = readOpts();
  const prep = prepare(S.columns, S.rows, o);
  if(prep.error) return { o, error: prep.error };
  if(!prep.features.length) return { o, prep, error: 'Mark at least one column as a Number, Year or Yes/No feature.' };
  if(prep.X.length < 2) return { o, prep, error: `Enter at least two complete listings. ${prep.X.length ? 'There is one.' : 'There are none yet.'}` };
  const model = fit(prep, o);
  if(model.error) return { o, prep, error: model.error };
  const items = S.items.map((it, k) => evaluateItem(it, k, prep, model, o));
  return { o, prep, model, items };
}

function syncUI(){
  const o = readOpts();
  $('inflationValue').textContent = (o.inflation * 100).toFixed(1) + ' %/yr';
  $('lambdaValue').textContent = o.lambda.toFixed(2) + ' ×';
  $('lambdaBlock').hidden = o.model !== 'ridge';
  $('modelTip').setAttribute('data-tip', MODEL_TIPS[o.model] || '');
  $('axisYWrap').hidden = $('viewDim').value !== '3d';
}

/* ─── The Valuate gate ───
   The form stays live (affixes, slider readouts, which fields show), but the
   answer waits for Valuate, so a reader can enter every listing and item
   before the model runs. Until then the results are dimmed and the button
   is ringed. */
let stale = false;
function markStale(){
  if(stale) return;
  stale = true;
  document.body.classList.add('is-stale');
  $('valuateBtn').classList.add('needs-run');
}
function markFresh(){
  stale = false;
  document.body.classList.remove('is-stale');
  $('valuateBtn').classList.remove('needs-run');
}
// Swap a button's label for a moment to confirm the press.
function flashBtn(btn, label){
  if(btn._flashTimer) clearTimeout(btn._flashTimer);
  else btn._flashLabel = btn.textContent;
  btn.textContent = label;
  btn._flashTimer = setTimeout(() => { btn.textContent = btn._flashLabel; btn._flashTimer = null; }, 900);
}

function render(){
  syncUI();
  markFresh();
  const r = compute();
  last = r;
  refreshChartControls(r);
  renderStatus(r);
  renderVerdict(r);
  renderKpis(r);
  renderTables(r);
  renderWarnings(r);
  renderAssumptions(r);
  scheduleChart();
}

/* What this assumes, built from this fit: the listings, features, model and
   items actually in play. A feature type nobody used, or a data year column
   that never differs from the current year, says nothing. */
function renderAssumptions(r){
  const el = $('assumptions'); if(!el) return;
  if(r.error || !r.model){
    el.innerHTML = '<li><strong>Valuate a complete set of listings</strong> to see what the fit rests on.</li>';
    return;
  }
  const s = r.o.sym, m = r.model, prep = r.prep, F = prep.features;
  const names = fs => { const a = fs.map(f => esc(f.name)); return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; };
  const items = [];

  items.push(`<strong>Your ${m.n} listings are a fair sample of the market.</strong> The model only knows these prices` +
    (m.n < 15 ? ', so with this few a single odd sale moves the answer.' : '.') +
    (prep.skipped.length ? ` ${prep.skipped.length} ${prep.skipped.length === 1 ? 'row with a blank or unreadable cell is' : 'rows with a blank or unreadable cell are'} left out.` : ''));

  const used = F.filter(f => !m.dropped.includes(f.name));
  const nums = used.filter(f => f.type !== 'bool');
  const MODEL = {
    linear: `each adds a fixed amount to the price`,
    log: `each moves the price by a fixed percentage`,
    quadratic: `each adds an amount that can bend${nums.length < used.length ? ' (a Yes/No feature stays a fixed amount)' : ''}`,
    ridge: `each adds a fixed amount, pulled toward zero at λ = ${m.lambda.toFixed(2)}`
  };
  items.push(`<strong>${names(used)}: ${MODEL[m.model] || MODEL.linear}.</strong>` +
    (m.dropped.length ? ` ${m.dropped.map(esc).join(', ')} ${m.dropped.length === 1 ? 'is' : 'are'} the same in every listing, so ${m.dropped.length === 1 ? 'it is' : 'they are'} left out.` : ''));

  const older = prep.dataYear.filter(y => y < r.o.year);
  if(older.length){
    const oldest = Math.min.apply(null, prep.dataYear);
    items.push(r.o.inflation > 0
      ? `<strong>Older prices are lifted to ${r.o.year} money at ${(r.o.inflation * 100).toFixed(1)}% a year</strong> from each listing's data year, ${oldest} at the earliest.`
      : `<strong>Older prices, from ${oldest} on, are taken as they are,</strong> with no inflation to lift them to ${r.o.year} money.`);
  }
  const years = used.filter(f => f.type === 'year');
  if(years.length)
    items.push(`<strong>${names(years)} ${years.length === 1 ? 'becomes an age,' : 'become ages,'}</strong> ` + (r.o.dated
      ? `at each listing's data year for the market data and at ${r.o.year} for the items to buy.`
      : `at ${r.o.year} for the listings and the items to buy alike.`));
  if(!r.o.dated)
    items.push(`<strong>Every listing is taken as seen in ${r.o.year},</strong> so its price is used as it is. Add a data year to mix listings from different years.`);
  const bools = used.filter(f => f.type === 'bool');
  if(bools.length)
    items.push(`<strong>${names(bools)} ${bools.length === 1 ? 'counts' : 'count'} as 1 for yes and 0 for no.</strong>`);

  const good = r.items.filter(it => !it.incomplete && !it.bad);
  if(good.length){
    items.push(m.model === 'log'
      ? `<strong>The range is one typical error either side,</strong> about ±${(Math.expm1(m.rmseLog) * 100).toFixed(1)}% of the fair price: how far real prices scatter, not a confidence interval.`
      : `<strong>The range is one typical error either side,</strong> ±${fmt.money(m.rmse, s)}: how far real prices scatter, not a confidence interval.`);
    good.filter(it => it.outside.length).forEach(it =>
      items.push(`<strong>${esc(it.name)} is extrapolated:</strong> its ${it.outside.map(esc).join(' and ')} ${it.outside.length === 1 ? 'is' : 'are'} outside the listings' range.`));
    if(good.some(it => it.asking !== null))
      items.push('<strong>Asking prices are judged against the model,</strong> never added to it.');
  }

  el.innerHTML = items.map(t => '<li>' + t + '</li>').join('');
}

function renderStatus(r){
  const el = $('colStatus');
  if(r.error && !r.prep) el.innerHTML = statusHtml(false, r.error);
  else el.innerHTML = '';
}

const vnum = s => `<span class="v-num">${s}</span>`;
function renderVerdict(r){
  if(r.error){
    SharedVerdict.set('verdict', { tone: '', title: 'The price model needs more to go on.', body: esc(r.error) });
    return;
  }
  const s = r.o.sym, what = ($('itemWhat').value || '').trim();
  const m = r.model;
  const fitLine = `Fitted to ${m.n} listings${what ? ' of ' + esc(what) : ''}, the model explains ${Math.round(Math.max(0, m.r2 || 0) * 100)}% of their price differences, with a typical error of ${fmt.money(m.rmse, s)}.${r.o.dated ? ` Prices are in ${r.o.year} money.` : ''}`;
  const good = r.items.filter(it => !it.incomplete && !it.bad);
  if(!S.items.length){
    SharedVerdict.set('verdict', { tone: '', title: 'Add the items you want to buy to see their fair price.', body: fitLine });
    return;
  }
  if(!good.length){
    SharedVerdict.set('verdict', { tone: '', title: 'Fill in every feature of an item to price it.', body: fitLine });
    return;
  }
  const asked = good.filter(it => it.asking !== null);
  const others = (list, skip) => list.filter(it => it !== skip).map(it =>
    it.asking !== null
      ? `${esc(it.name)} is asking ${fmt.money(it.asking, s)} against ${fmt.money(it.fair, s)} (${fmt.pct(it.gapPct)})`
      : `${esc(it.name)} is worth about ${fmt.money(it.fair, s)}`).join('; ');
  if(asked.length){
    const best = asked.slice().sort((a, b) => a.gapPct - b.gapPct)[0];
    const pct = Math.abs(best.gapPct * 100).toFixed(1) + '%';
    let title;
    if(Math.abs(best.gapPct) < 0.01){
      title = `${esc(best.name)} is asking ${vnum(fmt.money(best.asking, s))}, within 1% of its fair price of ${vnum(fmt.money(best.fair, s))}.`;
    } else if(best.gapPct < 0){
      title = `${esc(best.name)} is the best value: asking ${vnum(fmt.money(best.asking, s))}, ${vnum(fmt.money(-best.gap, s))} (${pct}) below its fair price of ${vnum(fmt.money(best.fair, s))}.`;
    } else {
      title = `Every item is asking above the model. ${esc(best.name)} is closest: ${vnum(fmt.money(best.asking, s))}, ${vnum(fmt.money(best.gap, s))} (${pct}) above its fair price of ${vnum(fmt.money(best.fair, s))}.`;
    }
    const rest = others(good, best);
    SharedVerdict.set('verdict', { tone: '', title, body: (rest ? rest + '. ' : '') + fitLine });
    return;
  }
  const first = good[0];
  const rest = others(good, first);
  SharedVerdict.set('verdict', { tone: '', title: `The model puts ${esc(first.name)} at a fair price of ${vnum(fmt.money(first.fair, s))}.`,
    body: (rest ? rest + '. ' : '') + 'Add an asking price to see how far a listing sits from it. ' + fitLine });
}

function setKpi(id, value, sub, cls){
  const v = $(id);
  v.textContent = value;
  v.className = 'value' + (cls ? ' ' + cls : '');
  $(id + 'Sub').innerHTML = sub || '';
}
function renderKpis(r){
  if(r.error){
    ['kpiBest', 'kpiFair', 'kpiFit', 'kpiErr'].forEach(id => setKpi(id, '—', ''));
    return;
  }
  const s = r.o.sym, m = r.model;
  const good = r.items.filter(it => !it.incomplete && !it.bad);
  const asked = good.filter(it => it.asking !== null).sort((a, b) => a.gapPct - b.gapPct);
  if(asked.length) setKpi('kpiBest', fmt.pct(asked[0].gapPct), `${esc(asked[0].name)}, ${fmt.signedMoney(asked[0].gap, s)} against fair`, 'small-ish');
  else setKpi('kpiBest', '—', good.length ? 'Add an asking price to compare' : 'Add an item to buy');
  const lead = asked[0] || good[0];
  if(lead) setKpi('kpiFair', fmt.money(lead.fair, s), `${esc(lead.name)}, range ${fmt.money(lead.range[0], s)} to ${fmt.money(lead.range[1], s)}`);
  else setKpi('kpiFair', '—', 'No complete item yet');
  setKpi('kpiFit', m.r2 === null ? '—' : m.r2.toFixed(2), `${m.n} listings, ${m.k} term${m.k === 1 ? '' : 's'}`);
  setKpi('kpiErr', '±' + fmt.money(m.rmse, s), m.model === 'log' ? `About ±${(Math.expm1(m.rmseLog) * 100).toFixed(1)}% on a typical listing` : `${(m.rmse / (mean(r.prep.priceToday) || 1) * 100).toFixed(1)}% of the average listing`);
}

function featLabel(f){ return f.unit ? `${f.name} (${f.unit})` : f.name; }

function renderTables(r){
  const s = r.o.sym;
  const blank = msg => `<p class="empty-note">${esc(msg)}</p>`;
  if(r.error){
    $('itemsTableWrap').innerHTML = blank(r.error);
    $('coefTableWrap').innerHTML = '';
    $('equation').innerHTML = '';
    $('dataTableWrap').innerHTML = '';
    $('itemsUnit').textContent = $('coefUnit').textContent = $('dataUnit').textContent = '';
    return;
  }
  const m = r.model, prep = r.prep;

  // Items to buy
  const inMoney = r.o.dated ? `, ${r.o.year} money` : '';
  $('itemsUnit').textContent = `Prices in ${s || 'the price unit'}${inMoney}. The range is the fair price give or take one typical error.`;
  $('itemsTableWrap').innerHTML = !r.items.length ? blank('No items to buy yet.') :
    `<table><thead><tr><th>Item</th><th>Asking</th><th>Fair price</th><th>Range</th><th>Gap</th><th>Gap %</th></tr></thead><tbody>` +
    r.items.map(it => {
      const name = `<td><span class="row-dot" style="background:${SharedPalette.at(it.k)}"></span>${esc(it.name)}</td>`;
      if(it.incomplete) return `<tr>${name}<td colspan="5" class="note">Missing ${esc(it.missing.join(', '))}</td></tr>`;
      return `<tr>${name}` +
        `<td>${it.asking === null ? '—' : fmt.money(it.asking, s)}</td><td>${fmt.money(it.fair, s)}</td>` +
        `<td>${fmt.money(it.range[0], s)} to ${fmt.money(it.range[1], s)}</td>` +
        `<td>${it.gap === null ? '—' : fmt.signedMoney(it.gap, s)}</td><td>${it.gapPct === null ? '—' : fmt.pct(it.gapPct)}</td></tr>`;
    }).join('') + '</tbody></table>';

  // Model terms
  const isLog = m.model === 'log';
  $('coefUnit').textContent = isLog
    ? `The model is for ln P, the natural log of the price${r.o.dated ? ` in ${r.o.year} money` : ''}. % per unit is e^α − 1. The standardised weight is the effect of one typical spread of the feature.`
    : `Coefficients are in ${s || 'price'}${inMoney}, per unit of the feature. The standardised weight is the effect of one typical spread of the feature, so weights compare across units.`;
  const termUnit = (u, pow) => pow === 2 ? (/[²³]$/.test(u) ? ` (${u})²` : ` (${u}²)`) : ` (${u})`;
  const termName = (f, pow) => (f.type === 'year' ? `Age from ${f.name}` : f.name) + (pow === 2 ? '²' : '') + (f.unit ? termUnit(f.unit, pow) : f.type === 'year' ? termUnit('yrs', pow) : '');
  const rows = [];
  rows.push({ term: 'Intercept (α)', coef: m.coef.c0, w: null, pct: null });
  prep.features.forEach((f, j) => {
    if(m.dropped.includes(f.name)) { rows.push({ term: termName(f, 1), dropped: true }); return; }
    const t1 = m.terms.findIndex(t => t.j === j && t.pow === 1);
    rows.push({ term: termName(f, 1), coef: m.coef.a[j], w: t1 >= 0 ? m.beta[t1 + 1] : null, pct: isLog && !m.coef.q[j] ? Math.expm1(m.coef.a[j]) : null });
    const t2 = m.terms.findIndex(t => t.j === j && t.pow === 2);
    if(t2 >= 0) rows.push({ term: termName(f, 2), coef: m.coef.q[j], w: m.beta[t2 + 1], pct: null });
  });
  $('coefTableWrap').innerHTML =
    `<table><thead><tr><th>Term</th><th>Coefficient</th>${isLog ? '<th>% per unit</th>' : ''}<th>Standardised weight</th></tr></thead><tbody>` +
    rows.map(x => x.dropped
      ? `<tr><td>${esc(x.term)}</td><td colspan="${isLog ? 3 : 2}" class="note">Dropped: the same in every listing</td></tr>`
      : `<tr><td>${esc(x.term)}</td><td>${fmt.num(x.coef, 4)}</td>${isLog ? `<td>${x.pct === null ? '—' : fmt.pct(x.pct, 2)}</td>` : ''}<td>${x.w === null ? '—' : (isLog ? fmt.num(x.w, 4) : fmt.signedMoney(x.w, s))}</td></tr>`).join('') +
    '</tbody></table>';
  // Every variable is bold, in KaTeX and in the plain fallback alike, so the
  // eye can find what each figure multiplies.
  const parts = [fmt.num(m.coef.c0, 4)], tex = [texNum(m.coef.c0)];
  prep.features.forEach((f, j) => {
    if(m.dropped.includes(f.name)) return;
    const nm = f.type === 'year' ? '<strong>Age</strong>(<strong>' + esc(f.name) + '</strong>)' : '<strong>' + esc(f.name) + '</strong>';
    const tn = f.type === 'year' ? texBold('Age') + '(' + texBold(f.name) + ')' : texBold(f.name);
    const add = (c, label, tl) => {
      if(!c) return;
      parts.push((c < 0 ? ' − ' : ' + ') + fmt.num(Math.abs(c), 4) + ' × ' + label);
      tex.push((c < 0 ? ' - ' : ' + ') + texNum(Math.abs(c)) + '\\,' + tl);
    };
    add(m.coef.a[j], nm, tn);
    add(m.coef.q[j], nm + '²', tn + '^{2}');
  });
  renderTex($('equation'), (isLog ? '\\ln \\mathbf{P} = ' : '\\mathbf{P} = ') + tex.join(''),
    (isLog ? 'ln <strong>P</strong> = ' : '<strong>P</strong> = ') + parts.join(''));

  // Listings against the model
  // Without a data year, Listed and Today are the same figure, so only one is shown.
  const dated = r.o.dated;
  $('dataUnit').textContent = dated
    ? `Prices in ${s || 'the price unit'}. Listed is what it was seen at, Today is that restated in ${r.o.year} money. Miss is Today less the model.`
    : `Prices in ${s || 'the price unit'}. Miss is the listed price less the model.`;
  $('dataTableWrap').innerHTML =
    `<table><thead><tr><th>Row</th>${dated ? '<th>Data year</th>' : ''}<th>Listed</th>${dated ? '<th>Today</th>' : ''}<th>Model</th><th>Miss</th><th>Miss %</th></tr></thead><tbody>` +
    prep.row.map((row, i) => `<tr><td>${row}</td>${dated ? `<td>${prep.dataYear[i]}</td>` : ''}<td>${fmt.money(prep.price[i], s)}</td>${dated ? `<td>${fmt.money(prep.priceToday[i], s)}</td>` : ''}` +
      `<td>${fmt.money(m.fitted[i], s)}</td><td>${fmt.signedMoney(m.resid[i], s)}</td><td>${fmt.pct(m.resid[i] / m.fitted[i])}</td></tr>`).join('') +
    '</tbody></table>';
}

/* ─── The model as an equation, typeset by KaTeX ───
   Inline mode, so a long model wraps after a + or a − instead of running off
   the card. Without KaTeX (offline) the plain-text equation stands in. */
function texBold(s){
  const map = { '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '$': '\\$', '&': '\\&', '#': '\\#', '^': '\\textasciicircum{}', '_': '\\_', '%': '\\%', '~': '\\textasciitilde{}' };
  return '\\textbf{' + String(s).replace(/[\\{}$&#^_%~]/g, ch => map[ch]) + '}';
}
const texNum = v => fmt.num(v, 4).replace(/−/g, '-').replace(/,/g, '{,}');
// plainHtml is built from escaped names, so it is safe as markup.
function renderTex(el, tex, plainHtml){
  if(window.katex){
    try { katex.render(tex, el, { throwOnError: false, strict: 'ignore', displayMode: false }); return; } catch(e){ /* plain text below */ }
  }
  el.innerHTML = plainHtml;
}

function renderWarnings(r){
  const notes = [];
  const p = r.prep;
  if(p && p.skipped && p.skipped.length){
    const rows = p.skipped.slice(0, 6).map(x => `${x.row} (${esc(x.why)})`).join(', ');
    notes.push(`${p.skipped.length} listing${p.skipped.length === 1 ? ' was' : 's were'} left out for a missing or unreadable value: row ${rows}${p.skipped.length > 6 ? ' and more' : ''}.`);
  }
  if(p && p.negAge) notes.push(`${p.negAge} listing${p.negAge === 1 ? ' has' : 's have'} a year after its data year, so a negative age.`);
  if(r.model && r.model.dropped.length) notes.push(`${esc(r.model.dropped.join(', '))} never changes across the listings, so it was left out of the model.`);
  if(r.model && r.model.model !== 'ridge' && r.model.n < r.model.k * 3 + 3) notes.push(`Only ${r.model.n} listings for ${r.model.k} terms. The fit can chase noise; more listings, fewer features or Ridge will steady it.`);
  if(r.items){
    const out = r.items.filter(it => !it.incomplete && it.outside.length);
    if(out.length) notes.push(`${out.map(it => esc(it.name)).join(', ')} ${out.length === 1 ? 'sits' : 'sit'} outside the range of the listings, so ${out.length === 1 ? 'its' : 'their'} fair price is extrapolated.`);
    const neg = r.items.filter(it => !it.incomplete && it.negAge);
    if(neg.length) notes.push(`${neg.map(it => esc(it.name)).join(', ')} ${neg.length === 1 ? 'has' : 'have'} a year after ${r.o.year}, so a negative age.`);
    const bad = r.items.filter(it => !it.incomplete && it.bad);
    if(bad.length) notes.push(`The model gives no positive price for ${bad.map(it => esc(it.name)).join(', ')}.`);
    const inc = r.items.filter(it => it.incomplete);
    if(inc.length) notes.push(`${inc.map(it => esc(it.name)).join(', ')} ${inc.length === 1 ? 'is' : 'are'} missing a feature and ${inc.length === 1 ? 'is' : 'are'} not priced.`);
  }
  const el = $('warnBanner');
  el.innerHTML = notes.length ? (notes.length === 1 ? `<p>${notes[0]}</p>` : `<ul>${notes.map(n => `<li>${n}</li>`).join('')}</ul>`) : '';
  el.classList.toggle('visible', notes.length > 0);
}

/* ───────────────────────── Chart ───────────────────────── */
const PLOTLY_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/plotly.js/2.27.1/plotly.min.js';
let plotlyPromise = null;
// About 3.5 MB, so it loads after the answer is already on screen.
function ensurePlotly(){
  if(window.Plotly) return Promise.resolve(window.Plotly);
  if(plotlyPromise) return plotlyPromise;
  plotlyPromise = new Promise((resolve, reject) => {
    const sc = document.createElement('script');
    sc.src = PLOTLY_SRC;
    sc.onload = () => { if(window.Plotly) resolve(window.Plotly); else { plotlyPromise = null; reject(new Error('no Plotly')); } };
    sc.onerror = () => { plotlyPromise = null; reject(new Error('Plotly failed to load')); };
    document.head.appendChild(sc);
  });
  return plotlyPromise;
}

let chartTimer = null, chartSeq = 0;
function scheduleChart(){
  clearTimeout(chartTimer);
  chartTimer = setTimeout(renderChart, 30);
}
function chartMessage(msg){
  $('plotEmpty').textContent = msg;
  $('plotEmpty').hidden = !msg;
  $('plotDiv').style.visibility = msg ? 'hidden' : '';
}

function renderChart(){
  const r = last;
  const seq = ++chartSeq;
  if(!r || r.error){
    chartMessage(r ? 'The chart appears once the model can be fitted.' : '');
    $('chartNote').textContent = '';
    return;
  }
  ensurePlotly().then(() => {
    if(seq !== chartSeq) return;
    chartMessage('');
    drawChart(r);
  }).catch(() => {
    if(seq !== chartSeq) return;
    chartMessage('The chart library could not load. Check your connection and change any input to try again.');
  });
}

function holdVector(r){
  // One item: hold at it. None: the data average. Two or more: the reader picks.
  const h = r.items.length === 1 ? 'item:0' : r.items.length ? S.chart.hold : 'mean';
  if(h && h.indexOf('item:') === 0){
    const it = r.items[+h.slice(5)];
    if(it && !it.incomplete) return { vec: it.vec.slice(), label: it.name };
  }
  return { vec: r.model.mu.slice(), label: 'the data average' };
}

function axisTitle(f){
  if(f.type === 'year') return `Age from ${f.name} (yrs)`;
  if(f.type === 'bool') return `${f.name} (no or yes)`;
  return f.unit ? `${f.name} (${f.unit})` : f.name;
}
function domainOf(r, j, extra){
  const f = r.prep.features[j];
  if(f.type === 'bool') return [0, 1];
  let lo = r.model.min[j], hi = r.model.max[j];
  extra.forEach(v => { if(v !== null && isFinite(v)){ lo = Math.min(lo, v); hi = Math.max(hi, v); } });
  if(hi === lo){ const p = Math.abs(hi) * 0.05 || 1; lo -= p; hi += p; }
  return [lo, hi];
}
const linspace = (a, b, n) => Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));

function chartTheme(){
  return {
    text: cssVar('--chart-text') || cssVar('--muted'),
    grid: cssVar('--chart-grid') || cssVar('--border'),
    grey: cssVar('--muted'),
    surface: cssVar('--line-a'),
    font: "'DM Sans',sans-serif"
  };
}

function drawChart(r){
  const div = $('plotDiv');
  const feats = r.prep.features, m = r.model;
  let xj = feats.findIndex(f => f.id === S.chart.x); if(xj < 0) xj = 0;
  let yj = feats.findIndex(f => f.id === S.chart.y);
  let dim = $('viewDim').value;
  const notes = [];
  if(dim === '3d' && (feats.length < 2 || yj < 0 || yj === xj)){
    dim = '2d';
    notes.push('3D needs two features, so this is the 2D view.');
  }
  const hold = holdVector(r);
  const th = chartTheme();
  const s = r.o.sym;
  const showData = $('showData').checked;
  const items = r.items.filter(it => !it.incomplete && !it.bad);
  const priceTitle = r.o.dated ? `Price (${s ? s + ', ' : ''}${r.o.year} money)` : (s ? `Price (${s})` : 'Price');
  const moneyFmt = (s ? s : '') + '%{y:,.0f}';
  const mix = (base, pairs) => { const v = base.slice(); pairs.forEach(([j, val]) => { v[j] = val; }); return v; };
  const others = feats.map((f, j) => j).filter(j => j !== xj && (dim === '2d' || j !== yj));
  const heldText = others.length
    ? `Other features held at ${esc(hold.label)}: ` + others.map(j => `${feats[j].name} ${feats[j].type === 'bool' ? (hold.vec[j] >= 0.5 ? (hold.vec[j] === 1 ? 'yes' : Math.round(hold.vec[j] * 100) + '% yes') : (hold.vec[j] === 0 ? 'no' : Math.round(hold.vec[j] * 100) + '% yes')) : fmt.num(hold.vec[j], 1) + (feats[j].type === 'year' ? ' yrs old' : feats[j].unit ? ' ' + feats[j].unit : '')}`).join(', ') + '.'
    : '';
  if(heldText) notes.push(heldText);
  if(showData) notes.push('Grey dots are the listings, shifted to the same held values.');
  $('chartNote').innerHTML = notes.join(' ');

  const traces = [];
  const layout = {
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: th.font, color: th.text, size: 12 },
    showlegend: true,
    legend: { orientation: 'h', x: 0, y: -0.2, yanchor: 'top', bgcolor: 'rgba(0,0,0,0)', font: { color: th.text, size: 11 } },
    hovermode: 'closest',
    hoverlabel: { font: { family: th.font } }
  };
  const itemHover = it => `<b>${esc(it.name)}</b><br>Fair price ${fmt.money(it.fair, s)}` + (it.asking !== null ? `<br>Asking ${fmt.money(it.asking, s)} (${fmt.pct(it.gapPct)})` : '') + '<extra></extra>';

  if(dim === '2d'){
    const fx = feats[xj];
    const dom = domainOf(r, xj, items.map(it => it.vec[xj]));
    const xs = fx.type === 'bool' ? [0, 1] : linspace(dom[0], dom[1], 80);
    const lineY = xs.map(x => m.predict(mix(hold.vec, [[xj, x]])));
    if(showData){
      const px = r.prep.X.map(x => x[xj]);
      const py = r.prep.X.map((x, i) => shiftPrice(m, r.prep.priceToday[i], m.fitted[i], m.predict(mix(hold.vec, [[xj, x[xj]]]))));
      traces.push({
        x: px, y: py, type: 'scatter', mode: 'markers', name: 'Listings (shifted)', cliponaxis: false,
        marker: { color: th.grey, size: 8, opacity: 0.55, line: { width: 0 } },
        customdata: r.prep.X.map((x, i) => [r.prep.row[i], r.prep.priceToday[i]]),
        hovertemplate: `Listing row %{customdata[0]}<br>Price today ${s}%{customdata[1]:,.0f}<br>Shifted ${moneyFmt}<extra></extra>`
      });
    }
    traces.push({
      x: xs, y: lineY, type: 'scatter', mode: 'lines', name: 'Price model', line: { color: th.surface, width: 3 },
      hovertemplate: `${esc(axisTitle(fx))} %{x:,.4~f}<br>Model ${moneyFmt}<extra></extra>`
    });
    items.forEach(it => {
      const c = SharedPalette.at(it.k);
      const x = it.vec[xj];
      const fairAdj = m.predict(mix(hold.vec, [[xj, x]]));
      const ys = [fairAdj], sym = ['circle'];
      if(it.asking !== null){ ys.push(shiftPrice(m, it.asking, it.fair, fairAdj)); sym.push('diamond'); }
      traces.push({
        x: ys.map(() => x), y: ys, type: 'scatter', mode: ys.length > 1 ? 'lines+markers+text' : 'markers+text', name: it.name, cliponaxis: false,
        text: [it.name].concat(ys.length > 1 ? [''] : []), textposition: 'top center', textfont: { color: c, size: 11 },
        line: { color: c, width: 2, dash: 'dot' },
        marker: { color: c, size: 13, symbol: sym, line: { color: cssVar('--panel'), width: 1.5 } },
        hovertemplate: itemHover(it)
      });
    });
    Object.assign(layout, {
      margin: { l: 72, r: 24, t: 24, b: 96 },
      xaxis: { title: { text: axisTitle(fx), font: { size: 11, color: th.text } }, gridcolor: th.grid, linecolor: th.grid, zerolinecolor: th.grid, tickfont: { color: th.text },
               ...(fx.type === 'bool' ? { tickvals: [0, 1], ticktext: ['No', 'Yes'] } : {}) },
      yaxis: { title: { text: priceTitle, font: { size: 11, color: th.text } }, gridcolor: th.grid, linecolor: th.grid, zerolinecolor: th.grid, tickfont: { color: th.text }, tickprefix: s, tickformat: ',.0f' },
      uirevision: null
    });
  } else {
    const fx = feats[xj], fy = feats[yj];
    const dx = domainOf(r, xj, items.map(it => it.vec[xj]));
    const dy = domainOf(r, yj, items.map(it => it.vec[yj]));
    const gx = fx.type === 'bool' ? [0, 1] : linspace(dx[0], dx[1], 30);
    const gy = fy.type === 'bool' ? [0, 1] : linspace(dy[0], dy[1], 30);
    const z = gy.map(yv => gx.map(xv => m.predict(mix(hold.vec, [[xj, xv], [yj, yv]]))));
    traces.push({
      x: gx, y: gy, z, type: 'surface', name: 'Price model', showscale: false, showlegend: true, opacity: 0.55,
      colorscale: [[0, th.surface], [1, th.surface]],
      contours: { z: { show: false } },
      hovertemplate: `${esc(fx.name)} %{x:,.4~f}<br>${esc(fy.name)} %{y:,.4~f}<br>Model ${s}%{z:,.0f}<extra></extra>`
    });
    if(showData){
      traces.push({
        x: r.prep.X.map(x => x[xj]), y: r.prep.X.map(x => x[yj]),
        z: r.prep.X.map((x, i) => shiftPrice(m, r.prep.priceToday[i], m.fitted[i], m.predict(mix(hold.vec, [[xj, x[xj]], [yj, x[yj]]])))),
        type: 'scatter3d', mode: 'markers', name: 'Listings (shifted)',
        marker: { color: th.grey, size: 4, opacity: 0.7 },
        customdata: r.prep.X.map((x, i) => [r.prep.row[i], r.prep.priceToday[i]]),
        hovertemplate: `Listing row %{customdata[0]}<br>Price today ${s}%{customdata[1]:,.0f}<br>Shifted ${s}%{z:,.0f}<extra></extra>`
      });
    }
    items.forEach(it => {
      const c = SharedPalette.at(it.k);
      const fairAdj = m.predict(mix(hold.vec, [[xj, it.vec[xj]], [yj, it.vec[yj]]]));
      const zs = [fairAdj], sym = ['circle'];
      if(it.asking !== null){ zs.push(shiftPrice(m, it.asking, it.fair, fairAdj)); sym.push('diamond'); }
      traces.push({
        x: zs.map(() => it.vec[xj]), y: zs.map(() => it.vec[yj]), z: zs, type: 'scatter3d',
        mode: zs.length > 1 ? 'lines+markers' : 'markers', name: it.name,
        line: { color: c, width: 5 }, marker: { color: c, size: 7, symbol: sym },
        hovertemplate: itemHover(it)
      });
    });
    const ax = (title, f) => ({ title: { text: title, font: { size: 11, color: th.text } }, gridcolor: th.grid, color: th.text, backgroundcolor: 'rgba(0,0,0,0)', showbackground: false,
      ...(f && f.type === 'bool' ? { tickvals: [0, 1], ticktext: ['No', 'Yes'] } : {}) });
    Object.assign(layout, {
      margin: { l: 0, r: 0, t: 10, b: 60 },
      scene: { xaxis: ax(axisTitle(fx), fx), yaxis: ax(axisTitle(fy), fy), zaxis: { ...ax(priceTitle), tickprefix: s, tickformat: ',.0f' },
               camera: { eye: { x: 1.3, y: -1.3, z: 0.75 } }, aspectmode: 'manual', aspectratio: { x: 1.25, y: 1.25, z: 0.85 } },
      uirevision: 've3d:' + S.chart.x + ':' + S.chart.y
    });
  }
  currentDim = dim;
  $('resetViewBtn').title = dim === '2d' ? 'Reset zoom' : 'Reset view';
  Promise.resolve(Plotly.react(div, traces, layout, {
    responsive: true, displaylogo: false,
    modeBarButtonsToRemove: ['sendDataToCloud', 'editInChartStudio', 'toImage', 'lasso2d', 'select2d']
  })).then(() => bindAxisGuard(traces, dim)).catch(() => {});
}

/* ─── Zoom: bounded, and a y axis that follows the x window ───────────────
   The promise every chart on the site keeps, by hand here because a Plotly
   plot has no zoom plugin: a drag or a scroll cannot leave the data, and the
   price axis fits what is on screen. 2D only; a 3D scene moves its camera. */
let currentDim = '2d', guardBound = false, guardData = null, guarding = false;
function dataExtent(traces){
  let lo = null, hi = null;
  traces.forEach(t => (t.x || []).forEach(v => {
    if(typeof v !== 'number' || !isFinite(v)) return;
    if(lo === null || v < lo) lo = v;
    if(hi === null || v > hi) hi = v;
  }));
  if(lo === null) return null;
  const pad = (hi - lo) * 0.03 || Math.abs(hi) * 0.05 || 1;
  return [lo - pad, hi + pad];
}
function yExtentIn(traces, x0, x1){
  let lo = null, hi = null;
  traces.forEach(t => {
    const xs = t.x || [], ys = t.y || [];
    let before = null, after = null;
    for(let i = 0; i < ys.length; i++){
      const x = xs[i], y = ys[i];
      if(typeof y !== 'number' || !isFinite(y)) continue;
      if(x < x0){ before = y; continue; }
      if(x > x1){ if(after === null) after = y; continue; }
      if(lo === null || y < lo) lo = y;
      if(hi === null || y > hi) hi = y;
    }
    // Only a line runs through the edge; a lone dot outside the window is not on screen.
    if(t.mode === 'lines') [before, after].forEach(v => {
      if(v === null) return;
      if(lo === null || v < lo) lo = v;
      if(hi === null || v > hi) hi = v;
    });
  });
  if(lo === null) return null;
  const pad = Math.max((hi - lo) * 0.08, Math.abs(hi) * 0.02, 1e-9) || 1;
  return [lo - pad, hi + pad];
}
function bindAxisGuard(traces, dim){
  const div = $('plotDiv');
  guardData = dim === '2d' ? { traces, x: dataExtent(traces) } : null;
  if(guardData && guardData.x){
    const y = yExtentIn(traces, guardData.x[0], guardData.x[1]);
    guarding = true;
    Promise.resolve(Plotly.relayout(div, y ? { 'xaxis.range': guardData.x.slice(), 'yaxis.range': y } : { 'xaxis.range': guardData.x.slice() }))
      .finally(() => { guarding = false; });
  }
  if(guardBound || typeof div.on !== 'function') return;
  guardBound = true;
  div.on('plotly_relayout', ev => {
    if(guarding || !guardData || !guardData.x) return;
    const hasX = ('xaxis.range[0]' in ev) || ('xaxis.range' in ev);
    const auto = ev['xaxis.autorange'] === true;
    if(!hasX && !auto) return;
    const full = guardData.x;
    let x0 = auto ? full[0] : Number(ev['xaxis.range[0]'] ?? (ev['xaxis.range'] || [])[0]);
    let x1 = auto ? full[1] : Number(ev['xaxis.range[1]'] ?? (ev['xaxis.range'] || [])[1]);
    if(!isFinite(x0) || !isFinite(x1)) return;
    if(x1 < x0){ const t = x0; x0 = x1; x1 = t; }
    const width = Math.min(x1 - x0, full[1] - full[0]);
    if(x0 < full[0]){ x0 = full[0]; x1 = x0 + width; }
    if(x1 > full[1]){ x1 = full[1]; x0 = x1 - width; }
    const y = yExtentIn(guardData.traces, x0, x1);
    const update = { 'xaxis.range': [x0, x1] };
    if(y) update['yaxis.range'] = y;
    guarding = true;
    Promise.resolve(Plotly.relayout(div, update)).finally(() => { guarding = false; });
  });
}
function resetView(){
  if(!window.Plotly) return;
  const div = $('plotDiv');
  if(currentDim === '2d' && guardData && guardData.x){
    const y = yExtentIn(guardData.traces, guardData.x[0], guardData.x[1]);
    Plotly.relayout(div, y ? { 'xaxis.range': guardData.x.slice(), 'yaxis.range': y } : { 'xaxis.autorange': true, 'yaxis.autorange': true });
  } else {
    Plotly.relayout(div, { 'scene.camera': { eye: { x: 1.3, y: -1.3, z: 0.75 } } });
  }
}

/* ─── Export ─── */
async function withWatermark(cb){
  const ann = { xref: 'paper', yref: 'paper', x: 1, y: 0, xanchor: 'right', yanchor: 'bottom', showarrow: false,
    text: 'Made using tool.adjiebrotots.com/valuateeverything', font: { size: 10, color: cssVar('--muted'), family: 'DM Sans, sans-serif' } };
  await Plotly.relayout('plotDiv', { annotations: [ann], images: [wmPlotlyImage()] });
  try { return await cb(); }
  finally { await Plotly.relayout('plotDiv', { annotations: [], images: [] }); }
}
function exportName(){ return (($('itemWhat').value || 'valuate-everything').trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'valuate-everything') + '-price-model'; }
function exportImage(format){
  if(!window.Plotly || !last || last.error) return;
  withWatermark(() => Plotly.downloadImage('plotDiv', { format, filename: exportName(), width: 1440, height: 760, scale: format === 'png' ? 2 : 1 })).catch(() => {});
}
async function copyPng(){
  const btn = $('copyBtn');
  if(!window.Plotly || !last || last.error) return;
  try {
    if(!navigator.clipboard || !window.ClipboardItem) throw new Error('This browser cannot copy images.');
    const url = await withWatermark(() => Plotly.toImage('plotDiv', { format: 'png', width: 1440, height: 760, scale: 2 }));
    const blob = await (await fetch(url)).blob();
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    btn.textContent = '✓';
  } catch(e){
    btn.textContent = 'Copy failed';
  }
  setTimeout(() => { btn.textContent = '⧉'; }, 1400);
}

/* ─── Listings CSV ─── */
function dataCsv(){
  const r = last; if(!r || r.error) return;
  const s = r.o.sym, p = r.prep, m = r.model, dated = r.o.dated;
  const head = ['Row'].concat(dated ? ['Data year'] : [], [`Listed (${s})`], dated ? [`Today (${s})`] : [], [`Model (${s})`, `Miss (${s})`, 'Miss %']);
  const lines = [head];
  p.row.forEach((row, i) => lines.push([row].concat(dated ? [p.dataYear[i]] : [], [p.price[i].toFixed(0)], dated ? [p.priceToday[i].toFixed(0)] : [],
    [m.fitted[i].toFixed(0), m.resid[i].toFixed(0), (m.resid[i] / m.fitted[i] * 100).toFixed(2)])));
  downloadText('valuate-everything-listings.csv', lines.map(l => l.map(v => csvCell(v, ',')).join(',')).join('\n'));
}

/* ───────────────────────── Defaults, Quick Start ───────────────────────── */
const DEFAULTS = {};
const STATIC_IDS = ['currency', 'itemWhat', 'entryMode', 'curYear', 'inflation', 'model', 'lambda', 'viewDim', 'showData'];
function captureDefaults(){
  STATIC_IDS.forEach(id => { const el = $(id); DEFAULTS[id] = el.type === 'checkbox' ? el.checked : el.value; });
}
function resetAll(){
  STATIC_IDS.forEach(id => { const el = $(id); if(el.type === 'checkbox') el.checked = DEFAULTS[id]; else el.value = DEFAULTS[id]; });
  S = presetState('camry');
  $('textStatus').innerHTML = '';
  $('csvStatus').innerHTML = '';
}
function applyQuickStart(key){
  const p = PRESETS[key];
  if(!p) return;
  resetAll();
  S = presetState(key);
  Object.entries(p.fields).forEach(([id, v]) => { $(id).value = v; });
  document.querySelectorAll('.quick-start-btn').forEach(b => b.classList.toggle('active', b.dataset.preset === key));
  buildAll();
  if(persist) persist.save();
  render();
}

/* ───────────────────────── Wiring ───────────────────────── */
function init(){
  $('curYear').value = String(THIS_YEAR);
  captureDefaults();
  SharedSeg.fromSelect($('entryMode'), { labelOf: o => o.textContent, ariaLabel: 'How to enter the listings' });
  SharedSeg.fromSelect($('viewDim'), { labelOf: o => o.textContent, ariaLabel: 'Chart view' });

  document.querySelectorAll('.ctrl-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.ctrl-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.ctrl-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      $('tab-' + tab.dataset.tab).classList.add('active');
    });
  });

  // The fixed form: anything outside the editors re-runs the model.
  const onStatic = e => {
    if(e.target.closest('[data-no-persist]')) return;
    if(e.target.id === 'entryMode'){ showEntry(); return; }
    if(e.target.id === 'currency' || e.target.id === 'curYear'){ buildColumns(); buildGrid(); buildItems(); }
    syncUI();
    markStale();
  };
  document.querySelector('.controls').addEventListener('input', onStatic);
  document.querySelector('.controls').addEventListener('change', onStatic);

  $('gridWrap').addEventListener('input', onGridEvent);
  $('gridWrap').addEventListener('change', e => { if(e.target.type === 'checkbox') onGridEvent(e); });
  $('addRowBtn').addEventListener('click', addListing);
  $('gridExpandBtn').addEventListener('click', openGridModal);
  $('gridCloseBtn').addEventListener('click', closeGridModal);
  $('gridDoneBtn').addEventListener('click', closeGridModal);
  $('gridModal').addEventListener('click', e => { if(e.target === $('gridModal')) closeGridModal(); });
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && !$('gridModal').hidden){ e.preventDefault(); closeGridModal(); } });
  $('gridWrap').addEventListener('click', e => {
    const del = e.target.closest('.row-del');
    if(!del) return;
    const tr = del.closest('tr[data-r]');
    S.rows.splice(+tr.dataset.r, 1);
    buildGrid(); touched();
  });
  // A new column goes in before Data year, which always stays last.
  $('addColBtn').addEventListener('click', () => {
    const id = nextColId();
    let at = S.columns.findIndex(c => c.type === 'datayear');
    if(at < 0) at = S.columns.length;
    S.columns.splice(at, 0, { id, name: 'Feature ' + (featureColumns().length + 1), type: 'number', unit: '' });
    S.rows.forEach(r => r.splice(at, 0, ''));
    buildAll(); touched();
  });
  // Data year always goes back in last, blank: a blank reads as this year.
  $('addDataYearBtn').addEventListener('click', () => {
    if(hasDataYear()) return;
    S.columns.push({ id: nextColId(), name: 'Data year', type: 'datayear', unit: '' });
    S.rows.forEach(r => r.push(''));
    buildAll(); syncUI(); touched();
  });
  $('addItemBtn').addEventListener('click', () => {
    S.items.push({ name: 'Item ' + (S.items.length + 1), asking: '', vals: {} });
    buildItems(); touched();
  });
  $('valuateBtn').addEventListener('click', () => { render(); flashBtn($('valuateBtn'), '✓ Updated'); });

  $('dataText').addEventListener('input', onTextInput);
  $('csvFile').addEventListener('change', e => { loadCsvFile(e.target.files[0]); e.target.value = ''; });
  const drop = $('csvDrop');
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('drag'); loadCsvFile(e.dataTransfer.files[0]); });
  $('csvTemplateBtn').addEventListener('click', () => downloadText('valuate-everything-template.csv', toDelimited(S.columns, [], ',', ',')));
  $('csvDataBtn').addEventListener('click', () => downloadText('valuate-everything-listings-input.csv', toDelimited(S.columns, S.rows, ',', ',')));

  // Display options beside the chart change how it reads, never the answer.
  $('axisX').addEventListener('change', () => { S.chart.x = $('axisX').value; refreshChartControls(last); if(persist) persist.schedule(); scheduleChart(); });
  $('axisY').addEventListener('change', () => { S.chart.y = $('axisY').value; if(persist) persist.schedule(); scheduleChart(); });
  $('holdAt').addEventListener('change', () => { S.chart.hold = $('holdAt').value; if(persist) persist.schedule(); scheduleChart(); });
  $('viewDim').addEventListener('change', () => { syncUI(); scheduleChart(); });
  $('showData').addEventListener('change', scheduleChart);

  $('themeToggle').addEventListener('click', () => {
    document.body.classList.toggle('light');
    $('themeToggle').textContent = document.body.classList.contains('light') ? '🌙 Dark' : '☀️ Light';
    scheduleChart();
  });
  $('svgBtn').addEventListener('click', () => exportImage('svg'));
  $('pngBtn').addEventListener('click', () => exportImage('png'));
  $('copyBtn').addEventListener('click', copyPng);
  $('resetViewBtn').addEventListener('click', resetView);
  $('dataCsvBtn').addEventListener('click', dataCsv);

  document.querySelectorAll('.quick-start-btn').forEach(btn =>
    btn.addEventListener('click', () => applyQuickStart(btn.dataset.preset)));

  ['itemsSection', 'coefSection', 'dataSection'].forEach(id => {
    const key = 'valuateeverything-' + id.replace('Section', '');
    SharedFold.attach($(id), { key, bodies: ['.unit-note', '.equation', '.table-wrap'] });
  });

  buildAll();
  // The editors live in JS state, so they ride along in the extra slot. A
  // snapshot that fails its checks is ignored and the defaults stay.
  persist = Persist.init('valuateeverything', {
    onRestore: () => { buildAll(); render(); },
    extra: {
      save: () => clone(S),
      restore: saved => { const n = normaliseState(saved); if(n) S = n; }
    }
  });
  SharedScenario.mount('.quick-start-row', { tool: 'valuateeverything', persist });
  render();

  // Exposed so the audit harness can drive the engine directly as well as
  // through the page.
  window.__VE = { prepare, fit, solve, itemVector, evaluateItem, shiftPrice, parseDelimited, toDelimited, parseBool, parseNum,
                  guessType, compute, readOpts, applyQuickStart, PRESETS, get state(){ return S; }, set state(v){ S = normaliseState(v) || v; buildAll(); render(); },
                  render, buildAll };
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();
