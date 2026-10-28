# Plan: make the Engineering and Finance tools drivable by an AI chatbot

Read `CLAUDE.md` first. Everything below must obey "Change an existing tool with the least damage".

## Goal

A reader types into any chatbot with web access (Claude, ChatGPT, Gemini, Perplexity...):

> using tool.adjiebrotots.com/rentvsownhouse, please decide which one is better: buy for $850,000 or
> rent for $620 per week in Melbourne

The chatbot fetches the tool page, reads a plain-text section that tells it which inputs exist,
fills the gaps with stated assumptions, and replies with a link. The link opens the tool on exactly
that scenario, shows a banner listing what the AI assumed, and computes the answer on screen.

Hard constraints:

- **Static only.** No backend, no MCP server, no API key anywhere, no new network calls. The
  chatbot is the reader's own; the site is the calculator.
- **The answer comes from the tool, not the chatbot.** The text we give the AI tells it to list
  its assumptions and hand over the link, never to state figures it did not compute.
- **AI links live forever** in people's chat histories, exactly like Share links. Treat the
  format and every name it uses as frozen from the day it ships.

## Scope

All Engineering and Finance tools on the home page (14 pages, 13 tools). Visualisation and Others
are out of scope. `wemconstraint-checker/` is not on the home page; leave it out.

| Page | Persist namespace (frozen) | Scenario tag | State beyond flat fields (`__extra`) | Quick Starts |
|---|---|---|---|---|
| `rentvsownhouse/` (+ `id/`) | `rentvsownhouse` | `rentvsownhouse` | rate periods, detailed cost rows | `quickstart-data.js`, city picker |
| `rentvsownhouse/sensitivity/` | `rentvsownhouse-sensitivity` | `rentvsownhouse-sensitivity` | the scenario set | none |
| `financingvscash/` | `financingvscash` | `financingvscash` | yes (see script.js ~3585) | `QUICK_START_SCENARIOS` |
| `borrowingcapacity/` | `borrowingcapacity` | `borrowingcapacity` | yes (~1598) | `QUICK_START_SCENARIOS` |
| `financialfreedom/` | `financialfreedom` | `financialfreedom` | yes (~4114); has migrations | `QUICK_START_SCENARIOS` |
| `pisahvsgabung/` (+ `id/`) | `pisahvsgabung` | `pisahvsgabung` | yes (~1670) | `QUICK_START` |
| `dcasimulator/` | `dcasimulator` | custom `save/load` | its own settings format | `QUICK_START_PRESETS` |
| `dcasimulator/portfolio/` | `dcasimulator...` (check) | custom `save/load` | portfolios | `PORTFOLIO_QUICK_START` |
| `costofliving-comparator/` | `costofliving-comparator` | `costofliving-comparator` | city list | `QUICK_START` |
| `costofliving-comparator/map/` | `costofliving...` (check) | `costofliving-comparator-map` | | `QUICK_START` |
| `valuateeverything/` | `valuateeverything` | `valuateeverything` | the listings table | `PRESETS` |
| `loadflow-simulator/` | `loadflow-simulator` | `loadflow-simulator` | the network (`LF.compact`) | `LF.PRESETS` (`wscc9`, `3bus`, `feeder`, `hvdc`) |
| `ed-uc-simulator/` | `educ-simulator` | `educ-simulator` | the network (`ED.load`) | `ED.PRESETS` (default `pjm5`) |
| `capacity-expansion-planner/` | `capacityexpansion-planner` | `capacityexpansion-planner` | the plan (`CX.load`) | `CX.PRESETS` (default `grow`) |
| `powerfactory-scripter/builder/` | `powerfactory-scripter-builder` | own file format (`ui/files.js`) | the workflow graph | `builder/templates/index.json` |
| `powerfactory-scripter/legacy/` | `powerfactory-scripter` | | | `?qs=` |

Verify every "(check)" and line number before relying on it. Namespaces with odd spellings
(`educ-simulator`, `capacityexpansion-planner`) are frozen handles: use them as they are.

## The link format (version 1)

```
https://tool.adjiebrotots.com/<tool>/#load&v=1&qs=<preset>&<fieldId>=<value>&...&why.<fieldId>=<text>
```

- The fragment starts with `load`. Everything after `#` stays in the browser, so length is limited
  only by the browser and by how reliably a chatbot can type it.
- **Plain `key=value` pairs, percent-encoded values.** No base64, no compression, no share
  dictionary: chatbots get those wrong.
- **Keys are the existing Persist handles** (`data-persist`, else `id`, else radio `name`). They
  are already frozen by `CLAUDE.md`, so the AI vocabulary cannot drift from saved state.
