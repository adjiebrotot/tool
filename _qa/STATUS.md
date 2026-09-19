# Financial tools regression suite — where this got to

## Coverage

| Tool | Cases | Checks | Specified | Frozen | Run | Adjudicated |
| --- | ---: | ---: | :-: | :-: | :-: | :-: |
| financingvscash | 12 | 142 | ✓ | ✓ | ✓ 12/12 | ✓ |
| rentvsownhouse | 13 | 191 | ✓ | ✓ | 8/13 | ✓ |
| dcasimulator | 12 | 109 | ✓ | ✓ | — | — |
| dca-portfolio | 12 | 133 | ✓ | ✓ | — | — |
| borrowingcapacity | 14 | 226 | ✓ | ✓ | — | — |
| pisahvsgabung | 11 | — | contract only | — | — | — |
| costofliving-comparator | 10 | — | — | — | — | — |
| cross-cutting (Z) | 7 | — | — | — | — | — |

**63 cases and 801 checks specified; 50 cases and 801 checks frozen; 20 cases
executed against a real page.**

## What the two completed runs establish

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

## What is NOT tested

Stated plainly, because a suite is only as honest as its gaps.

- **The look-ahead question is unanswered.** E1 and P1 are specified, frozen and
  marked as predicted failures, but neither DCA engine has been run. Nothing
  here confirms or clears same-bar execution.
- **R5 and R9 did not run.** R5 is Rent vs Own's predicted failure. R9 compares
  the main page against the sensitivity page's second copy of the model, and is
  the highest-value single case in the suite.
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

Next, in value order: write `dcasimulator.run.mjs` and `dca-portfolio.run.mjs`
(the look-ahead question), then finish the Rent vs Own runner for R5, R9 and
R12, then `borrowingcapacity.run.mjs`.

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
