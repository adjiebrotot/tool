"""Load Builder runtime helpers the way the Builder does, for the tests.

parse() reads the runtime files into sections (# @helper / # @needs / # @imports / # @end at
column 0), resolve() follows @needs transitively and orders the sections by file then position,
build() writes the imports (deduplicated, plain `import x` lines before `from x import y`) followed
by the section code, and load() execs that into a fresh namespace holding the SETTINGS globals.

check() is the static audit of the runtime files: every @needs exists, no top-level name is
defined twice, every name a section uses from another section is in its @needs (so a generated
file never hits a NameError), every public helper has a docstring, directives sit at column 0,
and no em or en dash is used anywhere.
"""
import ast
import builtins
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
RUNTIME = os.path.normpath(os.path.join(HERE, "..", "..", "..", "runtime"))
FILES = ["base.py", "pf_core.py", "pf_model.py", "pf_studies.py", "signals.py", "outputs.py", "optimise.py"]
PF_FILES = ["base.py", "pf_core.py", "pf_model.py", "pf_studies.py"]

_HELPER = re.compile(r"^# @helper (\w+)$")
_NEEDS = re.compile(r"^# @needs (.+)$")
_IMPORTS = re.compile(r"^# @imports (.+)$")
_END = re.compile(r"^# @end$")


def parse(files=PF_FILES):
    """{"order": [names], "sections": {name: {file, needs, imports, code, line}}, "errors": [...]}"""
    lib = {"order": [], "sections": {}, "errors": []}
    for fname in files:
        path = os.path.join(RUNTIME, fname)
        if not os.path.exists(path):
            continue
        cur = None
        with open(path, encoding="utf-8") as fh:
            lines = fh.read().splitlines()
        for i, line in enumerate(lines, 1):
            m = _HELPER.match(line)
            if m:
                if cur is not None:
                    lib["errors"].append(f"{fname}:{i}: @helper {m.group(1)} starts before @end of {cur['name']}")
                cur = {"name": m.group(1), "file": fname, "line": i, "needs": [], "imports": [], "lines": []}
                continue
            if cur is None:
                if re.match(r"^\s*# @(helper|needs|imports|end)\b", line):
                    lib["errors"].append(f"{fname}:{i}: directive outside a section or not at column 0")
                continue
            m = _NEEDS.match(line)
            if m:
                cur["needs"] += [x.strip() for x in m.group(1).split(",") if x.strip()]
                continue
            m = _IMPORTS.match(line)
            if m:
                cur["imports"].append(m.group(1).strip())
                continue
            if _END.match(line):
                cur["code"] = "\n".join(cur.pop("lines")) + "\n"
                if cur["name"] in lib["sections"]:
                    lib["errors"].append(f"{fname}:{cur['line']}: section {cur['name']} defined twice")
                lib["sections"][cur["name"]] = cur
                lib["order"].append(cur["name"])
                cur = None
                continue
            if re.match(r"^\s+# @(helper|needs|imports|end)\b", line):
                lib["errors"].append(f"{fname}:{i}: directive not at column 0")
            cur["lines"].append(line)
        if cur is not None:
            lib["errors"].append(f"{fname}: section {cur['name']} has no @end")
    return lib


def resolve(names, lib):
    """Every section the names need, transitively, in file order then position."""
    want, stack = set(), list(names)
    while stack:
        n = stack.pop()
        if n in want:
            continue
        if n not in lib["sections"]:
            raise KeyError(f"no runtime section called {n!r}")
        want.add(n)
        stack += lib["sections"][n]["needs"]
    return [n for n in lib["order"] if n in want]


def build(names, lib):
    secs = resolve(names, lib)
    imps = []
    for s in secs:
        for line in lib["sections"][s]["imports"]:
            if line not in imps:
                imps.append(line)
    imps = [l for l in imps if l.startswith("import ")] + [l for l in imps if not l.startswith("import ")]
    return "\n".join(imps) + "\n\n" + "\n".join(lib["sections"][s]["code"] for s in secs)


def load(names=None, settings=None, lib=None):
    lib = lib or parse()
    names = names or lib["order"]
    ns = {"__name__": "pfb_runtime"}
    ns.update(settings or {})
    exec(compile(build(names, lib), "<builder runtime>", "exec"), ns)
    return ns


