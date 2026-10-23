// TEST-ONLY blocks for the codegen tests. Never imported by the page (blocks/index.js does not
// know them). They stand in for the study, search and result blocks another wave writes, with
// the smallest emit() that exercises each part of the generator: a search (callback) and its
// Report this try, a simulation with monitors and a consumer that declares them, a loop over
// elements, blocks with model / case / results effects, an Add row that keeps skipped passes,
// a three-way branch and a block that writes files.

import { defineBlock } from '../../../js/core/registry.js';

defineBlock({
  type: 'test.check', cat: 'study', kind: 'branch', title: 'Test check',
  flowOuts: [{ id: 'ok', label: 'Passed' }, { id: 'fail', label: 'Failed', stopMsg: 'Check failed' }],
  inputs: [{ id: 'value', label: 'Value', type: 'num', fallback: 'value' }],
  outputs: [{ id: 'passed', label: 'Passed', type: 'bool', var: 'passed' }],
  settings: [{ key: 'value', label: 'Value', kind: 'number', default: 1 }, { key: 'bad', label: 'Fails at', kind: 'number', default: -999 }],
  emit(cx) {
    const ok = cx.out('passed');
    return { lines: [`${ok} = (${cx.in('value')}) != ${cx.num(cx.s.bad)}`], branches: [{ out: 'ok', test: ok }], elseOut: 'fail' };
  },
});

defineBlock({
  type: 'test.tri', cat: 'study', kind: 'branch', title: 'Test three ways',
  flowOuts: [{ id: 'low', label: 'Low' }, { id: 'mid', label: 'Middle' }, { id: 'high', label: 'High', stopMsg: 'Too high' }],
  inputs: [{ id: 'value', label: 'Value', type: 'num', fallback: 'value' }],
  settings: [{ key: 'value', label: 'Value', kind: 'number', default: 5 }],
  emit(cx) {
    const v = cx.name('v');
    return { lines: [`${v} = ${cx.in('value')}`], branches: [{ out: 'low', test: `${v} < 0` }, { out: 'mid', test: `${v} < 10` }], elseOut: 'high' };
  },
});

