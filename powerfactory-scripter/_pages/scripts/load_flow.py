"""Load flow in PowerFactory with Python: run it, read every busbar and branch, save CSV and Excel.

Runs on the "Nine-bus System" example project that comes with PowerFactory 2024.
"""
import csv
import sys

sys.path.append(r"C:\Program Files\DIgSILENT\PowerFactory 2024\Python\3.12")
import powerfactory

PROJECT = "Nine-bus System"
STUDY_CASE = "01- Load Flow"

app = powerfactory.GetApplicationExt()         # inside PowerFactory: powerfactory.GetApplication()
app.ActivateProject(PROJECT)
app.GetProjectFolder("study").GetContents(STUDY_CASE + ".IntCase")[0].Activate()

# The study case's load flow command, with the options for this run (put back at the end).
ldf = app.GetFromStudyCase("ComLdf")
saved = {a: ldf.GetAttribute(a) for a in ("iopt_net", "iopt_lim", "iopt_at")}
ldf.SetAttribute("iopt_net", 0)     # 0 AC balanced, 1 AC unbalanced (3-phase), 2 DC
ldf.SetAttribute("iopt_lim", 1)     # 1 keeps generators within their reactive power limits
ldf.SetAttribute("iopt_at", 0)      # 1 lets transformer taps move automatically
try:
    if ldf.Execute() != 0:
        raise SystemExit("The load flow did not converge")

    buses = [{"Busbar": b.loc_name, "Nominal (kV)": round(b.uknom, 2),
              "Voltage (p.u.)": b.GetAttribute("m:u"), "Voltage (kV)": b.GetAttribute("m:Ul"),
              "Angle (deg)": b.GetAttribute("m:phiu")}
             for b in app.GetCalcRelevantObjects("*.ElmTerm")]

    branches = []
    for o in app.GetCalcRelevantObjects("*.ElmLne") + app.GetCalcRelevantObjects("*.ElmTr2"):
        end = "bus1" if o.GetClassName() == "ElmLne" else "bushv"   # the end P and Q are read at
        branches.append({"Branch": o.loc_name, "Class": o.GetClassName(),
                         "Loading (%)": o.GetAttribute("c:loading"),
                         "P (MW)": o.GetAttribute(f"m:P:{end}"), "Q (Mvar)": o.GetAttribute(f"m:Q:{end}"),
                         "Losses (MW)": o.GetAttribute("c:Ploss")})
finally:
    for a, v in saved.items():                  # leave the command as it was
        ldf.SetAttribute(a, v)


def save_csv(name, rows):
    with open(name, "w", newline="") as f:
        out = csv.DictWriter(f, fieldnames=list(rows[0]))
        out.writeheader()
        out.writerows(rows)


save_csv("load_flow_buses.csv", buses)
save_csv("load_flow_branches.csv", branches)

# Excel, one sheet per table: needs pandas and openpyxl (pip install pandas openpyxl).
try:
    import pandas as pd
    with pd.ExcelWriter("load_flow_results.xlsx") as xl:
        pd.DataFrame(buses).to_excel(xl, sheet_name="Busbars", index=False)
        pd.DataFrame(branches).to_excel(xl, sheet_name="Branches", index=False)
except ImportError:
    print("pandas is not installed: the CSV files are saved, the Excel file is not")

print(f"Saved {len(buses)} busbars and {len(branches)} branches")
