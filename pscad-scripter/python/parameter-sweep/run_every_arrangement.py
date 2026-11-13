#!/usr/bin/env python3
# Every arrangement
"""Made with the PSCAD Workflow Builder, https://tool.adjiebrotots.com/pscad-scripter/builder/

BEFORE YOU RUN
  1. Check the SETTINGS below (lines marked REQUIRED).
  2. Have PSCAD installed and licensed; the script opens one, or uses the one already open (see RUN_MODE).
  3. Run it with Python 3.7 or newer and mhi-pscad installed, e.g.  py -3.12 every_arrangement.py
Results and run.log go to a new folder next to this file (or in OUTPUT_DIR).
"""
# ==== IMPORTS ====
import bisect
import csv
import fnmatch
import importlib
import math
import os
import re
import sys
import time
import traceback

# ==== SETTINGS (edit here) ====
# The name of this workflow: used for the run folder and in the log.
WORKFLOW_NAME = "Every arrangement"
# REQUIRED. The PSCAD case to work on: a .pscx path, or the name of a case already in the
# workspace.
PROJECT = "C:/Studies/substation/substation.pscx"
# OPTIONAL. A .pswx workspace to load before the case ("" = keep the one that is open).
WORKSPACE = ""
# OPTIONAL. Extra .pslx / .pscx libraries to load before the case.
LIBRARIES = []
# OPTIONAL. Where each run writes its folder of results and run.log ("" = the folder of this
# script).
OUTPUT_DIR = ""
# OPTIONAL. True: put every parameter, layer state and substitution the workflow changed back
# when it ends.
UNDO_CHANGES = True
# OPTIONAL. How the results tables are saved in the run folder when the run ends: "csv", "xlsx"
# (Excel, needs pandas and openpyxl) or "both".
TABLE_FORMAT = "csv"
# OPTIONAL. Nominal frequency in Hz for the frequency checks: 50, 60 or "auto" (read the case's
# own global substitution).
F_NOMINAL = "auto"
# OPTIONAL. "auto", "launch" (start a new PSCAD), "connect" (use the one that is open) or
# "inside" (run from inside PSCAD).
RUN_MODE = "auto"
# OPTIONAL. True: show the PSCAD window while running.
SHOW_PSCAD = False
# OPTIONAL. The Fortran compiler that builds the case, as PSCAD names it ("" = the one PSCAD has
# selected).
FORTRAN_VERSION = ""
# OPTIONAL. Which installed PSCAD to start ("" = the newest).
PSCAD_VERSION = ""
# OPTIONAL. The port PSCAD listens on for automation (0 = let PSCAD choose).
PSCAD_PORT = 0
# OPTIONAL. Seconds to wait for PSCAD to start.
CONNECT_TIMEOUT = 120

# True: connect, find every element named in this workflow, say what was found, then stop
# without running anything.
CHECK_ONLY = False


# ==== WORKFLOW ====
# Note: A PSCAD layer switches a whole group of components in or out of the build together, so one case can hold several network arrangements. Type the layer names of your own case, or leave a single * to...
def main():
    preflight([])
    app = px_connect()
    try:
        if CHECK_ONLY:
            check_elements(app, [])
            return
        # -- Step 1: Start (Case: substation.pscx) --
        # -- Step 2: Arrangement (Each layer in the case) --
        arrangement_layers = list(layer_list(app, "*"))
        if not arrangement_layers:
            log("Arrangement: no layer to loop over.", "warn")
        for arrangement_pass_no, arrangement in enumerate(each_layer(app, arrangement_layers, "Enabled", "Disabled"), 1):
            ctx_push("Arrangement", arrangement, arrangement_pass_no, len(arrangement_layers))
            try:
                # -- Step 3: Run simulation (2 s, 50 us step) --
                run = px_run(app, 2, 50, 250, None, events=(), build="auto", read="out", keep_files=False)
                # Did not build: skips to the next pass of Arrangement
                if not run.ok and (run.status == "failed"):
                    case_skipped("The case did not build")
                    continue
                # Stopped early: skips to the next pass of Arrangement
                if not (run.ok or (run.status == "failed")):
                    case_skipped("The simulation stopped before the end")
                    continue
                # -- Step 4: Add row to results table (Into "Arrangements", saved at the end automatically) --
                vbus = run.series("Vbus", "")  # Read a channel
                peak_result = peak(vbus, kind="abs", after=None, before=None)  # Peak
                table("Arrangements").add({
                    "Peak": peak_result.value,
                    "Reached (s)": run.t_end,
                }, status=True)
            except StopWorkflow:
                raise
            except Exception as err:
                case_failed(err)
            finally:
                ctx_pop(["Arrangements"])
    except StopWorkflow as stop:
        log(f"Stopped: {stop}")
    finally:
        finish(app)


# ==== HELPERS (copied from the Builder runtime; you do not need to read these) ====

_LOG = {"fh": None, "t0": time.time(), "warnings": 0, "errors": 0}


def log(msg, level="info"):
    """Print a timestamped line and append it to run.log in the run folder."""
    stamp = time.strftime("%H:%M:%S")
    tag = {"warn": "WARNING ", "error": "ERROR "}.get(level, "")
    if level == "warn":
        _LOG["warnings"] += 1
    elif level == "error":
        _LOG["errors"] += 1
    line = f"[{stamp}] {tag}{msg}"
    if level != "debug":
        try:
            print(line, flush=True)
        except UnicodeEncodeError:
            # A console or pipe that cannot show a name (cp1252 and a Greek letter, say) must not
            # stop the run: show what it can.
            enc = getattr(sys.stdout, "encoding", None) or "ascii"
            print(line.encode(enc, "replace").decode(enc, "replace"), flush=True)
    try:
        if _LOG["fh"] is None:
            _LOG["fh"] = open(os.path.join(run_dir(), "run.log"), "a", encoding="utf-8")
        _LOG["fh"].write(line + "\n")
        _LOG["fh"].flush()
    except Exception:
        pass

class StopWorkflow(Exception):
    """Raised by a Stop the workflow block; main() catches it and finishes cleanly."""

_RUN = {"dir": None, "files": []}


def safe_filename(text, maxlen=80):
    """A file-name-safe version of text (Windows rules), never empty."""
    s = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', "_", str(text)).strip(" ._")
    s = re.sub(r"\s+", "_", s)
    return (s[:maxlen].rstrip(" ._") or "output")


def script_dir():
    """The folder of the running script (the working folder when that cannot be told)."""
    here = globals().get("__file__") or (sys.argv[0] if sys.argv and sys.argv[0] else "")
    return os.path.dirname(os.path.abspath(here)) if here else os.getcwd()


def run_dir():
    """The folder this run writes to: OUTPUT_DIR/<workflow>_<date>_<time>, made on first use.
    With OUTPUT_DIR empty it goes next to the script, whatever folder the script was started from."""
    if _RUN["dir"] is None:
        base = globals().get("OUTPUT_DIR") or script_dir()
        name = safe_filename(globals().get("WORKFLOW_NAME") or "workflow", 50)
        path = os.path.join(os.path.abspath(os.path.expanduser(base)), name + "_" + time.strftime("%Y%m%d_%H%M%S"))
        n = 1
        while os.path.exists(path + ("" if n == 1 else f"_{n}")):
            n += 1
        path = path + ("" if n == 1 else f"_{n}")
        os.makedirs(path, exist_ok=True)
        _RUN["dir"] = path
    return _RUN["dir"]


def out_file(stem, ext, sub=None):
    """A new file path in the run folder (or its sub folder); the loop labels are added to the
    name when called inside loops, and a counter keeps names unique."""
    folder = run_dir() if not sub else os.path.join(run_dir(), sub)
    os.makedirs(folder, exist_ok=True)
    tag = ""
    ctx_fn = globals().get("ctx_tag")
    if callable(ctx_fn):
        tag = ctx_fn()
    base = safe_filename(stem + ("_" + tag if tag else ""), 120)
    ext = ext.lstrip(".")
    path = os.path.join(folder, f"{base}.{ext}")
    n = 2
    while os.path.exists(path) or path in _RUN["files"]:
        path = os.path.join(folder, f"{base}_{n}.{ext}")
        n += 1
    _RUN["files"].append(path)
    return path

