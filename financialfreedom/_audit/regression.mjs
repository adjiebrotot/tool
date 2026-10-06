// Financial Freedom Calculator — regression against the code before life stages.
//
// Life stages added a Simple/Detailed Money out, a Retirement expenses field
// that can be an amount or a share of living, and a list of stages. None of
// that may move a plan that could be entered before it. This harness holds the
// page to that, to the LAST BINARY DIGIT rather than to the cent: every number
// the engine produces, every row of the table, every byte of the CSV, every
// point on both charts, and every figure in the verdicts and the cards.
//
// A plan from before is written with `retireMultiplier`; on the new page it is
// Retirement expenses at that share of living, in Simple mode, with no stages.
//
// Three modes:
//
//   node regression.mjs                 compare this page with baseline.json,
//                                       recorded from the old code. Needs no
//                                       git history.
//   node regression.mjs --live <rev>    load the old page from git at <rev>
//                                       BESIDE this one and compare every field
//                                       directly, naming the first value that
//                                       differs. The strongest form of the check.
//   node regression.mjs --record <rev>  write baseline.json from the old page.
//
// The baseline was recorded from ca850bc, the commit before life stages.
//
// Besides plans typed into the form, it replays the mini cache: the old page
// saves each plan the way a returning reader's browser holds it, and the new
// page has to open that cache, `retireMultiplier` and all, to the same figures.
// A scenario file is the same snapshot, so it is covered by the same path.
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const PAGE = pathToFileURL(join(HERE, '..', 'index.html')).href;
const BASELINE = join(HERE, 'baseline.json');
const KEY = 'abt:save:financialfreedom:v1';

const args = process.argv.slice(2);
const MODE = args[0] === '--live' ? 'live' : (args[0] === '--record' ? 'record' : 'baseline');
const REV = args[1] || 'ca850bc';

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  console.log((ok ? '  PASS  ' : '✗ FAIL  ') + name + (detail ? '  — ' + detail : ''));
  ok ? pass++ : fail++;
};

/* ── The plans ──────────────────────────────────────────────────────────── */

// The six Quick Start scenarios as they stood before life stages, copied from
// the old script. Frugal Living and Family legacy have since been rewritten on
// purpose, so their buttons are not compared; these are the old plans typed in.
const OLD_PRESETS = {
  moderate: {ageNow: 32, ageDie: 90, expense: 65000, expensePeriod: 'yearly', savingsMode: 'savings',
    savings: 45000, savingsPeriod: 'yearly', growth: 3, inflation: 2.5, assetPreset: 'world', ret: 8.5, std: 15,
    assets: 120000, mode: 'die', retireMultiplier: 100},
  frugal: {ageNow: 28, ageDie: 92, expense: 30000, expensePeriod: 'yearly', savingsMode: 'income',
    savings: 92000, savingsPeriod: 'yearly', growth: 2.5, inflation: 2.5, assetPreset: 'world', ret: 8.5, std: 15,
    assets: 40000, mode: 'die', retireMultiplier: 100},
  geoarbitrage: {ageNow: 34, ageDie: 88, expense: 70000, expensePeriod: 'yearly', savingsMode: 'savings',
    savings: 40000, savingsPeriod: 'yearly', growth: 3, inflation: 3, assetPreset: 'world', ret: 8.5, std: 15,
    assets: 90000, mode: 'die', retireMultiplier: 40},
  fatfire: {ageNow: 38, ageDie: 90, expense: 120000, expensePeriod: 'yearly', savingsMode: 'income',
    savings: 320000, savingsPeriod: 'yearly', growth: 3, inflation: 2.5, assetPreset: 'us', ret: 10, std: 15.5,
    assets: 400000, mode: 'rich', retireMultiplier: 100},
  legacy: {ageNow: 40, ageDie: 90, expense: 80000, expensePeriod: 'yearly', savingsMode: 'savings',
    savings: 55000, savingsPeriod: 'yearly', growth: 3, inflation: 2.5, assetPreset: 'world', ret: 8.5, std: 15,
    assets: 350000, mode: 'legacy', legacy: 750000, retireMultiplier: 95},
  latestart: {ageNow: 52, ageDie: 92, expense: 55000, expensePeriod: 'yearly', savingsMode: 'savings',
    savings: 25000, savingsPeriod: 'yearly', growth: 2, inflation: 2.5, assetPreset: 'custom', ret: 6.5, std: 10,
    assets: 180000, mode: 'die', retireMultiplier: 85,
    pensionOn: true, pensionStartAge: 67, pensionAmount: 29000, pensionPeriod: 'yearly', pensionIndexed: true}
};
// The buttons whose scenario did not change: clicking one has to load the same
// plan, seed the same slider age and draw the same page as before.
const SAME_BUTTONS = ['moderate', 'geoarbitrage', 'fatfire', 'latestart'];

