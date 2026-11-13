# Workflow Builder runtime: the PSCAD studies (build, run, read the results, snapshots,
# simulation sets, and the fault and switching components an EMT case uses instead of events).
#
# Same section format as base.py. Checked on a live PSCAD 5.0.0 engine with Automation
# Library 2.9.7, on the tutorial and HVDC example cases.
#
# PSCAD is an EMT simulator: there is no load flow, no short-circuit calculation and no
# frequency-domain harmonic scan to run, and no event list to fill. A fault, a trip or a
# set-point change is a component already in the model whose timing this script writes, and
# harmonics come out of the time-domain result (see signals.py: thd, spectrum).

# @helper px_result
# @needs log, px_state, px_messages
class BuildResult(object):
    """What a build did: .ok, .errors, .warnings, .messages, .seconds."""

    __slots__ = ("ok", "errors", "warnings", "messages", "seconds", "project")

    def __init__(self, ok, errors, warnings, messages, seconds, project=""):
        self.ok, self.seconds, self.project = bool(ok), float(seconds), str(project)
        self.errors, self.warnings = list(errors), list(warnings)
        self.messages = list(messages)

    def __bool__(self):
        return self.ok

    def __repr__(self):
        return ("BuildResult(%s, %d errors, %d warnings, %.1fs)"
                % ("ok" if self.ok else "failed", len(self.errors), len(self.warnings),
                   self.seconds))


def _split_messages(lines):
    """(errors, warnings) out of the plain message lines px_messages gives."""
    errors = [m[len("Error:"):].strip() for m in lines if m.startswith("Error:")]
    warnings = [m[len("Warning:"):].strip() for m in lines if m.startswith("Warning:")]
    return errors, warnings
# @end

# @helper px_build
# @needs log, px_state, px_messages, px_result
# @imports import time
def px_build(app, prj=None, clean=False, force=False):
    """Compile the project with its Fortran compiler and say how it went.

    A PSCAD case is Fortran that EMTDC compiles before it can run, so a build is a step of
    its own with its own errors: a floating input, a missing signal, a component that does
    not fit. `clean` throws away the previous build first (slower, and the honest thing
    after changing a component's definition). `force` builds again even when this run has
    built the project already."""
    prj = prj if prj is not None else _PX["project"]
    name = str(getattr(prj, "name", "") or "")
    if not force and not clean and name in _PX["built"]:
        log("Project %s is already built in this run." % name, "info")
        return BuildResult(True, [], [], [], 0.0, name)
    run_deferred()
    started = time.time()
    try:
        if clean:
            prj.clean()
        prj.build()
    except Exception as err:
        lines = px_messages(prj)
        errors, warnings = _split_messages(lines)
        errors.append(str(err))
        log("Build of %s failed: %s" % (name, errors[0]), "warn")
        return BuildResult(False, errors, warnings, lines, time.time() - started, name)
    lines = px_messages(prj)
    errors, warnings = _split_messages(lines)
    ok = not errors
    if ok:
        _PX["built"].add(name)
        log("Built %s in %.1fs%s." % (name, time.time() - started,
                                      (", %d warning%s" % (len(warnings),
                                                           "" if len(warnings) == 1 else "s"))
                                      if warnings else ""), "info")
    else:
        log("[MODEL] %s did not build: %s%s"
            % (name, errors[0], (" (and %d more)" % (len(errors) - 1))
               if len(errors) > 1 else ""), "warn")
    return BuildResult(ok, errors, warnings, lines, time.time() - started, name)
# @end

# @helper sim_settings
# @needs log, px_state, px_set, px_value, units
def sim_settings(app, prj=None, duration=None, step=None, plot_step=None,
                 plot_format=None, output=None, record=True, **extra):
    """Write the simulation settings of the project and give back what they now are.

    `duration` is in seconds; `step` and `plot_step` are in microseconds, as PSCAD shows
    them (50 us is the usual EMT step, 250 us a usual plot step). `plot_format` is "OUT"
    (text files the script reads), "PSOUT" (PSCAD's own binary) or "NONE". Anything else
    goes through as a project parameter."""
    prj = prj if prj is not None else _PX["project"]
    want = {}
    if duration is not None:
        want["time_duration"] = float(px_number(duration, 0.0))
    if step is not None:
        want["time_step"] = _as_micros(step)
    if plot_step is not None:
        want["sample_step"] = _as_micros(plot_step)
    if plot_format is not None:
        want["PlotType"] = str(plot_format).upper()
    if output is not None:
        name = str(output)
        want["output_filename"] = name if name.lower().endswith(".out") else (name + ".out")
    want.update(extra)
    for key, value in want.items():
        px_set(prj, key, value, record=record)
    if want:
        shown = ", ".join("%s=%s" % (k, v) for k, v in sorted(want.items()))
        log("Simulation settings: %s." % shown, "info")
    try:
        return dict(prj.parameters() or {})
    except Exception:
        return want


