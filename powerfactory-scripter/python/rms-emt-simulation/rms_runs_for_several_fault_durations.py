#!/usr/bin/env python3
# RMS runs for several fault durations
"""Made with the PowerFactory Workflow Builder, https://tool.adjiebrotots.com/powerfactory-scripter/builder/

BEFORE YOU RUN
  1. Check the SETTINGS below (lines marked REQUIRED).
  2. Close PowerFactory, or run this file from inside PowerFactory (see RUN_MODE).
  3. Run it with the Python that matches your PowerFactory, e.g.  py -3.12 rms_runs_for_several_fault_durations.py
Results and run.log go to a new folder next to this file (or in OUTPUT_DIR).
"""
# ==== IMPORTS ====
import bisect
import csv
import difflib
import fnmatch
import glob
import importlib.util
import math
import os
import re
import subprocess
import sys
import time
import traceback
import warnings

# ==== SETTINGS (edit here) ====
# The name of this workflow: used for the run folder and in the log.
WORKFLOW_NAME = "RMS runs for several fault durations"
# REQUIRED. The PowerFactory project to open, exactly as the Data Manager shows it (letter case
# counts).
PROJECT = "39 Bus New England System"
# OPTIONAL. The study case to activate first ("" = keep the active one).
STUDY_CASE = "2.3 Simulation Fault Bus 31 Stable"
# OPTIONAL. Where each run writes its folder of results and run.log ("" = the folder of this
# script).
OUTPUT_DIR = ""
# OPTIONAL. True: put every value the workflow changed back when it ends.
UNDO_CHANGES = True
# OPTIONAL. How the results tables are saved in the run folder when the run ends: "csv", "xlsx"
# (Excel, needs pandas and openpyxl) or "both".
TABLE_FORMAT = "csv"
# OPTIONAL. Nominal frequency in Hz for the frequency checks: 50, 60 or "auto" (read from the
# grid).
F_NOMINAL = "auto"
# OPTIONAL. "auto", "engine" (start PowerFactory in the background) or "inside" (run from inside
# PowerFactory).
RUN_MODE = "auto"
# OPTIONAL. True: show the PowerFactory window while running (engine mode only).
SHOW_PF = False
# OPTIONAL. True: no screen updates and fewer output window messages while running.
FAST_MODE = True
# OPTIONAL. Seconds to wait for PowerFactory to start.
CONNECT_TIMEOUT = 120
# OPTIONAL. The folder with the powerfactory Python module ("" = find it).
PF_API_PATH = ""
# OPTIONAL. Log in to PowerFactory as this user ("" = your own).
PF_USER = ""

# How every graph of this run looks: set in the Builder (select nothing, then Graph style).
# Colours are hex codes. A value that cannot be used falls back to the Adjie Brotools style.
GRAPH_STYLE = {
    "template": "brotools",                         # where this style started (a name only)
    "colors": ["#5A91E8", "#B45309", "#4A9E87", "#C46A7E", "#9B59B6"],  # in order; more lines repeat them, paler
    "ramp": "blue",                                 # blue, night, viridis, cividis, magma, coolwarm, greys, classic
    "background": "#FFFFFF",
    "plot_background": "#FFFFFF",
    "text": "#14203A",
    "muted": "#4C5B76",
    "grid": "#C8D4E8",
    "axis": "#C8D4E8",
    "font": "DM Sans",
    "font_size": 9.5,                               # points, for the axis numbers (the rest follows)
    "title_size": 13,                               # points
    "title_bold": True,                             # True or False
    "title_align": "center",                        # center, left
    "grid_axes": "both",                            # both, y, x, none
    "grid_style": "solid",                          # solid, dashed, dotted
    "frame": "left-bottom",                         # left-bottom, box, bottom, none
    "ticks": "out",                                 # out, in, none
    "thousands": True,                              # True: 1,200 rather than 1200
    "line_width": 2,                                # points
    "markers": "auto",                              # auto, always, never
    "line_styles": "solid",                         # solid, vary
    "legend": "bottom",                             # bottom, top, right, inside, none
    "legend_frame": False,                          # True or False
    "width": 10,                                    # inches
    "height": 5.6,                                  # inches
    "dpi": 150,                                     # the PNG is width x dpi pixels wide
    "transparent": False,                           # True: no background (for slides)
    "also_save": "",                                # "", svg, pdf
}

# OPTIONAL. Fault duration (s): Values.
FAULT_DURATION_VALUES = [0.1, 0.15, 0.2, 0.25]

# REQUIRED. Fault: Fault at. The name of the element (ElmTerm), exactly as in the Data Manager.
FAULT_TARGET = "Bus 31"

# OPTIONAL. Rotor angle spread (deg): Highest allowed.
ROTOR_ANGLE_SPREAD_HI = 180

# True: connect, find every element named in this workflow, say what was found, then stop
# without running anything.
CHECK_ONLY = False


# ==== WORKFLOW ====
# Note: For each fault duration this applies a three-phase fault at the busbar, runs an RMS simulation for 5 s and records the rotor angle spread of all synchronous generators (the largest minus the smalle...
def main():
    preflight(["matplotlib"])
    app = pf_connect()
    try:
        if CHECK_ONLY:
            check_elements(app, [FAULT_TARGET + ".ElmTerm", ("*.ElmSym", "all")])
            return
        # -- Step 1: Start (Project: 39 Bus New England System) --
        # -- Step 2: Fault duration (s) (4 values: 0.1, 0.15, 0.2, 0.25) --
        fault_duration_s_items = FAULT_DURATION_VALUES
        for fault_duration_s_pass_no, fault_duration_s in enumerate(fault_duration_s_items, 1):
            ctx_push("Fault duration (s)", fault_duration_s, fault_duration_s_pass_no, len(fault_duration_s_items))
            mark = pf_mark()
            try:
                # -- Step 3: Fault (three-phase at Bus 31 at 1 s, cleared after 0.1 s) --
                add_short_circuit(app, "n4", pf_find(app, FAULT_TARGET + ".ElmTerm", "one"), 1, fault_duration_s, 0, 0, None, "fault", "3ph", None)
                # -- Step 4: Run RMS simulation (To 5 s, recording 1 curve) --
                rec = pf_find(app, "*.ElmSym", "all")
                rms = run_rms(app, 5, None, None, monitors=[], monitor_lists=[(rec, "c:firel")], net="case", case_events="auto", fast=False, extend_to=0)
                rotor_angle_deg = rms.series_combined(rec, "c:firel", "spread", "Spread of * \u00b7 Rotor angle (deg)")
                # Did not initialise: skips to the next pass of Fault duration (s)
                if not ((rms.status == "ok") or (rms.status == "early")):
                    case_skipped("RMS simulation did not initialise")
                    continue
                # -- Step 5: Rotor angle spread (deg) (At most 180, goes on either way) --
                rotor_angle_spread_deg_result = check_limits(rotor_angle_deg, lo=None, hi=ROTOR_ANGLE_SPREAD_HI, after=None, before=None)
                if rotor_angle_spread_deg_result.ok is None:
                    log("Rotor angle spread (deg): NO DATA (" + str(rotor_angle_spread_deg_result.get("reason") or "nothing to check") + "), so it did not pass.", "warn")
                # -- Step 6: Add row to results table (Into "RMS runs", saved at the end automatically) --
                peak_spread = peak(rotor_angle_deg, kind="max", after=None, before=None)  # Peak spread
                table("RMS runs").add({
                    "Peak rotor angle spread (deg)": peak_spread.value,
                    "Stable": rotor_angle_spread_deg_result.text,
                }, status=True)
                # -- Step 7: Rotor angle spread (Every pass on one graph) --
                collect_series("n9", [rotor_angle_deg])
            except StopWorkflow:
                raise
            except Exception as err:
                case_failed(err)
            finally:
                try:
                    pf_undo(mark)
                except Exception as fin:
                    log(f"Could not put things back after this pass: {fin}", "error")
                ctx_pop(["RMS runs"])
        draw_collected("n9", title="Rotor angle spread", ylabel="Rotor angle spread", unit=None, limits=[], events=True, stem=None)
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

_PF = {
    "app": None, "pf": None, "mode": "", "echo": True,
    "start": None,      # {"case", "scenario"} active when the workflow opened the project
    "records": [],      # undo records, oldest first: {"obj", "attr", "old", "case", "scen", "key"}
    "keys": {},         # (object, attribute, case, scenario) -> index of its latest record
    "marks": [],        # (id, record count) of the marks still open, innermost last (pf_mark / pf_undo)
    "created": [],      # objects the workflow made: {"obj", "kind", "keep", "name", "cls", "parent"}
    "deferred": [],     # [(label, fn)] tidy-ups that wait for the next calculation (run_deferred)
    "hooks": [],        # [(label, fn)] restores finish() runs before re-activating the start case
    "said": set(),      # messages logged once
    "fnom": {},         # grid full name -> nominal frequency (f_nominal)
    "saved": {},        # operation scenario full name -> how many records were written when it
                        # was last saved; pf_undo leaves those values in it (scenario_save)
}
PFB = "PFB_"


class PFError(Exception):
    """A PowerFactory step could not be done; the message says why in plain words."""


def _app():
    app = _PF["app"]
    if app is None:
        raise PFError("[CODE] PowerFactory is not connected: pf_connect() has to run first.")
    return app


def _full(obj):
    if obj is None:
        return ""
    try:
        return obj.GetFullName()
    except Exception:
        return str(obj)


def _nm(obj):
    try:
        return obj.loc_name
    except Exception:
        return str(obj)


def _same(a, b):
    """DataObjects compare by identity of the PowerFactory object; None only equals None."""
    if a is None or b is None:
        return a is None and b is None
    try:
        return a == b or _full(a) == _full(b)
    except Exception:
        return False


def _alive(obj):
    try:
        return obj is not None and not obj.IsDeleted()
    except Exception:
        return False


def _say_once(key, msg, level="info"):
    if key in _PF["said"]:
        return
    _PF["said"].add(key)
    log(msg, level)


def _context(app=None):
    """The study case and operation scenario active now."""
    app = app or _app()
    return app.GetActiveStudyCase(), app.GetActiveScenario()


def _enter_context(app, case, scen):
    """Make `case` and `scen` (None = no scenario) the active ones, switching only what differs.
    Activating another scenario keeps unsaved changes of the old one in memory (checked live);
    Deactivate() drops them, which only happens when the target context has no scenario."""
    if case is not None and _alive(case) and not _same(app.GetActiveStudyCase(), case):
        if case.Activate() != 0 and not _same(app.GetActiveStudyCase(), case):
            log(f"Could not re-activate study case '{_nm(case)}'.", "warn")
            return False
    active = app.GetActiveScenario()
    if scen is None:
        if active is not None:
            active.Deactivate()
    elif _alive(scen) and not _same(active, scen):
        scen.Activate()
    return True


def _defer(label, fn):
    """Keep a tidy-up (such as deleting a temporary result file) until the next calculation, so
    the results of the last one stay readable until then."""
    _PF["deferred"].append((label, fn))


def run_deferred():
    """Run the tidy-ups the last calculation left (called before every calculation and at the end)."""
    todo, _PF["deferred"] = _PF["deferred"], []
    for label, fn in todo:
        try:
            fn()
        except Exception as e:
            log(f"Could not {label}: {e}", "warn")

def pf_messages(app=None, clear=True, errors_only=False, last=None):
    """PowerFactory's own messages since the last call, as plain lines ("Error: No convergence in
    load flow."). clear=True empties the message list, so the next call only sees new messages."""
    app = app or _PF["app"]
    if app is None:
        return []
    try:
        win = app.GetOutputWindow()
        raw = win.GetContent()
        if clear:
            win.Clear()
    except Exception:
        return []
    out = []
    for line in raw:
        text = " ".join(str(line).split())
        if not text:
            continue
        m = re.match(r"^(err|wrn|warn|info|dbg)\s*-\s*(.*)$", text)
        if m:
            kind, text = m.group(1), m.group(2)
            if kind == "err":
                text = "Error: " + text
            elif kind in ("wrn", "warn"):
                text = "Warning: " + text
        if errors_only and not text.startswith("Error:"):
            continue
        out.append(text)
    return out[-last:] if last else out

