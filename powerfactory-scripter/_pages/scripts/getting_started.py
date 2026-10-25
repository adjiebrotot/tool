"""A first PowerFactory Python script: connect, open a project, run a load flow, read results.

Runs on the "Nine-bus System" example project that comes with PowerFactory 2024.
"""
import sys

# The powerfactory module ships with PowerFactory, one folder per Python version. Run this
# file with the Python whose version has a folder there (3.12 here).
sys.path.append(r"C:\Program Files\DIgSILENT\PowerFactory 2024\Python\3.12")
import powerfactory

PROJECT = "Nine-bus System"

# From your own Python: start PowerFactory in the background (engine mode).
# Inside PowerFactory (a Python command, ComPython): app = powerfactory.GetApplication()
app = powerfactory.GetApplicationExt()

if app.ActivateProject(PROJECT) != 0:                    # 0 means it worked
    raise SystemExit(f"There is no project called {PROJECT}")
case = app.GetActiveStudyCase()
print("Study case:", case.loc_name)

ldf = app.GetFromStudyCase("ComLdf")                     # the load flow command of the case
if ldf.Execute() != 0:                                   # 0 means it converged
    raise SystemExit("The load flow did not converge")

for bus in app.GetCalcRelevantObjects("*.ElmTerm"):      # every terminal of the active grids
    print(f"{bus.loc_name:6} {bus.GetAttribute('m:u'):.4f} p.u. {bus.GetAttribute('m:Ul'):8.2f} kV")

for line in app.GetCalcRelevantObjects("*.ElmLne"):
    print(f"{line.loc_name:9} loading {line.GetAttribute('c:loading'):5.1f} %")

load = app.GetCalcRelevantObjects("Load A.ElmLod")[0]    # one element, found by name
print("Load A:", load.plini, "MW")                       # input data also reads as a property