def _as_micros(value):
    """A time step in microseconds, whether it was given as "50", "50 us" or "0.00005 s"."""
    num, unit = px_split_value(value)
    if num is None:
        raise PXError("[CODE] A time step has to be a number; %r was given." % (value,))
    if unit:
        factor = unit_factor(unit, "us")
        if factor is not None:
            return num * factor
        log("A time step in [%s] cannot be read as microseconds; %g was used as it is."
            % (unit, num), "warn")
    return num
# @end

# @helper px_channels
# @needs log, px_state, px_names
# @imports import os
# @imports import re
_INF_LINE = re.compile(r'PGB\((\d+)\)\s+(\w+)\s*(.*)$')
_INF_KEY = re.compile(r'(\w+)\s*=\s*"([^"]*)"|(\w+)\s*=\s*([^\s]+)')


def read_inf(path):
    """The channel index PSCAD writes beside its .out files, in channel order.

    Each entry is a record with .index (1 upwards), .name, .group, .unit, .lo and .hi.
    The index is what decides which .out file and column a channel lands in: PSCAD puts
    ten channels in a file, so channel 11 is the first column of <stem>_02.out."""
    out = []
    if not path or not os.path.exists(path):
        return out
    with open(path, "r", errors="replace") as fh:
        for line in fh:
            m = _INF_LINE.match(line.strip())
            if not m:
                continue
            fields = {}
            for key1, val1, key2, val2 in _INF_KEY.findall(m.group(3) or ""):
                fields[(key1 or key2).lower()] = val1 if key1 else val2
            out.append(_Bag(index=int(m.group(1)), kind=m.group(2),
                            name=fields.get("desc", "") or ("PGB(%s)" % m.group(1)),
                            group=fields.get("group", ""),
                            unit=fields.get("units", ""),
                            lo=_as_num(fields.get("min")), hi=_as_num(fields.get("max"))))
    out.sort(key=lambda c: c.index)
    return out


def _as_num(text):
    try:
        return float(text)
    except (TypeError, ValueError):
        return None


def read_out(folder, stem, channels=None):
    """Read PSCAD's .out files into (times, {channel index: values}).

    An .out file is plain text: a title line, then one row per sample whose first number
    is the time in seconds and whose next ten are channels. PSCAD splits the channels over
    <stem>_01.out, <stem>_02.out and so on, ten to a file, all with the same time column."""
    times, cols = [], {}
    index = 1
    while True:
        path = os.path.join(folder, "%s_%02d.out" % (stem, index))
        if not os.path.exists(path):
            break
        rows = _read_out_file(path)
        if not rows:
            index += 1
            continue
        if not times:
            times = [r[0] for r in rows]
        width = max(len(r) for r in rows) - 1
        for c in range(width):
            number = (index - 1) * 10 + c + 1
            if channels is not None and number not in channels:
                continue
            cols[number] = [(r[c + 1] if len(r) > c + 1 else float("nan")) for r in rows]
        index += 1
    if not times:
        log("No .out file was found for %s in %s. The project's Output format has to be "
            "OUT and the signals need output channels." % (stem, folder), "warn")
    return times, cols


def _read_out_file(path):
    """The numeric rows of one .out file; the title line and anything unreadable is skipped."""
    rows = []
    with open(path, "r", errors="replace") as fh:
        for line in fh:
            parts = line.split()
            if not parts:
                continue
            try:
                rows.append([float(p) for p in parts])
            except ValueError:
                continue
    return rows


def out_paths(app, prj=None):
    """(folder, stem, inf path) where this project's run writes its result files."""
    prj = prj if prj is not None else _PX["project"]
    try:
        folder = prj.temp_folder
    except Exception as err:
        raise PXError("[MODEL] Could not find the project's build folder: %s" % err)
    try:
        name = str((prj.parameters() or {}).get("output_filename") or "")
    except Exception:
        name = ""
    own = str(getattr(prj, "name", "") or "out")
    stem = os.path.splitext(os.path.basename(name))[0] or own
    # A new PSCAD 5 case names its output "$(Namespace).out": PSCAD writes the project's own
    # name there, so the files to read are <project>_01.out and <project>.inf.
    stem = re.sub(r"\$\(\s*namespace\s*\)", lambda m: own, stem, flags=re.IGNORECASE)
    if "$(" in stem:
        stem = own
    return folder, stem, os.path.join(folder, stem + ".inf")
