# PowerFactory runtime API (pf_core.py, pf_model.py, pf_studies.py)

The PowerFactory half of the Builder runtime. Blocks ask for a **section** by name
(`cx.helper('run_rms')`); the generator copies that section and everything in its `@needs`
(transitively, file order) into the generated file. Every name below was run on the live
PowerFactory 2024 engine (`_audit/runtime/live/live_tests.py`, 217 checks on the two Builder
sandboxes); "verified" means checked there.

## Conventions

- **`app` first** for helpers that search the project or switch cases, scenarios or variations
  (the generated code always has `app`). Helpers that act on one element take the element and find
  `app` in `_PF["app"]` (set by `pf_connect`): `pf_set`, `pf_get`, `pf_mark`, `pf_undo`,
  `set_seconds`, `set_dispatch`, `set_service`, `scale_attr`, `outer_composite`.
- **Units.** Times are always seconds (written in PowerFactory's internal mode, so a project that
  shows ms cannot turn 0.01 s into 0.01 ms). Powers are MW / Mvar unless a `unit=` argument says
  otherwise; the value is converted to the unit the project shows (kW, GW, ms ...). Percent where
  stated (load steps, line fault location).
- **Elements** are PowerFactory objects; anywhere one is expected, a one-item list also works
  (`pf_find(..., "all")` results). Names are exact, then a unique letter-case-only match with a
  warning.
- **Errors.** `PFError` with a plain message, tagged `[MODEL]` (the model or a name does not fit:
  missing element, refused activation) or `[CODE]` (a wrong call). A failed calculation is **not**
  an error: `run_*` return `ok` / `status` and log a `[MODEL]` warning with PowerFactory's own text.
  Connect problems end the script with `SystemExit` and a message saying what to do.
- **What the workflow makes** is named `PFB_...` (events `PFB_<key>_<role>`, `PFB_res`,
  `PFB_vec`, `PFB_hldf_res`, `PFB_shc_select`, test generators `PFB_<key>`), except cases,
  scenarios and variations the reader names; those carry the line
  `PFB: made by the PowerFactory Workflow Builder` in their description. `finish()` deletes all of
  it except what was created with `keep=True`.
- **SETTINGS read** (with defaults, `globals().get`): `PF_API_PATH` (""), `PROJECT`,
  `STUDY_CASE` (""), `RUN_MODE` ("auto"), `PF_USER` (""), `SHOW_PF` (False), `UNDO_CHANGES` (True),
  `FAST_MODE` (True: PowerFactory echo off for the whole run; messages are still captured),
  `CONNECT_TIMEOUT` (120 s), `F_NOMINAL` ("auto"), and new optional `PREFLIGHT_MODULES` (()).

## pf_core.py