_CTX = []
_PASSES = {"run": 0, "skipped": 0, "failed": 0, "reasons": [], "durations": {}}


def ctx_push(label, value, i=None, n=None):
    """Start a loop pass: its label and value go into table rows, file names and messages.
    i is the pass number (1-based) and n the number of passes, when known, for the progress line."""
    frame = {"label": str(label), "value": value, "t0": time.time(), "reason": None, "tables": set()}
    _CTX.append(frame)
    _PASSES["run"] += 1
    if i is not None:
        done = _PASSES["durations"].get(frame["label"], [])
        left = ""
        if done and n:
            remaining = (sum(done) / len(done)) * max(0, n - i + 1)
            if remaining >= 5:
                left = f", about {_fmt_secs(remaining)} left"
        total = f" of {n}" if n else ""
        log(f"== Pass {i}{total}: {ctx_text()}{left} ==")


def ctx_pop(tables=None):
    """End the current pass. For each table name in `tables` (Add row blocks of this loop that
    keep skipped passes), a pass that added no row gets one with the loop values and the reason."""
    if not _CTX:
        return
    frame = _CTX[-1]
    for name in tables or ():
        if name not in frame["tables"]:
            tbl_fn = globals().get("table")
            if callable(tbl_fn):
                reason = frame["reason"] or "Not reached"
                tbl_fn(name).add({"Status": reason}, with_ctx=True)
    _PASSES["durations"].setdefault(frame["label"], []).append(time.time() - frame["t0"])
    _CTX.pop()


def ctx_dict():
    """The labels of the loops we are inside, outermost first, as an ordered dict."""
    out = {}
    for frame in _CTX:
        label = frame["label"]
        key, n = label, 2
        while key in out:
            key = f"{label} ({n})"
            n += 1
        out[key] = _ctx_value(frame["value"])
    return out


def ctx_tag():
    """A short file-name tag from the loop values, outermost first."""
    return "_".join(str(_ctx_value(f["value"])) for f in _CTX)


def ctx_mark_row(table_name):
    """Note that a table got a row in every pass we are inside (so no skip row is added)."""
    for f in _CTX:
        f["tables"].add(str(table_name))


def case_skipped(msg):
    """A pass ends early on purpose (a guard such as "Load flow did not converge"): log it with
    the loop values, keep the reason for the summary and for the table's skip row."""
    _PASSES["skipped"] += 1
    where = ctx_text()
    if _CTX:
        _CTX[-1]["reason"] = str(msg)
    _PASSES["reasons"].append((where, str(msg)))
    log(f"Skipped{' (' + where + ')' if where else ''}: {msg}")


def _fmt_secs(s):
    s = int(round(s))
    if s < 90:
        return f"{s} s"
    if s < 5400:
        return f"{round(s / 60)} min"
    return f"{s / 3600:.1f} h"


def ctx_text():
    """'Study case = Base, Dispatch = 300' for messages."""
    return ", ".join(f"{k} = {v}" for k, v in ctx_dict().items())


def _ctx_value(v):
    name = getattr(v, "loc_name", None)
    if name is not None:
        return name
    if isinstance(v, float):
        return float(f"{v:.6g}")
    return v


def log_summary():
    """The end-of-run summary: passes run, skipped (with the first reasons), failed, warnings."""
    p = _PASSES
    failed = globals().get("_FAILED", {}).get("count", 0)
    log(f"Passes run: {p['run']}, skipped: {p['skipped']}, failed: {failed}, "
        f"warnings: {_LOG['warnings']}, errors: {_LOG['errors']}.")
    for where, why in p["reasons"][:20]:
        log(f"  skipped {where or '(no loop)'}: {why}")
    if len(p["reasons"]) > 20:
        log(f"  ... and {len(p['reasons']) - 20} more skipped passes (see run.log).")
    files = globals().get("_RUN", {}).get("files", [])
    if files:
        log(f"Files written: {len(files)} in {run_dir()}")

_FAILED = {"count": 0}


def case_failed(exc, trial=None):
    """A loop pass (or a search try) raised: log it with where it happened, keep the reason for
    the skip row, mark the try failed, then carry on with the next pass."""
    _FAILED["count"] += 1
    where = ctx_text()
    if _CTX:
        _CTX[-1]["reason"] = f"ERROR: {type(exc).__name__}: {exc}"[:200]
    if trial is not None:
        trial.failed = True
    log(f"This pass failed{' (' + where + ')' if where else ''}: {type(exc).__name__}: {exc}", "error")
    log(traceback.format_exc().rstrip(), "debug")

def as_float(x, default=None):
    """A number from x, or default when x is empty or not a number."""
    if x is None:
        return default
    if isinstance(x, bool):
        return 1.0 if x else 0.0
    if isinstance(x, (int, float)):
        return float(x)
    if hasattr(x, "item") and not isinstance(x, (list, tuple, str)):
        try:
            return float(x.item())
        except Exception:
            pass
    if isinstance(x, (list, tuple)) and len(x) == 1:
        return as_float(x[0], default)
    try:
        return float(str(x).strip().replace(",", "."))
    except Exception:
        return default


def as_list(x):
    """A list of numbers from a list, a time series (its values), one number, or nothing."""
    if x is None:
        return []
    y = getattr(x, "y", None)
    if y is not None and hasattr(x, "t"):
        return [float(v) for v in y]
    if isinstance(x, (list, tuple)) or (hasattr(x, "__iter__") and not isinstance(x, (str, dict))):
        out = []
        for v in x:
            f = as_float(v)
            if f is not None:
                out.append(f)
        return out
    f = as_float(x)
    return [] if f is None else [f]


def as_items(x):
    """A list of anything (numbers, names, elements) from a list, a series (its values), a
    single value, or nothing. Unlike as_list it keeps text and elements."""
    if x is None:
        return []
    y = getattr(x, "y", None)
    if y is not None and hasattr(x, "t"):
        return list(y)
    if isinstance(x, (list, tuple)):
        return list(x)
    if isinstance(x, (str, bytes, dict)):
        return [x]
    if hasattr(x, "__iter__"):
        try:
            return list(x)
        except Exception:
            return [x]
    return [x]


def as_bool(x):
    """True or False from a value: text such as yes / true / pass / 1 counts as True, NaN as False."""
    if isinstance(x, str):
        return x.strip().lower() in ("1", "true", "yes", "y", "pass", "on")
    if isinstance(x, float) and math.isnan(x):
        return False
    return bool(x)


def as_text(x):
    """Readable text for a value: numbers to 6 significant digits, objects by name."""
    if x is None:
        return ""
    if isinstance(x, bool):
        return "Yes" if x else "No"
    if isinstance(x, float):
        if math.isnan(x):
            return "nan"
        return f"{x:.6g}"
    name = getattr(x, "loc_name", None)
    if name is not None:
        return str(name)
    if isinstance(x, (list, tuple)):
        return ", ".join(as_text(v) for v in x)
    return str(x)

class Series:
    """A time series: t in seconds and y values, same length, from a simulation result.
    `events` lists the workflow's simulation events of that run as (time in s, label), so the
    checks can find the event time and the graphs can mark it."""

    __slots__ = ("t", "y", "label", "unit", "events")

    def __init__(self, t, y, label="", unit="", events=None):
        t = [float(v) for v in t]
        y = [float(v) if v is not None else float("nan") for v in y]
        n = min(len(t), len(y))
        self.t, self.y, self.label, self.unit = t[:n], y[:n], str(label), str(unit)
        self.events = [(float(et), str(el)) for et, el in (events or [])]

    def __len__(self):
        return len(self.t)

    def __bool__(self):
        return len(self.t) > 0

    def first_event(self, default=None):
        """Time of the first workflow event of the run (s), or default."""
        return min((et for et, _ in self.events), default=default)

    def between(self, t0=None, t1=None):
        """The part with t0 <= t <= t1 (either end may be None)."""
        keep = [i for i, tv in enumerate(self.t)
                if (t0 is None or tv >= t0) and (t1 is None or tv <= t1)]
        return Series([self.t[i] for i in keep], [self.y[i] for i in keep], self.label, self.unit, self.events)

    def after(self, t0):
        return self.between(t0, None)

    def finite(self):
        """The samples whose value is a real number (NaN and inf dropped)."""
        keep = [i for i, v in enumerate(self.y) if math.isfinite(v)]
        return Series([self.t[i] for i in keep], [self.y[i] for i in keep], self.label, self.unit, self.events)

    def __repr__(self):
        span = f"{self.t[0]:g}..{self.t[-1]:g} s" if self.t else "empty"
        return f"Series({self.label or 'unnamed'}, {len(self)} samples, {span})"

