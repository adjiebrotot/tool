"""The PSCAD runtime helpers, run live against a real PSCAD engine.

    python _audit/runtime/live/live_tests.py            # everything
    python _audit/runtime/live/live_tests.py connect find set run

Each test loads only the runtime sections it needs, exactly as a generated script does, so
a missing @needs shows up here as a NameError rather than in a reader's script. Every test
that changes the sandbox proves it put the project back.

Needs: PSCAD installed and licensed, mhi-pscad (pip), and the sandbox
(python _audit/runtime/live/sandbox.py).
"""
import os
import sys
import tempfile
import time
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import loader                                                        # noqa: E402
import sandbox                                                       # noqa: E402

OUT = os.environ.get("PXB_TEST_OUT") or tempfile.mkdtemp(prefix="pxb_live_")
TESTS = []
FAILED = []
PASSED = []


def test(fn):
    TESTS.append(fn)
    return fn


def settings(**over):
    """The SETTINGS a generated script would hold, pointing at the sandbox."""
    base = {
        "PROJECT": sandbox.case("vdiv.pscx"),
        "RUN_MODE": "launch",
        "SHOW_PSCAD": False,
        "UNDO_CHANGES": True,
        "CONNECT_TIMEOUT": 180,
        "F_NOMINAL": "auto",
        # The run folder (run.log) goes outside the repository: the runtime reads
        # OUTPUT_DIR and WORKFLOW_NAME, and with neither it writes beside this file.
        "WORKFLOW_NAME": "live",
        "OUTPUT_DIR": OUT,
        "CHECK_ONLY": False,
        "TABLE_FORMAT": "csv",
        "PREFLIGHT_MODULES": (),
    }
    base.update(over)
    return base


def env(names, **over):
    """A namespace with those runtime sections loaded and SETTINGS in place."""
    return loader.load(names, settings(**over))


_NOTHING = object()


def check(label, got, want=_NOTHING, near=None):
    """One assertion. `near` makes it a tolerance comparison.

    With no `want` the value only has to be truthy; want=None really does check for None."""
    if want is _NOTHING:
        ok = bool(got)
        detail = repr(got)
    elif want is None:
        ok = got is None
        detail = repr(got)
    elif near is not None:
        ok = got is not None and abs(float(got) - float(want)) <= near
        detail = "%r vs %r" % (got, want)
    else:
        ok = got == want
        detail = "%r vs %r" % (got, want)
    (PASSED if ok else FAILED).append(label)
    print("    %s %s%s" % ("ok  " if ok else "FAIL", label, "" if ok else "  " + detail))
    return ok


# --------------------------------------------------------------------------- connect
@test
def connect():
    """px_connect opens the project, reads the version and remembers how it found it."""
    ns = env(["px_connect", "px_find", "finish"])
    app = ns["px_connect"]()
    try:
        check("connected", app is not None)
        check("version is 5.x or newer", ns["_PX"]["version"].split(".")[0] >= "5")
        check("project is open", ns["_PX"]["project"] is not None)
        check("start state remembered", isinstance(ns["_PX"]["start"], dict))
        check("licensed", app.licensed())
        check("calling again gives the same app", ns["px_connect"]() is app)
    finally:
        ns["finish"](app)


# --------------------------------------------------------------------------- find
@test
def find():
    """px_find takes a definition, a name, wildcards and a bare definition tail."""
    ns = env(["px_connect", "px_find", "finish"])
    app = ns["px_connect"]()
    px_find = ns["px_find"]
    try:
        check("master:resistor -> one", px_find(app, "master:resistor") is not None)
        check("bare 'resistor' works too", px_find(app, "resistor") is not None)
        check("case-insensitive definition", px_find(app, "MASTER:RESISTOR") is not None)
        check("master:pgb all -> 2", len(px_find(app, "master:pgb", match="all")), 2)
        check("wildcard definition", len(px_find(app, "master:pg*", match="all")), 2)
        check("by name", px_find(app, "", "Vmid", match="first") is not None)
        check("definition and name", px_find(app, "master:voltmetergnd", "Vmid") is not None)
        check("name wildcard", len(px_find(app, "master:pgb", "*Voltage", match="all")), 1)
        check("empty_ok gives []", px_find(app, "master:nosuch", match="all",
                                           empty_ok=True), [])
        check("empty_ok gives None", px_find(app, "master:nosuch", empty_ok=True), None)
        # several matches with match="one" must be an error that names them
        try:
            px_find(app, "master:pgb")
            check("two matches raise", False)
        except ns["PXError"] as err:
            check("two matches raise", "2 components match" in str(err))
            check("the error says what to do", "first or all" in str(err))
        # nothing found names the definitions that are there
        try:
            px_find(app, "master:nosuch")
            check("no match raises", False)
        except ns["PXError"] as err:
            check("no match raises", "[MODEL]" in str(err))
            check("no match lists definitions", "Definitions in the project" in str(err))
        check("sorted by name", [ns["_name_of"](c) for c in
                                 px_find(app, "master:pgb", match="all")],
              ["Load Current", "Mid Point Voltage"])
    finally:
        ns["finish"](app)


