/* ═══════════════════════════════════════════════════════════════════════════
   Global Income Tax Calculator: the page.

   The sums are engine.js's (GSCEngine), held to the spec's golden values by
   _audit/run.mjs. This file reads the form, keeps up to four jobs, and draws
   the answer, the cards, the chart and the tables.

   Jobs. The form shows one job at a time (the active one). Each job is a flat
   object of the form's field values, keyed by the fields' Persist handles; the
   engine reads only its own country's. Switching jobs writes the form back into
   JOBS and loads the other one. The mini cache, a scenario file and a Share
   link carry the form as fields (the active job) and every job in extra, each
   as what differs from the defaults, so an old link or an AI link that names
   only fields opens as job 1.
   ═══════════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

const E = window.GSCEngine;
const $ = id => document.getElementById(id);
const cssVar = n => getComputedStyle(document.body).getPropertyValue(n).trim();
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const MAX_JOBS = 4;

/* ───────────────────────── Language ─────────────────────────
   One script for two pages: the English page and its Indonesian twin (id/, baked from
   index.html by _ref/bake-id.mjs, which sets window.DEFAULT_LANG = 'id'). Both read and
   write the same fields under the same Persist namespace, so a reader's work, a scenario
   file, a Share link and an AI link open the same on either page. Words change, and so does
   the way a figure is written: the Indonesian page shows and takes 1.234,5 (shared-id.js,
   SharedNum), the English one 1,234.5. What is stored is the English form on both (the jobs
   below, the mini cache, a file, a link), and SharedNum.read / write turn a field's text into
   it and back, so a value saved on one page reads as the same number on the other.
   On the English page nothing below is applied: the page shows index.html as it is.
   The engine's own text (line labels, notes, the tax year) is worded on the Indonesian
   page by labels-id.js (GSCLabelsId), made from the country pages' content files. */
