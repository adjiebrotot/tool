# Workflow Builder runtime: the search blocks, Optimise and Find limit (no PowerFactory calls).
#
# Same section format as base.py. Both searches call the generated try function, which runs the
# blocks on the "Each try" route with the values to try and returns a base.py Trial (what those
# blocks reported: a score and / or pass, fail or unknown). The generated try function catches a
# failing try itself (case_failed marks the Trial failed) and puts the model back after each try,
# so every try starts from the same model; these helpers only re-raise StopWorkflow and
# KeyboardInterrupt and catch anything else that slips through, so one bad try never ends the
# search. scipy and scikit-optimize are imported only when a method needs them.
# Private names start with _op_ so they cannot clash once everything is in one script.

# @helper search_common
# @needs log, Trial, StopWorkflow, convert
# @imports import math
class SearchResult:
    """What a search found. Read a field as an attribute (r.limit) or a key (r["limit"]);
    r.keys() lists the fields."""

    def __init__(self, **fields):
        self.__dict__.update(fields)

    def __getitem__(self, key):
        return self.__dict__[key]

    def get(self, key, default=None):
        return self.__dict__.get(key, default)

    def keys(self):
        return list(self.__dict__)

    def as_dict(self):
        return dict(self.__dict__)

    def __repr__(self):
        shown = ", ".join(f"{k}={v!r}" for k, v in self.__dict__.items()
                          if k not in ("history", "best_trial") and not isinstance(v, list))
        return f"{type(self).__name__}({shown})"


class _OpDone(Exception):
    # Raised inside the objective to end a search (try budget used up, or a try asked to stop);
    # caught by the search itself, never seen by the generated code.
    pass


def _op_outcome(r):
    # (score, ok, failed, stop, note) from what a try returned: a Trial, a plain number (a
    # score), True / False (pass / fail) or None (nothing known).
    if r is None:
        return None, None, False, False, ""
    if hasattr(r, "failed") and hasattr(r, "ok") and hasattr(r, "score"):
        score = as_float(r.score)
        if score is not None and not math.isfinite(score):
            score = None
        return score, r.ok, bool(r.failed), bool(getattr(r, "stop", False)), str(getattr(r, "note", "") or "")
    if isinstance(r, bool):
        return None, r, False, False, ""
    f = as_float(r)
    if f is not None and math.isfinite(f):
        return f, True, False, False, ""
    return None, _tri(r), False, False, ""


def _op_call(fn, args, what):
    # One try. A failure that the generated code did not catch counts as a failed try.
    try:
        return fn(*args), ""
    except (StopWorkflow, KeyboardInterrupt):
        raise
    except Exception as exc:
        log(f"{what} failed: {type(exc).__name__}: {exc}", "error")
        return None, f"ERROR: {type(exc).__name__}: {exc}"[:200]


def _op_fmt(v):
    if isinstance(v, float):
        return f"{v:.6g}"
    return as_text(v)
# @end

# @helper optimise
# @needs search_common
# @imports import itertools
# @imports import inspect
# @imports import warnings
class OptResult(SearchResult):
    """The result of optimise(): best (dict of variable name -> value, None when no try was a
    candidate), values (the best values in variable order), best_score, best_trial, found,
    status (DONE, STOPPED or NO CANDIDATE), history (one dict per try: try, values, score, ok,
    failed, candidate, best, note), tries, method (the one used), goal, message."""


