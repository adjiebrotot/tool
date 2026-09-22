# Financial Freedom Calculator — audit harness

Drives the real page in headless Chromium (CDN libs stubbed, so it runs offline;
the Chart.js stub records every chart config so the plotted series can be
inspected) and checks it against an **independent replay** of the ten-step
algorithm documented at the top of `script.js` (eleven steps since the overhaul).

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
- the pension's indexation is a branch in the page and a **discount factor** in
  the replay, so an unindexed pension agreeing means the erosion agrees;
- the cashflow balance is `lifetimeSeries` in the page and `refLifetime`, a
  forward walk written straight from steps 4 and 5, in the replay;
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
ACCUMULATION exactly — the band wraps the line it is drawn around, and that line
never withdraws — seed reproducibility, success probability being monotone in the
pot (which is what the common-random-numbers design buys and what the confidence
pot depends on), and the log-growth drift and spread matching the documented
log-normal over 240,000 draws.

**The cash flows and the money you put in.** `Saved = Income - Expense` in every
row of the table, under both savings models and across a pension start, and all
three columns against the replay's own flows rather than against each other
(F42e, because the table derives Saved by subtraction and would otherwise be
proving only its own arithmetic). The deposited line belongs to the path chart,
where nothing is ever withdrawn, and is pinned five ways: the replay identity on
four plans, the shape it exists for (never exceeds the pot, never negative, and
under the savings model only ever climbs because there is no retirement on that
chart to turn it down), the closed form at four separate months, the one case
that can hold it down — an income below the spending pays in nothing at all —
and the floor at zero, where a pot eaten to nothing leaves nothing of what you
put in. F41h pins the deletion: the drawdown series carries no deposited line at
all, because the section it belongs to does not ask that question.

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

Presentation: future's money being today's money times the inflation factor to
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

**Two sections, and the line between them.** The page answers two questions and
keeps them apart, so the harness pins the separation itself. F48 reads the two
boards: their headings, that each owns its own cards, and that section 1 never
names a retirement age while every section 2 card that has one says which age it
is measured at. F51 drags the slider from one end of its range to the other and
checks that the freedom age, all three plotted lines and the pot the crossing
happens at are byte-identical at every position, while every figure in section 2
is different at every position. F44h is the identity that ties them together:
the cashflow balance IS the section 1 accumulation up to the retirement month
and strictly below it from the next month on, because one keeps paying in and
the other has started taking out.

**The retirement age is a slider** (F52), capped from the age now to the life
expectancy, with the number input gone from the input panel. Both ends have to
be ordinary answers rather than errors — stopping today and never stopping are
exactly what a sensitivity control is for — which is why F22, which used to
demand an "invalid" verdict for a retirement age equal to the age now, now
demands the opposite. Dragging the life expectancy under the handle pulls the
handle down with it.

**Both charts after the overhaul.** F43 pins the path chart at exactly
three lines and a band — pot needed, investment outcome, money deposited, no
median — running the whole plan with **no withdrawal anywhere in it**, which is
what makes the crossing readable and what makes the plotted line the same line
the crossing is solved against. F34d and F35 pin the consequence: sixty years of
compounding put the end of a plan two orders of magnitude above its beginning,
so the chart OPENS on the years that decide the answer and `limits` is pinned to
the data rather than to the view, with the whole plan one pinch away.

F44 pins the cashflows, which are one chart with two stacked panes now. Above,
in two thirds of the height, income against spending with the gap filled on both
sides in two different colours from the token set (F25 reads `fill.above` and
`fill.below` too, or the one place a hardcoded hex could hide would be exactly
there). Below, in the remaining third and on a scale of its own, the balance
they leave behind. A stock and a flow cannot share a scale — a balance in the
millions flattens a spending line in the tens of thousands into the axis — but
they are one picture, so they are two stacked scales rather than two charts,
which is what used to let a year drift out of line between them. F48b2 pins the
one card, one `.canvas-wrap` and one canvas; F44f that the balance is on its own
stacked pane under the flows rather than a second axis across them; F44f2 that
the pane is DEFINED first, which is what puts it underneath, because Chart.js
stacks a group in definition order, bottom first; F44f2b that both panes span
the same years; and F44g3 that one key covers both panes with the retirement
rule as a single entry drawn once in each. F44g-g2b pin the merged fill
legend, now five entries rather than four.