# @end

# @helper px_simresult
# @needs log, px_state, Series, px_channels, px_value
class SimResult(object):
    """What one EMT run produced, and the way to read its channels.

    `.status` is "ok" when EMTDC reached the end, "early" when it stopped before the time
    it was given, and "failed" when the build or the start failed. `.series(name)` gives a
    Series of one output channel by its name in PSCAD; `.channels` lists what the run
    recorded."""

    __slots__ = ("status", "messages", "t_end", "duration", "events", "channels",
                 "_times", "_cols", "_by_name", "project", "build")

    def __init__(self, status, messages, duration, events=None, channels=(),
                 times=(), cols=None, project="", build=None):
        self.status, self.messages = str(status), list(messages)
        self.duration = float(duration or 0.0)
        self.events = [(float(t), str(label)) for t, label in (events or [])]
        self.channels = list(channels)
        self._times, self._cols = list(times), dict(cols or {})
        self.project, self.build = str(project), build
        self.t_end = self._times[-1] if self._times else 0.0
        self._by_name = {}
        for ch in self.channels:
            self._by_name.setdefault(str(ch.name).strip().lower(), ch)

    @property
    def ok(self):
        return self.status == "ok"

    @property
    def reached_end(self):
        return self.status == "ok"

    def __bool__(self):
        return self.ok

    @property
    def message(self):
        """The last thing EMTDC said that was not ordinary progress."""
        bad = [m for m in self.messages if m.startswith(("Error:", "Warning:"))]
        return bad[-1] if bad else (self.messages[-1] if self.messages else "")

    def names(self):
        """The names of the channels the run recorded."""
        return [str(c.name) for c in self.channels]

    def has(self, name):
        """Whether a channel of this name was recorded."""
        return str(name).strip().lower() in self._by_name

    def series(self, name, label=""):
        """One output channel as a Series (t in seconds, y in the channel's own unit).

        A name the run did not record gives an empty Series and one warning, never an
        error, so a workflow that reads four channels still reports the three it got."""
        key = str(name).strip().lower()
        ch = self._by_name.get(key)
        if ch is None:
            near = _closest(str(name), self.names())
            _say_once('The run recorded no channel called "%s".%s' %
                      (name, ("\n  It recorded: " + ", ".join(near)) if near
                       else ("\n  It recorded nothing. Add an output channel to the signal "
                             "in PSCAD.")), "warn")
            return Series([], [], label or str(name), "", self.events)
        values = self._cols.get(ch.index)
        if values is None:
            _say_once('Channel "%s" is in the index but not in the .out files; the run may '
                      "have stopped before it wrote them." % name, "warn")
            return Series([], [], label or str(name), ch.unit, self.events)
        return Series(self._times, values, label or str(ch.name), ch.unit, self.events)

    def series_all(self, pattern="*", label=""):
        """Every channel whose name matches, as a list of Series."""
        import fnmatch
        low = str(pattern or "*").lower()
        return [self.series(c.name, label) for c in self.channels
                if fnmatch.fnmatch(str(c.name).lower(), low)]

    def series_combined(self, names, combine="mean", label=""):
        """Several channels brought together into one Series, point by point.

        `combine` is sum, mean, min, max or spread (the highest minus the lowest)."""
        got = [self.series(n) for n in (names or [])]
        got = [s for s in got if len(s)]
        if not got:
            return Series([], [], label or "combined", "", self.events)
        n = min(len(s) for s in got)
        how = str(combine or "mean").lower()
        ys = []
        for i in range(n):
            row = [s.y[i] for s in got]
            if how == "sum":
                ys.append(sum(row))
            elif how == "min":
                ys.append(min(row))
            elif how == "max":
                ys.append(max(row))
            elif how == "spread":
                ys.append(max(row) - min(row))
            else:
                ys.append(sum(row) / len(row))
        return Series(got[0].t[:n], ys, label or ("%s of %d channels" % (how, len(got))),
                      got[0].unit, self.events)

    def __repr__(self):
        return ("SimResult(%s, %d channels, %d samples, t_end=%.4gs)"
                % (self.status, len(self.channels), len(self._times), self.t_end))
# @end

