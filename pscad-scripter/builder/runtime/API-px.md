# PSCAD runtime API (px_core.py, px_model.py, px_studies.py)

The PSCAD half of the Builder runtime: everything that talks to PSCAD through its Automation
Library (`mhi.pscad`). Blocks ask for a **section** by name (`cx.helper('px_run')`); the generator
copies that section and everything in its `@needs` (transitively, file order) into the generated
file. The pure half (`base.py`, `signals.py`, `outputs.py`, `optimise.py`) is shared with the
PowerFactory Builder unchanged and is not listed here.

The table below is one row per `@helper` section, in file order, with the public names the
section defines and the first sentence of each one's docstring. The engine-facing behaviour was
run on PSCAD 5.0.0 with GFortran 4.6 (`_audit/runtime/live/live_tests.py`); every section loads
on its own with only its `@needs` (`_audit/runtime/live/loader.py`).

## Conventions

- **`app` first** for helpers that search the project, switch layers, scenarios or substitution
  sets, or run. Helpers that act on one component take the component and find the project in
  `_PX["project"]` (set by `px_connect`): `px_set`, `px_get`, `px_mark`, `px_undo`,
  `set_enabled`.
- **Units.** Times in seconds; the EMTDC time step and the plot step in microseconds, as PSCAD
  shows them. A parameter that carries a unit is written in the unit it already carries
  (`px_with_unit`), converting from the `unit=` given (`unit_factor`), because PSCAD keeps a
  written unit as it is given rather than normalising it. A unit-carrying value is read as text
  first (`px_split_value`), since the number PSCAD hands back loses its unit otherwise.
- **Components** are Automation Library objects; anywhere one is expected, a list also works
  (`px_find(..., match="all")`). A definition is written namespace first (`master:tpflt`); `*` and
  `?` are allowed in a definition or a Name, and anything but an exact definition is searched by
  walking the project's pages (module pages included), because `Project.find_all()` takes an
  exact definition only.
- **Errors.** `PXError` with a plain message, tagged `[MODEL]` (the case or a name does not fit:
  a missing component, a parameter it does not have, a refused write) or `[CODE]` (a wrong call).
  A failed build or a run that stops early is **not** an error: `px_build` and `px_run` give back
  `ok` and `status` with PSCAD's own messages. Connect problems end the script with
  `SystemExit` and a message that says what to do.
- **What the workflow makes** (layers, simulation sets, components and pages built by script) is
  named with the `PXB_` prefix where the reader gave no name, and recorded by `track_created`;
  `finish()` deletes all of it except what was created with `keep=True`.
- **Every change is recorded.** `px_set`, `layer_set`, `gs_set`, `set_enabled` and
  `sim_settings` record the value they replace; `px_undo(mark)` puts back what was written after
  a mark, and `finish()` puts back everything when `UNDO_CHANGES` is true.
- **SETTINGS read** (with defaults, `globals().get`): `PROJECT` (""), `WORKSPACE` (""),
  `LIBRARIES` (()), `RUN_MODE` ("auto"), `SHOW_PSCAD` (False), `PSCAD_VERSION` (""),
  `FORTRAN_VERSION` (""), `PSCAD_PORT` (0), `CONNECT_TIMEOUT` (120 s), `UNDO_CHANGES` (True),
  `F_NOMINAL` ("auto"), and the optional `PREFLIGHT_MODULES` (()).

## px_core.py

