# Finance vs Cash — adjudication of the run

Verdict counts alone are misleading here, so every non-pass is classified below
against the evidence actually captured. The frozen expectations are **not**
edited: a wrong expectation is a finding about the test, and rewriting it after
seeing the engine is exactly what this protocol exists to prevent.

Run: `_qa/results/financingvscash.actual.json`. Raw score: 3 pass, 8 fail,
1 xfail, 0 error. Adjudicated: **12 of 12 cases show the engine behaving
correctly**; the failures are 1 confirmed convention finding, 6 over-strict or
mistaken expectations, and 1 chart/table divergence worth a doc note.

## Confirmed finding

### F1 / F1-alt — the period-rate convention is effective, not nominal
The pair was written as rival readings of one measurement, so the verdict names
which is live rather than assuming.

| | nominal `r/m` | effective `(1+r)^(1/m)−1` | observed |
| --- | ---: | ---: | ---: |
| period-1 interest, 50,000 @ 12% | 500.00 | 474.44 | **474.44** |
| repayment, 60 months | 1,112.22 | 1,096.78 | **1,096.78** |
| total interest | 16,733.34 | 15,807.09 | **15,807.09** |

F1 passes, F1-alt fails exactly as predicted. This page compounds at the
equivalent yield. Rent vs Own and Borrowing Capacity use the nominal APR/12 a
lender quotes, so **Z1's convention clash is real**: the same 12% loan produces
a repayment 15.44/month apart between two tools on this site. Neither is wrong
in isolation; the site should state which it uses, per tool.

## Expectation defects (the engine is right)

### F5 — fortnightly is 26 periods a year, not 52
The plan expected 104 fortnights to be 2 years. It is 4. The page agrees with
the calendar: it reports C's Comparison Horizon as **4.0 yr**, produces 104
schedule rows for a 104-fortnight term, and re-derives 24 months as **52**
fortnights when the frequency is switched. Four sub-checks fail from this one
arithmetic slip: `n_rows_C`, `payment_C`, `end_wealth_C`, `term_after_fortnightly`.
`kpi_cash_wealth` follows too, since the cash baseline runs to the longest
horizon, which is 4 years rather than the 2 the plan assumed.

### F6 — the interest tile describes the winner, not the scenarios
`kpi_interest` read `$0` against an expected 2,068.81. The tile's own sub-label
says *"Paying cash pays no interest."* and `kpiBest` reads *Cash Purchase*: the
tile reports the interest of the option it just named best. The comparison table
carries the scenario figures correctly (`pct` and `flat` both $2,068.81, which
the case's other checks passed). The expectation misread which quantity the tile
holds.

### N1, F2, F3, F7, F8, F10 — KPI tiles render to two significant figures
Every remaining failure is a compact-notation tile scored against an exact
value: `$2.2K` vs 2,181.62, `$12.5K` vs 12,461.82, `−$4.1K` vs −4,057.31. The
underlying figures are exact in the comparison table, and those checks passed in
the same cases. A summary tile rounding is intended behaviour, not a defect; the
expectations should have carried a tolerance matching the rendering, or read the
table instead.

### F10 — the comparability note exists, the regex was too literal
Expected `note_text` to match `term|compar`. The page prints: *"These scenarios
run for different lengths. The Cash Purchase column is shown at the longest
horizon (5.0 yr), so each shorter scenario is scored against its own
same-horizon cash row above, never against the column."* That satisfies the
intent of F10 completely, in words the pattern did not anticipate.

## Worth a doc note (not a defect)

### F5 — the chart extends every series past its own horizon
`chart_last_y_A` is 11,048.06 while the table reports A's Ending Wealth as
10,117.04. Both are right: A's term is 2 years, the chart runs to the longest
scenario's 4, and A's invested balance keeps compounding after its loan is
repaid. That is the correct like-for-like comparison, and the table already
carries a note explaining the equivalent point for its own columns. The chart
has no such annotation, so a reader taking A's endpoint off the chart will not
match the Ending Wealth in the table beneath it. Cheapest fix is one line of
chart subtitle, or a marker where each series passes its own term.

## Runner defects found and fixed during the run

Recorded because they were scored as tool failures before being corrected, and
because they are the failure mode a harness is most likely to repeat:

1. **Compact-notation tiles.** `money()` dropped the K/M suffix, reporting 2.2
   for `$2.2K`. Fixed, then the fix over-reached and read the "k" of
   `$509.61/week` and the "t" of `/fortnight` as multipliers, turning a payment
   into 509,610 and 5.4e14. Now the suffix only counts when it sits directly on
   a digit.
2. **Sensitivity chart x values.** That chart keeps x in `data.labels` with
   plain numbers in the dataset, so the sweep's x came back null. Reading labels
   fixed F9, which now passes.
3. **Reconstructed invested balance.** The first runner rebuilt it from wealth
   plus loan balance and was off by one row on F2. Replaced by switching the
   page to its own Investment Value metric and reading the series directly, which
   is what the contract asked for.
4. **Unclassified observable.** F7's `c_state` dumped raw card text instead of
   classifying accepted / clamped / rejected. Now classified; the page keeps the
   60-period term, so a 0 is rejected.
