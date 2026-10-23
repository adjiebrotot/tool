# Workflow Builder runtime: the PowerFactory core (connect, find, set and undo, finish).
#
# Same section format as base.py (# @helper / # @needs / # @imports / # @end at column 0). Every
# PowerFactory fact used here was checked on the live PowerFactory 2024 engine; the notes say why
# where the obvious call is wrong. The connected application is kept in _PF["app"] so the helpers
# that only touch one object (pf_set, pf_mark, set_seconds ...) need no `app` argument, while the
# ones that search the project take `app` first, as the generated code passes it.
#
# Everything the workflow creates in PowerFactory carries the prefix "PFB_" (events, temporary
# result files, vectors, test generators), except cases, scenarios and variations the reader names
# on purpose; finish() deletes what was not asked to be kept.

# @helper pf_state
# @needs log
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
# @end

# @helper pf_messages
# @needs pf_state
# @imports import re
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
# @end

# @helper pf_connect
# @needs log, run_dir, pf_state, pf_messages
# @imports import difflib
# @imports import glob
# @imports import os
# @imports import subprocess
# @imports import sys
# @imports import time
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
# @end

# @helper preflight
# @needs log, pf_connect
# @imports import importlib.util
# @imports import sys
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
# @end

# @helper pf_find
# @needs log, pf_state
# @imports import difflib
# @imports import fnmatch
# @imports import re
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
# @end

# @helper check_elements
# @needs log, pf_find
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
# @end

# @helper units
# @needs log, pf_state
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
# @end

# @helper pf_set
# @needs log, pf_state, units
def _native(value, like):
    """A plain Python value of the attribute's own type: PowerFactory refuses numpy numbers
    ('numpy.int64 is not a double') and floats for integer attributes."""
    if hasattr(value, "item") and not isinstance(value, (list, tuple, str)):
        try:
            value = value.item()
        except Exception:
            pass
    if isinstance(like, bool):
        like = int(like)
    if isinstance(like, int):
        if isinstance(value, bool):
            return int(value)
        if isinstance(value, str):
            value = float(value.strip().replace(",", "."))
        if isinstance(value, float):
            if abs(value - round(value)) > 1e-9:
                log(f"Rounded {value:g} to {round(value)} for a whole-number attribute.", "warn")
            return int(round(value))
        return value
    if isinstance(like, float):
        if isinstance(value, str):
            return float(value.strip().replace(",", "."))
        if isinstance(value, (int, bool)):
            return float(value)
        return value
    if isinstance(like, str) and isinstance(value, (int, float)) and not isinstance(value, bool):
        return f"{value:g}" if isinstance(value, float) else str(value)
    return value


def _remember(obj, attr, old):
    """Keep the value before the first write per element, attribute, case and scenario since the
    innermost open mark, so pf_undo(mark) gets back exactly the state at the mark."""
    case, scen = _context()
    key = (_full(obj), attr, _full(case), _full(scen))
    floor = _PF["marks"][-1][1] if _PF["marks"] else 0
    idx = _PF["keys"].get(key)
    if idx is None or idx < floor:
        _PF["keys"][key] = len(_PF["records"])
        _PF["records"].append({"obj": obj, "attr": attr, "old": old, "case": case, "scen": scen, "key": key})


def _recorded(obj, attr):
    """The value before the workflow first changed this attribute in the active case and scenario,
    or a marker when it has not been changed yet."""
    case, scen = _context()
    key = (_full(obj), attr, _full(case), _full(scen))
    for rec in _PF["records"]:
        if rec["key"] == key:
            return rec["old"]
    return _recorded


def pf_set(obj, attr, value, unit=None, record=True):
    """Write an attribute of one element (or of each element in a list).

    The first original value per element, attribute, study case and operation scenario is
    remembered, so pf_undo() can put it back in the case and scenario it was written in. The value
    is turned into the attribute's own type; with unit ("MW", "kvar", "s", "ms" ...) it is converted
    to the unit this project shows for that attribute. Returns the value as given."""
    if isinstance(obj, (list, tuple)):
        for o in obj:
            pf_set(o, attr, value, unit, record)
        return value
    _app()
    if obj is None:
        raise PFError(f"[CODE] No element was given to set '{attr}' on.")
    try:
        old = obj.GetAttribute(attr)
    except Exception as e:
        raise PFError(f"[MODEL] {_nm(obj)} ({obj.GetClassName()}) has no attribute '{attr}' ({e}). "
                      "Check the attribute name.")
    v = value
    if isinstance(old, (int, float)) and not isinstance(old, bool):
        # A number attribute: take numpy numbers and texts as a float, convert the unit, then
        # cast to the attribute's own type below.
        v = _convert(obj, attr, _native(v, 0.0), unit, True)
    v = _native(v, old)
    if record:
        _remember(obj, attr, old)
    try:
        obj.SetAttribute(attr, v)
    except Exception as e:
        raise PFError(f"[MODEL] Could not set {_nm(obj)}.{attr} to {v!r}: {e}")
    return value
# @end

# @helper pf_get
# @needs log, pf_state, units
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
# @end

# @helper pf_mark
# @needs pf_state
def pf_mark():
    """A point to go back to: pf_undo(mark) puts back every value written after it and makes the
    study case and scenario active again that were active here. Loops take one per pass."""
    app = _PF["app"]
    case, scen = _context(app) if app is not None else (None, None)
    n = len(_PF["records"])
    _PF["seq"] = mid = _PF.get("seq", 0) + 1
    _PF["marks"].append((mid, n))
    return {"id": mid, "n": n, "case": case, "scen": scen, "created": len(_PF["created"])}
# @end

# @helper pf_undo
# @needs log, pf_state
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
    recs = _PF["records"][n0:]
    # Each (element, attribute, case, scenario) has one record (its first original), so the order
    # between contexts does not matter. Contexts without a scenario go first: leaving a scenario
    # for none drops its unsaved changes, which must not undo what was just put back in it.
    groups = []
    for rec in reversed(recs):
        for gr in groups:
            if _same(gr[0], rec["case"]) and _same(gr[1], rec["scen"]):
                gr[2].append(rec)
                break
        else:
            groups.append((rec["case"], rec["scen"], [rec]))
    groups.sort(key=lambda gr: gr[1] is not None)
    put, bad = 0, 0
    for case, scen, items in groups:
        _enter_context(app, case, scen)
        for rec in items:
            if not _alive(rec["obj"]):
                continue
            try:
                rec["obj"].SetAttribute(rec["attr"], rec["old"])
                put += 1
            except Exception as e:
                bad += 1
                log(f"Could not put back {_nm(rec['obj'])}.{rec['attr']} = {rec['old']!r}: {e}", "warn")
    del _PF["records"][n0:]
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
# @end

# @helper seconds
# @needs pf_state
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
# @end

# @helper track_created
# @needs log, pf_state
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
# @end

# @helper f_nominal
# @needs log, pf_state
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
# @end

# @helper finish
# @needs log, ctx, pf_state, pf_undo, track_created
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
# @end
