"""Run one generated workflow on the live engine with the sandbox audited before and after.

Usage (always through pfrun.py, which serialises the PowerFactory engine):
    python pfrun.py live_wrap.py <workflow.py> [options as one JSON argument]
Options: {"keep": [[cls, name pattern], ...], "opval": "Name.Class:attr", "save": "<snapshot.pkl>"}

The workflow file is executed as a module (its own code, unchanged), connected with its own
pf_connect() (STUDY_CASE emptied for that first call, so the audit sees the project as found),
then its main() runs as `python <workflow.py>` would run it. Afterwards:
  - LIVE-EXIT <code>: what main() ended with (0 normal, 1 SystemExit with a message / error),
  - objects the workflow keeps on purpose (keep patterns) are listed (LIVE-KEPT), checked with
    opval (LIVE-OPVAL: a kept scenario's operation value), then deleted (ResetCalculation, Delete,
    re-search to confirm),
  - the sandbox is compared with the snapshot before the run: LIVE-AUDIT OK or LIVE-AUDIT FAIL
    with each difference (audit.py of the runtime tests).
Only the two "(Builder test)" sandboxes may be used.
"""
import fnmatch
import json
import os
import pickle
import sys
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.normpath(os.path.join(HERE, "..", "..", "runtime", "live")))
import audit  # noqa: E402

SANDBOXES = ("Nine-bus System (Builder test)", "39 Bus New England System (Builder test)")


def main():
    wf = os.path.abspath(sys.argv[1])
    opts = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    src = open(wf, encoding="utf-8").read()
    g = {"__name__": "pfb_live", "__file__": wf}
    exec(compile(src, wf, "exec"), g)
    project = g.get("PROJECT", "")
    if project not in SANDBOXES:
        print(f"LIVE-REFUSED project {project!r} is not a Builder test sandbox", flush=True)
        sys.exit(90)
    study = g.get("STUDY_CASE", "")
    g["STUDY_CASE"] = ""
    app = g["pf_connect"]()
    before = audit.snapshot(app, project)
    print(f"LIVE-START {project} active={before['active']} objects={before['n']}", flush=True)
    g["STUDY_CASE"] = study
    code = 0
    try:
        g["main"]()
    except SystemExit as e:
        code = e.code if isinstance(e.code, int) else (0 if e.code is None else 1)
        print(f"LIVE-SYSTEMEXIT {e}", flush=True)
    except BaseException:
        traceback.print_exc()
        code = 1
    print(f"LIVE-EXIT {code}", flush=True)
    rd = g.get("_RUN", {}).get("dir")
    print(f"LIVE-RUNDIR {rd}", flush=True)
    try:
        log_fh = g.get("_LOG", {}).get("fh")
        if log_fh:
            log_fh.flush()
    except Exception:
        pass

    # Objects the workflow keeps on purpose: list, check, delete.
    kept = []
    folder_of = {"IntCase": "study", "IntScenario": "scen", "IntScheme": "scheme"}
    for cls, pat in opts.get("keep", []):
        f = app.GetProjectFolder(folder_of.get(cls, "study"))
        for o in (f.GetContents(f"*.{cls}", 1) if f else []):
            if fnmatch.fnmatchcase(o.loc_name, pat):
                kept.append(o)
                print(f"LIVE-KEPT {cls} {o.loc_name}", flush=True)
    if opts.get("opval"):
        q, attr = opts["opval"].rsplit(":", 1)
        el = g["pf_find"](app, q, "one")
        for o in kept:
            if o.GetClassName() == "IntScenario":
                try:
                    print(f"LIVE-OPVAL {o.loc_name} {o.GetOperationValue(el, attr)}", flush=True)
                except Exception as e:
                    print(f"LIVE-OPVAL {o.loc_name} error {e}", flush=True)
    if kept:
        app.ResetCalculation()
        for o in kept:
            try:
                if o.GetClassName() == "IntScenario" and app.GetActiveScenario() is not None and app.GetActiveScenario().GetFullName() == o.GetFullName():
                    o.Deactivate()
            except Exception:
                pass
        for o in reversed(kept):
            try:
                o.Delete()
            except Exception as e:
                print(f"LIVE-DELETE-FAILED {o.loc_name}: {e}", flush=True)
        for cls, pat in opts.get("keep", []):
            f = app.GetProjectFolder(folder_of.get(cls, "study"))
            left = [o.loc_name for o in (f.GetContents(f"*.{cls}", 1) if f else []) if fnmatch.fnmatchcase(o.loc_name, pat)]
            print(f"LIVE-KEPT-LEFT {cls} {left}", flush=True)

    after = audit.snapshot(app, project)
    diff = audit.compare(before, after, limit=60)
    if diff:
        print("LIVE-AUDIT FAIL", flush=True)
        for d in diff:
            print("LIVE-DIFF " + d, flush=True)
    else:
        print(f"LIVE-AUDIT OK ({after['n']} objects, active {after['active']})", flush=True)
    if opts.get("save"):
        with open(opts["save"], "wb") as fh:
            pickle.dump(after, fh)
    sys.exit(code)


if __name__ == "__main__":
    main()