| Section | Names | Returns, notes |
|---|---|---|
| `pf_state` | `PFError`, `PFB` (= "PFB_"), `run_deferred()` | Shared state `_PF`. `run_deferred()` runs tidy-ups left by the last calculation (every `run_*`, case and scenario switch, `pf_undo` path and `finish` call it). |
| `pf_messages` | `pf_messages(app=None, clear=True, errors_only=False, last=None)` | PowerFactory's output-window lines since the last call, cleaned: `"Error: No convergence in load flow."`, `"Warning: ..."`. Works headless. |
| `pf_connect` | `pf_connect()` | The application. Engine mode: GUI check (plain message with both choices), API folder `PowerFactory 2024*\Python\<this Python>` (else a message naming the folders found and `py -3.x file.py`), watchdog process (after `CONNECT_TIMEOUT` it writes the reason to run.log and ends the script with exit code 3), `GetApplicationExt` once (licence / database errors 4002, 3010, 3018, 3000, 7000 in plain words with what to do), `ActivateProject(PROJECT)` (on failure: closest project names), `STUDY_CASE` (on failure: closest case names). Remembers the case and scenario active when the project opened. Calling it again reuses the same application. RUN_MODE auto = inside when the process is PowerFactory.exe. |
| `preflight` | `preflight(modules=None)` | True, or `SystemExit` naming the missing package and the exact `"<python>" -m pip install x` line; also checks the API folder in engine mode. `modules` None reads `PREFLIGHT_MODULES`. Call before `pf_connect`. |
| `pf_find` | `pf_find(app, query, match="one", in_service=False, empty_ok=False)` | `query` "Name.Class", `*` wildcards. `"one"`: exactly one (several = error naming them); `"first"`: first by name; `"all"`: list sorted by name (then full name). Searches the right place per class: `IntCase`/`IntScenario`/`IntScheme` folders, `Typ*` the equipment library, `Evt*` the active case's event list, `Com*`/`ElmRes` the active case, else the active grids (which include out-of-service elements: `in_service=True` drops them). No match: `[MODEL]` error with up to 8 closest names and the count. `empty_ok` returns None / []. |
| `check_elements` | `check_elements(app, queries)` | For CHECK_ONLY: logs found / MISSING per query ("Name.Class" or (query, match)); True when all found. |
| `units` | `unit_factor(from_unit, to_unit)` | Factor or None. Families: W kW MW GW; var kvar Mvar Gvar; VA kVA MVA GVA; s ms min h; V kV; A kA; Wh..GWh. |
| `pf_set` | `pf_set(obj, attr, value, unit=None, record=True)` | Writes one element (or each of a list); returns `value`. Coerces to the attribute's type (numpy, text with a decimal comma, bool to int; floats rounded for integer attributes with a warning). `unit`: the block's unit, converted to the project's display unit (logged once). Records the first original per (element, attribute, study case, scenario) since the innermost open mark. Unknown attribute: `[MODEL]` error. |
| `pf_get` | `pf_get(obj, attr, unit=None, total=False, default=None)`; `pf_get_all(objs, attr, unit=None, total=False, skip=True)`; class `Reading` | `pf_get`: the value; for results (m:, c:, s:, n:, r:, b:) that are not available (no calculation since the last write, element out of service) `default` with one warning per attribute, never an error. `total` multiplies by `ngnum`. `pf_get_all`: a `Reading` with `.values`, `.objs`, `.max`, `.min`, `.at_max`, `.at_min` (elements), `.n`, `.value`; `skip` leaves out out-of-service elements and, for results, de-energised ones. |
| `pf_mark` | `pf_mark()` | A mark dict (`id`, `n`, `case`, `scen`, `created`). One per loop pass. |
| `pf_undo` | `pf_undo(mark=None)` | Number of values put back. Puts back every `pf_set` after the mark (all with None), each in its own study case and scenario, then re-activates the mark's case and scenario (None: the ones active at the call). Elements created after the mark (test generators) are switched out of service. A scenario the workflow saved keeps its saved values (its unsaved undo writes are dropped when it is deactivated). |
| `seconds` | `set_seconds(obj, attr, seconds)`, `get_seconds(obj, attr)` | Time attributes in seconds whatever the display unit. |
| `track_created` | `track_created(obj, kind="object", keep=False)`, `delete_created(app, obj)`, `cleanup_created(app=None)` | Tracking returns `obj`. `cleanup_created` returns (deleted, names left): `ResetCalculation()` first (Delete silently fails for objects the last calculation used), newest first, each checked gone; deactivates a created scenario or variation first. |
| `f_nominal` | `f_nominal(app, obj=None)` | Hz. `F_NOMINAL` 50 / 60 wins; "auto": `frnom` of the element's grid (`cpGrid`, or `bus1.cterm.cpGrid`), else the first grid in Network Data. Never the study case's "Summary Grid" (50 Hz on the 60 Hz New England demo). Logged once per grid. |
| `finish` | `finish(app=None)` | main's `finally`: `pf_undo()` when UNDO_CHANGES, `run_deferred()`, restore variations per touched case, re-activate the start case and scenario, `cleanup_created`, delete `PFB_*` leftovers in the active case, `SetAttributeModeInternal(0)`, `EchoOn`, `flush_tables()` (when the table section is in the file: every table with rows no Save results table saved, in `TABLE_FORMAT` "csv" / "xlsx" / "both", Start's "Save the results tables as"), `log_summary()`. Each step runs even if an earlier one fails. Resets the per-workflow state. |

## pf_model.py

