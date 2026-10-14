// Load Flow Simulator audit.
//
//   node loadflow-simulator/_audit/run.mjs
//
// The tool's answers are held to things it did not compute itself:
//
//   A1  The independent replay (nr-replay.mjs, written from PyPSA's documented
//       model) against PyPSA's own results for PSA.js's pf_small scenario
//       (pypsa-pf-small.json). This pins the replay's conventions (tap side,
//       phase-shift sign) to PyPSA rather than to the code under test.
//   A2  The tool (lf-core.js on the shipped engine) against that replay: every
//       Quick Start and 40 seeded random networks, AC from both starts and DC.
//       V to 1e-7 p.u., angle to 1e-6°, P and Q to 1e-6 MW / MVAr.
//   A3  WSCC 9-bus against the values Anderson and Fouad publish.
//   A4  Every island balances: what the sources supply is what is served plus
//       what the branches lose.
//   A5  The engine file is the one its banner names (sha256).
//   B   The real page in headless Chromium: the KPIs, verdict and CSV say what
//       the results say; the Run gate is honest; hostile saved state never
//       breaks it; every export is valid; and it is fast.

import { acFlow, dcFlow, fromModel } from './nr-replay.mjs';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, statSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const TOOL = join(HERE, '..');
const ROOT = join(TOOL, '..');
let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  console.log((ok ? '  PASS  ' : '✗ FAIL  ') + name + (detail ? '  — ' + detail : ''));
  ok ? pass++ : fail++;
};
const fmt = x => (typeof x === 'number' ? x.toExponential(1) : String(x));
// One CSV line, honouring quoted cells ("Generator, Slack").
function splitCsv(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
}

/* ── The engine and the core, as the page loads them ── */
const psa = await import(pathToFileURL(join(TOOL, 'engine', 'psa-pf.min.js')).href);
psa.logger.handler = () => {};
const ctx = { console };
vm.createContext(ctx);
for (const f of ['lf-core.js', 'lf-draw.js']) vm.runInContext(readFileSync(join(TOOL, f), 'utf8'), ctx, { filename: f });
const LF = ctx.LF;
LF.setTypes(psa.stdTypes());

