---
name: brotools-borrowingcapacity
description: Opens Adjie Brotools' Borrowing Capacity (https://tool.adjiebrotots.com/borrowingcapacity/) on the user's own scenario with one link, and the tool computes the answer. Use when the user asks about how much an Australian bank would lend for a home loan: borrowing power from income, expenses, dependants, debts, deposit, rate and term, and what limit (serviceability, DTI, LVR, deposit) holds it down. Also use when they mention tool.adjiebrotots.com/borrowingcapacity.
---

# Borrowing Capacity on tool.adjiebrotots.com

Borrowing Capacity is a free calculator that runs in the user's browser. This skill turns the user's question into **one link** that opens the tool on their scenario. The tool, not you, works out the result: its figures come from its own model and data, and anything you work out separately can differ from what the user then sees.

## What it decides

- **Borrowing Capacity** (`borrowingcapacity`): How much an Australian lender would lend for a home, from the applicants' income, household, debts and the loan's rate and term, as the smallest of four limits (serviceability, debt to income, loan to value and the deposit), which limit holds it down, and whether that covers the price entered.

## Workflow

1. **Pick the page.** Read the user's request and choose the page above that answers it. Open its reference (`references/<page>.md`, listed under Files) and read the LINK FORMAT, the most important keys and the Quick Starts. The reference is long: read the parts you need.
2. **Separate what the user said from what you must choose.** Every figure the user gave goes in as they gave it (convert units or periods only to match the field, and say so).
3. **Fill every other input that matters with a researched assumption.**
   - If you can search the web, do it for figures that change over time or by place. For this tool that usually means current Australian lender rates and serviceability buffers (APRA, the lender), HEM living expenses, tax and HECS-HELP repayment thresholds (ATO). Prefer official and primary sources and note each source and its date.
   - If you cannot search, use your own knowledge and say it is an estimate as of your knowledge date.
   - Start from the nearest Quick Start (`qs`) for the user's place and case, and keep its figures unless you have a better one for this user. Send only what differs from it.
   - Prefer what the user said earlier in the conversation over general figures. Never invent a figure the user gave differently.
4. **Build the link with the script** (it checks every key, range and choice, and encodes the link exactly):
   ```bash
   python3 scripts/build_link.py --fields borrowingcapacity --find <words>     # look up keys
   python3 scripts/build_link.py --quickstarts borrowingcapacity --find <words> # look up Quick Starts
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
3. **The link**, as a clickable Markdown link to tool.adjiebrotots.com/borrowingcapacity/..., and again inside a code block so the user can copy it if their chat app breaks a long link.
4. The sentence: **Open the link to see the result.** You may add one line inviting the user to correct any assumption, and then you will send a new link.

**Do not state results.** No verdict, figure, estimate, range, "roughly", "likely", or preview of what the tool will show, not even if the user asks. The only numbers in your reply are the inputs in the link. If the user asks what the answer is, explain that the tool works it out from these inputs and the link opens it, and offer to change any input.

If the request is outside what this tool does, say so, give the tool's address and help the user as you normally would.

## Link format (summary)

```
https://tool.adjiebrotots.com/borrowingcapacity/#load&v=1&qs=<quick start>&<key>=<value>&why.<key>=<reason>&note=<one line>
```
- `#load` then `key=value` pairs joined by `&`, each value percent-encoded. `v=1` always.
- Values in the units the field shows: `6.1` for 6.1 %, `800000` for 800,000. A choice takes its listed value.
- The tool starts from the Quick Start (or its defaults) and applies each key. Keys not named keep their base value.
- Out of range numbers are pulled into range and unknown keys are skipped, and the tool tells the user. The script stops you before either happens.
- Never use the keys `s`, `open` or `embed`.

## Worked example

**User:** using tool.adjiebrotots.com/borrowingcapacity, how much can a couple earning $120,000 and $85,000 in Sydney borrow?

**Spec** (`borrowingcapacity`):

