# Borrowing Capacity: notes for the AI section

Hand-written. `node _ref/agent-doc.mjs` merges these notes with the fields it reads from the
page and writes `borrowingcapacity/agent.txt`, the AI section in `index.html` and the line in
`llms.txt`. Edit here, never the generated text, then run the generator. Text above the first
heading (this) is not published. The headings are the same for every tool; see
`rentvsownhouse/agent-notes.md` for what each one holds.

This tool keeps its applicants and debts as plain fields (a count of adults, an income split, one
box and its figures per kind of debt), so it has no row lists. The only state beyond the fields
is the five Simple / Detailed switches, which the adapter in `script.js` reads as the keys under
Compact lists.

## Decides

How much an Australian lender would lend for a home, from the applicants' income, household, debts and the loan's rate and term, as the smallest of four limits (serviceability, debt to income, loan to value and the deposit), which limit holds it down, and whether that covers the price entered.

## Most important

- incSimple
- incSplit
- adults
- deps
- city
- declaredExp
- price
- savings
- dutyPct
- cardLimit
- persRepay
- helpMode
- prodRate
- termYears

## Fields

- incSimple: Gross income a year before tax, for all applicants together, excluding employer super. Add the applicants up ($120,000 and $85,000 is 205000). For a self-employed applicant it is the two-year average profit after tax plus add-backs. It counts while incMode is simple; the streams below count in Detailed.
- incSplit: The second applicant's share of the household income, in %, 0 to 50 in steps of 5 (the slider lands on the nearest step). Used only with 2 adults; it changes the tax, since two applicants are two taxpayers. Send the lower earner's share: $85,000 of $205,000 is about 41, so 40. Send 0 when one applicant earns nearly all of it.
- adults: How many people are on the loan, 1 or 2.
- deps: Children or others who rely on the income, 0 to 6. Each one raises the living costs a lender assumes. Use what the user said; with no mention, 0.
- city: Sets the lender's living-cost benchmark (HEM) by local cost of living. Use the city nearest the home; Regional for other Australian places.
- declaredExp: The user's own living costs a month, excluding rent and every debt repayment. The lender uses the higher of this and its HEM benchmark, so a low figure does not raise the result. Typical 2,500 to 5,500 by household; use a figure for the household if the user gives none.
- privHealth: Private hospital cover. false adds the Medicare Levy Surcharge once income passes the threshold. Leave it on unless the user says they have none.
- taxYear: The resident tax year whose lowest bracket applies. Use the year the user is applying in.
- helpMode: A study loan (HELP or HECS): none, tax (repayments come off as tax) or commitment (counted as a debt). Leave it at none unless the user has one.
- helpThreshold: The income above which the study loan repays, a year. Used only when helpMode is not none; indexed yearly.
- price: The price of the home. Use the user's price; otherwise a typical price for the kind of home and the city, which the borrower would shop for.
- depositMode: amount: savings is all the cash the user has for the purchase, and stamp duty and other costs come out of it first. pct: depositPct is the deposit as a % of the price, with the costs paid on top. Send it with savings or depositPct.
- savings: Used when depositMode is amount. Savings, a family gift and any grant. 
- depositPct: Used when depositMode is pct.
- dutyMode: pct: dutyPct is a % of the price. amount: dutyAmt is the dollar duty. Send it with dutyPct or dutyAmt.
- dutyPct: Stamp duty as a % of the price, for the state and price. About 4 to 5.5 in NSW and Victoria for a $0.9M to $1.4M home, 3.5 to 4 in WA and Queensland, 4.5 to 4.8 in South Australia. Each Quick Start holds its state's figure. First home buyer concessions can make it 0.
- dutyAmt: Used when dutyMode is amount.
- otherCosts: Conveyancing, transfer and registration, building and pest. About 4,000 on a standard purchase.
- lmiCap: Lenders Mortgage Insurance. On lets the loan go past 80% of the price, up to 95%, with the premium added to the loan. Needed when the deposit is under 20% of the price.
- lmiRate: The premium as a % of the loan. Used only with lmiCap on.
- hasInvest: Tick if the household has rental income, dividends or an investment property. Its figures are ignored while it is off.
- hasGov: Tick for Family Tax Benefit, a pension or child support received. Its figures are ignored while it is off.
- hasHomeLoan: Tick for another home or investment loan. Its figures are ignored while it is off.
- hasCard: Tick for a credit card or line of credit. On by default. Its limit is ignored while it is off, so send false with no card.
- hasPersonal: Tick for a personal or car loan. Its figures are ignored while it is off.
- hasBnpl: Tick for buy now pay later. Its figures are ignored while it is off.
- hasSupport: Tick for child support or maintenance paid. Its figure is ignored while it is off.
- hasRefi: Tick for a facility closing or refinanced at settlement. Its figures are ignored while it is off.
- cardLimit: The total limit of all credit cards and lines of credit, not the balance. A card never used still counts. Typical 5,000 to 25,000 for a household.
- persRepay: Monthly repayments on personal and car loans. Send persBal with it.
- persBal: Total balance of personal and car loans. It feeds the debt-to-income limit only.
- bnplRepay: Monthly buy now pay later instalments. Send bnplLimit with it.
- bnplLimit: Total buy now pay later limits. It feeds the debt-to-income limit only.
- olBal: Total balance of the other home and investment loans. Send olRate with it.
- olRate: The rate paid today on those loans, % a year. The lender reassesses it at the higher of this plus the buffer and its floor.
- olTerm: Years left on those loans. Shown in the Detailed debts view.
- olType: pi (principal and interest) or io (interest only), for those loans. Shown in the Detailed debts view.
- olIo: Years of interest only left. Used only when olType is io.
- csOut: Child support or maintenance paid a month. Send hasSupport with it.
- refiRepay: Monthly repayments on a facility closed at settlement; they come off the commitments. Send refiBal with it.
- refiBal: Balances of the facilities closed at settlement.
- occupancy: owner (moves in) or investor (still pays rent or board after settlement, which counts as a commitment).
- rentBoard: Rent or board paid a month after settlement. Used only when occupancy is investor.
- newPropCosts: Strata, rates and insurance a month on the new home. Typical 250 to 500 for a house, more for an apartment.
- ipOut: Investment property outgoings a month that the rental shading does not already cover. Leave at 0 if rent is shaded at 70 to 80.
- prodRate: The interest rate the user would be offered on the new loan, % a year. The lender tests at the higher of this plus buffer and its floor rate, so the tested rate is higher than this one. Use the user's offered rate; otherwise a going variable owner-occupier rate for the date.
- termYears: Years the new loan runs. Typical 30.
- hasIo: Interest only to start. On shortens the term the lender tests over by newIo years.
- newIo: Years of interest only on the new loan. Used only with hasIo on.
- buffer: The serviceability buffer the lender adds to the rate, in percentage points. 3 is the APRA rule; leave it unless the user names a lender's policy.
- floorRate: The lender's minimum test rate, % a year. Typical 5 to 5.75; leave it unless the user names a lender's policy.
- umiReq: The monthly surplus the lender insists on after everything. Typical 0 to 500.
- nsrMin: The minimum income cover (net service ratio), 1 to 1.2. Typical 1 to 1.1.
- cardPct: The monthly repayment charged on a card limit, % of the limit. Lenders use 3 to 3.8.
- dtiCap: The most the lender allows in total debt as a multiple of gross income. 6 is the reporting line; strict lenders use 4.5 to 5.5. Shown in the Detailed purchase view.
- dtiBasis: gross (raw income) or assessable (the shaded income, which is stricter). 
- lvrMax: The most the lender lends as a % of the home's value. 80 avoids LMI; up to 95 with it. Used only in the Detailed purchase view; the Simple view uses 80, or 95 with lmiCap on.
- valuation: What the bank values the home at. The lower of price and valuation sets the loan to value limit. Used only in the Detailed purchase view; the Simple view uses the price.
- incPayg: Employee base salary a year. Counts only in Detailed income.
- incOvertime: Overtime a year (Employee, Detailed). Needs 6 to 12 months of history.
- incBonus: Bonus or commission a year (Employee, Detailed). Lenders shade it to 50 to 80%.
- incAllow: Non-reimbursable allowances a year (Employee, Detailed).
- incCasual: Casual or second job income a year (Employee, Detailed).
- incSeNpat: Two-year average profit after tax (Self-employed, Detailed).
- incSeAdd: Add-backs a year: depreciation, one-offs, director wages paid to you (Self-employed, Detailed).
- shdPayg: The share of the base salary the lender counts, %. 100 for salary.
- shdOvertime: The share of overtime the lender counts, %. Typically 80.
- shdBonus: The share of a bonus the lender counts, %. 50 to 80.
- shdAllow: The share of allowances the lender counts, %. 80 to 100.
- shdCasual: The share of casual income the lender counts, %. 80 to 100.
- shdSe: The share of self-employed profit the lender counts, %. 100 for an established business.
- incRent: Gross rental income a year. Send hasInvest with it. The shading in shdRent covers vacancy and costs, so do not deduct those.
- shdRent: The share of rent the lender counts, %. 70 to 80.
- incDiv: Cash dividends a year. Send hasInvest with it.
- shdDiv: The share of dividends the lender counts, %. Typically 80.
- frankPct: The franked share of the dividends, %. 100 for fully franked.
- ipCash: Investment property deductible costs a year, for the tax only.
- ipDep: Investment property depreciation a year (non-cash), for the tax only.
- negGear: Whether the lender adds the tax saved on a rental loss back. Leave it on.
- incFtb: Family Tax Benefit A and B a year. Send hasGov with it.
- incPension: Centrelink pension or disability support a year. Send hasGov with it.
- pensionTaxable: Whether the pension is taxable (age pension yes, disability support below pension age no).
- incCsIn: Child support received a year. Send hasGov with it.
- shdFtb: The share of Family Tax Benefit counted, %. 100.
- shdPension: The share of the pension counted, %. 100.
- shdCsIn: The share of child support received counted, %. 100.

