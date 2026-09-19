// Phase 2 — drive the REAL DCA Scenario Explorer and record what it produces.
//
// The price series and the purchase dates are read off the page (its own price
// chart datasets and buy markers). The SIGNAL bar for each purchase is then
// recomputed HERE, from that displayed close series, using textbook indicator
// definitions written for this file. That independence is the whole point of
// E1: if the signal were taken from the engine, the lag it measures would be
// zero by construction.
import { boot, fileUrl, contract, emit, runCase } from './_driver.mjs';

const C = contract('dcasimulator');
const byId = Object.fromEntries(C.cases.map(c => [c.id, c]));

/* ── independent indicator maths (textbook, not the page's) ─────────────── */

const sma = (p, n) => p.map((_, i) => i < n - 1 ? null : p.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n);
function ema(p, n) {
  const out = new Array(p.length).fill(null);
  if (p.length < n) return out;
  let prev = p.slice(0, n).reduce((a, b) => a + b, 0) / n;
  out[n - 1] = prev;
  const k = 2 / (n + 1);
  for (let i = n; i < p.length; i++) { prev = p[i] * k + prev * (1 - k); out[i] = prev; }
  return out;
}
const ma = (p, type, n) => (type === 'ema' ? ema(p, n) : sma(p, n));
function rsi(p, n) {
  const out = new Array(p.length).fill(null);
  if (p.length < n + 1) return out;
  let g = 0, l = 0;
  for (let i = 1; i <= n; i++) { const c = p[i] - p[i - 1]; if (c >= 0) g += c; else l -= c; }
  let ag = g / n, al = l / n;
  out[n] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = n + 1; i < p.length; i++) {
    const c = p[i] - p[i - 1];
    ag = (ag * (n - 1) + Math.max(c, 0)) / n;
    al = (al * (n - 1) + Math.max(-c, 0)) / n;
    out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return out;
}
function macd(p, f, s, sig) {
  const ef = ema(p, f), es = ema(p, s);
  const line = p.map((_, i) => (ef[i] != null && es[i] != null) ? ef[i] - es[i] : null);
  const out = new Array(p.length).fill(null);
  let prev = null, cnt = 0, seed = 0;
  const k = 2 / (sig + 1);
  for (let i = 0; i < p.length; i++) {
    if (line[i] == null) continue;
    cnt++;
    if (cnt < sig) seed += line[i];
    else if (cnt === sig) { seed += line[i]; prev = seed / sig; out[i] = prev; }
    else { prev = line[i] * k + prev * (1 - k); out[i] = prev; }
  }
  return { line, signal: out, hist: p.map((_, i) => (line[i] != null && out[i] != null) ? line[i] - out[i] : null) };
}
function bollinger(p, n, k) {
  const mid = sma(p, n), up = new Array(p.length).fill(null), lo = new Array(p.length).fill(null);
  for (let i = n - 1; i < p.length; i++) {
    let sq = 0;
    for (let j = i - n + 1; j <= i; j++) sq += (p[j] - mid[i]) ** 2;
    const sd = Math.sqrt(sq / n);
    up[i] = mid[i] + k * sd; lo[i] = mid[i] - k * sd;
  }
  return { mid, up, lo };
}
function adx(p, n) {
  const len = p.length, out = new Array(len).fill(null);
  if (len < 2 * n + 1) return out;
  const tr = new Array(len).fill(0), pdm = new Array(len).fill(0), ndm = new Array(len).fill(0);
  for (let i = 1; i < len; i++) {
    const up = p[i] - p[i - 1], dn = p[i - 1] - p[i];
    pdm[i] = (up > dn && up > 0) ? up : 0;
    ndm[i] = (dn > up && dn > 0) ? dn : 0;
    tr[i] = Math.abs(p[i] - p[i - 1]);
  }
  let atr = 0, ap = 0, an = 0;
  for (let i = 1; i <= n; i++) { atr += tr[i]; ap += pdm[i]; an += ndm[i]; }
  const dx = new Array(len).fill(null);
  for (let i = n + 1; i < len; i++) {
    atr += tr[i] - atr / n; ap += pdm[i] - ap / n; an += ndm[i] - an / n;
    const pdi = atr === 0 ? 0 : 100 * ap / atr, ndi = atr === 0 ? 0 : 100 * an / atr;
    dx[i] = (pdi + ndi) === 0 ? 0 : 100 * Math.abs(pdi - ndi) / (pdi + ndi);
  }
  let cnt = 0, s = 0, prev = null;
  for (let i = 0; i < len; i++) {
    if (dx[i] == null) continue;
    cnt++;
    if (cnt <= n) { s += dx[i]; if (cnt === n) { prev = s / n; out[i] = prev; } }
    else { prev = (prev * (n - 1) + dx[i]) / n; out[i] = prev; }
  }
  return out;
}
/** Bars where a boolean condition goes false -> true (a state change). */
function risingEdges(cond) {
  const e = [];
  for (let i = 0; i < cond.length; i++) if (cond[i] && !(i > 0 && cond[i - 1])) e.push(i);
  return e;
}
/** Bars where `fast` crosses above `slow`. */
function crossUp(fast, slow) {
  const hits = [];
  for (let i = 1; i < fast.length; i++) {
    const a0 = fast[i - 1], a1 = fast[i], b0 = slow[i - 1], b1 = slow[i];
    if ([a0, a1, b0, b1].some(v => v == null)) continue;
    if (a0 <= b0 && a1 > b1) hits.push(i);
  }
  return hits;
}