@test
def find_modules():
    """px_find crosses into module pages; page= keeps to one page."""
    ns = env(["px_connect", "px_find", "finish", "canvas"],
             PROJECT=sandbox.case("simpleac.pscx"))
    app = ns["px_connect"]()
    try:
        everywhere = ns["px_find"](app, "master:pgb", match="all")
        on_main = ns["px_find"](app, "master:pgb", match="all", page="Main")
        check("project-wide finds channels", len(everywhere) >= 4)
        check("page= is page-local", len(on_main) <= len(everywhere))
        check("pages lists Main", "Main" in ns["pages"](app))
    finally:
        ns["finish"](app)


# --------------------------------------------------------------------------- set / get
@test
def set_get():
    """px_set writes in the parameter's own unit and px_undo puts the original back."""
    ns = env(["px_connect", "px_find", "px_set", "px_get", "px_mark", "px_undo", "finish"])
    app = ns["px_connect"]()
    try:
        res = ns["px_find"](app, "master:resistor")
        was = ns["px_get"](res, "R")
        check("read R", was, 1.0, near=1e-9)
        mark = ns["px_mark"]()
        ns["px_set"](res, "R", 2.5)
        check("wrote R", ns["px_get"](res, "R"), 2.5, near=1e-9)
        check("unit kept", ns["px_unit"](res.parameters()["R"]), "ohm")
        # a second write records nothing new, so the original is still the original
        ns["px_set"](res, "R", 4.0)
        check("wrote R again", ns["px_get"](res, "R"), 4.0, near=1e-9)
        check("one record for two writes", len(ns["_PX"]["records"]), 1)
        check("undo put one back", ns["px_undo"](mark), 1)
        check("R is back", ns["px_get"](res, "R"), was, near=1e-9)
        # a unit conversion: 2500 mohm is 2.5 ohm
        mark = ns["px_mark"]()
        ns["px_set"](res, "R", 2500.0, unit="mohm")
        check("converted mohm -> ohm", ns["px_get"](res, "R"), 2.5, near=1e-6)
        ns["px_undo"](mark)
        check("R is back again", ns["px_get"](res, "R"), was, near=1e-9)
        # an unknown parameter is a [MODEL] error that names the near ones
        try:
            ns["px_set"](res, "Rr", 1.0)
            check("unknown parameter raises", False)
        except ns["PXError"] as err:
            check("unknown parameter raises", "[MODEL]" in str(err))
            check("unknown parameter suggests", "Closest" in str(err))
    finally:
        ns["finish"](app)


@test
def get_all():
    """px_get_all reads one parameter over a list and reports max, min and where."""
    ns = env(["px_connect", "px_find", "px_get", "finish"])
    app = ns["px_connect"]()
    try:
        pgbs = ns["px_find"](app, "master:pgb", match="all")
        r = ns["px_get_all"](pgbs, "Max")
        check("two values", r.n, 2)
        check("max", r.max, 100.0, near=1e-9)
        check("min", r.min, 100.0, near=1e-9)
        check("at_max is a component", r.at_max is not None)
        one = ns["px_get_all"]([pgbs[0]], "Max")
        check("single .value", one.value, 100.0, near=1e-9)
    finally:
        ns["finish"](app)


@test
def values_and_units():
    """px_split_value reads PSCAD's unit-carrying values; unit_factor converts in family."""
    ns = env(["px_value", "units"])
    check("plain float", ns["px_split_value"](2.5), (2.5, ""))
    check("with unit", ns["px_split_value"]("2.5 [ohm]"), (2.5, "ohm"))
    check("negative exponent", ns["px_split_value"]("-1.5e-3 [s]"), (-0.0015, "s"))
    check("a substitution is not a number", ns["px_split_value"]("$(freq)"), (None, ""))
    check("empty", ns["px_split_value"](None), (None, ""))
    check("us -> s", ns["unit_factor"]("us", "s"), 1e-6, near=1e-18)
    check("MW -> kW", ns["unit_factor"]("MW", "kW"), 1000.0, near=1e-9)
    check("percent cannot convert", ns["unit_factor"]("%", "pu"), None)
    check("across families is None", ns["unit_factor"]("MW", "kV"), None)
    check("written back", ns["px_with_unit"](2.5, "ohm"), "2.5 [ohm]")
    check("written back without unit", ns["px_with_unit"](2.5, ""), "2.5")


