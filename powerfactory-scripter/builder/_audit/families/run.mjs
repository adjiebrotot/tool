// Block families, the Kind switch, what the palette and quick-add offer, the Settings tab's
// inputs and the ports the canvas folds: the parts of the editor that decide what a reader is
// offered, tested without a browser (the ui suite drives the same in Chromium).
//
// Run from the repo root (D:\Repository\tool):
//   node powerfactory-scripter/builder/_audit/families/run.mjs
// Prints "families tests: N passed, M failed" and exits 1 on a failure.
//
// The guard the families rest on: a setting key two members of a family share means the same
// thing in both, because a Kind switch carries its value across. "The same thing" is checked as
// the same kind (or a declared conversion between a number, a text and a yes / no), the same
// unit, the same label for every option value both offer, the same list columns, and the same
// words for the setting, except where LABEL_OK says why the words differ and the meaning does
// not. A key that means something else on another member says so with `meaning`, and then the
// switch must give the new kind's default, which is checked too.

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILDER = path.resolve(HERE, '..', '..');
const imp = (rel) => import(pathToFileURL(path.join(BUILDER, rel)).href);
await imp('js/blocks/index.js');
const R = await imp('js/core/registry.js');
const W = await imp('js/core/workflow.js');
const ops = await imp('js/ui/ops.js');

const results = [];
class Fail extends Error {}
const ok = (c, m) => { if (!c) throw new Fail(m || 'expected true'); };
const eq = (a, b, m) => { const ja = JSON.stringify(a), jb = JSON.stringify(b); if (ja !== jb) throw new Fail(`${m ? m + ': ' : ''}got ${ja}, expected ${jb}`); };
function test(name, fn) {
  try { fn(); results.push({ name, ok: true }); } catch (e) { results.push({ name, ok: false, msg: e instanceof Fail ? e.message : (e && e.stack) || String(e) }); }
}

// Words that differ between members for a key that means the same: [family, key, reason].
const LABEL_OK = [
  ['end', 'msg', 'Skip to next pass calls its message the Reason (it goes into the Status column); the others call it the Message.'],
  ['event', 'el', 'Add trip event calls its element the Generator, the usual thing it trips.'],
  ['event', 'mode', 'One parameter change says Change, parameter steps say Each value: both choose how the value is applied.'],
  ['curve', 'after', 'Peak looks From a time, First time above / below Looks from it: both are where the search starts.'],
  ['graph', 'lines', 'The time series graph draws Curves, the 2D graph Lines: both are the rows of what is drawn.'],
  ['graph', 'zlabel', 'The 3D graph\'s third axis is a Height, the heat map\'s a Colour: both name the value drawn.'],
  ['graph', 'zunit', 'As zlabel.'],
  ['var', 'alone', 'Activate variation says Deactivate the other variations, For each variation Only that variation active: one choice, in two directions.'],
  ['value', 'value', 'A number, a text and a yes / no: "Value", "Text" and "Yes" all name the value itself (convert).'],
];
const usedOk = new Set();
const okLabel = (fam, key) => { const hit = LABEL_OK.some(([f, k]) => f === fam && k === key); if (hit) usedOk.add(fam + ':' + key); return hit; };
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const SCALAR = new Set(['number', 'text', 'bool', 'textarea']);

// ---------------------------------------------------------------------------------------------

test('families: 92 blocks make 58 palette entries; members exist, share a category, the default is one of them', () => {
  const fams = R.allFamilies();
  const inFam = fams.flatMap(f => f.members);
  eq(new Set(inFam).size, inFam.length, 'a block in two families');
  eq(R.allBlocks().length, 92);
  eq(R.allBlocks().length - inFam.length + fams.length, 58, 'palette entries');
  for (const f of fams) {
    ok(f.members.every(t => R.getBlock(t)), f.id + ': unknown member');
    ok(new Set(f.members.map(t => R.getBlock(t).cat)).size === 1, f.id + ': members in two categories');
    ok(f.members.includes(f.dflt), f.id + ': default not a member');
    ok(f.desc && f.desc.length <= 200 && f.title, f.id + ': words');
  }
  const want = {
    stats: 8, end: 3, sim: 2, event: 6, curve: 4, graph: 6, value: 5, case: 3, scen: 3, var: 3, deactivate: 2,
  };
  for (const [id, n] of Object.entries(want)) eq((fams.find(f => f.id === id) || { members: [] }).members.length, n, id);
});

