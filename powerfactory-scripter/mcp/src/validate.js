// ============================================================================
// PowerFactory Scripter — validation + normalisation.
//
// validate() mirrors validateConfig() (blocking errors) and getLiveWarnings()
// (non-blocking warnings) from powerfactory-scripter/script.js, so a config the
// MCP approves is one the web tool will also accept on "↑ JSON" import.
// ============================================================================

import {
  ENUMS, THRESHOLD_METRICS, SETTLE_METRICS,
  defaultConfig, defaultInputVariable, defaultOutputVariable,
} from './schema.js';
import { KNOWN_ELM_CLASSES, KNOWN_TYP_CLASSES } from './reference.js';

const KNOWN_ELM = new Set(KNOWN_ELM_CLASSES);
const KNOWN_TYP = new Set(KNOWN_TYP_CLASSES);

export function isPythonIdentifier(name) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name || '');
}

export function sanitizeName(name) {
  let s = String(name ?? '').replace(/[^A-Za-z0-9_]/g, '_');
  if (/^[0-9]/.test(s)) s = '_' + s;
  return s;
}

function inferDtype(lower, upper, step) {
  const vals = [lower, upper, step].filter(v => v !== '' && v !== null && v !== undefined);
  const allInt = vals.every(v => Number.isInteger(Number(v)));
  return allInt ? 'int' : 'float';
}

// ── Normalisation ───────────────────────────────────────────────────────────
// Deep-merge a partial config onto the defaults, fill row fields, assign output
// ids, and coerce obvious types so the emitted JSON imports cleanly.
export function normalizeConfig(input) {
  const base = defaultConfig();
  const cfg = input && typeof input === 'object' ? input : {};

  const init = { ...base.initialisation, ...(cfg.initialisation || {}) };

  const inputVariables = Array.isArray(cfg.inputVariables) ? cfg.inputVariables.map(row => {
    const r = row || {};
    const iv = { ...defaultInputVariable(), ...r };
    ['lower', 'upper', 'step'].forEach(k => { if (iv[k] != null) iv[k] = String(iv[k]); });
    // Infer dtype from the values unless the caller explicitly set it.
    if (!r.dtype) iv.dtype = inferDtype(iv.lower, iv.upper, iv.step);
    return iv;
  }) : [];

  const outputVariables = Array.isArray(cfg.outputVariables) ? cfg.outputVariables.map((row, i) => {
    const ov = { ...defaultOutputVariable(), ...(row || {}) };
    ov.id = ov.id || `ov-${i}`;
    ['threshold', 'settle_band', 'settle_hold_time', 'settle_reference_value'].forEach(k => {
      if (ov[k] != null && ov[k] !== '') ov[k] = String(ov[k]);
    });
    ov.output_graph = !!ov.output_graph;
    ov.output_raw_csv = !!ov.output_raw_csv;
    return ov;
  }) : [];

  const optimisation = { ...base.optimisation, ...(cfg.optimisation || {}) };
  optimisation.maxIterations = Number(optimisation.maxIterations) || base.optimisation.maxIterations;
  optimisation.constraints = Array.isArray(optimisation.constraints)
    ? optimisation.constraints.map(c => ({ output: '', operator: '>=', value: '', ...(c || {}) }))
    : [];

  const customMode = { ...base.customMode, ...(cfg.customMode || {}) };

  const contingencyMode = { ...base.contingencyMode, ...(cfg.contingencyMode || {}) };
  contingencyMode.elementTypes = Array.isArray(contingencyMode.elementTypes) && contingencyMode.elementTypes.length
    ? contingencyMode.elementTypes.map(t => ({ query: '', filterAttr: '', filterOp: '>=', filterVal: '', ...(t || {}) }))
    : base.contingencyMode.elementTypes;
  contingencyMode.combineTypes = !!contingencyMode.combineTypes;
  contingencyMode.contingencyN = String(contingencyMode.contingencyN || '1');

  const additionalConfig = { ...base.additionalConfig, ...(cfg.additionalConfig || {}) };
  ['iterateStudyCases', 'iterateOperatingScenarios', 'useProgressBar',
   'openPowerFactoryWindow', 'saveIntermediateEnabled'].forEach(k => {
    additionalConfig[k] = !!additionalConfig[k];
  });
  additionalConfig.saveIntermediateMinutes = Number(additionalConfig.saveIntermediateMinutes) || base.additionalConfig.saveIntermediateMinutes;

  return { initialisation: init, inputVariables, outputVariables, optimisation, customMode, contingencyMode, additionalConfig };
}

