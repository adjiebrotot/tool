# pscad-scripter: what is built, and what is left

Written 2026-11-07. The tool is a port of `powerfactory-scripter/builder/` to PSCAD, with its
engine layer rewritten and its EMT-specific parts added.

**Nothing left on this list needs a PSCAD engine.** Everything that did has been run: the
runtime is live-verified, the component reference is read out of a real PSCAD 5.0.0, and the
end-to-end tests generate scripts and run them against the engine. What remains is page
authoring, documentation and the rest of the audit suites, all of which can be done on any
machine.

Re-run against the engine on 7 November 2026, all green: `live_tests.py` 170 ok, `blocks/run.mjs`
74 passed, `build_reference.py` 383 definitions. That run found and fixed one real bug: the
Choice symbolic values were paired with the wrong labels (see the last entry under "Known about
this machine"), so `reference/` was rebuilt.

The same rebuild added two fields the data had been throwing away. The files are written with
sorted keys, so a parameter's place in the component's own dialog was lost; each parameter now
carries `i`, its position in the form, and each definition carries `groups`, the order of the
form's own sections. Both are additive, the Builder reads `params.json` unchanged, and the
reference pages lay a component out the way PSCAD's dialog does because of them.

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

### 1. The landing page's hero animation — done

The sibling's `svg.pfl-anim` is in, as a `figure.pfl-stage`, and `pfl-nofig` is gone. Every
viewBox, transform, path, rect and class name is the sibling's, so the timeline in `style.css`
drives it unchanged; what was rewritten is the words, the block colour classes
(`pfl-flow` for the loop, `pfl-check` for the three checks) and the block and palette icons,
which now come from the Builder's own set in `builder/js/ui/icons.js`.

It tells the `frt` Quick Start: a loop over the fault duration, Run simulation, Speed nadir and
Voltage dip into Add row to results table, and a Harmonic distortion block dragged out of the
Blocks panel, renamed Voltage THD, wired in, and the workflow downloaded. The `<title>` says the
same thing for a screen reader. Rebuilt by hand, not by a script: changing it again means
editing the SVG in `index.html` in place.

### 2. The reading pages: `reference/` and `python/` — done

`_pages/` is complete and `node pscad-scripter/_pages/build.mjs --sitemap` writes **354 pages**
(about 7 MB), all of them in `sitemap.xml`:

| File | What it writes |
|---|---|
| `_pages/reference.mjs` | `reference/` and one page per definition, from `reference/components.json` |
| `_pages/definitions.mjs` | the curated layer: the group order, the notable definitions, the index's lookup table |
| `_pages/tasks/hub.mjs` | `python/` |
| `_pages/tasks/<slug>.mjs` | one per guide, all seven |

The eleven links from the landing page resolve, and so do the two addresses `llms.txt` names.
`node pscad-scripter/_pages/check.mjs` is green: **356 pages checked, 0 problems**.

Three things worth knowing before changing any of it:

- **A definition's address is its name**, lower case, with anything that is not a letter or a
  digit turned into a hyphen (`master:xfmr-3p2w` becomes `reference/xfmr-3p2w/`). Frozen now
  that they are published: rename the words on a page, never the folder.
- **345 definitions get a page; 38 do not.** Those 38 have no parameters at all - some are the
  library's own pages rather than components, the rest are wires and markers like a ground or a
  jumper. They are listed by name on the reference index instead, so nothing is unfindable.
- **A guide shows no recorded numbers**, on purpose: every number out of PSCAD depends on the
  reader's own case. Each guide gives the method, the script the Builder writes, and what to
  look at. The nine `.py` files published beside the guides are generated by the Builder's own
  code generator at build time, so they cannot drift from it, and all nine compile.

One check changed with them: `check.mjs`'s U3 rule no longer treats "load flow" and "short
circuit" as porting leftovers. They are ordinary English that PSCAD's own parameter text uses,
and the guides have to be able to say that PSCAD has neither, which is what readers arrive
looking for. The PowerFactory names and commands that would be a real leftover are still caught.


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

### 6. The remaining site registration — done

- **done** the `CARDS` lines in `_ref/og.mjs`, and `og/pscad-scripter.jpg` and
  `og/pscad-scripter-builder.jpg` drawn from the pages. `node _ref/og.mjs --tags` reports
  nothing to change: the tags the pages already carry are the right ones.
- **done** `node _ref/updated.mjs`: both pages carry `dateModified` 2026-11-07 and a footer to
  match. Both scripts needed a Windows fix first (`fileURLToPath` for `ROOT`, `pathToFileURL`
  for the main guard); on Windows they had been doing nothing at all.
- **not applicable** `_ref/share-check.mjs` and `_ref/scenario-check.mjs` cover the form tools
  that ship Share links and scenario files. Neither scripter is in them, and neither should be:
  a Builder workflow travels as its own file and as a `#load` link, which `agent-check.mjs`
  covers instead (item 5).
- **done** `abbr-check` (pscad pages all pass; the one failure in the suite is `embed/`, which
  came in before this tool), `button-check` (40 pass across the two pages; the one failure is
  `rentvsownhouse/sensitivity/id/`), `dropdown-check` (0 failed),
  `tip-check pscad-scripter` (85 tips, 6 passed, 0 failed).

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
- `Component.range()` gives a Choice parameter's symbolic values as a **set**, with no order
  and no tie to the form's own list of choices, so they have to be paired with the labels by
  spelling. `build_reference.py`'s `pair_choices` does that, and two things matter: an exact
  spelling has to beat a containing one (the label "R" takes the symbol `R`, not `RLC`, which
  also contains it), and the set has to be sorted first or the pairing comes out differently on
  every run. Until 7 November 2026 it did neither, and 24 definitions carried wrong values
  (`master:Dload` wrote `RLC` for "R"). `match_score` ranks exact, then containing, then a
  shared opening, and the suite in that file's docstring examples still pairs correctly.

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

Rebuild the reading pages after any change to the reference data or a guide, because the
published pages are generated:

```
node pscad-scripter/_pages/build.mjs --sitemap
node pscad-scripter/_pages/check.mjs
```

Last full run, 7 November 2026, all passing: smoke 151, templates 10, blocks (offline) 18,
loader 87 sections, EMT analysis 42, live runtime 170, live blocks 74, reference 383
definitions, pages 356 checked with 0 problems, and the nine `.py` files published beside the
guides all compile.
