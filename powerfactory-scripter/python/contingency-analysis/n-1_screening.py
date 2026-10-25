#!/usr/bin/env python3
# N-1 screening
"""Made with the PowerFactory Workflow Builder, https://tool.adjiebrotots.com/powerfactory-scripter/builder/

BEFORE YOU RUN
  1. Check the SETTINGS below (lines marked REQUIRED).
  2. Close PowerFactory, or run this file from inside PowerFactory (see RUN_MODE).
  3. Run it with the Python that matches your PowerFactory, e.g.  py -3.12 n_1_screening.py
Results and run.log go to a new folder next to this file (or in OUTPUT_DIR).
"""
# ==== IMPORTS ====
import csv
import difflib
import fnmatch
import glob
import importlib.util
import itertools
import math
import os
import re
import string
import subprocess
import sys
import time
import traceback

# ==== SETTINGS (edit here) ====
# The name of this workflow: used for the run folder and in the log.
WORKFLOW_NAME = "N-1 screening"
# REQUIRED. The PowerFactory project to open, exactly as the Data Manager shows it (letter case
# counts).
PROJECT = "39 Bus New England System"
# OPTIONAL. The study case to activate first ("" = keep the active one).
STUDY_CASE = "1. Power Flow"
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

# True: connect, find every element named in this workflow, say what was found, then stop
# without running anything.
CHECK_ONLY = False


# ==== WORKFLOW ====
# Note: After a base load flow this takes out each line and transformer in service in turn (the base case first), runs the load flow and reads the loading of every line and 2-winding transformer and the vo...
def main():
    preflight([])
    app = pf_connect()
    try:
        if CHECK_ONLY:
            check_elements(app, [("*.ElmLne", "all"), ("*.ElmTerm", "all"), ("*.ElmTr2", "all")])
            return
        # -- Step 1: Start (Project: 39 Bus New England System) --
        # -- Step 2: Base load flow (Settings of the study case) --
        base_load_flow = run_load_flow(app, "case", "case", "case")
        # Did not converge: ends the workflow
        if not base_load_flow.ok:
            log("Load flow did not converge. The workflow ends here.", "warn")
            return
        # -- Step 3: Contingency (Base case, then each N-1 outage of lines, transformers) --
        contingency_contingencies = define_contingencies(app, ["*.ElmLne", "*.ElmTr2", "*.ElmTr3"], 1, True)
        for contingency_pass_no, contingency in enumerate(each_contingency(app, contingency_contingencies, True), 1):
            ctx_push("Contingency", contingency, contingency_pass_no, len(contingency_contingencies) + (1 if True else 0))
            try:
                # -- Step 4: Run load flow (Settings of the study case) --
                ldf = run_load_flow(app, "case", "case", "case")
                # Did not converge: skips to the next pass of Contingency
                if not ldf.ok:
                    case_skipped("Load flow did not converge")
                    continue
                # -- Step 5: Line loading (c:loading of all * (ElmLne) (load flow results)) --
                line_loading = pf_get_all(pf_find(app, "*.ElmLne", "all"), "c:loading", None, False, True)
                # -- Step 6: Busbar voltage (m:u of all * (ElmTerm) (load flow results)) --
                busbar_voltage = pf_get_all(pf_find(app, "*.ElmTerm", "all"), "m:u", None, False, True)
                # -- Step 7: Transformer loading (c:loading of all * (ElmTr2) (load flow results)) --
                transformer_loading = pf_get_all(pf_find(app, "*.ElmTr2", "all"), "c:loading", None, False, True)
                # -- Step 8: Add row to results table (Into "N-1", saved at the end automatically) --
                table("N-1").add({
                    "Highest loading (%)": line_loading.max,
                    "Most loaded line": line_loading.at_max,
                    "Lowest voltage (p.u.)": busbar_voltage.min,
                    "Lowest voltage at": busbar_voltage.at_min,
                    "Highest transformer loading (%)": transformer_loading.max,
                    "Most loaded transformer": transformer_loading.at_max,
                }, status=True)
            except StopWorkflow:
                raise
            except Exception as err:
                case_failed(err)
            finally:
                ctx_pop(["N-1"])
        # -- Step 9: Print the worst outage (Worst outage: {worst}, with a line loaded to {loading:.1f} %) --
        worst_outage = table_pick("N-1", "Contingency", "max", "Highest loading (%)", "text")  # Worst outage
        worst_outage_highest = table_pick("N-1", "Highest loading (%)" or "Contingency", "max", "Highest loading (%)", "num")  # Worst outage
        log(text_format("Worst outage: {worst}, with a line loaded to {loading:.1f} %", {"worst": worst_outage, "loading": worst_outage_highest}))
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