test('guard: a setting key the members of a family share means the same thing in each', () => {
  const bad = [];
  for (const f of R.allFamilies()) {
    const defs = f.members.map(t => R.getBlock(t));
    for (let i = 0; i < defs.length; i++) for (let j = i + 1; j < defs.length; j++) {
      const A = defs[i], B = defs[j];
      for (const a of A.settings) {
        const b = B.settings.find(x => x.key === a.key);
        if (!b) continue;
        const where = `${f.id}: ${A.type}.${a.key} / ${B.type}.${b.key}`;
        if (R.meaningOf(a) !== R.meaningOf(b)) continue;   // said to differ: the switch resets it (next test)
        if (a.kind !== b.kind && !(f.convert.includes(a.key) && SCALAR.has(a.kind) && SCALAR.has(b.kind))) bad.push(`${where}: ${a.kind} / ${b.kind}`);
        if ((a.unit || '') !== (b.unit || '')) bad.push(`${where}: unit ${a.unit} / ${b.unit}`);
        if (a.kind === 'select') {
          const la = new Map(R.optionPairs(a).map(([v, l]) => [v, norm(l)])), lb = new Map(R.optionPairs(b).map(([v, l]) => [v, norm(l)]));
          for (const [v, l] of la) if (lb.has(v) && lb.get(v) !== l && !okLabel(f.id, a.key)) bad.push(`${where}: option "${v}" is "${l}" / "${lb.get(v)}"`);
        }
        if (a.kind === 'list') {
          const ca = (a.columns || []).map(c => c.key + ':' + c.kind).join(','), cb = (b.columns || []).map(c => c.key + ':' + c.kind).join(',');
          if (ca !== cb) bad.push(`${where}: columns ${ca} / ${cb}`);
        }
        if (norm(a.label) !== norm(b.label) && !okLabel(f.id, a.key)) bad.push(`${where}: "${a.label}" / "${b.label}" (same meaning? then the same words, or a reason in LABEL_OK)`);
      }
    }
  }
  eq(bad, [], 'keys that may not mean the same');
  eq(LABEL_OK.filter(([f, k]) => !usedOk.has(f + ':' + k)).map(([f, k]) => f + ':' + k), [], 'reasons in LABEL_OK no longer needed (remove them)');
});

test('guard: a key that means something else on the other kind takes that kind\'s default; one left at the old default takes the new default', () => {
  for (const f of R.allFamilies()) {
    for (const from of f.members) for (const to of f.members) {
      if (from === to) continue;
      const A = R.getBlock(from), B = R.getBlock(to);
      let wf = W.emptyWorkflow();
      const added = ops.addNode(wf, from, 0, 0);
      wf = added.wf;
      const next = ops.switchKind(wf, added.node.id, to);
      const n = ops.nodeById(next, added.node.id);
      eq(n.type, to, `${from} -> ${to}`);
      const s = R.settingsOf(n);
      for (const b of B.settings) {
        const a = A.settings.find(x => x.key === b.key);
        if (!a) continue;
        // A fresh block holds the old kind's defaults: every shared key must arrive as the new
        // kind's default (a different meaning, or a value left at the default).
        eq(JSON.stringify(s[b.key]), JSON.stringify(R.settingsOf({ type: to, s: {} })[b.key]), `${from} -> ${to}: ${b.key}`);
      }
    }
  }
});

