// Tests for "only show what can be chosen": the showIf / optionsFor machinery and every rule
// the blocks built on it.
//
// Run from the repository root (D:\Repository\tool):
//   node pscad-scripter/builder/_audit/choice/run.mjs
//
// What it proves:
//   (a) the contract: a showIf never throws for any settings it can be given, an optionsFor
//       never invents an option, a pinned setting is always visible (the generator writes its
//       SETTINGS line whichever way), and no `required` setting is hidden while it is empty and
//       would still be written into the script;
//   (b) each rule, by the case it was written for (a fault's Choice parameter has no unit to
//       convert; a wired list leaves nothing to search for; ...);
//   (c) the reference data behind the rules: the unit families convert the way runtime/px_core.py
//       does, and an answer that is not in yet reads as "show it".

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILDER = path.resolve(HERE, '..', '..');
const imp = (rel) => import(pathToFileURL(path.join(BUILDER, rel)).href);

for (const f of ['start', 'flow', 'values', 'model', 'study', 'check', 'result', 'search', 'advanced']) await imp(`js/blocks/${f}.js`);
const REG = await imp('js/core/registry.js');
const AD = await imp('js/core/attrdata.js');

// A slice of reference/params.json, in its shape, for the rules below (checked against the real
// file by the last test).
const DATA = { defs: {
  'master:resistor': { params: { R: { unit: 'ohm', type: 'Real' } } },
  'master:source3': { params: { Es: { unit: 'kV', type: 'Real' } } },
  'master:tfaultn': { params: { TF: { unit: 's', type: 'Real' }, DF: { unit: 's', type: 'Real' } } },
  'master:tpflt': { params: { A: { type: 'Choice', options: [['NO', 'No'], ['YES', 'Yes']] } } },
  'master:mrun': { params: { Inc1I: { type: 'Integer' } } },
} };

const results = [];
class Fail extends Error {}
const ok = (cond, msg) => { if (!cond) throw new Fail(msg || 'expected true'); };
const eq = (a, b, msg) => { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Fail(`${msg || 'value'}:\n  got      ${x}\n  expected ${y}`); };
function test(name, fn) {
  try { fn(); results.push({ name, ok: true }); } catch (e) { results.push({ name, ok: false, msg: e instanceof Fail ? e.message : (e && e.stack) || String(e) }); }
}

const node = (type, s = {}, pin = []) => ({ id: 'n1', type, x: 0, y: 0, label: '', s, pin });
const visible = (type, s, wired = [], ctx = null, pin = []) => REG.visibleSettings(node(type, s, pin), new Set(wired), ctx).map(st => st.key);
const settingOf = (type, key) => (REG.getBlock(type).settings || []).find(st => st.key === key);
const optionsOf = (type, key, s, ctx) => {
  const st = settingOf(type, key);
  const want = st.optionsFor ? st.optionsFor(REG.settingsOf(node(type, s)), ctx || { wired: new Set() }) : null;
  return want === null || want === undefined ? REG.optionPairs(st).map(p => p[0]) : want;
};

// ---------------------------------------------------------------------------------------------
// (a) The contract

test('every showIf and optionsFor survives any settings a reader can reach', () => {
  // Each select taken through all its values, each bool flipped, plus the empty object: a
  // predicate that throws on one of them would hide a field by accident (the registry catches
  // the throw and shows the field, but the rule would be silently dead).
  for (const def of REG.allBlocks()) {
    const base = REG.settingsOf(node(def.type, {}));
    const tries = [{}, base];
    for (const st of def.settings || []) {
      if (st.kind === 'select') for (const [v] of REG.optionPairs(st)) tries.push({ ...base, [st.key]: v });
      else if (st.kind === 'bool') for (const v of [true, false]) tries.push({ ...base, [st.key]: v });
      else if (st.kind === 'element') tries.push({ ...base, [st.key]: { cls: 'master:resistor', name: 'R*', match: 'all' } }, { ...base, [st.key]: {} });
      else tries.push({ ...base, [st.key]: '' }, { ...base, [st.key]: 'x' });
    }
    for (const s of tries) {
      for (const st of def.settings || []) {
        for (const ctx of [undefined, { wired: new Set() }, { wired: new Set(['obj', 'items', 'target', 'duration', 'conts']), inLoop: true }, { wired: new Set(), inLoop: false }]) {
          if (typeof st.showIf === 'function') {
            let threw = null;
            try { st.showIf(s, ctx); } catch (e) { threw = e; }
            ok(!threw, `${def.type}.${st.key} showIf threw on ${JSON.stringify(s[st.key])}: ${threw && threw.message}`);
          }
          if (typeof st.optionsFor === 'function') {
            let got;
            try { got = st.optionsFor(s, ctx); } catch (e) { throw new Fail(`${def.type}.${st.key} optionsFor threw: ${e.message}`); }
            if (got === null || got === undefined) continue;
            ok(Array.isArray(got), `${def.type}.${st.key} optionsFor must give an array or null`);
            const all = REG.optionPairs(st).map(p => String(p[0]));
            for (const v of got) ok(all.includes(String(v)), `${def.type}.${st.key} optionsFor invented the option "${v}"`);
          }
        }
      }
    }
  }
});