# @helper px_run
# @needs log, px_state, px_messages, px_build, sim_settings, px_channels, px_simresult, px_names, px_find
# @imports import os
# @imports import time
_PX_RUN_OK = ("simulation has ended. status code = 0", "emtdc run completed")


def px_run(app, duration=None, step=None, plot_step=None, prj=None, events=(),
           channels=None, build="auto", read="out", snapshot=None, from_snapshot="",
           keep_files=False):
    """Build the project if it needs it, run the EMT simulation, and read the channels back.

    `duration` is in seconds, `step` and `plot_step` in microseconds. `events` is the list
    of (time, label) the workflow set on the model's fault and switching components, so the
    checks can find the event time and the graphs can mark it. `build` "auto" builds once
    per run of the script, "always" every time, "never" not at all. `read` "out" reads
    PSCAD's text result files, "curves" reads the samples straight off the project's
    graphs, "none" skips reading. `snapshot` a time in seconds saves a snapshot there;
    `from_snapshot` a file name starts from one."""
    prj = prj if prj is not None else _PX["project"]
    name = str(getattr(prj, "name", "") or "")

    want = {}
    if read == "out":
        want["plot_format"] = "OUT"
    if snapshot is not None:
        want["SnapType"] = "ONLY_ONCE"
        want["SnapTime"] = float(px_number(snapshot, 0.0))
        want["snapshot_filename"] = "%s.snp" % (px_clean_name(name) or "snap")
        _PX.setdefault("snap_at", {})[want["snapshot_filename"]] = want["SnapTime"]
    # snapshot_use() makes the runs after it start from a snapshot until snapshot_off(), so a
    # run given neither argument keeps that start rather than going back to zero.
    sticky = (_PX.get("snap_start") or {}).get(name, "")
    if from_snapshot or (snapshot is None and sticky):
        want["StartType"] = "FROM_SNAP_FILE"
        want["startup_filename"] = str(from_snapshot or sticky)
    elif snapshot is None:
        want["StartType"] = "STANDARD"
    sim_settings(app, prj, duration=duration, step=step, plot_step=plot_step, **want)

    built = None
    if build != "never":
        built = px_build(app, prj, force=(build == "always"))
        if not built.ok:
            return SimResult("failed", built.messages, 0.0, events, project=name, build=built)

    folder, stem, inf = out_paths(app, prj)
    if read == "out" and not keep_files:
        _clear_out(folder, stem)
    # A run from a snapshot carries on at the snapshot's time, but PSCAD's result files
    # count their time from the start of that run. The snapshot's own time is read now
    # (this run may write the same file again) and added to the times afterwards, so the
    # samples sit where the case's faults and switchings are timed.
    start_at = _snapshot_start(prj, folder)

    started = time.time()
    try:
        prj.run()
    except Exception as err:
        lines = px_messages(prj)
        log("[MODEL] The run of %s did not finish: %s" % (name, err), "warn")
        return SimResult("failed", lines + ["Error: %s" % err], time.time() - started,
                         events, project=name, build=built)
    took = time.time() - started
    lines = px_messages(prj)
    status = _run_status(prj, lines)
    log("Ran %s in %.1fs (%s)." % (name, took, status),
        "info" if status == "ok" else "warn")
    if status != "ok":
        bad = [m for m in lines if m.startswith("Error:")]
        if bad:
            log("[MODEL] EMTDC said: %s" % bad[-1][len("Error:"):].strip(), "warn")

    chans, times, cols = [], [], {}
    if read == "out":
        chans = read_inf(inf)
        times, cols = read_out(folder, stem, channels)
        if not keep_files:
            defer("remove the result files of %s" % name, lambda: _clear_out(folder, stem))
    elif read == "curves":
        chans, times, cols = read_curves(app, prj)
    if start_at and times and times[0] < 0.5 * start_at:
        times = [t + start_at for t in times]
        log("The run started from a snapshot taken at %gs; its times are counted from the "
            "case's own start, as its events are." % start_at, "info")
    return SimResult(status, lines, took, events, chans, times, cols, name, built)