# The watchdog is a separate process because GetApplicationExt() and ActivateProject() can block
# forever while holding the GIL when the licence or the database is held elsewhere: no thread in
# this process could stop them. It writes its message to run.log, then ends this process (exit 3).
_WATCHDOG = (
    "import sys, time, ctypes\n"
    "pid, t, path, msg = int(sys.argv[1]), float(sys.argv[2]), sys.argv[3], sys.argv[4]\n"
    "time.sleep(t)\n"
    "line = time.strftime('[%H:%M:%S] ERROR ') + msg\n"
    "try:\n"
    "    print(line, flush=True)\n"
    "except Exception:\n"
    "    pass\n"
    "try:\n"
    "    open(path, 'a', encoding='utf-8').write(line + '\\n')\n"
    "except Exception:\n"
    "    pass\n"
    "h = ctypes.windll.kernel32.OpenProcess(1, 0, pid)\n"
    "ctypes.windll.kernel32.TerminateProcess(h, 3)\n")

_PF_ERRORS = {
    4002: "Another PowerFactory (the program itself, or an earlier script that is still running) "
          "holds the database. Close it, wait about 45 s and run this file again.",
    7000: "PowerFactory was already started once in this Python process. Run the file again in a "
          "new Python process.",
    3010: "[MODEL] Your PowerFactory licence does not include Scripting and Automation, so no "
          "script can drive it. Ask your licence administrator.",
    3018: "The licence has no free seat. Close another PowerFactory and run this file again.",
    3000: "No PowerFactory licence was found (dongle, softkey or licence server). Check the "
          "Licence Manager, then run this file again.",
}


def _stop(msg):
    """Log a connect problem in plain words and end the script."""
    log(msg, "error")
    raise SystemExit("PowerFactory connect failed: " + msg)


def _pyver():
    return f"{sys.version_info.major}.{sys.version_info.minor}"


def _api_path():
    """The PowerFactory Python API folder for this Python: PF_API_PATH when given, else the
    'Python\\<this version>' folder of an installed PowerFactory (2024 first, then newest)."""
    given = str(globals().get("PF_API_PATH", "") or "").strip()
    if given:
        if os.path.isfile(os.path.join(given, "powerfactory.pyd")):
            return given
        _stop(f"PF_API_PATH is '{given}', but there is no powerfactory.pyd in that folder. Use the "
              f"'Python\\{_pyver()}' folder of your PowerFactory, or leave PF_API_PATH empty to find it.")
    roots = set()
    for base in (os.environ.get("ProgramW6432"), os.environ.get("ProgramFiles"), r"C:\Program Files"):
        if base:
            roots.update(glob.glob(os.path.join(base, "DIgSILENT", "PowerFactory 20*")))
    # PowerFactory 2024 first (the version the Builder is tested on), then the newest others.
    roots = sorted((p for p in roots if "2024" in p), reverse=True) + sorted((p for p in roots if "2024" not in p), reverse=True)
    found = {}
    for root in roots:
        cand = os.path.join(root, "Python", _pyver())
        if os.path.isfile(os.path.join(cand, "powerfactory.pyd")):
            return cand
        vers = sorted((os.path.basename(p) for p in glob.glob(os.path.join(root, "Python", "*"))
                       if os.path.isfile(os.path.join(p, "powerfactory.pyd"))),
                      key=lambda v: [int(x) if x.isdigit() else 0 for x in v.split(".")])
        found[os.path.basename(root)] = vers
    if not found:
        _stop("No PowerFactory installation was found under Program Files\\DIgSILENT. Set PF_API_PATH "
              "to the 'Python\\3.x' folder of your PowerFactory.")
    have = "; ".join(f"{k} has API folders for Python {', '.join(v) or 'none'}" for k, v in found.items())
    best = next((v[-1] for v in found.values() if v), "3.12")
    script = os.path.basename(sys.argv[0]) if sys.argv and sys.argv[0] else "this_file.py"
    _stop(f"This is Python {_pyver()}. {have}. Run this file with one of those, for example:  "
          f"py -{best} {script}   (or set PF_API_PATH).")


def _inside_powerfactory():
    """True when this Python runs inside the PowerFactory program (a Python script object): the
    process is then PowerFactory.exe, not python.exe."""
    try:
        import ctypes
        buf = ctypes.create_unicode_buffer(1024)
        ctypes.windll.kernel32.GetModuleFileNameW(None, buf, 1024)
        return os.path.basename(buf.value).lower().startswith("powerfactory")
    except Exception:
        return False


def _run_mode():
    mode = str(globals().get("RUN_MODE", "auto") or "auto").strip().lower()
    if mode not in ("auto", "engine", "inside"):
        log(f"RUN_MODE '{mode}' is not one of auto, engine, inside; using auto.", "warn")
        mode = "auto"
    if mode == "auto":
        mode = "inside" if _inside_powerfactory() else "engine"
    return mode


def _gui_running():
    try:
        out = subprocess.run(["tasklist", "/FI", "IMAGENAME eq PowerFactory.exe", "/FO", "CSV"],
                             capture_output=True, text=True, timeout=20).stdout
        return "PowerFactory.exe" in out
    except Exception:
        return False


def _connect_engine():
    if _gui_running():
        _stop("PowerFactory is open on this PC, and only one PowerFactory can use the database. "
              "Either close PowerFactory, wait about 45 s and run this file again, or run this file "
              "from inside PowerFactory (in a Python script object, with RUN_MODE = \"inside\").")
    path = _api_path()
    if path not in sys.path:
        sys.path.insert(0, path)
    try:
        import powerfactory as pf
    except Exception as e:
        _stop(f"Could not load the PowerFactory Python module from {path} ({e}). This is Python "
              f"{_pyver()}; the API folder has to be the one for the same Python version.")
    _PF["pf"] = pf
    timeout = float(globals().get("CONNECT_TIMEOUT", 120) or 120)
    msg = (f"PowerFactory did not start within {timeout:g} s (CONNECT_TIMEOUT), so the script was "
           "stopped (exit code 3). Usually the licence or the database is still held by another "
           "PowerFactory: close it, wait about 45 s and run this file again.")
    watchdog = subprocess.Popen([sys.executable, "-c", _WATCHDOG, str(os.getpid()), str(timeout),
                                 os.path.join(run_dir(), "run.log"), msg], creationflags=0x08000000)
    t0 = time.time()
    try:
        user = str(globals().get("PF_USER", "") or "").strip()
        try:
            app = pf.GetApplicationExt(user) if user else pf.GetApplicationExt()
        except pf.ExitError as e:
            code = getattr(e, "code", None)
            _stop(_PF_ERRORS.get(code, f"PowerFactory refused to start (error {code}: {e}). Look the "
                                       "code up in the PowerFactory error code list, then run again."))
        if app is None:
            _stop("PowerFactory did not start (no application returned). Check the installation and "
                  "the licence, then run this file again.")
        _PF["app"] = app
        _open_project(app)
    finally:
        watchdog.kill()
    try:
        if globals().get("SHOW_PF", False):
            app.Show()
        else:
            app.Hide()
    except Exception:
        pass
    log(f"Connected to PowerFactory in {time.time() - t0:.1f} s (engine mode, Python {_pyver()}, API {path}).")
    return app


def _connect_inside():
    try:
        import powerfactory as pf
        app = pf.GetApplication()
    except Exception as e:
        app, pf = None, None
        err = str(e)
    else:
        err = ""
    if app is None:
        _stop("RUN_MODE is \"inside\", but this file is not running inside PowerFactory"
              + (f" ({err})" if err else "") + ". Set RUN_MODE = \"auto\" or \"engine\".")
    _PF["pf"], _PF["app"] = pf, app
    _open_project(app)
    log("Running inside PowerFactory.")
    return app


def _open_project(app):
    want = str(globals().get("PROJECT", "") or "").strip()
    active = app.GetActiveProject()
    if not want:
        if active is None:
            _stop("PROJECT is empty and no project is active. Set PROJECT to the project name as "
                  "shown in the Data Manager.")
    elif active is None or active.loc_name != want:
        rc = app.ActivateProject(want)
        active = app.GetActiveProject()
        if rc != 0 or active is None or active.loc_name != want.split("\\")[-1].replace(".IntPrj", ""):
            names = []
            try:
                names = sorted(p.loc_name for p in app.GetCurrentUser().GetContents("*.IntPrj", 1))
            except Exception:
                pass
            close = difflib.get_close_matches(want, names, n=8, cutoff=0.3) or names[:8]
            _stop(f"[MODEL] Could not open the project '{want}'. Closest names: {', '.join(close) or 'none'} "
                  f"({len(names)} projects for this user). Names are exact and letter case counts; "
                  "if the name is right, the project may be open in another PowerFactory.")
    if _PF["start"] is None:
        _PF["start"] = {"case": app.GetActiveStudyCase(), "scenario": app.GetActiveScenario()}
    _open_case(app)
    case, scen = _context(app)
    log(f"Project: {active.loc_name}; study case: {_nm(case) if case else 'none'}; "
        f"operation scenario: {_nm(scen) if scen else 'none'}.")
    if globals().get("FAST_MODE", True):
        app.EchoOff()
        _PF["echo"] = False


def _open_case(app):
    want = str(globals().get("STUDY_CASE", "") or "").strip()
    folder = app.GetProjectFolder("study")
    cases = sorted(folder.GetContents("*.IntCase", 1) if folder else [], key=lambda c: (c.loc_name, _full(c)))
    if not want:
        if app.GetActiveStudyCase() is None:
            _stop(f"[MODEL] No study case is active in this project. Set STUDY_CASE to one of: "
                  f"{', '.join(c.loc_name for c in cases[:12])}.")
        return
    hits = [c for c in cases if c.loc_name == want] or [c for c in cases if c.loc_name.lower() == want.lower()]
    if not hits:
        close = difflib.get_close_matches(want, [c.loc_name for c in cases], n=8, cutoff=0.3) or [c.loc_name for c in cases[:8]]
        _stop(f"[MODEL] No study case called '{want}'. Closest names: {', '.join(close)} "
              f"({len(cases)} study cases in the project).")
    if len(hits) > 1:
        log(f"{len(hits)} study cases are called '{want}'; using {_full(hits[0])}.", "warn")
    if not _same(app.GetActiveStudyCase(), hits[0]) and hits[0].Activate() != 0:
        _stop(f"[MODEL] Could not activate the study case '{want}'.")


def pf_connect():
    """Start or attach to PowerFactory and open PROJECT and STUDY_CASE (from SETTINGS).

    RUN_MODE "auto" runs inside PowerFactory when this file is started from a Python script object
    there, and otherwise starts PowerFactory in the background ("engine"), which needs the
    PowerFactory program to be closed. The study case and operation scenario active when the
    project opened are remembered, and finish() puts them back. Calling it again reuses the same
    PowerFactory (it can only be started once per Python process)."""
    if _PF["app"] is not None:
        _open_project(_PF["app"])
        return _PF["app"]
    mode = _run_mode()
    _PF["mode"] = mode
    return _connect_inside() if mode == "inside" else _connect_engine()

