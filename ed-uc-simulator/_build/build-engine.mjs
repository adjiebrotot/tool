// Build the ED/UC Simulator's engine: the optimisation part of PSA.js
// (github.com/adjiebrotot/PSA.js, a JavaScript port of PyPSA) as one minified
// browser module, plus the HiGHS solver (highs-js, WebAssembly) it calls and
// the vendored GIF encoder.
//
//   cd ed-uc-simulator/_build && npm install && node build-engine.mjs [--psa=<PSA.js checkout>] [--no-check]
//
// PSA.js is only ever READ. Every change below is made in memory by an esbuild
// plugin, so the checkout is left exactly as it was found:
//
//   1. core/csv.js is replaced by a shim holding only pyFloatRepr(), cut
//      verbatim from csv.js. network.js needs that one pure function, and
//      csv.js would otherwise pull in papaparse.
//   2. data/definitions.js is pruned. Every component type stays, with the
//      attribute fields the model reads; descriptions and units go, except on
//      Link and Process, whose extra ports copy them.
//   3. The bare import "highs" (optimization/linopy.js) points at ./highs.mjs,
//      the highs-js ES module copied beside the bundle. It fetches highs.wasm
//      from its own folder on first use, so the solver downloads only when a
//      dispatch is first run.
//
// Before anything is written, a self-test runs PSA.js's own unit commitment
// and dispatch parity scenarios (opt_uc, opt_uc_more, opt_committable_extendable,
// opt_misc) through the shipping bundle and holds every LP file, objective and
// network to PyPSA's fixtures. It also runs every Quick Start of the tool
// through a reference bundle (csv shim only, definitions untouched, not
// minified) and the shipping bundle and requires every number to be identical.
//
// Output: ../engine/psa-opt.min.js, ../engine/highs.mjs, ../engine/highs.wasm,
//         ../engine/LICENSE.txt, ../vendor/gifenc.js

