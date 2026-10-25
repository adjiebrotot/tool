"""RMS simulations in PowerFactory with Python: run one fault with several clearing times,
record the rotor angle of every generator, and plot all the runs on one graph.

Runs on the "39 Bus New England System" example project that comes with PowerFactory 2024.
"""
import csv
import sys

sys.path.append(r"C:\Program Files\DIgSILENT\PowerFactory 2024\Python\3.12")
import powerfactory

PROJECT = "39 Bus New England System"
STUDY_CASE = "2.3 Simulation Fault Bus 31 Stable"   # a bolted fault at Bus 31 at 0 s
CLEARING_TIMES = [0.10, 0.15, 0.20, 0.25]           # s
T_STOP = 5.0                                         # s

app = powerfactory.GetApplicationExt()               # inside PowerFactory: powerfactory.GetApplication()
app.ActivateProject(PROJECT)
case = app.GetProjectFolder("study").GetContents(STUDY_CASE + ".IntCase")[0]
case.Activate()

inc = app.GetFromStudyCase("ComInc")                 # initial conditions
sim = app.GetFromStudyCase("ComSim")                 # run simulation
clearing = inc.GetAttribute("p_event").GetContents("Short-Circuit Clearance.EvtShc")[0]
gens = app.GetCalcRelevantObjects("*.ElmSym")

# A results object of our own that records the rotor angle of every generator.
res = case.CreateObject("ElmRes", "Rotor angles")
for g in gens:
    res.AddVariable(g, "c:firel")                    # rotor angle to the reference machine, deg

app.SetAttributeModeInternal(1)                      # times in seconds, whatever the project shows
saved = (inc.GetAttribute("p_resvar"), inc.GetAttribute("iopt_sim"), sim.GetAttribute("tstop"), clearing.GetAttribute("time"))
inc.SetAttribute("p_resvar", res)
inc.SetAttribute("iopt_sim", "rms")                  # "ins" runs an EMT simulation instead
sim.SetAttribute("tstop", T_STOP)

runs = []
try:
    for tc in CLEARING_TIMES:
        clearing.SetAttribute("time", tc)            # move the case's own clearing event
        if inc.Execute() != 0:
            raise SystemExit("The initial conditions failed")
        sim.Execute()
        reached = sim.GetSimulationTime()            # less than T_STOP when the run stopped early

        res.Load()
        cols = [res.FindColumn(g, "c:firel") for g in gens]
        t, spread = [], []
        for row in range(res.GetNumberOfRows()):
            t.append(res.GetValue(row, -1)[1])       # column -1 is the time
            angles = [res.GetValue(row, c)[1] for c in cols]
            spread.append(max(angles) - min(angles))
        res.Release()
        runs.append({"Clearing time (s)": tc, "Peak spread (deg)": max(spread), "Reached (s)": reached,
                     "Stable": max(spread) < 180 and reached >= T_STOP - 1e-6, "t": t, "spread": spread})
finally:
    inc.SetAttribute("p_resvar", saved[0])           # put the case back as it was
    inc.SetAttribute("iopt_sim", saved[1])
    sim.SetAttribute("tstop", saved[2])
    clearing.SetAttribute("time", saved[3])
    app.SetAttributeModeInternal(0)
    app.ResetCalculation()
    res.Delete()

for r in runs:
    print(f"Cleared after {r['Clearing time (s)']:.2f} s: peak spread {r['Peak spread (deg)']:7.1f} deg, "
          f"{'stable' if r['Stable'] else 'loses synchronism'}")

with open("rms_runs.csv", "w", newline="") as f:
    out = csv.writer(f)
    out.writerow(["Clearing time (s)", "Peak spread (deg)", "Stable"])
    out.writerows([r["Clearing time (s)"], r["Peak spread (deg)"], r["Stable"]] for r in runs)

# One graph for all runs, in the Adjie Brotools colours (blue, gold, teal, rose).
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(9, 4.8))
for r, colour in zip(runs, ["#3A71C8", "#B45309", "#1F7F63", "#C46A7E"]):
    ax.plot(r["t"], r["spread"], color=colour, lw=2, label=f"Cleared after {r['Clearing time (s)']:.2f} s")
ax.axhline(180, color="#E66A6A", ls="--", lw=1.2)
ax.set(xlabel="Time (s)", ylabel="Rotor angle spread (deg)", xlim=(0, T_STOP), ylim=(0, 400))
ax.grid(color="#DCE3F0")
ax.spines[["top", "right"]].set_visible(False)
ax.legend(frameon=False, loc="upper right")
fig.savefig("rotor_angle_spread.png", dpi=150, bbox_inches="tight")