/* ── A1: the replay against PyPSA ── */
console.log('\n── A1 the replay against PyPSA ──');
{
  const ref = JSON.parse(readFileSync(join(HERE, 'pypsa-pf-small.json'), 'utf8'));
  for (const si of [0, 1]) {
    const net = { buses: ['b0', 'b1', 'b2', 'b3'].map(id => ({ id, v_nom: 20, v_set: 1 })),
      lines: [['l01', 'b0', 'b1', .05, .5], ['l12', 'b1', 'b2', .04, .4], ['l20', 'b2', 'b0', .03, .3], ['l23', 'b2', 'b3', .02, .2], ['l23b', 'b2', 'b3', .01, .25]]
        .map(([id, b0, b1, r, x]) => ({ id, b0, b1, r, x, b: 1e-5, g: 0 })),
      trs: [{ id: 'tr', b0: 'b3', b1: 'b1', r: 0.01, x: 0.08, g: 0, b: 0, s_nom: 40, tau: 1.02, tap_side: 0, shift: 5, model: 't' }],
      gens: [{ id: 'slack', bus: 'b0', control: 'Slack', p: 0, q: 0 }, { id: 'pv', bus: 'b1', control: 'PV', p: [3, 4][si], q: 0 }],
      loads: [{ id: 'L2', bus: 'b2', p: 5, q: 1 }, { id: 'L3', bus: 'b3', p: 3, q: 0.5 }],
      stores: [], shunts: [{ id: 'sh', bus: 'b2', g: 0.001, b: 0.002 }], links: [] };
    const r = acFlow(net);
    let w = 0;
    for (const b of ['b0', 'b1', 'b2', 'b3']) w = Math.max(w, Math.abs(r.bus[b].v - ref.pf2.buses.v_mag_pu[b][si]), Math.abs(r.bus[b].ang * Math.PI / 180 - ref.pf2.buses.v_ang[b][si]));
    for (const l of ['l01', 'l12', 'l20', 'l23', 'l23b']) for (const a of ['p0', 'q0', 'p1', 'q1']) w = Math.max(w, Math.abs(r.br[l][a] - ref.pf2.lines[a][l][si]));
    for (const a of ['p0', 'q0', 'p1', 'q1']) w = Math.max(w, Math.abs(r.br.tr[a] - ref.pf2.transformers[a].tr[si]));
    // PyPSA's slack p is NaN there (its p_set was never given), so only its q and the PV unit's q are compared.
    w = Math.max(w, Math.abs(r.gen.pv.q - ref.pf2.generators.q.pv[si]), Math.abs(r.gen.slack.q - ref.pf2.generators.q.slack[si]));
    check(`tap 1.02, 5° phase shift, shunt and PV bus, snapshot ${si}: replay equals PyPSA`, w < 1e-9, 'largest gap ' + fmt(w));
  }
  const net = { buses: [{ id: 'a', v_nom: 110, v_set: 1 }, { id: 'c', v_nom: 110, v_set: 1 }, { id: 'd', v_nom: 110, v_set: 1 }, { id: 'b', v_nom: 220, v_set: 1 }],
    lines: [{ id: 'l', b0: 'c', b1: 'd', r: 0, x: 0.1, b: 0, g: 0 }], trs: [{ id: 't', b0: 'a', b1: 'b', r: 0, x: 0.1, g: 0, b: 0, s_nom: 100, tau: 1, tap_side: 0, shift: 0, model: 't' }],
    gens: [{ id: 'ga', bus: 'a', control: 'Slack', p: 0, q: 0 }, { id: 'gc', bus: 'c', control: 'Slack', p: 0, q: 0 }], loads: [{ id: 'lb', bus: 'b', p: 10, q: 0 }, { id: 'ld', bus: 'd', p: 10, q: 0 }], stores: [], shunts: [], links: [] };
  const r = acFlow(net);
  let w = 0;
  for (const b of ['a', 'b', 'c', 'd']) w = Math.max(w, Math.abs(r.bus[b].v - ref.pf.buses.v_mag_pu[b][0]), Math.abs(r.bus[b].ang * Math.PI / 180 - ref.pf.buses.v_ang[b][0]));
  for (const a of ['p0', 'q0']) w = Math.max(w, Math.abs(r.br.t[a] - ref.pf.transformers[a].t[0]), Math.abs(r.br.l[a] - ref.pf.lines[a].l[0]));
  check('two islands, each with its own slack: replay equals PyPSA', w < 1e-9, 'largest gap ' + fmt(w));
}