_TABLES = {}


class ResultTable:
    """Rows of results. Columns appear in the order they are first used."""

    def __init__(self, name):
        self.name = str(name)
        self.rows = []
        self.columns = []
        self.saved_rows = 0
        self.paths = []

    def add(self, row, with_ctx=True, status=False):
        """Add a row: the loop values first (with_ctx), then the row's own columns. With status,
        a Status column says OK (skip rows written by ctx_pop carry the reason instead)."""
        full = {}
        if with_ctx:
            full.update(ctx_dict())
        if status:
            full["Status"] = "OK"
        full.update(row)
        for k in full:
            if k not in self.columns:
                self.columns.append(k)
        self.rows.append({k: _cell(v) for k, v in full.items()})
        ctx_mark_row(self.name)
        return self

    def column(self, name):
        """The values of one column, top to bottom (empty cells left out)."""
        return [r[name] for r in self.rows if r.get(name) not in (None, "")]

    def save(self, stem=None, fmt="csv"):
        """Write the table to the run folder as csv, xlsx or both; returns the paths."""
        stem = stem or self.name
        paths = []
        if fmt in ("csv", "both"):
            path = out_file(stem, "csv")
            with open(path, "w", newline="", encoding="utf-8-sig") as f:
                w = csv.writer(f)
                w.writerow(self.columns)
                for r in self.rows:
                    w.writerow(["" if r.get(c) is None else r.get(c) for c in self.columns])
            paths.append(path)
        if fmt in ("xlsx", "both"):
            try:
                import pandas as pd
                path = out_file(stem, "xlsx")
                pd.DataFrame(self.rows, columns=self.columns).to_excel(path, index=False)
                paths.append(path)
            except Exception as e:
                log(f"Could not write an Excel file for '{self.name}' ({e}); writing CSV instead.", "warn")
                if fmt == "xlsx":
                    paths += self.save(stem, "csv")
        for p in paths:
            log(f"Saved table '{self.name}' ({len(self.rows)} rows): {p}")
        self.saved_rows = len(self.rows)
        self.paths += paths
        return paths

    def __len__(self):
        return len(self.rows)


def table(name="Results"):
    """The results table with this name (made on first use)."""
    key = str(name)
    if key not in _TABLES:
        _TABLES[key] = ResultTable(key)
    return _TABLES[key]


def flush_tables():
    """Save every table that has rows no block has saved yet (called when the workflow ends),
    as TABLE_FORMAT says (SETTINGS: "csv", "xlsx" or "both"; csv when it is not set). This is
    the normal way a results table reaches the run folder; Save results table is only needed
    to save partway through the run, under another file name, or for its file path."""
    fmt = str(globals().get("TABLE_FORMAT", "csv") or "csv").strip().lower()
    if fmt not in ("csv", "xlsx", "both"):
        log(f"TABLE_FORMAT {fmt!r} is not csv, xlsx or both, so the tables are saved as CSV.", "warn")
        fmt = "csv"
    todo = [t for t in _TABLES.values() if len(t.rows) > t.saved_rows]
    if todo:
        names = ", ".join(f"'{t.name}'" for t in todo)
        log(f"End of the run: saving the results table{'s' if len(todo) > 1 else ''} {names}.")
    for t in todo:
        t.save(fmt=fmt)


def _cell(v):
    if isinstance(v, bool) or v is None or isinstance(v, (int, str)):
        return v
    if isinstance(v, float):
        return v
    f = as_float(v)
    if f is not None and not isinstance(v, (list, tuple)):
        return f
    return as_text(v)

_PX = {
    "app": None, "mhi": None, "mode": "", "version": "",
    "project": None,    # the Project the workflow works on (PROJECT)
    "start": None,      # {"scenario", "layers", "params"} as the project was found
    "records": [],      # undo records, oldest first: {"obj", "param", "old", "key"}
    "keys": {},         # (component id, parameter) -> index of its latest record
    "marks": [],        # (id, record count) of the marks still open, innermost last
    "created": [],      # things the workflow made: {"obj", "kind", "keep", "name", "parent"}
    "deferred": [],     # [(label, fn)] tidy-ups that wait until after the next run
    "hooks": [],        # [(label, fn)] restores finish() runs before putting the project back
    "said": set(),      # messages logged once
    "fnom": {},         # project name -> nominal frequency (f_nominal)
    "built": set(),     # project names already built in this run
    "snap_start": {},   # project name -> the snapshot its runs start from (snapshot_use)
}
PXB = "PXB_"


class PXError(Exception):
    """A PSCAD step could not be done; the message says why in plain words."""


def _app():
    app = _PX["app"]
    if app is None:
        raise PXError("[CODE] PSCAD is not connected: px_connect() has to run first.")
    return app


def _say_once(message, level="info"):
    """Log `message` the first time only (one line per distinct message per run)."""
    if message in _PX["said"]:
        return False
    _PX["said"].add(message)
    log(message, level)
    return True


def _cid(obj):
    """A stable key for a component: its project and instance id."""
    if obj is None:
        return ""
    try:
        return "%s#%s" % (getattr(obj, "project_name", "") or "", obj.iid)
    except Exception:
        return repr(obj)


def _label(obj):
    """What to call a component in a message: its Name if it has one, else definition#id."""
    if obj is None:
        return "nothing"
    name = ""
    try:
        got = obj.parameters()
        if isinstance(got, dict):
            name = str(got.get("Name") or "").strip()
    except Exception:
        pass
    defn = _defn_of(obj)
    if name and defn:
        return "%s (%s)" % (name, defn)
    if name:
        return name
    return defn or _cid(obj)


def _defn_of(obj):
    """The definition name of a component as one string: "master:source_1"."""
    try:
        d = obj.defn_name
    except Exception:
        return ""
    if isinstance(d, (tuple, list)):
        return ":".join(str(p) for p in d)
    return str(d or "")


def _closest(name, names, limit=8):
    """The names most like `name`, for a "did you mean" line."""
    try:
        import difflib
        return difflib.get_close_matches(str(name), [str(n) for n in names],
                                         n=limit, cutoff=0.4)
    except Exception:
        low = str(name).lower()
        return [n for n in names if low in str(n).lower()][:limit]


def defer(label, fn):
    """Leave a tidy-up that must wait until after the next run (deleting a file EMTDC holds)."""
    _PX["deferred"].append((label, fn))


def run_deferred():
    """Run the tidy-ups left by the last run. Called by every px_run, px_undo path and finish."""
    jobs, _PX["deferred"] = _PX["deferred"], []
    done = 0
    for label, fn in jobs:
        try:
            fn()
            done += 1
        except Exception as err:
            log("Could not %s: %s" % (label, err), "warn")
    return done

