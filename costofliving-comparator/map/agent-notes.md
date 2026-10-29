# Cost of Living Comparator, Map View: notes for the AI section

Hand-written. `node _ref/agent-doc.mjs` merges these notes with the fields it reads from the
page and writes `costofliving-comparator/map/agent.txt`, the AI section in `index.html` and the
line in `llms.txt`. Edit here, never the generated text, then run the generator. Text above the
first heading (this) is not published. Same headings as `rentvsownhouse/agent-notes.md`.

The net salary and the expense total are form fields; the rest of the plan is JS state (`S` in
`script.js`), so the other keys are compact keys the adapter reads (`SharedAgent.register` in
`script.js`, helpers in `../ai-link.js`). They use the comparator's words where they mean the
same thing (`cities`, `detail`, `housing`, `target`, `rows`).

## Decides

From one home city, its monthly take-home pay and costs, how every other city compares: the net salary each city needs for the same lifestyle and savings, what the user's own salary saves in each city, or what the same multiple of local pay saves there.

## Most important

- cities
- salary
- expense
- detail
- rows
- salaryMode
- target

## Fields

- salary: The user's monthly take-home pay in the home city, after tax, in the home city's currency (the currency tag beside the field shows it). There is no tax model, so convert a yearly or gross figure to a monthly after-tax estimate and say so in why.salary. Use the user's own figure when they give one. The Scaled salary mode compares it with local pay, so give take-home pay there too.
- expense: Simple lifestyle only (detail=simple): everything the user spends in a month in the home city, in the home currency. In Detailed give rows instead; sending rows sets this to their total.

## Hide

- fromSearch

## Quick Starts

Six worked home cities, each with a monthly budget in its own currency and a savings ratio, opened in the Detailed lifestyle: Singapore, Jakarta, Perth, New York, London and Dubai.

Start from the one nearest the user, then send the user's own city, salary and spending; a link sends only what differs. A Quick Start's salary and rows are in its own home city's currency. If the user's home city pays in another currency, send salary and either rows or expense as well: the tool clears whatever the link leaves from the Quick Start when the home currency changes, and says so. For a user none of them fits, leave qs out and send cities, salary and expense (or rows).

## Example

Request: I'm in Melbourne on about A$7,000 a month take-home and spend roughly A$5,000; which cities worldwide would keep my lifestyle?

Link:
- qs=per
- cities=Melbourne
- salary=7000
- detail=simple
- expense=5000
- why.salary=The user gave a take-home figure of about 7,000 a month
- why.expense=The user said they spend roughly 5,000 a month, so one expense total in Simple
- note=Melbourne, October 2026

Assumptions:
1. Home city: Melbourne, replacing the Perth Quick Start's home city. Both pay in Australian dollars.
2. Net salary: 7,000 Australian dollars a month, the user's take-home figure, as stated.
3. Spending: one total of 5,000 Australian dollars a month (the lifestyle detail is Simple), as the user said. The Quick Start's six expense rows stay saved but are not used in Simple.
4. From the page's start: housing is included in the spending, the salary mode is Required salary, and the target is a savings ratio. Amounts are monthly, and exchange rates are today's market rates.

## Compact lists

- `cities=<home city>`
- `detail=<simple|detailed>`
- `housing=<include|exclude>`
- `salaryMode=<required|global|scaled>`
- `target=<ratio|nominal>`
- `scale=<min|avg|median>`
- `rows=<category>:<amount>,...`

salary and expense are form fields, listed above; the rest of the plan has no field, so these keys carry it. Amounts are plain numbers (7000, 25000000), with no thousands separators, and always per month, in the home city's currency. A value may also be the words the page shows (Detailed, Global). Anything a link does not name keeps what it started from (the Quick Start, or the page's own start). Which view the map shows and the major-cities filter belong to the reader and are not set by a link.

cities: the home city, matched to the page's own list of cities by name, ignoring case and accents. Use the usual English name. A US or Canadian city may carry its state (Austin, TX or just Austin). Three names are in the list more than once: London (United Kingdom, Canada), Hamilton (Bermuda, New Zealand, Canada) and Kingston (Canada, Jamaica). Write them with the country, as in London, United Kingdom; the country may follow any other city too (Perth, Australia). The map has one home city, so only the first name is used. A name the list does not have is shown to the user as not recognised and the home city is left as it was, and a name that fits more than one city is refused: never invent, translate or swap in a nearby city, and tell the user if their city may be missing.

detail: simple takes one expense total (expense, with housing). detailed takes expense rows (rows). Sending rows switches to Detailed unless detail is sent.

housing: Simple only. include counts rent or a mortgage in the expense total, exclude leaves housing out, as when an employer pays for it. In Detailed there is a rent row instead.

salaryMode: what the map compares. required (the default): the net salary each city needs for the user's lifestyle and savings target. global: the user's own salary in every city at today's exchange rate, and what it leaves after the same lifestyle. scaled: the user's salary as a multiple of their city's pay (see scale), given as the same multiple of each city's pay.

target: Required salary mode only. ratio (the default) matches the share of pay the user saves now in every city; nominal matches the amount saved, at today's exchange rate.

scale: Scaled salary mode only: the local pay the salary is a multiple of. min is the minimum wage, avg the average net salary (the default), median the median net salary.

rows: Detailed expense rows, replacing the Quick Start's rows whole. Items are separated by `,`, the category and the amount by `:`. Categories: rent, groceries, eating_out, utilities, electricity, water, gas_util, fuel, medical, health_insurance, remittance, intl_travel, other. The amount is per month, in the home currency. At most 20 rows. Leave out what the user does not pay (no fuel without a car). utilities is a blend of electricity, water and gas, so do not add those three as well; other holds everything else. Each category is scaled by its own cost index, so a rough row is better than a row put under the wrong category.
`rows=rent:2400,groceries:600,eating_out:400,utilities:250,fuel:250,other:650`
