---
name: tax-rule-update
description: Change one tax or social security rule in the Global Income Tax Calculator (global-income-tax-calculator/) when a country's law changes or a source shows a different figure. A rate, cap, band, threshold, allowance, effective date or a new component. Pinpoints every place the rule lives (engine, country pages, audit, AI docs) and changes exactly those, keeping saved state, Share and AI links and the audit intact. Use when the user says a figure is wrong, a reform changed a rule, gives an official source for a country's figure, or asks to update a country to a new tax year.
---

# Updating a tax rule in the Global Income Tax Calculator

A rule lives in up to six places, and a change is finished only when every one of them says
the same thing:

| Place | File | What it holds |
| --- | --- | --- |
| The engine | `global-income-tax-calculator/engine.js`, the country's section (`/* ═══ XX ... ═══ */`) | Constants (`BE_BR`, `TW_BR`), the country function and its lines `L('id', 'label', amount, kind, src, status, from)` |
| The source badge | `engine.js`, `SRC` near the top | `{ name, url }` per key; each line names its key |
| The page form | `global-income-tax-calculator/index.html`, rows with `data-show="XX"` | The knobs a reader sets, and their tooltips |
| The country pages | `_jurisdictions/content/<slug>.en.json` and `.id.json` | Law blocks and tables, worked-example prose, tips, FAQs, `cite` lists, Indonesian `lineLabels` |
| The audit | `_audit/run.mjs`, `_audit/page.mjs`, `_audit/README.md` | Golden cases, anchors, caps, the `CHANGED` replays and why they changed |
| The AI docs | `agent-notes.md`, regenerated into `ai/` | Every knob an AI link can name |

## 1. Pinpoint

```
node global-income-tax-calculator/_jurisdictions/rules.mjs                 # the register: every country, every line, its status and source
node global-income-tax-calculator/_jurisdictions/rules.mjs <CC|slug>       # one country: section lines, constants, lines, knobs, SRC, pages, audit
node global-income-tax-calculator/_jurisdictions/rules.mjs <CC> <old figure> [more figures]
```

Pass the figure as the rule states it: `219500`, `219,500`, `12.5%` or `0.125`. The search
tries every form a file uses (`219500` in code, `219,500` in English, `219.500` in Indonesian,
`0.125`, `.125`, `12.5%`, `12,5%`) and prints file:line, or the JSON path in a content file.
That list is the work list. A hit outside it (another country, another year) is not yours.

## 2. Confirm the new rule

The official page that states it is the source of truth: tax authority, social security
agency, ministry, official gazette or legal portal. When the owner gives a source, use it.
Otherwise find one. Fetch it and read the figure yourself (`curl -sSL -A "Mozilla/5.0"`); a
site that blocks automated access is never worked around, so ask the owner or use another
official copy. Note what applies from when (a mid-year step needs both values, see 3c), who it
covers (nationals only, new entrants only), and whether a cap is monthly or yearly.

## 3. Change the engine at the exact place

Decide which kind of change it is:

- **a. The same rule, a new value** (a rate, cap, band edge, allowance). Edit the number where
  the pinpoint shows it, and nothing else. Keep the line `id`; it is a handle.
- **b. A new or split component** (unemployment insurance added, one levy becoming two). Add a
  line with a new `id`, or keep one line and say the parts in its label; keep the old line's
  `id` for the part that carries on.
- **c. A step inside the year** (a rate from 1 July). Work out each period and sum them, as
  Indonesia's JP cap and Saudi Arabia's GOSI rate do, and set the line's `from` to the date.
- **d. A rule that depends on who the reader is** (foreign employees only, couples over 66).
  That is a new knob: follow "Every input a reader can set" below.

On the line itself:

- **`status`**: `official` when the figure is read on an official page, `secondary` when it
  rests on a Big Four or vendor source, `assumption` for a modelling choice.
- **`src`**: point the line at the `SRC` key for the new page, or update that key's `url` and
  `name` (the badge shows them).
- **The label is what readers see.** A changed label is also a key in each Indonesian content
  file's `lineLabels`: add the new English label there with its Indonesian text, or the page
  generator reports `no Indonesian for line`. The same `lineLabels` word the Indonesian
  calculator (`id/`), through `labels-id.js`: so does a new note, reason, tax year or place
  text the engine writes. Re-run `node global-income-tax-calculator/_jurisdictions/labels.mjs`
  after editing a content file; `_audit/labels-id.mjs` fails on any engine text without
  Indonesian.