test('Kind switch: same id, name, pins and wires; a value the reader set goes across; keys the new kind lacks are kept for the way back', () => {
  let wf = W.emptyWorkflow();
  let r = ops.addNode(wf, 'pf.rms', 300, 0, { label: 'Fault run' }); wf = r.wf; const id = r.node.id;
  wf = ops.addRow(wf, id, 'record');
  wf = ops.setSetting(wf, id, 'net', 'rst');
  wf = ops.setSetting(wf, id, 'tstop', 3);
  wf = ops.togglePin(wf, id, 'tstop');
  r = ops.addNode(wf, 'sig.nadir', 600, 0); wf = r.wf; const nad = r.node.id;
  wf = ops.connect(wf, { from: 'n1', out: 'next', to: id, in: 'in' }).wf;
  wf = ops.connect(wf, { from: id, out: 'r1', to: nad, in: 'series' }).wf;
  const emt = ops.switchKind(wf, id, 'pf.emt');
  const n = ops.nodeById(emt, id);
  eq([n.type, n.label, n.pin], ['pf.emt', 'Fault run', ['tstop']]);
  const s = R.settingsOf(n);
  eq([s.tstop, s.net, s.record.length], [3, 'rst', 1], 'what the reader set goes across');
  eq(emt.edges, wf.edges, 'the wires are kept');
  eq(ops.hangingWires(wf, id, 'pf.emt'), [], 'RMS to EMT leaves no wire hanging');
  // A key the new kind does not have stays, for the way back.
  let w2 = ops.addNode(W.emptyWorkflow(), 'sig.peak', 0, 0); const pk = w2.node.id;
  let w3 = ops.setSetting(w2.wf, pk, 'kind', 'abs');
  w3 = ops.switchKind(w3, pk, 'sig.final');
  eq(ops.nodeById(w3, pk).s.kind, 'abs', 'kept in the block');
  w3 = ops.switchKind(w3, pk, 'sig.peak');
  eq(R.settingsOf(ops.nodeById(w3, pk)).kind, 'abs', 'back again');
  // Not in a family, or not a member: nothing happens.
  eq(ops.switchKind(wf, nad, 'sig.peak'), wf);
  eq(ops.switchKind(wf, id, 'sig.peak'), wf);
});

test('Kind switch: the wires that would be left hanging are named first (a gone port, a port that no longer takes the wire)', () => {
  let wf = W.emptyWorkflow();
  let r = ops.addNode(wf, 'out.plot.series', 0, 0); wf = r.wf; const g = r.node.id;
  r = ops.addNode(wf, 'pf.rms', 0, 0); wf = r.wf; const rms = r.node.id;
  wf = ops.addRow(wf, rms, 'record');
  r = ops.addNode(wf, 'sig.nadir', 0, 0); wf = r.wf; const nad = r.node.id;
  wf = ops.connect(wf, { from: rms, out: 'r1', to: g, in: 'l1' }).wf;
  wf = ops.connect(wf, { from: nad, out: 'nadir', to: g, in: 'mark' }).wf;
  const h = ops.hangingWires(wf, g, 'out.plot.conv');
  eq(h.map(x => [x.port, x.gone]).sort(), [['l1', true], ['mark', true]]);
  const xy = ops.hangingWires(wf, g, 'out.plot.xy');
  eq(xy.map(x => x.port).sort(), ['mark'], 'a curve goes into a line of a 2D graph; the mark has no place there');
  const after = ops.switchKind(wf, g, 'out.plot.conv');
  eq(after.edges.length, wf.edges.length, 'kept, to be flagged');
  const gen = (w) => W.loadWorkflow(w).notes.filter(n => /port it no longer has/.test(n.msg)).length;
  eq(gen(after), 2, 'the loader flags them');
});