# --------------------------------------------------------------------------- build / run
@test
def build():
    """px_build compiles, reports its messages, and does not compile twice."""
    ns = env(["px_connect", "px_build", "finish"])
    app = ns["px_connect"]()
    try:
        r = ns["px_build"](app, clean=True)
        check("built", r.ok, True)
        check("no errors", r.errors, [])
        check("took some time", r.seconds > 0)
        check("messages captured", len(r.messages) > 3)
        again = ns["px_build"](app)
        check("second build is skipped", again.seconds, 0.0)
        forced = ns["px_build"](app, force=True)
        check("force builds again", forced.seconds > 0)
    finally:
        ns["finish"](app)


@test
def run():
    """px_run runs the case and reads its channels out of PSCAD's .out files."""
    ns = env(["px_connect", "px_run", "px_find", "px_get", "finish"])
    app = ns["px_connect"]()
    try:
        r = ns["px_run"](app, duration=0.2, step=50, plot_step=250)
        check("status ok", r.status, "ok")
        check("truthy", bool(r), True)
        check("two channels", len(r.channels), 2)
        check("names", sorted(r.names()), ["Load Current", "Mid Point Voltage"])
        s = r.series("Mid Point Voltage")
        check("samples", len(s) > 700)
        check("unit from the .inf", s.unit, "kV")
        check("starts at zero", s.t[0], 0.0, near=1e-12)
        check("ends near the duration", s.t[-1], 0.2, near=0.002)
        check("t_end", r.t_end, 0.2, near=0.002)
        # The whole chain, end to end: vdiv is a source behind its own resistance feeding
        # one resistor, so the mid-point peak is Vm * sqrt(2) * R / (Rs + R). Reading those
        # three parameters back out of the model and getting the measured peak proves that
        # finding a component, reading a unit-carrying parameter and reading a recorded
        # channel all agree.
        src = ns["px_find"](app, "master:source_1")
        vm = ns["px_get"](src, "Vm", unit="kV")
        rs = ns["px_get"](src, "Rs", unit="ohm")
        rload = ns["px_get"](ns["px_find"](app, "master:resistor"), "R", unit="ohm")
        want = vm * (2 ** 0.5) * rload / (rs + rload)
        peak = max(abs(v) for v in s.y)
        check("source is 70.71 kV rms", vm, 70.71, near=0.01)
        check("the divider is 1:1", rload / (rs + rload), 0.5, near=1e-9)
        check("measured peak matches the divider", peak, want, near=0.05)
        # an unknown channel is an empty Series and a warning, never an error
        missing = r.series("No Such Channel")
        check("unknown channel is empty", len(missing), 0)
        check("has() says no", r.has("No Such Channel"), False)
        check("has() says yes", r.has("Load Current"), True)
        both = r.series_combined(["Mid Point Voltage", "Load Current"], "spread")
        check("combined has samples", len(both) > 700)
    finally:
        ns["finish"](app)


@test
def run_events():
    """The events a workflow sets travel into the Series, for the checks and the graphs."""
    ns = env(["px_connect", "px_run", "finish"])
    app = ns["px_connect"]()
    try:
        r = ns["px_run"](app, duration=0.1, events=[(0.04, "Fault on")])
        s = r.series("Mid Point Voltage")
        check("event on the series", s.events, [(0.04, "Fault on")])
        check("first_event", s.first_event(), 0.04, near=1e-12)
    finally:
        ns["finish"](app)


@test
def run_curves():
    """read="curves" reads the samples off the project's graphs instead of the files."""
    ns = env(["px_connect", "px_run", "finish"])
    app = ns["px_connect"]()
    try:
        r = ns["px_run"](app, duration=0.1, read="curves")
        check("status ok", r.status, "ok")
        check("curves found", len(r.channels) >= 2)
        s = r.series("Mid Point Voltage")
        check("curve samples", len(s) > 300)
    finally:
        ns["finish"](app)


@test
def channels_split():
    """read_inf and read_out agree on which file and column each channel is in."""
    ns = env(["px_connect", "px_run", "finish"], PROJECT=sandbox.case("simpleac.pscx"))
    app = ns["px_connect"]()
    try:
        r = ns["px_run"](app, duration=0.2, step=50, plot_step=250)
        check("status ok", r.status, "ok")
        check("four channels", len(r.channels) >= 4)
        for ch in r.channels:
            s = r.series(ch.name)
            check("channel %r has samples" % ch.name, len(s) > 100)
        folder, stem, inf = ns["out_paths"](app)
        index = ns["read_inf"](inf)
        check("the index is in channel order", [c.index for c in index],
              list(range(1, len(index) + 1)))
    finally:
        ns["finish"](app)


