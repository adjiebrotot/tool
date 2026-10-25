"""Hosting capacity study in PowerFactory with Python: at each busbar, the largest output a new
generator can have before a line or transformer overloads or a voltage leaves its band.

Runs on the "39 Bus New England System" example project that comes with PowerFactory 2024.
"""
import csv
import sys

sys.path.append(r"C:\Program Files\DIgSILENT\PowerFactory 2024\Python\3.12")
import powerfactory

PROJECT = "39 Bus New England System"
STUDY_CASE = "1. Power Flow"
LOADING_MAX = 100.0              # % of rating, every line and transformer
VOLTAGE_BAND = (0.90, 1.10)      # p.u., every busbar
SEARCH_MAX = 2000.0              # MW, the largest output tried
TOLERANCE = 5.0                  # MW, when to stop halving

app = powerfactory.GetApplicationExt()           # inside PowerFactory: powerfactory.GetApplication()
app.ActivateProject(PROJECT)
app.GetProjectFolder("study").GetContents(STUDY_CASE + ".IntCase")[0].Activate()

ldf = app.GetFromStudyCase("ComLdf")
branches = app.GetCalcRelevantObjects("*.ElmLne") + app.GetCalcRelevantObjects("*.ElmTr2")
buses = app.GetCalcRelevantObjects("*.ElmTerm")
# The new generation displaces the generators in service pro rata, so the slack only covers losses.
dispatch = [(g, g.GetAttribute("pgini")) for g in app.GetCalcRelevantObjects("*.ElmSym") if g.outserv == 0]
total = sum(p for g, p in dispatch)


def limits_hold():
    """Run the load flow. (True, "") when every limit holds, else (False, the first one broken)."""
    if ldf.Execute() != 0:
        return False, "load flow does not converge"
    loading, branch = max((o.GetAttribute("c:loading"), o.loc_name) for o in branches if o.outserv == 0)
    if loading > LOADING_MAX:
        return False, f"{branch} loaded to {loading:.0f} %"
    volts = [(b.GetAttribute("m:u"), b.loc_name) for b in buses if b.GetAttribute("m:u") > 0]
    if max(volts)[0] > VOLTAGE_BAND[1]:
        return False, f"{max(volts)[1]} at {max(volts)[0]:.3f} p.u."
    if min(volts)[0] < VOLTAGE_BAND[0]:
        return False, f"{min(volts)[1]} at {min(volts)[0]:.3f} p.u."
    return True, ""


def inject(gen, p_mw):
    """The test generator at p_mw, every other generator turned down by the same total."""
    gen.SetAttribute("pgini", p_mw)
    for g, p in dispatch:
        g.SetAttribute("pgini", p * (1 - p_mw / total))


results = []
for bus in [b for b in buses if b.uknom >= 100]:          # the 345, 230 and 138 kV busbars
    cubicle = bus.CreateObject("StaCubic", "HC cubicle")
    gen = bus.GetAttribute("cpGrid").CreateObject("ElmGenstat", "HC test generator")
    gen.SetAttribute("bus1", cubicle)
    gen.SetAttribute("sgn", 1.5 * SEARCH_MAX)           # MVA, never the limit
    gen.SetAttribute("av_mode", "constq")               # fixed reactive power...
    gen.SetAttribute("qgini", 0.0)                      # ...of zero: unity power factor
    try:
        inject(gen, 0.0)
        ok, why = limits_hold()
        if not ok:
            results.append({"Busbar": bus.loc_name, "Hosting capacity (MW)": 0.0, "Limited by": why})
            continue
        low, high = 0.0, SEARCH_MAX
        inject(gen, high)
        ok, why = limits_hold()
        if ok:
            results.append({"Busbar": bus.loc_name, "Hosting capacity (MW)": high, "Limited by": "nothing up to the search limit"})
            continue
        while high - low > TOLERANCE:                    # halve the gap between pass and fail
            mid = (low + high) / 2
            inject(gen, mid)
            ok, reason = limits_hold()
            if ok:
                low = mid
            else:
                high, why = mid, reason
        results.append({"Busbar": bus.loc_name, "Hosting capacity (MW)": low, "Limited by": why})
    finally:
        for g, p in dispatch:                            # put the dispatch back
            g.SetAttribute("pgini", p)
        app.ResetCalculation()
        gen.Delete()
        cubicle.Delete()

for r in sorted(results, key=lambda r: r["Hosting capacity (MW)"]):
    print(f"{r['Busbar']:7} {r['Hosting capacity (MW)']:7.0f} MW  limited by {r['Limited by']}")

with open("hosting_capacity.csv", "w", newline="") as f:
    out = csv.DictWriter(f, fieldnames=["Busbar", "Hosting capacity (MW)", "Limited by"])
    out.writeheader()
    out.writerows(results)
