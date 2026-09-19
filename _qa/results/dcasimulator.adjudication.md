# DCA Scenario Explorer — adjudication

Three of twelve cases executed. **E1, the look-ahead case, is confirmed.** N1 and
E2 fail on runner defects, not tool defects. Nine cases were not run.

## Confirmed defect: every conditional trigger executes on its own signal bar

This is the case the whole suite was built around, and it was frozen as a
predicted failure before the engine was ever driven. It is now measured.

Eight conditional styles, one simulated asset, the same ten-year window, the
"invest at end of period anyway" fallback genuinely off (the runner asserts the
checkbox was found and cleared, and aborts if not). The signal bar for each
purchase was recomputed **in the harness** from the page's own displayed close
series, using textbook indicator definitions written for that file, with the
style's parameters read off the form so both sides use identical numbers.

| style | buys | same bar as signal | lagged | min lag |
| --- | ---: | ---: | ---: | ---: |
| MA cross | 6 | **6** | 0 | 0 |
| RSI oversold | 41 | **32** | 9 | 0 |
| Bollinger | 48 | **47** | 1 | 0 |
| MACD cross | 75 | **75** | 0 | 0 |
| MACD histogram | 88 | **88** | 0 | 0 |
| ADX | 35 | **17** | 18 | 0 |
| Price % dip | 28 | **28** | 0 | 0 |
| Price % peak | 26 | **26** | 0 | 0 |
| **total** | **347** | **319 (92%)** | 28 | **0** |

**319 of 347 purchases execute at the close of the very bar whose close produced
the signal.** All eight styles do it. The minimum signal-to-execution lag across
every purchase is zero.

`unmatched_buy_count` is **0**, which is what makes this trustworthy: the
independent recomputation attributed every single purchase to a signal bar. Had
the harness's indicator maths disagreed with the engine's, purchases would have
been left unattributable. They were not.

The 28 lagged purchases are not the engine being careful. They are the
once-per-period reduction: when a condition is already true from an earlier bar
in the month, the month's single purchase lands after the condition's rising
edge. That is a cadence artefact, not execution discipline.

**What it means.** A signal computed from day D's close cannot be acted on at
day D's close: at the moment the close is known, the session is over. Every
backtested return from a conditional style in this tool is therefore optimistic
by one bar of hindsight, and systematically so, because the signal fires
precisely on bars where price has already moved. The fix is to execute at D+1
(open where available, else the D+1 close), which will lower every conditional
style's reported result. The perfect-foresight styles already carry an explicit
on-page warning; the conditional ones carry none, and currently need one more.

## Runner defects (mine)

### N1 — `max_abs_gap_days` measured the wrong thing
I computed the gap between consecutive purchases (about 30 days for a monthly
style) against an expectation of ≤ 3, which is plainly about the distance from
the requested day of the month. The buy dates themselves are right: 120 buys
over 120 months, no month missed, none doubled, first buy 2015-01-15, and
2024-06-14 for a 15th that fell on a weekend. Three reconciliation ratios were
reported null because this runner does not parse the Detailed Breakdown columns.

### E2 — the equity parser read the deposit, not the final equity
`eq_mbot`, `eq_m15` and `eq_mtop` all came back as exactly 120,000, which is the
amount deposited, because the parser took the last currency figure in each
summary tile. The bracketing invariant is therefore **not tested**: differences
of 0 are an artefact. The buy counts are real (521 expected against 525 observed
for the weekly styles, a bar-convention difference worth its own look).

## Not run

E3–E11, except that E6 and E11 need the live market-data worker, which this
sandbox cannot reach. The rest are simply not implemented by this runner.
