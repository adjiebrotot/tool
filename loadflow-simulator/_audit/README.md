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
in `wscc9-published.json`, must match to the published digit: every bus voltage and angle,
and every unit's P and Q.

**A4. Balance.** Every bus balances, and the sources supply what is served plus what the
branches lose.

**A5. The engine.** `engine/psa-pf.min.js` hashes to the sha256 in its own banner.

**B. The real page in headless Chromium,** served over http because the engine is an ES
module:
- First render and first solve are quick.
- Every Quick Start converges within 10 iterations.
- The KPIs, verdict and all three CSV tables say exactly what the results say, and the
  verdict warns exactly when a limit is crossed.
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
  - text that is not JSON.

The engine's own build (`_build/build-engine.mjs`) runs a separate check:
- the shipped, pruned and minified bundle must give results identical, bit for bit, to an
  unpruned bundle of the PSA.js source on `pf_small`, 25 random networks and every preset;
- it must match PyPSA's fixture for `pf_small`.

The Share menu, embeds, exports at every screen size and the GIF are held by
`_ref/share-check.mjs` (ONLY=loadflow).
