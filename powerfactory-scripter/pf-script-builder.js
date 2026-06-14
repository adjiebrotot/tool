/* ================================================================
   POWERFACTORY PYTHON API SCRIPT BUILDER
   ----------------------------------------------------------------
   Standalone, UI-agnostic module that turns a plain `cfg` object
   (produced by readConfig() in script.js) into a PowerFactory
   Python API script string.

   WHY THIS FILE EXISTS
   --------------------
   Every Python code pattern the tool can emit lives here and ONLY
   here. There is no DOM access, no validation, and no rendering in
   this file — those stay in script.js. To add or change generated
   Python, you only need to touch this file.

   THE cfg CONTRACT
   ----------------
   `cfg` is the object returned by readConfig() in script.js. Each
   buildXxx() function below reads from it and returns a string of
   Python source. Functions are pure: same cfg in → same code out.

   HOW TO ADD / MODIFY A PYTHON PATTERN
   ------------------------------------
   1. Find (or add) the buildXxx() helper for the relevant section
      below — e.g. buildImports for imports, buildProblemLoop for
      the main study loop, buildOutputExport for result writing.
   2. Edit the template literal it returns. Keep it a pure function
      of `cfg`; do not reach into the DOM.
   3. If you add a brand-new section, also wire it into
      buildPowerFactoryScript() at the bottom of this file so it is
      placed correctly for both notebook and python-file styles.

   EXTERNAL GLOBALS (defined in script.js, shared via global scope)
   ----------------------------------------------------------------
     • sanitizeName(name)   — safe Python identifier from a label
     • ALGORITHM_META       — optimisation algorithm metadata map

   ENTRY POINT
   -----------
   buildPowerFactoryScript(cfg) → final code string. This is the
   single function script.js calls. It owns section ORDER and the
   notebook-vs-pythonfile assembly; the buildXxx() helpers own the
   CONTENT of each section.
================================================================ */

