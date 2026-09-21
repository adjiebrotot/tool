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
  entirely from the replay's own functions;
- the deposited line is a running clamp in the page and a **closed
  running-minimum identity** in the replay,
  `D(T) = max(0, min over k of [W(k) + C(T) - C(k)])`, which agrees with the
  loop only if both the clamp and the deposit accounting are right;
- income and spending are rebuilt from the two savings models directly, rather
  than from the page's own helpers, so agreement means the definition agrees;
- a pot the page solved backwards is walked **forwards** through the replay's
  own step-5 recurrence (`refForward`), so "the solved pot never dips below
  zero and lands on its terminal condition" is page against replay rather than
  page against itself.

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

**The cash flows and the money you put in.** `Saved = Income - Expense` in every
row of the table, under both savings models and across a pension start, and all
three columns against the replay's own flows rather than against each other
(F42e, because the table derives Saved by subtraction and would otherwise be
proving only its own arithmetic). The deposited line is pinned four ways: the
replay identity on four plans, the shape it exists for (climbs only while you
are still paying in, never exceeds the pot, never negative), the closed form at
the retirement month (starting assets plus every cent paid in), and the two ends
of the spectrum — Die Rich never touches capital, a pot spent to nothing leaves
nothing of what you put in.

F45 pins the deletion: no drawdown field, no stress toggle, no crash metric, no
`stressRequiredPot`, no `mdd` on a preset or in the defaults, and no crash left
in the assumptions copy. The volatility already carries the downside, and a
single hand-placed drawdown said less than the Monte Carlo does.

Ticker statistics against a synthetic series with a known closed-form answer: a
gap down lowers the measured compound return and raises the measured volatility,
which are the only two figures the engine takes now.

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

**Both x axes**, the calendar year the data is plotted on and the age beside it:
that they span exactly the plotted data, that the age axis reads in ages rather
than repeating the year, and that the zoom `limits` pin that span on both, so a
zoom-out cannot pull back past the data the way an unbounded linear scale
otherwise would.

**The crossing marker.** It falls between two yearly samples, so it is checked
against a straight line through the two samples it sits between rather than
against either one, and its dropline is checked to run from the axis to it.

**Both charts after the revision.** The path chart runs the whole plan rather
than stopping past retirement, and carries the deposited line, which has stopped
climbing by the retirement age. The second chart plots income against spending
over those same years, with the gap filled on both sides in two different
colours from the token set (F25 reads `fill.above` and `fill.below` too, or the
one place a hardcoded hex could hide would be exactly there), an axis that says
it is a yearly flow rather than a balance, a legend that names both sides of the
fill, and no trace of the four-pot drawdown it replaced.

**Inflation being visible, not merely applied.** The engine runs in real terms,
where the living cost is flat and inflation can therefore look inert. F37 pins
the Expense column: flat in today's money, exactly the real cost times the
inflation factor in future dollars, and rising *before* retirement as well as
after. F38 pins the consequence the tool is often asked for and rarely shows:
in the money of the day, freedom at a later age costs MORE, while in today's
money it costs less because fewer years are left to fund. Both are true at once
and the page has to say which one it is showing.

**Which money the page opens in.** Future dollars are the default, because a
balance in the money of its own year is the figure a statement will actually
read; today's money is the opt-in, behind Show Present Value. F47 pins that from
the page as it loads — the toggle's wording, its unchecked state, the defaults
object, the axis title, and the plotted balance genuinely carrying the inflation
factor without anyone asking for it. Everything after F47 flips the toggle on,
because the replay is written in real terms.

**A point in time is a date, not a decimal.** The crossing falls between two
yearly samples, so its x is 2039.1666…, and F49 pins every place that used to
print that number: the tooltip, the hover line under the chart, and the
freedom-age sub-line all name the month instead ("Feb 2040"), while a whole-year
sample and the axis ticks themselves stay plain years.

**The y axis follows the x window.** A linear y axis is sized once, from the
whole series, so zooming into ten years of a sixty-year plan used to leave those
ten years as a flat smear against a scale built for the end of it. F50 pins the
refit: narrower windows get strictly narrower axes, the first five years no
longer live in the bottom quarter, the balance axis never opens below an empty
pot and the cash flow axis keeps zero. It also pins HOW: a chart plugin running
inside the update the gesture triggers, with nothing hanging off the gesture
itself, because a second update chasing the first leaves the lines drawn against
the old scale while the ticks already show the new one. F50h pins the other half
of that lesson — the reset button repaints once more, because the tick set built
on the reset pass is the zoomed one.

**The two cuts.** F48: the confidence pot has no card of its own any more, but
the figure still rides under the probability it belongs to; and neither chart
carries a subtitle explaining what its legend and its axis already say.

The exports: every control present, the CSV carrying the same columns and the
same row count as the table it came from, and naming the currency and the money
mode it was taken in. F39e-g pin the legend packing, on labels of a known width
so the check does not depend on a font headless Chromium may not have: the
exported legend used to be laid out on one assumed row, which fitted four
entries and pushed the sixth through the watermark and off the right edge of
the canvas. The action row: Simulate and Reset pinned together rather
than Reset buried in the Settings tab.

`SharedPriceCache` round-tripping through the DCA simulator's own
`dca_priceCache_v2` key with every field those tools read back (`source` and
`kind` drive their unadjusted-price warning), and nothing being fetched before
the user presses the button, because the whole origin shares a five-request
daily allowance with both DCA tools.
