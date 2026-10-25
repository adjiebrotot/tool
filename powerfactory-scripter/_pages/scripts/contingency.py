"""N-1 contingency analysis in PowerFactory with Python: take each line and network transformer
out in turn, run the load flow, and keep the highest loading and the lowest voltage of each outage.

Runs on the "39 Bus New England System" example project that comes with PowerFactory 2024.
"""
import csv
import sys

sys.path.append(r"C:\Program Files\DIgSILENT\PowerFactory 2024\Python\3.12")
import powerfactory

PROJECT = "39 Bus New England System"
STUDY_CASE = "1. Power Flow"
LOADING_LIMIT = 100.0                               # %

app = powerfactory.GetApplicationExt()              # inside PowerFactory: powerfactory.GetApplication()
app.ActivateProject(PROJECT)
app.GetProjectFolder("study").GetContents(STUDY_CASE + ".IntCase")[0].Activate()

ldf = app.GetFromStudyCase("ComLdf")
branches = app.GetCalcRelevantObjects("*.ElmLne") + app.GetCalcRelevantObjects("*.ElmTr2")
buses = app.GetCalcRelevantObjects("*.ElmTerm")
# A generator's own transformer is left out: losing it loses the generator, a generation
# contingency that needs governor response, not a single slack taking up all of it.
gen_terminals = {g.GetAttribute("bus1").GetParent().GetFullName() for g in app.GetCalcRelevantObjects("*.ElmSym")}
outages = [o for o in branches if o.outserv == 0 and not (
    o.GetClassName() == "ElmTr2" and o.GetAttribute("buslv").GetParent().GetFullName() in gen_terminals)]


def worst():
    """The highest branch loading and the lowest busbar voltage of the last load flow."""
    loading, branch = max((o.GetAttribute("c:loading"), o.loc_name) for o in branches if o.outserv == 0)
    # A busbar cut off by the outage reads exactly 0 p.u.: it is islanded, not low.
    u, bus = min((b.GetAttribute("m:u"), b.loc_name) for b in buses if b.GetAttribute("m:u") > 0)
    return {"Highest loading (%)": loading, "Most loaded": branch, "Lowest voltage (p.u.)": u, "Lowest at": bus}


rows = []
if ldf.Execute() != 0:
    raise SystemExit("The base case load flow does not converge")
rows.append({"Outage": "Base case", "Converged": "yes", **worst()})

for out in outages:
    out.SetAttribute("outserv", 1)                  # take it out of service
    try:
        if ldf.Execute() == 0:
            rows.append({"Outage": out.loc_name, "Converged": "yes", **worst()})
        else:
            rows.append({"Outage": out.loc_name, "Converged": "no"})
    finally:
        out.SetAttribute("outserv", 0)              # always put it back

overloads = [r for r in rows if r.get("Highest loading (%)", 0) > LOADING_LIMIT]
print(f"{len(rows) - 1} outages, {len(overloads)} with a branch above {LOADING_LIMIT:.0f} %")
for r in sorted(overloads, key=lambda r: -r["Highest loading (%)"])[:5]:
    print(f"  {r['Outage']:16} {r['Most loaded']:16} {r['Highest loading (%)']:6.1f} %")

with open("n-1_results.csv", "w", newline="") as f:
    out_csv = csv.DictWriter(f, fieldnames=["Outage", "Converged", "Highest loading (%)", "Most loaded",
                                            "Lowest voltage (p.u.)", "Lowest at"])
    out_csv.writeheader()
    out_csv.writerows(rows)
