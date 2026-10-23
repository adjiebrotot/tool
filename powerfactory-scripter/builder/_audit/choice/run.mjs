// Tests for "only show what can be chosen": the showIf / optionsFor machinery and every rule
// the blocks built on it.
//
// Run from the repository root (D:\Repository\tool):
//   node powerfactory-scripter/builder/_audit/choice/run.mjs
//
// What it proves:
//   (a) the contract: a showIf never throws for any settings it can be given, an optionsFor
//       never invents an option, a pinned setting is always visible (the generator writes its
//       SETTINGS line whichever way), and no `required` setting is hidden while it is empty and
//       would still be written into the script;
//   (b) each rule, by the case it was written for (ElmLne c:loading has no unit to convert and
//       no parallel machines; a wired list leaves nothing to search for; ...);
//   (c) the reference data behind the rules: the unit families mirror runtime/pf_core.py, and an
//       answer that is not in yet reads as "show it".

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILDER = path.resolve(HERE, '..', '..');
const imp = (rel) => import(pathToFileURL(path.join(BUILDER, rel)).href);

for (const f of ['start', 'flow', 'values', 'model', 'study', 'check', 'result', 'search', 'advanced']) await imp(`js/blocks/${f}.js`);
const REG = await imp('js/core/registry.js');
const AD = await imp('js/core/attrdata.js');

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
      else if (st.kind === 'element') tries.push({ ...base, [st.key]: { cls: 'ElmLne', name: 'L', match: 'all' } }, { ...base, [st.key]: {} });
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
  // ElmLne c:loading: a percentage, so the unit is hidden -- unless the reader pinned it.
  const s = { el: { cls: 'ElmLne', name: 'L', match: 'one' }, attr: 'c:loading' };
  AD._setForTests({ ElmLne: [{ var: 'e:dline', unit: 'km' }] }, { ElmLne: { 'c:loading': '%' } });
  ok(!visible('pf.get', s).includes('unit'), 'the unit is hidden for a percentage');
  ok(visible('pf.get', s, [], null, ['unit']).includes('unit'), 'a pinned unit stays');
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

test('Read attribute: a percentage has no unit to convert and no parallel machines', () => {
  AD._setForTests(
    { ElmLne: [{ var: 'e:dline', unit: 'km' }], ElmSym: [{ var: 'e:pgini', unit: 'MW' }, { var: 'e:ngnum', unit: '' }], ElmTerm: [{ var: 'e:uknom', unit: 'kV' }] },
    { ElmLne: { 'c:loading': '%' }, ElmTerm: { 'm:u': 'p.u.', 'm:Ikss': 'kA' } });
  const line = { el: { cls: 'ElmLne', name: 'L', match: 'one' }, attr: 'c:loading' };
  eq(visible('pf.get', line), ['el', 'attr', 'skip'], 'ElmLne c:loading');
  const bus = { el: { cls: 'ElmTerm', name: 'B', match: 'one' }, attr: 'm:u' };
  eq(visible('pf.get', bus), ['el', 'attr', 'skip'], 'ElmTerm m:u (p.u.)');
  const gen = { el: { cls: 'ElmSym', name: 'G', match: 'one' }, attr: 'pgini' };
  eq(visible('pf.get', gen), ['el', 'attr', 'unit', 'total', 'skip'], 'ElmSym pgini (MW)');
  eq(optionsOf('pf.get', 'unit', gen), ['none', 'MW', 'kW'], 'only the units of its own kind');
  eq(optionsOf('pf.get', 'unit', { el: { cls: 'ElmTerm', name: 'B' }, attr: 'm:Ikss' }), ['none', 'kA', 'A'], 'a current');
  // A busbar has no parallel machines, but it does have a voltage in kV to convert.
  eq(visible('pf.get', { el: { cls: 'ElmTerm', name: 'B', match: 'one' }, attr: 'uknom' }), ['el', 'attr', 'unit', 'skip'], 'ElmTerm uknom (kV)');
  AD._setForTests(null, null);
});

