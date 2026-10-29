---
name: new-tool
description: Build a new tool for the Adjie Brotools static site (tool.adjiebrotots.com) so it matches the existing tools in design, SEO, language, testing, and footer. Use when the user asks to create, scaffold, or add a new tool/calculator/visualiser to this repo, or asks how new tools should be built here.
---

# Building a new tool

Every tool here is a self-contained static page in its own folder (`<toolname>/index.html`,
`script.js`, `style.css`), 100% client-side, no build step. A new tool should feel like it
belongs next to the existing ones. These are the things that matter most — follow them, but
use judgement; copying a nearby tool that already does something well beats reinventing it.

**The folder name is the tool's address** (`tool.adjiebrotots.com/<toolname>/`), and once
published it is kept for good, so choose it with care. Keep it simple: one plain word when
one word says it (`worldclock`, `eggprice`, `randompicker`). When it needs to be longer, for
the reader or for search, write it as lowercase words separated by a hyphen between every
word (`capacity-expansion-planner`, `ed-uc-simulator`), never words run together and then
hyphenated halfway (`capacityexpansion-planner`). Moving a published tool later means a
forwarding page at the old address and a `MOVED` entry in `_ref/share-check.mjs`.

## 1. Design — use the design reference

`_ref/design-reference.md` is the single source of truth for the look and feel (the "Generic
Soft UI" system: DM Sans / DM Mono, `dark.css` + `light.css` tokens, shared components). Read
it before writing markup, and reuse its components (control panel, tabs, sliders, KPI cards,
tables, tooltips, charts) rather than inventing new ones. Include the shared layers in order:

```html
<link rel="icon" type="image/svg+xml" href="../logos/logo.svg">
<link rel="manifest" href="../manifest.webmanifest">       <!-- installable app (PWA) -->
<link rel="apple-touch-icon" href="../logos/apple-touch-icon.png">
<script src="../pwa.js" defer></script>                   <!-- registers the service worker -->
<link rel="stylesheet" href="../dark.css">
<link rel="stylesheet" href="../light.css">
<script>if(self!==top&&/(?:^#|&)embed=/.test(location.hash))document.documentElement.classList.add("abt-embed","abt-embed-wait");</script> <!-- an embedded chart says it is loading from the first paint (SharedShare) -->
<link rel="stylesheet" href="../shared.css">
<link rel="stylesheet" href="style.css">   <!-- page-specific only -->
...
<script src="../dropdown.js"></script>     <!-- every dropdown's open list (dropdown.css comes via shared.css) -->
<script src="../chart-kit.js"></script>    <!-- what a chart is drawn with: SharedLegend, SharedChartTip, SharedZoom, SharedPane, ChartKit -->
<script src="chart-kit.js"></script>       <!-- only if the tool has chart pieces of its own (below) -->
<script src="../shared.js"></script>       <!-- helpers: SharedFmt, tooltips, Persist… -->
<script src="script.js"></script>
```

The fastest way to stay consistent is to open the closest existing tool and mirror its
structure. Theme toggle, dark/light behaviour, and fonts should match the others exactly.

**Dropdowns** come from `dropdown.css` / `dropdown.js` and need no styling of your own: a
short list is a plain `<select>` (no search), and only a database-sized list a reader
would scroll one by one (cities, time zones) is a searchable `.combo-input` + `.combo-list`.
Size a select if you must (padding, font-size, width, `--radius-sm`), never re-colour,
re-border or re-font it. See "Dropdowns: one look, two kinds" in the design reference and
run `node _ref/dropdown-check.mjs`.

### A finance tool: the seven-rule checklist

A calculator that handles money follows **Finance Tool Skeleton** in the design reference.
Before calling it done, every line here must hold:

- [ ] **Grouped**: inputs in `.field-group`s, generic before specific; first tab holds the
      four to six figures anyone knows, Currency first; a last **Assumptions** tab holds the
      guesses (inflation, growth, simulation, fill timing).
- [ ] **Currency is a symbol unless it converts**: a display-only picker is an empty
      `<select data-currency-symbols>` filled by `SharedCurrency` in `shared.js` (the one
      symbol list, $ € £ ¥ Rp…; add `data-currency-none` for a "None" option), labelled
      "Currency Symbol". ISO codes (AUD, USD, EUR) are only for a tool that really applies an
      exchange rate, like the Cost of Living Comparator.
- [ ] **Titles stay the real term, tooltips explain it**: keep jargon (Risk-Free Rate,
      Binding constraint) with a one-line plain tip; spell out abbreviations with the term
      in brackets ("safe withdrawal rate (SWR)").
- [ ] **The control fits the value**: known figures typed, guesses on sliders, small counts
      as segmented buttons (`SharedSeg.fromSelect`). One **Detail: Simple | Detailed** switch
      per group, first in it.
- [ ] **Same structure**: results open with a one-sentence answer (`SharedVerdict`, neutral
      tone for a comparison of options), then KPI cards, charts, tables folded behind
      a chevron (`SharedFold`), and a closing **What this assumes** card (folded closed
      by `shared.js`), built from the
      reader's own input on every redraw: only lines for what their plan uses, each naming
      its figure ("Inflation is 2.5% a year", not "Inflation is modelled"). Display options
      sit beside the results they change.
- [ ] **Units everywhere**: the unit is the field's prefix or suffix, never the label;
      `data-unit` when it lives in a column header, `data-unitless` for a seed. Every y axis
      names its unit, every x axis is titled, every table shows its unit per column
      (`<th>Label <span class="th-unit">MW</span></th>`, sentence case, never uppercase,
      free to wrap and centred both ways) or in its cells; a one-sentence `.unit-note` only
      for what neither can carry. No chart subtitle unless the chart is unreadable
      without it, and then one sentence (design reference, *Chart Card Scaffold*).
- [ ] **Bounds enforced by the form**: min/max on every typed number (`data-min`/`data-max`
      on money), SharedBounds pulls values back; sliders name both ends and take a typed value.
- [ ] **Colour means one thing**: options take `SharedPalette`'s neutral sequence (blue,
      gold, teal, rose…), never red; red is direction only; no hex typed into code, every
      colour a token, in both themes.

