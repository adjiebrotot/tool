"""Object trees of both Builder sandboxes against the demo projects they were copied from (only
reads: GetContents, never activates a demo project).

Usage:  python pfrun.py live_tree.py <a generated workflow .py> <out.json>
The generated file only lends its pf_connect(); its PROJECT (a sandbox) is the project opened.
Writes {sandbox: {"extra": [...], "missing": [...], "n_demo": n, "n_sandbox": n}} and prints
LIVE-TREE <sandbox> extra=<n> missing=<n>.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.normpath(os.path.join(HERE, "..", "..", "runtime", "live")))
import audit  # noqa: E402

PAIRS = (("Nine-bus System", "Nine-bus System (Builder test)"),
         ("39 Bus New England System", "39 Bus New England System (Builder test)"))

src = open(sys.argv[1], encoding="utf-8").read()
g = {"__name__": "pfb_tree", "__file__": sys.argv[1]}
exec(compile(src, sys.argv[1], "exec"), g)
if g.get("PROJECT") not in [p[1] for p in PAIRS]:
    print("LIVE-REFUSED not a Builder sandbox", flush=True)
    sys.exit(90)
g["STUDY_CASE"] = ""
app = g["pf_connect"]()
out = {}
# Objects PowerFactory makes by itself when an engine session activates a study case (seen on
# both sandboxes, also with no workflow block in play): not the workflow's, and not ours to delete
# from a user's project, so the comparison leaves them out.
def _pf_own(path):
    leaf = path.rsplit("\\", 1)[-1]
    return ((leaf.startswith("Remote Control") and leaf.endswith(".ComRcom"))
            or (leaf.startswith("Set - SGL Layout") and leaf.endswith(".SetSelect")))


for demo, box in PAIRS:
    extra, missing, na, nb = audit.tree_vs_original(app, demo, box)
    extra = [k for k in extra if not _pf_own(k)]
    out[box] = {"extra": extra, "missing": missing, "n_demo": na, "n_sandbox": nb}
    print(f"LIVE-TREE {box} extra={len(extra)} missing={len(missing)}", flush=True)
    for k in extra[:40]:
        print(f"LIVE-TREE-EXTRA {box}: {k}", flush=True)
with open(sys.argv[2], "w", encoding="utf-8") as fh:
    json.dump(out, fh, indent=1)
