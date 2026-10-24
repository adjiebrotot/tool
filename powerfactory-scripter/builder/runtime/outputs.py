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
#
# How a graph looks is GRAPH_STYLE, a dict in the script's SETTINGS that the Builder writes from
# Workflow > Graph style. A key it leaves out, or a value that cannot be used, takes the Adjie
# Brotools style (_PO_DEFAULT, the site's own charts), so a hand-edited style can make a graph
# look odd but never stops one being drawn. The style is applied inside an rc_context, so a
# Python code block of the reader's own that uses matplotlib keeps its own defaults.
# Private names start with _po_ so they cannot clash once everything is in one script.

# @helper plot_common
# @needs log, run_dir, ctx, convert
# @imports import math
# @imports import os
# @imports import re
# @imports import warnings
_PO = {"plt": None, "missing": False, "collect": {}, "fonts": False, "st": None, "top": 0.0, "bottom": 0.0}
_PO_CREDIT = "Made with tool.adjiebrotots.com/powerfactory-scripter/builder"
_PO_STATUS = {"pass": "#0ca30c", "fail": "#d03b3b", "unknown": "#898781"}
# The Adjie Brotools style: light page, the site's neutral series sequence (blue, gold, teal,
# rose, purple), blue-grey grid, slate axis text, DM Sans, a bold centred title and the key
# under the graph. Keep it equal to the "brotools" template of js/core/graphstyle.js.
_PO_DEFAULT = {
    "template": "brotools",
    "colors": ["#5A91E8", "#B45309", "#4A9E87", "#C46A7E", "#9B59B6"],
    "ramp": "blue",
    "background": "#FFFFFF",
    "plot_background": "#FFFFFF",
    "text": "#14203A",
    "muted": "#4C5B76",
    "grid": "#C8D4E8",
    "axis": "#C8D4E8",
    "font": "DM Sans",
    "font_size": 9.5,
    "title_size": 13.0,
    "title_bold": True,
    "title_align": "center",
    "grid_axes": "both",
    "grid_style": "solid",
    "frame": "left-bottom",
    "ticks": "out",
    "thousands": True,
    "line_width": 2.0,
    "markers": "auto",
    "line_styles": "solid",
    "legend": "bottom",
    "legend_frame": False,
    "width": 10.0,
    "height": 5.6,
    "dpi": 150,
    "transparent": False,
    "also_save": "",
}
_PO_HEX_KEYS = ("background", "plot_background", "text", "muted", "grid", "axis")
_PO_RANGES = {"font_size": (5.0, 30.0), "title_size": (5.0, 48.0), "line_width": (0.3, 8.0),
              "width": (2.0, 30.0), "height": (1.5, 20.0), "dpi": (50.0, 600.0)}
_PO_CHOICES = {
    "title_align": ("center", "left"),
    "grid_axes": ("both", "y", "x", "none"),
    "grid_style": ("solid", "dashed", "dotted"),
    "frame": ("left-bottom", "box", "bottom", "none"),
    "ticks": ("out", "in", "none"),
    "markers": ("auto", "always", "never"),
    "line_styles": ("solid", "vary"),
    "legend": ("bottom", "top", "right", "inside", "none"),
    "also_save": ("", "svg", "pdf"),
}
# Colour ramps for heat maps, 3D graphs and more lines than the series colours hold, low to
# high. Keep them equal to RAMPS in js/core/graphstyle.js (the page's preview draws them).
_PO_RAMPS = {
    "blue": ["#EAF2FF", "#BCD3F7", "#8FB5FF", "#5A91E8", "#3A71C8", "#0052CC", "#1A3F86", "#14203A"],
    "night": ["#1C2942", "#1F3E73", "#2D67C7", "#5A91E8", "#8DBBFF", "#C4DCFF", "#EAF1FF"],
    "viridis": ["#440154", "#472D7B", "#3B528B", "#2C728E", "#21918C", "#28AE80", "#5EC962", "#ADDC30", "#FDE725"],
    "cividis": ["#00224E", "#123570", "#3B496C", "#575D6D", "#707173", "#8A8779", "#A69D75", "#C4B56C", "#E4CF5B", "#FEE838"],
    "magma": ["#000004", "#1C1044", "#4F127B", "#812581", "#B5367A", "#E55064", "#FB8761", "#FEC287", "#FCFDBF"],
    "coolwarm": ["#3B4CC0", "#6788EE", "#9ABBFF", "#C9D7F0", "#EDD1C2", "#F7A889", "#E26952", "#B40426"],
    "greys": ["#F7F7F7", "#D9D9D9", "#BDBDBD", "#969696", "#737373", "#525252", "#252525"],
    "classic": ["#CDE2FB", "#B7D3F6", "#9EC5F4", "#86B6EF", "#6DA7EC", "#5598E7", "#3987E5",
                "#2A78D6", "#256ABF", "#1C5CAB", "#184F95", "#104281", "#0D366B"],
}
_PO_SANS = ("Segoe UI", "Helvetica Neue", "Helvetica", "Arial", "Liberation Sans", "DejaVu Sans")
_PO_SERIF = ("Times New Roman", "Liberation Serif", "Nimbus Roman", "STIXGeneral", "DejaVu Serif")
_PO_SERIF_NAMES = ("times new roman", "times", "cambria", "georgia", "garamond", "book antiqua",
                   "palatino linotype", "liberation serif", "nimbus roman", "stixgeneral", "dejavu serif", "serif")
_PO_DASH = {"solid": "-", "dashed": (0, (4, 3)), "dotted": (0, (1, 2.5))}
# Line patterns in turn when the style varies them (line_styles "vary"), so lines stay apart in
# black and white print: solid, dashed, dotted, dash-dot, long dash, dash-dot-dot (in multiples
# of the line width, as matplotlib scales them). Keep equal to LINE_DASHES in graphstyle.js.
_PO_LINE_DASHES = [None, (4.0, 2.0), (1.0, 1.6), (4.0, 1.6, 1.0, 1.6), (7.0, 2.0), (4.0, 1.6, 1.0, 1.6, 1.0, 1.6)]


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