def preflight(modules=None):
    """Checks that take a second and save a long run: every Python package the workflow needs
    (for graphs or Excel files) can be imported, and, outside PowerFactory, that this Python has a
    matching PowerFactory API folder. On a problem it says what to install or run, and stops."""
    mods = list(modules if modules is not None else globals().get("PREFLIGHT_MODULES", ()))
    missing = [m for m in mods if importlib.util.find_spec(m) is None]
    if missing:
        pip = {"sklearn": "scikit-learn", "skopt": "scikit-optimize", "yaml": "pyyaml"}
        names = " ".join(pip.get(m, m) for m in missing)
        msg = (f"This workflow needs the Python package(s) {', '.join(missing)}, which this Python "
               f"cannot import. Install with:  \"{sys.executable}\" -m pip install {names}")
        log(msg, "error")
        raise SystemExit(msg)
    if _run_mode() == "engine":
        _api_path()
    log(f"Preflight OK: Python {_pyver()}" + (f", packages {', '.join(mods)}" if mods else "") + ".")
    return True

_PLAIN = {
    "ElmSym": "synchronous generator", "ElmGenstat": "static generator", "ElmPvsys": "PV system",
    "ElmAsm": "asynchronous machine", "ElmVsc": "VSC converter", "ElmTerm": "busbar or terminal",
    "ElmLne": "line", "ElmTr2": "2-winding transformer", "ElmTr3": "3-winding transformer",
    "ElmLod": "load", "ElmXnet": "external grid", "ElmShnt": "shunt", "ElmCoup": "breaker or switch",
    "StaSwitch": "switch", "ElmDsl": "DSL model", "ElmComp": "composite model", "ElmNet": "grid",
    "ElmRes": "result file", "IntCase": "study case", "IntScenario": "operation scenario",
    "IntScheme": "variation", "ElmSvs": "static var system", "ElmZone": "zone", "ElmArea": "area",
}


def _plain(cls, n=1):
    word = _PLAIN.get(cls, cls)
    return word if n == 1 else (word + "es" if word.endswith(("s", "ch")) else word + "s")


def _split_query(query):
    q = str(query).strip()
    m = re.match(r"^(.*)\.([A-Z][a-z]{2}[A-Za-z0-9]*)$", q)
    if not m:
        raise PFError(f"[CODE] The element '{q}' needs its class after a dot, for example 'G 02.ElmSym'.")
    return m.group(1), m.group(2)


def _pool(app, cls, pattern="*"):
    """Every object of the class that a search could mean, from the right place: study cases,
    scenarios and variations from their project folders, types from the equipment library, events
    from the active study case's event list, commands and result files from the active study case,
    and everything else from the active grids (GetCalcRelevantObjects, which also lists elements
    that are out of service)."""
    query = f"{pattern}.{cls}"
    folder_of = {"IntCase": "study", "IntScenario": "scen", "IntScheme": "scheme"}
    if cls in folder_of:
        f = app.GetProjectFolder(folder_of[cls])
        return list(f.GetContents(query, 1)) if f else []
    if cls.startswith("Typ"):
        f = app.GetProjectFolder("equip")
        return list(f.GetContents(query, 1)) if f else []
    case = app.GetActiveStudyCase()
    if cls.startswith("Evt"):
        inc = case.GetContents("*.ComInc") if case else []
        evf = inc[0].GetAttribute("p_event") if inc else None
        hits = list(evf.GetContents(query, 1)) if evf else []
        return hits or (list(case.GetContents(query, 1)) if case else [])
    if cls.startswith("Com") or cls in ("ElmRes", "IntEvt", "SetSelect"):
        return list(case.GetContents(query, 1)) if case else []
    return list(app.GetCalcRelevantObjects(query))


def _sorted(objs):
    return sorted(objs, key=lambda o: (_nm(o), _full(o)))


def pf_find(app, query, match="one", in_service=False, empty_ok=False):
    """Find elements by name and class, for example "G 02.ElmSym" or "Line*.ElmLne".

    match "one" expects exactly one element, "first" takes the first by name, "all" returns the
    list sorted by name. Names are exact first; when nothing matches, a match that differs only in
    letter case is used with a warning. With no match the error lists the closest names. in_service
    leaves out elements that are out of service."""
    name, cls = _split_query(query)
    hits = _pool(app, cls, name) if name else []
    # An exact name counts first, so a name with [ ] in it ("T1 [HV]") is not read as a pattern.
    hits = [o for o in hits if _nm(o) == name or fnmatch.fnmatchcase(_nm(o), name)]
    if not hits and name:
        allc = _pool(app, cls)
        ci = [o for o in allc if _nm(o).lower() == name.lower() or fnmatch.fnmatchcase(_nm(o).lower(), name.lower())]
        if ci and (len(ci) == 1 or match != "one"):
            log(f"No {_plain(cls)} is called '{name}' with that letter case; using "
                f"{', '.join(_nm(o) for o in _sorted(ci)[:5])}.", "warn")
            hits = ci
    if in_service:
        out = []
        for o in hits:
            try:
                if o.GetAttribute("outserv") == 0:
                    out.append(o)
            except Exception:
                out.append(o)
        if hits and not out:
            raise PFError(f"[MODEL] Every {_plain(cls)} matching '{name}' is out of service.")
        hits = out
    hits = _sorted(hits)
    if not hits:
        if empty_ok:
            return [] if match == "all" else None
        allc = _sorted(_pool(app, cls))
        names = [_nm(o) for o in allc]
        close = difflib.get_close_matches(name, names, n=8, cutoff=0.3) or names[:8]
        case = app.GetActiveStudyCase()
        where = f" in study case '{_nm(case)}'" if case is not None and not cls.startswith(("Int", "Typ")) else ""
        raise PFError(f"[MODEL] No {_plain(cls)} ({cls}) called '{name}'{where}. "
                      f"Closest names: {', '.join(close) if close else 'none'} ({len(names)} {_plain(cls, len(names))}). "
                      "Names are exact, letter case counts and * matches anything.")
    if match == "all":
        return hits
    if match == "one" and len(hits) > 1:
        raise PFError(f"[MODEL] '{name}' matches {len(hits)} {_plain(cls, len(hits))}: "
                      f"{', '.join(_nm(o) for o in hits[:8])}{' ...' if len(hits) > 8 else ''}. "
                      "Use a more exact name, or match 'first' or 'all'.")
    return hits[0]

def check_elements(app, queries):
    """CHECK_ONLY run: look up every element the workflow names and report what was found, so a
    wrong name shows up in seconds instead of after a long study. queries: "Name.Class" texts or
    (query, match) pairs. Returns True when every element was found."""
    ok = 0
    items = list(queries or [])
    for q in items:
        query, match = (q, "one") if isinstance(q, str) else (q[0], q[1] if len(q) > 1 else "one")
        try:
            found = pf_find(app, query, match)
            names = ", ".join(_nm(o) for o in (found if isinstance(found, list) else [found]))
            log(f"  found    {query}: {names}")
            ok += 1
        except Exception as e:
            log(f"  MISSING  {query}: {e}", "error")
    level = "info" if ok == len(items) else "error"
    log(f"Element check: {ok} of {len(items)} found." + ("" if ok == len(items) else
        " Fix the names in the Builder or in SETTINGS, then run again."), level)
    return ok == len(items)

def pf_mark():
    """A point to go back to: pf_undo(mark) puts back every value written after it and makes the
    study case and scenario active again that were active here. Loops take one per pass."""
    app = _PF["app"]
    case, scen = _context(app) if app is not None else (None, None)
    n = len(_PF["records"])
    _PF["seq"] = mid = _PF.get("seq", 0) + 1
    _PF["marks"].append((mid, n))
    return {"id": mid, "n": n, "case": case, "scen": scen, "created": len(_PF["created"])}

def pf_undo(mark=None):
    """Put back every value pf_set changed since mark (since the start when mark is None), each in
    the study case and operation scenario it was written in, then make the case and scenario of the
    mark active again (with no mark: the ones active when pf_undo was called). Elements the
    workflow created after the mark (test generators) are taken out of service; finish() deletes
    them. A scenario the workflow saved keeps its saved values. Returns how many values were put
    back."""
    app = _PF["app"]
    if app is None:
        return 0
    n0 = mark["n"] if mark else 0
    back = (mark["case"], mark["scen"]) if mark else _context(app)
    recs = list(enumerate(_PF["records"][n0:], n0))
    # Each (element, attribute, case, scenario) has one record (its first original), so the order
    # between contexts does not matter. Contexts without a scenario go first: leaving a scenario
    # for none drops its unsaved changes, which must not undo what was just put back in it.
    groups = []
    for at, rec in reversed(recs):
        for gr in groups:
            if _same(gr[0], rec["case"]) and _same(gr[1], rec["scen"]):
                gr[2].append((at, rec))
                break
        else:
            groups.append((rec["case"], rec["scen"], [(at, rec)]))
    groups.sort(key=lambda gr: gr[1] is not None)
    put, bad, kept = 0, 0, 0
    for case, scen, items in groups:
        # A scenario the workflow saved keeps what that save captured: the reader asked for those
        # values to live in it, so putting the model back must not empty it again. Changes made
        # after the save are not part of it and are put back as usual.
        upto = _PF["saved"].get(_full(scen)) if scen is not None else None
        if upto is not None and any(at < upto for at, _ in items):
            kept += sum(1 for at, _ in items if at < upto)
            items = [(at, rec) for at, rec in items if at >= upto]
            if not items:
                continue
        _enter_context(app, case, scen)
        for _at, rec in items:
            if not _alive(rec["obj"]):
                continue
            try:
                rec["obj"].SetAttribute(rec["attr"], rec["old"])
                put += 1
            except Exception as e:
                bad += 1
                log(f"Could not put back {_nm(rec['obj'])}.{rec['attr']} = {rec['old']!r}: {e}", "warn")
    if kept:
        log(f"{kept} value(s) stay in the operation scenario(s) the workflow saved.")
    del _PF["records"][n0:]
    # The records this undo took away are gone, so a save that counted them would now point past
    # the end and keep records written later. Each one counts at most what is left.
    _PF["saved"] = {k: min(v, n0) for k, v in _PF["saved"].items()}
    _PF["keys"] = {rec["key"]: i for i, rec in enumerate(_PF["records"])}
    ids = [m[0] for m in _PF["marks"]]
    if not mark:
        _PF["marks"] = []
    elif mark.get("id") in ids:
        del _PF["marks"][ids.index(mark["id"]):]   # this mark and the ones opened inside it
    else:
        _PF["marks"] = [m for m in _PF["marks"] if m[1] < n0]
    _enter_context(app, *back)
    if mark:
        # In the mark's context, so the service flag lands where the next pass reads it.
        for c in _PF["created"][mark["created"]:]:
            if c["kind"] == "element" and _alive(c["obj"]):
                try:
                    c["obj"].SetAttribute("outserv", 1)
                except Exception:
                    pass
    if put or bad:
        log(f"Put back {put} changed value{'s' if put != 1 else ''}" + (f" ({bad} could not be put back)" if bad else "") + ".",
            "debug" if mark else "info")
    return put

def set_seconds(obj, attr, seconds):
    """Write a time attribute in seconds whatever unit the project shows (a project can show
    simulation times in ms, and SetAttribute uses the shown unit: 0.01 would become 0.01 ms)."""
    app = _app()
    app.SetAttributeModeInternal(1)
    try:
        obj.SetAttribute(attr, float(seconds))
    finally:
        app.SetAttributeModeInternal(0)


def get_seconds(obj, attr):
    """Read a time attribute in seconds whatever unit the project shows."""
    app = _app()
    app.SetAttributeModeInternal(1)
    try:
        return obj.GetAttribute(attr)
    finally:
        app.SetAttributeModeInternal(0)

def track_created(obj, kind="object", keep=False):
    """Note an object the workflow made, so finish() can delete it (unless keep). kind is one of
    event, res, vec, command, case, scenario, variation, element, cubicle, select, object."""
    if obj is None:
        return obj
    if any(_same(c["obj"], obj) for c in _PF["created"]):
        return obj
    try:
        parent = obj.GetParent()
    except Exception:
        parent = None
    _PF["created"].append({"obj": obj, "kind": kind, "keep": bool(keep), "name": _nm(obj),
                           "cls": obj.GetClassName(), "parent": parent})
    return obj


