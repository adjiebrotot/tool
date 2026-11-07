---
name: brotools-rentvsownhouse
description: "Opens Adjie Brotools' Rent vs Own (https://tool.adjiebrotots.com/rentvsownhouse/) on the user's own scenario with one link, and the tool computes the answer. Use when the user asks about buying a home versus renting (and investing the difference), whether a house or apartment is worth buying at a price against a rent, mortgage vs rent comparisons, or how sensitive that answer is to rates, growth and costs. Covers 33 cities with local Quick Starts; has an Indonesian version. Also use when they mention tool.adjiebrotots.com/rentvsownhouse."
---

# Rent vs Own on tool.adjiebrotots.com

Rent vs Own is a free calculator that runs in the user's browser. This skill turns the user's question into **one link** that opens the tool on their scenario. The tool, not you, works out the result: its figures come from its own model and data, and anything you work out separately can differ from what the user then sees.

## What it decides

- **Rent vs Own** (`rentvsownhouse`): Whether buying a home with a mortgage or renting it and investing the difference leaves you with more net wealth after a set number of years, and the year owning pulls ahead for good, if it does.
- **Rent vs Own: Sensitivity Tool** (`rentvsownhouse/sensitivity`): How sensitive buying a home with a mortgage, against renting it and investing the difference, is to each assumption: a table of scenarios side by side, the first the base case and the others the same case with one figure changed (the mortgage rate, house price growth, rent inflation, the costs) or a different home, each read as net equity, liquid cash or accumulated cost, for owning and for renting, at one chosen year.

