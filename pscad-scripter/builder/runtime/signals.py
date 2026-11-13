# Workflow Builder runtime: statistics and signal checks (no PSCAD calls).
#
# Same section format as base.py: the Builder copies only the sections a workflow asks for,
# so every section lists what it calls in @needs and the imports it uses in @imports.
# Everything here works on base.py's Series (t in seconds, y values, label, unit, events) or
# on plain numbers and lists, never raises on missing data (it says NO DATA instead) and
# keeps the user's own algorithms from the ESS frequency study (ess_pf.py) where one exists:
# despike, nadir / collapse, the UFLS flag and RoCoF. Private names start with _sg_ so they
# cannot clash with the other runtime files once everything is copied into one script.

# @helper stat
# @needs convert, log
# @imports import math
def stat(kind, values, p=None):
    """One statistic of some numbers: kind is max, min, mean, median, sum, count, std or
    percentile (p from 0 to 100, default 50).

    values may be a number, a list (nested lists are flattened), a time series (its values) or
    several of these. NaN values and anything that is not a number are left out. Returns None
    when no number is left (count returns 0). std is the sample standard deviation (n - 1) and
    needs two values. For a time series every sample counts the same (not weighted by time)."""
    k = str(kind or "").strip().lower()
    k = {"average": "mean", "avg": "mean", "maximum": "max", "minimum": "min", "total": "sum",
         "n": "count", "stdev": "std", "standard deviation": "std", "pct": "percentile",
         "p": "percentile"}.get(k, k)
    xs = [v for v in _stat_numbers(values) if v == v]
    if k == "count":
        return len(xs)
    if not xs:
        return None
    n = len(xs)
    if k == "max":
        r = max(xs)
    elif k == "min":
        r = min(xs)
    elif k == "sum":
        r = math.fsum(xs)
    elif k == "mean":
        r = math.fsum(xs) / n
    elif k == "median":
        r = _stat_percentile(sorted(xs), 50.0)
    elif k == "std":
        if n < 2:
            return None
        m = math.fsum(xs) / n
        r = math.sqrt(math.fsum((v - m) ** 2 for v in xs) / (n - 1))
    elif k == "percentile":
        q = as_float(p, 50.0)
        if q != q:
            q = 50.0
        r = _stat_percentile(sorted(xs), min(100.0, max(0.0, q)))
    else:
        log(f"Unknown statistic '{kind}': use max, min, mean, median, sum, count, std or percentile.", "warn")
        return None
    return None if r != r else r


def _stat_percentile(xs, q):
    # Linear interpolation between the two nearest ranks (numpy's default), so the 50th
    # percentile is the median and the 0th and 100th are the min and max.
    if len(xs) == 1:
        return xs[0]
    pos = q / 100.0 * (len(xs) - 1)
    lo = int(math.floor(pos))
    hi = min(lo + 1, len(xs) - 1)
    return xs[lo] + (xs[hi] - xs[lo]) * (pos - lo)


def _stat_numbers(values):
    if values is None:
        return []
    if hasattr(values, "t") and hasattr(values, "y"):
        return as_list(values)
    if isinstance(getattr(values, "values", None), (list, tuple)):
        # A reading of one attribute on several elements (px_get_all): its values.
        return _stat_numbers(list(values.values))
    if isinstance(values, (list, tuple)):
        out = []
        for v in values:
            if isinstance(v, (list, tuple)) or (hasattr(v, "t") and hasattr(v, "y")):
                out.extend(_stat_numbers(v))
            else:
                f = as_float(v)
                if f is not None:
                    out.append(f)
        return out
    return as_list(values)
# @end

# @helper sig_common
# @needs convert, log
# @imports import math
# @imports import bisect
class SigResult:
    """What a check worked out. Read a field as an attribute (r.value) or a key (r["value"]);
    r.keys() lists the fields. Fields that could not be worked out are None."""

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
                          if k not in ("series", "spikes", "original") and not isinstance(v, (list, dict)))
        return f"SigResult({shown})"


_SG_SAID = set()


def _sg_say(msg, level="info"):
    # Log a note once per run: unit and nominal-frequency notes would otherwise repeat on
    # every pass of a loop.
    if msg not in _SG_SAID:
        _SG_SAID.add(msg)
        log(msg, level)


def _sg_points(series):
    """(times, values) of the samples of a Series whose time and value are real numbers."""
    if series is None:
        return [], []
    t = getattr(series, "t", None)
    y = getattr(series, "y", None)
    if t is None or y is None:
        return [], []
    ts, ys = [], []
    for a, b in zip(t, y):
        try:
            a, b = float(a), float(b)
        except (TypeError, ValueError):
            continue
        if math.isfinite(a) and math.isfinite(b):
            ts.append(a)
            ys.append(b)
    return ts, ys


def _sg_name(series):
    label = getattr(series, "label", "") if series is not None else ""
    return f"'{label}'" if label else "the series"


def _sg_interp(ts, ys, t):
    """The value at time t by linear interpolation; at a time that has two samples (an event
    instant) the first one, the value as it arrives; None outside the record."""
    n = len(ts)
    if n == 0 or t is None:
        return None
    i = bisect.bisect_left(ts, t)
    if i < n and ts[i] == t:
        return ys[i]
    if i == 0:
        return ys[0] if ts[0] - t <= 1e-9 else None
    if i == n:
        return ys[-1] if t - ts[-1] <= 1e-9 else None
    span = ts[i] - ts[i - 1]
    if span <= 0:
        return ys[i]
    return ys[i - 1] + (t - ts[i - 1]) / span * (ys[i] - ys[i - 1])


def _sg_t_event(series, t_event, ts):
    """The event time: the one given, else the series' first workflow event, else its first sample."""
    te = as_float(t_event)
    if te is not None and te == te:
        return te
    fe = getattr(series, "first_event", None)
    if callable(fe):
        te = as_float(fe(None))
        if te is not None:
            return te
    return ts[0] if ts else None


def _sg_cross(ts, ys, level, above, t0=None, hold=0.0):
    """First time at or after t0 that the signal reaches the level (>= when above, <= when
    below) and stays there for hold seconds; the crossing is interpolated between samples.
    Returns (time, reason): time None when there is none, with the reason in words."""
    if not ts:
        return None, "no samples"
    if t0 is None:
        t0 = ts[0]
    hold = max(0.0, as_float(hold, 0.0) or 0.0)
    ok = (lambda v: v >= level) if above else (lambda v: v <= level)
    start = bisect.bisect_left(ts, t0)
    pts = []
    if start > 0 and start < len(ts) and ts[start] > t0:
        v0 = _sg_interp(ts, ys, t0)
        if v0 is not None:
            pts.append((t0, v0))
    pts.extend(zip(ts[start:], ys[start:]))
    if not pts:
        return None, f"the record ends before {t0:g} s"
    i, n = 0, len(pts)
    while i < n:
        t, v = pts[i]
        if not ok(v):
            i += 1
            continue
        if i == 0:
            tc = t
        else:
            tp, vp = pts[i - 1]
            tc = tp + (level - vp) / (v - vp) * (t - tp) if v != vp else t
        if hold <= 0:
            return tc, ""
        j = i
        while j + 1 < n and pts[j + 1][0] <= tc + hold and ok(pts[j + 1][1]):
            j += 1
        if j + 1 < n and not ok(pts[j + 1][1]):
            # It goes back between samples j and j + 1: if that is before the hold time is
            # up, this crossing does not count and the search goes on from there.
            (ta, va), (tb, vb) = pts[j], pts[j + 1]
            t_back = ta + (level - va) / (vb - va) * (tb - ta) if vb != va else tb
            if t_back < tc + hold:
                i = j + 1
                continue
        if pts[-1][0] < tc + hold - 1e-9:
            return None, f"it reaches the level at {tc:.4g} s but the run ends before it has held for {hold:g} s"
        return tc, ""
    return None, "it never reaches the level"


