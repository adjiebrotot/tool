"""QV curve in PowerFactory with Python: hold one busbar at a set voltage with a fictitious
voltage-controlling static generator, step the voltage down and record the reactive power it
needs. The bottom of the curve is the reactive power margin of the busbar.

Runs on the "Nine-bus System" example project that comes with PowerFactory 2024.
"""
import csv
import sys

sys.path.append(r"C:\Program Files\DIgSILENT\PowerFactory 2024\Python\3.12")
import powerfactory

PROJECT = "Nine-bus System"
STUDY_CASE = "01- Load Flow"
BUS = "Bus 5"
VOLTAGES = [round(1.10 - 0.02 * k, 2) for k in range(36)]      # 1.10 p.u. down to 0.40 p.u.

app = powerfactory.GetApplicationExt()          # inside PowerFactory: powerfactory.GetApplication()
app.ActivateProject(PROJECT)
app.GetProjectFolder("study").GetContents(STUDY_CASE + ".IntCase")[0].Activate()

ldf = app.GetFromStudyCase("ComLdf")
bus = app.GetCalcRelevantObjects(BUS + ".ElmTerm")[0]
grid = bus.GetAttribute("cpGrid")                # the grid (ElmNet) the busbar belongs to

# The fictitious condenser: no active power, voltage control, rated well above what it will need.
cubicle = bus.CreateObject("StaCubic", "QV cubicle")
gen = grid.CreateObject("ElmGenstat", "QV condenser")
gen.SetAttribute("bus1", cubicle)
gen.SetAttribute("sgn", 2000.0)                  # MVA
gen.SetAttribute("pgini", 0.0)
gen.SetAttribute("av_mode", "constv")            # hold the voltage at usetp

curve = []
try:
    for v in VOLTAGES:
        gen.SetAttribute("usetp", v)
        if ldf.Execute() != 0:
            break
        curve.append({"Voltage (p.u.)": bus.GetAttribute("m:u"), "Q (Mvar)": gen.GetAttribute("m:Q:bus1")})
finally:
    app.ResetCalculation()                       # results first, then the objects can go
    gen.Delete()
    cubicle.Delete()

bottom = min(curve, key=lambda p: p["Q (Mvar)"])
if bottom is curve[-1]:
    print(f"{BUS}: Q still falls at {bottom['Voltage (p.u.)']:.2f} p.u.; extend VOLTAGES to find the bottom")
else:
    print(f"{BUS}: the curve bottoms out at {bottom['Q (Mvar)']:.0f} Mvar, at {bottom['Voltage (p.u.)']:.2f} p.u.")

with open("qv_curve.csv", "w", newline="") as f:
    out = csv.DictWriter(f, fieldnames=list(curve[0]))
    out.writeheader()
    out.writerows(curve)
