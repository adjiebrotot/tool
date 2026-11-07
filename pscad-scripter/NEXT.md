# pscad-scripter: what is built, and what is left

Written 2026-11-07. The tool is a port of `powerfactory-scripter/builder/` to PSCAD, with its
engine layer rewritten and its EMT-specific parts added.

**Nothing left on this list needs a PSCAD engine.** Everything that did has been run: the
runtime is live-verified, the component reference is read out of a real PSCAD 5.0.0, and the
end-to-end tests generate scripts and run them against the engine. What remains is page
authoring, documentation and the rest of the audit suites, all of which can be done on any
machine.

---

## Built and verified

### The engine layer, live-verified on PSCAD 5.0.0

`builder/runtime/px_core.py`, `px_model.py`, `px_studies.py` (about 2,900 lines):

- connect and open a case (launch, connect, or run from inside PSCAD), with the namespace shim
  and the environment guard an older PSCAD needs
- find components by definition and name, across every page including module pages
- read and write parameters with their units, enable and disable, put everything back at the end
- layers, scenarios, global substitutions, and loops over each
- input controls: sliders, switches, dials, buttons
- build a page from script: components, wires, buses, output channels, graph frames
- build the case and report the compiler's own errors; run the EMT simulation; read the output
  channels from the `.out` files or off the case's graphs
- snapshots, simulation sets with a volley, the Multiple Run component

### The pure half, ported unchanged

So the UI and UX match the sibling tool: all of `js/core`, `js/ui`, and the check, result, flow,
values, search and advanced blocks, plus `base.py`, `signals.py`, `outputs.py`, `optimise.py`.

### 106 blocks in 17 families

The PSCAD ones are in `js/blocks/{start,model,study}.js`. Six EMT checks are new, in
`js/blocks/check.js`: RMS of a waveform, harmonic distortion (THD), sequence component,
unbalance factor, overshoot and rise time, damping of a ringdown.

### Ten Quick Start templates

build-check, frt, sweep, harmonics, cct, layers, snapshot, substitutions, parallel, damping.
Each is generated and compiled before it is written out.

### The component reference data, read out of a running PSCAD

`reference/components.json` (383 Master Library definitions with every parameter, its unit,
range, default and help text), `params.json` (the lean file the editor downloads) and
`definitions.json` (the picker's list). Rebuilt by
`builder/_audit/reference/build_reference.py`.

### Site registration

`sitemap.xml` and `llms.txt` carry the tool, the Builder and the question list an answer engine
matches on. `abbr.js` holds the EMT and PSCAD vocabulary.

---

## Left to do

### 1. The landing page's hero animation (the one visible gap)

`index.html` is written: the head, the SEO and JSON-LD, the copy, the four "What it does" cards,
the "Learn PSCAD scripting" card and the footer. **Its animated hero diagram is missing.** The
section is marked `pfl-hero pfl-nofig`, which collapses it to one column so the page does not
look broken, but the page is much weaker without the diagram.

What to do: copy the sibling's `svg.pfl-anim` wholesale (`powerfactory-scripter/index.html`
lines 162 to 183, about 17.8 kB) into a `figure.pfl-stage` in the hero, remove the `pfl-nofig`
class, and change **only the words and the block colour classes**. Keep every viewBox,
transform, path, rect, x, y, width, height, class name and element count exactly as they are:
`style.css` animates those classes on a timeline, so changed geometry breaks the animation.
`.pfl-check` and `.pfl-flow` were added to `style.css` for this.

The story to tell is the `frt` Quick Start:

| Where | Class | Says |
|---|---|---|
| loop tab | | Each pass, Fault duration (s) |
| (14 66) | `pfl-b pfl-flow` | Fault duration (s), step 1, "Each number from 0.08" / "to 0.24, step 0.04", ports Each pass and After all passes |
| (276 66) | `pfl-b pfl-study` | Run simulation, step 2, "5 s, 50 us step", Reached the end / Stopped early |
| (516 40) | `pfl-b pfl-check` | Speed nadir, step 3, "Frequency nadir of" / "(machine speed)", output Lowest |
| (516 184) | `pfl-b pfl-check` | Voltage dip, step 4, "Lowest value of" / "(bus voltage)", output Lowest |
| (770 40) | `pfl-b pfl-result pfl-addrow` | Add row to results table, Into "FRT", columns "Speed nadir (Hz)" and "Lowest voltage (kV)" |
| (516 328) | `pfl-b pfl-check` | the dragged block: Harmonic distortion (THD), renamed Voltage THD |
| palette | | header "Power system checks", items RMS of a waveform, Harmonic distortion (THD), Sequence component, Overshoot and rise time |

Keep the replacement strings about the length of the ones they replace, or they overflow their
block. Rewrite the svg `<title>` to describe this story for a screen reader.

### 2. The reading pages: `reference/` and `python/`

The generator is half written under `_pages/`:

| File | State |
|---|---|
| `_pages/lib.mjs` | done, ported, the shared page shell |
| `_pages/build.mjs` | done, the entry point, with `--urls` and `--sitemap` |
| `_pages/check.mjs` | done, checks links, JSON-LD, canonicals, duplicate titles, em-dashes, ids, and the sitemap |
| `_pages/README.md` | done |
| `_pages/tasks.mjs` | written, not yet exercised |
| `_pages/tasks/getting-started.mjs` | written, one guide of seven |
| `_pages/definitions.mjs` | **missing** |
| `_pages/reference.mjs` | **missing** |
| `_pages/tasks/*.mjs` for the other six guides | **missing** |

`build.mjs` imports `loadAll`, `defnPages` and `indexPage` from `reference.mjs`, so it cannot
run until that exists. The sibling's `reference.mjs` and `classes.mjs` are the shape to follow.

The seven guide slugs, chosen to be frozen addresses: `getting-started`, `build-and-run`,
`fault-studies`, `parameter-sweep`, `harmonics`, `snapshots-and-batch`, `control-tuning`.
`index.html` already links all seven plus `reference/`, so **those eleven links are 404 until
this is done**. `node pscad-scripter/_pages/check.mjs` lists them.

Do not fabricate simulation results in the guides. The sibling's guides quote numbers recorded
from real runs; there are no such recordings here, so the guides should show the method, the
script and what to look at, and say the numbers come from the reader's own case.

When the pages are written: `node pscad-scripter/_pages/build.mjs --sitemap` adds their URLs.

### 3. The Builder walkthrough guide, `guides/`

Not started. Port `powerfactory-scripter/guides/` (`index.html`, 28 kB, plus `scenes.js`, which
drives live demos of the Builder in a frame). The handles were renamed in the port: the global
is `window.PXB`, the classes and ids are `pxb-*`, the app id is `pscad-builder` and the
tour-seen key is `pscad-builder-tour-v1-seen`. The demo workflows are built from PowerFactory
block types and must be rebuilt from real PSCAD ones. Check it with
`node _ref/guide-check.mjs pscad-scripter`. Its sitemap entry was removed until the page exists.

### 4. The Builder's own documents

- `builder/README.md`, the technical README. The sibling's is the shape to follow. The section
  worth the most is "PSCAD facts the code relies on": see "Known about this machine" below.
- `builder/runtime/API-px.md`, the runtime API table, one row per `@helper` section of
  `px_core.py`, `px_model.py` and `px_studies.py`. The sibling's `runtime/API-pf.md` is the model.

### 5. AI links

`builder/agent-notes.md`, then `node _ref/agent-doc.mjs` to write `agent.txt` and `agent.html`,
entries in `_ref/agent-links.json`, the page in `_ref/agent-lib.mjs` `PAGES`, and
`node _ref/agent-check.mjs pscad-scripter` green. Add `builder/agent.html` to `sitemap.xml`
after it exists.

### 6. The remaining site registration

- a `CARDS` line in `_ref/og.mjs`, then `node _ref/og.mjs pscad-scripter` to draw the social
  card, and `node _ref/og.mjs --tags` to write the tags into every page
