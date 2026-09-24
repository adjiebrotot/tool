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
change, what a floating rate does to Rent (nothing with a set budget; exactly
the owner's extra repayment invested with the automatic one), and the
interest-only balloon at the end of the term.

(See also ../audit/ — the earlier JS↔Python cross-model audit.)
