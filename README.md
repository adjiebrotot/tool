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
| [Finance vs Cash](https://tool.adjiebrotots.com/financingvscash/) | Compare paying cash vs financing while investing unused cash, across the seven repayment structures lenders actually sell. Six worked comparisons — house, car, phone plan, credit-card 0%, flat-rate motorbike, payment holiday — load in one click, each over differing terms so none is decided by the price tag. [Loan Types Explained](https://tool.adjiebrotots.com/financingvscash/loan-types/) defines all seven structures, gives the formula behind each, names the markets it is sold in, and works one of the Quick Start presets through with charts. |
| [Financial Freedom Calculator](https://tool.adjiebrotots.com/financialfreedom/) | Work out the pot you need before you can stop working, and the age you actually reach it. Inflation-adjusted, with a Monte Carlo confidence band instead of a single average return, and life stages on both sides: what you earn (study, a hustle age, part-time work, a pension) and what you spend (kids, slower later years), each between two ages. |
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
| [World Clock](https://tool.adjiebrotots.com/worldclock/) | A live full-screen world map with the local time on every country, state and territory, opening on your own region. Time Travel to any date and time in any place to convert a meeting time, daylight saving included; zoom out for a classic time zone map. |
| [Egg Price](https://tool.adjiebrotots.com/eggprice/) | See how much of each egg carton you pay for shell and how much for the egg, with the price per gram of egg only. 3D eggs to scale, cut open, with the shape maths behind the shell weight. |

## Repo layout

Every tool is a self-contained directory (`index.html` + `script.js` + `style.css`) served as a
static page. There is no build step and no dependency install — open a page and it runs.

Shared, cross-tool files live at the repo root:

| File | What it is |
| --- | --- |
| `shared.css`, `light.css`, `dark.css` | The design system and the two colour themes. |
| `shared.js` | `SharedFmt` (number input formatting), `SharedCurrency` (the one currency-symbol list every display-only currency picker is filled from: a `<select data-currency-symbols>` gets $ € £ ¥ ₹ Rp RM … in the same order on every tool, with Indonesian names on `/id/` pages. Nothing converts, so these are symbols, never ISO codes; codes are kept for the Cost of Living Comparator, which applies real exchange rates. A plan saved with a code reopens on its symbol through `SharedCurrency.toSymbol`), `SharedFreq` (a per-period amount follows its frequency: change a field from Monthly to Yearly and the 500 beside it becomes 6,000, rounded back to the field's own precision), `SharedYF` (market data via the self-hosted Cloudflare Worker in `dcasimulator/yf-proxy-worker.js`), `SharedTA` (technical indicators), `SharedConfig` (config download/upload), `SharedScenario` (the floppy-disk and open-folder buttons every finance tool carries in its Quick Start row, or its header where it has none: they write every input to a JSON file and read one back, built on the `Persist` snapshot so JS-only state such as scenario lists and edited brackets rides along), `SharedLegend` (chart legend swatches: each entry is drawn with the mark its series is drawn with — solid, dashed, dotted, shaded band, marker — on the page and in the PNG/SVG exports alike), `SharedZoom` (the two promises every zoomable chart makes: a pan or a pinch can never leave the data, and the y axis is refitted to the x window on every gesture, so a zoomed-in slice is drawn at its own scale rather than smeared against a scale built for the whole series), `SharedPane` (axis text on a chart of stacked panes, such as a balance under its cash flows or oscillators under a price: each stacked axis gets the width its labels and title need, and a title too long for its pane breaks onto two lines or shortens rather than running into the next pane), `Persist` (mini cache), `SharedTooltip`, `SharedAbbr` (the abbreviation glossary: subject-matter jargon found in page text gets a dashed underline and a hover definition), `SharedColDrag` (a grip in a table's header cell lifts its whole column and drops it somewhere else, with mouse, touch or the arrow keys; the tool decides what a move means). |
| `manifest.webmanifest`, `sw.js`, `pwa.js` | The installable app (PWA). Every page links the manifest and loads `pwa.js`, which registers the service worker and shows the homepage's small install banner. `sw.js` serves from the network first, re-checking every file with the server on each load (not the 10-minute HTTP cache), and keeps a copy of whatever loads, so a deploy is live on the next open and a tool opened once still works offline. An app left open in the background compares its page's `Last-Modified` with the server's when it returns to the foreground and offers a reload after a deploy. New tools need nothing extra; bump `VERSION` in `sw.js` only to wipe every stored copy. Icons are in `logos/icon-*.png`. |
| `tour-shared.js`, `tour-shared.css` | The guided-tour engine. A tool opts in with a `tour.js` that sets `window.__TOUR = { seenKey, launchLabel, steps }` and loads `tour-shared.js` after it. |
| `_ref/` | Build-time helpers and the design reference — not shipped to users. |

## Audit harnesses

Calculation-heavy tools carry an audit harness that drives the real page in headless Chromium and
checks its output against an independent replay of the documented mathematics, rather than against
the tool's own code:

```sh
cd <tool>/_audit && node run.mjs      # dcasimulator uses run.js and integrity.js
```

`financingvscash/_audit/` carries a second harness beside that one.
`accounting.mjs` runs `ACCOUNTING-PLAN.md`, a plan written against the page's
own tooltips and double-entry first principles *before* its source was opened,
so every test cites a claim the page makes rather than a line of code. Its
sharpest test needs no replay at all, because it fixes the answer to a constant:
borrow at exactly the rate your spare cash earns, charge no fee, and financing
has to leave you level with paying cash — for any loan type, frequency, term or
down payment. No modelling choice can move a zero, so a drift names its own
cause.

`financialfreedom/_audit/` also carries `regression.mjs`, which holds every plan
that could be entered before life stages to the figures the old code gave, to
the last binary digit: 238 plans, the unchanged Quick Start buttons, and old
mini-cache files reopened, against a recorded baseline or, with
`--live <rev>`, against the old page loaded from git beside the new one.

Harnesses live in `costofliving-comparator/`, `dcasimulator/`, `financialfreedom/`,
`financingvscash/`, `financingvscash/loan-types/`, `pisahvsgabung/`, `rentvsownhouse/`,
`rentvsownhouse/sensitivity/`, and `worldclock/`. The World Clock's harness checks every clock on
its map, for all 407 zones and across Time Travel jumps over daylight-saving changes,
against Python's `zoneinfo`, which reads the system's tz database rather than Chromium's.
Its map, `worldclock/zones.json`, is built by `worldclock/_build/build.mjs` from a
timezone-boundary-builder release clipped to Natural Earth coastlines; re-run it when a
new release is out. The Rent vs Own page and its Sensitivity page run one shared engine
(`rentvsownhouse/engine.js`), and `rentvsownhouse/sensitivity/_audit/parity.mjs` types the same
scenarios into both and requires byte-identical cashflow exports. `rentvsownhouse/audit/` is the earlier
JS-versus-Python cross-model audit that these superseded; its CSV outputs are generated, not
committed. `powerfactory-scripter/audit/` validates generated scripts against a nine-bus reference
case, and its `audit_custom_functions.py` checks the pre-made Custom Calculation library on plain
CPython, with no PowerFactory needed.

Eight cross-tool checks live in `_ref/`. `node _ref/quickstart-check.mjs` drives every tool that
ships Quick Start scenarios instead of a Reset button and proves the claim that lets it: it
applies each scenario to a freshly loaded page and to a page whose every control has been
scribbled over, and the two have to land on identical form state across every tab — plus, where a
tool seeds a detailed view from the simple field it replaces, the two have to agree.

`node _ref/scenario-check.mjs` drives every finance page's save and open buttons: it moves the
page off its defaults, saves, opens the file on a fresh page, and the two have to match field for
field and answer for answer, and still match after a reload. A file saved by one tool is offered to
another, which has to refuse it untouched.

`node _ref/freq-check.mjs` drives every tool that pairs a money field with a frequency
control and checks that moving the control rescales the money: the arithmetic and its
rounding, the bases that are not periods at all (a "% of value" cost is left as typed),
and that the tool's own state moved with the field rather than just its markup.

`node _ref/unit-check.mjs` drives every control that changes a field's unit, not only a
frequency: money and a "%" of the price, the home's value or a year of rent (Rent vs Own and
its detailed cost rows), a fee as money or a % of the amount financed and the per-repayment
amounts under a new repayment frequency (Finance vs Cash), a deposit or stamp duty as an amount
or a % of the price (Borrowing Capacity), a weekly or a monthly buying style (DCA), and a
household total with a share or each spouse's own salary (PPh 21). Each switch restates the
field so it describes the same money, and the check holds that to the tool's own answer rather
than to the field: the cashflow export, the comparison table, every borrowing cap or the tax
sweep is read before and after the switch and has to match, line for line where the new figure
is exact, and a switch back has to give back what was typed. Where the new unit cannot hold the
figure exactly (a "%" to two decimals, a split to whole percents) it states the bound the
rounding allows and holds the drift inside it. `ONLY=<name>` runs one tool.

`node _ref/chart-check.mjs` drives every page that draws an interactive chart and holds it to
the four things a chart here promises: that the export cluster is the same row everywhere —
⬇ SVG, ⬇ PNG, ⧉, ⟳ in that order, at one size, hard right of the title on a desktop and full
width on a phone, with a table's ⬇ CSV beside the table it exports; that panning and pinching
stay inside the data, floor included; that the y axis follows the x window; and that no axis
title or tick label lands on another or spills out of its pane, on a desktop, a phone and a small
phone (it also reaches the Finance vs Cash sensitivity sweep and the DCA price chart with its
oscillator panes). `SHOT=<dir>` saves each chart as the check saw it; `ONLY=<name>` reruns one
page. It uses the
real Chart.js, chartjs-plugin-zoom and Plotly rather than stubs, since the promises are about
what those libraries do: they are fetched once into `_ref/.libcache/` (gitignored) and served
from there afterwards, so later runs need no network.

`node _ref/tip-check.mjs` loads every page and holds every tooltip to the budget that makes one
readable where it pops up: one thought per tip, 200 characters of rendered text at the outside and
150 as the aim, no em-dash, and never empty. It also drives every dropdown and segmented control
through all of its values and re-checks each state, because the tip on a dependent field is
written to follow that field: a loan type, a study type or a Simple/Detailed switch carries the
option that is *selected* rather than a list of all of them. A tip that carried no domain fact
(no definition, unit, rule or caveat) is deleted rather than shortened, so every (i) on a page is
a promise that something non-obvious sits behind it. Pass a path fragment
(`node _ref/tip-check.mjs rentvsownhouse`) to run one tool.

`node _ref/form-check.mjs` holds every finance page to the shared finance skeleton
(`_ref/design-reference.md`, Finance Tool Skeleton): it opens every tab and sub-tab and fails if a
number field loses its unit or its limits, if a value typed past a field's maximum is not pulled
back, if a slider loses its end labels, if a chart axis loses its title or a y axis its unit, if
an em-dash appears in page text, tips or placeholders, if an option a reader is choosing between
is drawn in red, or if a tool loses its one-sentence answer or its What this assumes card.
`ONLY=<path>` runs one page.

`node _ref/abbr-check.mjs` loads every page and
checks the abbreviation glossary (`SharedAbbr`): that decoration never lands in a link,
a button, a form control, a page title or user content, that the visible text is
unchanged by it, that hovering opens the definition, and that the dashed underline
resolves in both themes. It also prints how often each term is decorated per page.

## Multi-language pages

`rentvsownhouse` and `pisahvsgabung` ship an Indonesian version at `<tool>/id/`. These static pages are generated from the English page plus the `LANG.id` table in each tool's `script.js`:

```sh
node _ref/bake-id.mjs
```

Re-run this after editing a tool's `index.html` or its `LANG` translation table, and commit the regenerated `<tool>/id/index.html`.

The markup carries the English copy beside its key, so the English page needs no translation pass and the baker only has work to do on the Indonesian one. `data-i18n` and `data-i18n-opt` name an element's text; `data-i18n-tip`, `data-i18n-ph` and `data-i18n-title` name a tooltip, a placeholder and a title attribute on the tag that carries them. Baking them into the static page matters for crawlers that never run the script; the page also applies the same table at load, so the two can never disagree.
