---
name: brotools-global-income-tax-calculator
description: "Opens Adjie Brotools' Global Income Tax Calculator (https://tool.adjiebrotots.com/global-income-tax-calculator/) on the user's own scenario with one link, and the tool computes the answer. Use when the user asks about take-home pay after income tax and social contributions for a job in one of 31 countries or any US state (gross to net, or the gross needed for a take-home amount), and comparing up to four job offers or cities side by side. Also use when they mention tool.adjiebrotots.com/global-income-tax-calculator."
---

# Global Income Tax Calculator on tool.adjiebrotots.com

Global Income Tax Calculator is a free calculator that runs in the user's browser. This skill turns the user's question into **one link** that opens the tool on their scenario. The tool, not you, works out the result: its figures come from its own model and data, and anything you work out separately can differ from what the user then sees.

## What it decides

- **Global Income Tax Calculator** (`global-income-tax-calculator`): Take-home pay after income tax and employee social contributions for one to four jobs in 31 countries, 39 US states and DC, under 2026 rules, from gross to net or net to gross, with each line of the sum named, sourced and dated, and which job leaves the most.

Indonesian versions take the same keys and Quick Starts. Use them when the user writes in Indonesian: `global-income-tax-calculator/id` (https://tool.adjiebrotots.com/global-income-tax-calculator/id/).

## Workflow

1. **Pick the page.** Read the user's request and choose the page above that answers it. Open its reference (`references/<page>.md`, listed under Files) and read the LINK FORMAT, the most important keys and the Quick Starts. The reference is long: read the parts you need.
2. **Separate what the user said from what you must choose.** Every figure the user gave goes in as they gave it (convert units or periods only to match the field, and say so).
3. **Fill every other input that matters with a researched assumption.**
   - If you can search the web, do it for figures that change over time or by place. For this tool that usually means the job's pay as the user gave it, and anything the user did not say that the tool asks (residency status, state or province, family); the tool holds the 2026 tax and contribution rules itself, never type them in. Prefer official and primary sources and note each source and its date.
   - If you cannot search, use your own knowledge and say it is an estimate as of your knowledge date.
   - Start from the nearest Quick Start (`qs`) for the user's place and case, and keep its figures unless you have a better one for this user. Send only what differs from it.
   - Prefer what the user said earlier in the conversation over general figures. Never invent a figure the user gave differently.
4. **Build the link with the script** (it checks every key, range and choice, and encodes the link exactly):
   ```bash
   python3 scripts/build_link.py --fields global-income-tax-calculator --find <words>     # look up keys
   python3 scripts/build_link.py --quickstarts global-income-tax-calculator --find <words> # look up Quick Starts
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
3. **The link**, as a clickable Markdown link to tool.adjiebrotots.com/global-income-tax-calculator/..., and again inside a code block so the user can copy it if their chat app breaks a long link.
4. The sentence: **Open the link to see the result.** You may add one line inviting the user to correct any assumption, and then you will send a new link.

**Do not state results.** No verdict, figure, estimate, range, "roughly", "likely", or preview of what the tool will show, not even if the user asks. The only numbers in your reply are the inputs in the link. If the user asks what the answer is, explain that the tool works it out from these inputs and the link opens it, and offer to change any input.

If the request is outside what this tool does, say so, give the tool's address and help the user as you normally would.

## Link format (summary)

```
https://tool.adjiebrotots.com/global-income-tax-calculator/#load&v=1&qs=<quick start>&<key>=<value>&why.<key>=<reason>&note=<one line>
```
- `#load` then `key=value` pairs joined by `&`, each value percent-encoded. `v=1` always.
- Values in the units the field shows: `6.1` for 6.1 %, `800000` for 800,000. A choice takes its listed value.
- The tool starts from the Quick Start (or its defaults) and applies each key. Keys not named keep their base value.
- Out of range numbers are pulled into range and unknown keys are skipped, and the tool tells the user. The script stops you before either happens.
- Never use the keys `s`, `open` or `embed`.

## Worked example

**User:** using tool.adjiebrotots.com/global-income-tax-calculator, what is my take-home pay on £85,000 in London?

**Spec** (`global-income-tax-calculator`):

```json
{
  "page": "global-income-tax-calculator",
  "set": {
    "country": "GB",
    "ukRegion": "ruk",
    "dir": "gross",
    "amount": "85000",
    "period": "yearly"
  },
  "why": {
    "country": "London is in England, so the rest of UK rates apply",
    "amount": "£85,000 a year before tax, as the user said"
  },
  "note": "London, November 2026"
}
```

**Reply:**

**Your inputs**

- Gross pay: A$85,000

**Assumptions**

1. Job: an employee in England on £85,000 a year gross, under the 2026/27 UK rules, with no student loan.
2. Take-home: after income tax and National Insurance only. Pension contributions through salary sacrifice are not included.

[Open Global Income Tax Calculator on this scenario](https://tool.adjiebrotots.com/global-income-tax-calculator/#load&v=1&country=GB&why.country=London%20is%20in%20England,%20so%20the%20rest%20of%20UK%20rates%20apply&ukRegion=ruk&dir=gross&amount=85000&why.amount=%C2%A385,000%20a%20year%20before%20tax,%20as%20the%20user%20said&period=yearly&note=London,%20November%202026)

```
https://tool.adjiebrotots.com/global-income-tax-calculator/#load&v=1&country=GB&why.country=London%20is%20in%20England,%20so%20the%20rest%20of%20UK%20rates%20apply&ukRegion=ruk&dir=gross&amount=85000&why.amount=%C2%A385,000%20a%20year%20before%20tax,%20as%20the%20user%20said&period=yearly&note=London,%20November%202026
```

Open the link to see the result.

## Files

- `references/global-income-tax-calculator.md`: Global Income Tax Calculator. Every key with its label, unit, range and default, the Quick Starts and what each sets, list and json syntaxes, and an example.
- `references/global-income-tax-calculator-id.md`: Kalkulator Gaji Bersih dan Pajak Penghasilan (Indonesian page). Every key with its label, unit, range and default, the Quick Starts and what each sets, list and json syntaxes, and an example.
- `references/params.json`: the same keys as data (what the script checks against).
- `scripts/build_link.py`: builds and checks the link. `python3 scripts/build_link.py --help` explains it.

Source: https://tool.adjiebrotots.com/global-income-tax-calculator/ai/ (this skill, kept up to date with the tool).
