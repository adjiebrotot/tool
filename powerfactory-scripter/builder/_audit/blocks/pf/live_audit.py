"""Compare a sandbox now with a snapshot a live_wrap.py run saved (for a workflow that was run as
it is, without the wrapper). Only reads the project.

Usage:  python pfrun.py live_audit.py "<project>" <snapshot.pkl>
Prints LIVE-AUDIT OK or LIVE-AUDIT FAIL with each difference (LIVE-DIFF ...).
"""
import os
import pickle
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.normpath(os.path.join(HERE, "..", "..", "runtime", "live")))
import audit  # noqa: E402

project, snap = sys.argv[1], sys.argv[2]
with open(snap, "rb") as fh:
    before = pickle.load(fh)

# The same engine start as a generated script (the runtime's pf_connect, here sliced out of a
# generated file passed as argument 3, so this script needs no copy of the connect code).
src = open(sys.argv[3], encoding="utf-8").read()
g = {"__name__": "pfb_audit", "__file__": sys.argv[3]}
exec(compile(src, sys.argv[3], "exec"), g)
g["PROJECT"], g["STUDY_CASE"] = project, ""
app = g["pf_connect"]()
after = audit.snapshot(app, project)
diff = audit.compare(before, after, limit=60)
if diff:
    print("LIVE-AUDIT FAIL", flush=True)
    for d in diff:
        print("LIVE-DIFF " + d, flush=True)
else:
    print(f"LIVE-AUDIT OK ({after['n']} objects, active {after['active']})", flush=True)
