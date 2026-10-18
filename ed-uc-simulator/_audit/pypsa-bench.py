"""Solve the ED/UC Simulator's benchmark cases in PyPSA itself (A10 in run.mjs).

    node ed-uc-simulator/_audit/pypsa-cases.mjs
    python ed-uc-simulator/_audit/pypsa-bench.py

Needs PyPSA 1.4 or later (piecewise marginal costs) and highspy. Reads
pypsa-cases.json and writes pypsa-fixtures.json. Each case is built here from
the tool's saved form, by code that shares nothing with the tool's ed-core.js
or with PSA.js, following the model the tool documents:

  - a cost curve is PyPSA's own piecewise marginal_cost ('piecewise'): the same
    breakpoints, equal pieces from 0 MW to the minimum stable loading and on to
    the rating, each priced at the chord of the cost curve a*P + q*P^2 + k*P^3;
  - in the linear relaxation PyPSA's piecewise cost scales its pieces with the
    unit's status and becomes a mixed-integer problem, so that case is built
    as the pieces themselves, one lossless link each from a bus of the unit's
    own ('links');
  - 'quadratic' is PyPSA's exact quadratic cost, marginal_cost and
    marginal_cost_quadratic, solved as a QP;
  - a unit that is on throughout (every unit in economic dispatch, one that is
    not committable under unit commitment) never runs below its minimum stable
    loading, or below what is available when that is less; the economic
    dispatch saved before that ('ed') runs every unit from zero.
"""

import json
import logging
import math
import subprocess
import sys
import warnings
from pathlib import Path

import pandas as pd
import pypsa

logging.disable(logging.WARNING)
warnings.filterwarnings("ignore")

HERE = Path(__file__).resolve().parent
SRC = json.loads((HERE / "pypsa-cases.json").read_text())
N = SRC["pieces"]
LINK_EPS = SRC["link_eps"]
DEFAULTS = {
    "Bus": {"v_nom": 1},
    "Line": {"length": 0, "num_parallel": 1, "r": 0, "x": 0, "s_nom": 0},
    "Generator": {"p_nom": 0, "marginal_cost": 0, "committable": 0, "p_min_pu": 0, "start_up_cost": 0, "shut_down_cost": 0,
                  "stand_by_cost": 0, "min_up_time": 0, "min_down_time": 0, "ramp_limit_up": 1, "ramp_limit_down": 1,
                  "init": 1, "mcurve": "", "marginal_cost_quadratic": 0, "marginal_cost_cubic": 0},
    "Load": {"p_set": 0},
    "StorageUnit": {"p_nom": 0, "max_hours": 1, "eff": 1, "soc0": 0, "cyclic": 1},
    "Link": {"p_nom": 0, "efficiency": 1, "both": 1},
}


def full(e):
    return {**DEFAULTS.get(e["c"], {}), **e}


def has_curve(g):
    q, k = g["marginal_cost_quadratic"], g["marginal_cost_cubic"]
    return (g["mcurve"] == "lin" and q != 0) or (g["mcurve"] == "quad" and (q != 0 or k != 0))


def cost_of(g, p):
    k = g["marginal_cost_cubic"] if g["mcurve"] == "quad" else 0
    return g["marginal_cost"] * p + g["marginal_cost_quadratic"] * p * p + k * p ** 3


def pieces(g):
    """Breakpoints in MW and the slope of each piece."""
    P = g["p_nom"]
    pm = min(1, max(0, g["p_min_pu"])) * P
    lo = min(N - 1, max(1, math.floor(N * pm / P + 0.5))) if 0 < pm < P else 0
    base = pm if lo else 0
    hi = N - lo
    x = [0.0] + [pm if i == lo else pm * i / lo for i in range(1, lo + 1)]
    x += [P if j == hi else base + (P - base) * j / hi for j in range(1, hi + 1)]
    s = [(cost_of(g, x[i + 1]) - cost_of(g, x[i])) / (x[i + 1] - x[i]) for i in range(len(x) - 1)]
    return x, s


