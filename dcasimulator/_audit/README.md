# DCA Simulator — audit & regression harness

Pure-Node replay of both engines (`dcasimulator/` and `dcasimulator/portfolio/`),
loading the shared `SharedTA` library directly from `../../shared.js`. Used to verify
accounting integrity and cross-tool consistency against real Adj.Close data.

- `harness.js` — engine replay (verbatim from the two `script.js` files) + CSV loader.
- `run.js` — exercises every investment style and every rebalancing method with
  263 accounting-integrity assertions (conservation, fees, target weights, triggers).
  Part 5 covers the Price % move reference anchors (period open / previous top /
  previous bottom): each is replayed independently from its documented wording, then
  cross-checked for causality, saved-config compatibility and money conservation.
  The rolling top/bottom anchors get their own invariants — the window nests (widening
  it only ever adds fire days, or only ever removes them), and a step down followed by
  a flat run goes quiet exactly `lookback` bars later, which is the property that lets
  those anchors do without a firing bucket. It also lifts `buildAssetTriggerSignals`
  and the trigger form helpers straight out of `../portfolio/script.js` and runs them
  beside the copy here, so "verbatim" and "the form asks for what the engine reads"
  are checked properties rather than comments.
- `metrics.js` — confirms the two tools' time-weighted-return definitions agree.

Run: `node run.js` and `node metrics.js`.

- `integrity.js` - the one that keeps no copies. It lifts every engine function it
  runs straight out of `../script.js` and `../portfolio/script.js`, so it checks the
  code users run, and holds both tools to four promises:
  - **Accounting.** Every single-asset row is units x price with running totals, and
    CAGR (MWR) really zeroes the NPV of the cash flows. Every portfolio row closes as
    value = top-ups + interest - fees + market gain, with the market gain rebuilt
    independently from the day-to-day holdings and prices, for every method, fees on,
    a fixed cash rate and a cash ticker.
  - **Triggers.** The price path after a cut day is swapped for a different one, and
    every buy and ledger row up to the cut must not move, for every style, trigger and
    method. The four Forward styles are checked to fail this, as their warning says.
  - **Parity.** A date-based plan and a 100% single-asset portfolio topped up on the
    same day agree on every daily value, deposit, buy date, the final value and all four
    advanced metrics, on a weekday and a holiday calendar. A triggered plan (End of
    period on) and a Rule-Based portfolio agree on every buy and unit; the two tools
    book the money at different moments by design (the main tool when it buys, the
    portfolio when it is topped up), so their deposit lines differ during the wait.
    Prices landing exactly on a % threshold fire in both tools or neither.
  - **Display and data.** Percentages above 100%, the shared date axis the main
    tool's charts index by, the split-safe cache merge, and the Worker's exchange-day
    dating.

  `node integrity.js --ui` also opens one scenario file in both real pages, headless,
  and compares what is on screen: final value, ROI, total topped up, the four metrics,
  and the last row of each breakdown table. Chart.js is served from `_ref/.libcache/`.

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