def px_messages(prj=None, errors_only=False, last=None):
    """PSCAD's build and run messages for a project, newest last, as plain lines.

    Each line reads "Error: ..." / "Warning: ..." / the text itself for ordinary progress.
    `last` keeps only the final N lines. Works with PSCAD minimised.

    PSCAD replaces this list at the start of every clean, build and run rather than
    adding to it, so what comes back always belongs to the last thing the project did and
    there is nothing to clear."""
    prj = prj if prj is not None else _PX["project"]
    if prj is None:
        return []
    try:
        msgs = list(prj.messages() or [])
    except Exception as err:
        log("Could not read PSCAD's messages: %s" % err, "warn")
        return []
    out = []
    for m in msgs:
        status = str(getattr(m, "status", "") or "normal").lower()
        text = " ".join(str(getattr(m, "text", "") or "").split())
        if not text:
            continue
        if status in ("error", "fatal"):
            out.append("Error: " + text)
        elif status in ("warn", "warning"):
            if errors_only:
                continue
            out.append("Warning: " + text)
        elif not errors_only:
            out.append(text)
    if last:
        out = out[-int(last):]
    return out


def px_errors(prj=None):
    """Only the error lines of a project's messages, as plain text."""
    return [m for m in px_messages(prj, errors_only=True) if m.startswith("Error:")]

def preflight(modules=None):
    """Check every package the script needs before connecting to PSCAD.

    Ends the script with a message naming the missing package and the exact pip line to run,
    rather than failing halfway through a study. `modules` None reads PREFLIGHT_MODULES."""
    wanted = list(modules if modules is not None else globals().get("PREFLIGHT_MODULES", ()))
    if "mhi.pscad" not in wanted:
        wanted.insert(0, "mhi.pscad")
    exe = sys.executable or "python"
    pip_name = {"mhi.pscad": "mhi-pscad", "mhi.psout": "mhi-psout",
                "matplotlib": "matplotlib", "pandas": "pandas",
                "openpyxl": "openpyxl", "numpy": "numpy"}
    missing = []
    for name in wanted:
        try:
            importlib.import_module(name)
        except Exception:
            missing.append(name)
    if missing:
        lines = ["This script needs %s, which %s cannot import." %
                 (" and ".join(missing), exe)]
        for name in missing:
            lines.append('  "%s" -m pip install %s' % (exe, pip_name.get(name, name)))
        if "mhi.pscad" in missing:
            lines.append("mhi-pscad is the PSCAD Automation Library; it is published on PyPI.")
        raise SystemExit("\n".join(lines))
    # The Automation Library needs a 64-bit Python matching PSCAD's own bitness for the
    # in-process case, and Python 3.7 or newer in every case.
    if sys.version_info < (3, 7):
        raise SystemExit("This script needs Python 3.7 or newer; this is %s."
                         % ".".join(str(v) for v in sys.version_info[:3]))
    import mhi.pscad
    ver = str(getattr(mhi.pscad, "VERSION", "") or "")
    if ver and tuple(int(p) for p in ver.split(".")[:2] if p.isdigit()) < (2, 2):
        log("Automation Library %s is older than 2.2; some steps may not work." % ver, "warn")
    return True

def _px_shim():
    """Two fixes that let a pip-installed Automation Library drive an older PSCAD.

    1. PSCAD 5.0.0's automation server sends back objects in the `mhi.pscad.common`
       namespace, which every Automation Library from 2.3 on has moved to `mhi.common`.
       Without the alias the library's receive thread dies with ModuleNotFoundError on the
       first call that returns such an object (Project.scenarios(), for one), and the whole
       connection goes with it. Aliasing the modules costs nothing on a newer PSCAD.
    2. `NoDefaultCurrentDirectoryInExePath`, set by some hardened and sandboxed environments,
       is inherited by PSCAD and then by EMTDC's generated .bat files, which call
       `<case>.exe` with no path. The case builds and the run dies with
       "'<case>.exe' is not recognized". PSCAD's own launcher never sets it.
    """
    try:
        import mhi.common
        for sub in ("", ".remote", ".collection", ".codec", ".path", ".process", ".cdata"):
            name = "mhi.pscad.common" + sub
            if name in sys.modules:
                continue
            try:
                sys.modules[name] = __import__("mhi.common" + sub, fromlist=["x"])
            except Exception:
                pass
    except Exception:
        pass
    if os.environ.pop("NoDefaultCurrentDirectoryInExePath", None) is not None:
        log("Cleared NoDefaultCurrentDirectoryInExePath for this run so EMTDC can start "
            "the case it builds.", "info")

def px_connect():
    """Connect to PSCAD and open the project the workflow works on.

    Reads SETTINGS: PROJECT (a .pscx path or the name of a project already loaded),
    WORKSPACE (a .pswx to load first), LIBRARIES (extra .pslx / .pscx), RUN_MODE
    ("auto" / "launch" / "connect"), PSCAD_PORT, PSCAD_VERSION, FORTRAN_VERSION,
    SHOW_PSCAD, CONNECT_TIMEOUT. Calling it again gives back the same application."""
    if _PX["app"] is not None:
        return _PX["app"]
    preflight()
    _px_shim()
    import mhi.pscad
    _PX["mhi"] = mhi.pscad

    mode = str(globals().get("RUN_MODE", "auto") or "auto").lower()
    port = int(globals().get("PSCAD_PORT", 0) or 0)
    show = bool(globals().get("SHOW_PSCAD", False))
    version = str(globals().get("PSCAD_VERSION", "") or "")
    timeout = float(globals().get("CONNECT_TIMEOUT", 120) or 120)

    inside = os.path.basename(sys.executable or "").lower().startswith("pscad")
    if mode == "auto":
        mode = "inside" if inside else "launch"

    app = None
    started = time.time()
    try:
        if mode == "inside":
            app = mhi.pscad.application()
            _PX["mode"] = "inside"
        elif mode == "connect":
            app = mhi.pscad.connect(port=port) if port else mhi.pscad.connect()
            _PX["mode"] = "connect"
        else:
            kw = {"minimize": not show, "splash": False, "timeout": max(5, int(timeout))}
            if port:
                kw["port"] = port
            if version:
                kw["version"] = version
            try:
                app = mhi.pscad.connect(port=port) if port else mhi.pscad.connect()
                _PX["mode"] = "connect"
                log("Using the PSCAD that is already running.", "info")
            except Exception:
                app = mhi.pscad.launch(**kw)
                _PX["mode"] = "launch"
    except Exception as err:
        raise SystemExit(_connect_help(err, mode, version))
    if app is None:
        raise SystemExit(_connect_help(None, mode, version))

    _PX["app"] = app
    try:
        _PX["version"] = str(app.version or "")
    except Exception:
        _PX["version"] = ""
    log("PSCAD %s connected in %.1fs (%s), Automation Library %s."
        % (_PX["version"] or "?", time.time() - started, _PX["mode"],
           getattr(mhi.pscad, "VERSION", "?")), "info")

    try:
        if not app.licensed():
            log("PSCAD holds no licence certificate. A run will fail until one is acquired; "
                "open PSCAD and check the licence, or call get_certificate() first.", "warn")
    except Exception:
        pass

    _apply_fortran(app)

    workspace = str(globals().get("WORKSPACE", "") or "")
    if workspace:
        _load_file(app, workspace, "workspace")
    for lib in list(globals().get("LIBRARIES", ()) or ()):
        _load_file(app, str(lib), "library")

    project = str(globals().get("PROJECT", "") or "")
    if not project:
        raise SystemExit("PROJECT is empty: put the .pscx file (or the name of a project "
                         "already in the workspace) in SETTINGS.")
    _PX["project"] = _open_project(app, project)
    _remember_start(_PX["project"])
    return app


def _connect_help(err, mode, version):
    """Why connecting failed, and what to do about it."""
    lines = ["Could not %s PSCAD." % ("find a running" if mode == "connect" else "start")]
    if err is not None:
        lines.append("  %s: %s" % (type(err).__name__, err))
    try:
        import mhi.pscad
        found = mhi.pscad.versions()
    except Exception:
        found = []
    if found:
        lines.append("  Installed: " + ", ".join("%s%s" % (v, " x64" if x64 else " x86")
                                                 for v, x64 in found))
        if version:
            lines.append('  PSCAD_VERSION is "%s"; use one of the versions above, or "".'
                         % version)
    else:
        lines.append("  No PSCAD installation was found. The Automation Library reads the "
                     "installed versions from the registry.")
    lines.append("  RUN_MODE \"connect\" needs PSCAD already open; \"launch\" starts one; "
                 "\"auto\" uses the PSCAD the script runs inside, else launches.")
    return "\n".join(lines)