/* ── A2: the tool against the replay ── */
console.log('\n── A2 the tool against the replay ──');
function compare(model, opts) {
  const tool = LF.solve(psa, model, opts);
  const net = fromModel(model, LF.types);
  const ac = opts.method !== 'dc';
  const ref = ac ? acFlow(net, { seed: opts.seed === 'flat' ? 'flat' : 'dc' }) : dcFlow(net);
  let wv = 0, wa = 0, wp = 0;
  for (const id in ref.bus) {
    if (ac) wv = Math.max(wv, Math.abs(ref.bus[id].v - tool.bus[id].v));
    wa = Math.max(wa, Math.abs(ref.bus[id].ang - tool.bus[id].ang));
  }
  for (const id in ref.br) for (const a of ac ? ['p0', 'q0', 'p1', 'q1'] : ['p0', 'p1']) wp = Math.max(wp, Math.abs(ref.br[id][a] - tool.br[id][a]));
  if (ac) for (const id in ref.gen) for (const a of ['p', 'q']) wp = Math.max(wp, Math.abs(ref.gen[id][a] - tool.dev[id][a]));
  for (const k of model.el.filter(e => e.c === 'Link')) if (tool.br[k.id]) wp = Math.max(wp, Math.abs(tool.br[k.id].p0 - k.p_set), Math.abs(tool.br[k.id].p1 + k.p_set * k.efficiency));
  const ok = tool.report.ok && (!ac || (tool.report.converged && ref.converged)) && wv < 1e-7 && wa < 1e-6 && wp < 1e-6;
  return { ok, detail: `V ${fmt(wv)}, angle ${fmt(wa)}°, P/Q ${fmt(wp)}`, tool };
}
for (const key of Object.keys(LF.PRESETS)) {
  const m = LF.load(LF.PRESETS[key]);
  for (const opts of [{ method: 'ac', seed: 'dc', tol: 1e-10 }, { method: 'ac', seed: 'flat', tol: 1e-10 }, { method: 'dc' }]) {
    // A flat start through the feeder's 150° transformer diverges, in PyPSA as here; the tool warns about it.
    if (key === 'feeder' && opts.seed === 'flat') continue;
    const r = compare(m, opts);
    check(`${key}, ${opts.method === 'dc' ? 'DC' : 'AC from ' + (opts.seed === 'dc' ? 'the DC seed' : 'a flat start')}`, r.ok, r.detail);
  }
}
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function randomModel(seed) {
  const r = rng(seed), pick = a => a[Math.floor(r() * a.length)];
  const lineTypes = Object.keys(LF.types.line).filter(t => LF.types.line[t].f_nom > 0 && / 110\.0$/.test(t));
  const trTypes = Object.keys(LF.types.transformer).filter(t => LF.types.transformer[t].v_nom_0 === 110 && LF.types.transformer[t].v_nom_1 === 20);
  const el = [], nb = 4 + Math.floor(r() * 9);
  let id = 1;
  const bus = (v, x) => { el.push({ c: 'Bus', id, v_nom: v, at: [x * 12, 10, 8] }); return id++; };
  const hv = []; for (let i = 0; i < nb; i++) hv.push(bus(110, i));
  for (let i = 1; i < nb; i++) {
    const j = hv[Math.floor(r() * i)];
    if (r() < 0.5) el.push({ c: 'Line', id: id++, bus0: j, bus1: hv[i], type: pick(lineTypes), length: 2 + r() * 30, num_parallel: 1 + Math.floor(r() * 2) });
    else el.push({ c: 'Line', id: id++, bus0: j, bus1: hv[i], r: 0.5 + r() * 4, x: 3 + r() * 15, b: r() * 8e-5, s_nom: 120 });
  }
  const a = hv[Math.floor(r() * nb)], b = hv[Math.floor(r() * nb)];
  if (a !== b) el.push({ c: 'Line', id: id++, bus0: a, bus1: b, r: 1.5, x: 9, b: 2e-5, s_nom: 100 });
  const lv = bus(20, nb);
  if (r() < 0.5) el.push({ c: 'Transformer', id: id++, bus0: hv[1 % nb], bus1: lv, type: pick(trTypes), tap_position: Math.floor(r() * 5) - 2, num_parallel: 1 + Math.floor(r() * 2), model: r() < 0.5 ? 't' : 'pi' });
  else el.push({ c: 'Transformer', id: id++, bus0: hv[1 % nb], bus1: lv, s_nom: 40, x: 0.12, r: 0.01, g: r() * 2e-3, b: -r() * 2e-3, tap_ratio: 0.95 + r() * 0.1, tap_side: r() < 0.5 ? 0 : 1, phase_shift: pick([0, 0, 15, -30]), model: r() < 0.5 ? 't' : 'pi' });
  el.push({ c: 'Generator', id: id++, bus: hv[0], control: 'Slack', grid: 1 });
  el.push({ c: 'Generator', id: id++, bus: hv[nb - 1], control: 'PV', p_set: 5 + r() * 20, p_nom: 50 });
  el.find(e => e.id === hv[nb - 1]).v_mag_pu_set = 0.99 + r() * 0.04;
  for (const h of hv.slice(1)) if (r() < 0.8) el.push({ c: 'Load', id: id++, bus: h, p_set: r() * 12, q_set: r() * 4 });
  el.push({ c: 'Load', id: id++, bus: lv, p_set: 5 + r() * 10, q_set: r() * 3 });
  el.push({ c: 'Generator', id: id++, bus: lv, control: 'PQ', p_set: r() * 4, q_set: r() - 0.5 });
  el.push({ c: 'ShuntImpedance', id: id++, bus: hv[Math.floor(r() * nb)], b: r() * 1e-3, g: r() * 1e-5 });
  el.push({ c: 'StorageUnit', id: id++, bus: hv[Math.floor(r() * nb)], p_set: r() * 6 - 3, q_set: r() - 0.5, p_nom: 10 });
  // A second island behind an HVDC link, with its own slack.
  const far = bus(110, nb + 2), far2 = bus(110, nb + 3);
  el.push({ c: 'Line', id: id++, bus0: far, bus1: far2, r: 1, x: 8, s_nom: 100 });
  el.push({ c: 'Generator', id: id++, bus: far2, control: 'Slack' });
  el.push({ c: 'Load', id: id++, bus: far2, p_set: 10, q_set: 2 });
  el.push({ c: 'Link', id: id++, bus0: hv[nb - 1], bus1: far, p_set: 5 + r() * 10, efficiency: 0.95 + r() * 0.05, p_nom: 50 });
  return LF.load({ v: 1, name: 'random ' + seed, el });
}
{
  let ok = 0, worst = '';
  for (let seed = 1; seed <= 40; seed++) {
    const m = randomModel(seed);
    for (const opts of [{ method: 'ac', seed: 'dc', tol: 1e-10 }, { method: 'dc' }]) {
      const r = compare(m, opts);
      if (r.ok) ok++; else worst = `network ${seed} ${opts.method}: ${r.detail}${r.tool.report.error ? ' ' + r.tool.report.error : ''}`;
    }
  }
  check('40 random networks (typed and custom lines and transformers, taps, phase shift, T and π, shunts, storage, a linked island), AC and DC', ok === 80, worst || '80 of 80 runs');
}

