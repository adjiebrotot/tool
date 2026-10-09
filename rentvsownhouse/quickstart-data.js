/* ── QUICK START DATA ─────────────────────────────────────────────────────────
   Rent vs Own: every Quick Start scenario, and the one place its figures live.

   Read by three pages, so a figure changed here changes all of them at once:
     ./                          the calculator's Quick Start (city, then home)
     ./sensitivity/              the first column's Quick Start picker
     ./quickstart-assumptions/   the table of every figure below, with sources

   A scenario is a CITY and a HOME TYPE. Its form values are resolved in
   three layers, the most specific winning:
     defaults   below: what every scenario shares (frequencies, loan type…)
     city       the city's own loan, tax and market figures
     home       the figures for that home type in that city

   Shape of a city:
     key, city, country, countryId (Indonesian name), countryCode, region,
     aliases (extra words the search matches), currencySymbol (one of the
     SharedCurrency symbols in shared.js), currencyCode (for the record),
     asOf (month of the newest figure, YYYY-MM), buyer (who the figures are for)
     downPaymentPct, mortgageRate, mortgageTerm, riskFreeRate, horizon,
     sellingCostPct, rentFreq, rentInflation, ownOngoingInflation,
     rentOngoingInflation                               (city-wide form values)
     ratePeriods   optional: the loan's rate by mortgage year, as the
                   calculator's Detailed mortgage mode takes it, for a market
                   whose loans really are staged (a promo or fixed period, then
                   a floating or refixed rate). [{toYear, type:"fixed", rate} or
                   {toYear, type:"floating", rateMin, rateMax}], the last period
                   ending at the term. A scenario with one opens in Detailed
                   mode; mortgageRate is then the schedule's average over the
                   term (floating periods at their middle), the rate Simple
                   mode falls back to. Markets that fix for the whole term, or
                   float with no sourced range, keep the one rate.
     homes:        { <type key>: home }    the types that exist in this market
     unavailable:  { <type key>: reason }  the types that do not, and why
     notes:        { <field or topic>: one sentence on where it comes from }
     sources:      [ { name, url } ]
   Shape of a home:
     propertyPrice, rentAmount (per the city's rentFreq), houseGrowth (%/yr),
     setupCost (% of THIS price: progressive duty differs by price),
     ownOngoingCost, rentOngoingCost (per year), sqm (internal floor area),
     landSqm (houses), where, setupCalc and costCalc (the arithmetic), and
     optional sources. Any city-wide form value may be overridden on a home.

   Every type key appears once per city, in homes or in unavailable, so the
   assumptions page can say why a type is missing rather than leave a gap.
   rentvsownhouse/_audit/quickstart-data.mjs holds the data to these rules.
   ────────────────────────────────────────────────────────────────────────── */
window.RVO_QUICKSTART = {
  asOf: "2026-10",

  // Form values every scenario shares unless a city or home says otherwise.
  defaults: {
    downPaymentPct: 20, mortgageTerm: 30, horizon: 30,
    mortgageType: 'pi', costInterestOnly: true,
    setupCostType: 'pct',
    ownOngoingCostFreq: 'yearly', ownOngoingCostType: 'dollar',
    rentFreq: 'monthly',
    rentOngoingCostFreq: 'yearly', rentOngoingCostType: 'dollar',
    monthlyBudget: 0, monthlyBudgetIncrease: 0,
    rtbEnabled: false, rtbBuyYear: 5, initialCash: 0
  },

  forms: {
    apartment: { en: 'Apartment', id: 'Apartemen' },
    house:     { en: 'Landed house', id: 'Rumah tapak' }
  },

  // In the order the pickers list them. label: the option under its form;
  // name: the full name; short: the scenario name on the Sensitivity page.
  types: [
    { key: 'apt-studio',   form: 'apartment', beds: 0,
      label: { en: 'Studio', id: 'Studio' },
      name:  { en: 'Studio apartment', id: 'Apartemen studio' },
      short: { en: 'Studio apartment', id: 'Apartemen studio' } },
    { key: 'apt-1br',      form: 'apartment', beds: 1,
      label: { en: '1 bedroom', id: '1 kamar tidur' },
      name:  { en: '1-bedroom apartment', id: 'Apartemen 1 kamar tidur' },
      short: { en: '1BR apartment', id: 'Apartemen 1KT' } },
    { key: 'apt-2br',      form: 'apartment', beds: 2,
      label: { en: '2 bedrooms', id: '2 kamar tidur' },
      name:  { en: '2-bedroom apartment', id: 'Apartemen 2 kamar tidur' },
      short: { en: '2BR apartment', id: 'Apartemen 2KT' } },
    { key: 'apt-4br',      form: 'apartment', beds: 4,
      label: { en: '4 bedrooms', id: '4 kamar tidur' },
      name:  { en: '4-bedroom apartment', id: 'Apartemen 4 kamar tidur' },
      short: { en: '4BR apartment', id: 'Apartemen 4KT' } },
    { key: 'house-studio', form: 'house', beds: 0,
      label: { en: 'Studio', id: 'Studio' },
      name:  { en: 'Studio landed house', id: 'Rumah tapak studio' },
      short: { en: 'Studio house', id: 'Rumah studio' } },
    { key: 'house-1br',    form: 'house', beds: 1,
      label: { en: '1 bedroom', id: '1 kamar tidur' },
      name:  { en: '1-bedroom landed house', id: 'Rumah tapak 1 kamar tidur' },
      short: { en: '1BR house', id: 'Rumah 1KT' } },
    { key: 'house-2br',    form: 'house', beds: 2,
      label: { en: '2 bedrooms', id: '2 kamar tidur' },
      name:  { en: '2-bedroom landed house', id: 'Rumah tapak 2 kamar tidur' },
      short: { en: '2BR house', id: 'Rumah 2KT' } },
    { key: 'house-4br',    form: 'house', beds: 4,
      label: { en: '4 bedrooms', id: '4 kamar tidur' },
      name:  { en: '4-bedroom landed house', id: 'Rumah tapak 4 kamar tidur' },
      short: { en: '4BR house', id: 'Rumah 4KT' } }
  ],

  cities: [
    {
      key: "perth", city: "Perth", country: "Australia", countryId: "Australia", countryCode: "AU", region: "Oceania",
      aliases: ["WA","Western Australia"],
      currencySymbol: "$", currencyCode: "AUD", asOf: "2026-09",
      buyer: "Australian resident owner-occupier buying a first home to live in, at standard WA general duty rates (no first home owner rate or grant)",
      downPaymentPct: 20, mortgageRate: 6.4, mortgageTerm: 30, riskFreeRate: 4.6, horizon: 30, sellingCostPct: 2.5,
      rentFreq: "weekly", rentInflation: 3.5, ownOngoingInflation: 2.5, rentOngoingInflation: 2.5,
      homes: {
        "apt-1br": {
          propertyPrice: 550000, rentAmount: 650, houseGrowth: 4.5, setupCost: 4.27, ownOngoingCost: 6900, rentOngoingCost: 1000, sqm: 55,
          where: "Inner city units: Perth CBD, East Perth, West Perth, Northbridge, Mount Lawley. REIWA 1BR medians $498k to $566k, rents $562 to $695/wk",
          setupCalc: "WA duty on $550k: $11,115 + 4.75% x $190,000 = $20,140; Landgate transfer ~$339 + mortgage $225; other costs $2,800 (legal/conveyancing ~$2,000, building or strata report ~$500, bank and settlement fees ~$300); total $23,504 = 4.27% (estimate, not sourced)",
          costCalc: "Strata $3,600 + council rates $1,600 + water/sewer service charges $1,100 + ESL $150 + upkeep $450 = $6,900/yr; renter: contents $350 + moving $650 = $1,000/yr (estimate, not sourced)",
          sources: [
            { name: "REIWA suburb profile, Perth (Landgate/REIWA medians by bedroom, 12 months to Sep 2026)", url: "https://reiwa.com.au/suburb/perth/" },
            { name: "REIWA suburb profile, East Perth (12 months to Sep 2026)", url: "https://reiwa.com.au/suburb/east-perth/" }
          ]
        },
        "apt-2br": {
          propertyPrice: 715000, rentAmount: 810, houseGrowth: 4.5, setupCost: 4.39, ownOngoingCost: 8500, rentOngoingCost: 1200, sqm: 85,
          where: "Inner city units: Perth CBD, East Perth, West Perth, Northbridge, Subiaco, Mount Lawley. REIWA 2BR medians $655k to $884k (middle ~$715k), rents $690 to $850/wk",
          setupCalc: "WA duty on $715k: $11,115 + 4.75% x $355,000 = $27,978; Landgate transfer ~$381 + mortgage $225; other costs $2,800 (legal/conveyancing ~$2,000, building or strata report ~$500, bank and settlement fees ~$300); total $31,384 = 4.39% (estimate, not sourced)",
          costCalc: "Strata $4,500 + council rates $1,900 + water/sewer service charges $1,300 + ESL $200 + upkeep $600 = $8,500/yr; renter: contents $400 + moving $800 = $1,200/yr (estimate, not sourced)",
          sources: [
            { name: "REIWA suburb profile, Perth (Landgate/REIWA medians by bedroom, 12 months to Sep 2026)", url: "https://reiwa.com.au/suburb/perth/" },
            { name: "REIWA suburb profile, East Perth (12 months to Sep 2026)", url: "https://reiwa.com.au/suburb/east-perth/" },
            { name: "REIWA suburb profile, Subiaco (12 months to Sep 2026)", url: "https://reiwa.com.au/suburb/subiaco/" }
          ]
        },
        "house-2br": {
          propertyPrice: 855000, rentAmount: 650, houseGrowth: 5, setupCost: 4.51, ownOngoingCost: 7900, rentOngoingCost: 1400, sqm: 100, landSqm: 400,
          where: "Middle-ring older cottages, duplex halves and villas: Morley, Dianella, Bentley, Rivervale, Innaloo, Bassendean, Kardinya. REIWA 2BR house medians $673k to $960k, rents $530 to $745/wk. Rent is below the inner-city 2BR unit because these are older homes further from the CBD",
          setupCalc: "WA duty on $855k: $28,453 + 5.15% x $130,000 = $35,148; Landgate transfer ~$402 + mortgage $225; other costs $2,800 (legal/conveyancing ~$2,000, building or strata report ~$500, bank and settlement fees ~$300); total $38,575 = 4.51% (estimate, not sourced)",
          costCalc: "Council rates $2,000 + water/sewer service charges $1,500 + ESL $250 + building insurance $1,650 + maintenance $2,500 = $7,900/yr; renter: contents $500 + moving $900 = $1,400/yr (estimate, not sourced)",
          sources: [
            { name: "REIWA suburb profile, Morley (12 months to Sep 2026)", url: "https://reiwa.com.au/suburb/morley/" },
            { name: "REIWA suburb profile, Dianella (12 months to Sep 2026)", url: "https://reiwa.com.au/suburb/dianella/" },
            { name: "REIWA suburb profile, Kardinya (12 months to Sep 2026)", url: "https://reiwa.com.au/suburb/kardinya/" }
          ]
        },
        "house-4br": {
          propertyPrice: 1350000, rentAmount: 950, houseGrowth: 5, setupCost: 4.75, ownOngoingCost: 10600, rentOngoingCost: 1800, sqm: 200, landSqm: 650,
          where: "Middle-ring family suburbs: Morley, Dianella, Balcatta, Kardinya, Kingsley, Bassendean, Bayswater, Duncraig, Willetton. REIWA 4BR house medians $1.10M to $1.66M, rents $830 to $1,025/wk",
          setupCalc: "WA duty on $1.35M: $28,453 + 5.15% x $625,000 = $60,641; Landgate transfer ~$506 + mortgage $225; other costs $2,800 (legal/conveyancing ~$2,000, building or strata report ~$500, bank and settlement fees ~$300); total $64,172 = 4.75% (estimate, not sourced)",
          costCalc: "Council rates $2,400 + water/sewer service charges $1,800 + ESL $350 + building insurance $2,050 + maintenance $4,000 = $10,600/yr; renter: contents $600 + moving $1,200 = $1,800/yr (estimate, not sourced)",
          sources: [
            { name: "REIWA suburb profile, Morley (12 months to Sep 2026)", url: "https://reiwa.com.au/suburb/morley/" },
            { name: "REIWA suburb profile, Dianella (12 months to Sep 2026)", url: "https://reiwa.com.au/suburb/dianella/" },
            { name: "REIWA suburb profile, Kardinya (12 months to Sep 2026)", url: "https://reiwa.com.au/suburb/kardinya/" }
          ]
        }
      },
      unavailable: {
        "apt-studio": "Studios are a thin niche in Perth: REIWA does not report them as a segment, and most are small CBD units under about 40 m2 that many lenders restrict.",
        "apt-4br": "Perth unit stock tops out at 3 bedrooms (REIWA reports no 4-bedroom unit medians); 4-bedroom apartments are rare penthouses.",
        "house-studio": "Houses without a bedroom do not exist as a market segment in Perth.",
        "house-1br": "1-bedroom houses are a rarity in Perth: REIWA reports house medians only from 2 bedrooms, and granny flats sit on the main house's title."
      },
      notes: {
        market: "Perth is a house-led market where units are a minority of stock. REIWA medians rose about 17% for houses and 22% for units in the year to Sep 2026.",
        downPaymentPct: "A 20% deposit is the standard for an owner-occupier loan without lenders mortgage insurance (LMI).",
        mortgageRate: "RBA F6: new owner-occupier variable loans averaged about 6.2% in Aug 2026. The 30 Sep 2026 cash rate rise to 4.60% was passed on in full, so about 6.4%.",
        riskFreeRate: "RBA cash rate 4.60% from 30 Sep 2026. RBA F4 (Sep 2026): bonus savings accounts 4.80%, 3-year term deposits 4.20%, 3-month bank bills 4.67%.",
        sellingCostPct: "Agent commission of about 2% plus GST, marketing and conveyancing. No capital gains tax on a main residence (estimate, not sourced).",
        rentInflation: "SQM: Perth asking rents rose 6.8% (units) to 7.5% (houses) a year over 10 years after a vacancy squeeze. Tempered to 3.5% for the long run.",
        houseGrowth: "ABS index 2005 to 2016 chained with REIWA medians 2016 to 2026: houses about 5.1%/yr, units 4.3 (REIWA) to 4.9%/yr (SQM). Forward: houses 5.0%, units 4.5%.",
        setupCost: "WA general transfer duty rates (no first home owner rate), Landgate 2026-27 transfer and mortgage fees, plus about $2,800 legal, inspection and bank costs (estimate, not sourced).",
        ownOngoingCost: "Strata levies, council rates, Water Corporation service charges, emergency services levy, building insurance and upkeep. No land tax on a home (estimate, not sourced).",
        rentOngoingCost: "Contents insurance plus removalist, cleaning and reconnection costs spread over a typical 3-year lease. Tenants pay no letting fee (estimate, not sourced).",
        caveat: "WA first home buyers pay no duty up to $600k (from 7 May 2026); that and first home grants are excluded. Variable rates follow the RBA, which lifted rates four times in 2026."
      },
      sources: [
        { name: "REIWA suburb profile, Perth (Landgate/REIWA medians by bedroom, 12 months to Sep 2026)", url: "https://reiwa.com.au/suburb/perth/" },
        { name: "REIWA suburb profile, Subiaco (12 months to Sep 2026)", url: "https://reiwa.com.au/suburb/subiaco/" },
        { name: "WA Department of Finance, transfer duty general rates", url: "https://www.wa.gov.au/organisation/department-of-finance/transfer-duty-assessment" },
        { name: "Landgate, 2026-27 fee increase notice", url: "https://www.landgate.wa.gov.au/about-us/customer-news-and-media/news-and-media-articles/2026/may/customer-update-publication-of-2026-27-landgate-fees-increase/" },
        { name: "RBA F6 Housing lending rates (new owner-occupier variable loans, Aug 2026)", url: "https://www.rba.gov.au/statistics/tables/csv/f6-data.csv" },
        { name: "RBA F4 Retail deposit and investment rates (Sep 2026)", url: "https://www.rba.gov.au/statistics/tables/csv/f4-data.csv" },
        { name: "SQM Research weekly asking rents, Perth, Oct 2026", url: "https://sqmresearch.com.au/weekly-rents.php?region=wa-Perth&type=c&t=1" },
        { name: "SQM Research asking prices, Perth, Oct 2026 (10-year change)", url: "https://sqmresearch.com.au/asking-property-prices.php?region=wa-Perth&type=c&t=1" },
        { name: "ABS Residential Property Price Indexes, attached dwellings (to Dec 2021)", url: "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/residential-property-price-indexes-eight-capital-cities/dec-2021/641603.xlsx" },
        { name: "ABS Residential Property Price Indexes, established houses (to Dec 2021)", url: "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/residential-property-price-indexes-eight-capital-cities/dec-2021/641602.xlsx" }
      ]
    },
    {
      key: "melbourne", city: "Melbourne", country: "Australia", countryId: "Australia", countryCode: "AU", region: "Oceania",
      aliases: ["VIC","Victoria"],
      currencySymbol: "$", currencyCode: "AUD", asOf: "2026-10",
      buyer: "Australian resident owner-occupier buying a first home to live in, at standard VIC duty rates (owner-occupier PPR rate only applies up to $550k; no first home concession or grant)",
      downPaymentPct: 20, mortgageRate: 6.4, mortgageTerm: 30, riskFreeRate: 4.6, horizon: 30, sellingCostPct: 2.5,
      rentFreq: "weekly", rentInflation: 3.5, ownOngoingInflation: 2.5, rentOngoingInflation: 2.5,
      homes: {
        "apt-1br": {
          propertyPrice: 490000, rentAmount: 550, houseGrowth: 3, setupCost: 5.22, ownOngoingCost: 7200, rentOngoingCost: 1000, sqm: 50,
          where: "Inner suburbs: Richmond, South Yarra, Prahran, Collingwood, Fitzroy. Derived: Cotality all-unit median ~$625k x 0.78 (REIWA 1BR ratio); all-unit rents $625 to $660 (Cotality, SQM asking) x 0.86 = about $540 to $570",
          setupCalc: "VIC PPR rate on $490k: $18,370 + 6% x $50,000 = $21,370 (general rate would be $24,470); LSV transfer $104.30 + $2.34 x 490 = $1,251; mortgage registration ~$135; other costs $2,800 (legal/conveyancing ~$2,000, building or strata report ~$500, bank and settlement fees ~$300); total $25,556 = 5.22% (estimate, not sourced)",
          costCalc: "Owners corporation $4,000 + council rates $1,400 + ESVF levy $180 + water/sewer service $900 + upkeep $720 = $7,200/yr; renter: contents $350 + moving $650 = $1,000/yr (estimate, not sourced)",
          sources: [
            { name: "YIP suburb data (Cotality), Richmond VIC: unit median $633k, house median $1.35M", url: "https://www.yourinvestmentpropertymag.com.au/top-suburbs/vic/3121-richmond" },
            { name: "YIP suburb data (Cotality), South Yarra VIC: unit median $525k", url: "https://www.yourinvestmentpropertymag.com.au/top-suburbs/vic/3141-south-yarra" },
            { name: "YIP suburb data (Cotality), Fitzroy VIC: unit median $805k", url: "https://www.yourinvestmentpropertymag.com.au/top-suburbs/vic/3065-fitzroy" },
            { name: "REIWA suburb profiles (bedroom-to-median ratios used for derivation)", url: "https://reiwa.com.au/suburb/perth/" }
          ]
        },
        "apt-2br": {
          propertyPrice: 700000, rentAmount: 720, houseGrowth: 3, setupCost: 5.96, ownOngoingCost: 9500, rentOngoingCost: 1200, sqm: 75,
          where: "Inner suburbs: Richmond, South Yarra, Prahran, Collingwood, Fitzroy. Derived: Cotality all-unit medians $500k to $805k (middle $625k) x 1.12 for 2BR; SQM 2BR asking rents $697 to $891/wk (median $749), set a little below asking",
          setupCalc: "VIC general duty on $700k: $2,870 + 6% x $570,000 = $37,070; LSV transfer $104.30 + $2.34 x 700 = $1,743; mortgage registration ~$135; other costs $2,800 (legal/conveyancing ~$2,000, building or strata report ~$500, bank and settlement fees ~$300); total $41,748 = 5.96% (estimate, not sourced)",
          costCalc: "Owners corporation $5,500 + council rates $1,800 + ESVF levy $200 + water/sewer service $1,000 + upkeep $1,000 = $9,500/yr; renter: contents $400 + moving $800 = $1,200/yr (estimate, not sourced)",
          sources: [
            { name: "YIP suburb data (Cotality), Richmond VIC: unit median $633k, house median $1.35M", url: "https://www.yourinvestmentpropertymag.com.au/top-suburbs/vic/3121-richmond" },
            { name: "YIP suburb data (Cotality), South Yarra VIC: unit median $525k", url: "https://www.yourinvestmentpropertymag.com.au/top-suburbs/vic/3141-south-yarra" },
            { name: "YIP suburb data (Cotality), Fitzroy VIC: unit median $805k", url: "https://www.yourinvestmentpropertymag.com.au/top-suburbs/vic/3065-fitzroy" },
            { name: "SQM Research asking rents, postcode 3121 Richmond (2BR units $749/wk), Oct 2026", url: "https://sqmresearch.com.au/weekly-rents.php?postcode=3121&t=1" },
            { name: "SQM Research asking rents, postcode 3141 South Yarra (2BR units $740/wk), Oct 2026", url: "https://sqmresearch.com.au/weekly-rents.php?postcode=3141&t=1" }
          ]
        },
        "house-2br": {
          propertyPrice: 1080000, rentAmount: 650, houseGrowth: 4.5, setupCost: 6.02, ownOngoingCost: 7600, rentOngoingCost: 1400, sqm: 100, landSqm: 250,
          where: "Victorian and Edwardian workers' cottages: Richmond, Brunswick, Collingwood, Coburg, Yarraville. Derived: Cotality house median ~$1.30M x 0.83 (REIWA 2BR ratio); rent: house rents $800 to $835 x 0.80. Rent is below the inner-city 2BR unit, which is newer and closer to the CBD",
          setupCalc: "VIC general duty on $1.08M: 5.5% x $1,080,000 = $59,400; LSV transfer $104.30 + $2.34 x 1,080 = $2,632; mortgage registration ~$135; other costs $2,800 (legal/conveyancing ~$2,000, building or strata report ~$500, bank and settlement fees ~$300); total $64,967 = 6.02% (estimate, not sourced)",
          costCalc: "Council rates $2,200 + ESVF levy $250 + water/sewer service $1,000 + building insurance $1,650 + maintenance $2,500 = $7,600/yr; renter: contents $500 + moving $900 = $1,400/yr (estimate, not sourced)",
          sources: [
            { name: "YIP suburb data (Cotality), Brunswick VIC: house median $1.30M", url: "https://www.yourinvestmentpropertymag.com.au/top-suburbs/vic/3056-brunswick" },
            { name: "YIP suburb data (Cotality), Collingwood VIC: house median $1.31M", url: "https://www.yourinvestmentpropertymag.com.au/top-suburbs/vic/3066-collingwood" },
            { name: "REIWA suburb profiles (bedroom-to-median ratios used for derivation)", url: "https://reiwa.com.au/suburb/perth/" }
          ]
        },
        "house-4br": {
          propertyPrice: 1400000, rentAmount: 770, houseGrowth: 4.5, setupCost: 5.95, ownOngoingCost: 9800, rentOngoingCost: 1800, sqm: 200, landSqm: 650,
          where: "Middle-ring suburbs: Reservoir, Bundoora, Keilor East, Ringwood, Mitcham, Doncaster, Glen Waverley, Bentleigh East. Derived: Cotality house medians $905k to $1.74M (middle ~$1.21M) x 1.14 (REIWA 4BR ratio); rent: Cotality house rents ~$675 x 1.14",
          setupCalc: "VIC general duty on $1.4M: 5.5% x $1,400,000 = $77,000; LSV transfer $104.30 + $2.34 x 1,400 = $3,381; mortgage registration ~$135; other costs $2,800 (legal/conveyancing ~$2,000, building or strata report ~$500, bank and settlement fees ~$300); total $83,316 = 5.95% (estimate, not sourced)",
          costCalc: "Council rates $2,400 + ESVF levy $260 + water/sewer service $1,100 + building insurance $2,040 + maintenance $4,000 = $9,800/yr; renter: contents $600 + moving $1,200 = $1,800/yr (estimate, not sourced)",
          sources: [
            { name: "YIP suburb data (Cotality), Doncaster VIC: house median $1.54M", url: "https://www.yourinvestmentpropertymag.com.au/top-suburbs/vic/3108-doncaster" },
            { name: "YIP suburb data (Cotality), Reservoir VIC: house median $960k", url: "https://www.yourinvestmentpropertymag.com.au/top-suburbs/vic/3073-reservoir" },
            { name: "YIP suburb data (Cotality), Mitcham VIC: house median $1.27M", url: "https://www.yourinvestmentpropertymag.com.au/top-suburbs/vic/3132-mitcham" },
            { name: "REIWA suburb profiles (bedroom-to-median ratios used for derivation)", url: "https://reiwa.com.au/suburb/perth/" }
          ]
        }
      },
      unavailable: {
        "apt-studio": "Melbourne studios are mostly small post-2000 CBD and student units under about 40 m2 that most lenders restrict or decline, so a normal 80% loan is not typical.",
        "apt-4br": "4-bedroom apartments are rare in Melbourne, mostly luxury penthouses; families buy houses or townhouses, so no typical price or rent exists.",
        "house-studio": "Houses without a bedroom do not exist as a market segment in Melbourne.",
        "house-1br": "1-bedroom houses are a rarity in Melbourne (a few tiny cottages); granny flats sit on the main house's title and cannot normally be sold separately."
      },
      notes: {
        market: "Melbourne houses fell 3.1% in the June 2026 quarter to a $1.04M median (Domain). Inner-city units have barely grown in a decade, so rents rose faster than prices.",
        downPaymentPct: "A 20% deposit is the standard for an owner-occupier loan without lenders mortgage insurance (LMI).",
        mortgageRate: "RBA F6: new owner-occupier variable loans averaged about 6.2% in Aug 2026. The 30 Sep 2026 cash rate rise to 4.60% was passed on in full, so about 6.4%.",
        riskFreeRate: "RBA cash rate 4.60% from 30 Sep 2026. RBA F4 (Sep 2026): bonus savings accounts 4.80%, 3-year term deposits 4.20%, 3-month bank bills 4.67%.",
        sellingCostPct: "Agent commission of about 2% plus GST, marketing and conveyancing. No capital gains tax on a main residence (estimate, not sourced).",
        rentInflation: "SQM: Melbourne asking rents rose about 5.0% a year over 10 years (units 4.6%, houses 5.4%), mostly after 2021. Tempered to 3.5% for the long run.",
        houseGrowth: "ABS index 2005 to 2016 chained with SQM 2016 to 2026: houses 6.0 to 6.7%/yr, units 4.2 to 4.8%/yr, but 2BR units only 2.8%/yr in the last decade. Forward: houses 4.5%, units 3.0%.",
        setupCost: "VIC general land transfer duty (5.5% of the whole price from $960k), owner-occupier PPR rate up to $550k, LSV 2026-27 transfer fee, plus about $2,800 other costs (estimate, not sourced).",
        ownOngoingCost: "Owners corporation fees, council rates, Emergency Services and Volunteers Fund levy, water and sewerage service charges, building insurance and upkeep. No land tax on a home (estimate, not sourced).",
        rentOngoingCost: "Contents insurance plus removalist, cleaning and reconnection costs spread over a typical 3-year lease. Tenants pay no letting fee (estimate, not sourced).",
        caveat: "Prices by bedroom are derived from Cotality suburb medians, because Domain bedroom data could not be accessed. VIC off-the-plan duty concessions are not modelled."
      },
      sources: [
        { name: "YIP suburb data (Cotality), Richmond VIC: unit median $633k, house median $1.35M", url: "https://www.yourinvestmentpropertymag.com.au/top-suburbs/vic/3121-richmond" },
        { name: "SQM Research asking rents, postcode 3121 Richmond (2BR units $749/wk), Oct 2026", url: "https://sqmresearch.com.au/weekly-rents.php?postcode=3121&t=1" },
        { name: "SRO Victoria, general land transfer duty current rates", url: "https://www.sro.vic.gov.au/rates-taxes-duties-and-levies/general-land-transfer-duty-property-current-rates" },
        { name: "SRO Victoria, principal place of residence current rates", url: "https://www.sro.vic.gov.au/rates-taxes-duties-and-levies/principal-place-residence-current-rates" },
        { name: "Land Services Victoria, guide to Transfer of Land Act fees 2026-27", url: "https://www.land.vic.gov.au/__data/assets/word_doc/0034/773197/guide-to-transfer-of-land-act-fees-2026-2027.docx" },
        { name: "RBA F6 Housing lending rates (new owner-occupier variable loans, Aug 2026)", url: "https://www.rba.gov.au/statistics/tables/csv/f6-data.csv" },
        { name: "RBA F4 Retail deposit and investment rates (Sep 2026)", url: "https://www.rba.gov.au/statistics/tables/csv/f4-data.csv" },
        { name: "SQM Research weekly asking rents, Melbourne, Oct 2026", url: "https://sqmresearch.com.au/weekly-rents.php?region=vic-Melbourne&type=c&t=1" },
        { name: "SQM Research asking prices, Melbourne, Oct 2026 (10-year change)", url: "https://sqmresearch.com.au/asking-property-prices.php?region=vic-Melbourne&type=c&t=1" },
        { name: "ABS Residential Property Price Indexes, attached dwellings (to Dec 2021)", url: "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/residential-property-price-indexes-eight-capital-cities/dec-2021/641603.xlsx" }
      ]
    },
    {
      key: "sydney", city: "Sydney", country: "Australia", countryId: "Australia", countryCode: "AU", region: "Oceania",
      aliases: ["NSW","New South Wales"],
      currencySymbol: "$", currencyCode: "AUD", asOf: "2026-06",
      buyer: "Australian resident owner-occupier buying a first home to live in, at NSW general transfer duty rates (no First Home Buyers Assistance concession or grant)",
      downPaymentPct: 20, mortgageRate: 6.4, mortgageTerm: 30, riskFreeRate: 4.6, horizon: 30, sellingCostPct: 2.5,
      rentFreq: "weekly", rentInflation: 3.5, ownOngoingInflation: 2.5, rentOngoingInflation: 2.5,
      homes: {
        "apt-studio": {
          propertyPrice: 530000, rentAmount: 550, houseGrowth: 3.5, setupCost: 4, ownOngoingCost: 6000, rentOngoingCost: 900, sqm: 35,
          where: "Inner-east art-deco and 1960s studios: Potts Point, Elizabeth Bay, Darlinghurst. Price derived: ~35 m2 x ~$15,000/m2 (inner 2BR value per m2), cross-checked with Potts Point unit median $920k x ~0.58; rent from NSW bonds (bedsitters, 2011 $530, 2010 $563). Some lenders want a bigger deposit under 40 m2 (price estimate, not sourced)",
          setupCalc: "NSW duty on $530k: $11,602 + 4.5% x $143,000 = $18,037; LRS transfer + mortgage $365; other costs $2,800 (legal/conveyancing ~$2,000, building or strata report ~$500, bank and settlement fees ~$300); total $21,202 = 4.00% (estimate, not sourced)",
          costCalc: "Strata $3,600 + council rates $1,100 + Sydney Water service $800 + upkeep $500 = $6,000/yr; renter: contents $300 + moving $600 = $900/yr (estimate, not sourced)",
          sources: [
            { name: "NSW DCJ Rent and Sales Report, rent tables, June quarter 2026 (new bonds by postcode and bedrooms)", url: "https://dcj.nsw.gov.au/content/dam/dcj/dcj-website/documents/about-us/families-and-communities-statistics/housing-and-rent-sales/rent-tables-june-2026-quarter.xlsx" },
            { name: "YIP suburb data (Cotality), Potts Point NSW: unit median $920k", url: "https://www.yourinvestmentpropertymag.com.au/top-suburbs/nsw/2011-potts-point" }
          ]
        },
        "apt-1br": {
          propertyPrice: 800000, rentAmount: 760, houseGrowth: 3.5, setupCost: 4.17, ownOngoingCost: 7800, rentOngoingCost: 1000, sqm: 52,
          where: "Inner suburbs: Surry Hills, Pyrmont, Redfern, Glebe. Price derived: Cotality all-unit medians ~$1.0M x 0.78 (REIWA 1BR ratio), since Domain 1BR data was not accessible; rent from NSW bonds (1BR flats $720 to $780/wk)",
          setupCalc: "NSW duty on $800k: $11,602 + 4.5% x $413,000 = $30,187; LRS transfer + mortgage $365; other costs $2,800 (legal/conveyancing ~$2,000, building or strata report ~$500, bank and settlement fees ~$300); total $33,352 = 4.17% (estimate, not sourced)",
          costCalc: "Strata $5,000 + council rates $1,200 + Sydney Water service $850 + upkeep $750 = $7,800/yr; renter: contents $350 + moving $650 = $1,000/yr (estimate, not sourced)",
          sources: [
            { name: "NSW DCJ Rent and Sales Report, rent tables, June quarter 2026 (new bonds by postcode and bedrooms)", url: "https://dcj.nsw.gov.au/content/dam/dcj/dcj-website/documents/about-us/families-and-communities-statistics/housing-and-rent-sales/rent-tables-june-2026-quarter.xlsx" },
            { name: "YIP suburb data (Cotality), Pyrmont NSW: unit median $1.105M", url: "https://www.yourinvestmentpropertymag.com.au/top-suburbs/nsw/2009-pyrmont" },
            { name: "YIP suburb data (Cotality), Glebe NSW: unit median $1.05M", url: "https://www.yourinvestmentpropertymag.com.au/top-suburbs/nsw/2037-glebe" }
          ]
        },
        "apt-2br": {
          propertyPrice: 1200000, rentAmount: 1075, houseGrowth: 3.5, setupCost: 4.28, ownOngoingCost: 11000, rentOngoingCost: 1200, sqm: 80,
          where: "Inner suburbs: Surry Hills, Pyrmont, Redfern, Glebe. Domain 2BR unit medians about $1.17M to $1.33M; NSW bond medians for 2BR flats $975 to $1,145/wk (Apr to Jun 2026)",
          setupCalc: "NSW duty on $1.2M: $11,602 + 4.5% x $813,000 = $48,187; LRS transfer + mortgage $365; other costs $2,800 (legal/conveyancing ~$2,000, building or strata report ~$500, bank and settlement fees ~$300); total $51,352 = 4.28% (estimate, not sourced)",
          costCalc: "Strata $7,500 + council rates $1,500 + Sydney Water service $1,000 + upkeep $1,000 = $11,000/yr; renter: contents $400 + moving $800 = $1,200/yr (estimate, not sourced)",
          sources: [
            { name: "Domain suburb profile, Surry Hills (2BR unit median $1.333M)", url: "https://domain.com.au/suburb-profile/surry-hills-nsw-2010" },
            { name: "Domain listing insights, Redfern 2BR units (median $1.245M)", url: "https://www.domain.com.au/15-292-296-chalmers-street-redfern-nsw-2016-2020683637" },
            { name: "NSW DCJ Rent and Sales Report, rent tables, June quarter 2026 (new bonds by postcode and bedrooms)", url: "https://dcj.nsw.gov.au/content/dam/dcj/dcj-website/documents/about-us/families-and-communities-statistics/housing-and-rent-sales/rent-tables-june-2026-quarter.xlsx" }
          ]
        },
        "house-2br": {
          propertyPrice: 1700000, rentAmount: 900, houseGrowth: 5, setupCost: 4.59, ownOngoingCost: 8000, rentOngoingCost: 1400, sqm: 100, landSqm: 150,
          where: "Inner-west terraces and semis: Newtown, Marrickville, Erskineville, Leichhardt. Domain 2BR house median in Newtown $1.68M; NSW bond medians for 2BR houses $888 to $935/wk, below inner-city 2BR units, which are newer and closer to the CBD",
          setupCalc: "NSW duty on $1.7M: $52,237 + 5.5% x $410,000 = $74,787; LRS transfer + mortgage $365; other costs $2,800 (legal/conveyancing ~$2,000, building or strata report ~$500, bank and settlement fees ~$300); total $77,952 = 4.59% (estimate, not sourced)",
          costCalc: "Council rates $2,100 + Sydney Water service $1,100 + building insurance $1,800 + maintenance $3,000 = $8,000/yr; renter: contents $500 + moving $900 = $1,400/yr (estimate, not sourced)",
          sources: [
            { name: "Domain listing insights, Newtown 2BR houses (median $1.68M)", url: "https://www.domain.com.au/2-wells-street-newtown-nsw-2042-2020845657" },
            { name: "YIP suburb data (Cotality), Marrickville NSW: house median $2.15M", url: "https://www.yourinvestmentpropertymag.com.au/top-suburbs/nsw/2204-marrickville" },
            { name: "NSW DCJ Rent and Sales Report, rent tables, June quarter 2026 (new bonds by postcode and bedrooms)", url: "https://dcj.nsw.gov.au/content/dam/dcj/dcj-website/documents/about-us/families-and-communities-statistics/housing-and-rent-sales/rent-tables-june-2026-quarter.xlsx" }
          ]
        },
        "house-4br": {
          propertyPrice: 2300000, rentAmount: 1300, houseGrowth: 5, setupCost: 4.82, ownOngoingCost: 10800, rentOngoingCost: 1800, sqm: 200, landSqm: 600,
          where: "Middle-ring suburbs: Ryde, Epping, Carlingford, Baulkham Hills, Sutherland, Miranda, Revesby. Price derived: middle-ring non-strata median $2.04M (NSW Jan to Mar 2026) x 1.14 (REIWA 4BR ratio); rent from NSW bonds (4+ bedroom houses $1,020 to $1,425/wk)",
          setupCalc: "NSW duty on $2.3M: $52,237 + 5.5% x $1,010,000 = $107,787; LRS transfer + mortgage $365; other costs $2,800 (legal/conveyancing ~$2,000, building or strata report ~$500, bank and settlement fees ~$300); total $110,952 = 4.82% (estimate, not sourced)",
          costCalc: "Council rates $2,300 + Sydney Water service $1,100 + building insurance $2,400 + maintenance $5,000 = $10,800/yr; renter: contents $600 + moving $1,200 = $1,800/yr (estimate, not sourced)",
          sources: [
            { name: "NSW DCJ Rent and Sales Report, sales tables, March quarter 2026", url: "https://dcj.nsw.gov.au/content/dam/dcj/dcj-website/documents/about-us/families-and-communities-statistics/housing-and-rent-sales/sales-tables-march-2026-quarter.xlsx" },
            { name: "NSW DCJ Rent and Sales Report, rent tables, June quarter 2026 (new bonds by postcode and bedrooms)", url: "https://dcj.nsw.gov.au/content/dam/dcj/dcj-website/documents/about-us/families-and-communities-statistics/housing-and-rent-sales/rent-tables-june-2026-quarter.xlsx" },
            { name: "YIP suburb data (Cotality), Ryde NSW: house median $2.59M", url: "https://www.yourinvestmentpropertymag.com.au/top-suburbs/nsw/2112-ryde" },
            { name: "YIP suburb data (Cotality), Baulkham Hills NSW: house median $1.97M", url: "https://www.yourinvestmentpropertymag.com.au/top-suburbs/nsw/2153-baulkham-hills" },
            { name: "YIP suburb data (Cotality), Sutherland NSW: house median $1.68M", url: "https://www.yourinvestmentpropertymag.com.au/top-suburbs/nsw/2232-sutherland" }
          ]
        }
      },
      unavailable: {
        "apt-4br": "4-bedroom apartments are rare in Sydney: only about 0.6% of rented Greater Sydney flats (2,098 of 350,000 bonds held, June 2026) have 4+ bedrooms, mostly penthouses.",
        "house-studio": "Houses without a bedroom do not exist as a market segment in Sydney.",
        "house-1br": "1-bedroom houses are rare as stand-alone titles in Sydney; most 1-bedroom dwellings on house blocks are granny flats, which cannot be subdivided from the main house's title."
      },
      notes: {
        market: "Australia's priciest market. NSW sales data, Jan to Mar 2026: Greater Sydney median $1.55M for houses (non-strata) and $855k for strata units.",
        downPaymentPct: "A 20% deposit is the standard for an owner-occupier loan without lenders mortgage insurance (LMI).",
        mortgageRate: "RBA F6: new owner-occupier variable loans averaged about 6.2% in Aug 2026. The 30 Sep 2026 cash rate rise to 4.60% was passed on in full, so about 6.4%.",
        riskFreeRate: "RBA cash rate 4.60% from 30 Sep 2026. RBA F4 (Sep 2026): bonus savings accounts 4.80%, 3-year term deposits 4.20%, 3-month bank bills 4.67%.",
        sellingCostPct: "Agent commission of about 2% plus GST, marketing and conveyancing. No capital gains tax on a main residence (estimate, not sourced).",
        rentInflation: "SQM: Sydney asking rents rose 3.9% (units) to 4.8% (houses) a year over 10 years. Long-run assumption 3.5%.",
        houseGrowth: "ABS index 2005 to 2016 chained with SQM 2016 to 2026: houses 6.0 to 6.4%/yr, units 4.3 to 4.6%/yr (only 2.5 to 3.0%/yr in the last decade). Forward: houses 5.0%, units 3.5%.",
        setupCost: "NSW 2026-27 general transfer duty ($11,602 + 4.5% from $387k; $52,237 + 5.5% from $1.29M), NSW LRS transfer and mortgage fees $182.73 each, plus about $2,800 other costs (estimate, not sourced).",
        ownOngoingCost: "Strata levies, council rates and waste charge, Sydney Water service charges, building insurance and upkeep. No land tax on a home (estimate, not sourced).",
        rentOngoingCost: "Contents insurance plus removalist, cleaning and reconnection costs spread over a typical 3-year lease. Tenants pay no letting fee (estimate, not sourced).",
        caveat: "NSW first home buyer duty exemptions and concessions are excluded. Some prices are derived from suburb medians because Domain bedroom data was only partly accessible."
      },
      sources: [
        { name: "NSW DCJ Rent and Sales Report, rent tables, June quarter 2026 (new bonds by postcode and bedrooms)", url: "https://dcj.nsw.gov.au/content/dam/dcj/dcj-website/documents/about-us/families-and-communities-statistics/housing-and-rent-sales/rent-tables-june-2026-quarter.xlsx" },
        { name: "NSW DCJ Rent and Sales Report, sales tables, March quarter 2026", url: "https://dcj.nsw.gov.au/content/dam/dcj/dcj-website/documents/about-us/families-and-communities-statistics/housing-and-rent-sales/sales-tables-march-2026-quarter.xlsx" },
        { name: "Revenue NSW, current thresholds and rates 2026-27", url: "https://www.revenue.nsw.gov.au/_resources/duties-links/current-thresholds-and-rates" },
        { name: "NSW Land Registry Services, fees 2026-27", url: "https://nswlrs.com.au/assets/f/1129775276948026/x/5fed3e7cd6/2026-2027_nsw-lrs-fees_final.pdf" },
        { name: "Domain suburb profile, Surry Hills (2BR unit median $1.333M)", url: "https://domain.com.au/suburb-profile/surry-hills-nsw-2010" },
        { name: "RBA F6 Housing lending rates (new owner-occupier variable loans, Aug 2026)", url: "https://www.rba.gov.au/statistics/tables/csv/f6-data.csv" },
        { name: "RBA F4 Retail deposit and investment rates (Sep 2026)", url: "https://www.rba.gov.au/statistics/tables/csv/f4-data.csv" },
        { name: "SQM Research weekly asking rents, Sydney, Oct 2026", url: "https://sqmresearch.com.au/weekly-rents.php?region=nsw-Sydney&type=c&t=1" },
        { name: "SQM Research asking prices, Sydney, Oct 2026 (10-year change)", url: "https://sqmresearch.com.au/asking-property-prices.php?region=nsw-Sydney&type=c&t=1" },
        { name: "ABS Residential Property Price Indexes, attached dwellings (to Dec 2021)", url: "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/residential-property-price-indexes-eight-capital-cities/dec-2021/641603.xlsx" }
      ]
    },
    {
      key: "brisbane", city: "Brisbane", country: "Australia", countryId: "Australia", countryCode: "AU", region: "Oceania",
      aliases: ["QLD","Queensland"],
      currencySymbol: "$", currencyCode: "AUD", asOf: "2026-06",
      buyer: "Australian citizen owner-occupier buying a first home to live in, at the QLD home concession rate that any owner-occupier gets (no first home concession or grant)",
      downPaymentPct: 20, mortgageRate: 6.4, mortgageTerm: 30, riskFreeRate: 4.6, horizon: 30, sellingCostPct: 2.5,
      rentFreq: "weekly", rentInflation: 3.5, ownOngoingInflation: 2.5, rentOngoingInflation: 2.5,
      homes: {
        "apt-1br": {
          propertyPrice: 610000, rentAmount: 600, houseGrowth: 4.5, setupCost: 3.05, ownOngoingCost: 7500, rentOngoingCost: 1000, sqm: 55,
          where: "Inner city: Brisbane City, South Brisbane, Kangaroo Point, Fortitude Valley, Newstead, Woolloongabba, Toowong. Price derived: Cotality all-unit median ~$785k x 0.78 (REIWA 1BR ratio); rent from RTA 1-bed flats $550 to $660/wk",
          setupCalc: "QLD home concession duty on $610k: $10,150 + 4.5% x $70,000 = $13,300 (general rate $20,475); Titles Qld transfer $2,250 + mortgage $248; other costs $2,800 (legal/conveyancing ~$2,000, building or strata report ~$500, bank and settlement fees ~$300); total $18,598 = 3.05% (estimate, not sourced)",
          costCalc: "Body corporate $4,000 + council rates $1,800 + water/sewer fixed charges $1,100 + upkeep $600 = $7,500/yr; renter: contents $350 + moving $650 = $1,000/yr (estimate, not sourced)",
          sources: [
            { name: "YIP suburb data (Cotality), South Brisbane QLD: unit median $775k", url: "https://www.yourinvestmentpropertymag.com.au/top-suburbs/qld/4101-south-brisbane" },
            { name: "YIP suburb data (Cotality), Kangaroo Point QLD: unit median $875k", url: "https://www.yourinvestmentpropertymag.com.au/top-suburbs/qld/4169-kangaroo-point" },
            { name: "YIP suburb data (Cotality), Fortitude Valley QLD: unit median $685k", url: "https://www.yourinvestmentpropertymag.com.au/top-suburbs/qld/4006-fortitude-valley" },
            { name: "RTA Queensland median rents by postcode and bedrooms, June quarter 2026", url: "https://www.rta.qld.gov.au/sites/default/files/2023-04/rta-bond-statistics.xlsx" },
            { name: "REIWA suburb profiles (bedroom-to-median ratios used for derivation)", url: "https://reiwa.com.au/suburb/perth/" }
          ]
        },
        "apt-2br": {
          propertyPrice: 820000, rentAmount: 800, houseGrowth: 4.5, setupCost: 3.54, ownOngoingCost: 9400, rentOngoingCost: 1200, sqm: 85,
          where: "Inner city: Brisbane City, South Brisbane, Kangaroo Point, Fortitude Valley, Newstead, Woolloongabba, Toowong. Price derived: Cotality all-unit medians $685k to $950k (middle ~$785k) x 1.04 (REIWA 2BR ratio); rent from RTA 2-bed flats $720 to $850/wk",
          setupCalc: "QLD home concession duty on $820k: $10,150 + 4.5% x $280,000 = $22,750 (general rate $29,925); Titles Qld transfer $3,228 + mortgage $248; other costs $2,800 (legal/conveyancing ~$2,000, building or strata report ~$500, bank and settlement fees ~$300); total $29,026 = 3.54% (estimate, not sourced)",
          costCalc: "Body corporate $5,500 + council rates $2,000 + water/sewer fixed charges $1,100 + upkeep $800 = $9,400/yr; renter: contents $400 + moving $800 = $1,200/yr (estimate, not sourced)",
          sources: [
            { name: "YIP suburb data (Cotality), South Brisbane QLD: unit median $775k", url: "https://www.yourinvestmentpropertymag.com.au/top-suburbs/qld/4101-south-brisbane" },
            { name: "YIP suburb data (Cotality), Kangaroo Point QLD: unit median $875k", url: "https://www.yourinvestmentpropertymag.com.au/top-suburbs/qld/4169-kangaroo-point" },
            { name: "YIP suburb data (Cotality), Fortitude Valley QLD: unit median $685k", url: "https://www.yourinvestmentpropertymag.com.au/top-suburbs/qld/4006-fortitude-valley" },
            { name: "RTA Queensland median rents by postcode and bedrooms, June quarter 2026", url: "https://www.rta.qld.gov.au/sites/default/files/2023-04/rta-bond-statistics.xlsx" }
          ]
        },
        "house-2br": {
          propertyPrice: 1300000, rentAmount: 670, houseGrowth: 5.5, setupCost: 4.35, ownOngoingCost: 8700, rentOngoingCost: 1400, sqm: 100, landSqm: 405,
          where: "Inner-ring workers' cottages: Annerley, Wooloowin, Windsor, Kedron, Holland Park, Morningside, Nundah. Price derived: Cotality house median ~$1.56M x 0.83 (REIWA 2BR ratio); rent from RTA 2-bed houses $645 to $710/wk, below inner-city 2BR units, which are newer and closer to the CBD",
          setupCalc: "QLD home concession duty on $1.3M: $30,850 + 5.75% x $300,000 = $48,100 (general rate $55,275); Titles Qld transfer $5,463 + mortgage $248; other costs $2,800 (legal/conveyancing ~$2,000, building or strata report ~$500, bank and settlement fees ~$300); total $56,611 = 4.35% (estimate, not sourced)",
          costCalc: "Council rates $3,000 + water/sewer fixed charges $1,200 + building insurance $2,000 + maintenance $2,500 = $8,700/yr; renter: contents $500 + moving $900 = $1,400/yr (estimate, not sourced)",
          sources: [
            { name: "YIP suburb data (Cotality), Annerley QLD: house median $1.42M", url: "https://www.yourinvestmentpropertymag.com.au/top-suburbs/qld/4103-annerley" },
            { name: "YIP suburb data (Cotality), Wooloowin QLD: house median $1.56M", url: "https://www.yourinvestmentpropertymag.com.au/top-suburbs/qld/4030-wooloowin" },
            { name: "RTA Queensland median rents by postcode and bedrooms, June quarter 2026", url: "https://www.rta.qld.gov.au/sites/default/files/2023-04/rta-bond-statistics.xlsx" },
            { name: "REIWA suburb profiles (bedroom-to-median ratios used for derivation)", url: "https://reiwa.com.au/suburb/perth/" }
          ]
        },
        "house-4br": {
          propertyPrice: 1600000, rentAmount: 820, houseGrowth: 5.5, setupCost: 4.7, ownOngoingCost: 11000, rentOngoingCost: 1800, sqm: 210, landSqm: 600,
          where: "Middle-ring suburbs: Carina, Carindale, Stafford, Everton Park, Aspley, Mount Gravatt East, Sunnybank, Eight Mile Plains, Kenmore. Price derived: Cotality house median ~$1.42M x 1.14 (REIWA 4BR ratio); rent from RTA 4-bed houses $780 to $980/wk",
          setupCalc: "QLD home concession duty on $1.6M: $30,850 + 5.75% x $600,000 = $65,350 (general rate $72,525); Titles Qld transfer $6,860 + mortgage $248; other costs $2,800 (legal/conveyancing ~$2,000, building or strata report ~$500, bank and settlement fees ~$300); total $75,258 = 4.70% (estimate, not sourced)",
          costCalc: "Council rates $3,200 + water/sewer fixed charges $1,300 + building insurance $2,500 + maintenance $4,000 = $11,000/yr; renter: contents $600 + moving $1,200 = $1,800/yr (estimate, not sourced)",
          sources: [
            { name: "YIP suburb data (Cotality), Carina QLD: house median $1.42M", url: "https://www.yourinvestmentpropertymag.com.au/top-suburbs/qld/4152-carina" },
            { name: "YIP suburb data (Cotality), Stafford QLD: house median $1.39M", url: "https://www.yourinvestmentpropertymag.com.au/top-suburbs/qld/4053-stafford" },
            { name: "YIP suburb data (Cotality), Mount Gravatt East QLD: house median $1.42M", url: "https://www.yourinvestmentpropertymag.com.au/top-suburbs/qld/4122-mount-gravatt-east" },
            { name: "RTA Queensland median rents by postcode and bedrooms, June quarter 2026", url: "https://www.rta.qld.gov.au/sites/default/files/2023-04/rta-bond-statistics.xlsx" },
            { name: "REIWA suburb profiles (bedroom-to-median ratios used for derivation)", url: "https://reiwa.com.au/suburb/perth/" }
          ]
        }
      },
      unavailable: {
        "apt-studio": "Brisbane studios are a thin niche of student and serviced units near the CBD; the RTA does not report a studio rent category, and lenders restrict units under about 40 m2.",
        "apt-4br": "4-bedroom apartments are rare luxury penthouses in Brisbane; RTA rent data stop at 3-bedroom flats and families buy houses instead.",
        "house-studio": "Houses without a bedroom do not exist as a market segment in Brisbane.",
        "house-1br": "1-bedroom houses are a rarity in Brisbane; RTA rent data for houses start at 2 bedrooms and granny flats sit on the main house's title."
      },
      notes: {
        market: "Brisbane is a house-led market that boomed from 2020. Cotality suburb data show many middle-ring house medians up 10 to 20% in the past year.",
        downPaymentPct: "A 20% deposit is the standard for an owner-occupier loan without lenders mortgage insurance (LMI).",
        mortgageRate: "RBA F6: new owner-occupier variable loans averaged about 6.2% in Aug 2026. The 30 Sep 2026 cash rate rise to 4.60% was passed on in full, so about 6.4%.",
        riskFreeRate: "RBA cash rate 4.60% from 30 Sep 2026. RBA F4 (Sep 2026): bonus savings accounts 4.80%, 3-year term deposits 4.20%, 3-month bank bills 4.67%.",
        sellingCostPct: "Agent commission of about 2% plus GST, marketing and conveyancing. No capital gains tax on a main residence (estimate, not sourced).",
        rentInflation: "SQM: Brisbane asking rents rose 5.8% (units) to 6.6% (houses) a year over 10 years, driven by migration after 2020. Tempered to 3.5% for the long run.",
        houseGrowth: "ABS index 2005 to 2016 chained with SQM 2016 to 2026: houses 6.2 to 6.5%/yr, units 5.7%/yr, mostly from the post-2020 boom (units grew 3.6%/yr in 2005 to 2016). Forward: houses 5.5%, units 4.5%.",
        setupCost: "QLD home concession duty rate for owner-occupiers (not a first home concession), Titles Qld 2026-27 fees ($248 + $46.56 per $10k over $180k), plus about $2,800 other costs (estimate, not sourced).",
        ownOngoingCost: "Body corporate levies, Brisbane City Council rates, Urban Utilities water and sewerage fixed charges, building insurance and upkeep. No land tax on a home (estimate, not sourced).",
        rentOngoingCost: "Contents insurance plus removalist, cleaning and reconnection costs spread over a typical 3-year lease. Tenants pay no letting fee (estimate, not sourced).",
        caveat: "From 1 Aug 2026 temporary residents lose the home concession. Prices by bedroom are derived from Cotality suburb medians because Domain bedroom data could not be accessed."
      },
      sources: [
        { name: "RTA Queensland median rents by postcode and bedrooms, June quarter 2026", url: "https://www.rta.qld.gov.au/sites/default/files/2023-04/rta-bond-statistics.xlsx" },
        { name: "Queensland Revenue Office, transfer duty rates", url: "https://qro.qld.gov.au/duties/transfer-duty/calculate/rates/" },
        { name: "Queensland Revenue Office, home concession rates", url: "https://qro.qld.gov.au/duties/transfer-duty/calculate/concession-rates/" },
        { name: "Titles Queensland, Titles Registry fees FY2026-27", url: "https://www.titlesqld.com.au/wp-content/uploads/2026/05/Titles-Registry-Fees_FY-2026-to-2027.pdf" },
        { name: "YIP suburb data (Cotality), South Brisbane QLD: unit median $775k", url: "https://www.yourinvestmentpropertymag.com.au/top-suburbs/qld/4101-south-brisbane" },
        { name: "RBA F6 Housing lending rates (new owner-occupier variable loans, Aug 2026)", url: "https://www.rba.gov.au/statistics/tables/csv/f6-data.csv" },
        { name: "RBA F4 Retail deposit and investment rates (Sep 2026)", url: "https://www.rba.gov.au/statistics/tables/csv/f4-data.csv" },
        { name: "SQM Research weekly asking rents, Brisbane, Oct 2026", url: "https://sqmresearch.com.au/weekly-rents.php?region=qld-Brisbane&type=c&t=1" },
        { name: "SQM Research asking prices, Brisbane, Oct 2026 (10-year change)", url: "https://sqmresearch.com.au/asking-property-prices.php?region=qld-Brisbane&type=c&t=1" },
        { name: "ABS Residential Property Price Indexes, attached dwellings (to Dec 2021)", url: "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/residential-property-price-indexes-eight-capital-cities/dec-2021/641603.xlsx" }
      ]
    },
    {
      key: "auckland", city: "Auckland", country: "New Zealand", countryId: "Selandia Baru", countryCode: "NZ", region: "Oceania",
      aliases: ["Tamaki Makaurau","Tāmaki Makaurau","AKL","Auckland City"],
      currencySymbol: "$", currencyCode: "NZD", asOf: "2026-09",
      buyer: "New Zealand citizen or resident owner-occupier buying a first home with a 20% deposit; no KiwiSaver withdrawal or first-home scheme modelled",
      downPaymentPct: 20, mortgageRate: 5.35, mortgageTerm: 30, riskFreeRate: 4, horizon: 30, sellingCostPct: 3.7,
      ratePeriods: [{ toYear: 2, type: "fixed", rate: 5.39 }, { toYear: 30, type: "floating", rateMin: 4.95, rateMax: 5.75 }],
      rentFreq: "weekly", rentInflation: 3, ownOngoingInflation: 3, rentOngoingInflation: 2.5,
      homes: {
        "apt-1br": {
          propertyPrice: 420000, rentAmount: 480, houseGrowth: 2.5, setupCost: 1.04, ownOngoingCost: 6850, rentOngoingCost: 500, sqm: 50, sellingCostPct: 5.5,
          where: "Freehold 1-bedroom apartments on the city fringe and inner suburbs: Grafton, Eden Terrace, Newmarket, Freemans Bay. CBD shoebox and leasehold units sell well below this",
          setupCalc: "No stamp duty. Unit-title conveyancing incl. GST and disbursements $2,600 + LIM $375 + building/body corporate report $500 + registered valuation $900 = $4,375 = 1.04% (fees per 2026 guides; report and valuation estimate, not sourced)",
          costCalc: "Body corporate levy incl. building insurance $4,000 + council rates ~$2,050 (scaled from $4,378 average on $1.28m) + Watercare fixed wastewater ~$300 + interior upkeep $500 = $6,850/yr; renter: contents insurance $500/yr (levy, water and upkeep estimate, not sourced)"
        },
        "apt-2br": {
          propertyPrice: 680000, rentAmount: 650, houseGrowth: 2.5, setupCost: 0.64, ownOngoingCost: 9250, rentOngoingCost: 600, sqm: 75, sellingCostPct: 4.3,
          where: "Freehold 2-bedroom apartments in central fringe suburbs: Parnell, Newmarket, Grafton/Eden Terrace, Freemans Bay. Price between Barfoot's citywide 2-bed average ($821k, mostly units/townhouses) and cheaper CBD stock",
          setupCalc: "No stamp duty. Unit-title conveyancing incl. GST and disbursements $2,600 + LIM $375 + building/body corporate report $500 + registered valuation $900 = $4,375 = 0.64% (report and valuation estimate, not sourced)",
          costCalc: "Body corporate levy incl. building insurance $5,500 + council rates ~$2,750 (scaled from $4,378 on $1.28m) + Watercare fixed wastewater ~$300 + interior upkeep $700 = $9,250/yr; renter: contents insurance $600/yr (levy, water and upkeep estimate, not sourced)"
        },
        "house-2br": {
          propertyPrice: 800000, rentAmount: 600, houseGrowth: 3.5, setupCost: 0.53, ownOngoingCost: 7800, rentOngoingCost: 600, sqm: 85, sellingCostPct: 4,
          where: "2-bedroom freehold townhouse or older single-level unit in middle-ring suburbs: Mt Albert, Mt Roskill, Avondale, Onehunga, Glen Innes (Barfoot Aug 2026 2-bed averages $630k West to $811k North Shore and Central East)",
          setupCalc: "No stamp duty. Conveyancing incl. GST and disbursements $2,300 + LIM $375 + building inspection $700 + registered valuation $900 = $4,275 = 0.53% (inspection and valuation estimate, not sourced)",
          costCalc: "Council rates ~$3,100 (scaled from $4,378 on $1.28m) + Watercare fixed wastewater ~$300 + house insurance $1,800 (Auckland average quote $2,056) + maintenance ~0.75% of ~$350k building $2,600 = $7,800/yr; renter: contents insurance $600/yr (maintenance and water estimate, not sourced)"
        },
        "house-4br": {
          propertyPrice: 1200000, rentAmount: 850, houseGrowth: 4, setupCost: 0.38, ownOngoingCost: 10850, rentOngoingCost: 800, sqm: 180, landSqm: 600, sellingCostPct: 3.5,
          where: "Standalone 4-bedroom house in middle-ring suburbs: Mt Roskill, Glenfield, Howick, Avondale, Onehunga (Barfoot Aug 2026 4-bed average sale $1,197,521, average rent $850 a week)",
          setupCalc: "No stamp duty. Conveyancing incl. GST and disbursements $2,300 + LIM $375 + building inspection $900 + registered valuation $1,000 = $4,575 = 0.38% (inspection and valuation estimate, not sourced)",
          costCalc: "Council rates ~$4,150 (scaled from $4,378 on $1.28m) + Watercare fixed wastewater ~$300 + house insurance $2,300 (Auckland average quote $2,056) + maintenance ~0.75% of ~$550k building $4,100 = $10,850/yr; renter: contents insurance $800/yr (maintenance, water and land size estimate, not sourced)"
        }
      },
      unavailable: {
        "apt-studio": "Auckland studios are mostly CBD shoebox units under 40 m2, often leasehold; major banks want 35-50% deposits on them or need a separate bedroom (ANZ), so a normal mortgage is not available.",
        "apt-4br": "Auckland apartments are overwhelmingly studio to 2-bedroom; 4-bedroom apartments exist only as occasional penthouses, too few to price.",
        "house-studio": "No bedroom-less houses on their own title are built or traded in Auckland.",
        "house-1br": "One-bedroom homes on their own title are rare in Auckland; small dwellings are minor units on a shared section or apartments, so no typical price can be quoted."
      },
      notes: {
        market: "Auckland is mostly standalone houses plus fast-growing townhouse stock; apartments are a small share. REINZ median about $950,000 in Aug 2026, flat on a year earlier.",
        downPaymentPct: "Banks keep their special rates for borrowers with at least 20% equity; smaller deposits fall under RBNZ high-LVR limits and attract low-equity margins or fees.",
        mortgageRate: "Fixed 5.39% for 2 years (Sept 2026 2-year specials 5.29-5.49%), then refixed within today's 1 to 5 year specials, 4.95 to 5.75%. OCR 2.75% and rising; RBNZ neutral 3-3.5%.",
        riskFreeRate: "One-year bank term deposits: RBNZ series 3.85% (June 2026); ANZ 18-month and 2-year 4.20-4.30% (Aug 2026), before the September OCR hike.",
        sellingCostPct: "Barfoot & Thompson scale: 3.95% of the first $400,000 plus 2% of the rest, plus 15% GST, plus about $3,000 marketing and $1,500 legal. About 3.7% at the median.",
        rentInflation: "Barfoot average rent rose 0.9% in the year to Aug 2026 ($699 a week); NZ rents grew about 4.2% a year over 20 years. Forward assumption 3%.",
        houseGrowth: "REINZ Auckland median grew 4.4% a year over 20 years but 1.1% over 10 (to Aug 2026). Apartments lag houses, so apartments 2.5%, townhouses 3.5%, houses 4%.",
        setupCost: "No stamp duty in NZ. Buyers pay conveyancing (about $2,000-2,600 with disbursements), an Auckland LIM ($375), a building or body corporate report and a valuation.",
        ownOngoingCost: "Auckland Council rates average $4,378 on a $1.28m home in 2026/27 (+7.9%), scaled by value, plus body corporate for apartments, house insurance (about $2,056) and upkeep.",
        rentOngoingCost: "Letting fees charged to tenants are banned in NZ, so the renter's extra cost is contents insurance (Auckland average quote $793 a year, scaled to home size).",
        caveat: "No stamp duty or capital gains tax on a main home. Apartments carry unit-title risks (special levies, weathertightness repairs) and some CBD units are leasehold."
      },
      sources: [
        { name: "Barfoot & Thompson, August 2026 residential sales report", url: "https://www.barfoot.co.nz/market-reports/2026/august/residential-sales-report" },
        { name: "Barfoot & Thompson, August 2026 rental report", url: "https://www.barfoot.co.nz/market-reports/2026/august/rental-report" },
        { name: "Opes Partners, Auckland property market (REINZ data, Aug 2026)", url: "https://opespartners.co.nz/property-markets/Auckland" },
        { name: "calculate.co.nz, NZ mortgage and deposit rates (21 Sept 2026)", url: "https://www.calculate.co.nz/nz-interest-rates.php" },
        { name: "1News, OCR raised to 2.75%, banks lift floating rates (Sept 2026)", url: "https://www.1news.co.nz/2026/09/03/all-major-banks-hike-floating-mortgage-rates/" },
        { name: "Local Matters, Auckland rates 2026/27", url: "https://www.localmatters.co.nz/auckland-council/property-rates-set-to-rise/" },
        { name: "Quashed Insurance Index, Q2 2026", url: "https://quashed.co.nz/insurance-index/" },
        { name: "calculate.co.nz, Barfoot & Thompson commission scale", url: "https://www.calculate.co.nz/barfoot-thompson-commission-calculator.php" },
        { name: "Bamboo Routes, Auckland apartment prices (Sept 2026)", url: "https://bambooroutes.com/blogs/news/auckland-how-much-apartment" },
        { name: "Good Returns, ANZ apartment lending rules", url: "https://www.goodreturns.co.nz/article/976518882/anz-eases-apartment-lending-rules.html" }
      ]
    },
    {
      key: "singapore", city: "Singapore", country: "Singapore", countryId: "Singapura", countryCode: "SG", region: "Southeast Asia",
      aliases: ["SG","SGP","Republic of Singapore"],
      currencySymbol: "$", currencyCode: "SGD", asOf: "2026-10",
      buyer: "Singapore citizen buying a first private (non-HDB) home to live in: 0% ABSD, 25% down under MAS LTV rules",
      downPaymentPct: 25, mortgageRate: 2.21, mortgageTerm: 30, riskFreeRate: 2, horizon: 30, sellingCostPct: 2,
      ratePeriods: [{ toYear: 2, type: "fixed", rate: 1.7 }, { toYear: 30, type: "floating", rateMin: 1.45, rateMax: 3.05 }],
      rentFreq: "monthly", rentInflation: 3, ownOngoingInflation: 3, rentOngoingInflation: 2.5,
      homes: {
        "apt-1br": {
          propertyPrice: 1200000, rentAmount: 3600, houseGrowth: 4, setupCost: 3.09, ownOngoingCost: 5100, rentOngoingCost: 800, sqm: 50,
          where: "1-bedroom private condo in the Rest of Central Region: Queenstown/Alexandra, Toa Payoh/Balestier, Kallang/Geylang, Tiong Bahru. About S$2,230 psf; rent about S$6.70 psf (URA Q2 2026 RCR district medians S$5.4-6.0 psf, small units higher)",
          setupCalc: "BSD on S$1.2m: 1%x180k + 2%x180k + 3%x640k + 4%x200k = S$32,600; legal ~S$3,500 + valuation ~S$1,000 = S$37,100 = 3.09% (legal and valuation estimate, not sourced)",
          costCalc: "MCST maintenance S$3,400 + owner-occupier property tax S$1,075 (AV ~S$38,900 = 90% of market rent) + home insurance S$150 + aircon/repairs S$500 = S$5,125 ~ S$5,100/yr; renter: lease duty 0.4% S$173 + aircon servicing S$250 + minor repairs S$200 + contents S$150 = ~S$800/yr (MCST, AV ratio and upkeep estimate, not sourced)"
        },
        "apt-2br": {
          propertyPrice: 1800000, rentAmount: 5000, houseGrowth: 4, setupCost: 3.61, ownOngoingCost: 7000, rentOngoingCost: 1000, sqm: 80,
          where: "2-bedroom private condo in the Rest of Central Region (city fringe): Queenstown/Alexandra, Toa Payoh/Novena fringe, Kallang, Marine Parade/Katong. About S$2,100 psf; rent about S$5.80 psf; 3.3% yield matches Global Property Guide's RCR 2-bed figure",
          setupCalc: "BSD on S$1.8m: 1%x180k + 2%x180k + 3%x640k + 4%x500k + 5%x300k = S$59,600; legal ~S$4,000 + valuation ~S$1,400 = S$65,000 = 3.61% (legal and valuation estimate, not sourced)",
          costCalc: "MCST maintenance S$4,000 + owner-occupier property tax S$2,120 (AV ~S$54,000 = 90% of market rent) + home insurance S$180 + aircon/repairs S$700 = S$7,000/yr; renter: lease duty 0.4% S$240 + aircon servicing S$320 + minor repairs S$290 + contents S$150 = S$1,000/yr (MCST, AV ratio and upkeep estimate, not sourced)"
        },
        "apt-4br": {
          propertyPrice: 3000000, rentAmount: 6800, houseGrowth: 4, setupCost: 4.19, ownOngoingCost: 11500, rentOngoingCost: 1300, sqm: 140,
          where: "Family-size 4-bedroom condo in the Rest of Central Region: Queenstown, Toa Payoh, Kallang, Marine Parade/Katong. About S$2,000 psf; rent about S$4.50 psf (large units rent for less per foot); a mainstream family segment, not luxury-only",
          setupCalc: "BSD on S$3.0m: 1%x180k + 2%x180k + 3%x640k + 4%x500k + 5%x1.5m = S$119,600; legal ~S$4,500 + valuation ~S$1,500 = S$125,600 = 4.19% (legal and valuation estimate, not sourced)",
          costCalc: "MCST maintenance S$6,000 + owner-occupier property tax S$4,064 (AV ~S$73,400) + home insurance S$250 + aircon/repairs S$1,200 = S$11,514 ~ S$11,500/yr; renter: lease duty 0.4% S$326 + aircon S$450 + minor repairs S$300 + contents S$220 = ~S$1,300/yr (price, rent, MCST and upkeep estimate, not sourced)"
        },
        "house-4br": {
          propertyPrice: 4500000, rentAmount: 8500, houseGrowth: 4.5, setupCost: 4.82, ownOngoingCost: 15300, rentOngoingCost: 2200, sqm: 280, landSqm: 170,
          where: "Intermediate terrace house in established landed estates: Serangoon Gardens, Upper Thomson, Siglap/Frankel, Sembawang Hills. Terraces are usually 4-5 bedrooms on about 160-180 m2 of land",
          setupCalc: "BSD on S$4.5m: S$119,600 on first S$3m + 6%x1.5m = S$209,600; legal ~S$5,000 + valuation ~S$2,500 = S$217,100 = 4.82% (legal and valuation estimate, not sourced)",
          costCalc: "Owner-occupier property tax S$6,980 (AV ~S$91,800) + fire/home insurance S$800 + maintenance ~0.75% of ~S$800k rebuild S$6,000 + garden, pest and aircon S$1,500 = ~S$15,300/yr; renter: lease duty 0.4% S$408 + aircon S$500 + minor repairs and garden S$1,000 + contents S$300 = ~S$2,200/yr (price, rent and upkeep estimate, not sourced)"
        }
      },
      unavailable: {
        "apt-studio": "Private studios are a small niche: URA guidelines curb shoebox units outside the city centre, so small condos are built as 1-bedders and market data has no studio category.",
        "house-studio": "Singapore's landed homes (about 5% of households) are terrace, semi-D and detached family houses on scarce land; none are built without bedrooms.",
        "house-1br": "Landed homes in Singapore are built as 4-5 bedroom family houses on scarce land; 1-bedroom landed homes do not exist.",
        "house-2br": "Even the smallest Singapore landed homes, intermediate terraces, are built with 4 or more bedrooms, so a 2-bedroom landed home is not a market segment."
      },
      notes: {
        market: "77% of resident households live in HDB flats, 18% in condos and 5% in landed homes (2025). Presets use the private condo market; HDB resale flats are cheaper but have eligibility rules.",
        downPaymentPct: "MAS caps a first housing loan at 75% LTV for tenures up to 30 years, so 25% down with at least 5% in cash (estimate, not sourced).",
        mortgageRate: "2-year fix 1.70% (lowest private package, Oct 2026), then SORA-floating from 1.45% (3M SORA 1.23% + 0.2%) to 3.05% (10-yr SGS 2.3% + the 0.75% top spread).",
        riskFreeRate: "6-month T-bill cut-off 1.90% (8 Oct 2026; 1.36-1.92% across 2026), 1-year bill 1.68% (Jul 2026), 2-year SGS 1.84%. Spare cash earns about 2%.",
        sellingCostPct: "Seller's agent commission is negotiable, typically 1-2% plus 9% GST, plus conveyancing of about S$2,500-3,000; no SSD once held 4 years (estimate, not sourced).",
        rentInflation: "URA private rental index: +1.8% in the year to Q2 2026, 2.5% a year over 15 years and 4.4% over 20 years. Forward assumption 3%.",
        houseGrowth: "URA price index Q2 2026: non-landed 4.5% a year over 20 yrs, 2.8% over 15, 4.4% over 10; landed 5.5%, 3.0%, 5.1%. Forward 4% condos, 4.5% landed.",
        setupCost: "IRAS Buyer's Stamp Duty since Feb 2023: 1%, 2%, 3%, 4% and 5% bands to S$3m, 6% above. 0% ABSD for a citizen's first home. Plus legal and valuation fees.",
        ownOngoingCost: "IRAS owner-occupier property tax from 2025: 0% on the first S$12,000 of annual value, then 4% rising to 32%. Plus condo MCST fees, insurance and aircon and repair upkeep.",
        rentOngoingCost: "Tenant pays lease stamp duty (0.4% of total rent, IRAS), aircon servicing and minor repairs under standard leases, plus contents insurance (estimate, not sourced).",
        caveat: "Seller's Stamp Duty hits sales within 4 years (16% in year one). A second home attracts 20% ABSD. Many condos are 99-year leasehold, whose value fades late in the lease."
      },
      sources: [
        { name: "PropertyNet, Singapore bank mortgage rates and SORA, Oct 2026", url: "https://propertynet.sg/latest-bank-mortgage-loan-rates-across-singapore/" },
        { name: "SingStat / URA, Private residential price index by type (to Q2 2026)", url: "https://tablebuilder.singstat.gov.sg/api/table/tabledata/M212261" },
        { name: "SingStat / URA, Non-landed price index by region (to Q2 2026)", url: "https://tablebuilder.singstat.gov.sg/api/table/tabledata/M212271" },
        { name: "SingStat / URA, Private residential rental index (to Q2 2026)", url: "https://tablebuilder.singstat.gov.sg/api/table/tabledata/M212311" },
        { name: "SingStat, Resident households by type of dwelling (2025)", url: "https://tablebuilder.singstat.gov.sg/api/table/tabledata/M810351" },
        { name: "URA via data.gov.sg, Rentals of non-landed residential buildings Q2 2026", url: "https://data.gov.sg/api/action/datastore_search?resource_id=d_149ac00a2734bb0a03867bbe2ec0e7b0" },
        { name: "IRAS, Buyer's Stamp Duty rates", url: "https://www.iras.gov.sg/taxes/stamp-duty/for-property/buying-or-acquiring-property/buyer's-stamp-duty-(bsd)" },
        { name: "IRAS, Property tax rates", url: "https://www.iras.gov.sg/taxes/property-tax/property-owners/property-tax-rates" },
        { name: "IRAS, Stamp duty for renting a property", url: "https://www.iras.gov.sg/taxes/stamp-duty/for-property/renting-a-property" },
        { name: "MAS, T-bill and SGS auction results (Oct 2026)", url: "https://eservices.mas.gov.sg/statistics/api/v1/bondsandbills/m/listbondsandbills" },
        { name: "Bamboo Routes, Singapore rental yields (Global Property Guide yields by bedroom, Sept 2026)", url: "https://bambooroutes.com/blogs/news/singapore-rental-yields" }
      ]
    },
    {
      key: "kualalumpur", city: "Kuala Lumpur", country: "Malaysia", countryId: "Malaysia", countryCode: "MY", region: "Southeast Asia",
      aliases: ["KL","Klang Valley","Greater KL","WP Kuala Lumpur"],
      currencySymbol: "RM", currencyCode: "MYR", asOf: "2026-09",
      buyer: "Malaysian citizen owner-occupier buying a first home with a 90% loan; standard stamp duty (first-time buyer exemption for homes up to RM500,000 not applied)",
      downPaymentPct: 10, mortgageRate: 4.3, mortgageTerm: 35, riskFreeRate: 3, horizon: 30, sellingCostPct: 3.5,
      rentFreq: "monthly", rentInflation: 3, ownOngoingInflation: 3, rentOngoingInflation: 2.5,
      homes: {
        "apt-studio": {
          propertyPrice: 430000, rentAmount: 2000, houseGrowth: 3, setupCost: 5.48, ownOngoingCost: 4600, rentOngoingCost: 700, sqm: 45,
          where: "SoHo and serviced-apartment studios around KLCC/Jalan Ampang, Bukit Bintang, Bangsar South and Mont Kiara, often on commercial-titled land. About RM900 psf (Brickz serviced-residence median RM945 psf); rent about RM4.20 psf",
          setupCalc: "Transfer duty on RM430k: 1%x100k + 2%x330k = RM7,600; loan duty 0.5%x387k = RM1,935; legal SPA RM5,375 + loan RM4,838 + 8% SST = RM11,030; disbursements RM2,000; valuation RM1,000; total RM23,565 = 5.48% (legal scale, disbursements and valuation estimate, not sourced)",
          costCalc: "Service charge RM0.50 psf x 484 sqft x 12 = RM2,900 + 10% sinking fund RM290 + assessment RM700 + quit rent RM60 + insurance RM120 + upkeep RM500 = ~RM4,600/yr; renter: tenancy stamp duty ~RM150 + agreement fee ~RM300 + contents RM150 + aircon servicing RM100 = ~RM700/yr (estimate, not sourced)"
        },
        "apt-1br": {
          propertyPrice: 600000, rentAmount: 2600, houseGrowth: 3, setupCost: 5.5, ownOngoingCost: 5500, rentOngoingCost: 900, sqm: 60,
          where: "1-bedroom serviced residences and condos in KLCC, Bukit Bintang, Bangsar South and Mont Kiara. About RM930 psf (Brickz serviced-residence median RM945 psf); rent about RM4.00 psf (Knight Frank prime range RM2.40-7.00)",
          setupCalc: "Transfer duty on RM600k: 1%x100k + 2%x400k + 3%x100k = RM12,000; loan duty 0.5%x540k = RM2,700; legal SPA RM7,250 + loan RM6,650 + 8% SST = RM15,012; disbursements RM2,000; valuation RM1,300; total RM33,012 = 5.50% (legal scale, disbursements and valuation estimate, not sourced)",
          costCalc: "Service charge RM0.45 psf x 646 sqft x 12 = RM3,490 + 10% sinking fund RM350 + assessment RM800 + quit rent RM60 + insurance RM150 + upkeep RM600 = ~RM5,500/yr; renter: tenancy stamp duty ~RM190 + agreement fee ~RM350 + contents RM200 + aircon RM150 = ~RM900/yr (estimate, not sourced)"
        },
        "apt-2br": {
          propertyPrice: 1000000, rentAmount: 4000, houseGrowth: 3, setupCost: 5.57, ownOngoingCost: 8000, rentOngoingCost: 1200, sqm: 95,
          where: "2-bedroom condo in Mont Kiara, Bangsar and KLCC. About RM980 psf for ~1,020 sqft (Brickz: Mont Kiara median RM823 psf, KL serviced residences RM945 psf, KLCC higher); rent about RM3.90 psf",
          setupCalc: "Transfer duty on RM1.0m: 1%x100k + 2%x400k + 3%x500k = RM24,000; loan duty 0.5%x900k = RM4,500; legal SPA RM11,250 + loan RM10,250 + 8% SST = RM23,220; disbursements RM2,000; valuation RM2,000; total RM55,720 = 5.57% (legal scale, disbursements and valuation estimate, not sourced)",
          costCalc: "Service charge RM0.40 psf x 1,020 sqft x 12 = RM4,900 + 10% sinking fund RM490 + DBKL assessment RM1,200 + quit rent RM100 + insurance RM200 + upkeep RM1,100 = ~RM8,000/yr; renter: tenancy stamp duty ~RM290 + agreement fee ~RM400 + contents RM250 + aircon RM260 = ~RM1,200/yr (estimate, not sourced)"
        },
        "apt-4br": {
          propertyPrice: 1800000, rentAmount: 6500, houseGrowth: 3, setupCost: 6.07, ownOngoingCost: 16000, rentOngoingCost: 1800, sqm: 205,
          where: "Large 4-bedroom family condos in Mont Kiara, Bangsar/Damansara Heights and the KLCC fringe, upper segment. About RM820 psf for ~2,200 sqft (Brickz Mont Kiara median RM823 psf); rent about RM2.95 psf",
          setupCalc: "Transfer duty on RM1.8m: RM24,000 on first RM1m + 4%x800k = RM56,000; loan duty 0.5%x1.62m = RM8,100; legal SPA RM19,250 + loan RM17,450 + 8% SST = RM39,636; disbursements RM2,500; valuation RM3,000; total RM109,236 = 6.07% (legal scale, disbursements and valuation estimate, not sourced)",
          costCalc: "Service charge RM0.40 psf x 2,200 sqft x 12 = RM10,560 + 10% sinking fund RM1,056 + assessment RM2,200 + quit rent RM200 + insurance RM300 + upkeep RM1,800 = ~RM16,000/yr; renter: tenancy stamp duty ~RM470 + agreement fee ~RM500 + contents RM350 + aircon RM500 = ~RM1,800/yr (estimate, not sourced)"
        },
        "house-4br": {
          propertyPrice: 1000000, rentAmount: 2800, houseGrowth: 4, setupCost: 5.57, ownOngoingCost: 6700, rentOngoingCost: 1300, sqm: 165, landSqm: 130,
          where: "Double-storey intermediate terrace in middle-ring KL and PJ: Cheras, Kepong, Setapak, Sri Petaling, Petaling Jaya (NAPIC Q2 2026 average terrace KL North RM898k, KL South RM824k, Petaling RM829k). Cheaper than the 4-bed condo because it is middle-ring, not prime Mont Kiara",
          setupCalc: "Transfer duty on RM1.0m: 1%x100k + 2%x400k + 3%x500k = RM24,000; loan duty 0.5%x900k = RM4,500; legal SPA RM11,250 + loan RM10,250 + 8% SST = RM23,220; disbursements RM2,000; valuation RM2,000; total RM55,720 = 5.57% (legal scale, disbursements and valuation estimate, not sourced)",
          costCalc: "DBKL/MBPJ assessment RM1,200 + quit rent RM300 + houseowner insurance RM400 + maintenance ~0.75% of ~RM400k building RM3,000 + guarded-community fee RM150 x 12 = RM1,800 = RM6,700/yr; renter: tenancy stamp duty ~RM200 + agreement fee ~RM350 + contents RM300 + aircon RM400 = ~RM1,250, rounded RM1,300/yr (price premium, rent and costs estimate, not sourced)"
        }
      },
      unavailable: {
        "house-studio": "Klang Valley landed homes are terraces, semi-Ds and bungalows built as family houses; none are built without bedrooms.",
        "house-1br": "Klang Valley terrace and other landed houses are built with three or more bedrooms; 1-bedroom landed homes do not exist as a segment.",
        "house-2br": "Klang Valley terraces are almost all built with three or more bedrooms; 2-bedroom landed homes survive only as old village or low-cost units, too few to price."
      },
      notes: {
        market: "KL is a high-rise market: condos and serviced apartments carry 65% of NAPIC's KL price-index weight, terraces 28%. A large unsold overhang keeps condo prices flat.",
        downPaymentPct: "BNM caps the loan-to-value ratio at 90% for a borrower's first two home loans, so 10% down; maximum tenure 35 years or to age 70 (estimate, not sourced).",
        mortgageRate: "New floating loans price off BNM's Standardised Base Rate, equal to the OPR (2.75% since July 2025, held Sept 2026), plus a bank spread of about 1.5 points.",
        riskFreeRate: "BNM 3-month interbank rate 3.53% (8 Oct 2026); 12-month bank fixed deposits pay less, about 2.5%, and fixed-price ASNB funds around 3-4% (estimate, not sourced).",
        sellingCostPct: "Agent commission up to 3% (often 2-3%) plus 8% SST, plus the vendor's lawyer on the same fee scale as the buyer's; RPGT is nil for citizens from year six (estimate, not sourced).",
        rentInflation: "Knight Frank prime asking rents were stable to slightly firmer in 2026 (Mont Kiara RM2.60-5.50 psf a month); long-run assumption 3% a year, in line with prices.",
        houseGrowth: "NAPIC KL index (2010=100) Q2 2026: high-rise grew 2.0% a year over 10 years and 5.7% since 2009; terraced 3.0% and 6.2%. Forward 3% condos, 4% terraces.",
        setupCost: "Transfer stamp duty 1/2/3/4% bands, 0.5% duty on the loan, legal fees 1.25% of the first RM500k then 1% for both SPA and loan, plus 8% SST (estimate, not sourced).",
        ownOngoingCost: "Condo service charge plus 10% sinking fund (about RM0.40-0.50 psf a month), DBKL assessment, quit rent, insurance and upkeep; terraces add a guarded-area fee (estimate, not sourced).",
        rentOngoingCost: "Agents' fees are paid by landlords. Tenants usually pay the tenancy agreement's stamp duty and legal fee, aircon servicing and contents insurance (estimate, not sourced).",
        caveat: "First-time buyers of homes up to RM500,000 get a stamp duty exemption (not modelled). SoHo and serviced units on commercial land pay higher assessment and utility tariffs (estimate, not sourced)."
      },
      sources: [
        { name: "NAPIC, Malaysian House Price Index tables Q2 2026 (preliminary)", url: "https://napic.jpph.gov.my/storage/app/media//3-penerbitan/Shahrul/Bahagian%20Indeks%20Harta%20Tanah/Laporan%20Jadual%20MHPI/Q2%202026/Jadual%20Penerbitan%20MHPI%20Q2%202026P.xlsx" },
        { name: "Bank Negara Malaysia API, OPR decisions 2025-2026", url: "https://api.bnm.gov.my/public/opr" },
        { name: "Bank Negara Malaysia API, interbank rates (8 Oct 2026)", url: "https://api.bnm.gov.my/public/interest-rate" },
        { name: "Bank Negara Malaysia, Standardised Base Rate consumer guide", url: "https://www.bnm.gov.my/documents/20124/938039/Consumer+Guide_RRF_EN.pdf" },
        { name: "Bank Negara Malaysia API, base rates and indicative lending rates (Aug 2020 snapshot, used for spread)", url: "https://api.bnm.gov.my/public/base-rate" },
        { name: "Bamboo Routes, Kuala Lumpur apartment prices (Brickz transaction data, Sept 2026)", url: "https://bambooroutes.com/blogs/news/kuala-lumpur-how-much-apartment" },
        { name: "Bamboo Routes, Kuala Lumpur market (NAPIC, Knight Frank rents, Sept 2026)", url: "https://bambooroutes.com/blogs/news/kuala-lumpur-property-taxes-fees" }
      ]
    },
    {
      key: "jakarta", city: "Jakarta", country: "Indonesia", countryId: "Indonesia", countryCode: "ID", region: "Southeast Asia",
      aliases: ["DKI Jakarta","South Jakarta","Jakarta Selatan","Jabodetabek"],
      currencySymbol: "Rp", currencyCode: "IDR", asOf: "2026-10",
      buyer: "Indonesian citizen with a Jakarta KTP buying a first home to live in, with a KPR; first-acquisition BPHTB allowance, no subsidised (FLPP) loan",
      downPaymentPct: 20, mortgageRate: 9.95, mortgageTerm: 20, riskFreeRate: 5, horizon: 20, sellingCostPct: 5.5,
      ratePeriods: [{ toYear: 5, type: "fixed", rate: 3.81 }, { toYear: 20, type: "floating", rateMin: 11, rateMax: 13 }],
      rentFreq: "yearly", rentInflation: 3, ownOngoingInflation: 3.5, rentOngoingInflation: 3.5,
      homes: {
        "apt-studio": {
          propertyPrice: 750000000, rentAmount: 60000000, houseGrowth: 2.5, setupCost: 5.67, ownOngoingCost: 8500000, rentOngoingCost: 1000000, sqm: 30,
          where: "Inner mid-market towers, resale: Kuningan and Setiabudi, Tebet, Menteng and Cikini, Tanah Abang. About Rp 25M/m2, below the Rp 36M/m2 new-launch average",
          setupCalc: "BPHTB 5% x (Rp 750M - Rp 250M first-home NPOPTKP) = Rp 25M; PPAT/notary deed, title transfer and BPN fee ~1% = Rp 7.5M; bank provision 1% of an 80% loan = Rp 6M; appraisal and admin Rp 1.5M + SKMHT/APHT mortgage deeds Rp 2.5M = Rp 4M; total Rp 42.5M = 5.67%",
          costCalc: "IPL service charge + sinking fund Rp 20,000/m2/month x 30 m2 = Rp 7.2M; PBB Rp 0 (NJOP ~Rp 525M is under the Rp 650M apartment waiver); unit insurance Rp 0.3M; repairs Rp 1M; total ~Rp 8.5M/yr; renter: contents insurance ~Rp 0.5M + lease admin and stamp duty ~Rp 0.5M = Rp 1M/yr. IPL rate and NJOP at ~70% of price are assumptions (estimate, not sourced)",
          sources: [
            { name: "Kompas, Colliers: Jakarta apartment average Rp 36.2M/m2, Apr 2026", url: "https://www.kompas.com/properti/read/2026/04/13/210000021/kredit-apartemen-makin-diminati-konsumen-tinggalkan-tren-investasi" },
            { name: "Numbeo, Jakarta rents, Oct 2026", url: "https://www.numbeo.com/cost-of-living/in/Jakarta" },
            { name: "FazWaz, Jakarta condos for rent (11,845 listings, yearly rents)", url: "https://www.fazwaz.id/condo-for-rent/indonesia/jakarta" }
          ]
        },
        "apt-1br": {
          propertyPrice: 1200000000, rentAmount: 84000000, houseGrowth: 2.5, setupCost: 6.09, ownOngoingCost: 14000000, rentOngoingCost: 1000000, sqm: 45,
          where: "Inner mid-market towers, resale: Kuningan and Setiabudi, Tebet, Menteng and Cikini, Tanah Abang (e.g. Menteng Park 1BR rents ~Rp 8M/month)",
          setupCalc: "BPHTB 5% x (Rp 1.2B - Rp 250M first-home NPOPTKP) = Rp 47.5M; PPAT/notary deed, title transfer and BPN fee ~1% = Rp 12M; bank provision 1% of an 80% loan = Rp 9.6M; appraisal and admin Rp 1.5M + SKMHT/APHT mortgage deeds Rp 2.5M = Rp 4M; total Rp 73.1M = 6.09%",
          costCalc: "IPL service charge + sinking fund Rp 20,000/m2/month x 45 m2 = Rp 10.8M; PBB 0.5% x 40% x (NJOP ~Rp 840M - Rp 60M) = Rp 1.6M; unit insurance Rp 0.4M; repairs Rp 1.2M; total ~Rp 14M/yr; renter: contents insurance ~Rp 0.5M + lease admin ~Rp 0.5M = Rp 1M/yr. IPL rate and NJOP at ~70% of price are assumptions (estimate, not sourced)",
          sources: [
            { name: "Kompas, Colliers: Jakarta apartment average Rp 36.2M/m2, Apr 2026", url: "https://www.kompas.com/properti/read/2026/04/13/210000021/kredit-apartemen-makin-diminati-konsumen-tinggalkan-tren-investasi" },
            { name: "Numbeo, Jakarta rents, Oct 2026", url: "https://www.numbeo.com/cost-of-living/in/Jakarta" },
            { name: "FazWaz, Jakarta condos for rent (11,845 listings, yearly rents)", url: "https://www.fazwaz.id/condo-for-rent/indonesia/jakarta" }
          ]
        },
        "apt-2br": {
          propertyPrice: 2000000000, rentAmount: 120000000, houseGrowth: 2.5, setupCost: 6.38, ownOngoingCost: 22000000, rentOngoingCost: 1000000, sqm: 72,
          where: "Inner South and Central Jakarta mid-market resale: Kuningan, Setiabudi, Tebet, Kebayoran Baru (e.g. Bellagio 2BR 84 m2 Rp 2.1B; Kuningan City 2BR 75 m2 rents Rp 120M/yr; Taman Rasuna 74 m2 Rp 1.1-1.6B)",
          setupCalc: "BPHTB 5% x (Rp 2B - Rp 250M first-home NPOPTKP) = Rp 87.5M; PPAT/notary deed, title transfer and BPN fee ~1% = Rp 20M; bank provision 1% of an 80% loan = Rp 16M; appraisal and admin Rp 1.5M + SKMHT/APHT mortgage deeds Rp 2.5M = Rp 4M; total Rp 127.5M = 6.38%",
          costCalc: "IPL service charge + sinking fund Rp 20,000/m2/month x 72 m2 = Rp 17.3M; PBB 0.5% x 40% x (NJOP ~Rp 1.4B - Rp 60M) = Rp 2.7M; unit insurance Rp 0.5M; repairs Rp 1.5M; total ~Rp 22M/yr; renter: contents insurance ~Rp 0.5M + lease admin ~Rp 0.5M = Rp 1M/yr. IPL rate and NJOP at ~70% of price are assumptions (estimate, not sourced)",
          sources: [
            { name: "FazWaz, Jakarta condos for sale (4,811 listings, Oct 2026)", url: "https://www.fazwaz.id/condo-for-sale/indonesia/jakarta" },
            { name: "FazWaz, Jakarta condos for rent (11,845 listings, yearly rents)", url: "https://www.fazwaz.id/condo-for-rent/indonesia/jakarta" },
            { name: "Jendela360, Taman Rasuna 2BR rentals", url: "https://jendela360.com/sewa-apartemen-taman-rasuna-apartment/2-kamar" },
            { name: "Kompas, Colliers: Jakarta apartment average Rp 36.2M/m2, Apr 2026", url: "https://www.kompas.com/properti/read/2026/04/13/210000021/kredit-apartemen-makin-diminati-konsumen-tinggalkan-tren-investasi" }
          ]
        },
        "apt-4br": {
          propertyPrice: 15000000000, rentAmount: 900000000, houseGrowth: 2.5, setupCost: 6.74, ownOngoingCost: 154000000, rentOngoingCost: 3000000, sqm: 300,
          where: "Luxury segment only: Kuningan (The Imperium, Verde), Senayan, Kebayoran Baru (Pakubuwono), Pondok Indah. Dearer than a 4BR house because these are prime CBD towers",
          setupCalc: "BPHTB 5% x (Rp 15B - Rp 250M first-home NPOPTKP) = Rp 737.5M; PPAT/notary deed, title transfer and BPN fee ~1% = Rp 150M; bank provision 1% of an 80% loan = Rp 120M; appraisal and admin Rp 1.5M + SKMHT/APHT mortgage deeds Rp 2.5M = Rp 4M; total Rp 1,011.5M = 6.74%",
          costCalc: "IPL service charge + sinking fund Rp 35,000/m2/month x 300 m2 = Rp 126M; PBB 0.5% x 40% x (NJOP ~Rp 10.5B - Rp 60M) = Rp 20.9M; unit insurance Rp 2M; repairs Rp 5M; total ~Rp 154M/yr; renter: contents insurance on higher-value contents ~Rp 2M + lease admin ~Rp 1M = Rp 3M/yr. Luxury IPL rate and NJOP at ~70% of price are assumptions (estimate, not sourced)",
          sources: [
            { name: "FazWaz, Jakarta condos for sale (4,811 listings, Oct 2026)", url: "https://www.fazwaz.id/condo-for-sale/indonesia/jakarta" },
            { name: "FazWaz, Jakarta condos for rent (11,845 listings, yearly rents)", url: "https://www.fazwaz.id/condo-for-rent/indonesia/jakarta" },
            { name: "Kompas, Colliers: Jakarta apartment average Rp 36.2M/m2, Apr 2026", url: "https://www.kompas.com/properti/read/2026/04/13/210000021/kredit-apartemen-makin-diminati-konsumen-tinggalkan-tren-investasi" }
          ]
        },
        "house-2br": {
          propertyPrice: 1200000000, rentAmount: 36000000, houseGrowth: 3.5, setupCost: 6.09, ownOngoingCost: 3200000, rentOngoingCost: 1000000, sqm: 60, landSqm: 72,
          where: "Older housing estates in East Jakarta: Duren Sawit, Cakung, Cipayung, Kramat Jati (3BR houses of ~100 m2 list at Rp 1.2-1.45B there). A minority of listings, as most Jakarta houses have 3+ bedrooms. Cheaper than the inner 2BR apartment because it is further out",
          setupCalc: "BPHTB 5% x (Rp 1.2B - Rp 250M first-home NPOPTKP) = Rp 47.5M; PPAT/notary deed, title transfer and BPN fee ~1% = Rp 12M; bank provision 1% of an 80% loan = Rp 9.6M; appraisal and admin Rp 1.5M + SKMHT/APHT mortgage deeds Rp 2.5M = Rp 4M; total Rp 73.1M = 6.09%",
          costCalc: "PBB Rp 0 (NJOP ~Rp 840M is under the Rp 2B landed-house waiver, Kepgub 339/2026); upkeep 1% of building value (60 m2 x Rp 4.5M/m2 = Rp 270M) = Rp 2.7M; fire insurance ~0.2% of building = Rp 0.5M; total ~Rp 3.2M/yr (RT/RW security dues are paid by whoever lives there, so left out); renter: contents insurance ~Rp 0.5M + lease admin ~Rp 0.5M = Rp 1M/yr. NJOP at ~70% of price and rebuild cost are assumptions (estimate, not sourced)",
          sources: [
            { name: "FazWaz, East Jakarta houses for sale (6,294 listings)", url: "https://www.fazwaz.id/house-for-sale/indonesia/jakarta/jakarta-timur" },
            { name: "FazWaz, East Jakarta houses for rent", url: "https://www.fazwaz.id/house-for-rent/indonesia/jakarta/jakarta-timur" },
            { name: "FazWaz, West Jakarta houses for sale (85 two-bedroom listings)", url: "https://www.fazwaz.id/house-for-sale/indonesia/jakarta/jakarta-barat" },
            { name: "Medcom, Rumah123 data: South Jakarta house median ~Rp 9B, East ~Rp 2.65B, Mar 2026", url: "https://www.medcom.id/properti/news-properti/3NOxn9pb-harga-rumah-jakarta-makin-jomplang-jaksel-tembus-rp9-miliar" }
          ]
        },
        "house-4br": {
          propertyPrice: 9000000000, rentAmount: 360000000, houseGrowth: 3.5, setupCost: 6.71, ownOngoingCost: 34100000, rentOngoingCost: 2500000, sqm: 300, landSqm: 300,
          where: "South Jakarta: Cilandak, Pondok Labu, Lebak Bulus, Pondok Indah (Kebayoran Baru costs more). Cheaper than a luxury 4BR apartment, which is prime CBD stock. Expat-let houses here ask US$3,200-3,800/month",
          setupCalc: "BPHTB 5% x (Rp 9B - Rp 250M first-home NPOPTKP) = Rp 437.5M; PPAT/notary deed, title transfer and BPN fee ~1% = Rp 90M; bank provision 1% of an 80% loan = Rp 72M; appraisal and admin Rp 1.5M + SKMHT/APHT mortgage deeds Rp 2.5M = Rp 4M; total Rp 603.5M = 6.71%",
          costCalc: "PBB 0.5% x 40% x (NJOP ~Rp 6.3B - Rp 60M) = Rp 12.5M; upkeep 1% of building value (300 m2 x Rp 6M/m2 = Rp 1.8B) = Rp 18M; fire insurance ~0.2% of building = Rp 3.6M; total ~Rp 34.1M/yr (RT/RW security dues are paid by whoever lives there, so left out); renter: contents insurance ~Rp 2M + lease admin ~Rp 0.5M = Rp 2.5M/yr. NJOP at ~70% of price and rebuild cost are assumptions (estimate, not sourced)",
          sources: [
            { name: "FazWaz, South Jakarta houses for sale (15,043 listings)", url: "https://www.fazwaz.id/house-for-sale/indonesia/jakarta/jakarta-selatan" },
            { name: "FazWaz, South Jakarta houses for rent", url: "https://www.fazwaz.id/house-for-rent/indonesia/jakarta/jakarta-selatan" },
            { name: "Medcom, Rumah123 data: South Jakarta house median ~Rp 9B, East ~Rp 2.65B, Mar 2026", url: "https://www.medcom.id/properti/news-properti/3NOxn9pb-harga-rumah-jakarta-makin-jomplang-jaksel-tembus-rp9-miliar" }
          ]
        }
      },
      unavailable: {
        "house-studio": "Jakarta landed houses are built with at least two bedrooms; single-room dwellings exist only as informal kampung rooms and kos, not titled homes a bank will finance.",
        "house-1br": "The smallest titled houses on the market (type 36 and up) have two bedrooms; 1-bedroom landed homes are informal kontrakan petak rooms without KPR-eligible title."
      },
      notes: {
        market: "About 232,000 strata apartments, many investor-owned, with about 29,000 new units unsold in Q1 2026. Most Jakartans live in landed houses (rumah tapak), mostly with 3 or more bedrooms.",
        downPaymentPct: "BI lets banks lend up to 100% of value until Dec 2026 (PADG 30/2025), but most KPR loans are 80 to 90% of value. 20% down is the standard assumption.",
        mortgageRate: "BCA promo: fixed 3.81% for 5 years (12-year tenor or more, to Oct 2026), then floating. Big-bank floating KPR is 11% (BCA) to 13% (Mandiri); SBDK base rates are 7.95 to 11.75% (Aug 2026).",
        riskFreeRate: "BI Rate 5.75% (Sep 2026). Average 1 to 6 month rupiah deposits paid 5.1 to 5.8% in Aug 2026; big banks pay 2.5 to 3.5% and retail SBN about 6.75 to 7%.",
        sellingCostPct: "Seller pays final income tax (PPh) of 2.5% of the gross price (PP 34/2016) plus an agent commission of about 3%.",
        rentInflation: "Knight Frank saw condo rents fall about 1% and serviced rents rise 2% in H1 2026. With apartment oversupply, rents are assumed to track CPI at about 3%.",
        houseGrowth: "Colliers average apartment asking price rose from Rp 27.7M/m2 (2014) to Rp 36.2M/m2 (2026), about 2.2% a year. BI's Jabodebek house index rose about 1.2% a year since 2018.",
        setupCost: "BPHTB 5% on the price above Rp 250M for a first acquisition (Perda DKI 1/2024), PPAT/notary about 1%, bank provision 1% of the loan and about Rp 4M of appraisal and deed fees.",
        ownOngoingCost: "Apartment owners pay IPL service charge and sinking fund. PBB is 0.5% of 40% of NJOP above Rp 60M, waived in 2026 up to Rp 2B NJOP for houses and Rp 650M for apartments.",
        rentOngoingCost: "Landlords normally pay the agent and the apartment service charge, so tenants mainly add contents insurance and lease admin (estimate, not sourced).",
        caveat: "Rent is usually paid 6 to 12 months upfront plus a deposit. Promo-fixed KPR rates reset to floating, so payments can jump. A second home gets no BPHTB allowance."
      },
      sources: [
        { name: "BCA Rumahsaya, KPR rates: promo fixes and 11% floating, valid to 31 Oct 2026", url: "https://rumahsaya.bca.co.id/info-kpr/Sukubunga-kpr" },
        { name: "Bank Indonesia, Survei Harga Properti Residensial Q2 2026 (IHPR 2018=100)", url: "https://www.bi.go.id/id/publikasi/laporan/Documents/SHPR_Tw_II_2026.pdf" },
        { name: "Kontan, floating KPR rates and SBDK by bank, Aug 2026", url: "https://keuangan.kontan.co.id/news/likuiditas-bank-ketat-begini-bunga-floating-kpr" },
        { name: "Databoks, SBDK KPR of 5 banks, Apr-May 2026", url: "https://databoks.katadata.co.id/keuangan/statistik/6a1ff64d0c633/sbdk-kpr-5-bank-di-indonesia-per-april-mei-2026-mandiri-tertinggi" },
        { name: "Bisnis.com, BI holds BI Rate at 5.75%, Sep 2026", url: "https://finansial.bisnis.com/read/20260923/11/2006495/breaking-bank-indonesia-tahan-bi-rate-575-di-era-suku-bunga-tinggi" },
        { name: "Kontan, BI average lending and deposit rates, Aug 2026", url: "https://keuangan.kontan.co.id/news/suku-bunga-kredit-stabil-di-89-bunga-deposito-terlihat-naik-pada-agustus-2026" },
        { name: "Bank Indonesia, PADG 30/2025 (LTV relaxation to 31 Dec 2026)", url: "https://www.bi.go.id/id/publikasi/peraturan/Pages/PADG_302025.aspx" },
        { name: "DDTCNews, BPHTB NPOPTKP in DKI Jakarta Rp 250 juta (Perda 1/2024)", url: "https://news.ddtc.co.id/berita/daerah/1801148/npoptkp-di-dki-jakarta-rp-250-juta-khusus-waris-jadi-rp1-miliar" },
        { name: "DDTCNews, Jakarta PBB waived for houses to Rp 2B and apartments to Rp 650M NJOP", url: "https://news.ddtc.co.id/berita/daerah/1809737/asyik-gubernur-jakarta-bebaskan-pbb-untuk-rumah-di-bawah-rp2-miliar" },
        { name: "FazWaz, Jakarta condos for sale (4,811 listings, Oct 2026)", url: "https://www.fazwaz.id/condo-for-sale/indonesia/jakarta" },
        { name: "FazWaz, Jakarta condos for rent (11,845 listings, yearly rents)", url: "https://www.fazwaz.id/condo-for-rent/indonesia/jakarta" }
      ]
    },
    {
      key: "bali", city: "Bali", country: "Indonesia", countryId: "Indonesia", countryCode: "ID", region: "Southeast Asia",
      aliases: ["Denpasar","Badung","Canggu","Seminyak","Kerobokan","Sanur","Jimbaran"],
      currencySymbol: "Rp", currencyCode: "IDR", asOf: "2026-10",
      buyer: "Indonesian citizen buying a freehold (SHM) home to live in with a KPR; foreigners can only lease (hak sewa) or hold hak pakai",
      downPaymentPct: 20, mortgageRate: 9.95, mortgageTerm: 20, riskFreeRate: 5, horizon: 20, sellingCostPct: 7.5,
      ratePeriods: [{ toYear: 5, type: "fixed", rate: 3.81 }, { toYear: 20, type: "floating", rateMin: 11, rateMax: 13 }],
      rentFreq: "yearly", rentInflation: 4, ownOngoingInflation: 3.5, rentOngoingInflation: 3.5,
      homes: {
        "house-2br": {
          propertyPrice: 3000000000, rentAmount: 210000000, houseGrowth: 4, setupCost: 6.8, ownOngoingCost: 24600000, rentOngoingCost: 1500000, sqm: 100, landSqm: 150,
          where: "Freehold (SHM) 2-bedroom villa-style house with a small pool on about 1.5 are: Kerobokan, Denpasar Barat, Sanur and Renon, Jimbaran. Listing averages: Denpasar Rp 2.8B, Jimbaran Rp 2.6B; Canggu and Seminyak cost more (Rp 4B+). Yearly rents seen Rp 180-320M",
          setupCalc: "BPHTB 5% x (Rp 3B - Rp 80M NPOPTKP) = Rp 146M; PPAT/notary deed, title transfer and BPN fee ~1% = Rp 30M; bank provision 1% of an 80% loan = Rp 24M; appraisal and admin Rp 1.5M + SKMHT/APHT mortgage deeds Rp 2.5M = Rp 4M; total Rp 204M = 6.80%. NPOPTKP assumed at the UU HKPD minimum (estimate, not sourced)",
          costCalc: "PBB ~0.1% of value = Rp 3M; pool and garden service Rp 1M/month = Rp 12M; upkeep 1% of building value (100 m2 x Rp 8M/m2 = Rp 800M) = Rp 8M; insurance ~0.2% of building = Rp 1.6M; total ~Rp 24.6M/yr; renter: contents insurance ~Rp 1M + banjar (village) contribution ~Rp 0.5M = Rp 1.5M/yr (pool and garden service is normally included in Bali yearly rents) (estimate, not sourced)",
          sources: [
            { name: "FazWaz, Denpasar villas and houses for sale (2,068 listings)", url: "https://www.fazwaz.id/villa-for-sale/indonesia/bali/denpasar" },
            { name: "FazWaz, Jimbaran villas for sale (2,150 listings)", url: "https://www.fazwaz.id/villa-for-sale/indonesia/bali/badung/jimbaran" },
            { name: "FazWaz, Kerobokan villas for sale (819 listings, Oct 2026)", url: "https://www.fazwaz.id/villa-for-sale/indonesia/bali/badung/kerobokan" },
            { name: "FazWaz, Denpasar and Sanur villas for rent (yearly)", url: "https://www.fazwaz.id/villa-for-rent/indonesia/bali/denpasar" },
            { name: "FazWaz, Kerobokan villas for rent (yearly)", url: "https://www.fazwaz.id/villa-for-rent/indonesia/bali/badung/kerobokan" },
            { name: "Bamboo Routes, Bali villa yields (Global Property Guide data), Sep 2026", url: "https://bambooroutes.com/blogs/news/bali-rental-yields" }
          ]
        },
        "house-4br": {
          propertyPrice: 6500000000, rentAmount: 380000000, houseGrowth: 4, setupCost: 6.8, ownOngoingCost: 48500000, rentOngoingCost: 2500000, sqm: 250, landSqm: 300,
          where: "Freehold (SHM) 4-bedroom family villa on about 3 are: Sanur and Renon, Kerobokan and Umalas, Jimbaran. Listing averages: Denpasar Rp 4.0B (plainer houses), Jimbaran Rp 8.3B; Canggu Rp 11.6B. Yearly rents seen Rp 290-660M",
          setupCalc: "BPHTB 5% x (Rp 6.5B - Rp 80M NPOPTKP) = Rp 321M; PPAT/notary deed, title transfer and BPN fee ~1% = Rp 65M; bank provision 1% of an 80% loan = Rp 52M; appraisal and admin Rp 1.5M + SKMHT/APHT mortgage deeds Rp 2.5M = Rp 4M; total Rp 442M = 6.80%. NPOPTKP assumed at the UU HKPD minimum (estimate, not sourced)",
          costCalc: "PBB ~0.1% of value = Rp 6.5M; pool and garden service Rp 1.5M/month = Rp 18M; upkeep 1% of building value (250 m2 x Rp 8M/m2 = Rp 2B) = Rp 20M; insurance ~0.2% of building = Rp 4M; total ~Rp 48.5M/yr; renter: contents insurance ~Rp 2M + banjar contribution ~Rp 0.5M = Rp 2.5M/yr (pool and garden service is normally included in Bali yearly rents) (estimate, not sourced)",
          sources: [
            { name: "FazWaz, Denpasar villas and houses for sale (2,068 listings)", url: "https://www.fazwaz.id/villa-for-sale/indonesia/bali/denpasar" },
            { name: "FazWaz, Jimbaran villas for sale (2,150 listings)", url: "https://www.fazwaz.id/villa-for-sale/indonesia/bali/badung/jimbaran" },
            { name: "FazWaz, Kerobokan villas for sale (819 listings, Oct 2026)", url: "https://www.fazwaz.id/villa-for-sale/indonesia/bali/badung/kerobokan" },
            { name: "FazWaz, Canggu villas for sale (1,109 listings)", url: "https://www.fazwaz.id/villa-for-sale/indonesia/bali/badung/canggu" },
            { name: "FazWaz, Denpasar and Sanur villas for rent (yearly)", url: "https://www.fazwaz.id/villa-for-rent/indonesia/bali/denpasar" },
            { name: "FazWaz, Kerobokan villas for rent (yearly)", url: "https://www.fazwaz.id/villa-for-rent/indonesia/bali/badung/kerobokan" },
            { name: "Bamboo Routes, Bali villa yields (Global Property Guide data), Sep 2026", url: "https://bambooroutes.com/blogs/news/bali-rental-yields" }
          ]
        }
      },
      unavailable: {
        "apt-studio": "Bali studios for sale are leasehold resort or condotel units (Uluwatu, Canggu) sold to foreign investors at about Rp 68M/m2; there is no strata-title owner-occupier market a KPR would finance.",
        "apt-1br": "The 1-bedroom condos listed in Bali are almost all leasehold, off-plan resort units run for short-term letting, not a local resale and rental market with KPR financing.",
        "apt-2br": "Bali's low-rise zoning and villa-led building mean few apartment blocks; the 2-bedroom condos listed are leasehold resort units priced far above freehold villas per m2.",
        "apt-4br": "Four-bedroom apartments essentially do not exist in Bali; large homes are built as villas and houses under the low-rise zoning.",
        "house-studio": "Studio landed houses are not built in Bali; even the smallest villas have a separate bedroom suite.",
        "house-1br": "One-bedroom villas are built mostly as leasehold rentals for foreigners (most 1BR Canggu listings are leasehold); freehold 1BR homes bought by locals with a KPR are rare."
      },
      notes: {
        market: "The Badung and Denpasar belt is villa-led and low-rise. The 1,163 condos listed are mostly leasehold resort units for foreigners, so local homes here are freehold houses and villas.",
        downPaymentPct: "Same national KPR rules as Jakarta, 20% down assumed. Banks lend only against SHM or HGB titles with a residential building permit, not leasehold (estimate, not sourced).",
        mortgageRate: "Same national KPR market: BCA promo fix 3.81% for 5 years, then floating at 11% (BCA) to 13% (Mandiri). SBDK base rates are 7.95 to 11.75% (Aug 2026).",
        riskFreeRate: "BI Rate 5.75% (Sep 2026). Average 1 to 6 month rupiah deposits paid 5.1 to 5.8% in Aug 2026; big banks pay 2.5 to 3.5% and retail SBN about 6.75 to 7%.",
        sellingCostPct: "Seller pays final income tax (PPh) of 2.5% of the price (PP 34/2016) plus an agent commission of about 5%, the usual rate for Bali villa sales (estimate, not sourced).",
        rentInflation: "Yearly villa rents rose with tourism and remote workers. A long-run 4% a year is assumed, slightly above CPI (estimate, not sourced).",
        houseGrowth: "BI's Denpasar new-house index rose only about 0.7% a year since 2018, but Rumah123 shows Denpasar resale prices up 6.3% in the year to Aug 2026. 4% assumed for land-rich villas.",
        setupCost: "BPHTB 5% on the price above an assumed Rp 80M NPOPTKP, PPAT/notary about 1%, bank provision 1% of the loan plus appraisal and deed fees (Badung and Denpasar schedule (estimate, not sourced)).",
        ownOngoingCost: "Owners pay PBB, pool and garden service, repairs of about 1% of the building value and insurance; Bali yearly rents usually include pool and garden service (estimate, not sourced).",
        rentOngoingCost: "Landlords pay the agent. Tenants add contents insurance and a small banjar (village) contribution (estimate, not sourced).",
        caveat: "Foreigners cannot own SHM freehold; they lease (hak sewa) or hold hak pakai, which runs down to zero and cannot be modelled here. Leasehold villas and condotels cannot get a KPR."
      },
      sources: [
        { name: "BCA Rumahsaya, KPR rates: promo fixes and 11% floating, valid to 31 Oct 2026", url: "https://rumahsaya.bca.co.id/info-kpr/Sukubunga-kpr" },
        { name: "FazWaz, Denpasar villas and houses for sale (2,068 listings)", url: "https://www.fazwaz.id/villa-for-sale/indonesia/bali/denpasar" },
        { name: "FazWaz, Kerobokan villas for sale (819 listings, Oct 2026)", url: "https://www.fazwaz.id/villa-for-sale/indonesia/bali/badung/kerobokan" },
        { name: "FazWaz, Jimbaran villas for sale (2,150 listings)", url: "https://www.fazwaz.id/villa-for-sale/indonesia/bali/badung/jimbaran" },
        { name: "FazWaz, Denpasar and Sanur villas for rent (yearly)", url: "https://www.fazwaz.id/villa-for-rent/indonesia/bali/denpasar" },
        { name: "FazWaz, Kerobokan villas for rent (yearly)", url: "https://www.fazwaz.id/villa-for-rent/indonesia/bali/badung/kerobokan" },
        { name: "FazWaz, Bali condos for sale (1,163 listings, mostly leasehold)", url: "https://www.fazwaz.id/condo-for-sale/indonesia/bali" },
        { name: "Bamboo Routes, Bali villa yields (Global Property Guide data), Sep 2026", url: "https://bambooroutes.com/blogs/news/bali-rental-yields" },
        { name: "Bamboo Routes, Bali prices (BI Bali survey, Rumah123 Denpasar), Sep 2026", url: "https://bambooroutes.com/blogs/news/bali-housing-prices" },
        { name: "Bank Indonesia, Survei Harga Properti Residensial Q2 2026 (IHPR 2018=100)", url: "https://www.bi.go.id/id/publikasi/laporan/Documents/SHPR_Tw_II_2026.pdf" },
        { name: "Kontan, floating KPR rates and SBDK by bank, Aug 2026", url: "https://keuangan.kontan.co.id/news/likuiditas-bank-ketat-begini-bunga-floating-kpr" }
      ]
    },
    {
      key: "bangkok", city: "Bangkok", country: "Thailand", countryId: "Thailand", countryCode: "TH", region: "Southeast Asia",
      aliases: ["Krung Thep","Krung Thep Maha Nakhon","BKK","Greater Bangkok"],
      currencySymbol: "฿", currencyCode: "THB", asOf: "2026-09",
      buyer: "Thai citizen owner-occupier, first home, registered in the house book (tabien baan); qualifies for the 0.01% transfer and mortgage fees on homes up to 7 million baht",
      downPaymentPct: 10, mortgageRate: 5.27, mortgageTerm: 30, riskFreeRate: 1.2, horizon: 30, sellingCostPct: 5,
      ratePeriods: [{ toYear: 3, type: "fixed", rate: 3 }, { toYear: 30, type: "floating", rateMin: 5.2, rateMax: 5.85 }],
      rentFreq: "monthly", rentInflation: 2.5, ownOngoingInflation: 2, rentOngoingInflation: 2,
      homes: {
        "apt-studio": {
          propertyPrice: 3400000, rentAmount: 15000, houseGrowth: 2.5, setupCost: 0.15, ownOngoingCost: 21600, rentOngoingCost: 1000, sqm: 28,
          where: "Mid-city condos near BTS/MRT: Ari and Phaya Thai, Ratchada to Rama 9, On Nut. Resale about 120,000 baht/m2",
          setupCalc: "Price 3.4M is under the 7M cap: buyer's half of 0.01% transfer fee 170; mortgage fee 0.01% x 3.06M loan 306; loan stamp duty 0.05% 1,530; bank appraisal 3,000; total 5,006 = 0.15%",
          costCalc: "Common fee 45 x 28 m2 x 12 = 15,120 + contents and fire insurance 1,500 + upkeep 5,000 = 21,620/yr; land and building tax nil (registered main home); renter: contents insurance 1,000/yr (estimate, not sourced)"
        },
        "apt-1br": {
          propertyPrice: 5300000, rentAmount: 24000, houseGrowth: 2.5, setupCost: 0.12, ownOngoingCost: 31800, rentOngoingCost: 1200, sqm: 38,
          where: "Sukhumvit (Asok to Phra Khanong), Ratchada to Rama 9, Phaya Thai and Ari, Silom fringe. About 140,000 baht/m2, rent about 630 baht/m2 a month",
          setupCalc: "Price 5.3M is under the 7M cap: half of 0.01% transfer fee 265; mortgage fee 0.01% x 4.77M loan 477; loan stamp duty 0.05% 2,385; appraisal 3,000; total 6,127 = 0.12%",
          costCalc: "Common fee 50 x 38 m2 x 12 = 22,800 + insurance 2,000 + upkeep 7,000 = 31,800/yr; land and building tax nil; renter: contents insurance 1,200/yr (estimate, not sourced)"
        },
        "apt-2br": {
          propertyPrice: 9800000, rentAmount: 42000, houseGrowth: 2.5, setupCost: 1.98, ownOngoingCost: 61300, rentOngoingCost: 1500, sqm: 65,
          where: "Sukhumvit (Asok, Phrom Phong, Thong Lo, Ekkamai), Silom and Sathorn, Phaya Thai. About 150,000 baht/m2 for 5 to 15 year old buildings; rents 40,000 to 60,000 a month",
          setupCalc: "Price 9.8M is above the 7M cap, so full fees: buyer's half of 2% transfer fee 98,000; mortgage fee 1% x 8.82M loan 88,200; loan stamp duty 0.05% 4,410; appraisal 3,000; total 193,610 = 1.98% (fees use price; appraised value is often lower)",
          costCalc: "Common fee 60 x 65 m2 x 12 = 46,800 + insurance 2,500 + upkeep 12,000 = 61,300/yr; land and building tax nil (under 50M exemption); renter: contents insurance 1,500/yr (estimate, not sourced)"
        },
        "apt-4br": {
          propertyPrice: 50000000, rentAmount: 150000, houseGrowth: 2.5, setupCost: 1.43, ownOngoingCost: 285600, rentOngoingCost: 5000, sqm: 220,
          where: "Luxury segment: large family condos on Sukhumvit (Phrom Phong, Thong Lo), Sathorn and Lumphini. About 230,000 baht/m2; rented mostly to expat families",
          setupCalc: "Full fees: half of 2% transfer fee 500,000; mortgage fee 1% of 45M loan capped at 200,000; loan stamp duty capped at 10,000; appraisal 5,000; total 715,000 = 1.43% (estimate, not sourced for price)",
          costCalc: "Common fee 90 x 220 m2 x 12 = 237,600 + insurance 8,000 + upkeep 40,000 = 285,600/yr; land and building tax nil if appraised under 50M (0.02% above); renter: contents insurance 5,000/yr (estimate, not sourced)"
        },
        "house-2br": {
          propertyPrice: 3200000, rentAmount: 15000, houseGrowth: 2.5, setupCost: 0.15, ownOngoingCost: 22000, rentOngoingCost: 1500, sqm: 120, landSqm: 80,
          where: "Two-storey townhouses in suburban estates: Ramintra, Lat Phrao (Prasert Manukitch), Bang Na, Nawamin. Cheaper than a central 2-bed condo because it is 15 to 25 km out",
          setupCalc: "Price 3.2M is under the 7M cap: half of 0.01% transfer fee 160; mortgage fee 0.01% x 2.88M loan 288; loan stamp duty 0.05% 1,440; appraisal 3,000; total 4,888 = 0.15%",
          costCalc: "Estate common fee about 500/month 6,000 + fire insurance 2,000 + upkeep 0.7% of 2M building 14,000 = 22,000/yr; land and building tax nil; renter: contents insurance 1,500/yr (estimate, not sourced)"
        },
        "house-4br": {
          propertyPrice: 10500000, rentAmount: 45000, houseGrowth: 2.5, setupCost: 1.97, ownOngoingCost: 79600, rentOngoingCost: 3000, sqm: 250, landSqm: 280,
          where: "Detached houses in gated estates: Bang Na, Ramintra to Kaset Nawamin, Ratchaphruek, Pattanakarn. Far cheaper than a central 4-bed luxury condo because it is suburban",
          setupCalc: "Price 10.5M is above the 7M cap: half of 2% transfer fee 105,000; mortgage fee 1% x 9.45M loan 94,500; loan stamp duty 0.05% 4,725; appraisal 3,000; total 207,225 = 1.97%",
          costCalc: "Estate fee 40 baht x 70 sq wah x 12 = 33,600 + fire insurance 4,000 + upkeep 0.7% of 6M building 42,000 = 79,600/yr; land and building tax nil (registered main home under 50M); renter: contents insurance 3,000/yr (estimate, not sourced)"
        }
      },
      unavailable: {
        "house-studio": "Bangkok landed homes are built in estates as 2 to 4 bedroom townhouses or detached houses; studio-size landed homes are not a market segment.",
        "house-1br": "One-bedroom landed homes are rare in Bangkok; even the smallest estate townhouses and old shophouses have 2 or more bedrooms, while 1-bedroom buyers choose condos."
      },
      notes: {
        market: "Central Bangkok is a condo market (studios to 2 bedrooms, luxury large units on Sukhumvit and Sathorn); townhouses and detached houses sit in suburban estates. Supply is ample in 2026.",
        downPaymentPct: "BoT rules allow up to 100% LTV on a first home under 10 million baht, and the 2025 to 2027 easing covers dearer homes, but banks often lend 90 to 95%, so 10% is assumed.",
        mortgageRate: "Teasers run about 2.5 to 3.5% for 3 years (3% used), then bank MRR (about 6.7 to 6.85% after the March 2026 cuts) minus 1 to 1.5 points: 5.2 to 5.85%. Policy rate is 1.0%.",
        riskFreeRate: "Thai 12-month deposits and short government bills yield about 1 to 1.3% with the BoT policy rate held at 1.0% through 2026.",
        sellingCostPct: "Long-held home: agent 3%, half the 2% transfer fee, stamp duty 0.5% and income tax withheld on appraised value about 0.5 to 1%. Specific business tax 3.3% applies only if sold within 5 years.",
        rentInflation: "Central condo rents have risen slowly amid oversupply; 2.5% a year assumed, a little above Thai CPI (estimate, not sourced).",
        houseGrowth: "BoT Bangkok indices: condos +1.95% and townhouses flat, detached -1.6% year on year in Q1 2026. After a stronger 2010s, 2.5% a year is assumed for all types (estimate, not sourced).",
        setupCost: "Transfer fee 2% and mortgage fee 1% (cap 200,000 baht) cut to 0.01% each to 30 June 2027 for Thai buyers when price, appraisal and loan are each up to 7 million baht. Transfer fee split 50/50 by custom.",
        ownOngoingCost: "Condo common fees of 45 to 90 baht per m2 a month, estate fees on landed homes, insurance and upkeep. Land and building tax is nil on a registered main home appraised under 50 million baht.",
        rentOngoingCost: "In Bangkok the landlord pays the agent and the deposit (usually 2 months) is refundable, so the renter's extra cost is mainly optional contents insurance (estimate, not sourced).",
        caveat: "Prices are asking prices; deals often close 6 to 10% lower. The 0.01% fee cut ends 30 June 2027 unless extended again. Foreigners can only own condo units within the 49% foreign quota."
      },
      sources: [
        { name: "Tilleke & Gibbins, Thailand extends reduced property transfer and mortgage registration fees (to 30 June 2027)", url: "https://www.tilleke.com/insights/thailand-extends-reduced-property-transfer-and-mortgage-registration-fees/21/" },
        { name: "HLB Thailand, Reduced registration fees extended for another year", url: "https://www.hlbthai.com/reduced-registration-fees-for-property-transfers-and-mortgages-extended-for-another-year/" },
        { name: "Business Today, Bank of Thailand holds rates at 1%, June 2026", url: "https://www.businesstoday.com.my/2026/06/24/bank-of-thailand-holds-rates-at-1-as-policy-makers-stay-on-hold-amid-weak-demand/" },
        { name: "Thairath, bank MRR cuts after the February 2026 policy cut", url: "https://en.thairath.co.th/money/personal_finance/finance_banking/2916697" },
        { name: "Kasikorn Research, Mortgage loan outlook, May 2026", url: "https://www.kasikornresearch.com/en/analysis/k-econ/business/Pages/Mortgage-Loan-CIS3644-KR-2026-05-21.aspx" },
        { name: "Global Property Guide, Thailand price history (BoT index, Q1 2026)", url: "https://www.globalpropertyguide.com/asia/thailand/price-history" },
        { name: "Global Property Guide, Bangkok gross rental yields by district, Q1 2026", url: "https://www.globalpropertyguide.com/asia/thailand/rental-yields" },
        { name: "Superagent, Bangkok condo rents per m2 by area, 2026", url: "https://www.superagent.co/en/blog/bangkok-condo-price-per-sqm-in-2026-real-numbers-by-area" },
        { name: "Lex Bangkok, Land and building tax Thailand 2026", url: "https://lexbangkok.com/land-building-tax-thailand-2026/" },
        { name: "Nation Thailand, BoT extends housing LTV easing by one year", url: "https://www.nationthailand.com/business/banking-finance/40065929" }
      ]
    },
    {
      key: "manila", city: "Manila", country: "Philippines", countryId: "Filipina", countryCode: "PH", region: "Southeast Asia",
      aliases: ["Metro Manila","Makati","BGC","Taguig","Quezon City"],
      currencySymbol: "₱", currencyCode: "PHP", asOf: "2026-09",
      buyer: "Filipino citizen owner-occupier, first home, bank loan at standard pricing (no Pag-IBIG socialized or promo rate)",
      downPaymentPct: 20, mortgageRate: 8.58, mortgageTerm: 20, riskFreeRate: 5, horizon: 20, sellingCostPct: 10.5,
      ratePeriods: [{ toYear: 5, type: "fixed", rate: 8 }, { toYear: 20, type: "floating", rateMin: 8.55, rateMax: 9 }],
      rentFreq: "monthly", rentInflation: 3, ownOngoingInflation: 4, rentOngoingInflation: 4,
      homes: {
        "apt-studio": {
          propertyPrice: 4600000, rentAmount: 20000, houseGrowth: 3, setupCost: 3.74, ownOngoingCost: 44500, rentOngoingCost: 2000, sqm: 26,
          where: "Mid-market towers in Ortigas, Makati fringe (Poblacion, Bangkal), Eastwood and Cubao in Quezon City",
          setupCalc: "Derived price: about ₱180,000/sqm x 26 sqm = ₱4.6M. DST 1.5% + transfer tax 0.75% + registration 0.25% = 2.50%; mortgage DST 0.4% x 80% loan = 0.32%; mortgage registration 0.20%; notarial 0.50%; appraisal and processing ₱10,000 = 0.22%; total 3.74% (fees beyond the 2.5% statutory taxes are estimates, not sourced)",
          costCalc: "Dues ₱95 x 26 sqm x 12 = ₱29,640 + RPT 0.15% x ₱4.6M = ₱6,900 + fire insurance ₱3,000 + upkeep ₱5,000 = ₱44,540/yr; renter: contents insurance ₱2,000/yr (estimate, not sourced)"
        },
        "apt-1br": {
          propertyPrice: 7500000, rentAmount: 32000, houseGrowth: 3, setupCost: 3.65, ownOngoingCost: 68000, rentOngoingCost: 2500, sqm: 40,
          where: "Makati (Legazpi edge, Poblacion), BGC fringe, Ortigas Center, Rockwell area mid-market towers",
          setupCalc: "Derived price: about ₱190,000/sqm x 40 sqm = ₱7.6M, rounded ₱7.5M. Taxes 2.50% + mortgage DST 0.32% + mortgage registration 0.20% + notarial 0.50% + ₱10,000 fees 0.13% = 3.65% (fees beyond statutory taxes are estimates, not sourced)",
          costCalc: "Dues ₱95 x 40 x 12 = ₱45,600 + RPT ₱11,250 + fire insurance ₱4,000 + upkeep ₱7,500 = ₱68,350/yr; renter: contents insurance ₱2,500/yr (estimate, not sourced)"
        },
        "apt-2br": {
          propertyPrice: 13000000, rentAmount: 52000, houseGrowth: 3, setupCost: 3.6, ownOngoingCost: 112000, rentOngoingCost: 3000, sqm: 65,
          where: "Makati CBD fringe, BGC, Ortigas Center, Quezon City (Eastwood, Scout area)",
          setupCalc: "Derived price: about ₱200,000/sqm x 65 sqm = ₱13M. Taxes 2.50% + mortgage DST 0.32% + mortgage registration 0.20% + notarial 0.50% + ₱10,000 fees 0.08% = 3.60% (fees beyond statutory taxes are estimates, not sourced)",
          costCalc: "Dues ₱95 x 65 x 12 = ₱74,100 + RPT ₱19,500 + fire insurance ₱6,000 + upkeep ₱12,000 = ₱111,600/yr; renter: contents insurance ₱3,000/yr. Rent ₱850/sqm x 65, near LPC Makati ₱887/sqm (estimate, not sourced)"
        },
        "apt-4br": {
          propertyPrice: 62000000, rentAmount: 220000, houseGrowth: 2.5, setupCost: 3.54, ownOngoingCost: 500000, rentOngoingCost: 6000, sqm: 220,
          where: "Luxury segment only: Makati CBD (Salcedo, Legazpi, Rockwell) and BGC prime towers",
          setupCalc: "Derived price: about ₱280,000/sqm x 220 sqm = ₱61.6M, rounded ₱62M. Taxes 2.50% + mortgage DST 0.32% + mortgage registration 0.20% + notarial 0.50% + ₱10,000 fees 0.02% = 3.54% (estimate, not sourced)",
          costCalc: "Dues ₱130 x 220 x 12 = ₱343,200 + RPT ₱93,000 + insurance ₱25,000 + upkeep ₱40,000 = ₱501,200/yr; renter: contents insurance ₱6,000/yr. Rent ₱1,000/sqm, near LPC BGC ₱1,105/sqm (estimate, not sourced)"
        },
        "house-2br": {
          propertyPrice: 7500000, rentAmount: 25000, houseGrowth: 4.5, setupCost: 3.65, ownOngoingCost: 58500, rentOngoingCost: 2500, sqm: 85, landSqm: 50,
          where: "Townhouses in Quezon City (Fairview, Lagro, Congressional, Novaliches), Pasig and Las Piñas. Cheaper than a CBD 2BR condo because it is 10 to 20 km out on lower land values",
          setupCalc: "Price from QC 2BR townhouse listings ₱7.0M to ₱8.5M (Housal, Aug 2026). Taxes 2.50% + mortgage DST 0.32% + mortgage registration 0.20% + notarial 0.50% + ₱10,000 fees 0.13% = 3.65% (fees beyond statutory taxes are estimates, not sourced)",
          costCalc: "HOA ₱1,500 x 12 = ₱18,000 + RPT ₱11,250 + fire insurance ₱3,800 + upkeep 1% of ₱2.55M building = ₱25,500, total ₱58,550/yr; renter: contents insurance ₱2,500/yr. Rent from a Fairview 2BR listing at ₱22,000 (estimate, not sourced)"
        },
        "house-4br": {
          propertyPrice: 22000000, rentAmount: 75000, houseGrowth: 4.5, setupCost: 3.57, ownOngoingCost: 170000, rentOngoingCost: 4000, sqm: 220, landSqm: 200,
          where: "Single-detached homes in gated subdivisions: Quezon City (Fairview, Filinvest, Ciudad Verde), Parañaque and Las Piñas (BF Homes), Pasig",
          setupCalc: "Price from QC 4BR listings at ₱22M to ₱26M for 200 to 320 sqm and a Parañaque median listing of ₱17M (Housal 2026). Taxes 2.50% + mortgage DST 0.32% + mortgage registration 0.20% + notarial 0.50% + ₱10,000 fees 0.05% = 3.57% (fees beyond statutory taxes are estimates, not sourced)",
          costCalc: "Village HOA and security ₱4,000 x 12 = ₱48,000 + RPT ₱33,000 + fire insurance ₱11,500 + upkeep 1% of ₱7.7M building = ₱77,000, total ₱169,500/yr; renter: contents insurance ₱4,000/yr (estimate, not sourced)"
        }
      },
      unavailable: {
        "house-studio": "Landed homes in Metro Manila subdivisions are built with at least two bedrooms, so studio houses are not a traded segment.",
        "house-1br": "One-bedroom landed homes exist only as rare socialized rowhouses on the fringe, not an established Metro Manila segment with normal bank financing."
      },
      notes: {
        market: "Central Metro Manila is condo-led (Makati, BGC, Ortigas, QC), with a record unsold stock of about 82,900 units (LPC Q2 2026). Landed homes sit in gated villages and subdivisions further out.",
        downPaymentPct: "Banks lend up to about 80% of appraised value, so 20% down is the standard. Developers often spread the down payment over the pre-selling period (estimate, not sourced).",
        mortgageRate: "BDO's May 2026 sheet: 5-year fix 8% (1 to 5 year fixes run 6.25 to 8%), then repriced yearly at the higher of 364-day T-bill (4.55 to 5% in 2026) plus 4% or board rate: 8.55 to 9%.",
        riskFreeRate: "91-day T-bills averaged 4.68% in March 2026 with policy at 4.25%. After hikes to 5% in August 2026, short bills are assumed near 5% (estimate, not sourced).",
        sellingCostPct: "Seller pays 6% capital gains tax on the higher of price or zonal value by custom, plus broker 3 to 5% (4% used) and about 0.5% in documents and clearances.",
        rentInflation: "LPC Q2 2026 rents are below pre-pandemic in most districts (Makati -18%, BGC flat) and Colliers sees flat rents through the glut, so 3% long-run is a tempered assumption (estimate, not sourced).",
        houseGrowth: "BSP RPPI: NCR condos +3.7% and houses +1.3% y/y in Q1 2026 after strong 2019 to 2025 house gains. Condos 3% and houses 4.5% are forward assumptions (estimate, not sourced).",
        setupCost: "Buyer pays documentary stamp tax 1.5%, city transfer tax 0.75%, registration about 0.25%, mortgage DST about 0.4% of the loan, mortgage registration, notarial and bank appraisal fees.",
        ownOngoingCost: "Condo dues about ₱95 per sqm a month (more in luxury towers), real property tax of 2% on a low assessed value (about 0.15% of price), bank-required fire insurance and upkeep (estimate, not sourced).",
        rentOngoingCost: "Landlords pay the broker fee and the tenant's deposit is refundable, so the renter's extra cost is mainly optional contents insurance (estimate, not sourced).",
        caveat: "Bank rates reprice after a 1 to 5 year fix. Pag-IBIG offers 30-year loans up to ₱10M at lower promo rates. CGT can be waived if sale proceeds buy a new principal home within 18 months."
      },
      sources: [
        { name: "GMA News, LPC Q2 2026 residential report (rents per sqm, unsold inventory), July 2026", url: "https://www.gmanetwork.com/news/money/economy/994028/metro-manila-unsold-condo-inventory-reaches-record-82-900-units/story/" },
        { name: "BSP Residential Property Price Index, Q1 2026 report", url: "https://www.bsp.gov.ph/Media_And_Research/RPPI/RPPI-Report-2026-Q1.pdf" },
        { name: "Lamudi, Metro Manila condos for rent (avg ₱852 per sqm a month, June 2026)", url: "https://www.lamudi.com.ph/rent/metro-manila/condo/" },
        { name: "BDO Home Loan interest rates summary, May 2026", url: "https://www.aem.bdo.com.ph/content/dam/cbg/marketing-services/channels/loans/pdf-files/HomeLoan_InterestRatesSummary_May%202026.pdf" },
        { name: "Manila Bulletin, BSP raises policy rate to 5%, August 2026", url: "https://mb.com.ph/2026/08/27/bsp-sees-no-need-for-another-rate-hikefor-now" },
        { name: "Inquirer, Pag-IBIG promo rates and higher loan ceiling, 2026", url: "https://business.inquirer.net/599916/pag-ibig-promo-rates-higher-loan-ceiling-help-lower-monthly-payments-amid-higher-lending-rates" },
        { name: "Manila Bulletin, Colliers: affordable homes buck Metro Manila condo glut, August 2026", url: "https://mb.com.ph/2026/08/12/affordable-homes-buck-metro-manila-condo-glutcolliers" },
        { name: "Global Property Guide, Philippines price history (Colliers luxury CBD condo ₱197,500 per sqm, Q1 2026)", url: "https://www.globalpropertyguide.com/Asia/Philippines/price-history" },
        { name: "Housal, July Extension Townhouse QC (2BR ₱7.0M to ₱8.5M), August 2026", url: "https://www.housal.com/project/july-extension-townhouse-quezon" }
      ]
    },
    {
      key: "hochiminh", city: "Ho Chi Minh City", country: "Vietnam", countryId: "Vietnam", countryCode: "VN", region: "Southeast Asia",
      aliases: ["Saigon","HCMC","HCM"],
      currencySymbol: "₫", currencyCode: "VND", asOf: "2026-09",
      buyer: "Vietnamese citizen owner-occupier buying a resale home with a pink book (long-term land-use right); foreigners may only hold a 50-year condo title and are not modelled",
      downPaymentPct: 30, mortgageRate: 13.77, mortgageTerm: 30, riskFreeRate: 6.5, horizon: 30, sellingCostPct: 3.5,
      ratePeriods: [{ toYear: 2, type: "fixed", rate: 10.6 }, { toYear: 30, type: "floating", rateMin: 13, rateMax: 15 }],
      rentFreq: "monthly", rentInflation: 5, ownOngoingInflation: 4, rentOngoingInflation: 4,
      homes: {
        "apt-studio": {
          propertyPrice: 2800000000, rentAmount: 11000000, houseGrowth: 6, setupCost: 0.74, ownOngoingCost: 9900000, rentOngoingCost: 500000, sqm: 35,
          where: "Resale condos in Thu Duc City (Thao Dien, An Phu), Binh Thanh and District 7, about 80m VND per m2",
          setupCalc: "Registration 0.5% x 2.8bn = 14.0m; notary 1.0m + 0.06% x 1.8bn = 2.08m; notary extras and land-office fees 1.5m; bank valuation and mortgage registration 3.0m; total 20.6m = 0.74%; extras and bank fees (estimate, not sourced)",
          costCalc: "Management 15,000/m2 x 35 m2 x 12 = 6.3m + fire insurance 0.5m + repairs 3.0m + land-use tax 0.1m = 9.9m/yr; renter: contents insurance 0.5m/yr (estimate, not sourced)"
        },
        "apt-1br": {
          propertyPrice: 3800000000, rentAmount: 15000000, houseGrowth: 6, setupCost: 0.69, ownOngoingCost: 13700000, rentOngoingCost: 500000, sqm: 50,
          where: "Resale condos in Thao Dien and An Phu (Thu Duc City), Binh Thanh and District 7, about 75m VND per m2",
          setupCalc: "Registration 0.5% x 3.8bn = 19.0m; notary 2.2m + 0.05% x 0.8bn = 2.6m; notary extras and land-office fees 1.5m; bank valuation and mortgage registration 3.0m; total 26.1m = 0.69%; extras and bank fees (estimate, not sourced)",
          costCalc: "Management 15,000/m2 x 50 m2 x 12 = 9.0m + fire insurance 0.6m + repairs 4.0m + land-use tax 0.1m = 13.7m/yr; renter: contents insurance 0.5m/yr (estimate, not sourced)"
        },
        "apt-2br": {
          propertyPrice: 5500000000, rentAmount: 22000000, houseGrowth: 6, setupCost: 0.64, ownOngoingCost: 20000000, rentOngoingCost: 500000, sqm: 72,
          where: "Resale condos in Thao Dien and An Phu (Thu Duc City), Binh Thanh and District 7, about 75m VND per m2; a 72 m2 Masteri Thao Dien 2BR lists at 25m a month",
          setupCalc: "Registration 0.5% x 5.5bn = 27.5m; notary 3.2m + 0.04% x 0.5bn = 3.4m; notary extras and land-office fees 1.5m; bank valuation and mortgage registration 3.0m; total 35.4m = 0.64%; extras and bank fees (estimate, not sourced)",
          costCalc: "Management 15,000/m2 x 72 m2 x 12 = 13.0m + fire insurance 0.8m + repairs 6.0m + land-use tax 0.2m = 20.0m/yr; renter: contents insurance 0.5m/yr (estimate, not sourced)"
        },
        "house-1br": {
          propertyPrice: 2900000000, rentAmount: 6500000, houseGrowth: 7, setupCost: 0.73, ownOngoingCost: 3400000, rentOngoingCost: 500000, sqm: 45, landSqm: 30,
          where: "Small tube houses in motorbike alleys of Go Vap, Tan Binh and Binh Thanh, about 95m VND per m2 of land; cheaper than a 1BR condo because the plot is tiny and the alley narrow",
          setupCalc: "Registration 0.5% x 2.9bn = 14.5m; notary 1.0m + 0.06% x 1.9bn = 2.14m; notary extras and land-office fees 1.5m; bank valuation and mortgage registration 3.0m; total 21.1m = 0.73%; extras and bank fees (estimate, not sourced)",
          costCalc: "Building upkeep 3.0m + optional fire insurance 0.3m + land-use tax 0.1m = 3.4m/yr; renter: contents insurance 0.5m/yr (estimate, not sourced)"
        },
        "house-2br": {
          propertyPrice: 5800000000, rentAmount: 11000000, houseGrowth: 7, setupCost: 0.64, ownOngoingCost: 5700000, rentOngoingCost: 500000, sqm: 90, landSqm: 48,
          where: "Two-storey alley townhouses (nha pho hem) in Go Vap and Tan Binh, listed at 87m to 125m VND per m2 of land; yield is low because price is mostly land",
          setupCalc: "Registration 0.5% x 5.8bn = 29.0m; notary 3.2m + 0.04% x 0.8bn = 3.52m; notary extras and land-office fees 1.5m; bank valuation and mortgage registration 3.0m; total 37.0m = 0.64%; extras and bank fees (estimate, not sourced)",
          costCalc: "Building upkeep about 0.8% of a 0.6bn building = 5.0m + optional fire insurance 0.5m + land-use tax 0.2m = 5.7m/yr; renter: contents insurance 0.5m/yr (estimate, not sourced)"
        },
        "house-4br": {
          propertyPrice: 8500000000, rentAmount: 17000000, houseGrowth: 7, setupCost: 0.61, ownOngoingCost: 11400000, rentOngoingCost: 500000, sqm: 200, landSqm: 70,
          where: "Three to four-storey townhouses in car alleys of Go Vap, Tan Binh and Binh Thanh; 4x17 m plots; 5BR car-alley houses list for 19m to 24m a month",
          setupCalc: "Registration 0.5% x 8.5bn = 42.5m; notary 3.2m + 0.04% x 3.5bn = 4.6m; notary extras and land-office fees 1.5m; bank valuation and mortgage registration 3.0m; total 51.6m = 0.61%; extras and bank fees (estimate, not sourced)",
          costCalc: "Building upkeep about 0.7% of a 1.4bn building = 10.0m + optional fire insurance 1.0m + land-use tax 0.4m = 11.4m/yr; renter: contents insurance 0.5m/yr (estimate, not sourced)"
        }
      },
      unavailable: {
        "apt-4br": "HCMC condo stock tops out at 3 bedrooms; 4-bedroom units exist only as rare penthouses or duplexes in a few luxury projects, too few to quote a typical price and rent.",
        "house-studio": "Even the smallest alley tube houses are built with a separate bedroom on an upper floor or mezzanine, so a studio landed house is not a market segment."
      },
      notes: {
        market: "Inner districts mix high-rise condos (Thu Duc, Binh Thanh, District 7) with narrow tube townhouses (nha pho) in alleys, which are land-heavy and rent for low yields.",
        downPaymentPct: "Banks lend 70 to 85% of value. BIDV caps at 70% when the bought home is the collateral and VPBank at 75%, so 30% down is typical.",
        mortgageRate: "Sept 2026 teasers run 8.2 to 13% for 6 to 36 months (2 years at 10.6% used), then float at base plus 3.3 to 3.5%, about 13 to 15% now. SBV average lending is 8.4 to 10.7%.",
        riskFreeRate: "SBV average VND deposit rates for 12 to 24 months were 6.1 to 7.6% in August 2026. Big state banks pay about 6%, private banks up to 8.8%.",
        sellingCostPct: "Seller pays 2% personal income tax on the sale price by law, plus a broker commission of about 1 to 2% (commission range estimate, not sourced).",
        rentInflation: "Asking rents rose about 5% a year city-wide and 14.5% in Binh Thanh over the past year on Batdongsan; 5% is used as the long-run rate.",
        houseGrowth: "Condo prices rose roughly 8 to 12% a year from 2015 to 2025 (Ministry of Construction, Batdongsan), land faster. Tempered to 6% for condos and 7% for townhouses.",
        setupCost: "Buyer pays 0.5% registration fee (Decree 10/2022), the state notary fee on the contract value (Circular 257/2016 bands) and small bank valuation and mortgage fees.",
        ownOngoingCost: "Condo owners pay a monthly management fee of roughly 15,000 VND per m2; townhouse owners mainly pay upkeep. Land-use tax is tiny for homes (rate estimate, not sourced).",
        rentOngoingCost: "Landlords usually pay the agent fee and deposits are refundable, so renters only carry optional contents insurance (estimate, not sourced).",
        caveat: "Teaser rates reset to floating rates that can jump 3 to 4 points. A new condo bought from a developer also costs a 2% maintenance fund, and legal title (pink book) issues are common."
      },
      sources: [
        { name: "VietNamNet, real-estate loan rates, Sept 2026", url: "https://vietnamnet.vn/en/real-estate-loan-interest-rates-fluctuate-as-buyers-become-more-cautious-2550502.html" },
        { name: "Viet Bao / Thuong Gia, mortgage rates Sept 2026 (VARS, DKRA)", url: "https://vietbao.vn/lai-suat-cho-vay-mua-nha-ngan-hang-nao-thap-nhat-thang-92026-605829.html" },
        { name: "Vietnam Banks Association, SBV rates August 2026", url: "https://vnba.org.vn/en/interest-rate-developments-applied-by-credit-institutions-in-august-2026-23634.htm" },
        { name: "Cushman & Wakefield, HCMC apartment market Q1 2026", url: "https://www.cushmanwakefield.com/en/vietnam/news/2026/06/hcmc-apartment-market-rebalances-as-core-prices-rise-and-demand-moves-outward" },
        { name: "DTiNews, HCMC apartment prices Q2 2026 (One Mount, CBRE)", url: "https://dtinews.dantri.com.vn/print/20260709212842205.htm" },
        { name: "VnEconomy, HCMC apartment prices 2015-2023", url: "https://en.vneconomy.vn/apartment-price-in-hcm-city-up-15-20-in-2015-2023.htm" },
        { name: "Batdongsan, HCMC townhouse sale listings, Aug 2026", url: "https://batdongsan.com.vn/ban-nha-rieng-tp-hcm/p49?cIds=40" },
        { name: "Batdongsan, HCMC townhouse rental listings, Aug 2026", url: "https://batdongsan.com.vn/cho-thue-nha-rieng-tp-hcm/p50" },
        { name: "Batdongsan, Binh Thanh apartment rentals, 2026", url: "https://batdongsan.com.vn/cho-thue-can-ho-chung-cu-binh-thanh/p74?cIds=651" },
        { name: "AZTAX, taxes and fees on property transfers 2026", url: "https://aztax.com.vn/cac-loai-thue-phi-khi-mua-ban-nha-dat/" }
      ]
    },
    {
      key: "hongkong", city: "Hong Kong", country: "Hong Kong SAR (China)", countryId: "Hong Kong", countryCode: "HK", region: "East Asia",
      aliases: ["HK"],
      currencySymbol: "$", currencyCode: "HKD", asOf: "2026-09",
      buyer: "Hong Kong permanent resident buying a first home to live in (Scale 2 stamp duty), standard bank mortgage at the 70% LTV cap without mortgage insurance",
      downPaymentPct: 30, mortgageRate: 3.42, mortgageTerm: 30, riskFreeRate: 2.8, horizon: 30, sellingCostPct: 1.2,
      ratePeriods: [{ toYear: 3, type: "fixed", rate: 2.73 }, { toYear: 30, type: "floating", rateMin: 3.25, rateMax: 3.75 }],
      rentFreq: "monthly", rentInflation: 2.5, ownOngoingInflation: 2, rentOngoingInflation: 2,
      homes: {
        "apt-studio": {
          propertyPrice: 3400000, rentAmount: 12300, houseGrowth: 3, setupCost: 1.36, ownOngoingCost: 26800, rentOngoingCost: 4060, sqm: 24,
          where: "Urban core: Sai Ying Pun, Wan Chai, Tai Kok Tsui, Kai Tak; open-plan studio ('nano') flats of about 260 sq ft saleable in newer blocks. Price and rent from RVD class A (under 40 m2) averages for HK Island and Kowloon, Jun-Aug 2026: about HK$140,000/m2 and HK$514/m2 a month",
          setupCalc: "Ad valorem stamp duty (Scale 2) on HK$3.4m: HK$100 flat charge (up to HK$4m); buyer agent commission 1% = HK$34,000; legal and Land Registry fees about HK$12,000; total HK$46,100 = 1.36%",
          costCalc: "Management HK$3.5/sq ft x 258 sq ft x 12 = HK$10,850; rates 5% of RV HK$7,000 + government rent 3% HK$4,200 on rateable value about HK$140,000 (95% of a year's rent); fire/home insurance HK$800; repairs and upkeep HK$4,000; total HK$26,850 = about HK$26,800/yr. Renter: agent half a month's rent per 2-year lease HK$3,075/yr + half the lease stamp duty HK$184/yr + contents insurance HK$800 = HK$4,059/yr. Insurance and upkeep amounts are rough allowances (estimate, not sourced)"
        },
        "apt-1br": {
          propertyPrice: 4600000, rentAmount: 16500, houseGrowth: 3, setupCost: 2.95, ownOngoingCost: 35800, rentOngoingCost: 5170, sqm: 33,
          where: "Urban core: Sheung Wan, Wan Chai, North Point, Ho Man Tin; 1-bedroom flats of about 355 sq ft saleable. RVD class A averages for HK Island and Kowloon, Jun-Aug 2026 (about HK$140,000/m2; rent about HK$500/m2 a month)",
          setupCalc: "Ad valorem stamp duty (Scale 2) on HK$4.6m: HK$67,500 + 10% x HK$100,000 = HK$77,500 (marginal band); buyer agent commission 1% = HK$46,000; legal and Land Registry fees about HK$12,000; total HK$135,500 = 2.95%",
          costCalc: "Management HK$3.5/sq ft x 355 sq ft x 12 = HK$14,919; rates 5% of RV HK$9,400 + government rent 3% HK$5,640 on rateable value about HK$188,000 (95% of a year's rent); fire/home insurance HK$800; repairs and upkeep HK$5,000; total HK$35,759 = about HK$35,800/yr. Renter: agent half a month's rent per 2-year lease HK$4,125/yr + half the lease stamp duty HK$248/yr + contents insurance HK$800 = HK$5,173/yr. Insurance and upkeep amounts are rough allowances (estimate, not sourced)"
        },
        "apt-2br": {
          propertyPrice: 6600000, rentAmount: 19000, houseGrowth: 3, setupCost: 4.18, ownOngoingCost: 45700, rentOngoingCost: 6040, sqm: 45,
          where: "Urban core estates: Taikoo Shing and Quarry Bay, North Point, Whampoa, Kai Tak; 2-bedroom flats of about 485 sq ft saleable. RVD class B (40-69.9 m2) averages for HK Island and Kowloon, Jun-Aug 2026: about HK$147,000/m2 and HK$424/m2 a month",
          setupCalc: "Ad valorem stamp duty (Scale 2) on HK$6.6m: HK$135,000 + 10% x HK$600,000 = HK$195,000 (marginal band); buyer agent commission 1% = HK$66,000; legal and Land Registry fees about HK$15,000; total HK$276,000 = 4.18%",
          costCalc: "Management HK$3.5/sq ft x 484 sq ft x 12 = HK$20,344; rates 5% of RV HK$10,850 + government rent 3% HK$6,510 on rateable value about HK$217,000 (95% of a year's rent); fire/home insurance HK$1,000; repairs and upkeep HK$7,000; total HK$45,704 = about HK$45,700/yr. Renter: agent half a month's rent per 2-year lease HK$4,750/yr + half the lease stamp duty HK$285/yr + contents insurance HK$1,000 = HK$6,035/yr. Insurance and upkeep amounts are rough allowances (estimate, not sourced)"
        },
        "apt-4br": {
          propertyPrice: 27000000, rentAmount: 60000, houseGrowth: 2.5, setupCost: 5.34, ownOngoingCost: 165200, rentOngoingCost: 17900, sqm: 130,
          where: "Luxury segment: Mid-Levels, Happy Valley, Ho Man Tin, Kowloon Tong; 4-bedroom flats of about 1,400 sq ft saleable. RVD class D (100-159.9 m2) averages for HK Island and Kowloon, Jun-Aug 2026: about HK$209,000/m2 and HK$460/m2 a month",
          setupCalc: "Ad valorem stamp duty (Scale 2) on HK$27m: 4.25% x HK$27m = HK$1,147,500; buyer agent commission 1% = HK$270,000; legal and Land Registry fees about HK$25,000; total HK$1,442,500 = 5.34%",
          costCalc: "Management HK$5/sq ft x 1,399 sq ft x 12 = HK$83,958; rates 5% on first HK$550,000 of RV + 8% above HK$38,220 + government rent 3% HK$20,520 on rateable value about HK$684,000 (95% of a year's rent); fire/home insurance HK$2,500; repairs and upkeep HK$20,000; total HK$165,198 = about HK$165,200/yr. Renter: agent half a month's rent per 2-year lease HK$15,000/yr + half the lease stamp duty HK$900/yr + contents insurance HK$2,000 = HK$17,900/yr. Insurance and upkeep amounts are rough allowances (estimate, not sourced)",
          sources: [
            { name: "news.gov.hk, 2026-27 Budget: rates concession and progressive rates", url: "https://www.news.gov.hk/eng/2026/02/20260225/20260225_094241_053.html" }
          ]
        },
        "house-4br": {
          propertyPrice: 16000000, rentAmount: 40000, houseGrowth: 2.5, setupCost: 4.91, ownOngoingCost: 119600, rentOngoingCost: 12600, sqm: 121,
          where: "Niche segment in New Territories house estates: Hong Lok Yuen (Tai Po), Fairview Park and Palm Springs (Yuen Long), Sai Kung; about 1,300 sq ft saleable. Cheaper than a 4-bedroom urban flat because these estates are 25-40 km out. Price from 2025-26 registered deals (Fairview Park 1,035-1,245 sq ft at HK$12-13.6m, Hong Lok Yuen 1,180-1,237 sq ft at HK$14.5-17.4m), about HK$12,300/sq ft. Rent set between RVD New Territories class D rents (about HK$33,000) and the roughly 3.5% yields portals show for these estates (about HK$46,000) (estimate, not sourced)",
          setupCalc: "Ad valorem stamp duty (Scale 2) on HK$16m: 3.75% x HK$16m = HK$600,000; buyer agent commission 1% = HK$160,000; legal and Land Registry fees about HK$25,000; total HK$785,000 = 4.91%",
          costCalc: "Management HK$2.5/sq ft x 1,302 sq ft x 12 = HK$39,073; rates 5% of RV HK$22,800 + government rent 3% HK$13,680 on rateable value about HK$456,000 (95% of a year's rent); fire/home insurance HK$4,000; repairs and upkeep HK$40,000; total HK$119,553 = about HK$119,600/yr. Renter: agent half a month's rent per 2-year lease HK$10,000/yr + half the lease stamp duty HK$600/yr + contents insurance HK$2,000 = HK$12,600/yr. Insurance and upkeep amounts are rough allowances (estimate, not sourced)",
          sources: [
            { name: "House730, Fairview Park Section H 2nd Street registered deals (2026)", url: "https://www.house730.com/en-us/estate-25281/Palm-Springs-Fairview-Fairview-Park-Section-H-2nd-Street/" },
            { name: "House730, Hong Lok Yuen registered deal (2025)", url: "https://www.house730.com/en-us/deal/c26449/" }
          ]
        }
      },
      unavailable: {
        "house-studio": "Land scarcity means Hong Kong has no market for studio-sized landed houses; homes this small are flats in high-rise blocks.",
        "house-1br": "Hong Kong's landed houses are large New Territories estate houses or luxury villas; 1-bedroom houses do not exist as a segment because of land scarcity.",
        "house-2br": "Small homes on their own land are essentially absent: a New Territories village house floor (about 700 sq ft) is sold and mortgaged as a separate flat, not a landed house."
      },
      notes: {
        market: "Private homes are high-rise flats priced by saleable area. RVD prices rose 11% in the year to August 2026 but remain about 19% below the 2021 peak, and rents are at a record.",
        downPaymentPct: "HKMA has capped loan-to-value at 70% for all residential property since October 2024. HKMC mortgage insurance can lift this to 80-90% on cheaper flats for a premium, not assumed here.",
        mortgageRate: "3-year fix 2.73% (mid-2026), then a HIBOR loan (HIBOR + 1.3%) capped at Prime 5% minus 1.75% = 3.25% today, up to 3.75% if Prime rises half a point (estimate, not sourced).",
        riskFreeRate: "Exchange Fund Bills yielded 2.84% (91-day) and 2.98% (182-day) at the 8 September 2026 tender; bank time deposits pay somewhat less. We use 2.8%.",
        sellingCostPct: "Sellers usually pay about 1% agent commission on a resale plus legal fees. There is no capital gains tax, and special stamp duty on quick resales was abolished in 2024.",
        rentInflation: "RVD rental index rose 1.7% a year over 1996-2025, 4.2% over 2005-2025 and 1.3% over 2015-2025, and hit a record in August 2026. We assume 2.5%.",
        houseGrowth: "RVD price index rose 3.2% a year over 1996-2025 and 5.9% over 2005-2025 but slipped over 2015-2025. We assume 3% for small flats and 2.5% for large flats and houses.",
        setupCost: "Scale 2 ad valorem stamp duty (from 26 Feb 2025: HK$100 up to HK$4m, 1.5% to 3.75% in between, 4.25% above HK$21.7m), plus the customary 1% buyer agent fee on resales and legal fees.",
        ownOngoingCost: "Owners pay rates (5% of rateable value, more above HK$550k) and government rent (3%), management fees of about HK$3-5 per sq ft a month, fire insurance and upkeep. Rents usually include these.",
        rentOngoingCost: "Tenants usually pay the agent half a month's rent and half the lease stamp duty per lease, spread here over a two-year lease, plus contents insurance (estimate, not sourced).",
        caveat: "Scale 2 duty needs a permanent resident with no other HK home. Rates concessions, bank cash rebates and mortgage insurance premiums are not modelled. All HK land is government leasehold."
      },
      sources: [
        { name: "Rating and Valuation Department, average prices by class (table 1.2), August 2026", url: "https://www.rvd.gov.hk/doc/en/statistics/his_data_2.xls" },
        { name: "Rating and Valuation Department, average rents by class (table 1.1), August 2026", url: "https://www.rvd.gov.hk/doc/en/statistics/his_data_1.xls" },
        { name: "Rating and Valuation Department, price indices by class (table 1.4)", url: "https://www.rvd.gov.hk/doc/en/statistics/his_data_4.xls" },
        { name: "Rating and Valuation Department, rental indices by class (table 1.3)", url: "https://www.rvd.gov.hk/doc/en/statistics/his_data_3.xls" },
        { name: "Inland Revenue Department, ad valorem stamp duty rates", url: "https://www.ird.gov.hk/eng/faq/avd.htm" },
        { name: "Sing Tao Headline, Prime held at 5%, H-plan borrowers stay at the 3.25% cap, 30 July 2026", url: "https://www.stheadline.com/realtime-property/3599173/%E6%9C%AC%E6%B8%AFP%E6%81%AF%E7%B6%AD%E6%8C%81%E4%B8%8D%E8%AE%8A-%E6%8C%89%E6%8F%AD%E6%A5%AD%E7%95%8C%E6%8B%86%E6%81%AF%E6%9C%AA%E6%9C%89%E5%A4%A7%E8%B7%8C%E7%A9%BA%E9%96%93-H%E6%8C%89%E6%A5%AD%E4%B8%BB%E7%9F%AD%E6%9C%9F%E4%BB%8D%E4%BB%A5325%E5%8E%98%E4%BE%9B%E6%A8%93" },
        { name: "HKMA, Exchange Fund Bills tender results, 8 September 2026", url: "https://www.info.gov.hk/gia/general/202609/08/P2026090800466p.htm" },
        { name: "okay.com, 2024 Policy Address: countercyclical measures for property mortgage loans (70% LTV)", url: "https://www.okay.com/en/property-news/2024-policy-address-countercyclical-macroprudential-measures-for-property-mortgage-loans/1154" },
        { name: "Consumer Council, property management fee study (average about HK$2.7 per sq ft)", url: "https://echoice.consumer.org.hk/f/initiative_detail/425023/448702/PMF_Presentation(English).pdf.pdf" },
        { name: "Estate Agents Authority, commission payable to estate agents", url: "https://smart.eaa.org.hk/sa2/sa2-smart-tips/mar2017/" }
      ]
    },
    {
      key: "taipei", city: "Taipei", country: "Taiwan", countryId: "Taiwan", countryCode: "TW", region: "East Asia",
      aliases: ["Taipei City"],
      currencySymbol: "$", currencyCode: "TWD", asOf: "2026-09",
      buyer: "Taiwanese citizen owner-occupier buying a first home (self-use tax rates), standard floating-rate bank mortgage, no subsidised youth (新青安) loan",
      downPaymentPct: 20, mortgageRate: 2.5, mortgageTerm: 30, riskFreeRate: 1.7, horizon: 30, sellingCostPct: 4,
      rentFreq: "monthly", rentInflation: 1.5, ownOngoingInflation: 1.5, rentOngoingInflation: 1.5,
      homes: {
        "apt-studio": {
          propertyPrice: 12500000, rentAmount: 20500, houseGrowth: 2.5, setupCost: 2.08, ownOngoingCost: 26900, rentOngoingCost: 16490, sqm: 29,
          where: "Central districts: Zhongshan, Da'an, Zhongzheng, Xinyi, Songshan; studio (套房) units of about 12 ping title area (39.7 m2 incl. common parts). Matched medians of registered deals (Oct 2025-Aug 2026, about NT$1.04m per ping) and studio rents (median NT$19,000 for 11 ping)",
          setupCalc: "Buyer agent fee 1.5% = NT$187,500; deed tax 6% x assessed house value about NT$360,000 (NT$30,000 per ping assumed) = NT$21,600; stamp tax 0.1% + registration 0.1% on assessed values taken as 40% of price = NT$10,000; mortgage registration 0.1% x 120% of an 80% loan = NT$12,000; scrivener NT$20,000; bank set-up NT$5,000; escrow 0.03% NT$3,750; total NT$259,850 = 2.08%. Agent fee, assessed values and fees are estimates (estimate, not sourced)",
          costCalc: "House tax 1.2% x NT$360,000 = NT$4,320; land value tax 0.2% on declared land value (about 9% of price) = NT$2,250; management NT$80/ping/month x 12 ping x 12 x 90% in managed buildings = NT$10,368; fire and earthquake insurance NT$2,000; upkeep NT$8,000; total NT$26,938 = about NT$26,900/yr. Renter: agent half a month's rent per 2-year tenancy NT$5,125/yr + building management fee NT$10,368 (tenant usually pays unless rent includes it) + contents insurance NT$1,000 = NT$16,493/yr. Management, land value, insurance and upkeep figures are estimates (estimate, not sourced)"
        },
        "apt-1br": {
          propertyPrice: 15100000, rentAmount: 29500, houseGrowth: 2.5, setupCost: 2.04, ownOngoingCost: 32800, rentOngoingCost: 21320, sqm: 33,
          where: "Central districts: Zhongshan, Da'an, Zhongzheng, Xinyi, Songshan; 1-bedroom (1房1廳) units of about 14 ping title area (47 m2), mostly elevator buildings. Building-type-matched medians of 2026 registered deals (about NT$1.06m per ping) and rents (NT$28,500-30,900)",
          setupCalc: "Buyer agent fee 1.5% = NT$226,500; deed tax 6% x assessed house value about NT$426,000 (NT$30,000 per ping assumed) = NT$25,560; stamp tax 0.1% + registration 0.1% on assessed values taken as 40% of price = NT$12,080; mortgage registration 0.1% x 120% of an 80% loan = NT$14,496; scrivener NT$20,000; bank set-up NT$5,000; escrow 0.03% NT$4,530; total NT$308,166 = 2.04%. Agent fee, assessed values and fees are estimates (estimate, not sourced)",
          costCalc: "House tax 1.2% x NT$426,000 = NT$5,112; land value tax 0.2% on declared land value (about 9% of price) = NT$2,720; management NT$80/ping/month x 14.2 ping x 12 x 95% in managed buildings = NT$12,950; fire and earthquake insurance NT$2,000; upkeep NT$10,000; total NT$32,782 = about NT$32,800/yr. Renter: agent half a month's rent per 2-year tenancy NT$7,375/yr + building management fee NT$12,950 (tenant usually pays unless rent includes it) + contents insurance NT$1,000 = NT$21,325/yr. Management, land value, insurance and upkeep figures are estimates (estimate, not sourced)"
        },
        "apt-2br": {
          propertyPrice: 24900000, rentAmount: 39000, houseGrowth: 2.5, setupCost: 1.99, ownOngoingCost: 50400, rentOngoingCost: 30190, sqm: 62,
          where: "Central districts: Zhongshan, Da'an, Zhongzheng, Xinyi, Songshan; 2-bedroom units of about 25 ping title area (83 m2). Matched median of 2026 registered deals (about NT$1.0m per ping); rent between the registered median (NT$35,000) and type- or district-matched estimates (NT$38,800-43,300)",
          setupCalc: "Buyer agent fee 1.5% = NT$373,500; deed tax 6% x assessed house value about NT$750,000 (NT$30,000 per ping assumed) = NT$45,000; stamp tax 0.1% + registration 0.1% on assessed values taken as 40% of price = NT$19,920; mortgage registration 0.1% x 120% of an 80% loan = NT$23,904; scrivener NT$20,000; bank set-up NT$5,000; escrow 0.03% NT$7,470; total NT$494,794 = 1.99%. Agent fee, assessed values and fees are estimates (estimate, not sourced)",
          costCalc: "House tax 1.2% x NT$750,000 = NT$9,000; land value tax 0.2% on declared land value (about 9% of price) = NT$4,480; management NT$80/ping/month x 25 ping x 12 x 81% in managed buildings = NT$19,440; fire and earthquake insurance NT$2,500; upkeep NT$15,000; total NT$50,420 = about NT$50,400/yr. Renter: agent half a month's rent per 2-year tenancy NT$9,750/yr + building management fee NT$19,440 (tenant usually pays unless rent includes it) + contents insurance NT$1,000 = NT$30,190/yr. Management, land value, insurance and upkeep figures are estimates (estimate, not sourced)"
        },
        "apt-4br": {
          propertyPrice: 42000000, rentAmount: 58000, houseGrowth: 2.5, setupCost: 1.9, ownOngoingCost: 85900, rentOngoingCost: 49530, sqm: 133,
          where: "Upper segment in central districts: Da'an, Zhongshan, Songshan, Xinyi, Zhongzheng; 4-bedroom flats of about 47 ping title area (156 m2), often in older walk-ups and mid-rise blocks. Matched medians of 2026 registered deals (about NT$0.9m per ping) and rents (NT$55,500-60,100)",
          setupCalc: "Buyer agent fee 1.5% = NT$630,000; deed tax 6% x assessed house value about NT$944,000 (NT$20,000 per ping assumed) = NT$56,640; stamp tax 0.1% + registration 0.1% on assessed values taken as 40% of price = NT$33,600; mortgage registration 0.1% x 120% of an 80% loan = NT$40,320; scrivener NT$20,000; bank set-up NT$5,000; escrow 0.03% NT$12,600; total NT$798,160 = 1.90%. Agent fee, assessed values and fees are estimates (estimate, not sourced)",
          costCalc: "House tax 1.2% x NT$944,000 = NT$11,328; land value tax 0.2% on declared land value (about 9% of price) = NT$7,560; management NT$80/ping/month x 47.2 ping x 12 x 74% in managed buildings = NT$33,531; fire and earthquake insurance NT$3,500; upkeep NT$30,000; total NT$85,919 = about NT$85,900/yr. Renter: agent half a month's rent per 2-year tenancy NT$14,500/yr + building management fee NT$33,531 (tenant usually pays unless rent includes it) + contents insurance NT$1,500 = NT$49,531/yr. Management, land value, insurance and upkeep figures are estimates (estimate, not sourced)"
        }
      },
      unavailable: {
        "house-studio": "Taipei's few landed houses (透天厝) are multi-storey row houses, so a studio-sized landed house is not a product in this market.",
        "house-1br": "透天厝 make up only about 1% of Taipei City home sales and are multi-storey homes with several rooms; 1-bedroom landed houses are not traded as a segment.",
        "house-2br": "Only about 60 landed houses (透天厝) sold in Taipei City from Oct 2025 to Aug 2026, about 1.3% of home sales and mostly old fringe row houses: too few to quote a 2-bedroom price.",
        "house-4br": "Taipei City registered only about 60 透天厝 sales and 35 whole-house rentals in spring and summer 2026, so 4-bedroom landed houses are a rarity there; landed houses are found mainly outside the city."
      },
      notes: {
        market: "Taipei is a city of apartment buildings. Areas are quoted in ping (3.3058 m2) of title area including common parts, and prices are high relative to rents, so gross yields are about 1.7-2.3%.",
        downPaymentPct: "The central bank caps only second and later home loans (second homes raised to 70% in September 2026). Banks typically lend up to about 80% of value on a first home (estimate, not sourced).",
        mortgageRate: "The five big banks averaged 2.29% on new home loans in July 2026, pulled down by subsidised youth loans (45% of volume). Unsubsidised floating loans cost more, so we use 2.5% (estimate, not sourced).",
        riskFreeRate: "Bank of Taiwan pays 1.725% on a 1-year fixed time deposit (October 2026 board rate); the central bank's discount rate has been 2% since March 2024.",
        sellingCostPct: "Agent fees are capped at 6% for both sides combined, usually up to 4% from the seller and often negotiated down. With scrivener fees and land value increment tax we use 4% (estimate, not sourced).",
        rentInflation: "Registered rents for Taipei walk-up flats rose from about NT$770 to NT$990 per ping a month between 2013 and 2026, about 2% a year (1.2% since 2016). We assume 1.5%.",
        houseGrowth: "Median registered price per ping of Taipei flats rose from NT$547,000 (late 2012) to NT$831,000 (2026), about 3.2% a year; walk-ups 2.7%. We assume 2.5% as buildings age.",
        setupCost: "Deed tax is 6% of the government assessed house value, far below market price. Add 0.1% stamp tax, 0.1% registration, mortgage registration, scrivener and a buyer agent fee of about 1.5%.",
        ownOngoingCost: "Owners pay house tax (1.2% of assessed house value for self-use), land value tax (0.2% self-use rate on declared land value), building management fees, insurance and upkeep.",
        rentOngoingCost: "Tenants typically pay an agent half a month's rent and usually the building management fee unless the rent includes it; we add basic contents insurance (estimate, not sourced).",
        caveat: "Gains on a self-use home held 6+ years are tax free up to NT$4m and taxed 10% above that (house and land tax), not modelled. Some banks lend less on small studio units."
      },
      sources: [
        { name: "Ministry of the Interior, actual price registration open data, 2026 Q3 release (Taipei sales and rents)", url: "https://plvr.land.moi.gov.tw/DownloadSeason?season=115S3&type=zip&fileName=lvr_landcsv.zip" },
        { name: "Ministry of the Interior, actual price registration open data, 2026 Q2 release", url: "https://plvr.land.moi.gov.tw/DownloadSeason?season=115S2&type=zip&fileName=lvr_landcsv.zip" },
        { name: "Ministry of the Interior, actual price registration open data, 2013 Q1 release (price history)", url: "https://plvr.land.moi.gov.tw/DownloadSeason?season=102S1&type=zip&fileName=lvr_landcsv.zip" },
        { name: "United Daily News, five big banks' new mortgage rate 2.29% in July 2026", url: "https://udn.com/news/story/6656/9706814" },
        { name: "Uanalyze, central bank September 2026 meeting: second-home LTV raised to 70%", url: "https://uanalyze.com.tw/articles/4333255533" },
        { name: "Bank of Taiwan, NTD deposit board rates", url: "https://rate.bot.com.tw/twd" },
        { name: "Land Tax Act (self-use land value tax 0.2%, land value increment tax 10%)", url: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=G0340096" }
      ]
    },
    {
      key: "shanghai", city: "Shanghai", country: "China", countryId: "Tiongkok", countryCode: "CN", region: "East Asia",
      aliases: ["上海","Hu","SH"],
      currencySymbol: "¥", currencyCode: "CNY", asOf: "2026-10",
      buyer: "Local Shanghai hukou household buying a first home to live in, no subsidies; where the Housing Provident Fund covers most of the loan, a couple both paying into it is assumed",
      downPaymentPct: 15, mortgageRate: 3.05, mortgageTerm: 30, riskFreeRate: 1.5, horizon: 30, sellingCostPct: 1,
      rentFreq: "monthly", rentInflation: 2, ownOngoingInflation: 1.5, rentOngoingInflation: 1.5,
      homes: {
        "apt-studio": {
          propertyPrice: 1950000, rentAmount: 3500, houseGrowth: 1, setupCost: 3.01, ownOngoingCost: 3400, rentOngoingCost: 1000, sqm: 30, mortgageRate: 2.7, downPaymentPct: 20, mortgageTerm: 20,
          where: "One-room flats (1 shi 0 ting, yishihu) in pre-1998 walk-up public housing: Xuhui (Tianlin, Kangjian), Changning (Tianshan), Putuo (Caoyang), Yangpu. Old buildings usually cap the loan near 20 years",
          setupCalc: "Deed tax 1% (first home, under 140 m2) on ¥1.95m = ¥19,500; buyer agent fee 2% = ¥39,000; registration ¥100; total ¥58,600 = 3.01%",
          costCalc: "Management ¥0.6/m2/month x 30 m2 = ¥216 + upkeep and refit reserve ¥100/m2 = ¥3,000 + insurance ¥200 = ¥3,400/yr; renter: half-month agent fee per 2-year lease ¥875 + contents ¥150 = ¥1,000/yr",
          sources: [
            { name: "Anjuke, Xuhui rents by layout, Oct 2026", url: "https://m.anjuke.com/sh/zujin/xuhui/" },
            { name: "Anjuke, Xuhui old public housing listings", url: "https://m.anjuke.com/sh/esf/fang-xuhuilaogongfan-d4255/" }
          ]
        },
        "apt-1br": {
          propertyPrice: 3600000, rentAmount: 5500, houseGrowth: 2, setupCost: 3, ownOngoingCost: 6700, rentOngoingCost: 1500, sqm: 50, mortgageRate: 2.68, downPaymentPct: 20,
          where: "1990s-2000s compounds in Jing'an, Xuhui, Changning and inner Pudong (Lianyang, Yuanshen)",
          setupCalc: "Deed tax 1% on ¥3.6m = ¥36,000; buyer agent fee 2% = ¥72,000; registration ¥100; total ¥108,100 = 3.00%",
          costCalc: "Management ¥2.5/m2/month x 50 m2 = ¥1,500 + upkeep and refit reserve ¥100/m2 = ¥5,000 + insurance ¥200 = ¥6,700/yr; renter: half-month agent fee per 2-year lease ¥1,375 + contents ¥150 = ¥1,500/yr",
          sources: [
            { name: "Sohu, citing Beike Research spring 2026 Shanghai rents by area", url: "https://m.sohu.com/a/1032902344_122698374" },
            { name: "Anjuke, Jing'an rents by layout, Oct 2026", url: "https://m.anjuke.com/sh/zujin/jingan/" },
            { name: "Anjuke, Changning rents by layout, Oct 2026", url: "https://m.anjuke.com/sh/zujin/changning/" }
          ]
        },
        "apt-2br": {
          propertyPrice: 6000000, rentAmount: 9000, houseGrowth: 2, setupCost: 3, ownOngoingCost: 11900, rentOngoingCost: 2400, sqm: 85,
          where: "Jing'an, Xuhui, Changning and inner Pudong (Lianyang, Biyun, Yuanshen), 1990s-2000s high-rise compounds",
          setupCalc: "Deed tax 1% on ¥6.0m = ¥60,000; buyer agent fee 2% = ¥120,000; registration ¥100; total ¥180,100 = 3.00%",
          costCalc: "Management ¥3/m2/month x 85 m2 = ¥3,060 + upkeep and refit reserve ¥100/m2 = ¥8,500 + insurance ¥300 = ¥11,900/yr; renter: half-month agent fee per 2-year lease ¥2,250 + contents ¥150 = ¥2,400/yr",
          sources: [
            { name: "Anjuke, Pudong price by sub-area, Oct 2026", url: "https://m.anjuke.com/sh/trendency/pudong/" },
            { name: "Anjuke, Pudong rents by layout, Oct 2026", url: "https://m.anjuke.com/sh/zujin/pudong/" }
          ]
        },
        "apt-4br": {
          propertyPrice: 16000000, rentAmount: 28000, houseGrowth: 2, setupCost: 3.5, ownOngoingCost: 33800, rentOngoingCost: 7300, sqm: 170,
          where: "Luxury-leaning segment: large flats in Gubei (Changning), Xujiahui and Binjiang (Xuhui), Lianyang and Century Park (Pudong), Jing'an",
          setupCalc: "Deed tax 1.5% (first home over 140 m2) on ¥16m = ¥240,000; buyer agent fee 2% = ¥320,000 (often negotiated lower at this price); registration ¥100; total ¥560,100 = 3.50%",
          costCalc: "Management ¥8/m2/month x 170 m2 = ¥16,320 + upkeep and refit reserve ¥100/m2 = ¥17,000 + insurance ¥500 = ¥33,800/yr; renter: half-month agent fee per 2-year lease ¥7,000 + contents ¥300 = ¥7,300/yr",
          sources: [
            { name: "Anjuke, Xuhui price by sub-area, Oct 2026", url: "https://m.anjuke.com/sh/trendency/xuhui/" }
          ]
        },
        "house-4br": {
          propertyPrice: 12500000, rentAmount: 22000, houseGrowth: 2, setupCost: 3.5, ownOngoingCost: 56300, rentOngoingCost: 5800, sqm: 250,
          where: "Resale villas and townhouses in Qingpu (Xujing, Zhaoxiang), Minhang (Huacao, Pujiang) and Songjiang (Sheshan), 20-30 km out, so cheaper than a central 4-bed flat. No new villa land since 2003",
          setupCalc: "Deed tax 1.5% (over 140 m2) on ¥12.5m = ¥187,500; buyer agent fee 2% = ¥250,000; registration ¥100; total ¥437,600 = 3.50%",
          costCalc: "Management ¥6/m2/month x 250 m2 = ¥18,000 + upkeep (roof, facade, garden) ¥150/m2 = ¥37,500 + insurance ¥800 = ¥56,300/yr; renter: half-month agent fee per 2-year lease ¥5,500 + contents ¥300 = ¥5,800/yr",
          sources: [
            { name: "Anjuke, Qingpu price by sub-area (Xujing ¥56,693/m2), Oct 2026", url: "https://m.anjuke.com/sh/trendency/qingpu/" },
            { name: "Anjuke, Xujing rents by layout, Oct 2026", url: "https://m.anjuke.com/sh/zujin/xujing/" }
          ]
        }
      },
      unavailable: {
        "house-studio": "Shanghai's landed homes are suburban villas and townhouses built as family homes; studio-sized landed homes are not built or traded.",
        "house-1br": "New villa land has been banned since 2003 and the remaining villas and townhouses have 3 or more bedrooms, so there is no 1-bedroom landed segment.",
        "house-2br": "Small landed homes are old lane houses (shikumen) in the centre, mostly subdivided public tenancies without full title, so no normal 2-bedroom landed market exists."
      },
      notes: {
        market: "A resale-led apartment market of 1980s-90s walk-up public housing and high-rise compounds. Villas are a small outer-district niche. NBS resale prices have risen monthly since Feb 2026.",
        downPaymentPct: "First-home commercial minimum is 15% citywide, kept in the Aug 2026 package. Studio and 1-bed use 20%, the provident fund minimum, because the fund covers most of their loan.",
        mortgageRate: "First-home floor 3.05% (5-year LPR 3.5% less 45bp, Sept 2026), repriced yearly. Studio 2.7% and 1-bed 2.68% blend provident fund loans at 2.6% (cap ¥1.2m a person, ¥2.4m a couple).",
        riskFreeRate: "1-year government bills yield about 1.2% and 10-year bonds 1.7% (Oct 2026); big-bank term deposits pay about 1%. 1.5% is a mid-point.",
        sellingCostPct: "No VAT after 2 years and no income tax on a family's only home held 5+ years. The seller usually pays about 1% agent commission.",
        rentInflation: "China Index Academy: Shanghai rents +1.25% year on year in Aug 2026, top of 50 cities, after falls in 2023-25. 2% assumes modest long-run growth.",
        houseGrowth: "NBS resale index -0.8% yoy in Aug 2026, rising monthly since Feb. Centaline's index was back at its July 2016 level in 2024, a flat decade. 2% forward; old walk-up studios 1%.",
        setupCost: "Deed tax 1% for a first home up to 140 m2 and 1.5% above (national rule since Dec 2024); buyer agent commission about 2% (Lianjia norm); registration about ¥100; no stamp duty.",
        ownOngoingCost: "Management fee (about ¥0.6/m2/month in old walk-ups, ¥2.5-8 in compounds), upkeep and refit reserve ¥100/m2/yr (¥150 villas), insurance. No property tax on a local's first home.",
        rentOngoingCost: "Tenant's share of the agent fee, about half a month's rent per new lease, spread over a 2-year lease, plus about ¥150/yr contents cover. Landlords pay management fees.",
        caveat: "Purchase limits remain inside the Outer Ring. Loans float with the LPR. 40-year terms opened in Aug 2026 for under-35s. Rent is usually paid 3 months ahead plus a 1-month deposit."
      },
      sources: [
        { name: "NBS, 70-city housing prices, August 2026", url: "https://www.stats.gov.cn/xxgk/sjfb/zxfb2020/202609/t20260915_1965304.html" },
        { name: "China Index Academy, Shanghai rents, August 2026", url: "https://www.cih-index.com/news/2026-09-05/55061650.html" },
        { name: "CityRE (creprice), Shanghai listing prices by district, Sept 2026", url: "https://m.creprice.cn/city/sh.html" },
        { name: "CityRE (creprice), Shanghai rents by district, Sept 2026", url: "https://m.creprice.cn/city/sh.html?type=lease" },
        { name: "Xinhua, Shanghai housing measures, 20 Aug 2026", url: "https://www.news.cn/20260820/92f89a71bcb5471b8e044e7332a3953c/c.html" },
        { name: "Beijing News, Shanghai mortgage pricing reform, Aug 2025", url: "https://www.bjnews.com.cn/detail/1756726757129929.html" },
        { name: "The Paper, Shanghai provident fund limits, Feb 2026", url: "https://www.thepaper.cn/newsDetail_forward_32652125" },
        { name: "Wallstreetcn, 40-year mortgages in Shanghai, Sept 2026", url: "https://wallstreetcn.com/articles/3780992" },
        { name: "NetEase, Centaline Shanghai resale index back to 2016 level", url: "https://c.m.163.com/news/a/J2LPIH9L05567IYR.html" },
        { name: "Trading Economics, China 10-year bond yield, Oct 2026", url: "https://tradingeconomics.com/china/government-bond-yield" }
      ]
    },
    {
      key: "beijing", city: "Beijing", country: "China", countryId: "Tiongkok", countryCode: "CN", region: "East Asia",
      aliases: ["北京","Peking","BJ"],
      currencySymbol: "¥", currencyCode: "CNY", asOf: "2026-10",
      buyer: "Local Beijing hukou household buying a first home to live in, no subsidies; where the Housing Provident Fund covers most of the loan, a couple both paying into it is assumed",
      downPaymentPct: 15, mortgageRate: 3.05, mortgageTerm: 30, riskFreeRate: 1.5, horizon: 30, sellingCostPct: 0.5,
      rentFreq: "monthly", rentInflation: 1.5, ownOngoingInflation: 1.5, rentOngoingInflation: 1.5,
      homes: {
        "apt-1br": {
          propertyPrice: 3300000, rentAmount: 4800, houseGrowth: 1.5, setupCost: 3.7, ownOngoingCost: 8200, rentOngoingCost: 2550, sqm: 50, mortgageRate: 2.64, downPaymentPct: 20,
          where: "Older high-rise and walk-up estates in Chaoyang (Shuangjing, Jinsong, Wangjing), Haidian and Dongcheng",
          setupCalc: "Deed tax 1% (first home, under 140 m2) on ¥3.3m = ¥33,000; Lianjia buyer fee 2.7% = ¥89,100; registration ¥100; total ¥122,200 = 3.70%",
          costCalc: "Management ¥2.5/m2/month x 50 m2 = ¥1,500 + heating ¥30/m2 = ¥1,500 + upkeep and refit reserve ¥100/m2 = ¥5,000 + insurance ¥200 = ¥8,200/yr; renter: one-month agent fee per 2-year lease ¥2,400 + contents ¥150 = ¥2,550/yr",
          sources: [
            { name: "Anjuke, Chaoyang rents by layout, Oct 2026", url: "https://m.anjuke.com/bj/zujin/chaoyang/" },
            { name: "Anjuke, Haidian rents by layout, Oct 2026", url: "https://m.anjuke.com/bj/zujin/haidian/" }
          ]
        },
        "apt-2br": {
          propertyPrice: 5200000, rentAmount: 7500, houseGrowth: 1.5, setupCost: 3.7, ownOngoingCost: 13600, rentOngoingCost: 3900, sqm: 80,
          where: "Chaoyang (Shuangjing, Wangjing, Yayuncun), Haidian and Dongcheng, 1990s-2000s compounds",
          setupCalc: "Deed tax 1% on ¥5.2m = ¥52,000; Lianjia buyer fee 2.7% = ¥140,400; registration ¥100; total ¥192,500 = 3.70%",
          costCalc: "Management ¥3/m2/month x 80 m2 = ¥2,880 + heating ¥30/m2 = ¥2,400 + upkeep and refit reserve ¥100/m2 = ¥8,000 + insurance ¥300 = ¥13,600/yr; renter: one-month agent fee per 2-year lease ¥3,750 + contents ¥150 = ¥3,900/yr",
          sources: [
            { name: "Anjuke, Chaoyang price by sub-area, Oct 2026", url: "https://m.anjuke.com/bj/trendency/chaoyang/" }
          ]
        },
        "apt-4br": {
          propertyPrice: 15000000, rentAmount: 26000, houseGrowth: 1.5, setupCost: 4.2, ownOngoingCost: 39000, rentOngoingCost: 13300, sqm: 180,
          where: "Luxury-leaning segment: large flats around Chaoyang Park, Taiyanggong, Olympic Park and the CBD, and Haidian (Wanliu)",
          setupCalc: "Deed tax 1.5% (first home over 140 m2) on ¥15m = ¥225,000; Lianjia buyer fee 2.7% = ¥405,000 (often negotiated lower at this price); registration ¥100; total ¥630,100 = 4.20%",
          costCalc: "Management ¥7/m2/month x 180 m2 = ¥15,120 + heating ¥30/m2 = ¥5,400 + upkeep and refit reserve ¥100/m2 = ¥18,000 + insurance ¥500 = ¥39,000/yr; renter: one-month agent fee per 2-year lease ¥13,000 + contents ¥300 = ¥13,300/yr",
          sources: [
            { name: "Anjuke, Haidian price by sub-area, Oct 2026", url: "https://m.anjuke.com/bj/trendency/haidian/" }
          ]
        },
        "house-4br": {
          propertyPrice: 12000000, rentAmount: 22000, houseGrowth: 1.5, setupCost: 4.2, ownOngoingCost: 63800, rentOngoingCost: 11300, sqm: 300,
          where: "Resale villas and townhouses in Shunyi (Houshayu, Central Villa District, Tianzhu) and Changping, 25-35 km out, so cheaper than a central 4-bed flat. No new villa land since 2003",
          setupCalc: "Deed tax 1.5% (over 140 m2) on ¥12m = ¥180,000; Lianjia buyer fee 2.7% = ¥324,000; registration ¥100; total ¥504,100 = 4.20%",
          costCalc: "Management ¥5/m2/month x 300 m2 = ¥18,000 + upkeep (roof, facade, garden) ¥150/m2 = ¥45,000 + insurance ¥800 = ¥63,800/yr (heating is by own gas boiler, paid by the occupant); renter: one-month agent fee per 2-year lease ¥11,000 + contents ¥300 = ¥11,300/yr",
          sources: [
            { name: "Anjuke, Shunyi price by sub-area (Central Villa District ¥49,434/m2), Oct 2026", url: "https://m.anjuke.com/bj/trendency/shunyi/" },
            { name: "Anjuke, Houshayu rents by layout, Oct 2026", url: "https://m.anjuke.com/bj/zujin/houshayu/" }
          ]
        }
      },
      unavailable: {
        "apt-studio": "Residential studios are rare; most Beijing studios are 40 to 50-year commercial-use lofts that need larger deposits and short loans and pay higher taxes, so not a normal first-home segment.",
        "house-studio": "Beijing's landed homes are suburban villas and townhouses in Shunyi and Changping with 3 or more bedrooms; studio landed homes are not built.",
        "house-1br": "New villa land has been banned since 2003 and existing villas are family homes of 3 or more bedrooms, so there is no 1-bedroom landed segment.",
        "house-2br": "Small landed homes are hutong courtyard houses (siheyuan) in Dongcheng and Xicheng, scarce and often with mixed public and private title, so no normal 2-bedroom landed market exists."
      },
      notes: {
        market: "Resale homes are over 70% of Beijing deals (S&P, 2026). Stock is mostly high-rise and older walk-up flats; villas sit in Shunyi and Changping. Prices are still drifting lower.",
        downPaymentPct: "First-home commercial minimum is 15% since Oct 2024. The 1-bed uses 20%, the provident fund minimum, because the fund covers most of its loan.",
        mortgageRate: "First-home floor is LPR less 45bp: 3.05% with the 5-year LPR at 3.5% (Sept 2026), repriced yearly. 1-bed uses 2.64%: ¥2.4m couple provident fund loan at 2.6% plus commercial.",
        riskFreeRate: "1-year government bills yield about 1.2% and 10-year bonds 1.7% (Oct 2026); big-bank term deposits pay about 1%. 1.5% is a mid-point.",
        sellingCostPct: "Beijing buyers customarily pay the whole agent fee. No VAT after 2 years and no income tax on a family's only home held 5+ years. 0.5% allows for fees a seller may concede.",
        rentInflation: "China Index Academy: Beijing rents rose in early 2026 then dipped in Aug, while 50-city rents were -2.45% yoy. 1.5% assumes weak but positive long-run growth.",
        houseGrowth: "NBS resale index: Beijing -3.5% yoy in Aug 2026 after falls since 2021, and agency indices put prices near 2016 levels, a flat decade. 1.5% forward, below Shanghai.",
        setupCost: "Deed tax 1% for a first home up to 140 m2 and 1.5% above (since Dec 2024); buyer pays Lianjia's customary 2.7% (2.2% commission plus 0.5% service fee); registration about ¥100.",
        ownOngoingCost: "Management fee ¥2.5-7/m2/month, winter heating about ¥30/m2 (owners pay it, also for let flats), upkeep and refit reserve ¥100/m2/yr (¥150 villas). No property tax.",
        rentOngoingCost: "Tenants customarily pay a one-month agent fee per new lease, spread over a 2-year lease, plus about ¥150/yr contents cover.",
        caveat: "Purchase limits remain inside the 5th Ring Road. Loans float with the LPR; 40-year terms were allowed from Aug 2026 but Beijing banks were still drafting rules. Rent is usually paid quarterly."
      },
      sources: [
        { name: "NBS, 70-city housing prices, August 2026", url: "https://www.stats.gov.cn/xxgk/sjfb/zxfb2020/202609/t20260915_1965304.html" },
        { name: "S&P Global (China) Ratings, Beijing new policies, Aug 2026", url: "https://www.spgchinaratings.cn/upload/20260814_Beijing%20Real%20Estate%20New%20Policies.pdf" },
        { name: "Beijing News, Beijing 30 Sept 2024 policy (15% first-home down payment)", url: "https://www.bjnews.com.cn/detail/1727706907129963.html" },
        { name: "CityRE (creprice), Beijing listing prices by district, Sept 2026", url: "https://m.creprice.cn/city/bj.html" },
        { name: "CityRE (creprice), Beijing rents by district, Sept 2026", url: "https://m.creprice.cn/city/bj.html?type=lease" },
        { name: "China Index Academy, 50-city rents, August 2026", url: "https://www.cih-index.com/news/2026-09-05/55061650.html" },
        { name: "10jqka, LPR fixing, 20 Sept 2026", url: "https://news.10jqka.com.cn/20260920/c680091504.shtml" },
        { name: "Yicai, 40-year mortgage term rule, Aug 2026", url: "https://www.yicai.com/news/103339038.html" },
        { name: "Trading Economics, China 10-year bond yield, Oct 2026", url: "https://tradingeconomics.com/china/government-bond-yield" }
      ]
    },
    {
      key: "tokyo", city: "Tokyo", country: "Japan", countryId: "Jepang", countryCode: "JP", region: "East Asia",
      aliases: ["東京","Tokyo 23 wards","Tokyo-to"],
      currencySymbol: "¥", currencyCode: "JPY", asOf: "2026-09",
      buyer: "Japanese resident buying a first home to live in, second-hand (chuko) home, no subsidies; the housing-loan tax credit is not modelled",
      downPaymentPct: 10, mortgageRate: 2.51, mortgageTerm: 35, riskFreeRate: 1, horizon: 30, sellingCostPct: 3.5,
      ratePeriods: [{ toYear: 2, type: "floating", rateMin: 1.1, rateMax: 1.35 }, { toYear: 35, type: "floating", rateMin: 1.35, rateMax: 3.83 }],
      rentFreq: "monthly", rentInflation: 2, ownOngoingInflation: 2, rentOngoingInflation: 2,
      homes: {
        "apt-studio": {
          propertyPrice: 36000000, rentAmount: 140000, houseGrowth: 1.5, setupCost: 7.18, ownOngoingCost: 402000, rentOngoingCost: 181000, sqm: 30,
          where: "Inner wards: Shinjuku, Toshima, Nakano, Sumida. A 30 m2 1K or studio, the usual minimum size for a home loan (Flat 35 needs 30 m2 for a condo)",
          setupCalc: "Price ¥36M = ¥1.2M/m2 x 30 m2 (REINS ward average ¥1.31M/m2; MLIT 1K average ¥26.8M, Q1 2026). Agent (3% + ¥60k) x 1.1 = ¥1,254,000; registration under 50 m2: land 1.5% x ¥3.6M + building 2% x ¥5.4M + mortgage 0.4% x ¥32.4M = ¥291,600; acquisition tax 3% x ¥5.4M + 1.5% x ¥3.6M = ¥216,000; stamp ¥10,000; scrivener ¥100,000; bank fee 2.2% x ¥32.4M loan = ¥712,800; total ¥2,584,400 = 7.18%. Assessed value taken as 25% of price (estimate, not sourced)",
          costCalc: "Kanrihi + shuzen ¥20,000/month = ¥240,000 + fixed asset and city planning tax ¥102,000 + fire/quake insurance ¥20,000 + repairs ¥40,000 = ¥402,000/yr (estimate, not sourced). Renter: rent ¥140,000 (interpolated from at home Jul 2026: ¥114,147 under 30 m2, ¥184,051 for 30-50 m2) x 1.15 months (key money, agent fee, renewal, guarantor) + ¥20,000 = ¥181,000/yr"
        },
        "apt-1br": {
          propertyPrice: 60000000, rentAmount: 185000, houseGrowth: 2, setupCost: 7.02, ownOngoingCost: 516000, rentOngoingCost: 233000, sqm: 42,
          where: "Inner wards: Shinagawa, Meguro, Koto, Nakano. A 1LDK of about 42 m2",
          setupCalc: "Price ¥60M = midpoint of REINS ¥1.31M/m2 x 42 m2 (¥55M) and MLIT 1LDK average ¥65.5M (Q1 2026). Agent (3% + ¥60k) x 1.1 = ¥2,046,000; registration under 50 m2: land 1.5% x ¥6M + building 2% x ¥9M + mortgage 0.4% x ¥54M = ¥486,000; acquisition tax 3% x ¥9M + 1.5% x ¥6M = ¥360,000; stamp ¥30,000; scrivener ¥100,000; bank fee 2.2% x ¥54M = ¥1,188,000; total ¥4,210,000 = 7.02%. Assessed value taken as 25% of price (estimate, not sourced)",
          costCalc: "Kanrihi + shuzen ¥23,000/month = ¥276,000 + property taxes ¥170,000 + insurance ¥20,000 + repairs ¥50,000 = ¥516,000/yr (estimate, not sourced). Renter: rent ¥185,000 (at home 30-50 m2, Jul 2026) x 1.15 months + ¥20,000 = ¥233,000/yr"
        },
        "apt-2br": {
          propertyPrice: 90000000, rentAmount: 260000, houseGrowth: 2, setupCost: 5.8, ownOngoingCost: 756000, rentOngoingCost: 319000, sqm: 60,
          where: "Mid and inner wards: Koto, Shinagawa, Setagaya, Itabashi. A 2LDK of about 60 m2, typically 25-30 years old",
          setupCalc: "Price ¥90M = between REINS ¥1.31M/m2 x 60 m2 (¥79M) and MLIT 2LDK average ¥105M (Q1 2026, skewed by central wards). Agent (3% + ¥60k) x 1.1 = ¥3,036,000; registration: land 1.5% x ¥9M + building 0.3% x ¥13.5M + mortgage 0.1% x ¥81M = ¥256,500; acquisition tax ¥0 after deductions; stamp ¥30,000; scrivener ¥120,000; bank fee 2.2% x ¥81M = ¥1,782,000; total ¥5,224,500 = 5.80%. Assessed value taken as 25% of price (estimate, not sourced)",
          costCalc: "Kanrihi + shuzen ¥33,000/month = ¥396,000 + fixed asset and city planning tax ¥255,000 + insurance ¥25,000 + repairs ¥80,000 = ¥756,000/yr (estimate, not sourced). Renter: rent ¥260,000 (at home 50-70 m2 ¥259,881, Jul 2026) x 1.15 months + ¥20,000 = ¥319,000/yr"
        },
        "apt-4br": {
          propertyPrice: 105000000, rentAmount: 380000, houseGrowth: 2, setupCost: 5.8, ownOngoingCost: 968000, rentOngoingCost: 457000, sqm: 90,
          where: "Outer family wards: Setagaya, Nerima, Suginami, Edogawa. A 4LDK of about 90 m2; a thin segment, as most Tokyo family condos are 3LDK",
          setupCalc: "Price ¥105M from MLIT 4LDK average ¥103.9M (Q1 2026); REINS ¥1.31M/m2 x 90 m2 = ¥118M. Agent (3% + ¥60k) x 1.1 = ¥3,531,000; registration: land 1.5% x ¥10.5M + building 0.3% x ¥15.75M + mortgage 0.1% x ¥94.5M = ¥299,250; acquisition tax ¥0; stamp ¥60,000; scrivener ¥120,000; bank fee 2.2% x ¥94.5M = ¥2,079,000; total ¥6,089,250 = 5.80%. Assessed value taken as 25% of price (estimate, not sourced)",
          costCalc: "Kanrihi + shuzen ¥45,000/month = ¥540,000 + property taxes ¥297,500 + insurance ¥30,000 + repairs ¥100,000 = ¥968,000/yr (estimate, not sourced). Renter: rent ¥380,000 (at home over 70 m2 averages ¥416,440 incl. central luxury; family-ward 4LDK set lower (estimate, not sourced)) x 1.15 months + ¥20,000 = ¥457,000/yr"
        },
        "house-4br": {
          propertyPrice: 70000000, rentAmount: 270000, houseGrowth: 1.5, setupCost: 6.33, ownOngoingCost: 545000, rentOngoingCost: 331000, sqm: 92, landSqm: 88,
          where: "Outer wards where kodate are common: Setagaya, Nerima, Adachi, Edogawa, Suginami. A used 3-4LDK, about 25 years old. Cheaper than the 4LDK condo because the building is worth little and lots are small",
          setupCalc: "Price ¥70M = at home median asking price ¥69.8M (23 wards, H1 2026; building 91.9 m2, land 88.2 m2, age 24.7). Agent (3% + ¥60k) x 1.1 = ¥2,376,000; registration: land 1.5% x ¥29.4M + building 0.3% x ¥4.2M + mortgage 0.1% x ¥63M = ¥516,600; acquisition tax ¥0 after deductions; stamp ¥30,000; scrivener ¥120,000; bank fee 2.2% x ¥63M = ¥1,386,000; total ¥4,428,600 = 6.33%. Assessed land 42% and building 6% of price (estimate, not sourced)",
          costCalc: "Fixed asset tax (land at 1/6) ¥68,600 + city planning tax ¥14,700 + building ¥71,400 = ¥154,700 + fire and quake insurance (wooden) ¥90,000 + upkeep about 1%/yr of a ¥25M rebuild cost plus repainting ¥300,000 = ¥545,000/yr (estimate, not sourced). Renter: rent ¥270,000 (SUUMO Nerima 4LDK ¥329,000 is for new units near stations; older house set lower (estimate, not sourced)) x 1.15 months + ¥20,000 = ¥331,000/yr",
          sources: [
            { name: "at home, used detached house prices, H1 2026", url: "https://www.athome.co.jp/corporate/wp-content/themes/news/pdf/chuuko-kodate-kakaku-2026-firsthalf/chuuko-kodate-kakaku-2026-firsthalf.pdf" },
            { name: "SUUMO, Nerima rent by layout, Jul 2026", url: "https://suumo.jp/chintai/soba/tokyo/sc_nerima/" }
          ]
        }
      },
      unavailable: {
        "house-studio": "Tokyo detached houses are family homes; a studio kodate essentially does not exist as a market.",
        "house-1br": "One-bedroom detached houses are very rare in Tokyo; even small lots are built as 3-storey 3LDK-4LDK houses.",
        "house-2br": "Tokyo kodate are built as 3LDK-4LDK family homes (median 92-96 m2); 2-bedroom houses are mostly old stock sold as land for rebuilding, so no typical price or rent exists."
      },
      notes: {
        market: "The 23 wards are a condo (mansion) market with many renters; kodate detached houses cluster in outer wards such as Setagaya, Nerima, Adachi, Edogawa and Suginami.",
        downPaymentPct: "Japanese banks lend up to the full price, and Flat 35 gives its lowest rate at 90% loan-to-value or less, so 10% down is used.",
        mortgageRate: "Variable loans: 1.1-1.35% at big banks in Oct 2026 after the BOJ hike to 1.25%; from year 3 anywhere up to the 3.83% Flat 35 fixed rate, as variable rates are likely to rise.",
        riskFreeRate: "Megabank 1-year time deposits pay 0.5% (Aug 2026); online banks and short JGBs pay more after the BOJ raised its rate to 1.25%, so 1.0% is used (estimate, not sourced).",
        sellingCostPct: "Seller's agent fee 3% + ¥60,000 + 10% tax (about 3.4%) plus stamp duty and mortgage discharge; the ¥30M home-sale deduction usually removes capital gains tax.",
        rentInflation: "at home 23-ward asking rents rose 5-10% in the year to Jul 2026 and about 3-4% a year since 2015 after flat decades; 2% is used for the long run.",
        houseGrowth: "MLIT deals: 23-ward condo price per m2 rose 4.8% a year 2015-2025, but units age and prices stalled in mid-2026, so 1.5-2%. Houses follow land (Nerima land +1.9%/yr over 20 years).",
        setupCost: "Agent 3% + ¥60,000 + tax, bank fee 2.2% of loan, registration tax (1.5% land, 0.3% building, 0.1% mortgage; higher under 50 m2), stamp duty, scrivener. Acquisition tax only under 50 m2.",
        ownOngoingCost: "Fixed asset tax 1.4% and city planning tax 0.3% of assessed value (cut for small residential land), condo kanrihi and shuzen tsumitatekin, fire and quake insurance, repairs.",
        rentOngoingCost: "Key money 1 month and agent fee 1.1 months spread over a 4-year stay, renewal fee 1 month every 2 years, guarantor company fee and tenant fire insurance.",
        caveat: "Not modelled: the mortgage tax credit (0.7% of the loan balance a year) and building depreciation, which makes older homes trade mostly on land value."
      },
      sources: [
        { name: "Tokyo Kantei via nomu.com, used condo asking price per 70 m2, Aug 2026", url: "https://www.nomu.com/mansion/library/trend/report/70m2_20260924.html" },
        { name: "REINS data via IESHIL, Tokyo wards used condo contract price per m2, Jun 2026", url: "https://www.ieshil.com/columns/1349/" },
        { name: "Diamond Fudosan, Tokyo used condo prices by area (REINS), Aug 2026", url: "https://diamond-fudosan.jp/articles/-/1113321" },
        { name: "Land Price Japan, MLIT used condo transaction prices by layout, 23 wards, 2015-2026 Q1", url: "https://tochidai.info/mansion/tokyo23/" },
        { name: "at home, asking rents by size band, Jul 2026", url: "https://www.athome.co.jp/corporate/wp-content/themes/news/pdf/chintai-yachin-202607/chintai-yachin-202607.pdf" },
        { name: "at home, used detached house prices, H1 2026", url: "https://www.athome.co.jp/corporate/wp-content/themes/news/pdf/chuuko-kodate-kakaku-2026-firsthalf/chuuko-kodate-kakaku-2026-firsthalf.pdf" },
        { name: "Diamond Fudosan, major bank mortgage rates, Oct 2026", url: "https://diamond-fudosan.jp/articles/-/1113331" },
        { name: "Kyodo via OANDA, Flat 35 rate 3.83%, Oct 2026", url: "https://www.oanda.jp/lab-education/?p=129425" },
        { name: "Land Price Japan, Nerima ward land prices 2006-2026", url: "https://tochidai.info/tokyo/nerima/" },
        { name: "SUUMO, Nerima rent by layout, Jul 2026", url: "https://suumo.jp/chintai/soba/tokyo/sc_nerima/" }
      ]
    },
    {
      key: "seoul", city: "Seoul", country: "South Korea", countryId: "Korea Selatan", countryCode: "KR", region: "East Asia",
      aliases: ["서울","Seoul Metropolitan City"],
      currencySymbol: "₩", currencyCode: "KRW", asOf: "2026-09",
      buyer: "Korean citizen buying a first home to live in, using the first-time buyer 70% LTV within the Seoul loan caps; no other subsidies or acquisition-tax relief",
      downPaymentPct: 30, mortgageRate: 4.73, mortgageTerm: 30, riskFreeRate: 3.2, horizon: 30, sellingCostPct: 1,
      ratePeriods: [{ toYear: 5, type: "fixed", rate: 4.88 }, { toYear: 30, type: "floating", rateMin: 4.53, rateMax: 4.88 }],
      rentFreq: "monthly", rentInflation: 3, ownOngoingInflation: 2, rentOngoingInflation: 2,
      homes: {
        "apt-studio": {
          propertyPrice: 311000000, rentAmount: 1250000, houseGrowth: 1, setupCost: 5.49, ownOngoingCost: 930000, rentOngoingCost: 350000, sqm: 30, downPaymentPct: 30,
          where: "One-room and 1.5-room officetels (commercial buildings) near job hubs: Gangnam, Yeouido-Yeongdeungpo, Mapo, Jongno-Jung. KB Seoul officetel average; size is an estimate",
          setupCalc: "Price = KB Seoul officetel average ₩311M (Sep 2026). Officetel acquisition tax 4% + education 0.4% + rural 0.2% = 4.6% = ₩14,306,000; broker 0.5% + 10% VAT = ₩1,710,500; stamp duty buyer half ₩75,000 + loan stamp half ₩75,000; housing bond discount about 0.1% = ₩311,000 and scrivener ₩600,000 (estimate, not sourced); total ₩17,077,500 = 5.49%",
          costCalc: "Building and land property tax about ₩450,000 + sinking fund ₩150,000 + repairs ₩300,000 + insurance ₩30,000 = ₩930,000/yr (estimate, not sourced). Rent: KB yield 5.0% x (₩311M - ₩10M deposit) / 12 = ₩1,250,000/month (Numbeo central 1-bed range ₩1.0-1.5M). Renter: broker 0.4% x (₩10M + 100 x ₩1.25M) x 1.1 / 2 years = ₩297,000 + contents ₩50,000 = ₩350,000/yr",
          sources: [
            { name: "KB Real Estate, Seoul officetel price and yield, Sep 2026", url: "https://data-api.kbland.kr/bfmstat/statusBoard/mntlyOfficeRentReturn" }
          ]
        },
        "apt-1br": {
          propertyPrice: 420000000, rentAmount: 1540000, houseGrowth: 1, setupCost: 5.43, ownOngoingCost: 1230000, rentOngoingCost: 410000, sqm: 42, downPaymentPct: 30,
          where: "Two-room officetels (1 bedroom + living room) of about 42 m2 in Mapo, Yeongdeungpo, Songpa, Gangseo. Korean apartments rarely have only one bedroom",
          setupCalc: "Price ₩420M = KB officetel average ₩311M scaled to 42 m2 at about ₩10M/m2 (estimate, not sourced). Officetel tax 4.6% = ₩19,320,000; broker 0.5% + VAT = ₩2,310,000; stamps ₩150,000; bond ₩420,000; scrivener ₩600,000; total ₩22,800,000 = 5.43%",
          costCalc: "Property tax ₩600,000 + sinking fund ₩200,000 + repairs ₩400,000 + insurance ₩30,000 = ₩1,230,000/yr (estimate, not sourced). Rent: 4.5% yield (below KB's 5.0% average, as bigger units yield less) x (₩420M - ₩10M) / 12 = ₩1,540,000 (estimate, not sourced). Renter: broker 0.4% x (₩10M + 100 x ₩1.54M) x 1.1 / 2 = ₩361,000 + contents ₩50,000 = ₩410,000/yr"
        },
        "apt-2br": {
          propertyPrice: 1080000000, rentAmount: 1760000, houseGrowth: 3.5, setupCost: 4.06, ownOngoingCost: 1900000, rentOngoingCost: 570000, sqm: 50, downPaymentPct: 44,
          where: "Small apartments up to 60 m2 (KB size band; about 50 m2 assumed), usually 2 rooms, in Mapo, Seongdong, Dongjak, Nowon. Loan capped at ₩600M, so 44% down. Low yield is normal in Seoul",
          setupCalc: "Price = KB Seoul apartment average up to 60 m2, ₩1.079bn (Sep 2026). Acquisition tax 3% + education 0.3% = ₩35,640,000; broker 0.5% + VAT = ₩5,940,000; stamp half of ₩350,000 + loan stamp half = ₩250,000; housing bond 3.1% of ₩702M assessed price at about 6% discount = ₩1,305,720 and scrivener ₩700,000 (estimate, not sourced); total ₩43,835,720 = 4.06%",
          costCalc: "Property tax on ₩702M assessed (65% of market): 45% base, one-home rate ₩460,650 + city levy ₩442,260 + education ₩92,130 = ₩995,040 + sinking fund ₩250,000 + insurance ₩50,000 + repairs ₩600,000 = ₩1,900,000/yr (estimate, not sourced). Rent: KB jeonse ₩487M; wolse ₩100M deposit + (₩487M - ₩100M) x 4.29% / 12 = ₩1,384,000, plus ₩90M of deposit at the 5.0% legal rate = ₩375,000, total ₩1,760,000. Renter: broker 0.3% x ₩238M x 1.1 / 2 = ₩393,000 + deposit guarantee ₩130,000 + contents ₩50,000 = ₩570,000/yr"
        },
        "apt-4br": {
          propertyPrice: 2130000000, rentAmount: 3470000, houseGrowth: 3.5, setupCost: 4.44, ownOngoingCost: 5170000, rentOngoingCost: 855000, sqm: 120, downPaymentPct: 81,
          where: "Large 102-135 m2 apartments (40-50 pyeong, KB size band) in Songpa, Gangdong, Yangcheon (Mokdong), Mapo; Gangnam-Seocho cost far more. Loan capped at ₩400M above ₩1.5bn, so 81% down",
          setupCalc: "Price = KB Seoul apartment average 102-135 m2, ₩2.131bn (Sep 2026). Acquisition tax 3% + education 0.3% + rural 0.2% = ₩74,550,000; broker 0.7% + VAT = ₩16,401,000; stamps ₩250,000; housing bond 3.1% of ₩1.385bn assessed at about 6% discount = ₩2,575,170 and scrivener ₩800,000 (estimate, not sourced); total ₩94,576,170 = 4.44%",
          costCalc: "Property tax on ₩1.385bn assessed: ₩1,862,100 + city levy ₩872,235 + education ₩372,420 = ₩3,106,755 + holding tax on the part above ₩1.2bn about ₩266,000 + sinking fund ₩550,000 + insurance ₩50,000 + repairs ₩1,200,000 = ₩5,170,000/yr (estimate, not sourced). Rent: KB jeonse ₩965M; ₩100M deposit + ₩865M x 4.29% / 12 = ₩3,092,000, plus ₩375,000 for ₩90M deposit at 5.0% = ₩3,470,000. Renter: broker 0.3% x ₩409M x 1.1 / 2 = ₩675,000 + guarantee ₩130,000 + contents ₩50,000 = ₩855,000/yr"
        },
        "house-4br": {
          propertyPrice: 1250000000, rentAmount: 1990000, houseGrowth: 2.5, setupCost: 4.35, ownOngoingCost: 4710000, rentOngoingCost: 610000, sqm: 180, downPaymentPct: 52,
          where: "Older detached houses (dandok) in Yeonhui-dong, Mangwon, Seongbuk-dong, Bangbae-dong; many are split into rental units and whole-house rentals are thin. Cheaper than the 4-bed apartment: old houses on lanes and hills, while Seoul pays a premium for apartment complexes",
          setupCalc: "Price = KB Seoul detached house average ₩1.247bn (Sep 2026); about 180 m2 implied by KB's ₩6.9M/m2. Acquisition tax 3% + education 0.3% + rural 0.2% = ₩43,750,000; broker 0.6% + VAT = ₩8,250,000; stamps ₩250,000; housing bond 3.1% of ₩688M assessed (55% of market) at about 6% discount = ₩1,278,750 and scrivener ₩800,000 (estimate, not sourced); total ₩54,328,750 = 4.35%",
          costCalc: "Property tax on ₩688M assessed: ₩437,812 + city levy ₩433,125 + education ₩87,562 = ₩958,500 + fire insurance ₩150,000 + upkeep about 1% of a ₩360M rebuild cost ₩3,600,000 = ₩4,710,000/yr (estimate, not sourced). Rent: KB detached jeonse ₩551M; ₩100M deposit + ₩451M x 4.29% (apartment rate) / 12 = ₩1,610,000, plus ₩375,000 for ₩90M at 5.0% = ₩1,990,000. Renter: broker 0.3% x ₩261M x 1.1 / 2 = ₩431,000 + guarantee ₩130,000 + contents ₩50,000 = ₩610,000/yr"
        }
      },
      unavailable: {
        "house-studio": "Seoul has no market for studio detached houses; one-person households live in officetels, villas and one-room units in multi-household houses.",
        "house-1br": "One-bedroom detached houses are not a Seoul market; small house plots are built as multi-household buildings (dagagu) let room by room.",
        "house-2br": "Small detached houses in Seoul are mostly old houses bought for the land or redevelopment and let as split units, so no typical whole-house price and rent can be quoted."
      },
      notes: {
        market: "Seoul is an apartment city of large complexes; renters pay big deposits, either jeonse (deposit only) or wolse (deposit plus monthly rent). Officetels house many singles.",
        downPaymentPct: "First-time buyers in regulated Seoul may borrow 70%, capped at ₩600M (₩400M above ₩1.5bn), so the 2-bed, 4-bed and house need 44-81% down (estimate, not sourced).",
        mortgageRate: "Bank of Korea, Aug 2026: new mortgages averaged 4.66%, fixed-type (5-year mixed) 4.88%, variable 4.53%. Fixed 4.88% for 5 years, then variable 4.53 to 4.88%. Base rate 3.00%.",
        riskFreeRate: "Bank of Korea: new 1-2 year bank time deposits paid 3.40% in Aug 2026 and all time deposits 3.14%; 3.2% is used.",
        sellingCostPct: "Seller's broker fee 0.5-0.7% plus VAT and stamp duty; one-home capital gains tax is exempt up to ₩1.2bn after 2 years' residence, so 1% is used (estimate, not sourced).",
        rentInflation: "KB apartment wolse index rose 4.5% a year from Dec 2015 to Sep 2026 and 7.5% a year over the last 5 years as jeonse shifted to wolse; 3% is used long run.",
        houseGrowth: "KB Seoul apartment index: +4.3% a year over 20 years, +6.6% over 10 (to Sep 2026); detached houses +2.8% over 20 years; officetels have lagged. Tempered forward.",
        setupCost: "Acquisition tax for one-home buyers 1% to ₩600M, sliding to 3% above ₩900M, plus 10% education tax (+0.2% over 85 m2); officetels 4.6%. Plus broker fee, stamp, bond, scrivener (estimate, not sourced).",
        ownOngoingCost: "Property tax on an assessed price taken as 55-65% of market, holding tax above ₩1.2bn, sinking fund, insurance and repairs. Management fees excluded: tenants pay them too (estimate, not sourced).",
        rentOngoingCost: "Tenant's broker fee (0.3-0.4% of deposit plus 100 x monthly rent, plus VAT) per 2-year lease, deposit guarantee insurance and contents cover (estimate, not sourced).",
        caveat: "Jeonse and wolse deposits are not modelled: deposits were turned into monthly rent at KB's 4.29% market rate and the 5.0% legal rate. Officetels are commercial buildings. DSR limits not modelled."
      },
      sources: [
        { name: "KB Real Estate monthly survey, Seoul apartment sale and jeonse prices by size, Sep 2026", url: "https://data-api.kbland.kr/bfmstat/weekMnthlyHuseTrnd/avgPrcPerAptSmeu" },
        { name: "KB Real Estate, apartment and detached house price indices, 2006-2026", url: "https://data-api.kbland.kr/bfmstat/weekMnthlyHuseTrnd/priceIndex" },
        { name: "KB Real Estate, apartment wolse index, 2015-2026", url: "https://data-api.kbland.kr/bfmstat/weekMnthlyHuseTrnd/mntlyAptMrpayPrcIndx" },
        { name: "KB Real Estate, jeonse-to-wolse conversion rate, Sep 2026", url: "https://data-api.kbland.kr/bfmstat/weekMnthlyHuseTrnd/jnmnrnCnvsnRt" },
        { name: "KB Real Estate, detached house sale and jeonse prices, Sep 2026", url: "https://data-api.kbland.kr/bfmstat/weekMnthlyHuseTrnd/avgPrc" },
        { name: "KB Real Estate, Seoul officetel price, yield and jeonse ratio, Sep 2026", url: "https://data-api.kbland.kr/bfmstat/statusBoard/mntlyOfficePrice" },
        { name: "Bank of Korea, base rate history", url: "https://www.bok.or.kr/portal/singl/baseRate/list.do?dataSeCd=01&menuNo=200643" },
        { name: "Bank of Korea ECOS, new mortgage rates (121Y006), 2025-2026", url: "https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/121Y006/M/202511/202608/BECBLA0302" },
        { name: "Bank of Korea ECOS, new time deposit rates (121Y002), 2025-2026", url: "https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/121Y002/M/202511/202608/BEABAA2113" },
        { name: "Numbeo, Seoul rents and prices (cross-check), Oct 2026", url: "https://www.numbeo.com/cost-of-living/in/Seoul?displayCurrency=KRW" }
      ]
    },
    {
      key: "mumbai", city: "Mumbai", country: "India", countryId: "India", countryCode: "IN", region: "South Asia",
      aliases: ["Bombay"],
      currencySymbol: "₹", currencyCode: "INR", asOf: "2026-10",
      buyer: "Indian resident citizen buying a first home to live in: a ready-to-move resale flat (no GST), no women's stamp duty concession",
      downPaymentPct: 25, mortgageRate: 7.75, mortgageTerm: 30, riskFreeRate: 6.25, horizon: 30, sellingCostPct: 1.5,
      rentFreq: "monthly", rentInflation: 5, ownOngoingInflation: 5, rentOngoingInflation: 5,
      homes: {
        "apt-studio": {
          propertyPrice: 6200000, rentAmount: 25000, houseGrowth: 5, setupCost: 8.18, ownOngoingCost: 31500, rentOngoingCost: 18638, sqm: 24, downPaymentPct: 20,
          where: "1RK (one room plus kitchen) in older buildings in the western and eastern suburbs: Andheri, Vile Parle, Kandivali, Bhandup. Magicbricks Oct 2026 listings: median ₹65 lakh for about 280 sq ft, rents ₹22k to 30k. Carpet area about 260 sq ft. Loan of ₹30 to 75 lakh allows 80% LTV",
          setupCalc: "Stamp duty 6% (5% + 1% metro cess) ₹3,72,000 + registration 1% capped at ₹30,000 + buyer brokerage 1% + 18% GST ₹73,160 + legal and title search ₹20,000 + loan processing ₹11,800 (fees estimate, not sourced) = ₹5,06,960 = 8.18%. Resale, so no GST",
          costCalc: "society maintenance ₹2,000 x 12 ₹24,000 + BMC property tax, mostly waived under 500 sq ft (estimate, not sourced) ₹1,000 + home insurance ₹1,500 + upkeep (estimate, not sourced) ₹5,000 = ₹31,500/yr; renter: brokerage 1 month (₹25,000) every 22 months ₹13,636 + 11-month leave and licence (stamp duty 0.25% ₹710 + registration ₹1,000 + filing ₹1,500, annualised) ₹3,502 + contents insurance ₹1,500 = ₹18,638/yr",
          sources: [
            { name: "Magicbricks, studio apartments for sale in Mumbai (Oct 2026)", url: "https://www.magicbricks.com/studio-apartment-for-sale-in-mumbai-pppfs" },
            { name: "Magicbricks, studio apartments for rent in Mumbai", url: "https://www.magicbricks.com/studio-apartment-for-rent-in-mumbai-pppfr" }
          ]
        },
        "apt-1br": {
          propertyPrice: 13000000, rentAmount: 52000, houseGrowth: 5, setupCost: 7.66, ownOngoingCost: 72000, rentOngoingCost: 34203, sqm: 40,
          where: "1BHK in Andheri East and West, Powai, Chembur, Goregaon East. Magicbricks Oct 2026 listing medians ₹1.13 to 1.62 crore (mean ₹1.37 crore, less 5% for negotiation) and rents ₹45.5k to 63.5k. Carpet area about 425 sq ft",
          setupCalc: "Stamp duty 6% (5% + 1% metro cess) ₹7,80,000 + registration 1% capped at ₹30,000 + buyer brokerage 1% + 18% GST ₹1,53,400 + legal and title search ₹20,000 + loan processing ₹11,800 (fees estimate, not sourced) = ₹9,95,200 = 7.66%. Resale, so no GST",
          costCalc: "society maintenance ₹5,000 x 12 (listing median) ₹60,000 + BMC property tax, mostly waived under 500 sq ft (estimate, not sourced) ₹1,500 + home insurance ₹2,500 + upkeep (estimate, not sourced) ₹8,000 = ₹72,000/yr; renter: brokerage 1 month (₹52,000) every 22 months ₹28,364 + 11-month leave and licence (stamp duty 0.25% ₹1,478 + registration ₹1,000 + filing ₹1,500, annualised) ₹4,339 + contents insurance ₹1,500 = ₹34,203/yr",
          sources: [
            { name: "Magicbricks, 1 BHK flats for sale in Andheri East", url: "https://www.magicbricks.com/1-bhk-flats-in-andheri-east-mumbai-for-sale-pppfs" },
            { name: "Magicbricks, 1 BHK flats for rent in Andheri West", url: "https://www.magicbricks.com/1-bhk-flats-for-rent-in-andheri-west-mumbai-pppfr" }
          ]
        },
        "apt-2br": {
          propertyPrice: 20500000, rentAmount: 80000, houseGrowth: 5, setupCost: 7.48, ownOngoingCost: 111500, rentOngoingCost: 50343, sqm: 65,
          where: "2BHK in Andheri East and West, Powai, Chembur, Goregaon East. Magicbricks Oct 2026 listing medians ₹1.9 to 2.6 crore (mean ₹2.17 crore, less 5% for negotiation) and rents ₹75k to 90k. Carpet area about 700 sq ft",
          setupCalc: "Stamp duty 6% (5% + 1% metro cess) ₹12,30,000 + registration 1% capped at ₹30,000 + buyer brokerage 1% + 18% GST ₹2,41,900 + legal and title search ₹20,000 + loan processing ₹11,800 (fees estimate, not sourced) = ₹15,33,700 = 7.48%. Resale, so no GST",
          costCalc: "society maintenance ₹7,000 x 12 (listing median) ₹84,000 + BMC property tax (estimate, not sourced) ₹12,000 + home insurance ₹3,500 + upkeep (estimate, not sourced) ₹12,000 = ₹1,11,500/yr; renter: brokerage 1 month (₹80,000) every 22 months ₹43,636 + 11-month leave and licence (stamp duty 0.25% ₹2,273 + registration ₹1,000 + filing ₹1,500, annualised) ₹5,207 + contents insurance ₹1,500 = ₹50,343/yr",
          sources: [
            { name: "Magicbricks, 2 BHK flats for sale in Andheri East", url: "https://www.magicbricks.com/2-bhk-flats-in-andheri-east-mumbai-for-sale-pppfs" },
            { name: "Magicbricks, 2 BHK flats for rent in Powai", url: "https://www.magicbricks.com/2-bhk-flats-for-rent-in-powai-mumbai-pppfr" }
          ]
        },
        "apt-4br": {
          propertyPrice: 145000000, rentAmount: 500000, houseGrowth: 5, setupCost: 7.22, ownOngoingCost: 705000, rentOngoingCost: 295954, sqm: 195,
          where: "Luxury segment: 4BHK towers in Worli, Prabhadevi, Lower Parel, Bandra West. Magicbricks Oct 2026 listing medians ₹14.6 to 16.9 crore (less 5%) and rents ₹4.65 to 5.8 lakh a month. Carpet area about 2,100 sq ft",
          setupCalc: "Stamp duty 6% (5% + 1% metro cess) ₹87,00,000 + registration 1% capped at ₹30,000 + buyer brokerage 1% + 18% GST ₹17,11,000 + legal and title search ₹20,000 + loan processing ₹11,800 (fees estimate, not sourced) = ₹1,04,72,800 = 7.22%. Resale, so no GST",
          costCalc: "society maintenance ₹40,000 x 12 (listing median) ₹4,80,000 + BMC property tax (estimate, not sourced) ₹1,50,000 + home insurance ₹15,000 + upkeep (estimate, not sourced) ₹60,000 = ₹7,05,000/yr; renter: brokerage 1 month (₹5,00,000) every 22 months ₹2,72,727 + 11-month leave and licence (stamp duty 0.25% ₹14,208 + registration ₹1,000 + filing ₹1,500, annualised) ₹18,227 + contents insurance ₹5,000 = ₹2,95,954/yr",
          sources: [
            { name: "Magicbricks, 4 BHK flats for sale in Worli (605 listings)", url: "https://www.magicbricks.com/4-bhk-flats-in-worli-mumbai-for-sale-pppfs" },
            { name: "Magicbricks, 4 BHK flats for rent in Worli", url: "https://www.magicbricks.com/4-bhk-flats-for-rent-in-worli-mumbai-pppfr" }
          ]
        }
      },
      unavailable: {
        "house-studio": "Land in Mumbai is too scarce and costly for small houses; one-room houses exist only as chawl or slum rooms, not as a mortgageable landed segment.",
        "house-1br": "Small landed homes survive only in old gaothan villages and koliwadas, often with unclear title, so banks rarely lend and no typical price can be quoted.",
        "house-2br": "Two-bedroom landed houses are a rarity in Mumbai: about 780 'independent houses' are listed metro-wide, many in Vasai or Palghar, versus over 1,000 2BHK flats in Andheri West alone.",
        "house-4br": "Bungalows in Juhu, Bandra (Pali Hill) and Malabar Hill are an ultra-luxury curiosity trading at ₹50 crore and up, too few and too varied to quote a typical price or rent."
      },
      notes: {
        market: "A city of flats sold by carpet area (sizes here are carpet). Landed homes are a tiny niche. Prices are Magicbricks October 2026 resale listing medians, less 5%.",
        downPaymentPct: "RBI LTV caps: 75% for loans over ₹75 lakh, 80% for ₹30 to 75 lakh, so 25% down (20% for the 1RK). Stamp duty is not financed (estimate, not sourced).",
        mortgageRate: "Floating loans linked to the RBI repo rate (5.25%, held in August 2026). SBI from 7.25% (April 2026), HDFC about 7.75 to 7.9%. 7.75% assumed.",
        riskFreeRate: "SBI fixed deposit rate for 1 to 2 years is 6.25% (effective December 2025, page updated June 2026). Interest is taxable.",
        sellingCostPct: "Seller brokerage about 1% plus 18% GST and minor legal costs (estimate, not sourced). Capital gains tax of 12.5% is not included.",
        rentInflation: "Mumbai rents jumped in 2022 to 2025 and are now steadier. 5% a year long run, about CPI plus a little (estimate, not sourced).",
        houseGrowth: "Prices were roughly flat from 2014 to 2020 and rose strongly from 2021; Magicbricks shows mostly small 2025 to 2026 gains. 5% a year assumed (estimate, not sourced).",
        setupCost: "Stamp duty 6% in Mumbai (5% plus 1% metro cess), registration 1% capped at ₹30,000, buyer brokerage 1% plus GST, legal and loan fees. No GST on resale.",
        ownOngoingCost: "Society maintenance from Magicbricks listing data, BMC property tax (waived up to 500 sq ft), insurance and upkeep (tax and upkeep estimate, not sourced).",
        rentOngoingCost: "Brokerage of one month's rent per move (every 22 months assumed), plus 0.25% stamp duty and ₹1,000 registration on each 11-month leave and licence.",
        caveat: "Tenants lodge 3 to 6 months' rent as deposit. Under-construction flats add 5% GST and delay risk. Seller capital gains tax is not modelled."
      },
      sources: [
        { name: "Magicbricks, property rates and trends in Mumbai, Jul to Sep 2026", url: "https://www.magicbricks.com/Property-Rates-Trends/ALL-RESIDENTIAL-rates-in-Mumbai" },
        { name: "Magicbricks, Andheri West apartment rates Q3 2026", url: "https://www.magicbricks.com/Property-Rates-Trends/Multistorey-Apartment-rates-Andheri-West-in-Mumbai" },
        { name: "Magicbricks, Powai apartment rates Q3 2026", url: "https://www.magicbricks.com/Property-Rates-Trends/Multistorey-Apartment-rates-Powai-in-Mumbai" },
        { name: "Magicbricks, 2 BHK flats for sale in Chembur", url: "https://www.magicbricks.com/2-bhk-flats-in-chembur-mumbai-for-sale-pppfs" },
        { name: "Magicbricks, independent houses for sale in Mumbai", url: "https://www.magicbricks.com/independent-house-for-sale-in-mumbai-pppfs" },
        { name: "SBI, retail domestic term deposit rates", url: "https://sbi.bank.in/web/interest-rates/deposit-rates/retail-domestic-term-deposits" },
        { name: "SBI, home loan interest rates (April 2026)", url: "https://sbi.bank.in/web/interest-rates/interest-rates/loan-schemes-interest-rates/home-loans-interest-rates-current" },
        { name: "Outlook Money, RBI keeps repo rate at 5.25% (August 2026)", url: "https://www.outlookmoney.com/banking/rbi-mpc-august-2026-meeting-live-updates-governor-sanjay-malhotra-speech-repo-rate-inflation-gdp-news" }
      ]
    },
    {
      key: "dubai", city: "Dubai", country: "United Arab Emirates", countryId: "Uni Emirat Arab", countryCode: "AE", region: "Middle East",
      aliases: ["UAE"],
      currencySymbol: "Dh", currencyCode: "AED", asOf: "2026-09",
      buyer: "UAE resident expat buying a first home to live in, at or under AED 5M with an 80% LTV mortgage",
      downPaymentPct: 20, mortgageRate: 5.29, mortgageTerm: 25, riskFreeRate: 3.5, horizon: 25, sellingCostPct: 2.2,
      ratePeriods: [{ toYear: 5, type: "fixed", rate: 4.15 }, { toYear: 25, type: "floating", rateMin: 5.4, rateMax: 5.75 }],
      rentFreq: "yearly", rentInflation: 3, ownOngoingInflation: 2.5, rentOngoingInflation: 2.5,
      homes: {
        "apt-studio": {
          propertyPrice: 750000, rentAmount: 58000, houseGrowth: 2.5, setupCost: 8.24, ownOngoingCost: 8300, rentOngoingCost: 1735, sqm: 39,
          where: "Mid-market and central towers: JVC, JLT, Business Bay, Dubai Marina. Price blends the DLD median for JVC studios (Dh580k, Q1 2026) with Bayut asking prices in Business Bay and the Marina, less the 2026 dip. Area is built-up (about 420 sq ft)",
          setupCalc: "DLD transfer 4% Dh30,000 + DLD admin Dh580 + trustee office Dh4,000 + VAT = Dh4,200 + mortgage registration 0.25% of Dh600,000 loan + Dh290 = Dh1,790 + buyer agent 2% + VAT Dh15,750 + bank arrangement 1% of loan + VAT Dh6,300 + valuation Dh3,150 = Dh61,770 = 8.24%",
          costCalc: "service charge 420 sq ft x Dh15 Dh6,300 + contents and fit-out insurance Dh500 + upkeep (AC servicing, repairs, estimate, not sourced) Dh1,500 = Dh8,300/yr; renter: agency fee 5% + VAT on Dh58,000 spread over 3 years Dh1,015 + Ejari Dh220 + contents insurance Dh500 = Dh1,735/yr",
          sources: [
            { name: "Oliva, JVC apartment prices and yields 2026 (DLD data)", url: "https://joinoliva.com/en/learn/blog/jvc-apartment-prices-and-yields-2026" }
          ]
        },
        "apt-1br": {
          propertyPrice: 1250000, rentAmount: 88000, houseGrowth: 2.5, setupCost: 7.8, ownOngoingCost: 14300, rentOngoingCost: 2260, sqm: 72,
          where: "JVC, JLT, Business Bay, Dubai Marina. Price blends DLD median for JVC 1-beds (Dh920k) with Bayut H1 2026 asking prices (Business Bay Dh1.62M, Marina Dh1.72M), trimmed for 2026 softening. Built-up about 780 sq ft",
          setupCalc: "DLD transfer 4% Dh50,000 + DLD admin Dh580 + trustee office Dh4,000 + VAT = Dh4,200 + mortgage registration 0.25% of Dh1,000,000 loan + Dh290 = Dh2,790 + buyer agent 2% + VAT Dh26,250 + bank arrangement 1% of loan + VAT Dh10,500 + valuation Dh3,150 = Dh97,470 = 7.80%",
          costCalc: "service charge 780 sq ft x Dh15 Dh11,700 + contents and fit-out insurance Dh600 + upkeep (estimate, not sourced) Dh2,000 = Dh14,300/yr; renter: agency fee 5% + VAT on Dh88,000 spread over 3 years Dh1,540 + Ejari Dh220 + contents insurance Dh500 = Dh2,260/yr"
        },
        "apt-2br": {
          propertyPrice: 2000000, rentAmount: 130000, houseGrowth: 2.5, setupCost: 7.55, ownOngoingCost: 22450, rentOngoingCost: 3095, sqm: 116,
          where: "JVC, JLT, Business Bay, Dubai Marina. Price blends DLD median for JVC 2-beds (Dh1.4M) with Bayut H1 2026 asking prices (Business Bay Dh2.49M, Marina Dh2.77M), trimmed for 2026 softening. Built-up about 1,250 sq ft",
          setupCalc: "DLD transfer 4% Dh80,000 + DLD admin Dh580 + trustee office Dh4,000 + VAT = Dh4,200 + mortgage registration 0.25% of Dh1,600,000 loan + Dh290 = Dh4,290 + buyer agent 2% + VAT Dh42,000 + bank arrangement 1% of loan + VAT Dh16,800 + valuation Dh3,150 = Dh151,020 = 7.55%",
          costCalc: "service charge 1,250 sq ft x Dh15 Dh18,750 + contents and fit-out insurance Dh700 + upkeep (estimate, not sourced) Dh3,000 = Dh22,450/yr; renter: agency fee 5% + VAT on Dh130,000 spread over 3 years Dh2,275 + Ejari Dh220 + contents insurance Dh600 = Dh3,095/yr"
        },
        "apt-4br": {
          propertyPrice: 5000000, rentAmount: 290000, houseGrowth: 2.5, setupCost: 7.3, ownOngoingCost: 61500, rentOngoingCost: 6295, sqm: 279,
          where: "Luxury segment: older towers in Dubai Marina and JBR (e.g. Sadaf, Murjan, Marina Crown, Princess Tower), where 2026 deals ran Dh4.3M to 5.5M and rents Dh235k to 320k. Downtown and Palm 4-beds cost far more. Built-up about 3,000 sq ft",
          setupCalc: "DLD transfer 4% Dh200,000 + DLD admin Dh580 + trustee office Dh4,000 + VAT = Dh4,200 + mortgage registration 0.25% of Dh4,000,000 loan + Dh290 = Dh10,290 + buyer agent 2% + VAT Dh105,000 + bank arrangement 1% of loan + VAT Dh42,000 + valuation Dh3,150 = Dh365,220 = 7.30%",
          costCalc: "service charge 3,000 sq ft x Dh18 Dh54,000 + contents and fit-out insurance Dh1,500 + upkeep (estimate, not sourced) Dh6,000 = Dh61,500/yr; renter: agency fee 5% + VAT on Dh290,000 spread over 3 years Dh5,075 + Ejari Dh220 + contents insurance Dh1,000 = Dh6,295/yr",
          sources: [
            { name: "Property Finder, 4 bedroom apartments for sale in Dubai (1,899 listings, Oct 2026)", url: "https://www.propertyfinder.ae/en/buy/dubai/4-bedroom-apartments-for-sale.html" },
            { name: "Property Finder, 4 bedroom apartments for rent in Dubai", url: "https://www.propertyfinder.ae/en/rent/dubai/4-bedroom-apartments-for-rent.html" }
          ]
        },
        "house-2br": {
          propertyPrice: 3000000, rentAmount: 150000, houseGrowth: 3.5, setupCost: 7.41, ownOngoingCost: 15000, rentOngoingCost: 3645, sqm: 167, landSqm: 250,
          where: "2-bedroom villas and townhouses in The Springs (Type 4E/4M), Serena and JVT. Springs 2-beds sold Dh2.7M to 3.45M in Jan 2026 and rent Dh126k to 175k; trimmed for the 2026 dip. Built-up about 1,800 sq ft",
          setupCalc: "DLD transfer 4% Dh120,000 + DLD admin Dh580 + trustee office Dh4,000 + VAT = Dh4,200 + mortgage registration 0.25% of Dh2,400,000 loan + Dh290 = Dh6,290 + buyer agent 2% + VAT Dh63,000 + bank arrangement 1% of loan + VAT Dh25,200 + valuation Dh3,150 = Dh222,420 = 7.41%",
          costCalc: "service charge 1,800 sq ft x Dh3.5 Dh6,300 + building insurance Dh1,500 + upkeep 1% of about Dh720k rebuild cost (estimate, not sourced) Dh7,200 = Dh15,000/yr; renter: agency fee 5% + VAT on Dh150,000 spread over 3 years Dh2,625 + Ejari Dh220 + contents insurance Dh800 = Dh3,645/yr",
          sources: [
            { name: "Property Finder, 2 bedroom villas for sale in Dubai (Oct 2026)", url: "https://www.propertyfinder.ae/en/buy/dubai/2-bedroom-villas-for-sale.html" },
            { name: "Property Finder, 2 bedroom townhouses for sale in Dubai", url: "https://www.propertyfinder.ae/en/buy/dubai/2-bedroom-townhouses-for-sale.html" }
          ]
        },
        "house-4br": {
          propertyPrice: 4000000, rentAmount: 225000, houseGrowth: 3.5, setupCost: 7.35, ownOngoingCost: 25800, rentOngoingCost: 5158, sqm: 260, landSqm: 335,
          where: "Mid-market villa and townhouse communities: Mudon, DAMAC Hills, Arabian Ranches 3, Town Square (Q1 2026 medians Dh3.4M to 4.6M, rents Dh220k to 230k). Cheaper than a 4-bed Marina flat because it is further out; Arabian Ranches and Dubai Hills villas cost Dh8M to 10M",
          setupCalc: "DLD transfer 4% Dh160,000 + DLD admin Dh580 + trustee office Dh4,000 + VAT = Dh4,200 + mortgage registration 0.25% of Dh3,200,000 loan + Dh290 = Dh8,290 + buyer agent 2% + VAT Dh84,000 + bank arrangement 1% of loan + VAT Dh33,600 + valuation Dh3,150 = Dh293,820 = 7.35%",
          costCalc: "service charge 2,800 sq ft x Dh4.5 Dh12,600 + building insurance Dh2,000 + upkeep 1% of about Dh1.1M rebuild cost (estimate, not sourced) Dh11,200 = Dh25,800/yr; renter: agency fee 5% + VAT on Dh225,000 spread over 3 years Dh3,938 + Ejari Dh220 + contents insurance Dh1,000 = Dh5,158/yr"
        }
      },
      unavailable: {
        "house-studio": "Dubai villa and townhouse communities are built with 2 bedrooms or more; a studio house does not exist as a segment.",
        "house-1br": "One-bedroom villas or townhouses are essentially absent: master communities start at 2-bedroom units (e.g. The Springs Type 4M), so no typical price or rent can be quoted."
      },
      notes: {
        market: "Expat-driven freehold market of tower apartments plus villas and townhouses in master communities. Values fell about 10% after February 2026 (ValuStrat) after a 2021 to 2025 boom.",
        downPaymentPct: "UAE Central Bank caps expat first-home loans at 80% LTV up to AED 5M (70% above), so 20% down. Every preset here is at or under AED 5M.",
        mortgageRate: "Expat fixes were 3.75 to 4.15% for 1 to 5 years in mid-2026 (5-year 4.15% used), then 3-month EIBOR (about 3.9%) plus 1.5 to 1.85%: 5.4 to 5.75%.",
        riskFreeRate: "AED deposits track EIBOR, which was about 3.7 to 3.9% for 1 to 3 months in August 2026. 3.5% assumed for a typical saver.",
        sellingCostPct: "Seller pays the 2% agent commission plus 5% VAT and a developer NOC fee of AED 500 to 5,000. There is no capital gains tax.",
        rentInflation: "Dubai rents fell about a quarter from 2015 to 2020 and surged from 2021 to 2025, easing in 2026. 3% a year long run, with RERA caps on renewals.",
        houseGrowth: "Property Monitor average up 30.5% from Sept 2014 to Jul 2025 (about 2.5% a year). ValuStrat: villas 75% above the 2014 peak, flats 9% below. 2.5% flats, 3.5% villas.",
        setupCost: "DLD 4% transfer, AED 580 admin, trustee fee AED 4,200, mortgage registration 0.25% plus AED 290, buyer agent 2% plus VAT, bank fee 1% plus VAT, valuation.",
        ownOngoingCost: "No property tax. Owners pay RERA-indexed service charges (about AED 12 to 22 per sq ft for towers, 3 to 5 for villas), insurance and upkeep.",
        rentOngoingCost: "Tenants pay a 5% agency fee plus VAT on a new lease (spread over 3 years), Ejari about AED 220 a year and contents cover.",
        caveat: "Rent is paid upfront in 1 to 4 cheques. Tenants and owner-occupiers both pay a 5% housing fee on (notional) rent via DEWA, so it is left out of both sides."
      },
      sources: [
        { name: "Bayut, Dubai sales market report H1 2026", url: "https://www.bayut.com/mybayut/dubai-sales-market-report-h1-2026/" },
        { name: "Bayut, Dubai rental market report H1 2026", url: "https://www.bayut.com/mybayut/dubai-rental-market-report-h1-2026/" },
        { name: "fäm Properties, Dubai real estate report Q2 2026", url: "https://famproperties.com/real-estate-reports/2026/q2" },
        { name: "Khaleej Times, ValuStrat VPI August 2026", url: "https://www.khaleejtimes.com/business/6-in-10-dubai-homes-hold-their-value-as-market-cools-gently-in-august" },
        { name: "Property Finder, DLD fees guide", url: "https://www.propertyfinder.ae/blog/dld-fees-dubai/" },
        { name: "Real Estate Club Dubai, mortgage rates 2026", url: "https://realestateclubdubai.com/blog/investment/dubai-mortgage-rates-2026-best-banks-compared" },
        { name: "UAE Central Bank, EIBOR prices", url: "https://www.centralbank.ae/en/services/eibor-prices" },
        { name: "fäm Properties, Dubai Municipality housing fee guide", url: "https://famproperties.com/blog/dubai-municipality-housing-fee-2025-guide" },
        { name: "Real Estate Club Dubai, service charges 2026 (DLD index)", url: "https://realestateclubdubai.com/blog/property-management/dubai-service-charges-explained-what-owners-pay-2026" }
      ]
    },
    {
      key: "abudhabi", city: "Abu Dhabi", country: "United Arab Emirates", countryId: "Uni Emirat Arab", countryCode: "AE", region: "Middle East",
      aliases: ["UAE"],
      currencySymbol: "Dh", currencyCode: "AED", asOf: "2026-09",
      buyer: "UAE resident expat buying a first home to live in within an investment (freehold) zone, under AED 5M with an 80% LTV mortgage",
      downPaymentPct: 20, mortgageRate: 5.29, mortgageTerm: 25, riskFreeRate: 3.5, horizon: 25, sellingCostPct: 2.2,
      ratePeriods: [{ toYear: 5, type: "fixed", rate: 4.15 }, { toYear: 25, type: "floating", rateMin: 5.4, rateMax: 5.75 }],
      rentFreq: "yearly", rentInflation: 2.5, ownOngoingInflation: 2.5, rentOngoingInflation: 2.5,
      homes: {
        "apt-studio": {
          propertyPrice: 850000, rentAmount: 65000, houseGrowth: 2.5, setupCost: 5.57, ownOngoingCost: 9200, rentOngoingCost: 3688, sqm: 45,
          where: "Investment-zone towers on Al Reem Island, Masdar City and Yas Island. Bayut H1 2026 asking prices: Reem Dh989k, Masdar Dh801k; Reem studio rent Dh70k. Trimmed for asking-to-deal gap. Built-up about 480 sq ft",
          setupCalc: "DMT registration 2% Dh17,000 + title deed and admin Dh1,540 + mortgage registration 0.1% of Dh680,000 loan = Dh680 + buyer agent 2% + VAT Dh17,850 + bank arrangement 1% of loan + VAT Dh7,140 + valuation Dh3,150 = Dh47,360 = 5.57%",
          costCalc: "service charge 480 sq ft x Dh15 Dh7,200 + contents and fit-out insurance Dh500 + upkeep (estimate, not sourced) Dh1,500 = Dh9,200/yr; renter: municipality fee 3% of rent Dh1,950 + agency fee 5% + VAT spread over 3 years Dh1,138 + Tawtheeq registration Dh100 + contents insurance Dh500 = Dh3,688/yr",
          sources: [
            { name: "Property Finder, studio apartments for sale in Abu Dhabi (1,034 listings, Oct 2026)", url: "https://www.propertyfinder.ae/en/buy/abu-dhabi/studio-apartments-for-sale.html" }
          ]
        },
        "apt-1br": {
          propertyPrice: 1500000, rentAmount: 98000, houseGrowth: 2.5, setupCost: 5.33, ownOngoingCost: 14600, rentOngoingCost: 5255, sqm: 74,
          where: "Al Reem Island, Al Raha Beach, Yas Island. Bayut H1 2026 asking: Reem Dh1.40M (rent Dh94k), Raha Beach Dh1.75M (Dh111k), Yas Dh1.84M (Dh113k); blended and trimmed. Built-up about 800 sq ft",
          setupCalc: "DMT registration 2% Dh30,000 + title deed and admin Dh1,540 + mortgage registration 0.1% of Dh1,200,000 loan = Dh1,200 + buyer agent 2% + VAT Dh31,500 + bank arrangement 1% of loan + VAT Dh12,600 + valuation Dh3,150 = Dh79,990 = 5.33%",
          costCalc: "service charge 800 sq ft x Dh15 Dh12,000 + contents and fit-out insurance Dh600 + upkeep (estimate, not sourced) Dh2,000 = Dh14,600/yr; renter: municipality fee 3% of rent Dh2,940 + agency fee 5% + VAT spread over 3 years Dh1,715 + Tawtheeq registration Dh100 + contents insurance Dh500 = Dh5,255/yr"
        },
        "apt-2br": {
          propertyPrice: 2400000, rentAmount: 145000, houseGrowth: 2.5, setupCost: 5.22, ownOngoingCost: 22450, rentOngoingCost: 7588, sqm: 116,
          where: "Al Reem Island, Al Raha Beach, Yas Island. Bayut H1 2026 asking: Reem Dh2.13M (rent Dh128k), Raha Beach Dh2.65M (Dh146k), Yas Dh2.95M (Dh176k); blended and trimmed. Built-up about 1,250 sq ft",
          setupCalc: "DMT registration 2% Dh48,000 + title deed and admin Dh1,540 + mortgage registration 0.1% of Dh1,920,000 loan = Dh1,920 + buyer agent 2% + VAT Dh50,400 + bank arrangement 1% of loan + VAT Dh20,160 + valuation Dh3,150 = Dh125,170 = 5.22%",
          costCalc: "service charge 1,250 sq ft x Dh15 Dh18,750 + contents and fit-out insurance Dh700 + upkeep (estimate, not sourced) Dh3,000 = Dh22,450/yr; renter: municipality fee 3% of rent Dh4,350 + agency fee 5% + VAT spread over 3 years Dh2,538 + Tawtheeq registration Dh100 + contents insurance Dh600 = Dh7,588/yr"
        },
        "house-2br": {
          propertyPrice: 2500000, rentAmount: 150000, houseGrowth: 3, setupCost: 5.21, ownOngoingCost: 15100, rentOngoingCost: 8025, sqm: 158, landSqm: 205,
          where: "Newer townhouse communities: Bloom Living (Zayed City), Noya (Yas Island), Al Ghadeer. Ready 2-bed townhouses list at Dh2.55M to 2.8M and rent Dh135k to 170k (Property Finder, Oct 2026). Priced like a 2-bed island flat because most are further out. Built-up about 1,700 sq ft",
          setupCalc: "DMT registration 2% Dh50,000 + title deed and admin Dh1,540 + mortgage registration 0.1% of Dh2,000,000 loan = Dh2,000 + buyer agent 2% + VAT Dh52,500 + bank arrangement 1% of loan + VAT Dh21,000 + valuation Dh3,150 = Dh130,190 = 5.21%",
          costCalc: "service charge 1,700 sq ft x Dh4 Dh6,800 + building insurance Dh1,500 + upkeep 1% of about Dh680k rebuild cost (estimate, not sourced) Dh6,800 = Dh15,100/yr; renter: municipality fee 3% of rent Dh4,500 + agency fee 5% + VAT spread over 3 years Dh2,625 + Tawtheeq registration Dh100 + contents insurance Dh800 = Dh8,025/yr",
          sources: [
            { name: "Property Finder, 2 bedroom townhouses for sale in Abu Dhabi", url: "https://www.propertyfinder.ae/en/buy/abu-dhabi/2-bedroom-townhouses-for-sale.html" },
            { name: "Property Finder, 2 bedroom townhouses for rent in Abu Dhabi", url: "https://www.propertyfinder.ae/en/rent/abu-dhabi/2-bedroom-townhouses-for-rent.html" }
          ]
        },
        "house-4br": {
          propertyPrice: 3200000, rentAmount: 190000, houseGrowth: 3, setupCost: 5.17, ownOngoingCost: 25200, rentOngoingCost: 10125, sqm: 270, landSqm: 370,
          where: "Mid-market villa communities: Al Raha Gardens, Al Reef, Bloom Gardens. Bayut H1 2026 asking: Raha Gardens 4-bed Dh3.27M (rent Dh205k), Al Reef Dh2.65M (Dh157k). Yas and Saadiyat 4-bed villas cost Dh7.6M to 10.9M. Built-up about 2,900 sq ft",
          setupCalc: "DMT registration 2% Dh64,000 + title deed and admin Dh1,540 + mortgage registration 0.1% of Dh2,560,000 loan = Dh2,560 + buyer agent 2% + VAT Dh67,200 + bank arrangement 1% of loan + VAT Dh26,880 + valuation Dh3,150 = Dh165,330 = 5.17%",
          costCalc: "service charge 2,900 sq ft x Dh4 Dh11,600 + building insurance Dh2,000 + upkeep 1% of about Dh1.16M rebuild cost (estimate, not sourced) Dh11,600 = Dh25,200/yr; renter: municipality fee 3% of rent Dh5,700 + agency fee 5% + VAT spread over 3 years Dh3,325 + Tawtheeq registration Dh100 + contents insurance Dh1,000 = Dh10,125/yr",
          sources: [
            { name: "Property Finder, 4 bedroom villas for sale in Abu Dhabi (1,006 listings)", url: "https://www.propertyfinder.ae/en/buy/abu-dhabi/4-bedroom-villas-for-sale.html" }
          ]
        }
      },
      unavailable: {
        "apt-4br": "Only about 120 four-bed flats are for sale (vs about 2,900 two-beds), mostly a few Al Raha Beach and Reem towers; the larger Corniche 4-bed rental stock is outside expat freehold zones.",
        "house-studio": "Abu Dhabi villa and townhouse communities start at 2 bedrooms; a studio house does not exist as a segment.",
        "house-1br": "One-bedroom townhouses are essentially absent from Abu Dhabi master communities, which start at 2 bedrooms, so no typical price or rent can be quoted."
      },
      notes: {
        market: "Expats may buy freehold only in investment zones (Reem, Yas, Saadiyat, Raha, Reef). Flats rose 16.4% and villas 10.1% in the year to H1 2026 (Cavendish Maxwell).",
        downPaymentPct: "UAE Central Bank caps expat first-home loans at 80% LTV up to AED 5M (70% above), so 20% down. Every preset here is under AED 5M.",
        mortgageRate: "Same UAE bank products as Dubai: 5-year fix 4.15% (fixes 3.75 to 4.15% for 1 to 5 years), then 3-month EIBOR (about 3.9%) plus 1.5 to 1.85%: 5.4 to 5.75%.",
        riskFreeRate: "AED deposits track EIBOR, about 3.7 to 3.9% for 1 to 3 months in August 2026. 3.5% assumed for a typical saver.",
        sellingCostPct: "Seller pays the 2% agent commission plus 5% VAT and a developer NOC fee. The 2% DMT fee is assumed paid by the buyer, though it is negotiable.",
        rentInflation: "ADREC froze rent increases at 0% from June 2026 after strong 2023 to 2026 growth. 2.5% a year assumed long run (estimate, not sourced).",
        houseGrowth: "Abu Dhabi fell about a quarter from 2014 to 2020, then rebounded hard (flats up 16.4% y/y in H1 2026). Tempered to 2.5% flats, 3% villas (estimate, not sourced).",
        setupCost: "DMT registration 2%, title deed and admin about AED 1,540, mortgage registration 0.1% of loan, buyer agent 2% plus VAT, bank fee 1% plus VAT, valuation.",
        ownOngoingCost: "No property tax, and owner-occupiers do not pay the tenant municipality fee. Service charges about AED 15 per sq ft for towers, 4 for villas (estimate, not sourced).",
        rentOngoingCost: "Expat tenants pay a 3% municipality fee on rent via the utility bill (some 2026 guides say 5%), a 5% agency fee per lease (spread over 3 years) and Tawtheeq.",
        caveat: "Expats can only buy in investment zones. Rent is paid upfront in cheques and increases are frozen for now. 4-bed flats are too few to quote."
      },
      sources: [
        { name: "Bayut, Abu Dhabi sales market report H1 2026", url: "https://www.bayut.com/mybayut/abu-dhabi-sales-market-report-h1-2026/" },
        { name: "Bayut, Abu Dhabi rental market report H1 2026", url: "https://www.bayut.com/mybayut/abu-dhabi-rental-market-report-h1-2026/" },
        { name: "Knight Frank, Abu Dhabi residential market review H1 2026", url: "https://www.knightfrank.ae/newsroom/article/2026/7/abu-dhabi-residential-and-office-market-review" },
        { name: "Khaleej Times, Abu Dhabi temporarily freezes rent (2026)", url: "https://www.khaleejtimes.com/uae/abu-dhabi-temporarily-freezes-rent-for-residential-commercial-industrial-properties" },
        { name: "Bayut, fees for buying property in Abu Dhabi", url: "https://www.bayut.com/mybayut/fees-buying-property-abu-dhabi" },
        { name: "The National, 3% municipality fee on Abu Dhabi expat rentals", url: "https://www.thenational.ae/business/property/new-3-municipality-fee-on-abu-dhabi-expat-rentals-could-give-government-dh612m-boost-1.147737" },
        { name: "Property Finder, 4 bedroom apartments for sale in Abu Dhabi (124 listings)", url: "https://www.propertyfinder.ae/en/buy/abu-dhabi/4-bedroom-apartments-for-sale.html" },
        { name: "UAE Central Bank, EIBOR prices", url: "https://www.centralbank.ae/en/services/eibor-prices" },
        { name: "Real Estate Club Dubai, UAE mortgage rates 2026", url: "https://realestateclubdubai.com/blog/investment/dubai-mortgage-rates-2026-best-banks-compared" }
      ]
    },
    {
      key: "london", city: "London", country: "United Kingdom", countryId: "Inggris Raya", countryCode: "GB", region: "Europe",
      aliases: ["UK","England"],
      currencySymbol: "£", currencyCode: "GBP", asOf: "2026-10",
      buyer: "UK resident owner-occupier buying a first home at standard SDLT rates (first-time buyer relief ignored): a long-leasehold flat or a freehold house",
      downPaymentPct: 15, mortgageRate: 5.52, mortgageTerm: 35, riskFreeRate: 3.75, horizon: 30, sellingCostPct: 2,
      ratePeriods: [{ toYear: 5, type: "fixed", rate: 5.68 }, { toYear: 35, type: "floating", rateMin: 5.3, rateMax: 5.68 }],
      rentFreq: "monthly", rentInflation: 3, ownOngoingInflation: 2.5, rentOngoingInflation: 2.5,
      homes: {
        "apt-studio": {
          propertyPrice: 290000, rentAmount: 1650, houseGrowth: 2.5, setupCost: 3.15, ownOngoingCost: 1850, rentOngoingCost: 150, sqm: 32,
          where: "Zone 2 inner London: Islington, Hackney, Bow, Bermondsey, Brixton, Camberwell. Median of 12 district medians, Oct 2026: asking £301k (less 3%), asking rent £1,660 pcm",
          setupCalc: "SDLT on £290k: 2% x £125k = £2,500 + 5% x £40k = £2,000 = £4,500 (first-time buyer relief would make it £0); legal £2,200 + searches £400 + Land Registry £150 + survey £700 + lender fee £999 + lease notice fees £200 = £4,649; total £9,149 = 3.15% (fees other than SDLT and Land Registry are estimates, not sourced)",
          costCalc: "Service charge £1,350 (median of 30 zone 2 studio listings) + ground rent £100 + internal upkeep £400 = £1,850/yr; council tax excluded as tenants pay it too; renter: contents insurance £150/yr (upkeep and insurance are estimates, not sourced)",
          sources: [
            { name: "OnTheMarket, London studio flats for sale", url: "https://www.onthemarket.com/for-sale/flats-apartments/london/?max-bedrooms=0" }
          ]
        },
        "apt-1br": {
          propertyPrice: 390000, rentAmount: 2150, houseGrowth: 2.5, setupCost: 3.63, ownOngoingCost: 2825, rentOngoingCost: 170, sqm: 50,
          where: "Zone 2 inner London: Islington, Hackney, Bow, Bermondsey, Brixton, Camberwell. Median of 12 district medians, Oct 2026: asking £406k (less 3%), asking rent £2,185 pcm; ONS all-tenancy 1-bed rents there £1,880 to £2,180",
          setupCalc: "SDLT on £390k: £2,500 + 5% x £140k = £7,000 = £9,500 (first-time buyer relief would make it £4,500); legal £2,200 + searches £400 + Land Registry £150 + survey £700 + lender fee £999 + lease notice fees £200 = £4,649; total £14,149 = 3.63% (fees other than SDLT and Land Registry are estimates, not sourced)",
          costCalc: "Service charge £2,200 (median of 34 zone 2 one-bed listings) + ground rent £125 + internal upkeep £500 = £2,825/yr; council tax excluded as tenants pay it too; renter: contents insurance £170/yr (upkeep and insurance are estimates, not sourced)",
          sources: [
            { name: "OnTheMarket, London one-bed flats for sale", url: "https://www.onthemarket.com/for-sale/flats-apartments/london/?min-bedrooms=1&max-bedrooms=1" }
          ]
        },
        "apt-2br": {
          propertyPrice: 580000, rentAmount: 2700, houseGrowth: 2.5, setupCost: 4.1, ownOngoingCost: 3900, rentOngoingCost: 200, sqm: 70,
          where: "Zone 2 inner London: Islington, Hackney, Bow, Bermondsey, Brixton, Camberwell. Median of 12 district medians, Oct 2026: asking £599k (less 3%), asking rent £2,725 pcm; ONS all-tenancy 2-bed rents there £2,340 to £2,700",
          setupCalc: "SDLT on £580k: £2,500 + 5% x £330k = £16,500 = £19,000 (no first-time buyer relief above £500k); legal £2,200 + searches £400 + Land Registry £295 + survey £700 + lender fee £999 + lease notice fees £200 = £4,794; total £23,794 = 4.10% (fees other than SDLT and Land Registry are estimates, not sourced)",
          costCalc: "Service charge £3,100 (median of 28 zone 2 two-bed listings) + ground rent £150 + internal upkeep £650 = £3,900/yr; council tax excluded as tenants pay it too; renter: contents insurance £200/yr (upkeep and insurance are estimates, not sourced)",
          sources: [
            { name: "OnTheMarket, London two-bed flats for sale", url: "https://www.onthemarket.com/for-sale/flats-apartments/london/?min-bedrooms=2&max-bedrooms=2" }
          ]
        },
        "house-2br": {
          propertyPrice: 485000, rentAmount: 2000, houseGrowth: 3.5, setupCost: 3.79, ownOngoingCost: 1950, rentOngoingCost: 200, sqm: 75, landSqm: 120,
          where: "Outer London zones 3 to 4: Walthamstow, Catford, Lee, Eltham, Streatham, Tottenham, Chingford. Mostly Victorian and Edwardian terraces; cheaper than a zone 2 two-bed flat because it is further out. Median of 15 district medians, Oct 2026: asking £500k (less 3%), rent £2,000 pcm",
          setupCalc: "SDLT on £485k: £2,500 + 5% x £235k = £11,750 = £14,250; legal £1,800 + searches £400 + Land Registry £150 + survey £800 + lender fee £999 = £4,149; total £18,399 = 3.79% (fees other than SDLT and Land Registry are estimates, not sourced)",
          costCalc: "Buildings insurance £450 + maintenance about 0.8% of a £190k rebuild value £1,500 = £1,950/yr; council tax excluded as tenants pay it too; renter: contents insurance £200/yr (estimate, not sourced)",
          sources: [
            { name: "OnTheMarket, London two-bed houses for sale", url: "https://www.onthemarket.com/for-sale/houses/london/?min-bedrooms=2&max-bedrooms=2" }
          ]
        },
        "house-4br": {
          propertyPrice: 820000, rentAmount: 3200, houseGrowth: 3.5, setupCost: 4.33, ownOngoingCost: 3150, rentOngoingCost: 250, sqm: 125, landSqm: 250,
          where: "Outer London zones 3 to 4: Walthamstow, Leytonstone, Catford, Lee, Streatham, Palmers Green, Willesden. Terraced and 1930s semi-detached houses. Median of 15 district medians, Oct 2026: asking £843k (less 3%), rent £3,200 pcm",
          setupCalc: "SDLT on £820k: £2,500 + 5% x £570k = £28,500 = £31,000; legal £1,800 + searches £400 + Land Registry £295 + survey £1,000 + lender fee £999 = £4,494; total £35,494 = 4.33% (fees other than SDLT and Land Registry are estimates, not sourced)",
          costCalc: "Buildings insurance £650 + maintenance about 0.8% of a £310k rebuild value £2,500 = £3,150/yr; council tax excluded as tenants pay it too; renter: contents insurance £250/yr (estimate, not sourced)",
          sources: [
            { name: "OnTheMarket, London four-bed houses for sale", url: "https://www.onthemarket.com/for-sale/houses/london/?min-bedrooms=4&max-bedrooms=4" }
          ]
        }
      },
      unavailable: {
        "apt-4br": "Four-bedroom flats are a thin, split niche (964 for sale in Oct 2026 against 24,599 two-beds): prime mansion flats or ex-council maisonettes. London families buy houses.",
        "house-studio": "Studio houses do not exist as a segment in London; the smallest houses are one-bedroom mews or cottage conversions.",
        "house-1br": "One-bedroom houses are rare in London (294 for sale on OnTheMarket in Oct 2026 against 2,873 two-bed and 6,866 four-bed houses), mostly mews cottages with erratic prices; one-bedroom homes are flats."
      },
      notes: {
        market: "Inner London is mostly leasehold flats; outer zones are Victorian terraces and 1930s semis. About half of London homes are owner-occupied, per Census 2021 (estimate, not sourced).",
        downPaymentPct: "UK lenders price by loan-to-value band. Deposits of 10 to 15% are common for first buyers, so 15% (85% LTV) is used; bigger deposits get slightly lower rates (estimate, not sourced).",
        mortgageRate: "Moneyfacts, Sep 2026: 5-year fix 5.68% (2-year 5.63%, SVR 7.13%). Buyers refix every 2 to 5 years, so from year 6 between the 5.3% long-run view and today's 5.68%.",
        riskFreeRate: "Bank Rate is 3.75% (held 17 Sep 2026). Average easy-access savings pay 2.53% and 1-year fixed bonds 4.28% (Moneyfacts, Sep 2026), so 3.75% is used.",
        sellingCostPct: "Estate agent about 1.2% plus VAT, plus conveyancing, EPC and leasehold pack, about 2% in all. No capital gains tax on a main home (estimate, not sourced).",
        rentInflation: "ONS private rents in London rose 3.4% a year from Jan 2015 to Aug 2026 (£1,580 to £2,332 a month, all tenancies), so 3% a year is used long-run.",
        houseGrowth: "Land Registry UK HPI to Jul 2026: inner London flats +3.2% a year since 2006 but -0.5% since 2016; outer London terraces and semis +4.2% and +2.1%. Used: flats 2.5%, houses 3.5%.",
        setupCost: "SDLT standard rates since April 2025: 0% to £125k, 2% to £250k, 5% to £925k, 10% to £1.5m, 12% above. Plus Land Registry fee, legal, searches, survey and lender fee.",
        ownOngoingCost: "Flats: median service charge and ground rent from Oct 2026 listings, plus upkeep. Houses: buildings insurance and upkeep. Council tax is left out because tenants pay it too.",
        rentOngoingCost: "Tenants pay contents insurance. The Tenant Fees Act 2019 bans letting fees and caps deposits at 5 weeks of rent, refundable (insurance cost is an estimate, not sourced).",
        caveat: "London prices fell 3.3% in the year to Jul 2026. Leasehold flats can bring service charge rises and major-works bills. Prices are asking less about 3% for negotiation (estimate, not sourced)."
      },
      sources: [
        { name: "ONS, Private rent and house prices, UK: September 2026", url: "https://www.ons.gov.uk/economy/inflationandpriceindices/bulletins/privaterentandhousepricesuk/september2026" },
        { name: "ONS, Price Index of Private Rents by local authority and bedrooms, Aug 2026", url: "https://www.ons.gov.uk/economy/inflationandpriceindices/datasets/priceindexofprivaterentsukmonthlypricestatistics" },
        { name: "HM Land Registry, UK HPI average prices by property type, Jul 2026", url: "https://publicdata.landregistry.gov.uk/market-trend-data/house-price-index-data/Average-prices-Property-Type-2026-07.csv" },
        { name: "OnTheMarket, London listings, asking prices, rents and service charges, Oct 2026", url: "https://www.onthemarket.com/for-sale/flats-apartments/london/" },
        { name: "GOV.UK, Stamp Duty Land Tax residential rates", url: "https://www.gov.uk/stamp-duty-land-tax/residential-property-rates" },
        { name: "GOV.UK, HM Land Registry registration fees", url: "https://www.gov.uk/guidance/hm-land-registry-registration-services-fees" },
        { name: "Moneyfacts, mortgage rates, 7 Sep 2026", url: "https://moneyfactscompare.co.uk/news/mortgages/hopes-dashed-as-mortgage-rate-rises-loom/" },
        { name: "Moneyfacts, savings rates, 10 Sep 2026", url: "https://moneyfactscompare.co.uk/news/savings/savers-handed-boost-as-fixed-rates-soar/" },
        { name: "Rightmove, Islington sold prices (cross-check)", url: "https://www.rightmove.co.uk/house-prices/islington.html" }
      ]
    },
    {
      key: "zurich", city: "Zurich", country: "Switzerland", countryId: "Swiss", countryCode: "CH", region: "Europe",
      aliases: ["Zürich","Zuerich"],
      currencySymbol: "CHF", currencyCode: "CHF", asOf: "2026-08",
      buyer: "Swiss resident owner-occupier buying a first home to live in, with 20% equity (at most half of it from pension money) and a standard bank mortgage",
      downPaymentPct: 20, mortgageRate: 1.71, mortgageTerm: 30, riskFreeRate: 0.5, horizon: 30, sellingCostPct: 2.6,
      ratePeriods: [{ toYear: 10, type: "fixed", rate: 2.03 }, { toYear: 30, type: "floating", rateMin: 1.08, rateMax: 2.03 }],
      rentFreq: "monthly", rentInflation: 2, ownOngoingInflation: 1, rentOngoingInflation: 1,
      homes: {
        "apt-studio": {
          propertyPrice: 690000, rentAmount: 1450, houseGrowth: 3, setupCost: 0.31, ownOngoingCost: 1665, rentOngoingCost: 200, sqm: 37,
          where: "City of Zurich, 1 to 1.5 rooms, citywide 2025 median of 53 condo sales (CHF 18,750/m2). A thin segment: only about 600 studios in the city are owner-occupied. Rent: CHF 33.20/m2 new-tenancy rate for 2 rooms x 1.18 studio premium (canton ratio) x 37 m2",
          setupCalc: "No transfer tax. Purchase: notary 0.1% + VAT + land registry 0.1% = CHF 1,436, buyer half CHF 718; mortgage note on CHF 552k loan 0.2081% = CHF 1,149; disbursements CHF 300; total CHF 2,167 = 0.31% (half-split custom and disbursements are estimates, not sourced)",
          costCalc: "Renewal fund 0.3% of a CHF 166k insured value CHF 500 + interior upkeep 0.4% CHF 665 + administration CHF 400 + building insurance CHF 100 = CHF 1,665/yr; Nebenkosten left out as tenants pay them too; renter: contents insurance CHF 200/yr (rates are estimates, not sourced)",
          sources: [
            { name: "BFS, rent per m2 by rooms, canton of Zurich 2024", url: "https://www.bfs.admin.ch/asset/de/je-d-09.03.03.05" }
          ]
        },
        "apt-1br": {
          propertyPrice: 1200000, rentAmount: 2200, houseGrowth: 3, setupCost: 0.3, ownOngoingCost: 2680, rentOngoingCost: 250, sqm: 66,
          where: "City of Zurich, 2 to 2.5 rooms, typical of Wiedikon, Wipkingen, Oerlikon and Wollishofen (Kreis 1, 7 and 8 cost more). Citywide 2025 median of 105 condo sales CHF 1.216m. Rent: new private tenancies, April 2026 median CHF 33.20/m2 net x 66 m2",
          setupCalc: "No transfer tax. Purchase: notary 0.1% + VAT + land registry 0.1% = CHF 2,497, buyer half CHF 1,249; mortgage note on CHF 960k loan 0.2081% = CHF 1,998; disbursements CHF 300; total CHF 3,547 = 0.30% (half-split custom and disbursements are estimates, not sourced)",
          costCalc: "Renewal fund 0.3% of a CHF 297k insured value CHF 890 + interior upkeep 0.4% CHF 1,190 + administration CHF 450 + building insurance CHF 150 = CHF 2,680/yr; Nebenkosten (about CHF 170/month) left out as tenants pay them too; renter: contents insurance CHF 250/yr (rates are estimates, not sourced)"
        },
        "apt-2br": {
          propertyPrice: 1550000, rentAmount: 2530, houseGrowth: 3, setupCost: 0.29, ownOngoingCost: 3390, rentOngoingCost: 300, sqm: 86,
          where: "City of Zurich, 3 to 3.5 rooms, typical of Wiedikon, Wipkingen, Oerlikon and Wollishofen (Kreis 1, 7 and 8 cost more). Citywide 2025 median of 236 condo sales CHF 1.5475m. Rent: new private tenancies, April 2026 median CHF 29.38/m2 net x 86 m2",
          setupCalc: "No transfer tax. Purchase: notary 0.1% + VAT + land registry 0.1% = CHF 3,226, buyer half CHF 1,613; mortgage note on CHF 1.24m loan 0.2081% = CHF 2,580; disbursements CHF 300; total CHF 4,493 = 0.29% (half-split custom and disbursements are estimates, not sourced)",
          costCalc: "Renewal fund 0.3% of a CHF 387k insured value CHF 1,160 + interior upkeep 0.4% CHF 1,550 + administration CHF 500 + building insurance CHF 180 = CHF 3,390/yr; Nebenkosten (about CHF 200/month) left out as tenants pay them too; renter: contents insurance CHF 300/yr (rates are estimates, not sourced)"
        },
        "apt-4br": {
          propertyPrice: 2100000, rentAmount: 3450, houseGrowth: 3, setupCost: 0.28, ownOngoingCost: 4945, rentOngoingCost: 400, sqm: 130,
          where: "City of Zurich, 5 to 5.5 rooms, residential districts: Kreis 7 (Witikon, Hottingen), Kreis 9 (Altstetten, Albisrieden), Kreis 2 (Wollishofen), Kreis 6. Citywide 2025 median of 84 condo sales CHF 2.09m. Rent: 4-room new-tenancy rate CHF 27.26/m2 x 0.97 (canton 5 vs 4 room ratio) x 130 m2",
          setupCalc: "No transfer tax. Purchase: notary 0.1% + VAT + land registry 0.1% = CHF 4,370, buyer half CHF 2,185; mortgage note on CHF 1.68m loan 0.2081% = CHF 3,496; disbursements CHF 300; total CHF 5,981 = 0.28% (half-split custom and disbursements are estimates, not sourced)",
          costCalc: "Renewal fund 0.3% of a CHF 585k insured value CHF 1,755 + interior upkeep 0.4% CHF 2,340 + administration CHF 600 + building insurance CHF 250 = CHF 4,945/yr; Nebenkosten (about CHF 300/month) left out as tenants pay them too; renter: contents insurance CHF 400/yr (rates are estimates, not sourced)",
          sources: [
            { name: "BFS, rent per m2 by rooms, canton of Zurich 2024", url: "https://www.bfs.admin.ch/asset/de/je-d-09.03.03.05" }
          ]
        },
        "house-4br": {
          propertyPrice: 1750000, rentAmount: 3450, houseGrowth: 3, setupCost: 0.29, ownOngoingCost: 6400, rentOngoingCost: 450, sqm: 150, landSqm: 400,
          where: "Close suburbs where houses are common: Dübendorf, Wallisellen, Opfikon, Schlieren (row and detached houses, 5.5 rooms). House medians 2023 to 2025: CHF 1.63m to 1.77m; city houses CHF 2.88m, so cheaper than a city 5.5-room flat. Rent derived from canton rents",
          setupCalc: "No transfer tax. Purchase: notary 0.1% + VAT + land registry 0.1% = CHF 3,642, buyer half CHF 1,821; mortgage note on CHF 1.4m loan 0.2081% = CHF 2,913; disbursements CHF 300; total CHF 5,034 = 0.29% (half-split custom and disbursements are estimates, not sourced)",
          costCalc: "Maintenance 0.8% of a CHF 750k rebuild value CHF 6,000 + building and liability insurance CHF 400 = CHF 6,400/yr; utilities left out as tenants pay them too; rent CHF 18.90/m2 canton 5-room average x 1.13 new-tenancy uplift x 1.074 (2024 to 2026) x 150 m2; renter: contents insurance CHF 450/yr (estimate, not sourced)",
          sources: [
            { name: "Statistisches Amt Kanton Zurich, house prices by municipality", url: "https://daten.statistik.zh.ch/ogd/daten/ressourcen/KTZH_00003158_00006788.json" },
            { name: "BFS, rent per m2 by rooms, canton of Zurich 2024", url: "https://www.bfs.admin.ch/asset/de/je-d-09.03.03.05" }
          ]
        }
      },
      unavailable: {
        "house-studio": "Studio houses do not exist as a segment in Zurich; Swiss single-family and row houses are family homes, mostly 4.5 rooms or more.",
        "house-1br": "One-bedroom houses are essentially absent: only about 100 houses a year change hands in the whole city, and Swiss houses are built as family homes of 4.5 to 6.5 rooms.",
        "house-2br": "Houses of 3 to 3.5 rooms are rare in Zurich and its suburbs, where row and detached houses are family homes of mostly 4.5 to 6.5 rooms; 2-bedroom buyers buy condos."
      },
      notes: {
        market: "Zurich is a renters' city: only 7.9% of the city's 238,000 homes were owner-occupied in 2025. About 700 condos and 100 houses sell a year in the city; most houses are in the suburbs.",
        downPaymentPct: "Swiss rules require at least 20% equity, at most 10% of the price from pension money. The first mortgage covers up to 66.7% and the rest must be repaid within 15 years (estimate, not sourced).",
        mortgageRate: "SNB, Aug 2026: 10-year fixed 2.03% for 10 years, then between SARON mortgages (1.08%) and a new 10-year fix (2.03%) as buyers mix and refix. 5-year fixed 1.76%, policy rate 0%.",
        riskFreeRate: "SNB, Aug 2026: savings accounts 0.07%, 2-year term deposits 0.38%, 5-year 0.59%. 0.5% is used as a long-run return on spare cash.",
        sellingCostPct: "Agent about 2.5% (estimate) plus half the 0.2% notary fee. Zurich property gains tax is left out: about 11.6% of the price on a 30-year sale, and deferred if you buy again.",
        rentInflation: "New-tenancy rents in Zurich city rose about 3.3% a year 2022 to 2026 (city rent survey), but sitting tenants' rents follow the reference rate and CPI, so 2% is used long-run.",
        houseGrowth: "City condo prices per m2 rose 5.4% a year 2010 to 2025 (Statistik Stadt Zurich); suburban house medians 3.7% a year 2011 to 2025 (canton). Tempered to 3% for both.",
        setupCost: "No transfer tax in Zurich since 2005. Notary 0.1% plus land registry 0.1% of price, plus 0.2% to register a mortgage note on the loan; buyers pay half the purchase fee by custom (estimate, not sourced).",
        ownOngoingCost: "Condo renewal fund, administration, building insurance and upkeep. Nebenkosten (heating, water) are paid by tenants too, so left out. No annual property tax in Zurich (estimate, not sourced).",
        rentOngoingCost: "Tenants pay household contents insurance (estimate, not sourced). The deposit of up to 3 months of net rent sits in a blocked savings account and is returned.",
        caveat: "Swiss owners rarely repay the first mortgage, but the calculator assumes full repayment. Imputed rent tax and interest deductions both end on 1 Jan 2029. Gains tax is deferred if you buy again."
      },
      sources: [
        { name: "Statistik Stadt Zurich, condo sale prices by rooms, 2025", url: "https://data.stadt-zuerich.ch/dataset/bau_hae_preis_stockwerkeigentum_zimmerzahl_stadtquartier_od5155" },
        { name: "Statistik Stadt Zurich, rent survey (Mietpreiserhebung), April 2026", url: "https://data.stadt-zuerich.ch/dataset/bau_whg_mpe_mietpreis_raum_zizahl_gn_jahr_od5161" },
        { name: "Statistik Stadt Zurich, dwelling stock by rooms and tenure, 2025", url: "https://data.stadt-zuerich.ch/dataset/bau_best_whg_zizahl_wfl_bauperi_ea_quartier_jahr_od5831" },
        { name: "Statistisches Amt Kanton Zurich, house sale prices by region, 2025", url: "https://daten.statistik.zh.ch/ogd/daten/ressourcen/KTZH_00003158_00006781.csv" },
        { name: "Swiss National Bank, interest rates on new mortgages and deposits, Aug 2026", url: "https://data.snb.ch/api/cube/zikrepro/data/csv/en" },
        { name: "BFS, average rent per m2 by rooms and canton, 2024", url: "https://www.bfs.admin.ch/asset/de/je-d-09.03.03.05" },
        { name: "Notariate Kanton Zurich, purchase fee calculator", url: "https://www.notariate-zh.ch/de/grundbuch/kaufvertrag-etc/gebuehren" },
        { name: "Notariate Kanton Zurich, mortgage note fees", url: "https://www.notariate-zh.ch/de/grundbuch/grundpfandrechte/gebuehren" },
        { name: "Kantonales Steueramt Zurich, property gains tax tariff", url: "https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/steuern-finanzen/steuern/vertreter/steuerbuch/zstb-nr-225-1.pdf" },
        { name: "Wikipedia, Eigenmietwert (abolition in force 1 Jan 2029)", url: "https://de.wikipedia.org/wiki/Eigenmietwert" }
      ]
    },
    {
      key: "paris", city: "Paris", country: "France", countryId: "Prancis", countryCode: "FR", region: "Europe",
      aliases: ["Île-de-France","Ile-de-France","IDF","Paris intra-muros"],
      currencySymbol: "€", currencyCode: "EUR", asOf: "2026-09",
      buyer: "French resident owner-occupier, first home, existing (ancien) property, standard DMTO rate (the first-time-buyer exemption from the 2025 DMTO rise is ignored)",
      downPaymentPct: 20, mortgageRate: 3.5, mortgageTerm: 25, riskFreeRate: 2.4, horizon: 25, sellingCostPct: 4,
      rentFreq: "monthly", rentInflation: 2, ownOngoingInflation: 2, rentOngoingInflation: 2,
      homes: {
        "apt-studio": {
          propertyPrice: 240000, rentAmount: 850, houseGrowth: 2, setupCost: 8.89, ownOngoingCost: 1600, rentOngoingCost: 250, sqm: 25,
          where: "Studio (T1) in mid-market arrondissements: 11e, 14e, 15e, 17e. Notaires Q2 2026 average for these about €9,200/m², studios about 4% above: €9,700 × 25 m²",
          setupCalc: "DMTO 6.3185% of €240,000 = €15,164; notaire emoluments €2,315 + 20% VAT = €2,778; CSI 0.1% €240 + filing costs ~€1,200; bank fee €1,000 + guarantee 0.5% of €192,000 loan = €1,960 (filing and bank costs are estimates, not sourced); total €21,342 = 8.89%",
          costCalc: "Taxe foncière excl. TEOM ~€18/m² = €450 + owner share of copro charges and works ~€30/m² = €750 + interior upkeep €10/m² = €250 + home insurance €150, about €1,600/yr; renter: insurance €120 + ALUR letting fee €15/m² = €375 over 3 yrs, about €250/yr. Recoverable charges and TEOM are paid by both, so excluded (per-m² rates are estimates, not sourced)"
        },
        "apt-1br": {
          propertyPrice: 390000, rentAmount: 1250, houseGrowth: 2, setupCost: 8.46, ownOngoingCost: 2600, rentOngoingCost: 300, sqm: 42,
          where: "T2 in 11e, 14e, 15e, 17e: about €9,300/m² × 42 m² (notaires Q2 2026); rent about €30/m² hors charges",
          setupCalc: "DMTO 6.3185% of €390,000 = €24,642; notaire emoluments €3,513 + 20% VAT = €4,216; CSI 0.1% €390 + filing costs ~€1,200; bank fee €1,000 + guarantee 0.5% of €312,000 loan = €2,560 (filing and bank costs are estimates, not sourced); total €33,008 = 8.46%",
          costCalc: "Taxe foncière excl. TEOM ~€18/m² = €750 + owner share of copro charges and works ~€30/m² = €1,260 + interior upkeep €10/m² = €420 + home insurance €180, about €2,600/yr; renter: insurance €150 + ALUR letting fee €15/m² = €630 over 4 yrs, about €300/yr. Recoverable charges and TEOM are paid by both, so excluded (per-m² rates are estimates, not sourced)"
        },
        "apt-2br": {
          propertyPrice: 585000, rentAmount: 1750, houseGrowth: 2, setupCost: 8.23, ownOngoingCost: 3900, rentOngoingCost: 400, sqm: 63,
          where: "T3 in 11e, 14e, 15e, 17e: about €9,300/m² × 63 m²; rent about €28/m² hors charges, near the OLL 3-room median plus a new-lease premium",
          setupCalc: "DMTO 6.3185% of €585,000 = €36,963; notaire emoluments €5,071 + 20% VAT = €6,086; CSI 0.1% €585 + filing costs ~€1,200; bank fee €1,000 + guarantee 0.5% of €468,000 loan = €3,340 (filing and bank costs are estimates, not sourced); total €48,174 = 8.23%",
          costCalc: "Taxe foncière excl. TEOM ~€18/m² = €1,150 + owner share of copro charges and works ~€30/m² = €1,890 + interior upkeep €10/m² = €630 + home insurance €220, about €3,900/yr; renter: insurance €180 + ALUR letting fee €15/m² = €945 over 4 yrs, about €400/yr. Recoverable charges and TEOM are paid by both, so excluded (per-m² rates are estimates, not sourced)"
        },
        "apt-4br": {
          propertyPrice: 1150000, rentAmount: 3100, houseGrowth: 2, setupCost: 8.01, ownOngoingCost: 7000, rentOngoingCost: 650, sqm: 115,
          where: "T5 family flat, mostly Haussmannian, in 15e, 16e, 17e: about €10,000/m² × 115 m²; rent about €27/m² hors charges; upper segment",
          setupCalc: "DMTO 6.3185% of €1,150,000 = €72,663; notaire emoluments €9,586 + 20% VAT = €11,503; CSI 0.1% €1,150 + filing costs ~€1,200; bank fee €1,000 + guarantee 0.5% of €920,000 loan = €5,600 (filing and bank costs are estimates, not sourced); total €92,116 = 8.01%",
          costCalc: "Taxe foncière excl. TEOM ~€18/m² = €2,050 + owner share of copro charges and works ~€30/m² = €3,450 + interior upkeep €10/m² = €1,150 + home insurance €350, about €7,000/yr; renter: insurance €300 + ALUR letting fee €15/m² = €1,725 over 5 yrs, about €650/yr. Recoverable charges and TEOM are paid by both, so excluded (per-m² rates are estimates, not sourced)"
        },
        "house-2br": {
          propertyPrice: 370000, rentAmount: 1450, houseGrowth: 1.5, setupCost: 8.5, ownOngoingCost: 2800, rentOngoingCost: 450, sqm: 70, landSqm: 200,
          where: "Small pavillon (3 pièces) in the petite couronne: Montreuil, Fontenay-sous-Bois, Champigny-sur-Marne, Vitry-sur-Seine; about €5,300/m² × 70 m², rent about €21/m². Cheaper than a Paris T3 because it is outside the city",
          setupCalc: "DMTO 6.3185% of €370,000 = €23,378; notaire emoluments €3,354 + 20% VAT = €4,024; CSI 0.1% €370 + filing costs ~€1,200; bank fee €1,000 + guarantee 0.5% of €296,000 loan = €2,480 (filing and bank costs are estimates, not sourced); total €31,453 = 8.50%",
          costCalc: "Taxe foncière excl. TEOM ~€1,050 + house insurance €350 + maintenance 1% of rebuild value (~€2,000/m² × 70 m²) = €1,400, about €2,800/yr; renter: insurance €200 + ALUR letting fee ~€14/m² = €980 over 4 yrs, about €450/yr (tax, insurance and fee rates are estimates, not sourced)",
          sources: [
            { name: "Notaires du Grand Paris, house prices by département, Q2 2026", url: "https://paris.notaires.fr/sites/default/files/Historiquedesprixdesmaisonspardep_4.pdf" },
            { name: "SeLoger, Saint-Maur-des-Fossés prices and rents, May 2026", url: "https://edito.seloger.com/actualites/france/prix-immobilier-saint-maur-fosses-vaut-marche-article-22913.html" }
          ]
        },
        "house-4br": {
          propertyPrice: 700000, rentAmount: 2600, houseGrowth: 1.5, setupCost: 8.16, ownOngoingCost: 4900, rentOngoingCost: 600, sqm: 120, landSqm: 350,
          where: "5-pièces house in the petite couronne: Saint-Maur-des-Fossés, Colombes, Antony, Le Perreux-sur-Marne; about €5,850/m² × 120 m² (houses €5,500-6,500/m² there), rent about €21.70/m². Cheaper than a Paris T5 because it is outside the city",
          setupCalc: "DMTO 6.3185% of €700,000 = €44,230; notaire emoluments €5,990 + 20% VAT = €7,188; CSI 0.1% €700 + filing costs ~€1,200; bank fee €1,000 + guarantee 0.5% of €560,000 loan = €3,800 (filing and bank costs are estimates, not sourced); total €57,118 = 8.16%",
          costCalc: "Taxe foncière excl. TEOM ~€2,000 + house insurance €500 + maintenance 1% of rebuild value (~€2,000/m² × 120 m²) = €2,400, about €4,900/yr; renter: insurance €280 + ALUR letting fee ~€14/m² = €1,680 over 5 yrs, about €600/yr (tax, insurance and fee rates are estimates, not sourced)",
          sources: [
            { name: "Notaires du Grand Paris, house prices by département, Q2 2026", url: "https://paris.notaires.fr/sites/default/files/Historiquedesprixdesmaisonspardep_4.pdf" },
            { name: "SeLoger, Saint-Maur-des-Fossés prices and rents, May 2026", url: "https://edito.seloger.com/actualites/france/prix-immobilier-saint-maur-fosses-vaut-marche-article-22913.html" }
          ]
        }
      },
      unavailable: {
        "house-studio": "Paris itself has almost no houses and petite couronne pavillons are built with at least two bedrooms, so studio houses do not exist as a segment.",
        "house-1br": "Houses inside Paris are a rarity and the suburban pavillon stock is mostly 3-5 rooms, so 1-bedroom houses are too few to quote a typical price or rent."
      },
      notes: {
        market: "Paris is mostly small pre-1940 flats in copropriété; about a third of households own and about a quarter of homes are social housing (estimate, not sourced). Houses sit in the petite couronne.",
        downPaymentPct: "20%: Crédit Logement/CSA data put the average apport near 20% for existing homes in 2026; banks expect at least the notaire fees to be paid in cash.",
        mortgageRate: "3.5%: the 25-year fixed averaged 3.35% in Aug 2026 (Observatoire Crédit Logement/CSA) and broker quotes rose to 3.5-3.6% in Sept. Borrower insurance is extra.",
        riskFreeRate: "2.4%: new 1-year household term deposits paid 2.36% in Aug 2026 (ECB MIR); Livret A pays 1.7% tax-free from 1 Aug 2026; ECB deposit rate 2.5%.",
        sellingCostPct: "4%: Paris agency commission of roughly 3.5-5% incl. VAT plus diagnostics; no capital gains tax on a main home (estimate, not sourced).",
        rentInflation: "2%: Paris rents are capped by rent control and indexed to the IRL; OLAP measured +0.8%, +2.4% and +2.9% a year for unfurnished private rents in 2021-2023.",
        houseGrowth: "Flats: notaires' arrondissement average rose 2.8%/yr 2006-2026 and 1.6%/yr 2016-2026, so 2%. Petite couronne houses rose about 1%/yr over 10 and 20 years, so 1.5%.",
        setupCost: "DMTO 6.32% (département 5% since Apr 2025 + commune 1.2% + fee), regulated notaire emoluments plus VAT, CSI 0.1%, filing costs, bank fee and loan guarantee.",
        ownOngoingCost: "Taxe foncière without the TEOM waste levy (recharged to tenants), the owner share of copropriété charges and works, upkeep and home insurance (per-m² rates are estimates).",
        rentOngoingCost: "Tenant home insurance plus the ALUR-capped letting fee (€12/m² + €3/m² in Paris) spread over a 3-5 year tenancy (estimate, not sourced).",
        caveat: "Rents are free-sector, unfurnished and capped by Paris rent control; social housing (about a quarter of homes) rents far lower. First-time buyers skip the 0.5 pt DMTO rise."
      },
      sources: [
        { name: "Notaires du Grand Paris, apartment prices by arrondissement, Q2 2026", url: "https://paris.notaires.fr/sites/default/files/HistoriquedesprixaumappartementsanciensParispararrdt_4.pdf" },
        { name: "Notaires du Grand Paris, house prices by département, Q2 2026", url: "https://paris.notaires.fr/sites/default/files/Historiquedesprixdesmaisonspardep_4.pdf" },
        { name: "Observatoire Crédit Logement/CSA, tableau de bord août 2026", url: "https://lobservatoire.creditlogement.fr/wp-content/uploads/sites/2/2026/09/TDB_L_Observatoire_Credit_Logement_CSA_aout2026.pdf" },
        { name: "Pretto, taux immobilier septembre 2026", url: "https://www.pretto.fr/taux-immobilier/historique-taux-immobilier/2026/analyse-taux-immobilier-septembre-2026/" },
        { name: "Service-public.gouv.fr, frais de notaire (emoluments scale)", url: "https://www.service-public.gouv.fr/particuliers/vosdroits/F17701" },
        { name: "Banque des Territoires, hausse du taux de DMTO à Paris", url: "https://www.banquedesterritoires.fr/hausse-du-taux-de-dmto-paris-ouvre-le-bal" },
        { name: "SeLoger, marché locatif parisien 2025", url: "https://edito.seloger.com/locaux-pros/points-marche/marche-locatif-parisien-2025-une-pression-toujours-elevee-article-20386" },
        { name: "OLL network, Les loyers du parc privé en France 2026", url: "https://www.journaldelagence.com/wp-content/uploads/2026/02/Les_loyers_du_parc_prive_en_France_2026.pdf" },
        { name: "Gouvernement, Livret A at 1.7% from 1 Aug 2026", url: "https://www.info.gouv.fr/actualite/augmentation-du-taux-du-livret-a-a-compter-du-1er-aout-2026" },
        { name: "ECB Data Portal, MIR France household rates, Aug 2026", url: "https://data-api.ecb.europa.eu/service/data/MIR/M.FR.B.A2C.P.R.A.2250.EUR.N?lastNObservations=4&format=csvdata" }
      ]
    },
    {
      key: "berlin", city: "Berlin", country: "Germany", countryId: "Jerman", countryCode: "DE", region: "Europe",
      aliases: ["Land Berlin","Berlin-Brandenburg","BER"],
      currencySymbol: "€", currencyCode: "EUR", asOf: "2026-10",
      buyer: "German resident owner-occupier, first home, resale (Bestand) property bought through a broker",
      downPaymentPct: 20, mortgageRate: 4.3, mortgageTerm: 30, riskFreeRate: 2.5, horizon: 30, sellingCostPct: 3.6,
      ratePeriods: [{ toYear: 10, type: "fixed", rate: 4.35 }, { toYear: 30, type: "floating", rateMin: 4.04, rateMax: 4.52 }],
      rentFreq: "monthly", rentInflation: 2.5, ownOngoingInflation: 2, rentOngoingInflation: 2,
      homes: {
        "apt-studio": {
          propertyPrice: 220000, rentAmount: 720, houseGrowth: 2.5, setupCost: 11.57, ownOngoingCost: 1300, rentOngoingCost: 70, sqm: 38,
          where: "1-Zimmer flat in Prenzlauer Berg, Friedrichshain, Charlottenburg, Schöneberg: about €5,800/m² × 38 m²; asking rent about €19/m² net cold",
          setupCalc: "Grunderwerbsteuer 6% of €220,000 = €13,200; notary and land registry ~2% = €4,400 (rule of thumb, estimate, not sourced); buyer's broker share 3.57% = €7,854; total €25,454 = 11.57%",
          costCalc: "Non-recoverable Hausgeld: WEG manager €360 + reserve fund and repairs €1.20/m²/month = €547; interior upkeep €8/m² = €304; contents insurance €80; total about €1,300/yr. Grundsteuer, building insurance and other Betriebskosten are recharged to tenants, so left out of both sides. Renter: contents insurance €70/yr, no letting fee (estimate, not sourced)"
        },
        "apt-1br": {
          propertyPrice: 340000, rentAmount: 1000, houseGrowth: 2.5, setupCost: 11.57, ownOngoingCost: 1800, rentOngoingCost: 90, sqm: 60,
          where: "2-Zimmer flat in Prenzlauer Berg, Friedrichshain, Charlottenburg, Schöneberg: about €5,700/m² × 60 m²; asking rent about €17/m² net cold",
          setupCalc: "Grunderwerbsteuer 6% of €340,000 = €20,400; notary and land registry ~2% = €6,800 (rule of thumb, estimate, not sourced); buyer's broker share 3.57% = €12,138; total €39,338 = 11.57%",
          costCalc: "Non-recoverable Hausgeld: WEG manager €360 + reserve fund and repairs €1.20/m²/month = €864; interior upkeep €8/m² = €480; contents insurance €100; total about €1,800/yr. Grundsteuer, building insurance and other Betriebskosten are recharged to tenants, so left out of both sides. Renter: contents insurance €90/yr, no letting fee (estimate, not sourced)"
        },
        "apt-2br": {
          propertyPrice: 490000, rentAmount: 1400, houseGrowth: 2.5, setupCost: 11.57, ownOngoingCost: 2300, rentOngoingCost: 110, sqm: 82,
          where: "3-Zimmer flat in Prenzlauer Berg, Friedrichshain, Charlottenburg, Schöneberg: about €6,000/m² × 82 m²; asking rent about €17/m² net cold",
          setupCalc: "Grunderwerbsteuer 6% of €490,000 = €29,400; notary and land registry ~2% = €9,800 (rule of thumb, estimate, not sourced); buyer's broker share 3.57% = €17,493; total €56,693 = 11.57%",
          costCalc: "Non-recoverable Hausgeld: WEG manager €360 + reserve fund and repairs €1.20/m²/month = €1,181; interior upkeep €8/m² = €656; contents insurance €120; total about €2,300/yr. Grundsteuer, building insurance and other Betriebskosten are recharged to tenants, so left out of both sides. Renter: contents insurance €110/yr, no letting fee (estimate, not sourced)"
        },
        "apt-4br": {
          propertyPrice: 990000, rentAmount: 2600, houseGrowth: 2.5, setupCost: 11.57, ownOngoingCost: 3900, rentOngoingCost: 160, sqm: 150,
          where: "5-Zimmer Altbau flat in Charlottenburg, Wilmersdorf, Schöneberg, Prenzlauer Berg: about €6,600/m² × 150 m²; asking rent about €17.30/m²; upper segment",
          setupCalc: "Grunderwerbsteuer 6% of €990,000 = €59,400; notary and land registry ~2% = €19,800 (rule of thumb, estimate, not sourced); buyer's broker share 3.57% = €35,343; total €114,543 = 11.57%",
          costCalc: "Non-recoverable Hausgeld: WEG manager €360 + reserve fund and repairs €1.20/m²/month = €2,160; interior upkeep €8/m² = €1,200; contents insurance €180; total about €3,900/yr. Grundsteuer, building insurance and other Betriebskosten are recharged to tenants, so left out of both sides. Renter: contents insurance €160/yr, no letting fee (estimate, not sourced)"
        },
        "house-4br": {
          propertyPrice: 620000, rentAmount: 1950, houseGrowth: 2, setupCost: 11.57, ownOngoingCost: 3050, rentOngoingCost: 160, sqm: 130, landSqm: 500,
          where: "5-room detached, semi-detached or terraced house in outer districts: Spandau, Pankow (Französisch Buchholz, Blankenburg), Marzahn-Hellersdorf (Mahlsdorf, Kaulsdorf), Zehlendorf. 2025 sales averaged €670k detached, €551k semi, €542k terraced. Cheaper than an inner-city 5-Zimmer flat because it is far out",
          setupCalc: "Grunderwerbsteuer 6% of €620,000 = €37,200; notary and land registry ~2% = €12,400 (rule of thumb, estimate, not sourced); buyer's broker share 3.57% = €22,134; total €71,734 = 11.57%",
          costCalc: "Maintenance and repairs €20/m² × 130 m² = €2,600 + heating service and chimney sweep €250 + contents insurance €180 = about €3,050/yr. Grundsteuer and building insurance are recharged to a house tenant too, so left out of both sides. Renter: contents insurance €160/yr (estimate, not sourced)",
          sources: [
            { name: "miet-check.de, Berlin house rents 2026", url: "https://www.miet-check.de/mietspiegel/berlin/" }
          ]
        }
      },
      unavailable: {
        "house-studio": "Berlin's houses are family homes on their own plots; a house with no separate bedroom is not built or traded as a segment.",
        "house-1br": "Berlin's house stock is 4-6 room detached, semi-detached and terraced homes; 1-bedroom houses are too rare to quote a price or rent.",
        "house-2br": "Small 3-room Siedlungshäuser trade occasionally in the outer districts but are almost never let, and most Berlin houses have 4-6 rooms, so no typical rent can be quoted."
      },
      notes: {
        market: "Berlin is a renters' city: well under a fifth of homes are owner-occupied (estimate, not sourced). Most stock is flats in Altbau and post-war blocks; houses are in the outer districts.",
        downPaymentPct: "20%: German banks price best at or below 80% loan-to-value and expect the 11-12% purchase costs to come from savings (estimate, not sourced).",
        mortgageRate: "Interhyp, early Oct 2026: 10-year fix at 80% LTV 4.35%, 15 years 4.52%; ECB: over-10-year fixes 4.04% (Aug). 10-year fix, then refinanced between 4.04 and 4.52%.",
        riskFreeRate: "2.5%: 12-month Bubills sold at 3.07% and 6-month at 2.77% on 14 Sep 2026; new 1-year household deposits averaged 2.28% in Aug (ECB MIR).",
        sellingCostPct: "3.6%: the seller's half of the usual 7.14% Berlin broker commission; no tax on gains from a home the owner lived in (estimate, not sourced).",
        rentInflation: "2.5%: ImmoScout24 asking rents for existing flats rose 1.7% in the year to Q3 2026; the Mietspiegel and a 15% three-year cap limit rises for sitting tenants.",
        houseGrowth: "Gutachterausschuss index: flats +8%/yr 2010-2025 and +6.7%/yr since 2015 but flat since 2022; houses +5.7%/yr. Tempered to 2.5% for flats and 2% for houses.",
        setupCost: "Grunderwerbsteuer 6%, notary and land registry about 2%, and the buyer's half of the broker commission, 3.57%. A standard Annuitätendarlehen carries no bank fees.",
        ownOngoingCost: "Non-recoverable Hausgeld (manager, reserve fund, repairs), upkeep and contents insurance. Grundsteuer and building insurance are recharged to tenants, so left out (estimate).",
        rentOngoingCost: "Contents insurance only: since 2015 the landlord pays the letting agent (Bestellerprinzip) and the deposit is refundable (estimate, not sourced).",
        caveat: "Rents are free-market asking rents. The Mietpreisbremse caps new lets of older flats at Mietspiegel +10%, and municipal landlords rent far cheaper."
      },
      sources: [
        { name: "Gutachterausschuss Berlin, Immobilienmarktbericht 2025/2026", url: "https://www.berlin.de/gutachterausschuss/_assets/amarktinformationen/amarktanalyse/04-03-010-2500.pdf" },
        { name: "ImmoScout24 WohnBarometer, Q3 2026", url: "https://www.immobilienscout24.de/wohnbarometer.html" },
        { name: "ImmoScout24 WohnBarometer Kauf, Q2 2026", url: "https://www.immobilienscout24.de/unternehmen/fileadmin/user_upload/IS24_20260701_WBM_Q2_2026_Kauf.pdf" },
        { name: "Immoportal, Prenzlauer Berg prices by rooms, Oct 2026", url: "https://www.immoportal.com/immobilienpreise/berlin/prenzlauer-berg" },
        { name: "Immoportal, Friedrichshain prices by rooms, Oct 2026", url: "https://www.immoportal.com/immobilienpreise/berlin/friedrichshain" },
        { name: "Immoportal, Charlottenburg prices by rooms, Oct 2026", url: "https://www.immoportal.com/immobilienpreise/berlin/charlottenburg" },
        { name: "miet-check.de, Berlin asking rents 2026", url: "https://www.miet-check.de/mietspiegel/berlin/" },
        { name: "Interhyp, Bauzinsen Oct 2026", url: "https://www.interhyp.de/zinsen/" },
        { name: "Deutsche Bundesbank, Bubill auction 14 Sep 2026", url: "https://www.bundesbank.de/resource/blob/1008300/551448c9e95d4c167c57a5cf59801fa7/472B63F073F071307366337C94F8C870/2026-09-14-tenderergebnis-download.pdf" },
        { name: "ECB Data Portal, MIR Germany mortgage rates, Aug 2026", url: "https://data-api.ecb.europa.eu/service/data/MIR/M.DE.B.A2C.P.R.A.2250.EUR.N?lastNObservations=4&format=csvdata" }
      ]
    },
    {
      key: "amsterdam", city: "Amsterdam", country: "Netherlands", countryId: "Belanda", countryCode: "NL", region: "Europe",
      aliases: ["Noord-Holland","North Holland","Randstad","Mokum"],
      currencySymbol: "€", currencyCode: "EUR", asOf: "2026-10",
      buyer: "Dutch resident owner-occupier, first home, aged 35 or over (no starter transfer-tax exemption), without NHG",
      downPaymentPct: 10, mortgageRate: 3.9, mortgageTerm: 30, riskFreeRate: 2.5, horizon: 30, sellingCostPct: 1.6,
      rentFreq: "monthly", rentInflation: 3, ownOngoingInflation: 2.5, rentOngoingInflation: 2.5,
      homes: {
        "apt-studio": {
          propertyPrice: 330000, rentAmount: 1100, houseGrowth: 3, setupCost: 3.73, ownOngoingCost: 2050, rentOngoingCost: 120, sqm: 35,
          where: "1-kamer flat in Oud-West, De Pijp, Oost, Westerpark: about €9,400/m² × 35 m² (NVM regional flat median €8,221/m² plus an inner-ring premium); rent about €31/m², likely rent-regulated (see caveat)",
          setupCalc: "Overdrachtsbelasting 2% of €330,000 = €6,600; notary deeds incl. Kadaster ~€1,600; valuation ~€850; mortgage advice ~€3,000; bank guarantee ~€250; total €12,300 = 3.73% (fees are estimates, not sourced; NHG fee and buyer's agent not included)",
          costCalc: "OZB ~0.044% of WOZ €297,000 = €131 + water board ~0.017% = €50 + sewer levy ~€200 + VvE €100/month = €1,200 + interior upkeep €10/m² = €350 + contents insurance €120, about €2,050/yr; renter: contents insurance €120/yr, no agency fee. Assumes ground rent bought off or freehold (estimate, not sourced)"
        },
        "apt-1br": {
          propertyPrice: 495000, rentAmount: 1500, houseGrowth: 3, setupCost: 3.15, ownOngoingCost: 2950, rentOngoingCost: 150, sqm: 55,
          where: "2-kamer flat in Oud-West, De Pijp, Oost, Westerpark: about €9,000/m² × 55 m²; free-sector rent about €27.50/m²",
          setupCalc: "Overdrachtsbelasting 2% of €495,000 = €9,900; notary deeds incl. Kadaster ~€1,600; valuation ~€850; mortgage advice ~€3,000; bank guarantee ~€250; total €15,600 = 3.15% (fees are estimates, not sourced; NHG fee and buyer's agent not included)",
          costCalc: "OZB ~0.044% of WOZ €445,500 = €196 + water board ~0.017% = €76 + sewer levy ~€200 + VvE €150/month = €1,800 + interior upkeep €10/m² = €550 + contents insurance €150, about €2,950/yr; renter: contents insurance €150/yr, no agency fee. Assumes ground rent bought off or freehold (estimate, not sourced)"
        },
        "apt-2br": {
          propertyPrice: 650000, rentAmount: 1950, houseGrowth: 3, setupCost: 2.9, ownOngoingCost: 3900, rentOngoingCost: 180, sqm: 75,
          where: "3-kamer flat in Oud-West, De Pijp, Oost, Westerpark: about €8,700/m² × 75 m²; free-sector rent about €26/m²",
          setupCalc: "Overdrachtsbelasting 2% of €650,000 = €13,000; notary deeds incl. Kadaster ~€1,700; valuation ~€900; mortgage advice ~€3,000; bank guarantee ~€250; total €18,850 = 2.90% (fees are estimates, not sourced; NHG fee and buyer's agent not included)",
          costCalc: "OZB ~0.044% of WOZ €585,000 = €257 + water board ~0.017% = €99 + sewer levy ~€200 + VvE €200/month = €2,400 + interior upkeep €10/m² = €750 + contents insurance €180, about €3,900/yr; renter: contents insurance €180/yr, no agency fee. Assumes ground rent bought off or freehold (estimate, not sourced)"
        },
        "apt-4br": {
          propertyPrice: 1170000, rentAmount: 3100, houseGrowth: 3, setupCost: 2.57, ownOngoingCost: 6250, rentOngoingCost: 250, sqm: 130,
          where: "5-kamer flat in Oud-Zuid, Rivierenbuurt, Oost, IJburg: about €9,000/m² × 130 m²; free-sector rent about €24/m²; upper segment, often split-level",
          setupCalc: "Overdrachtsbelasting 2% of €1,170,000 = €23,400; notary deeds incl. Kadaster ~€1,800; valuation ~€1,100; mortgage advice ~€3,500; bank guarantee ~€250; total €30,050 = 2.57% (fees are estimates, not sourced; NHG fee and buyer's agent not included)",
          costCalc: "OZB ~0.044% of WOZ €1,053,000 = €463 + water board ~0.017% = €179 + sewer levy ~€200 + VvE €320/month = €3,840 + interior upkeep €10/m² = €1,300 + contents insurance €250, about €6,250/yr; renter: contents insurance €250/yr, no agency fee. Assumes ground rent bought off or freehold (estimate, not sourced)"
        },
        "house-4br": {
          propertyPrice: 750000, rentAmount: 2500, houseGrowth: 3, setupCost: 2.85, ownOngoingCost: 4550, rentOngoingCost: 250, sqm: 130, landSqm: 130,
          where: "5-kamer row house (eengezinswoning) outside the ring: Noord (Buiksloot, Nieuwendam), Nieuw-West (Osdorp, De Aker), IJburg, Zuidoost (Gaasperdam); about €5,800/m² × 130 m², rent about €19/m². Cheaper than an inner 5-kamer flat because it is further out",
          setupCalc: "Overdrachtsbelasting 2% of €750,000 = €15,000; notary deeds incl. Kadaster ~€1,700; valuation ~€950; mortgage advice ~€3,000; bank guarantee ~€250; building survey €450; total €21,350 = 2.85% (fees are estimates, not sourced; NHG fee and buyer's agent not included)",
          costCalc: "OZB ~0.044% of WOZ €675,000 = €297 + water board €115 + sewer levy ~€200 + building insurance €450 + maintenance 1% of rebuild value (~€2,500/m² × 130 m²) = €3,250 + contents insurance €250, about €4,550/yr; renter: contents insurance €250/yr. Annual erfpacht canon, if not bought off, would add €1,000-3,000 (estimate, not sourced)",
          sources: [
            { name: "NVM, Marktoverzicht Groot-Amsterdam Q3 2026 (row house €5,222/m²)", url: "https://www.nvm.nl/api/assets/media/0n0n1d0d/marktoverzicht-regio-groot-amsterdam-3e-kwartaal-2026.pdf" }
          ]
        }
      },
      unavailable: {
        "house-studio": "Amsterdam's houses are family row houses; a house with no separate bedroom is not built or traded as a segment.",
        "house-1br": "The private house stock is 4-5 room row houses outside the ring; 1-bedroom houses are too rare to quote a price or rent.",
        "house-2br": "Small 2-bedroom cottages exist mainly in Noord's garden villages and are largely social rentals owned by housing associations, so no free-sector price and rent can be quoted."
      },
      notes: {
        market: "Amsterdam is mostly flats; roughly 3 in 10 homes are owner-occupied and about 4 in 10 are social rentals (estimate, not sourced). Houses sit outside the ring.",
        downPaymentPct: "10%: Dutch rules allow loans up to 100% of value, but buyers pay purchase costs from savings and about 10% down reaches the 90% LTV rate band (estimate, not sourced).",
        mortgageRate: "3.9%: new Dutch house-purchase loans averaged 3.94% in Aug 2026, with 5-10 year fixes at 3.93% (ECB MIR). Most buyers fix 10 years on a 30-year annuity loan.",
        riskFreeRate: "2.5%: new 1-year household term deposits paid 2.54% in Aug 2026 (ECB MIR); instant-access savings about 1.3%; ECB deposit rate 2.5%.",
        sellingCostPct: "1.6%: seller's agent commission of about 1-1.5% plus VAT, marketing and energy label; no capital gains tax on a main home (estimate, not sourced).",
        rentInflation: "3%: CBS measured Amsterdam rent rises averaging about 3.4%/yr over 2015-2026 (4.3% in 2026); free-sector rises for sitting tenants are capped near CPI + 1%.",
        houseGrowth: "CBS price index for Amsterdam: +4.8%/yr 2006-2026 and +6.8%/yr 2016-2026, but only +0.8% in the year to Q2 2026 as supply rose. Tempered to 3%.",
        setupCost: "Transfer tax 2% for an owner-occupier, notary deeds, valuation, mortgage advice and bank guarantee; houses add a building survey (fees are estimates, not sourced).",
        ownOngoingCost: "OZB and water board tax on the WOZ value, sewer levy, VvE contribution for flats or insurance and upkeep for houses, plus contents insurance (estimate, not sourced).",
        rentOngoingCost: "Contents insurance only: Dutch law bars letting agents from charging tenants, and the deposit is refundable (estimate, not sourced).",
        caveat: "Mortgage interest deductibility and erfpacht ground rent are not modelled. Homes under 187 WWS points (rent up to €1,228) are regulated; rents shown are free sector. Starter exemption ignored."
      },
      sources: [
        { name: "NVM, Marktoverzicht Groot-Amsterdam Q3 2026", url: "https://www.nvm.nl/api/assets/media/0n0n1d0d/marktoverzicht-regio-groot-amsterdam-3e-kwartaal-2026.pdf" },
        { name: "NVM, Regionale analyse Groot-Amsterdam Q3 2026", url: "https://www.nvm.nl/api/assets/media/gtncrfbe/regionale-analyse-regio-groot-amsterdam-3e-kwartaal-2026.pdf" },
        { name: "NVM, Analyse woningmarkt Q3 2026", url: "https://www.nvm.nl/api/assets/media/2uwnzubw/bijlage-1-analyse-woningmarkt-3e-kwartaal-2026.pdf" },
        { name: "NVM and VGM NL, huurcijfers Q4 2025", url: "https://www.nvm.nl/api/assets/media/5plfcq4w/20260129-persbericht-nvm-vgm-nl-huurcijfers-q4-2025-def.pdf" },
        { name: "CBS StatLine 85792NED, house price index by region (Amsterdam)", url: "https://opendata.cbs.nl/ODataApi/odata/85792NED" },
        { name: "CBS StatLine 83625NED, average sale price by municipality", url: "https://opendata.cbs.nl/ODataApi/odata/83625NED" },
        { name: "CBS StatLine 83162NED, rent increases by region", url: "https://opendata.cbs.nl/ODataApi/odata/83162NED" },
        { name: "ECB Data Portal, MIR Netherlands mortgage rates, Aug 2026", url: "https://data-api.ecb.europa.eu/service/data/MIR/M.NL.B.A2C.A.R.A.2250.EUR.N?lastNObservations=4&format=csvdata" },
        { name: "ECB Data Portal, MIR Netherlands 1-year deposit rates, Aug 2026", url: "https://data-api.ecb.europa.eu/service/data/MIR/M.NL.B.L22.F.R.A.2250.EUR.N?lastNObservations=3&format=csvdata" }
      ]
    },
    {
      key: "losangeles", city: "Los Angeles", country: "United States", countryId: "Amerika Serikat", countryCode: "US", region: "North America",
      aliases: ["LA","US","USA","California"],
      currencySymbol: "$", currencyCode: "USD", asOf: "2026-10",
      buyer: "US resident owner-occupier buying a first home with a conventional 30-year fixed loan and 20% down, no first-time buyer assistance",
      downPaymentPct: 20, mortgageRate: 7.3, mortgageTerm: 30, riskFreeRate: 4, horizon: 30, sellingCostPct: 6.3,
      rentFreq: "monthly", rentInflation: 3, ownOngoingInflation: 2.5, rentOngoingInflation: 2.5,
      homes: {
        "apt-studio": {
          propertyPrice: 380000, rentAmount: 1800, houseGrowth: 3, setupCost: 1.36, ownOngoingCost: 10763, rentOngoingCost: 270, sqm: 51,
          where: "Downtown LA lofts, Koreatown/Mid-Wilshire, Hollywood. Zillow has no studio series: derived from the 1BR value per sq ft (about $690) x 550 sq ft = about $380k. Rent: Zumper Oct 2026 studio averages $1,450 to $2,030 in these areas.",
          setupCalc: "No buyer transfer tax (county and city tax paid by seller in LA). Approx.: lender fees $1,800, appraisal $750, lender title policy $804, half of escrow $505, recording and notary $300, inspection $500, HOA transfer and docs $500; total $5,159 = 1.36% of $380,000",
          costCalc: "Prop 13 tax 1.21% of price less $7,000 exemption $4,513 + direct assessments $250 + HOA $400/mo $4,800 + HO-6 insurance $500 + upkeep $700 = $10,763/yr; renter: contents insurance $220 + application and screening fees about $150 per move over a 3-year tenancy $50 = $270/yr",
          sources: [
            { name: "Zillow ZHVI by ZIP, 1-bedroom, Aug 2026 (CSV)", url: "https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_bdrmcnt_1_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv" },
            { name: "Zumper, Downtown LA rent by bedroom, Oct 2026", url: "https://www.zumper.com/rent-research/los-angeles-ca/downtown-los-angeles" },
            { name: "Zumper, Koreatown rent by bedroom, Oct 2026", url: "https://www.zumper.com/rent-research/los-angeles-ca/wilshire-center-koreatown" }
          ]
        },
        "apt-1br": {
          propertyPrice: 500000, rentAmount: 2250, houseGrowth: 3, setupCost: 1.08, ownOngoingCost: 13615, rentOngoingCost: 270, sqm: 67,
          where: "Downtown LA, Koreatown/Mid-Wilshire, Hollywood, Sherman Oaks. Zillow Aug 2026 1BR values in these ZIPs run $390k to $620k (median about $480k). Rent: Zumper Oct 2026 1BR averages $1,950 to $2,450, plus a small condo premium.",
          setupCalc: "No buyer transfer tax (county and city tax paid by seller in LA). Approx.: lender fees $1,800, appraisal $750, lender title policy $900, half of escrow $625, recording and notary $300, inspection $500, HOA transfer and docs $500; total $5,375 = 1.08% of $500,000",
          costCalc: "Prop 13 tax 1.21% of price less $7,000 exemption $5,965 + direct assessments $250 + HOA $500/mo $6,000 + HO-6 insurance $500 + upkeep $900 = $13,615/yr; renter: contents insurance $220 + application and screening fees about $150 per move over a 3-year tenancy $50 = $270/yr",
          sources: [
            { name: "Zillow ZHVI by ZIP, 1-bedroom, Aug 2026 (CSV)", url: "https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_bdrmcnt_1_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv" },
            { name: "Zumper, Downtown LA rent by bedroom, Oct 2026", url: "https://www.zumper.com/rent-research/los-angeles-ca/downtown-los-angeles" },
            { name: "Zumper, Sherman Oaks rent by bedroom, Oct 2026", url: "https://www.zumper.com/rent-research/los-angeles-ca/sherman-oaks" }
          ]
        },
        "apt-2br": {
          propertyPrice: 730000, rentAmount: 3000, houseGrowth: 3, setupCost: 0.79, ownOngoingCost: 18598, rentOngoingCost: 270, sqm: 102,
          where: "Downtown LA, Koreatown/Mid-Wilshire, Hollywood, Sherman Oaks. Zillow Aug 2026 2BR values in these ZIPs run $580k to $820k (median about $730k). Rent: Zumper Oct 2026 2BR averages $2,500 to $3,390.",
          setupCalc: "No buyer transfer tax (county and city tax paid by seller in LA). Approx.: lender fees $1,800, appraisal $750, lender title policy $1,084, half of escrow $855, recording and notary $300, inspection $500, HOA transfer and docs $500; total $5,789 = 0.79% of $730,000",
          costCalc: "Prop 13 tax 1.21% of price less $7,000 exemption $8,748 + direct assessments $250 + HOA $650/mo $7,800 + HO-6 insurance $600 + upkeep $1,200 = $18,598/yr; renter: contents insurance $220 + application and screening fees about $150 per move over a 3-year tenancy $50 = $270/yr",
          sources: [
            { name: "Zillow ZHVI by ZIP, 2-bedroom, Aug 2026 (CSV)", url: "https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_bdrmcnt_2_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv" },
            { name: "Zumper, Downtown LA rent by bedroom, Oct 2026", url: "https://www.zumper.com/rent-research/los-angeles-ca/downtown-los-angeles" },
            { name: "Zumper, Koreatown rent by bedroom, Oct 2026", url: "https://www.zumper.com/rent-research/los-angeles-ca/wilshire-center-koreatown" }
          ]
        },
        "house-2br": {
          propertyPrice: 800000, rentAmount: 3300, houseGrowth: 4, setupCost: 0.7, ownOngoingCost: 16145, rentOngoingCost: 270, sqm: 88, landSqm: 520,
          where: "Older bungalow areas: North Hollywood, Van Nuys, Highland Park, El Sereno. Zillow Aug 2026 2BR values there run $690k to $820k (mixed with some condos, houses sit at the top). Rent: Zumper LA 2BR house listings median about $3,500.",
          setupCalc: "No buyer transfer tax (county and city tax paid by seller in LA). Approx.: lender fees $1,800, appraisal $750, lender title policy $1,140, half of escrow $925, recording and notary $300, inspection $700; total $5,615 = 0.70% of $800,000",
          costCalc: "Prop 13 tax 1.21% of price less $7,000 exemption $9,595 + direct assessments $450 + homeowners insurance $2,600 + upkeep on an older bungalow $3,500 = $16,145/yr; renter: contents insurance $220 + application and screening fees about $150 per move over a 3-year tenancy $50 = $270/yr",
          sources: [
            { name: "Zillow ZHVI by ZIP, 2-bedroom, Aug 2026 (CSV)", url: "https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_bdrmcnt_2_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv" },
            { name: "Zumper, Los Angeles houses for rent, Oct 2026", url: "https://www.zumper.com/houses-for-rent/los-angeles-ca" }
          ]
        },
        "house-4br": {
          propertyPrice: 1050000, rentAmount: 4800, houseGrowth: 4, setupCost: 0.58, ownOngoingCost: 21970, rentOngoingCost: 270, sqm: 180, landSqm: 650,
          where: "San Fernando Valley middle ring: Northridge, Granada Hills, Reseda, North Hollywood. Zillow Aug 2026 4BR values there run $860k to $1.22M (median about $1.0M). Rent: Zumper Northridge 4BR average $5,047, Oct 2026.",
          setupCalc: "No buyer transfer tax (county and city tax paid by seller in LA). Approx.: lender fees $1,800, appraisal $750, lender title policy $1,340, half of escrow $1,175, recording and notary $300, inspection $700; total $6,065 = 0.58% of $1,050,000",
          costCalc: "Prop 13 tax 1.21% of price less $7,000 exemption $12,620 + direct assessments $450 + homeowners insurance $3,400 + upkeep $5,500 = $21,970/yr; renter: contents insurance $220 + application and screening fees about $150 per move over a 3-year tenancy $50 = $270/yr",
          sources: [
            { name: "Zillow ZHVI by ZIP, 4-bedroom, Aug 2026 (CSV)", url: "https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_bdrmcnt_4_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv" },
            { name: "Zumper, Northridge rent by bedroom, Oct 2026", url: "https://www.zumper.com/rent-research/los-angeles-ca/northridge" }
          ]
        }
      },
      unavailable: {
        "apt-4br": "Four-bedroom condos are a sliver of LA condo stock, mostly Wilshire Corridor and Century City penthouses at several million dollars; LA families wanting four bedrooms buy or rent houses.",
        "house-studio": "Studio detached houses are not a market segment in LA; the nearest equivalent is a backyard ADU, which is generally not sold separately from the main house.",
        "house-1br": "One-bedroom houses are rare in LA (a few pre-war cottages); single-family stock is overwhelmingly 2 to 4 bedrooms, so no typical price or rent can be quoted."
      },
      notes: {
        market: "A renter-majority city. Condos cluster in central districts; houses are mostly 2 to 4 bed single-family homes in the Valley and Eastside. Zillow LA values were flat in the year to Aug 2026.",
        downPaymentPct: "20% down avoids private mortgage insurance on a conventional loan. LA's 2026 conforming limit is $1,249,125, so every home here takes a conforming loan.",
        mortgageRate: "Freddie Mac PMMS 30-year fixed averaged 7.28% on 1 Oct 2026, up from 6.34% a year earlier after a Fed hike and a global bond selloff.",
        riskFreeRate: "3-month Treasury bills yielded about 4.0% in early Oct 2026 (FRED DTB3); top online savings accounts paid about 4.15 to 4.25%.",
        sellingCostPct: "About 5% total commission (negotiable since the 2024 NAR settlement), 0.56% county and city transfer tax, title and escrow about 0.7%. Measure ULA 4% starts only above $5.4M.",
        rentInflation: "Zillow rent index for LA city rose 3.4% a year over 10 years and 0.7% in the last year; LA-area rent CPI averaged about 4% a year in 1997 to 2017. 3% assumed.",
        houseGrowth: "Case-Shiller LA rose 2.5% a year over 20 years and 6.0% over 10; its condo index 1.9% and 4.5%. Tempered to 4% for houses and 3% for condos.",
        setupCost: "No buyer transfer tax in LA. Buyer pays lender fees, appraisal, lender title policy, half of escrow, recording, inspection and condo HOA transfer fees, about 0.6 to 1.4%.",
        ownOngoingCost: "Prop 13 tax of about 1.21% of the purchase price less the $7,000 homeowners exemption, direct assessments, HOA dues for condos, insurance and upkeep.",
        rentOngoingCost: "Renters insurance of about $220 a year plus application and screening fees of about $150 per move, spread over a 3-year tenancy.",
        caveat: "Prop 13 caps taxable value growth at 2% a year. Earthquake cover is extra. A 30-year fixed can be refinanced free if rates fall, which the calculator does not model."
      },
      sources: [
        { name: "Freddie Mac PMMS, 30-year fixed 7.28% (1 Oct 2026)", url: "https://www.freddiemac.com/pmms" },
        { name: "FRED, 3-month Treasury bill rate (DTB3), Oct 2026", url: "https://fred.stlouisfed.org/series/DTB3" },
        { name: "Zillow ZHVI by city, condo/co-op, Aug 2026 (CSV)", url: "https://files.zillowstatic.com/research/public_csvs/zhvi/City_zhvi_uc_condo_tier_0.33_0.67_sm_sa_month.csv" },
        { name: "Zumper, Los Angeles rent by bedroom, Oct 2026", url: "https://www.zumper.com/rent-research/los-angeles-ca" },
        { name: "S&P Cotality Case-Shiller LA index (FRED LXXRSA)", url: "https://fred.stlouisfed.org/series/LXXRSA" },
        { name: "Clever Real Estate, average commission survey 2026", url: "https://listwithclever.com/average-real-estate-commission-rate/" },
        { name: "Reeder, Measure ULA thresholds from 1 July 2026", url: "https://reedcorp.tax/helpful-guides/los-angeles-cpa-firm/la-measure-ula-no-reform-july-2026-thresholds/" },
        { name: "LA County Auditor-Controller, 2025-26 Taxpayers' Guide", url: "https://auditor.lacounty.gov/wp-content/uploads/2026/05/2025-2026-Taxpayers-Guide.pdf" },
        { name: "FHFA, 2026 conforming loan limits", url: "https://www.fhfa.gov/news/news-release/fhfa-announces-conforming-loan-limit-values-for-2026" }
      ]
    },
    {
      key: "sanfrancisco", city: "San Francisco", country: "United States", countryId: "Amerika Serikat", countryCode: "US", region: "North America",
      aliases: ["SF","Bay Area","US","USA","California"],
      currencySymbol: "$", currencyCode: "USD", asOf: "2026-10",
      buyer: "US resident owner-occupier buying a first home with a conventional 30-year fixed loan (jumbo above $1,249,125) and 20% down, no first-time buyer assistance",
      downPaymentPct: 20, mortgageRate: 7.3, mortgageTerm: 30, riskFreeRate: 4, horizon: 30, sellingCostPct: 6.1,
      rentFreq: "monthly", rentInflation: 3.5, ownOngoingInflation: 2.5, rentOngoingInflation: 2.5,
      homes: {
        "apt-studio": {
          propertyPrice: 520000, rentAmount: 2900, houseGrowth: 2.5, setupCost: 1.4, ownOngoingCost: 14667, rentOngoingCost: 250, sqm: 45,
          where: "SoMa, South Beach/Mission Bay, Nob Hill/Russian Hill, Hayes Valley. Zillow has no studio series: derived from the 1BR value per sq ft (about $1,085) x 480 sq ft = about $520k. Rent: Zumper Oct 2026 studio average $2,700 citywide, $3,500 in SoMa. Yield is high because rents jumped about 25% in 2026 while condo prices barely moved for a decade.",
          setupCalc: "Transfer tax paid by seller by SF custom; buyer pays owner title in Northern California. Approx.: lender fees $1,800, appraisal $900, owner title policy $1,840, lender title policy $733, half of escrow $720, recording and notary $300, inspection $500, HOA transfer and docs $500; total $7,293 = 1.40% of $520,000",
          costCalc: "property tax 1.1827% of price less $7,000 exemption $6,067 + parcel taxes and assessments approx. $700 + HOA $550/mo $6,600 + HO-6 insurance $500 + upkeep $800 = $14,667/yr; renter: contents insurance $200 + application fees about $150 per move over a 3-year tenancy $50 = $250/yr",
          sources: [
            { name: "Zillow ZHVI by ZIP, 1-bedroom, Aug 2026 (CSV)", url: "https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_bdrmcnt_1_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv" },
            { name: "Zumper, SoMa rent by bedroom, Oct 2026", url: "https://www.zumper.com/rent-research/san-francisco-ca/soma" }
          ]
        },
        "apt-1br": {
          propertyPrice: 760000, rentAmount: 4300, houseGrowth: 2.5, setupCost: 1.07, ownOngoingCost: 19556, rentOngoingCost: 250, sqm: 65,
          where: "SoMa, South Beach/Mission Bay, Nob Hill/Russian Hill, Hayes Valley. Zillow Aug 2026 1BR values in these ZIPs run $610k to $910k (median about $760k). Rent: Zumper Oct 2026 1BR average $4,295 citywide, $4,995 in SoMa. High yield reflects the 2026 rent spike on flat condo prices.",
          setupCalc: "Transfer tax paid by seller by SF custom; buyer pays owner title in Northern California. Approx.: lender fees $1,800, appraisal $900, owner title policy $2,320, lender title policy $886, half of escrow $960, recording and notary $300, inspection $500, HOA transfer and docs $500; total $8,166 = 1.07% of $760,000",
          costCalc: "property tax 1.1827% of price less $7,000 exemption $8,906 + parcel taxes and assessments approx. $700 + HOA $700/mo $8,400 + HO-6 insurance $550 + upkeep $1,000 = $19,556/yr; renter: contents insurance $200 + application fees about $150 per move over a 3-year tenancy $50 = $250/yr",
          sources: [
            { name: "Zillow ZHVI by ZIP, 1-bedroom, Aug 2026 (CSV)", url: "https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_bdrmcnt_1_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv" },
            { name: "Zumper, SoMa rent by bedroom, Oct 2026", url: "https://www.zumper.com/rent-research/san-francisco-ca/soma" }
          ]
        },
        "apt-2br": {
          propertyPrice: 1250000, rentAmount: 6200, houseGrowth: 2.5, setupCost: 0.8, ownOngoingCost: 28851, rentOngoingCost: 250, sqm: 100,
          where: "SoMa, South Beach/Mission Bay, Nob Hill/Russian Hill, Hayes Valley. Zillow Aug 2026 2BR values in these ZIPs run $930k to $1.52M (median about $1.25M); citywide condo median $1.25M in July 2026. Rent: Zumper Oct 2026 2BR average $6,235.",
          setupCalc: "Transfer tax paid by seller by SF custom; buyer pays owner title in Northern California. Approx.: lender fees $1,800, appraisal $900, owner title policy $3,300, lender title policy $1,200, half of escrow $1,450, recording and notary $300, inspection $500, HOA transfer and docs $500; total $9,950 = 0.80% of $1,250,000",
          costCalc: "property tax 1.1827% of price less $7,000 exemption $14,701 + parcel taxes and assessments approx. $700 + HOA $950/mo $11,400 + HO-6 insurance $650 + upkeep $1,400 = $28,851/yr; renter: contents insurance $200 + application fees about $150 per move over a 3-year tenancy $50 = $250/yr",
          sources: [
            { name: "Zillow ZHVI by ZIP, 2-bedroom, Aug 2026 (CSV)", url: "https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_bdrmcnt_2_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv" },
            { name: "Zumper, SoMa rent by bedroom, Oct 2026", url: "https://www.zumper.com/rent-research/san-francisco-ca/soma" }
          ]
        },
        "house-2br": {
          propertyPrice: 1350000, rentAmount: 5000, houseGrowth: 3.5, setupCost: 0.75, ownOngoingCost: 23283, rentOngoingCost: 250, sqm: 105, landSqm: 230,
          where: "Sunset, Parkside, Excelsior, Portola: classic 2BR row houses over a garage. Zillow Aug 2026 2BR values there run $980k to $1.55M (about $1.27M average), nudged up for the 2026 bidding wars. Rent: Zumper SF 2BR house listings median $5,000, Outer Sunset 2BR average $5,145.",
          setupCalc: "Transfer tax paid by seller by SF custom; buyer pays owner title in Northern California. Approx.: lender fees $1,800, appraisal $900, owner title policy $3,500, lender title policy $1,264, half of escrow $1,550, recording and notary $300, inspection $800; total $10,114 = 0.75% of $1,350,000",
          costCalc: "property tax 1.1827% of price less $7,000 exemption $15,883 + parcel taxes and assessments approx. $700 + homeowners insurance $2,200 + upkeep on a 1930s to 1950s house $4,500 = $23,283/yr; renter: contents insurance $200 + application fees about $150 per move over a 3-year tenancy $50 = $250/yr",
          sources: [
            { name: "Zillow ZHVI by ZIP, 2-bedroom, Aug 2026 (CSV)", url: "https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_bdrmcnt_2_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv" },
            { name: "Zumper, San Francisco houses for rent, Oct 2026", url: "https://www.zumper.com/houses-for-rent/san-francisco-ca" },
            { name: "Zumper, Outer Sunset rent by bedroom, Oct 2026", url: "https://www.zumper.com/rent-research/san-francisco-ca/outer-sunset" }
          ]
        },
        "house-4br": {
          propertyPrice: 2100000, rentAmount: 8500, houseGrowth: 3.5, setupCost: 0.61, ownOngoingCost: 34954, rentOngoingCost: 250, sqm: 185, landSqm: 260,
          where: "Sunset, Parkside, Outer Richmond, Excelsior. Zillow Aug 2026 4BR values there run $1.39M to $2.41M; citywide 4BR value $2.20M. Loan above $1,249,125 is jumbo. Rent: Zumper SF 4BR house listings median about $10,350, lower in Excelsior; $8,500 used for these areas.",
          setupCalc: "Transfer tax paid by seller by SF custom; buyer pays owner title in Northern California. Approx.: lender fees $1,800, appraisal $900, owner title policy $5,000, lender title policy $1,744, half of escrow $2,300, recording and notary $300, inspection $800; total $12,844 = 0.61% of $2,100,000",
          costCalc: "property tax 1.1827% of price less $7,000 exemption $24,754 + parcel taxes and assessments approx. $700 + homeowners insurance $3,000 + upkeep $6,500 = $34,954/yr; renter: contents insurance $200 + application fees about $150 per move over a 3-year tenancy $50 = $250/yr",
          sources: [
            { name: "Zillow ZHVI by ZIP, 4-bedroom, Aug 2026 (CSV)", url: "https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_bdrmcnt_4_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv" },
            { name: "Zumper, San Francisco houses for rent, Oct 2026", url: "https://www.zumper.com/houses-for-rent/san-francisco-ca" },
            { name: "Zumper, Outer Sunset rent by bedroom, Oct 2026", url: "https://www.zumper.com/rent-research/san-francisco-ca/outer-sunset" }
          ]
        }
      },
      unavailable: {
        "apt-4br": "Four-bedroom condos are a thin luxury niche in SF (full-floor Pacific Heights or Russian Hill flats); condo stock runs studio to 2 bedrooms, too few sales to quote a price.",
        "house-studio": "Studio detached houses do not exist as a segment in San Francisco's housing stock.",
        "house-1br": "One-bedroom houses are a rarity in SF, where single-family stock is row houses of 2 to 4 bedrooms on 25-ft lots, so no typical price or rent can be quoted."
      },
      notes: {
        market: "A renter-majority city. Condos cluster in SoMa, Mission Bay and Nob Hill; houses are 2 to 4 bed row houses on 25-ft lots. AI wealth lifted the July 2026 house median to $2.05M, up 25% on a year.",
        downPaymentPct: "20% down avoids private mortgage insurance. Loans above the $1,249,125 conforming limit are jumbo; MBA data showed jumbo rates within about 0.1 point of conforming in Sept 2026.",
        mortgageRate: "Freddie Mac PMMS 30-year fixed averaged 7.28% on 1 Oct 2026, up from 6.34% a year earlier after a Fed hike and a global bond selloff.",
        riskFreeRate: "3-month Treasury bills yielded about 4.0% in early Oct 2026 (FRED DTB3); top online savings accounts paid about 4.15 to 4.25%.",
        sellingCostPct: "About 5% total commission, SF transfer tax on the whole price (0.68% under $1M, 0.75% from $1M to $5M) paid by the seller, escrow and fees about 0.35%.",
        rentInflation: "Zillow rent index for SF rose 3.5% a year over 10 years but 25% in the last year; SF-area rent CPI averaged 3.5% a year over 20 years. 3.5% assumed.",
        houseGrowth: "Case-Shiller SF rose 2.7% a year over 20 years and 4.9% over 10, but its condo index only 1.8% and 1.7%. Assumed 3.5% for houses and 2.5% for condos.",
        setupCost: "Seller pays transfer tax. Buyer pays the owner title policy (Northern California custom), lender fees, appraisal, lender title, half of escrow, inspection, condo HOA fees.",
        ownOngoingCost: "Property tax at the FY2025-26 rate of 1.1827% of the purchase price less the $7,000 exemption, about $700 of parcel taxes, HOA dues for condos, insurance and upkeep.",
        rentOngoingCost: "Renters insurance of about $200 a year plus application fees of about $150 per move, spread over a 3-year tenancy.",
        caveat: "Most pre-1979 rentals are rent controlled, so sitting tenants pay far less than these asking rents. The 2026 rent spike may fade. Prop 13 caps taxable value growth at 2% a year."
      },
      sources: [
        { name: "Freddie Mac PMMS, 30-year fixed 7.28% (1 Oct 2026)", url: "https://www.freddiemac.com/pmms" },
        { name: "FRED, 3-month Treasury bill rate (DTB3), Oct 2026", url: "https://fred.stlouisfed.org/series/DTB3" },
        { name: "Zillow ZHVI by city, condo/co-op, Aug 2026 (CSV)", url: "https://files.zillowstatic.com/research/public_csvs/zhvi/City_zhvi_uc_condo_tier_0.33_0.67_sm_sa_month.csv" },
        { name: "Zumper, San Francisco rent by bedroom, Oct 2026", url: "https://www.zumper.com/rent-research/san-francisco-ca" },
        { name: "S&P Cotality Case-Shiller San Francisco index (FRED SFXRSA)", url: "https://fred.stlouisfed.org/series/SFXRSA" },
        { name: "The Frontsteps, SF market update, July 2026 data", url: "https://thefrontsteps.com/2026/08/26/sfre-update-aug-2026/" },
        { name: "City of San Francisco, transfer tax", url: "https://www.sf.gov/transfer-tax" },
        { name: "SF Board of Supervisors, FY2025-26 property tax rate resolution", url: "https://sfbos.org/sites/default/files/r0447-25.pdf" },
        { name: "Clever Real Estate, average commission survey 2026", url: "https://listwithclever.com/average-real-estate-commission-rate/" },
        { name: "FHFA, 2026 conforming loan limits", url: "https://www.fhfa.gov/news/news-release/fhfa-announces-conforming-loan-limit-values-for-2026" }
      ]
    },
    {
      key: "houston", city: "Houston", country: "United States", countryId: "Amerika Serikat", countryCode: "US", region: "North America",
      aliases: ["US","USA","Texas"],
      currencySymbol: "$", currencyCode: "USD", asOf: "2026-10",
      buyer: "US resident owner-occupier buying a first home with a conventional 30-year fixed loan and 20% down, homestead exemption claimed, no first-time buyer assistance",
      downPaymentPct: 20, mortgageRate: 7.3, mortgageTerm: 30, riskFreeRate: 4, horizon: 30, sellingCostPct: 6.4,
      rentFreq: "monthly", rentInflation: 2.8, ownOngoingInflation: 3, rentOngoingInflation: 2.5,
      homes: {
        "apt-1br": {
          propertyPrice: 195000, rentAmount: 1400, houseGrowth: 2, setupCost: 2.36, ownOngoingCost: 10554, rentOngoingCost: 340, sqm: 74,
          where: "Uptown/Galleria, Montrose, Midtown, Medical Center (mid- and high-rise condos). Zillow Aug 2026 1BR values in these ZIPs run $110k to $265k (median about $200k). Rent: Zumper Oct 2026 1BR averages $1,307 to $1,495. Yield near 9% because high HOA dues, taxes and insurance hold condo prices down.",
          setupCalc: "Texas has no transfer tax. Approx.: lender fees $1,800, appraisal $600, simultaneous lender title policy and endorsements $450, half of escrow $550, recording and tax certificates $250, inspection $450, HOA transfer and resale certificate $500; total $4,600 = 2.36% of $195,000",
          costCalc: "property tax (HISD 0.8783% on value less $140k $483, city 0.5191% and county 0.3809% on 80% $1,404, Harris Health, flood, port, HCC 0.342% $667) $2,554 + HOA $550/mo (often incl. water and building insurance) $6,600 + HO-6 insurance $600 + upkeep $800 = $10,554/yr; renter: contents insurance $280 + application and admin fees about $180 per move over a 3-year tenancy $60 = $340/yr",
          sources: [
            { name: "Zillow ZHVI by ZIP, 1-bedroom, Aug 2026 (CSV)", url: "https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_bdrmcnt_1_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv" },
            { name: "Zumper, Great Uptown rent by bedroom, Oct 2026", url: "https://www.zumper.com/rent-research/houston-tx/great-uptown" },
            { name: "Zumper, Neartown Montrose rent by bedroom, Oct 2026", url: "https://www.zumper.com/rent-research/houston-tx/neartown-montrose" },
            { name: "Zumper, Midtown Houston rent by bedroom, Oct 2026", url: "https://www.zumper.com/rent-research/houston-tx/midtown" }
          ]
        },
        "apt-2br": {
          propertyPrice: 300000, rentAmount: 2050, houseGrowth: 2, setupCost: 1.53, ownOngoingCost: 16591, rentOngoingCost: 340, sqm: 116,
          where: "Uptown/Galleria, Montrose, Midtown, Medical Center. Zillow Aug 2026 2BR values in these ZIPs run $225k to $490k (median about $310k); Uptown-Galleria condo median about $300k. Rent: Zumper Oct 2026 2BR averages $1,896 to $2,199. High yield offset by HOA dues of $0.60 to $1 per sq ft a month.",
          setupCalc: "Texas has no transfer tax. Approx.: lender fees $1,800, appraisal $600, simultaneous lender title policy and endorsements $450, half of escrow $550, recording and tax certificates $250, inspection $450, HOA transfer and resale certificate $500; total $4,600 = 1.53% of $300,000",
          costCalc: "property tax (HISD 0.8783% on value less $140k $1,405, city 0.5191% and county 0.3809% on 80% $2,160, Harris Health, flood, port, HCC 0.342% $1,026) $4,591 + HOA $850/mo (often incl. water and building insurance) $10,200 + HO-6 insurance $700 + upkeep $1,100 = $16,591/yr; renter: contents insurance $280 + application and admin fees about $180 per move over a 3-year tenancy $60 = $340/yr",
          sources: [
            { name: "Zillow ZHVI by ZIP, 2-bedroom, Aug 2026 (CSV)", url: "https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_bdrmcnt_2_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv" },
            { name: "Prestige Realty, Galleria condo median and towers, 2026", url: "https://prestigerealtypro.com/blog/the-gallerias-condo-median-is-falling-the-new-towers-say-otherwise" },
            { name: "Zumper, Great Uptown rent by bedroom, Oct 2026", url: "https://www.zumper.com/rent-research/houston-tx/great-uptown" },
            { name: "Zumper, Neartown Montrose rent by bedroom, Oct 2026", url: "https://www.zumper.com/rent-research/houston-tx/neartown-montrose" }
          ]
        },
        "house-2br": {
          propertyPrice: 230000, rentAmount: 1500, houseGrowth: 3.5, setupCost: 2.11, ownOngoingCost: 9233, rentOngoingCost: 340, sqm: 85, landSqm: 560,
          where: "Older east and north side areas: East End (Eastwood, Magnolia Park), Northside (Lindale Park), Independence Heights. Zillow Aug 2026 2BR values there run $165k to $320k. Cheaper than the 2BR condo because these are modest post-war cottages in lower-priced areas, while 2BR condos sit in Uptown and Montrose towers. Rent: Zumper 2BR house listings $1,040 to $1,355 citywide, more near the centre.",
          setupCalc: "Texas has no transfer tax. Approx.: lender fees $1,800, appraisal $600, simultaneous lender title policy and endorsements $450, half of escrow $550, recording and tax certificates $250, survey $500, inspection and termite $700; total $4,850 = 2.11% of $230,000",
          costCalc: "property tax (HISD 0.8783% on value less $140k $790, city 0.5191% and county 0.3809% on 80% $1,656, Harris Health, flood, port, HCC 0.342% $787) $3,233 + homeowners insurance $3,000 + flood insurance (NFIP, outside high-risk zone) $700 + upkeep on a post-war cottage $2,300 = $9,233/yr; renter: contents insurance $280 + application and admin fees about $180 per move over a 3-year tenancy $60 = $340/yr",
          sources: [
            { name: "Zillow ZHVI by ZIP, 2-bedroom, Aug 2026 (CSV)", url: "https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_bdrmcnt_2_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv" },
            { name: "Zumper, Houston houses for rent, Oct 2026", url: "https://www.zumper.com/houses-for-rent/houston-tx" }
          ]
        },
        "house-4br": {
          propertyPrice: 340000, rentAmount: 2400, houseGrowth: 3.5, setupCost: 1.51, ownOngoingCost: 14267, rentOngoingCost: 340, sqm: 220, landSqm: 700,
          where: "Southwest Houston in HISD: Westbury, Meyerland, Sharpstown, Brays Oaks. Zillow Aug 2026 4BR values there run $260k to $500k (average about $350k); city 4BR value $327k; HAR metro single-family median $330k. Rent: Zumper 4BR house listings median $2,185, Clear Lake 4BR $2,655.",
          setupCalc: "Texas has no transfer tax. Approx.: lender fees $1,800, appraisal $600, simultaneous lender title policy and endorsements $450, half of escrow $550, recording and tax certificates $250, survey $500, inspection and termite $700, HOA transfer $300; total $5,150 = 1.51% of $340,000",
          costCalc: "property tax (HISD 0.8783% on value less $140k $1,757, city 0.5191% and county 0.3809% on 80% $2,448, Harris Health, flood, port, HCC 0.342% $1,163) $5,367 + homeowners insurance $4,200 + flood insurance (NFIP) $800 + civic association/HOA $500 + upkeep $3,400 = $14,267/yr; renter: contents insurance $280 + application and admin fees about $180 per move over a 3-year tenancy $60 = $340/yr",
          sources: [
            { name: "Zillow ZHVI by ZIP, 4-bedroom, Aug 2026 (CSV)", url: "https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_bdrmcnt_4_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv" },
            { name: "Zumper, Houston houses for rent, Oct 2026", url: "https://www.zumper.com/houses-for-rent/houston-tx" },
            { name: "Zumper, Clear Lake rent by bedroom, Oct 2026", url: "https://www.zumper.com/rent-research/houston-tx/clear-lake" }
          ]
        }
      },
      unavailable: {
        "apt-studio": "Studio condos are a thin niche in Houston; studios are overwhelmingly rented in purpose-built apartment complexes rather than owned, so no typical sale price can be quoted.",
        "apt-4br": "Four-bedroom condos are very rare in Houston (a few luxury River Oaks and Uptown tower units); families wanting four bedrooms buy plentiful, cheaper detached houses.",
        "house-studio": "Studio detached houses do not exist as a segment in Houston.",
        "house-1br": "One-bedroom houses are a curiosity in Houston, where detached stock is overwhelmingly 3 to 4 bedrooms on large lots, so no typical price or rent can be quoted."
      },
      notes: {
        market: "No zoning and abundant land keep 3 to 4 bed houses cheap. Condos are a small market of Uptown and Montrose towers with high HOA dues and 8.8 months of supply (HAR, Aug 2026).",
        downPaymentPct: "20% down avoids private mortgage insurance on a conventional loan; every home here falls under the $832,750 conforming limit.",
        mortgageRate: "Freddie Mac PMMS 30-year fixed averaged 7.28% on 1 Oct 2026, up from 6.34% a year earlier after a Fed hike and a global bond selloff.",
        riskFreeRate: "3-month Treasury bills yielded about 4.0% in early Oct 2026 (FRED DTB3); top online savings accounts paid about 4.15 to 4.25%.",
        sellingCostPct: "About 5.5% total commission (negotiable since the 2024 NAR settlement), seller-paid owner title policy about 0.6%, escrow and fees about 0.3%. Texas has no transfer tax.",
        rentInflation: "Zillow rent index for Houston rose 2.5% a year over 10 years and dipped in the last year on new supply; Houston rent CPI rose 3.2% a year over 20 years. 2.8% assumed.",
        houseGrowth: "FHFA Houston index rose 4.5% a year over 20 years and 5.4% over 10, but Zillow Houston condo values only 1.9% a year over 10. Assumed 3.5% for houses, 2% for condos.",
        setupCost: "No transfer tax. Buyer pays lender fees, appraisal, a simultaneous lender title policy with endorsements, half of escrow, a survey for houses, inspection, HOA transfer fees.",
        ownOngoingCost: "2025 rates total 2.12% (HISD, city, county, HCC); homestead takes $140k off school value and 20% off city and county. Plus high insurance, flood cover and condo HOA dues.",
        rentOngoingCost: "Renters insurance of about $280 a year plus application and admin fees of about $180 per move, spread over a 3-year tenancy.",
        caveat: "Homes in suburbs outside the city often add MUD taxes, lifting totals to 2.5% or more. Homestead taxable value can rise at most 10% a year. Flood risk varies by street."
      },
      sources: [
        { name: "Freddie Mac PMMS, 30-year fixed 7.28% (1 Oct 2026)", url: "https://www.freddiemac.com/pmms" },
        { name: "FRED, 3-month Treasury bill rate (DTB3), Oct 2026", url: "https://fred.stlouisfed.org/series/DTB3" },
        { name: "Zillow ZHVI by city, condo/co-op, Aug 2026 (CSV)", url: "https://files.zillowstatic.com/research/public_csvs/zhvi/City_zhvi_uc_condo_tier_0.33_0.67_sm_sa_month.csv" },
        { name: "Zumper, Houston rent by bedroom, Oct 2026", url: "https://www.zumper.com/rent-research/houston-tx" },
        { name: "FHFA house price index, Houston MSA (FRED ATNHPIUS26420Q)", url: "https://fred.stlouisfed.org/graph/fredgraph.csv?id=ATNHPIUS26420Q" },
        { name: "Hoodline, HAR August 2026 Houston home sales", url: "https://hoodline.com/2026/09/houston-home-sales-slide-11-5-but-realtors-say-buyers-are-winning/" },
        { name: "Houston ISD, tax information 2025", url: "https://www.houstonisd.org/our-district/budget-financial-planning/tax-information" },
        { name: "Community Impact, City of Houston keeps 2025 tax rate at $0.5191", url: "https://communityimpact.com/heights-river-oaks-montrose/government/houston-city-council-keeps-property-tax-rate-flat-despite-53m-projected-revenue-loss/" },
        { name: "Harris County Tax Office, 2025 adopted tax rates notice", url: "https://www.hctax.net/About/Announcements/Tax%20Hearing%20Notices/2025/2025%20Notice%20of%20Adopted%20Tax%20Rates%20HF,%20HP,%20HCHD%2009-19-2025.pdf" },
        { name: "Clever Real Estate, average commission survey 2026", url: "https://listwithclever.com/average-real-estate-commission-rate/" }
      ]
    },
    {
      key: "newyork", city: "New York", country: "United States", countryId: "Amerika Serikat", countryCode: "US", region: "North America",
      aliases: ["NYC","New York City","Manhattan","US","USA"],
      currencySymbol: "$", currencyCode: "USD", asOf: "2026-09",
      buyer: "US resident owner-occupier buying a first home with a conventional 30-year fixed loan; apartments are Manhattan resale co-ops (the majority of resale deals), houses are fee simple; no first-time buyer programs",
      downPaymentPct: 20, mortgageRate: 7.3, mortgageTerm: 30, riskFreeRate: 4, horizon: 30, sellingCostPct: 7.5,
      rentFreq: "monthly", rentInflation: 3, ownOngoingInflation: 3, rentOngoingInflation: 2.5,
      homes: {
        "apt-studio": {
          propertyPrice: 460000, rentAmount: 3450, houseGrowth: 2, setupCost: 1.84, ownOngoingCost: 13900, rentOngoingCost: 250, sqm: 40,
          where: "Manhattan co-op studio (Upper East Side, Upper West Side, Murray Hill, Midtown East). Price = Corcoran 3Q 2026 Manhattan resale co-op studio median $460K; rent = StreetEasy UES/UWS studio median asking rents ($3,300 to $3,750), below the Manhattan-wide $3,800 that includes new rental towers",
          setupCalc: "buyer attorney $3,000 + lender fees (application, appraisal, credit) $2,500 + lender attorney $1,250 + lien search, UCC-1 and recognition agreement $700 + board application and managing agent fees $1,000 = $8,450 = 1.84% of $460,000. Co-op share loans pay no mortgage recording tax and need no title insurance; fee levels (estimate, not sourced)",
          costCalc: "Owner: co-op maintenance 430 sq ft x $2.44/sq ft/mo (includes the building's property tax and underlying mortgage) $12,590 + contents and HO-6 insurance $300 + in-unit repairs $1,000 = $13,890/yr (used $13,900). Maintenance rate from AskDoss Manhattan average ($2.44/sq ft/mo). Gross yield 9.0% is high because the co-op price excludes the building's own mortgage and taxes, paid through maintenance; net of maintenance the yield is about 6%. Insurance and repairs (estimate, not sourced). Renter: renters insurance $250 = $250/yr. No broker fee: under the FARE Act landlords pay the broker they hire. Insurance (estimate, not sourced)"
        },
        "apt-1br": {
          propertyPrice: 695000, rentAmount: 4400, houseGrowth: 2, setupCost: 1.36, ownOngoingCost: 22100, rentOngoingCost: 250, sqm: 65,
          where: "Manhattan co-op 1-bedroom (Upper East Side, Upper West Side, Murray Hill, Chelsea). Price = Corcoran 3Q 2026 resale co-op 1BR median $695K; rent = StreetEasy UES/UWS 1BR median asking rents ($4,100 to $4,500, mid-2026)",
          setupCalc: "buyer attorney $3,500 + lender fees (application, appraisal, credit) $3,000 + lender attorney $1,250 + lien search, UCC-1 and recognition agreement $700 + board application and managing agent fees $1,000 = $9,450 = 1.36% of $695,000. Co-op share loans pay no mortgage recording tax and need no title insurance; fee levels (estimate, not sourced)",
          costCalc: "Owner: co-op maintenance 700 sq ft x $2.44/sq ft/mo (includes the building's property tax and underlying mortgage) $20,496 + contents and HO-6 insurance $400 + in-unit repairs $1,200 = $22,096/yr (used $22,100). AskDoss puts a 750 sq ft Manhattan co-op 1BR at $1,830/mo. Insurance and repairs (estimate, not sourced). Renter: renters insurance $250 = $250/yr. No broker fee: under the FARE Act landlords pay the broker they hire. Insurance (estimate, not sourced)"
        },
        "apt-2br": {
          propertyPrice: 1380000, rentAmount: 6000, houseGrowth: 2, setupCost: 1.76, ownOngoingCost: 34000, rentOngoingCost: 300, sqm: 100,
          where: "Manhattan co-op 2-bedroom (Upper East Side, Upper West Side, Gramercy, Chelsea). Price = Corcoran 3Q 2026 resale co-op 2BR median $1.375M; rent = StreetEasy Manhattan 2BR median asking rent $6,000 (July 2026)",
          setupCalc: "Mansion tax 1% $13,800 + buyer attorney $4,000 + lender fees (application, appraisal, credit) $3,500 + lender attorney $1,250 + lien search, UCC-1 and recognition agreement $700 + board application and managing agent fees $1,000 = $24,250 = 1.76% of $1,380,000. Mansion tax (buyer) 1% from $1M, 1.5% from $3M to $5M; other fee levels (estimate, not sourced). No mortgage recording tax or title insurance on a co-op share loan",
          costCalc: "Owner: co-op maintenance 1,075 sq ft x $2.44/sq ft/mo (includes the building's property tax and underlying mortgage) $31,476 + contents and HO-6 insurance $500 + in-unit repairs $2,000 = $33,976/yr (used $34,000). AskDoss puts a 1,100 sq ft Manhattan co-op 2BR at $2,684/mo. Insurance and repairs (estimate, not sourced). Renter: renters insurance $300 = $300/yr. No broker fee: under the FARE Act landlords pay the broker they hire. Insurance (estimate, not sourced)"
        },
        "apt-4br": {
          propertyPrice: 4000000, rentAmount: 15000, houseGrowth: 2, setupCost: 1.87, ownOngoingCost: 89000, rentOngoingCost: 500, sqm: 225, downPaymentPct: 30,
          where: "Luxury segment: prewar classic-8 co-ops on the Upper East Side, Upper West Side and Carnegie Hill. Price derived: Corcoran 3Q 2026 resale co-op 3+BR median $2.9M, a 2,500 sq ft 4BR at 64 E 86th St closed at $3.9M (Jan 2026), Zillow 4BR typical value in Manhattan $5.0M; rent derived from StreetEasy 3+BR median $8,000 and 4BR asking rents near $15,500 (estimate, not sourced)",
          setupCalc: "Mansion tax 1.5% $60,000 + buyer attorney $6,000 + lender fees (application, appraisal, credit) $5,000 + lender attorney $1,500 + lien search, UCC-1 and recognition agreement $700 + board application and managing agent fees $1,500 = $74,700 = 1.87% of $4,000,000. Mansion tax (buyer) 1% from $1M, 1.5% from $3M to $5M; other fee levels (estimate, not sourced). No mortgage recording tax or title insurance on a co-op share loan",
          costCalc: "Owner: co-op maintenance 2,400 sq ft x $2.83/sq ft/mo (includes the building's property tax and underlying mortgage) $81,504 + contents and HO-6 insurance $1,500 + in-unit repairs $6,000 = $89,004/yr (used $89,000). Rate = Miller Samuel Q2 2026 average for closed co-op sales ($2.83/sq ft/mo), which skews to larger units. Boards at this price usually want 30%+ down (estimate, not sourced). Insurance and repairs (estimate, not sourced). Renter: renters insurance $500 = $500/yr. No broker fee: under the FARE Act landlords pay the broker they hire. Insurance (estimate, not sourced)"
        },
        "house-2br": {
          propertyPrice: 570000, rentAmount: 2900, houseGrowth: 3.5, setupCost: 3.39, ownOngoingCost: 9900, rentOngoingCost: 250, sqm: 100, landSqm: 185, sellingCostPct: 7,
          where: "Fee-simple 2-bedroom townhouses and small detached homes on Staten Island (Great Kills, Eltingville, Bulls Head, Travis), about 20 to 25 km from Midtown, hence cheaper than a Manhattan 2BR co-op. Price: Zillow Aug 2026 2-bedroom typical value for Staten Island $544K, which includes cheaper condos, so $570K for a house (estimate, not sourced); rent: Zumper Oct 2026 Staten Island 2BR average $2,720, houses rent higher",
          setupCalc: "mortgage recording tax 1.8% of $456,000 loan $8,208 + owner's and lender's title insurance $3,300 + buyer attorney $3,000 + lender fees $2,500 + lender attorney $1,000 + recording, searches and survey $800 + inspection $500 = $19,308 = 3.39% of $570,000. NYC mortgage recording tax paid by the borrower: 1.8% on loans under $500k, 1.925% above (1-2 family). No mansion tax under $1M; transfer taxes are paid by the seller. Title and fee levels (estimate, not sourced)",
          costCalc: "Owner: property tax ~0.9% of value (Class 1 effective rate, estimate; FY2027 rate 20.909% on a capped 6% assessment) $5,130 + homeowners insurance $1,800 + maintenance ~1% of a $300,000 building value $3,000 = $9,930/yr (used $9,900). Water and sewer charges treated as a utility both pay. Insurance and upkeep (estimate, not sourced). Renter: renters insurance $250 = $250/yr. No tenant broker fee under the FARE Act. Insurance (estimate, not sourced)"
        },
        "house-4br": {
          propertyPrice: 950000, rentAmount: 4000, houseGrowth: 3.5, setupCost: 3.05, ownOngoingCost: 15600, rentOngoingCost: 300, sqm: 185, landSqm: 370, sellingCostPct: 7,
          where: "Detached and semi-detached 4-bedroom houses in eastern Queens (Bayside, Fresh Meadows, Middle Village) and Staten Island. Price: Zillow Aug 2026 4-bedroom typical value Queens $963K, Staten Island $919K; rent: Zumper Oct 2026 4BR average $3,950 in both boroughs",
          setupCalc: "mortgage recording tax 1.925% of $760,000 loan $14,630 + owner's and lender's title insurance $5,000 + buyer attorney $3,500 + lender fees $3,000 + lender attorney $1,000 + recording, searches and survey $1,200 + inspection $600 = $28,930 = 3.05% of $950,000. NYC mortgage recording tax paid by the borrower: 1.8% on loans under $500k, 1.925% above (1-2 family). No mansion tax under $1M; transfer taxes are paid by the seller. Title and fee levels (estimate, not sourced)",
          costCalc: "Owner: property tax ~0.9% of value (Class 1 effective rate, estimate; FY2027 rate 20.909% on a capped 6% assessment) $8,550 + homeowners insurance $2,500 + maintenance ~1% of a $450,000 building value $4,500 = $15,550/yr (used $15,600). Water and sewer charges treated as a utility both pay. Insurance and upkeep (estimate, not sourced). Renter: renters insurance $300 = $300/yr. No tenant broker fee under the FARE Act. Insurance (estimate, not sourced)"
        }
      },
      unavailable: {
        "house-studio": "Studio houses do not exist as a segment; New York City houses are 2-bedroom and larger, often two-family buildings.",
        "house-1br": "One-bedroom houses are a rarity; the city's row houses and detached homes are built with two or more bedrooms, and small homes trade as 2-family buildings."
      },
      notes: {
        market: "Most New Yorkers rent. Manhattan resale is mostly co-ops (about 1,900 co-op vs 1,266 condo resale closings in 3Q 2026, Corcoran), so apartments here are co-ops; houses are in the outer boroughs.",
        downPaymentPct: "20% avoids mortgage insurance on a conventional loan and is the usual co-op board minimum; luxury boards often want 30% or more (board norms (estimate, not sourced)).",
        mortgageRate: "Freddie Mac 30-year fixed averaged 7.28% on 1 Oct 2026, up from 6.66% in mid-August after the September Fed hike. 7.3% used, fixed for the whole term.",
        riskFreeRate: "3-month T-bills about 3.9% (late August 2026), top high-yield savings 4.2% to 4.3% (October 2026); Fed funds 3.75% to 4.00% after the September hike. 4.0% used.",
        sellingCostPct: "Broker about 5% (estimate, not sourced) plus NYC transfer tax 1% to 1.425% and NYS 0.4% paid by the seller, attorney, and often a co-op flip tax. 7.5% for co-ops, 7% for houses.",
        rentInflation: "Manhattan rents rose 6% to 7% in the year to mid-2026 (StreetEasy, Miller Samuel); 3% is a long-run assumption (estimate, not sourced).",
        houseGrowth: "Zillow ZHVI to Aug 2026: Manhattan 1-2BR values flat over 10 years, about 1%/yr over 20; outer-borough houses 2.5% to 3.5%/yr over 20 years. 2% co-ops, 3.5% houses.",
        setupCost: "Co-ops: no mortgage recording tax or title insurance; buyer pays mansion tax (1% from $1M, 1.5% from $3M) plus attorney, bank and board fees. Houses: recording tax 1.8% to 1.925% of loan.",
        ownOngoingCost: "Co-op maintenance covers the building's property tax and its underlying mortgage: $2.44 to $2.83/sq ft/month in Manhattan (AskDoss; Miller Samuel Q2 2026). Houses: tax ~0.9% of value.",
        rentOngoingCost: "Renters insurance only (estimate, not sourced). Since the FARE Act (June 2025, upheld on appeal July 2026) the landlord pays the broker it hires.",
        caveat: "Co-op boards can reject buyers, cap financing and bar subletting; part of maintenance is tax deductible. Rent-stabilised flats rent far below market and are not modelled."
      },
      sources: [
        { name: "Corcoran, Manhattan Real Estate Market Report 3Q 2026", url: "https://inhabit.corcoran.com/manhattan-real-estate-market-report-3q-2026/" },
        { name: "StreetEasy Data Dashboard via Milton Coste, Manhattan rents July 2026", url: "https://miltoncoste.com/rent/manhattan" },
        { name: "Brick Underground, Manhattan Q2 2026 sales report (Miller Samuel maintenance data)", url: "https://www.brickunderground.com/sell/manhattan-co-op-condo-sales-market-report-nyc-second-quarter-2026" },
        { name: "AskDoss, NYC co-op maintenance fees 2026", url: "https://askdoss.com/how-much-are-co-op-maintenance-fees-in-nyc-in-2026/" },
        { name: "Zillow Research ZHVI by bedroom, county level, Aug 2026", url: "https://files.zillowstatic.com/research/public_csvs/zhvi/County_zhvi_bdrmcnt_4_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv" },
        { name: "Zumper, Queens rent data Oct 2026", url: "https://www.zumper.com/rent-research/queens-ny" },
        { name: "Zumper, Staten Island rent data Oct 2026", url: "https://www.zumper.com/rent-research/staten-island-ny" },
        { name: "Freddie Mac PMMS via Mortgage News Daily", url: "https://www.mortgagenewsdaily.com/mortgage-rates/freddie-mac" },
        { name: "Rosenberg & Estis, NYC FY2027 property tax rates", url: "https://www.rosenbergestis.com/media/blog/nyc-property-tax/new-york-city-property-tax-levy-and-provisional-rates-for-fiscal-year-2027-final-rates-could-still-change" },
        { name: "The Real Deal, appeals court rejects REBNY FARE Act appeal (July 2026)", url: "https://therealdeal.com/new-york/2026/07/14/appeals-court-rejects-rebnys-fare-act-appeal/" }
      ]
    },
    {
      key: "chicago", city: "Chicago", country: "United States", countryId: "Amerika Serikat", countryCode: "US", region: "North America",
      aliases: ["US","USA","Illinois"],
      currencySymbol: "$", currencyCode: "USD", asOf: "2026-09",
      buyer: "US resident owner-occupier, first home, conventional 30-year fixed loan with 20% down, homeowner exemption claimed; no first-time buyer grants",
      downPaymentPct: 20, mortgageRate: 7.3, mortgageTerm: 30, riskFreeRate: 4, horizon: 30, sellingCostPct: 6,
      rentFreq: "monthly", rentInflation: 3, ownOngoingInflation: 3, rentOngoingInflation: 2.5,
      homes: {
        "apt-studio": {
          propertyPrice: 195000, rentAmount: 1600, houseGrowth: 1.5, setupCost: 3.16, ownOngoingCost: 7500, rentOngoingCost: 360, sqm: 46,
          where: "Condo studios in Lakeview, Gold Coast, Streeterville and South Loop high-rises. Price derived from Zillow's Aug 2026 1-bedroom values in those areas (about $290K for ~750 sq ft, ~$385/sq ft) times 500 sq ft (estimate, not sourced); rent from Zumper Oct 2026 studio averages (Lakeview $1,515, citywide $1,650, South Loop $2,126)",
          setupCalc: "Chicago transfer tax $3.75 per $500 (0.75%) $1,462 + lender's title policy and closing fee $1,500 + attorney $700 + lender fees $2,000 + recording $150 + inspection $350 = $6,162 = 3.16% of $195,000. Seller pays state, county and CTA transfer tax and the owner's title policy. Fee levels (estimate, not sourced)",
          costCalc: "Owner: HOA 500 sq ft x $0.65/sq ft/mo $3,900 + property tax ~1.9% of price less homeowner exemption (~$690) $3,015 + HO-6 insurance $300 + repairs $300 = $7,515/yr (used $7,500). HOA rate, insurance and repairs (estimate, not sourced). Gross yield near 10% is typical of Chicago condos: HOA dues (often including heat and amenities) and ~2% property tax absorb about 4% of the price a year. Renter: renters insurance $200 + move-in fee ~$400 over a 2.5-year tenancy $160 = $360/yr. Fee and insurance (estimate, not sourced)"
        },
        "apt-1br": {
          propertyPrice: 290000, rentAmount: 2250, houseGrowth: 1.5, setupCost: 2.58, ownOngoingCost: 11400, rentOngoingCost: 360, sqm: 70,
          where: "Condo 1-bedrooms in Lakeview, South Loop, River North and Streeterville. Price: Zillow Aug 2026 1BR typical values $261K to $317K; rent: Zumper Oct 2026 1BR averages Lakeview $2,195, South Loop $2,389 (River North $2,957 reflects new rental towers)",
          setupCalc: "Chicago transfer tax $3.75 per $500 (0.75%) $2,175 + lender's title policy and closing fee $1,800 + attorney $750 + lender fees $2,200 + recording $150 + inspection $400 = $7,475 = 2.58% of $290,000. Seller pays state, county and CTA transfer tax and the owner's title policy. Fee levels (estimate, not sourced)",
          costCalc: "Owner: HOA 750 sq ft x $0.65/sq ft/mo $5,850 + property tax ~1.9% of price less homeowner exemption (~$690) $4,820 + HO-6 insurance $350 + repairs $400 = $11,420/yr (used $11,400). HOA rate, insurance and repairs (estimate, not sourced). Gross yield above 9% reflects high HOA and tax costs (net about 5%). Renter: renters insurance $200 + move-in fee ~$400 over a 2.5-year tenancy $160 = $360/yr. Fee and insurance (estimate, not sourced)"
        },
        "apt-2br": {
          propertyPrice: 480000, rentAmount: 3200, houseGrowth: 1.5, setupCost: 2.02, ownOngoingCost: 18400, rentOngoingCost: 360, sqm: 107,
          where: "Condo 2-bedrooms in Lakeview, South Loop, River North and Streeterville. Price: Zillow Aug 2026 2BR typical values Lake View $510K, South Loop $427K, River North $501K; rent: Zumper Oct 2026 2BR averages Lakeview $3,095, South Loop $3,281",
          setupCalc: "Chicago transfer tax $3.75 per $500 (0.75%) $3,600 + lender's title policy and closing fee $2,200 + attorney $800 + lender fees $2,500 + recording $150 + inspection $450 = $9,700 = 2.02% of $480,000. Seller pays state, county and CTA transfer tax and the owner's title policy. Fee levels (estimate, not sourced)",
          costCalc: "Owner: HOA 1,150 sq ft x $0.65/sq ft/mo $8,970 + property tax ~1.9% of price less homeowner exemption (~$690) $8,430 + HO-6 insurance $450 + repairs $600 = $18,450/yr (used $18,400). HOA rate, insurance and repairs (estimate, not sourced). Renter: renters insurance $200 + move-in fee ~$400 over a 2.5-year tenancy $160 = $360/yr. Fee and insurance (estimate, not sourced)"
        },
        "house-2br": {
          propertyPrice: 320000, rentAmount: 2050, houseGrowth: 3, setupCost: 2.64, ownOngoingCost: 9000, rentOngoingCost: 360, sqm: 93, landSqm: 290,
          where: "Two-bedroom frame houses and small brick bungalows on the Northwest and Southwest Sides (Portage Park, Jefferson Park, Dunning, Garfield Ridge), 12 to 18 km from the Loop, so cheaper than a lakefront 2BR condo. Price: Zillow Aug 2026 2BR typical values $307K to $336K; rent: Zumper Oct 2026 Portage Park 2BR $1,695 and house average $2,500, so about $2,050 for a whole 2BR house (estimate, not sourced)",
          setupCalc: "Chicago transfer tax $3.75 per $500 (0.75%) $2,400 + lender's title policy and closing fee $1,900 + attorney $750 + lender fees $2,300 + recording $150 + survey $450 + inspection $500 = $8,450 = 2.64% of $320,000. Seller pays state, county and CTA transfer tax and the owner's title policy. Fee levels (estimate, not sourced)",
          costCalc: "Owner: property tax ~1.9% of price less homeowner exemption (~$690) $5,390 + homeowners insurance $1,600 + maintenance ~1% of a $200,000 building value $2,000 = $8,990/yr (used $9,000). Water and sewer treated as utilities. Insurance and upkeep (estimate, not sourced). Renter: renters insurance $200 + move-in fee ~$400 over a 2.5-year tenancy $160 = $360/yr. Fee and insurance (estimate, not sourced)"
        },
        "house-4br": {
          propertyPrice: 490000, rentAmount: 3300, houseGrowth: 3, setupCost: 2.11, ownOngoingCost: 13800, rentOngoingCost: 360, sqm: 177, landSqm: 350,
          where: "Four-bedroom bungalows and detached homes in Portage Park, Jefferson Park, Dunning and Beverly. Price: Zillow Aug 2026 4BR typical values $468K to $512K; rent: Zumper Oct 2026 4BR averages Portage Park $3,150, citywide $3,500",
          setupCalc: "Chicago transfer tax $3.75 per $500 (0.75%) $3,675 + lender's title policy and closing fee $2,250 + attorney $800 + lender fees $2,500 + recording $150 + survey $450 + inspection $500 = $10,325 = 2.11% of $490,000. Seller pays state, county and CTA transfer tax and the owner's title policy. Fee levels (estimate, not sourced)",
          costCalc: "Owner: property tax ~1.9% of price less homeowner exemption (~$690) $8,620 + homeowners insurance $2,200 + maintenance ~1% of a $300,000 building value $3,000 = $13,820/yr (used $13,800). Water and sewer treated as utilities. Insurance and upkeep (estimate, not sourced). Renter: renters insurance $200 + move-in fee ~$400 over a 2.5-year tenancy $160 = $360/yr. Fee and insurance (estimate, not sourced)"
        }
      },
      unavailable: {
        "apt-4br": "Four-bedroom condos are a thin luxury niche of Gold Coast and Streeterville penthouses; Chicago families wanting four bedrooms buy houses or two-flats.",
        "house-studio": "Studio houses do not exist as a segment; Chicago's house stock is bungalows, cottages and two-flats with two or more bedrooms.",
        "house-1br": "One-bedroom houses are a rarity; even the smallest Chicago workers' cottages and bungalows are built with two or more bedrooms."
      },
      notes: {
        market: "Downtown and lakefront condo towers plus bungalows, frame houses and two-flats in the neighbourhoods. Chicago condo values are about where they were 20 years ago (Zillow).",
        downPaymentPct: "20% avoids private mortgage insurance on a conventional loan; 3% to 5% down loans exist but add insurance.",
        mortgageRate: "Freddie Mac 30-year fixed averaged 7.28% on 1 Oct 2026, up from 6.66% in mid-August after the September Fed hike. 7.3% used, fixed for the whole term.",
        riskFreeRate: "3-month T-bills about 3.9% (late August 2026), top high-yield savings 4.2% to 4.3% (October 2026). 4.0% used.",
        sellingCostPct: "Commission about 5% (estimate, not sourced) plus seller transfer taxes (state 0.1%, county 0.05%, CTA 0.3%), owner's title policy and attorney: about 6%.",
        rentInflation: "Zumper shows Chicago rents up 7% in the year to October 2026; 3% is a long-run assumption (estimate, not sourced).",
        houseGrowth: "Zillow ZHVI to Aug 2026: Chicago condos +0.8%/yr over 10 years, about 0% over 20; single-family +5.4%/yr over 10 years, +1.5% over 20 from the 2006 peak. 1.5% condos, 3% houses.",
        setupCost: "Buyer pays Chicago transfer tax of $3.75 per $500 (0.75%); Bring Chicago Home failed in March 2024, rates unchanged (estimate, not sourced). Plus title, closing, attorney and lender fees.",
        ownOngoingCost: "Chicago tax rate about 6.87% (Cook County Clerk, 2025) on a 10% assessment times an equalizer near 3: ~1.9% of price (estimate, not sourced). Condo HOA ~$0.65/sq ft/mo (estimate, not sourced).",
        rentOngoingCost: "Renters insurance plus the non-refundable move-in fee many Chicago landlords charge, spread over a typical tenancy (estimate, not sourced).",
        caveat: "Cook County reassesses every 3 years and bills can jump; condo special assessments and the rent a two-flat owner earns from the second unit are not modelled."
      },
      sources: [
        { name: "Zillow Research ZHVI by bedroom, neighbourhood level, Aug 2026", url: "https://files.zillowstatic.com/research/public_csvs/zhvi/Neighborhood_zhvi_bdrmcnt_2_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv" },
        { name: "Zillow Research ZHVI condo and single-family, city level, Aug 2026", url: "https://files.zillowstatic.com/research/public_csvs/zhvi/City_zhvi_uc_condo_tier_0.33_0.67_sm_sa_month.csv" },
        { name: "Zumper, Chicago rent data Oct 2026", url: "https://www.zumper.com/rent-research/chicago-il" },
        { name: "Zumper, Lakeview rent data Oct 2026", url: "https://www.zumper.com/rent-research/chicago-il/lakeview" },
        { name: "Zumper, South Loop rent data Oct 2026", url: "https://www.zumper.com/rent-research/chicago-il/south-loop" },
        { name: "Zumper, Portage Park rent data Oct 2026", url: "https://www.zumper.com/rent-research/chicago-il/portage-park" },
        { name: "Cook County Clerk, 2025 tax code agency rates", url: "https://www.cookcountyclerkil.gov/sites/default/files/2026-09/2025-tax-code-agency-rates.xlsx" },
        { name: "Freddie Mac PMMS via Mortgage News Daily", url: "https://www.mortgagenewsdaily.com/mortgage-rates/freddie-mac" },
        { name: "SwitchWize savings rate watch, Oct 2026", url: "https://www.switchwize.com/whats-changed/savings-rate-watch/2026-10" }
      ]
    },
    {
      key: "toronto", city: "Toronto", country: "Canada", countryId: "Kanada", countryCode: "CA", region: "North America",
      aliases: ["Ontario","GTA"],
      currencySymbol: "$", currencyCode: "CAD", asOf: "2026-09",
      buyer: "Canadian resident owner-occupier, first home, 20% down so no CMHC insurance; Ontario and Toronto first-time buyer land transfer tax refunds ignored",
      downPaymentPct: 20, mortgageRate: 4.95, mortgageTerm: 30, riskFreeRate: 3, horizon: 30, sellingCostPct: 5,
      ratePeriods: [{ toYear: 5, type: "fixed", rate: 5.1 }, { toYear: 30, type: "floating", rateMin: 4.75, rateMax: 5.1 }],
      rentFreq: "monthly", rentInflation: 3, ownOngoingInflation: 2.5, rentOngoingInflation: 2,
      homes: {
        "apt-studio": {
          propertyPrice: 345000, rentAmount: 1890, houseGrowth: 3, setupCost: 2.93, ownOngoingCost: 7000, rentOngoingCost: 300, sqm: 37,
          where: "Bachelor condos in the Downtown Core (TRREB districts C01 and C08: Waterfront, King West, St Lawrence, Church-Wellesley). Price: TRREB Q2 2026 condo report, Downtown Core bachelor median about $345K (read from chart); rent: TRREB Q2 2026 bachelor leases C01 $1,934, C08 $1,829",
          setupCalc: "Ontario LTT $3,650 + Toronto MLTT (same schedule) $3,650 + legal and disbursements $2,000 + title insurance $350 + status certificate $100 + appraisal $350 = $10,100 = 2.93% of $345,000. LTT on $345,000: 0.5% to $55k, 1% to $250k, 1.5% to $400k, 2% to $2M, charged twice in Toronto; first-time buyer refunds ignored. Legal and other fees (estimate, not sourced)",
          costCalc: "Owner: condo fee 400 sq ft x $0.90/sq ft/mo $4,320 + property tax 0.767% x MPAC value (~75% of price) $1,985 + contents and unit insurance $300 + repairs $400 = $7,005/yr (used $7,000). Condo fee rate, MPAC ratio, insurance and repairs (estimate, not sourced). Renter: tenant insurance $300 = $300/yr. No tenant broker fee. Insurance (estimate, not sourced)"
        },
        "apt-1br": {
          propertyPrice: 510000, rentAmount: 2380, houseGrowth: 3, setupCost: 3.17, ownOngoingCost: 10300, rentOngoingCost: 300, sqm: 56,
          where: "One-bedroom (and 1+den) condos in the Downtown Core (C01, C08). Price: TRREB Q2 2026 Downtown Core medians about $470K (1BR) and $551K (1+den), weighted by sales; rent: TRREB Q2 2026 1BR leases C01 $2,475, C08 $2,269",
          setupCalc: "Ontario LTT $6,675 + Toronto MLTT (same schedule) $6,675 + legal and disbursements $2,000 + title insurance $350 + status certificate $100 + appraisal $350 = $16,150 = 3.17% of $510,000. LTT on $510,000: 0.5% to $55k, 1% to $250k, 1.5% to $400k, 2% to $2M, charged twice in Toronto; first-time buyer refunds ignored. Legal and other fees (estimate, not sourced)",
          costCalc: "Owner: condo fee 600 sq ft x $0.90/sq ft/mo $6,480 + property tax 0.767% x MPAC value (~75% of price) $2,935 + contents and unit insurance $350 + repairs $500 = $10,265/yr (used $10,300). Condo fee rate, MPAC ratio, insurance and repairs (estimate, not sourced). Renter: tenant insurance $300 = $300/yr. No tenant broker fee. Insurance (estimate, not sourced)"
        },
        "apt-2br": {
          propertyPrice: 760000, rentAmount: 3320, houseGrowth: 3, setupCost: 3.44, ownOngoingCost: 14600, rentOngoingCost: 300, sqm: 79,
          where: "Two-bedroom (and 2+den) condos in the Downtown Core (C01, C08). Price: TRREB Q2 2026 Downtown Core medians about $733K (2BR) and $829K (2+den), weighted by sales; rent: TRREB Q2 2026 2BR leases C01 $3,494, C08 $3,122",
          setupCalc: "Ontario LTT $11,675 + Toronto MLTT (same schedule) $11,675 + legal and disbursements $2,000 + title insurance $350 + status certificate $100 + appraisal $350 = $26,150 = 3.44% of $760,000. LTT on $760,000: 0.5% to $55k, 1% to $250k, 1.5% to $400k, 2% to $2M, charged twice in Toronto; first-time buyer refunds ignored. Legal and other fees (estimate, not sourced)",
          costCalc: "Owner: condo fee 850 sq ft x $0.90/sq ft/mo $9,180 + property tax 0.767% x MPAC value (~75% of price) $4,374 + contents and unit insurance $400 + repairs $600 = $14,554/yr (used $14,600). Condo fee rate, MPAC ratio, insurance and repairs (estimate, not sourced). Renter: tenant insurance $300 = $300/yr. No tenant broker fee. Insurance (estimate, not sourced)"
        },
        "house-2br": {
          propertyPrice: 1000000, rentAmount: 3200, houseGrowth: 3.5, setupCost: 3.65, ownOngoingCost: 11300, rentOngoingCost: 350, sqm: 100, landSqm: 200,
          where: "Two-bedroom semis, row houses and bungalows in older east-end and inner neighbourhoods (East York, Leslieville-Riverside, Danforth Village; TRREB E01 to E04). Price derived: TRREB Sept 2026 detached medians E03 $1.125M and E04 $848K, semi median City $1.09M; 2BR houses sit below these, about $1.0M (estimate, not sourced). Rent: TRREB Q2 2026 City 2BR townhouse leases $2,932, Zumper Oct 2026 house average $3,300",
          setupCalc: "Ontario LTT $16,475 + Toronto MLTT (same schedule) $16,475 + legal and disbursements $2,200 + title insurance $400 + home inspection $600 + appraisal $400 = $36,550 = 3.65% of $1,000,000. LTT on $1,000,000: 2% x price minus $3,525, charged twice in Toronto; first-time buyer refunds ignored. Legal and other fees (estimate, not sourced)",
          costCalc: "Owner: property tax 0.767% x MPAC value (~75% of price) $5,755 + home insurance $2,000 + maintenance ~1% of a $350,000 building value $3,500 = $11,255/yr (used $11,300). Water and solid waste treated as utilities. MPAC ratio, insurance and upkeep (estimate, not sourced). Renter: tenant insurance $350 = $350/yr. No tenant broker fee. Insurance (estimate, not sourced)"
        },
        "house-4br": {
          propertyPrice: 1300000, rentAmount: 4500, houseGrowth: 3.5, setupCost: 3.73, ownOngoingCost: 15000, rentOngoingCost: 350, sqm: 190, landSqm: 465,
          where: "Four-bedroom detached houses in Scarborough, North York and Etobicoke suburbs (e.g. Agincourt, Don Valley Village, Islington). Price: TRREB Sept 2026 City detached median $1.2M, HPI detached benchmark $1.418M, C15 and W08 medians $1.28M; 4BR taken at $1.3M (estimate, not sourced). Rent: Zumper Oct 2026 Toronto 4BR average $4,500",
          setupCalc: "Ontario LTT $22,475 + Toronto MLTT (same schedule) $22,475 + legal and disbursements $2,200 + title insurance $400 + home inspection $600 + appraisal $400 = $48,550 = 3.73% of $1,300,000. LTT on $1,300,000: 2% x price minus $3,525, charged twice in Toronto; first-time buyer refunds ignored. Legal and other fees (estimate, not sourced)",
          costCalc: "Owner: property tax 0.767% x MPAC value (~75% of price) $7,481 + home insurance $2,500 + maintenance ~1% of a $500,000 building value $5,000 = $14,981/yr (used $15,000). Water and solid waste treated as utilities. MPAC ratio, insurance and upkeep (estimate, not sourced). Renter: tenant insurance $350 = $350/yr. No tenant broker fee. Insurance (estimate, not sourced)"
        }
      },
      unavailable: {
        "apt-4br": "Four-bedroom condos are virtually absent: TRREB's Q2 2026 condo report tops out at three bedrooms (about 5% of downtown sales), and larger families buy houses.",
        "house-studio": "Studio houses do not exist as a segment; Toronto's freehold stock is semis, row houses and detached homes with two or more bedrooms.",
        "house-1br": "One-bedroom houses are a rarity; even the smallest Toronto bungalows and worker cottages have two bedrooms."
      },
      notes: {
        market: "Downtown condo towers plus older freehold semis and detached houses. Condo prices are down 6.4% in a year (TRREB HPI, Sept 2026) amid heavy supply; detached down 4.5%.",
        downPaymentPct: "20% is the minimum to avoid CMHC insurance premiums (minimum down is 5% on the first $500k and 10% above, up to $1.5M).",
        mortgageRate: "5-year fixed, 20% down, 30-year amortisation: about 5.1% (nesto 5.09%, big-6 5.12%, Oct 2026). It renews every 5 years, between the 4.75% long-run view and 5.1%.",
        riskFreeRate: "3-month T-bill 2.41% (7 Oct 2026), ongoing high-interest savings about 2.75%, 1-year GICs up to about 3.6%. Bank of Canada at 2.25%. 3.0% used.",
        sellingCostPct: "Commission about 4% to 4.5% plus 13% HST, plus legal and mortgage discharge fees: about 5% (estimate, not sourced).",
        rentInflation: "Condo rents fell about 2% in the year to Q2 2026 (TRREB) after a 2023 peak; 3% is a long-run assumption (estimate, not sourced).",
        houseGrowth: "TRREB MLS HPI (2005 = 100) Sept 2026: City apartments 263.5, detached 298.4, about 4.6% and 5.2%/yr since 2005 but down since 2022. 3% condos, 3.5% houses.",
        setupCost: "Ontario land transfer tax plus Toronto's municipal LTT on the same schedule (0.5% to 2% up to $2M), so the tax is roughly doubled; first-time refunds ignored. Plus legal and title fees.",
        ownOngoingCost: "2026 residential tax rate 0.767% of MPAC value, which still reflects 2016 prices (taken as 75% of price (estimate, not sourced)). Condo fees about $0.90/sq ft/month (estimate, not sourced).",
        rentOngoingCost: "Tenant insurance only (estimate, not sourced); listing commissions are paid by landlords and there are no recurring tenant fees.",
        caveat: "Renewal rates every 5 years are a range, not a forecast. Mortgage interest is not tax deductible; a principal-residence gain is tax free. Rent control covers pre-2018 units only."
      },
      sources: [
        { name: "TRREB Market Watch, September 2026", url: "https://trreb.ca/wp-content/files/market-stats/market-watch/mw2609.pdf" },
        { name: "TRREB Condo Market Report, Q2 2026", url: "https://trreb.ca/wp-content/files/market-stats/condo-reports/condo_report_Q2-2026.pdf" },
        { name: "TRREB Rental Market Report, Q2 2026", url: "https://trreb.ca/wp-content/files/market-stats/rental-reports/rental_report_Q2-2026.pdf" },
        { name: "City of Toronto, 2026 property tax rates", url: "https://www.toronto.ca/services-payments/property-taxes-utilities/property-tax/property-tax-rates-and-fees/" },
        { name: "City of Toronto, MLTT rates", url: "https://www.toronto.ca/services-payments/property-taxes-utilities/municipal-land-transfer-tax-mltt/municipal-land-transfer-tax-mltt-rates-and-fees/" },
        { name: "Ontario, calculating land transfer tax", url: "https://www.ontario.ca/document/land-transfer-tax/calculating-land-transfer-tax" },
        { name: "nesto, 5-year fixed mortgage rates Oct 2026", url: "https://www.nesto.ca/mortgage-rates/fixed/5-year/?region=on" },
        { name: "Trading Economics, Canada 3-month bill yield", url: "https://tradingeconomics.com/canada/3-month-bill-yield" },
        { name: "Zumper, Toronto rent data Oct 2026", url: "https://www.zumper.com/rent-research/toronto-on" }
      ]
    },
    {
      key: "vancouver", city: "Vancouver", country: "Canada", countryId: "Kanada", countryCode: "CA", region: "North America",
      aliases: ["BC","British Columbia"],
      currencySymbol: "$", currencyCode: "CAD", asOf: "2026-09",
      buyer: "Canadian resident owner-occupier, first home, 20% down so no CMHC insurance; BC first-time buyer property transfer tax exemption ignored; home owner grant claimed",
      downPaymentPct: 20, mortgageRate: 4.95, mortgageTerm: 30, riskFreeRate: 3, horizon: 30, sellingCostPct: 3.5,
      ratePeriods: [{ toYear: 5, type: "fixed", rate: 5.1 }, { toYear: 30, type: "floating", rateMin: 4.75, rateMax: 5.1 }],
      rentFreq: "monthly", rentInflation: 3, ownOngoingInflation: 2.5, rentOngoingInflation: 2,
      homes: {
        "apt-studio": {
          propertyPrice: 450000, rentAmount: 2035, houseGrowth: 3, setupCost: 2.16, ownOngoingCost: 4700, rentOngoingCost: 300, sqm: 40,
          where: "Studio condos in Downtown, the West End, Fairview and Mount Pleasant. Price derived: GVR Sept 2026 median apartment sale price Vancouver West $799K, East $669K; split by size at about $1,050/sq ft (estimate, not sourced) x 430 sq ft. Rent: Zumper Oct 2026 Vancouver studio average $2,035",
          setupCalc: "BC PTT $7,000 + legal or notary $1,800 + title insurance $250 + strata documents $300 + appraisal $350 = $9,700 = 2.16% of $450,000. PTT on $450,000: 1% of first $200k + 2% of the rest; first-time buyer exemption ignored. Legal and other fees (estimate, not sourced)",
          costCalc: "Owner: strata fee 430 sq ft x $0.60/sq ft/mo $3,096 + property tax ~0.31% of assessed value less $570 home owner grant $825 + contents and unit insurance $350 + repairs $400 = $4,671/yr (used $4,700). Strata rate, tax rate, insurance and repairs (estimate, not sourced). Renter: tenant insurance $300 = $300/yr. No tenant broker fee. Insurance (estimate, not sourced)"
        },
        "apt-1br": {
          propertyPrice: 650000, rentAmount: 2400, houseGrowth: 3, setupCost: 2.11, ownOngoingCost: 6800, rentOngoingCost: 300, sqm: 58,
          where: "One-bedroom condos in Downtown, the West End, Fairview and Mount Pleasant. Price derived from GVR Sept 2026 apartment medians (West $799K, East $669K) at about $1,050/sq ft (estimate, not sourced) x 620 sq ft. Rent: Zumper Oct 2026 1BR average $2,400",
          setupCalc: "BC PTT $11,000 + legal or notary $1,800 + title insurance $250 + strata documents $300 + appraisal $350 = $13,700 = 2.11% of $650,000. PTT on $650,000: 1% of first $200k + 2% of the rest; first-time buyer exemption ignored. Legal and other fees (estimate, not sourced)",
          costCalc: "Owner: strata fee 620 sq ft x $0.60/sq ft/mo $4,464 + property tax ~0.31% of assessed value less $570 home owner grant $1,445 + contents and unit insurance $400 + repairs $500 = $6,809/yr (used $6,800). Strata rate, tax rate, insurance and repairs (estimate, not sourced). Renter: tenant insurance $300 = $300/yr. No tenant broker fee. Insurance (estimate, not sourced)"
        },
        "apt-2br": {
          propertyPrice: 950000, rentAmount: 3300, houseGrowth: 3, setupCost: 2.07, ownOngoingCost: 9900, rentOngoingCost: 300, sqm: 84,
          where: "Two-bedroom condos in Downtown, Yaletown, Fairview and Kitsilano. Price derived from GVR Sept 2026 apartment medians (West $799K) at about $1,050/sq ft (estimate, not sourced) x 900 sq ft. Rent: Zumper Oct 2026 2BR average $3,300",
          setupCalc: "BC PTT $17,000 + legal or notary $1,800 + title insurance $250 + strata documents $300 + appraisal $350 = $19,700 = 2.07% of $950,000. PTT on $950,000: 1% of first $200k + 2% of the rest; first-time buyer exemption ignored. Legal and other fees (estimate, not sourced)",
          costCalc: "Owner: strata fee 900 sq ft x $0.60/sq ft/mo $6,480 + property tax ~0.31% of assessed value less $570 home owner grant $2,375 + contents and unit insurance $450 + repairs $600 = $9,905/yr (used $9,900). Strata rate, tax rate, insurance and repairs (estimate, not sourced). Renter: tenant insurance $300 = $300/yr. No tenant broker fee. Insurance (estimate, not sourced)"
        },
        "house-4br": {
          propertyPrice: 1650000, rentAmount: 5000, houseGrowth: 3.5, setupCost: 2.08, ownOngoingCost: 11500, rentOngoingCost: 350, sqm: 200, landSqm: 375,
          where: "Four-bedroom detached houses on 33-ft lots in East Vancouver (Renfrew-Collingwood, Killarney, Hastings-Sunrise, Kensington-Cedar Cottage). Price: GVR Sept 2026 Vancouver East detached median $1.65M (benchmark $1.63M). Rent: Zumper Oct 2026 Vancouver 4BR average $5,840 is skewed by the West Side, so $5,000 for a whole East Side house (estimate, not sourced)",
          setupCalc: "BC PTT $31,000 + legal or notary $2,000 + title insurance $300 + home inspection $600 + appraisal $400 = $34,300 = 2.08% of $1,650,000. PTT on $1,650,000: 1% of first $200k + 2% of the rest; first-time buyer exemption ignored. Legal and other fees (estimate, not sourced)",
          costCalc: "Owner: property tax ~0.31% of assessed value less $570 home owner grant $4,545 + home insurance $2,500 + maintenance ~1% of a $450,000 building value $4,500 = $11,545/yr (used $11,500). Water, sewer and garbage treated as utilities. Tax rate, insurance and upkeep (estimate, not sourced). Renter: tenant insurance $350 = $350/yr. No tenant broker fee. Insurance (estimate, not sourced)"
        }
      },
      unavailable: {
        "apt-4br": "Four-bedroom condos are virtually absent in Vancouver towers, where units top out at two or three bedrooms; families needing four bedrooms buy houses.",
        "house-studio": "Studio houses do not exist as a segment; land costs mean every detached lot carries a large multi-bedroom house.",
        "house-1br": "One-bedroom houses are a rarity; Vancouver's detached stock is large houses on 33-ft lots, often with suites.",
        "house-2br": "Two-bedroom landed houses are rare: land value makes almost every detached lot a large multi-suite house, and smaller ground-level homes are strata townhouses without land title."
      },
      notes: {
        market: "Condo towers plus detached houses on very expensive land. GVR Sept 2026: apartment benchmark $682,500 (-6.2% in a year), detached $1.78M (-7.3%), across Metro Vancouver.",
        downPaymentPct: "20% is the minimum to avoid CMHC insurance premiums (minimum down is 5% on the first $500k and 10% above, up to $1.5M; 20% required above that).",
        mortgageRate: "5-year fixed, 20% down, 30-year amortisation: about 5.1% (nesto 5.09%, big-6 5.12%, Oct 2026). It renews every 5 years, between the 4.75% long-run view and 5.1%.",
        riskFreeRate: "3-month T-bill 2.41% (7 Oct 2026), ongoing high-interest savings about 2.75%, 1-year GICs up to about 3.6%. Bank of Canada at 2.25%. 3.0% used.",
        sellingCostPct: "Commission often 7% on the first $100k plus 2.5% to 3% on the rest, plus 5% GST and legal fees: about 3.5% (estimate, not sourced).",
        rentInflation: "Asking rents are down about 4% in a year (Zumper, Oct 2026) after the 2023 peak; 3% is a long-run assumption (estimate, not sourced).",
        houseGrowth: "GVR MLS HPI 10-year change to Sept 2026: West apartments +21.8%, East apartments +32.6%, East detached +8.8%; about 5% to 6%/yr since 2005. 3% apartments, 3.5% houses.",
        setupCost: "BC Property Transfer Tax: 1% on the first $200k, 2% to $2M, 3% to $3M, plus 2% above $3M; first-time buyer exemption ignored. Plus legal or notary, title and strata document fees.",
        ownOngoingCost: "Property tax ~0.31% of assessed value less the $570 home owner grant (estimate, not sourced); strata ~$0.60/sq ft/month (estimate, not sourced). Empty homes tax does not apply to owners.",
        rentOngoingCost: "Tenant insurance only (estimate, not sourced); there are no tenant broker fees and BC caps yearly rent increases for sitting tenants.",
        caveat: "Renewal rates every 5 years are a range, not a forecast. Many houses carry a rented basement suite, which the calculator does not model; strata special levies can be large."
      },
      sources: [
        { name: "Greater Vancouver Realtors, stats package September 2026", url: "https://members.gvrealtors.ca/news/GVR-Stats-Package-September-2026.pdf" },
        { name: "CREA board statistics, Greater Vancouver", url: "https://creastats.crea.ca/board/vanc" },
        { name: "Government of BC, property transfer tax", url: "https://www2.gov.bc.ca/gov/content/taxes/property-taxes/property-transfer-tax" },
        { name: "Zumper, Vancouver rent data Oct 2026", url: "https://www.zumper.com/rent-research/vancouver-bc" },
        { name: "nesto, 5-year fixed mortgage rates Oct 2026", url: "https://www.nesto.ca/mortgage-rates/fixed/5-year/?region=on" },
        { name: "Trading Economics, Canada 3-month bill yield", url: "https://tradingeconomics.com/canada/3-month-bill-yield" }
      ]
    }
  ]
};

/* ── RESOLVER ─────────────────────────────────────────────────────────────────
   The one way every page reads the data above, so a scenario loads the same
   form on all of them. A scenario id is "<city key>/<type key>"; a bare city
   key means that city's default home (a 2-bedroom apartment where there is
   one, else its first home).
   ────────────────────────────────────────────────────────────────────────── */
window.RVO_QS = (function(D){
  'use strict';
  // Every form value a scenario sets, in the order the calculator writes them.
  var FIELDS = ['currencySymbol', 'propertyPrice', 'downPaymentPct', 'mortgageRate', 'mortgageTerm',
    'houseGrowth', 'sellingCostPct', 'setupCost', 'setupCostType', 'ownOngoingCost', 'ownOngoingCostFreq',
    'ownOngoingCostType', 'ownOngoingInflation', 'rentAmount', 'rentFreq', 'rentInflation', 'rentOngoingCost',
    'rentOngoingCostFreq', 'rentOngoingCostType', 'rentOngoingInflation', 'riskFreeRate', 'horizon',
    'monthlyBudget', 'monthlyBudgetIncrease', 'mortgageType', 'costInterestOnly', 'rtbEnabled', 'rtbBuyYear',
    'initialCash'];
  var cityBy = {}, typeBy = {};
  D.cities.forEach(function(c){ cityBy[c.key] = c; });
  D.types.forEach(function(t){ typeBy[t.key] = t; });

  function city(k){ return Object.prototype.hasOwnProperty.call(cityBy, k) ? cityBy[k] : null; }
  function type(k){ return Object.prototype.hasOwnProperty.call(typeBy, k) ? typeBy[k] : null; }
  // The home types a city has, in picker order.
  function homes(k){
    var c = city(k);
    return c ? D.types.filter(function(t){ return c.homes && c.homes[t.key]; }).map(function(t){ return t.key; }) : [];
  }
  function defaultType(k){
    var h = homes(k);
    return h.indexOf('apt-2br') >= 0 ? 'apt-2br' : (h[0] || null);
  }
  function id(cityKey, typeKey){ return cityKey + '/' + typeKey; }
  function split(sid){
    var s = String(sid || ''), i = s.indexOf('/');
    return i < 0 ? { city: s, type: defaultType(s) } : { city: s.slice(0, i), type: s.slice(i + 1) };
  }
  function lang(l){ return l === 'id' ? 'id' : 'en'; }
  function typeText(typeKey, part, l){
    var t = type(typeKey);
    return t ? t[part][lang(l)] : typeKey;
  }
  function formText(form, l){ return D.forms[form] ? D.forms[form][lang(l)] : form; }
  function countryText(c, l){ return lang(l) === 'id' && c.countryId ? c.countryId : c.country; }
  // A scenario's form values, or null for a home the city does not have.
  function preset(sid){
    var s = split(sid), c = city(s.city);
    var h = c && c.homes ? c.homes[s.type] : null;
    if(!h) return null;
    var out = {};
    FIELDS.forEach(function(f){
      out[f] = h[f] !== undefined ? h[f] : (c[f] !== undefined ? c[f] : D.defaults[f]);
    });
    // A staged loan opens in Detailed mode, on its own copy of the schedule
    // (a page edits the periods in place), each period carrying every field
    // the rate rows show: a fixed one its rate as its range, a floating one
    // its middle as its rate.
    var rp = h.ratePeriods || c.ratePeriods || null;
    out.mortgageMode = rp ? 'detailed' : 'simple';
    out.ratePeriods = rp ? rp.map(function(p){
      var fixed = p.type !== 'floating';
      return { toYear: p.toYear, type: fixed ? 'fixed' : 'floating',
        rate: fixed ? p.rate : (p.rateMin + p.rateMax) / 2,
        rateMin: fixed ? p.rate : p.rateMin, rateMax: fixed ? p.rate : p.rateMax };
    }) : null;
    out.id = id(c.key, s.type);
    out.cityKey = c.key;
    out.typeKey = s.type;
    return out;
  }
  // "Perth · 2BR apartment": a scenario's name where a short one is needed.
  function label(sid, l){
    var s = split(sid), c = city(s.city);
    return c ? c.city + ' · ' + typeText(s.type, 'short', l) : String(sid);
  }
  // Search as the Cost of Living Comparator's city picker does: every word
  // typed must appear somewhere in the city, its country or its currency,
  // accents ignored, so "zurich" finds Zürich and "uae" finds Dubai.
  function fold(s){
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function terms(q){ return fold(q).split(/[\s,]+/).filter(Boolean); }
  function hay(c){
    return fold([c.city, c.country, c.countryId, c.countryCode, c.currencyCode, c.region]
      .concat(c.aliases || []).join(' '));
  }
  function cityMatches(c, q){
    var h = hay(c);
    return terms(q).every(function(t){ return h.indexOf(t) >= 0; });
  }
  // A city and one of its homes, for a list that offers both at once.
  function homeMatches(c, typeKey, q, l){
    var t = type(typeKey);
    var h = hay(c) + ' ' + fold([t.name.en, t.name[lang(l)], t.short.en, t.short[lang(l)], formText(t.form, 'en'),
      formText(t.form, l), t.form === 'house' ? 'villa townhouse' : 'flat condo unit'].join(' '));
    return terms(q).every(function(x){ return h.indexOf(x) >= 0; });
  }
  // Every scenario id, city by city.
  function all(){
    var out = [];
    D.cities.forEach(function(c){ homes(c.key).forEach(function(t){ out.push(id(c.key, t)); }); });
    return out;
  }
  // Cities in A to Z order, for a picker.
  function sortedCities(l){
    return D.cities.slice().sort(function(a, b){ return a.city.localeCompare(b.city, lang(l)); });
  }
  return {
    data: D, FIELDS: FIELDS, city: city, type: type, homes: homes, defaultType: defaultType,
    id: id, split: split, preset: preset, label: label, typeText: typeText, formText: formText,
    countryText: countryText, cityMatches: cityMatches, homeMatches: homeMatches, all: all,
    sortedCities: sortedCities
  };
})(window.RVO_QUICKSTART);
