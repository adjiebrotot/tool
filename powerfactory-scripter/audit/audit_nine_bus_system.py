#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# =============================================================================
#  POWERFACTORY-SCRIPTER  —  FULL API AUDIT  (Nine-bus System)
# -----------------------------------------------------------------------------
#  Purpose
#  -------
#  This is a STANDALONE audit/smoke-test that exercises *every* PowerFactory
#  Python-API call, pattern and result-handling assumption that the code
#  generator at  tool.adjiebrotots.com/powerfactory-scripter  emits.
#
#  It does NOT depend on any generated script. Instead it independently
#  re-implements each API "anchor" (see README.md §15 + pf-script-builder.js)
#  and runs it against a live PowerFactory instance with the default
#  "Nine-bus System" demo project, printing a numbered CHECKPOINT for each.
#
#  Every checkpoint is mapped (`-> builder fn`) to the generator function /
#  helper it validates, so a failure tells you *exactly* which generated
#  Python pattern is broken on your PowerFactory build.
#
#  How to use
#  ----------
#  1. Edit the CONFIG block below (API_PATH / PROJECT_NAME / USERNAME).
#  2. Run with the SAME Python that ships with PowerFactory, e.g.:
#         "C:\\Program Files\\DIgSILENT\\PowerFactory 2024\\Python\\3.12\\python.exe" audit_nine_bus_system.py
#     (or any 3.12 interpreter on PATH).
#  3. Copy the ENTIRE terminal output back to the chat. Each checkpoint is
#     PASS / WARN / SKIP / FAIL; FAIL lines include a full traceback.
#
#  Safety
#  ------
#  * Non-destructive: every attribute it changes (outserv, pgini, command
#    fields) is restored, and the originally-active study case is reactivated
#    at the end.
#  * It never calls CommitTransaction(), so nothing is written to the DB.
#  * The only residue is that the RMS phase may register a couple of monitor
#    variables on the study-case ElmRes (harmless; not committed). If you want
#    a perfectly pristine project, just don't save when PowerFactory exits.
# =============================================================================

import sys
import os
import traceback
import importlib
from datetime import datetime

# ============================== CONFIG =======================================
# Path to the PowerFactory python\<ver> folder (must match the Python you run).
API_PATH     = r"C:\Program Files\DIgSILENT\PowerFactory 2024\Python\3.12"

# Name of the project to audit (PowerFactory's bundled demo).
PROJECT_NAME = "Nine-bus System"

# PowerFactory user. Leave "" to connect as the current/last user (recommended).
# NOTE: the web tool hard-codes  pf.GetApplication("<username>")  — see CP 0.2.
USERNAME     = ""

# Dynamic-RMS smoke test. Keep tstop small so the audit stays fast.
RUN_RMS      = True
RMS_TSTOP    = 1.0          # seconds of simulated time for the audit run

# Run the (optional) harmonic load-flow probe. Fine to leave on; reported as
# WARN if the model has no harmonic sources configured.
RUN_HARMONIC = True
# =============================================================================


# ----------------------------------------------------------------------------
#  Tiny checkpoint harness
# ----------------------------------------------------------------------------
class Warn(Exception):
    """Raise inside a checkpoint to record a WARN (worked, but unexpected)."""


class Skip(Exception):
    """Raise inside a checkpoint to record a SKIP (precondition not met)."""


STATE = {}                       # shared objects between checkpoints
RECORDS = []                     # (cid, status, maps_to, label, detail)
COUNTS = {"PASS": 0, "WARN": 0, "SKIP": 0, "FAIL": 0}


def run(cid, maps_to, label, fn):
    """Execute one checkpoint function, capturing status + detail.

    fn() should return a detail string on success, or raise Warn / Skip /
    any Exception. Returns True on PASS (so callers can gate dependents).
    """
    status, detail, tb = "PASS", "", None
    try:
        detail = fn() or ""
    except Skip as e:
        status, detail = "SKIP", str(e)
    except Warn as e:
        status, detail = "WARN", str(e)
    except Exception as e:                       # noqa: BLE001 — audit wants all
        status = "FAIL"
        detail = f"{type(e).__name__}: {e}"
        tb = traceback.format_exc()

    COUNTS[status] += 1
    RECORDS.append((cid, status, maps_to, label, detail))

    line = f"[{cid:>4}] {status:<4} | {maps_to:<24} | {label}"
    if detail:
        line += f"  ->  {detail}"
    print(line, flush=True)
    if tb:
        for ln in tb.rstrip().splitlines():
            print(f"           {ln}", flush=True)
    return status == "PASS"


def info(msg):
    """Print an indented info line (extra context under a checkpoint)."""
    print(f"           {msg}", flush=True)


def fmt(v, nd=4):
    try:
        return f"{float(v):.{nd}f}"
    except Exception:
        return str(v)


def first_attr(obj, candidates):
    """Return (varname, value) for the first attribute name that resolves.

    PowerFactory exposes some result variables under more than one form
    (e.g. 'm:P:bus1' vs 'm:P'); the generated scripts let the user pick, so
    the audit tries the common spellings rather than hard-coding one.
    """
    last = None
    for name in candidates:
        try:
            return name, obj.GetAttribute(name)
        except Exception as e:                       # noqa: BLE001
            last = e
    raise RuntimeError(f"none of {candidates} readable ({last})")


def banner(text):
    print("", flush=True)
    print("=" * 78, flush=True)
    print(f"  {text}", flush=True)
    print("=" * 78, flush=True)


