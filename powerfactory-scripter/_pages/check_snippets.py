"""Run every "Read and write ... in Python" snippet of the attribute reference on PowerFactory.

Each snippet runs on the two sandbox copies of the example projects (never on any other project)
wherever the project has an object of its class; every value it sets is put back, every event it
creates is deleted, and each sandbox is audited before and after. The ElmRes snippet runs a short
simulation in the 39-bus sandbox's active case. Prints one line per snippet and the audits.

From the repo root, through the lock runner (one PowerFactory engine at a time):
    python <pfrun.py> powerfactory-scripter/_pages/check_snippets.py [Class,Class,...]
"""
import contextlib, html, io, os, re, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
REF = os.path.join(HERE, "..", "reference")
sys.path.insert(0, os.path.normpath(os.path.join(HERE, "..", "builder", "_audit", "runtime", "live")))
sys.path.append(r"C:\Program Files\DIgSILENT\PowerFactory 2024\Python\3.12")
import audit  # noqa: E402
import powerfactory  # noqa: E402

SANDBOXES = ("Nine-bus System (Builder test)", "39 Bus New England System (Builder test)")
ONLY = set(sys.argv[1].split(",")) if len(sys.argv) > 1 and sys.argv[1] else None
T0 = time.time()
failed = 0


def log(*a):
    print(f"[{time.time() - T0:7.2f}]", *a, flush=True)


def snippet_of(cls):
    t = open(os.path.join(REF, cls, "index.html") if cls else os.path.join(REF, "index.html"), encoding="utf-8").read()
    m = re.search(r'aria-labelledby="python">.*?<pre><code class="language-python">(.*?)</code></pre>', t, re.S)
    return html.unescape(re.sub(r"<[^>]+>", "", m.group(1))).replace("powerfactory.GetApplication()", "__app") if m else None


app = powerfactory.GetApplicationExt()
for P in SANDBOXES:
    prj = [p for p in app.GetCurrentUser().GetContents("*.IntPrj") if p.loc_name == P][0]
    prj.Activate()
    case0 = app.GetActiveStudyCase()
    before = audit.snapshot(app, P)
    log("==", P, "case", case0.loc_name)
    classes = sorted(d for d in os.listdir(REF) if os.path.isdir(os.path.join(REF, d))) + [""]
    for cls in classes:
        if ONLY and cls not in ONLY:
            continue
        code = snippet_of(cls)
        if not code:
            continue
        equip = app.GetProjectFolder("equip")
        if cls.startswith("Typ"):
            if not equip.GetContents("*." + cls, 1):
                continue
        elif cls.startswith("Elm") or cls.startswith("Sta"):
            if cls != "ElmRes" and not app.GetCalcRelevantObjects("*." + cls):
                continue
            if cls == "ElmRes" and not P.startswith("39"):
                continue
        keep = []
        for attr in set(re.findall(r'\w+\.SetAttribute\("(\w+)"', code)):
            pool = equip.GetContents("*." + cls, 1) if cls.startswith("Typ") else app.GetCalcRelevantObjects("*." + (cls if cls.startswith("Elm") else "ElmLod"))
            for o in pool:
                try:
                    keep.append((o, attr, o.GetAttribute(attr)))
                except Exception:
                    pass
        inc = app.GetFromStudyCase("ComInc")
        evf = inc.GetAttribute("p_event")
        ev_before = {o.GetFullName() for o in (evf.GetContents() if evf else [])}
        resvar = inc.GetAttribute("p_resvar")
        buf, ok, err = io.StringIO(), True, ""
        try:
            with contextlib.redirect_stdout(buf):
                exec(compile(code, f"<{cls or 'index'}>", "exec"), {"__app": app})
        except Exception as e:
            ok, err = False, f"{type(e).__name__}: {e}"
        for o, attr, v in keep:
            o.SetAttribute(attr, v)
        app.SetAttributeModeInternal(0)
        for o in (evf.GetContents() if evf else []):
            if o.GetFullName() not in ev_before:
                o.Delete()
        if cls == "ElmRes":
            inc.SetAttribute("p_resvar", resvar)
            app.ResetCalculation()
            for r in app.GetActiveStudyCase().GetContents("My results.ElmRes"):
                r.Delete()
        failed += 0 if ok else 1
        out = buf.getvalue().strip().splitlines()
        log("SNIPPET", cls or "index", "OK" if ok else "FAIL " + err, "|", " / ".join(out[:2])[:160])
    case0.Activate()
    diff = audit.compare(before, audit.snapshot(app, P))
    failed += 1 if diff else 0
    log("AUDIT", P, "OK" if not diff else diff)
log(f"{'all snippets ran' if not failed else str(failed) + ' failures'}")
sys.exit(1 if failed else 0)