- **Reserved keys:**
  - `v`: format version, `1`. Missing means `1`.
  - `qs`: a Quick Start or preset key to start from before the fields apply. Missing means the
    tool's defaults.
  - `why.<key>`: the AI's reason for a value, shown in the banner. Capped at 200 characters.
  - `note`: one line the AI wants shown at the top of the banner (for example "Melbourne, Oct 2026").
  - `json`: percent-encoded JSON for structured state (tables, networks, workflows), shape
    defined per tool in its adapter (Phase 3).
  - `run`: `0` to open without solving, for the heavy optimisers. Missing means run.
  - Never use the keys `s`, `open` or `embed`: they belong to Share links and embeds, and
    `powerfactory-scripter/index.html` redirects on them.
- **Values are what the input shows on screen**, in the units of its label: `mortgageRate=6.1`
  means 6.1 %, not 0.061. The loader tolerates `$`, `,`, `_`, spaces and a trailing `%` in
  numbers, `true/false/1/0/on/off` for checkboxes, and a select value given as its visible label.
- **Base, then overrides:** defaults (or `qs`), then the fields in the link. Anything not named
  keeps the base value. So a link only carries what the AI decided.

Lists and tables that do not fit `key=value` get a compact per-tool syntax, defined in that tool's
adapter and documented in its AI section, for example
`ratePeriods=5:6.1,25:6.5` (years:rate, ...). Use `json=` only when no compact syntax is
reasonable.

### Long state stays in the link

The link is the only way in: there is no paste box. Browsers open fragments of hundreds of KB, so a
custom load flow network or a whole PowerFactory workflow (6 to 8 KB as JSON) goes in `json=` like
anything else. To keep long links reliable for the chatbot that types them:

- the AI section tells the AI to start from the nearest `qs` and send only what differs, and to
  write `json` compactly (no spaces or line breaks, defaults left out);
- it also tells the AI to give a long link both as a clickable link and inside a code block, since
  some chat apps don't linkify or shorten very long URLs; the reader can then copy it into the
  address bar. This costs the tool nothing.

## Phase 0: shared loader (`shared.js`, one place for every tool)

Add a `SharedAgent` module beside `SharedScenario` and `Persist`.

1. **Read the hash once at start-up**, next to `readEmbedHash` and `readOpenHash`. Ignore it in
   an embed frame, in guide demo mode (`?demo`), and when an `#open=` link is present.
2. **Don't let the cache win.** In `Persist.init`, when a `#load` link is pending: copy the
   existing cache blob to `abt:prev:<ns>:v<ver>` (for Undo, below), then skip restoring the cache
   so the link applies over the tool's defaults, not over the reader's last scenario. Saving stays
   on, so the AI scenario becomes the reader's current work, as `#open` does.
3. **Apply after load**, the way `startOpen` does in `SharedShare`:
   1. remove `#load...` from the address with `history.replaceState`, so a reload keeps edits;
   2. if `qs` names a known preset, apply it through the tool's own Quick Start path (click
      `.quick-start-btn[data-preset="<qs>"]`, or the adapter's `preset(key)`); unknown `qs` is
      skipped and reported;
   3. take `persist.snapshot()` (or the custom `save()`), overlay each field into `__fields`
      with its type read from the DOM: `c:` checkbox, `r:` radio group, `v:` everything else;
   4. hand structured keys (`json`, compact list keys) to the tool's adapter, which patches
      `__extra`;
   5. load the result through the registered `SharedShare.state` provider (the same `doLoad` a
      scenario file uses), so every migration in `onRestore` runs exactly as for a file;
   6. press `.needs-run` if the tool has one and `run` is not `0`;
   7. show the banner.
4. **Validate, never throw** (`CLAUDE.md`: missing or unknown never errors):
   - unknown key: skipped, listed in the banner as "not recognised";
   - number outside the input's `min`/`max`: clamped, and the banner says so;
   - select value not among the options: match it to an option label case-insensitively, else
     skip; never invent an option;
   - currency inputs with thousands separators (`attachCurrencyInput`): write the value the way
     the input formats it, then fire the same events a person's typing would. Check one such
     field per tool in a test.
5. **Treat the link as untrusted.** Anyone can write one.
   - only set persistable form controls and adapter-approved structures;
   - never `eval`, never `innerHTML` with link text (banner uses `textContent`);
   - cap the whole fragment (512 KB) and each plain value (2 KB);
   - no download, upload, clipboard or navigation is triggered by a link;
   - the network calls a tool already makes (DCA prices via the Worker) are fine, with
     tickers validated by the same rule the tool uses.
6. **Register hook for tools:** `SharedAgent.register({ tool, preset(key), compact: {listKey: parser}, json(obj, extra), describe })`.
   Tools with flat fields only need nothing beyond what `SharedScenario.mount` already gives.