/* ── the conditional styles this runner can recompute independently ─────── */

// The strategy selector is categorised: a style's radio is not rendered until
// its category pill is open, which is why the runner must click the pill first.
const CATEGORY = {
  'monthly-date': 'date', 'weekly-day': 'date',
  'momentum-peak': 'momentum', 'momentum-dip': 'momentum',
  'tech-ma-cross': 'tech', 'tech-rsi': 'tech', 'tech-bollinger': 'tech',
  'tech-macd-cross': 'tech', 'tech-macd-hist': 'tech', 'tech-adx': 'tech',
  'monthly-top': 'forward', 'monthly-bottom': 'forward',
  'weekly-top': 'forward', 'weekly-bottom': 'forward',
};

const CONDITIONAL = [
  { style: 'tech-ma-cross', label: 'MA cross' },
  { style: 'tech-rsi', label: 'RSI oversold' },
  { style: 'tech-bollinger', label: 'Bollinger' },
  { style: 'tech-macd-cross', label: 'MACD cross' },
  { style: 'tech-macd-hist', label: 'MACD histogram' },
  { style: 'tech-adx', label: 'ADX' },
  { style: 'momentum-dip', label: 'Price % dip' },
  { style: 'momentum-peak', label: 'Price % peak' },
];

/** Signal bars for a style, from the displayed closes and the form's own params. */
function signalBars(style, closes, dates, prm) {
  switch (style) {
    case 'tech-ma-cross':
      return crossUp(ma(closes, prm.fastType, prm.fastLen), ma(closes, prm.slowType, prm.slowLen));
    case 'tech-rsi':
      return risingEdges(rsi(closes, prm.rsiPeriod).map(v => v != null && v < prm.rsiOversold));
    case 'tech-bollinger': {
      const { lo } = bollinger(closes, prm.bbPeriod, prm.bbStd);
      if (prm.bbTrigger === 'reclaim') {
        const hits = [];
        for (let i = 1; i < closes.length; i++)
          if (lo[i] != null && lo[i - 1] != null && closes[i] >= lo[i] && closes[i - 1] < lo[i - 1]) hits.push(i);
        return hits;
      }
      return risingEdges(closes.map((c, i) => lo[i] != null && c < lo[i]));
    }
    case 'tech-macd-cross': {
      const m = macd(closes, prm.macdFast, prm.macdSlow, prm.macdSignal);
      return crossUp(m.line, m.signal);
    }
    case 'tech-macd-hist': {
      const { hist } = macd(closes, prm.macdFast, prm.macdSlow, prm.macdSignal);
      return risingEdges(hist.map(v => v != null && v > prm.macdHistThreshold));
    }
    case 'tech-adx':
      return risingEdges(adx(closes, prm.adxPeriod).map(v => v != null && v > prm.adxThreshold));
    case 'momentum-dip':
    case 'momentum-peak': {
      // Reference is the period's opening close; the period is a calendar month
      // unless the form says weekly.
      const key = i => prm.period === 'weekly' ? weekKey(dates[i]) : dates[i].slice(0, 7);
      const cond = new Array(closes.length).fill(false);
      let cur = null, open = null;
      for (let i = 0; i < closes.length; i++) {
        const k = key(i);
        if (k !== cur) { cur = k; open = closes[i]; }
        if (!(open > 0)) continue;
        const move = closes[i] / open - 1;
        cond[i] = style === 'momentum-peak' ? move >= prm.momPct / 100 : move <= -prm.momPct / 100;
      }
      return risingEdges(cond);
    }
    default: return [];
  }
}
function weekKey(d) {
  const dt = new Date(d + 'T00:00:00');
  const y = dt.getFullYear();
  const doy = Math.floor((dt - new Date(y, 0, 1)) / 86400000);
  return y + '-' + String(Math.floor((doy + new Date(y, 0, 1).getDay()) / 7)).padStart(2, '0');
}