def table_pick(name, column, pick="all", of=None, kind="num"):
    """One column of the results table `name`: pick "all" gives its values top to bottom (an
    empty cell as None, so columns of one table stay in step); "max" / "min" give the value of
    `column` in the row where column `of` (default: `column` itself) is highest / lowest, for
    example the contingency with the highest loading. kind "num" gives numbers, "text" texts.
    A table or column that does not exist gives [] (or None)."""
    tbl = _TABLES.get(str(name))
    rows = tbl.rows if tbl is not None else []

    def conv(v):
        if kind == "text":
            return None if v is None or v == "" else as_text(v)
        return as_float(v)

    if pick not in ("max", "min"):
        return [conv(r.get(column)) for r in rows]
    key = of or column
    best = None
    for r in rows:
        v = as_float(r.get(key))
        if v is None or v != v:
            continue
        if best is None or (v > best[0] if pick == "max" else v < best[0]):
            best = (v, r)
    return conv(best[1].get(column)) if best is not None else None

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

_UNIT_BASE = {
    "W": ("P", 1e-6), "kW": ("P", 1e-3), "MW": ("P", 1.0), "GW": ("P", 1e3),
    "var": ("Q", 1e-6), "kvar": ("Q", 1e-3), "Mvar": ("Q", 1.0), "Gvar": ("Q", 1e3),
    "VA": ("S", 1e-6), "kVA": ("S", 1e-3), "MVA": ("S", 1.0), "GVA": ("S", 1e3),
    "s": ("t", 1.0), "ms": ("t", 1e-3), "min": ("t", 60.0), "h": ("t", 3600.0),
    "V": ("U", 1e-3), "kV": ("U", 1.0), "A": ("I", 1e-3), "kA": ("I", 1.0),
    "Wh": ("E", 1e-6), "kWh": ("E", 1e-3), "MWh": ("E", 1.0), "GWh": ("E", 1e3),
}
_UNIT_ALIAS = {"MVAr": "Mvar", "MVar": "Mvar", "kVAr": "kvar", "kVar": "kvar", "sec": "s"}


def unit_factor(from_unit, to_unit):
    """The factor that turns a value in from_unit into to_unit (MW to kW gives 1000), or None when
    the two are not the same kind of quantity or a unit is unknown."""
    a = _UNIT_BASE.get(_UNIT_ALIAS.get(str(from_unit).strip(), str(from_unit).strip()))
    b = _UNIT_BASE.get(_UNIT_ALIAS.get(str(to_unit).strip(), str(to_unit).strip()))
    if a is None or b is None or a[0] != b[0]:
        return None
    return a[1] / b[1]


def _display_unit(obj, attr):
    try:
        return (obj.GetAttributeUnit(attr) or "").strip()
    except Exception:
        return ""


def _convert(obj, attr, value, unit, to_display):
    """Convert between the block's unit and the unit this project shows for the attribute (a
    project can show power in kW or time in ms; GetAttribute/SetAttribute use that unit)."""
    if not unit or not isinstance(value, (int, float)) or isinstance(value, bool):
        return value
    shown = _display_unit(obj, attr)
    if not shown or shown == unit:
        return value
    f = unit_factor(unit, shown) if to_display else unit_factor(shown, unit)
    cls = obj.GetClassName() if hasattr(obj, "GetClassName") else ""
    if f is None:
        _say_once(("unit?", cls, attr, shown), f"{cls}.{attr} is shown in '{shown}' in this project, "
                  f"not {unit}; the value is used as it is.", "warn")
        return value
    _say_once(("unit", cls, attr, shown), f"{cls}.{attr} is shown in {shown} in this project; "
              f"values in {unit} are converted.")
    return value * f

_RESULT_PREFIX = ("m:", "c:", "s:", "n:", "r:", "b:")