const LANG = {
  en: {
    // The page: every [data-i18n*] key in index.html (_ref/bake-id.mjs bakes the id ones into id/).
    opt_country_AU: "Australia",
    opt_country_CN: "China (Shanghai)",
    opt_country_HK: "Hong Kong (China)",
    opt_country_ID: "Indonesia",
    opt_country_JP: "Japan (Tokyo)",
    opt_country_MY: "Malaysia",
    opt_country_SG: "Singapore",
    opt_country_KR: "South Korea",
    opt_country_TW: "Taiwan (China)",
    opt_country_TH: "Thailand",
    opt_country_BE: "Belgium",
    opt_country_EE: "Estonia",
    opt_country_FI: "Finland",
    opt_country_FR: "France",
    opt_country_DE: "Germany",
    opt_country_IT: "Italy (Milan)",
    opt_country_NL: "Netherlands",
    opt_country_NO: "Norway",
    opt_country_PT: "Portugal",
    opt_country_ES: "Spain (Madrid)",
    opt_country_SE: "Sweden",
    opt_country_CH: "Switzerland (Zurich)",
    opt_country_GB: "United Kingdom",
    opt_country_CA: "Canada",
    opt_country_US: "United States",
    opt_country_BH: "Bahrain",
    opt_country_KW: "Kuwait",
    opt_country_OM: "Oman",
    opt_country_QA: "Qatar",
    opt_country_SA: "Saudi Arabia",
    opt_country_AE: "United Arab Emirates",
    og_Asia_Pacific: "Asia Pacific",
    og_Europe: "Europe",
    og_Americas: "Americas",
    og_Gulf: "Gulf",
    opt_ukRegion_ruk: "England, Wales or Northern Ireland",
    opt_ukRegion_sco: "Scotland",
    opt_dir_gross: "Gross pay",
    opt_dir_net: "Take-home pay",
    opt_period_yearly: "a year",
    opt_period_monthly: "a month",
    otip_auRes_pr: "<strong>Citizen or permanent resident:</strong> Australian citizens and permanent visa holders, such as skilled 189, 190 or 186, or partner 801 and 100.",
    opt_auRes_pr: "Citizen or permanent resident",
    otip_auRes_temp: "<strong>Temporary resident:</strong> Temporary visa holders without Medicare access, such as 482 Skills in Demand, 485 Graduate or 500 Student.",
    opt_auRes_temp: "Temporary resident, Medicare-exempt",
    otip_auRes_foreign: "<strong>Foreign resident:</strong> In Australia under 6 months with no plan to settle, such as on a visitor 600 or short-stay 400 visa.",
    opt_auRes_foreign: "Foreign resident",
    otip_auRes_whm: "<strong>Working holiday maker:</strong> Backpackers on a Working Holiday (417) or Work and Holiday (462) visa.",
    opt_auRes_whm: "Working holiday maker",
    otip_sgRes_ep: "<strong>Employment Pass or S Pass:</strong> foreign professionals and skilled workers on an Employment Pass or S Pass.",
    opt_sgRes_ep: "Employment Pass or S Pass",
    otip_sgRes_citizen: "<strong>Citizen, or PR from year 3:</strong> Singapore citizens, and permanent residents from the third year after PR was granted.",
    opt_sgRes_citizen: "Citizen, or PR from year 3",
    otip_sgRes_pr1: "<strong>Permanent resident, year 1:</strong> new Singapore permanent residents in the first year after PR was granted, often after an Employment Pass or S Pass.",
    opt_sgRes_pr1: "Permanent resident, year 1",
    otip_sgRes_pr2: "<strong>Permanent resident, year 2:</strong> Singapore permanent residents in the second year after PR was granted.",
    opt_sgRes_pr2: "Permanent resident, year 2",
    otip_sgRes_nonres: "<strong>Non-resident:</strong> anyone in Singapore under 183 days in the year, such as visiting staff on a short assignment.",
    opt_sgRes_nonres: "Non-resident (under 183 days)",
    opt_sgAge_55: "55 or under",
    opt_sgAge_60: "Above 55 to 60",
    opt_sgAge_65: "Above 60 to 65",
    opt_sgAge_70: "Above 65 to 70",
    opt_sgAge_99: "Above 70",
    otip_usRes_res: "<strong>Citizen or resident:</strong> US citizens, green card holders, and visa holders such as H-1B or L-1 who pass the substantial presence test.",
    opt_usRes_res: "Citizen or resident",
    otip_usRes_nra: "<strong>Nonresident alien:</strong> people who fail both tests, such as F-1 or J-1 students in their first 5 calendar years, or new H-1B arrivals before 183 days.",
    opt_usRes_nra: "Nonresident alien",
    otip_deClass_I: "<strong>Class I:</strong> single, divorced or widowed employees. Couples who both earn alike use class IV, taxed the same.",
    opt_deClass_I: "Class I, single",
    otip_deClass_III: "<strong>Class III:</strong> married or registered partners where one earns little or nothing and the partner is in class V.",
    opt_deClass_III: "Class III, married, partner earns little",
    otip_idRes_res: "<strong>Resident:</strong> Indonesians, and foreigners in Indonesia 183 days or more in 12 months or intending to reside, including KITAS and KITAP holders.",
    opt_idRes_res: "Resident",
    otip_idRes_nonres: "<strong>Non-resident:</strong> foreigners on a short assignment, under 183 days in 12 months with no intent to reside.",
    opt_idRes_nonres: "Non-resident (PPh 26)",
    otip_myRes_citizen: "<strong>Citizen or permanent resident:</strong> Malaysian citizens and permanent residents.",
    opt_myRes_citizen: "Citizen or permanent resident",
    otip_myRes_expat: "<strong>Expat, tax resident:</strong> foreign nationals on an Employment Pass who are in Malaysia 182 days or more in the year.",
    opt_myRes_expat: "Expat, tax resident (182 days or more)",
    otip_myRes_nonres: "<strong>Expat, non-resident:</strong> foreign employees in Malaysia under 182 days in the year, such as short assignments.",
    opt_myRes_nonres: "Expat, non-resident",
    otip_noRes_res: "<strong>Ordinary tax:</strong> people living in Norway, including foreigners staying over 183 days in 12 months.",
    opt_noRes_res: "Ordinary tax",
    otip_noRes_paye: "<strong>PAYE scheme:</strong> foreign workers who are not Norwegian tax residents, such as short stays and cross-border commuters.",
    opt_noRes_paye: "PAYE scheme, 25% flat",
    otip_seRes_res: "<strong>Resident:</strong> people living in Sweden or staying 6 months or more, including foreign hires on a work permit.",
    opt_seRes_res: "Resident",
    otip_seRes_sink: "<strong>Non-resident, SINK:</strong> people working in Sweden who live abroad, such as commuters or assignments under 6 months.",
    opt_seRes_sink: "Non-resident, SINK 22.5%",
    otip_fiRes_res: "<strong>Ordinary tax:</strong> employees taxed at the progressive rates, including residents and foreigners staying over 6 months.",
    opt_fiRes_res: "Ordinary tax",
    otip_fiRes_key: "<strong>Key employee:</strong> foreign experts recruited from abroad, earning at least 5,800 a month, not Finnish residents in the last 5 years.",
    opt_fiRes_key: "Key employee, 25% flat",
    otip_itImp_none: "<strong>Resident:</strong> people living in Italy, taxed at the ordinary progressive rates.",
    opt_itImp_none: "Resident",
    otip_itImp_imp50: "<strong>Impatriate, 50% exempt:</strong> highly qualified workers moving to Italy after 3 years abroad (longer if staying with the same employer), who commit to stay 4 years.",
    opt_itImp_imp50: "Impatriate, 50% exempt",
    otip_itImp_imp60: "<strong>Impatriate with a minor child:</strong> the same impatriate workers with a minor child, or a child born or adopted while on the regime.",
    opt_itImp_imp60: "Impatriate with a minor child, 60% exempt",
    otip_frCadre_noncadre: "<strong>Non-cadre:</strong> employees who are not managers or professionals, such as clerks, technicians and workers.",
    opt_frCadre_noncadre: "Non-cadre",
    otip_frCadre_cadre: "<strong>Cadre:</strong> managers and professionals with cadre status under their collective agreement.",
    opt_frCadre_cadre: "Cadre",
    otip_esRegime_res: "<strong>Resident:</strong> people living in Spain over 183 days a year, including those who moved here earlier.",
    opt_esRegime_res: "Resident",
    otip_esRegime_beckham: "<strong>Beckham regime:</strong> workers who move to Spain for a job, including digital nomad visa holders, not Spanish residents in the last 5 years.",
    opt_esRegime_beckham: "Beckham regime, 24% flat",
    otip_ptRegime_res: "<strong>Resident:</strong> people living in Portugal, taxed at the ordinary progressive rates.",
    opt_ptRegime_res: "Resident",
    otip_ptRegime_jovem: "<strong>IRS Jovem:</strong> workers up to age 35 in their first 10 years of earning, whatever their education, who are not claimed as a dependant.",
    opt_ptRegime_jovem: "IRS Jovem",
    otip_ptRegime_ifici: "<strong>IFICI:</strong> new residents in qualifying jobs, such as researchers, teachers and tech roles, not Portuguese residents in the last 5 years.",
    opt_ptRegime_ifici: "IFICI, 20% flat",
    otip_ptRegime_nonres: "<strong>Non-resident:</strong> people paid from Portuguese work who live elsewhere, such as short assignments.",
    opt_ptRegime_nonres: "Non-resident, 25% flat",
    opt_ptJovemYear_1: "Year 1",
    opt_ptJovemYear_2: "Year 2",
    opt_ptJovemYear_3: "Year 3",
    opt_ptJovemYear_4: "Year 4",
    opt_ptJovemYear_5: "Year 5",
    opt_ptJovemYear_6: "Year 6",
    opt_ptJovemYear_7: "Year 7",
    opt_ptJovemYear_8: "Year 8",
    opt_ptJovemYear_9: "Year 9",
    opt_ptJovemYear_10: "Year 10",
    otip_jpRes_y2: "<strong>Resident, year 2 or later:</strong> people who had an address in Japan on 1 January, so they owe resident tax on last year's income.",
    opt_jpRes_y2: "Resident, year 2 or later",
    otip_jpRes_y1: "<strong>Resident, first year:</strong> people who moved to Japan this year on a work visa, so had no address there on 1 January.",
    opt_jpRes_y1: "Resident, first year",
    otip_jpRes_nonres: "<strong>Non-resident:</strong> people with no home in Japan who stay under one year, such as short assignments.",
    opt_jpRes_nonres: "Non-resident, 20.42% flat",
    otip_krMethod_prog: "<strong>Progressive rates:</strong> the standard method for every employee, foreign or Korean.",
    opt_krMethod_prog: "Progressive rates",
    otip_krMethod_flat: "<strong>19% flat rate:</strong> foreign nationals working in Korea who elect it, for work until 31 Dec 2026.",
    opt_krMethod_flat: "19% flat rate for foreign workers",
    otip_cnRes_local: "<strong>Standard:</strong> Chinese nationals, and foreigners who take the usual special additional deductions.",
    opt_cnRes_local: "Standard",
    otip_cnRes_expat: "<strong>Expat:</strong> foreign nationals living in China, who may take housing, language and school allowances tax-free until 31 Dec 2027.",
    opt_cnRes_expat: "Expat with tax-free allowances",
    otip_twRes_res: "<strong>Resident:</strong> citizens, and foreigners on a residence certificate (ARC) who stay 183 days or more in the year.",
    opt_twRes_res: "Resident (183 days or more)",
    otip_twRes_nonres: "<strong>Non-resident:</strong> foreigners in Taiwan under 183 days in the year, such as short assignments.",
    opt_twRes_nonres: "Non-resident",
    otip_twEi_yes: "<strong>Covered:</strong> citizens, foreigners married to a citizen with household registration, and permanent residents.",
    opt_twEi_yes: "Covered: 11.5% + 1%",
    otip_twEi_no: "<strong>Not covered:</strong> other foreign employees on a work permit, who pay labour insurance only.",
    opt_twEi_no: "Foreign employee: 11.5% only",
    otip_gulfNat_expat: "<strong>Expatriate:</strong> foreign workers on an employer-sponsored work residence permit.",
    opt_gulfNat_expat: "Expatriate",
    otip_gulfNat_national: "<strong>National:</strong> citizens of the country you work in, covered by its pension scheme.",
    opt_gulfNat_national: "National",
    otip_saScheme_legacy: "<strong>Joined before 3 Jul 2024:</strong> employees already registered with GOSI before 3 July 2024.",
    opt_saScheme_legacy: "Joined before 3 Jul 2024",
    otip_saScheme_new: "<strong>New entrant:</strong> employees first registered with GOSI from 3 July 2024. The rate steps up each July.",
    opt_saScheme_new: "New entrant from 3 Jul 2024",
    opt_usFiling_S: "Single",
    opt_usFiling_MFJ: "Married filing jointly",
    opt_beStatus_single: "Single",
    opt_beStatus_married: "Married or legal cohabitant, sole earner",
    opt_chStatus_single: "Single",
    opt_chStatus_married: "Married, sole earner",
    opt_twStatus_single: "Single",
    opt_twStatus_married: "Married, filing jointly",
    opt_ukLoan_none: "None",
    opt_ukLoan_plan1: "Plan 1",
    opt_ukLoan_plan2: "Plan 2",
    opt_ukLoan_plan4: "Plan 4 (Scotland)",
    opt_ukLoan_plan5: "Plan 5",
    opt_deChurch_0: "None",
    opt_deChurch_8: "8% (Bavaria, Baden-Württemberg)",
    opt_deChurch_9: "9% (other states)",
    opt_idJkk_0_24: "0.24%, very low risk",
    opt_idJkk_0_54: "0.54%, low risk",
    opt_idJkk_0_89: "0.89%, medium risk",
    opt_idJkk_1_27: "1.27%, high risk",
    opt_idJkk_1_74: "1.74%, very high risk",
    opt_nlNorm_std: "Standard (48,013)",
    opt_nlNorm_young: "Under 30 with a master's (36,497)",
    opt_eeP2_0: "Off",
    opt_chAge_25: "25 to 34 (3.5%)",
    opt_chAge_35: "35 to 44 (5%)",
    opt_chAge_45: "45 to 54 (7.5%)",
    opt_chAge_55: "55 to 65 (9%)",
    opt_jpSupport_12: "Full year",
    opt_jpSupport_9: "Calendar 2026 (April to December)",
    lbl_country: "Country",
    lbl_usState: "State",
    tip_usState: "39 states and DC. Eleven states are left out because their deduction phase-outs are not loaded here.",
    lbl_usNyc: "Live in New York City",
    tip_usNyc: "New York City taxes its residents on top of the state, at 3.078% to 3.876%.",
    lbl_caProv: "Province",
    lbl_ukRegion: "Where you live",
    tip_ukRegion: "Scotland sets its own income tax bands. National Insurance is the same everywhere in the UK.",
    lbl_dir: "I know my",
    lbl_auRes: "Residency",
    lbl_sgRes: "Residency",
    lbl_sgAge: "Age",
    tip_sgAge: "The CPF employee rate falls with age, from 20% at 55 or under to 5% above 70.",
    lbl_usRes: "Tax status",
    lbl_deClass: "Tax class",
    lbl_idRes: "Residency",
    lbl_myRes: "Residency",
    lbl_nlRuling: "30% ruling",
    tip_nlRuling: "For employees recruited from abroad who lived over 150 km from the Dutch border. Up to 30% of pay is tax-free above the salary norm, 27% from 2027.",
    lbl_noRes: "Scheme",
    lbl_noNi: "Member of Norwegian national insurance",
    tip_noNi: "The PAYE rate is 25% for members and 17.4% for non-members.",
    lbl_seRes: "Residency",
    lbl_fiRes: "Scheme",
    lbl_beExpat: "Expat regime",
    tip_beExpat: "For employees recruited or posted from abroad earning over 70,000 a year: up to 35% of gross as a tax and social security free reimbursement.",
    lbl_itImp: "Regime",
    lbl_frCadre: "Contract",
    lbl_frImp: "Impatriate regime, 30% forfait",
    tip_frImp: "For employees recruited from abroad who were not French tax residents in the last 5 years: 30% of pay is exempt from income tax for up to 8 years.",
    lbl_esRegime: "Regime",
    lbl_ptRegime: "Regime",
    lbl_ptJovemYear: "Year of work",
    tip_ptJovemYear: "Exempt share: 100% in year 1, 75% in years 2 to 4, 50% in years 5 to 7, 25% in years 8 to 10, up to 29,542.15.",
    lbl_jpRes: "Residency",
    lbl_krMethod: "Tax method",
    lbl_cnRes: "Status",
    lbl_twRes: "Residency",
    lbl_twGold: "Gold Card",
    tip_twGold: "A Gold Card holder excludes 50% of salary above 3,000,000 for 5 years.",
    lbl_twEi: "Employment insurance",
    lbl_gulfNat: "Citizenship",
    lbl_saScheme: "GOSI scheme",
    lbl_usFiling: "Filing status",
    lbl_deKids: "Has children",
    tip_deKids: "Without children, long-term care costs 0.6% more.",
    lbl_idMarried: "Married",
    lbl_idDeps: "Dependants",
    tip_idDeps: "Each dependant adds 4.5 million to the non-taxable allowance (PTKP), up to three.",
    lbl_thSpouse: "Spouse with no income",
    lbl_thKids: "Children born before 2018",
    lbl_thKidsNew: "Children born 2018 or later",
    tip_thKidsNew: "From the second child, a child born 2018 or later gives 60,000 instead of 30,000.",
    lbl_mySpouse: "Spouse with no income",
    lbl_myKids: "Children",
    lbl_beStatus: "Household",
    tip_beStatus: "A sole earner moves up to 30% of income (max 11,780) to the partner, who is taxed on it with their own tax-free amount.",
    lbl_beKids: "Dependent children",
    lbl_beSingleParent: "Single parent",
    tip_beSingleParent: "A single parent with dependent children adds 1,980 to the tax-free amount.",
    lbl_chStatus: "Household",
    lbl_chKids: "Children",
    lbl_frMarried: "Married or in a PACS",
    tip_frMarried: "A couple is taxed jointly on two parts. Each child adds half a part, a third child a whole part.",
    lbl_frKids: "Children",
    lbl_esKids: "Children",
    lbl_ptDepOld: "Dependants aged 7 or over",
    lbl_ptDepMid: "Dependants aged 4 to 6",
    lbl_ptDepYoung: "Dependants aged 3 or under",
    tip_ptDepYoung: "600 off the tax for each dependant, 726 for a first one aged 3 or under, 900 for a second or later one aged 6 or under.",
    lbl_caKids: "Children 18 or under",
    tip_caKids: "Each child adds 554 to the Ontario Tax Reduction.",
    lbl_hkMarried: "Married, partner with no income",
    lbl_hkKids: "Children",
    lbl_twStatus: "Household",
    lbl_twKids: "Minor children",
    lbl_krDeps: "Dependants",
    tip_krDeps: "Each dependant adds the 1.5 million basic deduction.",
    lbl_auCover: "Private hospital cover",
    tip_auCover: "Without it, the Medicare levy surcharge of 1% to 1.5% applies above 105,000.",
    lbl_auSuper: "Amount includes super",
    tip_auSuper: "<ul><li><strong>On:</strong> the amount is a package with the 12% super guarantee inside it.</li><li><strong>Off:</strong> super is paid on top.</li></ul>",
    lbl_ukLoan: "Student loan",
    tip_ukLoan: "9% of pay above the plan's threshold: 26,900, 29,385, 33,795 or 25,000.",
    lbl_ukPg: "Postgraduate loan",
    tip_ukPg: "6% of pay above 21,000, on top of any plan.",
    lbl_deChurch: "Church tax",
    tip_deChurch: "A church member pays a share of the income tax: 8% in Bavaria and Baden-Württemberg, 9% elsewhere.",
    lbl_deAddOn: "Health insurance add-on",
    tip_deAddOn: "Each health fund sets its own add-on; 2.9% is the 2026 average. You pay half.",
    lbl_usLocal: "Local or county income tax",
    tip_usLocal: "Some cities and counties tax wages too (Maryland counties, Philadelphia, Detroit). Enter the rate on gross pay.",
    lbl_usNyDbl: "Employer collects NY disability (DBL)",
    tip_usNyDbl: "0.5% of pay, at most 0.60 a week. The employer may take it from pay or meet it in full.",
    lbl_usFicaExempt: "Exempt from Social Security and Medicare",
    tip_usFicaExempt: "F, J, M and Q visa holders are usually exempt (students and scholars).",
    lbl_idJkk: "Work accident rate (JKK)",
    tip_idJkk: "Employer premiums for work accident, death and health count as taxable income. The JKK rate depends on the industry.",
    lbl_idBpjs: "Pay BPJS as a resident would",
    lbl_myLindung: "Claim LINDUNG as SOCSO relief",
    tip_myLindung: "Unconfirmed whether an expat can claim it, so it starts off. It moves the tax by RM31.50 at most.",
    lbl_nlNorm: "Salary norm",
    tip_nlNorm: "The ruling cannot take pay below the salary norm, so the tax-free part is pay less the norm when that is smaller.",
    lbl_nlHoliday: "Holiday allowance paid on top",
    tip_nlHoliday: "Dutch pay adds 8% holiday allowance, usually paid in May. Switched on, the amount you enter excludes it and 8% is added.",
    lbl_nlPension: "Pension contribution, your share",
    tip_nlPension: "Deducted before tax. Entered as a share of gross; schemes that start above a franchise take less.",
    lbl_seMun: "Municipal tax rate",
    tip_seMun: "Stockholm is 30.55%; the national average is 32.38%.",
    lbl_seBurial: "Burial fee",
    tip_seBurial: "The national average is 0.292%. Members of the Church of Sweden pay a church fee instead.",
    lbl_eeP2: "Pension pillar II",
    lbl_eePension: "At pension age",
    tip_eePension: "The tax-free allowance is 776 a month instead of 700.",
    lbl_fiMun: "Municipal tax rate",
    tip_fiMun: "Helsinki is 5.30%.",
    lbl_fiChurch: "Church tax rate",
    tip_fiChurch: "For church members: 1.00% in Helsinki for the Lutheran church.",
    lbl_beMun: "Municipal surcharge",
    tip_beMun: "Charged on the federal tax. Most communes set 6% to 8%.",
    lbl_chChurch: "Church member",
    tip_chChurch: "Church tax is about 10% of the simple cantonal tax in the City of Zurich.",
    lbl_chAge: "Age (pension rate)",
    tip_chAge: "Your half of the BVG age credit on the coordinated salary.",
    lbl_chNbu: "Accident insurance (NBU)",
    tip_chNbu: "Non-occupational accident insurance; the rate depends on the insurer.",
    lbl_chCommune: "Communal multiplier",
    tip_chCommune: "A share of the simple cantonal tax. The City of Zurich is 119%.",
    lbl_frMutuelle: "Company health cover, your share",
    tip_frMutuelle: "Mandatory company health and protection cover. Your share is taken from pay and deducted before tax.",
    lbl_esTemp: "Temporary contract",
    tip_esTemp: "Unemployment insurance is 1.60% instead of 1.55%.",
    lbl_ptHealth: "Health expenses",
    tip_ptHealth: "15% comes off the tax, up to 1,000.",
    lbl_ptEdu: "Education expenses",
    tip_ptEdu: "30% comes off the tax, up to 800.",
    lbl_ptRent: "Rent on your home",
    tip_ptRent: "15% comes off the tax, up to 900 for 2026 rents.",
    lbl_ptColeta: "General family expenses deduction",
    tip_ptColeta: "35% of everyday spending on e-Fatura invoices, up to 250. Most people reach the cap.",
    lbl_jpCare: "Aged 40 to 64",
    tip_jpCare: "Adds the long-term care premium: health becomes 11.47% instead of 9.85%, half each.",
    lbl_jpSupport: "Child-support levy",
    tip_jpSupport: "The 0.23% levy starts with April 2026 wages. Full year shows a steady year.",
    lbl_cnHf: "Housing fund rate",
    tip_cnHf: "The employer sets it between 5% and 7%.",
    lbl_cnAllow: "Tax-free allowances",
    tip_cnAllow: "Housing, language training and children's education allowances for the year.",
    lbl_cnSpecial: "Special additional deductions",
    tip_cnSpecial: "Children, elderly care, housing rent or loan interest, further study.",
    lbl_hkMpf: "MPF member",
    tip_hkMpf: "5% of pay, at most 1,500 a month, and nothing below 7,100 a month. Deductible up to 18,000.",
    lbl_gulfWagePct: "Contributory share of pay",
    tip_gulfWagePct: "Contributions are on the contributory wage (in Saudi Arabia basic pay plus housing). Lower it if allowances are excluded.",
    sub_1: "Rules for the City of Zurich. Other cantons are not loaded yet.",
    sub_2: "Rules for Milan, Lombardy. Other regions are not loaded yet.",
    sub_3: "Rules for the Community of Madrid. Other regions are not loaded yet.",
    sub_4: "Rules for Tokyo (Kyokai Kenpo Tokyo rates).",
    sub_5: "Rules for Shanghai.",
    sub_6: "Mainland Portugal. Madeira and the Azores have their own rates.",
    sub_7: "Nationals and expatriates pay no income tax on wages here.",
    sub_8: "Every Hong Kong earner pays on the same terms. Set MPF on the Details tab.",
    sub_9: "A nonresident alien files as single.",
    sub_10: "Only Ontario's tax reduction uses children here.",
    grp_where_you_work: "Where you work",
    grp_your_pay: "Your pay",
    grp_your_status: "Your status",
    grp_household: "Household",
    grp_details: "Details",
    unitYr: "/yr",
    title: "Global Income Tax Calculator",
    qsLabel: "Quick Start",
    qsTip: "Replaces every job with a worked comparison. Change any figure over the top of it.",
    qs_asia: "Asia hubs",
    qsTip_asia: "Four expat offers: S$180,000 in Singapore, HK$1,300,000 in Hong Kong (China), ¥15 million in Tokyo and AED 600,000 in Dubai, side by side in US dollars.",
    qs_europe: "European tech",
    qsTip_europe: "One senior engineer, four cities: £95,000 in London, €95,000 in Amsterdam with the 30% ruling, €95,000 in Berlin and CHF 140,000 in Zurich.",
    qs_us: "US states",
    qsTip_us: "US$150,000, single, in Texas, California, New York City and Illinois. Same federal tax, different state and city tax.",
    qs_net: "Same take-home, Southern Europe",
    qsTip_net: "What gross pay leaves €4,000 a month in Paris, Madrid, Lisbon and Milan, for a single resident.",
    qs_family: "Family of four",
    qsTip_family: "A sole earner on €80,000 with a partner at home and two children, in Belgium, France, Germany and the Netherlands.",
    jobsLabel: "Jobs",
    addJob: "+ Add job",
    addJobTitle: "Add a job, starting as a copy of this one",
    tab_salary: "Salary",
    tab_household: "Household",
    tab_details: "Details",
    periodAria: "Pay period",
    dispCurLabel: "Show amounts in",
    dispCurAria: "Currency to show amounts in",
    dispPerLabel: "Per",
    dispPerAria: "Show amounts per year or per month",
    chartTitlePct: "Take-home share across the pay range",
    chartTitleAmt: "Take-home pay across the pay range",
    chartMeasureAria: "Show take-home as",
    svgTitle: "Download this chart as SVG",
    pngTitle: "Download this chart as PNG",
    copyTitle: "Copy PNG to clipboard",
    resetZoomTitle: "Reset zoom",
    hoverHint: "Hover the chart to read each job's take-home at that gross pay.",
    compareTitle: "Where the pay goes",
    csvTitle: "Download this table as CSV",
    linesTitle: "Take-home pay breakdowns",
    linesJobLabel: "Job",
    linesJobTitle: "Choose which job to break down",
    linesCsvTitle: "Download every job's lines as CSV",
    assumesTitle: "What this assumes",
    countriesTitle: "Income tax, country by country",
    countriesSub: "One page per country: the tax rules with their sources, worked examples and tax tips.",
    mapLinkHtml: "This tool shows your net income after tax. Want to know how much you'd actually save once living costs are counted? Try the <a href=\"https://tool.adjiebrotots.com/costofliving-comparator/\" style=\"color:var(--accent-strong);font-weight:700;text-decoration:none;\">Cost of Living Comparator</a>.",
    opt_dispCur_local: "Each job's own currency",
    opt_dispCur_USD: "US dollar (USD)",
    opt_dispCur_EUR: "Euro (EUR)",
    opt_dispCur_GBP: "British pound (GBP)",
    opt_dispCur_AUD: "Australian dollar (AUD)",
    opt_dispCur_SGD: "Singapore dollar (SGD)",
    opt_dispCur_IDR: "Indonesian rupiah (IDR)",
    opt_dispCur_JPY: "Japanese yen (JPY)",
    opt_dispCur_CHF: "Swiss franc (CHF)",
    opt_dispCur_CAD: "Canadian dollar (CAD)",
    opt_dispCur_HKD: "Hong Kong dollar (HKD)",
    opt_dispCur_AED: "UAE dirham (AED)",
    opt_dispCur_CNY: "Chinese yuan (CNY)",
    opt_dispCur_KRW: "Korean won (KRW)",
    opt_dispCur_MYR: "Malaysian ringgit (MYR)",
    opt_dispCur_THB: "Thai baht (THB)",
    opt_dispCur_TWD: "New Taiwan dollar (TWD)",
    opt_dispCur_SEK: "Swedish krona (SEK)",
    opt_dispCur_NOK: "Norwegian krone (NOK)",
    opt_dispCur_SAR: "Saudi riyal (SAR)",
    opt_dispCur_QAR: "Qatari riyal (QAR)",
    opt_dispCur_BHD: "Bahraini dinar (BHD)",
    opt_dispCur_KWD: "Kuwaiti dinar (KWD)",
    opt_dispCur_OMR: "Omani rial (OMR)",
    opt_dispPer_year: "Year",
    opt_dispPer_month: "Month",
    opt_chartMeasure_pct: "% of gross",
    opt_chartMeasure_amount: "Amount",
    // Drawn by this script.
    perYear: "a year",
    perMonth: "a month",
    emptyHousehold: "No household details change the result in {name}.",
    emptyDetails: "Nothing more to set for {name}.",
    amountTipNet: "What lands in your account after income tax and employee contributions. The gross pay that leaves it is solved for.",
    amountTipGross: "Before income tax and employee contributions. Contributions your employer pays on top are not part of it.",
    placeUS: "{state}, US",
    placeCA: "{prov}, Canada",
    placeSco: "Scotland, UK",
    nyc: "New York City",
    chipTitle: "Switch the form to job {n}",
    chipMo: "/mo",
    chipYr: "/yr",
    chipNet: " net",
    notLoaded: "not loaded",
    removeJob: "Remove job {n}",
    vNotLoaded: "These rules are not loaded yet.",
    vNsLine: "Job {n} ({name}) is not worked out: {reason}",
    vSolved: "To take home {target} {per} in {name} you need {gross} gross.",
    vNet: "Take-home pay in {name} is {net} {per}, {pct} of gross.",
    vBody: "Income tax takes {tax} and employee contributions {soc}.",
    vMarg: "Of the next 1% of pay, {m} goes to tax and contributions.",
    jobName: "Job {n} ({place})",
    vAllNet: "{name} needs the least gross pay for the same take-home: {g} {per}.",
    vTie: "{a} and {b} leave the same take-home pay.",
    vBest: "{a} leaves the most: {v} {per}, {gap} more than {b}.",
    vShares: "Take-home as a share of gross: {list}.",
    vUsd: "Compared in US dollars at the rates of {date}.",
    mTake: "Take-home pay",
    mTarget: ", the target you set",
    mGross: "Gross pay",
    mSolved: "Solved for your take-home",
    mTax: "Income tax",
    mTaxSub: "{pct} of gross, all levels",
    mMarg: "Marginal rate",
    mMargTip: "The share of the next 1% of pay that goes to tax and contributions.",
    mContrib: "Contributions {x}",
    mNotLoaded: "Not loaded",
    mGrossFor: "Gross {g} for this take-home",
    mFrom: "From {g} gross",
    mTaxContrib: "Tax {p}, contributions {q}",
    chartLib: "The chart library could not be loaded, so the chart is unavailable. Every number on this page is still correct.",
    chartSub: "One gross pay axis per currency ({curs}), lined up at the exchange rates of {date}.",
    takenHomePct: "% taken home",
    takenHome: " taken home",
    axGrossYear: "Gross pay a year",
    axGrossCur: "Gross pay ({c} a year)",
    tipGross: "Gross {g} a year",
    asEntered: " (as entered)",
    axTakeCur: "Take-home pay ({c} a year)",
    axTakePct: "Take-home (% of gross)",
    rowGross: "Gross pay",
    rowTax: "Income tax, all levels",
    rowSocial: "Employee contributions",
    rowOther: "Other deductions from pay",
    rowNet: "Take-home pay",
    rowShare: "Take-home share of gross",
    rowMarg: "Marginal rate, next 1% of pay",
    thItem: "Item",
    ownCur: "own currency",
    stOfficial: "Official",
    stOfficialW: "confirmed on a government page.",
    stSecondary: "Secondary",
    stSecondaryW: "a Big Four, law firm or payroll source citing the rule.",
    stAssumption: "Assumption",
    stAssumptionW: "a modelling choice, stated so you can weigh it.",
    fromDate: "In force from {f}.",
    fromThresholds: "Uses the {f}.",
    fromRules: "Rules for {f}.",
    srcLabel: "Source: {name}.",
    opensSource: " Opens the source.",
    rising: " rising to ",
    band: "{lo} to {hi} at {rate}",
    secTaxable: "Taxable income",
    secTake: "Take-home pay",
    secNotIn: "Not in take-home pay",
    deductibleContrib: "Deductible contributions",
    unusedDed: "Deductions bigger than the pay, unused",
    ofWhich: "of which {x}",
    gTax: "Income tax",
    gSocial: "Social contributions",
    gOther: "Other deductions from pay",
    gBenefit: "Tax-free cash",
    takeYear: "Take-home pay, a year",
    takeMonth: "Take-home pay, a month",
    amountsIn: "amounts in {cur} a year",
    plusMinus: "Plus or minus",
    thLine: "Line",
    thAmount: "Amount",
    curYear: "{cur} a year",
    thStatus: "Status",
    aRules: "{year} rules",
    aFor: " for {place}",
    aSolved: " Gross pay is solved so take-home reaches {x} a year.",
    aNotWorked: " Not worked out: {reason}",
    aChoice: "{label} is a stated modelling choice.",
    aFx: "<strong>Exchange rates</strong> are those of {date} ({src}{bundled}), for reading only: every sum is worked out in the job's own currency.",
    aBundled: ", bundled with the page",
    aIncome: "<strong>Employment income only.</strong> No bonuses, equity, benefits in kind, other income, tax treaties or foreign tax credits.",
    aYear: "<strong>A full year</strong> in one job. Where a rule changes mid-year (a cap from 1 July, a rate from 1 June) each month is worked out and summed.",
    csvHead: "Global Income Tax Calculator, tool.adjiebrotots.com/global-income-tax-calculator",
    csvAmounts: "Amounts {per}, {cur}",
    csvEachCur: "each job in its own currency",
    roleAdded: "added",
    roleTaken: "taken off",
    roleResult: "result",
    roleStart: "start",
    rolePart: "part of the line above",
    roleBand: "by bracket, makes the tax line above",
    roleAside: "for reference, already counted",
    roleRef: "for reference",
    csvJob: "Job",
    csvCountry: "Country",
    csvSection: "Section",
    csvRole: "Role",
    csvLine: "Line",
    csvAmountYear: "Amount a year",
    csvCurrency: "Currency",
    csvStatus: "Status",
    csvSource: "Source",
    csvSourceUrl: "Source URL",
    csvFrom: "Effective from",
    csvNotWorked: "Not worked out: {reason}",
    subNotLoaded: "{job}: not loaded",
    madeUsing: "Made using tool.adjiebrotots.com/global-income-tax-calculator",
    searchCountry: "Search country…",
    searchState: "Search state…",
    searchProv: "Search province…",
    colTitle: "Opened from the Cost of Living Comparator",
    colOn: " on {place}, per month. ",
    colNet: "The gross pay shown is what leaves the net income it needs.",
    colGross: "Enter the gross salary to see the take-home pay.",
    colSet: " Set residency and household on the left to match you.",
    dismiss: "Dismiss",
    agentJobs: "{n} jobs: {list}",
    agentJob: "{n} job: {list}",
    agentJobsLabel: "Jobs"
  },
  id: {
    // The page: every [data-i18n*] key in index.html (_ref/bake-id.mjs bakes the id ones into id/).
    opt_country_AU: "Australia",
    opt_country_CN: "Tiongkok (Shanghai)",
    opt_country_HK: "Hong Kong (Tiongkok)",
    opt_country_ID: "Indonesia",
    opt_country_JP: "Jepang (Tokyo)",
    opt_country_MY: "Malaysia",
    opt_country_SG: "Singapura",
    opt_country_KR: "Korea Selatan",
    opt_country_TW: "Taiwan (Tiongkok)",
    opt_country_TH: "Thailand",
    opt_country_BE: "Belgia",
    opt_country_EE: "Estonia",
    opt_country_FI: "Finlandia",
    opt_country_FR: "Prancis",
    opt_country_DE: "Jerman",
    opt_country_IT: "Italia (Milan)",
    opt_country_NL: "Belanda",
    opt_country_NO: "Norwegia",
    opt_country_PT: "Portugal",
    opt_country_ES: "Spanyol (Madrid)",
    opt_country_SE: "Swedia",
    opt_country_CH: "Swiss (Zürich)",
    opt_country_GB: "Inggris",
    opt_country_CA: "Kanada",
    opt_country_US: "Amerika Serikat",
    opt_country_BH: "Bahrain",
    opt_country_KW: "Kuwait",
    opt_country_OM: "Oman",
    opt_country_QA: "Qatar",
    opt_country_SA: "Arab Saudi",
    opt_country_AE: "Uni Emirat Arab",
    og_Asia_Pacific: "Asia Pasifik",
    og_Europe: "Eropa",
    og_Americas: "Amerika",
    og_Gulf: "Negara Teluk",
    opt_ukRegion_ruk: "Inggris, Wales, atau Irlandia Utara",
    opt_ukRegion_sco: "Skotlandia",
    opt_dir_gross: "Gaji kotor",
    opt_dir_net: "Gaji bersih",
    opt_period_yearly: "setahun",
    opt_period_monthly: "sebulan",
    otip_auRes_pr: "<strong>Warga negara atau penduduk tetap:</strong> warga negara Australia dan pemegang visa permanen, misalnya visa skilled 189, 190 atau 186, atau visa partner 801 dan 100.",
    opt_auRes_pr: "Warga negara atau penduduk tetap",
    otip_auRes_temp: "<strong>Penduduk sementara:</strong> pemegang visa sementara tanpa akses Medicare, misalnya visa 482 Skills in Demand, 485 Graduate atau 500 Student.",
    opt_auRes_temp: "Penduduk sementara, bebas Medicare levy",
    otip_auRes_foreign: "<strong>Penduduk asing:</strong> berada di Australia kurang dari 6 bulan tanpa rencana menetap, misalnya dengan visa turis 600 atau visa kerja singkat 400.",
    opt_auRes_foreign: "Penduduk asing (foreign resident)",
    otip_auRes_whm: "<strong>Working holiday maker:</strong> pemegang visa Working Holiday (417) atau Work and Holiday (462).",
    opt_auRes_whm: "Working holiday maker",
    otip_sgRes_ep: "<strong>Employment Pass atau S Pass:</strong> profesional dan tenaga terampil asing yang memegang Employment Pass atau S Pass.",
    opt_sgRes_ep: "Employment Pass atau S Pass",
    otip_sgRes_citizen: "<strong>Warga negara, atau penduduk tetap mulai tahun ke-3:</strong> warga negara Singapura, dan penduduk tetap mulai tahun ketiga sejak status penduduk tetap diberikan.",
    opt_sgRes_citizen: "Warga negara, atau penduduk tetap mulai tahun ke-3",
    otip_sgRes_pr1: "<strong>Penduduk tetap, tahun ke-1:</strong> penduduk tetap Singapura yang baru, di tahun pertama sejak status penduduk tetap diberikan, sering kali setelah memegang Employment Pass atau S Pass.",
    opt_sgRes_pr1: "Penduduk tetap, tahun ke-1",
    otip_sgRes_pr2: "<strong>Penduduk tetap, tahun ke-2:</strong> penduduk tetap Singapura di tahun kedua sejak status penduduk tetap diberikan.",
    opt_sgRes_pr2: "Penduduk tetap, tahun ke-2",
    otip_sgRes_nonres: "<strong>Bukan penduduk pajak:</strong> siapa pun yang berada di Singapura kurang dari 183 hari dalam setahun, misalnya karyawan yang ditugaskan sebentar.",
    opt_sgRes_nonres: "Bukan penduduk pajak (kurang dari 183 hari)",
    opt_sgAge_55: "55 tahun atau kurang",
    opt_sgAge_60: "Di atas 55 sampai 60",
    opt_sgAge_65: "Di atas 60 sampai 65",
    opt_sgAge_70: "Di atas 65 sampai 70",
    opt_sgAge_99: "Di atas 70",
    otip_usRes_res: "<strong>Warga negara atau penduduk pajak:</strong> warga negara AS, pemegang green card, dan pemegang visa seperti H-1B atau L-1 yang lolos substantial presence test.",
    opt_usRes_res: "Warga negara atau penduduk pajak",
    otip_usRes_nra: "<strong>Nonresident alien:</strong> tanpa green card dan tidak lolos substantial presence test, misalnya mahasiswa F-1 atau J-1 di 5 tahun kalender pertamanya, atau pendatang H-1B sebelum 183 hari.",
    opt_usRes_nra: "Nonresident alien",
    otip_deClass_I: "<strong>Kelas I:</strong> karyawan lajang, bercerai, atau janda/duda. Pasangan yang gajinya setara memakai kelas IV, yang pajaknya sama.",
    opt_deClass_I: "Kelas I, lajang",
    otip_deClass_III: "<strong>Kelas III:</strong> pasangan menikah atau terdaftar, salah satunya bergaji kecil atau tidak bergaji dan pasangannya masuk kelas V.",
    opt_deClass_III: "Kelas III, menikah, pasangan bergaji kecil",
    otip_idRes_res: "<strong>Penduduk pajak:</strong> WNI, dan WNA yang berada di Indonesia 183 hari atau lebih dalam 12 bulan atau berniat menetap, termasuk pemegang KITAS dan KITAP.",
    opt_idRes_res: "Penduduk pajak",
    otip_idRes_nonres: "<strong>Bukan penduduk pajak:</strong> WNA yang ditugaskan sebentar, kurang dari 183 hari dalam 12 bulan dan tidak berniat menetap.",
    opt_idRes_nonres: "Bukan penduduk pajak (PPh 26)",
    otip_myRes_citizen: "<strong>Warga negara atau penduduk tetap:</strong> warga negara dan penduduk tetap Malaysia.",
    opt_myRes_citizen: "Warga negara atau penduduk tetap",
    otip_myRes_expat: "<strong>Ekspatriat, penduduk pajak:</strong> WNA pemegang Employment Pass yang berada di Malaysia 182 hari atau lebih dalam setahun.",
    opt_myRes_expat: "Ekspatriat, penduduk pajak (182 hari atau lebih)",
    otip_myRes_nonres: "<strong>Ekspatriat, bukan penduduk pajak:</strong> karyawan asing yang berada di Malaysia kurang dari 182 hari dalam setahun, misalnya karena penugasan singkat.",
    opt_myRes_nonres: "Ekspatriat, bukan penduduk pajak",
    otip_noRes_res: "<strong>Pajak biasa:</strong> orang yang tinggal di Norwegia, termasuk WNA yang berada di sana lebih dari 183 hari dalam 12 bulan.",
    opt_noRes_res: "Pajak biasa",
    otip_noRes_paye: "<strong>Skema PAYE:</strong> pekerja asing yang bukan penduduk pajak Norwegia, misalnya yang tinggal sebentar atau pulang-pergi dari negara tetangga.",
    opt_noRes_paye: "Skema PAYE, tarif tunggal 25%",
    otip_seRes_res: "<strong>Penduduk pajak:</strong> orang yang tinggal di Swedia atau berada di sana 6 bulan atau lebih, termasuk pekerja asing dengan izin kerja.",
    opt_seRes_res: "Penduduk pajak",
    otip_seRes_sink: "<strong>Bukan penduduk pajak, SINK:</strong> orang yang bekerja di Swedia tetapi tinggal di luar negeri, misalnya pekerja lintas batas atau penugasan di bawah 6 bulan.",
    opt_seRes_sink: "Bukan penduduk pajak, SINK 22,5%",
    otip_fiRes_res: "<strong>Pajak biasa:</strong> karyawan yang dikenai tarif progresif, termasuk penduduk dan WNA yang tinggal lebih dari 6 bulan.",
    opt_fiRes_res: "Pajak biasa",
    otip_fiRes_key: "<strong>Key employee:</strong> tenaga ahli asing yang direkrut dari luar negeri, bergaji minimal 5.800 sebulan, dan tidak menjadi penduduk Finlandia dalam 5 tahun terakhir.",
    opt_fiRes_key: "Key employee, tarif tunggal 25%",
    otip_itImp_none: "<strong>Penduduk pajak:</strong> orang yang tinggal di Italia dan dikenai tarif progresif biasa.",
    opt_itImp_none: "Penduduk pajak",
    otip_itImp_imp50: "<strong>Impatriat, 50% dibebaskan:</strong> tenaga berkualifikasi tinggi yang pindah ke Italia setelah 3 tahun di luar negeri (lebih lama bila tetap di pemberi kerja yang sama) dan berkomitmen tinggal 4 tahun.",
    opt_itImp_imp50: "Impatriat, 50% dibebaskan",
    otip_itImp_imp60: "<strong>Impatriat dengan anak di bawah umur:</strong> pekerja impatriat yang sama, dengan anak di bawah umur atau anak yang lahir atau diadopsi selama memakai rezim ini.",
    opt_itImp_imp60: "Impatriat dengan anak di bawah umur, 60% dibebaskan",
    otip_frCadre_noncadre: "<strong>Non-cadre:</strong> karyawan yang bukan manajer atau tenaga profesional, misalnya staf administrasi, teknisi, dan pekerja.",
    opt_frCadre_noncadre: "Non-cadre",
    otip_frCadre_cadre: "<strong>Cadre:</strong> manajer dan tenaga profesional yang berstatus cadre menurut perjanjian kerja bersama.",
    opt_frCadre_cadre: "Cadre",
    otip_esRegime_res: "<strong>Penduduk pajak:</strong> orang yang tinggal di Spanyol lebih dari 183 hari setahun, termasuk yang sudah pindah lebih dulu.",
    opt_esRegime_res: "Penduduk pajak",
    otip_esRegime_beckham: "<strong>Rezim Beckham:</strong> pekerja yang pindah ke Spanyol untuk bekerja, termasuk pemegang visa digital nomad, yang tidak menjadi penduduk Spanyol dalam 5 tahun terakhir.",
    opt_esRegime_beckham: "Rezim Beckham, tarif tunggal 24%",
    otip_ptRegime_res: "<strong>Penduduk pajak:</strong> orang yang tinggal di Portugal dan dikenai tarif progresif biasa.",
    opt_ptRegime_res: "Penduduk pajak",
    otip_ptRegime_jovem: "<strong>IRS Jovem:</strong> pekerja berusia sampai 35 tahun di 10 tahun pertama masa kerjanya, apa pun pendidikannya, yang tidak diklaim sebagai tanggungan.",
    opt_ptRegime_jovem: "IRS Jovem",
    otip_ptRegime_ifici: "<strong>IFICI:</strong> penduduk baru di pekerjaan yang memenuhi syarat, misalnya peneliti, pengajar, dan bidang teknologi, yang tidak menjadi penduduk Portugal dalam 5 tahun terakhir.",
    opt_ptRegime_ifici: "IFICI, tarif tunggal 20%",
    otip_ptRegime_nonres: "<strong>Bukan penduduk pajak:</strong> orang yang dibayar untuk pekerjaan di Portugal tetapi tinggal di negara lain, misalnya karena penugasan singkat.",
    opt_ptRegime_nonres: "Bukan penduduk pajak, tarif tunggal 25%",
    opt_ptJovemYear_1: "Tahun ke-1",
    opt_ptJovemYear_2: "Tahun ke-2",
    opt_ptJovemYear_3: "Tahun ke-3",
    opt_ptJovemYear_4: "Tahun ke-4",
    opt_ptJovemYear_5: "Tahun ke-5",
    opt_ptJovemYear_6: "Tahun ke-6",
    opt_ptJovemYear_7: "Tahun ke-7",
    opt_ptJovemYear_8: "Tahun ke-8",
    opt_ptJovemYear_9: "Tahun ke-9",
    opt_ptJovemYear_10: "Tahun ke-10",
    otip_jpRes_y2: "<strong>Penduduk pajak, tahun ke-2 dan seterusnya:</strong> orang yang sudah terdaftar beralamat di Jepang pada 1 Januari, sehingga terutang pajak penduduk atas penghasilan tahun lalu.",
    opt_jpRes_y2: "Penduduk pajak, tahun ke-2 dan seterusnya",
    otip_jpRes_y1: "<strong>Penduduk pajak, tahun pertama:</strong> orang yang pindah ke Jepang tahun ini dengan visa kerja, sehingga belum beralamat di sana pada 1 Januari.",
    opt_jpRes_y1: "Penduduk pajak, tahun pertama",
    otip_jpRes_nonres: "<strong>Bukan penduduk pajak:</strong> orang tanpa tempat tinggal di Jepang yang berada di sana kurang dari setahun, misalnya karena penugasan singkat.",
    opt_jpRes_nonres: "Bukan penduduk pajak, tarif tunggal 20,42%",
    otip_krMethod_prog: "<strong>Tarif progresif:</strong> cara standar untuk semua karyawan, baik WNA maupun warga Korea.",
    opt_krMethod_prog: "Tarif progresif",
    otip_krMethod_flat: "<strong>Tarif tunggal 19%:</strong> WNA yang bekerja di Korea dan memilih cara ini, untuk pekerjaan sampai 31 Des 2026.",
    opt_krMethod_flat: "Tarif tunggal 19% untuk pekerja asing",
    otip_cnRes_local: "<strong>Standar:</strong> warga Tiongkok, dan WNA yang memakai potongan tambahan khusus seperti biasa.",
    opt_cnRes_local: "Standar",
    otip_cnRes_expat: "<strong>Ekspatriat:</strong> WNA yang tinggal di Tiongkok, yang boleh menerima tunjangan perumahan, bahasa, dan sekolah anak bebas pajak sampai 31 Des 2027.",
    opt_cnRes_expat: "Ekspatriat dengan tunjangan bebas pajak",
    otip_twRes_res: "<strong>Penduduk pajak:</strong> warga negara, dan WNA pemegang izin tinggal (ARC) yang berada di sana 183 hari atau lebih dalam setahun.",
    opt_twRes_res: "Penduduk pajak (183 hari atau lebih)",
    otip_twRes_nonres: "<strong>Bukan penduduk pajak:</strong> WNA yang berada di Taiwan kurang dari 183 hari dalam setahun, misalnya karena penugasan singkat.",
    opt_twRes_nonres: "Bukan penduduk pajak",
    otip_twEi_yes: "<strong>Ikut asuransi ketenagakerjaan:</strong> warga negara, WNA yang menikah dengan warga negara dan terdaftar di kartu keluarga, serta penduduk tetap.",
    opt_twEi_yes: "Ikut: 11,5% + 1%",
    otip_twEi_no: "<strong>Tidak ikut:</strong> karyawan asing lain dengan izin kerja, yang hanya membayar asuransi tenaga kerja.",
    opt_twEi_no: "Karyawan asing: 11,5% saja",
    otip_gulfNat_expat: "<strong>Ekspatriat:</strong> pekerja asing dengan izin tinggal kerja yang disponsori pemberi kerja.",
    opt_gulfNat_expat: "Ekspatriat",
    otip_gulfNat_national: "<strong>Warga negara:</strong> warga negara tempatmu bekerja, yang ikut skema pensiun negara itu.",
    opt_gulfNat_national: "Warga negara",
    otip_saScheme_legacy: "<strong>Terdaftar sebelum 3 Jul 2024:</strong> karyawan yang sudah terdaftar di GOSI sebelum 3 Juli 2024.",
    opt_saScheme_legacy: "Terdaftar sebelum 3 Jul 2024",
    otip_saScheme_new: "<strong>Peserta baru:</strong> karyawan yang pertama kali terdaftar di GOSI mulai 3 Juli 2024. Tarifnya naik setiap Juli.",
    opt_saScheme_new: "Peserta baru mulai 3 Jul 2024",
    opt_usFiling_S: "Lajang (single)",
    opt_usFiling_MFJ: "Menikah, lapor bersama (MFJ)",
    opt_beStatus_single: "Lajang",
    opt_beStatus_married: "Menikah atau kohabitasi resmi, satu pencari nafkah",
    opt_chStatus_single: "Lajang",
    opt_chStatus_married: "Menikah, satu pencari nafkah",
    opt_twStatus_single: "Lajang",
    opt_twStatus_married: "Menikah, lapor bersama",
    opt_ukLoan_none: "Tidak ada",
    opt_ukLoan_plan1: "Plan 1",
    opt_ukLoan_plan2: "Plan 2",
    opt_ukLoan_plan4: "Plan 4 (Skotlandia)",
    opt_ukLoan_plan5: "Plan 5",
    opt_deChurch_0: "Tidak ada",
    opt_deChurch_8: "8% (Bavaria, Baden-Württemberg)",
    opt_deChurch_9: "9% (negara bagian lain)",
    opt_idJkk_0_24: "0,24%, risiko sangat rendah",
    opt_idJkk_0_54: "0,54%, risiko rendah",
    opt_idJkk_0_89: "0,89%, risiko sedang",
    opt_idJkk_1_27: "1,27%, risiko tinggi",
    opt_idJkk_1_74: "1,74%, risiko sangat tinggi",
    opt_nlNorm_std: "Standar (48.013)",
    opt_nlNorm_young: "Di bawah 30 tahun dengan gelar master (36.497)",
    opt_eeP2_0: "Tidak ikut",
    opt_chAge_25: "25 sampai 34 (3,5%)",
    opt_chAge_35: "35 sampai 44 (5%)",
    opt_chAge_45: "45 sampai 54 (7,5%)",
    opt_chAge_55: "55 sampai 65 (9%)",
    opt_jpSupport_12: "Setahun penuh",
    opt_jpSupport_9: "Tahun kalender 2026 (April sampai Desember)",
    lbl_country: "Negara",
    lbl_usState: "Negara bagian",
    tip_usState: "39 negara bagian dan DC. Sebelas negara bagian tidak tersedia karena aturan penghapusan bertahap potongannya belum dimuat di sini.",
    lbl_usNyc: "Tinggal di New York City",
    tip_usNyc: "New York City juga memajaki penduduknya, selain pajak negara bagian, dengan tarif 3,078% sampai 3,876%.",
    lbl_caProv: "Provinsi",
    lbl_ukRegion: "Tempat tinggal",
    tip_ukRegion: "Skotlandia punya lapisan tarif pajak penghasilan sendiri. National Insurance sama di seluruh Britania Raya.",
    lbl_dir: "Hitung dari",
    lbl_auRes: "Status penduduk",
    lbl_sgRes: "Status penduduk",
    lbl_sgAge: "Usia",
    tip_sgAge: "Tarif iuran CPF karyawan turun seiring usia, dari 20% untuk usia 55 tahun atau kurang sampai 5% di atas 70 tahun.",
    lbl_usRes: "Status pajak",
    lbl_deClass: "Kelas pajak",
    lbl_idRes: "Status penduduk",
    lbl_myRes: "Status penduduk",
    lbl_nlRuling: "30% ruling",
    tip_nlRuling: "Untuk karyawan yang direkrut dari luar negeri dan sebelumnya tinggal lebih dari 150 km dari perbatasan Belanda. Sampai 30% gaji bebas pajak di atas salary norm, 27% mulai 2027.",
    lbl_noRes: "Skema",
    lbl_noNi: "Peserta asuransi nasional Norwegia",
    tip_noNi: "Tarif PAYE 25% untuk peserta dan 17,4% untuk yang bukan peserta.",
    lbl_seRes: "Status penduduk",
    lbl_fiRes: "Skema",
    lbl_beExpat: "Rezim ekspatriat",
    tip_beExpat: "Untuk karyawan yang direkrut atau ditugaskan dari luar negeri bergaji di atas 70.000 setahun: sampai 35% gaji kotor dibayar sebagai penggantian bebas pajak dan bebas iuran.",
    lbl_itImp: "Rezim",
    lbl_frCadre: "Kontrak",
    lbl_frImp: "Rezim impatriat, forfait 30%",
    tip_frImp: "Untuk karyawan yang direkrut dari luar negeri dan tidak menjadi penduduk pajak Prancis dalam 5 tahun terakhir: 30% gaji dibebaskan dari pajak penghasilan sampai 8 tahun.",
    lbl_esRegime: "Rezim",
    lbl_ptRegime: "Rezim",
    lbl_ptJovemYear: "Tahun kerja ke-",
    tip_ptJovemYear: "Bagian yang dibebaskan: 100% di tahun ke-1, 75% di tahun ke-2 sampai ke-4, 50% di tahun ke-5 sampai ke-7, 25% di tahun ke-8 sampai ke-10, maksimal 29.542,15.",
    lbl_jpRes: "Status penduduk",
    lbl_krMethod: "Cara hitung pajak",
    lbl_cnRes: "Status",
    lbl_twRes: "Status penduduk",
    lbl_twGold: "Gold Card",
    tip_twGold: "Pemegang Gold Card tidak dipajaki atas 50% gaji di atas 3.000.000 selama 5 tahun.",
    lbl_twEi: "Asuransi ketenagakerjaan",
    lbl_gulfNat: "Kewarganegaraan",
    lbl_saScheme: "Skema GOSI",
    lbl_usFiling: "Status pelaporan",
    lbl_deKids: "Punya anak",
    tip_deKids: "Tanpa anak, iuran perawatan jangka panjang lebih tinggi 0,6 poin persentase.",
    lbl_idMarried: "Menikah",
    lbl_idDeps: "Tanggungan",
    tip_idDeps: "Setiap tanggungan menambah PTKP sebesar 4.500.000, maksimal tiga orang.",
    lbl_thSpouse: "Pasangan tanpa penghasilan",
    lbl_thKids: "Anak lahir sebelum 2018",
    lbl_thKidsNew: "Anak lahir 2018 atau sesudahnya",
    tip_thKidsNew: "Mulai anak kedua, anak yang lahir 2018 atau sesudahnya memberi potongan 60.000, bukan 30.000.",
    lbl_mySpouse: "Pasangan tanpa penghasilan",
    lbl_myKids: "Anak",
    lbl_beStatus: "Rumah tangga",
    tip_beStatus: "Pencari nafkah tunggal boleh memindahkan sampai 30% penghasilan (maksimal 11.780) ke pasangannya, yang dipajaki atas bagian itu dengan bagian bebas pajaknya sendiri.",
    lbl_beKids: "Anak tanggungan",
    lbl_beSingleParent: "Orang tua tunggal",
    tip_beSingleParent: "Orang tua tunggal dengan anak tanggungan mendapat tambahan 1.980 pada bagian bebas pajaknya.",
    lbl_chStatus: "Rumah tangga",
    lbl_chKids: "Anak",
    lbl_frMarried: "Menikah atau PACS",
    tip_frMarried: "Pasangan dipajaki bersama dengan dua part, satuan pembagi penghasilan di Prancis. Setiap anak menambah setengah part, dan anak ketiga satu part penuh.",
    lbl_frKids: "Anak",
    lbl_esKids: "Anak",
    lbl_ptDepOld: "Tanggungan usia 7 tahun ke atas",
    lbl_ptDepMid: "Tanggungan usia 4 sampai 6 tahun",
    lbl_ptDepYoung: "Tanggungan usia 3 tahun ke bawah",
    tip_ptDepYoung: "Pajak berkurang 600 untuk setiap tanggungan, 726 untuk tanggungan pertama berusia 3 tahun ke bawah, dan 900 untuk tanggungan kedua dan seterusnya berusia 6 tahun ke bawah.",
    lbl_caKids: "Anak usia 18 tahun ke bawah",
    tip_caKids: "Setiap anak menambah 554 pada Ontario Tax Reduction.",
    lbl_hkMarried: "Menikah, pasangan tanpa penghasilan",
    lbl_hkKids: "Anak",
    lbl_twStatus: "Rumah tangga",
    lbl_twKids: "Anak di bawah umur",
    lbl_krDeps: "Tanggungan",
    tip_krDeps: "Setiap tanggungan menambah potongan dasar 1.500.000.",
    lbl_auCover: "Asuransi rumah sakit swasta",
    tip_auCover: "Tanpa asuransi ini, Medicare levy surcharge 1% sampai 1,5% berlaku untuk penghasilan di atas 105.000.",
    lbl_auSuper: "Jumlah sudah termasuk super",
    tip_auSuper: "<ul><li><strong>Aktif:</strong> jumlah yang kamu isi adalah paket gaji yang sudah memuat super guarantee 12%.</li><li><strong>Mati:</strong> super dibayar pemberi kerja di luar gaji.</li></ul>",
    lbl_ukLoan: "Pinjaman mahasiswa",
    tip_ukLoan: "9% dari gaji di atas ambang tiap plan: 26.900, 29.385, 33.795 atau 25.000.",
    lbl_ukPg: "Pinjaman pascasarjana",
    tip_ukPg: "6% dari gaji di atas 21.000, di luar cicilan plan mana pun.",
    lbl_deChurch: "Pajak gereja",
    tip_deChurch: "Anggota gereja membayar sebagian dari pajak penghasilannya: 8% di Bavaria dan Baden-Württemberg, 9% di negara bagian lain.",
    lbl_deAddOn: "Iuran tambahan asuransi kesehatan",
    tip_deAddOn: "Setiap dana kesehatan menetapkan iuran tambahannya sendiri, dengan rata-rata 2,9% pada 2026. Kamu menanggung separuhnya.",
    lbl_usLocal: "Pajak penghasilan lokal atau county",
    tip_usLocal: "Beberapa kota dan county juga memajaki gaji (county di Maryland, Philadelphia, Detroit). Isi tarifnya atas gaji kotor.",
    lbl_usNyDbl: "Pemberi kerja memotong iuran disabilitas NY (DBL)",
    tip_usNyDbl: "0,5% dari gaji, maksimal 0,60 seminggu. Pemberi kerja boleh memotongnya dari gaji atau menanggung seluruhnya.",
    lbl_usFicaExempt: "Bebas Social Security dan Medicare",
    tip_usFicaExempt: "Pemegang visa F, J, M, dan Q (pelajar dan peneliti) biasanya dibebaskan.",
    lbl_idJkk: "Tarif JKK (kecelakaan kerja)",
    tip_idJkk: "Premi JKK, JKM, dan BPJS Kesehatan yang dibayar pemberi kerja ikut dihitung sebagai penghasilan kena pajak. Tarif JKK bergantung pada bidang usaha pemberi kerja.",
    lbl_idBpjs: "Bayar BPJS seperti penduduk pajak",
    lbl_myLindung: "Klaim LINDUNG sebagai pengurang SOCSO",
    tip_myLindung: "Belum pasti apakah ekspatriat boleh mengklaimnya, jadi pilihan ini mati sejak awal. Pengaruhnya pada pajak paling banyak RM31.50.",
    lbl_nlNorm: "Salary norm",
    tip_nlNorm: "Ruling ini tidak boleh membuat gaji turun di bawah salary norm, jadi bagian bebas pajaknya adalah gaji dikurangi norm itu bila hasilnya lebih kecil.",
    lbl_nlHoliday: "Uang liburan dibayar di atas gaji",
    tip_nlHoliday: "Gaji di Belanda ditambah uang liburan 8%, biasanya dibayar pada bulan Mei. Kalau aktif, jumlah yang kamu isi belum termasuk uang liburan dan 8% ditambahkan.",
    lbl_nlPension: "Iuran pensiun, bagianmu",
    tip_nlPension: "Dipotong sebelum pajak. Diisi sebagai persentase gaji kotor; skema yang hanya menghitung iuran di atas bagian gaji yang dikecualikan (franchise) memotong lebih sedikit.",
    lbl_seMun: "Tarif pajak kota",
    tip_seMun: "Stockholm 30,55%; rata-rata nasional 32,38%.",
    lbl_seBurial: "Biaya penguburan",
    tip_seBurial: "Rata-rata nasional 0,292%. Anggota Gereja Swedia membayar iuran gereja sebagai gantinya.",
    lbl_eeP2: "Pilar pensiun kedua",
    lbl_eePension: "Sudah usia pensiun",
    tip_eePension: "Penghasilan bebas pajak menjadi 776 sebulan, bukan 700.",
    lbl_fiMun: "Tarif pajak kota",
    tip_fiMun: "Helsinki 5,30%.",
    lbl_fiChurch: "Tarif pajak gereja",
    tip_fiChurch: "Untuk anggota gereja: 1,00% di Helsinki untuk gereja Lutheran.",
    lbl_beMun: "Pajak tambahan kota",
    tip_beMun: "Dihitung dari pajak federal. Kebanyakan kota menetapkan 6% sampai 8%.",
    lbl_chChurch: "Anggota gereja",
    tip_chChurch: "Pajak gereja sekitar 10% dari pajak dasar kanton di Kota Zürich.",
    lbl_chAge: "Usia (tarif pensiun)",
    tip_chAge: "Kredit usia BVG dihitung atas gaji terkoordinasi, dan kamu menanggung separuhnya.",
    lbl_chNbu: "Asuransi kecelakaan (NBU)",
    tip_chNbu: "Asuransi kecelakaan di luar pekerjaan; tarifnya bergantung pada perusahaan asuransinya.",
    lbl_chCommune: "Pengali pajak kota",
    tip_chCommune: "Persentase dari pajak dasar kanton. Kota Zürich 119%.",
    lbl_frMutuelle: "Asuransi kesehatan perusahaan, bagianmu",
    tip_frMutuelle: "Asuransi kesehatan dan perlindungan wajib dari perusahaan. Bagianmu dipotong dari gaji dan dikurangkan sebelum pajak.",
    lbl_esTemp: "Kontrak sementara",
    tip_esTemp: "Iuran asuransi pengangguran 1,60%, bukan 1,55%.",
    lbl_ptHealth: "Biaya kesehatan",
    tip_ptHealth: "15% mengurangi pajak, maksimal 1.000.",
    lbl_ptEdu: "Biaya pendidikan",
    tip_ptEdu: "30% mengurangi pajak, maksimal 800.",
    lbl_ptRent: "Sewa rumah tinggalmu",
    tip_ptRent: "15% mengurangi pajak, maksimal 900 untuk sewa tahun 2026.",
    lbl_ptColeta: "Pengurang biaya keluarga umum",
    tip_ptColeta: "35% dari belanja sehari-hari yang tercatat di faktur e-Fatura, maksimal 250. Kebanyakan orang mencapai batas itu.",
    lbl_jpCare: "Usia 40 sampai 64",
    tip_jpCare: "Menambah premi perawatan jangka panjang: iuran kesehatan menjadi 11,47%, bukan 9,85%, ditanggung separuh-separuh.",
    lbl_jpSupport: "Iuran dukungan anak",
    tip_jpSupport: "Iuran 0,23% ini mulai berlaku untuk gaji April 2026. Pilih Setahun penuh untuk melihat tahun ketika iuran ini sudah berjalan normal.",
    lbl_cnHf: "Tarif dana perumahan",
    tip_cnHf: "Pemberi kerja menetapkannya antara 5% dan 7%.",
    lbl_cnAllow: "Tunjangan bebas pajak",
    tip_cnAllow: "Tunjangan perumahan, kursus bahasa, dan pendidikan anak dalam setahun.",
    lbl_cnSpecial: "Potongan tambahan khusus",
    tip_cnSpecial: "Anak, perawatan orang tua, sewa rumah atau bunga KPR, dan pendidikan lanjutan.",
    lbl_hkMpf: "Peserta MPF",
    tip_hkMpf: "5% dari gaji, maksimal 1.500 sebulan, dan nol untuk gaji di bawah 7.100 sebulan. Bisa dikurangkan dari penghasilan sampai 18.000.",
    lbl_gulfWagePct: "Porsi gaji yang dikenai iuran",
    tip_gulfWagePct: "Iuran dihitung dari upah yang dikenai iuran (di Arab Saudi, gaji pokok ditambah tunjangan perumahan). Turunkan angka ini kalau tunjangan tidak ikut dihitung.",
    sub_1: "Aturan untuk Kota Zürich. Kanton lain belum dimuat.",
    sub_2: "Aturan untuk Milan, Lombardia. Wilayah lain belum dimuat.",
    sub_3: "Aturan untuk Komunitas Madrid. Wilayah lain belum dimuat.",
    sub_4: "Aturan untuk Tokyo (tarif Kyokai Kenpo Tokyo).",
    sub_5: "Aturan untuk Shanghai.",
    sub_6: "Daratan Portugal. Madeira dan Azores punya tarif sendiri.",
    sub_7: "Warga negara maupun ekspatriat tidak membayar pajak penghasilan atas gaji di sini.",
    sub_8: "Semua pekerja di Hong Kong dipajaki dengan aturan yang sama. Atur MPF di tab Detail.",
    sub_9: "Nonresident alien melapor sebagai lajang.",
    sub_10: "Di sini hanya pengurang pajak Ontario yang memakai jumlah anak.",
    grp_where_you_work: "Tempat kerja",
    grp_your_pay: "Gajimu",
    grp_your_status: "Statusmu",
    grp_household: "Rumah tangga",
    grp_details: "Detail",
    unitYr: "/thn",
    title: "Kalkulator Gaji Bersih dan Pajak Penghasilan",
    qsLabel: "Quick Start",
    qsTip: "Mengganti semua pekerjaan dengan satu contoh perbandingan. Setelah itu, ubah angka mana pun sesukamu.",
    qs_asia: "Kota bisnis Asia",
    qsTip_asia: "Empat tawaran untuk ekspatriat: S$180,000 di Singapura, HK$1,300,000 di Hong Kong (Tiongkok), ¥15 juta di Tokyo, dan AED 600.000 di Dubai, dibandingkan dalam dolar AS.",
    qs_europe: "Insinyur di Eropa",
    qsTip_europe: "Satu insinyur senior di empat kota: £95.000 di London, €95.000 di Amsterdam dengan 30% ruling, €95.000 di Berlin, dan CHF 140.000 di Zürich.",
    qs_us: "Negara bagian AS",
    qsTip_us: "US$150,000, lajang, di Texas, California, New York City, dan Illinois. Pajak federalnya sama, pajak negara bagian dan kotanya berbeda.",
    qs_net: "Gaji bersih sama, Eropa Selatan",
    qsTip_net: "Gaji kotor yang menyisakan €4.000 sebulan di Paris, Madrid, Lisbon, dan Milan untuk penduduk pajak lajang.",
    qs_family: "Keluarga empat orang",
    qsTip_family: "Satu pencari nafkah bergaji €80.000, pasangan di rumah, dan dua anak, di Belgia, Prancis, Jerman, dan Belanda.",
    jobsLabel: "Pekerjaan",
    addJob: "+ Tambah pekerjaan",
    addJobTitle: "Tambah pekerjaan, dimulai dari salinan pekerjaan ini",
    tab_salary: "Gaji",
    tab_household: "Rumah tangga",
    tab_details: "Detail",
    periodAria: "Periode gaji",
    dispCurLabel: "Tampilkan dalam",
    dispCurAria: "Mata uang untuk menampilkan angka",
    dispPerLabel: "Per",
    dispPerAria: "Tampilkan angka per tahun atau per bulan",
    chartTitlePct: "Porsi gaji bersih di sepanjang rentang gaji",
    chartTitleAmt: "Gaji bersih di sepanjang rentang gaji",
    chartMeasureAria: "Tampilkan gaji bersih sebagai",
    svgTitle: "Unduh grafik ini sebagai SVG",
    pngTitle: "Unduh grafik ini sebagai PNG",
    copyTitle: "Salin PNG ke clipboard",
    resetZoomTitle: "Kembalikan zoom",
    hoverHint: "Arahkan kursor ke grafik untuk membaca gaji bersih tiap pekerjaan pada gaji kotor itu.",
    compareTitle: "Ke mana gajimu pergi",
    csvTitle: "Unduh tabel ini sebagai CSV",
    linesTitle: "Rincian gaji bersih",
    linesJobLabel: "Pekerjaan",
    linesJobTitle: "Pilih pekerjaan yang ingin dirinci",
    linesCsvTitle: "Unduh rincian semua pekerjaan sebagai CSV",
    assumesTitle: "Asumsi yang dipakai",
    countriesTitle: "Pajak penghasilan per negara",
    countriesSub: "Satu halaman untuk tiap negara: aturan pajaknya beserta sumber, contoh perhitungan, dan tips pajak.",
    mapLinkHtml: "<em>Tool</em> ini menghitung gaji bersihmu setelah pajak. Ingin tahu berapa yang benar-benar bisa kamu tabung setelah biaya hidup ikut dihitung? Coba <a href=\"https://tool.adjiebrotots.com/costofliving-comparator/\" style=\"color:var(--accent-strong);font-weight:700;text-decoration:none;\"><em>tool</em> Cost of Living Comparator</a>.",
    opt_dispCur_local: "Mata uang tiap pekerjaan",
    opt_dispCur_USD: "Dolar AS (USD)",
    opt_dispCur_EUR: "Euro (EUR)",
    opt_dispCur_GBP: "Pound sterling (GBP)",
    opt_dispCur_AUD: "Dolar Australia (AUD)",
    opt_dispCur_SGD: "Dolar Singapura (SGD)",
    opt_dispCur_IDR: "Rupiah (IDR)",
    opt_dispCur_JPY: "Yen Jepang (JPY)",
    opt_dispCur_CHF: "Franc Swiss (CHF)",
    opt_dispCur_CAD: "Dolar Kanada (CAD)",
    opt_dispCur_HKD: "Dolar Hong Kong (HKD)",
    opt_dispCur_AED: "Dirham UEA (AED)",
    opt_dispCur_CNY: "Yuan Tiongkok (CNY)",
    opt_dispCur_KRW: "Won Korea (KRW)",
    opt_dispCur_MYR: "Ringgit Malaysia (MYR)",
    opt_dispCur_THB: "Baht Thailand (THB)",
    opt_dispCur_TWD: "Dolar Taiwan Baru (TWD)",
    opt_dispCur_SEK: "Krona Swedia (SEK)",
    opt_dispCur_NOK: "Krone Norwegia (NOK)",
    opt_dispCur_SAR: "Riyal Arab Saudi (SAR)",
    opt_dispCur_QAR: "Riyal Qatar (QAR)",
    opt_dispCur_BHD: "Dinar Bahrain (BHD)",
    opt_dispCur_KWD: "Dinar Kuwait (KWD)",
    opt_dispCur_OMR: "Rial Oman (OMR)",
    opt_dispPer_year: "Tahun",
    opt_dispPer_month: "Bulan",
    opt_chartMeasure_pct: "% dari gaji kotor",
    opt_chartMeasure_amount: "Jumlah",
    // Drawn by this script.
    perYear: "setahun",
    perMonth: "sebulan",
    emptyHousehold: "Tidak ada isian rumah tangga yang memengaruhi hasil di {name}.",
    emptyDetails: "Tidak ada lagi yang perlu diatur untuk {name}.",
    amountTipNet: "Uang yang masuk ke rekeningmu setelah dipotong pajak penghasilan dan iuran karyawan. Gaji kotor yang menghasilkannya dihitung balik.",
    amountTipGross: "Sebelum dipotong pajak penghasilan dan iuran karyawan. Iuran yang dibayar pemberi kerja di luar gaji tidak termasuk.",
    placeUS: "{state}, AS",
    placeCA: "{prov}, Kanada",
    placeSco: "Skotlandia, Inggris",
    nyc: "New York City",
    chipTitle: "Tampilkan pekerjaan {n} di formulir",
    chipMo: "/bln",
    chipYr: "/thn",
    chipNet: " bersih",
    notLoaded: "belum dimuat",
    removeJob: "Hapus pekerjaan {n}",
    vNotLoaded: "Aturan ini belum dimuat.",
    vNsLine: "Pekerjaan {n} ({name}) belum bisa dihitung: {reason}",
    vSolved: "Untuk membawa pulang {target} {per} di {name}, kamu perlu gaji kotor {gross}.",
    vNet: "Gaji bersih di {name} adalah {net} {per}, {pct} dari gaji kotor.",
    vBody: "Pajak penghasilan memotong {tax} dan iuran karyawan {soc}.",
    vMarg: "Dari setiap tambahan 1% gaji, {m} habis untuk pajak dan iuran.",
    jobName: "Pekerjaan {n} ({place})",
    vAllNet: "Gaji kotor paling kecil untuk gaji bersih yang sama ada di {name}: {g} {per}.",
    vTie: "{a} dan {b} menyisakan gaji bersih yang sama.",
    vBest: "{a} menyisakan gaji bersih paling besar: {v} {per}, {gap} lebih banyak daripada {b}.",
    vShares: "Porsi gaji bersih dari gaji kotor: {list}.",
    vUsd: "Dibandingkan dalam dolar AS dengan kurs {date}.",
    mTake: "Gaji bersih",
    mTarget: ", sesuai target yang kamu isi",
    mGross: "Gaji kotor",
    mSolved: "Dihitung balik dari gaji bersihmu",
    mTax: "Pajak penghasilan",
    mTaxSub: "{pct} dari gaji kotor, semua tingkat pemerintahan",
    mMarg: "Tarif marginal",
    mMargTip: "Bagian dari tambahan 1% gaji yang habis untuk pajak dan iuran.",
    mContrib: "Iuran {x}",
    mNotLoaded: "Belum dimuat",
    mGrossFor: "Gaji kotor {g} untuk gaji bersih ini",
    mFrom: "Dari gaji kotor {g}",
    mTaxContrib: "Pajak {p}, iuran {q}",
    chartLib: "Pustaka grafik gagal dimuat, jadi grafik tidak bisa ditampilkan. Semua angka di halaman ini tetap benar.",
    chartSub: "Satu sumbu gaji kotor untuk tiap mata uang ({curs}), disejajarkan dengan kurs {date}.",
    takenHomePct: "% dibawa pulang",
    takenHome: " dibawa pulang",
    axGrossYear: "Gaji kotor setahun",
    axGrossCur: "Gaji kotor ({c} setahun)",
    tipGross: "Gaji kotor {g} setahun",
    asEntered: " (sesuai isian)",
    axTakeCur: "Gaji bersih ({c} setahun)",
    axTakePct: "Gaji bersih (% dari gaji kotor)",
    rowGross: "Gaji kotor",
    rowTax: "Pajak penghasilan, semua tingkat pemerintahan",
    rowSocial: "Iuran karyawan",
    rowOther: "Potongan gaji lainnya",
    rowNet: "Gaji bersih",
    rowShare: "Porsi gaji bersih dari gaji kotor",
    rowMarg: "Tarif marginal, tambahan 1% gaji",
    thItem: "Pos",
    ownCur: "mata uang masing-masing",
    stOfficial: "Resmi",
    stOfficialW: "dikonfirmasi di laman pemerintah.",
    stSecondary: "Sekunder",
    stSecondaryW: "kantor akuntan Big Four, firma hukum, atau penyedia layanan penggajian yang mengutip aturannya.",
    stAssumption: "Asumsi",
    stAssumptionW: "pilihan pemodelan, disebutkan agar bisa kamu timbang sendiri.",
    fromDate: "Berlaku mulai {f}.",
    fromThresholds: "Memakai ambang batas {f}.",
    fromRules: "Aturan {f}.",
    srcLabel: "Sumber: {name}.",
    opensSource: " Membuka sumbernya.",
    rising: " naik ke ",
    band: "{lo} sampai {hi}, tarif {rate}",
    secTaxable: "Penghasilan kena pajak",
    secTake: "Gaji bersih",
    secNotIn: "Tidak termasuk gaji bersih",
    deductibleContrib: "Iuran yang boleh dikurangkan",
    unusedDed: "Potongan yang melebihi gaji, tidak terpakai",
    ofWhich: "di antaranya {x}",
    gTax: "Pajak penghasilan",
    gSocial: "Iuran jaminan sosial",
    gOther: "Potongan gaji lainnya",
    gBenefit: "Uang tunai bebas pajak",
    takeYear: "Gaji bersih, setahun",
    takeMonth: "Gaji bersih, sebulan",
    amountsIn: "angka dalam {cur} setahun",
    plusMinus: "Tambah atau kurang",
    thLine: "Baris",
    thAmount: "Jumlah",
    curYear: "{cur} setahun",
    thStatus: "Status",
    aRules: "aturan {year}",
    aFor: " untuk {place}",
    aSolved: " Gaji kotor dihitung balik agar gaji bersihnya mencapai {x} setahun.",
    aNotWorked: " Belum bisa dihitung: {reason}",
    aChoice: "{label} adalah pilihan pemodelan yang disebutkan terang-terangan.",
    aFx: "<strong>Kurs</strong> yang dipakai adalah kurs {date} ({src}{bundled}), hanya untuk memudahkan membaca: semua hitungan dikerjakan dalam mata uang tiap pekerjaan.",
    aBundled: ", yang disertakan di halaman ini",
    aIncome: "<strong>Hanya penghasilan dari pekerjaan.</strong> Tanpa bonus, saham, natura, penghasilan lain, perjanjian pajak, atau kredit pajak luar negeri.",
    aYear: "<strong>Satu tahun penuh</strong> di satu pekerjaan. Kalau aturan berubah di tengah tahun (batas baru mulai 1 Juli, tarif baru mulai 1 Juni), setiap bulan dihitung lalu dijumlahkan.",
    csvHead: "Kalkulator Gaji Bersih dan Pajak Penghasilan, tool.adjiebrotots.com/global-income-tax-calculator/id",
    csvAmounts: "Angka {per}, {cur}",
    csvEachCur: "tiap pekerjaan dalam mata uangnya sendiri",
    roleAdded: "ditambahkan",
    roleTaken: "dikurangkan",
    roleResult: "hasil",
    roleStart: "awal",
    rolePart: "bagian dari baris di atasnya",
    roleBand: "per lapisan tarif, membentuk baris pajak di atasnya",
    roleAside: "sebagai rujukan, sudah dihitung",
    roleRef: "sebagai rujukan",
    csvJob: "Pekerjaan",
    csvCountry: "Negara",
    csvSection: "Bagian",
    csvRole: "Peran",
    csvLine: "Baris",
    csvAmountYear: "Jumlah setahun",
    csvCurrency: "Mata uang",
    csvStatus: "Status",
    csvSource: "Sumber",
    csvSourceUrl: "URL sumber",
    csvFrom: "Berlaku mulai",
    csvNotWorked: "Belum bisa dihitung: {reason}",
    subNotLoaded: "{job}: belum dimuat",
    madeUsing: "Dibuat dengan tool.adjiebrotots.com/global-income-tax-calculator/id",
    searchCountry: "Cari negara…",
    searchState: "Cari negara bagian…",
    searchProv: "Cari provinsi…",
    colTitle: "Dibuka dari Cost of Living Comparator",
    colOn: " untuk {place}, per bulan. ",
    colNet: "Gaji kotor yang tampil adalah gaji yang menyisakan penghasilan bersih yang dibutuhkan.",
    colGross: "Isi gaji kotornya untuk melihat gaji bersih.",
    colSet: " Sesuaikan status penduduk dan rumah tangga di panel kiri dengan keadaanmu.",
    dismiss: "Tutup",
    agentJobs: "{n} pekerjaan: {list}",
    agentJob: "{n} pekerjaan: {list}",
    agentJobsLabel: "Pekerjaan"
  }
};
const lang = window.DEFAULT_LANG === 'id' ? 'id' : 'en';
const ID = lang === 'id';
function T(key){ const v = LANG[lang][key]; return v == null ? LANG.en[key] : v; }
// A string with {name} slots filled from vars, as given (the caller escapes what it needs to).
function TF(key, vars){ return T(key).replace(/\{(\w+)\}/g, (m, k) => vars && vars[k] != null ? vars[k] : m); }
// The engine's text for country cc, in the page's language.
function trE(text, cc){
  if(!ID || text == null || text === '' || !window.GSCLabelsId) return text;
  const t = window.GSCLabelsId.tr(text, cc);
  // The engine writes its figures in the English form (5,101.20); the page shows them in its own.
  return SharedNum.text(t == null ? text : t);
}
// Country names as the reader says them (the country pages' names on the Indonesian page).
const COUNTRY_ID = { AU: 'Australia', SG: 'Singapura', GB: 'Inggris', DE: 'Jerman', US: 'Amerika Serikat', CA: 'Kanada', FR: 'Prancis', NL: 'Belanda', BE: 'Belgia',
  CH: 'Swiss', IT: 'Italia', ES: 'Spanyol', PT: 'Portugal', NO: 'Norwegia', SE: 'Swedia', FI: 'Finlandia', EE: 'Estonia', JP: 'Jepang', KR: 'Korea Selatan',
  CN: 'Tiongkok', TW: 'Taiwan (Tiongkok)', HK: 'Hong Kong (Tiongkok)', ID: 'Indonesia', MY: 'Malaysia', TH: 'Thailand', AE: 'Uni Emirat Arab', SA: 'Arab Saudi',
  QA: 'Qatar', BH: 'Bahrain', KW: 'Kuwait', OM: 'Oman' };
