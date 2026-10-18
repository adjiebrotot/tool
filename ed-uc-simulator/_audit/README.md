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
- every unit stays between its minimum and its available output: a committable unit while it is
  committed, every other unit in every hour (under economic dispatch every unit, and under the
  economic dispatch with no minimum output none), below what is available when that is less; a
  committable unit is on or off (or between, in the relaxation), ramp limits hold between two hours it runs in,
  a unit that starts reaches at most its minimum plus one hour's ramp up and the hour before it
  stops runs at most its minimum plus one hour's ramp down, and minimum up and down times hold,
  counted from its state before the first hour;
- start-ups and shut-downs follow the commitment;
- storage energy follows what flows in and out at the square root of the round-trip efficiency,
  stays within its capacity and ends where it started when it is cyclic;
- a cost curve is its definition's pieces: 16 in all, equal from 0 MW to the minimum stable loading
  and on to the rating, each at the chord of a·P + q·P² + k·P³, never falling, so they fill in order;
- the cost recomputed from all of that, each curve piece by piece, equals the tool's cost, which
  equals PyPSA's objective (plus, under economic dispatch, the committable units' no-load cost in
  every hour, which the objective leaves out as a constant).

The cases are every Quick Start in all four modes, 30 seeded random networks (typed and
custom lines, transformers, committable units with every kind of cost and limit, solar and wind
availability, every load profile, storage, lossy and lossless links one way or both, limits on
and off, 24 and 48 hours), and the same networks again (seeds 31 to 50) with linear and quadratic
cost curves and minimum stable loading on units that are not committable, in every mode.

**A3. Unit commitment is optimal.** Fifteen seeded one-bus cases of three units over five or six
hours, with minimum output, start-up, shut-down and stand-by costs, minimum up and down times
and a starting state, are solved again by enumerating every commitment schedule that respects the
up and down times (4,096 to 262,144 of them), each hour dispatched by merit order above the
running units' minimums, shedding at the value of lost load. The tool's mixed-integer answer must
cost no more than the cheapest of them plus HiGHS's 0.01% gap, and no less than it minus the
solver's feasibility tolerance. The linear relaxation and economic dispatch of the same case are
relaxations of it, so they must never cost more.

**A3c. Unit commitment with cost curves is optimal.** Ten seeded one-bus cases of three committable
units with linear or quadratic marginal costs over five hours, enumerated as in A3, each hour
paying every running unit's pieces up to its minimum and filling the rest from all their pieces
above it, cheapest first. The relaxation and the economic dispatch with no minimum output never
cost more.

**A3b. A ramp limit never stops a unit starting or stopping.** PyPSA writes a committable unit's
ramp rows with the change in status, so with its start-up and shut-down ramps left at the full
rating a unit that ramps 31% an hour could start only at 69% of its rating or more, and stop only
from 52% or more, and load was shed instead. One 217 MW unit (minimum 41%, ramps 48% up and 31%
down) must serve 100 MW for two hours from off, from the first hour, and until it stops, each at
its cost with nothing shed; asked for 217 MW for two hours between idle ones, it starts at its
minimum plus a ramp and stops from its minimum plus a ramp down. The same networks solved in
PyPSA 1.4 give the same answers.

**A4. The prices are marginal costs.** On an uncongested case, a unit running strictly between
its limits sets the price at its bus to its marginal cost; a unit at its available output is no
dearer than the price, and an idle one no cheaper. Checked under the economic dispatch with no
minimum output, under economic dispatch and under unit commitment (both with ramp limits removed),
where the prices come from the second, linear run with the commitment held as found; each check
has to look at some unit-hours. With a cost curve, a unit inside one of its pieces sets that piece's
slope (uc3 with curves under both economic dispatches and unit commitment, and the solar case
with a quadratic gas turbine); a unit at a breakpoint is left out, its price is anywhere between
the two slopes.

**A5. The engine.** `engine/psa-opt.min.js` hashes to the sha256 in its own banner, and
`engine/highs.wasm` to the sha256 that `engine/highs.mjs` names.