Add the page to `FINANCE` in `shared.js` and to `PAGES` in `_ref/form-check.mjs`, and run
`node _ref/form-check.mjs` (ONLY=<path> for one page). No em-dashes in page text.

### Buttons: one picture per job, every tool

Read **Buttons and Icons** in the design reference and find each button you need in
`_ref/button-map.md`; copy that row rather than drawing a new one.

- [ ] **✕ only closes, the bin only deletes.** Close is `SharedIcon.button('close', …)`;
      delete is `SharedIcon.button('trash', …)`. Never ✕, ×, ⊗ or 🗑 as text.
- [ ] **The same job gets the same picture**: duplicate (sheets and a plus), edit
      (pencil), save to a file (floppy), open a file (folder), clear a field (backspace
      key), `⬇` download, `⧉` copy, `⟳` reset the view, `↺` restore defaults, `▶` run,
      ASCII `+` add. No emoji in their place.
- [ ] **Icon-only buttons are bare** (`.btn-bare`: no fill, no border) unless they sit in
      a row of boxed buttons; every one has a title and aria-label.
- [ ] **The wanted outcome is the easy one.** An editor applies edits as they are made, so
      closing it keeps the work and there is no "close without saving"; a long form pins its
      Done to the bottom; the main action is on screen at first load.

Run `node _ref/button-check.mjs` (ONLY=<path> for one page).

## 2. SEO — match the standard head + register the page

