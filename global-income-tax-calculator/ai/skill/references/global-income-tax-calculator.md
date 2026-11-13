Global Income Tax Calculator: use this tool with an AI assistant
https://tool.adjiebrotots.com/global-income-tax-calculator/

This is the full reference for one page of the skill brotools-global-income-tax-calculator: read SKILL.md first.

For people: Install this tool's skill in your AI assistant (Claude, ChatGPT, Grok and others) and
ask your question. It replies with a link that opens this tool on your scenario and lists what it
assumed, and the tool works out the answer. The rest of this file is written for the assistant.

WHAT THIS TOOL DECIDES
Take-home pay after income tax and employee social contributions for one to four jobs in 31
countries, 39 US states and DC, under 2026 rules, from gross to net or net to gross, with each line
of the sum named, sourced and dated, and which job leaves the most.

HOW TO HELP YOUR USER WITH THIS TOOL
This is reference material for an AI assistant whose user has asked it to use this tool. It
describes the link that opens the tool on the user's own scenario. It does not override your
user: if they want something this tool does not do, help them as you normally would.
1. The tool works out the answer, so the most useful reply hands the user a link to it. Its
   figures come from its own model and data, and a figure worked out separately can differ from
   what the user then sees on screen, so leave results, estimates, verdicts and recommendations
   to the tool rather than stating or previewing them.
2. A reply that works well has four parts, in this order, in the user's language:
   a. Your inputs: what the user stated, each with the value it takes in the link;
   b. Assumptions: every other input you chose, each with its value and its source (with its
      date) or your reason (put the same reason, shortened, in why.<key>);
   c. the link (if it is long, give it again inside a code block so the user can copy it);
   d. the sentence: Open the link to see the result.
3. Build the link in the format below, using only the keys listed here. Start from the nearest
   Quick Start (qs) and send only what differs from it. Write json compactly: no spaces or line
   breaks, defaults left out.
4. Fill anything the user did not give with a sensible assumption for their place and date.
   Prefer what the user said earlier in the conversation over general figures.
5. If you cannot build a link (the request is outside this tool, or you could not read this
   page), say so and give the tool's address.

LINK FORMAT
https://tool.adjiebrotots.com/global-income-tax-calculator/#load&v=1&qs=<quick start>&<key>=<value>&...&why.<key>=<your reason>&note=<one line>
- After #load come key=value pairs joined by &. Percent-encode each value (a space is %20, & is %26,
  # is %23, + is %2B).
- v=1 is the format version. qs=<key> starts from that Quick Start; without it the tool starts from
  its defaults.
- Then each key in the link is set, in the units its label shows on screen. deAddOn=2.9 means 2.9%,
  not 0.029. Write numbers plainly (800000, 6.5): a field also takes $, thousands commas and a
  trailing %, but inside a list a comma separates the items, so never put one in a number there. A
  checkbox takes true or false. A select or a choice takes the value listed, or its visible label.
- Anything the link does not name keeps the value it started from, so send only what differs.
- why.<key>=<text>: your reason for that value, shown to the user beside it (200 characters at
  most). note=<text>: one line shown above the list, for example the place and the date.
- A number outside a field's range is pulled into range and the user is told; a key the tool does
  not know is skipped and listed. Never use the keys s, open or embed.

EXAMPLE
Request: using tool.adjiebrotots.com/global-income-tax-calculator, what is my take-home pay on
£85,000 in London?
A reply in that form:
Your inputs:
- Gross pay: A$85,000
Assumptions:
1. Job: an employee in England on £85,000 a year gross, under the 2026/27 UK rules, with no student
   loan.
2. Take-home: after income tax and National Insurance only. Pension contributions through salary
   sacrifice are not included.
https://tool.adjiebrotots.com/global-income-tax-calculator/#load&v=1&country=GB&why.country=London%20is%20in%20England,%20so%20the%20rest%20of%20UK%20rates%20apply&ukRegion=ruk&dir=gross&amount=85000&why.amount=%C2%A385,000%20a%20year%20before%20tax,%20as%20the%20user%20said&period=yearly&note=London,%20November%202026
```
https://tool.adjiebrotots.com/global-income-tax-calculator/#load&v=1&country=GB&why.country=London%20is%20in%20England,%20so%20the%20rest%20of%20UK%20rates%20apply&ukRegion=ruk&dir=gross&amount=85000&why.amount=%C2%A385,000%20a%20year%20before%20tax,%20as%20the%20user%20said&period=yearly&note=London,%20November%202026
```
Open the link to see the result.

QUICK STARTS (qs)
There are 5 Quick Starts, each four jobs side by side: Asia hubs (Singapore, Hong Kong (China),
Tokyo, Dubai), European tech (London, Amsterdam with the 30% ruling, Berlin, Zurich), US states
(US$150,000 single in Texas, California, New York City and Illinois), Same take-home, Southern
Europe (the gross for €4,000 a month net in Paris, Madrid, Lisbon and Milan) and Family of four (a
sole earner on €80,000 with two children in Belgium, France, Germany and the Netherlands).
Use one only when the user's question is that comparison: a field named in the link replaces the
value in job 1 alone, and the other three jobs stay as the Quick Start has them. For the user's own
jobs, send json instead.
qs takes one of: asia, europe, us, net, family.

