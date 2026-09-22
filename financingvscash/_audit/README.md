# Financing vs Cash — audit harness

Drives the real page in headless Chromium (CDN libs stubbed; the Chart.js stub
records chart configs so tests can inspect plotted datasets). Verifies the
engine against an independent replay of the documented mathematics, then
exercises mixed payment frequencies, frequency edits, and unaffordable-upfront
edge cases.

Covered (`run.mjs`):

- F1  default scenarios' ending wealth and net benefit vs an independent replay
- F2  mixed payment frequencies share one real-time (years) chart axis
- F3  changing the repayment frequency converts the term, not just its unit
- F4  a down payment plus fee beyond available cash is explained, not dropped
- F5  flat rate: interest is P0 x r x n and the instalment is P0/n + P0 x r
- F6  flat rate: its effective APR matches an independent IRR and far exceeds 5%
- F7  known repayment: the solved rate returns the rate the instalment came from
- F8  stepped repayment: the entered steps land in the entered periods, the
      balance closes at zero, and the solved APR matches an independent IRR
- F9  interest-only: level interest, a flat balance, principal repaid at the end
- F10 balloon: a residual annuity, with the residual added to the final payment
- F11 floating rate: two band datasets, kept out of the hover card, bracketing
      the midpoint line
- F12 fixed then floating: the band is shut across the fixed periods and opens
      only after the switch
- F13 a scenario saved before loan types existed still loads, as an annuity
- F14 rate convention: nominal divides (1.000%/month at 12% p.a.), effective
      compounds (0.949%)
- F15 bullet: no instalments, a compounding debt, one payment of P(1+r)^n
- F16 deferred start: the balance rises above the original principal during the
      holiday, then instalments resume
- F17 fee treatment: identical with no fee; an upfront fee is never borrowed, a
      capitalised fee is never counted twice, and a discounted note is grossed
      up so the net advance still meets the price
- F18 a repayment plan no rate can satisfy is explained as that, not blamed on
      the down payment
- F19 the read-out under the chart names the period, every series once, and the
      band as a range on its own series' entry

The replay in `run.mjs` is re-derived from the engine notes in `script.js`, and
the IRR check deliberately uses the discounted-stream formulation rather than
the page's forward-balance recursion, so agreement means the mathematics agrees
rather than code being compared with itself.

`reconcile.mjs` guards the accounting identity across differing horizons:
Ending Wealth minus the same-horizon cash baseline equals Net Benefit.

## `accounting.mjs` — does the money balance?

Where `run.mjs` asks whether each loan type computes correctly, this asks the
narrower and harder question: is every dollar accounted for once. It runs the
plan in `ACCOUNTING-PLAN.md`, which was written against the page's own tooltips
and double-entry first principles **before** `script.js` was opened, so each
test cites a claim the page makes rather than a line of code. Scenarios are
loaded through the page's own mini-cache — the path a returning reader's plan
arrives by — rather than by reaching inside the module.

| Group | What it holds the page to |
| --- | --- |
| **A** conservation | The loan closes at zero and Σ principal equals the amount financed, for all seven loan types; Σ payments equals financed + interest; every individual row balances (payment = interest + principal, end = start − principal); Total Financing Cost = interest + all fees; out-of-pocket = down + the fee actually handed over + payments + admin, across all six fee shapes. A5c bounds the difference between a printed column and the total under it to what display rounding alone can produce. |
| **B** the wash | The sharpest test here needs no replay at all, because it fixes the answer to a constant: borrow at exactly the rate your spare cash earns, charge no fee, and Net Benefit must be **zero** — swept over 5 loan types × 4 frequencies × 3 down payments, and again at a one-period term and a 30-year one. Three deliberate exceptions prove it is measuring something: Nominal must break the wash by exactly the convention gap (the tooltip says the convention touches the loan and never the risk-free rate), a flat rate must break it and lose, and a 100% down payment must land exactly on the cash line. |
| **C** marginal identities | Each input has to move the books by its own amount and no more: an upfront fee costs `F(1+rf)^T`, an admin fee costs `A·Σ(1+rf_p)^(n−k)`, neither adds a cent of interest; a capitalised fee is borrowed once; a discounted note grosses up so the net advance still meets the price; surplus cash cancels out of Net Benefit exactly (C5); the currency symbol moves nothing; inflation is a deflator, not a second model. |
| **D** horizons | Each row is scored against its own end of term, the two baselines in a mixed-horizon comparison really do differ, and the headline tile is the winning row rather than the long-horizon tile minus it. |
| **E** cross-paths | The sensitivity sweep passes through the live answer on all five objectives; every chart metric ends on the figure its own table prints; the CSV is the table, with the Unicode minus translated rather than deleted. |
| **F** structural signs | Net Benefit falls with the finance rate, rises with the risk-free rate, is monotone in the down payment — and the sign of a longer term **flips exactly at the wash**, which pins timing, compounding and the direction of the spread in one test. |
| **G** degenerate input | Cash below the price is explained rather than modelled; a fixed-then-floating loan brackets its own midpoint only after the revert; interest-only for the whole term, a 99% residual and a one-period loan all still close. |
| **H** Quick Start | All sixteen preset columns close their books and are scored at their own horizons — including the house preset's 15-year row, which ends before the 30-year rows beside it and so carries a cash baseline of its own. Every preset tip is checked against the numbers behind its button, and where a tip claims an *ordering* (the phone's and the car's smallest instalment finishing last, the card's six-month plan finishing behind its twelve-month one) the ranking is what gets asserted, not three loose numbers. `_ref/quickstart-check.mjs` separately proves each preset is a clean reset, which is what lets this tool ship no Reset button. |

Two findings the plan turned up are recorded as notes in the run output rather
than changed: Effective Rate (APR) is the contract rate and is blind to fees in
all three treatments alike, and the printed schedule column can differ from the
total under it by display rounding. Both are deliberate choices whose
alternatives are worse; the harness pins the consistency instead.

Run: `node run.mjs`, `node reconcile.mjs` and `node accounting.mjs`
