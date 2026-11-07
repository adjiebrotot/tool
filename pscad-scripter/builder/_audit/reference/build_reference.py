"""Build the PSCAD component reference the Builder's pickers and tips read.

    python _audit/reference/build_reference.py            # definitions + parameters
    python _audit/reference/build_reference.py --defs     # definitions only (fast)

Everything comes out of the running PSCAD, not out of a table typed by hand:

* the definition list and each definition's parameter form come from the Master Library's
  own XML (`Definition.xml`, the `form` and `paramlist` nodes), which carries the
  parameter names, their descriptions, units, ranges, groups, default values, help text
  and the conditions under which PSCAD enables them;
* the **symbolic values** a Choice parameter takes come from a live instance
  (`Component.range(name)`), because those are what the Automation Library accepts and
  they cannot be worked out from the choice text: "Behind the Source Impedance" is
  `BEHIND_SOURCE_IMPEDANCE` (the "the" is dropped) and "R-R//L" is `RR_L`.

Writes `reference/components.json` (everything) and `reference/definitions.json` (the
short list the component picker loads).
"""
import json
import os
import re
import sys
import time
from xml.etree import ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "..", "..", "reference"))

# Definitions that are not components an engineer places and parameterises: page frames,
# annotations, decoration and the per-project top level.
SKIP = {
    "Station", "annotation", "annotation2", "arrow_a", "arrow_c", "arrow_s", "caps",
    "appg1", "apple21", "sticky", "divider", "groupbox",
}

# The groups the picker shows, in this order, and how a definition lands in one. First match
# wins, so the order matters. These are the words PSCAD itself uses in the Master Library
# palette, so an engineer recognises them.
GROUPS = [
    ("Sources", ("source", "battery", "vsource", "isource")),
    ("Passive", ("resistor", "capacitor", "inductor", "rlc", "cfilter", "filter",
                 "arrester", "surge", "load", "ground", "nonlinear")),
    ("Transformers", ("xfmr", "transformer", "ideal_trans", "ucmag", "sat")),
    ("Lines and cables", ("line", "cable", "tline", "newpi", "coupled", "tower", "pi_")),
    ("Switching", ("breaker", "switch", "flt", "fault", "thyristor", "diode", "gto",
                   "igbt", "valve", "contactor", "disconnect")),
    ("Machines", ("machine", "exciter", "governor", "turbine", "sync", "induction",
                  "pm_", "dc_", "wind")),
    ("Meters", ("meter", "pgb", "datalabel", "datatap", "rms", "watt", "power", "pq",
                "phase", "fft", "harmonic", "freq")),
    ("Control", ("gain", "sum", "mult", "div", "integ", "deriv", "lag", "lead", "pid",
                 "limit", "delay", "pll", "compar", "select", "sample", "hold", "abs",
                 "sqrt", "exp", "log", "trig", "sin", "cos", "tan", "poly", "func",
                 "const", "slider", "button", "dial", "var", "signal", "logic", "and",
                 "or_", "not_", "xor", "flipflop", "monostable", "timer", "ramp", "step",
                 "ff_", "counter", "edge", "clarke", "park", "dq0", "abcdq", "sequencer",
                 "discretiz", "buffer", "pole", "complex", "conjugate", "dot_product",
                 "scaler", "detect", "dwt", "array", "interp", "random", "noise",
                 "multiplex", "demux", "breakout", "latch", "mono", "pulse", "oscillat",
                 "trigger", "deadband", "backlash", "hyster", "rate", "filter_", "gate")),
    ("Protection", ("relay", "dir_", "dscd", "dist", "ct_", "cvt", "ccvt", "trip",
                    "overcurrent", "undervolt", "differential", "zdiff", "zreal")),
    ("Runtime", ("mrun", "multimeter", "maxmin", "record", "file", "output", "channel",
                 "optim", "golden", "simplex", "hooke")),
]


def shim():
    """Let a pip-installed Automation Library talk to an older PSCAD (see px_core.py)."""
    os.environ.pop("NoDefaultCurrentDirectoryInExePath", None)
    import mhi.common                                                    # noqa: F401
    for sub in ("", ".remote", ".collection", ".codec", ".path", ".process", ".cdata"):
        name = "mhi.pscad.common" + sub
        if name not in sys.modules:
            try:
                sys.modules[name] = __import__("mhi.common" + sub, fromlist=["x"])
            except Exception:
                pass


def group_of(defn, desc):
    """Which palette group a definition belongs in."""
    text = (defn + " " + desc).lower()
    for name, words in GROUPS:
        if any(w in text for w in words):
            return name
    return "Other"


