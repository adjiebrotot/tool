# DCA Portfolio: notes for the AI section

Hand-written. `node _ref/agent-doc.mjs` merges these notes with the fields it reads from the
page and writes `dcasimulator/portfolio/agent.txt`, the AI section in `index.html` and the line
in `llms.txt`. Edit here, never the generated text, then run the generator. Text above the first
heading (this) is not published. Same headings as `rentvsownhouse/agent-notes.md`.

The portfolios are not form fields, so they arrive as compact keys p1 to p6. The portfolio
fields (topupAmount ... lookbackMonths) are the Persist handles of the controls that show the
active portfolio; a link applies the ones it names to every portfolio. The adapter is in
`dcasimulator/portfolio/script.js` (search for "AI assistant links"). A link adds no network call
of its own: the page runs the simulation once and loads prices through the existing Worker.

## Decides

How portfolios of several real tickers would have gone on past prices when money is added on a schedule (top-ups) and the holdings are kept to target weights by a chosen rebalancing method. Each portfolio is a mix such as 60% VOO and 40% BND, and the tool shows what was put in, what it was worth at the end, the return and the risk, with the portfolios side by side. Compare mixes, rebalancing methods or schedules over any past date range.

## Most important

- p1
- p2
- topupAmount
- startDate
- endDate
- rebalMethod

## Fields

