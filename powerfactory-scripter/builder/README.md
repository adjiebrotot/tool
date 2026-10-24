# PowerFactory Workflow Builder — technical README

> **Page:** `index.html` (tool.adjiebrotots.com/powerfactory-scripter/builder/)
> **Type:** static page, no build step, no backend. The node canvas is React Flow 12, vendored.
> **Purpose:** the engineer wires **blocks** into a **workflow** on a canvas; the page writes **one
> ready-to-run Python file** that drives DIgSILENT PowerFactory 2024 through its Python API.

The form-based PowerFactory Scripter (`../`) covers one study shape (inputs, a study, outputs). The
Builder covers any sequence an engineer can draw: loops over study cases, scenarios, variations,
elements or contingencies; decisions; load flow, RMS, EMT, harmonic and short-circuit runs with
events; checks such as frequency nadir, settling time and RoCoF; named results tables, graphs, and
Optimise / Find limit searches.

---

## 1. How it fits together

```
 palette ──┐                         ┌── Settings tab (inspector)
 canvas ───┼── store (the workflow) ─┼── Python tab  ◄── generate(workflow, runtime)
 toolbar ──┘   undo / redo, Persist  └── Problems tab ◄──┘        │
                                                                  └── runtime/*.py helpers, sliced in
```

- **Store** (`js/ui/store.js`): the one source of truth, a workflow in the saved format (§3) plus the
  selection and the view. Every edit is a pure function in `js/ui/ops.js` that returns a new
  workflow; the store keeps the undo stack and tells the panes.
- **Canvas** (`js/ui/canvas.js`): React Flow draws the blocks and wires from the store and calls
  back into `ops.js`. Only the canvas is React; every other pane is plain DOM, so the site's
  dropdowns, tooltips and icons work in them. The app is marked `data-no-abbr` and
  `data-no-persist`: no text in it is decorated as an abbreviation, and Persist does not read its
  fields one by one but caches the whole workflow through `extra` (`js/ui/main.js`).
