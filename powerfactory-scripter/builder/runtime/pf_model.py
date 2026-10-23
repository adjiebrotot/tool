# Workflow Builder runtime: the PowerFactory model (study cases, operation scenarios, variations,
# elements, dispatch, service, contingencies, test generators).
#
# Same section format as base.py. These helpers serve the model blocks (DESIGN section 9). Writes
# go through pf_set, so pf_undo() can put them back in the study case and scenario they were made
# in; loop helpers (each_case, each_scenario, each_variation, each_contingency) restore what they
# switched however the loop ends.

# @helper pf_names
# @needs pf_state
# @imports import re
_BAD_NAME = re.compile(r'[,\\*?:=|"/<>;\t\r\n]+')
_MARK = "PFB: made by the PowerFactory Workflow Builder"


class _Bag:
    """A small record with named fields (the outputs of a block that gives several values)."""

    def __init__(self, **kw):
        self.__dict__.update(kw)

    def __repr__(self):
        return "(" + ", ".join(f"{k}={_nm(v) if hasattr(v, 'loc_name') else v!r}" for k, v in self.__dict__.items()) + ")"


def pf_clean_name(text, maxlen=40):
    """A name PowerFactory accepts for a study case, scenario or variation: the characters it
    refuses (, \\ * ? : = | " and / < > ;) become _, spaces are tidied and the name is cut to 40
    characters (PowerFactory would cut it silently)."""
    s = _BAD_NAME.sub("_", str(text))
    s = re.sub(r"\s+", " ", s).strip()
    return s[:maxlen].rstrip() or "Workflow case"


def _mark_builder(obj):
    """Note in the object's description that the Builder made it, so "replace" may delete it later
    and never deletes a case or scenario someone made by hand."""
    try:
        desc = list(obj.GetAttribute("desc") or [])
        if _MARK not in desc:
            obj.SetAttribute("desc", desc + [_MARK])
    except Exception:
        pass


def _made_by_builder(obj):
    try:
        return _MARK in list(obj.GetAttribute("desc") or [])
    except Exception:
        return False


def _folder(app, key):
    f = app.GetProjectFolder(key)
    if f is None:
        raise PFError(f"[MODEL] This project has no '{key}' folder.")
    return f


def _named(folder, name, cls, deep=False):
    return [o for o in folder.GetContents(f"*.{cls}", 1 if deep else 0) if o.loc_name == name]


def _one(x, what="element"):
    if isinstance(x, (list, tuple)):
        if len(x) != 1:
            raise PFError(f"[CODE] This step needs one {what}, not {len(x)}.")
        x = x[0]
    if x is None:
        raise PFError(f"[CODE] No {what} was given.")
    return x
# @end

# @helper case_list
# @needs pf_names, pf_find
# @imports import fnmatch
def case_list(app, pattern="*"):
    """The study cases whose name matches pattern (* matches anything; letter case is ignored when
    nothing matches exactly), from all sub folders, sorted by name. Only study cases (IntCase)."""
    cases = list(_folder(app, "study").GetContents("*.IntCase", 1))
    pat = str(pattern or "*")
    hits = [c for c in cases if fnmatch.fnmatchcase(c.loc_name, pat)]
    if not hits:
        hits = [c for c in cases if fnmatch.fnmatchcase(c.loc_name.lower(), pat.lower())]
    return _sorted(hits)
# @end

# @helper case_activate
# @needs log, pf_names, pf_find
def _case_named(app, name):
    hits = pf_find(app, f"{name}.IntCase", "all")
    if len(hits) > 1:
        log(f"{len(hits)} study cases are called '{name}'; using {_full(hits[0])}.", "warn")
    return hits[0]


def case_activate(app, case):
    """Make a study case active (the case or its name). Its operation scenario and variations come
    with it. Returns the case."""
    case = _case_named(app, case) if isinstance(case, str) else _one(case, "study case")
    run_deferred()
    if not _same(app.GetActiveStudyCase(), case):
        rc = case.Activate()
        if rc != 0 and not _same(app.GetActiveStudyCase(), case):
            raise PFError(f"[MODEL] Could not activate the study case '{_nm(case)}' (code {rc}).")
        log(f"Study case: {_nm(case)}")
    return case