**A balance that runs out is drawn where it lands.** The cashflow balance is
plotted exactly as the engine leaves it, negatives included: a pot that fails
keeps owing, which is how the engine records the size of the miss, and the
chart used to be the one place on the page that flattened it against zero while
the table and the "Left at" card both reported it. F44f3 drives a plan that
runs out and checks the plotted series against the table's own figures to the
cent, F44f3b that the axis opens under zero and the subtitle says the line goes
there. F50f keeps the opposite rule where it still belongs: the PATH chart's
balance is floored at zero, because going under there means the pot is being
eaten before retirement and a line compounding into the red would squash
everything real into a sliver. The shaded gap is ONE quantity, what income leaves over, and the two
colours are its sign, so it is a single **Savings/Withdrawal** entry with a
swatch split down the middle rather than two entries a reader has to add up.
Banning the old wording would not hold that: split it back into "Surplus" and
"Deficit" and a label test passes while the key has two entries again. So the
invariant is structural — the key has exactly four entries, exactly one of them
is a filled block, and that one block carries BOTH of the colours the chart
fills with, read off the dataset's own `fill.above`/`fill.below` rather than
restated. A split gives each entry one colour and all three checks fail at
once; a recolour of the chart that left the key behind fails F44g2b. F50i pins that the balance pane is refitted in the
same pass as the flows, or it would be left drawn against a window it is not
in.

**One x window, by construction.** The flows and the balance they leave behind
are one picture, so a year has to sit in the same place on both — and now it
does because there is one chart under them, with a single pair of x axes. F59
pins that: two charts on the page, the balance a dataset of the flow chart, one
`x` and one `xAge` serving both panes, and **no** zoom or pan callback left
anywhere, because there is no second chart to mirror a window to. F59c zooms it
and checks both panes are sized to the years shown in the one update the gesture
triggers, F59d that the path chart, which answers a different question on a
different opening view, does not move with it. F50j pins the reset: one button,
one chart, both panes back. The pair of charts that this replaced had to carry
the window across through the zoom plugin's own `zoomScale` rather than by
assigning to the scale options, because the plugin records a scale's original
bounds the first time it is asked to move it — an entire class of bug that
having one chart removes rather than guards against.

**Two verdicts, one per question.** The page banner carries what the slider
cannot move — a broken pair of ages, a plan no pot of any size funds, and the
age the crossing happens at — while the verdict on the SLIDER'S OWN age
("not by 45, you get there at 64") hangs directly under the slider, with the
remedies that close the gap. F63 pins the placement (the slider card is the
slider's next sibling, inside the Cashflows header; the banner is still first in
the main column), F63b that the warn verdict and its remedies moved there,
F63c that the banner never names the retirement age for any status, F63d that
universal impossibility stays on top with the slider card silent rather than
repeating the failure a second time, and F63e the clearing case.

**Invested assets today is an investment figure.** F64 pins it on the Investment
tab, first, beside the return and volatility it earns, off the Goal tab where it
used to sit among the choices about what the money should do — with its label,
its currency prefix and a tip that points at the return below it.

**What the tooltip is pointing at.** Chart.js resolves an `index` tooltip by
DATA INDEX: nearest element, then read that index out of every other dataset.
Every series here is one point per year EXCEPT the droplines, which are two
points, and the crossing marker, which is one — so hovering either of those
asked for index 0 or 1 of the yearly series, and the tooltip reported the FIRST
YEAR of the plan under the hovered year's heading: the crossing dot in 2061
showing "Money deposited: $100k", which is the balance today. F58 pins the fix,
a custom interaction mode that matches by x VALUE, against hand-built metas in
exactly that shape: a yearly series, and a one-point marker sitting between two
of its samples. Hovering a year reads that year and nothing else; hovering the
marker answers for the marker. F58d pins the other half — a dropline is a rule,
not a reading, and both of its ends sit on the hovered year, so it is filtered
out of the tooltip rather than listed twice, once at its value and once at
zero.

**The pension, per week or per year, indexed or frozen.** F53 pins that the same
pension entered weekly, monthly or yearly gives the same pot to the cent, and
that a weekly figure is 52/12 of a month rather than a quarter of one. Then the
choice that actually changes the answer: an indexed pension is flat in today's
money, while a frozen one decays by exactly the inflation factor measured from
TODAY rather than from its start age — the amount entered is what it pays now,
so the years before you claim it erode it too. An indexed pension is worth more
than a frozen one, which is worth more than none; at zero inflation the two are
the same plan to the cent; and under Die Rich a frozen pension has all but faded
by the age-120 horizon, which is why the perpetuity there is taken on the net
draw at the horizon.

**The table adds up.** The year-by-year table is a cash flow statement now, with
the pot and the gap gone and a Growth column in their place, and F54 treats it
as one. On twelve plans — both savings models, both moneys, a frozen weekly
pension, an indexed pension bridge, stopping today, never stopping, a plan that
runs out, all three goals, zero inflation and zero real return — it checks that
`Saved = Income - Expense` in every row, that `Balance + Saved + Growth` is next
year's Balance, that the balance column matches the replay's own forward
recurrence, and that the column starts at today's assets and ends on the
engine's own terminal. F54e telescopes the lot: assets today plus all the saving
plus all the growth is the final balance. F54f pins what the residual MEANS in
each money — in today's money the real return, in the money of the day the same
earnings plus the inflation uplift on the balance and on that year's flows,
written out as a decomposition. F54h-l check that the four cards over the table
say what the table says.