def _po_hex(v):
    # "#RRGGBB" from "#RGB" or "#RRGGBB" (any case), else None.
    t = str(v or "").strip()
    if re.match(r"^#[0-9A-Fa-f]{3}$", t):
        t = "#" + "".join(ch * 2 for ch in t[1:])
    return t.upper() if re.match(r"^#[0-9A-Fa-f]{6}$", t) else None


def _po_st():
    # The style in force: GRAPH_STYLE (SETTINGS) over _PO_DEFAULT, each value checked. A key the
    # default does not have is ignored; a bad value keeps the default's.
    raw = globals().get("GRAPH_STYLE")
    raw = raw if isinstance(raw, dict) else {}
    st = dict(_PO_DEFAULT)
    st["colors"] = list(_PO_DEFAULT["colors"])
    for key, dflt in _PO_DEFAULT.items():
        if key not in raw:
            continue
        v = raw[key]
        if key == "colors":
            good = [c for c in (_po_hex(x) for x in (v if isinstance(v, (list, tuple)) else [])) if c][:12]
            if good:
                st[key] = good
        elif key in _PO_HEX_KEYS:
            c = _po_hex(v)
            if c:
                st[key] = c
        elif key in _PO_RANGES:
            if isinstance(v, bool):
                continue
            try:
                f = float(v)
            except (TypeError, ValueError):
                continue
            if math.isfinite(f):
                lo, hi = _PO_RANGES[key]
                st[key] = min(max(f, lo), hi)
        elif key in _PO_CHOICES:
            if str(v) in _PO_CHOICES[key]:
                st[key] = str(v)
        elif key == "ramp":
            if str(v) in _PO_RAMPS:
                st[key] = str(v)
        elif isinstance(dflt, bool):
            if isinstance(v, bool):
                st[key] = v
        elif isinstance(v, str) and v.strip():
            st[key] = v.strip()[:60]
    st["dpi"] = int(round(st["dpi"]))
    return st


def _po_s():
    # The style of the graph being drawn (set by _po_run), or the one in force.
    return _PO["st"] or _po_st()


def _po_family(name):
    # The font families to ask matplotlib for: the chosen one, then a family of the same kind
    # that this computer has, then DejaVu Sans (always there, and it has the Greek letters). Fonts
    # in a "fonts" folder next to the script (the study package brings DM Sans) are added once.
    from matplotlib import font_manager
    if not _PO["fonts"]:
        _PO["fonts"] = True
        folder = os.path.join(script_dir(), "fonts")
        try:
            names = sorted(os.listdir(folder))
        except OSError:
            names = []
        for fn in names:
            if fn.lower().endswith((".ttf", ".otf")):
                try:
                    font_manager.fontManager.addfont(os.path.join(folder, fn))
                except Exception:
                    pass
    have = {}
    for f in font_manager.fontManager.ttflist:
        have.setdefault(f.name.lower(), f.name)
    serif = str(name).strip().lower() in _PO_SERIF_NAMES
    out = []
    for fam in [str(name)] + list(_PO_SERIF if serif else _PO_SANS):
        real = have.get(fam.strip().lower())
        if real and real not in out:
            out.append(real)
    if "DejaVu Sans" not in out:
        out.append("DejaVu Sans")
    return out


def _po_rc(st):
    # rcParams for one graph: its fonts, no "+4.9e1" offset on a narrow axis, and grid
    # defaults that 3D axes read when they are made.
    import matplotlib
    rc = {"font.family": _po_family(st["font"]), "font.size": st["font_size"],
          "axes.formatter.useoffset": False, "grid.color": st["grid"], "grid.linewidth": 0.7,
          "axes.edgecolor": st["axis"], "axes.labelcolor": st["muted"], "text.color": st["text"],
          "xtick.color": st["muted"], "ytick.color": st["muted"]}
    return {k: v for k, v in rc.items() if k in matplotlib.rcParams}


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
                      facecolor=_po_s()["text"], edgecolor="none", alpha=0.25)
    fig.add_artist(patch)
    return patch


def _po_close(fig):
    try:
        _po_plt().close(fig)
    except Exception:
        pass


def _po_figure(three_d=False):
    plt = _po_plt()
    st = _po_s()
    _PO["top"] = _PO["bottom"] = 0.0
    fig = plt.figure(figsize=(st["width"], st["height"]), dpi=st["dpi"])
    fig.patch.set_facecolor(st["background"])
    if three_d:
        import mpl_toolkits.mplot3d  # noqa: F401  (registers the 3d projection)
        ax = fig.add_subplot(1, 1, 1, projection="3d")
        _po_style3d(ax)
    else:
        ax = fig.add_subplot(1, 1, 1)
        _po_style(ax)
    return fig, ax


def _po_style(ax):
    st = _po_s()
    ax.set_facecolor(st["plot_background"])
    _po_grid(ax)
    ax.set_axisbelow(True)
    show = {"left-bottom": ("left", "bottom"), "box": ("left", "bottom", "top", "right"),
            "bottom": ("bottom",), "none": ()}[st["frame"]]
    for side in ("top", "right", "left", "bottom"):
        ax.spines[side].set_visible(side in show)
        ax.spines[side].set_color(st["axis"])
        ax.spines[side].set_linewidth(0.8)
    t = st["ticks"]
    both = st["frame"] == "box" and t == "in"
    ax.tick_params(axis="both", which="both", color=st["axis"], labelcolor=st["muted"],
                   labelsize=st["font_size"], direction="in" if t == "in" else "out",
                   length=0 if t == "none" else 4, width=0.8, pad=6 if t == "none" else 4,
                   top=both, right=both)
    if st["thousands"]:
        _po_group_ticks(ax)


