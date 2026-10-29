# PowerFactory Workflow Builder: notes for the AI section

Hand-written. `node _ref/agent-doc.mjs` merges these notes with what it reads from the page and
writes `powerfactory-scripter/builder/agent.txt`, the AI section in `index.html` (in the Quick
start list) and the lines in `llms.txt`. Edit here, never the generated text, then run the
generator. Text above the first heading (this) is not published. The headings are the same as in
`rentvsownhouse/agent-notes.md`.

Two things are specific to this tool. It has no form fields: the workflow is one saved blob, so a
link starts from a Quick Start (a worked example workflow, `qs`, or `template`, the name the router
`powerfactory-scripter/index.html` looks for), changes a block's setting by the block's id
(`blk.<id>.<setting>`) or the graph style (`graph.<key>`), or replaces the workflow whole (`json`).
All of it is read in `js/ui/agent.js` and loaded through `loadWorkflow`, as a file is. The block
types and settings are read from the block registry, so they never go stale.

The tool writes the script and never runs PowerFactory, so a reply carries no study result. A link
never carries Python code (the Python code block's `code`) nor the PowerFactory Python folder
(`apiPath`): a script from a link is run on the reader's machine, so those stay at their defaults.

## Decides

Which study the PowerFactory Python script runs, and in what order: a workflow of blocks (load flow, N-1 contingencies, short circuit, RMS or EMT simulation, checks, loops, results tables and graphs), the project and study case it opens and where its results go. The tool writes one ready-to-run script for DIgSILENT PowerFactory 2024 from that workflow, and the user downloads it. It does not run PowerFactory or work out a study result, so never write the script's code yourself.

## Most important

## Fields

## Hide

## Quick Starts

A Quick Start is a worked example workflow: it opens on the canvas and its script is written at once. They are listed with their blocks under QUICK START FIGURES; the id at the start of a block is what blk.<id>.<setting> names. Pick the one closest to the study the user describes and change what differs. Every Quick Start has its Start block at n1.

Without qs the Builder opens on an empty workflow with just a Start block. For a study no Quick Start is near, send the workflow in json. Leave the project and study case empty unless the user names them: the project is typed exactly as PowerFactory's Data Manager shows it, and an invented one makes the script stop. The user types it into the Start block, which says so while it is empty. The script is written as soon as the workflow is in, so run has no effect here.

## Example

Request: using tool.adjiebrotots.com/powerfactory-scripter/builder, write me a PowerFactory script for the Nine-bus System project that runs an N-1 screening on the lines only and saves the results tables as Excel files

Link:
- qs=n-1
- blk.n1.project=Nine-bus System
- why.blk.n1.project=The project the user named, as they wrote it
- blk.n5.trafos=false
- why.blk.n5.trafos=The user wants lines only, so transformers are not taken out
- blk.n1.tableFmt=xlsx
- why.blk.n1.tableFmt=The user wants the results as Excel files
- note=N-1 screening of the lines, Nine-bus System, Excel tables

Assumptions:
1. Study: the N-1 screening Quick Start (qs=n-1): a base load flow, then each outage in turn with a load flow after it, and a results table of the highest line loading and lowest busbar voltage.
2. Outages: lines only, so the transformers are not taken out (blk.n5.trafos).
3. Project: Nine-bus System, exactly as the user wrote it.
4. Tables: saved as Excel files rather than CSV (blk.n1.tableFmt).
5. Study case, output folder and the rest of the Start block: left as the Quick Start has them, so the script uses the project's active study case and writes next to itself.

## Compact lists

- `template=<id>`
- `blk.<id>.<setting>=<value>`
- `graph.<key>=<value>`

`template=<id>` is another name for qs=<id>. Use qs.

`blk.<id>.<setting>` changes one setting of one block on the canvas. The id is the block's id (n5): the Quick Starts list theirs, a json workflow names its own, and blk.start.<setting> reaches the Start block whatever its id. The setting is the key in the block's Settings line under REFERENCE: BLOCK TYPES (any case). The value is what the block shows: a number, in the unit its setting gives; yes or no (true and false work too); a choice, written as its value or the words shown for it; or text. A text with spaces is written with %20. An element setting (a PowerFactory element picked by class and name, written element in the reference) takes a part: blk.n7.el.name=L* (a * matches anything), blk.n7.el.cls=ElmLne, blk.n7.el.match=all (one, first or all). blk.<id>.label renames the block. A table of rows (the columns of a results table, a list of values) cannot be set this way: send json. A block the workflow does not have, a setting a block does not have, a choice it does not offer or a number that is not one is reported and skipped; a number outside its range is pulled into it and reported. Send one key per setting, and a why.<key> beside each.

The Start block holds the study's settings: project and studyCase (the PowerFactory names, empty keeps the active study case), outputDir (the folder results go in, empty is the script's own), tableFmt (csv, xlsx or both), fNominal (auto, 50 or 60), runMode (auto, engine or inside), undoChanges (put changed values back at the end), fastMode and connectTimeout (seconds).