// ── SHARED PYTHON-EXPRESSION HELPERS ──────────────────────────
// Emits a Python boolean expression used to filter contingency
// elements (`o` is the element in the generated loop). Pure: takes
// the configured attr/op/value, returns a code string (or null).
function buildContingencyFilterExpr(filterAttr, filterOp, filterVal) {
  if (!filterAttr || filterVal === '') return null;
  const numVal = parseFloat(filterVal);
  if (!isNaN(numVal) && String(filterVal).trim() !== '') {
    return `o.GetAttribute("${filterAttr}") ${filterOp} ${numVal}`;
  }
  const cleaned = filterVal.replace(/^["']|["']$/g, '');
  if (cleaned.includes('*') || cleaned.includes('?')) {
    const pat = cleaned.toLowerCase().replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `fnmatch.fnmatch(str(o.GetAttribute("${filterAttr}") or "").lower(), "${pat}")`;
  }
  const strVal = cleaned.toLowerCase().replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `str(o.GetAttribute("${filterAttr}") or "").lower() ${filterOp} "${strVal}"`;
}

// ── IMPORTS ──────────────────────────────────────────────────────
function buildImports(cfg) {
  const init = cfg.initialisation;
  const hasTimeseries  = cfg.outputVariables.some(o => o.type === 'timeseries' || o.type === 'custom_calculation');
  const hasOutputGraph = cfg.outputVariables.some(o => o.type === 'timeseries' && o.output_graph);
  const hasOutputRaw   = cfg.outputVariables.some(o => o.type === 'timeseries' && o.output_raw_csv);
  const apiPath = init.powerfactoryApiPath || 'POWERFACTORY_API_PATH_HERE';

  let tqdmImport = '';
  if (cfg.additionalConfig.useProgressBar) {
    tqdmImport = 'from tqdm import tqdm';
  }

  let optimImports = '';
  if (init.problemType === 'optimisation') {
    const alg = cfg.optimisation.algorithm;
    optimImports = (ALGORITHM_META[alg] || {}).pyImport || '';
  }

  const fnmatchImport = init.problemType === 'contingency' ? 'import fnmatch\n' : '';

  const matplotlibImport = hasOutputGraph
    ? 'import matplotlib\nmatplotlib.use("Agg")\nimport matplotlib.pyplot as plt\n'
    : '';

  return `import sys
import os
import csv
import re
import time
import tempfile
import traceback
import itertools
from datetime import datetime

sys.path.append(r"${apiPath}")

import powerfactory as pf
import pandas as pd
import numpy as np
${matplotlibImport}${tqdmImport ? tqdmImport + '\n' : ''}${optimImports ? optimImports + '\n' : ''}${fnmatchImport}`;
}

// ── PREPARATION (app connection, project listing) ─────────────
function buildPreparation(cfg) {
  // When a username is given, pass it; when blank, call GetApplication() with
  // no argument so it connects as the current user. (Emitting a placeholder
  // string like "USERNAME_HERE" would make GetApplication raise at runtime.)
  const username = (cfg.initialisation.username || '').trim();
  const getAppCall = username ? `pf.GetApplication("${username}")` : `pf.GetApplication()`;
  return `# ── PREPARATION ────────────────────────────────────────────────
app = ${getAppCall}
user = app.GetCurrentUser()

# Fetch available projects (the list is printed during selection below)
projects = user.GetContents("*.IntPrj")
`;
}

// ── PROJECT & SCENARIO SELECTION ──────────────────────────────
function buildProjectSelection(cfg) {
  const iterSC = cfg.additionalConfig.iterateStudyCases;
  const iterOS = cfg.additionalConfig.iterateOperatingScenarios;

  let lines = '\n# ── PROJECT & SCENARIO SELECTION ──────────────────────────────\n';
  lines += `if len(projects) == 0:\n`;
  lines += `    raise RuntimeError("No projects found for this user.")\n`;
  lines += `elif len(projects) == 1:\n`;
  lines += `    project = projects[0]\n`;
  lines += `    print(f"Auto-selected project: {project.loc_name}")\n`;
  lines += `else:\n`;
  lines += `    [print(f"i: {index}, project: {value}") for index, value in enumerate(projects)]\n`;
  lines += `    project = projects[int(input("Enter project index: "))]\n`;
  lines += `project.Activate()\n`;

  if (!iterSC) {
    lines += `\n# Select study case\n`;
    lines += `study_cases = get_study_cases(app)\n`;
    lines += `if len(study_cases) == 0:\n`;
    lines += `    raise RuntimeError("No study cases found in the project.")\n`;
    lines += `elif len(study_cases) == 1:\n`;
    lines += `    study_case = study_cases[0]\n`;
    lines += `    print(f"Auto-selected study case: {study_case.loc_name}")\n`;
    lines += `else:\n`;
    lines += `    [print(f"i: {index}, sc: {value}") for index, value in enumerate(study_cases)]\n`;
    lines += `    study_case = study_cases[int(input("Enter study case index: "))]\n`;
    lines += `study_case.Activate()\n`;
  }

  if (!iterOS) {
    lines += `\n# Select operating scenario\n`;
    lines += `operating_scenarios = get_operating_scenarios(app)\n`;
    lines += `if len(operating_scenarios) == 0:\n`;
    lines += `    safe_print("No operating scenarios found — skipping activation.")\n`;
    lines += `    op_scenario = None\n`;
    lines += `elif len(operating_scenarios) == 1:\n`;
    lines += `    op_scenario = operating_scenarios[0]\n`;
    lines += `    print(f"Auto-selected operating scenario: {op_scenario.loc_name}")\n`;
    lines += `    op_scenario.Activate()\n`;
    lines += `else:\n`;
    lines += `    [print(f"i: {index}, os: {value}") for index, value in enumerate(operating_scenarios)]\n`;
    lines += `    op_scenario = operating_scenarios[int(input("Enter operating scenario index: "))]\n`;
    lines += `    op_scenario.Activate()\n`;
  }

  return lines;
}

// ── CHECKS ────────────────────────────────────────────────────
function buildChecks(cfg) {
  const openWin = cfg.additionalConfig.openPowerFactoryWindow;
  return `
# ── CHECKS ──────────────────────────────────────────────────────
print("Checks")
print("Project: ", app.GetActiveProject())
print("Study Case: ", app.GetActiveStudyCase())
print("Operating Scenario: ", app.GetActiveScenario())

# PowerFactory window visibility
${openWin ? 'app.Show()' : 'app.Hide()'}
`;
}

// ── COMMON HELPERS ────────────────────────────────────────────
function buildCommonHelpers(cfg) {
  const hasTs    = cfg.outputVariables.some(o => o.type === 'timeseries' || o.type === 'custom_calculation');
  const hasCustom = cfg.outputVariables.some(o => o.type === 'custom_calculation');
  const hasSaveInt = cfg.additionalConfig.saveIntermediateEnabled;

  let code = `
# ── COMMON HELPERS ──────────────────────────────────────────────
def safe_print(msg):
    try:
        print(msg)
    except Exception:
        pass


def timestamp_string():
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def ensure_output_dir(path):
    os.makedirs(path, exist_ok=True)


def get_single_pf_object(app, object_query):
    """Resolve a PowerFactory object by query string using GetCalcRelevantObjects."""
    objects = app.GetCalcRelevantObjects(object_query)
    if not objects:
        raise ValueError(f"Object not found: {object_query}")
    return objects[0]


def get_type_objects(app, object_query):
    """
    Resolve a type object (TypXxx) directly from the project's equipment
    library — type objects live under the "equip" project folder, not in
    GetCalcRelevantObjects' result set.

    object_query format: "Type Name.TypLne", "Type Name.TypLod", etc.
    """
    equip_folder = app.GetProjectFolder("equip")
    if equip_folder is None:
        raise ValueError(f"Could not find the equipment ('equip') project folder (query: {object_query!r})")
    results = equip_folder.GetContents(object_query, 1)
    if not results:
        raise ValueError(f"No type object found matching {object_query!r} in the equipment library.")
    return results


def get_pf_objects(app, object_query):
    """Resolve all PowerFactory objects matching a query (supports wildcards).
    Type queries (object_query ending in ".TypXxx") are routed to the
    equipment library via get_type_objects(); everything else is resolved
    via GetCalcRelevantObjects.
    Returns a list; for exact-match queries this is a single-element list.
    """
    if re.search(r'\.Typ[A-Za-z0-9]+\s*$', object_query):
        return get_type_objects(app, object_query)
    objects = app.GetCalcRelevantObjects(object_query)
    if not objects:
        raise ValueError(f"No objects found for query: {object_query}")
    return list(objects)


def get_event_objects(app, object_query):
    """
    Resolve an event object from the Simulation Events folder.
    object_query format: "EventName.EvtShc" or "EventName.EvtSwitch" etc.
    Returns a list with the matching event object.
    Raises ValueError if the folder or object cannot be found.
    """
    study_case = app.GetActiveStudyCase()
    if study_case is None:
        raise ValueError(f"No active study case for event lookup (query: {object_query!r})")
    # The simulation event list (class IntEvt) is the canonical events folder for
    # the active study case. GetFromStudyCase resolves it regardless of the
    # folder's display name/localisation; fall back to a name-based lookup.
    evt_folder = app.GetFromStudyCase("IntEvt")
    if evt_folder is None:
        folders = study_case.GetContents("Simulation Events.IntEvt")
        evt_folder = folders[0] if folders else None
    if evt_folder is None:
        raise ValueError(
            f"Could not find a Simulation Events (IntEvt) folder in the active study case "
            f"(query: {object_query!r}). Activate an RMS/EMT study case that contains the event."
        )
    results = evt_folder.GetContents(object_query)
    if not results:
        raise ValueError(
            f"No event found matching {object_query!r} in the Simulation Events folder. "
            f"Create the event and make sure its name matches the query."
        )
    return results


def get_input_objects(app, object_query):
    """
    Route object resolution to either the event folder (EvtXxx classes)
    or GetCalcRelevantObjects (ElmXxx / StaXxx classes).
    """
    m = re.search(r'\\.(Evt[A-Za-z0-9]+)\\s*$', object_query)
    if m:
        return get_event_objects(app, object_query)
    return get_pf_objects(app, object_query)


def _build_ts_monitor_list(app, output_specs):
    """
    Build a list of (element_object, variable_name) tuples for all
    timeseries output specs. Used by ensure_elmres_variables().
    """
    monitor_list = []
    for spec in output_specs:
        if spec.get("type") != "timeseries":
            continue
        try:
            objs = get_pf_objects(app, spec["object_query"])
        except ValueError:
            safe_print(f"[WARN] No object found for timeseries spec {spec['name']!r}: {spec['object_query']!r}")
            continue
        monitor_list.append((objs[0], spec["variable"]))
    return monitor_list


def ensure_elmres_variables(app, res_obj, monitor_list):
    """
    Ensure all (element, variable) pairs are registered in the ElmRes result object.
    Must be called BEFORE ComInc.Execute(). Any newly added variables only take
    effect from the next ComInc run.

    Args:
        app          : PowerFactory application object
        res_obj      : ElmRes object (from app.GetFromStudyCase("ElmRes"))
        monitor_list : list of (element_object, variable_name_str) tuples
                       e.g. [(bus_obj, "m:u1"), (line_obj, "m:I"), ...]

    Returns:
        list of (element, varname) pairs that were newly added
    """
    added = []

    # Inspect already-registered columns
    res_obj.Load()
    n_cols = res_obj.GetNumberOfColumns()
    existing = set()
    for col in range(n_cols):
        obj = res_obj.GetObject(col)
        var = res_obj.GetVariable(col)
        if obj is not None and var:
            existing.add((obj.GetFullName(), var))
    res_obj.Release()

    # Add any missing variables
    for elm, varname in monitor_list:
        if (elm.GetFullName(), varname) not in existing:
            err = res_obj.AddVariable(elm, varname)
            if err == 0:
                added.append((elm, varname))
                app.PrintInfo(f"[ElmRes] Added variable '{varname}' for '{elm.loc_name}'")
            else:
                app.PrintWarn(
                    f"[ElmRes] FAILED to add '{varname}' for '{elm.loc_name}' "
                    f"— check element class and variable name"
                )
    return added


def build_range(lower, upper, step, dtype_name="float"):
    """Build a list of values from lower to upper with given step (increment value)."""
    if dtype_name == "int":
        return list(range(int(lower), int(upper) + 1, int(step)))
    values = np.arange(float(lower), float(upper) + float(step) * 0.5, float(step))
    values = [float(v) for v in values]
    return values

`;

  if (hasSaveInt) {
    code += `
def save_intermediate_results(df, output_dir, prefix, last_save_time, interval_minutes):
    current_time = time.time()
    if interval_minutes is None:
        return last_save_time
    if current_time - last_save_time >= interval_minutes * 60:
        filename = f"{prefix}_{timestamp_string()}.csv"
        full_path = os.path.join(output_dir, filename)
        with open(full_path, "w", newline="") as _int_f:
            _int_f.write("# Made using tool.adjiebrotots.com/powerfactory-scripter\\n")
            df.to_csv(_int_f, index=False)
        safe_print(f"Intermediate results saved: {full_path}")
        return current_time
    return last_save_time

`;
  }

  // Always include — needed for prompt selection or iteration
  code += `
def get_study_cases(app):
    project = app.GetActiveProject()
    study_case_root = project.GetContents("Study Cases")
    if not study_case_root:
        return []
    # Filter to IntCase only: the Study Cases folder can also hold non-case
    # objects (e.g. a "Task Automation" ComTasks). Returning those unfiltered
    # makes study_case.Activate() fail when iterating study cases.
    return study_case_root[0].GetContents("*.IntCase")


def get_operating_scenarios(app):
    project = app.GetActiveProject()
    scenario_root = project.GetContents("Operation Scenarios")
    if not scenario_root:
        return []
    return scenario_root[0].GetContents("*.IntScenario")


def extract_attribute_output(app, object_query, variable_name):
    """
    Read a scalar result attribute from a PowerFactory element.
    Uses GetCalcRelevantObjects (API ref §3.3) + GetAttribute (API ref §5).
    Returns a single scalar when one object is matched, or a dict of
    {loc_name: value} when multiple objects are matched.
    """
    objects = get_pf_objects(app, object_query)
    if len(objects) == 1:
        try:
            return objects[0].GetAttribute(variable_name)
        except Exception:
            # Attribute unavailable (e.g. an out-of-service element after a trip)
            return None
    values = {}
    for obj in objects:
        loc_name = getattr(obj, "loc_name", "Object")
        try:
            values[loc_name] = obj.GetAttribute(variable_name)
        except Exception:
            # Attribute unavailable for this element (e.g. tripped / out of service);
            # leave it blank rather than failing the whole result row.
            values[loc_name] = None
    return values

`;

  return code;
}

// ── STUDY HELPERS ─────────────────────────────────────────────
function buildStudyHelper(cfg) {
  const st = cfg.initialisation.studyType;
  const tstop = cfg.initialisation.tstop || '20';
  let code = '\n# ── STUDY EXECUTION HELPERS ────────────────────────────────────\n';

  if (st === 'steady_state') {
    code += `def run_study_steady_state(app):
    """Execute a load flow using ComLdf. Returns True if converged."""
    cmd = app.GetFromStudyCase("ComLdf")
    err = cmd.Execute()
    return err == 0
`;
  } else if (st === 'harmonic') {
    code += `def run_study_harmonic(app):
    """Execute a harmonic load flow using ComHldf. Returns True if converged."""
    cmd = app.GetFromStudyCase("ComHldf")
    err = cmd.Execute()
    return err == 0
`;
  } else if (st === 'dynamic_rms') {
    code += `def run_study_dynamic_rms(app, tstop=${tstop}):
    """Execute a dynamic RMS simulation using ComInc + ComSim. Returns True if initial conditions converged."""
    output_window = app.GetOutputWindow()
    output_window.Clear()

    comInc = app.GetFromStudyCase("ComInc")
    comInc.iopt_sim = "rms"

    comSim = app.GetFromStudyCase("ComSim")
    comSim.tstop = tstop

    app.EchoOff()         # Required: suppresses ComInc console flood
    comInc.Execute()
    app.EchoOn()
    converged = comInc.ZeroDerivative() == 1  # 1 = converged; 0 = derivatives not at zero
    comSim.Execute()
    return converged
`;
  } else if (st === 'dynamic_emt') {
    code += `def run_study_dynamic_emt(app, tstop=${tstop}):
    """Execute a dynamic EMT simulation using ComInc (iopt_sim='ins') + ComSim. Returns True if initial conditions converged."""
    output_window = app.GetOutputWindow()
    output_window.Clear()

    comInc = app.GetFromStudyCase("ComInc")
    comInc.iopt_sim = "ins"  # EMT mode

    comSim = app.GetFromStudyCase("ComSim")
    comSim.tstop = tstop

    app.EchoOff()         # Required: suppresses ComInc console flood
    comInc.Execute()
    app.EchoOn()
    converged = comInc.ZeroDerivative() == 1  # 1 = converged; 0 = derivatives not at zero
    comSim.Execute()
    return converged
`;
  }

  return code;
}

// ── ELMRES HELPERS (for timeseries) ──────────────────────────
function buildElmResHelpers(cfg) {
  const hasTs = cfg.outputVariables.some(o => o.type === 'timeseries' || o.type === 'custom_calculation');
  if (!hasTs) return '';

  return `
# ── ELMRES / TIMESERIES HELPERS ─────────────────────────────────
# ElmRes results are read directly in-memory via the PF API.
# Workflow per simulation run:
#   1. ensure_elmres_variables() — called ONCE before ComInc (registers variables)
#   2. _read_elmres_inmemory()   — called per run: Load → FindColumn → GetValue → Release
#   3. extract_timeseries_outputs() — compute scalar metrics from the in-memory data
#   4. calculate_timeseries_metric() — compute a single scalar metric from time/data

def _read_elmres_inmemory(app, output_specs):
    """
    Read all timeseries output variables directly from the in-memory ElmRes result object.
    Returns (time_values, ts_data) where:
        time_values : list of float  — simulation time steps (seconds)
        ts_data     : dict           — {spec_name: [float, ...]} one entry per timeseries spec

    Uses PATTERN 6: res.Load() -> res.FindColumn() -> res.GetValue() -> res.Release()
    """
    res = app.GetFromStudyCase("ElmRes")
    res.Load()

    n_rows = res.GetNumberOfRows()
    # Time axis: PowerFactory exposes the result x-axis (simulation time) at
    # COLUMN INDEX -1. Columns 0..n-1 are the monitored VARIABLES, so
    # res.GetValue(row, 0) returns the first monitored variable (often a
    # near-constant state like a field voltage), NOT the time. Verified on
    # PowerFactory 2024: GetValue(row, -1) returns the t_start..t_stop ramp.
    time_values = [res.GetValue(row, -1)[1] for row in range(n_rows)]

    ts_data = {}
    for spec in output_specs:
        if spec.get("type") != "timeseries":
            continue
        try:
            objs = get_pf_objects(app, spec["object_query"])
        except ValueError:
            safe_print(f"[WARN] No object found for timeseries output {spec['name']!r}")
            ts_data[spec["name"]] = [float('nan')] * n_rows
            continue
        col = res.FindColumn(objs[0], spec["variable"])
        if col < 0:
            safe_print(
                f"[WARN] Variable '{spec['variable']}' not found in ElmRes for "
                f"'{spec['name']}' ({spec['object_query']}). "
                f"Check ensure_elmres_variables() was called before ComInc."
            )
            ts_data[spec["name"]] = [float('nan')] * n_rows
        else:
            ts_data[spec["name"]] = [res.GetValue(row, col)[1] for row in range(n_rows)]

    res.Release()
    return time_values, ts_data


def calculate_timeseries_metric(time_values, data_values, metric, threshold=None,
                                settle_band=None, settle_hold_time=None,
                                settle_reference_value=None):
    """
    Compute a scalar metric from parallel time/data lists.

    Parameters
    ----------
    time_values  : list[float]
    data_values  : list[float]  (NaN entries are excluded)
    metric       : str
    threshold    : float | None  — for first_time_above / first_time_below
    settle_band, settle_hold_time, settle_reference_value : float | None
                               — for time_settle

    Returns
    -------
    dict  e.g. {"value": 1.05, "time": 0.32}
    """
    valid_pairs = [(t, v) for t, v in zip(time_values, data_values)
                   if v == v]  # exclude NaN

    if not valid_pairs:
        return {"value": float("nan")}

    times, vals = zip(*valid_pairs)

    if metric == "maximum":
        idx = vals.index(max(vals))
        return {"value": vals[idx], "time": times[idx]}

    if metric == "minimum":
        idx = vals.index(min(vals))
        return {"value": vals[idx], "time": times[idx]}

    if metric == "final":
        return {"value": vals[-1], "time": times[-1]}

    if metric == "mean":
        return {"value": sum(vals) / len(vals)}

    if metric == "rms":
        return {"value": (sum(v ** 2 for v in vals) / len(vals)) ** 0.5}

    if metric in ("first_time_above", "first_time_below"):
        if threshold is None:
            return {"time": float("nan")}
        for t, v in zip(times, vals):
            if metric == "first_time_above" and v > threshold:
                return {"time": t}
            if metric == "first_time_below" and v < threshold:
                return {"time": t}
        return {"time": float("nan")}

    if metric == "time_settle":
        if settle_band is None or settle_hold_time is None or settle_reference_value is None:
            return {"time": float("nan")}
        lo = settle_reference_value - settle_band
        hi = settle_reference_value + settle_band
        n = len(times)
        for i in range(n):
            if lo <= vals[i] <= hi:
                j = i
                while j < n and times[j] - times[i] < settle_hold_time:
                    if not (lo <= vals[j] <= hi):
                        break
                    j += 1
                else:
                    return {"time": times[i]}
        return {"time": float("nan")}

    return {"value": float("nan")}


def extract_timeseries_outputs(time_values, ts_data, output_specs):
    """
    Compute scalar metrics from in-memory timeseries data.
    Args:
        time_values  : list of float — simulation time steps
        ts_data      : dict — {spec_name: [float, ...]}
        output_specs : list of output spec dicts
    Returns:
        dict — {spec_name: metric_value}
    """
    results = {}
    for spec in output_specs:
        if spec.get("type") != "timeseries":
            continue
        col_data = ts_data.get(spec["name"])
        if not col_data:
            safe_print(f"[WARN] No timeseries data for output '{spec['name']}'")
            results[spec["name"]] = float('nan')
            continue
        metric_result = calculate_timeseries_metric(
            time_values, col_data,
            spec.get("metric", "maximum"),
            threshold=spec.get("threshold"),
            settle_band=spec.get("settle_band"),
            settle_hold_time=spec.get("settle_hold_time"),
            settle_reference_value=spec.get("settle_reference_value")
        )
        metric_val = metric_result.get("value", metric_result.get("time", float("nan")))
        results[spec["name"]] = metric_val
    return results

`;
}

// ── TIMESERIES GRAPH HELPER ───────────────────────────────────
function buildTimeseriesGraphHelper(cfg) {
  const graphVars = cfg.outputVariables.filter(o => o.type === 'timeseries' && o.output_graph);
  if (graphVars.length === 0) return '';

  return `
# ── TIMESERIES GRAPH HELPER ──────────────────────────────────────
def save_timeseries_graph(time_values, ts_data, spec, row, graph_dir, context_label_parts):
    """
    Plot timeseries data (Time vs variable) and save as .png in graph_dir.

    Parameters
    ----------
    time_values         : list[float]  — time axis from _read_elmres_inmemory()
    ts_data             : dict         — {spec_name: [float, ...]} from _read_elmres_inmemory()
    spec                : dict         — one entry from output_specs (type="timeseries")
    row                 : dict         — current result row (for input value labels)
    graph_dir           : str          — destination directory
    context_label_parts : list[str]    — prefixed to the chart title
    """
    col_data = ts_data.get(spec["name"])
    if not col_data:
        safe_print(f"[WARN] Graph skipped for '{spec['name']}' — no data available.")
        return

    title_parts = list(context_label_parts)
    for s in input_specs:
        title_parts.append(f"{s['name']}={row.get(s['name'], '?')}")
    title_parts.append(spec["name"])
    title = " | ".join(title_parts)

    plt.figure(figsize=(10, 6))
    plt.plot(time_values, col_data)
    plt.title(title, fontsize=9)
    plt.xlabel("Time (s)")
    plt.ylabel(spec["name"])
    plt.grid(True)
    plt.tight_layout()
    label_parts = list(context_label_parts)
    for s in input_specs:
        val = row.get(s["name"], "x")
        label_parts.append(f"{s['name']}_{val}")
    label_parts.append(spec["name"])
    safe_name = "_".join(str(p) for p in label_parts)
    safe_name = safe_name.replace(" ", "_").replace("(", "").replace(")", "").replace("/", "-")
    graph_filename = f"{safe_name}_{timestamp_string()}.png"
    graph_path = os.path.join(graph_dir, graph_filename)
    plt.figtext(0.99, 0.01, 'Made using tool.adjiebrotots.com/powerfactory-scripter',
                ha='right', va='bottom', fontsize=7, alpha=0.25, color='#333333')
    plt.savefig(graph_path)
    plt.close()
    safe_print(f"Graph saved: {graph_path}")

`;
}

// ── TIMESERIES RAW CSV HELPER ─────────────────────────────────
function buildRawCsvHelper(cfg) {
  const rawVars = cfg.outputVariables.filter(o => o.type === 'timeseries' && o.output_raw_csv);
  if (rawVars.length === 0) return '';

  return `
# ── TIMESERIES RAW CSV HELPER ────────────────────────────────────
def save_timeseries_raw_csv(time_values, ts_data, spec, row, raw_dir, context_label_parts):
    """
    Save one timeseries column (time_s + variable) as a CSV in raw_dir.

    Parameters
    ----------
    time_values         : list[float]  — time axis from _read_elmres_inmemory()
    ts_data             : dict         — {spec_name: [float, ...]} from _read_elmres_inmemory()
    spec                : dict         — one entry from output_specs
    row                 : dict         — current result row (for filename labels)
    raw_dir             : str          — destination directory
    context_label_parts : list[str]    — prepended to the filename
    """
    col_data = ts_data.get(spec["name"])
    if not col_data:
        safe_print(f"[WARN] Raw CSV skipped for '{spec['name']}' — no data available.")
        return
    label_parts = list(context_label_parts)
    for s in input_specs:
        val = row.get(s["name"], "x")
        label_parts.append(f"{s['name']}_{val}")
    label_parts.append(spec["name"])
    safe_name = "_".join(str(p) for p in label_parts)
    safe_name = safe_name.replace(" ", "_").replace("(", "").replace(")", "").replace("/", "-")
    raw_filename = f"{safe_name}_{timestamp_string()}.csv"
    raw_path = os.path.join(raw_dir, raw_filename)
    with open(raw_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["# Made using tool.adjiebrotots.com/powerfactory-scripter"])
        writer.writerow(["time_s", spec["variable"]])
        for t, v in zip(time_values, col_data):
            writer.writerow([t, v])
    safe_print(f"Raw CSV saved: {raw_path}")

`;
}

// ── CUSTOM FUNCTION HELPERS ───────────────────────────────────
function buildCustomFunctionHelpers(cfg) {
  const customVars = cfg.outputVariables.filter(o => o.type === 'custom_calculation');
  if (customVars.length === 0) return '';

  let code = '\n# ── CUSTOM CALCULATION FUNCTIONS ────────────────────────────────\n';
  const nameMap = [];

  customVars.forEach(ov => {
    const safe = sanitizeName(ov.name);
    if (safe !== ov.name) {
      nameMap.push(`# Name mapping: "${ov.name}" -> "${safe}"`);
    }
    // Include user-provided function body, indented
    let fnBody = ov.customFn || `def ${safe}():\n    return 0`;
    // If the function does not start with 'def', wrap it
    if (!fnBody.trim().startsWith('def ')) {
      fnBody = `def ${safe}():\n    ${fnBody.trim().split('\n').join('\n    ')}`;
    }
    code += fnBody + '\n\n';
  });

  if (nameMap.length > 0) {
    code = '\n# ── CUSTOM CALCULATION FUNCTIONS ────────────────────────────────\n' +
           nameMap.join('\n') + '\n\n' + code.replace('\n# ── CUSTOM CALCULATION FUNCTIONS ────────────────────────────────\n', '');
  }

  code += `def evaluate_custom_calculations(base_result_row):
    """Evaluate all user-defined custom calculation functions against result row."""
    custom_results = {}
`;
  customVars.forEach(ov => {
    // Extract the actual function name and arguments from the def line
    const firstLine = (ov.customFn || '').trim().split('\n')[0];
    const defMatch  = firstLine.match(/^def\s+(\w+)\s*\(([^)]*)\)/);
    // Use the name as written by the user; fall back to sanitized output name only if no def line
    const callee = defMatch ? defMatch[1] : sanitizeName(ov.name);
    const rawArgs = defMatch ? defMatch[2] : '';
    const args = rawArgs.split(',').map(a => a.trim()).filter(Boolean);
    const argStr = args.map(a => `base_result_row.get("${a}", None)`).join(', ');
    code += `    custom_results["${ov.name}"] = ${callee}(${argStr})\n`;
  });
  code += '    return custom_results\n';

  return code;
}

// ── INPUT SPECS ───────────────────────────────────────────────
function buildInputSpecs(cfg) {
  const inputs = cfg.inputVariables;
  const problemType = cfg.initialisation.problemType;

  if (problemType === 'contingency') {
    return '\n# ── CONTINGENCY MODE — element loop drives the run, no input_specs ──\n';
  }

  let code = '\n# ── INPUT SPECS ─────────────────────────────────────────────────\n';
  code += 'input_specs = [\n';
  inputs.forEach((iv, i) => {
    const name = iv.name || `input_${i}`;
    if (problemType === 'custom') {
      code += `    {
        "name":         "${name}",
        "object_query": "${iv.object_query}",
        "variable":     "${iv.variable}"
    },\n`;
    } else {
      code += `    {
        "name":         "${name}",
        "object_query": "${iv.object_query}",
        "variable":     "${iv.variable}",
        "lower":        ${iv.lower || 0},
        "upper":        ${iv.upper || 1},
        "step":         ${iv.step || 1},
        "dtype":        "${iv.dtype || 'float'}"
    },\n`;
    }
  });
  code += ']\n\n';

  if (problemType === 'custom') {
    const fp = cfg.customMode.scenarioFilePath || 'SCENARIO_FILE_PATH_HERE';
    code += `# Custom mode: load scenario file (3-row header format)
# Row 1 — Variable name: label cell ("Variable name"), then one name per variable column.
# Row 2 — Object:        label cell ("Object"), then the PF object query per column.
# Row 3 — Attribute:     label cell ("Attribute"), then the attribute name per column.
# Rows 4+ are data rows (one scenario per row; first cell is the scenario label).
# Wildcard object queries (e.g. *.ElmSym) are supported: the value is applied to all
# matched objects simultaneously. Add extra columns to control additional objects.
# Sheet name is always "Sheet1" (template generates a single sheet).
scenario_file_path = r"${fp}"
_raw_scenario_df = pd.read_excel(scenario_file_path, sheet_name="Sheet1", header=None)

# Build column specs from the 3 header rows (skip column 0 which holds row labels)
_col_specs = []
for _ci in range(1, _raw_scenario_df.shape[1]):
    _var_name  = str(_raw_scenario_df.iloc[0, _ci]).strip()
    _obj_query = str(_raw_scenario_df.iloc[1, _ci]).strip()
    _attr_name = str(_raw_scenario_df.iloc[2, _ci]).strip()
    if _var_name and _obj_query and _attr_name and _var_name.lower() not in ("nan", "none"):
        _col_specs.append({"name": _var_name, "object_query": _obj_query, "attribute": _attr_name})

# Data rows start at row index 3; use variable names as column headers
scenario_df = _raw_scenario_df.iloc[3:].reset_index(drop=True)
scenario_df.columns = list(_raw_scenario_df.iloc[0])

# Resolve all PowerFactory objects referenced by the column specs (cached)
_col_object_cache = {}
for _spec in _col_specs:
    _oq = _spec["object_query"]
    if _oq not in _col_object_cache:
        _col_object_cache[_oq] = get_input_objects(app, _oq)

`;
  } else {
    code += `# Resolve PowerFactory objects and build value ranges
input_objects = {}
input_ranges = {}

for i, spec in enumerate(input_specs):
    input_objects[i] = get_input_objects(app, spec["object_query"])
    input_ranges[i] = build_range(spec["lower"], spec["upper"], spec["step"], spec["dtype"])

`;
  }

  return code;
}

// ── OUTPUT SPECS ──────────────────────────────────────────────
function buildOutputSpecs(cfg) {
  const outputs = cfg.outputVariables;
  let code = '# ── OUTPUT SPECS ─────────────────────────────────────────────────\n';
  code += 'output_specs = [\n';
  outputs.forEach(ov => {
    const safe = sanitizeName(ov.name);
    if (ov.type === 'attribute') {
      code += `    {
        "type":         "attribute",
        "name":         "${ov.name}",
        "object_query": "${ov.object_query}",
        "variable":     "${ov.variable}"
    },\n`;
    } else if (ov.type === 'timeseries') {
      let entry = `    {
        "type":         "timeseries",
        "name":         "${ov.name}",
        "object_query": "${ov.object_query}",
        "variable":     "${ov.variable}",
        "metric":       "${ov.metric}",
        "output_graph":   ${ov.output_graph   ? 'True' : 'False'},
        "output_raw_csv": ${ov.output_raw_csv ? 'True' : 'False'}`;
      if (ov.threshold) entry += `,\n        "threshold":    ${ov.threshold}`;
      if (ov.settle_band) entry += `,\n        "settle_band":  ${ov.settle_band}`;
      if (ov.settle_hold_time) entry += `,\n        "settle_hold_time": ${ov.settle_hold_time}`;
      if (ov.settle_reference_value) entry += `,\n        "settle_reference_value": ${ov.settle_reference_value}`;
      entry += '\n    },\n';
      code += entry;
    } else if (ov.type === 'custom_calculation') {
      code += `    {
        "type":         "custom_calculation",
        "name":         "${ov.name}"
    },\n`;
    }
  });
  code += ']\n';
  return code;
}

// ── OUTPUT DIR SETUP ──────────────────────────────────────────
function buildOutputDirSetup(cfg) {
  const outDir = cfg.initialisation.outputDir || 'OUTPUT_DIR_HERE';
  const hasGraph = cfg.outputVariables.some(o => o.type === 'timeseries' && o.output_graph);
  const hasRaw   = cfg.outputVariables.some(o => o.type === 'timeseries' && o.output_raw_csv);
  let code = `
output_dir = r"${outDir}"
ensure_output_dir(output_dir)
`;
  if (hasGraph) code += `graph_dir = os.path.join(output_dir, "graph")\nensure_output_dir(graph_dir)\n`;
  if (hasRaw)   code += `raw_dir   = os.path.join(output_dir, "raw")\nensure_output_dir(raw_dir)\n`;
  return code;
}

// ── RUN STUDY CALL (inline) ───────────────────────────────────
function buildRunStudyCall(cfg) {
  const st = cfg.initialisation.studyType;
  const tstop = cfg.initialisation.tstop || '20';
  if (st === 'steady_state') return '_converged = run_study_steady_state(app)';
  if (st === 'harmonic')     return '_converged = run_study_harmonic(app)';
  if (st === 'dynamic_rms')  return `_converged = run_study_dynamic_rms(app, tstop=${tstop})`;
  if (st === 'dynamic_emt')  return `_converged = run_study_dynamic_emt(app, tstop=${tstop})`;
  return '_converged = run_study_steady_state(app)';
}

// ── GRAPH CALLS INLINE ────────────────────────────────────────
function buildGraphCalls(cfg, indent, hasIterSC, hasIterOS) {
  const graphVars = cfg.outputVariables.filter(o => o.type === 'timeseries' && o.output_graph);
  if (graphVars.length === 0) return '';

  let code = `\n${indent}    # Timeseries graphs (saved to graph_dir)\n`;
  code += `${indent}    _raw_ctx = []\n`;
  if (hasIterSC) code += `${indent}    _raw_ctx.append(study_case.loc_name)\n`;
  if (hasIterOS) code += `${indent}    _raw_ctx.append(op_scenario.loc_name)\n`;
  code += `${indent}    for _rspec in [s for s in output_specs if s["type"] == "timeseries" and s.get("output_graph")]:\n`;
  code += `${indent}        save_timeseries_graph(_ts_time, _ts_data, _rspec, row, graph_dir, _raw_ctx)\n`;
  return code;
}

// ── RAW CSV CALLS INLINE ──────────────────────────────────────
function buildRawCsvCalls(cfg, indent, hasIterSC, hasIterOS) {
  const rawVars = cfg.outputVariables.filter(o => o.type === 'timeseries' && o.output_raw_csv);
  if (rawVars.length === 0) return '';

  let code = `\n${indent}    # Timeseries raw CSV (saved to raw_dir)\n`;
  code += `${indent}    _raw_ctx = []\n`;
  if (hasIterSC) code += `${indent}    _raw_ctx.append(study_case.loc_name)\n`;
  if (hasIterOS) code += `${indent}    _raw_ctx.append(op_scenario.loc_name)\n`;
  code += `${indent}    for _rspec in [s for s in output_specs if s["type"] == "timeseries" and s.get("output_raw_csv")]:\n`;
  code += `${indent}        save_timeseries_raw_csv(_ts_time, _ts_data, _rspec, row, raw_dir, _raw_ctx)\n`;
  return code;
}

// ── PROBLEM LOOP BODY ─────────────────────────────────────────
function buildProblemLoop(cfg) {
  const pt = cfg.initialisation.problemType;
  const hasTs    = cfg.outputVariables.some(o => o.type === 'timeseries');
  const hasCust  = cfg.outputVariables.some(o => o.type === 'custom_calculation');
  const hasGraph = cfg.outputVariables.some(o => o.type === 'timeseries' && o.output_graph);
  const hasRaw   = cfg.outputVariables.some(o => o.type === 'timeseries' && o.output_raw_csv);
  const hasSave = cfg.additionalConfig.saveIntermediateEnabled;
  const hasBar  = cfg.additionalConfig.useProgressBar;
  const intervalMin = cfg.additionalConfig.saveIntermediateMinutes || 30;
  const runCall = buildRunStudyCall(cfg);
  const hasIterSC = cfg.additionalConfig.iterateStudyCases;
  const hasIterOS = cfg.additionalConfig.iterateOperatingScenarios;

  const indentSC = hasIterSC ? '    ' : '';
  const indentOS = hasIterOS ? indentSC + '    ' : indentSC;
  const indent   = indentOS + '    '; // inside combo loop

  // wrapper code lines
  let wrapperStart = '';
  let wrapperEnd   = '';

  if (hasIterSC) {
    wrapperStart += `${indentSC}for study_case in study_cases:\n`;
    wrapperStart += `${indentSC}    study_case.Activate()\n`;
    wrapperStart += `${indentSC}    safe_print(f"Study case: {study_case.loc_name}")\n`;
    wrapperEnd = `${indentSC}\n` + wrapperEnd;
  }
  if (hasIterOS) {
    wrapperStart += `${indentOS}for op_scenario in operating_scenarios:\n`;
    wrapperStart += `${indentOS}    op_scenario.Activate()\n`;
    wrapperStart += `${indentOS}    safe_print(f"Operating scenario: {op_scenario.loc_name}")\n`;
    wrapperEnd = '' + wrapperEnd;
  }

  // Setup before loop
  let pre = '\n# ── PROBLEM LOOP ─────────────────────────────────────────────────\n';

  if (hasIterSC) {
    pre += `study_cases = get_study_cases(app)\n`;
  }
  if (hasIterOS) {
    pre += `operating_scenarios = get_operating_scenarios(app)\n`;
  }

  pre += `results_df = pd.DataFrame()
iteration_count = 0
success_count = 0
failed_count = 0
last_save_time = time.time()
`;

  const isDynamic = cfg.initialisation.studyType === 'dynamic_rms' || cfg.initialisation.studyType === 'dynamic_emt';
  if (isDynamic && hasTs && pt !== 'custom') {
    pre += `
# ============================================================
# SECTION: ElmRes Variable Pre-Check
# ============================================================
# Ensure all timeseries output variables are registered in ElmRes
# before ComInc runs. Variables added here only take effect from
# the first ComInc.Execute() call in the loop below.
_pf_res = app.GetFromStudyCase("ElmRes")
_ts_monitor = _build_ts_monitor_list(app, output_specs)
if _ts_monitor:
    _newly_added = ensure_elmres_variables(app, _pf_res, _ts_monitor)
    if _newly_added:
        safe_print(
            f"[ElmRes] {len(_newly_added)} variable(s) added — "
            f"active from first ComInc run."
        )
    else:
        safe_print("[ElmRes] All timeseries variables already registered.")

`;
  }

  // ─── BRUTE FORCE ──────────────────────────────────────────────────
  if (pt === 'brute_force') {
    pre += `
all_combinations = list(itertools.product(*input_ranges.values()))
`;
    // Cache initial attribute values once, before all loops
    pre += `
# Cache initial attribute values — restored to original after each simulation run
_input_restore_list = []
for _i, _spec in enumerate(input_specs):
    for _obj in input_objects[_i]:
        try:
            _orig_val = _obj.GetAttribute(_spec["variable"])
        except Exception:
            _orig_val = None
        _input_restore_list.append((_obj, _spec["variable"], _orig_val))
`;
    if (hasBar) {
      pre += `\n${wrapperStart}${indentOS}for combo in tqdm(all_combinations, desc="Brute Force"):\n`;
    } else {
      pre += `\n${wrapperStart}${indentOS}for combo in all_combinations:\n`;
    }
    pre += `${indent}try:\n`;
    pre += `${indent}    iteration_count += 1\n`;
    pre += `${indent}    current_inputs = {}\n`;
    pre += `${indent}    for spec_idx, value in enumerate(combo):\n`;
    pre += `${indent}        spec = input_specs[spec_idx]\n`;
    pre += `${indent}        for obj in input_objects[spec_idx]:\n`;
    pre += `${indent}            obj.SetAttribute(spec["variable"], value)\n`;
    pre += `${indent}        if len(input_objects[spec_idx]) == 1:\n`;
    pre += `${indent}            current_inputs[spec["name"]] = value\n`;
    pre += `${indent}        else:\n`;
    pre += `${indent}            for obj in input_objects[spec_idx]:\n`;
    pre += `${indent}                current_inputs[f"{spec['name']} {obj.loc_name}"] = value\n\n`;
    pre += `${indent}    ${runCall}\n\n`;
    pre += `${indent}    row = {}\n`;
    pre += `${indent}    row.update(current_inputs)\n`;
    pre += `${indent}    row["Converge?"] = _converged\n\n`;
    pre += `${indent}    # Attribute outputs\n`;
    pre += `${indent}    for spec in output_specs:\n`;
    pre += `${indent}        if spec["type"] == "attribute":\n`;
    pre += `${indent}            _attr_val = extract_attribute_output(app, spec["object_query"], spec["variable"])\n`;
    pre += `${indent}            if isinstance(_attr_val, dict):\n`;
    pre += `${indent}                for _loc, _val in _attr_val.items():\n`;
    pre += `${indent}                    row[f"{spec['name']}_{_loc}"] = _val\n`;
    pre += `${indent}            else:\n`;
    pre += `${indent}                row[spec["name"]] = _attr_val\n`;
    if (hasTs) {
      pre += `\n${indent}    # Read ElmRes in-memory (once per simulation run)\n`;
      pre += `${indent}    _ts_time, _ts_data = _read_elmres_inmemory(app, output_specs)\n`;
      pre += `${indent}    row.update(extract_timeseries_outputs(_ts_time, _ts_data, output_specs))\n`;
    }
    if (hasCust) {
      pre += `\n${indent}    # Custom calculation outputs\n`;
      pre += `${indent}    row.update(evaluate_custom_calculations(row))\n`;
    }
    if (hasGraph) {
      pre += buildGraphCalls(cfg, indent, hasIterSC, hasIterOS);
    }
    if (hasRaw) {
      pre += buildRawCsvCalls(cfg, indent, hasIterSC, hasIterOS);
    }
    pre += `\n${indent}    # Restore input attributes to their initial values\n`;
    pre += `${indent}    for _obj, _var, _orig in _input_restore_list:\n`;
    pre += `${indent}        if _orig is not None:\n`;
    pre += `${indent}            _obj.SetAttribute(_var, _orig)\n`;
    pre += `\n${indent}    results_df = pd.concat([results_df, pd.DataFrame([row])], ignore_index=True)\n`;
    pre += `${indent}    success_count += 1\n\n`;
    pre += `${indent}except Exception:\n`;
    pre += `${indent}    # Restore input attributes even on failure\n`;
    pre += `${indent}    for _obj, _var, _orig in _input_restore_list:\n`;
    pre += `${indent}        if _orig is not None:\n`;
    pre += `${indent}            _obj.SetAttribute(_var, _orig)\n`;
    pre += `${indent}    failed_count += 1\n`;
    pre += `${indent}    error_row = {"error": traceback.format_exc()}\n`;
    pre += `${indent}    results_df = pd.concat([results_df, pd.DataFrame([error_row])], ignore_index=True)\n`;
    if (hasSave) {
      pre += `\n${indent}last_save_time = save_intermediate_results(results_df, output_dir, "intermediate", last_save_time, ${intervalMin})\n`;
    }
    pre += `\n${wrapperEnd}`;
  }

  // ─── CUSTOM SCENARIO ──────────────────────────────────────────────
  else if (pt === 'custom') {
    // Cache initial attribute values once, before all loops
    pre += `
# Cache initial attribute values — restored to original after each simulation run
_input_restore_list = []
for _spec in _col_specs:
    for _obj in _col_object_cache[_spec["object_query"]]:
        try:
            _orig_val = _obj.GetAttribute(_spec["attribute"])
        except Exception:
            _orig_val = None
        _input_restore_list.append((_obj, _spec["attribute"], _orig_val))
`;
    if (hasBar) {
      pre += `\n${wrapperStart}${indentOS}for _, scenario_row in tqdm(scenario_df.iterrows(), total=len(scenario_df), desc="Scenarios"):\n`;
    } else {
      pre += `\n${wrapperStart}${indentOS}for _, scenario_row in scenario_df.iterrows():\n`;
    }
    pre += `${indent}try:\n`;
    pre += `${indent}    iteration_count += 1\n`;
    pre += `${indent}    row = {}\n\n`;
    pre += `${indent}    for _spec in _col_specs:\n`;
    pre += `${indent}        _value = scenario_row[_spec["name"]]\n`;
    pre += `${indent}        if pd.isna(_value):\n`;
    pre += `${indent}            continue\n`;
    pre += `${indent}        _objs = _col_object_cache[_spec["object_query"]]\n`;
    pre += `${indent}        for _obj in _objs:\n`;
    pre += `${indent}            _obj.SetAttribute(_spec["attribute"], _value)\n`;
    pre += `${indent}        if len(_objs) == 1:\n`;
    pre += `${indent}            row[_spec["name"]] = _value\n`;
    pre += `${indent}        else:\n`;
    pre += `${indent}            for _obj in _objs:\n`;
    pre += `${indent}                row[f"{_spec['name']} {_obj.loc_name}"] = _value\n\n`;
    pre += `${indent}    ${runCall}\n`;
    pre += `${indent}    row["Converge?"] = _converged\n\n`;
    pre += `${indent}    for spec in output_specs:\n`;
    pre += `${indent}        if spec["type"] == "attribute":\n`;
    pre += `${indent}            _attr_val = extract_attribute_output(app, spec["object_query"], spec["variable"])\n`;
    pre += `${indent}            if isinstance(_attr_val, dict):\n`;
    pre += `${indent}                for _loc, _val in _attr_val.items():\n`;
    pre += `${indent}                    row[f"{spec['name']}_{_loc}"] = _val\n`;
    pre += `${indent}            else:\n`;
    pre += `${indent}                row[spec["name"]] = _attr_val\n`;
    if (hasTs) {
      pre += `\n${indent}    # Read ElmRes in-memory (once per simulation run)\n`;
      pre += `${indent}    _ts_time, _ts_data = _read_elmres_inmemory(app, output_specs)\n`;
      pre += `${indent}    row.update(extract_timeseries_outputs(_ts_time, _ts_data, output_specs))\n`;
    }
    if (hasCust) {
      pre += `${indent}    row.update(evaluate_custom_calculations(row))\n`;
    }
    if (hasGraph) {
      pre += buildGraphCalls(cfg, indent, hasIterSC, hasIterOS);
    }
    if (hasRaw) {
      pre += buildRawCsvCalls(cfg, indent, hasIterSC, hasIterOS);
    }
    pre += `\n${indent}    # Restore input attributes to their initial values\n`;
    pre += `${indent}    for _obj, _var, _orig in _input_restore_list:\n`;
    pre += `${indent}        if _orig is not None:\n`;
    pre += `${indent}            _obj.SetAttribute(_var, _orig)\n`;
    pre += `\n${indent}    results_df = pd.concat([results_df, pd.DataFrame([row])], ignore_index=True)\n`;
    pre += `${indent}    success_count += 1\n\n`;
    pre += `${indent}except Exception:\n`;
    pre += `${indent}    # Restore input attributes even on failure\n`;
    pre += `${indent}    for _obj, _var, _orig in _input_restore_list:\n`;
    pre += `${indent}        if _orig is not None:\n`;
    pre += `${indent}            _obj.SetAttribute(_var, _orig)\n`;
    pre += `${indent}    failed_count += 1\n`;
    pre += `${indent}    error_row = {"error": traceback.format_exc()}\n`;
    pre += `${indent}    results_df = pd.concat([results_df, pd.DataFrame([error_row])], ignore_index=True)\n`;
    if (hasSave) {
      pre += `\n${indent}last_save_time = save_intermediate_results(results_df, output_dir, "intermediate", last_save_time, ${intervalMin})\n`;
    }
    pre += `\n${wrapperEnd}`;
  }

  // ─── CONTINGENCY ──────────────────────────────────────────────────
  else if (pt === 'contingency') {
    const contTypes = cfg.contingencyMode.elementTypes || [];
    const contN     = parseInt(cfg.contingencyMode.contingencyN || '1', 10);
    const combine   = cfg.contingencyMode.combineTypes || false;

    let groupCode = `\n# ── CONTINGENCY SETUP ────────────────────────────────────────────\n_contingency_groups = {}\n`;
    contTypes.forEach((t, gi) => {
      const filterExpr = buildContingencyFilterExpr(t.filterAttr, t.filterOp, t.filterVal);
      if (filterExpr) {
        groupCode += `_raw_${gi} = get_pf_objects(app, "${t.query}")\n`;
        groupCode += `_contingency_groups["${t.query}"] = [o for o in _raw_${gi} if ${filterExpr}]\n`;
      } else {
        groupCode += `_contingency_groups["${t.query}"] = get_pf_objects(app, "${t.query}")\n`;
      }
    });

    if (contN === 1) {
      groupCode += `\n_all_contingency_elements = [o for grp in _contingency_groups.values() for o in grp]\ncontingencies = [(obj,) for obj in _all_contingency_elements]\n`;
    } else if (combine) {
      groupCode += `\n_all_contingency_elements = [o for grp in _contingency_groups.values() for o in grp]\ncontingencies = list(itertools.combinations(_all_contingency_elements, ${contN}))\n`;
    } else {
      groupCode += `\n# N-${contN} without cross-type combination — pairs within same element type only\ncontingencies = []\nfor _grp in _contingency_groups.values():\n    contingencies.extend(itertools.combinations(_grp, ${contN}))\n`;
    }

    pre += groupCode;

    const baseCaseRowParts = Array.from({length: contN}, (_, k) => `"Contingent Element ${k+1}": "Base Case"`).join(', ');

    pre += `\n${wrapperStart}${indentOS}# ── Base Case (all elements in service) ─────────────────────────\n`;
    pre += `${indentOS}try:\n`;
    pre += `${indentOS}    iteration_count += 1\n`;
    pre += `${indentOS}    _converged = run_study_steady_state(app)\n`;
    pre += `${indentOS}    row = {${baseCaseRowParts}, "Converge?": _converged}\n`;
    pre += `${indentOS}    if _converged:\n`;
    pre += `${indentOS}        for spec in output_specs:\n`;
    pre += `${indentOS}            if spec["type"] == "attribute":\n`;
    pre += `${indentOS}                _v = extract_attribute_output(app, spec["object_query"], spec["variable"])\n`;
    pre += `${indentOS}                if isinstance(_v, dict):\n`;
    pre += `${indentOS}                    for _loc, _val in _v.items():\n`;
    pre += `${indentOS}                        row[f"{spec['name']}_{_loc}"] = _val\n`;
    pre += `${indentOS}                else:\n`;
    pre += `${indentOS}                    row[spec["name"]] = _v\n`;
    if (hasCust) {
      pre += `${indentOS}        row.update(evaluate_custom_calculations(row))\n`;
    }
    pre += `${indentOS}    results_df = pd.concat([results_df, pd.DataFrame([row])], ignore_index=True)\n`;
    pre += `${indentOS}    success_count += 1\n`;
    pre += `${indentOS}except Exception:\n`;
    pre += `${indentOS}    failed_count += 1\n`;
    pre += `${indentOS}    results_df = pd.concat([results_df, pd.DataFrame([{${baseCaseRowParts}, "error": traceback.format_exc()}])], ignore_index=True)\n`;

    const loopVar = hasBar ? `tqdm(contingencies, desc="Contingency")` : `contingencies`;
    pre += `\n${indentOS}# ── N-${contN} Loop ─────────────────────────────────────────────────\n`;
    pre += `${indentOS}for contingency_tuple in ${loopVar}:\n`;
    pre += `${indentOS}    try:\n`;
    pre += `${indentOS}        iteration_count += 1\n`;
    pre += `${indentOS}        for _elem in contingency_tuple:\n`;
    pre += `${indentOS}            _elem.SetAttribute("outserv", 1)\n`;
    pre += `${indentOS}        _converged = run_study_steady_state(app)\n`;
    pre += `${indentOS}        row = {}\n`;
    pre += `${indentOS}        for _ci, _elem in enumerate(contingency_tuple, start=1):\n`;
    pre += `${indentOS}            row[f"Contingent Element {_ci}"] = _elem.loc_name\n`;
    pre += `${indentOS}        row["Converge?"] = _converged\n`;
    pre += `${indentOS}        if _converged:\n`;
    pre += `${indentOS}            for spec in output_specs:\n`;
    pre += `${indentOS}                if spec["type"] == "attribute":\n`;
    pre += `${indentOS}                    _v = extract_attribute_output(app, spec["object_query"], spec["variable"])\n`;
    pre += `${indentOS}                    if isinstance(_v, dict):\n`;
    pre += `${indentOS}                        for _loc, _val in _v.items():\n`;
    pre += `${indentOS}                            row[f"{spec['name']}_{_loc}"] = _val\n`;
    pre += `${indentOS}                    else:\n`;
    pre += `${indentOS}                        row[spec["name"]] = _v\n`;
    if (hasCust) {
      pre += `${indentOS}            row.update(evaluate_custom_calculations(row))\n`;
    }
    pre += `${indentOS}        results_df = pd.concat([results_df, pd.DataFrame([row])], ignore_index=True)\n`;
    pre += `${indentOS}        success_count += 1\n`;
    pre += `${indentOS}    except Exception:\n`;
    pre += `${indentOS}        failed_count += 1\n`;
    pre += `${indentOS}        _err_row = {}\n`;
    pre += `${indentOS}        for _ci, _elem in enumerate(contingency_tuple, start=1):\n`;
    pre += `${indentOS}            _err_row[f"Contingent Element {_ci}"] = _elem.loc_name\n`;
    pre += `${indentOS}        _err_row["error"] = traceback.format_exc()\n`;
    pre += `${indentOS}        results_df = pd.concat([results_df, pd.DataFrame([_err_row])], ignore_index=True)\n`;
    pre += `${indentOS}    finally:\n`;
    pre += `${indentOS}        for _elem in contingency_tuple:\n`;
    pre += `${indentOS}            _elem.SetAttribute("outserv", 0)\n`;
    if (hasSave) {
      pre += `\n${indentOS}    last_save_time = save_intermediate_results(results_df, output_dir, "intermediate", last_save_time, ${intervalMin})\n`;
    }
    pre += `\n${wrapperEnd}`;
  }

  // ─── OPTIMISATION ─────────────────────────────────────────────────
  else if (pt === 'optimisation') {
    const alg       = cfg.optimisation.algorithm;
    const sense     = cfg.optimisation.sense || 'minimise';
    const objName   = cfg.optimisation.objectiveOutputName || 'OBJECTIVE_OUTPUT_HERE';
    const maxIter   = cfg.optimisation.maxIterations || 50;
    const constraints = cfg.optimisation.constraints || [];

    // Build constraint penalty block
    let penaltyLines = '';
    if (constraints.length > 0) {
      penaltyLines += '    penalty = 0.0\n';
      constraints.forEach(c => {
        penaltyLines += `    if not (row.get("${c.output}", 0) ${c.operator} ${c.value}):\n`;
        penaltyLines += `        penalty += 1e6\n`;
      });
      penaltyLines += '    objective_value_adjusted = objective_value + penalty\n';
    } else {
      penaltyLines += '    objective_value_adjusted = objective_value\n';
    }

    const returnLine = sense === 'maximise'
      ? '    return -(objective_value_adjusted)'
      : '    return objective_value_adjusted';

    pre += `
effective_bounds = [(float(spec["lower"]), float(spec["upper"])) for spec in input_specs]

# Cache initial attribute values — restored after each evaluate_one_case call
_input_restore_list = []
for _i, _spec in enumerate(input_specs):
    for _obj in input_objects[_i]:
        try:
            _orig_val = _obj.GetAttribute(_spec["variable"])
        except Exception:
            _orig_val = None
        _input_restore_list.append((_obj, _spec["variable"], _orig_val))


def evaluate_one_case(param_values):
    global iteration_count, results_df
    iteration_count += 1
    row = {}

    for spec_idx, value in enumerate(param_values):
        spec = input_specs[spec_idx]
        for obj in input_objects[spec_idx]:
            obj.SetAttribute(spec["variable"], value)
        if len(input_objects[spec_idx]) == 1:
            row[spec["name"]] = value
        else:
            for obj in input_objects[spec_idx]:
                row[f"{spec['name']} {obj.loc_name}"] = value

    ${runCall}
    row["Converge?"] = _converged

    for spec in output_specs:
        if spec["type"] == "attribute":
            _attr_val = extract_attribute_output(app, spec["object_query"], spec["variable"])
            if isinstance(_attr_val, dict):
                for _loc, _val in _attr_val.items():
                    row[f"{spec['name']}_{_loc}"] = _val
            else:
                row[spec["name"]] = _attr_val
`;
    if (hasTs) {
      pre += `
    # Read ElmRes in-memory (once per simulation run)
    _ts_time, _ts_data = _read_elmres_inmemory(app, output_specs)
    row.update(extract_timeseries_outputs(_ts_time, _ts_data, output_specs))
`;
    }
    if (hasCust) {
      pre += `    row.update(evaluate_custom_calculations(row))\n`;
    }
    if (hasGraph) {
      // In optimisation mode there is no study/op scenario iteration context
      pre += `\n    # Timeseries graphs (saved to graph_dir)\n`;
      pre += `    _raw_ctx = []\n`;
      pre += `    for _rspec in [s for s in output_specs if s["type"] == "timeseries" and s.get("output_graph")]:\n`;
      pre += `        save_timeseries_graph(_ts_time, _ts_data, _rspec, row, graph_dir, _raw_ctx)\n`;
    }
    if (hasRaw) {
      pre += `\n    # Timeseries raw CSV (saved to raw_dir)\n`;
      pre += `    _raw_ctx = []\n`;
      pre += `    for _rspec in [s for s in output_specs if s["type"] == "timeseries" and s.get("output_raw_csv")]:\n`;
      pre += `        save_timeseries_raw_csv(_ts_time, _ts_data, _rspec, row, raw_dir, _raw_ctx)\n`;
    }
    pre += `
    # Restore input attributes to their initial values
    for _obj, _var, _orig in _input_restore_list:
        if _orig is not None:
            _obj.SetAttribute(_var, _orig)

    results_df = pd.concat([results_df, pd.DataFrame([row])], ignore_index=True)
    return row


`;

    if (alg === 'gp_minimize') {
      pre += `space = []\n`;
      pre += `for spec_idx, spec in enumerate(input_specs):\n`;
      pre += `    if spec["dtype"] == "int":\n`;
      pre += `        space.append(Integer(int(spec["lower"]), int(spec["upper"]), name=f"slot_{spec_idx}"))\n`;
      pre += `    else:\n`;
      pre += `        space.append(Real(float(spec["lower"]), float(spec["upper"]), name=f"slot_{spec_idx}"))\n\n`;

      pre += `@use_named_args(space)\ndef objective(**params):\n`;
      pre += `    ordered_values = [params[f"slot_{i}"] for i in range(len(input_specs))]\n`;
      pre += `    row = evaluate_one_case(ordered_values)\n\n`;
      pre += `    objective_value = row["${objName}"]\n`;
      pre += penaltyLines + '\n';
      pre += returnLine + '\n\n';
      pre += `result = gp_minimize(objective, space, n_calls=${maxIter}, random_state=42)\n`;
      pre += `safe_print(f"Optimisation complete. Best value: {result.fun}")\n`;

    } else if (alg === 'differential_evolution') {
      pre += `def de_objective(param_values):\n`;
      pre += `    row = evaluate_one_case(list(param_values))\n`;
      pre += `    objective_value = row["${objName}"]\n`;
      pre += penaltyLines + '\n';
      pre += returnLine + '\n\n';
      pre += `result = differential_evolution(de_objective, effective_bounds, maxiter=${maxIter}, seed=42)\n`;
      pre += `safe_print(f"Optimisation complete. Best value: {result.fun}")\n`;

    } else if (alg.startsWith('scipy_')) {
      const scipyMethod = (ALGORITHM_META[alg] || {}).method || 'L-BFGS-B';
      const useBounds   = (ALGORITHM_META[alg] || {}).bounds !== false;
      pre += `def minimize_objective(param_values):\n`;
      pre += `    row = evaluate_one_case(list(param_values))\n`;
      pre += `    objective_value = row["${objName}"]\n`;
      pre += penaltyLines + '\n';
      pre += returnLine + '\n\n';
      pre += `x0 = [(b[0] + b[1]) / 2 for b in effective_bounds]\n`;
      if (useBounds) {
        pre += `result = minimize(minimize_objective, x0, method='${scipyMethod}', bounds=effective_bounds, options={"maxiter": ${maxIter}})\n`;
      } else {
        pre += `result = minimize(minimize_objective, x0, method='${scipyMethod}', options={"maxiter": ${maxIter}})\n`;
      }
      pre += `safe_print(f"Optimisation complete. Best value: {result.fun}")\n`;

    } else {
      // Placeholder
      pre += `# TODO: Replace with your preferred optimisation algorithm\n`;
      pre += `# Current selection: Placeholder — wire up evaluate_one_case manually.\n`;
      pre += `# Example: call evaluate_one_case([val0, val1, ...]) for each input variable slot\n`;
    }
  }

  return pre;
}

// ── OUTPUT EXPORT ─────────────────────────────────────────────
function buildOutputExport(cfg) {
  return `
# ── OUTPUT EXPORT ─────────────────────────────────────────────────
final_output_path = os.path.join(output_dir, f"Run{timestamp_string()}.csv")
with open(final_output_path, "w", newline="") as _out_f:
    _out_f.write("# Made using tool.adjiebrotots.com/powerfactory-scripter\\n")
    results_df.to_csv(_out_f, index=False)

print("Run complete.")
print(f"Final output: {final_output_path}")
print(f"Total attempted runs: {len(results_df)}")
`;
}

// ── NOTEBOOK WRAPPER ──────────────────────────────────────────
function buildNotebookWrapper(sections) {
  const cellNames = [
    'Preparation & Imports',
    'Helper Functions',
    'Project Selection & Checks',
    'Input Specs & Object Resolution',
    'Output Specs',
    'Problem Loop & Study Execution',
    'Output Export'
  ];
  let result = '';
  sections.forEach((sec, i) => {
    result += `# ╔══════════════════════════════════════════════════════════════╗\n`;
    result += `# ║ Cell ${i+1} — ${cellNames[i] || 'Section'}\n`;
    result += `# ╚══════════════════════════════════════════════════════════════╝\n`;
    result += sec + '\n';
  });
  return result;
}

// ── PYTHON FILE WRAPPER ───────────────────────────────────────
function buildPythonFileWrapper(body) {
  return `def main():
${body.split('\n').map(l => '    ' + l).join('\n')}


if __name__ == "__main__":
    main()
`;
}

/* ================================================================
   ENTRY POINT — assemble all sections into the final script
   ----------------------------------------------------------------
   Pure: returns the generated Python as a string. Owns section
   ORDER and the notebook-vs-python-file wrapping. script.js calls
   this after it has read + validated the config.
================================================================ */
function buildPowerFactoryScript(cfg) {
  // Assemble code sections
  const sec1_imports      = buildImports(cfg);
  const sec2_prep         = buildPreparation(cfg);
  const sec3_projsel      = buildProjectSelection(cfg);
  const sec4_checks       = buildChecks(cfg);
  const sec5_helpers      = buildCommonHelpers(cfg);
  const sec6_studyhelper  = buildStudyHelper(cfg);
  const sec7_elmres       = buildElmResHelpers(cfg);
  const sec7b_graphhelper = buildTimeseriesGraphHelper(cfg);
  const sec7c_rawhelper   = buildRawCsvHelper(cfg);
  const sec8_customfn     = buildCustomFunctionHelpers(cfg);
  const sec9_outdir       = buildOutputDirSetup(cfg);
  const sec10_inputspecs  = buildInputSpecs(cfg);
  const sec11_outspecs    = buildOutputSpecs(cfg);
  const sec12_loop        = buildProblemLoop(cfg);
  const sec13_export      = buildOutputExport(cfg);

  if (cfg.initialisation.codingStyle === 'notebook') {
    // Notebook cell order: helpers first so project-selection cell can call them
    const sections = [
      sec1_imports + sec2_prep,
      sec5_helpers + sec6_studyhelper + sec7_elmres + sec7b_graphhelper + sec7c_rawhelper + sec8_customfn,
      sec3_projsel + sec4_checks,
      sec9_outdir + sec10_inputspecs,
      sec11_outspecs,
      sec12_loop,
      sec13_export
    ];
    return buildNotebookWrapper(sections);
  }

  // Python file style — helpers must be defined before top-level calls that use them
  const body = [
    sec1_imports,
    sec5_helpers,
    sec6_studyhelper,
    sec7_elmres,
    sec7b_graphhelper,
    sec7c_rawhelper,
    sec8_customfn,
    sec2_prep,
    sec3_projsel,
    sec4_checks,
    sec9_outdir,
    sec10_inputspecs,
    sec11_outspecs,
    sec12_loop,
    sec13_export,
  ].join('\n');
  return buildPythonFileWrapper(body);
}
