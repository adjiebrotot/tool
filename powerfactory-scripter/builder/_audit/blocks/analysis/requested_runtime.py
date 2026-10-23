# Helpers the result blocks (js/blocks/result.js) need that the runtime does not have yet.
#
# REQUESTED FOR builder/runtime/base.py: paste these two sections into base.py unchanged, right
# after the "table" section (both read the tables that section keeps). Until then the analysis
# blocks tests load this file next to the real runtime files, and skip any section the runtime
# already defines.
#
#   table_pick   Table column (out.table.column): one column of a results table, or the value
#                in the row where another column is highest / lowest (the worst case, E13).
#   read_table   Read table from file (data.read): a CSV file or an Excel sheet into a named
#                table, so For each item can loop over its rows (the case workbook, E11).
#
# Both follow the runtime's rules: never raise on missing data (an empty table gives [] or None),
# plain-ASCII code, docstrings on public names, @needs complete (loader.check passes on them).

# @helper table_pick
# @needs table, convert
def table_pick(name, column, pick="all", of=None, kind="num"):
    """One column of the results table `name`: pick "all" gives its values top to bottom (an
    empty cell as None, so columns of one table stay in step); "max" / "min" give the value of
    `column` in the row where column `of` (default: `column` itself) is highest / lowest, for
    example the contingency with the highest loading. kind "num" gives numbers, "text" texts.
    A table or column that does not exist gives [] (or None)."""
    tbl = _TABLES.get(str(name))
    rows = tbl.rows if tbl is not None else []

    def conv(v):
        if kind == "text":
            return None if v is None or v == "" else as_text(v)
        return as_float(v)

    if pick not in ("max", "min"):
        return [conv(r.get(column)) for r in rows]
    key = of or column
    best = None
    for r in rows:
        v = as_float(r.get(key))
        if v is None or v != v:
            continue
        if best is None or (v > best[0] if pick == "max" else v < best[0]):
            best = (v, r)
    return conv(best[1].get(column)) if best is not None else None
# @end

# @helper read_table
# @needs table, log, convert, StopWorkflow
# @imports import csv
# @imports import io
# @imports import os
# @imports import re
# @imports import sys
def read_table(name, path, sheet="", layout="rows", header=1, decimal_comma=False):
    """Fill the results table `name` from a CSV file or an Excel sheet (.xlsx, .xlsm).

    layout "rows": one case per row, the header row names the columns; "columns": one case per
    column, the first column names the fields. header: the row (for "columns": the column) that
    holds the names, 1 for the first. Numbers become numbers (decimal_comma: 1,5 is 1.5), empty
    cells None, other text stays text (a code such as 007 stays text). Rows with no value are
    left out. The table is filled afresh and counts as saved, so the end of the run does not
    write it to the run folder again. A name without a folder is looked for in the current
    folder, then next to the script. Returns the table; stops the workflow with a plain message
    when the file cannot be read."""
    where = _rt_find(path)
    ext = os.path.splitext(where)[1].lower()
    if ext == ".xls":
        raise StopWorkflow(f"Read table from file: {where} is an old .xls file. Save it as .xlsx or .csv in Excel and use that file.")
    try:
        grid = _rt_xlsx(where, sheet) if ext in (".xlsx", ".xlsm") else _rt_csv(where)
    except StopWorkflow:
        raise
    except Exception as exc:
        raise StopWorkflow(f"Read table from file: could not read {where}: {type(exc).__name__}: {exc}")
    if str(layout or "rows").strip().lower() == "columns":
        width = max((len(r) for r in grid), default=0)
        grid = [[r[k] if k < len(r) else None for r in grid] for k in range(width)]
    h = max(1, int(as_float(header, 1) or 1))
    if len(grid) < h:
        raise StopWorkflow(f"Read table from file: {where} has no {'column' if layout == 'columns' else 'row'} {h} with the names.")
    names, seen = [], {}
    for k, v in enumerate(grid[h - 1]):
        nm = "" if v is None else str(v).strip()
        nm = nm or f"Column {k + 1}"
        c = seen.get(nm, 0)
        seen[nm] = c + 1
        names.append(nm if not c else f"{nm} ({c + 1})")
    rows = []
    for raw in grid[h:]:
        vals = [_rt_value(v, decimal_comma) for v in raw]
        if all(v is None for v in vals):
            continue
        if len(vals) > len(names):
            for k in range(len(names), len(vals)):
                names.append(f"Column {k + 1}")
        rows.append({names[k]: (vals[k] if k < len(vals) else None) for k in range(len(names))})
    # Columns with no name and no value (trailing blanks of a sheet) are left out.
    keep = [nm for k, nm in enumerate(names) if not nm.startswith("Column ") or any(r.get(nm) is not None for r in rows)]
    tbl = table(name)
    tbl.rows, tbl.columns = [], []
    for r in rows:
        tbl.add({nm: r.get(nm) for nm in keep}, with_ctx=False)
    tbl.columns = list(keep) if not rows else tbl.columns
    tbl.saved_rows = len(tbl.rows)
    log(f"Read {len(tbl.rows)} rows with {len(keep)} columns from {where} into table '{tbl.name}'.")
    return tbl


def _rt_find(path):
    p = os.path.expanduser(str(path or "").strip().strip('"'))
    if not p:
        raise StopWorkflow("Read table from file: no file is given. Fill in the file on the block (or its line in SETTINGS).")
    tried = []
    if os.path.isabs(p):
        tried.append(p)
    else:
        tried.append(os.path.abspath(p))
        here = globals().get("__file__") or (sys.argv[0] if sys.argv and sys.argv[0] else "")
        if here:
            tried.append(os.path.join(os.path.dirname(os.path.abspath(here)), p))
    for t in tried:
        if os.path.isfile(t):
            return t
    raise StopWorkflow("Read table from file: cannot find " + " or ".join(dict.fromkeys(tried)) + ".")


def _rt_csv(path):
    with open(path, "rb") as fh:
        data = fh.read()
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = data.decode("cp1252", errors="replace")
    sample = text[:4096]
    try:
        delim = csv.Sniffer().sniff(sample, delimiters=",;\t").delimiter
    except csv.Error:
        first = sample.splitlines()[0] if sample else ""
        delim = max((";", ",", "\t"), key=first.count)
    return [list(r) for r in csv.reader(io.StringIO(text), delimiter=delim)]


def _rt_xlsx(path, sheet=""):
    try:
        import openpyxl
    except ImportError:
        raise StopWorkflow("Read table from file: reading an Excel file needs the openpyxl package "
                           "(pip install openpyxl), or save the sheet as CSV.")
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    try:
        want = str(sheet or "").strip()
        if want and want not in wb.sheetnames:
            raise StopWorkflow(f"Read table from file: {path} has no sheet '{want}' (it has: {', '.join(wb.sheetnames)}).")
        ws = wb[want] if want else wb.worksheets[0]
        return [list(r) for r in ws.iter_rows(values_only=True)]
    finally:
        wb.close()


def _rt_value(v, decimal_comma=False):
    # A cell as a number, None (empty) or text.
    if v is None or isinstance(v, (bool, int, float)):
        return v
    if hasattr(v, "isoformat"):
        return v.isoformat()
    s = str(v).strip()
    if not s:
        return None
    t = s.replace(" ", "").replace(" ", "")
    if decimal_comma:
        t = t.replace(".", "").replace(",", ".")
    if re.fullmatch(r"[+-]?0\d+", t):
        return s
    if re.fullmatch(r"[+-]?\d+", t):
        return int(t)
    if re.fullmatch(r"[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?", t):
        return float(t)
    return s
# @end
