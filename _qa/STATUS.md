# Financial tools regression suite — where this got to

## Coverage

| Tool | Cases | Checks | Specified | Frozen | Run | Adjudicated |
| --- | ---: | ---: | :-: | :-: | :-: | :-: |
| financingvscash | 12 | 142 | ✓ | ✓ | ✓ 12/12 | ✓ |
| rentvsownhouse | 13 | 191 | ✓ | ✓ | 9/13 | ✓ |
| dcasimulator | 12 | 109 | ✓ | ✓ | 3/12 | ✓ |
| dca-portfolio | 12 | 133 | ✓ | ✓ | 3/12 | ✓ |
| borrowingcapacity | 14 | 226 | ✓ | ✓ | — | — |
| pisahvsgabung | 11 | — | contract only | — | — | — |
| costofliving-comparator | 10 | — | — | — | — | — |
| cross-cutting (Z) | 7 | — | — | — | — | — |

**63 cases and 801 checks specified; 50 cases and 801 checks frozen; 27 cases
executed against a real page.**

## What the completed runs establish

**Finance vs Cash: correct on all 12 cases.** The period-rate convention is
`(1+r)^(1/m)−1`, established by a deliberate rival pair rather than assumed: a
50,000 loan at 12% charges 474.44 in period one, not the 500.00 a nominal APR/12
would charge. Rent vs Own and Borrowing Capacity use the nominal convention, so
**the same loan differs by 15.44 a month between tools on this site**. That is
Z1, confirmed.

**Rent vs Own: no defect established, and five cases never ran.** The RTB
transition reproduces two independently derived figures to the cent (purchase
price 1,021,025 and loan 816,820), and RTB tracks Rent to the rupee while still
renting. The engine compounds cash monthly where the plan assumed yearly, which
the plan itself flagged as a guess; monthly is the more faithful model.

**DCA Scenario Explorer: the look-ahead defect is confirmed.** 319 of 347
purchases across all eight conditional styles execute at the close of the very
bar whose close produced their signal, with a minimum lag of zero. The signal
bars were recomputed in the harness from the page's own displayed prices, and
every purchase was attributable, so the measurement is sound. Details in
`results/dcasimulator.adjudication.md`.

**DCA Portfolio: the same look-ahead defect, confirmed on the second engine.**
59 signal bars, 59 deploys landing exactly on one, minimum lag zero. So both
engines act on a signal at the close of the bar that produced it, across both
trigger families.

**Rent vs Own R9: the two pages agree at the baseline.** Every gap is the
sensitivity page's compact rendering ($3.72m against an exported 3,722,870), and
it carries no rent-then-buy row, as documented.

## What is NOT tested

Stated plainly, because a suite is only as honest as its gaps.

- **P1's holding-reserve half is unanswered.** Whether the reserve sale that
  funds a trigger is also priced on the signal bar was not driven.
- **P5 is unresolved.** Same seed, asset, window, amount and buy dates, yet final
  values 5.3% apart. The price-series comparison is confounded by one chart
  normalising to base 100, so this is an open question, not a finding.
- **E2 did not test its invariant.** The equity parser read the deposited amount
  instead of the final equity, so the perfect-foresight bracketing is unverified.
- **R9's real case did not run.** It passes at a baseline with rent-then-buy
  OFF. The divergence it exists to catch happens with RTB ON, where the main
  page's auto budget becomes max(own, rent, rtb) and the sensitivity page's
  stays max(own, rent). Still the highest-value untested comparison.
- **R5 did not run.** Rent vs Own's predicted failure.
- **R8 is unresolved**, not cleared: the breakeven KPI returned null in two
  states and the cause was not established.
- **R1 passes with less information than it looks.** The page's rent CSV writes
  the Own budget into the Rent budget column, so own-vs-rent budget parity read
  from the export is true by construction.
- **Three cases need the market-data Worker**, unreachable from this sandbox,
  and are marked so a runner records them as not-run rather than skipping.
- **pisahvsgabung, costofliving and the Z cases** have no frozen expectations.

## How to carry on

```sh
node _qa/eval/check-freeze.mjs          # expectations unmoved since authoring
node _qa/run/<tool>.run.mjs             # drive the real page
node _qa/eval/evaluate.mjs <tool>       # score against the frozen plan
node _qa/eval/report.mjs --md _qa/results/REPORT.md
```

Next, in value order: R9 with rent-then-buy enabled on both pages; P5 with the
final equity read from a labelled field and the price series compared on one
scale; `borrowingcapacity.run.mjs`, whose 14 cases are frozen and never driven;
then R4, R5, R6, R12 and the remaining E and P cases.

## The one rule

Expected results are authored from the page's contract and finance first
principles, never from the engine, and frozen before the engine runs. Phase 1
may not read `script.js`; phase 2 may not read `_qa/plan/`. When a run
disagrees, the adjudication decides whether the tool, the expectation or the
runner was wrong, with evidence, and **the frozen expectation is never edited to
make a failure go away**. Both adjudications so far found more defects in the
tests than in the tools, which is the normal and healthy result of a first pass.

One caveat on independence: the *case list* came from a prior reading of the
engines, so the scope is not engine-independent even though every expected
*value* is. And I authored the Rent vs Own runner after seeing that plan's
summary numbers, so that runner is less cleanly separated than the Finance vs
Cash one; it reads only rendered values and exports, but a fresh author would be
better.
