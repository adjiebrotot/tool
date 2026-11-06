---
name: brotools-costofliving-comparator
description: Opens Adjie Brotools' Cost of Living Comparator (https://tool.adjiebrotots.com/costofliving-comparator/) on the user's own scenario with one link, and the tool computes the answer. Use when the user asks about moving between cities: how far a salary goes elsewhere, the salary needed in another city to live and save the same, comparing cost of living across many cities or on a world map. Also use when they mention tool.adjiebrotots.com/costofliving-comparator.
---

# Cost of Living Comparator on tool.adjiebrotots.com

Cost of Living Comparator is a free calculator that runs in the user's browser. This skill turns the user's question into **one link** that opens the tool on their scenario. The tool, not you, works out the result: its figures come from its own model and data, and anything you work out separately can differ from what the user then sees.

## What it decides

- **Cost of Living Comparator** (`costofliving-comparator`): How far a salary goes when the user moves between cities: from the user's home city, its monthly take-home pay and costs, either what they would save in each destination city, or the net salary each destination needs to leave them saving the same share of pay (or the same amount).
- **Cost of Living Comparator: Map View** (`costofliving-comparator/map`): From one home city, its monthly take-home pay and costs, how every other city compares: the net salary each city needs for the same lifestyle and savings, what the user's own salary saves in each city, or what the same multiple of local pay saves there.

## Workflow

1. **Pick the page.** Read the user's request and choose the page above that answers it. Open its reference (`references/<page>.md`, listed under Files) and read the LINK FORMAT, the most important keys and the Quick Starts. The reference is long: read the parts you need.
2. **Separate what the user said from what you must choose.** Every figure the user gave goes in as they gave it (convert units or periods only to match the field, and say so).
3. **Fill every other input that matters with a researched assumption.**
   - If you can search the web, do it for figures that change over time or by place. For this tool that usually means take-home pay after tax, rents, groceries and other costs in each city (statistics agencies, payroll calculators, cost of living surveys), and exchange rates. Prefer official and primary sources and note each source and its date.
   - If you cannot search, use your own knowledge and say it is an estimate as of your knowledge date.
   - Start from the nearest Quick Start (`qs`) for the user's place and case, and keep its figures unless you have a better one for this user. Send only what differs from it.
   - Prefer what the user said earlier in the conversation over general figures. Never invent a figure the user gave differently.
4. **Build the link with the script** (it checks every key, range and choice, and encodes the link exactly):
   ```bash
   python3 scripts/build_link.py --fields costofliving-comparator --find <words>     # look up keys
   python3 scripts/build_link.py --quickstarts costofliving-comparator --find <words> # look up Quick Starts
   python3 scripts/build_link.py spec.json                                   # build the link
   ```
   `spec.json` holds `page`, `qs`, `set` (key: value, in the units the field shows on screen, numbers written plainly: `800000`, `6.5`, never `800,000` or `6,5`), `why` (key: your reason, 200 characters at most, shown to the user beside the value; a list key or `json` can have one too), `note` (one line, such as the place and date). If it prints NOT BUILT, fix what it lists and run it again. Use the link it prints exactly as printed.
   The script checks every form field: its key, range, step and choices. List keys and `json` are checked by the tool when the link opens, so write them exactly in the syntax the reference gives (its COMPACT LISTS and JSON sections), with the names it lists. A Quick Start sets only what its line in the reference lists; when a list key (a set of tickers, portfolios or offers) replaces what the Quick Start holds, send every setting you want with it.
   If you cannot run code, build the link by hand from the LINK FORMAT in the reference, using only keys and values listed there, and check each value against its range.
5. **Reply in the format below, and stop.**

## Reply format

Your whole reply has these four parts, in this order, written in the user's language (keys and the link stay as they are):

1. **Your inputs**: a short list of what the user stated, each with the value that goes in the link.
2. **Assumptions**: a numbered list (or a table: Input | Value | Source or rationale), one entry per input you chose, each with its value and its source with the date for anything you looked up, or "estimate" and your reason for anything from your own knowledge. Put the same reason, shortened, in that key's `why`.
3. **The link**, as a clickable Markdown link to tool.adjiebrotots.com/costofliving-comparator/..., and again inside a code block so the user can copy it if their chat app breaks a long link.
4. The sentence: **Open the link to see the result.** You may add one line inviting the user to correct any assumption, and then you will send a new link.

**Do not state results.** No verdict, figure, estimate, range, "roughly", "likely", or preview of what the tool will show, not even if the user asks. The only numbers in your reply are the inputs in the link. If the user asks what the answer is, explain that the tool works it out from these inputs and the link opens it, and offer to change any input.