def _po_grid(ax, axis=None):
    # The grid the style asks for; axis narrows it ("y" under bars, "none" for a heat map).
    st = _po_s()
    which = st["grid_axes"]
    if axis is not None and which != "none":
        which = axis if which in ("both", axis) else "none"
    ax.grid(False)
    if which != "none":
        ax.grid(True, axis=which, color=st["grid"], linewidth=0.7, linestyle=_PO_DASH[st["grid_style"]])


def _po_group_ticks(ax):
    # Tick numbers of 1,000 and up written with a thousands separator, as on the site's charts;
    # an axis whose label says it holds years keeps 2030 as it is.
    from matplotlib.ticker import ScalarFormatter

    class _Grouped(ScalarFormatter):
        def __call__(self, x, pos=None):
            text = ScalarFormatter.__call__(self, x, pos)
            label = self.axis.get_label().get_text().lower() if getattr(self, "axis", None) is not None else ""
            return text if ("year" in label or "tahun" in label) else _po_thousands(text)

    for axis in (ax.xaxis, ax.yaxis):
        axis.set_major_formatter(_Grouped(useOffset=False))


def _po_thousands(text):
    m = re.match(r"^([-\u2212]?)(\d{4,})(\.\d*)?$", str(text))
    if not m:
        return text
    return m.group(1) + "{:,}".format(int(m.group(2))) + (m.group(3) or "")


def _po_style3d(ax):
    st = _po_s()
    ax.set_facecolor(st["plot_background"])
    pane = _po_mix(st["plot_background"], st["grid"], 0.35)
    for a in (ax.xaxis, ax.yaxis, ax.zaxis):
        try:
            a.set_pane_color(pane)
            a.pane.set_edgecolor(st["axis"])
        except Exception:
            pass
        try:
            a._axinfo["grid"]["color"] = st["grid"]
        except Exception:
            pass
    ax.tick_params(colors=st["muted"], labelsize=st["font_size"])


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
    st = _po_s()
    kw = {"color": st["muted"], "fontsize": st["font_size"] * 1.05}
    ax.set_xlabel(xlabel, labelpad=6, **kw)
    ax.set_ylabel(ylabel, labelpad=6, **kw)
    if zlabel is not None and hasattr(ax, "set_zlabel"):
        ax.set_zlabel(zlabel, **kw)


def _po_title(ax, title, context=True):
    # The title, with the loop values ("Dispatch (MW) = 200") as a smaller line under it when
    # the graph is drawn inside a loop; a key above the graph sits between them and the plot.
    st = _po_s()
    sub = ctx_text() if context else ""
    left = st["title_align"] == "left"
    fs = st["font_size"]
    gap = 8.0 + _PO["top"]
    ax.set_title(str(title or ""), loc="left" if left else "center", fontsize=st["title_size"],
                 color=st["text"], fontweight="bold" if st["title_bold"] else "normal",
                 pad=gap + (fs * 1.7 if sub else 0.0))
    if sub:
        ax.annotate(sub, xy=(0.0 if left else 0.5, 1.0), xycoords="axes fraction", xytext=(0, gap),
                    textcoords="offset points", fontsize=fs, color=st["muted"],
                    ha="left" if left else "center", va="bottom")


