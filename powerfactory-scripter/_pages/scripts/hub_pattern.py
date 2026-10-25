import sys

sys.path.append(r"C:\Program Files\DIgSILENT\PowerFactory 2024\Python\3.12")
import powerfactory

PROJECT = "Nine-bus System"

app = powerfactory.GetApplicationExt()                # 1. connect (GetApplication() inside PowerFactory)
app.ActivateProject(PROJECT)                          # 2. the project, with its active study case
ldf = app.GetFromStudyCase("ComLdf")                  # 3. the command of the study
lines = app.GetCalcRelevantObjects("*.ElmLne")

rows = []
for line in lines:                                    # 4. loop over what the study varies
    line.SetAttribute("outserv", 1)
    try:
        if ldf.Execute() == 0:                        # 5. run, and check it worked
            worst = max(o.GetAttribute("c:loading") for o in lines if o.outserv == 0)
            rows.append((line.loc_name, round(worst, 1)))   # 6. read and keep the results
    finally:
        line.SetAttribute("outserv", 0)               # 7. leave the project as it was

print(rows)
