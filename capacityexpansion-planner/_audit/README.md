# Capacity Expansion Planner: audit harness

```sh
node capacityexpansion-planner/_audit/run.mjs
```

It holds the tool's answers to things it did not compute itself. Everything below the page
section runs on the engine the page's worker loads (the ED/UC Simulator's build of PSA.js,
`ed-uc-simulator/engine/psa-opt.min.js` with `highs.mjs` and `highs.wasm`) and the same
`cx-core.js`.

**A0. Saved plans.** Garbage, missing keys, an unknown kind, words for flags and values past
their range all read back to a valid plan and never throw; every Quick Start written and read
again is the same plan; only values that differ from the defaults are written.

**A1. The typical days, rebuilt from their documented rules** by code written here, for every
climate, sampling (one day, a weekday and a weekend day, a week), stress day on and off and
load profile: every hour's weight, demand, sun and wind; the weights add up to 8,760 hours; the
highest hour of demand is the year's peak; and solar and wind farms give exactly their
capacity factor over the year, never above their rating, keeping their shape below it.

**A2. Every plan replayed from its definition,** by code that shares nothing with PSA.js:
- the decision years, the years each stands for, and the discount factors;
- what is in service in each year: the existing plant until its retirement year, each build
  from its year for its life, only in years it may be built in and in whole units;
- the demand of every sampled hour, met by generation, storage and shedding (none when
  shedding is off);
- every output inside its availability; storage within its power and energy, its state of
  charge following what goes in and out at the square root of the round trip, and ending each
  year where it started;
- build limits, and no CO2 from the net-zero year;
- the costs: capital annuities on each build in service, fixed O&M on everything in service,
  running costs, carbon at its rising price and lost load, discounted to the first year. Their
  sum, less the existing plant's fixed O&M (a constant the optimiser leaves out), equals
  PyPSA's objective.

The cases are every Quick Start in two samplings and 24 seeded random plans (every kind of
technology, existing plant with and without retirement, build limits, unit sizes, earliest
years, carbon prices, net zero, every climate, shedding on and off).

**A3. The plan is the cheapest.** With firm plants only and one decision year, the least-cost
mix has a closed form, the screening curve: each slice of the load duration curve is served
by whatever is cheapest for the hours it lasts, a plant's annual fixed cost over its
availability plus its running cost, or lost load. 20 seeded cases must cost exactly that. Over
two decision years, 12 seeded cases with two plants, a falling capital cost and lives shorter
and longer than a decision step are solved again by enumerating every build of each plant in
each year on a 20 MW grid, each hour dispatched by merit order: the tool's plan must cost no
more than the best of them.

**A4. The engine.** `psa-opt.min.js` hashes to the sha256 in its own banner, and `highs.wasm`
to the sha256 that `highs.mjs` names. The engine's build (`ed-uc-simulator/_build/build-engine.mjs`)
also runs this tool's Quick Starts through the reference and shipping bundles and requires
the same plan from both.

**B. The real page** in headless Chromium: the first plan solves on arrival; every Quick Start
solved in the page is the same plan as in Node, to the number, and its KPIs say what the
result says; the Capacity table totals what is in service; the Run gate dims a changed plan
until it is run; a technology card edits its technology and duplicates it under a new id; and
hostile saved state opens, reads back to a valid plan and solves.
