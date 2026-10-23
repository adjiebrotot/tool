// Optimise and search (DESIGN section 9, "search"): Optimise and Find limit run their Each try
// route once per try, as a function the search helper calls (kind 'callback'); Report this try
// tells the search how the try went.
//
// Type ids, setting keys, select option values, list row ids and port ids are frozen handles.
//
// The generator writes the Each try route as `def try_nN(<values>)` with a Trial (codegen.js
// emitCallback): every try starts from the same model, a try that raises counts as failed, and
// Report this try writes trial.report(score=..., ok=...) into the nearest search's Trial. The
// searches themselves are optimise.py's optimise() and find_limit() (API-analysis.md). After the
// search the model is back as it was before it; the After the search outputs carry the result,
// for the steps that apply it.

import { defineBlock } from '../core/registry.js';

const CAT = 'search';

const rowsOf = (v) => (Array.isArray(v) ? v.filter(r => r && typeof r === 'object') : []);
const pinnedKey = (cx, key) => (cx.node.pin || []).includes(key);
const numOrNull = (v) => { if (v === '' || v === null || v === undefined || typeof v === 'boolean') return null; const x = Number(String(v).replace(',', '.')); return Number.isFinite(x) ? x : null; };

// The name a search's tries are known by (table column, file names, log): the Name setting,
// else the reader's label, else `fallback`.
const searchName = (s, node, fallback) => String((s && s.name) || '').trim() || String((node && node.label) || '').trim() || fallback;

// ---------------------------------------------------------------------------------------------
// Optimise

// The variables with unique names (the Trial and optimise() key the values by name).
function variablesOf(s) {
  const seen = new Map();
  return rowsOf(s.vars).map((r, k) => {
    let name = String(r.name || '').trim() || `Value ${k + 1}`;
    const c = seen.get(name) || 0;
    seen.set(name, c + 1);
    if (c) name = `${name} (${c + 1})`;
    return { id: r.id, name, lower: numOrNull(r.lower), upper: numOrNull(r.upper), integer: r.integer === true || r.integer === 'true' };
  });
}

const METHODS = [
  ['de', 'Differential evolution (robust, the default)'],
  ['nelder', 'Nelder-Mead (few smooth variables)'],
  ['powell', 'Powell (few smooth variables)'],
  ['bounded', 'Bounded search (one variable)'],
  ['grid', 'A grid of values (every combination)'],
  ['bayes', 'Bayesian (expensive runs; uses scikit-optimize when installed)'],
];

const optimisePorts = (s) => {
  const vars = variablesOf(s);
  return {
    outputs: [
      ...vars.map(v => ({ id: v.id, label: v.name, type: 'num', scope: 'body', var: v.name, tip: 'The value of this try.' })),
      ...vars.map(v => ({ id: 'best_' + v.id, label: `Best ${v.name}`, type: 'num', scope: 'done', var: `best ${v.name}` })),
      { id: 'score', label: 'Best score', type: 'num', scope: 'done', var: 'best_score' },
      { id: 'found', label: 'Found', type: 'bool', scope: 'done', var: 'found', tip: 'Yes when at least one try passed and gave a score.' },
      { id: 'history', label: 'History', type: 'hist', scope: 'done', var: 'history', tip: 'Every try, for Draw convergence curve.' },
    ],
  };
};