FIELDS (key: label on the page)
Most important: country, dir, amount, period, usState, usFiling, caProv, ukRegion, dispCur.

[Salary: Where you work]
country: Country  (most important)
  One of: AU (Australia), CN (China (Shanghai)), HK (Hong Kong (China)), ID (Indonesia), JP (Japan
  (Tokyo)), MY (Malaysia), SG (Singapore), KR (South Korea), TW (Taiwan (China)), TH (Thailand), BE
  (Belgium), EE (Estonia), FI (Finland), FR (France), DE (Germany), IT (Italy (Milan)), NL
  (Netherlands), NO (Norway), PT (Portugal), ES (Spain (Madrid)), SE (Sweden), CH (Switzerland
  (Zurich)), GB (United Kingdom), CA (Canada), US (United States), BH (Bahrain), KW (Kuwait), OM
  (Oman), QA (Qatar), SA (Saudi Arabia), AE (United Arab Emirates). Default AU.
  The country the job is in, by ISO code: AU, CN (Shanghai rules), HK, ID, JP (Tokyo rules), MY, SG,
  KR, TW, TH, BE, EE, FI, FR, DE, IT (Milan rules), NL, NO, PT (mainland), ES (Madrid rules), SE, CH
  (City of Zurich rules), GB, CA, US, BH, KW, OM, QA, SA, AE. A country's other fields only count
  when it is picked.
usState: State  (most important)
  One of: AK (Alaska), AZ (Arizona), AR (Arkansas), CA (California), CO (Colorado), DE (Delaware),
  DC (District of Columbia), FL (Florida), GA (Georgia), HI (Hawaii), ID (Idaho), IL (Illinois), IN
  (Indiana), IA (Iowa), KS (Kansas), KY (Kentucky), LA (Louisiana), MD (Maryland), MA
  (Massachusetts), MI (Michigan), MS (Mississippi), MO (Missouri), MT (Montana), NE (Nebraska), NV
  (Nevada), NH (New Hampshire), NJ (New Jersey), NY (New York), NC (North Carolina), ND (North
  Dakota), OK (Oklahoma), PA (Pennsylvania), SD (South Dakota), TN (Tennessee), TX (Texas), VT
  (Vermont), VA (Virginia), WA (Washington), WV (West Virginia), WY (Wyoming). Default CA.
  US only. The state, by its two-letter code (DC for Washington DC). States with no tax on wages:
  AK, FL, NV, NH, SD, TN, TX, WA, WY. Not offered (their deduction phase-outs are not loaded), so a
  link must not name them: AL, CT, ME, MN, NM, OH, OR, RI, SC, UT, WI.
  Tip on the page: 39 states and DC. Eleven states are left out because their deduction phase-outs
  are not loaded here.
usNyc: Live in New York City
  Checkbox: true or false. Default false.
  US, New York only. true adds New York City resident tax.
  Tip on the page: New York City taxes its residents on top of the state, at 3.078% to 3.876%.
caProv: Province  (most important)
  One of: ON (Ontario), BC (British Columbia), AB (Alberta), QC (Quebec). Default ON.
  Canada only. ON, BC, AB or QC. Other provinces are not loaded.
ukRegion: Where you live  (most important)
  One of: ruk (England, Wales or Northern Ireland), sco (Scotland). Default ruk.
  UK only. ruk (England, Wales or Northern Ireland) or sco (Scotland), which sets the income tax
  bands.
  Tip on the page: Scotland sets its own income tax bands. National Insurance is the same everywhere
  in the UK.

[Salary: Your pay]
dir: I know my  (most important)
  One of: gross (Gross pay), net (Take-home pay). Default gross.
  gross: amount is gross pay before tax. net: amount is the take-home pay wanted, and the tool
  solves for the gross that leaves it.
amount: Gross pay  (most important)
  Number (A$ before it). 0 to 100,000,000,000. Default 120,000.
  The pay in the job's own currency (dollars for US, euros for FR, yen for JP), per period. Send the
  number alone, no currency.
  Tip on the page: Before income tax and employee contributions. Contributions your employer pays on
  top are not part of it.
period: Gross pay (a year or a month)  (most important)
  One of: yearly (a year), monthly (a month). Default yearly.
  yearly or monthly, the period amount is per. A monthly salary paid 12 times a year is monthly; for
  13th or 14th month pay, send the yearly total as yearly.

[Salary: Your status]
auRes: Residency (Citizen or permanent resident, Temporary resident, Medicare-exempt, Foreign resident or Working holiday maker)
  One of: pr (Citizen or permanent resident), temp (Temporary resident, Medicare-exempt), foreign
  (Foreign resident), whm (Working holiday maker). Default pr.
  Australia. pr (citizen or permanent resident), temp (temporary resident, Medicare-exempt), foreign
  (foreign resident) or whm (working holiday maker).
  Tip on the page: Citizen or permanent resident: Australian citizens and permanent visa holders,
  such as skilled 189, 190 or 186, or partner 801 and 100. Temporary resident: Temporary visa
  holders without Medicare access, such as 482 Skills in Demand, 485 Graduate or 500 Student.
  Foreign resident: In Australia under 6 months with no plan to settle, such as on a visitor 600 or
  short-stay 400 visa. Working holiday maker: Backpackers on a Working Holiday (417) or Work and
  Holiday (462) visa.