const cName = cc => ID ? (COUNTRY_ID[cc] || E.C[cc].name) : E.C[cc].name;
// A date the engine writes ("10 Nov 2026", "Apr 2026") with the month as Indonesian abbreviates it.
const MON_ID = { May: 'Mei', Aug: 'Agu', Oct: 'Okt', Dec: 'Des' };
const dateW = d => ID ? String(d).replace(/\b(May|Aug|Oct|Dec)\b/g, m => MON_ID[m]) : d;
// Short amounts use the page's own magnitude words: in Indonesian "M" is miliar (a billion), a million is "jt".
const MAG = { en: { b: 'b', m: 'm', k: 'k' }, id: { b: ' M', m: ' jt', k: ' rb' } }[lang];
// A figure written as JavaScript writes it, in the page's own form (1,234.5 or 1.234,5).
const loc = x => SharedNum.show(String(x));

// Words the page shows, in its language. Not on the English page, which shows index.html as written.
function applyLang(){
  if(!ID) return;
  const L = LANG.id;
  document.querySelectorAll('[data-i18n]').forEach(el => { const v = L[el.dataset.i18n]; if(v != null) el.textContent = v; });
  document.querySelectorAll('[data-i18n-opt]').forEach(el => { const v = L[el.dataset.i18nOpt]; if(v != null) el.textContent = v; });
  document.querySelectorAll('[data-i18n-otip]').forEach(el => { const v = L[el.dataset.i18nOtip]; if(v != null) el.setAttribute('data-opt-tip', v); });
  document.querySelectorAll('[data-i18n-tip]').forEach(el => { const v = L[el.dataset.i18nTip]; if(v != null) el.setAttribute('data-tip', v); });
  // The note under the header carries a link, so it is written whole.
  if($('mapLinkDiv')) $('mapLinkDiv').innerHTML = L.mapLinkHtml;
  document.querySelectorAll('[data-i18n-label]').forEach(el => { const v = L[el.dataset.i18nLabel]; if(v != null) el.setAttribute('label', v); });
  // An icon-only control is named by its title and its aria-label alike.
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const v = L[el.dataset.i18nTitle];
    if(v == null) return;
    if(el.hasAttribute('title')) el.setAttribute('title', v);
    if(el.hasAttribute('aria-label')) el.setAttribute('aria-label', v);
  });
}