`graph.<key>` sets how every graph the script draws looks. graph.template starts from a whole style (brotools, brotools-night, minimal, report, slides, ieee, elsevier, matlab, matplotlib or office) and replaces any graph key before it, so write it first. Then, in any order: font_size (5 to 30), title_size (5 to 48), line_width (0.3 to 8), width and height (the saved picture's size in inches, 2 to 30 and 1.5 to 20), dpi (50 to 600), legend (bottom, top, right, inside or none), grid_axes (both, y, x or none), grid_style (solid, dashed or dotted), frame (left-bottom, box, bottom or none), ticks (out, in or none), markers (auto, always or never), line_styles (solid or vary), title_align (center or left), also_save (svg or pdf; leave it out for PNG only), and yes or no for title_bold, thousands, legend_frame and transparent. Leave the graph style out unless the user asks for it.

## Json

`json=<workflow>` replaces the whole workflow with one of your own, in the form Save writes. Use it only for a study no Quick Start is near; to change a Quick Start, patch it. A qs before it is replaced. Write it compactly (no spaces or line breaks) and leave out everything the Builder fills in itself: x and y (it lays the blocks out left to right along the wires), every setting that is at its default, edge ids and the view.

{"name":"<name>","nodes":[<block>,<block>,...],"edges":[<wire>,<wire>,...]}

- A block is {"id":"n2","type":"<type>","label":"<optional name>","s":{<settings that differ>}}. The id is required and unique (n1, n2, ...). The type is one under REFERENCE: BLOCK TYPES. A setting is written as its type shows: a number, true or false, a choice's value, text; an element as {"cls":"ElmLne","name":"*","match":"all"}; a table as a list of rows, each with an id (c1, c2, ...) and the columns the reference names.
- There is exactly one block of type start (n1 in every Quick Start); one is added if there is none, and it holds the project and study case.
- A wire is {"from":"n2","out":"ok","to":"n3","in":"in"}: an output port of one block into an input port of another, by the ids in the reference's Wires line. A flow wire (the order of steps) goes from a flow out to the flow in, which is "in"; most steps lead on with "next". A data wire goes from an output to an input whose type fits.
- A block of a kind the reference does not list, a second Start, and a wire to a port that is not there or does not fit are left out and reported. The Python code block can be placed, but its code stays at its default, and apiPath stays empty.
- Up to 300 blocks and 1500 wires.
A small study: load flow, then the lowest busbar voltage into a results table (send project and study case with blk.n1.* or in the Start block's s):
{"name":"Voltage screen","nodes":[{"id":"n1","type":"start"},{"id":"n2","type":"pf.ldf"},{"id":"n3","type":"pf.get","label":"Busbar voltage","s":{"el":{"cls":"ElmTerm","name":"*","match":"all"},"attr":"m:u"}},{"id":"n4","type":"out.table.add","s":{"table":"Voltage","cols":[{"id":"c1","name":"Lowest voltage (p.u.)"},{"id":"c2","name":"Lowest at"}]}}],"edges":[{"from":"n1","out":"next","to":"n2","in":"in"},{"from":"n2","out":"ok","to":"n3","in":"in"},{"from":"n3","out":"next","to":"n4","in":"in"},{"from":"n3","out":"min","to":"n4","in":"c1"},{"from":"n3","out":"at_min","to":"n4","in":"c2"}]}
