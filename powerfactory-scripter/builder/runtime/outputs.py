# Workflow Builder runtime: graphs and curve files (no PowerFactory calls).
#
# Same section format as base.py. Every graph is drawn with matplotlib on the Agg backend (no
# window, so it also works inside PowerFactory and on a server), saved as a PNG in the run
# folder's "graphs" sub folder through out_file (loop values in the name, never overwritten),
# stamped with the Builder's credit as vector outlines (TextPath, like the form-based Scripter),
# and closed straight away so a sweep of 500 passes does not hold 500 figures in memory.
#
# A graph must never lose a result (the rule of the user's ESS scripts): every public function
# here catches its own failures, logs them and returns None, and returns None with a warning
# when there is nothing to draw. matplotlib is imported on first use, so a workflow without
# graphs never needs it and preflight() can name the missing package before connecting.
# Colours: the site's validated chart palette (eight categorical slots in a fixed order, a blue
# ramp for magnitudes and for more than eight ordered lines, status colours for pass / fail).
# Private names start with _po_ so they cannot clash once everything is in one script.

# @helper plot_common
# @needs log, run_dir, ctx, convert
# @imports import math
# @imports import warnings
_PO = {"plt": None, "missing": False, "collect": {}}
_PO_CREDIT = "Made with tool.adjiebrotots.com/powerfactory-scripter/builder"
_PO_SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"]
_PO_RAMP = ["#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7", "#3987e5",
            "#2a78d6", "#256abf", "#1c5cab", "#184f95", "#104281", "#0d366b"]
_PO_STATUS = {"pass": "#0ca30c", "fail": "#d03b3b", "unknown": "#898781"}
_PO_INK = {"primary": "#0b0b0b", "secondary": "#52514e", "muted": "#898781", "grid": "#e1e0d9",
           "axis": "#c3c2b7", "surface": "#ffffff"}
_PO_SIZE = (10.0, 5.6)
_PO_DPI = 120


def _po_plt():
    # pyplot on the Agg backend, imported once on first use.
    if _PO["plt"] is None:
        import matplotlib
        try:
            matplotlib.use("Agg")
        except Exception:
            pass
        import matplotlib.pyplot as plt
        if "text.parse_math" in matplotlib.rcParams:
            # A label such as "Cost ($)" must print as written, not as maths.
            matplotlib.rcParams["text.parse_math"] = False
        _PO["plt"] = plt
    return _PO["plt"]


def _po_watermark(fig):
    # The credit as glyph outlines (TextPath -> PathPatch), bottom right, faint: a vector
    # shape, not an editable text object. Placed in inches so any save dpi keeps it in place.
    from matplotlib.textpath import TextPath
    from matplotlib.patches import PathPatch
    from matplotlib.transforms import Affine2D
    tp = TextPath((0, 0), _PO_CREDIT, size=7)
    bb = tp.get_extents()
    w_in, _h_in = fig.get_size_inches()
    margin = 6.0 / 72.0
    tx = w_in - margin - bb.x1 / 72.0
    ty = margin - bb.y0 / 72.0
    patch = PathPatch(tp, transform=Affine2D().scale(1.0 / 72.0).translate(tx, ty) + fig.dpi_scale_trans,
                      facecolor="#333333", edgecolor="none", alpha=0.25)
    fig.add_artist(patch)
    return patch


def _po_close(fig):
    try:
        _po_plt().close(fig)
    except Exception:
        pass


def _po_figure(three_d=False):
    plt = _po_plt()
    fig = plt.figure(figsize=_PO_SIZE, dpi=_PO_DPI)
    fig.patch.set_facecolor(_PO_INK["surface"])
    if three_d:
        import mpl_toolkits.mplot3d  # noqa: F401  (registers the 3d projection)
        ax = fig.add_subplot(1, 1, 1, projection="3d")
    else:
        ax = fig.add_subplot(1, 1, 1)
        _po_style(ax)
    return fig, ax


def _po_style(ax):
    ax.set_facecolor(_PO_INK["surface"])
    ax.grid(True, color=_PO_INK["grid"], linewidth=0.6)
    ax.set_axisbelow(True)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        ax.spines[side].set_color(_PO_INK["axis"])
    ax.tick_params(colors=_PO_INK["secondary"], labelsize=9)


def _po_axis(label, unit=""):
    """'Frequency (Hz)' from a label and a unit; the unit is not repeated when the label has it."""
    label = str(label or "").strip()
    unit = str(unit or "").strip()
    if not unit:
        return label
    if label.endswith(f"({unit})") or label.endswith(f"[{unit}]"):
        return label
    return f"{label} ({unit})" if label else f"Value ({unit})"


def _po_labels(ax, xlabel="", ylabel="", zlabel=None):
    ax.set_xlabel(xlabel, color=_PO_INK["secondary"], fontsize=10)
    ax.set_ylabel(ylabel, color=_PO_INK["secondary"], fontsize=10)
    if zlabel is not None and hasattr(ax, "set_zlabel"):
        ax.set_zlabel(zlabel, color=_PO_INK["secondary"], fontsize=10)