class Reading:
    """One attribute read from several elements: values and elements in the same order, plus
    max / min, the element where each occurs (at_max / at_min) and n (how many values)."""

    def __init__(self, objs, values, attr, unit=""):
        self.objs, self.values, self.attr, self.unit = list(objs), list(values), attr, unit
        nums = [(v, o) for v, o in zip(self.values, self.objs) if isinstance(v, (int, float)) and v == v]
        self.n = len(nums)
        self.max = max(nums, key=lambda p: p[0])[0] if nums else None
        self.at_max = max(nums, key=lambda p: p[0])[1] if nums else None
        self.min = min(nums, key=lambda p: p[0])[0] if nums else None
        self.at_min = min(nums, key=lambda p: p[0])[1] if nums else None

    @property
    def value(self):
        return self.values[0] if len(self.values) == 1 else (self.values or None)

    def __repr__(self):
        return f"Reading({self.attr}, n={self.n}, max={self.max}, min={self.min})"


def pf_get(obj, attr, unit=None, total=False, default=None):
    """Read an attribute of one element. Results (m:, c:, s: ...) that PowerFactory cannot give
    (no calculation yet, a write since the last one, or the element is out of service) come back
    as `default` (None) with a warning, never as an error. With unit the value is converted from
    the project's display unit; total multiplies by the number of parallel machines (ngnum)."""
    if isinstance(obj, (list, tuple)):
        if len(obj) != 1:
            return pf_get_all(obj, attr, unit, total).values
        obj = obj[0]
    try:
        v = obj.GetAttribute(attr)
    except Exception as e:
        if str(attr).startswith(_RESULT_PREFIX):
            _say_once(("noresult", attr), f"{attr} is not available for {_nm(obj)}: no calculation has "
                      "run since the last change, the element is out of service, or the name is wrong. "
                      "Reads like this give an empty value.", "warn")
            return default
        raise PFError(f"[MODEL] {_nm(obj)} has no attribute '{attr}' ({e}). Check the attribute name.")
    if hasattr(v, "item") and not isinstance(v, (list, tuple, str)):
        v = v.item()
    v = _convert(obj, attr, v, unit, False)
    # A yes/no value is an int in Python, so it is left alone: "out of service" of a unit with
    # three parallel machines must stay 1, not become 3.
    if total and isinstance(v, (int, float)) and not isinstance(v, bool):
        try:
            v = v * obj.GetAttribute("ngnum")
        except Exception:
            pass
    return v


def pf_get_all(objs, attr, unit=None, total=False, skip=True):
    """Read an attribute from a list of elements; returns a Reading (values, max, min, at_max,
    at_min, n). skip leaves out elements that are out of service and, for results, elements that
    are not energised, so they cannot pose as a zero."""
    keep, vals = [], []
    is_result = str(attr).startswith(_RESULT_PREFIX)
    after_ldf = is_result and _ldf_active()
    given = list(objs if isinstance(objs, (list, tuple)) else [objs])
    for o in given:
        if skip:
            try:
                if o.GetAttribute("outserv") != 0:
                    continue
            except Exception:
                pass
            if is_result:
                try:
                    if o.IsEnergized() == 0:
                        continue
                except Exception:
                    pass
                # IsEnergized() still says 1 for a busbar left in a dead island after a load flow
                # (verified on the 39-bus demo with Trf 29 - 38 out: Bus 38 reads exactly 0.0 p.u.,
                # b:ipat 2). A converged load flow never gives a live busbar exactly 0 p.u. Only
                # after a load flow: after a short circuit the faulted busbar reads 0 p.u. too.
                if after_ldf:
                    try:
                        if o.GetClassName() == "ElmTerm" and o.GetAttribute("m:u") == 0:
                            continue
                    except Exception:
                        pass
        keep.append(o)
        vals.append(pf_get(o, attr, unit, total))
    if given and not keep:
        log(f"Reading {attr}: all {len(given)} elements were left out (out of service or not energised), "
            "so there is no value.", "warn")
    return Reading(keep, vals, attr, unit or "")


def _ldf_active():
    """Are the results on display those of a load flow? (GetActiveCalculationStr)"""
    try:
        s = str(_PF["app"].GetActiveCalculationStr() or "").lower()
    except Exception:
        return False
    return s in ("ldf", "load flow", "loadflow") or s.startswith("ldf")

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

class Contingency:
    """One outage case: a name, the elements it takes out of service and the group it came from."""

    def __init__(self, name, elements, group=""):
        self.name, self.elements, self.group = str(name), list(elements), str(group)

    @property
    def loc_name(self):
        # Table rows, file names and messages show a contingency by this name.
        return self.name

    def __repr__(self):
        return f"Contingency({self.name}, {len(self.elements)} element{'s' if len(self.elements) != 1 else ''})"