# @end

# @helper case_create
# @needs log, pf_names, case_activate, track_created
def _drop_builder_case(app, case, keep_active):
    """Delete a study case the Builder made earlier (and its scenario of the same name)."""
    if _same(app.GetActiveStudyCase(), case):
        keep_active.Activate()
    app.ResetCalculation()
    for s in _named(_folder(app, "scen"), case.loc_name, "IntScenario", True):
        if _made_by_builder(s):
            if _same(app.GetActiveScenario(), s):
                s.Deactivate()
            s.Delete()
    case.Delete()
    _PF["created"] = [c for c in _PF["created"] if _alive(c["obj"])]


def case_create(app, name, template=None, scenario="copy", if_exists="reuse", activate=True, keep=True):
    """Make a study case as a copy of template (a case or its name; None = the active case). The
    copy keeps the template's grids, variations, commands and events.

    scenario "copy" also copies the template's operation scenario under the same name (a new one
    when it has none), "new" starts a fresh scenario from the network data, "none" makes no
    scenario. With a scenario, dispatch and service changes stay in this case and do not touch the
    network data every case shares. if_exists "reuse" uses a case of that name, "replace" deletes it
    first (only one the Builder made), "new" lets PowerFactory add a number. The name follows
    PowerFactory's rules (at most 40 characters) and is read back. keep=False deletes the case at
    the end. Returns case, scenario and name."""
    run_deferred()
    start_case, start_scen = _context(app)
    tpl = template
    if tpl is None or tpl == "":
        tpl = start_case
        if tpl is None:
            raise PFError("[MODEL] No study case is active to copy; give a template case.")
    elif isinstance(tpl, str):
        tpl = _case_named(app, tpl)
    want = pf_clean_name(name)
    if want != str(name).strip():
        log(f"Study case name '{name}' became '{want}' (PowerFactory's name rules).")
    folder = tpl.GetParent()
    old = _named(folder, want, "IntCase")
    if old and if_exists == "reuse":
        case = old[0]
        scen = None
        if activate:
            case_activate(app, case)
            same = _named(_folder(app, "scen"), want, "IntScenario", True)
            if same and not _same(app.GetActiveScenario(), same[0]):
                same[0].Activate()
            scen = app.GetActiveScenario()
        log(f"Study case '{want}' already exists; using it.")
        return _Bag(case=case, scenario=scen, name=case.loc_name, created=False)
    if old and if_exists == "replace":
        if _made_by_builder(old[0]):
            _drop_builder_case(app, old[0], tpl if not _same(tpl, old[0]) else start_case)
            log(f"Replaced the study case '{want}' made by an earlier run.")
        else:
            log(f"A study case called '{want}' exists and was not made by the Builder, so it is kept; "
                "the new case gets a numbered name.", "warn")
    # The template's scenario is only known while the template is active.
    if not _same(app.GetActiveStudyCase(), tpl):
        tpl.Activate()
    tpl_scen = app.GetActiveScenario()
    case = folder.AddCopy(tpl, want)
    if case is None:
        found = _named(folder, want, "IntCase")
        case = found[-1] if found else None
    if case is None:
        raise PFError(f"[MODEL] PowerFactory did not make the study case '{want}'.")
    _mark_builder(case)
    track_created(case, "case", keep)
    scen = None
    if scenario in ("copy", "new"):
        if scenario == "copy" and tpl_scen is not None:
            scen = tpl_scen.GetParent().AddCopy(tpl_scen, case.loc_name)
        else:
            scen = _folder(app, "scen").CreateObject("IntScenario", case.loc_name)
        if scen is None:
            raise PFError(f"[MODEL] PowerFactory did not make the operation scenario '{case.loc_name}'.")
        _mark_builder(scen)
        track_created(scen, "scenario", keep)
    elif scenario != "none":
        log(f"Scenario option '{scenario}' is not copy, new or none; no scenario was made.", "warn")
    if case.Activate() != 0:
        raise PFError(f"[MODEL] Could not activate the new study case '{case.loc_name}'.")
    if scen is not None:
        scen.Activate()
        if scenario == "new" or tpl_scen is None:
            scen.Save()   # a fresh scenario holds the operating state from now on
    active_scen = app.GetActiveScenario()
    if not activate:
        _enter_context(app, start_case, start_scen)
    how = {"copy": f"copy of '{_nm(tpl_scen)}'" if tpl_scen is not None else "new", "new": "new"}.get(scenario)
    log(f"Created study case '{case.loc_name}' (copy of '{_nm(tpl)}')"
        + (f" with operation scenario '{scen.loc_name}' ({how})" if scen is not None else "") + ".")
    return _Bag(case=case, scenario=active_scen if scen is None else scen, name=case.loc_name, created=True)