sgRes: Residency
  One of: ep (Employment Pass or S Pass), citizen (Citizen, or PR from year 3), pr1 (Permanent
  resident, year 1), pr2 (Permanent resident, year 2), nonres (Non-resident (under 183 days)).
  Default ep.
  Singapore. ep (Employment Pass or S Pass, no CPF), citizen (citizen, or PR from year 3), pr1, pr2
  (permanent resident in year 1 or 2) or nonres (under 183 days).
  Tip on the page: Employment Pass or S Pass: foreign professionals and skilled workers on an
  Employment Pass or S Pass. Citizen, or PR from year 3: Singapore citizens, and permanent residents
  from the third year after PR was granted. Permanent resident, year 1: new Singapore permanent
  residents in the first year after PR was granted, often after an Employment Pass or S Pass.
  Permanent resident, year 2: Singapore permanent residents in the second year after PR was granted.
  Non-resident: anyone in Singapore under 183 days in the year, such as visiting staff on a short
  assignment.
sgAge: Age
  One of: 55 or under, 60 (Above 55 to 60), 65 (Above 60 to 65), 70 (Above 65 to 70), 99 (Above 70).
  Default 55.
  Singapore citizens and PRs from year 3. Age band for the CPF rate: 55, 60, 65, 70 or 99 (above
  70).
  Tip on the page: The CPF employee rate falls with age, from 20% at 55 or under to 5% above 70.
usRes: Tax status
  One of: res (Citizen or resident), nra (Nonresident alien). Default res.
  US. res (citizen or resident) or nra (nonresident alien: no standard deduction, files as single;
  most new H-1B, L-1, F-1 holders in their first year).
  Tip on the page: Citizen or resident: US citizens, green card holders, and visa holders such as
  H-1B or L-1 who pass the substantial presence test. Nonresident alien: people who fail both tests,
  such as F-1 or J-1 students in their first 5 calendar years, or new H-1B arrivals before 183 days.
deClass: Tax class
  One of: I (Class I, single), III (Class III, married, partner earns little). Default I.
  Germany. I (single) or III (married, partner earns little or nothing).
  Tip on the page: Class I: single, divorced or widowed employees. Couples who both earn alike use
  class IV, taxed the same. Class III: married or registered partners where one earns little or
  nothing and the partner is in class V.
idRes: Residency (Resident or Non-resident (PPh 26))
  One of: res (Resident), nonres (Non-resident (PPh 26)). Default res.
  Indonesia. res or nonres (under 183 days: 20% of gross, final).
  Tip on the page: Resident: Indonesians, and foreigners in Indonesia 183 days or more in 12 months
  or intending to reside, including KITAS and KITAP holders. Non-resident: foreigners on a short
  assignment, under 183 days in 12 months with no intent to reside.
myRes: Residency (Citizen or permanent resident, Expat, tax resident (182 days or more) or Expat, non-resident)
  One of: citizen (Citizen or permanent resident), expat (Expat, tax resident (182 days or more)),
  nonres (Expat, non-resident). Default citizen.
  Malaysia. citizen (citizen or PR), expat (tax resident, 182 days or more) or nonres (30% flat).
  Tip on the page: Citizen or permanent resident: Malaysian citizens and permanent residents. Expat,
  tax resident: foreign nationals on an Employment Pass who are in Malaysia 182 days or more in the
  year. Expat, non-resident: foreign employees in Malaysia under 182 days in the year, such as short
  assignments.
nlRuling: 30% ruling
  Checkbox: true or false. Default false.
  Netherlands. true for the 30% ruling (a recruited expat above the salary norm).
  Tip on the page: For employees recruited from abroad who lived over 150 km from the Dutch border.
  Up to 30% of pay is tax-free above the salary norm, 27% from 2027.
noRes: Scheme (Ordinary tax or PAYE scheme, 25% flat)
  One of: res (Ordinary tax), paye (PAYE scheme, 25% flat). Default res.
  Norway. res (ordinary tax) or paye (25% flat scheme for short stays, up to 725,050 a year).
  Tip on the page: Ordinary tax: people living in Norway, including foreigners staying over 183 days
  in 12 months. PAYE scheme: foreign workers who are not Norwegian tax residents, such as short
  stays and cross-border commuters.
noNi: Member of Norwegian national insurance
  Checkbox: true or false. Default true.
  Norway, PAYE only. false when not a member of Norwegian national insurance (17.4%).
  Tip on the page: The PAYE rate is 25% for members and 17.4% for non-members.
seRes: Residency (Resident or Non-resident, SINK 22.5%)
  One of: res (Resident), sink (Non-resident, SINK 22.5%). Default res.
  Sweden. res or sink (non-resident, 22.5% flat).
  Tip on the page: Resident: people living in Sweden or staying 6 months or more, including foreign
  hires on a work permit. Non-resident, SINK: people working in Sweden who live abroad, such as
  commuters or assignments under 6 months.
