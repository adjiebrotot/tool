# Financial Freedom: notes for the AI section

Hand-written. `node _ref/agent-doc.mjs` merges these notes with the fields it reads from the
page and writes `financialfreedom/agent.txt`, the AI section in `index.html` and the line in
`llms.txt`. Edit here, never the generated text, then run the generator. Text above the first
heading (this) is not published. Same headings as `rentvsownhouse/agent-notes.md`.

## Decides

The earliest age the user can stop work and still have the money last to their life expectancy (or leave a set amount, or never touch the capital), given what they save, spend and hold, and how likely the plan is to hold when returns vary.

## Most important

- ageNow
- assets
- savings
- savingsPeriod
- savingsMode
- expense
- expensePeriod
- currency
- assetPreset
- ret
- std
- inflation
- ageDie
- retireExpense
- retireExpensePeriod
- ffmode

## Fields

- currency: The currency every amount on the page is in. It only relabels the figures and never converts them, so give every amount in this one currency, the local one for the place. Send the symbol, which is the option's value ($, €, £, Rp, RM, ¥, ₹ and so on from the list), not the name beside it. A code such as AUD is read as the symbol it stands for, but send the symbol. One symbol can stand for several currencies: $ is the Australian, US and Singapore dollar.
- ageNow: The user's age today, in whole years.
- ageDie: How long the money has to last, the life expectancy the plan is run to. Use the user's figure; otherwise 90, which most Quick Starts use (88 to 92). The Die Rich goal ignores it.
- savings: Per the period in savingsPeriod, and what it is depends on savingsMode: the amount put aside each period, or the user's take-home pay. There is no tax model, so give pay after tax and returns after fees. Use the user's own figure.
- savingsPeriod: The period savings is per. Send it with savings whenever the user's figure is weekly or monthly.
- growth: How fast savings (or net income) grows each year, before inflation: pay rises. The Quick Starts use 2 to 3. At the inflation rate it holds its value in today's money; below it, it shrinks.
- pensionOn: A government or age pension, counted as income from its start age. Turn it on only when the user has one or asks for one. It counts only while Money in is Simple (incomeMode); with Detailed, give the pension as an inStages item. The Late start Quick Start has one.
- pensionStartAge: The age the pension starts, 40 to 90. The Late start Quick Start uses 67.
- pensionAmount: What the pension pays today, per the period in pensionPeriod. The Late start Quick Start uses about 29,000 a year, the Australian single full rate.
- pensionPeriod: The period pensionAmount is per. Send it with pensionAmount whenever the user's figure is weekly or monthly.
- pensionIndexed: Whether the pension rises with inflation, so it holds its value. On for most government pensions.
- expense: What the user spends to live now, in today's money, per the period in expensePeriod. Retirement spending is a share of it unless retireExpense is an amount. Use the user's figure; otherwise a typical spend for their place and household, and say so.
- expensePeriod: The period expense is per. Send it with expense whenever the user's figure is weekly or monthly.
- retireExpense: What the user spends once work stops: a % of living expenses (retireExpensePeriod pct, the default; 100 is no change) or an amount per period in today's money. Leave it at the Quick Start's figure unless the user expects their spending to change. The Geoarbitrage Quick Start uses 40 for a cheaper country.
- retireExpensePeriod: pct: retireExpense is a % of living expenses. weekly, monthly, yearly: it is an amount in today's money, not following the living expenses. Send it with retireExpense whenever the user gives an amount.
- assets: What the user already holds that earns the return below: shares, funds, super or a 401(k), savings. Not the home they live in. Use the user's figure; 0 if they hold nothing.
- assetPreset: Picks a long-run return and volatility from history. Sending a preset other than custom fills ret and std with its figures, unless the link also sends them. custom: send the user's own ret and std. cash, bonds, us, asx, world and gold are starting points; world, a global diversified share portfolio, is what most Quick Starts use.
- ret: The compound return the user expects, % a year, before inflation and after fees. Send it only with assetPreset=custom or to override a preset's figure.
- std: How much the return bounces from year to year, % a year. 0 draws one smooth projection. Send it only with assetPreset=custom or to override a preset's figure.
- ffmode: The goal for the money. die: it runs out at life expectancy (Just Die). legacy: the amount in legacy is left at life expectancy (Leave a Legacy). rich: only real growth is ever spent, so the capital lasts for ever (Die Rich), the dearest goal. Use die unless the user wants to leave money behind or never touch the capital.
- legacy: The amount to leave at life expectancy, in today's money. Used only with ffmode=legacy.
- inflation: Price rises, % a year. Use the local inflation target, 2 to 3 in most rich countries (the Quick Starts use 2.5, and 3 where costs rise faster).
- chance: How cautious the Investment outcome line is: a balance reached or beaten in at least this share of futures. 50, the default, is the expected return. Leave it out unless the user asks for a more cautious projection.
- confidence: The share of futures the confidence pot has to survive. Leave it out unless the user asks.
- showReal: Display only: true shows figures in today's money, false in the money of each year. Leave it out.
- ageRetire: The age the user stops work. Leave it out unless the user names an age to test. Left out, the tool opens on the earliest age the plan works, which is its answer, and that is not the Default printed here (the page's own start). Any whole age from ageNow to ageDie.

## Hide

- incomeNowName

## Quick Starts

Six worked plans, each filling every tab: a 32-year-old saving from take-home pay, a lean saver at 28 on net income with stages for a hustle and a relax age and an age pension, earning in Australia and retiring in Bali, a high earner under the Die Rich goal, a couple with two kids as life stages who want to leave a legacy, and a 52-year-old with a pension.

Start from the one closest to the user, then send the user's own figures (usually ageNow, assets, savings with savingsPeriod, expense) and any assumption you change. A Quick Start also sets the switches and stages shown under Quick Start figures; send savingsMode, expenseMode or incomeMode to change them. Frugal, fatfire and legacy count savings as take-home pay (savingsMode=income), so a user who gives an amount saved needs savingsMode=savings. For a user none of them fits, leave qs out and send every field that matters.

## Example

Request: I'm 35 in Perth, I have $180k invested and save $3,000 a month; when can I retire?

Link:
- qs=moderate
- ageNow=35
- assets=180000
- savings=3000
- savingsPeriod=monthly
- expense=60000
- why.expense=The user did not say what they spend, so a round figure for one person living in Perth
- note=Perth, October 2026, saving 3,000 a month

Assumptions:
1. Living expenses: {expense} a year, a round figure for one person in Perth since the user did not say what they spend. It replaces the Moderate FIRE Quick Start's 65,000.
2. Savings: the 3,000 a month is an amount put aside, not pay, growing {growth}% a year as in the Quick Start.
3. Returns: the 180,000 invested earns {ret}% a year with {std}% volatility (the global diversified share preset), before inflation and after fees.
4. From the Quick Start: life expectancy {ageDie}, inflation {inflation}% a year, spending of {retireExpense}% of living expenses once work stops, and the goal Just Die, with no stages and no pension. The retirement age is left for the tool to find.

## Compact lists

- `savingsMode=<savings|income>`
- `incomeMode=<simple|detailed>`
- `expenseMode=<simple|detailed>`
- `stages=<name>:<field>=<value>:<field>=<value>,<name>:...`
- `inStages=<name>:<field>=<value>:<field>=<value>,<name>:...`

savingsMode, incomeMode and expenseMode are not form fields: they are the page's switches. A value may also be the words the page shows (Net income, Detailed).

savingsMode: what savings is. savings (the default): the amount put aside each period. income: the user's take-home pay each period; the tool takes the living expenses off it to find the saving, so spending less also raises what is saved.

incomeMode: Simple is one savings or income figure with the pension fields. Detailed turns Money in into a list of stages by age (inStages), and the pension fields are then not used: give a pension as an inStages item with keeps=true. expenseMode: Simple is living expenses and retireExpense. Detailed turns Money out into a list of stages by age (stages). Sending a stages or inStages list switches its section to Detailed, and an empty list switches it back to Simple; send the switch yourself to override that. Simple keeps any rows it has but does not use them.

The two lists replace the Quick Start's rows whole. Items are separated by `,`, the name and each field by `:`, both typed as they are; a name may not contain `:`, `,` or `=` (leave them out). Each field is `<field>=<value>`, in any order. Numbers are plain (80, 29000), with no thousands separators. At most 12 items. List the stages in age order: they never overlap, and a start earlier than the stage above's end is moved up to it. A stage replaces the baseline for its ages, so it holds the whole figure for those years, not the difference.

Fields of both lists:
`from` and `to`: ages in years, 0 to 120. A blank or missing `from` begins where the stage above ended (at 0 for the first). A blank or missing `to` runs to life expectancy; 120 means for life.
`amount` (required): the figure for the stage, 0 or more, in today's money.

stages (Money out, with expenseMode detailed): spending during a stretch of life, such as kids at home. The baseline is the living expenses before work stops and the retirement expenses after, and a stage replaces it for its ages. Other field: `period`: pct (the default; `amount` is a % of living expenses, up to 1000), weekly, monthly or yearly (`amount` is that amount per period).
`stages=1st kid:from=34:to=36:amount=125,2nd kid:from=36:to=54:amount=150,1st kid leaves:from=54:to=56:amount=125`
`stages=Relax age:from=40:to=55:amount=4500:period=monthly`

inStages (Money in, with incomeMode detailed): a stretch of life that pays differently. The baseline is savings, grown at growth, and a stage replaces it for its ages; `amount` is in the same terms as savings (take-home pay when savingsMode=income). Other fields: `period`: weekly, monthly or yearly (the default). `growth`: how fast it grows, % a year before inflation, from today, -10 to 30 (default the growth field). `keeps`: true if it is still paid once the user stops work (a pension, rent, part-time work), false (the default) if it ends when work does.
`inStages=Part-time:from=45:to=55:amount=20000:keeps=true,Age pension:from=67:to=120:amount=29000:growth=2.5:keeps=true`

Switching a section to Detailed with no list (incomeMode=detailed alone) leaves its list as the Quick Start had it, empty for most.