def optimise(fn, variables, goal="min", method="de", max_tries=30, seed=1, grid_steps=5,
             label="Optimise"):
    """Search for the values that give the lowest (goal "min") or highest ("max") score.

    fn(*values) runs one try and returns a Trial (score from Report this try). variables: a
    list of {name, lower, upper, integer}; integer variables are tried as whole numbers.
    A try that failed, gave no score or reported a failed check (ok False) is not a candidate:
    the method sees it as a very poor score and it can never be the best. method: "de"
    (differential evolution, default), "nelder" (Nelder-Mead), "powell", "bounded" (one
    variable), "grid" (grid_steps values per variable) or "bayes" (scikit-optimize; falls back to
    "de" when it is not installed). max_tries caps the number of tries (each one is a study
    run); the same values are never tried twice. seed makes the search repeatable. The search
    ends early when a try asks to stop (Stop the loop on the Each try route).

    Returns an OptResult (best, values, best_score, best_trial, found, status, history, tries,
    method, goal, message). Scores are reported as they are, also when maximising."""
    specs = _op_specs(variables)
    want = "max" if str(goal or "min").strip().lower() in ("max", "maximise", "maximize", "highest") else "min"
    sign = -1.0 if want == "max" else 1.0
    budget = max(1, int(as_float(max_tries, 30) or 30))
    m = _op_method(method, specs)
    st = {"tries": 0, "history": [], "best": None, "best_entry": None, "best_trial": None,
          "cache": {}, "stopped": False, "worst": None}
    names = [s["name"] for s in specs]

    def done(status, message):
        e = st["best_entry"]
        best = dict(e["values"]) if e else None
        log(f"{label}: {message}")
        return OptResult(best=best, values=[best[n] for n in names] if best else None,
                         best_score=e["score"] if e else None, best_trial=st["best_trial"],
                         found=e is not None, status=status, history=st["history"],
                         tries=st["tries"], method=m, goal=want, message=message)

    if not specs:
        log(f"{label}: no variables to search over; add at least one variable with a lower and an upper value.", "error")
        return done("NO CANDIDATE", "nothing was tried: no variables")

    def evaluate(x):
        vals = _op_fix(x, specs)
        key = tuple(round(v, 12) if isinstance(v, float) else v for v in vals)
        if key in st["cache"]:
            return st["cache"][key]
        if st["tries"] >= budget:
            raise _OpDone("budget")
        st["tries"] += 1
        k = st["tries"]
        r, err = _op_call(fn, vals, f"{label} try {k}")
        score, ok, failed, stop, note = _op_outcome(r)
        failed = failed or bool(err)
        candidate = (not failed) and score is not None and ok is not False
        internal = sign * score if candidate else None
        improved = False
        if candidate and (st["best"] is None or internal < st["best"]):
            st["best"], improved = internal, True
        if candidate and (st["worst"] is None or internal > st["worst"]):
            st["worst"] = internal
        entry = {"try": k, "values": dict(zip(names, vals)), "score": score, "ok": ok, "failed": failed,
                 "candidate": candidate, "best": None, "note": note or err}
        if improved:
            st["best_entry"], st["best_trial"] = entry, r
        entry["best"] = st["best_entry"]["score"] if st["best_entry"] else None
        st["history"].append(entry)
        shown = ", ".join(f"{n} = {_op_fmt(v)}" for n, v in zip(names, vals))
        if candidate:
            log(f"{label} try {k} of {budget}: {shown} -> score {score:.6g}" + (" (best so far)" if improved else ""))
        else:
            why = "the try failed" if failed else ("no score was reported" if score is None else "a check failed")
            log(f"{label} try {k} of {budget}: {shown} -> not a candidate ({why})")
        value = internal if candidate else _op_penalty(st)
        st["cache"][key] = value
        if stop:
            st["stopped"] = True
            raise _OpDone("stop")
        return value

    try:
        _op_run(m, evaluate, specs, budget, seed, grid_steps, label)
    except _OpDone:
        pass
    except (StopWorkflow, KeyboardInterrupt):
        raise
    except Exception as exc:
        log(f"{label}: the {m} method stopped with {type(exc).__name__}: {exc}", "error")
    e = st["best_entry"]
    if st["stopped"]:
        status = "STOPPED"
    elif e is None:
        status = "NO CANDIDATE"
    else:
        status = "DONE"
    if e is None:
        msg = f"no try gave a usable score in {st['tries']} tries ({_OP_NAMES.get(m, m)})"
    else:
        shown = ", ".join(f"{n} = {_op_fmt(v)}" for n, v in e["values"].items())
        msg = (f"best score {e['score']:.6g} at {shown} (try {e['try']} of {st['tries']}, "
               f"{_OP_NAMES.get(m, m)}" + (", stopped early by a try" if st["stopped"] else "") + ")")
    return done(status, msg)


