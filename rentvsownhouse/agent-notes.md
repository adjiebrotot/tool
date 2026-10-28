# Rent vs Own: notes for the AI section

Hand-written. `node _ref/agent-doc.mjs` merges these notes with the fields it reads from the
page and writes `rentvsownhouse/agent.txt` and `id/agent.txt`, the AI section in `index.html`
and `id/index.html`, and the lines in `llms.txt`. Edit here, never the generated text, then run
the generator. Text above the first heading (this) is not published.

The page itself supplies each field's label, unit, range, default, options and tip, so these
notes add only what the page cannot say. The headings, in this order, are the same for every
tool:

- Decides: one line, what the tool decides.
- Most important: one `- key` per line, the fields a chatbot should think about first, in order.
- Fields: `- key: text` per field (or list key) that needs more than its label: what it means,
  the typical range, how it interacts with others. A continuation line is indented.
- Hide: `- key` per field the docs leave out (none here).
- Quick Starts: how to pick one. The list itself is read from the page.
- Example: `Request:` (what the user asked), `Link:` (one `- key=value` per pair, in link order,
  values unencoded), `Assumptions:` (the numbered list a reply gives; `{key}` is replaced by the
  value that key has once the Quick Start and the link apply, so it never goes stale).
- Compact lists: list keys the tool's adapter reads, one `- key=<syntax>` entry each, then
  their rules. Owned by the adapter.
- Json: the `json=` shape, if the tool takes one.

## Decides

Whether buying a home with a mortgage or renting it and investing the difference leaves you with more net wealth after a set number of years, and the year owning pulls ahead for good, if it does.

## Most important

- propertyPrice
- rentAmount
- rentFreq
- currencySymbol
- downPaymentPct
- mortgageRate
- mortgageTerm
- houseGrowth
- rentInflation
- riskFreeRate
- horizon
- setupCost
- ownOngoingCost

## Fields