@test
def snapshot():
    """A run saves a snapshot and a later run starts from it."""
    ns = env(["px_connect", "px_run", "snapshots", "finish"])
    app = ns["px_connect"]()
    try:
        name = ns["snapshot_save"](app, 0.1)
        check("snapshot named", name.endswith(".snp"))
        r = ns["px_run"](app, duration=0.2, snapshot=0.1)
        check("run with snapshot ok", r.status, "ok")
        folder, _, _ = ns["out_paths"](app)
        check("the .snp is there", os.path.exists(os.path.join(folder, name)))
        ns["snapshot_use"](app, name)
        r2 = ns["px_run"](app, duration=0.2, from_snapshot=name)
        check("run from snapshot ok", r2.status, "ok")
        # The run carries on from the snapshot's time, with the duration added after it.
        t2 = r2.series(r2.names()[0]).t
        check("it starts at the snapshot's time", t2[0], 0.1, near=2e-3)
        check("and runs the duration from there", t2[-1], 0.3, near=2e-3)
        ns["snapshot_off"](app)
        check("back to a standard start",
              ns["_PX"]["project"].parameters()["StartType"], "STANDARD")
    finally:
        ns["finish"](app)


# --------------------------------------------------------------------------- model
@test
def layers():
    """A layer is made, switched, used and taken away again."""
    ns = env(["px_connect", "px_find", "layers", "finish"])
    app = ns["px_connect"]()
    try:
        was = ns["layer_list"](app)
        layer = ns["layer_create"](app, "PXB_test")
        check("layer made", "PXB_test" in ns["layer_list"](app))
        res = ns["px_find"](app, "master:resistor")
        check("component added", ns["layer_add"](app, res, "PXB_test"), 1)
        check("states offered", "Disabled" in ns["layer_states"](app, "PXB_test"))
        check("set Disabled", ns["layer_set"](app, "PXB_test", "Disabled"), "Disabled")
        check("state reads back", ns["layer_list"](app)["PXB_test"], "Disabled")
        check("a near spelling is fixed", ns["layer_set"](app, "PXB_test", "enabled"),
              "Enabled")
        seen = list(ns["each_layer"](app, ["PXB_test"]))
        check("each_layer yields it", seen, ["PXB_test"])
        try:
            ns["layer_set"](app, "NoSuchLayer", "Enabled")
            check("unknown layer raises", False)
        except ns["PXError"] as err:
            check("unknown layer raises", "no layer called" in str(err))
    finally:
        ns["finish"](app)
        check("the layer is gone", "PXB_test" not in ns["layer_list"](app)
              if ns["_PX"]["project"] is not None else True)
        check("layers are as they were", ns["layer_list"](app), was)


@test
def enabled():
    """set_enabled disables a component and the put-back switches it on again."""
    ns = env(["px_connect", "px_find", "set_enabled", "px_mark", "px_undo", "px_build",
              "finish"])
    app = ns["px_connect"]()
    try:
        res = ns["px_find"](app, "master:resistor")
        readable = ns["_read_enabled"](res) is not None
        check("starts enabled", ns["_read_enabled"](res) in (True, None))
        mark = ns["px_mark"]()
        check("disabled one", ns["set_enabled"](res, False), 1)
        if readable:
            check("it is disabled", ns["_read_enabled"](res), False)
            check("disabling again changes nothing", ns["set_enabled"](res, False), 0)
        else:
            # PSCAD 5.0.0 cannot report the state, so the helper records the opposite and
            # the put-back still works. That is the behaviour worth proving here.
            check("one record even when the state cannot be read",
                  len(ns["_PX"]["records"]), 1)
        ns["px_undo"](mark)
        check("the record is gone", len(ns["_PX"]["records"]), 0)
        if readable:
            check("enabled again", ns["_read_enabled"](res), True)
        # The build is the real proof: a disabled resistor leaves the node floating.
        check("still builds after the put-back", ns["px_build"](app, force=True).ok, True)
    finally:
        ns["finish"](app)


