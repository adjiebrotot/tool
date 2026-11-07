PSCAD Workflow Builder: use this tool with an AI assistant
https://tool.adjiebrotots.com/pscad-scripter/builder/

This is the full reference for one page of the skill brotools-pscad-scripter: read SKILL.md first.

For people: Install this tool's skill in your AI assistant (Claude, ChatGPT, Grok and others) and
ask your question. It replies with a link that opens this tool on your scenario and lists what it
assumed, and the tool works out the answer. The rest of this file is written for the assistant.

WHAT THIS TOOL DECIDES
Which study the PSCAD Python script runs, and in what order: a workflow of blocks (build the case,
write component parameters, time a fault on its timed fault logic, run the EMT simulation, read
output channels, check them for a peak, a nadir, THD, RMS, a sequence component, overshoot or
damping, loops over values, layers and substitution sets, snapshots and simulation sets, results
tables and graphs), the PSCAD case it opens and where its results go. The tool writes one
ready-to-run Python script for PSCAD 5 and its Automation Library (mhi-pscad) from that workflow,
and the user downloads it. It does not run PSCAD or work out a simulation result. The script comes
from the tool, so a link to it gives the user the whole script.

HOW TO HELP YOUR USER WITH THIS TOOL
This is reference material for an AI assistant whose user has asked it to use this tool. It
describes the link that opens the tool on the user's own scenario. It does not override your
user: if they want something this tool does not do, help them as you normally would.
1. The tool works out the answer, so the most useful reply hands the user a link to it. Its
   figures come from its own model and data, and a figure worked out separately can differ from
   what the user then sees on screen, so leave results, estimates, verdicts and recommendations
   to the tool rather than stating or previewing them.
2. A reply that works well has four parts, in this order, in the user's language:
   a. Your inputs: what the user stated, each with the value it takes in the link;
   b. Assumptions: every other input you chose, each with its value and its source (with its
      date) or your reason (put the same reason, shortened, in why.<key>);
   c. the link (if it is long, give it again inside a code block so the user can copy it);
   d. the sentence: Open the link to see the result.
3. Build the link in the format below, using only the keys listed here. Start from the nearest
   Quick Start (qs) and send only what differs from it. Write json compactly: no spaces or line
   breaks, defaults left out.
4. Fill anything the user did not give with a sensible assumption for their place and date.
   Prefer what the user said earlier in the conversation over general figures.
5. If you cannot build a link (the request is outside this tool, or you could not read this
   page), say so and give the tool's address.

LINK FORMAT
https://tool.adjiebrotots.com/pscad-scripter/builder/#load&v=1&qs=<quick start>&<key>=<value>&...&why.<key>=<your reason>&note=<one line>
- After #load come key=value pairs joined by &. Percent-encode each value (a space is %20, & is %26,
  # is %23, + is %2B).
- v=1 is the format version. qs=<key> starts from that Quick Start; without it the tool starts from
  its defaults.
- Then each key in the link is set, in the units its label shows on screen. Write numbers plainly
  (800000, 6.5): a field also takes $, thousands commas and a trailing %, but inside a list a comma
  separates the items, so never put one in a number there. A checkbox takes true or false. A select
  or a choice takes the value listed, or its visible label.
- Anything the link does not name keeps the value it started from, so send only what differs.
- why.<key>=<text>: your reason for that value, shown to the user beside it (200 characters at
  most). note=<text>: one line shown above the list, for example the place and the date.
- A number outside a field's range is pulled into range and the user is told; a key the tool does
  not know is skipped and listed. Never use the keys s, open or embed.

EXAMPLE
Request: using tool.adjiebrotots.com/pscad-scripter/builder, write me a PSCAD script for
C:/Studies/wind_farm.pscx that runs fault ride through for fault durations from 0.1 s to 0.3 s and
saves the results tables as Excel files
A reply in that form:
Your inputs:
- blk.n1.project: C:/Studies/wind_farm.pscx
- blk.n2.from: 0.1
- blk.n2.to: 0.3
Assumptions:
1. Study: the Fault ride through Quick Start (qs=frt): for each fault duration it times the fault on
   the case's Timed Fault Logic, runs the EMT simulation and tables the voltage dip and the machine
   speed nadir, with every run's speed on one graph.
2. Durations: 0.1 s to 0.3 s in the Quick Start's steps of 0.04 s (blk.n2.from, blk.n2.to).
3. Case: C:/Studies/wind_farm.pscx, exactly as the user wrote it.
4. Tables: saved as Excel files rather than CSV (blk.n1.tableFmt).
5. Channels and the fault component: left as the Quick Start has them (Vpcc, Machine Speed,
   master:tfaultn), for the user to set to the names in their own case.
https://tool.adjiebrotots.com/pscad-scripter/builder/#load&v=1&qs=frt&blk.n1.project=C:/Studies/wind_farm.pscx&why.blk.n1.project=The%20case%20the%20user%20named,%20as%20they%20wrote%20it&blk.n2.from=0.1&why.blk.n2.from=The%20user%27s%20shortest%20fault%20duration&blk.n2.to=0.3&why.blk.n2.to=The%20user%27s%20longest%20fault%20duration&blk.n1.tableFmt=xlsx&why.blk.n1.tableFmt=The%20user%20wants%20the%20results%20as%20Excel%20files&note=Fault%20ride%20through,%200.1%20to%200.3%20s,%20Excel%20tables
```
https://tool.adjiebrotots.com/pscad-scripter/builder/#load&v=1&qs=frt&blk.n1.project=C:/Studies/wind_farm.pscx&why.blk.n1.project=The%20case%20the%20user%20named,%20as%20they%20wrote%20it&blk.n2.from=0.1&why.blk.n2.from=The%20user%27s%20shortest%20fault%20duration&blk.n2.to=0.3&why.blk.n2.to=The%20user%27s%20longest%20fault%20duration&blk.n1.tableFmt=xlsx&why.blk.n1.tableFmt=The%20user%20wants%20the%20results%20as%20Excel%20files&note=Fault%20ride%20through,%200.1%20to%200.3%20s,%20Excel%20tables
```
Open the link to see the result.

