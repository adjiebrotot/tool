---
name: brotools-capacity-expansion-planner
description: Opens Adjie Brotools' Capacity Expansion Planner (https://tool.adjiebrotots.com/capacity-expansion-planner/) on the user's own scenario with one link, and the tool computes the answer. Use when the user asks about electricity generation capacity expansion planning: which plants, renewables and batteries to build and when to meet growing demand at least cost, with carbon prices, emissions and costs by year. Also use when they mention tool.adjiebrotots.com/capacity-expansion-planner.
---

# Capacity Expansion Planner on tool.adjiebrotots.com

Capacity Expansion Planner is a free calculator that runs in the user's browser. This skill turns the user's question into **one link** that opens the tool on their scenario. The tool, not you, works out the result: its figures come from its own model and data, and anything you work out separately can differ from what the user then sees.

## What it decides

- **Capacity Expansion Planner** (`capacity-expansion-planner`): Which plants and batteries to build, how big and in which year, so that a growing demand is met hour by hour at the least cost over the whole plan. It plans from a first year to a last year in decision years, with a few typical days a season, and reports what to build, the energy by source, the cost by year and the emissions.

## Workflow

1. **Pick the page.** Read the user's request and choose the page above that answers it. Open its reference (`references/<page>.md`, listed under Files) and read the LINK FORMAT, the most important keys and the Quick Starts. The reference is long: read the parts you need.
2. **Separate what the user said from what you must choose.** Every figure the user gave goes in as they gave it (convert units or periods only to match the field, and say so).
3. **Fill every other input that matters with a researched assumption.**
   - If you can search the web, do it for figures that change over time or by place: interest and mortgage rates, rents and prices, tax, duty and fee schedules, inflation, salaries, tariffs, technology costs, standards. Prefer official and primary sources (central banks, tax offices, statistics agencies, standards bodies, operators) and note the source and its date.
   - If you cannot search, use your own knowledge and say it is an estimate as of your knowledge date.
   - Start from the nearest Quick Start (`qs`) for the user's place and case, and keep its figures unless you have a better one for this user. Send only what differs from it.
   - Prefer what the user said earlier in the conversation over general figures. Never invent a figure the user gave differently.
4. **Build the link with the script** (it checks every key, range and choice, and encodes the link exactly):
   ```bash
   python3 scripts/build_link.py --fields capacity-expansion-planner --find <words>     # look up keys
   python3 scripts/build_link.py --quickstarts capacity-expansion-planner --find <words> # look up Quick Starts
   python3 scripts/build_link.py spec.json                                   # build the link
   ```
   `spec.json` holds `page`, `qs`, `set` (key: value, in the units the field shows on screen), `why` (key: your reason, 200 characters at most, shown to the user beside the value) and `note` (one line, such as the place and date). If it prints NOT BUILT, fix what it lists and run it again. Use the link it prints exactly as printed.
   If you cannot run code, build the link by hand from the LINK FORMAT in the reference, using only keys and values listed there, and check each value against its range.
5. **Reply in the format below, and stop.**

## Reply format

Your whole reply has these four parts, in this order:

1. **Your inputs**: a short list of what the user stated, each with the value that goes in the link.
2. **Assumptions**: a table with one row per input you chose: | Input | Value | Source or rationale |. Name the source (with its date) for anything you looked up; say "estimate" for anything from your own knowledge. Put the same reason, shortened, in that key's `why`.
3. **The link**, as a clickable Markdown link to tool.adjiebrotots.com/capacity-expansion-planner/..., and again inside a code block so the user can copy it if their chat app breaks a long link.
4. The sentence: **Open the link to see the result.** You may add one line inviting the user to correct any assumption, and then you will send a new link.

**Do not state results.** No verdict, figure, estimate, range, "roughly", "likely", or preview of what the tool will show, not even if the user asks. The only numbers in your reply are the inputs in the link. If the user asks what the answer is, explain that the tool works it out from these inputs and the link opens it, and offer to change any input.

If the request is outside what this tool does, say so, give the tool's address and help the user as you normally would.

## Link format (summary)

```
https://tool.adjiebrotots.com/capacity-expansion-planner/#load&v=1&qs=<quick start>&<key>=<value>&why.<key>=<reason>&note=<one line>
```
- `#load` then `key=value` pairs joined by `&`, each value percent-encoded. `v=1` always.
- Values in the units the field shows: `6.1` for 6.1 %, `800000` for 800,000. A choice takes its listed value.
- The tool starts from the Quick Start (or its defaults) and applies each key. Keys not named keep their base value.
- Out of range numbers are pulled into range and unknown keys are skipped, and the tool tells the user. The script stops you before either happens.
- Never use the keys `s`, `open` or `embed`.

## Worked example

**User:** using tool.adjiebrotots.com/capacity-expansion-planner, with a $50/t carbon price and solar capex at $900/kW, what should the grid build to 2040?

**Spec** (`capacity-expansion-planner`):

```json
{
  "page": "capacity-expansion-planner",
  "set": {
    "cxCarbon": "50",
    "tech.solar.capex": "900",
    "cxEnd": "2040"
  },
  "why": {
    "cxCarbon": "The user's carbon price, in $ per tonne of CO2, from the first year",
    "tech.solar.capex": "The user's solar capital cost, in $ per kW",
    "cxEnd": "The user wants the plan to run to 2040"
  },
  "qs": "grow",
  "run": "0",
  "note": "Growing grid, $50/t carbon price, solar at $900/kW, planned to 2040"
}
```

**Assumptions given:**

1. Grid: the Growing grid Quick Start (qs=grow), with its coal, gas, solar, wind and battery options as it has them.
2. Carbon price: $50 per tonne in 2,026, flat (the Quick Start's growth of 0% a year is kept).
3. Solar: the Solar PV technology's capital cost is set to $900 per kW (tech.solar.capex); its other figures stay as in the Quick Start.
4. Horizon: the first year is 2,026, the last 2040, with a decision every 5 years.

**Link:**

```
https://tool.adjiebrotots.com/capacity-expansion-planner/#load&v=1&qs=grow&cxCarbon=50&why.cxCarbon=The%20user%27s%20carbon%20price,%20in%20$%20per%20tonne%20of%20CO2,%20from%20the%20first%20year&tech.solar.capex=900&why.tech.solar.capex=The%20user%27s%20solar%20capital%20cost,%20in%20$%20per%20kW&cxEnd=2040&why.cxEnd=The%20user%20wants%20the%20plan%20to%20run%20to%202040&run=0&note=Growing%20grid,%20$50/t%20carbon%20price,%20solar%20at%20$900/kW,%20planned%20to%202040
```

Open the link to see the result.

## Files

- `references/capacity-expansion-planner.md`: Capacity Expansion Planner. Every key with its label, unit, range and default, the Quick Starts and what each sets, list and json syntaxes, and an example.
- `references/params.json`: the same keys as data (what the script checks against).
- `scripts/build_link.py`: builds and checks the link. `python3 scripts/build_link.py --help` explains it.

Source: https://tool.adjiebrotots.com/capacity-expansion-planner/ai/ (this skill, kept up to date with the tool).