def _delete_one(app, c):
    """Delete one created object and check it is gone. Delete() fails silently for an object the
    last calculation used, which is why cleanup calls ResetCalculation() first."""
    obj = c["obj"]
    if not _alive(obj):
        return True
    if c["kind"] == "scenario" and _same(app.GetActiveScenario(), obj):
        obj.Deactivate()
    if c["kind"] == "variation":
        try:
            if any(_same(v, obj) for v in app.GetActiveNetworkVariations()):
                obj.Deactivate()
        except Exception:
            pass
    if c["kind"] == "case" and _same(app.GetActiveStudyCase(), obj):
        log(f"Study case '{c['name']}' is still active, so it cannot be deleted.", "warn")
        return False
    try:
        obj.Delete()
    except Exception:
        pass
    if not _alive(obj):
        return True
    parent = c["parent"]
    try:
        return not parent.GetContents(f"{c['name']}.{c['cls']}")
    except Exception:
        return False


def delete_created(app, obj):
    """Delete one object the workflow made now (after ResetCalculation) and forget it."""
    for c in list(_PF["created"]):
        if _same(c["obj"], obj):
            app.ResetCalculation()
            if _delete_one(app, c):
                _PF["created"].remove(c)
                return True
            return False
    return False


def cleanup_created(app=None):
    """Delete everything the workflow made that it was not asked to keep, newest first, and check
    each one is gone. Returns (deleted, names left)."""
    app = app or _PF["app"]
    todo = [c for c in _PF["created"] if not c["keep"]]
    if app is None or not todo:
        return 0, []
    app.ResetCalculation()
    gone, left = 0, []
    for c in reversed(todo):
        if _delete_one(app, c):
            gone += 1
            _PF["created"].remove(c)
        else:
            left.append(c["name"])
    if left:
        app.ResetCalculation()
        for c in [c for c in _PF["created"] if not c["keep"] and c["name"] in left]:
            if _delete_one(app, c):
                left.remove(c["name"])
                _PF["created"].remove(c)
                gone += 1
    if gone:
        log(f"Removed {gone} object{'s' if gone != 1 else ''} the workflow had made.")
    if left:
        log(f"Could not remove: {', '.join(left)}. Delete them by hand (their names start with {PFB}).", "warn")
    return gone, left

def f_nominal(app, obj=None):
    """The nominal frequency in Hz: F_NOMINAL when it is 50 or 60, otherwise ("auto") the nominal
    frequency of the grid the element belongs to (or of the project's first grid). Logged once."""
    setting = globals().get("F_NOMINAL", "auto")
    try:
        if setting not in (None, "", "auto"):
            return float(setting)
    except (TypeError, ValueError):
        pass
    grid = None
    for get in (lambda o: o.GetAttribute("cpGrid"),
                lambda o: o.GetAttribute("bus1").GetAttribute("cterm").GetAttribute("cpGrid")):
        if obj is not None and grid is None:
            try:
                grid = get(obj)
            except Exception:
                grid = None
    if grid is None:
        # The project's own grids only: each study case also holds a "Summary Grid" whose frnom
        # need not match (50 Hz on the 60 Hz New England demo).
        folder = app.GetProjectFolder("netdat")
        grids = sorted(folder.GetContents("*.ElmNet", 1), key=_nm) if folder else []
        grid = grids[0] if grids else None
    if grid is None:
        _say_once("fnom?", "No grid found to read the nominal frequency from; using 50 Hz.", "warn")
        return 50.0
    key = _full(grid)
    if key not in _PF["fnom"]:
        _PF["fnom"][key] = float(grid.GetAttribute("frnom"))
        log(f"Nominal frequency {_PF['fnom'][key]:g} Hz (from grid '{_nm(grid)}').")
    return _PF["fnom"][key]

def _restore_start(app):
    start = _PF["start"] or {}
    case, scen = start.get("case"), start.get("scenario")
    if case is not None and _alive(case):
        _enter_context(app, case, scen if _alive(scen) else None)


def _sweep_prefix(app):
    """Delete PFB_ leftovers in the active study case (for example events from an earlier run that
    stopped half way), so no object with the Builder's prefix stays behind."""
    case = app.GetActiveStudyCase()
    if case is None:
        return
    left = [o for o in case.GetContents(PFB + "*", 1) if _alive(o)]
    if left:
        app.ResetCalculation()
        for o in left:
            try:
                o.Delete()
            except Exception:
                pass
        log(f"Removed {len(left)} leftover object(s) named {PFB}... from study case '{_nm(case)}'.")


def finish(app=None):
    """The end of every workflow (main's finally): put changed values back when UNDO_CHANGES,
    tidy up after the last calculation, restore variations, make the study case and scenario
    active again that were active at the start, delete what the workflow made (events, temporary
    result files, test generators, cases it was not asked to keep), switch echo back on, save
    unsaved tables and log the summary. Each step runs even when an earlier one fails."""
    app = app or _PF["app"]
    steps = []
    if app is not None:
        if globals().get("UNDO_CHANGES", True):
            steps.append(("put changed values back", lambda: pf_undo()))
        elif _PF["records"]:
            log(f"UNDO_CHANGES is off: {len(_PF['records'])} changed values stay in the project.", "warn")
        steps.append(("tidy up after the last calculation", run_deferred))
        for label, fn in list(_PF["hooks"]):
            steps.append((label, fn))
        steps.append(("re-activate the study case of the start", lambda: _restore_start(app)))
        steps.append(("remove what the workflow made", lambda: cleanup_created(app)))
        steps.append(("remove leftover objects", lambda: _sweep_prefix(app)))
    for label, fn in steps:
        try:
            fn()
        except Exception as e:
            log(f"Could not {label}: {type(e).__name__}: {e}", "error")
    if app is not None:
        for fn in (lambda: app.SetAttributeModeInternal(0), app.EchoOn):
            try:
                fn()
            except Exception:
                pass
        _PF["echo"] = True
    _PF.update(start=None, records=[], keys={}, marks=[], deferred=[], hooks=[], fnom={})
    flush = globals().get("flush_tables")
    if callable(flush):
        try:
            flush()
        except Exception as e:
            log(f"Could not save the tables: {e}", "error")
    log_summary()

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

_PO = {"plt": None, "missing": False, "collect": {}, "fonts": False, "st": None, "top": 0.0, "bottom": 0.0}
_PO_CREDIT = "Made with tool.adjiebrotots.com/powerfactory-scripter/builder"
_PO_STATUS = {"pass": "#0ca30c", "fail": "#d03b3b", "unknown": "#898781"}
# The Adjie Brotools style: light page, the site's neutral series sequence (blue, gold, teal,
# rose, purple), blue-grey grid, slate axis text, DM Sans, a bold centred title and the key
# under the graph. Keep it equal to the "brotools" template of js/core/graphstyle.js.
_PO_DEFAULT = {
    "template": "brotools",
    "colors": ["#5A91E8", "#B45309", "#4A9E87", "#C46A7E", "#9B59B6"],
    "ramp": "blue",
    "background": "#FFFFFF",
    "plot_background": "#FFFFFF",
    "text": "#14203A",
    "muted": "#4C5B76",
    "grid": "#C8D4E8",
    "axis": "#C8D4E8",
    "font": "DM Sans",
    "font_size": 9.5,
    "title_size": 13.0,
    "title_bold": True,
    "title_align": "center",
    "grid_axes": "both",
    "grid_style": "solid",
    "frame": "left-bottom",
    "ticks": "out",
    "thousands": True,
    "line_width": 2.0,
    "markers": "auto",
    "line_styles": "solid",
    "legend": "bottom",
    "legend_frame": False,
    "width": 10.0,
    "height": 5.6,
    "dpi": 150,
    "transparent": False,
    "also_save": "",
}
_PO_HEX_KEYS = ("background", "plot_background", "text", "muted", "grid", "axis")
_PO_RANGES = {"font_size": (5.0, 30.0), "title_size": (5.0, 48.0), "line_width": (0.3, 8.0),
              "width": (2.0, 30.0), "height": (1.5, 20.0), "dpi": (50.0, 600.0)}
_PO_CHOICES = {
    "title_align": ("center", "left"),
    "grid_axes": ("both", "y", "x", "none"),
    "grid_style": ("solid", "dashed", "dotted"),
    "frame": ("left-bottom", "box", "bottom", "none"),
    "ticks": ("out", "in", "none"),
    "markers": ("auto", "always", "never"),
    "line_styles": ("solid", "vary"),
    "legend": ("bottom", "top", "right", "inside", "none"),
    "also_save": ("", "svg", "pdf"),
}
# Colour ramps for heat maps, 3D graphs and more lines than the series colours hold, low to
# high. Keep them equal to RAMPS in js/core/graphstyle.js (the page's preview draws them).
_PO_RAMPS = {
    "blue": ["#EAF2FF", "#BCD3F7", "#8FB5FF", "#5A91E8", "#3A71C8", "#0052CC", "#1A3F86", "#14203A"],
    "night": ["#1C2942", "#1F3E73", "#2D67C7", "#5A91E8", "#8DBBFF", "#C4DCFF", "#EAF1FF"],
    "viridis": ["#440154", "#472D7B", "#3B528B", "#2C728E", "#21918C", "#28AE80", "#5EC962", "#ADDC30", "#FDE725"],
    "cividis": ["#00224E", "#123570", "#3B496C", "#575D6D", "#707173", "#8A8779", "#A69D75", "#C4B56C", "#E4CF5B", "#FEE838"],
    "magma": ["#000004", "#1C1044", "#4F127B", "#812581", "#B5367A", "#E55064", "#FB8761", "#FEC287", "#FCFDBF"],
    "coolwarm": ["#3B4CC0", "#6788EE", "#9ABBFF", "#C9D7F0", "#EDD1C2", "#F7A889", "#E26952", "#B40426"],
    "greys": ["#F7F7F7", "#D9D9D9", "#BDBDBD", "#969696", "#737373", "#525252", "#252525"],
    "classic": ["#CDE2FB", "#B7D3F6", "#9EC5F4", "#86B6EF", "#6DA7EC", "#5598E7", "#3987E5",
                "#2A78D6", "#256ABF", "#1C5CAB", "#184F95", "#104281", "#0D366B"],
}
_PO_SANS = ("Segoe UI", "Helvetica Neue", "Helvetica", "Arial", "Liberation Sans", "DejaVu Sans")
_PO_SERIF = ("Times New Roman", "Liberation Serif", "Nimbus Roman", "STIXGeneral", "DejaVu Serif")
_PO_SERIF_NAMES = ("times new roman", "times", "cambria", "georgia", "garamond", "book antiqua",
                   "palatino linotype", "liberation serif", "nimbus roman", "stixgeneral", "dejavu serif", "serif")
_PO_DASH = {"solid": "-", "dashed": (0, (4, 3)), "dotted": (0, (1, 2.5))}
# Line patterns in turn when the style varies them (line_styles "vary"), so lines stay apart in
# black and white print: solid, dashed, dotted, dash-dot, long dash, dash-dot-dot (in multiples
# of the line width, as matplotlib scales them). Keep equal to LINE_DASHES in graphstyle.js.
_PO_LINE_DASHES = [None, (4.0, 2.0), (1.0, 1.6), (4.0, 1.6, 1.0, 1.6), (7.0, 2.0), (4.0, 1.6, 1.0, 1.6, 1.0, 1.6)]


def _po_plt():
    # pyplot on the Agg backend, imported once on first use.
    if _PO["plt"] is None:
        import matplotlib
        try:
            matplotlib.use("Agg")
        except Exception:
            pass
        import matplotlib.pyplot as plt
        if "text.parse_math" in matplotlib.rcParams:
            # A label such as "Cost ($)" must print as written, not as maths.
            matplotlib.rcParams["text.parse_math"] = False
        _PO["plt"] = plt
    return _PO["plt"]