test('a pinned setting is always shown (the script holds its SETTINGS line either way)', () => {
  // A fault's phase A is a Choice: no unit to convert, so the unit is hidden, unless pinned.
  AD._setForTests(null, DATA);
  const s = { el: { cls: 'master:tpflt', name: 'F1', match: 'one' }, param: 'A', vtype: 'text' };
  ok(!visible('px.get', s).includes('unit'), 'the unit is hidden for a Choice');
  ok(visible('px.get', s, [], null, ['unit']).includes('unit'), 'a pinned unit stays');
  AD._setForTests(null, null);
});

test('no block hides a setting it also calls required', () => {
  // The generator asks for its "fill this in" to-dos over visibleSettings, so a required
  // setting that is hidden loses its to-do. A block may only do that where the setting really
  // does not apply, which is what the rules below each check by hand.
  // Empty on purpose: today no block does it. A new one that must may be listed here once its
  // to-do is covered another way, but the rule is "a required setting stays visible".
  const allowed = new Set();
  for (const def of REG.allBlocks()) {
    for (const st of def.settings || []) {
      if (!st.required || typeof st.showIf !== 'function') continue;
      ok(allowed.has(def.type + ':' + st.key), `${def.type}.${st.key} is required and has a showIf: make sure its to-do is not lost, then list it here`);
    }
  }
});

// ---------------------------------------------------------------------------------------------
// (b) The rules, by the case each was written for

test('Read parameter: a unit only for a value that carries one, and only its own kind', () => {
  AD._setForTests(null, DATA);
  const r = { el: { cls: 'master:resistor', name: 'Rload', match: 'one' }, param: 'R' };
  ok(visible('px.get', r).includes('unit'), 'R is in ohm');
  eq(optionsOf('px.get', 'unit', r), ['none', 'ohm', 'kohm', 'mohm'], 'only resistances');
  eq(optionsOf('px.get', 'unit', { el: { cls: 'master:source3' }, param: 'Es' }), ['none', 'kV', 'V'], 'a voltage');
  eq(optionsOf('px.get', 'unit', { el: { cls: 'master:tfaultn' }, param: 'TF' }).slice(0, 3), ['none', 's', 'ms'], 'a time');
  ok(!visible('px.get', { el: { cls: 'master:tpflt', name: 'F1', match: 'one' }, param: 'A' }).includes('unit'), 'a Choice has none');
  ok(!visible('px.get', { el: { cls: 'master:mrun', name: '', match: 'one' }, param: 'Inc1I' }).includes('unit'), 'nor does a count');
  // One component: one value. Several (match all, or a list wired in): how to bring them together.
  ok(!visible('px.get', r).includes('pick'), 'one component');
  ok(visible('px.get', { ...r, el: { ...r.el, match: 'all' } }).includes('pick'), 'every match');
  ok(visible('px.get', r, ['obj']).includes('pick'), 'a list wired in');
  AD._setForTests(null, null);
});

test('what is not known yet is shown: an unloaded reference, a definition of the case, a wired component', () => {
  AD._setForTests(null, null);          // nothing loaded: every answer is undefined
  const r = { el: { cls: 'master:resistor', name: 'R', match: 'one' }, param: 'R' };
  ok(visible('px.get', r).includes('unit'), 'nothing loaded: the unit stays');
  eq(optionsOf('px.get', 'unit', r).length, REG.optionPairs(settingOf('px.get', 'unit')).length, 'and every unit is offered');
  AD._setForTests(null, DATA);
  ok(visible('px.get', { el: { cls: 'MyFilter', name: 'F', match: 'one' }, param: 'Rd' }).includes('unit'), 'a definition of the case itself: the unit stays');
  ok(visible('px.get', { el: { cls: 'master:resistor', name: 'R', match: 'one' }, param: 'Rx' }).includes('unit'), 'a parameter the data does not have: it stays');
  const f = { el: { cls: 'master:tpflt', name: 'F1', match: 'one' }, param: 'A' };
  ok(!visible('px.get', f).includes('unit'), 'unwired: hidden');
  ok(visible('px.get', f, ['obj']).includes('unit'), 'wired: the component may be anything, so it stays');
  AD._setForTests(null, null);
});

