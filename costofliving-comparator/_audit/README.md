# Cost of Living Comparator — audit harness

Serves the repo over localhost (the page fetches its JSON), drives the real
page headless: recomputes the simple-mode estimates independently, tests the
custom-FX summary, detailed-mode overrides across row deletion, data
completeness of currency_rates.json, and the FX-shock slider's split: the
index-based estimate and the destination savings ratio must hold still while
the cross-currency figures track the shocked rate. It also checks the ⇆ swap
button: cities, pickers and salaries change sides, the custom FX rate is inverted
rather than dropped, and the monthly expense adopts the estimate that was on
screen for the destination. Finally it checks the detailed table's layout:
no absolutely positioned element may escape to the page (the currency tags
once did, stacking on one spot over the card), and every currency tag must
sit inside its own cell.

`freq.mjs` is the accounting integrity audit for Detailed mode's custom
frequency checkbox, a conversion add-on that changes the units amounts are
typed in, never the money. Unticked, the table must match the pre-feature
page (commit `0127cc7`) cell by cell; ticked with every row left monthly,
nothing may move. Every switch of period or unit (week, fortnight, month,
year, per meal, per kWh, per litre, per US gallon, per trip), of a quantity's
period, of Net Income's period or Savings' display period must leave every
column's money where it was, including through a sweep of 60 random switches,
unticking and ticking again, and a reload. Every Savings and Required salary
cell is replayed from the raw JSON and the page state, without the tool's code.

Run: `node run.mjs` and `node freq.mjs`
