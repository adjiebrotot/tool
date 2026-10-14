// Build the Load Flow Simulator's engine: the power-flow part of PSA.js
// (github.com/adjiebrotot/PSA.js, a JavaScript port of PyPSA) as one small,
// minified browser module, plus the vendored GIF encoder.
//
//   cd loadflow-simulator/_build && npm install && node build-engine.mjs [--psa=<PSA.js checkout>] [--no-check]
//
// PSA.js is only ever READ. Every change below is made in memory by an esbuild
// plugin, so the checkout is left exactly as it was found:
//
//   1. core/csv.js is replaced by a shim holding only pyFloatRepr(), cut
//      verbatim from csv.js. network.js needs that one pure function, and
//      csv.js would otherwise pull in papaparse, the only thing on the power
//      flow's path a browser cannot load.
//   2. data/definitions.js is pruned. Every component type stays (a Network
//      builds all sixteen), with the attribute fields the power flow reads;
//      descriptions and units go, except on Link and Process, whose extra
//      ports copy them. The standard line and transformer type tables stay,
//      without their references column.
//
// Before anything is written, a self-test runs the same networks through a
// reference bundle (csv shim only, definitions untouched, not minified) and
// through the shipping bundle, and requires every number to be identical. The
// shipping bundle is also held to PyPSA's own results for PSA.js's pf_small
// parity scenario (test/fixtures/scenario_pf_small.json.gz).
//
// Output: ../engine/psa-pf.min.js, ../engine/LICENSE.txt, ../vendor/gifenc.js

import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const TOOL = resolve(HERE, '..');
const arg = (k) => { const a = process.argv.find(s => s.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : null; };
const PSA = resolve(arg('psa') || process.env.PSA_DIR || resolve(TOOL, '..', '..', 'PSA.js'));
const CHECK = !process.argv.includes('--no-check');
const GZ_BUDGET = 45 * 1024;

if (!existsSync(join(PSA, 'src', 'network', 'power_flow.js'))) {
  console.error(`No PSA.js checkout at ${PSA}. Pass --psa=<path>.`);
  process.exit(1);
}

const git = (...a) => { try { return execFileSync('git', ['-C', PSA, ...a], { encoding: 'utf8' }).trim(); } catch { return ''; } };
const COMMIT = git('rev-parse', 'HEAD') || 'unknown';
const DIRTY = git('status', '--porcelain', '--', 'src') ? ' (with local changes)' : '';
const PKG = JSON.parse(readFileSync(join(PSA, 'package.json'), 'utf8'));

/* ── The csv.js shim: pyFloatRepr, cut out by brace counting ── */
function pyFloatReprSource() {
  const src = readFileSync(join(PSA, 'src', 'core', 'csv.js'), 'utf8');
  const start = src.indexOf('export function pyFloatRepr(');
  if (start < 0) throw new Error('pyFloatRepr not found in core/csv.js');
  let depth = 0, i = src.indexOf('{', start);
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) break;
  }
  const fn = src.slice(start, i + 1);
  if (/\bPapa\b|\bimport\b/.test(fn)) throw new Error('pyFloatRepr now depends on more of csv.js; update the shim');
  return fn + '\n';
}

/* ── Pruned definitions ── */
const KEEP_ATTR = ['attr', 'type', 'typ', 'default', 'static', 'varying'];
const KEEP_FULL = new Set(['Link', 'Process']);
async function prunedDefinitions() {
  const defs = (await import(pathToFileURL(join(PSA, 'src', 'data', 'definitions.js')).href)).default;
  const out = { pypsa_version: defs.pypsa_version, components: [] };
  for (const c of defs.components) {
    const attrs = c.attrs.map(a => {
      if (KEEP_FULL.has(c.name)) return a;
      const o = {};
      for (const k of KEEP_ATTR) o[k] = a[k];
      return o;
    });
    let st = c.standard_types;
    if (st) {
      const columns = st.columns.filter(k => k !== 'references');
      const data = {};
      for (const k of columns) data[k] = st.data[k];
      st = { ...st, columns, data };
    }
    out.components.push({ name: c.name, list_name: c.list_name, description: '', category: c.category, attrs, standard_types: st });
  }
  return 'export default ' + JSON.stringify(out) + ';\n';
}

/* ── The entry: Network with its power flow, the logger, the type tables ── */
const ENTRY = `
export { Network } from './network/network.js';
import './network/power_flow.js';
export { logger } from './logger.js';
import { componentTypes } from './components/types.js';
export { componentTypes };
function table(name) {
  const st = componentTypes.get(name).standard_types;
  if (!st) return {};
  const out = {};
  st.index.values.forEach((label, i) => {
    const row = {};
    for (const c of st.columns.values) row[c] = st.col(c)[i];
    out[label] = row;
  });
  return out;
}
export function stdTypes() { return { line: table('LineType'), transformer: table('TransformerType') }; }
`;