def _po_title(ax, title, context=True):
    # The title, with the loop values ("Dispatch (MW) = 200") as a smaller line under it when
    # the graph is drawn inside a loop.
    sub = ctx_text() if context else ""
    ax.set_title(str(title or ""), loc="left", fontsize=12, color=_PO_INK["primary"],
                 pad=18 if sub else 8)
    if sub:
        ax.text(0.0, 1.015, sub, transform=ax.transAxes, fontsize=9, color=_PO_INK["secondary"],
                va="bottom", ha="left")


def _po_note(fig, note):
    if note:
        text = str(note)
        if len(text) > 160:
            text = text[:157] + "..."
        fig.text(0.01, 0.012, text, fontsize=7.5, color=_PO_INK["secondary"], ha="left", va="bottom")


def _po_colors(n):
    # Up to eight lines: the categorical slots in their fixed order. More (for example every
    # pass of a sweep on one graph): one blue ramp, light to dark, so the order still reads
    # and no hue is invented.
    if n <= len(_PO_SERIES):
        return _PO_SERIES[:n]
    lo, hi = 3, len(_PO_RAMP) - 1          # from step 250 (still visible on white) to 700
    out = []
    for k in range(n):
        pos = lo + (hi - lo) * (k / max(1, n - 1))
        a = int(math.floor(pos))
        b = min(a + 1, hi)
        out.append(_po_mix(_PO_RAMP[a], _PO_RAMP[b], pos - a))
    return out


def _po_mix(c1, c2, w):
    r1, g1, b1 = (int(c1[i:i + 2], 16) for i in (1, 3, 5))
    r2, g2, b2 = (int(c2[i:i + 2], 16) for i in (1, 3, 5))
    return "#%02x%02x%02x" % (round(r1 + (r2 - r1) * w), round(g1 + (g2 - g1) * w), round(b1 + (b2 - b1) * w))


def _po_cmap():
    from matplotlib.colors import LinearSegmentedColormap
    return LinearSegmentedColormap.from_list("pfb_blue", _PO_RAMP)


def _po_num(v):
    """A float, or NaN when v is missing or not a number (a gap in a line)."""
    f = as_float(v)
    return float("nan") if f is None else f


def _po_xpos(xs):
    # Numeric x values stay numbers; any text makes the axis categorical, in the order the
    # values first appear. Returns (positions, tick labels or None).
    nums = [float("nan") if v is None or v == "" else as_float(v) for v in xs]
    if all(n is not None for n in nums):
        return nums, None
    cats = []
    for v in xs:
        key = as_text(v)
        if key not in cats:
            cats.append(key)
    return [float(cats.index(as_text(v))) for v in xs], cats


def _po_grid(x, y, z):
    # (xs, ys, Z) when the points (x, y) fill a whole grid (Z[j][i] at ys[j], xs[i]; repeated
    # points averaged), else None. Also accepts z as rows (one list per y value).
    if z and all(isinstance(r, (list, tuple)) for r in z):
        xs = [_po_num(v) for v in (x or range(len(z[0])))]
        ys = [_po_num(v) for v in (y or range(len(z)))]
        if any(v != v for v in xs):          # names along x: draw them at 0, 1, 2 ...
            xs = [float(i) for i in range(len(xs))]
        if any(v != v for v in ys):
            ys = [float(i) for i in range(len(ys))]
        Z = [[_po_num(v) for v in row[:len(xs)]] for row in z[:len(ys)]]
        if len(Z) == len(ys) and all(len(r) == len(xs) for r in Z) and len(xs) >= 2 and len(ys) >= 2:
            return xs, ys, Z
        return None
    pts = [(as_float(a), as_float(b), _po_num(c)) for a, b, c in zip(x or [], y or [], z or [])]
    pts = [p for p in pts if p[0] is not None and p[1] is not None]
    xs = sorted({p[0] for p in pts})
    ys = sorted({p[1] for p in pts})
    if len(xs) < 2 or len(ys) < 2:
        return None
    cells = {}
    for a, b, c in pts:
        cells.setdefault((a, b), []).append(c)
    if len(cells) != len(xs) * len(ys):
        return None
    Z = []
    for b in ys:
        row = []
        for a in xs:
            vals = [c for c in cells[(a, b)] if c == c]
            row.append(sum(vals) / len(vals) if vals else float("nan"))
        Z.append(row)
    return xs, ys, Z


def _po_save(fig, stem):
    _po_watermark(fig)
    try:
        with warnings.catch_warnings():
            # 3D axes and colour bars make tight_layout warn; the layout is still usable.
            warnings.simplefilter("ignore")
            fig.tight_layout(rect=(0, 0.035, 1, 1))
    except Exception:
        pass
    path = out_file(stem or "graph", "png", sub="graphs")
    fig.savefig(path, dpi=_PO_DPI, facecolor=fig.get_facecolor())
    log(f"Saved graph: {path}")
    return path