def _sg_unit_kind(series, ys):
    u = str(getattr(series, "unit", "") or "").strip().lower().replace(" ", "")
    if u == "hz":
        return "hz"
    if u in _SG_PU:
        return "pu"
    if u == "":
        if ys:
            mid = sorted(ys)[len(ys) // 2]
            if 0.5 <= mid <= 1.5:
                _sg_say(f"{_sg_name(series)} has no unit and its values are near 1, so they are taken as p.u. of the nominal frequency.")
                return "pu"
        return "hz"
    return "other"


_SG_PU = ("p.u.", "pu", "p.u", "pu.", "perunit")
_SG_FREQ_WORDS = ("fehz", "m:fe", "freq", "speed", "hz")


def _sg_level_kind(series, ys, signal="auto"):
    # How Remove spikes reads its levels: "hz" (a frequency in Hz), "pu" (a frequency or speed
    # in p.u., compared in Hz) or "own" (the series' own unit). Only a frequency is scaled:
    # a voltage in p.u. must keep its p.u. levels.
    sig = str(signal or "auto").strip().lower()
    u = str(getattr(series, "unit", "") or "").strip().lower().replace(" ", "")
    if sig.startswith("other") or sig == "own":
        return "own"
    label = str(getattr(series, "label", "") or "").lower()
    freq = sig.startswith("freq") or any(w in label for w in _SG_FREQ_WORDS)
    if u == "hz":
        return "hz"
    if u in _SG_PU:
        return "pu" if freq else "own"
    if u == "" and ys:
        mid = sorted(ys)[len(ys) // 2]
        if 40.0 <= mid <= 70.0:
            return "hz"
        if freq and 0.5 <= mid <= 1.5:
            return "pu"
    return "own"


def _sg_nominal(nominal, ys=None):
    """The nominal frequency in Hz: the one given, else F_NOMINAL, else the nearer of 50 and
    60 Hz to the first sample of a Hz trace, else 50 Hz (with a warning)."""
    f = as_float(nominal)
    if f is None or not f > 0:
        f = as_float(globals().get("F_NOMINAL"))
    if f is not None and f > 0:
        return f
    if ys and 40.0 <= ys[0] <= 70.0:
        f = 60.0 if abs(ys[0] - 60.0) < abs(ys[0] - 50.0) else 50.0
        _sg_say(f"Nominal frequency not given: taken as {f:g} Hz from the first sample ({ys[0]:.4g} Hz).")
        return f
    _sg_say("Nominal frequency not given: using 50 Hz. Set the nominal frequency on Start.", "warn")
    return 50.0


def _sg_freq(series, nominal, what):
    """(times, values in Hz, nominal Hz, error text) for the frequency checks. A p.u. series
    is multiplied by the nominal frequency; any unit other than Hz or p.u. is refused."""
    ts, ys = _sg_points(series)
    if not ts:
        return ts, ys, None, "no samples were recorded"
    kind = _sg_unit_kind(series, ys)
    if kind == "other":
        msg = (f"{what} needs a frequency in Hz or p.u., but {_sg_name(series)} is in "
               f"'{getattr(series, 'unit', '')}'.")
        log(msg, "error")
        return [], [], None, msg
    nom = _sg_nominal(nominal, ys if kind == "hz" else None)
    if kind == "pu":
        _sg_say(f"{what}: {_sg_name(series)} is in p.u., multiplied by the nominal {nom:g} Hz.")
        ys = [v * nom for v in ys]
    return ts, ys, nom, ""
# @end

# @helper despike
# @needs sig_common, Series, log
# @imports import bisect
# @imports import math
class Spike:
    """One measurement spike taken out of a trace: first and last removed sample (s), how many
    samples, and the furthest excursion from the running median (signed, Hz for a frequency)."""

    __slots__ = ("t_start", "t_end", "samples", "excursion")

    def __init__(self, t_start, t_end, samples, excursion):
        self.t_start, self.t_end, self.samples, self.excursion = t_start, t_end, samples, excursion

    def __str__(self):
        return "%+.3f at t = %.3f s (%d samples, %.3f-%.3f s)" % (
            self.excursion, self.t_start, self.samples, self.t_start, self.t_end)

    __repr__ = __str__


def _sg_running_median(times, values, window, skip=None):
    # The user's time-based running median (ess_pf.py): the solver step is not uniform (it
    # drops to a fraction of a millisecond around events, where the spikes are), so the window
    # is +-window/2 seconds, kept sorted by insertion and removal as it slides.
    n = len(values)
    half = window / 2.0
    out = [0.0] * n
    ordered = []
    lo = hi = 0
    for i in range(n):
        t = times[i]
        while hi < n and times[hi] <= t + half:
            if not (skip and skip[hi]):
                bisect.insort(ordered, values[hi])
            hi += 1
        while lo < hi and times[lo] < t - half:
            if not (skip and skip[lo]):
                del ordered[bisect.bisect_left(ordered, values[lo])]
            lo += 1
        k = len(ordered)
        if k == 0:
            out[i] = values[i]
        elif k % 2:
            out[i] = ordered[k // 2]
        else:
            out[i] = 0.5 * (ordered[k // 2 - 1] + ordered[k // 2])
    return out


def despike(series, window=0.2, trigger=0.1, max_step=20.0, settle=0.02, nominal=None,
            signal="auto"):
    """Remove measurement spikes from a trace (the ESS study's algorithm).

    A sample is a spike when it is more than `trigger` from the running median of the samples
    within window/2 seconds, or when it is reached by a step steeper than `max_step` per second
    (0 or None turns this test off) and lands more than `settle` from the median. Each spike
    then grows both ways while the samples stay more than `settle` off a median recomputed
    without the spikes (that takes the relaxation tail), and those samples are removed (not
    interpolated).

    signal "frequency": the levels are in Hz (a p.u. frequency or speed is compared in Hz using
    the nominal frequency, and keeps its p.u. values); "other": the levels are in the series'
    own unit; "auto" (default): a frequency when the unit is Hz, or when the series is in p.u.
    and its label names a frequency or a speed (m:fe, fehz, speed), else "other".

    Returns a SigResult: series (the clean Series), spikes (list of Spike), n (number of
    spikes), removed (samples removed), unit (the unit of the levels), note (one line for a
    table or a graph footnote)."""
    unit_word = ["Hz"]

    def result(clean, spikes, removed):
        note = ""
        if spikes:
            word = (" " + unit_word[0]) if unit_word[0] else ""
            shown = "; ".join(str(s).replace(" at t", f"{word} at t", 1).strip() for s in spikes[:5])
            more = f"; and {len(spikes) - 5} more" if len(spikes) > 5 else ""
            note = f"Removed {len(spikes)} spike{'s' if len(spikes) != 1 else ''} ({removed} samples): {shown}{more}"
        return SigResult(series=clean, spikes=spikes, n=len(spikes), removed=removed,
                         unit=unit_word[0], note=note)

    if series is None or not hasattr(series, "t"):
        return result(Series([], []), [], 0)
    times = [float(v) for v in series.t]
    raw = [float(v) for v in series.y]
    n = len(raw)
    label, unit, events = getattr(series, "label", ""), getattr(series, "unit", ""), getattr(series, "events", None)
    if n < 3:
        return result(Series(times, raw, label, unit, events), [], 0)
    finite = [v for v in raw if math.isfinite(v)]
    kind = _sg_level_kind(series, finite, signal)
    scale = 1.0
    if kind == "pu":
        scale = _sg_nominal(nominal)
        _sg_say(f"Remove spikes: {_sg_name(series)} is in p.u., compared in Hz at a nominal {scale:g} Hz.")
    elif kind == "own":
        unit_word[0] = str(unit or "")
    values = [v * scale for v in raw]
    window = float(as_float(window, 0.2) or 0.2)
    trigger = float(as_float(trigger, 0.1))
    settle = float(as_float(settle, 0.02))
    max_step = as_float(max_step)

    # NaN or inf never enter the sorted window (a NaN breaks the bisect bookkeeping) and are
    # never flagged; they stay in place, as in the user's code.
    bad = [not math.isfinite(f) for f in values]
    median = _sg_running_median(times, values, window, skip=bad)
    flagged = [not b and abs(f - m) > trigger for f, m, b in zip(values, median, bad)]
    if max_step:
        for i in range(1, n):
            if flagged[i] or bad[i] or bad[i - 1]:
                continue
            dt = times[i] - times[i - 1]
            if dt <= 1e-9:          # a repeated time stamp has no slope to judge
                continue
            if abs(values[i] - values[i - 1]) / dt > max_step and abs(values[i] - median[i]) > settle:
                flagged[i] = True
    if not any(flagged):
        return result(Series(times, raw, label, unit, events), [], 0)

    median = _sg_running_median(times, values, window, skip=[f or b for f, b in zip(flagged, bad)])
    deviation = [f - m for f, m in zip(values, median)]
    remove = [False] * n
    runs = []
    i = 0
    while i < n:
        if not flagged[i]:
            i += 1
            continue
        lo = i
        while lo > 0 and abs(deviation[lo - 1]) > settle:
            lo -= 1
        hi = i
        while hi + 1 < n and abs(deviation[hi + 1]) > settle:
            hi += 1
        # A flagged sample just after a spike can grow back into it (the user's loop then lists
        # the same artefact twice); the samples removed are the same either way, so a run that
        # overlaps or touches the previous one is reported as one spike.
        if runs and lo <= runs[-1][1] + 1:
            runs[-1][1] = max(runs[-1][1], hi)
        else:
            runs.append([lo, hi])
        i = hi + 1
    spikes = []
    for lo, hi in runs:
        worst = max(range(lo, hi + 1), key=lambda k: abs(deviation[k]) if math.isfinite(deviation[k]) else -1.0)
        spikes.append(Spike(times[lo], times[hi], hi - lo + 1, deviation[worst]))
        for k in range(lo, hi + 1):
            remove[k] = True
    kept_t = [t for t, r in zip(times, remove) if not r]
    kept_y = [v for v, r in zip(raw, remove) if not r]
    removed = sum(remove)
    out = result(Series(kept_t, kept_y, label, unit, events), spikes, removed)
    log(f"Remove spikes on {_sg_name(series)}: {out.note}")
    return out
# @end

# @helper nadir
# @needs sig_common, log
def nadir(series, t_event=None, nominal=None, delay=0.0, window=10.0, min_recovery=0.05,
          tail_guard=1.0, floor_below=5.0, ufls_below=1.0, requires_ufls=True, extend_to=None):
    """Frequency nadir with the ESS study's nadir / collapse classification.

    series: frequency in Hz or p.u. (p.u. is multiplied by `nominal`, in Hz; nominal None uses
    F_NOMINAL). t_event: the event time in s (default: the series' first workflow event, else
    its first sample). The nadir is searched from t_event + delay to t_event + window (window 0
    or None: to the end of the run); a later dip lower by more than min_recovery takes over.
    The collapse floor and the UFLS level are given below nominal: floor_below 5.0 Hz and
    ufls_below 1.0 Hz are 45 / 49 Hz at 50 Hz and 55 / 59 Hz at 60 Hz. None turns off the
    floor, the UFLS level (ufls is then UNDEFINED) or the tail guard. extend_to (s): the time a
    run block extends an undecided run to (Run RMS simulation, "extend to").

    verdict is COLLAPSE when the lowest point is under the floor, or the run ends still at its
    minimum (within tail_guard s of the end: still_falling), or the frequency recovers less
    than min_recovery Hz (unless requires_ufls and it stayed above the UFLS level: then it is a
    shallow NADIR). ufls is TRUE when the minimum is below the UFLS level, UNDEFINED when the run
    was cut off still falling above it (and did not reach extend_to s), else FALSE.

    Returns a SigResult: value and time (the nadir in Hz and s; None unless the verdict is
    NADIR), turned (True for a NADIR that recovered at least min_recovery), verdict (NADIR,
    COLLAPSE or NO DATA), ufls (TRUE, FALSE or UNDEFINED), minimum and min_time (the minimum
    the verdict is based on, also for COLLAPSE), lowest and lowest_time (the lowest sample after
    the event), still_falling, recovery (Hz risen after the minimum), nominal, floor,
    ufls_level, t_event, reason."""
    ts, fs, nom, err = _sg_freq(series, nominal, "Frequency nadir")

    def done(verdict, v=None, at=None, recovery=None, still=False, reason="", lowest=None,
             lowest_at=None, ufls="UNDEFINED", t_ev=None, floor=None, trigger=None, turned=False):
        is_nadir = verdict == "NADIR"
        return SigResult(value=v if is_nadir else None, time=at if is_nadir else None,
                         turned=bool(turned), verdict=verdict, ufls=ufls, minimum=v, min_time=at,
                         lowest=lowest, lowest_time=lowest_at, still_falling=bool(still),
                         recovery=recovery, nominal=nom, floor=floor, ufls_level=trigger,
                         t_event=t_ev, reason=reason)

    if not ts:
        return done("NO DATA", reason=err or "no frequency samples were recorded")
    t_ev = _sg_t_event(series, t_event, ts)
    delay = as_float(delay, 0.0) or 0.0
    window = as_float(window)
    min_rec = as_float(min_recovery, 0.05)
    guard = as_float(tail_guard)
    fb, ub = as_float(floor_below), as_float(ufls_below)
    floor = nom - fb if fb is not None else None
    trigger = nom - ub if ub is not None else None

    start = t_ev + delay
    stop = t_ev + window if window else None
    searched = [(t, f) for t, f in zip(ts, fs) if t >= start] or list(zip(ts, fs))
    deep_at, deep = min(searched, key=lambda tf: tf[1])
    win = [(t, f) for t, f in searched if t <= stop] if stop is not None else searched
    if not win:
        win = searched
    at, value = min(win, key=lambda tf: tf[1])
    # A real excursion below the window trough outranks it; tail noise does not.
    windowed = stop is not None and at != deep_at
    if windowed and deep < value - min_rec:
        at, value, windowed = deep_at, deep, False
    after = [f for t, f in searched if t > at]
    recovery = (max(after) - value) if after else 0.0
    end_time = ts[-1]
    note = ""
    if windowed:
        note = (f" (nadir taken from the first {window:g} s after the event; the lowest sample "
                f"is {deep:.4f} Hz at t = {deep_at:.3f} s)")

    still = False
    if floor is not None and deep < floor:
        verdict, v, vt = "COLLAPSE", deep, deep_at
        reason = f"minimum {deep:.4f} Hz is below the collapse floor of {floor:.2f} Hz"
    elif not windowed and guard is not None and deep_at >= end_time - guard:
        verdict, v, vt, still = "COLLAPSE", deep, deep_at, True
        reason = (f"frequency is still at its minimum {deep:.4f} Hz within {guard:g} s of the end of the "
                  f"run (t = {deep_at:.3f} s of {end_time:.3f} s), so it has not turned around")
    elif recovery < min_rec:
        if requires_ufls and trigger is not None and deep >= trigger:
            verdict, v, vt = "NADIR", value, at
            reason = (f"shallow dip held above the UFLS level: recovers only {recovery:.4f} Hz, "
                      f"but never falls below {trigger:.2f} Hz{note}")
        else:
            verdict, v, vt = "COLLAPSE", value, at
            reason = (f"frequency only recovers {recovery:.4f} Hz above the minimum, less than the "
                      f"{min_rec:.4f} Hz required to count as a turnaround{note}")
    else:
        verdict, v, vt = "NADIR", value, at
        reason = f"nadir {value:.4f} Hz at t = {at:.3f} s, recovers {recovery:.4f} Hz{note}"

    # UFLS flag, the user's rule (ess_dynamic.ufls_flag): FALSE only when the trace has shown it
    # will not reach the trigger; a run cut off still falling above it is UNDEFINED unless it
    # reached the extension horizon.
    if trigger is None:
        ufls = "UNDEFINED"
    elif v < trigger:
        ufls = "TRUE"
    elif verdict == "COLLAPSE" and still:
        ext = as_float(extend_to)
        ufls = "UNDEFINED" if (ext is None or end_time < ext - 1e-6) else "FALSE"
    else:
        ufls = "FALSE"
    turned = verdict == "NADIR" and recovery >= min_rec
    return done(verdict, v, vt, recovery, still, reason, deep, deep_at, ufls, t_ev, floor, trigger, turned)
# @end

# @helper peak
# @needs sig_common
def peak(series, kind="max", after=None, before=None):
    """The largest (kind "max"), smallest ("min") or furthest from zero ("abs", sign kept)
    value of a series, optionally only between the times after and before (s).

    Returns a SigResult: value, time (s, the first time it occurs), kind, n (samples looked at),
    reason. value and time are None when there are no samples."""
    ts, ys = _sg_points(series)
    a, b = as_float(after), as_float(before)
    pts = [(t, y) for t, y in zip(ts, ys) if (a is None or t >= a) and (b is None or t <= b)]
    k = str(kind or "max").strip().lower()
    k = {"maximum": "max", "minimum": "min", "largest": "max", "smallest": "min", "absolute": "abs"}.get(k, k)
    if not pts:
        return SigResult(value=None, time=None, kind=k, n=0, reason="no samples in the time range")
    if k == "min":
        t, y = min(pts, key=lambda p: p[1])
    elif k == "abs":
        t, y = max(pts, key=lambda p: abs(p[1]))
    else:
        k = "max"
        t, y = max(pts, key=lambda p: p[1])
    return SigResult(value=y, time=t, kind=k, n=len(pts), reason="")
# @end

# @helper settling
# @needs sig_common, log
def settling(series, band=10.0, band_mode="pct", hold=1.0, reference="final", target=None,
             t_event=None, guard=1.0):
    """Settling time of a step response, measured from the event.

    The band is absolute (band_mode "abs", in the series' unit) or a percentage of the step
    ("pct": band % of |final - initial|). final is the mean of the last `hold` seconds
    (reference "final") or `target` (reference "given"); initial is the last sample before
    t_event (default: the series' first event, else its first sample). The settling instant
    is the LAST time the signal leaves the band after t_event (interpolated). It has not
    settled when it is still outside the band within the last `guard` seconds of the run, so
    a signal that only just reaches the band at the end, or is still moving, does not count.

    Returns a SigResult: settles (True / False, None with no data), time (settling time in s
    after t_event; None when it does not settle), at (the settling instant in s), initial,
    final, step, band (absolute half-width used), rise_time (10 % to 90 % of the step, s),
    overshoot_pct (beyond final in the step's direction, % of the step), t_event, reason."""
    ts, ys = _sg_points(series)

    def done(settles=None, time=None, at=None, initial=None, final=None, step=None, bandv=None,
             rise=None, over=None, t_ev=None, reason=""):
        return SigResult(settles=settles, time=time, at=at, initial=initial, final=final, step=step,
                         band=bandv, rise_time=rise, overshoot_pct=over, t_event=t_ev, reason=reason)

    if len(ts) < 2:
        return done(reason="no samples were recorded")
    t_ev = _sg_t_event(series, t_event, ts)
    t_end = ts[-1]
    pre = [y for t, y in zip(ts, ys) if t < t_ev]
    initial = pre[-1] if pre else ys[0]
    post = [(t, y) for t, y in zip(ts, ys) if t >= t_ev]
    if not post:
        return done(initial=initial, t_ev=t_ev, reason=f"the run ends before the event at {t_ev:g} s")
    hold = max(0.0, as_float(hold, 1.0) or 0.0)
    ref = str(reference or "final").strip().lower()
    final = None
    if ref in ("given", "target", "value"):
        final = as_float(target)
        if final is None:
            log(f"Settling time on {_sg_name(series)}: no target value given, using the final value.", "warn")
    if final is None:
        tail = [y for t, y in post if t >= t_end - hold] if hold > 0 else []
        final = sum(tail) / len(tail) if tail else post[-1][1]
    step = final - initial
    mode = str(band_mode or "pct").strip().lower()
    pct = mode in ("pct", "%", "percent", "% of step", "% of the step", "step")
    bw = abs(as_float(band, 0.0) or 0.0)
    tiny = abs(step) <= 1e-12 * max(1.0, abs(final))
    if pct:
        if tiny:
            if final == 0:
                return done(initial=initial, final=final, step=step, t_ev=t_ev,
                            reason="there is no step, so a band in % of the step is zero: use an absolute band")
            log(f"Settling time on {_sg_name(series)}: there is no step, so the band is {bw:g} % of the final value.", "warn")
            bw = abs(final) * bw / 100.0
        else:
            bw = abs(step) * bw / 100.0

    rise = over = None
    if not tiny:
        up = step > 0
        t10, _ = _sg_cross(ts, ys, initial + 0.1 * step, up, t_ev)
        t90, _ = _sg_cross(ts, ys, initial + 0.9 * step, up, t_ev)
        if t10 is not None and t90 is not None and t90 >= t10:
            rise = t90 - t10
        ext = max(y for _, y in post) if up else min(y for _, y in post)
        over = max(0.0, (ext - final) / step * 100.0)

    last = None
    for k in range(len(post) - 1, -1, -1):
        if abs(post[k][1] - final) > bw:
            last = k
            break
    if last is None:
        at = t_ev
    elif last == len(post) - 1:
        return done(False, None, None, initial, final, step, bw, rise, over, t_ev,
                    f"still outside the +-{bw:.4g} band at the end of the run")
    else:
        (t0, y0), (t1, y1) = post[last], post[last + 1]
        edge = final + (bw if y0 > final else -bw)
        at = t0 + (edge - y0) / (y1 - y0) * (t1 - t0) if y1 != y0 else t1
        at = min(max(at, t0), t1)
    guard = max(0.0, as_float(guard, 1.0) or 0.0)
    if guard > 0 and at > t_end - guard:
        return done(False, None, at, initial, final, step, bw, rise, over, t_ev,
                    f"still moving: it was outside the +-{bw:.4g} band within the last {guard:g} s of the run")
    return done(True, at - t_ev, at, initial, final, step, bw, rise, over, t_ev,
                f"settles within +-{bw:.4g} of {final:.6g} at {at:.4g} s, {at - t_ev:.4g} s after the event")
# @end

# @helper rocof
# @needs sig_common, nadir, log
def _sg_slice(times, values, t_start, t_end):
    # The trace between two instants with both ends interpolated onto it (ess_pf._slice_trace):
    # the event and the nadir lie between solver steps, so the ends are cut exactly.
    n = len(times)
    ts, fs = [], []
    for i in range(n):
        t = times[i]
        if t < t_start:
            if i + 1 < n and times[i + 1] > t_start:
                span = times[i + 1] - t
                w = (t_start - t) / span if span else 0.0
                ts.append(t_start)
                fs.append(values[i] + w * (values[i + 1] - values[i]))
            continue
        if t > t_end:
            if ts and ts[-1] < t_end:
                prev = times[i - 1]
                span = t - prev
                w = (t_end - prev) / span if span else 0.0
                ts.append(t_end)
                fs.append(values[i - 1] + w * (values[i] - values[i - 1]))
            break
        ts.append(t)
        fs.append(values[i])
    if len(ts) < 2:
        return None, None
    return ts, fs


def _sg_interp_at(ts, fs, hi, t):
    lo = hi - 1
    span = ts[hi] - ts[lo]
    if span <= 0:
        return fs[hi]
    return fs[lo] + (t - ts[lo]) / span * (fs[hi] - fs[lo])


def _sg_max_slope(ts, fs, window):
    # Steepest (f(s + T) - f(s)) / T over the piecewise-linear trace, signed, exact and O(n)
    # (ess_pf.max_rolling_slope): g(s) = f(s + T) - f(s) is piecewise linear with breakpoints
    # where either end crosses a sample, so only windows starting on a sample or ending on a
    # sample need evaluating. Returns (value, s, f(s), s + T, f(s + T)) or None.
    n = len(ts)
    if n < 2 or window <= 0 or ts[-1] - ts[0] < window:
        return None
    best = None
    j = 1
    for i in range(n):
        end = ts[i] + window
        if end > ts[-1]:
            break
        while ts[j] < end:
            j += 1
        f_end = _sg_interp_at(ts, fs, j, end)
        value = (f_end - fs[i]) / window
        if best is None or abs(value) > best[0]:
            best = (abs(value), value, ts[i], fs[i], end, f_end)
    i = 0
    for j in range(n):
        start = ts[j] - window
        if start < ts[0]:
            continue
        while i + 1 < n and ts[i + 1] <= start:
            i += 1
        f_start = _sg_interp_at(ts, fs, i + 1, start)
        value = (fs[j] - f_start) / window
        if best is None or abs(value) > best[0]:
            best = (abs(value), value, start, f_start, ts[j], fs[j])
    return None if best is None else best[1:]


def rocof(series, t_event=None, nadir_time=None, verdict=None, window=0.5, fallback="window",
          search_window=10.0, nominal=None, absolute=False, decimals=4):
    """Rate of change of frequency (Hz/s): the steepest change over a rolling window of
    `window` seconds (0.5 s), searched from the event to the nadir (the ESS study's algorithm).

    t_event: default the series' first workflow event, else its first sample. nadir_time and
    verdict come from Frequency nadir (verdict may be its whole result); with neither, the
    nadir is worked out here with the default settings. When the verdict is not NADIR the
    search ends at t_event + search_window (fallback "window", if the run is that long), else
    at the last sample ("tstop"); fallback "none" gives no value. If the interval is shorter
    than the window the value is the average slope over it and the basis ends in "/short"
    (an under-reading). Signed (a fall is negative) unless absolute. A p.u. series is
    multiplied by the nominal frequency first.

    Returns a SigResult: value (Hz/s, rounded to `decimals`), time (start of the steepest
    window, s), t1, f1, t2, f2 (the window's ends in s and Hz), basis (nadir, window, tstop,
    with /short), reason."""
    ts, fs, nom, err = _sg_freq(series, nominal, "RoCoF")

    def none(reason, basis=""):
        return SigResult(value=None, time=None, t1=None, f1=None, t2=None, f2=None, basis=basis, reason=reason)

    if len(ts) < 2:
        return none(err or "no frequency samples were recorded")
    t1 = _sg_t_event(series, t_event, ts)
    kind = verdict
    if verdict is not None and hasattr(verdict, "get") and not isinstance(verdict, str):
        kind = verdict.get("verdict")
        if nadir_time is None:
            nadir_time = verdict.get("time")
    nt = as_float(nadir_time)
    kind = None if kind is None else str(kind).strip().upper()
    if nt is None and (kind is None or kind == "NADIR"):
        found = nadir(series, t_event=t1, nominal=nom)
        log(f"RoCoF on {_sg_name(series)}: no nadir given, worked it out here ({found.verdict}).")
        kind, nt = found.verdict, found.time
    elif kind is None:
        kind = "NADIR"
    if kind == "NADIR" and nt is not None and nt > t1:
        t_end, basis = nt, "nadir"
    else:
        fb = str(fallback or "window").strip().lower()
        if fb == "none":
            return none("the frequency never turned around and the fallback is 'none'")
        sw = as_float(search_window)
        stop = t1 + sw if sw else None
        if fb == "window" and stop is not None and stop <= ts[-1]:
            t_end, basis = stop, "window"
        else:
            t_end, basis = ts[-1], "tstop"
    if t_end <= t1:
        return none("the end of the search interval is not after the event", basis)
    sl_t, sl_f = _sg_slice(ts, fs, t1, t_end)
    if sl_t is None:
        return none("no frequency samples between the event and the end of the search interval", basis)
    w = as_float(window, 0.5) or 0.5
    found = _sg_max_slope(sl_t, sl_f, w)
    if found is None:
        span = sl_t[-1] - sl_t[0]
        if span <= 0:
            return none("the search interval has no length", basis)
        value = (sl_f[-1] - sl_f[0]) / span
        a, fa, b, fbv = sl_t[0], sl_f[0], sl_t[-1], sl_f[-1]
        basis += "/short"
    else:
        value, a, fa, b, fbv = found
    if absolute:
        value = abs(value)
    d = int(as_float(decimals, 4) if decimals is not None else 4)
    return SigResult(value=round(value, d), time=a, t1=a, f1=fa, t2=b, f2=fbv, basis=basis,
                     reason=f"steepest {w:g} s window from {a:.3f} s to {b:.3f} s, searched to the {basis.split('/')[0]}")
# @end

# @helper value_at
# @needs sig_common
def value_at(series, t):
    """The value of a series at time t (s), linearly interpolated between samples. At an event
    instant that has two samples it is the first (the value just before the event). None when
    t is outside the record or there are no samples."""
    ts, ys = _sg_points(series)
    return _sg_interp(ts, ys, as_float(t))
# @end

# @helper final_value
# @needs sig_common
def final_value(series, last=0.0):
    """The last value of a series, or the mean of its last `last` seconds when last > 0.
    None when there are no samples."""
    ts, ys = _sg_points(series)
    if not ts:
        return None
    span = as_float(last, 0.0) or 0.0
    if span > 0:
        tail = [y for t, y in zip(ts, ys) if t >= ts[-1] - span]
        return sum(tail) / len(tail)
    return ys[-1]
# @end

# @helper first_cross
# @needs sig_common
def first_cross(series, level, direction="above", after=None, hold=0.0, pct=None, ref_t=None):
    """The first time a series reaches a level and stays there for `hold` seconds.

    direction "above" (value >= level) or "below" (value <= level); after: start looking at
    this time (s; default the series' first workflow event, else its first sample). The time
    is interpolated between samples. A crossing whose hold time runs past the end of the run
    does not count. hold 0 takes the first touch.

    With pct the level is pct % of the series' own value at ref_t (s; default the first
    workflow event, else the first sample), read as value_at does: at an event instant, the
    value just before the event. FRT: pct 90 is 90 % of the power before the fault.

    Returns a SigResult: time (s), delay (time - after, s), found (True / False; None with no
    data), level (the one looked for), after, reason."""
    ts, ys = _sg_points(series)
    if pct is not None:
        p = as_float(pct)
        if not ts or p is None:
            return SigResult(time=None, delay=None, found=None, level=None, after=as_float(after),
                             reason="no samples were recorded" if not ts else "no percentage given")
        tr = _sg_t_event(series, ref_t, ts)
        base = _sg_interp(ts, ys, tr)
        if base is None:
            return SigResult(time=None, delay=None, found=None, level=None, after=as_float(after),
                             reason=f"the curve has no value at {tr:.4g} s to take {p:g} % of")
        level = base * p / 100.0
    lv = as_float(level)
    if not ts or lv is None:
        return SigResult(time=None, delay=None, found=None, level=lv, after=as_float(after),
                         reason="no samples were recorded" if not ts else "no level given")
    t0 = _sg_t_event(series, after, ts)
    d = str(direction or "above").strip().lower()
    up = d not in ("below", "under", "down", "<", "<=", "falls below")
    tc, why = _sg_cross(ts, ys, lv, up, t0, hold)
    if tc is None:
        return SigResult(time=None, delay=None, found=False, level=lv, after=t0, reason=why)
    return SigResult(time=tc, delay=tc - t0, found=True, level=lv, after=t0,
                     reason=f"{'above' if up else 'below'} {lv:.6g} from {tc:.4g} s")
# @end

# @helper check_limits
# @needs sig_common, convert
# @imports import bisect
def check_limits(x, lo=None, hi=None, curve=None, x0=0.0, xs=None, after=None, before=None,
                 extend=False):
    """Check a value, a list of values or a time series against limits.

    With lo / hi (either may be None) every value must be within [lo, hi]. With a curve, rows
    of (x, low, high) (low or high may be None) give limits that change along x, linearly
    interpolated between rows (two rows at the same x make a step; the stricter one applies
    at that x). For a series x is the time minus x0 (for example x0 = the fault clearing
    time); for a value or a list the x positions are `xs` (minus x0). Points outside the
    curve's x range are not checked unless extend (then the last row holds beyond the end).
    after / before (s) limit a series to a time range.

    Returns a SigResult: ok (True / False, None with no data), text (PASS, FAIL or NO DATA),
    margin (the smallest distance inside the limits; negative when a limit is broken, in the
    value's unit), at (time in s for a series, else the x value, else the 1-based position of
    the worst point), worst (the value there), limit (the limit nearest to it), n (points
    checked), n_fail, first_fail (where the first limit is broken), reason."""
    def nodata(reason):
        return SigResult(ok=None, text="NO DATA", margin=None, at=None, worst=None, limit=None,
                         n=0, n_fail=0, first_fail=None, reason=reason)

    if x is None:
        return nodata("no value to check")
    off = as_float(x0, 0.0) or 0.0
    pts = []                                   # (where reported, x position, value)
    if hasattr(x, "t") and hasattr(x, "y"):
        ts, ys = _sg_points(x)
        a, b = as_float(after), as_float(before)
        pts = [(t, t - off, y) for t, y in zip(ts, ys) if (a is None or t >= a) and (b is None or t <= b)]
    else:
        many = isinstance(x, (list, tuple)) or (hasattr(x, "__iter__") and not isinstance(x, (str, bytes, dict)))
        vals = as_items(x) if many else [x]
        pos = as_items(xs) if xs is not None else None
        for i, v in enumerate(vals):
            fv = as_float(v)
            if fv is None or fv != fv:
                continue
            px = as_float(pos[i]) if pos is not None and i < len(pos) else None
            where = px if px is not None else (i + 1 if many else None)
            pts.append((where, None if px is None else px - off, fv))
    if not pts:
        return nodata("no numbers to check")

    rows = None
    if curve is not None:
        rows = []
        for r in as_items(curve):
            if isinstance(r, dict):
                rx = r.get("x", r.get("t"))
                rl = r.get("low", r.get("lo", r.get("min")))
                rh = r.get("high", r.get("hi", r.get("max")))
            else:
                r = list(r) + [None, None, None]
                rx, rl, rh = r[0], r[1], r[2]
            fx = as_float(rx)
            if fx is None:
                continue
            rows.append((fx, _sg_lim(rl), _sg_lim(rh)))
        rows.sort(key=lambda r: r[0])
        if not rows:
            return nodata("the curve has no rows with a number in the first column")
    lo_f, hi_f = _sg_lim(lo), _sg_lim(hi)
    rx = [r[0] for r in rows] if rows else None

    worst = None
    n = n_fail = 0
    first_fail = None
    for where, px, v in pts:
        if rows is not None:
            if px is None:
                continue
            l = _sg_curve_at(rows, rx, px, 1, max, extend)
            h = _sg_curve_at(rows, rx, px, 2, min, extend)
        else:
            l, h = lo_f, hi_f
        if l is None and h is None:
            continue
        cands = []
        if l is not None:
            cands.append((v - l, l))
        if h is not None:
            cands.append((h - v, h))
        m, lim = min(cands, key=lambda c: c[0])
        n += 1
        # A value exactly on a limit passes; the tolerance only absorbs the rounding of an
        # interpolated curve limit (0.8 + 0.5 * 0.1 is 0.8500000000000001).
        if m < -1e-9 * max(1.0, abs(lim)):
            n_fail += 1
            if first_fail is None:
                first_fail = where
        if worst is None or m < worst[0]:
            worst = (m, where, v, lim)
    if worst is None:
        if rows is not None and all(px is None for _, px, _ in pts):
            return nodata("a value or a list needs its x positions (xs) to be checked against a curve")
        return nodata("no point fell where a limit applies" if rows is not None else "no limit given")
    ok = n_fail == 0
    return SigResult(ok=ok, text="PASS" if ok else "FAIL", margin=max(0.0, worst[0]) if ok else worst[0], at=worst[1], worst=worst[2],
                     limit=worst[3], n=n, n_fail=n_fail, first_fail=first_fail,
                     reason=("within the limits, closest " if ok else f"{n_fail} of {n} points outside the limits, worst ")
                     + f"{worst[2]:.6g} against {worst[3]:.6g}")


def _sg_lim(v):
    f = as_float(v)
    return None if f is None or f != f else f


def _sg_curve_at(rows, rx, x, col, stricter, extend):
    # The limit of column col (1 low, 2 high) at x: exact rows at x (a step) give the stricter
    # one, otherwise linear between the rows either side; None where the curve has no limit.
    lo_i = bisect.bisect_left(rx, x)
    hi_i = bisect.bisect_right(rx, x)
    if lo_i < hi_i:
        vals = [rows[k][col] for k in range(lo_i, hi_i) if rows[k][col] is not None]
        return stricter(vals) if vals else None
    if lo_i == len(rows):
        return rows[-1][col] if extend else None
    if lo_i == 0:
        return None
    (xa, *a), (xb, *b) = rows[lo_i - 1], rows[lo_i]
    va, vb = a[col - 1], b[col - 1]
    if va is None or vb is None:
        return None
    return va + (x - xa) / (xb - xa) * (vb - va)
# @end

# @helper verdict
# @needs convert, Trial, sig_common
def verdict(value, op=">=", limit=None, tol=0.0):
    """Pass / fail of `value op limit`. op: >, >=, <, <=, = (within tol), != (more than tol
    apart), "is true", "is false" (also the words gt, ge, lt, le, eq, ne). A list or a series
    passes only when every value does. A missing value or limit gives NO DATA.

    Returns a SigResult: ok (True, False or None), text (PASS, FAIL or NO DATA), value, limit,
    op, margin (how far inside the condition the worst value is; negative when it fails)."""
    o = str(op or ">=").strip().lower().replace(" ", "")
    # The not-equal and the two "or equal" signs are written as escapes so the copied helper
    # stays plain ASCII whatever editor or console opens the script.
    o = {"==": "=", "eq": "=", "\u2260": "!=", "<>": "!=", "ne": "!=", "\u2265": ">=", "\u2264": "<=",
         "gt": ">", "ge": ">=", "lt": "<", "le": "<=",
         "true": "true", "istrue": "true", "yes": "true", "isfalse": "false", "false": "false",
         "no": "false"}.get(o, o)

    def out(ok, margin=None):
        return SigResult(ok=ok, text="NO DATA" if ok is None else ("PASS" if ok else "FAIL"),
                         value=value, limit=limit, op=o, margin=margin)

    if o in ("true", "false"):
        vals = as_items(value) if isinstance(value, (list, tuple)) else [value]
        tri = [_tri(v) for v in vals]
        if not tri or any(t is None for t in tri):
            return out(None)
        want = o == "true"
        return out(all(t == want for t in tri))
    if o not in (">", ">=", "<", "<=", "=", "!="):
        return out(None)
    if isinstance(value, (list, tuple)) or (hasattr(value, "t") and hasattr(value, "y")):
        vals = [v for v in as_list(value) if v == v]
    else:
        f = as_float(value)
        vals = [] if f is None or f != f else [f]
    lim = as_float(limit)
    if not vals or lim is None or lim != lim:
        return out(None)
    t = abs(as_float(tol, 0.0) or 0.0)
    margins = []
    for v in vals:
        if o in (">", ">="):
            m = v - lim
        elif o in ("<", "<="):
            m = lim - v
        elif o == "=":
            m = t - abs(v - lim)
        else:
            m = abs(v - lim) - t
        margins.append(m)
    m = min(margins)
    strict = o in (">", "<", "!=")
    return out(m > 0 if strict else m >= 0, m)
# @end

# @helper combine_series
# @needs sig_common, Series, log
def combine_series(series_list, how="sum"):
    """One series from several, on a common time base: how is sum, mean, min, max or spread
    (max - min at each instant, for example a rotor-angle spread). Series on the same time
    base are combined sample by sample; otherwise each is interpolated onto every time point
    of the others inside the time range they all cover. Missing or empty series are left out
    (with a warning). Returns a Series (empty when nothing is left)."""
    h = str(how or "sum").strip().lower()
    h = {"total": "sum", "average": "mean", "avg": "mean", "minimum": "min", "maximum": "max",
         "range": "spread"}.get(h, h)
    if h not in ("sum", "mean", "min", "max", "spread"):
        log(f"Combine series: unknown way '{how}', using sum.", "warn")
        h = "sum"
    items = [series_list] if hasattr(series_list, "t") else as_items(series_list)
    good = [s for s in items if s is not None and hasattr(s, "t") and len(getattr(s, "t")) > 0]
    if len(good) < len(items):
        log(f"Combine series: {len(items) - len(good)} of {len(items)} inputs had no samples and were left out.", "warn")
    if not good:
        return Series([], [], f"{h} of nothing")
    units = {str(getattr(s, "unit", "")) for s in good}
    unit = units.pop() if len(units) == 1 else ""
    names = [getattr(s, "label", "") for s in good]
    label = f"{h.capitalize()} of " + (", ".join(names) if len(good) <= 3 and all(names) else f"{len(good)} series")
    events, seen = [], set()
    for s in good:
        for e in getattr(s, "events", None) or []:
            if tuple(e) not in seen:
                seen.add(tuple(e))
                events.append(e)
    first_t = list(good[0].t)
    if all(list(s.t) == first_t for s in good):
        t_base = first_t
        cols = [list(s.y) for s in good]
    else:
        t_lo = max(float(s.t[0]) for s in good)
        t_hi = min(float(s.t[-1]) for s in good)
        t_base = sorted({float(t) for s in good for t in s.t if t_lo <= float(t) <= t_hi})
        cols = []
        for s in good:
            ts, ys = _sg_points(s)
            cols.append([_sg_interp(ts, ys, t) for t in t_base])
    out_y = []
    for k in range(len(t_base)):
        vals = [c[k] for c in cols]
        if any(v is None or v != v for v in vals):
            out_y.append(float("nan"))
        elif h == "sum":
            out_y.append(sum(vals))
        elif h == "mean":
            out_y.append(sum(vals) / len(vals))
        elif h == "min":
            out_y.append(min(vals))
        elif h == "max":
            out_y.append(max(vals))
        else:
            out_y.append(max(vals) - min(vals))
    return Series(t_base, out_y, label, unit, events)
# @end

# @helper window_rms
# @needs sig_common, Series, stat
# @imports import math
def window_rms(series, frequency=None, cycles=1.0, label="", unit=""):
    """The RMS of an instantaneous waveform over a sliding window, as a Series.

    PSCAD simulates instantaneous waveforms, not phasors, so a voltage or a current comes out
    of a run as the wave itself. This is what turns one into the RMS value an assessment is
    written against. The window is `cycles` cycles of `frequency` (Hz); with no frequency the
    workflow's nominal one is used. The first window has no full window behind it, so the
    series starts one window in."""
    ts, ys = _sg_points(series)
    if len(ts) < 4:
        return Series([], [], label or _sg_label(series, "RMS"), unit or _sg_unit(series))
    f = _sg_frequency(frequency)
    span = max(1e-12, float(cycles) / f)
    step = (ts[-1] - ts[0]) / max(1, len(ts) - 1)
    n = max(2, int(round(span / step)))
    if n > len(ts):
        log("A %g cycle window at %g Hz is longer than the run; the RMS is taken over the "
            "whole of it." % (cycles, f), "warn")
        n = len(ts)
    out_t, out_y = [], []
    total = 0.0
    for i, v in enumerate(ys):
        total += v * v
        if i >= n:
            total -= ys[i - n] * ys[i - n]
        if i >= n - 1:
            out_t.append(ts[i])
            out_y.append(math.sqrt(max(0.0, total / n)))
    return Series(out_t, out_y, label or _sg_label(series, "RMS"),
                  unit or _sg_unit(series), getattr(series, "events", None))


def _sg_label(series, what):
    name = str(getattr(series, "label", "") or "").strip()
    return ("%s, %s" % (name, what)) if name else what


def _sg_unit(series):
    return str(getattr(series, "unit", "") or "")


def _sg_frequency(frequency):
    """The frequency a harmonic or sequence check works at: the one given, else the nominal."""
    f = as_float(frequency)
    if f is not None and f > 0:
        return f
    getter = globals().get("f_nominal")
    if callable(getter):
        try:
            return float(getter())
        except Exception:
            pass
    return 50.0


def _sg_crosses(pts, level, rising):
    """The first time the points cross `level`, interpolated; None when they do not."""
    for i in range(1, len(pts)):
        t0, y0 = pts[i - 1]
        t1, y1 = pts[i]
        if (rising and y0 < level <= y1) or (not rising and y0 > level >= y1):
            if y1 == y0:
                return t1
            return t0 + (level - y0) * (t1 - t0) / (y1 - y0)
    return None
# @end

# @helper dft
# @needs sig_common
# @imports import math
def _dft_window(ts, ys, f0, at=None, cycles=1.0, harmonics=50):
    """(magnitudes of harmonics 1..n, the DC component) over whole cycles ending at `at`.

    A plain discrete Fourier transform over a whole number of cycles, which is what makes the
    magnitudes come out right: a window that is not a whole number of cycles spreads one
    harmonic over its neighbours. The samples go in as the run recorded them, so the answer is
    only as good as its plot step: a 250 us plot step resolves to about 2 kHz."""
    if not ts or f0 <= 0:
        return [], 0.0
    span = float(cycles) / f0
    end = ts[-1] if at is None else float(at)
    start = end - span
    idx = [i for i, t in enumerate(ts) if start <= t <= end]
    if len(idx) < 8:
        return [], 0.0
    xs = [ts[i] for i in idx]
    vs = [ys[i] for i in idx]
    n = len(vs)
    dc = sum(vs) / n
    mags = []
    for h in range(1, int(harmonics) + 1):
        re = 0.0
        im = 0.0
        for t, v in zip(xs, vs):
            ang = 2.0 * math.pi * h * f0 * (t - start)
            re += v * math.cos(ang)
            im += v * math.sin(ang)
        mags.append(2.0 * math.sqrt(re * re + im * im) / n)
    return mags, dc
# @end

# @helper spectrum
# @needs sig_common, dft, window_rms
# @imports import math
def spectrum(series, frequency=None, at=None, cycles=1.0, harmonics=50):
    """The harmonic spectrum of a waveform at one instant.

    PSCAD has no frequency-domain harmonic scan: harmonics come out of the time-domain result,
    which is what this does. The window is `cycles` whole cycles ending at `at` (the end of the
    run by default), so take it once the case has settled.

    Returns a SigResult: fundamental (harmonic 1), dc, mags (harmonics 1..n), pct (each as a
    percentage of the fundamental), orders, frequency, at, n."""
    ts, ys = _sg_points(series)
    f = _sg_frequency(frequency)
    mags, dc = _dft_window(ts, ys, f, at, cycles, harmonics)
    if not mags:
        return SigResult(fundamental=None, dc=None, mags=[], pct=[], orders=[], frequency=f,
                         at=at, n=0, reason="not enough samples in the window")
    base = mags[0]
    pct = [(100.0 * m / base if base else None) for m in mags]
    end = ts[-1] if at is None else float(at)
    return SigResult(fundamental=base, dc=dc, mags=mags, pct=pct,
                     orders=list(range(1, len(mags) + 1)), frequency=f, at=end,
                     n=len(ts), reason="")


def thd(series, frequency=None, at=None, cycles=1.0, harmonics=50, include_dc=False):
    """Total harmonic distortion of a waveform, as a percentage of the fundamental.

    THD is the square root of the sum of the squares of harmonics 2 upwards, over harmonic 1,
    which is the definition a grid code states. `include_dc` counts the DC component in too.

    Returns a SigResult: value (THD in %), fundamental, dc, worst (the largest harmonic above
    the fundamental, in %), worst_order, orders, pct, frequency, at."""
    sp = spectrum(series, frequency, at, cycles, harmonics)
    if not sp.mags:
        return SigResult(value=None, fundamental=None, dc=None, worst=None, worst_order=None,
                         orders=[], pct=[], frequency=sp.frequency, at=sp.at, reason=sp.reason)
    base = sp.fundamental
    rest = sp.mags[1:]
    total = sum(m * m for m in rest)
    if include_dc and sp.dc is not None:
        total += sp.dc * sp.dc
    value = (100.0 * math.sqrt(total) / base) if base else None
    worst = None
    worst_order = None
    if rest and base:
        worst_order = 2 + max(range(len(rest)), key=lambda i: rest[i])
        worst = 100.0 * max(rest) / base
    return SigResult(value=value, fundamental=base, dc=sp.dc, worst=worst,
                     worst_order=worst_order, orders=sp.orders, pct=sp.pct,
                     frequency=sp.frequency, at=sp.at, reason="")
# @end

# @helper sequence
# @needs sig_common, Series, dft, window_rms
# @imports import math
def sequence(a, b, c, frequency=None, cycles=1.0, which="negative", label="", unit=""):
    """Positive, negative or zero sequence magnitude of three instantaneous phases, as a Series.

    Three phase waveforms go in and the sequence magnitude over a sliding whole-cycle window
    comes out. This is how an unbalance assessment is made from an EMT run, where the phases
    are three separate channels rather than one phasor. `which` is "positive", "negative" or
    "zero"."""
    ta, ya = _sg_points(a)
    tb, yb = _sg_points(b)
    tc, yc = _sg_points(c)
    n = min(len(ta), len(tb), len(tc))
    if n < 8:
        return Series([], [], label or "sequence", unit or _sg_unit(a))
    f = _sg_frequency(frequency)
    span = float(cycles) / f
    step = (ta[n - 1] - ta[0]) / max(1, n - 1)
    win = max(4, int(round(span / step)))
    if win > n:
        log("A %g cycle window at %g Hz is longer than the run, so no sequence value can be "
            "worked out." % (cycles, f), "warn")
        return Series([], [], label or "sequence", unit or _sg_unit(a))
    what = str(which or "negative").strip().lower()
    out_t, out_y = [], []
    # One pass: each sample's share of the phasor is worked out once, against one time
    # reference for all three phases, and the window's sum slides along (a sample comes
    # in, the one a window back goes out). A sequence magnitude does not depend on the
    # reference, so this is the window-by-window sum without doing it again per window,
    # which on an EMT run of 100 000 samples was minutes.
    w = 2.0 * math.pi * f
    t_ref = ta[0]
    parts = []
    for tt, yy in ((ta, ya), (tb, yb), (tc, yc)):
        parts.append([(v * math.cos(w * (t - t_ref)), -v * math.sin(w * (t - t_ref)))
                      for t, v in zip(tt[:n], yy[:n])])
    sums = [[0.0, 0.0], [0.0, 0.0], [0.0, 0.0]]
    scale = 2.0 / win
    for end in range(n):
        for k in range(3):
            re, im = parts[k][end]
            sums[k][0] += re
            sums[k][1] += im
            if end >= win:
                re, im = parts[k][end - win]
                sums[k][0] -= re
                sums[k][1] -= im
        if end >= win - 1:
            pa, pb, pc = [(sm[0] * scale, sm[1] * scale) for sm in sums]
            out_t.append(ta[end])
            out_y.append(_sequence_mag(pa, pb, pc, what))
    return Series(out_t, out_y, label or ("%s sequence" % what),
                  unit or _sg_unit(a), getattr(a, "events", None))


def _sequence_mag(pa, pb, pc, which):
    """The positive, negative or zero sequence magnitude of three phasors."""
    ar = -0.5
    ai = math.sqrt(3.0) / 2.0

    def mul(p, q):
        return (p[0] * q[0] - p[1] * q[1], p[0] * q[1] + p[1] * q[0])

    a1 = (ar, ai)
    a2 = mul(a1, a1)
    if which.startswith("z"):
        s = (pa[0] + pb[0] + pc[0], pa[1] + pb[1] + pc[1])
    elif which.startswith("n"):
        qb = mul(a2, pb)
        qc = mul(a1, pc)
        s = (pa[0] + qb[0] + qc[0], pa[1] + qb[1] + qc[1])
    else:
        qb = mul(a1, pb)
        qc = mul(a2, pc)
        s = (pa[0] + qb[0] + qc[0], pa[1] + qb[1] + qc[1])
    return math.sqrt(s[0] * s[0] + s[1] * s[1]) / 3.0


def unbalance(a, b, c, frequency=None, cycles=1.0, at=None):
    """The negative sequence as a percentage of the positive, the unbalance factor.

    Returns a SigResult: value (%), negative, positive, at."""
    neg = sequence(a, b, c, frequency, cycles, "negative")
    pos = sequence(a, b, c, frequency, cycles, "positive")
    if not len(neg) or not len(pos):
        return SigResult(value=None, negative=None, positive=None, at=None,
                         reason="not enough samples in the window")
    when = as_float(at)
    i = len(neg) - 1 if when is None else min(range(len(neg)),
                                              key=lambda k: abs(neg.t[k] - when))
    p = pos.y[i]
    return SigResult(value=(100.0 * neg.y[i] / p if p else None), negative=neg.y[i],
                     positive=p, at=neg.t[i], reason="")
# @end

# @helper overshoot
# @needs sig_common, window_rms
def overshoot(series, t_event=None, reference="final", target=None, hold=1.0):
    """Overshoot and rise time of a step response, the two numbers a control review asks for.

    The step runs from the last sample before t_event (the series' first event by default) to
    `target`, or to the mean of the last `hold` seconds. Overshoot is how far past the final
    value the response goes, as a percentage of the step; rise time is 10 % to 90 % of it.

    Returns a SigResult: value (overshoot %), peak, time, initial, final, step, rise (s),
    t10, t90, n."""
    ts, ys = _sg_points(series)
    if len(ts) < 3:
        return SigResult(value=None, peak=None, time=None, initial=None, final=None,
                         step=None, rise=None, t10=None, t90=None, n=len(ts),
                         reason="not enough samples")
    te = as_float(t_event)
    if te is None and hasattr(series, "first_event"):
        te = series.first_event(default=None)
    if te is None:
        te = ts[0]
    before = [y for t, y in zip(ts, ys) if t <= te]
    initial = before[-1] if before else ys[0]
    final = as_float(target)
    if final is None or str(reference or "final").startswith("f"):
        tail = [y for t, y in zip(ts, ys) if t >= ts[-1] - float(hold)]
        final = sum(tail) / len(tail) if tail else ys[-1]
    step = final - initial
    after = [(t, y) for t, y in zip(ts, ys) if t >= te]
    if not after or abs(step) < 1e-15:
        return SigResult(value=None, peak=None, time=None, initial=initial, final=final,
                         step=step, rise=None, t10=None, t90=None, n=len(after),
                         reason="the step is zero" if after else "nothing after the event")
    if step > 0:
        t_pk, pk = max(after, key=lambda p: p[1])
        over = 100.0 * (pk - final) / step
    else:
        t_pk, pk = min(after, key=lambda p: p[1])
        over = 100.0 * (final - pk) / (-step)
    t10 = _sg_crosses(after, initial + 0.1 * step, step > 0)
    t90 = _sg_crosses(after, initial + 0.9 * step, step > 0)
    rise = (t90 - t10) if (t10 is not None and t90 is not None and t90 >= t10) else None
    return SigResult(value=max(0.0, over), peak=pk, time=t_pk, initial=initial, final=final,
                     step=step, rise=rise, t10=t10, t90=t90, n=len(after), reason="")
# @end

# @helper damping
# @needs sig_common
# @imports import math
def damping(series, t_start=None, t_end=None, min_peaks=3):
    """The damping ratio and frequency of a ringdown, from the peaks of its envelope.

    A control interaction, a subsynchronous oscillation or a badly tuned loop shows up in an
    EMT run as a decaying, or growing, oscillation. The peaks are fitted with an exponential: a
    negative damping ratio means the oscillation is growing, which is the answer a stability
    review is looking for.

    Returns a SigResult: value (the damping ratio), frequency (Hz), stable (value > 0), peaks
    (how many were used), decay (the exponential rate, 1/s), first, last."""
    ts, ys = _sg_points(series)
    a = as_float(t_start)
    b = as_float(t_end)
    pts = [(t, y) for t, y in zip(ts, ys) if (a is None or t >= a) and (b is None or t <= b)]
    if len(pts) < 8:
        return SigResult(value=None, frequency=None, stable=None, peaks=0, decay=None,
                         first=None, last=None, reason="not enough samples")
    # The baseline an oscillation decays towards is what it settles at, not the average of
    # the whole window: the average of a decaying wave is pulled off zero by its first large
    # cycles, and subtracting that would shrink the late peaks and make the decay look faster
    # than it is. A ringdown about 1 pu settles at 1 pu, which is exactly what the tail says.
    tail = pts[max(0, int(len(pts) * 0.9)):]
    base = sum(y for _, y in tail) / len(tail) if tail else 0.0
    tops = []
    for i in range(1, len(pts) - 1):
        y0 = pts[i - 1][1]
        y1 = pts[i][1]
        y2 = pts[i + 1][1]
        if y1 > y0 and y1 >= y2 and y1 > base:
            tops.append((pts[i][0], y1 - base))
    if len(tops) < int(min_peaks):
        return SigResult(value=None, frequency=None, stable=None, peaks=len(tops), decay=None,
                         first=None, last=None,
                         reason="only %d peak%s found; the signal may not be oscillating"
                                % (len(tops), "" if len(tops) == 1 else "s"))
    # A peak down in the numerical noise has a log that says nothing, and one of those at the
    # end of a long window would drag the straight line with it.
    floor = max(t[1] for t in tops) * 1e-3
    good = [(t, math.log(v)) for t, v in tops if v > floor]
    if len(good) < 2:
        return SigResult(value=None, frequency=None, stable=None, peaks=len(tops), decay=None,
                         first=None, last=None,
                         reason="the peaks are not above what the signal settles at")
    n = len(good)
    tm = sum(t for t, _ in good) / n
    lm = sum(l for _, l in good) / n
    num = sum((t - tm) * (l - lm) for t, l in good)
    den = sum((t - tm) ** 2 for t, _ in good)
    decay = (num / den) if den else 0.0
    gaps = [good[i][0] - good[i - 1][0] for i in range(1, n)]
    period = sum(gaps) / len(gaps) if gaps else 0.0
    freq = (1.0 / period) if period > 0 else None
    ratio = None
    if freq:
        wn = math.sqrt(decay * decay + (2.0 * math.pi * freq) ** 2)
        ratio = (-decay / wn) if wn else None
    return SigResult(value=ratio, frequency=freq,
                     stable=(None if ratio is None else ratio > 0),
                     peaks=len(tops), decay=decay, first=good[0][0], last=good[-1][0],
                     reason="")
# @end
