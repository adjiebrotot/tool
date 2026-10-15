# Load Flow Simulator: audit harness

```sh
node loadflow-simulator/_audit/run.mjs
```

It holds the tool's answers to things it did not compute itself.

The replay, `nr-replay.mjs`, is a second load flow written from PyPSA's documented model, not
from PSA.js's code:
- a dense complex Y-bus;
- a T-to-π conversion for transformers;
- taps and phase shift;
- a polar Newton-Raphson with an analytic Jacobian;
- a B-θ DC load flow.

Its conventions (which side the tap sits on, and the sign of the phase shift) are pinned to
PyPSA's own results for PSA.js's `pf_small` parity scenario. Those results are copied into
`pypsa-pf-small.json` so the audit runs without a PSA.js checkout. The alternative
conventions miss them by 14 to 59 MW.

**A1. The replay against PyPSA.** A tap of 1.02 with a 5° phase shift, a shunt and a PV bus,
over two snapshots. Also two islands, each with its own slack. Agreement is to about 1e-13.

What the replay does not cover:
- It reads the standard line and transformer types from the engine's own tables.
- It has no distributed slack.
- An island with no generator (its slack bus held at 1 p.u. as an ideal source) is checked
  only against itself: PyPSA 1.4 raises an error there, so there is nothing to compare.

An independent audit compared the tool with real PyPSA 1.4.0 on every Quick Start (AC and DC)
and on the cases the replay leaves out: the tap on the second side, T and π models with
magnetising branches, typed transformers in parallel, two slacks in one island, and a
distributed slack by dispatch and by rating, over two islands. It agreed to 3e-12.

**A2. The tool against the replay.** Each case below must agree to V 1e-7 p.u., angle 1e-6°
and P/Q 1e-6 MW or MVAr:
- every Quick Start, solved three ways:
  - AC from the DC seed;
  - AC from a flat start (except the feeder, whose 150° transformer diverges from flat, in
    PyPSA as here);
  - DC.
- 40 seeded random networks, AC and DC, covering:
  - typed and custom lines;
  - typed and custom transformers, with taps on either side, phase shift, and T or π;
  - shunts and storage;
  - a second island behind an HVDC link.

**A3. WSCC 9-bus against Anderson and Fouad.** The Quick Start's published prefault load flow,
in `wscc9-published.json`, must match to the published third decimal (within 0.0005): every
bus voltage and angle, and every unit's P and Q.

**A4. Balance.** Every bus balances, and the sources supply what is served plus what the
branches lose.

**A4b. A link sent backwards.** A negative set point sends power from the second end to the
first. PyPSA applies the efficiency the wrong way round there (the far end gets more than was
sent, and the loss is negative), so the tool hands the link to the engine turned round and
turns its results back. The check holds the far end at p × efficiency and the loss positive.

**A5. The engine.** `engine/psa-pf.min.js` hashes to the sha256 in its own banner.

**A6. A diagram on a map.** The map's place (`model.map`) saves and reads back exactly, a
diagram saved before maps opens with none, and the map never enters what the power flow
sees. The georeference, the ground scale (Web Mercator) and the great-circle distance are
held to their formulas, and hostile map values never throw.

**B. The real page in headless Chromium,** served over http because the engine is an ES
module:
- First render and first solve are quick.
- Every Quick Start converges within 10 iterations.
- The KPIs, the run summary and all three CSV tables say exactly what the results say, and
  the voltage and loading KPIs turn red exactly when a limit is crossed.
- A value past a limit is printed with the digits that show it: 0.9497 p.u. against 0.95,
  never 0.950.
- The SVG export is strict XML, and the PNG is its picture at 2×.
- The Run gate is honest:
  - an electrical edit makes the results stale;
  - undo clears that, and the share signature comes back;
  - a move leaves the results valid;
  - Run refreshes them.
- A 200-bus network solves in under 100 ms.
- None of the following throws an error, injects markup or stops a run, whether it arrives
  through the mini cache or a scenario file:
  - empty or null state;
  - a future version;
  - unknown classes and keys;
  - strings and NaN in numbers;
  - branches to missing buses;
  - negative ratings and duplicate ids;
  - hostile strings;
  - a hostile map, and a map at the edge of the world;
  - text that is not JSON.

**B7. The map, offline.** Every tile is a white square with a dark band along its top and
left edges, the power grid answers with nothing and the place search with one known place:
- turning a map on places the diagram and opens Move the map, and never makes the result
  stale;
- a place found while moving the map lands under the middle of the view, the diagram
  unmoved; typed coordinates move the view there; on a map the view zooms out to a region
  and in to the street;
- through wheel zoom, a drag and its release, tile corners put through the SVG's own screen
  matrix land on the canvas's dark bands, while the map is carried by a CSS transform
  mid-gesture and once it is repainted;
- Move the map moves the map alone, and undo puts it back;
- a typed latitude and longitude lands a bus within half a grid step of it;
- the SVG and PNG carry the map and its credit; a reload brings the map back; None hides
  it and keeps its place.

The engine's own build (`_build/build-engine.mjs`) runs a separate check:
- the shipped, pruned and minified bundle must give results identical, bit for bit, to an
  unpruned bundle of the PSA.js source on `pf_small`, 25 random networks and every preset;
- it must match PyPSA's fixture for `pf_small`.

The Share menu, embeds, exports at every screen size and the GIF are held by
`_ref/share-check.mjs` (ONLY=loadflow).
