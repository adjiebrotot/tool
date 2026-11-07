# Helpers the generic blocks (flow, values) need that base.py does not have yet.
#
# REQUESTED FOR builder/runtime/base.py: paste these sections into base.py unchanged (after the
# "convert" section). Until then the codegen tests load this file next to the real base.py, and
# the test harness skips any section base.py already defines.
#
# Every helper here is None-safe: an empty input gives an empty result, never an exception, so
# a missing value shows up as an empty cell instead of a failed pass.

# @helper num_range
# @needs convert
def num_range(start, stop, step=1):
    """The numbers from start to stop (both included) in steps; rounded to the step's decimals so
    0.1 steps give 0.3, not 0.30000000000000004. Whole numbers stay int."""
    a, b, s = as_float(start), as_float(stop), as_float(step)
    if a is None or b is None:
        return []
    if not s:
        return [a] if a == b else []
    if (b - a) * s < 0:
        return []
    text = repr(float(s))
    decimals = 0
    if "e-" in text:
        decimals = int(text.split("e-")[1]) + len(text.split("e-")[0].split(".")[-1]) if "." in text else int(text.split("e-")[1])
    elif "." in text:
        decimals = len(text.split(".")[1].rstrip("0"))
    for v in (start, step):
        f = as_float(v)
        if f is not None and "." in repr(f):
            decimals = max(decimals, len(repr(f).split(".")[1].rstrip("0")))
    n = int(math.floor((b - a) / s + 1e-9))
    whole = all(isinstance(v, int) and not isinstance(v, bool) for v in (start, stop, step))
    out = []
    for k in range(n + 1):
        v = a + k * s
        out.append(int(round(v)) if whole else round(v, min(decimals, 12)))
    return out
# @end

# @helper compare
# @needs convert
def compare(a, op, b=None, tol=1e-9):
    """True / False, or None when a value is missing. op: "true" (a is true: yes, pass, 1 ...),
    "gt", "ge", "lt", "le", "eq", "ne" (numbers; = and != within tol)."""
    if op == "true":
        if a is None:
            return None
        if isinstance(a, str):
            t = a.strip().upper()
            if t in ("TRUE", "YES", "Y", "PASS", "OK", "ON", "1"):
                return True
            if t in ("FALSE", "NO", "N", "FAIL", "OFF", "0"):
                return False
            return None
        if isinstance(a, float) and a != a:
            return None
        return bool(a)
    x, y = as_float(a), as_float(b)
    if x is None or y is None or x != x or y != y:
        return None
    t = abs(tol or 0.0)
    if op == "gt":
        return x > y
    if op == "ge":
        return x >= y
    if op == "lt":
        return x < y
    if op == "le":
        return x <= y
    if op == "eq":
        return abs(x - y) <= t
    if op == "ne":
        return abs(x - y) > t
    raise ValueError(f"unknown comparison {op!r}")
# @end

# @helper elementwise
# @needs convert
def elementwise(fn, *args):
    """fn applied value by value when any argument is a list (lists of the same length, or lists
    and single numbers); None where a value is missing or the result is not a number."""
    lists = [a for a in args if isinstance(a, (list, tuple)) or (hasattr(a, "y") and hasattr(a, "t"))]

    def one(*xs):
        if any(x is None for x in xs):
            return None
        try:
            return fn(*xs)
        except (ArithmeticError, ValueError, TypeError):
            return None
    if not lists:
        return one(*[as_float(a) for a in args])
    seqs = [as_list(a) if (isinstance(a, (list, tuple)) or hasattr(a, "y")) else None for a in args]
    n = min(len(s) for s in seqs if s is not None)
    out = []
    for k in range(n):
        out.append(one(*[(s[k] if s is not None else as_float(a)) for s, a in zip(seqs, args)]))
    return out
# @end

# @helper arith
# @needs elementwise
def arith(op, a, b):
    """a op b for numbers (or value by value for lists): add, sub, mul, div, pow, min, max, mod."""
    fns = {
        "add": lambda x, y: x + y, "sub": lambda x, y: x - y, "mul": lambda x, y: x * y,
        "div": lambda x, y: x / y, "pow": lambda x, y: x ** y, "min": lambda x, y: min(x, y),
        "max": lambda x, y: max(x, y), "mod": lambda x, y: x % y,
    }
    return elementwise(fns[op], a, b)
# @end

# @helper func1
# @needs elementwise
def func1(fn, x, digits=None):
    """One function of a number (or of each value of a list): abs, round, sqrt, neg, floor,
    ceil, log10, exp."""
    fns = {
        "abs": abs, "round": lambda v: round(v, int(digits or 0)), "sqrt": math.sqrt,
        "neg": lambda v: -v, "floor": math.floor, "ceil": math.ceil, "log10": math.log10, "exp": math.exp,
    }
    return elementwise(fns[fn], x)
# @end

# @helper logic
# @needs convert
def logic(op, a, b=None):
    """and / or / not on yes-no values, with None for unknown: and is False when either is
    False, or is True when either is True; otherwise an unknown makes the answer unknown."""
    def tri(v):
        if v is None:
            return None
        if isinstance(v, str):
            t = v.strip().upper()
            return True if t in ("TRUE", "YES", "PASS", "OK", "1") else False if t in ("FALSE", "NO", "FAIL", "0") else None
        if isinstance(v, float) and v != v:
            return None
        return bool(v)
    x, y = tri(a), tri(b)
    if op == "not":
        return None if x is None else not x
    if op == "and":
        if x is False or y is False:
            return False
        return None if x is None or y is None else True
    if op == "or":
        if x is True or y is True:
            return True
        return None if x is None or y is None else False
    raise ValueError(f"unknown logic {op!r}")
# @end

# @helper apply_formula
# @needs elementwise, log
def apply_formula(fn, args, each=False, label="Formula"):
    """A formula block's lambda applied to its inputs: None when an input is missing or the
    maths fails (with a warning), value by value for lists when each is True."""
    if each:
        return elementwise(fn, *args)
    if any(a is None for a in args):
        return None
    try:
        vals = [as_float(a, a) for a in args]
        return fn(*vals)
    except (ArithmeticError, ValueError, TypeError) as exc:
        log(f"{label}: could not work it out ({exc}); the result is empty.", "warn")
        return None
# @end

# @helper text_format
# @needs convert
# @imports import string
def text_format(template, values):
    """The template with each {name} replaced by its value: numbers to 6 significant digits,
    elements by name, {name:.2f} with that format; an empty value gives an empty piece."""
    try:
        parts = list(string.Formatter().parse(str(template)))
    except ValueError:
        return str(template)
    out = []
    for text, field, spec, conv in parts:
        out.append(text)
        if field is None:
            continue
        v = values.get(field)
        if spec and v is not None:
            try:
                f = as_float(v) if not isinstance(v, str) else v
                out.append(format(f if f is not None else v, spec))
                continue
            except (ValueError, TypeError):
                pass
        out.append(as_text(v))
    return "".join(out)
# @end