/* Hand-picked plans, each aimed at a branch of the engine: the three goals,
   both savings models, both moneys, every period, a frozen and an indexed
   pension, the ends of the slider, a plan that runs out, a plan no pot funds
   (with its remedies), one already free, the retirement share at both ends of
   the old field's 10..300 range and at fractions, zero inflation, a return
   that only matches inflation, one below it, and a fractional age. `seed` as
   the retirement age means the slider's own default: the plan's freedom age. */
const HAND = {
  defaults: {},
  'defaults, today\'s money': {showReal: true},
  'income model': {savingsMode: 'income', savings: 110000},
  'weekly and monthly periods': {expense: 1100, expensePeriod: 'weekly', savings: 2600, savingsPeriod: 'monthly'},
  'legacy goal': {mode: 'legacy', legacy: 900000},
  'die rich': {mode: 'rich'},
  'die rich, frozen pension': {mode: 'rich', pensionOn: true, pensionIndexed: false, pensionAmount: 600, pensionPeriod: 'weekly', pensionStartAge: 70},
  'indexed pension bridge': {pensionOn: true, pensionStartAge: 67, pensionAmount: 29000, ageRetire: 55},
  'pension bigger than spending': {pensionOn: true, pensionStartAge: 60, pensionAmount: 80000, ageRetire: 50},
  'stop today': {ageRetire: 30},
  'never stop': {ageRetire: 90},
  'runs out': {ageRetire: 40, savings: 10000, assets: 20000},
  'nothing funds it': {savings: 0, assets: 0},
  'tight, every remedy': {savings: 6000, assets: 0},
  'tight, income model': {savingsMode: 'income', savings: 64000, assets: 0},
  'already free': {assets: 5000000},
  'share at 10%': {retireMultiplier: 10},
  'share at 300%': {retireMultiplier: 300},
  'share at 85.5%': {retireMultiplier: 85.5},
  'share at 37.25%': {retireMultiplier: 37.25, mode: 'legacy', legacy: 250000},
  'share at 95% (odd binary)': {retireMultiplier: 95, expense: 81234},
  'zero inflation': {inflation: 0},
  'zero real return': {ret: 2.5, inflation: 2.5},
  'below inflation, die rich': {ret: 2, inflation: 4, mode: 'rich'},
  'below inflation, just die': {ret: 2, inflation: 4},
  'fractional age now': {ageNow: 33.5, ageRetire: 'seed'},
  'zero volatility': {std: 0},
  'rupiah, 5000 paths': {currency: 'IDR', expense: 180000000, savings: 120000000, assets: 900000000, paths: 5000},
  'confidence 99, other seed': {confidence: 99, seed: 7},
  'late starter, slider at 70': Object.assign({}, OLD_PRESETS.latestart, {ageRetire: 70}),
  'old frugal at 35': Object.assign({}, OLD_PRESETS.frugal, {ageRetire: 35}),
  'old family legacy at 50': Object.assign({}, OLD_PRESETS.legacy, {ageRetire: 50})
};
Object.keys(OLD_PRESETS).forEach(k => { HAND['old ' + k + ', seeded'] = Object.assign({}, OLD_PRESETS[k], {ageRetire: 'seed'}); });

