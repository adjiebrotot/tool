#!/usr/bin/env python3
"""Diff Python (standard accounting) vs JS app CSVs cell-by-cell."""
import csv, os, glob
HERE = os.path.dirname(os.path.abspath(__file__))

def load(path):
    with open(path) as f:
        rows = list(csv.reader(f))
    head, data = rows[0], rows[1:]
    return head, data

def num(s):
    try: return float(s)
    except: return None

def diff_file(py, js):
    h1, d1 = load(py); h2, d2 = load(js)
    assert h1 == h2, f"header mismatch {py}"
    out = []  # (year, col, pyval, jsval, delta)
    for r1, r2 in zip(d1, d2):
        yr = r1[0]
        for ci, col in enumerate(h1):
            a, b = num(r1[ci]), num(r2[ci])
            if a is None or b is None:
                if (r1[ci] or '') != (r2[ci] or ''):
                    out.append((yr, col, r1[ci], r2[ci], None))
                continue
            if abs(a - b) > 1:   # >$1 (whole-dollar CSVs)
                out.append((yr, col, a, b, b - a))
    return out

names = sorted({os.path.basename(p).rsplit('_',1)[0]
                for p in glob.glob(os.path.join(HERE,'py_out','*_own.csv'))})
print("="*78)
print("DISCREPANCIES: JS app  -  Python standard-accounting model  (>$1, whole-dollar)")
print("="*78)
for name in names:
    for kind in ('own','rent','rtb'):
        py = os.path.join(HERE,'py_out',f'{name}_{kind}.csv')
        js = os.path.join(HERE,'js_out',f'{name}_{kind}.csv')
        if not (os.path.exists(py) and os.path.exists(js)): continue
        d = diff_file(py, js)
        tag = f"{name} [{kind}]"
        if not d:
            print(f"  OK   {tag}: identical")
        else:
            # summarise by column
            cols = {}
            for yr,col,a,b,dl in d:
                cols.setdefault(col, []).append((yr,a,b,dl))
            print(f"  DIFF {tag}: {len(d)} cell(s) differ")
            for col, items in cols.items():
                worst = max(items, key=lambda x: abs(x[3]) if x[3] is not None else 0)
                yr,a,b,dl = worst
                rng = f"yrs {items[0][0]}..{items[-1][0]}" if len(items)>1 else f"yr {items[0][0]}"
                if dl is None:
                    print(f"        - {col}: {len(items)} cell(s), {rng}; e.g. yr{yr} py={a} js={b}")
                else:
                    print(f"        - {col}: {len(items)} cell(s), {rng}; worst yr{yr} py={a:,.0f} js={b:,.0f} (Δ={dl:+,.0f})")
print("="*78)