def _po_hex(v):
    # "#RRGGBB" from "#RGB" or "#RRGGBB" (any case), else None.
    t = str(v or "").strip()
    if re.match(r"^#[0-9A-Fa-f]{3}$", t):
        t = "#" + "".join(ch * 2 for ch in t[1:])
    return t.upper() if re.match(r"^#[0-9A-Fa-f]{6}$", t) else None


def _po_st():
    # The style in force: GRAPH_STYLE (SETTINGS) over _PO_DEFAULT, each value checked. A key the
    # default does not have is ignored; a bad value keeps the default's.
    raw = globals().get("GRAPH_STYLE")
    raw = raw if isinstance(raw, dict) else {}
    st = dict(_PO_DEFAULT)
    st["colors"] = list(_PO_DEFAULT["colors"])
    for key, dflt in _PO_DEFAULT.items():
        if key not in raw:
            continue
        v = raw[key]
        if key == "colors":
            good = [c for c in (_po_hex(x) for x in (v if isinstance(v, (list, tuple)) else [])) if c][:12]
            if good:
                st[key] = good
        elif key in _PO_HEX_KEYS:
            c = _po_hex(v)
            if c:
                st[key] = c
        elif key in _PO_RANGES:
            if isinstance(v, bool):
                continue
            try:
                f = float(v)
            except (TypeError, ValueError):
                continue
            if math.isfinite(f):
                lo, hi = _PO_RANGES[key]
                st[key] = min(max(f, lo), hi)
        elif key in _PO_CHOICES:
            if str(v) in _PO_CHOICES[key]:
                st[key] = str(v)
        elif key == "ramp":
            if str(v) in _PO_RAMPS:
                st[key] = str(v)
        elif isinstance(dflt, bool):
            if isinstance(v, bool):
                st[key] = v
        elif isinstance(v, str) and v.strip():
            st[key] = v.strip()[:60]
    st["dpi"] = int(round(st["dpi"]))
    return st


def _po_s():
    # The style of the graph being drawn (set by _po_run), or the one in force.
    return _PO["st"] or _po_st()


def _po_family(name):
    # The font families to ask matplotlib for: the chosen one, then a family of the same kind
    # that this computer has, then DejaVu Sans (always there, and it has the Greek letters). Fonts
    # in a "fonts" folder next to the script (the study package brings DM Sans) are added once.
    from matplotlib import font_manager
    if not _PO["fonts"]:
        _PO["fonts"] = True
        folder = os.path.join(script_dir(), "fonts")
        try:
            names = sorted(os.listdir(folder))
        except OSError:
            names = []
        for fn in names:
            if fn.lower().endswith((".ttf", ".otf")):
                try:
                    font_manager.fontManager.addfont(os.path.join(folder, fn))
                except Exception:
                    pass
    have = {}
    for f in font_manager.fontManager.ttflist:
        have.setdefault(f.name.lower(), f.name)
    serif = str(name).strip().lower() in _PO_SERIF_NAMES
    out = []
    for fam in [str(name)] + list(_PO_SERIF if serif else _PO_SANS):
        real = have.get(fam.strip().lower())
        if real and real not in out:
            out.append(real)
    if "DejaVu Sans" not in out:
        out.append("DejaVu Sans")
    return out


def _po_rc(st):
    # rcParams for one graph: its fonts, no "+4.9e1" offset on a narrow axis, and grid
    # defaults that 3D axes read when they are made.
    import matplotlib
    rc = {"font.family": _po_family(st["font"]), "font.size": st["font_size"],
          "axes.formatter.useoffset": False, "grid.color": st["grid"], "grid.linewidth": 0.7,
          "axes.edgecolor": st["axis"], "axes.labelcolor": st["muted"], "text.color": st["text"],
          "xtick.color": st["muted"], "ytick.color": st["muted"]}
    return {k: v for k, v in rc.items() if k in matplotlib.rcParams}


def _po_watermark(fig):
    # The credit as glyph outlines (TextPath -> PathPatch), bottom right, faint: a vector
    # shape, not an editable text object. Placed in inches so any save dpi keeps it in place.
    from matplotlib.textpath import TextPath
    from matplotlib.patches import PathPatch
    from matplotlib.transforms import Affine2D
    tp = TextPath((0, 0), _PO_CREDIT, size=7)
    bb = tp.get_extents()
    w_in, _h_in = fig.get_size_inches()
    margin = 6.0 / 72.0
    tx = w_in - margin - bb.x1 / 72.0
    ty = margin - bb.y0 / 72.0
    patch = PathPatch(tp, transform=Affine2D().scale(1.0 / 72.0).translate(tx, ty) + fig.dpi_scale_trans,
                      facecolor=_po_s()["text"], edgecolor="none", alpha=0.25)
    fig.add_artist(patch)
    return patch


def _po_close(fig):
    try:
        _po_plt().close(fig)
    except Exception:
        pass


def _po_figure(three_d=False):
    plt = _po_plt()
    st = _po_s()
    _PO["top"] = _PO["bottom"] = 0.0
    fig = plt.figure(figsize=(st["width"], st["height"]), dpi=st["dpi"])
    fig.patch.set_facecolor(st["background"])
    if three_d:
        import mpl_toolkits.mplot3d  # noqa: F401  (registers the 3d projection)
        ax = fig.add_subplot(1, 1, 1, projection="3d")
        _po_style3d(ax)
    else:
        ax = fig.add_subplot(1, 1, 1)
        _po_style(ax)
    return fig, ax


def _po_style(ax):
    st = _po_s()
    ax.set_facecolor(st["plot_background"])
    _po_grid(ax)
    ax.set_axisbelow(True)
    show = {"left-bottom": ("left", "bottom"), "box": ("left", "bottom", "top", "right"),
            "bottom": ("bottom",), "none": ()}[st["frame"]]
    for side in ("top", "right", "left", "bottom"):
        ax.spines[side].set_visible(side in show)
        ax.spines[side].set_color(st["axis"])
        ax.spines[side].set_linewidth(0.8)
    t = st["ticks"]
    both = st["frame"] == "box" and t == "in"
    ax.tick_params(axis="both", which="both", color=st["axis"], labelcolor=st["muted"],
                   labelsize=st["font_size"], direction="in" if t == "in" else "out",
                   length=0 if t == "none" else 4, width=0.8, pad=6 if t == "none" else 4,
                   top=both, right=both)
    if st["thousands"]:
        _po_group_ticks(ax)


def _po_grid(ax, axis=None):
    # The grid the style asks for; axis narrows it ("y" under bars, "none" for a heat map).
    st = _po_s()
    which = st["grid_axes"]
    if axis is not None and which != "none":
        which = axis if which in ("both", axis) else "none"
    ax.grid(False)
    if which != "none":
        ax.grid(True, axis=which, color=st["grid"], linewidth=0.7, linestyle=_PO_DASH[st["grid_style"]])


def _po_group_ticks(ax):
    # Tick numbers of 1,000 and up written with a thousands separator, as on the site's charts;
    # an axis whose label says it holds years keeps 2030 as it is.
    from matplotlib.ticker import ScalarFormatter

    class _Grouped(ScalarFormatter):
        def __call__(self, x, pos=None):
            text = ScalarFormatter.__call__(self, x, pos)
            label = self.axis.get_label().get_text().lower() if getattr(self, "axis", None) is not None else ""
            return text if ("year" in label or "tahun" in label) else _po_thousands(text)

    for axis in (ax.xaxis, ax.yaxis):
        axis.set_major_formatter(_Grouped(useOffset=False))


def _po_thousands(text):
    m = re.match(r"^([-\u2212]?)(\d{4,})(\.\d*)?$", str(text))
    if not m:
        return text
    return m.group(1) + "{:,}".format(int(m.group(2))) + (m.group(3) or "")


def _po_style3d(ax):
    st = _po_s()
    ax.set_facecolor(st["plot_background"])
    pane = _po_mix(st["plot_background"], st["grid"], 0.35)
    for a in (ax.xaxis, ax.yaxis, ax.zaxis):
        try:
            a.set_pane_color(pane)
            a.pane.set_edgecolor(st["axis"])
        except Exception:
            pass
        try:
            a._axinfo["grid"]["color"] = st["grid"]
        except Exception:
            pass
    ax.tick_params(colors=st["muted"], labelsize=st["font_size"])


def _po_axis(label, unit=""):
    """'Frequency (Hz)' from a label and a unit; the unit is not repeated when the label has it."""
    label = str(label or "").strip()
    unit = str(unit or "").strip()
    if not unit:
        return label
    if label.endswith(f"({unit})") or label.endswith(f"[{unit}]"):
        return label
    return f"{label} ({unit})" if label else f"Value ({unit})"


def _po_labels(ax, xlabel="", ylabel="", zlabel=None):
    st = _po_s()
    kw = {"color": st["muted"], "fontsize": st["font_size"] * 1.05}
    ax.set_xlabel(xlabel, labelpad=6, **kw)
    ax.set_ylabel(ylabel, labelpad=6, **kw)
    if zlabel is not None and hasattr(ax, "set_zlabel"):
        ax.set_zlabel(zlabel, **kw)


def _po_title(ax, title, context=True):
    # The title, with the loop values ("Dispatch (MW) = 200") as a smaller line under it when
    # the graph is drawn inside a loop; a key above the graph sits between them and the plot.
    st = _po_s()
    sub = ctx_text() if context else ""
    left = st["title_align"] == "left"
    fs = st["font_size"]
    gap = 8.0 + _PO["top"]
    ax.set_title(str(title or ""), loc="left" if left else "center", fontsize=st["title_size"],
                 color=st["text"], fontweight="bold" if st["title_bold"] else "normal",
                 pad=gap + (fs * 1.7 if sub else 0.0))
    if sub:
        ax.annotate(sub, xy=(0.0 if left else 0.5, 1.0), xycoords="axes fraction", xytext=(0, gap),
                    textcoords="offset points", fontsize=fs, color=st["muted"],
                    ha="left" if left else "center", va="bottom")