| Section | Needs | Names | What they do |
|---|---|---|---|
| `px_state` | log | `PXB`, `PXError`, `defer()`, `run_deferred()` | Shared state `_PX`; `PXB` is the `"PXB_"` prefix of what the workflow makes. `PXError`: A PSCAD step could not be done; the message says why in plain words. `defer`: Leave a tidy-up that must wait until after the next run (deleting a file EMTDC holds). `run_deferred`: Run the tidy-ups left by the last run. |
| `px_messages` | log, px_state | `px_messages()`, `px_errors()` | `px_messages`: PSCAD's build and run messages for a project, newest last, as plain lines. `px_errors`: Only the error lines of a project's messages, as plain text. |
| `preflight` | log | `preflight()` | `preflight`: Check every package the script needs before connecting to PSCAD. |
| `px_shim` | log | (runs on load) | Aliases `mhi.pscad.common` to `mhi.common` so an Automation Library from 2.3 on can drive PSCAD 5.0.0, and clears `NoDefaultCurrentDirectoryInExePath` so EMTDC's batch files can start the case. |
| `px_connect` | log, px_state, px_shim, px_messages, preflight, run_dir | `px_connect()` | `px_connect`: Connect to PSCAD and open the project the workflow works on. |
| `px_value` | · | `px_split_value()`, `px_number()`, `px_unit()`, `px_text()`, `px_with_unit()` | `px_split_value`: A PSCAD parameter value as (number, unit) when it is one, else (None, ""). `px_number`: The number in a PSCAD parameter value, or `default`. `px_unit`: The unit a PSCAD parameter value carries ("ohm", "kV", "s"), or "". `px_text`: A PSCAD parameter value as the text PSCAD itself would show. `px_with_unit`: A value written the way PSCAD takes it: "2.5 [ohm]", or "2.5" with no unit. |
| `units` | · | `unit_factor()` | `unit_factor`: How many `to_unit` one `from_unit` is, or None when they are not the same quantity. |
| `px_set` | log, px_state, px_value, units | `px_set()` | `px_set`: Write one parameter of a component (or of each component of a list) and give `value` back. |
| `px_get` | log, px_state, px_value, units | `Reading`, `px_get()`, `px_get_all()` | `Reading`: One parameter read on several components: the values and which component holds each. `px_get`: Read one parameter of a component: a number where it is one, else its text. `px_get_all`: Read one parameter on every component of a list, as a Reading. |
| `px_mark` | px_state | `px_mark()` | `px_mark`: Open a mark: px_undo(mark) puts back every px_set written after it. |
| `px_undo` | log, px_state, px_set, track_created | `px_undo()` | `px_undo`: Put back every parameter px_set changed after `mark` (None: everything) and say how many. |
| `track_created` | log, px_state | `track_created()`, `delete_created()`, `cleanup_created()` | `track_created`: Remember something the workflow made so finish() can take it away again. `delete_created`: Delete one thing the workflow made. `cleanup_created`: Delete what the workflow made and was not asked to keep, newest first. |
| `px_find` | log, px_state | `px_find()`, `page_changed()` | `px_find`: Find a component in the project: by definition, by Name, or by both. `page_changed`: Say that the pages have changed, so the next search lists them again. |
| `check_elements` | log, px_find | `check_elements()` | `check_elements`: CHECK_ONLY: say which components the workflow looks for are there. |
| `f_nominal` | log, px_state, px_value, globalsub | `f_nominal()` | `f_nominal`: The nominal frequency in Hz the checks should use. |
| `finish` | log, px_state, px_undo, track_created, px_messages | `finish()`, `add_finish_hook()` | `finish`: main's `finally`: put the project back the way it was found and tidy up. `add_finish_hook`: Have finish() run `fn` before it puts the project back. |

## px_model.py

