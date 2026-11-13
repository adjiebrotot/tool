"""Set up the PSCAD sandbox the live tests run on.

The sandbox is a folder of copies of PSCAD's own example cases, so a test can change,
build and run them without touching the reader's work or the installed examples. It is
outside the repository on purpose: a built PSCAD case leaves a .gf46 folder of Fortran,
object files and an .exe beside the .pscx.

    python _audit/runtime/live/sandbox.py          # make or refresh it
    python _audit/runtime/live/sandbox.py --clean  # throw the build folders away

Set PXB_SANDBOX to put it somewhere else.
"""
import os
import shutil
import sys

DEFAULT = os.path.join(os.path.expanduser("~"), "pscad-sandbox")

# Case -> where it comes from under PSCAD's Examples folder. Small, quick cases that
# between them cover what the runtime touches.
CASES = {
    "vdiv.pscx": "tutorial/vdiv.pscx",                 # two components, one graph
    "simpleac.pscx": "tutorial/simpleac.pscx",         # a machine, a T-line, 4 channels
    "inputctrl.pscx": "tutorial/inputctrl.pscx",       # sliders, switches, dials, a button
    "multirun.pscx": "tutorial/multirun.pscx",         # a Multiple Run component and a fault
    "fft.pscx": "tutorial/fft.pscx",                   # harmonics in the time domain
    # Timed Breaker Logic and Timed Fault Logic, and PSCAD 5's default output name
    # "$(Namespace).out"
    "PLL_Example_3.pscx": "CSMF/PLL/PLL_Example_3.pscx",
}


def examples_folder():
    """Where PSCAD's example cases are, from the Automation Library or the usual place."""
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import mhi.pscad  # noqa: F401
    except Exception:
        pass
    for guess in (os.path.join(os.environ.get("PUBLIC", r"C:\Users\Public"),
                               "Documents", "PSCAD", "5.0", "Examples"),
                  os.path.join(os.environ.get("PUBLIC", r"C:\Users\Public"),
                               "Documents", "PSCAD", "5.1", "Examples")):
        if os.path.isdir(guess):
            return guess
    return ""


def folder():
    """The sandbox folder."""
    return os.environ.get("PXB_SANDBOX") or DEFAULT


def case(name):
    """The full path of one sandbox case."""
    return os.path.join(folder(), name)


def setup(refresh=True):
    """Make the sandbox and copy the cases in. Returns (folder, [names copied])."""
    src = examples_folder()
    if not src:
        raise SystemExit("PSCAD's Examples folder was not found. Install PSCAD, or set "
                         "PXB_SANDBOX to a folder that already holds the cases.")
    dst = folder()
    os.makedirs(dst, exist_ok=True)
    copied = []
    for name, rel in sorted(CASES.items()):
        target = os.path.join(dst, name)
        origin = os.path.join(src, *rel.split("/"))
        if not os.path.exists(origin):
            print("  missing in PSCAD's examples: %s" % rel)
            continue
        if refresh or not os.path.exists(target):
            shutil.copy(origin, target)
            copied.append(name)
    print("sandbox %s: %d case%s ready" % (dst, len(copied), "" if len(copied) == 1 else "s"))
    return dst, copied


def clean():
    """Throw away the build folders, leaving the cases. Returns how many went."""
    dst = folder()
    gone = 0
    if not os.path.isdir(dst):
        return 0
    for name in os.listdir(dst):
        path = os.path.join(dst, name)
        if os.path.isdir(path) and (".gf" in name or ".if" in name or ".vs" in name):
            shutil.rmtree(path, ignore_errors=True)
            gone += 1
    print("cleaned %d build folder%s in %s" % (gone, "" if gone == 1 else "s", dst))
    return gone


if __name__ == "__main__":
    if "--clean" in sys.argv:
        clean()
    else:
        setup(refresh="--keep" not in sys.argv)