def build(case):
    o, H, ser = case["opts"], case["opts"]["hours"], case["series"]
    mode, how = o["mode"], case["cost"]
    commits = mode in ("uc", "lin")
    el = [full(e) for e in case["model"]["el"]]
    by = {e["id"]: e for e in el}
    n = pypsa.Network()
    n.set_snapshots(range(H))
    for b in (e for e in el if e["c"] == "Bus"):
        n.add("Bus", f"b{b['id']}", v_nom=b["v_nom"])
    for ln in (e for e in el if e["c"] == "Line"):
        n.add("Line", f"l{ln['id']}", bus0=f"b{ln['bus0']}", bus1=f"b{ln['bus1']}", r=ln["r"], x=ln["x"],
              s_nom=ln["s_nom"] if o["limits"] and ln["s_nom"] > 0 else 1e6)
    gens = [e for e in el if e["c"] == "Generator" and e.get("bus") in by]
    for g in gens:
        name, bus = f"g{g['id']}", f"b{g['bus']}"
        avail = list(ser[str(g["id"])])
        com = bool(g["committable"]) and commits
        up = g["ramp_limit_up"] if g["ramp_limit_up"] < 1 else None
        down = g["ramp_limit_down"] if g["ramp_limit_down"] < 1 else None
        kw = {"p_nom": g["p_nom"]}
        if com:
            su_ramp = min(1, up + g["p_min_pu"]) if up is not None else None
            sd_ramp = min(1, down + g["p_min_pu"]) if down is not None else None
            # Off before the first hour, it starts no higher than its minimum plus a ramp.
            if not g["init"] and su_ramp is not None and su_ramp < avail[0]:
                avail[0] = su_ramp
            kw.update(committable=True, p_min_pu=g["p_min_pu"], start_up_cost=g["start_up_cost"], shut_down_cost=g["shut_down_cost"],
                      stand_by_cost=g["stand_by_cost"], min_up_time=g["min_up_time"], min_down_time=g["min_down_time"],
                      up_time_before=max(1, g["min_up_time"]) if g["init"] else 0,
                      down_time_before=0 if g["init"] else max(1, g["min_down_time"]))
            if up is not None:
                kw.update(ramp_limit_up=up, ramp_limit_start_up=su_ramp)
            if down is not None:
                kw.update(ramp_limit_down=down, ramp_limit_shut_down=sd_ramp)
        else:
            on_throughout = mode == "edm" or (commits and not g["committable"])
            if on_throughout and g["p_min_pu"] > 0:
                kw["p_min_pu"] = pd.Series([min(g["p_min_pu"], a) for a in avail], index=n.snapshots)
            if up is not None:
                kw["ramp_limit_up"] = up
            if down is not None:
                kw["ramp_limit_down"] = down
        kw["p_max_pu"] = pd.Series(avail, index=n.snapshots)
        if has_curve(g) and how == "piecewise":
            x, s = pieces(g)
            kw["marginal_cost"] = pd.DataFrame({"p_pu": [v / g["p_nom"] for v in x], "marginal_cost": [s[0]] + s})
            n.add("Generator", name, bus=bus, **kw)
        elif has_curve(g) and how == "links":
            x, s = pieces(g)
            n.add("Bus", name + "u", v_nom=by[g["bus"]]["v_nom"])
            n.add("Generator", name, bus=name + "u", marginal_cost=0, **kw)
            for i, slope in enumerate(s):
                n.add("Link", f"{name}c{i}", bus0=name + "u", bus1=bus, p_nom=x[i + 1] - x[i], efficiency=1, marginal_cost=slope)
        elif has_curve(g) and how == "quadratic":
            assert g["mcurve"] == "lin"
            n.add("Generator", name, bus=bus, marginal_cost=g["marginal_cost"], marginal_cost_quadratic=g["marginal_cost_quadratic"], **kw)
        else:
            n.add("Generator", name, bus=bus, marginal_cost=g["marginal_cost"], **kw)
    bus_load = {}
    for ld in (e for e in el if e["c"] == "Load" and e.get("bus") in by):
        s = ser[str(ld["id"])]
        n.add("Load", f"d{ld['id']}", bus=f"b{ld['bus']}", p_set=pd.Series(s, index=n.snapshots))
        acc = bus_load.setdefault(ld["bus"], [0.0] * H)
        for t in range(H):
            acc[t] += s[t]
    if o["shed"]:
        for b, s in bus_load.items():
            if max(s) > 0:
                n.add("Generator", f"shed{b}", bus=f"b{b}", p_nom=max(s), marginal_cost=o["voll"])
    for st in (e for e in el if e["c"] == "StorageUnit" and e.get("bus") in by):
        ef = math.sqrt(st["eff"])
        n.add("StorageUnit", f"s{st['id']}", bus=f"b{st['bus']}", p_nom=st["p_nom"], max_hours=st["max_hours"],
              efficiency_store=ef, efficiency_dispatch=ef, cyclic_state_of_charge=bool(st["cyclic"]),
              state_of_charge_initial=0 if st["cyclic"] else st["soc0"] * st["p_nom"] * st["max_hours"])
    for lk in (e for e in el if e["c"] == "Link"):
        a, b = f"b{lk['bus0']}", f"b{lk['bus1']}"
        if lk["both"] and lk["efficiency"] < 1:
            n.add("Link", f"k{lk['id']}", bus0=a, bus1=b, p_nom=lk["p_nom"], efficiency=lk["efficiency"], marginal_cost=LINK_EPS)
            n.add("Link", f"k{lk['id']}r", bus0=b, bus1=a, p_nom=lk["p_nom"], efficiency=lk["efficiency"], marginal_cost=LINK_EPS)
        else:
            n.add("Link", f"k{lk['id']}", bus0=a, bus1=b, p_nom=lk["p_nom"], efficiency=lk["efficiency"], p_min_pu=-1 if lk["both"] else 0)
    return n, gens, [e for e in el if e["c"] == "Bus"]


