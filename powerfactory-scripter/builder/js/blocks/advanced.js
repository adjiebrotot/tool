// Advanced: a Python code block, and Note (DESIGN section 9, "adv").
//
// Type ids, setting keys, list row ids and port ids are frozen handles. The Python code block's
// ports come from its list rows (stable ids i1, i2 / o1, o2), so renaming a variable keeps its
// wires.

import { defineBlock } from '../core/registry.js';
import { checkPythonCode, isPyName } from '../core/blockkit.js';

const CAT = 'adv';
const OUT_TYPES = [['num', 'Number'], ['text', 'Text'], ['bool', 'Yes / No'], ['list', 'List of numbers'], ['items', 'List'], ['any', 'Anything']];

const rowsOf = (v) => (Array.isArray(v) ? v : []);

defineBlock({
  type: 'adv.python', cat: CAT, kind: 'action',
  title: 'Python code',
  desc: 'Runs your own Python with named inputs and outputs. The code becomes a function of its inputs; set the outputs as variables.',
  keywords: ['python', 'code', 'script', 'custom', 'function', 'advanced', 'expression'],
  inputs: [{ id: 'i1', label: 'a', type: 'any' }],
  outputs: [{ id: 'o1', label: 'result', type: 'num' }],
  settings: [
    { key: 'inputs', label: 'Inputs', kind: 'list', rowPrefix: 'i', default: [{ id: 'i1', name: 'a' }],
      columns: [{ key: 'name', label: 'Name in the code', kind: 'text', default: '' }],
      tip: 'Each input is a variable your code can read. Names: letters, digits and _, starting with a letter.' },
    { key: 'outputs', label: 'Outputs', kind: 'list', rowPrefix: 'o', default: [{ id: 'o1', name: 'result', type: 'num' }],
      columns: [{ key: 'name', label: 'Name in the code', kind: 'text', default: '' }, { key: 'type', label: 'Holds', kind: 'select', default: 'num', options: OUT_TYPES }],
      tip: 'Set each output as a variable in your code; the block passes it on.' },
    { key: 'code', label: 'Code', kind: 'code', default: 'result = a * 2', noPin: true,
      tip: 'Plain Python. The inputs are variables; set the outputs. Imports go inside the code. Raise an error to fail the pass.' },
    { key: 'touches', label: 'What the code does in PowerFactory', kind: 'select', default: 'none', more: true, noPin: true,
      options: [['none', 'Nothing (plain calculation)'], ['reads', 'Reads results'], ['model', 'Changes the model'], ['calc', 'Runs a calculation']],
      tip: 'Tells the Builder what your code does through app, so loops put changed values back and results are not read after a change.' },
  ],
  effects(s) {
    if (s.touches === 'model') return { writes: ['model'], reads: [] };
    if (s.touches === 'calc') return { writes: ['results'], reads: [] };
    if (s.touches === 'reads') return { writes: [], reads: ['results'] };
    return { writes: [], reads: [] };
  },
  ports(s) {
    return {
      inputs: rowsOf(s.inputs).map(r => ({ id: r.id, label: String(r.name || r.id), type: 'any' })),
      outputs: rowsOf(s.outputs).map(r => ({ id: r.id, label: String(r.name || r.id), type: OUT_TYPES.some(t => t[0] === r.type) ? r.type : 'num', var: String(r.name || r.id) })),
    };
  },
  summary(s) {
    const first = String(s.code || '').split('\n').find(l => l.trim()) || '';
    return first.trim().slice(0, 40);
  },
  emit(cx) {
    const ins = rowsOf(cx.s.inputs), outs = rowsOf(cx.s.outputs);
    const bad = [...ins, ...outs].map(r => String(r.name || '')).filter(n => !isPyName(n));
    const names = [...ins, ...outs].map(r => String(r.name || ''));
    const dup = names.find((n, i) => n && names.indexOf(n) !== i);
    const chk = checkPythonCode(cx.s.code);
    const fn = cx.name(cx.label === 'Python code' ? 'python_code' : cx.label);
    const params = ins.map(r => String(r.name || ''));
    const lines = [];
    if (bad.length || dup || chk.errors.length) {
      // The code cannot go in as it is: write a function that says so, so the file still compiles.
      const why = bad.length ? `"${bad[0]}" is not a usable name` : dup ? `the name "${dup}" is used twice` : chk.errors[0];
      lines.push(`def ${fn}(*args):`);
      lines.push(`    raise RuntimeError(${cx.lit(`${cx.label}: ${why}. Fix the code in the Builder.`)})`);
      for (const l of chk.lines) lines.push('    # ' + l.replace(/[\r\n]/g, ' '));
    } else {
      lines.push(`def ${fn}(${params.join(', ')}):`);
      const body = chk.lines.length ? chk.lines : ['pass'];
      for (const l of body) lines.push('    ' + l);
      const ret = outs.map(r => String(r.name));
      lines.push('    return ' + (ret.length === 0 ? 'None' : ret.length === 1 ? ret[0] : '(' + ret.join(', ') + ')'));
    }
    const call = `${fn}(${ins.map(r => cx.in(r.id)).join(', ')})`;
    const targets = outs.map(r => cx.out(r.id));
    if (!targets.length) lines.push(call);
    else if (targets.length === 1) lines.push(`${targets[0]} = ${call}`);
    else lines.push(`${targets.join(', ')} = ${call}`);
    return lines;
  },
  validate(cx) {
    const ins = rowsOf(cx.s.inputs), outs = rowsOf(cx.s.outputs);
    for (const r of [...ins, ...outs]) {
      if (!isPyName(String(r.name || ''))) cx.error(`${cx.label}: "${String(r.name || '')}" is not a usable name for an input or output. Use letters, digits and _, starting with a letter.`);
    }
    const names = [...ins, ...outs].map(r => String(r.name || ''));
    const dup = names.find((n, i) => n && names.indexOf(n) !== i);
    if (dup) cx.error(`${cx.label}: the name "${dup}" is used twice. Give each input and output its own name.`);
    const chk = checkPythonCode(cx.s.code);
    if (chk.errors.length) cx.error(`${cx.label}: the code has a mistake (${chk.errors[0]}).`);
    const code = chk.lines.join('\n');
    for (const r of outs) {
      const n = String(r.name || '');
      if (isPyName(n) && !new RegExp('(^|[^\\w.])' + n + '\\s*(=(?!=)|\\+=|-=|\\*=|/=|,|\\))').test(code) && !new RegExp('\\b(for|as|global|nonlocal|def|import)\\s+[^\\n]*\\b' + n + '\\b').test(code)) {
        cx.warn(`${cx.label}: the code never seems to set "${n}", so that output may stay empty.`);
      }
    }
  },
});

defineBlock({
  type: 'note', cat: CAT, kind: 'note',
  title: 'Note',
  desc: 'A note on the canvas for you and your colleagues. It also goes into the script as a comment.',
  keywords: ['note', 'comment', 'text', 'annotation', 'remark', 'documentation'],
  settings: [{ key: 'text', label: 'Text', kind: 'textarea', default: '' }],
  summary(s) { return String(s.text || '').split('\n')[0].slice(0, 60); },
});