_OP_NAMES = {"de": "differential evolution", "nelder": "Nelder-Mead", "powell": "Powell",
             "bounded": "bounded one-variable search", "grid": "grid", "bayes": "Bayesian (scikit-optimize)"}


def _op_specs(variables):
    # Clean variable rows: name, lower <= upper, integer flag. Rows without both bounds are
    # left out with an error line.
    out = []
    for k, v in enumerate(as_items(variables)):
        if not isinstance(v, dict):
            continue
        name = str(v.get("name") or v.get("label") or f"Value {k + 1}")
        lo, hi = as_float(v.get("lower", v.get("min"))), as_float(v.get("upper", v.get("max")))
        if lo is None or hi is None:
            log(f"Optimise: variable '{name}' needs a lower and an upper value; it is left out.", "error")
            continue
        if lo > hi:
            lo, hi = hi, lo
        integer = bool(v.get("integer") or v.get("int") or str(v.get("type", "")).lower() in ("int", "integer"))
        if integer:
            lo, hi = math.ceil(lo - 1e-9), math.floor(hi + 1e-9)
            if lo > hi:
                log(f"Optimise: variable '{name}' has no whole number between its bounds; it is left out.", "error")
                continue
        out.append({"name": name, "lower": lo, "upper": hi, "integer": integer})
    return out


def _op_method(method, specs):
    m = str(method or "de").strip().lower().replace("-", "").replace("_", "").replace(" ", "")
    m = {"differentialevolution": "de", "neldermead": "nelder", "nm": "nelder", "simplex": "nelder",
         "scalar": "bounded", "brent": "bounded", "gp": "bayes", "bayesian": "bayes",
         "gpminimize": "bayes", "brute": "grid", "bruteforce": "grid"}.get(m, m)
    if m not in ("de", "nelder", "powell", "bounded", "grid", "bayes"):
        log(f"Optimise: unknown method '{method}', using differential evolution.", "warn")
        m = "de"
    if m == "bounded" and len(specs) != 1:
        log(f"Optimise: the bounded method works on one variable and there are {len(specs)}; using Nelder-Mead.", "warn")
        m = "nelder"
    if m in ("de", "nelder", "powell", "bounded"):
        try:
            import scipy.optimize  # noqa: F401
        except ImportError:
            log("Optimise: scipy is not installed, so a grid search is used instead "
                "(install it with: python -m pip install scipy).", "warn")
            m = "grid"
    if m == "bayes" and _op_skopt() is None:
        log("Optimise: scikit-optimize is not installed, so differential evolution is used instead "
            "(install it with: python -m pip install scikit-optimize).", "warn")
        m = "de"
        try:
            import scipy.optimize  # noqa: F401
        except ImportError:
            m = "grid"
    return m


def _op_skopt():
    try:
        import skopt
        return skopt
    except Exception:
        return None


def _op_fix(x, specs):
    # Values inside the bounds; whole numbers for integer variables (plain int, plain float:
    # never numpy types, which PowerFactory's SetAttribute refuses).
    out = []
    for v, s in zip(x, specs):
        f = float(v)
        if f != f:
            f = (s["lower"] + s["upper"]) / 2.0
        f = min(max(f, s["lower"]), s["upper"])
        out.append(int(round(f)) if s["integer"] else f)
    return out


def _op_penalty(st):
    # What the method sees for a try that is not a candidate: worse than every candidate so
    # far, by a margin in the scores' own scale, so the method moves away from it.
    if st["worst"] is None:
        return 1e9
    spread = abs(st["worst"] - st["best"]) if st["best"] is not None else 0.0
    return st["worst"] + max(1.0, spread, abs(st["worst"]) * 0.1)


def _op_kw_seed(func, seed):
    params = inspect.signature(func).parameters
    if "rng" in params:
        return {"rng": seed}
    return {"seed": seed} if "seed" in params else {}