# @end

# @helper each_case
# @needs pf_state, case_activate
def each_case(app, cases):
    """Loop helper: activates each study case in turn (cases or their names) and, however the loop
    ends, makes the study case and scenario active again that were active before the loop."""
    before = _context(app)
    try:
        for c in (cases if isinstance(cases, (list, tuple)) else [cases]):
            yield case_activate(app, c)
    finally:
        _enter_context(app, *before)
# @end

# @helper scenario_list
# @needs pf_names, pf_find
# @imports import fnmatch
def scenario_list(app, pattern="*"):
    """The operation scenarios whose name matches pattern (* matches anything), from all sub
    folders, sorted by name."""
    scens = list(_folder(app, "scen").GetContents("*.IntScenario", 1))
    pat = str(pattern or "*")
    hits = [s for s in scens if fnmatch.fnmatchcase(s.loc_name, pat)]
    if not hits:
        hits = [s for s in scens if fnmatch.fnmatchcase(s.loc_name.lower(), pat.lower())]
    return _sorted(hits)
# @end

# @helper scenario_activate
# @needs log, pf_names, pf_find
def scenario_activate(app, scen):
    """Make an operation scenario active (the scenario or its name). Dispatch and service changes
    made while it is active go into it; pf_set remembers where, so they can be put back."""
    if isinstance(scen, str):
        scen = pf_find(app, f"{scen}.IntScenario", "first")
    scen = _one(scen, "operation scenario")
    run_deferred()
    if not _same(app.GetActiveScenario(), scen):
        rc = scen.Activate()
        if not _same(app.GetActiveScenario(), scen):
            raise PFError(f"[MODEL] Could not activate the operation scenario '{_nm(scen)}' (code {rc}). "
                          "A scenario needs an active study case.")
        log(f"Operation scenario: {_nm(scen)}")
    return scen
# @end

# @helper scenario_deactivate
# @needs log, pf_state
def scenario_deactivate(app, save=False):
    """Switch the active operation scenario off. save=True first stores its unsaved changes in it;
    without it they are dropped (PowerFactory's own default). Returns the scenario, or None."""
    scen = app.GetActiveScenario()
    if scen is None:
        return None
    run_deferred()
    if save:
        scen.Deactivate(1)
    else:
        scen.Deactivate()
    log(f"Operation scenario '{_nm(scen)}' switched off" + (" (changes saved)." if save else "."))
    return scen
# @end