# ============================================================================
#  PHASE 0 — Environment, dependencies & connection
# ============================================================================
def phase0():
    banner("PHASE 0  —  Environment, dependencies & connection")

    # --- 0.1  sys.path + import powerfactory  (mirrors buildImports) --------
    def cp_import():
        if not os.path.isdir(API_PATH):
            raise Warn(f"API_PATH does not exist: {API_PATH!r} — fix CONFIG "
                       f"(import may still work if powerfactory is on PYTHONPATH)")
        sys.path.append(API_PATH)
        pf = importlib.import_module("powerfactory")
        STATE["pf"] = pf
        ver = getattr(pf, "__version__", "unknown")
        return f"powerfactory module loaded (module.__version__ = {ver})"

    if not run("0.1", "buildImports", "sys.path.append + import powerfactory", cp_import):
        # Without the module nothing else can run.
        info("FATAL: cannot import 'powerfactory'. Check API_PATH and that you")
        info("are running PowerFactory's bundled Python (3.12 for PF 2024).")
        return False

    # --- 0.2  Connection  (mirrors buildPreparation) -----------------------
    def cp_connect():
        pf = STATE["pf"]
        app = None
        used = None
        # Preferred, documented, robust: GetApplicationExt (throws on failure).
        try:
            app = pf.GetApplicationExt(USERNAME) if USERNAME else pf.GetApplicationExt()
            used = "GetApplicationExt()"
        except Exception as e:                   # noqa: BLE001
            info(f"GetApplicationExt failed ({type(e).__name__}: {e}); "
                 f"falling back to GetApplication()")
            app = pf.GetApplication(USERNAME) if USERNAME else pf.GetApplication()
            used = "GetApplication()"
        if app is None:
            raise RuntimeError("Application object is None — PowerFactory not reachable")
        STATE["app"] = app
        return f"connected via {used}"

    if not run("0.2", "buildPreparation", "Connect to PowerFactory engine", cp_connect):
        info("FATAL: could not connect to PowerFactory. Is an instance running /")
        info("licensed for engine mode? Aborting remaining checkpoints.")
        return False

    # --- 0.2b  Exact generator connection pattern --------------------------
    #   The web tool emits  pf.GetApplication("<username>")  literally. If you
    #   leave the username box blank, it emits the PLACEHOLDER string, which is
    #   NOT a valid user. This checkpoint flags that footgun.
    def cp_tool_pattern():
        pf = STATE["pf"]
        if USERNAME == "":
            # Reproduce what the tool emits when username is blank.
            try:
                _ = pf.GetApplication("USERNAME_HERE")
            except Exception as e:               # noqa: BLE001
                raise Warn("tool emits pf.GetApplication(\"USERNAME_HERE\") when the "
                           "username box is blank -> connect fails with "
                           f"{type(e).__name__}. Fill in the username field, or use "
                           "GetApplicationExt(). (Audit itself connected fine above.)")
            raise Warn("pf.GetApplication(\"USERNAME_HERE\") unexpectedly returned an "
                       "app; still: fill the username field for clarity.")
        app2 = pf.GetApplication(USERNAME)
        if app2 is None:
            raise RuntimeError("pf.GetApplication(USERNAME) returned None")
        return f"pf.GetApplication({USERNAME!r}) OK (tool's exact call works)"

    run("0.2b", "buildPreparation", "Tool's literal GetApplication(username) call", cp_tool_pattern)

    # --- 0.3  Version / current user  --------------------------------------
    def cp_user():
        app = STATE["app"]
        user = app.GetCurrentUser()
        if user is None:
            raise RuntimeError("GetCurrentUser() returned None")
        STATE["user"] = user
        name = getattr(user, "loc_name", "?")
        try:
            calc = app.GetActiveCalculationStr()
        except Exception:
            calc = "n/a"
        return f"GetCurrentUser()='{name}', active calc='{calc}'"

    run("0.3", "buildPreparation", "app.GetCurrentUser()", cp_user)

    # --- 0.4  Generated-script Python dependencies -------------------------
    #   The generated scripts always import pandas + numpy; matplotlib/tqdm/
    #   scipy/skopt are conditional on options. Missing ones break the script
    #   even though the PF API is fine — so probe them here.
    def cp_deps():
        required = ["pandas", "numpy"]
        optional = ["matplotlib", "tqdm", "scipy", "skopt"]
        missing_req, ok_opt, missing_opt = [], [], []
        for m in required:
            try:
                importlib.import_module(m)
            except Exception:
                missing_req.append(m)
        for m in optional:
            try:
                importlib.import_module(m)
                ok_opt.append(m)
            except Exception:
                missing_opt.append(m)
        info(f"required present: {[m for m in required if m not in missing_req]}")
        info(f"optional present: {ok_opt}")
        info(f"optional missing: {missing_opt}  (only needed for graphs/tqdm/optimisation)")
        if missing_req:
            raise Warn(f"REQUIRED libs missing from this interpreter: {missing_req} "
                       f"— every generated script will fail at import. "
                       f"pip install them into PowerFactory's Python.")
        return f"pandas+numpy OK; optional present={ok_opt}"

    run("0.4", "buildImports", "Python deps for generated scripts", cp_deps)
    return True