// 200 plans nobody chose: the audit's own F56 generator, seed for seed, with
// the share drawn across the old field's range.
function fuzzPlans(){
  const rnd = (seed => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; })(20260921);
  const pick = a => a[Math.floor(rnd() * a.length)];
  const between = (lo, hi) => lo + rnd() * (hi - lo);
  const out = {};
  for(let k = 0; k < 200; k++){
    const ageNow = Math.round(between(18, 70));
    const ageDie = ageNow + Math.round(between(1, 50));
    out['fuzz #' + k] = {
      ageNow, ageDie, ageRetire: Math.round(between(ageNow, ageDie)),
      expense: Math.round(between(0, 200000)), expensePeriod: pick(['weekly', 'monthly', 'yearly']),
      savingsMode: pick(['savings', 'income']),
      savings: Math.round(between(0, 250000)), savingsPeriod: pick(['weekly', 'monthly', 'yearly']),
      growth: Number(between(-5, 12).toFixed(1)), inflation: Number(between(0, 15).toFixed(1)),
      ret: Number(between(-3, 20).toFixed(1)), std: Number(between(0, 40).toFixed(1)),
      assets: Math.round(between(0, 3000000)), mode: pick(['die', 'legacy', 'rich']),
      legacy: Math.round(between(0, 2000000)),
      retireMultiplier: Number(between(10, 300).toFixed(pick([0, 0, 1, 2]))),
      pensionOn: rnd() < 0.5, pensionStartAge: Math.round(between(40, 90)),
      pensionAmount: Math.round(between(0, 80000)), pensionPeriod: pick(['weekly', 'monthly', 'yearly']),
      pensionIndexed: rnd() < 0.5, showReal: rnd() < 0.5,
      paths: 60, seed: 1 + Math.floor(rnd() * 1e6), confidence: Math.round(between(50, 99))
    };
  }
  return out;
}
const CASES = Object.assign({}, HAND, fuzzPlans());
// The mini cache is replayed for every hand case and every tenth fuzz plan.
const CACHED = Object.keys(CASES).filter(n => !/^fuzz/.test(n) || Number(n.split('#')[1]) % 10 === 0);

// The currency picker moved from codes to display symbols later than the
// change toNew() bridges, so only this page's side is given symbols.
const SYM = {AUD: '$', USD: '$', SGD: '$', IDR: 'Rp', GBP: '£', EUR: '€'};
function toSymbols(ui){
  return (ui.currency in SYM) ? Object.assign({}, ui, {currency: SYM[ui.currency]}) : ui;
}

// An old plan, as the new page reads it.
function toNew(ui){
  const out = Object.assign({}, ui);
  if('retireMultiplier' in out){
    out.retireExpense = out.retireMultiplier; out.retireExpensePeriod = 'pct';
    delete out.retireMultiplier;
  }
  return out;
}

/* ── Driving a page ─────────────────────────────────────────────────────── */

const CHART_STUB = `
window.__charts = [];
class Chart {
  constructor(ctx, cfg){ this.config = cfg; this.data = (cfg && cfg.data) || {datasets: []};
    this.options = (cfg && cfg.options) || {}; this.scales = this.options.scales || {}; this._hidden = {};
    window.__charts.push(this); }
  update(){} destroy(){ const i = window.__charts.indexOf(this); if(i >= 0) window.__charts.splice(i, 1); }
  resetZoom(){} zoomScale(){}
  isDatasetVisible(i){ return !this._hidden[i]; } setDatasetVisibility(i, v){ this._hidden[i] = !v; }
}
Chart.register = function(){}; Chart.Interaction = {modes: {}};
Chart.helpers = {getRelativePosition: function(e){ return e; }};
window.Chart = Chart;`;

const oldFiles = {};
function oldFile(name){
  if(!(name in oldFiles)){
    oldFiles[name] = execFileSync('git', ['-C', ROOT, 'show', REV + ':financialfreedom/' + name], {encoding: 'utf8'});
  }
  return oldFiles[name];
}
const OWN = ['index.html', 'script.js', 'style.css', 'tour.js'];

const browser = await chromium.launch({args: ['--allow-file-access-from-files']});
async function openPage(which, cache){
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.__errors = [];
  page.on('pageerror', e => page.__errors.push(e.message));
  await page.route('**/*', route => {
    const url = route.request().url();
    if(url.startsWith('file://')){
      if(which === 'old'){
        const own = OWN.find(f => url.endsWith('/financialfreedom/' + f));
        if(own) return route.fulfill({contentType: own.endsWith('.html') ? 'text/html' : (own.endsWith('.css') ? 'text/css' : 'application/javascript'), body: oldFile(own)});
      }
      return route.continue();
    }
    if(/chart\.umd/.test(url)) return route.fulfill({contentType: 'application/javascript', body: CHART_STUB});
    if(/fonts\./.test(url)) return route.fulfill({contentType: 'text/css', body: ''});
    return route.fulfill({contentType: 'application/javascript', body: ''});
  });
  await page.addInitScript(([key, blob]) => {
    try {
      localStorage.clear();
      // The old page from git reads v3, this one v4.
      localStorage.setItem('ff-tour-v3-seen', '1');
      localStorage.setItem('ff-tour-v4-seen', '1');
      if(blob) localStorage.setItem(key, blob);
    } catch(e){}
  }, [KEY, cache || null]);
  await page.goto(PAGE, {waitUntil: 'load'});
  await page.waitForFunction(() => !!window.__FF, null, {timeout: 10000});
  await page.waitForTimeout(300);
  return {ctx, page};
}