test('quick-add: exact matches first (Frequency nadir 2nd for a time series), any-value inputs after, the ones that cannot work greyed at the end', () => {
  const list = ops.blocksFor({ side: 'out', type: 'series' });
  const titles = list.map(m => m.def.title);
  ok(titles.indexOf('Frequency nadir') <= 2, titles.join(', '));
  const firstOff = list.findIndex(m => m.off);
  ok(firstOff > 0 && list.slice(firstOff).every(m => m.off), 'greyed ones last');
  for (const t of ['Activate study case', 'Create study case', 'Activate operation scenario', 'Activate variation', 'Deactivate variation']) {
    const m = list.find(x => x.def.title === t);
    ok(m && /does not take a time series/.test(m.off), t + ': ' + (m && m.off));
  }
  const ranks = list.filter(m => !m.off).map(m => m.rank);
  eq(ranks, ranks.slice().sort((a, b) => a - b), 'exact, then compatible, then any value');
  ok(list.findIndex(m => m.rank === 2) > list.findIndex(m => m.def.title === 'Draw time series graph'), 'any-value ports after the series ones');
});

test('quick-add: a flow wire greys Skip to next pass and Stop the loop outside a loop, Report this try outside a search', () => {
  const offs = (chain) => ops.blocksFor({ side: 'out', type: 'flow' }, { chain }).filter(m => m.off).map(m => m.def.type).sort();
  eq(offs([]), ['flow.break', 'flow.next', 'opt.report']);
  eq(offs([{ kind: 'loop' }]), ['opt.report']);
  eq(offs([{ kind: 'callback' }]), []);
  eq(offs(null), [], 'not known yet: nothing greyed');
  const flow = ops.blocksFor({ side: 'out', type: 'flow' }, { chain: [] });
  ok(flow.slice(-3).every(m => m.off), 'sunk to the end');
  ok(flow.some(m => m.def.type === 'flow.stop' && !m.off), 'Stop the workflow works anywhere');
});

test('quick-add and palette: the loops around a spot come from the generator\'s regions (Each pass inside, After all passes outside)', () => {
  const wf = { nodes: [{ id: 'n1', type: 'start', s: {} }, { id: 'n2', type: 'flow.range', s: {} }, { id: 'n3', type: 'flow.log', s: {} }], edges: [{ id: 'e1', from: 'n1', out: 'next', to: 'n2', in: 'in' }, { id: 'e2', from: 'n2', out: 'body', to: 'n3', in: 'in' }] };
  const regions = { n1: [], n2: [], n3: [{ id: 'n2', kind: 'loop', label: 'L' }] };
  eq(ops.chainAfterPort(wf, regions, 'n2', 'body').map(c => c.kind), ['loop']);
  eq(ops.chainAfterPort(wf, regions, 'n2', 'done'), []);
  eq(ops.chainAfterPort(wf, regions, 'n3', 'next').map(c => c.kind), ['loop']);
  eq(ops.chainAfterStep(wf, regions, 'n2'), [], 'Each pass is used, so a click goes on After all passes');
  eq(ops.chainAfterStep(wf, regions, 'n3').map(c => c.kind), ['loop']);
  eq(ops.chainAfterPort(wf, null, 'n2', 'body'), null);
  eq(ops.whyNotHere(R.getBlock('opt.report'), []), 'Only inside Optimise or Find limit');
  eq(ops.whyNotHere(R.getBlock('flow.next'), [{ kind: 'callback' }]), '');
});