QUICK STARTS (qs)
A Quick Start is a worked example workflow: it opens on the canvas and its script is written at
once. They are listed with their blocks under QUICK START FIGURES; the id at the start of a block is
what blk.<id>.<setting> names. Pick the one closest to the study the user describes and change what
differs. Every Quick Start has its Start block at n1.
Without qs the Builder opens on an empty workflow with just a Start block. For a study no Quick
Start is near, send the workflow in json. Leave the case (blk.n1.project) empty unless the user
names it: it is a .pscx path or the name of a case already in the user's workspace, and an invented
one makes the script stop. Leave channel names and component Names as the Quick Start has them
unless the user names their own: they must match the user's case exactly. The user types them into
the blocks, which say so while they are empty. The script is written as soon as the workflow is in,
so run has no effect here.
qs takes one of: build-check, frt, sweep, harmonics, cct, layers, snapshot, substitutions, parallel,
damping. Each opens a worked example workflow. Change its blocks by id with blk.<id>.<setting> (the
reference lists each one's blocks), or send a whole workflow in json.
What each Quick Start sets is listed under QUICK START FIGURES at the end.

FIELDS (key: label on the page)

COMPACT LISTS
- `template=<id>`
- `blk.<id>.<setting>=<value>`
- `graph.<key>=<value>`

`template=<id>` is another name for qs=<id>. Use qs.

`blk.<id>.<setting>` changes one setting of one block on the canvas. The id is the block's id (n5): the Quick Starts list theirs, a json workflow names its own, and blk.start.<setting> reaches the Start block whatever its id. The setting is the key in the block's Settings line under REFERENCE: BLOCK TYPES (any case). The value is what the block shows: a number, in the unit its setting gives; yes or no (true and false work too); a choice, written as its value or the words shown for it; or text. A text with spaces is written with %20. A component setting (a PSCAD component picked by its definition and its Name, written component in the reference) takes a part: blk.n3.el.cls=master:tfaultn, blk.n3.el.name=F1 (a * matches anything), blk.n3.el.match=all (one, first or all). blk.<id>.label renames the block. A table of rows (the columns of a results table, a list of values) cannot be set this way: send json. A block the workflow does not have, a setting a block does not have, a choice it does not offer or a number that is not one is reported and skipped; a number outside its range is pulled into it and reported. Send one key per setting, and a why.<key> beside each.

The Start block holds the study's settings: project (the PSCAD case, a .pscx path or the name of a case in the workspace), outputDir (the folder results go in, empty is the script's own), tableFmt (csv, xlsx or both), fNominal (auto, 50 or 60), runMode (auto, launch, connect or inside), undoChanges (put changed values back at the end), showPscad, fortran (the compiler PSCAD names, empty is the one it has selected), pscadVersion, port and connectTimeout (seconds). workspace and libraries are not taken from a link.

