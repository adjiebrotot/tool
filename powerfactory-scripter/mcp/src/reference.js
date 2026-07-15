// ============================================================================
// PowerFactory Scripter — curated field reference for the AI agent.
//
// This is a compact, self-contained cheat-sheet the agent's model can read to
// fill object_query / variable fields correctly and pick the right modes.
// It intentionally does not replicate the full ~500 KB parameter database that
// ships with the web tool — the tool's own smart autocomplete covers that after
// the JSON is uploaded.
// ============================================================================

// Element classes recognised by the tool's validator (used to warn on typos).
export const KNOWN_ELM_CLASSES = [
  'ElmArea', 'ElmAsm', 'ElmAsmsc', 'ElmBbone', 'ElmBmu', 'ElmBoundary', 'ElmBranch',
  'ElmCabsys', 'ElmComp', 'ElmCoup', 'ElmDcu', 'ElmDsl', 'ElmFeeder', 'ElmFile', 'ElmFilter',
  'ElmGenstat', 'ElmGndswt', 'ElmHvdcbi', 'ElmHvdcvsc', 'ElmIac', 'ElmLne', 'ElmLnesec',
  'ElmLod', 'ElmLodlv', 'ElmLodmv', 'ElmMdl', 'ElmNec', 'ElmNet', 'ElmPvsys', 'ElmRecmono',
  'ElmRelay', 'ElmRes', 'ElmSecctrl', 'ElmShnt', 'ElmSind', 'ElmStactrl', 'ElmSubstat',
  'ElmSvs', 'ElmSym', 'ElmTerm', 'ElmTow', 'ElmTr2', 'ElmTr3', 'ElmTr4', 'ElmTrain',
  'ElmTrb', 'ElmTrfstat', 'ElmTrmult', 'ElmVac', 'ElmVoltreg', 'ElmVsc', 'ElmVscmono',
  'ElmWind', 'ElmXnet', 'ElmZone', 'ElmZpu',
];

export const KNOWN_TYP_CLASSES = [
  'TypSym', 'TypAsm', 'TypTr2', 'TypTr3', 'TypTr4', 'TypLne', 'TypTow', 'TypGeo',
  'TypLod', 'TypLodlv', 'TypSwitch',
];

export const KNOWN_EVT_CLASSES = [
  'EvtShc', 'EvtSwitch', 'EvtLod', 'EvtSym', 'EvtGen', 'EvtParam', 'EvtTap', 'EvtOutage',
];

