// Python names for the generated script: variables from block labels, SETTINGS constants from
// label + setting key, and the reserved set none of them may take (C5).
//
// A name that collides with Python, a builtin, anything the copied runtime defines or imports,
// a SETTINGS constant or the generator's own names would quietly break main() (a value labelled
// "V" replacing the runtime's V dict, "Out file" shadowing out_file(), "e" unbound by an
// except clause), so every generated name goes through here.
//
// Plain ES module, no DOM.

export const PY_KEYWORDS = ['False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
  'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from',
  'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise',
  'return', 'try', 'while', 'with', 'yield'];
export const PY_SOFT_KEYWORDS = ['match', 'case', 'type', '_'];
export const PY_BUILTINS = ['abs', 'aiter', 'all', 'anext', 'any', 'ascii', 'bin', 'bool',
  'breakpoint', 'bytearray', 'bytes', 'callable', 'chr', 'classmethod', 'compile', 'complex',
  'copyright', 'credits', 'delattr', 'dict', 'dir', 'divmod', 'enumerate', 'eval', 'exec', 'exit',
  'filter', 'float', 'format', 'frozenset', 'getattr', 'globals', 'hasattr', 'hash', 'help', 'hex',
  'id', 'input', 'int', 'isinstance', 'issubclass', 'iter', 'len', 'license', 'list', 'locals',
  'map', 'max', 'memoryview', 'min', 'next', 'object', 'oct', 'open', 'ord', 'pow', 'print',
  'property', 'quit', 'range', 'repr', 'reversed', 'round', 'set', 'setattr', 'slice', 'sorted',
  'staticmethod', 'str', 'sum', 'super', 'tuple', 'vars', 'zip', '__import__', '__name__',
  '__file__', '__doc__', '__builtins__', '__spec__', '__loader__', '__package__',
  'Ellipsis', 'NotImplemented', 'BaseException', 'BaseExceptionGroup', 'Exception',
  'ExceptionGroup', 'ArithmeticError', 'AssertionError', 'AttributeError', 'BlockingIOError',
  'BrokenPipeError', 'BufferError', 'BytesWarning', 'ChildProcessError', 'ConnectionAbortedError',
  'ConnectionError', 'ConnectionRefusedError', 'ConnectionResetError', 'DeprecationWarning',
  'EncodingWarning', 'EOFError', 'EnvironmentError', 'FileExistsError', 'FileNotFoundError',
  'FloatingPointError', 'FutureWarning', 'GeneratorExit', 'ImportError', 'ImportWarning',
  'IndentationError', 'IndexError', 'InterruptedError', 'IOError', 'IsADirectoryError', 'KeyError',
  'KeyboardInterrupt', 'LookupError', 'MemoryError', 'ModuleNotFoundError', 'NameError',
  'NotADirectoryError', 'NotImplementedError', 'OSError', 'OverflowError', 'PendingDeprecationWarning',
  'PermissionError', 'ProcessLookupError', 'RecursionError', 'ReferenceError', 'ResourceWarning',
  'RuntimeError', 'RuntimeWarning', 'StopAsyncIteration', 'StopIteration', 'SyntaxError',
  'SyntaxWarning', 'SystemError', 'SystemExit', 'TabError', 'TimeoutError', 'TypeError',
  'UnboundLocalError', 'UnicodeDecodeError', 'UnicodeEncodeError', 'UnicodeError',
  'UnicodeTranslateError', 'UnicodeWarning', 'UserWarning', 'ValueError', 'Warning',
  'WindowsError', 'ZeroDivisionError'];
// Modules a runtime file or a block may import (also taken from the runtime files themselves).
export const COMMON_MODULES = ['os', 'sys', 'time', 'math', 'csv', 're', 'json', 'traceback',
  'itertools', 'functools', 'collections', 'copy', 'difflib', 'fnmatch', 'glob', 'shutil',
  'subprocess', 'threading', 'signal', 'random', 'statistics', 'string', 'struct', 'io',
  'pathlib', 'tempfile', 'warnings', 'logging', 'typing', 'datetime', 'decimal', 'atexit',
  'platform', 'ctypes', 'winreg', 'powerfactory', 'pf', 'np', 'numpy', 'pd', 'pandas', 'plt',
  'matplotlib', 'scipy', 'openpyxl', 'tqdm', 'optimize'];
// The generator's own names in main() and in the copied structure (6.6), plus the SETTINGS
// globals Start writes (7.1) and GRAPH_STYLE (core/graphstyle.js).
export const CODEGEN_NAMES = ['app', 'main', 'mark', 'trial', 'err', 'e', 'stop', 'fin', 'problem',
  'self', 'cls', 'args', 'kwargs'];
