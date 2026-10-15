# ED/UC Simulator: audit harness

```sh
node ed-uc-simulator/_audit/run.mjs
```

It holds the tool's answers to things it did not compute itself. Everything below the page
section runs on the shipped engine (`engine/psa-opt.min.js` with `engine/highs.mjs` and
`engine/highs.wasm`) and the same `ed-core.js` the page's worker loads.

**A1. PJM 5-bus against Li and Bo.** F. Li and R. Bo, "Small test systems for power system
economic studies", IEEE PES General Meeting 2010. The Quick Start's loads follow a day that
peaks at 18:00 at the published 300, 300 and 400 MW, and at that hour the tool must give:
- every nodal price to the published cent: A $16.98, B $26.38, C $30.00, D $39.94, E $10.00;
- every unit's output: Alta 40, Park City 170, Solitude 323.49, Sundance 0, Brighton 466.51 MW;
- the hour's cost, $17,479.90;
- line D-E at its 240 MW limit, and no other limited line at its limit.

**A2. Every result replayed from the problem's definition,** by code that shares nothing with
PSA.js or PyPSA:
- each bus balances in every hour (units, storage, shedding, links and loads against the AC
  branch flows);
- the AC branch flows are the DC power flow of those injections, from a B-θ solve written here,
  per island, with PyPSA's per-unit bases (a line's ohms over its kV², a transformer's per unit
  over its rating);
- no branch passes its limit, and a link delivers its efficiency times what it sends, one way at
  a time, within its rating;
- every unit stays between its minimum (while on) and its available output, a committable unit
  is on or off (or between, in the relaxation), ramp limits hold between two hours it runs in,
  and minimum up and down times hold, counted from its state before the first hour;
- start-ups and shut-downs follow the commitment;
- storage energy follows what flows in and out at the square root of the round-trip efficiency,
  stays within its capacity and ends where it started when it is cyclic;
- the cost recomputed from all of that equals the tool's cost, which equals PyPSA's objective.

The cases are every Quick Start in all three modes and 30 seeded random networks (typed and
custom lines, transformers, committable units with every kind of cost and limit, solar and wind
availability, every load profile, storage, lossy and lossless links one way or both, limits on
and off, 24 and 48 hours).

**A3. Unit commitment is optimal.** Fifteen seeded one-bus cases of three units over five or six
hours, with minimum output, start-up, shut-down and stand-by costs, minimum up and down times
and a starting state, are solved again by enumerating every commitment schedule that respects the
up and down times (4,096 to 262,144 of them), each hour dispatched by merit order above the
running units' minimums, shedding at the value of lost load. The tool's mixed-integer answer must
cost no more than the cheapest of them plus HiGHS's 0.01% gap, and no less than it minus the
solver's feasibility tolerance. The linear relaxation and economic dispatch of the same case are
relaxations of it, so they must never cost more.

**A4. The prices are marginal costs.** On an uncongested case, a unit running strictly between
its limits sets the price at its bus to its marginal cost; a unit at its available output is no
dearer than the price, and an idle one no cheaper. Checked under economic dispatch, and under
unit commitment (ramp limits removed), where the prices come from the second, linear run with
the commitment held as found.

**A5. The engine.** `engine/psa-opt.min.js` hashes to the sha256 in its own banner, and
`engine/highs.wasm` to the sha256 that `engine/highs.mjs` names.

**B. The real page in headless Chromium,** served over http because the engine is an ES module
in a module worker:
- the first solve runs in the worker;
- for every Quick Start, the cost and average price cards say what the result says, and the
  hours table (as its CSV) has every hour and its costs add up to the operating cost;
- the Run gate is honest: an electrical edit is stale, undo clears it, a move does not make it
  stale, a new horizon does, and Run refreshes;
- the diagram's SVG export is strict XML;
- 12 buses and 20 units over a week solve as a unit commitment in a few seconds;
- empty, null, non-JSON, future-version and hostile saved state never throws, injects markup
  or stops the page solving.

The engine's own build (`_build/build-engine.mjs`) runs a separate check:
- PSA.js's own unit commitment and dispatch parity scenarios (`opt_uc`, `opt_uc_more`,
  `opt_committable_extendable`, `opt_misc`) through the shipped bundle: every LP file, objective,
  status and network must match PyPSA's fixtures;
- every Quick Start in all three modes through the shipped, pruned and minified bundle must give
  results identical, bit for bit, to an unpruned bundle of the PSA.js source.

The Share menu, embeds, exports at every screen size and the GIF are held by
`_ref/share-check.mjs` (ONLY=ed-uc-simulator), the charts by `_ref/chart-check.mjs`.