Indonesian versions take the same keys and Quick Starts. Use them when the user writes in Indonesian: `rentvsownhouse/id` (https://tool.adjiebrotots.com/rentvsownhouse/id/), `rentvsownhouse/sensitivity/id` (https://tool.adjiebrotots.com/rentvsownhouse/sensitivity/id/).

## Workflow

1. **Pick the page.** Read the user's request and choose the page above that answers it. Open its reference (`references/<page>.md`, listed under Files) and read the LINK FORMAT, the most important keys and the Quick Starts. The reference is long: read the parts you need.
2. **Separate what the user said from what you must choose.** Every figure the user gave goes in as they gave it (convert units or periods only to match the field, and say so).
3. **Fill every other input that matters with a researched assumption.**
   - If you can search the web, do it for figures that change over time or by place. For this tool that usually means mortgage and loan rates, rents and prices, tax, duty and fee schedules, inflation, salaries and fees for the user's place and date (central banks, tax offices, statistics agencies, lenders). Prefer official and primary sources and note each source and its date.
   - If you cannot search, use your own knowledge and say it is an estimate as of your knowledge date.
   - Start from the nearest Quick Start (`qs`) for the user's place and case, and keep its figures unless you have a better one for this user. Send only what differs from it.
   - Prefer what the user said earlier in the conversation over general figures. Never invent a figure the user gave differently.
4. **Build the link with the script** (it checks every key, range and choice, and encodes the link exactly):
   ```bash
   python3 scripts/build_link.py --fields rentvsownhouse --find <words>     # look up keys
   python3 scripts/build_link.py --quickstarts rentvsownhouse --find <words> # look up Quick Starts
   python3 scripts/build_link.py spec.json                                   # build the link
   ```
   `spec.json` holds `page`, `qs`, `set` (key: value, in the units the field shows on screen, numbers written plainly: `800000`, `6.5`, never `800,000` or `6,5`), `why` (key: your reason, 200 characters at most, shown to the user beside the value; a list key or `json` can have one too), `note` (one line, such as the place and date), `json` (an object, for a page whose reference defines it). If it prints NOT BUILT, fix what it lists and run it again. Use the link it prints exactly as printed.
   The script checks every form field: its key, range, step and choices. List keys and `json` are checked by the tool when the link opens, so write them exactly in the syntax the reference gives (its COMPACT LISTS and JSON sections), with the names it lists. A Quick Start sets only what its line in the reference lists; when a list key (a set of tickers, portfolios or offers) replaces what the Quick Start holds, send every setting you want with it.
   If you cannot run code, build the link by hand from the LINK FORMAT in the reference, using only keys and values listed there, and check each value against its range.
5. **Reply in the format below, and stop.**

## Reply format

Your whole reply has these four parts, in this order, written in the user's language (keys and the link stay as they are):

1. **Your inputs**: a short list of what the user stated, each with the value that goes in the link.
2. **Assumptions**: a numbered list (or a table: Input | Value | Source or rationale), one entry per input you chose, each with its value and its source with the date for anything you looked up, or "estimate" and your reason for anything from your own knowledge. Put the same reason, shortened, in that key's `why`.
3. **The link**, as a clickable Markdown link to tool.adjiebrotots.com/rentvsownhouse/..., and again inside a code block so the user can copy it if their chat app breaks a long link.
4. The sentence: **Open the link to see the result.** You may add one line inviting the user to correct any assumption, and then you will send a new link.

**Do not state results.** No verdict, figure, estimate, range, "roughly", "likely", or preview of what the tool will show, not even if the user asks. The only numbers in your reply are the inputs in the link. If the user asks what the answer is, explain that the tool works it out from these inputs and the link opens it, and offer to change any input.

If the request is outside what this tool does, say so, give the tool's address and help the user as you normally would.

## Link format (summary)

```
https://tool.adjiebrotots.com/rentvsownhouse/#load&v=1&qs=<quick start>&<key>=<value>&why.<key>=<reason>&note=<one line>
```
- `#load` then `key=value` pairs joined by `&`, each value percent-encoded. `v=1` always.
- Values in the units the field shows: `6.1` for 6.1 %, `800000` for 800,000. A choice takes its listed value.
- The tool starts from the Quick Start (or its defaults) and applies each key. Keys not named keep their base value.
- Out of range numbers are pulled into range and unknown keys are skipped, and the tool tells the user. The script stops you before either happens.
- Never use the keys `s`, `open` or `embed`.

## Worked example

**User:** using tool.adjiebrotots.com/rentvsownhouse, please decide which one is better: buy for $850,000 or rent for $620 per week in Melbourne

**Spec** (`rentvsownhouse`):

```json
{
  "page": "rentvsownhouse",
  "set": {
    "propertyPrice": "850000",
    "rentAmount": "620",
    "setupCost": "6",
    "ownOngoingCost": "7000"
  },
  "why": {
    "setupCost": "Victorian stamp duty on $850,000 plus transfer and legal fees",
    "ownOngoingCost": "Rates, insurance and upkeep on an $850,000 house"
  },
  "qs": "melbourne/house-2br",
  "note": "Melbourne, October 2026, 2-bedroom house"
}
```

**Reply:**

**Your inputs**

- Property price: $850,000
- Rent amount: $620 a week

**Assumptions**

1. Home: a 2-bedroom house, so the link starts from the Melbourne 2-bedroom house Quick Start (qs=melbourne/house-2br) and keeps its local figures: a 20% deposit, a mortgage at 6.4% a year over 30 years, house prices growing 4% a year, rent growing 3.5% a year, spare cash earning 4.6% a year, selling costs of 2.5% and a 30-year comparison.
2. Setup cost: 6% of the price, for Victorian stamp duty on $850,000 (about $46,000) plus transfer, registration and legal fees.
3. Ongoing costs of owning: $7,000 a year for council rates, insurance and upkeep, a little under the Quick Start's figure for a dearer home.
4. Ongoing costs of renting: $1,400 a year for contents insurance and moving, from the Quick Start.

[Open Rent vs Own on this scenario](https://tool.adjiebrotots.com/rentvsownhouse/#load&v=1&qs=melbourne/house-2br&propertyPrice=850000&rentAmount=620&setupCost=6&why.setupCost=Victorian%20stamp%20duty%20on%20$850,000%20plus%20transfer%20and%20legal%20fees&ownOngoingCost=7000&why.ownOngoingCost=Rates,%20insurance%20and%20upkeep%20on%20an%20$850,000%20house&note=Melbourne,%20October%202026,%202-bedroom%20house)

```
https://tool.adjiebrotots.com/rentvsownhouse/#load&v=1&qs=melbourne/house-2br&propertyPrice=850000&rentAmount=620&setupCost=6&why.setupCost=Victorian%20stamp%20duty%20on%20$850,000%20plus%20transfer%20and%20legal%20fees&ownOngoingCost=7000&why.ownOngoingCost=Rates,%20insurance%20and%20upkeep%20on%20an%20$850,000%20house&note=Melbourne,%20October%202026,%202-bedroom%20house
```

Open the link to see the result.

## Files

- `references/rentvsownhouse.md`: Rent vs Own. Every key with its label, unit, range and default, the Quick Starts and what each sets, list and json syntaxes, and an example.
- `references/rentvsownhouse-id.md`: Rent vs Own (Indonesian page). Every key with its label, unit, range and default, the Quick Starts and what each sets, list and json syntaxes, and an example.
- `references/rentvsownhouse-sensitivity.md`: Rent vs Own: Sensitivity Tool. Every key with its label, unit, range and default, the Quick Starts and what each sets, list and json syntaxes, and an example.
- `references/rentvsownhouse-sensitivity-id.md`: Sewa vs Beli: Analisis Sensitivitas (Indonesian page). Every key with its label, unit, range and default, the Quick Starts and what each sets, list and json syntaxes, and an example.
- `references/params.json`: the same keys as data (what the script checks against).
- `scripts/build_link.py`: builds and checks the link. `python3 scripts/build_link.py --help` explains it.

Source: https://tool.adjiebrotots.com/rentvsownhouse/ai/ (this skill, kept up to date with the tool).
