// Tests for the PowerFactory blocks (wave 2, "pf-blocks"): js/blocks/model.js and study.js.
//
// Run from the repo root (D:\Repository\tool):
//   node powerfactory-scripter/builder/_audit/blocks/pf/run.mjs              everything
//   node powerfactory-scripter/builder/_audit/blocks/pf/run.mjs --no-live    without PowerFactory
//   node powerfactory-scripter/builder/_audit/blocks/pf/run.mjs --live=n1,emt   only these live runs
// Needs Python 3.12 as "python" (py_compile; the live runs also need PowerFactory 2024 and the
// two "(Builder test)" sandboxes). Prints "pf blocks tests: N passed, M failed", exit 1 on a
// failure.
//
// (a) generation: every block with its defaults, every select value, each bool flipped, every
//     input wired and unwired, every pinnable setting pinned: generate() gives no unexpected
//     problem and every script compiles (python -m py_compile, one process for all of them);
//     the validators (E1 scenario warning, unbalanced fault, results after a model write, reads
//     after a simulation), loops that restore, monitors, and the wording rules.
// (b) live: workflows built from the real blocks are generated into live/, run on the sandboxes
//     through pfrun.py (live_wrap.py around them audits the sandbox before and after), and their
//     stdout / run.log / exit code checked.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
const { buildPackage } = await import(pathToFileURL(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..'), 'js/ui/package.js')).href);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILDER = path.resolve(HERE, '..', '..', '..');
const imp = (rel) => import(pathToFileURL(path.join(BUILDER, rel)).href);
// Only the block files these tests use (not index.js), so another category's file being edited
// at the same time cannot stop them; the order is index.js's.
for (const f of ['start', 'flow', 'values', 'model', 'study', 'check', 'result', 'search', 'advanced']) await imp(`js/blocks/${f}.js`);
const { generate } = await imp('js/core/codegen.js');
const REG = await imp('js/core/registry.js');
const { RUNTIME_FILES } = await imp('js/core/runtime-loader.js');

const ARGS = process.argv.slice(2);
const NO_LIVE = ARGS.includes('--no-live') || !process.env.PFB_PFRUN;
if (!process.env.PFB_PFRUN && !ARGS.includes('--no-live')) console.log('PFB_PFRUN is not set: the live PowerFactory part is skipped.');
const LIVE_ONLY = (ARGS.find(a => a.startsWith('--live=')) || '').slice(7).split(',').filter(Boolean);
// The lock runner for live PowerFactory runs (one engine at a time) is a local file, not in the
// repo: point PFB_PFRUN at it. Without it the live part is skipped.
const PFRUN = process.env.PFB_PFRUN || '';

const RUNTIME = {};
for (const f of RUNTIME_FILES) {
  const p = path.join(BUILDER, 'runtime', f);
  if (fs.existsSync(p)) RUNTIME[f] = fs.readFileSync(p, 'utf8');
}

const GEN_DIR = path.join(HERE, 'generated');
const LIVE_DIR = path.join(HERE, 'live');
const LIVE_OUT = path.join(LIVE_DIR, 'out');
const LOG_DIR = path.join(HERE, 'logs');
fs.rmSync(GEN_DIR, { recursive: true, force: true });
for (const d of [GEN_DIR, LIVE_DIR, LIVE_OUT, LOG_DIR]) fs.mkdirSync(d, { recursive: true });

// ---------------------------------------------------------------------------------------------
// Harness

const results = [];
let current = null;
class Fail extends Error {}
const ok = (cond, msg) => { if (!cond) throw new Fail(msg || 'expected true'); };
const has = (text, part, msg) => { if (!String(text).includes(part)) throw new Fail((msg ? msg + ': ' : '') + `missing: ${part}`); };
const hasNot = (text, part, msg) => { if (String(text).includes(part)) throw new Fail((msg ? msg + ': ' : '') + `unexpected: ${part}`); };
const eqArr = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Fail(`${msg || 'list'}: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`); };
const near = (a, b, tol, msg) => { if (!(Math.abs(Number(a) - Number(b)) <= tol)) throw new Fail(`${msg || 'value'}: got ${a}, expected ${b} +- ${tol}`); };
function test(name, fn) {
  current = name;
  try { fn(); results.push({ name, ok: true }); } catch (e) { results.push({ name, ok: false, msg: e instanceof Fail ? e.message : (e && e.stack) || String(e) }); }
  current = null;
}
const toCompile = [];   // { file, test }
let genN = 0;

// Workflow DSL (as the codegen tests): nodes { id: [type, settings, { label, pin }] }, flow
// 'a>b' or 'a.out>b', data 'a.port>b.port'.
function W(nodes, flow = [], data = [], name = 'pf blocks test') {
  const ns = Object.entries(nodes).map(([id, [type, s = {}, extra = {}]]) => ({ id, type, x: 0, y: 0, label: extra.label || '', s, pin: extra.pin || [] }));
  const edges = [];
  let k = 1;
  for (const f of flow) {
    const [a, b] = f.split('>');
    const [from, out] = a.includes('.') ? a.split('.') : [a, 'next'];
    edges.push({ id: 'e' + k++, from, out, to: b, in: 'in' });
  }
  for (const d of data) {
    const [a, b] = d.split('>');
    const [from, out] = a.split('.');
    const [to, inn] = b.split('.');
    edges.push({ id: 'e' + k++, from, out, to, in: inn });
  }
  return { app: 'pf-builder', v: 1, name, nodes: ns, edges, view: { x: 0, y: 0, zoom: 1 } };
}
function gen(wf, tag) {
  const r = generate(wf, { runtime: RUNTIME });
  const file = path.join(GEN_DIR, `${String(++genN).padStart(4, '0')}_${tag.replace(/[^A-Za-z0-9_.-]+/g, '_').slice(0, 80)}.py`);
  fs.writeFileSync(file, r.code);
  toCompile.push({ file, test: current || tag });
  return r;
}
const probs = (r, level) => r.problems.filter(p => !level || p.level === level);
const ptext = (r) => r.problems.map(p => `[${p.level}] ${p.msg}`).join('\n');
const hasP = (r, level, re, nodeId) => r.problems.some(p => p.level === level && re.test(p.msg) && (!nodeId || p.nodeId === nodeId));
const mainBody = (code) => { const a = code.indexOf('def main():'); const b = code.indexOf('# ==== HELPERS'); return code.slice(a, b); };

const N9 = 'Nine-bus System (Builder test)';
const N39 = '39 Bus New England System (Builder test)';
const EL = (cls, name, match = 'one') => ({ cls, name, match });
const START = ['start', { project: N9 }];

// ---------------------------------------------------------------------------------------------
// (a) Generation sweep: every block, every select value, wired and unwired inputs, pins

const MINE = [...REG.blocksIn('model'), ...REG.blocksIn('study')].map(b => b.type);
const REC = [{ id: 'r1', el: EL('ElmTerm', 'Bus 5'), var: 'm:fehz', combine: 'none' }, { id: 'r2', el: EL('ElmSym', 'G*', 'all'), var: 's:speed', combine: 'spread' }];
const FILL = {
  'pf.element': { el: EL('ElmTerm', 'Bus 5') },
  'pf.foreach_element': { el: EL('ElmTerm', '*', 'all') },
  'pf.set': { el: EL('ElmLod', 'Load A'), attr: 'plini', value: 120, text: 'constq' },
  'pf.get': { el: EL('ElmTerm', 'Bus 5'), attr: 'm:u' },
  'pf.dispatch': { gen: EL('ElmSym', 'G2'), cols: [{ id: 'g1', col: 'G2', gen: EL('ElmSym', '') }, { id: 'g2', col: 'Gen 3', gen: EL('ElmGenstat', 'G3') }] },
  'pf.scale': { el: EL('ElmLod', 'Load A'), attr2: 'qlini' },
  'pf.outserv': { el: EL('ElmLne', 'Line 5-7') },
  'pf.case.activate': { case: '01- Load Flow' },
  'pf.scen.activate': { scen: 'EMT' },
  'pf.var.activate': { variation: 'Shunt Compensator' },
  'pf.var.deactivate': { variation: 'Shunt Compensator' },
  'pf.testgen': { bus: EL('ElmTerm', 'Bus 5') },
  'pf.shc': { target: EL('ElmTerm', 'Bus 5') },
  'pf.rms': { record: REC },
  'pf.emt': { record: REC },
  'pf.evt.shc': { target: EL('ElmTerm', 'Bus 7') },
  'pf.evt.switch': { el: EL('ElmCoup', 'Breaker 1') },
  'pf.evt.trip': { el: EL('ElmSym', 'G2') },
  'pf.evt.load': { load: EL('ElmLod', 'Load A') },
  'pf.evt.param': { el: EL('ElmDsl', 'AVR 1'), param: 'Vref' },
  'pf.evt.steps': { el: EL('ElmVac', 'Grid Max SC'), param: 's:u0', steps: [{ id: 's1', t: 1, v: 1.3 }, { id: 's2', t: 2, v: 1.2 }, { id: 's3', t: 12, v: 1.1 }] },
  'sig.series': { el: EL('ElmTerm', 'Bus 5') },
};

// A source block for a data input of this type: [type, settings, output port].
function sourceFor(type, port, host) {
  if (type === 'num') return ['val.number', { value: 2 }, 'value'];
  if (type === 'bool') return ['val.bool', { value: true }, 'value'];
  if (type === 'text') return ['val.text', { value: 'PFB text' }, 'value'];
  if (type === 'any') return ['val.text', { value: host === 'pf.scen.activate' ? 'EMT' : host === 'pf.var.activate' || host === 'pf.var.deactivate' ? 'Shunt Compensator' : '01- Load Flow' }, 'value'];
  if (type === 'items') return ['val.list', { values: host === 'pf.scen.foreach' ? 'EMT' : host === 'pf.var.foreach' ? 'Shunt Compensator, YNd Transformers' : '01- Load Flow, 02- Five Cycles Classical SG Model' }, 'value'];
  if (type === 'obj') return ['pf.element', { el: EL((port.kinds && port.kinds[0]) || 'ElmTerm', port.id === 'items' || port.id === 'elements' ? '*' : 'X 1', port.id === 'items' || port.id === 'elements' ? 'all' : 'one') }, 'el'];
  if (type === 'cset') return ['pf.cont.define', {}, 'conts'];
  if (type === 'res') return ['pf.rms', {}, 'result'];
  return null;
}
const CELL_OK = new Set(['num', 'bool', 'text', 'obj', 'list', 'items', 'cell']);

// Start > [sources] > block (> a Print a message that uses its outputs) as one workflow.
function harness(type, s, { wire = [], pin = [] } = {}) {
  const def = REG.getBlock(type);
  const node = { id: 'n2', type, s, pin };
  const ports = REG.portsOf(node);
  const nodes = { n1: START, n2: [type, s, { pin }] };
  const flow = [], data = [];
  let srcN = 10;
  let before = 'n1';
  for (const p of ports.inputs) {
    if (!wire.includes(p.id) && !(p.type === 'res')) continue;
    const src = sourceFor(p.type, p, type);
    if (!src) continue;
    const id = 'n' + srcN++;
    nodes[id] = [src[0], src[1]];
    if (src[0] === 'pf.rms') { flow.push(`${before}>${id}`); before = id + '.ok'; }
    data.push(`${id}.${src[2]}>n2.${p.id}`);
  }
  const logOuts = (outs, logId) => {
    const use = outs.filter(o => CELL_OK.has(o.type)).slice(0, 4);
    const names = use.map((o, k) => 'v' + k);
    nodes[logId] = ['flow.log', { text: names.length ? names.map(n => `{${n}}`).join(' ') : 'step done' }];
    use.forEach((o, k) => data.push(`n2.${o.id}>${logId}.v${k}`));
    let last = logId;   // the logs run one after the other
    for (const o of outs.filter(o => o.type === 'series')) {
      const m = 'n' + srcN++;
      nodes[m] = ['math.max', {}];
      data.push(`n2.${o.id}>${m}.values`);
      const l2 = 'n' + srcN++;
      nodes[l2] = ['flow.log', { text: '{x}' }];
      data.push(`${m}.value>${l2}.x`);
      flow.push(`${last}>${l2}`);
      last = l2;
      break;
    }
    for (const o of outs.filter(o => o.type === 'res')) {
      const sres = 'n' + srcN++;
      nodes[sres] = ['sig.series', { el: EL('ElmTerm', 'Bus 9') }];
      data.push(`n2.${o.id}>${sres}.res`);
      const m = 'n' + srcN++;
      nodes[m] = ['math.min', {}];
      data.push(`${sres}.series>${m}.values`);
      const l3 = 'n' + srcN++;
      nodes[l3] = ['flow.log', { text: '{y}' }];
      data.push(`${m}.value>${l3}.y`);
      flow.push(`${last}>${l3}`);
      last = l3;
    }
  };
  if (def.kind === 'pure') {
    const out = ports.outputs[0];
    if (out.type === 'cset') {
      nodes.n3 = ['pf.cont.foreach', {}];
      data.push(`n2.${out.id}>n3.conts`);
      nodes.n4 = ['flow.log', { text: '{c}' }];
      data.push('n3.cont>n4.c');
      flow.push(`${before}>n3`, 'n3.body>n4');
    } else if (out.type === 'series') {
      nodes.n3 = ['math.min', {}];
      data.push(`n2.${out.id}>n3.values`);
      nodes.n4 = ['flow.log', { text: '{x}' }];
      data.push('n3.value>n4.x');
      flow.push(`${before}>n4`);
    } else {
      nodes.n4 = ['flow.log', { text: '{x}' }];
      data.push(`n2.${out.id}>n4.x`);
      flow.push(`${before}>n4`);
    }
  } else if (def.kind === 'loop') {
    flow.push(`${before}>n2`, 'n2.body>n4', 'n2.done>n5');
    logOuts(ports.outputs.filter(o => o.scope === 'body'), 'n4');
    nodes.n5 = ['flow.log', { text: 'passes {k}' }];
    const cnt = ports.outputs.find(o => o.id === 'count');
    if (cnt) data.push('n2.count>n5.k');
  } else {
    flow.push(`${before}>n2`, `n2${def.kind === 'branch' ? '.' + ports.flowOuts[0].id : ''}>n4`);
    logOuts(ports.outputs, 'n4');
  }
  return W(nodes, flow, data, 'pf blocks sweep ' + type);
}

// Problems a sweep variant may have on purpose.
function allowed(type, s, p, o = {}) {
  if (p.level === 'warning' && /changes operating data/.test(p.msg)) return false;
  if (type === 'pf.emt' && p.level === 'warning' && /EMT simulation, which can take/.test(p.msg)) return true;
  // Unwired on purpose: a table-row dispatch whose columns are not connected, contingencies of nothing.
  if (type === 'pf.dispatch' && s.mode === 'row' && !(o.wire || []).length && p.level === 'todo' && /Connect the value of column/.test(p.msg)) return true;
  if (type === 'pf.cont.define' && p.level === 'todo' && /Choose what .* takes out/.test(p.msg) && !s.lines) return true;
  return false;
}

function sweep(type) {
  const def = REG.getBlock(type);
  const base = { ...(FILL[type] || {}) };
  const variants = [['defaults', base, {}]];
  for (const st of def.settings) {
    if (st.kind === 'select') {
      for (const [v] of REG.optionPairs(st)) if (v !== st.default) variants.push([`${st.key}=${v}`, { ...base, [st.key]: v }, {}]);
    }
    if (st.kind === 'bool') variants.push([`${st.key}=${!st.default}`, { ...base, [st.key]: !st.default }, {}]);
  }
  // Inputs wired (for each select value that changes the ports, too).
  const portSets = new Map();
  for (const [name, s] of variants) {
    const ins = REG.portsOf({ id: 'n2', type, s }).inputs.map(p => p.id).filter(id => id);
    const key = ins.join(',');
    if (ins.length && !portSets.has(key)) portSets.set(key, [name, s, ins]);
  }
  for (const [key, [name, s, ins]] of portSets) variants.push([`${name}+wired`, s, { wire: ins }]);
  // Every pinnable setting pinned.
  const pins = def.settings.filter(st => st.kind !== 'list' && !st.noPin).map(st => st.key);
  if (pins.length) variants.push(['pinned', base, { pin: pins }]);
  for (const [name, s, o] of variants) {
    test(`generate ${type} [${name}]`, () => {
      const wf = harness(type, s, o);
      const r = gen(wf, `${type}_${name}`);
      const bad = r.problems.filter(p => !allowed(type, s, p, o));
      ok(!bad.length, `unexpected problems:\n${ptext(r)}`);
      has(r.code, '# -- Step', 'the block is written');
    });
  }
}
for (const t of MINE) sweep(t);

// Saved state this version does not know: never an error.
test('odd saved settings never break generation', () => {
  for (const t of MINE) {
    const s = { ...(FILL[t] || {}), net: 'bogus', fault: 9, record: 'x', cols: { a: 1 }, el: 'Bus 5', attr: 7, mode: null, which: 'gone', how: 'teleport' };
    const r = gen(harness(t, s), `odd_${t}`);
    const internal = r.problems.filter(p => /could not write|did not give a value|ports could not/.test(p.msg));
    ok(!internal.length, `${t}: ${ptext(r)}`);
  }
});

// ---------------------------------------------------------------------------------------------
// Wording and contract rules

test('wording: desc at most 200 characters, no em or en dash, keywords, verbs for steps', () => {
  const src = fs.readFileSync(path.join(BUILDER, 'js/blocks/model.js'), 'utf8') + fs.readFileSync(path.join(BUILDER, 'js/blocks/study.js'), 'utf8');
  ok(!/[\u2013\u2014]/.test(src), 'an em or en dash in model.js / study.js');
  for (const t of MINE) {
    const d = REG.getBlock(t);
    ok(d.desc && d.desc.length <= 200, `${t}: desc is ${d.desc.length} characters`);
    ok(d.keywords.length >= 5, `${t}: few keywords`);
    if (d.kind !== 'pure') ok(/^(Run|Add|Set|Read|Take|Put|Activate|Create|Save|Deactivate|For|Scale)\b/.test(d.title), `${t}: "${d.title}" is not a verb`);
  }
});

test('contract: obj inputs fall back to an element setting, kinds are known classes, number inputs fall back', () => {
  const known = new Set(REG.ELEMENT_CLASSES.map(c => c[0]));
  const optionalLists = new Set(['pf.foreach_element:items', 'pf.cont.define:elements']);
  for (const t of MINE) {
    const d = REG.getBlock(t);
    const variants = [{}];
    for (const st of d.settings) if (st.kind === 'select') for (const [v] of REG.optionPairs(st)) variants.push({ [st.key]: v });
    for (const s of variants) {
      for (const p of REG.portsOf({ id: 'x', type: t, s }).inputs) {
        if (p.type === 'obj' && !optionalLists.has(`${t}:${p.id}`)) {
          const st = d.settings.find(x => x.key === p.fallback);
          ok(st && st.kind === 'element', `${t}.${p.id}: no element fallback`);
        }
        if (p.type === 'num' && !/^g\d+$/.test(p.id)) ok(p.fallback && d.settings.some(x => x.key === p.fallback && x.kind === 'number'), `${t}.${p.id}: no number fallback`);
        for (const k of p.kinds || []) ok(known.has(k), `${t}.${p.id}: unknown class ${k}`);
      }
    }
    ok(typeof d.validate === 'function', `${t}: needs validate() (route notes)`);
  }
});

test('frozen handles: the type ids of section 9 are all defined', () => {
  const want = ['pf.element', 'pf.foreach_element', 'pf.set', 'pf.get', 'pf.dispatch', 'pf.scale', 'pf.outserv', 'pf.undo', 'pf.case.activate', 'pf.case.create',
    'pf.case.foreach', 'pf.scen.activate', 'pf.scen.create', 'pf.scen.save', 'pf.scen.deactivate', 'pf.scen.foreach', 'pf.var.activate', 'pf.var.deactivate',
    'pf.var.create', 'pf.var.foreach', 'pf.testgen', 'pf.ldf', 'pf.rms', 'pf.emt', 'pf.hldf', 'pf.shc', 'pf.evt.shc', 'pf.evt.switch', 'pf.evt.trip', 'pf.evt.load',
    'pf.evt.param', 'pf.evt.steps', 'sig.series', 'pf.cont.define', 'pf.cont.foreach'];
  for (const t of want) ok(REG.getBlock(t), `missing ${t}`);
  ok(REG.getBlock('sig.series').cat === 'study', 'sig.series lives in the study category');
  for (const t of MINE) ok(want.includes(t), `not in the catalogue: ${t}`);
});

// ---------------------------------------------------------------------------------------------
// Validators

const DISP = ['pf.dispatch', { gen: EL('ElmSym', 'G2') }];
const E1 = /changes operating data/;

test('E1: a dispatch inside For each study case warns', () => {
  const r = gen(W({ n1: START, n2: ['pf.case.foreach', {}], n3: DISP }, ['n1>n2', 'n2.body>n3']), 'e1_case_loop');
  ok(hasP(r, 'warning', E1, 'n3'), ptext(r));
  has(probs(r, 'warning').find(p => E1.test(p.msg)).msg, 'after For each study case');
});
test('E1: an operation scenario after the case switch silences it', () => {
  const r = gen(W({ n1: START, n2: ['pf.case.foreach', {}], n3: ['pf.scen.activate', { scen: 'S1' }], n4: DISP }, ['n1>n2', 'n2.body>n3', 'n3>n4']), 'e1_scen_after');
  ok(!hasP(r, 'warning', E1), ptext(r));
  const r2 = gen(W({ n1: START, n2: ['pf.case.foreach', {}], n3: ['pf.scen.create', {}], n4: DISP }, ['n1>n2', 'n2.body>n3', 'n3>n4']), 'e1_scen_create');
  ok(!hasP(r2, 'warning', E1), ptext(r2));
});
test('E1: Create study case with a scenario (default) is fine, without one it warns', () => {
  const r = gen(W({ n1: START, n2: ['pf.case.create', {}], n3: DISP }, ['n1>n2', 'n2>n3']), 'e1_create_copy');
  ok(!hasP(r, 'warning', E1), ptext(r));
  const r2 = gen(W({ n1: START, n2: ['pf.case.create', { scenario: 'none' }], n3: DISP }, ['n1>n2', 'n2>n3']), 'e1_create_none');
  ok(hasP(r2, 'warning', E1, 'n3'), ptext(r2));
  const r3 = gen(W({ n1: START, n2: ['pf.case.create', { scenario: 'none', activate: false }], n3: DISP }, ['n1>n2', 'n2>n3']), 'e1_create_inactive');
  ok(!hasP(r3, 'warning', E1), 'a case that is not activated switches nothing: ' + ptext(r3));
});
test('E1: no warning at Start (the start case may have its own scenario)', () => {
  const r = gen(W({ n1: START, n3: DISP }, ['n1>n3']), 'e1_start');
  ok(!hasP(r, 'warning', E1), ptext(r));
});
test('E1: after Deactivate operation scenario, service and set point writes warn; non-operational attributes do not', () => {
  const r = gen(W({ n1: START, n2: ['pf.scen.deactivate', {}], n3: ['pf.outserv', { el: EL('ElmLne', 'L1') }], n4: ['pf.set', { el: EL('ElmLod', 'Load A'), attr: 'plini' }],
    n5: ['pf.set', { el: EL('ElmLod', 'Load A'), attr: 'desc', vtype: 'text', text: 'x' }], n6: ['pf.scale', { el: EL('ElmLod', 'Load A') }] }, ['n1>n2', 'n2>n3', 'n3>n4', 'n4>n5', 'n5>n6']), 'e1_deactivate');
  ok(hasP(r, 'warning', E1, 'n3') && hasP(r, 'warning', E1, 'n4') && hasP(r, 'warning', E1, 'n6'), ptext(r));
  ok(!hasP(r, 'warning', E1, 'n5'), 'desc is not operating data: ' + ptext(r));
});
test('E1: after the case loop (After all passes) the start case is back: no warning', () => {
  const r = gen(W({ n1: START, n2: ['pf.case.foreach', {}], n3: ['pf.ldf', {}], n4: DISP }, ['n1>n2', 'n2.body>n3', 'n2.done>n4']), 'e1_after_loop');
  ok(!hasP(r, 'warning', E1), ptext(r));
});
test('E1: a loop of another category inside the case loop still warns; Activate study case warns', () => {
  const r = gen(W({ n1: START, n2: ['pf.case.foreach', {}], n3: ['flow.range', {}], n4: DISP }, ['n1>n2', 'n2.body>n3', 'n3.body>n4']), 'e1_nested');
  ok(hasP(r, 'warning', E1, 'n4'), ptext(r));
  const r2 = gen(W({ n1: START, n2: ['pf.case.activate', { case: 'B' }], n3: DISP }, ['n1>n2', 'n2>n3']), 'e1_activate');
  ok(hasP(r2, 'warning', E1, 'n3'), ptext(r2));
  const r3 = gen(W({ n1: START, n2: ['pf.scen.foreach', {}], n3: DISP }, ['n1>n2', 'n2.body>n3']), 'e1_scen_loop');
  ok(!hasP(r3, 'warning', E1), ptext(r3));
});
test('E1: a new run of the generator starts from a clean route (no stale notes)', () => {
  const wfA = W({ n1: START, n2: ['pf.case.foreach', {}], n3: DISP }, ['n1>n2', 'n2.body>n3']);
  const wfB = W({ n1: START, n3: DISP }, ['n1>n3']);
  ok(hasP(gen(wfA, 'e1_a'), 'warning', E1), 'A warns');
  ok(!hasP(gen(wfB, 'e1_b'), 'warning', E1), 'B (same node id) does not');
  ok(hasP(gen(wfA, 'e1_a2'), 'warning', E1), 'A again');
});

const UNB = /fault, but .* Set Network on .* to Unbalanced, 3-phase \(rst\)/;
const SHC1 = (fault) => ['pf.evt.shc', { target: EL('ElmTerm', 'Bus 7'), fault }];
test('unbalanced fault before a run whose network is not rst: error on the run', () => {
  const r = gen(W({ n1: START, n2: SHC1('1ph'), n3: ['pf.rms', {}] }, ['n1>n2', 'n2>n3']), 'unb_case');
  ok(hasP(r, 'error', UNB, 'n3'), ptext(r));
  const r2 = gen(W({ n1: START, n2: SHC1('2phg'), n3: ['pf.emt', { net: 'sym' }] }, ['n1>n2', 'n2>n3']), 'unb_emt_sym');
  ok(hasP(r2, 'error', /uses a balanced network/, 'n3'), ptext(r2));
});
test('unbalanced fault with net rst, or a three-phase fault: no error', () => {
  const r = gen(W({ n1: START, n2: SHC1('1ph'), n3: ['pf.rms', { net: 'rst' }] }, ['n1>n2', 'n2>n3']), 'unb_rst');
  ok(!probs(r, 'error').length, ptext(r));
  has(r.code, '"1ph", "a")', 'the phase goes with a 1-phase fault');
  const r2 = gen(W({ n1: START, n2: SHC1('3ph'), n3: ['pf.rms', { net: 'sym' }] }, ['n1>n2', 'n2>n3']), 'unb_3ph');
  ok(!probs(r2, 'error').length, ptext(r2));
});
test('unbalanced fault: only the next run on the route counts; a fault in a loop feeds the run after it', () => {
  const r = gen(W({ n1: START, n2: SHC1('1ph'), n3: ['pf.rms', { net: 'rst' }], n4: ['pf.rms', { net: 'sym' }] }, ['n1>n2', 'n2>n3', 'n3.ok>n4']), 'unb_next');
  ok(!probs(r, 'error').length, 'the second run has no fault of its own: ' + ptext(r));
  const r2 = gen(W({ n1: START, n2: ['flow.range', {}], n3: SHC1('2ph'), n4: ['pf.rms', { net: 'sym' }] }, ['n1>n2', 'n2.body>n3', 'n2.done>n4']), 'unb_loop');
  ok(hasP(r2, 'error', UNB, 'n4'), ptext(r2));
});

test('results read after a model write is an error (effects); element data is not', () => {
  const rd = (attr, el = EL('ElmSym', 'G2')) => ['pf.get', { el, attr }];
  const r = gen(W({ n1: START, n2: ['pf.ldf', {}], n3: ['pf.evt.trip', { el: EL('ElmSym', 'G2') }], n4: rd('m:P:bus1') }, ['n1>n2', 'n2.ok>n3', 'n3>n4']), 'e5_trip');
  ok(hasP(r, 'error', /reads results after Add trip event changed the model/, 'n4'), ptext(r));
  const r2 = gen(W({ n1: START, n2: ['pf.ldf', {}], n4: rd('m:P:bus1') }, ['n1>n2', 'n2.ok>n4']), 'e5_ok');
  ok(!probs(r2, 'error').length, ptext(r2));
  const r3 = gen(W({ n1: START, n2: ['pf.ldf', {}], n3: DISP, n4: rd('pgini') }, ['n1>n2', 'n2.ok>n3', 'n3>n4']), 'e5_model');
  ok(!probs(r3, 'error').length, ptext(r3));
  const r4 = gen(W({ n1: START, n2: ['pf.ldf', {}], n3: DISP, n4: rd('c:loading', EL('ElmLne', 'L1')) }, ['n1>n2', 'n2.ok>n3', 'n3>n4']), 'e5_dispatch');
  ok(hasP(r4, 'error', /reads results after Set generator dispatch changed the model/, 'n4'), ptext(r4));
  const r5 = gen(W({ n1: START, n2: ['pf.ldf', {}], n3: ['pf.case.activate', { case: 'B' }], n4: rd('m:u', EL('ElmTerm', 'Bus 5')) }, ['n1>n2', 'n2.ok>n3', 'n3>n4']), 'e5_case');
  ok(hasP(r5, 'error', /reads results after Activate study case/, 'n4'), ptext(r5));
});
test('Read attribute names the calculation it reads and warns on m: after a simulation', () => {
  const r = gen(W({ n1: START, n2: ['pf.rms', {}], n3: ['pf.get', { el: EL('ElmTerm', 'Bus 5'), attr: 'm:u' }] }, ['n1>n2', 'n2.ok>n3']), 'get_after_rms');
  ok(hasP(r, 'warning', /value at the end of the simulation/, 'n3'), ptext(r));
  has(r.code, '(m:u of Bus 5 (end of the RMS run))');
  const r2 = gen(W({ n1: START, n2: ['pf.ldf', {}], n3: ['pf.get', { el: EL('ElmTerm', 'Bus 5'), attr: 'm:u' }] }, ['n1>n2', 'n2.ok>n3']), 'get_after_ldf');
  has(r2.code, '(m:u of Bus 5 (load flow results))');
  ok(!r2.problems.length, ptext(r2));
  const r3 = gen(W({ n1: START, n2: ['pf.shc', {}], n3: ['pf.get', { el: EL('ElmTerm', 'Bus 5'), attr: 'm:Ikss' }] }, ['n1>n2', 'n2.ok>n3']), 'get_after_shc');
  has(r3.code, '(short-circuit results)');
  const s = REG.summaryOf({ id: 'n3', type: 'pf.get', s: { el: EL('ElmTerm', 'Bus 5'), attr: 'm:Ikss' } });
  has(s, 'short-circuit results', 'the canvas summary between runs keeps the last run\'s calculation');
});

// ---------------------------------------------------------------------------------------------
// Loops restore, elements found again after a case switch, monitors

test('loops: case, scenario, variation and contingency loops use the runtime generators that restore', () => {
  const body = (t, s = {}) => mainBody(gen(W({ n1: START, n2: [t, s], n3: DISP }, ['n1>n2', 'n2.body>n3']), 'loop_' + t).code);
  const c = body('pf.case.foreach');
  has(c, 'cases = case_list(app, "*")'); has(c, 'in enumerate(each_case(app, cases), 1):'); has(c, 'mark = pf_mark()'); has(c, 'pf_undo(mark)');
  has(c, 'ctx_push("Study case", study_case, pass_no, len(cases))');
  has(body('pf.scen.foreach'), 'in enumerate(each_scenario(app, scenarios), 1):');
  has(body('pf.var.foreach'), 'in enumerate(each_variation(app, variations, True), 1):');
  const k = body('pf.cont.foreach');
  has(k, 'contingencies = define_contingencies(app, ["*.ElmLne"], 1, True)'); has(k, 'enumerate(each_contingency(app, contingencies, True), 1):');
  const e = body('pf.cont.foreach', { how: 'event' });
  has(e, '([Contingency("Base case", [], "")] if True else []) + contingencies'); has(e, 'add_contingency_events(app, "n2", contingency, 1)');
  const fe = body('pf.foreach_element', { el: EL('ElmSym', 'G*', 'all') });
  has(fe, 'elements = as_items(pf_find(app, "G*.ElmSym", "all", in_service=True))');
  const ff = body('pf.foreach_element', { el: EL('ElmTerm', '*', 'all'), attr: 'uknom', op: '>', value: '100' });
  has(ff, 'find_elements(app, "ElmTerm", "*", "uknom", ">", "100", True)');
  const never = body('pf.case.foreach', { restore: 'never' });
  hasNot(never, 'pf_undo(', 'restore never');
});
test('Element is found again before each step that uses it (also inside For each study case)', () => {
  const rd = ['pf.get', { attr: 'uknom' }];
  const r = gen(W({ n1: START, n2: ['pf.element', { el: EL('ElmTerm', 'Bus 5') }], n3: rd, n4: ['pf.case.activate', { case: 'B' }], n5: rd },
    ['n1>n3', 'n3>n4', 'n4>n5'], ['n2.el>n3.obj', 'n2.el>n5.obj']), 'elem_again');
  ok((mainBody(r.code).match(/pf_find\(app, "Bus 5\.ElmTerm", "one", in_service=True\)/g) || []).length === 2, mainBody(r.code));
  const r2 = gen(W({ n1: START, n2: ['pf.element', { el: EL('ElmTerm', 'Bus 5') }], n3: rd, n4: DISP, n5: rd },
    ['n1>n3', 'n3>n4', 'n4>n5'], ['n2.el>n3.obj', 'n2.el>n5.obj']), 'elem_reuse');
  ok((mainBody(r2.code).match(/pf_find\(app, "Bus 5\.ElmTerm"/g) || []).length === 2, mainBody(r2.code));
  const r4 = gen(W({ n1: START, n2: ['pf.element', { el: EL('ElmTerm', '*', 'all') }], n3: rd, n4: ['pf.case.foreach', {}], n5: ['pf.get', { attr: 'm:u' }], n6: ['pf.ldf', {}] },
    ['n1>n3', 'n3>n4', 'n4.body>n6', 'n6.ok>n5'], ['n2.el>n3.obj', 'n2.el>n5.obj']), 'elem_case_loop');
  const inLoop = mainBody(r4.code).split('each_case(')[1] || '';
  ok(/pf_find\(app, "\*\.ElmTerm", "all", in_service=True\)/.test(inLoop), 'found again in each pass: ' + mainBody(r4.code));
  const r3 = gen(W({ n1: START, n2: ['pf.cont.define', {}], n3: ['pf.case.activate', { case: 'B' }], n4: ['pf.cont.foreach', {}], n5: ['flow.log', { text: 'x' }] },
    ['n1>n3', 'n3>n4', 'n4.body>n5'], ['n2.conts>n4.conts']), 'cont_define_case');
  has(mainBody(r3.code), 'define_contingencies(app, ["*.ElmLne"], int("1"), True)');
});
test('monitors: Read time series records its element during the run, a later element loop records the whole list', () => {
  const r = gen(W({ n1: START, n2: ['pf.rms', {}], n3: ['pf.element', { el: EL('ElmTerm', 'Bus 9') }], n4: ['sig.series', { var: 'm:u' }], n5: ['math.min', {}], n6: ['flow.log', { text: '{v}' }] },
    ['n1>n2', 'n2.ok>n6'], ['n2.result>n4.res', 'n3.el>n4.element', 'n4.series>n5.values', 'n5.value>n6.v']), 'mon_one');
  const b = mainBody(r.code);
  ok(/bus_9 = pf_find\(app, "Bus 9\.ElmTerm", "one", in_service=True\)[^\n]*\n\s+rms = run_rms\(app, 10, None, None, monitors=\[\(bus_9, "m:u"\)\]/.test(b), b);
  ok(!r.problems.length, ptext(r));
  const r2 = gen(W({ n1: START, n2: ['pf.rms', {}], n3: ['pf.foreach_element', { el: EL('ElmTerm', 'Bus*', 'all') }], n4: ['sig.series', { var: 'm:fehz' }], n5: ['math.min', {}], n6: ['flow.log', { text: '{v}' }] },
    ['n1>n2', 'n2.ok>n3', 'n3.body>n6'], ['n2.result>n4.res', 'n3.item>n4.element', 'n4.series>n5.values', 'n5.value>n6.v']), 'mon_each');
  has(mainBody(r2.code), 'monitor_lists=[(as_items(pf_find(app, "Bus*.ElmTerm", "all", in_service=True)), "m:fehz")]');
  ok(!r2.problems.length, ptext(r2));
});
test('Record rows: one series output each, labels with the variable, combined matches, only used rows read', () => {
  const s = { record: REC };
  const p = REG.portsOf({ id: 'n2', type: 'pf.rms', s });
  const r1 = p.outputs.find(o => o.id === 'r1'), r2 = p.outputs.find(o => o.id === 'r2');
  // The port label leaves the unit to the card (it shows "(Hz)" from `unit`); the Python label keeps it.
  ok(r1 && r1.label === 'Bus 5 · Frequency' && r1.unit === 'Hz' && r1.type === 'series', JSON.stringify(r1));
  ok(r2 && r2.label === 'Spread of G* · Speed' && r2.unit === 'p.u.', JSON.stringify(r2));
  const r = gen(W({ n1: START, n2: ['pf.rms', s], n3: ['math.min', {}], n4: ['flow.log', { text: '{v}' }] }, ['n1>n2', 'n2.ok>n4'], ['n2.r1>n3.values', 'n3.value>n4.v']), 'record');
  const b = mainBody(r.code);
  has(b, 'rec_bus_5 = pf_find(app, "Bus 5.ElmTerm", "one")'); has(b, 'rec_g = pf_find(app, "G*.ElmSym", "all")');
  has(b, 'monitors=[(rec_bus_5, "m:fehz")], monitor_lists=[(rec_g, "s:speed")]');
  has(b, '= rms.series(rec_bus_5, "m:fehz", "Bus 5 \\u00b7 Frequency (Hz)")'); hasNot(b, 'series_combined', 'an unused row is recorded but not read');
  const bad = gen(W({ n1: START, n2: ['pf.rms', { record: [{ id: 'r1', el: EL('ElmTerm', 'Bus*', 'all'), var: 'm:u', combine: 'none' }, { id: 'r2', el: EL('ElmTerm', ''), var: 'm:u', combine: 'none' }] }] }, ['n1>n2']), 'record_bad');
  ok(hasP(bad, 'error', /takes every element named Bus\* but records one curve/) && hasP(bad, 'todo', /element of Record curve 2/), ptext(bad));
  // A row saved with plain cls / name columns (an early draft) still reads.
  const old = gen(W({ n1: START, n2: ['pf.rms', { record: [{ id: 'r1', cls: 'ElmSym', name: 'G 02', var: 's:speed' }] }], n3: ['math.min', {}], n4: ['flow.log', { text: '{v}' }] }, ['n1>n2', 'n2.ok>n4'], ['n2.r1>n3.values', 'n3.value>n4.v']), 'record_old');
  has(mainBody(old.code), 'rec_g_02 = pf_find(app, "G 02.ElmSym", "one")');
});
test('Record rows are in the CHECK_ONLY element check', () => {
  const r = gen(W({ n1: START, n2: ['pf.rms', { record: REC }], n3: ['math.min', {}], n4: ['flow.log', { text: '{v}' }] }, ['n1>n2', 'n2.ok>n4'], ['n2.r1>n3.values', 'n3.value>n4.v']), 'record_check');
  has(mainBody(r.code), 'check_elements(app, ["Bus 5.ElmTerm", ("G*.ElmSym", "all")])');
});
test('simulation outputs and branches: Reached the end / Stopped early / Did not initialise', () => {
  const r = gen(W({ n1: START, n2: ['pf.rms', { tstop: 20, step: 0.01, tstart: -0.1, net: 'sym', fast: true, extendTo: 60, caseEvents: 'off' }], n3: ['flow.log', { text: 'ok {t}' }], n4: ['flow.log', { text: 'early' }], n5: ['flow.log', { text: 'no init {s}' }] },
    ['n1>n2', 'n2.ok>n3', 'n2.early>n4', 'n2.fail>n5'], ['n2.t_end>n3.t', 'n2.status>n5.s']), 'sim_branches');
  const b = mainBody(r.code);
  has(b, 'rms = run_rms(app, 20, -0.1, 0.01, monitors=[], monitor_lists=[], net="sym", case_events="off", fast=True, extend_to=60)');
  has(b, 'rms.status == "ok"'); has(b, 'rms.status == "early"');
  ok(!r.problems.length, ptext(r));
  const e = gen(W({ n1: START, n2: ['pf.emt', { step: 0.00005, tstop: 0.2, net: 'rst' }] }, ['n1>n2']), 'emt');
  has(mainBody(e.code), 'emt = run_emt(app, 0.2, None, 0.00005, monitors=[], monitor_lists=[], net="rst"');
});
test('events: one event per block keyed by the node id, inputs swept from a loop', () => {
  const r = gen(W({ n1: START, n2: ['flow.range', { from: 0.1, to: 0.3, step: 0.1 }], n3: ['pf.evt.shc', { target: EL('ElmLne', 'Line 5-7'), clear: 'trip', loc: 50 }], n4: ['pf.rms', { tstop: 5 }],
    n5: ['flow.log', { text: '{a} {b}' }] }, ['n1>n2', 'n2.body>n3', 'n3>n4', 'n4.ok>n5'], ['n2.value>n3.duration', 'n3.t_fault>n5.a', 'n3.t_clear>n5.b']), 'evt_sweep');
  has(mainBody(r.code), 't_fault_s, t_clear_s = add_short_circuit(app, "n3", pf_find(app, "Line 5-7.ElmLne", "one"), 1, value, 0, 0, 50, "trip", "3ph", None)');
  ok(!r.problems.length, ptext(r));
  const t = gen(W({ n1: START, n2: ['pf.evt.trip', { el: EL('ElmSym', 'G 10'), t: 1 }], n3: ['pf.evt.load', { load: EL('ElmLod', 'Load 03'), dp: 20 }], n4: ['pf.evt.param', { el: EL('ElmDsl', 'AVR'), param: 'Vref', mode: 'add', value: 0.05 }],
    n5: ['pf.evt.switch', { el: EL('ElmLne', 'L1'), action: 'close' }], n6: ['pf.rms', {}], n7: ['flow.log', { text: '{mw}' }] },
    ['n1>n2', 'n2>n3', 'n3>n4', 'n4>n5', 'n5>n6', 'n6.ok>n7'], ['n2.mw>n7.mw']), 'evt_all');
  const b = mainBody(t.code);
  has(b, 'tripped_mw = add_trip(app, "n2", pf_find(app, "G 10.ElmSym", "one"), 1)'); has(b, 'add_load_step(app, "n3", pf_find(app, "Load 03.ElmLod", "one"), 1, 20, 0)');
  has(b, 'add_param_event(app, "n4", pf_find(app, "AVR.ElmDsl", "one"), 1, "Vref", 0.05, "add")'); has(b, 'add_switch_event(app, "n5", pf_find(app, "L1.ElmLne", "one"), 1, "close")');
});
test('dispatch: one generator, Q, basis and constant Q; a table row with blanks out of service', () => {
  const r = gen(W({ n1: START, n2: ['pf.dispatch', { gen: EL('ElmSym', 'G 05'), p: 300, q: 50, basis: 'machine', qmode: 'pq' }] }, ['n1>n2']), 'disp_one');
  has(mainBody(r.code), 'set_dispatch(pf_find(app, "G 05.ElmSym", "one"), 300, 50, "machine", "pq", "MW", "Mvar", True)');
  const row = gen(W({ n1: START, n2: ['flow.list', { source: 'table', table: 'Cases', cols: [{ id: 'c1', name: 'G 02', type: 'num' }, { id: 'c2', name: 'G 03', type: 'num' }] }],
    n3: ['pf.dispatch', { mode: 'row', cols: [{ id: 'g1', col: 'G 02', gen: EL('ElmSym', '') }, { id: 'g2', col: 'G 03', gen: EL('ElmGenstat', 'G3 unit') }] }] },
    ['n1>n2', 'n2.body>n3'], ['n2.c1>n3.g1', 'n2.c2>n3.g2']), 'disp_row');
  ok(!probs(row).filter(p => p.level !== 'warning').length, ptext(row));
  ok(/dispatch_row\(app, \{"G 02": as_float\(row\.get\("G 02"\)\), "G 03": as_float\(row\.get\("G 03"\)\)\}, \{"G 02": "G 02\.ElmSym", "G 03": "G3 unit\.ElmGenstat"\}, "total", "MW", True\)/.test(row.code), mainBody(row.code));
  const todo = gen(W({ n1: START, n2: ['pf.dispatch', { mode: 'row', cols: [{ id: 'g1', col: 'G 02' }] }] }, ['n1>n2']), 'disp_row_todo');
  ok(hasP(todo, 'todo', /Connect the value of column G 02/), ptext(todo));
});
test('study case, scenario and variation blocks: names built when it runs, keep and if-exists', () => {
  const r = gen(W({ n1: START, n2: ['flow.list', { values: '100, 150' }, { label: 'Dispatch' }], n3: ['pf.case.create', { keep: false, exists: 'replace', scenario: 'new' }], n4: ['flow.log', { text: '{n} {c} {s}' }] },
    ['n1>n2', 'n2.body>n3', 'n3>n4'], ['n3.name>n4.n', 'n3.case>n4.c', 'n3.scenario>n4.s']), 'case_create');
  const b = mainBody(r.code);
  has(b, 'case_name = str("{active case} {loop values}" or "").replace("{active case}"');
  has(b, 'made_case = case_create(app, case_name, "" or None, "new", "replace", True, False)');
  has(b, '"n": made_case.name, "c": made_case.case, "s": made_case.scenario');
  const s = gen(W({ n1: START, n2: ['pf.scen.create', { name: 'PFB S', keep: false }], n3: ['pf.scen.save', {}], n4: ['pf.scen.deactivate', { save: true }], n5: ['pf.var.create', { stage: 'Stage 1' }], n6: ['pf.var.deactivate', { which: 'all' }] },
    ['n1>n2', 'n2>n3', 'n3>n4', 'n4>n5', 'n5>n6']), 'scen_var');
  const sb = mainBody(s.code);
  has(sb, '= scenario_create(app, scenario_name, True, False, "reuse")'); has(sb, 'scenario_save(app)'); has(sb, 'scenario_deactivate(app, True)');
  has(sb, '= variation_create(app, variation_name, "Stage 1" or None, True, True, "reuse")'); has(sb, 'variation_deactivate(app, None)');
});
test('short circuit at one element or every busbar, harmonic load flow, load flow options', () => {
  const b = mainBody(gen(W({ n1: START, n2: ['pf.shc', { at: 'element', target: EL('ElmTerm', 'Bus 5'), fault: '1ph', current: 'min', method: 'complete' }], n3: ['pf.shc', {}], n4: ['pf.hldf', { net: 'unbalanced' }], n5: ['pf.ldf', { net: 'dc', qlim: 'on', taps: 'off' }] },
    ['n1>n2', 'n2.ok>n3', 'n3.ok>n4', 'n4.ok>n5']), 'studies').code);
  has(b, 'shc = run_short_circuit(app, "complete", "1ph", "min", pf_find(app, "Bus 5.ElmTerm", "one"), 0, 0)');
  has(b, 'run_short_circuit(app, "iec", "3ph", "max", None, 0, 0)'); has(b, 'hldf = run_harmonic(app, "unbalanced")'); has(b, 'ldf = run_load_flow(app, "dc", "on", "off")');
});

// ---------------------------------------------------------------------------------------------
// Compile everything generated so far (one Python process)

function compileAll(list, label) {
  if (!list.length) return;
  const listFile = path.join(GEN_DIR, `_compile_${label}.txt`);
  fs.writeFileSync(listFile, list.map(x => x.file).join('\n'));
  const py = 'import py_compile,sys,json\nbad={}\nfor f in open(sys.argv[1],encoding="utf-8").read().split("\\n"):\n    try:\n        py_compile.compile(f, doraise=True, cfile=f+"c")\n    except Exception as e:\n        bad[f]=str(e)[:400]\nprint(json.dumps(bad))\n';
  const r = spawnSync('python', ['-c', py, listFile], { encoding: 'utf8', maxBuffer: 64 << 20 });
  let bad = {};
  try { bad = JSON.parse(r.stdout.trim().split('\n').pop()); } catch (e) { bad = { '(python)': (r.stderr || r.stdout || String(r.error)).slice(0, 400) }; }
  for (const x of list) if (bad[x.file]) results.push({ name: `compile ${path.basename(x.file)} (${x.test})`, ok: false, msg: bad[x.file] });
  results.push({ name: `${list.length} generated scripts compile (${label})`, ok: !Object.keys(bad).length, msg: Object.keys(bad).length + ' failed' });
  for (const x of list) { try { fs.rmSync(x.file + 'c', { force: true }); } catch (e) { /* ignore */ } }
}

// ---------------------------------------------------------------------------------------------
// (b) Live workflows

const OUT = LIVE_OUT.replace(/\\/g, '/');
const S9 = (studyCase) => ['start', { project: N9, studyCase, outputDir: OUT }];
const S39 = (studyCase) => ['start', { project: N39, studyCase, outputDir: OUT }];
const PY = (inputs, outputs, code) => ['adv.python', { inputs: inputs.map((n, k) => ({ id: 'i' + (k + 1), name: n })), outputs: outputs.map(([n, t], k) => ({ id: 'o' + (k + 1), name: n, type: t })), code }];
const LOG = (text) => ['flow.log', { text }];
const NL = String.fromCharCode(10);   // a newline inside a Python code block

const LIVE = {
  ldf: {
    project: N9, direct: true, timeout: 600,
    wf: W({
      n1: S9(''), n2: PY([], [['start', 'text']], 'start = app.GetActiveStudyCase().loc_name'), n3: LOG('START CASE {s}'),
      n4: ['pf.case.foreach', {}], n5: ['pf.ldf', {}], n6: ['pf.element', { el: EL('ElmTerm', '*', 'all') }], n7: ['pf.get', { attr: 'm:u' }],
      n8: LOG('LDF {c} | min {vmin:.4f} at {at} | max {vmax:.4f} | n {n}'),
      n9: PY([], [['active', 'text']], 'active = app.GetActiveStudyCase().loc_name'), n10: LOG('AFTER LOOP {a}'),
    }, ['n1>n2', 'n2>n3', 'n3>n4', 'n4.body>n5', 'n5.ok>n7', 'n7>n8', 'n4.done>n9', 'n9>n10'],
    ['n2.o1>n3.s', 'n6.el>n7.obj', 'n4.casename>n8.c', 'n7.min>n8.vmin', 'n7.at_min>n8.at', 'n7.max>n8.vmax', 'n7.n>n8.n', 'n9.o1>n10.a'], 'PFB live ldf cases'),
    check(out) {
      const ldf = out.lines.filter(l => / LDF /.test(l));
      // 8 study cases; 07 (Comparison Excitation Models) has no grid, so its load flow fails and the pass is skipped.
      ok(ldf.length === 7, `7 study cases with a grid, got ${ldf.length}:\n${ldf.join('\n')}`);
      has(out.text, 'Skipped (Study case = 07- Comparison Excitation Models): Load flow did not converge');
      for (const l of ldf) {
        const m = /min ([\d.]+) at (.+?) \| max ([\d.]+) \| n (\d+)/.exec(l);
        ok(m && Number(m[1]) > 0.9 && Number(m[3]) < 1.1 && Number(m[4]) === 9, l);
      }
      const start = (/START CASE (.+)$/.exec(out.lines.find(l => /START CASE/.test(l)) || '') || [])[1];
      const after = (/AFTER LOOP (.+)$/.exec(out.lines.find(l => /AFTER LOOP/.test(l)) || '') || [])[1];
      ok(start && start === after, `the case before the loop is active again after it: ${start} / ${after}`);
      has(out.text, '== Pass 8 of 8');
    },
  },
  sweep: {
    project: N9, timeout: 600, save: true,
    wf: W({
      n1: S9('01- Load Flow'),
      n2: PY([], [['p0', 'num'], ['l0', 'num']], 'p0 = pf_find(app, "G2.ElmSym", "one").GetAttribute("pgini")\nl0 = pf_find(app, "Load A.ElmLod", "one").GetAttribute("plini")'),
      n3: LOG('BEFORE pgini {p0:.3f} plini {l0:.3f}'),
      n4: ['flow.list', { values: '100, 200' }, { label: 'Dispatch' }], n5: ['pf.dispatch', { gen: EL('ElmSym', 'G2') }], n6: ['pf.ldf', {}],
      n7: ['pf.get', { el: EL('ElmSym', 'G2'), attr: 'm:P:bus1' }], n8: LOG('SWEEP {d} P {p:.2f}'),
      n9: ['flow.list', { values: '1, 5' }, { label: 'Factor' }], n10: ['pf.scale', { el: EL('ElmLod', 'Load A'), attr: 'plini', attr2: 'qlini' }], n11: ['pf.ldf', {}],
      n12: ['pf.get', { el: EL('ElmLod', 'Load A'), attr: 'm:P:bus1' }], n13: LOG('SCALE {f} P {p:.2f}'),
      n14: PY([], [['p1', 'num'], ['l1', 'num']], 'p1 = pf_find(app, "G2.ElmSym", "one").GetAttribute("pgini")\nl1 = pf_find(app, "Load A.ElmLod", "one").GetAttribute("plini")'),
      n15: LOG('AFTER pgini {p1:.3f} plini {l1:.3f}'),
      n16: PY([], [['pp', 'num']], 'pp = pf_find(app, "G2.ElmSym", "one").GetAttribute("pgini")'), n17: LOG('PASS START {d} pgini {pp:.3f}'),
    }, ['n1>n2', 'n2>n3', 'n3>n4', 'n4.body>n16', 'n16>n17', 'n17>n5', 'n5>n6', 'n6.ok>n7', 'n7>n8', 'n4.done>n9', 'n9.body>n10', 'n10>n11', 'n11.ok>n12', 'n12>n13', 'n9.done>n14', 'n14>n15'],
    ['n2.o1>n3.p0', 'n2.o2>n3.l0', 'n4.item>n5.p', 'n4.item>n8.d', 'n16.o1>n17.pp', 'n4.item>n17.d', 'n7.value>n8.p', 'n9.item>n10.factor', 'n9.item>n13.f', 'n12.value>n13.p', 'n14.o1>n15.p1', 'n14.o2>n15.l1'], 'PFB live dispatch sweep'),
    check(out) {
      has(out.text, 'SWEEP 100 P 100.00'); has(out.text, 'SWEEP 200 P 200.00');
      const p0 = (/BEFORE pgini ([\d.]+)/.exec(out.text) || [])[1];
      has(out.text, `PASS START 100 pgini ${p0}`); has(out.text, `PASS START 200 pgini ${p0}`, 'pass 2 starts from the dispatch before the loop');
      ok(/SCALE 1 P \d+\.\d\d/.test(out.text), 'factor 1 converges');
      has(out.text, 'Skipped (Factor = 5): Load flow did not converge', 'the guard skips the diverged pass');
      const b = /BEFORE pgini ([\d.]+) plini ([\d.]+)/.exec(out.text), a = /AFTER pgini ([\d.]+) plini ([\d.]+)/.exec(out.text);
      ok(b && a && b[1] === a[1] && b[2] === a[2], `the dispatch and the load are back after the loops: ${b && b[0]} / ${a && a[0]}`);
    },
  },
  cases: {
    project: N9, timeout: 600, keep: [['IntCase', 'PFBT keep*'], ['IntScenario', 'PFBT keep*']], opval: 'G2.ElmSym:pgini',
    wf: W({
      n1: S9('01- Load Flow'), n2: ['flow.list', { values: '100, 150' }, { label: 'Dispatch' }], n3: ['pf.case.create', { name: 'PFBT keep {loop values}' }],
      n4: ['pf.dispatch', { gen: EL('ElmSym', 'G2') }], n5: ['pf.scen.save', {}], n6: ['pf.ldf', {}], n7: ['pf.get', { el: EL('ElmSym', 'G2'), attr: 'm:P:bus1' }],
      n8: LOG('CASE {name} | SCEN {sc} | P {p:.1f}'), n9: ['pf.case.create', { name: 'PFBT temp', scenario: 'new', keep: false }], n10: LOG('TEMP {name} | SCEN {sc}'),
    }, ['n1>n2', 'n2.body>n3', 'n3>n4', 'n4>n5', 'n5>n6', 'n6.ok>n7', 'n7>n8', 'n2.done>n9', 'n9>n10'],
    ['n2.item>n4.p', 'n3.name>n8.name', 'n3.scenario>n8.sc', 'n7.value>n8.p', 'n9.name>n10.name', 'n9.scenario>n10.sc'], 'PFB live cases keep'),
    check(out) {
      has(out.text, 'CASE PFBT keep Dispatch 100 | SCEN PFBT keep Dispatch 100 | P 100.0');
      has(out.text, 'CASE PFBT keep Dispatch 150 | SCEN PFBT keep Dispatch 150 | P 150.0');
      has(out.text, 'TEMP PFBT temp | SCEN PFBT temp');
      for (const n of ['IntCase PFBT keep Dispatch 100', 'IntCase PFBT keep Dispatch 150', 'IntScenario PFBT keep Dispatch 100', 'IntScenario PFBT keep Dispatch 150']) has(out.text, 'LIVE-KEPT ' + n, 'kept after the run');
      ok(!/LIVE-KEPT \w+ PFBT temp/.test(out.text), 'the case with keep off is gone');
      ok(/LIVE-OPVAL PFBT keep Dispatch 100 \[\d+, 100\.0\]/.test(out.text) && /LIVE-OPVAL PFBT keep Dispatch 150 \[\d+, 150\.0\]/.test(out.text), 'each kept scenario holds its saved dispatch');
      has(out.text, "LIVE-KEPT-LEFT IntCase []"); has(out.text, "LIVE-KEPT-LEFT IntScenario []");
    },
  },
  shc: {
    project: N9, timeout: 600,
    wf: W({
      n1: S9('01- Load Flow'), n2: ['pf.shc', {}], n3: ['pf.get', { el: EL('ElmTerm', 'Bus 5'), attr: 'm:Ikss' }], n4: ['pf.element', { el: EL('ElmTerm', '*', 'all') }],
      n5: ['pf.get', { attr: 'm:Ikss' }], n6: LOG('SHC Bus5 {i:.3f} | max {mx:.2f} at {at} | n {n}'), n7: ['pf.hldf', {}], n8: ['pf.get', { attr: 'm:THD' }], n9: LOG('HLDF THD max {t} | n {n}'),
    }, ['n1>n2', 'n2.ok>n3', 'n3>n5', 'n5>n6', 'n6>n7', 'n7.ok>n8', 'n8>n9'],
    ['n3.value>n6.i', 'n4.el>n5.obj', 'n5.max>n6.mx', 'n5.at_max>n6.at', 'n5.n>n6.n', 'n4.el>n8.obj', 'n8.max>n9.t', 'n8.n>n9.n'], 'PFB live short circuit and harmonics'),
    check(out) {
      const m = /SHC Bus5 ([\d.]+) \| max ([\d.]+) at (.+?) \| n (\d+)/.exec(out.text);
      ok(m, 'the short-circuit line');
      near(m[1], 2.256, 0.002, 'Bus 5 Ikss (kA)'); near(m[2], 57.0, 0.5, 'highest Ikss (Bus 1)'); ok(m[3] === 'Bus 1' && m[4] === '9', m[0]);
      has(out.text, 'Harmonic load flow done'); ok(/HLDF THD max [\d.e+-]+ \| n 9/.test(out.text), 'THD read on 9 busbars');
    },
  },
  shcevent: {
    project: N9, timeout: 600,
    wf: W({
      n1: S9('03- Three Cycles Standard SG Model'), n2: ['pf.evt.shc', { target: EL('ElmTerm', 'Bus 7'), t: 1, duration: 0.1 }], n3: ['pf.rms', { tstop: 3 }],
      n4: ['sig.series', { el: EL('ElmTerm', 'Bus 7'), var: 'm:u1' }],
      n5: PY(['s'], [['pre', 'num'], ['dur', 'num'], ['fin', 'num'], ['n', 'num']],
        'pre = [y for t, y in zip(s.t, s.y) if t < 0.99][-1]\ndur = min(y for t, y in zip(s.t, s.y) if 1.0 < t < 1.1)\nfin = s.y[-1]\nn = len(s.t)'),
      n6: LOG('SHCEVT pre {pre:.4f} | during {dur:.4f} | final {fin:.4f} | n {n} | tf {tf} | tc {tc} | status {st}'),
    }, ['n1>n2', 'n2>n3', 'n3.ok>n5', 'n5>n6'],
    ['n3.result>n4.res', 'n4.series>n5.i1', 'n5.o1>n6.pre', 'n5.o2>n6.dur', 'n5.o3>n6.fin', 'n5.o4>n6.n', 'n2.t_fault>n6.tf', 'n2.t_clear>n6.tc', 'n3.status>n6.st'], 'PFB live fault event'),
    check(out) {
      const m = /SHCEVT pre ([\d.]+) \| during ([\d.e+-]+) \| final ([\d.]+) \| n (\d+) \| tf 1 \| tc 1\.1 \| status ok/.exec(out.text);
      ok(m, 'the fault line');
      const fx = readCsv(path.join(BUILDER, '_audit/runtime/fixtures/nine_bus_fault_u1.csv'));
      const pre = fx.filter(r => r[0] < 0.99).pop()[1], dur = Math.min(...fx.filter(r => r[0] > 1.0 && r[0] < 1.1).map(r => r[1])), fin = fx[fx.length - 1][1];
      near(m[1], pre, 0.002, 'u1 before the fault (fixture)'); near(m[2], dur, 0.01, 'u1 during the fault (fixture)'); near(m[3], fin, 0.002, 'u1 at the end (fixture)');
      ok(Number(m[2]) < 0.2 && Number(m[3]) > 0.9, m[0]);
    },
  },
  emt: {
    project: N9, timeout: 900,
    wf: W({
      n1: S9('03- Three Cycles Standard SG Model'),
      n2: ['pf.emt', { tstop: 0.2, step: 0.00005, net: 'rst', caseEvents: 'off', record: [{ id: 'r1', el: EL('ElmTerm', 'Bus 7'), var: 'm:u1', combine: 'none' }] }],
      n3: PY(['s'], [['n', 'num'], ['dt', 'num'], ['u', 'num']], 'n = len(s.t)\ndt = s.t[1] - s.t[0]\nu = s.y[-1]'),
      n4: LOG('EMT status {st} | t_end {te:.4f} | n {n} | dt {dt:.6f} | u1 {u:.4f}'),
    }, ['n1>n2', 'n2.ok>n3', 'n3>n4'], ['n2.r1>n3.i1', 'n3.o1>n4.n', 'n3.o2>n4.dt', 'n3.o3>n4.u', 'n2.status>n4.st', 'n2.t_end>n4.te'], 'PFB live EMT'),
    check(out) {
      const m = /EMT status ok \| t_end ([\d.]+) \| n (\d+) \| dt ([\d.]+) \| u1 ([\d.]+)/.exec(out.text);
      ok(m, 'the EMT line');
      near(m[1], 0.2, 1e-6, 't_end'); near(m[3], 0.00005, 1e-7, 'EMT step'); ok(Number(m[2]) >= 4000, m[0]); near(m[4], 1.0, 0.1, 'u1 at the end');
    },
  },
  trip: {
    project: N39, timeout: 600,
    wf: W({
      n1: S39('2.1 Simulation Fault Bus 16 Stable'), n2: ['pf.evt.trip', { el: EL('ElmSym', 'G 10'), t: 1 }],
      n3: ['pf.rms', { tstop: 60, step: 0.01, record: [{ id: 'r1', el: EL('ElmTerm', 'Bus 16'), var: 'm:fehz', combine: 'none' }] }], n4: ['math.min', {}],
      n5: PY(['s'], [['dt', 'num'], ['t0', 'num'], ['n', 'num'], ['u', 'text']], 'dt = s.t[1] - s.t[0]\nt0 = s.t[0]\nn = len(s.t)\nu = s.unit'),
      n6: LOG('TRIP nadir {f:.4f} | mw {mw:.1f} | t_end {te:.2f} | dt {dt:.6f} | t0 {t0:.4f} | n {n} | unit {u}'),
    }, ['n1>n2', 'n2>n3', 'n3.ok>n5', 'n5>n6'],
    ['n3.r1>n4.values', 'n4.value>n6.f', 'n2.mw>n6.mw', 'n3.t_end>n6.te', 'n3.r1>n5.i1', 'n5.o1>n6.dt', 'n5.o2>n6.t0', 'n5.o3>n6.n', 'n5.o4>n6.u'], 'PFB live RMS trip'),
    check(out) {
      const m = /TRIP nadir ([\d.]+) \| mw ([\d.]+) \| t_end ([\d.]+) \| dt ([\d.]+) \| t0 ([-\d.]+) \| n (\d+) \| unit (\S+)/.exec(out.text);
      ok(m, 'the trip line');
      const fx = readCsv(path.join(BUILDER, '_audit/runtime/fixtures/39bus_G10_trip_fehz.csv'));
      near(m[1], Math.min(...fx.map(r => r[1])), 0.001, 'nadir (fixture)'); near(m[1], 59.45, 0.01, 'nadir (Hz)');
      near(m[2], 250, 1, 'MW tripped'); near(m[3], 60, 1e-6, 't_end');
      near(m[4], 0.01, 1e-6, 'time step in s although the project shows ms'); near(m[5], -0.1, 1e-6, 'start time from the case (-100 ms)');
      ok(m[7] === 'Hz' && Number(m[6]) > 6000, m[0]);
      has(out.text, "The study case's own events are off for this run");
    },
  },
  n1: {
    project: N39, timeout: 600,
    wf: W({
      n1: S39('1. Power Flow'), n2: ['pf.cont.define', {}], n3: ['pf.cont.foreach', {}], n4: ['pf.ldf', {}], n5: ['pf.element', { el: EL('ElmLne', '*', 'all') }],
      n6: ['pf.get', { attr: 'c:loading' }], n7: ['var.set', { name: 'worst', mode: 'max' }], n8: LOG('N1 {i} {c} | max {mx:.2f} at {at}'),
      n9: ['var.get', { name: 'worst' }], n10: LOG('WORST {w:.2f} | WHERE {where} | PASSES {k}'),
    }, ['n1>n3', 'n3.body>n4', 'n4.ok>n6', 'n6>n7', 'n7>n8', 'n3.done>n10'],
    ['n2.conts>n3.conts', 'n5.el>n6.obj', 'n6.max>n7.value', 'n3.index>n8.i', 'n3.cont>n8.c', 'n6.max>n8.mx', 'n6.at_max>n8.at', 'n9.value>n10.w', 'n9.where>n10.where', 'n3.count>n10.k'], 'PFB live N-1'),
    check(out) {
      const rows = out.lines.filter(l => / N1 \d+ /.test(l));
      ok(rows.length === 35, `base case plus 34 lines, got ${rows.length}`);
      ok(/ N1 1 Base case \|/.test(rows[0]), 'base case first: ' + rows[0]);
      const m = /WORST ([\d.]+) \| WHERE (.+?) \| PASSES (\d+)/.exec(out.text);
      // The worst of the 34 line outages, replayed independently on the sandbox with plain load
      // flows (2026-10-24): out Line 21 - 22 -> 158.28 % on Line 23 - 24, then out Line 23 - 24
      // -> 156.92 %. (107.97 % is what the Line 10 - 11 outage alone gives, which is what this
      // line used to expect.)
      ok(m, 'the worst line'); near(m[1], 158.28, 0.05, 'worst loading (%)'); has(m[2], 'Line 21 - 22'); ok(m[3] === '35', m[0]);
    },
  },
  testgen: {
    project: N9, timeout: 600,
    wf: W({
      n1: S9('01- Load Flow'), n2: ['pf.testgen', { bus: EL('ElmTerm', 'Bus 5'), p: 0 }], n3: ['pf.dispatch', { p: 50 }],
      n4: ['pf.set', { el: EL('ElmLod', 'Load A'), attr: 'plini', value: 150 }], n5: ['pf.ldf', {}],
      n6: ['pf.get', { attr: 'm:P:bus1' }], n7: ['pf.get', { el: EL('ElmLod', 'Load A'), attr: 'm:P:bus1' }],
      n8: LOG('TG {p:.2f} | load {l:.2f} | slack {s:.2f} | {g}'), n9: ['pf.outserv', {}], n10: ['pf.ldf', {}], n11: LOG('TGOFF slack {s:.2f}'),
      n12: ['pf.undo', {}], n13: ['pf.get', { el: EL('ElmLod', 'Load A'), attr: 'plini' }], n14: LOG('UNDO plini {l:.2f}'),
    }, ['n1>n2', 'n2>n3', 'n3>n4', 'n4>n5', 'n5.ok>n6', 'n6>n7', 'n7>n8', 'n8>n9', 'n9>n10', 'n10.ok>n11', 'n11>n12', 'n12>n13', 'n13>n14'],
    ['n2.gen>n3.gen', 'n2.gen>n6.obj', 'n6.value>n8.p', 'n7.value>n8.l', 'n5.slack_mw>n8.s', 'n2.gen>n8.g', 'n2.gen>n9.obj', 'n10.slack_mw>n11.s', 'n13.value>n14.l'], 'PFB live test generator'),
    check(out) {
      const m = /TG ([\d.]+) \| load ([\d.]+) \| slack ([-\d.]+) \| (\S+)/.exec(out.text);
      ok(m, 'the test generator line');
      near(m[1], 50, 0.01, 'test generator P (MW)'); near(m[2], 150, 0.01, 'Load A P after Set attribute (MW)'); near(m[3], 71.64 + 25 - 50, 3, 'slack (MW)');
      ok(m[4] === 'PFB_n2', 'named after the block: ' + m[4]);
      const off = Number((/TGOFF slack ([-\d.]+)/.exec(out.text) || [])[1]);
      near(off, 71.64 + 25, 3, 'slack with the test generator out of service');
      has(out.text, 'UNDO plini 125.00', 'Put changed values back');
    },
  },
  events: {
    project: N39, timeout: 900,
    wf: W({
      n1: S39('2.1 Simulation Fault Bus 16 Stable'),
      n2: ['pf.evt.load', { load: EL('ElmLod', 'Load 16'), t: 1, dp: 20 }],
      n3: ['pf.rms', { tstop: 5, record: [{ id: 'r1', el: EL('ElmLod', 'Load 16'), var: 'm:Psum:bus1', combine: 'none' }] }],
      n4: PY(['s'], [['p0', 'num'], ['p1', 'num']], 'p0 = s.y[0]\np1 = s.y[-1]'), n5: LOG('LOADSTEP {p0:.2f} -> {p1:.2f} at {t}'),
      n6: ['pf.evt.switch', { el: EL('ElmLne', 'Line 16 - 21'), t: 1, action: 'open' }],
      n7: ['pf.rms', { tstop: 3, record: [{ id: 'r1', el: EL('ElmLne', 'Line 16 - 21'), var: 'm:I:bus1', combine: 'none' }] }],
      n8: PY(['s'], [['i0', 'num'], ['i1', 'num'], ['ev', 'text']], 'i0 = s.y[0]\ni1 = s.y[-1]\nev = str(s.events)'), n9: LOG('SWITCH {i0:.4f} -> {i1:.6f} | {ev}'),
      n10: ['pf.evt.param', { el: EL('ElmDsl', 'GOV 06'), t: 1, param: 'T1', mode: 'times', value: 1 }], n11: ['pf.rms', { tstop: 2 }],
      n12: ['sig.series', { el: EL('ElmTerm', 'Bus 16'), var: 'm:fehz' }],
      n13: PY(['s'], [['ev', 'text'], ['n', 'num']], 'ev = str(s.events)\nn = len(s.t)'), n14: LOG('PARAM {ev} | n {n}'),
      n15: ['pf.cont.define', { lines: false, query: 'Line 16 - 2*.ElmLne' }], n16: ['pf.cont.foreach', { how: 'event', t: 1 }],
      n17: ['pf.rms', { tstop: 2, record: [{ id: 'r1', el: EL('ElmTerm', 'Bus 16'), var: 'm:u1', combine: 'none' }] }],
      n18: PY(['s'], [['ev', 'text'], ['umin', 'num']], 'ev = str(s.events)\numin = min(s.y)'), n19: LOG('CONT {i} {c} | umin {u:.4f} | {ev}'),
    }, ['n1>n2', 'n2>n3', 'n3.ok>n4', 'n4>n5', 'n5>n6', 'n6>n7', 'n7.ok>n8', 'n8>n9', 'n9>n10', 'n10>n11', 'n11.ok>n13', 'n13>n14', 'n14>n16', 'n16.body>n17', 'n17.ok>n18', 'n18>n19'],
    ['n3.r1>n4.i1', 'n4.o1>n5.p0', 'n4.o2>n5.p1', 'n2.t>n5.t', 'n7.r1>n8.i1', 'n8.o1>n9.i0', 'n8.o2>n9.i1', 'n8.o3>n9.ev',
      'n11.result>n12.res', 'n12.series>n13.i1', 'n13.o1>n14.ev', 'n13.o2>n14.n', 'n15.conts>n16.conts', 'n17.r1>n18.i1', 'n16.index>n19.i', 'n16.cont>n19.c', 'n18.o2>n19.u', 'n18.o1>n19.ev'], 'PFB live events'),
    check(out) {
      const l = /LOADSTEP ([\d.]+) -> ([\d.]+) at 1/.exec(out.text);
      ok(l, 'the load step line'); near(l[1], 329, 0.05, 'Load 16 P before'); near(l[2], 394.56, 0.3, 'Load 16 P after +20 %');
      const w = /SWITCH ([\d.]+) -> ([-\d.e]+) \| (.+)$/m.exec(out.text);
      ok(w && Number(w[1]) > 0.01 && Math.abs(Number(w[2])) < 1e-4, 'line current before and after it opens: ' + (w && w[0]));
      ok(w && /Open Line 16 - 21/.test(w[3]) && !/Load step/.test(w[3]), 'only the switch event in the second run: ' + (w && w[3]));
      const p = /PARAM (.+) \| n (\d+)$/m.exec(out.text);
      ok(p && /T1 = 0\.2 on GOV 06/.test(p[1]) && !/Open Line/.test(p[1]) && Number(p[2]) > 100, 'parameter event alone, curve read through Read time series: ' + (p && p[0]));
      const c = out.lines.filter(x => / CONT \d+ /.test(x));
      ok(c.length === 3, 'base case and 2 lines: ' + c.join('\n'));
      ok(/ CONT 1 Base case \| umin (0\.9\d+|1\.\d+) \| \[\]/.test(c[0]), 'the base case has no event, not even the case\'s own fault: ' + c[0]);
      ok(/CONT 2 Line 16 - 21 .*Open Line 16 - 21/.test(c[1]) && /CONT 3 Line 16 - 24 .*Open Line 16 - 24/.test(c[2]) && !/Line 16 - 21/.test(c[2]), c.slice(1).join('\n'));
    },
  },
  steps: {
    project: N39, timeout: 900,
    wf: W({
      n1: S39('2.1 Simulation Fault Bus 16 Stable'),
      // Three parameter steps, as PowerFactory's own event list holds them, then read back from
      // the study case before the run: the times must be in seconds whatever the project shows.
      n2: ['pf.evt.steps', { el: EL('ElmDsl', 'AVR 02'), param: 'Ka', steps: [{ id: 's1', t: 1, v: 20 }, { id: 's2', t: 2.5, v: 60 }, { id: 's3', t: 4, v: 6.2 }] }],
      n3: PY([], [['evs', 'text'], ['unit', 'text']], [
        "folder = app.GetActiveStudyCase().GetContents('*.IntEvt')[0]",
        "evs = []",
        "unit = ''",
        "for e in sorted(folder.GetContents('*.EvtParam'), key=lambda x: x.GetAttribute('time')):",
        "    unit = str(e.GetAttributeUnit('time'))",
        "    evs.append('%s@%g=%s' % (e.GetAttribute('variable'), e.GetAttribute('time'), e.GetAttribute('value')))",
        "evs = ' '.join(evs)",
      ].join(NL)),
      n4: LOG('EVTS {e} | time unit {u}'),
      n5: ['pf.rms', { tstop: 5, record: [{ id: 'r1', el: EL('ElmTerm', 'Bus 02'), var: 'm:u1', combine: 'none' }] }],
      n6: PY(['s'], [['ev', 'text'], ['n', 'num']], `ev = str(s.events)${NL}n = len(s.t)`),
      n7: LOG('STEPRUN {ev} | n {n}'),
      // "times" works from the value the parameter has now (Ka = 6.2 in this demo).
      n8: ['pf.evt.steps', { el: EL('ElmDsl', 'AVR 02'), param: 'Ka', mode: 'times', steps: [{ id: 's1', t: 1, v: 2 }, { id: 's2', t: 3, v: 1 }] }],
      n9: PY([], [['evs', 'text']], [
        "folder = app.GetActiveStudyCase().GetContents('*.IntEvt')[0]",
        "evs = ' '.join(sorted('%s=%s' % (e.GetAttribute('variable'), e.GetAttribute('value')) for e in folder.GetContents('*.EvtParam')))",
      ].join(NL)),
      n10: LOG('TIMESMODE {e}'),
      n11: ['pf.rms', { tstop: 4 }],
      n12: ['sig.series', { el: EL('ElmTerm', 'Bus 02'), var: 'm:u1' }],
      n13: PY(['s'], [['ev', 'text']], 'ev = str(s.events)'), n14: LOG('TIMESRUN {ev}'),
      n15: ['flow.log', { text: 'STEPS DONE' }],
    }, ['n1>n2', 'n2>n3', 'n3>n4', 'n4>n5', 'n5.ok>n6', 'n6>n7', 'n7>n8', 'n8>n9', 'n9>n10', 'n10>n11', 'n11.ok>n13', 'n13>n14', 'n14>n15'],
    ['n3.o1>n4.e', 'n3.o2>n4.u', 'n5.r1>n6.i1', 'n6.o1>n7.ev', 'n6.o2>n7.n', 'n9.o1>n10.e', 'n11.result>n12.res', 'n12.series>n13.i1', 'n13.o1>n14.ev'], 'PFB live param steps'),
    check(out) {
      const e = /EVTS (.+) \| time unit (.*)$/m.exec(out.text);
      ok(e, 'the event list line: ' + out.text.slice(-2000));
      // Written in seconds, in time order, with the value as the text PowerFactory takes.
      ok(/^Ka@1=20 Ka@2\.5=60 Ka@4=6\.2$/.test(e[1].trim()), 'three EvtParam events in seconds: ' + e[1]);
      const r = /STEPRUN (.+) \| n (\d+)$/m.exec(out.text);
      ok(r, 'the run line');
      ok((r[1].match(/Ka = /g) || []).length === 3, 'all three events belong to the run: ' + r[1]);
      ok(/1\.0, 'Ka = 20/.test(r[1]) && /2\.5, 'Ka = 60/.test(r[1]) && /4\.0, 'Ka = 6\.2/.test(r[1]), 'times and values on the run: ' + r[1]);
      ok(Number(r[2]) > 100, 'the run produced a curve: ' + r[2]);
      // "times" multiplies the value the parameter has (Ka = 6.2 here): 12.4 and 6.2. Each block
      // owns its own events, keyed by its block id, so the first block's three are still in the
      // study case; the run below is what decides which of them are used.
      const m = /TIMESMODE (.+)$/m.exec(out.text);
      ok(m && /^Ka=12\.4 Ka=20 Ka=6\.2 Ka=6\.2 Ka=60$/.test(m[1].trim()), 'the times mode adds its own two events (12.4 and 6.2) beside the three of the block before: ' + (m && m[1]));
      const tr = /TIMESRUN (.+)$/m.exec(out.text);
      ok(tr && (tr[1].match(/Ka = /g) || []).length === 2 && /Ka = 12\.4/.test(tr[1]), 'the second run has only its own two events: ' + (tr && tr[1]));
      has(out.text, 'STEPS DONE');
    },
  },
  // --- Edge cases: shapes a reader builds that the single-purpose tests above do not reach.

  // Three loops inside each other, each writing its own column of the results table.
  nested: {
    project: N9, timeout: 900,
    wf: W({
      n1: S9('01- Load Flow'),
      n2: ['flow.list', { values: '100, 200' }, { label: 'Dispatch' }],
      n3: ['pf.foreach_element', { el: EL('ElmLod', 'Load *', 'all'), name: 'Load' }],
      n4: ['flow.range', { from: 1, to: 2, step: 1 }, { label: 'Factor' }],
      n5: ['pf.dispatch', { gen: EL('ElmSym', 'G2') }],
      n6: ['pf.scale', { attr: 'plini', attr2: 'qlini' }],
      n7: ['pf.ldf', {}],
      n8: ['pf.get', { attr: 'm:P:bus1' }],
      n9: ['out.table.add', { table: 'Nested', cols: [{ id: 'c1', name: 'P (MW)' }] }],
      n10: LOG('NEST {d} | {el} | {f} | P {p:.4f}'),
      n11: ['out.table.save', { table: 'Nested', fmt: 'csv', stem: 'nested' }],
      n12: PY([], [['rows', 'num'], ['cols', 'text']], ["t = table('Nested')", "rows = len(t.rows)", "cols = ' | '.join(t.columns)"].join(NL)),
      n13: LOG('NESTED rows {r} | cols {c}'),
    }, ['n1>n2', 'n2.body>n3', 'n3.body>n4', 'n4.body>n5', 'n5>n6', 'n6>n7', 'n7.ok>n8', 'n8>n9', 'n9>n10', 'n2.done>n11', 'n11>n12', 'n12>n13'],
    ['n2.item>n5.p', 'n3.item>n6.obj', 'n4.value>n6.factor', 'n3.item>n8.obj', 'n8.value>n9.c1',
      'n2.item>n10.d', 'n3.elname>n10.el', 'n4.value>n10.f', 'n8.value>n10.p', 'n12.o1>n13.r', 'n12.o2>n13.c'], 'PFB live nested loops'),
    check(out) {
      const rows = out.lines.filter(l => / NEST /.test(l)).map(l => /NEST (\d+) \| (.+?) \| (\d+) \| P ([-\d.]+)/.exec(l)).filter(Boolean);
      ok(rows.length === 12, `2 dispatches x 3 loads x 2 factors = 12 passes, got ${rows.length}`);
      const loads = [...new Set(rows.map(r => r[2]))].sort();
      ok(loads.length === 3, 'three loads: ' + loads.join(', '));
      // The inner loop puts the model back after each pass, so factor 2 is twice factor 1 for
      // the same dispatch and the same load - and the outer loops keep their own values.
      for (const d of ['100', '200']) {
        for (const el of loads) {
          const f1 = rows.find(r => r[1] === d && r[2] === el && r[3] === '1');
          const f2 = rows.find(r => r[1] === d && r[2] === el && r[3] === '2');
          ok(f1 && f2, `missing a pass for ${d} / ${el}`);
          near(Number(f2[4]), 2 * Number(f1[4]), Math.max(0.05, Math.abs(Number(f1[4])) * 0.01), `${el} at dispatch ${d}: factor 2 is twice factor 1`);
        }
      }
      const m = /NESTED rows (\d+) \| cols (.+)$/m.exec(out.text);
      ok(m && m[1] === '12', 'the table holds one row per innermost pass: ' + (m && m[1]));
      ok(m && m[2].trim() === 'Dispatch | Load | Factor | Status | P (MW)', 'the loop columns come first, outermost first: ' + (m && m[2]));
      ok(/Saved results table 'Nested'/.test(out.text) || /nested.*\.csv/.test(out.text), 'the table was saved');
    },
  },

  // Both searches, closing the loop through PowerFactory: a bisection for the biggest load the
  // network takes, and an optimiser that has to land the slack on a number.
  optimise: {
    project: N9, timeout: 1200,
    wf: W({
      n1: S9('01- Load Flow'),
      n30: PY([], [['p0', 'num']], "p0 = pf_find(app, 'Load A.ElmLod', 'one').GetAttribute('plini')"),
      // 1. Find limit: how much Load A can take before a line goes over 100 %.
      n2: ['opt.limit', { lower: 50, upper: 700, tol: 2, passes: 'low', onUnknown: 'fail' }, { label: 'Load A limit' }],
      n3: ['pf.set', { el: EL('ElmLod', 'Load A'), attr: 'plini' }],
      n4: ['pf.ldf', {}],
      n5: ['pf.element', { el: EL('ElmLne', '*', 'all') }],
      n6: ['pf.get', { attr: 'c:loading' }],
      n7: ['chk.verdict', { op: 'le', limit: 100 }],
      n8: ['opt.report', {}],
      n9: ['val.bool', { value: false }],
      n10: ['opt.report', {}],
      n11: LOG('LIMIT {l:.2f} | found {f} | status {s} | passing {p:.2f} | failing {q:.2f}'),
      // Check it: at the limit nothing is over 100 %, a little above it something is.
      n12: ['pf.set', { el: EL('ElmLod', 'Load A'), attr: 'plini' }],
      n13: ['pf.ldf', {}], n14: ['pf.get', { attr: 'c:loading' }], n15: LOG('ATLIMIT loading {x:.2f}'),
      n16: ['math.formula', { expr: 'a + 6' }],
      n17: ['pf.set', { el: EL('ElmLod', 'Load A'), attr: 'plini' }],
      n18: ['pf.ldf', {}], n19: ['pf.get', { attr: 'c:loading' }], n20: LOG('ABOVE loading {x:.2f}'),
      // Put Load A back where it was: the search above left it above its limit, and the next
      // search needs the network it started from.
      n31: ['pf.set', { el: EL('ElmLod', 'Load A'), attr: 'plini' }],
      n32: ['pf.ldf', {}], n33: LOG('RESTORED slack {s:.3f}'),
      // 2. Optimise: the G2 dispatch that makes the slack generate 70 MW.
      n21: ['opt.optimise', { vars: [{ id: 'v1', name: 'G2 MW', lower: 50, upper: 250, integer: false }], goal: 'min', method: 'de', maxTries: 40, seed: 7 }, { label: 'Slack to 70' }],
      n22: ['pf.dispatch', { gen: EL('ElmSym', 'G2') }],
      n23: ['pf.ldf', {}],
      n24: ['math.formula', { expr: 'abs(a - 70)' }],
      n25: ['opt.report', {}],
      n26: LOG('OPT best {b:.3f} | score {s:.4f} | found {f}'),
      n27: ['pf.dispatch', { gen: EL('ElmSym', 'G2') }],
      n28: ['pf.ldf', {}],
      n29: LOG('CHECKOPT slack {s:.3f}'),
    }, ['n1>n30', 'n30>n2', 'n2.body>n3', 'n3>n4', 'n4.ok>n6', 'n6>n7', 'n7.pass>n8', 'n7.fail>n8', 'n4.fail>n10',
      'n2.done>n11', 'n11>n12', 'n12>n13', 'n13.ok>n14', 'n14>n15', 'n15>n17', 'n17>n18', 'n18.ok>n19', 'n19>n20',
      'n20>n31', 'n31>n32', 'n32.ok>n33', 'n33>n21',
      'n21.body>n22', 'n22>n23', 'n23.ok>n25', 'n21.done>n26', 'n26>n27', 'n27>n28', 'n28.ok>n29'],
    ['n2.value>n3.value', 'n5.el>n6.obj', 'n6.max>n7.value', 'n7.ok>n8.pass', 'n6.max>n8.score', 'n9.value>n10.pass',
      'n2.limit>n11.l', 'n2.found>n11.f', 'n2.status>n11.s', 'n2.passing>n11.p', 'n2.failing>n11.q',
      'n2.limit>n12.value', 'n5.el>n14.obj', 'n14.max>n15.x',
      'n2.limit>n16.a', 'n16.value>n17.value', 'n5.el>n19.obj', 'n19.max>n20.x',
      'n30.o1>n31.value', 'n32.slack_mw>n33.s',
      'n21.v1>n22.p', 'n23.slack_mw>n24.a', 'n24.value>n25.score',
      'n21.best_v1>n26.b', 'n21.score>n26.s', 'n21.found>n26.f', 'n21.best_v1>n27.p', 'n28.slack_mw>n29.s'], 'PFB live searches'),
    check(out) {
      const l = /LIMIT ([\d.]+) \| found (\w+) \| status (\w+) \| passing ([\d.]+) \| failing ([\d.]+)/.exec(out.text);
      ok(l, 'the limit line\n' + out.text.slice(-1500));
      ok(/^(yes|true)$/i.test(l[2]), 'the bisection found a limit: ' + l[2]);
      const lim = Number(l[1]);
      ok(lim > 50 && lim < 700, 'the limit is inside the bracket: ' + lim);
      ok(Math.abs(Number(l[4]) - lim) <= 2.001, `the biggest passing try is the limit: ${l[4]} vs ${lim}`);
      ok(Number(l[5]) - Number(l[4]) <= 2.001 && Number(l[5]) > Number(l[4]), `the smallest failing try is just above it: ${l[5]}`);
      // The limit really is the edge: at it nothing is overloaded, 6 MW above it something is.
      const at = Number((/ATLIMIT loading ([\d.]+)/.exec(out.text) || [])[1]);
      const ab = Number((/ABOVE loading ([\d.]+)/.exec(out.text) || [])[1]);
      ok(at <= 100.0001, `at the limit the worst line is ${at} %`);
      ok(ab > 100, `6 MW above the limit the worst line is ${ab} %`);
      ok(ab > at, 'more load means more loading');
      // The network is back where it started before the second search.
      near(Number((/RESTORED slack ([-\d.]+)/.exec(out.text) || [])[1]), 71.64, 1.5, 'the slack is back at its base value');
      const o = /OPT best ([\d.]+) \| score ([\d.]+) \| found (\w+)/.exec(out.text);
      ok(o, 'the optimise line');
      ok(Number(o[1]) > 50 && Number(o[1]) < 250, 'the best try is inside the bounds: ' + o[1]);
      ok(Number(o[2]) < 1.0, 'the search got the slack within 1 MW of 70: score ' + o[2]);
      // The search really drove PowerFactory: dispatching the value it chose gives the slack it
      // scored, to the last decimal.
      const c = Number((/CHECKOPT slack ([-\d.]+)/.exec(out.text) || [])[1]);
      near(Math.abs(c - 70), Number(o[2]), 0.01, 'the best score is what that dispatch really gives');
      near(c, 70, 1.0, 'and it is close to the target');
    },
  },

  // Several curves out of one run, every kind of check on them, a graph and a CSV.
  series: {
    project: N39, timeout: 1200,
    wf: W({
      n1: S39('2.1 Simulation Fault Bus 16 Stable'),
      n2: ['pf.evt.trip', { el: EL('ElmSym', 'G 02'), t: 1 }],
      // 60 s with a 10 ms step: long enough for the governors to turn the frequency round, so
      // the nadir is a real one (the trip test uses the same window).
      n3: ['pf.rms', { tstop: 60, step: 0.01, record: [
        { id: 'r1', el: EL('ElmTerm', 'Bus 16'), var: 'm:fehz', combine: 'none' },
        { id: 'r2', el: EL('ElmTerm', 'Bus 16'), var: 'm:u1', combine: 'none' },
        { id: 'r3', el: EL('ElmTerm', '*', 'all'), var: 'm:u1', combine: 'min' },
        { id: 'r4', el: EL('ElmSym', 'G 03'), var: 's:xspeed', combine: 'none' },
      ] }],
      n4: ['sig.nadir', {}],
      n5: ['sig.settle', { bandMode: 'abs', band: 0.02 }],
      n6: ['sig.rocof', {}],
      n7: ['sig.at', { t: 5 }],
      n8: ['sig.final', {}],
      n9: ['out.plot.series', { lines: [{ id: 'l1', name: 'Bus 16 f' }], title: 'Frequency after the trip', ylabel: 'Frequency', stem: 'series_f' }],
      n10: ['out.series.save', { lines: [{ id: 'l1', name: 'f' }, { id: 'l2', name: 'u' }], stem: 'series_all' }],
      n11: PY(['a', 'b', 'c', 'd'], [['n1_', 'num'], ['n2_', 'num'], ['n3_', 'num'], ['n4_', 'num'], ['t0', 'num'], ['t1', 'num'], ['umin', 'num'], ['ub', 'num']],
        ["n1_, n2_, n3_, n4_ = len(a), len(b), len(c), len(d)",
          "t0, t1 = a.t[0], a.t[-1]",
          "umin = min(c.y)",
          "ub = min(b.y)"].join(NL)),
      n12: LOG('SER lens {a} {b} {c} {d} | t {t0:.3f}..{t1:.3f} | umin {u:.5f} | ubus {v:.5f}'),
      n13: LOG('CHK nadir {nd:.4f} at {nt:.3f} ufls {uf} | settles {se} at {st} | rocof {rc:.4f} basis {rb} | u@5 {u5:.5f} | speed end {we:.6f} | png {png} | csv {csv}'),
    }, ['n1>n2', 'n2>n3', 'n3.ok>n9', 'n9>n10', 'n10>n11', 'n11>n12', 'n12>n13'],
    ['n3.r1>n4.series', 'n3.r2>n5.series', 'n3.r1>n6.series', 'n3.r3>n7.series', 'n3.r4>n8.series',
      'n3.r1>n9.l1', 'n3.r1>n10.l1', 'n3.r2>n10.l2',
      'n3.r1>n11.i1', 'n3.r2>n11.i2', 'n3.r3>n11.i3', 'n3.r4>n11.i4',
      'n11.o1>n12.a', 'n11.o2>n12.b', 'n11.o3>n12.c', 'n11.o4>n12.d', 'n11.o5>n12.t0', 'n11.o6>n12.t1', 'n11.o7>n12.u', 'n11.o8>n12.v',
      'n4.nadir>n13.nd', 'n4.time>n13.nt', 'n4.ufls>n13.uf', 'n5.settles>n13.se', 'n5.time>n13.st',
      'n6.rocof>n13.rc', 'n6.basis>n13.rb', 'n7.value>n13.u5', 'n8.value>n13.we', 'n9.file>n13.png', 'n10.file>n13.csv'], 'PFB live many series'),
    check(out) {
      const s = /SER lens (\d+) (\d+) (\d+) (\d+) \| t ([-\d.]+)\.\.([\d.]+) \| umin ([\d.]+) \| ubus ([\d.]+)/.exec(out.text);
      ok(s, 'the series line\n' + out.text.slice(-1500));
      const lens = [s[1], s[2], s[3], s[4]].map(Number);
      ok(lens.every(n => n > 5000), 'every curve has samples: ' + lens.join(', '));
      ok(new Set(lens).size === 1, 'all four curves are the same length: ' + lens.join(', '));
      near(Number(s[6]), 60, 0.01, 'the run reached its stop time');
      ok(Number(s[7]) <= Number(s[8]) + 1e-9, 'the lowest voltage of every busbar is at or below Bus 16');
      const c = /CHK nadir ([\d.]+) at ([\d.]+) ufls (\w+) \| settles (\w+) at ([\d.]+) \| rocof ([-\d.]+) basis (\w+) \| u@5 ([\d.]+) \| speed end ([\d.]+) \| png (.+?) \| csv (.+?)$/m.exec(out.text);
      ok(c, 'the checks line');
      ok(Number(c[1]) > 55 && Number(c[1]) < 60, 'the nadir is below 60 Hz and not silly: ' + c[1]);
      ok(Number(c[2]) > 1 && Number(c[2]) < 60, 'the nadir is after the trip: ' + c[2]);
      ok(Number(c[6]) < 0, 'the frequency falls, so RoCoF is negative: ' + c[6]);
      ok(Number(c[8]) > 0.5 && Number(c[8]) < 1.2, 'the lowest busbar voltage at 5 s: ' + c[8]);
      near(Number(c[9]), 1.0, 0.05, 'the other machine ends near its nominal speed');
      ok(/\.png$/.test(c[10].trim()), 'a graph was drawn: ' + c[10]);
      ok(/\.csv$/.test(c[11].trim()), 'the curves were written: ' + c[11]);
      if (out.runlog) has(out.runlog, 'Saved graph');
    },
  },

  // Decisions and the three terminals: a route per pass, a skipped pass that still leaves a row,
  // and a loop that stops itself.
  branch: {
    project: N9, timeout: 900,
    wf: W({
      n1: S9('01- Load Flow'),
      n2: ['flow.range', { from: 1, to: 5, step: 1 }, { label: 'Step' }],
      n3: ['flow.if', { op: 'gt', b: 2 }],
      n4: LOG('SMALL {v}'),
      n5: ['flow.next', {}],
      n6: ['flow.if', { op: 'ge', b: 5 }],
      n7: LOG('ENOUGH {v}'),
      n8: ['flow.break', {}],
      n9: ['math.formula', { expr: 'a * 90' }],
      n10: ['pf.set', { el: EL('ElmLod', 'Load A'), attr: 'plini' }],
      n11: ['pf.ldf', {}],
      n12: ['pf.get', { el: EL('ElmLod', 'Load A'), attr: 'm:P:bus1' }],
      n13: ['out.table.add', { table: 'Routes', cols: [{ id: 'c1', name: 'P (MW)' }] }],
      n14: LOG('BIG {v} | P {p:.2f}'),
      n15: LOG('NOCONV {v}'),
      n16: PY([], [['rows', 'num'], ['status', 'text']], ["t = table('Routes')", "rows = len(t.rows)", "status = ' ; '.join(str(r.get('Status', '')) for r in t.rows)"].join(NL)),
      n17: LOG('ROUTES rows {r} | status {s}'),
    }, ['n1>n2', 'n2.body>n3', 'n3.no>n4', 'n4>n5', 'n3.yes>n6', 'n6.yes>n7', 'n7>n8', 'n6.no>n10',
      'n10>n11', 'n11.ok>n12', 'n12>n13', 'n13>n14', 'n11.fail>n15', 'n2.done>n16', 'n16>n17'],
    ['n2.value>n3.a', 'n2.value>n4.v', 'n2.value>n6.a', 'n2.value>n7.v', 'n2.value>n9.a', 'n9.value>n10.value',
      'n12.value>n13.c1', 'n2.value>n14.v', 'n12.value>n14.p', 'n2.value>n15.v', 'n16.o1>n17.r', 'n16.o2>n17.s'], 'PFB live routes'),
    check(out) {
      const small = out.lines.filter(l => / SMALL /.test(l)).map(l => /SMALL (\d+)/.exec(l)[1]);
      const big = out.lines.filter(l => / BIG /.test(l)).map(l => /BIG (\d+)/.exec(l)[1]);
      eqArr(small, ['1', '2'], 'passes 1 and 2 take the "no" route');
      eqArr(big, ['3', '4'], 'passes 3 and 4 take the "yes" route and run');
      ok(/ENOUGH 5/.test(out.text), 'pass 5 reaches the stop');
      ok(!/BIG 5/.test(out.text), 'and stops the loop before running anything');
      const m = /ROUTES rows (\d+) \| status (.*)$/m.exec(out.text);
      ok(m, 'the summary line');
      // Every pass leaves a row: the two skipped ones say so in Status, the stopped one too.
      ok(Number(m[1]) === 5, 'one row per pass, skipped ones kept: ' + m[1]);
      // Every pass says what became of it: the two that skipped, the two that ran, and the one
      // that stopped the loop before it got anywhere.
      eqArr(m[2].split(' ; ').map(x => x.trim()), ['Skipped', 'Skipped', 'OK', 'OK', 'Not reached'], 'the Status of each pass');
    },
  },

  // The whole case-table chain: a file beside the script, its columns as values, a dispatch per
  // row and a results table out the other end.
  casetable: {
    project: N9, timeout: 900,
    files: { 'live_cases_in.csv': 'Case,G2 (MW),Load A (MW)\r\nLow,80,100\r\nBase,163,125\r\nHigh,220,160\r\n' },
    wf: W({
      n1: S9('01- Load Flow'),
      n2: ['data.read', { table: 'Cases', path: 'live_cases_in.csv',
        src: { name: 'live_cases_in.csv', size: 60, sheet: '', sheets: [], cols: ['Case', 'G2 (MW)', 'Load A (MW)'], rows: 3, sig: '|rows|1|0' } }],
      n3: ['flow.list', { source: 'table', table: 'Cases', cols: [
        { id: 'c1', name: 'Case', type: 'text' }, { id: 'c2', name: 'G2 (MW)', type: 'num' }, { id: 'c3', name: 'Load A (MW)', type: 'num' },
      ] }, { label: 'Case' }],
      n4: ['pf.dispatch', { gen: EL('ElmSym', 'G2') }],
      n5: ['pf.set', { el: EL('ElmLod', 'Load A'), attr: 'plini' }],
      n6: ['pf.ldf', {}],
      n7: ['pf.get', { el: EL('ElmSym', 'G2'), attr: 'm:P:bus1' }],
      n8: ['pf.get', { el: EL('ElmLod', 'Load A'), attr: 'm:P:bus1' }],
      n9: ['out.table.add', { table: 'Study', cols: [{ id: 'k1', name: 'Case' }, { id: 'k2', name: 'G2 (MW)' }, { id: 'k3', name: 'Load A (MW)' }] }],
      n10: LOG('CT {c} | G2 {g:.2f} | load {l:.2f} | rows {n}'),
      n11: ['out.table.save', { table: 'Study', fmt: 'csv', stem: 'case_study' }],
      n12: PY([], [['rows', 'num'], ['cols', 'text']], ["t = table('Study')", "rows = len(t.rows)", "cols = ' | '.join(t.columns)"].join(NL)),
      n13: LOG('CTDONE rows {r} | cols {c} | file {f}'),
    }, ['n1>n2', 'n2>n3', 'n3.body>n4', 'n4>n5', 'n5>n6', 'n6.ok>n7', 'n7>n8', 'n8>n9', 'n9>n10', 'n3.done>n11', 'n11>n12', 'n12>n13'],
    ['n3.c2>n4.p', 'n3.c3>n5.value', 'n3.c1>n9.k1', 'n7.value>n9.k2', 'n8.value>n9.k3',
      'n3.c1>n10.c', 'n7.value>n10.g', 'n8.value>n10.l', 'n2.n>n10.n',
      'n12.o1>n13.r', 'n12.o2>n13.c', 'n11.file>n13.f'], 'PFB live case table'),
    check(out) {
      const rows = out.lines.filter(l => / CT /.test(l)).map(l => /CT (\w+) \| G2 ([\d.]+) \| load ([\d.]+) \| rows (\d+)/.exec(l)).filter(Boolean);
      ok(rows.length === 3, 'one pass per row of the file, got ' + rows.length);
      eqArr(rows.map(r => r[1]), ['Low', 'Base', 'High'], 'the passes follow the file, in its order');
      ok(rows.every(r => r[4] === '3'), 'the block says it read 3 rows');
      // The numbers in the file reach PowerFactory: the dispatch is what the column said.
      const want = { Low: 80, Base: 163, High: 220 };
      const load = { Low: 100, Base: 125, High: 160 };
      for (const r of rows) {
        near(Number(r[2]), want[r[1]], 0.01, `${r[1]}: G2 dispatched to the column value`);
        near(Number(r[3]), load[r[1]], 0.5, `${r[1]}: Load A set to the column value`);
      }
      const m = /CTDONE rows (\d+) \| cols (.+?) \| file (.+?)$/m.exec(out.text);
      ok(m, 'the summary line');
      ok(m[1] === '3', 'the results table has one row per case: ' + m[1]);
      // The loop is named Case and the row writes a Case column too: one column, same value.
      ok(m[2].trim() === 'Case | Status | G2 (MW) | Load A (MW)', 'the loop value, the status and the columns: ' + m[2]);
      ok(/case_study.*\.csv/.test(m[3]), 'the results were saved: ' + m[3]);
    },
  },

  // Repeat until something happens, an Excel workbook read by the script itself, and a results
  // table written as both CSV and Excel.
  untilxl: {
    project: N9, timeout: 1200,
    filesFrom: { 'live_book.xlsx': '_audit/data/cases.xlsx' },
    wf: W({
      n1: S9('01- Load Flow'),
      // openpyxl in the generated script: a real workbook, a named sheet, names on the second row.
      n2: ['data.read', { table: 'Book', path: 'live_book.xlsx', sheet: 'Dispatch', header: 2,
        src: { name: 'live_book.xlsx', size: 5458, sheet: 'Dispatch', sheets: ['Notes', 'Dispatch'], cols: ['Case', 'G 01 (MW)', 'G 02 (MW)', 'Scale'], rows: 3, sig: 'Dispatch|rows|2|0' } }],
      n3: PY([], [['rows', 'num'], ['cols', 'text'], ['first', 'text'], ['scales', 'text']],
        ["t = table('Book')",
          "rows = len(t.rows)",
          "cols = ' | '.join(t.columns)",
          "first = str(t.rows[0].get('Case'))",
          "scales = ', '.join(str(r.get('Scale')) for r in t.rows)"].join(NL)),
      n4: LOG('BOOK rows {r} | cols {c} | first {f} | scales {s}'),
      n5: PY([], [['base', 'num']], "base = pf_find(app, 'Load A.ElmLod', 'one').GetAttribute('plini')"),
      // Raise the load 8 % of its base each pass until a line goes over 100 %.
      n6: ['flow.until', { max: 12 }, { label: 'Ramp' }],
      n7: ['math.formula', { expr: 'a * (1 + 0.08 * b)' }],
      n8: ['pf.set', { el: EL('ElmLod', 'Load A'), attr: 'plini' }],
      n9: ['pf.ldf', {}],
      n10: ['pf.element', { el: EL('ElmLne', '*', 'all') }],
      n11: ['pf.get', { attr: 'c:loading' }],
      n12: ['out.table.add', { table: 'Ramp', cols: [{ id: 'c1', name: 'Load A (MW)' }, { id: 'c2', name: 'Worst line (%)' }] }],
      n13: LOG('RAMP {i} | load {l:.2f} | worst {w:.2f}'),
      n14: ['math.compare', { op: 'gt', b: 100 }],
      // The pass number only exists inside the loop, so it is kept for the line after it.
      n17: ['var.set', { name: 'Passes' }],
      n18: ['var.get', { name: 'Passes' }],
      n19: LOG('RAMPFAIL at pass {i}'),
      n15: ['out.table.save', { table: 'Ramp', fmt: 'both', stem: 'ramp' }],
      n16: LOG('RAMPDONE passes {i} | met {m} | file {f}'),
    }, ['n1>n2', 'n2>n3', 'n3>n4', 'n4>n5', 'n5>n6', 'n6.body>n8', 'n8>n9', 'n9.ok>n11', 'n11>n12', 'n12>n17', 'n17>n13',
      'n9.fail>n19', 'n6.done>n15', 'n15>n16'],
    ['n3.o1>n4.r', 'n3.o2>n4.c', 'n3.o3>n4.f', 'n3.o4>n4.s',
      'n5.o1>n7.a', 'n6.index>n7.b', 'n7.value>n8.value', 'n10.el>n11.obj',
      'n7.value>n12.c1', 'n11.max>n12.c2', 'n6.index>n13.i', 'n7.value>n13.l', 'n11.max>n13.w',
      'n11.max>n14.a', 'n14.value>n6.cond',
      'n6.index>n17.value', 'n18.value>n16.i', 'n6.met>n16.m', 'n15.file>n16.f', 'n6.index>n19.i'], 'PFB live until and excel'),
    check(out) {
      // The workbook was read by the script, through openpyxl, with the sheet and header row set.
      const b = /BOOK rows (\d+) \| cols (.+?) \| first (\w+) \| scales (.+?)$/m.exec(out.text);
      ok(b, 'the workbook line\n' + out.text.slice(-1500));
      ok(b[1] === '3', 'three rows out of the Dispatch sheet: ' + b[1]);
      ok(b[2].trim() === 'Case | G 01 (MW) | G 02 (MW) | Scale', 'the names come from row 2: ' + b[2]);
      ok(b[3] === 'Max', 'the first case: ' + b[3]);
      ok(b[4].trim() === '1.0, 0.5, 0.75', 'the numbers are numbers: ' + b[4]);
      // The loop stopped itself the pass after the loading passed 100 %.
      const ramp = out.lines.filter(l => / RAMP /.test(l)).map(l => /RAMP (\d+) \| load ([\d.]+) \| worst ([\d.]+)/.exec(l)).filter(Boolean);
      ok(ramp.length >= 2 && ramp.length <= 12, 'the ramp ran a sensible number of passes: ' + ramp.length);
      const worst = ramp.map(r => Number(r[3]));
      ok(worst[worst.length - 1] > 100, 'the last pass is the one that went over: ' + worst[worst.length - 1]);
      ok(worst.slice(0, -1).every(w => w <= 100), 'and no earlier pass did: ' + worst.join(', '));
      ok(worst.every((w, i) => i === 0 || w >= worst[i - 1] - 1e-9), 'more load, more loading: ' + worst.join(', '));
      // Every pass adds the same slice of the base load, whatever the first pass number is.
      const loads = ramp.map(r => Number(r[2]));
      const steps = loads.slice(1).map((x, i) => x - loads[i]);
      ok(steps.length && steps[0] > 0, 'the load goes up: ' + loads.join(', '));
      ok(steps.every(s => Math.abs(s - steps[0]) < 0.01), 'in equal steps: ' + steps.join(', '));
      const d = /RAMPDONE passes (\d+) \| met (\w+) \| file (.+?)$/m.exec(out.text);
      ok(d, 'the summary line');
      ok(d[1] === String(ramp.length), 'the loop counted its passes: ' + d[1] + ' vs ' + ramp.length);
      ok(/^(yes|true)$/i.test(d[2]), 'the loop ended because the condition was met: ' + d[2]);
      ok(/ramp.*\.csv$/.test(d[3].trim()), 'the CSV is the file it gives back: ' + d[3]);
      if (out.runlog) { has(out.runlog, '.xlsx'); has(out.runlog, 'ramp'); }
    },
  },

  // What a reader actually does: attach the case table, press Download, unpack the .zip and run
  // the script inside it. The file is not put next to the script by the harness - it travels in
  // the package, because the workflow carries it (wf.files, as the page saves it).
  packaged: {
    project: N9, timeout: 900, pack: true,
    wf: (() => {
      const w = W({
        n1: S9('01- Load Flow'),
        n2: ['data.read', { table: 'Cases', path: 'live_cases_in.csv',
          src: { name: 'live_cases_in.csv', size: 56, sheet: '', sheets: [], cols: ['Case', 'G2 (MW)'], rows: 2, sig: '|rows|1|0' } }],
        n3: ['flow.list', { source: 'table', table: 'Cases', cols: [
          { id: 'c1', name: 'Case', type: 'text' }, { id: 'c2', name: 'G2 (MW)', type: 'num' },
        ] }, { label: 'Case' }],
        n4: ['pf.dispatch', { gen: EL('ElmSym', 'G2') }],
        n5: ['pf.ldf', {}],
        n6: ['pf.get', { el: EL('ElmSym', 'G2'), attr: 'm:P:bus1' }],
        n7: LOG('PKG {c} | G2 {g:.2f}'),
      }, ['n1>n2', 'n2>n3', 'n3.body>n4', 'n4>n5', 'n5.ok>n6', 'n6>n7'],
      ['n3.c2>n4.p', 'n3.c1>n7.c', 'n6.value>n7.g'], 'PFB live packaged study');
      // The attached file, exactly as the page keeps it: base64 beside the workflow.
      w.files = { n2: { name: 'live_cases_in.csv', mime: 'text/csv',
        b64: Buffer.from('Case,G2 (MW)\r\nSoft,95\r\nHard,205\r\n', 'utf8').toString('base64') } };
      return w;
    })(),
    check(out) {
      const rows = out.lines.filter(l => / PKG /.test(l)).map(l => /PKG (\w+) \| G2 ([\d.]+)/.exec(l)).filter(Boolean);
      ok(rows.length === 2, 'one pass per row of the packaged file, got ' + rows.length);
      eqArr(rows.map(r => r[1]), ['Soft', 'Hard'], 'the cases of the file that travelled in the .zip');
      near(Number(rows[0][2]), 95, 0.01, 'Soft dispatched from the packaged file');
      near(Number(rows[1][2]), 205, 0.01, 'Hard dispatched from the packaged file');
    },
  },

  vars: {
    project: N39, timeout: 600,
    wf: W({
      n1: S39('1. Power Flow'), n2: ['pf.element', { el: EL('ElmTerm', '*', 'all'), inService: false }],
      n3: ['pf.get', { attr: 'uknom', skip: false }], n4: LOG('BASE buses {n}'),
      n5: ['pf.var.foreach', {}], n6: ['pf.element', { el: EL('ElmTerm', '*', 'all'), inService: false }], n7: ['pf.get', { attr: 'uknom', skip: false }],
      n8: LOG('VAR {v} | buses {n}'), n9: ['pf.ldf', {}], n10: LOG('VARLDF {v} converged'), n11: LOG('VARLDF {v} did not converge'),
      n12: ['pf.var.activate', { variation: 'Shunt Compensator' }], n13: ['pf.get', { attr: 'uknom', skip: false }], n14: LOG('ACT {v} | buses {n}'),
      n15: ['pf.var.create', { name: 'PFBT var', keep: false }], n16: LOG('CREATED {v}'),
      n17: ['pf.var.deactivate', { which: 'all' }], n18: ['pf.get', { attr: 'uknom', skip: false }], n19: LOG('DEACT {k} | buses {n}'),
    }, ['n1>n3', 'n3>n4', 'n4>n5', 'n5.body>n7', 'n7>n8', 'n8>n9', 'n9.ok>n10', 'n9.fail>n11', 'n5.done>n12', 'n12>n13', 'n13>n14', 'n14>n15', 'n15>n16', 'n16>n17', 'n17>n18', 'n18>n19'],
    ['n2.el>n3.obj', 'n3.n>n4.n', 'n6.el>n7.obj', 'n5.varname>n8.v', 'n7.n>n8.n', 'n5.varname>n10.v', 'n5.varname>n11.v', 'n2.el>n13.obj', 'n12.variation>n14.v', 'n13.n>n14.n',
      'n15.name>n16.v', 'n17.count>n19.k', 'n2.el>n18.obj', 'n18.n>n19.n'], 'PFB live variations'),
    check(out) {
      const base = Number((/BASE buses (\d+)/.exec(out.text) || [])[1]);
      ok(base === 39, 'base network 39 busbars: ' + base);
      const vars = out.lines.filter(l => / VAR .+ \| buses \d+/.test(l));
      ok(vars.length === 6, `6 variations, got ${vars.length}`);
      const act = Number((/ACT Shunt Compensator \| buses (\d+)/.exec(out.text) || [])[1]);
      const inLoop = Number((/VAR Shunt Compensator \| buses (\d+)/.exec(out.text) || [])[1]);
      ok(act === inLoop, `Element found again after Activate variation: ${act} vs ${inLoop} in the loop`);
      has(out.text, 'CREATED PFBT var');
      const d = /DEACT (\d+) \| buses (\d+)/.exec(out.text);
      ok(d && Number(d[1]) >= 2 && Number(d[2]) === base, 'deactivate all: ' + (d && d[0]));
    },
  },
};

function readCsv(file) {
  return fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).slice(1).map(l => l.split(',').map(Number));
}

function pfrun(args, timeoutMs) {
  // pfrun kills the script after PFRUN_TIMEOUT s; this process waits a little longer (the lock, the spacing).
  const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PFRUN_TIMEOUT: String(Math.round(timeoutMs / 1000) - 60) };
  const r = spawnSync('python', [PFRUN, ...args], { cwd: LIVE_DIR, encoding: 'utf8', timeout: timeoutMs + 2700 * 1000, maxBuffer: 256 << 20, env });
  return { code: r.status, text: (r.stdout || '') + (r.stderr ? '\n[stderr]\n' + r.stderr : '') + (r.error ? '\n[error] ' + r.error : '') };
}

async function runLive(name, L) {
  let file = path.join(LIVE_DIR, `${name}.py`);
  const r = generate(L.wf, { runtime: RUNTIME });
  fs.writeFileSync(file, r.code);
  toCompileLive.push({ file, test: 'live ' + name });
  const blocking = r.problems.filter(p => p.level === 'error' || p.level === 'todo');
  test(`live ${name}: generates without errors`, () => ok(!blocking.length, ptext(r)));
  if (blocking.length) return;
  // Files the workflow reads where it runs (a case table beside the script).
  for (const [name, text] of Object.entries(L.files || {})) fs.writeFileSync(path.join(LIVE_DIR, name), text);
  for (const [name, from] of Object.entries(L.filesFrom || {})) fs.copyFileSync(path.join(BUILDER, from), path.join(LIVE_DIR, name));
  // `pack`: do what a reader does - press Download, unpack the .zip somewhere, run the script in
  // it. The archive is unpacked by Python's own zipfile, not by the code that wrote it.
  if (L.pack) {
    const pkg = await buildPackage({ ...L.wf, view: { x: 0, y: 0, zoom: 1 } }, r, []);
    const dir = path.join(LIVE_DIR, 'pkg_' + name);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const zipPath = path.join(LIVE_DIR, name + '.zip');
    fs.writeFileSync(zipPath, Buffer.from(await pkg.blob.arrayBuffer()));
    const un = spawnSync('python', ['-I', '-c', 'import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', zipPath, dir], { encoding: 'utf8' });
    const got = fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
    test(`live ${name}: the study package unpacks`, () => {
      ok(un.status === 0, 'python could not unpack it: ' + (un.stderr || un.stdout));
      eqArr(got, ['README.txt', pkg.name.replace(/\.zip$/, '.json'), pkg.name.replace(/\.zip$/, '.py'), 'live_cases_in.csv'].sort(), 'what is in the package');
    });
    if (un.status !== 0 || !got.length) return;
    file = path.join(dir, pkg.name.replace(/\.zip$/, '.py'));
  }
  const snap = path.join(LIVE_OUT, `last_${L.project === N9 ? 'nine' : 'ne39'}.pkl`);
  const opts = { keep: L.keep || [], opval: L.opval || '', save: L.save ? snap : '' };
  let res;
  for (let attempt = 1; attempt <= 3; attempt++) {
    res = L.direct ? pfrun([file], (L.timeout + 120) * 1000) : pfrun([path.join(HERE, 'live_wrap.py'), file, JSON.stringify(opts)], (L.timeout + 120) * 1000);
    fs.writeFileSync(path.join(LOG_DIR, `live_${name}${attempt > 1 ? '_try' + attempt : ''}.log`), res.text);
    if (res.code !== 3) break;   // 3: the connect watchdog fired; pfrun spaces the retry
  }
  const lines = res.text.split(/\r?\n/);
  const out = { text: res.text, lines, code: res.code };
  if (L.direct) {
    test(`live ${name}: runs as it is (python <file>), exit code 0, summary in run.log`, () => {
      ok(res.code === 0, `exit code ${res.code}\n${res.text.slice(-3000)}`);
      has(res.text, 'Passes run:');
      const dirs = fs.readdirSync(LIVE_OUT).filter(d => d.startsWith('PFB_live_ldf_cases_')).sort();
      const log = fs.readFileSync(path.join(LIVE_OUT, dirs[dirs.length - 1], 'run.log'), 'utf8');
      has(log, 'Passes run: 8'); has(log, 'LDF 08- Three Cycles IEEE Type 1 Mag-A_PSS');
    });
    if (fs.existsSync(snap)) {
      const a = pfrun([path.join(HERE, 'live_audit.py'), L.project, snap, file], 300000);
      fs.writeFileSync(path.join(LOG_DIR, `live_${name}_audit.log`), a.text);
      test(`live ${name}: sandbox left as found`, () => ok(/LIVE-AUDIT OK/.test(a.text), a.text.split(/\r?\n/).filter(l => /LIVE-/.test(l)).join('\n') || a.text.slice(-2000)));
    } else {
      test(`live ${name}: sandbox left as found`, () => ok(false, 'no snapshot from an earlier wrapped run of this sandbox (run "sweep" first)'));
    }
  } else {
    test(`live ${name}: main() ends normally`, () => ok(/LIVE-EXIT 0/.test(res.text) && res.code === 0, `exit ${res.code}\n${res.text.slice(-3000)}`));
    test(`live ${name}: sandbox left as found`, () => ok(/LIVE-AUDIT OK/.test(res.text), lines.filter(l => /LIVE-(AUDIT|DIFF)/.test(l)).join('\n') || res.text.slice(-2000)));
    const rd = (/LIVE-RUNDIR (.+)$/m.exec(res.text) || [])[1];
    if (rd && rd.trim() !== 'None' && fs.existsSync(path.join(rd.trim(), 'run.log'))) out.runlog = fs.readFileSync(path.join(rd.trim(), 'run.log'), 'utf8');
  }
  test(`live ${name}: results`, () => L.check(out));
  if (out.runlog !== undefined) test(`live ${name}: run.log has the same lines and the summary`, () => { has(out.runlog, 'Passes run:'); ok(!/ ERROR /.test(out.runlog.replace(/ERROR: /g, '')), 'an error line in run.log'); });
}

const toCompileLive = [];
compileAll(toCompile, 'sweep');
// Both sandboxes against their demo projects, before and after all live runs: the same objects.
function liveTree(tag) {
  const any = path.join(LIVE_DIR, 'tree_probe.py');
  fs.writeFileSync(any, generate(W({ n1: S9('') }, []), { runtime: RUNTIME }).code);
  const out = path.join(LIVE_OUT, `tree_${tag}.json`);
  fs.rmSync(out, { force: true });
  const r = pfrun([path.join(HERE, 'live_tree.py'), any, out], 400 * 1000);
  fs.writeFileSync(path.join(LOG_DIR, `live_tree_${tag}.log`), r.text);
  return fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : null;
}

if (!NO_LIVE) {
  const treeBefore = liveTree('before');
  const order = ['sweep', 'ldf', 'cases', 'testgen', 'shc', 'shcevent', 'emt', 'trip', 'events', 'steps', 'n1', 'vars',
    'nested', 'branch', 'casetable', 'packaged', 'untilxl', 'series', 'optimise'];
  for (const name of order) {
    if (LIVE_ONLY.length && !LIVE_ONLY.includes(name)) continue;
    const t0 = Date.now();
    await runLive(name, LIVE[name]);
    console.log(`live ${name}: ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  const treeAfter = liveTree('after');
  test('live: both sandboxes hold the same objects as before the live runs (against their demo projects)', () => {
    ok(treeBefore && treeAfter, 'the tree check did not run (see logs/live_tree_*.log)');
    for (const box of [N9, N39]) {
      const a = treeBefore[box], b = treeAfter[box];
      ok(JSON.stringify(a.extra) === JSON.stringify(b.extra) && JSON.stringify(a.missing) === JSON.stringify(b.missing),
        `${box}: extra ${JSON.stringify(b.extra.filter(x => !a.extra.includes(x)))}, missing ${JSON.stringify(b.missing.filter(x => !a.missing.includes(x)))}`);
    }
  });
} else {
  for (const [name, L] of Object.entries(LIVE)) {
    const file = path.join(GEN_DIR, `live_${name}.py`);   // not live/: a live run may be using those
    const r = generate(L.wf, { runtime: RUNTIME });
    fs.writeFileSync(file, r.code);
    toCompileLive.push({ file, test: 'live ' + name });
    test(`live ${name}: generates without errors`, () => ok(!r.problems.some(p => p.level === 'error' || p.level === 'todo'), ptext(r)));
  }
}
compileAll(toCompileLive, 'live');

// ---------------------------------------------------------------------------------------------

const failed = results.filter(r => !r.ok);
for (const f of failed) console.log(`FAIL ${f.name}\n  ${String(f.msg).split('\n').join('\n  ')}`);
console.log(`pf blocks tests: ${results.length - failed.length} passed, ${failed.length} failed`);
fs.writeFileSync(path.join(LOG_DIR, 'last_summary.txt'), `pf blocks tests: ${results.length - failed.length} passed, ${failed.length} failed\n` + failed.map(f => 'FAIL ' + f.name + '\n  ' + f.msg).join('\n'));
process.exit(failed.length ? 1 : 0);
