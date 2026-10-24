"""Offline tests of the analysis half of the Builder runtime: signals.py, outputs.py, optimise.py.

The runtime is loaded the way the Builder slices it into a generated script: the sections of
base.py and the three analysis files are parsed (# @helper / @needs / @imports / @end at column
0), the requested sections and everything they need are resolved, their imports are written
first, and the result is exec'd into a fresh namespace holding the SETTINGS globals. The static
audit of the pf-runtime loader (missing @needs, duplicate names, missing docstrings, dashes) runs
on the same files, and every section is also loaded on its own.

Run from anywhere:  python test_analysis.py
Set PFB_TEST_TMP to choose the folder the graphs and CSV files go to (kept when a test fails,
deleted when everything passes). Prints "analysis runtime tests: N passed, M failed".
"""
import csv
import math
import os
import random
import shutil
import sys
import tempfile
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "live"))
import loader  # noqa: E402

FIXTURES = os.path.join(HERE, "..", "fixtures")
FILES = ["base.py", "signals.py", "outputs.py", "optimise.py"]
MINE = ["signals.py", "outputs.py", "optimise.py"]

RESULTS = {"pass": 0, "fail": 0}


def check(name, cond, detail=""):
    if cond:
        RESULTS["pass"] += 1
    else:
        RESULTS["fail"] += 1
        print(f"FAIL {name}" + (f": {detail}" if detail else ""))


def near(a, b, tol):
    return a is not None and b is not None and abs(a - b) <= tol


def section(title):
    print(f"-- {title}")


# ------------------------------------------------------------------------------------------
# Loading

OUT = os.environ.get("PFB_TEST_TMP") or tempfile.mkdtemp(prefix="pfb_analysis_")
os.makedirs(OUT, exist_ok=True)
LIB = loader.parse(FILES)
NS = loader.load(None, {"OUTPUT_DIR": OUT, "WORKFLOW_NAME": "analysis test"}, LIB)
Series, Trial = NS["Series"], NS["Trial"]


def ramp_series(fn, t0=0.0, t1=10.0, dt=0.01, label="", unit="", events=None):
    n = int(round((t1 - t0) / dt))
    ts = [round(t0 + i * dt, 10) for i in range(n + 1)]
    return Series(ts, [fn(t) for t in ts], label, unit, events)


def read_fixture(name):
    with open(os.path.join(FIXTURES, name), newline="") as fh:
        rows = list(csv.reader(fh))[1:]
    return [float(a) for a, _ in rows], [float(b) for _, b in rows]


def is_png(path):
    if not path or not os.path.exists(path):
        return False
    with open(path, "rb") as fh:
        head = fh.read(8)
    return head == b"\x89PNG\r\n\x1a\n" and os.path.getsize(path) > 3000


def test_static():
    section("static checks")
    probs = loader.check(LIB, FILES)
    check("static audit of base + analysis files", not probs, "; ".join(probs))
    alone = [p for p in loader.each_section_alone(LIB)]
    check("every section loads on its own", not alone, "; ".join(alone))
    mine = [n for n in LIB["order"] if LIB["sections"][n]["file"] in MINE]
    check("analysis sections found", len(mine) >= 25, str(mine))
    for f in MINE:
        text = open(os.path.join(loader.RUNTIME, f), encoding="utf-8").read()
        bad = [i for i, ch in enumerate(text) if ord(ch) > 127]
        check(f"{f} is plain ASCII", not bad, f"first non-ASCII at offset {bad[:1]}")
    # The generated script's imports come first: nothing optional may be imported at the top.
    tops = {l for n in mine for l in LIB["sections"][n]["imports"]}
    check("no optional package imported at the top", not any(("matplotlib" in l or "scipy" in l or "skopt" in l
                                                                 or "numpy" in l or "pandas" in l) for l in tops), str(tops))
    for name in ("stat", "despike", "nadir", "peak", "settling", "rocof", "value_at", "final_value",
                 "first_cross", "check_limits", "verdict", "combine_series", "plot_series", "collect_series",
                 "plot_xy", "plot_3d", "plot_heatmap", "plot_table", "plot_convergence", "save_series_csv",
                 "optimise", "find_limit"):
        check(f"section {name} exists", name in LIB["sections"])


# ------------------------------------------------------------------------------------------
# signals.py

def test_stat():
    section("stat")
    stat = NS["stat"]
    xs = [1, 5, 3]
    check("max", stat("max", xs) == 5)
    check("min", stat("min", xs) == 1)
    check("mean", stat("mean", xs) == 3)
    check("median odd", stat("median", xs) == 3)
    check("median even", stat("median", [4, 1, 3, 2]) == 2.5)
    check("sum", stat("sum", xs) == 9)
    check("count", stat("count", xs) == 3)
    check("std sample", near(stat("std", [2, 4, 4, 4, 5, 5, 7, 9]), 2.1380899, 1e-6))
    check("percentile 90", near(stat("percentile", list(range(1, 11)), 90), 9.1, 1e-12))
    check("percentile 0 is min", stat("percentile", xs, 0) == 1)
    check("percentile 100 is max", stat("percentile", xs, 100) == 5)
    check("percentile default 50 is median", stat("percentile", [1, 2, 3, 4]) == 2.5)
    nan = float("nan")
    check("NaN left out of mean", stat("mean", [1, nan, 3]) == 2)
    check("NaN left out of median (old tool bug)", stat("median", [1, nan, 3, 10]) == 3)
    check("NaN left out of count", stat("count", [1, nan, 3]) == 2)
    check("all NaN gives None", stat("max", [nan, nan]) is None)
    check("empty list gives None", stat("max", []) is None)
    check("count of empty is 0", stat("count", []) == 0)
    check("None gives None", stat("mean", None) is None)
    check("std of one value is None", stat("std", [4]) is None)
    check("one number", stat("max", 4) == 4)
    check("series values", stat("mean", Series([0, 1, 2], [1, 2, 6])) == 3)
    check("nested lists flattened", stat("sum", [[1, 2], [3], 4]) == 10)
    check("text numbers and junk", stat("sum", ["1", "2,5", "abc", None]) == 3.5)
    check("list of series", stat("max", [Series([0, 1], [1, 2]), Series([0, 1], [7, 3])]) == 7)
    check("unknown kind gives None", stat("mode", xs) is None)

    class Reading:                              # the shape of pf_core's pf_get_all result
        values = [1.0, None, 4.0]
    check("a reading of several elements", stat("max", Reading()) == 4.0 and stat("count", Reading()) == 2)
    check("alias average", stat("average", xs) == 3)
    rnd = random.Random(4)
    data = [rnd.gauss(0, 1) for _ in range(501)]
    try:
        import numpy as np
        for q in (5, 25, 50, 75, 95):
            check(f"percentile {q} matches numpy", near(stat("percentile", data, q), float(np.percentile(data, q)), 1e-12))
        check("std matches numpy ddof=1", near(stat("std", data), float(np.std(data, ddof=1)), 1e-12))
    except ImportError:
        pass