def _apply_fortran(app):
    """Set the Fortran compiler when FORTRAN_VERSION says so, without breaking older PSCAD.

    PSCAD.settings() raises on an install whose ProductList.xml the newer Automation
    Library cannot find, so neither reading nor writing settings is allowed to be fatal."""
    wanted = str(globals().get("FORTRAN_VERSION", "") or "")
    if not wanted:
        return
    try:
        app.settings(fortran_version=wanted)
        log('Fortran compiler set to "%s".' % wanted, "info")
    except Exception as err:
        log('Could not set the Fortran compiler to "%s" (%s). The project builds with '
            "whatever PSCAD has selected." % (wanted, err), "warn")


def _load_file(app, path, kind):
    """Load a workspace, library or project file, with a clear message when it is not there."""
    full = os.path.abspath(os.path.expanduser(os.path.expandvars(path)))
    if not os.path.exists(full):
        raise SystemExit("The %s file is not there: %s" % (kind, full))
    try:
        app.load(full)
    except Exception as err:
        raise SystemExit("PSCAD could not load the %s %s:\n  %s" % (kind, full, err))
    log("Loaded %s %s." % (kind, os.path.basename(full)), "info")
    return full


def _open_project(app, project):
    """The Project named, loading its file first when PROJECT is a path."""
    looks_like_file = project.lower().endswith((".pscx", ".pslx", ".psc", ".psl"))
    name = project
    if looks_like_file:
        full = _load_file(app, project, "project")
        name = os.path.splitext(os.path.basename(full))[0]
    try:
        loaded = list(app.project_names() or [])
    except Exception:
        loaded = []
    if name not in loaded:
        near = _closest(name, loaded)
        raise SystemExit(
            'PSCAD has no project called "%s".%s\nPut the .pscx path in PROJECT, or open the '
            "project in PSCAD first." % (name, ("\n  Closest loaded: " + ", ".join(near))
                                         if near else ("\n  Loaded: " + ", ".join(loaded)
                                                       if loaded else "")))
    prj = app.project(name)
    try:
        prj.focus()
    except Exception:
        pass
    log("Project %s is open." % name, "info")
    return prj


def _remember_start(prj):
    """What the project looked like when the workflow found it, so finish() can put it back."""
    state = {"scenario": "", "layers": {}, "params": {}}
    try:
        state["scenario"] = prj.scenario() or ""
    except Exception:
        pass
    try:
        state["layers"] = dict(prj.layers() or {})
    except Exception:
        pass
    try:
        keep = ("time_duration", "time_step", "sample_step", "PlotType", "output_filename",
                "StartType", "startup_filename", "SnapType", "SnapTime", "snapshot_filename",
                "MrunType", "Mruns")
        got = prj.parameters() or {}
        state["params"] = {k: got[k] for k in keep if k in got}
    except Exception:
        pass
    _PX["start"] = state
    return state

_PX_VALUE_RE = re.compile(r"^\s*(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)\s*(?:\[([^\]]*)\])?\s*$")


def px_split_value(value):
    """A PSCAD parameter value as (number, unit) when it is one, else (None, "").

    PSCAD hands a parameter back as a plain number, as a string, or as a unit-carrying value
    whose text reads "2.5 [ohm]". A value that holds a global substitution ("$(freq)") or an
    expression is not a number, and comes back as (None, "").

    The unit-carrying value is a subclass of float, so its text has to be read before its
    number: taking it as a float would silently throw the unit away."""
    if value is None:
        return None, ""
    if isinstance(value, bool):
        return (1.0 if value else 0.0), ""
    m = _PX_VALUE_RE.match(str(value))
    if m:
        return float(m.group(1)), (m.group(2) or "").strip()
    if isinstance(value, (int, float)):
        number = float(value)
        return (number if math.isfinite(number) else None), ""
    return None, ""


def px_number(value, default=None):
    """The number in a PSCAD parameter value, or `default`."""
    num, _ = px_split_value(value)
    return default if num is None else num


def px_unit(value):
    """The unit a PSCAD parameter value carries ("ohm", "kV", "s"), or ""."""
    return px_split_value(value)[1]


