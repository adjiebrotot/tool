/* DCA Scenario Explorer (single asset): Optimise mode audit.

   Optimise mode sweeps up to two settings of one scenario and runs every
   combination. Its one promise is the Portfolio page's: a tested value means
   exactly what the same value typed into the form means. So for every setting
   the mode offers, this drives the real page headless and, for sampled values:

     1. opens the scenario in optimise mode and reads what the sweep reports for
        that value: all seven figures off the chart (ROI, final value, net,
        Sharpe, Sortino, CAGR TWR and MWR; the surface for two settings) and the
        breakdown's CSV once that value is picked for the charts below;
     2. opens the same scenario in plain Simulate mode, sets that value THROUGH
        THE FORM (types the amount, picks the weekday, presses Weekly, ticks the
        End of period box, types the threshold into the slider's readout),
        presses Simulate, and reads the same figures;
     3. requires them to agree: final value, ROI and net to 1e-9, the advanced
        metrics as the tile prints them, and the CSV cell for cell.

   Then the contracts around it: which fields offer a gauge under each style
   (and that the asset, the style, Trade at, the seed, the risk-free rate and
   the dates never do), list values picked one by one, a setting dropped when
   its style goes, the two-setting limit, the run cap, the locked scenario bar,
   Cancel, that only the scenario on screen runs, a click on the chart picking
   a tested value, the risk-free rate sending a sweep out of date, a rename
   kept in place, saved state (reload, a file, a file from before the mode
   existed, a file naming settings or a scenario that no longer exist), and no
   page errors anywhere.

   Prices are the page's own seeded simulated assets, so nothing is fetched;
   Chart.js and Plotly are served from _ref/.libcache/ (run
   node _ref/chart-check.mjs once with network access to fill it).

   Run: node optimise-single.mjs   (ONLY=<text> runs the cases whose name has it;
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
const URL_DCA = ORIGIN + '/dcasimulator/';
const browser = await pw.chromium.launch();
const SAVE_KEY = 'abt:save:dcasimulator:v1';

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
      localStorage.setItem('abt:ctrl:/dcasimulator/', '1');
      ['dca-tour-v1-seen', 'dca-tour-v2-seen', 'dca-tour-v3-seen', 'dca-tour-v4-seen'].forEach(k => localStorage.setItem(k, '1'));
    } catch (e) {}
  }, [SAVE_KEY, settings ? JSON.stringify({ __fields: {}, __extra: settings }) : null]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL_DCA, { waitUntil: 'load' });
  await waitIdle(page);
  return { page, ctx, errors };
}
async function waitIdle(page){
  await page.waitForFunction(() => { const b = document.getElementById('simBtn'); return b && b.dataset.running !== '1'; }, null, { timeout: 120000 });
  await page.waitForTimeout(60);
}
async function closeAll(o){ await o.ctx.close(); }

/* ── scenarios ── */
const SIM_POOL = [{ name: 'Equities', returnPct: 9, stdPct: 22 }, { name: 'Bonds', returnPct: 4, stdPct: 6 }];
const TECH = { fastMaType: 'ema', fastMaLen: 20, slowMaType: 'sma', slowMaLen: 60, rsiPeriod: 14, rsiOversold: 40, bbPeriod: 20, bbStd: 1.5, bbTrigger: 'below', macdFast: 12, macdSlow: 26, macdSignal: 9, macdHistThreshold: 0, adxPeriod: 14, adxThreshold: 20 };
function sec(o, i = 0){
  const p = SIM_POOL[i];
  return Object.assign({ id: i + 1, colorSlot: i, type: 'custom', ticker: '', name: p.name, simName: p.name, returnPct: p.returnPct, stdPct: p.stdPct,
    amount: 500, yearlyIncrease: 3, style: 'monthly-date', dayOrDate: 5, momentumPct: 4, momentumEOM: true, techEOM: true, period: 'monthly',
    tech: Object.assign({}, TECH) }, o || {});
}
function scenario(secs, extra){
  return Object.assign({ app: 'dca-single', version: 1,
    global: { currencySymbol: '$', randomSeed: 25823952204, riskFreeRate: 4, execTiming: 'next-open', startDate: '2016-01-01', endDate: '2021-12-31', tickerPool: '', simPool: SIM_POOL },
    securities: Array.isArray(secs) ? secs : [secs] }, extra || {});
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
const LISTS = {
  weekday: [1, 2, 3, 4, 5, 6, 7], period: ['monthly', 'weekly'], eom: ['on', 'off'],
  'tech.fastMaType': ['sma', 'ema'], 'tech.slowMaType': ['sma', 'ema'], 'tech.bbTrigger': ['below', 'reclaim']
};
const INT = /^(dayOfMonth|tech\.(fastMaLen|slowMaLen|rsiPeriod|rsiOversold|bbPeriod|macdFast|macdSlow|macdSignal|adxPeriod|adxThreshold))$/;
function valuesOf(v){
  const L = LISTS[v.key];
  if (L && Array.isArray(v.pick)) return L.filter(x => v.pick.map(String).includes(String(x)));
  if (L){ const a = L.indexOf(v.start), b = L.indexOf(v.end); return L.slice(Math.min(a, b), Math.max(a, b) + 1); }
  return rangeValues(v, INT.test(v.key), /^(momentumPct|tech\.bbStd)$/.test(v.key) ? 1 : 2);
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
      out[k] = await page.evaluate(() => window.Chart.getChart(document.getElementById('optCanvas')).data.datasets[0].data.map(p => (p && typeof p === 'object') ? p.y : p));
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
async function readSim(page, idx = 0){
  return page.evaluate(idx => {
    const ds = window.Chart.getChart(document.getElementById('equityCanvas')).data.datasets;
    const e = ds[idx * 2], d = ds[idx * 2 + 1];
    const fin = e.data[e.data.length - 1], dep = d.data[d.data.length - 1];
    const tile = document.querySelectorAll('#summaryGrid .tile')[idx];
    const adv = [...tile.querySelectorAll('.adv-metrics b')].map(b => b.textContent.trim());
    return { final: fin, dep, net: fin - dep, roi: dep > 0 ? (fin - dep) / dep : 0, adv };
  }, idx);
}
const advText = m => [m.sharpe, m.sortino].map(v => (v == null || !isFinite(v)) ? '-' : v.toFixed(2))
  .concat([m.twr, m.mwr].map(v => (v == null || !isFinite(v)) ? '-' : (v * 100).toFixed(2) + '%'));
function csvSame(a, b){
  const A = a.trim().split('\n'), B = b.trim().split('\n');
  if (A.length !== B.length) return 'rows ' + A.length + ' vs ' + B.length;
  for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) return 'row ' + i + ': ' + A[i] + '  vs  ' + B[i];
  return '';
}

/* ── setting a value through the form, as a reader would ── */
async function tab(page, name){ await page.click(`.ctrl-tab[data-tab="${name}"]`); }
async function fill(page, sel, v){ await page.fill(sel, String(v)); await page.dispatchEvent(sel, 'change'); }
const TECH_IDS = { fastMaType: 'secMaFastType', fastMaLen: 'secMaFastLen', slowMaType: 'secMaSlowType', slowMaLen: 'secMaSlowLen',
  rsiPeriod: 'secRsiPeriod', rsiOversold: 'secRsiOversold', bbPeriod: 'secBbPeriod', bbStd: 'secBbStd', bbTrigger: 'secBbTrigger',
  macdFast: 'secMacdFast', macdSlow: 'secMacdSlow', macdSignal: 'secMacdSignal', macdHistThreshold: 'secMacdHist',
  adxPeriod: 'secAdxPeriod', adxThreshold: 'secAdxThreshold' };
async function setByForm(page, key, v, id = 1){
  await tab(page, 'securities');
  if (key === 'amount') return fill(page, '#cfgAmount', v);
  if (key === 'yearlyIncrease') return fill(page, '#cfgYearlyInc', v);
  if (key === 'dayOfMonth') return fill(page, `#secDay${id}`, v);
  if (key === 'weekday') return page.selectOption(`#secDay${id}`, { value: String(v) });
  if (key === 'momentumPct'){
    // The slider's readout takes a typed value (SharedSlider), as a reader types it.
    await page.click(`#secMomPctVal${id}`);
    await page.fill(`#secMomPctVal${id} + .slider-val-edit`, String(v));
    await page.press(`#secMomPctVal${id} + .slider-val-edit`, 'Enter');
    return;
  }
  if (key === 'period') return page.click(`#secPeriodSeg${id} .seg-btn[data-period="${v}"]`);
  if (key === 'eom') return v === 'on' ? page.check(`#secTechEOM${id}`) : page.uncheck(`#secTechEOM${id}`);
  const m = /^tech\.(\w+)$/.exec(key);
  if (m){
    const el = `#${TECH_IDS[m[1]]}${id}`;
    if (LISTS[key]) return page.selectOption(el, { value: String(v) });
    return fill(page, el, v);
  }
  throw new Error('no form driver for ' + key);
}
async function simulate(page){
  await page.click('#simBtn');
  await waitIdle(page);
  await page.waitForFunction(() => !document.body.classList.contains('is-stale'), null, { timeout: 30000 });
}

/* ── one case: a sweep, checked value by value against the form ── */
async function runCase(c){
  try { await runCaseInner(c); }
  catch (e) { ok(false, c.name + ': ran to the end', String(e && e.message || e).split('\n')[0]); }
}
async function runCaseInner(c){
  if (ONLY && !c.name.includes(ONLY)) return;
  const t0 = Date.now();
  const sc = c.scenario, vars = c.vars;
  const opt = await openOn(Object.assign(deep(sc), { optimise: { scenario: 0, vars, metric: 'roi' } }));
  const { page } = opt;
  if (vars.length === 2) await page.waitForFunction(() => { const d = document.getElementById('optSurface'); return d && d.data && d.data.length; }, null, { timeout: 30000 });
  ok(await page.evaluate(() => !document.getElementById('optCard').hidden && document.getElementById('optTitle').textContent.startsWith('Optimisation')), c.name + ': opens and runs in optimise mode');
  const vals = vars.map(v => valuesOf(v));
  const pickCounts = await page.evaluate(() => [...document.querySelectorAll('#optPickWrap select')].map(s => s.options.length));
  ok(JSON.stringify(pickCounts) === JSON.stringify(vals.map(a => a.length)), c.name + ': the sweep runs the values its range names', `${pickCounts} vs ${vals.map(a => a.length)}`);
  const sweep = await readSweep(page);
  const at = (k, idx) => sweep.two ? sweep[k][idx[1]][idx[0]] : sweep[k][idx[0]];
  // The sampled combinations: first, last and one in between of each.
  const pickIdx = vals.length === 1
    ? [...new Set([0, Math.floor((vals[0].length - 1) / 2), vals[0].length - 1])].map(i => [i])
    : [[0, 0], [vals[0].length - 1, vals[1].length - 1], [Math.floor((vals[0].length - 1) / 2), 0]];
  for (const idx of pickIdx){
    const tested = idx.map((i, k) => vals[k][i]);
    const tag = c.name + ' @ ' + tested.join(', ');
    // By value: a bare string also matches option labels, and a day of the month
    // labelled 4 would win over the fifth tested value.
    for (let k = 0; k < idx.length; k++) await page.selectOption('#optPick' + k, { value: String(idx[k]) });
    const csvOpt = await csvNow(page);
    const plain = await openOn(deep(sc));
    // Values go in the order a reader would type them: the amount before the
    // frequency it is rescaled by.
    const order = vars.map((v, k) => k).sort((a, b) => (vars[a].key === 'period') - (vars[b].key === 'period'));
    for (const k of order) await setByForm(plain.page, vars[k].key, tested[k]);
    await simulate(plain.page);
    const sim = await readSim(plain.page);
    const m = {}; METRICS.forEach(k => { m[k] = at(k, idx); });
    ok(near(m.final, sim.final), tag + ': final value matches the form', `${m.final} vs ${sim.final}`);
    ok(near(m.roi, sim.roi), tag + ': ROI matches the form', `${m.roi} vs ${sim.roi}`);
    ok(near(m.net, sim.net), tag + ': net matches the form', `${m.net} vs ${sim.net}`);
    ok(JSON.stringify(advText(m)) === JSON.stringify(sim.adv), tag + ': Sharpe, Sortino and both CAGRs match the form', `${advText(m)} vs ${sim.adv}`);
    const diff = csvSame(csvOpt, await csvNow(plain.page));
    ok(!diff, tag + ': the breakdown CSV matches the form, row for row', diff);
    ok(plain.errors.length === 0, tag + ': no page errors on the plain run', plain.errors.join(' | '));
    await closeAll(plain);
  }
  ok(opt.errors.length === 0, c.name + ': no page errors', opt.errors.join(' | '));
  await closeAll(opt);
  console.log(`  ${c.name}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

/* ── the cases: every setting the mode offers, under the style that shows it ── */
const S = (o) => scenario(sec(o));
const CASES = [
  { name: 'amount (monthly date)',      scenario: S({}), vars: [{ key: 'amount', start: 250, end: 750, steps: 5 }] },
  { name: 'yearly increase',            scenario: S({}), vars: [{ key: 'yearlyIncrease', start: 0, end: 10, steps: 6 }] },
  { name: 'day of month',               scenario: S({}), vars: [{ key: 'dayOfMonth', start: 1, end: 28, steps: 10 }] },
  { name: 'weekday, weekend included',  scenario: S({ style: 'weekly-day', dayOrDate: 3, amount: 120 }), vars: [{ key: 'weekday', start: 1, end: 7, steps: 4, pick: [1, 3, 5, 6] }] },
  { name: 'dip threshold',              scenario: S({ style: 'momentum-dip' }), vars: [{ key: 'momentumPct', start: 1.5, end: 6.5, steps: 6 }] },
  { name: 'rise threshold, weekly',     scenario: S({ style: 'momentum-peak', period: 'weekly', amount: 115.38 }), vars: [{ key: 'momentumPct', start: 0.5, end: 3, steps: 6 }] },
  { name: 'frequency (momentum)',       scenario: S({ style: 'momentum-dip' }), vars: [{ key: 'period', start: 'monthly', end: 'weekly', steps: 2, pick: ['monthly', 'weekly'] }] },
  { name: 'end-of-period buy (momentum)', scenario: S({ style: 'momentum-dip', momentumPct: 6 }), vars: [{ key: 'eom', start: 'on', end: 'off', steps: 2, pick: ['on', 'off'] }] },
  { name: 'end-of-period buy (RSI)',    scenario: S({ style: 'tech-rsi', techEOM: false, momentumEOM: false }), vars: [{ key: 'eom', start: 'on', end: 'off', steps: 2, pick: ['on', 'off'] }] },
  { name: 'fast MA type',               scenario: S({ style: 'tech-ma-cross' }), vars: [{ key: 'tech.fastMaType', start: 'sma', end: 'ema', steps: 2, pick: ['sma', 'ema'] }] },
  { name: 'fast MA length',             scenario: S({ style: 'tech-ma-cross' }), vars: [{ key: 'tech.fastMaLen', start: 5, end: 30, steps: 6 }] },
  { name: 'slow MA type',               scenario: S({ style: 'tech-ma-cross' }), vars: [{ key: 'tech.slowMaType', start: 'sma', end: 'ema', steps: 2, pick: ['sma', 'ema'] }] },
  { name: 'slow MA length',             scenario: S({ style: 'tech-ma-cross' }), vars: [{ key: 'tech.slowMaLen', start: 40, end: 120, steps: 5 }] },
  { name: 'RSI period',                 scenario: S({ style: 'tech-rsi' }), vars: [{ key: 'tech.rsiPeriod', start: 7, end: 21, steps: 5 }] },
  { name: 'RSI oversold',               scenario: S({ style: 'tech-rsi' }), vars: [{ key: 'tech.rsiOversold', start: 25, end: 50, steps: 6 }] },
  { name: 'Bollinger period',           scenario: S({ style: 'tech-bollinger' }), vars: [{ key: 'tech.bbPeriod', start: 10, end: 40, steps: 4 }] },
  { name: 'Bollinger deviations',       scenario: S({ style: 'tech-bollinger' }), vars: [{ key: 'tech.bbStd', start: 1, end: 2.5, steps: 4 }] },
  { name: 'Bollinger trigger',          scenario: S({ style: 'tech-bollinger' }), vars: [{ key: 'tech.bbTrigger', start: 'below', end: 'reclaim', steps: 2, pick: ['below', 'reclaim'] }] },
  { name: 'MACD fast',                  scenario: S({ style: 'tech-macd-cross' }), vars: [{ key: 'tech.macdFast', start: 6, end: 18, steps: 4 }] },
  { name: 'MACD slow',                  scenario: S({ style: 'tech-macd-cross' }), vars: [{ key: 'tech.macdSlow', start: 20, end: 40, steps: 5 }] },
  { name: 'MACD signal',                scenario: S({ style: 'tech-macd-cross' }), vars: [{ key: 'tech.macdSignal', start: 5, end: 13, steps: 5 }] },
  { name: 'MACD histogram threshold',   scenario: S({ style: 'tech-macd-hist' }), vars: [{ key: 'tech.macdHistThreshold', start: -0.6, end: 0.6, steps: 5 }] },
  { name: 'ADX period',                 scenario: S({ style: 'tech-adx' }), vars: [{ key: 'tech.adxPeriod', start: 7, end: 28, steps: 4 }] },
  { name: 'ADX threshold',              scenario: S({ style: 'tech-adx' }), vars: [{ key: 'tech.adxThreshold', start: 10, end: 35, steps: 6 }] },
  // Two at once draw a surface. The amount and the frequency it follows run in
  // the order the form applies them; the others are independent pairs.
  { name: 'amount x frequency',         scenario: S({ style: 'tech-rsi' }), vars: [{ key: 'amount', start: 300, end: 700, steps: 3 }, { key: 'period', start: 'monthly', end: 'weekly', steps: 2, pick: ['monthly', 'weekly'] }] },
  { name: 'day of month x yearly increase', scenario: S({}), vars: [{ key: 'dayOfMonth', start: 2, end: 26, steps: 4 }, { key: 'yearlyIncrease', start: 0, end: 8, steps: 3 }] },
  { name: 'fast x slow MA length',      scenario: S({ style: 'tech-ma-cross' }), vars: [{ key: 'tech.fastMaLen', start: 5, end: 25, steps: 3 }, { key: 'tech.slowMaLen', start: 40, end: 100, steps: 3 }] },
];

/* ── contracts ── */
const GAUGES = {
  'monthly-date':   ['amount', 'yearlyIncrease', 'dayOfMonth'],
  'weekly-day':     ['amount', 'yearlyIncrease', 'weekday'],
  'monthly-top':    ['amount', 'yearlyIncrease'],
  'weekly-bottom':  ['amount', 'yearlyIncrease'],
  'momentum-peak':  ['amount', 'yearlyIncrease', 'momentumPct', 'period', 'eom'],
  'momentum-dip':   ['amount', 'yearlyIncrease', 'momentumPct', 'period', 'eom'],
  'tech-ma-cross':  ['amount', 'yearlyIncrease', 'period', 'tech.fastMaType', 'tech.fastMaLen', 'tech.slowMaType', 'tech.slowMaLen', 'eom'],
  'tech-rsi':       ['amount', 'yearlyIncrease', 'period', 'tech.rsiPeriod', 'tech.rsiOversold', 'eom'],
  'tech-bollinger': ['amount', 'yearlyIncrease', 'period', 'tech.bbPeriod', 'tech.bbStd', 'tech.bbTrigger', 'eom'],
  'tech-macd-cross':['amount', 'yearlyIncrease', 'period', 'tech.macdFast', 'tech.macdSlow', 'tech.macdSignal', 'eom'],
  'tech-macd-hist': ['amount', 'yearlyIncrease', 'period', 'tech.macdFast', 'tech.macdSlow', 'tech.macdSignal', 'tech.macdHistThreshold', 'eom'],
  'tech-adx':       ['amount', 'yearlyIncrease', 'period', 'tech.adxPeriod', 'tech.adxThreshold', 'eom'],
};
const visibleGauges = page => page.evaluate(() => [...document.querySelectorAll('.opt-btn')].filter(b => !b.hidden && b.offsetParent !== null).map(b => b.dataset.opt));
const optState = page => page.evaluate(() => ({
  note: document.getElementById('staleNote').textContent, btn: document.getElementById('simBtn').textContent,
  on: [...document.querySelectorAll('.opt-btn.on')].map(b => b.dataset.opt), locked: document.querySelector('.sc-bar').classList.contains('is-locked'),
  cancel: getComputedStyle(document.getElementById('optCancelBtn')).display !== 'none', card: !document.getElementById('optCard').hidden,
  stale: document.body.classList.contains('is-stale'), tip: document.getElementById('simBtn').getAttribute('data-tip') || '' }));

async function contracts(){
  if (ONLY && !'contracts'.includes(ONLY)) return;
  console.log('\ncontracts');
  // 1. Which fields offer a gauge, style by style, and which never do.
  {
    const o = await openOn(S({}));
    const { page } = o;
    await tab(page, 'securities');
    for (const [style, want] of Object.entries(GAUGES)){
      await page.evaluate(style => {
        const cat = { 'monthly-date': 'date', 'weekly-day': 'date', 'monthly-top': 'forward', 'weekly-bottom': 'forward', 'momentum-peak': 'momentum', 'momentum-dip': 'momentum' }[style] || 'tech';
        document.querySelector(`.cat-pill[data-cat="${cat}"]`).click();
      }, style);
      await page.click(`input[name="secStyle1"][value="${style}"]`);
      const got = await visibleGauges(page);
      ok(JSON.stringify(got.slice().sort()) === JSON.stringify(want.slice().sort()), `gauges under ${style}`, `${got} vs ${want}`);
    }
    const never = await page.evaluate(() => ({
      data: document.querySelectorAll('#tab-data .opt-btn').length, settings: document.querySelectorAll('#tab-settings .opt-btn').length,
      radios: document.querySelectorAll('.radio-opt .opt-btn').length, asset: [...document.querySelectorAll('.group-title')].filter(g => g.textContent === 'Asset').map(g => g.parentNode.querySelectorAll('.opt-btn').length)[0],
      inLabelWithField: [...document.querySelectorAll('label .opt-btn')].filter(b => b.closest('label').querySelector('input,select,textarea')).length }));
    ok(never.data === 0 && never.settings === 0, 'no gauge on the Data or Assumptions tab (dates, seed, Trade at, risk-free rate)', JSON.stringify(never));
    ok(never.radios === 0 && never.asset === 0, 'no gauge on the investment style or the asset', JSON.stringify(never));
    ok(never.inLabelWithField === 0, 'no gauge sits inside a label that holds a field (it would steal the label\'s clicks)', JSON.stringify(never));
    // The End of period box still toggles from its words with a gauge beside it.
    await page.click(`input[name="secStyle1"][value="tech-rsi"]`).catch(() => {});
    const before = await page.isChecked('#secTechEOM1');
    await page.click('label.tech-eom', { position: { x: 60, y: 8 } });
    ok(await page.isChecked('#secTechEOM1') === !before, 'the End of period box still toggles from its label');
    ok(o.errors.length === 0, 'gauges: no page errors', o.errors.join(' | '));
    await closeAll(o);
  }
  // 2. The editor: a list picked one by one, the default ranges, the two-setting
  //    limit, the run cap, the locked bar, a setting dropped with its style, Cancel.
  {
    const o = await openOn(scenario([sec({ style: 'weekly-day', dayOrDate: 2, amount: 120 }), sec({}, 1)]));
    const { page } = o;
    await tab(page, 'securities');
    await page.click('.sc-tab:nth-child(1)');
    await page.click('.opt-btn[data-opt="weekday"]');
    ok(await page.evaluate(() => [...document.getElementById('optPickSel').selectedOptions].map(x => x.textContent).join(',')) === 'Monday,Tuesday,Wednesday,Thursday,Friday',
      'a weekday sweep opens on the five trading days');
    await page.selectOption('#optPickSel', [{ value: '0' }, { value: '4' }, { value: '6' }]);
    ok((await page.textContent('#optPreview')).startsWith('3 values: Monday, Friday, Sunday'), 'list values are picked one by one, in the list\'s order', await page.textContent('#optPreview'));
    await page.selectOption('#optPickSel', [{ value: '2' }]);
    ok((await page.textContent('#optPreview')).includes('Pick at least two'), 'one picked value is not a sweep');
    let st = await optState(page);
    ok(st.tip.includes('pick at least two'), 'and the gate says so', st.tip);
    await page.selectOption('#optPickSel', [{ value: '1' }, { value: '2' }]);
    await page.click('#optDoneBtn');
    st = await optState(page);
    ok(st.btn.includes('Optimise') && st.cancel && st.locked, 'optimise mode: ▶ Optimise, Cancel beside it, the scenario bar locked', JSON.stringify(st));
    ok(st.note.includes('Day of week') && st.note.includes('2 runs'), 'the note above the gate says what runs', st.note);
    ok(await page.evaluate(() => ['addScenarioBtn', 'dupScenarioBtn', 'delScenarioBtn'].every(id => document.getElementById(id).disabled)), 'add, copy and remove stand down');
    const active0 = await page.evaluate(() => document.querySelector('.sc-tab.active').textContent);
    await page.click('.sc-tab:nth-child(2)', { force: true });
    ok(await page.evaluate(() => document.querySelector('.sc-tab.active').textContent) === active0, 'another scenario cannot be opened while optimising');
    // Default range of a number, and the amount's frequency knock-on is not here (date style).
    await page.click('.opt-btn[data-opt="amount"]');
    ok((await page.textContent('#optPreview')).startsWith('11 values: $60, $72, $84') && (await page.textContent('#optPreview')).includes('$168, $180.'), 'a number opens on half to one and a half times its value', await page.textContent('#optPreview'));
    await page.fill('#optSteps', '50'); await page.dispatchEvent('#optSteps', 'input');
    ok((await page.textContent('#staleNote')).includes('2) × ') && (await page.textContent('#staleNote')).includes('100 runs'), 'the note above the gate counts every run', await page.textContent('#staleNote'));
    await page.click('#optDoneBtn');
    st = await optState(page);
    ok(await page.evaluate(() => document.querySelector('.opt-btn[data-opt="yearlyIncrease"]').classList.contains('is-full')), 'a third setting is refused: its gauge is full');
    await page.click('.opt-btn[data-opt="yearlyIncrease"]');
    ok(await page.evaluate(() => document.getElementById('optModal').hidden), 'and clicking it opens nothing');
    // The run cap: 25 x 25 is the most.
    await page.click('.opt-btn[data-opt="weekday"]');
    await page.selectOption('#optPickSel', ['0', '1', '2', '3', '4', '5', '6'].map(value => ({ value })));
    await page.click('#optDoneBtn');
    st = await optState(page);
    ok(st.tip === '' , '350 runs is within the cap', st.tip);
    // The style changes: the weekday no longer applies and is dropped; the amount stays.
    await page.click('.cat-pill[data-cat="date"]');
    await page.click('input[name="secStyle1"][value="monthly-date"]');
    st = await optState(page);
    ok(JSON.stringify(st.on) === '["amount"]', 'a setting whose field went with its style is dropped', JSON.stringify(st.on));
    await page.click('.opt-btn[data-opt="dayOfMonth"]');
    await page.fill('#optStart', '1'); await page.dispatchEvent('#optStart', 'input');
    await page.fill('#optEnd', '31'); await page.dispatchEvent('#optEnd', 'input');
    await page.fill('#optSteps', '31'); await page.dispatchEvent('#optSteps', 'input');
    await page.click('#optDoneBtn');
    st = await optState(page);
    ok(st.tip.includes('more than the 625'), 'over 625 runs, the gate refuses and says why', st.tip);
    // Cancel: back to comparing.
    await page.click('#optCancelBtn');
    st = await optState(page);
    ok(st.btn.includes('Simulate') && !st.locked && !st.cancel && st.on.length === 0, 'Cancel ends the mode and unlocks the bar', JSON.stringify(st));
    await simulate(page);
    ok(await page.evaluate(() => document.querySelectorAll('#summaryGrid .tile').length === 2 && document.getElementById('optCard').hidden), 'Simulate then compares every scenario again');
    ok(o.errors.length === 0, 'editor: no page errors', o.errors.join(' | '));
    await closeAll(o);
  }
  // 3. Only the scenario on screen runs, and "your current setting" is the
  //    plain run of that scenario; a click on the line picks a value; the
  //    risk-free rate sends the sweep out of date; a rename stays in place.
  {
    const sc = scenario([sec({}), sec({ amount: 300 }, 1)]);
    const o = await openOn(Object.assign(deep(sc), { optimise: { scenario: 1, vars: [{ key: 'dayOfMonth', start: 1, end: 25, steps: 5 }], metric: 'final' } }));
    const { page } = o;
    const plain = await openOn(deep(sc));
    const two = await readSim(plain.page, 1);
    await closeAll(plain);
    const base = await page.evaluate(() => { const ds = window.Chart.getChart(document.getElementById('optCanvas')).data.datasets.find(d => d.label === 'Your current setting'); return ds.data[0].y; });
    ok(near(base, two.final), 'your current setting is the same scenario\'s plain run, the other scenario left out', `${base} vs ${two.final}`);
    ok((await page.textContent('#verdict')).includes('Bonds') && (await page.textContent('#assumptions')).includes('Only Bonds runs, 5 times'), 'the sweep names the scenario it ran');
    // A click on the third point picks it for the charts below.
    const pt = await page.evaluate(() => { const c = window.Chart.getChart(document.getElementById('optCanvas')); const p = c.getDatasetMeta(0).data[2]; return { x: p.x, y: p.y }; });
    const box = await page.locator('#optCanvas').boundingBox();
    await page.mouse.click(box.x + pt.x, box.y + pt.y);
    await page.waitForTimeout(150);
    ok(await page.evaluate(() => document.getElementById('optPick0').value) === '2', 'a click on the chart picks that tested value');
    ok((await page.evaluate(() => window.Chart.getChart(document.getElementById('equityCanvas')).data.datasets[0].label)).includes('Day of month 13'), 'and the value chart below shows it');
    // A rename is a label: the sweep stays, named anew.
    await tab(page, 'securities');
    await page.fill('#cfgName', 'Bond ladder');
    await page.waitForTimeout(100);
    let st = await optState(page);
    ok(!st.stale && (await page.textContent('#verdict')).includes('Bond ladder'), 'a rename keeps the sweep and renames it', JSON.stringify(st));
    // The risk-free rate re-ranks Sharpe, which a stored sweep cannot do.
    await tab(page, 'settings');
    await page.fill('#riskFreeRate', '2');
    st = await optState(page);
    ok(st.stale && st.note.includes('Inputs changed'), 'the risk-free rate sends a sweep out of date', JSON.stringify(st));
    ok(o.errors.length === 0, 'run: no page errors', o.errors.join(' | '));
    await closeAll(o);
  }
  // 4. Saved state: a reload, a file, an old file, a file naming what no longer exists.
  {
    const sc = scenario(sec({ style: 'tech-rsi' }));
    const vars = [{ key: 'tech.rsiPeriod', start: 7, end: 21, steps: 3 }, { key: 'tech.rsiOversold', start: 30, end: 50, steps: 3 }];
    const o = await openOn(Object.assign(deep(sc), { optimise: { scenario: 0, vars, metric: 'sharpe', pick: [2, 1] } }));
    const { page } = o;
    await page.waitForFunction(() => { const d = document.getElementById('optSurface'); return d && d.data && d.data.length; }, null, { timeout: 30000 });
    const first = await page.evaluate(() => ({ metric: document.getElementById('optMetric').value, pick: [0, 1].map(k => document.getElementById('optPick' + k).value),
      z: document.getElementById('optSurface').data[0].z, title: document.getElementById('optTitle').textContent }));
    ok(first.metric === 'sharpe' && first.title === 'Optimisation: Sharpe', 'a saved sweep opens ranked by its saved figure', JSON.stringify(first.metric));
    ok(JSON.stringify(first.pick) === '["2","1"]', 'and on its saved pick', JSON.stringify(first.pick));
    await page.reload({ waitUntil: 'load' });
    await waitIdle(page);
    await page.waitForFunction(() => { const d = document.getElementById('optSurface'); return d && d.data && d.data.length; }, null, { timeout: 30000 });
    const again = await page.evaluate(() => ({ pick: [0, 1].map(k => document.getElementById('optPick' + k).value), z: document.getElementById('optSurface').data[0].z }));
    ok(JSON.stringify(again) === JSON.stringify({ pick: first.pick, z: first.z }), 'a reload brings the same sweep back');
    // Save to a file, open it on a fresh page.
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.scenario-save')]);
    const file = JSON.parse(readFileSync(await dl.path(), 'utf8'));
    ok(file.optimise && file.optimise.vars.length === 2 && file.optimise.metric === 'sharpe' && file.optimise.scenario === 0, 'a saved file carries the sweep', JSON.stringify(file.optimise));
    const fresh = await openOn(null);
    const [chooser] = await Promise.all([fresh.page.waitForEvent('filechooser'), fresh.page.click('.scenario-load')]);
    await chooser.setFiles({ name: 's.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
    await fresh.page.waitForFunction(() => { const d = document.getElementById('optSurface'); return d && d.data && d.data.length; }, null, { timeout: 60000 });
    await waitIdle(fresh.page);
    const z2 = await fresh.page.evaluate(() => document.getElementById('optSurface').data[0].z);
    ok(JSON.stringify(z2) === JSON.stringify(first.z), 'opening that file runs the same sweep');
    ok(fresh.errors.length === 0, 'file: no page errors', fresh.errors.join(' | '));
    await closeAll(fresh);
    ok(o.errors.length === 0, 'saved state: no page errors', o.errors.join(' | '));
    await closeAll(o);
    // A file from before the mode: it compares, as it always did.
    const old = await openOn(scenario([sec({}), sec({}, 1)]));
    let st = await optState(old.page);
    ok(!st.card && st.btn.includes('Simulate') && (await old.page.evaluate(() => document.querySelectorAll('#summaryGrid .tile').length)) === 2, 'a file without the mode opens comparing scenarios', JSON.stringify(st));
    ok(old.errors.length === 0, 'old file: no page errors', old.errors.join(' | '));
    await closeAll(old);
    // A file naming a setting that no longer applies, an unknown one, a bad
    // pick and a scenario that is not there: what still applies runs.
    const odd = await openOn(Object.assign(scenario(sec({ style: 'weekly-day', dayOrDate: 2 })), { optimise: { scenario: 9,
      vars: [{ key: 'dayOfMonth', start: 1, end: 28, steps: 5 }, { key: 'bogus', start: 1, end: 2, steps: 2 }, null, { key: 'amount', start: 100, end: 900, steps: 'x' }],
      metric: 'nonsense', pick: [99] } }));
    st = await optState(odd.page);
    ok(st.card && JSON.stringify(st.on) === '["amount"]', 'settings that no longer apply are dropped and the rest runs', JSON.stringify(st));
    ok(await odd.page.evaluate(() => document.getElementById('optMetric').value) === 'roi', 'an unknown figure falls back to ROI');
    ok(await odd.page.evaluate(() => document.getElementById('optPick0').options.length) === 11, 'unreadable steps fall back to 11');
    ok(odd.errors.length === 0, 'odd file: no page errors', odd.errors.join(' | '));
    await closeAll(odd);
  }
}

/* ── run ── */
const JOBS = Math.max(1, parseInt(process.env.JOBS, 10) || 4);
console.log('cases');
const queue = CASES.slice();
await Promise.all(Array.from({ length: JOBS }, async () => { while (queue.length) await runCase(queue.shift()); }));
await contracts();
await browser.close();
server.close();
console.log(`\noptimise (single asset) audit: ${passed} passed, ${failed} failed`);
if (failed){ console.log(fails.map(f => '  - ' + f).join('\n')); process.exit(1); }