@test
def globalsubs():
    """A global substitution is created, read, set and put back."""
    ns = env(["px_connect", "globalsub", "px_mark", "px_undo", "f_nominal", "finish"])
    app = ns["px_connect"]()
    try:
        check("a project has at least its unnamed set", len(ns["gs_sets"](app)) >= 1)
        have = ns["gs_all"](app)
        check("vdiv states its frequency as a substitution", "f" in have)
        check("and it reads as a number", ns["gs_get"](app, "f"), 60.0, near=1e-9)
        ns["gs_set"](app, "PXB_rtest", 3.5)
        check("created and set", ns["gs_get"](app, "PXB_rtest"), 3.5, near=1e-9)
        mark = ns["px_mark"]()
        ns["gs_set"](app, "PXB_rtest", 7.0)
        check("set again", ns["gs_get"](app, "PXB_rtest"), 7.0, near=1e-9)
        check("one record", len(ns["_PX"]["records"]), 1)
        ns["px_undo"](mark)
        check("put back", ns["gs_get"](app, "PXB_rtest"), 3.5, near=1e-9)
        check("an unknown one gives the default",
              ns["gs_get"](app, "PXB_nosuch", default=-1), -1)
        # A set that is not there is a [MODEL] error that says how to make one, never a
        # call that would close PSCAD 5.0.0's connection.
        try:
            ns["gs_set_active"](app, "PXB_nosuchset")
            check("an unknown set raises", False)
        except ns["PXError"] as err:
            check("an unknown set raises", "no global substitution set" in str(err))
            check("and says where to make one", "Project Settings" in str(err))
    finally:
        ns["finish"](app)
        check("the substitution is gone",
              "PXB_rtest" not in ns["gs_all"](app))


@test
def controls():
    """Sliders, switches, dials and buttons are driven by name."""
    ns = env(["px_connect", "px_find", "controls", "px_mark", "px_undo", "px_run", "finish"],
             PROJECT=sandbox.case("inputctrl.pscx"))
    app = ns["px_connect"]()
    try:
        sliders = ns["px_find"](app, "Slider", match="all", empty_ok=True) or []
        switches = ns["px_find"](app, "Switch", match="all", empty_ok=True) or []
        dials = ns["px_find"](app, "Selector", match="all", empty_ok=True) or []
        buttons = ns["px_find"](app, "Button", match="all", empty_ok=True) or []
        check("sliders found", len(sliders) >= 1)
        check("switches found", len(switches) >= 1)
        check("dials found", len(dials) >= 1)
        check("buttons found", len(buttons) >= 1)

        def stand(objs):
            return [dict(o.parameters() or {}) for o in objs]
        moved = [g[0] for g in (sliders, switches, dials) if g]
        was = stand(moved)
        mark = ns["px_mark"]()
        if sliders:
            check("slider kind", ns["_control_kind"](sliders[0]), "slider")
            check("slider set", ns["_control_one"](sliders[0], 0.5, "auto"), 0.5, near=1e-9)
        if switches:
            check("switch kind", ns["_control_kind"](switches[0]), "switch")
            check("switch on", ns["_control_one"](switches[0], True, "auto"), True)
            check("switch off", ns["_control_one"](switches[0], "off", "auto"), False)
        if dials:
            check("dial kind", ns["_control_kind"](dials[0]), "dial")
            check("dial set", ns["_control_one"](dials[0], 2, "auto"), 2)
        if buttons:
            check("button kind", ns["_control_kind"](buttons[0]), "button")
            check("button clicked", ns["_control_one"](buttons[0], None, "auto"), True)
        if sliders:
            lo, hi = ns["control_limits"](app, "Slider", ns["_name_of"](sliders[0]), -5, 5, "first")
            check("slider limits set", (lo, hi), (-5.0, 5.0))
        check("the limits moved", stand(moved) != was)
        # Where a control stands is not a parameter, so a run is what shows it: the slider
        # drives a channel of its own.
        chan, first = "Slider_1", [s for s in sliders if ns["_name_of"](s) == "Slider 1"]
        if first:
            ns["_control_one"](first[0], 0.3, "auto")
            r = ns["px_run"](app, duration=0.05)
            check("the run uses the slider as set", r.series(chan).y[-1], 0.3, near=1e-6)
        ns["px_undo"](mark)
        check("the limits are back where they stood", stand(moved), was)
        if first:
            r = ns["px_run"](app, duration=0.05)
            check("and the slider is back at the case's own value", r.series(chan).y[-1],
                  ns["px_number"](first[0].parameters()["Value"]), near=1e-5)
    finally:
        ns["finish"](app)