/* ───────────────────────── Money ───────────────────────── */
const SYM = { USD: 'US$' };
Object.values(E.C).forEach(c => { if(!SYM[c.cur]) SYM[c.cur] = c.cur === 'EUR' ? '€' : c.sym; });
SYM.NOK = 'NOK '; SYM.SEK = 'SEK '; SYM.CHF = 'CHF '; SYM.AED = 'AED '; SYM.SAR = 'SAR '; SYM.QAR = 'QAR '; SYM.BHD = 'BHD '; SYM.KWD = 'KWD '; SYM.OMR = 'OMR ';
const symOf = cur => SYM[cur] || (cur + ' ');
function money(v, cur, compact){
  const n = Number(v), abs = Math.abs(n), sign = n < 0 ? '−' : '';
  if(!isFinite(n)) return '—';
  const s = symOf(cur);
  if(compact && abs >= 1e9) return sign + s + loc((abs/1e9).toFixed(abs >= 1e10 ? 0 : 1)) + MAG.b;
  if(compact && abs >= 1e6) return sign + s + loc((abs/1e6).toFixed(abs >= 1e7 ? 0 : 1)) + MAG.m;
  if(compact && abs >= 1e4) return sign + s + loc((abs/1e3).toFixed(0)) + MAG.k;
  return sign + s + loc(Math.round(abs).toLocaleString('en'));
}
const pct = (v, d = 1) => isFinite(v) ? loc((v*100).toFixed(d)) + '%' : '—';

