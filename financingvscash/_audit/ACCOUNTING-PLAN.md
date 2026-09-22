# Blind accounting-integrity plan — Finance vs Cash

Written **before** reading `script.js`, from three sources only: the controls and
KPI definitions the page puts on screen, the tooltips in which the page states
what each number means, and double-entry first principles. Nothing here is
derived from the implementation, so a failure is a disagreement between the tool
and its own published claims rather than between two copies of the same code.

The claims the page makes, quoted from its own tooltips, are the axioms:

| # | The page says | Where |
| --- | --- | --- |
| P1 | "Available cash … must be at least the purchase cost, because this tool only compares financing against genuinely being able to pay cash." | Available Cash |
| P2 | "Every scenario compounds spare cash at this rate, so it is the common baseline." | Risk-Free Rate |
| P3 | "It applies to the loans only, never to the risk-free rate above." | Rate Convention |
| P4 | "What you would end up with if you paid cash: your leftover funds, meaning available cash minus the purchase cost, compounded at the risk-free rate over the longest scenario term." | Cash Purchase Wealth |
| P5 | "End-of-term wealth under the best financing scenario minus end-of-term wealth if you had paid cash." | Net Benefit vs Cash |
| P6 | "Total interest paid across the full loan term … Origination and admin fees are not counted here." | Total Interest |
| P7 | "the smallest total borrowing cost, interest plus fees" | Lowest Financing Cost |
| P8 | "0% borrows the whole amount; 100% pays cash outright, so there is no loan at all." | Down Payment |
| P9 | "It comes out of your cash at the start, so it reduces what you have left to invest." | Origination Fee |
| P10 | "Added to the loan: borrowed alongside the purchase, so you pay interest on the fee too." | Fee Treatment |
| P11 | "the lender pays out the loan net of the fee, so the loan is grossed up for the proceeds to still cover the price." | Fee Treatment |
| P12 | "A fixed fee added to every repayment … the total is this amount times the number of payments." | Admin Fee |
| P13 | "ending wealth is also shown in today's dollars, discounted by the inflation rate below." | Inflation Adjustment |
| P14 | "Display only. Nothing is converted." | Currency |

---

## A — Conservation of cash: the books must close

Every dollar has to come from somewhere and land somewhere. These hold for
**every** loan type, frequency, term and fee treatment, so each is run across
the whole matrix rather than on one shape.

- **A1 · Sources equal uses at t=0.** Cash leaving the wallet on day one is the
  down payment plus an upfront origination fee, and nothing else. What is left
  to invest is `availableCash − downPayment − upfrontFee`. Under P9 an upfront
  fee is a use of cash; under P10/P11 it is not.
- **A2 · The loan closes.** `Σ principal repaid = amount financed`, and the
  closing balance after the last row of the amortisation table is exactly zero
  — residual and balloon settled, deferred interest capitalised and repaid.
- **A3 · Payments reconcile to principal plus interest.**
  `Σ scheduled payments = amount financed + total interest`, with admin fees
  excluded from both sides (P6).
- **A4 · Financing cost is a sum of its named parts.**
  `total financing cost = total interest + origination fee + adminFee × n` (P7,
  P12), and `Total Interest` excludes both fees (P6).
- **A5 · The table is the model, not a picture of it.** The amortisation table's
  interest column sums to the Total Interest KPI, its payment column sums to A3,
  and its last balance is A2's zero. If a KPI and the table disagree, one of them
  is decoration.

**Falsifiable prediction.** With `price 50,000`, `down 20%`, `fee 1,000 upfront`,
`admin 15`, `60 monthly payments`: financed is exactly 40,000 regardless of fee,
cash out at t=0 is exactly 11,000, and `Σ payments − 40,000` is the interest
KPI to the cent.

---

## B — The wash: borrow at r, invest at r, and nothing happened

This is the strongest test available without seeing the code, because it fixes
the answer to a constant that no modelling choice can move. If money is borrowed
at exactly the rate the spare cash earns, and no fee is charged, then financing
and paying cash must leave identical wealth. Any drift is a timing error, a
compounding error, or a leak — and the size of the drift names which.

- **B1 · Net Benefit ≡ 0 when finance rate = risk-free rate, no fees.** Swept
  across every loan type, every frequency (weekly/fortnightly/monthly/yearly),
  terms from 1 period to 360, and down payments from 0% to 100%. Tolerance is
  rounding, not basis points.
- **B1n · The nominal convention must break the wash by exactly its own gap.**
  P3 says the convention touches the loan and not the risk-free rate, so under
  Nominal a 12% loan charges `12/12 = 1.000%` a month while cash compounds at
  `1.12^(1/12) − 1 = 0.949%`. The wash must therefore fail, and fail by exactly
  the cost of that spread — not by some other amount. A tool that passes B1
  under *both* conventions is compounding the risk-free rate the loan's way,
  contradicting P3.
