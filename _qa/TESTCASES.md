# Agreed scope — financial tools regression suite

IDs are stable. Each case needs a contract entry (inputs + observables) and a
frozen expectation. Severity: **blocker** = wrong money on screen, **major** =
wrong under a reachable configuration, **minor** = presentation or robustness.

## dcasimulator (single asset)
- **N1** Monthly-on-the-15th baseline: trade count, deposit conservation, unit accounting, nearest-trading-day selection.
- **E1** Look-ahead: a signal formed from day D's close must not execute at day D's close. Test every conditional style.
- **E2** `monthly-top` / `monthly-bottom` / `weekly-top` / `weekly-bottom` are perfect foresight. Invariant: bottom ≥ every causal style ≥ top.
- **E3** Indicator warm-up happens inside the trimmed window; a short window with a long indicator yields no signal.
- **E4** End-of-period fallback ON degenerates a dead trigger to plain DCA; OFF deposits nothing and metrics must read "no data".
- **E5** Weekly bucket is Sunday-aligned local time, not ISO-8601: year boundary and timezone stability.
- **E6** Bad ticks (zero / negative / null price) are skipped, never bought; unusable final close values the holding at 0.
- **E7** Sharpe / Sortino / CAGR(TWR) are computed on price, so they barely move between styles; MWR is the one that moves.
- **E8** √252 annualisation against the actual bar count.
- **E9** No fees anywhere in this tool.
- **E10** Yearly contribution increase steps on 365.25-day blocks from series start.
- **E11** Data budget: 5 requests/device/day, cookie-backed, shared with portfolio mode.

## dcasimulator/portfolio
- **N1** 60/40, monthly top-up, constant weight, quarterly rebalance, 0.1% fees: conservation, weights restored, no negative units or cash.
- **P1** Same-bar execution for triggers and for the reserve sale that funds them.
- **P2** Rolling top/bottom anchors are causal: window nesting, and quiet exactly `lookback` bars after a step down.
- **P3** The date axis is an intersection: mixing market calendars silently shrinks the sample.
- **P4** Momentum ranking is same-bar.
- **P5** Cross-tool parity: one asset at 100% with zero fees must equal the single-asset tool.
- **P6** Weight edge cases: not summing to 100, a 0% asset, 100/0, a short rank-weight tail, negatives.
- **P7** Reserve edge cases: cash vs holding asset, deleted reserve, reserve also triggered, empty reserve on fire.
- **P8** Constant Weight at-top-up vs scheduled: fee comparison, and cash genuinely parked at the risk-free rate.
- **P9** Fee accounting reconciles with deposits + growth − final value; a 100% fee must not produce NaN.
- **P10** Schedules: fortnightly parity, quarterStart 2/3, yearly in an uncovered month, day 31 in February, a schedule wholly outside the range.
- **P11** Synthetic-asset determinism across styles, portfolios, tools and timezones.

## rentvsownhouse (+ sensitivity)
- **N1** 20% deposit, 30y P&I, 30y horizon: Σ principal = loan, closed-form balance agreement, yearly cash conservation.
- **R1** Budget parity: own and rent charged the identical budget every year, in every mode.
- **R2** Negative cash compounds at the risk-free rate (implicit borrowing); the warning only fires when the budget is below BOTH sides.
- **R3** Terminal value is gross of selling costs and CGT.
- **R4** Interest-only past term (balloon) and P&I past term (payments stop, surplus flows to cash).
- **R5** The floating low/mid/high band is not monotonic in the verdict, because auto-budget couples the two sides.
- **R6** Rate period editing: past-term periods, overlaps, reversed bounds, term shortened afterwards, band entered backwards.
- **R7** RTB transition conserves money; insufficient cash, cash above the whole house, buyYear 1, buyYear = horizon.
- **R8** Breakeven reports only the first crossing; double crossing, no crossing, already ahead at year 1.
- **R9** The sensitivity page is a second engine: no RTB, always mid rate, auto-budget = max(own, rent). Same inputs must give the same Own/Rent numbers.
- **R10** Cost item bases: % tracks value/rent, $ inflates; year-start property value for ongoing costs; mode round trip.
- **R11** Frequency conversions: weekly rent is ×52/12, not ×4.
- **R12** `/id/` parity with `/`.