test('what is not known yet is shown: an unknown attribute, an unread file, a wired element', () => {
  AD._setForTests(null, null);          // nothing loaded: every answer is undefined
  const gen = { el: { cls: 'ElmSym', name: 'G', match: 'one' }, attr: 'pgini' };
  ok(visible('pf.get', gen).includes('unit') && visible('pf.get', gen).includes('total'), 'nothing loaded: both stay');
  eq(optionsOf('pf.get', 'unit', gen).length, 11, 'and every unit is offered');
  AD._setForTests({ ElmTerm: [{ var: 'e:uknom', unit: 'kV' }] }, { ElmTerm: { 'm:u': 'p.u.' } });
  const odd = { el: { cls: 'ElmTerm', name: 'B', match: 'one' }, attr: 'something_else' };
  ok(visible('pf.get', odd).includes('unit'), 'an attribute the page does not know: the unit stays');
  // The class in the settings is only the fallback: with a wire in, it says nothing.
  const bus = { el: { cls: 'ElmTerm', name: 'B', match: 'one' }, attr: 'm:u' };
  ok(!visible('pf.get', bus).includes('unit'), 'unwired: hidden');
  ok(visible('pf.get', bus, ['obj']).includes('unit'), 'wired: the element may be anything, so it stays');
  AD._setForTests(null, null);
});

test('Set attribute: no unit for a text value', () => {
  AD._setForTests({ ElmLod: [{ var: 'e:plini', unit: 'MW' }] }, {});
  const num = { el: { cls: 'ElmLod', name: 'L', match: 'one' }, attr: 'plini', vtype: 'num' };
  ok(visible('pf.set', num).includes('unit'), 'a number in MW keeps its unit');
  ok(!visible('pf.set', { ...num, vtype: 'text' }).includes('unit'), 'a text value has no unit');
  AD._setForTests(null, null);
});

test('For each element: a list wired in leaves nothing to search for', () => {
  const s = { el: { cls: 'ElmTerm', name: '*', match: 'all' }, attr: 'uknom', op: '=', value: '230' };
  const open = visible('pf.foreach_element', s);
  ok(open.includes('el') && open.includes('inService') && open.includes('attr') && open.includes('op') && open.includes('value'), open.join(','));
  const wired = visible('pf.foreach_element', s, ['items']);
  for (const k of ['el', 'inService', 'attr', 'op', 'value']) ok(!wired.includes(k), `${k} is still shown with Elements wired: ${wired.join(',')}`);
  // No attribute named: there is nothing to compare.
  const plain = visible('pf.foreach_element', { ...s, attr: '' });
  ok(!plain.includes('op') && !plain.includes('value'), plain.join(','));
  // A pattern can only be equal or different.
  eq(optionsOf('pf.foreach_element', 'op', { ...s, value: 'Bus*' }), ['=', '!='], 'a pattern');
  eq(optionsOf('pf.foreach_element', 'op', s).length, 6, 'a number keeps every comparison');
});

test('Add short circuit: the location is for a line, the clearing for a fault that is cleared', () => {
  const line = { target: { cls: 'ElmLne', name: 'L', match: 'one' }, duration: 0.1, fault: '3ph' };
  const bus = { target: { cls: 'ElmTerm', name: 'B', match: 'one' }, duration: 0.1, fault: '3ph' };
  ok(visible('pf.evt.shc', line).includes('loc'), 'a line has a location');
  ok(!visible('pf.evt.shc', bus).includes('loc'), 'a busbar has none');
  ok(visible('pf.evt.shc', bus, ['target']).includes('loc'), 'wired: it may be a line');
  ok(visible('pf.evt.shc', line).includes('clear'), 'cleared after 0.1 s');
  ok(!visible('pf.evt.shc', { ...line, duration: 0 }).includes('clear'), 'nothing is cleared at 0 s');
  ok(visible('pf.evt.shc', { ...line, duration: 0 }, ['duration']).includes('clear'), 'a wired duration may be anything');
  eq(optionsOf('pf.evt.shc', 'clear', bus), ['fault'], 'a busbar cannot be cleared by opening a line');
  eq(optionsOf('pf.evt.shc', 'clear', line).length, 2, 'a line can');
});

test('Run load flow: a DC load flow has no reactive power and no tap control', () => {
  ok(visible('pf.ldf', { net: 'ac' }).includes('qlim'), 'AC');
  const dc = visible('pf.ldf', { net: 'dc' });
  ok(!dc.includes('qlim') && !dc.includes('taps'), dc.join(','));
});