def _defined(tree):
    out = set()
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.ClassDef, ast.AsyncFunctionDef)):
            out.add(node.name)
        elif isinstance(node, ast.Assign):
            for t in node.targets:
                for n in ast.walk(t):
                    if isinstance(n, ast.Name):
                        out.add(n.id)
        elif isinstance(node, (ast.Import, ast.ImportFrom)):
            for a in node.names:
                out.add((a.asname or a.name).split(".")[0])
    return out


def _stored(tree):
    out = set()
    for n in ast.walk(tree):
        if isinstance(n, ast.Name) and isinstance(n.ctx, (ast.Store, ast.Del)):
            out.add(n.id)
        elif isinstance(n, ast.arg):
            out.add(n.arg)
        elif isinstance(n, (ast.FunctionDef, ast.ClassDef, ast.AsyncFunctionDef)):
            out.add(n.name)
        elif isinstance(n, ast.ExceptHandler) and n.name:
            out.add(n.name)
        elif isinstance(n, (ast.Import, ast.ImportFrom)):
            for a in n.names:
                out.add((a.asname or a.name).split(".")[0])
    return out


def check(lib=None, files=PF_FILES):
    """Static audit; returns a list of problems (empty = fine)."""
    lib = lib or parse(files)
    probs = list(lib["errors"])
    owner = {}
    trees = {}
    for name in lib["order"]:
        s = lib["sections"][name]
        imp_names = {re.split(r"\s+", l.replace("from ", "").replace("import ", ""))[0].split(".")[0]
                     for l in s["imports"]}
        for l in s["imports"]:
            m = re.match(r"^import (\S+)(?: as (\w+))?$", l) or re.match(r"^from \S+ import (\w+)(?: as (\w+))?$", l)
            if not m:
                probs.append(f"{s['file']}: section {name}: odd @imports line {l!r}")
            else:
                imp_names.add((m.group(2) or m.group(1)).split(".")[0])
        s["import_names"] = imp_names
        try:
            tree = ast.parse(s["code"])
        except SyntaxError as e:
            probs.append(f"{s['file']}: section {name}: syntax error {e}")
            continue
        trees[name] = tree
        for d in _defined(tree):
            if d in owner and owner[d] != name:
                probs.append(f"{s['file']}: name {d} is defined in sections {owner[d]} and {name}")
            owner.setdefault(d, name)
        for n in s["needs"]:
            if n not in lib["sections"]:
                probs.append(f"{s['file']}: section {name} needs {n}, which does not exist")
        for node in tree.body:
            if isinstance(node, (ast.FunctionDef, ast.ClassDef)) and not node.name.startswith("_"):
                if not ast.get_docstring(node):
                    probs.append(f"{s['file']}: public {node.name} in section {name} has no docstring")
    builtin_names = set(dir(builtins))
    for name, tree in trees.items():
        s = lib["sections"][name]
        try:
            reach = set(resolve([name], lib))
        except KeyError as e:
            probs.append(f"{s['file']}: section {name}: {e}")
            continue
        avail = set()
        for r in reach:
            if r in trees:
                avail |= _defined(trees[r])
            avail |= lib["sections"][r].get("import_names", set())
        local = _stored(tree)
        for n in ast.walk(tree):
            if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Load):
                if n.id in local or n.id in builtin_names or n.id in avail:
                    continue
                if n.id in owner:
                    probs.append(f"{s['file']}: section {name} uses {n.id} (section {owner[n.id]}) without @needs")
                elif n.id not in ("__file__",):
                    probs.append(f"{s['file']}: section {name} uses unknown name {n.id}")
    for fname in files:
        path = os.path.join(RUNTIME, fname)
        if os.path.exists(path):
            text = open(path, encoding="utf-8").read()
            for i, line in enumerate(text.splitlines(), 1):
                if chr(0x2014) in line or chr(0x2013) in line:
                    probs.append(f"{fname}:{i}: em or en dash")
    return sorted(set(probs))


def each_section_alone(lib=None):
    """Build and exec every section on its own (with its needs): catches missing imports and code
    that fails at load time. Returns a list of problems."""
    lib = lib or parse()
    probs = []
    for name in lib["order"]:
        try:
            load([name], {}, lib)
        except Exception as e:
            probs.append(f"section {name} alone: {type(e).__name__}: {e}")
    return probs


if __name__ == "__main__":
    lib = parse(FILES)
    print(f"{len(lib['order'])} sections:", ", ".join(lib["order"]))
    for p in check(lib, FILES) + each_section_alone(lib):
        print("PROBLEM", p)