# @helper scenario_create
# @needs log, pf_names, scenario_activate, track_created
def scenario_create(app, name, activate=True, keep=True, if_exists="reuse"):
    """Make an operation scenario from the operating state in use now (dispatch, switching, service
    of the active study case) and activate it. if_exists "reuse" uses a scenario of that name,
    "replace" deletes it first (only one the Builder made), "new" adds a number. keep=False
    deletes it at the end. Returns the scenario."""
    want = pf_clean_name(name)
    folder = _folder(app, "scen")
    old = _named(folder, want, "IntScenario", True)
    if old and if_exists == "reuse":
        if activate:
            scenario_activate(app, old[0])
        log(f"Operation scenario '{want}' already exists; using it.")
        return old[0]
    if old and if_exists == "replace" and _made_by_builder(old[0]):
        if _same(app.GetActiveScenario(), old[0]):
            old[0].Deactivate()
        app.ResetCalculation()
        old[0].Delete()
    run_deferred()
    before = app.GetActiveScenario()
    scen = app.SaveAsScenario(want, 1)
    if scen is None:
        raise PFError(f"[MODEL] PowerFactory did not make the operation scenario '{want}' (is a study case active?).")
    _mark_builder(scen)
    track_created(scen, "scenario", keep)
    if not activate:
        if before is not None and _alive(before):
            before.Activate()
        else:
            scen.Deactivate()
    log(f"Created operation scenario '{scen.loc_name}' from the operating state in use now.")
    return scen
# @end

# @helper scenario_save
# @needs log, pf_state
def scenario_save(app):
    """Save the active operation scenario, so its changes stay in it (also after the workflow puts
    changed values back). Returns True when PowerFactory saved something."""
    scen = app.GetActiveScenario()
    if scen is None:
        log("No operation scenario is active, so there is nothing to save.", "warn")
        return False
    rc = scen.Save()
    log(f"Saved operation scenario '{_nm(scen)}'." if rc == 0 else f"Operation scenario '{_nm(scen)}' had no changes to save.")
    return rc == 0
# @end

# @helper each_scenario
# @needs pf_state, scenario_activate
def each_scenario(app, scenarios):
    """Loop helper: activates each operation scenario in turn (scenarios or their names) and,
    however the loop ends, makes the scenario active again that was active before the loop."""
    before = _context(app)
    try:
        for s in (scenarios if isinstance(scenarios, (list, tuple)) else [scenarios]):
            yield scenario_activate(app, s)
    finally:
        _enter_context(app, *before)
# @end

# @helper variation_state
# @needs pf_state
# Which variations each study case had active before the workflow switched any. Variation
# activation is stored in the study case (its Variation Configuration), so finish() restores it
# case by case and removes the Variation Configuration PowerFactory made if the case had none.
_VAR = {}


def _variation_touch(app):
    case = app.GetActiveStudyCase()
    if case is None:
        raise PFError("[MODEL] Variations need an active study case.")
    key = _full(case)
    if key not in _VAR:
        _VAR[key] = {"case": case, "active": list(app.GetActiveNetworkVariations()),
                     "acs": bool(case.GetContents("*.IntAcscheme"))}
    if not any(fn is _variation_restore_all for _, fn in _PF["hooks"]):
        _PF["hooks"].append(("restore the variations of the study cases", _variation_restore_all))


def _variation_set(app, wanted):
    """Make exactly these variations active in the active study case."""
    want = {_full(v) for v in wanted if _alive(v)}
    for v in list(app.GetActiveNetworkVariations()):
        if _full(v) not in want:
            v.Deactivate()
    for v in wanted:
        if _alive(v) and not any(_same(v, a) for a in app.GetActiveNetworkVariations()):
            v.Activate()


def _variation_restore_all():
    app = _app()
    for st in list(_VAR.values()):
        case = st["case"]
        if not _alive(case):
            continue
        if not _same(app.GetActiveStudyCase(), case):
            case.Activate()
        _variation_set(app, st["active"])
        if not st["acs"]:
            for acs in case.GetContents("*.IntAcscheme"):
                if not acs.GetContents():
                    acs.Delete()
    _VAR.clear()
# @end

# @helper variation_list
# @needs pf_names, pf_find
# @imports import fnmatch
def variation_list(app, pattern="*"):
    """The network variations whose name matches pattern (* matches anything), sorted by name."""
    vs = list(_folder(app, "scheme").GetContents("*.IntScheme", 1))
    pat = str(pattern or "*")
    hits = [v for v in vs if fnmatch.fnmatchcase(v.loc_name, pat)]
    if not hits:
        hits = [v for v in vs if fnmatch.fnmatchcase(v.loc_name.lower(), pat.lower())]
    return _sorted(hits)
