# DCA Portfolio — adjudication

Three of twelve cases executed. **P1 confirms the same look-ahead defect the
single-asset tool has.** N1 is clean apart from one observable this runner does
not derive. P5 is **unresolved**, not a finding.

## Confirmed: the portfolio engine deploys on its own signal bar

Frozen as a predicted failure before the page was driven. Two assets, SIMA on a
percentage-move trigger measured against the previous top (5% below the highest
close of the 20 bars before the one being tested), SIMB deploying at each
top-up, cash reserve, no fees, ten years.

The signal bars were recomputed in the harness from the page's displayed SIMA
closes, stating the rule causally so the anchor never reads the bar it is
testing. That produced **59 signal bars**, and **59 deploys land exactly on
one**. The minimum lag across every deploy is **0**.

So the portfolio engine behaves as the single-asset engine does: a trigger read
from day D's close is acted on at day D's close. Together with E1, the defect is
confirmed on both engines and across both trigger families (technical indicators
and percentage-move rules).

### Two limits on this measurement, stated rather than buried

- **451 deploys were counted, not 59.** SIMB is set to deploy at every top-up,
  and the Breakdown Table tags those rows `Trigger` as well, so the total mixes
  both assets. The runner cannot attribute a row to one asset from that table.
  What is solid is the other direction: every one of the 59 signal bars carries
  a deploy, and the minimum lag is zero. The 59 is therefore a floor on same-bar
  behaviour, not a total.
- **`cash_unmatched_deploys` is 3**, where E1's equivalent was 0. Those are
  deploys before the first signal bar, which are SIMB's at-top-up deploys. Not a
  failure of the recomputation, but it does mean this case is noisier than E1.
- **The holding-reserve state was not driven at all**, so the question P1 also
  asks — whether the reserve sale that funds a trigger is priced on the signal
  bar — is untested. Those keys are null, not zero.

## N1 — clean

120 monthly top-ups on the 15th, 120,000 deposited, 40 quarterly rebalances over
ten years, none off schedule, no cash ever negative, no NaN, no page errors. The
one failing check is `value_identity_ratio`, reported null because the Breakdown
Table gives asset values rather than units, and this runner does not derive the
identity from them.

## P5 — unresolved, not a finding

Same seed, same asset definition, same window, same amount, same schedule.
Deposits match exactly (120,000 each), buy counts match (120 each), and **every
buy date matches**. Final values do not: 192,883 on the single-asset page against
203,701 in the portfolio, 5.3% apart.

That is not yet a defect, for two reasons:

1. `price_series_match` is **false but confounded**. The portfolio price chart
   normalises to base 100; the single-asset chart shows actual prices when only
   one series is visible. The two series are therefore expected to differ in
   scale, and this comparison cannot distinguish that from genuinely different
   price paths.
2. The single-asset final value is parsed as the largest currency figure in its
   summary tile, which is a guess at which tile number is the equity.

A clean re-run needs the final equity read from a labelled field on both pages
and the price series compared on a common scale. Until then this is an open
question, and it is the one I would chase next, because if the two tools really
do generate different paths from one seed, P11's determinism claim fails with it.

## Three runner defects found on the way, all of which produced false results

Recorded because each one silently measured the wrong thing before it was
caught, which is exactly the failure mode a harness repeats:

1. **The shipped portfolio already holds Equities and Bonds.** The first run
   added SIMA and SIMB alongside them, so weights, triggers and deposits all
   described a four-asset portfolio.
2. **The top-up schedule defaults to the 1st.** Never having set the day of
   month, the portfolio bought on the 1st while the single-asset page bought on
   the 15th. That alone produced a 17% gap in P5 that was entirely the harness's.
3. **The simulated-asset pool is shared between the two tools** through
   localStorage on the same origin. The single-asset page's dropdown therefore
   offered `Equities`, and "the first simulated option" selected the wrong asset.

The runner now asserts the form state — dates, amount, period, asset list, and
on the single-asset side the scenario count and chosen asset — and throws if any
of it did not take. That assertion is what caught defects 2 and 3.
