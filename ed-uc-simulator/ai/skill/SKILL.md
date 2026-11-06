---
name: brotools-ed-uc-simulator
description: Opens Adjie Brotools' ED/UC Simulator (https://tool.adjiebrotots.com/ed-uc-simulator/) on the user's own scenario with one link, and the tool computes the answer. Use when the user asks about power system economic dispatch and unit commitment over hours: which generators run, storage and HVDC schedules, operating cost and nodal prices (LMP) with line congestion. Also use when they mention tool.adjiebrotots.com/ed-uc-simulator.
---

# ED/UC Simulator on tool.adjiebrotots.com

ED/UC Simulator is a free calculator that runs in the user's browser. This skill turns the user's question into **one link** that opens the tool on their scenario. The tool, not you, works out the result: its figures come from its own model and data, and anything you work out separately can differ from what the user then sees.

## What it decides

- **ED/UC Simulator** (`ed-uc-simulator`): How a power network is run over a stretch of hours at least cost: how much each generator, storage unit and HVDC link produces or moves in every hour, which units are switched on (unit commitment), what the operation costs, and the price of power at every bus (nodal prices), where a full line splits them. It solves on a single-line diagram, in economic dispatch or unit commitment mode.

## Workflow

1. **Pick the page.** Read the user's request and choose the page above that answers it. Open its reference (`references/<page>.md`, listed under Files) and read the LINK FORMAT, the most important keys and the Quick Starts. The reference is long: read the parts you need.
2. **Separate what the user said from what you must choose.** Every figure the user gave goes in as they gave it (convert units or periods only to match the field, and say so).
3. **Fill every other input that matters with a researched assumption.**
   - If you can search the web, do it for figures that change over time or by place. For this tool that usually means generator costs, fuel prices and technical limits (ramp rates, minimum up and down times), line ratings and market rules (the operator, IEA, typical plant data). Prefer official and primary sources and note each source and its date.
   - If you cannot search, use your own knowledge and say it is an estimate as of your knowledge date.
   - Start from the nearest Quick Start (`qs`) for the user's place and case, and keep its figures unless you have a better one for this user. Send only what differs from it.
   - Prefer what the user said earlier in the conversation over general figures. Never invent a figure the user gave differently.
4. **Build the link with the script** (it checks every key, range and choice, and encodes the link exactly):
   ```bash
   python3 scripts/build_link.py --fields ed-uc-simulator --find <words>     # look up keys
   python3 scripts/build_link.py --quickstarts ed-uc-simulator --find <words> # look up Quick Starts
   python3 scripts/build_link.py spec.json                                   # build the link
   ```
   `spec.json` holds `page`, `qs`, `set` (key: value, in the units the field shows on screen, numbers written plainly: `800000`, `6.5`, never `800,000` or `6,5`), `why` (key: your reason, 200 characters at most, shown to the user beside the value; a list key or `json` can have one too), `note` (one line, such as the place and date), `json` (an object, for a page whose reference defines it) and `run` (0 opens the page without solving, as the reference says). If it prints NOT BUILT, fix what it lists and run it again. Use the link it prints exactly as printed.
   The script checks every form field: its key, range, step and choices. List keys, part settings (`el....`) and `json` are checked by the tool when the link opens, so write them exactly in the syntax the reference gives (its COMPACT LISTS and JSON sections), with the names it lists. A Quick Start sets only what its line in the reference lists; when a list key (a set of tickers, portfolios or offers) replaces what the Quick Start holds, send every setting you want with it.
   If you cannot run code, build the link by hand from the LINK FORMAT in the reference, using only keys and values listed there, and check each value against its range.
5. **Reply in the format below, and stop.**

## Reply format

Your whole reply has these four parts, in this order, written in the user's language (keys and the link stay as they are):