fiRes: Scheme (Ordinary tax or Key employee, 25% flat)
  One of: res (Ordinary tax), key (Key employee, 25% flat). Default res.
  Finland. res or key (key employee 25% flat, needs 5,800 a month or more).
  Tip on the page: Ordinary tax: employees taxed at the progressive rates, including residents and
  foreigners staying over 6 months. Key employee: foreign experts recruited from abroad, earning at
  least 5,800 a month, not Finnish residents in the last 5 years.
beExpat: Expat regime
  Checkbox: true or false. Default false.
  Belgium. true for the expat regime (35% of gross tax-free; needs more than 70,000 a year).
  Tip on the page: For employees recruited or posted from abroad earning over 70,000 a year: up to
  35% of gross as a tax and social security free reimbursement.
itImp: Regime (Resident, Impatriate, 50% exempt or Impatriate with a minor child, 60% exempt)
  One of: none (Resident), imp50 (Impatriate, 50% exempt), imp60 (Impatriate with a minor child, 60%
  exempt). Default none.
  Italy. none, imp50 (impatriate, 50% exempt) or imp60 (impatriate with a minor child, 60% exempt).
  Tip on the page: Resident: people living in Italy, taxed at the ordinary progressive rates.
  Impatriate, 50% exempt: highly qualified workers moving to Italy after 3 years abroad (longer if
  staying with the same employer), who commit to stay 4 years. Impatriate with a minor child: the
  same impatriate workers with a minor child, or a child born or adopted while on the regime.
frCadre: Contract
  One of: noncadre (Non-cadre), cadre (Cadre). Default noncadre.
  France. noncadre or cadre.
  Tip on the page: Non-cadre: employees who are not managers or professionals, such as clerks,
  technicians and workers. Cadre: managers and professionals with cadre status under their
  collective agreement.
frImp: Impatriate regime, 30% forfait
  Checkbox: true or false. Default false.
  France. true for the impatriate regime (30% of pay exempt from income tax).
  Tip on the page: For employees recruited from abroad who were not French tax residents in the last
  5 years: 30% of pay is exempt from income tax for up to 8 years.
esRegime: Regime (Resident or Beckham regime, 24% flat)
  One of: res (Resident), beckham (Beckham regime, 24% flat). Default res.
  Spain. res or beckham (24% flat to 600,000).
  Tip on the page: Resident: people living in Spain over 183 days a year, including those who moved
  here earlier. Beckham regime: workers who move to Spain for a job, including digital nomad visa
  holders, not Spanish residents in the last 5 years.
ptRegime: Regime (Resident, IRS Jovem, IFICI, 20% flat or Non-resident, 25% flat)
  One of: res (Resident), jovem (IRS Jovem), ifici (IFICI, 20% flat), nonres (Non-resident, 25%
  flat). Default res.
  Portugal. res, jovem (IRS Jovem), ifici (20% flat) or nonres (25% flat).
  Tip on the page: Resident: people living in Portugal, taxed at the ordinary progressive rates. IRS
  Jovem: workers up to age 35 in their first 10 years of earning, whatever their education, who are
  not claimed as a dependant. IFICI: new residents in qualifying jobs, such as researchers, teachers
  and tech roles, not Portuguese residents in the last 5 years. Non-resident: people paid from
  Portuguese work who live elsewhere, such as short assignments.
ptJovemYear: Year of work
  One of: 1 (Year 1), 2 (Year 2), 3 (Year 3), 4 (Year 4), 5 (Year 5), 6 (Year 6), 7 (Year 7), 8
  (Year 8), 9 (Year 9), 10 (Year 10). Default 1.
  Portugal, IRS Jovem only. Year of work, 1 to 10.
  Tip on the page: Exempt share: 100% in year 1, 75% in years 2 to 4, 50% in years 5 to 7, 25% in
  years 8 to 10, up to 29,542.15.
jpRes: Residency (Resident, year 2 or later, Resident, first year or Non-resident, 20.42% flat)
  One of: y2 (Resident, year 2 or later), y1 (Resident, first year), nonres (Non-resident, 20.42%
  flat). Default y2.
  Japan. y2 (resident, year 2 or later), y1 (first year: no resident tax yet) or nonres (20.42%
  flat).
  Tip on the page: Resident, year 2 or later: people who had an address in Japan on 1 January, so
  they owe resident tax on last year's income. Resident, first year: people who moved to Japan this
  year on a work visa, so had no address there on 1 January. Non-resident: people with no home in
  Japan who stay under one year, such as short assignments.
krMethod: Tax method
  One of: prog (Progressive rates), flat (19% flat rate for foreign workers). Default prog.
  South Korea. prog (progressive) or flat (19% election for foreign workers).
  Tip on the page: Progressive rates: the standard method for every employee, foreign or Korean. 19%
  flat rate: foreign nationals working in Korea who elect it, for work until 31 Dec 2026.
