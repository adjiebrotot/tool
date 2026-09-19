# Rent vs Own — adjudication of the run

Raw score: 2 pass, 7 fail, 4 not run. Adjudicated: **no tool defect was
established**. Of the nine executed cases, two pass outright, and the rest fail
on a compounding convention the expectation author explicitly flagged as a
guess, on compact rendering scored against exact values, or on defects in my
runner. Four cases were never executed.

The frozen expectations are **not** edited. A wrong expectation is a finding
about the test.

## The engine agrees exactly where it matters most

The RTB transition reproduces two independently derived figures to the cent:

| quantity | derived in phase 1 | page's RTB export, year 5 |
| --- | ---: | ---: |
| purchase price, 800,000 × 1.05⁵ | 1,021,025.25 | **1,021,025** |
| loan at purchase, × 0.80 | 816,820.20 | **816,820** |

And RTB tracks Rent exactly while it is still renting: at year 4 both report an
end cash of **332,495**, to the rupee. That is the property R7 exists to check,
and it holds.

## Expectation defects

### Cash compounds monthly, not yearly (N1, R2, R7, and every explicit cash figure)
Phase 1 froze the yearly identity `end = begin × (1+rf) + budget − outflow` and
said in its own conventions block that if the engine compounded monthly, these
would fail together as one finding. They did. The signature is visible in the
export: at year 4 the renter's beginning cash is 296,611 and the page credits
**13,799** of interest, where a single yearly application of 4.5% would credit
13,347. Monthly compounding on a balance that grows through the year is the more
faithful model, so the page is right and the yearly proxy is the approximation.
This one convention accounts for the residuals of 98 to 207 and for every cash
figure that missed by a few hundred over decades.

### R7's pre-purchase window includes the transition year
`A_rtbMinusRentCashMaxAbsY1to5` expected 0 across years 1 to 5. RTB and Rent are
identical through year 4; year 5 is labelled `buy-transition` in the export's own
Phase column and is where the deposit is paid. The window should have stopped at
year 4. Same for `E_…Y1to29` with a buy year of 30, and for `D_rtbMinusRentCashY1`
where the purchase happens in the very year being compared.

### R3 scores a compact tile against an exact delta
`kpiDiff` renders `+$2.59m`. Expected agreement within 2 against a figure near
2.594m. The 4,095 gap is the tile's rounding, not a disagreement.

## Runner defects (mine)

### Read the RTB purchase a year late
I read purchase price and loan from year 6 instead of year 5, so I reported
1,072,077 (= 800,000 × 1.05⁶) and a loan already partly repaid. Corrected
reading matches the expectation exactly, as shown above. This produced six
spurious failures across A, B, C and D.

### Claimed the purchase outlay was not exported
My note on R7 said the export does not expose the deposit and setup outlay as
its own column, so I reported the conservation residuals as null. **That note is
wrong.** The RTB CSV has a `Purchase_Outlay` column, reading 236,205 at year 5,
which is exactly the 204,205 deposit plus 32,000 setup. The residuals were
computable and I did not compute them. Four checks failed for that reason alone.

### R8 breakeven came back null and is unresolved
`#kpiBreakeven` renders `Year 2` in a state I diagnosed by hand, and the parser
handles that text, yet cases A and C reported null. I could not reproduce the
null within this session and am not able to say whether it is a parse failure in
a state I did not re-examine or a genuine difference in what the KPI shows under
those settings. **Unresolved, not cleared.** R8 needs a re-run before any claim
is made about the first-crossing behaviour.

## R9 — the two pages agree at the baseline, within display precision

R9 now runs (state A). Every difference between the main page and the
sensitivity page is the sensitivity page's compact rendering, not a model
divergence: it prints `$3.72m` where the main page's export carries 3,722,870,
so the gap is 2,870 on a figure in the millions. Own, Rent, the delta, cash and
accumulated cost all line up that way at both year 10 and year 30.

Two things the case does establish:

- **`sensHasRtbRow` is false.** The sensitivity page carries no rent-then-buy
  row, as TESTCASES describes.
- **The year clamp works.** Asking for year 100 returns the year-30 figure
  exactly (`A_sensYear100MinusYear30OwnNetEquity` is 0).

**What it does NOT establish, and this is the important part.** State A runs
both pages with RTB *off*. The divergence TESTCASES R9 predicts is precisely
what happens when RTB is *on*, because the main page's auto budget becomes
max(own, rent, rtb) while the sensitivity page's stays max(own, rent). Running
the baseline with RTB off cannot see it. **That comparison is still untested**,
and it remains the highest-value case in the suite.

The B states (a floating low/mid/high band, to check the sensitivity page always
takes the mid rate) need rate-period cells this runner does not construct, so
those keys are null.

## Not executed (4 of 13)

| case | why |
| --- | --- |
| R4 | interest-only past term; needs detailed mode plus a constructed rate-period row |
| R5 | the predicted band-monotonicity failure; needs a floating low/mid/high band and a per-path verdict readout I could not locate |
| R6 | rate-period editing; needs repeated construction and mutation of period rows |
| R12 | `/id/` parity; needs the second page driven through the same baseline |

**R5 is still the predicted failure** for this tool and has not been tested. R9
now runs at the baseline but, as above, cannot reach the RTB-on case that the
divergence actually needs.

## A structural weakness in R1 worth recording

The page's rent CSV writes the **Own** budget field into the Rent budget column.
So an own-versus-rent budget difference read from the export is zero by
construction and cannot independently confirm parity. R1 passes, but that pass
carries less information than it appears to for the own/rent pair; only the RTB
comparison in states C and D tests anything. A genuine parity test has to read
the two budgets from independent sources, or verify parity through the cash
identity instead.