def _snapshot_start(prj, folder):
    """The time (s) of the snapshot the next run starts from, or 0.0 for a standard start.

    The snapshot file says so itself: its second line holds the EMTDC version, the time
    and the time step. For a file that cannot be read it is the time this script saved the
    snapshot at, when it did."""
    try:
        params = prj.parameters() or {}
    except Exception:
        return 0.0
    if str(params.get("StartType") or "").upper() not in ("FROM_SNAP_FILE", "1"):
        return 0.0
    name = str(params.get("startup_filename") or "").strip()
    if not name:
        return 0.0
    path = name if os.path.isabs(name) else os.path.join(str(folder or ""), name)
    try:
        with open(path, "r", errors="replace") as fh:
            for _ in range(8):
                line = fh.readline()
                if not line:
                    break
                if not line.strip() or line.lstrip().startswith("!"):
                    continue
                return float(line.split()[1])
    except Exception:
        pass
    known = (_PX.get("snap_at") or {}).get(name)
    if known is not None:
        return float(known)
    log("The time of the snapshot %s could not be read, so the times of this run are "
        "counted from the start of the run, not of the case." % name, "warn")
    return 0.0


def _run_status(prj, lines):
    """"ok" when EMTDC reached the end, else "early"."""
    try:
        text = (prj.output() or "").lower()
    except Exception:
        text = ""
    if any(flag in text for flag in _PX_RUN_OK):
        return "ok"
    if any(m.startswith("Error:") for m in lines):
        return "early"
    return "ok" if text else "early"


def _clear_out(folder, stem):
    """Take away the .out and .inf files of a previous run so a short one cannot be read
    as a long one."""
    gone = 0
    try:
        names = os.listdir(folder)
    except Exception:
        return 0
    for fn in names:
        low = fn.lower()
        if not low.startswith(stem.lower()):
            continue
        if low.endswith(".inf") or (low.endswith(".out") and "_" in low):
            try:
                os.remove(os.path.join(folder, fn))
                gone += 1
            except Exception:
                pass
    return gone


def read_curves(app, prj=None):
    """Read the samples straight off the project's graphs: (channels, times, {index: values}).

    This needs the signals to be drawn on a graph in PSCAD, and gives back exactly what the
    graph shows. Reading the .out files instead needs only an output channel, which is why
    that is the usual route."""
    prj = prj if prj is not None else _PX["project"]
    chans, times, cols = [], [], {}
    index = 0
    try:
        found = [c for c in _page_components(prj) if _defn_of(c) == "Curve"]
    except Exception as err:
        log("Could not find the project's graph curves: %s" % err, "warn")
        return chans, times, cols
    for curve in found:
        try:
            params = curve.parameters() or {}
            name = str(params.get("Name") or "").strip() or ("Curve %d" % (index + 1))
            dom = list(curve.domain())
            values = list(curve.trace(0))
        except Exception as err:
            log("Could not read a curve: %s" % err, "warn")
            continue
        if not dom or not values:
            continue
        index += 1
        if not times:
            times = [float(v) for v in dom]
        cols[index] = [float(v) for v in values]
        chans.append(_Bag(index=index, kind="Output", name=name,
                          group=str(params.get("Group") or ""),
                          unit=str(params.get("Units") or ""),
                          lo=px_number(params.get("Min")), hi=px_number(params.get("Max"))))
    log("Read %d curve%s off the project's graphs." % (len(chans), "" if len(chans) == 1
                                                       else "s"), "info")
    return chans, times, cols
# @end

# @helper snapshots
# @needs log, px_state, px_set, px_value, sim_settings, px_names
# @imports import os
def snapshot_save(app, at, prj=None, filename=""):
    """Have the next run save a snapshot at `at` seconds, and give back the file name.

    A snapshot is the whole state of the case at one instant. Every later run can start
    from it, which is how a long EMT study avoids simulating the same start-up again for
    each case: initialise once, snapshot, then branch."""
    prj = prj if prj is not None else _PX["project"]
    name = str(filename or "").strip()
    if not name:
        name = "%s.snp" % (px_clean_name(str(getattr(prj, "name", "snap"))) or "snap")
    if not name.lower().endswith(".snp"):
        name += ".snp"
    sim_settings(app, prj, SnapType="ONLY_ONCE", SnapTime=float(px_number(at, 0.0)),
                 snapshot_filename=name)
    _PX.setdefault("snap_at", {})[name] = float(px_number(at, 0.0))
    log("The next run saves a snapshot at %gs as %s." % (px_number(at, 0.0), name), "info")
    return name


def snapshot_use(app, filename, prj=None):
    """Have the next runs start from a snapshot file, and give its full path back."""
    prj = prj if prj is not None else _PX["project"]
    name = str(filename or "").strip()
    if not name:
        raise PXError("[CODE] snapshot_use was given no snapshot file name.")
    if not name.lower().endswith(".snp"):
        name += ".snp"
    try:
        folder = prj.temp_folder
    except Exception:
        folder = ""
    full = os.path.join(folder, name) if folder else name
    if folder and not os.path.exists(full):
        log("The snapshot %s is not there yet. Run once with a snapshot time first, or the "
            "run will start from zero." % full, "warn")
    sim_settings(app, prj, StartType="FROM_SNAP_FILE", startup_filename=name,
                 SnapType="NONE")
    _PX.setdefault("snap_start", {})[str(getattr(prj, "name", "") or "")] = name
    log("Runs now start from the snapshot %s." % name, "info")
    return full


