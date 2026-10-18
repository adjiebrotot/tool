# Random Picker — audits

Two harnesses: `odds.mjs` for the odds, `embed.mjs` for Share and embed.

Pure-Node replay of the two modes that can come up empty. The rules are lifted
verbatim out of `../script.js` at run time (by source markers, so no copy of the
logic lives here) and replayed 200,000 times per list.

- `odds.mjs` — checks the odds the tool states on screen:
  - **Slot machine:** ~`SLOT_WIN_CHANCE` of pulls pay out; the winning line stays
    uniform; a losing payline never shows three of a kind (so a "no match" never
    looks like a win, duplicate lines included); and a list with fewer than two
    distinct labels always pays, because no losing payline could be told apart
    from a winning one.
  - **Dice:** every face comes up 1 in 6 whatever the list length, face `f` picks
    choice `f`, and the no-win rate is exactly `(6 − n) / 6`.

Run: `node odds.mjs` — exits non-zero if any check fails.

- `embed.mjs` — drives the real page in headless Chromium and holds the stage
  card's Share menu (Share as link, Embed as HTML) to what it promises, for
  every mode: the embed code is one iframe of that mode (`#embed=stage-wheel`
  and so on) with a credit line worded as a tool; pasted into a page on
  another origin it shows the stage card alone with the reader's choices,
  their theme, the mode's button and the watermark; markup in a choice is
  drawn as text and runs nothing; the picker plays there without writing to
  the viewer's cache; the host sizes the frame to the card; and the links
  back open the whole tool on that mode and those choices. It also checks
  that only the scene on screen is built (one WebGL scene, not four), that
  Share sits clear of the picker on a desktop and a phone, and that old saved
  state (no mode, a mode that is gone, dice with too many choices) still
  opens. `NOGL=1` repeats it on the 2D versions. three.js is fetched once
  into `_ref/.libcache/`.

Run: `node embed.mjs` (or `NOGL=1 node embed.mjs`) — exits non-zero if any check fails.

Every check is a structural invariant or a stated probability, never a value
captured from a particular run, so the tolerances (±1pp on rates, ±3% on
uniformity) hold for any seed. If a marker in `script.js` moves, the harness
throws instead of silently auditing nothing.