## financingvscash
- **N1** 0% deposit, 5y monthly, rate below risk-free, no fees: Σ principal = financed, final balance 0, wealth = invested − loan.
- **F1** Period rate convention here is effective `(1+r)^(1/m)−1`, against nominal `r/m` elsewhere in the repo.
- **F2** The invested balance may go negative and keeps compounding: an implicit overdraft at the risk-free rate.
- **F3** Unaffordable upfront drops the scenario; it must drop visibly and not corrupt the chart or table.
- **F4** Negative carry: risk-free < finance rate on a zero-fee loan must always give a negative net benefit.
- **F5** Mixed frequencies share one chart: aligned on time, not period index; a frequency edit re-derives the term.
- **F6** Fees: % on the financed amount, flat upfront, per-repayment admin; total = upfront + admin × n.
- **F7** Degenerate inputs: 100% deposit, 0% rate, 0-period term, cost above cash, zero cash.
- **F8** The asset itself is ignored (no depreciation, no resale).
- **F9** The sensitivity sweep must break where scenarios become unaffordable, not jump to the cash path.
- **F10** Real figures deflate by term, so scenarios of different terms are not comparable on them without a note.

## borrowingcapacity
- **N1** Single PAYG applicant, no debts, 20% deposit: build-up adds up line by line; repayment at capacity re-amortises to capacity; NSR and UMI close.
- **B1** Each of the four caps binds in turn, named correctly, with no fixture binding within 5% of its next cap.
- **B2** Capitalised LMI can *reduce* capacity on a thin margin; the first-home-buyer preset must gain from it.
- **B3** Income split: inert at one applicant, exact at 0, never costs a couple more than pooling from $40k to $400k, capped at 50%, add-back at the higher earner's rate.
- **B4** Medicare / MLS / HELP stay on the combined figure: quantify the low-income phase-in deviation.
- **B5** HEM overrides declared expenses; declared 0 must not give living 0.
- **B6** Cards on the limit; IO existing loans over term − IO; commitments floored at zero.
- **B7** Deposit stated as cash vs as a share of price must agree; negative available funds must not give a negative max price.
- **B8** LVR at 0 / 80 / 95 / 99.9 / 100; valuation below price.
- **B9** Degenerate income: zero income, all-shaded income, zero assessment rate, floor above product rate.
- **B10** Progressive disclosure must not leak: an unticked box zeroes its input rather than hiding a live figure.
- **B11** Quick Start scenarios apply in full, bind where documented, never inherit the previous scenario.
- **B12** Three tax years, LITO taper, MLS tiers, HELP under both treatments.

## pisahvsgabung
- **N1** 50/50, 2 dependants, Rp 500M: both branches against a hand-computed PPh 21 figure; Gross − Deductions = Net.
- **C1** 0% and 100% splits waste a PTKP; warning present; 99/1 too.
- **C2** Crossover search misses an exact tie and reports only the first of two crossings.
- **C3** Crossover resolution is a linear interpolation over a coarse grid; compare against bisection.
- **C4** Bracket editor: delete all, reversed bounds, blank mid bound, non-monotonic rates, negative rate, last band forced open.
- **C5** PKP floors to whole thousands with an epsilon; boundary and a-hair-below cases.
- **C6** A deduction above a spouse's gross caps at gross, and the reported deduction is the applied one.
- **C7** Input mode parity: 300/200 individual == 500 total at 40% wife, both directions.
- **C8** The Gabung husband/wife split is presentational, not a legal allocation.
- **C9** PTKP editing: zero, above income, large dependant count; all views use the same figures.
- **C10** `/id/` parity with `/`.

## costofliving-comparator
- **N1** Perth → Jakarta: estimate = expense × (I_dst/I_src) × (e_dst/e_src); savings ratio from the same figures.
- **X1** FX shock and custom rate must leave the index estimate and destination savings ratio untouched, while cross-currency figures track.
- **X2** Missing data renders a dash, never a fabricated number and never a 100 stand-in.
- **X3** Utilities composite renormalises surviving weights and names the dropped ones; all three missing is null, not 0.
- **X4** Same-currency pairs make custom rate and shock inert; a stale rate is pruned.
- **X5** Swap inverts the custom rate rather than dropping it; swap twice returns to start.
- **X6** Detailed overrides clear on a currency change, survive a same-currency change, and do not shift on row deletion.
- **X7** Housing include/exclude changes the estimate and degrades gracefully.
- **X8** Shock clamped to ±20, non-numeric, and an out-of-range cached value.
- **X9** The two JSONs carry independent dates; a currency in one but not the other is handled.

## cross-cutting
- **Z1** Rate convention consistency across tools.
- **Z2** Config JSON save → reset → load round trip, plus an older and a malformed file.
- **Z3** localStorage round trip including a storage-throws session.
- **Z4** Exports carry the on-screen numbers, including when results are stale.
- **Z5** Number input parsing: separators, pasted currency, scientific notation, empty.
- **Z6** Zero and boundary sweep: nothing prints NaN, Infinity, -0 or a blank KPI without a reason.
- **Z7** Chart, KPI, table and CSV are four renderings of one model and must agree.
