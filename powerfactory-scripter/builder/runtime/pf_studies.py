# Workflow Builder runtime: PowerFactory studies (load flow, RMS and EMT simulation, harmonic load
# flow, short circuit) and simulation events.
#
# Same section format as base.py. Every run uses the active study case's own command; settings a
# block overrides are put back right after the run (checked live: writing a command setting back
# does not discard the results). Simulation curves are read into memory straight after the run, and
# the temporary result file is deleted before the next calculation, so end-of-run values stay
# readable until then. Every event a block adds is one event named PFB_<key>_<role>, created on the
# first run and updated after that; a run switches off the PFB_ events no block added for it.

# @helper pf_command
# @needs log, pf_state, seconds, track_created
def _command(app, cls):
    """The active study case's own command of this class. GetFromStudyCase would silently make a
    new one in a case that has none, so a new one is noted and deleted at the end."""
    case = app.GetActiveStudyCase()
    if case is None:
        raise PFError("[MODEL] No study case is active.")
    had = case.GetContents("*." + cls)
    cmd = app.GetFromStudyCase(cls)
    if cmd is None:
        raise PFError(f"[MODEL] The study case '{_nm(case)}' has no {cls} and PowerFactory did not make one.")
    if not had:
        track_created(cmd, "command")
        log(f"The study case had no {cls}; one was made for this run and is removed at the end.")
    return cmd


def _put_attrs(obj, store, attrs, seconds=()):
    """Write command settings for one run, keeping each original once (times in seconds)."""
    for a, v in attrs.items():
        sec = a in seconds
        if a not in store:
            store[a] = (get_seconds(obj, a) if sec else obj.GetAttribute(a), sec)
        if sec:
            set_seconds(obj, a, v)
        else:
            obj.SetAttribute(a, v)


def _restore_attrs(obj, store):
    for a, (v, sec) in store.items():
        try:
            if sec:
                set_seconds(obj, a, v)
            else:
                obj.SetAttribute(a, v)
        except Exception as e:
            log(f"Could not put back {_nm(obj)}.{a}: {e}", "warn")
    store.clear()


class StudyResult:
    """The outcome of a calculation: ok (it ran), rc (PowerFactory's return code, 0 = fine) and
    PowerFactory's messages of that run."""

    def __init__(self, ok, rc, messages, **extra):
        self.ok, self.rc, self.messages = bool(ok), rc, list(messages)
        self.__dict__.update(extra)

    def __bool__(self):
        return self.ok

    def __repr__(self):
        return f"{type(self).__name__}(ok={self.ok}, rc={self.rc})"
# @end

# @helper run_load_flow
# @needs log, pf_state, pf_messages, pf_command
# @imports import time
_LDF_NET = {"case": None, "ac": 0, "balanced": 0, "unbalanced": 1, "dc": 2}
_LDF_NET_WORDS = {0: "AC balanced", 1: "AC unbalanced", 2: "DC"}
_ON_OFF = {"case": None, "on": 1, "off": 0}


class LdfResult(StudyResult):
    """A load flow: ok (converged), rc, slack_mw (power of the reference machines and slack
    external grids, MW; None when it did not converge) and messages."""


def _slack_mw(app, unbalanced=False):
    tok = "m:Psum:bus1" if unbalanced else "m:P:bus1"
    total, n = 0.0, 0
    for cls, test in (("ElmSym", lambda o: o.GetAttribute("ip_ctrl") == 1),
                      ("ElmXnet", lambda o: str(o.GetAttribute("bustp")) == "SL")):
        for o in app.GetCalcRelevantObjects("*." + cls):
            try:
                if o.GetAttribute("outserv") == 0 and test(o):
                    total += float(o.GetAttribute(tok))
                    n += 1
            except Exception:
                pass
    return total if n else None


def run_load_flow(app, net="case", qlim="case", taps="case"):
    """Run the active study case's load flow (ComLdf) with its own settings, or with overrides for
    this run only: net "ac" | "unbalanced" | "dc", reactive power limits qlim and transformer taps
    "on" | "off". Returns an LdfResult; ok is False (not an error) when it does not converge, and
    the log says so with PowerFactory's own message, tagged [MODEL]."""
    run_deferred()
    ldf = _command(app, "ComLdf")
    want = {}
    for key, table, attr, val in (("net", _LDF_NET, "iopt_net", net), ("qlim", _ON_OFF, "iopt_lim", qlim),
                                  ("taps", _ON_OFF, "iopt_at", taps)):
        v = str(val if val is not None else "case").lower()
        if v not in table:
            _say_once(("ldfopt", key, v), f"Load flow {key} '{val}' is not one of {', '.join(table)}; using the case setting.", "warn")
        elif table[v] is not None:
            want[attr] = table[v]
    keep = {}
    pf_messages(app)
    t0 = time.time()
    try:
        _put_attrs(ldf, keep, want)
        used = ldf.GetAttribute("iopt_net")
        rc = ldf.Execute()
    finally:
        _restore_attrs(ldf, keep)
    msgs = pf_messages(app)
    ok = rc == 0
    slack = _slack_mw(app, used == 1) if ok else None
    words = _LDF_NET_WORDS.get(used, f"iopt_net {used}")
    if ok:
        log(f"Load flow converged ({words}, {1000 * (time.time() - t0):.0f} ms)"
            + (f"; slack {slack:.1f} MW." if slack is not None else "."))
    else:
        errs = [m for m in msgs if m.startswith("Error:")] or msgs
        log(f"[MODEL] Load flow did not converge ({words}, code {rc})" + (": " + "; ".join(errs[-3:]) if errs else "") + ".", "warn")
    return LdfResult(ok, rc, msgs, slack_mw=slack, net=words)
