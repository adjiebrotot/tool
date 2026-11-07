---
name: brotools-dcasimulator
description: "Opens Adjie Brotools' DCA Scenario Explorer (https://tool.adjiebrotots.com/dcasimulator/) on the user's own scenario with one link, and the tool computes the answer. Use when the user asks about backtesting regular investing (dollar cost averaging) into stocks, ETFs or crypto on past prices, comparing tickers, schedules and buying rules, and multi-ticker portfolios with rebalancing. Also use when they mention tool.adjiebrotots.com/dcasimulator."
---

# DCA Scenario Explorer on tool.adjiebrotots.com

DCA Scenario Explorer is a free calculator that runs in the user's browser. This skill turns the user's question into **one link** that opens the tool on their scenario. The tool, not you, works out the result: its figures come from its own model and data, and anything you work out separately can differ from what the user then sees.

## What it decides

- **DCA Scenario Explorer** (`dcasimulator`): How a plan of regular purchases (dollar cost averaging) would have gone on past prices. Each scenario is one real ticker bought on one schedule, such as $500 a month into SPY, and the tool shows what was put in, what it was worth at the end, the return and the risk, with the scenarios side by side. Compare tickers, schedules or buying rules over any past date range.
- **Portfolio DCA Simulator** (`dcasimulator/portfolio`): How portfolios of several real tickers would have gone on past prices when money is added on a schedule (top-ups) and the holdings are kept to target weights by a chosen rebalancing method. Each portfolio is a mix such as 60% VOO and 40% BND, and the tool shows what was put in, what it was worth at the end, the return and the risk, with the portfolios side by side. Compare mixes, rebalancing methods or schedules over any past date range.

## Workflow

1. **Pick the page.** Read the user's request and choose the page above that answers it. Open its reference (`references/<page>.md`, listed under Files) and read the LINK FORMAT, the most important keys and the Quick Starts. The reference is long: read the parts you need.
2. **Separate what the user said from what you must choose.** Every figure the user gave goes in as they gave it (convert units or periods only to match the field, and say so).
3. **Fill every other input that matters with a researched assumption.**
   - If you can search the web, do it for figures that change over time or by place. For this tool that usually means the exact ticker symbols (exchange suffixes such as .JK or .AX), fees and the date range the user means; prices load in the tool, never type them in. Prefer official and primary sources and note each source and its date.
   - If you cannot search, use your own knowledge and say it is an estimate as of your knowledge date.
   - Start from the nearest Quick Start (`qs`) for the user's place and case, and keep its figures unless you have a better one for this user. Send only what differs from it.
   - Prefer what the user said earlier in the conversation over general figures. Never invent a figure the user gave differently.
4. **Build the link with the script** (it checks every key, range and choice, and encodes the link exactly):
   ```bash
   python3 scripts/build_link.py --fields dcasimulator --find <words>     # look up keys
   python3 scripts/build_link.py --quickstarts dcasimulator --find <words> # look up Quick Starts
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
3. **The link**, as a clickable Markdown link to tool.adjiebrotots.com/dcasimulator/..., and again inside a code block so the user can copy it if their chat app breaks a long link.
4. The sentence: **Open the link to see the result.** You may add one line inviting the user to correct any assumption, and then you will send a new link.

**Do not state results.** No verdict, figure, estimate, range, "roughly", "likely", or preview of what the tool will show, not even if the user asks. The only numbers in your reply are the inputs in the link. If the user asks what the answer is, explain that the tool works it out from these inputs and the link opens it, and offer to change any input.

If the request is outside what this tool does, say so, give the tool's address and help the user as you normally would.

## Link format (summary)

```
https://tool.adjiebrotots.com/dcasimulator/#load&v=1&qs=<quick start>&<key>=<value>&why.<key>=<reason>&note=<one line>
```
- `#load` then `key=value` pairs joined by `&`, each value percent-encoded. `v=1` always.
- Values in the units the field shows: `6.1` for 6.1 %, `800000` for 800,000. A choice takes its listed value.
- The tool starts from the Quick Start (or its defaults) and applies each key. Keys not named keep their base value.
- Out of range numbers are pulled into range and unknown keys are skipped, and the tool tells the user. The script stops you before either happens.
- Never use the keys `s`, `open` or `embed`.

## Worked example

**User:** I want to put $500 a month into VOO and QQQ from 2015 to now; how would it have gone?

**Spec** (`dcasimulator`):

```json
{
  "page": "dcasimulator",
  "set": {
    "tickers": "VOO,QQQ",
    "amount": "500",
    "startDate": "2015-01-01"
  },
  "why": {
    "tickers": "The two funds the user named, each as its own scenario so they can be compared",
    "amount": "The user's $500, invested once a month",
    "startDate": "The user said from 2015, so the first day of that year"
  },
  "note": "VOO and QQQ, monthly from 2015 to now"
}
```

**Reply:**

**Your inputs**

- amount: 500

**Assumptions**

1. Tickers: VOO and QQQ, one scenario each, with the same plan, because the user named the two funds.
2. Schedule: 500 invested on the 1st of every month, the tool's default day, since the user gave no day.
3. Start date: 2015-01-01, the first day of 2015.
4. End date: left out, so the tool uses today, which is what "to now" means.
5. Currency: the default $, since both funds trade in US dollars.

[Open DCA Scenario Explorer on this scenario](https://tool.adjiebrotots.com/dcasimulator/#load&v=1&tickers=VOO,QQQ&why.tickers=The%20two%20funds%20the%20user%20named,%20each%20as%20its%20own%20scenario%20so%20they%20can%20be%20compared&amount=500&why.amount=The%20user%27s%20$500,%20invested%20once%20a%20month&startDate=2015-01-01&why.startDate=The%20user%20said%20from%202015,%20so%20the%20first%20day%20of%20that%20year&note=VOO%20and%20QQQ,%20monthly%20from%202015%20to%20now)

```
https://tool.adjiebrotots.com/dcasimulator/#load&v=1&tickers=VOO,QQQ&why.tickers=The%20two%20funds%20the%20user%20named,%20each%20as%20its%20own%20scenario%20so%20they%20can%20be%20compared&amount=500&why.amount=The%20user%27s%20$500,%20invested%20once%20a%20month&startDate=2015-01-01&why.startDate=The%20user%20said%20from%202015,%20so%20the%20first%20day%20of%20that%20year&note=VOO%20and%20QQQ,%20monthly%20from%202015%20to%20now
```

Open the link to see the result.

## Files

- `references/dcasimulator.md`: DCA Scenario Explorer. Every key with its label, unit, range and default, the Quick Starts and what each sets, list and json syntaxes, and an example.
- `references/dcasimulator-portfolio.md`: Portfolio DCA Simulator. Every key with its label, unit, range and default, the Quick Starts and what each sets, list and json syntaxes, and an example.
- `references/params.json`: the same keys as data (what the script checks against).
- `scripts/build_link.py`: builds and checks the link. `python3 scripts/build_link.py --help` explains it.

Source: https://tool.adjiebrotots.com/dcasimulator/ai/ (this skill, kept up to date with the tool).