// ── Enum sanity (a lightweight guard the web tool doesn't do explicitly) ──────
function enumErrors(cfg) {
  const errors = [];
  const init = cfg.initialisation;
  const check = (val, list, label) => {
    if (val && !list.includes(val)) errors.push(`${label} "${val}" is not one of: ${list.join(', ')}.`);
  };
  check(init.problemType, ENUMS.problemType, 'Problem type');
  check(init.studyType, ENUMS.studyType, 'Study type');
  check(init.codingStyle, ENUMS.codingStyle, 'Coding style');
  cfg.outputVariables.forEach((ov, i) => {
    check(ov.type, ENUMS.outputType, `Output variable #${i + 1} type`);
    if (ov.type === 'timeseries') check(ov.metric, ENUMS.metric, `Output variable #${i + 1} metric`);
  });
  if (init.problemType === 'optimisation') {
    check(cfg.optimisation.sense, ENUMS.sense, 'Optimisation sense');
    check(cfg.optimisation.algorithm, ENUMS.algorithm, 'Optimisation algorithm');
  }
  return errors;
}

// ── Blocking validation (mirrors validateConfig) ─────────────────────────────
export function validateErrors(cfg) {
  const errors = [];
  const init = cfg.initialisation;
  if (!init.problemType) errors.push('Problem type is required.');
  if (!init.studyType) errors.push('Study type is required.');
  if (!init.codingStyle) errors.push('Coding style is required.');

  if (init.problemType !== 'contingency' && cfg.inputVariables.length === 0)
    errors.push('At least one input variable is required.');
  if (cfg.outputVariables.length === 0) errors.push('At least one output variable is required.');

  const allInputNames = cfg.inputVariables.map((iv, i) => iv.name || `input_${i}`);
  const allOutputNames = cfg.outputVariables.map(ov => ov.name).filter(Boolean);

  const seenIn = new Set();
  allInputNames.forEach((n, i) => {
    if (seenIn.has(n)) errors.push(`Input variable #${i + 1}: Name "${n}" is already used by another input variable.`);
    seenIn.add(n);
  });
  const seenOut = new Set();
  allOutputNames.forEach((n, i) => {
    if (seenOut.has(n)) errors.push(`Output variable #${i + 1}: Name "${n}" is already used by another output variable.`);
    seenOut.add(n);
  });
  const inSet = new Set(allInputNames);
  allOutputNames.forEach(n => {
    if (inSet.has(n)) errors.push(`Name "${n}" is used by both an input variable and an output variable. All variable names must be unique.`);
  });

  cfg.inputVariables.forEach((iv, i) => {
    if (!iv.object_query) errors.push(`Input variable #${i + 1}: Object is required.`);
    if (!iv.variable) errors.push(`Input variable #${i + 1}: Variable is required.`);
  });

  cfg.outputVariables.forEach((ov, i) => {
    if (!ov.name) errors.push(`Output variable #${i + 1}: Name is required.`);
    if (ov.name && !isPythonIdentifier(sanitizeName(ov.name)))
      errors.push(`Output variable #${i + 1}: Name "${ov.name}" is not a valid Python identifier (will be sanitized).`);
    if (ov.type !== 'custom_calculation' && !ov.object_query)
      errors.push(`Output variable #${i + 1} "${ov.name}": Object is required.`);
    if (ov.type === 'timeseries' && THRESHOLD_METRICS.includes(ov.metric) && !ov.threshold)
      errors.push(`Output variable "${ov.name}": Threshold is required for metric "${ov.metric}".`);
    if (ov.type === 'timeseries' && ov.metric === 'time_settle') {
      if (!ov.settle_band) errors.push(`Output variable "${ov.name}": Settle Band is required for Time Settle.`);
      if (!ov.settle_hold_time) errors.push(`Output variable "${ov.name}": Hold Time is required for Time Settle.`);
      if (!ov.settle_reference_value) errors.push(`Output variable "${ov.name}": Reference Value is required for Time Settle.`);
    }
    if (ov.type === 'custom_calculation' && (!ov.customFn || ov.customFn.trim().length < 5))
      errors.push(`Output variable "${ov.name}": Custom function body is required.`);
  });

  // Duplicate custom-function names
  const seenFn = new Set();
  cfg.outputVariables.forEach(ov => {
    if (ov.type !== 'custom_calculation') return;
    const first = (ov.customFn || '').trim().split('\n')[0];
    const m = first.match(/^def\s+(\w+)\s*\(/);
    if (!m) return;
    if (seenFn.has(m[1])) errors.push(`Custom function name "${m[1]}" is defined more than once. Each custom calculation must use a unique function name.`);
    seenFn.add(m[1]);
  });

  if (init.problemType === 'optimisation') {
    if (!cfg.optimisation.sense) errors.push('Optimisation: Sense is required.');
    if (!cfg.optimisation.objectiveOutputName) errors.push('Optimisation: Objective output variable is required.');
    else if (!allOutputNames.includes(cfg.optimisation.objectiveOutputName))
      errors.push(`Optimisation: Objective output "${cfg.optimisation.objectiveOutputName}" does not match any output variable name.`);
  }

  if (init.problemType === 'custom' && !cfg.customMode.scenarioFilePath)
    errors.push('Custom mode: Scenario file path is required.');

  if (init.problemType === 'contingency') {
    const types = cfg.contingencyMode.elementTypes || [];
    if (types.length === 0 || !types.some(t => t.query))
      errors.push('Contingency: at least one element query is required (e.g. *.ElmLne).');
    types.forEach((t, i) => {
      if (t.filterAttr && (t.filterVal === '' || t.filterVal === null || t.filterVal === undefined))
        errors.push(`Contingency element type ${i + 1}: filter value is required when a filter attribute is set.`);
    });
    if (cfg.inputVariables.length > 0)
      errors.push('Contingency: inputVariables must be empty ([]) — contingency mode does not use swept inputs.');
    if (init.studyType !== 'steady_state')
      errors.push('Contingency: study type must be steady_state.');
  }

  return errors.concat(enumErrors(cfg));
}

// ── Non-blocking warnings (mirrors getLiveWarnings) ──────────────────────────
function checkObjectQuery(objectQuery, label, allowEvt, warnings) {
  if (!objectQuery) return;
  const t = objectQuery.trim().split('.').pop();
  const isElm = t && t.startsWith('Elm');
  const isSta = t && t.startsWith('Sta');
  const isEvt = t && t.startsWith('Evt');
  const isTyp = t && t.startsWith('Typ');
  if (!t || (!isElm && !isSta && !isTyp && !(allowEvt && isEvt))) {
    const hint = allowEvt ? ', ".EvtShc", ".EvtSwitch"' : '';
    warnings.push(`${label}: Object "${objectQuery}" should end with a PowerFactory object type (e.g., ".ElmTerm", ".ElmDsl"${hint}).`);
    return;
  }
  if (isElm && !KNOWN_ELM.has(t)) warnings.push(`${label}: Object type "${t}" is not recognised from the PowerFactory API reference. Check for typos.`);
  if (isTyp && !KNOWN_TYP.has(t)) warnings.push(`${label}: Object type "${t}" is not recognised from the PowerFactory API reference. Check for typos.`);
}

function hasMultipleReturnValues(retVal) {
  let depth = 0;
  for (const ch of retVal) {
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if (ch === ',' && depth === 0) return true;
  }
  return false;
}

export function validateWarnings(cfg) {
  const warnings = [];
  const inputNames = cfg.inputVariables.map(iv => iv.name).filter(Boolean);

  cfg.outputVariables.forEach((ov, i) => {
    if (ov.type !== 'custom_calculation') return;
    const fn = (ov.customFn || '').trim();
    if (!fn) return;
    const others = cfg.outputVariables.filter((_, j) => j !== i).map(o => o.name).filter(Boolean);
    const valid = new Set([...inputNames, ...others]);
    const def = fn.match(/^def\s+\w+\s*\(([^)]*)\)/m);
    if (def) {
      def[1].split(',').map(a => a.trim()).filter(Boolean).forEach(arg => {
        if (!valid.has(arg)) warnings.push(`Output "${ov.name}": Function argument "${arg}" is not a defined input or output variable name.`);
      });
    }
    (fn.match(/\breturn\b[^\n]+/g) || []).forEach(ret => {
      const v = ret.replace(/#[^\n]*$/, '').replace(/\breturn\b/, '').trim();
      if (hasMultipleReturnValues(v)) warnings.push(`Output "${ov.name}": Function must return exactly one value (no tuples). Found: "${ret.trim()}"`);
    });
  });

  cfg.inputVariables.forEach((iv, i) => checkObjectQuery(iv.object_query, `Input variable #${i + 1}`, true, warnings));
  cfg.outputVariables.forEach((ov, i) => {
    if (ov.type === 'custom_calculation') return;
    checkObjectQuery(ov.object_query, `Output variable #${i + 1} "${ov.name || '(unnamed)'}"`, false, warnings);
  });

  const isDyn = cfg.initialisation.studyType === 'dynamic_rms' || cfg.initialisation.studyType === 'dynamic_emt';
  if (!isDyn && cfg.outputVariables.some(ov => ov.type === 'timeseries'))
    warnings.push('Timeseries output variables are available only for Dynamic RMS or Dynamic EMT study types.');

  return warnings;
}

export function validate(rawCfg) {
  const cfg = normalizeConfig(rawCfg);
  const errors = validateErrors(cfg);
  const warnings = validateWarnings(cfg);
  return { config: cfg, errors, warnings, ok: errors.length === 0 };
}