def test_despike():
    section("despike")
    despike = NS["despike"]

    def base(t):
        if t <= 1.0:
            return 50.0
        return 50.0 - 0.5 * (1.0 - math.exp(-(t - 1.0) / 1.5)) + 0.3 * (1.0 - math.exp(-(t - 1.0) / 6.0))

    s = ramp_series(base, 0, 10, 0.01, "Bus 1 m:fehz", "Hz", [(1.0, "trip")])
    k = 500                                    # t = 5.00 s
    y = list(s.y)
    y[k] += 7.0
    spiky = Series(s.t, y, s.label, s.unit, s.events)
    r = despike(spiky)
    check("one spike found", r.n == 1, repr(r))
    check("single sample removed", r.removed == 1, str(r.removed))
    check("spike time", r.spikes and near(r.spikes[0].t_start, 5.0, 1e-9))
    check("spike excursion about +7 Hz", r.spikes and near(r.spikes[0].excursion, 7.0, 0.05))
    check("clean series one sample shorter", len(r.series) == len(spiky) - 1)
    check("real dip kept (minimum unchanged)", near(min(r.series.y), min(s.y), 1e-12))
    check("events kept", r.series.events == s.events and r.series.unit == "Hz")
    check("note says what was removed", "Removed 1 spike" in r.note and "Hz" in r.note, r.note)
    clean = despike(s)
    check("no spike in a clean trace", clean.n == 0 and len(clean.series) == len(s))
    # A short real dip of 0.08 Hz is under the trigger and stays.
    d = Series(s.t, [v - (0.08 if 3.0 <= t <= 3.2 else 0.0) for t, v in zip(s.t, s.y)], s.label, "Hz")
    check("dip below the trigger kept", despike(d).n == 0)
    # p.u. frequency: compared in Hz, keeps p.u. values.
    pu = Series(s.t, [v / 50.0 for v in y], "Bus 1 m:fe", "p.u.")
    rp = despike(pu, nominal=50)
    check("p.u. frequency spike found", rp.n == 1 and rp.removed == 1, repr(rp))
    check("p.u. values kept", near(max(rp.series.y), 1.0, 1e-9))
    check("p.u. excursion in Hz", rp.spikes and near(rp.spikes[0].excursion, 7.0, 0.05))
    # A voltage in p.u. keeps p.u. levels (0.1 p.u. trigger), not Hz.
    u = ramp_series(lambda t: 1.0, 0, 5, 0.01, "Bus 7 m:u1", "p.u.")
    uy = list(u.y)
    uy[200] = 0.4
    uy[300] = 1.05                              # 0.05 p.u.: under the 0.1 trigger
    ru = despike(Series(u.t, uy, u.label, u.unit))
    check("voltage spike found in p.u. levels", ru.n == 1 and ru.removed == 1 and ru.unit == "p.u.", repr(ru))
    ro = despike(Series(u.t, uy, u.label, u.unit), signal="frequency", nominal=50)
    check("signal frequency forces Hz levels", ro.unit == "Hz" and ro.n == 2, repr(ro))
    # NaN in a trace: never flagged, kept in place, no crash.
    yn = list(y)
    yn[100] = float("nan")
    rn = despike(Series(s.t, yn, s.label, "Hz"))
    check("NaN kept, spike still found", rn.n == 1 and any(v != v for v in rn.series.y))
    check("empty series", despike(Series([], [])).n == 0 and despike(None).n == 0)
    # Max step: a steep step that lands more than settle off the median is a spike.
    fine = ramp_series(base, 0, 10, 0.002, "Bus 1 m:fehz", "Hz")
    ys2 = list(fine.y)
    ys2[3500] += 0.08                           # under the 0.1 Hz trigger, but a 40 Hz/s step
    r2 = despike(Series(fine.t, ys2, fine.label, "Hz"))
    check("steep step caught by max_step", r2.n == 1 and r2.removed == 1, repr(r2))
    r3 = despike(Series(fine.t, ys2, fine.label, "Hz"), max_step=None)
    check("max_step off", r3.n == 0)


def _dip(nom=50.0, depth=0.5, t_min=3.0, rec=0.3, t_end=20.0, t_event=1.0):
    def f(t):
        if t <= t_event:
            return nom
        if t <= t_min:
            x = (t - t_event) / (t_min - t_event)
            return nom - depth * math.sin(x * math.pi / 2)
        return nom - depth + rec * (1 - math.exp(-(t - t_min) / 2.0))
    return f


def test_nadir():
    section("nadir")
    nadir = NS["nadir"]
    ev = [(1.0, "G1 trip")]
    s = ramp_series(_dip(), 0, 20, 0.01, "Bus 1 m:fehz", "Hz", ev)
    r = nadir(s, nominal=50)
    check("recovers: NADIR", r.verdict == "NADIR", repr(r))
    check("nadir value", near(r.value, 49.5, 1e-6))
    check("nadir time", near(r.time, 3.0, 0.011))
    check("turned around", r.turned is True)
    check("UFLS FALSE", r.ufls == "FALSE")
    check("recovery", near(r.recovery, 0.3 * (1 - math.exp(-17 / 2.0)), 1e-3))
    check("event time from the series events", r.t_event == 1.0)
    check("floor and UFLS from nominal", r.floor == 45.0 and r.ufls_level == 49.0)
    check("minimum always given", near(r.minimum, 49.5, 1e-6) and r.min_time == r.time)
    check("result readable as keys", r["verdict"] == "NADIR" and "ufls" in r.keys())

    c = nadir(ramp_series(_dip(depth=6.0, rec=1.0), 0, 20, 0.01, "f", "Hz", ev), nominal=50)
    check("below the floor: COLLAPSE", c.verdict == "COLLAPSE" and c.ufls == "TRUE", repr(c))
    check("COLLAPSE has no nadir value but a minimum", c.value is None and near(c.minimum, 44.0, 1e-6))

    still = ramp_series(lambda t: 50.0 if t <= 1 else 50.0 - 0.4 * (t - 1) / 19.0, 0, 20, 0.01, "f", "Hz", ev)
    sf = nadir(still, nominal=50)
    check("still falling: COLLAPSE", sf.verdict == "COLLAPSE" and sf.still_falling, repr(sf))
    check("still falling above UFLS: UNDEFINED", sf.ufls == "UNDEFINED")
    check("minimum at t_end", near(sf.min_time, 20.0, 1e-9) and near(sf.minimum, 49.6, 1e-6))
    check("extended to the horizon: FALSE", nadir(still, nominal=50, extend_to=20.0).ufls == "FALSE")
    check("not yet at the horizon: UNDEFINED", nadir(still, nominal=50, extend_to=60.0).ufls == "UNDEFINED")
    deep = ramp_series(lambda t: 50.0 if t <= 1 else 50.0 - 1.5 * (t - 1) / 19.0, 0, 20, 0.01, "f", "Hz", ev)
    check("still falling below UFLS: TRUE", nadir(deep, nominal=50).ufls == "TRUE")

    sh = ramp_series(_dip(depth=0.2, rec=0.01), 0, 20, 0.01, "f", "Hz", ev)
    rs = nadir(sh, nominal=50)
    check("shallow arrested dip: NADIR", rs.verdict == "NADIR" and rs.turned is False, repr(rs))
    check("shallow: UFLS FALSE", rs.ufls == "FALSE")
    check("shallow without requires_ufls: COLLAPSE", nadir(sh, nominal=50, requires_ufls=False).verdict == "COLLAPSE")
    lo = ramp_series(_dip(depth=1.1, rec=0.01), 0, 20, 0.01, "f", "Hz", ev)
    rl = nadir(lo, nominal=50)
    check("no recovery below UFLS: COLLAPSE TRUE", rl.verdict == "COLLAPSE" and rl.ufls == "TRUE", repr(rl))

    s60 = ramp_series(_dip(nom=60.0), 0, 20, 0.01, "f", "Hz", ev)
    r60 = nadir(s60, nominal=60)
    check("60 Hz: limits below nominal", r60.floor == 55.0 and r60.ufls_level == 59.0)
    check("60 Hz: NADIR and UFLS FALSE", r60.verdict == "NADIR" and r60.ufls == "FALSE" and near(r60.value, 59.5, 1e-6))
    NS["F_NOMINAL"] = 60
    check("nominal from F_NOMINAL", nadir(s60).nominal == 60.0)
    NS["F_NOMINAL"] = "auto"
    check("nominal guessed from the first sample", nadir(s60).nominal == 60.0)
    NS.pop("F_NOMINAL", None)
    s60b = ramp_series(_dip(nom=60.0, depth=1.2), 0, 20, 0.01, "f", "Hz", ev)
    check("60 Hz trace under 59 Hz: UFLS TRUE", nadir(s60b, nominal=60).ufls == "TRUE")
    check("50 Hz rules on a 60 Hz trace would miss it", nadir(s60b, nominal=60).ufls != nadir(s60b, nominal=50).ufls)

    pu = Series(s.t, [v / 50.0 for v in s.y], "Bus 1 m:fe", "p.u.", ev)
    rp = nadir(pu, nominal=50)
    check("p.u.: scaled to Hz", rp.verdict == "NADIR" and near(rp.value, 49.5, 1e-6), repr(rp))
    rsp = nadir(Series(s.t, [v / 50.0 for v in s.y], "G1 s:speed", "", ev), nominal=50)
    check("unitless near 1: p.u.", near(rsp.value, 49.5, 1e-6))

    e = nadir(Series([], [], "f", "Hz"))
    check("no samples: NO DATA", e.verdict == "NO DATA" and e.value is None and e.ufls == "UNDEFINED")
    check("None: NO DATA", nadir(None).verdict == "NO DATA")
    kv = nadir(Series(s.t, s.y, "U", "kV"), nominal=50)
    check("wrong unit: NO DATA with a reason", kv.verdict == "NO DATA" and "kV" in kv.reason)

    # A pre-event wobble lower than the nadir is ignored: the search starts at the event.
    def pre(t):
        return 49.0 if 0.4 <= t <= 0.5 else _dip(t_event=2.0, t_min=4.0)(t)
    rpre = nadir(ramp_series(pre, 0, 20, 0.01, "f", "Hz", [(2.0, "trip")]), nominal=50)
    check("search starts at the first event", rpre.t_event == 2.0 and near(rpre.time, 4.0, 0.011), repr(rpre))
    rnone = nadir(ramp_series(pre, 0, 20, 0.01, "f", "Hz"), nominal=50)
    check("no events: from the first sample", rnone.t_event == 0.0 and near(rnone.minimum, 49.0, 1e-9))
    # A later dip deeper by more than min_recovery takes over from the window trough.
    def late(t):
        base = _dip()(t)
        return base - (0.4 if 14.0 <= t <= 15.0 else 0.0)
    rlate = nadir(ramp_series(late, 0, 20, 0.01, "f", "Hz", ev), nominal=50, window=5.0)
    check("later deeper excursion takes over", near(rlate.time, 14.0, 0.011), repr(rlate))
    rwin = nadir(ramp_series(_dip(), 0, 20, 0.01, "f", "Hz", ev), nominal=50, window=5.0)
    check("window trough kept when the tail is flat", near(rwin.time, 3.0, 0.011))