/* ───────────────────────── Job fields ───────────────────────── */
const scope = $('jobScope');
let FIELDS = [];                 // every control inside the job scope
const DEFAULTS = {};             // their values as the page ships them
const handle = el => el.getAttribute('data-persist') || el.id;
// A job keeps its figures in the English form on both pages: SharedNum.read / write cross from and to the field.
const valueOf = el => el.type === 'checkbox' ? !!el.checked : SharedNum.read(el);
function setValue(el, v){
  if(el.type === 'checkbox') el.checked = v === true || v === 'true' || v === 1 || v === '1' || v === 'on';
  else SharedNum.write(el, String(v));
}
// Every field is kept, the other countries' too, so a job that goes to Germany
// and back still has its Australian settings, and a reload gives back exactly what was saved.
function readJob(){
  const job = {};
  FIELDS.forEach(el => { job[handle(el)] = valueOf(el); });
  return job;
}
function writeJob(job){
  FIELDS.forEach(el => setValue(el, DEFAULTS[handle(el)]));
  // Country first: a select only takes a value its options hold, and the rest follow it.
  if(job && E.C[job.country]) $('country').value = job.country;
  FIELDS.forEach(el => {
    const h = handle(el);
    if(!job || !Object.prototype.hasOwnProperty.call(job, h) || h === 'country') return;
    const v = job[h];
    if(el.tagName === 'SELECT' && ![...el.options].some(o => o.value === String(v))) return;   // gone: keep the default
    setValue(el, v);
  });
  refreshFormats();
  refreshCombos();
}
// The searchable pickers (country, state, province) show their select's value; a value set by code needs a refresh.
const COMBOS = ['country', 'usState', 'caProv'];
// A picker left open with a half-typed search (the reader clicked a Quick Start instead) closes on the new value.
function refreshCombos(){
  COMBOS.forEach(id => {
    const s = $(id), c = s && s._combo;
    if(!c) return;
    if(document.activeElement !== c.input) c.close(); else c.refresh();
  });
}
// A job as the engine reads it.
function knobsOf(job){
  const k = {};
  Object.entries(job).forEach(([h, v]) => {
    const el = FIELDS.find(f => handle(f) === h);
    if(el && (el.classList.contains('fmt-num') || el.classList.contains('fmt-pct'))) k[h] = SharedNum.parse(v) || 0;
    else k[h] = v;
  });
  return k;
}
function refreshFormats(){
  scope.querySelectorAll('.fmt-num, .fmt-pct').forEach(el => {
    const n = SharedFmt.parseFormatted(el.value);
    if(el.value !== '' && isFinite(n)) el.value = SharedFmt.formatThousands(String(n), { maxDecimals: el.classList.contains('fmt-pct') ? 3 : 2 });
  });
}

/* ───────────────────────── Visibility ───────────────────────── */
// data-show="AU SG" names the countries a row belongs to; data-if="key=a|b key!=c" adds field conditions.
function fieldVal(id){
  const el = $(id);
  if(!el) return '';
  return el.type === 'checkbox' ? (el.checked ? 'on' : 'off') : el.value;
}
function condHolds(expr){
  return expr.split(/\s+/).filter(Boolean).every(t => {
    const m = /^([A-Za-z0-9]+)(!?=)(.*)$/.exec(t);
    if(!m) return true;
    const hit = m[3].split('|').includes(fieldVal(m[1]));
    return m[2] === '=' ? hit : !hit;
  });
}
function applyVisibility(){
  const country = $('country').value;
  scope.querySelectorAll('[data-show], [data-if]').forEach(el => {
    const show = el.getAttribute('data-show'), cond = el.getAttribute('data-if');
    let on = true;
    if(show) on = show.split(/\s+/).includes(country);
    if(on && cond) on = condHolds(cond);
    el.toggleAttribute('data-hidden', !on);
  });
  scope.querySelectorAll('.field-group').forEach(g => {
    // A group shows while any of its own rows does (its own hidden mark is not a row's).
    const rows = g.querySelectorAll('.field-row, .toggle-row, .field-sub');
    g.toggleAttribute('data-hidden', ![...rows].some(r => !r.hasAttribute('data-hidden')));
  });
  const name = cName(country);
  [['tab-household', 'emptyHousehold', TF('emptyHousehold', { name })],
   ['tab-details', 'emptyDetails', TF('emptyDetails', { name })]].forEach(([tab, id, text]) => {
    const any = [...$(tab).querySelectorAll('.field-group')].some(g => !g.hasAttribute('data-hidden'));
    $(id).textContent = any ? '' : text;
  });
  // Money fields wear the job's own currency.
  scope.querySelectorAll('[data-cur-sym]').forEach(p => { p.textContent = E.C[country].sym; });
  fitPrefixes();
  const net = $('dir').value === 'net';
  $('amountLabelText').textContent = T(net ? 'opt_dir_net' : 'opt_dir_gross');
  $('amountTip').setAttribute('data-tip', T(net ? 'amountTipNet' : 'amountTipGross'));
  optionTips();
}
// A tip that explains the selected option (data-tip-options on the row's tip icon) reads that
// option's own data-opt-tip, so it follows the pick; the shared tooltip adds "Change the option…".
function optionTips(){
  scope.querySelectorAll('.tip-icon[data-tip-options]').forEach(icon => {
    const row = icon.closest('.field-row, .toggle-row'), sel = row && row.querySelector('select');
    const o = sel && sel.options[sel.selectedIndex];
    if(o && o.hasAttribute('data-opt-tip')) icon.setAttribute('data-tip', o.getAttribute('data-opt-tip'));
  });
}

// A symbol wider than the shared inset (SAR, CHF, AED) pushes the number along, so the two never touch.
function fitPrefixes(){
  scope.querySelectorAll('.affix-wrap [data-cur-sym]').forEach(p => {
    const input = p.parentNode.querySelector('.affix-input');
    if(!input) return;
    const w = p.getBoundingClientRect().width;
    // Hidden rows measure 0: they are fitted again when they show (applyVisibility runs on every change).
    input.style.paddingLeft = w ? Math.max(32, Math.ceil(p.offsetLeft + w + 7)) + 'px' : '';
  });
}

/* ───────────────────────── Jobs ───────────────────────── */
const DEFAULT_JOBS = () => [ null, { country: 'SG', amount: '120,000', sgRes: 'ep' } ];
let JOBS = [], ACTIVE = 0, persist = null;
function fullJob(partial){
  // A partial job (a Quick Start, an old file) laid over the page's defaults.
  const j = {};
  FIELDS.forEach(el => { j[handle(el)] = DEFAULTS[handle(el)]; });
  Object.assign(j, partial || {});
  if(!E.C[j.country]) j.country = DEFAULTS.country;
  return j;
}
function syncActive(){ JOBS[ACTIVE] = readJob(); }
function compactJob(job){
  const out = { country: job.country };
  Object.keys(job).forEach(h => { if(h !== 'country' && job[h] !== DEFAULTS[h]) out[h] = job[h]; });
  return out;
}
function pickJob(i){
  if(i === ACTIVE || i < 0 || i >= JOBS.length) return;
  syncActive();
  ACTIVE = i;
  linesPick = null;
  writeJob(JOBS[ACTIVE]);
  clearQuickStart();
  if(persist) persist.schedule();
  render();
}
function addJob(){
  if(JOBS.length >= MAX_JOBS) return;
  syncActive();
  JOBS.push(JSON.parse(JSON.stringify(JOBS[ACTIVE])));
  ACTIVE = JOBS.length - 1;
  linesPick = null;
  writeJob(JOBS[ACTIVE]);
  clearQuickStart();
  if(persist) persist.schedule();
  render();
}
function removeJob(i){
  if(JOBS.length <= 1) return;
  syncActive();
  JOBS.splice(i, 1);
  linesPick = null;
  if(i < ACTIVE) ACTIVE--;
  ACTIVE = Math.min(ACTIVE, JOBS.length - 1);
  writeJob(JOBS[ACTIVE]);
  clearQuickStart();
  if(persist) persist.schedule();
  render();
}
const colourOf = i => SharedPalette.at(i);
// Where a job is, in words: the state or province where the country has more than one set of rules.
const CA_PROV = { ON: 'Ontario', BC: 'British Columbia', AB: 'Alberta', QC: 'Quebec' };
function jobPlace(job){
  if(job.country === 'US') return TF('placeUS', { state: job.usState === 'NY' && (job.usNyc === true || job.usNyc === 'true') ? T('nyc') : E.US_STATES[job.usState] || cName('US') });
  if(job.country === 'CA') return TF('placeCA', { prov: CA_PROV[job.caProv] || cName('CA') });
  if(job.country === 'GB' && job.ukRegion === 'sco') return T('placeSco');
  return cName(job.country);
}
function jobTitle(job, i){ return (i + 1) + ' · ' + jobPlace(job); }
function renderJobs(results){
  const list = $('jobsList');
  list.innerHTML = '';
  JOBS.forEach((job, i) => {
    const row = document.createElement('div');
    row.className = 'job-row';
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'job-chip' + (i === ACTIVE ? ' active' : '');
    chip.setAttribute('role', 'tab');
    chip.setAttribute('aria-selected', i === ACTIVE ? 'true' : 'false');
    chip.title = TF('chipTitle', { n: i + 1 });
    const r = results[i];
    const amt = SharedNum.parse(job.amount) || 0;
    const pay = money(amt, E.C[job.country].cur, true) + T(job.period === 'monthly' ? 'chipMo' : 'chipYr') + (job.dir === 'net' ? T('chipNet') : '');
    chip.innerHTML = '<span class="job-dot" style="background:' + colourOf(i) + '"></span><span class="job-name">' + esc(jobTitle(job, i)) + '</span>'
      + '<span class="job-pay">' + esc(r && r.notSupported ? T('notLoaded') : pay) + '</span>';
    chip.addEventListener('click', () => pickJob(i));
    row.appendChild(chip);
    if(JOBS.length > 1){
      const wrap = document.createElement('span');
      wrap.innerHTML = SharedIcon.button('trash', TF('removeJob', { n: i + 1 }), 'job-del');
      const del = wrap.firstElementChild;
      del.addEventListener('click', () => removeJob(i));
      row.appendChild(del);
    }
    list.appendChild(row);
  });
  $('addJob').disabled = JOBS.length >= MAX_JOBS;
}