# @end

# @helper pf_events
# @needs log, pf_state, seconds, track_created, pf_command
# @imports import re
_EVT = {"added": {}, "unbalanced": set()}   # events added since the last run -> (time in s, label);
                                           # unbalanced: the faults among them that need net "rst"


def _event_folder(app):
    """The event list the simulation really uses (ComInc.p_event), made when the case has none."""
    inc = _command(app, "ComInc")
    evf = inc.GetAttribute("p_event")
    if evf is None:
        case = app.GetActiveStudyCase()
        had = case.GetContents("*.IntEvt")
        evf = app.GetFromStudyCase("IntEvt")
        if not had:
            track_created(evf, "object")
        inc.SetAttribute("p_event", evf)
    return evf


def _event_key(key):
    return re.sub(r"[^A-Za-z0-9_]", "_", str(key)) or "evt"


def _event_put(app, key, role, cls, target, t, label, attrs=None):
    """Create, or update when it exists, the one event PFB_<key>_<role> of class cls, switch it on
    and register it for the next run. Times are written in seconds whatever the project shows."""
    if isinstance(target, (list, tuple)):
        if len(target) != 1:
            raise PFError(f"[CODE] An event needs one target element, not {len(target)}.")
        target = target[0]
    if target is None:
        raise PFError("[CODE] An event needs a target element.")
    evf = _event_folder(app)
    name = f"{PFB}{_event_key(key)}_{role}"
    hits = evf.GetContents(f"{name}.{cls}")
    ev = hits[0] if hits else evf.CreateObject(cls, name)
    if ev is None:
        raise PFError(f"[MODEL] PowerFactory did not make the event {name}.")
    track_created(ev, "event")
    ev.SetAttribute("p_target", target)
    set_seconds(ev, "time", float(t))
    for a, v in (attrs or {}).items():
        ev.SetAttribute(a, v)
    ev.SetAttribute("outserv", 0)
    _EVT["added"][_full(ev)] = (float(t), str(label))
    return ev
# @end

# @helper SimResult
# @needs log, Series, pf_state
# @imports import math
class SimResult:
    """One RMS or EMT run, read into memory straight after the run, so reading a curve never
    touches PowerFactory again.

    status "ok" (reached the stop time), "early" (stopped before it, for example on loss of
    synchronism; the curves up to t_end are usable) or "no_init" (the initial conditions could not
    be found; no curves). ok, reached_end and init_ok say the same as True / False. message holds
    PowerFactory's last error lines; events lists the workflow's events of this run as (time in s,
    label); t_end is where the run stopped (s)."""

    def __init__(self, kind, status, t_end, tstop, message, events, t, cols):
        self.kind, self.status, self.t_end, self.tstop = kind, status, t_end, tstop
        self.message, self.events, self.t, self._cols = message, list(events), list(t), cols

    @property
    def ok(self):
        return self.status == "ok"

    @property
    def reached_end(self):
        return self.status == "ok"

    @property
    def init_ok(self):
        return self.status != "no_init"

    def has(self, obj, var):
        """True when this run recorded var for obj."""
        e = self._cols.get((_full(obj), str(var)))
        return bool(e and e["y"] is not None)

    def _entry(self, obj, var):
        if isinstance(obj, (list, tuple)):
            if len(obj) != 1:
                _say_once(("ser1", str(var)), f"{len(obj)} elements were given for {var}; using the first. "
                          "To combine several, choose sum, mean, min, max or spread.", "warn")
            obj = obj[0] if obj else None
        if obj is None:
            return None, ""
        e = self._cols.get((_full(obj), str(var)))
        if e is None:
            _say_once(("notrec", _full(obj), var), f"{var} of {_nm(obj)} was not recorded in this run. Add it "
                      "to the Record list of the run block.", "warn")
            return None, _nm(obj)
        return e, e["name"]

    def series(self, obj, var, label=None):
        """The curve of var (for example "m:fehz") of one element as a Series (t in s), carrying the
        run's events. Empty, with a warning, when it was not recorded."""
        e, name = self._entry(obj, var)
        lab = label or f"{name} {var}".strip()
        if e is None or e["y"] is None or self.status == "no_init":
            return Series([], [], lab, "", self.events)
        return Series(self.t, e["y"], lab, e["unit"], self.events)

    def series_combined(self, objs, var, combine="mean", label=None):
        """One curve from var of several elements, point by point: combine "sum", "mean", "min",
        "max" or "spread" (max minus min, for example the rotor-angle spread)."""
        items = objs if isinstance(objs, (list, tuple)) else [objs]
        parts, unit = [], ""
        for o in items:
            e = self._cols.get((_full(o), str(var)))
            if e is None or e["y"] is None:
                _say_once(("notrec", _full(o), var), f"{var} of {_nm(o)} was not recorded in this run; "
                          "left out of the combined curve.", "warn")
                continue
            parts.append(e["y"])
            unit = unit or e["unit"]
        how = combine if combine in ("sum", "mean", "min", "max", "spread") else "mean"
        if how != combine:
            _say_once(("comb", combine), f"Combine '{combine}' is not sum, mean, min, max or spread; using mean.", "warn")
        lab = label or f"{how} of {var} ({len(parts)} elements)"
        if not parts or self.status == "no_init":
            return Series([], [], lab, unit, self.events)
        fn = {"sum": sum, "mean": lambda v: sum(v) / len(v), "min": min, "max": max,
              "spread": lambda v: max(v) - min(v)}[how]
        n = min(len(p) for p in parts)
        y = []
        for i in range(n):
            vals = [p[i] for p in parts if not (isinstance(p[i], float) and math.isnan(p[i]))]
            y.append(fn(vals) if vals else float("nan"))
        return Series(self.t[:n], y, lab, unit, self.events)

    def __repr__(self):
        return f"SimResult({self.kind}, {self.status}, t_end={self.t_end}, {len(self.t)} samples)"