test('Run EMT: the balanced network stays (PowerFactory accepts it; checked live 2026-10-24)', () => {
  const net = settingOf('pf.emt', 'net');
  ok(REG.optionPairs(net).some(([v]) => v === 'sym'), 'the balanced network is still offered');
  ok(!net.optionsFor, 'and nothing narrows it: ComInc with iopt_sim=ins takes iopt_net=sym and runs');
  const cur = settingOf('pf.shc', 'current');
  ok(!cur.showIf && !cur.optionsFor, 'maximum / minimum currents stay for every short-circuit method');
  const fault = settingOf('pf.shc', 'fault');
  ok(!fault.optionsFor, 'and every fault type stays for every method');
});

test('Start: the connection settings are for a PowerFactory started in the background', () => {
  const engine = visible('start', { runMode: 'engine' });
  for (const k of ['showPf', 'connectTimeout', 'apiPath', 'pfUser']) ok(engine.includes(k), `${k} missing for engine mode`);
  const inside = visible('start', { runMode: 'inside' });
  for (const k of ['showPf', 'connectTimeout', 'apiPath', 'pfUser']) ok(!inside.includes(k), `${k} is shown for a script run inside PowerFactory`);
  ok(visible('start', { runMode: 'auto' }).includes('pfUser'), 'auto decides when it runs, so they stay');
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
});

test('Results: the loop settings are for a block inside a loop', () => {
  for (const [type, key] of [['out.table.add', 'ctx'], ['out.table.add', 'onSkip'], ['out.plot.series', 'collect']]) {
    ok(visible(type, {}, [], { wired: new Set(), inLoop: true }).includes(key), `${type}.${key} inside a loop`);
    ok(!visible(type, {}, [], { wired: new Set(), inLoop: false }).includes(key), `${type}.${key} outside one`);
    ok(visible(type, {}, [], null).includes(key), `${type}.${key} while it is not known (the generator)`);
  }
});

test('Set generator dispatch: the reactive-power control is not part of the table-row path', () => {
  ok(visible('pf.dispatch', { mode: 'one' }).includes('qmode'), 'one generator');
  ok(!visible('pf.dispatch', { mode: 'row' }).includes('qmode'), 'a row of a case table');
});

test('Optimise: a random seed belongs to the methods that use one', () => {
  for (const m of ['de', 'bayes']) ok(visible('opt.optimise', { method: m }).includes('seed'), m);
  for (const m of ['grid', 'nelder', 'powell', 'bounded']) ok(!visible('opt.optimise', { method: m }).includes('seed'), m);
});

// ---------------------------------------------------------------------------------------------
// (c) The reference data

test('the unit families are the ones the script can convert between', () => {
  const py = fs.readFileSync(path.join(BUILDER, 'runtime', 'pf_core.py'), 'utf8');
  const block = /_UNIT_BASE = \{([\s\S]*?)\}/.exec(py);
  ok(block, '_UNIT_BASE not found in pf_core.py');
  const pairs = [...block[1].matchAll(/"([^"]+)":\s*\("([^"]+)",/g)].map(m => [m[1], m[2]]);
  ok(pairs.length > 20, 'read ' + pairs.length + ' units from the runtime');
  for (const [unit, fam] of pairs) eq(AD.familyOf(unit), fam, `${unit} must be family ${fam} here too`);
  for (const u of ['%', 'p.u.', 'deg', 'Ohm', 'Hz', '', 'uF', 'USD']) eq(AD.familyOf(u), '', `${u} converts to nothing`);
  // The aliases PowerFactory writes.
  for (const [a, b] of [['MVAr', 'Q'], ['kVAr', 'Q'], ['sec', 't']]) eq(AD.familyOf(a), b, a);
});

test('every unit the blocks offer is one the script can convert', () => {
  const M = REG.getBlock('pf.get').settings.find(st => st.key === 'unit');
  for (const [v] of REG.optionPairs(M)) {
    if (v === 'none') continue;
    ok(AD.familyOf(v) !== '', `the Unit select offers "${v}", which converts to nothing`);
  }
});

// ---------------------------------------------------------------------------------------------

for (const r of results) console.log((r.ok ? '  PASS  ' : '\u2717 FAIL  ') + r.name + (r.ok ? '' : '\n    ' + String(r.msg).split('\n').join('\n    ')));
const bad = results.filter(r => !r.ok).length;
console.log(`choice tests: ${results.length - bad} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