def _po_run(what, title, draw):
    # Draw, save, close; never raise (a graph must never lose a result). draw() returns
    # (fig, stem), or None when there is nothing to draw (it has logged why).
    fig = None
    try:
        try:
            _po_plt()
        except ImportError:
            if not _PO["missing"]:
                _PO["missing"] = True
                log("matplotlib is not installed, so no graphs are drawn. Install it with: "
                    "python -m pip install matplotlib", "error")
            return None
        made = draw()
        if made is None:
            return None
        fig, stem = made
        return _po_save(fig, stem)
    except Exception as exc:
        log(f"Could not draw the {what} '{title or 'untitled'}': {type(exc).__name__}: {exc}", "error")
        return None
    finally:
        if fig is not None:
            _po_close(fig)


def _po_skip(what, title, why):
    log(f"{what} '{title or 'untitled'}' not drawn: {why}.", "warn")
    return None


def _po_hlines(ax, limits):
    # Horizontal limit lines: a number, (value, label) or {"value": v, "label": text}.
    for item in limits or []:
        if isinstance(item, dict):
            v, lab = item.get("value", item.get("y")), item.get("label", "")
        elif isinstance(item, (list, tuple)):
            v, lab = (list(item) + [None, ""])[:2]
        else:
            v, lab = item, ""
        f = as_float(v)
        if f is None or f != f:
            continue
        ax.axhline(f, color=_PO_INK["secondary"], linestyle="--", linewidth=1.0, zorder=1)
        ax.annotate(str(lab or f"{f:.6g}"), xy=(1.0, f), xycoords=("axes fraction", "data"),
                    xytext=(-4, 3), textcoords="offset points", ha="right", va="bottom",
                    fontsize=8, color=_PO_INK["secondary"])
# @end

# @helper plot_series
# @needs plot_common
def plot_series(series, labels=None, title="", ylabel="", unit=None, limits=None, marks=None,
                t_event=None, events=True, note="", stem=None, context=True, xlabel="Time (s)"):
    """Draw one or more time series on one graph and save it as a PNG; returns the file path.

    series: a Series or a list of them (empty ones are left out). labels: the legend names
    (default each series' label). ylabel and unit name the y axis ("Frequency" and "Hz"; unit
    defaults to the series' unit when they share one). limits: horizontal dashed lines, each a
    number, (value, label) or {"value", "label"}. marks: points to mark, each (t, y), (t, y,
    label) or a check result with time and value (for example a Frequency nadir result).
    Dotted vertical lines show the series' simulation events (events=True) and t_event (s).
    note: a footnote (for example the spikes removed). In a loop the loop values are shown
    under the title and added to the file name. Returns None, with a warning, when there is
    nothing to draw."""
    items = [series] if hasattr(series, "t") else [s for s in (series or []) if s is not None]
    names = list(labels) if isinstance(labels, (list, tuple)) else ([labels] if labels else [])
    pairs = []
    for k, s in enumerate(items):
        if not hasattr(s, "t") or len(getattr(s, "t")) == 0:
            continue
        ys = [_po_num(v) for v in s.y]
        if not any(v == v and math.isfinite(v) for v in ys):
            continue
        name = names[k] if k < len(names) and names[k] else (getattr(s, "label", "") or f"Series {k + 1}")
        pairs.append((s, [float(v) for v in s.t], ys, str(name)))
    head = title or ylabel or (pairs[0][3] if pairs else "")

    def draw():
        if not pairs:
            return _po_skip("Time series graph", head, "no series with samples")
        units = {str(getattr(s, "unit", "") or "") for s, _, _, _ in pairs}
        yunit = unit if unit is not None else (units.pop() if len(units) == 1 else "")
        fig, ax = _po_figure()
        colors = _po_colors(len(pairs))
        for (s, ts, ys, name), color in zip(pairs, colors):
            ax.plot(ts, ys, color=color, linewidth=1.5, label=name, zorder=3)
        lines_at = {}
        if events:
            for s, _, _, _ in pairs:
                for et, el in getattr(s, "events", None) or []:
                    lines_at.setdefault(round(float(et), 9), str(el))
        te = as_float(t_event)
        if te is not None and te == te:
            lines_at.setdefault(round(te, 9), "")
        for et in sorted(lines_at):
            ax.axvline(et, color=_PO_INK["muted"], linestyle=":", linewidth=1.0, zorder=1)
            if lines_at[et]:
                ax.annotate(lines_at[et], xy=(et, 1.0), xycoords=("data", "axes fraction"),
                            xytext=(3, -3), textcoords="offset points", ha="left", va="top",
                            fontsize=8, color=_PO_INK["muted"], rotation=90, zorder=2,
                            bbox={"facecolor": _PO_INK["surface"], "edgecolor": "none", "pad": 1.0, "alpha": 0.85})
        _po_hlines(ax, limits)
        for m in marks or []:
            _po_mark(ax, m, yunit)
        ylab = _po_axis(ylabel or (pairs[0][3] if len(pairs) == 1 else ""), yunit)
        _po_labels(ax, xlabel, ylab)
        _po_title(ax, head, context)
        if len(pairs) > 1:
            ax.legend(fontsize=8, frameon=False, loc="best", ncol=1 if len(pairs) <= 10 else 2)
        _po_note(fig, note)
        return fig, stem or head or "time_series"

    return _po_run("time series graph", head, draw)


