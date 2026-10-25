"""EMT simulation in PowerFactory with Python: run the study case's fault, record the three phase
voltages of the faulted busbar, and read the waveforms back.

Runs on the "39 Bus New England System" example project that comes with PowerFactory 2024.
"""
import sys

sys.path.append(r"C:\Program Files\DIgSILENT\PowerFactory 2024\Python\3.12")
import powerfactory

PROJECT = "39 Bus New England System"
STUDY_CASE = "4. EMT Simulation Fault Bus 03"     # a two-phase fault at Bus 03 at 0.2 s
T_STOP = 0.5                                       # s

app = powerfactory.GetApplicationExt()             # inside PowerFactory: powerfactory.GetApplication()
app.ActivateProject(PROJECT)
case = app.GetProjectFolder("study").GetContents(STUDY_CASE + ".IntCase")[0]
case.Activate()

inc = app.GetFromStudyCase("ComInc")
sim = app.GetFromStudyCase("ComSim")
bus = app.GetCalcRelevantObjects("Bus 03.ElmTerm")[0]

res = case.CreateObject("ElmRes", "EMT voltages")
for phase in "ABC":
    res.AddVariable(bus, f"m:u:{phase}")           # instantaneous phase voltage, p.u.

app.SetAttributeModeInternal(1)                    # times in seconds
saved = (inc.GetAttribute("p_resvar"), inc.GetAttribute("iopt_sim"), sim.GetAttribute("tstop"))
inc.SetAttribute("p_resvar", res)
inc.SetAttribute("iopt_sim", "ins")                # "ins": EMT (instantaneous values), "rms": RMS
sim.SetAttribute("tstop", T_STOP)
try:
    if inc.Execute() != 0:
        raise SystemExit("The initial conditions failed")
    sim.Execute()
    res.Load()
    cols = [res.FindColumn(bus, f"m:u:{p}") for p in "ABC"]
    t = [res.GetValue(row, -1)[1] for row in range(res.GetNumberOfRows())]
    wave = {p: [res.GetValue(row, c)[1] for row in range(len(t))] for p, c in zip("ABC", cols)}
    res.Release()
finally:
    inc.SetAttribute("p_resvar", saved[0])
    inc.SetAttribute("iopt_sim", saved[1])
    sim.SetAttribute("tstop", saved[2])
    app.SetAttributeModeInternal(0)
    app.ResetCalculation()
    res.Delete()

print(f"{len(t)} samples, {t[1] - t[0]:.6f} s apart; phase A peak before the fault "
      f"{max(abs(u) for u, tt in zip(wave['A'], t) if tt < 0.2):.3f} p.u.")