def px_text(value):
    """A PSCAD parameter value as the text PSCAD itself would show."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "1" if value else "0"
    return str(value)


def px_with_unit(number, unit):
    """A value written the way PSCAD takes it: "2.5 [ohm]", or "2.5" with no unit."""
    text = ("%.12g" % float(number))
    return ("%s [%s]" % (text, unit)) if unit else text

_UNIT_FAMILIES = (
    {"w": 1.0, "kw": 1e3, "mw": 1e6, "gw": 1e9},
    {"var": 1.0, "kvar": 1e3, "mvar": 1e6, "gvar": 1e9},
    {"va": 1.0, "kva": 1e3, "mva": 1e6, "gva": 1e9},
    {"s": 1.0, "ms": 1e-3, "us": 1e-6, "min": 60.0, "h": 3600.0},
    {"v": 1.0, "kv": 1e3, "mv": 1e-3},
    {"a": 1.0, "ka": 1e3, "ma": 1e-3},
    {"ohm": 1.0, "kohm": 1e3, "mohm": 1e-3},
    {"h": 1.0, "mh": 1e-3, "uh": 1e-6},
    {"f": 1.0, "uf": 1e-6, "nf": 1e-9, "pf": 1e-12},
    {"hz": 1.0, "khz": 1e3, "mhz": 1e6},
    {"wh": 1.0, "kwh": 1e3, "mwh": 1e6, "gwh": 1e9},
)
# "h" is hours in the time family and henries in the inductance family, so the time family
# is searched first and an inductance conversion must name mH or uH explicitly.


def unit_factor(from_unit, to_unit):
    """How many `to_unit` one `from_unit` is, or None when they are not the same quantity.

    A percentage, a per-unit value and an angle cannot be converted, so they give None."""
    a = str(from_unit or "").strip().lower().replace("[", "").replace("]", "")
    b = str(to_unit or "").strip().lower().replace("[", "").replace("]", "")
    a = {"micros": "us", "usec": "us", "msec": "ms", "sec": "s", "hour": "h"}.get(a, a)
    b = {"micros": "us", "usec": "us", "msec": "ms", "sec": "s", "hour": "h"}.get(b, b)
    if not a or not b:
        return None
    if a == b:
        return 1.0
    for fam in _UNIT_FAMILIES:
        if a in fam and b in fam:
            return fam[a] / fam[b]
    return None

def px_set(obj, param, value, unit=None, record=True):
    """Write one parameter of a component (or of each component of a list) and give `value` back.

    The value is written in the unit the parameter already carries, so a resistance PSCAD
    shows in ohm stays in ohm whatever `unit` says; `unit` names the unit `value` is in.
    The original is recorded once per (component, parameter) since the innermost open mark,
    so px_undo can put it back."""
    targets = obj if isinstance(obj, (list, tuple)) else [obj]
    targets = [t for t in targets if t is not None]
    if not targets:
        raise PXError("[CODE] px_set was given no component to write %s on." % param)
    for target in targets:
        _px_set_one(target, str(param), value, unit, record)
    return value


def _px_set_one(obj, param, value, unit, record):
    try:
        current = obj.parameters()
    except Exception as err:
        raise PXError("[MODEL] Could not read the parameters of %s: %s" % (_label(obj), err))
    if not isinstance(current, dict) or param not in current:
        near = _closest(param, list(current) if isinstance(current, dict) else [])
        raise PXError('[MODEL] %s has no parameter "%s".%s'
                      % (_label(obj), param,
                         ("\n  Closest: " + ", ".join(near)) if near else ""))
    old = current[param]
    if record:
        _record(obj, param, old)

    num, have_unit = px_split_value(old)
    out = value
    if isinstance(value, bool):
        out = "1" if value else "0"
    elif isinstance(value, (int, float)):
        factor = unit_factor(unit, have_unit) if (unit and have_unit) else None
        number = float(value) * factor if factor else float(value)
        if unit and have_unit and factor is None and str(unit).lower() != str(have_unit).lower():
            _say_once('%s is in [%s]; the value given in %s was written as it is.'
                      % (param, have_unit, unit), "warn")
        out = px_with_unit(number, have_unit) if have_unit else ("%.12g" % number)
    else:
        out = str(value)
    try:
        obj.parameters(**{param: out})
    except Exception as err:
        raise PXError('[MODEL] PSCAD refused %s = %s on %s: %s'
                      % (param, out, _label(obj), err))
    return out


def _record(obj, param, old):
    """Keep the first original of a (component, parameter) since the innermost open mark."""
    key = (_cid(obj), param)
    floor = _PX["marks"][-1][1] if _PX["marks"] else 0
    seen = _PX["keys"].get(key)
    if seen is not None and seen >= floor:
        return
    _PX["keys"][key] = len(_PX["records"])
    _PX["records"].append({"obj": obj, "param": param, "old": old, "key": key})

def px_undo(mark=None):
    """Put back every parameter px_set changed after `mark` (None: everything) and say how many.

    Components the workflow created after the mark are deleted, newest first. Writes go in
    with record=False so putting back never records anything itself."""
    run_deferred()
    floor = int(mark["n"]) if isinstance(mark, dict) and "n" in mark else 0
    records = _PX["records"]
    put_back = 0
    for rec in reversed(records[floor:]):
        obj, param, old = rec["obj"], rec["param"], rec["old"]
        try:
            _restore_one(obj, param, old)
            put_back += 1
        except Exception as err:
            log("Could not put %s back on %s: %s" % (param, _label(obj), err), "warn")
    for rec in records[floor:]:
        _PX["keys"].pop(rec["key"], None)
    del records[floor:]
    depth = int(mark["id"]) if isinstance(mark, dict) and "id" in mark else 1
    if isinstance(mark, dict) and "id" in mark:
        while _PX["marks"] and _PX["marks"][-1][0] >= mark["id"]:
            _PX["marks"].pop()
    made = [c for c in _PX["created"]
            if not c.get("keep") and c.get("mark", 0) >= depth]
    if made:
        cleanup_created(only=made)
    if put_back:
        log("Put back %d changed value%s." % (put_back, "" if put_back == 1 else "s"), "info")
    return put_back


def _restore_one(obj, param, old):
    """Put one recorded change back.

    Most records are a component parameter, but a few things a workflow changes are not
    parameters at all: whether a component is enabled, a layer's state, a global
    substitution and where an input control stands each carry a marker name beginning
    with "#" and go back their own way."""
    if param == "#enabled":
        obj.enable(bool(old))
        return
    if param == "#control":
        # A slider, switch or dial the workflow moved: back to the value the case holds.
        obj.reset()
        return
    if param == "#layer":
        _PX["project"].set_layer_state(obj[1], old)
        return
    if param == "#gs":
        gs = _PX["project"].global_substitution
        try:
            active = gs.active_set or ""
        except Exception:
            active = ""
        if not active:
            names = list(gs)
            active = str(names[0]) if names else ""
        gs[active][obj[1]] = px_text(old)
        return
    px_set(obj, param, px_text(old), record=False)

def track_created(obj, kind="component", keep=False, name="", parent=None):
    """Remember something the workflow made so finish() can take it away again.

    What is remembered against it is which mark was open at the time, not how many values
    had been written: a loop pass undoes what that pass made, and something made before
    the pass started stays."""
    _PX["created"].append({"obj": obj, "kind": kind, "keep": bool(keep),
                           "name": str(name or ""), "parent": parent,
                           "mark": _PX["marks"][-1][0] if _PX["marks"] else 0})
    return obj


def delete_created(entry):
    """Delete one thing the workflow made. True when it is gone.

    A project the workflow made is taken out of the workspace, not off the disk: the file
    is a result, and a runtime helper has no business deleting a reader's files."""
    obj, kind = entry.get("obj"), entry.get("kind")
    try:
        if kind == "project":
            if _PX["project"] is obj:
                _PX["project"] = None
            obj.unload()
            log("Unloaded the project %s (its file is still there)."
                % (entry.get("name") or ""), "info")
        elif kind == "layer":
            prj = entry.get("parent") or _PX["project"]
            prj.delete_layer(entry.get("name") or str(obj))
        elif kind == "simset":
            _app().remove_simulation_set(entry.get("name") or str(obj))
        elif kind == "scenario":
            prj = entry.get("parent") or _PX["project"]
            prj.delete_scenario(entry.get("name") or str(obj))
        elif kind == "globalsub":
            prj = entry.get("parent") or _PX["project"]
            prj.global_substitution.remove(entry.get("name") or str(obj))
        elif obj is not None:
            obj.delete()
        return True
    except Exception as err:
        log("Could not remove the %s %s: %s"
            % (kind, entry.get("name") or _label(obj), err), "warn")
        return False


def cleanup_created(only=None):
    """Delete what the workflow made and was not asked to keep, newest first.

    Returns (deleted, names still there)."""
    run_deferred()
    pool = list(only) if only is not None else list(_PX["created"])
    todo = [c for c in pool if not c.get("keep")]
    gone, left = 0, []
    for entry in reversed(todo):
        if delete_created(entry):
            gone += 1
            try:
                _PX["created"].remove(entry)
            except ValueError:
                pass
        else:
            left.append(entry.get("name") or _label(entry.get("obj")))
    if gone:
        log("Removed %d thing%s the workflow made." % (gone, "" if gone == 1 else "s"), "info")
    return gone, left

def px_find(app, defn="", name="", match="one", enabled=False, empty_ok=False, page=""):
    """Find a component in the project: by definition, by Name, or by both.

    `defn` is a definition name as PSCAD writes it, lower-case namespace first:
    "master:source_1", "master:resistor", or a definition of the project itself
    ("Inverter"). `name` matches the component's Name parameter. Either may hold
    `*` and `?`; an empty one matches everything.

    `match` "one" wants exactly one (several is an error naming them), "first" takes the
    first by name, "all" gives a list sorted by name then id. `enabled` leaves out
    disabled components and those on a disabled layer. `page` searches one canvas
    ("Main") instead of the whole project, modules included.

    No match is a [MODEL] error listing the closest definitions and names in the project,
    unless `empty_ok`."""
    prj = _PX["project"] if app is None else _project_of(app)
    if prj is None:
        raise PXError("[CODE] px_find has no project: px_connect() has to run first.")
    defn = str(defn or "").strip()
    name = str(name or "").strip()
    if not defn and not name:
        raise PXError("[CODE] px_find needs a definition or a name to look for.")

    found = _px_search(prj, defn, name, page)
    if enabled:
        kept = [c for c in found if _is_enabled(c)]
        if found and not kept:
            log("Every %s match is disabled or on a disabled layer."
                % (defn or name), "warn")
        found = kept
    found.sort(key=lambda c: (_name_of(c).lower(), _defn_of(c), str(_iid(c))))

    if not found:
        if empty_ok:
            return [] if match == "all" else None
        raise PXError(_px_no_match(prj, defn, name, page))
    if match == "all":
        return found
    if match == "first":
        return found[0]
    if len(found) > 1:
        shown = ", ".join("%s%s" % (_name_of(c) or "(no name)", " " + _defn_of(c))
                          for c in found[:6])
        raise PXError('[MODEL] %d components match %s, and this step needs one: %s%s\n'
                      "  Give the component a Name in PSCAD, or set the match to first or all."
                      % (len(found), _px_query_text(defn, name), shown,
                         ", ..." if len(found) > 6 else ""))
    return found[0]


def _project_of(app):
    """The project the workflow works on; `app` is accepted so the generated code reads well."""
    if _PX["project"] is not None:
        return _PX["project"]
    try:
        return app.focused()
    except Exception:
        return None


