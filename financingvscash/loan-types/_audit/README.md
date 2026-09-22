# Loan Types Explained — audit harness

The page prints worked numbers in its prose, its key-figure cards and its
tables, and a reader is meant to be able to take those numbers to a calculator.
So they have to be right, and they have to stay right when the copy is edited.

`run.mjs` drives the real page in headless Chromium (offline, third-party
requests stubbed) and checks three separate things.

## 1. An independent replay of the documented mathematics

`replay()` is written from the formulas the page itself prints, in the page's
own words, and shares no code with `../script.js`. It carries both rate
conventions, because the page does: effective annual everywhere, nominal on the
flat-rate deals, which is exactly how the tool's Quick Start presets are set.
Its rate solver works on the discounted form rather than the page's forward
recursion, so an error in one cannot hide inside the other.

Every scenario on the page is restated here from the prose, not read out of the
page's data, so a silent change to an example's numbers fails the run.

## 2. What the page prints

- every `[data-fig]` figure, rounded to the decimals it is printed with;
- every schedule row of every scenario, payment by payment, against the page's
  own engine, so the charts cannot drift from the prose;
- the claims the prose makes in passing ("$192.45 less than card 01",
  "$803.61 more than without"), computed from *rounded* components, because a
  reader works those differences out by subtracting two printed figures;
- the figures repeated inside the FAQ answers and the JSON-LD, read with
  `textContent` so a collapsed answer still counts.

## 3. What the page shows

- no page errors, one SVG per chart slot, all seven sparklines drawn;
- a split chart draws exactly one bar group per period that has a payment, so a
  payment holiday shows as empty months rather than as phantom interest;
- every loan-type card names the markets the structure is sold in, and every
  example names the Quick Start preset it came from;
- the tool links back here from under its own Loan Type control.

## Running it

```sh
node financingvscash/loan-types/_audit/run.mjs
```

Exits non-zero on any failure.