// Type a plan into the form the way the page reads it, and run it.
const APPLY = async ([ui]) => {
  const F = window.__FF, $ = id => document.getElementById(id);
  const full = Object.assign({}, F.UI_DEFAULTS, ui);
  const set = (id, v) => {
    const el = $(id);
    if(!el || v === undefined) return;
    if(el.type === 'checkbox') el.checked = !!v;
    else if(el.classList.contains('fmt-num')) el.value = Number.isInteger(v) ? SharedFmt.formatThousands(String(v)) : String(v);
    else el.value = String(v);
  };
  Object.keys(full).forEach(k => {
    if(['ageRetire', 'mode', 'savingsMode', 'expenseMode', 'stages', 'ticker'].includes(k)) return;
    set(k, full[k]);
  });
  const radio = document.querySelector('input[name="ffmode"][value="' + full.mode + '"]');
  if(radio) radio.checked = true;
  F.UI.savingsMode = full.savingsMode;
  let ra = full.ageRetire;
  if(ra === 'seed'){
    const probe = Object.assign({}, full, {ageRetire: full.ageNow});
    const ff = F.solveFreedomAge(F.buildParams(probe));
    const lo = Math.round(full.ageNow), hi = Math.max(lo, Math.round(full.ageDie));
    ra = Math.min(hi, Math.max(lo, ff === null ? hi : Math.ceil(ff - 1e-9)));
  }
  const sl = $('ageRetire');
  sl.min = 0; sl.max = 200; sl.value = ra;
  F.render();
  return null;
};

// Everything the page says about a plan, as plain data.
const SNAP = async () => {
  const F = window.__FF, L = F.last, $ = id => document.getElementById(id);
  const arr = a => a == null ? a : Array.from(a);
  const PKEYS = ['mode', 'ageNow', 'ageRetire', 'ageDie', 'inflation', 'rr', 'rm', 'gm', 'sigma', 'X', 'Xr',
                 'savingsMode', 'S0', 'I0', 'A0', 'legacy', 'pensionOn', 'pensionStartAge', 'pensionIndexed',
                 'pensionMonthly'];
  const P = {};
  PKEYS.forEach(k => { P[k] = L.P[k]; });
  // The CSV, caught on its way to a download.
  let blob = null;
  const mk = URL.createObjectURL, click = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = b => { blob = b; return 'blob:regression'; };
  HTMLAnchorElement.prototype.click = function(){};
  try { F.downloadCsv(); } finally { URL.createObjectURL = mk; HTMLAnchorElement.prototype.click = click; }
  const csv = blob ? await blob.text() : null;
  const txt = id => ($(id) ? $(id).textContent.replace(/\s+/g, ' ').trim() : null);
  return {
    P,
    diag: {status: L.diag.status, message: L.diag.message || null, detail: L.diag.detail || null,
           ffAge: L.diag.ffAge == null ? null : L.diag.ffAge,
           remedies: (L.diag.remedies || []).map(r => [r.key, r.label, r.text])},
    series: {years: L.years, acc: arr(L.acc), deposited: arr(L.deposited), det: arr(L.det),
             needCurve: L.needCurve, incomeCurve: L.incomeCurve, expenseCurve: L.expenseCurve, flowCurve: L.flowCurve},
    headline: {needAtRetire: L.needAtRetire, potAtRetire: L.potAtRetire, leftAtDeath: L.leftAtDeath,
               successAtPlan: L.successAtPlan, confPot: L.confPot, ffAge: L.ffAge},
    mc: {bands: L.mc.bands, years: L.mc.years, paths: L.mc.paths},
    reqs: {sorted: arr(L.reqs.sorted), infinite: L.reqs.infinite, paths: L.reqs.paths},
    dd: L.dd ? {bands: L.dd.bands, startYear: L.dd.startYear, years: L.dd.years, paths: L.dd.paths} : null,
    table: F.tableRows(L),
    tableText: txt('tableWrap') + ' | ' + txt('tableSub'),
    csv,
    charts: window.__charts.map(c => c.data.datasets.map(d => ({
      label: d.label, axis: d.yAxisID || null,
      data: d.data.map(p => (p && typeof p === 'object') ? [p.x, p.y] : p)}))),
    text: {
      verdict: txt('verdict'), verdictSlider: txt('verdictSlider'),
      metrics: Array.from(document.querySelectorAll('.metric')).map(m => m.textContent.replace(/\s+/g, ' ').trim()),
      chart1Sub: txt('chart1Sub'), legend1: txt('legend1'), legend2: txt('legend2'),
      inflationNote: txt('inflationNote'), pensionNote: txt('pensionNote'), savingsModeNote: txt('savingsModeNote'),
      slider: [txt('ageRetireVal'), txt('retireScaleMin'), txt('retireScaleMax')]
    },
    // The assumptions list carries reworded copy now; its figures must not move.
    assumptionFigures: (txt('assumptions') || '').match(/-?\$?[\d][\d,.]*%?/g) || []
  };
};