Copy the SEO block from an existing tool's `<head>` and adapt it: `<title>`, `<meta
name="description">`, canonical link, Open Graph + Twitter tags, and a JSON-LD `WebApplication`
block. Its `author` and `publisher` are the person node every tool page shares (`"@id":
"https://www.adjiebrotots.com/#person"`, copied as the other tools have it), never a Person of
its own with another url or job title: that id is what joins the tools, the blog and
www.adjiebrotots.com into one maker. Then register the tool site-wide:

- Add a `<url>` entry to `sitemap.xml`, right after its parent's if it is a sub-page
  (entries run home first, then by path).
- Add the tool to `llms.txt` (and `README.md` if it's a headline tool).
- Give it a social preview: add a line to `CARDS` in `_ref/og.mjs`, then (with the repo served
  on :8412) `node _ref/og.mjs <tool>` draws `og/<tool>.jpg` and `node _ref/og.mjs --tags` writes
  `og:image`, its size and alt, and the large Twitter card into every page of the tool.
- `node _ref/updated.mjs` stamps the tool's `WebApplication` with `dateModified` (its sitemap
  `<lastmod>`), a free `offers` and its card as `screenshot`, and ends the footer's
  Disclaimer · Privacy · Blog line with "Updated <date>". Run it again whenever you bump the
  `<lastmod>`.
- Keep the Google `gtag` snippet and the AdSense `adsbygoogle.js` tag right after it, exactly
  as on the other pages (a page without the AdSense tag shows no ads).

**A sub-tool** (a page under another tool's folder, such as `dcasimulator/portfolio/` or
`costofliving-comparator/map/`) belongs to its parent everywhere:

- It keeps the parent's tool glyph, and its `<h1>` is `<Parent>: <Variant>` or the variant's
  own name (Portfolio DCA Simulator); the header carries only ← Other Tools and the theme.
- Each page links the other with a banner under the header, the `portfolioLinkDiv` pattern
  in `dcasimulator/`, not a header button.
- On the home page the parent's card turns its Open tool into the split button, with a
  menu row for the parent and one for each sub-tool.
- JSON-LD: the sub-page's block has `isPartOf` the parent, the parent's block has `hasPart`
  listing it (so does the parent's entry in the home page's `ItemList`), and the sub-page
  carries a `BreadcrumbList` of Adjie Brotools › parent › sub-page. An `/id/` page gets the
  Indonesian versions through `_ref/bake-id.mjs`, never by hand.

## 3. Language & descriptions — plain and tight

- **No em-dashes** in user-facing copy. Use a comma, a full stop, or restructure.
- Simple language, but do not dumb down the technical meaning. Say it plainly and correctly.
- No walls of explanation. If a field needs a note, put it in a **tooltip** (`data-tip="…"`,
  rendered by the shared global tooltip), not inline paragraph text.
- **One thought per tooltip**, 150 characters of rendered text as the aim and 200 at the
  outside. See "Tooltips" in `_ref/design-reference.md`, and check a new page with
  `node _ref/tip-check.mjs <tool>`.
- **No tooltip at all** where the label, a sub-line or the control itself already says it.
  A tip has to carry a domain fact: a definition, a unit, a rule, a caveat, a behaviour
  nobody could guess. If the only missing word is something like "annual", put it in the
  label instead of hiding it in a hover.
- **A control that names itself gets no tip**: a Simple/Detailed switch, a display toggle,
  a "Colour by" picker, a price or rate that is what its label says. Reserve the (i) for the
  technical and the non-obvious.
- A tooltip that **explains options** names each one in `<strong>Name:</strong>` and never
  runs them together as a paragraph. Three or fewer short ones: a `<ul>` list. More than
  three, or any needing a long sentence: explain only the **selected** option and add
  `data-tip-options`, which makes the shared tooltip add a small "Change the option to see
  the others explained." line. See "Tips that explain options" in `_ref/design-reference.md`.
- A tooltip on a **dependent** field is written to follow that field: it carries the option
  that is selected, or the state the control is in, not a list of every option. Leave its
  markup `data-tip=""` and fill it from the handler that already runs on change.

### Abbreviations explain themselves

`SharedAbbr` in `shared.js` underlines every known abbreviation in visible page text
with a soft dashed grey line and shows the expansion in the shared tooltip on hover
(LVR → Loan-to-Value Ratio). It runs on its own, so a tool that loads `shared.css` +
`shared.js` already has it. Two things a new tool owes it:

- **Add its terms** in `<tool>/abbr.js`, as `SharedAbbr.glossary('<tool folder>', { … })`,
  and load it right after `shared.js` on every page of the tool (`../abbr.js` from a
  sub-page). Never add a tool's terms to `shared.js`: only site-wide ones (`'*'`) live
  there, so no page downloads another tool's vocabulary. An entry is
  `[expansion, optional one-line gloss]`, or `{ en: […], id: […] }` for a tool with an
  Indonesian page. **Subject-matter jargon only**: the vocabulary of the field the tool
  works in (LVR, PTKP, RMS). Never file formats or everyday computing words (CSV, PDF,
  PNG, SVG, JSON), and not units sitting next to numbers. A tool whose page has no
  jargon adds nothing, which is a fine outcome.
- **Mark user content `data-no-abbr`**: an uploaded table, a rendered document, a JSON
  tree, anything the user typed. Site text teaches, user data is left alone.

Write labels in full anyway. The underline is a hint for a reader who does not know the
term, never a substitute for saying what a field means. See "Abbreviations" in
`_ref/design-reference.md`, and check a new page with `node _ref/abbr-check.mjs`, which
prints how often each term fires per page.

## 4. Do not touch the main index.html

The site's root `index.html` is the tool directory/landing page. **Do not add a new tool to it
unless the user explicitly asks.** Build the tool in its own folder and stop there.

When the user does ask, copy a card in `index.html` (the comment above the grid lists what
to change). Its description is one or two short sentences in the words people search for,
and its `data-anim` key needs a drawing in `home-anim.js`: hand that to the `tool-animator`
agent (`.claude/agents/tool-animator.md`) rather than drawing it inline.

## 5. Testing

Scale the rigor to the risk:

- **Finance / tax / engineering tools, or anything with calculation formulas the user will
  trust** — write an audit harness under `<toolname>/_audit/` (a `run.mjs` that drives the real
  page headless and checks the engine against an independent replay of the documented maths,
  plus edge cases). Follow the pattern in `financingvscash/_audit/`, `costofliving-comparator/_audit/`,
  etc. Verify calculation/formula/code integrity, not just that the page renders.
- **Every finance tool** also passes `node _ref/form-check.mjs` (units, bounds, slider ends,
  axis units, no em-dash, no red option, answer and caveats) alongside `_ref/quickstart-check.mjs`,
  `_ref/scenario-check.mjs`, `_ref/chart-check.mjs`, `_ref/tip-check.mjs` and `_ref/abbr-check.mjs`.
- **Every tool** passes `node _ref/button-check.mjs` (one picture per job, bare icon buttons,
  reachable main action) and `node _ref/dropdown-check.mjs` (every dropdown has the shared look
  and opens the shared list).
- **Every chart** gets the Share menu for free: write the usual `⬇ SVG`, `⬇ PNG`, `⧉`, `⟳`
  cluster (see Chart Card Scaffold and Share Menu in the design reference), export through
  `SharedExport.atDesktopSize`, and copy through `SharedShare.copyImage`. Add the page to
  `PAGES` in `_ref/share-check.mjs`, which proves a phone exports the desktop picture and the
  chart's embed redraws the same data. A chart whose view needs more than its inputs (a popup,
  a panel outside its card) registers `SharedShare.view` or names it in `data-share-view`.
- **An embed is the chart, drawn without the tool** (the embed viewer, `embed/`; see *An
  embed is the chart, not the tool* in the design reference). Mark each control in a chart's
  card that switches between views of what is already computed (a metric, line or candles, a
  year, an hour) with `data-embed-mode`, so the embed offers it; every other control stays
  out. Anything a chart is drawn with beyond Chart.js and `chart-kit.js` (a plugin, a custom
  interaction mode, a scale hook, a bespoke y fitter, a fill pattern) goes in the tool's own
  `chart-kit.js`, registered with `ChartKit.plugin` / `ChartKit.fn` / `ChartKit.make`, and
  reads its data from its arguments or the chart's options, never the tool's variables.
  Share-check's E3 and V1 fail if the embed draws anything the tool does not, and Embed as
  HTML prints `Embed snapshot left out: …` in the console for a function it could not carry.
- **Plain utility/visualiser tools with no risky finance/engineering output** — a visual check
  is enough: load the page, exercise the main flow, confirm it looks right and nothing errors.

## 6. Footer

- **Every tool** carries the links row `p.footer-links`: Disclaimer · Privacy Policy · Blog,
  linking `<root>/disclaimer/`, `<root>/privacy/` and https://blog.adjiebrotots.com/ with
  relative paths. The disclaimer text itself lives on `/disclaimer/`, never inline in a footer;
  a caveat specific to one tool goes on that page, or in its own short footer paragraph.
  Footer links are not underlined (underline on hover only, set in `shared.css`).
- **Finance / tax / engineering tools** open the footer with the one-line `p.footer-collab`
  (hobby, open to collaborate, a "let’s talk" mailto and the bug/help email), then the links
  row, then licence + made-in, as in `financingvscash/index.html` / `rentvsownhouse/footer.js`.
  Everything after the collab line is fine print, sized by `shared.css`.
- **Plain tools** — the links row above the licence (GNU GPL) and the "Made in Australia by
  Adjie Brotosukmono, an Indonesian engineer" line, the name linked to
  https://www.adjiebrotots.com/about/ with `rel="author"`.

## Simulate and Reset buttons

Neither is a default; see **When Reset and Simulate earn their place** in
`_ref/design-reference.md`. In short: time one recompute on the real page first —
under ~50ms the output just follows the inputs and there is no Simulate button,
over ~150ms (or if it fetches anything) it needs a real gate that actually gates.
A tool with Quick Start scenarios needs no Reset, provided each scenario opens
from the defaults rather than from whatever is on screen.

A gate is only honest if its states read at a glance (`financialfreedom` is the model):
- **Ready / up to date**: solid accent fill, text in `var(--text-inv)`, never a hard-coded
  `#fff` (the dark accent is pale, so white text on it reads as greyed out). The same goes for
  every active tab, pill or segmented button filled with an accent.
