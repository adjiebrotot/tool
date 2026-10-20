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

`node quickstart-data.mjs` holds `../quickstart-data.js`, the one file every
Quick Start scenario comes from, to its own rules and to the form it fills:
every city's currency is one the shared picker offers, every home type is
either a home or a reasoned gap in every city, every scenario resolves every
form value inside the bound the calculator's field enforces (read from
`../index.html`), yields and bedroom order are plausible, no em-dash reaches a
reader, and the assumptions page draws every scenario at the price the
calculator loads. A staged loan's rate schedule (D7) has to be one the
Detailed mortgage mode can hold, its single rate must be the schedule's
average over the term, and the calculator must open it in Detailed mode on
exactly those periods.

`node today.mjs` holds Show in today's money to a replay of the page in
future's money: every cashflow table cell (the CSV, to the dollar) and chart
point divided by General inflation compounded to the end of its year, running
totals summed year by year, every row still reconciling; the cards, tiles,
repayment range and Rent-Then-Buy price on the same figures, the breakeven
year unmoved; the switch on for a new reader and after a Quick Start, off for a
plan saved before it existed; back again exactly; 0% making the two moneys one
page; and the Indonesian page on the same figures. `run.mjs` and
`integrity.mjs` replay the engine's own figures, so they read the page with
the switch off.

(See also ../audit/ — the earlier JS↔Python cross-model audit.)
