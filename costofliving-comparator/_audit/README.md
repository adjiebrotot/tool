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

Run: `node run.mjs`
