# Rent vs Own — accounting-integrity harnesses

Both drive the real page in headless Chromium (CDN libs stubbed).

`node run.mjs` captures the app's own Own/Rent/RTB cashflow CSV exports and
checks accounting identities: yearly cash conservation, Σ principal == loan,
closed-form annuity balances, auto-budget definition, and RTB transition
equity/loan amounts.

`node integrity.mjs` checks that every surface tells the same story, against an
independent replay of the documented maths: table == replay, chart lines ==
table, floating-rate band edges == replay at the low and high rate paths, KPI
cards and summary tiles == the rows they summarise, re-amortisation at each rate
change, what a floating rate does to Rent (nothing: the automatic budget is
sized on the high rate path, so it is one figure for every path), the
interest-only balloon at the end of the term, selling costs in net equity,
the mortgage as the only borrowing (cash below zero is flagged and stays on
the risk-free rate), a Rent-Then-Buy loan starting the rate schedule at its
own year 1 for the full term, automatic budget and cash that leave
Rent-Then-Buy never short, and Rent-Then-Buy leaving Own and Rent untouched
when the budget and cash are set.

(See also ../audit/ — the earlier JS↔Python cross-model audit.)