def _po_mark(ax, m, unit=""):
    # A marked point: (t, y), (t, y, label), {"t", "y", "label"} or a result with time / value
    # (a COLLAPSE nadir result is marked at its minimum).
    t = y = None
    lab = ""
    if isinstance(m, dict):
        t, y, lab = m.get("t", m.get("x")), m.get("y", m.get("value")), m.get("label", "")
    elif isinstance(m, (list, tuple)):
        t, y, lab = (list(m) + [None, None, ""])[:3]
    elif m is not None:
        t, y = getattr(m, "time", None), getattr(m, "value", None)
        if t is None or y is None:
            t, y = getattr(m, "min_time", None), getattr(m, "minimum", None)
        kind = str(getattr(m, "verdict", "") or "")
        if y is not None:
            text = f"{as_float(y):.6g}" + (f" {unit}" if unit else "")
            if kind == "NADIR":
                lab = f"Nadir {text}"
            elif kind:
                lab = f"Minimum {text} ({kind.lower()})"
            else:
                lab = text
    t, y = as_float(t), as_float(y)
    if t is None or y is None or t != t or y != y:
        return
    ax.plot([t], [y], marker="o", markersize=7, color=_PO_INK["primary"], markeredgecolor="white",
            markeredgewidth=1.5, linestyle="none", zorder=5)
    if lab:
        # Near the right edge the label goes to the left of the point, so it stays inside the
        # plot and the layout does not shrink the axes to make room for it.
        x0, x1 = ax.get_xlim()
        right = x1 > x0 and (t - x0) / (x1 - x0) > 0.8
        ax.annotate(str(lab), xy=(t, y), xytext=(-6 if right else 6, -12), textcoords="offset points",
                    fontsize=8.5, color=_PO_INK["primary"], ha="right" if right else "left")
# @end

# @helper collect_series
# @needs plot_series
def collect_series(key, series, label=None):
    """Keep a series (or a list of them) of this loop pass for a graph with every pass on it.
    key names the graph (one per Draw time series graph block); label defaults to the loop
    values ("Dispatch (MW) = 200"), with the series' own label added when a pass gives several.
    draw_collected(key, ...) after the loop draws them."""
    items = [series] if hasattr(series, "t") else [s for s in (series or []) if s is not None]
    names = list(label) if isinstance(label, (list, tuple)) else [label] * len(items)
    where = ctx_text()
    bucket = _PO["collect"].setdefault(str(key), [])
    for k, s in enumerate(items):
        if not hasattr(s, "t"):
            continue
        name = names[k] if k < len(names) and names[k] else ""
        if not name:
            own = getattr(s, "label", "") or ""
            name = f"{where}: {own}" if (where and own and len(items) > 1) else (where or own or f"Pass {len(bucket) + 1}")
        bucket.append((s, str(name)))
    return len(bucket)


def draw_collected(key, title="", ylabel="", unit=None, limits=None, marks=None, t_event=None,
                   events=True, note="", stem=None, xlabel="Time (s)"):
    """Draw every series kept with collect_series(key, ...) on one graph (one line per pass),
    then forget them so a loop around this one starts a fresh graph. Same options as
    plot_series. Returns the file path, or None with a warning when nothing was kept."""
    bucket = _PO["collect"].pop(str(key), [])
    head = title or "Time series, every pass"
    if not bucket:
        return _po_skip("Time series graph", head, "no pass kept a series for it")
    return plot_series([s for s, _ in bucket], [n for _, n in bucket], title=head,
                       ylabel=ylabel, unit=unit, limits=limits, marks=marks, t_event=t_event,
                       events=events, note=note, stem=stem, context=True, xlabel=xlabel)
# @end

# @helper plot_xy
# @needs plot_common
def plot_xy(x, ys, labels=None, kind="line", title="", xlabel="", xunit="", ylabel="", yunit="",
            limits=None, stem=None, context=True):
    """Draw y against x as lines, points (kind "scatter") or bars ("bar") and save a PNG;
    returns the file path.

    x: a list of numbers or names (names give one bar or tick each, in their order). ys: one
    list of numbers, several lists, or {label: list}; each is drawn against x (cut to the
    shorter length, with a warning). Missing values leave a gap. labels: legend names.
    xlabel / xunit and ylabel / yunit name the axes ("Dispatch", "MW"). limits: horizontal
    dashed lines as in plot_series. Returns None, with a warning, when there is nothing to
    draw."""
    cols, names = _po_split_ys(ys, labels)
    head = title or ylabel or (names[0] if names else "")
    xs = as_items(x) if x is not None else (list(range(1, len(cols[0]) + 1)) if cols else [])
    return _po_run("2D graph", head, lambda: _po_draw_xy(xs, cols, names, kind, head, xlabel, xunit,
                                                          ylabel, yunit, limits, stem, context))


