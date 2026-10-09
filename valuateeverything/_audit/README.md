# Valuate Everything: audit harness

Drives the real page in headless Chromium (CDN libraries stubbed; a Plotly stub
records every plot the page draws, so the plotted points can be checked) and
holds it to an **independent replay** of the documented mathematics.

The replay is written a different way from the page, so agreement means the
maths agrees rather than the implementation being compared with itself:

- the fit is solved on the **raw, unstandardised** features with an explicit
  Gauss-Jordan inverse of XᵀX, where the page standardises every feature first
  and eliminates with partial pivoting;
- Ridge is replayed in its centred closed form, (ZᵀZ + nλI)β = Zᵀ(y − ȳ), with
  the intercept set to ȳ afterwards;
- Quadratic is replayed on the raw powers [x, x²], where the page uses
  standardised squares. Both span the same space, so the predictions must agree
  exactly.

Covered:

1. **Exact recovery.** Noiseless listings drawn from a known rule across
   several data years give that rule back: the intercept, the effect per year
   of age, per km, and of a Yes/No, with R² = 1. Prices land in today's money
   and years become ages at the listing's data year.
2. **All four Quick Start presets (Camry, Perth house, camera, hotel), all four models.** Predictions, R² and the
   typical error match the replay. Rescaling a feature (km into metres)
   changes its coefficient and never a prediction.
3. **Items never feed the model.** Six extreme items leave every coefficient
   unchanged. The Fair price and Best value cards and the verdict show the
   replayed figures. An item missing a feature is flagged and left unpriced,
   one outside the listings is flagged as extrapolated.
4. **The chart.** The vertical axis is the price in today's money. Every
   listing is shifted to the held values and keeps exactly its own miss from
   the line. Both items are drawn, their fair price on the line. Show data
   points hides the listings. 3D draws a 30 × 30 price surface with grey
   listings and coloured items.
5. **Table, Text and CSV are one dataset.** Units in brackets in the header,
   a text round trip, every Yes/No spelling, typed text becoming typed
   columns, a quoted "31,000" kept whole (as the plain number), Yes/No cells as checkboxes, and a
   blank data year read as the current year.
6. **Edge cases.** A feature that never changes is dropped; features that move
   together exactly are refused in words and Ridge fits them anyway; too few
   listings, no Price and two Price columns are said in words; unreadable rows
   are skipped and counted; a data year after the current year is not read.
7. **Mini cache.** The saved snapshot carries the listings and the items.
8. **The form.** Price and Data year are fixed rows that cannot be picked or
   deleted, and any column set is put in shape (one Price first, one Data year
   last, rows following). Table figures show their prefix, suffix and
   thousands separators while the state keeps plain numbers. An edit marks
   the answer out of date without changing it, and Valuate runs it. With one
   item, Hold others at is hidden and the chart holds at that item. The items
   table has no Note column, and the equation falls back to plain text when
   KaTeX is not there.

Run:

```sh
cd valuateeverything/_audit && node run.mjs
```