def _po_legend(ax, handles=None, labels=None, where=None):
    # The key where the style puts it: under the graph (one row, or as many as the width
    # needs, above the credit), above it (under the title), to its right, inside it, or none.
    # An inside key is placed for good by _po_save (_po_inside_key), once the layout is done.
    st = _po_s()
    if handles is None:
        handles, labels = ax.get_legend_handles_labels()
    where = where or st["legend"]
    if not handles or where == "none":
        return None
    fig = ax.figure
    fs = st["font_size"]
    kw = {"fontsize": fs, "frameon": bool(st["legend_frame"]), "handlelength": 2.0, "columnspacing": 1.6}
    if st["legend_frame"]:
        kw.update(facecolor=st["plot_background"], edgecolor=st["grid"], framealpha=1.0)
    given = list(labels)
    head = _po_key_title(given)
    if head:
        labels = [str(v).split(" = ", 1)[1] for v in given]
        kw.update(title=head, title_fontsize=fs)
    renderer = fig.canvas.get_renderer()
    w_px, h_px = fig.get_size_inches() * fig.dpi
    n = len(handles)
    if where == "inside":
        ax.pfb_inside = (handles, labels, kw, given)
        leg = ax.legend(handles, labels, loc="upper right", ncol=1 if n <= 10 else 2, **kw)
    elif where == "right":
        # One column (two past 16 lines), or as many more as keep it within the graph's height.
        leg = None
        for ncol in range(1 if n <= 16 else 2, n + 1):
            leg = ax.legend(handles, labels, loc="upper left", bbox_to_anchor=(1.02, 1.0), borderaxespad=0.0,
                            ncol=ncol, **kw)
            if leg.get_window_extent(renderer).height <= h_px * 0.8:
                break
    else:
        left = st["title_align"] == "left"
        foot = 16.0 / 72.0 * fig.dpi / h_px
        leg = None

        def make(ncol):
            if leg is not None:
                leg.remove()
            if where == "top":
                return ax.legend(handles, labels, loc="lower left" if left else "lower center",
                                 bbox_to_anchor=(0.0 if left else 0.5, 1.0), borderaxespad=0.4, ncol=ncol, **kw)
            return fig.legend(handles, labels, loc="lower center", bbox_to_anchor=(0.5, foot),
                              borderaxespad=0.0, ncol=ncol, **kw)
        for ncol in range(min(n, 12), 0, -1):
            leg = make(ncol)
            if leg.get_window_extent(renderer).width <= w_px * 0.92 or ncol == 1:
                break
        # Rows filled evenly: as few columns as keep that many rows (12 lines in 11 columns
        # would leave one alone on a second row; 6 columns hold them in two full rows).
        even = -(-n // -(-n // ncol))
        if even != ncol:
            leg = make(even)
        height = leg.get_window_extent(renderer).height
        if where == "top":
            _PO["top"] = height / fig.dpi * 72.0 + 2.0
        else:
            _PO["bottom"] = foot + height / h_px
    _po_key_ink(leg)
    return leg


def _po_key_title(labels):
    # Every line a pass of one loop ("Dispatch (MW) = 100", "Dispatch (MW) = 125" ...): the
    # loop's name, written once as the key's title, each line then named by its value alone.
    # None when the lines are named any other way (or by more than one loop value).
    parts = [str(v).split(" = ", 1) for v in labels]
    if len(parts) < 2 or any(len(p) != 2 or not p[0].strip() or " = " in p[1] for p in parts):
        return None
    head = parts[0][0]
    return head if all(p[0] == head for p in parts) else None


def _po_key_ink(leg):
    st = _po_s()
    for t in leg.get_texts():
        t.set_color(st["text"])
    leg.get_title().set_color(st["text"])


def _po_fit3d(fig, foot):
    # mplot3d writes its numbers and axis titles outside the axes' box, where tight_layout does
    # not look: on a small figure they run into the colour bar and the credit at the foot. The
    # box is made smaller (it stays where it is on the left) until they clear both and the
    # figure's edges. foot: the strip kept at the bottom, a fraction of the height.
    try:
        renderer = fig.canvas.get_renderer()
    except Exception:
        return
    w, h = fig.bbox.width, fig.bbox.height
    gap = 4.0 * fig.dpi / 72.0
    for ax in [a for a in fig.axes if getattr(a, "name", "") == "3d"]:
        for _ in range(5):
            tb = ax.get_tightbbox(renderer)
            if tb is None:
                break
            box = ax.get_window_extent(renderer)
            right = w - gap
            for other in fig.axes:
                if other is not ax:
                    o = other.get_tightbbox(renderer)
                    if o is not None and o.x0 > (box.x0 + box.x1) / 2:
                        right = min(right, o.x0 - gap)
            cut = (max(0.0, gap - tb.x0), max(0.0, tb.x1 - right),
                   max(0.0, foot * h + gap - tb.y0), max(0.0, tb.y1 - (h - gap)))
            if max(cut) < 1.0:
                break
            pos = ax.get_position()
            ax.set_position([pos.x0 + cut[0] / w, pos.y0 + cut[2] / h,
                             max(0.05, pos.width - (cut[0] + cut[1]) / w), max(0.05, pos.height - (cut[2] + cut[3]) / h)])


# Where an inside key may go, in turn: the corners, then the middle of each side.
_PO_INSIDE_LOCS = ("upper right", "upper left", "lower left", "lower right",
                   "center right", "center left", "upper center", "lower center")


def _po_inside_key(ax):
    # An inside key goes to the first place where it covers nothing drawn: no curve, point,
    # limit or event line, bar, band or word. matplotlib's loc="best" only covers the least,
    # which with many lines is still most of them. Its own columns are tried, then one more
    # (shorter, so it fits a band above or below the curves). Returns False, with the key
    # taken off, when no place is clear: _po_save then puts it under the graph.
    import numpy as np
    from matplotlib.collections import PathCollection
    handles, labels, kw, _given = ax.pfb_inside
    fig = ax.figure
    renderer = fig.canvas.get_renderer()
    segs, pts, boxes = [], [], []
    for ln in ax.get_lines():
        if not ln.get_visible():
            continue
        try:
            xy = np.asarray(ln.get_transform().transform(ln.get_xydata()), dtype=float)
        except Exception:
            continue
        if xy.ndim != 2 or not len(xy):
            continue
        if str(ln.get_linestyle()).lower() not in ("none", "", " "):
            a, b = xy[:-1], xy[1:]
            ok = np.isfinite(a).all(axis=1) & np.isfinite(b).all(axis=1)
            segs.append(np.hstack([a[ok], b[ok]]))
        if str(ln.get_marker()).lower() not in ("none", "", " "):
            pts.append(xy[np.isfinite(xy).all(axis=1)])
    for c in ax.collections:
        try:
            if isinstance(c, PathCollection) and len(c.get_offsets()):
                xy = np.asarray(c.get_offset_transform().transform(c.get_offsets()), dtype=float)
                pts.append(xy[np.isfinite(xy).all(axis=1)])
            else:
                e = c.get_window_extent(renderer)
                boxes.append((e.x0, e.y0, e.x1, e.y1))
        except Exception:
            pass
    for art in list(ax.patches) + list(ax.texts):
        try:
            if art.get_visible() and (not hasattr(art, "get_text") or art.get_text()):
                e = art.get_window_extent(renderer)
                boxes.append((e.x0, e.y0, e.x1, e.y1))
        except Exception:
            pass
    seg = np.vstack(segs) if segs else np.zeros((0, 4))
    pt = np.vstack(pts) if pts else np.zeros((0, 2))
    pad = 3.0 * fig.dpi / 72.0

    def clear(l, b, r, t):
        if len(pt) and ((pt[:, 0] >= l) & (pt[:, 0] <= r) & (pt[:, 1] >= b) & (pt[:, 1] <= t)).any():
            return False
        for l2, b2, r2, t2 in boxes:
            if min(r, r2) > max(l, l2) and min(t, t2) > max(b, b2):
                return False
        if len(seg):
            # Segments whose own box meets this one; any end inside is a hit, else trace it.
            near = seg[(np.minimum(seg[:, 0], seg[:, 2]) <= r) & (np.maximum(seg[:, 0], seg[:, 2]) >= l) &
                       (np.minimum(seg[:, 1], seg[:, 3]) <= t) & (np.maximum(seg[:, 1], seg[:, 3]) >= b)]
            for x, y in ((near[:, 0], near[:, 1]), (near[:, 2], near[:, 3])):
                if ((x >= l) & (x <= r) & (y >= b) & (y <= t)).any():
                    return False
            for x0, y0, x1, y1 in near:
                if _po_seg_in(x0, y0, x1, y1, (l, b, r, t)) > 0:
                    return False
        return True

    n = len(handles)
    base = 1 if n <= 10 else 2
    for ncol in ((base, base + 1) if n >= 4 else (base,)):
        for loc in _PO_INSIDE_LOCS:
            leg = ax.legend(handles, labels, loc=loc, ncol=ncol, **kw)
            e = leg.get_window_extent(renderer)
            if clear(e.x0 - pad, e.y0 - pad, e.x1 + pad, e.y1 + pad):
                _po_key_ink(leg)
                return True
    ax.get_legend().remove()
    return False


def _po_snap(ax):
    # The value axis ends on a tick at both ends, as the site's charts do, so the top grid line
    # closes the plot and no half-empty band is left above or below the data. A wider range can
    # change the tick step, so it is done again until the ends stay put; _po_save does it once
    # more after the layout has sized the axes. Returns whether the limits moved.
    moved = False
    try:
        ax.pfb_snap = True
        for _ in range(4):
            lo, hi = ax.get_ylim()
            if not (math.isfinite(lo) and math.isfinite(hi)) or hi <= lo:
                break
            ticks = list(ax.yaxis.get_major_locator().tick_values(lo, hi))
            eps = (hi - lo) * 1e-9
            below = [t for t in ticks if t <= lo + eps]
            above = [t for t in ticks if t >= hi - eps]
            nlo = max(below) if below else lo
            nhi = min(above) if above else hi
            if abs(nlo - lo) <= eps * 10 and abs(nhi - hi) <= eps * 10:
                break
            ax.set_ylim(nlo, nhi)
            moved = True
    except Exception:
        pass
    return moved


def _po_colorbar(fig, mappable, ax, label, **kw):
    st = _po_s()
    cb = fig.colorbar(mappable, ax=ax, **kw)
    cb.outline.set_edgecolor(st["axis"])
    cb.outline.set_linewidth(0.8)
    cb.ax.tick_params(color=st["axis"], labelcolor=st["muted"], labelsize=st["font_size"])
    cb.set_label(label, color=st["muted"], fontsize=st["font_size"] * 1.05)
    return cb


def _po_note(fig, note):
    if note:
        st = _po_s()
        text = str(note)
        if len(text) > 160:
            text = text[:157] + "..."
        fig.text(0.01, 0.012, text, fontsize=st["font_size"] * 0.8, color=st["muted"], ha="left", va="bottom")


def _po_colors(n):
    # Up to as many lines as the style has colours: those, in their order. Up to twice as many:
    # the same again, paler (the site's charts do the same). More (every pass of a sweep on one
    # graph): one ramp, so the order still reads and no hue is invented; the end of the ramp
    # nearest the background is left out so every line stays visible.
    st = _po_s()
    base = list(st["colors"])
    k = len(base)
    if n <= k:
        return base[:n]
    if n <= 2 * k:
        return base + [_po_mix(c, st["plot_background"], 0.42) for c in base][:n - k]
    ramp = _PO_RAMPS[st["ramp"]]
    bg = _po_lum(st["plot_background"])
    lo, hi = (0.25, 1.0) if abs(_po_lum(ramp[0]) - bg) < abs(_po_lum(ramp[-1]) - bg) else (0.0, 0.75)
    return [_po_ramp_at(ramp, lo + (hi - lo) * (j / max(1, n - 1))) for j in range(n)]


def _po_dashes(n):
    # The line pattern of each of n lines: all solid, or solid, dashed, dotted ... in turn.
    if _po_s()["line_styles"] != "vary":
        return ["-"] * n
    return ["-" if d is None else (0, d) for d in (_PO_LINE_DASHES[j % len(_PO_LINE_DASHES)] for j in range(n))]


def _po_ramp_at(ramp, pos):
    pos = min(max(float(pos), 0.0), 1.0) * (len(ramp) - 1)
    a = int(math.floor(pos))
    b = min(a + 1, len(ramp) - 1)
    return _po_mix(ramp[a], ramp[b], pos - a)


def _po_mix(c1, c2, w):
    r1, g1, b1 = (int(c1[i:i + 2], 16) for i in (1, 3, 5))
    r2, g2, b2 = (int(c2[i:i + 2], 16) for i in (1, 3, 5))
    return "#%02x%02x%02x" % (round(r1 + (r2 - r1) * w), round(g1 + (g2 - g1) * w), round(b1 + (b2 - b1) * w))


def _po_lum(c):
    # Relative luminance (WCAG) of "#RRGGBB", 0 (black) to 1 (white).
    def ch(v):
        v = v / 255.0
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (int(c[i:i + 2], 16) for i in (1, 3, 5))
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def _po_cmap():
    from matplotlib.colors import LinearSegmentedColormap
    return LinearSegmentedColormap.from_list("pfb_ramp", _PO_RAMPS[_po_s()["ramp"]])


def _po_num(v):
    """A float, or NaN when v is missing or not a number (a gap in a line)."""
    f = as_float(v)
    return float("nan") if f is None else f


def _po_xpos(xs):
    # Numeric x values stay numbers; any text makes the axis categorical, in the order the
    # values first appear. Returns (positions, tick labels or None).
    nums = [float("nan") if v is None or v == "" else as_float(v) for v in xs]
    if all(n is not None for n in nums):
        return nums, None
    cats = []
    for v in xs:
        key = as_text(v)
        if key not in cats:
            cats.append(key)
    return [float(cats.index(as_text(v))) for v in xs], cats


def _po_grid_xyz(x, y, z):
    # (xs, ys, Z) when the points (x, y) fill a whole grid (Z[j][i] at ys[j], xs[i]; repeated
    # points averaged), else None. Also accepts z as rows (one list per y value).
    if z and all(isinstance(r, (list, tuple)) for r in z):
        xs = [_po_num(v) for v in (x or range(len(z[0])))]
        ys = [_po_num(v) for v in (y or range(len(z)))]
        if any(v != v for v in xs):          # names along x: draw them at 0, 1, 2 ...
            xs = [float(i) for i in range(len(xs))]
        if any(v != v for v in ys):
            ys = [float(i) for i in range(len(ys))]
        Z = [[_po_num(v) for v in row[:len(xs)]] for row in z[:len(ys)]]
        if len(Z) == len(ys) and all(len(r) == len(xs) for r in Z) and len(xs) >= 2 and len(ys) >= 2:
            return xs, ys, Z
        return None
    pts = [(as_float(a), as_float(b), _po_num(c)) for a, b, c in zip(x or [], y or [], z or [])]
    pts = [p for p in pts if p[0] is not None and p[1] is not None]
    xs = sorted({p[0] for p in pts})
    ys = sorted({p[1] for p in pts})
    if len(xs) < 2 or len(ys) < 2:
        return None
    cells = {}
    for a, b, c in pts:
        cells.setdefault((a, b), []).append(c)
    if len(cells) != len(xs) * len(ys):
        return None
    Z = []
    for b in ys:
        row = []
        for a in xs:
            vals = [c for c in cells[(a, b)] if c == c]
            row.append(sum(vals) / len(vals) if vals else float("nan"))
        Z.append(row)
    return xs, ys, Z


def _po_save(fig, stem):
    st = _po_s()
    _po_watermark(fig)
    # Room at the foot for the credit (and the footnote), or for a key under the graph.
    strip = 14.0 / 72.0 / float(fig.get_size_inches()[1])

    def layout():
        fig.tight_layout(rect=(0, max(strip, _PO["bottom"]), 1, 1))
        # The axes changed size, so the tick step may have too: end on a tick again.
        if any([_po_snap(a) for a in fig.axes if getattr(a, "pfb_snap", False)]):
            fig.tight_layout(rect=(0, max(strip, _PO["bottom"]), 1, 1))
    try:
        with warnings.catch_warnings():
            # 3D axes and colour bars make tight_layout warn; the layout is still usable.
            warnings.simplefilter("ignore")
            layout()
            # A key inside the graph that would cover data goes under it instead.
            moved = False
            for a in fig.axes:
                if getattr(a, "pfb_inside", None) and not _po_inside_key(a):
                    _po_legend(a, a.pfb_inside[0], a.pfb_inside[3], where="bottom")
                    moved = True
                a.pfb_inside = None
            if moved:
                layout()
            _po_fit3d(fig, max(strip, _PO["bottom"]))
    except Exception:
        pass
    for a in fig.axes:
        if getattr(a, "pfb_marks", None):
            _po_place_marks(a)
    path = out_file(stem or "graph", "png", sub="graphs")
    kw = {"dpi": st["dpi"]}
    if st["transparent"]:
        kw["transparent"] = True
    else:
        kw["facecolor"] = fig.get_facecolor()
    fig.savefig(path, **kw)
    log(f"Saved graph: {path}")
    if st["also_save"] in ("svg", "pdf"):
        extra = path[:-4] + "." + st["also_save"]
        try:
            fig.savefig(extra, format=st["also_save"], **kw)
            _RUN["files"].append(extra)
            log(f"Saved graph ({st['also_save'].upper()}): {extra}")
        except Exception as exc:
            log(f"Could not save the {st['also_save'].upper()} copy of {path}: {type(exc).__name__}: {exc}", "warn")
    return path


# Where a mark's label may go around its point, in points right and up from it, how it hangs
# from there, and what the spot costs for being further out: beside the point, then under it
# (a nadir has its curve above), then over it, a step at a time out to 48 pt, so a label can
# drop into the gap between a limit line and the axis. Keep equal to markSpots in graphpreview.js.
def _po_mark_spots():
    spots = [(9, 0, "left", "center_baseline", 2.0), (-9, 0, "right", "center_baseline", 4.0)]
    for d in range(4, 50, 2):
        for dx, ha, side in ((6, "left", 0.0), (-6, "right", 2.0), (0, "center", 3.0)):
            if ha == "center" and d < 8:
                continue
            spots.append((dx, -d, ha, "top", d * 0.8 + side))
            spots.append((dx, d, ha, "bottom", d * 0.8 + side + 4.0))
    return spots


_PO_MARK_SPOTS = _po_mark_spots()


def _po_seg_in(x0, y0, x1, y1, box):
    # The length (px) of the segment (x0, y0)-(x1, y1) inside box = (left, bottom, right, top).
    l, b, r, t = box
    dx, dy = x1 - x0, y1 - y0
    lo, hi = 0.0, 1.0
    for p, q in ((-dx, x0 - l), (dx, r - x0), (-dy, y0 - b), (dy, t - y0)):
        if p == 0:
            if q < 0:
                return 0.0
        else:
            u = q / p
            if p < 0:
                lo = max(lo, u)
            else:
                hi = min(hi, u)
            if lo > hi:
                return 0.0
    return (hi - lo) * math.hypot(dx, dy)


def _po_place_marks(ax):
    # Each mark's label at the spot around its point that crosses the least: lines (the curves,
    # limit and event lines), other words (limit and event labels, labels already placed), the
    # key, and the edge of the plot. A label that still meets a line has the plot's colour
    # behind it, so it reads.
    st = _po_s()
    fig = ax.figure
    try:
        renderer = fig.canvas.get_renderer()
    except Exception:
        return
    px = fig.dpi / 72.0
    pad = 3.0 * px          # the clear space kept around a label
    frame = ax.get_window_extent(renderer)
    paths = []
    for ln in ax.get_lines():
        try:
            xy = ln.get_transform().transform(ln.get_xydata())
        except Exception:
            continue
        pts = [(float(a), float(b)) for a, b in xy if math.isfinite(a) and math.isfinite(b)]
        if str(ln.get_linestyle()).lower() in ("none", "", " "):
            paths.append(("dots", pts))
        else:
            paths.append(("line", pts))
    for (t, y, lab) in ax.pfb_marks:
        # Only the segments that pass near the point can meet a label beside it.
        cx, cy = ax.transData.transform((t, y))
        reach = 60.0 * px + st["font_size"] * 0.6 * px * len(lab)
        near = []
        for kind, pts in paths:
            if kind == "dots":
                near.append((kind, [q for q in pts if abs(q[0] - cx) <= reach and abs(q[1] - cy) <= reach]))
            else:
                near.append((kind, [(a, b) for a, b in zip(pts, pts[1:])
                                    if min(a[0], b[0]) <= cx + reach and max(a[0], b[0]) >= cx - reach
                                    and min(a[1], b[1]) <= cy + reach and max(a[1], b[1]) >= cy - reach]))
        boxes = []
        for other in list(ax.texts) + ([ax.get_legend()] if ax.get_legend() else []):
            try:
                e = other.get_window_extent(renderer)
                boxes.append((e.x0, e.y0, e.x1, e.y1))
            except Exception:
                pass
        ann = ax.annotate(lab, xy=(t, y), xytext=(0, 0), textcoords="offset points", zorder=6,
                          fontsize=st["font_size"] * 0.92, color=st["text"], annotation_clip=False,
                          bbox={"facecolor": st["plot_background"], "edgecolor": "none", "pad": 1.0, "alpha": 0.85})
        best = None
        for dx, dy, ha, va, further in _PO_MARK_SPOTS:
            ann.set_position((dx, dy))
            ann.set_ha(ha)
            ann.set_va(va)
            try:
                e = ann.get_window_extent(renderer)
            except Exception:
                break
            box = (e.x0 - pad, e.y0 - pad, e.x1 + pad, e.y1 + pad)
            area = max(1.0, (box[2] - box[0]) * (box[3] - box[1]))
            inside = (max(0.0, min(box[2], frame.x1) - max(box[0], frame.x0)) *
                      max(0.0, min(box[3], frame.y1) - max(box[1], frame.y0)))
            cost = (area - inside) / area * 1000.0
            for l2, b2, r2, t2 in boxes:
                w = min(box[2], r2) - max(box[0], l2)
                h = min(box[3], t2) - max(box[1], b2)
                if w > 0 and h > 0:
                    cost += 400.0 + w * h / area * 400.0
            for kind, items in near:
                if kind == "dots":
                    cost += 60.0 * sum(1 for a, b in items if box[0] <= a <= box[2] and box[1] <= b <= box[3])
                else:
                    run = sum(_po_seg_in(a[0], a[1], b[0], b[1], box) for a, b in items) / px
                    cost += (150.0 + 8.0 * run) if run > 0 else 0.0
            cost += further
            if best is None or cost < best[0]:
                best = (cost, dx, dy, ha, va)
        if best is not None:
            ann.set_position(best[1:3])
            ann.set_ha(best[3])
            ann.set_va(best[4])


def _po_run(what, title, draw):
    # Draw, save, close; never raise (a graph must never lose a result). draw() returns
    # (fig, stem), or None when there is nothing to draw (it has logged why).
    fig = None
    try:
        try:
            plt = _po_plt()
        except ImportError:
            if not _PO["missing"]:
                _PO["missing"] = True
                log("matplotlib is not installed, so no graphs are drawn. Install it with: "
                    "python -m pip install matplotlib", "error")
            return None
        _PO["st"] = _po_st()
        with plt.rc_context(_po_rc(_PO["st"])):
            made = draw()
            if made is None:
                return None
            fig, stem = made
            return _po_save(fig, stem)
    except Exception as exc:
        log(f"Could not draw the {what} '{title or 'untitled'}': {type(exc).__name__}: {exc}", "error")
        return None
    finally:
        _PO["st"] = None
        if fig is not None:
            _po_close(fig)


def _po_skip(what, title, why):
    log(f"{what} '{title or 'untitled'}' not drawn: {why}.", "warn")
    return None


def _po_hlines(ax, limits):
    # Horizontal limit lines: a number, (value, label) or {"value": v, "label": text}.
    st = _po_s()
    for item in limits or []:
        if isinstance(item, dict):
            v, lab = item.get("value", item.get("y")), item.get("label", "")
        elif isinstance(item, (list, tuple)):
            v, lab = (list(item) + [None, ""])[:2]
        else:
            v, lab = item, ""
        f = as_float(v)
        if f is None or f != f:
            continue
        ax.axhline(f, color=st["muted"], linestyle=(0, (5, 3)), linewidth=1.1, zorder=1)
        ax.annotate(str(lab or f"{f:.6g}"), xy=(1.0, f), xycoords=("axes fraction", "data"),
                    xytext=(-4, 3), textcoords="offset points", ha="right", va="bottom",
                    fontsize=st["font_size"] * 0.9, color=st["muted"])

def plot_series(series, labels=None, title="", ylabel="", unit=None, limits=None, marks=None,
                t_event=None, events=True, note="", stem=None, context=True, xlabel="Time (s)"):
    """Draw one or more time series on one graph and save it as a PNG; returns the file path.

    series: a Series or a list of them (empty ones are left out). labels: the legend names
    (default each series' label). ylabel and unit name the y axis ("Frequency" and "Hz"; unit
    defaults to the series' unit when they share one). limits: horizontal dashed lines, each a
    number, (value, label) or {"value", "label"}. marks: points to mark, each (t, y), (t, y,
    label) or a check result with time and value (for example a Frequency nadir result).
    Dotted vertical lines show the series' simulation events (events=True) and t_event (s).
    note: a footnote (for example the spikes removed). In a loop the loop values are shown
    under the title and added to the file name. GRAPH_STYLE in SETTINGS sets the look.
    Returns None, with a warning, when there is nothing to draw."""
    items = [series] if hasattr(series, "t") else [s for s in (series or []) if s is not None]
    names = list(labels) if isinstance(labels, (list, tuple)) else ([labels] if labels else [])
    pairs = []
    for k, s in enumerate(items):
        if not hasattr(s, "t") or len(getattr(s, "t")) == 0:
            continue
        ys = [_po_num(v) for v in s.y]
        if not any(v == v and math.isfinite(v) for v in ys):
            continue
        name = names[k] if k < len(names) and names[k] else (getattr(s, "label", "") or f"Series {k + 1}")
        pairs.append((s, [float(v) for v in s.t], ys, str(name)))
    head = title or ylabel or (pairs[0][3] if pairs else "")

    def draw():
        if not pairs:
            return _po_skip("Time series graph", head, "no series with samples")
        st = _po_s()
        units = {str(getattr(s, "unit", "") or "") for s, _, _, _ in pairs}
        yunit = unit if unit is not None else (units.pop() if len(units) == 1 else "")
        fig, ax = _po_figure()
        colors = _po_colors(len(pairs))
        for (s, ts, ys, name), color, dash in zip(pairs, colors, _po_dashes(len(pairs))):
            ax.plot(ts, ys, color=color, linewidth=st["line_width"], linestyle=dash, label=name, zorder=3,
                    solid_joinstyle="round", solid_capstyle="round")
        ax.margins(x=0)
        lines_at = {}
        if events:
            for s, _, _, _ in pairs:
                for et, el in getattr(s, "events", None) or []:
                    lines_at.setdefault(round(float(et), 9), str(el))
        te = as_float(t_event)
        if te is not None and te == te:
            lines_at.setdefault(round(te, 9), "")
        for et in sorted(lines_at):
            ax.axvline(et, color=st["muted"], linestyle=":", linewidth=1.0, zorder=1)
            if lines_at[et]:
                ax.annotate(lines_at[et], xy=(et, 1.0), xycoords=("data", "axes fraction"),
                            xytext=(3, -3), textcoords="offset points", ha="left", va="top",
                            fontsize=st["font_size"] * 0.85, color=st["muted"], rotation=90, zorder=2,
                            bbox={"facecolor": st["plot_background"], "edgecolor": "none", "pad": 1.0, "alpha": 0.85})
        _po_hlines(ax, limits)
        _po_snap(ax)
        for m in marks or []:
            _po_mark(ax, m, yunit)
        ylab = _po_axis(ylabel or (pairs[0][3] if len(pairs) == 1 else ""), yunit)
        _po_labels(ax, xlabel, ylab)
        if len(pairs) > 1:
            _po_legend(ax)
        _po_title(ax, head, context)
        _po_note(fig, note)
        return fig, stem or head or "time_series"

    return _po_run("time series graph", head, draw)


def _po_mark(ax, m, unit=""):
    # A marked point: (t, y), (t, y, label), {"t", "y", "label"} or a result with time / value
    # (a COLLAPSE nadir result is marked at its minimum).
    st = _po_s()
    t = y = None
    lab = ""
    if isinstance(m, dict):
        t, y, lab = m.get("t", m.get("x")), m.get("y", m.get("value")), m.get("label", "")
    elif isinstance(m, (list, tuple)):
        t, y, lab = (list(m) + [None, None, ""])[:3]
    elif m is not None:
        t, y = getattr(m, "time", None), getattr(m, "value", None)
        if t is None or y is None:
            t, y = getattr(m, "min_time", None), getattr(m, "minimum", None)
        kind = str(getattr(m, "verdict", "") or "")
        if y is not None:
            text = f"{as_float(y):.6g}" + (f" {unit}" if unit else "")
            if kind == "NADIR":
                lab = f"Nadir {text}"
            elif kind:
                lab = f"Minimum {text} ({kind.lower()})"
            else:
                lab = text
    t, y = as_float(t), as_float(y)
    if t is None or y is None or t != t or y != y:
        return
    ax.plot([t], [y], marker="o", markersize=7, color=st["text"], markeredgecolor=st["plot_background"],
            markeredgewidth=1.5, linestyle="none", zorder=5)
    if lab:
        # Written by _po_save once the layout is done (_po_place_marks), where it overlaps least.
        if not hasattr(ax, "pfb_marks"):
            ax.pfb_marks = []
        ax.pfb_marks.append((t, y, str(lab)))

def collect_series(key, series, label=None):
    """Keep a series (or a list of them) of this loop pass for a graph with every pass on it.
    key names the graph (one per Draw time series graph block); label defaults to the loop
    values ("Dispatch (MW) = 200"), with the series' own label added when a pass gives several.
    draw_collected(key, ...) after the loop draws them."""
    items = [series] if hasattr(series, "t") else [s for s in (series or []) if s is not None]
    names = list(label) if isinstance(label, (list, tuple)) else [label] * len(items)
    where = ctx_text()
    bucket = _PO["collect"].setdefault(str(key), [])
    for k, s in enumerate(items):
        if not hasattr(s, "t"):
            continue
        name = names[k] if k < len(names) and names[k] else ""
        if not name:
            own = getattr(s, "label", "") or ""
            name = f"{where}: {own}" if (where and own and len(items) > 1) else (where or own or f"Pass {len(bucket) + 1}")
        bucket.append((s, str(name)))
    return len(bucket)


def draw_collected(key, title="", ylabel="", unit=None, limits=None, marks=None, t_event=None,
                   events=True, note="", stem=None, xlabel="Time (s)"):
    """Draw every series kept with collect_series(key, ...) on one graph (one line per pass),
    then forget them so a loop around this one starts a fresh graph. Same options as
    plot_series. Returns the file path, or None with a warning when nothing was kept."""
    bucket = _PO["collect"].pop(str(key), [])
    head = title or "Time series, every pass"
    if not bucket:
        return _po_skip("Time series graph", head, "no pass kept a series for it")
    return plot_series([s for s, _ in bucket], [n for _, n in bucket], title=head,
                       ylabel=ylabel, unit=unit, limits=limits, marks=marks, t_event=t_event,
                       events=events, note=note, stem=stem, context=True, xlabel=xlabel)


if __name__ == "__main__":
    main()
# PFB1 {"app":"pf-builder","v":1,"name":"RMS runs for several fault durations","nodes":[{"id":"n1","type":"start","x":0,"y":0,"label":"","s":{"project":"39 Bus New England System","studyCase":"2.3 Simulation Fault Bus 31 Stable","outputDir":"","undoChanges":true,"tableFmt":"csv","fNominal":"auto","runMode":"auto","showPf":false,"fastMode":true,"connectTimeout":120,"apiPath":"","pfUser":""},"pin":[],"sv":1},{"id":"n2","type":"note","x":0,"y":-300,"label":"About this template","s":{"text":"For each fault duration this applies a three-phase fault at the busbar, runs an RMS simulation for 5 s and records the rotor angle spread of all synchronous generators (the largest minus the smallest rotor angle). Each run gets a row with its peak spread and whether it stayed below 180 degrees (a run that stops early keeps its row), and every run is drawn on one graph. Fill in the project and the faulted busbar."},"pin":[],"sv":1},{"id":"n3","type":"flow.list","x":320,"y":0,"label":"Fault duration (s)","s":{"name":"","source":"values","values":"0.1, 0.15, 0.2, 0.25","itemType":"num","table":"Results","cols":[{"id":"c1","name":"Case","type":"text"}],"runCol":"","restore":"pass","onError":"skip"},"pin":["values"],"sv":1},{"id":"n4","type":"pf.evt.shc","x":640,"y":0,"label":"Fault","s":{"target":{"cls":"ElmTerm","name":"Bus 31","match":"one"},"t":1,"duration":0.1,"fault":"3ph","phase1":"a","phase2":"ab","clear":"fault","rf":0,"xf":0,"loc":null},"pin":["target"],"sv":1},{"id":"n5","type":"pf.rms","x":960,"y":0,"label":"","s":{"tstop":5,"tstart":null,"step":null,"net":"case","record":[{"id":"r1","el":{"cls":"ElmSym","name":"*","match":"all"},"var":"c:firel","combine":"spread"}],"caseEvents":"auto","fast":false,"extendTo":0,"ufls":null},"pin":[],"sv":1},{"id":"n6","type":"sig.peak","x":1280,"y":360,"label":"Peak spread","s":{"kind":"max","after":null,"before":null},"pin":[],"sv":1},{"id":"n7","type":"chk.limit","x":1280,"y":0,"label":"Rotor angle spread (deg)","s":{"against":"value","lo":null,"hi":180,"curve":[{"id":"k1","x":0,"low":0,"high":""},{"id":"k2","x":0.15,"low":0,"high":""},{"id":"k3","x":0.15,"low":0.7,"high":""},{"id":"k4","x":1.5,"low":0.9,"high":""}],"x0":0,"extend":false,"after":null,"before":null,"goOn":true},"pin":["hi"],"sv":1},{"id":"n8","type":"out.table.add","x":1600,"y":0,"label":"","s":{"table":"RMS runs","cols":[{"id":"c1","name":"Peak rotor angle spread (deg)"},{"id":"c2","name":"Stable"}],"ctx":true,"onSkip":true},"pin":[],"sv":1},{"id":"n9","type":"out.plot.series","x":1920,"y":0,"label":"Rotor angle spread","s":{"lines":[{"id":"l1","name":""}],"collect":"loop","title":"","ylabel":"Rotor angle spread","unit":"","limits":[],"events":true,"stem":""},"pin":[],"sv":1}],"edges":[{"id":"e1","from":"n1","out":"next","to":"n3","in":"in"},{"id":"e2","from":"n3","out":"body","to":"n4","in":"in"},{"id":"e3","from":"n4","out":"next","to":"n5","in":"in"},{"id":"e4","from":"n5","out":"ok","to":"n7","in":"in"},{"id":"e5","from":"n5","out":"early","to":"n7","in":"in"},{"id":"e6","from":"n7","out":"pass","to":"n8","in":"in"},{"id":"e7","from":"n8","out":"next","to":"n9","in":"in"},{"id":"e8","from":"n3","out":"item","to":"n4","in":"duration"},{"id":"e9","from":"n5","out":"r1","to":"n6","in":"series"},{"id":"e10","from":"n5","out":"r1","to":"n7","in":"x"},{"id":"e11","from":"n6","out":"value","to":"n8","in":"c1"},{"id":"e12","from":"n7","out":"text","to":"n8","in":"c2"},{"id":"e13","from":"n5","out":"r1","to":"n9","in":"l1"}],"settings":{"WORKFLOW_NAME":["*","name"],"PROJECT":["n1","project"],"STUDY_CASE":["n1","studyCase"],"OUTPUT_DIR":["n1","outputDir"],"UNDO_CHANGES":["n1","undoChanges"],"TABLE_FORMAT":["n1","tableFmt"],"F_NOMINAL":["n1","fNominal"],"RUN_MODE":["n1","runMode"],"SHOW_PF":["n1","showPf"],"FAST_MODE":["n1","fastMode"],"CONNECT_TIMEOUT":["n1","connectTimeout"],"PF_API_PATH":["n1","apiPath"],"PF_USER":["n1","pfUser"],"FAULT_DURATION_VALUES":["n3","values"],"FAULT_TARGET":["n4","target","name"],"ROTOR_ANGLE_SPREAD_HI":["n7","hi"]},"hash":"fnv1a:b2a71113"}