def _po_split_ys(ys, labels):
    # (list of value lists, names) from one list, several lists, Series or {label: list}.
    names = list(labels) if isinstance(labels, (list, tuple)) else ([labels] if labels else [])
    if ys is None:
        return [], names
    if isinstance(ys, dict):
        cols = [as_items(v) for v in ys.values()]
        keys = [str(k) for k in ys.keys()]
        return cols, [names[k] if k < len(names) and names[k] else keys[k] for k in range(len(cols))]
    if hasattr(ys, "t") and hasattr(ys, "y"):
        ys = [ys]
    items = as_items(ys)
    many = any(isinstance(v, (list, tuple)) or (hasattr(v, "t") and hasattr(v, "y")) for v in items)
    cols = [as_items(v) for v in items] if many else [items]
    out = []
    for k, c in enumerate(cols):
        src = items[k] if many else None
        auto = getattr(src, "label", "") if src is not None else ""
        out.append(names[k] if k < len(names) and names[k] else (auto or (f"Series {k + 1}" if len(cols) > 1 else "")))
    return cols, out


def _po_draw_xy(xs, cols, names, kind, head, xlabel, xunit, ylabel, yunit, limits, stem, context,
                group_x=None):
    lines = []
    for k, col in enumerate(cols):
        own_x = group_x[k] if group_x is not None else xs
        n = min(len(own_x), len(col))
        if n < len(col) or n < len(own_x):
            log(f"2D graph '{head}': {names[k] or 'a line'} has {len(col)} values for {len(own_x)} x values; "
                f"using the first {n}.", "warn")
        gx = list(own_x[:n])
        ys = [_po_num(v) for v in col[:n]]
        if any(v == v and math.isfinite(v) for v in ys):
            lines.append((gx, ys, names[k] if k < len(names) else ""))
    if not lines:
        return _po_skip("2D graph", head, "no numbers to draw")
    k = str(kind or "line").strip().lower()
    all_x = [v for gx, _, _ in lines for v in gx]
    pos_all, cats = _po_xpos(all_x)
    fig, ax = _po_figure()
    colors = _po_colors(len(lines))
    width = 0.8 / len(lines)
    start = 0
    for idx, ((gx, ys, name), color) in enumerate(zip(lines, colors)):
        pos = pos_all[start:start + len(gx)]
        start += len(gx)
        if k == "bar":
            if cats is None and len(lines) == 1:
                ax.bar(pos, ys, color=color, label=name or None, zorder=3,
                       width=_po_bar_width(pos))
            else:
                base = pos if cats is not None else list(range(len(gx)))
                ax.bar([p - 0.4 + width * (idx + 0.5) for p in base], ys, width=width * 0.92,
                       color=color, label=name or None, zorder=3)
        elif k == "scatter":
            ax.plot(pos, ys, linestyle="none", marker="o", markersize=6, color=color,
                    markeredgecolor="white", markeredgewidth=1.0, label=name or None, zorder=3)
        else:
            ax.plot(pos, ys, color=color, linewidth=1.5, marker="o" if len(ys) <= 40 else None,
                    markersize=4, label=name or None, zorder=3)
    if k == "bar":
        ax.grid(False, axis="x")
    if cats is not None:
        ax.set_xticks(list(range(len(cats))))
        ax.set_xticklabels(cats, rotation=30 if max(len(c) for c in cats) > 6 else 0,
                           ha="right" if max(len(c) for c in cats) > 6 else "center")
    elif k == "bar" and len(lines) > 1:
        ax.set_xticks(list(range(len(lines[0][0]))))
        ax.set_xticklabels([as_text(v) for v in lines[0][0]])
    _po_hlines(ax, limits)
    ylab = _po_axis(ylabel or (lines[0][2] if len(lines) == 1 else ""), yunit)
    _po_labels(ax, _po_axis(xlabel, xunit), ylab)
    _po_title(ax, head, context)
    if len(lines) > 1:
        ax.legend(fontsize=8, frameon=False, loc="best")
    return fig, stem or head or "graph"


def _po_bar_width(pos):
    gaps = sorted(b - a for a, b in zip(sorted(pos), sorted(pos)[1:]) if b > a)
    return 0.8 * (gaps[0] if gaps else 1.0)
# @end