# @end

# @helper variation_activate
# @needs log, pf_names, pf_find, variation_state
def variation_activate(app, variation, alone=False):
    """Activate a network variation in the active study case (the variation or its name).
    alone=True first deactivates the case's other variations. Each case gets its own variations
    back at the end of the workflow."""
    _variation_touch(app)
    var = pf_find(app, f"{variation}.IntScheme", "first") if isinstance(variation, str) else _one(variation, "variation")
    run_deferred()
    if alone:
        for v in list(app.GetActiveNetworkVariations()):
            if not _same(v, var):
                v.Deactivate()
    if not any(_same(var, v) for v in app.GetActiveNetworkVariations()):
        rc = var.Activate()
        if not any(_same(var, v) for v in app.GetActiveNetworkVariations()):
            raise PFError(f"[MODEL] Could not activate the variation '{_nm(var)}' (code {rc}).")
    log(f"Variation active: {_nm(var)}" + (" (alone)" if alone else ""))
    return var
# @end

# @helper variation_deactivate
# @needs log, pf_names, pf_find, variation_state
def variation_deactivate(app, variation=None):
    """Deactivate one network variation (or every active one when variation is None) in the active
    study case. Returns how many were deactivated."""
    _variation_touch(app)
    run_deferred()
    if variation is None:
        todo = list(app.GetActiveNetworkVariations())
    else:
        var = pf_find(app, f"{variation}.IntScheme", "first") if isinstance(variation, str) else _one(variation, "variation")
        todo = [v for v in app.GetActiveNetworkVariations() if _same(v, var)]
    for v in todo:
        v.Deactivate()
    if todo:
        log(f"Variation switched off: {', '.join(_nm(v) for v in todo)}")
    return len(todo)
# @end

# @helper variation_create
# @needs log, pf_names, variation_activate, track_created
def variation_create(app, name, stage=None, activate=True, keep=True, if_exists="reuse"):
    """Make a network variation with one expansion stage at the study time of the active case.
    Activated, its stage records every change of network data from then on (new elements, type
    changes), which keeps those changes out of the base network. if_exists "reuse" uses a variation
    of that name, "replace" deletes it first (only one the Builder made), "new" adds a number.
    keep=False deletes it at the end. Returns the variation."""
    _variation_touch(app)
    want = pf_clean_name(name)
    folder = _folder(app, "scheme")
    old = _named(folder, want, "IntScheme", True)
    if old and if_exists == "reuse":
        if activate:
            variation_activate(app, old[0])
        log(f"Variation '{want}' already exists; using it.")
        return old[0]
    if old and if_exists == "replace" and _made_by_builder(old[0]):
        if any(_same(v, old[0]) for v in app.GetActiveNetworkVariations()):
            old[0].Deactivate()
        app.ResetCalculation()
        old[0].Delete()
    run_deferred()
    var = folder.CreateObject("IntScheme", want)
    if var is None:
        raise PFError(f"[MODEL] PowerFactory did not make the variation '{want}'.")
    _mark_builder(var)
    track_created(var, "variation", keep)
    when = int(app.GetActiveStudyCase().GetAttribute("iStudyTime"))
    rc = var.NewStage(pf_clean_name(stage or want), when, 1 if activate else 0)
    if rc != 0:
        log(f"PowerFactory returned code {rc} when adding the expansion stage to '{want}'.", "warn")
    log(f"Created variation '{var.loc_name}' with a stage at the study time" + (" (active, recording)." if activate else "."))
    return var
# @end