const fx = (writes, reads) => ({ writes, reads });
defineBlock({
  type: 'test.write', cat: 'model', kind: 'action', title: 'Test write model', effects: fx(['model'], []), helpers: ['touch_model'],
  emit(cx) { cx.helper('touch_model'); return [`touch_model(${cx.lit(cx.label)})`]; },
});
defineBlock({
  type: 'test.case', cat: 'model', kind: 'action', title: 'Test switch case', effects: fx(['case'], []),
  emit(cx) { cx.helper('touch_model'); return [`touch_model(${cx.lit('case ' + cx.label)})`]; },
});
defineBlock({
  type: 'test.calc', cat: 'study', kind: 'action', title: 'Test calculation', effects: fx(['results'], []),
  emit(cx) { cx.helper('touch_model'); return [`touch_model(${cx.lit('calc ' + cx.label)})`]; },
});
defineBlock({
  type: 'test.read', cat: 'model', kind: 'action', title: 'Test read result', effects: fx([], ['results']),
  outputs: [{ id: 'value', label: 'Value', type: 'num', var: 'reading' }],
  emit(cx) { return [`${cx.out('value')} = 1.0`]; },
});
defineBlock({
  type: 'test.readp', cat: 'model', kind: 'pure', title: 'Test read result (calculator)', effects: fx([], ['results']),
  outputs: [{ id: 'value', label: 'Value', type: 'num' }],
  emit(cx) { return 'float(2.0)'; },
});
defineBlock({
  type: 'test.elem', cat: 'model', kind: 'pure', volatile: 'case', title: 'Test element',
  outputs: [{ id: 'el', label: 'Element', type: 'obj' }],
  settings: [{ key: 'el', label: 'Element', kind: 'element', default: { cls: 'ElmTerm', name: 'Bus 9', match: 'one' } }],
  emit(cx) { return cx.element('el'); },
});
defineBlock({
  type: 'test.pick', cat: 'model', kind: 'action', title: 'Test pick element',
  outputs: [{ id: 'el', label: 'Element', type: 'obj', var: 'picked' }],
  emit(cx) { cx.helper('pf_find'); return [`${cx.out('el')} = pf_find(app, "Bus 7.ElmTerm", "one")`]; },
});
defineBlock({
  type: 'test.was', cat: 'model', kind: 'action', title: 'Test renamed option', version: 2,
  settings: [
    { key: 'mode', label: 'Mode', kind: 'select', default: 'fast', options: [['fast', 'Fast', ['quick', 0]], ['slow', 'Slow']] },
    { key: 'n', label: 'N', kind: 'number', default: 1 },
    { key: 'newKey', label: 'New key', kind: 'text', default: '' },
  ],
  settingAlias: { oldKey: 'newKey' },
  migrate(s, fromSv) { return fromSv < 2 ? { n: Number(s.n) * 10 } : {}; },
  emit(cx) { return [`log(${cx.lit(cx.s.mode + ' ' + cx.s.n + ' ' + cx.s.newKey)})`]; },
});
defineBlock({
  type: 'test.files', cat: 'result', kind: 'action', title: 'Test save file', oncePerRun: true,
  emit(cx) { return [`log(${cx.lit('saving ' + cx.label)})`]; },
});
defineBlock({
  type: 'test.addrow', cat: 'result', kind: 'action', title: 'Test add row',
  inputs: [{ id: 'c1', label: 'Column 1', type: 'cell' }, { id: 'c2', label: 'Column 2', type: 'cell' }, { id: 'c3', label: 'Column 3', type: 'cell' }],
  settings: [
    { key: 'table', label: 'Table name', kind: 'text', default: 'Results' },
    { key: 'n1', label: 'Column 1 name', kind: 'text', default: 'A' },
    { key: 'n2', label: 'Column 2 name', kind: 'text', default: 'B' },
    { key: 'n3', label: 'Column 3 name', kind: 'text', default: 'C' },
    { key: 'keep', label: 'Keep skipped passes', kind: 'bool', default: true },
  ],
  skipTable(s) { return s.keep ? s.table : ''; },
  emit(cx) {
    cx.helper('table');
    const cols = [['c1', cx.s.n1], ['c2', cx.s.n2], ['c3', cx.s.n3]].filter(([id, n]) => cx.has(id) && n);
    return [`table(${cx.lit(cx.s.table)}).add({${cols.map(([id, n]) => `${cx.lit(n)}: ${cx.in(id)}`).join(', ')}}, status=${cx.s.keep ? 'True' : 'False'})`];
  },
});
defineBlock({
  type: 'test.search', cat: 'search', kind: 'callback', title: 'Test search',
  outputs: [
    { id: 'value', label: 'Value', type: 'num', scope: 'body', var: 'value' },
    { id: 'best', label: 'Best', type: 'num', scope: 'done', var: 'best' },
  ],
  settings: [
    { key: 'lo', label: 'Lowest', kind: 'number', default: 1 },
    { key: 'hi', label: 'Highest', kind: 'number', default: 5 },
    { key: 'n', label: 'Tries', kind: 'number', default: 5 },
  ],
  emit(cx) {
    const v = cx.name('value');
    cx.out('value', v);
    const res = cx.name('search');
    cx.out('best', `${res}.best`);
    cx.helper('fake_search');
    return {
      params: [v], labels: ['Value'], goal: 'max',
      call: [`${res} = fake_search(${cx.fn}, ${cx.num(cx.s.lo)}, ${cx.num(cx.s.hi)}, ${cx.num(cx.s.n)})`],
    };
  },
});
defineBlock({
  type: 'test.report', cat: 'search', kind: 'action', title: 'Test report', within: 'callback',
  inputs: [{ id: 'score', label: 'Score', type: 'num' }, { id: 'ok', label: 'Pass', type: 'bool' }],
  emit(cx) {
    if (!cx.trial) return ['pass'];
    return [`${cx.trial}.report(score=${cx.in('score')}, ok=${cx.in('ok')})`];
  },
});
defineBlock({
  type: 'test.rms', cat: 'study', kind: 'branch', title: 'Test RMS', effects: fx(['results'], []),
  flowOuts: [{ id: 'ok', label: 'Reached the end' }, { id: 'fail', label: 'Did not initialise', stopMsg: 'RMS did not initialise' }],
  outputs: [{ id: 'result', label: 'Result', type: 'res', var: 'run' }],
  emit(cx) {
    const mons = cx.monitors();
    const r = cx.out('result');
    const ml = mons.map(m => (m.each !== undefined ? `("each", ${m.each}, ${m.var})` : `(${m.obj}, ${m.var})`));
    cx.helper('fake_rms');
    return { lines: [`${r} = fake_rms(app, [${ml.join(', ')}])`], branches: [{ out: 'ok', test: `${r}.ok` }], elseOut: 'fail' };
  },
});
defineBlock({
  type: 'test.series', cat: 'study', kind: 'pure', title: 'Test series',
  inputs: [{ id: 'res', label: 'Result', type: 'res', required: true }, { id: 'element', label: 'Element', type: 'obj', fallback: 'el' }],
  outputs: [{ id: 'series', label: 'Series', type: 'series' }],
  settings: [
    { key: 'el', label: 'Element', kind: 'element', default: { cls: 'ElmTerm', name: 'Bus 1', match: 'one' } },
    { key: 'var', label: 'Variable', kind: 'attr', default: 'm:fehz' },
  ],
  monitors() { return [{ element: 'element', variable: 'var' }]; },
  emit(cx) { return `${cx.in('res')}.series(${cx.in('element')}, ${cx.val('var')})`; },
});
defineBlock({
  type: 'test.foreach', cat: 'model', kind: 'loop', title: 'Test for each element',
  outputs: [{ id: 'item', label: 'Element', type: 'obj', scope: 'body', var: 'element' }],
  settings: [
    { key: 'name', label: 'Name', kind: 'text', default: 'Element' },
    { key: 'el', label: 'Elements', kind: 'element', default: { cls: 'ElmTerm', name: '*', match: 'all' } },
    { key: 'restore', label: 'After each pass', kind: 'select', default: 'pass', options: ['pass', 'end', 'never'] },
    { key: 'fin', label: 'Restore line', kind: 'bool', default: false },
  ],
  itemOutput: 'item',
  itemList(cx) { return cx.element('el'); },
  emit(cx) {
    const lst = cx.name('elements');
    const it = cx.out('item');
    const i = cx.name('pass');
    if (cx.s.fin) cx.helper('touch_model');
    return {
      lines: [`${lst} = ${cx.element('el')}`],
      header: `for ${i}, ${it} in enumerate(${lst}, 1):`,
      iter: { i, n: `len(${lst})` },
      ctx: [cx.lit(cx.s.name), it],
      bodyFinally: cx.s.fin ? ['touch_model("restore")'] : [],
    };
  },
});