test('Set parameter: a Choice takes text, a number keeps its unit, text has none', () => {
  AD._setForTests(null, DATA);
  const r = { el: { cls: 'master:resistor', name: 'R', match: 'one' }, param: 'R', vtype: 'num' };
  eq(optionsOf('px.set', 'vtype', r), ['num'], 'a Real is a number');
  eq(optionsOf('px.set', 'vtype', { ...r, el: { cls: 'master:tpflt' }, param: 'A' }), ['text'], 'a Choice is one of its words');
  ok(visible('px.set', r).includes('unit') && visible('px.set', r).includes('value'), 'a number in ohm keeps its unit');
  const t = visible('px.set', { ...r, vtype: 'text' });
  ok(!t.includes('unit') && !t.includes('value') && t.includes('text'), 'a text value has no unit: ' + t.join(','));
  eq(optionsOf('px.set', 'vtype', r, { wired: new Set(['obj']) }).length, REG.optionPairs(settingOf('px.set', 'vtype')).length, 'a wired component may take anything');
  AD._setForTests(null, null);
});

test('For each component: a list wired in leaves nothing to search for', () => {
  const s = { el: { cls: 'master:resistor', name: '*', match: 'all' }, param: 'R', op: '=', value: '10' };
  const open = visible('px.foreach_component', s);
  for (const k of ['enabled', 'param', 'op', 'value']) ok(open.includes(k), `${k} missing: ${open.join(',')}`);
  const wired = visible('px.foreach_component', s, ['items']);
  for (const k of ['enabled', 'param', 'op', 'value']) ok(!wired.includes(k), `${k} is still shown with Components wired: ${wired.join(',')}`);
  const plain = visible('px.foreach_component', { ...s, param: '' });
  ok(!plain.includes('op') && !plain.includes('value'), 'no parameter, nothing to compare: ' + plain.join(','));
  eq(optionsOf('px.foreach_component', 'op', { ...s, value: 'BRK*' }), ['=', '!='], 'a pattern');
  ok(optionsOf('px.foreach_component', 'op', s).length > 2, 'a number keeps every comparison');
});

test('Set input control: the value that fits the kind of control', () => {
  ok(visible('px.control', { kind: 'slider' }).includes('value'), 'a slider takes a value');
  ok(visible('px.control', { kind: 'auto' }).includes('value'), 'so does one not yet known');
  const sw = visible('px.control', { kind: 'switch' });
  ok(sw.includes('on') && !sw.includes('value') && !sw.includes('pos'), 'a switch takes on or off: ' + sw.join(','));
  const dial = visible('px.control', { kind: 'dial' });
  ok(dial.includes('pos') && !dial.includes('value') && !dial.includes('on'), 'a dial takes a position: ' + dial.join(','));
});

test('Multiple Run: a list of values or a range, not both', () => {
  const list = visible('px.mrun.sweep', { mode: 'values' });
  ok(list.includes('values') && !list.includes('first'), list.join(','));
  const range = visible('px.mrun.sweep', { mode: 'range' });
  for (const k of ['first', 'last', 'steps']) ok(range.includes(k), k);
  ok(!range.includes('values'), range.join(','));
});

test('Run simulation: keeping the result files is about the output files', () => {
  ok(visible('px.run', { read: 'out' }).includes('keepFiles'), 'read from the .out files');
  for (const r of ['curves', 'none']) ok(!visible('px.run', { read: r }).includes('keepFiles'), r);
});

test('Start: the connection settings are for a PSCAD the script connects to', () => {
  for (const mode of ['auto', 'launch', 'connect']) {
    const v = visible('start', { runMode: mode });
    for (const k of ['showPscad', 'fortran', 'port', 'connectTimeout']) ok(v.includes(k), `${k} missing for ${mode}`);
  }
  const inside = visible('start', { runMode: 'inside' });
  for (const k of ['showPscad', 'fortran', 'port', 'connectTimeout', 'pscadVersion']) ok(!inside.includes(k), `${k} is shown for a script run inside PSCAD`);
  ok(visible('start', { runMode: 'launch' }).includes('pscadVersion'), 'which PSCAD to start');
  ok(!visible('start', { runMode: 'connect' }).includes('pscadVersion'), 'not for the one that is open');
});

test('Checks: a window, a final value and a nominal frequency only where they are read', () => {
  ok(visible('sig.rocof', { fallback: 'window' }).includes('searchWindow'), 'window');
  ok(!visible('sig.rocof', { fallback: 'none' }).includes('searchWindow'), 'none');
  ok(!visible('sig.settle', { reference: 'given' }).includes('hold'), 'a given final value needs no tail average');
  ok(visible('sig.settle', { reference: 'final' }).includes('hold'), 'its own final value does');
  const ports = REG.portsOf(node('sig.settle', { reference: 'final' })).inputs.map(p => p.id);
  ok(!ports.includes('target'), 'the Final value input goes with the setting: ' + ports.join(','));
  ok(REG.portsOf(node('sig.settle', { reference: 'given' })).inputs.some(p => p.id === 'target'), 'and comes back');
  ok(!visible('sig.despike', { signal: 'other' }).includes('nominal'), 'a curve in its own unit has no nominal frequency');
  ok(visible('sig.despike', { signal: 'frequency' }).includes('nominal'), 'a frequency does');
  ok(visible('sig.overshoot', { reference: 'given' }).includes('target'), 'an overshoot towards a given value');
  ok(!visible('sig.overshoot', { reference: 'final' }).includes('target'), 'or towards where it settles');
  const lim = visible('chk.limit', { against: 'curve' });
  ok(lim.includes('curve') && !lim.includes('lo') && !lim.includes('hi'), 'a limit curve replaces the two limits: ' + lim.join(','));
});

