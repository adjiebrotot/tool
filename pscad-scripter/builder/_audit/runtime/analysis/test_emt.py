"""The EMT checks, against signals whose answer is known exactly.

    python pscad-scripter/builder/_audit/runtime/analysis/test_emt.py

No PSCAD and no engine: each test builds a waveform whose RMS, harmonic content, sequence,
overshoot or damping can be worked out on paper, and checks the helper agrees. That is the
only honest way to test a signal check, since a result read out of a simulation has no known
right answer to compare with.
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.normpath(os.path.join(HERE, "..", "live")))

import loader                                                        # noqa: E402

PASSED = []
FAILED = []


_NOTHING = object()


def check(label, got, want=_NOTHING, near=None):
    """With no `want` the value only has to be truthy; want=None checks for None."""
    if want is _NOTHING:
        ok = bool(got)
        detail = repr(got)
    elif want is None:
        ok = got is None
        detail = repr(got)
    elif near is not None:
        ok = got is not None and abs(float(got) - float(want)) <= near
        detail = "%r vs %r (tolerance %g)" % (got, want, near)
    else:
        ok = got == want
        detail = "%r vs %r" % (got, want)
    (PASSED if ok else FAILED).append(label)
    print("  %s %s%s" % ("ok  " if ok else "FAIL", label, "" if ok else "   " + detail))
    return ok


# The signal checks live in signals.py, which is not in the loader's default file list.
LIB = loader.parse(loader.FILES)
NS = loader.load(["window_rms", "spectrum", "sequence", "overshoot", "damping", "Series",
                  "stat", "convert", "log", "run_dir"],
                 {"F_NOMINAL": 50, "RUN_NAME": "emt", "OUT_DIR": os.path.join(HERE, "_out"),
                  "WORKFLOW_NAME": "emt checks"}, LIB)
Series = NS["Series"]


def wave(f=50.0, amp=1.0, phase=0.0, seconds=0.2, step=1e-5, dc=0.0, harmonics=()):
    """A sampled sine, optionally with harmonics as [(order, amplitude, phase)]."""
    n = int(round(seconds / step))
    t, y = [], []
    for i in range(n + 1):
        tt = i * step
        v = dc + amp * math.sin(2 * math.pi * f * tt + phase)
        for order, a2, p2 in harmonics:
            v += a2 * math.sin(2 * math.pi * f * order * tt + p2)
        t.append(tt)
        y.append(v)
    return Series(t, y, "test", "kV")


print("\nwindow_rms")
# The RMS of a sine of amplitude 1 is 1/sqrt(2), whatever its frequency.
r = NS["window_rms"](wave(amp=2.0), frequency=50.0, cycles=1.0)
check("a 2.0 amplitude sine is 1.4142 rms", r.y[-1], 2.0 / math.sqrt(2), near=1e-3)
check("it starts one window in", r.t[0], 0.02, near=5e-4)
check("it ends with the signal", r.t[-1], 0.2, near=1e-9)
check("the label says what it is", "RMS" in r.label, True)
check("the unit travels", r.unit, "kV")
r60 = NS["window_rms"](wave(f=60.0, amp=1.0, seconds=0.2), frequency=60.0)
check("60 Hz works the same", r60.y[-1], 1 / math.sqrt(2), near=1e-3)
check("an empty series gives an empty one", len(NS["window_rms"](Series([], []))), 0)

print("\nspectrum and thd")
# A fundamental of 1.0 with a 5th harmonic of 0.1 has a THD of exactly 10 %.
s = wave(amp=1.0, harmonics=[(5, 0.1, 0.0)])
sp = NS["spectrum"](s, frequency=50.0, cycles=1.0)
check("the fundamental is 1.0", sp.fundamental, 1.0, near=2e-3)
check("the 5th is 10 % of it", sp.pct[4], 10.0, near=0.2)
check("the 3rd is nothing", sp.pct[2], 0.0, near=0.2)
t = NS["thd"](s, frequency=50.0, cycles=1.0)
check("THD is 10 %", t.value, 10.0, near=0.2)
check("the worst harmonic is the 5th", t.worst_order, 5)
check("and it is 10 %", t.worst, 10.0, near=0.2)
# Two harmonics add in quadrature: sqrt(0.1^2 + 0.08^2) = 12.806 %.
s2 = wave(amp=1.0, harmonics=[(5, 0.1, 0.0), (7, 0.08, 0.3)])
check("two harmonics add in quadrature", NS["thd"](s2, frequency=50.0).value,
      100 * math.sqrt(0.01 + 0.0064), near=0.3)
# A pure sine has no distortion at all.
check("a pure sine has no THD", NS["thd"](wave(), frequency=50.0).value, 0.0, near=0.15)
# DC is left out unless it is asked for.
sdc = wave(amp=1.0, dc=0.2)
check("DC is out by default", NS["thd"](sdc, frequency=50.0).value, 0.0, near=0.2)
check("DC counts when asked", NS["thd"](sdc, frequency=50.0, include_dc=True).value,
      20.0, near=0.5)
check("too short a window says so", NS["thd"](Series([0, 1], [0, 1]), frequency=50.0).value,
      None)

print("\nsequence")
# A balanced positive-sequence set: positive = the amplitude, negative and zero = 0.
a = wave(amp=1.0, phase=0.0)
b = wave(amp=1.0, phase=-2 * math.pi / 3)
c = wave(amp=1.0, phase=2 * math.pi / 3)
pos = NS["sequence"](a, b, c, frequency=50.0, which="positive")
neg = NS["sequence"](a, b, c, frequency=50.0, which="negative")
zero = NS["sequence"](a, b, c, frequency=50.0, which="zero")
check("positive sequence is the amplitude", pos.y[-1], 1.0, near=5e-3)
check("negative sequence is nothing", neg.y[-1], 0.0, near=5e-3)
check("zero sequence is nothing", zero.y[-1], 0.0, near=5e-3)
# Swapping two phases turns a positive-sequence set into a negative-sequence one.
negpos = NS["sequence"](a, c, b, frequency=50.0, which="negative")
check("swapping two phases makes it negative sequence", negpos.y[-1], 1.0, near=5e-3)
# One phase at a different size: 2 % unbalance by the sequence definition.
b2 = wave(amp=0.94, phase=-2 * math.pi / 3)
u = NS["unbalance"](a, b2, c, frequency=50.0)
check("an unbalanced set has a factor", u.value > 1.5 and u.value < 2.5, True)

print("\novershoot")
# A second-order step with zeta = 0.3 overshoots by exp(-pi*z/sqrt(1-z^2)) = 37.2 %.
z, wn = 0.3, 2 * math.pi * 2.0
wd = wn * math.sqrt(1 - z * z)
t0 = 0.5
tt, yy = [], []
for i in range(4001):
    x = i * 0.001
    if x < t0:
        yy.append(0.0)
    else:
        d = x - t0
        yy.append(1 - math.exp(-z * wn * d) * (math.cos(wd * d) + z / math.sqrt(1 - z * z) * math.sin(wd * d)))
    tt.append(x)
step = Series(tt, yy, "step", "pu")
o = NS["overshoot"](step, t_event=t0)
want = 100 * math.exp(-math.pi * z / math.sqrt(1 - z * z))
check("overshoot matches the textbook", o.value, want, near=1.0)
check("it starts at zero", o.initial, 0.0, near=1e-6)
check("it settles at one", o.final, 1.0, near=0.02)
check("the peak is at the first crest", o.time, t0 + math.pi / wd, near=0.01)
check("the rise time is measured", o.rise is not None and 0 < o.rise < 0.2, True)
# A flat signal has no step and says so rather than dividing by zero.
flat = Series([0, 1, 2], [1, 1, 1], "flat")
check("a flat signal has no overshoot", NS["overshoot"](flat, t_event=0).value, None)

print("\ndamping")
# A decaying sinusoid with a known damping ratio.
for want_z in (0.02, 0.05, 0.1):
    f0 = 1.5
    w = 2 * math.pi * f0
    tt, yy = [], []
    for i in range(6001):
        x = i * 0.002
        yy.append(math.exp(-want_z * w * x) * math.sin(w * x))
    tt = [i * 0.002 for i in range(6001)]
    d = NS["damping"](Series(tt, yy, "ringdown"))
    check("damping ratio %.2f is found" % want_z, d.value, want_z, near=0.012)
    check("  its frequency is found", d.frequency, f0, near=0.05)
    check("  it reads as stable", d.stable, True)
# A growing oscillation is the one a stability review is looking for.
tt = [i * 0.002 for i in range(6001)]
yy = [math.exp(0.05 * 2 * math.pi * 1.5 * t) * math.sin(2 * math.pi * 1.5 * t) for t in tt]
g = NS["damping"](Series(tt, yy, "growing"))
check("a growing oscillation has a negative ratio", g.value < 0, True)
check("and reads as not stable", g.stable, False)
# Something that is not oscillating says so instead of inventing a number.
quiet = Series([i * 0.01 for i in range(200)], [1.0] * 200, "flat")
q = NS["damping"](quiet)
check("a flat signal gives no ratio", q.value, None)
check("and says why", "not be oscillating" in (q.reason or ""), True)

print("\n%d ok, %d failed" % (len(PASSED), len(FAILED)))
for f in FAILED:
    print("  FAIL " + f)
sys.exit(1 if FAILED else 0)