# @end

# @helper sim_run
# @needs log, pf_state, pf_messages, seconds, track_created, pf_command, pf_events, SimResult, f_nominal, pf_find
# @imports import time
def _flat_monitors(monitors, monitor_lists):
    pairs, seen = [], set()

    def add(o, v):
        if o is None:
            return
        if isinstance(o, (list, tuple)):
            for x in o:
                add(x, v)
            return
        k = (_full(o), str(v))
        if k not in seen:
            seen.add(k)
            pairs.append((o, str(v)))

    for item in monitors or ():
        add(item[0], item[1])
    for item in monitor_lists or ():
        add(list(item[0]) if not isinstance(item[0], (list, tuple)) else item[0], item[1])
    return pairs


def _read_columns(res, vec, pairs, quiet=False):
    """Read the time column and every monitored column into lists (GetColumnValues into an IntVec
    is about 300 times faster than reading value by value)."""
    t, cols = [], {}
    res.Load()
    try:
        if res.GetColumnValues(vec, -1) == 0:   # column -1 is time, always in seconds
            t = [float(x) for x in vec.V]
        for o, v in pairs:
            entry = {"y": None, "unit": "", "desc": "", "name": _nm(o), "cls": o.GetClassName()}
            col = res.FindColumn(o, v)
            if col >= 0 and res.GetColumnValues(vec, col) == 0:
                entry["y"] = [float(x) for x in vec.V]
                try:
                    entry["unit"] = str(res.GetUnit(col) or "")
                    entry["desc"] = str(res.GetDescription(col) or "")
                except Exception:
                    pass
            elif not quiet:
                # AddVariable accepts any name, so a wrong one only shows here.
                log(f"PowerFactory did not record {v} for {_nm(o)}: check the variable name for a "
                    f"{_plain(o.GetClassName())}.", "warn")
            cols[(_full(o), v)] = entry
    finally:
        res.Release()
    return t, cols


def _undecided(app, res, vec, pairs, ufls_hz, ufls_below=None):
    """True when a recorded bus frequency (m:fehz) is at its lowest in the last second of the run and
    still above the under-frequency level, so the run cannot yet say whether it recovers."""
    fpairs = [(o, v) for o, v in pairs if v == "m:fehz"]
    if not fpairs:
        return False
    t, cols = _read_columns(res, vec, fpairs, quiet=True)
    for o, v in fpairs:
        y = cols[(_full(o), v)]["y"]
        if not y or not t:
            continue
        i = min(range(len(y)), key=y.__getitem__)
        below = 1.0 if ufls_below is None else float(ufls_below)
        level = float(ufls_hz) if ufls_hz is not None else f_nominal(app, o) - below
        if t[i] >= t[-1] - 1.0 and y[i] > level:
            return True
    return False