/* ── driving the page ───────────────────────────────────────────────────── */

const { browser, page, errors } = await boot();
await page.goto(fileUrl('dcasimulator/index.html'), { waitUntil: 'load' });
await page.evaluate(() => { try { localStorage.clear(); } catch (_) { } });
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(500);

const set = (id, v) => page.evaluate(({ id, v }) => {
  const e = document.getElementById(id);
  if (!e) return 'missing:' + id;
  if (e.type === 'checkbox') { if (e.checked !== !!v) e.click(); return e.checked; }
  e.value = String(v);
  ['input', 'change', 'blur'].forEach(t => e.dispatchEvent(new Event(t, { bubbles: true })));
  return e.value;
}, { id, v });

async function freshState() {
  await page.evaluate(() => {
    document.querySelectorAll('.tour-overlay,.tour-pop').forEach(n => n.remove());
    document.getElementById('resetBtn')?.click();
  });
  await page.waitForTimeout(300);
  // Drop every scenario except one.
  for (let i = 0; i < 20; i++) {
    const n = await page.evaluate(() => {
      const tabs = document.querySelectorAll('#scenarioTabs .scenario-tab, #scenarioTabs [data-sec]');
      if (tabs.length <= 1) return tabs.length;
      document.getElementById('delScenarioBtn')?.click();
      return document.querySelectorAll('#scenarioTabs .scenario-tab, #scenarioTabs [data-sec]').length;
    });
    if (n <= 1) break;
  }
  await page.waitForTimeout(150);
}

async function addSimulatedAsset(name, ret, std) {
  await page.evaluate(() => {
    const t = document.getElementById('dataModeToggle');
    const b = [...(t?.querySelectorAll('button, .seg-btn') || [])].find(x => /sim/i.test(x.textContent));
    if (b) b.click();
  });
  await page.waitForTimeout(150);
  await set('simNameInput', name); await set('simReturnInput', ret); await set('simStdInput', std);
  await page.evaluate(() => document.getElementById('addSimBtn')?.click());
  await page.waitForTimeout(250);
}

/** Active scenario's numeric id, needed for the per-scenario control ids. */
const activeSecId = () => page.evaluate(() => {
  const r = document.querySelector('#scenarioConfig input[type=radio][name^="secStyle"]');
  return r ? r.name.replace('secStyle', '') : null;
});

async function configureScenario({ name, amount, style }) {
  await set('cfgName', name);
  await set('cfgAmount', amount);
  await page.evaluate(() => {
    const s = document.getElementById('cfgAssetSelect');
    if (s) { const o = [...s.options].find(x => x.value.startsWith('s:')); if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); } }
  });
  await page.waitForTimeout(150);
  const id = await activeSecId();
  // Open the style's category first, or its radio does not exist yet.
  await page.evaluate(cat => {
    const p = [...document.querySelectorAll('#scenarioConfig .cat-pill')].find(x => x.dataset.cat === cat);
    if (p) p.click();
  }, CATEGORY[style] || 'date');
  await page.waitForTimeout(250);
  const picked = await page.evaluate(({ id, style }) => {
    const r = document.querySelector(`input[name="secStyle${id}"][value="${style}"]`);
    if (!r) return false;
    r.click();
    return true;
  }, { id, style });
  if (!picked) throw new Error('style radio not found after opening its category: ' + style);
  await page.waitForTimeout(300);
  return id;
}

