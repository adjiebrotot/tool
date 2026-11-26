# Where to look: official sources for every country

Start a rule change here, not with a web search. Every page below is already cited by the
country's page and was opened when it was cited, so it is the deep page that states the rule
(the rates table, the cap, the contribution page), not a home page. Find the rule's row, open
that page, read the new figure. Search the web only when no row covers the rule, or the page
has moved.

The live list for one country, grouped by the law block it backs, always matches the content
files:

```
node global-income-tax-calculator/_jurisdictions/rules.mjs <CC|slug>    # the WHERE TO LOOK section
```

This file adds what that list cannot: which hosts let an agent in, and where to go when they
do not. The **Fetch** column is what `curl -sSL -A "Mozilla/5.0"` got from a cloud container on
26 Nov 2026:

- **ok**: loads. Read the figure on the page.
- **blocked (403)**: a bot wall (Cloudflare, Akamai). The page is fine in a browser. Never work
  around it: cross-check the figure on a second official page that loads, or a fallback below
  (and mark the line `secondary`), or ask the owner to read it.
- **no connection**: the host times out or resets from cloud IPs (canada.ca, nts.go.kr,
  nhis.or.kr, law.go.kr, perkeso.gov.my). Try `curl --http1.1` once, then treat as blocked.
- **moved (404)**: the cited page has gone. Find its replacement on the same host, update the
  `cite` in both content files and `SRC` in `engine.js` if it is there.

## The order to look in

1. The row in this file (or `rules.mjs <CC>`) for the rule: the official deep page.
2. The agency's other pages on the same host: a new year's rates usually sit at the same path
   with the year changed (`/forms/2026/` to `/forms/2027/`), or one level up.
3. The law itself: the official gazette or legal portal the country's rows already use
   (gesetze-im-internet.de, boe.es, legifrance.gouv.fr, law.go.kr, decree.om).
4. A secondary source, only when no official page loads, and the line's `status` becomes
   `secondary`:
   - PwC Worldwide Tax Summaries, `https://taxsummaries.pwc.com/<country>/individual/taxes-on-personal-income`
     (and `/other-taxes` for social security). Loads from the container. Country slugs follow
     the site: `republic-of-korea`, `united-kingdom`, `hong-kong-sar`, `taiwan`.
   - EY Worldwide Personal Tax and Immigration Guide, `https://www.ey.com/en_gl/technical/tax-guides/worldwide-personal-tax-and-immigration-guide`.
   - US states: the Tax Foundation table (see United States).
5. Still nothing that states it: ask the owner. Never guess a figure.

## Hosts that block automated fetches (as of 26 Nov 2026)

| Host | What it carries here | Use instead |
| --- | --- | --- |
| ato.gov.au | every Australian rate, the Medicare levy, super | PwC Australia summary to cross-check; ask the owner for the ATO figure |
| canada.ca (CRA) | federal rates, T4127, CPP, EI | the provincial sites (ontario.ca, gov.bc.ca, alberta.ca load); PwC Canada |
| revenuquebec.ca | Quebec rates, QPP | retraitequebec.gouv.qc.ca and quebec.ca load (QPP, QPIP) |
| ssa.gov | the Social Security wage base | IRS Publication 15 (irs.gov/publications/p15) states the wage base and loads |
| paidfamilyleave.ny.gov | NY Paid Family Leave | NY DTF and WCB pages load |
| legifrance.gouv.fr | French code articles | service-public.gouv.fr, impots.gouv.fr |
| kwsp.gov.my, perkeso.gov.my | EPF and SOCSO | PwC Malaysia `/other-taxes` |
| nts.go.kr, nhis.or.kr, law.go.kr | Korean rates, health insurance, the law | PwC Republic of Korea |
| tax.colorado.gov, mass.gov, tax.ri.gov, incometax.utah.gov | those states' income tax | the Tax Foundation state table |

