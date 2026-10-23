"""Sandbox audit for the live runtime tests: what a test run may not change.

snapshot(app, project) records the whole object tree of a project (path -> class), the attributes
a workflow touches on elements, commands, events, cases, scenarios and variations, object counts
per class, and the active study case, scenario and variations (when the project is active).
compare(a, b) lists every difference. tree_vs_original() compares a sandbox with the demo project
it was copied from (read with GetContents only; the demo is never activated).
"""
ATTRS = ["outserv", "pgini", "qgini", "plini", "qlini", "usetp", "scale0", "nntap", "on_off", "ngnum",
         "ip_ctrl", "av_mode", "psetp", "qsetp", "sgn", "bustp", "frnom", "c_pmod",
         "iopt_net", "iopt_lim", "iopt_at", "iopt_asht", "iopt_plim", "iopt_sim", "tstart", "dtgrd", "dtemt",
         "tstop", "p_resvar", "p_event", "iopt_show", "iopt_fastsol", "iopt_fastout", "systemSolvingMode",
         "iopt_mde", "iopt_shc", "iopt_cur", "iopt_allbus", "shcobj", "Rf", "Xf",
         "time", "i_shc", "i_switch", "i_allph", "p_target", "dP", "dQ", "variable", "value", "outNgnum",
         "R_f", "X_f", "shcLocation", "i_clearShc", "desc", "iStudyTime", "bus1"]
CLASSES = {"ElmSym", "ElmLod", "ElmLne", "ElmTr2", "ElmTr3", "ElmTerm", "ElmGenstat", "ElmPvsys", "ElmXnet",
           "ElmShnt", "ElmCoup", "StaSwitch", "ElmComp", "ElmDsl", "ElmNet", "ElmVsc", "ElmAsm",
           "ComLdf", "ComInc", "ComSim", "ComShc", "ComHldf", "EvtShc", "EvtSwitch", "EvtLod", "EvtParam",
           "EvtSym", "EvtOutage", "IntCase", "IntScenario", "IntScheme", "IntAcscheme", "IntRef", "StaCubic"}


def _project(app, name):
    hits = [p for p in app.GetCurrentUser().GetContents("*.IntPrj", 1) if p.loc_name == name]
    if not hits:
        raise RuntimeError(f"no project {name!r}")
    return hits[0]


def _rel(fullname, pname):
    return fullname.split(pname, 1)[1] if pname in fullname else fullname


def _val(v, pname):
    if hasattr(v, "GetFullName"):
        return "obj:" + _rel(v.GetFullName(), pname)
    if isinstance(v, float):
        return round(v, 9)
    if isinstance(v, (list, tuple)):
        return tuple(_val(x, pname) for x in v)
    return v


def snapshot(app, name):
    prj = _project(app, name)
    pname = name + ".IntPrj"
    tree, attrs, counts = {}, {}, {}
    for o in prj.GetContents("*", 1):
        rel = _rel(o.GetFullName(), pname)
        cls = o.GetClassName()
        tree[rel] = cls
        counts[cls] = counts.get(cls, 0) + 1
        if cls in CLASSES:
            for a in ATTRS:
                try:
                    if o.HasAttribute(a):
                        attrs[(rel, a)] = _val(o.GetAttribute(a), pname)
                except Exception:
                    pass
    active = None
    ap = app.GetActiveProject()
    if ap is not None and ap.loc_name == name:
        case, scen = app.GetActiveStudyCase(), app.GetActiveScenario()
        active = (case.loc_name if case else None, scen.loc_name if scen else None,
                  tuple(sorted(v.loc_name for v in app.GetActiveNetworkVariations())))
    return {"tree": tree, "attrs": attrs, "counts": counts, "active": active, "n": len(tree)}


def compare(a, b, limit=40):
    out = []
    for k in sorted(set(a["tree"]) - set(b["tree"])):
        out.append(f"missing after: {a['tree'][k]} {k}")
    for k in sorted(set(b["tree"]) - set(a["tree"])):
        out.append(f"extra after: {b['tree'][k]} {k}")
    for k in sorted(set(a["attrs"]) | set(b["attrs"])):
        va, vb = a["attrs"].get(k, "<none>"), b["attrs"].get(k, "<none>")
        if va != vb:
            out.append(f"changed {k[0]} {k[1]}: {va!r} -> {vb!r}")
    if a["active"] is not None and b["active"] is not None and a["active"] != b["active"]:
        out.append(f"active case/scenario/variations: {a['active']} -> {b['active']}")
    return out[:limit] + ([f"... and {len(out) - limit} more"] if len(out) > limit else [])


def tree_vs_original(app, original, sandbox):
    """Object paths and classes of the sandbox against its original demo project."""
    a, b = {}, {}
    for name, d in ((original, a), (sandbox, b)):
        p = _project(app, name)
        pname = name + ".IntPrj"
        for o in p.GetContents("*", 1):
            d[_rel(o.GetFullName(), pname)] = o.GetClassName()
    extra = sorted(k for k in b if k not in a)
    missing = sorted(k for k in a if k not in b)
    return extra, missing, len(a), len(b)