/* ── A3: WSCC 9-bus against the published load flow ── */
console.log('\n── A3 WSCC 9-bus against Anderson and Fouad ──');
{
  const pub = JSON.parse(readFileSync(join(HERE, 'wscc9-published.json'), 'utf8'));
  const r = LF.solve(psa, LF.load(LF.PRESETS.wscc9), {});
  const bad = [];
  for (const [id, [v, a]] of Object.entries(pub.buses)) {
    if (Math.abs(r.bus[id].v - v) > pub.tol.v) bad.push(`bus ${id} V ${r.bus[id].v.toFixed(4)} vs ${v}`);
    if (Math.abs(r.bus[id].ang - a) > pub.tol.ang) bad.push(`bus ${id} angle ${r.bus[id].ang.toFixed(2)} vs ${a}`);
  }
  for (const [id, [p, q]] of Object.entries(pub.generators)) {
    if (Math.abs(r.dev[id].p - p) > pub.tol.pq) bad.push(`${id} P ${r.dev[id].p.toFixed(2)} vs ${p}`);
    if (Math.abs(r.dev[id].q - q) > pub.tol.pq) bad.push(`${id} Q ${r.dev[id].q.toFixed(2)} vs ${q}`);
  }
  check('every bus voltage and angle and every unit\'s P and Q, to the published digit', !bad.length, bad.join('; ') || `${Object.keys(pub.buses).length} buses, ${Object.keys(pub.generators).length} units`);
}

