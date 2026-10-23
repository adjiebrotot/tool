# Stub runtime for the codegen tests: the PowerFactory and analysis helpers the generated code
# calls, faked so that flow-only workflows run without PowerFactory. Loaded next to the REAL
# base.py (and requested_base.py); same @helper format.
#
# What the fakes print is what the tests assert on:
#   STUB connect / STUB finish / STUB check <query> / STUB mark <n> / STUB undo <n>
#   TABLES_JSON {"<table>": {"columns": [...], "rows": [...]}}   (printed by finish)

# @helper pf_connect
# @needs log
def pf_connect():
    print("STUB connect", flush=True)
    return _StubApp()


class _StubApp:
    def __repr__(self):
        return "StubApp"
# @end

# @helper finish
# @needs log, ctx, table
# @imports import json
def finish(app):
    flush_tables()
    log_summary()
    data = {name: {"columns": t.columns, "rows": t.rows} for name, t in _TABLES.items()}
    print("TABLES_JSON " + json.dumps(data, default=str), flush=True)
    print("STUB finish", flush=True)
# @end

# @helper preflight
def preflight(modules=None):
    print(f"STUB preflight {list(modules or [])}", flush=True)
# @end

# @helper check_elements
def check_elements(app, queries):
    for q in queries:
        if isinstance(q, str):
            print(f"STUB check {q}", flush=True)
        else:
            print(f"STUB check {q[0]} ({q[1]})", flush=True)
# @end

# @helper pf_mark
_MARKS = {"n": 0}


def pf_mark():
    _MARKS["n"] += 1
    print(f"STUB mark {_MARKS['n']}", flush=True)
    return _MARKS["n"]
# @end

# @helper pf_undo
def pf_undo(mark=None):
    print(f"STUB undo {mark}", flush=True)
# @end

# @helper pf_find
class _StubObj:
    def __init__(self, name):
        self.loc_name = name

    def __repr__(self):
        return f"<{self.loc_name}>"


def pf_find(app, query, match="one"):
    name = str(query).rsplit(".", 1)[0]
    if match == "all":
        return [_StubObj(f"{name} {k}") for k in (1, 2, 3)]
    return _StubObj(name)
# @end

# @helper stat
# @needs convert
# @imports import statistics
def stat(kind, values, p=None):
    v = [x for x in as_list(values) if x == x]
    if kind == "count":
        return len(v)
    if not v:
        return None
    if kind == "max":
        return max(v)
    if kind == "min":
        return min(v)
    if kind == "mean":
        return sum(v) / len(v)
    if kind == "median":
        return statistics.median(v)
    if kind == "sum":
        return sum(v)
    if kind == "std":
        return statistics.pstdev(v)
    if kind == "percentile":
        s = sorted(v)
        k = (len(s) - 1) * float(p if p is not None else 95) / 100.0
        lo = int(k)
        hi = min(lo + 1, len(s) - 1)
        return s[lo] + (s[hi] - s[lo]) * (k - lo)
    raise ValueError(kind)
# @end

# @helper fake_search
# @needs log
class _SearchResult:
    def __init__(self):
        self.tries = []
        self.best = None
        self.stopped = False


def fake_search(fn, lo, hi, n):
    """Tries n evenly spaced values from lo to hi; best = the largest value whose try passed."""
    res = _SearchResult()
    n = int(n)
    for k in range(n):
        v = lo + (hi - lo) * k / max(1, n - 1)
        if float(v).is_integer():
            v = int(v)
        t = fn(v)
        res.tries.append((v, t.ok, t.score))
        print(f"STUB try {v} ok={t.ok} score={t.score}", flush=True)
        if t.ok is True and (res.best is None or v > res.best):
            res.best = v
        if t.stop:
            res.stopped = True
            break
    return res
# @end

# @helper fake_rms
def fake_rms(app, monitors):
    print(f"STUB rms {monitors!r}", flush=True)
    return _FakeRun()


class _FakeRun:
    ok = True

    def series(self, obj, var):
        return [1.0, 2.0, 3.0]
# @end

# @helper touch_model
def touch_model(what):
    print(f"STUB write {what}", flush=True)
# @end
