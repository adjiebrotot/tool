# Rent vs Own Sensitivity: notes for the AI section

Hand-written. `node _ref/agent-doc.mjs` merges these notes with the fields it reads from the
page and writes `rentvsownhouse/sensitivity/agent.txt` and `id/agent.txt`, the AI section in
`index.html` and `id/index.html`, and the lines in `llms.txt`. Edit here, never the generated
text, then run the generator. Text above the first heading (this) is not published. Same
headings as `rentvsownhouse/agent-notes.md`.

This page has one form field of its own (the currency symbol, `currencySelect`). The table is
JS state (`scenarios`, `shared`, `fx`, `modes`, `view` in `script.js`), so every other key below
is a compact key the adapter reads (`SharedAgent.register` at the end of `script.js`). The
figures use the main Rent vs Own page's key names; the checks treat six of them as number boxes
(`virtual` in `_ref/agent-lib.mjs`). `ratePeriods`, the cost rows and the exchange-rate settings
are in `json` only.

## Decides

How sensitive buying a home with a mortgage, against renting it and investing the difference, is to each assumption: a table of scenarios side by side, the first the base case and the others the same case with one figure changed (the mortgage rate, house price growth, rent inflation, the costs) or a different home, each read as net equity, liquid cash or accumulated cost, for owning and for renting, at one chosen year.

## Most important

- propertyPrice
- rentAmount
- rentFreq
- vary
- mortgageRate
- houseGrowth
- rentInflation
- downPaymentPct
- horizon
- riskFreeRate
- setupCost
- ownOngoingCost
- currencySelect

## Fields

