# Random Picker — odds audit

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

Every check is a structural invariant or a stated probability, never a value
captured from a particular run, so the tolerances (±1pp on rates, ±3% on
uniformity) hold for any seed. If a marker in `script.js` moves, the harness
throws instead of silently auditing nothing.
