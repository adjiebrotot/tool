// Python literals, comments and a small literal reader, shared by the code generator (writing)
// and the workflow loader (reading back SETTINGS lines a reader edited in a downloaded .py).
//
// Everything a reader typed reaches the generated file only through these functions, so a
// label, a Windows path or a pasted name can never break the file or smuggle in code:
//   pyStr / pyLit   always give a valid Python literal (backslashes, quotes, newlines, \N,
//                   triple quotes, non-ASCII escaped as \uXXXX so a re-saved file cannot be
//                   corrupted by an editor's encoding);
//   pyCommentText   gives text safe to put after a '#': no line breaks of any kind (CR, LF,
//                   U+0085, U+2028, U+2029), no control or format characters.
// No backslash in this file is inside a template literal that reaches Python: the escapes are
// built with plain string concatenation (generator-patterns.md section 0).
//
// Plain ES module, no DOM.

const HEX = (n, w) => n.toString(16).padStart(w, '0');

// Unpaired surrogate halves (which no encoder can write) replaced by `repl`. Done by hand, not
// with a lookbehind regex, which older Safari versions cannot parse.
function fixSurrogates(s, repl) {
  if (!/[\uD800-\uDFFF]/.test(s)) return s;
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length && s.charCodeAt(i + 1) >= 0xDC00 && s.charCodeAt(i + 1) <= 0xDFFF) { out += s[i] + s[i + 1]; i++; }
    else if (c >= 0xD800 && c <= 0xDFFF) out += repl;
    else out += s[i];
  }
  return out;
}

// A Python str literal for any JS value turned to text. Windows paths with backslashes come out
// as a raw string (r"C:\Studies") when that is possible, because readers edit those in SETTINGS.
export function pyStr(value) {
  let s = String(value === undefined || value === null ? '' : value);
  s = fixSurrogates(s, '\uFFFD');
  if (s.includes('\\') && !/["\x00-\x1f\x7f-\uffff]/.test(s) && !/\\$/.test(s)) return 'r"' + s + '"';
  let out = '"';
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (ch === '\\') out += '\\\\';
    else if (ch === '"') out += '\\"';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (c < 0x20 || c === 0x7f) out += '\\x' + HEX(c, 2);
    else if (c > 0xffff) out += '\\U' + HEX(c, 8);
    else if (c > 0x7e) out += '\\u' + HEX(c, 4);
    else out += ch;
  }
  return out + '"';
}

// A Python number literal; NaN and infinities as float("nan") / float("inf").
export function pyNum(n) {
  if (typeof n !== 'number') n = Number(n);
  if (Number.isNaN(n)) return 'float("nan")';
  if (n === Infinity) return 'float("inf")';
  if (n === -Infinity) return 'float("-inf")';
  if (Object.is(n, -0)) return '-0.0';
  // JS's shortest round-trip form is also valid Python ("1e-7", "1e+21", "0.1").
  return String(n);
}

// Any JSON-like value as a Python literal. Functions and other odd values become None.
export function pyLit(v) {
  if (v === null || v === undefined) return 'None';
  if (v === true) return 'True';
  if (v === false) return 'False';
  if (typeof v === 'number') return pyNum(v);
  if (typeof v === 'bigint') return String(v);
  if (typeof v === 'string') return pyStr(v);
  if (Array.isArray(v)) return '[' + v.map(pyLit).join(', ') + ']';
  if (typeof v === 'object') return '{' + Object.keys(v).map(k => pyStr(k) + ': ' + pyLit(v[k])).join(', ') + '}';
  return 'None';
}

// Text that is safe after '#': every kind of line break and every control, format (bidi,
// zero-width), private-use and unpaired surrogate character becomes a space. The code
// generator's own name tokens (U+E000 digits U+E001) are kept so a comment may name a variable.
export function pyCommentText(text, max = 240) {
  let s = String(text === undefined || text === null ? '' : text);
  s = s.replace(/[\r\n\u0085\u2028\u2029\x00-\x1f\x7f-\x9f\u00ad\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb\uE002-\uF8FF]/g, ' ');
  s = fixSurrogates(s, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length > max) s = s.slice(0, max - 3).trimEnd() + '...';
  return s;
}

// One comment line ("# text"), or '' when the text is empty.
export function pyComment(text, max) {
  const t = pyCommentText(text, max);
  return t ? '# ' + t : '#';
}

// Identifier-like expression (a name, a name token, or a dotted chain of them): safe to use
// without parentheses after `not`, and safe to reuse without assigning it to a variable.
const NAME_CHAIN = /^[A-Za-z_\uE000][A-Za-z0-9_.\uE000\uE001]*$/;
export function isNameExpr(e) { return NAME_CHAIN.test(String(e)); }

// A literal or a name: an expression that may be written in place instead of first being
// assigned to a variable (a pure block that just gives a number, a text or a setting).
export function isAtom(e) {
  const s = String(e).trim();
  return NAME_CHAIN.test(s) ||
    /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(s) ||
    /^r?"(?:[^"\\\n]|\\.)*"$/.test(s) ||
    /^float\("(nan|inf|-inf)"\)$/.test(s);
}

// `(e)` unless e is a plain name: for building conditions such as `not (a > b)`.
export function paren(e) {
  const s = String(e).trim();
  return isNameExpr(s) || s === 'True' || s === 'False' || s === 'None' ? s : '(' + s + ')';
}