- **B2 · 100% down is paying cash.** P8 says so in words. Net Benefit ≡ 0,
  Total Interest ≡ 0, Ending Wealth ≡ Cash Purchase Wealth, for every loan type.
- **B3 · Zero rates, no fees: order stops mattering.** With rf = 0 and finance
  rate = 0, ending wealth ≡ `availableCash − price` for every loan type, term
  and frequency, and Net Benefit ≡ 0. Money with no time value cannot be improved
  by rescheduling it.

---

## C — Marginal identities: each input moves the books by its own amount

A model leaks when an input moves the answer by more or less than the input
itself is worth. Each of these is a closed-form prediction of a *difference*
between two runs, which cancels everything the two runs share.

- **C1 · An upfront fee costs exactly its compounded self.** Adding fee F
  (P9) must lower ending wealth by exactly `F × (1+rf)^T`, must leave the amount
  financed unchanged, and must leave total interest unchanged.
- **C2 · An admin fee costs exactly its compounded annuity.** Adding A per
  payment (P12) must lower ending wealth by exactly `A × Σ_{k=1..n} (1+r_p)^{n−k}`
  and must leave total interest unchanged.
- **C3 · A capitalised fee is borrowed once.** Under P10 the amount financed
  rises by exactly F, interest rises by the interest on F alone, and nothing
  leaves the wallet at t=0 — the classic double-count is a capitalised fee that
  is also deducted upfront.
- **C4 · A discounted note grosses up exactly.** Under P11 the *net advance*
  must equal `price − downPayment` to the cent, so for a percentage fee
  `financed = (price − down)/(1 − f)`. Under-grossing leaves the buyer short at
  settlement, which the model would silently absorb.
- **C5 · Surplus cash cancels out of Net Benefit.** Both arms invest every
  dollar above the purchase cost identically, so Net Benefit must be *invariant*
  to Available Cash while cash ≥ price, and Ending Wealth must move by exactly
  `Δcash × (1+rf)^T` in both arms. A Net Benefit that drifts with a number that
  cancels algebraically means the two arms are not being given the same cash.
- **C6 · The currency symbol is display only** (P14): every figure identical
  across all seven symbols.
- **C7 · Inflation is a deflator, not a second model.** Under P13 the
  inflation-adjusted figure must equal `nominal / (1+i)^T` exactly, and switching
  the toggle must not move any nominal figure.

---

## D — Horizon integrity: what is a scenario compared against?

P4 and P5 are in tension, and that tension is where a real error can hide. P4
pins the headline Cash Purchase Wealth to the **longest** scenario's term. P5
defines each scenario's Net Benefit as a difference at **its own** end of term.
With scenarios of different lengths on screen, only one of those can be the
subtrahend for a given row.

- **D1 · Each row is compared at its own horizon.** For every scenario,
  `Ending Wealth − compound(cash − price, rf, that scenario's term) = Net Benefit`
  printed for that row.
- **D2 · The headline tile ties to the row it names.** The KPI Net Benefit is
  the best scenario's, so it must equal that scenario's row — which means it must
  *not* be the Cash Purchase Wealth tile minus that row's Ending Wealth whenever
  the winner is shorter than the longest scenario. The two tiles are allowed to
  be built on different horizons; they are not allowed to be silently subtracted
  from one another.
- **D3 · The gap is material, not cosmetic.** With a 3-year and a 30-year
  scenario side by side, the two baselines differ by a large number; the test
  asserts the difference is real so that D1 cannot pass by the horizons being
  accidentally equal.

---

## E — Cross-path consistency: the same number computed twice

The page computes the same quantity through at least four separate paths. They
must agree, because a reader will read whichever one is nearest.

- **E1 · The sensitivity sweep must pass through the live answer.** Sweep the
  finance rate across a range containing the scenario's own rate with a grid
  point landing on it; the objective plotted there must equal the KPI on screen.
  Repeated for Net Benefit, Total Interest, Total Financing Cost, Ending Wealth
  and Inflation-Adjusted Net Benefit, and for both 2D and 3D.
- **E2 · The CSV is the table.** Every cell of the downloaded amortisation CSV
  equals the cell on screen.
- **E3 · The chart's last point is the table's ending figure**, for each of the
  four chart metrics, across mixed frequencies.
- **E4 · The comparison table and the chart agree** on Net Benefit per scenario.

---

## F — Structural sign tests: no free lunch, no free loss

Signs are cheap to check and expensive to get wrong, and they catch sign-flip
and off-by-one-period errors that magnitude tests can absorb.

