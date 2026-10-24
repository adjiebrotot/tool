"""Live tests of the PowerFactory half of the Builder runtime (pf_core, pf_model, pf_studies).

Run ONLY through the lab runner, which serialises PowerFactory use and refuses while the GUI runs:
    python "%PFB_PFRUN%" live_tests.py
(PFB_PFRUN: your local lock runner, the same one the _audit runners use; it is not in the repo.)
It loads base.py + the pf runtime exactly as the Builder slices it (loader.py), checks the files
statically, then drives the live engine on the two sandboxes "Nine-bus System (Builder test)" and
"39 Bus New England System (Builder test)" only, and proves with audit.py that each sandbox is
left as found. It writes two real traces to ../fixtures/. Last line:
    pf runtime live tests: N passed, M failed
"""
import math
import os
import sys
import tempfile
import time
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
sys.dont_write_bytecode = True   # no __pycache__ inside the repository
sys.path.insert(0, HERE)
import audit   # noqa: E402
import loader  # noqa: E402

FIXTURES = os.path.normpath(os.path.join(HERE, "..", "fixtures"))
NINE, NE = "Nine-bus System (Builder test)", "39 Bus New England System (Builder test)"
OUT = os.environ.get("PFB_TEST_OUT") or tempfile.mkdtemp(prefix="pfb_live_")
R = {"pass": 0, "fail": 0, "fails": []}


