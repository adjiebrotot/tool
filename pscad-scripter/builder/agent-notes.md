# PSCAD Workflow Builder: notes for the AI section

Hand-written. `node _ref/agent-doc.mjs` merges these notes with what it reads from the page and
writes the skill reference (`ai/skill/references/`), the AI section in `index.html` (in the Quick
start list) and the lines in `llms.txt`. Edit here, never the generated text, then run the
generator. Text above the first heading (this) is not published. The headings are the same as in
`powerfactory-scripter/builder/agent-notes.md`, the Builder this one is ported from.

Like that one, it has no form fields: the workflow is one saved blob, so a link starts from a
Quick Start (`qs`, or `template`, the name the router `pscad-scripter/index.html` looks for),
changes a block's setting by the block's id (`blk.<id>.<setting>`) or the graph style
(`graph.<key>`), or replaces the workflow whole (`json`). All of it is read in `js/ui/agent.js` and
loaded through `loadWorkflow`, as a file is. The block types and settings are read from the block
registry, so they never go stale.

The tool writes the script and never runs PSCAD, so a reply carries no simulation result. A link
never carries Python code (the Python code block's `code`) nor the paths the script loads a
workspace or a library from (Start's `workspace` and `libraries`): a script from a link is run on
the reader's machine, so those stay at their defaults.

## Decides

Which study the PSCAD Python script runs, and in what order: a workflow of blocks (build the case, write component parameters, time a fault on its timed fault logic, run the EMT simulation, read output channels, check them for a peak, a nadir, THD, RMS, a sequence component, overshoot or damping, loops over values, layers and substitution sets, snapshots and simulation sets, results tables and graphs), the PSCAD case it opens and where its results go. The tool writes one ready-to-run Python script for PSCAD 5 and its Automation Library (mhi-pscad) from that workflow, and the user downloads it. It does not run PSCAD or work out a simulation result. The script comes from the tool, so a link to it gives the user the whole script.

## Most important

## Fields

## Hide

## Quick Starts

A Quick Start is a worked example workflow: it opens on the canvas and its script is written at once. They are listed with their blocks under QUICK START FIGURES; the id at the start of a block is what blk.<id>.<setting> names. Pick the one closest to the study the user describes and change what differs. Every Quick Start has its Start block at n1.

Without qs the Builder opens on an empty workflow with just a Start block. For a study no Quick Start is near, send the workflow in json. Leave the case (blk.n1.project) empty unless the user names it: it is a .pscx path or the name of a case already in the user's workspace, and an invented one makes the script stop. Leave channel names and component Names as the Quick Start has them unless the user names their own: they must match the user's case exactly. The user types them into the blocks, which say so while they are empty. The script is written as soon as the workflow is in, so run has no effect here.

## Example

Request: using tool.adjiebrotots.com/pscad-scripter/builder, write me a PSCAD script for C:/Studies/wind_farm.pscx that runs fault ride through for fault durations from 0.1 s to 0.3 s and saves the results tables as Excel files

Link:
- qs=frt
- blk.n1.project=C:/Studies/wind_farm.pscx
- why.blk.n1.project=The case the user named, as they wrote it
- blk.n2.from=0.1
- why.blk.n2.from=The user's shortest fault duration
- blk.n2.to=0.3
- why.blk.n2.to=The user's longest fault duration
- blk.n1.tableFmt=xlsx
- why.blk.n1.tableFmt=The user wants the results as Excel files
- note=Fault ride through, 0.1 to 0.3 s, Excel tables

Assumptions:
1. Study: the Fault ride through Quick Start (qs=frt): for each fault duration it times the fault on the case's Timed Fault Logic, runs the EMT simulation and tables the voltage dip and the machine speed nadir, with every run's speed on one graph.
2. Durations: 0.1 s to 0.3 s in the Quick Start's steps of 0.04 s (blk.n2.from, blk.n2.to).
3. Case: C:/Studies/wind_farm.pscx, exactly as the user wrote it.
4. Tables: saved as Excel files rather than CSV (blk.n1.tableFmt).
5. Channels and the fault component: left as the Quick Start has them (Vpcc, Machine Speed, master:tfaultn), for the user to set to the names in their own case.

## Compact lists

- `template=<id>`
- `blk.<id>.<setting>=<value>`
- `graph.<key>=<value>`

`template=<id>` is another name for qs=<id>. Use qs.

`blk.<id>.<setting>` changes one setting of one block on the canvas. The id is the block's id (n5): the Quick Starts list theirs, a json workflow names its own, and blk.start.<setting> reaches the Start block whatever its id. The setting is the key in the block's Settings line under REFERENCE: BLOCK TYPES (any case). The value is what the block shows: a number, in the unit its setting gives; yes or no (true and false work too); a choice, written as its value or the words shown for it; or text. A text with spaces is written with %20. A component setting (a PSCAD component picked by its definition and its Name, written component in the reference) takes a part: blk.n3.el.cls=master:tfaultn, blk.n3.el.name=F1 (a * matches anything), blk.n3.el.match=all (one, first or all). blk.<id>.label renames the block. A table of rows (the columns of a results table, a list of values) cannot be set this way: send json. A block the workflow does not have, a setting a block does not have, a choice it does not offer or a number that is not one is reported and skipped; a number outside its range is pulled into it and reported. Send one key per setting, and a why.<key> beside each.

The Start block holds the study's settings: project (the PSCAD case, a .pscx path or the name of a case in the workspace), outputDir (the folder results go in, empty is the script's own), tableFmt (csv, xlsx or both), fNominal (auto, 50 or 60), runMode (auto, launch, connect or inside), undoChanges (put changed values back at the end), showPscad, fortran (the compiler PSCAD names, empty is the one it has selected), pscadVersion, port and connectTimeout (seconds). workspace and libraries are not taken from a link.

`graph.<key>` sets how every graph the script draws looks. graph.template starts from a whole style (brotools, brotools-night, minimal, report, slides, ieee, elsevier, matlab, matplotlib or office) and replaces any graph key before it, so write it first. Then, in any order: font_size (5 to 30), title_size (5 to 48), line_width (0.3 to 8), width and height (the saved picture's size in inches, 2 to 30 and 1.5 to 20), dpi (50 to 600), legend (bottom, top, right, inside or none), grid_axes (both, y, x or none), grid_style (solid, dashed or dotted), frame (left-bottom, box, bottom or none), ticks (out, in or none), markers (auto, always or never), line_styles (solid or vary), title_align (center or left), also_save (svg or pdf; leave it out for PNG only), and yes or no for title_bold, thousands, legend_frame and transparent. Leave the graph style out unless the user asks for it.

## Json

`json=<workflow>` replaces the whole workflow with one of your own, in the form Save writes. Use it only for a study no Quick Start is near; to change a Quick Start, patch it. A qs before it is replaced. Write it compactly (no spaces or line breaks) and leave out everything the Builder fills in itself: x and y (it lays the blocks out left to right along the wires), every setting that is at its default, edge ids and the view.

{"name":"<name>","nodes":[<block>,<block>,...],"edges":[<wire>,<wire>,...]}

- A block is {"id":"n2","type":"<type>","label":"<optional name>","s":{<settings that differ>}}. The id is required and unique (n1, n2, ...). The type is one under REFERENCE: BLOCK TYPES. A setting is written as its type shows: a number, true or false, a choice's value, text; a component as {"cls":"master:resistor","name":"Rload","match":"one"}; a table as a list of rows, each with an id (c1, c2, ...) and the columns the reference names.
- There is exactly one block of type start (n1 in every Quick Start); one is added if there is none, and it holds the case.
- A wire is {"from":"n2","out":"ok","to":"n3","in":"in"}: an output port of one block into an input port of another, by the ids in the reference's Wires line. A flow wire (the order of steps) goes from a flow out to the flow in, which is "in"; most steps lead on with "next". A data wire goes from an output to an input whose type fits. A block with no flow in (Read a channel, the checks) needs only its data wires.
- A block of a kind the reference does not list, a second Start, and a wire to a port that is not there or does not fit are left out and reported. The Python code block can be placed, but its code stays at its default.
- Up to 300 blocks and 1500 wires.
A small study: run the case, read one channel and table its highest value (send the case with blk.n1.project or in the Start block's s):
{"name":"Peak voltage","nodes":[{"id":"n1","type":"start"},{"id":"n2","type":"px.run","s":{"duration":2}},{"id":"n3","type":"px.series","s":{"channel":"Vbus"}},{"id":"n4","type":"sig.peak","label":"Highest voltage"},{"id":"n5","type":"out.table.add","s":{"table":"Peak","cols":[{"id":"c1","name":"Highest voltage"}]}}],"edges":[{"from":"n1","out":"next","to":"n2","in":"in"},{"from":"n2","out":"ok","to":"n5","in":"in"},{"from":"n2","out":"result","to":"n3","in":"run"},{"from":"n3","out":"series","to":"n4","in":"series"},{"from":"n4","out":"value","to":"n5","in":"c1"}]}