// JSON with every number exact: non-finite values and negative zero named.
const exact = v => JSON.stringify(v, (k, x) => {
  if(typeof x === 'number'){
    if(Number.isNaN(x)) return 'NaN';
    if(x === Infinity) return 'Infinity';
    if(x === -Infinity) return '-Infinity';
    if(Object.is(x, -0)) return '-0';
  }
  return x;
});
const GROUPS = ['P', 'diag', 'series', 'headline', 'mc', 'reqs', 'dd', 'table', 'tableText', 'csv', 'charts', 'text', 'assumptionFigures'];
const digest = snap => {
  const out = {};
  GROUPS.forEach(g => { out[g] = createHash('sha256').update(exact(snap[g])).digest('hex').slice(0, 20); });
  return out;
};

// The first place two snapshots part, with both values.
function firstDiff(a, b, path = ''){
  if(Object.is(a, b)) return null;
  if(typeof a === 'number' && typeof b === 'number') return `${path}: ${a} vs ${b}`;
  if(a === null || b === null || typeof a !== 'object' || typeof b !== 'object'){
    return exact(a) === exact(b) ? null : `${path}: ${String(exact(a)).slice(0, 120)} vs ${String(exact(b)).slice(0, 120)}`;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for(const k of keys){
    const d = firstDiff(a[k], b[k], path + (Array.isArray(a) ? `[${k}]` : '.' + k));
    if(d) return d;
  }
  return null;
}

async function snapCase(page, ui){
  await page.evaluate(APPLY, [ui]);
  return page.evaluate(SNAP);
}
async function snapButton(page, key){
  await page.evaluate(k => { document.querySelector('.quick-start-btn[data-preset="' + k + '"]').click(); }, key);
  await page.waitForTimeout(100);
  return page.evaluate(SNAP);
}
// What a returning reader's browser holds for the plan on screen.
async function cacheOf(page){
  return page.evaluate(key => { window.dispatchEvent(new Event('beforeunload')); return localStorage.getItem(key); }, KEY);
}

/* ── Run ────────────────────────────────────────────────────────────────── */

const names = Object.keys(CASES);
console.log(`\n── ${MODE === 'baseline' ? 'This page against baseline.json' : (MODE === 'live' ? 'This page against ' + REV + ', side by side' : 'Recording baseline.json from ' + REV)} ──`);

if(MODE === 'record' || MODE === 'live'){
  const shared = ['shared.js', 'shared.css', 'dark.css', 'light.css', 'tour-shared.js', 'tour-shared.css', 'pwa.js'];
  const drift = execFileSync('git', ['-C', ROOT, 'diff', '--name-only', REV, '--', ...shared], {encoding: 'utf8'}).trim();
  check('R0 the shared layers are the same files the old page ran on, so only the tool differs',
    drift === '', drift || shared.join(', ') + ' unchanged since ' + REV);
}

const oldSide = MODE === 'baseline' ? null : await openPage('old');
const newSide = MODE === 'record' ? null : await openPage('new');
/* A page from before life stages reads `retireMultiplier`; any page since reads
   Retirement expenses. Feed the old side the plan in the form IT reads, so
   `--live HEAD` compares the same plan on both sides rather than handing a
   current page a field it no longer has. */
const oldReadsNew = oldSide ? await oldSide.page.evaluate(() => 'retireExpense' in window.__FF.UI_DEFAULTS) : false;
const forOld = ui => oldReadsNew ? toNew(ui) : ui;
const record = {recordedFrom: REV, groups: GROUPS, cases: {}, buttons: {}, caches: {}};
const base = MODE === 'baseline' ? JSON.parse(readFileSync(BASELINE, 'utf8')) : null;
if(base) console.log(`  baseline recorded from ${base.recordedFrom}, ${Object.keys(base.cases).length} plans`);

const bad = {cases: [], buttons: [], caches: []};
let compared = 0;
const oldSnaps = {};
for(const n of names){
  const ui = CASES[n];
  let want;
  if(MODE === 'baseline'){
    want = base.cases[n];
    if(!want){ bad.cases.push(`${n}: not in the baseline`); continue; }
  } else {
    const s = await snapCase(oldSide.page, forOld(ui));
    oldSnaps[n] = s;
    if(CACHED.includes(n)) record.caches[n] = await cacheOf(oldSide.page);
    want = {digest: digest(s), needAtRetire: s.headline.needAtRetire, ffAge: s.headline.ffAge};
    record.cases[n] = want;
  }
  if(MODE === 'record') continue;
  const got = await snapCase(newSide.page, toSymbols(toNew(ui)));
  compared++;
  if(MODE === 'live'){
    const d = firstDiff(oldSnaps[n], got);
    if(d) bad.cases.push(`${n} → ${d}`);
  } else {
    const dg = digest(got);
    const off = GROUPS.filter(g => dg[g] !== want.digest[g]);
    if(off.length) bad.cases.push(`${n}: ${off.join(', ')} differ (need ${got.headline.needAtRetire} vs ${want.needAtRetire})`);
  }
}

for(const k of SAME_BUTTONS){
  if(MODE === 'baseline'){
    const want = base.buttons[k];
    const got = digest(await snapButton(newSide.page, k));
    const off = GROUPS.filter(g => got[g] !== want[g]);
    if(off.length) bad.buttons.push(`${k}: ${off.join(', ')}`);
  } else {
    const s = await snapButton(oldSide.page, k);
    record.buttons[k] = digest(s);
    if(MODE === 'live'){
      const d = firstDiff(s, await snapButton(newSide.page, k));
      if(d) bad.buttons.push(`${k} → ${d}`);
    }
  }
}

// The mini cache: each old cache opened on a fresh new page.
if(MODE !== 'record'){
  const caches = MODE === 'baseline' ? base.caches : record.caches;
  for(const n of Object.keys(caches)){
    const {ctx, page} = await openPage('new', caches[n]);
    const got = await page.evaluate(SNAP);
    const errs = page.__errors.slice();
    await ctx.close();
    if(errs.length){ bad.caches.push(`${n}: page error ${errs[0]}`); continue; }
    if(MODE === 'live'){
      const d = firstDiff(oldSnaps[n], got);
      if(d) bad.caches.push(`${n} → ${d}`);
    } else {
      const dg = digest(got), want = base.cases[n].digest;
      const off = GROUPS.filter(g => dg[g] !== want[g]);
      if(off.length) bad.caches.push(`${n}: ${off.join(', ')}`);
    }
  }
}

if(MODE === 'record'){
  writeFileSync(BASELINE, JSON.stringify(record, null, 1) + '\n');
  check('R record: every plan, button and cache captured from the old page',
    Object.keys(record.cases).length === names.length && Object.keys(record.caches).length === CACHED.length &&
    oldSide.page.__errors.length === 0,
    `${names.length} plans, ${SAME_BUTTONS.length} buttons, ${CACHED.length} caches → ${BASELINE}`);
} else {
  const hand = Object.keys(HAND).length;
  check(`R1 ${hand} hand-picked plans and 200 fuzz plans give the same figures to the last binary digit`,
    bad.cases.length === 0 && compared === names.length,
    bad.cases.slice(0, 4).join(' | ') || `${compared} plans × ${GROUPS.length} groups: engine, table, CSV, both charts, verdicts and cards identical`);
  check('R2 the Quick Start buttons whose scenario did not change load the same plan and draw the same page',
    bad.buttons.length === 0, bad.buttons.join(' | ') || SAME_BUTTONS.join(', '));
  const nc = Object.keys(MODE === 'baseline' ? base.caches : record.caches).length;
  check('R3 a cache saved by the old page, retireMultiplier and all, opens on the new one to the same figures',
    bad.caches.length === 0 && nc === CACHED.length, bad.caches.slice(0, 4).join(' | ') || `${nc} caches reopened identically`);
  check('R4 no page errors on the way', (newSide ? newSide.page.__errors.length : 0) === 0 &&
    (oldSide ? oldSide.page.__errors.length : 0) === 0,
    [].concat(newSide ? newSide.page.__errors : [], oldSide ? oldSide.page.__errors : []).slice(0, 2).join(' | ') || 'clean');
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