def ok(name, cond, detail=""):
    good = bool(cond)
    R["pass" if good else "fail"] += 1
    if not good:
        R["fails"].append(f"{name} {detail}".strip())
    print(f"  {'PASS' if good else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ""), flush=True)
    return good


def near(a, b, tol):
    try:
        return abs(float(a) - float(b)) <= tol
    except (TypeError, ValueError):
        return False


class Group:
    def __init__(self, title):
        self.title = title

    def __enter__(self):
        print(f"\n== {self.title}", flush=True)
        return self

    def __exit__(self, et, ev, tb):
        if et is not None:
            ok(f"{self.title}: no unexpected error", False, f"{et.__name__}: {ev}")
            traceback.print_exception(et, ev, tb)
        return True


def raises(fn, exc=Exception, contains=()):
    try:
        fn()
    except exc as e:
        text = str(e)
        return all(c in text for c in contains), text
    except Exception as e:
        return False, f"other error {type(e).__name__}: {e}"
    return False, "no error"


def at(series, tq):
    for tv, yv in zip(series.t, series.y):
        if tv >= tq:
            return yv
    return None


def write_csv(path, header, t, y):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(header + "\n")
        for a, b in zip(t, y):
            fh.write(f"{a:.6f},{b:.6f}\n")


# ------------------------------------------------------------------ static checks (no PowerFactory)
print("== static checks of the runtime files")
LIB = loader.parse(loader.PF_FILES)
probs = [p for p in loader.check(LIB) if not p.startswith("base.py")]
ok("every @needs is complete, names unique, docstrings, column-0 directives, no dashes", not probs, "; ".join(probs[:5]))
probs = loader.each_section_alone(LIB)
ok("every section loads on its own with its @needs", not probs, "; ".join(probs[:5]))

SETTINGS = dict(WORKFLOW_NAME="pf runtime live tests", PF_API_PATH="", PROJECT=NINE, STUDY_CASE="", OUTPUT_DIR=OUT,
                RUN_MODE="auto", PF_USER="", SHOW_PF=False, UNDO_CHANGES=True, FAST_MODE=True, CONNECT_TIMEOUT=120,
                F_NOMINAL="auto", CHECK_ONLY=False)
g = loader.load(None, SETTINGS, LIB)
G = g  # short alias for the runtime namespace

with Group("offline helpers"):
    ok("unit_factor MW->kW", G["unit_factor"]("MW", "kW") == 1000.0)
    ok("unit_factor ms->s", G["unit_factor"]("ms", "s") == 0.001)
    ok("unit_factor MW->s is None", G["unit_factor"]("MW", "s") is None)
    ok("pf_clean_name strips refused characters", G["pf_clean_name"]('Case: A/B, "x"') == "Case_ A_B_ _x_", G["pf_clean_name"]('Case: A/B, "x"'))
    ok("pf_clean_name cuts to 40", len(G["pf_clean_name"]("y" * 60)) == 40)
    ok("_native float->int attribute", G["_native"](1.0, 0) == 1 and isinstance(G["_native"](1.0, 0), int))
    ok("_native text with comma", G["_native"]("172,5", 0.0) == 172.5)

PF = G["_PF"]
nm = G["_nm"]
F = G["pf_find"]
PFError = G["PFError"]

# ================================================================== Nine-bus
t_all = time.time()
app = G["pf_connect"]()
before9 = audit.snapshot(app, NINE)
sgl = {}
for prj in app.GetCurrentUser().GetContents("*.IntPrj", 1):
    hits = prj.GetContents("Set - SGL Layout*", 1)
    if hits:
        sgl[prj.loc_name] = sorted(set(h.GetParent().loc_name for h in hits))
print("   projects holding 'Set - SGL Layout' selections (read only):", sgl)
extra, missing, na, nb = audit.tree_vs_original(app, "Nine-bus System", NINE)
print(f"   Nine-bus sandbox vs original demo before the tests: {nb} vs {na} objects, extra {extra[:5]}, missing {missing[:5]}")

with Group("connect, project and study case"):
    ok("engine mode", PF["mode"] == "engine", PF["mode"])
    ok("project active", app.GetActiveProject().loc_name == NINE)
    ok("start case remembered", nm(PF["start"]["case"]) == "01- Load Flow", nm(PF["start"]["case"]))
    ok("API folder for this Python found", G["_api_path"]().endswith(G["_pyver"]()), G["_api_path"]())
    ok("GUI check says no GUI", not G["_gui_running"]())
    ok("auto mode sees it is not inside PowerFactory", not G["_inside_powerfactory"]() and G["_run_mode"]() == "engine")
    G["STUDY_CASE"] = "02- Five Cycles Classical SG Model"
    G["pf_connect"]()
    ok("STUDY_CASE activated", nm(app.GetActiveStudyCase()) == "02- Five Cycles Classical SG Model")
    ok("start case still the one before STUDY_CASE", nm(PF["start"]["case"]) == "01- Load Flow")
    G["STUDY_CASE"] = "No such case"
    good, text = raises(G["pf_connect"], SystemExit, ("No study case called", "Closest names"))
    ok("wrong STUDY_CASE: plain error with closest names", good, text[:160])
    G["STUDY_CASE"] = ""
    G["PROJECT"] = "Nine-bus Systm (Builder test)"
    good, text = raises(G["pf_connect"], SystemExit, ("Could not open the project", NINE, "[MODEL]"))
    ok("wrong PROJECT: error lists the closest project names", good, text[:200])
    G["PROJECT"] = NINE
    ok("active project unchanged after the refused activation", app.GetActiveProject().loc_name == NINE)
    G["case_activate"](app, "01- Load Flow")
    ok("preflight with installed packages", G["preflight"](["math", "csv"]))
    good, text = raises(lambda: G["preflight"](["no_such_pkg_xyz"]), SystemExit, ("pip install no_such_pkg_xyz",))
    ok("preflight names the missing package and the pip line", good, text[:160])
    ok("pf_messages returns a list", isinstance(G["pf_messages"](app), list))
    ok("check_elements finds named elements", G["check_elements"](app, ["G1.ElmSym", ("Load*.ElmLod", "all")]))
    ok("check_elements reports a missing one", not G["check_elements"](app, ["Nope.ElmSym"]))

with Group("pf_find"):
    buses = F(app, "*.ElmTerm", "all")
    names = [nm(b) for b in buses]
    ok("all: 9 busbars sorted by name", len(buses) == 9 and names == sorted(names), names)
    ok("one: G1", nm(F(app, "G1.ElmSym")) == "G1")
    w0 = G["_LOG"]["warnings"]
    ok("letter case fallback: g1 -> G1 with a warning", nm(F(app, "g1.ElmSym")) == "G1" and G["_LOG"]["warnings"] == w0 + 1)
    good, text = raises(lambda: F(app, "Generator A.ElmSym"), PFError, ("Closest names", "3 synchronous generators", "[MODEL]"))
    ok("no match: closest names and the count", good, text[:200])
    good, text = raises(lambda: F(app, "Load*.ElmLod", "one"), PFError, ("matches 3 loads",))
    ok("one with several matches: error naming them", good, text[:160])
    ok("first: Load A", nm(F(app, "Load*.ElmLod", "first")) == "Load A")
    ok("study cases: 8 sorted", [nm(c) for c in F(app, "*.IntCase", "all")] == sorted(nm(c) for c in F(app, "*.IntCase", "all"))
       and len(F(app, "*.IntCase", "all")) == 8)
    good, text = raises(lambda: F(app, "G1"), PFError, ("[CODE]", "needs its class"))
    ok("query without class: plain error", good, text[:120])
    ok("empty_ok gives None / []", F(app, "Nope.ElmSym", "first", empty_ok=True) is None and F(app, "Nope*.ElmSym", "all", empty_ok=True) == [])
    g1 = F(app, "G1.ElmSym")
    m = G["pf_mark"]()
    G["pf_set"](g1, "outserv", 1)
    ok("in_service leaves out G1 when it is out", [nm(o) for o in F(app, "G*.ElmSym", "all", in_service=True)] == ["G2", "G3"])
    G["pf_undo"](m)
    ok("undo puts G1 back in service", g1.GetAttribute("outserv") == 0)

with Group("pf_set, pf_get, pf_mark, pf_undo, units"):
    g2, g3 = F(app, "G2.ElmSym"), F(app, "G3.ElmSym")
    la = F(app, "Load A.ElmLod")
    ln = F(app, "Line 4-5.ElmLne")
    p2, p3, pl = g2.GetAttribute("pgini"), g3.GetAttribute("pgini"), la.GetAttribute("plini")
    m0 = G["pf_mark"]()
    G["pf_set"](g2, "pgini", 200)
    m1 = G["pf_mark"]()
    G["pf_set"](g2, "pgini", 210)
    G["pf_set"](la, "plini", 130)
    ok("pf_set wrote", g2.GetAttribute("pgini") == 210 and la.GetAttribute("plini") == 130)
    n = G["pf_undo"](m1)
    ok("pf_undo(mark) puts back only what came after the mark", g2.GetAttribute("pgini") == 200 and la.GetAttribute("plini") == pl, f"{n} put back")
    import numpy as np
    G["pf_set"](g2, "pgini", np.float64(170.5))
    ok("numpy float64 accepted", g2.GetAttribute("pgini") == 170.5)
    G["pf_set"](g2, "pgini", np.int64(171))
    ok("numpy int64 into a float attribute", g2.GetAttribute("pgini") == 171.0)
    G["pf_set"](g2, "pgini", "172,5")
    ok("text with a decimal comma", g2.GetAttribute("pgini") == 172.5)
    G["pf_set"](ln, "outserv", True)
    ok("bool into an int attribute", ln.GetAttribute("outserv") == 1)
    G["pf_set"](ln, "outserv", 0.0)
    G["pf_set"](g2, "pgini", 0.18, unit="GW")
    ok("unit GW -> MW", near(g2.GetAttribute("pgini"), 180.0, 1e-9), g2.GetAttribute("pgini"))
    G["pf_set"](g2, "pgini", 190000, unit="kW")
    ok("unit kW -> MW", near(g2.GetAttribute("pgini"), 190.0, 1e-9))
    ok("pf_get with unit kW", near(G["pf_get"](g2, "pgini", "kW"), 190000.0, 1e-6))
    inc01 = app.GetFromStudyCase("ComInc")
    dt0 = inc01.GetAttribute("dtgrd")
    G["pf_set"](inc01, "dtgrd", 5, unit="ms")
    ok("unit ms -> s on a project showing s", near(inc01.GetAttribute("dtgrd"), 0.005, 1e-12), inc01.GetAttribute("dtgrd"))
    good, text = raises(lambda: G["pf_set"](g2, "pginx", 1), PFError, ("has no attribute 'pginx'",))
    ok("wrong attribute name: plain error", good, text[:120])
    ok("pf_get of a result before any calculation gives None", G["pf_get"](g2, "m:Q:bus1") is None)
    G["pf_undo"](m0)
    ok("pf_undo(m0) restores everything", g2.GetAttribute("pgini") == p2 and ln.GetAttribute("outserv") == 0
       and inc01.GetAttribute("dtgrd") == dt0 and not PF["records"])
    # a value recorded with no scenario, put back while a scenario is active (right context)
    sc_case = G["case_create"](app, "PFB undo context test", template="01- Load Flow", scenario="new", keep=False)
    ok("case with a new scenario made and active", nm(app.GetActiveStudyCase()) == "PFB undo context test"
       and nm(app.GetActiveScenario()) == "PFB undo context test")
    scen = app.GetActiveScenario()
    # (a) a value written with no scenario, put back while a scenario is active
    G["scenario_deactivate"](app)
    m2 = G["pf_mark"]()
    G["pf_set"](g3, "pgini", 95)          # into the network data (no scenario active)
    G["scenario_activate"](app, scen)
    ok("in the scenario G3 shows its own (saved) value", near(g3.GetAttribute("pgini"), p3, 1e-9), g3.GetAttribute("pgini"))
    G["pf_undo"](m2)
    ok("undo went back to the mark's context (no scenario)", app.GetActiveScenario() is None)
    ok("undo: network-data value put back in the network data", near(g3.GetAttribute("pgini"), p3, 1e-9), g3.GetAttribute("pgini"))
    # (b) a value written in the scenario, put back while no scenario is active
    G["scenario_activate"](app, scen)
    m3 = G["pf_mark"]()
    G["pf_set"](g2, "pgini", 199)         # into the scenario
    G["scenario_deactivate"](app, save=True)
    ok("network data: G2 untouched by the scenario write", near(g2.GetAttribute("pgini"), p2, 1e-9))
    G["pf_undo"](m3)
    ok("undo re-activated the mark's scenario", G["_same"](app.GetActiveScenario(), scen))
    ok("undo: scenario value put back in the scenario", near(g2.GetAttribute("pgini"), p2, 1e-9), g2.GetAttribute("pgini"))
    G["scenario_deactivate"](app)
    G["case_activate"](app, "01- Load Flow")

with Group("study cases: copy, activate, loop restore"):
    cl = G["case_list"](app, "0*")
    ok("case_list sorted", [nm(c) for c in cl] == sorted(nm(c) for c in cl) and len(cl) == 8)
    ok("case_list wildcard", len(G["case_list"](app, "*SG Model")) == 2)
    r = G["case_create"](app, "PFB test case: one/two", template="01- Load Flow", scenario="copy", keep=False)
    ok("name cleaned and read back", r.name == "PFB test case_ one_two", r.name)
    ok("created, active, with a scenario of the same name", r.created and nm(app.GetActiveStudyCase()) == r.name
       and r.scenario is not None and nm(r.scenario) == r.name)
    ok("marked as made by the Builder", G["_made_by_builder"](r.case) and G["_made_by_builder"](r.scenario))
    g2 = F(app, "G2.ElmSym")
    G["pf_set"](g2, "pgini", 181)
    G["case_activate"](app, "01- Load Flow")
    ok("dispatch in the copied case's scenario leaves other cases alone", near(g2.GetAttribute("pgini"), 163, 1e-9), g2.GetAttribute("pgini"))
    G["case_activate"](app, r.case)
    ok("back in the copy the dispatch is there", near(g2.GetAttribute("pgini"), 181, 1e-9))
    G["pf_undo"]()
    r2 = G["case_create"](app, "PFB test case: one/two", template="01- Load Flow", if_exists="reuse", keep=False)
    ok("if_exists reuse", not r2.created and G["_same"](r2.case, r.case))
    r3 = G["case_create"](app, "PFB test case: one/two", template="01- Load Flow", if_exists="new", keep=False)
    ok("if_exists new gets a numbered name", r3.created and r3.name != r.name, r3.name)
    G["case_activate"](app, "01- Load Flow")
    r4 =G["case_create"](app, "PFB test case: one/two", template="01- Load Flow", if_exists="replace", keep=False, activate=False)
    ok("if_exists replace makes it again with the same name", r4.created and r4.name == r.name and not G["_alive"](r.case), r4.name)
    ok("activate=False leaves the active case", nm(app.GetActiveStudyCase()) == "01- Load Flow")
    r5 = G["case_create"](app, "PFB " + "long name " * 6, template="01- Load Flow", scenario="none", keep=False, activate=False)
    ok("long name cut to 40", len(r5.name) <= 40, r5.name)
    before = app.GetActiveStudyCase()
    seen = [nm(c) for c in G["each_case"](app, G["case_list"](app, "0[12]*"))]
    ok("each_case visits the cases", seen == ["01- Load Flow", "02- Five Cycles Classical SG Model"], seen)
    ok("each_case restores the case active before", G["_same"](app.GetActiveStudyCase(), before))
    for c in G["each_case"](app, ["02- Five Cycles Classical SG Model", "03- Three Cycles Standard SG Model"]):
        break
    ok("each_case restores after a break", G["_same"](app.GetActiveStudyCase(), before), nm(app.GetActiveStudyCase()))

with Group("operation scenarios: create, save, restore"):
    rc = G["case_create"](app, "PFB scenario test", template="01- Load Flow", scenario="none", keep=False)
    g2 = F(app, "G2.ElmSym")
    G["pf_set"](g2, "pgini", 150)                     # network data in the copy (shared by all cases)
    s = G["scenario_create"](app, "PFB test scenario", keep=False)
    ok("scenario_create made and activated it", G["_same"](app.GetActiveScenario(), s))
    ok("it holds the state in use when it was made", near(g2.GetAttribute("pgini"), 150, 1e-9))
    G["pf_set"](g2, "pgini", 177)
    ok("scenario_save", G["scenario_save"](app))
    G["scenario_deactivate"](app)
    ok("without the scenario the network data shows", near(g2.GetAttribute("pgini"), 150, 1e-9), g2.GetAttribute("pgini"))
    G["scenario_activate"](app, "PFB test scenario")
    ok("activated again it shows the saved value", near(g2.GetAttribute("pgini"), 177, 1e-9))
    G["pf_set"](g2, "pgini", 160)
    G["scenario_deactivate"](app)                    # default: drops unsaved changes
    G["scenario_activate"](app, s)
    ok("deactivate without save dropped the unsaved change", near(g2.GetAttribute("pgini"), 177, 1e-9), g2.GetAttribute("pgini"))
    G["pf_set"](g2, "pgini", 165)
    G["scenario_deactivate"](app, save=True)
    G["scenario_activate"](app, s)
    ok("deactivate with save kept it", near(g2.GetAttribute("pgini"), 165, 1e-9))
    s2 = G["scenario_create"](app, "PFB test scenario 2", keep=False, activate=False)
    ok("activate=False keeps the scenario that was active", G["_same"](app.GetActiveScenario(), s))
    G["scenario_deactivate"](app)
    seen = [nm(x) for x in G["each_scenario"](app, G["scenario_list"](app, "PFB test scen*"))]
    ok("each_scenario visits them", seen == ["PFB test scenario", "PFB test scenario 2"], seen)
    ok("each_scenario restores no scenario", app.GetActiveScenario() is None)
    G["pf_undo"]()
    ok("undo puts the network data back", near(g2.GetAttribute("pgini"), 163, 1e-9), g2.GetAttribute("pgini"))
    G["case_activate"](app, "01- Load Flow")

with Group("variations: create, activate, deactivate"):
    c01 = app.GetActiveStudyCase()
    had_acs = bool(c01.GetContents("*.IntAcscheme"))
    la = F(app, "Load A.ElmLod")
    v = G["variation_create"](app, "PFB test variation", keep=False)
    ok("variation made, active and recording", any(G["_same"](v, x) for x in app.GetActiveNetworkVariations())
       and app.GetRecordingStage() is not None)
    G["pf_set"](la, "plini", 140)
    G["variation_deactivate"](app, v)
    ok("without the variation the base value shows", near(la.GetAttribute("plini"), 125, 1e-9), la.GetAttribute("plini"))
    G["variation_activate"](app, "PFB test variation")
    ok("with it the stage's value shows", near(la.GetAttribute("plini"), 140, 1e-9))
    G["variation_deactivate"](app)
    seen = [nm(x) for x in G["each_variation"](app, G["variation_list"](app, "IEEE*"))]
    ok("each_variation visits the variations", seen == ["IEEE Type 1 Amplidyne", "IEEE Type 1 Mag-A", "IEEE Type 3 SCPT"], seen)
    ok("each_variation restores none active", not app.GetActiveNetworkVariations())
    ok("01- Load Flow had no variation configuration at the start", not had_acs)
    G["pf_undo"]()

with Group("dispatch, scaling, service"):
    g2, la = F(app, "G2.ElmSym"), F(app, "Load A.ElmLod")
    m = G["pf_mark"]()
    G["pf_set"](g2, "ngnum", 2)            # temporarily two parallel machines on a sandbox unit
    G["set_dispatch"](g2, p=200, basis="total")
    ok("basis total divides by ngnum", near(g2.GetAttribute("pgini"), 100, 1e-9), g2.GetAttribute("pgini"))
    lf = G["run_load_flow"](app)
    ok("load flow shows the total", lf.ok and near(G["pf_get"](g2, "m:P:bus1"), 200, 0.05), G["pf_get"](g2, "m:P:bus1"))
    G["set_dispatch"](g2, p=90, basis="machine")
    ok("basis machine writes as given", near(g2.GetAttribute("pgini"), 90, 1e-9))
    G["set_dispatch"](g2, q=40, qmode="pq")
    ok("qmode pq switches to constant Q", g2.GetAttribute("av_mode") == "constq" and near(g2.GetAttribute("qgini"), 20, 1e-9))
    lf = G["run_load_flow"](app)
    ok("load flow shows Q total", lf.ok and near(G["pf_get"](g2, "m:Q:bus1"), 40, 0.05), G["pf_get"](g2, "m:Q:bus1"))
    G["set_service"](g2, False)
    ok("set_service out", g2.GetAttribute("outserv") == 1)
    G["set_dispatch"](g2, p=100)
    ok("dispatch puts the unit back in service", g2.GetAttribute("outserv") == 0)
    G["scale_attr"](la, "plini", 1.1)
    G["scale_attr"](la, "plini", 1.1)
    ok("scale twice by 1.1 gives 1.1 x original", near(la.GetAttribute("plini"), 137.5, 1e-9), la.GetAttribute("plini"))
    G["scale_attr"](la, "plini", 0.9)
    ok("scale 0.9 of the original", near(la.GetAttribute("plini"), 112.5, 1e-9))
    rr = G["dispatch_row"](app, {"G2": 120, "G3": "", "Load A": 5, "Note": "x"}, mapping={"G2": "G2.ElmSym", "G3": "G3.ElmSym"})
    g3 = F(app, "G3.ElmSym")
    ok("dispatch_row: value dispatched, blank out of service", rr.dispatched == 1 and rr.out_of_service == 1
       and near(g2.GetAttribute("pgini"), 60, 1e-9) and g3.GetAttribute("outserv") == 1, rr)
    rr = G["dispatch_row"](app, {"G3": 50, "Case": "A"})
    ok("dispatch_row by header names", rr.dispatched == 1 and g3.GetAttribute("outserv") == 0 and near(g3.GetAttribute("pgini"), 50, 1e-9))
    oc = G["outer_composite"](g2)
    ok("outer_composite gives the plant model (ElmComp) or None", oc is None or oc.GetClassName() == "ElmComp",
       f"{nm(oc)} {oc.GetClassName()} in {nm(oc.GetParent())}" if oc is not None else "None")
    good, text = raises(lambda: G["set_dispatch"](la, p=5), PFError, ("not on Load A",))
    ok("set_dispatch refuses a load with a plain message", good, text[:120])
    G["pf_undo"](m)
    ok("undo restores ngnum, av_mode, pgini, qgini, plini, outserv",
       g2.GetAttribute("ngnum") == 1 and g2.GetAttribute("av_mode") != "constq" and near(g2.GetAttribute("pgini"), 163, 1e-9)
       and near(la.GetAttribute("plini"), 125, 1e-9) and g3.GetAttribute("outserv") == 0)
    fe = G["find_elements"](app, "ElmLod", "*", "plini", ">", 95)
    ok("find_elements with a filter", [nm(o) for o in fe] == ["Load A", "Load C"], [nm(o) for o in fe])
    fe = G["find_elements"](app, "ElmLne", "*", "loc_name", "!=", "Line 4*")
    ok("find_elements != with a pattern leaves the matches out", len(fe) == 4, [nm(o) for o in fe])

with Group("a loop the way the generated code writes it (each pass starts from the same model)"):
    start = app.GetActiveStudyCase()
    g2 = F(app, "G2.ElmSym")
    seen, tg = [], None
    for i, mw in enumerate([100.0, 150.0], 1):
        G["ctx_push"]("Dispatch (MW)", mw, i, 2)
        mark = G["pf_mark"]()
        try:
            r = G["case_create"](app, f"PFB loop {mw:g}", keep=False)          # a copy of the active case
            seen.append((r.name, G["pf_get"](F(app, "G2.ElmSym"), "pgini")))
            G["set_dispatch"](F(app, "G2.ElmSym"), p=mw)
            tg = G["add_test_generator"](app, "Bus 5", 10, key="loopgen")
            lf = G["run_load_flow"](app)
            ok(f"pass {i}: converged with G2 at {mw:g} MW", lf.ok and near(G["pf_get"](F(app, "G2.ElmSym"), "m:P:bus1"), mw, 0.1))
        finally:
            G["pf_undo"](mark)
            G["ctx_pop"]()
        ok(f"after pass {i}: start case active, G2 back, test generator off",
           G["_same"](app.GetActiveStudyCase(), start) and app.GetActiveScenario() is None
           and near(g2.GetAttribute("pgini"), 163, 1e-9) and tg.GetAttribute("outserv") == 1)
    ok("every pass started from the same model (G2 163 MW in each new case)", [s[1] for s in seen] == [163.0, 163.0], seen)
    ok("each pass copied the start case", G["_made_by_builder"](F(app, "PFB loop 150.IntCase")) and
       [nm(c) for c in G["case_list"](app, "PFB loop*")] == ["PFB loop 100", "PFB loop 150"])
    ok("no undo records left behind", not PF["records"] and not PF["marks"])

with Group("contingencies: trip and restore"):
    m = G["pf_mark"]()
    l45 = F(app, "Line 4-5.ElmLne")
    G["pf_set"](l45, "outserv", 1)                    # already out before the contingencies
    cs = G["define_contingencies"](app, ["*.ElmLne"], 1, in_service=True)
    ok("N-1 leaves out the line already out", len(cs) == 5 and "Line 4-5" not in [c.name for c in cs], [c.name for c in cs])
    cs_all = G["define_contingencies"](app, ["*.ElmLne", "*.ElmTr2"], 1, in_service=False)
    ok("N-1 over two groups", len(cs_all) == 9 and cs_all[0].group == "lines", [c.group for c in cs_all][:2])
    n2 = G["define_contingencies"](app, ["*.ElmLne"], 2, in_service=False)
    ok("N-2 pairs", len(n2) == 15 and " + " in n2[0].name)
    states, conv = [], 0
    for c in G["each_contingency"](app, [x for x in cs_all if x.group == "lines"], base=True):
        out = [nm(l) for l in F(app, "*.ElmLne", "all") if l.GetAttribute("outserv") == 1]
        states.append((c.name, out))
        conv += 1 if G["run_load_flow"](app).ok else 0
    ok("base case first with only the already-out line out", states[0] == ("Base case", ["Line 4-5"]), states[0])
    ok("each contingency has its line out", all(c[0] in c[1] for c in states[1:]), states[1:3])
    ok("after the loop only the line that was out is out", [nm(l) for l in F(app, "*.ElmLne", "all") if l.GetAttribute("outserv")] == ["Line 4-5"])
    ok("load flows ran", conv >= 6, conv)
    with G["trip_contingency"](app, n2[0]) as tr:
        mid = sorted(nm(l) for l in F(app, "*.ElmLne", "all") if l.GetAttribute("outserv"))
    ok("trip_contingency as a with block", mid == sorted(set(["Line 4-5"] + [nm(e) for e in n2[0].elements]))
       and [nm(l) for l in F(app, "*.ElmLne", "all") if l.GetAttribute("outserv")] == ["Line 4-5"], mid)
    G["pf_undo"](m)
    ok("undo puts the first line back", l45.GetAttribute("outserv") == 0)
    ok("Contingency shows its name in tables", G["ctx_push"] and G["_ctx_value"](cs[0]) == cs[0].name)

with Group("load flow"):
    ldf = app.GetFromStudyCase("ComLdf")
    keep = {a: ldf.GetAttribute(a) for a in ("iopt_net", "iopt_lim", "iopt_at")}
    r = G["run_load_flow"](app)
    ok("converges, rc 0", r.ok and r.rc == 0 and bool(r))
    ok("slack_mw = G1 (71.64 MW)", near(r.slack_mw, 71.64, 0.05), r.slack_mw)
    r = G["run_load_flow"](app, net="dc")
    ok("DC override ran", r.ok and r.net == "DC")
    ok("DC results readable after the setting was put back", near(G["pf_get"](F(app, "Bus 5.ElmTerm"), "m:u"), 1.0, 1e-9))
    ok("iopt_net put back after DC", ldf.GetAttribute("iopt_net") == keep["iopt_net"])
    r = G["run_load_flow"](app, net="unbalanced", qlim="on", taps="on")
    ok("unbalanced: slack from m:Psum", r.ok and near(r.slack_mw, 71.64, 0.05), r.slack_mw)
    ok("all overrides put back", {a: ldf.GetAttribute(a) for a in keep} == keep)
    m = G["pf_mark"]()
    G["scale_attr"](F(app, "Load A.ElmLod"), "plini", 10)
    r = G["run_load_flow"](app)
    ok("forced non-convergence: ok False, rc != 0", not r.ok and r.rc != 0, r.rc)
    ok("PowerFactory's message captured", any("No convergence" in x for x in r.messages), r.messages)
    ok("slack None when not converged", r.slack_mw is None)
    G["pf_undo"](m)
    ok("converges again after undo", G["run_load_flow"](app).ok)

with Group("short circuit (Nine-bus Bus 5)"):
    bus5, bus7 = F(app, "Bus 5.ElmTerm"), F(app, "Bus 7.ElmTerm")
    shc = app.GetFromStudyCase("ComShc")
    keep = {a: (lambda v: v.GetFullName() if hasattr(v, "GetFullName") else v)(shc.GetAttribute(a)) for a in ("iopt_mde", "iopt_shc", "iopt_cur", "iopt_allbus", "shcobj")}
    r = G["run_short_circuit"](app, "iec", "3ph", "max", bus5)
    ikss = G["pf_get"](bus5, "m:Ikss")
    ok("IEC 60909 max at Bus 5: Ikss 2.256 kA", r.ok and near(ikss, 2.256, 0.002), ikss)
    ok("Skss 898.7 MVA", near(G["pf_get"](bus5, "m:Skss"), 898.73, 0.1))
    ok("ComShc settings put back, results still readable", {a: (lambda v: v.GetFullName() if hasattr(v, "GetFullName") else v)(shc.GetAttribute(a)) for a in keep} == keep)
    r = G["run_short_circuit"](app, "iec", "3ph", "min", bus5)
    ok("IEC min 2.099 kA", r.ok and near(G["pf_get"](bus5, "m:Ikss"), 2.099, 0.002))
    r = G["run_short_circuit"](app)
    vals = {nm(b): G["pf_get"](b, "m:Ikss") for b in F(app, "*.ElmTerm", "all")}
    ok("all busbars", r.ok and near(vals["Bus 1"], 57.012, 0.01) and near(vals["Bus 9"], 2.771, 0.002), {k: round(v, 3) for k, v in vals.items()})
    r = G["run_short_circuit"](app, "iec", "1ph", "max", bus5)
    ok("single-phase to ground 2.690 kA", r.ok and near(G["pf_get"](bus5, "m:Ikss"), 2.690, 0.002))
    r = G["run_short_circuit"](app, "iec", "3ph", "max", [bus5, bus7])
    ok("two busbars (selection)", r.ok and near(G["pf_get"](bus5, "m:Ikss"), 2.256, 0.002) and near(G["pf_get"](bus7, "m:Ikss"), 3.081, 0.002))
    r = G["run_short_circuit"](app, "complete", "3ph", "max", bus5)
    ok("complete method 2.4126 kA", r.ok and near(G["pf_get"](bus5, "m:Ikss"), 2.4126, 0.002))

with Group("harmonic load flow (Nine-bus)"):
    case = app.GetActiveStudyCase()
    ldf = app.GetFromStudyCase("ComLdf")
    r = G["run_harmonic"](app, "balanced")
    thd = G["pf_get"](F(app, "Bus 5.ElmTerm"), "m:THD")
    ok("balanced runs, THD readable afterwards, about 0", r.ok and thd is not None and thd < 1e-3, thd)
    r = G["run_harmonic"](app, "unbalanced")
    thda = G["pf_get"](F(app, "Bus 5.ElmTerm"), "m:THD:A")
    ok("unbalanced runs (the load flow is switched to match)", r.ok and thda is not None and thda < 1e-3, thda)
    ok("ComLdf network type put back", ldf.GetAttribute("iopt_net") == 0)
    made = [nm(o) for o in case.GetContents("Harmonics*.ElmRes")]
    ok("side-effect result files are tracked for removal", made and all(any(c["name"] == n for c in PF["created"]) for n in made), made)

with Group("test generator"):
    gen = G["add_test_generator"](app, "Bus 5", 50, 0, key="n40")
    lf = G["run_load_flow"](app)
    ok("connected and dispatched 50 MW", lf.ok and near(G["pf_get"](gen, "m:P:bus1"), 50, 0.01) and nm(gen) == "PFB_n40")
    ok("slack lowered by about 50 MW", near(lf.slack_mw, 71.64 - 50, 3.0), lf.slack_mw)
    gen2 = G["add_test_generator"](app, F(app, "Bus 7.ElmTerm"), 30, key="n40")
    lf = G["run_load_flow"](app)
    ok("same key moves it to Bus 7", G["_same"](gen2.GetAttribute("bus1").GetParent(), F(app, "Bus 7.ElmTerm"))
       and len(F(app, "PFB_n40.ElmGenstat", "all")) == 1 and near(G["pf_get"](gen2, "m:P:bus1"), 30, 0.01))
    G["set_dispatch"](gen2, p=40)
    ok("ready for set_dispatch", G["run_load_flow"](app).ok and near(G["pf_get"](gen2, "m:P:bus1"), 40, 0.01))

with Group("RMS and EMT on Nine-bus (copy of 03)"):
    # The test generator of the group before sits in the grid, so every study case sees it and it
    # would move Bus 7's voltage. It goes out of service here (finish() still deletes it), so the
    # fault trace written below is the one the plain study case gives.
    for _tg in F(app, "PFB_*.ElmGenstat", "all"):
        _tg.SetAttribute("outserv", 1)
    cc = G["case_create"](app, "PFB sim test", template="03- Three Cycles Standard SG Model", scenario="none", keep=False)
    bus7, bus5 = F(app, "Bus 7.ElmTerm"), F(app, "Bus 5.ElmTerm")
    inc = app.GetFromStudyCase("ComInc")
    own = [(nm(e), e.GetAttribute("outserv")) for e in inc.GetAttribute("p_event").GetContents()]
    tf, tc = G["add_short_circuit"](app, "n50", bus7, 1.0, 0.1)
    ok("add_short_circuit returns (t_fault, t_clear)", (tf, tc) == (1.0, 1.1), (tf, tc))
    res = G["run_rms"](app, 3.0, monitors=[(bus7, "m:u1"), (bus5, "m:u1")])
    u = res.series(bus7, "m:u1")
    ok("RMS ok, 3-phase fault drops then recovers", res.ok and at(u, 0.5) > 0.9 and at(u, 1.05) < 0.05 and at(u, 2.9) > 0.9,
       (res.status, at(u, 0.5), at(u, 1.05), at(u, 2.9)))
    ok("events of the run on the result and the series", res.events == [(1.0, "3ph fault at Bus 7"), (1.1, "Fault at Bus 7 cleared")]
       and u.events == res.events and u.first_event() == 1.0, res.events)
    ok("case's own events back as they were", [(nm(e), e.GetAttribute("outserv")) for e in inc.GetAttribute("p_event").GetContents() if not nm(e).startswith("PFB_")] == own)
    # The fixture the analysis tests and the pf block tests read: a real Bus 7 voltage through a
    # three-phase fault on the plain Nine-bus case 03, nothing else connected.
    write_csv(os.path.join(FIXTURES, "nine_bus_fault_u1.csv"), "t,u1", u.t, u.y)
    ok("fixture nine_bus_fault_u1.csv written", os.path.getsize(os.path.join(FIXTURES, "nine_bus_fault_u1.csv")) > 1000)
    ok("a variable that was not recorded gives an empty series", len(res.series(bus7, "m:fehz")) == 0)
    # unbalanced faults: which i_shc code gives which fault (phase voltages in the middle of it)
    codes = {}
    for fault, phase in (("1ph", None), ("1ph", "b"), ("2ph", None), ("2phg", None), ("3ph", None)):
        G["add_short_circuit"](app, "n51", bus5, 0.1, 0.1, fault=fault, phase=phase)
        rr = G["run_rms"](app, 0.3, monitors=[(bus5, "m:u:A"), (bus5, "m:u:B"), (bus5, "m:u:C")], net="rst")
        codes[(fault, phase)] = tuple(round(at(rr.series(bus5, v), 0.15), 3) for v in ("m:u:A", "m:u:B", "m:u:C"))
    print("   phase voltages (a, b, c) at 0.15 s:", codes)
    ok("1ph: phase a to ground", codes[("1ph", None)][0] < 0.01 and min(codes[("1ph", None)][1:]) > 0.8)
    ok("1ph phase b: phase b to ground", codes[("1ph", "b")][1] < 0.01 and codes[("1ph", "b")][0] > 0.8)
    ok("2ph: a and b equal near 0.5, c unfaulted", abs(codes[("2ph", None)][0] - codes[("2ph", None)][1]) < 0.01
       and 0.3 < codes[("2ph", None)][0] < 0.7 and codes[("2ph", None)][2] > 0.9)
    ok("2phg: a and b to ground", max(codes[("2phg", None)][:2]) < 0.01 and codes[("2phg", None)][2] > 0.5)
    ok("3ph: all phases", max(codes[("3ph", None)]) < 0.01)
    ok("one event pair per key, updated in place", len([e for e in inc.GetAttribute("p_event").GetContents() if nm(e).startswith("PFB_n51")]) == 2)
    # EMT 0.2 s with fault and clearing
    G["add_short_circuit"](app, "n52", bus7, 0.05, 0.05)
    emt = G["run_emt"](app, 0.2, step=5e-5, monitors=[(bus7, "m:u1"), (bus7, "m:u:A")], net="rst")
    ue = emt.series(bus7, "m:u1")
    dts = sorted(ue.t[i + 1] - ue.t[i] for i in range(len(ue.t) - 1))
    ok("EMT ok with 50 us step", emt.ok and near(dts[len(dts) // 2], 5e-5, 1e-9), (emt.status, dts[len(dts) // 2] if dts else None))
    ok("EMT fault drops u1 and clearing restores it", at(ue, 0.04) > 0.9 and at(ue, 0.09) < 0.1 and at(ue, 0.19) > 0.8,
       (at(ue, 0.04), at(ue, 0.09), at(ue, 0.19)))
    ok("EMT run switched the other workflow events off", emt.events == [(0.05, "3ph fault at Bus 7"), (0.1, "Fault at Bus 7 cleared")], emt.events)
    G["add_short_circuit"](app, "n53", bus5, 0.1, 0.1, fault="1ph")
    w0 = G["_LOG"]["warnings"]
    rr = G["run_rms"](app, 0.3, monitors=[(bus5, "m:u1"), (bus5, "m:u:A")])
    print(f"   1ph fault in a balanced (sym) RMS run: status {rr.status}, u1 at 0.15 s {at(rr.series(bus5, 'm:u1'), 0.15)}, "
          f"uA recorded {rr.has(bus5, 'm:u:A')}, message {rr.message!r}")
    ok("an unbalanced fault in a balanced RMS run gets a [MODEL] warning", rr.status == "ok" and G["_LOG"]["warnings"] == w0 + 1)
    G["case_activate"](app, "01- Load Flow")

with Group("scenario in the start case (link left behind?)"):
    s = G["scenario_create"](app, "PFB start-case scenario", keep=False)
    ok("scenario active in the start case", G["_same"](app.GetActiveScenario(), s))

with Group("finish on Nine-bus"):
    G["finish"](app)
    left = [o.GetFullName() for o in audit._project(app, NINE).GetContents("PFB*", 1)]
    ok("no PFB objects left", not left, left[:5])
    ok("start case and no scenario active", nm(app.GetActiveStudyCase()) == "01- Load Flow" and app.GetActiveScenario() is None)
    after9 = audit.snapshot(app, NINE)
    diff = audit.compare(before9, after9)
    ok(f"Nine-bus sandbox as found ({after9['n']} objects)", not diff, "; ".join(diff[:6]))
    extra, missing, na, nb = audit.tree_vs_original(app, "Nine-bus System", NINE)
    print(f"   Nine-bus sandbox vs original demo after: {nb} vs {na} objects, extra {extra[:5]}, missing {missing[:5]}")

# ================================================================== 39-bus
G["PROJECT"], G["STUDY_CASE"] = NE, ""
app = G["pf_connect"]()
before39 = audit.snapshot(app, NE)
extra, missing, na, nb = audit.tree_vs_original(app, "39 Bus New England System", NE)
print(f"   39-bus sandbox vs original demo before the tests: {nb} vs {na} objects, extra {extra[:5]}, missing {missing[:5]}")

with Group("39-bus: connect and nominal frequency"):
    ok("project switched", app.GetActiveProject().loc_name == NE and nm(PF["start"]["case"]) == "2.1 Simulation Fault Bus 16 Stable")
    ok("f_nominal 60 Hz from the bus's grid", G["f_nominal"](app, F(app, "Bus 16.ElmTerm")) == 60.0)
    ok("f_nominal 60 Hz without an element (not the Summary Grid)", G["f_nominal"](app) == 60.0)
    G["F_NOMINAL"] = 50
    ok("F_NOMINAL setting wins", G["f_nominal"](app) == 50.0)
    G["F_NOMINAL"] = "auto"

with Group("39-bus: dispatch with ngnum (G 05 has 2 machines)"):
    cc = G["case_create"](app, "PFB RMS test", template="2.1 Simulation Fault Bus 16 Stable", scenario="none", keep=False)
    g5 = F(app, "G 05.ElmSym")
    m = G["pf_mark"]()
    G["set_dispatch"](g5, p=400)
    lf = G["run_load_flow"](app)
    ok("400 MW total = 2 x 200", near(g5.GetAttribute("pgini"), 200, 1e-9) and lf.ok and near(G["pf_get"](g5, "m:P:bus1"), 400, 0.05))
    ok("pf_get total", near(G["pf_get"](g5, "pgini", total=True), 400, 1e-9))
    rd = G["pf_get_all"](F(app, "G*.ElmSym", "all"), "m:P:bus1")
    ok("pf_get_all: max, at_max, n", rd.n == 10 and nm(rd.at_max) == "G 01" and near(rd.max, 1000, 1), (rd.n, nm(rd.at_max), rd.max))
    G["pf_undo"](m)
    ok("undo", near(g5.GetAttribute("pgini"), 254, 1e-9))

with Group("39-bus: variations loop"):
    seen = [nm(v) for v in G["each_variation"](app, G["variation_list"](app, "Shunt*"))]
    ok("Shunt Compensator visited, none active after", seen == ["Shunt Compensator"] and not app.GetActiveNetworkVariations())

with Group("39-bus RMS: G 10 trip, 60 s"):
    bus16, bus39 = F(app, "Bus 16.ElmTerm"), F(app, "Bus 39.ElmTerm")
    g1, g4, g10 = F(app, "G 01.ElmSym"), F(app, "G 04.ElmSym"), F(app, "G 10.ElmSym")
    inc, sim = app.GetFromStudyCase("ComInc"), app.GetFromStudyCase("ComSim")
    evf = inc.GetAttribute("p_event")
    own = [(nm(e), e.GetAttribute("outserv")) for e in evf.GetContents()]
    mw = G["add_trip"](app, "n5", g10, 1.0)
    ok("add_trip returns 250 MW from the dispatch", near(mw, 250, 1e-9), mw)
    allbus = F(app, "*.ElmTerm", "all")
    res = G["run_rms"](app, 60.0, monitors=[(bus16, "m:fehz"), (bus39, "m:fehz"), (g1, "s:speed"), (g4, "s:speed")],
                       monitor_lists=[(allbus, "m:fehz")])
    f16 = res.series(bus16, "m:fehz")
    i = min(range(len(f16.y)), key=f16.y.__getitem__)
    ok("reached 60 s", res.ok and res.status == "ok" and near(res.t_end, 60, 1e-6), (res.status, res.t_end))
    ok("Bus 16 nadir 59.45 Hz near the end", near(f16.y[i], 59.4517, 0.003) and f16.t[i] > 55, (f16.y[i], f16.t[i]))
    ok("series unit Hz, label, events", f16.unit == "Hz" and res.events == [(1.0, "Trip G 10")], (f16.unit, f16.label, res.events))
    sp = res.series(g1, "s:speed")
    ok("generator speed recorded", len(sp) == len(f16) and 0.98 < min(sp.y) < 1.0, min(sp.y) if len(sp) else None)
    mean = res.series_combined(allbus, "m:fehz", "mean")
    spread = res.series_combined([bus16, bus39], "m:fehz", "spread")
    ok("combined mean over 39 buses", len(mean) == len(f16) and near(min(mean.y), 59.45, 0.01), min(mean.y) if len(mean) else None)
    ok("combined spread is small after the swing", len(spread) and spread.y[-1] < 0.01)
    ok("the case's own events were off for the run and are back", [(nm(e), e.GetAttribute("outserv")) for e in evf.GetContents() if not nm(e).startswith("PFB_")] == own)
    write_csv(os.path.join(FIXTURES, "39bus_G10_trip_fehz.csv"), "t,f", f16.t, f16.y)
    ok("fixture 39bus_G10_trip_fehz.csv written", os.path.getsize(os.path.join(FIXTURES, "39bus_G10_trip_fehz.csv")) > 10000)
    ok("end-of-run results readable after the run", G["pf_get"](bus16, "m:fehz") is not None)
    ok("temporary result file waits for the next calculation", any(c["kind"] == "res" for c in PF["created"]))

with Group("39-bus: ms display trap"):
    dt_disp, dt_s = inc.GetAttribute("dtgrd"), G["get_seconds"](inc, "dtgrd")
    ok("this project shows ComInc times in ms", inc.GetAttributeUnit("dtgrd") == "ms" and near(dt_disp, 10.0, 1e-9) and near(dt_s, 0.01, 1e-12))
    res = G["run_rms"](app, 2.0, step=0.005, tstart=-0.05, monitors=[(bus16, "m:fehz")])
    tt = res.series(bus16, "m:fehz").t
    steps = sorted(tt[k + 1] - tt[k] for k in range(len(tt) - 1))
    ok("step really is 5 ms and start -0.05 s", near(steps[len(steps) // 2], 0.005, 1e-9) and near(tt[0], -0.05, 1e-9), (steps[len(steps) // 2], tt[0]))
    ok("ComInc step and start put back (display 10 ms, -100 ms)", near(inc.GetAttribute("dtgrd"), 10.0, 1e-9) and near(inc.GetAttribute("tstart"), -100.0, 1e-9))
    res = G["run_rms"](app, 1.0, step=0.01, monitors=[(bus16, "m:fehz")])
    tt = res.series(bus16, "m:fehz").t
    steps = sorted(tt[k + 1] - tt[k] for k in range(len(tt) - 1))
    ok("step=0.01 really is 10 ms (not 0.01 ms) on a project showing ms", near(steps[len(steps) // 2], 0.01, 1e-9), steps[len(steps) // 2])
    ok("ComSim stop time put back", near(G["get_seconds"](sim, "tstop"), 0.1, 1e-9), G["get_seconds"](sim, "tstop"))

with Group("39-bus: fault on Bus 16, then load step, then fault again (no pile-up)"):
    G["add_short_circuit"](app, "n7", bus16, 1.0, 0.1)
    r1 = G["run_rms"](app, 3.0, monitors=[(bus16, "m:u1")])
    u1 = r1.series(bus16, "m:u1")
    trip_ev = evf.GetContents("PFB_n5_trip.EvtSwitch")[0]
    ok("fault drops then recovers", r1.ok and at(u1, 0.9) > 1.0 and at(u1, 1.05) < 0.05 and at(u1, 2.9) > 0.95, (at(u1, 0.9), at(u1, 1.05), at(u1, 2.9)))
    ok("the trip from the earlier run is switched off", trip_ev.GetAttribute("outserv") == 1 and r1.events == [(1.0, "3ph fault at Bus 16"), (1.1, "Fault at Bus 16 cleared")], r1.events)
    load16 = F(app, "Load 16.ElmLod")
    G["add_load_step"](app, "n9", load16, 1.0, dp=20)
    r2 = G["run_rms"](app, 5.0, monitors=[(load16, "m:Psum:bus1"), (bus16, "m:fehz")])
    p = r2.series(load16, "m:Psum:bus1")
    ok("load step +20 % (329 -> 394.6 MW)", r2.ok and near(p.y[0], 329, 0.01) and near(p.y[-1], 394.56, 0.3), (p.y[0], p.y[-1]))
    ok("only the load step was on", r2.events == [(1.0, "Load step Load 16 +20 %")], r2.events)
    G["add_short_circuit"](app, "n7", bus16, 1.0, 0.1)
    r3 = G["run_rms"](app, 3.0, monitors=[(bus16, "m:u1")])
    ok("same fault again gives the same curve", r3.series(bus16, "m:u1").y == u1.y)
    pfb = sorted(nm(e) for e in evf.GetContents() if nm(e).startswith("PFB_"))
    ok("one event per block and role, no pile-up", pfb == ["PFB_n5_trip", "PFB_n7_off", "PFB_n7_on", "PFB_n9_load"], pfb)

with Group("39-bus: continuation (extend_to)"):
    G["add_trip"](app, "n5", g10, 1.0)
    res = G["run_rms"](app, 10.0, monitors=[(bus16, "m:fehz")], extend_to=30.0)
    f = res.series(bus16, "m:fehz")
    ok("extended to 30 s as the frequency was still falling", res.ok and near(res.t_end, 30, 1e-6) and near(f.t[-1], 30, 1e-6), res.t_end)
    ok("one continuous curve, still at its lowest at the end", near(f.t[0], -0.1, 1e-9) and f.y[-1] == min(f.y) and near(f.y[-1], 59.461, 0.003), f.y[-1])
    res = G["run_rms"](app, 5.0, monitors=[(bus16, "m:fehz")], extend_to=6.0, ufls_hz=59.9)
    ok("no extension when the lowest value is below the level", near(res.t_end, 5.0, 1e-6), res.t_end)

with Group("39-bus: other events and outcomes"):
    g5 = F(app, "G 05.ElmSym")
    mw = G["add_trip"](app, "n20", g5, 1.0)
    res = G["run_rms"](app, 5.0, monitors=[(bus16, "m:fehz"), (g5, "m:P:bus1")])
    pg = res.series(g5, "m:P:bus1")
    ok("trip of a 2-machine unit: 508 MW (2 x 254) and P goes to 0", near(mw, 508, 1e-9) and res.ok and near(pg.y[0], 508, 0.5)
       and abs(pg.y[-1]) < 1e-6, (mw, pg.y[0], pg.y[-1]))
    good, text = raises(lambda: G["add_trip"](app, "n21", g5, 1.0, units="some", n=1), PFError, ("ignores the machine outage event",))
    ok("partial machine trip refused with the reason", good, text[:120])
    gov = F(app, "GOV 06.ElmDsl")
    G["add_param_event"](app, "n22", gov, 1.0, "T1", 1.0, mode="times")
    ev = evf.GetContents("PFB_n22_param.EvtParam")[0]
    ok("parameter event from the initial value, value as text", ev.GetAttribute("variable") == "T1" and ev.GetAttribute("value") == "0.2", ev.GetAttribute("value"))
    G["add_param_event"](app, "n22", gov, 1.0, "T1", 0.05, mode="add")
    ok("add mode", evf.GetContents("PFB_n22_param.EvtParam")[0].GetAttribute("value") == "0.25")
    res = G["run_rms"](app, 2.0, monitors=[(bus16, "m:fehz")])
    ok("run with the parameter event", res.ok and (1.0, "T1 = 0.25 on GOV 06") in res.events, res.events)
    c = G["define_contingencies"](app, ["Line 16 - 21.ElmLne"])[0]
    G["add_contingency_events"](app, "n30", c, 1.0)
    res = G["run_rms"](app, 3.0, monitors=[(bus16, "m:fehz")])
    ok("contingency as a switch event", res.ok and res.events == [(1.0, "Open Line 16 - 21")], res.events)
    line = F(app, "Line 16 - 21.ElmLne")
    tf, tc = G["add_short_circuit"](app, "n31", line, 1.0, 0.1, location=50, clear="trip")
    res = G["run_rms"](app, 3.0, monitors=[(bus16, "m:u1"), (line, "m:I:bus1")])
    il = res.series(line, "m:I:bus1")
    ok("line fault at 50 % cleared by opening the line", res.ok and at(il, 2.5) is not None and abs(at(il, 2.5)) < 1e-3
       and [e[1] for e in res.events] == ["3ph fault at Line 16 - 21", "Fault at Line 16 - 21 cleared", "Line 16 - 21 opened"], (at(il, 2.5), res.events))
    G["add_switch_event"](app, "n40", line, 1.0, "open")
    G["add_switch_event"](app, "n41", line, 2.0, "close")
    res = G["run_rms"](app, 3.0, monitors=[(line, "m:I:bus1")])
    il = res.series(line, "m:I:bus1")
    ok("switch events: open a line, then close it again", res.ok and res.has(line, "m:I:bus1") and abs(at(il, 1.5)) < 1e-6
       and abs(at(il, 2.9)) > 0.01, (at(il, 1.5), at(il, 2.9), res.events))
    m = G["pf_mark"]()
    G["scale_attr"](load16, "plini", 8)
    res = G["run_rms"](app, 2.0, monitors=[(bus16, "m:fehz")])
    ok("diverging load flow: status no_init with PowerFactory's message", res.status == "no_init" and not res.init_ok and res.message
       and len(res.series(bus16, "m:fehz")) == 0, (res.status, res.message[:80]))
    G["pf_undo"](m)
    fast0 = {a: inc.GetAttribute(a) for a in ("iopt_fastsol", "iopt_fastout", "systemSolvingMode")}
    res = G["run_rms"](app, 1.0, fast=True, case_events="keep", monitors=[(bus16, "m:fehz")])
    ok("fast profile and keep case events run", res.ok)
    ok("fast profile settings put back", {a: inc.GetAttribute(a) for a in fast0} == fast0, fast0)

with Group("39-bus: the unstable demo case (loss of synchronism)"):
    cu = G["case_create"](app, "PFB unstable test", template="2.2 Simulation Fault Bus 16 Unstable", scenario="none", keep=False)
    res = G["run_rms"](app, 5.0, case_events="keep", monitors=[(F(app, "G 01.ElmSym"), "c:firel"), (F(app, "Bus 16.ElmTerm"), "m:u1")])
    fi = res.series(F(app, "G 01.ElmSym"), "c:firel")
    print(f"   unstable case: status {res.status}, t_end {res.t_end}, message {res.message!r}, "
          f"rotor angle range {min(fi.y) if len(fi) else None} .. {max(fi.y) if len(fi) else None}")
    ok("status, t_end and message agree", (res.status == "ok" and near(res.t_end, 5.0, 1e-6))
       or (res.status == "early" and res.t_end < 5.0 and res.message and len(fi) > 0), (res.status, res.t_end))

with Group("finish on 39-bus"):
    G["finish"](app)
    left = [o.GetFullName() for o in audit._project(app, NE).GetContents("PFB*", 1)]
    ok("no PFB objects left", not left, left[:5])
    ok("start case active again", nm(app.GetActiveStudyCase()) == "2.1 Simulation Fault Bus 16 Stable")
    after39 = audit.snapshot(app, NE)
    diff = audit.compare(before39, after39)
    ok(f"39-bus sandbox as found ({after39['n']} objects)", not diff, "; ".join(diff[:6]))
    extra, missing, na, nb = audit.tree_vs_original(app, "39 Bus New England System", NE)
    print(f"   39-bus sandbox vs original demo after: {nb} vs {na} objects, extra {extra[:5]}, missing {missing[:5]}")

print(f"\n   run log: {G['_RUN']['dir']}   total {time.time() - t_all:.1f} s")
for f_ in R["fails"]:
    print("   FAILED:", f_)
print(f"pf runtime live tests: {R['pass']} passed, {R['fail']} failed", flush=True)
sys.exit(0 if R["fail"] == 0 else 1)