@test
def build_page():
    """A page is built from script: components, a wire, a bus, a channel and a graph."""
    ns = env(["px_connect", "px_find", "px_get", "build_page", "px_build", "projects",
              "finish"],
             PROJECT=sandbox.case("vdiv.pscx"))
    app = ns["px_connect"]()
    # A fresh name each run: PSCAD keeps a project in its workspace until it is unloaded,
    # and create_case on a name already loaded gives back the one that is there, so a
    # fixed name would collect the components of every earlier run.
    stem = "pxb_built_%d" % (int(time.time()) % 100000)
    made = os.path.join(sandbox.folder(), stem + ".pscx")
    try:
        prj = ns["project_new"](app, made)
        ns["project_use"](app, prj.name)
        src = ns["add_component"](app, "master:source_1", 10, 10)
        res = ns["add_component"](app, "master:resistor", 16, 10, R="5.0 [ohm]")
        ns["add_component"](app, "master:ground", 16, 16)
        check("source added", src is not None)
        check("resistor parameter set", ns["px_get"](res, "R"), 5.0, near=1e-9)
        check("wire drawn", ns["add_wire"](app, (10, 10), (16, 10)) is not None)
        check("bus drawn", ns["add_bus"](app, (10, 20), (24, 20), name="TestBus") is not None)
        pgb = ns["add_channel"](app, "Vbuilt", 28, 10, units="kV")
        check("channel added", ns["px_get"](pgb, "Name"), "Vbuilt")
        graph = ns["add_graph"](app, pgb, 34, 10)
        check("graph made", graph.frame is not None)
        check("curve made", graph.curve is not None)
        check("components on the page", len(ns["page_of"](app, "Main").components()) >= 7)
        check("exactly the one source that was added",
              len(ns["px_find"](app, "master:source_1", match="all")), 1)
        check("the built channel is findable by name",
              ns["px_find"](app, "master:pgb", "Vbuilt") is not None)
        check("saved", ns["project_save"](app, prj), True)
        extra = ns["add_component"](app, "master:resistor", 40, 10)
        check("deleted", ns["delete_component"](app, extra), 1)
    finally:
        ns["finish"](app)
        import shutil
        # PSCAD saves a .psmx beside the case it saves; both are this test's own.
        for path in (made, os.path.join(sandbox.folder(), stem + ".psmx")):
            try:
                os.remove(path)
            except OSError:
                pass
        for suffix in (".gf46", ".gf81", ".if18", ".vs17"):
            shutil.rmtree(os.path.join(sandbox.folder(), stem + suffix), ignore_errors=True)


@test
def scenarios():
    """Scenarios are listed and switched; saving a new one says so when PSCAD refuses."""
    ns = env(["px_connect", "scenarios", "finish"])
    app = ns["px_connect"]()
    try:
        have = ns["scenario_list"](app)
        check("listing works", isinstance(have, list))
        if have:
            check("switch works", ns["scenario_activate"](app, have[0]), have[0])
            check("each_scenario yields", list(ns["each_scenario"](app, have[:1])), have[:1])
        else:
            check("no scenarios is not an error", True)
        try:
            ns["scenario_activate"](app, "NoSuchScenario")
            check("unknown scenario raises", False)
        except ns["PXError"] as err:
            check("unknown scenario raises", "[MODEL]" in str(err))
    finally:
        ns["finish"](app)


@test
def simsets():
    """A simulation set is made, given a volley and overrides, run, and taken away."""
    ns = env(["px_connect", "simsets", "finish"])
    app = ns["px_connect"]()
    try:
        before = list(app.simulation_sets() or [])
        simset = ns["simset_create"](app, "PXB_live", volley=2)
        check("set made", "PXB_live" in list(app.simulation_sets() or []))
        check("one task", len(simset.list_tasks() or []), 1)
        check("volley set", ns["simset_volley"](app, simset, 2), 2)
        check("override written",
              ns["simset_override"](app, simset, duration=0.1)["duration"], 0.1, near=1e-9)
        r = ns["simset_run"](app, simset)
        check("set ran", r.ok, True)
    finally:
        ns["finish"](app)
        check("the set is gone", "PXB_live" not in list(app.simulation_sets() or []))


@test
def names_and_frequency():
    """px_clean_name makes a name PSCAD takes; f_nominal falls back to 50 Hz."""
    ns = env(["px_names", "f_nominal", "px_connect", "finish"])
    check("spaces and dots", ns["px_clean_name"]("Case 1.2"), "Case_1_2")
    check("leading digit", ns["px_clean_name"]("3ph fault"), "n3ph_fault")
    check("empty", ns["px_clean_name"](""), "item")
    check("trimmed", len(ns["px_clean_name"]("x" * 60)), 30)
    app = ns["px_connect"]()
    try:
        f = ns["f_nominal"](app)
        check("a frequency came out", 10.0 <= f <= 400.0)
    finally:
        ns["finish"](app)


