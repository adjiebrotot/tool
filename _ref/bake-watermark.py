#!/usr/bin/env python3
"""Bake the SVG-export watermark text into vector glyph outlines.

The high-quality SVG exports used to embed the watermark as a literal
<text> node, e.g. `Made using tool.adjiebrotots.com/<tool>`. That string is
trivially searchable / selectable / deletable in any SVG editor. This script
converts each tool's watermark string into a single <path> "d" outline using
the canonical DM Sans font, so the rendered result is pixel-identical (and now
font-independent) while the source contains no readable string -- just glyph
coordinates that look like the rest of the artwork.

It is a BUILD-TIME tool. The shipped tools embed only the baked constants it
emits (WM_PATH / WM_PATH_W); they do not depend on this script, fontTools, or
the font file at runtime.

Run:  python3 _ref/bake-watermark.py
Output: _ref/watermark-paths.json  (path "d" + advance width per tool)

Re-run whenever a watermark string, weight, or the font changes, then copy the
constants into the matching tool script (see the JSON for which weight each
tool uses).
"""
import json
import os
from io import BytesIO

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_PATH = os.path.join(HERE, "fonts", "DMSans.ttf")

FONT_SIZE = 11          # px, matches font-size="11" on the old <text> node
OPSZ = 11               # optical size ~ font size (browser optical-sizing: auto)
COORD_PRECISION = 2     # decimal places in the emitted path data

# Each SVG-exporting tool: the watermark string and the weight it renders at.
# Weight mirrors the old <text> node: 500 where font-weight:500 was set,
# 400 where no font-weight was set (jsonvisualiser, sankeycreator).
TOOLS = {
    "dcasimulator":   ("Made using tool.adjiebrotots.com/dcasimulator", 500),
    "financingvscash": ("Made using tool.adjiebrotots.com/financingvscash", 500),
    "rentvsownhouse": ("Made using tool.adjiebrotots.com/rentvsownhouse", 500),
    "pisahvsgabung":  ("Made using tool.adjiebrotots.com/pisahvsgabung", 500),
    "jsonvisualiser": ("Made using tool.adjiebrotots.com/jsonvisualiser", 400),
    "sankeycreator":  ("Made using tool.adjiebrotots.com/sankeycreator", 400),
}


def instance_for_weight(weight):
    """Return a static TTFont instanced at the given weight and OPSZ."""
    font = TTFont(FONT_PATH)
    instantiateVariableFont(font, {"wght": weight, "opsz": OPSZ}, inplace=True)
    return font


def bake(font, text):
    """Lay out `text` left-to-right at the baseline origin (0,0).

    Returns (path_d, advance_width_px). Font units are y-up; SVG is y-down, so
    each glyph is drawn through a transform that scales to px and flips y.
    """
    upm = font["head"].unitsPerEm
    scale = FONT_SIZE / upm
    cmap = font.getBestCmap()
    glyph_set = font.getGlyphSet()
    hmtx = font["hmtx"]

    pen_x = 0.0
    out = SVGPathPen(glyph_set)
    for ch in text:
        glyph_name = cmap.get(ord(ch))
        if glyph_name is None:
            glyph_name = ".notdef"
        # scale to px, flip y, translate to the running pen position (in px)
        transform = (scale, 0, 0, -scale, pen_x, 0)
        glyph_set[glyph_name].draw(TransformPen(out, transform))
        pen_x += hmtx[glyph_name][0] * scale
    return out.getCommands(), pen_x


def round_path(d):
    """Round numeric tokens in path data to COORD_PRECISION to trim bytes."""
    import re

    def repl(m):
        return f"{float(m.group()):.{COORD_PRECISION}f}".rstrip("0").rstrip(".")

    return re.sub(r"-?\d+\.?\d*", repl, d)


def main():
    instances = {}
    result = {}
    for tool, (text, weight) in TOOLS.items():
        if weight not in instances:
            instances[weight] = instance_for_weight(weight)
        d, width = bake(instances[weight], text)
        result[tool] = {
            "text": text,
            "weight": weight,
            "width": round(width, COORD_PRECISION),
            "d": round_path(d),
        }

    out_path = os.path.join(HERE, "watermark-paths.json")
    with open(out_path, "w") as f:
        json.dump(result, f, indent=2)
    for tool, r in result.items():
        print(f"{tool:16s} w{r['weight']} width={r['width']:.2f} d-bytes={len(r['d'])}")
    print(f"\nWrote {out_path}")


if __name__ == "__main__":
    main()