def snapshot_off(app, prj=None):
    """Go back to starting runs from zero."""
    prj = prj if prj is not None else _PX["project"]
    sim_settings(app, prj, StartType="STANDARD", SnapType="NONE")
    _PX.setdefault("snap_start", {}).pop(str(getattr(prj, "name", "") or ""), None)
    log("Runs start from zero again.", "info")
    return True
# @end

# @helper simsets
# @needs log, px_state, px_names, track_created, px_messages, px_result, px_value
# @imports import time
def simset_create(app, name="", projects=(), volley=1, keep=False):
    """Make a simulation set of project tasks and give it back.

    A simulation set is PSCAD's own way to run several cases in one go, and `volley` says
    how many of them run at the same time. That is the one place a PSCAD study gets real
    parallelism: four volleys of a 60-second EMT case finish in about the time of one."""
    name = px_clean_name(name or "PXB_set")
    try:
        if name in list(app.simulation_sets() or []):
            app.remove_simulation_set(name)
    except Exception:
        pass
    try:
        simset = app.create_simulation_set(name)
    except Exception as err:
        raise PXError('[MODEL] Could not create the simulation set "%s": %s' % (name, err))
    track_created(simset, kind="simset", keep=keep, name=name)
    wanted = list(projects) or ([_PX["project"]] if _PX["project"] is not None else [])
    simset_add(app, simset, wanted)
    if volley and int(volley) > 1:
        simset_volley(app, simset, int(volley))
    log("Simulation set %s holds %d task%s." % (name, len(simset.list_tasks() or []),
                                                "" if len(simset.list_tasks() or []) == 1
                                                else "s"), "info")
    return simset


def simset_add(app, simset, projects):
    """Add projects to a simulation set as tasks, and give the task names back.

    PSCAD 5.0.0's automation server only answers add_tasks (the plural), so that is what
    this uses; add_task comes back as "Unknown method" there."""
    wanted = projects if isinstance(projects, (list, tuple)) else [projects]
    wanted = [w for w in wanted if w is not None]
    if not wanted:
        return list(simset.list_tasks() or [])
    try:
        simset.add_tasks(*wanted)
    except Exception as err:
        raise PXError("[MODEL] Could not add %s to the simulation set: %s"
                      % (", ".join(str(getattr(w, "name", w)) for w in wanted), err))
    return list(simset.list_tasks() or [])


def simset_volley(app, simset, volley=1):
    """How many of the set's tasks run at the same time. Gives the number back."""
    n = max(1, int(volley))
    done = 0
    for task in (simset.tasks() or []):
        try:
            task.parameters(volley=n)
            done += 1
        except Exception:
            try:
                task.volley(n)
                done += 1
            except Exception as err:
                log("Could not set the volley of task %s: %s"
                    % (getattr(task, "name", "?"), err), "warn")
    log("%d task%s run %d at a time." % (done, "" if done == 1 else "s", n), "info")
    return n


def simset_override(app, simset, task=None, duration=None, step=None, plot_step=None,
                    **extra):
    """Override the simulation settings of one task, or of every task in the set.

    This is how one simulation set runs the same case at several durations or time steps
    without touching the project itself. Times follow the project: duration in seconds,
    steps in microseconds."""
    want = {}
    if duration is not None:
        want["duration"] = float(px_number(duration, 0.0))
    if step is not None:
        want["time_step"] = float(px_number(step, 0.0))
    if plot_step is not None:
        want["plot_step"] = float(px_number(plot_step, 0.0))
    want.update(extra)
    if not want:
        return {}
    tasks = [simset.task(task)] if task else list(simset.tasks() or [])
    for t in tasks:
        try:
            t.overrides(**want)
        except Exception as err:
            log("Could not override the settings of task %s: %s"
                % (getattr(t, "name", "?"), err), "warn")
    log("Overrode %s on %d task%s."
        % (", ".join(sorted(want)), len(tasks), "" if len(tasks) == 1 else "s"), "info")
    return want


