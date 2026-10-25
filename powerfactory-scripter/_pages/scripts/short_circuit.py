"""Short circuit in PowerFactory with Python: an IEC 60909 three-phase fault at every busbar, with
the initial, peak and power values of each saved to CSV.

Runs on the "Nine-bus System" example project that comes with PowerFactory 2024.
"""
import csv
import sys

sys.path.append(r"C:\Program Files\DIgSILENT\PowerFactory 2024\Python\3.12")
import powerfactory

PROJECT = "Nine-bus System"
STUDY_CASE = "01- Load Flow"

app = powerfactory.GetApplicationExt()          # inside PowerFactory: powerfactory.GetApplication()
app.ActivateProject(PROJECT)
app.GetProjectFolder("study").GetContents(STUDY_CASE + ".IntCase")[0].Activate()

shc = app.GetFromStudyCase("ComShc")
saved = {a: shc.GetAttribute(a) for a in ("iopt_mde", "iopt_shc", "iopt_cur", "iopt_allbus")}
shc.SetAttribute("iopt_mde", 1)         # method: 0 VDE 0102, 1 IEC 60909, 2 ANSI, 3 complete
shc.SetAttribute("iopt_shc", "3psc")    # fault: 3psc three-phase, 2psc two-phase, spgf single-phase to ground
shc.SetAttribute("iopt_cur", 0)         # 0 maximum, 1 minimum short-circuit currents
shc.SetAttribute("iopt_allbus", 2)      # 2 a fault at every busbar, one at a time
try:
    if shc.Execute() != 0:
        raise SystemExit("The short-circuit calculation failed")
    rows = [{"Busbar": b.loc_name, "Nominal (kV)": round(b.uknom, 2),
             "Ikss (kA)": b.GetAttribute("m:Ikss"),      # initial symmetrical short-circuit current
             "ip (kA)": b.GetAttribute("m:ip"),          # peak short-circuit current
             "Skss (MVA)": b.GetAttribute("m:Skss")}     # initial short-circuit power
            for b in app.GetCalcRelevantObjects("*.ElmTerm")]
finally:
    for a, v in saved.items():                  # leave the command as it was
        shc.SetAttribute(a, v)

for r in sorted(rows, key=lambda r: -r["Ikss (kA)"]):
    print(f"{r['Busbar']:6} {r['Nominal (kV)']:6.1f} kV  Ikss {r['Ikss (kA)']:6.2f} kA  ip {r['ip (kA)']:6.2f} kA")

with open("short_circuit_results.csv", "w", newline="") as f:
    out = csv.DictWriter(f, fieldnames=list(rows[0]))
    out.writeheader()
    out.writerows(rows)