/* ───────────────────────── Compute ───────────────────────── */
function computeJob(job){
  const k = knobsOf(job), country = job.country;
  const amt = Math.max(0, SharedNum.parse(job.amount) || 0);
  const annual = amt*(job.period === 'monthly' ? 12 : 1);
  let r;
  if(job.dir === 'net'){
    const s = E.solveGross(country, annual, k);
    if(s.notSupported) return Object.assign({ country, cur: E.C[country].cur, job }, s);
    r = E.compute(country, s.gross, k);
    if(!r.notSupported){ r.solved = true; r.target = annual; }
  } else r = E.compute(country, annual, k);
  if(r.notSupported) return Object.assign({ country, cur: E.C[country].cur, job }, r);
  r.job = job; r.knobs = k;
  r.marginal = E.marginal(country, r.entered, k, r);
  return r;
}

/* ───────────────────────── Live exchange rates ─────────────────────────
   The same mechanism as the Cost of Living Comparator: a free, keyless,
   CORS-open daily feed read from the browser, the next source on any failure,
   and the rates bundled in engine.js when every source fails. A rate more than
   LIVE_SANITY times off the bundled one is a feed error, so that currency keeps
   the bundled rate. Every sum is still worked out in the job's own currency:
   the rates only restate it (Show amounts in, the chart's axes, the ranking).
   Kept in localStorage and asked for again after LIVE_TTL; the comparator's
   own saved rate counts too, since both pages share the site's storage. */
const FX_BUNDLED = Object.assign({}, E.FX), FX_BUNDLED_DATE = E.FX_DATE;
const FX_SRC = { name: 'open.er-api.com', url: 'https://www.exchangerate-api.com' };
const LIVE_KEY = 'global-income-tax-calculator:live-fx', COL_LIVE_KEY = 'costofliving-comparator:live-fx';
const LIVE_TTL = 6*3600*1000, LIVE_TIMEOUT = 8000, LIVE_SANITY = 5;
const LIVE_SOURCES = [
  { name: 'ExchangeRate-API', home: 'https://www.exchangerate-api.com', url: 'https://open.er-api.com/v6/latest/USD',
    parse: j => {
      if(!j || j.result !== 'success' || !j.rates) throw new Error('bad payload');
      return { date: new Date(j.time_last_update_unix*1000).toISOString().slice(0, 10), rates: j.rates };
    } },
  ...['https://latest.currency-api.pages.dev/v1/currencies/usd.min.json',
      'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json'].map(url => ({
    name: 'Fawaz Ahmed\'s Currency API', home: 'https://github.com/fawazahmed0/exchange-api', url,
    parse: j => {
      if(!j || !j.usd || !j.date) throw new Error('bad payload');
      const rates = {};
      Object.keys(j.usd).forEach(k => { rates[k.toUpperCase()] = j.usd[k]; });
      return { date: j.date, rates };
    } }))
];
const BUNDLED_ISO = '2026-11-10';
const fxDateWords = iso => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
// Only this page's currencies, each within the sanity bound; null when nothing usable is left or it is older than the bundled rates.
function cleanLive(raw, src){
  if(!raw || !raw.rates || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date) || raw.date < BUNDLED_ISO) return null;
  const rates = {};
  Object.keys(FX_BUNDLED).forEach(c => {
    const v = Number(raw.rates[c]), b = FX_BUNDLED[c];
    if(c === 'USD') return;
    if(isFinite(v) && v > 0 && v/b < LIVE_SANITY && b/v < LIVE_SANITY) rates[c] = v;
  });
  return Object.keys(rates).length ? { rates, date: raw.date, source: src.name, url: src.home } : null;
}
let LIVE = null;
function useLive(live){
  LIVE = live;
  Object.keys(FX_BUNDLED).forEach(c => { E.FX[c] = live && live.rates[c] ? live.rates[c] : FX_BUNDLED[c]; });
  E.FX_DATE = live ? fxDateWords(live.date) : FX_BUNDLED_DATE;
  FX_SRC.name = live ? live.source : 'open.er-api.com';
  FX_SRC.url = live ? live.url : 'https://www.exchangerate-api.com';
}
function readLive(key){
  try {
    const raw = JSON.parse(localStorage.getItem(key) || 'null');
    if(!raw || !raw.live || !isFinite(raw.savedAt)) return null;
    const live = cleanLive(raw.live, { name: raw.live.source, home: raw.live.url });
    return live ? { live, savedAt: raw.savedAt } : null;
  } catch(e){ return null; }
}
async function fetchJson(url){
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const t = ctl ? setTimeout(() => ctl.abort(), LIVE_TIMEOUT) : 0;
  try {
    const res = await fetch(url, { cache: 'no-cache', signal: ctl ? ctl.signal : undefined });
    if(!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally { clearTimeout(t); }
}
async function refreshLive(){
  for(const src of LIVE_SOURCES){
    try {
      const live = cleanLive(src.parse(await fetchJson(src.url)), src);
      if(!live) continue;
      if(LIVE && LIVE.date > live.date) return;   // never trade a newer rate for a lagging mirror's
      useLive(live);
      try { localStorage.setItem(LIVE_KEY, JSON.stringify({ savedAt: Date.now(), live })); } catch(e){}
      const a = document.activeElement;
      if(!(a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName))) render();
      return;
    } catch(e){ /* next source */ }
  }
}
// Called once at load: the freshest saved rate straight away (so the page never opens on the
// bundled rate and then jumps), then the feed when that one is old. A guide's demo keeps the bundled rate.
function startLive(){
  if(/[?&]demo(&|$)/.test(location.search)) return;
  const saved = [readLive(LIVE_KEY), readLive(COL_LIVE_KEY)].filter(Boolean).sort((a, b) => b.live.date.localeCompare(a.live.date) || b.savedAt - a.savedAt)[0];
  if(saved) useLive(saved.live);
  if(!saved || Date.now() - saved.savedAt > LIVE_TTL) refreshLive();
}

/* ───────────────────────── Display ───────────────────────── */
const disp = () => ({ cur: $('dispCur').value, per: $('dispPer').value });
const perDiv = () => disp().per === 'month' ? 12 : 1;
const perWord = () => T(disp().per === 'month' ? 'perMonth' : 'perYear');
function shown(v, r){
  const d = disp(), cur = d.cur === 'local' ? r.cur : d.cur;
  return { v: E.convert(v, r.cur, cur)/perDiv(), cur };
}
const showMoney = (v, r, compact) => { const s = shown(v, r); return money(s.v, s.cur, compact); };
// The common currency for comparing jobs: the display pick, else the jobs' own if they share one, else US dollars.
function commonCur(results){
  const d = disp().cur;
  if(d !== 'local') return d;
  const curs = [...new Set(results.map(r => r.cur))];
  return curs.length === 1 ? curs[0] : 'USD';
}

/* ───────────────────────── Verdict ───────────────────────── */
function renderVerdict(results){
  const ok = results.map((r, i) => ({ r, i })).filter(x => !x.r.notSupported);
  if(!ok.length){
    SharedVerdict.set('verdict', { tone: 'warn', title: T('vNotLoaded'), body: esc(trE(results[0].reason, results[0].country)) });
    return;
  }
  const ns = results.map((r, i) => ({ r, i })).filter(x => x.r.notSupported);
  const nsLine = ns.map(x => TF('vNsLine', { n: x.i + 1, name: esc(cName(x.r.country)), reason: esc(trE(x.r.reason, x.r.country)) })).join(' ');
  if(ok.length === 1){
    const { r } = ok[0], name = jobPlace(r.job);
    const net = showMoney(r.net, r), gross = showMoney(r.gross, r);
    const title = r.solved
      ? TF('vSolved', { target: esc(showMoney(r.target, r)), per: perWord(), name: esc(name), gross: '<span class="v-num">' + esc(gross) + '</span>' })
      : TF('vNet', { name: esc(name), net: '<span class="v-num">' + esc(net) + '</span>', per: perWord(), pct: pct(r.net/r.gross) });
    const body = [ TF('vBody', { tax: esc(showMoney(r.incomeTax, r)), soc: esc(showMoney(r.social + r.other, r)) }) ];
    if(r.marginal != null) body.push(TF('vMarg', { m: pct(r.marginal, 0) }));
    if(nsLine) body.push(nsLine);
    SharedVerdict.set('verdict', { tone: '', title, body: body.join(' ') });
    return;
  }
  // Several jobs: rank by take-home in one currency.
  const cc = commonCur(ok.map(x => x.r));
  const inCc = x => E.convert(x.r.net, x.r.cur, cc);
  const ranked = ok.slice().sort((a, b) => inCc(b) - inCc(a));
  const best = ranked[0], second = ranked[1];
  const name = x => TF('jobName', { n: x.i + 1, place: jobPlace(JOBS[x.i]) });
  const gap = inCc(best) - inCc(second);
  const per = perDiv();
  const allNet = ok.every(x => x.r.solved) && new Set(ok.map(x => Math.round(E.convert(x.r.target, x.r.cur, cc)))).size === 1;
  let title, body = [];
  if(allNet){
    const cheapest = ok.slice().sort((a, b) => E.convert(a.r.gross, a.r.cur, cc) - E.convert(b.r.gross, b.r.cur, cc))[0];
    title = TF('vAllNet', { name: esc(name(cheapest)), g: '<span class="v-num">' + esc(money(E.convert(cheapest.r.gross, cheapest.r.cur, cc)/per, cc)) + '</span>', per: perWord() });
  } else if(Math.abs(gap) < 0.5){
    title = TF('vTie', { a: esc(name(best)), b: esc(name(second)) });
  } else {
    title = TF('vBest', { a: esc(name(best)), v: '<span class="v-num">' + esc(money(inCc(best)/per, cc)) + '</span>', per: perWord(), gap: esc(money(gap/per, cc)), b: esc(name(second)) });
  }
  body.push(TF('vShares', { list: ok.map(x => esc(name(x)) + ' ' + pct(x.r.net/x.r.gross)).join(', ') }));
  if(disp().cur === 'local' && new Set(ok.map(x => x.r.cur)).size > 1) body.push(TF('vUsd', { date: dateW(E.FX_DATE) }));
  if(nsLine) body.push(nsLine);
  SharedVerdict.set('verdict', { tone: '', title, body: body.join(' ') });
}

/* ───────────────────────── KPI cards ───────────────────────── */
function metricCard(label, value, sub, dot){
  return '<div class="metric card"><div class="label">' + (dot ? '<span class="job-dot" style="background:' + dot + '"></span>' : '') + label + '</div>'
    + '<div class="value' + (value.length > 14 ? ' small' : '') + '">' + esc(value) + '</div><div class="sub">' + sub + '</div></div>';
}
function renderMetrics(results){
  const el = $('metrics');
  let html = '';
  if(results.length === 1){
    const r = results[0];
    if(r.notSupported){ el.innerHTML = metricCard(T('mTake'), '—', esc(trE(r.reason, r.country))); el.className = 'metrics n2'; return; }
    html += metricCard(T('mTake'),
      showMoney(r.net, r), esc(perWord()) + (r.solved ? T('mTarget') : ''));
    html += metricCard(T('mGross'), showMoney(r.gross, r), r.solved ? T('mSolved') : esc(perWord()));
    html += metricCard(T('mTax'), showMoney(r.incomeTax, r), TF('mTaxSub', { pct: pct(r.incomeTax/r.gross) }));
    html += metricCard('<span class="tip-wrap">' + T('mMarg') + ' <i class="tip-icon" data-tip="' + esc(T('mMargTip')) + '">?</i></span>',
      r.marginal == null ? '—' : pct(r.marginal), TF('mContrib', { x: esc(showMoney(r.social + r.other, r)) }));
    el.className = 'metrics';
  } else {
    results.forEach((r, i) => {
      const job = JOBS[i];
      if(r.notSupported){ html += metricCard(esc(jobTitle(job, i)), T('mNotLoaded'), esc(trE(r.reason, r.country)), colourOf(i)); return; }
      const sub = (r.solved ? TF('mGrossFor', { g: esc(showMoney(r.gross, r)) }) : TF('mFrom', { g: esc(showMoney(r.gross, r)) }))
        + '<br>' + TF('mTaxContrib', { p: pct(r.incomeTax/r.gross), q: pct((r.social + r.other)/r.gross) });
      html += metricCard(esc(jobTitle(job, i)), showMoney(r.net, r), sub, colourOf(i));
    });
    el.className = 'metrics' + (results.length === 2 ? ' n2' : results.length === 3 ? ' n3' : '');
  }
  el.innerHTML = html;
}

/* ───────────────────────── Chart ───────────────────────── */
let chart = null, chartCur = 'USD';
// The currencies the x axis reads in. Jobs in different currencies, each shown in its own,
// get an axis per currency, lined up at the exchange rate so one point across them is one pay;
// a single display currency (Show amounts in) puts them all on one axis.
function axisCurs(ok){
  const curs = [...new Set(ok.map(x => x.r.cur))];
  return disp().cur === 'local' && curs.length > 1 ? curs : [commonCur(ok.map(x => x.r))];
}
// What the chart's y axis reads: the share of gross taken home (pct, as it always has) or the take-home itself (amount).
const chartMeasure = () => ($('chartMeasure') && $('chartMeasure').value === 'amount') ? 'amount' : 'pct';
function sweep(results){
  const amt = chartMeasure() === 'amount';
  const ok = results.map((r, i) => ({ r, i })).filter(x => !x.r.notSupported);
  const curs = axisCurs(ok);
  const cc = curs[0];   // the lines are plotted in the first axis's currency; the others restate it
  chartCur = cc;
  const maxG = Math.max(1, ...ok.map(x => E.convert(x.r.entered, x.r.cur, cc)));
  const xMax = maxG*2.5, N = 60;
  return { cc, curs, xMax, series: ok.map(({ r, i }) => {
    const pts = [];
    for(let s = 1; s <= N; s++){
      const x = xMax*s/N, local = E.convert(x, cc, r.cur);
      const v = E.compute(r.country, local, r.knobs);
      pts.push({ x, y: v.notSupported || !v.gross ? null : amt ? E.convert(v.net, r.cur, cc) : v.net/v.gross*100, net: v.notSupported ? null : v.net });
    }
    const own = { x: E.convert(r.entered, r.cur, cc), y: amt ? E.convert(r.net, r.cur, cc) : r.net/r.gross*100, net: r.net, own: true };
    pts.push(own);
    pts.sort((a, b) => a.x - b.x);
    return { i, r, pts };
  }) };
}
function renderLegend(datasets){
  const el = $('chartLegend');
  el.innerHTML = '';
  datasets.forEach((ds, idx) => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    SharedLegend.attach(item, SharedLegend.specOf(ds), ds.label);
    item.addEventListener('click', () => {
      const hidden = !item.classList.contains('hidden');
      item.classList.toggle('hidden', hidden);
      chart.setDatasetVisibility(idx, !hidden);
      chart.update();
    });
    el.appendChild(item);
  });
}
function updateChart(results){
  if(typeof Chart === 'undefined'){
    $('hoverBox').textContent = T('chartLib');
    return;
  }
  const sw = sweep(results);
  const grid = cssVar('--chart-grid'), muted = cssVar('--chart-text'), text = cssVar('--text');
  const multi = sw.curs.length > 1;
  $('chartSub').hidden = !multi;
  $('chartSub').textContent = multi ? TF('chartSub', { curs: sw.curs.join(', '), date: dateW(E.FX_DATE) }) : '';
  const datasets = sw.series.map(s => {
    const c = colourOf(s.i);
    return {
      label: jobTitle(JOBS[s.i], s.i),
      data: s.pts,
      borderColor: c, backgroundColor: c, borderWidth: 2.2, tension: 0.15, spanGaps: false,
      pointRadius: s.pts.map(p => p.own ? 6 : 0),
      pointHoverRadius: s.pts.map(p => p.own ? 8 : 4),
      pointBackgroundColor: c, pointBorderColor: cssVar('--panel'), pointBorderWidth: 2
    };
  });
  const cc = sw.cc, amt = chartMeasure() === 'amount';
  // A job's take-home at a point: its share of gross, or the amount in its own currency (or the one picked to show).
  const jobCur = i => disp().cur === 'local' ? sw.series[i].r.cur : cc;
  const yText = (it, short) => {
    if(it.parsed.y == null) return T('notLoaded');
    if(!amt) return loc(it.parsed.y.toFixed(1)) + (short ? '%' : T('takenHomePct'));
    const s = sw.series[it.datasetIndex], c = jobCur(it.datasetIndex);
    return money(E.convert(it.raw.net, s.r.cur, c), c) + (short ? '' : T('takenHome'));
  };
  // Gross pay at one point of the axis, in every axis's currency.
  const grossAt = x => sw.curs.map(c => money(E.convert(x, cc, c), c)).join(' ≈ ');
  // Axis k restates the first one in its own currency: same span, so the zoom keeps them in step.
  const AX = ['x', 'x2', 'x3', 'x4'];
  const span = c => E.convert(sw.xMax, cc, c);
  const xScales = {};
  sw.curs.forEach((c, k) => {
    xScales[AX[k]] = { type: 'linear', min: 0, max: span(c), position: k % 2 ? 'top' : 'bottom',
      // The first axis names the measure; each other one reads by its symbol, which keeps the plot tall with four currencies.
      title: { display: !k, text: sw.curs.length > 1 ? T('axGrossYear') : TF('axGrossCur', { c }), color: muted, font: { size: 11 } },
      ticks: { color: muted, maxTicksLimit: 9, font: { size: 11 }, callback: v => money(v, c, true) },
      grid: k ? { drawOnChartArea: false, color: grid } : { color: grid } };
  });
  const zoom = SharedZoom.options({ min: 0, max: sw.xMax, points: 61 });
  if(sw.curs.length > 1 && zoom.limits){
    const base = zoom.limits.x;
    sw.curs.forEach((c, k) => { zoom.limits[AX[k]] = { min: 0, max: span(c), minRange: E.convert(base.minRange, cc, c) }; });
  }
  const options = {
    responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: SharedChartTip.options({
        backgroundColor: cssVar('--panel'), titleColor: text, bodyColor: muted, borderColor: grid, borderWidth: 1, padding: 10,
        callbacks: {
          title: items => items.length ? TF('tipGross', { g: grossAt(items[0].parsed.x) }) + (items[0].raw && items[0].raw.own ? T('asEntered') : '') : '',
          label: ctx => '  ' + ctx.dataset.label + ': ' + yText(ctx),
          afterBody(items){
            if(!items.length) return;
            $('hoverBox').textContent = TF('tipGross', { g: grossAt(items[0].parsed.x) }) + '  |  '
              + items.map(it => it.dataset.label + ': ' + yText(it, true)).join('  |  ');
          }
        }
      }),
      zoom,
      sharedYFit: { auto: { axes: ['y'] } }
    },
    scales: Object.assign(xScales, {
      y: { title: { display: true, text: amt ? TF('axTakeCur', { c: cc }) : T('axTakePct'), color: muted, font: { size: 11 } },
        ticks: { color: muted, font: { size: 11 }, callback: v => amt ? money(v, cc, true) : loc(v) + '%' }, grid: { color: grid } }
    })
  };
  $('chartTitle').textContent = chartTitle();
  if(chart) chart.destroy();
  chart = new Chart($('chartCanvas'), { type: 'line', data: { datasets }, options, plugins: [SharedZoom.plugin] });
  renderLegend(datasets);
}

