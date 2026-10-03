# Rent vs Own Sensitivity — audit harnesses

Both pages run the one engine, `../../engine.js`, so a disagreement can only
come from how each page turns its inputs into the engine's state.

`node parity.mjs [count]` types the same scenarios (fixed edge cases plus
seeded random ones across every mode) into the main page's sidebar and this
page's first column, and requires the Own and Rent cashflow exports to be
byte-identical.

`node run.mjs` checks the defaults match between the two pages, the table
outputs against the CSVs, and the summary-CSV column layout. It also opens the
summary CSVs in `fixtures/`, exported before the October 2026 relabel (English
and Indonesian, simple and detailed), and requires every value in them to come
back out: the importer reads rows by label, so a renamed row must keep its old
label in `LEGACY_ROW_LABELS` or files people already saved lose it.