def _run_sim(app, kind, tstop, tstart, step, monitors, monitor_lists, net, case_events, fast, extend_to, ufls_hz, ufls_below=None):
    word = "RMS" if kind == "rms" else "EMT"
    run_deferred()
    case = app.GetActiveStudyCase()
    if case is None:
        raise PFError("[MODEL] No study case is active.")
    inc, sim = _command(app, "ComInc"), _command(app, "ComSim")
    evf = _event_folder(app)
    pairs = _flat_monitors(monitors, monitor_lists)
    if len(pairs) > 500:
        _say_once(("manymon", len(pairs)), f"Recording {len(pairs)} curves; the run and the reading take longer.", "warn")
    keep_inc, keep_sim, switched = {}, {}, []
    added, _EVT["added"] = dict(_EVT["added"]), {}
    unbal, _EVT["unbalanced"] = {k for k in _EVT["unbalanced"] if k in added}, set()
    target = float(tstop)
    status, message, t_end, t, cols, in_folder = "no_init", "", None, [], {}, set()
    res = vec = None
    t0 = time.time()
    try:
        want = {"iopt_sim": "rms" if kind == "rms" else "ins"}
        if net in ("sym", "rst"):
            want["iopt_net"] = net
        elif net not in (None, "", "case"):
            _say_once(("simnet", net), f"Network '{net}' is not case, sym or rst; using the case setting.", "warn")
        _put_attrs(inc, keep_inc, want)
        secs = {}
        if tstart is not None:
            secs["tstart"] = float(tstart)
        if step is not None:
            secs["dtgrd" if kind == "rms" else "dtemt"] = float(step)
        _put_attrs(inc, keep_inc, secs, seconds=tuple(secs))
        _put_attrs(sim, keep_sim, {"tstop": target}, seconds=("tstop",))
        if fast:
            prof = {a: 1 for a in ("iopt_fastsol", "iopt_fastout", "systemSolvingMode") if inc.HasAttribute(a)}
            _put_attrs(inc, keep_inc, prof)
            got = {a: inc.GetAttribute(a) for a in prof}
            log(f"Fast solver profile on: {got} (can move a frequency nadir by about 1 mHz).")
        # Events: the workflow's events not added for this run are switched off (they stay for the
        # next pass to update); the case's own events are off for the run when asked, then back on.
        own_off = case_events == "off" or (case_events in ("auto", None, "") and bool(added))
        for ev in evf.GetContents("*.Evt*", 1):
            try:
                on = ev.GetAttribute("outserv") == 0
            except Exception:
                continue
            if ev.loc_name.startswith(PFB):
                in_folder.add(_full(ev))
                if _full(ev) not in added and on:
                    ev.SetAttribute("outserv", 1)
            elif own_off and on:
                ev.SetAttribute("outserv", 1)
                switched.append(ev)
        if switched:
            log(f"The study case's own events are off for this run: {', '.join(_nm(e) for e in switched)}.")
        if unbal and kind == "rms" and str(inc.GetAttribute("iopt_net")) == "sym":
            # Checked live: a balanced RMS run applies a single-phase fault as a three-phase one.
            log("[MODEL] An unbalanced fault is in this run, but the RMS network is balanced (sym), where "
                "PowerFactory applies it as a three-phase fault. Set the network to unbalanced (rst).", "warn")
        res = case.CreateObject("ElmRes", PFB + "res")
        track_created(res, "res")
        # The vector for reading is made before the run: nothing is created in the case between
        # the run and a continuation (extend_to).
        vec = case.CreateObject("IntVec", PFB + "vec")
        track_created(vec, "vec")
        keep_inc.setdefault("p_resvar", (inc.GetAttribute("p_resvar"), False))
        inc.SetAttribute("p_resvar", res)
        for o, v in pairs:
            if res.AddVariable(o, v) != 0:
                log(f"Could not record {v} for {_nm(o)}.", "warn")
        pf_messages(app)
        app.EchoOn()   # ComInc's error text only reaches the message list with echo on
        try:
            rc_inc = inc.Execute()
        finally:
            if not _PF["echo"]:
                app.EchoOff()
        msgs = pf_messages(app)
        if rc_inc != 0:
            errs = [m for m in msgs if m.startswith("Error:")] or msgs
            message = "; ".join(errs[-4:]) or f"code {rc_inc}"
            log(f"[MODEL] The {word} simulation did not initialise (code {rc_inc}): {message}", "warn")
        else:
            app.EchoOff()
            try:
                rc_sim = sim.Execute()
                t_end = sim.GetSimulationTime()
                if extend_to and float(extend_to) > target and rc_sim == 0 and _undecided(app, res, vec, pairs, ufls_hz, ufls_below):
                    log(f"A bus frequency is still at its lowest at {t_end:g} s and above the under-frequency "
                        f"level; continuing the same run to {float(extend_to):g} s.")
                    target = float(extend_to)
                    set_seconds(sim, "tstop", target)
                    rc_sim = sim.Execute()
                    t_end = sim.GetSimulationTime()
            finally:
                if _PF["echo"]:
                    app.EchoOn()
            msgs = pf_messages(app)
            if rc_sim == 0 and t_end is not None and t_end >= target - 1e-6 * max(1.0, abs(target)):
                status = "ok"
            else:
                status = "early"
                errs = [m for m in msgs if m.startswith("Error:")]
                message = "; ".join(errs[-4:]) or f"stopped at {t_end:g} s (code {rc_sim})"
                log(f"[MODEL] The {word} simulation stopped early at {t_end:g} s: {message}", "warn")
            t, cols = _read_columns(res, vec, pairs)
    finally:
        try:
            _restore_attrs(inc, keep_inc)
            _restore_attrs(sim, keep_sim)
        finally:
            for ev in switched:
                try:
                    ev.SetAttribute("outserv", 0)
                except Exception:
                    pass
            if vec is not None:
                try:
                    vec.Delete()   # a vector takes no part in the calculation: no reset needed
                except Exception:
                    pass
                _PF["created"] = [c for c in _PF["created"] if _alive(c["obj"])]
            if res is not None:
                # Deleting needs ResetCalculation, which would also drop the end-of-run values.
                _defer("delete the temporary result file", lambda r=res: delete_created(app, r))
    events = sorted(v for k, v in added.items() if k in in_folder)
    if status == "ok":
        log(f"{word} simulation reached {t_end:g} s ({time.time() - t0:.1f} s, {len(t)} samples).")
    return SimResult(kind, status, t_end, target, message, events, t, cols)