1. **Your inputs**: a short list of what the user stated, each with the value that goes in the link.
2. **Assumptions**: a numbered list (or a table: Input | Value | Source or rationale), one entry per input you chose, each with its value and its source with the date for anything you looked up, or "estimate" and your reason for anything from your own knowledge. Put the same reason, shortened, in that key's `why`.
3. **The link**, as a clickable Markdown link to tool.adjiebrotots.com/ed-uc-simulator/..., and again inside a code block so the user can copy it if their chat app breaks a long link.
4. The sentence: **Open the link to see the result.** You may add one line inviting the user to correct any assumption, and then you will send a new link.

**Do not state results.** No verdict, figure, estimate, range, "roughly", "likely", or preview of what the tool will show, not even if the user asks. The only numbers in your reply are the inputs in the link. If the user asks what the answer is, explain that the tool works it out from these inputs and the link opens it, and offer to change any input.

If the request is outside what this tool does, say so, give the tool's address and help the user as you normally would.

## Link format (summary)

```
https://tool.adjiebrotots.com/ed-uc-simulator/#load&v=1&qs=<quick start>&<key>=<value>&why.<key>=<reason>&note=<one line>
```
- `#load` then `key=value` pairs joined by `&`, each value percent-encoded. `v=1` always.
- Values in the units the field shows: `6.1` for 6.1 %, `800000` for 800,000. A choice takes its listed value.
- The tool starts from the Quick Start (or its defaults) and applies each key. Keys not named keep their base value.
- Out of range numbers are pulled into range and unknown keys are skipped, and the tool tells the user. The script stops you before either happens.
- Never use the keys `s`, `open` or `embed`.

## Worked example

**User:** using tool.adjiebrotots.com/ed-uc-simulator, in the PJM 5-bus case, how do prices change if the Brighton generator's cost rises to $40/MWh?

**Spec** (`ed-uc-simulator`):

```json
{
  "page": "ed-uc-simulator",
  "set": {
    "el.Brighton.marginal_cost": "40"
  },
  "why": {
    "el.Brighton.marginal_cost": "The user's new marginal cost for Brighton, in $ per MWh"
  },
  "qs": "pjm5",
  "run": "0",
  "note": "PJM 5-bus case, Brighton's marginal cost raised to $40/MWh"
}
```

**Reply:**

**Your inputs**

- el.Brighton.marginal_cost: 40

**Assumptions**

1. Network: the PJM 5-bus Quick Start (qs=pjm5), unchanged apart from the cost below.
2. Brighton: the generator at bus E. Its marginal cost is set to $40 per MWh (el.Brighton.marginal_cost); its rating and every other part stay as in the Quick Start.
3. Solve: the Quick Start's own: mode edm (edm is economic dispatch) over 1 d (d is days), with line limits and load shedding as the tool defaults them.

[Open ED/UC Simulator on this scenario](https://tool.adjiebrotots.com/ed-uc-simulator/#load&v=1&qs=pjm5&el.Brighton.marginal_cost=40&why.el.Brighton.marginal_cost=The%20user%27s%20new%20marginal%20cost%20for%20Brighton,%20in%20$%20per%20MWh&run=0&note=PJM%205-bus%20case,%20Brighton%27s%20marginal%20cost%20raised%20to%20$40/MWh)

```
https://tool.adjiebrotots.com/ed-uc-simulator/#load&v=1&qs=pjm5&el.Brighton.marginal_cost=40&why.el.Brighton.marginal_cost=The%20user%27s%20new%20marginal%20cost%20for%20Brighton,%20in%20$%20per%20MWh&run=0&note=PJM%205-bus%20case,%20Brighton%27s%20marginal%20cost%20raised%20to%20$40/MWh
```

Open the link to see the result.

## Files

- `references/ed-uc-simulator.md`: ED/UC Simulator. Every key with its label, unit, range and default, the Quick Starts and what each sets, list and json syntaxes, and an example.
- `references/params.json`: the same keys as data (what the script checks against).
- `scripts/build_link.py`: builds and checks the link. `python3 scripts/build_link.py --help` explains it.

Source: https://tool.adjiebrotots.com/ed-uc-simulator/ai/ (this skill, kept up to date with the tool).