cnRes: Status
  One of: local (Standard), expat (Expat with tax-free allowances). Default local.
  China. local (standard) or expat (tax-free allowances in cnAllow).
  Tip on the page: Standard: Chinese nationals, and foreigners who take the usual special additional
  deductions. Expat: foreign nationals living in China, who may take housing, language and school
  allowances tax-free until 31 Dec 2027.
twRes: Residency (Resident (183 days or more) or Non-resident)
  One of: res (Resident (183 days or more)), nonres (Non-resident). Default res.
  Taiwan (China). res (183 days or more) or nonres.
  Tip on the page: Resident: citizens, and foreigners on a residence certificate (ARC) who stay 183
  days or more in the year. Non-resident: foreigners in Taiwan under 183 days in the year, such as
  short assignments.
twGold: Gold Card
  Checkbox: true or false. Default false.
  Taiwan (China) residents. true for a Gold Card holder (50% of salary above 3,000,000 excluded).
  Tip on the page: A Gold Card holder excludes 50% of salary above 3,000,000 for 5 years.
twEi: Employment insurance
  One of: yes (Covered: 11.5% + 1%), no (Foreign employee: 11.5% only). Default yes.
  Taiwan (China). yes (default: in employment insurance, so 11.5% + 1% labour and employment
  insurance: citizens, foreigners married to a citizen, permanent residents) or no (other foreign
  employees on a work permit: labour insurance 11.5% only).
  Tip on the page: Covered: citizens, foreigners married to a citizen with household registration,
  and permanent residents. Not covered: other foreign employees on a work permit, who pay labour
  insurance only.
gulfNat: Citizenship
  One of: expat (Expatriate), national (National). Default expat.
  UAE, Qatar, Saudi Arabia, Bahrain, Kuwait, Oman. expat or national. None of them taxes wages;
  nationals pay pension contributions.
  Tip on the page: Expatriate: foreign workers on an employer-sponsored work residence permit.
  National: citizens of the country you work in, covered by its pension scheme.
saScheme: GOSI scheme
  One of: legacy (Joined before 3 Jul 2024), new (New entrant from 3 Jul 2024). Default legacy.
  Saudi nationals. legacy (joined GOSI before 3 Jul 2024) or new (new entrant).
  Tip on the page: Joined before 3 Jul 2024: employees already registered with GOSI before 3 July
  2024. New entrant: employees first registered with GOSI from 3 July 2024. The rate steps up each
  July.

[Household: Household]
usFiling: Filing status  (most important)
  One of: S (Single), MFJ (Married filing jointly). Default S.
  US residents. S (single) or MFJ (married filing jointly).
deKids: Has children
  Checkbox: true or false. Default false.
  Germany. true if the employee has children (lowers long-term care).
  Tip on the page: Without children, long-term care costs 0.6% more.
idMarried: Married
  Checkbox: true or false. Default false.
  Indonesia, residents. true if married.
idDeps: Dependants (0, 1, 2 or 3)
  One of: 0, 1, 2, 3. Default 0.
  Indonesia, residents. Dependants, 0 to 3.
  Tip on the page: Each dependant adds 4.5 million to the non-taxable allowance (PTKP), up to three.
thSpouse: Spouse with no income
  Checkbox: true or false. Default false.
  Thailand. true for a spouse with no income.
thKids: Children born before 2018
  One of: 0, 1, 2, 3, 4, 5, 6. Default 0.
  Thailand. Children born before 2018, 0 to 6.
thKidsNew: Children born 2018 or later
  One of: 0, 1, 2, 3, 4, 5, 6. Default 0.
  Thailand. Children born 2018 or later, 0 to 6.
  Tip on the page: From the second child, a child born 2018 or later gives 60,000 instead of 30,000.
mySpouse: Spouse with no income
  Checkbox: true or false. Default false.
  Malaysia, residents. true for a spouse with no income.
myKids: Children
  One of: 0, 1, 2, 3, 4, 5, 6, 7, 8. Default 0.
  Malaysia, residents. Children, 0 to 8.
beStatus: Household (Single or Married or legal cohabitant, sole earner)
  One of: single (Single), married (Married or legal cohabitant, sole earner). Default single.
  Belgium. single or married (married or legal cohabitant, partner with no professional income).
  Tip on the page: A sole earner moves up to 30% of income (max 11,780) to the partner, who is taxed
  on it with their own tax-free amount.
beKids: Dependent children
  One of: 0, 1, 2, 3, 4, 5, 6, 7, 8. Default 0.
  Belgium. Dependent children, 0 to 8.
beSingleParent: Single parent
  Checkbox: true or false. Default false.
  Belgium, single with children. true for a single parent.
  Tip on the page: A single parent with dependent children adds 1,980 to the tax-free amount.
chStatus: Household (Single or Married, sole earner)
  One of: single (Single), married (Married, sole earner). Default single.
  Switzerland. single or married (sole earner).
chKids: Children
  One of: 0, 1, 2, 3, 4, 5, 6. Default 0.
  Switzerland, married only. Children, 0 to 6.
frMarried: Married or in a PACS
  Checkbox: true or false. Default false.
  France. true for a married or PACS couple taxed jointly.
  Tip on the page: A couple is taxed jointly on two parts. Each child adds half a part, a third
  child a whole part.