import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TOOL = resolve(HERE, '..');
const arg = (k) => { const a = process.argv.find(s => s.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : null; };
const PSA = resolve(arg('psa') || process.env.PSA_DIR || resolve(TOOL, '..', '..', 'PSA.js'));
const CHECK = !process.argv.includes('--no-check');
const GZ_BUDGET = 90 * 1024;
const HIGHS_DIR = join(HERE, 'node_modules', 'highs');

if (!existsSync(join(PSA, 'src', 'optimization', 'optimize.js'))) {
  console.error(`No PSA.js checkout at ${PSA}. Pass --psa=<path>.`);
  process.exit(1);
}
if (!existsSync(join(HIGHS_DIR, 'build', 'highs.mjs'))) {
  console.error('highs is not installed here. Run npm install in ed-uc-simulator/_build first.');
  process.exit(1);
}

const git = (...a) => { try { return execFileSync('git', ['-C', PSA, ...a], { encoding: 'utf8' }).trim(); } catch { return ''; } };
const COMMIT = git('rev-parse', 'HEAD') || 'unknown';
const DIRTY = git('status', '--porcelain', '--', 'src') ? ' (with local changes)' : '';
const PKG = JSON.parse(readFileSync(join(PSA, 'package.json'), 'utf8'));
const HIGHS_PKG = JSON.parse(readFileSync(join(HIGHS_DIR, 'package.json'), 'utf8'));
// The solver shipped is the one PSA.js is tested with.
const WANT_HIGHS = (PKG.dependencies || {}).highs;
if (WANT_HIGHS && WANT_HIGHS.replace(/^[~^]/, '') !== HIGHS_PKG.version) {
  console.error(`PSA.js pins highs ${WANT_HIGHS}, but ${HIGHS_PKG.version} is installed here. Pin the same version in package.json.`);
  process.exit(1);
}

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

/* ── The entry: Network with its optimiser, the logger, the type tables ── */
const ENTRY = `
export { Network } from './network/network.js';
import './network/power_flow.js';
import './optimization/optimize.js';
import './consistency.js';
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
    name: 'psa-opt',
    setup(b) {
      b.onResolve({ filter: /^ed-entry$/ }, () => ({ path: 'ed-entry', namespace: 'ed' }));
      b.onLoad({ filter: /^ed-entry$/, namespace: 'ed' }, () => ({ contents: ENTRY, resolveDir: join(PSA, 'src'), loader: 'js' }));
      b.onResolve({ filter: /core[\\/]csv\.js$/ }, () => ({ path: 'ed-csv-shim', namespace: 'ed' }));
      b.onLoad({ filter: /^ed-csv-shim$/, namespace: 'ed' }, () => ({ contents: pyFloatReprSource(), loader: 'js' }));
      if (prune) b.onLoad({ filter: /data[\\/]definitions\.js$/ }, async () => ({ contents: await prunedDefinitions(), loader: 'js' }));
      // The solver: the highs-js module beside the bundle, loaded on first use.
      b.onResolve({ filter: /^highs$/ }, () => ({ path: './highs.mjs', external: true }));
      // Anything else that is not a relative file of PSA.js has no place in the browser bundle.
      b.onResolve({ filter: /^[^./]/ }, (a) => {
        if (a.path === 'ed-entry' || a.path === 'ed-csv-shim' || a.path === 'highs') return null;
        return { errors: [{ text: `bare import "${a.path}" from ${a.importer} would not load in a browser` }] };
      });
    },
  };
}

async function bundle({ prune, minify }) {
  const r = await build({
    entryPoints: ['ed-entry'], bundle: true, format: 'esm', target: 'es2020', platform: 'neutral',
    minify, legalComments: 'none', write: false, plugins: [plugin({ prune })], logLevel: 'silent',
  });
  return r.outputFiles[0].text;
}

const MIT = `PSA.js and PyPSA
================

MIT License

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
const quiet = (m) => { m.logger.handler = () => {}; };

// A small op runner for PSA.js's scenario files: the ops a dispatch scenario
// built from scratch uses. A scenario segment that starts from an example
// network (load_example) needs the CSV reader, which the bundle leaves out, so
// it is skipped up to the next new_network.
async function runOps(psa, ops, onRecord) {
  const decode = (v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if ('$float' in v) return v.$float === 'inf' ? Infinity : v.$float === '-inf' ? -Infinity : NaN;
      if ('$ts' in v) return v.$ts;
      const keys = Object.keys(v).filter(k => k.startsWith('$'));
      if (keys.length) throw new Error('unsupported value ' + keys[0]);
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, decode(x)]));
    }
    return Array.isArray(v) ? v.map(decode) : v;
  };
  let n = null, skip = false, ran = 0;
  const results = {};
  for (const op of ops) {
    const [kind] = op;
    if (kind === 'new_network') { n = new psa.Network(op[1] ?? {}); skip = false; continue; }
    if (kind === 'load_example') { skip = true; continue; }
    if (skip) continue;
    try {
      if (kind === 'set_snapshots') n.set_snapshots(decode(op[1]), op[2] ?? {});
      else if (kind === 'add') n.add(op[1], decode(op[2]), decode(op[3] ?? {}), op[4] ?? {});
      else if (kind === 'set_static') { for (const [k, v] of Object.entries(op[3])) n.c.get(op[1]).static.setAt(k, op[2], decode(v)); }
      else if (kind === 'set_dynamic') {
        const c = n.c.get(op[1]);
        for (const [k, v] of Object.entries(op[3])) {
          const df = c.dynamic[op[2]], val = decode(v);
          df.set(k, typeof val === 'number' ? new Float64Array(df.index.length).fill(val) : Float64Array.from(val));
        }
      } else if (kind === 'call') {
        if (op[1] !== 'optimize') throw new Error('unsupported call ' + op[1]);
        const kw = decode(op[3] ?? {});
        results[op[4]] = await n.optimize(...(Object.keys(kw).length ? [kw] : []));
        ran++;
      } else if (kind === 'record') {
        const [, key, what] = op;
        if (what === 'network') onRecord(key, 'network', n);
        else if (what === 'result') onRecord(key, 'result', results[op[3]]);
        else if (what === 'path') { let o = n; for (const p of op[3]) { if (Array.isArray(p)) throw new Error('unsupported path call'); o = o[p]; } onRecord(key, 'value', o); }
        else if (what === 'lp') onRecord(key, 'lp', n.optimize.create_model(decode(op[3] ?? {})).to_lp());
        else throw new Error('unsupported record ' + what);
      } else throw new Error('unsupported op ' + kind);
    } catch (err) {
      // An op this runner does not know drops the rest of that network.
      if (/^unsupported/.test(err.message)) { skip = true; continue; }
      throw err;
    }
  }
  return ran;
}