/* ───────────────────────── Tables ───────────────────────── */
function compareRows(results){
  const rows = [
    [T('rowGross'), r => r.gross, 'total'],
    [T('rowTax'), r => r.incomeTax],
    [T('rowSocial'), r => r.social],
    [T('rowOther'), r => r.other, '', rs => rs.some(r => r.other > 0)],
    [T('rowNet'), r => r.net, 'total'],
    [T('rowShare'), r => r.net/r.gross, 'pct'],
    [T('rowMarg'), r => r.marginal, 'pct']
  ];
  return rows.filter(row => !row[3] || row[3](results.filter(r => !r.notSupported)));
}
function renderCompare(results){
  const curNote = disp().cur === 'local' ? T('ownCur') : disp().cur;
  let h = '<table><thead><tr><th>' + T('thItem') + ' <span class="th-unit">' + esc(perWord() + ', ' + curNote) + '</span></th>';
  results.forEach((r, i) => { h += '<th><span class="job-dot" style="background:' + colourOf(i) + '"></span>' + esc(jobTitle(JOBS[i], i)) + '</th>'; });
  h += '</tr></thead><tbody>';
  compareRows(results).forEach(([label, fn, cls]) => {
    h += '<tr' + (cls === 'total' ? ' class="total"' : '') + '><td>' + esc(label) + '</td>';
    results.forEach(r => {
      if(r.notSupported){ h += '<td>—</td>'; return; }
      const v = fn(r);
      h += '<td>' + (cls === 'pct' ? (v == null ? '—' : pct(v)) : esc(showMoney(v, r))) + '</td>';
    });
    h += '</tr>';
  });
  h += '</tbody></table>';
  $('compareWrap').innerHTML = h;
}
/* ───────────────────────── Take-home pay breakdown ─────────────────────────
   One job at a time, picked beside the title, always a year in the job's own
   currency (the sums are worked out yearly), written as a sum a reader can add up:
   - Taxable income: gross pay, plus what the rules count on top of it, less each
     line the engine marks as taken off (l.base), lands on r.taxable. A regime
     that taxes gross pay as it is (a flat rate) has no steps, so no block.
   - Take-home pay: gross pay less income tax, less contributions, less other
     deductions from pay, plus tax-free cash. Credits and allowances that work
     inside a tax read under it, muted and unsigned: already in the figure above.
   - Not in take-home pay: what the employer pays on top (super, social security).
   Each line's status badge links to its source and says, on hover, where the
   rule comes from and when it took effect. */
const STATUS = {
  official: ['badge-success', T('stOfficial'), T('stOfficialW')],
  secondary: ['badge-warning', T('stSecondary'), T('stSecondaryW')],
  assumption: ['badge-info', T('stAssumption'), T('stAssumptionW')]
};
// When the rule took effect, in words: a date reads "in force from", a year or tax year "rules for".
function fromWords(f){
  if(!f) return '';
  if(/^(\d{1,2} )?[A-Z][a-z]{2} \d{4}$/.test(f)) return TF('fromDate', { f: dateW(f) });
  if(/thresholds/.test(f)) return TF('fromThresholds', { f: ID ? f.replace(/ thresholds$/, '') : f });
  return TF('fromRules', { f: ID ? (/^\d{4}$/.test(f) ? 'tahun ' + f : f.replace(/^Income /, 'penghasilan ')) : f.replace(/^Income /, 'income ') });
}
function badge(l){
  const b = STATUS[l.status] || STATUS.secondary, src = E.SRC[l.src] || { name: '', url: '' };
  const tip = '<strong>' + b[1] + '</strong>, ' + b[2] + (src.name ? '<br>' + TF('srcLabel', { name: esc(src.name) }) : '') + (l.from ? ' ' + fromWords(l.from) : '');
  const said = b[1] + '. ' + (src.name ? TF('srcLabel', { name: src.name }) + ' ' : '') + fromWords(l.from);
  return src.url
    ? '<a class="badge ' + b[0] + '" href="' + esc(src.url) + '" target="_blank" rel="noopener" data-tip="' + esc(tip) + '" aria-label="' + esc(said + T('opensSource')) + '">' + b[1] + '</a>'
    : '<span class="badge ' + b[0] + '" data-tip="' + esc(tip) + '" aria-label="' + esc(said) + '">' + b[1] + '</span>';
}
// Where a line reads in the take-home block (null: only in the taxable income block).
function placeOf(l){
  if(l.inBrackets) return null;          // already a row under its tax line's brackets
  if(l.group) return l.group;
  if(l.base && !SUMMED.includes(l.kind)) return null;
  return { tax: 'tax', credit: 'tax', deduction: 'tax', social: 'social', other: 'other', benefit: 'benefit', employer: 'employer' }[l.kind] || 'note';
}
const SUMMED = ['tax', 'social', 'other', 'benefit'];
/* The rows of one job's breakdown, for the table and its CSV alike. A row is
   { sec } (a block's title) or { sec, op, label, amount, line, cls }, where op is
   '+', '−', '=' or '' and cls is 'start', 'group', 'part', 'aside', 'band' or 'total'.
   A tax line worked out on marginal brackets is followed by its 'band' rows: each
   bracket the base reaches, with the slice of income in it, its rate and its tax,
   then the credits or surcharges that turn their sum into the line, then any
   rounding the rules make. */
const rateText = v => Array.isArray(v) ? rateText(v[0]) + T('rising') + rateText(v[1]) : loc(+(v*100).toFixed(4)) + '%';
function bracketRows(sec, l, cur, cc){
  const b = l.brackets, out = [];
  if(!b || !(b.base > 0)) return out;   // nothing taxable: no bracket is reached
  b.rows.forEach(x => out.push({ sec, op: '', label: TF('band', { lo: money(x.lo, cur), hi: money(x.hi, cur), rate: rateText(x.rate) }), amount: x.amount, cls: 'band' }));
  b.adj.forEach(a => out.push({ sec, op: '', label: trE(a.label, cc), amount: Math.abs(a.amount), cls: 'band' }));
  if(b.rest) out.push({ sec, op: '', label: trE(b.restLabel, cc), amount: b.rest, cls: 'band' });
  return out;
}
function breakdownRows(r){
  const rows = [], ls = r.lines, cc = r.country, lab = l => trE(l.label, cc);
  const push = row => { rows.push(row); if(row.line) rows.push(...bracketRows(row.sec, row.line, r.cur, cc)); };
  // A sum of several lines reads as one signed row with its parts under it; a single line is its own row.
  const group = (sec, op, title, summed, asides) => {
    if(!summed.length && !asides.length) return;
    if(summed.length === 1 && !asides.length){ push({ sec, op, label: lab(summed[0]), amount: summed[0].amount, line: summed[0] }); return; }
    rows.push({ sec, op, label: title, amount: summed.reduce((a, l) => a + l.amount, 0), cls: 'group' });
    ls.filter(l => summed.includes(l) || asides.includes(l)).forEach(l =>
      push({ sec, op: '', label: lab(l), amount: (l.kind === 'info' && !l.amount) ? null : l.amount, line: l, cls: summed.includes(l) ? 'part' : 'aside' }));
  };
  const base = ls.filter(l => l.base);
  if(r.taxable != null && base.length){
    const sec = T('secTaxable');
    rows.push({ sec });
    rows.push({ sec, op: '', label: T('rowGross'), amount: r.gross, cls: 'start' });
    base.filter(l => l.base > 0).forEach(l => rows.push({ sec, op: '+', label: lab(l), amount: l.amount, line: l }));
    const off = base.filter(l => l.base < 0);
    off.filter(l => l.kind === 'other').forEach(l => rows.push({ sec, op: '−', label: lab(l), amount: l.amount, line: l }));
    group(sec, '−', T('deductibleContrib'), off.filter(l => l.kind === 'social'), []);
    off.filter(l => l.kind !== 'other' && l.kind !== 'social').forEach(l => rows.push({ sec, op: '−', label: lab(l), amount: l.amount, line: l }));
    // Taxable income stops at 0: on low pay (or none) the deductions can be bigger than the pay, and
    // what they cannot use is added back in one row, so the block still adds up.
    const raw = base.reduce((a, l) => a + l.base*l.amount, r.gross);
    if(raw < -0.005) rows.push({ sec, op: '+', label: T('unusedDed'), amount: -raw });
    rows.push({ sec, op: '=', label: r.taxableLabel ? trE(r.taxableLabel, cc) : T('secTaxable'), amount: r.taxable, cls: 'total' });
  }
  const sec = T('secTake'), at = p => ls.filter(l => placeOf(l) === p);
  rows.push({ sec });
  rows.push({ sec, op: '', label: T('rowGross'), amount: r.gross, cls: 'start' });
  at('gross').forEach(l => { const t = lab(l); rows.push({ sec, op: '', label: TF('ofWhich', { x: t.charAt(0).toLowerCase() + t.slice(1) }), amount: l.amount, line: l, cls: 'aside' }); });
  ['tax', 'social', 'other', 'benefit'].forEach(p => {
    const all = at(p), summed = all.filter(l => SUMMED.includes(l.kind));
    group(sec, p === 'benefit' ? '+' : '−', T({ tax: 'gTax', social: 'gSocial', other: 'gOther', benefit: 'gBenefit' }[p]), summed, all.filter(l => !summed.includes(l)));
  });
  rows.push({ sec, op: '=', label: T('takeYear'), amount: r.net, cls: 'total' });
  rows.push({ sec, op: '=', label: T('takeMonth'), amount: r.net/12, cls: 'total' });
  const employer = at('employer');
  if(employer.length){
    const sec = T('secNotIn');
    rows.push({ sec });
    employer.forEach(l => rows.push({ sec, op: '', label: lab(l), amount: l.amount, line: l }));
  }
  return rows;
}
// The breakdown shows one job at a time, picked beside its title. It follows the job the form
// shows until the reader picks another, and falls back to job 1 when the one picked is removed.
let linesPick = null;
function linesJobIndex(n){
  const i = linesPick == null ? ACTIVE : linesPick;
  return i >= 0 && i < n ? i : 0;
}
function renderLinesPicker(results){
  const sel = $('linesJob'), idx = linesJobIndex(results.length);
  sel.innerHTML = results.map((r, i) => '<option value="' + i + '">' + esc(jobTitle(JOBS[i], i)) + '</option>').join('');
  sel.value = String(idx);
  const many = results.length > 1;
  sel.hidden = !many; $('linesJobLabel').hidden = !many;
  return idx;
}
function renderLines(results){
  const i = renderLinesPicker(results);
  const r = results[i], job = JOBS[i], c = E.C[job.country];
  let h = '<div class="job-block">';
  h += '<p class="job-meta"><span class="job-dot" style="background:' + colourOf(i) + '"></span><strong>' + esc(jobTitle(job, i)) + '</strong>'
    + '<span class="job-meta-sep">·</span>' + esc(trE(c.year, job.country)) + (c.place ? ' · ' + esc(trE(c.place, job.country)) : '') + ' · ' + esc(TF('amountsIn', { cur: r.cur })) + '</p>';
  if(r.notSupported){ $('linesWrap').innerHTML = h + '<div class="warning ns">' + esc(trE(r.reason, job.country)) + '</div></div>'; return; }
  h += '<div class="table-wrap explainer"><table class="lines-table"><colgroup><col class="c-op"><col class="c-line"><col class="c-amt"><col class="c-status"></colgroup>'
    + '<thead><tr><th class="op" aria-label="' + esc(T('plusMinus')) + '"></th><th class="l">' + T('thLine') + '</th><th class="r">' + T('thAmount') + ' <span class="th-unit">' + esc(TF('curYear', { cur: r.cur })) + '</span></th><th class="c">' + T('thStatus') + '</th></tr></thead><tbody>';
  breakdownRows(r).forEach(row => {
    if(row.op == null){ h += '<tr class="sec"><td colspan="4">' + esc(row.sec) + '</td></tr>'; return; }
    const amt = row.amount == null ? '' : money(row.amount, r.cur);
    h += '<tr' + (row.cls ? ' class="' + row.cls + '"' : '') + '><td class="op">' + esc(row.op) + '</td><td class="lbl">' + esc(row.label) + '</td>'
      + '<td class="amt">' + esc(amt) + '</td><td class="st">' + (row.line ? badge(row.line) : '') + '</td></tr>';
  });
  h += '</tbody></table></div>';
  const notes = r.lines.filter(l => placeOf(l) === 'note').map(l => trE(l.label, r.country) + '.').concat((r.notes || []).map(n => trE(n, r.country)));
  if(notes.length) h += '<ul class="job-notes">' + notes.map(n => '<li>' + esc(n) + '</li>').join('') + '</ul>';
  h += '</div>';
  $('linesWrap').innerHTML = h;
}

/* ───────────────────────── What this assumes ───────────────────────── */
const SIT_FIELDS = ['auRes','sgRes','usRes','deClass','idRes','myRes','noRes','seRes','fiRes','itImp','frCadre','esRegime','ptRegime','jpRes','krMethod','cnRes','twRes','twEi','gulfNat','beStatus','chStatus','usFiling','caProv','usState','ukRegion'];
function optionText(id, v){
  const el = $(id);
  if(!el || el.tagName !== 'SELECT') return '';
  const o = [...el.options].find(o => o.value === String(v));
  return o ? o.textContent.trim() : '';
}
function renderAssumptions(results){
  const li = [];
  results.forEach((r, i) => {
    const job = JOBS[i], c = E.C[job.country];
    const sit = SIT_FIELDS.filter(f => Object.prototype.hasOwnProperty.call(job, f)).map(f => optionText(f, job[f])).filter(Boolean);
    let line = '<strong>' + esc(jobTitle(job, i)) + ':</strong> ' + esc(TF('aRules', { year: trE(c.year, job.country) })) + (c.place ? esc(TF('aFor', { place: trE(c.place, job.country) })) : '') + (sit.length ? ', ' + esc(sit.join(', ').toLowerCase()) : '') + '.';
    if(r.solved) line += esc(TF('aSolved', { x: money(r.target, r.cur) }));
    if(r.notSupported) line += esc(TF('aNotWorked', { reason: trE(r.reason, job.country) }));
    li.push(line);
    (r.notes || []).forEach(n => li.push('<strong>' + esc(cName(job.country)) + ':</strong> ' + esc(trE(n, job.country))));
    const flagged = (r.lines || []).filter(l => l.status === 'assumption' && ['tax', 'social', 'credit'].includes(l.kind));
    flagged.forEach(l => li.push('<strong>' + esc(cName(job.country)) + ':</strong> ' + esc(TF('aChoice', { label: trE(l.label, job.country) }))));
  });
  const curs = new Set(results.map(r => r.cur));
  if(disp().cur !== 'local' || curs.size > 1)
    li.push(TF('aFx', { date: dateW(E.FX_DATE), src: '<a href="' + esc(FX_SRC.url) + '" target="_blank" rel="noopener">' + esc(FX_SRC.name) + '</a>', bundled: LIVE ? '' : T('aBundled') }));
  li.push(T('aIncome'));
  li.push(T('aYear'));
  $('assumptions').innerHTML = li.map(x => '<li>' + x + '</li>').join('');
}

/* ───────────────────────── Render ───────────────────────── */
let last = null;
function render(){
  applyVisibility();
  syncActive();
  const results = JOBS.map(computeJob);
  last = { results };
  renderJobs(results);
  renderVerdict(results);
  renderMetrics(results);
  updateChart(results);
  renderCompare(results);
  renderLines(results);
  renderAssumptions(results);
}

/* ───────────────────────── Exports ───────────────────────── */
function downloadBlob(content, filename, type){
  const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const q = v => '"' + String(v).replace(/"/g, '""') + '"';
function exportCsv(){
  if(!last) return;
  const { results } = last, rows = [];
  rows.push([q(T('csvHead'))]);
  rows.push([q(TF('csvAmounts', { per: perWord(), cur: disp().cur === 'local' ? T('csvEachCur') : disp().cur }))]);
  rows.push([q(T('thItem'))].concat(results.map((r, i) => q(jobTitle(JOBS[i], i) + ' (' + (disp().cur === 'local' ? r.cur : disp().cur) + ')'))));
  compareRows(results).forEach(([label, fn, cls]) => {
    rows.push([q(label)].concat(results.map(r => {
      if(r.notSupported) return q('');
      const v = fn(r);
      return cls === 'pct' ? q(v == null ? '' : (v*100).toFixed(2) + '%') : q(Math.round(shown(v, r).v));
    })));
  });
  downloadBlob(rows.map(r => r.join(',')).join('\n'), 'global-salary-comparison.csv', 'text/csv;charset=utf-8;');
}
// The breakdown as the table writes it, every job: the same rows, a role for each so a sheet can add them up.
function exportLinesCsv(){
  if(!last) return;
  const ROLE = { '+': T('roleAdded'), '−': T('roleTaken'), '=': T('roleResult') };
  const role = row => row.cls === 'start' ? T('roleStart') : row.cls === 'part' ? T('rolePart') : row.cls === 'band' ? T('roleBand') : row.cls === 'aside' ? T('roleAside') : ROLE[row.op] || T('roleRef');
  const rows = [['csvJob', 'csvCountry', 'csvSection', 'csvRole', 'csvLine', 'csvAmountYear', 'csvCurrency', 'csvStatus', 'csvSource', 'csvSourceUrl', 'csvFrom'].map(k => q(T(k))).join(',')];
  last.results.forEach((r, i) => {
    if(r.notSupported){ rows.push([q(i + 1), q(cName(JOBS[i].country)), q(''), q(''), q(TF('csvNotWorked', { reason: trE(r.reason, JOBS[i].country) }))].join(',')); return; }
    breakdownRows(r).forEach(row => {
      if(row.op == null) return;
      const l = row.line, s = l ? E.SRC[l.src] || {} : {};
      rows.push([q(i + 1), q(cName(r.country)), q(row.sec), q(role(row)), q(row.label), q(row.amount == null ? '' : row.amount.toFixed(2)), q(r.cur),
        q(l ? (ID && STATUS[l.status] ? STATUS[l.status][1] : l.status) : ''), q(s.name || ''), q(s.url || ''), q(l ? dateW(l.from) : '')].join(','));
    });
  });
  downloadBlob(rows.join('\n'), 'global-salary-lines.csv', 'text/csv;charset=utf-8;');
}
// The title follows the measure the chart reads (the h2 on the page and the exports alike).
const chartTitle = () => T(chartMeasure() === 'amount' ? 'chartTitleAmt' : 'chartTitlePct');
function chartSubtitle(){
  if(!last) return '';
  return last.results.map((r, i) => r.notSupported ? TF('subNotLoaded', { job: jobTitle(JOBS[i], i) }) : jobTitle(JOBS[i], i) + ' ' + pct(r.net/r.gross)).join(' · ');
}
function chartPng(){ const a = arguments; return SharedExport.atDesktopSize('chartCanvas', () => chartPngAtSize.apply(null, a)); }
function chartPngAtSize(){
  const src = $('chartCanvas');
  const pad = 28, headH = 74, footH = 34;
  const items = SharedLegend.itemsOf('chartLegend');
  const K = 1.4, markW = SharedLegend.W*K, gap = 10, itemGap = 26, legendH = items.length ? 34 : 0;
  const dpr = window.devicePixelRatio || 1, OUT = 3;
  const plotW = Math.round(src.width/dpr), plotH = Math.round(src.height/dpr);
  const outW = plotW + pad*2, outH = plotH + headH + legendH + footH + pad;
  const out = document.createElement('canvas');
  out.width = outW*OUT; out.height = outH*OUT;
  const ctx = out.getContext('2d');
  ctx.scale(OUT, OUT);
  ctx.fillStyle = cssVar('--panel') || '#fff'; ctx.fillRect(0, 0, outW, outH);
  ctx.fillStyle = cssVar('--text'); ctx.font = '700 26px "DM Sans", sans-serif';
  ctx.fillText(chartTitle(), pad, pad + 22);
  ctx.fillStyle = cssVar('--muted'); ctx.font = '400 15px "DM Sans", sans-serif';
  ctx.fillText(chartSubtitle(), pad, pad + 48);
  ctx.drawImage(src, pad, headH, plotW, plotH);
  if(items.length){
    ctx.font = '500 15px "DM Sans", sans-serif'; ctx.textBaseline = 'middle';
    const widths = items.map(it => markW + gap + ctx.measureText(it.label).width);
    const totalW = widths.reduce((a, b) => a + b, 0) + itemGap*(items.length - 1);
    let x = Math.max(pad, (outW - totalW)/2);
    const cy = headH + plotH + legendH/2;
    items.forEach((it, i) => {
      SharedLegend.paint(ctx, it.swatch || { color: it.color }, x, cy, K);
      x += markW + gap; ctx.fillStyle = cssVar('--text'); ctx.fillText(it.label, x, cy);
      x += widths[i] - markW - gap + itemGap;
    });
    ctx.textBaseline = 'alphabetic';
  }
  ctx.fillStyle = cssVar('--muted'); ctx.font = '400 13px "DM Sans", sans-serif';
  ctx.fillText(T('madeUsing'), pad, outH - 14);
  return out;
}
function chartSvg(){ const a = arguments; return SharedExport.atDesktopSize('chartCanvas', () => chartSvgAtSize.apply(null, a)); }
function chartSvgAtSize(){
  const src = $('chartCanvas'), NS = 'http://www.w3.org/2000/svg', XL = 'http://www.w3.org/1999/xlink';
  const dpr = window.devicePixelRatio || 1, plotW = Math.round(src.width/dpr), plotH = Math.round(src.height/dpr);
  const pad = 20, headH = 64, footH = 24;
  const items = SharedLegend.itemsOf('chartLegend');
  const markW = SharedLegend.W, gap = 7, itemGap = 19, legendH = items.length ? 24 : 0;
  const W = plotW + pad*2, H = plotH + headH + legendH + footH + pad;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('xmlns', NS); svg.setAttribute('xmlns:xlink', XL);
  svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  const text = (str, x, y, size, weight, fill, anchor) => {
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', x); t.setAttribute('y', y); t.setAttribute('font-family', '"DM Sans", sans-serif');
    t.setAttribute('font-size', size); t.setAttribute('font-weight', weight); t.setAttribute('fill', fill);
    if(anchor) t.setAttribute('dominant-baseline', anchor);
    t.textContent = str; svg.appendChild(t); return t;
  };
  const bg = document.createElementNS(NS, 'rect');
  bg.setAttribute('width', W); bg.setAttribute('height', H); bg.setAttribute('fill', cssVar('--panel') || '#fff'); svg.appendChild(bg);
  text(chartTitle(), pad, pad + 16, 19, 700, cssVar('--text'));
  text(chartSubtitle(), pad, pad + 34, 11, 400, cssVar('--muted'));
  const img = document.createElementNS(NS, 'image');
  img.setAttribute('x', pad); img.setAttribute('y', headH); img.setAttribute('width', plotW); img.setAttribute('height', plotH);
  const href = src.toDataURL('image/png');
  img.setAttribute('href', href); img.setAttributeNS(XL, 'href', href); svg.appendChild(img);
  if(items.length){
    const mc = document.createElement('canvas').getContext('2d');
    mc.font = '500 11px "DM Sans", sans-serif';
    const widths = items.map(it => markW + gap + mc.measureText(it.label).width);
    const totalW = widths.reduce((a, b) => a + b, 0) + itemGap*(items.length - 1);
    let x = Math.max(pad, (W - totalW)/2);
    const cy = headH + plotH + legendH/2;
    items.forEach((it, i) => {
      svg.appendChild(SharedLegend.svgNode(it.swatch || { color: it.color }, x, cy, 1));
      x += markW + gap; text(it.label, x, cy, 11, 500, cssVar('--text'), 'middle');
      x += widths[i] - markW - gap + itemGap;
    });
  }
  text(T('madeUsing'), pad, H - 10, 10, 400, cssVar('--muted'));
  const xml = '<?xml version="1.0" encoding="utf-8"?>\n' + new XMLSerializer().serializeToString(svg);
  downloadBlob(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }), 'global-income-tax-calculator.svg');
}
function exportPng(){ chartPng().toBlob(b => downloadBlob(b, 'global-income-tax-calculator.png')); }

