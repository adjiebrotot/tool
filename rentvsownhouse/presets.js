/* ── CITY PRESETS ──
   Rent vs Own Quick Start cities.
   One list for both pages: the main calculator's Quick Start row and the
   Sensitivity tool's first-column picker read it, so a city loads the same
   inputs on either page. `label` is the name the city is shown under.

   Values sourced from: REIWA (Perth), Urban Property Australia (Melbourne), Domain/CoreLogic (Sydney), Databoks/BI (Jakarta)
   Property prices: median 2BR apartment, city centre or inner suburbs, 2024–2025.
   Perth stamp duty: WA general rate ($360k–$725k bracket). Melbourne stamp duty: VIC general rate.
   Sydney stamp duty: NSW general rate ($372k–$1.24M bracket). Jakarta setup: BPHTB 5% + PPAT/notary ~1% + bank/admin fees. Mortgage: typical KPR floating rate.
*/
window.RVO_CITY_PRESETS = {
  perth: {
    label: 'Perth, AU',
    // Perth, WA: ~$750k for 2BR in city centre/inner suburbs (Subiaco, East Perth, Northbridge, West Perth, Mt Lawley)
    // WA stamp duty on $750k (>$725k bracket): $28,453 + 5.15%×$25k = $29,741 + legal ~$2,500 + misc ~$260 = ~$32,500
    // Mortgage: Big-4 owner-occ P&I variable ~6.1% (CBA 6.09%). Rent: $700/week inner Perth (REIWA 2025). RPPI: 20-yr unit CAGR ~4.5%.
    currencySymbol: '$',
    propertyPrice: 750000,
    downPaymentPct: 20,
    mortgageRate: 6.1,
    mortgageTerm: 30,
    houseGrowth: 4.5,
    sellingCostPct: 2.5, // selling: agent ~2.0% + marketing/legal ~0.5% (REIWA typical)
    setupCost: 4.33, // % of price (≈ 32500 at the preset price)
    setupCostType: 'pct',
    ownOngoingCost: 8500,
    ownOngoingCostFreq: 'yearly',
    ownOngoingCostType: 'dollar',
    ownOngoingInflation: 2.5,
    rentAmount: 700,
    rentFreq: 'weekly',
    rentInflation: 3.5,
    rentOngoingCost: 1500,
    rentOngoingCostFreq: 'yearly',
    rentOngoingCostType: 'dollar',
    rentOngoingInflation: 2.5,
    riskFreeRate: 4.5,
    horizon: 30,
    monthlyBudget: 0,
    monthlyBudgetIncrease: 0,
    mortgageType: 'pi',
    costInterestOnly: true,
    rtbEnabled: false,
    rtbBuyYear: 5,
    initialCash: 0,
  },
  melbourne: {
    label: 'Melbourne, AU',
    // Melbourne, VIC: ~$800k for 2BR in city centre/inner suburbs (Richmond, Fitzroy, South Yarra, Carlton, Prahran)
    // VIC stamp duty on $800k (general rate): $2,870 + 6%×$670k = $43,070 + legal ~$2,500 = ~$45,500 (PPR concession doesn't apply >$550k)
    // Mortgage: Big-4 owner-occ P&I variable ~6.1%. Rent: $620/week inner Melbourne (Urban Property Australia Q1 2025). RPPI: 10-yr unit CAGR ~3%.
    currencySymbol: '$',
    propertyPrice: 800000,
    downPaymentPct: 20,
    mortgageRate: 6.1,
    mortgageTerm: 30,
    houseGrowth: 3.0,
    sellingCostPct: 2.5, // selling: agent ~2.0% + marketing/legal ~0.5%
    setupCost: 5.69, // % of price (≈ 45500 at the preset price)
    setupCostType: 'pct',
    ownOngoingCost: 9500,
    ownOngoingCostFreq: 'yearly',
    ownOngoingCostType: 'dollar',
    ownOngoingInflation: 2.5,
    rentAmount: 620,
    rentFreq: 'weekly',
    rentInflation: 3.0,
    rentOngoingCost: 1500,
    rentOngoingCostFreq: 'yearly',
    rentOngoingCostType: 'dollar',
    rentOngoingInflation: 2.5,
    riskFreeRate: 4.5,
    horizon: 30,
    monthlyBudget: 0,
    monthlyBudgetIncrease: 0,
    mortgageType: 'pi',
    costInterestOnly: true,
    rtbEnabled: false,
    rtbBuyYear: 5,
    initialCash: 0,
  },
  sydney: {
    label: 'Sydney, AU',
    // Sydney, NSW: ~$1.05M for 2BR in city centre/inner suburbs (Surry Hills, Pyrmont, Newtown, Glebe, Redfern)
    // NSW transfer duty on $1.05M ($372k–$1.24M bracket): $11,152 + 4.5%×$678k = $41,662 + legal ~$2,500 = ~$44,200
    // Mortgage: Big-4 owner-occ P&I variable ~6.1%. Rent: $750/week inner Sydney (Domain 2025). RPPI: 20-yr unit CAGR ~3.5% (units ~doubled over 20 yrs).
    currencySymbol: '$',
    propertyPrice: 1050000,
    downPaymentPct: 20,
    mortgageRate: 6.1,
    mortgageTerm: 30,
    houseGrowth: 3.5,
    sellingCostPct: 2.5, // selling: agent ~2.0% + marketing/legal ~0.5%
    setupCost: 4.21, // % of price (≈ 44200 at the preset price)
    setupCostType: 'pct',
    ownOngoingCost: 11000,
    ownOngoingCostFreq: 'yearly',
    ownOngoingCostType: 'dollar',
    ownOngoingInflation: 2.5,
    rentAmount: 750,
    rentFreq: 'weekly',
    rentInflation: 3.5,
    rentOngoingCost: 1500,
    rentOngoingCostFreq: 'yearly',
    rentOngoingCostType: 'dollar',
    rentOngoingInflation: 2.5,
    riskFreeRate: 4.5,
    horizon: 30,
    monthlyBudget: 0,
    monthlyBudgetIncrease: 0,
    mortgageType: 'pi',
    costInterestOnly: true,
    rtbEnabled: false,
    rtbBuyYear: 5,
    initialCash: 0,
  },
  singapore: {
    label: 'Singapore',
    // Singapore: ~S$1.8M for 2BR private condo in RCR/inner suburb (iqrate.io Q1 2025: RCR median ~S$1,896 PSF; Bamboo Routes 2BR avg)
    // BSD on S$1.8M: 1%×180k+2%×180k+3%×640k+4%×500k+5%×300k = S$59,600 + legal ~S$4,000 + valuation ~S$1,400 = S$65,000
    // Mortgage: 2.5% blended (current 2-yr fixed ~1.75% from DBS/OCBC/UOB, resets to floating; SORA-based long-run avg ~2.5%). MAS LTV max 75% → 25% down.
    // ABSD: 0% for Singapore Citizens buying first property (IRAS 2025). Rent: S$5,000/mo (RCR/inner 2BR; Rentify.sg 2025: S$4,500–5,500). RPPI: 4.5% conservative (20-yr CAGR ~6.4%, EdgeProp). RFR: 3.5% (SSB/T-bills).
    currencySymbol: '$',
    propertyPrice: 1800000,
    downPaymentPct: 25,
    mortgageRate: 2.5,
    mortgageTerm: 30,
    houseGrowth: 4.5,
    sellingCostPct: 2.0, // selling: agent ~1.5–2% (CEA norm) + legal ~0.3%; no SSD after the holding period
    setupCost: 3.61, // % of price (≈ 65000 at the preset price)
    setupCostType: 'pct',
    ownOngoingCost: 7000,
    ownOngoingCostFreq: 'yearly',
    ownOngoingCostType: 'dollar',
    ownOngoingInflation: 3.0,
    rentAmount: 5000,
    rentFreq: 'monthly',
    rentInflation: 3.0,
    rentOngoingCost: 1500,
    rentOngoingCostFreq: 'yearly',
    rentOngoingCostType: 'dollar',
    rentOngoingInflation: 2.5,
    riskFreeRate: 3.5,
    horizon: 30,
    monthlyBudget: 0,
    monthlyBudgetIncrease: 0,
    mortgageType: 'pi',
    costInterestOnly: true,
    rtbEnabled: false,
    rtbBuyYear: 5,
    initialCash: 0,
  },
  kualalumpur: {
    label: 'Kuala Lumpur, MY',
    // Kuala Lumpur: ~RM 1.0M for 2BR condo in Mont Kiara/Bangsar/KLCC inner suburb (Bamboo Routes 2026: RM 900k–1.3M for prime areas)
    // MOT stamp duty on RM 1.0M: 1%×100k+2%×400k+3%×500k = RM 24,000 + loan agreement stamp duty (0.5%×900k) RM 4,500 + legal ~RM 11,500 = RM 40,000
    // Mortgage: 4.3% (OPR 2.75% cut Jul 2025; SBR 2.75% + spread ~1.55%; Maybank 4.25–4.40%, CIMB 4.30–4.35%, PropCashflow 2026). Max LTV 90% → 10% down.
    // Rent: RM 4,000/mo (Mont Kiara/Bangsar 2BR; Bamboo Routes KL 2026: RM 3,800–4,500). RPPI: 3.0% (EdgeProp.my 20-yr data; post-2015 oversupply). RFR: 3.5% (MY FD/ASB).
    currencySymbol: 'RM',
    propertyPrice: 1000000,
    downPaymentPct: 10,
    mortgageRate: 4.3,
    mortgageTerm: 30,
    houseGrowth: 3.0,
    sellingCostPct: 3.0, // selling: agent up to 3% (BOVAEA cap) + legal; RPGT nil for citizens after 5 years
    setupCost: 4.0, // % of price (≈ 40000 at the preset price)
    setupCostType: 'pct',
    ownOngoingCost: 8000,
    ownOngoingCostFreq: 'yearly',
    ownOngoingCostType: 'dollar',
    ownOngoingInflation: 3.0,
    rentAmount: 4000,
    rentFreq: 'monthly',
    rentInflation: 3.0,
    rentOngoingCost: 1500,
    rentOngoingCostFreq: 'yearly',
    rentOngoingCostType: 'dollar',
    rentOngoingInflation: 2.5,
    riskFreeRate: 3.5,
    horizon: 30,
    monthlyBudget: 0,
    monthlyBudgetIncrease: 0,
    mortgageType: 'pi',
    costInterestOnly: true,
    rtbEnabled: false,
    rtbBuyYear: 5,
    initialCash: 0,
  },
  jakarta: {
    label: 'Jakarta, ID',
    // Jakarta, ID: ~Rp 2B median 2BR inner suburb/central; setup: BPHTB 5%×(2B-80M) ≈ Rp 96M + PPAT/notary Rp 18M + fees Rp 6M = Rp 120M
    // KPR rate: avg SBDK major banks ~9.25–9.5% (Databoks May 2025; BCA 9.37%, BNI 9.10%). Term: 20yr typical. Rent: ~Rp 10M/mo. RFR: IDR time deposit ~5% (BI rate 4.75%).
    currencySymbol: 'Rp',
    propertyPrice: 2000000000,
    downPaymentPct: 20,
    mortgageRate: 9.5,
    mortgageTerm: 20,
    houseGrowth: 5.5,
    sellingCostPct: 5.5, // selling: agent ~3% + PPh final 2.5% on the sale (PP 34/2016)
    setupCost: 6.0, // % of price (≈ 120000000 at the preset price)
    setupCostType: 'pct',
    ownOngoingCost: 21000000,
    ownOngoingCostFreq: 'yearly',
    ownOngoingCostType: 'dollar',
    ownOngoingInflation: 3.5,
    rentAmount: 10000000,
    rentFreq: 'monthly',
    rentInflation: 4.0,
    rentOngoingCost: 1000000,
    rentOngoingCostFreq: 'yearly',
    rentOngoingCostType: 'dollar',
    rentOngoingInflation: 3.5,
    riskFreeRate: 5.0,
    horizon: 20,
    monthlyBudget: 0,
    monthlyBudgetIncrease: 0,
    mortgageType: 'pi',
    costInterestOnly: true,
    rtbEnabled: false,
    rtbBuyYear: 5,
    initialCash: 0,
  },
};