def simset_run(app, simset, prj=None):
    """Run a simulation set and say how it went, as a BuildResult-shaped record.

    The set builds and runs its own tasks, so this does not build first."""
    run_deferred()
    name = getattr(simset, "name", None)
    label = name() if callable(name) else str(name or "the simulation set")
    started = time.time()
    try:
        simset.run()
    except Exception as err:
        lines = px_messages(prj)
        log("[MODEL] Simulation set %s did not finish: %s" % (label, err), "warn")
        return BuildResult(False, [str(err)], [], lines, time.time() - started, label)
    lines = px_messages(prj)
    errors, warnings = _split_messages(lines)
    took = time.time() - started
    log("Simulation set %s finished in %.1fs%s." % (label, took,
                                                    (", %d error%s" % (len(errors),
                                                     "" if len(errors) == 1 else "s"))
                                                    if errors else ""),
        "info" if not errors else "warn")
    return BuildResult(not errors, errors, warnings, lines, took, label)
# @end

# @helper px_events
# @needs log, px_state, px_find, px_set, px_value, px_names, units
def set_fault(app, defn="master:tpflt", name="", at=None, duration=None, on=True,
              match="one", kind=None, resistance=None):
    """Set the timing of a fault component in the model, and give back (start, clear).

    PSCAD has no event list: a fault is a component already drawn in the case, and a study
    changes when it happens by writing its parameters. This writes the fault's start time
    and its duration (both in seconds) on a timed fault logic block, or any component with
    the same parameter names, and gives the times back so the checks can use them and the
    graphs can mark them. With `match` "all" every component found is written.

    `kind` picks the faulted phases on a component that offers them (a letter string such
    as "abc", "ab", "a", or "ABC->G"). `on` False switches the fault off for the next run:
    through the component's own enable parameter where it has one, else by a duration of
    zero."""
    found = px_find(app, defn, name, match)
    comps = [c for c in (found if isinstance(found, (list, tuple)) else [found])
             if c is not None]
    t0 = px_number(at)
    dt = px_number(duration)
    for comp in comps:
        _set_fault_one(comp, t0, dt, on, kind, resistance)
    clear = (t0 + dt) if (t0 is not None and dt is not None) else None
    return (t0, clear)


def _set_fault_one(comp, t0, dt, on, kind, resistance):
    """Write one fault component; an error when it has nothing this step can write."""
    params = {}
    try:
        params = comp.parameters() or {}
    except Exception:
        pass
    wrote = []
    off_by = ""

    for key in ("TF", "Tf", "FTime", "Tfault", "TFault", "T1"):
        if key in params and t0 is not None:
            px_set(comp, key, t0, unit="s")
            wrote.append(key)
            break
    enab = next((k for k in ("ENAB", "Enab", "Enabled") if k in params), None)
    for key in ("DF", "Df", "Duration", "FDur", "Tdur", "DTime"):
        if key not in params:
            continue
        if not on and enab is None:
            # No switch of its own: a fault that lasts no time is no fault.
            px_set(comp, key, 0.0, unit="s")
            wrote.append(key)
            off_by = key
        elif dt is not None:
            px_set(comp, key, dt, unit="s")
            wrote.append(key)
        break
    if kind is not None and str(kind).strip():
        done = False
        for key in ("Type", "FType", "Phase", "PhType", "ABC"):
            if key in params:
                px_set(comp, key, kind)
                wrote.append(key)
                done = True
                break
        if not done and all(k in params for k in ("A", "B", "C")):
            # The Three Phase Fault holds one Yes / No for each phase and one for ground.
            text = str(kind).upper()
            phases = [p for p in "ABC" if p in text]
            for p in "ABC":
                px_set(comp, p, "1" if p in phases else "0")
            wrote.append("A, B, C")
            if "G" in params and ("G" in text or len(phases) == 1 or len(phases) == 2):
                px_set(comp, "G", "1" if ("G" in text or len(phases) == 1) else "0")
                wrote.append("G")
            if str(params.get("Ctype", "0")).strip().upper() in ("1", "EXTERNAL"):
                _say_once("%s takes its fault type from a signal (Fault Type Control is "
                          "External), so the phases written on it are not what it uses."
                          % _label(comp), "warn")
            done = True
        if not done:
            _say_once("%s has no phase parameter, so the phases were not written."
                      % _label(comp), "warn")
    if resistance is not None:
        for key in ("RON", "Ron", "Rf", "RF"):
            if key in params:
                px_set(comp, key, resistance, unit="ohm")
                wrote.append(key)
                break
        else:
            _say_once("%s has no fault resistance parameter, so the resistance was not "
                      "written." % _label(comp), "warn")
    if enab is not None:
        px_set(comp, enab, "ENABLED" if on else "DISABLED")
        wrote.append(enab)
    elif not on and not off_by:
        raise PXError(
            "[MODEL] %s cannot be switched off by this step: it has no enable parameter "
            "and no duration.\n"
            "  It has: %s\n"
            "  Switch it off in the logic wired to it, or with Enable / disable components."
            % (_label(comp), ", ".join(sorted(params)[:14])))

    if not wrote:
        raise PXError(
            "[MODEL] %s has no fault timing parameters this step recognises.\n"
            "  It has: %s\n"
            "  Use Set component parameter to write the right one by name."
            % (_label(comp), ", ".join(sorted(params)[:14])))
    if not on:
        log("Fault %s: switched off for the next run (wrote %s)."
            % (_label(comp), ", ".join(wrote)), "info")
        return
    log("Fault %s: start %s, duration %s (wrote %s)."
        % (_label(comp), "%g s" % t0 if t0 is not None else "unchanged",
           "%g s" % dt if dt is not None else "unchanged", ", ".join(wrote)), "info")