`graph.<key>` sets how every graph the script draws looks. graph.template starts from a whole style (brotools, brotools-night, minimal, report, slides, ieee, elsevier, matlab, matplotlib or office) and replaces any graph key before it, so write it first. Then, in any order: font_size (5 to 30), title_size (5 to 48), line_width (0.3 to 8), width and height (the saved picture's size in inches, 2 to 30 and 1.5 to 20), dpi (50 to 600), legend (bottom, top, right, inside or none), grid_axes (both, y, x or none), grid_style (solid, dashed or dotted), frame (left-bottom, box, bottom or none), ticks (out, in or none), markers (auto, always or never), line_styles (solid or vary), title_align (center or left), also_save (svg or pdf; leave it out for PNG only), and yes or no for title_bold, thousands, legend_frame and transparent. Leave the graph style out unless the user asks for it.

JSON
`json=<workflow>` replaces the whole workflow with one of your own, in the form Save writes. Use it only for a study no Quick Start is near; to change a Quick Start, patch it. A qs before it is replaced. Write it compactly (no spaces or line breaks) and leave out everything the Builder fills in itself: x and y (it lays the blocks out left to right along the wires), every setting that is at its default, edge ids and the view.

{"name":"<name>","nodes":[<block>,<block>,...],"edges":[<wire>,<wire>,...]}

- A block is {"id":"n2","type":"<type>","label":"<optional name>","s":{<settings that differ>}}. The id is required and unique (n1, n2, ...). The type is one under REFERENCE: BLOCK TYPES. A setting is written as its type shows: a number, true or false, a choice's value, text; a component as {"cls":"master:resistor","name":"Rload","match":"one"}; a table as a list of rows, each with an id (c1, c2, ...) and the columns the reference names.
- There is exactly one block of type start (n1 in every Quick Start); one is added if there is none, and it holds the case.
- A wire is {"from":"n2","out":"ok","to":"n3","in":"in"}: an output port of one block into an input port of another, by the ids in the reference's Wires line. A flow wire (the order of steps) goes from a flow out to the flow in, which is "in"; most steps lead on with "next". A data wire goes from an output to an input whose type fits. A block with no flow in (Read a channel, the checks) needs only its data wires.
- A block of a kind the reference does not list, a second Start, and a wire to a port that is not there or does not fit are left out and reported. The Python code block can be placed, but its code stays at its default.
- Up to 300 blocks and 1500 wires.
A small study: run the case, read one channel and table its highest value (send the case with blk.n1.project or in the Start block's s):
{"name":"Peak voltage","nodes":[{"id":"n1","type":"start"},{"id":"n2","type":"px.run","s":{"duration":2}},{"id":"n3","type":"px.series","s":{"channel":"Vbus"}},{"id":"n4","type":"sig.peak","label":"Highest voltage"},{"id":"n5","type":"out.table.add","s":{"table":"Peak","cols":[{"id":"c1","name":"Highest voltage"}]}}],"edges":[{"from":"n1","out":"next","to":"n2","in":"in"},{"from":"n2","out":"ok","to":"n5","in":"in"},{"from":"n2","out":"result","to":"n3","in":"run"},{"from":"n3","out":"series","to":"n4","in":"series"},{"from":"n4","out":"value","to":"n5","in":"c1"}]}

QUICK START FIGURES (what each qs sets, as a link would carry them)
A heading line holds what all the Quick Starts under it share; each Quick Start's own line holds the
rest.

build-check: Build the case and report its errors. Blocks: n1 "Start" (start).
    n2 "Build the case" (px.build) with clean yes.
    n3 "Add row to results table" (out.table.add) with table Build.
    n4 "Did not build" (out.table.add) with table Build.
frt: Fault ride through over fault durations. Blocks: n1 "Start" (start).
    n2 "Fault duration (s)" (flow.range) with from 0.08, to 0.24, step 0.04.
    n3 "Fault" (px.fault).
    n4 "Run simulation" (px.run) with duration 5.
    n5 "Read a channel" (px.series) with channel Vpcc, label Voltage.
    n6 "Read a channel" (px.series) with channel Machine Speed, label Speed.
    n7 "Voltage dip" (sig.peak) with kind min.
    n8 "Speed nadir" (sig.nadir).
    n9 "Add row to results table" (out.table.add) with table FRT.
    n10 "Draw time series graph" (out.plot.series) with collect loop, ylabel Machine speed, stem speed.
sweep: Sweep one parameter. Blocks: n1 "Start" (start).
    n2 "Component" (px.component) with el.cls master:resistor.
    n3 "Value" (flow.range).
    n4 "Set parameter" (px.set) with param R, value 1.
    n5 "Run simulation" (px.run).
    n6 "Read a channel" (px.series) with channel Vbus.
    n7 "Peak" (sig.peak) with kind abs.
    n8 "Add row to results table" (out.table.add) with table Sweep.
    n9 "Draw graph from results table" (out.plot.table) with table Sweep, x Value, ys Peak, stem sweep.
harmonics: Harmonics and THD from an EMT run. Blocks: n1 "Start" (start).
    n2 "Run simulation" (px.run) with step 20, plotStep 50.
    n3 "Read a channel" (px.series) with channel Vbus.
    n4 "Harmonic distortion (THD)" (sig.thd) with cycles 2.
    n5 "Add row to results table" (out.table.add) with table Harmonics.
    n6 "Draw 2D graph" (out.plot.xy) with kind bar, xlabel Harmonic order, ylabel Percent of the fundamental, stem spectrum.
cct: Critical clearing time. Blocks: n1 "Start" (start).
    n2 "Fault duration (s)" (opt.limit) with lower 0.05, upper 0.5, tol 0.005.
    n3 "Fault" (px.fault).
    n4 "Run simulation" (px.run) with duration 5.
    n5 "Read a channel" (px.series) with channel Machine Speed.
    n6 "Peak" (sig.peak).
    n7 "Stays in step" (chk.verdict) with op le, limit 1.05, goOn yes.
    n8 "Add row to results table" (out.table.add) with table CCT.
layers: Run every network arrangement. Blocks: n1 "Start" (start).
    n2 "Arrangement" (px.layer.foreach).
    n3 "Run simulation" (px.run) with duration 2.
    n4 "Read a channel" (px.series) with channel Vbus.
    n5 "Peak" (sig.peak) with kind abs.
    n6 "Add row to results table" (out.table.add) with table Arrangements.
snapshot: Initialise once, then branch. Blocks: n1 "Start" (start).
    n2 "Save a snapshot" (px.snap.save) with at 2.
    n3 "Initialise" (px.run) with duration 2.2.
    n4 "Start from a snapshot" (px.snap.use).
    n5 "Fault duration (s)" (flow.range) with from 0.08, to 0.2, step 0.04.
    n6 "Fault" (px.fault) with at 2.1.
    n7 "Run simulation" (px.run) with duration 2.
    n8 "Read a channel" (px.series) with channel Vbus.
    n9 "Peak" (sig.peak) with kind min.
    n10 "Add row to results table" (out.table.add) with table Snapshot.
substitutions: A run for each parameter set. Blocks: n1 "Start" (start).
    n2 "Parameter set" (px.gs.foreach).
    n3 "Run simulation" (px.run) with duration 2.
    n4 "Read a channel" (px.series) with channel Vbus.
    n5 "Final value" (sig.final).
    n6 "Add row to results table" (out.table.add) with table Sets.
parallel: Run several cases at once. Blocks: n1 "Start" (start).
    n2 "Make a simulation set" (px.simset.create) with name PXB_batch, volley 4.
    n3 "Override a set’s settings" (px.simset.override) with duration 5.
    n4 "Run a simulation set" (px.simset.run).
    n5 "Add row to results table" (out.table.add) with table Batch.
damping: Damping of a ringdown. Blocks: n1 "Start" (start).
    n2 "Disturbance" (px.fault) with duration 0.05.
    n3 "Run simulation" (px.run) with duration 10, plotStep 500.
    n4 "Read a channel" (px.series) with channel Machine Speed.
    n5 "Damping of a ringdown" (sig.damping) with t_start 1.2.
    n6 "Well damped" (chk.verdict) with limit 0.03.
    n7 "Add row to results table" (out.table.add) with table Damping.

REFERENCE: BLOCK TYPES

[Start]
start: Start. Where the workflow begins: the PSCAD case to open and where the results go. Every workflow has exactly one Start.
  Wires: flow out: next
  Settings: project text; workspace text; libraries text, one value per line; outputDir text; undoChanges yes or no default yes; tableFmt one of csv | xlsx | both default csv; fNominal one of auto | 50 | 60 default auto; runMode one of auto | launch | connect | inside default auto; showPscad yes or no default no; fortran text; pscadVersion text; port number (at least 0) default 0; connectTimeout number (at least 10) in s default 120

[PSCAD: model and data]
px.component: Component. Finds a component in the case by its definition and Name, or every match. Looks on every page, module pages included.
  Wires (with default settings; more follow the settings): data out: el:obj
  Settings: el component with cls (its definition, such as master:resistor), name (a * matches anything) and match (one, first or all), default cls master:source_3; enabled yes or no default no; page text
px.foreach_component: For each component. Repeats the Each pass steps for every component of a definition (sorted by name), or for each component of a list wired in.
  Wires: flow in: in; flow out: body, done; data in: items:obj; data out: item:obj, elname:text, index:num, count:num
  Settings: name text; el component with cls (its definition, such as master:resistor), name (a * matches anything) and match (one, first or all), default cls master:breaker3; enabled yes or no default no; param parameter name such as R; op one of = | != | > | >= | < | <= default =; value text; restore one of pass | end | never default pass; onError one of skip | stop default skip
px.set: Set parameter. Writes one parameter of a component (or of each component of a list), such as a resistance, a set point or a fault duration.
  Wires (with default settings; more follow the settings): flow in: in; flow out: next; data in: obj:obj, value:num
  Settings: el component with cls (its definition, such as master:resistor), name (a * matches anything) and match (one, first or all), default cls master:resistor; param parameter name such as R; vtype one of num | text default num; value number default 0; text text; unit one of none | MW | kW | Mvar | kvar | MVA | kVA | kV | V | kA | A | ohm | kohm | mohm | H | mH | uH | uF | nF | s | ms | us | Hz default none
px.get: Read parameter. Reads one parameter of a component, or of every component of a list (its highest, lowest or all values).
  Wires (with default settings; more follow the settings): flow in: in; flow out: next; data in: obj:obj; data out: value:num
  Settings: el component with cls (its definition, such as master:resistor), name (a * matches anything) and match (one, first or all), default cls master:resistor; param parameter name such as R; pick one of all | max | min default all; unit one of none | MW | kW | Mvar | kvar | MVA | kVA | kV | V | kA | A | ohm | kohm | mohm | H | mH | uH | uF | nF | s | ms | us | Hz default none
px.enable: Enable or disable component. Takes a component out of the build, or puts it back.
  Wires: flow in: in; flow out: next; data in: obj:obj; data out: n:num
  Settings: el component with cls (its definition, such as master:resistor), name (a * matches anything) and match (one, first or all), default cls master:breaker3; on one of off | on default off
px.undo: Put changed values back. Puts back every parameter, layer state and substitution the workflow has changed so far, now rather than at the end.
  Wires: flow in: in; flow out: next; data out: n:num
px.layer.set: Set layer state. Puts one layer of the case into a state. A layer switches a whole group of components together, which is how one case holds alternative network arrangements.
  Wires: flow in: in; flow out: next; data in: name:text; data out: state:text
  Settings: layer text; state one of Enabled | Disabled | Invisible default Enabled
px.layer.create: Create layer. Makes a layer in the case and gives it back, so later steps can put components on it and switch it.
  Wires: flow in: in; flow out: next; data in: name:text; data out: name:text
  Settings: layer text default PXB_layer; state one of Enabled | Disabled | Invisible default Enabled; keep yes or no default no; ifExists one of reuse | new default reuse
px.layer.add: Put components on a layer. Adds a component (or every component of a list) to a layer, so one switch takes them all out of the build together.
  Wires: flow in: in; flow out: next; data in: obj:obj, name:text; data out: n:num
  Settings: el component with cls (its definition, such as master:resistor), name (a * matches anything) and match (one, first or all), default cls master:breaker3; layer text
px.layer.foreach: For each layer. Repeats the Each pass steps with each layer enabled in turn and the others disabled, so one case runs each of its arrangements.
  Wires: flow in: in; flow out: body, done; data in: items:text; data out: item:text, index:num, count:num
  Settings: name text; layers text, one value per line default *; state one of Enabled | Disabled | Invisible default Enabled; others one of Disabled | Invisible | none default Disabled; restore one of pass | end | never default pass; onError one of skip | stop default skip
px.scen.activate: Activate scenario. Switches the case to one of its scenarios, which brings back every component value that scenario holds.
  Wires: flow in: in; flow out: next; data in: name:text; data out: name:text
  Settings: scenario text
px.scen.save: Save scenario. Saves the values in use now into the current scenario, so they are there the next time it is activated.
  Wires: flow in: in; flow out: next; data in: name:text; data out: ok:bool
  Settings: scenario text
px.scen.foreach: For each scenario. Repeats the Each pass steps with each scenario of the case active in turn.
  Wires: flow in: in; flow out: body, done; data in: items:text; data out: item:text, index:num, count:num
  Settings: name text; match text default *; restore one of pass | end | never default pass; onError one of skip | stop default skip
px.gs.set: Set global substitution. Sets one named value of the case. Every component whose parameter writes $(name) reads it, so one write changes the whole model at once.
  Wires (with default settings; more follow the settings): flow in: in; flow out: next; data in: value:num, name:text; data out: value:num
  Settings: sub text; vtype one of num | text default num; value number default 0; text text; create yes or no default yes; set text
px.gs.get: Read global substitution. Reads one named value of the case, as a number where it is one.
  Wires: flow in: in; flow out: next; data in: name:text; data out: value:num
  Settings: sub text; set text
px.gs.setactive: Activate substitution set. Switches the case to one of its sets of global substitutions, so every $(name) in the model takes that set’s value.
  Wires: flow in: in; flow out: next; data in: name:text; data out: name:text
  Settings: set text
px.gs.foreach: For each substitution set. Repeats the Each pass steps with each set of global substitutions active in turn: one case, one run per parameter set.
  Wires: flow in: in; flow out: body, done; data in: items:text; data out: item:text, index:num, count:num
  Settings: name text; restore one of pass | end | never default pass; onError one of skip | stop default skip
px.control: Set a control. Sets a slider, switch, dial or button on the case’s control panel.
  Wires (with default settings; more follow the settings): flow in: in; flow out: next; data in: obj:obj, value:num; data out: value:num
  Settings: el component with cls (its definition, such as master:resistor), name (a * matches anything) and match (one, first or all), default cls Slider; kind one of auto | slider | switch | dial | button default auto; value number default 0; on one of on | off default on; pos number (at least 1) default 1
px.control.limits: Set slider limits. Widens or narrows a slider’s range, so a sweep can reach a value outside the range the model was drawn with.
  Wires: flow in: in; flow out: next; data in: obj:obj, lo:num, hi:num
  Settings: el component with cls (its definition, such as master:resistor), name (a * matches anything) and match (one, first or all), default cls Slider; lo number default 0; hi number default 1
px.project.use: Use another case. Makes another case in the workspace the one the workflow works on, so later steps find its components and run it.
  Wires: flow in: in; flow out: next; data in: name:text; data out: name:text
  Settings: project text
px.project.save: Save the case. Writes what the workflow changed into the case’s own file. Without this every change is put back when the workflow ends.
  Wires: flow in: in; flow out: next; data out: ok:bool
px.project.saveas: Save the case as. Writes the case to a new .pscx file, so a workflow keeps the model it built or changed without touching the reader’s own file.
  Wires: flow in: in; flow out: next; data in: path:text; data out: name:text
  Settings: path text
px.project.new: New empty case. Makes an empty case in the workspace and works on it, for a model the workflow builds from nothing.
  Wires: flow in: in; flow out: next; data in: path:text; data out: name:text
  Settings: path text; keep yes or no default yes
px.add.component: Add component. Draws a component on a page of the case and gives it back, for a model the workflow builds or extends.
  Wires: flow in: in; flow out: next; data in: x:num, y:num; data out: el:obj
  Settings: defn text default master:resistor; x number (at least 0) in grid default 10; y number (at least 0) in grid default 10; name text; orient one of 0 | 1 | 2 | 3 default 0; page text default Main; keep yes or no default no
px.add.wire: Add wire. Draws a wire through a list of grid points, to connect components the workflow has placed.
  Wires: flow in: in; flow out: next; data out: el:obj
  Settings: points text, one value per line default 10, 10 16, 10; page text default Main; keep yes or no default no
px.add.bus: Add bus. Draws a bus through a list of grid points and names it, for a model the workflow builds.
  Wires: flow in: in; flow out: next; data out: el:obj
  Settings: points text, one value per line default 10, 20 24, 20; name text; page text default Main; keep yes or no default no
px.add.channel: Add output channel. Draws an output channel on a page, so a run records that signal. A signal with no output channel cannot be read back at all.
  Wires: flow in: in; flow out: next; data in: x:num, y:num; data out: el:obj
  Settings: name text; x number (at least 0) in grid default 10; y number (at least 0) in grid default 10; units text; group text; page text default Main; keep yes or no default no
px.add.graph: Add graph. Draws a graph frame on a page, with a curve of an output channel when one is wired in.
  Wires: flow in: in; flow out: next; data in: obj:obj, x:num, y:num; data out: el:obj
  Settings: el component with cls (its definition, such as master:resistor), name (a * matches anything) and match (one, first or all), default cls master:pgb; x number (at least 0) in grid default 10; y number (at least 0) in grid default 10; title text; page text default Main; keep yes or no default no
px.delete: Delete component. Takes a component (or every component of a list) off its page. Use it to strip a case down, or to undo what the workflow drew.
  Wires: flow in: in; flow out: next; data in: obj:obj; data out: n:num
  Settings: el component with cls (its definition, such as master:resistor), name (a * matches anything) and match (one, first or all), default cls master:resistor
px.copy: Copy component. Copies one component to another spot on its page and gives the copy back, for a model that repeats a piece.
  Wires: flow in: in; flow out: next; data in: obj:obj, x:num, y:num; data out: el:obj
  Settings: el component with cls (its definition, such as master:resistor), name (a * matches anything) and match (one, first or all), default cls master:resistor; x number (at least 0) in grid default 10; y number (at least 0) in grid default 10
px.mrun.sweep: Set up a Multiple Run sweep. Drives PSCAD’s own Multiple Run component: one variable over a list or a range, inside one build. The case has to have a Multiple Run component wired to what it changes.
  Wires (with default settings; more follow the settings): flow in: in; flow out: next; data in: values:list; data out: values:list
  Settings: variable number (1 to 6) default 1; mode one of list | range default list; values text, one value per line; first number default 0; last number default 1; steps number (at least 1) default 10; el component with cls (its definition, such as master:resistor), name (a * matches anything) and match (one, first or all), default cls master:mrun
px.mrun.count: Set how many runs. How many times the case runs in one go, PSCAD’s Multiple Run count. One puts it back to a single run.
  Wires: flow in: in; flow out: next; data in: runs:num; data out: runs:num
  Settings: runs number (at least 1) default 1

[PSCAD: build and run]
px.build: Build the case. Compiles the case with its Fortran compiler and goes on along Built or Did not build.
  Wires: flow in: in; flow out: ok, fail; data out: built:bool, errors:list, warnings:list, seconds:num
  Settings: clean yes or no default no; force yes or no default no
px.run: Run simulation. Builds the case if it needs it, runs the EMT simulation, and reads its output channels back. Goes on along Reached the end, Stopped early or Did not build.
  Wires: flow in: in; flow out: ok, early, nobuild; data out: result:res, reached:bool, tend:num, took:num, channels:list, message:text
  Settings: duration number (at least 0) in s default 1; step number (at least 0.01) in us default 50; plotStep number (at least 0.01) in us default 250; build one of auto | always | never default auto; read one of out | curves | none default out; keepFiles yes or no default no
px.series: Read a channel. Takes one output channel of a run as a curve over time, for the checks and the graphs. A channel the run did not record gives an empty curve and a note, never an error.
  Wires (with default settings; more follow the settings): data in: run:res; data out: series:series
  Settings: channel text; combine one of one | mean | sum | min | max | spread default one; label text
px.fault: Set a fault. Writes when a fault component in the model starts and how long it lasts.
  Wires: flow in: in; flow out: next; data in: obj:obj, at:num, duration:num; data out: at:num, clear:num
  Settings: el component with cls (its definition, such as master:resistor), name (a * matches anything) and match (one, first or all), default cls master:tfaultn; at number (at least 0) in s default 1; duration number (at least 0) in s default 0.12; phases text; resistance number (at least 0) in ohm; on yes or no default yes
px.switching: Set a switching time. Writes when a breaker or switch in the model operates. As with a fault, the timing lives in the component, so this sets it for the next run.
  Wires: flow in: in; flow out: next; data in: obj:obj, at:num; data out: at:num
  Settings: el component with cls (its definition, such as master:resistor), name (a * matches anything) and match (one, first or all), default cls master:tbreakn; at number (at least 0) in s default 1; action one of open | close default open
px.snap.save: Save a snapshot. Has the next run save the whole state of the case at one instant. Every later run can start from it, so a long start-up is simulated once and the cases branch from there.
  Wires: flow in: in; flow out: next; data in: at:num; data out: file:text
  Settings: at number (at least 0) in s default 1; file text
px.snap.use: Start from a snapshot. Has the runs after it start from a snapshot file instead of from zero, which skips the start-up every time.
  Wires: flow in: in; flow out: next; data in: file:text; data out: path:text
  Settings: file text
px.snap.off: Start from zero again. Puts the case back to starting its runs from zero, after a Start from a snapshot.
  Wires: flow in: in; flow out: next
px.simset.create: Make a simulation set. Gathers cases into a simulation set and says how many run at the same time.
  Wires: flow in: in; flow out: next; data in: cases:text; data out: set:obj
  Settings: name text default PXB_set; cases text, one value per line; volley number (at least 1) default 1; keep yes or no default no
px.simset.override: Override a set’s settings. Changes the simulation settings of a simulation set’s tasks, so one set runs the same case at several durations or time steps without touching the case.
  Wires: flow in: in; flow out: next; data in: set:obj
  Settings: task text; duration number (at least 0) in s; step number (at least 0.01) in us; plotStep number (at least 0.01) in us
px.simset.run: Run a simulation set. Builds and runs every case of a simulation set, as many at a time as its volley says.
  Wires: flow in: in; flow out: ok, fail; data in: set:obj; data out: finished:bool, errors:list, took:num

[Power system checks]
sig.despike: Remove spikes. Takes measurement spikes out of a frequency trace (samples far from the running median are removed), such as the jumps an EMT bus frequency shows at a fault.
  Wires: data in: series:series; data out: series:series, n:num, note:text
  Settings: window number (at least 0) in s default 0.2; trigger number (at least 0) in Hz default 0.1; maxStep number (at least 0) in Hz/s default 20; settle number (at least 0) in Hz default 0.02; signal one of auto | frequency | other default auto; nominal number in Hz
sig.nadir: Frequency nadir. The lowest frequency after an event, and whether it turned around (settles) or collapsed, with the UFLS flag. Use it after a trip in an RMS run.
  Wires: data in: series:series, t_event:num, nominal:num, extendTo:num; data out: nadir:num, time:num, turned:bool, verdict:text, ufls:text, minimum:num, min_time:num, still:bool, recovery:num
  Settings: t_event number in s; floorBelow number (at least 0) in Hz default 5; uflsBelow number (at least 0) in Hz default 1; window number (at least 0) in s default 10; minRecovery number (at least 0) in Hz default 0.05; tailGuard number (at least 0) in s default 1; delay number (at least 0) in s default 0; requiresUfls yes or no default yes; nominal number in Hz; extendTo number in s
sig.peak: Peak. The highest (or lowest, or furthest from zero) value of a curve and when it happens, over the whole run or a time range.
  Wires: data in: series:series, after:num, before:num; data out: value:num, time:num
  Settings: kind one of max | min | abs default max; after number in s; before number in s
sig.settle: Settling time. How long a curve takes to settle inside a band around its final value after an event, with rise time and overshoot. A curve still moving at the end does not settle.
  Wires (with default settings; more follow the settings): data in: series:series, t_event:num, band:num; data out: settles:bool, time:num, at:num, initial:num, final:num, rise:num, overshoot:num
  Settings: t_event number in s; bandMode one of pct | abs default pct; band number (at least 0) default 10; hold number (at least 0) in s default 1; reference one of final | given default final; target number; guard number (at least 0) in s default 1
sig.rocof: RoCoF. Rate of change of frequency (Hz/s): the steepest change over a rolling window from the event to the nadir. Wire Nadir time and Verdict from Frequency nadir.
  Wires: data in: series:series, t_event:num, nadir_t:num, verdict:text, nominal:num; data out: rocof:num, time:num, t2:num, basis:text
  Settings: t_event number in s; window number (at least 0) in s default 0.5; fallback one of window | tstop | none default window; searchWindow number (at least 0) in s default 10; absolute yes or no default no; decimals number (0 to 12) default 4; nominal number in Hz
sig.at: Value at time. The value of a curve at a given time, read between samples. At an event instant it is the value just before the event, e.g. the power before a fault.
  Wires: data in: series:series, t:num; data out: value:num
  Settings: t number in s default 0
sig.final: Final value. The value of a curve at the end of the run, or its average over the last seconds, e.g. the voltage after recovery.
  Wires: data in: series:series; data out: value:num
  Settings: last number (at least 0) in s default 0
sig.cross: First time above / below. When a curve first goes above (or below) a level and stays there, e.g. the voltage back to 0.9 p.u., or the power back to 90 % of its value before the fault.
  Wires (with default settings; more follow the settings): data in: series:series, level:num, after:num; data out: time:num, delay:num, found:bool, threshold:num
  Settings: direction one of above | below default above; levelMode one of value | pct default value; level number default 0.9; pct number (at least 0) in % default 90; refT number in s; after number in s; hold number (at least 0) in s default 0
chk.limit: Check limits. Checks a value, a list or a whole curve against a lowest and highest limit, or against a curve such as an FRT envelope, and goes on along Pass or Fail.
  Wires (with default settings; more follow the settings): flow in: in; flow out: pass, fail; data in: x:list, lo:num, hi:num; data out: ok:bool, text:text, margin:num, at:num, worst:num
  Settings: against one of value | curve default value; lo number; hi number; curve rows with id and x, low, high; x0 number in s default 0; extend yes or no default no; after number in s; before number in s; goOn yes or no default no
chk.verdict: Pass / fail. Checks one value against a limit (for example nadir ≥ 49.2 Hz, or UFLS is false) and goes on along Pass or Fail. An empty value takes Fail and says NO DATA.
  Wires (with default settings; more follow the settings): flow in: in; flow out: pass, fail; data in: value:any, limit:num; data out: ok:bool, text:text, margin:num
  Settings: op one of ge | gt | le | lt | eq | ne | true | false default ge; limit number default 0; tol number default 0; goOn yes or no default no
sig.rms: RMS of a waveform. Turns an instantaneous waveform into its RMS value over a sliding window, as a curve. An EMT run records the wave itself, and an assessment is written against the RMS.
  Wires: data in: series:series, frequency:num; data out: series:series
  Settings: frequency number (at least 0.1) in Hz; cycles number (at least 0.25) in cycles default 1; label text
sig.thd: Harmonic distortion (THD). The total harmonic distortion of a waveform at one instant, as a percentage of the fundamental, with the worst harmonic named.
  Wires: data in: series:series, frequency:num, at:num; data out: value:num, worst:num, order:num, fundamental:num, pct:list, orders:list
  Settings: frequency number (at least 0.1) in Hz; at number in s; cycles number (at least 0.25) in cycles default 1; harmonics number (2 to 200) default 50; includeDc yes or no default no
sig.sequence: Sequence component. The positive, negative or zero sequence of three instantaneous phases, as a curve, with the unbalance factor.
  Wires: data in: a:series, b:series, c:series, frequency:num; data out: series:series
  Settings: which one of negative | positive | zero default negative; frequency number (at least 0.1) in Hz; cycles number (at least 0.25) in cycles default 1; label text
sig.unbalance: Unbalance factor. The negative sequence as a percentage of the positive, at one instant: the number an unbalance limit is written against.
  Wires: data in: a:series, b:series, c:series, frequency:num, at:num; data out: value:num, negative:num, positive:num
  Settings: frequency number (at least 0.1) in Hz; at number in s; cycles number (at least 0.25) in cycles default 1
sig.overshoot: Overshoot and rise time. How far past its final value a step response goes, as a percentage of the step, and how long it takes to go from 10 % to 90 % of it.
  Wires: data in: series:series, t_event:num, target:num; data out: value:num, rise:num, peak:num, time:num, final:num, step:num
  Settings: t_event number in s; reference one of final | given default final; target number; hold number (at least 0.001) in s default 1
sig.damping: Damping of a ringdown. The damping ratio and frequency of an oscillation, from the peaks of its envelope.
  Wires: data in: series:series, t_start:num, t_end:num; data out: value:num, frequency:num, stable:bool, peaks:num
  Settings: t_start number in s; t_end number in s; minPeaks number (2 to 50) default 3

[Results and graphs]
out.table.add: Add row to results table. Adds one row to a results table: the loop values, then one column per value wired in. Drop a wire on "+ drop a value" to add a column. Saved at the end automatically.
  Wires (with default settings; more follow the settings): flow in: in; flow out: next; data in: add:cell
  Settings: table text default Results; cols rows with id and name; ctx yes or no default yes; onSkip yes or no default yes
out.table.save: Save results table. Writes a results table to the run folder as CSV (opens in Excel), an Excel file or both. Connect it to After all passes so it saves once.
  Wires (with default settings; more follow the settings): flow in: in; flow out: next; data out: file:text
  Settings: table text default Results; fmt one of csv | xlsx | both default csv; stem text
out.table.column: Table column. The values of one column of a results table, or its value in the row where another column is highest or lowest: the worst case, the worst line.
  Wires (with default settings; more follow the settings): data out: value:list
  Settings: table text default Results; col text; pick one of all | max | min default all; of text; as one of num | text default num
data.read: Read table from file. Attach a CSV or Excel file: its columns become a named table the rest of the workflow reads, one case per row. Use it for a case workbook or a dispatch table.
  Wires: flow in: in; flow out: next; data out: name:text, n:num
  Settings: table text default Cases; path text; sheet text; layout one of rows | columns default rows; header number (at least 1) default 1; decimalComma yes or no default no
out.plot.series: Draw time series graph. Draws curves over time to a PNG: one graph per pass, or every pass on one graph drawn after the loop. Marks a nadir, limit lines and the run's events.
  Wires (with default settings; more follow the settings): flow in: in; flow out: next; data in: l1:series, add:series, mark:num, mark_t:num, limit:num, t_event:num, note:text; data out: file:text
  Settings: lines rows with id and name; collect one of pass | loop default pass; title text; ylabel text; unit text; limits rows with id and value, label; events yes or no default yes; stem text
out.plot.xy: Draw 2D graph. Draws one or more lists against a list of x values (lines, points or bars) to a PNG, e.g. the nadir of every case against its dispatch.
  Wires (with default settings; more follow the settings): flow in: in; flow out: next; data in: x:items, l1:list, add:list; data out: file:text
  Settings: lines rows with id and name; kind one of line | scatter | bar default line; title text; xlabel text; xunit text; ylabel text; yunit text; limits rows with id and value, label; stem text
out.plot.3d: Draw 3D graph. Draws a value over two swept inputs as a 3D surface (or points) to a PNG, e.g. nadir over generator A and generator B dispatch from a 2-D sweep.
  Wires: flow in: in; flow out: next; data in: x:list, y:list, z:list; data out: file:text
  Settings: kind one of surface | wireframe | scatter default surface; title text; xlabel text; xunit text; ylabel text; yunit text; zlabel text; zunit text; stem text
out.plot.heatmap: Draw heat map. Draws a value over two inputs as coloured cells to a PNG, with the values written in, e.g. line loading per contingency and line.
  Wires: flow in: in; flow out: next; data in: x:items, y:items, z:list; data out: file:text
  Settings: title text; xlabel text; xunit text; ylabel text; yunit text; zlabel text; zunit text; annotate one of auto | yes | no default auto; stem text
out.plot.table: Draw graph from results table. Draws columns of a results table against another column to a PNG, e.g. Peak (kV) against Fault duration (s), one line per layer. Connect it after the loop.
  Wires: flow in: in; flow out: next; data out: file:text
  Settings: table text default Results; x text; ys text, one value per line; kind one of line | scatter | bar default line; group text; title text; ylabel text; yunit text; limits rows with id and value, label; stem text
out.plot.conv: Draw convergence curve. Draws how Optimise or Find limit went to a PNG: the score of every try and the best so far, or each value tried with the bracket narrowing in.
  Wires: flow in: in; flow out: next; data in: history:hist; data out: file:text
  Settings: title text; ylabel text; unit text; kind one of auto | optimise | limit default auto; stem text
out.series.save: Save time series to CSV. Writes curves to a CSV file in the run folder (one time column, one column per curve) to open in Excel or another tool. Inside a loop: one file per pass.
  Wires (with default settings; more follow the settings): flow in: in; flow out: next; data in: l1:series, add:series; data out: file:text
  Settings: lines rows with id and name; stem text

[Flow: loops and decisions]
flow.if: If. Checks a value and goes on along Yes or No. An empty value takes No (and says so in the log).
  Wires (with default settings; more follow the settings): flow in: in; flow out: yes, no; data in: a:any, b:num
  Settings: op one of true | gt | ge | lt | le | eq | ne default true; b number default 0; tol number default 0
flow.range: For a range of numbers. Repeats the Each pass steps for every number from First to Last in steps (both ends included), e.g. 100, 150 ... 300 MW.
  Wires: flow in: in; flow out: body, done; data in: from:num, to:num, step:num; data out: value:num, index:num, count:num
  Settings: name text; from number default 1; to number default 10; step number default 1; restore one of pass | end | never default pass; onError one of skip | stop default skip
flow.list: For each item. Repeats the Each pass steps for every item of a list: values typed here, a list wired in, or the rows of a results table.
  Wires (with default settings; more follow the settings): flow in: in; flow out: body, done; data out: item:num, index:num, count:num
  Settings: name text; source one of values | list | table default values; values text, one value per line default 1, 2, 3; itemType one of num | text | obj default num; table text default Results; cols rows with id and name, type; runCol text; restore one of pass | end | never default pass; onError one of skip | stop default skip
flow.repeat: Repeat N times. Repeats the Each pass steps a set number of times.
  Wires: flow in: in; flow out: body, done; data in: times:num; data out: index:num
  Settings: name text; times number (at least 0) default 3; restore one of pass | end | never default pass; onError one of skip | stop default skip
flow.until: Repeat until. Repeats the Each pass steps until the condition is true at the end of a pass, at most Max passes times.
  Wires: flow in: in; flow out: body, done; data in: cond:bool; data out: index:num, met:bool
  Settings: name text; max number (at least 1) default 20; restore one of pass | end | never default pass; onError one of skip | stop default skip
flow.next: Skip to next pass. Ends this pass of the loop now and goes on with the next pass. The reason goes into the log and the results table.
  Wires: flow in: in
  Settings: msg text
flow.break: Stop the loop. Ends the loop now: no more passes. The steps wired to After all passes run next.
  Wires: flow in: in
  Settings: msg text
flow.stop: Stop the workflow. Stops the whole workflow cleanly: changed values are put back and the tables are saved.
  Wires: flow in: in
  Settings: msg text default Stopped by the workflow
flow.log: Print a message. Writes a line to the log (screen and run.log). Put {name} in the text and wire a value into the input of that name.
  Wires (with default settings; more follow the settings): flow in: in; flow out: next; data in: value:cell
  Settings: text text default Value: {value}; level one of info | warn | error default info
var.set: Remember a value. Keeps a value under a name for later steps, also across loop passes: set it, add to a list, keep the lowest or highest, add up or count.
  Wires (with default settings; more follow the settings): flow in: in; flow out: next; data in: value:any
  Settings: name text default Result; mode one of set | append | min | max | sum | count default set
var.get: Recall a value. Gives back the value Remember a value kept under this name, as it is at the step that uses it.
  Wires (with default settings; more follow the settings): data out: value:num, where:text
  Settings: name text default Result; as one of num | text | list | items | bool | any default num; dflt text

[Values and maths]
val.number: Number. A number you type, such as a limit or a step size. Pin it to put it at the top of the script.
  Wires (with default settings; more follow the settings): data out: value:num
  Settings: value number default 0; unit text
val.text: Text. A text you type, such as a name or a file stem.
  Wires: data out: value:text
  Settings: value text
val.bool: Yes / No. A yes or no you choose, for example to switch part of a workflow on or off with an If.
  Wires: data out: value:bool
  Settings: value yes or no default yes
val.list: List of values. A list you type: numbers or names, one per line or separated by commas.
  Wires (with default settings; more follow the settings): data out: value:list
  Settings: values text, one value per line default 1, 2, 3
val.range: Range of numbers. A list of numbers from First to Last in steps, both ends included, e.g. 0, 0.5 ... 3.
  Wires: data in: from:num, to:num, step:num; data out: value:list
  Settings: from number default 0; to number default 10; step number default 1
math.arith: Arithmetic. Adds, subtracts, multiplies or divides two numbers (or takes the smaller, larger, power or remainder). Empty in gives empty out.
  Wires (with default settings; more follow the settings): data in: a:num, b:num; data out: value:num
  Settings: op one of add | sub | mul | div | pow | min | max | mod default add; a number default 0; b number default 0; each yes or no default no
math.formula: Formula. Works out a formula such as sqrt(p**2 + q**2). Each name in it becomes an input. Knows abs, min, max, round, sqrt, log, log10, exp, pi.
  Wires (with default settings; more follow the settings): data in: a:num, b:num; data out: value:num
  Settings: expr text default a * b; each yes or no default no
math.func: Function. Applies one function to a number: absolute value, round, square root, negate, round down or up, log10, exp.
  Wires (with default settings; more follow the settings): data in: x:num; data out: value:num
  Settings: fn one of abs | round | sqrt | neg | floor | ceil | log10 | exp default abs; x number default 0; digits number (at least 0) default 2; each yes or no default no
math.compare: Compare. Compares two numbers and gives Yes or No (empty when a number is missing).
  Wires: data in: a:num, b:num; data out: value:bool
  Settings: op one of gt | ge | lt | le | eq | ne default gt; a number default 0; b number default 0; tol number default 0
math.logic: And / or / not. Combines yes / no values: both, either, or the opposite. An unknown value stays unknown unless the answer is clear without it.
  Wires (with default settings; more follow the settings): data in: a:bool, b:bool; data out: value:bool
  Settings: op one of and | or | not default and
math.max: Maximum. The largest of the values. Takes a list, a time series (its values) or one number; empty values are left out.
  Wires: data in: values:list; data out: value:num
math.min: Minimum. The smallest of the values. Takes a list, a time series (its values) or one number; empty values are left out.
  Wires: data in: values:list; data out: value:num
math.mean: Average. The average (mean) of the values. Takes a list, a time series (its values) or one number; empty values are left out.
  Wires: data in: values:list; data out: value:num
math.median: Median. The middle value: half of the values are below it. Takes a list, a time series (its values) or one number; empty values are left out.
  Wires: data in: values:list; data out: value:num
math.sum: Sum. All the values added up. Takes a list, a time series (its values) or one number; empty values are left out.
  Wires: data in: values:list; data out: value:num
math.count: Count. How many values there are. Takes a list, a time series (its values) or one number; empty values are left out.
  Wires: data in: values:list; data out: value:num
math.std: Standard deviation. How far the values spread around their average (standard deviation). Takes a list, a time series (its values) or one number; empty values are left out.
  Wires: data in: values:list; data out: value:num
math.percentile: Percentile. The value below which the given percentage of the values lie, e.g. the 95th percentile. Takes a list, a time series (its values) or one number; empty values are left out.
  Wires: data in: values:list, p:num; data out: value:num
  Settings: p number (0 to 100) in % default 95
text.format: Text from a template. Builds a text from a template such as "Dispatch {p} MW". Each {name} becomes an input; {p:.1f} shows 1 decimal.
  Wires (with default settings; more follow the settings): data in: p:cell; data out: value:text
  Settings: template text default Dispatch {p} MW

[Optimise and search]
opt.optimise: Optimise. Tries values of one or more variables to make a score as small (or large) as possible, e.g. the dispatch with the best nadir. Report this try gives each score.
  Wires (with default settings; more follow the settings): flow in: in; flow out: body, done; data in: score:num; data out: v1:num, best_v1:num, score:num, found:bool, history:hist
  Settings: vars rows with id and name, lower, upper, integer; goal one of min | max default min; method one of de | nelder | powell | bounded | grid | bayes default de; maxTries number (at least 1) default 30; gridSteps number (at least 2) default 5; seed number default 1
opt.limit: Find limit. Finds where a study goes from pass to fail by halving the gap between a passing and a failing value, e.g. the largest dispatch that keeps the nadir above a limit.
  Wires: flow in: in; flow out: body, done; data in: lower:num, upper:num, tol:num, maxSteps:num, pass:any; data out: value:num, limit:num, found:bool, status:text, passing:num, failing:num, history:hist
  Settings: name text; lower number default 0; upper number default 100; tol number (at least 0) default 1; maxSteps number (at least 2) default 20; passes one of low | high default low; bracket one of given | halve default given; onUnknown one of stop | fail | pass default stop; integer yes or no default no; passIs one of yes | no default yes
opt.report: Report this try. Tells Optimise or Find limit how this try went: a score, a pass (yes, no, or unknown such as UFLS UNDEFINED), or both. Only works on the Each try route.
  Wires (with default settings; more follow the settings): flow in: in; flow out: next; data in: score:num, pass:any
  Settings: answer one of wired | pass | fail | none default wired; passIs one of yes | no default yes

[Advanced]
adv.python: Python code. Runs your own Python with named inputs and outputs. The code becomes a function of its inputs; set the outputs as variables.
  Wires (with default settings; more follow the settings): flow in: in; flow out: next; data in: i1:any; data out: o1:num
  Settings: inputs rows with id and name; outputs rows with id and name, type; code python (not taken from a link); touches one of none | reads | model | calc default none
note: Note. A note on the canvas for you and your colleagues. It also goes into the script as a comment.
  Wires: none
  Settings: text text, one value per line

Generated by _ref/agent-doc.mjs from the page and its agent-notes.md.