def test_settling():
    section("settling")
    settling = NS["settling"]
    tau = 0.5
    step = ramp_series(lambda t: 0.0 if t < 1.0 else 1.0 - math.exp(-(t - 1.0) / tau), 0, 10, 0.001,
                       "P", "MW", [(1.0, "step")])
    r = settling(step, band=2.0, band_mode="pct", hold=1.0)
    want = -tau * math.log(0.02)
    check("first order: settles", r.settles is True, repr(r))
    check("first order: settling time", near(r.time, want, 0.003), f"{r.time} vs {want}")
    check("first order: rise time 10-90 %", near(r.rise_time, tau * math.log(9), 0.002), str(r.rise_time))
    check("first order: no overshoot", near(r.overshoot_pct, 0.0, 1e-3), str(r.overshoot_pct))
    check("first order: initial and final", r.initial == 0.0 and near(r.final, 1.0, 1e-4))
    z, wn = 0.3, 5.0
    wd = wn * math.sqrt(1 - z * z)

    def second(t):
        if t < 1.0:
            return 0.0
        x = t - 1.0
        return 1 - math.exp(-z * wn * x) * (math.cos(wd * x) + z / math.sqrt(1 - z * z) * math.sin(wd * x))
    r2 = settling(ramp_series(second, 0, 12, 0.001, "u", "p.u.", [(1.0, "step")]), band=5.0)
    check("second order: overshoot", near(r2.overshoot_pct, 100 * math.exp(-math.pi * z / math.sqrt(1 - z * z)), 0.1),
          str(r2.overshoot_pct))
    check("second order: settles", r2.settles is True and r2.time > 1.0)

    def late(t):
        v = 0.0 if t < 1.0 else 1.0 - math.exp(-(t - 1.0) / tau)
        return v + (0.1 if 8.0 <= t <= 8.3 else 0.0)
    r3 = settling(ramp_series(late, 0, 12, 0.001, "P", "MW", [(1.0, "step")]), band=2.0)
    check("leaves the band late: last exit counts", near(r3.at, 8.3, 0.002) and near(r3.time, 7.3, 0.002), repr(r3))

    ramp = ramp_series(lambda t: 0.0 if t < 1.0 else 0.1 * (t - 1.0), 0, 10, 0.01, "P", "MW", [(1.0, "step")])
    r4 = settling(ramp, band=0.05, band_mode="abs", hold=0.5)
    check("still moving at the end: not settled", r4.settles is False and r4.time is None, repr(r4))
    enters = ramp_series(lambda t: 0.0 if t < 1.0 else (min(1.0, (t - 1.0) / 8.5)), 0, 10, 0.01, "P", "MW",
                         [(1.0, "step")])
    r5 = settling(enters, band=2.0, reference="given", target=1.0, guard=1.0)
    check("reaches the band within the guard: not settled", r5.settles is False and "still moving" in r5.reason, repr(r5))
    check("guard 0 accepts it", settling(enters, band=2.0, reference="given", target=1.0, guard=0).settles is True)
    r6 = settling(step, band=0.02, band_mode="abs", reference="given", target=1.0)
    check("absolute band, given target", r6.settles and near(r6.time, want, 0.003) and r6.final == 1.0)
    check("no samples: None", settling(Series([], [])).settles is None)


def test_rocof():
    section("rocof")
    rocof, nadir = NS["rocof"], NS["nadir"]
    knots = [(0.0, 50.0), (1.0, 50.0), (2.0, 49.8), (2.3, 49.5), (4.0, 49.33), (10.0, 49.63)]

    def pl(t):
        for (a, fa), (b, fb) in zip(knots, knots[1:]):
            if a <= t <= b:
                return fa + (fb - fa) * (t - a) / (b - a)
        return knots[-1][1]
    s = ramp_series(pl, 0, 10, 0.01, "Bus m:fehz", "Hz", [(1.0, "trip")])
    n = nadir(s, nominal=50)
    check("piecewise: nadir at 4 s", n.verdict == "NADIR" and near(n.time, 4.0, 1e-9), repr(n))
    r = rocof(s, verdict=n, nominal=50)
    check("steepest 0.5 s window, exact", near(r.value, -0.68, 1e-9), repr(r))
    check("window ends", near(r.t1, 1.8, 1e-9) and near(r.t2, 2.3, 1e-9))
    check("basis nadir", r.basis == "nadir")
    check("absolute", rocof(s, verdict=n, nominal=50, absolute=True).value == 0.68)
    r2 = rocof(s, nominal=50)
    check("works out its own nadir", r2.value == r.value and r2.basis == "nadir")
    r3 = rocof(s, nadir_time=4.0, nominal=50)
    check("nadir time alone", r3.value == r.value)
    # Exact on a window that is not on a sample grid: samples every 0.07 s.
    s7 = Series([round(i * 0.07, 10) for i in range(143)], [pl(i * 0.07) for i in range(143)], "f", "Hz", [(1.0, "trip")])
    r7 = rocof(s7, nadir_time=4.0, verdict="NADIR", nominal=50)
    check("exact on a coarse uneven grid", near(r7.value, -0.68, 0.06), repr(r7))
    # Short interval: the nadir 0.3 s after the event.
    short = ramp_series(lambda t: 50.0 if t <= 1 else (50.0 - 0.6 * (t - 1) if t <= 1.3 else 49.82 + 0.02 * (t - 1.3)),
                        0, 10, 0.01, "f", "Hz", [(1.0, "trip")])
    rs = rocof(short, nadir_time=1.3, verdict="NADIR", nominal=50)
    check("short interval: average slope", near(rs.value, -0.6, 1e-9) and rs.basis == "nadir/short", repr(rs))
    still = ramp_series(lambda t: 50.0 if t <= 1 else 50.0 - 0.1 * (t - 1), 0, 20, 0.01, "f", "Hz", [(1.0, "trip")])
    rc = rocof(still, verdict="COLLAPSE", nominal=50)
    check("collapse: window fallback", rc.basis == "window" and near(rc.value, -0.1, 1e-9) and rc.t2 <= 11.0 + 1e-9, repr(rc))
    still8 = ramp_series(lambda t: 50.0 if t <= 1 else 50.0 - 0.1 * (t - 1), 0, 8, 0.01, "f", "Hz", [(1.0, "trip")])
    check("collapse in a short run: tstop", rocof(still8, verdict="COLLAPSE", nominal=50).basis == "tstop")
    check("fallback tstop", rocof(still, verdict="COLLAPSE", fallback="tstop", nominal=50).basis == "tstop")
    check("fallback none", rocof(still, verdict="COLLAPSE", fallback="none", nominal=50).value is None)
    pu = Series(s.t, [v / 50.0 for v in s.y], "m:fe", "p.u.", s.events)
    check("p.u. scaled to Hz", near(rocof(pu, verdict=nadir(pu, nominal=50), nominal=50).value, -0.68, 1e-9))
    check("no data", rocof(Series([], []), nominal=50).value is None)


