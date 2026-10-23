# Analysis runtime API (signals.py, outputs.py, optimise.py)

The analysis half of the Builder runtime: statistics, signal checks, graphs and the two searches.
None of it calls PowerFactory. Blocks ask for a **section** by name (`cx.helper('nadir')`); the
generator copies that section and everything in its `@needs` (transitively, file order) into the
generated file. Tested offline with synthetic traces and the two real traces of the pf-runtime live
tests (`_audit/runtime/analysis/test_analysis.py`).

## Conventions

- **Inputs are forgiving.** A `values` argument may be a number, a list (nested lists are
  flattened), a `Series` (its values) or `None`. A `series` argument is a base.py `Series`
  (`t` in seconds, `y`, `label`, `unit`, `events` as `[(t, label)]`). NaN and inf samples are left
  out. Missing data never raises: a check returns its NO DATA form (`None` values, `ok=None`,
  `text="NO DATA"`, `verdict="NO DATA"`), a graph logs a warning and returns `None`.
- **Results** of the checks are `SigResult` objects and those of the searches `OptResult` /
  `LimitResult` (both `SearchResult`). Read a field as an attribute or a key: `r.value`,
  `r["value"]`, `r.get("value")`, `r.keys()`, `r.as_dict()`. A block output reads one field with
  `pick: '.value'` (or `.ok`, `.text`, `.time`, ...). Fields that could not be worked out are `None`.
- **Event time.** Every `t_event` / `after` argument defaults to the series' first workflow event
  (`series.first_event()`), else its first sample. Wire the event block's `t` (or `t_clear`) to
  override it.
- **Nominal frequency.** `nominal` (Hz) is the argument, else the `F_NOMINAL` setting when it is a
  number, else the nearer of 50 and 60 Hz to the first sample of a Hz trace (logged once), else
  50 Hz with a warning. Blocks pass `F_NOMINAL` when it is 50 or 60 and `f_nominal(app, bus)` when it
  is "auto".
- **Frequency units.** The frequency checks (`nadir`, `rocof`) take Hz or p.u.: a series whose unit
  is `p.u.` (or which has no unit and values near 1) is multiplied by the nominal frequency, and
  this is logged once. Any other unit gives NO DATA with an error line naming the unit.
  `despike` scales only a frequency or speed in p.u. (see its row); `settling`, `first_cross`,
  `check_limits` and the rest work in the series' own unit.
- **Graphs** go to `<run folder>/graphs/` through `out_file` (the loop values are added to the file
  name inside a loop, a counter keeps names unique), carry the vector credit "Made with
  tool.adjiebrotots.com/powerfactory-scripter/builder" (TextPath outlines, bottom right), are
  closed at once, and never raise: a drawing failure is logged as an error and returns `None`.
  Inside a loop the loop values ("Dispatch (MW) = 200") are written under the title.