frKids: Children
  One of: 0, 1, 2, 3, 4, 5, 6. Default 0.
  France. Children, 0 to 6.
esKids: Children
  One of: 0, 1, 2, 3, 4, 5, 6. Default 0.
  Spain, residents. Children, 0 to 6.
ptDepOld: Dependants aged 7 or over
  One of: 0, 1, 2, 3, 4. Default 0.
  Portugal. Dependants aged 7 or over, 0 to 4.
ptDepMid: Dependants aged 4 to 6
  One of: 0, 1, 2, 3, 4. Default 0.
  Portugal. Dependants aged 4 to 6, 0 to 4.
ptDepYoung: Dependants aged 3 or under
  One of: 0, 1, 2, 3, 4. Default 0.
  Portugal. Dependants aged 3 or under, 0 to 4.
  Tip on the page: 600 off the tax for each dependant, 726 for a first one aged 3 or under, 900 for
  a second or later one aged 6 or under.
caKids: Children 18 or under
  One of: 0, 1, 2, 3, 4, 5, 6. Default 0.
  Canada, Ontario only. Children 18 or under, 0 to 6 (Ontario Tax Reduction).
  Tip on the page: Each child adds 554 to the Ontario Tax Reduction.
hkMarried: Married, partner with no income
  Checkbox: true or false. Default false.
  Hong Kong (China). true for married with a partner with no income.
hkKids: Children
  One of: 0, 1, 2, 3, 4, 5, 6. Default 0.
  Hong Kong (China). Children, 0 to 6.
twStatus: Household (Single or Married, filing jointly)
  One of: single (Single), married (Married, filing jointly). Default single.
  Taiwan (China) residents. single or married (filing jointly).
twKids: Minor children
  One of: 0, 1, 2, 3, 4, 5, 6. Default 0.
  Taiwan (China) residents. Minor children, 0 to 6.
krDeps: Dependants
  One of: 0, 1, 2, 3, 4, 5, 6. Default 0.
  South Korea, progressive method. Dependants beyond the employee, 0 to 6.
  Tip on the page: Each dependant adds the 1.5 million basic deduction.

[Details: Details]
auCover: Private hospital cover
  Checkbox: true or false. Default true.
  Australia, citizens and PRs. false when there is no private hospital cover (adds the Medicare levy
  surcharge above 105,000).
  Tip on the page: Without it, the Medicare levy surcharge of 1% to 1.5% applies above 105,000.
auSuper: Amount includes super
  Checkbox: true or false. Default false.
  Australia. true when the amount is a package that includes the 12% super guarantee.
  Tip on the page: On: the amount is a package with the 12% super guarantee inside it. Off: super is
  paid on top.
ukLoan: Student loan
  One of: none (None), plan1 (Plan 1), plan2 (Plan 2), plan4 (Plan 4 (Scotland)), plan5 (Plan 5).
  Default none.
  UK. none, plan1, plan2, plan4 or plan5 student loan.
  Tip on the page: 9% of pay above the plan's threshold: 26,900, 29,385, 33,795 or 25,000.
ukPg: Postgraduate loan
  Checkbox: true or false. Default false.
  UK. true for a postgraduate loan.
  Tip on the page: 6% of pay above 21,000, on top of any plan.
deChurch: Church tax
  One of: 0 (None), 8 (8% (Bavaria, Baden-Württemberg)), 9 (9% (other states)). Default 0.
  Germany. 0, 8 (Bavaria, Baden-Württemberg) or 9 (other states) church tax.
  Tip on the page: A church member pays a share of the income tax: 8% in Bavaria and
  Baden-Württemberg, 9% elsewhere.
deAddOn: Health insurance add-on
  Number (% after it). 0 to 5. Default 2.9.
  Germany. Health fund add-on rate in %, 2.9 on average.
  Tip on the page: Each health fund sets its own add-on; 2.9% is the 2026 average. You pay half.
usLocal: Local or county income tax
  Number (% after it). 0 to 5. Default 0.
  US. Local or county income tax on wages in %, such as a Maryland county or Philadelphia. 0 when
  none.
  Tip on the page: Some cities and counties tax wages too (Maryland counties, Philadelphia,
  Detroit). Enter the rate on gross pay.
usNyDbl: Employer collects NY disability (DBL)
  Checkbox: true or false. Default true.
  US, New York. false if the employer does not take the disability contribution from pay.
  Tip on the page: 0.5% of pay, at most 0.60 a week. The employer may take it from pay or meet it in
  full.
usFicaExempt: Exempt from Social Security and Medicare
  Checkbox: true or false. Default false.
  US, nonresident alien only. true for F, J, M or Q status (no Social Security or Medicare).
  Tip on the page: F, J, M and Q visa holders are usually exempt (students and scholars).
idJkk: Work accident rate (JKK)
  One of: 0.24 (0.24%, very low risk), 0.54 (0.54%, low risk), 0.89 (0.89%, medium risk), 1.27
  (1.27%, high risk), 1.74 (1.74%, very high risk). Default 0.24.
  Indonesia, residents. Work accident premium rate: 0.24, 0.54, 0.89, 1.27 or 1.74 by the industry's
  risk.
  Tip on the page: Employer premiums for work accident, death and health count as taxable income.
  The JKK rate depends on the industry.