// ---------------------------------------------------------------------------------------------
// Reading Python literals back (SETTINGS lines of a downloaded .py: NAME = <literal>  # comment)

// Parse one literal at the start of `src`. Returns { value } or null when it is not a literal
// this reader understands (then the line is left alone and the reader is told).
export function parsePyLiteral(src) {
  const p = { s: String(src), i: 0 };
  try {
    skipWs(p);
    const value = readValue(p);
    skipWs(p);
    if (p.i < p.s.length && p.s[p.i] !== '#') return null;
    return { value };
  } catch (e) {
    return null;
  }
}

function skipWs(p) { while (p.i < p.s.length && /\s/.test(p.s[p.i])) p.i++; }

function readValue(p) {
  skipWs(p);
  const s = p.s, c = s[p.i];
  if (c === '[' || c === '(') return readList(p, c === '[' ? ']' : ')');
  if (/['"]/.test(c) || (/[rRuU]/.test(c) && /['"]/.test(s[p.i + 1] || ''))) {
    let out = readString(p);
    for (;;) {                       // implicit concatenation: "a" "b"
      const save = p.i; skipWs(p);
      const d = s[p.i];
      if (d && (/['"]/.test(d) || (/[rRuU]/.test(d) && /['"]/.test(s[p.i + 1] || '')))) out += readString(p);
      else { p.i = save; break; }
    }
    return out;
  }
  const m = /^(True|False|None)\b/.exec(s.slice(p.i));
  if (m) { p.i += m[0].length; return m[1] === 'True' ? true : m[1] === 'False' ? false : null; }
  const f = /^float\(\s*(['"])\s*([+-]?)(nan|inf|infinity)\s*\1\s*\)/i.exec(s.slice(p.i));
  if (f) { p.i += f[0].length; return f[3].toLowerCase() === 'nan' ? NaN : (f[2] === '-' ? -Infinity : Infinity); }
  const n = /^[+-]?\s*(0[xX][0-9a-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+|(\d[\d_]*)?\.?\d[\d_]*([eE][+-]?\d[\d_]*)?)/.exec(s.slice(p.i));
  if (n && n[0].trim() !== '' && /\d/.test(n[0])) {
    p.i += n[0].length;
    const t = n[0].replace(/[\s_]/g, '');
    const neg = t.startsWith('-');
    const body = t.replace(/^[+-]/, '');
    let v;
    if (/^0[xX]/.test(body)) v = parseInt(body.slice(2), 16);
    else if (/^0[oO]/.test(body)) v = parseInt(body.slice(2), 8);
    else if (/^0[bB]/.test(body)) v = parseInt(body.slice(2), 2);
    else v = Number(body);
    if (!Number.isFinite(v) && !/e/i.test(body)) throw new Error('bad number');
    return neg ? -v : v;
  }
  throw new Error('not a literal');
}

function readList(p, close) {
  p.i++;
  const out = [];
  for (;;) {
    skipWs(p);
    if (p.s[p.i] === close) { p.i++; return out; }
    out.push(readValue(p));
    skipWs(p);
    if (p.s[p.i] === ',') { p.i++; continue; }
    if (p.s[p.i] === close) { p.i++; return out; }
    throw new Error('bad list');
  }
}

function readString(p) {
  const s = p.s;
  let raw = false;
  while (/[rRuU]/.test(s[p.i])) { if (/[rR]/.test(s[p.i])) raw = true; p.i++; }
  const q = s[p.i];
  const triple = s.slice(p.i, p.i + 3) === q.repeat(3);
  const end = triple ? q.repeat(3) : q;
  p.i += end.length;
  let out = '';
  for (;;) {
    if (p.i >= s.length) throw new Error('unterminated string');
    if (s.startsWith(end, p.i)) { p.i += end.length; return out; }
    const c = s[p.i];
    if (!triple && (c === '\n' || c === '\r')) throw new Error('newline in string');
    if (c !== '\\') { out += c; p.i++; continue; }
    const d = s[p.i + 1];
    if (raw) { out += c + (d === undefined ? '' : d); p.i += 2; continue; }
    p.i += 2;
    switch (d) {
      case '\\': out += '\\'; break;
      case "'": out += "'"; break;
      case '"': out += '"'; break;
      case 'n': out += '\n'; break;
      case 'r': out += '\r'; break;
      case 't': out += '\t'; break;
      case 'a': out += '\x07'; break;
      case 'b': out += '\b'; break;
      case 'f': out += '\f'; break;
      case 'v': out += '\v'; break;
      case '\n': break;
      case 'x': out += String.fromCharCode(parseHex(s.slice(p.i, p.i + 2), 2)); p.i += 2; break;
      case 'u': out += String.fromCharCode(parseHex(s.slice(p.i, p.i + 4), 4)); p.i += 4; break;
      case 'U': out += String.fromCodePoint(parseHex(s.slice(p.i, p.i + 8), 8)); p.i += 8; break;
      default:
        if (/[0-7]/.test(d)) {
          let o = d;
          while (o.length < 3 && /[0-7]/.test(s[p.i])) o += s[p.i++];
          out += String.fromCharCode(parseInt(o, 8));
        } else {
          out += '\\' + (d === undefined ? '' : d);   // Python keeps unknown escapes as they are
        }
    }
  }
}

function parseHex(t, w) {
  if (t.length !== w || !/^[0-9a-fA-F]+$/.test(t)) throw new Error('bad escape');
  return parseInt(t, 16);
}
