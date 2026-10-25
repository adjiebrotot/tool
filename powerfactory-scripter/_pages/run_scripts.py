"""Run the study guides' scripts (scripts/*.py) on PowerFactory and record what they computed.

Each script runs exactly as its page shows it, with one change: PROJECT becomes the sandbox copy
of the example project ("Nine-bus System (Builder test)", "39 Bus New England System (Builder
test)"), so DIgSILENT's own examples and every other project stay untouched. The sandbox is
audited before and after (builder/_audit/runtime/live/audit.py), and a run that does not leave
it as found is marked so; build.mjs refuses such a result. What the script computed (its JSON-able
globals) and what it printed go to results/<name>.json.

Run through the lock runner that keeps to one PowerFactory engine at a time (PFB_PFRUN, as for the
Builder's live tests), from the repo root:
    python <pfrun.py> powerfactory-scripter/_pages/run_scripts.py [name,name,...]
"""
import contextlib, io, json, os, re, sys, time, traceback

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS, RESULTS = os.path.join(HERE, "scripts"), os.path.join(HERE, "results")
WORK = os.path.join(os.environ.get("TEMP", HERE), "pf_pages_work")
sys.path.insert(0, os.path.normpath(os.path.join(HERE, "..", "builder", "_audit", "runtime", "live")))
sys.path.append(r"C:\Program Files\DIgSILENT\PowerFactory 2024\Python\3.12")
import audit  # noqa: E402
import powerfactory  # noqa: E402

SANDBOX = {"Nine-bus System": "Nine-bus System (Builder test)",
           "39 Bus New England System": "39 Bus New England System (Builder test)"}
names = sys.argv[1].split(",") if len(sys.argv) > 1 else sorted(f[:-3] for f in os.listdir(SCRIPTS) if f.endswith(".py"))
T0 = time.time()


def log(*a):
    print(f"[{time.time() - T0:7.2f}]", *a, flush=True)


app = powerfactory.GetApplicationExt()
powerfactory.GetApplicationExt = lambda *a, **k: app      # one engine per process: hand out this one


class Tee(io.StringIO):
    def write(self, s):
        sys.__stdout__.write(s)
        return super().write(s)


def jsonable(v):
    try:
        json.dumps(v)
        return True
    except Exception:
        return False


for name in names:
    path = os.path.join(SCRIPTS, name + ".py")
    src = open(path, encoding="utf-8").read()
    m = re.search(r'^PROJECT = "([^"]+)"$', src, re.M)
    box = SANDBOX[m.group(1)]
    if src.count("ActivateProject(") != 1 or "ActivateProject(PROJECT)" not in src:
        raise SystemExit(f"{name}: a script activates its project once, by PROJECT")
    src = src.replace(m.group(0), f'PROJECT = "{box}"', 1)
    prj = [p for p in app.GetCurrentUser().GetContents("*.IntPrj") if p.loc_name == box][0]
    prj.Activate()
    case0 = app.GetActiveStudyCase()
    before = audit.snapshot(app, box)
    work = os.path.join(WORK, name)
    os.makedirs(work, exist_ok=True)
    here = os.getcwd()
    os.chdir(work)
    g = {"__name__": "__main__", "__file__": path}
    out, status, t0 = Tee(), "ok", time.time()
    log("==", name, "on", box)
    try:
        with contextlib.redirect_stdout(out):
            exec(compile(src, path, "exec"), g)
    except SystemExit as e:
        status = f"SystemExit: {e}"
    except Exception:
        status = "error: " + traceback.format_exc()
    dt = time.time() - t0
    os.chdir(here)
    app.SetAttributeModeInternal(0)
    if app.GetActiveProject() is None or app.GetActiveProject().loc_name != box:
        prj.Activate()
    case0.Activate()
    diff = audit.compare(before, audit.snapshot(app, box))
    data = {k: v for k, v in g.items() if not k.startswith("_") and k not in ("sys", "csv") and jsonable(v)}
    if name == "emt_run" and "t" in data:            # 50,000 samples: keep every 40th for the page
        k = 40
        data["decimated"] = f"every {k}th of {len(data['t'])} samples"
        data["t"] = [round(x, 6) for x in data["t"][::k]]
        data["wave"] = {p: [round(v, 5) for v in w[::k]] for p, w in data["wave"].items()}
    rec = {"script": name, "project": m.group(1), "seconds": round(dt, 1), "status": status,
           "stdout": out.getvalue().splitlines(), "data": data, "audit": "OK" if not diff else diff,
           "files": sorted(os.listdir(work))}
    os.makedirs(RESULTS, exist_ok=True)
    json.dump(rec, open(os.path.join(RESULTS, name + ".json"), "w", encoding="utf-8"), indent=1)
    log("RESULT", name, status.splitlines()[0][:200], f"{dt:.1f} s", "AUDIT", "OK" if not diff else diff)