# @helper each_variation
# @needs pf_state, variation_state, variation_activate
def each_variation(app, variations, alone=True):
    """Loop helper: activates each network variation in turn (alone: only that one) and, however
    the loop ends, restores the variations that were active before the loop in the active case."""
    _variation_touch(app)
    before = list(app.GetActiveNetworkVariations())
    try:
        for v in (variations if isinstance(variations, (list, tuple)) else [variations]):
            var = variation_activate(app, v, alone)
            try:
                yield var
            finally:
                if not any(_same(var, b) for b in before):
                    var.Deactivate()
    finally:
        _variation_set(app, before)
# @end

# @helper find_elements
# @needs log, pf_find
# @imports import fnmatch
def _compare(v, op, value):
    if v is None:
        return False
    if isinstance(value, str) and isinstance(v, str):
        if any(ch in value for ch in "*?"):
            hit = fnmatch.fnmatchcase(v.lower(), value.lower())
            return hit if op in ("=", "==") else (not hit if op in ("!=", "<>") else False)
        return {"=": v == value, "==": v == value, "!=": v != value, "<>": v != value}.get(op, False)
    try:
        a, b = float(v), float(value)
    except (TypeError, ValueError):
        return False
    return {"=": a == b, "==": a == b, "!=": a != b, "<>": a != b, ">": a > b, ">=": a >= b,
            "<": a < b, "<=": a <= b}.get(op, False)


def find_elements(app, cls, name="*", attr=None, op="=", value=None, in_service=False):
    """Elements of one class whose name matches name (* matches anything), optionally only those
    whose attr compares to value (op =, !=, >, >=, <, <=; a text with * compares as a pattern) and
    only those in service. Sorted by name; an empty list when none match."""
    objs = pf_find(app, f"{name or '*'}.{cls}", "all", empty_ok=True)
    out = []
    for o in objs:
        if in_service:
            try:
                if o.GetAttribute("outserv") != 0:
                    continue
            except Exception:
                pass
        if attr:
            try:
                v = o.GetAttribute(attr)
            except Exception:
                continue
            if not _compare(v, op, value):
                continue
        out.append(o)
    log(f"Found {len(out)} {_plain(cls, len(out))} matching '{name}'" + (f" with {attr} {op} {value}" if attr else "") + ".", "debug")
    return out
# @end

# @helper outer_composite
# @needs pf_state
def outer_composite(obj):
    """The outermost composite model (ElmComp, the plant model holding the unit's controllers) of
    a unit, or None. Its service state is project-wide, not part of an operation scenario, and a
    stopped unit needs its controllers stopped too."""
    try:
        start = obj.GetAttribute("c_pmod")
    except Exception:
        start = None
    p = start if start is not None else obj.GetParent()
    best = None
    while p is not None and p.GetClassName() == "ElmComp":
        best = p
        p = p.GetParent()
    return best
# @end

# @helper set_service
# @needs log, pf_set, outer_composite
def set_service(objs, in_service, outer_comp=False):
    """Take elements out of service (in_service False) or put them back in (True), remembering the
    originals for pf_undo. outer_comp also switches each unit's outermost composite model (its
    controllers) the same way."""
    items = objs if isinstance(objs, (list, tuple)) else [objs]
    for o in items:
        pf_set(o, "outserv", 0 if in_service else 1)
        if outer_comp:
            comp = outer_composite(o)
            if comp is not None:
                pf_set(comp, "outserv", 0 if in_service else 1)
    log(("In service: " if in_service else "Out of service: ") + ", ".join(_nm(o) for o in items[:10])
        + (" ..." if len(items) > 10 else ""))
    return len(items)
# @end

# @helper set_dispatch
# @needs log, pf_set, convert, outer_composite
_DISPATCH = {"ElmSym": ("pgini", "qgini"), "ElmGenstat": ("pgini", "qgini"), "ElmPvsys": ("pgini", "qgini"),
             "ElmAsm": ("pgini", "qgini"), "ElmVsc": ("psetp", "qsetp")}


