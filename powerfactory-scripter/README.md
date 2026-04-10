# PowerFactory Code Generator — Technical README

> **File:** `powerfactory_generator.html`  
> **Type:** Single-page HTML/CSS/JavaScript application (no build step, no backend, no framework)  
> **Purpose:** Collects PowerFactory study configuration from a user and deterministically assembles PowerFactory Python scripts from fixed template blocks.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [File Structure](#2-file-structure)
3. [UI Layout and Sections](#3-ui-layout-and-sections)
4. [Data Model (Config Object)](#4-data-model-config-object)
5. [JavaScript Module Map](#5-javascript-module-map)
   - 5.1 [Reactive UI Functions](#51-reactive-ui-functions)
   - 5.2 [Dynamic Table Managers](#52-dynamic-table-managers)
   - 5.3 [Config Read / Load / Validate](#53-config-read--load--validate)
   - 5.4 [Code Builder Functions](#54-code-builder-functions)
   - 5.5 [Master Generator](#55-master-generator)
   - 5.6 [File I/O Functions](#56-file-io-functions)
6. [Code Generation Pipeline](#6-code-generation-pipeline)
7. [Template Block Reference](#7-template-block-reference)
8. [Conditional Logic Map](#8-conditional-logic-map)
9. [Output Variable Type Behaviour](#9-output-variable-type-behaviour)
10. [Optimisation Mode Details](#10-optimisation-mode-details)
11. [Adding a New Feature — Step-by-Step Guide](#11-adding-a-new-feature--step-by-step-guide)
12. [Known Extension Points](#12-known-extension-points)
13. [External Dependencies](#13-external-dependencies)
14. [PowerFactory API Anchors Used](#14-powerfactory-api-anchors-used)

---

## 1. Architecture Overview

The generator is a **deterministic template engine**, not an AI text generator. Its only job is:

```
User fills form  →  readConfig()  →  validateConfig()  →  build*() functions  →  concatenate sections  →  preview
```

All generated Python code comes from **fixed string templates** inside the JavaScript builder functions. User inputs only fill named placeholders within those templates. The page never free-writes Python.

**Key design constraint:** adding a new generated feature means adding a new `build*()` function (or extending an existing one) with a hard-coded template string — never adding freeform logic.

---

## 2. File Structure

The entire application is one HTML file with three embedded layers:

```
powerfactory_generator.html
│
├── <head>
│   ├── Google Fonts import (IBM Plex Sans + IBM Plex Mono)
│   ├── Ace.js CDN (Python syntax highlighting in custom function editors)
│   └── Highlight.js CDN (syntax highlighting in the code preview panel)
│
├── <style>  ── all CSS
│   ├── CSS custom properties (design tokens)
│   ├── Layout: header, .layout grid, .left-pane, .right-pane
│   ├── Section cards (.section-card, .section-header, .section-body)
│   ├── Form elements (inputs, selects, checkboxes)
│   ├── Dynamic tables (.dyn-table)
│   ├── Button variants (.btn-primary, .btn-success, .btn-ghost, etc.)
│   ├── Output variable items (.output-var-item)
│   └── Code preview panel (#code-preview)
│
├── <body>
│   ├── <header>  — top bar + mode badges
│   ├── .layout
│   │   ├── .left-pane  — 7 collapsible section cards (all form inputs)
│   │   └── .right-pane — toolbar buttons + code preview panel
│   └── #copy-toast
│
└── <script>  ── all JavaScript
    ├── Global state
    ├── Section toggle
    ├── Reactive UI handlers
    ├── Dynamic table managers (input vars, output vars, constraints)
    ├── Config read / load / validate
    ├── Code builder functions (one per generated section)
    ├── Master generateCode()
    └── File I/O (copy, download, export/import JSON, reset)
```

---

## 3. UI Layout and Sections

The page uses a **two-column CSS grid** (`grid-template-columns: 540px 1fr`):

| Column | Content |
|---|---|
| Left (540 px, scrollable) | All input forms in 7 collapsible section cards |
| Right (remaining width) | Toolbar buttons + syntax-highlighted code preview |

### Section Cards

Each section card has a header (click to collapse/expand) and a body. The toggle state is managed by `toggleSection(id)` which flips CSS classes `.collapsed` / `.hidden`.

| # | Section ID | Always visible? | Shown when |
|---|---|---|---|
| 01 | `sec-init` | ✓ | Always |
| 02 | `sec-proj` | ✓ | Always |
| 03 | `sec-inputs` | ✓ | Always |
| 04 | `sec-custom` | ✗ | `problemType === 'custom'` |
| 05 | `sec-outputs` | ✓ | Always |
| 06 | `sec-optim` | ✗ | `problemType === 'optimisation'` |
| 07 | `sec-addl` | ✓ | Always |

Conditional visibility is driven by the `.cond-hidden` CSS class (`display: none !important`), toggled by `onProblemTypeChange()`.

---

## 4. Data Model (Config Object)

`readConfig()` returns a single plain JavaScript object. This is the canonical config schema:

```javascript
{
  initialisation: {
    powerfactoryApiPath: "",   // string — sys.path.append target
    username: "",              // string — pf.GetApplication(username)
    outputDir: "",             // string — CSV output directory
    problemType: "brute_force" // "brute_force" | "optimisation" | "custom"
    studyType: "steady_state", // "steady_state" | "dynamic_rms" | "dynamic_emt" | "harmonic"
    codingStyle: "python_file",// "python_file" | "notebook"
    tstop: "20",               // string — used for dynamic_rms / dynamic_emt only
  },

  projectSelection: {
    useProjectFolder: false,   // boolean — folder-first vs direct listing
    projectFolderIndex: "",    // string integer or "" for prompt
    projectIndex: "",          // string integer or "" for prompt
  },

  inputVariables: [            // array of input variable rows
    {
      object_query: "",        // e.g. "WFController.ElmDsl"
      variable: "",            // e.g. "K_droop"
      lower: "0",              // string number
      upper: "10",             // string number
      step: "0.5",             // string number — increment (not count)
      dtype: "float",          // "float" | "int" | "str"
    }
  ],

  outputVariables: [           // array of output variable items
    {
      id: "ov-0",              // internal DOM id (auto-generated)
      type: "attribute",       // "attribute" | "timeseries" | "custom_calculation"
      name: "",                // Python-safe name (sanitized if needed)
      object_query: "",        // e.g. "RENEWABLES-132kV(1).ElmTerm"
      variable: "",            // e.g. "m:THD"
      metric: "maximum",       // used for timeseries and custom_calculation
      threshold: "",           // used for frequency/first_time metrics
      settle_band: "",         // used for time_settle metric
      settle_hold_time: "",    // used for time_settle metric
      settle_reference_value: "",// used for time_settle metric
      customFn: "",            // used for custom_calculation — full Python function text
    }
  ],

  optimisation: {
    sense: "minimise",         // "minimise" | "maximise"
    objectiveOutputName: "",   // must match one output variable name
    algorithm: "placeholder",  // "placeholder" | "scipy_minimize" | "differential_evolution" | "gp_minimize"
    maxIterations: 50,         // integer
    constraints: [
      {
        output: "",            // output variable name
        operator: ">=",        // ">=" | "<=" | "=="
        value: "",             // string number
      }
    ],
  },

  customMode: {
    scenarioFilePath: "",      // path to .xlsx or .csv scenario file
    sheetName: "",             // Excel sheet name
  },

  additionalConfig: {
    iterateStudyCases: false,       // boolean
    iterateOperatingScenarios: false,// boolean
    useProgressBar: true,           // boolean — adds tqdm import + wraps loop
    openPowerFactoryWindow: false,   // boolean — app.Show() vs app.Hide()
    saveIntermediateEnabled: false,  // boolean
    saveIntermediateMinutes: 30,     // integer
  }
}
```

This object is also the schema for **JSON export/import**. Any change to this schema requires updating both `readConfig()` and `loadConfig()`.

---

## 5. JavaScript Module Map

### 5.1 Reactive UI Functions

These functions respond to form changes and update conditional visibility and header badges.

| Function | Trigger | What it does |
|---|---|---|
| `onProblemTypeChange()` | `#problem-type` change | Shows/hides `sec-custom` and `sec-optim`; updates `#badge-problem`; calls `refreshObjectiveDropdown()` if optimisation |
| `onStudyTypeChange()` | `#study-type` change | Shows/hides `#row-tstop`; sets default tstop value; updates `#badge-study` |
| `coding-style` listener | `#coding-style` change | Updates `#badge-style` |
| `onProjectFolderToggle()` | `#use-project-folder` change | Shows/hides `#row-folder-index` |
| `onSaveIntermediateChange()` | `#save-intermediate` change | Shows/hides `#row-save-interval` |
| `onOutputTypeChange(id)` | Per-output-var type dropdown | Shows/hides metric, threshold, settle params, custom fn editor for that output var |
| `onMetricChange(id)` | Per-output-var metric dropdown | Shows/hides threshold row and settle rows based on selected metric |
| `onOutputNameChange()` | Per-output-var name input | Calls `refreshObjectiveDropdown()` to keep objective selector in sync |
| `toggleSection(id)` | Section header click | Collapses/expands section body |
| `refreshObjectiveDropdown()` | Called by multiple | Rebuilds the `#optim-objective` select from current output variable names |

### 5.2 Dynamic Table Managers

**Input Variables Table (`#input-tbody`)**

| Function | Description |
|---|---|
| `addInputRow(data = {})` | Appends a new `<tr>` to `#input-tbody`. Accepts optional `data` object to pre-fill from config load. Uses `inputRowCounter` for unique IDs. |
| `getInputRows()` | Reads all input rows from DOM, returns array of row objects matching the `inputVariables` schema. |
| `removeRow(id)` | Generic — removes any `<tr>` by element ID. Used by input rows and constraint rows. |

**Output Variables Container (`#output-vars-container`)**

Output variables are rendered as full `.output-var-item` div cards, not table rows, because each type has very different fields.

| Function | Description |
|---|---|
| `addOutputVar(data = {})` | Creates a new `.output-var-item` div, appends to container. Calls `initAceEditor(id)` if type is `custom_calculation`. Uses `outputVarCounter` for unique IDs. |
| `buildOutputVarHTML(id, data, type)` | Returns the full inner HTML string for one output variable card. All field visibility logic (`.cond-hidden`) is set here at creation time; `onOutputTypeChange` and `onMetricChange` update it afterward. |
| `removeOutputVar(id)` | Removes the output var div, destroys its Ace editor if present, refreshes objective dropdown. |
| `getOutputVars()` | Reads all output vars from DOM, returns array matching `outputVariables` schema. Reads Ace editor content via `aceEditors[id].getValue()`. |
| `initAceEditor(id, initialValue)` | Creates an Ace editor inside `#${id}-ace` with Python mode and dark theme. Stored in `aceEditors` map. Uses `setTimeout` to ensure DOM is ready. |

**Constraint Table (`#constraint-tbody`)**

| Function | Description |
|---|---|
| `addConstraint(data = {})` | Appends a new constraint row. Populates output variable dropdown from current `getOutputVars()`. Uses `constraintCounter` for unique IDs. |
| `getConstraints()` | Reads all constraint rows, returns array matching `optimisation.constraints` schema. |

### 5.3 Config Read / Load / Validate

| Function | Description |
|---|---|
| `readConfig()` | Reads all form fields and dynamic tables, returns the canonical config object. This is the single source of truth before code generation. |
| `loadConfig(cfg)` | Inverse of `readConfig()`. Accepts a config object and repopulates all form fields, dynamic tables, and Ace editors. Calls all reactive UI functions at the end to restore conditional visibility. Used by reset and JSON import. |
| `validateConfig(cfg)` | Returns an array of error strings. Returns empty array if valid. Does not modify the DOM — caller decides how to show errors. |
| `showValidationErrors(errors)` | Shows/hides `#validation-errors` panel. If errors array is empty, hides the panel. |
| `isPythonIdentifier(name)` | Returns `true` if name matches `/^[A-Za-z_][A-Za-z0-9_]*$/`. Used in validation. |
| `sanitizeName(name)` | Replaces non-identifier characters with `_`, prefixes leading digits. Used in code generation to produce safe Python variable names. |

### 5.4 Code Builder Functions

Each function takes the full `config` object (or a sub-part) and returns a Python code **string**. They never modify the DOM or global state.

**Execution order inside `generateCode()`:**

```
buildImports(cfg)
buildPreparation(cfg)
buildProjectSelection(cfg)
buildChecks(cfg)
buildCommonHelpers(cfg)
buildStudyHelper(cfg)
buildElmResHelpers(cfg)
buildCustomFunctionHelpers(cfg)
buildOutputDirSetup(cfg)
buildInputSpecs(cfg)
buildOutputSpecs(cfg)
buildProblemLoop(cfg)
buildOutputExport(cfg)
```

Each builder is documented in detail in [Section 7](#7-template-block-reference).

### 5.5 Master Generator

```javascript
function generateCode()
```

1. Calls `readConfig()` to get the config object.
2. Calls `validateConfig(cfg)`. If errors exist, calls `showValidationErrors()` and returns early.
3. Calls all builder functions in order, stores results in named variables.
4. If `codingStyle === 'notebook'`, groups sections into 7 cells and wraps with `buildNotebookWrapper(sections)`.
5. If `codingStyle === 'python_file'`, concatenates all sections and wraps with `buildPythonFileWrapper(body)`.
6. Stores final code in `window._generatedCode` for download functions.
7. Renders into `#code-preview` and calls `hljs.highlightElement()`.

### 5.6 File I/O Functions

| Function | Description |
|---|---|
| `copyCode()` | Copies `window._generatedCode` to clipboard via `navigator.clipboard.writeText()`. Shows toast. |
| `downloadPy()` | Downloads `window._generatedCode` as `powerfactory_script.py`. |
| `downloadTxt()` | Downloads `window._generatedCode` as `powerfactory_script.txt`. |
| `download(content, filename, type)` | Generic download helper — creates a Blob URL and triggers a click. |
| `exportConfigJSON()` | Reads current form via `readConfig()`, serializes to JSON, downloads as `powerfactory_config.json`. |
| `importConfigJSON(event)` | Reads a `.json` file from the file input, parses it, calls `loadConfig(cfg)`. |
| `resetForm()` | Confirms with user, calls `loadConfig()` with a hardcoded default config object, clears the code preview. |

---

## 6. Code Generation Pipeline

```
generateCode()
    │
    ├─ readConfig()          → cfg object
    ├─ validateConfig(cfg)   → errors[]   ── abort if non-empty
    │
    ├─ buildImports(cfg)             → sec1
    ├─ buildPreparation(cfg)         → sec2
    ├─ buildProjectSelection(cfg)    → sec3
    ├─ buildChecks(cfg)              → sec4
    ├─ buildCommonHelpers(cfg)       → sec5
    ├─ buildStudyHelper(cfg)         → sec6
    ├─ buildElmResHelpers(cfg)       → sec7   (empty if no timeseries outputs)
    ├─ buildCustomFunctionHelpers(cfg)→ sec8  (empty if no custom_calculation outputs)
    ├─ buildOutputDirSetup(cfg)      → sec9
    ├─ buildInputSpecs(cfg)          → sec10
    ├─ buildOutputSpecs(cfg)         → sec11
    ├─ buildProblemLoop(cfg)         → sec12
    └─ buildOutputExport(cfg)        → sec13
            │
            ├─ if codingStyle === 'notebook'
            │       buildNotebookWrapper([sec1+sec2, sec3+sec4, sec5+sec6+sec7+sec8,
            │                             sec9+sec10, sec11, sec12, sec13])
            │
            └─ if codingStyle === 'python_file'
                    buildPythonFileWrapper(all sections concatenated)
                    → wraps everything in def main() + if __name__ == "__main__":
```

The notebook wrapper groups sections into labelled cells:

| Cell | Sections grouped |
|---|---|
| Cell 1 — Preparation & Imports | imports + preparation |
| Cell 2 — Project Selection & Checks | project selection + checks |
| Cell 3 — Helper Functions | common helpers + study helper + ElmRes helpers + custom fn helpers |
| Cell 4 — Input Specs & Object Resolution | output dir setup + input specs |
| Cell 5 — Output Specs | output specs |
| Cell 6 — Problem Loop & Study Execution | problem loop |
| Cell 7 — Output Export | output export |

---

## 7. Template Block Reference

### `buildImports(cfg)`

Generates the import block. Conditionally includes:

- `from tqdm import tqdm` — if `additionalConfig.useProgressBar`
- `from scipy.optimize import minimize` — if algorithm is `scipy_minimize`
- `from scipy.optimize import differential_evolution` — if algorithm is `differential_evolution`
- `from skopt import gp_minimize` + supporting imports — if algorithm is `gp_minimize`

Always includes: `sys`, `os`, `time`, `traceback`, `itertools`, `datetime`, `powerfactory as pf`, `pandas`, `numpy`, and `sys.path.append(apiPath)`.

---

### `buildPreparation(cfg)`

Generates app connection and project/folder listing.

Two variants:
- **Direct** (`useProjectFolder === false`): lists `*.IntPrj` from user
- **Folder-first** (`useProjectFolder === true`): lists `*.IntFolder` from user

---

### `buildProjectSelection(cfg)`

Generates the project activation block.

Index resolution logic:
- If index is a non-empty string → use literal value
- If index is empty AND `codingStyle === 'python_file'` → emit `int(input("Enter ... index: "))`
- If index is empty AND `codingStyle === 'notebook'` → emit `PROJECT_INDEX_HERE` placeholder

Folder-first variant also emits a second listing of projects inside the chosen folder.

---

### `buildChecks(cfg)`

Always emits the checks block:
```python
print("Project: ", app.GetActiveProject())
print("Study Case: ", app.GetActiveStudyCase())
print("Operating Scenario: ", app.GetActiveScenario())
```

Followed by `app.Show()` or `app.Hide()` based on `openPowerFactoryWindow`.

---

### `buildCommonHelpers(cfg)`

Always emits: `safe_print`, `timestamp_string`, `ensure_output_dir`, `get_single_pf_object`, `build_range`.

Conditionally emits:
- `save_intermediate_results` — if `saveIntermediateEnabled`
- `get_study_cases` + `get_operating_scenarios` — if `iterateStudyCases` or `iterateOperatingScenarios`

---

### `buildStudyHelper(cfg)`

Emits exactly one study runner function based on `studyType`:

| `studyType` | Generated function | PF command objects used |
|---|---|---|
| `steady_state` | `run_study_steady_state(app)` | `ComLdf` |
| `harmonic` | `run_study_harmonic(app)` | `ComHldf` |
| `dynamic_rms` | `run_study_dynamic_rms(app, tstop=N)` | `ComInc` (`iopt_sim="rms"`), `ComSim` |
| `dynamic_emt` | `run_study_dynamic_emt(app, tstop=N)` | `ComInc` (`iopt_sim="ins"`), `ComSim` |

The `tstop` value comes from `cfg.initialisation.tstop`. Default: `20` for RMS, `0.25` for EMT.

---

### `buildElmResHelpers(cfg)`

Returns an empty string if no output variable has type `timeseries` or `custom_calculation`.

**Access strategy:** Direct `ElmRes` API — no CSV export/re-import. All result data is read in-memory using the PowerFactory Python API (ref §6.18, §8.5). This eliminates `ComRes`, disk I/O, and pandas dependency for the timeseries path.

Otherwise emits the following functions:

**`_load_elmres_column(res, obj_query, var_name)`**  
Internal helper. Resolves the PowerFactory object from `obj_query` (via `GetCalcRelevantObjects`), then calls `res.FindColumn(obj_ref, var_name)` (API ref §6.18) to locate the column index. Returns `-1` if not found. `FindColumn` accepts `None` as `obj_ref` to match by variable name only. The time axis is always column `0`.

**`_read_column_values(res, col_index)`**  
Internal helper. Reads all rows via `res.GetValue(row, col)` (API ref §6.18). `GetValue` returns `(errorCode, value)`; error code `0` means success. Non-zero error codes are stored as `float("nan")`. Returns a plain Python `list[float]`.

**`calculate_timeseries_metric(time_values, data_values, metric, ...)`**  
Takes plain Python lists (not pandas Series). Implements all 9 metrics. Maximum and minimum are **not** handled here — they are dispatched to native `ElmRes` methods in `extract_timeseries_outputs` (see below).

**`extract_attribute_output(app, object_query, variable_name)`**  
Resolves object via `GetCalcRelevantObjects` (API ref §3.3) and reads result via `GetAttribute` (API ref §5). Unchanged from original.

**`extract_timeseries_outputs(app, output_specs)`**  
Signature: `(app, output_specs)` — no `output_dir` or `run_id` arguments (no files written).

Dispatch logic:
1. `app.GetFromStudyCase("ElmRes")` — gets the active result object (API ref §8.5)
2. `res.Load()` — loads results into memory
3. Read time axis (column 0) once via `GetValue` row loop — shared across all output variables
4. For each timeseries output spec:
   - Resolve column via `GetCalcRelevantObjects` + `res.FindColumn(obj_ref, varName)`
   - If `col < 0` → record `NaN` and skip
   - **`maximum`** → `res.FindMaxInColumn(col)` returns `(err, value, rowIndex)`; time looked up with `GetValue(rowIndex, 0)` — no row scan
   - **`minimum`** → `res.FindMinInColumn(col)` — same pattern
   - **All other metrics** → `_read_column_values(res, col)` then `calculate_timeseries_metric(...)`
5. `res.Release()` — always called in `finally` block

**Why `FindMaxInColumn` / `FindMinInColumn` for max/min:**  
These are native `ElmRes` methods (API ref §6.18) that operate directly on the internal result buffer — no Python-level row iteration, no pandas. They return the value and the row index in one call, making them significantly more efficient than scanning all rows.

**Why `app.GetFromStudyCase("ElmRes")` instead of `GetCalcRelevantObjects("*.ElmRes")`:**  
The API reference §8.5 demonstrates `app.GetFromStudyCase("ElmRes")` as the canonical pattern for accessing the active study case result object. `GetCalcRelevantObjects("*.ElmRes")` would return all ElmRes objects in the network, requiring an index selection and potentially picking the wrong one.

---

### `buildCustomFunctionHelpers(cfg)`

Returns an empty string if no output variable has type `custom_calculation`.

For each custom calculation output variable:
1. Emits the user's function body from the Ace editor.
2. If the name was sanitized (e.g. contained spaces or illegal characters), emits a `# Name mapping:` comment.

Then emits the `evaluate_custom_calculations(base_result_row)` dispatcher function that calls each custom function with arguments looked up from the result row dict.

**Argument extraction:** The dispatcher parses the first `def` line of the user's function to extract argument names, then maps each to `base_result_row.get("argname", None)`.

---

### `buildOutputDirSetup(cfg)`

Emits:
```python
output_dir = r"..."
ensure_output_dir(output_dir)
```

---

### `buildInputSpecs(cfg)`

Emits the `input_specs` list literal with one dict per input variable row.

If `problemType === 'custom'`:
- Also emits `scenario_file_path` and `scenario_df = pd.read_excel(...)`.
- Does **not** emit `input_objects` / `input_ranges` (those are resolved inside the scenario loop).

Otherwise:
- Emits `input_objects = {}` and `input_ranges = {}` resolution loop.

---

### `buildOutputSpecs(cfg)`

Emits the `output_specs` list literal. Each dict includes only the keys relevant to its type:
- `attribute`: name, object_query, variable
- `timeseries`: adds metric, threshold (if set), settle params (if set)
- `custom_calculation`: name, object_query, variable (function body is in helpers, not spec)

---

### `buildProblemLoop(cfg)`

The most complex builder. Branches on `problemType`:

**`brute_force`:**
- Builds `all_combinations = list(itertools.product(*[input_ranges[i] ...]))`
- Wraps in optional study case / operating scenario loops (with correct indentation)
- Main loop optionally wrapped with `tqdm(...)`
- Inside try/except: sets input attributes, calls run study, collects attribute outputs, optionally calls timeseries + custom outputs, appends to `results_df`
- On exception: records `traceback.format_exc()` into error row
- Optionally calls `save_intermediate_results(...)` after each iteration

**`custom`:**
- Same structure but outer loop is `for _, scenario_row in scenario_df.iterrows()`
- Inside loop: reads each input value from `scenario_row[f"{object_query}.{variable}"]`

**`optimisation`:**
- Emits `evaluate_one_case(param_values)` wrapper function
- Branches on algorithm:
  - `gp_minimize`: emits `space = [...]`, `@use_named_args(space) def objective(**params)`, calls `gp_minimize(objective, space, n_calls=N)`
  - `differential_evolution`: emits `bounds = [...]`, `de_objective(param_values)`, calls `differential_evolution(...)`
  - `scipy_minimize`: emits `x0`, `bounds`, `minimize_objective(param_values)`, calls `minimize(...)`
  - `placeholder`: emits TODO comments with call signature

Constraint penalty logic:
- For each constraint: `if not (row.get("name") OP value): penalty += 1e6`
- `objective_value_adjusted = objective_value + penalty`
- If `sense === 'maximise'`: `return -(objective_value_adjusted)`

**Indentation handling for nested loops:**

The loop body indentation is computed based on how many outer wrappers are active:

```javascript
const indentSC = hasIterSC ? '    ' : '';
const indentOS = hasIterOS ? indentSC + '    ' : indentSC;
const indent   = indentOS + '    '; // inside the main combo/scenario loop body
```

---

### `buildOutputExport(cfg)`

Always emits:
```python
final_output_path = os.path.join(output_dir, f"Run{timestamp_string()}.csv")
results_df.to_csv(final_output_path, index=False)
print("Run complete.")
print(f"Final output: {final_output_path}")
print(f"Total attempted runs: {len(results_df)}")
```

---

### `buildNotebookWrapper(sections)`

Takes an array of 7 code strings, wraps each in a commented cell header:
```
# ╔══════════════════════════════════════════════════════════════╗
# ║ Cell N — Cell Title
# ╚══════════════════════════════════════════════════════════════╝
```

---

### `buildPythonFileWrapper(body)`

Indents all lines by 4 spaces and wraps in:
```python
def main():
    ...

if __name__ == "__main__":
    main()
```

---

## 8. Conditional Logic Map

This table summarises every conditional inclusion in the generator:

| Condition | What changes in generated code |
|---|---|
| `useProjectFolder === true` | Preparation uses `*.IntFolder`; Project selection includes folder index step |
| `projectIndex === ''` + python file style | `int(input("Enter project index: "))` instead of literal |
| `openPowerFactoryWindow === true` | `app.Show()` instead of `app.Hide()` |
| `studyType === 'dynamic_rms'` | `run_study_dynamic_rms` with `iopt_sim="rms"` |
| `studyType === 'dynamic_emt'` | `run_study_dynamic_emt` with `iopt_sim="ins"` |
| `studyType === 'harmonic'` | `run_study_harmonic` with `ComHldf` |
| `useProgressBar === true` | `from tqdm import tqdm` import; loop wrapped with `tqdm(...)` |
| Any output has type `timeseries` | Includes all ElmRes direct-API helpers (`_load_elmres_column`, `_read_column_values`, `calculate_timeseries_metric`, `extract_attribute_output`, `extract_timeseries_outputs`); no CSV or `ComRes` involved |
| Any output has type `custom_calculation` | Includes custom function helpers + evaluator |
| `saveIntermediateEnabled === true` | Includes `save_intermediate_results` helper + call inside loop |
| `iterateStudyCases === true` | Outer `for study_case in study_cases:` loop; includes `get_study_cases` helper |
| `iterateOperatingScenarios === true` | Outer `for op_scenario in operating_scenarios:` loop; includes `get_operating_scenarios` helper |
| `problemType === 'custom'` | Custom mode section visible; `scenario_df` input; scenario row loop |
| `problemType === 'optimisation'` | Optimisation section visible; `evaluate_one_case`; algorithm-specific optimizer call |
| `problemType === 'brute_force'` | `itertools.product` combination loop |
| `algorithm === 'gp_minimize'` | `skopt` imports; `space` definition; `@use_named_args` objective |
| `algorithm === 'scipy_minimize'` | `scipy.optimize.minimize` import; `x0`, `bounds` computation |
| `algorithm === 'differential_evolution'` | `scipy.optimize.differential_evolution` import; bounds |
| `optimisation.constraints.length > 0` | Penalty block inside objective function |
| `sense === 'maximise'` | `return -(objective_value_adjusted)` |
| `codingStyle === 'notebook'` | Code split into 7 labelled cells |
| `codingStyle === 'python_file'` | Code wrapped in `def main():` |
| Metric in `THRESHOLD_METRICS` | Threshold field shown in UI; `threshold=` included in output_spec |
| Metric is `time_settle` | Settle band / hold time / reference fields shown; included in output_spec |
| Output name requires sanitization | `# Name mapping:` comment emitted in custom function helpers |

---

## 9. Output Variable Type Behaviour

### Attribute

- UI fields shown: Name, Object Query, Variable
- UI fields hidden: Metric, Threshold, Settle params, Custom Function editor
- Generated: entry in `output_specs` with `type: "attribute"`; extracted via `extract_attribute_output()` inside the loop using `GetAttribute()`

### Timeseries

- UI fields shown: Name, Object Query, Variable, Metric dropdown
- Threshold shown only if metric is in `THRESHOLD_METRICS = ['frequency_above', 'frequency_below', 'first_time_above', 'first_time_below']`
- Settle params shown only if metric is `time_settle`
- Generated: entry in `output_specs` with metric and optional threshold/settle params; extracted via `extract_timeseries_outputs(app, output_specs)` using the direct ElmRes API path — no CSV file is written. `maximum` and `minimum` use native `res.FindMaxInColumn(col)` / `res.FindMinInColumn(col)`; all other metrics read rows via `res.GetValue(row, col)` and compute in pure Python

### Custom Calculation

- UI fields shown: all of the above + Ace.js Python function editor
- User writes a function body; generator includes it verbatim in the helper section
- `evaluate_custom_calculations()` parses the function signature to auto-construct the call using result row values
- Arguments must match names of previously defined output variables

---

## 10. Optimisation Mode Details

### Algorithm Variants

| Algorithm | Library | Generated call | Notes |
|---|---|---|---|
| `placeholder` | none | TODO comment | Wire up `evaluate_one_case` manually |
| `scipy_minimize` | `scipy.optimize` | `minimize(fn, x0, bounds=bounds, options={"maxiter": N})` | `x0` is midpoint of each range |
| `differential_evolution` | `scipy.optimize` | `differential_evolution(fn, bounds, maxiter=N, seed=42)` | Bounds from lower/upper of each input var |
| `gp_minimize` | `skopt` | `gp_minimize(fn, space, n_calls=N, random_state=42)` | Space uses `Real` or `Integer` based on dtype |

### Constraint Penalty

All constraints are handled with additive penalty (no hard constraint enforcement). Each violated constraint adds `1e6` to the objective. This is deterministic and works with all algorithm variants. The penalty block is placed before the `return` statement in the objective function.

### Sense

- `minimise` → `return objective_value_adjusted` (default for all scipy-family algorithms)
- `maximise` → `return -(objective_value_adjusted)` (negates to convert max to min problem)

---

## 11. Adding a New Feature — Step-by-Step Guide

### Example: Add a new study type

1. **Add the UI option.** In the `#study-type` select in `sec-init`, add a new `<option value="my_type">My Study Type</option>`.

2. **Update `onStudyTypeChange()`.** Add `my_type` to the labels map and any conditional logic (e.g. show tstop field).

3. **Add a builder in `buildStudyHelper(cfg)`.** Add an `else if (st === 'my_type')` branch that returns the fixed template string for your new study runner function.

4. **Update `buildRunStudyCall(cfg)`.** Add a branch that returns the inline call expression (e.g. `run_study_my_type(app)`).

5. **Update the badge label map** in `onStudyTypeChange()`.

No other changes needed.

---

### Example: Add a new output variable metric

1. **Add to `METRICS` array** at the top of the script.

2. **If it needs a threshold**, add its value to `THRESHOLD_METRICS`.

3. **If it needs settle params**, add its value to `SETTLE_METRICS` (this drives the settle param visibility).

4. **Add an `if metric === "my_metric":` branch** in `calculate_timeseries_metric()` inside `buildElmResHelpers(cfg)`. The function receives plain Python lists (`time_values`, `data_values`), not pandas Series. Return a `dict` of `{key: scalar}` pairs (e.g. `{"value": ..., "time": ...}`).

   If the metric maps naturally to a native `ElmRes` method (like `FindMaxInColumn` / `FindMinInColumn`), add a dedicated `if metric === "my_metric":` branch **inside `extract_timeseries_outputs`** before the generic `_read_column_values` fallback, calling the native method directly on `res`.

5. **Add the option** to the metric select built in `buildOutputVarHTML()`.

---

### Example: Add a new global checkbox option

1. **Add the checkbox HTML** to `sec-addl` section body.

2. **Add the field** to `readConfig()` under `additionalConfig`.

3. **Add the load** to `loadConfig(cfg)` to restore the checkbox state.

4. **Add conditional logic** in the relevant `build*()` function that reads `cfg.additionalConfig.myNewOption` and conditionally includes/excludes the corresponding template block.

---

### Example: Add a new optimisation algorithm

1. **Add the option** to `#optim-algorithm` select.

2. **Add imports** in `buildImports(cfg)` under the `optimisation` check.

3. **Add an `else if (alg === 'my_alg')` branch** in `buildProblemLoop(cfg)` inside the `optimisation` section. This branch should:
   - Define any space/bound variables.
   - Define the objective function wrapper.
   - Emit the algorithm call.

---

## 12. Known Extension Points

These are areas designed to be extended without restructuring the codebase:

| Area | Current state | How to extend |
|---|---|---|
| Study types | 4 types | Add option + branch in `buildStudyHelper` + `buildRunStudyCall` |
| Timeseries metrics | 9 metrics | Add to `METRICS`; if a native `ElmRes` method exists for it, add a dispatch branch in `extract_timeseries_outputs` before the generic fallback; otherwise implement in `calculate_timeseries_metric` |
| Optimisation algorithms | 4 (incl. placeholder) | Add option + import branch + loop branch in `buildProblemLoop` |
| Output variable types | 3 types | Requires changes to `buildOutputVarHTML`, `buildOutputSpecs`, loop body in `buildProblemLoop`, and a new extraction helper |
| Notebook cell structure | 7 cells | Rearrange section grouping in `buildNotebookWrapper` call inside `generateCode()` |
| Custom function validation | String-based | Replace or augment the current `customFn.trim().length < 5` check in `validateConfig` |
| Project index prompt text | Hardcoded English | Parameterize in `buildProjectSelection` |

---

## 13. External Dependencies

All loaded from CDN — no npm, no build step required.

| Library | Version | CDN URL | Purpose |
|---|---|---|---|
| Ace.js | 1.32.3 | `cdnjs.cloudflare.com/ajax/libs/ace/1.32.3/ace.js` | Python syntax highlighting in custom function editors |
| Highlight.js | 11.9.0 | `cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js` | Syntax highlighting in the code preview panel |
| Highlight.js CSS | 11.9.0 | `atom-one-dark.min.css` from same CDN | Dark theme for code preview |
| Google Fonts | — | `fonts.googleapis.com` | IBM Plex Sans + IBM Plex Mono |

**If CDNs are unavailable (air-gapped environments):**
- Download the four CDN assets and host them locally.
- Update the `<link>` and `<script>` `src` attributes to point to local paths.
- Ace.js is only needed for custom function editors; removing it just converts those editors to plain `<textarea>` elements.
- Highlight.js is only needed for the preview panel; removing it still shows correct code, just without syntax colouring.

**Python libraries required at runtime** (not bundled — must be installed in the Python environment that runs the generated script):

| Library | Required for |
|---|---|
| `powerfactory` | Always (via `sys.path.append`) |
| `pandas` | Always — final results DataFrame + CSV output; custom mode scenario file loading |
| `numpy` | Always — input range generation (`np.arange`) |
| `tqdm` | If `useProgressBar` enabled |
| `scipy` | If algorithm is `scipy_minimize` or `differential_evolution` |
| `scikit-optimize` (`skopt`) | If algorithm is `gp_minimize` |

> **Note:** `pandas` and `numpy` are no longer used inside the timeseries extraction path. The direct `ElmRes` API returns plain Python floats; all metric calculations use pure Python. `pandas` is still required for `results_df`, the final CSV export, and scenario file loading in Custom mode.

---

## 14. PowerFactory API Anchors Used

The following PowerFactory API calls appear in the generated code templates. These are the exact method names as defined in the DIgSILENT PowerFactory Python API reference (§ references below correspond to sections in that document).

| API Call | API Ref | Used in | Purpose |
|---|---|---|---|
| `pf.GetApplication(username)` | §2 | Preparation | Connect to running PowerFactory instance |
| `app.GetCurrentUser()` | §3.1 | Preparation | Get user object to list projects/folders |
| `user.GetContents("*.IntPrj")` | §5 | Preparation | List available projects |
| `user.GetContents("*.IntFolder")` | §5 | Preparation (folder-first) | List project folders |
| `project.Activate()` | §5 | Project selection | Activate the chosen project |
| `app.GetActiveProject()` | §3.1 | Checks | Verify active project |
| `app.GetActiveStudyCase()` | §3.2 | Checks | Verify active study case |
| `app.GetActiveScenario()` | §3.1 | Checks | Verify active operating scenario |
| `app.Show()` / `app.Hide()` | §3.1 | Checks | Control PF window visibility |
| `app.GetCalcRelevantObjects(query)` | §3.3 | Input resolution; attribute output; column resolution in ElmRes helpers | Resolve PF objects by class filter string |
| `app.GetFromStudyCase(classname)` | §3.2 | Study helpers; ElmRes access | Get or create object from active study case |
| `app.GetOutputWindow()` | §3.9 | Dynamic study helpers | Access output window for clearing before simulation |
| `outputWindow.Clear()` | §4 | Dynamic study helpers | Clear output window before each run |
| `comInc.iopt_sim = "rms"` | §3.2 | Dynamic RMS helper | Set simulation mode to RMS |
| `comInc.iopt_sim = "ins"` | §3.2 | Dynamic EMT helper | Set simulation mode to EMT (instantaneous) |
| `comInc.Execute()` | §3.2 | Dynamic study helpers | Initialize dynamic simulation |
| `comSim.tstop` | §3.2 | Dynamic study helpers | Set simulation stop time |
| `comSim.Execute()` | §3.2 | Dynamic study helpers | Run dynamic simulation |
| `comLdf.Execute()` | §3.2 | Steady state helper | Run load flow (`ComLdf`) |
| `comHldf.Execute()` | §3.2 | Harmonic helper | Run harmonic load flow (`ComHldf`) |
| `obj.GetAttribute(varname)` | §5 | Attribute output extraction | Read scalar result attribute from any DataObject |
| `setattr(obj, varname, value)` | — | Input variable setting in loop | Set input parameters via Python built-in (equivalent to `SetAttribute`) |
| `app.GetFromStudyCase("ElmRes")` | §8.5 | `extract_timeseries_outputs` | Get the active study case result object; preferred over `GetCalcRelevantObjects("*.ElmRes")` |
| `res.Load()` | §6.18 | `extract_timeseries_outputs` | Load ElmRes result data into memory before any read calls |
| `res.Release()` | §6.18 | `extract_timeseries_outputs` | Free ElmRes memory; always called in `finally` block |
| `res.GetNumberOfRows()` | §6.18 | `extract_timeseries_outputs`, `_read_column_values` | Get number of result time steps |
| `res.FindColumn(obj, varName)` | §6.18 | `_load_elmres_column`, `extract_timeseries_outputs` | Locate a column by object reference and variable name; returns `-1` if not found |
| `res.GetValue(row, col)` | §6.18 | `_read_column_values`, time axis read | Read one value; returns `(errorCode, value)` tuple; error code `0` = success |
| `res.FindMaxInColumn(col)` | §6.18 | `extract_timeseries_outputs` (maximum metric) | Native max search; returns `(errorCode, value, rowIndex)`; no Python row loop needed |
| `res.FindMinInColumn(col)` | §6.18 | `extract_timeseries_outputs` (minimum metric) | Native min search; returns `(errorCode, value, rowIndex)`; no Python row loop needed |
| `obj.IsOutOfService()` | §5 | *(available for future use)* | Check whether an element is out of service before reading attributes |
| `project.GetContents("Study Cases")` | §5 | Study case iteration helper | Access the Study Cases folder in the project tree |
| `project.GetContents("Operation Scenarios")` | §5 | Scenario iteration helper | Access the Operation Scenarios folder |
| `study_case.Activate()` | §5 | Study case iteration loop | Switch the active study case |
| `op_scenario.Activate()` | §5 | Scenario iteration loop | Switch the active operating scenario |

---

*This README reflects the current state of `powerfactory_generator.html`. Update this document whenever builder functions, the config schema, UI sections, or template blocks are modified.*

**Revision history:**
- v1 — Initial build matching `powerfactory_generator_template_spec_v2.md`
- v2 — `buildElmResHelpers` rewritten to use direct ElmRes API (`Load` / `FindColumn` / `GetValue` / `FindMaxInColumn` / `FindMinInColumn` / `Release`). Removed `export_elmres_to_csv`, `read_timeseries_csv`, and `ComRes` dependency. `extract_timeseries_outputs` signature changed from `(app, output_specs, output_dir, run_id)` to `(app, output_specs)`. All three call sites in `buildProblemLoop` updated accordingly. API anchors table expanded with full §references and new ElmRes methods.