# @end

# @helper run_rms
# @needs sim_run
def run_rms(app, tstop, tstart=None, step=None, monitors=(), monitor_lists=(), net="case",
            case_events="auto", fast=False, extend_to=0, ufls_hz=None, ufls_below=None):
    """Run an RMS simulation (ComInc then ComSim) in the active study case to tstop (s), recording
    monitors [(element, variable)] and monitor_lists [(elements, variable)]. tstart and step (s)
    override the case's settings, whatever time unit the project shows. net "sym" / "rst" overrides
    the network representation (unbalanced faults need "rst"). case_events "off" switches the
    case's own events off for the run, "keep" leaves them on, "auto" switches them off only when
    the workflow added events. fast uses the faster solver profile. extend_to (s) continues the same
    run there when a recorded bus frequency is still at its lowest and above ufls_hz (default:
    nominal minus 1 Hz) at tstop. Returns a SimResult."""
    return _run_sim(app, "rms", tstop, tstart, step, monitors, monitor_lists, net, case_events, fast, extend_to, ufls_hz, ufls_below)
# @end

# @helper run_emt
# @needs sim_run
def run_emt(app, tstop, tstart=None, step=None, monitors=(), monitor_lists=(), net="case",
            case_events="auto", fast=False, extend_to=0, ufls_hz=None, ufls_below=None):
    """Run an EMT simulation (ComInc with EMT then ComSim) in the active study case to tstop (s);
    the same options as run_rms, with step the EMT step (dtemt, s). EMT runs are slow: a 10 us step
    takes seconds per 0.1 s on a 39-bus grid. Raw EMT m:fehz swings wildly during faults (it is a
    measured frequency); remove spikes before using it. Returns a SimResult."""
    return _run_sim(app, "emt", tstop, tstart, step, monitors, monitor_lists, net, case_events, fast, extend_to, ufls_hz, ufls_below)
# @end

# @helper run_harmonic
# @needs log, pf_state, pf_messages, pf_command, track_created
def run_harmonic(app, net="case"):
    """Run a harmonic load flow (ComHldf) in the active study case: net "balanced", "unbalanced"
    or "case". It sets what a script run needs (a result file, and a load flow of the same network
    type, which it runs first) and removes at the end the result files PowerFactory makes on its
    own. THD is then readable on busbars as m:THD (%, m:THD:A per phase when unbalanced). Returns
    ok, rc and messages."""
    run_deferred()
    case = app.GetActiveStudyCase()
    if case is None:
        raise PFError("[MODEL] No study case is active.")
    before = {_full(o) for o in case.GetContents("*.ElmRes")}
    hldf, ldf = _command(app, "ComHldf"), _command(app, "ComLdf")
    keep_h, keep_l = {}, {}
    pf_messages(app)
    try:
        if net in ("balanced", "unbalanced"):
            _put_attrs(hldf, keep_h, {"iopt_net": 0 if net == "balanced" else 1})
        elif net not in (None, "", "case"):
            _say_once(("hnet", net), f"Harmonic network '{net}' is not balanced, unbalanced or case; using the case setting.", "warn")
        hnet = hldf.GetAttribute("iopt_net")
        if hldf.GetAttribute("p_resvar") is None:
            # Without a result file it stops with "No result file provided".
            res = case.CreateObject("ElmRes", PFB + "hldf_res")
            track_created(res, "res")
            _put_attrs(hldf, keep_h, {"p_resvar": res})
        if ldf.GetAttribute("iopt_net") != hnet:
            # A balanced harmonic load flow refuses an unbalanced load flow, and the other way round.
            _put_attrs(ldf, keep_l, {"iopt_net": hnet})
        rc_l = ldf.Execute()
        rc = hldf.Execute() if rc_l == 0 else rc_l
    finally:
        _restore_attrs(hldf, keep_h)
        _restore_attrs(ldf, keep_l)
    msgs = pf_messages(app)
    for o in case.GetContents("*.ElmRes"):
        if _full(o) not in before:
            track_created(o, "res")   # "Harmonics AC balanced/unbalanced" made by the first run
    words = "unbalanced" if hnet == 1 else "balanced"
    if rc == 0:
        log(f"Harmonic load flow done ({words}).")
    else:
        errs = [m for m in msgs if m.startswith("Error:")] or msgs
        what = "the load flow before it did not converge" if rc_l != 0 else f"code {rc}"
        log(f"[MODEL] Harmonic load flow failed ({words}, {what})" + (": " + "; ".join(errs[-3:]) if errs else "") + ".", "warn")
    return StudyResult(rc == 0, rc, msgs, net=words)
