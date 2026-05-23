# PowerFactory Scripter — Technical README

> **File:** `index.html`
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
   - 5.3 [Reference Data & Smart Autocomplete](#53-reference-data--smart-autocomplete)
   - 5.4 [Config Read / Load / Validate](#54-config-read--load--validate)
   - 5.5 [Code Builder Functions](#55-code-builder-functions)
   - 5.6 [Master Generator](#56-master-generator)
   - 5.7 [File I/O Functions](#57-file-io-functions)
6. [Code Generation Pipeline](#6-code-generation-pipeline)
7. [Template Block Reference](#7-template-block-reference)
8. [Conditional Logic Map](#8-conditional-logic-map)
9. [Output Variable Type Behaviour](#9-output-variable-type-behaviour)
10. [Optimisation Mode Details](#10-optimisation-mode-details)
11. [Contingency Mode Details](#11-contingency-mode-details)
12. [Adding a New Feature — Step-by-Step Guide](#12-adding-a-new-feature--step-by-step-guide)
13. [Known Extension Points](#13-known-extension-points)
14. [External Dependencies](#14-external-dependencies)
15. [PowerFactory API Anchors Used](#15-powerfactory-api-anchors-used)

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
index.html
│
├── <head>
│   ├── Google Fonts import (DM Sans + DM Mono)
│   ├── Ace.js CDN (Python syntax highlighting in custom function editors)
│   ├── SheetJS CDN (xlsx template download for custom mode)
│   └── Highlight.js CDN (syntax highlighting in the code preview panel)
│
├── <style>  ── all CSS
│   ├── CSS custom properties (design tokens — dark theme)
│   ├── Layout: header, .layout flex row, .left-pane, .pane-resizer, .right-pane
│   ├── Section cards (.section-card, .section-header, .section-body)
│   ├── Form elements (inputs, selects, checkboxes)
│   ├── Dynamic tables (.dyn-table)
│   ├── Button variants (.btn-primary, .btn-success, .btn-ghost, .btn-warn, etc.)
│   ├── Output variable items (.output-var-item)
│   ├── Code preview panel (#code-preview)
│   ├── Tooltip system (#globalTooltip, .tt)
│   ├── Reference data badge (.ref-badge)
│   ├── Combobox dropdown (.pf-combo-drop, .pf-combo-item)
│   ├── Validation errors (#validation-errors) and warnings (#validation-warnings)
│   ├── Info boxes (.info-box, .info-more-toggle, .info-extra)
│   └── Mobile responsive media query (max-width: 768px)
│
├── <body>
│   ├── <header>  — top bar + "← Other Tools" / "Samples & Guides" nav links + ref-data-badge
│   ├── .layout
│   │   ├── .left-pane  — 7 collapsible section cards (all form inputs)
│   │   ├── .pane-resizer — draggable divider between left/right panes
│   │   └── .right-pane — toolbar buttons + code preview panel
│   ├── <footer>  — disclaimer + licence badges
│   └── toasts: #copy-toast, #generate-toast, #import-toast
│
└── <script>  ── all JavaScript
    ├── Tooltip helpers (tip(), setTip(), global tooltip TIP_* maps)
    ├── Global state (outputVarCounter, aceEditors, contingencyRowCounter, etc.)
    ├── Section toggle
    ├── Contingency row managers
    ├── Reactive UI handlers
    ├── Reference data loading + PFComboBox autocomplete class
    ├── Suggestion logic (getObjectSuggestions, getInputAttrSuggestions, getOutputAttrSuggestions)
    ├── Dynamic table managers (input vars, output vars, constraints)
    ├── Config read / load / validate
    ├── Live validation warnings
    ├── Code builder functions (one per generated section)
    ├── Master generateCode()
    └── File I/O (copy, download .py, export/import JSON, download xlsx template, reset)
```

---

## 3. UI Layout and Sections

The page uses a **flex row layout** with a draggable `.pane-resizer` divider:

| Column | Content |
|---|---|
| Left (44% default, scrollable) | All input forms in 7 collapsible section cards |
| Resizer (5 px, draggable) | Drag to adjust left/right pane width |
| Right (remaining width) | Toolbar buttons + syntax-highlighted code preview |

The layout stacks vertically on mobile (max-width: 768 px); the pane resizer is hidden in that view.

### Section Cards

Each section card has a header (click to collapse/expand) and a body. The toggle state is managed by `toggleSection(id)` which flips CSS classes `.collapsed` / `.hidden`.

| # | Section ID | Always visible? | Shown when |
|---|---|---|---|
| 01 | `sec-init` | ✓ | Always |
| 02 | `sec-inputs` | ✗ | Hidden when `problemType === 'contingency'` |
| 03 | `sec-custom` | ✗ | `problemType === 'custom'` |
| 04 | `sec-contingency` | ✗ | `problemType === 'contingency'` |
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
    problemType: "brute_force",// "brute_force" | "optimisation" | "custom" | "contingency"
    studyType: "steady_state", // "steady_state" | "dynamic_rms" | "dynamic_emt" | "harmonic"
    codingStyle: "python_file",// "python_file" | "notebook"
    tstop: "20",               // string — used for dynamic_rms / dynamic_emt only
  },

  inputVariables: [            // array of input variable rows (not shown in contingency mode)
    {
      name: "",                // Python identifier used as the column header in the results CSV
      object_query: "",        // e.g. "WFController.ElmDsl", "Fault.EvtShc"
      variable: "",            // e.g. "K_droop", "time"
      lower: "0",              // string number
      upper: "10",             // string number
      step: "0.5",             // string number — increment (brute_force only)
      dtype: "float",          // "float" | "int" — inferred from lower/upper/step values
    }
  ],

  outputVariables: [           // array of output variable items
    {
      id: "ov-0",              // internal DOM id (auto-generated)
      type: "attribute",       // "attribute" | "timeseries" | "custom_calculation"
      name: "",                // Python-safe name (sanitized if needed)
      object_query: "",        // e.g. "RENEWABLES-132kV(1).ElmTerm"
      variable: "",            // e.g. "m:THD"
      metric: "maximum",       // used for timeseries
      threshold: "",           // used for frequency/first_time metrics
      settle_band: "",         // used for time_settle metric
      settle_hold_time: "",    // used for time_settle metric
      settle_reference_value: "",// used for time_settle metric
      customFn: "",            // used for custom_calculation — full Python function text
      output_graph: false,     // timeseries only — save matplotlib .png per scenario
      output_raw_csv: false,   // timeseries only — save raw time-series .csv per scenario
    }
  ],

  optimisation: {
    sense: "minimise",         // "minimise" | "maximise"
    objectiveOutputName: "",   // must match one output variable name
    algorithm: "placeholder",  // see §10 for full algorithm list
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
    scenarioFilePath: "",      // path to .xlsx scenario file (3-row header format)
  },

  contingencyMode: {
    elementTypes: [            // array of element type rows
      {
        query: "*.ElmLne",     // wildcard PF object query — all matched objects are candidates
        filterAttr: "",        // optional attribute to filter by (e.g. "e:Unom", "loc_name")
        filterOp: ">=",        // ">=" | "<=" | "==" | "!=" | ">" | "<"
        filterVal: "",         // numeric, plain string, or glob string (e.g. "North*")
      }
    ],
    contingencyN: "1",         // "1" (N-1) or "2" (N-2)
    combineTypes: false,       // N-2 only: cross element-type pairs when true
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

These functions respond to form changes and update conditional visibility and dynamic tooltips.

| Function | Trigger | What it does |
|---|---|---|
| `onProblemTypeChange()` | `#problem-type` change | Shows/hides `sec-custom`, `sec-optim`, `sec-contingency`; hides `sec-inputs` for contingency; locks study type to steady_state for contingency; updates dynamic tooltip for the `?` badge; toggles input table column classes |
| `onStudyTypeChange()` | `#study-type` change | Shows/hides `#row-tstop`; sets default tstop value; calls `updateTimeseriesAvailability()` and `refreshLiveWarnings()` |
| `onCodingStyleChange()` | `#coding-style` change | Updates the coding style `?` badge tooltip |
| `onSaveIntermediateChange()` | `#save-intermediate` change | Shows/hides `#row-save-interval` |
| `onOutputTypeChange(id)` | Per-output-var type dropdown | Shows/hides metric, threshold, settle params, graph/raw CSV checkboxes, custom fn editor for that output var |
| `onMetricChange(id)` | Per-output-var metric dropdown | Shows/hides threshold row and settle rows based on selected metric |
| `onOutputObjectInput(id)` | Per-output-var object input | No-op (hook for future object-type enforcement) |
| `onOutputNameChange()` | Per-output-var name input | Calls `refreshObjectiveDropdown()` and `refreshLiveWarnings()` |
| `onContingencyNChange()` | `#contingency-n` change | Shows/hides `#row-contingency-combine` for N-2 multi-type combos |
| `onContingencyFilterAttrChange(idx)` | Per-contingency filter-attr input | Rebuilds the operator dropdown to allow only `==`/`!=` for string attributes |
| `onContingencyQueryChange(idx)` | Per-contingency query input | Hook (no-op currently; combobox handles suggestions) |
| `toggleSection(id)` | Section header click | Collapses/expands section body |
| `toggleOutputVar(id)` | Per-output-var collapse btn | Collapses/expands the output var card body |
| `refreshObjectiveDropdown()` | Called by multiple | Rebuilds `#optim-objective` select from current output variable names |
| `updateAlgorithmUI()` | `#optim-algorithm` change | Shows/hides doc link; updates algorithm `?` badge and Max Iterations `?` tooltip |
| `updateTimeseriesAvailability()` | Called on study type change | Disables the Timeseries option in each output var type dropdown when study type is not dynamic |
| `refreshLiveWarnings()` | Called on many interactions | Reads config, calls `getLiveWarnings()`, updates `#validation-warnings` panel |

### 5.2 Dynamic Table Managers

**Input Variables Table (`#input-tbody`)**

| Function | Description |
|---|---|
| `addInputRow(data = {})` | Appends a new `<tr>` to `#input-tbody`. Accepts optional `data` object to pre-fill from config load. Calls `attachInputComboBoxes(idx)` after DOM insertion. |
| `getInputRows()` | Reads all input rows from DOM, returns array of row objects matching the `inputVariables` schema. `dtype` is inferred via `inferDtype(lower, upper, step)`. |
| `removeRow(id)` | Generic — removes any `<tr>` by element ID. Used by input rows and constraint rows. |
| `inferDtype(lower, upper, step)` | Returns `"int"` if all three values are integers (or empty), `"float"` otherwise. |

**Output Variables Container (`#output-vars-container`)**

Output variables are rendered as full `.output-var-item` div cards because each type has very different fields.

| Function | Description |
|---|---|
| `addOutputVar(data = {})` | Creates a new `.output-var-item` div, appends to container. Calls `initAceEditor(id)` if type is `custom_calculation`. Calls `attachOutputComboBoxes(id)`. |
| `reindexOutputVars()` | Renumbers all `.ov-index` badges (#1, #2 …) after any add/remove. |
| `buildOutputVarHTML(id, data, type)` | Returns the full inner HTML string for one output variable card including conditional fields. |
| `removeOutputVar(id)` | Removes the output var div, destroys its Ace editor if present, reindexes, refreshes objective dropdown and live warnings. |
| `toggleOutputVar(id)` | Collapses or expands the `.output-var-body` div for a given output var card. |
| `getOutputVars()` | Reads all output vars from DOM, returns array matching `outputVariables` schema. |
| `initAceEditor(id, initialValue)` | Creates an Ace editor inside `#${id}-ace` with Python mode and `tomorrow_night` theme. Stored in `aceEditors` map. Uses `setTimeout` to ensure DOM is ready. |

**Constraint Table (`#constraint-tbody`)**

| Function | Description |
|---|---|
| `addConstraint(data = {})` | Appends a new constraint row. Populates output variable dropdown from current `getOutputVars()`. |
| `getConstraints()` | Reads all constraint rows, returns array matching `optimisation.constraints` schema. |

**Contingency Table (`#contingency-tbody`)**

| Function | Description |
|---|---|
| `addContingencyRow(data = {})` | Appends a new row to `#contingency-tbody`. Attaches `PFComboBox` for element query and filter attribute fields. Calls `onContingencyFilterAttrChange()` and `updateContingencyRemoveButtons()`. |
| `removeContingencyRow(idx)` | Removes a contingency row. Calls `updateContingencyRemoveButtons()` and `onContingencyNChange()`. |
| `updateContingencyRemoveButtons()` | Hides the remove button when only one row remains. |
| `getContingencyElementTypes()` | Reads all contingency rows, returns array matching `contingencyMode.elementTypes` schema. |

### 5.3 Reference Data & Smart Autocomplete

The app optionally loads two reference JSON files on startup to power smart attribute suggestions.

**Global state:**
```javascript
const PF_REF = {
  index:    null,   // variables/elements/element_variables_index.json
  params:   null,   // element_params.json
  evtIndex: null,   // variables/events/event_variables_index.json (currently reserved)
  varFiles: {},     // cache of lazy-loaded per-class variable files
  loading:  new Set(), // in-flight fetch classes
};
```

**Reference loading functions:**

| Function | Description |
|---|---|
| `fetchReferenceData()` | Called on DOMContentLoaded. Fetches `element_variables_index.json`, `element_params.json`, and `event_variables_index.json` in parallel. Updates the `#ref-data-badge` in the header with loaded/offline status. |
| `fetchElmClassVars(elmClass, onLoaded)` | Lazy-loads the per-class variable file (e.g. `variables/elements/ElmTerm.json`) on first access. Caches result in `PF_REF.varFiles`. Calls `onLoaded` once data is available. |

**Suggestion functions:**

| Function | Description |
|---|---|
| `getObjectSuggestions(typed, includeEvents)` | Suggests `Name.ElmXxx` and optionally `Name.EvtXxx` strings. Matches against `ALL_ELM_CLASSES` and `ALL_EVT_CLASSES`. |
| `getInputAttrSuggestions(typed, elmClass)` | Suggests writable parameters from `element_params.json` for element classes, or `EVT_PARAMS[elmClass]` for event classes. Filters out non-numeric attributes via `INPUT_ATTR_BLACKLIST`. |
| `getOutputAttrSuggestions(typed, elmClass, comboInstance)` | Suggests result variables from lazy-loaded per-class JSON (`result_vars[studyTypeKey]`). Falls back to index var names while the full file loads. Falls back to hardcoded common outputs when no class is detected or DB is offline. |
| `extractPfClass(objectQuery)` | Extracts the PowerFactory class suffix from an object query (e.g. `"Grid.ElmTerm"` → `"ElmTerm"`). Handles `Elm*`, `Sta*`, and `Evt*` prefixes. Also exported as `extractElmClass` for backward compatibility. |
| `isEventClass(objectQuery)` | Returns `true` if the object query refers to an `Evt*` class. |

**PFComboBox class:**

A portal-based combobox that appends its dropdown to `<body>` with `position: fixed`, escaping any ancestor `overflow: hidden`. Supports keyboard navigation (arrow keys, Enter, Escape) and auto-repositions on scroll/resize.

| Method | Description |
|---|---|
| `constructor(inputEl, getSuggestions, onPick)` | Wraps `inputEl` in a `.pf-combo-wrap`; creates and portals the `.pf-combo-drop`; attaches event listeners. |
| `_refresh()` | Calls `getSuggestions(inputEl.value)`, renders items, positions dropdown. |
| `_position()` | Sets `position: fixed` coordinates from `inputEl.getBoundingClientRect()`. Flips above/below based on available space. |
| `_pick(i)` | Sets `inputEl.value` to selected item's `var`, dispatches `input` event, closes dropdown. |
| `destroy()` | Removes event listeners and detaches the portal dropdown from DOM. |

### 5.4 Config Read / Load / Validate

| Function | Description |
|---|---|
| `readConfig()` | Reads all form fields and dynamic tables, returns the canonical config object. This is the single source of truth before code generation. |
| `loadConfig(cfg)` | Inverse of `readConfig()`. Accepts a config object and repopulates all form fields, dynamic tables, and Ace editors. Handles legacy key migration (`scipy_minimize` → `scipy_lbfgsb`). Calls all reactive UI functions at the end to restore conditional visibility. Used by reset and JSON import. |
| `validateConfig(cfg)` | Returns an array of error strings. Validates required fields, duplicate variable names (within inputs, within outputs, and cross-input/output), contingency element queries, custom mode file path, optimisation objective, threshold/settle params. Returns empty array if valid. |
| `showValidationErrors(errors)` | Shows/hides `#validation-errors` panel. Scrolls into view if errors exist. |
| `getLiveWarnings(cfg)` | Returns warnings from `validateCustomCalcWarnings` + `buildObjectTypeWarnings` + timeseries-on-steady-state check. Does not block code generation. |
| `refreshLiveWarnings()` | Reads current config, calls `getLiveWarnings()`, updates `#validation-warnings` panel. Called on every interactive change. |
| `showValidationWarnings(warnings)` | Shows/hides `#validation-warnings` panel. |
| `validateCustomCalcWarnings(cfg)` | Warns if custom function arguments don't match defined input/output variable names, or if a function returns multiple values. |
| `buildObjectTypeWarnings(cfg)` | Warns if object queries don't end with a recognised PowerFactory class suffix. |
| `updateTimeseriesAvailability()` | Disables the Timeseries option in each output var's type dropdown when the study type is not dynamic; auto-switches any existing timeseries outputs to attribute. |
| `isPythonIdentifier(name)` | Returns `true` if name matches `/^[A-Za-z_][A-Za-z0-9_]*$/`. Used in validation. |
| `sanitizeName(name)` | Replaces non-identifier characters with `_`, prefixes leading digits. Used in code generation to produce safe Python variable names. |

### 5.5 Code Builder Functions

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
buildTimeseriesGraphHelper(cfg)      ← new: matplotlib graph output helper
buildRawCsvHelper(cfg)               ← new: raw CSV output helper
buildCustomFunctionHelpers(cfg)
buildOutputDirSetup(cfg)
buildInputSpecs(cfg)
buildOutputSpecs(cfg)
buildProblemLoop(cfg)
buildOutputExport(cfg)
```

Each builder is documented in detail in [Section 7](#7-template-block-reference).

### 5.6 Master Generator

```javascript
function generateCode()
```

1. Calls `readConfig()` to get the config object.
2. Calls `validateConfig(cfg)`. If errors exist, calls `showValidationErrors()` and returns early.
3. Calls `getLiveWarnings(cfg)` and calls `showValidationWarnings()` (non-blocking).
4. Calls all builder functions in order, stores results in named variables.
5. If `codingStyle === 'notebook'`, groups sections into 7 cells and wraps with `buildNotebookWrapper(sections)`.
6. If `codingStyle === 'python_file'`, places all helpers before the top-level calls and wraps with `buildPythonFileWrapper(body)`.
7. Stores final code in `window._generatedCode` for download functions.
8. Renders into `#code-preview` and calls `hljs.highlightElement()`.
9. Shows `#generate-toast`.

### 5.7 File I/O Functions

| Function | Description |
|---|---|
| `copyCode()` | Copies `window._generatedCode` to clipboard via `navigator.clipboard.writeText()`. Shows `#copy-toast`. |
| `downloadPy()` | Downloads `window._generatedCode` as `powerfactory_script.py`. |
| `download(content, filename, type)` | Generic download helper — creates a Blob URL and triggers a click. |
| `downloadCustomTemplate()` | Reads current input variables, generates an xlsx (via SheetJS) with the required 3-row header format and 4 blank scenario rows. Falls back to CSV if SheetJS is unavailable. Requires at least one input variable with Object and Variable filled. |
| `exportConfigJSON()` | Reads current form via `readConfig()`, serializes to JSON, downloads as `powerfactory_config.json`. |
| `importConfigJSON(event)` | Reads a `.json` file from the file input, parses it, calls `loadConfig(cfg)` and `refreshLiveWarnings()`. Shows `#import-toast`. |
| `resetForm()` | Confirms with user, calls `loadConfig()` with a hardcoded default config object, clears the code preview. |

---

## 6. Code Generation Pipeline

```
generateCode()
    │
    ├─ readConfig()          → cfg object
    ├─ validateConfig(cfg)   → errors[]   ── abort if non-empty
    ├─ getLiveWarnings(cfg)  → warnings[] ── shown but non-blocking
    │
    ├─ buildImports(cfg)                → sec1
    ├─ buildPreparation(cfg)            → sec2
    ├─ buildProjectSelection(cfg)       → sec3
    ├─ buildChecks(cfg)                 → sec4
    ├─ buildCommonHelpers(cfg)          → sec5
    ├─ buildStudyHelper(cfg)            → sec6
    ├─ buildElmResHelpers(cfg)          → sec7   (empty if no timeseries/custom_calculation outputs)
    ├─ buildTimeseriesGraphHelper(cfg)  → sec7b  (empty if no output_graph outputs)
    ├─ buildRawCsvHelper(cfg)           → sec7c  (empty if no output_raw_csv outputs)
    ├─ buildCustomFunctionHelpers(cfg)  → sec8   (empty if no custom_calculation outputs)
    ├─ buildOutputDirSetup(cfg)         → sec9
    ├─ buildInputSpecs(cfg)             → sec10
    ├─ buildOutputSpecs(cfg)            → sec11
    ├─ buildProblemLoop(cfg)            → sec12
    └─ buildOutputExport(cfg)           → sec13
            │
            ├─ if codingStyle === 'notebook'
            │       buildNotebookWrapper([sec1+sec2,
            │                             sec5+sec6+sec7+sec7b+sec7c+sec8,
            │                             sec3+sec4,
            │                             sec9+sec10, sec11, sec12, sec13])
            │       (helpers come first so project-selection cell can call them)
            │
            └─ if codingStyle === 'python_file'
                    buildPythonFileWrapper(sec1+sec5+sec6+sec7+sec7b+sec7c+sec8+
                                          sec2+sec3+sec4+sec9+sec10+sec11+sec12+sec13)
                    → wraps everything in def main() + if __name__ == "__main__":
```

The notebook wrapper groups sections into labelled cells:

| Cell | Sections grouped |
|---|---|
| Cell 1 — Preparation & Imports | imports + preparation |
| Cell 2 — Helper Functions | common helpers + study helper + ElmRes helpers + graph helper + raw CSV helper + custom fn helpers |
| Cell 3 — Project Selection & Checks | project selection + checks |
| Cell 4 — Input Specs & Object Resolution | output dir setup + input specs |
| Cell 5 — Output Specs | output specs |
| Cell 6 — Problem Loop & Study Execution | problem loop |
| Cell 7 — Output Export | output export |

> **Note:** The notebook cell order puts helpers (Cell 2) before project selection (Cell 3) so that `run_study_*` and other helpers are defined before any cells that call them during interactive execution.

---

## 7. Template Block Reference

### `buildImports(cfg)`

Generates the import block. Conditionally includes:

- `from tqdm import tqdm` — if `additionalConfig.useProgressBar`
- `import fnmatch` — if `problemType === 'contingency'`
- `import matplotlib` + `matplotlib.use("Agg")` + `import matplotlib.pyplot as plt` — if any timeseries output has `output_graph: true`
- Algorithm-specific imports from `ALGORITHM_META[alg].pyImport` — if `problemType === 'optimisation'`

Always includes: `sys`, `os`, `csv`, `re`, `time`, `traceback`, `itertools`, `datetime`, `powerfactory as pf`, `pandas`, `numpy`, and `sys.path.append(apiPath)`.

---

### `buildPreparation(cfg)`

Generates app connection and project listing. Always uses the direct listing path (`*.IntPrj` from user). No folder-first variant.

---

### `buildProjectSelection(cfg)`

Generates the project activation block.

Index resolution logic:
- If index is empty AND `codingStyle === 'python_file'` → emit `int(input("Enter project index: "))`
- If index is empty AND `codingStyle === 'notebook'` → emit `PROJECT_INDEX_HERE` placeholder

---

### `buildChecks(cfg)`

Always emits:
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

---

### `buildElmResHelpers(cfg)`

Returns an empty string if no output variable has type `timeseries` or `custom_calculation`.

**Access strategy:** Direct `ElmRes` API — no CSV export/re-import. All result data is read in-memory.

Emits: `_load_elmres_column`, `_read_column_values`, `calculate_timeseries_metric`, `extract_attribute_output`, `extract_timeseries_outputs`.

`maximum` and `minimum` metrics use native `res.FindMaxInColumn(col)` / `res.FindMinInColumn(col)` — no Python row scan. All other metrics call `_read_column_values` and compute in pure Python.

---

### `buildTimeseriesGraphHelper(cfg)`

Returns an empty string if no timeseries output has `output_graph: true`.

Otherwise emits `save_timeseries_graph(time_values, ts_data, spec, row, graph_dir, ctx)` — a helper that uses matplotlib (Agg backend) to save a time-vs-variable PNG to `{output_dir}/graph/`. The filename encodes the scenario label columns from `row` and the context list `ctx` (study case / operating scenario names).

---

### `buildRawCsvHelper(cfg)`

Returns an empty string if no timeseries output has `output_raw_csv: true`.

Otherwise emits `save_timeseries_raw_csv(time_values, ts_data, spec, row, raw_dir, ctx)` — a helper that writes the full time-series as a two-column CSV to `{output_dir}/raw/`.

---

### `buildCustomFunctionHelpers(cfg)`

Returns an empty string if no output variable has type `custom_calculation`.

For each custom calculation output variable:
1. Emits the user's function body from the Ace editor.
2. If the name was sanitized, emits a `# Name mapping:` comment.

Then emits the `evaluate_custom_calculations(base_result_row)` dispatcher function that parses each function's first `def` line to auto-construct the call using result row values.

---

### `buildOutputDirSetup(cfg)`

Emits:
```python
output_dir = r"..."
ensure_output_dir(output_dir)
```

Also emits `graph_dir` and `raw_dir` subdirectory setup if any timeseries output uses `output_graph` or `output_raw_csv`.

---

### `buildInputSpecs(cfg)`

Emits the `input_specs` list literal with one dict per input variable row.

If `problemType === 'custom'`:
- Emits `scenario_file_path` and `scenario_df = pd.read_excel(...)`.
- Does **not** emit `input_objects` / `input_ranges`.

If `problemType === 'contingency'`:
- Emits contingency element type specs and resolution code.
- Does **not** emit input_specs / input_objects / input_ranges.

Otherwise (brute force / optimisation):
- Emits `input_objects = {}` and `input_ranges = {}` resolution loop.

---

### `buildOutputSpecs(cfg)`

Emits the `output_specs` list literal. Each dict includes only the keys relevant to its type:
- `attribute`: name, object_query, variable
- `timeseries`: adds metric, threshold (if set), settle params (if set), `output_graph`, `output_raw_csv`
- `custom_calculation`: name, object_query, variable

---

### `buildProblemLoop(cfg)`

The most complex builder. Branches on `problemType`:

**`brute_force`:** `itertools.product` combination loop.

**`custom`:** Outer loop `for _, scenario_row in scenario_df.iterrows()`.

**`optimisation`:** Emits `evaluate_one_case(param_values)` + algorithm-specific optimizer call. See §10 for algorithm variants.

**`contingency`:** Resolves candidate elements at runtime via `GetCalcRelevantObjects`, applies optional filters using `fnmatch` for glob strings, then trips elements one at a time (N-1) or in pairs (N-2). Always includes a base case (all in service). Restores `outserv` in a `finally` block after each run.

Graph and raw CSV calls are injected inline into the loop body via `buildGraphCalls()` and `buildRawCsvCalls()` when the relevant output variables are configured.

**Indentation handling for nested loops:**

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

| Condition | What changes in generated code |
|---|---|
| `openPowerFactoryWindow === true` | `app.Show()` instead of `app.Hide()` |
| `studyType === 'dynamic_rms'` | `run_study_dynamic_rms` with `iopt_sim="rms"` |
| `studyType === 'dynamic_emt'` | `run_study_dynamic_emt` with `iopt_sim="ins"` |
| `studyType === 'harmonic'` | `run_study_harmonic` with `ComHldf` |
| `useProgressBar === true` | `from tqdm import tqdm` import; loop wrapped with `tqdm(...)` |
| Any output has type `timeseries` | Includes all ElmRes direct-API helpers; no CSV or `ComRes` involved |
| Any output has type `custom_calculation` | Includes custom function helpers + evaluator |
| Any timeseries output has `output_graph: true` | `import matplotlib`; `buildTimeseriesGraphHelper`; inline `save_timeseries_graph` calls in loop; `graph_dir` setup |
| Any timeseries output has `output_raw_csv: true` | `buildRawCsvHelper`; inline `save_timeseries_raw_csv` calls in loop; `raw_dir` setup |
| `saveIntermediateEnabled === true` | Includes `save_intermediate_results` helper + call inside loop |
| `iterateStudyCases === true` | Outer `for study_case in study_cases:` loop; includes `get_study_cases` helper |
| `iterateOperatingScenarios === true` | Outer `for op_scenario in operating_scenarios:` loop; includes `get_operating_scenarios` helper |
| `problemType === 'custom'` | Custom mode section visible; `scenario_df` input; scenario row loop |
| `problemType === 'optimisation'` | Optimisation section visible; `evaluate_one_case`; algorithm-specific optimizer call |
| `problemType === 'brute_force'` | `itertools.product` combination loop |
| `problemType === 'contingency'` | Contingency section visible; Input Variables section hidden; study type locked to steady state; `fnmatch` import; N-1 or N-2 element trip loop with `outserv` restore in `finally` |
| `contingencyN === '2'` | N-2 pairs loop; `combineTypes` controls whether cross-type pairs are included |
| `algorithm === 'gp_minimize'` | `skopt` imports; `space` definition; `@use_named_args` objective |
| `algorithm === 'scipy_minimize'` (any `scipy_*`) | `from scipy.optimize import minimize`; method-specific call |
| `algorithm === 'differential_evolution'` | `scipy.optimize.differential_evolution` import; bounds |
| `optimisation.constraints.length > 0` | Penalty block inside objective function |
| `sense === 'maximise'` | `return -(objective_value_adjusted)` |
| `codingStyle === 'notebook'` | Code split into 7 labelled cells (helpers first, then project selection) |
| `codingStyle === 'python_file'` | Code wrapped in `def main():` with helpers defined before top-level calls |
| Metric in `THRESHOLD_METRICS` | Threshold field shown in UI; `threshold=` included in output_spec |
| Metric is `time_settle` | Settle band / hold time / reference fields shown; included in output_spec |

---

## 9. Output Variable Type Behaviour

### Attribute (Scalar)

- UI fields shown: Name, Object Query, Variable (Attribute)
- Generated: entry in `output_specs` with `type: "attribute"`; extracted via `extract_attribute_output()` using `GetAttribute()`

### Timeseries

- UI fields shown: Name, Object Query, Variable, Metric dropdown
- Threshold shown only if metric is in `THRESHOLD_METRICS = ['first_time_above', 'first_time_below']`
- Settle params shown only if metric is `time_settle`
- Extra checkboxes: **Output graph** (saves `.png` to `{output_dir}/graph/`), **Output raw data** (saves `.csv` to `{output_dir}/raw/`)
- Generated: entry in `output_specs` with metric and optional threshold/settle params; extracted via `extract_timeseries_outputs(app, output_specs)` using the direct ElmRes API — no CSV file is written for the metric extraction itself
- `maximum` and `minimum` use native `res.FindMaxInColumn(col)` / `res.FindMinInColumn(col)`; all other metrics read rows via `res.GetValue(row, col)` and compute in pure Python
- Disabled (greyed out) when study type is not Dynamic RMS or Dynamic EMT

### Custom Calculation

- UI fields shown: all of the above + Ace.js Python function editor
- User writes a function body; generator includes it verbatim in the helper section
- `evaluate_custom_calculations()` parses the function signature to auto-construct the call using result row values
- Arguments must match names of previously defined input or output variables

---

## 10. Optimisation Mode Details

### Algorithm Variants

| Algorithm key | Library | Method | Bounds support | Notes |
|---|---|---|---|---|
| `placeholder` | none | — | — | Wire up `evaluate_one_case` manually |
| `scipy_nelder_mead` | `scipy.optimize` | `Nelder-Mead` | No | Gradient-free simplex; best for unconstrained problems |
| `scipy_powell` | `scipy.optimize` | `Powell` | Yes | Gradient-free directional set |
| `scipy_lbfgsb` | `scipy.optimize` | `L-BFGS-B` | Yes | Quasi-Newton; approximates gradient |
| `scipy_slsqp` | `scipy.optimize` | `SLSQP` | Yes | Sequential Least Squares; supports constraints |
| `scipy_cobyla` | `scipy.optimize` | `COBYLA` | No | Constraint approximation; gradient-free |
| `differential_evolution` | `scipy.optimize` | — | Yes | `differential_evolution(..., maxiter=N, seed=42)` |
| `gp_minimize` | `skopt` | — | Yes | `gp_minimize(fn, space, n_calls=N, random_state=42)` — best for expensive objectives |

> **Legacy migration:** JSON configs exported with the old `scipy_minimize` algorithm key are automatically remapped to `scipy_lbfgsb` on import.

### Constraint Penalty

All constraints are handled with additive penalty (no hard constraint enforcement). Each violated constraint adds `1e6` to the objective. Works with all algorithm variants.

### Sense

- `minimise` → `return objective_value_adjusted`
- `maximise` → `return -(objective_value_adjusted)` (negates to convert max to min problem)

---

## 11. Contingency Mode Details

Contingency mode resolves PowerFactory elements at runtime using `GetCalcRelevantObjects`, then trips each element (N-1) or each pair (N-2) out of service and runs a study.

### Element Type Rows

Each row specifies:
- **Element Query**: wildcard PF query (e.g. `*.ElmLne`, `*.ElmSym`)
- **Filter Attribute**: optional attribute to filter candidates (e.g. `e:Unom`, `loc_name`)
- **Operator**: comparison operator (numeric: `>=`, `<=`, `==`, `!=`, `>`, `<`; string/blacklisted: `==` or `!=` only)
- **Filter Value**: numeric, plain string, or glob string (e.g. `North*` — case-insensitive fnmatch)

### Contingency Types

- **N-1**: one element tripped per run; one run per candidate element
- **N-2**: two elements tripped simultaneously; pairs formed within each element type, optionally crossing types when **Combine element types** is checked

### Base Case

A base case (all elements in service) is always included as the first run.

### Restore Logic

The `outserv` attribute is always restored in a `finally` block after each contingency run, ensuring the network is left in its original state even if the study fails.

---

## 12. Adding a New Feature — Step-by-Step Guide

### Example: Add a new study type

1. **Add the UI option.** In `#study-type` select in `sec-init`, add `<option value="my_type">My Study Type</option>`.
2. **Update `onStudyTypeChange()`.** Add `my_type` to `TIP_STUDY_TYPE` map.
3. **Add a builder in `buildStudyHelper(cfg)`.** Add an `else if (st === 'my_type')` branch.
4. **Update `buildRunStudyCall(cfg)`.** Add a branch returning the inline call expression.

### Example: Add a new output variable metric

1. **Add to `METRICS` array.**
2. **If it needs a threshold**, add to `THRESHOLD_METRICS`.
3. **If it needs settle params**, add to `SETTLE_METRICS`.
4. **Add to `TIP_METRIC` map** for the tooltip text.
5. **Add an `if metric === "my_metric":` branch** in `calculate_timeseries_metric()` inside `buildElmResHelpers(cfg)`. If a native `ElmRes` method exists, add a dispatch branch inside `extract_timeseries_outputs` before the generic fallback.
6. **Add the option** to the metric select built in `buildOutputVarHTML()`.

### Example: Add a new global checkbox option

1. **Add the checkbox HTML** to `sec-addl` section body.
2. **Add the field** to `readConfig()` under `additionalConfig`.
3. **Add the load** to `loadConfig(cfg)` to restore the checkbox state.
4. **Add conditional logic** in the relevant `build*()` function.

### Example: Add a new optimisation algorithm

1. **Add to `ALGORITHM_META`** with `label`, `doc`, `method`, `bounds`, and `pyImport`.
2. **Add to `ALGORITHM_TIPS`** with a description string.
3. **Add the option** to `#optim-algorithm` select.
4. **Add an `else if (alg === 'my_alg')` branch** in `buildProblemLoop(cfg)` inside the `optimisation` section.

---

## 13. Known Extension Points

| Area | Current state | How to extend |
|---|---|---|
| Problem types | 4 types | Add option + branch in `onProblemTypeChange` + section card + builder branches |
| Study types | 4 types | Add option + branch in `buildStudyHelper` + `buildRunStudyCall` |
| Timeseries metrics | 7 metrics | Add to `METRICS`; if native `ElmRes` method, add dispatch in `extract_timeseries_outputs`; otherwise implement in `calculate_timeseries_metric` |
| Optimisation algorithms | 8 (incl. placeholder) | Add to `ALGORITHM_META`, `ALGORITHM_TIPS`, algorithm select, and `buildProblemLoop` |
| Output variable types | 3 types | Requires changes to `buildOutputVarHTML`, `buildOutputSpecs`, loop body in `buildProblemLoop`, and a new extraction helper |
| Timeseries output formats | 2 (graph, raw CSV) | Add checkbox to output var HTML, field to schema, helper builder, and inline call builder |
| Notebook cell structure | 7 cells | Rearrange section grouping in `buildNotebookWrapper` call inside `generateCode()` |
| Reference data classes | ~40 element classes | Add to `ALL_ELM_CLASSES`; add corresponding JSON file to `variables/elements/` |
| Custom function validation | String-based | Replace or augment `customFn.trim().length < 5` check in `validateConfig` |

---

## 14. External Dependencies

All loaded from CDN — no npm, no build step required.

| Library | Version | CDN URL | Purpose |
|---|---|---|---|
| Ace.js | 1.32.3 | `cdnjs.cloudflare.com/ajax/libs/ace/1.32.3/ace.js` | Python syntax highlighting in custom function editors |
| SheetJS (xlsx) | 0.18.5 | `cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js` | Excel (.xlsx) template download for Custom mode |
| Highlight.js | 11.9.0 | `cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js` | Syntax highlighting in the code preview panel |
| Highlight.js CSS | 11.9.0 | `atom-one-dark.min.css` from same CDN | Dark theme for code preview |
| Google Fonts | — | `fonts.googleapis.com` | DM Sans + DM Mono |

**If CDNs are unavailable (air-gapped environments):**
- Download the CDN assets and host them locally.
- Update the `<link>` and `<script>` `src` attributes to point to local paths.
- Ace.js is only needed for custom function editors — removing it converts those editors to plain `<textarea>` elements.
- SheetJS is only needed for the xlsx template download — removing it causes `downloadCustomTemplate()` to fall back to a CSV download.
- Highlight.js is only needed for the preview panel — removing it still shows correct code, just without syntax colouring.

**Reference data files** (optional, deployed alongside `index.html`):

| File | Size | Purpose |
|---|---|---|
| `variables/elements/element_variables_index.json` | ~68 KB | Gateway index for output attribute suggestions; loaded on startup |
| `variables/elements/ElmXxx.json` (per class) | varies | Full variable lists with descriptions; lazy-loaded on demand |
| `element_params.json` | ~512 KB | Input parameter suggestions per element class; loaded on startup |

When these files are absent the tool works fully; smart autocomplete is simply unavailable and the header badge shows "Variable DB offline".

**Python libraries required at runtime** (must be installed in the Python environment that runs the generated script):

| Library | Required for |
|---|---|
| `powerfactory` | Always (via `sys.path.append`) |
| `pandas` | Always — final results DataFrame + CSV output; Custom mode scenario file loading |
| `numpy` | Always — input range generation (`np.arange`) |
| `tqdm` | If `useProgressBar` enabled |
| `scipy` | If algorithm is any `scipy_*` variant or `differential_evolution` |
| `scikit-optimize` (`skopt`) | If algorithm is `gp_minimize` |
| `matplotlib` | If any timeseries output has **Output graph** enabled |

---

## 15. PowerFactory API Anchors Used

| API Call | API Ref | Used in | Purpose |
|---|---|---|---|
| `pf.GetApplication(username)` | §2 | Preparation | Connect to running PowerFactory instance |
| `app.GetCurrentUser()` | §3.1 | Preparation | Get user object to list projects |
| `user.GetContents("*.IntPrj")` | §5 | Preparation | List available projects |
| `project.Activate()` | §5 | Project selection | Activate the chosen project |
| `app.GetActiveProject()` | §3.1 | Checks | Verify active project |
| `app.GetActiveStudyCase()` | §3.2 | Checks | Verify active study case |
| `app.GetActiveScenario()` | §3.1 | Checks | Verify active operating scenario |
| `app.Show()` / `app.Hide()` | §3.1 | Checks | Control PF window visibility |
| `app.GetCalcRelevantObjects(query)` | §3.3 | Input resolution; attribute output; contingency candidate resolution | Resolve PF objects by class filter string |
| `app.GetFromStudyCase(classname)` | §3.2 | Study helpers; ElmRes access | Get or create object from active study case |
| `app.GetOutputWindow()` | §3.9 | Dynamic study helpers | Access output window for clearing before simulation |
| `outputWindow.Clear()` | §4 | Dynamic study helpers | Clear output window before each run |
| `comInc.iopt_sim = "rms"` | §3.2 | Dynamic RMS helper | Set simulation mode to RMS |
| `comInc.iopt_sim = "ins"` | §3.2 | Dynamic EMT helper | Set simulation mode to EMT |
| `comInc.Execute()` | §3.2 | Dynamic study helpers | Initialize dynamic simulation |
| `comSim.tstop` | §3.2 | Dynamic study helpers | Set simulation stop time |
| `comSim.Execute()` | §3.2 | Dynamic study helpers | Run dynamic simulation |
| `comLdf.Execute()` | §3.2 | Steady state helper | Run load flow (`ComLdf`) |
| `comHldf.Execute()` | §3.2 | Harmonic helper | Run harmonic load flow (`ComHldf`) |
| `obj.GetAttribute(varname)` | §5 | Attribute output extraction; contingency filter evaluation | Read attribute from any DataObject |
| `setattr(obj, varname, value)` | — | Input variable setting in loop | Set input parameters (equivalent to `SetAttribute`) |
| `obj.IsOutOfService()` | §5 | *(available for future use)* | Check whether an element is out of service |
| `app.GetFromStudyCase("ElmRes")` | §8.5 | `extract_timeseries_outputs` | Get the active study case result object |
| `res.Load()` | §6.18 | `extract_timeseries_outputs` | Load ElmRes result data into memory |
| `res.Release()` | §6.18 | `extract_timeseries_outputs` | Free ElmRes memory; always in `finally` block |
| `res.GetNumberOfRows()` | §6.18 | `extract_timeseries_outputs`, `_read_column_values` | Get number of result time steps |
| `res.FindColumn(obj, varName)` | §6.18 | `_load_elmres_column`, `extract_timeseries_outputs` | Locate a column; returns `-1` if not found |
| `res.GetValue(row, col)` | §6.18 | `_read_column_values`, time axis read | Read one value; returns `(errorCode, value)` |
| `res.FindMaxInColumn(col)` | §6.18 | `extract_timeseries_outputs` (maximum metric) | Native max search; returns `(errorCode, value, rowIndex)` |
| `res.FindMinInColumn(col)` | §6.18 | `extract_timeseries_outputs` (minimum metric) | Native min search; returns `(errorCode, value, rowIndex)` |
| `project.GetContents("Study Cases")` | §5 | Study case iteration helper | Access the Study Cases folder |
| `project.GetContents("Operation Scenarios")` | §5 | Scenario iteration helper | Access the Operation Scenarios folder |
| `study_case.Activate()` | §5 | Study case iteration loop | Switch the active study case |
| `op_scenario.Activate()` | §5 | Scenario iteration loop | Switch the active operating scenario |
| `element.GetAttribute("outserv")` | §5 | Contingency loop | Read out-of-service state before tripping |
| `element.SetAttribute("outserv", 1)` | §5 | Contingency loop | Trip element (mark out of service) |
| `element.SetAttribute("outserv", 0)` | §5 | Contingency loop (finally) | Restore element after contingency run |

---

*This README reflects the current state of `index.html`. Update this document whenever builder functions, the config schema, UI sections, or template blocks are modified.*

**Revision history:**
- v1 — Initial build matching `powerfactory_generator_template_spec_v2.md`
- v2 — `buildElmResHelpers` rewritten to use direct ElmRes API (`Load` / `FindColumn` / `GetValue` / `FindMaxInColumn` / `FindMinInColumn` / `Release`). Removed `export_elmres_to_csv`, `read_timeseries_csv`, and `ComRes` dependency.
- v3 — Added Contingency mode (`problemType === 'contingency'`), expanded optimisation algorithms (5 scipy variants + placeholder + differential_evolution + gp_minimize), timeseries output graph and raw CSV options, smart PFComboBox autocomplete with lazy-loaded reference data, live validation warnings, pane resizer, mobile responsive layout, SheetJS xlsx template download. File renamed from `powerfactory_generator.html` to `index.html`. Fonts changed from IBM Plex to DM Sans + DM Mono. Removed `projectSelection` config section. Added `contingencyMode` config section. Notebook cell order resequenced (helpers before project selection).