- Write a one-line comment above the change: what the rule is, from when, and the source.

## 4. Keep every saved state, Share link and AI link working

Read the root `CLAUDE.md` section "Change an existing tool with the least damage". In short:

- Never rename a knob `id`, a select option `value` or a line `id`.
- **A new knob defaults to the old behaviour**, so state saved without it computes as before
  (Taiwan's `twEi` defaults to `yes`, the old 12.5%). Fields persist generically: a new
  `<select>` or checkbox in `#jobScope` is saved by the mini cache, scenario files and Share
  links with no extra code. Add a situation select to `SIT_FIELDS` in `script.js`, describe
  the knob in `agent-notes.md`, and append one kept link that uses it to
  `_ref/agent-links.json`.
- **`_ref/agent-links.json` and `_ref/share-links.json` are frozen.** Append the new entry as
  text before the closing `]`. Never load and re-dump them, because that reformats every line.
- A changed meaning (a percentage becoming an amount) is a new key, converted in the load.

## 5. Audit

```
node global-income-tax-calculator/_audit/run.mjs
```

A golden case that now fails is expected when the rule really changed. Do not edit
`golden-v11.json`. Add the case to `CHANGED` in `run.mjs`, with a replay written
independently of the engine (the formula from the official page, as the Australian, Belgian
and Taiwanese entries do). Then add a bullet to `_audit/README.md` ("What this tool adds to
spec v11") saying what changed, from when, and the source. If the case is also typed into the
page (`_audit/page.mjs` lists them), add it to that file's `CHANGED` too. A new knob gets a
check of its own (`capChk` or `A(...)` in `run.mjs`). Finish at 0 failed:

```
node global-income-tax-calculator/_audit/run.mjs
node global-income-tax-calculator/_audit/page.mjs
```

## 6. Country pages

1. Edit the law block's text and table in both `<slug>.en.json` and `<slug>.id.json`.
   Indonesian writes 1.234 and 2,5%.
2. Cite it: add `{ "name", "url" }` to the item's `cite` list, on the law block and on every
   example, tip and FAQ that states the figure, and to `law.sources`. The page numbers it and
   lists it under References. Add `#:~:text=` with words copied exactly from the page when you
   read it.
3. Worked examples are drawn by the engine, but their prose quotes numbers. Run
   `node global-income-tax-calculator/_jurisdictions/numcheck.mjs <slug>` before and after the
   change. Every new "not an engine figure" line is stale prose. Read the new figures with
   `node global-income-tax-calculator/_jurisdictions/dump.mjs <slug>` and update both
   languages.
4. A worked example's inputs live in `_jurisdictions/scenarios.mjs`. Keep its `key`; changing
   its inputs (setting a new knob for a foreign-employee example) is fine.
5. `node _ref/jurisdiction-pages.mjs`, then `--check`, which must say 0 out of date with no
   problem lines.

## 7. Regenerate and check

```
node global-income-tax-calculator/_jurisdictions/labels.mjs   # labels-id.js, after a lineLabels change
node global-income-tax-calculator/_audit/labels-id.mjs  # every engine text has its Indonesian
node _ref/bake-id.mjs                                    # the Indonesian calculator page
node _ref/agent-doc.mjs                                  # AI docs, after any knob or label change
node _ref/agent-check.mjs global-income                  # A2 fails if a kept AI link lost its field
node _ref/scenario-check.mjs
node _ref/share-check.mjs                                # slow; needed when an input was added
node _ref/guide-check.mjs global-income-tax-calculator   # the live guide still plays
node _ref/tip-check.mjs                                  # when a tooltip changed
```

Then commit with a message that says the rule, the new value, from when, and the source.

## Lessons from past changes

- Most wrong figures came from a reform the source page had not caught up with. Belgium's
  2025 expat change raised the tax exemption to 35%, but social security kept 30% and the
  €90,000 cap, so one rule became two. Check whether every part of a regime moved, not only
  the headline.
- A figure can be right for some readers and wrong for others: Taiwan's employment
  insurance covers nationals but not most foreign employees. That needs a knob, not a new
  constant.
- Two official pages can disagree (Belgium's rates page against the reform act). The newer
  legal text wins; cite both and say which applies.
- The UAE label "employer 12.5% and government 2.5%" was right only under AED 20,000 a
  month. A label that names a split should follow the rule's own condition.