If the request is outside what this tool does, say so, give the tool's address and help the user as you normally would.

## Link format (summary)

```
https://tool.adjiebrotots.com/costofliving-comparator/#load&v=1&qs=<quick start>&<key>=<value>&why.<key>=<reason>&note=<one line>
```
- `#load` then `key=value` pairs joined by `&`, each value percent-encoded. `v=1` always.
- Values in the units the field shows: `6.1` for 6.1 %, `800000` for 800,000. A choice takes its listed value.
- The tool starts from the Quick Start (or its defaults) and applies each key. Keys not named keep their base value.
- Out of range numbers are pulled into range and unknown keys are skipped, and the tool tells the user. The script stops you before either happens.
- Never use the keys `s`, `open` or `embed`.

## Worked example

**User:** I earn A$110,000 in Melbourne and got an offer in Singapore; what salary keeps my lifestyle?

**Spec** (`costofliving-comparator`):

```json
{
  "page": "costofliving-comparator",
  "set": {
    "cities": "Melbourne,Singapore",
    "salary": "7000",
    "rows": "rent:2400,groceries:700,eating_out:500,utilities:250,other:1300"
  },
  "why": {
    "salary": "A$110,000 a year is about A$85,000 after tax and Medicare, so about 7,000 a month. The user did not give a take-home figure",
    "rows": "The user did not say what they spend, so a typical monthly budget for one person renting in Melbourne"
  },
  "qs": "sg-au",
  "note": "Melbourne to Singapore, October 2026"
}
```

**Reply:**

**Assumptions**

1. Net salary: 7,000 Australian dollars a month. The user gave 110,000 a year before tax, and the tool does no tax, so this is an estimate of take-home pay after income tax and Medicare.
2. Expenses: rent 2,400, groceries 700, eating out 500, utilities 250 and other 1,300 a month, 5,150 in all, in Australian dollars. The user did not say what they spend, so this is a typical budget for one person renting in Melbourne. It replaces the Quick Start's Singapore dollar rows.
3. Cities: Melbourne is the home city and Singapore the destination, replacing the Quick Start's Singapore and Australian cities.
4. From the Quick Start: the goal is I need to earn, and the target is a savings ratio. Housing is included in the rows. Amounts are monthly, and exchange rates are today's market rates.

[Open Cost of Living Comparator on this scenario](https://tool.adjiebrotots.com/costofliving-comparator/#load&v=1&qs=sg-au&cities=Melbourne,Singapore&salary=7000&why.salary=A$110,000%20a%20year%20is%20about%20A$85,000%20after%20tax%20and%20Medicare,%20so%20about%207,000%20a%20month.%20The%20user%20did%20not%20give%20a%20take-home%20figure&rows=rent:2400,groceries:700,eating_out:500,utilities:250,other:1300&why.rows=The%20user%20did%20not%20say%20what%20they%20spend,%20so%20a%20typical%20monthly%20budget%20for%20one%20person%20renting%20in%20Melbourne&note=Melbourne%20to%20Singapore,%20October%202026)

```
https://tool.adjiebrotots.com/costofliving-comparator/#load&v=1&qs=sg-au&cities=Melbourne,Singapore&salary=7000&why.salary=A$110,000%20a%20year%20is%20about%20A$85,000%20after%20tax%20and%20Medicare,%20so%20about%207,000%20a%20month.%20The%20user%20did%20not%20give%20a%20take-home%20figure&rows=rent:2400,groceries:700,eating_out:500,utilities:250,other:1300&why.rows=The%20user%20did%20not%20say%20what%20they%20spend,%20so%20a%20typical%20monthly%20budget%20for%20one%20person%20renting%20in%20Melbourne&note=Melbourne%20to%20Singapore,%20October%202026
```

Open the link to see the result.

## Files

- `references/costofliving-comparator.md`: Cost of Living Comparator. Every key with its label, unit, range and default, the Quick Starts and what each sets, list and json syntaxes, and an example.
- `references/costofliving-comparator-map.md`: Cost of Living Comparator: Map View. Every key with its label, unit, range and default, the Quick Starts and what each sets, list and json syntaxes, and an example.
- `references/params.json`: the same keys as data (what the script checks against).
- `scripts/build_link.py`: builds and checks the link. `python3 scripts/build_link.py --help` explains it.

Source: https://tool.adjiebrotots.com/costofliving-comparator/ai/ (this skill, kept up to date with the tool).