def _op_run(m, evaluate, specs, budget, seed, grid_steps, label):
    lows = [float(s["lower"]) for s in specs]
    highs = [float(s["upper"]) for s in specs]
    span = [max(h - l, 1e-12) for l, h in zip(lows, highs)]
    x0 = [(l + h) / 2.0 for l, h in zip(lows, highs)]
    seed = int(as_float(seed, 1) or 0)
    if m == "grid":
        _op_grid(evaluate, specs, grid_steps, budget, label)
        return
    if m == "bayes":
        _op_bayes(evaluate, specs, budget, seed)
        return
    import scipy.optimize as so
    if m == "de":
        n = len(specs)
        pop = max(2, min(15, budget // (4 * n)))
        so.differential_evolution(lambda x: evaluate(list(x)), list(zip(lows, highs)), popsize=pop,
                                  maxiter=max(10, budget), polish=False, init="latinhypercube",
                                  updating="immediate", **_op_kw_seed(so.differential_evolution, seed))
        # Converged before the budget: the population collapsed, nothing more to learn.
        return
    if m == "bounded":
        s = specs[0]
        xatol = 0.5 if s["integer"] else max(1e-9, span[0] * 1e-5)
        so.minimize_scalar(lambda v: evaluate([v]), bounds=(lows[0], highs[0]), method="bounded",
                           options={"xatol": xatol, "maxiter": budget})
        return
    if m == "nelder":
        # Start from the middle with a simplex a quarter of each range wide (scipy's default 5 %
        # of the start value is tiny when the range starts at 0).
        simplex = [list(x0)]
        for i in range(len(specs)):
            p = list(x0)
            p[i] = min(highs[i], p[i] + 0.25 * span[i])
            simplex.append(p)
        so.minimize(lambda x: evaluate(list(x)), x0, method="Nelder-Mead",
                    options={"initial_simplex": simplex, "maxfev": 100000, "maxiter": 100000,
                             "xatol": 1e-6 * max(span), "fatol": 1e-9})
        return
    if m == "powell":
        opts = {"maxfev": 100000, "xtol": 1e-6, "ftol": 1e-9}
        try:
            so.minimize(lambda x: evaluate(list(x)), x0, method="Powell", bounds=list(zip(lows, highs)),
                        options=opts)
        except (TypeError, ValueError):
            so.minimize(lambda x: evaluate(list(x)), x0, method="Powell", options=opts)
        return


def _op_grid(evaluate, specs, steps, budget, label):
    n = len(specs)
    k = max(2, int(as_float(steps, 5) or 5))
    if k ** n > budget:
        fit = max(2, int(math.floor(budget ** (1.0 / n) + 1e-9)))
        log(f"{label}: a grid of {k} values per variable needs {k ** n} tries but max tries is {budget}; "
            f"using {fit} values per variable.", "warn")
        k = fit
    axes = []
    for s in specs:
        vals = [s["lower"] + (s["upper"] - s["lower"]) * i / (k - 1) for i in range(k)]
        if s["integer"]:
            vals = sorted({int(round(v)) for v in vals})
        axes.append(vals)
    total = 1
    for a in axes:
        total *= len(a)
    if total > budget:
        log(f"{label}: the grid has {total} points; only the first {budget} are tried.", "warn")
    for point in itertools.product(*axes):
        evaluate(list(point))


def _op_bayes(evaluate, specs, budget, seed):
    skopt = _op_skopt()
    from skopt.space import Integer, Real
    dims = [Integer(int(s["lower"]), int(s["upper"])) if s["integer"] else Real(float(s["lower"]), float(s["upper"]))
            for s in specs]
    opt = skopt.Optimizer(dims, random_state=seed, n_initial_points=min(10, max(3, budget // 3)))
    asked = 0
    with warnings.catch_warnings():
        # scikit-optimize warns when it proposes a point it has seen; the cache answers those
        # without a new try, so the warning says nothing useful here.
        warnings.simplefilter("ignore")
        while asked < budget * 20:
            asked += 1
            x = opt.ask()
            y = evaluate(list(x))
            opt.tell(x, float(y))
# @end

# @helper find_limit
# @needs search_common
class LimitResult(SearchResult):
    """The result of find_limit(): limit (the last passing value: the passing end of the final
    bracket; None when nothing passed), found (True only for DONE), passing and failing (the
    final bracket), status (DONE, ALL PASS, ALL FAIL, INCONSISTENT, MAX STEPS, STOPPED or
    UNKNOWN), history (one dict per step: step, value, result pass / fail / unknown, counted,
    ok, score, passing, failing, note), steps, tol, passes, label, message."""


def find_limit(fn, lower, upper, tol, max_steps=20, passes="low", bracket="given",
               on_unknown="stop", label="Value", integer=False):
    """Find the value where a study goes from passing to failing, by bisection.

    fn(value) runs one try and returns a Trial; it passes when its ok is True, fails when ok is
    False and is unknown otherwise (no report, an UNDEFINED check, or a failed try). passes
    "low": low values pass and high values fail (the largest dispatch that still passes);
    "high": the other way round (the smallest headroom that still passes). bracket "given":
    try both bounds first, then halve the bracket until it is narrower than tol. bracket
    "halve": try the passing bound first, then halve the distance towards the failing bound
    until a value fails (for a bound that may not be reachable), then bisect. on_unknown "stop"
    (default) ends the search with status UNKNOWN; "fail" or "pass" counts an unknown try as
    that. max_steps caps the tries, both bounds included. integer: whole values only.

    Returns a LimitResult (limit, found, passing, failing, status, history, steps, message).
    The limit is always a value that was tried and passed."""
    lo, hi = as_float(lower), as_float(upper)
    st = {"steps": 0, "history": [], "passing": None, "failing": None}
    plow = str(passes or "low").strip().lower() in ("low", "lower", "below", "min", "smaller", "small", "less")
    unk = str(on_unknown or "stop").strip().lower()
    unk = unk if unk in ("stop", "fail", "pass") else "stop"
    whole = bool(integer)

    def result(status, message):
        found = status == "DONE"
        lim = st["passing"]
        log(f"{label}: {status}: {message}", "info" if status in ("DONE", "ALL PASS") else "warn")
        return LimitResult(limit=lim, found=found, passing=st["passing"], failing=st["failing"],
                           status=status, history=st["history"], steps=st["steps"], tol=tolv,
                           passes="low" if plow else "high", label=label, message=message)

    tolv = abs(as_float(tol, 0.0) or 0.0)
    if lo is None or hi is None:
        return result("UNKNOWN", "Find limit needs a lower and an upper value; nothing was tried")
    if lo > hi:
        log(f"{label}: lower {lo:g} is above upper {hi:g}; swapping them.", "warn")
        lo, hi = hi, lo
    if whole:
        lo, hi = float(math.ceil(lo - 1e-9)), float(math.floor(hi + 1e-9))
        tolv = max(tolv, 1.0)
    if tolv <= 0:
        tolv = (hi - lo) * 1e-3 or 1e-9
        log(f"{label}: no tolerance given; using {tolv:.6g} (a thousandth of the range).", "warn")
    steps_cap = max(2, int(as_float(max_steps, 20) or 20))
    p_end, f_end = (lo, hi) if plow else (hi, lo)
    digits = max(0, int(-math.floor(math.log10(tolv))) + 3) if tolv > 0 else 9

    def keep(v, res):
        # The bracket: the passing value nearest the failing side, the failing value nearest
        # the passing side.
        if res == "pass":
            if st["passing"] is None or (v > st["passing"] if plow else v < st["passing"]):
                st["passing"] = v
        elif res == "fail":
            if st["failing"] is None or (v < st["failing"] if plow else v > st["failing"]):
                st["failing"] = v

    def run(v):
        v = int(round(v)) if whole else float(v)
        st["steps"] += 1
        k = st["steps"]
        r, err = _op_call(fn, [v], f"{label} step {k}")
        score, ok, failed, stop, note = _op_outcome(r)
        res = "unknown" if (failed or err or ok is None) else ("pass" if ok else "fail")
        counted = res if res != "unknown" or unk == "stop" else unk
        keep(v, counted)
        st["history"].append({"step": k, "value": v, "result": res, "counted": counted, "ok": ok,
                              "score": score, "passing": st["passing"], "failing": st["failing"],
                              "note": note or err})
        extra = f" (counted as {counted.upper()})" if counted != res else ""
        log(f"{label} step {k}: {_op_fmt(v)} -> {res.upper()}{extra}; bracket: {_op_bracket(st)}")
        if stop:
            raise _OpDone("stop")
        return counted

    def mid(a, b):
        m = (a + b) / 2.0
        if whole:
            m = float(math.floor(m) if plow == (a < b) else math.ceil(m))
        else:
            m = round(m, digits)
        return m

    try:
        first = run(p_end)
        if first == "unknown":
            return result("UNKNOWN", f"the try at {_op_fmt(p_end)} could not say pass or fail, so the search stopped")
        if bracket != "halve":
            second = run(f_end)
            if second == "unknown":
                return result("UNKNOWN", f"the try at {_op_fmt(f_end)} could not say pass or fail, so the search stopped")
            if first == "pass" and second == "pass":
                return result("ALL PASS", f"both {_op_fmt(lo)} and {_op_fmt(hi)} pass: the limit lies beyond "
                              f"{_op_fmt(f_end)}; widen the range")
            if first == "fail" and second == "fail":
                return result("ALL FAIL", f"both {_op_fmt(lo)} and {_op_fmt(hi)} fail: the limit lies beyond "
                              f"{_op_fmt(p_end)}; widen the range")
            if first == "fail" and second == "pass":
                return result("INCONSISTENT", f"{_op_fmt(p_end)} fails but {_op_fmt(f_end)} passes, the opposite "
                              f"of 'which side passes' ({'low' if plow else 'high'}); check that setting")
        elif first == "fail":
            return result("ALL FAIL", f"the passing bound {_op_fmt(p_end)} already fails: the limit lies "
                          f"beyond it; widen the range")
        while True:
            target = st["failing"] if st["failing"] is not None else f_end
            gap = abs(target - st["passing"])
            if st["failing"] is not None and gap <= tolv + 1e-12:
                return result("DONE", f"limit {_op_fmt(st['passing'])} (passes; {_op_fmt(st['failing'])} fails), "
                              f"found in {st['steps']} steps to within {_op_fmt(tolv)}")
            if st["failing"] is None and gap <= tolv + 1e-12:
                return result("ALL PASS", f"every value tried passes, down to {_op_fmt(st['passing'])} within "
                              f"{_op_fmt(tolv)} of {_op_fmt(f_end)}; the limit lies beyond the range")
            if st["steps"] >= steps_cap:
                return result("MAX STEPS", f"{st['steps']} steps run, the most allowed; the limit is between "
                              f"{_op_bracket(st)}")
            v = mid(st["passing"], target)
            if v == st["passing"] or v == target:
                if st["failing"] is not None:
                    return result("DONE", f"limit {_op_fmt(st['passing'])} (passes; {_op_fmt(st['failing'])} fails)")
                return result("ALL PASS", f"every value tried passes, down to {_op_fmt(st['passing'])}")
            res = run(v)
            if res == "unknown":
                return result("UNKNOWN", f"the try at {_op_fmt(v)} could not say pass or fail, so the search "
                              f"stopped; the limit is between {_op_bracket(st)}")
            if st["failing"] is not None and st["passing"] is not None and \
                    (st["passing"] >= st["failing"] if plow else st["passing"] <= st["failing"]):
                return result("INCONSISTENT", f"a value passed beyond one that failed ({_op_bracket(st)}): "
                              f"the study is not monotonic here")
    except _OpDone:
        return result("STOPPED", f"a try asked the search to stop after {st['steps']} steps; "
                      f"the limit is between {_op_bracket(st)}")


def _op_bracket(st):
    p, f = st["passing"], st["failing"]
    if p is None and f is None:
        return "nothing passed or failed yet"
    if f is None:
        return f"{_op_fmt(p)} passes, no failing value yet"
    if p is None:
        return f"{_op_fmt(f)} fails, no passing value yet"
    return f"{_op_fmt(p)} passes .. {_op_fmt(f)} fails"
# @end
