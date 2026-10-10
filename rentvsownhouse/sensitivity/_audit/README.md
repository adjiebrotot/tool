# Rent vs Own Sensitivity — audit harnesses

Both pages run the one engine, `../../engine.js`, so a disagreement can only
come from how each page turns its inputs into the engine's state.

`node parity.mjs [count]` types the same scenarios (fixed edge cases plus
seeded random ones across every mode) into the main page's sidebar and this
page, and requires the Own and Rent cashflow exports to be byte-identical.
This page shares the time horizon, risk-free rate, initial cash and budget
across its columns, and an automatic cash or budget is the most any column
needs, so the parity is with a table of one column: the harness removes the
second column and types those figures into the shared row.

`node integrity.mjs` is the accounting check of a comparison across columns,
against an independent replay of the documented rules (the annuity formula,
each column's needs, the interest-parity exchange-rate path) and against
identities that fix the answer. In one currency: every column starts with the
same cash (the largest up-front need) and gets the same budget every year (the
largest monthly need), so none runs short; the Auto notes name the column;
every ledger balances; two columns' renters differ by exactly the future value
of their rent costs' difference; set figures reach every column; a shortfall
is flagged. In several currencies (stubbed live rates, served over HTTP so
`fx.js` can load the comparator's rate file): the same cash and the same
monthly budget in the base, at each column's rate on the day; a renter's
wealth identical in any currency under interest parity (and carry winning when
the rate is held); a home growing by its currency's extra interest worth the
same in the base; accumulated cost translated at each month's rate; live,
typed and cleared rates; a base change that moves no column's money; the
summary CSV and mini cache round trips; and the expected
appreciation/depreciation path (a rate moving by the yearly change typed per
currency, replayed for the shared money and accumulated cost, the note under
the field saying it in words as it is typed, re-quoted on a base change, kept
by the CSV and the mini cache).

`node run.mjs` checks the defaults match between the two pages, the table
outputs against the CSVs, and the summary-CSV column layout. It also opens the
summary CSVs in `fixtures/`, exported before the October 2026 relabel (English
and Indonesian, simple and detailed), and requires every value in them to come
back out: the importer reads rows by label, so a renamed row must keep its old
label in `LEGACY_ROW_LABELS` or files people already saved lose it. Their
time horizon, rate, cash and budget differ by column; those now come back as
the first column's, under every column. S5 reopens a summary CSV exported
today with a detailed rate schedule, in both languages.

Rows are matched by label, not position: the table (and the CSV) lists a
deciding field above the fields it governs, so the order has moved since those
files were saved. Each file is also reopened on the other language's page.

`node units.mjs` checks the units and groups: no Unit column, each field shows
the unit the engine reads it in (following the scenario's cost type, frequency
and currency), a switch between money and "%" restates the cost so year 1 costs
the same, a field shown as unused really changes nothing, each deciding field
sits above what it governs with no rule inside the group, and a blank field
means Auto where the field allows it.

`node presets.mjs` checks the Quick Start picker on every column: every
scenario (a city and one of its homes), loaded into a table of one column,
gives Own and Rent cashflow exports byte-identical to the main page's Quick
Start for it (both read `../../quickstart-data.js`) and sets the page
currency; every column carries the picker, also after a drag; a second city in
the same currency keeps one currency with the shared cash at the larger need,
and one in another currency turns multi-currency on; and its search lists
exactly the scenarios that carry every word typed.

`node drag.mjs` checks the draggable scenario columns: a move only reorders
the scenarios, so each one must keep every input and result, by pointer and by
the arrow keys, and the summary CSV follows the new order.