function plugin({ prune }) {
  return {
    name: 'psa-pf',
    setup(b) {
      b.onResolve({ filter: /^lf-entry$/ }, () => ({ path: 'lf-entry', namespace: 'lf' }));
      b.onLoad({ filter: /^lf-entry$/, namespace: 'lf' }, () => ({ contents: ENTRY, resolveDir: join(PSA, 'src'), loader: 'js' }));
      b.onResolve({ filter: /core[\\/]csv\.js$/ }, () => ({ path: 'lf-csv-shim', namespace: 'lf' }));
      b.onLoad({ filter: /^lf-csv-shim$/, namespace: 'lf' }, () => ({ contents: pyFloatReprSource(), loader: 'js' }));
      if (prune) b.onLoad({ filter: /data[\\/]definitions\.js$/ }, async () => ({ contents: await prunedDefinitions(), loader: 'js' }));
      // Anything that is not a relative file of PSA.js has no place in the browser bundle.
      b.onResolve({ filter: /^[^./]/ }, (a) => {
        if (a.path === 'lf-entry' || a.path === 'lf-csv-shim') return null;
        return { errors: [{ text: `bare import "${a.path}" from ${a.importer} would not load in a browser` }] };
      });
    },
  };
}

async function bundle({ prune, minify }) {
  const r = await build({
    entryPoints: ['lf-entry'], bundle: true, format: 'esm', target: 'es2020', platform: 'neutral',
    minify, legalComments: 'none', write: false, plugins: [plugin({ prune })], logLevel: 'silent',
  });
  return r.outputFiles[0].text;
}