# @helper plot_3d
# @needs plot_common
def plot_3d(x, y, z, kind="surface", title="", xlabel="", xunit="", ylabel="", yunit="",
            zlabel="", zunit="", stem=None, context=True):
    """Draw z over x and y in 3D and save a PNG; returns the file path.

    x, y, z: three lists of the same length, one point each (for example three columns of a
    results table), or z as rows (one list per y value) over x and y. kind "surface" (or
    "wireframe") needs the points to fill a whole grid (every x with every y; repeated points
    are averaged); otherwise, or with kind "scatter", the points are drawn as dots coloured
    by z. Axis labels take their units ("Dispatch", "MW"). Returns None, with a warning, when
    there is nothing to draw."""
    head = title or zlabel or "3D graph"

    def draw():
        grid = _po_grid(x, y, z)
        k = str(kind or "surface").strip().lower()
        fig = ax = None
        if grid is not None and k in ("surface", "wireframe", "wire"):
            import numpy as np
            xs, ys, Z = grid
            X, Y = np.meshgrid(xs, ys)
            Zm = np.array(Z, dtype=float)
            if not np.isfinite(Zm).any():
                return _po_skip("3D graph", head, "no numbers to draw")
            fig, ax = _po_figure(three_d=True)
            if k == "surface":
                surf = ax.plot_surface(X, Y, np.ma.masked_invalid(Zm), cmap=_po_cmap(),
                                       vmin=float(np.nanmin(Zm)), vmax=float(np.nanmax(Zm)),
                                       edgecolor=_PO_INK["axis"], linewidth=0.3, antialiased=True)
                fig.colorbar(surf, ax=ax, shrink=0.6, pad=0.1, label=_po_axis(zlabel, zunit))
            else:
                ax.plot_wireframe(X, Y, Zm, color=_PO_SERIES[0], linewidth=0.8)
        else:
            if k in ("surface", "wireframe", "wire") and z is not None:
                log(f"3D graph '{head}': the points do not fill a grid of x and y, so they are drawn as dots.")
            pts = [(as_float(a), as_float(b), as_float(c)) for a, b, c in zip(x or [], y or [], z or [])]
            pts = [p for p in pts if None not in p and all(v == v for v in p)]
            if not pts:
                return _po_skip("3D graph", head, "no complete (x, y, z) points")
            fig, ax = _po_figure(three_d=True)
            sc = ax.scatter([p[0] for p in pts], [p[1] for p in pts], [p[2] for p in pts],
                            c=[p[2] for p in pts], cmap=_po_cmap(), s=28, depthshade=False,
                            edgecolors=_PO_INK["secondary"], linewidths=0.4)
            fig.colorbar(sc, ax=ax, shrink=0.6, pad=0.1, label=_po_axis(zlabel, zunit))
        _po_labels(ax, _po_axis(xlabel, xunit), _po_axis(ylabel, yunit), _po_axis(zlabel, zunit))
        sub = ctx_text() if context else ""
        ax.set_title(str(head) + ("\n" + sub if sub else ""), loc="left", fontsize=12, color=_PO_INK["primary"])
        return fig, stem or head

    return _po_run("3D graph", head, draw)
# @end

# @helper plot_heatmap
# @needs plot_common
def plot_heatmap(x, y, z, title="", xlabel="", xunit="", ylabel="", yunit="", zlabel="", zunit="",
                 stem=None, context=True, annotate=None):
    """Draw z as coloured cells over x and y (a heat map) and save a PNG; returns the path.

    x, y, z: three lists, one cell value per (x, y) point (repeated points are averaged,
    missing cells left blank), or z as rows (one list per y value) over x and y. x and y may
    be numbers or names. The colour bar is labelled with zlabel and zunit. annotate: write the
    value in each cell (default when there are at most 150 cells). Returns None, with a
    warning, when there is nothing to draw."""
    head = title or zlabel or "Heat map"

    def draw():
        import numpy as np
        if z and all(isinstance(r, (list, tuple)) for r in z):
            xk = [as_text(v) for v in (x or range(1, len(z[0]) + 1))]
            yk = [as_text(v) for v in (y or range(1, len(z) + 1))]
            Z = [[_po_num(v) for v in (list(row) + [None] * len(xk))[:len(xk)]] for row in z[:len(yk)]]
        else:
            px, cx = _po_xpos(as_items(x))
            py, cy = _po_xpos(as_items(y))
            ux = sorted({v for v in px if v == v})
            uy = sorted({v for v in py if v == v})
            xk = cx if cx is not None else [f"{v:g}" for v in ux]
            yk = cy if cy is not None else [f"{v:g}" for v in uy]
            xi = (lambda p: int(p)) if cx is not None else ux.index
            yi = (lambda p: int(p)) if cy is not None else uy.index
            cells = {}
            for a, b, c in zip(px, py, as_items(z)):
                v = _po_num(c)
                if v == v and a == a and b == b:
                    cells.setdefault((yi(b), xi(a)), []).append(v)
            Z = [[float("nan")] * len(xk) for _ in yk]
            for (r, c), vals in cells.items():
                Z[r][c] = sum(vals) / len(vals)
        Zm = np.array(Z, dtype=float) if Z and Z[0] else np.zeros((0, 0))
        if Zm.size == 0 or not np.isfinite(Zm).any():
            return _po_skip("Heat map", head, "no numbers to draw")
        fig, ax = _po_figure()
        ax.grid(False)
        im = ax.imshow(np.ma.masked_invalid(Zm), origin="lower", aspect="auto", cmap=_po_cmap(),
                       interpolation="nearest")
        fig.colorbar(im, ax=ax, label=_po_axis(zlabel, zunit))
        ax.set_xticks(list(range(len(xk))))
        ax.set_xticklabels(xk, rotation=30 if max(len(s) for s in xk) > 6 else 0)
        ax.set_yticks(list(range(len(yk))))
        ax.set_yticklabels(yk)
        show = annotate if annotate is not None else Zm.size <= 150
        if show:
            lo, hi = np.nanmin(Zm), np.nanmax(Zm)
            for r in range(Zm.shape[0]):
                for c in range(Zm.shape[1]):
                    v = Zm[r, c]
                    if v == v:
                        dark = hi > lo and (v - lo) / (hi - lo) > 0.55
                        ax.text(c, r, f"{v:.4g}", ha="center", va="center", fontsize=8,
                                color="white" if dark else _PO_INK["primary"])
        _po_labels(ax, _po_axis(xlabel, xunit), _po_axis(ylabel, yunit))
        _po_title(ax, head, context)
        return fig, stem or head

    return _po_run("heat map", head, draw)