/* ───────────────────────── Quick Start ───────────────────────── */
/* Each opens from the page's defaults, so none inherits what was on screen. */
const QUICK_START = {
  asia: { dispCur: 'USD', jobs: [
    { country: 'SG', amount: '180,000', sgRes: 'ep' },
    { country: 'HK', amount: '1,300,000' },
    { country: 'JP', amount: '15,000,000', jpRes: 'y2' },
    { country: 'AE', amount: '600,000', gulfNat: 'expat' } ] },
  europe: { dispCur: 'EUR', jobs: [
    { country: 'GB', amount: '95,000', ukRegion: 'ruk' },
    { country: 'NL', amount: '95,000', nlRuling: true, nlHoliday: false },
    { country: 'DE', amount: '95,000', deClass: 'I' },
    { country: 'CH', amount: '140,000', chStatus: 'single' } ] },
  us: { dispCur: 'local', jobs: [
    { country: 'US', amount: '150,000', usState: 'TX', usFiling: 'S' },
    { country: 'US', amount: '150,000', usState: 'CA', usFiling: 'S' },
    { country: 'US', amount: '150,000', usState: 'NY', usNyc: true, usFiling: 'S' },
    { country: 'US', amount: '150,000', usState: 'IL', usFiling: 'S' } ] },
  net: { dispCur: 'local', dispPer: 'month', jobs: [
    { country: 'FR', dir: 'net', amount: '4,000', period: 'monthly', frCadre: 'cadre' },
    { country: 'ES', dir: 'net', amount: '4,000', period: 'monthly' },
    { country: 'PT', dir: 'net', amount: '4,000', period: 'monthly' },
    { country: 'IT', dir: 'net', amount: '4,000', period: 'monthly' } ] },
  family: { dispCur: 'local', jobs: [
    { country: 'BE', amount: '80,000', beStatus: 'married', beKids: '2' },
    { country: 'FR', amount: '80,000', frCadre: 'cadre', frMarried: true, frKids: '2' },
    { country: 'DE', amount: '80,000', deClass: 'III', deKids: true },
    { country: 'NL', amount: '80,000', nlHoliday: false } ] }
};
function clearQuickStart(){ document.querySelectorAll('.quick-start-btn').forEach(b => b.classList.remove('active')); }
function applyQuickStart(key){
  const s = QUICK_START[key];
  if(!s) return false;
  JOBS = s.jobs.map(j => fullJob(j));
  ACTIVE = 0;
  writeJob(JOBS[0]);
  $('dispCur').value = s.dispCur || 'local';
  $('dispPer').value = s.dispPer || 'year';
  document.querySelectorAll('.quick-start-btn').forEach(b => b.classList.toggle('active', b.dataset.preset === key));
  // save(), not schedule(): what is on screen is the scenario now.
  if(persist) persist.save();
  render();
  return true;
}
window.GSC_QS = Object.keys(QUICK_START);

/* ───────────────────────── Wiring ───────────────────────── */
function sanitizeJobs(list){
  if(!Array.isArray(list)) return null;
  const out = list.filter(j => j && typeof j === 'object').slice(0, MAX_JOBS).map(j => fullJob(j));
  return out.length ? out : null;
}
function init(){
  applyLang();
  FIELDS = [...scope.querySelectorAll('input, select')].filter(el => el.id && !el.closest('[data-no-persist]'));
  FIELDS.forEach(el => { DEFAULTS[handle(el)] = valueOf(el); });

  // Counts read in figures; a choice in words (Gross pay, Year) keeps the page's own font.
  document.querySelectorAll('select.seg-src').forEach(sel => SharedSeg.fromSelect(sel, {
    labelOf: o => o.textContent.trim(),
    className: /^\d/.test(sel.options[0].value) ? '' : 'seg-words',
    ariaLabel: (sel.closest('.field-row, .view-opt') && sel.closest('.field-row, .view-opt').querySelector('.field-label, .view-label') || {}).textContent || sel.id
  }));
  // Country, state and province are searchable: type a few letters instead of scrolling. The select stays the field of record.
  if(window.SharedDropdown && SharedDropdown.searchable){
    SharedDropdown.searchable($('country'), { placeholder: T('searchCountry'), chip: o => (E.C[o.value] || {}).cur || '' });
    SharedDropdown.searchable($('usState'), { placeholder: T('searchState'), chip: o => o.value });
    SharedDropdown.searchable($('caProv'), { placeholder: T('searchProv'), chip: o => o.value });
  }
  scope.querySelectorAll('.fmt-num').forEach(el => SharedFmt.attachCurrencyInput(el, { maxDecimals: 2 }));
  scope.querySelectorAll('.fmt-pct').forEach(el => SharedFmt.attachCurrencyInput(el, { maxDecimals: 3 }));
  SharedFreq.attachSelect($('period'), $('amount'), { maxDecimals: 2 });

  document.querySelectorAll('.ctrl-tab').forEach(tab => tab.addEventListener('click', () => {
    document.querySelectorAll('.ctrl-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.ctrl-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    $('tab-' + tab.dataset.tab).classList.add('active');
    fitPrefixes();
  }));

  // Typing a search into a picker is not a change: the pick itself fires on its select.
  const fromForm = e => !(e.target && e.target.classList && e.target.classList.contains('combo-input'));
  scope.addEventListener('input', e => { if(fromForm(e)){ clearQuickStart(); render(); } });
  scope.addEventListener('change', e => { if(fromForm(e)){ clearQuickStart(); render(); } });
  $('dispCur').addEventListener('change', render);
  $('dispPer').addEventListener('change', render);
  $('addJob').addEventListener('click', addJob);

  $('themeToggle').addEventListener('click', () => {
    document.body.classList.toggle('light');
    $('themeToggle').textContent = document.body.classList.contains('light') ? '🌙 Dark' : '☀️ Light';
    if(last) updateChart(last.results);
  });
  $('csvBtn').addEventListener('click', exportCsv);
  $('linesCsvBtn').addEventListener('click', exportLinesCsv);
  $('linesJob').addEventListener('change', () => { linesPick = Number($('linesJob').value); if(last) renderLines(last.results); });
  $('chartMeasure').addEventListener('change', () => { if(last) updateChart(last.results); });
  $('svgBtn').addEventListener('click', chartSvg);
  $('pngBtn').addEventListener('click', exportPng);
  $('copyBtn').addEventListener('click', () => SharedShare.copyImage(() => chartPng(), $('copyBtn')));
  $('resetZoomBtn').addEventListener('click', () => { if(chart) chart.resetZoom(); });
  $('chartCanvas').addEventListener('mouseleave', () => { $('hoverBox').textContent = T('hoverHint'); });
  document.querySelectorAll('.quick-start-btn').forEach(b => b.addEventListener('click', () => applyQuickStart(b.dataset.preset)));

  startLive();
  JOBS = DEFAULT_JOBS().map(j => j ? fullJob(j) : readJob());
  ACTIVE = 0;

  let restoredJobs = null, restoredAgent = false;
  persist = Persist.init('global-salary-calculator', {
    onRestore: () => {
      // The fields are the active job as saved (or as an AI link set it); they win over its copy in extra.
      if(restoredJobs){ JOBS = restoredJobs; ACTIVE = Math.min(Math.max(0, ACTIVE), JOBS.length - 1); }
      else { JOBS = [readJob()]; ACTIVE = 0; }
      // An AI link's json jobs already carry the fields it named; anywhere else the fields win.
      if(!restoredAgent) JOBS[ACTIVE] = fullJob(readJob());
      writeJob(JOBS[ACTIVE]);
      restoredJobs = null; restoredAgent = false;
      render();
    },
    extra: {
      // Each job keeps only what differs from the page's defaults (and its country), so links stay short.
      save: () => { syncActive(); return { jobs: JOBS.map(compactJob), active: ACTIVE }; },
      restore: saved => {
        restoredAgent = !!(saved && saved.agentJobs);
        restoredJobs = saved && sanitizeJobs(saved.jobs);
        ACTIVE = saved && Number.isInteger(saved.active) ? saved.active : 0;
      }
    }
  });
  SharedScenario.mount('.quick-start-row', { tool: 'global-salary-calculator', persist });
  SharedFold.attach($('linesSection'), { key: 'global-salary-calculator-lines', bodies: ['.lines-body'] });
  render();

  openFromComparator();

  // The tour's example and its hand-back (tour.js): Asia hubs in each job's own currency.
  window.__GSC_TOUR = {
    seed(){ applyQuickStart('asia'); $('dispCur').value = 'local'; $('dispCur').dispatchEvent(new Event('change')); },
    saveState(){ syncActive(); return { jobs: JSON.parse(JSON.stringify(JOBS)), active: ACTIVE, dispCur: $('dispCur').value, dispPer: $('dispPer').value,
      qs: (document.querySelector('.quick-start-btn.active') || {}).dataset }; },
    restoreState(snap){
      if(!snap || !Array.isArray(snap.jobs) || !snap.jobs.length) return;
      JOBS = snap.jobs; ACTIVE = Math.min(snap.active || 0, JOBS.length - 1);
      writeJob(JOBS[ACTIVE]);
      $('dispCur').value = snap.dispCur || 'local';
      $('dispPer').value = snap.dispPer || 'year';
      $('dispPer').dispatchEvent(new Event('change'));
      clearQuickStart();
      if(snap.qs && snap.qs.preset) document.querySelectorAll('.quick-start-btn').forEach(b => b.classList.toggle('active', b.dataset.preset === snap.qs.preset));
      if(persist) persist.save();
      render();
    }
  };

  window.__GSC = { E, JOBS: () => JOBS, active: () => ACTIVE, compute: computeJob, rows: breakdownRows, readJob, writeJob, applyQuickStart, pickJob, addJob, removeJob, render };
}

/* ═════════════════════ From the Cost of Living Comparator ═════════════════════
   The comparator points here under a salary in a city whose rules are loaded
   (gitcHint in costofliving-comparator/script.js), with the city as fields:
     #from=col&country=US&usState=CA[&usNyc=true|caProv=ON|ukRegion=sco]
       &dir=gross|net[&amount=<monthly>]&period=monthly
   It opens one job on that place, per month, and the hash leaves the address
   so a reload keeps the reader's own edits. Only these keys are read; a value
   the form does not hold is skipped, never thrown on. */
const FROM_COL_KEYS = ['country', 'usState', 'usNyc', 'caProv', 'ukRegion', 'dir', 'amount', 'period'];
function openFromComparator(){
  const h = location.hash || '';
  if(!/^#from=col(&|$)/.test(h)) return;
  const q = new URLSearchParams(h.slice(1));
  try { history.replaceState(null, '', location.pathname + location.search); } catch(e){}
  const country = String(q.get('country') || '').toUpperCase();
  if(!E.C[country]) return;
  const job = { country };
  FROM_COL_KEYS.forEach(k => {
    if(k === 'country' || !q.has(k)) return;
    const el = FIELDS.find(f => handle(f) === k), v = q.get(k);
    if(!el) return;
    if(el.tagName === 'SELECT' && ![...el.options].some(o => o.value === v)) return;
    if(k === 'amount'){
      const n = Number(v);
      if(isFinite(n) && n > 0) job.amount = SharedFmt.formatCanonical(String(Math.min(n, 1e11)), { maxDecimals: 2 });
      return;
    }
    job[k] = el.type === 'checkbox' ? v === 'true' : v;
  });
  if(!job.amount) job.amount = job.period === 'monthly' ? '10,000' : DEFAULTS.amount;
  JOBS = [fullJob(job)];
  ACTIVE = 0;
  writeJob(JOBS[0]);
  $('dispCur').value = 'local';
  $('dispPer').value = job.period === 'monthly' ? 'month' : 'year';
  $('dispPer').dispatchEvent(new Event('change'));
  clearQuickStart();
  if(persist) persist.save();
  render();
  const place = jobPlace(JOBS[0]);
  const note = document.createElement('div');
  note.className = 'from-col card';
  note.setAttribute('role', 'status');
  note.innerHTML = '<span class="from-col-text"><strong>' + T('colTitle') + '</strong>' + TF('colOn', { place: esc(place) })
    + T(job.dir === 'net' ? 'colNet' : 'colGross')
    + T('colSet') + '</span>' + SharedIcon.button('close', T('dismiss'), 'from-col-close');
  note.querySelector('.from-col-close').addEventListener('click', () => note.remove());
  $('verdict').insertAdjacentElement('beforebegin', note);
  if(job.dir !== 'net') setTimeout(() => { try { $('amount').focus({ preventScroll: true }); $('amount').select(); } catch(e){} }, 300);
}

/* ═════════════════════ AI links ═════════════════════
   A #load link (SharedAgent, shared.js) names fields by their ids: those set
   job 1, the job the form shows. Three ways a link can describe the jobs:
   - fields alone: one job, the one the fields describe;
   - qs=<Quick Start>: its four jobs, with any field named laid over job 1;
   - json={"jobs":[{...},...]}: up to four jobs, each an object of the same
     field ids, with any field named outside the json laid over job 1.
   The adapter leaves a mark (agentJobs) in extra so the load keeps the jobs as
   the link gave them; save() never writes it. */
let agentQs = false, agentJson = false;
function agentValue(el, raw, api, label){
  if(el.type === 'checkbox'){
    const t = String(raw).trim().toLowerCase();
    if(['true', '1', 'on', 'yes'].includes(t) || raw === true) return true;
    if(['false', '0', 'off', 'no'].includes(t) || raw === false) return false;
    api.error(label + ': not true or false'); return undefined;
  }
  if(el.tagName === 'SELECT'){
    const v = String(raw).trim(), opts = [...el.options];
    // By value, by the words on screen, or by the English words (an AI link reads the same on either page).
    const o = opts.find(o => o.value === v) || opts.find(o => o.textContent.trim().toLowerCase() === v.toLowerCase())
      || opts.find(o => o.dataset.i18nOpt && String(LANG.en[o.dataset.i18nOpt] || '').toLowerCase() === v.toLowerCase());
    if(!o){ api.error(label + ' "' + v.slice(0, 30) + '": not one of ' + opts.map(o => o.value).join(', ')); return undefined; }
    return o.value;
  }
  const n = api.number(String(raw));
  if(!isFinite(n)){ api.error(label + ': not a number'); return undefined; }
  const lo = +el.getAttribute('data-min'), hi = +el.getAttribute('data-max');
  const used = Math.min(isFinite(hi) ? hi : Infinity, Math.max(isFinite(lo) ? lo : -Infinity, n));
  if(used !== n) api.clamp(label, n, used);
  return SharedFmt.formatCanonical(String(used), { maxDecimals: el.classList.contains('fmt-pct') ? 3 : 2 });
}
function agentJsonJobs(obj, extra, api){
  const list = obj && (Array.isArray(obj.jobs) ? obj.jobs : Array.isArray(obj) ? obj : null);
  if(!list){ api.error('json: send {"jobs":[{"country":"SG","amount":150000}, ...]}'); return false; }
  if(list.length > MAX_JOBS) api.error('json: only the first ' + MAX_JOBS + ' jobs are used');
  const jobs = [];
  list.slice(0, MAX_JOBS).forEach((j, n) => {
    const tag = 'job ' + (n + 1);
    if(!j || typeof j !== 'object' || !E.C[String(j.country || '').toUpperCase()]){ api.error(tag + ': country must be one of ' + Object.keys(E.C).join(', ')); return; }
    const out = { country: String(j.country).toUpperCase() };
    Object.keys(j).forEach(h => {
      if(h === 'country') return;
      const el = FIELDS.find(f => handle(f) === h);
      if(!el){ api.unknown('json.' + h); return; }
      const v = agentValue(el, j[h], api, tag + ' ' + h);
      if(v !== undefined) out[h] = v;
    });
    jobs.push(out);
  });
  if(!jobs.length) return false;
  extra.jobs = jobs; extra.active = 0; agentJson = true;
  return { value: TF(jobs.length > 1 ? 'agentJobs' : 'agentJob', { n: jobs.length, list: jobs.map((j, i) => jobPlace(fullJob(j))).join(', ') }) };
}
if(window.SharedAgent) SharedAgent.register({
  tool: 'global-salary-calculator',
  preset: key => {
    if(!applyQuickStart(key)) return false;
    agentQs = true;
    return (document.querySelector('.quick-start-btn[data-preset="' + key + '"]') || {}).textContent || true;
  },
  json: agentJsonJobs,
  patch: (extra, api) => {
    if(agentJson){
      const j0 = extra.jobs[0];
      FIELDS.forEach(el => { const h = handle(el); if(api.given(h) && api.applied(h)) j0[h] = api.field(h); });
      extra.agentJobs = true;
    } else if(!agentQs){
      extra.jobs = null; extra.active = 0;     // the fields describe the one job
    }
  },
  describe: key => key === 'json' ? { label: T('agentJobsLabel'), el: $('jobsList') } : null
});

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();
