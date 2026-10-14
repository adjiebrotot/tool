/* Portfolio DCA Simulator: Optimise mode audit.

   Optimise mode sweeps up to two settings of one portfolio and runs every
   combination. Its one promise is that a tested value means exactly what the
   same value typed into the form means. So for every setting the mode offers,
   this drives the real page headless and, for sampled values:

     1. opens the scenario in optimise mode and reads what the sweep reports for
        that value: all seven figures off the chart (ROI, final value, net,
        Sharpe, Sortino, CAGR TWR and MWR) and the Detailed Breakdown's full
        daily CSV for that value;
     2. opens the same scenario in plain Simulate mode, sets that value THROUGH
        THE FORM (types the amount, picks the period, clicks the weekday chip,
        fills every weight), presses Simulate, and reads the same figures;
     3. requires them to agree: final value and ROI to 1e-9, the advanced
        metrics as the tiles print them, and the daily CSV cell for cell.

   Weights are swept with a slack; the weights the form is filled with come from
   an independently written split (sorted greedy, not the page's water-fill).
   Then the contracts around it: which fields offer a gauge under each method
   (and which never do), a setting dropped when its field goes away, a period
   and its day setting kept apart, the two-setting limit, the run cap, the
   locked portfolio bar, Cancel, saved state (reload, a file, a file from
   before the mode existed, a file naming settings that no longer exist), and
   no page errors anywhere.

   Prices are the page's own seeded simulated assets, so nothing is fetched;
   Chart.js and Plotly are served from _ref/.libcache/ (run
   node _ref/chart-check.mjs once with network access to fill it).

   Run: node optimise.mjs          (ONLY=<text> runs the cases whose name has it;
                                   JOBS=<n> cases at once, 4 by default) */
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize, basename } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const LIBS = join(ROOT, '_ref', '.libcache');
for (const f of ['chart.umd.min.js', 'chartjs-plugin-zoom.min.js', 'hammer.min.js', 'plotly.min.js'])
  if (!existsSync(join(LIBS, f))) { console.error('Run node _ref/chart-check.mjs once with network access to cache ' + f); process.exit(2); }
const ONLY = process.env.ONLY || '';

let passed = 0, failed = 0;
const fails = [];
function ok(cond, msg, detail){
  if(cond){ passed++; if(process.env.VERBOSE) console.log('  PASS  ' + msg); }
  else { failed++; fails.push(msg); console.log('  FAIL  ' + msg + (detail ? '\n        ' + detail : '')); }
}
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