/* ── A4: every island balances ── */
console.log('\n── A4 power balance ──');
for (const key of Object.keys(LF.PRESETS)) {
  const m = LF.load(LF.PRESETS[key]);
  const r = LF.solve(psa, m, {});
  // Each bus: what its devices and links put in equals what its branches take away.
  let worst = 0;
  for (const b of m.el.filter(e => e.c === 'Bus')) {
    let inj = 0;
    for (const e of m.el) {
      if (LF.DEVICE[e.c] && e.bus === b.id && r.dev[e.id]) inj += e.c === 'Load' || e.c === 'ShuntImpedance' ? -r.dev[e.id].p : r.dev[e.id].p;
      if (LF.BRANCH[e.c] && r.br[e.id]) { if (e.bus0 === b.id) inj -= r.br[e.id].p0; if (e.bus1 === b.id) inj -= r.br[e.id].p1; }
    }
    const isl = r.report.islands.find(i => i.slackBus === b.id && !i.slackGen);
    if (isl) inj += r.bus[b.id].p; // an ideal source at a generator-less island's slack
    worst = Math.max(worst, Math.abs(inj));
  }
  const t = r.totals;
  const total = Math.abs(t.gen - t.load - t.loss);
  check(`${key}: every bus balances, and supplied = served + lost`, worst < 1e-6 && total < 1e-6, `largest bus gap ${fmt(worst)} MW, totals gap ${fmt(total)} MW`);
}

/* ── A5: the engine is the file its banner names ── */
{
  const text = readFileSync(join(TOOL, 'engine', 'psa-pf.min.js'), 'utf8');
  const end = text.indexOf('*/\n') + 3, m = /sha256 of the code below: ([0-9a-f]{64})/.exec(text);
  const got = createHash('sha256').update(text.slice(end)).digest('hex');
  check('A5 the engine\'s code hashes to the sha256 in its banner', !!m && m[1] === got, got.slice(0, 16));
}

/* ── B: the page ── */
console.log('\n── B the page ──');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.ttf': 'font/ttf' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = normalize(join(ROOT, p));
  if (!f.startsWith(ROOT) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;
const URL_ = ORIGIN + '/loadflow-simulator/';
const browser = await pw.chromium.launch();
async function fresh(viewport = { width: 1440, height: 1000 }) {
  const c = await browser.newContext({ viewport, acceptDownloads: true });
  // Fonts come from Google; the audit runs offline and needs none of them.
  await c.route(/fonts\.(googleapis|gstatic)\.com|googletagmanager/, r => r.fulfill({ status: 200, body: '' }));
  const page = await c.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message)));
  return { c, page, errors };
}
const solved = page => page.waitForFunction(() => window.__lf && window.__lf.app.res && !document.getElementById('runBtn').disabled, null, { timeout: 20000 });

