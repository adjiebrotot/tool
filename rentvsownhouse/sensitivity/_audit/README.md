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

Rows are matched by label, not position: the table (and the CSV) lists a
deciding field above the fields it governs, so the order has moved since those
files were saved. Each file is also reopened on the other language's page.

`node units.mjs` checks the units and groups: no Unit column, each field shows
the unit the engine reads it in (following the scenario's cost type, frequency
and currency), a switch between money and "%" restates the cost so year 1 costs
the same, a field shown as unused really changes nothing, each deciding field
sits above what it governs with no rule inside the group, and a blank field
means Auto where the field allows it.

`node presets.mjs` checks the Quick Start picker on the first column: every
scenario (a city and one of its homes) gives Own and Rent cashflow exports
byte-identical to the main page's Quick Start for it (both read
`../../quickstart-data.js`), sets the page currency, only the first column
carries the picker, also after a column is dragged, and its search lists
exactly the scenarios that carry every word typed.

`node drag.mjs` checks the draggable scenario columns: a move only reorders
the scenarios, so each one must keep every input and result, by pointer and by
the arrow keys, and the summary CSV follows the new order.