- p1: The first portfolio: its tickers and their weights in %, as Yahoo Finance spells the tickers (VOO, BND, QQQ, BRK-B, AAA.AX for the ASX). Weights add to 100 for every method but dynamic-momentum, or the tool shows a warning and does not run. Syntax under Compact lists. A link with no portfolios keeps the page's two simulated example portfolios, which compare nothing real, so almost every link should send p1.
- p2: The second portfolio, same syntax as p1. Send p2 to p6 only when the user compares portfolios; each is another line on every chart.
- topupAmount: The money added at each top-up, in the currency, once for every topupPeriod, so a monthly top-up of 1,000 is 1000 with topupPeriod monthly. The page's own start is 5,000, so always send the user's figure. Applies to every portfolio, unless a portfolio's list names its own.
- topupYearlyInc: Raises the top-up once a year, compounding: 10 makes year 2 +10% and year 3 +21%. Only when the user says their contributions grow. Left out, flat.
- topupPeriod: How often money is added: weekly, fortnightly, monthly (the default, on the 1st), quarterly or yearly. The amount is per top-up in this period, so it is not converted when you change the period.
- rfRate: What idle cash earns while it waits to be invested, % a year. Left out, 0. Use the local savings or money market rate if the user mentions it.
- rebalMethod: How top-ups and holdings are kept to the target weights. towards-weight (the default): top-ups only buy what is underweight, nothing is sold. constant-weight: buys and sells to hold the target weights, timed by cwTiming. constant-allocation: every top-up is split by the weights, nothing is sold. dynamic-momentum (Trend Following) and rule-trigger (Rule-Based Triggers) run on the tool's default rank weights and triggers, which a link cannot set, so use them only if the user asks for them by name.
- cwTiming: Only for constant-weight. at-topup (the default): a full rebalance on every top-up. schedule: top-ups wait in the cash account until the rebalance runs on its own rebalPeriod.
- rebalPeriod: Only for constant-weight with cwTiming schedule: how often the rebalance runs. Left out, quarterly. It runs on the 1st.
- buyFee: The fee charged on every purchase, % of the trade. The page's start is 0.1. Use the user's broker fee if they give one, else leave it.
- sellFee: The fee charged on every sale, % of the trade. The page's start is 0.1. It matters only for methods that sell.
- lookbackMonths: Only for dynamic-momentum: how far back each asset's return is measured to rank it, in months. Left out, 6.
- currencySymbol: The symbol amounts are shown in. It only relabels the figures and never converts them, so give topupAmount in the currency of the tickers.
- startDate: The first day of the run, YYYY-MM-DD. Left out, the page opens on the day five years before today. "From 2012" is 2012-01-01. The run covers only the dates every ticker has prices for, so a ticker listed later trims the window for all of them.
- endDate: The last day of the run, YYYY-MM-DD. Left out, the page opens on today, so leave it out for "until now". Send it only for a run that ended in the past.
- randomSeed: Only for simulated assets, which a link does not create. Leave it out.
- execTiming: When a decision turns into a trade: close is the same day's close, next-open is the next trading day's open (the tool's default), next-close is the next day's close. Leave it out unless the user cares about order timing.

## Hide

- tickerPoolInput
- simNameInput
- simReturnInput
- simStdInput
- assetPoolSelect
- topupScheduleBox_dom
- rfMode
- rfTicker
- wt1
- wt2
- reserveSelect
- rebalScheduleBox_qs
- rebalScheduleBox_dom
- showAdvancedToggle
- optMetric
- showTopupsToggle
- detailPfSelect
- priceCandleToggle
- priceBuyDateToggle
- priceTechToggle

## Quick Starts

Three worked comparisons of two portfolios on real tickers: a growth against a conservative mix, rebalancing monthly against quarterly, and holding constant weights against splitting every top-up by the weights. Each sets the portfolios, the top-up and the rebalancing method.

Start from the one closest to the user's question only when it fits. Then send the user's own tickers and weights as p1, p2 (they replace the Quick Start's portfolios), and their topupAmount and dates. A portfolio field named on its own, such as topupAmount, replaces that setting on every portfolio, including the Quick Start's own. For anything else leave qs out and send p1, p2.

## Example

Request: compare a 60/40 and an 80/20 mix of VOO and BND, putting in $1,000 a month from 2012 and rebalancing every quarter

Link:
- p1=VOO:60,BND:40
- why.p1=The 60/40 mix the user named, VOO for shares and BND for bonds
- p2=VOO:80,BND:20
- why.p2=The 80/20 mix the user named, with the same two funds
- topupAmount=1000
- why.topupAmount=The user's $1,000, added once a month
- topupPeriod=monthly
- rebalMethod=constant-weight
- why.rebalMethod=Rebalancing means buying and selling to hold the target weights
- cwTiming=schedule
- rebalPeriod=quarterly
- why.rebalPeriod=The user said every quarter
- startDate=2012-01-01
- why.startDate=The user said from 2012, so the first day of that year
- note=VOO and BND, 60/40 against 80/20, from 2012 to now

Assumptions:
1. Funds: VOO for shares and BND for bonds. The user named no funds, so these common US index funds stand for the two.
2. Top-up: {topupAmount} on the 1st of every month into both portfolios, since the user gave no day.
3. Rebalancing: constant-weight on its own quarterly schedule ({cwTiming}), which is how the user's "rebalancing every quarter" is read.
4. Start date: {startDate}, the first day of 2012. The end date is left out, so the tool uses today.
5. Fees and cash: the page's own 0.1% buy and sell fees and no interest on idle cash, since the user mentioned none.

## Compact lists

- `p1=<TICKER>:<weight>,<TICKER>:<weight>,...[,<setting>=<value>...]`
- `p2`
- `p3`
- `p4`
- `p5`
- `p6`

p1 to p6 are the portfolios, in order, each its own key with the same syntax. Items are separated by `,`: a ticker, then `:` and its weight in % (`VOO:60`; 60% or 60.5 work), or a setting as `<setting>=<value>`. A ticker is capital letters, digits and `. ^ = _ -`, up to 24 (VOO, BRK-B, AAA.AX); anything else is refused and named in the banner. At most 10 tickers in a portfolio and 6 portfolios. Give every ticker a weight, or none: with none, the weights split equally. The weights should add to 100. The portfolios in the link replace the Quick Start's whole.

Settings inside a portfolio's list: `name` (up to 40 characters, no `:` or `,`; left out, the portfolio is named by its tickers and weights), and any of the portfolio fields topupAmount, topupYearlyInc, topupPeriod, rfRate, rebalMethod, cwTiming, rebalPeriod, buyFee, sellFee, lookbackMonths with the values they take as fields. A setting inside a list is for that portfolio only and beats the same field named on its own.

VOO and BND at 60/40 against 80/20, 1000 a month:
`p1=VOO:60,BND:40&p2=VOO:80,BND:20&topupAmount=1000`
The same mix rebalanced monthly against quarterly:
`p1=VOO:50,BND:50,name=Monthly,rebalMethod=constant-weight,cwTiming=schedule,rebalPeriod=monthly&p2=VOO:50,BND:50,name=Quarterly,rebalMethod=constant-weight,cwTiming=schedule,rebalPeriod=quarterly&topupAmount=1000`
Three funds split equally, 500 a week:
`p1=VOO,QQQ,BND&topupAmount=500&topupPeriod=weekly`

## Json
