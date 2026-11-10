# Global Income Tax Calculator: notes for the AI section

Hand-written. `node _ref/agent-doc.mjs` merges these notes with the fields it reads from the
page and writes the skill reference (`ai/skill/references/`), the AI section in `index.html` and the line in
`llms.txt`. Edit here, never the generated text, then run the generator. Text above the first
heading (this) is not published. The headings are the same for every tool; see
`rentvsownhouse/agent-notes.md` for what each one holds.

The form shows one job at a time. Plain field keys set job 1. Up to four jobs travel in the
`json` key (Json below), and a Quick Start brings its own four. The display options
(dispCur, dispPer, chartMeasure) belong to the page, not to a job.

## Decides

Take-home pay after income tax and employee social contributions for one to four jobs in 31 countries and every US state, under 2026 rules, from gross to net or net to gross, with each line of the sum named, sourced and dated, and which job leaves the most.

## Most important

- country
- dir
- amount
- period
- usState
- usFiling
- caProv
- ukRegion
- dispCur

## Fields

- country: The country the job is in, by ISO code: AU, CN (Shanghai rules), HK, ID, JP (Tokyo rules), MY, SG, KR, TW, TH, BE, EE, FI, FR, DE, IT (Milan rules), NL, NO, PT (mainland), ES (Madrid rules), SE, CH (City of Zurich rules), GB, CA, US, BH, KW, OM, QA, SA, AE. A country's other fields only count when it is picked.
- usState: US only. The state, by its two-letter code (DC for Washington DC). States with no tax on wages: AK, FL, NV, NH, SD, TN, TX, WA, WY. Not loaded yet, and the tool says so instead of a figure: AL, CT, ME, MN, NM, OH, OR, RI, SC, UT, WI.
- usNyc: US, New York only. true adds New York City resident tax.
- caProv: Canada only. ON, BC, AB or QC. Other provinces are not loaded.
- ukRegion: UK only. ruk (England, Wales or Northern Ireland) or sco (Scotland), which sets the income tax bands.
- dir: gross: amount is gross pay before tax. net: amount is the take-home pay wanted, and the tool solves for the gross that leaves it.
- amount: The pay in the job's own currency (dollars for US, euros for FR, yen for JP), per period. Send the number alone, no currency.
- period: yearly or monthly, the period amount is per. A monthly salary paid 12 times a year is monthly; for 13th or 14th month pay, send the yearly total as yearly.
- auRes: Australia. pr (citizen or permanent resident), temp (temporary resident, Medicare-exempt), foreign (foreign resident) or whm (working holiday maker).
- sgRes: Singapore. ep (Employment Pass or S Pass, no CPF), citizen (citizen, or PR from year 3), pr1, pr2 (permanent resident in year 1 or 2) or nonres (under 183 days).
- sgAge: Singapore citizens and PRs from year 3. Age band for the CPF rate: 55, 60, 65, 70 or 99 (above 70).
- usRes: US. res (citizen or resident) or nra (nonresident alien: no standard deduction, files as single; most new H-1B, L-1, F-1 holders in their first year).
- deClass: Germany. I (single) or III (married, partner earns little or nothing).
- idRes: Indonesia. res or nonres (under 183 days: 20% of gross, final).
- myRes: Malaysia. citizen (citizen or PR), expat (tax resident, 182 days or more) or nonres (30% flat).
- nlRuling: Netherlands. true for the 30% ruling (a recruited expat above the salary norm).
- noRes: Norway. res (ordinary tax) or paye (25% flat scheme for short stays, up to 725,050 a year).
- noNi: Norway, PAYE only. false when not a member of Norwegian national insurance (17.4%).
- seRes: Sweden. res or sink (non-resident, 22.5% flat).
- fiRes: Finland. res or key (key employee 25% flat, needs 5,800 a month or more).
- beExpat: Belgium. true for the expat regime (35% of gross tax-free; needs more than 70,000 a year).
- itImp: Italy. none, imp50 (impatriate, 50% exempt) or imp60 (impatriate with a minor child, 60% exempt).
- frCadre: France. noncadre or cadre.
- frImp: France. true for the impatriate regime (30% of pay exempt from income tax).
- esRegime: Spain. res or beckham (24% flat to 600,000).
- ptRegime: Portugal. res, jovem (IRS Jovem), ifici (20% flat) or nonres (25% flat).
- ptJovemYear: Portugal, IRS Jovem only. Year of work, 1 to 10.
- jpRes: Japan. y2 (resident, year 2 or later), y1 (first year: no resident tax yet) or nonres (20.42% flat).
- krMethod: South Korea. prog (progressive) or flat (19% election for foreign workers).
- cnRes: China. local (standard) or expat (tax-free allowances in cnAllow).
- twRes: Taiwan (China). res (183 days or more) or nonres.
- twGold: Taiwan (China) residents. true for a Gold Card holder (50% of salary above 3,000,000 excluded).
- gulfNat: UAE, Qatar, Saudi Arabia, Bahrain, Kuwait, Oman. expat or national. None of them taxes wages; nationals pay pension contributions.
- saScheme: Saudi nationals. legacy (joined GOSI before 3 Jul 2024) or new (new entrant).
- usFiling: US residents. S (single) or MFJ (married filing jointly).
- deKids: Germany. true if the employee has children (lowers long-term care).
- idMarried: Indonesia, residents. true if married.
- idDeps: Indonesia, residents. Dependants, 0 to 3.
- thSpouse: Thailand. true for a spouse with no income.
- thKids: Thailand. Children born before 2018, 0 to 6.
- thKidsNew: Thailand. Children born 2018 or later, 0 to 6.
- mySpouse: Malaysia, residents. true for a spouse with no income.
- myKids: Malaysia, residents. Children, 0 to 8.
- beStatus: Belgium. single or married (married or legal cohabitant, partner with no professional income).
- beKids: Belgium. Dependent children, 0 to 8.
- beSingleParent: Belgium, single with children. true for a single parent.
- chStatus: Switzerland. single or married (sole earner).
- chKids: Switzerland, married only. Children, 0 to 6.
- frMarried: France. true for a married or PACS couple taxed jointly.
- frKids: France. Children, 0 to 6.
- esKids: Spain, residents. Children, 0 to 6.
- ptDepOld: Portugal. Dependants aged 7 or over, 0 to 4.
- ptDepMid: Portugal. Dependants aged 4 to 6, 0 to 4.
- ptDepYoung: Portugal. Dependants aged 3 or under, 0 to 4.
- caKids: Canada, Ontario only. Children 18 or under, 0 to 6 (Ontario Tax Reduction).
- hkMarried: Hong Kong (China). true for married with a partner with no income.
- hkKids: Hong Kong (China). Children, 0 to 6.
- twStatus: Taiwan (China) residents. single or married (filing jointly).
- twKids: Taiwan (China) residents. Minor children, 0 to 6.
- krDeps: South Korea, progressive method. Dependants beyond the employee, 0 to 6.
- auCover: Australia, citizens and PRs. false when there is no private hospital cover (adds the Medicare levy surcharge above 105,000).
- auSuper: Australia. true when the amount is a package that includes the 12% super guarantee.
- ukLoan: UK. none, plan1, plan2, plan4 or plan5 student loan.
- ukPg: UK. true for a postgraduate loan.
- deChurch: Germany. 0, 8 (Bavaria, Baden-Württemberg) or 9 (other states) church tax.
- deAddOn: Germany. Health fund add-on rate in %, 2.9 on average.
- usLocal: US. Local or county income tax on wages in %, such as a Maryland county or Philadelphia. 0 when none.
- usNyDbl: US, New York. false if the employer does not take the disability contribution from pay.
- usFicaExempt: US, nonresident alien only. true for F, J, M or Q status (no Social Security or Medicare).
- idJkk: Indonesia, residents. Work accident premium rate: 0.24, 0.54, 0.89, 1.27 or 1.74 by the industry's risk.
- idBpjs: Indonesia, non-residents. false if no BPJS contributions are paid.
- myLindung: Malaysia, expat residents. true to claim LINDUNG as SOCSO relief (unconfirmed for expats).
- nlNorm: Netherlands, with the 30% ruling. std (salary norm 48,013) or young (under 30 with a master's, 36,497).
- nlHoliday: Netherlands. true (default): amount excludes the 8% holiday allowance and it is added. false: amount already includes it.
- nlPension: Netherlands. Employee pension contribution in % of gross.
- seMun: Sweden, residents. Municipal tax rate in %: 30.55 for Stockholm, 32.38 national average.
- seBurial: Sweden, residents. Burial fee in %, 0.292 on average.
- eeP2: Estonia. Pension pillar II contribution: 0, 2, 4 or 6 (%).
- eePension: Estonia. true at pension age (tax-free 776 a month).
- fiMun: Finland, residents. Municipal tax rate in %, 5.30 for Helsinki.
- fiChurch: Finland, residents. Church tax rate in %, 1.00 for a Lutheran member in Helsinki, else 0.
- beMun: Belgium. Municipal surcharge in % of the federal tax, 7 by default.
- chChurch: Switzerland. true for a church member.
- chAge: Switzerland. Age band for the pension rate: 25, 35, 45 or 55.
- chNbu: Switzerland. Non-occupational accident insurance rate in %, 0.4 by default.
- chCommune: Switzerland. Communal multiplier in %, 119 for the City of Zurich.
- frMutuelle: France. Your share of company health and protection cover a year, in euros. 0 when not known.
- esTemp: Spain. true for a temporary contract.
- ptHealth: Portugal, residents. Health expenses a year, in euros.
- ptEdu: Portugal, residents. Education expenses a year, in euros.
- ptRent: Portugal, residents. Rent on the permanent home a year, in euros.
- ptColeta: Portugal, residents. General family expenses deduction, 0 to 250 (250 when the cap is reached, the default).
- jpCare: Japan. true when aged 40 to 64 (long-term care premium).
- jpSupport: Japan. 12 (a full steady year) or 9 (calendar 2026, April to December) months of the child-support levy.
- cnHf: China. Housing fund rate: 5, 6 or 7 (%).
- cnAllow: China, expats. Tax-free housing, language and school allowances a year, in yuan.
- cnSpecial: China, local. Special additional deductions a year, in yuan.
- hkMpf: Hong Kong (China). false when exempt from MPF.
- gulfWagePct: Gulf states. Share of pay that contributions are charged on, in %; 100 by default (Saudi Arabia counts basic pay plus housing).
- dispCur: Display only. local (each job in its own currency) or a code (USD, EUR, GBP, AUD, SGD, IDR, JPY, CHF, CAD, HKD, AED, CNY, KRW, MYR, THB, TWD, SEK, NOK, SAR, QAR, BHD, KWD, OMR) to read every job in one currency. Comparing jobs in different currencies reads best in one.
- dispPer: Display only. year or month.
- chartMeasure: Display only. What the chart across the pay range reads: pct (take-home as a share of gross, the default) or amount (take-home pay a year).

## Hide

## Quick Starts

There are 5 Quick Starts, each four jobs side by side: Asia hubs (Singapore, Hong Kong (China), Tokyo, Dubai), European tech (London, Amsterdam with the 30% ruling, Berlin, Zurich), US states (US$150,000 single in Texas, California, New York City and Illinois), Same take-home, Southern Europe (the gross for €4,000 a month net in Paris, Madrid, Lisbon and Milan) and Family of four (a sole earner on €80,000 with two children in Belgium, France, Germany and the Netherlands).

Use one only when the user's question is that comparison: a field named in the link replaces the value in job 1 alone, and the other three jobs stay as the Quick Start has them. For the user's own jobs, send json instead.

## Example

Request: using tool.adjiebrotots.com/global-income-tax-calculator, what is my take-home pay on £85,000 in London?

Link:
- country=GB
- why.country=London is in England, so the rest of UK rates apply
- ukRegion=ruk
- dir=gross
- amount=85000
- why.amount=£85,000 a year before tax, as the user said
- period=yearly
- note=London, November 2026

Assumptions:
1. Job: an employee in England on £{amount} a year gross, under the 2026/27 UK rules, with no student loan.
2. Take-home: after income tax and National Insurance only. Pension contributions through salary sacrifice are not included.

## AI page example

Request: I have offers of S$180,000 in Singapore and HK$1,300,000 in Hong Kong. Which leaves more after tax?

Searches:
- Singapore income tax for an Employment Pass holder, YA2027
- Hong Kong salaries tax and MPF, 2026/27

Link:
- json={"jobs":[{"country":"SG","sgRes":"ep","amount":180000},{"country":"HK","amount":1300000}]}
- dispCur=USD
- why.dispCur=Read both in US dollars to compare them
- note=Singapore against Hong Kong, November 2026

Assumptions:
1. Singapore: an Employment Pass holder, so no CPF, taxed as a resident on S$180,000 a year.
2. Hong Kong: single, with MPF at 5% capped at HK$1,500 a month.
3. Currency: shown in US dollars at the rates the page dates, for reading only.

## Compact lists

## Json

`json={"jobs":[{...},{...}]}` sets one to four jobs. Each job is an object of the field keys above, for its own country: country (required, the ISO code), dir, amount (a number), period, and any of that country's fields. A field left out keeps its default. A field named in the link outside the json (amount=95000) replaces that value in job 1. Use json for the user's own comparison; a Quick Start's jobs are examples.
`json={"jobs":[{"country":"US","usState":"TX","amount":150000},{"country":"US","usState":"NY","usNyc":true,"amount":150000}]}`