test('Settings inputs: no row says only "Not connected (optional)" or "Not used with these settings"; the optional ones share one line; More holds the eight settings', () => {
  let rowsNotConnected = 0, rowsNotUsed = 0;
  const optionalLines = {};
  for (const def of R.allBlocks()) {
    if (def.kind === 'note') continue;
    let wf = W.emptyWorkflow();
    const r = def.kind === 'start' ? { wf, node: wf.nodes[0] } : ops.addNode(wf, def.type, 0, 0);
    const vis = R.visibleSettings(r.node, new Set(), {});
    const plan = ops.inputPlan(r.wf, r.node, vis);
    for (const p of plan.rows) {
      const fst = p.fallback && def.settings.find(z => z.key === p.fallback);
      if (!fst && !p.required && !p.stray) rowsNotConnected++;
      if (fst && !vis.some(v => v.key === fst.key)) rowsNotUsed++;
    }
    if (plan.optional.length) optionalLines[def.type] = plan.optional.map(p => p.label);
    if (plan.toWire.length) optionalLines[def.type + ':main'] = plan.toWire.map(p => p.label);
  }
  eq([rowsNotConnected, rowsNotUsed], [0, 0]);
  eq(optionalLines['out.plot.series'], ['Mark', 'Mark time', 'Limit line', 'Event time', 'Footnote']);
  eq(optionalLines['out.plot.series:main'], ['Curve 1', '+ drop a curve']);
  const more = (type, s = {}) => { const wf = W.emptyWorkflow(); const r = ops.addNode(wf, type, 0, 0, { s }); return [...ops.inputPlan(r.wf, r.node, R.visibleSettings(r.node, new Set(), {})).moreInputs.keys()].sort(); };
  eq(more('sig.nadir'), ['extendTo', 'nominal']);
  eq(more('sig.rocof'), ['nominal']);
  eq(more('pf.shc'), ['rf', 'xf']);
  eq(more('pf.evt.shc', { target: { cls: 'ElmLne', name: 'L1', match: 'one' } }), ['loc', 'rf', 'xf']);
  eq(more('pf.evt.shc'), ['rf', 'xf'], 'Location on the line only for a line');
  const ifRows = (op) => { const wf = W.emptyWorkflow(); const r = ops.addNode(wf, 'flow.if', 0, 0, { s: { op } }); return ops.inputPlan(r.wf, r.node, R.visibleSettings(r.node, new Set(), {})).rows.map(p => p.id); };
  eq(ifRows('true'), ['a'], 'Compare with is not drawn for "is true"');
  eq(ifRows('gt'), ['a', 'b']);
});

test('Settings: the loops and Find limit keep their table-column name under More options', () => {
  for (const t of ['flow.range', 'flow.list', 'flow.repeat', 'flow.until', 'pf.foreach_element', 'pf.case.foreach', 'pf.scen.foreach', 'pf.var.foreach', 'pf.cont.foreach', 'opt.limit']) {
    const st = R.getBlock(t).settings.find(s => s.key === 'name');
    ok(st && st.more === true, t);
  }
});

test('canvas folds: Frequency nadir 9 rows to 3, Read attribute 7 to 1 for one element, Draw time series graph 7 inputs to 2; a wired port never folds', () => {
  const shown = (type, s = {}, wire) => {
    let wf = W.emptyWorkflow();
    const r = ops.addNode(wf, type, 0, 0, { s }); wf = r.wf;
    if (wire) wf = wire(wf, r.node.id);
    const node = ops.nodeById(wf, r.node.id);
    const f = ops.foldedPorts(wf, node, {});
    const p = ops.nodePorts(wf, node);
    return { rows: Math.max(p.inputs.filter(x => !f.inputs.has(x.id)).length, p.outputs.filter(x => !f.outputs.has(x.id)).length), f, p };
  };
  eq(shown('sig.nadir').rows, 3);
  eq(shown('pf.get').rows, 1);
  eq(shown('pf.get', { el: { cls: 'ElmLne', name: '*', match: 'all' } }).rows, 2, 'Highest and Lowest for a list');
  eq(shown('out.plot.series').p.inputs.filter(x => !shown('out.plot.series').f.inputs.has(x.id)).length, 2);
  eq([...shown('pf.evt.shc').f.inputs].sort(), ['loc', 'rf', 'xf']);
  eq([...shown('pf.rms').f.inputs].sort(), ['step', 'tstart']);
  // A wire into a folded input, or out of a folded output, shows it.
  const wired = shown('sig.nadir', {}, (wf, id) => {
    const r = ops.addNode(wf, 'out.table.add', 0, 0, { s: { cols: [{ id: 'c1', name: 'x' }] } });
    const r2 = ops.addNode(r.wf, 'val.number', 0, 0);
    let w = ops.connect(r2.wf, { from: id, out: 'recovery', to: r.node.id, in: 'c1' }).wf;
    w = ops.connect(w, { from: r2.node.id, out: 'value', to: id, in: 'nominal' }).wf;
    return w;
  });
  ok(!wired.f.outputs.has('recovery') && !wired.f.inputs.has('nominal'), 'wired ports are shown');
  // A Read attribute fed one element (For each element) shows Value; fed Element with all, Highest / Lowest.
  const fed = (srcType, out, s) => shown('pf.get', {}, (wf, id) => { const r = ops.addNode(wf, srcType, 0, 0, { s }); return ops.connect(r.wf, { from: r.node.id, out, to: id, in: 'obj' }).wf; });
  ok(!fed('pf.foreach_element', 'item').f.outputs.has('value'), 'one element: Value');
  const many = fed('pf.element', 'el', { el: { cls: 'ElmLne', name: '*', match: 'all' } });
  ok(many.f.outputs.has('value') && !many.f.outputs.has('max'), 'Elements: Highest and Lowest');
});