Cited pages that have moved (404) and need a new URL the next time their country is touched:
pajak.go.id nodes 35019, 62542, 90251 and 104139 (Indonesia), and the two hasil.gov.my
pages (Malaysia's tax rate and reliefs). Find the replacement on the same host before citing.

---

## Australia (AU), `australia/`

Agencies cited: ATO.  
Hosts: ato.gov.au.

| Rule it states | Page | Fetch |
| --- | --- | --- |
| overview; main source | [ATO, Residency tests](https://www.ato.gov.au/individuals-and-families/coming-to-australia-or-going-overseas/residency-tests) | blocked (403) |
| Tax rates for residents; main source; worked example; FAQ | [ATO, Tax rates: Australian residents](https://www.ato.gov.au/tax-rates-and-codes/tax-rates-australian-residents) | blocked (403) |
| Tax rates for foreign residents; main source; worked example; FAQ | [ATO, Tax rates: foreign residents](https://www.ato.gov.au/tax-rates-and-codes/tax-rates-foreign-residents) | blocked (403) |
| Tax rates for working holiday makers; main source; worked example; FAQ | [ATO, Schedule 15: tax table for working holiday makers](https://www.ato.gov.au/tax-rates-and-codes/schedule-15-tax-table-for-working-holiday-makers) | blocked (403) |
| Medicare levy and the surcharge; FAQ | [ATO, Medicare levy reduction for low-income earners](https://www.ato.gov.au/individuals-and-families/medicare-and-private-health-insurance/medicare-levy/medicare-levy-reduction/medicare-levy-reduction-for-low-income-earners) | blocked (403) |
| Medicare levy and the surcharge; main source; worked example; tax tip | [ATO, Medicare levy surcharge income, thresholds and rates](https://www.ato.gov.au/individuals-and-families/medicare-and-private-health-insurance/medicare-levy-surcharge/medicare-levy-surcharge-income-thresholds-and-rates) | blocked (403) |
| Superannuation guarantee; main source; tax tip; FAQ | [ATO, Super guarantee rate](https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/super-guarantee) | blocked (403) |
| main source; tax tip | [ATO, Key super rates and thresholds: contributions caps](https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/contributions-caps) | blocked (403) |
| main source; tax tip; FAQ | [ATO, Super information for temporary residents departing Australia](https://www.ato.gov.au/individuals/super/in-detail/temporary-residents-and-super/super-information-for-temporary-residents-departing-australia/) | blocked (403) |
| FAQ | [ATO, Tax withheld calculator](https://www.ato.gov.au/calculators-and-tools/tax-withheld-calculator) | blocked (403) |

## Singapore (SG), `singapore/`

Agencies cited: IRAS, CPF Board.  
Hosts: iras.gov.sg, cpf.gov.sg.

| Rule it states | Page | Fetch |
| --- | --- | --- |
| overview; Non-residents; main source; tax tip; FAQ | [IRAS, Working out my tax residency](https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-residency-and-tax-rates/working-out-my-tax-residency) | ok |
| Tax rates for residents; Non-residents; main source; worked example; FAQ | [IRAS, Individual income tax rates](https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-residency-and-tax-rates/individual-income-tax-rates) | ok |
| CPF contributions; main source; worked example | [CPF Board, How much CPF contributions to pay](https://www.cpf.gov.sg/employer/employer-obligations/how-much-cpf-contributions-to-pay) | ok |
| CPF contributions; main source; worked example; FAQ | [CPF Board, CPF contributions for a foreign employee who becomes a Singapore PR](https://www.cpf.gov.sg/service/article/do-i-need-to-pay-cpf-contributions-for-my-foreign-employee-who-has-recently-obtained-singapore-permanent-residence-status) | ok |
| Reliefs in the calculator; main source; tax tip | [IRAS, Tax reliefs](https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-reliefs-rebates-and-deductions/tax-reliefs) | ok |
| main source; tax tip | [IRAS, SRS contributions](https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/special-tax-schemes/srs-contributions) | ok |
| main source; FAQ | [IRAS, Tax clearance for non-Singapore citizen employees](https://www.iras.gov.sg/taxes/individual-income-tax/employees/scenario-based-faqs-for-working-in-singapore-and-abroad/tax-clearance-for-non-singapore-citizen-employees) | ok |

## United Kingdom (GB), `united-kingdom/`

Agencies cited: GOV.UK, HMRC.  
Hosts: gov.uk.

| Rule it states | Page | Fetch |
| --- | --- | --- |
| overview; main source | [GOV.UK, Tax on foreign income: UK residence and tax](https://www.gov.uk/tax-foreign-income/residence) | ok |
| overview; main source | [HMRC, Guidance note for Statutory Residence Test (RDR3)](https://www.gov.uk/government/publications/rdr3-statutory-residence-test-srt) | ok |
| overview; FAQ | [GOV.UK, Income Tax: how you pay (PAYE)](https://www.gov.uk/income-tax/how-you-pay-income-tax) | ok |
| Income tax rates in England, Wales and Northern Ireland; The personal allowance taper and the 60% band; main source; worked example; FAQ | [GOV.UK, Income Tax rates and Personal Allowances](https://www.gov.uk/income-tax-rates) | ok |
| Income tax rates in England, Wales and Northern Ireland; main source; tax tip; FAQ | [GOV.UK, What your tax code means](https://www.gov.uk/tax-codes/what-your-tax-code-means) | ok |
| Income tax rates in Scotland; main source; worked example; FAQ | [GOV.UK, Income Tax in Scotland: current rates](https://www.gov.uk/scottish-income-tax) | ok |
| Income tax rates in Scotland; tax tip | [GOV.UK, Income Tax in Scotland: who pays](https://www.gov.uk/scottish-income-tax/who-pays) | ok |
| National Insurance (Class 1, employee); main source; worked example; FAQ | [GOV.UK, National Insurance rates and categories (employees)](https://www.gov.uk/national-insurance-rates-letters) | ok |
| National Insurance (Class 1, employee); FAQ | [GOV.UK, National Insurance: how much you pay](https://www.gov.uk/national-insurance/how-much-you-pay) | ok |
| Student and postgraduate loans; main source; worked example; FAQ | [GOV.UK, Repaying your student loan: how much you repay](https://www.gov.uk/repaying-your-student-loan/what-you-pay) | ok |
| main source; tax tip | [GOV.UK, Tax on your private pension: annual allowance](https://www.gov.uk/tax-on-your-private-pension/annual-allowance) | ok |
| tax tip | [HMRC, Salary sacrifice and the effects on PAYE](https://www.gov.uk/guidance/salary-sacrifice-and-the-effects-on-paye) | ok |
| tax tip; FAQ | [GOV.UK, Emergency tax codes](https://www.gov.uk/tax-codes/emergency-tax-codes) | ok |
| tax tip | [GOV.UK, Repaying your student loan: extra repayments](https://www.gov.uk/repaying-your-student-loan/make-extra-repayments) | ok |
| FAQ | [GOV.UK, Check if you need to send a Self Assessment tax return](https://www.gov.uk/check-if-you-need-tax-return) | ok |

## Germany (DE), `germany/`

Agencies cited: AO § 9, EStG § 1, EStG § 32a, EStG § 9a, EStG § 10c, EStG § 38b, SolzG 1995 § 3, SolzG 1995 § 4, EStG § 51a, PwC Worldwide Tax Summaries, Deutsche Rentenversicherung, SVBezGrV 2026 § 2, SGB V § 241, BMG, SGB III § 341, SGB XI § 55, Bundesregierung, BetrAVG § 1a, EStG § 3, EStG § 9, EStG § 26b, EStG § 10a.  
Hosts: gesetze-im-internet.de, taxsummaries.pwc.com, deutsche-rentenversicherung.de, bundesgesundheitsministerium.de, bundesregierung.de.

| Rule it states | Page | Fetch |
| --- | --- | --- |
| overview | [AO § 9, gewöhnlicher Aufenthalt (sechs Monate)](https://www.gesetze-im-internet.de/ao_1977/__9.html) | ok |
| overview | [EStG § 1, unbeschränkte Steuerpflicht](https://www.gesetze-im-internet.de/estg/__1.html) | ok |
| Income tax rates; main source; worked example; FAQ | [EStG § 32a, Einkommensteuertarif (gesetze-im-internet.de)](https://www.gesetze-im-internet.de/estg/__32a.html) | ok |
| Income tax rates; tax tip | [EStG § 9a, Arbeitnehmer-Pauschbetrag €1.230](https://www.gesetze-im-internet.de/estg/__9a.html) | ok |
| Income tax rates | [EStG § 10c, Sonderausgaben-Pauschbetrag](https://www.gesetze-im-internet.de/estg/__10c.html) | ok |
| Tax classes (Steuerklassen); main source; worked example; tax tip; FAQ | [EStG § 38b, Lohnsteuerklassen](https://www.gesetze-im-internet.de/estg/__38b.html) | ok |
| Solidarity surcharge and church tax; main source; FAQ | [SolzG 1995 § 3, Bemessungsgrundlage und Freigrenzen](https://www.gesetze-im-internet.de/solzg_1995/__3.html) | ok |
| Solidarity surcharge and church tax; FAQ | [SolzG 1995 § 4, Zuschlagsatz 5,5 %](https://www.gesetze-im-internet.de/solzg_1995/__4.html) | ok |
| Solidarity surcharge and church tax; main source; worked example; FAQ | [EStG § 51a, Kirchensteuer als Zuschlag](https://www.gesetze-im-internet.de/estg/__51a.html) | ok |
| Solidarity surcharge and church tax; worked example; FAQ | [PwC Worldwide Tax Summaries, Germany: taxes on personal income (church tax)](https://taxsummaries.pwc.com/germany/individual/taxes-on-personal-income) | ok |
| Social insurance contributions; main source; worked example; FAQ | [Deutsche Rentenversicherung, Änderungen 2026 (Beitragssatz 18,6 %, Beitragsbemessungsgrenze)](https://www.deutsche-rentenversicherung.de/Nord/DE/Presse/Pressemitteilungen-und-Pressearchiv/Pressemitteilungen/20251218_Aenderung-RV-01012026) | ok |
| Social insurance contributions; FAQ | [SVBezGrV 2026 § 2, Jahresarbeitsentgeltgrenzen (€69.750)](https://www.gesetze-im-internet.de/svbezgrv_2026/__2.html) | ok |
| Social insurance contributions; main source; FAQ | [SGB V § 241, allgemeiner Beitragssatz 14,6 %](https://www.gesetze-im-internet.de/sgb_5/__241.html) | ok |
| Social insurance contributions; main source; FAQ | [BMG, Beiträge der gesetzlichen Krankenversicherung (Zusatzbeitrag)](https://www.bundesgesundheitsministerium.de/beitraege) | ok |
| Social insurance contributions | [SGB III § 341, Beitragssatz Arbeitslosenversicherung 2,6 %](https://www.gesetze-im-internet.de/sgb_3/__341.html) | ok |
| Social insurance contributions | [SGB XI § 55, Beitragssatz Pflegeversicherung (Zuschlag für Kinderlose)](https://www.gesetze-im-internet.de/sgb_11/__55.html) | ok |
| main source | [Bundesregierung, Rechengrößen in der Sozialversicherung 2026](https://www.bundesregierung.de/breg-de/aktuelles/beitragsgemessungsgrenzen-2386514) | ok |
| tax tip | [BetrAVG § 1a, Anspruch auf Entgeltumwandlung](https://www.gesetze-im-internet.de/betravg/__1a.html) | ok |
| tax tip | [EStG § 3, steuerfreie Einnahmen (betriebliche Altersversorgung)](https://www.gesetze-im-internet.de/estg/__3.html) | ok |
| tax tip | [EStG § 9, Werbungskosten](https://www.gesetze-im-internet.de/estg/__9.html) | ok |
| tax tip; FAQ | [EStG § 26b, Zusammenveranlagung von Ehegatten](https://www.gesetze-im-internet.de/estg/__26b.html) | ok |
| tax tip | [EStG § 10a, Altersvorsorgebeiträge (Riester)](https://www.gesetze-im-internet.de/estg/__10a.html) | ok |

## United States (US), `united-states/`

Agencies cited: IRS, Social Security Administration, Tax Foundation, California FTB, California EDD, NY Department of Taxation and Finance, New York Paid Family Leave, NY Workers' Compensation Board, Illinois Department of Revenue.  
Hosts: irs.gov, ssa.gov, taxfoundation.org, ftb.ca.gov, edd.ca.gov, tax.ny.gov, paidfamilyleave.ny.gov, wcb.ny.gov, tax.illinois.gov.

| Rule it states | Page | Fetch |
| --- | --- | --- |
| overview; Nonresident aliens; worked example; FAQ | [IRS, Substantial presence test](https://www.irs.gov/individuals/international-taxpayers/substantial-presence-test) | ok |
| overview; FAQ | [IRS, When to file](https://www.irs.gov/filing/individuals/when-to-file) | ok |
| Federal income tax brackets for single filers; Federal brackets for married couples filing jointly; main source; worked example; FAQ | [IRS, Rev. Proc. 2025-32 (IRB 2025-45), rate table for unmarried individuals](https://www.irs.gov/irb/2025-45_IRB) | ok |
| Federal income tax brackets for single filers; Federal brackets for married couples filing jointly; main source; worked example | [IRS, 2026 inflation adjustments (standard deduction and brackets)](https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill) | ok |
| FICA: Social Security and Medicare; main source; FAQ | [Social Security Administration, Contribution and Benefit Base](https://www.ssa.gov/oact/COLA/cbb.html) | blocked (403) |
| FICA: Social Security and Medicare; worked example; FAQ | [IRS, Topic no. 751, Social Security and Medicare withholding rates](https://www.irs.gov/taxtopics/tc751) | ok |
| FICA: Social Security and Medicare | [IRS, Questions and answers for the Additional Medicare Tax](https://www.irs.gov/businesses/small-businesses-self-employed/questions-and-answers-for-the-additional-medicare-tax) | ok |
| State income tax: 39 states and DC loaded; main source; FAQ | [Tax Foundation, state individual income tax rates and brackets for 2026](https://taxfoundation.org/data/all/state/state-income-tax-rates-2026/) | ok |
| State income tax: 39 states and DC loaded; main source; worked example | [California FTB, 2026 California tax rate schedules](https://www.ftb.ca.gov/forms/2026/2026-540-tax-rate-schedules.pdf) | ok |
| State income tax: 39 states and DC loaded; worked example | [California EDD, payroll tax rates and withholding (SDI)](https://edd.ca.gov/en/payroll_taxes/rates_and_withholding/) | ok |
| State income tax: 39 states and DC loaded; main source; worked example | [NY Department of Taxation and Finance, IT-2105-I (2026): New York State and City tax rates](https://www.tax.ny.gov/pdf/current_forms/it/it2105i.pdf) | ok |
| State income tax: 39 states and DC loaded; worked example | [New York Paid Family Leave, 2026 updates and employee contribution rate](https://paidfamilyleave.ny.gov/2026) | blocked (403) |
| State income tax: 39 states and DC loaded; worked example | [NY Workers' Compensation Board, employee disability benefits contribution](https://www.wcb.ny.gov/content/main/DisabilityBenefits/employee-disability-benefits.jsp) | ok |
| State income tax: 39 states and DC loaded | [Illinois Department of Revenue, income tax rates](https://tax.illinois.gov/research/taxrates/income.html) | ok |
| Nonresident aliens; worked example; FAQ | [IRS, Publication 519, U.S. Tax Guide for Aliens](https://www.irs.gov/publications/p519) | ok |
| Nonresident aliens; worked example; tax tip; FAQ | [IRS, Foreign student liability for Social Security and Medicare taxes](https://www.irs.gov/individuals/international-taxpayers/foreign-student-liability-for-social-security-and-medicare-taxes) | ok |
| Nonresident aliens; main source | [IRS, Taxation of nonresident aliens](https://www.irs.gov/individuals/international-taxpayers/taxation-of-nonresident-aliens) | ok |
| worked example | [IRS, About Form 8843](https://www.irs.gov/forms-pubs/about-form-8843) | ok |
| worked example; FAQ | [IRS, About Form 1040-NR](https://www.irs.gov/forms-pubs/about-form-1040-nr) | ok |
| tax tip | [IRS, 401(k) and profit-sharing plan contribution limits](https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-401k-and-profit-sharing-plan-contribution-limits) | ok |
| tax tip | [IRS, Publication 969, Health Savings Accounts](https://www.irs.gov/publications/p969) | ok |
| tax tip | [IRS, Tax Withholding Estimator](https://www.irs.gov/individuals/tax-withholding-estimator) | ok |
| tax tip | [IRS, About Form W-4](https://www.irs.gov/forms-pubs/about-form-w-4) | ok |
| tax tip | [IRS, Tax treaty tables](https://www.irs.gov/individuals/international-taxpayers/tax-treaty-tables) | ok |
| tax tip | [IRS, About Form 8233](https://www.irs.gov/forms-pubs/about-form-8233) | ok |

States (the "Tax in <place>" accordions; `_jurisdictions/places.json`):

| Code | Official page |
| --- | --- |
| AL | [Alabama Department of Revenue, individual income tax](https://www.revenue.alabama.gov/individual-corporate/individual-income-tax-filing-information/) |
| AZ | [Arizona Department of Revenue, individual income tax](https://azdor.gov/individuals) |
| AR | [Arkansas Department of Finance and Administration, individual income tax](https://www.dfa.arkansas.gov/office/taxes/income-tax-administration/individual-income-tax/) |
| CA | [California FTB, 2026 California tax rate schedules](https://www.ftb.ca.gov/forms/2026/2026-540-tax-rate-schedules.pdf)<br>[California EDD, payroll tax rates and withholding (SDI)](https://edd.ca.gov/en/payroll_taxes/rates_and_withholding/#:~:text=SDI%20Rate) |
| CT | [Connecticut Department of Revenue Services, individual income tax](https://portal.ct.gov/drs/individuals/individual-income-tax-portal) |
| DE | [Delaware Division of Revenue, personal income tax](https://revenue.delaware.gov/frequently-asked-questions/personal-income-tax-faqs/) |
| DC | [DC Office of Tax and Revenue, individual income tax rates](https://otr.cfo.dc.gov/page/dc-individual-and-fiduciary-income-tax-rates) |
| GA | [Georgia Department of Revenue, taxes for individuals](https://dor.georgia.gov/taxes/taxes-individuals) |
| HI | [Hawaii Department of Taxation, individual income tax](https://tax.hawaii.gov/forms/a1_b1_1income/) |
| ID | [Idaho State Tax Commission, individual income tax](https://tax.idaho.gov/taxes/income-tax/individual-income/) |
| IL | [Illinois Department of Revenue, income tax rates](https://tax.illinois.gov/research/taxrates/income.html#:~:text=Individual%20Income%20Tax) |
| IN | [Indiana Department of Revenue, individual income tax](https://www.in.gov/dor/i-am-a/individual/) |
| IA | [Iowa Department of Revenue, individual income tax](https://revenue.iowa.gov/taxes/tax-guidance/individual-income-tax) |
| KS | [Kansas Department of Revenue, individual income tax](https://www.ksrevenue.gov/perstaxtypesii.html) |
| KY | [Kentucky Department of Revenue, individual income tax](https://revenue.ky.gov/Individual/Individual-Income-Tax/Pages/default.aspx) |
| LA | [Louisiana Department of Revenue, individual income tax](https://revenue.louisiana.gov/individuals/) |
| ME | [Maine Revenue Services, income tax](https://www.maine.gov/revenue/taxes/income-estate-tax) |
| MD | [Comptroller of Maryland, income tax rates and brackets](https://services.marylandcomptroller.gov/taxes/en/maryland-income-tax-rates-and-brackets?id=kb_article_view&sysparm_article=KB0010014) |
| MI | [Michigan Department of Treasury, individual income tax](https://www.michigan.gov/taxes/iit) |
| MN | [Minnesota Department of Revenue, income tax rates and brackets](https://www.revenue.state.mn.us/minnesota-income-tax-rates-and-brackets) |
| MS | [Mississippi Department of Revenue, individual income tax](https://www.dor.ms.gov/individual) |
| MO | [Missouri Department of Revenue, individual income tax](https://dor.mo.gov/taxation/individual/) |
| MT | [Montana Department of Revenue, individual income tax](https://revenue.mt.gov/taxes/individual-income-tax/) |
| NE | [Nebraska Department of Revenue, individual income tax](https://revenue.nebraska.gov/individuals/individual-income-tax) |
| NJ | [New Jersey Division of Taxation, income tax rates](https://www.nj.gov/treasury/taxation/taxtables.shtml) |
| NM | [New Mexico Taxation and Revenue Department, personal income tax](https://www.tax.newmexico.gov/individuals/personal-income-tax-information-overview/) |
| NY | [NY Department of Taxation and Finance, IT-2105-I (2026): New York State and City tax rates](https://www.tax.ny.gov/pdf/current_forms/it/it2105i.pdf)<br>[New York Paid Family Leave, 2026 updates and employee contribution rate](https://paidfamilyleave.ny.gov/2026#:~:text=employees%20will%20contribute)<br>[NY Workers' Compensation Board, employee disability benefits contribution](https://www.wcb.ny.gov/content/main/DisabilityBenefits/employee-disability-benefits.jsp#:~:text=no%20more%20than%2060%20cents%20a%20week) |
| NC | [North Carolina Department of Revenue, individual income tax](https://www.ncdor.gov/taxes-forms/individual-income-tax) |
| ND | [North Dakota Office of State Tax Commissioner, individual income tax](https://www.tax.nd.gov/individual-income-tax) |
| OH | [Ohio Department of Taxation, annual tax rates](https://tax.ohio.gov/individual/resources/annual-tax-rates/) |
| OK | [Oklahoma Tax Commission, individuals](https://oklahoma.gov/tax/individuals.html) |
| OR | [Oregon Department of Revenue, personal income tax](https://www.oregon.gov/dor/programs/individuals/pages/pit.aspx) |
| PA | [Pennsylvania Department of Revenue, personal income tax](https://www.pa.gov/agencies/revenue/resources/tax-types-and-information/personal-income-tax) |
| SC | [South Carolina Department of Revenue, individual income tax](https://dor.sc.gov/iit) |
| VT | [Vermont Department of Taxes, personal income tax](https://tax.vermont.gov/personal-income-tax) |
| VA | [Virginia Tax, individual income tax filing](https://www.tax.virginia.gov/individual-income-tax-filing) |
| WV | [West Virginia Tax Division, individuals](https://tax.wv.gov/Individuals/Pages/Individuals.aspx) |
| WI | [Wisconsin Department of Revenue, individuals](https://www.revenue.wi.gov/Pages/Individuals/home.aspx) |
| CO, MA, RI, UT | Cloudflare or a bot wall stops curl: tax.colorado.gov/individual-income-tax, mass.gov/guides/personal-income-tax-for-residents, tax.ri.gov/tax-sections/personal-income-tax, incometax.utah.gov. Cross-check on the Tax Foundation table below, or ask the owner. |
| AK, FL, NV, NH, SD, TN, TX, WA, WY | No tax on wages: the Tax Foundation table is enough. |
| Every state | [Tax Foundation, state individual income tax rates and brackets for 2026](https://taxfoundation.org/data/all/state/state-income-tax-rates-2026/) (secondary, the engine's `states` source; one table for all states, single and joint brackets, deductions, exemptions) |

## Canada (CA), `canada/`

Agencies cited: CRA, Ontario.ca, Government of British Columbia, Government of Alberta, Revenu Québec, Retraite Québec, Gouvernement du Québec.  
Hosts: canada.ca, ontario.ca, www2.gov.bc.ca, alberta.ca, revenuquebec.ca, retraitequebec.gouv.qc.ca, quebec.ca.

| Rule it states | Page | Fetch |
| --- | --- | --- |
| overview; FAQ | [CRA, Newcomers to Canada and the CRA](https://www.canada.ca/en/revenue-agency/services/tax/international-non-residents/individuals-leaving-entering-canada-non-residents/newcomers-canada-immigrants.html) | no connection |
| overview; FAQ | [CRA, due dates and payment dates (personal income tax)](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/important-dates-individuals.html) | no connection |
| Federal income tax rates; Provincial income tax; main source; FAQ | [CRA, current year tax rates and income brackets (2026), federal rate](https://www.canada.ca/en/revenue-agency/services/tax/individuals/tax-rates-brackets/current-year.html) | no connection |
| Federal income tax rates; Quebec: a separate system; main source; FAQ | [CRA, T4127 Payroll Deductions Formulas (basic personal amount)](https://www.canada.ca/en/revenue-agency/services/forms-publications/payroll/t4127-payroll-deductions-formulas/t4127-jan/t4127-jan-payroll-deductions-formulas-computer-programs.html) | no connection |
| Provincial income tax; worked example; FAQ | [CRA, T4032-ON Payroll Deductions Tables 2026 (Ontario surtax)](https://www.canada.ca/content/dam/cra-arc/migration/cra-arc/tx/bsnss/tpcs/pyrll/t4032/2026/t4032-on-1-26e.pdf) | no connection |
| Provincial income tax; main source; worked example; FAQ | [Ontario.ca, Health premium](https://www.ontario.ca/page/health-premium) | ok |
| Provincial income tax; worked example | [Government of British Columbia, personal income tax rates](https://www2.gov.bc.ca/gov/content/taxes/income-taxes/personal/tax-rates) | ok |
| Provincial income tax; worked example | [Government of Alberta, personal income tax](https://www.alberta.ca/personal-income-tax) | ok |
| Provincial income tax; Quebec: a separate system; main source; worked example; FAQ | [Revenu Québec, income tax rates](https://www.revenuquebec.ca/en/citizens/income-tax-return/completing-your-income-tax-return/income-tax-rates/) | blocked (403) |
| CPP, CPP2 and EI; main source; FAQ | [CRA, CPP contribution rates, maximums and exemptions](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/payroll-deductions-contributions/canada-pension-plan-cpp/cpp-contribution-rates-maximums-exemptions.html) | no connection |
| CPP, CPP2 and EI; FAQ | [CRA, second additional CPP (CPP2) contribution rates and maximums](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/calculating-deductions/making-deductions/second-additional-cpp-contribution-rates-maximums.html) | no connection |
| CPP, CPP2 and EI; Quebec: a separate system; main source; FAQ | [CRA, EI premium rates and maximums](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/payroll-deductions-contributions/employment-insurance-ei/ei-premium-rates-maximums.html) | no connection |
| Quebec: a separate system; worked example | [Revenu Québec, QPP maximum pensionable earnings and contribution rate](https://www.revenuquebec.ca/en/businesses/source-deductions-and-employer-contributions/calculating-source-deductions-and-contributions/qpp-contributions/maximum-pensionable-earnings-and-contribution-rate/) | blocked (403) |
| Quebec: a separate system | [Retraite Québec, 2026 benefit amounts and key data](https://www.retraitequebec.gouv.qc.ca/en/other-sorted/benefits-amounts-key-data) | ok |
| Quebec: a separate system; worked example | [Gouvernement du Québec, QPIP contribution rates (RQAP)](https://www.quebec.ca/entreprises-et-travailleurs-autonomes/administrer-gerer/embauche-gestion-personnel/assurance-parentale/taux-cotisations) | ok |
| worked example | [Government of British Columbia, basic personal income tax credits](https://www2.gov.bc.ca/gov/content/taxes/income-taxes/personal/credits/basic) | ok |
| tax tip; FAQ | [CRA, MP, DB, RRSP, DPSP, ALDA, TFSA limits, YMPE and the YAMPE](https://www.canada.ca/en/revenue-agency/services/tax/registered-plans-administrators/pspa/mp-rrsp-dpsp-tfsa-limits-ympe.html) | no connection |
| tax tip; FAQ | [CRA, calculate your TFSA contribution room](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/tax-free-savings-account/contributing/calculate-room.html) | no connection |
| tax tip | [CRA, First Home Savings Account (FHSA)](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/first-home-savings-account.html) | no connection |

Provinces (the "Tax in <place>" accordions; `_jurisdictions/places.json`):

| Code | Official page |
| --- | --- |
| ON | [CRA, current year tax rates and income brackets (2026), provincial rates](https://www.canada.ca/en/revenue-agency/services/tax/individuals/tax-rates-brackets/current-year.html#:~:text=Ontario%20rate)<br>[CRA, T4032-ON Payroll Deductions Tables 2026 (Ontario surtax)](https://www.canada.ca/content/dam/cra-arc/migration/cra-arc/tx/bsnss/tpcs/pyrll/t4032/2026/t4032-on-1-26e.pdf)<br>[Ontario.ca, Health premium](https://www.ontario.ca/page/health-premium#:~:text=The%20health%20premium%20ranges) |
| BC | [Government of British Columbia, personal income tax rates](https://www2.gov.bc.ca/gov/content/taxes/income-taxes/personal/tax-rates#:~:text=Personal%20income%20tax%20brackets%20and%20rates)<br>[Government of British Columbia, basic tax credits](https://www2.gov.bc.ca/gov/content/taxes/income-taxes/personal/credits/basic) |
| AB | [Government of Alberta, personal income tax](https://www.alberta.ca/personal-income-tax#:~:text=2025%20and%202026%20tax%20brackets) |
| QC | [Revenu Québec, income tax rates](https://www.revenuquebec.ca/en/citizens/income-tax-return/completing-your-income-tax-return/income-tax-rates/)<br>[CRA, T4127 Payroll Deductions Formulas (Quebec reduction of federal tax)](https://www.canada.ca/en/revenue-agency/services/forms-publications/payroll/t4127-payroll-deductions-formulas/t4127-jan/t4127-jan-payroll-deductions-formulas-computer-programs.html#:~:text=Formula%20to%20calculate%20the%20annual%20federal%20tax%20payable) |

## France (FR), `france/`

Agencies cited: service-public.gouv.fr, Urssaf, impots.gouv.fr, BOFiP, Légifrance.  
Hosts: service-public.gouv.fr, urssaf.fr, impots.gouv.fr, bofip.impots.gouv.fr, legifrance.gouv.fr.

| Rule it states | Page | Fetch |
| --- | --- | --- |
| Income tax scale; main source; worked example; FAQ | [service-public.gouv.fr, Barème de l'impôt sur le revenu](https://www.service-public.gouv.fr/particuliers/vosdroits/F1419) | ok |
| Income tax scale | [service-public.gouv.fr, Impôt sur le revenu: calcul de l'impôt (décote)](https://www.service-public.gouv.fr/particuliers/vosdroits/F34328) | ok |
| Income tax scale | [service-public.gouv.fr, Frais professionnels (déduction de 10 %)](https://www.service-public.gouv.fr/particuliers/vosdroits/F1989) | ok |
| Income tax scale; main source | [service-public.gouv.fr, Contribution exceptionnelle sur les hauts revenus](https://www.service-public.gouv.fr/particuliers/vosdroits/F31130) | ok |
| Family parts (quotient familial); main source; worked example; tax tip; FAQ | [service-public.gouv.fr, Quotient familial d'un couple marié ou pacsé](https://www.service-public.gouv.fr/particuliers/vosdroits/F2705) | ok |
| Family parts (quotient familial); FAQ | [service-public.gouv.fr, Quotient familial d'une personne seule](https://www.service-public.gouv.fr/particuliers/vosdroits/F2702) | ok |
| Employee social contributions; CSG and CRDS; main source; worked example; FAQ | [Urssaf, Taux de cotisations du secteur privé](https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/taux-cotisations-secteur-prive.html) | ok |
| Employee social contributions; main source; worked example; FAQ | [Urssaf, Plafonds de la Sécurité sociale](https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/plafonds-securite-sociale.html) | ok |
| CSG and CRDS; main source; FAQ | [service-public.gouv.fr, CSG et CRDS sur les revenus d'activité](https://www.service-public.gouv.fr/particuliers/vosdroits/F2971) | ok |
| Impatriate regime; main source; worked example; tax tip; FAQ | [impots.gouv.fr, Le régime des impatriés](https://www.impots.gouv.fr/international-particulier/le-regime-des-impatries) | ok |
| Impatriate regime; worked example; tax tip | [BOFiP, Salariés impatriés: exonération (BOI-RSA-GEO-40-10-20)](https://bofip.impots.gouv.fr/bofip/5677-PGP.html/identifiant=BOI-RSA-GEO-40-10-20-20170621) | ok |
| Impatriate regime; main source; FAQ | [Légifrance, Code général des impôts, article 155 B](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000037985788) | blocked (403) |
| tax tip | [service-public.gouv.fr, Plan d'épargne retraite (PER)](https://www.service-public.gouv.fr/particuliers/vosdroits/F34982) | ok |
| tax tip | [service-public.gouv.fr, Plan d'épargne entreprise (PEE)](https://www.service-public.gouv.fr/particuliers/vosdroits/F2142) | ok |
| tax tip | [service-public.gouv.fr, Intéressement](https://www.service-public.gouv.fr/particuliers/vosdroits/F2140) | ok |
| tax tip | [service-public.gouv.fr, Participation](https://www.service-public.gouv.fr/particuliers/vosdroits/F2141) | ok |
| tax tip; FAQ | [service-public.gouv.fr, Changer votre taux de prélèvement à la source](https://www.service-public.gouv.fr/particuliers/vosdroits/F35894) | ok |
| FAQ | [service-public.gouv.fr, Prélèvement à la source](https://www.service-public.gouv.fr/particuliers/vosdroits/F34009) | ok |

## Netherlands (NL), `netherlands/`

Agencies cited: PwC Worldwide Tax Summaries, Belastingdienst, Business.gov.nl, Rijksoverheid.  
Hosts: taxsummaries.pwc.com, belastingdienst.nl, business.gov.nl, rijksoverheid.nl.

| Rule it states | Page | Fetch |
| --- | --- | --- |
| overview | [PwC Worldwide Tax Summaries, Netherlands: residence](https://taxsummaries.pwc.com/netherlands/individual/residence) | ok |
| Box 1 rates and national insurance; main source; worked example; FAQ | [Belastingdienst, Box 1: uitleg en tarieven](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/inkomstenbelasting/heffingskortingen_boxen_tarieven/boxen_en_tarieven/box_1/box_1) | ok |
| Box 1 rates and national insurance | [Belastingdienst, Belastingschijven en tarieven](https://www.belastingdienst.nl/wps/wcm/connect/nl/werk-en-inkomen/content/hoeveel-inkomstenbelasting-betalen) | ok |
| Tax credits; main source; worked example; FAQ | [Belastingdienst, Tabel arbeidskorting 2026](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/inkomstenbelasting/heffingskortingen_boxen_tarieven/heffingskortingen/arbeidskorting/tabel-arbeidskorting-2026) | ok |
| Tax credits; main source; FAQ | [Belastingdienst, Tabel algemene heffingskorting 2026](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/inkomstenbelasting/heffingskortingen_boxen_tarieven/heffingskortingen/algemene_heffingskorting/tabel-algemene-heffingskorting-2026) | ok |
| Holiday allowance; main source; FAQ | [Business.gov.nl, Holiday allowance](https://business.gov.nl/regulation/holiday-allowance/) | ok |
| The 30% ruling; main source; worked example; tax tip; FAQ | [Belastingdienst, Expat Scheme (30% facility): conditions](https://www.belastingdienst.nl/wps/wcm/connect/en/individuals/content/coming-to-work-in-the-netherlands-30-percent-facility) | ok |
| The 30% ruling; main source; worked example; tax tip; FAQ | [Belastingdienst, Deskundigheidsvereiste (salarisnorm)](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/internationaal/personeel/u_bent_niet_in_nederland_gevestigd_loonheffingen_inhouden/als_u_loonheffingen_gaat_inhouden/extraterritoriale_kosten_en_de_30procentregeling/voorwaarden_voor_de_30procentregeling1/deskundigheidsvereiste) | ok |
| The 30% ruling; main source; tax tip | [Rijksoverheid, Expatregeling hoogopgeleide buitenlandse werknemers](https://www.rijksoverheid.nl/themas/werk/inkomstenbelasting/belastingvoordeel-buitenlandse-werknemers) | ok |
| tax tip | [Belastingdienst, Beschikking: geldigheid en toetsen voorwaarden](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/internationaal/personeel/u_bent_niet_in_nederland_gevestigd_loonheffingen_inhouden/als_u_loonheffingen_gaat_inhouden/extraterritoriale_kosten_en_de_30procentregeling/voorwaarden_voor_de_30procentregeling1/beschikking_geldigheid_en_toetsen_voorwaarden) | ok |

## Belgium (BE), `belgium/`

Agencies cited: PwC Worldwide Tax Summaries, FPS Finance, Chamber of Representatives, ONSS, Deloitte Belgium.  
Hosts: taxsummaries.pwc.com, fin.belgium.be, lachambre.be, socialsecurity.be, finance.belgium.be, deloitte.com.

| Rule it states | Page | Fetch |
| --- | --- | --- |
| overview; main source | [PwC Worldwide Tax Summaries, Belgium individual: residence](https://taxsummaries.pwc.com/belgium/individual/residence) | ok |
| Federal income tax rates; main source; worked example; FAQ | [FPS Finance, tax rates (income 2026, assessment year 2027)](https://fin.belgium.be/en/private-individuals/tax-return/income/tax-rates) | ok |
| Federal income tax rates; Married couples and the marital quotient; worked example; tax tip; FAQ | [Chamber of Representatives, doc. 56K1243: Act of 15 July 2026 reforming personal income tax (marital quotient, tax-free amount)](https://www.lachambre.be/FLWB/html/56/N/56K1243.html) | ok |
| Social security (ONSS) and deductions; main source | [ONSS, which contributions exist (employee share 13.07%)](https://www.socialsecurity.be/site_fr/employer/infos/employers_nsso/which-contributions.htm) | ok |
| Social security (ONSS) and deductions; main source; worked example; FAQ | [PwC Worldwide Tax Summaries, Belgium individual: social security contributions](https://taxsummaries.pwc.com/belgium/individual/other-taxes) | ok |
| Social security (ONSS) and deductions; Married couples and the marital quotient; main source | [PwC Worldwide Tax Summaries, Belgium individual: deductions (professional expenses)](https://taxsummaries.pwc.com/belgium/individual/deductions) | ok |
| Social security (ONSS) and deductions; main source | [ONSS, employment bonus (bonus à l'emploi)](https://www.socialsecurity.be/employer/instructions/dmfa/fr/latest/instructions/deductions/workers_reductions/workbonus.html) | ok |
| Municipal surcharge; FAQ | [PwC Worldwide Tax Summaries, Belgium individual: local income taxes](https://taxsummaries.pwc.com/belgium/individual/taxes-on-personal-income) | ok |
| Expat regime; main source; worked example; tax tip; FAQ | [FPS Finance, special tax regime for inpatriate taxpayers and researchers](https://finance.belgium.be/en/node/14642) | ok |
| Expat regime; main source; FAQ | [Deloitte Belgium, expat regime: 35% for income tax, no change for social security (30%, max €90,000)](https://www.deloitte.com/be/en/services/tax/blogs/belgian-expat-tax-regime-critical-changes-effective-1-january-2025-for-income-tax-no-adjustment-for-social-security.html) | ok |
| FAQ | [PwC Worldwide Tax Summaries, Belgium individual: tax administration (withholding and returns)](https://taxsummaries.pwc.com/belgium/individual/tax-administration) | ok |

## Switzerland (Canton of Zurich) (CH), `switzerland/`

Agencies cited: Kanton Zürich, ESTV, BSV, Informationsstelle AHV/IV, FOPH (BAG), SFBVG.  
Hosts: zh.ch, notes.zh.ch, estv.admin.ch, sozialversicherungen.admin.ch, shop.ahv-iv.ch, bag.admin.ch, sfbvg.ch.

| Rule it states | Page | Fetch |
| --- | --- | --- |
| overview; Three layers of tax; main source; worked example; tax tip; FAQ | [Kanton Zürich, aktuelle Steuerfüsse (Staatssteuerfuss 95 Prozent)](https://www.zh.ch/de/steuern-finanzen/steuern/steuerstatistiken/aktuelle-gemeinde-steuerfuesse.html) | ok |
| Three layers of tax; Canton of Zurich simple tax tariff (single); main source; worked example; FAQ | [Kanton Zürich, Steuergesetz (LS 631.1), § 35 Einkommenssteuertarif, § 200 Personalsteuer](https://www.notes.zh.ch/appl/zhlex_r.nsf/WebView/A1B72A220CD6E747C1258DC4002A921E/$File/631.1_8.6.97_132.pdf) | not tested |
| Three layers of tax; main source; worked example; FAQ | [ESTV, Tarife direkte Bundessteuer natürliche Personen 2026](https://www.estv.admin.ch/dam/de/sd-web/gnde9CmEsalK/dbst-tairfe-58c-2026-dfi.pdf) | ok |
| Canton of Zurich simple tax tariff (single); worked example | [Kanton Zürich, Weisung über Sozialabzüge und Steuertarife (ZStB 34.1)](https://www.zh.ch/de/steuern-finanzen/steuern/treuhaender/steuerbuch/steuerbuch-definition/zstb-34-1.html) | ok |
| Social contributions; main source | [BSV, Schweizerische Sozialversicherungen: synoptische Tabelle der Beitragssätze (Stand 1.1.2026)](https://sozialversicherungen.admin.ch/de/d/6877/download) | ok |
| Social contributions; main source; tax tip | [Informationsstelle AHV/IV, Update Sozialversicherungen in der Schweiz (Stand 1. Januar 2026)](https://www.shop.ahv-iv.ch/data/docs/de/82816/Update-%C2%ABSozialversicherungen-in-der-Schweiz%C2%BB-Stand-1.-Januar-2026.pdf) | ok |
| Health insurance is a private premium; main source; FAQ | [FOPH (BAG), Health insurance: requirement to obtain insurance for persons resident in Switzerland](https://www.bag.admin.ch/en/health-insurance-requirement-to-obtain-insurance-for-persons-resident-in-switzerland) | ok |
| Withholding tax (Quellensteuer) for B-permit holders; main source; FAQ | [ESTV, Schweizerische Quellensteuer](https://www.estv.admin.ch/de/quellensteuer) | ok |
| Withholding tax (Quellensteuer) for B-permit holders | [Kanton Zürich, Quellensteuerpflichtige Personen](https://www.zh.ch/de/steuern-finanzen/steuern/quellensteuer/Quellensteuerpflichtige-Personen.html) | ok |
| Withholding tax (Quellensteuer) for B-permit holders; main source; FAQ | [Kanton Zürich, Merkblatt Quellenbesteuerung (ZStB 87.3), Schwellenwert Fr. 120'000](https://www.zh.ch/de/steuern-finanzen/steuern/treuhaender/steuerbuch/steuerbuch-definition/zstb-87-3.html) | ok |
| FAQ | [SFBVG, Cash payment on departure abroad](https://sfbvg.ch/en/tasks/cash-payment-on-departure-abroad) | ok |

## Italy (Milan, Lombardy) (IT), `italy/`

Agencies cited: Agenzia delle Entrate, MEF Dipartimento Finanze, INPS.  
Hosts: agenziaentrate.gov.it, www1.finanze.gov.it, inps.it, infoprecompilata.agenziaentrate.gov.it.

| Rule it states | Page | Fetch |
| --- | --- | --- |
| overview; main source | [Agenzia delle Entrate, Regole generali per persone fisiche (residenza fiscale)](https://www.agenziaentrate.gov.it/portale/regole-generali-per-persone-fisiche1) | ok |
| National IRPEF bands; main source; worked example; FAQ | [Agenzia delle Entrate, Aliquote e calcolo dell'Irpef](https://www.agenziaentrate.gov.it/portale/imposta-sul-reddito-delle-persone-fisiche-irpef-/aliquote-e-calcolo-dell-irpef) | ok |
| National IRPEF bands | [Agenzia delle Entrate, Risposte alle domande più frequenti CU 2026 (detrazioni lavoro dipendente)](https://www.agenziaentrate.gov.it/portale/it/risposte-alle-domande-piu-frequenti-cu-2026) | ok |
| Lombardy regional surtax and Milan municipal surtax; main source; FAQ | [MEF Dipartimento Finanze, Addizionale regionale all'Irpef: Regione Lombardia](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?reg=10) | ok |
| Lombardy regional surtax and Milan municipal surtax; main source; FAQ | [MEF Dipartimento Finanze, Addizionale comunale all'Irpef: Comune di Milano](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/nuova_addcomirpef/risultato.htm?anno=9999&cc=F205&cm=&pr=MI&r=1) | ok |
| INPS social contributions; main source; worked example; FAQ | [INPS, Lavoratori dipendenti 2026: massimale contributivo e aliquota aggiuntiva 1%](https://www.inps.it/it/it/inps-comunica/notizie/dettaglio-news-page.news.2026.02.lavoratori-dipendenti-limite-minimo-di-retribuzione-giornaliera-2026.html) | ok |
| INPS social contributions | [INPS, circolare n. 117 del 2022, allegato 1 (aliquote IVS, 9,19% a carico del lavoratore)](https://www.inps.it/content/dam/inps-site/it/scorporati/circolari-e-messaggi/2022/10/Circolare_13970/Allegati/14969_Circolare-numero-117-del-20-10-2022_Allegato-n-1.pdf) | ok |
| Impatriate regime; main source; worked example; tax tip; FAQ | [Agenzia delle Entrate, Lavoratori impatriati: nuovo regime (dal 2024)](https://www.agenziaentrate.gov.it/portale/lavoratori-impatriati-209-2023/infogen-lavoratori-impatriati-209-2023-cittadini) | ok |
| The 730 tax return; main source; tax tip; FAQ | [Agenzia delle Entrate, Quando e come presentare il 730 2026](https://www.agenziaentrate.gov.it/portale/quando-e-come-presentare-il-730-2026-cittadini) | ok |
| The 730 tax return | [Agenzia delle Entrate, La dichiarazione precompilata](https://www.agenziaentrate.gov.it/portale/la-dichiarazione-precompilata-20261) | ok |
| tax tip | [Agenzia delle Entrate, Previdenza complementare: deducibilità entro 5.164,57 euro](https://infoprecompilata.agenziaentrate.gov.it/portale/semplificata-mod-previdenza) | ok |

## Spain (Madrid) (ES), `spain/`

Agencies cited: Agencia Tributaria, BOE.  
Hosts: sede.agenciatributaria.gob.es, boe.es.

| Rule it states | Page | Fetch |
| --- | --- | --- |
| overview; main source | [Agencia Tributaria, Manual IRPF 2025: residencia habitual en territorio español](https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025/c02-irpf-cuestiones-generales/sujecion-irpf-aspectos-personales/residencia-habitual-territorio-espanol.html) | ok |
| State and Madrid IRPF scales; main source; worked example; FAQ | [Agencia Tributaria, Manual IRPF 2025: gravamen estatal (escala general)](https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025/c15-calculo-impuesto-determinacion-cuotas-integras/gravamen-base-liquidable-general/gravamen-estatal.html) | ok |
| State and Madrid IRPF scales; main source; worked example; FAQ | [BOE, Ley 13/2023 de la Comunidad de Madrid: escala autonómica del IRPF](https://www.boe.es/boe/dias/2024/03/21/pdfs/BOE-A-2024-5610.pdf) | ok |
| State and Madrid IRPF scales; main source; worked example; tax tip | [Agencia Tributaria, Manual IRPF 2025: cuadro-resumen del mínimo personal y familiar (estatal)](https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025/c14-adecuacion-impuesto-circunstancias-personales/cuadro-resumen-minimo-personal-familiar.html) | ok |
| State and Madrid IRPF scales; worked example | [Agencia Tributaria, Manual IRPF 2025: Comunidad de Madrid, importes del mínimo personal y familiar](https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025/c14-adecuacion-impuesto-circunstancias-personales/minimo-autonomico-personal-familiar/comunidad-madrid-importes-minimo-personal-familiar.html) | ok |
| Social security; main source; FAQ | [BOE, Orden PJC/297/2026 (cotización a la Seguridad Social 2026): tipos a cargo del trabajador](https://www.boe.es/buscar/act.php?id=BOE-A-2026-7296) | ok |
| The Beckham law; main source; worked example; tax tip; FAQ | [Agencia Tributaria, Manual IRPF 2025: régimen fiscal especial de trabajadores desplazados (escala 24% y 47%)](https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025/c15-calculo-impuesto-determinacion-cuotas-integras/regimen-fiscal-especial-aplicable-trabajadores.html) | ok |
| The Beckham law; FAQ | [Agencia Tributaria, Manual IRPF 2025: régimen fiscal especial aplicable a los trabajadores desplazados a territorio español](https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025/c02-irpf-cuestiones-generales/sujecion-irpf-aspectos-personales/regimen-fiscal-especial-aplicable-trabajadores-desplazados.html) | ok |
| Annual return and monthly withholding; main source; FAQ | [Agencia Tributaria, Manual IRPF 2025: obligación de declarar en el IRPF](https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025/c01-campana-declaracion-renta/quienes-estan-obligados-presentar-declaracion-irpf/delimitacion-obligacion-declarar-irpf.html) | ok |
| tax tip | [Agencia Tributaria, Manual IRPF 2025: límites y exceso de aportaciones a sistemas de previsión social](https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025/c13-determinacion-renta-contribuyente-sujeta-gravamen/reducciones-base-imponible-general/reducciones-aportaciones-contribuciones-sistemas-prevision-social/normas-comunes-aplicables-aportaciones-sistemas-social/limites-exceso-aportaciones.html) | ok |
| FAQ | [BOE, Estatuto de los Trabajadores (Real Decreto Legislativo 2/2015), art. 31 gratificaciones extraordinarias](https://www.boe.es/buscar/act.php?id=BOE-A-2015-11430) | ok |

## Portugal (mainland) (PT), `portugal/`

Agencies cited: Portal das Finanças, Decreto-Lei 212/2026 (IRS rate reduction), PwC Worldwide Tax Summaries, Segurança Social.  
Hosts: info.portaldasfinancas.gov.pt, taxsummaries.pwc.com, seg-social.pt.

| Rule it states | Page | Fetch |
| --- | --- | --- |
| overview; tax tip | [Portal das Finanças, CIRS art. 16 (residence)](https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs_rep/Pages/irs16.aspx) | ok |
| IRS scale for residents; main source; worked example; FAQ | [Portal das Finanças, CIRS art. 68 (general rates, as amended by DL 212/2026)](https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs_rep/Pages/irs68.aspx) | ok |
| IRS scale for residents; main source | [Decreto-Lei 212/2026 (IRS rate reduction)](https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/legislacao/diplomas_legislativos/Documents/decreto-lei-212-2026.pdf) | ok |
| IRS scale for residents; worked example; FAQ | [Portal das Finanças, CIRS art. 25 (employment income deductions)](https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs_rep/Pages/irs25.aspx) | ok |
| IRS scale for residents | [Portal das Finanças, CIRS art. 70 (mínimo de existência)](https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs_rep/Pages/irs70.aspx) | ok |
| IRS scale for residents | [Portal das Finanças, CIRS art. 68-A (solidarity surcharge)](https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs_rep/Pages/irs68a.aspx) | ok |
| Social security; main source; FAQ | [PwC Worldwide Tax Summaries, Portugal: other taxes (social security)](https://taxsummaries.pwc.com/portugal/individual/other-taxes) | ok |
| Social security; main source | [Segurança Social, employees (trabalhadores por conta de outrem)](https://www.seg-social.pt/trabalhadores-por-conta-de-outrem) | busy (503) |
| IRS Jovem; main source; worked example; tax tip; FAQ | [Portal das Finanças, CIRS art. 12-B (IRS Jovem)](https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs_rep/Pages/irs12b.aspx) | ok |
| IFICI, the successor to the NHR regime; main source; worked example; tax tip; FAQ | [Portal das Finanças, EBF art. 58-A (IFICI)](https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/bf_rep/Pages/EBF58A.aspx) | ok |
| IFICI, the successor to the NHR regime | [Portal das Finanças, IFICI frequently asked questions](https://info.portaldasfinancas.gov.pt/pt/apoio_contribuinte/questoes_frequentes/Pages/faqs-00643.aspx) | ok |
| Non-resident rate; main source; worked example; FAQ | [Portal das Finanças, CIRS art. 71 (final withholding, non-residents)](https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs_rep/Pages/irs71.aspx) | ok |
| tax tip | [Portal das Finanças, CIRS art. 78-B (general family expenses)](https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs_rep/Pages/irs78b.aspx) | ok |
| tax tip | [Portal das Finanças, CIRS art. 78 (deductions from the tax)](https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs_rep/Pages/irs78.aspx) | ok |
| tax tip | [Portal das Finanças, EBF art. 21 (PPR retirement savings)](https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/bf/Pages/bf-artigo-21-ordm-.aspx) | ok |

## Norway (NO), `norway/`

Agencies cited: Skatteetaten.  
Hosts: skatteetaten.no.

| Rule it states | Page | Fetch |
| --- | --- | --- |
| overview | [Skatteetaten, Tax liability in Norway](https://www.skatteetaten.no/en/person/taxes/get-the-taxes-right/abroad/tax-residence-in-norway-when-moving-to-or-from-norway/) | ok |
| Ordinary income tax (22%); FAQ | [Skatteetaten, General income](https://www.skatteetaten.no/en/rates/general-income/) | ok |
| Ordinary income tax (22%); main source; worked example; tax tip | [Skatteetaten, Minimum standard deduction](https://www.skatteetaten.no/en/rates/minimum-standard-deduction/) | ok |
| Ordinary income tax (22%); main source | [Skatteetaten, Personal allowance](https://www.skatteetaten.no/en/rates/personal-allowance/) | ok |
| Bracket tax (trinnskatt); main source; worked example; FAQ | [Skatteetaten, Bracket tax](https://www.skatteetaten.no/en/rates/bracket-tax/) | ok |
| National insurance (7.6%); main source; worked example; FAQ | [Skatteetaten, National insurance contributions](https://www.skatteetaten.no/en/rates/national-insurance-contributions/) | ok |
| The PAYE scheme for foreign workers; main source; worked example; tax tip; FAQ | [Skatteetaten, The PAYE scheme](https://www.skatteetaten.no/en/business-and-organisation/employer/the-a-melding/the-a-melding-guide/special-groups/paye-scheme/) | ok |
| The PAYE scheme for foreign workers | [Skatteetaten, PAYE for foreign workers](https://www.skatteetaten.no/en/person/foreign/are-you-intending-to-work-in-norway/tax-deduction-cards/paye/) | ok |
| Tax card and withholding; main source; FAQ | [Skatteetaten, The numbers in your tax deduction card](https://www.skatteetaten.no/en/person/taxes/tax-deduction-card-and-advance-tax/about-tax-deduction-card/the-numbers-in-your-tax-deduction-card/) | ok |
| Tax card and withholding; tax tip; FAQ | [Skatteetaten, How to deduct the correct amount of tax](https://www.skatteetaten.no/en/business-and-organisation/employer/tax-deduction-cards-and-tax-deductions/how-to-deduct-the-correct-amount-of-tax/) | ok |
| tax tip | [Skatteetaten, Deduction for travel between home and work](https://www.skatteetaten.no/en/rates/deduction-for-travel-between-home-and-work/) | ok |
| tax tip | [Skatteetaten, Maximum deduction for individual pension schemes](https://www.skatteetaten.no/en/rates/maximum-annual-deduction-for-payments-to-an-individual-pension-scheme/) | ok |

## Sweden (SE), `sweden/`

Agencies cited: Skatteverket, Maandag.  
Hosts: skatteverket.se, maandag.com.

| Rule it states | Page | Fetch |
| --- | --- | --- |
| overview; Municipal tax and the basic allowance; main source; worked example; tax tip; FAQ | [Skatteverket, Skattesatser kommuner 2026](https://skatteverket.se/download/18.1522bf3f19aea8075ba428/1765291540367/skattesatser-kommuner-2026.txt) | ok |
| overview; main source | [Skatteverket, Skattskyldighet](https://www.skatteverket.se/privat/skatter/arbeteochinkomst/sabeskattasdinlon/skattskyldighet.4.65fc817e1077c25b8328000206.html) | ok |
| Municipal tax and the basic allowance; State tax (20%); Fees, and the tax reductions that offset them; main source; FAQ | [Skatteverket, Belopp och procent inkomstår 2026 (grundavdrag)](https://www.skatteverket.se/privat/skatter/beloppochprocent/2026.4.1522bf3f19aea8075ba21.html) | ok |
| State tax (20%); main source; worked example; FAQ | [Skatteverket, När ska man betala statlig inkomstskatt](https://www.skatteverket.se/privat/etjansterochblanketter/svarpavanligafragor/inkomstavtjanst/privattjansteinkomsterfaq/narskamanbetalastatliginkomstskattochhurhogarden.5.10010ec103545f243e8000166.html) | ok |
| Fees, and the tax reductions that offset them; main source; worked example; FAQ | [Skatteverket, Jobbskatteavdrag](https://www.skatteverket.se/privat/skatter/arbeteochinkomst/skattereduktioner/jobbskatteavdrag.4.6fdde64a12cc4eee2308000107.html) | ok |
| SINK for non-residents; main source; worked example; FAQ | [Skatteverket, SINK](https://www.skatteverket.se/privat/internationellt/bosattutomlands/sinksarskildinkomstskattforutomlandsbosatta.4.6fdde64a12cc4eee23080002583.html) | ok |
| main source | [Skatteverket, A-skattsedel och skattetabeller](https://www.skatteverket.se/privat/skatter/arbeteochinkomst/askattsedelochskattetabeller.4.18e1b10334ebe8bc80005221.html) | ok |
| main source; tax tip | [Maandag, expert tax relief in Sweden: 25% of income tax-free](https://www.maandag.com/en-se/blog/general/expert-tax-relief-in-sweden-keep-25-of-your-income-tax-free) | ok |
| tax tip | [Skatteverket, Forskarskattenämnden (expert tax relief)](https://www.skatteverket.se/sokalias/forskarskattenamnden.4.7856a2b411550b99fb7800086664.html) | ok |
| tax tip | [Skatteverket, Avdrag för resor till och från arbetet](https://www.skatteverket.se/privat/skatter/bilochtrafik/avdragforresortillochfranarbetet.4.3810a01c150939e893f25603.html) | ok |
| tax tip | [Skatteverket, Skatt på investeringssparkonto](https://www.skatteverket.se/privat/skatter/vardepapper/investeringssparkontoisk.4.5fc8c94513259a4ba1d800037851.html) | ok |

## Finland (FI), `finland/`

Agencies cited: Vero.fi, KPMG.  
Hosts: vero.fi, assets.kpmg.com.

| Rule it states | Page | Fetch |
| --- | --- | --- |
| overview; State and municipal income tax; main source | [Vero.fi, Kommunernas och församlingarnas inkomstskattesatser 2026](https://www.vero.fi/sv/Detaljerade_skatteanvisningar/beslut/47465/kommunernas-och-forsamlingarnas-inkomstskattesatser-ar-2026/) | ok |
| State and municipal income tax; main source; worked example; FAQ | [Vero.fi, Ansiotulot: valtion tuloveroasteikko 2026 (state income tax scale)](https://www.vero.fi/henkiloasiakkaat/verokortti-ja-veroilmoitus/tulot/ansiotulot/) | ok |
| State and municipal income tax; Earned income credit; main source; tax tip | [Vero.fi, Deductions calculated automatically by the Tax Administration](https://www.vero.fi/en/individuals/deductions/what-can-I-deduct/these-deductions-are-calculated-automatically-by-the-tax-administration/) | ok |
| State and municipal income tax; main source; worked example; FAQ | [KPMG, Taxation of international executives: Finland (Helsinki 5.30% in 2026)](https://assets.kpmg.com/content/dam/kpmgsites/xx/pdf/2023/01/TIES-Finland.pdf.coredownload.inline.pdf) | ok |
| Contributions deducted from your pay; main source; worked example | [Vero.fi, Social insurance contributions](https://www.vero.fi/en/businesses-and-corporations/taxes-and-charges/being-an-employer/social-insurance-contributions/) | ok |
| Contributions deducted from your pay; Health care contribution, Yle tax and church tax; main source; worked example; FAQ | [Vero.fi, Tax bases for earned income in 2026](https://www.vero.fi/en/individuals/tax-cards-and-tax-returns/tax_card/tax-rate-and-income-ceiling/tax-bases/) | ok |
| Health care contribution, Yle tax and church tax; tax tip; FAQ | [Vero.fi, Earned income (municipal and church tax)](https://www.vero.fi/en/individuals/tax-cards-and-tax-returns/income/earned-income/) | ok |
| The key employee regime; main source; worked example; tax tip; FAQ | [Vero.fi, Key employees from other countries](https://www.vero.fi/en/individuals/tax-cards-and-tax-returns/arriving_in_finland/work_in_finland/specific-instructions-for-different-occupations/key_employees_from_other_countrie/) | ok |
| The key employee regime; tax tip; FAQ | [Vero.fi, Taxation of key employees (detailed guidance)](https://www.vero.fi/en/detailed-guidance/guidance/106825/taxation-of-key-employees4/) | ok |
| main source; FAQ | [Vero.fi, Yleisradiovero (public broadcasting tax guidance)](https://www.vero.fi/syventavat-vero-ohjeet/ohje-hakusivu/48391/yleisradiovero5/) | ok |
| tax tip; FAQ | [Vero.fi, Tax rate and income ceiling](https://www.vero.fi/en/individuals/tax-cards-and-tax-returns/tax_card/tax-rate-and-income-ceiling/) | ok |
| tax tip | [Vero.fi, Commuting expenses](https://www.vero.fi/en/individuals/deductions/travel-expenses/commuting-expenses/) | ok |

## Estonia (EE), `estonia/`

Agencies cited: EMTA, Pensionikeskus.  
Hosts: emta.ee, pensionikeskus.ee.

| Rule it states | Page | Fetch |
| --- | --- | --- |
| overview; main source | [EMTA, Determining residency](https://www.emta.ee/en/private-client/foreigner-non-resident/tax-residency/determining-residency) | ok |
| Flat income tax and the tax-free allowance; main source; worked example; FAQ | [EMTA, Tax rates](https://www.emta.ee/en/private-client/taxes-and-payment/declaration-income/tax-rates) | ok |
| Flat income tax and the tax-free allowance; main source; worked example; tax tip; FAQ | [EMTA, Calculation of basic exemption](https://www.emta.ee/en/private-client/taxes-and-payment/tax-incentives/calculation-basic-exemption) | ok |
| Employee contributions; main source; worked example | [EMTA, Unemployment insurance premiums](https://www.emta.ee/en/business-client/taxes-and-payment/income-and-social-taxes/unemployment-insurance-premiums) | ok |
| Employee contributions; main source; worked example; tax tip; FAQ | [EMTA, Contributions to mandatory funded pension](https://www.emta.ee/en/business-client/taxes-and-payment/income-and-social-taxes/contributions-mandatory-funded-pension) | ok |
| What the employer pays on top; main source; FAQ | [EMTA, Social tax](https://www.emta.ee/en/business-client/taxes-and-payment/income-and-social-taxes/social-tax) | ok |
| main source; tax tip | [EMTA, Contributions to the supplementary funded pension](https://www.emta.ee/en/private-client/taxes-and-payment/tax-incentives/contributions-supplementary-funded-pension) | ok |
| tax tip | [Pensionikeskus, III pillar tax refund Q&A](https://pensionikeskus.ee/en/iii-pillar/contributions/questions-and-answers-about-the-iii-pillar-tax-refund) | ok |

## Japan (Tokyo) (JP), `japan/`

Agencies cited: NTA, Tokyo Bureau of Taxation, Kyokai Kenpo, MHLW, Social insurance in Japan explained: employment insurance 0.5% employee share (FY2026), Japan Pension Service, iDeCo official site.  
Hosts: nta.go.jp, tax.metro.tokyo.lg.jp, kyoukaikenpo.or.jp, mhlw.go.jp, fukuyoshi-trading.com, nenkin.go.jp, ideco-koushiki.jp.

| Rule it states | Page | Fetch |
| --- | --- | --- |
| overview; Non-residents; FAQ | [NTA, Tax Answer No.2875: residents and non-residents](https://www.nta.go.jp/taxes/shiraberu/taxanswer/gensen/2875.htm) | ok |
| National income tax rates; main source; worked example; FAQ | [NTA, Tax Answer No.2260: income tax rates](https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm) | ok |
| National income tax rates | [NTA, Tax Answer No.1199: basic deduction](https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1199.htm) | ok |
| Employment income deduction; main source; worked example | [NTA, Tax Answer No.1410: employment income deduction](https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1410.htm) | ok |
| Resident tax; main source; worked example; FAQ | [Tokyo Bureau of Taxation, individual resident tax](https://www.tax.metro.tokyo.lg.jp/kazei/life/kojin_ju) | ok |
| Social insurance; main source; worked example; FAQ | [Kyokai Kenpo, FY2026 Tokyo premium table (PDF)](https://www.kyoukaikenpo.or.jp/assets/R8_13tokyo.pdf) | ok |
| Social insurance | [MHLW, employment insurance premium rates](https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000108634.html) | ok |
| Social insurance; main source | [Social insurance in Japan explained: employment insurance 0.5% employee share (FY2026)](https://fukuyoshi-trading.com/careers/guides/social-insurance-japan-explained) | ok |
| Non-residents; main source; worked example; tax tip; FAQ | [NTA, Tax Answer No.2884: withholding rates for non-residents](https://www.nta.go.jp/taxes/shiraberu/taxanswer/gensen/2884.htm) | ok |
| main source; tax tip; FAQ | [Japan Pension Service, leaving Japan (lump-sum withdrawal payment)](https://www.nenkin.go.jp/international/english/scene/leavejapan/index.html) | ok |
| main source; tax tip; FAQ | [NTA, Tax Answer No.2665: year-end adjustment](https://www.nta.go.jp/taxes/shiraberu/taxanswer/gensen/2665.htm) | ok |
| tax tip | [iDeCo official site, features of iDeCo](https://www.ideco-koushiki.jp/guide/) | ok |
| tax tip | [NTA, Tax Answer No.1155: furusato nozei](https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1155.htm) | ok |

## South Korea (KR), `south-korea/`

Agencies cited: PwC Worldwide Tax Summaries, NTS, National Law Information Center, NTS English, NHIS, NPS.  
Hosts: taxsummaries.pwc.com, nts.go.kr, law.go.kr, nhis.or.kr, nps.or.kr.

| Rule it states | Page | Fetch |
| --- | --- | --- |
| overview | [PwC Worldwide Tax Summaries, Korea: residence](https://taxsummaries.pwc.com/republic-of-korea/individual/residence) | ok |
| National income tax rates; main source; worked example; FAQ | [NTS, comprehensive income tax rates](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=2227&cntntsId=7667) | no connection |
| National income tax rates; tax tip | [PwC Worldwide Tax Summaries, Korea: deductions](https://taxsummaries.pwc.com/republic-of-korea/individual/deductions) | ok |
| Earned income deduction; main source; worked example | [NTS, earned income deduction table](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=6435&cntntsId=7871) | no connection |
| Earned income deduction | [National Law Information Center, Income Tax Act Article 47 (earned income deduction)](https://www.law.go.kr/LSW/lsLawLinkInfo.do?lsJoLnkSeq=1001060719&lsId=001565&chrClsCd=010202&print=print) | no connection |
| Local income tax and the 19% flat election; main source; FAQ | [PwC Worldwide Tax Summaries, Korea: taxes on personal income and local income tax](https://taxsummaries.pwc.com/republic-of-korea/individual/taxes-on-personal-income) | ok |
| Local income tax and the 19% flat election; main source; worked example; tax tip; FAQ | [PwC Worldwide Tax Summaries, Korea: flat 19% for foreign employees](https://taxsummaries.pwc.com/republic-of-korea/individual/income-determination) | ok |
| Local income tax and the 19% flat election; worked example; tax tip; FAQ | [NTS English, Forms (Application of Flat Tax Rate for Foreign Employees)](https://www.nts.go.kr/english/cm/cntnts/cntntsView.do?cntntsId=8664&mi=10791) | no connection |
| Social insurance; main source; worked example; FAQ | [PwC Worldwide Tax Summaries, Korea: social security contributions](https://taxsummaries.pwc.com/republic-of-korea/individual/other-taxes) | ok |
| Social insurance; main source; FAQ | [NHIS, contribution rate](https://www.nhis.or.kr/english/wbheaa02500m01.do) | no connection |
| main source; tax tip; FAQ | [NPS, Guide to the National Pension for Foreigners (PDF)](https://www.nps.or.kr/html/download/guide_for_foreigners_3.pdf) | ok |
| tax tip; FAQ | [PwC Worldwide Tax Summaries, Korea: tax administration and year-end settlement](https://taxsummaries.pwc.com/republic-of-korea/individual/tax-administration) | ok |

## China (Shanghai) (CN), `china/`

Agencies cited: STA, Shanghai STA, PwC Worldwide Tax Summaries, Shanghai HRSS, Shanghai government, NNRoad, MOF and STA Announcement 2023 No. 29 (foreigners' allowances).  
Hosts: chinatax.gov.cn, shanghai.chinatax.gov.cn, taxsummaries.pwc.com, rsj.sh.gov.cn, shanghai.gov.cn, nnroad.com, gov.cn, fgk.chinatax.gov.cn.

| Rule it states | Page | Fetch |
| --- | --- | --- |
| overview; Individual income tax rates; main source; tax tip; FAQ | [STA, Individual Income Tax Law of the PRC (residency and filing)](https://www.chinatax.gov.cn/chinatax/n810219/n810744/n3752930/n3752974/c3970366/content.html) | ok |
| Individual income tax rates; main source; worked example; FAQ | [Shanghai STA, IIT rate table for comprehensive income (PDF)](https://shanghai.chinatax.gov.cn/zcfw/zcfgk/grsds/202402/P020240202362406243753.pdf) | ok |
| Social insurance and the housing fund; main source; worked example; FAQ | [PwC Worldwide Tax Summaries, China: social insurance rates (Shanghai)](https://taxsummaries.pwc.com/peoples-republic-of-china/individual/other-taxes) | ok |
| Social insurance and the housing fund; main source | [Shanghai HRSS, 2025 social insurance base limits](https://rsj.sh.gov.cn/tgsgg_17341/20250918/t0035_1435637.html) | ok |
| Social insurance and the housing fund; main source; worked example | [Shanghai HRSS, 2026 social insurance base limits](https://rsj.sh.gov.cn/tgsgg_17341/20260818/t0035_1443203.html) | ok |
| Social insurance and the housing fund; tax tip | [Shanghai government, housing fund base adjustment notice](https://www.shanghai.gov.cn/nw17239/20250704/649d8a7b2b1b4ceab2107b8d84fe805e.html) | ok |
| Social insurance and the housing fund; main source; worked example | [NNRoad, housing fund rates by city (Shanghai 5% to 7%, employee the same)](https://nnroad.com/blog/housing-fund-agency-in-china/) | ok |
| Expat tax-free allowances and special deductions; main source; worked example; tax tip; FAQ | [MOF and STA Announcement 2023 No. 29 (foreigners' allowances)](https://www.gov.cn/zhengce/zhengceku/202308/content_6900701.htm) | ok |
| Monthly cumulative withholding; main source; FAQ | [STA, Administrative Measures for Individual Income Tax Withholding (cumulative method)](https://fgk.chinatax.gov.cn/zcfgk/c100015/c5200946/content.html) | ok |
| tax tip; FAQ | [PwC Worldwide Tax Summaries, China: tax administration and annual reconciliation](https://taxsummaries.pwc.com/peoples-republic-of-china/individual/tax-administration) | ok |

## Taiwan (China) (TW), `taiwan/`

Agencies cited: MOF eTax Portal, Laws and Regulations Database, National Taxation Bureau of Taipei, Bureau of Labor Insurance, NHIA, Ministry of Labor.  
Hosts: etax.nat.gov.tw, law.moj.gov.tw, ntbt.gov.tw, bli.gov.tw, nhi.gov.tw, mol.gov.tw.

| Rule it states | Page | Fetch |
| --- | --- | --- |
| overview; Tax for non-residents; main source; worked example; tax tip; FAQ | [MOF eTax Portal, Instructions for Alien Individual Income Tax (183-day rule)](https://www.etax.nat.gov.tw/etwmain/en/announcement/alien-individual-income-tax/instructions) | ok |
| Tax rates for residents; main source; worked example; FAQ | [MOF eTax Portal, Progressive Tax Rate (residents)](https://www.etax.nat.gov.tw/etwmain/en/announcement/alien-individual-income-tax/progressive-tax-rate) | ok |
| Tax rates for residents; main source; worked example; tax tip | [MOF eTax Portal, Table of Exemption and Deduction](https://www.etax.nat.gov.tw/etwmain/en/announcement/alien-individual-income-tax/exemption-deduction-table) | ok |
| Gold Card relief; main source; worked example; tax tip; FAQ | [Laws and Regulations Database, Act for the Recruitment and Employment of Foreign Professionals](https://law.moj.gov.tw/ENG/LawClass/LawAll.aspx?pcode=A0030295) | ok |
| Gold Card relief; tax tip; FAQ | [National Taxation Bureau of Taipei, tax reduction for foreign specialist professionals](https://www.ntbt.gov.tw/English/multiplehtml/14cdeff61f1a49e18263cd0b8766737a) | ok |
| Social insurance; main source; worked example; FAQ | [Bureau of Labor Insurance, premium calculator (labour insurance 11.5%, employment insurance 1%, top grade NT$45,800)](https://www.bli.gov.tw/0014162.html) | ok |
| Social insurance; main source | [NHIA, premium table (rate 5.17%, top insured amount NT$313,000)](https://www.nhi.gov.tw/ch/dl-93508-d686c1e5bad442a08382e5eb648ae512-1.pdf) | ok |
| Social insurance; main source; worked example | [Ministry of Labor, employment insurance coverage of foreign workers](https://www.mol.gov.tw/1607/1632/1640/45895/) | ok |
| tax tip | [Bureau of Labor Insurance, Labor Pension Act (voluntary contribution)](https://www.bli.gov.tw/en/0010376.html) | ok |

## Hong Kong (China) (HK), `hong-kong/`

Agencies cited: IRD, MPFA.  
Hosts: ird.gov.hk, mpfa.org.hk.

| Rule it states | Page | Fetch |
| --- | --- | --- |
| overview; main source; FAQ | [IRD, A guide to Salaries Tax (2): which income is assessable](https://www.ird.gov.hk/eng/pdf/pam40e.pdf) | ok |
| Progressive rates and the standard rate; Allowances; main source; worked example; tax tip; FAQ | [IRD, Allowances, deductions and tax rate table](https://www.ird.gov.hk/eng/pdf/pam61e.pdf) | ok |
| Progressive rates and the standard rate; main source; tax tip; FAQ | [IRD, A guide to Salaries Tax (1): how to compute Salaries Tax](https://www.ird.gov.hk/eng/pdf/pam39e.pdf) | ok |
| Allowances; main source; worked example | [IRD, 2026-27 Budget](https://www.ird.gov.hk/eng/tax/budget.htm) | ok |
| MPF contributions; main source; FAQ | [MPFA, Contributions](https://www.mpfa.org.hk/eng/mpf_system/system_features/contributions/index.jsp) | ok |
| main source; tax tip | [IRD, A brief guide to personal assessment](https://www.ird.gov.hk/eng/pdf/pam37e.pdf) | ok |

## Indonesia (ID), `indonesia/`

Agencies cited: PwC Worldwide Tax Summaries, DJP, BPJS Ketenagakerjaan.  
Hosts: taxsummaries.pwc.com, pajak.go.id, bpjsketenagakerjaan.go.id.

| Rule it states | Page | Fetch |
| --- | --- | --- |
| overview; main source; tax tip; FAQ | [PwC Worldwide Tax Summaries, Indonesia: individual residence (183 days)](https://taxsummaries.pwc.com/indonesia/individual/residence) | ok |
| overview; PPh 21 tax rates for residents; main source; worked example; tax tip; FAQ | [PwC Worldwide Tax Summaries, Indonesia: non-resident individuals, 20% withholding](https://taxsummaries.pwc.com/indonesia/individual/taxes-on-personal-income) | ok |
| PPh 21 tax rates for residents; main source; worked example; FAQ | [DJP, PPh individual rate layers under the HPP Law (5% to 35%)](https://pajak.go.id/en/node/90251) | moved (404) |
| PTKP: the non-taxable allowance and its status codes; main source; worked example; tax tip; FAQ | [DJP, PER-16/PJ/2016 Article 11 (annual PTKP amounts)](https://pajak.go.id/index.php/en/node/62542) | moved (404) |
| Job expense deduction and employer premiums; BPJS social security contributions; main source; tax tip | [PwC Worldwide Tax Summaries, Indonesia: deductions (job expense, JHT, JP cap, PTKP)](https://taxsummaries.pwc.com/indonesia/individual/deductions) | ok |
| BPJS social security contributions; main source; FAQ | [BPJS Ketenagakerjaan, JHT, JKK, JKM, JP and JKP contribution rates](https://www.bpjsketenagakerjaan.go.id/artikel/18913/artikel-berapa-besaran-iuran-jht%2C-jkk%2C-jkm%2C-jp-dan-jkp) | ok |
| BPJS social security contributions; main source | [PwC Worldwide Tax Summaries, Indonesia: BPJS contributions and calculation base](https://taxsummaries.pwc.com/indonesia/individual/other-taxes) | ok |
| How tax is withheld during the year (TER); main source; FAQ | [DJP, PMK 168/2023: monthly TER and the final-period rule](https://pajak.go.id/en/node/104139) | moved (404) |
| FAQ | [DJP, deadlines for filing returns (SPT Tahunan, 31 March)](https://www.pajak.go.id/en/node/35019) | moved (404) |

## Malaysia (MY), `malaysia/`

Agencies cited: PwC Worldwide Tax Summaries, LHDN, KWSP, PERKESO.  
Hosts: taxsummaries.pwc.com, hasil.gov.my, kwsp.gov.my, perkeso.gov.my.

| Rule it states | Page | Fetch |
| --- | --- | --- |
| overview; main source; tax tip; FAQ | [PwC Worldwide Tax Summaries, Malaysia individual residence](https://taxsummaries.pwc.com/malaysia/individual/residence) | ok |
| Tax rates for residents; main source; worked example; FAQ | [LHDN, Individual tax rate](https://www.hasil.gov.my/en/individual/individual-life-cycle/income-declaration/tax-rate/) | moved (404) |
| Non-residents; main source; worked example; FAQ | [LHDN, Introduction to individual income tax](https://www.hasil.gov.my/en/individu/pengenalan-cukai-pendapatan-individu/) | ok |
| Reliefs and the rebate; main source; tax tip | [LHDN, Tax reliefs](https://www.hasil.gov.my/en/individual/individual-life-cycle/income-declaration/tax-reliefs/) | moved (404) |
| EPF, SOCSO and LINDUNG 24 Jam; main source; tax tip | [KWSP, Contribute as a member](https://www.kwsp.gov.my/en/member/overview/contribution) | blocked (403) |
| EPF, SOCSO and LINDUNG 24 Jam; worked example; FAQ | [KWSP, Contribution for non-Malaysian citizen employees](https://www.kwsp.gov.my/en/employer/responsibilities/non-malaysian-citizen-employees) | blocked (403) |
| EPF, SOCSO and LINDUNG 24 Jam; main source | [PERKESO, Contributions](https://www.perkeso.gov.my/en/our-services/employer-employee/contributions.html) | no connection |
| main source; FAQ | [PERKESO, New contribution rate (LINDUNG 24 Jam)](https://www.perkeso.gov.my/images/lindung/lindung-24-jam/NewContributionRateIncludingSKBBK.pdf) | no connection |
| FAQ | [LHDN, Specification for monthly tax deduction (MTD/PCB) 2026](https://www.hasil.gov.my/wp-content/uploads/spesifikasi-kaedah-pengiraan-berkomputer-pcb-2026.pdf) | ok |
| FAQ | [PERKESO, Foreign workers (LINDUNG Pekerja)](https://www.perkeso.gov.my/en/our-services/protection/foreign-worker.html) | no connection |

## Thailand (TH), `thailand/`

Agencies cited: Revenue Department, PwC Worldwide Tax Summaries, Louis Group.  
Hosts: rd.go.th, taxsummaries.pwc.com, louisgrouplaw.com.

| Rule it states | Page | Fetch |
| --- | --- | --- |
| overview; main source; FAQ | [Revenue Department, Personal Income Tax: resident and non-resident](https://www.rd.go.th/english/6045.html) | ok |
| overview; Tax rates for residents; Employment expense deduction and allowances; main source; worked example; tax tip; FAQ | [Revenue Department, PND 91 guide (rate table, 50% or 100,000 baht deduction, allowances)](https://rd.go.th/fileadmin/download/english_form/2024/GUIDE_91_67_Complete.pdf) | ok |
| Tax rates for residents; main source; worked example; FAQ | [PwC Worldwide Tax Summaries, Thailand: personal income tax rates](https://taxsummaries.pwc.com/thailand/individual/taxes-on-personal-income) | ok |
| Employment expense deduction and allowances; main source; FAQ | [PwC Worldwide Tax Summaries, Thailand: deductions](https://taxsummaries.pwc.com/thailand/individual/deductions) | ok |
| Social security; main source; FAQ | [PwC Worldwide Tax Summaries, Thailand: social security (5%, up to THB 875 a month)](https://taxsummaries.pwc.com/thailand/individual/other-taxes) | ok |
| Social security; main source; FAQ | [Louis Group, Thai labour law: social security wage ceiling THB 17,500 from January 2026](https://www.louisgrouplaw.com/en/insight/thailand-labour-law-foreign-employers/) | ok |
| main source; FAQ | [PwC Worldwide Tax Summaries, Thailand: foreign-sourced income](https://taxsummaries.pwc.com/thailand/individual/income-determination) | ok |

## United Arab Emirates (AE), `united-arab-emirates/`

Agencies cited: UAE Government portal, PwC Worldwide Tax Summaries, GPSSA.  
Hosts: u.ae, taxsummaries.pwc.com, gpssa.gov.ae.

| Rule it states | Page | Fetch |
| --- | --- | --- |
| No personal income tax on salary; main source; worked example; FAQ | [UAE Government portal, Taxation: no income tax on individuals](https://u.ae/en/information-and-services/finance-and-investment/taxation) | ok |
| No personal income tax on salary; main source; FAQ | [PwC Worldwide Tax Summaries, UAE: no personal income tax](https://taxsummaries.pwc.com/united-arab-emirates/individual/taxes-on-personal-income) | ok |
| GPSSA pension for UAE nationals; main source; worked example; FAQ | [GPSSA, main features of Federal Decree-Law 57 of 2023 (rates and AED 70,000 ceiling)](https://gpssa.gov.ae/pages/en/media-center/news/gpssa-reviews-most-prominent-features-federal-law-no-57-2023) | ok |
| Expats: gratuity instead of a pension; main source; tax tip; FAQ | [UAE Government portal, End of service benefits for private sector workers](https://u.ae/en/information-and-services/jobs/Sector-of-employment/employment-in-the-private-sector/end-of-service-benefits-for-employees-in-the-private-sector) | ok |

## Saudi Arabia (SA), `saudi-arabia/`

Agencies cited: PwC Worldwide Tax Summaries, Saudi Press Agency, GOSI, Teamed, HRSD.  
Hosts: taxsummaries.pwc.com, spa.gov.sa, gosi.gov.sa, teamed.global, hrsd.gov.sa.

| Rule it states | Page | Fetch |
| --- | --- | --- |
| No personal income tax on salary; main source; worked example; FAQ | [PwC Worldwide Tax Summaries, Saudi Arabia: no individual income tax](https://taxsummaries.pwc.com/saudi-arabia/individual/taxes-on-personal-income) | ok |
| GOSI for Saudi nationals: legacy and new entrants; worked example; FAQ | [Saudi Press Agency, GOSI announcement of 30 June 2025: pension branch rate rises 0.5% a year to 11% for new entrants (Royal Decree M/273)](https://www.spa.gov.sa/N2349640) | ok |
| GOSI for Saudi nationals: legacy and new entrants; main source; worked example; tax tip; FAQ | [GOSI, Annuities Branch (9% employee, SAR 45,000 cap)](https://www.gosi.gov.sa/GOSIOnline/Annuity&locale=en_US) | ok |
| GOSI for Saudi nationals: legacy and new entrants; Expats: employer-paid hazards premium only; main source; worked example; FAQ | [GOSI, Contributor FAQ: SANED rate (0.75% employee)](https://www.gosi.gov.sa/GOSIOnline/FAQ_Contributor&locale=en_US) | ok |
| GOSI for Saudi nationals: legacy and new entrants; main source; worked example; FAQ | [Teamed, Saudi GOSI: SANED 0.75% each side, SAR 45,000 cap](https://www.teamed.global/gulf-employment-law/saudi-gosi-and-2025-amendments) | ok |
| Expats: employer-paid hazards premium only; main source; FAQ | [HRSD, End-of-service award regulations](https://www.hrsd.gov.sa/en/knowledge-centre/articles/317-0) | ok |
| main source | [PwC Worldwide Tax Summaries, Saudi Arabia: social insurance for Saudi and non-Saudi employees](https://taxsummaries.pwc.com/saudi-arabia/individual/other-taxes) | ok |

## Qatar (QA), `qatar/`

Agencies cited: PwC Worldwide Tax Summaries, Al Meezan, TRC.  
Hosts: taxsummaries.pwc.com, almeezan.qa, trustrc.com.

| Rule it states | Page | Fetch |
| --- | --- | --- |
| overview; No personal income tax on salary; main source; worked example; FAQ | [PwC Worldwide Tax Summaries, Qatar: taxes on personal income](https://taxsummaries.pwc.com/qatar/individual/taxes-on-personal-income) | ok |
| GRSIA pension for Qatari nationals; main source; worked example; FAQ | [Al Meezan, Qatar Social Insurance Law No. 1 of 2022 (GRSIA contributions, 7% employee, cap 100,000 a month)](https://www.almeezan.qa/LawView.aspx?LawID=8932&language=en) | ok |
| GRSIA pension for Qatari nationals; main source; worked example; FAQ | [TRC, Qatar retirement and pension law: 7% employee, 14% employer, QAR 100,000 monthly ceiling](https://trustrc.com/en/qatar-new-retirement-pension-scheme/) | ok |
| Expats: no pension, an end-of-service gratuity; main source; tax tip; FAQ | [Al Meezan, Qatar Labour Law No. 14 of 2004 (end-of-service gratuity)](https://www.almeezan.qa/LawView.aspx?LawID=3961&language=en) | ok |
| main source | [PwC Worldwide Tax Summaries, Qatar: other taxes, social security contributions](https://taxsummaries.pwc.com/qatar/individual/other-taxes) | ok |

## Bahrain (BH), `bahrain/`

Agencies cited: PwC Worldwide Tax Summaries, Social Insurance Organization (SIO) Bahrain, Bahrain Unemployment Insurance Law.  
Hosts: taxsummaries.pwc.com, sio.gov.bh, bahrainbusinesslaws.com.

| Rule it states | Page | Fetch |
| --- | --- | --- |
| overview; No personal income tax on salary; main source; FAQ | [PwC Worldwide Tax Summaries, Bahrain: taxes on personal income](https://taxsummaries.pwc.com/bahrain/individual/taxes-on-personal-income) | ok |
| SIO contributions; main source; worked example; FAQ | [PwC Worldwide Tax Summaries, Bahrain: other taxes, social insurance contributions](https://taxsummaries.pwc.com/bahrain/individual/other-taxes) | ok |
| SIO contributions; main source; worked example; FAQ | [Social Insurance Organization (SIO) Bahrain, Law No. 24 of 1976 (social insurance)](https://www.sio.gov.bh/en/law-no-24-of-1976) | ok |
| SIO contributions; main source; worked example; FAQ | [Bahrain Unemployment Insurance Law, Article 6: 1% of the wage from the insured](https://bahrainbusinesslaws.com/laws/Unemployment-Insurance-Law) | ok |
| End-of-service benefit for expats; main source; tax tip; FAQ | [Social Insurance Organization (SIO) Bahrain, end-of-service gratuity for non-Bahrainis](https://www.sio.gov.bh/en/end-of-service-gratuity-for-non-bahrainis) | ok |

## Kuwait (KW), `kuwait/`

Agencies cited: PwC Worldwide Tax Summaries, PIFSS.  
Hosts: taxsummaries.pwc.com, pifss.gov.kw.

| Rule it states | Page | Fetch |
| --- | --- | --- |
| overview; No personal income tax on salary; main source; worked example; FAQ | [PwC Worldwide Tax Summaries, Kuwait: taxes on personal income](https://taxsummaries.pwc.com/kuwait/individual/taxes-on-personal-income) | ok |
| PIFSS contributions for Kuwaiti nationals; Expats: no social insurance; main source; worked example; FAQ | [PIFSS, business owners FAQ: monthly contribution ratios for the insured and employers](https://www.pifss.gov.kw/sites/En/Pages/PensionSocialSecuritySector/FAQ.aspx?PID=YYH9cYwZKl8mrS+LNcoYzQ%3D%3D) | ok |
| PIFSS contributions for Kuwaiti nationals | [PIFSS, FAQ: salary elements subject to basic and supplementary insurance](https://www.pifss.gov.kw/sites/En/Pages/PensionSocialSecuritySector/FAQ.aspx) | ok |
| Expats: no social insurance; main source; worked example; tax tip; FAQ | [PwC Worldwide Tax Summaries, Kuwait: other taxes, social security contributions](https://taxsummaries.pwc.com/kuwait/individual/other-taxes) | ok |

## Oman (OM), `oman/`

Agencies cited: PwC Worldwide Tax Summaries, Royal Decree 52/2023, Royal Decree 53/2023.  
Hosts: taxsummaries.pwc.com, decree.om.

| Rule it states | Page | Fetch |
| --- | --- | --- |
| overview; No personal income tax in 2026, a new tax from 2028; main source; worked example; tax tip; FAQ | [PwC Worldwide Tax Summaries, Oman: taxes on personal income (5% above OMR 42,000 from 2028)](https://taxsummaries.pwc.com/oman/individual/taxes-on-personal-income) | ok |
| Social Protection Fund for Omani nationals; main source; worked example; FAQ | [Royal Decree 52/2023, Social Protection Law (Articles 52 and 70: 7.5% insured share, OMR 3,000 ceiling)](https://decree.om/2023/rd20230052/) | ok |
| Social Protection Fund for Omani nationals; main source; worked example; FAQ | [PwC Worldwide Tax Summaries, Oman: other taxes, social security contributions (8% employee in total)](https://taxsummaries.pwc.com/oman/individual/other-taxes) | ok |
| Expats: no social insurance; main source; FAQ | [Royal Decree 53/2023, Labour Law (end-of-service gratuity)](https://decree.om/2023/rd20230053/) | ok |
