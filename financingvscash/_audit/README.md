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

Run: `node run.mjs` and `node reconcile.mjs`
