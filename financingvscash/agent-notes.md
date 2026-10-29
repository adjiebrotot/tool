# Finance vs Cash: notes for the AI section

Hand-written. `node _ref/agent-doc.mjs` merges these notes with the fields it reads from the
page and writes `financingvscash/agent.txt`, the AI section in `index.html` and the line in
`llms.txt`. Edit here, never the generated text, then run the generator. Text above the first
heading (this) is not published. Same headings as `rentvsownhouse/agent-notes.md`.

## Decides

Whether paying cash for a purchase, or financing it on each loan offer while investing the cash it frees up, leaves you with more money at the end of each loan, and which offer comes out best.

## Most important

- purchaseCost
- availableCash
- offers
- baseRf
- currencySymbol
- offerPricing
- rateConvention

## Fields

- currencySymbol: The currency every amount on the page is in. It only relabels the figures and never converts them, so give every amount in this one currency, the local one for the place (Sydney $, Jakarta Rp, London £).
- purchaseCost: The cash price of the thing being bought, today. Use the user's price. Every loan offer finances this price, less its own down payment.
- offerPricing: Off, every offer pays the cash price. On, each offer carries its own price (priceType and priceValue in offers), for a store that quotes one price for cash and another on a plan. Turn it on only when the offers really differ on price.
- availableCash: The cash the user holds today. It must be at least purchaseCost, or the tool cannot compare and shows a warning instead. Cash left after paying is invested at baseRf, in both the cash and the financing case. Use the user's figure; otherwise a round amount above the price, as the Quick Starts do.
- baseRf: What spare cash earns, % a year, like a savings account or term deposit. Use the local deposit rate for the place and date (about 4 to 5 in Australia and the USA in late 2026, higher in Indonesia and India). With the loan rate it decides the answer.
- rateConvention: How a yearly loan rate becomes a rate per repayment. ear: the yearly rate compounds, the tool's default. nominal: the rate is divided by the repayments in a year, as a US APR or an Indonesian flat quote reads. Use nominal when the lender states the rate per month or per period (the motorbike Quick Start does); otherwise leave it.
- inflationRate: Used only to show results in today's money; it changes nothing in the comparison. Typical 2 to 3, the local inflation target.
- inflationToggle: Display only: true shows results in today's money. Leave it out.
- optTarget: Which offer the Best Strategy tile picks. netBenefit: the one that leaves the most money. lowestInterest: the least interest paid. lowestCost: the least total finance cost. Leave it out unless the user asks for a different ranking.
- chartMetric: Display only: which line the chart draws. Leave it out.

## Hide

- optMetric

## Quick Starts

Six worked comparisons: a house, a car, a phone on a plan, a 0% credit card, an Indonesian motorbike and furniture on a payment holiday. Each sets the purchase cost, cash, rates and loan offers for its case.

Start from the one closest to the user's purchase, then send the user's own figures (purchaseCost, availableCash) and offers for the loans they were quoted. Send offers whenever the user names a loan: it replaces the Quick Start's offers whole. For a purchase none of them fits, leave qs out and send every field that matters.

## Example

Request: should I pay cash for a $45,000 car or take a 5-year loan at 7.9% and invest the cash?

Link:
- qs=car
- purchaseCost=45000
- availableCash=60000
- why.availableCash=The user did not say how much cash they hold, so a round amount above the price, as the car Quick Start assumes
- offers=5-year loan at 7.9%:financeRate=7.9:termYears=5
- why.offers=One loan over 5 years at 7.9% a year, paid monthly with nothing down and no fees, since none were mentioned
- baseRf=4.5
- why.baseRf=A typical savings or term deposit rate for the cash that is invested instead
- note=Car purchase, October 2026

