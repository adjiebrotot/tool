# Adjie Brotools (Adjie Brotot Tools)

Free, privacy-first, browser-based tools for finance, tax, property, engineering, and data-visualisation decisions — live at **[tool.adjiebrotots.com](https://tool.adjiebrotots.com/)**.

Created by **Adjie Brotosukmono** (adjiebrotot), an Indonesian power systems engineer based in Perth, Australia.

## Why these tools

- **100% client-side & private** — every tool is a static page; all calculations and file processing run locally in your browser. Nothing is uploaded, so it's safe even for confidential or sensitive data.
- **Completely free** — no paywall, no account, no watermark, including high-quality PDF/CSV/PNG/SVG exports.
- **Open source** — licensed under the GNU GPL. Wanna grab the source code of my amazing tools? Do it.

## The tools

| Tool | What it does |
| --- | --- |
| [Rent vs Own Home](https://tool.adjiebrotots.com/rentvsownhouse/) ([ID](https://tool.adjiebrotots.com/rentvsownhouse/id/)) | Model renting vs buying property over time — fixed/floating rates, setup/ongoing costs, and [multi-scenario sensitivity analysis](https://tool.adjiebrotots.com/rentvsownhouse/sensitivity/). Comparable commercial software costs tens of thousands of dollars. |
| [PPh 21 Pisah vs Gabung](https://tool.adjiebrotots.com/pisahvsgabung/) ([ID](https://tool.adjiebrotots.com/pisahvsgabung/id/)) | One-of-a-kind comparison of Indonesian PPh 21 under separate (pisah harta) vs joint (gabung harta) filing. |
| [Finance vs Cash](https://tool.adjiebrotots.com/financingvscash/) | Compare paying cash vs financing while investing unused cash. |
| [DCA Scenario Explorer](https://tool.adjiebrotots.com/dcasimulator/) | Compare dollar-cost averaging strategies. Includes a [common yfinance ticker reference](https://tool.adjiebrotots.com/dcasimulator/ticker/) for AU, ID, US, and SG, and a [Portfolio mode](https://tool.adjiebrotots.com/dcasimulator/portfolio/) for comparing multi-asset portfolio strategies side by side. |
| [PowerFactory Scripter](https://tool.adjiebrotots.com/powerfactory-scripter/) | Generate DIgSILENT PowerFactory Python scripts in minutes instead of hours/days. The generated script is yours; generation runs locally, suiting security-restricted environments. |
| [WEM Constraint Checker](https://tool.adjiebrotots.com/wemconstraint-checker/) | Check WA WEM constraint equations in the browser. |
| [Graph Visualiser](https://tool.adjiebrotots.com/graphvisualiser/) | Turn CSV/spreadsheet data into interactive charts without coding. |
| [Sankey Diagram Creator](https://tool.adjiebrotots.com/sankeycreator/) | Build Sankey diagrams and export SVG/PNG. |
| [JSON Visualiser](https://tool.adjiebrotots.com/jsonvisualiser/) | Lazy-loaded tree that handles millions of JSON keys/values without error. |
| [Strategy Canvas Builder](https://tool.adjiebrotots.com/canvasbuilder/) | Beautiful, interactive, pitch-ready strategy canvases (Business Model Canvas, etc.). |
| [Markdown to PDF](https://tool.adjiebrotots.com/mdtopdf/) | Read Markdown and export print-ready PDF with LaTeX math, diagrams, and auto ToC. |
| [Cost of Living Comparator](https://tool.adjiebrotots.com/costofliving-comparator/) | Compare living costs across cities. |
| [Video to GIF](https://tool.adjiebrotots.com/videotogif/) | Convert video to GIF locally — videos never leave your device. |

## Repo layout

Every tool is a self-contained directory (`index.html` + `script.js` + `style.css`) served as a
static page. There is no build step and no dependency install — open a page and it runs.

Shared, cross-tool files live at the repo root:

| File | What it is |
| --- | --- |
| `shared.css`, `light.css`, `dark.css` | The design system and the two colour themes. |
| `shared.js` | `SharedFmt` (number input formatting), `SharedYF` (market data via the self-hosted Cloudflare Worker in `dcasimulator/yf-proxy-worker.js`), `SharedTA` (technical indicators), `SharedConfig` (config download/upload), `Persist` (mini cache), `SharedTooltip`. |
| `tour-shared.js`, `tour-shared.css` | The guided-tour engine. A tool opts in with a `tour.js` that sets `window.__TOUR = { seenKey, launchLabel, steps }` and loads `tour-shared.js` after it. |
| `_ref/` | Build-time helpers and the design reference — not shipped to users. |

## Audit harnesses

Calculation-heavy tools carry an audit harness that drives the real page in headless Chromium and
checks its output against an independent replay of the documented mathematics, rather than against
the tool's own code:

```sh
cd <tool>/_audit && node run.mjs      # dcasimulator uses run.js
```

Harnesses live in `costofliving-comparator/`, `dcasimulator/`, `financingvscash/`, `pisahvsgabung/`,
`rentvsownhouse/`, and `rentvsownhouse/sensitivity/`. `rentvsownhouse/audit/` is the earlier
JS-versus-Python cross-model audit that these superseded; its CSV outputs are generated, not
committed. `powerfactory-scripter/audit/` validates generated scripts against a nine-bus reference
case.

## Multi-language pages

`rentvsownhouse` and `pisahvsgabung` ship an Indonesian version at `<tool>/id/`. These static pages are generated from the English page plus the `LANG.id` table in each tool's `script.js`:

```sh
node _ref/bake-id.mjs
```

Re-run this after editing either tool's `index.html` or its `LANG` translation table, and commit the regenerated `<tool>/id/index.html`.