| Section | Signature | Returns, notes |
|---|---|---|
| `pf_names` | `pf_clean_name(text, maxlen=40)` | A name PowerFactory accepts (`, \ * ? : = | "` and `/ < > ;` become `_`, cut to 40). Also the `_Bag` record used for multi-value results. |
| `case_list` | `case_list(app, pattern="*")` | Study cases (IntCase only, all sub folders) matching, sorted by name. |
| `case_activate` | `case_activate(app, case)` | The case (object or name). Brings its scenario and variations. |
| `case_create` | `case_create(app, name, template=None, scenario="copy", if_exists="reuse", activate=True, keep=True)` | `_Bag(case, scenario, name, created)`. `AddCopy` of the template (None = active case) in the template's folder, so commands, events, variations stay. scenario "copy" copies the template's scenario under the case name (a new saved one when the template has none), "new" a fresh scenario saved from the network data, "none" none. if_exists "reuse" / "replace" (deletes only a Builder-made case and its scenario; otherwise numbered) / "new" (numbered). `name` is read back. activate=False makes it and goes back. keep=False: deleted by finish. |
| `each_case` | `each_case(app, cases)` (generator) | Yields each case active in turn; afterwards (also after break or an exception) the case and scenario active before the loop. |
| `scenario_list` | `scenario_list(app, pattern="*")` | Sorted IntScenario. |
| `scenario_activate` | `scenario_activate(app, scen)` | The scenario. |
| `scenario_deactivate` | `scenario_deactivate(app, save=False)` | The scenario switched off, or None. save=False drops unsaved changes (PowerFactory's default). |
| `scenario_create` | `scenario_create(app, name, activate=True, keep=True, if_exists="reuse")` | The scenario, made from the operating state in use now (`SaveAsScenario`). |
| `scenario_save` | `scenario_save(app)` | True when saved. |
| `each_scenario` | `each_scenario(app, scenarios)` (generator) | Activates each; restores the case and scenario active before. |
| `variation_state` | (internal) | Variation sets per study case, restored by finish; removes a Variation Configuration PowerFactory made in a case that had none. |
| `variation_list` | `variation_list(app, pattern="*")` | Sorted IntScheme. |
| `variation_activate` | `variation_activate(app, variation, alone=False)` | The variation (object or name). |
| `variation_deactivate` | `variation_deactivate(app, variation=None)` | Count deactivated (None = all active). |
| `variation_create` | `variation_create(app, name, stage=None, activate=True, keep=True, if_exists="reuse")` | The variation with one stage at the active case's study time; activated it is the recording stage. |
| `each_variation` | `each_variation(app, variations, alone=True)` (generator) | Activates each (alone: only it); restores the case's variation set after. |
| `find_elements` | `find_elements(app, cls, name="*", attr=None, op="=", value=None, in_service=False)` | Sorted list (may be empty). op `= != > >= < <=`; text with `*` compares as a pattern, `!=` leaves the matches out. |
| `outer_composite` | `outer_composite(obj)` | The outermost ElmComp (via `c_pmod`, else parents), or None. Its service state is project-wide (not in a scenario). |
| `set_service` | `set_service(objs, in_service, outer_comp=False)` | Count. Through `pf_set` (undoable). |
| `set_dispatch` | `set_dispatch(obj, p=None, q=None, basis="total", qmode="keep", unit="MW", q_unit="Mvar", outer_comp=False)` | `p`. ElmSym, ElmGenstat, ElmPvsys, ElmAsm: pgini / qgini; ElmVsc: psetp / qsetp. basis "total" divides by `ngnum` (verified: 400 MW on a 2-machine unit writes 200, the load flow shows 400). qmode "pq" sets `av_mode = "constq"` (else Q has no effect on a voltage-controlled unit). Always puts the unit in service. Other classes: `[MODEL]` error. |
| `dispatch_row` | `dispatch_row(app, row, mapping=None, basis="total", unit="MW", outer_comp=True)` | `_Bag(dispatched, out_of_service)`. `row` a dict; `mapping` {column: element or "Name.Class"} (None = headers are generator names; other columns skipped and logged). Blank / NaN = out of service with its outermost composite; 0 = in service at 0 MW. |
| `scale_attr` | `scale_attr(objs, attr, factor)` | `factor`. New value = factor x the value before the workflow first changed it (in this case and scenario), so 1.1 twice is 1.1 x original. |
| `contingencies` | class `Contingency(name, elements, group)`; `define_contingencies(app, groups, order=1, in_service=True)`; `trip_contingency(app, cont)`; `each_contingency(app, conts, base=True)` (generator) | `define_*`: list of Contingency (`.name`, `.elements`, `.group` like "lines", `.loc_name` = name so table rows show it); groups are queries or lists; in_service leaves out (and logs) elements already out; order 2 = every pair; warns above 5000. `trip_contingency`: a handle (`.restore()`, or use as `with`); elements already out are not touched; restore writes each ORIGINAL outserv back in the context of the trip. `each_contingency`: "Base case" (nothing out) first when base, trips, yields, restores however the body ends. Writes are direct, not `pf_set` records, so they never mix with pass undo. |
| `add_test_generator` | `add_test_generator(app, bus, p=0.0, q=0.0, key="testgen", rating=None, unit="MW", q_unit="Mvar")` | The ElmGenstat `PFB_<key>` (constant Q) on a new cubicle `PFB_<key>` at the busbar (object or name). Same key again: updated, or moved when the bus changed. rating default max(100 MVA, 1.5 x |S|). Deleted by finish; switched off by a pass undo when made in that pass. |

## pf_studies.py

| Section | Signature | Returns, notes |
|---|---|---|
| `pf_command` | class `StudyResult` | `.ok`, `.rc`, `.messages`, truthy when ok. Commands are the active case's own (a missing one is made, logged and deleted at the end). Overridden settings go back right after the run (verified: results stay readable). |
| `run_load_flow` | `run_load_flow(app, net="case", qlim="case", taps="case")` | `LdfResult`: `.ok` (rc 0), `.rc`, `.slack_mw` (ElmSym with ip_ctrl 1 plus ElmXnet with bustp SL; `m:Psum:bus1` when unbalanced; None when not converged), `.messages`, `.net` (words). net "ac" / "unbalanced" / "dc"; qlim, taps "on" / "off". Not converged: `[MODEL]` warning with PowerFactory's text. |
| `pf_events` | (internal) `_event_put`, `_event_folder` | One event `PFB_<key>_<role>` per block and role in `ComInc.p_event` (made when the case has none), created or updated, switched on, registered for the next run. `key` = the block's node id. |
| `SimResult` | class | `.status` "ok" / "early" / "no_init"; `.ok` / `.reached_end` (status ok), `.init_ok`; `.t_end` (s), `.tstop`, `.message` (last PowerFactory errors), `.events` [(t, label)] of the workflow's events in that run, `.t`; `.has(obj, var)`; `.series(obj, var, label=None)` -> base `Series` (with `.unit` from PowerFactory, e.g. "Hz", and the events); `.series_combined(objs, var, combine="mean", label=None)` with combine sum / mean / min / max / spread. Not recorded or wrong name: empty Series and one warning. |
| `sim_run` | (internal) `_run_sim` | Shared by run_rms and run_emt. |
| `run_rms` | `run_rms(app, tstop, tstart=None, step=None, monitors=(), monitor_lists=(), net="case", case_events="auto", fast=False, extend_to=0, ufls_hz=None)` | `SimResult`. monitors [(element, var)], monitor_lists [(elements, var)] (dedup by element and variable). A temporary `PFB_res` replaces `p_resvar` for the run; columns are read into memory at once (GetColumnValues + IntVec); the file is deleted before the next calculation (needs ResetCalculation). net "sym" / "rst". case_events "auto": the case's own events are off for the run when the workflow added any, else on; "off" / "keep". The workflow's PFB events not added since the last run are switched off. Echo on for ComInc (its error text), off for ComSim. fast: iopt_fastsol, iopt_fastout, systemSolvingMode = 1, read back and logged, put back. extend_to: when a recorded `m:fehz` is at its minimum in the last second and above ufls_hz (default nominal - 1 Hz), tstop is raised and ComSim runs again (continuation, verified: one curve, no repeated events). Status: no_init when ComInc rc != 0 (a diverged load flow gives rc 2), ok when ComSim rc 0 and t_end reached, else early. Warns when an unbalanced fault is in a balanced run. |
| `run_emt` | `run_emt(app, tstop, tstart=None, step=None, ...)` | Same, `iopt_sim = "ins"`, `step` = dtemt. Verified on Nine-bus with 50 us. |
| `run_harmonic` | `run_harmonic(app, net="case")` | `StudyResult` (+ `.net`). net "balanced" / "unbalanced". Gives ComHldf a temporary result file when it has none, sets ComLdf to the same network type, runs the load flow then ComHldf, puts the settings back (THD stays readable: `m:THD` %, `m:THD:A` per phase), and tracks the "Harmonics AC balanced/unbalanced" result files it makes for deletion. |
| `run_short_circuit` | `run_short_circuit(app, method="iec", fault="3ph", current="max", target=None, rf=0.0, xf=0.0)` | `StudyResult` (+ `.method`, `.fault`). method iec / vde / ansi / complete / iec61363; fault 3ph / 2ph / 1ph / 2phg; target one element, a list (a SetSelect `PFB_shc_select`) or None = all busbars. Verified Nine-bus Bus 5 IEC max 2.256 kA, min 2.099, complete 2.4126, 1ph 2.690. ANSI gives other result names. |
| `add_short_circuit` | `add_short_circuit(app, key, target, t, duration=None, rf=0.0, xf=0.0, location=None, clear="fault", fault="3ph", phase=None)` | `(t_fault, t_clear)` (t_clear None without duration). Roles on / off / trip. clear "trip" also opens a faulted line or transformer at t_clear. location % on a line (shcLocation). phase "a" / "b" / "c" (1ph) or "ab" / "bc" / "ca". |
| `add_switch_event` | `add_switch_event(app, key, element, t, action="open")` | t. EvtSwitch, all phases, role "switch". |
| `add_contingency_events` | `add_contingency_events(app, key, cont, t)` | t. One open event per element (keys `<key>_1`, `<key>_2` ...), for contingencies in a simulation. |
| `add_trip` | `add_trip(app, key, element, t, units="all", n=None)` | MW tripped from the dispatch (P per machine x ngnum; a load's plini; None otherwise). EvtSwitch, role "trip". units "some" raises `[MODEL]` (see below). |
| `add_load_step` | `add_load_step(app, key, load, t, dp=0.0, dq=0.0)` | t. EvtLod, dP / dQ in percent (verified +20 %: 329 -> 394.6 MW). Loads only. |
| `add_param_event` | `add_param_event(app, key, element, t, param, value, mode="absolute")` | t. EvtParam with `variable` and the value as text; mode add / times work from the initial value (DSL `params` by `parameterNames`, else the attribute). For DSL parameters; it has no effect on element data such as `ElmLod.plini`. |

## Which block calls what (DESIGN section 9 type ids)

- `start`: main writes `preflight([...])`, `app = pf_connect()`, `check_elements(app, [...])` for
  CHECK_ONLY, `finish(app)` in `finally`.
- `pf.element`: `pf_find(app, "<name>.<cls>", "<match>", in_service=True)` (the default of the
  block). Inline obj fallbacks: `pf_find(app, "<name>.<cls>", "<match>")`.
  `pf.foreach_element`: `pf_find(..., "all")` or `find_elements(...)` as the loop list.
- `pf.set`: `pf_set(obj, attr, value, unit)`. `pf.get`: `pf_get(obj, attr, unit, total)`; with a
  list input `pf_get_all(objs, attr, unit, total, skip)` and outputs `.values .max .min .at_max
  .at_min .n`.
- `pf.dispatch`: `set_dispatch(obj, p, q, basis, qmode, outer_comp=...)`; row mode
  `dispatch_row(app, row, mapping, basis)`. `pf.scale`: `scale_attr(objs, attr, factor)`.
  `pf.outserv`: `set_service(objs, in_service, outer_comp)`. `pf.undo`: `pf_undo()` (top level).
- `pf.case.activate` `case_activate`; `pf.case.create` `case_create` (outputs `.case .scenario
  .name`); `pf.case.foreach` `for c in each_case(app, case_list(app, pattern))`.
- `pf.scen.activate / create / save / deactivate / foreach`: `scenario_activate`,
  `scenario_create`, `scenario_save`, `scenario_deactivate(app, save)`,
  `for s in each_scenario(app, scenario_list(app, pattern))`.
- `pf.var.activate / deactivate / create / foreach`: `variation_activate(app, v, alone)`,
  `variation_deactivate`, `variation_create`, `for v in each_variation(app, variation_list(app, pattern), alone)`.
- `pf.testgen`: `add_test_generator(app, bus, p, q, key="<node id>")`.
- `pf.ldf`: `res = run_load_flow(app, net, qlim, taps)`; branches `res.ok` / `not res.ok`;
  outputs `.ok`, `.slack_mw`.
- `pf.rms` / `pf.emt`: `res = run_rms(app, tstop, tstart, step, monitors=[...], monitor_lists=[...],
  net, case_events, fast, extend_to)`; branches `res.status == "ok"`, `== "early"`,
  `== "no_init"`; outputs `res`, `.t_end`, `.status`; Record rows `res.series(obj, var, label)` or
  `res.series_combined(objs, var, combine, label)`. `sig.series`: the same two methods.
- `pf.hldf`: `run_harmonic(app, net)`. `pf.shc`: `run_short_circuit(app, method, fault, current, target)`.
- `pf.evt.shc`: `t_fault, t_clear = add_short_circuit(app, "<node id>", target, t, duration, rf, xf, location, clear, fault, phase)`.
  `pf.evt.switch`: `add_switch_event`. `pf.evt.trip`: `mw = add_trip(...)`. `pf.evt.load`:
  `add_load_step`. `pf.evt.param`: `add_param_event`.
- `pf.cont.define`: `define_contingencies(app, groups, order, in_service)`. `pf.cont.foreach`:
  how outserv `for c in each_contingency(app, conts, base)`; how event: loop over
  `([Contingency("Base case", [])] if base else []) + conts` and `add_contingency_events(app, key, c, t)`.
- Every loop and search pass: `mark = pf_mark()` ... `finally: pf_undo(mark)` (DESIGN 6.4).
- Checks needing the nominal frequency: `f_nominal(app, obj)`.

## Verified on the live engine (and what to rely on)

- `EvtShc.i_shc`: **0 three-phase, 1 two-phase (a-b), 2 single-phase to ground (a), 3 two-phase to
  ground (a, b), 4 clears the fault** (phase voltages in the middle of the fault, unbalanced RMS on
  Nine-bus Bus 5). Phases: `i_pspgf` 0/1/2 = a/b/c for 1ph (b verified), `i_p2psc` and `i_p2pgf`
  0/1/2 = ab/bc/ca. Codes 5 and 6 do nothing. **In a balanced (sym) RMS run a single-phase fault is
  applied as a three-phase fault** (u1 falls to 0): unbalanced faults need net "rst" (the runtime
  warns).
- **`EvtSym.outNgnum` (machine outage) has no effect in RMS** (39-bus G 05, 2 machines, with 1 or 2,
  with or without newS): only a whole-unit trip (EvtSwitch) works, so `units="some"` is refused.
- Command settings written back after a run keep the results readable (ComLdf, ComInc p_resvar,
  ComShc, ComHldf); deleting the temporary result file needs ResetCalculation, which is why it waits
  for the next calculation.
- Activating another scenario keeps the old one's unsaved changes; `Deactivate()` drops them;
  `Deactivate(1)` saves. A fresh IntScenario shows the network data, not the previous scenario.
- The Nine-bus demo grid is **60 Hz** (`frnom` 60); each study case's "Summary Grid" may say 50.
- 39-bus shows ComInc times in ms: `step=0.005` gives a 5 ms time column and the case keeps 10 ms.
- The unstable 39-bus demo (2.2) runs to its stop time with pole slipping (status ok): no demo case
  stops early, so the "early" branch is only checked by its logic.

## Gotchas for block authors

- Reading `m:` / `c:` results after any write (dispatch, an event block) gives None: read results
  before the next model write, or after the next calculation.
- `pf_find` "one" raises on several matches: a busbar name repeated in substations needs "first",
  "all" or a more exact name.
- `case_create` with `scenario="none"` keeps whatever scenario the template uses; dispatch then
  changes the network data every case shares (pass undo puts it back).
- `pf_undo(mark)` re-activates the mark's study case: the next pass's "copy of the active case"
  copies the same template again (verified in the loop test).
- A scenario saved inside a pass keeps its saved values after the pass undo, by design (DESIGN E3).
- Event keys must be unique per block (the node id); a block with several events uses roles inside
  one key.
- Recording thousands of curves is allowed but slow; more than 500 logs a warning.