**A10. Held to PyPSA itself.** `pypsa-cases.mjs` writes eleven networks in the tool's saved form
with the hourly series the tool derives from their profiles; `pypsa-bench.py` builds each one in
PyPSA 1.4 its own way, from the saved form, and solves it with HiGHS; its answers are checked in
as `pypsa-fixtures.json`, so the audit needs no Python:
- a cost curve against PyPSA's piecewise `marginal_cost` (the same breakpoints, cumulative):
  uc3 with a linear coal unit, a quadratic combined cycle and a linear peaker under unit
  commitment and both economic dispatches; Two areas with curves and a hydro unit that is not
  committable held at 20%; the solar case with a quadratic gas turbine; uc3 with no unit
  committable and minimums held. The objective is PyPSA's to 1e-9 (a mixed-integer one within
  the 0.01% gap), and a linear problem's dispatch (bar storage, which can trade hours at no cost)
  and every nodal price are PyPSA's;
- the linear relaxation against the same pieces built as plain PyPSA components (PyPSA's piecewise
  cost scales its pieces with the unit's status, which makes the relaxation mixed-integer);
- linear marginal costs against PyPSA's exact quadratic cost (`marginal_cost_quadratic`, a QP):
  the pieces never cost less than the exact optimum and no more than their chord error above it
  (q × w² / 4 a unit and hour), and every price is within half a piece's rise (q × w).

Rebuild the fixtures after changing the cases or the model:

```sh
node ed-uc-simulator/_audit/pypsa-cases.mjs
python ed-uc-simulator/_audit/pypsa-bench.py   # PyPSA 1.4 or later, with highspy
```

HiGHS solves the exact quadratic cost in economic dispatch and the relaxation, but not in a
mixed-integer unit commitment: it has no MIQP solver ("Cannot solve MIQP problems with HiGHS",
in PyPSA 1.4 as in the browser). A quadratic marginal cost is a cubic cost, which no QP takes.
So every mode solves a curve as pieces.

**A11. Saved state from before.** A v1 network's unit that is not committable loses the
minimum it never had (it ran from zero), a committable one keeps its own, and the object read is
left as it was; solved, the v1 unit still runs below its minimum and the same unit saved as v2
never does. Unknown, negative, word and capitalised curve values fall back or are read. The old
economic dispatch keeps its value (`ed`) and its meaning beside the new one (`edm`), and with no
minimums anywhere they are the same problem. A flat curve solves as its scalar, bit for bit; a
falling one, and minimums that cannot fit under the load in economic dispatch, are errors in the
checks.

**A6. The calendar,** against JavaScript's own dates: every built-in profile, from four starts
(including a mid-morning one and a leap year), takes the clock hour from its start, demand its
weekday factor (Monday first) and a unit its day of the horizon; hours are labelled
dd/mm/yyyy HH:00 from the start; a horizon stops at 30 days and a start is a whole hour of a real
date; and a start on a Monday at 00:00 gives what the tool gave before it had a start date.

**A7. Daily variability and profiles from a file,** against their definition and JavaScript's own
calendar: every profile (flat, custom and each built-in, for loads and units), with and without
daily variability, from five starts over 30 days, is its hourly value × its weekday's factor (a
unit never above 1), and one from a file gives each hour the value its date and time has in the
file. 80% at 14:00 on a 50% Thursday is 40%. A profile with neither computes what it did before,
bit for bit; turning daily variability on starts from the profile's own days, so no hour moves;
both survive saving and reading back, a network saved before them writes neither, and broken
values never throw. A file that stops short of the horizon is an error naming both spans. Solved:
the 80% × 50% example dispatches 80 MW at that hour; every Quick Start with daily variability on
from its own days costs the same to the cent, and with its profiles given as a file the same to
the file's rounding; 15 seeded networks with daily variability and files pass the A2 replay, with
the demand and availability the solver saw equal to the definition's.

