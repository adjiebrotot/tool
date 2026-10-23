# TEST-ONLY runtime sections for the analysis blocks tests (never part of the Builder runtime).
# Same @helper format as builder/runtime/*.py; the fixture blocks in fixture-blocks.js ask for
# them. They stand in for a simulation: a recorded trace read from a CSV, or a synthetic
# frequency dip whose depth grows with the power tripped.

# @helper fixture_series
# @needs Series
# @imports import csv
def fixture_series(path, label="", unit="", events=None):
    """TEST ONLY: a Series from a two-column CSV (t, y) such as the traces the pf-runtime live
    tests wrote; events as [(t, label)]."""
    with open(path, newline="") as fh:
        rows = list(csv.reader(fh))[1:]
    return Series([float(a) for a, _ in rows], [float(b) for _, b in rows], label, unit, events or [])
# @end

# @helper synth_freq
# @needs Series, convert
# @imports import math
def synth_freq(mw, nominal=60.0, t_event=1.0, t_end=20.0, label="Bus 1 m:fehz"):
    """TEST ONLY: a frequency dip after a trip at t_event: d = 0.3 Hz per 100 MW, the nadir about
    1.17 d below nominal at t_event + 2 s, then it recovers to 0.2 d below nominal."""
    d = 0.003 * (as_float(mw, 0.0) or 0.0)
    ts, ys = [], []
    n = int(round((t_end + 0.1) / 0.01))
    for i in range(n + 1):
        t = round(-0.1 + i * 0.01, 6)
        x = t - t_event
        f = nominal if x <= 0 else nominal - d * (x / 2.0) * math.exp(1.0 - x / 2.0) - 0.2 * d * (1.0 - math.exp(-x))
        ts.append(t)
        ys.append(f)
    return Series(ts, ys, label, "Hz", [(t_event, "trip")])
# @end

# @helper empty_series
# @needs Series
def empty_series(label="Bus 1 m:fehz"):
    """TEST ONLY: a Series with no samples (a run that recorded nothing)."""
    return Series([], [], label, "Hz", [])
# @end