- **Packages** (for `preflight([...])` via the block's `packages`): every `plot_*`,
  `draw_collected` and `plot_convergence` need `matplotlib` (numpy comes with it). `optimise` with
  method de / nelder / powell / bounded needs `scipy` (without it the search falls back to a grid
  with a warning); `bayes` uses `scikit-optimize` when installed and falls back to de, so do not
  make `scikit-optimize` a preflight requirement. Nothing optional is imported at the top of the
  generated file; every package is imported on first use.
- **Private names** start with `_stat_`, `_sg_`, `_po_` or `_op_`, so no generated variable or
  other runtime file can clash with them.

## signals.py

| Section | Signature | Returns, units | Block |
|---|---|---|---|
| `stat` | `stat(kind, values, p=None)` | One number or `None` (no data). kind: `max`, `min`, `mean`, `median`, `sum`, `count`, `std` (sample, n - 1, needs 2 values), `percentile` (p 0 to 100, default 50, linear between ranks as numpy). `count` of nothing is 0. Every sample counts the same (not time weighted). Aliases: average, avg, maximum, minimum, total, n, stdev, pct. Unknown kind: warning, `None`. | `math.max`, `math.min`, `math.mean`, `math.median`, `math.sum`, `math.count`, `math.std`, `math.percentile` |
| `sig_common` | `SigResult(**fields)` | The result object of every check (see Conventions). Also the shared private helpers. | (needed by the others) |
| `despike` | `despike(series, window=0.2, trigger=0.1, max_step=20.0, settle=0.02, nominal=None, signal="auto")` | `SigResult`: `series` (the clean Series, same label, unit and events), `spikes` (list of `Spike`: `t_start`, `t_end` s, `samples`, `excursion` signed), `n`, `removed` (samples), `unit` (of the levels), `note` (one line: "Removed 1 spike (1 samples): +7.000 Hz at t = 5.000 s ..."). The user's ESS algorithm (window s, trigger, max_step per s, settle). `signal`: "frequency" (levels in Hz; a p.u. frequency or speed is compared in Hz and keeps its p.u. values), "other" (the series' own unit), "auto" (Hz unit, or p.u. with a label naming fehz / m:fe / freq / speed, is a frequency; otherwise "other"). | `sig.despike` (outputs `series` `.series`, `n` `.n`, `note` `.note`) |
| `nadir` | `nadir(series, t_event=None, nominal=None, delay=0.0, window=10.0, min_recovery=0.05, tail_guard=1.0, floor_below=5.0, ufls_below=1.0, requires_ufls=True, extend_to=None)` | `SigResult`: `value`, `time` (Hz, s; `None` unless NADIR), `turned` (a NADIR that recovered at least `min_recovery`), `verdict` NADIR / COLLAPSE / NO DATA, `ufls` TRUE / FALSE / UNDEFINED, `minimum`, `min_time` (the minimum the verdict rests on, also for COLLAPSE), `lowest`, `lowest_time` (lowest sample after the event), `still_falling`, `recovery` (Hz), `nominal`, `floor`, `ufls_level` (Hz), `t_event`, `reason`. Floor and UFLS level are below nominal (45 / 49 Hz at 50 Hz, 55 / 59 Hz at 60 Hz); `None` turns one off. `extend_to`: the horizon the run block extends an undecided run to; a run that reached it and is still falling above the UFLS level gives FALSE, otherwise UNDEFINED. A minimum at the end of the run (39-bus demo) is COLLAPSE + still_falling. | `sig.nadir` (nadir `.value`, time `.time`, turned around `.turned`, verdict `.verdict`, ufls `.ufls`, minimum `.minimum`, still falling `.still_falling`, recovery `.recovery`) |
| `peak` | `peak(series, kind="max", after=None, before=None)` | `SigResult`: `value`, `time` (first time it occurs), `kind`, `n`, `reason`. kind `max`, `min`, `abs` (furthest from zero, sign kept). | `sig.peak` |
| `settling` | `settling(series, band=10.0, band_mode="pct", hold=1.0, reference="final", target=None, t_event=None, guard=1.0)` | `SigResult`: `settles` (True / False, `None` with no data), `time` (s after t_event, `None` unless settled), `at` (the settling instant, s), `initial` (last sample before t_event), `final` (mean of the last `hold` s, or `target` with reference "given"), `step`, `band` (absolute half-width used), `rise_time` (10 % to 90 % of the step, s), `overshoot_pct` (beyond final in the step's direction, % of the step), `t_event`, `reason`. Band: `band_mode` "abs" (series unit) or "pct" (% of the step). The settling instant is the LAST time the signal leaves the band after t_event; still outside the band within the last `guard` s means not settled ("still moving"). | `sig.settle` |
| `rocof` | `rocof(series, t_event=None, nadir_time=None, verdict=None, window=0.5, fallback="window", search_window=10.0, nominal=None, absolute=False, decimals=4)` | `SigResult`: `value` (Hz/s, signed: a fall is negative, rounded to `decimals`), `time` (start of the steepest window, s), `t1`, `f1`, `t2`, `f2` (window ends, s and Hz), `basis` (nadir / window / tstop, "/short" when the interval is shorter than the window: the average slope, an under-reading), `reason`. The user's exact rolling-window algorithm from t_event to the nadir. `verdict` may be the whole `nadir` result (its time is used) or its text; with neither nadir_time nor verdict it works out the nadir itself and logs it. Not a NADIR: to t_event + `search_window` ("window", when the run is that long), else the last sample ("tstop"); fallback "none" gives no value. | `sig.rocof` (inputs t_event, nadir time, verdict) |
| `value_at` | `value_at(series, t)` | Number or `None` (outside the record). Linear interpolation; at an event instant with two samples, the first (the value just before). | `sig.at` |
| `final_value` | `final_value(series, last=0.0)` | The last value, or the mean of the last `last` s. `None` with no samples. | `sig.final` |
| `first_cross` | `first_cross(series, level, direction="above", after=None, hold=0.0)` | `SigResult`: `time` (s, interpolated), `delay` (time - after, s), `found` (True / False, `None` with no data), `level`, `after`, `reason`. direction "above" (value >= level) or "below" (<=). It must stay beyond the level `hold` s; a crossing whose hold runs past the end of the run does not count. | `sig.cross` |
| `check_limits` | `check_limits(x, lo=None, hi=None, curve=None, x0=0.0, xs=None, after=None, before=None, extend=False)` | `SigResult`: `ok` (True / False / `None`), `text` PASS / FAIL / NO DATA, `margin` (smallest distance inside the limits; negative when broken; value's unit), `at` (time for a series, x for xs, else the 1-based position of the worst point), `worst` (value there), `limit` (the limit nearest it), `n`, `n_fail`, `first_fail`, `reason`. x: a number, a list or a Series. Curve: rows `(x, low, high)` (lists or dicts with x / low / high; low or high may be `None`), x relative to `x0` (a series: t - x0; a value or list: `xs` - x0), linear between rows, two rows at one x make a step (the stricter applies at that x), points outside the curve's range not checked unless `extend` (the last row holds). A value exactly on a limit passes. | `chk.limit` (branch on `.ok`; None takes Fail and logs NO DATA) |
| `verdict` | `verdict(value, op=">=", limit=None, tol=0.0)` | `SigResult`: `ok` (True / False / `None`), `text` PASS / FAIL / NO DATA, `value`, `limit`, `op`, `margin`. op `>`, `>=`, `<`, `<=`, `=` (within tol), `!=`, "is true", "is false" (also the signs and gt / ge / lt / le / eq / ne). A list or a series passes only when every value does. | `chk.verdict` |
| `combine_series` | `combine_series(series_list, how="sum")` | A `Series`: sum, mean, min, max or spread (max - min) at each instant; same time base sample by sample, else interpolated onto every time point inside the range all cover. Events merged, unit kept when shared. Empty inputs left out with a warning. | `sig.series` combine for lists, `pf.rms` Record rows (when combining outside the run) |

## outputs.py

| Section | Signature | Returns, notes | Block |
|---|---|---|---|
| `plot_common` | private | Agg backend, palette, watermark, saving. | (needed by the others) |
| `plot_series` | `plot_series(series, labels=None, title="", ylabel="", unit=None, limits=None, marks=None, t_event=None, events=True, note="", stem=None, context=True, xlabel="Time (s)")` | PNG path or `None`. One line per Series (up to 8 in the categorical colours, more on one blue ramp in order). `unit` defaults to the series' shared unit; y axis "Frequency (Hz)". `limits`: numbers, `(value, label)` or `{"value", "label"}` (dashed, labelled on the right). `marks`: `(t, y)`, `(t, y, label)`, `{"t", "y", "label"}` or a check result with `time` / `value` (a COLLAPSE nadir is marked at its minimum). Dotted vertical lines at every series event (labelled) and at `t_event`. `note`: footnote (for example `despike(...).note`). | `out.plot.series` (one graph per pass) |
| `collect_series` | `collect_series(key, series, label=None)`; `draw_collected(key, title="", ylabel="", unit=None, limits=None, marks=None, t_event=None, events=True, note="", stem=None, xlabel="Time (s)")` | `collect_series` keeps the pass's series under `key` (label default: the loop values, plus the series label when a pass gives several) and returns how many are kept; `draw_collected`, called after the loop, draws them all on one graph and forgets them (so an outer loop starts a fresh graph). Returns the path, or `None` with a warning when nothing was kept. Use the block's node id as `key`. | `out.plot.series` (every pass on one graph) |
| `plot_xy` | `plot_xy(x, ys, labels=None, kind="line", title="", xlabel="", xunit="", ylabel="", yunit="", limits=None, stem=None, context=True)` | PNG path or `None`. kind line / scatter / bar. `x` numbers or names (names: one tick each, in order). `ys` one list, several lists, Series, or `{label: list}`. Lengths cut to the shorter with a warning; missing values leave gaps. | `out.plot.xy` |
| `plot_3d` | `plot_3d(x, y, z, kind="surface", title="", xlabel="", xunit="", ylabel="", yunit="", zlabel="", zunit="", stem=None, context=True)` | PNG path or `None`. x, y, z as three equal lists of points (table columns) or z as rows over x and y. kind "surface" / "wireframe" when the points fill a whole grid (repeated points averaged), else (or kind "scatter") dots coloured by z, with a log line saying why. | `out.plot.3d` |
| `plot_heatmap` | `plot_heatmap(x, y, z, title="", xlabel="", xunit="", ylabel="", yunit="", zlabel="", zunit="", stem=None, context=True, annotate=None)` | PNG path or `None`. Cells from (x, y, z) points (averaged; missing cells blank) or z rows; x and y numbers or names; colour bar "zlabel (zunit)"; values written in the cells when there are at most 150 (or `annotate`). | `out.plot.heatmap` |
| `plot_table` | `plot_table(name, x, ys, kind="line", group=None, title="", xlabel="", ylabel="", yunit="", limits=None, stem=None)` | PNG path or `None`. Columns `ys` (a name or a list) of results table `name` against column `x`; `group`: a column whose values give one line each ("Case = High"). Rows without x are left out; a skipped pass's empty cell is a gap; numeric x sorted. Does not create a table that does not exist. | `out.plot.table` |
| `plot_convergence` | `plot_convergence(history, kind="auto", title="", ylabel="", unit="", stem=None)` | PNG path or `None`. `history`: an `OptResult` / `LimitResult` or its `.history`. "optimise": score per try (dots; not-a-candidate tries hollow; failed or no-score tries as red x along the bottom) and the best so far (step line). "limit": the value tried per step coloured pass (green) / fail (red) / unknown (grey), the bracket as a band, the limit as a dashed line. "auto" picks from the history. | `out.plot.conv` |
| `save_series_csv` | `save_series_csv(series, labels=None, stem=None)` | CSV path or `None`, in `<run folder>/series/`, UTF-8 with BOM (Excel). Same time base: one "Time (s)" column plus one column per series ("Bus 16 m:fehz (Hz)"); otherwise a time column next to each series. Values as recorded (repr floats, no interpolation, no comment line). | `out.series.save` |

## optimise.py

| Section | Signature | Returns, notes | Block |
|---|---|---|---|
| `search_common` | `SearchResult(**fields)` | Base of the two results (attribute and key access). Private helpers for one try. | (needed by the others) |
| `optimise` | `optimise(fn, variables, goal="min", method="de", max_tries=30, seed=1, grid_steps=5, label="Optimise")` | `OptResult`: `best` (`{name: value}`, `None` when no try was a candidate), `values` (best values in variable order), `best_score` (as reported, also when maximising), `best_trial`, `found`, `status` DONE / STOPPED / NO CANDIDATE, `history` (per try: `try`, `values`, `score`, `ok`, `failed`, `candidate`, `best` so far, `note`), `tries`, `method` (the one used), `goal`, `message`. `fn(*values)` is the generated `try_nN` and returns a Trial (a plain number is taken as a score, True / False as pass / fail). `variables`: `[{name, lower, upper, integer}]`. Not a candidate: failed, no score, or ok False; the method sees a score worse than every candidate so far. Methods: de (differential evolution, popsize sized to the budget, no polish), nelder (simplex a quarter of each range), powell, bounded (one variable; more: Nelder-Mead with a warning), grid (`grid_steps` per variable, cut to fit `max_tries` with a warning), bayes (scikit-optimize ask / tell; falls back to de). `max_tries` counts real tries; the same values are never tried twice (integer variables are rounded first). Ends early when a try asks to stop. One log line per try. | `opt.optimise` (Done outputs: best values `.best["<name>"]` or `.values[k]`, best score `.best_score`, history `.history`) |
| `find_limit` | `find_limit(fn, lower, upper, tol, max_steps=20, passes="low", bracket="given", on_unknown="stop", label="Value", integer=False)` | `LimitResult`: `limit` (the last passing value: always a value that was tried and passed; `None` when nothing passed), `found` (True only for DONE), `passing`, `failing` (final bracket), `status` DONE / ALL PASS / ALL FAIL / INCONSISTENT / MAX STEPS / STOPPED / UNKNOWN, `history` (per step: `step`, `value`, `result` pass / fail / unknown, `counted`, `ok`, `score`, `passing`, `failing`, `note`), `steps`, `tol`, `passes`, `label`, `message`. `fn(value)` returns a Trial: pass when ok is True, fail when False, unknown otherwise (no report, UNDEFINED, failed try). passes "low": low values pass (largest dispatch); "high": high values pass (smallest headroom). bracket "given": both bounds first (both pass: ALL PASS with limit = the far bound; both fail: ALL FAIL; the passing side fails and the other passes: INCONSISTENT), then bisect until the bracket is within tol. bracket "halve": the passing bound first (it fails: ALL FAIL), then halve towards the failing bound until a value fails, then bisect; never tries the failing bound itself (ALL PASS when within tol of it). on_unknown "stop" (status UNKNOWN), "fail" or "pass" (counted as that). `max_steps` counts every try, both bounds included (at least 2). `integer`: whole values, tol at least 1. Midpoints are rounded to 3 digits below tol for readable tables. | `opt.limit` (Done outputs: limit `.limit`, found `.found`, status `.status`, passing `.passing`, failing `.failing`, history `.history`) |

Both searches re-raise `StopWorkflow` and `KeyboardInterrupt` from a try and catch anything
else (logged as an error, the try counts as failed / unknown), so a try function written without
its own `except` still cannot end the search. The generated `try_nN` already catches, marks the
Trial failed and puts the model back, which is what makes every try start from the same model.

## Notes for block authors (wave 2)

- `sig.nadir` emits `nadir(<series>, t_event=<t_event or None>, nominal=<nominal>, delay=..., window=..., min_recovery=..., tail_guard=..., floor_below=<floorBelow>, ufls_below=<uflsBelow>, extend_to=<the run's extend to, or None>)`. Store `floorBelow` / `uflsBelow` as deviations (frozen keys; the inspector shows "= 45.0 Hz at 50 Hz").
- `sig.rocof` wires `verdict` from the whole nadir result when it can (`rocof(s, verdict=nadir_n5)`): one input carries both the verdict and the nadir time.
- `chk.limit` and `chk.verdict` branch on `r.ok is True` for Pass; `None` takes Fail and the block logs "NO DATA" (DESIGN 9, E7).
- `out.plot.series` in "every pass on one graph" mode: `collect_series("<nodeId>", <series list>)` on the Each pass route and `draw_collected("<nodeId>", ...)` in the loop's `after` lines.
- `opt.report` writes `trial.report(score=<score or None>, ok=<pass or None>)`; `pass` may be a bool, None or TRUE / FALSE / UNDEFINED text (Trial handles all three).
- `opt.limit` call line: `search_nN = find_limit(try_nN, <lower>, <upper>, <tol>, max_steps=<n>, passes=<"low"|"high">, bracket=<"given"|"halve">, on_unknown=<"stop"|"fail"|"pass">, label=<variable label>)`.
- `opt.optimise` call line: `search_nN = optimise(try_nN, [{"name": ..., "lower": ..., "upper": ..., "integer": ...}, ...], goal=<"min"|"max">, method=..., max_tries=..., label=<block label>)`; the variable names must equal the Trial labels.
- The despike note belongs in the graph footnote (`note=`) and, when wanted, a table column.

## Tests

`python powerfactory-scripter/builder/_audit/runtime/analysis/test_analysis.py` (from the repo
root; about 25 s). It loads base.py and the three analysis files through the Builder's section
rules, runs the static audit of `_audit/runtime/live/loader.py` on them, loads every section alone,
checks stat, despike, nadir (recover, collapse, still falling, shallow, 60 Hz, p.u., UNDEFINED),
settling, RoCoF (exact on a piecewise-linear trace, short interval, fallbacks), the value checks,
limits with a curve, every graph (typical and empty inputs, the watermark is a PathPatch), every
optimise method on a quadratic, find_limit in every status, the real 39-bus and Nine-bus traces,
and a standalone script built the way the Builder copies helpers into one file.
Prints `analysis runtime tests: N passed, M failed`.