// The most common building blocks, with typical input/output variables. This is
// a guide, not an exhaustive list — any valid PowerFactory attribute works.
export const COMMON_ELEMENTS = [
  { class: 'ElmSym', what: 'Synchronous machine / generator',
    inputs: ['pgini (active power set-point, MW)', 'qgini (reactive power, Mvar)', 'usetp (voltage set-point, p.u.)', 'outserv (0/1)'],
    outputs: ['m:P:bus1 (active power)', 'm:Q:bus1 (reactive power)', 's:firel (rotor angle, RMS)', 's:speed (rotor speed, RMS)'] },
  { class: 'ElmTerm', what: 'Busbar / terminal',
    inputs: [],
    outputs: ['m:u (voltage magnitude, p.u.)', 'm:U (voltage, kV)', 'm:phiu (voltage angle)', 'm:THD (total harmonic distortion, harmonic study)', 'b:fehz (frequency, RMS)'] },
  { class: 'ElmLne', what: 'Line / cable',
    inputs: ['outserv (0/1)'],
    outputs: ['m:P:bus1 (active power flow)', 'm:Q:bus1 (reactive power flow)', 'm:I:bus1 (current, kA)', 'c:loading (loading %)'] },
  { class: 'ElmTr2', what: '2-winding transformer',
    inputs: ['nntap (tap position)', 'outserv (0/1)'],
    outputs: ['c:loading (loading %)', 'm:P:bushv', 'm:Q:bushv'] },
  { class: 'ElmLod', what: 'General load',
    inputs: ['plini (active power, MW)', 'qlini (reactive power, Mvar)', 'scale0 (scaling factor)'],
    outputs: ['m:P:bus1', 'm:Q:bus1'] },
  { class: 'ElmXnet', what: 'External grid / slack',
    inputs: ['usetp (voltage set-point, p.u.)', 'pgini'],
    outputs: ['m:P:bus1 (import/export)', 'm:Q:bus1'] },
  { class: 'ElmGenstat', what: 'Static generator (PV / battery / WTG)',
    inputs: ['pgini', 'qgini', 'outserv'],
    outputs: ['m:P:bus1', 'm:Q:bus1'] },
  { class: 'ElmShnt', what: 'Shunt / filter / capacitor',
    inputs: ['ncapa (number of steps)', 'outserv'],
    outputs: ['m:Q:bus1'] },
  { class: 'ElmFilter', what: 'Harmonic filter',
    inputs: ['nres (tuning order)', 'qtotn (rated reactive power)'],
    outputs: ['m:Q:bus1'] },
  { class: 'ElmDsl', what: 'DSL controller model (dynamic)',
    inputs: ['any exposed controller parameter, e.g. K_droop, Tr'],
    outputs: [] },
  { class: 'EvtShc', what: 'Short-circuit event (dynamic study)',
    inputs: ['e:time (fault instant, s)', 'R (fault resistance)', 'X (fault reactance)'],
    outputs: [] },
  { class: 'EvtSwitch', what: 'Switch / breaker event (dynamic study)',
    inputs: ['e:time (switching instant, s)'],
    outputs: [] },
];

export const PROBLEM_TYPES = [
  { value: 'brute_force',
    when: 'Sweep every combination of the input ranges (grid search). Uses lower/upper/step per input.',
    requires: '>=1 inputVariables (each with step), >=1 outputVariables.' },
  { value: 'optimisation',
    when: 'Search input ranges to minimise/maximise one output. Uses lower/upper as bounds.',
    requires: '>=1 inputVariables, >=1 outputVariables, optimisation.objectiveOutputName set to an output name, optimisation.sense + algorithm.' },
  { value: 'custom',
    when: 'Run a fixed list of scenarios from an .xlsx workbook instead of a generated grid.',
    requires: '>=1 inputVariables (columns), customMode.scenarioFilePath set. Study runs one row per scenario.' },
  { value: 'contingency',
    when: 'N-1 / N-2 element outage screening. Trips elements out of service one/two at a time.',
    requires: 'inputVariables MUST be []. studyType MUST be steady_state. contingencyMode.elementTypes has >=1 entry with a query (e.g. *.ElmLne). >=1 outputVariables.' },
];

export const STUDY_TYPES = [
  { value: 'steady_state', what: 'Load flow (ComLdf). Default. Attribute outputs only.' },
  { value: 'dynamic_rms', what: 'RMS time-domain (ComInc rms + ComSim). Enables timeseries outputs. Set tstop.' },
  { value: 'dynamic_emt', what: 'EMT/instantaneous time-domain (ComInc ins + ComSim). Enables timeseries outputs. Set tstop.' },
  { value: 'harmonic', what: 'Harmonic load flow (ComHldf). Use m:THD and harmonic outputs.' },
];

export const METRICS = [
  { value: 'maximum', what: 'Peak value over the simulation.' },
  { value: 'minimum', what: 'Lowest value over the simulation.' },
  { value: 'mean', what: 'Time-average value.' },
  { value: 'median', what: 'Median value.' },
  { value: 'first_time_above', what: 'First time the signal exceeds `threshold` (requires threshold).' },
  { value: 'first_time_below', what: 'First time the signal drops below `threshold` (requires threshold).' },
  { value: 'time_settle', what: 'Time to settle within a band (requires settle_band, settle_hold_time, settle_reference_value).' },
];