# ============================================================================
#  PHASE 1 — Project / study case / scenario selection
# ============================================================================
def phase1():
    banner("PHASE 1  —  Project, study case & operating scenario")
    app = STATE["app"]

    # --- 1.1  List projects  (mirrors buildPreparation) --------------------
    def cp_list_projects():
        user = STATE["user"]
        projects = user.GetContents("*.IntPrj")
        names = [p.loc_name for p in projects]
        STATE["projects"] = projects
        info(f"projects found: {names}")
        match = [p for p in projects if p.loc_name == PROJECT_NAME]
        if not match:
            raise Warn(f"PROJECT_NAME {PROJECT_NAME!r} not in {names}; will try "
                       f"app.ActivateProject anyway")
        STATE["project_obj"] = match[0]
        return f"{len(projects)} project(s); '{PROJECT_NAME}' present"

    run("1.1", "buildPreparation", "user.GetContents('*.IntPrj')", cp_list_projects)

    # --- 1.2  Activate via project.Activate()  (tool's exact pattern) ------
    def cp_activate():
        proj = STATE.get("project_obj")
        if proj is not None:
            err = proj.Activate()                # tool uses project.Activate()
            if err:
                raise RuntimeError(f"project.Activate() returned non-zero err={err}")
        else:
            err = app.ActivateProject(PROJECT_NAME)
            if err:
                raise RuntimeError(f"app.ActivateProject() returned err={err}")
        active = app.GetActiveProject()
        if active is None:
            raise RuntimeError("GetActiveProject() is None after activation")
        STATE["project"] = active
        STATE["orig_sc"] = app.GetActiveStudyCase()   # remember for restore
        return f"active project = '{active.loc_name}'"

    if not run("1.2", "buildProjectSelection", "project.Activate() + GetActiveProject()", cp_activate):
        info("Cannot continue without an active project.")
        return False

    # --- 1.3  Robust alternative app.ActivateProject(name) -----------------
    def cp_activate_alt():
        err = app.ActivateProject(PROJECT_NAME)
        if err:
            raise Warn(f"app.ActivateProject({PROJECT_NAME!r}) err={err} — the "
                       f"name/path form may differ; project.Activate() (CP 1.2) is "
                       f"the one the tool actually uses")
        return "app.ActivateProject(name) also works (robust alternative)"

    run("1.3", "buildProjectSelection", "app.ActivateProject(name) [alt]", cp_activate_alt)

    # --- 1.4  Study cases  (mirrors get_study_cases) -----------------------
    #   Tool helper: project.GetContents("Study Cases")[0].GetContents()
    #   Cross-checked against the robust app.GetProjectFolder("study").
    def cp_study_cases():
        proj = STATE["project"]
        root = proj.GetContents("Study Cases")
        raw = list(root[0].GetContents()) if root else []   # what the tool returns
        cases = [o for o in raw if o.GetClassName() == "IntCase"]
        others = [(o.loc_name, o.GetClassName()) for o in raw
                  if o.GetClassName() != "IntCase"]
        try:
            folder = app.GetProjectFolder("study")
            by_folder = list(folder.GetContents("*.IntCase")) if folder else []
        except Exception as e:                   # noqa: BLE001
            by_folder = []
            info(f"GetProjectFolder('study') raised {type(e).__name__}: {e}")
        STATE["study_cases"] = cases or by_folder    # IntCase-only for the audit
        STATE["study_cases_raw"] = raw               # unfiltered, like the tool
        info(f"IntCase study cases: {[c.loc_name for c in STATE['study_cases']]}")
        if others:
            info(f"non-IntCase children in 'Study Cases': {others}")
        if not root:
            raise Warn("project.GetContents('Study Cases') returned EMPTY — the tool's "
                       f"get_study_cases() helper would find nothing. "
                       f"GetProjectFolder('study') found {len(by_folder)}. "
                       f"Folder name may be localized/renamed.")
        if others:
            raise Warn(f"'Study Cases' folder also holds NON-IntCase object(s) {others}. "
                       f"The tool's get_study_cases() does project.GetContents(...) "
                       f"UNFILTERED, so iterateStudyCases would call .Activate() on these "
                       f"and fail (that is the CP 1.5 error). Fix: filter to '*.IntCase'.")
        return f"{len(cases)} IntCase(s); {len(others)} non-IntCase child(ren)"

    run("1.4", "get_study_cases", "project.GetContents('Study Cases')", cp_study_cases)

    # --- 1.5  Activate a study case  (mirrors study_case.Activate()) -------
    def cp_activate_sc():
        scs = STATE.get("study_cases") or []      # IntCase-only now
        if not scs:
            raise Skip("no IntCase study cases to activate")
        active = app.GetActiveStudyCase()
        active_fn = active.GetFullName() if active is not None else None
        # Pick a case that is NOT currently active, to genuinely test switching.
        target = next((sc for sc in scs if sc.GetFullName() != active_fn), scs[0])
        err = target.Activate()
        got = app.GetActiveStudyCase()
        STATE["study_case"] = got
        # restore the originally-active case so PHASE 4 runs the load-flow case
        if STATE.get("orig_sc") is not None:
            STATE["orig_sc"].Activate()
        if err != 0:
            raise Warn(f"study_case.Activate() returned err={err} for '{target.loc_name}' "
                       f"(GetActiveStudyCase now='{getattr(got,'loc_name',None)}'). Often a "
                       f"benign 'already active' code — switching otherwise works (CP 7.0 "
                       f"activates a different case fine). The original FAIL came from "
                       f"trying to .Activate() the non-IntCase 'Task Automation' object.")
        if got is None or got.GetFullName() != target.GetFullName():
            raise Warn(f"Activate('{target.loc_name}') OK but GetActiveStudyCase()="
                       f"'{getattr(got,'loc_name',None)}'")
        return (f"switched to '{target.loc_name}' (err={err}), "
                f"restored '{getattr(STATE.get('orig_sc'),'loc_name',None)}'")

    run("1.5", "get_study_cases", "study_case.Activate() + GetActiveStudyCase()", cp_activate_sc)

    # --- 1.6  Operating scenarios  (mirrors get_operating_scenarios) -------
    def cp_scenarios():
        proj = STATE["project"]
        root = proj.GetContents("Operation Scenarios")
        by_name = root[0].GetContents() if root else []
        try:
            folder = app.GetProjectFolder("scen")
            by_folder = folder.GetContents("*.IntScenario") if folder else []
        except Exception as e:                   # noqa: BLE001
            by_folder = []
            info(f"GetProjectFolder('scen') raised {type(e).__name__}: {e}")
        STATE["scenarios"] = list(by_name) or list(by_folder)
        names = [s.loc_name for s in STATE["scenarios"]]
        info(f"operating scenarios: {names if names else '(none)'}")
        if not root and by_folder:
            raise Warn("project.GetContents('Operation Scenarios') EMPTY but "
                       f"GetProjectFolder('scen') found {len(by_folder)} — tool's "
                       f"get_operating_scenarios() helper would miss them.")
        active = app.GetActiveScenario()
        # Activate the first scenario only to validate Activate(); restore later.
        if STATE["scenarios"]:
            STATE["scenarios"][0].Activate()
        return (f"{len(STATE['scenarios'])} scenario(s); "
                f"active now = {getattr(app.GetActiveScenario(),'loc_name', None)}")

    run("1.6", "get_operating_scenarios", "project.GetContents('Operation Scenarios')", cp_scenarios)

    # --- 1.7  Checks block  (mirrors buildChecks) --------------------------
    def cp_checks():
        p = app.GetActiveProject()
        s = app.GetActiveStudyCase()
        o = app.GetActiveScenario()
        info(f"GetActiveProject()      = {getattr(p,'loc_name',None)}")
        info(f"GetActiveStudyCase()    = {getattr(s,'loc_name',None)}")
        info(f"GetActiveScenario()     = {getattr(o,'loc_name',None)}")
        # Window visibility — Hide() is the tool default (openPowerFactoryWindow=false)
        try:
            app.Hide()
            hide_ok = True
        except Exception as e:                   # noqa: BLE001
            hide_ok = False
            info(f"app.Hide() raised {type(e).__name__}: {e}")
        try:
            app.Show()
            app.Hide()                            # leave engine-mode default
            show_note = "Show()/Hide() OK"
        except Exception as e:                    # noqa: BLE001
            show_note = f"Show() unavailable ({type(e).__name__}) — needs full GUI license"
        if not hide_ok:
            raise Warn(f"app.Hide() failed; {show_note}")
        return f"active-context getters OK; {show_note}"

    run("1.7", "buildChecks", "GetActive* + Show()/Hide()", cp_checks)
    return True


