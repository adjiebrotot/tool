# Cost of Living Comparator: notes for the AI section

Hand-written. `node _ref/agent-doc.mjs` merges these notes with what it reads from the page and
writes `costofliving-comparator/agent.txt`, the AI section in `index.html` and the line in
`llms.txt`. Edit here, never the generated text, then run the generator. Text above the first
heading (this) is not published. Same headings as `rentvsownhouse/agent-notes.md`.

This page has no form fields: the whole comparison is JS state (`S` in `script.js`), so every key
below is a compact key the adapter reads (`SharedAgent.register` in `script.js`, helpers in
`ai-link.js`). The check treats `salary` and `expense` as number boxes (`virtual` in
`_ref/agent-lib.mjs`).

## Decides

How far a salary goes when the user moves between cities: from the user's home city, its monthly take-home pay and costs, either what they would save in each destination city, or the net salary each destination needs to leave them saving the same share of pay (or the same amount).

## Most important

- cities
- salary
- rows
- goal
- detail
- expense
- toSalaries

## Quick Starts

Six worked comparisons, each opening the Detailed table on a home city and its regional peers, with the goal set to I need to earn and the target a savings ratio: Singapore against four Australian cities, Jakarta against Kuala Lumpur, Bangkok and Ho Chi Minh City, New York against three US cities, London against Paris, Amsterdam and Berlin, Dubai against three Gulf cities, and Tokyo against Seoul, Hong Kong and Shanghai.

Start from the one nearest the user's region, then send the user's own cities, salary and rows; a link sends only what differs. A Quick Start's salary and rows are in its own home city's currency. If the user's home city pays in another currency, send salary and rows as well: the tool clears whatever the link leaves from the Quick Start when the home currency changes, and says so. For a user none of them fits, leave qs out and send cities, salary and expense (Simple) or rows (Detailed).

## Example

Request: I earn A$110,000 in Melbourne and got an offer in Singapore; what salary keeps my lifestyle?

Link:
- qs=sg-au
- cities=Melbourne,Singapore
- salary=7000
- rows=rent:2400,groceries:700,eating_out:500,utilities:250,other:1300
- why.salary=A$110,000 a year is about A$85,000 after tax and Medicare, so about 7,000 a month. The user did not give a take-home figure
- why.rows=The user did not say what they spend, so a typical monthly budget for one person renting in Melbourne
- note=Melbourne to Singapore, October 2026

Assumptions:
1. Net salary: 7,000 Australian dollars a month. The user gave 110,000 a year before tax, and the tool does no tax, so this is an estimate of take-home pay after income tax and Medicare.
2. Expenses: rent 2,400, groceries 700, eating out 500, utilities 250 and other 1,300 a month, 5,150 in all, in Australian dollars. The user did not say what they spend, so this is a typical budget for one person renting in Melbourne. It replaces the Quick Start's Singapore dollar rows.
3. Cities: Melbourne is the home city and Singapore the destination, replacing the Quick Start's Singapore and Australian cities.
4. From the Quick Start: the goal is I need to earn, and the target is a savings ratio. Housing is included in the rows. Amounts are monthly, and exchange rates are today's market rates.

## Compact lists

- `cities=<home>,<destination>,<destination>,...`
- `detail=<simple|detailed>`
- `goal=<save|earn>`
- `housing=<include|exclude>`
- `target=<ratio|nominal>`
- `salary=<amount>`
- `expense=<amount>`
- `toSalaries=<amount>,<amount>,...`
- `rows=<category>:<amount>[:to<N>=<amount>],...`
- `customFx=<rate>,<rate>,...`
- `fxShock=<percent>`

There are no form fields on this page, so every key is one of these. Amounts are plain numbers (7000, 25000000), with no thousands separators, and always per month: a link never turns on the custom frequency. All amounts are take-home pay and costs in a city's own currency. A value may also be the words the page shows (I need to earn, Detailed). Anything a link does not name keeps what it started from (the Quick Start, or the page's own start).

cities: the home city first, then up to 8 destinations, matched to the page's own list of cities by name, ignoring case and accents. Use the usual English name. A US or Canadian city may carry its state (Austin, TX or just Austin). Three names are in the list more than once: London (United Kingdom, Canada), Hamilton (Bermuda, New Zealand, Canada) and Kingston (Canada, Jamaica). Write them with the country, as in London, United Kingdom; the country may follow any other city too (Perth, Australia). Separate cities with commas, or with semicolons when you write each as City, Country. A name the list does not have is shown to the user as not recognised and left out, and a name that fits more than one city is refused: never invent, translate or swap in a nearby city, and tell the user if their city may be missing. A destination that matched nothing keeps its place for toSalaries, customFx and rows. Simple mode compares the home city with the first destination only. Sending cities fills both modes, so the same cities show if the reader switches the Detail setting.

detail: simple compares two cities on one salary and one expense total. detailed is a table of expense rows across any number of destinations. Left out, the tool is in Detailed when it started from a Quick Start, and a link that sends rows or more than one destination switches to Detailed; otherwise it is Simple.

goal: save shows what the user would save in each destination at the destination salary they give (toSalaries). earn shows the net salary each destination needs for the target. Use earn for a user who asks what salary to ask for or accept. The Quick Starts use earn.

housing: Simple mode only. include counts rent or a mortgage in the expense total, exclude leaves housing out, as when an employer pays for it. Detailed mode has a rent row instead.

target: what each destination's salary is matched to. ratio saves the same share of pay as the home city does (the default). nominal saves the same amount, at today's exchange rate.

salary: the user's monthly take-home pay in the home city, after tax, in the home city's currency. There is no tax model, so convert a yearly or gross figure to a monthly after-tax estimate and say so in why.salary. Use the user's own figure when they give one.

expense: Simple mode only: everything the user spends in a month in the home city, in the home currency. In Detailed mode give rows instead (a link naming expense there is told it is not used).

toSalaries: the net monthly salary the user is offered in each destination, in that destination's currency, in the order the destinations are listed in cities. Used by goal=save; send it only when the user has an offer or a salary in mind. A blank item skips that destination: toSalaries=,5200 sets the second only.

rows: Detailed expense rows, replacing the Quick Start's rows whole. Items are separated by `,`, the category and the amount by `:`. Categories: rent, groceries, eating_out, utilities, electricity, water, gas_util, fuel, medical, health_insurance, remittance, intl_travel, other. The amount is per month, in the home currency. At most 20 rows. Leave out what the user does not pay (no fuel without a car). utilities is a blend of electricity, water and gas, so do not add those three as well; other holds everything else. Each category is scaled by its own cost index, so a rough row is better than a row put under the wrong category.
`rows=rent:2400,groceries:700,eating_out:500,other:1300`
Optionally, after the amount, `to<N>=<amount>`: what destination N already costs for that row, in that destination's currency, where N is its place after the home city in cities (1 is the first destination). It replaces the tool's estimate for that cell; send it only when the user knows the figure.
`rows=rent:2400:to1=3800,groceries:700`

customFx: a custom exchange rate for each destination, in the order of cities: how many home-currency units one unit of the destination currency buys, so customFx=,0.9 sets the second destination only. Leave it out unless the user names a rate; the tool uses today's market rate.

fxShock: Simple mode: a what-if move in the destination currency's strength against the home currency, as a percent from -20 to 20. Leave it out unless the user asks for a currency scenario.