def parse_form(xml):
    """(form name, description, [parameter records]) out of a Definition's XML."""
    title, desc, params = "", "", []
    for node in xml:
        if node.tag == "paramlist":
            for p in node.findall("param"):
                if (p.get("name") or "").lower() == "description":
                    desc = (p.get("value") or "").strip()
        elif node.tag == "form":
            title = (node.get("name") or "").strip()
            for cat in node.iter("category"):
                group = (cat.get("name") or "").strip()
                for par in cat.findall("parameter"):
                    rec = parse_parameter(par, group)
                    if rec:
                        params.append(rec)
    return title, desc, params


def parse_parameter(par, group):
    """One parameter of a form, as the Builder wants it."""
    name = (par.get("name") or "").strip()
    if not name:
        return None
    rec = {
        "name": name,
        "desc": (par.get("desc") or "").strip(),
        "type": (par.get("type") or "").strip() or "Text",
        "group": group,
    }
    for key, attr in (("unit", "unit"), ("min", "min"), ("max", "max"),
                      ("intent", "intent"), ("dim", "dim")):
        v = (par.get(attr) or "").strip()
        if v:
            rec[key] = v
    value = par.find("value")
    if value is not None and (value.text or "").strip():
        rec["default"] = value.text.strip()
    help_node = par.find("help")
    if help_node is not None and (help_node.text or "").strip():
        rec["help"] = " ".join(help_node.text.split())
    choices = [(" ".join((c.text or "").split())) for c in par.findall("choice")]
    if choices:
        rec["choices"] = choices
    cond = par.find("cond")
    if cond is not None and (cond.text or "").strip() not in ("", "true", "(true)"):
        rec["when"] = " ".join(cond.text.split())
    return rec


_SQUASH = re.compile(r"[^A-Z0-9]+")


def squash(text):
    """"Behind the Source Impedance" -> "BEHINDTHESOURCEIMPEDANCE", for pairing."""
    return _SQUASH.sub("", str(text).upper())


def match_score(want, got):
    """How well a symbolic value spells a choice's label, strongest first.

    An exact spelling always wins: "R" is the symbol for the label "R", even though
    "RL", "RC" and "RLC" all contain it. Only then does one containing the other count
    ("BEHIND_SOURCE_IMPEDANCE" for "Behind the Source Impedance"), nearest length first,
    and last a shared opening. The score is a tuple so the ranks never bleed into
    each other, which is how "R" used to end up on "RLC"."""
    if not got or not want:
        return (0, 0)
    if got == want:
        return (3, 0)
    if got in want or want in got:
        return (2, -abs(len(got) - len(want)))
    shared = len(os.path.commonprefix([want, got]))
    return (1, shared) if shared else (0, 0)


def pair_choices(choice_texts, symbols):
    """Pair each symbolic value with the choice text it came from.

    The texts come from the form in order; the symbols come back from PSCAD as an
    unordered set, so they are paired by how much of the text each symbol spells. Both
    "BEHIND_SOURCE_IMPEDANCE" from "Behind the Source Impedance" and "RR_L" from "R-R//L"
    pair correctly this way. A symbol nothing matches keeps a label made from itself.

    The symbols are sorted before they are matched: a set has no order of its own, and
    without this the pairing came out differently every run."""
    # A choice text reads "1 = Resistive": the label is what follows the first "=".
    labels = []
    for text in choice_texts:
        bits = text.split("=", 1)
        labels.append((bits[1] if len(bits) > 1 else bits[0]).strip())
    # A Logical parameter's range comes back as the Python values {True, False}, not as text,
    # so everything here works on the written form and the written form is what is stored.
    left = sorted(sym if isinstance(sym, str) else str(sym) for sym in symbols)
    out = []
    for label in labels:
        want = squash(label)
        best, score = None, (0, 0)
        for sym in left:
            hit = match_score(want, squash(sym))
            if hit > score:
                best, score = sym, hit
        if best is not None:
            out.append([best, label])
            left.remove(best)
    for sym in left:
        out.append([sym, sym.replace("_", " ").capitalize()])
    return out