# ============================================================================
#  PHASE 2 — Object resolution
# ============================================================================
def phase2():
    banner("PHASE 2  —  Object resolution (GetCalcRelevantObjects / type lib)")
    app = STATE["app"]

    # Expected element counts for the Nine-bus System (from the demo PDF).
    expectations = [
        ("2.1", "*.ElmTerm", 9, "terms",  "buses"),
        ("2.2", "*.ElmSym",  3, "gens",   "synchronous machines"),
        ("2.3", "*.ElmLne",  6, "lines",  "lines"),
        ("2.4", "*.ElmTr2",  3, "trafos", "2-w transformers"),
        ("2.5", "*.ElmLod",  3, "loads",  "loads"),
    ]
    for cid, query, expect, key, desc in expectations:
        def cp(query=query, expect=expect, key=key, desc=desc):
            objs = app.GetCalcRelevantObjects(query)
            objs = list(objs) if objs else []
            STATE[key] = objs
            names = [o.loc_name for o in objs]
            info(f"{query} -> {names}")
            if len(objs) != expect:
                raise Warn(f"{query} returned {len(objs)} {desc}, expected {expect} "
                           f"for the Nine-bus System (model may differ)")
            return f"{len(objs)} {desc}"
        run(cid, "get_pf_objects", f"GetCalcRelevantObjects('{query}')", cp)

    # --- 2.6  Exact-name query (single object resolution) ------------------
    def cp_exact():
        gens = STATE.get("gens") or []
        if not gens:
            raise Skip("no generators discovered in 2.2")
        name = gens[0].loc_name
        query = f"{name}.ElmSym"
        objs = app.GetCalcRelevantObjects(query)
        objs = list(objs) if objs else []
        if len(objs) != 1:
            raise Warn(f"exact query {query!r} returned {len(objs)} objects "
                       f"(expected 1) — names with spaces can need quoting")
        STATE["one_gen"] = objs[0]
        return f"{query} -> 1 object ('{objs[0].loc_name}')"
    run("2.6", "get_pf_objects", "Exact-name query 'G1.ElmSym'", cp_exact)

    # --- 2.7  Type library access  (mirrors get_type_objects) --------------
    def cp_types():
        equip = app.GetProjectFolder("equip")
        if equip is None:
            raise RuntimeError("GetProjectFolder('equip') returned None")
        res = equip.GetContents("*.TypLne", 1)    # recursive=1, like the helper
        res = list(res) if res else []
        info(f"line types in equipment library: {[t.loc_name for t in res]}")
        if not res:
            raise Warn("no TypLne found under GetProjectFolder('equip') — "
                       "get_type_objects() would raise for any *.TypXxx query")
        return f"GetProjectFolder('equip').GetContents('*.TypLne',1) -> {len(res)} type(s)"
    run("2.7", "get_type_objects", "GetProjectFolder('equip') + type lookup", cp_types)
    return True


# ============================================================================
#  PHASE 3 — Attribute get/set + restore
# ============================================================================
def phase3():
    banner("PHASE 3  —  Attribute manipulation (Get/SetAttribute, restore)")
    app = STATE["app"]

    # --- 3.1  GetAttribute (static/input) + identity methods ---------------
    def cp_get():
        gens = STATE.get("gens") or []
        lines = STATE.get("lines") or []
        if not gens or not lines:
            raise Skip("need generators + lines from PHASE 2")
        g = gens[0]
        info(f"gen '{g.loc_name}': GetClassName()={g.GetClassName()}, "
             f"GetFullName()={g.GetFullName()}")
        pg = g.GetAttribute("pgini")              # MW setpoint (input attr)
        os_ = lines[0].GetAttribute("outserv")    # 0/1 (input attr)
        info(f"gen.GetAttribute('pgini')={fmt(pg)} MW; "
             f"line.GetAttribute('outserv')={os_}")
        if not g.HasAttribute("pgini"):
            raise Warn("HasAttribute('pgini') is False on ElmSym (unexpected)")
        return "GetAttribute / GetClassName / GetFullName / HasAttribute OK"
    run("3.1", "extract_attribute_output", "obj.GetAttribute + identity methods", cp_get)

    # --- 3.2  SetAttribute round-trip on a numeric input -------------------
    def cp_set_numeric():
        gens = STATE.get("gens") or []
        if not gens:
            raise Skip("no generators")
        g = gens[0]
        orig = g.GetAttribute("pgini")
        test = (orig or 0.0) + 5.0
        g.SetAttribute("pgini", test)             # tool uses SetAttribute(name,val)
        read = g.GetAttribute("pgini")
        g.SetAttribute("pgini", orig)             # restore
        back = g.GetAttribute("pgini")
        if abs(read - test) > 1e-6:
            raise RuntimeError(f"SetAttribute did not take: set {test}, read {read}")
        if abs(back - (orig or 0.0)) > 1e-6:
            raise RuntimeError(f"restore failed: expected {orig}, got {back}")
        return f"pgini {fmt(orig)}->{fmt(test)}->restored {fmt(back)} (set/read/restore OK)"
    run("3.2", "buildProblemLoop (input set)", "SetAttribute round-trip (numeric)", cp_set_numeric)

    # --- 3.3  outserv trip + restore (mirrors contingency element loop) ----
    def cp_set_outserv():
        lines = STATE.get("lines") or []
        if not lines:
            raise Skip("no lines")
        ln = lines[0]
        orig = ln.GetAttribute("outserv")
        ln.SetAttribute("outserv", 1)             # trip
        tripped = ln.GetAttribute("outserv")
        is_oos = ln.IsOutOfService()              # README §15 lists this
        ln.SetAttribute("outserv", orig)          # restore (finally-style)
        if tripped != 1:
            raise RuntimeError("SetAttribute('outserv',1) did not stick")
        if not is_oos:
            raise Warn("IsOutOfService() returned False right after outserv=1")
        return (f"line '{ln.loc_name}' outserv {orig}->1 (IsOutOfService={is_oos}) "
                f"->restored {ln.GetAttribute('outserv')}")
    run("3.3", "contingency loop", "SetAttribute('outserv') + IsOutOfService", cp_set_outserv)
    return True


