# PowerFactory-Scripter — Audits

Two harnesses live here:

| Script | Needs PowerFactory? | Checks |
|---|---|---|
| `audit_nine_bus_system.py` | Yes (live instance + Nine-bus System) | every PowerFactory API call and pattern the generator emits |
| `audit_custom_functions.py` | No (plain CPython) | the pre-made Custom Calculation library in `../custom-functions.js` |

---

## 1. Full API audit — `audit_nine_bus_system.py`

`audit_nine_bus_system.py` is a standalone smoke-test that exercises **every
PowerFactory Python-API call, pattern and result-handling assumption** the
[PowerFactory Scripter](https://tool.adjiebrotots.com/powerfactory-scripter)
code generator emits — run against a live PowerFactory instance with the
bundled **Nine-bus System** demo project.

It does **not** import any generated script. It independently re-implements
each API "anchor" (see [`../README.md` §15](../README.md) and
[`../pf-script-builder.js`](../pf-script-builder.js)) and prints a numbered
**checkpoint** for each, mapped (`-> builder fn`) to the generator function it
validates. A failure therefore tells you *exactly* which generated Python
pattern is broken on your PowerFactory build.

## How to run

1. Open `audit_nine_bus_system.py` and edit the **CONFIG** block:
   ```python
   API_PATH     = r"C:\Program Files\DIgSILENT\PowerFactory 2024\Python\3.12"
   PROJECT_NAME = "Nine-bus System"
   USERNAME     = ""          # leave blank to connect as the current user
   RUN_RMS      = True        # run the dynamic-RMS + ElmRes smoke test
   RMS_TSTOP    = 1.0         # keep small so the audit is fast
   ```
2. Make sure the **Nine-bus System** project exists and PowerFactory is
   licensed for engine mode. (`pandas`/`numpy` should be installed into
   PowerFactory's Python — the generated scripts need them; checkpoint 0.4
   verifies this.)
3. Run with PowerFactory's bundled Python:
   ```bat
   "C:\Program Files\DIgSILENT\PowerFactory 2024\Python\3.12\python.exe" audit_nine_bus_system.py
   ```
4. **Copy the entire terminal output back to the chat.** Each checkpoint is
   `PASS` / `WARN` / `SKIP` / `FAIL`; failures include a full traceback, and the
   summary at the end re-lists every non-`PASS` line for easy pasting.

## What it checks (by phase)

| Phase | Validates | Generator anchor |
|---|---|---|
| 0 | `import powerfactory`, `GetApplication(Ext)`, current user, pandas/numpy/optional deps | `buildImports`, `buildPreparation` |
| 1 | project list + `Activate()`, study-case & operating-scenario folder lookup, `GetActive*`, `Show`/`Hide` | `buildPreparation`, `buildProjectSelection`, `get_study_cases`, `get_operating_scenarios`, `buildChecks` |
| 2 | `GetCalcRelevantObjects` (counts vs the demo), exact-name queries, equipment type library | `get_pf_objects`, `get_type_objects` |
| 3 | `GetAttribute` / `SetAttribute` round-trips, `outserv` trip, identity methods | input loop, contingency loop |
| 4 | `ComLdf.Execute`, bus/line/gen result reads vs the PDF, scalar-vs-dict return shapes | `run_study_steady_state`, `extract_attribute_output` |
| 5 | trip → rerun → restore | contingency loop |
| 6 | `ComHldf.Execute` (optional) | `run_study_harmonic` |
| 7 | full dynamic-RMS path: `ComInc`/`ComSim`, `AddVariable`, `ZeroDerivative`, `ElmRes` `Load`/`FindColumn`/`GetValue`/`Release`, `GetValue` tuple shape, metrics, native max/min | `run_study_dynamic_rms`, `ensure_elmres_variables`, `_read_elmres_inmemory`, `calculate_timeseries_metric` |
| 8 | restore original study case + summary | cleanup |

## Safety

* **Non-destructive.** Every attribute it changes (`outserv`, `pgini`, command
  fields) is restored, and the originally-active study case is reactivated.
* It never calls `CommitTransaction()`, so nothing is written to the database.
* The RMS phase may register a couple of monitor variables on the study-case
  `ElmRes` (harmless, not committed). For a perfectly pristine project, just
  don't save when PowerFactory exits.

## Reading the result

* **PASS** — the API call/pattern works on your build.
* **WARN** — it ran but the result was unexpected (e.g. a bus voltage off the
  PDF value, a missing optional dependency, no harmonic sources). Usually a
  model/config note, not a generator bug.
* **SKIP** — a precondition wasn't met (e.g. load flow didn't converge, so the
  result-read checkpoints were skipped).
* **FAIL** — the API call raised or returned a value the generated code does not
  expect. The traceback + the `-> builder fn` mapping point straight at the
  generator code to fix.

---

## 2. Custom function library audit — `audit_custom_functions.py`

Checks every entry in [`../custom-functions.js`](../custom-functions.js), the pre-made bodies the
Scripter offers above each Custom Calculation editor and the Samples page lists. It needs no
PowerFactory and no network:

```sh
python3 audit_custom_functions.py
```

It exits non-zero on the first failure and prints `PASS` / `FAIL` per checkpoint, in four phases:

| Phase | Validates |
|---|---|
| 1 Shape | one top-level `def` per entry, name and arguments matching the metadata, no `*args`, no defaults, no tuple return, every path returning, a docstring, and every constant the picker offers as tunable actually present in the body |
| 2 Generator | the def line parses with the same regular expression `buildCustomFunctionHelpers()` uses, reads back the same arguments, and no `return` trips `hasMultipleReturnValues()` in `script.js` |
| 3 Robustness | every function survives all of its arguments arriving as `None` (what the generated script passes for a result it could not read) and still returns a scalar |
| 4 Behaviour | hand-calculated cases per function, for example 100 MW at 80 % loading leaving 25 MW of thermal headroom, and the capacitor sizing function landing exactly on a 0.95 power factor |

Run it after adding or editing an entry in `CUSTOM_FN_LIBRARY`.