- **F1 ·** Net Benefit is strictly decreasing in the finance rate.
- **F2 ·** Net Benefit is strictly increasing in the risk-free rate while any
  debt exists.
- **F3 ·** The sign of `∂NetBenefit/∂term` flips exactly at the wash: with
  finance rate above rf a longer term is worse, below rf it is better, and at
  rf it is flat. This one test pins timing, compounding and the direction of the
  spread simultaneously.
- **F4 ·** Net Benefit is monotone in the down payment, with the direction set
  by the same spread, and its 100% end lands on B2's zero.

---

## G — Degenerate input: the books must refuse rather than lie

- **G1 ·** `availableCash < price` contradicts P1 — the page must say so rather
  than print a confident verdict built on cash that does not exist.
- **G2 ·** `price = 0`, `cash = 0` — warn, do not print an all-zero verdict.
- **G3 ·** Negative carry: when repayments exhaust the invested pot the balance
  goes negative. The page has a banner for this, so the question is only whether
  the arithmetic afterwards is stated and consistent — whichever rate a negative
  balance carries, it must be the same one the banner implies, and it must be
  symmetric with the positive case.
- **G4 ·** A repayment plan no rate can satisfy, a 99% residual, an
  interest-only period equal to the full term, and a one-period term must each
  either compute correctly or be explained; none may be silently dropped.

---

## H — Quick Start scenarios carry the same burden

The scenarios are the first numbers most readers will ever see, and the ones
they will trust hardest.

- **H1 ·** Every preset satisfies the whole of A on its own figures.
- **H2 ·** Every preset's comparison table satisfies D1 on its own mix of
  horizons — the house preset runs 30 years next to the phone preset's 2, so
  this is where a shared baseline would show.
- **H3 ·** Every preset is a clean reset from any prior state — delegated to
  `_ref/quickstart-check.mjs`, which already proves exactly this claim for the
  other tools that dropped their Reset button.
- **H4 ·** Every claim a preset's tip makes about the lesson it teaches is true
  of the numbers it loads: the flat-rate preset's solved APR really is far above
  its quoted rate, the 0%-with-a-fee preset really does cost more than 0%, the
  deferred preset's balance really does climb above the amount borrowed, and the
  variable-rate house scenario really does open a band only after its fixed
  period ends.

---

---

## What the run actually covers, and what it does not

Written after the fact, so the plan cannot claim coverage the harness does not
have. `accounting.mjs` implements A1–A5 (plus A5c, added once the run showed the
printed column and the printed total differ by display rounding), B1, B1b, B1n,
B1f, B2, B3, C1–C7, D1–D3, E1–E3, F1–F4, G1, G4 and H1, H2, H4.

Four items landed elsewhere or were folded into another test:

- **G2** (`price = 0`, `cash = 0`) is already pinned by `reconcile.mjs`, which
  also owns D1 for the default plan; repeating it here would have been a second
  copy of the same assertion rather than a second assertion.
- **G3** (the accounting of a negative investment balance under negative carry)
  is *not* separately tested. B1 covers it implicitly — several of its 60
  combinations drive the pot below zero and still wash to the cent, which is
  only possible if a negative balance compounds at the same rate a positive one
  does — but no test names the banner's own threshold.
- **E4** (comparison table against the chart) collapses into E3, which already
  compares the chart's Net Benefit series against the table cell.
- **H3** (a preset is a clean reset) belongs to `_ref/quickstart-check.mjs`,
  which proves it for every tool that dropped its Reset button rather than for
  this one alone.

Two findings survive as notes in the run output rather than as failures, because
both are deliberate choices whose alternatives are worse. The **Effective Rate
(APR)** is the contract rate and is blind to origination fees in all three
treatments alike — including the grossed-up fee on a discounted note, where the
economically true cost of funds is the IRR against the *net* advance. Folding
the fee in for that one treatment and not the others would produce a number that
is neither the contract rate nor the true cost, and folding it in everywhere
would break the flat-versus-annuity comparison the row exists for; the fee is
priced in Total Financing Cost and Net Benefit, which is what the verdict is
drawn from. And the **amortisation column does not foot to the total beneath
it**, by up to half a cent per row, because the model keeps full precision and
rounds only for display. A5c bounds that drift to exactly what rounding can
produce, so it can never hide anything larger.

## What this plan deliberately does not test

Chart cosmetics, export cluster ordering, zoom behaviour and the abbreviation
glossary are covered by the cross-tool checks in `_ref/`, and the loan mechanics
of each type are already pinned by `run.mjs` F5–F16. This plan is about whether
the *accounting* closes: the same dollar never counted twice, never quietly lost,
and never compared against the wrong baseline.
