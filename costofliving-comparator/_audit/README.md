# Cost of Living Comparator — audit harness

Serves the repo over localhost (the page fetches its JSON), drives the real
page headless: recomputes the simple-mode estimates independently, tests the
custom-FX summary, detailed-mode overrides across row deletion, and data
completeness of currency_rates.json.

Run: `node run.mjs`