### The banner

A dismissible strip at the top of the inputs, bilingual (`en`/`id`) like `SharedScenario`'s
`TEXT`:

- "Set up by an AI assistant. Check these assumptions:" then one row per field it set, with the
  label the reader sees, the value, and `why` if given. Each row scrolls to and outlines its field.
- "Not recognised: ..." and "Adjusted to fit the allowed range: ..." when relevant.
- **Undo**: "Back to my previous inputs" loads `abt:prev:<ns>` through `persist.load`, shown only
  when a previous cache existed.
- Follow `_ref/design-reference.md`; no em-dashes in copy. Run the repo's UI checks
  (`button-check`, `form-check`, `tip-check`, `abbr-check`) on a page that shows it.

## Phase 1: the text the AI reads

Fetchers used by chatbots usually drop `<script>` and do not run JavaScript, and some read only the
first part of a long page. So:

1. **`<tool>/agent.txt`** per page: the full reference, plain text.
2. **An "Use this tool with an AI assistant" section in each tool's HTML**, as a collapsed
   `<details>` high in the main content (before long explainer copy), between markers
   `<!-- agent:start -->` and `<!-- agent:end -->`. Short enough to sit in the first few KB of
   text. It links to `agent.txt`.
3. **`llms.txt`**: a site-wide section describing the `#load` protocol once, and linking each
   tool's `agent.txt`.

Both texts are **generated, never hand-edited**, by a new `_ref/agent-doc.mjs` (Playwright, like
the other `_ref` checks): it opens each tool, reads every persistable control (handle, visible
label, unit/prefix/suffix, `min`/`max`/`step`, default, select values with labels, radio values)
and the Quick Start keys with their titles, and merges a hand-written
`<tool>/agent-notes.md` (meaning of fields, typical ranges, which inputs matter most, compact list
syntaxes, what the tool decides).

Content of each section, in this order:

1. One line: what the tool decides.
2. **Instructions to the AI** (same wording on every tool):
   - Build a link in the format below; only use the keys listed here.
   - Fill anything the user didn't give with a sensible assumption for their place and date, and
     list every assumption to the user in a numbered list, with the reason, and put the same in
     `why.<key>`.
   - Prefer what the user said earlier in the conversation over general figures.
   - Do not state results or a verdict; the tool calculates them when the link opens. Say "open
     the link to see the result".
   - Start from the nearest Quick Start and send only what differs. Write `json` compactly. Give
     a long link both as a link and in a code block, so the user can copy it if their chat app
     breaks it.
3. The URL pattern and one complete example link.
4. The Quick Starts (`qs` values) with one line each.
5. The fields: `key`, label, unit, range, default, allowed values. Group them as the page does.
6. Compact list syntaxes and the `json` shape, if the tool has them.

## Phase 2: kept links and checks

- **`_ref/agent-links.json`**: per page, a few example AI links (the ones in the docs plus a
  realistic one per Quick Start). **Frozen like `_ref/share-links.json`: add, never change.**
- **`_ref/agent-check.mjs`**, run alongside `share-check` and `scenario-check`:
  - A1: every key the docs list is a live persistable control, select value or Quick Start;
  - A2: every kept link opens with no console error, no "not recognised" entries, and the
    fields it names hold the expected values afterwards (for a kept link whose field was renamed,
    the tool must map the old name, just as for Share links: fix the tool, never the link);
  - A3: unknown keys, out-of-range numbers, a bad `qs`, malformed `json` and a 512 KB fragment
    all open the tool normally and report in the banner;
  - A4: the reader's cache is preserved in `abt:prev:` and Undo restores it exactly;
  - A5: the docs in the HTML match what `agent-doc.mjs` would generate (no drift);
  - A6: a kept link carrying a whole custom model in `json` (one per Engineering tool) opens and
    solves.
- Add to `CLAUDE.md`'s "Before shipping a change to a tool's inputs": also run
  `node _ref/agent-check.mjs`, and regenerate the AI docs with `node _ref/agent-doc.mjs`.
- After adding the banner, run `node _ref/guide-check.mjs <tool>` for each
  tool with a live guide and fix scenes whose steps moved.

## Phase 3: per-tool adapters

Do the tools in this order; each is a separate commit with its docs, notes, kept links and a
passing `agent-check`.

### Finance (mostly flat fields)

1. **Rent vs Own** (`rentvsownhouse/`, then `id/`): flat fields plus `qs` (the city Quick Starts in
   `quickstart-data.js`). Compact lists: `ratePeriods` (years:rate), `ownSetupCosts` and
   `ownOngoingCosts` (label:amount[:freq]) for the detailed cost modes; setting one switches its
   section to detailed mode. This is the pilot: finish Phases 0 to 2 against it first.
