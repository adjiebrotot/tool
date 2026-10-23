# Adjie Brotools

Static, client-side tools at tool.adjiebrotots.com, one folder per tool, named as one simple
word or as hyphen-separated words (`capacity-expansion-planner`, never `capacityexpansion-planner`). Building a tool:
`.claude/skills/new-tool/SKILL.md`. Design system: `_ref/design-reference.md`.

## Change an existing tool with the least damage

A reader's work outlives the version of the tool it was made on. It lives in four places:
the mini cache (`Persist`, in their browser), scenario files they saved and Share as link
URLs, all three carrying the same saved state, and embeds on other sites, which carry the
chart drawn from it (below). Every one of them has to keep opening, and keep meaning what
it meant, after any change. Upgrades here are nearly
always additive (a new input, a new option) or a merge of inputs that were redundant, so
write each change as that.

- **Rename the label, not the handle.** A field's `id`, `name` and `data-persist`, the
  `Persist` namespace, the keys in `extra` and in a custom save format, select option
  `value`s, preset names and chart ids are what saved state is keyed on. Change the words a
  reader sees and leave those alone, even when they no longer match the label. If an `id`
  truly has to change, give the field `data-persist="<old id>"` so saved values still find
  it (Persist reads `data-persist` before `id`).
- **An added input defaults to the old behaviour.** State saved before it existed has no
  value for it, so its default must reproduce what the tool computed before (a new cost
  defaults to 0, a new option to the way it worked until now). A new option in a select is
  added beside the old values, never in place of one.
- **Merged inputs keep reading both.** If two inputs become one (a risk-free rate and a
  Fed rate become one risk-free rate), state that carries the old key still loads: use it
  for the new input when the new key is missing, and ignore whatever no longer applies. If
  one input becomes two, fill both from the old value. Migrate in the tool's load, the way
  `financialfreedom/script.js` does (`migrateRetireMultiplier` and `migrateCurrencyCode`, called
  from `Persist.init`'s `onRestore`), so the cache, a file and a link all take the same path.
- **Missing or unknown never errors.** A key that is absent takes its default, a key the
  tool no longer knows is skipped, and a select value that is gone maps to its nearest
  option. Old state never throws or leaves a blank field.
- **A changed meaning gets a new key.** If a value changes units or meaning (a percentage
  becomes an amount), save it under a new key and convert the old one in the load. Reusing
  the key would make every old link quietly compute something else.
- **An embed keeps the names it was drawn with.** An embed is the chart written down as data
  and drawn by the embed viewer (`embed/`) without the tool, so a change to a tool's inputs
  or model never reaches it. What it is keyed on is the snapshot's format (`v: 1`, read by
  `embed/embed.js`), every `ChartKit` name and Chart.js plugin id it carries (`chart-kit.js`,
  `<tool>/chart-kit.js`) and the `data-embed-mode` views' order in a card. Rename the words,
  never those names; a piece that changes what it takes registers a new name beside the old;
  a new snapshot shape is a new `v`, with the viewer still reading `v: 1`.
- **Never edit or delete what old links need.** `share-dict-*.txt` and the entries in
  `_ref/share-links.json` are frozen: add, never change. A better Share dictionary is the
  next letter (`_ref/share-dict.mjs`).

Before shipping a change to a tool's inputs, run `node _ref/share-check.mjs` (its kept-links
checks, F1 and F2, fail when a field an old link names is gone) and `node _ref/scenario-check.mjs`.
When a field does fail F2, fix the tool so the old name still loads. Don't edit the kept link.

After changing an optimiser tool's solver (`capacity-expansion-planner/cx-core.js`, `ed-uc-simulator/ed-core.js`,
their workers or `ed-uc-simulator/engine/`), run `node _ref/presolve.mjs` so its pre-solved Quick Starts
match again (`--check` says whether they do; until then the tool just solves as before).