def _px_search(prj, defn, name, page=""):
    """Every component of the project (or one page) matching the definition and the name.

    PSCAD's own find_all() takes an exact definition only: a wildcard, a bare definition
    with no namespace and a name pattern all come back empty from it, so anything other
    than an exact definition is answered by listing the pages and filtering here."""
    exact = defn and not any(ch in defn for ch in "*?") and ":" in defn
    if exact and not page:
        try:
            pool = list(prj.find_all(defn) or [])
        except Exception:
            pool = []
        if pool:
            return [c for c in pool if not name or _matches(_name_of(c), name)]
    pool = _page_components(prj, page)
    out = []
    for c in pool:
        if defn and not _matches(_defn_of(c), defn):
            continue
        if name and not _matches(_name_of(c), name):
            continue
        out.append(c)
    return out


def _page_components(prj, page=""):
    """Every component on one page, or on every page of the project, each listed once.

    Walking the project's definitions reaches the module pages too, which is what makes a
    project-wide search find a component drawn three levels down."""
    if page:
        try:
            return list(prj.canvas(str(page)).components() or [])
        except Exception as err:
            raise PXError('[MODEL] %s has no page called "%s": %s'
                          % (getattr(prj, "name", "the project"), page, err))
    key = "pool:" + str(getattr(prj, "name", "") or "")
    cached = _PX.get(key)
    if cached is not None and cached[0] == _PX.get("gen", 0):
        return cached[1]
    try:
        names = list(prj.definitions() or [])
    except Exception as err:
        raise PXError("[MODEL] Could not list the pages of %s: %s"
                      % (getattr(prj, "name", "the project"), err))
    out, seen = [], set()
    for defn_name in names:
        try:
            comps = list(prj.canvas(str(defn_name)).components() or [])
        except Exception:
            continue
        for c in comps:
            mark = _cid(c)
            if mark in seen:
                continue
            seen.add(mark)
            out.append(c)
    _PX[key] = (_PX.get("gen", 0), out)
    return out


def page_changed():
    """Say that the pages have changed, so the next search lists them again."""
    _PX["gen"] = _PX.get("gen", 0) + 1


def _matches(value, pattern):
    """A case-insensitive match; `*` and `?` work, and a bare definition matches its tail.

    "resistor" matches "master:resistor", so a reader need not write the namespace."""
    v, p = str(value or "").lower(), str(pattern or "").lower()
    if fnmatch.fnmatch(v, p):
        return True
    if ":" not in p and ":" in v and fnmatch.fnmatch(v.split(":")[-1], p):
        return True
    return False


def _name_of(obj):
    try:
        got = obj.parameters()
        return str((got or {}).get("Name") or "").strip() if isinstance(got, dict) else ""
    except Exception:
        return ""


def _iid(obj):
    try:
        return obj.iid
    except Exception:
        return 0


def _is_enabled(obj):
    """False when the component is disabled, or sits on a layer that is not Enabled."""
    try:
        if obj.enabled is False:
            return False
    except Exception:
        pass
    try:
        layer = obj.layer
    except Exception:
        return True
    if not layer:
        return True
    try:
        states = _PX["project"].layers() or {}
    except Exception:
        return True
    return str(states.get(str(layer), "Enabled")).lower() == "enabled"


def _px_query_text(defn, name):
    if defn and name:
        return 'definition "%s" named "%s"' % (defn, name)
    if defn:
        return 'definition "%s"' % defn
    return 'the name "%s"' % name


def _px_no_match(prj, defn, name, page=""):
    """A [MODEL] error that says what is actually in the project."""
    lines = ["[MODEL] Nothing in %s matches %s%s."
             % (getattr(prj, "name", "the project"), _px_query_text(defn, name),
                (" on page " + page) if page else "")]
    try:
        pool = _page_components(prj, page)
    except Exception:
        pool = []
    if defn:
        defns = sorted({_defn_of(c) for c in pool if _defn_of(c)})
        near = _closest(defn, defns) or defns[:8]
        if near:
            lines.append("  Definitions in the project: " + ", ".join(near))
    if name:
        names = sorted({_name_of(c) for c in pool if _name_of(c)})
        near = _closest(name, names) or names[:8]
        if near:
            lines.append("  Names in the project: " + ", ".join(near))
    lines.append("  A definition is written namespace first and lower case: master:source_1. "
                 "A component with no Name in PSCAD can only be found by its definition.")
    return "\n".join(lines)

def check_elements(app, queries):
    """CHECK_ONLY: say which components the workflow looks for are there. True when all are."""
    ok = True
    for q in queries:
        defn, name, match = "", "", "one"
        if isinstance(q, (tuple, list)):
            parts = list(q) + ["", "", ""]
            defn, name, match = str(parts[0]), str(parts[1]), str(parts[2] or "one")
        else:
            defn = str(q)
        try:
            got = px_find(app, defn, name, "all")
            log("found %d: %s" % (len(got), _px_query_text(defn, name)), "info")
        except Exception as err:
            ok = False
            log("MISSING: %s\n  %s" % (_px_query_text(defn, name), err), "warn")
    return ok

def finish(app=None):
    """main's `finally`: put the project back the way it was found and tidy up.

    Every step runs even when an earlier one fails, so one bad step never leaves the
    project half changed."""
    app = app or _PX["app"]
    steps = []

    if bool(globals().get("UNDO_CHANGES", True)):
        steps.append(("put changed values back", lambda: px_undo()))
    steps.append(("run the waiting tidy-ups", run_deferred))
    for label, fn in list(_PX["hooks"]):
        steps.append((label, fn))
    steps.append(("remove what the workflow made", lambda: cleanup_created()))
    steps.append(("put the project back", _restore_start))
    if "flush_tables" in globals():
        steps.append(("save the results tables", globals()["flush_tables"]))
    if "log_summary" in globals():
        steps.append(("write the summary", globals()["log_summary"]))

    for label, fn in steps:
        try:
            fn()
        except Exception as err:
            log("Could not %s: %s" % (label, err), "warn")

    _PX["records"], _PX["keys"], _PX["marks"] = [], {}, []
    _PX["created"], _PX["deferred"], _PX["hooks"] = [], [], []
    _PX["said"], _PX["built"] = set(), set()
    return True


def _restore_start():
    """Put back the scenario, the layer states and the simulation settings we found."""
    prj, state = _PX["project"], _PX["start"]
    if prj is None or not state:
        return False
    if state.get("scenario"):
        try:
            if (prj.scenario() or "") != state["scenario"]:
                prj.scenario(state["scenario"])
        except Exception as err:
            log("Could not go back to scenario %s: %s" % (state["scenario"], err), "warn")
    now = {}
    try:
        now = dict(prj.layers() or {})
    except Exception:
        pass
    for name, was in (state.get("layers") or {}).items():
        if name in now and now[name] != was:
            try:
                prj.set_layer_state(name, was)
            except Exception as err:
                log("Could not put layer %s back to %s: %s" % (name, was, err), "warn")
    params = state.get("params") or {}
    if params:
        try:
            prj.parameters(**params)
        except Exception as err:
            log("Could not put the simulation settings back: %s" % err, "warn")
    return True


def add_finish_hook(label, fn):
    """Have finish() run `fn` before it puts the project back."""
    _PX["hooks"].append((label, fn))
    return fn

_PX_NAME_BAD = re.compile(r"[^A-Za-z0-9_]")


def px_clean_name(text, maxlen=30):
    """A name PSCAD accepts: letters, digits and underscores, starting with a letter.

    PSCAD refuses a name with a space, a dot or a dash in it, and one that starts with a
    digit, so "Case 1.2" becomes "Case_1_2" and "3ph" becomes "n3ph"."""
    out = _PX_NAME_BAD.sub("_", str(text or "").strip())
    out = re.sub(r"_+", "_", out).strip("_")
    if not out:
        out = "item"
    if not out[0].isalpha():
        out = "n" + out
    return out[:max(1, int(maxlen))]


