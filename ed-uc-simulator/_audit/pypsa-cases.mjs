// The networks the ED/UC Simulator is held to PyPSA on (A10 in run.mjs).
//
//   node ed-uc-simulator/_audit/pypsa-cases.mjs
//   python ed-uc-simulator/_audit/pypsa-bench.py      (PyPSA 1.4 or later, with highspy)
//
// Writes pypsa-cases.json: each case is a network in the tool's saved form, the
// options it is solved with, and the hourly series the tool derives from its
// profiles (demand in MW, availability per unit of the rating), so the Python
// side needs none of the tool's profile code. pypsa-bench.py builds every case
// in PyPSA its own way, from the saved form, and writes pypsa-fixtures.json.

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
await import(pathToFileURL(join(HERE, '..', 'ed-core.js')).href);
const ED = globalThis.ED;

const byName = (m, n) => m.el.find(e => e.name === n);
function preset(key, edit) {
  const m = JSON.parse(JSON.stringify(ED.PRESETS[key].model));
  edit(m);
  return m;
}
// Three units with rising marginal costs: a linear coal unit, a quadratic
// combined cycle and a linear peaker.
const uc3c = preset('uc3', m => {
  Object.assign(byName(m, 'Coal'), { mcurve: 'lin', marginal_cost: 22, marginal_cost_quadratic: 0.015 });
  Object.assign(byName(m, 'Combined cycle'), { mcurve: 'quad', marginal_cost: 45, marginal_cost_quadratic: 0.025, marginal_cost_cubic: 0.0001 / 3 });
  Object.assign(byName(m, 'Peaker'), { mcurve: 'lin', marginal_cost: 105, marginal_cost_quadratic: 0.05 });
});
// The same with linear curves only, for PyPSA's exact quadratic cost.
const uc3l = preset('uc3', m => {
  Object.assign(byName(m, 'Coal'), { mcurve: 'lin', marginal_cost: 22, marginal_cost_quadratic: 0.015 });
  Object.assign(byName(m, 'Combined cycle'), { mcurve: 'lin', marginal_cost: 45, marginal_cost_quadratic: 0.03 });
  Object.assign(byName(m, 'Peaker'), { mcurve: 'lin', marginal_cost: 105, marginal_cost_quadratic: 0.05 });
});
// Two areas: the hydro unit is not committable and never runs below 20%, the
// combined cycle has a linear curve and the peakers a quadratic one.
const areasc = preset('areas', m => {
  Object.assign(byName(m, 'Hydro'), { p_min_pu: 0.2 });
  Object.assign(byName(m, 'Combined cycle'), { mcurve: 'lin', marginal_cost: 48, marginal_cost_quadratic: 0.02 });
  Object.assign(byName(m, 'Peakers'), { mcurve: 'quad', marginal_cost: 110, marginal_cost_quadratic: 0.02, marginal_cost_cubic: 0.0002 / 3 });
});
// Solar and a battery: the gas turbine has a quadratic curve.
const solarc = preset('solar', m => {
  Object.assign(byName(m, 'Gas turbine'), { mcurve: 'quad', marginal_cost: 55, marginal_cost_quadratic: 0.02, marginal_cost_cubic: 0.00009 / 3 });
});
// Minimum stable loading on units that are not committable, scalar costs.
const floors = preset('uc3', m => {
  m.el.forEach(e => { if (e.c === 'Generator') e.committable = 0; });
  Object.assign(byName(m, 'Coal'), { p_min_pu: 0.45 });
  Object.assign(byName(m, 'Combined cycle'), { p_min_pu: 0.25 });
});

const CASES = [
  ['uc3 curves, unit commitment', uc3c, { mode: 'uc', hours: 24 }, 'piecewise'],
  ['uc3 curves, economic dispatch', uc3c, { mode: 'edm', hours: 24 }, 'piecewise'],
  ['uc3 curves, economic dispatch from zero', uc3c, { mode: 'ed', hours: 24 }, 'piecewise'],
  ['uc3 curves, linear relaxation', uc3c, { mode: 'lin', hours: 24 }, 'links'],
  ['areas curves and a hydro floor, unit commitment', areasc, { mode: 'uc', hours: 72 }, 'piecewise'],
  ['areas curves and a hydro floor, economic dispatch', areasc, { mode: 'edm', hours: 72 }, 'piecewise'],
  ['solar and a quadratic gas turbine, unit commitment', solarc, { mode: 'uc', hours: 24 }, 'piecewise'],
  ['solar and a quadratic gas turbine, economic dispatch', solarc, { mode: 'edm', hours: 24 }, 'piecewise'],
  ['uc3 not committable with minimums, unit commitment', floors, { mode: 'uc', hours: 24 }, 'piecewise'],
  ['uc3 linear curves, economic dispatch, exact quadratic', uc3l, { mode: 'edm', hours: 24 }, 'quadratic'],
  ['uc3 linear curves, economic dispatch from zero, exact quadratic', uc3l, { mode: 'ed', hours: 24 }, 'quadratic']
];

const out = { pieces: ED.CURVE_PIECES, link_eps: ED.LINK_EPS, cases: CASES.map(([name, raw, opts, cost]) => {
  const model = ED.load(raw), o = ED.solveOptions(opts), series = {};
  model.el.forEach(e => {
    if (e.c === 'Load') series[e.id] = ED.loadSeries(e, o.hours, o.start);
    if (e.c === 'Generator') series[e.id] = ED.availSeries(e, o.hours, o.start);
  });
  return { name, cost, opts: o, model: ED.compact(model), series };
}) };
writeFileSync(join(HERE, 'pypsa-cases.json'), JSON.stringify(out, null, 1) + '\n');
console.log('wrote ' + out.cases.length + ' cases to pypsa-cases.json');