defineBlock({
  type: 'opt.optimise', cat: CAT, kind: 'callback',
  title: 'Optimise',
  desc: 'Tries values of one or more variables to make a score as small (or large) as possible, e.g. the dispatch with the best nadir. Report this try gives each score.',
  keywords: ['optimise', 'optimize', 'minimise', 'maximise', 'best', 'search', 'tune', 'parameter', 'differential evolution', 'Nelder-Mead', 'grid search', 'objective'],
  outputs: optimisePorts({ vars: [{ id: 'v1', name: 'Value' }] }).outputs,
  settings: [
    { key: 'vars', label: 'Variables', kind: 'list', rowPrefix: 'v', rowLabel: 'Variable', addLabel: 'variable',
      default: [{ id: 'v1', name: 'Value', lower: 0, upper: 100, integer: false }],
      columns: [
        { key: 'name', label: 'Name', kind: 'text', default: '' },
        { key: 'lower', label: 'Lowest', kind: 'number', default: 0 },
        { key: 'upper', label: 'Highest', kind: 'number', default: 100 },
        { key: 'integer', label: 'Whole numbers', kind: 'bool', default: false },
      ],
      tip: 'Each variable is an output on the Each try route with the value of that try, and a Best output After the search.' },
    { key: 'goal', label: 'Make the score', kind: 'select', default: 'min', noPin: true, options: [['min', 'As small as possible'], ['max', 'As large as possible']] },
    { key: 'method', label: 'Method', kind: 'select', default: 'de', options: METHODS, tip: 'Most need the scipy package (the script checks before it starts); A grid of values does not.' },
    { key: 'maxTries', label: 'Max tries', kind: 'number', default: 30, min: 1, step: 1, tip: 'Each try is one run of the Each try route (often a simulation), so keep it small.' },
    { key: 'gridSteps', label: 'Values per variable', kind: 'number', default: 5, min: 2, step: 1, more: true, showIf: (s) => s.method === 'grid' },
    { key: 'seed', label: 'Random seed', kind: 'number', default: 1, step: 1, more: true, showIf: (s) => s.method === 'de' || s.method === 'bayes', tip: 'The same seed gives the same tries.' },
  ],
  ports: optimisePorts,
  summary(s) {
    const v = variablesOf(s);
    return `${s.goal === 'max' ? 'Largest' : 'Smallest'} score over ${v.map(x => x.name).join(', ') || 'no variables'}, ${s.maxTries} tries`;
  },
  helpers: ['optimise'],
  emit(cx) {
    cx.helper('optimise');
    if (cx.s.method !== 'grid' || pinnedKey(cx, 'method')) cx.package('scipy');
    const vars = variablesOf(cx.s);
    const params = vars.map(v => cx.out(v.id));
    const named = String(cx.node.label || '').trim();
    const res = cx.name((named ? cx.label : 'optimise') + ' result');
    vars.forEach(v => cx.out('best_' + v.id, `(${res}.best or {}).get(${cx.lit(v.name)})`));
    cx.out('score', `${res}.best_score`);
    cx.out('found', `${res}.found`);
    cx.out('history', `${res}.history`);
    const spec = vars.map(v => `{"name": ${cx.lit(v.name)}, "lower": ${cx.lit(v.lower)}, "upper": ${cx.lit(v.upper)}, "integer": ${v.integer ? 'True' : 'False'}}`);
    return {
      lines: [],
      params,
      labels: vars.map(v => v.name),
      goal: cx.s.goal === 'max' ? 'max' : 'min',
      call: [`${res} = optimise(${cx.fn}, [${spec.join(', ')}], goal=${cx.lit(cx.s.goal === 'max' ? 'max' : 'min')}, method=${cx.val('method')}, ` +
        `max_tries=${cx.val('maxTries')}, seed=${cx.val('seed')}, grid_steps=${cx.val('gridSteps')}, label=${cx.lit(cx.label)})`],
    };
  },
  validate(cx) {
    const vars = variablesOf(cx.s);
    if (!vars.length) cx.error(`${cx.label} has no variables to try. Add at least one variable with a lowest and a highest value.`);
    for (const v of vars) {
      if (v.lower === null || v.upper === null) cx.todo(`Give variable "${v.name}" of ${cx.label} a lowest and a highest value.`);
      else if (v.lower >= v.upper) cx.error(`Variable "${v.name}" of ${cx.label}: the lowest value (${v.lower}) must be below the highest (${v.upper}).`);
    }
    if (cx.s.method === 'bounded' && vars.length > 1) cx.warn(`${cx.label}: Bounded search works on one variable; with ${vars.length} it uses Nelder-Mead instead.`);
  },
});

// ---------------------------------------------------------------------------------------------
// Find limit

const PASSES = [['low', 'Low values pass (find the largest that passes)'], ['high', 'High values pass (find the smallest that passes)']];