def _po_legend(ax, handles=None, labels=None, where=None):
    # The key where the style puts it: under the graph (one row, or as many as the width
    # needs, above the credit), above it (under the title), to its right, inside it, or none.
    # An inside key is placed for good by _po_save (_po_inside_key), once the layout is done.
    st = _po_s()
    if handles is None:
        handles, labels = ax.get_legend_handles_labels()
    where = where or st["legend"]
    if not handles or where == "none":
        return None
    fig = ax.figure
    fs = st["font_size"]
    kw = {"fontsize": fs, "frameon": bool(st["legend_frame"]), "handlelength": 2.0, "columnspacing": 1.6}
    if st["legend_frame"]:
        kw.update(facecolor=st["plot_background"], edgecolor=st["grid"], framealpha=1.0)
    given = list(labels)
    head = _po_key_title(given)
    if head:
        labels = [str(v).split(" = ", 1)[1] for v in given]
        kw.update(title=head, title_fontsize=fs)
    renderer = fig.canvas.get_renderer()
    w_px, h_px = fig.get_size_inches() * fig.dpi
    n = len(handles)
    if where == "inside":
        ax.pfb_inside = (handles, labels, kw, given)
        leg = ax.legend(handles, labels, loc="upper right", ncol=1 if n <= 10 else 2, **kw)
    elif where == "right":
        # One column (two past 16 lines), or as many more as keep it within the graph's height.
        leg = None
        for ncol in range(1 if n <= 16 else 2, n + 1):
            leg = ax.legend(handles, labels, loc="upper left", bbox_to_anchor=(1.02, 1.0), borderaxespad=0.0,
                            ncol=ncol, **kw)
            if leg.get_window_extent(renderer).height <= h_px * 0.8:
                break
    else:
        left = st["title_align"] == "left"
        foot = 16.0 / 72.0 * fig.dpi / h_px
        leg = None

        def make(ncol):
            if leg is not None:
                leg.remove()
            if where == "top":
                return ax.legend(handles, labels, loc="lower left" if left else "lower center",
                                 bbox_to_anchor=(0.0 if left else 0.5, 1.0), borderaxespad=0.4, ncol=ncol, **kw)
            return fig.legend(handles, labels, loc="lower center", bbox_to_anchor=(0.5, foot),
                              borderaxespad=0.0, ncol=ncol, **kw)
        for ncol in range(min(n, 12), 0, -1):
            leg = make(ncol)
            if leg.get_window_extent(renderer).width <= w_px * 0.92 or ncol == 1:
                break
        # Rows filled evenly: as few columns as keep that many rows (12 lines in 11 columns
        # would leave one alone on a second row; 6 columns hold them in two full rows).
        even = -(-n // -(-n // ncol))
        if even != ncol:
            leg = make(even)
        height = leg.get_window_extent(renderer).height
        if where == "top":
            _PO["top"] = height / fig.dpi * 72.0 + 2.0
        else:
            _PO["bottom"] = foot + height / h_px
    _po_key_ink(leg)
    return leg


def _po_key_title(labels):
    # Every line a pass of one loop ("Dispatch (MW) = 100", "Dispatch (MW) = 125" ...): the
    # loop's name, written once as the key's title, each line then named by its value alone.
    # None when the lines are named any other way (or by more than one loop value).
    parts = [str(v).split(" = ", 1) for v in labels]
    if len(parts) < 2 or any(len(p) != 2 or not p[0].strip() or " = " in p[1] for p in parts):
        return None
    head = parts[0][0]
    return head if all(p[0] == head for p in parts) else None


def _po_key_ink(leg):
    st = _po_s()
    for t in leg.get_texts():
        t.set_color(st["text"])
    leg.get_title().set_color(st["text"])


def _po_fit3d(fig, foot):
    # mplot3d writes its numbers and axis titles outside the axes' box, where tight_layout does
    # not look: on a small figure they run into the colour bar and the credit at the foot. The
    # box is made smaller (it stays where it is on the left) until they clear both and the
    # figure's edges. foot: the strip kept at the bottom, a fraction of the height.
    try:
        renderer = fig.canvas.get_renderer()
    except Exception:
        return
    w, h = fig.bbox.width, fig.bbox.height
    gap = 4.0 * fig.dpi / 72.0
    for ax in [a for a in fig.axes if getattr(a, "name", "") == "3d"]:
        for _ in range(5):
            tb = ax.get_tightbbox(renderer)
            if tb is None:
                break
            box = ax.get_window_extent(renderer)
            right = w - gap
            for other in fig.axes:
                if other is not ax:
                    o = other.get_tightbbox(renderer)
                    if o is not None and o.x0 > (box.x0 + box.x1) / 2:
                        right = min(right, o.x0 - gap)
            cut = (max(0.0, gap - tb.x0), max(0.0, tb.x1 - right),
                   max(0.0, foot * h + gap - tb.y0), max(0.0, tb.y1 - (h - gap)))
            if max(cut) < 1.0:
                break
            pos = ax.get_position()
            ax.set_position([pos.x0 + cut[0] / w, pos.y0 + cut[2] / h,
                             max(0.05, pos.width - (cut[0] + cut[1]) / w), max(0.05, pos.height - (cut[2] + cut[3]) / h)])


# Where an inside key may go, in turn: the corners, then the middle of each side.
_PO_INSIDE_LOCS = ("upper right", "upper left", "lower left", "lower right",
                   "center right", "center left", "upper center", "lower center")


def _po_inside_key(ax):
    # An inside key goes to the first place where it covers nothing drawn: no curve, point,
    # limit or event line, bar, band or word. matplotlib's loc="best" only covers the least,
    # which with many lines is still most of them. Its own columns are tried, then one more
    # (shorter, so it fits a band above or below the curves). Returns False, with the key
    # taken off, when no place is clear: _po_save then puts it under the graph.
    import numpy as np
    from matplotlib.collections import PathCollection
    handles, labels, kw, _given = ax.pfb_inside
    fig = ax.figure
    renderer = fig.canvas.get_renderer()
    segs, pts, boxes = [], [], []
    for ln in ax.get_lines():
        if not ln.get_visible():
            continue
        try:
            xy = np.asarray(ln.get_transform().transform(ln.get_xydata()), dtype=float)
        except Exception:
            continue
        if xy.ndim != 2 or not len(xy):
            continue
        if str(ln.get_linestyle()).lower() not in ("none", "", " "):
            a, b = xy[:-1], xy[1:]
            ok = np.isfinite(a).all(axis=1) & np.isfinite(b).all(axis=1)
            segs.append(np.hstack([a[ok], b[ok]]))
        if str(ln.get_marker()).lower() not in ("none", "", " "):
            pts.append(xy[np.isfinite(xy).all(axis=1)])
    for c in ax.collections:
        try:
            if isinstance(c, PathCollection) and len(c.get_offsets()):
                xy = np.asarray(c.get_offset_transform().transform(c.get_offsets()), dtype=float)
                pts.append(xy[np.isfinite(xy).all(axis=1)])
            else:
                e = c.get_window_extent(renderer)
                boxes.append((e.x0, e.y0, e.x1, e.y1))
        except Exception:
            pass
    for art in list(ax.patches) + list(ax.texts):
        try:
            if art.get_visible() and (not hasattr(art, "get_text") or art.get_text()):
                e = art.get_window_extent(renderer)
                boxes.append((e.x0, e.y0, e.x1, e.y1))
        except Exception:
            pass
    seg = np.vstack(segs) if segs else np.zeros((0, 4))
    pt = np.vstack(pts) if pts else np.zeros((0, 2))
    pad = 3.0 * fig.dpi / 72.0

    def clear(l, b, r, t):
        if len(pt) and ((pt[:, 0] >= l) & (pt[:, 0] <= r) & (pt[:, 1] >= b) & (pt[:, 1] <= t)).any():
            return False
        for l2, b2, r2, t2 in boxes:
            if min(r, r2) > max(l, l2) and min(t, t2) > max(b, b2):
                return False
        if len(seg):
            # Segments whose own box meets this one; any end inside is a hit, else trace it.
            near = seg[(np.minimum(seg[:, 0], seg[:, 2]) <= r) & (np.maximum(seg[:, 0], seg[:, 2]) >= l) &
                       (np.minimum(seg[:, 1], seg[:, 3]) <= t) & (np.maximum(seg[:, 1], seg[:, 3]) >= b)]
            for x, y in ((near[:, 0], near[:, 1]), (near[:, 2], near[:, 3])):
                if ((x >= l) & (x <= r) & (y >= b) & (y <= t)).any():
                    return False
            for x0, y0, x1, y1 in near:
                if _po_seg_in(x0, y0, x1, y1, (l, b, r, t)) > 0:
                    return False
        return True

    n = len(handles)
    base = 1 if n <= 10 else 2
    for ncol in ((base, base + 1) if n >= 4 else (base,)):
        for loc in _PO_INSIDE_LOCS:
            leg = ax.legend(handles, labels, loc=loc, ncol=ncol, **kw)
            e = leg.get_window_extent(renderer)
            if clear(e.x0 - pad, e.y0 - pad, e.x1 + pad, e.y1 + pad):
                _po_key_ink(leg)
                return True
    ax.get_legend().remove()
    return False


def _po_snap(ax):
    # The value axis ends on a tick at both ends, as the site's charts do, so the top grid line
    # closes the plot and no half-empty band is left above or below the data. A wider range can
    # change the tick step, so it is done again until the ends stay put; _po_save does it once
    # more after the layout has sized the axes. Returns whether the limits moved.
    moved = False
    try:
        ax.pfb_snap = True
        for _ in range(4):
            lo, hi = ax.get_ylim()
            if not (math.isfinite(lo) and math.isfinite(hi)) or hi <= lo:
                break
            ticks = list(ax.yaxis.get_major_locator().tick_values(lo, hi))
            eps = (hi - lo) * 1e-9
            below = [t for t in ticks if t <= lo + eps]
            above = [t for t in ticks if t >= hi - eps]
            nlo = max(below) if below else lo
            nhi = min(above) if above else hi
            if abs(nlo - lo) <= eps * 10 and abs(nhi - hi) <= eps * 10:
                break
            ax.set_ylim(nlo, nhi)
            moved = True
    except Exception:
        pass
    return moved


def _po_colorbar(fig, mappable, ax, label, **kw):
    st = _po_s()
    cb = fig.colorbar(mappable, ax=ax, **kw)
    cb.outline.set_edgecolor(st["axis"])
    cb.outline.set_linewidth(0.8)
    cb.ax.tick_params(color=st["axis"], labelcolor=st["muted"], labelsize=st["font_size"])
    cb.set_label(label, color=st["muted"], fontsize=st["font_size"] * 1.05)
    return cb


def _po_note(fig, note):
    if note:
        st = _po_s()
        text = str(note)
        if len(text) > 160:
            text = text[:157] + "..."
        fig.text(0.01, 0.012, text, fontsize=st["font_size"] * 0.8, color=st["muted"], ha="left", va="bottom")


def _po_colors(n):
    # Up to as many lines as the style has colours: those, in their order. Up to twice as many:
    # the same again, paler (the site's charts do the same). More (every pass of a sweep on one
    # graph): one ramp, so the order still reads and no hue is invented; the end of the ramp
    # nearest the background is left out so every line stays visible.
    st = _po_s()
    base = list(st["colors"])
    k = len(base)
    if n <= k:
        return base[:n]
    if n <= 2 * k:
        return base + [_po_mix(c, st["plot_background"], 0.42) for c in base][:n - k]
    ramp = _PO_RAMPS[st["ramp"]]
    bg = _po_lum(st["plot_background"])
    lo, hi = (0.25, 1.0) if abs(_po_lum(ramp[0]) - bg) < abs(_po_lum(ramp[-1]) - bg) else (0.0, 0.75)
    return [_po_ramp_at(ramp, lo + (hi - lo) * (j / max(1, n - 1))) for j in range(n)]


def _po_dashes(n):
    # The line pattern of each of n lines: all solid, or solid, dashed, dotted ... in turn.
    if _po_s()["line_styles"] != "vary":
        return ["-"] * n
    return ["-" if d is None else (0, d) for d in (_PO_LINE_DASHES[j % len(_PO_LINE_DASHES)] for j in range(n))]


def _po_ramp_at(ramp, pos):
    pos = min(max(float(pos), 0.0), 1.0) * (len(ramp) - 1)
    a = int(math.floor(pos))
    b = min(a + 1, len(ramp) - 1)
    return _po_mix(ramp[a], ramp[b], pos - a)


def _po_mix(c1, c2, w):
    r1, g1, b1 = (int(c1[i:i + 2], 16) for i in (1, 3, 5))
    r2, g2, b2 = (int(c2[i:i + 2], 16) for i in (1, 3, 5))
    return "#%02x%02x%02x" % (round(r1 + (r2 - r1) * w), round(g1 + (g2 - g1) * w), round(b1 + (b2 - b1) * w))


def _po_lum(c):
    # Relative luminance (WCAG) of "#RRGGBB", 0 (black) to 1 (white).
    def ch(v):
        v = v / 255.0
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (int(c[i:i + 2], 16) for i in (1, 3, 5))
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def _po_cmap():
    from matplotlib.colors import LinearSegmentedColormap
    return LinearSegmentedColormap.from_list("pfb_ramp", _PO_RAMPS[_po_s()["ramp"]])


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


def _po_grid_xyz(x, y, z):
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
    st = _po_s()
    _po_watermark(fig)
    # Room at the foot for the credit (and the footnote), or for a key under the graph.
    strip = 14.0 / 72.0 / float(fig.get_size_inches()[1])

    def layout():
        fig.tight_layout(rect=(0, max(strip, _PO["bottom"]), 1, 1))
        # The axes changed size, so the tick step may have too: end on a tick again.
        if any([_po_snap(a) for a in fig.axes if getattr(a, "pfb_snap", False)]):
            fig.tight_layout(rect=(0, max(strip, _PO["bottom"]), 1, 1))
    try:
        with warnings.catch_warnings():
            # 3D axes and colour bars make tight_layout warn; the layout is still usable.
            warnings.simplefilter("ignore")
            layout()
            # A key inside the graph that would cover data goes under it instead.
            moved = False
            for a in fig.axes:
                if getattr(a, "pfb_inside", None) and not _po_inside_key(a):
                    _po_legend(a, a.pfb_inside[0], a.pfb_inside[3], where="bottom")
                    moved = True
                a.pfb_inside = None
            if moved:
                layout()
            _po_fit3d(fig, max(strip, _PO["bottom"]))
    except Exception:
        pass
    for a in fig.axes:
        if getattr(a, "pfb_marks", None):
            _po_place_marks(a)
    path = out_file(stem or "graph", "png", sub="graphs")
    kw = {"dpi": st["dpi"]}
    if st["transparent"]:
        kw["transparent"] = True
    else:
        kw["facecolor"] = fig.get_facecolor()
    fig.savefig(path, **kw)
    log(f"Saved graph: {path}")
    if st["also_save"] in ("svg", "pdf"):
        extra = path[:-4] + "." + st["also_save"]
        try:
            fig.savefig(extra, format=st["also_save"], **kw)
            _RUN["files"].append(extra)
            log(f"Saved graph ({st['also_save'].upper()}): {extra}")
        except Exception as exc:
            log(f"Could not save the {st['also_save'].upper()} copy of {path}: {type(exc).__name__}: {exc}", "warn")
    return path


# Where a mark's label may go around its point, in points right and up from it, how it hangs
# from there, and what the spot costs for being further out: beside the point, then under it
# (a nadir has its curve above), then over it, a step at a time out to 48 pt, so a label can
# drop into the gap between a limit line and the axis. Keep equal to markSpots in graphpreview.js.
def _po_mark_spots():
    spots = [(9, 0, "left", "center_baseline", 2.0), (-9, 0, "right", "center_baseline", 4.0)]
    for d in range(4, 50, 2):
        for dx, ha, side in ((6, "left", 0.0), (-6, "right", 2.0), (0, "center", 3.0)):
            if ha == "center" and d < 8:
                continue
            spots.append((dx, -d, ha, "top", d * 0.8 + side))
            spots.append((dx, d, ha, "bottom", d * 0.8 + side + 4.0))
    return spots


_PO_MARK_SPOTS = _po_mark_spots()


def _po_seg_in(x0, y0, x1, y1, box):
    # The length (px) of the segment (x0, y0)-(x1, y1) inside box = (left, bottom, right, top).
    l, b, r, t = box
    dx, dy = x1 - x0, y1 - y0
    lo, hi = 0.0, 1.0
    for p, q in ((-dx, x0 - l), (dx, r - x0), (-dy, y0 - b), (dy, t - y0)):
        if p == 0:
            if q < 0:
                return 0.0
        else:
            u = q / p
            if p < 0:
                lo = max(lo, u)
            else:
                hi = min(hi, u)
            if lo > hi:
                return 0.0
    return (hi - lo) * math.hypot(dx, dy)


def _po_place_marks(ax):
    # Each mark's label at the spot around its point that crosses the least: lines (the curves,
    # limit and event lines), other words (limit and event labels, labels already placed), the
    # key, and the edge of the plot. A label that still meets a line has the plot's colour
    # behind it, so it reads.
    st = _po_s()
    fig = ax.figure
    try:
        renderer = fig.canvas.get_renderer()
    except Exception:
        return
    px = fig.dpi / 72.0
    pad = 3.0 * px          # the clear space kept around a label
    frame = ax.get_window_extent(renderer)
    paths = []
    for ln in ax.get_lines():
        try:
            xy = ln.get_transform().transform(ln.get_xydata())
        except Exception:
            continue
        pts = [(float(a), float(b)) for a, b in xy if math.isfinite(a) and math.isfinite(b)]
        if str(ln.get_linestyle()).lower() in ("none", "", " "):
            paths.append(("dots", pts))
        else:
            paths.append(("line", pts))
    for (t, y, lab) in ax.pfb_marks:
        # Only the segments that pass near the point can meet a label beside it.
        cx, cy = ax.transData.transform((t, y))
        reach = 60.0 * px + st["font_size"] * 0.6 * px * len(lab)
        near = []
        for kind, pts in paths:
            if kind == "dots":
                near.append((kind, [q for q in pts if abs(q[0] - cx) <= reach and abs(q[1] - cy) <= reach]))
            else:
                near.append((kind, [(a, b) for a, b in zip(pts, pts[1:])
                                    if min(a[0], b[0]) <= cx + reach and max(a[0], b[0]) >= cx - reach
                                    and min(a[1], b[1]) <= cy + reach and max(a[1], b[1]) >= cy - reach]))
        boxes = []
        for other in list(ax.texts) + ([ax.get_legend()] if ax.get_legend() else []):
            try:
                e = other.get_window_extent(renderer)
                boxes.append((e.x0, e.y0, e.x1, e.y1))
            except Exception:
                pass
        ann = ax.annotate(lab, xy=(t, y), xytext=(0, 0), textcoords="offset points", zorder=6,
                          fontsize=st["font_size"] * 0.92, color=st["text"], annotation_clip=False,
                          bbox={"facecolor": st["plot_background"], "edgecolor": "none", "pad": 1.0, "alpha": 0.85})
        best = None
        for dx, dy, ha, va, further in _PO_MARK_SPOTS:
            ann.set_position((dx, dy))
            ann.set_ha(ha)
            ann.set_va(va)
            try:
                e = ann.get_window_extent(renderer)
            except Exception:
                break
            box = (e.x0 - pad, e.y0 - pad, e.x1 + pad, e.y1 + pad)
            area = max(1.0, (box[2] - box[0]) * (box[3] - box[1]))
            inside = (max(0.0, min(box[2], frame.x1) - max(box[0], frame.x0)) *
                      max(0.0, min(box[3], frame.y1) - max(box[1], frame.y0)))
            cost = (area - inside) / area * 1000.0
            for l2, b2, r2, t2 in boxes:
                w = min(box[2], r2) - max(box[0], l2)
                h = min(box[3], t2) - max(box[1], b2)
                if w > 0 and h > 0:
                    cost += 400.0 + w * h / area * 400.0
            for kind, items in near:
                if kind == "dots":
                    cost += 60.0 * sum(1 for a, b in items if box[0] <= a <= box[2] and box[1] <= b <= box[3])
                else:
                    run = sum(_po_seg_in(a[0], a[1], b[0], b[1], box) for a, b in items) / px
                    cost += (150.0 + 8.0 * run) if run > 0 else 0.0
            cost += further
            if best is None or cost < best[0]:
                best = (cost, dx, dy, ha, va)
        if best is not None:
            ann.set_position(best[1:3])
            ann.set_ha(best[3])
            ann.set_va(best[4])


def _po_run(what, title, draw):
    # Draw, save, close; never raise (a graph must never lose a result). draw() returns
    # (fig, stem), or None when there is nothing to draw (it has logged why).
    fig = None
    try:
        try:
            plt = _po_plt()
        except ImportError:
            if not _PO["missing"]:
                _PO["missing"] = True
                log("matplotlib is not installed, so no graphs are drawn. Install it with: "
                    "python -m pip install matplotlib", "error")
            return None
        _PO["st"] = _po_st()
        with plt.rc_context(_po_rc(_PO["st"])):
            made = draw()
            if made is None:
                return None
            fig, stem = made
            return _po_save(fig, stem)
    except Exception as exc:
        log(f"Could not draw the {what} '{title or 'untitled'}': {type(exc).__name__}: {exc}", "error")
        return None
    finally:
        _PO["st"] = None
        if fig is not None:
            _po_close(fig)


def _po_skip(what, title, why):
    log(f"{what} '{title or 'untitled'}' not drawn: {why}.", "warn")
    return None


def _po_hlines(ax, limits):
    # Horizontal limit lines: a number, (value, label) or {"value": v, "label": text}.
    st = _po_s()
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
        ax.axhline(f, color=st["muted"], linestyle=(0, (5, 3)), linewidth=1.1, zorder=1)
        ax.annotate(str(lab or f"{f:.6g}"), xy=(1.0, f), xycoords=("axes fraction", "data"),
                    xytext=(-4, 3), textcoords="offset points", ha="right", va="bottom",
                    fontsize=st["font_size"] * 0.9, color=st["muted"])
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
    under the title and added to the file name. GRAPH_STYLE in SETTINGS sets the look.
    Returns None, with a warning, when there is nothing to draw."""
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
        st = _po_s()
        units = {str(getattr(s, "unit", "") or "") for s, _, _, _ in pairs}
        yunit = unit if unit is not None else (units.pop() if len(units) == 1 else "")
        fig, ax = _po_figure()
        colors = _po_colors(len(pairs))
        for (s, ts, ys, name), color, dash in zip(pairs, colors, _po_dashes(len(pairs))):
            ax.plot(ts, ys, color=color, linewidth=st["line_width"], linestyle=dash, label=name, zorder=3,
                    solid_joinstyle="round", solid_capstyle="round")
        ax.margins(x=0)
        lines_at = {}
        if events:
            for s, _, _, _ in pairs:
                for et, el in getattr(s, "events", None) or []:
                    lines_at.setdefault(round(float(et), 9), str(el))
        te = as_float(t_event)
        if te is not None and te == te:
            lines_at.setdefault(round(te, 9), "")
        for et in sorted(lines_at):
            ax.axvline(et, color=st["muted"], linestyle=":", linewidth=1.0, zorder=1)
            if lines_at[et]:
                ax.annotate(lines_at[et], xy=(et, 1.0), xycoords=("data", "axes fraction"),
                            xytext=(3, -3), textcoords="offset points", ha="left", va="top",
                            fontsize=st["font_size"] * 0.85, color=st["muted"], rotation=90, zorder=2,
                            bbox={"facecolor": st["plot_background"], "edgecolor": "none", "pad": 1.0, "alpha": 0.85})
        _po_hlines(ax, limits)
        _po_snap(ax)
        for m in marks or []:
            _po_mark(ax, m, yunit)
        ylab = _po_axis(ylabel or (pairs[0][3] if len(pairs) == 1 else ""), yunit)
        _po_labels(ax, xlabel, ylab)
        if len(pairs) > 1:
            _po_legend(ax)
        _po_title(ax, head, context)
        _po_note(fig, note)
        return fig, stem or head or "time_series"

    return _po_run("time series graph", head, draw)


def _po_mark(ax, m, unit=""):
    # A marked point: (t, y), (t, y, label), {"t", "y", "label"} or a result with time / value
    # (a COLLAPSE nadir result is marked at its minimum).
    st = _po_s()
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
    ax.plot([t], [y], marker="o", markersize=7, color=st["text"], markeredgecolor=st["plot_background"],
            markeredgewidth=1.5, linestyle="none", zorder=5)
    if lab:
        # Written by _po_save once the layout is done (_po_place_marks), where it overlaps least.
        if not hasattr(ax, "pfb_marks"):
            ax.pfb_marks = []
        ax.pfb_marks.append((t, y, str(lab)))
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
    st = _po_s()
    k = str(kind or "line").strip().lower()
    all_x = [v for gx, _, _ in lines for v in gx]
    pos_all, cats = _po_xpos(all_x)
    fig, ax = _po_figure()
    colors = _po_colors(len(lines))
    dashes = _po_dashes(len(lines))
    width = 0.8 / len(lines)
    start = 0
    lw = st["line_width"]
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
            ax.plot(pos, ys, linestyle="none", marker="o", markersize=max(5.0, lw * 3.0), color=color,
                    markeredgecolor=st["plot_background"], markeredgewidth=1.0, label=name or None, zorder=3)
        else:
            dots = st["markers"] == "always" or (st["markers"] == "auto" and len(ys) <= 40)
            ax.plot(pos, ys, color=color, linewidth=lw, linestyle=dashes[idx], marker="o" if dots else None,
                    markersize=max(3.5, lw * 2.2), label=name or None, zorder=3,
                    solid_joinstyle="round", solid_capstyle="round")
    if k == "bar":
        _po_grid(ax, "y")
    if cats is not None:
        ax.set_xticks(list(range(len(cats))))
        ax.set_xticklabels(cats, rotation=30 if max(len(c) for c in cats) > 6 else 0,
                           ha="right" if max(len(c) for c in cats) > 6 else "center")
    elif k == "bar" and len(lines) > 1:
        ax.set_xticks(list(range(len(lines[0][0]))))
        ax.set_xticklabels([as_text(v) for v in lines[0][0]])
    _po_hlines(ax, limits)
    _po_snap(ax)
    ylab = _po_axis(ylabel or (lines[0][2] if len(lines) == 1 else ""), yunit)
    _po_labels(ax, _po_axis(xlabel, xunit), ylab)
    if len(lines) > 1:
        _po_legend(ax)
    _po_title(ax, head, context)
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
        st = _po_s()
        grid = _po_grid_xyz(x, y, z)
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
                                       edgecolor=st["axis"], linewidth=0.3, antialiased=True)
                _po_colorbar(fig, surf, ax, _po_axis(zlabel, zunit), shrink=0.6, pad=0.1)
            else:
                ax.plot_wireframe(X, Y, Zm, color=st["colors"][0], linewidth=0.8)
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
                            edgecolors=st["muted"], linewidths=0.4)
            _po_colorbar(fig, sc, ax, _po_axis(zlabel, zunit), shrink=0.6, pad=0.1)
        _po_labels(ax, _po_axis(xlabel, xunit), _po_axis(ylabel, yunit), _po_axis(zlabel, zunit))
        sub = ctx_text() if context else ""
        ax.set_title(str(head) + ("\n" + sub if sub else ""), loc="left" if st["title_align"] == "left" else "center",
                     fontsize=st["title_size"], color=st["text"], fontweight="bold" if st["title_bold"] else "normal")
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
        st = _po_s()
        fig, ax = _po_figure()
        _po_grid(ax, "none")
        cmap = _po_cmap()
        im = ax.imshow(np.ma.masked_invalid(Zm), origin="lower", aspect="auto", cmap=cmap,
                       interpolation="nearest")
        _po_colorbar(fig, im, ax, _po_axis(zlabel, zunit))
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
                        # The ink that reads on this cell's own colour, whatever the ramp.
                        rgb = cmap((v - lo) / (hi - lo) if hi > lo else 0.5)
                        cell = "#%02x%02x%02x" % tuple(int(round(ch * 255)) for ch in rgb[:3])
                        ax.text(c, r, f"{v:.4g}", ha="center", va="center", fontsize=st["font_size"] * 0.85,
                                color="#FFFFFF" if _po_lum(cell) < 0.36 else "#14203A")
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
        _po_snap(ax)
        from matplotlib.ticker import MaxNLocator
        ax.xaxis.set_major_locator(MaxNLocator(integer=True))
        _po_legend(ax)
        _po_title(ax, head, True)
        return fig, stem or ("find_limit" if k == "limit" else "optimise")

    return _po_run("convergence curve", head, draw)


def _po_conv_opt(ax, hist):
    st = _po_s()
    colors = _po_colors(2)
    n = [h.get("try", i + 1) for i, h in enumerate(hist)]
    good = [(t, h.get("score")) for t, h in zip(n, hist) if h.get("candidate") and h.get("score") is not None]
    other = [(t, h.get("score")) for t, h in zip(n, hist) if not h.get("candidate") and h.get("score") is not None]
    none = [t for t, h in zip(n, hist) if h.get("score") is None]
    if good:
        ax.plot([t for t, _ in good], [s for _, s in good], linestyle="none", marker="o", markersize=6,
                color=colors[0], markeredgecolor=st["plot_background"], label="Score of the try", zorder=3)
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
        ax.step([t for t, _ in best], [b for _, b in best], where="post", color=colors[-1],
                linewidth=st["line_width"] * 1.1, label="Best so far", zorder=2)


def _po_conv_limit(ax, hist, limit=None):
    st = _po_s()
    steps = [h.get("step", i + 1) for i, h in enumerate(hist)]
    for res, name in (("pass", "Passes"), ("fail", "Fails"), ("unknown", "Unknown")):
        pts = [(s, as_float(h.get("value"))) for s, h in zip(steps, hist) if h.get("result") == res]
        pts = [p for p in pts if p[1] is not None]
        if pts:
            ax.plot([p[0] for p in pts], [p[1] for p in pts], linestyle="none",
                    marker="o" if res != "unknown" else "s", markersize=7, color=_PO_STATUS[res],
                    markeredgecolor=st["plot_background"], label=name, zorder=4)
    both = [(s, as_float(h.get("passing")), as_float(h.get("failing"))) for s, h in zip(steps, hist)]
    both = [b for b in both if b[1] is not None and b[2] is not None]
    if both:
        ax.fill_between([b[0] for b in both], [b[1] for b in both], [b[2] for b in both], step="post",
                        color=_po_mix(st["colors"][0], st["plot_background"], 0.78), alpha=0.9,
                        label="Bracket holding the limit", zorder=1)
    lim = as_float(limit)
    if lim is not None and lim == lim:
        ax.axhline(lim, color=st["muted"], linestyle=(0, (5, 3)), linewidth=1.1, zorder=2,
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