- `node _ref/updated.mjs` to stamp `dateModified` and the footer date
- the page in `_ref/share-check.mjs` and `_ref/scenario-check.mjs`
- `node _ref/abbr-check.mjs`, `node _ref/button-check.mjs`, `node _ref/dropdown-check.mjs`,
  `node _ref/tip-check.mjs pscad-scripter`

### 7. The rest of the audit suites

Ported from `powerfactory-scripter/builder/_audit/`: `choice`, `families`, `data`, `graphstyle`,
`ui`, and the full `codegen/run.mjs`. `codegen/smoke.mjs` stands in for the last one for now.

### 8. The home page card

`index.html` at the repo root, and its `home-anim.js` drawing (the `tool-animator` agent draws
those). Only when the user asks for it.

---

## Known about this machine, and about PSCAD 5.0.0

Each of these cost real time to find and is worked around in the runtime. They belong in
`builder/README.md` when it is written.

- PSCAD 5.0.0 is the only version installed here, and GFortran 4.6 the only compiler.
- Any pip `mhi-pscad` from 2.3 on needs the `mhi.pscad.common` alias shim `px_core.py` installs.
  Without it the library's receive thread dies on the first call that returns such an object
  and takes the whole connection with it.
- `NoDefaultCurrentDirectoryInExePath`, set by some hardened environments, is inherited by PSCAD
  and breaks EMTDC's generated batch files: the case builds and the run dies with
  "'<case>.exe' is not recognized". `px_core.py` clears it.
- `pscad.settings()` raises under Automation Library 3.x here (no `ProductList.xml`), which is
  why nothing in the runtime depends on it.
- `Project.find_all()` takes an exact definition only. A wildcard, a bare definition with no
  namespace and a name pattern all come back empty, so `px_find` walks the project's pages
  itself for anything else.
- A unit-carrying parameter value is a subclass of `float` whose unit is only in its text, so it
  has to be read as text before it is read as a number or the unit is silently lost.
- PSCAD stores a written unit literally ("2500 [mohm]" stays in mohm) rather than normalising it.
- `Project.messages()` is replaced at the start of every clean, build and run, not appended to,
  so there is no delta to track.
- `GlobalSubstitution` is a mapping of **sets**, each a mapping of name to value. A project with
  no named sets has one set whose name is the empty string.
- `GlobalSubstitution.create_sets()` closes PSCAD 5.0.0's automation connection, so
  `gs_set_active` never creates a set.
- `SimulationSet.add_task` is unknown to PSCAD 5.0.0; `add_tasks` works.
- `Component.enabled` needs PSCAD 5.0.2. `enable()` and `disable()` work on 5.0.0, so
  `set_enabled` records the opposite state and says so once.
- Output channels go ten to a `.out` file, with a `.inf` index naming them in order. A three
  phase channel becomes three, named "Desc:1" to "Desc:3".
- The run's plot step sets how far up a harmonic spectrum is real: 250 us resolves to about
  2 kHz.

---

## The checks

Offline, no PSCAD needed:

```
node pscad-scripter/builder/_audit/codegen/smoke.mjs
node pscad-scripter/builder/_audit/templates/build.mjs --check
node pscad-scripter/builder/_audit/blocks/run.mjs --no-live
node pscad-scripter/_pages/check.mjs
python pscad-scripter/builder/_audit/runtime/live/loader.py
python pscad-scripter/builder/_audit/runtime/analysis/test_emt.py
```

With PSCAD installed and the sandbox made
(`python pscad-scripter/builder/_audit/runtime/live/sandbox.py`):

```
python pscad-scripter/builder/_audit/runtime/live/live_tests.py
node pscad-scripter/builder/_audit/blocks/run.mjs
python pscad-scripter/builder/_audit/reference/build_reference.py
```

`_pages/check.mjs` reports the eleven links from the landing page into `python/` and
`reference/` as unresolved. That is item 2 above, and is expected until the pages are generated.