- **Layout** (`js/ui/layout.js`): the canvas fills the screen (the World Clock's map layout) and
  everything floats over it: the title card, the action bar (undo, redo, zoom, fit, Quick start,
  save, open, clear, Download), the Blocks panel on the left and the Settings / Python /
  Problems panel on the right. **Download** writes the study package (§2.1); the Python tab's
  small .py button still hands back the script alone. Both panels are docks: drag a title bar to move one, its chevron
  folds it, a double-click puts it back on its side (kept per viewer in localStorage
  `pfb-docks`). Fit view keeps the workflow in the part of the screen the docks leave free and
  never zooms below 0.5 (a long workflow shows its start). On a phone the Blocks panel starts
  folded and the right panel is a bottom sheet. The footer is one line along the bottom; where
  the screen is too narrow for all of it, an info button at its start opens the whole footer.
- **Icons** (`js/ui/icons.js`): one 24 x 24 line icon per block, after PowerFactory's own where it
  has one (the four-panel study case, the four dots of an operation scenario, the sheet with a
  branch of a variation, the busbar with arrows of a load flow, the lightning bolt of a short
  circuit). A family shares its base picture and a corner badge says what the block does with it
  (a circular arrow for "For each", a plus for "Create", a tick for "Activate", a clock for an
  event). `_audit/ui/icon-sheet.html` shows them all.
- **Code generator** (`js/core/codegen.js`): `generate(workflow, { runtime, now })` is a pure function
  (no DOM, deterministic, about 10 ms for 200 blocks) that returns the Python and the problems the
  page shows. It runs on every change (debounced).
- **Runtime** (`runtime/*.py`): real Python files of helpers. The generator copies in only the
  sections a workflow needs, with their dependencies and imports.
- **Graph style** (`js/core/graphstyle.js`, `js/ui/graphstyle.js`, `js/ui/graphpreview.js`): how
  every graph of a workflow looks, one setting of the whole workflow (§3.1). With nothing
  selected the Settings tab shows it under Graphs (and a graph block under Look); its Edit button
  opens a modal with six templates, every part of the look, and a preview drawn the way
  `outputs.py` lays the graph out with matplotlib.

## 2. Files

| Path | What it is |
|---|---|
| `index.html`, `style.css`, `tour.js` | the page, its styles (tokens only, both themes), the guided tour |
| `js/app.js`, `js/ui/*.js` | the editor: store, ops, canvas, palette, inspector (fields, element picker, attribute suggestions, the attached-file card, the schedule editor), Python and Problems tabs, files (Save / Open), the study package, templates, quick-add, keyboard, toasts, layout (docks), block icons |
| `js/core/registry.js` | the block contract: types, wire rules (`canConnect`, `whyNot`), categories, `defineBlock`, `settingsOf` (keeps old saved values meaningful), `portsOf`, `visibleSettings` (§4.1), `ELEMENT_CLASSES` |
| `js/core/attrdata.js` | what the page knows about a PowerFactory attribute (its unit, whether a class has a parameter), from the parent tool's reference data; the blocks ask it which choices can apply |
| `js/core/tabledata.js`, `zip.js` | reading an attached CSV / Excel file in the browser, and the ZIP the study package is written as |
| `js/core/workflow.js` | the saved format: `loadWorkflow` (never throws, migrations), `serialize`, the `# PFB1` line in the .py |
| `js/core/graphstyle.js` | the graph style (§3.1): its keys, templates, palettes, ramps and fonts, `normalizeStyle`, the GRAPH_STYLE lines, the line colours as `outputs.py` picks them |
| `js/core/codegen.js` | the generator (its header comment is the emit contract for block authors) |
| `js/core/names.js`, `pylit.js`, `problems.js`, `runtime-loader.js`, `blockkit.js` | identifiers and the reserved set, Python literals and safe comments, the problem messages, runtime slicing, shared block helpers |
| `js/blocks/*.js` | the 92 blocks, one file per palette category |
| `runtime/base.py` | generic helpers (logging, run folder, loop labels and skip rows, tables, series, conversions, maths) |
| `runtime/pf_core.py`, `pf_model.py`, `pf_studies.py` | PowerFactory helpers; documented in `runtime/API-pf.md` |
| `runtime/signals.py`, `outputs.py`, `optimise.py` | checks, graphs, searches; documented in `runtime/API-analysis.md` |
| `runtime/fonts/` | DM Sans Regular and Bold (static instances of the site's own DM Sans) and its SIL Open Font License, packed into the study package when the graphs are drawn in it |
| `templates/` | Quick Start workflows (`index.json` + one file each; ids are frozen): `headroom`, `ldf-cases`, `n-1`, `shc-buses`, `find-limit`, `frt`, `cct`; made by `_audit/templates/build.mjs` |
| `vendor/` | React 18.3.1, ReactDOM, `@xyflow/react` 12.12.0, the JSX shim; `vendor/README.md` has sources and SHA-256 |
| `_audit/` | the test suites (§8) |

### 2.1 The study package

A study is not only its script, so **Download** writes one `.zip` (`js/ui/package.js`):

```
<name>.py      the script
<name>.json    the workflow, for the Builder's Open button
<data files>   every file attached to a Read table from file block, under the name the script reads
fonts/         DM Sans and its licence, when the script draws graphs in it (the default style)
README.txt     what is in it and how to run it
```

The data files sit beside the script rather than in a folder, because `read_table` looks for a
plain name next to the script: unpack it anywhere and it runs. `js/core/zip.js` writes the archive
with the browser's own `CompressionStream` (and stores the files uncompressed where a browser has
none, which is still a valid `.zip`).

## 3. Saved state and compatibility

A reader's work lives in the mini cache (`Persist` namespace `powerfactory-scripter-builder`), in
saved `.json` files, and inside every generated `.py` (the last `# PFB1 {...}` line, which **Open**
reads back). All three are the same workflow:

```json
{ "app": "pf-builder", "v": 1, "name": "Headroom study",
  "nodes": [ { "id": "n4", "type": "pf.ldf", "x": 660, "y": 120, "label": "", "s": { "net": "case" }, "pin": [], "sv": 1 } ],
  "edges": [ { "id": "e3", "from": "n4", "out": "ok", "to": "n5", "in": "in" } ],
  "view": { "x": 0, "y": 0, "zoom": 1 } }
```

A data file a reader attaches to a **Read table from file** block travels beside the workflow, in
`wf.files` (`{ "<block id>": { name, mime, b64 } }`, `js/ui/ops.js`): the `.json`, the mini cache
and the study package carry it, a generated `.py` never does (`embedInPython` drops it, so a
script stays code and not somebody's spreadsheet). What the page read out of the file - its sheet
names, its column names, how many rows - is a small `file` setting on the block, so a `.py`
reopened in the Builder still knows the table's columns and offers them.

**Frozen handles** (rename the words a reader sees, never these): block `type` ids, setting keys,
select option values (always strings), port ids, template ids, the Persist namespace, the `PFB1`
line format. Rules the loader follows (`loadWorkflow`, `settingsOf`):

- every declared setting is saved; a missing one takes its default, an unknown one is kept untouched;
- a select value is compared as a string, and a value an option replaced maps to it (`was` list);
- a block type the page does not know is kept as a "Missing block" with its data and its wires;
- a wire to a port that is gone is kept and flagged, never silently dropped;
- a renamed port or setting keeps working through the block's `portAlias` / `settingAlias`;
  a changed meaning gets a new key and a `migrate(s, fromSv)` in the block (or `MIGRATIONS[v]` in
  `workflow.js` for the whole format);
- while a block file fails to load, autosave is held so the mini cache is never overwritten.

### 3.1 The graph style

How the graphs look is one setting of the whole workflow, saved as `graph` beside `nodes` and
`edges` (so the .json, the mini cache and the `# PFB1` line all carry it). It is saved in full,
so a workflow keeps its look if a template changes later. A workflow without it, which is every
workflow saved before graph styles, draws in the default: the **Adjie Brotools** style, the
site's own charts (the light theme's chart tokens, the neutral series sequence blue, gold, teal,
rose, purple, DM Sans, a bold centred title, the key under the graph, the value axis ending on a
tick). That default is a new look for old workflows by design; the **Builder classic** template
is the look before graph styles, for anyone who wants it back.

- Templates: `brotools` (default), `brotools-night`, `minimal`, `report` (serif, framed, 300 dpi,
  colour-blind safe lines), `slides` (16:9, large text), `classic`.
- A script that draws a graph gets `GRAPH_STYLE = {...}` in SETTINGS, one key per line with its
  choices in a comment; `outputs.py` `_po_st` reads it over `_PO_DEFAULT` with the same checks as
  `normalizeStyle`. Edited in the .py, it is read back on Open (`readBackGraphStyle`); a value
  that cannot be used takes the default's and is named in a note.
- **Frozen handles**: the workflow key `graph`, the style's keys, the template ids, the select
  values and the ramp ids. A key added later must default to the look before it. A key a newer
  Builder saved is kept on the workflow untouched.
- `_PO_DEFAULT` must equal the `brotools` template, and `_PO_RAMPS`, `_PO_CHOICES` and
  `_PO_RANGES` their twins in `graphstyle.js`: `_audit/graphstyle/run.mjs` holds them together.

## 4. Blocks

`defineBlock({...})` in `js/core/registry.js`; the contract is documented at the top of that file
and of `codegen.js`. Kinds: `start`, `action` (a step), `branch` (a step with several flow
outputs, such as Converged / Did not converge), `loop`, `callback` (Optimise, Find limit), `pure`
(a calculator), `terminal` (Skip to next pass, Stop the loop, Stop the workflow), `note`.

| Category | Blocks |
|---|---|
| Start | Start (project, study case, output folder, put changed values back, nominal frequency, run mode) |
| PowerFactory: cases and data (21) | elements, set / read attributes, dispatch (plant total, ngnum aware), scale (from the original value), service, put back; study cases, operation scenarios, variations: activate, create, save, loop through; test generator |
| PowerFactory: studies (14) | load flow, RMS and EMT (Record rows give time-series outputs; Reached the end / Stopped early / Did not initialise), harmonic load flow, short circuit; events (short circuit with clearing, switch, trip, load step, one parameter change, parameter steps over time); contingencies (define, loop through); read a series from a result |
| Power system checks (10) | remove spikes, frequency nadir (the ESS headroom rules: collapse, UFLS TRUE / FALSE / UNDEFINED), peak, settling time, RoCoF, value at time, final value, first crossing, check limits (incl. a curve), pass / fail |
| Results and graphs (11) | add row (named tables, skipped passes kept with a Status), save (CSV / Excel), table column (incl. the worst row), read a table from an attached file, time series / 2D / 3D / heat map / table / convergence graphs, series to CSV |
| Flow (11) | If, for a range, for each item (incl. the rows of a table), repeat, repeat until, skip, stop the loop, stop the workflow, print, remember / recall a value |
| Values and maths (19) | numbers, text, lists, ranges, arithmetic, formula, functions, compare, logic, statistics, text from values |
| Optimise and search (3) | Optimise, Find limit (bisection), Report this try |
| Advanced (2) | Python code, Note |

**Adding a block:** pick the category file, call `defineBlock` with a beginner title (verb for a
step, noun for a calculator), a desc of at most 200 characters, keywords, string option values,
units in `unit`, `fallback` settings for unwired inputs, `effects`, and an `emit(cx)` that uses
runtime helpers rather than inline PowerFactory code. Add its helper to the right runtime file
(`# @helper` section, docstring, `@needs`, `@imports`), then cover it in that category's test suite.

### 4.1 Only what can be chosen

A form that offers a choice which cannot apply is worse than no choice: it reads as though it
would do something. So a setting is drawn only where its value can change what the script does.

- `showIf(s, cx)` decides it. `cx.wired` is the set of input ports a wire goes into right now and
  `cx.inLoop` says whether the block sits inside a loop (from the generator's `regions`); an
  answer the caller does not have is `undefined`, which a block must read as **show it**.
- `optionsFor(s, cx)` on a select leaves out the options that cannot apply. It is the safe half of
  the pair: `ui/fields.js` always keeps the value in use in the list, so an old workflow never
  loses what it holds. Hiding a whole select instead would leave its value silently in force.
- A setting the reader **pinned** is always shown (`visibleSettings`): the generator writes its
  `SETTINGS` line whether or not it applies, and a line with no field behind it is a puzzle.
- A **required** setting is never hidden: the generator's "fill this in" to-do runs over
  `visibleSettings`, so hiding one would quietly delete its problem.
- Where the answer is a PowerFactory fact - what unit an attribute has, whether a class has
  `ngnum` - ask `js/core/attrdata.js`. It reads the parent tool's reference data lazily and
  answers `undefined` until it lands; the inspector primes it and redraws when it arrives.
  `ElmLne` `c:loading` is a percentage, so Read attribute shows neither a unit nor the parallel
  machines; `ElmSym` `pgini` is in MW, so it shows both and the unit list holds only MW and kW.
- The element picker's "If the name matches" row appears only once the name can match several
  (a `*` or `?`, or a picker already set to first or all).

`_audit/choice/run.mjs` holds the rules and the contract they must keep.

## 5. Code generation, in brief

- Structure checks first: one Start, flow wires form no circle, loop bodies are closed regions,
  terminals sit inside a loop or search.
- Structured emission: a branch with one live output becomes a guard clause (`if not ok:
  case_skipped(...); continue`); routes that rejoin become if / elif with the join after; a dead
  end inside a loop goes on to the next pass, inside a search ends the try, otherwise ends the
  workflow. The nearest loop or search decides which statement that is.
- Each loop pass runs in `try / except / finally`: a failed pass is logged and the loop goes on,
  what the pass changed is put back (`pf_mark` / `pf_undo`), the loop labels go into table rows and
  file names, and a pass that ended early still leaves a table row with its reason.
- Values are only used where they exist: an output is available after its block on the same route;
  a results read after a model change with no calculation between is an error.
- Layout of the file: docstring, imports, SETTINGS (Start's and pinned settings, each with what it
  is), PROBLEMS (a workflow with errors stops before connecting), CHECK_ONLY, `main()`, the copied
  helpers, then the `# PFB1` line.

## 6. Runtime helpers

Sections are marked at column 0 with `# @helper <name>`, `# @needs <a>, <b>`, `# @imports <line>`
and `# @end`. `runtime-loader.js` reads them, resolves needs transitively, deduplicates imports and
collects every top-level name for the reserved set. `_audit/runtime/live/loader.py` does the same in
Python and statically checks every section (needs, docstrings, ASCII, each section loads alone).

## 7. PowerFactory facts the code relies on (verified live on PF 2024)

- Time attributes of `ComInc` / `ComSim` use the project's display unit (ms on some projects):
  they are always written in seconds through `SetAttributeModeInternal(1)`.
- A short circuit is cleared by an `EvtShc` with `i_shc = 4`; codes 0 / 1 / 2 / 3 are 3-phase,
  2-phase, 1-phase to ground and 2-phase to ground; an unbalanced fault needs an unbalanced (`rst`)
  RMS run. `EvtParam` does not change a load; load steps use `EvtLod` in percent; a partial machine
  trip (`outNgnum`) has no effect in RMS.
- `AddVariable` reports success even for a bad name, so a recorded variable is checked with
  `FindColumn` after the run; results are read at once with `GetColumnValues` (about 300 times
  faster than `GetValue`) into memory, and the temporary result file is removed.
- Any `SetAttribute` invalidates results until the next calculation; changes persist after the
  script ends (so every change is recorded and put back); `GetCalcRelevantObjects` includes
  out-of-service elements and its order is not stable (sorted by name).
- Only one PowerFactory engine can run at a time; engine mode refuses while the GUI is open, so the
  generated script checks for it and also runs from inside PowerFactory.
- A parameter event (`EvtParam`) takes its new value as **text** and works on any `Elm*`, not only
  a DSL model: the real-world pattern is a voltage profile on an AC voltage source, `variable`
  `s:u0`, one event per step. Its `time` follows the project's display unit, so it is written
  through `set_seconds` like every other event time.
- `GetAttributeUnit` gives the unit a project *shows* for an attribute, and `None` for a result
  variable before any calculation. Conversion is only possible inside one family (power, reactive
  power, apparent power, time, voltage, current, energy); a percentage, a per-unit value or an
  angle cannot be converted at all, which is why the Unit choice is not offered for them.
- An operation scenario the workflow saved keeps what that save captured: `pf_undo` leaves those
  records alone (`scenario_save` notes how many were written). Without that, "put changed values
  back" at the end of the run empties the scenario the reader just filled, because the undo
  happens while that scenario is still active.
- `IntScenario.GetOperationValue(element, attr)` reads a scenario's stored value whether or not
  it is active, and always answers `[0, value]` - the 0 is not a validity flag.
- Verified 2026-10-24, against three guesses that looked right and were not: an EMT run
  (`ComInc.iopt_sim = "ins"`) **does** accept the balanced network `iopt_net = "sym"` and runs
  with it; `ComShc.iopt_cur` (maximum / minimum currents) is kept by every method including
  complete and IEC 61363; and `ComShc.iopt_shc` keeps all four fault types for every method. None
  of those three choices may be narrowed.

## 8. Tests

Run from the repository root (`D:\Repository\tool`):

| Command | Checks |
|---|---|
| `node powerfactory-scripter/builder/_audit/codegen/run.mjs` | the generator: names, literals, loading old state, every structural case, a 300-graph fuzzer, every script compiled, flow-only workflows executed against a stub runtime |
| `node powerfactory-scripter/builder/_audit/choice/run.mjs` | "only what can be chosen" (§4.1): every rule by the case it was written for, and the contract (no `showIf` throws, no `optionsFor` invents an option, a pinned setting stays, a required one is never hidden, the unit families match the runtime) |
| `node powerfactory-scripter/builder/_audit/data/run.mjs` | reading an attached CSV / Excel file: the page and `read_table` give the same table for the same fixtures, and the study package .zip is read back by Python's own `zipfile` |
| `node powerfactory-scripter/builder/_audit/blocks/pf/run.mjs [--no-live]` | the PowerFactory blocks: generation of every setting variant, validators, and 19 live runs on the sandboxes, each ending with a sandbox audit. Single blocks: load flow on every case, dispatch sweep, study cases and scenarios, short circuit, fault event, EMT, RMS trip, N-1, variations, test generator, events, parameter steps. Whole shapes a reader builds: `nested` (three loops inside each other), `branch` (routes, skip to next pass, stop the loop), `series` (four curves from one run, every check, a graph and a CSV), `optimise` (a bisection and an optimiser closing the loop through the load flow), `untilxl` (repeat until, an .xlsx read by the script, a table saved as CSV and Excel), `casetable` (an attached case table driving the dispatch) and `packaged` (the .zip the Download button writes, unpacked by Python and run from where it landed) |
| `node powerfactory-scripter/builder/_audit/blocks/analysis/run.mjs [--live]` | the analysis blocks, executed on the two real traces in `_audit/runtime/fixtures/` |
| `node powerfactory-scripter/builder/_audit/templates/run.mjs` | every Quick Start template: generates, compiles, runs live, and loads on the page |
| `node powerfactory-scripter/builder/_audit/ui/run.mjs` | the editor in Chromium at desktop and phone width |
| `node powerfactory-scripter/builder/_audit/graphstyle/run.mjs` | the graph style (§3.1): the rules for saved styles, the frozen handles, the page and the script agreeing (every case `_po_st` reads, the line colours), GRAPH_STYLE written and read back, DM Sans in the package, every template drawn by matplotlib, and the modal in Chromium |
| `python powerfactory-scripter/builder/_audit/runtime/analysis/test_analysis.py` | the analysis helpers offline |
| `python "%PFB_PFRUN%" powerfactory-scripter/builder/_audit/runtime/live/live_tests.py` | the PowerFactory helpers live on both sandboxes |
| `node _ref/button-check.mjs builder`, `dropdown-check`, `tip-check`, `node _ref/abbr-check.mjs` | the site-wide checks (on Windows the filter must be a fragment without slashes) |

Live runs need PowerFactory 2024 closed (engine mode), Python 3.12, and the sandbox projects
"Nine-bus System (Builder test)" and "39 Bus New England System (Builder test)" (copies of the
DIgSILENT demos); every live test proves the sandbox is left as it found it. They also need
`PFB_PFRUN`, the path of a local lock runner (not in the repo) that runs one PowerFactory engine
at a time and refuses while the PowerFactory window is open; without it the runners skip the
live part and say so.