Assumptions:
1. Cash on hand: {availableCash}, which the user did not state, kept at the car Quick Start's level so the cash covers the price.
2. The loan: a single offer over 5 years at 7.9% a year, repaid monthly, with no deposit and no fees because the user mentioned none. It replaces the car Quick Start's three offers.
3. Interest on spare cash: {baseRf}% a year, a typical savings or term deposit rate, used for the cash that is invested instead of spent.

## Compact lists

- `offers=<name>:<field>=<value>:<field>=<value>,<name>:<field>=<value>,...`

The list is the loan offers the tool compares, and it replaces the Quick Start's offers whole. Items are separated by `,`, the name and each field by `:`, both typed as they are; a name may not contain `:`, `,` or `=` (leave them out). Each field is `<field>=<value>`, in any order, and a field left out takes the default of a new offer. Numbers are plain (7.9, 45070), with no thousands separators. At most 12 offers. The first offer is the one the editor shows.

Fields of an offer (the names an offer is saved under):
`loanType`: annuity (the default: equal repayments that clear the loan), flat (interest on the original amount, rate quoted per period), interestOnly (interest only for ioPeriods, then the principal), balloon (equal repayments with residualPct of the loan left to pay at the end), knownPayment (only the repayment is quoted and the tool solves the rate), bullet (all interest and principal in one lump at the end), deferred (nothing paid for ioPeriods, interest added to the debt, then equal repayments).
`freq`: weekly, fortnightly, monthly (the default) or yearly. How often repayments fall.
`termPeriods`: the number of repayments, 1 to 3000, so 60 is five years when monthly. Or use termYears, the term in years, turned into repayments for freq; with both, termPeriods wins. Left out, the term is five years.
`financeRate`: the loan's rate, % a year, 0 to 30 (default 5). Not used for knownPayment.
`downPaymentPct`: the deposit, % of the offer's price, 0 to 100 (default 0). The rest is the loan.
`feeAmt` and `feeType`: an origination fee, an amount (feeType=fixed, the default) or a % of the loan (feeType=pct); an amount written with % (3%) is pct. feeTreatment: upfront (paid from cash, the default), capitalise (added to the loan) or discount (deducted from the advance).
`adminFee`: a fixed fee on every repayment, 0 to 1000000000 (default 0).
`knownPayment`: the repayment each period, for knownPayment only.
`ioPeriods`: repayments before normal instalments begin, for interestOnly and deferred; default the whole term. The holiday of a deferred start.
`residualPct`: the share of the loan left to pay at the end, 0 to 99, for balloon only.
`priceType` and `priceValue`: this offer's own price, used only when offerPricing=true. priceType amount: priceValue is an amount. pct: a % of the cash price. discount (the default): a % off the cash price. Send offerPricing=true with them.
`ratePeriods`: a rate schedule in place of financeRate, for every type but flat and knownPayment: `<to>@<rate>/<to>@<low>-<high>/...`. Each period ends at repayment number `<to>`, counted from the first repayment (a payment holiday included) and in repayments of freq, not years; `<low>-<high>` is a floating rate, which the tool runs at its low, middle and high rate and draws as a band. The last period always runs to the end of the term, whatever its `<to>`. Rates 0 to 40. A 30-year monthly loan fixed at 5.8% for 2 years, then floating between 5% and 8.5%: `30yr fixed then variable:termPeriods=360:ratePeriods=24@5.8/360@5-8.5`
`paymentPeriods`: a repayment schedule in place of knownPayment, for knownPayment only: `<to>@<amount>/<to>@<amount>/...`, ends counted as in ratePeriods, the last running to the end of the term.

A 36 month loan at 8.4% with 10% down and a 400 fee, against a 60 month one at 9%:
`offers=3yr loan:financeRate=8.4:termPeriods=36:downPaymentPct=10:feeAmt=400,5yr loan:financeRate=9:termYears=5:downPaymentPct=10:feeAmt=400`
A store plan that quotes only the instalment, 24 payments of 82 on an 1800 purchase:
`offers=24 x 82:loanType=knownPayment:knownPayment=82:termPeriods=24`

## Json