{
  const { c, page, errors } = await fresh();
  await page.goto(URL_);
  await solved(page);
  const marks = await page.evaluate(() => Object.fromEntries(performance.getEntriesByType('mark').map(m => [m.name, m.startTime])));
  check('B1 first paint and first solve are quick', marks['lf-first-render'] < 1500 && marks['lf-solved'] < 2500,
        `first render ${Math.round(marks['lf-first-render'])} ms, solved ${Math.round(marks['lf-solved'])} ms after navigation (local server)`);

  for (const key of Object.keys(LF.PRESETS)) {
    await page.click(`.quick-start-btn[data-preset="${key}"]`);
    await page.waitForTimeout(200);
    await solved(page);
    const s = await page.evaluate(() => {
      const a = window.__lf.app, r = a.res, d = window.__lf.display();
      const txt = id => document.getElementById(id).textContent.trim();
      return { conv: r.report.converged, iters: r.report.iters, mm: r.report.mismatch, totals: r.totals, loss: txt('mLoss'), volt: txt('mVolt'), load: txt('mLoad'),
               verdict: document.getElementById('verdict').className, title: document.querySelector('#verdict h2').textContent,
               v: Object.values(r.bus).map(b => b.v), loads: Object.values(r.br).map(b => b.load).filter(isFinite), vmin: d.vmin, vmax: d.vmax, lmax: d.loadMax };
    });
    const F = LF.fmt;
    const lo = Math.min(...s.v), hi = Math.max(...s.v), top = Math.max(...s.loads);
    const outside = s.v.some(v => v < s.vmin - 1e-9 || v > s.vmax + 1e-9) || s.loads.some(l => l > s.lmax + 1e-9);
    check(`B2 ${key}: converges within 10 iterations to below the tolerance`, s.conv && s.iters <= 10 && s.mm < 1e-6, `${s.iters} iterations, mismatch ${fmt(s.mm)}`);
    check(`B2 ${key}: the KPIs say what the results say`,
          s.loss === F.p(s.totals.loss) + ' MW' && s.volt === F.vl(lo, s.vmin, s.vmax) + ' to ' + F.vl(hi, s.vmin, s.vmax) && s.load === F.pctl(top, s.lmax) + '%',
          `${s.loss} | ${s.volt} | ${s.load}`);
    check(`B2 ${key}: the verdict warns exactly when a limit is crossed`, outside === / warn/.test(s.verdict) && s.title.includes(F.p(s.totals.loss) + ' MW lost'), s.title.slice(0, 90));
    // The CSV of every table carries the same numbers.
    for (const kind of ['bus', 'branch', 'device']) {
      await page.click(`#tableTabs .seg-btn[data-val="${kind}"]`);
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#csvBtn')]);
      const csv = readFileSync(await dl.path(), 'utf8').trim().split('\n').map(splitCsv);
      const want = await page.evaluate(k => {
        const a = window.__lf.app, r = a.res, F = window.LF.fmt, rows = [], d = window.__lf.display();
        a.model.el.forEach(e => {
          if (k === 'bus' && e.c === 'Bus') rows.push([F.vl(r.bus[e.id].v, d.vmin, d.vmax), F.ang(r.bus[e.id].ang).replace('−', '-'), F.p(r.bus[e.id].p).replace('−', '-')]);
          if (k === 'branch' && window.LF.BRANCH[e.c]) rows.push([F.p(r.br[e.id].p0).replace('−', '-'), F.p(r.br[e.id].loss).replace('−', '-')]);
          if (k === 'device' && window.LF.DEVICE[e.c]) rows.push([F.p(r.dev[e.id].p).replace('−', '-')]);
        });
        return rows;
      }, kind);
      const head = csv[0];
      const cols = kind === 'bus' ? ['V p.u.', 'Angle °', 'P MW'] : kind === 'branch' ? ['P from MW', 'Losses MW'] : ['P MW'];
      const at = cols.map(h => head.indexOf(h));
      const got = csv.slice(1).map(row => at.map(i => row[i]));
      check(`B2 ${key}: the ${kind} CSV carries the results`, JSON.stringify(got) === JSON.stringify(want), JSON.stringify(got) === JSON.stringify(want) ? `${got.length} rows` : `CSV ${JSON.stringify(got).slice(0, 120)} vs ${JSON.stringify(want).slice(0, 120)}`);
    }
    // Every export of it is valid: the SVG is strict XML and the PNG twice its size.
    const exp = await page.evaluate(async () => {
      const X = await window.__lf.app.exporter();
      const ctx = { app: window.__lf.app, LF: window.LF, display: window.__lf.display(), res: window.__lf.app.res, stale: false, title: 'audit', sub: '' };
      const text = X.svgText(ctx);
      const bad = new DOMParser().parseFromString(text, 'image/svg+xml').querySelector('parsererror');
      const size = X.size(ctx);
      const png = await createImageBitmap(await X.pngBlob(ctx));
      return { xml: !bad, size, png: [png.width, png.height] };
    });
    check(`B3 ${key}: the SVG is valid XML and the PNG is its picture at 2x`, exp.xml && exp.png[0] === exp.size.w * 2 && exp.png[1] === exp.size.h * 2, `${exp.size.w}x${exp.size.h}, PNG ${exp.png.join('x')}`);
  }

  // A value past a limit is printed with the digits that show it is past it.
  {
    const F = LF.fmt;
    const got = [F.vl(0.9497, 0.95, 1.05), F.vl(0.9504, 0.95, 1.05), F.vl(1.0503, 0.95, 1.05), F.vl(0.95, 0.95, 1.05), F.pctl(100.4, 100), F.pctl(99.6, 100), F.pctl(7.25, 5)];
    const want = ['0.9497', '0.950', '1.0503', '0.950', '100.4', '100', '7.3'];
    check('B2 a value past a limit never prints as the limit itself', JSON.stringify(got) === JSON.stringify(want), got.join(' | '));
  }

  // The gate: an electrical edit steps the answer back, undo brings it forward, a move does not touch it.
  await page.click('.quick-start-btn[data-preset="wscc9"]');
  await solved(page);
  const gate = await page.evaluate(async () => {
    const a = window.__lf.app, st = () => [document.body.classList.contains('is-stale'), document.getElementById('runBtn').classList.contains('needs-run')].join('');
    const sig0 = document.getElementById('sldStage').getAttribute('data-share-sig');
    const out = { start: st() };
    a.model.el.find(e => e.id === 22).p_set = 150; a.change('elec');
    out.edit = st();
    a.undo(); out.undo = st();
    out.sigBack = document.getElementById('sldStage').getAttribute('data-share-sig') === sig0;
    const b = a.model.el.find(e => e.id === 7); b.at = [b.at[0] + 2, b.at[1], b.at[2], b.at[3]]; a.change('geom');
    out.move = st();
    a.model.el.find(e => e.id === 22).p_set = 150; a.change('elec');
    await window.__lf.run();
    out.run = st();
    out.p = a.res.dev[22].p;
    return out;
  });
  check('B4 the Run gate: an edit makes results stale, undo clears it, a move does not, Run refreshes',
        gate.start === 'falsefalse' && gate.edit === 'truetrue' && gate.undo === 'falsefalse' && gate.sigBack && gate.move === 'falsefalse' && gate.run === 'falsefalse' && gate.p === 150,
        JSON.stringify(gate));

  // A big network still solves at once.
  const big = await page.evaluate(() => {
    const el = [], n = 200; let id = 1;
    for (let i = 0; i < n; i++) el.push({ c: 'Bus', id: id++, v_nom: 110, at: [(i % 20) * 12, Math.floor(i / 20) * 14, 8] });
    for (let i = 1; i < n; i++) el.push({ c: 'Line', id: id++, bus0: Math.floor((i - 1) / 2) + 1, bus1: i + 1, r: 0.5, x: 3, b: 1e-5, s_nom: 200 });
    for (let i = 0; i < 20; i++) el.push({ c: 'Line', id: id++, bus0: 1 + i * 7 % n, bus1: 1 + (i * 13 + 5) % n, r: 1, x: 6, s_nom: 100 });
    el.push({ c: 'Generator', id: id++, bus: 1, control: 'Slack', grid: 1 });
    for (let i = 2; i <= n; i += 3) el.push({ c: 'Load', id: id++, bus: i, p_set: 0.4, q_set: 0.1 });
    const m = window.LF.load({ v: 1, el });
    window.__lf.app.model = m;
    return window.__lf.engine().then(psa => { const t0 = performance.now(); const r = window.LF.solve(psa, m, {}); return { ms: performance.now() - t0, conv: r.report.converged }; });
  });
  check('B5 a 200-bus network solves in under 100 ms', big.conv && big.ms < 100, `${big.ms.toFixed(1)} ms`);
  check('B no page errors while driving the page', errors.length === 0, errors.slice(0, 2).join(' | '));
  await c.close();
}