# ============================================================================
#  PHASE 4 — Steady-state load flow + result extraction
# ============================================================================
def phase4():
    banner("PHASE 4  —  Steady-state load flow (ComLdf) + results")
    app = STATE["app"]

    # --- 4.1 / 4.2  ComLdf  (mirrors run_study_steady_state) ---------------
    def cp_ldf():
        cmd = app.GetFromStudyCase("ComLdf")
        if cmd is None:
            raise RuntimeError("GetFromStudyCase('ComLdf') returned None")
        STATE["comldf"] = cmd
        err = cmd.Execute()
        STATE["ldf_ok"] = (err == 0)
        if err != 0:
            raise Warn(f"ComLdf.Execute() returned {err} (load flow did not converge "
                       f"on the active scenario) — API works, model/scenario issue")
        return "GetFromStudyCase('ComLdf').Execute() == 0 (converged)"
    run("4.1", "run_study_steady_state", "ComLdf.Execute()", cp_ldf)

    # --- 4.3  Bus voltage results vs the demo PDF (output expectation) -----
    def cp_bus_v():
        if not STATE.get("ldf_ok"):
            raise Skip("load flow did not converge")
        terms = STATE.get("terms") or []
        if not terms:
            raise Skip("no terminals")
        rows = []
        for t in terms:
            try:
                u = t.GetAttribute("m:u")          # p.u. magnitude (load_flow)
                ph = t.GetAttribute("m:phiu")      # deg
                rows.append((t.loc_name, u, ph))
            except Exception as e:                 # noqa: BLE001
                rows.append((t.loc_name, None, f"ERR {e}"))
        for name, u, ph in sorted(rows, key=lambda r: str(r[0])):
            info(f"  {name:<10} m:u={fmt(u,4)} p.u.   m:phiu={fmt(ph,2)} deg")
        mags = [u for _, u, _ in rows if isinstance(u, (int, float))]
        if not mags:
            raise RuntimeError("could not read m:u on any terminal after LDF")
        if not all(0.85 <= m <= 1.15 for m in mags):
            raise Warn(f"some bus voltages outside 0.85-1.15 p.u. (min={fmt(min(mags))}, "
                       f"max={fmt(max(mags))}) — check the model")
        slack = [u for n, u, _ in rows if "1" in str(n)]
        note = ""
        if slack:
            note = f"; a '..1' bus reads {fmt(slack[0])} p.u. (PDF Bus 1 = 1.040)"
        vrange = f"{fmt(min(mags))}-{fmt(max(mags))}"
        return f"read m:u/m:phiu on {len(mags)} buses; range {vrange} p.u.{note}"
    run("4.3", "extract_attribute_output", "Bus m:u / m:phiu vs PDF", cp_bus_v)

    # --- 4.4  Line loading / losses (calc-result attributes) ---------------
    def cp_line_res():
        if not STATE.get("ldf_ok"):
            raise Skip("load flow did not converge")
        lines = STATE.get("lines") or []
        if not lines:
            raise Skip("no lines")
        ok = 0
        for ln in lines:
            load = ln.GetAttribute("c:loading")    # %
            loss = ln.GetAttribute("c:Losses")     # MW
            info(f"  {ln.loc_name:<10} c:loading={fmt(load,2)} %   c:Losses={fmt(loss,4)} MW")
            ok += 1
        return f"read c:loading + c:Losses on {ok} lines"
    run("4.4", "extract_attribute_output", "Line c:loading / c:Losses", cp_line_res)

    # --- 4.5  Generator P/Q vs PDF -----------------------------------------
    def cp_gen_res():
        if not STATE.get("ldf_ok"):
            raise Skip("load flow did not converge")
        gens = STATE.get("gens") or []
        if not gens:
            raise Skip("no generators")
        totP = 0.0
        pvar = qvar = None
        for g in gens:
            pvar, P = first_attr(g, ["m:P:bus1", "m:P"])   # MW at terminal
            qvar, Q = first_attr(g, ["m:Q:bus1", "m:Q"])   # Mvar
            totP += P or 0.0
            info(f"  {g.loc_name:<10} {pvar}={fmt(P,3)} MW   {qvar}={fmt(Q,3)} Mvar")
        # PDF: G1 71.6 + G2 163.0 + G3 85.0 = 319.6 MW generated.
        info(f"  sum gen P = {fmt(totP,2)} MW   (PDF total generation = 319.6 MW)")
        if not (300 <= totP <= 340):
            raise Warn(f"total generation {fmt(totP,1)} MW far from PDF's 319.6 MW")
        return f"gen {pvar}/{qvar} read; sum P={fmt(totP,1)} MW (PDF 319.6)"
    run("4.5", "extract_attribute_output", "Gen active/reactive power vs PDF", cp_gen_res)

    # --- 4.6  Wildcard vs single resolution (extract_attribute_output) -----
    #   The helper returns a SCALAR for a 1-object match and a DICT for a
    #   multi-object (wildcard) match. Validate both shapes.
    def cp_extract_shapes():
        if not STATE.get("ldf_ok"):
            raise Skip("load flow did not converge")

        def extract(query, var):
            objs = list(app.GetCalcRelevantObjects(query) or [])
            if len(objs) == 1:
                return objs[0].GetAttribute(var)
            return {o.loc_name: o.GetAttribute(var) for o in objs}

        gens = STATE.get("gens") or []
        if not gens:
            raise Skip("no generators")
        pvar, _ = first_attr(gens[0], ["m:P:bus1", "m:P"])
        single = extract(f"{gens[0].loc_name}.ElmSym", pvar)
        multi = extract("*.ElmTerm", "m:u")
        if isinstance(single, dict):
            raise Warn("single-object query returned a dict (expected scalar)")
        if not isinstance(multi, dict):
            raise Warn("wildcard query returned a scalar (expected dict)")
        return (f"single->scalar ({fmt(single,3)}); "
                f"wildcard->dict ({len(multi)} entries)")
    run("4.6", "extract_attribute_output", "scalar-vs-dict return shapes", cp_extract_shapes)
    return True


# ============================================================================
#  PHASE 5 — Contingency trip / rerun / restore
# ============================================================================
def phase5():
    banner("PHASE 5  —  Contingency pattern (trip -> rerun -> restore)")
    app = STATE["app"]

    def cp_contingency():
        if "comldf" not in STATE:
            raise Skip("ComLdf not available")
        lines = STATE.get("lines") or []
        terms = STATE.get("terms") or []
        if not lines or not terms:
            raise Skip("need lines + terminals")
        cmd = STATE["comldf"]
        probe = terms[0]
        # base
        cmd.Execute()
        base_u = probe.GetAttribute("m:u")
        ln = lines[0]
        orig = ln.GetAttribute("outserv")
        try:
            ln.SetAttribute("outserv", 1)          # trip
            err = cmd.Execute()
            conv = (err == 0)
            cont_u = probe.GetAttribute("m:u") if conv else None
            info(f"trip '{ln.loc_name}': converged={conv}; "
                 f"probe '{probe.loc_name}' m:u base={fmt(base_u)} -> "
                 f"{fmt(cont_u) if cont_u is not None else 'n/a'}")
        finally:
            ln.SetAttribute("outserv", orig)       # restore (mirrors finally:)
            cmd.Execute()
            rest_u = probe.GetAttribute("m:u")
        if abs(rest_u - base_u) > 1e-3:
            raise Warn(f"after restore, probe m:u={fmt(rest_u)} != base {fmt(base_u)} "
                       f"(restore may be incomplete)")
        return (f"trip/rerun/restore OK; base m:u={fmt(base_u)} restored to {fmt(rest_u)}")
    run("5.1", "contingency loop", "outserv trip -> ComLdf -> restore", cp_contingency)
    return True


# ============================================================================
#  PHASE 6 — Harmonic load flow (optional)
# ============================================================================
def phase6():
    if not RUN_HARMONIC:
        return True
    banner("PHASE 6  —  Harmonic load flow (ComHldf)  [optional]")
    app = STATE["app"]

    def cp_harm():
        cmd = app.GetFromStudyCase("ComHldf")
        if cmd is None:
            raise RuntimeError("GetFromStudyCase('ComHldf') returned None")
        err = cmd.Execute()
        if err != 0:
            raise Warn(f"ComHldf.Execute() returned {err} — typically means no "
                       f"harmonic sources defined in the demo model. API call itself "
                       f"is supported (GetFromStudyCase + Execute work).")
        return "GetFromStudyCase('ComHldf').Execute() == 0"
    run("6.1", "run_study_harmonic", "ComHldf.Execute()", cp_harm)
    return True