def define_contingencies(app, groups, order=1, in_service=True):
    """N-1 (order 1) or N-2 (order 2) outage cases from element groups: lists of elements or queries
    such as "*.ElmLne". Elements already out of service are left out (in_service) and named in the
    log, so restoring never puts into service what was out. N-2 pairs every two elements."""
    elems, seen, skipped = [], set(), []
    for g in (groups if isinstance(groups, (list, tuple)) else [groups]):
        objs = pf_find(app, g, "all", empty_ok=True) if isinstance(g, str) else as_items(g)
        for o in objs:
            k = _full(o)
            if k in seen:
                continue
            seen.add(k)
            if in_service:
                try:
                    if o.GetAttribute("outserv") != 0:
                        skipped.append(_nm(o))
                        continue
                except Exception:
                    pass
            elems.append((o, _plain(o.GetClassName(), 2)))
    if int(order) == 1:
        conts = [Contingency(_nm(o), [o], grp) for o, grp in elems]
    else:
        conts = [Contingency(f"{_nm(a)} + {_nm(b)}", [a, b], ga if ga == gb else f"{ga} + {gb}")
                 for (a, ga), (b, gb) in itertools.combinations(elems, 2)]
    if skipped:
        log(f"Left out {len(skipped)} element(s) already out of service: {', '.join(skipped[:10])}"
            + (" ..." if len(skipped) > 10 else "") + ".")
    if len(conts) > 5000:
        log(f"{len(conts)} contingencies: this will take a while.", "warn")
    log(f"Defined {len(conts)} N-{int(order)} contingencies from {len(elems)} elements.")
    return conts


class _Trip:
    """Contingency elements taken out of service, with each one's original state to put back."""

    def __init__(self, cont):
        app = _app()
        self.ctx = _context(app)
        self.saved = []
        els = cont.elements if isinstance(cont, Contingency) else as_items(cont)
        for e in els:
            try:
                was = e.GetAttribute("outserv")
            except Exception:
                continue
            if was != 0:
                log(f"{_nm(e)} is already out of service; left as it is.", "debug")
                continue
            e.SetAttribute("outserv", 1)
            self.saved.append((e, was))

    def restore(self):
        if self.saved:
            _enter_context(_app(), *self.ctx)
        for e, was in reversed(self.saved):
            try:
                e.SetAttribute("outserv", was)
            except Exception as err:
                log(f"Could not put {_nm(e)} back in service: {err}", "warn")
        self.saved = []

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.restore()
        return False


def trip_contingency(app, cont):
    """Take the elements of one contingency out of service now; .restore() (or the end of a with
    block) puts back each element's ORIGINAL service state, in the case and scenario of the trip.
    Elements that were already out are not touched."""
    return _Trip(cont)


def each_contingency(app, conts, base=True):
    """Loop helper: for each contingency (first a "Base case" with nothing out when base is True)
    takes its elements out of service, runs the loop body, then restores them, however the body
    ends."""
    items = ([Contingency("Base case", [], "")] if base else []) + list(conts or [])
    for c in items:
        trip = _Trip(c)
        try:
            yield c
        finally:
            trip.restore()

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


if __name__ == "__main__":
    main()