- **Out of date**: the moment an input changes, the button gets `.needs-run` (an `--accent2`
  ring), a short note says to press it, and the results dim (`body.is-stale`) until it is run.
- **Disabled**: `shared.css` dims any native `:disabled` button and stops its hover and press
  effects. Never override `--accent` with a paler shade on a page that fills buttons with it.

## Mini cache (nice to have)

Tools remember the user's work between visits via `Persist` in `shared.js`. When inputs map to
state, one line does it: `Persist.init('<toolname>', { onRestore: recompute })`. For state that
isn't in a form control (a JS array, a mode flag), pass an `extra: { save, restore }` and call
the returned `schedule()` after those changes. Mark transient controls (search boxes, editors)
with `data-no-persist`. See any recent tool's `script.js` for a worked example.

A finance tool also gets **save / open scenario** buttons (floppy disk and open folder) so a user
can keep a scenario as a JSON file and open it another day. One line after `Persist.init`:
`SharedScenario.mount('.quick-start-row', { tool: '<toolname>', persist })`, or `'.header-right'`
when the tool has no Quick Start row. Add the page to `_ref/scenario-check.mjs`.

An Engineering or Finance tool can also be opened by an AI assistant through a `#load` link
(`SharedAgent` in `shared.js`). Every input a reader can set, a feature like a frequency or a
mode included, must be reachable that way: add the page to `PAGES` in `_ref/agent-lib.mjs`, write
`<tool>/agent-notes.md` (Rent vs Own's is the worked example), register an adapter for state
beyond plain fields, run `node _ref/agent-doc.mjs`, add kept links to `_ref/agent-links.json`
and get `node _ref/agent-check.mjs <tool>` green. A tool whose solve is heavy honours `run=0`.
`agent-doc` writes `<tool>/agent.txt` and the same text as a web page, `<tool>/agent.html`, for
chatbots whose browser skips `.txt` files: add the `agent.html` to `sitemap.xml` after the tool's
own entry, and after the deploy run `node _ref/agent-live-check.mjs <tool>`.

For a multi-language tool (an `en` page and an `id/` page sharing one `script.js`), use a
**language-agnostic namespace** (`'pisahvsgabung'`, not `'pisahvsgabung-en'`). `localStorage` is
per-origin, so both pages then share one cache and a user's work follows them across a language
switch instead of resetting.

## Two agents

For a genuinely independent audit, keep building and checking separate:

- **tool-builder** builds/edits the tool.
- **tool-auditor** reviews it against this checklist and, for calculation-heavy tools, verifies
  the maths independently.

Using a fresh auditor that did not write the code makes the audit real rather than a rubber
stamp.