def test_values():
    section("value_at, final_value, peak, first_cross")
    value_at, final_value, peak, first_cross = NS["value_at"], NS["final_value"], NS["peak"], NS["first_cross"]
    s = Series([0, 1, 2], [0, 10, 20])
    check("value_at interpolates", value_at(s, 0.5) == 5.0 and value_at(s, 1.75) == 17.5)
    check("value_at on a sample", value_at(s, 2) == 20)
    check("value_at at an event instant takes the first", value_at(Series([0, 1, 1, 2], [0, 10, 20, 30]), 1) == 10)
    check("value_at outside: None", value_at(s, 3) is None and value_at(s, -1) is None)
    check("value_at no time / no data", value_at(s, None) is None and value_at(Series([], []), 1) is None)
    check("final value", final_value(s) == 20)
    check("final value mean of the last second", final_value(s, 1.0) == 15.0)
    check("final value no data", final_value(None) is None)
    pk = peak(Series([0, 1, 2, 3], [1, -5, 4, 2]))
    check("peak max", pk.value == 4 and pk.time == 2)
    check("peak min", peak(Series([0, 1, 2, 3], [1, -5, 4, 2]), "min").value == -5)
    check("peak abs keeps the sign", peak(Series([0, 1, 2, 3], [1, -5, 4, 2]), "abs").value == -5)
    check("peak in a time range", peak(Series([0, 1, 2, 3], [1, -5, 4, 2]), after=2.5).value == 2)
    check("peak no data", peak(None).value is None)
    r = ramp_series(lambda t: t, 0, 10, 0.1)
    c = first_cross(r, 5.0, "above")
    check("first cross above", c.found and near(c.time, 5.0, 1e-9) and near(c.delay, 5.0, 1e-9), repr(c))
    cb = first_cross(ramp_series(lambda t: 10 - t, 0, 10, 0.1), 2.5, "below")
    check("first cross below", cb.found and near(cb.time, 7.5, 1e-9))
    w = ramp_series(lambda t: 6.0 if 2.0 <= t <= 2.2 or t >= 6.0 else 4.0, 0, 10, 0.01)
    ch = first_cross(w, 5.0, "above", hold=0.5)
    check("hold skips a short touch", ch.found and near(ch.time, 5.995, 0.006), repr(ch))
    check("hold 0 takes the first touch", near(first_cross(w, 5.0, "above").time, 1.995, 0.006))
    late = first_cross(ramp_series(lambda t: 6.0 if t >= 9.8 else 4.0, 0, 10, 0.01), 5.0, "above", hold=0.5)
    check("hold past the end of the run does not count", late.found is False and "ends" in late.reason, repr(late))
    ce = first_cross(ramp_series(lambda t: t, 0, 10, 0.1, events=[(3.0, "x")]), 2.0, "above")
    check("after defaults to the first event", ce.found and near(ce.time, 3.0, 1e-9) and ce.after == 3.0)
    check("never reaches the level", first_cross(r, 50.0).found is False)
    check("no data: found None", first_cross(Series([], []), 1.0).found is None)


def test_limits():
    section("check_limits, verdict, combine_series")
    cl, verdict, comb = NS["check_limits"], NS["verdict"], NS["combine_series"]
    a = cl(5, lo=0, hi=10)
    check("value inside", a.ok is True and a.text == "PASS" and a.margin == 5)
    b = cl(12, hi=10)
    check("value above", b.ok is False and b.text == "FAIL" and b.margin == -2 and b.limit == 10)
    n = cl(None, lo=0)
    check("None: NO DATA", n.ok is None and n.text == "NO DATA")
    check("NaN: NO DATA", cl(float("nan"), lo=0).ok is None)
    lst = cl([1, 5, 11], hi=10)
    check("list: worst position", lst.ok is False and lst.at == 3 and lst.worst == 11 and lst.n_fail == 1)
    s = Series([0, 1, 2, 3], [0.95, 1.02, 1.12, 1.0])
    sr = cl(s, lo=0.9, hi=1.1)
    check("series: time of the worst point", sr.ok is False and sr.at == 2 and near(sr.margin, -0.02, 1e-12))
    check("series in a time range", cl(s, lo=0.9, hi=1.1, after=2.5).ok is True)
    rows = [(0.0, 0.0, None), (0.15, 0.0, None), (0.15, 0.7, None), (1.5, 0.9, None)]

    def u(t):
        if t < 1.0:
            return 1.0
        if t < 1.15:
            return 0.05
        return min(0.95, 0.85 + (t - 1.15) * 0.1)
    us = ramp_series(u, 0.005, 3.005, 0.01, "POC m:u1", "p.u.")
    cv = cl(us, curve=rows, x0=1.0)
    check("curve: passes", cv.ok is True, repr(cv))
    check("curve: margin is the smallest distance", near(cv.margin, 0.05, 1e-9), str(cv.margin))
    bad = ramp_series(lambda t: 1.0 if t < 1.0 else (0.05 if t < 1.15 else 0.5), 0.005, 3.005, 0.01, "u", "p.u.")
    cb = cl(bad, curve=rows, x0=1.0)
    check("curve: fails after clearing", cb.ok is False and near(cb.first_fail, 1.155, 1e-9), repr(cb))
    check("curve: worst near the end of the curve", near(cb.at, 2.495, 0.011) and cb.margin < -0.39)
    p = cl(0.79, curve=rows, xs=[0.825])
    check("curve: interpolated limit", p.ok is False and near(p.limit, 0.8, 1e-9) and near(p.margin, -0.01, 1e-9), repr(p))
    check("curve: step takes the stricter row", near(cl(0.6, curve=rows, xs=[0.15]).limit, 0.7, 1e-12))
    check("curve: outside the x range not checked", cl(0.1, curve=rows, xs=[5.0]).ok is None)
    check("curve: extend holds the last row", cl(0.1, curve=rows, xs=[5.0], extend=True).ok is False)
    check("curve: list needs xs", cl([0.5, 0.6], curve=rows).ok is None)
    check("curve: dict rows", cl(0.85, curve=[{"x": 0, "low": 0.8}, {"x": 1, "low": 0.9}], xs=[0.5]).ok is True)
    check("no limit: NO DATA", cl(3).ok is None)
    v = verdict(5, ">=", 3)
    check("verdict pass", v.ok is True and v.text == "PASS" and v.margin == 2)
    check("verdict strict", verdict(2, ">", 2).ok is False and verdict(2, ">=", 2).ok is True)
    check("verdict NO DATA", verdict(None, ">", 1).text == "NO DATA" and verdict(1, ">", None).ok is None)
    check("verdict is true", verdict("TRUE", "is true").ok is True and verdict("UNDEFINED", "is true").ok is None)
    check("verdict is false", verdict(False, "is false").ok is True)
    check("verdict list", verdict([1, 2, 3], "<", 5).ok is True and verdict([1, 6], "<", 5).ok is False)
    check("verdict equal within tol", verdict(2.0, "=", 2.05, tol=0.1).ok is True)
    check("verdict not equal sign", verdict(2.0, chr(0x2260), 3.0).ok is True)
    check("verdict words", verdict(3, "le", 3).ok is True and verdict(3, "gt", 1).ok is True)
    check("verdict series", verdict(Series([0, 1], [49.2, 49.6]), ">=", 49.0).ok is True)
    s1 = Series([0, 1, 2], [1, 2, 3], "G1", "MW", [(1.0, "trip")])
    s2 = Series([0, 1, 2], [10, 20, 30], "G2", "MW")
    sm = comb([s1, s2], "sum")
    check("combine sum", sm.y == [11, 22, 33] and sm.unit == "MW" and sm.events == [(1.0, "trip")])
    check("combine spread", comb([s1, s2], "spread").y == [9, 18, 27])
    check("combine mean", comb([s1, s2], "mean").y == [5.5, 11, 16.5])
    s3 = Series([0.5, 1.5], [100, 200], "G3", "MW")
    mixed = comb([s1, s3], "max")
    check("combine on different time bases", mixed.t == [0.5, 1.0, 1.5] and mixed.y == [100, 150, 200], repr(mixed.y))
    check("combine empty", len(comb([None, Series([], [])], "sum")) == 0)


# ------------------------------------------------------------------------------------------
# outputs.py