test('Results: the loop settings are for a block inside a loop', () => {
  for (const [type, key] of [['out.table.add', 'ctx'], ['out.table.add', 'onSkip'], ['out.plot.series', 'collect']]) {
    ok(visible(type, {}, [], { wired: new Set(), inLoop: true }).includes(key), `${type}.${key} inside a loop`);
    ok(!visible(type, {}, [], { wired: new Set(), inLoop: false }).includes(key), `${type}.${key} outside one`);
    ok(visible(type, {}, [], null).includes(key), `${type}.${key} while it is not known (the generator)`);
  }
});

test('Optimise: a random seed belongs to the methods that use one', () => {
  for (const m of ['de', 'bayes']) ok(visible('opt.optimise', { method: m }).includes('seed'), m);
  for (const m of ['grid', 'nelder', 'powell', 'bounded']) ok(!visible('opt.optimise', { method: m }).includes('seed'), m);
});

// ---------------------------------------------------------------------------------------------
// (c) The reference data

test('the unit families convert the way the script does', () => {
  // runtime/px_core.py unit_factor searches its families in order, letter case ignored. Every
  // pair of units in one family here must convert there, and a pair across families must not
  // (but for "h", hours to the script and henries here, which no Unit select ever pairs).
  const units = Object.keys(AD.UNIT_FAMILY);
  const pairs = [];
  for (const a of units) for (const b of units) if (a < b) pairs.push([a, b]);
  const py = `import json, sys
exec(open(sys.argv[1]).read().split("# @helper units", 1)[1].split("# @end", 1)[0])
pairs = json.loads(sys.argv[2])
print(json.dumps([unit_factor(a, b) is not None for a, b in pairs]))`;
  const out = spawnSync('python3', ['-c', py, path.join(BUILDER, 'runtime', 'px_core.py'), JSON.stringify(pairs)], { encoding: 'utf8' });
  ok(out.status === 0, 'python: ' + out.stderr);
  const conv = JSON.parse(out.stdout);
  pairs.forEach(([a, b], i) => {
    const same = AD.familyOf(a) === AD.familyOf(b);
    if (same) ok(conv[i], `${a} and ${b} are one family here, but the script cannot convert between them`);
    else if (a.toLowerCase() !== 'h' && b.toLowerCase() !== 'h') ok(!conv[i], `${a} and ${b} are different families here, but the script converts between them`);
  });
  for (const u of ['%', 'pu', 'p.u.', 'deg', 'rad', '', 'm/s']) eq(AD.familyOf(u), '', `${u} converts to nothing`);
});

test('every unit the blocks offer is one the script can convert', () => {
  for (const type of ['px.get', 'px.set']) {
    const M = REG.getBlock(type).settings.find(st => st.key === 'unit');
    for (const [v] of REG.optionPairs(M)) {
      if (v === 'none') continue;
      ok(AD.familyOf(v) !== '', `${type}: the Unit select offers "${v}", which converts to nothing`);
    }
  }
});

test('the reference data is what the rules above read', () => {
  // The cases above are real Master Library parameters: read them out of the data the page
  // downloads, so a rebuilt reference that drops one is caught here.
  const real = JSON.parse(fs.readFileSync(path.join(BUILDER, '..', 'reference', 'params.json'), 'utf8'));
  for (const [defn, params] of Object.entries(DATA.defs)) {
    ok(real.defs[defn], `${defn} is not in reference/params.json`);
    for (const [p, rec] of Object.entries(params.params)) {
      ok(real.defs[defn].params[p], `${defn} ${p} is not in reference/params.json`);
      eq(String(real.defs[defn].params[p].unit || ''), rec.unit || '', `${defn} ${p} unit`);
      eq(real.defs[defn].params[p].type, rec.type, `${defn} ${p} type`);
    }
  }
});

// ---------------------------------------------------------------------------------------------

for (const r of results) console.log((r.ok ? '  PASS  ' : '\u2717 FAIL  ') + r.name + (r.ok ? '' : '\n    ' + String(r.msg).split('\n').join('\n    ')));
const bad = results.filter(r => !r.ok).length;
console.log(`choice tests: ${results.length - bad} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