```json
{
  "page": "borrowingcapacity",
  "set": {
    "city": "Sydney",
    "incSimple": "205000",
    "incSplit": "40",
    "deps": "0",
    "declaredExp": "4000",
    "price": "1100000",
    "savings": "250000",
    "dutyPct": "4"
  },
  "why": {
    "incSimple": "$120,000 plus $85,000 gross a year, before tax",
    "incSplit": "The second applicant earns $85,000, about 41% of $205,000, and the slider moves in steps of 5",
    "deps": "No children were mentioned, and the Couple Quick Start has two",
    "declaredExp": "A typical monthly figure for two adults with no children, excluding rent and debts",
    "price": "A typical Sydney price for a home a couple on this income might shop for",
    "savings": "Savings for the purchase were not given, so a typical amount for a couple at this income",
    "dutyPct": "New South Wales stamp duty on about $1.1M is about 4% of the price"
  },
  "qs": "couple",
  "note": "Sydney couple, October 2026"
}
```

**Reply:**

**Your inputs**

- City: Sydney

**Assumptions**

1. Household: two applicants and no dependants. The link starts from the Couple Quick Start (qs=couple), which keeps private hospital cover on, no study loan, a card limit of 15,000, a loan at 5.9% a year over 30 years and the 2026-27 tax year.
2. Income: $205,000 a year gross between the two, with the second applicant's share set to 40%, the nearest step to $85,000 of $205,000.
3. Living costs: $4,000 a month declared; the lender uses the higher of this and its own benchmark.
4. Home and deposit: a $1,100,000 home with $250,000 saved, stamp duty at 4% of the price and $4,000 of other purchase costs, none of which the user gave.

[Open Borrowing Capacity on this scenario](https://tool.adjiebrotots.com/borrowingcapacity/#load&v=1&qs=couple&city=Sydney&incSimple=205000&why.incSimple=$120,000%20plus%20$85,000%20gross%20a%20year,%20before%20tax&incSplit=40&why.incSplit=The%20second%20applicant%20earns%20$85,000,%20about%2041%25%20of%20$205,000,%20and%20the%20slider%20moves%20in%20steps%20of%205&deps=0&why.deps=No%20children%20were%20mentioned,%20and%20the%20Couple%20Quick%20Start%20has%20two&declaredExp=4000&why.declaredExp=A%20typical%20monthly%20figure%20for%20two%20adults%20with%20no%20children,%20excluding%20rent%20and%20debts&price=1100000&why.price=A%20typical%20Sydney%20price%20for%20a%20home%20a%20couple%20on%20this%20income%20might%20shop%20for&savings=250000&why.savings=Savings%20for%20the%20purchase%20were%20not%20given,%20so%20a%20typical%20amount%20for%20a%20couple%20at%20this%20income&dutyPct=4&why.dutyPct=New%20South%20Wales%20stamp%20duty%20on%20about%20$1.1M%20is%20about%204%25%20of%20the%20price&note=Sydney%20couple,%20October%202026)

```
https://tool.adjiebrotots.com/borrowingcapacity/#load&v=1&qs=couple&city=Sydney&incSimple=205000&why.incSimple=$120,000%20plus%20$85,000%20gross%20a%20year,%20before%20tax&incSplit=40&why.incSplit=The%20second%20applicant%20earns%20$85,000,%20about%2041%25%20of%20$205,000,%20and%20the%20slider%20moves%20in%20steps%20of%205&deps=0&why.deps=No%20children%20were%20mentioned,%20and%20the%20Couple%20Quick%20Start%20has%20two&declaredExp=4000&why.declaredExp=A%20typical%20monthly%20figure%20for%20two%20adults%20with%20no%20children,%20excluding%20rent%20and%20debts&price=1100000&why.price=A%20typical%20Sydney%20price%20for%20a%20home%20a%20couple%20on%20this%20income%20might%20shop%20for&savings=250000&why.savings=Savings%20for%20the%20purchase%20were%20not%20given,%20so%20a%20typical%20amount%20for%20a%20couple%20at%20this%20income&dutyPct=4&why.dutyPct=New%20South%20Wales%20stamp%20duty%20on%20about%20$1.1M%20is%20about%204%25%20of%20the%20price&note=Sydney%20couple,%20October%202026
```

Open the link to see the result.

## Files

- `references/borrowingcapacity.md`: Borrowing Capacity. Every key with its label, unit, range and default, the Quick Starts and what each sets, list and json syntaxes, and an example.
- `references/params.json`: the same keys as data (what the script checks against).
- `scripts/build_link.py`: builds and checks the link. `python3 scripts/build_link.py --help` explains it.

Source: https://tool.adjiebrotots.com/borrowingcapacity/ai/ (this skill, kept up to date with the tool).
