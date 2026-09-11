# DCA Simulator — audit & regression harness

Pure-Node replay of both engines (`dcasimulator/` and `dcasimulator/portfolio/`),
loading the shared `SharedTA` library directly from `../../shared.js`. Used to verify
accounting integrity and cross-tool consistency against real Adj.Close data.

- `harness.js` — engine replay (verbatim from the two `script.js` files) + CSV loader.
- `run.js` — exercises every investment style and every rebalancing method with
  230 accounting-integrity assertions (conservation, fees, target weights, triggers).
  Part 5 covers the Price % move reference anchors (period open / previous top /
  previous bottom): each is replayed independently from its documented wording, then
  cross-checked for causality, bucketing, saved-config compatibility and money
  conservation. It also lifts `buildAssetTriggerSignals` straight out of
  `../portfolio/script.js` and diffs it against the copy here, so "verbatim" is a
  checked property rather than a comment.
- `metrics.js` — confirms the two tools' time-weighted-return definitions agree.

Run: `node run.js` and `node metrics.js`.

Price data: both prefer the real Adj.Close CSVs. Point at them with
`DCA_FIXTURE_DIR=/path/to/csvs node run.js`. If the CSVs are not found they fall
back to deterministic seeded GBM series with the same shape (low-vol money-market
proxy, long equity ETF, shorter-history equity ETF) and say so on the first line.
Every assertion is a structural invariant (conservation, fee accounting, target
weights, trigger parity), never a hardcoded value from a particular ticker, so the
same checks run either way — only the printed numbers differ.

- `seed_tz_audit.mjs` — custom-asset (GBM) determinism: same asset must give
  the same price path across DCA styles/amounts and across the two tools, and
  the generated date axis must not depend on the user's timezone.
  Run: `node seed_tz_audit.mjs`.