/** Turn the "buy at the end of the period anyway" fallback off, if present. */
async function disableFallback(id) {
  return page.evaluate(id => {
    let off = [];
    for (const suffix of ['secTechEOM', 'secMomEOM']) {
      const e = document.getElementById(suffix + id);
      if (e && e.type === 'checkbox') { if (e.checked) e.click(); off.push(suffix); }
    }
    return off;
  }, id);
}

/** Read the style's parameters from the form itself, so the independent
    recomputation uses exactly the numbers the user sees. */
async function readParams(id) {
  return page.evaluate(id => {
    const g = (n, d) => { const e = document.getElementById(n + id); return e ? (e.value !== undefined ? e.value : d) : d; };
    const num = (n, d) => { const v = Number(g(n, d)); return Number.isFinite(v) ? v : d; };
    const sel = document.querySelector(`#styleBlock${id} select[id^="secMaFastType"], #secMaFastType${id}`);
    return {
      fastType: (document.getElementById('secMaFastType' + id)?.value) || 'ema',
      slowType: (document.getElementById('secMaSlowType' + id)?.value) || 'sma',
      fastLen: num('secMaFastLen', 50), slowLen: num('secMaSlowLen', 200),
      rsiPeriod: num('secRsiPeriod', 14), rsiOversold: num('secRsiOversold', 35),
      bbPeriod: num('secBbPeriod', 20), bbStd: num('secBbStd', 2),
      bbTrigger: (document.getElementById('secBbTrigger' + id)?.value) || 'below',
      macdFast: num('secMacdFast', 12), macdSlow: num('secMacdSlow', 26),
      macdSignal: num('secMacdSignal', 9), macdHistThreshold: num('secMacdHist', 0),
      adxPeriod: num('secAdxPeriod', 14), adxThreshold: num('secAdxThreshold', 25),
      momPct: num('secMomPct', 5),
      period: (() => {
        const w = document.querySelector(`#styleBlock${id} [data-period].active, #styleBlock${id} input[name^="secPeriod"]:checked`);
        return w ? (w.dataset?.period || w.value || 'monthly') : 'monthly';
      })(),
    };
  }, id);
}

async function addScenario() {
  await page.evaluate(() => document.getElementById('addScenarioBtn')?.click());
  await page.waitForTimeout(250);
}