@test
def fault_timing():
    """set_fault writes a fault component's start and duration and gives the times back."""
    ns = env(["px_connect", "px_find", "px_events", "px_mark", "px_undo", "finish"],
             PROJECT=sandbox.case("multirun.pscx"))
    app = ns["px_connect"]()
    try:
        flt = ns["px_find"](app, "master:tpflt", match="first", empty_ok=True)
        tfl = ns["px_find"](app, "master:tfault", match="first", empty_ok=True)
        check("the case has a fault component", flt is not None or tfl is not None)
        target = tfl if tfl is not None else flt
        params = target.parameters() or {}
        mark = ns["px_mark"]()
        try:
            t0, clear = ns["set_fault"](app, ns["_defn_of"](target), at=0.5, duration=0.1)
            check("start time back", t0, 0.5, near=1e-9)
            check("clear time worked out", clear, 0.6, near=1e-9)
        except ns["PXError"] as err:
            # A component without the usual names must say so, and say what to do.
            check("it says which parameters it has", "It has:" in str(err))
            check("it points at Set component parameter",
                  "Set component parameter" in str(err))
        ns["px_undo"](mark)
        check("the fault is back as it was", (target.parameters() or {}) == params)
    finally:
        ns["finish"](app)


@test
def output_namespace():
    """A case that keeps PSCAD 5's default output name "$(Namespace).out" still has its channels read."""
    ns = env(["px_connect", "px_run", "finish"], PROJECT=sandbox.case("PLL_Example_3.pscx"))
    app = ns["px_connect"]()
    try:
        prj = ns["_PX"]["project"]
        check("the case names its output by the macro",
              "$(" in str(prj.parameters().get("output_filename")))
        folder, stem, inf = ns["out_paths"](app)
        check("the stem is the project's name", stem, "PLL_Example_3")
        r = ns["px_run"](app, duration=0.1, step=50, plot_step=500)
        check("status ok", r.status, "ok")
        check("channels read", len(r.channels) >= 5)
        check("samples read", len(r.series(r.names()[0])) > 100)
    finally:
        ns["finish"](app)


@test
def switching_timing():
    """set_switching on the Timed Breaker Logic: the first and second operation, seconds, put back."""
    ns = env(["px_connect", "px_find", "px_set", "px_events", "px_mark", "px_undo", "finish"],
             PROJECT=sandbox.case("PLL_Example_3.pscx"))
    app = ns["px_connect"]()
    try:
        brk = ns["px_find"](app, "master:tbreakn")
        was = dict(brk.parameters() or {})
        check("it starts closed with one operation",
              (str(was.get("INIT")), str(was.get("NUMS"))), ("CLOSE", "1"))
        mark = ns["px_mark"]()
        check("open gives the time back", ns["set_switching"](app, "master:tbreakn", "", 0.3, "open"),
              0.3, near=1e-12)
        now = brk.parameters()
        check("open wrote the first operation", ns["px_number"](now["TO1"]), 0.3, near=1e-9)
        check("one operation is still one", str(now["NUMS"]), "1")
        ns["set_switching"](app, "master:tbreakn", "", 0.4, "close")
        now = brk.parameters()
        check("close wrote the second operation", ns["px_number"](now["TO2"]), 0.4, near=1e-9)
        check("and made it two operations", str(now["NUMS"]), "2")
        # A breaker that starts open: closing is its first operation, opening its second.
        ns["px_set"](brk, "INIT", "OPEN")
        ns["set_switching"](app, "master:tbreakn", "", 0.25, "close")
        ns["set_switching"](app, "master:tbreakn", "", 0.45, "open")
        now = brk.parameters()
        check("starting open, close is the first", ns["px_number"](now["TO1"]), 0.25, near=1e-9)
        check("starting open, open is the second", ns["px_number"](now["TO2"]), 0.45, near=1e-9)
        # A time the case holds in milliseconds is written in milliseconds.
        ns["px_set"](brk, "TO1", "600 [ms]")
        ns["set_switching"](app, "master:tbreakn", "", 0.2, "close")
        check("seconds go into a [ms] parameter as ms", str(brk.parameters()["TO1"]), "200 [ms]")
        # match "all" writes every component found (here the one there is).
        check("all components", ns["set_switching"](app, "master:tbreakn", "", 0.21, "close", "all"),
              0.21, near=1e-12)
        ns["px_undo"](mark)
        check("the breaker is back as it was", dict(brk.parameters() or {}), was)
    finally:
        ns["finish"](app)