def run(case):
    n, gens, buses = build(case)
    mode = case["opts"]["mode"]
    status, cond = n.optimize(solver_name="highs", linearized_unit_commitment=mode == "lin", include_objective_constant=False,
                              solver_options={"mip_rel_gap": 1e-6, "output_flag": False})
    if status != "ok" or cond != "optimal":
        raise RuntimeError(f"{case['name']}: {status} {cond}")
    out = {"name": case["name"], "objective": float(n.objective),
           "p": {str(g["id"]): [float(v) for v in n.generators_t.p[f"g{g['id']}"]] for g in gens}}
    com = [g for g in gens if g["committable"] and mode in ("uc", "lin")]
    if com:
        out["status"] = {str(g["id"]): [float(v) for v in n.generators_t.status[f"g{g['id']}"]] for g in com}
    # A mixed-integer problem has no duals.
    if mode != "uc" or not com:
        out["price"] = {str(b["id"]): [float(v) for v in n.buses_t.marginal_price[f"b{b['id']}"]] for b in buses}
    return out


def pypsa_version():
    """The release, and the commit when PyPSA runs from a clone."""
    try:
        sha = subprocess.run(["git", "-C", str(Path(pypsa.__file__).parent), "rev-parse", "--short", "HEAD"],
                             capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        sha = ""
    return pypsa.__version__ + (f" (git {sha})" if sha else "")


def main():
    res = {"pypsa": pypsa_version(), "pieces": N, "cases": []}
    for case in SRC["cases"]:
        r = run(case)
        res["cases"].append(r)
        print(f"  {case['name']}: objective {r['objective']:.4f}")
    (HERE / "pypsa-fixtures.json").write_text(json.dumps(res, indent=1) + "\n")
    print(f"wrote {len(res['cases'])} fixtures with PyPSA {res['pypsa']}")


if __name__ == "__main__":
    sys.exit(main())