# ============================================================================
#  PHASE 7 — Dynamic RMS + full ElmRes result handling
# ============================================================================
def phase7():
    if not RUN_RMS:
        return True
    banner("PHASE 7  —  Dynamic RMS (ComInc/ComSim) + ElmRes result handling")
    app = STATE["app"]

    RMS_KEYWORDS = ("fault", "cycle", "rms", "avr", "pss", "stab",
                    "dynam", "transient", "swing", "short")

    # --- 7.0  Pick & activate an RMS-capable study case --------------------
    def cp_pick_sc():
        scs = STATE.get("study_cases") or []
        chosen = None
        for sc in scs:
            if any(k in sc.loc_name.lower() for k in RMS_KEYWORDS):
                chosen = sc
                break
        if chosen is None:
            chosen = app.GetActiveStudyCase()
            if chosen is None:
                raise Skip("no study case available for RMS")
            raise Warn(f"no obviously-RMS study case found by name; using active "
                       f"'{chosen.loc_name}'. If ComInc fails below, open an RMS "
                       f"study case (e.g. a 'Fault'/'Cycles' case) and rerun.")
        chosen.Activate()
        STATE["rms_sc"] = chosen
        return f"activated RMS study case '{chosen.loc_name}'"
    run("7.0", "run_study_dynamic_rms", "Select/activate RMS study case", cp_pick_sc)

    # --- 7.1  Command + result objects -------------------------------------
    def cp_cmds():
        res = app.GetFromStudyCase("ElmRes")
        inc = app.GetFromStudyCase("ComInc")
        sim = app.GetFromStudyCase("ComSim")
        if res is None or inc is None or sim is None:
            raise RuntimeError(f"GetFromStudyCase returned None "
                               f"(ElmRes={res}, ComInc={inc}, ComSim={sim})")
        STATE["res"], STATE["inc"], STATE["sim"] = res, inc, sim
        return "GetFromStudyCase('ElmRes'/'ComInc'/'ComSim') all resolved"
    if not run("7.1", "run_study_dynamic_rms", "GetFromStudyCase ElmRes/ComInc/ComSim", cp_cmds):
        return True

    # --- 7.2  Direct attribute assignment on command objects ---------------
    def cp_cmd_attrs():
        inc, sim = STATE["inc"], STATE["sim"]
        inc.iopt_sim = "rms"                       # tool sets via attribute assign
        sim.tstop = RMS_TSTOP                      # tool sets via attribute assign
        # Read-back is informational only: some builds store iopt_sim as an enum
        # index (int) rather than the string "rms". The assignment NOT raising is
        # what validates the generator's pattern.
        got_mode = inc.GetAttribute("iopt_sim")
        got_stop = sim.GetAttribute("tstop")
        if abs((got_stop or -1) - RMS_TSTOP) > 1e-6:
            raise Warn(f"comSim.tstop read back as {got_stop!r}, expected {RMS_TSTOP}")
        return f"comInc.iopt_sim<-'rms' (read {got_mode!r}), comSim.tstop={fmt(got_stop,3)} (assign OK)"
    run("7.2", "run_study_dynamic_rms", "comInc.iopt_sim / comSim.tstop assignment", cp_cmd_attrs)

    # --- 7.3  Inspect existing ElmRes columns (mirrors ensure_elmres_*) ----
    def cp_inspect_cols():
        res = STATE["res"]
        res.Load()
        try:
            ncol = res.GetNumberOfColumns()
            existing = []
            for c in range(min(ncol, 5)):
                obj = res.GetObject(c)
                var = res.GetVariable(c)
                existing.append((getattr(obj, "loc_name", None), var))
        finally:
            res.Release()
        info(f"ElmRes pre-run columns={ncol}; first few={existing}")
        return (f"Load/GetNumberOfColumns/GetObject/GetVariable/Release OK "
                f"(ncol={ncol})")
    run("7.3", "ensure_elmres_variables", "ElmRes column inspection", cp_inspect_cols)

    # --- 7.4  Register monitor variables (mirrors AddVariable loop) --------
    def cp_addvars():
        res = STATE["res"]
        gens = STATE.get("gens") or []
        if not gens:
            raise Skip("no generators to monitor")
        g = gens[0]
        STATE["rms_gen"] = g
        results = {}
        for var in ("s:firel", "s:speed"):
            err = res.AddVariable(g, var)
            results[var] = err
        info(f"AddVariable returns (0=ok): {results}")
        if any(v != 0 for v in results.values()):
            raise Warn(f"AddVariable returned non-zero for {[k for k,v in results.items() if v]}; "
                       f"that variable may not exist on ElmSym in this build")
        STATE["rms_var"] = "s:firel"
        return f"AddVariable(gen,'s:firel'/'s:speed') -> {results}"
    run("7.4", "ensure_elmres_variables", "ElmRes.AddVariable(element, var)", cp_addvars)

    # --- 7.5  Initial conditions: ComInc + ZeroDerivative ------------------
    def cp_cominc():
        app.GetOutputWindow().Clear()              # mirrors output_window.Clear()
        inc = STATE["inc"]
        app.EchoOff()
        try:
            err = inc.Execute()
        finally:
            app.EchoOn()
        zd = inc.ZeroDerivative()                   # tool checks == 1
        STATE["zd"] = zd
        info(f"ComInc.Execute() err={err}; ZeroDerivative()={zd} (type {type(zd).__name__})")
        if err != 0:
            raise RuntimeError(f"ComInc.Execute() returned {err} (init failed)")
        if zd != 1:
            raise Warn(f"ZeroDerivative()={zd} (expected 1=balanced init); "
                       f"sim will still run but the tool would mark _converged=False")
        return f"GetOutputWindow().Clear + EchoOff + ComInc.Execute + ZeroDerivative={zd}"
    if not run("7.5", "run_study_dynamic_rms", "ComInc.Execute() + ZeroDerivative()", cp_cominc):
        return True

    # --- 7.6  Run the simulation -------------------------------------------
    def cp_comsim():
        sim = STATE["sim"]
        err = sim.Execute()
        if err != 0:
            raise RuntimeError(f"ComSim.Execute() returned {err}")
        return f"ComSim.Execute() == 0 (ran to tstop={fmt(RMS_TSTOP,2)} s)"
    if not run("7.6", "run_study_dynamic_rms", "ComSim.Execute()", cp_comsim):
        return True

    # --- 7.7  ElmRes structure dump (object/variable per column) -----------
    #   This is the diagnostic the v1 audit lacked: it prints the full column
    #   map and probes several rows, so we can SEE which column is really the
    #   time axis instead of assuming column 0.
    def cp_dump_structure():
        res = STATE["res"]
        g = STATE["rms_gen"]
        var = STATE["rms_var"]
        res.Load()
        try:
            nrow = res.GetNumberOfRows()
            ncol = res.GetNumberOfColumns()
            STATE["nrow"] = nrow
            sfcol = res.FindColumn(g, var)
            STATE["sfcol"] = sfcol
            info(f"GetNumberOfRows={nrow}, GetNumberOfColumns={ncol}, "
                 f"FindColumn(gen,'{var}')={sfcol}")
            if sfcol < 0:
                raise RuntimeError(f"FindColumn(gen,'{var}')={sfcol} (<0) — the monitored "
                                   f"variable is missing; AddVariable (CP 7.4) must run "
                                   f"BEFORE ComInc.")
            cap = min(ncol, 60)
            info("  --- column map (col | class | object | variable) ---")
            for c in range(cap):
                obj = res.GetObject(c)
                cls = obj.GetClassName() if obj is not None else None
                ln = getattr(obj, "loc_name", None)
                info(f"   {c:>3} | {str(cls):>10} | {str(ln):<22} | {res.GetVariable(c)}")
            if ncol > cap:
                info(f"   ... ({ncol - cap} more columns not shown)")
            # Probe rows for col 0 (legacy time read) + the monitored variable.
            probe = sorted(set([0, 1, 2, nrow // 2, nrow - 1])) if nrow else []
            info("  --- row probes (does GetValue respect the row index?) ---")
            for r in probe:
                info(f"   row {r:>5}: GetValue(r,0)={res.GetValue(r, 0)!r}   "
                     f"GetValue(r,{sfcol})={res.GetValue(r, sfcol)!r}")
            # Some PF builds expose the time axis at column index -1.
            try:
                info(f"   GetValue(0,-1)={res.GetValue(0,-1)!r}  "
                     f"GetValue({nrow-1},-1)={res.GetValue(nrow-1,-1)!r}")
            except Exception as e:                   # noqa: BLE001
                info(f"   GetValue(row,-1) raised {type(e).__name__}: {e}")
        finally:
            res.Release()
        if nrow < 2:
            raise Warn(f"only {nrow} result row(s) — simulation produced no time series")
        return f"dumped {min(ncol,60)}/{ncol} columns + {len(probe)} row probes"
    if not run("7.7", "_read_elmres_inmemory", "ElmRes structure + column-map dump", cp_dump_structure):
        return True

    # --- 7.7b  GetValue return-shape ([1] indexing) ------------------------
    def cp_getvalue_shape():
        res = STATE["res"]
        res.Load()
        try:
            ret = res.GetValue(0, STATE.get("sfcol", 0))
        finally:
            res.Release()
        info(f"GetValue(...) -> {ret!r}  (type {type(ret).__name__})")
        if not isinstance(ret, (tuple, list)):
            raise Warn("GetValue() did NOT return a 2-element (errorCode, value) "
                       "sequence — the generated `GetValue(...)[1]` would break.")
        float(ret[1])
        return f"returns 2-element {type(ret).__name__}; [1]={fmt(ret[1],4)} (the [1] index is valid)"
    run("7.7b", "_read_elmres_inmemory", "GetValue (errorCode,value) shape", cp_getvalue_shape)

    # --- 7.8  Time-axis strategy comparison (THE crux) ---------------------
    #   The generator reads time as GetValue(row, -1)[1]: PowerFactory exposes
    #   the result x-axis (simulation time) at column -1, while columns 0..n-1
    #   are monitored variables. We confirm -1 is a real t_start..t_stop ramp,
    #   and show the legacy column-0 read for contrast (it returns the first
    #   monitored variable — often a near-constant state).
    def cp_time_axis():
        res = STATE["res"]
        res.Load()
        try:
            nrow = res.GetNumberOfRows()
            ncol = res.GetNumberOfColumns()
            # (label, column-index passed straight to GetValue); -1 is the tool's.
            cands = [("GetValue(row,-1) [tool]", -1),
                     ("GetValue(row,0)  [legacy]", 0)]
            tnow_col = next((c for c in range(ncol)
                             if res.GetVariable(c) in ("b:tnow", "s:tnow", "t")), None)
            if tnow_col is not None:
                cands.append((f"col {tnow_col} (var 'b:tnow')", tnow_col))
            # auto-scan for a column that rises from ~0 (a time ramp)
            best = None
            for c in range(ncol):
                try:
                    a = res.GetValue(0, c)[1]
                    b = res.GetValue(nrow - 1, c)[1]
                except Exception:                    # noqa: BLE001
                    continue
                if (b - a) > 1e-6 and abs(a) <= 1e-3 + 0.02 * abs(b):
                    if best is None or (b - a) > best[1]:
                        best = (c, b - a)
            if best is not None and best[0] != tnow_col:
                cands.append((f"col {best[0]} (auto-detected ramp)", best[0]))
            # Assess each candidate.
            sub = max(1, nrow // 50)
            results = []
            for label, idx in cands:
                try:
                    v0 = res.GetValue(0, idx)[1]
                    vl = res.GetValue(nrow - 1, idx)[1]
                    sample = [res.GetValue(i, idx)[1] for i in range(0, nrow, sub)]
                    nondec = all(sample[k] <= sample[k + 1] for k in range(len(sample) - 1))
                    const = abs(vl - v0) < 1e-9
                    results.append(dict(label=label, idx=idx, ok=True,
                                        v0=v0, vl=vl, nondec=nondec, const=const))
                except Exception as e:               # noqa: BLE001
                    results.append(dict(label=label, idx=idx, ok=False,
                                        err=f"{type(e).__name__}: {e}"))
        finally:
            res.Release()
        valid = []
        for r in results:
            if not r["ok"]:
                info(f"  {r['label']:<28} -> ERROR {r['err']}")
                continue
            tag = "CONSTANT(!)" if r["const"] else ("ramp" if r["nondec"] else "non-monotonic")
            info(f"  {r['label']:<28} -> v0={fmt(r['v0'],4)} vend={fmt(r['vl'],4)} [{tag}]")
            if r["nondec"] and not r["const"]:
                valid.append(r)
        tool = next((r for r in results if r["idx"] == -1), None)
        tool_ok = bool(tool and tool["ok"] and tool["nondec"] and not tool["const"])
        STATE["time_colidx"] = -1 if tool_ok else (valid[0]["idx"] if valid else -1)
        if tool_ok:
            return (f"tool's GetValue(row,-1) IS a valid time ramp "
                    f"(v0={fmt(tool['v0'],4)} vend={fmt(tool['vl'],4)}; time at column -1)")
        if valid:
            raise Warn(f"tool's time read GetValue(row,-1) is NOT a clean ramp on this build; "
                       f"a valid time axis IS available via [{valid[0]['label'].strip()}] "
                       f"(column {valid[0]['idx']}). Update _read_elmres_inmemory accordingly: "
                       f"VALUE metrics stay correct, but time-based metrics and graph x-axes "
                       f"depend on this.")
        raise Warn("no valid time ramp found via GetValue(row,-1)/(row,0), a 'b:tnow' "
                   "column, or auto-scan — inspect the CP 7.7 column dump manually.")
    run("7.8", "_read_elmres_inmemory", "Time-axis strategy comparison", cp_time_axis)

    # --- 7.9  Metrics (mirrors calculate_timeseries_metric) ----------------
    #   Value metrics are time-independent (always correct). time@max is shown
    #   under the tool's time axis (col -1) vs the legacy col-0 read, plus the
    #   native ElmRes Find{Max,Min}InColumn the README lists.
    def cp_metrics():
        res = STATE["res"]
        g = STATE["rms_gen"]
        var = STATE["rms_var"]
        idx = STATE.get("time_colidx", -1)
        res.Load()
        try:
            nrow = res.GetNumberOfRows()
            sfcol = res.FindColumn(g, var)
            data = [res.GetValue(r, sfcol)[1] for r in range(nrow)]
            t_tool = [res.GetValue(r, idx)[1] for r in range(nrow)]
            t_legacy = [res.GetValue(r, 0)[1] for r in range(nrow)]
            try:
                mx = res.FindMaxInColumn(sfcol)
                mn = res.FindMinInColumn(sfcol)
                native_note = "native Find{Max,Min}InColumn OK"
            except Exception as e:                   # noqa: BLE001
                mx = mn = None
                native_note = f"Find{{Max,Min}}InColumn raised {type(e).__name__}: {e}"
        finally:
            res.Release()
        vals = [v for v in data if v == v]           # drop NaN
        py_max, py_min, py_final = max(vals), min(vals), vals[-1]
        py_mean = sum(vals) / len(vals)
        py_rms = (sum(v * v for v in vals) / len(vals)) ** 0.5
        info(f"VALUE metrics (time-independent, always correct): max={fmt(py_max)} "
             f"min={fmt(py_min)} final={fmt(py_final)} mean={fmt(py_mean)} rms={fmt(py_rms)}")
        imax = data.index(py_max)
        info(f"time@max: tool col{idx} -> {fmt(t_tool[imax],4)} s   |   "
             f"legacy col0 -> {fmt(t_legacy[imax],4)} s")
        if mx is not None:
            info(f"native FindMaxInColumn={mx!r}  FindMinInColumn={mn!r}")
        # The tool's chosen time axis must be a real ramp.
        if not (t_tool[-1] > t_tool[0]):
            raise Warn(f"tool time axis (col {idx}) is not increasing "
                       f"(t0={fmt(t_tool[0])} tend={fmt(t_tool[-1])}) — time-based metrics suspect.")
        return f"value metrics OK; {native_note}; time column used = {idx}"
    run("7.9", "calculate_timeseries_metric", "value metrics + time@max (tool col-1 vs legacy col0)", cp_metrics)

    # --- 7.10  Result validity flags ---------------------------------------
    def cp_valid():
        notes = []
        for meth in ("IsRmsValid", "IsSimValid", "IsLdfValid"):
            try:
                notes.append(f"{meth}()={getattr(app, meth)()}")
            except Exception as e:                   # noqa: BLE001
                notes.append(f"{meth}: {type(e).__name__}")
        return "; ".join(notes)
    run("7.10", "run_study_dynamic_rms", "IsRmsValid / IsSimValid / IsLdfValid", cp_valid)
    return True


# ============================================================================
#  PHASE 8 — Restore & summary
# ============================================================================
def phase8():
    banner("PHASE 8  —  Restore original context & summary")
    app = STATE.get("app")

    def cp_restore():
        if app is None:
            raise Skip("never connected")
        orig = STATE.get("orig_sc")
        if orig is not None:
            try:
                orig.Activate()
                return f"reactivated original study case '{orig.loc_name}'"
            except Exception as e:                   # noqa: BLE001
                raise Warn(f"could not reactivate original study case: {e}")
        return "no original study case captured (nothing to restore)"
    run("8.1", "cleanup", "Restore original study case", cp_restore)

    # ---- final report -----------------------------------------------------
    banner("AUDIT SUMMARY")
    total = sum(COUNTS.values())
    print(f"  Total checkpoints : {total}", flush=True)
    print(f"  PASS : {COUNTS['PASS']}", flush=True)
    print(f"  WARN : {COUNTS['WARN']}", flush=True)
    print(f"  SKIP : {COUNTS['SKIP']}", flush=True)
    print(f"  FAIL : {COUNTS['FAIL']}", flush=True)

    nonpass = [r for r in RECORDS if r[1] != "PASS"]
    if nonpass:
        print("", flush=True)
        print("  Non-PASS checkpoints (copy this back for debugging):", flush=True)
        for cid, status, maps_to, label, detail in nonpass:
            print(f"   [{cid:>4}] {status:<4} {maps_to} :: {label}", flush=True)
            if detail:
                print(f"           {detail}", flush=True)

    print("", flush=True)
    verdict = "ALL GENERATOR API PATTERNS VERIFIED" if COUNTS["FAIL"] == 0 \
        else f"{COUNTS['FAIL']} CHECKPOINT(S) FAILED — see traceback(s) above"
    print(f"  VERDICT: {verdict}", flush=True)
    print("=" * 78, flush=True)


# ============================================================================
#  Main
# ============================================================================
def main():
    print("#" * 78, flush=True)
    print("#  PowerFactory-Scripter — FULL API AUDIT  (Nine-bus System)", flush=True)
    print(f"#  started : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", flush=True)
    print(f"#  API_PATH     = {API_PATH}", flush=True)
    print(f"#  PROJECT_NAME = {PROJECT_NAME}", flush=True)
    print(f"#  USERNAME     = {USERNAME!r}   RUN_RMS={RUN_RMS} (tstop={RMS_TSTOP}s)", flush=True)
    print("#  legend: PASS=ok  WARN=ran-but-unexpected  SKIP=precondition  FAIL=broken", flush=True)
    print("#" * 78, flush=True)

    try:
        if not phase0():
            phase8()
            return
        if not phase1():
            phase8()
            return
        phase2()
        phase3()
        phase4()
        phase5()
        phase6()
        phase7()
    except Exception:                                # noqa: BLE001
        print("\n!!! UNHANDLED EXCEPTION IN AUDIT DRIVER !!!", flush=True)
        traceback.print_exc()
    finally:
        phase8()


if __name__ == "__main__":
    main()