// Hostile saved state, through the mini cache and through a scenario file.
{
  const KEY = 'abt:save:loadflow-simulator:v1';
  const EVIL = '"><img src=x onerror="window.__pwned=1">';
  const blobs = {
    'an empty object': {},
    'extra set to null': { __fields: {}, __extra: null },
    'a future version': { __extra: { v: 99, el: [{ c: 'Bus', id: 1, v_nom: 20 }] } },
    'unknown classes and keys': { __extra: { v: 1, el: [{ c: 'Breaker', id: 1 }, { c: 'Bus', id: 2, v_nom: 20, colour: 'red', at: [0, 0, 8] }, { c: 'Generator', id: 3, bus: 2, control: 'Droop' }] } },
    'strings and NaN in numbers': { __extra: { v: 1, el: [{ c: 'Bus', id: 'x', v_nom: 'abc', at: ['a', null] }, { c: 'Load', id: 2, bus: 1, p_set: NaN, q_set: '5' }] } },
    'a branch to a missing bus': { __extra: { v: 1, el: [{ c: 'Bus', id: 1, v_nom: 110, at: [0, 0, 8] }, { c: 'Line', id: 2, bus0: 1, bus1: 9, x: 5 }, { c: 'Load', id: 3, bus: 7, p_set: 1 }] } },
    'negative ratings and duplicate ids': { __extra: { v: 1, el: [{ c: 'Bus', id: 1, v_nom: -5, at: [0, 0, 8] }, { c: 'Bus', id: 1, v_nom: 1e9, at: [9, 0, 8] }, { c: 'Transformer', id: 4, bus0: 1, bus1: 1, s_nom: -10 }] } },
    'hostile strings': { __fields: { 'v:colourBy': EVIL, 'c:animP': EVIL }, __extra: { v: 1, name: EVIL, el: [{ c: 'Bus', id: 1, name: EVIL, v_nom: 20, at: [0, 0, 8] }, { c: 'Generator', id: 2, bus: 1, control: 'Slack', name: EVIL, type: EVIL }] } },
    'not even JSON': 'not json at all'
  };
  for (const [name, blob] of Object.entries(blobs)) {
    const { c, page, errors } = await fresh();
    await page.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch (e) {} }, [KEY, typeof blob === 'string' ? blob : JSON.stringify(blob)]);
    await page.goto(URL_);
    await page.waitForTimeout(900);
    const r = await page.evaluate(() => ({ pwned: !!window.__pwned, imgs: document.querySelectorAll('img[src="x"]').length, ran: !!(window.__lf && window.__lf.app.res), n: window.__lf.app.model.el.length }));
    check(`B6 a mini cache holding ${name} opens without an error`, !errors.length && !r.pwned && !r.imgs && r.ran, errors[0] || `${r.n} elements, run done`);
    await c.close();
  }
  // The same through the open-folder button.
  const { c, page, errors } = await fresh();
  await page.goto(URL_);
  await solved(page);
  const dir = mkdtempSync(join(tmpdir(), 'lf-audit-'));
  for (const [name, blob] of Object.entries(blobs)) {
    if (typeof blob === 'string') continue;
    const file = join(dir, 'scenario.json');
    writeFileSync(file, JSON.stringify({ tool: 'loadflow-simulator', kind: 'scenario', version: 1, state: blob }));
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('.scenario-load')]);
    await chooser.setFiles(file);
    await page.waitForTimeout(500);
  }
  const r = await page.evaluate(() => ({ pwned: !!window.__pwned, imgs: document.querySelectorAll('img[src="x"]').length }));
  check('B6 scenario files holding all of those open without an error', !errors.length && !r.pwned && !r.imgs, errors[0] || 'clean');
  await c.close();
}

await browser.close();
server.close();
console.log(`\nload flow audit: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