defineBlock({
  type: 'opt.limit', cat: CAT, kind: 'callback',
  title: 'Find limit',
  desc: 'Finds where a study goes from pass to fail by halving the gap between a passing and a failing value, e.g. the largest dispatch that keeps the nadir above a limit.',
  keywords: ['find limit', 'bisection', 'binary search', 'threshold', 'headroom', 'critical clearing time', 'CCT', 'hosting capacity', 'largest', 'smallest', 'margin', 'limit search'],
  inputs: [
    { id: 'lower', label: 'Lowest value', type: 'num', fallback: 'lower' },
    { id: 'upper', label: 'Highest value', type: 'num', fallback: 'upper' },
    { id: 'tol', label: 'Tolerance', type: 'num', fallback: 'tol', tip: 'The search ends when the gap between passing and failing is this small.' },
    { id: 'maxSteps', label: 'Max tries', type: 'num', fallback: 'maxSteps' },
  ],
  outputs: [
    { id: 'value', label: 'Value', type: 'num', scope: 'body', var: 'value', tip: 'The value of this try.' },
    { id: 'limit', label: 'Limit', type: 'num', scope: 'done', var: 'limit', tip: 'The last value that passed (always a value that was tried); empty when none passed.' },
    { id: 'found', label: 'Found', type: 'bool', scope: 'done', var: 'limit_found', tip: 'Yes when the search narrowed down to the tolerance.' },
    { id: 'status', label: 'Status', type: 'text', scope: 'done', var: 'search_status', tip: '`DONE`, `ALL PASS`, `ALL FAIL`, `INCONSISTENT`, `MAX STEPS`, `STOPPED` or `UNKNOWN`.' },
    { id: 'passing', label: 'Passing value', type: 'num', scope: 'done', var: 'passing' },
    { id: 'failing', label: 'Failing value', type: 'num', scope: 'done', var: 'failing' },
    { id: 'history', label: 'History', type: 'hist', scope: 'done', var: 'history', tip: 'Every try, for Draw convergence curve.' },
  ],
  settings: [
    { key: 'name', label: 'Name (table column and file names)', kind: 'text', default: '', placeholder: 'The block\'s name, or Value',
      tip: 'What the searched value is called in results tables, file names and the log.' },
    { key: 'lower', label: 'Lowest value', kind: 'number', default: 0 },
    { key: 'upper', label: 'Highest value', kind: 'number', default: 100 },
    { key: 'tol', label: 'Tolerance', kind: 'number', default: 1, min: 0, tip: 'The search ends when the gap between passing and failing is this small.' },
    { key: 'maxSteps', label: 'Max tries', kind: 'number', default: 20, min: 2, step: 1, tip: 'Both ends count as tries.' },
    { key: 'passes', label: 'Which side passes', kind: 'select', default: 'low', options: PASSES },
    { key: 'bracket', label: 'Start', kind: 'select', default: 'given', more: true,
      options: [['given', 'Try both ends first'], ['halve', 'Try the passing end, then halve towards the other']],
      tip: 'Halve is for a far end that may not even run: it never tries the failing end itself.' },
    { key: 'onUnknown', label: 'A try that gives no answer', kind: 'select', default: 'stop', more: true,
      options: [['stop', 'Stops the search (status UNKNOWN)'], ['fail', 'Counts as a fail'], ['pass', 'Counts as a pass']],
      tip: 'For example a load flow that does not converge, or UFLS UNDEFINED.' },
    { key: 'integer', label: 'Whole numbers only', kind: 'bool', default: false, more: true },
  ],
  summary(s) { return `${s.lower} to ${s.upper}, within ${s.tol}`; },
  helpers: ['find_limit'],
  emit(cx) {
    cx.helper('find_limit');
    const name = searchName(cx.s, cx.node, 'Value');
    const v = cx.out('value');
    const named = String(cx.node.label || '').trim();
    const res = cx.name((named ? cx.label : 'limit search') + ' result');
    for (const o of ['limit', 'found', 'status', 'passing', 'failing', 'history']) cx.out(o, `${res}.${o}`);
    return {
      lines: [],
      params: [v],
      labels: [name],
      goal: 'min',
      ctx: [cx.lit(name), v],
      call: [`${res} = find_limit(${cx.fn}, ${cx.in('lower')}, ${cx.in('upper')}, ${cx.in('tol')}, max_steps=${cx.in('maxSteps')}, ` +
        `passes=${cx.val('passes')}, bracket=${cx.val('bracket')}, on_unknown=${cx.val('onUnknown')}, label=${cx.lit(name)}, integer=${cx.val('integer')})`],
    };
  },
  validate(cx) {
    const lo = numOrNull(cx.s.lower), hi = numOrNull(cx.s.upper);
    if (!cx.has('lower') && !cx.has('upper') && lo !== null && hi !== null && lo === hi) cx.error(`${cx.label}: the lowest and highest values are the same (${lo}), so there is nothing to search.`);
    if (!cx.has('tol') && !(numOrNull(cx.s.tol) > 0)) cx.warn(`${cx.label}: the tolerance is 0, so the search runs until Max tries. Give a tolerance above 0.`);
  },
});

// ---------------------------------------------------------------------------------------------
// Report this try

defineBlock({
  type: 'opt.report', cat: CAT, kind: 'action', within: 'callback',
  title: 'Report this try',
  desc: 'Tells Optimise or Find limit how this try went: a score, a pass (yes, no, or unknown such as UFLS UNDEFINED), or both. Only works on the Each try route.',
  keywords: ['report', 'score', 'objective', 'pass', 'fail', 'result of try', 'search', 'optimise', 'find limit', 'trial', 'feedback'],
  inputs: [
    { id: 'score', label: 'Score', type: 'num', tip: 'For Optimise: the number to make small (or large).' },
    { id: 'pass', label: 'Pass', type: 'any', tip: 'For Find limit: yes / no, or a `PASS` / `FAIL` or `TRUE` / `FALSE` text. Empty or `UNDEFINED`: no answer.' },
  ],
  settings: [
    { key: 'passIs', label: 'Pass is', kind: 'select', default: 'yes', more: true, noPin: true,
      options: [['yes', 'The value wired in'], ['no', 'The opposite (for example UFLS FALSE passes)']],
      tip: 'The opposite turns yes into no and TRUE into FALSE, so UFLS can be wired straight in; UNDEFINED stays unknown.' },
  ],
  summary(s) { return s.passIs === 'no' ? 'Passes when the wired value is no / FALSE' : ''; },
  helpers: ['logic'],
  emit(cx) {
    if (!cx.trial) return ['pass  # Report this try only works on the Each try route of Optimise or Find limit'];
    let ok = 'None';
    if (cx.has('pass')) {
      ok = cx.in('pass');
      if (cx.s.passIs === 'no') { cx.helper('logic'); ok = `logic("not", ${ok})`; }
    }
    return [`${cx.trial}.report(score=${cx.has('score') ? cx.in('score') : 'None'}, ok=${ok})`];
  },
  validate(cx) {
    if (!cx.has('score') && !cx.has('pass')) cx.todo(`Connect a Score or a Pass to ${cx.label}, so the search knows how the try went.`);
  },
});