**Inflation being visible, not merely applied.** The engine runs in real terms,
where the living cost is flat and inflation can therefore look inert. F37 pins
the Expense column: flat in today's money, exactly the real cost times the
inflation factor in future's money, and rising *before* retirement as well as
after. The pot needed lost its table column when the table became a pure cash
flow statement, so F38 reads it off the curve the page plots instead. F38 pins the consequence the tool is often asked for and rarely shows:
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

**The cuts that stuck.** The confidence pot has no card of its own, but the
figure still rides under the probability it belongs to (F48d). The board
kickers and the ledes under each heading are gone (F48e), and a subtitle now
carries only what changes with the plan rather than repeating the legend
(F48f). F61 holds the same line on the tips: every one of them is short enough
to be read where it pops up, because a tip that runs past a couple of lines is
one nobody reads.

**The marked row in the year-by-year table.** The table belongs to Cashflows,
where everything is measured at the age on the slider, so F60 pins that the one
highlighted row is the RETIREMENT year — not the freedom age, which is Path to
freedom's answer and cannot be read off a table the slider redraws. F60b checks
the two really are different rows, so the move is real rather than a coincidence
of the defaults, and F60c that the note under the table says which row it is.

The exports: every control present, the CSV carrying the same columns and the
same row count as the table it came from, and naming the currency and the money
mode it was taken in. F39e-g pin the legend packing, on labels of a known width
so the check does not depend on a font headless Chromium may not have: the
exported legend used to be laid out on one assumed row, which fitted four
entries and pushed the sixth through the watermark and off the right edge of
the canvas. The action row: Simulate and Reset pinned together rather
than Reset buried in the Settings tab.

**A fuzz pass under all of it.** F56 runs 200 plans nobody chose — random ages,
periods, rates, goals, pensions, both savings models and both moneys, from a
fixed seed so a failure names its plan — and asserts every invariant at once:
nothing is ever NaN or an unexpected Infinity, `Saved = Income - Expense`, every
row closes into the next year's balance, the whole balance column matches the
replay, a reported freedom age is one the plan is genuinely funded at AND the
earliest such month (the month before it must NOT qualify, or the headline is
not the earliest age it claims to be), probabilities stay in [0,1], only Die
Rich may need an infinite pot, and no NaN ever reaches a chart. It is the net
under everything above: a combination no hand-written case thought of either
satisfies every invariant or shows up here.

**The Quick Start scenarios.** Six buttons, each claiming the whole form now
describes a named saver, so F65 reads the CONTROLS back rather than
`readInputs()`: a scenario writing to an id that no longer exists would
otherwise be papered over by the engine's own defaults and the button would
quietly load somebody else. The return and the volatility are checked against
the asset preset each scenario names, because they are taken from it rather than
stored again beside it, and the two could otherwise drift apart on the next
preset revision. F65e-g pin what a worked example has to be: every scenario
reaches financial freedom, its slider opens PAST that age so Cashflows starts on
a funded plan, and not so far past it that the plan reads as risk-free — the
crossing is solved on the expected return alone, so every scenario has to land
between a 60% and a 90% chance, where the confidence pot underneath still has
something to say. Then the lesson each tooltip promises: Frugal Living freeing a
saver in fewer YEARS OF WORK than the moderate plan, not merely at a younger age
(F65h); the Bali scenario's 40% retirement multiplier being worth years against
the same saver who stays home (F65i); and the late starter's age pension being
worth years against the same plan with it switched off (F65j). F65k follows the
late starter with a scenario that has no pension and checks nothing was
inherited, because every scenario is built on the DEFAULTS rather than over
whatever the last one left behind. F65l pins that Reset drops the highlight
along with the figures, or the page claims a scenario it no longer shows.

**Coming back tomorrow.** F57 reloads the page and checks the mini cache brings
the plan back. The slider is the awkward one: a range input clamps an assigned
value to the min and max ATTRIBUTES it currently carries, and those are only
rewritten by a render, so a handle restored before the ages that widen its range
would silently land on the old ceiling. The static pair in the markup is
therefore the widest either age can ever be, and F57 is what says so — along
with the pension coming back with its rate and its indexation intact, and the
plan reloading to the same answer to the cent.

`SharedPriceCache` round-tripping through the DCA simulator's own
`dca_priceCache_v2` key with every field those tools read back (`source` and
`kind` drive their unadjusted-price warning), and nothing being fetched before
the user presses the button, because the whole origin shares a five-request
daily allowance with both DCA tools.