# PFB1 {"app":"pf-builder","v":1,"name":"N-1 screening","nodes":[{"id":"n1","type":"start","x":0,"y":0,"label":"","s":{"project":"39 Bus New England System","studyCase":"1. Power Flow","outputDir":"","undoChanges":true,"tableFmt":"csv","fNominal":"auto","runMode":"auto","showPf":false,"fastMode":true,"connectTimeout":120,"apiPath":"","pfUser":""},"pin":[],"sv":1},{"id":"n2","type":"note","x":0,"y":-300,"label":"About this template","s":{"text":"After a base load flow this takes out each line and transformer in service in turn (the base case first), runs the load flow and reads the loading of every line and 2-winding transformer and the voltage of every busbar (three reads side by side: they run one after another, then the row is added). Each outage gets a row, also one that does not converge (with its reason); the worst outage is printed at the end. Fill in the project."},"pin":[],"sv":1},{"id":"n3","type":"pf.ldf","x":320,"y":0,"label":"Base load flow","s":{"net":"case","qlim":"case","taps":"case"},"pin":[],"sv":1},{"id":"n5","type":"pf.cont.foreach","x":640,"y":0,"label":"Contingency","s":{"name":"","lines":true,"trafos":true,"gens":false,"xnets":false,"query":"","order":"1","inService":true,"how":"outserv","t":1,"base":true,"restore":"pass","onError":"skip"},"pin":[],"sv":2},{"id":"n6","type":"pf.ldf","x":960,"y":0,"label":"","s":{"net":"case","qlim":"case","taps":"case"},"pin":[],"sv":1},{"id":"n7","type":"pf.get","x":1280,"y":0,"label":"Line loading","s":{"el":{"cls":"ElmLne","name":"*","match":"all"},"attr":"c:loading","unit":"none","total":false,"skip":true},"pin":[],"sv":1},{"id":"n13","type":"pf.get","x":1280,"y":360,"label":"Transformer loading","s":{"el":{"cls":"ElmTr2","name":"*","match":"all"},"attr":"c:loading","unit":"none","total":false,"skip":true},"pin":[],"sv":1},{"id":"n8","type":"pf.get","x":1280,"y":180,"label":"Busbar voltage","s":{"el":{"cls":"ElmTerm","name":"*","match":"all"},"attr":"m:u","unit":"none","total":false,"skip":true},"pin":[],"sv":1},{"id":"n9","type":"out.table.add","x":1600,"y":0,"label":"","s":{"table":"N-1","cols":[{"id":"c1","name":"Highest loading (%)"},{"id":"c2","name":"Most loaded line"},{"id":"c3","name":"Lowest voltage (p.u.)"},{"id":"c4","name":"Lowest voltage at"},{"id":"c5","name":"Highest transformer loading (%)"},{"id":"c6","name":"Most loaded transformer"}],"ctx":true,"onSkip":true},"pin":[],"sv":1},{"id":"n11","type":"flow.log","x":960,"y":660,"label":"Print the worst outage","s":{"text":"Worst outage: {worst}, with a line loaded to {loading:.1f} %","level":"info"},"pin":[],"sv":1},{"id":"n12","type":"out.table.column","x":960,"y":930,"label":"Worst outage","s":{"table":"N-1","col":"Contingency","pick":"max","of":"Highest loading (%)","as":"text"},"pin":[],"sv":1}],"edges":[{"id":"e1","from":"n1","out":"next","to":"n3","in":"in"},{"id":"e2","from":"n3","out":"ok","to":"n5","in":"in"},{"id":"e3","from":"n5","out":"body","to":"n6","in":"in"},{"id":"e4","from":"n6","out":"ok","to":"n7","in":"in"},{"id":"e5","from":"n6","out":"ok","to":"n13","in":"in"},{"id":"e6","from":"n6","out":"ok","to":"n8","in":"in"},{"id":"e7","from":"n7","out":"next","to":"n9","in":"in"},{"id":"e8","from":"n13","out":"next","to":"n9","in":"in"},{"id":"e9","from":"n8","out":"next","to":"n9","in":"in"},{"id":"e10","from":"n5","out":"done","to":"n11","in":"in"},{"id":"e11","from":"n7","out":"max","to":"n9","in":"c1"},{"id":"e12","from":"n7","out":"at_max","to":"n9","in":"c2"},{"id":"e13","from":"n8","out":"min","to":"n9","in":"c3"},{"id":"e14","from":"n8","out":"at_min","to":"n9","in":"c4"},{"id":"e15","from":"n13","out":"max","to":"n9","in":"c5"},{"id":"e16","from":"n13","out":"at_max","to":"n9","in":"c6"},{"id":"e17","from":"n12","out":"value","to":"n11","in":"worst"},{"id":"e18","from":"n12","out":"of","to":"n11","in":"loading"}],"settings":{"WORKFLOW_NAME":["*","name"],"PROJECT":["n1","project"],"STUDY_CASE":["n1","studyCase"],"OUTPUT_DIR":["n1","outputDir"],"UNDO_CHANGES":["n1","undoChanges"],"TABLE_FORMAT":["n1","tableFmt"],"F_NOMINAL":["n1","fNominal"],"RUN_MODE":["n1","runMode"],"SHOW_PF":["n1","showPf"],"FAST_MODE":["n1","fastMode"],"CONNECT_TIMEOUT":["n1","connectTimeout"],"PF_API_PATH":["n1","apiPath"],"PF_USER":["n1","pfUser"]},"hash":"fnv1a:9cbb073d"}