def set_switching(app, defn="", name="", at=None, action="open", match="one"):
    """Set the time a breaker or switch component operates, and give the time back.

    As with a fault, PSCAD holds the timing in the component: a Master Library breaker
    takes its time from the logic wired to it, and a timed breaker logic block takes it
    from its own parameters. `action` "open" or "close" picks which of the two times is
    written where the component has both. The time is in seconds; with `match` "all"
    every component found is written.

    The Timed Breaker Logic (master:tbreakn) names its times by order, not by action: the
    first operation leaves its initial state and the second returns to it. So on a breaker
    that starts closed, "open" is the first time and "close" the second, and the other way
    round on one that starts open."""
    t0 = px_number(at)
    if t0 is None:
        raise PXError("[CODE] set_switching needs a time in seconds.")
    found = px_find(app, defn, name, match)
    comps = [c for c in (found if isinstance(found, (list, tuple)) else [found])
             if c is not None]
    opening = str(action or "open").lower().startswith("o")
    for comp in comps:
        _set_switching_one(comp, t0, opening)
    return t0


def _set_switching_one(comp, t0, opening):
    """Write one breaker's time; an error when it has no time this step can write."""
    try:
        params = comp.parameters() or {}
    except Exception:
        params = {}
    word = "open" if opening else "close"
    if "TO1" in params and "TO2" in params:
        init = str(params.get("INIT", "0")).strip().upper()
        starts_open = init in ("1", "OPEN", "OPENED") or init.startswith("1 ")
        second = (opening == starts_open)
        key = "TO2" if second else "TO1"
        px_set(comp, key, t0, unit="s")
        wrote = [key]
        if second and "NUMS" in params and str(params.get("NUMS")).strip() in ("1", "1.0"):
            # One operation only: the second time would never be used.
            px_set(comp, "NUMS", "2")
            wrote.append("NUMS")
        first, _ = _seconds_of(params.get("TO1")) if second else (t0, "")
        last, _ = (t0, "") if second else _seconds_of(params.get("TO2"))
        two = second or str(params.get("NUMS")).strip() not in ("1", "1.0")
        if two and first is not None and last is not None and last <= first:
            log("%s: its second operation (%gs) is not after its first (%gs)."
                % (_label(comp), last, first), "warn")
        log("%s %ss at %gs (wrote %s; it starts %s)."
            % (_label(comp), word, t0, ", ".join(wrote),
               "open" if starts_open else "closed"), "info")
        return
    order = (("TO", "Topen", "T1", "TB", "Tbrk") if opening
             else ("TC", "Tclose", "T2", "TB", "Tbrk"))
    for key in order:
        if key in params:
            px_set(comp, key, t0, unit="s")
            log("%s %ss at %gs (wrote %s)." % (_label(comp), word, t0, key), "info")
            return
    raise PXError("[MODEL] %s has no %s-time parameter this step recognises.\n"
                  "  It has: %s\n"
                  "  Use Set component parameter to write the right one by name."
                  % (_label(comp), "opening" if opening else "closing",
                     ", ".join(sorted(params)[:14])))


def _seconds_of(value):
    """(seconds, unit) of a time parameter, or (None, "") when it is not a number."""
    num, unit = px_split_value(value)
    if num is None:
        return None, ""
    factor = unit_factor(unit, "s") if unit else None
    return (num * factor if factor else num), unit
# @end