export const ALGORITHMS = [
  { value: 'placeholder', what: 'Manual — generates the evaluation fn, you wire the loop. Good default if unsure.' },
  { value: 'scipy_nelder_mead', what: 'Nelder-Mead simplex (scipy). Gradient-free, no bounds.' },
  { value: 'scipy_powell', what: "Powell's directional set (scipy). Gradient-free, bounds." },
  { value: 'scipy_lbfgsb', what: 'L-BFGS-B (scipy). Quasi-Newton, bounds.' },
  { value: 'scipy_slsqp', what: 'SLSQP (scipy). Bounds + constraints.' },
  { value: 'scipy_cobyla', what: 'COBYLA (scipy). Gradient-free constrained.' },
  { value: 'differential_evolution', what: 'Differential Evolution (scipy). Global, robust, more evaluations.' },
  { value: 'gp_minimize', what: 'Bayesian optimisation (scikit-optimize). Best for expensive runs. Needs scikit-optimize.' },
];

export const OBJECT_QUERY_NOTES = [
  'Format is "<object name>.<ClassSuffix>", e.g. "G2.ElmSym", "Line 5-7.ElmLne", "Fault.EvtShc".',
  'The class suffix must be a PowerFactory class (Elm*, Sta*, Typ*, or Evt* for dynamic-event inputs).',
  'Wildcards are allowed: "*.ElmLne" matches all lines; used heavily in contingency mode and for filtered inputs.',
  'Names come from the user\'s PowerFactory project — leave a sensible guess; the user can correct object names in the tool after upload.',
  'Result variables usually carry a prefix: m: (calculated/steady), s: (state, RMS), c: (loading/derived), b: (bus), e: (event parameter).',
];

export function referenceBundle() {
  return {
    problemTypes: PROBLEM_TYPES,
    studyTypes: STUDY_TYPES,
    metrics: METRICS,
    algorithms: ALGORITHMS,
    commonElements: COMMON_ELEMENTS,
    objectQueryNotes: OBJECT_QUERY_NOTES,
    knownElmClasses: KNOWN_ELM_CLASSES,
    knownTypClasses: KNOWN_TYP_CLASSES,
    knownEvtClasses: KNOWN_EVT_CLASSES,
  };
}

export const SAMPLE_INDEX = [
  { name: 'sample-01-transmission-loss-factor', title: 'Transmission Loss Factor: Generation Shift', mode: 'brute_force / steady_state',
    about: 'Sweeps two generator dispatch set-points and records slack + line flows. Good template for a steady-state parameter sweep.' },
  { name: 'sample-02-minimum-system-losses', title: 'Minimum System Losses', mode: 'optimisation / steady_state',
    about: 'Optimises generator dispatch to minimise total system losses. Template for an optimisation study with an objective output.' },
  { name: 'sample-03-rotor-angle-stability', title: 'Rotor Angle Stability', mode: 'brute_force / dynamic_rms',
    about: 'Sweeps fault clearing time and measures max rotor angle via timeseries metrics. Template for an RMS dynamic study.' },
  { name: 'sample-04-n1-line-contingency', title: 'N-1 Line Contingency', mode: 'contingency / steady_state',
    about: 'Trips each line out of service and records bus voltages + line loadings. Template for contingency screening (inputVariables must be []).' },
  { name: 'sample-05-harmonic-filter-optimisation', title: 'HVDC Harmonic Filter Tuning', mode: 'optimisation / harmonic',
    about: 'Tunes a harmonic filter to minimise THD. Template for a harmonic study driven by optimisation.' },
  { name: 'sample-06-transformer-energisation-emt', title: 'Transformer Energisation Inrush', mode: 'brute_force / dynamic_emt',
    about: 'Sweeps breaker closing time and captures inrush current via EMT timeseries. Template for an EMT time-domain study.' },
];