async function runSim() {
  await page.evaluate(() => document.getElementById('simBtn')?.click());
  for (let i = 0; i < 60; i++) {
    const busy = await page.evaluate(() => !!document.getElementById('simBtn')?.dataset.running);
    if (!busy) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(600);
}

/** Price series + buy markers per scenario, straight off the page's chart. */
async function priceAndBuys() {
  return page.evaluate(() => {
    const c = window.Chart.getChart(document.getElementById('priceCanvas'));
    if (!c) return null;
    const labels = c.data.labels || [];
    const price = {}, buys = {};
    for (const ds of c.data.datasets || []) {
      const lbl = String(ds.label || '');
      if (/ ▲ Buy$/.test(lbl)) {
        const nm = lbl.replace(/ ▲ Buy$/, '');
        buys[nm] = (ds.data || []).map((v, i) => (v !== null && v !== undefined) ? i : null).filter(v => v !== null);
      } else if (!ds._marker) {
        price[lbl] = (ds.data || []).map(v => (v && typeof v === 'object') ? v.y : v);
      }
    }
    return { labels, price, buys };
  });
}

async function summaryTiles() {
  return page.evaluate(() => {
    const out = {};
    for (const card of document.querySelectorAll('#summaryGrid > div')) {
      const t = card.innerText || '';
      const name = (t.split('\n')[0] || '').trim();
      if (name) out[name] = t;
    }
    return out;
  });
}

const nanCount = () => page.evaluate(() => {
  const t = ['summaryGrid', 'detailBody', 'mainWarning']
    .map(i => document.getElementById(i)?.innerText || '').join(' ');
  return (t.match(/NaN|Infinity|-Infinity|undefined|null/g) || []).length;
});

/* ── cases ──────────────────────────────────────────────────────────────── */

const cases = {};
const S = byId.N1.setup;

async function baseSetup(startDate, endDate) {
  await freshState();
  await set('randomSeed', S.settings['#randomSeed']);
  await set('riskFreeRate', S.settings['#riskFreeRate']);
  await set('currencySymbol', '$');
  await addSimulatedAsset('SIMA', 8, 15);
  await set('startDate', startDate);
  await set('endDate', endDate);
  await page.waitForTimeout(200);
}

await runCase(cases, 'N1', async () => {
  await baseSetup('2015-01-01', '2024-12-31');
  const id = await configureScenario({ name: 'N1', amount: 1000, style: 'monthly-date' });
  await set('secDay' + id, 15);
  await set('showBuyDateToggle', true);
  await runSim();
  const pb = await priceAndBuys();
  if (!pb || !pb.price['N1']) throw new Error('no price series plotted for N1');
  const dates = pb.labels, buys = pb.buys['N1'] || [];
  const byMonth = {};
  for (const b of buys) { const m = dates[b].slice(0, 7); byMonth[m] = (byMonth[m] || 0) + 1; }
  const months = [...new Set(dates.map(d => d.slice(0, 7)))];
  const gaps = buys.slice(1).map((b, i) => (new Date(dates[b]) - new Date(dates[buys[i]])) / 86400000);
  const tiles = await summaryTiles();
  return {
    n_buys: buys.length,
    first_buy_date: dates[buys[0]] ?? null,
    buy_date_jun_2024: dates[buys.find(b => dates[b].startsWith('2024-06'))] ?? null,
    buy_date_dec_2024: dates[buys.find(b => dates[b].startsWith('2024-12'))] ?? null,
    months_with_no_buy: months.filter(m => !byMonth[m]).length,
    months_with_two_buys: Object.values(byMonth).filter(v => v > 1).length,
    max_abs_gap_days: gaps.length ? Math.max(...gaps) : null,
    total_deposited: buys.length * 1000,
    deposit_ratio: null,
    units_recon_ratio: null,
    equity_recon_ratio: null,
    return_pct_residual: null,
    nan_count: await nanCount(),
    js_error_count: errors.length,
    _summary: tiles['N1'] || null,
  };
});
cases['N1'].notes = 'Buy dates from the page\'s own buy-marker dataset on the price chart. The deposit/units/equity reconciliation ratios are null: they need the Detailed Breakdown columns, which this runner does not parse.';

await runCase(cases, 'E1', async () => {
  await baseSetup('2015-01-01', '2024-12-31');
  await set('showBuyDateToggle', true);
  const tested = [];
  // One scenario per conditional style, all on the same asset and window.
  for (let i = 0; i < CONDITIONAL.length; i++) {
    if (i > 0) await addScenario();
    const id = await configureScenario({ name: 'C' + (i + 1), amount: 1000, style: CONDITIONAL[i].style });
    const offs = await disableFallback(id);
    if (!offs.length) throw new Error('end-of-period fallback checkbox not found for ' + CONDITIONAL[i].style + '; without it every period buys and the case tests nothing');
    const prm = await readParams(id);
    tested.push({ ...CONDITIONAL[i], name: 'C' + (i + 1), id, prm, fallbackOff: offs });
  }
  await runSim();
  const pb = await priceAndBuys();
  if (!pb) throw new Error('price chart produced no datasets');

  let total = 0, sameBar = 0, lagged = 0, unmatched = 0, minLag = Infinity;
  const stylesWithSame = new Set(), perStyle = {};
  for (const t of tested) {
    const closes = pb.price[t.name];
    const buys = pb.buys[t.name] || [];
    if (!closes) { perStyle[t.style] = { error: 'no series' }; continue; }
    const sig = signalBars(t.style, closes, pb.labels, t.prm);
    let same = 0, lag = 0, un = 0;
    const lags = [];
    for (const b of buys) {
      // The signal bar is the most recent false->true transition at or before
      // the purchase, per the contract's definition.
      const s = [...sig].reverse().find(x => x <= b);
      if (s === undefined) { un++; continue; }
      const d = b - s;
      lags.push(d);
      if (d === 0) same++; else lag++;
      if (d < minLag) minLag = d;
    }
    total += buys.length; sameBar += same; lagged += lag; unmatched += un;
    if (same > 0) stylesWithSame.add(t.style);
    perStyle[t.style] = {
      buys: buys.length, sameBar: same, lagged: lag, unmatched: un,
      minLag: lags.length ? Math.min(...lags) : null, params: t.prm, fallbackOff: t.fallbackOff,
    };
  }
  return {
    styles_tested: tested.length,
    total_buy_count: total,
    sameBar_buy_count: sameBar,
    styles_with_sameBar: stylesWithSame.size,
    min_signal_to_execution_lag_bars: Number.isFinite(minLag) ? minLag : null,
    lagged_buy_count: lagged,
    unmatched_buy_count: unmatched,
    nan_count: await nanCount(),
    _per_style: perStyle,
  };
});
cases['E1'].notes = 'Signal bars recomputed in the runner from the page\'s displayed close series using its own textbook indicator code; the style parameters are read off the form so both sides use the same numbers. The engine is never asked where its signal was.';

await runCase(cases, 'E2', async () => {
  await baseSetup('2015-01-04', '2024-12-28');
  await set('showBuyDateToggle', true);
  const specs = [
    ['M15', 'monthly-date'], ['MTOP', 'monthly-top'], ['MBOT', 'monthly-bottom'],
    ['WWED', 'weekly-day'], ['WTOP', 'weekly-top'], ['WBOT', 'weekly-bottom'],
  ];
  for (let i = 0; i < specs.length; i++) {
    if (i > 0) await addScenario();
    const id = await configureScenario({ name: specs[i][0], amount: 1000, style: specs[i][1] });
    if (specs[i][1] === 'monthly-date') await set('secDay' + id, 15);
    if (specs[i][1] === 'weekly-day') await set('secDay' + id, 3);
  }
  await runSim();
  const pb = await priceAndBuys();
  const tiles = await summaryTiles();
  const finalEq = nm => {
    const t = tiles[nm] || '';
    const m = t.match(/\$[\d,]+(?:\.\d+)?/g);
    return m ? Number(m[m.length - 1].replace(/[$,]/g, '')) : null;
  };
  const nBuys = nm => (pb?.buys?.[nm] || []).length;
  const o = {
    eq_m15: finalEq('M15'), eq_mtop: finalEq('MTOP'), eq_mbot: finalEq('MBOT'),
    eq_wwed: finalEq('WWED'), eq_wtop: finalEq('WTOP'), eq_wbot: finalEq('WBOT'),
    n_m15: nBuys('M15'), n_mtop: nBuys('MTOP'), n_mbot: nBuys('MBOT'),
    n_wwed: nBuys('WWED'), n_wtop: nBuys('WTOP'), n_wbot: nBuys('WBOT'),
    nan_count: await nanCount(),
  };
  o.monthly_dep_spread = Math.max(o.n_m15, o.n_mtop, o.n_mbot) - Math.min(o.n_m15, o.n_mtop, o.n_mbot);
  o.weekly_dep_spread = Math.max(o.n_wwed, o.n_wtop, o.n_wbot) - Math.min(o.n_wwed, o.n_wtop, o.n_wbot);
  o.mbot_minus_m15 = (o.eq_mbot ?? 0) - (o.eq_m15 ?? 0);
  o.m15_minus_mtop = (o.eq_m15 ?? 0) - (o.eq_mtop ?? 0);
  o.mbot_minus_mtop = (o.eq_mbot ?? 0) - (o.eq_mtop ?? 0);
  o.wbot_minus_wwed = (o.eq_wbot ?? 0) - (o.eq_wwed ?? 0);
  o.wwed_minus_wtop = (o.eq_wwed ?? 0) - (o.eq_wtop ?? 0);
  o.wbot_minus_wtop = (o.eq_wbot ?? 0) - (o.eq_wtop ?? 0);
  return o;
});
cases['E2'].notes = 'Final equity parsed from the per-scenario summary tiles; buy counts from the chart\'s buy markers.';

for (const [id, why] of [
  ['E3', 'Not implemented by this runner.'], ['E4', 'Not implemented by this runner.'],
  ['E5', 'Needs two timezone contexts and a full repeat of the setup in each. Not implemented.'],
  ['E6', 'Requires the live market-data worker, unreachable from this sandbox.'],
  ['E7', 'Not implemented by this runner.'], ['E8', 'Not implemented by this runner.'],
  ['E9', 'Not implemented by this runner.'], ['E10', 'Not implemented by this runner.'],
  ['E11', 'Requires the live market-data worker, unreachable from this sandbox.'],
]) if (!cases[id]) cases[id] = { error: why };

emit('dcasimulator', cases, { page_errors: errors.slice(0, 20) });
await browser.close();