idBpjs: Pay BPJS as a resident would
  Checkbox: true or false. Default true.
  Indonesia, non-residents. false if no BPJS contributions are paid.
myLindung: Claim LINDUNG as SOCSO relief
  Checkbox: true or false. Default false.
  Malaysia, expat residents. true to claim LINDUNG as SOCSO relief (unconfirmed for expats).
  Tip on the page: Unconfirmed whether an expat can claim it, so it starts off. It moves the tax by
  RM31.50 at most.
nlNorm: Salary norm
  One of: std (Standard (48,013)), young (Under 30 with a master's (36,497)). Default std.
  Netherlands, with the 30% ruling. std (salary norm 48,013) or young (under 30 with a master's,
  36,497).
  Tip on the page: The ruling cannot take pay below the salary norm, so the tax-free part is pay
  less the norm when that is smaller.
nlHoliday: Holiday allowance paid on top
  Checkbox: true or false. Default true.
  Netherlands. true (default): amount excludes the 8% holiday allowance and it is added. false:
  amount already includes it.
  Tip on the page: Dutch pay adds 8% holiday allowance, usually paid in May. Switched on, the amount
  you enter excludes it and 8% is added.
nlPension: Pension contribution, your share
  Number (% after it). 0 to 15. Default 0.
  Netherlands. Employee pension contribution in % of gross.
  Tip on the page: Deducted before tax. Entered as a share of gross; schemes that start above a
  franchise take less.
seMun: Municipal tax rate
  Number (% after it). 28 to 36. Default 30.55.
  Sweden, residents. Municipal tax rate in %: 30.55 for Stockholm, 32.38 national average.
  Tip on the page: Stockholm is 30.55%; the national average is 32.38%.
seBurial: Burial fee
  Number (% after it). 0 to 1.5. Default 0.292.
  Sweden, residents. Burial fee in %, 0.292 on average.
  Tip on the page: The national average is 0.292%. Members of the Church of Sweden pay a church fee
  instead.
eeP2: Pension pillar II
  One of: 0 (Off), 2 (2%), 4 (4%), 6 (6%). Default 2.
  Estonia. Pension pillar II contribution: 0, 2, 4 or 6 (%).
eePension: At pension age
  Checkbox: true or false. Default false.
  Estonia. true at pension age (tax-free 776 a month).
  Tip on the page: The tax-free allowance is 776 a month instead of 700.
fiMun: Municipal tax rate
  Number (% after it). 4 to 11. Default 5.30.
  Finland, residents. Municipal tax rate in %, 5.30 for Helsinki.
  Tip on the page: Helsinki is 5.30%.
fiChurch: Church tax rate
  Number (% after it). 0 to 2.5. Default 0.
  Finland, residents. Church tax rate in %, 1.00 for a Lutheran member in Helsinki, else 0.
  Tip on the page: For church members: 1.00% in Helsinki for the Lutheran church.
beMun: Municipal surcharge
  Number (% after it). 0 to 9. Default 7.
  Belgium. Municipal surcharge in % of the federal tax, 7 by default.
  Tip on the page: Charged on the federal tax. Most communes set 6% to 8%.
chChurch: Church member
  Checkbox: true or false. Default false.
  Switzerland. true for a church member.
  Tip on the page: Church tax is about 10% of the simple cantonal tax in the City of Zurich.
chAge: Age (pension rate)
  One of: 25 to 34 (3.5%), 35 to 44 (5%), 45 to 54 (7.5%), 55 to 65 (9%). Default 35.
  Switzerland. Age band for the pension rate: 25, 35, 45 or 55.
  Tip on the page: Your half of the BVG age credit on the coordinated salary.
chNbu: Accident insurance (NBU)
  Number (% after it). 0 to 3. Default 0.4.
  Switzerland. Non-occupational accident insurance rate in %, 0.4 by default.
  Tip on the page: Non-occupational accident insurance; the rate depends on the insurer.
chCommune: Communal multiplier
  Number (% after it). 70 to 130. Default 119.
  Switzerland. Communal multiplier in %, 119 for the City of Zurich.
  Tip on the page: A share of the simple cantonal tax. The City of Zurich is 119%.
frMutuelle: Company health cover, your share
  Number (A$ before it, /yr after it). 0 to 100,000. Default 0.
  France. Your share of company health and protection cover a year, in euros. 0 when not known.
  Tip on the page: Mandatory company health and protection cover. Your share is taken from pay and
  deducted before tax.
esTemp: Temporary contract
  Checkbox: true or false. Default false.
  Spain. true for a temporary contract.
  Tip on the page: Unemployment insurance is 1.60% instead of 1.55%.
ptHealth: Health expenses
  Number (A$ before it, /yr after it). 0 to 1,000,000. Default 0.
  Portugal, residents. Health expenses a year, in euros.
  Tip on the page: 15% comes off the tax, up to 1,000.
ptEdu: Education expenses
  Number (A$ before it, /yr after it). 0 to 1,000,000. Default 0.
  Portugal, residents. Education expenses a year, in euros.
  Tip on the page: 30% comes off the tax, up to 800.
ptRent: Rent on your home
  Number (A$ before it, /yr after it). 0 to 1,000,000. Default 0.
  Portugal, residents. Rent on the permanent home a year, in euros.
  Tip on the page: 15% comes off the tax, up to 900 for 2026 rents.
ptColeta: General family expenses deduction
  Number (A$ before it, /yr after it). 0 to 250. Default 250.
  Portugal, residents. General family expenses deduction, 0 to 250 (250 when the cap is reached, the
  default).
  Tip on the page: 35% of everyday spending on e-Fatura invoices, up to 250. Most people reach the
  cap.
jpCare: Aged 40 to 64
  Checkbox: true or false. Default false.
  Japan. true when aged 40 to 64 (long-term care premium).
  Tip on the page: Adds the long-term care premium: health becomes 11.47% instead of 9.85%, half
  each.
jpSupport: Child-support levy
  One of: 12 (Full year), 9 (Calendar 2026 (April to December)). Default 12.
  Japan. 12 (a full steady year) or 9 (calendar 2026, April to December) months of the child-support
  levy.
  Tip on the page: The 0.23% levy starts with April 2026 wages. Full year shows a steady year.
cnHf: Housing fund rate
  One of: 5 (5%), 6 (6%), 7 (7%). Default 7.
  China. Housing fund rate: 5, 6 or 7 (%).
  Tip on the page: The employer sets it between 5% and 7%.
cnAllow: Tax-free allowances
  Number (A$ before it, /yr after it). 0 to 100,000,000. Default 0.
  China, expats. Tax-free housing, language and school allowances a year, in yuan.
  Tip on the page: Housing, language training and children's education allowances for the year.
cnSpecial: Special additional deductions
  Number (A$ before it, /yr after it). 0 to 1,000,000. Default 0.
  China, local. Special additional deductions a year, in yuan.
  Tip on the page: Children, elderly care, housing rent or loan interest, further study.
hkMpf: MPF member
  Checkbox: true or false. Default true.
  Hong Kong (China). false when exempt from MPF.
  Tip on the page: 5% of pay, at most 1,500 a month, and nothing below 7,100 a month. Deductible up
  to 18,000.
gulfWagePct: Contributory share of pay
  Number (% after it). 0 to 100. Default 100.
  Gulf states. Share of pay that contributions are charged on, in %; 100 by default (Saudi Arabia
  counts basic pay plus housing).
  Tip on the page: Contributions are on the contributory wage (in Saudi Arabia basic pay plus
  housing). Lower it if allowances are excluded.

[Beside the results]
dispCur: Currency to show amounts in  (most important)
  One of: local (Each job's own currency), USD (US dollar (USD)), EUR (Euro (EUR)), GBP (British
  pound (GBP)), AUD (Australian dollar (AUD)), SGD (Singapore dollar (SGD)), IDR (Indonesian rupiah
  (IDR)), JPY (Japanese yen (JPY)), CHF (Swiss franc (CHF)), CAD (Canadian dollar (CAD)), HKD (Hong
  Kong dollar (HKD)), AED (UAE dirham (AED)), CNY (Chinese yuan (CNY)), KRW (Korean won (KRW)), MYR
  (Malaysian ringgit (MYR)), THB (Thai baht (THB)), TWD (New Taiwan dollar (TWD)), SEK (Swedish
  krona (SEK)), NOK (Norwegian krone (NOK)), SAR (Saudi riyal (SAR)), QAR (Qatari riyal (QAR)), BHD
  (Bahraini dinar (BHD)), KWD (Kuwaiti dinar (KWD)), OMR (Omani rial (OMR)). Default local.
  Display only. local (each job in its own currency) or a code (USD, EUR, GBP, AUD, SGD, IDR, JPY,
  CHF, CAD, HKD, AED, CNY, KRW, MYR, THB, TWD, SEK, NOK, SAR, QAR, BHD, KWD, OMR) to read every job
  in one currency. Comparing jobs in different currencies reads best in one.
dispPer: Show amounts per year or per month
  One of: year (Year), month (Month). Default year.
  Display only. year or month.
chartMeasure: Show take-home as
  One of: pct (% of gross), amount (Amount). Default pct.
  Display only. What the chart across the pay range reads: pct (take-home as a share of gross, the
  default) or amount (take-home pay a year).

JSON
`json={"jobs":[{...},{...}]}` sets one to four jobs. Each job is an object of the field keys above, for its own country: country (required, the ISO code), dir, amount (a number), period, and any of that country's fields. A field left out keeps its default. A field named in the link outside the json (amount=95000) replaces that value in job 1. Use json for the user's own comparison; a Quick Start's jobs are examples.
`json={"jobs":[{"country":"US","usState":"TX","amount":150000},{"country":"US","usState":"NY","usNyc":true,"amount":150000}]}`

Generated by _ref/agent-doc.mjs from the page and its agent-notes.md.