def test_plots():
    section("plots")
    from matplotlib.patches import PathPatch
    ev = [(1.0, "G1 trip")]
    f = ramp_series(_dip(), 0, 20, 0.01, "Bus 1 m:fehz", "Hz", ev)
    n = NS["nadir"](f, nominal=50)
    p = NS["plot_series"](f, title="Bus 1 frequency", ylabel="Frequency", limits=[(49.0, "UFLS 49 Hz"), 50.0],
                          marks=[n, (5.0, 49.6, "x")], t_event=1.0, note="Removed 1 spike")
    check("plot_series writes a PNG", is_png(p), str(p))
    check("graphs go to the graphs folder", p and os.path.basename(os.path.dirname(p)) == "graphs")
    two = NS["plot_series"]([f, Series(f.t, [v - 0.1 for v in f.y], "Bus 2 m:fehz", "Hz")])
    check("two series", is_png(two))
    many = NS["plot_series"]([Series(f.t, [v - 0.01 * k for v in f.y], f"case {k}", "Hz") for k in range(12)])
    check("twelve series (ordered ramp)", is_png(many))
    check("empty series: None", NS["plot_series"](Series([], [], "x")) is None)
    check("None: None", NS["plot_series"](None) is None)
    check("all NaN: None", NS["plot_series"](Series([0, 1], [float("nan")] * 2)) is None)
    check("axis label with unit", NS["_po_axis"]("Frequency", "Hz") == "Frequency (Hz)"
          and NS["_po_axis"]("Nadir (Hz)", "Hz") == "Nadir (Hz)" and NS["_po_axis"]("", "Hz") == "Value (Hz)")
    # The watermark is a vector PathPatch inside the figure.
    seen = []
    real_close = NS["_po_close"]
    NS["_po_close"] = lambda fig: seen.append(fig)
    try:
        NS["plot_series"](f, title="watermark")
    finally:
        NS["_po_close"] = real_close
    fig = seen[0] if seen else None
    patches = [a for a in (fig.artists if fig else []) if isinstance(a, PathPatch)]
    check("watermark is a PathPatch", len(patches) == 1)
    if patches:
        bb = patches[0].get_window_extent()
        w, h = fig.get_size_inches() * fig.dpi
        check("watermark inside the figure, bottom right", bb.x0 > w * 0.4 and bb.x1 <= w and bb.y0 >= 0 and bb.y1 < h * 0.1,
              str(bb))
        check("watermark faint", abs(patches[0].get_alpha() - 0.25) < 1e-9)
    if fig is not None:
        real_close(fig)
    texts = [t.get_text() for t in fig.texts] if fig else []
    check("watermark is not a text object", not any("tool.adjiebrotots" in t for t in texts))
    # A mark's label keeps clear of a limit line that runs just under the point (the nadir
    # 0.06 Hz above the UFLS level), of the curves and of the plot's edge, in a wide graph and
    # in a small IEEE one; and the lines vary their pattern only when the style asks.
    near = ramp_series(_dip(), 0, 20, 0.01, "Bus 1 m:fehz", "Hz", ev)
    nn = NS["nadir"](near, nominal=50)
    ieee = {"font": "Times New Roman", "font_size": 8, "title_size": 8, "frame": "box", "ticks": "in",
            "line_width": 1, "line_styles": "vary", "legend": "inside", "legend_frame": True,
            "width": 3.5, "height": 2.6, "dpi": 300}
    for name, style in (("default", None), ("IEEE", ieee)):
        seen = []
        NS["_po_close"] = lambda fig: seen.append(fig)
        if style:
            NS["GRAPH_STYLE"] = style
        try:
            NS["plot_series"]([near, Series(near.t, [v + 0.1 for v in near.y], "Bus 2 m:fehz", "Hz")],
                              title="mark " + name, ylabel="Frequency", marks=[nn],
                              limits=[(round(nn.value - 0.06, 3), "UFLS")])
        finally:
            NS["_po_close"] = real_close
            NS.pop("GRAPH_STYLE", None)
        fig = seen[0] if seen else None
        if fig is None:
            check(f"mark label ({name}): graph drawn", False)
            continue
        ax = fig.axes[0]
        r = fig.canvas.get_renderer()
        lab = [t for t in ax.texts if t.get_text().startswith("Nadir")]
        check(f"mark label ({name}): written once", len(lab) == 1, str([t.get_text() for t in ax.texts]))
        if lab:
            bb = lab[0].get_window_extent(r)
            fr = ax.get_window_extent(r)
            ly = ax.transData.transform((0, nn.value - 0.06))[1]
            check(f"mark label ({name}): clear of the limit line", not (bb.y0 - 1 <= ly <= bb.y1 + 1), f"{bb} line at {ly}")
            check(f"mark label ({name}): inside the plot", bb.x0 >= fr.x0 and bb.x1 <= fr.x1 and bb.y0 >= fr.y0 and bb.y1 <= fr.y1,
                  f"{bb} in {fr}")
            for ln in ax.get_lines()[:2]:
                xy = ax.transData.transform(list(zip(ln.get_xdata(), ln.get_ydata())))
                hit = [(x, y) for x, y in xy if bb.x0 <= x <= bb.x1 and bb.y0 <= y <= bb.y1]
                check(f"mark label ({name}): clear of {ln.get_label()}", not hit, str(hit[:3]))
        styles = [str(ln.get_linestyle()) for ln in ax.get_lines()[:2]]
        check(f"line patterns ({name})", styles == (["-", "--"] if style else ["-", "-"]), str(styles))
        real_close(fig)
    # Inside a loop the file name carries the loop values; "every pass on one graph".
    for mw in (100, 200, 300):
        NS["ctx_push"]("Dispatch (MW)", mw, mw // 100, 3)
        NS["collect_series"]("freq", Series(f.t, [v - mw / 1000 for v in f.y], "Bus 1 m:fehz", "Hz", ev))
        if mw == 200:
            pp = NS["plot_series"](f, title="per pass")
            check("file name has the loop value", pp and "200" in os.path.basename(pp), str(pp))
        NS["ctx_pop"]()
    pc = NS["draw_collected"]("freq", title="Every pass", ylabel="Frequency", limits=[49.0])
    check("draw_collected writes a PNG", is_png(pc))
    check("collector emptied", NS["draw_collected"]("freq") is None)
    check("nothing collected: None", NS["draw_collected"]("never") is None)
    NS["ctx_push"]("Case", "A")
    NS["collect_series"]("multi", [f, f], ["one", "two"])
    NS["ctx_pop"]()
    check("collect several per pass", is_png(NS["draw_collected"]("multi")))

    x = [100, 200, 300, 400]
    check("plot_xy line", is_png(NS["plot_xy"](x, [59.5, 59.3, 59.1, 58.8], title="Nadir", xlabel="Dispatch",
                                               xunit="MW", ylabel="Nadir", yunit="Hz", limits=[59.0])))
    check("plot_xy scatter, two lines", is_png(NS["plot_xy"](x, [[1, 2, 3, 4], [2, 3, 1, 5]], labels=["a", "b"],
                                                             kind="scatter")))
    check("plot_xy bars on names", is_png(NS["plot_xy"](["Line 1", "Line 2", "Line 3"], [80.5, 95.2, 101.3],
                                                        kind="bar", ylabel="Loading", yunit="%", limits=[(100, "100 %")])))
    check("plot_xy grouped bars", is_png(NS["plot_xy"](x, {"Base": [1, 2, 3, 4], "N-1": [2, 3, 4, 5]}, kind="bar")))
    check("plot_xy dollar label", is_png(NS["plot_xy"](x, [1, 2, 3, 4], ylabel="Cost ($)")))
    check("plot_xy uneven lengths still draws", is_png(NS["plot_xy"]([1, 2, 3], [5, 6], title="uneven")))
    check("plot_xy empty: None", NS["plot_xy"]([], []) is None and NS["plot_xy"]([1, 2], [None, None]) is None)
    check("plot_xy no x", is_png(NS["plot_xy"](None, [3, 1, 2], title="no x")))

    gx, gy, gz = [], [], []
    for a in (1, 2, 3, 4):
        for b in (10, 20, 30):
            gx.append(a)
            gy.append(b)
            gz.append(a * a + b / 10)
    check("plot_3d surface", is_png(NS["plot_3d"](gx, gy, gz, title="Surface", xlabel="P", xunit="MW",
                                                  ylabel="Q", yunit="Mvar", zlabel="Loss", zunit="MW")))
    check("plot_3d wireframe", is_png(NS["plot_3d"](gx, gy, gz, kind="wireframe")))
    check("plot_3d not a grid: scatter", is_png(NS["plot_3d"](gx[:-1], gy[:-1], gz[:-1])))
    check("plot_3d rows", is_png(NS["plot_3d"]([1, 2, 3], [5, 6], [[1, 2, 3], [2, 3, 4]])))
    check("plot_3d empty: None", NS["plot_3d"]([], [], []) is None)
    check("plot_heatmap", is_png(NS["plot_heatmap"](gx, gy, gz, title="Heat", zlabel="Loss", zunit="MW")))
    check("plot_heatmap names", is_png(NS["plot_heatmap"](["a", "b", "a", "b"], ["x", "x", "y", "y"], [1, 2, 3, None])))
    check("plot_heatmap rows", is_png(NS["plot_heatmap"](["c1", "c2"], ["r1", "r2"], [[1, 2], [3, 4]])))
    check("plot_heatmap empty: None", NS["plot_heatmap"]([], [], []) is None)

    t = NS["table"]("Plot test")
    for case in ("Low", "High"):
        for mw in (100, 200, 300):
            t.add({"Case": case, "Dispatch (MW)": mw, "Nadir (Hz)": 59.6 - mw / 1000 - (0.1 if case == "High" else 0),
                   "RoCoF (Hz/s)": -0.1 * mw / 100}, with_ctx=False)
    t.add({"Case": "High", "Dispatch (MW)": 400, "Status": "Load flow did not converge"}, with_ctx=False)
    check("plot_table grouped", is_png(NS["plot_table"]("Plot test", "Dispatch (MW)", "Nadir (Hz)", group="Case")))
    check("plot_table two columns", is_png(NS["plot_table"]("Plot test", "Dispatch (MW)", ["Nadir (Hz)", "RoCoF (Hz/s)"])))
    check("plot_table bars", is_png(NS["plot_table"]("Plot test", "Case", "Nadir (Hz)", kind="bar")))
    check("plot_table missing table: None", NS["plot_table"]("No such table", "x", "y") is None)
    check("plot_table did not create a table", "No such table" not in NS["_TABLES"])

    # Convergence curves from real searches.
    o = NS["optimise"](lambda x: Trial({"x": x}).report(score=(x - 2) ** 2) if x < 4 else Trial({"x": x}).report(ok=False),
                       [{"name": "x", "lower": 0, "upper": 5}], method="grid", grid_steps=11, max_tries=11, label="conv opt")
    check("plot_convergence optimise", is_png(NS["plot_convergence"](o)))
    check("plot_convergence optimise from history", is_png(NS["plot_convergence"](o.history, "optimise")))
    lim = NS["find_limit"](lambda v: Trial({"v": v}).report(ok=v <= 43.0), 0, 100, 1.0, label="conv lim")
    check("plot_convergence limit", is_png(NS["plot_convergence"](lim, ylabel="Dispatch", unit="MW")))
    check("plot_convergence empty: None", NS["plot_convergence"]([]) is None)

    c1 = NS["save_series_csv"]([f, Series(f.t, f.y, "Bus 2 m:fehz", "Hz")], stem="freq")
    with open(c1, encoding="utf-8-sig", newline="") as fh:
        rows = list(csv.reader(fh))
    check("CSV same base: header", rows[0] == ["Time (s)", "Bus 1 m:fehz (Hz)", "Bus 2 m:fehz (Hz)"], str(rows[0]))
    check("CSV same base: rows", len(rows) == len(f) + 1 and float(rows[1][0]) == 0.0)
    check("CSV in the series folder", os.path.basename(os.path.dirname(c1)) == "series")
    c2 = NS["save_series_csv"]([f, Series([0, 1], [1, 2], "short", "MW")])
    with open(c2, encoding="utf-8-sig", newline="") as fh:
        rows2 = list(csv.reader(fh))
    check("CSV different bases: paired columns", len(rows2[0]) == 4 and len(rows2) == len(f) + 1 and rows2[3][2] == "")
    check("CSV empty: None", NS["save_series_csv"]([]) is None)


# ------------------------------------------------------------------------------------------
# optimise.py

def quad_try(x, y):
    t = Trial({"x": x, "y": y}, "min")
    return t.report(score=(x - 3) ** 2 + (y + 1) ** 2 + 2)


def test_optimise():
    section("optimise")
    opt = NS["optimise"]
    var2 = [{"name": "x", "lower": -5, "upper": 5}, {"name": "y", "lower": -5, "upper": 5}]
    cases = [("de", 150, 0.15), ("nelder", 120, 0.05), ("powell", 200, 0.05), ("bayes", 40, 0.35), ("grid", 121, 1e-9)]
    for method, tries, tol in cases:
        r = opt(quad_try, var2, method=method, max_tries=tries, grid_steps=11, label=f"quad {method}")
        ok = r.found and near(r.best["x"], 3, tol) and near(r.best["y"], -1, tol) and near(r.best_score, 2, 2 * tol * tol + 1e-6)
        check(f"{method}: finds the quadratic minimum", ok, f"{r.best} {r.best_score} {r.message}")
        check(f"{method}: tries within max tries", 0 < r.tries <= tries and len(r.history) == r.tries, f"{r.tries}")
        check(f"{method}: method used", r.method == method, r.method)
        bests = [h["best"] for h in r.history if h["best"] is not None]
        check(f"{method}: best so far never gets worse", all(b2 <= b1 + 1e-12 for b1, b2 in zip(bests, bests[1:])))
    rb = opt(lambda x: Trial({"x": x}).report(score=(x - 3.3) ** 2), [{"name": "x", "lower": 0, "upper": 10}],
             method="bounded", max_tries=40)
    check("bounded: one variable", rb.method == "bounded" and near(rb.best["x"], 3.3, 1e-3), f"{rb.best}")
    rb2 = opt(quad_try, var2, method="bounded", max_tries=60)
    check("bounded with two variables uses Nelder-Mead", rb2.method == "nelder")
    ri = opt(lambda n: Trial({"n": n}).report(score=(n - 7.3) ** 2), [{"name": "n", "lower": 0, "upper": 20, "integer": True}],
             method="de", max_tries=40)
    check("integer variable", ri.best["n"] == 7 and isinstance(ri.best["n"], int), f"{ri.best}")
    check("integer: no value tried twice", len({h["values"]["n"] for h in ri.history}) == len(ri.history))
    ri2 = opt(lambda n: Trial({"n": n}).report(score=(n - 7.3) ** 2), [{"name": "n", "lower": 0.5, "upper": 20.4, "integer": True}],
              method="grid", grid_steps=21, max_tries=40)
    check("integer grid inside the bounds", min(h["values"]["n"] for h in ri2.history) == 1
          and max(h["values"]["n"] for h in ri2.history) == 20 and ri2.best["n"] == 7)
    h0 = ri.history[0]
    check("history entry fields", all(k in h0 for k in ("try", "values", "score", "ok", "failed", "candidate", "best", "note")))
    rmax = opt(lambda x: Trial({"x": x}, "max").report(score=10 - (x - 2) ** 2), [{"name": "x", "lower": -5, "upper": 5}],
               goal="max", method="nelder", max_tries=60)
    check("maximise", near(rmax.best["x"], 2, 0.01) and near(rmax.best_score, 10, 1e-3) and rmax.best_score > 0, f"{rmax}")
    check("maximise: history scores as reported", all(h["score"] <= 10 + 1e-9 for h in rmax.history) and rmax.goal == "max")
    calls = []

    def flaky(x, y):
        calls.append((x, y))
        if x > 4:
            raise RuntimeError("PowerFactory said no")
        if y > 3:
            t = Trial({"x": x, "y": y})
            t.failed = True
            return t
        return quad_try(x, y)
    rf = opt(flaky, var2, method="grid", grid_steps=11, max_tries=121)
    fails = [h for h in rf.history if not h["candidate"]]
    # x = 5 raises (11 points); y = 4 or 5 is marked failed for the other 10 x values (20 points).
    check("failing tries are not candidates", len(fails) == 31, str(len(fails)))
    check("failing tries do not stop the search", rf.tries == 121 and near(rf.best["x"], 3, 1e-9))
    check("an uncaught error counts as failed", any("PowerFactory said no" in h["note"] for h in rf.history))
    rok = opt(lambda x: Trial({"x": x}).report(score=x, ok=x >= 2), [{"name": "x", "lower": 0, "upper": 5}],
              method="grid", grid_steps=11, max_tries=11)
    check("ok False is not a candidate", rok.best["x"] == 2.0, f"{rok.best}")
    rnone = opt(lambda x: Trial({"x": x}).report(ok=True), [{"name": "x", "lower": 0, "upper": 1}], method="grid", max_tries=5)
    check("no score: no candidate", rnone.found is False and rnone.best is None and rnone.status == "NO CANDIDATE")

    def stopper(x):
        t = Trial({"x": x}).report(score=x * x)
        if len(stopper.calls) == 2:
            t.stop_search()
        stopper.calls.append(x)
        return t
    stopper.calls = []
    rs = opt(stopper, [{"name": "x", "lower": -1, "upper": 1}], method="de", max_tries=30)
    check("stop early", rs.tries == 3 and rs.status == "STOPPED", f"{rs.tries} {rs.status}")

    def boom(x):
        raise NS["StopWorkflow"]("stop now")
    try:
        opt(boom, [{"name": "x", "lower": 0, "upper": 1}], method="de", max_tries=5)
        check("StopWorkflow re-raised", False)
    except NS["StopWorkflow"]:
        check("StopWorkflow re-raised", True)

    def ki(x):
        raise KeyboardInterrupt()
    try:
        opt(ki, [{"name": "x", "lower": 0, "upper": 1}], method="nelder", max_tries=5)
        check("KeyboardInterrupt re-raised", False)
    except KeyboardInterrupt:
        check("KeyboardInterrupt re-raised", True)
    real = NS["_op_skopt"]
    NS["_op_skopt"] = lambda: None
    try:
        rfb = opt(quad_try, var2, method="bayes", max_tries=60)
    finally:
        NS["_op_skopt"] = real
    check("bayes falls back to de", rfb.method == "de" and rfb.found)
    a1 = opt(quad_try, var2, method="de", max_tries=40, seed=7)
    a2 = opt(quad_try, var2, method="de", max_tries=40, seed=7)
    check("same seed, same search", [h["values"] for h in a1.history] == [h["values"] for h in a2.history])
    check("no variables", opt(quad_try, [], max_tries=5).found is False)
    big = opt(quad_try, var2, method="grid", grid_steps=11, max_tries=30)
    check("grid larger than max tries is cut down", big.tries <= 30 and big.found)
    check("result keys", big["best_score"] == big.best_score and "history" in big.keys())
    check("plain numbers returned by fn are scores", opt(lambda x: (x - 1) ** 2, [{"name": "x", "lower": 0, "upper": 2}],
                                                       method="grid", grid_steps=5, max_tries=5).best["x"] == 1.0)


def test_find_limit():
    section("find_limit")
    fl = NS["find_limit"]

    def below(th, record=None):
        def fn(v):
            if record is not None:
                record.append(v)
            return Trial({"v": v}).report(ok=v <= th)
        return fn

    def above(th, record=None):
        def fn(v):
            if record is not None:
                record.append(v)
            return Trial({"v": v}).report(ok=v >= th)
        return fn
    r = fl(below(431.3), 0, 1000, 1.0, label="Dispatch (MW)")
    check("passes low: DONE", r.status == "DONE" and r.found, repr(r))
    check("passes low: limit within tol", 430.3 < r.limit <= 431.3 and r.failing - r.passing <= 1.0, f"{r.limit} {r.failing}")
    check("passes low: both bounds first", [h["value"] for h in r.history[:2]] == [0.0, 1000.0])
    check("limit is a tried passing value", any(h["value"] == r.limit and h["result"] == "pass" for h in r.history))
    rh = fl(above(37.2), 0, 100, 0.5, passes="high")
    check("passes high: DONE", rh.status == "DONE" and 37.2 <= rh.limit < 37.7 and rh.failing < 37.2, repr(rh))
    tried = []
    rv = fl(above(37.2, tried), 0, 100, 0.5, passes="high", bracket="halve")
    check("halve: DONE", rv.status == "DONE" and 37.2 <= rv.limit < 37.7, repr(rv))
    check("halve: starts at the passing bound and never tries the other", tried[0] == 100 and 0 not in tried, str(tried))
    check("halve: halves towards the failing side", tried[1] == 50.0 and tried[2] == 25.0, str(tried))
    tried2 = []
    rv2 = fl(below(812.0, tried2), 0, 1000, 2.0, passes="low", bracket="halve")
    check("halve, passes low", rv2.status == "DONE" and 810.0 < rv2.limit <= 812.0 and tried2[0] == 0, repr(rv2))
    ap = fl(below(5000), 0, 1000, 1.0)
    check("ALL PASS", ap.status == "ALL PASS" and ap.limit == 1000 and ap.found is False and ap.steps == 2, repr(ap))
    aph = fl(below(5000), 0, 1000, 10.0, bracket="halve")
    check("ALL PASS when halving", aph.status == "ALL PASS" and aph.limit >= 990 and aph.found is False, repr(aph))
    af = fl(below(-5), 0, 1000, 1.0)
    check("ALL FAIL", af.status == "ALL FAIL" and af.limit is None and af.found is False, repr(af))
    check("ALL FAIL when halving", fl(below(-5), 0, 1000, 1.0, bracket="halve").status == "ALL FAIL")
    inc = fl(above(300), 0, 1000, 1.0, passes="low")
    check("INCONSISTENT", inc.status == "INCONSISTENT" and inc.found is False, repr(inc))

    def gappy(v):
        t = Trial({"v": v})
        if 400 <= v <= 600:
            return t                       # nothing reported: unknown
        return t.report(ok=v <= 431.3)
    u = fl(gappy, 0, 1000, 1.0)
    check("UNKNOWN stops", u.status == "UNKNOWN" and u.steps == 3 and u.history[-1]["result"] == "unknown", repr(u))
    uf = fl(gappy, 0, 1000, 1.0, on_unknown="fail")
    check("unknown counted as fail", uf.status == "DONE" and uf.limit < 400 and uf.history[2]["counted"] == "fail", repr(uf))
    up = fl(gappy, 0, 1000, 1.0, on_unknown="pass")
    check("unknown counted as pass", up.status == "DONE" and 599 < up.limit <= 600, repr(up))
    ub = fl(lambda v: Trial({"v": v}).report(ok="UNDEFINED") if v == 0 else Trial({"v": v}).report(ok=False), 0, 10, 1)
    check("unknown on a bound", ub.status == "UNKNOWN" and ub.steps == 1)
    ms = fl(below(431.3), 0, 1000, 1e-9, max_steps=6)
    check("MAX STEPS", ms.status == "MAX STEPS" and ms.steps == 6 and ms.limit is not None, repr(ms))

    def stop3(v):
        stop3.n += 1
        t = Trial({"v": v}).report(ok=v <= 431.3)
        return t.stop_search() if stop3.n == 3 else t
    stop3.n = 0
    so = fl(stop3, 0, 1000, 1.0)
    check("STOPPED", so.status == "STOPPED" and so.steps == 3, repr(so))
    ri = fl(below(12.5), 0, 40, 1, integer=True)
    check("integer limit", ri.status == "DONE" and ri.limit == 12 and ri.failing == 13 and isinstance(ri.limit, int), repr(ri))

    def err(v):
        if v > 500:
            raise RuntimeError("diverged")
        return Trial({"v": v}).report(ok=True)
    re_ = fl(err, 0, 1000, 1.0)
    check("an error is unknown", re_.status == "UNKNOWN" and "diverged" in re_.history[-1]["note"], repr(re_))
    sw = fl(lambda v: Trial({"v": v}).report(ok=v < 3), 10, 0, 0.5)
    check("bounds swapped", sw.status == "DONE" and 2.5 <= sw.limit < 3)
    check("no bounds", fl(below(1), None, 10, 1).status == "UNKNOWN")
    hist = r.history
    check("history fields", all(k in hist[0] for k in ("step", "value", "result", "counted", "ok", "score",
                                                       "passing", "failing", "note")))
    check("bracket narrows", all((h2["failing"] - h2["passing"]) <= (h1["failing"] - h1["passing"])
                                 for h1, h2 in zip(hist[1:], hist[2:])))
    try:
        fl(lambda v: (_ for _ in ()).throw(NS["StopWorkflow"]("halt")), 0, 1, 0.1)
        check("StopWorkflow re-raised by find_limit", False)
    except NS["StopWorkflow"]:
        check("StopWorkflow re-raised by find_limit", True)


# ------------------------------------------------------------------------------------------
# Real traces written by the pf-runtime live tests (skipped when they are missing)

def test_real_traces():
    path39 = os.path.join(FIXTURES, "39bus_G10_trip_fehz.csv")
    path9 = os.path.join(FIXTURES, "nine_bus_fault_u1.csv")
    if os.path.exists(path39):
        section("real trace: 39-bus G 10 trip")
        t, f = read_fixture("39bus_G10_trip_fehz.csv")
        s = Series(t, f, "Bus 16 m:fehz", "Hz", [(1.0, "G 10 trip")])
        n = NS["nadir"](s, nominal=60)
        check("39-bus: minimum at the end of the run", near(n.min_time, 60.0, 1e-9) and near(n.minimum, 59.4517, 1e-4), repr(n))
        check("39-bus: still falling, COLLAPSE", n.verdict == "COLLAPSE" and n.still_falling is True)
        check("39-bus: UFLS UNDEFINED (above 59 Hz, cut off)", n.ufls == "UNDEFINED")
        check("39-bus: extended to the horizon gives FALSE", NS["nadir"](s, nominal=60, extend_to=60).ufls == "FALSE")
        r = NS["rocof"](s, verdict=n, nominal=60)
        check("39-bus: RoCoF on the window fallback", r.basis == "window" and r.value < 0 and r.t1 >= 1.0 and r.t2 <= 11.0, repr(r))
        avg = (NS["value_at"](s, 11.0) - 60.0) / 10.0
        check("39-bus: steepest window steeper than the average", r.value < avg)
        check("39-bus: no spikes in an RMS trace", NS["despike"](s).n == 0)
        st = NS["settling"](s, band=0.01, band_mode="abs", hold=1.0)
        check("39-bus: within 10 mHz of final after about 29.4 s", st.settles is True and 28.5 < st.at < 30.5, repr(st))
        check("39-bus: graph with the minimum marked", is_png(NS["plot_series"](s, title="39-bus G 10 trip", ylabel="Frequency",
                                                                              limits=[(59.0, "UFLS 59 Hz")], marks=[n])))
    else:
        print("   (39-bus fixture missing: skipped)")
    if os.path.exists(path9):
        section("real trace: Nine-bus fault")
        t, u = read_fixture("nine_bus_fault_u1.csv")
        s = Series(t, u, "Bus 7 m:u1", "p.u.", [(1.0, "fault"), (1.1, "clear")])
        c = NS["first_cross"](s, 0.9, "above", after=1.1, hold=0.1)
        check("Nine-bus: voltage back above 0.9 p.u. after clearing", c.found and 1.1 < c.time < 2.0, repr(c))
        lvrt = [(0.0, 0.0, None), (0.15, 0.0, None), (0.15, 0.7, None), (1.5, 0.9, None)]
        lc = NS["check_limits"](s, curve=lvrt, x0=1.0, after=1.0)
        check("Nine-bus: LVRT curve passes", lc.ok is True and lc.margin >= 0, repr(lc))
        # The pre-fault voltage of the plain Nine-bus case 03 (the fixture is recorded by
        # live_tests.py from that case with nothing else connected).
        check("Nine-bus: value before the fault", near(NS["value_at"](s, 0.5), 1.025769, 1e-5))
        dp = NS["despike"](s)
        check("Nine-bus: spike runs reported once", all(b.t_start > a.t_end for a, b in zip(dp.spikes, dp.spikes[1:])), str(dp.spikes))
        check("Nine-bus: CSV of the trace", NS["save_series_csv"](s, stem="nine_bus_u1") is not None)
    else:
        print("   (Nine-bus fixture missing: skipped)")


SCRIPT_MAIN = """
OUTPUT_DIR = {out!r}
WORKFLOW_NAME = "standalone"
F_NOMINAL = 50


def trace(mw):
    # A frequency dip whose depth grows with the dispatch tripped (synthetic).
    t = [round(i * 0.01, 10) for i in range(2001)]
    depth = mw / 400.0
    f = [50.0 if x <= 1 else 50.0 - depth * min(1.0, (x - 1) / 2) + 0.3 * depth * max(0.0, min(1.0, (x - 3) / 5)) for x in t]
    return Series(t, f, "Bus 1 m:fehz", "Hz", [(1.0, "trip")])


def try_n5(dispatch):
    trial = Trial({{"Dispatch (MW)": dispatch}}, "min")
    ctx_push("Find limit", dispatch)
    try:
        nadir_n9 = nadir(trace(dispatch))
        trial.report(ok=nadir_n9.ufls == "FALSE")
    except StopWorkflow:
        raise
    except Exception as err_n5:
        case_failed(err_n5, trial)
    finally:
        ctx_pop([])
    return trial


def main():
    for i, mw in enumerate([100, 200, 300], 1):
        ctx_push("Dispatch (MW)", mw, i, 3)
        try:
            n = nadir(trace(mw))
            table("Results").add({{"Nadir (Hz)": n.value, "UFLS": n.ufls, "RoCoF (Hz/s)": rocof(trace(mw), verdict=n).value}})
            collect_series("plot_n7", trace(mw))
        finally:
            ctx_pop(["Results"])
    draw_collected("plot_n7", title="Every pass")
    plot_table("Results", "Dispatch (MW)", "Nadir (Hz)")
    search_n5 = find_limit(try_n5, 0, 1000, 1.0, label="Dispatch (MW)")
    plot_convergence(search_n5, ylabel="Dispatch", unit="MW")
    best = optimise(lambda x: Trial({{"x": x}}).report(score=(x - 2) ** 2), [{{"name": "x", "lower": 0, "upper": 5}}],
                    method="nelder", max_tries=40)
    print("RESULT", search_n5.status, search_n5.limit, round(best.best["x"], 3), stat("mean", table("Results").column("Nadir (Hz)")))
    flush_tables()


if __name__ == "__main__":
    main()
"""


def test_standalone_script():
    section("standalone script (helpers copied in, as the Builder does)")
    import subprocess
    names = ["nadir", "rocof", "collect_series", "plot_table", "find_limit", "plot_convergence", "optimise",
             "stat", "table", "case_failed", "Series"]
    code = loader.build(names, LIB)
    out = os.path.join(OUT, "standalone")
    os.makedirs(out, exist_ok=True)
    body = SCRIPT_MAIN.format(out=out)
    # Imports and helpers, then the settings and main(): the helpers read the settings only
    # when they are called, so their place in the file does not matter.
    path = os.path.join(out, "standalone_test.py")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(code)
        fh.write(body)
    proc = subprocess.run([sys.executable, "-I", path], capture_output=True, text=True, timeout=300)
    lines = [l for l in proc.stdout.splitlines() if l.startswith("RESULT")]
    check("standalone script runs", proc.returncode == 0, proc.stderr[-800:])
    if lines:
        parts = lines[0].split()
        check("standalone: find limit DONE", parts[1] == "DONE", lines[0])
        check("standalone: limit just under 400 MW", 399.0 <= float(parts[2]) <= 400.0, lines[0])
        check("standalone: optimise", parts[3] == "2.0", lines[0])
    else:
        check("standalone: result line", False, proc.stdout[-800:])
    graphs = []
    for root, _, files in os.walk(out):
        graphs += [f for f in files if f.endswith(".png")]
    check("standalone: three graphs", len(graphs) == 3, str(graphs))
    csvs = []
    for root, _, files in os.walk(out):
        csvs += [os.path.join(root, f) for f in files if f.endswith(".csv")]
    check("standalone: table saved at the end", len(csvs) == 1, str(csvs))


def main():
    tests = [test_static, test_stat, test_despike, test_nadir, test_settling, test_rocof, test_values,
             test_limits, test_plots, test_optimise, test_find_limit, test_real_traces, test_standalone_script]
    for t in tests:
        try:
            t()
        except Exception:
            RESULTS["fail"] += 1
            print(f"FAIL {t.__name__} raised:")
            traceback.print_exc()
    print(f"analysis runtime tests: {RESULTS['pass']} passed, {RESULTS['fail']} failed")
    fh = NS.get("_LOG", {}).get("fh")
    if fh:
        fh.close()
    if RESULTS["fail"] == 0 and not os.environ.get("PFB_TEST_TMP"):
        shutil.rmtree(OUT, ignore_errors=True)
    else:
        print(f"output kept in {OUT}")
    return 1 if RESULTS["fail"] else 0


if __name__ == "__main__":
    sys.exit(main())
