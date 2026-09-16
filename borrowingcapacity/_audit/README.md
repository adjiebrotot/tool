# Borrowing Capacity — audit harness

Drives the real page in headless Chromium (CDN libs stubbed; the Chart.js stub
records every chart config so the plotted series can be inspected) and checks it
against an **independent replay** of the documented eight-step algorithm.

The replay is deliberately written a different way from the page, so agreement
means the maths agrees rather than the implementation being compared to itself:

- tax is built in the ATO's published "base amount plus cents in the dollar"
  form, while the page walks the brackets;
- the loan a repayment supports is found by **bisection** on the repayment
  function, while the page uses the closed-form present-value annuity.

Covered: the shipped default before anything is disclosed, the full scenario end
to end, the three tax years, LITO, the Medicare
levy phase-in and the surcharge tiers, the marginal HELP system and
both of its treatments, HEM overriding declared expenses and its city index,
credit cards assessed on the limit, interest-only amortisation for both the new
loan and existing ones, all four caps binding in turn, the DTI income bases,
the deposit formula, capitalised LMI feeding back into serviceability, the
negative gearing add-back, the NSR and UMI tests closing exactly, the chart
(axes, the scenario sitting at the centre, and the capacity line being the
minimum of the four caps at every income), the mini cache round trip, and edge
cases: zero income, a zero assessment rate, commitments floored at zero.

Also covered, since the form gained progressive disclosure: Simple and Detailed
describing the same person (the headline figure carried across in both
directions, and Simple assessing it in full), the Employee / Self-employed
switch silencing the side it is not on, each checklist box zeroing its inputs
rather than leaving a hidden figure live, the HEM benchmark being stated under
the expenses field instead of in the warning banner, the segmented controls
surviving the mini-cache round trip, and every chart series carrying its own
line colour, marker colour, dash and tooltip swatch.

And since the form was thinned out: Simple taking the LVR ceiling from the LMI
switch and the valuation from the price while the hidden dials keep their own
values for Detailed, the deposit giving the same answer whether it is stated as
cash net of purchase costs or as a share of the price with those costs on top,
the warning banner reading as a sentence for one point and as a list for
several, the chart's x axis sitting exactly on the swept range with pan and
zoom held inside it, and the row separators never doubling a card border or
underlining a group title — checked across all five tabs in three different
states of the form, since which row comes first is exactly what the modes and
checklists change.

Since the income split landed: two applicants taxed as two people rather than
one, the split being inert at a single applicant, a split of 0 reproducing the
old single-taxpayer figure exactly, splitting never costing a couple more tax
than pooling at any income from $40k to $400k, and the slider appearing only
where it means something. The replay names the two applicants explicitly and
adds them, while the page sums a reduce() over an array of shares, so the two
sides agree on the arithmetic rather than on a shared shape.

And since the Quick Start scenarios landed: each of the five applying its modes,
its figures and its checklist boxes in full (read off the controls themselves,
not off readInputs(), which renames and derives, so a scenario writing to an id
that no longer exists is caught rather than papered over), binding on the cap it
is documented to bind on, never inheriting the previous scenario's commitments,
and clearing its highlight on Reset. Two of those checks exist because the
scenarios got them wrong first: the first home buyer must gain capacity when LMI
is capitalised, not merely change which cap binds, and no scenario may bind
within 5% of its next cap. On a thin margin, capitalising the premium divides
serviceability by 1 plus the rate and leaves the borrower worse off, which is
the reverse of the lesson the button claims to teach.

The tour is covered too: every step's selector resolving to an element with a
real box, saveState returning null on a page nobody has touched so a first-time
visitor keeps the demo, and a page the user has worked on coming back exactly as
they left it after the tour seeds a scenario over the top of it. The harness also
marks the tour as already seen, because clearing localStorage would otherwise
re-arm the first-visit auto-start on every reload.

Run: `node run.mjs`
