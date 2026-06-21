# DCA Simulator — audit & regression harness

Pure-Node replay of both engines (`dcasimulator/` and `dcasimulator/portfolio/`),
loading the shared `SharedTA` library directly from `../../shared.js`. Used to verify
accounting integrity and cross-tool consistency against real Adj.Close data.

- `harness.js` — engine replay (verbatim from the two `script.js` files) + CSV loader.
- `run.js` — exercises every investment style and every rebalancing method with
  117 accounting-integrity assertions (conservation, fees, target weights, triggers).
- `metrics.js` — confirms the two tools' time-weighted-return definitions agree.

Run: `node run.js` and `node metrics.js` (point the CSV paths at local data first).