## Hide

## Quick Starts

There are 5 Quick Starts, each a named Australian borrower with their city, income, household, debts, deposit and a home they would shop for. Each is opened as a full scenario, and the list below shows only what it sets differently from the page's own start, so any key not listed keeps the page's default.

Start from the one nearest the household: couple with children, a single average earner, a first home buyer with a thin deposit, a self-employed borrower, or a high earner paid in several streams. Then send the user's own figures: usually city, incSimple, incSplit, adults, deps, price, savings and the debts they mention, plus any assumption you change. The Quick Starts' prices and savings are examples, not the user's.

## Example

Request: using tool.adjiebrotots.com/borrowingcapacity, how much can a couple earning $120,000 and $85,000 in Sydney borrow?

Link:
- qs=couple
- city=Sydney
- incSimple=205000
- why.incSimple=$120,000 plus $85,000 gross a year, before tax
- incSplit=40
- why.incSplit=The second applicant earns $85,000, about 41% of $205,000, and the slider moves in steps of 5
- deps=0
- why.deps=No children were mentioned, and the Couple Quick Start has two
- declaredExp=4000
- why.declaredExp=A typical monthly figure for two adults with no children, excluding rent and debts
- price=1100000
- why.price=A typical Sydney price for a home a couple on this income might shop for
- savings=250000
- why.savings=Savings for the purchase were not given, so a typical amount for a couple at this income
- dutyPct=4
- why.dutyPct=New South Wales stamp duty on about $1.1M is about 4% of the price
- note=Sydney couple, October 2026