async function selfTest(refMod, shipMod) {
  quiet(refMod); quiet(shipMod);
  const helpers = await import(pathToFileURL(join(PSA, 'test', 'helpers.js')).href);
  const runner = await import(pathToFileURL(join(PSA, 'test', 'scenario_runner.js')).href);
  let lp = 0, values = 0, networks = 0, solves = 0;

  // 1. PyPSA's own numbers, through the shipping bundle.
  for (const name of ['opt_uc', 'opt_uc_more', 'opt_committable_extendable', 'opt_misc']) {
    const scenario = JSON.parse(readFileSync(join(PSA, 'test', 'scenarios', name + '.json'), 'utf8'));
    const fixture = helpers.loadFixture('scenario_' + name);
    const tol = { ...(scenario.tolerance ?? { rtol: 1e-6, atol: 1e-6 }), path_tolerance: scenario.path_tolerance ?? {} };
    solves += await runOps(shipMod, scenario.ops, (key, kind, v) => {
      const exp = fixture.records[key];
      if (!exp) return;
      const opts = { ...tol, ...(scenario.record_tolerance?.[key] ?? {}), path: `${name} ${key} vs PyPSA` };
      if (kind === 'lp') { helpers.assertLpMatches ? helpers.assertLpMatches(v, exp.text, opts) : runner.assertLpMatches(v, exp.text, opts); lp++; }
      else if (kind === 'network') { helpers.assertNetworkMatches(v, exp, opts); networks++; }
      else { runner.assertRecordMatches(v, exp, opts); values++; }
    });
  }

  // 2. The tool's own Quick Starts through ed-core.js: shipping bundle identical to the source.
  // ed-core.js is loaded into this realm (PSA.js reads option objects by their prototype).
  let presets = 0;
  const corePath = join(TOOL, 'ed-core.js');
  if (existsSync(corePath)) {
    await import(pathToFileURL(corePath).href + '?t=' + Date.now());
    const ED = globalThis.ED;
    for (const key of Object.keys(ED.PRESETS)) {
      const base = ED.PRESETS[key].opts || {};
      for (const mode of ['uc', 'lin', 'ed']) {
        const opts = { ...base, mode };
        const model = ED.load(ED.PRESETS[key].model);
        const ra = await ED.solve(refMod, model, opts), rb = await ED.solve(shipMod, model, opts);
        if (!ra.report.ok) throw new Error(`preset ${key} ${JSON.stringify(opts)} did not solve: ${ra.report.error}`);
        if (JSON.stringify(ra.raw) !== JSON.stringify(rb.raw)) throw new Error(`preset ${key} ${JSON.stringify(opts)}: shipping bundle differs from the source`);
        presets++;
      }
    }
  }
  return { lp, values, networks, solves, presets };
}