# @end

# @helper run_short_circuit
# @needs log, pf_state, pf_messages, pf_command, track_created
_SHC_METHOD = {"vde": 0, "iec": 1, "ansi": 2, "complete": 3, "iec61363": 4}
_SHC_FAULT = {"3ph": "3psc", "3psc": "3psc", "2ph": "2psc", "2psc": "2psc", "1ph": "spgf", "spgf": "spgf",
              "2phg": "2pgf", "2pgf": "2pgf"}


def run_short_circuit(app, method="iec", fault="3ph", current="max", target=None, rf=0.0, xf=0.0):
    """Run a short-circuit calculation (ComShc) in the active study case. method "iec" (IEC 60909),
    "vde", "ansi" or "complete"; fault "3ph", "2ph", "1ph" (to ground) or "2phg"; current "max" or
    "min"; target one element or several (a fault at each), None = every busbar; rf, xf the fault
    impedance (Ohm). Results such as m:Ikss (kA), m:Skss (MVA) and m:ip (kA) are then readable on the
    faulted busbars (ANSI gives other result names). Returns ok, rc and messages."""
    run_deferred()
    shc = _command(app, "ComShc")
    m = _SHC_METHOD.get(str(method).lower())
    f = _SHC_FAULT.get(str(fault).lower())
    if m is None or f is None:
        raise PFError(f"[CODE] Short circuit method '{method}' or fault type '{fault}' is not known.")
    want = {"iopt_mde": m, "iopt_shc": f, "iopt_cur": 1 if str(current).lower() == "min" else 0,
            "Rf": float(rf or 0.0), "Xf": float(xf or 0.0)}
    objs = [] if target is None else (list(target) if isinstance(target, (list, tuple)) else [target])
    if not objs:
        want["iopt_allbus"] = 2
        where = "every busbar"
    elif len(objs) == 1:
        want.update(iopt_allbus=0, shcobj=objs[0])
        where = _nm(objs[0])
    else:
        case = app.GetActiveStudyCase()
        hits = case.GetContents(PFB + "shc_select.SetSelect")
        sel = hits[0] if hits else case.CreateObject("SetSelect", PFB + "shc_select")
        track_created(sel, "select")
        sel.Clear()
        sel.AddRef(objs)
        want.update(iopt_allbus=0, shcobj=sel)
        where = f"{len(objs)} elements"
    keep = {}
    pf_messages(app)
    try:
        _put_attrs(shc, keep, want)
        rc = shc.Execute()
    finally:
        _restore_attrs(shc, keep)
    msgs = pf_messages(app)
    name = {0: "VDE 0102", 1: "IEC 60909", 2: "ANSI", 3: "complete", 4: "IEC 61363"}[m]
    if rc == 0:
        log(f"Short circuit done ({name}, {f}, {'min' if want['iopt_cur'] else 'max'}, at {where}).")
    else:
        errs = [x for x in msgs if x.startswith("Error:")] or msgs
        log(f"[MODEL] Short circuit failed ({name}, code {rc})" + (": " + "; ".join(errs[-3:]) if errs else "") + ".", "warn")
    return StudyResult(rc == 0, rc, msgs, method=name, fault=f)
# @end

# @helper add_short_circuit
# @needs log, pf_events
# EvtShc.i_shc codes, checked live with phase voltages during the fault (unbalanced RMS):
# 0 three-phase, 1 two-phase (a-b), 2 single-phase to ground (a), 3 two-phase to ground (a, b),
# 4 clears the fault. i_clearShc does NOT clear a fault in RMS or EMT.
_SHC_CODE = {"3ph": 0, "2ph": 1, "1ph": 2, "2phg": 3}
_SHC_PHASE = {"1ph": ("i_pspgf", {"a": 0, "b": 1, "c": 2}), "2ph": ("i_p2psc", {"ab": 0, "bc": 1, "ca": 2}),
              "2phg": ("i_p2pgf", {"ab": 0, "bc": 1, "ca": 2})}