/* ── the site, served as in production, libraries from the cache ── */
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.txt':'text/plain' };
const server = createServer((req, res) => {
  const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  let f = join(ROOT, rel);
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
  createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const URL_PF = ORIGIN + '/dcasimulator/portfolio/';
const browser = await pw.chromium.launch();
const SAVE_KEY = 'abt:save:dcasimulator-portfolio:v1';

/* Open the page on a scenario, the way a returning reader does: the mini cache
   holds it, and the page restores and runs it on load. */
async function openOn(settings, { vp = { width: 1400, height: 1000 } } = {}){
  const ctx = await browser.newContext({ viewport: vp, acceptDownloads: true });
  await ctx.route('**', route => {
    const u = route.request().url();
    if (u.startsWith(ORIGIN)) return route.continue();
    const b = basename(u.split('?')[0]);
    if (existsSync(join(LIBS, b))) return route.fulfill({ status: 200, contentType: 'text/javascript', body: readFileSync(join(LIBS, b), 'utf8') });
    return route.abort();
  });
  await ctx.addInitScript(([key, blob]) => {
    try {
      if (!sessionStorage.getItem('__seeded')) {
        localStorage.clear();
        if (blob) localStorage.setItem(key, blob);
        sessionStorage.setItem('__seeded', '1');
      }
      Object.keys(localStorage).length;
      localStorage.setItem('abt:ctrl:/dcasimulator/portfolio/', '1');
      ['dcapf-tour-v1-seen', 'dcapf-tour-v2-seen', 'dcapf-tour-v3-seen'].forEach(k => localStorage.setItem(k, '1'));
    } catch (e) {}
  }, [SAVE_KEY, settings ? JSON.stringify({ __fields: {}, __extra: settings }) : null]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL_PF, { waitUntil: 'load' });
  await waitIdle(page);
  return { page, ctx, errors };
}
async function waitIdle(page){
  await page.waitForFunction(() => { const b = document.getElementById('simBtn'); return b && b.dataset.running !== '1'; }, null, { timeout: 120000 });
  await page.waitForTimeout(60);
}
async function closeAll(o){ await o.ctx.close(); }

/* ── scenarios ── */
const SIM_POOL = [{ name: 'Equities', returnPct: 10, stdPct: 18 }, { name: 'Bonds', returnPct: 4, stdPct: 6 }, { name: 'Gold', returnPct: 6, stdPct: 14 }];
const SCHED = (o) => Object.assign({ period: 'monthly', weekdays: [1], weekParity: 0, daysOfMonth: [1], dayOfMonth: 1, quarterStart: 1, month: 1 }, o || {});
const TECH = { fastMaType: 'ema', fastMaLen: 50, slowMaType: 'sma', slowMaLen: 200, rsiPeriod: 14, rsiOversold: 35, bbPeriod: 20, bbStd: 2, bbTrigger: 'below', macdFast: 12, macdSlow: 26, macdSignal: 9, macdHistThreshold: 0, adxPeriod: 14, adxThreshold: 25 };
const trig = (o) => Object.assign({ type: 'pct', direction: 'drop', pct: 10, ref: 'period', period: 'monthly', eom: true, lookback: 60, tech: Object.assign({}, TECH) }, o || {});
function asset(id, i, weight, tr){ const s = SIM_POOL[i]; return { id, type: 'custom', ticker: '', name: s.name, colorSlot: i, weight, returnPct: s.returnPct, stdPct: s.stdPct, trigger: trig(tr) }; }
function scenario(pf, extra){
  const p = Object.assign({ id: 1, name: 'Test', colorSlot: 0, assetIdCounter: 3,
    topup: { amount: 1000, yearlyIncrease: 3 }, topupSched: SCHED({ daysOfMonth: [5] }),
    rf: { mode: 'rate', rate: 2, ticker: '' },
    rebal: { method: 'constant-weight', cwTiming: 'schedule', buyFee: 0.2, sellFee: 0.3, reserveMode: 'cash', reserveAssetId: null, lookbackMonths: 6, rankWeights: [] },
    rebalSched: SCHED({ period: 'quarterly', dayOfMonth: 10, quarterStart: 2 }),
    assets: [asset(1, 0, 50), asset(2, 1, 30), asset(3, 2, 20)] }, pf);
  return Object.assign({ app: 'dca-portfolio', version: 1,
    global: { currencySymbol: '$', randomSeed: 25823952204, execTiming: 'next-open', startDate: '2018-01-01', endDate: '2022-12-31', tickerPool: '', simPool: SIM_POOL },
    activePortfolioId: 1, portfolios: [p] }, extra || {});
}
const deep = o => JSON.parse(JSON.stringify(o));

/* ── the values a range runs, written independently of the page ── */
function rangeValues(r, int, dp = 2){
  let a = +r.start, b = +r.end; if (a > b) [a, b] = [b, a];
  const out = [];
  for (let i = 0; i < r.steps; i++){
    let v = a + (b - a) * i / (r.steps - 1);
    v = int ? Math.round(v) : Math.round(v * 10 ** dp) / 10 ** dp;
    if (!out.length || out[out.length - 1] !== v) out.push(v);
  }
  return out;
}
/* Weights after the swept members move, with the slack taking the difference:
   a named member, or all unswept members in equal shares floored at zero. Every
   weight handed back is shared out first, then named slacks take, then equal
   ones (the rule the page documents). Taking is a sorted greedy pass, a
   different algorithm from the page's water-fill. */
function splitWeights(base, moves){
  const w = base.slice(), swept = new Set(moves.map(m => m.idx));
  const plan = moves.map(m => {
    const named = m.slack !== 'even' && m.slack != null && m.slack >= 0 && !swept.has(m.slack);
    return { d: m.val - w[m.idx], named, pool: named ? [m.slack] : w.map((_, i) => i).filter(i => !swept.has(i)) };
  });
  moves.forEach(m => { w[m.idx] = m.val; });
  for (const x of plan) if (x.d < 0) x.pool.forEach(i => { w[i] += -x.d / x.pool.length; });
  for (const named of [true, false]) for (const x of plan) {
    if (!(x.d > 0) || x.named !== named) continue;
    let rem = x.d, n = x.pool.length;
    for (const i of x.pool.slice().sort((a, b) => w[a] - w[b])){
      const share = rem / n;
      if (w[i] <= share){ rem -= w[i]; w[i] = 0; } else { w[i] -= share; rem -= share; }
      n--;
    }
    if (rem > 1e-6) return null;
  }
  return w;
}

/* ── reading the page ── */
const METRICS = ['roi', 'final', 'net', 'sharpe', 'sortino', 'twr', 'mwr'];
const PCT = new Set(['roi', 'twr', 'mwr']);
// Every tested value's figures, off the chart the reader sees: the line (one
// setting) or the surface (two), one metric at a time.
async function readSweep(page){
  const two = await page.evaluate(() => document.getElementById('optSurface').style.display !== 'none');
  const out = {};
  for (const k of METRICS){
    await page.selectOption('#optMetric', k);
    if (two){
      await page.waitForFunction(k => { const d = document.getElementById('optSurface'); const t = d && d.data && d.data[0] && d.data[0].colorbar && d.data[0].colorbar.title && d.data[0].colorbar.title.text; return t && t.toLowerCase().indexOf({roi:'roi', final:'final', net:'net', sharpe:'sharpe', sortino:'sortino', twr:'twr', mwr:'mwr'}[k]) >= 0; }, k, { timeout: 30000 });
      out[k] = await page.evaluate(() => document.getElementById('optSurface').data[0].z.map(r => r.slice()));
    } else {
      out[k] = await page.evaluate(() => window.Chart.getChart(document.getElementById('valueCanvas')).data.datasets[0].data.map(p => (p && typeof p === 'object') ? p.y : p));
    }
    if (PCT.has(k)) out[k] = two ? out[k].map(r => r.map(v => v == null ? null : v / 100)) : out[k].map(v => v == null ? null : v / 100);
  }
  out.two = two;
  return out;
}
async function csvNow(page){
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#downloadBtn')]);
  return readFileSync(await dl.path(), 'utf8');
}
// A plain Simulate run's figures: final value and top-ups off the value chart
// (full precision), the advanced metrics as the tile prints them.
async function readSim(page){
  return page.evaluate(() => {
    const ds = window.Chart.getChart(document.getElementById('valueCanvas')).data.datasets;
    const fin = ds[0].data[ds[0].data.length - 1], dep = ds[1].data[ds[1].data.length - 1];
    const adv = [...document.querySelectorAll('#summaryGrid .tile .adv-metrics b')].map(b => b.textContent.trim());
    return { final: fin, dep, net: fin - dep, roi: dep > 0 ? (fin - dep) / dep : 0, adv };
  });
}
const advText = m => [m.sharpe, m.sortino].map(v => (v == null || !isFinite(v)) ? '-' : v.toFixed(2))
  .concat([m.twr, m.mwr].map(v => (v == null || !isFinite(v)) ? '-' : (v * 100).toFixed(2) + '%'));
function csvSame(a, b){
  const A = a.trim().split('\n'), B = b.trim().split('\n');
  if (A.length !== B.length) return 'rows ' + A.length + ' vs ' + B.length;
  if (A[0] !== B[0]) return 'header ' + A[0] + ' vs ' + B[0];
  for (let i = 1; i < A.length; i++){
    if (A[i] === B[i]) continue;
    const x = A[i].split(','), y = B[i].split(',');
    if (x.length !== y.length) return 'row ' + i + ' width';
    for (let c = 0; c < x.length; c++){
      if (x[c] === y[c]) continue;
      const nx = parseFloat(x[c]), ny = parseFloat(y[c]);
      // A cell printed to 2 decimals can land either side of a half cent when the
      // weights behind it differ in the 10th decimal; anything more is a mismatch.
      if (!(isFinite(nx) && isFinite(ny) && Math.abs(nx - ny) <= 0.011 + 1e-9 * Math.abs(nx))) return 'row ' + i + ' col ' + c + ': ' + x[c] + ' vs ' + y[c];
    }
  }
  return '';
}

/* ── setting a value through the form, as a reader would ── */
async function tab(page, name){ await page.click(`.ctrl-tab[data-tab="${name}"]`); }
async function sub(page, name){ await tab(page, 'portfolios'); await page.click(`.sub-tab[data-sub="${name}"]`); }
async function fill(page, sel, v){ await page.fill(sel, String(v)); await page.dispatchEvent(sel, 'change'); }
async function schedSet(page, which, f, v, sc){
  const box = which === 'rebalSched' ? 'rebalScheduleBox' : 'topupScheduleBox';
  await sub(page, which === 'rebalSched' ? 'rebal' : 'topups');
  const per = sc.portfolios[0][which].period;
  if (f === 'period') return page.selectOption(which === 'rebalSched' ? '#rebalPeriod' : '#topupPeriod', { value: String(v) });
  if (f === 'dom') return fill(page, `#${box}_dom`, v);
  if (f === 'quarterStart') return page.selectOption(`#${box}_qs`, { value: String(v) });
  if (f === 'month') return page.selectOption(`#${box}_mon`, { value: String(v) });
  if (f === 'parity') return page.click(`#${box} .weekday-chip[data-wp="${v}"]`);
  if (f === 'weekday'){
    const cur = sc.portfolios[0][which].weekdays[0];
    if (cur === v) return;
    await page.click(`#${box} .weekday-chip[data-wd="${v}"]`);
    await page.click(`#${box} .weekday-chip[data-wd="${cur}"]`);
    return;
  }
  throw new Error('no driver for ' + which + '.' + f + ' (' + per + ')');
}
async function setByForm(page, key, v, sc, ctx){
  const p = sc.portfolios[0];
  let m;
  if (key === 'topup.amount'){ await sub(page, 'topups'); return fill(page, '#topupAmount', v); }
  if (key === 'topup.yearlyIncrease'){ await sub(page, 'topups'); return fill(page, '#topupYearlyInc', v); }
  if (key === 'rf.rate'){ await sub(page, 'topups'); return fill(page, '#rfRate', v); }
  if (key === 'rebal.buyFee'){ await sub(page, 'rebal'); return fill(page, '#buyFee', v); }
  if (key === 'rebal.sellFee'){ await sub(page, 'rebal'); return fill(page, '#sellFee', v); }
  if (key === 'rebal.lookbackMonths'){ await sub(page, 'rebal'); return page.selectOption('#lookbackMonths', { value: String(v) }); }
  if (key === 'execTiming'){ await tab(page, 'settings'); return page.selectOption('#execTiming', { value: String(v) }); }
  if ((m = /^(topupSched|rebalSched)\.(\w+)$/.exec(key))) return schedSet(page, m[1], m[2], v, sc);
  if ((m = /^trig:(\d+):(\w+)$/.exec(key))){
    await sub(page, 'rebal');
    const aid = m[1], f = m[2];
    if (f === 'pct') return fill(page, `#triggerTableWrap .trig-pct[data-aid="${aid}"]`, v);
    if (f === 'lookback') return fill(page, `#triggerTableWrap .trig-lookback[data-aid="${aid}"]`, v);
    if (f === 'from') return page.selectOption(`#triggerTableWrap .trig-period[data-role="ref"][data-aid="${aid}"]`, { value: String(v) });
    if (f === 'freq') return page.selectOption(`#triggerTableWrap .trig-period[data-role="freq"][data-aid="${aid}"]`, { value: String(v) });
    return fill(page, `#triggerTableWrap .ttk[data-aid="${aid}"][data-k="${f}"]`, v);
  }
  throw new Error('no form driver for ' + key);
}
// Weights are a group: the form gets every member, the split worked out here.
async function setWeightsByForm(page, sc, vars, vals){
  const p = sc.portfolios[0];
  const wMoves = [], rMoves = [];
  vars.forEach((v, k) => {
    let m;
    if ((m = /^weight:(\d+)$/.exec(v.key))){ const ids = p.assets.map(a => a.id); wMoves.push({ idx: ids.indexOf(+m[1]), val: vals[k], slack: v.slack == null || v.slack === 'even' ? 'even' : ids.indexOf(+v.slack) }); }
    if ((m = /^rank:(\d+)$/.exec(v.key))) rMoves.push({ idx: +m[1], val: vals[k], slack: v.slack == null || v.slack === 'even' ? 'even' : +v.slack });
  });
  if (wMoves.length){
    const w = splitWeights(p.assets.map(a => a.weight), wMoves);
    if (!w) return false;
    await sub(page, 'rebal');
    for (let i = 0; i < p.assets.length; i++) await page.fill('#wt' + p.assets[i].id, String(w[i]));
  }
  if (rMoves.length){
    const base = p.rebal.rankWeights.length ? p.rebal.rankWeights.slice() : p.assets.map(() => 100 / p.assets.length);
    const w = splitWeights(base, rMoves);
    if (!w) return false;
    await sub(page, 'rebal');
    for (let i = 0; i < w.length; i++) await page.fill('#rw' + i, String(w[i]));
  }
  return true;
}

/* ── one case: a sweep, checked value by value against the form ── */
const listOpts = {
  'rebal.lookbackMonths': [1, 3, 6, 12], execTiming: ['close', 'next-open', 'next-close'],
  period: ['weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly'], weekday: [1, 2, 3, 4, 5], parity: [0, 1],
  quarterStart: [1, 2, 3], month: [1,2,3,4,5,6,7,8,9,10,11,12], from: null, freq: ['monthly', 'weekly']
};
function valuesOf(v){
  const k = v.key, f = k.split(/[.:]/).pop();
  let L = null;
  if (k === 'rebal.lookbackMonths') L = [1, 3, 6, 12];
  else if (k === 'execTiming') L = ['close', 'next-open', 'next-close'];
  else if (/Sched\.(period|weekday|parity|quarterStart|month)$/.test(k))
    L = { period: ['weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly'], weekday: [1, 2, 3, 4, 5], parity: [0, 1], quarterStart: [1, 2, 3], month: [1,2,3,4,5,6,7,8,9,10,11,12] }[f];
  else if (/:freq$/.test(k)) L = ['monthly', 'weekly'];
  else if (/:from$/.test(k)) L = ['monthly', 'weekly'].includes(v.start) ? ['monthly', 'weekly'] : ['top', 'bottom'];
  if (L){ const a = L.indexOf(v.start), b = L.indexOf(v.end); return L.slice(Math.min(a, b), Math.max(a, b) + 1); }
  return rangeValues(v, /dom$|lookback$|Period$|Len$|macd(Fast|Slow|Signal)$|Oversold$|Threshold$/.test(k));
}
async function runCase(c){
  if (ONLY && !c.name.includes(ONLY)) return;
  const t0 = Date.now();
  const sc = c.scenario;
  const vars = c.vars;
  const opt = await openOn(Object.assign(deep(sc), { optimise: { vars, metric: 'roi' } }));
  const { page } = opt;
  if (vars.length === 2) await page.waitForFunction(() => { const d = document.getElementById('optSurface'); return d && d.data && d.data.length; }, null, { timeout: 30000 });
  ok(await page.evaluate(() => document.getElementById('valueTitle').textContent.startsWith('Optimisation')), c.name + ': opens and runs in optimise mode');
  const vals = vars.map(v => valuesOf(v));
  const pickCounts = await page.evaluate(() => [...document.querySelectorAll('#optPickWrap select')].map(s => s.options.length));
  ok(JSON.stringify(pickCounts) === JSON.stringify(vals.map(a => a.length)), c.name + ': the sweep runs the values its range names', `${pickCounts} vs ${vals.map(a => a.length)}`);
  const sweep = await readSweep(page);
  const n0 = vals[0].length;
  const at = (k, i, j) => sweep.two ? sweep[k][j][i] : sweep[k][i];
  // Which combinations to replay through the form.
  const picks = [];
  const sample = n => n <= 4 ? [...Array(n).keys()] : [0, Math.floor(n / 2), n - 1];
  if (vars.length === 1) sample(n0).forEach(i => picks.push([i]));
  else { const s0 = sample(n0), s1 = sample(vals[1].length); picks.push([s0[0], s1[s1.length - 1]], [s0[s0.length - 1], s1[0]], [s0[Math.floor(s0.length / 2)], s1[Math.floor(s1.length / 2)]]); }
  const optCsv = [];
  for (const pk of picks){
    for (let k = 0; k < pk.length; k++) await page.selectOption('#optPick' + k, { index: pk[k] });
    const skipped = await page.evaluate(() => document.getElementById('optPickStatus').textContent);
    optCsv.push(skipped ? null : await csvNow(page));
  }
  const optErrors = opt.errors.slice();
  await closeAll(opt);
  for (let n = 0; n < picks.length; n++){
    const pk = picks[n], v = pk.map((i, k) => vals[k][i]);
    const label = vars.map((x, k) => x.key + '=' + v[k]).join(', ');
    const sim = await openOn(deep(sc));
    const sp = sim.page;
    // Set the values through the form: plain fields first, a period after (the
    // form rescales a typed amount when the period moves), weights as a group.
    const order = vars.map((x, k) => k).sort((a, b) => (/\.period$/.test(vars[a].key) ? 1 : 0) - (/\.period$/.test(vars[b].key) ? 1 : 0));
    let feasible = true;
    if (vars.some(x => /^(weight|rank):/.test(x.key))) feasible = await setWeightsByForm(sp, sc, vars, v);
    for (const k of order) if (!/^(weight|rank):/.test(vars[k].key)) await setByForm(sp, vars[k].key, v[k], sc);
    const finalOpt = at('final', pk[0], pk[1]);
    if (!feasible){
      ok(finalOpt == null && optCsv[n] == null, `${c.name}: ${label} cannot add up to 100%, and the sweep skipped it`);
      await closeAll(sim); continue;
    }
    await sp.click('#simBtn');
    await waitIdle(sp);
    const s = await readSim(sp);
    const csv = await csvNow(sp);
    ok(finalOpt != null && near(finalOpt, s.final), `${c.name}: ${label} final value matches Simulate`, `${finalOpt} vs ${s.final}`);
    ok(near(at('roi', pk[0], pk[1]), s.roi) && near(at('net', pk[0], pk[1]), s.net, 1e-8), `${c.name}: ${label} ROI and net match Simulate`, `${at('roi', pk[0], pk[1])} vs ${s.roi}`);
    const m = { sharpe: at('sharpe', pk[0], pk[1]), sortino: at('sortino', pk[0], pk[1]), twr: at('twr', pk[0], pk[1]), mwr: at('mwr', pk[0], pk[1]) };
    ok(JSON.stringify(advText(m)) === JSON.stringify(s.adv.map(t => t.replace(/^\s*-\s*$/, '-'))), `${c.name}: ${label} Sharpe, Sortino and both CAGRs match Simulate`, `${advText(m)} vs ${s.adv}`);
    const diff = optCsv[n] ? csvSame(optCsv[n], csv) : 'the sweep skipped it';
    ok(!diff, `${c.name}: ${label} the breakdown's daily CSV matches Simulate's`, diff);
    ok(sim.errors.length === 0, `${c.name}: ${label} no page errors in Simulate`, sim.errors.join(' | '));
    await closeAll(sim);
  }
  ok(optErrors.length === 0, c.name + ': no page errors in optimise mode', optErrors.join(' | '));
  console.log(`  done  ${c.name} (${picks.length} values replayed, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}

/* ── the cases: every setting the mode offers ── */
const S = {};
S.cw = scenario();                                                     // constant weight, separate schedule (quarterly)
S.cwRebalMonthly = scenario({ rebalSched: SCHED({ period: 'monthly', daysOfMonth: [12] }) });
S.cwRebalWeekly = scenario({ rebalSched: SCHED({ period: 'weekly', weekdays: [3] }) });
S.cwRebalFortnight = scenario({ rebalSched: SCHED({ period: 'fortnightly', weekdays: [2], weekParity: 1 }) });
S.cwRebalYearly = scenario({ rebalSched: SCHED({ period: 'yearly', month: 6, dayOfMonth: 15 }) });
S.topWeekly = scenario({ topup: { amount: 250, yearlyIncrease: 0 }, topupSched: SCHED({ period: 'weekly', weekdays: [3] }) });
S.topFortnight = scenario({ topup: { amount: 500, yearlyIncrease: 0 }, topupSched: SCHED({ period: 'fortnightly', weekdays: [4], weekParity: 0 }) });
S.topQuarterly = scenario({ topup: { amount: 3000, yearlyIncrease: 0 }, topupSched: SCHED({ period: 'quarterly', quarterStart: 3, dayOfMonth: 20 }) });
S.topYearly = scenario({ topup: { amount: 12000, yearlyIncrease: 0 }, topupSched: SCHED({ period: 'yearly', month: 4, dayOfMonth: 8 }) });
S.tw = scenario({ rebal: Object.assign({}, scenario().portfolios[0].rebal, { method: 'towards-weight' }) });
S.ca = scenario({ rebal: Object.assign({}, scenario().portfolios[0].rebal, { method: 'constant-allocation' }) });
S.cwTopup = scenario({ rebal: Object.assign({}, scenario().portfolios[0].rebal, { cwTiming: 'at-topup' }) });
S.mom = scenario({ rebal: Object.assign({}, scenario().portfolios[0].rebal, { method: 'dynamic-momentum', lookbackMonths: 6, rankWeights: [50, 30, 20] }) });
const RULE = Object.assign({}, scenario().portfolios[0].rebal, { method: 'rule-trigger', reserveMode: 'cash' });
const ruleWith = (t3, extra) => scenario(Object.assign({ rebal: RULE, assets: [
  asset(1, 0, 50, { type: 'pct', direction: 'drop', pct: 8, ref: 'period', period: 'monthly', eom: true }),
  asset(2, 1, 30, { type: 'pct', direction: 'rise', pct: 5, ref: 'top', lookback: 40 }),
  asset(3, 2, 20, t3)] }, extra || {}));
S.rule = ruleWith({ type: 'tech-rsi', period: 'weekly', eom: true });
S.ruleMa = ruleWith({ type: 'tech-ma-cross', period: 'monthly', eom: false, tech: Object.assign({}, TECH, { fastMaLen: 20, slowMaLen: 60 }) });
S.ruleBb = ruleWith({ type: 'tech-bollinger', period: 'monthly', eom: true });
S.ruleMacd = ruleWith({ type: 'tech-macd-cross', period: 'weekly', eom: true });
S.ruleHist = ruleWith({ type: 'tech-macd-hist', period: 'monthly', eom: false });
S.ruleAdx = ruleWith({ type: 'tech-adx', period: 'monthly', eom: true });
S.ruleAsset = scenario({ rebal: Object.assign({}, RULE, { reserveMode: 'asset', reserveAssetId: 2 }), assets: [
  asset(1, 0, 50, { type: 'pct', direction: 'drop', pct: 6, ref: 'bottom', lookback: 30 }), asset(2, 1, 30), asset(3, 2, 20, { type: 'at-topup' })] });
const V = (key, start, end, steps, slack) => Object.assign({ key, start, end, steps: steps || 2 }, slack != null ? { slack } : {});

const CASES = [
  // the top-up
  { name: 'Amount per top-up',            scenario: S.cw, vars: [V('topup.amount', 500, 2500, 5)] },
  { name: 'Yearly increase',              scenario: S.cw, vars: [V('topup.yearlyIncrease', 0, 12, 4)] },
  { name: 'Top-up period (amount follows)', scenario: S.cw, vars: [V('topupSched.period', 'weekly', 'yearly')] },
  { name: 'Top-up day of month, monthly',  scenario: S.cw, vars: [V('topupSched.dom', 1, 28, 4)] },
  { name: 'Top-up weekday, weekly',        scenario: S.topWeekly, vars: [V('topupSched.weekday', 1, 5)] },
  { name: 'Top-up weekday, fortnightly',   scenario: S.topFortnight, vars: [V('topupSched.weekday', 2, 5)] },
  { name: 'Top-up week, fortnightly',      scenario: S.topFortnight, vars: [V('topupSched.parity', 0, 1)] },
  { name: 'Top-up months, quarterly',      scenario: S.topQuarterly, vars: [V('topupSched.quarterStart', 1, 3)] },
  { name: 'Top-up day of month, quarterly', scenario: S.topQuarterly, vars: [V('topupSched.dom', 3, 27, 3)] },
  { name: 'Top-up month, yearly',          scenario: S.topYearly, vars: [V('topupSched.month', 1, 12)] },
  { name: 'Top-up day of month, yearly',   scenario: S.topYearly, vars: [V('topupSched.dom', 1, 25, 3)] },
  // cash and costs
  { name: 'Risk-free rate',               scenario: S.cw, vars: [V('rf.rate', 0, 6, 4)] },
  { name: 'Buying fee',                   scenario: S.cw, vars: [V('rebal.buyFee', 0, 1, 3)] },
  { name: 'Selling fee',                  scenario: S.cw, vars: [V('rebal.sellFee', 0, 1.5, 4)] },
  { name: 'Trade at',                     scenario: S.cw, vars: [V('execTiming', 'close', 'next-close')] },
  // the rebalance schedule
  { name: 'Rebalance period',             scenario: S.cw, vars: [V('rebalSched.period', 'weekly', 'yearly')] },
  { name: 'Rebalance months, quarterly',  scenario: S.cw, vars: [V('rebalSched.quarterStart', 1, 3)] },
  { name: 'Rebalance day, quarterly',     scenario: S.cw, vars: [V('rebalSched.dom', 2, 26, 3)] },
  { name: 'Rebalance day, monthly',       scenario: S.cwRebalMonthly, vars: [V('rebalSched.dom', 1, 28, 3)] },
  { name: 'Rebalance weekday, weekly',    scenario: S.cwRebalWeekly, vars: [V('rebalSched.weekday', 1, 5)] },
  { name: 'Rebalance week, fortnightly',  scenario: S.cwRebalFortnight, vars: [V('rebalSched.parity', 0, 1)] },
  { name: 'Rebalance month, yearly',      scenario: S.cwRebalYearly, vars: [V('rebalSched.month', 2, 11)] },
  // weights and their slack, under every weight method
  { name: 'Weight, constant weight, even slack', scenario: S.cw, vars: [V('weight:1', 0, 100, 5, 'even')] },
  { name: 'Weight, named slack (some skipped)', scenario: S.cw, vars: [V('weight:2', 0, 60, 4, 3)] },
  { name: 'Weight, constant weight at top-up', scenario: S.cwTopup, vars: [V('weight:3', 0, 50, 3, 'even')] },
  { name: 'Weight, towards weight',       scenario: S.tw, vars: [V('weight:1', 20, 80, 3, 'even')] },
  { name: 'Weight, constant allocation',  scenario: S.ca, vars: [V('weight:2', 10, 70, 3, 1)] },
  { name: 'Weight, rule-based',           scenario: S.rule, vars: [V('weight:1', 30, 90, 3, 'even')] },
  // trend following
  { name: 'Momentum lookback',            scenario: S.mom, vars: [V('rebal.lookbackMonths', 1, 12)] },
  { name: 'Rank weight, even slack',      scenario: S.mom, vars: [V('rank:0', 20, 100, 5, 'even')] },
  { name: 'Rank weight, named slack',     scenario: S.mom, vars: [V('rank:1', 0, 50, 3, 2)] },
  // rule-based triggers
  { name: 'Trigger falls by',             scenario: S.rule, vars: [V('trig:1:pct', 2, 14, 4)] },
  { name: 'Trigger from, calendar',       scenario: S.rule, vars: [V('trig:1:from', 'monthly', 'weekly')] },
  { name: 'Trigger rises by, rolling',    scenario: S.rule, vars: [V('trig:2:pct', 1, 9, 3)] },
  { name: 'Trigger lookback',             scenario: S.rule, vars: [V('trig:2:lookback', 10, 90, 3)] },
  { name: 'Trigger from, rolling',        scenario: S.rule, vars: [V('trig:2:from', 'top', 'bottom')] },
  { name: 'Trigger frequency',            scenario: S.rule, vars: [V('trig:3:freq', 'monthly', 'weekly')] },
  { name: 'RSI period',                   scenario: S.rule, vars: [V('trig:3:rsiPeriod', 5, 30, 4)] },
  { name: 'RSI oversold level',           scenario: S.rule, vars: [V('trig:3:rsiOversold', 20, 50, 4)] },
  { name: 'MA fast length',               scenario: S.ruleMa, vars: [V('trig:3:fastMaLen', 5, 40, 3)] },
  { name: 'MA slow length',               scenario: S.ruleMa, vars: [V('trig:3:slowMaLen', 50, 150, 3)] },
  { name: 'Bollinger period',             scenario: S.ruleBb, vars: [V('trig:3:bbPeriod', 10, 40, 3)] },
  { name: 'Bollinger std dev',            scenario: S.ruleBb, vars: [V('trig:3:bbStd', 1, 3, 3)] },
  { name: 'MACD fast EMA',                scenario: S.ruleMacd, vars: [V('trig:3:macdFast', 6, 18, 3)] },
  { name: 'MACD slow EMA',                scenario: S.ruleMacd, vars: [V('trig:3:macdSlow', 20, 40, 3)] },
  { name: 'MACD signal',                  scenario: S.ruleHist, vars: [V('trig:3:macdSignal', 5, 15, 3)] },
  { name: 'ADX period',                   scenario: S.ruleAdx, vars: [V('trig:3:adxPeriod', 7, 28, 3)] },
  { name: 'ADX threshold',                scenario: S.ruleAdx, vars: [V('trig:3:adxThreshold', 15, 40, 3)] },
  { name: 'Trigger falls by, asset reserve', scenario: S.ruleAsset, vars: [V('trig:1:pct', 3, 12, 3)] },
  { name: 'Trigger lookback, previous bottom', scenario: S.ruleAsset, vars: [V('trig:1:lookback', 10, 60, 3)] },
  // two settings at once
  { name: 'Two: amount x top-up period',  scenario: S.cw, vars: [V('topup.amount', 500, 1500, 3), V('topupSched.period', 'monthly', 'quarterly')] },
  { name: 'Two: weight x RSI period',     scenario: S.rule, vars: [V('weight:1', 20, 80, 3, 'even'), V('trig:3:rsiPeriod', 7, 21, 3)] },
  { name: 'Two: two weights, Gold as the only slack', scenario: S.cw, vars: [V('weight:1', 40, 70, 3, 'even'), V('weight:2', 10, 40, 3, 'even')] },
  { name: 'Two: rank x lookback',         scenario: S.mom, vars: [V('rank:0', 30, 70, 3, 'even'), V('rebal.lookbackMonths', 3, 12)] },
  { name: 'Two: rebalance day x buying fee', scenario: S.cw, vars: [V('rebalSched.dom', 1, 20, 3), V('rebal.buyFee', 0, 0.5, 3)] },
];

/* ── the sweep's own arithmetic, lifted from the page and fuzzed ── */
function liftFns(names){
  const src = readFileSync(join(ROOT, 'dcasimulator', 'portfolio', 'script.js'), 'utf8');
  const end = open => { let d = 0; for (let j = open; j < src.length; j++){ const c = src[j];
    if (c === '/' && src[j + 1] === '/'){ j = src.indexOf('\n', j); continue; }
    if (c === '/' && src[j + 1] === '*'){ j = src.indexOf('*/', j + 2) + 1; continue; }
    if (c === "'" || c === '"' || c === '`'){ for (j++; j < src.length && src[j] !== c; j++) if (src[j] === '\\') j++; continue; }
    if (c === '{') d++; else if (c === '}'){ d--; if (!d) return j; } } return -1; };
  return names.map(n => {
    let m = new RegExp('^function ' + n + '\\(', 'm').exec(src);
    if (m){ const o = src.indexOf('{', src.indexOf(')', m.index)); return src.slice(m.index, end(o) + 1); }
    m = new RegExp('^const ' + n + ' *=.*$', 'm').exec(src);
    if (!m) throw new Error(n + ' not found in the page');
    return m[0];
  }).join('\n');
}
function units(){
  if (ONLY && !'units'.includes(ONLY)) return;
  console.log('\nunits (lifted from the page)');
  const code = liftFns(['OPT_MAX_STEPS', 'optClamp', 'optRound', 'optValues', 'applyWeightGroup']);
  const U = new Function(code + '\nreturn {optValues, applyWeightGroup};')();
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  let agree = 0, sums = 0, floors = 0, orderFree = 0, total = 0, nulls = 0;
  for (let t = 0; t < 2000; t++){
    const n = 2 + Math.floor(rnd() * 4);
    let base = Array.from({ length: n }, () => rnd() < 0.15 ? 0 : rnd());
    const sum = base.reduce((a, b) => a + b, 0) || 1; base = base.map(x => x / sum * 100);
    const k = n > 2 && rnd() < 0.5 ? 2 : 1;
    const idx = []; while (idx.length < k){ const i = Math.floor(rnd() * n); if (!idx.includes(i)) idx.push(i); }
    const moves = idx.map(i => {
      const others = [...Array(n).keys()].filter(j => !idx.includes(j));
      const slack = rnd() < 0.6 || !others.length ? 'even' : others[Math.floor(rnd() * others.length)];
      return { idx: i, val: Math.round(rnd() * 1000) / 10, slack };
    });
    const a = U.applyWeightGroup(base, moves), b = splitWeights(base, moves);
    total++;
    if ((a === null) === (b === null) && (a === null || a.every((x, i) => Math.abs(x - b[i]) < 1e-7))) agree++;
    if (a){ if (Math.abs(a.reduce((x, y) => x + y, 0) - 100) < 1e-7) sums++; if (a.every(x => x >= 0)) floors++; moves.forEach(m => { if (a[m.idx] !== m.val) floors = -1e9; }); }
    else { sums++; floors++; nulls++; }
    const r = U.applyWeightGroup(base, moves.slice().reverse());
    if ((r === null) === (a === null) && (a === null || a.every((x, i) => Math.abs(x - r[i]) < 1e-7))) orderFree++;
  }
  ok(agree === total, `slack split agrees with an independent one in ${agree} of ${total} random cases (${nulls} impossible)`);
  ok(sums === total, 'every split adds back up to what it added up to');
  ok(floors === total, 'no weight goes below zero and every swept weight lands exactly on its value');
  ok(orderFree === total, `the order two settings were picked in never changes the split (${orderFree} of ${total})`);
  const even2 = U.applyWeightGroup([60, 30, 10], [{ idx: 0, val: 90, slack: 'even' }]);
  ok(even2 && even2.join() === '90,10,0', 'equal shares stop a weight at zero and the other carries the rest', String(even2));
  ok(U.applyWeightGroup([50, 30, 20], [{ idx: 1, val: 60, slack: 2 }]) === null, 'a named slack that cannot cover the move makes the run impossible');
  const offset = U.applyWeightGroup([50, 30, 20], [{ idx: 0, val: 80, slack: 'even' }, { idx: 1, val: 10, slack: 'even' }]);
  ok(offset && offset.join() === '80,10,10', 'two moves that offset each other run, however they were picked', String(offset));
  const num = { kind: 'num', min: 0, max: 100, dp: 2 }, int = { kind: 'num', min: 1, max: 31, int: true };
  ok(U.optValues(num, { start: 0, end: 100, steps: 11 }).join() === '0,10,20,30,40,50,60,70,80,90,100', 'a range runs evenly spaced values, both ends included');
  ok(U.optValues(num, { start: 100, end: 0, steps: 3 }).join() === '0,50,100', 'a range typed backwards runs low to high');
  ok(U.optValues(int, { start: 1, end: 4, steps: 10 }).join() === '1,2,3,4', 'a whole-number field never runs a value twice');
  ok(U.optValues(num, { start: 0, end: 1, steps: 4 }).join() === '0,0.33,0.67,1', 'a value runs at the precision its field shows');
  ok(U.optValues(num, { start: -5, end: 500, steps: 2 }).join() === '0,100', 'a range past the field\'s bounds is pulled back inside');
  ok(U.optValues(num, { start: 0, end: 10, steps: 999 }).length === 50, 'no setting runs more than 50 values');
  const list = { kind: 'list', options: [{ v: 1 }, { v: 3 }, { v: 6 }, { v: 12 }] };
  ok(U.optValues(list, { start: 12, end: 3, steps: 2 }).join() === '3,6,12', 'a list runs every option between its ends');
  ok(U.optValues(list, { start: 2, end: 6 }).length === 0, 'a list end that is not an option runs nothing');
}
units();

// Cases run side by side in their own browser contexts (JOBS=1 for one at a time).
{
  const queue = CASES.slice(), JOBS = Math.max(1, +process.env.JOBS || 4);
  await Promise.all(Array.from({ length: JOBS }, async () => { while (queue.length) await runCase(queue.shift()); }));
}

/* ── contracts around the sweep ── */
async function contracts(){
  if (ONLY && !'contracts'.includes(ONLY) && !ONLY.includes('contract')) return;
  console.log('\ncontracts');
  // Which fields offer a gauge, method by method. Anything that would change the
  // fields around it never does.
  const gaugesOn = async (sc, subName) => {
    const o = await openOn(deep(sc));
    await sub(o.page, subName || 'rebal');
    const all = await o.page.evaluate(() => [...document.querySelectorAll('.opt-btn')].filter(b => !b.hidden).map(b => b.dataset.opt).sort());
    const errs = o.errors.slice();
    await closeAll(o);
    return { all, errs };
  };
  let g = await gaugesOn(S.cw);
  ok(['weight:1', 'weight:2', 'weight:3', 'rebalSched.period', 'rebalSched.quarterStart', 'rebalSched.dom', 'topup.amount', 'topupSched.period', 'topupSched.dom', 'rf.rate', 'execTiming', 'rebal.buyFee', 'rebal.sellFee', 'topup.yearlyIncrease'].every(k => g.all.includes(k)),
    'constant weight on a schedule offers weights, fees, both schedules, cash rate and Trade at', g.all.join(' '));
  ok(!g.all.some(k => /^rank:|lookbackMonths|^trig:/.test(k)), 'constant weight offers no rank, lookback or trigger gauge');
  g = await gaugesOn(S.cwTopup);
  ok(!g.all.some(k => k.startsWith('rebalSched.')), 'Rebalance Timing at top-up offers no rebalance-schedule gauge');
  g = await gaugesOn(S.mom);
  ok(['rank:0', 'rank:1', 'rank:2', 'rebal.lookbackMonths'].every(k => g.all.includes(k)) && !g.all.some(k => k.startsWith('weight:')), 'trend following offers rank weights and the lookback, no target weights', g.all.join(' '));
  g = await gaugesOn(S.rule);
  ok(['trig:1:pct', 'trig:1:from', 'trig:2:pct', 'trig:2:lookback', 'trig:2:from', 'trig:3:freq', 'trig:3:rsiPeriod', 'trig:3:rsiOversold'].every(k => g.all.includes(k)), 'rule-based offers each trigger\'s numbers, anchor and frequency', g.all.join(' '));
  ok(!g.all.includes('trig:1:lookback'), 'a calendar anchor offers no lookback gauge (it has no lookback)');
  ok(!g.all.some(k => /:(macd|adx|bb|fastMa|slowMa)/.test(k)), 'a trigger offers only its own type\'s numbers');
  const typeGauge = await (async () => { const o = await openOn(deep(S.rule)); await sub(o.page, 'rebal');
    const r = await o.page.evaluate(() => ({ type: !!document.querySelector('.trig-type')?.closest('.param-row')?.querySelector('.opt-btn'),
      dir: !!document.querySelector('.trig-dir')?.closest('.param-row')?.querySelector('.opt-btn'),
      method: !!document.querySelector('#methodList .opt-btn, #methodCollapsed .opt-btn'), reserve: !!document.querySelector('#ruleOpts > .field-label .opt-btn'),
      timing: !!document.querySelector('#constantWeightOpts .opt-btn:not([data-opt^="rebalSched"])') }));
    await closeAll(o); return r; })();
  ok(!typeGauge.type && !typeGauge.dir && !typeGauge.method && !typeGauge.reserve && !typeGauge.timing, 'trigger type and direction, the method, the reserve and Rebalance Timing are never offered', JSON.stringify(typeGauge));
  g = await gaugesOn(S.ruleAsset);
  ok(!g.all.some(k => k.startsWith('trig:2:')), 'the reserve asset has no trigger gauges');
  const rfT = deep(S.cw); rfT.portfolios[0].rf = { mode: 'ticker', rate: 0, ticker: 'BIL' };
  g = await gaugesOn(rfT, 'topups');
  ok(!g.all.includes('rf.rate'), 'a risk-free ticker offers no rate gauge');
  const two = deep(S.cw); two.portfolios[0].topupSched.daysOfMonth = [1, 15];
  g = await gaugesOn(two, 'topups');
  ok(!g.all.includes('topupSched.dom'), 'two days of month are not one setting, so no day gauge');

  // The mode on the form: open a gauge, the bar locks, the gate turns.
  let o = await openOn(deep(Object.assign(deep(S.cw), { portfolios: [deep(S.cw).portfolios[0], Object.assign(deep(S.cw).portfolios[0], { id: 2, name: 'Other' })] })));
  let p = o.page;
  await sub(p, 'topups');
  const before = await p.evaluate(() => ({ btn: document.getElementById('simBtn').textContent, cancel: getComputedStyle(document.getElementById('optCancelBtn')).display }));
  ok(before.btn === '▶ Simulate' && before.cancel === 'none', 'comparing: ▶ Simulate, no Cancel');
  await p.click('.opt-btn[data-opt="topup.amount"]');
  const modal = await p.evaluate(() => ({ open: !document.getElementById('optModal').hidden, title: document.getElementById('optModalTitle').textContent,
    start: document.getElementById('optStart').value, end: document.getElementById('optEnd').value, steps: document.getElementById('optSteps').value }));
  ok(modal.open && modal.title === 'Optimise Amount per top-up' && modal.start === '500' && modal.end === '1,500' && modal.steps === '11', 'a gauge opens the range editor on half to one and a half times the value', JSON.stringify(modal));
  await p.keyboard.press('Escape');
  const mode = await p.evaluate(() => ({ open: !document.getElementById('optModal').hidden, btn: document.getElementById('simBtn').textContent,
    cls: document.getElementById('simBtn').classList.contains('is-opt'), cancel: getComputedStyle(document.getElementById('optCancelBtn')).display,
    locked: document.querySelector('.pf-bar').classList.contains('is-locked'), addDis: document.getElementById('addPortfolioBtn').disabled,
    row: document.getElementById('topupAmount').closest('.field-row').classList.contains('opt-on'), gauge: document.querySelector('.opt-btn[data-opt="topup.amount"]').classList.contains('on'),
    note: document.getElementById('staleNote').textContent, noteShown: getComputedStyle(document.getElementById('staleNote')).display !== 'none' }));
  ok(!mode.open && mode.btn === '▶ Optimise' && mode.cls && mode.cancel !== 'none', 'Esc keeps the range: the gate reads ▶ Optimise, with Cancel', JSON.stringify(mode));
  ok(mode.locked && mode.addDis && mode.row && mode.gauge, 'the portfolio bar locks, the row and its gauge light up', JSON.stringify(mode));
  ok(mode.noteShown && /Optimise Test: Amount per top-up \$500 to \$1,500, 11 runs\./.test(mode.note), 'the note says what the next run sweeps', mode.note);
  await p.click('.pf-tab:not(.active) .pf-tab-name', { force: true });
  ok(await p.evaluate(() => document.querySelector('.pf-tab.active .pf-tab-name').textContent) === 'Test', 'a click on another portfolio is ignored while optimising');
  // a second and a third
  await p.click('.opt-btn[data-opt="topup.yearlyIncrease"]'); await p.click('#optDoneBtn');
  const full = await p.evaluate(() => ({ rf: document.querySelector('.opt-btn[data-opt="rf.rate"]').classList.contains('is-full') }));
  ok(full.rf, 'two settings swept: every other gauge stands down');
  await p.click('.opt-btn[data-opt="rf.rate"]', { force: true });
  ok(await p.evaluate(() => document.getElementById('optModal').hidden), 'a third gauge does not open');
  // clash: period with its day, with nothing else swept
  await p.click('.opt-btn[data-opt="topup.yearlyIncrease"]'); await p.click('#optRemoveBtn');
  await p.click('.opt-btn[data-opt="topup.amount"]'); await p.click('#optRemoveBtn');
  await p.click('.opt-btn[data-opt="topupSched.period"]'); await p.click('#optDoneBtn');
  const clash = await p.evaluate(() => { const b = document.querySelector('.opt-btn[data-opt="topupSched.dom"]'); return b ? { full: b.classList.contains('is-full'), title: b.title } : null; });
  ok(clash && clash.full && /period/.test(clash.title), 'a schedule\'s period and its day are never swept together', JSON.stringify(clash));
  // run cap
  await p.click('.opt-btn[data-opt="topupSched.period"]'); await p.click('#optRemoveBtn');
  ok(await p.evaluate(() => document.getElementById('simBtn').textContent) === '▶ Simulate', 'removing the last swept setting leaves optimise mode');
  await p.click('.opt-btn[data-opt="topup.yearlyIncrease"]');
  await p.fill('#optSteps', '50'); await p.dispatchEvent('#optSteps', 'input');
  await p.click('#optDoneBtn');
  await p.click('.opt-btn[data-opt="topup.amount"]');
  await p.fill('#optSteps', '50'); await p.dispatchEvent('#optSteps', 'input');
  const cap = await p.evaluate(() => ({ prev: document.getElementById('optPreview').textContent }));
  await p.click('#optDoneBtn');
  const capBtn = await p.evaluate(() => ({ dis: document.getElementById('simBtn').classList.contains('is-disabled'), tip: document.getElementById('simBtn').getAttribute('data-tip') }));
  ok(/2500 runs/.test(cap.prev) && capBtn.dis && /2500 runs/.test(capBtn.tip || ''), 'past 625 runs the editor says so and the gate stays shut', JSON.stringify([cap, capBtn]));
  // Cancel goes back to comparing, untouched
  await p.click('#optCancelBtn');
  const back = await p.evaluate(() => ({ btn: document.getElementById('simBtn').textContent, locked: document.querySelector('.pf-bar').classList.contains('is-locked'), on: document.querySelectorAll('.opt-on').length, note: document.getElementById('staleNote').textContent, amount: document.getElementById('topupAmount').value }));
  ok(back.btn === '▶ Simulate' && !back.locked && back.on === 0 && back.amount === '1,000', 'Cancel clears the sweep, unlocks the bar and leaves the form as it was', JSON.stringify(back));
  ok(o.errors.length === 0, 'no page errors driving the mode', o.errors.join(' | '));
  await closeAll(o);

  // Pruning: a swept setting whose field goes away is dropped, never kept stale.
  o = await openOn(Object.assign(deep(S.cw), { optimise: { vars: [V('weight:1', 0, 100, 3, 'even')], metric: 'roi' } }));
  p = o.page;
  await sub(p, 'rebal');
  await p.click('#changeMethodBtn'); await p.click('label[data-method="dynamic-momentum"]');
  ok(await p.evaluate(() => document.getElementById('simBtn').textContent) === '▶ Simulate', 'a weight sweep ends when the method stops using weights');
  await closeAll(o);
  o = await openOn(Object.assign(deep(S.rule), { optimise: { vars: [V('trig:3:rsiPeriod', 7, 21, 3)], metric: 'roi' } }));
  p = o.page; await sub(p, 'rebal');
  await p.selectOption('#triggerTableWrap .trig-type[data-aid="3"]', 'tech-adx');
  ok(await p.evaluate(() => document.getElementById('simBtn').textContent) === '▶ Simulate', 'an RSI sweep ends when the trigger becomes ADX');
  await closeAll(o);
  o = await openOn(Object.assign(deep(S.rule), { optimise: { vars: [V('trig:1:from', 'monthly', 'weekly')], metric: 'roi' } }));
  p = o.page; await sub(p, 'rebal');
  await p.selectOption('#triggerTableWrap .trig-period[data-role="ref"][data-aid="1"]', 'top');
  ok(await p.evaluate(() => document.getElementById('simBtn').textContent) === '▶ Simulate', 'a Month/Week open sweep ends when the anchor becomes a rolling top');
  await closeAll(o);
  o = await openOn(Object.assign(deep(S.cw), { optimise: { vars: [V('topupSched.dom', 1, 28, 3)], metric: 'roi' } }));
  p = o.page; await sub(p, 'topups');
  await p.fill('#topupScheduleBox_dom', '1, 15');
  ok(await p.evaluate(() => document.getElementById('simBtn').textContent) === '▶ Simulate', 'a day-of-month sweep ends when a second day is listed');
  ok(o.errors.length === 0, 'no page errors while pruning', o.errors.join(' | '));
  await closeAll(o);
  // A yearly schedule's row holds two gauges, month and day: either lights it.
  o = await openOn(Object.assign(deep(S.topYearly), { optimise: { vars: [V('topupSched.month', 1, 12)], metric: 'roi' } }));
  p = o.page; await sub(p, 'topups');
  const lit = await p.evaluate(() => { const b = document.querySelector('.opt-btn[data-opt="topupSched.month"]'); const d = document.querySelector('.opt-btn[data-opt="topupSched.dom"]');
    return { row: b.closest('.sched-inline').classList.contains('opt-on'), same: b.closest('.sched-inline') === d.closest('.sched-inline'), on: b.classList.contains('on'), dayOn: d.classList.contains('on') }; });
  ok(lit.row && lit.same && lit.on && !lit.dayOn, 'a row with two gauges stays lit while either is swept', JSON.stringify(lit));
  await closeAll(o);

  // Saved state: a reload, a file, and files from before (or beyond) the mode.
  o = await openOn(Object.assign(deep(S.cw), { optimise: { vars: [V('weight:1', 0, 100, 3, 'even'), V('rebal.buyFee', 0, 1, 2)], metric: 'sharpe', pick: [2, 1] } }));
  p = o.page;
  await p.waitForFunction(() => !!document.getElementById('optSurface').data, null, { timeout: 30000 });
  const s1 = await p.evaluate(() => ({ title: document.getElementById('valueTitle').textContent, picks: [...document.querySelectorAll('#optPickWrap select')].map(s => s.value), metric: document.getElementById('optMetric').value, surface: !!(document.getElementById('optSurface').data) }));
  ok(s1.title === 'Optimisation: Sharpe' && s1.picks.join() === '2,1' && s1.metric === 'sharpe' && s1.surface, 'a saved sweep reopens on its metric, its pick and its surface', JSON.stringify(s1));
  await p.selectOption('#optPick0', { index: 1 });
  await p.reload({ waitUntil: 'load' }); await waitIdle(p);
  await p.waitForFunction(() => !!document.getElementById('optSurface').data, null, { timeout: 30000 });
  const s2 = await p.evaluate(() => ({ btn: document.getElementById('simBtn').textContent, picks: [...document.querySelectorAll('#optPickWrap select')].map(s => s.value) }));
  ok(s2.btn === '▶ Optimise' && s2.picks.join() === '1,1', 'a reload keeps the sweep and the picked run (the mini cache)', JSON.stringify(s2));
  const [dl] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => document.querySelector('.quick-start-row .scenario-io-btn[aria-label*="save" i]').click())]);
  const file = JSON.parse(readFileSync(await dl.path(), 'utf8'));
  ok(file.optimise && file.optimise.vars.length === 2 && file.optimise.metric === 'sharpe', 'the saved file carries the sweep', JSON.stringify(file.optimise));
  await closeAll(o);
  o = await openOn(deep(S.cw));
  ok(await o.page.evaluate(() => document.getElementById('simBtn').textContent === '▶ Simulate' && document.getElementById('valueTitle').textContent === 'Portfolio Value Over Time'), 'a file from before the mode opens comparing, as it always did');
  await closeAll(o);
  o = await openOn(Object.assign(deep(S.cw), { optimise: { vars: [V('weight:9', 0, 100, 3), { key: 'nonsense', start: 'x' }, V('topup.amount', 500, 1000, 2)], metric: 'bogus' } }));
  const s3 = await o.page.evaluate(() => ({ btn: document.getElementById('simBtn').textContent, note: document.getElementById('staleNote').textContent, metric: document.getElementById('optMetric').value, title: document.getElementById('valueTitle').textContent }));
  ok(s3.btn === '▶ Optimise' && /Amount per top-up/.test(s3.note) && !/weight/.test(s3.note) && s3.metric === 'roi' && s3.title.startsWith('Optimisation'), 'settings that no longer exist are dropped, the rest still runs', JSON.stringify(s3));
  ok(o.errors.length === 0, 'no page errors opening saved sweeps', o.errors.join(' | '));
  await closeAll(o);

  // The board: the verdict, tiles, an impossible pick and the 3D surface's marks.
  o = await openOn(Object.assign(deep(S.cw), { optimise: { vars: [V('weight:2', 0, 60, 4, 3)], metric: 'roi' } }));
  p = o.page;
  const v = await p.evaluate(() => ({ verdict: document.getElementById('verdict').innerText, tiles: [...document.querySelectorAll('#summaryGrid .tile .label')].map(t => t.textContent), assum: document.getElementById('assumptions').innerText }));
  ok(/1 combination was skipped|skipped because the weights could not add up/.test(v.verdict), 'the verdict says how many runs were skipped', v.verdict);
  ok(v.tiles.join('|') === 'Best ROI|Your current setting|Worst ROI', 'the tiles are best, your setting and worst', v.tiles.join('|'));
  ok(/Gold taking up the difference/.test(v.assum) && /not a forecast/.test(v.assum), 'What this assumes names the slack and the caveat', v.assum.slice(0, 300));
  await p.selectOption('#optPick0', { index: 3 });
  const imp = await p.evaluate(() => document.getElementById('optPickStatus').textContent);
  ok(/cannot add up to 100%/.test(imp), 'picking a skipped value says why there is no breakdown', imp);
  await closeAll(o);
  o = await openOn(Object.assign(deep(S.cw), { optimise: { vars: [V('topup.yearlyIncrease', 0, 6, 4), V('rf.rate', 0, 4, 3)], metric: 'net' } }));
  p = o.page;
  await p.waitForFunction(() => !!document.getElementById('optSurface').data, null, { timeout: 30000 });
  const surf = await p.evaluate(() => { const d = document.getElementById('optSurface'); return { traces: d.data.map(t => t.type + ':' + (t.name || '')), z: d.data[0].z.length + 'x' + d.data[0].z[0].length, chart: !!window.Chart.getChart(document.getElementById('valueCanvas')) }; });
  ok(surf.traces[0] === 'surface:' && surf.traces.includes('scatter3d:Best') && surf.traces.includes('scatter3d:Your current setting') && surf.z === '3x4' && !surf.chart,
    'two settings draw a surface (rows the second setting, columns the first) with the best and your setting marked', JSON.stringify(surf));
  await p.click('#valueResetZoom');
  await p.click('#optCancelBtn'); await p.click('#simBtn'); await waitIdle(p);
  const norm = await p.evaluate(() => ({ title: document.getElementById('valueTitle').textContent, surf: document.getElementById('optSurface').style.display, chart: !!window.Chart.getChart(document.getElementById('valueCanvas')), sel: getComputedStyle(document.getElementById('detailPfSelect')).display, picks: document.getElementById('optPickWrap').hidden }));
  ok(norm.title === 'Portfolio Value Over Time' && norm.surf === 'none' && norm.chart && norm.sel !== 'none' && norm.picks, 'Simulate after Cancel puts the comparison board back', JSON.stringify(norm));
  ok(o.errors.length === 0, 'no page errors on the board', o.errors.join(' | '));
  await closeAll(o);
  // Cancel while a sweep is running stops it and leaves the comparison board.
  o = await openOn(Object.assign(deep(S.rule), { optimise: undefined }));
  p = o.page;
  await sub(p, 'rebal');
  await p.click('.opt-btn[data-opt="trig:3:rsiPeriod"]'); await p.fill('#optStart', '2'); await p.dispatchEvent('#optStart', 'input');
  await p.fill('#optEnd', '100'); await p.dispatchEvent('#optEnd', 'input'); await p.fill('#optSteps', '25'); await p.dispatchEvent('#optSteps', 'input'); await p.click('#optDoneBtn');
  await p.click('.opt-btn[data-opt="weight:1"]'); await p.fill('#optSteps', '24'); await p.dispatchEvent('#optSteps', 'input'); await p.click('#optDoneBtn');
  await p.click('#simBtn');
  await p.waitForFunction(() => /Optimising \d+ of 600/.test(document.getElementById('simBtn').textContent), null, { timeout: 30000 });
  await p.click('#optCancelBtn');
  await waitIdle(p);
  const ab = await p.evaluate(() => ({ btn: document.getElementById('simBtn').textContent, title: document.getElementById('valueTitle').textContent, status: document.getElementById('assetFetchStatus').textContent }));
  ok(ab.btn === '▶ Simulate' && ab.title === 'Portfolio Value Over Time' && !ab.status, 'Cancel during a sweep stops it and leaves the comparison on the board', JSON.stringify(ab));
  ok(o.errors.length === 0, 'no page errors cancelling a sweep', o.errors.join(' | '));
  await closeAll(o);
  // A phone: the range editor fits and its Done is on screen.
  o = await openOn(deep(S.cw), { vp: { width: 390, height: 760 } });
  p = o.page; await sub(p, 'rebal');
  await p.click('.opt-btn[data-opt="weight:1"]');
  const ph = await p.evaluate(() => { const r = document.getElementById('optDoneBtn').getBoundingClientRect(), m = document.querySelector('.opt-modal').getBoundingClientRect(); return { done: r.bottom <= innerHeight && r.top >= 0, fits: m.left >= 0 && m.right <= innerWidth }; });
  ok(ph.done && ph.fits, 'on a phone the range editor fits and Done is on screen', JSON.stringify(ph));
  await closeAll(o);
}
await contracts();

await browser.close(); server.close();
console.log(`\noptimise audit: ${passed} passed, ${failed} failed`);
if (failed) { console.log(fails.map(f => '  - ' + f).join('\n')); process.exit(1); }