export const SETTINGS_NAMES = ['WORKFLOW_NAME', 'PF_API_PATH', 'PROJECT', 'STUDY_CASE', 'OUTPUT_DIR',
  'RUN_MODE', 'PF_USER', 'SHOW_PF', 'UNDO_CHANGES', 'FAST_MODE', 'CONNECT_TIMEOUT', 'F_NOMINAL',
  'CHECK_ONLY', 'PROBLEMS', 'GRAPH_STYLE'];

// The fixed part of the reserved set; the runtime's own names are added per generate().
export function baseReserved() {
  return new Set([...PY_KEYWORDS, ...PY_SOFT_KEYWORDS, ...PY_BUILTINS, ...COMMON_MODULES,
    ...CODEGEN_NAMES, ...SETTINGS_NAMES]);
}

// ASCII snake_case from any text: accents folded, anything else dropped, never a leading
// underscore or digit, at most `max` characters. '' when nothing usable is left.
export function snake(text, max = 40) {
  let s = String(text === undefined || text === null ? '' : text);
  try { s = s.normalize('NFKD'); } catch (e) { /* keep as is */ }
  s = s.replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss').replace(/[æÆ]/g, 'ae').replace(/[øØ]/g, 'o').replace(/[đĐ]/g, 'd')
    .replace(/[łŁ]/g, 'l').replace(/[þÞ]/g, 'th');
  s = s.replace(/([a-z0-9])([A-Z])/g, '$1_$2')       // camelCase -> camel_case
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (/^[0-9]/.test(s)) s = 'v_' + s;
  if (s.length > max) s = s.slice(0, max).replace(/_+$/, '');
  return s;
}

// UPPER_SNAKE for a SETTINGS constant.
export function upperSnake(text, max = 40) {
  return snake(text, max).toUpperCase();
}

// Is this a usable Python identifier (for names a reader types, such as Python code inputs)?
export function isIdentifier(name) {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(String(name)) && !PY_KEYWORDS.includes(name) && !PY_SOFT_KEYWORDS.includes(name);
}

// The number in a node id ("n12" -> "12"), or the id itself made safe, for name suffixes.
export function idSuffix(id) {
  const m = /^[a-z](\d+)$/.exec(String(id));
  return m ? 'n' + m[1] : (snake(id, 20) || 'x');
}

// Allocate final names for the name requests a generate() run made, deterministically:
// requests are taken in node order (numeric id), then in the order the node asked; a request
// gets its plain base name when that is free, else base_n<k> (k the node number), else
// base_n<k>_2, _3 ... A request marked `own` (the generator's own mark / trial / err / fin) may
// take a name in ownAllowed although a label may not. Returns string[] by request index.
export function allocateNames(requests, reserved, compareIds, ownAllowed = new Set()) {
  const order = requests.map((r, i) => i).sort((a, b) => {
    const c = compareIds(requests[a].nodeId, requests[b].nodeId);
    return c || requests[a].seq - requests[b].seq;
  });
  const taken = new Set();
  const out = new Array(requests.length);
  for (const i of order) {
    const r = requests[i];
    const base = snake(r.hint) || 'value';
    const suffix = idSuffix(r.nodeId);
    const blocked = (n) => taken.has(n) || (reserved.has(n) && !(r.own && ownAllowed.has(n)));
    let name = base;
    if (r.forceSuffix || blocked(name)) name = base + '_' + suffix;
    let k = 2;
    while (blocked(name)) name = base + '_' + suffix + '_' + (k++);
    taken.add(name);
    out[i] = name;
  }
  return out;
}

// SETTINGS constant for a pinned setting: label (without the units in brackets) + key, e.g.
// "Dispatch (MW)" + "from" -> DISPATCH_FROM; unique, never reserved.
export function constantName(label, key, nodeId, taken, reserved) {
  const stem = upperSnake(String(label || '').replace(/\([^)]*\)/g, ' '), 28) || 'VALUE';
  const k = upperSnake(key, 20) || 'VALUE';
  let base = stem.endsWith('_' + k) || stem === k ? stem : stem + '_' + k;
  if (/^[0-9]/.test(base)) base = 'V_' + base;
  let name = base;
  if (reserved.has(name) || taken.has(name)) name = base + '_' + idSuffix(nodeId).toUpperCase();
  let n = 2;
  while (reserved.has(name) || taken.has(name)) name = base + '_' + idSuffix(nodeId).toUpperCase() + '_' + (n++);
  taken.add(name);
  return name;
}