/* ── Main ── */
const shipCode = await bundle({ prune: true, minify: true });
for (const bad of [/papaparse/, /\brequire\(/, /\bprocess\.(env|argv|versions|platform|getBuiltinModule|cwd)\b/, /["']node:/, /h5wasm/]) {
  const m = bad.exec(shipCode);
  if (m) throw new Error(`the bundle mentions ${m[0]}: …${shipCode.slice(m.index - 60, m.index + 40)}…`);
}
if (!/import\(["']\.\/highs\.mjs["']\)/.test(shipCode)) throw new Error('the bundle does not load ./highs.mjs');
const gz = gzipSync(shipCode, { level: 9 }).length;
if (gz > GZ_BUDGET) throw new Error(`bundle is ${gz} bytes gzipped, over the ${GZ_BUDGET} budget`);

if (CHECK) {
  const dir = mkdtempSync(join(tmpdir(), 'ed-engine-'));
  try {
    for (const f of ['highs.mjs', 'highs.wasm']) copyFileSync(join(HIGHS_DIR, 'build', f), join(dir, f));
    writeFileSync(join(dir, 'ref.mjs'), await bundle({ prune: false, minify: false }));
    writeFileSync(join(dir, 'ship.mjs'), shipCode);
    const refMod = await import(pathToFileURL(join(dir, 'ref.mjs')).href);
    const shipMod = await import(pathToFileURL(join(dir, 'ship.mjs')).href);
    const r = await selfTest(refMod, shipMod);
    console.log(`self-test: ${r.solves} PyPSA scenarios solved; ${r.lp} LP files, ${r.values} objectives and statuses, ${r.networks} networks match PyPSA; ${r.presets} preset runs identical to the source`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

const PYPSA_VERSION = (await import(pathToFileURL(join(PSA, 'src', 'data', 'definitions.js')).href)).default.pypsa_version;
const sha = createHash('sha256').update(shipCode).digest('hex');
const banner = `/*! PSA.js optimiser for the ED/UC Simulator (tool.adjiebrotots.com/ed-uc-simulator/).
 * Built from github.com/adjiebrotot/PSA.js @ ${COMMIT}${DIRTY}, version ${PKG.version},
 * a JavaScript port of PyPSA (reference ${PYPSA_VERSION}). Solver: highs-js ${HIGHS_PKG.version} (./highs.mjs).
 * Patched at build time (ed-uc-simulator/_build/build-engine.mjs): core/csv.js reduced to
 * pyFloatRepr (no papaparse); component definitions pruned to what the model reads.
 * MIT licence, see engine/LICENSE.txt. sha256 of the code below: ${sha}
 */
`;
mkdirSync(join(TOOL, 'engine'), { recursive: true });
writeFileSync(join(TOOL, 'engine', 'psa-opt.min.js'), banner + shipCode);

// highs-js: the ES module and its WebAssembly, as published, with a banner.
const highsJs = readFileSync(join(HIGHS_DIR, 'build', 'highs.mjs'), 'utf8').replace(/\n\/\/# sourceMappingURL=.*$/m, '');
const wasmSha = createHash('sha256').update(readFileSync(join(HIGHS_DIR, 'build', 'highs.wasm'))).digest('hex');
writeFileSync(join(TOOL, 'engine', 'highs.mjs'), `/*! highs-js ${HIGHS_PKG.version} (github.com/lovasoa/highs-js), the HiGHS solver (highs.dev) as WebAssembly, as published. MIT licence, see engine/LICENSE.txt. highs.wasm sha256 ${wasmSha} */\n` + highsJs);
copyFileSync(join(HIGHS_DIR, 'build', 'highs.wasm'), join(TOOL, 'engine', 'highs.wasm'));
const highsLicence = readFileSync(join(HIGHS_DIR, 'LICENSE'), 'utf8').trim();
writeFileSync(join(TOOL, 'engine', 'LICENSE.txt'), MIT + `\n\nhighs-js and HiGHS (highs.mjs, highs.wasm)\n==========================================\n\n${highsLicence}\n`);

// gifenc, already minified upstream; kept with its own licence.
const gifDir = join(HERE, 'node_modules', 'gifenc');
const gifPkg = JSON.parse(readFileSync(join(gifDir, 'package.json'), 'utf8'));
const gifSrc = readFileSync(join(gifDir, 'dist', 'gifenc.esm.js'), 'utf8').replace(/\n\/\/# sourceMappingURL=.*$/m, '');
const gifLicence = readFileSync(join(gifDir, 'LICENSE.md'), 'utf8').trim();
mkdirSync(join(TOOL, 'vendor'), { recursive: true });
writeFileSync(join(TOOL, 'vendor', 'gifenc.js'), `/*! gifenc ${gifPkg.version} (github.com/mattdesl/gifenc)\n${gifLicence}\n*/\n` + gifSrc + '\n');

const wasmGz = gzipSync(readFileSync(join(TOOL, 'engine', 'highs.wasm')), { level: 9 }).length;
console.log(`engine/psa-opt.min.js: ${shipCode.length} bytes, ${gz} gzipped, PSA.js ${COMMIT.slice(0, 7)}${DIRTY}; highs ${HIGHS_PKG.version}: ${wasmGz} bytes gzipped`);