@test
def fault_off():
    """set_fault off on Timed Fault Logic is a fault that lasts no time, and the run shows none."""
    ns = env(["px_connect", "px_find", "px_events", "px_mark", "px_undo", "px_run", "finish"],
             PROJECT=sandbox.case("PLL_Example_3.pscx"))
    app = ns["px_connect"]()
    try:
        flt = ns["px_find"](app, "master:tfaultn")
        was = dict(flt.parameters() or {})
        mark = ns["px_mark"]()
        check("times back", ns["set_fault"](app, "master:tfaultn", "", 0.2, 0.05, True, "all"),
              (0.2, 0.25))
        now = flt.parameters()
        check("start written", ns["px_number"](now["TF"]), 0.2, near=1e-9)
        check("duration written", ns["px_number"](now["DF"]), 0.05, near=1e-9)
        on = ns["px_run"](app, duration=0.3, step=50, plot_step=500)
        ns["set_fault"](app, "master:tfaultn", "", 0.2, 0.05, False)
        check("off wrote a zero duration", ns["px_number"](flt.parameters()["DF"]), 0.0, near=1e-12)
        off = ns["px_run"](app, duration=0.3, step=50, plot_step=500)
        check("both runs ok", (on.status, off.status), ("ok", "ok"))

        def swing(res):
            s = res.series("Error1")
            ys = [abs(y) for t, y in zip(s.t, s.y) if 0.2 <= t <= 0.28]
            return max(ys) if ys else None
        a, b = swing(on), swing(off)
        check("the fault shows in the run", a is not None and a > 5.0, True)
        check("switched off, it does not", b is not None and b < 0.2 * a, True)
        ns["px_undo"](mark)
        check("the fault is back as it was", dict(flt.parameters() or {}), was)
    finally:
        ns["finish"](app)


@test
def fault_phases():
    """set_fault writes the phases of a Three Phase Fault, which holds one Yes / No for each."""
    ns = env(["px_connect", "px_find", "px_events", "px_mark", "px_undo", "finish"],
             PROJECT=sandbox.case("multirun.pscx"))
    app = ns["px_connect"]()
    try:
        flt = ns["px_find"](app, "master:tpflt", match="first")
        was = dict(flt.parameters() or {})
        yes = {"1", "YES", "TRUE"}
        mark = ns["px_mark"]()
        ns["set_fault"](app, "master:tpflt", "", None, None, True, "first", "AB", 0.5)
        now = flt.parameters()
        got = tuple(str(now[k]).upper() in yes for k in ("A", "B", "C", "G"))
        check("AB is phases A and B, not to ground", got, (True, True, False, False))
        check("resistance in ohm", ns["px_number"](now["RON"]), 0.5, near=1e-9)
        ns["set_fault"](app, "master:tpflt", "", None, None, True, "first", "c")
        now = flt.parameters()
        got = tuple(str(now[k]).upper() in yes for k in ("A", "B", "C", "G"))
        check("one phase goes to ground", got, (False, False, True, True))
        ns["px_undo"](mark)
        check("the fault is back as it was", dict(flt.parameters() or {}), was)
    finally:
        ns["finish"](app)


@test
def undo_whole_run():
    """finish() puts the project back: values, layers and simulation settings."""
    ns = env(["px_connect", "px_find", "px_set", "px_get", "layers", "sim_settings",
              "finish"])
    app = ns["px_connect"]()
    prj = ns["_PX"]["project"]
    was_params = {k: prj.parameters()[k] for k in ("time_duration", "time_step",
                                                   "sample_step", "PlotType")}
    res = ns["px_find"](app, "master:resistor")
    was_r = ns["px_get"](res, "R")
    was_layers = ns["layer_list"](app)
    try:
        ns["px_set"](res, "R", 9.0)
        ns["sim_settings"](app, duration=1.5, step=20, plot_step=100, plot_format="OUT")
        ns["layer_create"](app, "PXB_undo")
        check("R changed", ns["px_get"](res, "R"), 9.0, near=1e-9)
        check("duration changed", prj.parameters()["time_duration"], 1.5, near=1e-9)
    finally:
        ns["finish"](app)
    check("R put back", ns["px_get"](res, "R"), was_r, near=1e-9)
    now = {k: prj.parameters()[k] for k in was_params}
    check("simulation settings put back", now, was_params)
    check("layers put back", ns["layer_list"](app), was_layers)


# --------------------------------------------------------------------------- runner
def main(argv):
    want = [a for a in argv[1:] if not a.startswith("-")]
    chosen = [t for t in TESTS if not want or t.__name__ in want]
    if want:
        unknown = set(want) - {t.__name__ for t in TESTS}
        if unknown:
            raise SystemExit("No such test: %s\nThere is: %s"
                             % (", ".join(sorted(unknown)),
                                ", ".join(t.__name__ for t in TESTS)))
    if not os.path.isdir(sandbox.folder()):
        sandbox.setup()
    started = time.time()
    broke = []
    for t in chosen:
        print("\n%s - %s" % (t.__name__, (t.__doc__ or "").strip().split("\n")[0]))
        try:
            t()
        except Exception:
            broke.append(t.__name__)
            print("    BROKE")
            traceback.print_exc()
    print("\n%d ok, %d failed, %d broke, %.0fs"
          % (len(PASSED), len(FAILED), len(broke), time.time() - started))
    for f in FAILED:
        print("  FAIL  " + f)
    for b in broke:
        print("  BROKE " + b)
    return 1 if (FAILED or broke) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