class _Bag(object):
    """A small record with named fields, readable as attributes or as keys."""

    def __init__(self, **fields):
        self.__dict__.update(fields)

    def __getitem__(self, key):
        return self.__dict__[key]

    def get(self, key, default=None):
        return self.__dict__.get(key, default)

    def keys(self):
        return self.__dict__.keys()

    def __repr__(self):
        inside = ", ".join("%s=%r" % kv for kv in sorted(self.__dict__.items()))
        return "(%s)" % inside

def layer_list(app, pattern="*"):
    """The project's layers as {name: state}, matching the pattern.

    A PSCAD layer groups components and switches them together between Enabled,
    Disabled and Invisible, which is how a study holds alternative network
    arrangements in one case."""
    import fnmatch
    prj = _PX["project"]
    try:
        got = dict(prj.layers() or {})
    except Exception as err:
        log("Could not list the project's layers: %s" % err, "warn")
        return {}
    low = str(pattern or "*").lower()
    return {k: v for k, v in sorted(got.items()) if fnmatch.fnmatch(str(k).lower(), low)}


def layer_states(app, name):
    """Every state the named layer can take, as PSCAD lists them."""
    try:
        return list(_PX["project"].layer_states(str(name)) or [])
    except Exception as err:
        log("Could not read the states of layer %s: %s" % (name, err), "warn")
        return ["Enabled", "Disabled", "Invisible"]


def layer_set(app, name, state="Enabled"):
    """Put one layer into a state and give the state back. The old state is put back later."""
    prj = _PX["project"]
    name = str(name)
    have = layer_list(app)
    if name not in have:
        raise PXError('[MODEL] The project has no layer called "%s".%s'
                      % (name, ("\n  It has: " + ", ".join(sorted(have)))
                         if have else "\n  It has no layers."))
    want = _layer_state_name(app, name, state)
    if have[name] != want:
        _PX["records"].append({"obj": ("#layer", name), "param": "#layer",
                               "old": have[name], "key": ("#layer:" + name, "#layer")})
        _PX["keys"][("#layer:" + name, "#layer")] = len(_PX["records"]) - 1
        try:
            prj.set_layer_state(name, want)
        except Exception as err:
            _PX["records"].pop()
            raise PXError('[MODEL] Could not put layer "%s" into "%s": %s' % (name, want, err))
    log("Layer %s is %s." % (name, want), "info")
    return want


def _layer_state_name(app, name, state):
    """The state as PSCAD spells it; the nearest one when the spelling is off."""
    want = str(state or "Enabled").strip()
    options = layer_states(app, name)
    for o in options:
        if str(o).lower() == want.lower():
            return str(o)
    near = _closest(want, options)
    if near:
        log('Layer "%s" has no state "%s"; using "%s".' % (name, want, near[0]), "warn")
        return str(near[0])
    return want


def layer_create(app, name, state="Enabled", keep=False, if_exists="reuse"):
    """Make a layer (or take the one that is there) and give it back.

    `if_exists` "reuse" takes an existing layer of that name, "new" numbers a fresh one.
    `keep` False has finish() delete it again."""
    prj = _PX["project"]
    name = px_clean_name(name)
    have = layer_list(app)
    if name in have:
        if if_exists == "reuse":
            log("Layer %s is already there; using it." % name, "info")
            return prj.layer(name)
        n = 2
        while "%s_%d" % (name, n) in have:
            n += 1
        name = "%s_%d" % (name, n)
    try:
        layer = prj.create_layer(name, state)
    except Exception as err:
        raise PXError('[MODEL] Could not create layer "%s": %s' % (name, err))
    track_created(layer, kind="layer", keep=keep, name=name, parent=prj)
    log("Created layer %s (%s)." % (name, state), "info")
    return layer


def layer_add(app, objs, name):
    """Put components on a layer and say how many went on."""
    targets = objs if isinstance(objs, (list, tuple)) else [objs]
    n = 0
    for t in [x for x in targets if x is not None]:
        try:
            t.add_to_layer(str(name))
            n += 1
        except Exception as err:
            log("Could not put %s on layer %s: %s" % (_label(t), name, err), "warn")
    log("Put %d component%s on layer %s." % (n, "" if n == 1 else "s", name), "info")
    return n


def each_layer(app, names, state="Enabled", others="Disabled"):
    """Yield each layer with only it in `state` and the others in `others`.

    The layer states found before the loop are put back however the loop ends."""
    prj = _PX["project"]
    names = [str(getattr(n, "name", n)) for n in (names or [])]
    was = layer_list(app)
    try:
        for name in names:
            for other in names:
                if other != name and others:
                    try:
                        layer_set(app, other, others)
                    except PXError as err:
                        log(str(err), "warn")
            layer_set(app, name, state)
            yield name
    finally:
        now = layer_list(app)
        for key, old in was.items():
            if key in now and now[key] != old:
                try:
                    prj.set_layer_state(key, old)
                except Exception as err:
                    log("Could not put layer %s back to %s: %s" % (key, old, err), "warn")

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
    and the time step."""
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


if __name__ == "__main__":
    main()
# PXB1 {"app":"pscad-builder","v":1,"name":"Every arrangement","nodes":[{"id":"n1","type":"start","x":0,"y":200,"label":"","s":{"project":"C:/Studies/substation/substation.pscx","workspace":"","libraries":"","outputDir":"","undoChanges":true,"tableFmt":"csv","fNominal":"auto","runMode":"auto","showPscad":false,"fortran":"","pscadVersion":"","port":0,"connectTimeout":120},"pin":[],"sv":1},{"id":"n0","type":"note","x":0,"y":-240,"label":"About this template","s":{"text":"A PSCAD layer switches a whole group of components in or out of the build together, so one case can hold several network arrangements. Type the layer names of your own case, or leave a single * to go over every layer there is."},"pin":[],"sv":1},{"id":"n2","type":"px.layer.foreach","x":320,"y":200,"label":"Arrangement","s":{"name":"","layers":"*","state":"Enabled","others":"Disabled","restore":"pass","onError":"skip"},"pin":[],"sv":1},{"id":"n3","type":"px.run","x":660,"y":60,"label":"","s":{"duration":2,"step":50,"plotStep":250,"build":"auto","read":"out","keepFiles":false},"pin":[],"sv":1},{"id":"n4","type":"px.series","x":980,"y":300,"label":"","s":{"channel":"Vbus","combine":"one","label":""},"pin":[],"sv":1},{"id":"n5","type":"sig.peak","x":1300,"y":300,"label":"","s":{"kind":"abs","after":null,"before":null},"pin":[],"sv":1},{"id":"n6","type":"out.table.add","x":1620,"y":60,"label":"","s":{"table":"Arrangements","cols":[{"id":"c1","name":"Peak"},{"id":"c2","name":"Reached (s)"}],"ctx":true,"onSkip":true},"pin":[],"sv":1}],"edges":[{"id":"e1","from":"n1","out":"next","to":"n2","in":"in"},{"id":"e2","from":"n2","out":"body","to":"n3","in":"in"},{"id":"e3","from":"n3","out":"ok","to":"n6","in":"in"},{"id":"e4","from":"n3","out":"result","to":"n4","in":"run"},{"id":"e5","from":"n4","out":"series","to":"n5","in":"series"},{"id":"e6","from":"n5","out":"value","to":"n6","in":"c1"},{"id":"e7","from":"n3","out":"tend","to":"n6","in":"c2"}],"settings":{"WORKFLOW_NAME":["*","name"],"PROJECT":["n1","project"],"WORKSPACE":["n1","workspace"],"LIBRARIES":["n1","libraries"],"OUTPUT_DIR":["n1","outputDir"],"UNDO_CHANGES":["n1","undoChanges"],"TABLE_FORMAT":["n1","tableFmt"],"F_NOMINAL":["n1","fNominal"],"RUN_MODE":["n1","runMode"],"SHOW_PSCAD":["n1","showPscad"],"FORTRAN_VERSION":["n1","fortran"],"PSCAD_VERSION":["n1","pscadVersion"],"PSCAD_PORT":["n1","port"],"CONNECT_TIMEOUT":["n1","connectTimeout"]},"hash":"fnv1a:fc2f6fe3"}