# @end

# @helper plot_table
# @needs plot_xy, table
def plot_table(name, x, ys, kind="line", group=None, title="", xlabel="", ylabel="", yunit="",
               limits=None, stem=None):
    """Draw columns of a results table against one of its columns and save a PNG; returns
    the file path.

    name: the table (as named on Add row). x: the column along the x axis. ys: one column name
    or a list of them. kind "line", "scatter" or "bar". group: a column whose values split the
    rows into one line each (for example "Study case"). Rows without an x value are left out;
    an empty cell (a skipped pass) leaves a gap. Numeric x values are drawn in order. Column
    names already carry their units ("Nadir (Hz)"). Returns None, with a warning, when the
    table has no rows to draw."""
    cols = [ys] if isinstance(ys, str) else [str(c) for c in (ys or [])]
    head = title or (", ".join(cols) + (f" against {x}" if x else ""))
    tbl = _TABLES.get(str(name))
    rows = [r for r in (tbl.rows if tbl is not None else []) if r.get(x) not in (None, "")]
    if not rows or not cols:
        why = f"table '{name}' has no rows" if not rows else "no column to draw"
        return _po_skip("Graph from results table", head, why)
    groups = []
    if group:
        for r in rows:
            g = r.get(group)
            if g not in groups:
                groups.append(g)
    else:
        groups = [None]
    numeric = all(as_float(r.get(x)) is not None for r in rows)
    lines, names, gxs = [], [], []
    for g in groups:
        part = [r for r in rows if group is None or r.get(group) == g]
        if numeric and str(kind or "line").lower() != "bar":
            part = sorted(part, key=lambda r: as_float(r.get(x)))
        for c in cols:
            lines.append([r.get(c) for r in part])
            gxs.append([r.get(x) for r in part])
            if group is None:
                names.append(c if len(cols) > 1 else "")
            else:
                gtxt = f"{group} = {as_text(g)}"
                names.append(gtxt if len(cols) == 1 else f"{c}, {gtxt}")
    ylab = ylabel or (cols[0] if len(cols) == 1 else "")
    same_x = all(gx == gxs[0] for gx in gxs)
    return _po_run("graph from results table", head,
                   lambda: _po_draw_xy(gxs[0], lines, names, kind, head, xlabel or x, "", ylab, yunit,
                                       limits, stem, False, None if same_x else gxs))
# @end

# @helper plot_convergence
# @needs plot_common
def plot_convergence(history, kind="auto", title="", ylabel="", unit="", stem=None):
    """Draw how a search went and save a PNG; returns the file path.

    history: the history (or the whole result) of Optimise or Find limit. kind "optimise":
    the score of every try (dots; tries that failed or had no score marked x along the bottom)
    and the best score so far (a step line). kind "limit": the value tried at each step,
    coloured pass (green), fail (red) or unknown (grey), the bracket that still holds the
    limit as a band, and the limit found as a dashed line. "auto" picks from the history.
    ylabel / unit name the y axis (default "Score", or the searched value). Returns None, with
    a warning, when the history is empty."""
    hist = getattr(history, "history", history)
    hist = [h for h in (hist or []) if isinstance(h, dict)]
    k = str(kind or "auto").strip().lower()
    if k == "auto":
        k = "limit" if hist and "result" in hist[0] else "optimise"
    head = title or ("Find limit: value per step" if k == "limit" else "Optimise: score per try")

    def draw():
        if not hist:
            return _po_skip("Convergence curve", head, "the search history is empty")
        fig, ax = _po_figure()
        if k == "limit":
            _po_conv_limit(ax, hist, getattr(history, "limit", None))
            ylab = _po_axis(ylabel or getattr(history, "label", "") or "Value tried", unit)
            _po_labels(ax, "Step", ylab)
        else:
            _po_conv_opt(ax, hist)
            _po_labels(ax, "Try", _po_axis(ylabel or "Score", unit))
        from matplotlib.ticker import MaxNLocator
        ax.xaxis.set_major_locator(MaxNLocator(integer=True))
        if ax.get_legend_handles_labels()[0]:
            ax.legend(fontsize=8, frameon=False, loc="best")
        _po_title(ax, head, True)
        return fig, stem or ("find_limit" if k == "limit" else "optimise")

    return _po_run("convergence curve", head, draw)


