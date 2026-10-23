// Reads the Builder's Python runtime files (builder/runtime/*.py) and picks the sections a
// workflow needs (DESIGN section 7).
//
// Directive lines, only at column 0:
//   # @helper <name>        starts a section (what blocks and the generator ask for)
//   # @needs <a>, <b>       sections this one calls (copied in before it)
//   # @imports <line>       one import per line (deduplicated across sections)
//   # @end                  ends the section
// A section may define several names; it is requested by its section name. Besides the
// sections, the loader lists every top-level name each file defines (def, class, assignment)
// or imports, because none of them may be taken by a generated variable (C5).
//
// Plain ES module, no DOM.

// Copy order: helpers come out in this file order, then by position in the file.
export const RUNTIME_FILES = ['base.py', 'pf_core.py', 'pf_model.py', 'pf_studies.py', 'signals.py', 'outputs.py', 'optimise.py'];

const HELPER_RE = /^# @helper (\w+)\s*$/;
const NEEDS_RE = /^# @needs (.+)$/;
const IMPORTS_RE = /^# @imports (.+)$/;
const END_RE = /^# @end\s*$/;

// files: { 'base.py': text, ... } (files that do not exist yet are simply left out; names not
// in RUNTIME_FILES are read after the known ones, in name order, so tests can add a stub file).
// Returns { sections: Map(name -> {name, file, index, code, needs, imports}), order: [names],
//           names: Set, namesByFile: {file: [names]}, problems: [{level, msg}] }.
export function parseRuntime(files) {
  const lib = { sections: new Map(), order: [], names: new Set(), namesByFile: {}, problems: [] };
  const src = files && typeof files === 'object' ? files : {};
  const known = RUNTIME_FILES.filter(f => typeof src[f] === 'string');
  const extra = Object.keys(src).filter(f => !RUNTIME_FILES.includes(f) && typeof src[f] === 'string').sort();
  let index = 0;
  for (const file of [...known, ...extra]) {
    const lines = src[file].replace(/\r\n?/g, '\n').split('\n');
    const fileNames = topLevelNames(lines);
    lib.namesByFile[file] = [...fileNames];
    for (const n of fileNames) lib.names.add(n);
    let cur = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let m;
      if ((m = HELPER_RE.exec(line))) {
        if (cur) lib.problems.push({ level: 'warning', msg: `Runtime ${file}: section "${cur.name}" has no "# @end" before "${m[1]}" (line ${i + 1}).` });
        cur = { name: m[1], file, index: index++, code: [], needs: [], imports: [], line: i + 1 };
        continue;
      }
      if (!cur) continue;
      if (END_RE.test(line)) {
        if (lib.sections.has(cur.name)) {
          const first = lib.sections.get(cur.name);
          lib.problems.push({ level: 'warning', msg: `Runtime: the section "${cur.name}" is defined twice (${first.file} and ${file}); the first one is used.` });
        } else {
          cur.code = trimBlank(cur.code);
          lib.sections.set(cur.name, cur);
          lib.order.push(cur.name);
        }
        cur = null;
        continue;
      }
      if ((m = NEEDS_RE.exec(line))) { cur.needs.push(...m[1].split(',').map(s => s.trim()).filter(Boolean)); continue; }
      if ((m = IMPORTS_RE.exec(line))) { cur.imports.push(m[1].trim()); continue; }
      cur.code.push(line);
    }
    if (cur) lib.problems.push({ level: 'warning', msg: `Runtime ${file}: section "${cur.name}" has no "# @end".` });
  }
  for (const s of lib.sections.values()) {
    for (const n of s.needs) {
      if (!lib.sections.has(n)) lib.problems.push({ level: 'warning', msg: `Runtime: section "${s.name}" needs "${n}", which no runtime file defines.` });
    }
    for (const imp of s.imports) for (const n of importNames(imp)) lib.names.add(n);
  }
  return lib;
}

function trimBlank(lines) {
  let a = 0, b = lines.length;
  while (a < b && !lines[a].trim()) a++;
  while (b > a && !lines[b - 1].trim()) b--;
  return lines.slice(a, b);
}

// Names bound by one import line: "import a.b as c" -> c; "import a.b" -> a; "from x import
// y as z, w" -> z, w.
export function importNames(line) {
  const out = [];
  const s = String(line).replace(/#.*$/, '').trim();
  let m;
  if ((m = /^import\s+(.+)$/.exec(s))) {
    for (const part of m[1].split(',')) {
      const p = part.trim();
      const a = /^([\w.]+)(?:\s+as\s+(\w+))?$/.exec(p);
      if (a) out.push(a[2] || a[1].split('.')[0]);
    }
  } else if ((m = /^from\s+[\w.]+\s+import\s+\(?(.+?)\)?$/.exec(s))) {
    for (const part of m[1].split(',')) {
      const a = /^(\w+)(?:\s+as\s+(\w+))?$/.exec(part.trim());
      if (a && a[1] !== '*') out.push(a[2] || a[1]);
    }
  }
  return out;
}

// Top-level names a file defines or imports: def/class/assignments at column 0, and import lines
// at any indent (a function-local import still binds a name a reader would recognise).
function topLevelNames(lines) {
  const names = new Set();
  let inString = null;
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    // Skip the inside of top-level triple-quoted strings (docstrings).
    if (inString) { if (line.includes(inString)) inString = null; continue; }
    const tq = /^\s*[rRbBuU]?("""|''')/.exec(line);
    if (tq && (line.split(tq[1]).length - 1) % 2 === 1) { inString = tq[1]; continue; }
    let m;
    if ((m = /^(?:async\s+)?def\s+([A-Za-z_]\w*)/.exec(line))) { names.add(m[1]); continue; }
    if ((m = /^class\s+([A-Za-z_]\w*)/.exec(line))) { names.add(m[1]); continue; }
    if (/^\s*(import|from)\s/.test(line)) { for (const n of importNames(line.trim())) names.add(n); continue; }
    if ((m = /^([A-Za-z_][\w, ]*?)\s*(?::[^=]+)?=(?!=)/.exec(line))) {
      for (const part of m[1].split(',')) { const p = part.trim(); if (/^[A-Za-z_]\w*$/.test(p)) names.add(p); }
      continue;
    }
    if ((m = /^for\s+([A-Za-z_][\w, ]*?)\s+in\s/.exec(line))) {
      for (const part of m[1].split(',')) { const p = part.trim(); if (/^[A-Za-z_]\w*$/.test(p)) names.add(p); }
    }
  }
  return names;
}

// The sections for these names and everything they need, in copy order (file order, then
// position), with their imports deduplicated ("import x" lines before "from x import y" lines,
// each group sorted). Returns { sections: [section], names: [section names], imports: [lines],
// missing: [names asked for that no file defines] }.
export function resolveHelpers(names, lib) {
  const want = new Set();
  const missing = [];
  const stack = [...new Set((names || []).filter(Boolean))];
  while (stack.length) {
    const n = stack.pop();
    if (want.has(n)) continue;
    const s = lib && lib.sections.get(n);
    if (!s) { if (!missing.includes(n)) missing.push(n); continue; }
    want.add(n);
    for (const d of s.needs) if (!want.has(d)) stack.push(d);
  }
  const sections = [...want].map(n => lib.sections.get(n)).sort((a, b) => a.index - b.index);
  const plain = new Set(), from = new Set();
  for (const s of sections) for (const imp of s.imports) (/^from\s/.test(imp) ? from : plain).add(imp);
  return {
    sections,
    names: sections.map(s => s.name),
    imports: [...[...plain].sort(), ...[...from].sort()],
    missing: missing.sort(),
  };
}