Assumptions:
1. Household: two applicants and no dependants. The link starts from the Couple Quick Start (qs=couple), which keeps private hospital cover {privHealth}, no study loan, a card limit of {cardLimit}, a loan at {prodRate}% a year over {termYears} years and the {taxYear} tax year.
2. Income: ${incSimple} a year gross between the two, with the second applicant's share set to {incSplit}%, the nearest step to $85,000 of $205,000.
3. Living costs: ${declaredExp} a month declared; the lender uses the higher of this and its own benchmark.
4. Home and deposit: a ${price} home with ${savings} saved, stamp duty at {dutyPct}% of the price and ${otherCosts} of other purchase costs, none of which the user gave.

## Compact lists

- `incMode=<simple|detailed>`
- `incWho=<employee|self>`
- `debtsMode=<simple|detailed>`
- `loanMode=<simple|detailed>`
- `capsMode=<simple|detailed>`

These five are not form fields: they are the page's Simple / Detailed switches and its Employee / Self-employed switch. A value may also be the words the page shows (Detailed, Self-employed). You rarely need to send them, because a link that names a figure which only counts in one view switches that view on by itself. The key you send always wins.

incMode: simple counts incSimple, in full. detailed counts the streams instead, each shaded by its own shd key: incPayg, incOvertime, incBonus, incAllow, incCasual (employee) or incSeNpat, incSeAdd (self-employed), and incSimple is not used. Naming any stream, shading or investment figure that is shown in Detailed (incPayg, incBonus, shdBonus, shdRent, ipCash and the like) switches Income to Detailed; naming incSimple alone switches it to Simple. When the link switches Income to Detailed and does not name the base salary (incPayg, or incSeNpat for self-employed), the base salary becomes what is left of incSimple after the other streams you named, as the Detailed button does. So in Detailed, send incPayg or incSeNpat as well.
`incMode=detailed&incPayg=100000&incBonus=20000`

incWho: employee or self. Only one side counts at a time. Naming a self-employed stream (incSeNpat, incSeAdd, shdSe) selects self; naming an employee stream selects employee. In Simple it changes only the wording on the page, not the result.

debtsMode and loanMode: change only which controls the page shows, never the result; a value in a hidden control still counts. Naming olTerm, olType, olIo, cardPct or ipOut shows the Detailed debts view; naming buffer, floorRate, umiReq or nsrMin shows the Detailed loan view.

capsMode: simple sets the loan to value limit to 80 (95 with lmiCap on) and values the home at the price. detailed uses lvrMax and valuation, and shows dtiCap and dtiBasis. Naming any of lvrMax, valuation, dtiCap or dtiBasis switches Purchase to Detailed; whichever of lvrMax and valuation you leave out then takes what Simple was using (95 or 80, and the price).

The boxes under "Tick what you have" (hasInvest, hasGov, hasHomeLoan, hasCard, hasPersonal, hasBnpl, hasSupport, hasRefi) and the two switches hasIo and lmiCap hide and zero what is under them while they are off. Send the box with its figures. As a safety net, a link that names a non-zero figure under an off box and does not name the box turns it on.
`hasPersonal=true&persRepay=950&persBal=42000`

## Json