def add_short_circuit(app, key, target, t, duration=None, rf=0.0, xf=0.0, location=None, clear="fault",
                      fault="3ph", phase=None):
    """Add a short circuit on a busbar or line at t (s), cleared after duration (s; None or 0 =
    not cleared). rf, xf: fault impedance (Ohm); location: % along a line. clear "fault" clears the
    fault (EvtShc code 4); "trip" also opens the faulted line at the clearing time (EvtSwitch), the
    usual topology after a line fault. fault "3ph", "2ph", "1ph" (to ground) or "2phg" (unbalanced
    faults need an RMS run with net "rst"); phase picks the phases ("a" / "b" / "c" for 1ph, "ab" /
    "bc" / "ca" otherwise). Returns (t_fault, t_clear)."""
    code = _SHC_CODE.get(str(fault).lower())
    if code is None:
        raise PFError(f"[CODE] Fault type '{fault}' is not one of {', '.join(_SHC_CODE)}.")
    tgt = target[0] if isinstance(target, (list, tuple)) and len(target) == 1 else target
    attrs = {"i_shc": code, "R_f": float(rf or 0.0), "X_f": float(xf or 0.0)}
    if phase and str(fault).lower() in _SHC_PHASE:
        attr, table = _SHC_PHASE[str(fault).lower()]
        if str(phase).lower() not in table:
            raise PFError(f"[CODE] Phase '{phase}' is not one of {', '.join(table)} for a {fault} fault.")
        attrs[attr] = table[str(phase).lower()]
    is_line = getattr(tgt, "GetClassName", lambda: "")() == "ElmLne"
    if location is not None:
        if is_line:
            attrs["shcLocation"] = float(location)
        else:
            _say_once(("shcloc", _nm(tgt)), f"A fault location in % only applies to a line; {_nm(tgt)} is not one.", "warn")
    t_fault = float(t)
    ev = _event_put(app, key, "on", "EvtShc", tgt, t_fault, f"{fault} fault at {_nm(tgt)}", attrs)
    if code != 0:
        _EVT["unbalanced"].add(_full(ev))
    else:
        _EVT["unbalanced"].discard(_full(ev))
    t_clear = None
    if duration is not None and float(duration) > 0:
        t_clear = t_fault + float(duration)
        _event_put(app, key, "off", "EvtShc", tgt, t_clear, f"Fault at {_nm(tgt)} cleared", {"i_shc": 4})
        if clear == "trip":
            if is_line or getattr(tgt, "GetClassName", lambda: "")() in ("ElmTr2", "ElmTr3", "ElmCoup"):
                _event_put(app, key, "trip", "EvtSwitch", tgt, t_clear, f"{_nm(tgt)} opened", {"i_switch": 0, "i_allph": 1})
            else:
                _say_once(("shctrip", _nm(tgt)), f"Clearing by tripping needs a line or transformer; {_nm(tgt)} "
                          "is a busbar, so the fault is only cleared.", "warn")
    log(f"Event: {fault} fault at {_nm(tgt)} at {t_fault:g} s" + (f", cleared at {t_clear:g} s" if t_clear is not None else ", not cleared")
        + (" with the line opened" if t_clear is not None and clear == "trip" and is_line else "") + ".")
    return t_fault, t_clear
# @end

# @helper add_switch_event
# @needs log, pf_events
def add_switch_event(app, key, element, t, action="open"):
    """Open (or close, action "close") a breaker, switch or whole element (all phases) at t (s).
    Returns t."""
    close = str(action).lower() == "close"
    tgt = element[0] if isinstance(element, (list, tuple)) and len(element) == 1 else element
    _event_put(app, key, "switch", "EvtSwitch", tgt, float(t), f"{'Close' if close else 'Open'} {_nm(tgt)}",
               {"i_switch": 1 if close else 0, "i_allph": 1})
    log(f"Event: {'close' if close else 'open'} {_nm(tgt)} at {float(t):g} s.")
    return float(t)
# @end

# @helper add_contingency_events
# @needs add_switch_event
def add_contingency_events(app, key, cont, t):
    """For a contingency in a simulation: open each of its elements at t (s), one switch event per
    element. A contingency with fewer elements than the previous pass leaves the extra events off.
    Returns t."""
    els = getattr(cont, "elements", None)
    els = list(els) if els is not None else (list(cont) if isinstance(cont, (list, tuple)) else [cont])
    for i, e in enumerate(els, 1):
        add_switch_event(app, f"{key}_{i}", e, t, "open")
    return float(t)
# @end

# @helper add_trip
# @needs log, pf_events, pf_get
_TRIP_P = {"ElmSym": "pgini", "ElmGenstat": "pgini", "ElmPvsys": "pgini", "ElmAsm": "pgini", "ElmVsc": "psetp",
           "ElmLod": "plini"}


def add_trip(app, key, element, t, units="all", n=None):
    """Trip a generator (or open any element) at t (s) with a switch event that opens it on all
    phases. Returns the MW tripped, from the dispatch (input data, known before any calculation:
    P per machine x parallel machines); for a load its active power; None for other elements.
    units "some" (n of the parallel machines) is refused: PowerFactory 2024 ignores the machine
    outage event (EvtSym) in RMS (tested with 1 and with all machines)."""
    tgt = element[0] if isinstance(element, (list, tuple)) and len(element) == 1 else element
    if tgt is None or isinstance(tgt, (list, tuple)):
        raise PFError("[CODE] A trip needs one element.")
    cls = tgt.GetClassName()
    if str(units).lower() == "some":
        raise PFError(f"[MODEL] Tripping only some of the parallel machines of {_nm(tgt)} is not possible: "
                      "PowerFactory 2024 ignores the machine outage event (EvtSym) in a simulation. Trip the "
                      "whole unit, or model the machines as separate generators.")
    per = None
    if cls in _TRIP_P:
        per = pf_get(tgt, _TRIP_P[cls], "MW")
    try:
        ngnum = max(1, int(tgt.GetAttribute("ngnum")))
    except Exception:
        ngnum = 1
    _event_put(app, key, "trip", "EvtSwitch", tgt, float(t), f"Trip {_nm(tgt)}", {"i_switch": 0, "i_allph": 1})
    mw = per * (ngnum if cls != "ElmLod" else 1) if per is not None else None
    log(f"Event: trip {_nm(tgt)} at {float(t):g} s" + (f" ({mw:g} MW)." if mw is not None else "."))
    return mw