**A8. Reading a file,** CSV or Excel: the template has a row per hour of the horizon from the first
hour and a column per load and generator; opened as it is, it changes nothing. A year of shuffled
rows finds the horizon's hours by date and time and leaves the rest out. A file is turned away,
saying why, when it is short at the start, the end or both, misses an hour, repeats one (a clock
change), is half-hourly, has no dates, or holds a word, a blank or a date that is not one; one bad
column turns the whole file away. Dates written ISO, day first, month first with AM and PM, with a
month name or a two-digit year land on their hours; commas, semicolons with decimal commas and
tabs, % and MW headers, negatives and values above a rating are read as they say, and a number
with both marks takes the last as its decimal (1,234.5 in a tab-separated file, 1.234,5 with
semicolons). A load in MW gets the file's highest hour as its peak. The Excel template holds real date cells read back from
the serial number, and 1904-system and .xls workbooks are read too.

**A9. Fast:** 302,400 profile values (420 loads and units over 30 days) in a few milliseconds, the
checks over them in tens, a year of hours for 40 columns as CSV in tens of milliseconds and as a
10 MB Excel workbook in about a second.

**B. The real page in headless Chromium,** served over http because the engine is an ES module
in a module worker:
- the first solve runs in the worker;
- for every Quick Start, the cost and average price cards say what the result says, and the
  hours table (as its CSV) has every hour and its costs add up to the operating cost;
- the Run gate is honest: an electrical edit is stale, undo clears it, a move does not make it
  stale, a new horizon or start date does, and Run refreshes;
- the diagram's SVG export is strict XML;
- 12 buses and 20 units over a week solve as a unit commitment in a few seconds;
- 30 days from 01/07/2026 solve, and the hour readout, the subtitle and every row of the hours
  table are dated from that start;
- a mini cache from before the horizon was a number and a unit (`edHours`, no start date) opens
  on the same horizon from a Monday, so it solves as it did;
- empty, null, non-JSON, future-version and hostile saved state never throws, injects markup
  or stops the page solving.
- Daily variability through the inspector: the toggle draws Monday to Sunday bars from the
  shape's own days, says and draws hourly × daily, and solves to the same cost; dragging
  Thursday's bar to half halves Thursday's demand in the run;
- the Excel and CSV templates from the Dispatch tab hold the horizon's hours from the first hour
  and the same numbers; opened as downloaded they change nothing; an edited one is applied, shown
  in the inspector and used by the run; a horizon past the file's last hour stops the run in the
  checks and beside the profile; a short file is turned away and changes nothing;
- From a file in the inspector opens the file chooser, and a column in MW sets the peak demand;
  choosing a shape again lets the file go; undo brings it back, and a reload keeps it all;
- a year of hours opened on the page is applied in well under a second.
- A generator's type through the inspector: a Generator offers its minimum stable loading, a
  marginal cost curve, commitment and ramping; Solar resets and hides what it does not use and
  takes the sun's availability; back to a Generator, it starts as a new one, committable at 30%.
- A cost curve through the inspector: Linear seeds a rising slope and draws the curve with its
  pieces; Quadratic adds a curvature; both are stored in PyPSA's convention; pointing at the curve
  reads it; the page's run is the core's on the same network and What this assumes names the
  pieces; the diagram labels the unit with its marginal cost at the hour's output; Scalar again
  costs what it did.
- PJM 5-bus opens as the economic dispatch that holds minimums; Sundance at 25% never runs below
  50 MW, and the economic dispatch with no minimum output runs it from zero, as Li and Bo have it.
- A cache from before keeps its economic dispatch as it was, and its units that are not
  committable lose the minimum they never had.

The engine's own build (`_build/build-engine.mjs`) runs a separate check:
- PSA.js's own unit commitment and dispatch parity scenarios (`opt_uc`, `opt_uc_more`,
  `opt_committable_extendable`, `opt_misc`) through the shipped bundle: every LP file, objective,
  status and network must match PyPSA's fixtures;
- every Quick Start in all four modes through the shipped, pruned and minified bundle must give
  results identical, bit for bit, to an unpruned bundle of the PSA.js source.

The Share menu, embeds, exports at every screen size and the GIF are held by
`_ref/share-check.mjs` (ONLY=ed-uc-simulator), the charts by `_ref/chart-check.mjs`.