- currencySymbol: The currency every amount on the page is in. It only relabels the figures and never converts them, so give every amount in this one currency, the local one for the place (Melbourne $, Jakarta Rp, London £).
- propertyPrice: The price of the home the user would buy, today. Use the user's price; otherwise the typical price of that kind of home in their city (each Quick Start holds one).
- downPaymentPct: The deposit as a % of the price, paid in cash at purchase; the rest is the loan. Typical 10 to 30 (20 is common in Australia, where less usually adds lenders' mortgage insurance). 100 models an all-cash purchase.
- mortgageType: Used only in the Detailed mortgage mode (a Quick Start with a staged loan, or a ratePeriods list). The Simple mode is always principal and interest.
- costInterestOnly: Changes only what the Accumulated cost chart counts, never net equity or the answer. Used only in the Detailed mortgage mode. Leave it out.
- mortgageRate: The loan's interest rate in % a year, for the whole term (Simple mortgage mode). Use the going variable rate for the place and date: about 6 to 6.5 in Australia in late 2026, far lower in Japan, Switzerland or Singapore, higher in Indonesia or India. On a Quick Start whose Loan line says it opens in the Detailed mortgage mode, this field is not used: send ratePeriods to change the rate there.
- mortgageTerm: Years the loan is repaid over. Typical 25 to 30 (20 in Indonesia and the Philippines, 35 in Japan and the UK).
- setupCost: One-off costs at purchase: stamp duty or transfer tax, legal and conveyancing, inspections, bank fees. An amount, or a % of the price, as setupCostType says. Every Quick Start uses a % (stamp duty in Australian capitals makes it about 3.5 to 6); the tool's own default is an amount.
- setupCostType: dollar: setupCost is an amount. pct: setupCost is a % of the price. Send it with setupCost whenever you mean the other one.
- ownOngoingCost: The costs of owning beyond the loan: council rates, building insurance, maintenance, strata or owners corporation fees, land tax. Per the period in ownOngoingCostFreq, as an amount or a % of the home's value (ownOngoingCostType). Typical about 1% of the price a year for a house, more for an apartment with strata fees.
- ownOngoingCostFreq: The period ownOngoingCost is per. Send it with ownOngoingCost when the user's figure is per month or week.
- ownOngoingCostType: dollar: ownOngoingCost is an amount, growing at ownOngoingInflation. pct: it is a % of the home's value each year and grows with the home.
- ownOngoingInflation: How fast owning costs given as an amount grow, % a year. Typical: inflation, 2 to 3.
- rentAmount: The rent today for a home like the one the user would buy, per the period in rentFreq. Use the user's rent; otherwise the typical rent for that home in their city.
- rentFreq: The period rentAmount is per. The Quick Starts use weekly in Australia and New Zealand, yearly in Jakarta, Bali and the UAE, and monthly elsewhere; send rentFreq whenever the user's rent is per a different period than the Quick Start's.
- rentInflation: How fast rent rises, % a year. Typical 2 to 4 over the long run.
- rentOngoingCost: Costs of renting beyond the rent: contents insurance, moving every few years, connection fees. Small: a few hundred to about 2,000 a year.
- rentOngoingCostType: dollar: an amount, growing at rentOngoingInflation. pct: a % of the year's rent.
- rentOngoingInflation: How fast renting costs given as an amount grow, % a year. Typical: inflation, 2 to 3.
- rtbEnabled: Adds a third scenario, Rent-Then-Buy: rent for rtbBuyYear years, then buy the same home at its grown price. Leave it out unless the user asks about buying later.
- rtbBuyYear: The year the Rent-Then-Buy scenario buys. Must be less than horizon.
- generalInflation: Used only to show results in today's money; it changes nothing in the comparison. Typical 2 to 3; the local inflation target.
- riskFreeRate: What spare cash earns, % a year, like a savings account or term deposit: the renter's deposit money and each year's surplus are invested at it. Use the local deposit or short government bond rate (about 4 to 5 in Australia in late 2026). With houseGrowth, it moves the answer most.
- horizon: The number of years compared. Use how long the user expects to stay; typical 10 to 30.
- houseGrowth: How fast the home's price grows, % a year. Use a long-run figure for that kind of home in that city, below the boom years: about 3 to 4.5 in Australian capitals, lower for apartments. With riskFreeRate, it moves the answer most.
- sellingCostPct: Selling costs as a % of the sale price (agent, marketing, legal), taken off the home's value as if it were sold. Typical 2 to 3 in Australia, 5 to 7 in the USA.
- initialCash: Cash the user has today. Leave it out unless the user gives it: blank covers the deposit and setup cost, and the renter invests that same amount.
- monthlyBudget: Monthly cash for housing. 0 or blank (the default) is automatic: each year it follows whichever of renting and owning costs more, so both can pay and the cheaper one invests the difference. Set it only when the user gives a budget.
- monthlyBudgetIncrease: How fast a monthly budget the user set grows, % a year. Does nothing while monthlyBudget is automatic.
- showReal: Display only: true shows results in today's money (divided by generalInflation), false in future money. Leave it out.

## Hide

## Quick Starts

There are 33 cities, each with the homes its market really has, from a studio to a 4-bedroom apartment or house. Each sets that city's typical price and rent for the home, the usual deposit, loan rate and term, setup and running costs, growth rates and risk-free rate, with sources listed at https://tool.adjiebrotots.com/rentvsownhouse/quickstart-assumptions/ .

Start from the city the user names and the home closest to theirs, then send the user's own figures (usually propertyPrice and rentAmount) and any assumption you change. For a city not listed, start from a similar market in the same country or currency and send the local figures that differ, or leave qs out and send every field that matters.

## Example

Request: using tool.adjiebrotots.com/rentvsownhouse, please decide which one is better: buy for $850,000 or rent for $620 per week in Melbourne

Link:
- qs=melbourne/house-2br
- propertyPrice=850000
- rentAmount=620
- setupCost=6
- why.setupCost=Victorian stamp duty on $850,000 plus transfer and legal fees
- ownOngoingCost=7000
- why.ownOngoingCost=Rates, insurance and upkeep on an $850,000 house
- note=Melbourne, October 2026, 2-bedroom house

Assumptions:
1. Home: a 2-bedroom house, so the link starts from the Melbourne 2-bedroom house Quick Start (qs=melbourne/house-2br) and keeps its local figures: a {downPaymentPct}% deposit, a mortgage at {mortgageRate}% a year over {mortgageTerm} years, house prices growing {houseGrowth}% a year, rent growing {rentInflation}% a year, spare cash earning {riskFreeRate}% a year, selling costs of {sellingCostPct}% and a {horizon}-year comparison.
2. Setup cost: {setupCost}% of the price, for Victorian stamp duty on $850,000 (about $46,000) plus transfer, registration and legal fees.
3. Ongoing costs of owning: ${ownOngoingCost} a year for council rates, insurance and upkeep, a little under the Quick Start's figure for a dearer home.
4. Ongoing costs of renting: ${rentOngoingCost} a year for contents insurance and moving, from the Quick Start.

## Compact lists

- `ratePeriods=<years>:<rate>,<years>:<rate>,...`
- `ownSetupCosts=<label>:<amount>[:<basis>],...`
- `ownOngoingCosts=<label>:<amount>[:<freq>[:<growth>]],...`
- `rentOngoingCosts=<label>:<amount>[:<freq>[:<growth>]],...`

Each list switches its section to the Detailed mode and becomes that section's whole list. Items are separated by `,` and their parts by `:`, both typed as they are; a label may not contain `:` or `,` (leave them out, or encode them as %3A and %2C). Numbers are plain (6.1, 45070), with no thousands separators. At most 50 items a list.

ratePeriods: the mortgage's rate periods in order, each a length in years and a rate in % a year: `<years>:<rate>` for a fixed rate, `<years>:<low>-<high>` for a floating one, which the tool runs at its low, middle and high rate and draws as a band. The loan term is mortgageTerm, never the sum of the lengths: the last period always runs to the end of mortgageTerm whatever length it is given, a period that would end after the term stops at it, and a period that starts after the term does not count. With ratePeriods, mortgageRate is not used. Rates 0 to 40, lengths 1 to 50 whole years. A 30-year loan fixed at 5.89% for 3 years, then floating between 6.5% and 7.5%:
`ratePeriods=3:5.89,27:6.5-7.5`

ownSetupCosts: the one-off costs at purchase, in place of setupCost. `<basis>` is fixed (an amount, the default) or pct (a % of the price); an amount written with % (4.5%) is pct.
`ownSetupCosts=Stamp duty:45070,Transfer and registration:2600,Legal:1800`

ownOngoingCosts and rentOngoingCosts: the running costs of owning and of renting, in place of ownOngoingCost and rentOngoingCost. `<freq>` is yearly (the default), monthly, weekly or pct: a % of the home's value each year for owning, of the year's rent for renting (an amount written with % is pct too). `<growth>` is how fast that cost grows, % a year, 0 to 30; left out, it is ownOngoingInflation or rentOngoingInflation. A pct cost grows with the home or the rent instead.
`ownOngoingCosts=Council rates:2200,Strata:1450:yearly:3.5,Maintenance:0.5%`
`rentOngoingCosts=Contents insurance:25:monthly,Moving every 3 years:600`

Sending ownSetupCosts alone keeps the ongoing costs of owning at ownOngoingCost, and the other way round. mortgageType or costInterestOnly, which count only in the Detailed mortgage, switch it on as well; with no ratePeriods it then holds one fixed period at mortgageRate for the whole term. On a Quick Start that opens in the Detailed mortgage, mortgageRate sent without ratePeriods replaces the staged schedule with that one fixed rate.

## Json
