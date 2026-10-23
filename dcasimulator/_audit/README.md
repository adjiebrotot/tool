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
  - **Trade at.** Every check above runs for all three fill modes (same day's close,
    next day's open, next day's close). Each decision is checked to fill exactly one
    day later in the next-day modes, at the open or close restated independently, and
    the portfolio's market gain is rebuilt with each new unit's fill-to-close move.
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

- `optimise.mjs` - the portfolio page's Optimise mode, which sweeps up to two
  settings of one portfolio. Its promise is that a tested value means exactly what
  the same value typed into the form means, so for every setting the mode offers
  (top-up amount, yearly increase and the whole top-up schedule; the rebalance
  schedule; risk-free rate and fees; target and rank weights with their
  slack; the momentum lookback; and every trigger setting) it opens a sweep, reads
  each sampled value's seven figures off the chart (the surface for two settings)
  and its daily breakdown CSV, then opens the same scenario in plain Simulate mode,
  sets that value through the form, presses Simulate, and requires the same final
  value, ROI and net (to 1e-9), the same printed Sharpe, Sortino and CAGRs, and the
  same CSV cell for cell. The slack split is also lifted from the page and fuzzed
  against an independently written one. Then the contracts: which fields offer a
  gauge under each method (trigger type and direction, the method, the reserve and
  Rebalance Timing never do, nor does Trade at), list values picked one by one in
  the editor, the weights editor (one gauge on the table's heading, up to two
  weights with one slack they share, a file that gave each its own running on the
  first one's, one picker offering only the mixes that ran, and a gate that stays
  shut when none can), a swept setting dropped when its field goes away, a
  period and its day never swept together, the two-setting limit, the 625-run cap,
  the locked portfolio bar, Cancel, saved state (reload, file, an old file, a file
  naming settings that no longer exist) and no page errors.
  Run: `node optimise.mjs` (`ONLY=<case>`, `JOBS=<n>`, 4 at once by default).

- `optimise-single.mjs` - the same promise for the single-asset page's Optimise
  mode, which sweeps up to two settings of one scenario. For every setting it offers
  (amount, yearly increase, day of the month, weekday, momentum threshold, frequency
  with the amount following it, the end-of-period buy, and every indicator number and
  choice under each technical style) it reads each sampled value's seven figures off
  the chart (the surface for two settings) and its breakdown CSV, then opens the same
  scenario in plain Simulate mode, sets that value through the form (the threshold is
  typed into its slider's readout, the frequency pressed, the box ticked), presses
  Simulate, and requires the same final value, ROI and net (to 1e-9), the same printed
  Sharpe, Sortino and CAGRs, and the same CSV row for row. Then the contracts: which
  fields offer a gauge under each style (never the asset, the style, Trade at, the
  seed, the risk-free rate or the dates), list values picked one by one, a setting
  dropped with its style, the two-setting limit, the 625-run cap, the locked scenario
  bar, Cancel, only the scenario on screen running, a click on the chart picking a
  value, the risk-free rate sending a sweep out of date, a rename kept in place, saved
  state (reload, file, an old file, a file naming settings or a scenario that no
  longer exist) and no page errors.
  Run: `node optimise-single.mjs` (`ONLY=<case>`, `JOBS=<n>`, 4 at once by default).