def _po_conv_opt(ax, hist):
    n = [h.get("try", i + 1) for i, h in enumerate(hist)]
    good = [(t, h.get("score")) for t, h in zip(n, hist) if h.get("candidate") and h.get("score") is not None]
    other = [(t, h.get("score")) for t, h in zip(n, hist) if not h.get("candidate") and h.get("score") is not None]
    none = [t for t, h in zip(n, hist) if h.get("score") is None]
    if good:
        ax.plot([t for t, _ in good], [s for _, s in good], linestyle="none", marker="o", markersize=6,
                color=_PO_SERIES[0], markeredgecolor="white", label="Score of the try", zorder=3)
    if other:
        ax.plot([t for t, _ in other], [s for _, s in other], linestyle="none", marker="o", markersize=6,
                markerfacecolor="none", markeredgecolor=_PO_STATUS["unknown"],
                label="Not a candidate (a check failed)", zorder=3)
    if none:
        ax.plot(none, [0.02] * len(none), linestyle="none", marker="x", markersize=7,
                color=_PO_STATUS["fail"], transform=ax.get_xaxis_transform(),
                label="Failed or no score", zorder=4)
    best = [(t, h.get("best")) for t, h in zip(n, hist) if h.get("best") is not None]
    if best:
        ax.step([t for t, _ in best], [b for _, b in best], where="post", color=_PO_SERIES[1],
                linewidth=1.8, label="Best so far", zorder=2)


def _po_conv_limit(ax, hist, limit=None):
    steps = [h.get("step", i + 1) for i, h in enumerate(hist)]
    for res, name in (("pass", "Passes"), ("fail", "Fails"), ("unknown", "Unknown")):
        pts = [(s, as_float(h.get("value"))) for s, h in zip(steps, hist) if h.get("result") == res]
        pts = [p for p in pts if p[1] is not None]
        if pts:
            ax.plot([p[0] for p in pts], [p[1] for p in pts], linestyle="none",
                    marker="o" if res != "unknown" else "s", markersize=7, color=_PO_STATUS[res],
                    markeredgecolor="white", label=name, zorder=4)
    both = [(s, as_float(h.get("passing")), as_float(h.get("failing"))) for s, h in zip(steps, hist)]
    both = [b for b in both if b[1] is not None and b[2] is not None]
    if both:
        ax.fill_between([b[0] for b in both], [b[1] for b in both], [b[2] for b in both], step="post",
                        color=_PO_RAMP[1], alpha=0.6, label="Bracket holding the limit", zorder=1)
    lim = as_float(limit)
    if lim is not None and lim == lim:
        ax.axhline(lim, color=_PO_INK["secondary"], linestyle="--", linewidth=1.0, zorder=2,
                   label=f"Limit {lim:.6g}")
# @end

# @helper save_series_csv
# @needs log, run_dir
# @imports import csv
def save_series_csv(series, labels=None, stem=None):
    """Write time series to a CSV file in the run folder's "series" sub folder; returns the path.

    series: a Series or a list of them. Series on the same time base share one "Time (s)"
    column; otherwise each gets its own time column next to its values. Column names carry the
    unit ("Bus 16 m:fehz (Hz)"). Values are written as recorded (no interpolation). Returns
    None, with a warning, when there is nothing to write."""
    items = [series] if hasattr(series, "t") else [s for s in (series or []) if s is not None]
    names = list(labels) if isinstance(labels, (list, tuple)) else ([labels] if labels else [])
    good = []
    for k, s in enumerate(items):
        if hasattr(s, "t") and len(getattr(s, "t")) > 0:
            name = names[k] if k < len(names) and names[k] else (getattr(s, "label", "") or f"Series {k + 1}")
            u = str(getattr(s, "unit", "") or "")
            good.append((s, f"{name} ({u})" if u and not str(name).endswith(f"({u})") else str(name)))
    if not good:
        log(f"Time series CSV '{stem or 'series'}' not written: no series with samples.", "warn")
        return None
    try:
        path = out_file(stem or good[0][1], "csv", sub="series")
        same = all(list(s.t) == list(good[0][0].t) for s, _ in good)
        with open(path, "w", newline="", encoding="utf-8-sig") as fh:
            w = csv.writer(fh)
            if same:
                w.writerow(["Time (s)"] + [n for _, n in good])
                cols = [list(s.y) for s, _ in good]
                for i, t in enumerate(good[0][0].t):
                    w.writerow([repr(float(t))] + [_po_csv_cell(c[i]) for c in cols])
            else:
                header = []
                for _, n in good:
                    header += [f"Time (s) [{n}]", n]
                w.writerow(header)
                longest = max(len(s.t) for s, _ in good)
                for i in range(longest):
                    row = []
                    for s, _ in good:
                        row += ([repr(float(s.t[i])), _po_csv_cell(s.y[i])] if i < len(s.t) else ["", ""])
                    w.writerow(row)
        log(f"Saved time series ({len(good)} curve{'s' if len(good) != 1 else ''}): {path}")
        return path
    except Exception as exc:
        log(f"Could not write the time series CSV: {type(exc).__name__}: {exc}", "error")
        return None


def _po_csv_cell(v):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return ""
    return "" if f != f else repr(f)
# @end
