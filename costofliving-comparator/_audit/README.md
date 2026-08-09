# Cost of Living Comparator — audit harness

Serves the repo over localhost (the page fetches its JSON), drives the real
page headless: recomputes the simple-mode estimates independently, tests the
custom-FX summary, detailed-mode overrides across row deletion, data
completeness of currency_rates.json, and the FX-shock slider's split: the
index-based estimate and the destination savings ratio must hold still while
the cross-currency figures track the shocked rate.

Run: `node run.mjs`