# @end

# @helper add_load_step
# @needs log, pf_events
def add_load_step(app, key, load, t, dp=0.0, dq=0.0):
    """Step a load's active and reactive power by dp and dq PERCENT of its value at t (s), with a
    load event (EvtLod). A parameter event on plini does nothing in a simulation. Returns t."""
    tgt = load[0] if isinstance(load, (list, tuple)) and len(load) == 1 else load
    if getattr(tgt, "GetClassName", lambda: "")() != "ElmLod":
        raise PFError(f"[MODEL] A load step needs a load (ElmLod), not {_nm(tgt)}.")
    _event_put(app, key, "load", "EvtLod", tgt, float(t), f"Load step {_nm(tgt)} {float(dp):+g} %",
               {"dP": float(dp or 0.0), "dQ": float(dq or 0.0)})
    log(f"Event: load step at {_nm(tgt)} at {float(t):g} s (P {float(dp):+g} %, Q {float(dq):+g} %).")
    return float(t)
# @end

# @helper param_initial
def _param_initial(obj, param):
    """The value a DSL parameter (ElmDsl params, named by parameterNames) or an attribute has now."""
    if obj.GetClassName() == "ElmDsl":
        try:
            names = []
            for s in obj.GetAttribute("parameterNames") or []:
                names += [x.strip() for x in str(s).split(",")]
            vals = list(obj.GetAttribute("params") or [])
            if param in names and names.index(param) < len(vals):
                return float(vals[names.index(param)])
        except Exception:
            pass
    try:
        return float(obj.GetAttribute(param))
    except Exception:
        return None


# @end

# @helper add_param_event
# @needs log, pf_events, param_initial
def add_param_event(app, key, element, t, param, value, mode="absolute"):
    """Change a parameter of a DSL model (such as a voltage or power set point) at t (s) with a
    parameter event (EvtParam). mode "absolute" sets value, "add" adds it to the parameter's
    initial value, "times" multiplies the initial value by it. Returns t."""
    tgt = element[0] if isinstance(element, (list, tuple)) and len(element) == 1 else element
    v = float(value)
    if mode in ("add", "times"):
        init = _param_initial(tgt, param)
        if init is None:
            raise PFError(f"[MODEL] Could not read the initial value of {param} of {_nm(tgt)}; use mode absolute.")
        v = init + v if mode == "add" else init * v
    elif mode != "absolute":
        raise PFError(f"[CODE] Parameter event mode '{mode}' is not absolute, add or times.")
    text = f"{v:.10g}"   # EvtParam takes the new value as text
    _event_put(app, key, "param", "EvtParam", tgt, float(t), f"{param} = {text} on {_nm(tgt)}",
               {"variable": str(param), "value": text})
    log(f"Event: {param} of {_nm(tgt)} set to {text} at {float(t):g} s.")
    return float(t)
# @end

# @helper add_param_steps
# @needs log, pf_events, param_initial
def add_param_steps(app, key, element, param, steps, mode="absolute"):
    """Change one value of an element at several times in the next simulation: one parameter
    event (EvtParam) per step, so the value holds until the next one.

    steps is [(t, value), ...], times in seconds and values in the parameter's own unit; they are
    put in time order. mode "absolute" sets the value, "add" adds it to the value the parameter
    has now and "times" multiplies that value by it. Returns (the first time, the last time)."""
    tgt = element[0] if isinstance(element, (list, tuple)) and len(element) == 1 else element
    rows = sorted(((float(t), float(v)) for t, v in steps), key=lambda r: r[0])
    if not rows:
        raise PFError("[CODE] A list of parameter steps needs at least one step.")
    base = None
    if mode in ("add", "times"):
        base = _param_initial(tgt, param)
        if base is None:
            raise PFError(f"[MODEL] Could not read the value of {param} of {_nm(tgt)}; use mode absolute.")
    elif mode != "absolute":
        raise PFError(f"[CODE] Parameter event mode '{mode}' is not absolute, add or times.")
    for k, (t, v) in enumerate(rows, 1):
        val = v if base is None else (base + v if mode == "add" else base * v)
        text = f"{val:.10g}"   # EvtParam takes the new value as text
        _event_put(app, key, f"p{k}", "EvtParam", tgt, t, f"{param} = {text} on {_nm(tgt)}",
                   {"variable": str(param), "value": text})
    log(f"Events: {param} of {_nm(tgt)} steps to " + ", ".join(f"{v:g} at {t:g} s" for t, v in rows) + ".")
    return rows[0][0], rows[-1][0]
# @end
