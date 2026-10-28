# DCA Scenario Explorer: notes for the AI section

Hand-written. `node _ref/agent-doc.mjs` merges these notes with the fields it reads from the
page and writes `dcasimulator/agent.txt`, the AI section in `index.html` and the line in
`llms.txt`. Edit here, never the generated text, then run the generator. Text above the first
heading (this) is not published. Same headings as `rentvsownhouse/agent-notes.md`.

The scenarios are not form fields, so they arrive as compact keys (`tickers`, `amount`,
`yearlyIncrease`, `style`, `dayOrDate`, `period`, `momentumPct`). The adapter is in
`dcasimulator/script.js` (search for "AI assistant links"). A link adds no network call of its
own: the page runs the simulation once and loads prices through the existing Worker.

## Decides

How a plan of regular purchases (dollar cost averaging) would have gone on past prices. Each scenario is one real ticker bought on one schedule, such as $500 a month into SPY, and the tool shows what was put in, what it was worth at the end, the return and the risk, with the scenarios side by side. Compare tickers, schedules or buying rules over any past date range.

## Most important

- tickers
- amount
- startDate
- endDate
- style

## Fields

- tickers: The real tickers to simulate, one scenario each, as Yahoo Finance spells them (SPY, VOO, QQQ, BRK-B, BTC-USD, AAA.AX for the ASX, BBCA.JK for Jakarta). Use the ticker for the fund or stock the user names, not its company name. Left out, the page keeps its two simulated example assets, which compare nothing real, so almost every link should send tickers. Syntax under Compact lists.
- amount: The money invested at each purchase, in the currency. It is per purchase, so for a weekly style it is the weekly amount. Use the user's figure; if they give a yearly or monthly total for a weekly style, divide it yourself and say so in why.
- yearlyIncrease: Raises the amount once a year, compounding: 10 makes year 2 +10% and year 3 +21%. Only when the user says their contributions grow. Left out, the amount stays flat.
- style: How each purchase date is chosen, one of: monthly-date (the default, one fixed day a month), weekly-day (one fixed weekday a week), momentum-peak (buy once the price has risen by momentumPct from the period open), momentum-dip (buy once it has fallen by momentumPct), tech-ma-cross (moving-average crossover), tech-rsi (RSI oversold), tech-bollinger (lower Bollinger Band), tech-macd-cross (MACD crosses up), tech-macd-hist (MACD histogram turns positive), tech-adx (strong trend only). The technical styles run on the tool's usual indicator settings. monthly-top, monthly-bottom, weekly-top and weekly-bottom buy on the best or worst price day of the period; they need hindsight and the tool marks them as demonstration only, so use them only when the user asks. For a plain "invest every month" leave style out.
- dayOrDate: For monthly-date, the day of the month, 1 to 31 (the tool buys on the trading day nearest to it). For weekly-day, the weekday, 1 (Monday) to 7 (Sunday), or its name. Left out, 1.
- period: For the momentum and technical styles only, how often at most they buy: monthly or weekly. Left out, monthly.
- momentumPct: For momentum-peak and momentum-dip only, the rise or dip in % from the period open that triggers a purchase, 0.1 to 50. Left out, 5.
- currencySymbol: The symbol amounts are shown in. It only relabels the figures and never converts them, so give amount in the currency of the tickers (a US ticker in $, an ASX ticker in $ too, BBCA.JK in Rp).
- startDate: The first day of the run, YYYY-MM-DD. Left out, the page opens on the day five years before today. "From 2015" is 2015-01-01. The run covers only the dates every ticker has prices for, so a ticker listed later trims the window for all of them.
- endDate: The last day of the run, YYYY-MM-DD. Left out, the page opens on today, so leave it out for "until now". Send it only for a run that ended in the past.
- randomSeed: Only for simulated assets, which a link does not create. Leave it out.
- execTiming: When a decision turns into a trade: close is the same day's close, next-open is the next trading day's open (the tool's default), next-close is the next day's close. Leave it out unless the user cares about order timing.
- riskFreeRate: The yearly return with no risk, % a year, used for the Sharpe and Sortino ratios only. Left out, 4. Use the local cash or short-term bond rate if the user asks about risk-adjusted returns.

## Hide

- tickerPoolInput
- simNameInput
- simReturnInput
- simStdInput
- cfgName
- cfgColor
- cfgAmount
- cfgYearlyInc
- cfgAssetSelect
- secStyle2
- secDay2
- showAdvancedToggle
- optMetric
- showCandleToggle
- showBuyDateToggle
- showTechToggle
- showDepositedToggle
- detailSelect

## Quick Starts

Three worked comparisons on real tickers: the same ticker bought monthly against weekly, an equity ETF against a money market fund, and a single stock against an index ETF. Each sets only the scenarios.

Start from the one closest to the user's question only when it fits (the same ticker on two schedules, or two tickers on one schedule). Then send the user's own tickers, amount and dates. tickers in the link replaces the Quick Start's scenarios; amount, yearlyIncrease, style, dayOrDate, period and momentumPct replace that setting on every scenario, including the Quick Start's own. For anything else leave qs out and send tickers.

## Example

Request: I want to put $500 a month into VOO and QQQ from 2015 to now; how would it have gone?

Link:
- tickers=VOO,QQQ
- why.tickers=The two funds the user named, each as its own scenario so they can be compared
- amount=500
- why.amount=The user's $500, invested once a month
- startDate=2015-01-01
- why.startDate=The user said from 2015, so the first day of that year
- note=VOO and QQQ, monthly from 2015 to now

Assumptions:
1. Tickers: VOO and QQQ, one scenario each, with the same plan, because the user named the two funds.
2. Schedule: 500 invested on the 1st of every month, the tool's default day, since the user gave no day.
3. Start date: {startDate}, the first day of 2015.
4. End date: left out, so the tool uses today, which is what "to now" means.
5. Currency: the default $, since both funds trade in US dollars.

## Compact lists

- `tickers=<TICKER>[:<setting>=<value>...],<TICKER>[:<setting>=<value>...],...`
- `amount=<number>`
- `yearlyIncrease=<number>`
- `style=<name>`
- `dayOrDate=<number or weekday>`
- `period=monthly|weekly`
- `momentumPct=<number>`

tickers is the scenarios, one real ticker each, separated by `,`. A ticker is capital letters, digits and `. ^ = _ -`, up to 24 (SPY, BRK-B, ^GSPC, AAA.AX, EURUSD=X); anything else is refused and named in the banner. At most 6, and the first 6 are used. All scenarios share the plan keys amount, yearlyIncrease, style, dayOrDate, period and momentumPct when the link names them; a scenario takes its own value for any of them, and a `name`, by writing `:<setting>=<value>` after its ticker. A scenario left alone takes the tool's defaults: 500 a month on the 1st, no yearly increase, monthly-date. Two scenarios on the same ticker are named by their style unless you give a name; a name is up to 40 characters and may not contain `:` or `,`.

Settings in a ticker item: `amount`, `yearlyIncrease`, `style`, `dayOrDate`, `period`, `momentumPct`, `name`.

SPY bought monthly against weekly, with 520 a month and 120 a week:
`tickers=SPY:amount=520:style=monthly-date,SPY:amount=120:style=weekly-day`
VOO monthly against buying the dip, 500 each:
`tickers=VOO:style=monthly-date,VOO:style=momentum-dip:momentumPct=5&amount=500`
Two funds on the same plan, 750 a month, rising 5% a year:
`tickers=VOO,QQQ&amount=750&yearlyIncrease=5`

## Json
