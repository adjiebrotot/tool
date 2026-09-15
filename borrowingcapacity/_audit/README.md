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

Run: `node run.mjs`