| Section | Needs | Names | What they do |
|---|---|---|---|
| `px_names` | px_state | `px_clean_name()` | `px_clean_name`: A name PSCAD accepts: letters, digits and underscores, starting with a letter. |
| `find_components` | log, px_state, px_find, px_value | `find_components()` | `find_components`: Every component matching the definition and name, narrowed by one parameter. |
| `set_enabled` | log, px_state | `set_enabled()` | `set_enabled`: Enable or disable components, and say how many changed. |
| `scenarios` | log, px_state, track_created, px_names | `scenario_list()`, `scenario_activate()`, `scenario_save()`, `each_scenario()` | `scenario_list`: The scenarios in the project, sorted, matching the pattern. `scenario_activate`: Switch to a scenario by name and give its name back. `scenario_save`: Save the values in use now into a scenario, and say whether PSCAD took it. `each_scenario`: Yield each scenario with it active in turn, and put back the one that was active. |
| `layers` | log, px_state, px_names, track_created | `layer_list()`, `layer_states()`, `layer_set()`, `layer_create()`, `layer_add()`, `each_layer()` | `layer_list`: The project's layers as {name: state}, matching the pattern. `layer_states`: Every state the named layer can take, as PSCAD lists them. `layer_set`: Put one layer into a state and give the state back. `layer_create`: Make a layer (or take the one that is there) and give it back. `layer_add`: Put components on a layer and say how many went on. `each_layer`: Yield each layer with only it in `state` and the others in `others`. |
| `globalsub` | log, px_state, px_names, px_value, track_created, finish | `gs_sets()`, `gs_all()`, `gs_get()`, `gs_set()`, `gs_set_active()`, `each_gs_set()`, `gs_load()`, `gs_save()` | `gs_sets`: The names of the project's global substitution sets. `gs_all`: The project's global substitutions as {name: value}, for one set. `gs_get`: One global substitution: a number where it is one, else its text. `gs_set`: Set one global substitution and give the value back. `gs_set_active`: Switch to a named set of global substitutions and give its name back. `each_gs_set`: Yield each global substitution set with it active in turn, then put back the first. `gs_load`: Load global substitutions from a CSV file PSCAD wrote, and say how many there are. `gs_save`: Write the global substitutions to a CSV file, and give the path back. |
| `controls` | log, px_state, px_find, px_value | `control_set()`, `control_limits()` | `control_set`: Set an input control of the model: a slider, a switch, a dial or a button. `control_limits`: Widen or narrow a slider's range so a sweep can reach the value it needs. |
| `canvas` | log, px_state, px_find | `page_of()`, `pages()`, `module_page()` | `page_of`: A page of the project to build on, by definition name ("Main", or a module's own). `pages`: The project's page (definition) names, sorted, matching the pattern. `module_page`: The page inside a module component, so a script can work on what is drawn in it. |
| `build_page` | log, px_state, px_names, px_set, track_created, canvas, px_find | `add_component()`, `add_wire()`, `add_bus()`, `add_channel()`, `add_graph()`, `delete_component()`, `copy_component()` | `add_component`: Put a component on a page and give it back. `add_wire`: Draw a wire through the given grid points and give it back. `add_bus`: Draw a bus through the given grid points and give it back. `add_channel`: Put an output channel (a PGB) on a page so the run records that signal. `add_graph`: Put a graph frame on a page, with a curve of `channel` when one is given. `delete_component`: Delete components from the page and say how many went. `copy_component`: Copy one component to another spot on its page and give the copy back. |
| `projects` | log, px_state, px_names, track_created, px_connect | `project_list()`, `project_use()`, `project_save()`, `project_save_as()`, `project_new()` | `project_list`: The projects loaded in the workspace, sorted, matching the pattern. `project_use`: Make a loaded project the one the workflow works on, and give it back. `project_save`: Save the project so what the workflow changed is on disk. `project_save_as`: Save the project under a new name and give the new project back. `project_new`: Make a new, empty case in the workspace and give it back, for a model built by script. |
| `multirun` | log, px_state, px_find, px_value, px_set | `mrun_sweep()`, `mrun_range()`, `mrun_count()` | `mrun_sweep`: Set up PSCAD's own Multiple Run component to sweep one variable over a list. `mrun_range`: Set up PSCAD's Multiple Run component to sweep one variable over a range. `mrun_count`: How many runs the project does in one go, PSCAD's "Multiple Run" count. |

## px_studies.py

| Section | Needs | Names | What they do |
|---|---|---|---|
| `px_result` | log, px_state, px_messages | `BuildResult` | `BuildResult`: What a build did: .ok, .errors, .warnings, .messages, .seconds. |
| `px_build` | log, px_state, px_messages, px_result | `px_build()` | `px_build`: Compile the project with its Fortran compiler and say how it went. |
| `sim_settings` | log, px_state, px_set, px_value, units | `sim_settings()` | `sim_settings`: Write the simulation settings of the project and give back what they now are. |
| `px_channels` | log, px_state, px_names | `read_inf()`, `read_out()`, `out_paths()` | `read_inf`: The channel index PSCAD writes beside its .out files, in channel order. `read_out`: Read PSCAD's .out files into (times, {channel index: values}). `out_paths`: (folder, stem, inf path) where this project's run writes its result files. |
| `px_simresult` | log, px_state, Series, px_channels, px_value | `SimResult` | `SimResult`: What one EMT run produced, and the way to read its channels. |
| `px_run` | log, px_state, px_messages, px_build, sim_settings, px_channels, px_simresult, px_names, px_find | `px_run()`, `read_curves()` | `px_run`: Build the project if it needs it, run the EMT simulation, and read the channels back. `read_curves`: Read the samples straight off the project's graphs: (channels, times, {index: values}). |
| `snapshots` | log, px_state, px_set, px_value, sim_settings, px_names | `snapshot_save()`, `snapshot_use()`, `snapshot_off()` | `snapshot_save`: Have the next run save a snapshot at `at` seconds, and give back the file name. `snapshot_use`: Have the next runs start from a snapshot file, and give its full path back. `snapshot_off`: Go back to starting runs from zero. |
| `simsets` | log, px_state, px_names, track_created, px_messages, px_result, px_value | `simset_create()`, `simset_add()`, `simset_volley()`, `simset_override()`, `simset_run()` | `simset_create`: Make a simulation set of project tasks and give it back. `simset_add`: Add projects to a simulation set as tasks, and give the task names back. `simset_volley`: How many of the set's tasks run at the same time. `simset_override`: Override the simulation settings of one task, or of every task in the set. `simset_run`: Run a simulation set and say how it went, as a BuildResult-shaped record. |
| `px_events` | log, px_state, px_find, px_set, px_value, px_names | `set_fault()`, `set_switching()` | `set_fault`: Set the timing of a fault component in the model, and give back (start, clear). `set_switching`: Set the time a breaker or switch component operates, and give the time back. |
