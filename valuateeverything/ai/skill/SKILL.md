---
name: brotools-valuateeverything
description: "Opens Adjie Brotools' Valuate Everything (https://tool.adjiebrotots.com/valuateeverything/) on the user's own scenario with one link, and the tool computes the answer. Use when the user asks about whether an asking price is fair: a used car, a house, a hotel night or any item, fitted against comparable listings (price against year, mileage, size and other features). Also use when they mention tool.adjiebrotots.com/valuateeverything."
---

# Valuate Everything on tool.adjiebrotots.com

Valuate Everything is a free calculator that runs in the user's browser. This skill turns the user's question into **one link** that opens the tool on their scenario. The tool, not you, works out the result: its figures come from its own model and data, and anything you work out separately can differ from what the user then sees.

## What it decides

- **Valuate Everything** (`valuateeverything`): What a secondhand item, a house or a hotel night should cost, fitted to the listings the user has seen (the price against features such as year, kilometres or size), and how far the asking price of each item the user is weighing up sits from that fair price.

## Workflow

1. **Pick the page.** Read the user's request and choose the page above that answers it. Open its reference (`references/<page>.md`, listed under Files) and read the LINK FORMAT, the most important keys and the Quick Starts. The reference is long: read the parts you need.
2. **Separate what the user said from what you must choose.** Every figure the user gave goes in as they gave it (convert units or periods only to match the field, and say so).
3. **Fill every other input that matters with a researched assumption.**
   - If you can search the web, do it for figures that change over time or by place. For this tool that usually means comparable listings only as the user gives them or as you find them on real listing sites (name each one); never invent listings. Prefer official and primary sources and note each source and its date.
   - If you cannot search, use your own knowledge and say it is an estimate as of your knowledge date.
   - Start from the nearest Quick Start (`qs`) for the user's place and case, and keep its figures unless you have a better one for this user. Send only what differs from it.
   - Prefer what the user said earlier in the conversation over general figures. Never invent a figure the user gave differently.
4. **Build the link with the script** (it checks every key, range and choice, and encodes the link exactly):
   ```bash
   python3 scripts/build_link.py --fields valuateeverything --find <words>     # look up keys
   python3 scripts/build_link.py --quickstarts valuateeverything --find <words> # look up Quick Starts
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
3. **The link**, as a clickable Markdown link to tool.adjiebrotots.com/valuateeverything/..., and again inside a code block so the user can copy it if their chat app breaks a long link.
4. The sentence: **Open the link to see the result.** You may add one line inviting the user to correct any assumption, and then you will send a new link.

**Do not state results.** No verdict, figure, estimate, range, "roughly", "likely", or preview of what the tool will show, not even if the user asks. The only numbers in your reply are the inputs in the link. If the user asks what the answer is, explain that the tool works it out from these inputs and the link opens it, and offer to change any input.

If the request is outside what this tool does, say so, give the tool's address and help the user as you normally would.

## Link format (summary)

```
https://tool.adjiebrotots.com/valuateeverything/#load&v=1&qs=<quick start>&<key>=<value>&why.<key>=<reason>&note=<one line>
```
- `#load` then `key=value` pairs joined by `&`, each value percent-encoded. `v=1` always.
- Values in the units the field shows: `6.1` for 6.1 %, `800000` for 800,000. A choice takes its listed value.
- The tool starts from the Quick Start (or its defaults) and applies each key. Keys not named keep their base value.
- Out of range numbers are pulled into range and unknown keys are skipped, and the tool tells the user. The script stops you before either happens.
- Never use the keys `s`, `open` or `embed`.

## Worked example

**User:** is a 2019 Toyota Corolla with 60,000 km at $24,500 fairly priced? here are 6 listings I found: 2019, 58,000 km, $24,990; 2019, 72,500 km, $22,990; 2018, 81,000 km, $21,500; 2020, 45,000 km, $27,490; 2020, 63,000 km, $25,500; 2018, 95,000 km, $19,990

**Spec** (`valuateeverything`):

```json
{
  "page": "valuateeverything",
  "set": {
    "itemWhat": "Toyota Corolla",
    "columns": "Year:year,Odometer:number:km",
    "listings": "24990:2019:58000;22990:2019:72500;21500:2018:81000;27490:2020:45000;25500:2020:63000;19990:2018:95000",
    "items": "2019 Corolla:24500:2019:60000"
  },
  "why": {
    "listings": "The six listings the user gave, in dollars, with the price first, then the year and the odometer",
    "items": "The car the user is weighing up, at the asking price they gave"
  },
  "qs": "camry",
  "note": "Toyota Corolla, October 2026"
}
```

**Reply:**

**Your inputs**

- Item: Toyota Corolla

**Assumptions**

1. Market data: only the six listings the user gave, each taken as seen this month, so the table has no Data year column and inflation does not apply. The Camry Quick Start's own listings and cars are replaced, not mixed in.
2. Columns: Year (turned into an age) and Odometer in km, the two features the user gave for every listing.
3. Item: the 2019 Corolla with 60,000 km, at the asking price of $24,500.
4. Currency $, and the linear model the Quick Start uses, since the user did not ask for another.

[Open Valuate Everything on this scenario](https://tool.adjiebrotots.com/valuateeverything/#load&v=1&qs=camry&itemWhat=Toyota%20Corolla&columns=Year:year,Odometer:number:km&listings=24990:2019:58000%3B22990:2019:72500%3B21500:2018:81000%3B27490:2020:45000%3B25500:2020:63000%3B19990:2018:95000&why.listings=The%20six%20listings%20the%20user%20gave,%20in%20dollars,%20with%20the%20price%20first,%20then%20the%20year%20and%20the%20odometer&items=2019%20Corolla:24500:2019:60000&why.items=The%20car%20the%20user%20is%20weighing%20up,%20at%20the%20asking%20price%20they%20gave&note=Toyota%20Corolla,%20October%202026)

```
https://tool.adjiebrotots.com/valuateeverything/#load&v=1&qs=camry&itemWhat=Toyota%20Corolla&columns=Year:year,Odometer:number:km&listings=24990:2019:58000%3B22990:2019:72500%3B21500:2018:81000%3B27490:2020:45000%3B25500:2020:63000%3B19990:2018:95000&why.listings=The%20six%20listings%20the%20user%20gave,%20in%20dollars,%20with%20the%20price%20first,%20then%20the%20year%20and%20the%20odometer&items=2019%20Corolla:24500:2019:60000&why.items=The%20car%20the%20user%20is%20weighing%20up,%20at%20the%20asking%20price%20they%20gave&note=Toyota%20Corolla,%20October%202026
```

Open the link to see the result.

## Files

- `references/valuateeverything.md`: Valuate Everything. Every key with its label, unit, range and default, the Quick Starts and what each sets, list and json syntaxes, and an example.
- `references/params.json`: the same keys as data (what the script checks against).
- `scripts/build_link.py`: builds and checks the link. `python3 scripts/build_link.py --help` explains it.

Source: https://tool.adjiebrotots.com/valuateeverything/ai/ (this skill, kept up to date with the tool).