test('parallel routes: a second wire from a used flow output is added beside it (and offered back), an input still takes one wire', () => {
  let wf = W.emptyWorkflow();
  let r = ops.addNode(wf, 'flow.log', 0, 0); wf = r.wf; const a = r.node.id;
  r = ops.addNode(wf, 'flow.log', 0, 0); wf = r.wf; const b = r.node.id;
  const c1 = ops.connect(wf, { from: 'n1', out: 'next', to: a, in: 'in' });
  eq([c1.replaced.length, c1.parallel.length], [0, 0]);
  const c2 = ops.connect(c1.wf, { from: 'n1', out: 'next', to: b, in: 'in' });
  eq([c2.replaced.length, c2.parallel.length, c2.wf.edges.length], [0, 1, 2]);
  r = ops.addNode(c2.wf, 'val.number', 0, 0); const v = r.node.id;
  r = ops.addNode(r.wf, 'math.arith', 0, 0); const m = r.node.id;
  let w = ops.connect(r.wf, { from: v, out: 'value', to: m, in: 'a' }).wf;
  r = ops.addNode(w, 'val.number', 0, 0);
  const c3 = ops.connect(r.wf, { from: r.node.id, out: 'value', to: m, in: 'a' });
  eq(c3.replaced.length, 1, 'an input takes one wire');
  // Continue only if Yes takes every route the step led to.
  let w2 = W.emptyWorkflow();
  let q = ops.addNode(w2, 'pf.ldf', 0, 0); w2 = q.wf; const ld = q.node.id;
  q = ops.addNode(w2, 'flow.log', 0, 0); w2 = q.wf; const l1 = q.node.id;
  q = ops.addNode(w2, 'flow.log', 0, 0); w2 = q.wf; const l2 = q.node.id;
  w2 = ops.connect(w2, { from: 'n1', out: 'next', to: ld, in: 'in' }).wf;
  w2 = ops.connect(w2, { from: ld, out: 'ok', to: l1, in: 'in' }).wf;
  w2 = ops.connect(w2, { from: ld, out: 'ok', to: l2, in: 'in' }).wf;
  const cy = ops.continueIfYes(w2, ld, 'converged', 0, 0, {});
  const yes = cy.wf.edges.filter(e => e.from === cy.node.id && e.out === 'yes').map(e => e.to).sort();
  eq(yes, [l1, l2].sort());
});

// ---------------------------------------------------------------------------------------------

const failed = results.filter(r => !r.ok);
for (const r of results) console.log((r.ok ? '  PASS  ' : 'FAIL ') + r.name + (r.ok ? '' : '\n  ' + String(r.msg).replace(/\n/g, '\n  ')));
console.log(`families tests: ${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
