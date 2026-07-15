// ============================================================================
// PowerFactory Scripter — config schema (single source of truth for the MCP)
//
// This mirrors the config object produced by readConfig()/loadConfig() in
// powerfactory-scripter/script.js. It is the exact shape the tool imports when
// the user clicks "↑ JSON". Keep this file in lockstep with that schema.
// ============================================================================

export const TOOL_URL = 'https://tool.adjiebrotots.com/powerfactory-scripter';

// Allowed enum values ---------------------------------------------------------
export const ENUMS = {
  problemType: ['brute_force', 'optimisation', 'custom', 'contingency'],
  studyType: ['steady_state', 'dynamic_rms', 'dynamic_emt', 'harmonic'],
  codingStyle: ['python_file', 'notebook'],
  outputType: ['attribute', 'timeseries', 'custom_calculation'],
  metric: ['maximum', 'minimum', 'mean', 'median', 'first_time_above', 'first_time_below', 'time_settle'],
  sense: ['minimise', 'maximise'],
  algorithm: [
    'placeholder', 'scipy_nelder_mead', 'scipy_powell', 'scipy_lbfgsb',
    'scipy_slsqp', 'scipy_cobyla', 'differential_evolution', 'gp_minimize',
  ],
  filterOp: ['>=', '<=', '==', '!=', '>', '<'],
  contingencyN: ['1', '2'],
};

// Metrics that require extra fields -------------------------------------------
export const THRESHOLD_METRICS = ['first_time_above', 'first_time_below'];
export const SETTLE_METRICS = ['time_settle'];

// A blank, valid-shaped config (matches resetForm() defaults) -----------------
export function defaultConfig() {
  return {
    initialisation: {
      powerfactoryApiPath: '',
      username: '',
      outputDir: '',
      problemType: 'brute_force',
      studyType: 'steady_state',
      codingStyle: 'python_file',
      tstop: '20',
    },
    inputVariables: [],
    outputVariables: [],
    optimisation: {
      sense: 'minimise',
      objectiveOutputName: '',
      algorithm: 'placeholder',
      maxIterations: 50,
      constraints: [],
    },
    customMode: { scenarioFilePath: '' },
    contingencyMode: {
      elementTypes: [{ query: '*.ElmLne', filterAttr: '', filterOp: '>=', filterVal: '' }],
      contingencyN: '1',
      combineTypes: false,
    },
    additionalConfig: {
      iterateStudyCases: false,
      iterateOperatingScenarios: false,
      useProgressBar: true,
      openPowerFactoryWindow: false,
      saveIntermediateEnabled: false,
      saveIntermediateMinutes: 30,
    },
  };
}

// Field templates (used when normalising partial rows) ------------------------
export function defaultInputVariable() {
  return { name: '', object_query: '', variable: '', lower: '0', upper: '10', step: '0.5', dtype: 'float' };
}

export function defaultOutputVariable() {
  return {
    id: '', type: 'attribute', name: '', object_query: '', variable: '',
    metric: 'maximum', threshold: '', settle_band: '', settle_hold_time: '',
    settle_reference_value: '', customFn: '', output_graph: false, output_raw_csv: false,
  };
}

// Human-readable field documentation (returned by the get_schema tool) --------
export const FIELD_DOCS = {
  'initialisation.powerfactoryApiPath':
    'String. Path appended to sys.path so `import powerfactory` works (e.g. the DIgSILENT "Python\\3.x" folder). Safe to leave "" — the user fills it in the tool.',
  'initialisation.username':
    'String. Username passed to pf.GetApplication(username). Safe to leave "".',
  'initialisation.outputDir':
    'String. Directory where result CSVs are written. Safe to leave "" — the user sets it in the tool.',
  'initialisation.problemType':
    'One of brute_force | optimisation | custom | contingency. Picks the study driver. See field-reference for how each changes the required sections.',
  'initialisation.studyType':
    'One of steady_state | dynamic_rms | dynamic_emt | harmonic. Timeseries outputs require dynamic_rms or dynamic_emt. Contingency forces steady_state.',
  'initialisation.codingStyle':
    'One of python_file | notebook. Output format only; does not change the config shape.',
  'initialisation.tstop':
    'String number. Simulation stop time in seconds; used only for dynamic_rms / dynamic_emt.',

  'inputVariables[]':
    'Array of swept/optimised parameters. Required (>=1) for every problemType EXCEPT contingency, where it must be [].',
  'inputVariables[].name':
    'Python identifier used as the results CSV column header. Must be unique across ALL input and output names.',
  'inputVariables[].object_query':
    'PowerFactory object path ending in a class suffix, e.g. "G2.ElmSym", "Fault.EvtShc". Wildcards (*.ElmLne) allowed.',
  'inputVariables[].variable':
    'Attribute to set on the object, e.g. "pgini", "e:time", "K_droop".',
  'inputVariables[].lower / .upper':
    'String numbers. Range bounds. Used by brute_force (with step) and optimisation (as bounds).',
  'inputVariables[].step':
    'String number. Increment for brute_force sweeps. Ignored by optimisation.',
  'inputVariables[].dtype':
    'float | int. Inferred from lower/upper/step (all integers => int). Set "float" if unsure.',

  'outputVariables[]':
    'Array of measured results. Required (>=1). Each has type attribute | timeseries | custom_calculation.',
  'outputVariables[].id':
    'Internal DOM id like "ov-0". Auto-assigned by create_template if omitted — you never need to set it.',
  'outputVariables[].type':
    'attribute (scalar via GetAttribute) | timeseries (metric over a dynamic result) | custom_calculation (user Python fn).',
  'outputVariables[].name':
    'Python identifier / CSV column header. Unique across all input+output names. Invalid identifiers are sanitised (warn).',
  'outputVariables[].object_query':
    'Object path ending in a class suffix. Required for attribute and timeseries; omit/ignore for custom_calculation.',
  'outputVariables[].variable':
    'Attribute/result variable to read, e.g. "m:P:bus1", "m:THD", "s:firel".',
  'outputVariables[].metric':
    'timeseries only. One of maximum|minimum|mean|median|first_time_above|first_time_below|time_settle.',
  'outputVariables[].threshold':
    'Required when metric is first_time_above or first_time_below. String number.',
  'outputVariables[].settle_band / .settle_hold_time / .settle_reference_value':
    'All three required when metric is time_settle. String numbers.',
  'outputVariables[].customFn':
    'custom_calculation only. Full Python `def name(args): ... return value`. Args must match other input/output names. Must return exactly one value.',
  'outputVariables[].output_graph / .output_raw_csv':
    'timeseries only booleans. Save a PNG / raw-CSV per scenario.',

  'optimisation':
    'Used only when problemType === "optimisation". sense minimise|maximise; objectiveOutputName must match an output name; algorithm from the enum; maxIterations integer; constraints [{output, operator >=|<=|==, value}].',
  'customMode.scenarioFilePath':
    'Used only when problemType === "custom". Path to the .xlsx scenario workbook (required in custom mode).',
  'contingencyMode':
    'Used only when problemType === "contingency". elementTypes [{query "*.ElmLne", filterAttr, filterOp, filterVal}] — >=1 with a query. contingencyN "1"|"2"; combineTypes bool (N-2 cross-type pairs).',
  'additionalConfig':
    'Global toggles: iterateStudyCases, iterateOperatingScenarios, useProgressBar, openPowerFactoryWindow, saveIntermediateEnabled (+ saveIntermediateMinutes). All optional; defaults are safe.',
};