def set_dispatch(obj, p=None, q=None, basis="total", qmode="keep", unit="MW", q_unit="Mvar", outer_comp=False):
    """Set a generator's active power p (and reactive power q) and put it in service.

    basis "total" means p and q are for the whole unit and are divided by its number of parallel
    machines (ngnum), because PowerFactory's dispatch is per machine; "machine" writes them as
    given. qmode "pq" switches a voltage-controlled unit to constant Q (av_mode constq), without
    which q has no effect. outer_comp also puts its outermost composite model in service. Works on
    synchronous and static generators, PV systems, asynchronous machines (pgini, qgini) and VSC
    converters (psetp, qsetp); units follow the project (a PV system may show kW)."""
    for o in (obj if isinstance(obj, (list, tuple)) else [obj]):
        cls = o.GetClassName()
        if cls not in _DISPATCH:
            raise PFError(f"[MODEL] Set generator dispatch works on synchronous and static generators, PV "
                          f"systems, asynchronous machines and VSC converters, not on {_nm(o)} ({cls}).")
        pa, qa = _DISPATCH[cls]
        n = 1
        if basis == "total":
            try:
                n = max(1, int(o.GetAttribute("ngnum")))
            except Exception:
                n = 1
        said = []
        if p is not None:
            pv = as_float(p)
            pf_set(o, pa, pv / n, unit)
            said.append(f"P {pv:g} {unit}" + (f" total ({n} x {pv / n:g})" if n > 1 else ""))
        if q is not None:
            qv = as_float(q)
            pf_set(o, qa, qv / n, q_unit)
            said.append(f"Q {qv:g} {q_unit}" + (f" total ({n} x {qv / n:g})" if n > 1 else ""))
        if qmode == "pq":
            try:
                mode = o.GetAttribute("av_mode")
            except Exception:
                mode = None
            if mode is not None and mode != "constq":
                pf_set(o, "av_mode", "constq")
                said.append("constant Q")
        if o.GetAttribute("outserv") != 0:
            pf_set(o, "outserv", 0)
            said.append("put in service")
        if outer_comp:
            comp = outer_composite(o)
            if comp is not None and comp.GetAttribute("outserv") != 0:
                pf_set(comp, "outserv", 0)
                said.append(f"composite '{_nm(comp)}' in service")
        log(f"Dispatch {_nm(o)}: {', '.join(said) or 'no change'}.")
    return p
# @end

# @helper dispatch_row
# @needs log, pf_names, pf_find, set_dispatch, set_service, convert
def _blank(v):
    if v is None:
        return True
    if isinstance(v, float) and v != v:
        return True
    return isinstance(v, str) and not v.strip()


def dispatch_row(app, row, mapping=None, basis="total", unit="MW", outer_comp=True):
    """Dispatch several generators from one table row (a dict of column -> value), as in a case
    workbook. mapping says which element each column drives: {column: element or "Name.Class"};
    None means every column header is a generator name. A blank cell takes the unit and its
    outermost composite model out of service; 0 keeps it in service at 0 MW. Returns the numbers of
    units dispatched and taken out of service."""
    if isinstance(mapping, dict):
        pairs = list(mapping.items())
    elif mapping:
        pairs = [tuple(p) for p in mapping]
    else:
        pairs = [(k, None) for k in row.keys()]
    on = off = 0
    skipped = []
    for col, target in pairs:
        if col not in row:
            _say_once(("nocol", col), f"The table has no column '{col}'; that unit is left as it is.", "warn")
            continue
        obj = target
        if obj is None:
            for cls in _DISPATCH:
                obj = pf_find(app, f"{col}.{cls}", "first", empty_ok=True)
                if obj is not None:
                    break
            if obj is None:
                skipped.append(str(col))
                continue
        elif isinstance(obj, str):
            obj = pf_find(app, obj, "one")
        val = row[col]
        if _blank(val):
            set_service(obj, False, outer_comp)
            off += 1
        else:
            set_dispatch(obj, as_float(val), basis=basis, unit=unit, outer_comp=outer_comp)
            on += 1
    if skipped:
        _say_once(("rowcols", tuple(skipped)), f"Columns that are not generator names were left out: {', '.join(skipped[:10])}.")
    return _Bag(dispatched=on, out_of_service=off)