2. **Borrowing Capacity**: flat; applicants and debts as compact lists if they are rows.
3. **Finance vs Cash**: flat plus its `__extra`.
4. **Financial Freedom**: flat; its link must pass through `migrateRetireMultiplier` and
   `migrateCurrencyCode` (it will, via `onRestore`). Document the currency field's code values.
5. **Pisah vs Gabung** (+ `id/`): flat plus income rows; docs in Indonesian on the `id/` page as
   well as English. Tax brackets are fixed by law: do not expose them unless the tool already
   lets readers edit them.
6. **Cost of Living Comparator** and **Map**: `cities=Melbourne,Jakarta` matched to the tool's
   city list by name (case- and accent-insensitive); unmatched cities reported.
7. **Valuate Everything**: flat settings plus `listings` (one row per listing, `;`-separated,
   fields in a documented order), or the whole table in `json`.
8. **DCA Scenario Explorer** and **Portfolio**: custom `save/load`, so the adapter builds the
   custom blob itself. `tickers=SPY,QQQ`, dates as `YYYY-MM-DD`, portfolios as
   `p1=SPY:60,BND:40&p2=...`. Prices load through the existing Worker as they do today.
9. **Rent vs Own Sensitivity**: the scenario set, via a compact `vary.<key>=low,mid,high` or `json`.

### Engineering (structured models)

Pattern: start from a preset (`qs`), then patch named parts, so typical requests fit in a link;
a whole custom model goes in `json`, in the tool's own saved format
(`LF.compact` output, the `ED`/`CX` saved model, the builder workflow), which `LF.load`,
`ED.load`, `CX.load` and `W.loadWorkflow` already validate.

10. **Load Flow Simulator**: `qs=wscc9`, solver options as flat fields, element patches
    `el.<name>.<param>=<value>` (for example `el.Load5.p=150`), matched by the element's visible
    name. Document each element type's patchable params and units from `lf-core.js`.
11. **ED/UC Simulator**: `qs=pjm5`, `el.<name>.<param>` for generators, loads, lines and storage;
    horizon and options flat. Solving runs live; pre-solved Quick Starts only match an unpatched
    preset, which is fine (`presolve` is not affected: no solver change).
12. **Capacity Expansion Planner**: `qs=grow`, technology overrides `tech.<id>.<param>` using the
    ids in `cx-core.js` (`solar`, `wind`, `ccgt`, `ocgt`, `coal`, `nuclear`, `geo`, `diesel`,
    `battery`, `phes`) and params (`capex`, `fom`, `vom`, `life`, `cf`, `co2`, ...); demand,
    carbon price and horizon flat. Allow `run=0`, because the solve is heavy.
13. **PowerFactory Scripter**:
    - **Builder** (`powerfactory-scripter/builder/`), the main target: `template=<id>` from
      `builder/templates/index.json` (`headroom`, `ldf-cases`, `n-1`, `frt`, `cct`, ...), block
      parameter patches `blk.<blockId>.<param>=<value>`, a whole workflow in `json` in the
      `ui/files.js` format. It has no `SharedScenario` provider: register an adapter that calls
      `W.loadWorkflow` and `store.reset`.
    - **`powerfactory-scripter/index.html`** redirects `#open`, `#s` and `#embed` links to
      `legacy/`. Route `#load` to `builder/` when it has `template` or `blk.*` keys, else to
      `legacy/`, keeping the hash.
    - **Legacy** form: flat fields plus its existing `?qs=`.

## Phase 4 (optional, later): watch the AI fill the form

`play=1` replays the applied changes visibly with the live-guide helpers (`S.fill`, `S.choose`,
`S.click` from `guide-live.js`): pointer moving, fields filling, at a person's pace, with Skip.
Only after Phases 0 to 3 are stable.

## Phase 5: test with real chatbots

For each tool, write three prompts in `_ref/agent-prompts.md` (one terse, one detailed, one that
relies on earlier chat context), run them in at least two chatbots with web access, and record:
did it fetch the page, did it use only listed keys, did the link open cleanly, did it list its
assumptions, did it avoid stating results. Tighten `agent-notes.md` wording where they fail;
never loosen the loader to accept guesses silently.

## Definition of done (per tool)

- An AI link opens the intended scenario, solved, with the banner, including one carrying a whole
  custom model in `json` for the Engineering tools.
- The reader's previous work is recoverable with Undo.
- `node _ref/share-check.mjs`, `node _ref/scenario-check.mjs`, `node _ref/agent-check.mjs` pass;
  `node _ref/guide-check.mjs <tool>` passes where the tool has a guide.
- The AI section is generated, present in the HTML and in `agent.txt`, and listed in `llms.txt`.
- Kept links for the tool are in `_ref/agent-links.json`.
