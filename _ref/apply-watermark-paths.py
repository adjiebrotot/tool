#!/usr/bin/env python3
"""Apply baked watermark outlines to the SVG-exporting tool scripts.

Reads _ref/watermark-paths.json (produced by bake-watermark.py) and, for each
tool, (1) injects `WM_PATH` / `WM_PATH_W` constants next to WM_LOGO_SRC and
(2) replaces the literal <text> watermark in the SVG export with a <path> that
carries the baked glyph outline. Idempotent: skips a file already patched.

Run:  python3 _ref/apply-watermark-paths.py
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = json.load(open(os.path.join(HERE, "watermark-paths.json")))

# tool -> source file (relative to repo root)
FILES = {
    "dcasimulator": "dcasimulator/script.js",
    "financingvscash": "financingvscash/script.js",
    "rentvsownhouse": "rentvsownhouse/cashflow-export.js",
    "pisahvsgabung": "pisahvsgabung/script.js",
    "jsonvisualiser": "jsonvisualiser/script.js",
    "sankeycreator": "sankeycreator/script.js",
}

# The four standard tools share one block, differing only by watermark source
# (a string literal, or WM_TEXT for rentvsownhouse) and indentation/host var.
STD = [
    ("dcasimulator", "  ", "NS", "svgW", "svgH",
     "'Made using tool.adjiebrotots.com/dcasimulator'", "svg"),
    ("financingvscash", "  ", "NS", "svgW", "svgH",
     "'Made using tool.adjiebrotots.com/financingvscash'", "svg"),
    ("pisahvsgabung", "  ", "NS", "svgW", "svgH",
     "'Made using tool.adjiebrotots.com/pisahvsgabung'", "svg"),
    ("rentvsownhouse", "  ", "NS", "svgW", "svgH", "WM_TEXT", "svg"),
]


def std_old(ind, ns, w, h, textsrc, parent):
    return (
        f"{ind}const wm = document.createElementNS({ns},'text');\n"
        f"{ind}wm.setAttribute('x',{w}-12); wm.setAttribute('y',{h}-12);\n"
        f"{ind}wm.setAttribute('text-anchor','end'); wm.setAttribute('dominant-baseline','auto');\n"
        f"{ind}wm.setAttribute('font-family',FONT); wm.setAttribute('font-size','11');\n"
        f"{ind}wm.setAttribute('font-weight','500'); wm.setAttribute('fill','#1a1a1a'); wm.setAttribute('opacity','0.22');\n"
        f"{ind}wm.textContent = {textsrc}; {parent}.appendChild(wm);\n"
        f"{ind}const wmLogoSize = 13;\n"
        f"{ind}const wmTextW = measureWmText({'wm.textContent' if textsrc.startswith(chr(39)) else textsrc}, '500 11px ' + FONT);\n"
    )


def std_new(ind, ns, w, h, parent):
    return (
        f"{ind}// Watermark text is baked to glyph outlines (WM_PATH) so the exported\n"
        f"{ind}// SVG carries no editable/searchable string; renders identically.\n"
        f"{ind}const wm = document.createElementNS({ns},'path');\n"
        f"{ind}wm.setAttribute('d', WM_PATH);\n"
        f"{ind}wm.setAttribute('transform', 'translate(' + ({w}-12-WM_PATH_W) + ',' + ({h}-12) + ')');\n"
        f"{ind}wm.setAttribute('fill','#1a1a1a'); wm.setAttribute('opacity','0.22');\n"
        f"{ind}{parent}.appendChild(wm);\n"
        f"{ind}const wmLogoSize = 13;\n"
        f"{ind}const wmTextW = WM_PATH_W;\n"
    )


# Per-tool (old, new) for the two non-standard tools.
SPECIAL = {
    "jsonvisualiser": (
        "      const wm = document.createElementNS(NS, 'text');\n"
        "      wm.setAttribute('x', svgW - 12); wm.setAttribute('y', svgH - 12);\n"
        "      wm.setAttribute('text-anchor', 'end'); wm.setAttribute('dominant-baseline', 'auto');\n"
        "      wm.setAttribute('font-family', 'DM Sans, sans-serif'); wm.setAttribute('font-size', '11');\n"
        "      wm.setAttribute('stroke', '#ffffff');\n"
        "      wm.setAttribute('stroke-width', '3');\n"
        "      wm.setAttribute('stroke-opacity', '0.70');\n"
        "      wm.setAttribute('paint-order', 'stroke');\n"
        "      wm.setAttribute('fill', '#1a1a1a');\n"
        "      wm.setAttribute('fill-opacity', '0.45');\n"
        "      wm.textContent = EXPORT_WATERMARK_TEXT;\n"
        "      svg.appendChild(wm);\n"
        "      const wmLogoSize = 13;\n"
        "      const wmTextW = measureWmText(wm.textContent, '500 11px DM Sans, sans-serif');\n",
        "      // Watermark text is baked to glyph outlines (WM_PATH) so the exported\n"
        "      // SVG carries no editable/searchable string; renders identically.\n"
        "      const wm = document.createElementNS(NS, 'path');\n"
        "      wm.setAttribute('d', WM_PATH);\n"
        "      wm.setAttribute('transform', 'translate(' + (svgW - 12 - WM_PATH_W) + ',' + (svgH - 12) + ')');\n"
        "      wm.setAttribute('stroke', '#ffffff');\n"
        "      wm.setAttribute('stroke-width', '3');\n"
        "      wm.setAttribute('stroke-opacity', '0.70');\n"
        "      wm.setAttribute('paint-order', 'stroke');\n"
        "      wm.setAttribute('fill', '#1a1a1a');\n"
        "      wm.setAttribute('fill-opacity', '0.45');\n"
        "      svg.appendChild(wm);\n"
        "      const wmLogoSize = 13;\n"
        "      const wmTextW = WM_PATH_W;\n",
    ),
    "sankeycreator": (
        "  const wm = document.createElementNS('http://www.w3.org/2000/svg','text');\n"
        "  wm.setAttribute('x', W - 12); wm.setAttribute('y', H - 10);\n"
        "  wm.setAttribute('text-anchor','end');\n"
        "  wm.setAttribute('font-family','DM Sans, sans-serif');\n"
        "  wm.setAttribute('font-size','11');\n"
        "  wm.setAttribute('fill','#1a1a1a');\n"
        "  wm.setAttribute('opacity','0.22');\n"
        "  wm.textContent = 'Made using tool.adjiebrotots.com/sankeycreator';\n"
        "  clone.appendChild(wm);\n"
        "  const wmLogoSize = 13;\n"
        "  const wmTextW = measureWmText(wm.textContent, '11px DM Sans, sans-serif');\n",
        "  // Watermark text is baked to glyph outlines (WM_PATH) so the exported\n"
        "  // SVG carries no editable/searchable string; renders identically.\n"
        "  const wm = document.createElementNS('http://www.w3.org/2000/svg','path');\n"
        "  wm.setAttribute('d', WM_PATH);\n"
        "  wm.setAttribute('transform', 'translate(' + (W - 12 - WM_PATH_W) + ',' + (H - 10) + ')');\n"
        "  wm.setAttribute('fill','#1a1a1a');\n"
        "  wm.setAttribute('opacity','0.22');\n"
        "  clone.appendChild(wm);\n"
        "  const wmLogoSize = 13;\n"
        "  const wmTextW = WM_PATH_W;\n",
    ),
}


def patch(tool, old, new):
    path = os.path.join(ROOT, FILES[tool])
    src = open(path).read()
    if "WM_PATH" in src:
        print(f"  {tool}: already patched, skipping")
        return False
    if src.count(old) != 1:
        print(f"  {tool}: ERROR expected exactly 1 watermark block, found {src.count(old)}")
        sys.exit(1)
    src = src.replace(old, new)

    # Inject constants on the line after `const WM_LOGO_SRC = ...;`
    lines = src.splitlines(keepends=True)
    for i, ln in enumerate(lines):
        if ln.lstrip().startswith("const WM_LOGO_SRC"):
            d = DATA[tool]
            const = (
                f'// Watermark wordmark ("{d["text"]}") baked to DM Sans {d["weight"]} glyph\n'
                f'// outlines by _ref/bake-watermark.py. Edit there + re-run, not here.\n'
                f'const WM_PATH = "{d["d"]}";\n'
                f'const WM_PATH_W = {d["width"]};\n'
            )
            lines.insert(i + 1, const)
            break
    else:
        print(f"  {tool}: ERROR could not find WM_LOGO_SRC declaration")
        sys.exit(1)
    open(path, "w").write("".join(lines))
    print(f"  {tool}: patched ({FILES[tool]})")
    return True


def main():
    for tool, ind, ns, w, h, textsrc, parent in STD:
        patch(tool, std_old(ind, ns, w, h, textsrc, parent), std_new(ind, ns, w, h, parent))
    for tool, (old, new) in SPECIAL.items():
        patch(tool, old, new)


if __name__ == "__main__":
    main()
