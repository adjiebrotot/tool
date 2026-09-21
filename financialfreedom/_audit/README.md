# Financial Freedom Calculator — audit harness

Drives the real page in headless Chromium (CDN libs stubbed, so it runs offline;
the Chart.js stub records every chart config so the plotted series can be
inspected) and checks it against an **independent replay** of the ten-step
algorithm documented at the top of `script.js`.

The replay is deliberately written a different way from the page, so agreement
means the maths agrees rather than an implementation being compared to itself:

- the page solves the required pot in **one affine forward pass**, carrying the
  balance as `a*W + d` and reading every constraint off it. The replay walks the
  requirement **backwards** from the terminal condition, month by month, flooring
  at zero: `W(t) = max(0, W(t+1)/(1+rm) + expense - pension)`;
- Die Rich is checked a third way, against the **closed-form perpetuity-due**,
  and with a pension against a perpetuity plus a backward bridge;
- accumulation is checked against the **closed-form future value of a growing
  annuity**, while the page runs a month loop;
- the freedom age is checked against a **brute-force month-by-month scan** built
  entirely from the replay's own functions.

Run: `node run.mjs`

## Covered

The three goals and their exact closed forms; the zero-real-return limit, where
the pot is spending times months and a naive formula divides by zero; a negative
real return, which is fatal for Die Rich and fine for Just Die; forward
simulation from every solved pot never dipping below zero.

**The pension bridge**, which is where closed forms go wrong. A pension larger
than the spending makes the terminal condition slack, so the pot is set by the
years before the pension starts instead, and the plan ends with money left over.
Die Rich with a pension that starts after retirement is pinned separately: the
pot is *supposed* to fall through the bridge and then hold for ever, and an
earlier version of this tool rejected exactly that by comparing the horizon
balance against the starting pot. F8 exists because the page got it wrong first.

Randomness: zero volatility collapsing every percentile onto the deterministic
line exactly, seed reproducibility, success probability being monotone in the
pot (which is what the common-random-numbers design buys and what the confidence
pot depends on), and the log-growth drift and spread matching the documented
log-normal over 240,000 draws.

The crash stress test as a scalar multiplier at the retirement month, and the
pot that survives it. Ticker statistics against a synthetic series with a known
closed-form answer, including a crash whose true depth is `0.70 * step - 1`
rather than a round -30%, because the series keeps compounding through the gap.

Feasibility: the promised "mathematically impossible" wording, Die Rich below
inflation getting its own explanation rather than the generic one, already-free
not being treated as a failure, nonsense ages being input errors rather than
impossibility, and the solved savings remedy actually reaching the amount
needed. F18 exists because a crossing at the life expectancy used to count:
at that age there is nothing left to fund, so the required pot is zero and a
plan that never saved a cent was declared free at 90.

Presentation: future dollars being today's money times the inflation factor to
the cent, the chart starting at the current calendar year and today's assets,
both axes titled, **no hardcoded colours anywhere in any chart config**, the
theme toggle rebuilding charts from the new tokens, the currency picker changing
the symbol without touching the number, every tour step target resolving, and no
uncaught page errors.

`SharedPriceCache` round-tripping through the DCA simulator's own
`dca_priceCache_v2` key with every field those tools read back (`source` and
`kind` drive their unadjusted-price warning), and nothing being fetched before
the user presses the button, because the whole origin shares a five-request
daily allowance with both DCA tools.
