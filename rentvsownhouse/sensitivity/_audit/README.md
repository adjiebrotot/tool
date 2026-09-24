# Rent vs Own Sensitivity — audit harnesses

Both pages run the one engine, `../../engine.js`, so a disagreement can only
come from how each page turns its inputs into the engine's state.

`node parity.mjs [count]` types the same scenarios (fixed edge cases plus
seeded random ones across every mode) into the main page's sidebar and this
page's first column, and requires the Own and Rent cashflow exports to be
byte-identical.

`node run.mjs` checks the defaults match between the two pages, the table
outputs against the CSVs, and the summary-CSV column layout.