- currencySelect: The currency symbol shown with every amount in a table that is in one currency. It only relabels the figures and never converts them, so give every amount in this one currency, the local one for the place. A symbol from the picker ($, Rp, £, RM) or a currency code (AUD is $). A Quick Start sets its own city's symbol.
- propertyPrice: The price of the home in the base case (the first column), today. Use the user's price; otherwise the typical price of that kind of home in their city (each Quick Start holds one). At least 50,000. Without a Quick Start 800,000.
- downPaymentPct: The deposit as a % of the price, paid in cash at purchase; the rest is the loan. 0 to 100, typical 10 to 30 (20 is common in Australia, where less usually adds lenders' mortgage insurance). 100 models an all-cash purchase. Without a Quick Start 20.
- mortgageType: pi (principal and interest) or io (interest only). Used only in the Detailed mortgage mode, and naming it switches the mortgage to Detailed on one fixed rate for the whole term, in every column. Leave it out unless the user asks about interest-only loans. Without a Quick Start pi.
- costInterestOnly: true or false. Changes only what the Accumulated cost result counts, never net equity. Used only in the Detailed mortgage mode, and naming it switches the mortgage to Detailed as mortgageType does. Leave it out. Without a Quick Start true.
- mortgageRate: The loan's interest rate in % a year, for the whole term. 0 to 25. Use the going variable rate for the place and date: about 6 to 6.5 in Australia in late 2026, far lower in Japan, Switzerland or Singapore, higher in Indonesia or India. On a Quick Start whose Loan line says it opens in the Detailed mortgage mode, naming mortgageRate (here or in vary) replaces that rate schedule with this one fixed rate for the whole term, in every column. Without a Quick Start 6.
- mortgageTerm: Years the loan is repaid over, 5 to 50. Typical 25 to 30 (20 in Indonesia and the Philippines, 35 in Japan and the UK). Without a Quick Start 30.
- houseGrowth: How fast the home's price grows, % a year, -10 to 25. Use a long-run figure for that kind of home in that city, below the boom years: about 3 to 4.5 in Australian capitals, lower for apartments. Without a Quick Start 5.
- sellingCostPct: Selling costs as a % of the sale price (agent, marketing, legal), 0 to 15, taken off the home's value as if it were sold. Typical 2 to 3 in Australia, 5 to 7 in the USA. Without a Quick Start 2.5.
- setupCost: One-off costs at purchase: stamp duty or transfer tax, legal and conveyancing, inspections, bank fees. An amount, or a % of the price, as setupCostType says. Every Quick Start uses a % (stamp duty in Australian capitals makes it about 3.5 to 6); without a Quick Start it is an amount, 32,000.
- setupCostType: dollar: setupCost is an amount. pct: setupCost is a % of the price. Send it with setupCost whenever you mean the other one. Without a Quick Start dollar.
- ownOngoingCost: The costs of owning beyond the loan: council rates, building insurance, maintenance, strata or owners corporation fees, land tax. Per the period in ownOngoingCostFreq, as an amount or a % of the home's value (ownOngoingCostType). Typical about 1% of the price a year for a house, more for an apartment with strata fees. Without a Quick Start 6,000 a year.
- ownOngoingCostFreq: yearly, monthly or weekly: the period ownOngoingCost is per. Send it with ownOngoingCost when the user's figure is per month or week. Not used when ownOngoingCostType is pct. Without a Quick Start yearly.
- ownOngoingCostType: dollar: ownOngoingCost is an amount, growing at ownOngoingInflation. pct: it is a % of the home's value each year and grows with the home. Without a Quick Start dollar.
- ownOngoingInflation: How fast owning costs given as an amount grow, % a year, 0 to 15. Typical: inflation, 2 to 3. Without a Quick Start 0.
- rentAmount: The rent today for a home like the one the user would buy, per the period in rentFreq. Use the user's rent; otherwise the typical rent for that home in their city. Without a Quick Start 2,800 a month.
- rentFreq: monthly, weekly or yearly: the period rentAmount is per. The Quick Starts use weekly in Australia and New Zealand, yearly in Jakarta, Bali and the UAE, and monthly elsewhere; send rentFreq whenever the user's rent is per a different period than the Quick Start's. Without a Quick Start monthly.
- rentInflation: How fast rent rises, % a year, -10 to 25. Typical 2 to 4 over the long run. Without a Quick Start 3.
- rentOngoingCost: Costs of renting beyond the rent: contents insurance, moving every few years, connection fees. Small: a few hundred to about 2,000 a year. Without a Quick Start 1,200 a year.
- rentOngoingCostFreq: yearly, monthly or weekly: the period rentOngoingCost is per. Not used when rentOngoingCostType is pct. Without a Quick Start yearly.
- rentOngoingCostType: dollar: an amount, growing at rentOngoingInflation. pct: a % of the year's rent. Without a Quick Start dollar.
- rentOngoingInflation: How fast renting costs given as an amount grow, % a year, 0 to 15. Typical: inflation, 2 to 3. Without a Quick Start 0.
- horizon: The number of years compared, 5 to 100, and the same for every column. Use how long the user expects to stay; typical 10 to 30. Without a Quick Start 30.
- riskFreeRate: What spare cash earns, % a year, -10 to 25, like a savings account or term deposit: the renter's deposit money and each year's surplus are invested at it. The same for every column. Use the local deposit or short government bond rate (about 4 to 5 in Australia in late 2026). Without a Quick Start 4.5.
- initialCash: Cash the user has today, the same for every column. 0 or blank (the default) is automatic, set to the most any column needs up front. Leave it out unless the user gives it.
- monthlyBudget: Monthly cash for housing, the same for every column. 0 or blank (the default) is automatic, each month the most any column needs, so every column can pay and the cheaper one invests the difference. Set it only when the user gives a budget.
- monthlyBudgetIncrease: How fast a monthly budget the user set grows, % a year, 0 to 25. Does nothing while monthlyBudget is automatic. Without a Quick Start 0.
- vary: The columns that make it a sensitivity table. See Compact lists.
- baseName: A name for the first column, over its figures. A Quick Start names it after the home (Melbourne · 2BR house). Up to 60 characters; leave it out unless the user names the home.
- metric: What every column's results read: netEquity, cash or cost. See Compact lists. Default netEquity.
- year: The year the results are read at, 1 up to the horizon, the same for every column. Default 30 (the horizon).

## Hide

## Quick Starts

There are 33 cities, each with the homes its market really has, from a studio to a 4-bedroom apartment or house. A Quick Start becomes the table's one column, the base case: that city's typical price and rent for the home, the usual deposit, loan rate and term, setup and running costs and growth, plus the figures every column shares (horizon, risk-free rate), with sources listed at https://tool.adjiebrotots.com/rentvsownhouse/quickstart-assumptions/ .

Start from the city and home closest to the user's, then send the user's own figures (usually propertyPrice and rentAmount), and vary the figures the user asks about. A link without vary opens the base case alone, so send vary for any question about sensitivity. For a city not listed, start from a similar market in the same country or currency and send the local figures that differ, or leave qs out and send every figure that matters. To put different homes or cities side by side, give each its own qs in json.

## Example

Request: how sensitive is buying an $850,000 house in Melbourne vs renting at $620 a week to the mortgage rate and house price growth?

Link:
- qs=melbourne/house-2br
- propertyPrice=850000
- rentAmount=620
- setupCost=6
- why.setupCost=Victorian stamp duty on $850,000 plus transfer and legal fees
- ownOngoingCost=7000
- why.ownOngoingCost=Rates, insurance and upkeep on an $850,000 house
- vary=mortgageRate:5.4:7.4,houseGrowth:2:6
- why.vary=The user named the mortgage rate and house price growth, so each is tried a little either side of the base case
- note=Melbourne, October 2026, 2-bedroom house

Assumptions:
1. Home: a 2-bedroom house, so the first column starts from the Melbourne 2-bedroom house Quick Start (qs=melbourne/house-2br) and keeps its local figures: a {downPaymentPct}% deposit, a mortgage at {mortgageRate}% a year over {mortgageTerm} years, house prices growing {houseGrowth}% a year, rent growing {rentInflation}% a year, spare cash earning {riskFreeRate}% a year, selling costs of {sellingCostPct}% and a {horizon}-year comparison.
2. Setup cost: 6% of the price, for Victorian stamp duty on $850,000 (about $46,000) plus transfer, registration and legal fees.
3. Ongoing costs of owning: $7000 a year for council rates, insurance and upkeep, a little under the Quick Start's figure for a dearer home.
4. Mortgage rate: tried at 5.4% and 7.4% a year, a point either side of the Quick Start's {mortgageRate}%, each as its own column with every other figure as in the first column.
5. House price growth: tried at 2% and 6% a year, two points either side of the Quick Start's {houseGrowth}%, the same way.

## Compact lists

- `propertyPrice=<amount>`
- `downPaymentPct=<percent>`
- `mortgageType=<pi|io>`
- `mortgageRate=<percent>`
- `mortgageTerm=<years>`
- `houseGrowth=<percent>`
- `sellingCostPct=<percent>`
- `setupCost=<amount or percent>`
- `setupCostType=<dollar|pct>`
- `ownOngoingCost=<amount or percent>`
- `ownOngoingCostFreq=<yearly|monthly|weekly>`
- `ownOngoingCostType=<dollar|pct>`
- `ownOngoingInflation=<percent>`
- `costInterestOnly=<true|false>`
- `rentAmount=<amount>`
- `rentFreq=<monthly|weekly|yearly>`
- `rentInflation=<percent>`
- `rentOngoingCost=<amount or percent>`
- `rentOngoingCostFreq=<yearly|monthly|weekly>`
- `rentOngoingCostType=<dollar|pct>`
- `rentOngoingInflation=<percent>`
- `horizon=<years>`
- `riskFreeRate=<percent>`
- `initialCash=<amount>`
- `monthlyBudget=<amount>`
- `monthlyBudgetIncrease=<percent>`
- `vary=<figure>:<value>:<value>,<figure>:<value>:<value>`
- `baseName=<text>`
- `metric=<netEquity|cash|cost>`
- `year=<years>`

There are no form fields on this page apart from currencySelect, so every figure is one of these keys, named as on the main Rent vs Own page. Amounts and percents are plain numbers (850000, 6.4), with no thousands separators; a percent is in %, never a fraction. A figure not named keeps what the Quick Start (or the tool's default) gave the first column.

The first column is the base case: the Quick Start, then every figure the link names except the shared ones. horizon, riskFreeRate, initialCash, monthlyBudget and monthlyBudgetIncrease are one figure for the whole table, so every column plays with the same money for the same time.

vary: the columns that make it a sensitivity table. Items are separated by `,` and their parts by `:`: the figure's key, then the values to try. Each value becomes one more column after the first, the base case with only that figure changed and named after it (Mortgage rate 5.4%). Any column figure can vary, a choice too (`vary=mortgageType:pi:io`), but not the shared ones: they are the same for every column by design, so give a shared figure one value in its own key and say so in the assumptions. A value equal to the base case's own adds no column, so a list may include it. Bracket the base case by amounts the user would call plausible, such as a point or two either side for a rate or a growth. At most 6 values a figure and 12 columns in all.
`vary=mortgageRate:5.4:7.4,houseGrowth:2:6`

baseName, metric and year: the first column's name, what every column's results read (netEquity is net equity, cash is liquid cash, cost is accumulated cost) and the year they are read at. Leave them out unless the user asks for them.

setupCost, ownOngoingCost and rentOngoingCost are amounts unless their Type key is pct, and then a % of the price, of the home's value or of the year's rent. Send the Type key with the amount whenever it differs from the Quick Start's.

## Json

json takes the table's saved shape, partly. Use it only for what the keys above cannot say: columns in different homes or cities, a column's own rate schedule or cost rows, several currencies. Ordinary figures and vary go in their own keys. Write it compactly with no spaces.
`json={"scenarios":[{"qs":"melbourne/house-2br"},{"qs":"sydney/apt-2br","name":"Sydney flat"}]}`

scenarios: the columns in order, replacing the one base column; the first is the base case that vary changes. Each is an object. qs (a Quick Start key such as sydney/apt-2br) starts that column from the home, otherwise it starts from the base case as the other keys set it. name (60 characters at most). Any column figure by its key (propertyPrice, rentAmount, mortgageRate and the others above), currency (an ISO code such as AUD) and fxRate (units of that currency per unit of the base currency; leave it out for today's market rate). The lists:
`ratePeriods`: `[{"toYear":3,"type":"fixed","rate":5.89},{"toYear":30,"type":"floating","rateMin":6.5,"rateMax":7.5}]`. The mortgage's rate periods in order. toYear 1 to 50, rates 0 to 40; the last period runs to the end of mortgageTerm whatever its toYear.
`ownSetupCosts`: `[{"amount":45070,"basis":"fixed"},{"amount":1.5,"basis":"pct"}]`. One-off costs at purchase; basis is fixed (an amount) or pct (a % of the price).
`ownOngoingCosts` and `rentOngoingCosts`: `[{"amount":2200,"basis":"yearly"},{"amount":0.5,"basis":"pct","inflation":3}]`. basis is yearly, monthly, weekly or pct (a % of the home's value, or of the year's rent); inflation is % a year, 0 to 30, and left out it is the column's ownOngoingInflation or rentOngoingInflation.
A list switches its section (the mortgage, the costs of owning, the costs of renting) to the Detailed mode for every column, and a column without a list gets one built from its simple figures.

shared: `{"horizon":25,"riskFreeRate":4.5}` with the same keys as the shared figures above. modes: `{"mortgageMode":"detailed"}` with mortgageMode, ownCostsMode and rentCostsMode, each simple or detailed. view: `{"metric":"cash","year":10}`.

fx: the multi-currency settings, `{"on":true,"base":"AUD","path":"parity","rfr":{"AUD":4.6,"SGD":2},"trend":{"SGD":-2}}`. Columns in more than one currency turn it on by themselves, with the first column's currency as the base. base is the ISO code every result is in. path is parity (the default), hold (today's rate for the whole run) or trend. rfr is the risk-free rate of each currency in % a year, used instead of riskFreeRate. trend is each currency's expected change against the base in % a year, -50 to 50, used with path trend.

At most 12 columns. An entry that is not an object, a figure out of its range or a key the table does not have is skipped or pulled into range, and the user is told.
