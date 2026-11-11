// The worked examples on each jurisdiction page (global-income-tax-calculator/<slug>/).
// Every figure on those pages is computed from engine.js with the page's own defaults
// plus the inputs below, by _ref/jurisdiction-pages.mjs. Keys are the example's anchor
// and the handle the writers' content files use: keep them once published.
// Each example is a distinct calculation (a status, regime, household or place the
// tool models), never the same sum under another name.
export const PAGES = [
  { slug: 'australia', cc: 'AU', ex: [
    { key: 'resident', amount: 100000, inputs: { auRes: 'pr' } },
    { key: 'temporary-resident', amount: 100000, inputs: { auRes: 'temp' } },
    { key: 'working-holiday-maker', amount: 55000, inputs: { auRes: 'whm' } },
    { key: 'foreign-resident', amount: 100000, inputs: { auRes: 'foreign' } },
    { key: 'no-private-health-cover', amount: 150000, inputs: { auRes: 'pr', auCover: false } },
  ]},
  { slug: 'singapore', cc: 'SG', ex: [
    { key: 'employment-pass', amount: 120000, inputs: { sgRes: 'ep' } },
    { key: 's-pass', amount: 54000, inputs: { sgRes: 'ep' } },
    { key: 'citizen', amount: 120000, inputs: { sgRes: 'citizen', sgAge: '55' } },
    { key: 'pr-first-year', amount: 120000, inputs: { sgRes: 'pr1' } },
    { key: 'non-resident', amount: 60000, inputs: { sgRes: 'nonres' } },
  ]},
  { slug: 'united-kingdom', cc: 'GB', ex: [
    { key: 'england', amount: 60000, inputs: { ukRegion: 'ruk' } },
    { key: 'scotland', amount: 60000, inputs: { ukRegion: 'sco' } },
    { key: 'student-loan', amount: 45000, inputs: { ukRegion: 'ruk', ukLoan: 'plan2' } },
    { key: 'above-100k', amount: 120000, inputs: { ukRegion: 'ruk' } },
  ]},
  { slug: 'germany', cc: 'DE', ex: [
    { key: 'single', amount: 65000, inputs: { deClass: 'I' } },
    { key: 'nurse', amount: 42000, inputs: { deClass: 'I' } },
    { key: 'married-sole-earner', amount: 65000, inputs: { deClass: 'III', deKids: true } },
    { key: 'church-tax', amount: 65000, inputs: { deClass: 'I', deChurch: '9' } },
  ]},
  { slug: 'united-states', cc: 'US', ex: [
    { key: 'texas', amount: 120000, inputs: { usState: 'TX', usFiling: 'S' } },
    { key: 'california', amount: 120000, inputs: { usState: 'CA', usFiling: 'S' } },
    { key: 'new-york-city', amount: 120000, inputs: { usState: 'NY', usNyc: true, usFiling: 'S' } },
    { key: 'married-filing-jointly', amount: 180000, inputs: { usState: 'WA', usFiling: 'MFJ' } },
    { key: 'h1b-nonresident-alien', amount: 120000, inputs: { usState: 'TX', usRes: 'nra' } },
    { key: 'f1-student', amount: 30000, inputs: { usState: 'MA', usRes: 'nra', usFicaExempt: true } },
  ]},
  { slug: 'canada', cc: 'CA', ex: [
    { key: 'ontario', amount: 90000, inputs: { caProv: 'ON' } },
    { key: 'british-columbia', amount: 90000, inputs: { caProv: 'BC' } },
    { key: 'alberta', amount: 90000, inputs: { caProv: 'AB' } },
    { key: 'quebec', amount: 90000, inputs: { caProv: 'QC' } },
  ]},
  { slug: 'france', cc: 'FR', ex: [
    { key: 'single-non-cadre', amount: 45000, inputs: { frCadre: 'noncadre' } },
    { key: 'cadre', amount: 70000, inputs: { frCadre: 'cadre' } },
    { key: 'married-two-children', amount: 70000, inputs: { frCadre: 'cadre', frMarried: true, frKids: '2' } },
    { key: 'impatriate', amount: 90000, inputs: { frCadre: 'cadre', frImp: true } },
  ]},
  { slug: 'netherlands', cc: 'NL', ex: [
    { key: 'resident', amount: 60000, inputs: { nlRuling: false } },
    { key: '30-percent-ruling', amount: 75000, inputs: { nlRuling: true, nlNorm: 'std' } },
    { key: '30-percent-ruling-under-30', amount: 50000, inputs: { nlRuling: true, nlNorm: 'young' } },
  ]},
  { slug: 'belgium', cc: 'BE', ex: [
    { key: 'single', amount: 55000, inputs: { beStatus: 'single' } },
    { key: 'married-two-children', amount: 70000, inputs: { beStatus: 'married', beKids: '2' } },
    { key: 'expat-regime', amount: 100000, inputs: { beExpat: true } },
  ]},
  { slug: 'switzerland', cc: 'CH', ex: [
    { key: 'single-zurich', amount: 110000, inputs: { chStatus: 'single' } },
    { key: 'married-two-children-zurich', amount: 140000, inputs: { chStatus: 'married', chKids: '2' } },
    { key: 'church-member', amount: 110000, inputs: { chStatus: 'single', chChurch: true } },
  ]},
  { slug: 'italy', cc: 'IT', ex: [
    { key: 'employee-milan', amount: 45000, inputs: { itImp: 'none' } },
    { key: 'impatriate', amount: 80000, inputs: { itImp: 'imp50' } },
    { key: 'impatriate-with-child', amount: 80000, inputs: { itImp: 'imp60' } },
  ]},
  { slug: 'spain', cc: 'ES', ex: [
    { key: 'resident-madrid', amount: 45000, inputs: { esRegime: 'res' } },
    { key: 'beckham-law', amount: 90000, inputs: { esRegime: 'beckham' } },
    { key: 'resident-two-children', amount: 45000, inputs: { esRegime: 'res', esKids: '2' } },
  ]},
  { slug: 'portugal', cc: 'PT', ex: [
    { key: 'resident', amount: 30000, inputs: { ptRegime: 'res' } },
    { key: 'irs-jovem', amount: 30000, inputs: { ptRegime: 'jovem', ptJovemYear: '1' } },
    { key: 'ifici', amount: 70000, inputs: { ptRegime: 'ifici' } },
    { key: 'non-resident', amount: 30000, inputs: { ptRegime: 'nonres' } },
  ]},
  { slug: 'norway', cc: 'NO', ex: [
    { key: 'resident', amount: 750000, inputs: { noRes: 'res' } },
    { key: 'paye-scheme', amount: 600000, inputs: { noRes: 'paye', noNi: true } },
  ]},
  { slug: 'sweden', cc: 'SE', ex: [
    { key: 'resident-stockholm', amount: 600000, inputs: { seRes: 'res', seMun: '30.55' } },
    { key: 'sink-non-resident', amount: 600000, inputs: { seRes: 'sink' } },
  ]},
  { slug: 'finland', cc: 'FI', ex: [
    { key: 'resident-helsinki', amount: 55000, inputs: { fiRes: 'res' } },
    { key: 'key-employee', amount: 90000, inputs: { fiRes: 'key' } },
  ]},
  { slug: 'estonia', cc: 'EE', ex: [
    { key: 'employee', amount: 36000, inputs: { eeP2: '2' } },
    { key: 'no-second-pillar', amount: 36000, inputs: { eeP2: '0' } },
  ]},
  { slug: 'japan', cc: 'JP', ex: [
    { key: 'resident-tokyo', amount: 6000000, inputs: { jpRes: 'y2' } },
    { key: 'first-year', amount: 6000000, inputs: { jpRes: 'y1' } },
    { key: 'specified-skilled-worker', amount: 3000000, inputs: { jpRes: 'y2' } },
    { key: 'non-resident', amount: 6000000, inputs: { jpRes: 'nonres' } },
  ]},
  { slug: 'south-korea', cc: 'KR', ex: [
    { key: 'progressive', amount: 60000000, inputs: { krMethod: 'prog' } },
    { key: 'flat-rate-foreign-worker', amount: 150000000, inputs: { krMethod: 'flat' } },
    { key: 'eps-worker', amount: 30000000, inputs: { krMethod: 'prog' } },
  ]},
  { slug: 'china', cc: 'CN', ex: [
    { key: 'local-shanghai', amount: 360000, inputs: { cnRes: 'local' } },
    { key: 'expat-allowances', amount: 600000, inputs: { cnRes: 'expat', cnAllow: 120000 } },
  ]},
  { slug: 'taiwan', cc: 'TW', ex: [
    { key: 'resident', amount: 1200000, inputs: { twRes: 'res' } },
    { key: 'non-resident', amount: 600000, inputs: { twRes: 'nonres', twEi: 'no' } },
    { key: 'gold-card', amount: 5000000, inputs: { twRes: 'res', twGold: true, twEi: 'no' } },
  ]},
  { slug: 'hong-kong', cc: 'HK', ex: [
    { key: 'single', amount: 600000, inputs: { hkMarried: false } },
    { key: 'married-two-children', amount: 900000, inputs: { hkMarried: true, hkKids: '2' } },
    { key: 'high-earner', amount: 3000000, inputs: {} },
  ]},
  { slug: 'indonesia', cc: 'ID', ex: [
    { key: 'single-tk0', amount: 120000000, inputs: { idRes: 'res', idMarried: false, idDeps: '0' } },
    { key: 'married-two-children', amount: 180000000, inputs: { idRes: 'res', idMarried: true, idDeps: '2' } },
    { key: 'non-resident', amount: 600000000, inputs: { idRes: 'nonres' } },
  ]},
  { slug: 'malaysia', cc: 'MY', ex: [
    { key: 'citizen', amount: 96000, inputs: { myRes: 'citizen' } },
    { key: 'expat-resident', amount: 180000, inputs: { myRes: 'expat' } },
    { key: 'non-resident', amount: 60000, inputs: { myRes: 'nonres' } },
  ]},
  { slug: 'thailand', cc: 'TH', ex: [
    { key: 'single', amount: 1200000, inputs: {} },
    { key: 'married-with-children', amount: 1800000, inputs: { thSpouse: true, thKids: '1', thKidsNew: '1' } },
  ]},
  { slug: 'united-arab-emirates', cc: 'AE', ex: [
    { key: 'expat', amount: 300000, inputs: { gulfNat: 'expat' } },
    { key: 'national', amount: 300000, inputs: { gulfNat: 'national' } },
  ]},
  { slug: 'saudi-arabia', cc: 'SA', ex: [
    { key: 'expat', amount: 240000, inputs: { gulfNat: 'expat' } },
    { key: 'national', amount: 240000, inputs: { gulfNat: 'national', saScheme: 'legacy' } },
  ]},
  { slug: 'qatar', cc: 'QA', ex: [
    { key: 'expat', amount: 240000, inputs: { gulfNat: 'expat' } },
    { key: 'national', amount: 240000, inputs: { gulfNat: 'national' } },
  ]},
  { slug: 'bahrain', cc: 'BH', ex: [
    { key: 'expat', amount: 24000, inputs: { gulfNat: 'expat' } },
    { key: 'national', amount: 24000, inputs: { gulfNat: 'national' } },
  ]},
  { slug: 'kuwait', cc: 'KW', ex: [
    { key: 'expat', amount: 18000, inputs: { gulfNat: 'expat' } },
    { key: 'national', amount: 18000, inputs: { gulfNat: 'national' } },
  ]},
  { slug: 'oman', cc: 'OM', ex: [
    { key: 'expat', amount: 18000, inputs: { gulfNat: 'expat' } },
    { key: 'national', amount: 18000, inputs: { gulfNat: 'national' } },
  ]},
];
