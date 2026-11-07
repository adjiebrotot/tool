"""Starting from a snapshot sticks until it is turned off.

    python pscad-scripter/builder/_audit/runtime/analysis/test_snapshot_start.py

No PSCAD: the project and the settings writer are stand-ins, so this checks only what the
runtime asks PSCAD for. "Start from a snapshot" is one block and the runs after it are
others, which pass no snapshot of their own; each of those runs must still ask PSCAD to start
from the file, or every branch quietly simulates its start-up again.
"""
import os
import sys
import tempfile
import types

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.normpath(os.path.join(HERE, "..", "live")))

import loader                                                        # noqa: E402

PASSED, FAILED = [], []


def check(label, got, want):
    ok = got == want
    (PASSED if ok else FAILED).append(label)
    print("  %s %s: %r" % ("ok  " if ok else "FAIL", label, got))


NS = loader.load(["px_run", "snapshots"],
                 {"RUN_NAME": "snap", "OUTPUT_DIR": tempfile.mkdtemp(prefix="pxb-snap-"),
                  "WORKFLOW_NAME": "snapshot start"}, loader.parse(loader.FILES))
asked = []
NS["sim_settings"] = lambda app, prj=None, **kw: asked.append(kw)
NS["px_build"] = lambda *a, **k: types.SimpleNamespace(ok=False, messages=[])   # stop before the run
NS["_PX"]["project"] = types.SimpleNamespace(name="case", temp_folder="")

NS["px_run"](None, 2, 50, 250)
check("a run with no snapshot starts from zero", asked[-1].get("StartType"), "STANDARD")
NS["snapshot_use"](None, "case")
NS["px_run"](None, 2, 50, 250)
check("after Start from a snapshot, a plain run starts from it", asked[-1].get("StartType"), "FROM_SNAP_FILE")
check("and from that file", asked[-1].get("startup_filename"), "case.snp")
NS["px_run"](None, 2, 50, 250)
check("and so does the run after it", asked[-1].get("StartType"), "FROM_SNAP_FILE")
NS["px_run"](None, 2, 50, 250, snapshot=1.0)
check("a run that saves a snapshot leaves the start alone", asked[-1].get("StartType"), None)
NS["snapshot_off"](None)
NS["px_run"](None, 2, 50, 250)
check("after snapshot_off it starts from zero again", asked[-1].get("StartType"), "STANDARD")

print("\n%d ok, %d failed" % (len(PASSED), len(FAILED)))
sys.exit(1 if FAILED else 0)
