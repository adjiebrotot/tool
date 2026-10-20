/* ── ABBREVIATIONS: this tool's terms (SharedAbbr in ../shared.js) ──
   Loaded right after shared.js on every page of this tool, so no other tool
   downloads them and the same letters can mean something else elsewhere.
   The scope key works as in shared.js: the folder covers its sub-pages, a
   'folder/sub-page' key covers one page. Site-wide terms ('*') stay in
   shared.js. */

/* ── Finance vs Cash (consumer and asset lending) ── */
SharedAbbr.glossary('financingvscash', {
  APR:  ['Annual Percentage Rate', 'what a loan really costs a year once the shape of the repayments is taken into account. A 5% flat loan carries an APR near 9%'],
  EAR:  ['Effective Annual Rate', 'a rate that already allows for compounding within the year, so 1% a month is 12.68% EAR, not 12%']
});

/* ── Loan Types Explained ──
   The explainer names the markets each structure is sold in, so it carries
   vocabulary the tool itself never has to: the local name for a lender, a
   product or a contract a reader outside that market will not know. */
SharedAbbr.glossary('financingvscash/loan-types', {
  Murabaha:      ['cost-plus sale', 'an Islamic finance contract: the bank buys the asset and resells it to you at an agreed markup, paid in instalments. The markup behaves exactly like a flat rate'],
  multifinance:  ['a non-bank consumer lender', 'the South-East Asian term for the vehicle and appliance credit companies that quote a flat rate per month'],
  KPR:           ['Kredit Pemilikan Rumah', 'the Indonesian home loan'],
  Lombard:       ['a loan secured against a securities portfolio', 'drawn and repaid in one lump, so it is usually a bullet']
});
