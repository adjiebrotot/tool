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
| [Borrowing Capacity (AU)](https://tool.adjiebrotots.com/borrowingcapacity/) | Work out how much an Australian bank would lend you, and which of the four caps (serviceability, DTI, LVR, deposit) is binding. Shows the full serviceability build-up line by line, which bank calculators never do. |
| [Finance vs Cash](https://tool.adjiebrotots.com/financingvscash/) | Compare paying cash vs financing while investing unused cash. |
| [Financial Freedom Calculator](https://tool.adjiebrotots.com/financialfreedom/) ([ID](https://tool.adjiebrotots.com/financialfreedom/id/)) | Work out the pot you need before you can stop working, and the age you actually reach it. Inflation-adjusted, with a Monte Carlo confidence band instead of a single average return. |
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
| [Random Picker](https://tool.adjiebrotots.com/randompicker/) | Pick one option at random with a spinning wheel, a 3D dice roll, a slot machine, or a Galton board. |

## Repo layout

Every tool is a self-contained directory (`index.html` + `script.js` + `style.css`) served as a
static page. There is no build step and no dependency install — open a page and it runs.

Shared, cross-tool files live at the repo root:

| File | What it is |
| --- | --- |
| `shared.css`, `light.css`, `dark.css` | The design system and the two colour themes. |
| `shared.js` | `SharedFmt` (number input formatting), `SharedFreq` (a per-period amount follows its frequency: change a field from Monthly to Yearly and the 500 beside it becomes 6,000, rounded back to the field's own precision), `SharedYF` (market data via the self-hosted Cloudflare Worker in `dcasimulator/yf-proxy-worker.js`), `SharedTA` (technical indicators), `SharedConfig` (config download/upload), `SharedLegend` (chart legend swatches: each entry is drawn with the mark its series is drawn with — solid, dashed, dotted, shaded band, marker — on the page and in the PNG/SVG exports alike), `Persist` (mini cache), `SharedTooltip`, `SharedAbbr` (the abbreviation glossary: subject-matter jargon found in page text gets a dashed underline and a hover definition). |
| `tour-shared.js`, `tour-shared.css` | The guided-tour engine. A tool opts in with a `tour.js` that sets `window.__TOUR = { seenKey, launchLabel, steps }` and loads `tour-shared.js` after it. |
| `_ref/` | Build-time helpers and the design reference — not shipped to users. |

## Audit harnesses

Calculation-heavy tools carry an audit harness that drives the real page in headless Chromium and
checks its output against an independent replay of the documented mathematics, rather than against
the tool's own code:

```sh
cd <tool>/_audit && node run.mjs      # dcasimulator uses run.js
```

Harnesses live in `costofliving-comparator/`, `dcasimulator/`, `financialfreedom/`,
`financingvscash/`, `pisahvsgabung/`, `rentvsownhouse/`, and
`rentvsownhouse/sensitivity/`. `rentvsownhouse/audit/` is the earlier
JS-versus-Python cross-model audit that these superseded; its CSV outputs are generated, not
committed. `powerfactory-scripter/audit/` validates generated scripts against a nine-bus reference
case, and its `audit_custom_functions.py` checks the pre-made Custom Calculation library on plain
CPython, with no PowerFactory needed.

Three cross-tool checks live in `_ref/`. `node _ref/quickstart-check.mjs` drives every tool that
ships Quick Start scenarios instead of a Reset button and proves the claim that lets it: it
applies each scenario to a freshly loaded page and to a page whose every control has been
scribbled over, and the two have to land on identical form state across every tab — plus, where a
tool seeds a detailed view from the simple field it replaces, the two have to agree.

`node _ref/freq-check.mjs` drives every tool that pairs a money field with a frequency
control and checks that moving the control rescales the money: the arithmetic and its
rounding, the bases that are not periods at all (a "% of value" cost is left as typed),
and that the tool's own state moved with the field rather than just its markup.

`node _ref/abbr-check.mjs` loads every page and
checks the abbreviation glossary (`SharedAbbr`): that decoration never lands in a link,
a button, a form control, a page title or user content, that the visible text is
unchanged by it, that hovering opens the definition, and that the dashed underline
resolves in both themes. It also prints how often each term is decorated per page.

## Multi-language pages

`rentvsownhouse`, `pisahvsgabung` and `financialfreedom` ship an Indonesian version at `<tool>/id/`. These static pages are generated from the English page plus the `LANG.id` table in each tool's `script.js`:

```sh
node _ref/bake-id.mjs
```

Re-run this after editing a tool's `index.html` or its `LANG` translation table, and commit the regenerated `<tool>/id/index.html`.

The markup carries the English copy beside its key, so the English page needs no translation pass and the baker only has work to do on the Indonesian one. `data-i18n` and `data-i18n-opt` name an element's text; `data-i18n-tip`, `data-i18n-ph` and `data-i18n-title` name a tooltip, a placeholder and a title attribute on the tag that carries them. Baking them into the static page matters for crawlers that never run the script; the page also applies the same table at load, so the two can never disagree.
