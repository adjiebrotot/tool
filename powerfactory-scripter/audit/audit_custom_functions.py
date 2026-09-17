#!/usr/bin/env python3
"""
Audit of the pre-made Custom Function library (../custom-functions.js).

Runs on plain CPython, with no PowerFactory and no network. It checks that
every snippet in the library obeys the rules the code generator imposes on a
Custom Calculation output, and that each one actually computes what its
description claims:

  Phase 1 - shape      : one top-level def, name and arguments match the
                         metadata, no *args / **kwargs, no tuple return.
  Phase 2 - generator  : the def line parses with the same regular expression
                         pf-script-builder.js uses, and no return statement
                         trips the "must return exactly one value" check in
                         script.js.
  Phase 3 - robustness : every function survives arguments arriving as None,
                         which is what the generated script passes when a
                         result is missing, and returns a scalar.
  Phase 4 - behaviour  : hand-calculated cases per function.

Run:  python3 audit_custom_functions.py
Exit code is 0 when every checkpoint passes, 1 otherwise.
"""

import ast
import math
import os
import re
import sys

LIB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        "..", "custom-functions.js")

PASS = 0
FAIL = 0


def check(label, ok, detail=""):
    global PASS, FAIL
    if ok:
        PASS += 1
        print(f"  PASS  {label}")
    else:
        FAIL += 1
        print(f"  FAIL  {label}" + (f"  -> {detail}" if detail else ""))


def near(a, b, tol=1e-9):
    return a is not None and abs(a - b) <= tol


# ── Load the library ────────────────────────────────────────────────
def load_library(path):
    """Extract {id, fnName, args, code} per entry from the JS source.

    The Python bodies are template literals and never contain a backtick, so
    a non-greedy match between backticks is exact.
    """
    with open(path, "r", encoding="utf-8") as handle:
        source = handle.read()

    entries = []
    for block in re.finditer(
            r"id:\s*'([^']+)',\s*\n\s*fnName:\s*'([^']+)',(.*?)\n  \}",
            source, re.S):
        entry_id, fn_name, body = block.group(1), block.group(2), block.group(3)
        code = re.search(r"code:\s*`([^`]*)`", body, re.S)
        args_block = re.search(r"args:\s*\[(.*?)\n    \]", body, re.S)
        arg_names = re.findall(r"name:\s*'([^']+)'", args_block.group(1)) if args_block else []
        tune_block = re.search(r"tune:\s*\[([^\]]*)\]", body, re.S)
        tune = re.findall(r"'([^']+)'", tune_block.group(1)) if tune_block else []
        entries.append({
            "id":     entry_id,
            "fnName": fn_name,
            "args":   arg_names,
            "tune":   tune,
            "code":   code.group(1) if code else "",
        })
    return entries


# ── Phase 2 helpers: the generator's own rules ──────────────────────
# pf-script-builder.js -> buildCustomFunctionHelpers()
DEF_LINE_RE = re.compile(r"^def\s+(\w+)\s*\(([^)]*)\)")


def has_multiple_return_values(return_statement):
    """Port of hasMultipleReturnValues() in script.js."""
    value = re.sub(r"^return\s*", "", return_statement.strip())
    depth = 0
    for char in value:
        if char in "([{":
            depth += 1
        elif char in ")]}":
            depth -= 1
        elif char == "," and depth == 0:
            return True
    return False


