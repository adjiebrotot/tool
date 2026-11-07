// Small parsers the generic blocks share: typed value lists, {placeholder} templates, formulas
// and a syntax check for Python code blocks. Each one is used both by the block's ports()
// (the canvas shows an input per placeholder or formula name) and by its emit(), so the two
// always agree.
//
// Plain ES module, no DOM.

import { PY_KEYWORDS, PY_SOFT_KEYWORDS } from './names.js';

const NAME = /^[A-Za-z][A-Za-z0-9_]*$/;

// "1, 2, 3" or one value per line -> [1, 2, 3]; text stays text. One value per line also works
// for numbers with a decimal comma ("1,5" on its own line is 1.5).
export function parseValues(text) {
  const t = String(text === undefined || text === null ? '' : text);
  const lines = t.split(/\r\n|\n|\r/).map(s => s.trim()).filter(Boolean);
  let parts;
  if (lines.length > 1) parts = lines.map(l => l.replace(/[;,]\s*$/, ''));
  else parts = (lines[0] || '').split(/[;,]/).map(s => s.trim()).filter(Boolean);
  return parts.map(p => {
    const q = lines.length > 1 && /^-?\d+,\d+$/.test(p) ? p.replace(',', '.') : p;
    if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(q)) return Number(q);
    return p.replace(/^(["'])(.*)\1$/, '$2');
  });
}

export function allNumbers(values) {
  return values.length > 0 && values.every(v => typeof v === 'number' && Number.isFinite(v));
}

// The {name} and {name:spec} fields of a template, in order of first use. Returns
// { names: [...], bad: [field text...] }. "{{" and "}}" are literal braces.
export function placeholders(template) {
  const t = String(template === undefined || template === null ? '' : template);
  const names = [], bad = [];
  let i = 0;
  while (i < t.length) {
    const c = t[i];
    if (c === '{' && t[i + 1] === '{') { i += 2; continue; }
    if (c === '}' && t[i + 1] === '}') { i += 2; continue; }
    if (c === '{') {
      const j = t.indexOf('}', i);
      if (j < 0) { bad.push(t.slice(i)); break; }
      const field = t.slice(i + 1, j);
      const name = field.split(/[:!]/)[0].trim();
      if (NAME.test(name) && !/!/.test(field)) { if (!names.includes(name)) names.push(name); }
      else bad.push('{' + field + '}');
      i = j + 1;
      continue;
    }
    if (c === '}') { bad.push('}'); }
    i++;
  }
  return { names, bad };
}

// The port id for a placeholder or formula name ("in" is the flow input).
export function portIdFor(name) { return name === 'in' ? 'in_' : name; }

// A summary line kept short, with an ellipsis when it was cut (the canvas clamps it to two
// lines; a cut that ends mid-word without one reads as a typo).
export function clip(text, max = 80) {
  const t = String(text || '').trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}

// ---------------------------------------------------------------------------------------------
// Formulas (math.formula): an expression over named inputs, written into the script as
// (lambda a, b: <expr>). Names are resolved here (C22): inputs, abs/min/max/round, the math
// functions sqrt/log/log10/exp/sin/cos/tan and the constants pi and e; anything else is an
// error, so a formula can never call the workflow's own helpers.

export const FORMULA_FUNCS = { abs: 'abs', min: 'min', max: 'max', round: 'round', sqrt: 'math.sqrt', log: 'math.log', log10: 'math.log10', exp: 'math.exp', sin: 'math.sin', cos: 'math.cos', tan: 'math.tan' };
const FORMULA_CONSTS = { pi: 'math.pi', e: 'math.e' };
const FORMULA_WORDS = ['and', 'or', 'not', 'if', 'else', 'True', 'False', 'None'];

// Returns { ok, expr (Python), inputs: [names in order], usesMath, error }.
export function parseFormula(text) {
  const src = String(text === undefined || text === null ? '' : text);
  const res = { ok: false, expr: 'None', inputs: [], usesMath: false, error: '' };
  if (/[\r\n\u2028\u2029\u0085]/.test(src)) { res.error = 'a formula is one line: remove the line breaks'; return res; }
  if (!src.trim()) { res.error = 'the formula is empty'; return res; }
  const toks = [];
  const re = /\s+|(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(\*\*|\/\/|==|!=|<=|>=|[-+*\/%()<>,^])|(.)/g;
  let m;
  while ((m = re.exec(src))) {
    if (m[0].trim() === '') { toks.push({ k: 'ws', t: m[0] }); continue; }
    if (m[1] !== undefined) toks.push({ k: 'num', t: m[1] });
    else if (m[2] !== undefined) toks.push({ k: 'name', t: m[2] });
    else if (m[3] !== undefined) toks.push({ k: 'op', t: m[3] === '^' ? '**' : m[3] });
    else { res.error = `"${m[4]}" cannot be used in a formula`; return res; }
  }
  let depth = 0;
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    const tk = toks[i];
    if (tk.k === 'ws') { out.push(' '); continue; }
    if (tk.k === 'op') {
      if (tk.t === '(') depth++;
      if (tk.t === ')') { depth--; if (depth < 0) { res.error = 'a ")" has no "(" before it'; return res; } }
      out.push(tk.t);
      continue;
    }
    if (tk.k === 'num') { out.push(tk.t); continue; }
    let j = i + 1;
    while (j < toks.length && toks[j].k === 'ws') j++;
    const call = j < toks.length && toks[j].t === '(';
    const name = tk.t;
    if (call) {
      if (!FORMULA_FUNCS[name]) { res.error = `"${name}" is not a function a formula knows (use abs, min, max, round, sqrt, log, log10, exp, sin, cos, tan)`; return res; }
      if (FORMULA_FUNCS[name].startsWith('math.')) res.usesMath = true;
      out.push(FORMULA_FUNCS[name]);
      continue;
    }
    if (FORMULA_CONSTS[name]) { res.usesMath = true; out.push(FORMULA_CONSTS[name]); continue; }
    if (FORMULA_WORDS.includes(name)) { out.push(name); continue; }
    if (PY_KEYWORDS.includes(name) || PY_SOFT_KEYWORDS.includes(name) || name === 'math' || !NAME.test(name) || FORMULA_FUNCS[name]) {
      res.error = `"${name}" cannot be used as a name in a formula`; return res;
    }
    if (!res.inputs.includes(name)) res.inputs.push(name);
    out.push(name);
  }
  if (depth !== 0) { res.error = 'a "(" is not closed'; return res; }
  if (res.inputs.length > 12) { res.error = 'a formula can use at most 12 names'; return res; }
  res.ok = true;
  res.expr = out.join('').replace(/\s+/g, ' ').trim();
  return res;
}

// ---------------------------------------------------------------------------------------------
// Python code blocks (adv.python): the reader's code goes into the script as the body of a
// function. A syntax error there would stop the whole file from compiling, so the obvious
// mistakes are caught here and the block then writes a stub that says so instead of the code.
// This is a careful check, not a Python parser: what it misses, Python names with a line number.

// Returns { lines: [code lines, tabs expanded, common indent removed], errors: [text] }.
export function checkPythonCode(code) {
  const src = String(code === undefined || code === null ? '' : code).replace(/\r\n?/g, '\n').replace(/[\ue000-\uf8ff]/g, '?');
  let lines = src.split('\n').map(l => l.replace(/\t/g, '    ').replace(/\s+$/, ''));
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const ind = (l) => l.length - l.trimStart().length;
  const common = Math.min(...lines.filter(l => l.trim()).map(ind), Infinity);
  if (Number.isFinite(common) && common > 0) lines = lines.map(l => l.slice(Math.min(common, ind(l))));
  const errors = [];
  // Strings, comments and brackets, character by character.
  const stack = [];
  let str = null;            // the quote that opened the current string
  let strLine = 0;
  const logical = [];         // per physical line: does it end inside brackets or a string?
  for (let n = 0; n < lines.length; n++) {
    const l = lines[n];
    let i = 0;
    while (i < l.length) {
      const c = l[i];
      if (str) {
        if (c === '\\') { i += 2; continue; }
        if (l.startsWith(str, i)) { i += str.length; str = null; continue; }
        i++;
        continue;
      }
      if (c === '#') break;
      if (c === '"' || c === "'") {
        str = l.startsWith(c.repeat(3), i) ? c.repeat(3) : c;
        strLine = n + 1;
        i += str.length;
        continue;
      }
      if ('([{'.includes(c)) stack.push({ c, line: n + 1 });
      else if (')]}'.includes(c)) {
        const open = stack.pop();
        if (!open || '([{'.indexOf(open.c) !== ')]}'.indexOf(c)) { errors.push(`line ${n + 1}: "${c}" does not match an opening bracket`); }
      }
      i++;
    }
    if (str && str.length === 1 && !l.endsWith('\\')) { errors.push(`line ${strLine}: a text in quotes is not closed`); str = null; }
    logical.push(stack.length > 0 || !!str || l.endsWith('\\'));
  }
  if (str) errors.push(`line ${strLine}: a text in triple quotes is not closed`);
  for (const o of stack) errors.push(`line ${o.line}: "${o.c}" is not closed`);
  // Indentation: a line ending in ':' opens a block that must be indented; others may not be.
  if (!errors.length) {
    const levels = [0];
    let expectIndent = false;
    let cont = false;
    for (let n = 0; n < lines.length; n++) {
      const l = lines[n];
      const t = l.trim();
      if (!t || t.startsWith('#')) { continue; }
      if (cont) { cont = logical[n]; continue; }
      const d = ind(l);
      if (expectIndent) {
        if (d <= levels[levels.length - 1]) { errors.push(`line ${n + 1}: the line after a ":" must be indented`); break; }
        levels.push(d);
        expectIndent = false;
      } else if (d > levels[levels.length - 1]) {
        errors.push(`line ${n + 1}: this line is indented but nothing opens a block before it`); break;
      } else {
        while (d < levels[levels.length - 1]) levels.pop();
        if (d !== levels[levels.length - 1]) { errors.push(`line ${n + 1}: the indentation does not match any line above`); break; }
      }
      const noComment = t.replace(/#.*$/, '').trim();
      cont = logical[n];
      if (!cont && noComment.endsWith(':')) expectIndent = true;
    }
    if (!errors.length && expectIndent) errors.push('the last line ends with ":" but no indented block follows');
  }
  // Statements that are fine at the top of a file but a SyntaxError inside the function the
  // code becomes (they would stop the whole script from compiling).
  if (!errors.length) {
    const openers = [];      // [indent, keyword] of the blocks around the current line
    let cont = false;
    for (let n = 0; n < lines.length; n++) {
      const l = lines[n];
      const t = l.trim();
      if (!t || t.startsWith('#')) continue;
      if (cont) { cont = logical[n]; continue; }
      cont = logical[n];
      const d = ind(l);
      while (openers.length && openers[openers.length - 1][0] >= d) openers.pop();
      const code = t.replace(/#.*$/, '').trim();
      const kw = (/^(\w+)/.exec(code) || [])[1];
      if (kw === 'break' || kw === 'continue') {
        let inLoop = false;
        for (let k = openers.length - 1; k >= 0; k--) {
          if (openers[k][1] === 'for' || openers[k][1] === 'while') { inLoop = true; break; }
          if (openers[k][1] === 'def' || openers[k][1] === 'class') break;
        }
        if (!inLoop) { errors.push(`line ${n + 1}: "${kw}" only works inside a for or while loop of the code (to end a pass, use Skip to next pass)`); break; }
      }
      if (kw === 'nonlocal') { errors.push(`line ${n + 1}: "nonlocal" cannot be used in a Python code block (use Remember a value to keep a value)`); break; }
      if (/^from\s+__future__\s+import\b/.test(code)) { errors.push(`line ${n + 1}: "from __future__ import" cannot be used in a Python code block`); break; }
      if (/^from\s+\S+\s+import\s+\*/.test(code)) { errors.push(`line ${n + 1}: "import *" cannot be used in a Python code block; import the names you need`); break; }
      if (kw === 'await' || kw === 'async') { errors.push(`line ${n + 1}: "${kw}" cannot be used in a Python code block`); break; }
      if (!logical[n] && code.endsWith(':') && kw) openers.push([d, kw === 'async' ? 'for' : kw]);
    }
    if (!errors.length && lines.length && lines[lines.length - 1].endsWith('\\')) errors.push('the last line ends with "\\", which joins it to the next line');
  }
  return { lines, errors };
}

export function isPyName(name) {
  return NAME.test(String(name)) && !PY_KEYWORDS.includes(name) && !PY_SOFT_KEYWORDS.includes(name);
}

// ---------------------------------------------------------------------------------------------
// Names of values wired into results blocks (also used by the canvas previews, which must not
// load a block file of their own)

// Port labels that say nothing about the value, so the block's name says it instead.
const GENERIC = /^(value|values|item|result|text|list|number|yes \/ no|time series|series|curve|clean curve)$/i;

// The column name for a value wired in: "Nadir (Hz)", "Dispatch (MW)". src = { nodeLabel (the
// reader's label on the source block, '' when none), title (its block title or display name),
// first (the port is the block's first output), port: { label, id, unit } }.
export function columnName(src) {
  const port = (src && src.port) || {};
  const plab = String(port.label || port.id || '').trim();
  const own = String((src && src.nodeLabel) || '').trim();
  const title = String((src && src.title) || '').trim();
  const generic = !plab || GENERIC.test(plab);
  let name;
  if (own) name = generic || (src && src.first) ? own : `${own} ${plab}`;
  else name = generic ? (title || plab || 'Value') : plab;
  const unit = String(port.unit || '').trim();
  if (unit && !name.includes(`(${unit})`)) name += ` (${unit})`;
  return name.slice(0, 80);
}

// "Nadir (Hz), RoCoF (Hz/s)" or one per line -> ["Nadir (Hz)", "RoCoF (Hz/s)"]
export function columnList(text) {
  const t = String(text === undefined || text === null ? '' : text);
  const lines = t.split(/\r\n|\n|\r/).map(x => x.trim()).filter(Boolean);
  const parts = lines.length > 1 ? lines : (lines[0] || '').split(/[;,]/).map(x => x.trim());
  return parts.filter(Boolean);
}