def main(argv):
    shim()
    import mhi.pscad
    pscad = mhi.pscad.launch(minimize=True, splash=False, timeout=180)
    started = time.time()
    try:
        master = pscad.project("master")
        names = [n for n in (master.definitions() or []) if n not in SKIP]
        print("Master Library: %d definitions" % len(names))

        defs = {}
        for name in names:
            try:
                xml = master.definition(name).xml
            except Exception as err:
                print("  skipped %s: %s" % (name, str(err)[:60]))
                continue
            title, desc, params = parse_form(xml)
            # The files are written with sorted keys, so the form's own order would be lost.
            # "i" is where a parameter sits in the form and "groups" is the order of the
            # form's own sections, which is how the reference pages lay a definition out.
            for i, par in enumerate(params):
                par["i"] = i
            defs["master:" + name] = {
                "name": title or name,
                "desc": desc,
                "group": group_of(name, desc or title),
                "groups": list(dict.fromkeys(par["group"] for par in params)),
                "params": {p["name"]: p for p in params},
            }
        print("  read %d forms in %.0fs" % (len(defs), time.time() - started))

        if "--defs" not in argv:
            add_symbols(pscad, defs)

        os.makedirs(OUT, exist_ok=True)
        full = {"generated": time.strftime("%Y-%m-%d"),
                "pscad": str(pscad.version), "defs": defs}
        write_all(full)
    finally:
        try:
            pscad.quit()
        except Exception:
            pass
    return 0


def add_symbols(pscad, defs):
    """Fill in the symbolic values of every Choice parameter, from live instances.

    One scratch case holds one instance of each definition at a time: a definition that
    cannot be placed (a page module, a definition needing a parent) is skipped and said so."""
    import tempfile
    path = os.path.join(tempfile.gettempdir(), "pxb_reference_%d.pscx" % (os.getpid(),))
    prj = pscad.create_case(path)
    page = prj.canvas("Main")
    done, skipped, asked = 0, 0, 0
    started = time.time()
    for key, rec in sorted(defs.items()):
        choice_params = [p for p in rec["params"].values() if p.get("choices")]
        if not choice_params:
            continue
        try:
            comp = page.create_component(key, 10, 10)
        except Exception:
            skipped += 1
            continue
        try:
            for p in choice_params:
                try:
                    got = comp.range(p["name"])
                    asked += 1
                except Exception:
                    continue
                if isinstance(got, (set, frozenset, list, tuple)) and got:
                    p["options"] = pair_choices(p["choices"], got)
            try:
                live = comp.parameters() or {}
                for p in rec["params"].values():
                    if p["name"] in live and live[p["name"]] is not None:
                        p["value"] = str(live[p["name"]])
            except Exception:
                pass
            done += 1
        finally:
            try:
                comp.delete()
            except Exception:
                pass
        if done % 25 == 0:
            print("    %d definitions, %d parameters, %.0fs" % (done, asked,
                                                                time.time() - started))
    print("  symbolic values: %d definitions, %d parameters, %d could not be placed, %.0fs"
          % (done, asked, skipped, time.time() - started))
    try:
        prj.unload()
    except Exception:
        pass
    try:
        os.remove(path)
    except OSError:
        pass


def write_all(full):
    """The three files the page reads, each as small as its job allows.

    `components.json` is everything, for the reference pages. `params.json` leaves out the
    help text and the enable conditions, because the editor only needs a parameter's unit,
    type and options to decide what to offer, and it would otherwise download a megabyte of
    prose to answer "is this a percentage". `definitions.json` is the one-line-per-component
    list the picker loads first."""
    write(os.path.join(OUT, "components.json"), full)

    lean = {}
    for key, rec in full["defs"].items():
        params = {}
        for name, p in rec["params"].items():
            keep = {k: p[k] for k in ("type", "unit", "group", "default", "options", "i")
                    if k in p}
            keep["desc"] = p.get("desc", "")
            params[name] = keep
        lean[key] = {"name": rec["name"], "group": rec["group"],
                     "groups": rec.get("groups", []), "params": params}
    write(os.path.join(OUT, "params.json"),
          {"generated": full["generated"], "pscad": full["pscad"], "defs": lean},
          indent=None)

    write(os.path.join(OUT, "definitions.json"),
          {"generated": full["generated"], "pscad": full["pscad"],
           "defs": [[k, v["name"], v["group"], len(v["params"])]
                    for k, v in sorted(full["defs"].items())]}, indent=None)


def write(path, data, indent=1):
    """Write one reference file. The lean files the editor downloads go compact."""
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(data, fh, indent=indent, sort_keys=True, ensure_ascii=True,
                  separators=(",", ":") if indent is None else None)
        fh.write("\n")
    print("  wrote %s (%.0f kB)" % (path, os.path.getsize(path) / 1024.0))


if __name__ == "__main__":
    sys.exit(main(sys.argv))