# @end

# @helper scale_attr
# @needs log, pf_set
def scale_attr(objs, attr, factor):
    """Set attr to factor times its ORIGINAL value: the value before the workflow first changed it
    in this study case and scenario. Scaling by 1.1 twice gives 1.1 x original, not 1.21 x."""
    f = float(factor)
    for o in (objs if isinstance(objs, (list, tuple)) else [objs]):
        orig = _recorded(o, attr)
        if orig is _recorded:
            orig = o.GetAttribute(attr)
        try:
            base = float(orig)
        except (TypeError, ValueError):
            raise PFError(f"[MODEL] {_nm(o)}.{attr} is not a number ({orig!r}), so it cannot be scaled.")
        pf_set(o, attr, base * f)
    return f
# @end

# @helper contingencies
# @needs log, pf_find, convert
# @imports import itertools
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
# @end

# @helper add_test_generator
# @needs log, pf_find, pf_set, track_created, pf_names, convert
# @imports import re
def add_test_generator(app, bus, p=0.0, q=0.0, key="testgen", rating=None, unit="MW", q_unit="Mvar"):
    """Connect a static generator (ElmGenstat) named PFB_<key> to a busbar at active power p and
    reactive power q (constant Q), for hosting-capacity studies. Called again with the same key it
    updates the same generator, moving it when the busbar changed. rating (MVA) defaults to the
    larger of 100 MVA and 1.5 x |p|. finish() deletes it. Returns the generator, ready for Set
    generator dispatch."""
    if isinstance(bus, str):
        bus = pf_find(app, bus if "." in bus else bus + ".ElmTerm", "one")
    bus = _one(bus, "busbar")
    if bus.GetClassName() != "ElmTerm":
        raise PFError(f"[MODEL] A test generator connects to a busbar or terminal (ElmTerm), not to {_nm(bus)}.")
    name = PFB + (re.sub(r"[^A-Za-z0-9_]", "_", str(key)) or "testgen")
    grid = None
    try:
        grid = bus.GetAttribute("cpGrid")
    except Exception:
        grid = None
    p_ = bus.GetParent()
    while grid is None and p_ is not None:
        grid = p_ if p_.GetClassName() == "ElmNet" else None
        p_ = p_.GetParent()
    if grid is None:
        raise PFError(f"[MODEL] Could not find the grid of busbar {_nm(bus)}.")
    gen = None
    for g in grid.GetContents(name + ".ElmGenstat", 1):
        gen = g
    if gen is not None:
        cub = gen.GetAttribute("bus1")
        if cub is None or not _same(cub.GetParent(), bus):
            app.ResetCalculation()
            gen.Delete()
            if cub is not None and cub.GetParent() is not None and cub.loc_name.startswith(PFB):
                cub.Delete()
            _PF["created"] = [c for c in _PF["created"] if _alive(c["obj"])]
            gen = None
        else:
            track_created(cub, "cubicle")
            track_created(gen, "element")
    if gen is None:
        cub = bus.CreateObject("StaCubic", name)
        track_created(cub, "cubicle")
        gen = grid.CreateObject("ElmGenstat", name)
        track_created(gen, "element")
        gen.SetAttribute("bus1", cub)
        gen.SetAttribute("av_mode", "constq")
    pv, qv = as_float(p, 0.0), as_float(q, 0.0)
    s = as_float(rating) if rating is not None else max(100.0, 1.5 * (abs(pv) ** 2 + abs(qv) ** 2) ** 0.5)
    gen.SetAttribute("sgn", float(s))
    pf_set(gen, "pgini", pv, unit)
    pf_set(gen, "qgini", qv, q_unit)
    pf_set(gen, "outserv", 0)
    log(f"Test generator {name} at {_nm(bus)}: P {pv:g} {unit}, Q {qv:g} {q_unit}, rating {s:g} MVA.")
    return gen
# @end
