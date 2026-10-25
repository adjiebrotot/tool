"""PV curve in PowerFactory with Python: scale every load up step by step until the load flow no
longer converges, recording the load busbar voltages on the way. The last point is the nose.

Runs on the "Nine-bus System" example project that comes with PowerFactory 2024.
"""
import csv
import sys

sys.path.append(r"C:\Program Files\DIgSILENT\PowerFactory 2024\Python\3.12")
import powerfactory

PROJECT = "Nine-bus System"
STUDY_CASE = "01- Load Flow"
WATCH = ["Bus 5", "Bus 6", "Bus 8"]            # the busbars of the three loads
STEP = 0.05                                    # load scaling step

app = powerfactory.GetApplicationExt()         # inside PowerFactory: powerfactory.GetApplication()
app.ActivateProject(PROJECT)
app.GetProjectFolder("study").GetContents(STUDY_CASE + ".IntCase")[0].Activate()

ldf = app.GetFromStudyCase("ComLdf")
loads = app.GetCalcRelevantObjects("*.ElmLod")
base = [(ld, ld.GetAttribute("plini"), ld.GetAttribute("qlini")) for ld in loads]
watch = [app.GetCalcRelevantObjects(name + ".ElmTerm")[0] for name in WATCH]

curve = []
scale = 1.0
try:
    while scale <= 5.0:
        for ld, p, q in base:                  # same power factor: P and Q scale together
            ld.SetAttribute("plini", p * scale)
            ld.SetAttribute("qlini", q * scale)
        if ldf.Execute() != 0:                 # no solution any more: past the nose
            break
        point = {"Scale": scale, "Load (MW)": sum(ld.GetAttribute("m:P:bus1") for ld in loads)}
        point.update({b.loc_name: b.GetAttribute("m:u") for b in watch})
        curve.append(point)
        scale = round(scale + STEP, 6)
finally:
    for ld, p, q in base:                      # put the loads back
        ld.SetAttribute("plini", p)
        ld.SetAttribute("qlini", q)

nose = curve[-1]
weakest = min(WATCH, key=lambda name: nose[name])
print(f"Nose: {nose['Load (MW)']:.0f} MW ({nose['Scale']:.2f} x the base load), "
      f"weakest busbar {weakest} at {nose[weakest]:.3f} p.u.")

with open("pv_curve.csv", "w", newline="") as f:
    out = csv.DictWriter(f, fieldnames=list(curve[0]))
    out.writeheader()
    out.writerows(curve)