def main():
    print("=" * 70)
    print("PRE-MADE CUSTOM FUNCTION LIBRARY AUDIT")
    print("=" * 70)

    entries = load_library(LIB_PATH)
    print(f"\nLoaded {len(entries)} entries from custom-functions.js\n")
    if not entries:
        print("FAIL  no entries parsed - the library file or this parser changed")
        return 1

    # ── Phase 1 + 2: shape and generator compatibility ──────────────
    print("PHASE 1/2 - shape and generator compatibility")
    seen_names = set()
    namespace = {}

    for entry in entries:
        label = entry["fnName"]
        code = entry["code"]

        try:
            tree = ast.parse(code)
        except SyntaxError as err:
            check(f"{label}: parses as Python", False, str(err))
            continue
        check(f"{label}: parses as Python", True)

        defs = [n for n in tree.body if isinstance(n, ast.FunctionDef)]
        check(f"{label}: exactly one top-level def",
              len(defs) == 1 and len(tree.body) == 1,
              f"{len(tree.body)} top-level statements")
        if len(defs) != 1:
            continue
        fn = defs[0]

        check(f"{label}: def name matches metadata", fn.name == entry["fnName"],
              f"def is {fn.name}")
        check(f"{label}: function name is unique", fn.name not in seen_names)
        seen_names.add(fn.name)

        signature = [a.arg for a in fn.args.args]
        check(f"{label}: arguments match metadata", signature == entry["args"],
              f"{signature} vs {entry['args']}")
        check(f"{label}: no *args / **kwargs",
              fn.args.vararg is None and fn.args.kwarg is None)
        check(f"{label}: no default values", not fn.args.defaults)

        returns = [n for n in ast.walk(fn) if isinstance(n, ast.Return)]
        check(f"{label}: has at least one return", len(returns) > 0)
        check(f"{label}: never returns a tuple",
              all(not isinstance(r.value, ast.Tuple) for r in returns))
        check(f"{label}: never returns bare (implicit None path aside)",
              all(r.value is not None for r in returns))
        check(f"{label}: every path returns, no fall-through",
              isinstance(fn.body[-1], ast.Return))
        check(f"{label}: has a docstring", ast.get_docstring(fn) is not None)

        # The generator reads the def line with this regular expression.
        match = DEF_LINE_RE.match(code.strip().split("\n")[0])
        check(f"{label}: def line parses in the generator", match is not None)
        if match:
            builder_args = [a.strip() for a in match.group(2).split(",") if a.strip()]
            check(f"{label}: generator reads the same arguments",
                  builder_args == entry["args"], f"{builder_args}")

        # script.js warns on a return that looks like a tuple.
        offenders = [line.strip() for line in code.split("\n")
                     if re.match(r"\s*return\b", line)
                     and has_multiple_return_values(re.sub(r"#.*$", "", line))]
        check(f"{label}: passes the tuple-return validator", not offenders,
              "; ".join(offenders))

        # Constants the metadata offers as tunable must exist in the body, so
        # the picker never tells a user to edit a name that is not there.
        assigned = {t.id for node in ast.walk(fn) if isinstance(node, ast.Assign)
                    for t in node.targets if isinstance(t, ast.Name)}
        missing = [c for c in entry["tune"] if c not in assigned]
        check(f"{label}: tunable constants exist in the body", not missing,
              ", ".join(missing))
        stray = [name for name in assigned
                 if name.isupper() and name not in entry["tune"]]
        check(f"{label}: every constant is listed as tunable", not stray,
              ", ".join(stray))

        exec(compile(tree, entry["id"], "exec"), namespace)

    # ── Phase 3: None-safety ────────────────────────────────────────
    print("\nPHASE 3 - every function survives missing results (None)")
    for entry in entries:
        fn = namespace.get(entry["fnName"])
        if fn is None:
            check(f"{entry['fnName']}: available for call", False)
            continue
        try:
            result = fn(*([None] * len(entry["args"])))
            scalar = result is None or isinstance(result, (int, float, str, bool))
            check(f"{entry['fnName']}: all-None arguments return a scalar", scalar,
                  repr(result))
        except Exception as err:  # noqa: BLE001 - the audit reports, never raises
            check(f"{entry['fnName']}: all-None arguments do not raise", False, repr(err))

    # ── Phase 4: behaviour ──────────────────────────────────────────
    print("\nPHASE 4 - hand-calculated behaviour")
    f = namespace

    # overload_flag - limit 100 %
    check("overload_flag(101.2) is True", f["overload_flag"](101.2) is True)
    check("overload_flag(100.0) is False (limit is exclusive)",
          f["overload_flag"](100.0) is False)
    check("overload_flag(None) is None", f["overload_flag"](None) is None)

    # voltage_band - band 0.9 to 1.1 pu
    check("voltage_band(0.89) = UNDERVOLTAGE", f["voltage_band"](0.89) == "UNDERVOLTAGE")
    check("voltage_band(0.90) = NORMAL (band edge included)",
          f["voltage_band"](0.90) == "NORMAL")
    check("voltage_band(1.10) = NORMAL (band edge included)",
          f["voltage_band"](1.10) == "NORMAL")
    check("voltage_band(1.11) = OVERVOLTAGE", f["voltage_band"](1.11) == "OVERVOLTAGE")
    check("voltage_band(None) = NO READ", f["voltage_band"](None) == "NO READ")

    # contingency_verdict
    cv = f["contingency_verdict"]
    check("contingency_verdict(80, 0.95, 1.05) = SECURE", cv(80, 0.95, 1.05) == "SECURE")
    check("contingency_verdict(120, 0.95, 1.05) = THERMAL", cv(120, 0.95, 1.05) == "THERMAL")
    check("contingency_verdict(80, 0.85, 1.05) = VOLTAGE", cv(80, 0.85, 1.05) == "VOLTAGE")
    check("contingency_verdict(80, 0.95, 1.15) = VOLTAGE", cv(80, 0.95, 1.15) == "VOLTAGE")
    check("contingency_verdict(120, 0.85, 1.0) = THERMAL+VOLTAGE",
          cv(120, 0.85, 1.0) == "THERMAL+VOLTAGE")

    # frt_verdict - fault at 0.1 s, floor 0.0 pu, recovery limit 0.43 s
    frt = f["frt_verdict"]
    check("frt_verdict(0.05, 0.40) = PASS (0.30 s recovery)",
          frt(0.05, 0.40) == "PASS")
    check("frt_verdict(-0.01, 0.40) = FAIL VOLTAGE", frt(-0.01, 0.40) == "FAIL VOLTAGE")
    check("frt_verdict(0.05, 0.60) = FAIL RECOVERY (0.50 s > 0.43 s)",
          frt(0.05, 0.60) == "FAIL RECOVERY")
    check("frt_verdict(0.05, nan) = FAIL RECOVERY (never settled)",
          frt(0.05, float("nan")) == "FAIL RECOVERY")
    check("frt_verdict(0.05, 0.05) = CHECK HOLD TIME (settled pre-fault)",
          frt(0.05, 0.05) == "CHECK HOLD TIME")

    # worst_bus_voltage
    wbv = f["worst_bus_voltage"]
    check("worst_bus_voltage(1.02, 0.93, 1.05) = 0.93", near(wbv(1.02, 0.93, 1.05), 0.93))
    check("worst_bus_voltage(1.02, 0.99, 1.12) = 1.12", near(wbv(1.02, 0.99, 1.12), 1.12))
    check("worst_bus_voltage(None, 0.95, None) = 0.95", near(wbv(None, 0.95, None), 0.95))
    check("worst_bus_voltage(None, None, None) = None", wbv(None, None, None) is None)

    # thermal_headroom_mw - 100 MW at 80 % loading has 25 MW of headroom
    th = f["thermal_headroom_mw"]
    check("thermal_headroom_mw(100, 80) = 25.0", near(th(100, 80), 25.0))
    check("thermal_headroom_mw(-100, 80) = 25.0 (direction ignored)",
          near(th(-100, 80), 25.0))
    check("thermal_headroom_mw(100, 125) = -20.0 (already overloaded)",
          near(th(100, 125), -20.0))
    check("thermal_headroom_mw(100, 0) = None", th(100, 0) is None)

    # frequency_margin_hz - 50 Hz base, 49 Hz first stage
    fm = f["frequency_margin_hz"]
    check("frequency_margin_hz(0.99) = 0.5 Hz", near(fm(0.99), 0.5, 1e-12))
    check("frequency_margin_hz(0.97) = -0.5 Hz", near(fm(0.97), -0.5, 1e-12))

    # power_factor - 80 MW / 60 Mvar is a 100 MVA point at 0.8
    pf = f["power_factor"]
    check("power_factor(80, 60) = 0.8", near(pf(80, 60), 0.8))
    check("power_factor(80, -60) = 0.8 (sign dropped)", near(pf(80, -60), 0.8))
    check("power_factor(100, 0) = 1.0", near(pf(100, 0), 1.0))
    check("power_factor(0, 0) = None", pf(0, 0) is None)

    # mva_utilisation_pct - rating 100 MVA
    mu = f["mva_utilisation_pct"]
    check("mva_utilisation_pct(80, 60) = 100 %", near(mu(80, 60), 100.0))
    check("mva_utilisation_pct(40, 30) = 50 %", near(mu(40, 30), 50.0))

    # loss_percent
    lp = f["loss_percent"]
    check("loss_percent(5, 250) = 2 %", near(lp(5, 250), 2.0))
    check("loss_percent(5, 0) = None", lp(5, 0) is None)

    # voltage_unbalance_pct
    vu = f["voltage_unbalance_pct"]
    check("voltage_unbalance_pct(0.012, 1.0) = 1.2 %", near(vu(0.012, 1.0), 1.2, 1e-12))
    check("voltage_unbalance_pct(0.012, 0) = None", vu(0.012, 0) is None)

    # angle_difference_deg - wraps across the +/-180 boundary
    ad = f["angle_difference_deg"]
    check("angle_difference_deg(12, 4) = 8", near(ad(12, 4), 8.0, 1e-12))
    check("angle_difference_deg(170, -170) = -20 (wrapped)", near(ad(170, -170), -20.0, 1e-12))
    check("angle_difference_deg(-170, 170) = 20 (wrapped)", near(ad(-170, 170), 20.0, 1e-12))

    # annual_loss_cost - 5 MW x 8760 h x 0.35 x 80 /MWh
    alc = f["annual_loss_cost"]
    check("annual_loss_cost(5) = 1,226,400", near(alc(5), 5 * 8760.0 * 0.35 * 80.0, 1e-6))
    check("annual_loss_cost(0) = 0", near(alc(0), 0.0))

    # capacitor_mvar_for_target_pf - target 0.95
    cap = f["capacitor_mvar_for_target_pf"]
    size = cap(100, 60)
    expected = 60 - 100 * math.tan(math.acos(0.95))
    check("capacitor_mvar_for_target_pf(100, 60) = 27.13 Mvar",
          near(size, expected, 1e-9), repr(size))
    q_left = 60 - size
    pf_after = 100 / math.hypot(100, q_left)
    check("power factor after that capacitor = 0.95", near(pf_after, 0.95, 1e-9),
          f"{pf_after:.6f}")
    check("capacitor_mvar_for_target_pf(100, 20) = 0 (already above target)",
          near(cap(100, 20), 0.0))
    check("capacitor_mvar_for_target_pf(0, 10) = 0", near(cap(0, 10), 0.0))

    # ── Summary ─────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print(f"SUMMARY: {PASS} passed, {FAIL} failed")
    print("=" * 70)
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