const MIT = `MIT License

Copyright (c) PyPSA Developers (PyPSA, https://github.com/PyPSA/PyPSA)
Copyright (c) Adjie Brotosukmono (PSA.js, https://github.com/adjiebrotot/PSA.js)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

/* ── Self-test ── */
async function importText(dir, name, text) {
  const p = join(dir, name);
  writeFileSync(p, text);
  return import(pathToFileURL(p).href);
}

// A small op runner for PSA.js's scenario files (the subset pf_small uses).
function runOps(psa, ops, onRecord) {
  let n = null;
  const results = {};
  for (const op of ops) {
    const [kind] = op;
    if (kind === 'new_network') n = new psa.Network(op[1] ?? {});
    else if (kind === 'set_snapshots') n.set_snapshots(op[1]);
    else if (kind === 'add') n.add(op[1], op[2], op[3] ?? {}, op[4] ?? {});
    else if (kind === 'call') {
      const res = n[op[1]](...(op[2] ?? []), ...(op[3] && Object.keys(op[3]).length ? [op[3]] : []));
      if (op[4]) results[op[4]] = res;
    } else if (kind === 'record') { if (op[2] === 'network') onRecord(op[1], n); }
    else throw new Error('unknown op ' + kind);
  }
}

// Every number a power flow writes, in a fixed order.
function dump(n, ret) {
  const out = [];
  const take = (list, attrs) => {
    const c = n.c.get(list);
    for (const a of attrs) {
      const df = c.dynamic[a];
      if (!df) continue;
      for (const col of df.columns.values) out.push(`${list}.${a}.${col}`, ...Array.from(df.col(col)));
    }
  };
  take('buses', ['v_mag_pu', 'v_ang', 'p', 'q']);
  take('lines', ['p0', 'p1', 'q0', 'q1']);
  take('transformers', ['p0', 'p1', 'q0', 'q1']);
  take('generators', ['p', 'q']);
  take('loads', ['p', 'q']);
  take('shunt_impedances', ['p', 'q']);
  take('storage_units', ['p', 'q']);
  take('links', ['p0', 'p1']);
  if (ret) for (const k of ['n_iter', 'error', 'converged']) for (const col of ret[k].columns.values) out.push(k, ...Array.from(ret[k].col(col)));
  return out;
}
function sameDump(a, b) {
  if (a.length !== b.length) return `length ${a.length} vs ${b.length}`;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return `at ${i}: ${a[i]} vs ${b[i]}`;
  return null;
}

// Seeded random meshed networks over everything the tool can draw.
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function randomNetwork(psa, seed, types) {
  const r = rng(seed), n = new psa.Network();
  const pick = (a) => a[Math.floor(r() * a.length)];
  const lineTypes = Object.keys(types.line).filter(t => types.line[t].f_nom > 0);
  const trTypes = Object.keys(types.transformer);
  const nb = 4 + Math.floor(r() * 10);
  const buses = Array.from({ length: nb }, (_, i) => 'b' + i);
  n.add('Bus', buses, { v_nom: 110 });
  const typed = r() < 0.5;
  for (let i = 1; i < nb; i++) {
    const j = Math.floor(r() * i);
    if (typed) n.add('Line', `l${i}`, { bus0: buses[j], bus1: buses[i], type: pick(lineTypes), length: 1 + r() * 30, num_parallel: 1 + Math.floor(r() * 2) });
    else n.add('Line', `l${i}`, { bus0: buses[j], bus1: buses[i], r: 0.5 + r() * 5, x: 2 + r() * 20, b: r() * 1e-4, s_nom: 100 });
  }
  for (let k = 0; k < 2; k++) {
    const a = Math.floor(r() * nb), b = Math.floor(r() * nb);
    if (a !== b) n.add('Line', `m${k}`, { bus0: buses[a], bus1: buses[b], r: 1, x: 8, s_nom: 80 });
  }
  n.add('Bus', 'lv', { v_nom: 20 });
  if (r() < 0.5) n.add('Transformer', 't', { bus0: buses[0], bus1: 'lv', type: pick(trTypes.filter(t => / 110\//.test(t))), tap_position: Math.floor(r() * 5) - 2 });
  else n.add('Transformer', 't', { bus0: buses[0], bus1: 'lv', x: 0.1, r: 0.01, s_nom: 50, tap_ratio: 0.95 + r() * 0.1, phase_shift: Math.floor(r() * 3) * 15 });
  n.add('Generator', 'grid', { bus: buses[0], control: 'Slack', p_set: 0, p_nom: 200 });
  n.add('Generator', 'pv', { bus: buses[nb - 1], control: 'PV', p_set: 5 + r() * 20, p_nom: 40 });
  n.add('Bus', 'vset', { v_nom: 110, v_mag_pu_set: 1.02 });
  n.add('Line', 'lv2', { bus0: buses[1], bus1: 'vset', r: 1, x: 6, s_nom: 60 });
  n.add('Generator', 'pv2', { bus: 'vset', control: 'PV', p_set: 3, p_nom: 10 });
  n.add('Load', buses.slice(1).map(b => 'd' + b), { bus: buses.slice(1), p_set: buses.slice(1).map(() => r() * 10), q_set: buses.slice(1).map(() => r() * 3) });
  n.add('Load', 'dlv', { bus: 'lv', p_set: 2, q_set: 0.5 });
  n.add('ShuntImpedance', 'sh', { bus: buses[1], b: 1e-4, g: 1e-6 });
  n.add('StorageUnit', 'st', { bus: buses[2 % nb], p_set: 1.5, q_set: -0.2 });
  n.add('Bus', 'far', { v_nom: 110 });
  n.add('Generator', 'far_g', { bus: 'far', control: 'Slack', p_set: 0 });
  n.add('Link', 'k', { bus0: buses[nb - 1], bus1: 'far', p_set: 4, efficiency: 0.97 });
  return n;
}

async function selfTest(refMod, shipMod) {
  const scenario = JSON.parse(readFileSync(join(PSA, 'test', 'scenarios', 'pf_small.json'), 'utf8'));
  let checked = 0;
  const quiet = (m) => { m.logger.handler = () => {}; };
  quiet(refMod); quiet(shipMod);

  // 1. pf_small through both bundles, every record identical.
  const ref = {}, ship = {};
  runOps(refMod, scenario.ops, (k, n) => { ref[k] = dump(n); });
  runOps(shipMod, scenario.ops, (k, n) => { ship[k] = dump(n); });
  for (const k of Object.keys(ref)) {
    const d = sameDump(ref[k], ship[k]);
    if (d) throw new Error(`pf_small ${k}: shipping bundle differs from source (${d})`);
    checked += ref[k].length;
  }

  // 2. The shipping bundle against PyPSA's own numbers.
  const helpers = await import(pathToFileURL(join(PSA, 'test', 'helpers.js')).href);
  const fixture = helpers.loadFixture('scenario_pf_small');
  const tol = { ...(scenario.tolerance ?? { rtol: 1e-8, atol: 1e-8 }), path_tolerance: scenario.path_tolerance ?? {} };
  let pypsa = 0;
  runOps(shipMod, scenario.ops, (k, n) => {
    if (!fixture.records[k]) return;
    helpers.assertNetworkMatches(n, fixture.records[k], { ...tol, ...(scenario.record_tolerance?.[k] ?? {}), path: `pf_small ${k} vs PyPSA` });
    pypsa++;
  });

  // 3. Random networks, both load flows, both initial guesses, distributed slack.
  const types = shipMod.stdTypes();
  const variants = [
    (n) => n.pf(),
    (n) => { n.lpf(); return n.pf({ use_seed: true }); },
    (n) => n.pf({ distribute_slack: true, slack_weights: 'p_nom' }),
    (n) => { n.lpf(); return null; },
  ];
  for (let seed = 1; seed <= 25; seed++) {
    for (const [vi, run] of variants.entries()) {
      const a = randomNetwork(refMod, seed, types), b = randomNetwork(shipMod, seed, types);
      const ra = run(a), rb = run(b);
      const d = sameDump(dump(a, ra), dump(b, rb));
      if (d) throw new Error(`random network ${seed} variant ${vi}: shipping bundle differs (${d})`);
      checked++;
    }
  }

  // 4. The tool's own presets through lf-core.js, when it exists.
  let presets = 0;
  const corePath = join(TOOL, 'lf-core.js');
  if (existsSync(corePath)) {
    const ctx = { console };
    vm.createContext(ctx);
    vm.runInContext(readFileSync(corePath, 'utf8'), ctx, { filename: 'lf-core.js' });
    const LF = ctx.LF;
    for (const key of Object.keys(LF.PRESETS)) {
      const model = LF.load(LF.PRESETS[key]);
      for (const opts of [{ method: 'ac', seed: 'dc' }, { method: 'ac', seed: 'flat' }, { method: 'dc' }]) {
        const ra = LF.solve(refMod, model, opts), rb = LF.solve(shipMod, model, opts);
        if (JSON.stringify(ra.raw) !== JSON.stringify(rb.raw)) throw new Error(`preset ${key} ${JSON.stringify(opts)}: shipping bundle differs`);
        presets++;
      }
    }
  }
  return { checked, pypsa, presets };
}

/* ── Main ── */
const shipCode = await bundle({ prune: true, minify: true });
for (const bad of [/papaparse/, /\brequire\(/, /\bprocess\.(env|argv|versions|platform|getBuiltinModule|cwd)\b/, /["']node:/]) {
  const m = bad.exec(shipCode);
  if (m) throw new Error(`the bundle mentions ${m[0]}: …${shipCode.slice(m.index - 60, m.index + 40)}…`);
}
const gz = gzipSync(shipCode, { level: 9 }).length;
if (gz > GZ_BUDGET) throw new Error(`bundle is ${gz} bytes gzipped, over the ${GZ_BUDGET} budget`);

if (CHECK) {
  const dir = mkdtempSync(join(tmpdir(), 'lf-engine-'));
  try {
    const refMod = await importText(dir, 'ref.mjs', await bundle({ prune: false, minify: false }));
    const shipMod = await importText(dir, 'ship.mjs', shipCode);
    const r = await selfTest(refMod, shipMod);
    console.log(`self-test: ${r.checked} values and runs identical to the source, ${r.pypsa} pf_small networks match PyPSA, ${r.presets} preset runs identical`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

const PYPSA_VERSION = (await import(pathToFileURL(join(PSA, 'src', 'data', 'definitions.js')).href)).default.pypsa_version;
const sha = createHash('sha256').update(shipCode).digest('hex');
const banner = `/*! PSA.js power flow for the Load Flow Simulator (tool.adjiebrotots.com/loadflow-simulator/).
 * Built from github.com/adjiebrotot/PSA.js @ ${COMMIT}${DIRTY}, version ${PKG.version},
 * a JavaScript port of PyPSA (reference ${PYPSA_VERSION}).
 * Patched at build time (loadflow-simulator/_build/build-engine.mjs): core/csv.js reduced to
 * pyFloatRepr (no papaparse); component definitions pruned to what the power flow reads.
 * MIT licence, see engine/LICENSE.txt. sha256 of the code below: ${sha}
 */
`;
mkdirSync(join(TOOL, 'engine'), { recursive: true });
writeFileSync(join(TOOL, 'engine', 'psa-pf.min.js'), banner + shipCode);
writeFileSync(join(TOOL, 'engine', 'LICENSE.txt'), MIT);

// gifenc, already minified upstream; kept with its own licence.
const gifDir = join(HERE, 'node_modules', 'gifenc');
const gifPkg = JSON.parse(readFileSync(join(gifDir, 'package.json'), 'utf8'));
const gifSrc = readFileSync(join(gifDir, 'dist', 'gifenc.esm.js'), 'utf8').replace(/\n\/\/# sourceMappingURL=.*$/m, '');
const gifLicence = readFileSync(join(gifDir, 'LICENSE.md'), 'utf8').trim();
mkdirSync(join(TOOL, 'vendor'), { recursive: true });
writeFileSync(join(TOOL, 'vendor', 'gifenc.js'), `/*! gifenc ${gifPkg.version} (github.com/mattdesl/gifenc)\n${gifLicence}\n*/\n` + gifSrc + '\n');

console.log(`engine/psa-pf.min.js: ${shipCode.length} bytes, ${gz} gzipped, PSA.js ${COMMIT.slice(0, 7)}${DIRTY}`);
