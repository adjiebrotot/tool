/* Global Income Tax Calculator: the calculation engine (window.GSCEngine).

   A line-by-line port of the spec's reference model (gsc_reference_model.py,
   spec v11, research date 10 Nov 2026). Every golden value the spec lists is
   held to this file by _audit/run.mjs, so a change here that moves a number
   fails the audit before it reaches a reader.

   Pure functions: nothing here reads the page. compute(country, gross, knobs)
   takes a full year's gross pay in local currency and returns
     { gross, tax, social, other, benefit, incomeTax, net, taxable, lines, notes, rate }
   or { notSupported: true, reason } when the rules for that case are not
   loaded (a gated US state, a guard the spec sets). Each line is
     { id, label, amount, kind, src, status, from }
   kind: 'tax' | 'social' | 'other' (summed into what leaves the pay),
         'benefit' (tax-free cash added to the pay),
         'deduction' | 'credit' | 'employer' | 'info' (shown, never summed),
         'base' (a step to taxable income the rules apply without a line of
         their own, such as a lump-sum deduction: shown, never summed).
   base: -1 or +1 on a line that is taken from (or added to) gross pay on the
   way to taxable income; gross plus those, floored at 0, is r.taxable
   (held by _audit/run.mjs). r.taxableLabel names which taxable income that
   is where a country has more than one (federal, cantonal, national).
   group: where an info line reads in the breakdown ('gross', 'tax',
   'social' or 'note', the default). inBrackets: an info line the breakdown
   table leaves out because a tax line's brackets (below) already show it.
   brackets: on a tax line worked out on marginal brackets, the tax bracket
   by bracket (see bands()).
   status: 'official' (a government page), 'secondary' (Big-4, law firm,
   payroll vendor, a calculator citing the official rule) or 'assumption' (a
   modelling choice the spec discloses).

   Added beyond the v11 reference model (each one is held by the audit too):
   - Illinois is loaded (4.95%, exemption 2,925 a person, none above federal
     AGI 250,000 / 500,000 joint): IL Department of Revenue and the IL
     Comptroller's 2026 payroll bulletin.
   - France above RFR 250,000: the CEHR (3% / 4%, service-public.gouv.fr,
     checked 15 Apr 2026). The CDHR (a 20% floor on the average rate) is tested
     and only a case it would touch is left unsupported.
   - The Ontario Tax Reduction's "2 x" shape is confirmed by EY's Ontario
     Budget 2026 summary (no Ontario tax up to taxable 18,930, clawed back to
     24,870: both follow from it exactly).                                    */
(function(global){
'use strict';

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function prog(x, br){
  let t = 0, lo = 0;
  for(const [up, r] of br){
    const hi = up == null ? Infinity : up;
    if(x > lo) t += (Math.min(x, hi) - lo) * r;
    lo = hi;
  }
  return t;
}
// Bracket table from upper edges and rates (the model's _b).
function brk(edges, rates){ return rates.map((r, i) => [i < edges.length ? edges[i] : null, r]); }
const floor = Math.floor, min = Math.min, max = Math.max;
const clamp = (x, lo, hi) => min(max(x, lo), hi);
function L(id, label, amount, kind, src, status, from){ return { id, label, amount, kind, src, status: status || 'secondary', from: from || '' }; }
// A line's part in taxable income (-1 taken off gross, +1 added to it), and where an info line reads.
const minus = l => (l.base = -1, l), plus = l => (l.base = 1, l);
const inGroup = (l, g) => (l.group = g, l);
function NS(reason){ return { notSupported: true, reason }; }
/* The brackets of a marginal schedule, laid on a tax line so the breakdown can show the tax
   bracket by bracket. br is the prog() table ([upper edge or null, rate], a third entry such
   as a quick deduction is ignored). o.scale multiplies the edges and the amounts (income
   splitting, a quotient), o.mult the rate and the amounts (a surtax worked out as a share of a
   simple tax). o.adj is what turns the brackets' sum into the line: [label, signed amount]
   pairs taken in order, with the running total kept at 0 or more, as the rules apply them.
   What is left after that (rounding to the unit the rules set) is l.brackets.rest.
     l.brackets = { base, rows: [{ lo, hi, rate, amount }], adj: [{ label, amount }], rest } */
function bands(l, x, br, o){
  o = o || {};
  const s = o.scale || 1, m = o.mult == null ? 1 : o.mult, rows = [];
  let lo = 0;
  x = max(0, x);
  for(const [up, r] of br){
    const hi = up == null ? Infinity : up*s;
    rows.push({ lo, hi: min(x, hi), rate: r*m, amount: max(0, min(x, hi) - lo)*r*m });
    lo = hi;
    if(x <= hi) break;
  }
  return bandRows(l, x, rows, o);
}
// The same, from rows worked out by the caller (a rate that rises across a zone is [from, to]).
function bandRows(l, x, rows, o){
  o = o || {};
  let run = rows.reduce((a, r) => a + r.amount, 0);
  const adj = [];
  for(const [label, v] of (o.adj || [])){
    if(!v) continue;
    const a = v < 0 ? -min(run, -v) : v;
    if(Math.abs(a) < 0.005) continue;
    adj.push({ label, amount: a }); run += a;
  }
  const rest = l.amount - run;
  l.brackets = { base: x, rows, adj, rest: Math.abs(rest) < 0.005 ? 0 : rest, restLabel: o.restLabel || 'Rounding' };
  return l;
}
// A quick-deduction table ([edge, rate, deduction]) as a plain bracket table.
const plainBr = br => br.map(([up, r]) => [up, r]);
// A per-100 points table ([from, tax at from, rate per 100]) as a bracket table, 0% below the first point.
const ptsBr = pts => [[pts[0][0], 0]].concat(pts.map((p, i) => [i + 1 < pts.length ? pts[i + 1][0] : null, p[2]/100]));

function finish(gross, lines, o){
  const sum = kind => lines.reduce((a, l) => a + (l.kind === kind ? l.amount : 0), 0);
  const tax = sum('tax'), social = sum('social'), other = sum('other'), benefit = sum('benefit');
  return Object.assign({
    gross, tax, social, other, benefit,
    incomeTax: tax - benefit,                          // the spec's "income tax (all levels)"
    net: gross - tax - social - other + benefit,
    taxable: null, lines, notes: []
  }, o || {});
}

/* ── Sources ─────────────────────────────────────────────────────────────── */
const SRC = {
  ato:      { name: 'Australian Taxation Office', url: 'https://www.ato.gov.au/' },
  iras:     { name: 'IRAS', url: 'https://www.iras.gov.sg/' },
  cpf:      { name: 'CPF Board', url: 'https://www.cpf.gov.sg/' },
  hmrc:     { name: 'GOV.UK', url: 'https://www.gov.uk/income-tax-rates' },
  slc:      { name: 'GOV.UK student loans', url: 'https://www.gov.uk/repaying-your-student-loan' },
  bmf:      { name: 'BMF (§32a EStG, PAP)', url: 'https://www.bundesfinanzministerium.de/' },
  desv:     { name: 'German social insurance 2026', url: 'https://www.deutsche-rentenversicherung.de/' },
  irs:      { name: 'IRS, Rev. Proc. 2025-32', url: 'https://www.irs.gov/' },
  irsnra:   { name: 'IRS, Taxation of nonresident aliens', url: 'https://www.irs.gov/individuals/international-taxpayers/taxation-of-nonresident-aliens' },
  ssa:      { name: 'Social Security wage base 2026', url: 'https://www.ssa.gov/' },
  states:   { name: 'calcsystems.com 2026 state table (Tax Foundation 2026)', url: 'https://taxfoundation.org/data/all/state/state-income-tax-rates/' },
  il:       { name: 'Illinois Department of Revenue', url: 'https://tax.illinois.gov/questionsandanswers/851.html' },
  ftb:      { name: 'California FTB 2026 rate schedules', url: 'https://www.ftb.ca.gov/' },
  edd:      { name: 'California EDD (SDI)', url: 'https://edd.ca.gov/' },
  nydtf:    { name: 'NY DTF schedules (via ablewealth.com, nycpaycheckcalc.com)', url: 'https://www.tax.ny.gov/' },
  nypfl:    { name: 'NY Paid Family Leave 2026', url: 'https://paidfamilyleave.ny.gov/' },
  nysif:    { name: 'NYSIF disability benefits', url: 'https://ww3.nysif.com/' },
  djp:      { name: 'DJP (pajak.go.id)', url: 'https://www.pajak.go.id/' },
  bpjs:     { name: 'BPJS Ketenagakerjaan and Kesehatan', url: 'https://www.bpjsketenagakerjaan.go.id/' },
  rdth:     { name: 'Thai Revenue Department', url: 'https://www.rd.go.th/' },
  sso:      { name: 'Thai Social Security Office', url: 'https://www.sso.go.th/' },
  lhdn:     { name: 'LHDN (via PwC, reviewed Jun 2026)', url: 'https://www.hasil.gov.my/' },
  kwsp:     { name: 'KWSP and PERKESO', url: 'https://www.kwsp.gov.my/' },
  nl:       { name: 'Belastingdienst', url: 'https://www.belastingdienst.nl/' },
  no:       { name: 'Skatteetaten', url: 'https://www.skatteetaten.no/' },
  se:       { name: 'Skatteverket', url: 'https://www.skatteverket.se/' },
  ee:       { name: 'EMTA', url: 'https://www.emta.ee/' },
  vero:     { name: 'vero.fi', url: 'https://www.vero.fi/' },
  be:       { name: 'SPF Finances', url: 'https://finances.belgium.be/' },
  onss:     { name: 'ONSS instructions (via monsalaire-net.be, Aureus Social)', url: 'https://www.socialsecurity.be/' },
  it:       { name: 'Agenzia delle Entrate', url: 'https://www.agenziaentrate.gov.it/' },
  inps:     { name: 'INPS Circ. 6/2026', url: 'https://www.inps.it/' },
  estv:     { name: 'ESTV, Art. 36 DBG 2026', url: 'https://www.estv.admin.ch/' },
  zh:       { name: 'Kanton Zürich (taxrep.ch for tariffs)', url: 'https://www.zh.ch/de/steuern-finanzen.html' },
  frsp:     { name: 'service-public.gouv.fr', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F1419' },
  urssaf:   { name: 'URSSAF and AGIRC-ARRCO 2026', url: 'https://www.urssaf.fr/' },
  cehr:     { name: 'service-public.gouv.fr (CEHR, checked 15 Apr 2026)', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F31130' },
  legifr:   { name: 'Légifrance, CGI art. 155 B', url: 'https://www.legifrance.gouv.fr/' },
  segsoc:   { name: 'Seguridad Social, Orden PJC/297/2026', url: 'https://www.seg-social.es/' },
  aeat:     { name: 'AEAT, Ley 35/2006 (LIRPF)', url: 'https://sede.agenciatributaria.gob.es/' },
  madrid:   { name: 'Comunidad de Madrid scale (via guiafiscal.es)', url: 'https://www.comunidad.madrid/' },
  ptat:     { name: 'Portal das Finanças, DL 212/2026', url: 'https://info.portaldasfinancas.gov.pt/' },
  ptded:    { name: 'CIRS art. 78 (via academiafinancas.com, simula.pt)', url: 'https://info.portaldasfinancas.gov.pt/' },
  nta:      { name: 'National Tax Agency', url: 'https://www.nta.go.jp/' },
  kyokai:   { name: 'Kyokai Kenpo Tokyo R8 table', url: 'https://www.kyoukaikenpo.or.jp/' },
  nts:      { name: 'National Tax Service Korea', url: 'https://www.nts.go.kr/' },
  nps:      { name: 'NPS and NHIS', url: 'https://www.nps.or.kr/' },
  cra:      { name: 'CRA (T4127, T4032)', url: 'https://www.canada.ca/en/revenue-agency.html' },
  ontario:  { name: 'Ontario 2026 Fall Statement', url: 'https://budget.ontario.ca/' },
  eyon:     { name: 'EY, Ontario Budget 2026 (30 Mar 2026)', url: 'https://globaltaxnews.ey.com/news/2026-0747' },
  bc:       { name: 'gov.bc.ca basic credits (20 Apr 2026)', url: 'https://www2.gov.bc.ca/' },
  rq:       { name: 'Revenu Québec, Principal Changes for 2026', url: 'https://www.revenuquebec.ca/' },
  ird:      { name: 'Inland Revenue Department', url: 'https://www.ird.gov.hk/' },
  mpfa:     { name: 'MPFA', url: 'https://www.mpfa.org.hk/' },
  cn:       { name: 'IIT Law; MOF/STA Notice 2023 No. 29', url: 'https://www.chinatax.gov.cn/' },
  shhrss:   { name: 'Shanghai HRSS', url: 'https://rsj.sh.gov.cn/' },
  mof:      { name: 'MOF, NTB Taipei, Taiwan (China)', url: 'https://www.ntbt.gov.tw/' },
  twins:    { name: 'BLI and NHIA', url: 'https://www.bli.gov.tw/' },
  gpssa:    { name: 'GPSSA (via countify.ae)', url: 'https://gpssa.gov.ae/' },
  grsia:    { name: 'Qatar Law 1/2022 (via Al Tamimi)', url: 'https://www.grsia.gov.qa/' },
  gosi:     { name: 'GOSI, RD M/273 (via Silberson, SCPL)', url: 'https://www.gosi.gov.sa/' },
  sio:      { name: 'SIO Bahrain (via Mercans, calcmena.com)', url: 'https://www.sio.gov.bh/' },
  pifss:    { name: 'PIFSS', url: 'https://www.pifss.gov.kw/' },
  spf:      { name: 'Social Protection Fund Oman', url: 'https://www.spf.gov.om/' },
  spec:     { name: 'Spec v11 model assumption', url: '' }
};

/* ════════════════════════════ AU 2026-27 ════════════════════════════════ */
const AU_RES = [[18200,0],[45000,.15],[135000,.30],[190000,.37],[null,.45]];
const AU_FOR = [[135000,.30],[190000,.37],[null,.45]];
const AU_WHM = [[45000,.15],[135000,.30],[190000,.37],[null,.45]];
function auLito(x){
  if(x <= 37500) return 700;
  if(x <= 45000) return 700 - 0.05*(x - 37500);
  if(x <= 66667) return max(0, 325 - 0.015*(x - 45000));
  return 0;
}
function auMedicare(x){
  if(x <= 28011) return 0;
  if(x <= 35013) return 0.10*(x - 28011);
  return 0.02*x;
}
function auMls(x){ return x > 164000 ? 0.015 : x > 123000 ? 0.0125 : x > 105000 ? 0.01 : 0; }
function au(g, k){
  const F = '1 Jul 2026', lines = [];
  let salary = g;
  if(k.auSuper){                       // the amount is a package: salary plus 12% super
    salary = g / 1.12;
    lines.push(minus(L('auSuperIn', 'Super guarantee, paid into your fund (12%)', g - salary, 'other', 'ato', 'official', F)));
  }
  const p = k.auRes;
  let taxable;
  if(p === 'foreign' || p === 'whm'){
    taxable = salary;
    const br = p === 'whm' ? AU_WHM : AU_FOR;
    lines.push(bands(L('auTax', p === 'whm' ? 'Income tax, working holiday maker rates' : 'Income tax, foreign resident rates',
      prog(salary, br), 'tax', 'ato', 'official', F), salary, br));
  } else {
    // Work-related expenses are claimed on the return at tax time and differ from person to
    // person, so none come off here: the tax is on the salary as paid.
    taxable = salary;
    const gross = prog(taxable, AU_RES), lito = auLito(taxable);
    lines.push(bands(L('auTax', 'Income tax, resident rates', max(0, gross - lito), 'tax', 'ato', 'official', F), taxable, AU_RES,
      { adj: [['Less the low income tax offset (LITO)', -lito]] }));
    if(lito > 0) lines.push(L('auLito', 'Low income tax offset (LITO), inside the tax above', min(lito, gross), 'credit', 'ato', 'secondary', F));
    if(p === 'pr'){
      lines.push(L('auMed', 'Medicare levy (2%)', auMedicare(taxable), 'tax', 'ato', 'official', '2025-26 thresholds'));
      if(!k.auCover && auMls(taxable) > 0)
        lines.push(L('auMls', 'Medicare levy surcharge, no private hospital cover', auMls(taxable)*taxable, 'tax', 'ato', 'secondary', F));
    }
  }
  if(!k.auSuper) lines.push(L('auSuperEr', 'Employer super guarantee, paid on top (12%)', 0.12*g, 'employer', 'ato', 'official', F));
  return finish(g, lines, { taxable });
}

/* ════════════════════════════ SG YA2027 ═════════════════════════════════ */
const SG = [[20000,0],[30000,.02],[40000,.035],[80000,.07],[120000,.115],[160000,.15],[200000,.18],[240000,.19],[280000,.195],[320000,.20],[500000,.22],[1000000,.23],[null,.24]];
const SG_CPF_AGE = { '55': .20, '60': .18, '65': .125, '70': .075, '99': .05 };
function sg(g, k){
  const F = 'YA2027', lines = [];
  if(k.sgRes === 'nonres'){
    const flat = 0.15*g, resRates = prog(g, SG);
    const nrl = L('sgTax', flat >= resRates ? 'Income tax, non-resident (15% of gross)' : 'Income tax, non-resident (resident rates, no reliefs)',
      max(flat, resRates), 'tax', 'iras', 'secondary', F);
    lines.push(flat >= resRates ? nrl : bands(nrl, g, SG));
    return finish(g, lines, { taxable: g });
  }
  const rate = k.sgRes === 'citizen' ? SG_CPF_AGE[k.sgAge] || .20 : k.sgRes === 'pr1' ? .05 : k.sgRes === 'pr2' ? .15 : 0;
  const cpf = rate ? floor(rate*min(g/12, 8000))*12 : 0;
  if(cpf) lines.push(L('sgCpf', 'CPF, employee share (' + +(rate*100).toFixed(1) + '%)', cpf, 'social', 'cpf', k.sgRes === 'citizen' ? 'official' : 'secondary', '1 Jan 2026'));
  const relief = min(80000, 1000 + cpf);
  lines.push(minus(L('sgRelief', 'Earned income relief and CPF relief', relief, 'deduction', 'iras', 'official', F)));
  const taxable = max(0, g - relief);
  lines.push(bands(L('sgTax', 'Income tax', prog(taxable, SG), 'tax', 'iras', 'official', F), taxable, SG));
  return finish(g, lines, { taxable });
}

/* ════════════════════════════ UK 2026/27 ════════════════════════════════ */
const UK_RUK = [[37700,.20],[125140,.40],[null,.45]];
const UK_SCO = [[3967,.19],[16956,.20],[31092,.21],[62430,.42],[125140,.45],[null,.48]];
const UK_LOAN = { plan1: 26900, plan2: 29385, plan4: 33795, plan5: 25000 };
function uk(g, k){
  const F = '6 Apr 2026', lines = [];
  const pa = max(0, 12570 - max(0, (g - 100000)/2)), taxable = max(0, g - pa);
  lines.push(minus(L('ukPa', g > 100000 ? 'Personal allowance, tapered away above 100,000' : 'Personal allowance', min(pa, g), 'deduction', 'hmrc', 'official', F)));
  const ukBr = k.ukRegion === 'sco' ? UK_SCO : UK_RUK;
  lines.push(bands(L('ukTax', k.ukRegion === 'sco' ? 'Income tax, Scottish rates' : 'Income tax', prog(taxable, ukBr), 'tax', 'hmrc', 'official', F), taxable, ukBr));
  lines.push(L('ukNi', 'National Insurance, Class 1', 0.08*max(0, min(g, 50270) - 12570) + 0.02*max(0, g - 50270), 'social', 'hmrc', 'official', F));
  if(UK_LOAN[k.ukLoan]) lines.push(L('ukSl', 'Student loan (' + k.ukLoan.replace('plan', 'Plan ') + ', 9% above ' + UK_LOAN[k.ukLoan].toLocaleString('en') + ')',
    0.09*max(0, g - UK_LOAN[k.ukLoan]), 'other', 'slc', 'secondary', F));
  if(k.ukPg) lines.push(L('ukPgl', 'Postgraduate loan (6% above 21,000)', 0.06*max(0, g - 21000), 'other', 'slc', 'secondary', F));
  return finish(g, lines, { taxable });
}

/* ════════════════════════════ DE 2026 ═══════════════════════════════════ */
function deEst(x){
  x = floor(x); let t;
  if(x <= 12348) t = 0;
  else if(x <= 17799){ const y = (x - 12348)/10000; t = (914.51*y + 1400)*y; }
  else if(x <= 69878){ const z = (x - 17799)/10000; t = (173.10*z + 2397)*z + 1034.87; }
  else if(x <= 277825) t = 0.42*x - 11135.63;
  else t = 0.45*x - 19470.38;
  return floor(t);
}
// §32a by zone, unrounded: where the rate rises across a zone, the row gives its first and last rate.
const DE_ZONES = [[12348, 0], [17799, [.14, .2397]], [69878, [.2397, .42]], [277825, .42], [null, .45]];
function deT(x){
  if(x <= 12348) return 0;
  if(x <= 17799){ const y = (x - 12348)/10000; return (914.51*y + 1400)*y; }
  if(x <= 69878){ const z = (x - 17799)/10000; return (173.10*z + 2397)*z + 1034.87; }
  if(x <= 277825) return 0.42*x - 11135.63;
  return 0.45*x - 19470.38;
}
function deBands(l, zve, joint){
  const s = joint ? 2 : 1, x = max(0, zve), rows = [];
  let lo = 0;
  for(const [up, r] of DE_ZONES){
    const hi = up == null ? Infinity : up*s, top = min(x, hi);
    rows.push({ lo, hi: top, rate: r, amount: s*(deT(top/s) - deT(lo/s)) });
    lo = hi;
    if(x <= hi) break;
  }
  return bandRows(l, x, rows, { restLabel: 'Rounding (income and tax to whole euros)' });
}
function deSoli(est, joint){ const fg = joint ? 40700 : 20350; return est <= fg ? 0 : min(0.055*est, 0.119*(est - fg)); }
function de(g, k){
  const F = '1 Jan 2026', lines = [];
  const addOn = (k.deAddOn == null ? 2.9 : k.deAddOn)/100, childless = !k.deKids;
  const rv = 0.093*min(g, 101400), av = 0.013*min(g, 101400);
  const kvb = min(g, 69750), kv = (0.073 + addOn/2)*kvb, pv = (0.018 + (childless ? 0.006 : 0))*kvb;
  const vp = rv + (0.070 + addOn/2)*kvb + pv, zve = max(0, g - 1230 - 36 - vp);
  lines.push(minus(L('deWk', 'Employee lump sum for work expenses', 1230, 'base', 'bmf', 'official', F)));
  lines.push(minus(L('deSa', 'Lump sum for special expenses', 36, 'base', 'bmf', 'official', F)));
  lines.push(minus(L('deVp', 'Pension, health and care contributions, deductible part', vp, 'base', 'bmf', 'secondary', F)));
  const joint = k.deClass === 'III';
  const est = joint ? 2*deEst(zve/2) : deEst(zve), soli = deSoli(est, joint), church = (+k.deChurch || 0)/100*est;
  lines.push(deBands(L('deEst', joint ? 'Income tax, class III (splitting)' : 'Income tax, class I', est, 'tax', 'bmf', 'official', F), zve, joint));
  if(soli) lines.push(L('deSoli', 'Solidarity surcharge', soli, 'tax', 'bmf', 'secondary', F));
  if(church) lines.push(L('deKiSt', 'Church tax (' + k.deChurch + '%)', church, 'tax', 'bmf', 'official', F));
  lines.push(L('deRv', 'Pension insurance (9.3%)', rv, 'social', 'desv', 'official', F));
  lines.push(L('deAv', 'Unemployment insurance (1.3%)', av, 'social', 'desv', 'official', F));
  lines.push(L('deKv', 'Health insurance (7.3% + half the add-on)', kv, 'social', 'desv', 'official', F));
  lines.push(L('dePv', childless ? 'Long-term care, childless (2.4%)' : 'Long-term care (1.8%)', pv, 'social', 'desv', 'official', F));
  return finish(g, lines, { taxable: zve });
}

/* ════════════════════════════ US 2026 ═══════════════════════════════════ */
const USF = {
  S:   [16100, [[12400,.10],[50400,.12],[105700,.22],[201775,.24],[256225,.32],[640600,.35],[null,.37]]],
  MFJ: [32200, [[24800,.10],[100800,.12],[211400,.22],[403550,.24],[512450,.32],[768700,.35],[null,.37]]]
};
const usFed = (g, fs) => prog(max(0, g - USF[fs][0]), USF[fs][1]);
function usFicaLines(g, fs, lines){
  const F = '1 Jan 2026';
  lines.push(L('usSs', 'Social Security (6.2% up to 184,500)', 0.062*min(g, 184500), 'social', 'ssa', 'secondary', F));
  lines.push(L('usMed', 'Medicare (1.45%)', 0.0145*g, 'social', 'irs', 'secondary', F));
  const th = fs === 'S' ? 200000 : 250000;
  if(g > th) lines.push(L('usAddMed', 'Additional Medicare (0.9% above ' + th.toLocaleString('en') + ')', 0.009*(g - th), 'social', 'irs', 'secondary', F));
}
const CA_S = [[11456,.01],[27157,.02],[42861,.04],[59498,.06],[75197,.08],[384109,.093],[460927,.103],[768213,.113],[null,.123]];
const CA_MFJ = [[22912,.01],[54314,.02],[85722,.04],[118996,.06],[150394,.08],[768218,.093],[921854,.103],[1536426,.113],[null,.123]];
const NY_S = [[8500,.039],[11700,.044],[13900,.0515],[80650,.054],[215400,.059],[1077550,.0685],[5e6,.0965],[25e6,.103],[null,.109]];
const NYC_S = [[12000,.03078],[25000,.03762],[50000,.03819],[null,.03876]];
const NY_MFJ = [[17150,.039],[23600,.044],[27900,.0515],[161550,.054],[323200,.059],[2155350,.0685],[5e6,.0965],[25e6,.103],[null,.109]];
const NYC_MFJ = [[21600,.03078],[45000,.03762],[90000,.03819],[null,.03876]];
const NY_P = { S: [8000, NY_S, NYC_S, 215400, .059], MFJ: [16050, NY_MFJ, NYC_MFJ, 161550, .054] };
// NY tax incl. the supplemental tax (benefit recapture), Tax Law s.601(d-1), every tier (v11).
function nyRecaptureTax(agi, ti, br, tierTop, tierRate){
  const st = prog(ti, br);
  if(agi <= 107650) return st;
  if(ti <= tierTop) return st + (ti*tierRate - st)*min(1, (agi - 107650)/50000);
  let lo = 0, prev = null;
  for(const [up, r] of br){
    if(up == null || ti <= up){
      const Lo = lo, rb = prev*Lo - prog(Lo, br), ib = (r - prev)*Lo;
      return st + rb + ib*min(1, max(0, agi - Lo)/50000);
    }
    lo = up; prev = r;
  }
}
const b = brk;
const US_ST = {
  AZ: [b([],[.025]), b([],[.025]), [16100,32200], [0,0], [0,0]],
  AR: [b([5599,11199,15999,26399],[0,.02,.03,.034,.037]), b([5599,11199,15999,26399],[0,.02,.03,.034,.037]), [2470,4940], [0,0], [29,58]],
  CO: [b([],[.044]), b([],[.044]), [16100,32200], [0,0], [0,0]],
  DE: [b([2000,5000,10000,20000,25000,60000],[0,.022,.039,.048,.052,.0555,.066]), b([2000,5000,10000,20000,25000,60000],[0,.022,.039,.048,.052,.0555,.066]), [3250,6500], [0,0], [110,220]],
  GA: [b([],[.0499]), b([],[.0499]), [15000,30000], [0,0], [0,0]],
  HI: [b([9600,14400,19200,24000,36000,48000,125000,175000,225000,275000,325000],[.014,.032,.055,.064,.068,.072,.076,.079,.0825,.09,.10,.11]),
       b([19200,28800,38400,48000,72000,96000,250000,350000,450000,550000,650000],[.014,.032,.055,.064,.068,.072,.076,.079,.0825,.09,.10,.11]), [8000,16000], [1144,2288], [0,0]],
  ID: [b([4811],[0,.053]), b([9622],[0,.053]), [16100,32200], [0,0], [0,0]],
  IN: [b([],[.0295]), b([],[.0295]), [0,0], [1000,2000], [0,0]],
  IA: [b([],[.038]), b([],[.038]), [16100,32200], [0,0], [40,80]],
  KS: [b([23000],[.052,.0558]), b([46000],[.052,.0558]), [3605,8240], [9160,18320], [0,0]],
  KY: [b([],[.035]), b([],[.035]), [3360,6720], [0,0], [0,0]],
  LA: [b([],[.03]), b([],[.03]), [12875,25750], [0,0], [0,0]],
  MD: [b([1000,2000,3000,100000,125000,150000,250000,500000,1000000],[.02,.03,.04,.0475,.05,.0525,.055,.0575,.0625,.065]),
       b([1000,2000,3000,150000,175000,225000,300000,600000,1200000],[.02,.03,.04,.0475,.05,.0525,.055,.0575,.0625,.065]), [3350,6700], [3200,6400], [0,0]],
  MA: [b([1107750],[.05,.09]), b([1107750],[.05,.09]), [0,0], [4400,8800], [0,0]],
  MI: [b([],[.0425]), b([],[.0425]), [0,0], [5900,11800], [0,0]],
  MS: [b([10000],[0,.04]), b([10000],[0,.04]), [2300,4600], [6000,12000], [0,0]],
  MO: [b([1348,2696,4044,5392,6740,8088,9436],[0,.02,.025,.03,.035,.04,.045,.047]), b([1348,2696,4044,5392,6740,8088,9436],[0,.02,.025,.03,.035,.04,.045,.047]), [16100,32200], [0,0], [0,0]],
  MT: [b([47500],[.047,.0565]), b([95000],[.047,.0565]), [16100,32200], [0,0], [0,0]],
  NE: [b([4130,24760],[.0246,.0351,.0455]), b([8250,49530],[.0246,.0351,.0455]), [8850,17700], [0,0], [176,352]],
  NJ: [b([20000,35000,40000,75000,500000,1000000],[.014,.0175,.035,.05525,.0637,.0897,.1075]),
       b([20000,50000,70000,80000,150000,500000,1000000],[.014,.0175,.0245,.035,.05525,.0637,.0897,.1075]), [0,0], [1000,2000], [0,0]],
  NC: [b([],[.0399]), b([],[.0399]), [12750,25500], [0,0], [0,0]],
  ND: [b([49575,250400],[0,.0195,.025]), b([82800,304850],[0,.0195,.025]), [16100,32200], [0,0], [0,0]],
  OK: [b([3750,4900,7200],[0,.025,.035,.045]), b([7500,9800,14400],[0,.025,.035,.045]), [6350,12700], [1000,2000], [0,0]],
  PA: [b([],[.0307]), b([],[.0307]), [0,0], [0,0], [0,0]],
  VT: [b([49400,119700,249700],[.0335,.066,.076,.0875]), b([82500,199450,304000],[.0335,.066,.076,.0875]), [7650,15300], [5300,10600], [0,0]],
  VA: [b([3000,5000,17000],[.02,.03,.05,.0575]), b([3000,5000,17000],[.02,.03,.05,.0575]), [8750,17500], [930,1860], [0,0]],
  WV: [b([10000,25000,40000,60000],[.0211,.0281,.0316,.0422,.0458]), b([10000,25000,40000,60000],[.0211,.0281,.0316,.0422,.0458]), [0,0], [2000,4000], [0,0]],
  DC: [b([10000,40000,60000,250000,500000,1000000],[.04,.06,.065,.085,.0925,.0975,.1075]), b([10000,40000,60000,250000,500000,1000000],[.04,.06,.065,.085,.0925,.0975,.1075]), [16100,32200], [0,0], [0,0]]
};
// Left out of the state list: these phase their deductions out on schedules not loaded. A job saved
// with one (before the list was trimmed) still reaches here and says so instead of a figure.
const US_ST_GATED = {
  AL: 'standard deduction phase-down and the deduction for federal income tax', CT: 'personal exemption phase-out and CT benefit recapture',
  ME: 'standard deduction and exemption phase-out', MN: 'standard deduction phase-down', NM: 'low and middle income exemption phase-out',
  OH: 'personal exemption that falls with income', OR: 'exemption credit phase-out and the federal tax subtraction', RI: 'standard deduction and exemption phase-out',
  SC: 'standard deduction phase-down', UT: 'taxpayer credit phase-out', WI: 'standard deduction phase-down'
};
const US_NO_TAX = ['AK','FL','NV','NH','SD','TN','TX','WA','WY'];
const US_LOCAL = ['MD','IN','MI','OH','PA','KY','MO','OR','DE','IA','CO'];
const US_STATES = {
  AL:'Alabama', AK:'Alaska', AZ:'Arizona', AR:'Arkansas', CA:'California', CO:'Colorado', CT:'Connecticut', DE:'Delaware', DC:'District of Columbia',
  FL:'Florida', GA:'Georgia', HI:'Hawaii', ID:'Idaho', IL:'Illinois', IN:'Indiana', IA:'Iowa', KS:'Kansas', KY:'Kentucky', LA:'Louisiana', ME:'Maine',
  MD:'Maryland', MA:'Massachusetts', MI:'Michigan', MN:'Minnesota', MS:'Mississippi', MO:'Missouri', MT:'Montana', NE:'Nebraska', NV:'Nevada',
  NH:'New Hampshire', NJ:'New Jersey', NM:'New Mexico', NY:'New York', NC:'North Carolina', ND:'North Dakota', OH:'Ohio', OK:'Oklahoma', OR:'Oregon',
  PA:'Pennsylvania', RI:'Rhode Island', SC:'South Carolina', SD:'South Dakota', TN:'Tennessee', TX:'Texas', UT:'Utah', VT:'Vermont', VA:'Virginia',
  WA:'Washington', WV:'West Virginia', WI:'Wisconsin', WY:'Wyoming'
};
// Illinois (added after v11): 4.95% flat, exemption 2,925 a person, none above AGI 250,000 (500,000 joint).
const IL_RATE = 0.0495, IL_EX = 2925;
function ilTax(g, fs){
  const n = fs === 'MFJ' ? 2 : 1, ex = g > (fs === 'MFJ' ? 500000 : 250000) ? 0 : IL_EX*n;
  return IL_RATE*max(0, g - ex);
}
/* State (and city) tax lines for one state. Returns null for a gated state. */
function usStateLines(g, st, fs, k, lines){
  const F = '1 Jan 2026';
  if(US_NO_TAX.includes(st)){ lines.push(inGroup(L('usStNone', US_STATES[st] + ' has no state tax on wages', 0, 'info', 'states', 'official', F), 'tax')); return 0; }
  if(US_ST_GATED[st]) return null;
  let total = 0;
  if(st === 'CA'){
    const [sd, br, cred] = fs === 'S' ? [5900, CA_S, 158] : [11800, CA_MFJ, 316];
    const base = max(0, prog(max(0, g - sd), br) - cred), bhst = 0.01*max(0, g - sd - 1e6);
    lines.push(bands(L('usState', 'California income tax', base, 'tax', 'ftb', fs === 'MFJ' ? 'official' : 'secondary', F), max(0, g - sd), br,
      { adj: [['Less the personal exemption credit', -cred]] }));
    if(bhst) lines.push(L('usCaBhst', 'California behavioral health services tax (1% above 1M)', bhst, 'tax', 'ftb', 'secondary', F));
    lines.push(L('usCaSdi', 'California SDI (1.3%, no cap)', 0.013*g, 'social', 'edd', 'secondary', F));
    total = base + bhst;
  } else if(st === 'NY'){
    const [sd, br, cbr, top, rate] = NY_P[fs];
    const ti = max(0, g - sd), sched = prog(ti, br), stx = nyRecaptureTax(g, ti, br, top, rate);
    lines.push(bands(L('usState', 'New York State income tax', stx, 'tax', 'nydtf', 'secondary', F), ti, br,
      { adj: [['Plus the benefit recapture (supplemental tax)', stx - sched]] }));
    // The same amount as a note, for a reader of the lines alone; the breakdown table shows it in the brackets instead.
    if(stx - sched > 0.005){
      const rl = inGroup(L('usNyRecap', 'of which benefit recapture (supplemental tax)', stx - sched, 'info', 'nydtf', 'secondary', F), 'tax');
      rl.inBrackets = true;
      lines.push(rl);
    }
    total = stx;
    if(k.usNyc){ const city = prog(ti, cbr); lines.push(bands(L('usNyc', 'New York City resident tax', city, 'tax', 'nydtf', 'secondary', F), ti, cbr)); total += city; }
    lines.push(L('usNyPfl', 'NY Paid Family Leave (0.432%, max 411.91)', min(0.00432*g, 411.91), 'social', 'nypfl', 'official', F));
    if(k.usNyDbl !== false) lines.push(L('usNyDbl', 'NY disability (DBL, 0.5%, max 0.60 a week)', 52*min(0.005*g/52, 0.60), 'social', 'nysif', 'official', F));
  } else if(st === 'IL'){
    const t = ilTax(g, fs);
    lines.push(L('usState', 'Illinois income tax (4.95%)', t, 'tax', 'il', 'official', F));
    if(g > (fs === 'MFJ' ? 500000 : 250000)) lines.push(inGroup(L('usIlEx', 'No Illinois exemption above AGI ' + (fs === 'MFJ' ? '500,000' : '250,000'), 0, 'info', 'il', 'official', F), 'tax'));
    total = t;
  } else {
    const [bs, bm, sd, ex, cr] = US_ST[st], i = fs === 'S' ? 0 : 1;
    const sb = max(0, g - sd[i] - ex[i]), sbr = i ? bm : bs, t = max(0, prog(sb, sbr) - cr[i]);
    const sl = L('usState', US_STATES[st] + ' income tax', t, 'tax', 'states', 'secondary', F);
    // A flat-rate state has one rate, not brackets, so its line stands alone.
    lines.push(sbr.length > 1 ? bands(sl, sb, sbr, { adj: [['Less the personal credit', -cr[i]]] }) : sl);
    total = t;
  }
  const loc = (+k.usLocal || 0)/100;
  if(loc > 0){ lines.push(L('usLocal', 'Local or county income tax (' + k.usLocal + '%)', loc*g, 'tax', 'spec', 'assumption', F)); total += loc*g; }
  return total;
}
function us(g, k){
  const F = '1 Jan 2026', lines = [], st = k.usState || 'TX';
  const nra = k.usRes === 'nra', fs = nra ? 'S' : (k.usFiling === 'MFJ' ? 'MFJ' : 'S');
  if(st !== 'CA' && st !== 'NY' && st !== 'IL' && US_ST_GATED[st])
    return NS(US_STATES[st] + ' is not covered: the rules for its ' + US_ST_GATED[st] + ' are not loaded, and a flat deduction would misstate the tax.');
  const stLines = [], stTax = usStateLines(g, st, fs, k, stLines);
  const notes = [];
  if(nra){
    // Wages taxed at single rates with no standard deduction; state income tax paid is itemised.
    const ded = stTax;
    lines.push(bands(L('usFed', 'Federal income tax, nonresident alien (no standard deduction)', prog(max(0, g - ded), USF.S[1]), 'tax', 'irsnra', 'official', F), max(0, g - ded), USF.S[1]));
    if(ded > 0) lines.push(minus(L('usNraDed', 'State income tax itemised as a deduction', ded, 'deduction', 'irsnra', 'secondary', F)));
    lines.push(...stLines);
    if(k.usFicaExempt) lines.push(inGroup(L('usFicaEx', 'FICA exempt (F, J, M or Q status)', 0, 'info', 'irsnra', 'secondary', F), 'social'));
    else usFicaLines(g, 'S', lines);
    notes.push('Tax treaty exemptions are not modelled.');
  } else {
    lines.push(minus(L('usStd', 'Federal standard deduction', min(USF[fs][0], g), 'deduction', 'irs', 'official', F)));
    lines.push(bands(L('usFed', 'Federal income tax', usFed(g, fs), 'tax', 'irs', 'official', F), max(0, g - USF[fs][0]), USF[fs][1]));
    lines.push(...stLines);
    usFicaLines(g, fs, lines);
  }
  if(US_LOCAL.includes(st) && !(+k.usLocal > 0)) notes.push('Local or county income tax in ' + US_STATES[st] + ' is not included. Set it under Details.');
  if(st === 'AR' && g < 92300) notes.push('Arkansas uses separate low-income tables below 92,300, not loaded here, so its tax may read high.');
  if(st === 'ID') notes.push('Idaho\'s 5.3% rate holds for 2026; its zero bracket uses the 2025 amount, as the 2026 figure was not yet published.');
  if(st === 'VT') notes.push('Vermont uses its 2025 amounts: 2026 figures were not yet published.');
  if(st === 'DC') notes.push('Sources differ on the DC standard deduction (16,100 or 15,000). This uses 16,100.');
  if(st === 'NY' && fs === 'S' && g - 8000 > 215400 && g - 8000 < 265400) notes.push('Just above taxable 215,400, New York\'s recapture adds tax in a step. That is the law, not a slip.');
  return finish(g, lines, { taxable: max(0, g - (nra ? stTax : USF[fs][0])), taxableLabel: 'Taxable income, federal', notes });
}

/* ════════════════════════════ ID 2026 ═══════════════════════════════════ */
const ID_BR = [[60e6,.05],[250e6,.15],[500e6,.25],[5e9,.30],[null,.35]];
function idn(g, k){
  const F = '1 Jan 2026', lines = [], gm = g/12;
  const jkk = (k.idJkk == null ? 0.24 : +k.idJkk)/100;
  const jht = 0.02*g;
  let jp = 0; for(let m = 0; m < 12; m++) jp += 0.01*min(gm, m < 2 ? 10547400 : 11086300);
  const kes = 12*0.01*min(gm, 12e6);
  const bpjsOn = k.idRes !== 'nonres' || k.idBpjs !== false;
  if(bpjsOn){
    lines.push(L('idJht', 'BPJS old-age savings (JHT, 2%)', jht, 'social', 'bpjs', 'secondary', F));
    lines.push(L('idJp', 'BPJS pension (JP, 1%, cap rises 1 Mar)', jp, 'social', 'bpjs', 'secondary', F));
    lines.push(L('idKes', 'BPJS Kesehatan (1%, wage cap 12M)', kes, 'social', 'bpjs', 'secondary', F));
  }
  if(k.idRes === 'nonres'){
    lines.push(L('idPph26', 'PPh 26, 20% of gross, final', 0.20*g, 'tax', 'djp', 'official', F));
    return finish(g, lines, { taxable: g, notes: ['Treaty relief for employment income is not modelled.'] });
  }
  const gb = g + 12*(jkk*gm + 0.003*gm + 0.04*min(gm, 12e6));
  const deps = clamp(+k.idDeps || 0, 0, 3);
  const ptkp = 54e6 + (k.idMarried ? 4.5e6 : 0) + 4.5e6*deps;
  const jab = min(0.05*gb, 6e6);
  const raw = max(0, gb - jab - jht - jp - ptkp), pkp = floor(raw/1000)*1000;
  lines.forEach(l => { if(l.id === 'idJht' || l.id === 'idJp') l.base = -1; });   // JHT and JP come off the taxable pay
  lines.push(plus(L('idPrem', 'Employer premiums counted as income (JKK, JKM, BPJS Kesehatan)', gb - g, 'info', 'djp', 'secondary', F)));
  lines.push(minus(L('idJab', 'Job expense deduction (5%, max 6M)', jab, 'deduction', 'djp', 'secondary', F)));
  lines.push(minus(L('idPtkp', 'Non-taxable allowance (PTKP ' + (k.idMarried ? 'K' : 'TK') + '/' + deps + ')', ptkp, 'deduction', 'djp', 'secondary', F)));
  if(raw > pkp) lines.push(minus(L('idRound', 'Rounded down to the nearest 1,000', raw - pkp, 'base', 'djp', 'official', F)));
  lines.push(bands(L('idPph21', 'PPh 21 income tax', prog(pkp, ID_BR), 'tax', 'djp', 'secondary', F), pkp, ID_BR));
  return finish(g, lines, { taxable: pkp });
}

/* ════════════════════════════ TH 2026 ═══════════════════════════════════ */
const TH_BR = [[150000,0],[300000,.05],[500000,.10],[750000,.15],[1e6,.20],[2e6,.25],[5e6,.30],[null,.35]];
function th(g, k){
  const F = '2026', lines = [];
  const sso = 12*0.05*min(max(g/12, 1650), 17500);
  const allow = 60000 + (k.thSpouse ? 60000 : 0) + 30000*(+k.thKids || 0) + 60000*(+k.thKidsNew || 0);
  const exp = min(0.5*g, 100000), taxable = max(0, g - exp - allow - sso);
  lines.push(minus(L('thSso', 'Social security (5%, wage ceiling 17,500 a month)', sso, 'social', 'sso', 'secondary', F)));
  lines.push(minus(L('thExp', 'Employment expense deduction (50%, max 100k)', exp, 'deduction', 'rdth', 'secondary', F)));
  lines.push(minus(L('thAllow', 'Personal, spouse and child allowances', allow, 'deduction', 'rdth', 'secondary', F)));
  lines.push(bands(L('thTax', 'Personal income tax', prog(taxable, TH_BR), 'tax', 'rdth', 'secondary', F), taxable, TH_BR));
  return finish(g, lines, { taxable });
}

/* ════════════════════════════ MY YA2026 ═════════════════════════════════ */
const MY_BR = [[5000,0],[20000,.01],[35000,.03],[50000,.06],[70000,.11],[100000,.19],[400000,.25],[600000,.26],[2e6,.28],[null,.30]];
function my(g, k){
  const F = 'YA2026', lines = [], m = g/12, w = min(m, 6000);
  const citizen = k.myRes === 'citizen';
  let epf, socso;
  if(citizen){ epf = 0.11*g; socso = 12*(0.005 + 0.002)*w + 7*0.0075*w; }
  else { epf = 0.02*g; socso = 7*0.0075*w; }
  lines.push(L('myEpf', 'EPF (' + (citizen ? '11%' : '2% for expats') + ')', epf, 'social', 'kwsp', citizen ? 'official' : 'secondary', F));
  if(citizen) lines.push(L('mySocso', 'SOCSO and EIS (0.5% + 0.2%, wage cap 6,000)', 12*0.007*w, 'social', 'kwsp', 'secondary', F));
  lines.push(L('myLindung', 'LINDUNG 24 Jam (0.75% from 1 Jun 2026)', 7*0.0075*w, 'social', 'kwsp', 'secondary', '1 Jun 2026'));
  if(k.myRes === 'nonres'){
    lines.push(L('myTax', 'Income tax, non-resident (30% flat)', 0.30*g, 'tax', 'lhdn', 'secondary', F));
    return finish(g, lines, { taxable: g });
  }
  const socRelief = citizen ? min(socso, 350) : (k.myLindung ? min(socso, 350) : 0);
  const relief = 9000 + min(epf, 4000) + socRelief + (k.mySpouse ? 4000 : 0) + 2000*(+k.myKids || 0);
  const ci = max(0, g - relief);
  let t = prog(ci, MY_BR);
  lines.push(minus(L('myRelief', 'Reliefs (self, EPF, SOCSO, spouse, children)', relief, 'deduction', 'lhdn', 'secondary', F)));
  const rebate = ci <= 35000 && t > 0 ? min(400, t) : 0;
  if(ci <= 35000) t = max(0, t - 400);
  lines.push(bands(L('myTax', 'Income tax, resident rates', t, 'tax', 'lhdn', 'secondary', F), ci, MY_BR,
    { adj: [['Less the rebate (chargeable income 35,000 or less)', ci <= 35000 ? -400 : 0]] }));
  if(rebate) lines.push(L('myRebate', 'Rebate (400 when chargeable income is 35,000 or less), inside the tax above', rebate, 'credit', 'lhdn', 'secondary', F));
  return finish(g, lines, { taxable: ci });
}

/* ════════════════════════════ NL 2026 ═══════════════════════════════════ */
function nl(g0, k){
  const F = '1 Jan 2026', lines = [];
  const g = k.nlHoliday ? g0*1.08 : g0;
  if(k.nlHoliday) lines.push(inGroup(L('nlHol', 'Holiday allowance (8%), paid on top', g - g0, 'info', 'nl', 'official', F), 'gross'));
  const pension = (+k.nlPension || 0)/100*g;
  if(pension) lines.push(minus(L('nlPens', 'Pension contribution, employee', pension, 'social', 'spec', 'assumption', F)));
  const norm = k.nlNorm === 'young' ? 36497 : 48013;
  const free = k.nlRuling ? max(0, min(0.30*g, g - norm, 78600)) : 0;
  if(k.nlRuling) lines.push(minus(L('nlFree', '30% ruling, tax-free allowance', free, 'deduction', 'nl', 'official', F)));
  const x = g - free - pension;
  const NL_BR = [[38883,.3575],[78426,.3756],[null,.495]], box1 = prog(x, NL_BR);
  const ahk = x <= 29736 ? 3115 : (x < 78426 ? max(0, 3115 - 0.06398*(x - 29736)) : 0);
  let ak;
  if(x < 11965) ak = 0.08324*x;
  else if(x < 25845) ak = 996 + 0.31009*(x - 11965);
  else if(x < 45592) ak = 5300 + 0.01950*(x - 25845);
  else if(x < 132920) ak = max(0, 5685 - 0.06510*(x - 45592));
  else ak = 0;
  lines.push(bands(L('nlBox1', 'Box 1 income tax and national insurance', max(0, box1 - ahk - ak), 'tax', 'nl', 'official', F), x, NL_BR,
    { adj: [['Less the general tax credit', -ahk], ['Less the labour tax credit', -ak]] }));
  if(ahk) lines.push(L('nlAhk', 'General tax credit, inside the tax above', ahk, 'credit', 'nl', 'official', F));
  if(ak) lines.push(L('nlAk', 'Labour tax credit, inside the tax above', ak, 'credit', 'nl', 'official', F));
  return finish(g, lines, { taxable: x, entered: g0 });
}

/* ════════════════════════════ NO 2026 ═══════════════════════════════════ */
function no(g, k){
  const F = '1 Jan 2026', lines = [];
  if(k.noRes === 'paye'){
    if(g > 725050) return NS('The PAYE scheme is only open up to 725,050 a year.');
    const r = k.noNi === false ? 0.174 : 0.25;
    lines.push(L('noPaye', 'PAYE scheme (' + (r*100).toFixed(1).replace('.0', '') + '% of gross, final)', r*g, 'tax', 'no', k.noNi === false ? 'secondary' : 'official', F));
    return finish(g, lines, { taxable: g });
  }
  const msd = min(0.46*g, 95700), ti = max(0, g - msd - 114540);
  lines.push(minus(L('noMsd', 'Minimum standard deduction and personal allowance', msd + 114540, 'deduction', 'no', 'official', F)));
  lines.push(L('noIt', 'Tax on ordinary income (22%)', 0.22*ti, 'tax', 'no', 'official', F));
  const NO_TRINN = [[226100,0],[318300,.017],[725050,.04],[980100,.137],[1467200,.168],[null,.178]];
  lines.push(bands(L('noTrinn', 'Bracket tax (trinnskatt)', prog(g, NO_TRINN), 'tax', 'no', 'official', F), g, NO_TRINN));
  lines.push(L('noTr', 'National insurance (7.6%)', g <= 99650 ? 0 : min(0.076*g, 0.25*(g - 99650)), 'social', 'no', 'official', F));
  return finish(g, lines, { taxable: ti, taxableLabel: 'Taxable ordinary income' });
}

/* ════════════════════════════ SE 2026 ═══════════════════════════════════ */
const PBB = 59200;
function seGa(ffi){
  const p = PBB; let ga;
  if(ffi <= 0.99*p) ga = 0.423*p;
  else if(ffi <= 2.72*p) ga = 0.423*p + 0.2*(ffi - 0.99*p);
  else if(ffi <= 3.11*p) ga = 0.77*p;
  else if(ffi <= 7.88*p) ga = 0.77*p - 0.1*(ffi - 3.11*p);
  else ga = 0.293*p;
  return Math.ceil(ga/100)*100;
}
function seJsa(ai, ga, ki){
  const p = PBB; let bb;
  if(ai <= 0.91*p) bb = ai;
  else if(ai <= 3.24*p) bb = 0.91*p + 0.3874*(ai - 0.91*p);
  else if(ai <= 8.08*p) bb = 1.813*p + 0.251*(ai - 3.24*p);
  else bb = 3.027*p;
  return max(0, (bb - ga)*ki);
}
function se(g, k){
  const F = '1 Jan 2026', lines = [];
  if(k.seRes === 'sink'){ lines.push(L('seSink', 'SINK, special income tax for non-residents (22.5%)', 0.225*g, 'tax', 'se', 'official', F)); return finish(g, lines, { taxable: g }); }
  const ki = (k.seMun == null ? 30.55 : +k.seMun)/100, burial = (k.seBurial == null ? 0.292 : +k.seBurial)/100;
  const ga = seGa(g), ti = max(0, g - ga);
  const mun = ti*ki, state = 0.20*max(0, ti - 643000);
  const pens = min(0.07*g, 47100), bur = ti*burial, ps = min(0.01*ti, 1184);
  const jsa = seJsa(g, ga, ki), eir = min(1500, max(0, 0.0075*(g - 40000)));
  const red = min(mun + state, pens + jsa + eir);
  lines.push(minus(L('seGa', 'Basic allowance (grundavdrag)', ga, 'deduction', 'se', 'secondary', F)));
  // The reductions come off municipal tax first, then state tax: that is where the cap sits.
  const offMun = min(red, mun), offState = red - offMun;
  lines.push(L('seMun', 'Municipal tax (' + (ki*100).toFixed(2) + '%) after tax reductions', mun - offMun, 'tax', 'se', 'secondary', F));
  if(state) lines.push(bands(L('seState', 'State tax (20% above 643,000)', state - offState, 'tax', 'se', 'official', F), ti, [[643000,0],[null,.20]],
    { adj: [['Less the tax reductions left after the municipal tax', -offState]] }));
  lines.push(L('sePens', 'Pension fee (7%)', pens, 'tax', 'se', 'official', F));
  lines.push(L('seBur', 'Burial fee', bur, 'tax', 'se', 'secondary', F));
  lines.push(L('sePs', 'Public service fee (1%, max 1,184)', ps, 'tax', 'se', 'secondary', F));
  lines.push(L('seRed', 'Tax reductions (pension fee offset, job tax credit, earned income reduction), inside the municipal and state tax above', red, 'credit', 'se', 'secondary', F));
  return finish(g, lines, { taxable: ti, taxableLabel: 'Taxable earned income' });
}

/* ════════════════════════════ EE 2026 ═══════════════════════════════════ */
function ee(g, k){
  const F = '1 Jan 2026', lines = [];
  const p2 = (k.eeP2 == null ? 2 : +k.eeP2)/100;
  const ui = 0.016*g, ii = p2*g, allow = (k.eePension ? 776 : 700)*12;
  lines.push(minus(L('eeUi', 'Unemployment insurance (1.6%)', ui, 'social', 'ee', 'official', F)));
  if(ii) lines.push(minus(L('eeP2', 'Pension pillar II (' + (p2*100) + '%)', ii, 'social', 'ee', 'official', F)));
  lines.push(minus(L('eeAllow', 'Tax-free allowance (' + allow/12 + ' a month)', allow, 'deduction', 'ee', 'official', F)));
  const ti = max(0, g - ui - ii - allow);
  lines.push(L('eeTax', 'Income tax (22%)', 0.22*ti, 'tax', 'ee', 'official', F));
  return finish(g, lines, { taxable: ti });
}

/* ════════════════════════════ FI 2026 ═══════════════════════════════════ */
const FI_STATE = [[22000,.1264],[32600,.19],[40100,.3025],[52100,.3325],[null,.375]];
function fiSocLines(g, lines){
  const F = '1 Jan 2026';
  lines.push(L('fiTyel', 'TyEL pension (7.30%)', 0.073*g, 'social', 'vero', 'official', F));
  lines.push(L('fiUi', 'Unemployment insurance (0.89%)', 0.0089*g, 'social', 'vero', 'secondary', F));
  if(g >= 17255) lines.push(L('fiSick', 'Sickness daily allowance (0.88%)', 0.0088*g, 'social', 'vero', 'official', F));
  return (0.073 + 0.0089 + (g >= 17255 ? 0.0088 : 0))*g;
}
function fi(g, k){
  const F = '1 Jan 2026', lines = [];
  if(k.fiRes === 'key'){
    if(g < 5800*12) return NS('The key employee regime needs pay of at least 5,800 a month (69,600 a year).');
    fiSocLines(g, lines);
    lines.push(L('fiKey', 'Key employee tax (25%, final)', 0.25*g, 'tax', 'vero', 'official', F));
    return finish(g, lines, { taxable: g });
  }
  const mun = (k.fiMun == null ? 5.30 : +k.fiMun)/100, church = (+k.fiChurch || 0)/100;
  const soc = fiSocLines(g, lines), puhdas = g - min(750, g), ti = max(0, puhdas - soc);
  lines.forEach(l => { if(l.kind === 'social') l.base = -1; });   // contributions come off the taxable pay
  lines.push(minus(L('fiTv', 'Deduction for income-earning expenses', min(750, g), 'base', 'vero', 'official', F)));
  const pv = max(0, 4265 - 0.18*max(0, ti - 4265)), mti = max(0, ti - pv);
  const state = prog(ti, FI_STATE), munt = mti*mun, ch = mti*church, shm = 0.011*mti;
  const ttv = min(0.18*g, 3430) - min(311, 0.02*max(0, puhdas - 35000));
  const yle = min(160, 0.025*max(0, puhdas - 15150));
  const total = max(0, state + munt + ch + shm - ttv);
  // The earned income credit comes off the taxes in proportion, as vero.fi spreads it.
  const pre = state + munt + ch + shm, f = pre > 0 ? total/pre : 0;
  lines.push(bands(L('fiState', 'State income tax', state*f, 'tax', 'vero', 'official', F), ti, FI_STATE,
    { adj: [['Less its share of the earned income tax credit', -(state - state*f)]] }));
  lines.push(L('fiMun', 'Municipal tax (' + (mun*100).toFixed(2) + '%)', munt*f, 'tax', 'vero', 'official', F));
  if(ch) lines.push(L('fiChurch', 'Church tax (' + (church*100).toFixed(2) + '%)', ch*f, 'tax', 'vero', 'official', F));
  lines.push(L('fiShm', 'Health care contribution (1.10%)', shm*f, 'tax', 'vero', 'official', F));
  lines.push(L('fiYle', 'Yle tax', yle, 'tax', 'vero', 'official', F));
  if(ttv > 0) lines.push(L('fiTtv', 'Earned income tax credit, spread over the taxes above', min(ttv, pre), 'credit', 'vero', 'official', F));
  return finish(g, lines, { taxable: ti, taxableLabel: 'Taxable earned income, state tax' });
}

/* ════════════════════════════ BE income 2026 ════════════════════════════ */
function beCsssQ(q){
  if(q <= 5836.14) return 0;
  if(q <= 6570.54) return 0.0422*(q - 5836.14);
  if(q <= 11211.00) return 30.99 + 0.011*(q - 6570.54);
  if(q <= 12300.00) return 82.05 + 0.0338*(q - 11211);
  if(q <= 18116.46) return 118.83 + 0.011*(q - 12300);
  return 182.82;
}
function beBonusM(s){
  const bb = s <= 2300.62 ? 171.99 : max(0, 171.99 - 0.2699*(s - 2300.62));
  const a = s <= 2937.93 ? 127.54 : max(0, 127.54 - 0.2739*(s - 2937.93));
  return [a, bb];
}
const BE_BR = [[16720,.25],[29510,.40],[51070,.45],[null,.50]];
const BE_QC_MAX = 11780;
const beFedTax = (ti, free) => max(0, prog(ti, BE_BR) - prog(free == null ? 11550 : free, BE_BR));
const BE_CHILD = [0, 2130, 5130, 11440, 18510];
const beChildSupp = n => n <= 4 ? BE_CHILD[n] : BE_CHILD[4] + 7070*(n - 4);
function be(g, k){
  const F = 'Income 2026', lines = [];
  if(g < 12*2233.61) return NS('Below 12 times the full-time minimum wage (26,803 a year) the employment bonus rules change, and they are not loaded.');
  const municipal = (k.beMun == null ? 7 : +k.beMun)/100, married = k.beStatus === 'married';
  const kids = max(0, floor(+k.beKids || 0));
  const free = (k.beExpat && g > 70000) ? 0.35*g : 0;
  if(k.beExpat && g <= 70000) lines.push(L('beExpNo', 'Expat regime needs gross above 70,000', 0, 'info', 'be', 'secondary', F));
  if(free) lines.push(minus(L('beExp', 'Expat regime, tax and ONSS free reimbursement (35%)', free, 'deduction', 'be', 'secondary', '2026')));
  const w = g - free, m = w/12;
  let [a, bb] = beBonusM(m); a *= 12; bb *= 12;
  const ss = max(0, 0.1307*w - a - bb);
  lines.push(minus(L('beOnss', 'Social security (ONSS, 13.07%)' + (a + bb > 0 ? ' after the employment bonus' : ''), ss, 'social', 'onss', 'secondary', '1 Sep 2026')));
  const net = w - ss, pe = min(0.30*net, 6070), ti = net - pe;
  lines.push(minus(L('bePe', 'Lump-sum professional expenses (30%, max 6,070)', pe, 'deduction', 'be', 'secondary', F)));
  const sp = (k.beSingleParent && kids > 0 && !married) ? 1980 : 0;
  const quota = 11550 + beChildSupp(kids) + sp;
  const bonus = 0.3314*a + 0.63*bb;
  let fed, q = 0;
  if(married){
    q = min(0.30*ti, BE_QC_MAX);
    fed = max(0, beFedTax(ti - q, quota) - bonus) + beFedTax(q);
  } else fed = max(0, beFedTax(ti, quota) - bonus);
  // The federal tax first, then what works inside it.
  lines.push(bands(L('beFed', 'Federal income tax', fed, 'tax', 'be', 'official', F), married ? ti - q : ti, BE_BR,
    { adj: [['Less the tax on the tax-free amount', -prog(quota, BE_BR)], ['Less the fiscal employment bonus', -bonus],
      ['Plus the tax on the marital quotient', married ? beFedTax(q) : 0]] }));
  if(married) lines.push(L('beQc', 'Marital quotient to your partner (30%, max 11,780), inside the tax above', q, 'deduction', 'be', 'secondary', F));
  lines.push(L('beQuota', 'Tax-free amount' + (kids || sp ? ' with child supplements' : '') + ', inside the tax above', quota, 'deduction', 'be', kids || sp ? 'secondary' : 'official', F));
  if(bonus > 0) lines.push(L('beFb', 'Fiscal employment bonus, inside the tax above', bonus, 'credit', 'onss', 'secondary', '1 Sep 2026'));
  lines.push(L('beMun', 'Municipal surcharge (' + (municipal*100).toFixed(2).replace(/\.?0+$/, '') + '%)', fed*municipal, 'tax', 'be', 'secondary', F));
  lines.push(L('beCsss', 'Special social security contribution (CSSS)', 4*beCsssQ(g/4), 'social', 'onss', 'secondary', F));
  return finish(g, lines, { taxable: ti });
}

/* ════════════════════════════ IT 2026 (Milan) ═══════════════════════════ */
function itDetr(r){
  let d;
  if(r <= 15000) d = 1955;
  else if(r <= 28000) d = 1910 + 1190*(28000 - r)/13000;
  else if(r <= 50000) d = 1910*(50000 - r)/22000;
  else d = 0;
  if(r > 25000 && r <= 35000) d += 65;
  return d;
}
function it(g, k){
  const F = '1 Jan 2026', lines = [];
  const imp = k.itImp === 'imp60' ? 0.6 : k.itImp === 'imp50' ? 0.5 : 0;
  const inps = 0.0919*min(g, 122295) + 0.01*max(0, min(g, 122295) - 56224);
  lines.push(minus(L('itInps', 'INPS (9.19%, +1% above 56,224)', inps, 'social', 'inps', 'official', F)));
  const full = g - inps;
  let r = full*(1 - imp);
  if(imp){
    const excl = min(full*imp, 600000);   // excluded income capped at 600,000
    r = full - excl;
    lines.push(minus(L('itImpEx', 'Impatriate regime, excluded share (' + imp*100 + '%)', excl, 'deduction', 'it', 'secondary', F)));
  }
  const IRPEF = [[28000,.23],[50000,.33],[null,.43]], REG_LO = [[15000,.0123],[28000,.0158],[50000,.0172],[null,.0173]];
  const irpef = prog(r, IRPEF);
  const cuneoDet = (r > 20000 && r <= 32000) ? 1000 : (r > 32000 && r < 40000 ? 1000*(40000 - r)/8000 : 0);
  const cuneoBonus = r <= 20000 ? r*(r <= 8500 ? 0.071 : r <= 15000 ? 0.053 : 0.048) : 0;
  const detr = itDetr(r);
  const irpefNet = max(0, irpef - detr - cuneoDet);
  const reg = prog(r, REG_LO);
  const com = r > 23000 ? r*0.008 : 0;
  lines.push(bands(L('itIrpef', 'IRPEF, after the employment credit' + (cuneoDet ? ' and cuneo credit' : ''), irpefNet, 'tax', 'it', 'official', F), r, IRPEF,
    { adj: [['Less the employment credit', -detr], ['Less the cuneo credit', -cuneoDet]] }));
  if(detr + cuneoDet > 0) lines.push(L('itDetr', 'Employment credit' + (cuneoDet ? ' and cuneo credit' : '') + ', inside IRPEF', min(irpef, detr + cuneoDet), 'credit', 'it', imp ? 'assumption' : 'secondary', F));
  lines.push(bands(L('itReg', 'Lombardy regional surtax', reg, 'tax', 'it', 'official', F), r, REG_LO));
  lines.push(L('itCom', 'Milan municipal surtax (0.8% above 23,000)', com, 'tax', 'it', 'official', F));
  if(cuneoBonus) lines.push(L('itBonus', 'Cuneo fiscale bonus, tax-free cash', cuneoBonus, 'benefit', 'it', 'secondary', F));
  const notes = imp ? ['Tax credits are worked out on the reduced income. Confirm with your payroll provider.'] : [];
  return finish(g, lines, { taxable: r, notes });
}

/* ════════════════════════════ CH-ZH 2026 ════════════════════════════════ */
const CH_DBST_S = [[15200,0,0.77],[33200,138.60,0.88],[43500,229.20,2.64],[58000,612.00,2.97],[76200,1152.50,5.94],
  [82100,1502.95,6.60],[108900,3271.75,8.80],[141500,6140.55,11.00],[185100,10936.55,13.20]];
const CH_DBST_M = [[29700,0,1],[53400,237,2],[61300,395,3],[79100,929,4],[94900,1561,5],[108700,2251,6],[120600,2965,7],
  [130500,3658,8],[138400,4290,9],[144300,4821,10],[148300,5221,11],[150400,5452,12],[152400,5692,13]];
function chDbstSingle(x){
  x = floor(x/100)*100;
  const pts = CH_DBST_S;
  if(x <= 15200) return 0;
  if(x >= 794000) return 0.115*x;
  let p = pts[0]; for(const q of pts) if(q[0] <= x) p = q;
  return p[1] + (x - p[0])/100*p[2];
}
function chDbstMarried(x){
  x = floor(x/100)*100;
  const pts = CH_DBST_M;
  if(x < 29700) return 0;
  if(x >= 941400) return 0.115*x;
  let p = pts[0]; for(const q of pts) if(q[0] <= x) p = q;
  return p[1] + (x - p[0])/100*p[2];
}
const ZH_GRUND = [[7000,0],[12000,.02],[16800,.03],[24800,.04],[34500,.05],[45700,.06],[58800,.07],[76400,.08],[110400,.09],[144100,.10],[197400,.11],[266700,.12],[null,.13]];
const ZH_VERH = [[14100,0],[20500,.02],[28600,.03],[38400,.04],[49600,.05],[64100,.06],[96300,.07],[128700,.08],[177200,.09],[235100,.10],[298000,.11],[370600,.12],[null,.13]];
const CH_BVG = { '25': .035, '35': .05, '45': .075, '55': .09 };
function ch(g, k){
  const F = '1 Jan 2026', lines = [];
  const bvgHalf = CH_BVG[k.chAge] != null ? CH_BVG[k.chAge] : .05;
  const nbu = (k.chNbu == null ? 0.4 : +k.chNbu)/100, gem = (k.chCommune == null ? 119 : +k.chCommune)/100;
  const church = k.chChurch ? 0.10 : 0, married = k.chStatus === 'married', kids = married ? max(0, floor(+k.chKids || 0)) : 0;
  const ahv = 0.053*g, alv = 0.011*min(g, 148200), nbuv = nbu*min(g, 148200);
  let coord = g >= 22680 ? max(0, min(g, 90720) - 26460) : 0;
  coord = min(max(coord, g >= 22680 ? 3780 : 0), 64260);
  const bvg = bvgHalf*coord;
  lines.push(minus(L('chAhv', 'AHV/IV/EO (5.30%)', ahv, 'social', 'estv', 'secondary', F)));
  lines.push(minus(L('chAlv', 'Unemployment insurance ALV (1.10%)', alv, 'social', 'estv', 'secondary', F)));
  if(nbuv) lines.push(minus(L('chNbu', 'Non-occupational accident insurance NBU', nbuv, 'social', 'estv', 'secondary', F)));
  if(bvg) lines.push(minus(L('chBvg', 'Occupational pension BVG, employee half', bvg, 'social', 'estv', 'secondary', F)));
  const soc = ahv + alv + nbuv + bvg, netinc = g - soc;
  const beruf = min(max(0.03*netinc, 2000), 4000);
  let tiK, tiB, fed, e, personal;
  if(married){
    tiK = netinc - beruf - 5800 - 1300*kids - 9400*kids;
    tiB = netinc - beruf - 3700 - 700*kids - 2800 - 6800*kids;
    fed = max(0, chDbstMarried(tiB) - 263*kids); if(fed < 25) fed = 0;
    e = prog(floor(max(0, tiK)/100)*100, ZH_VERH); personal = 48;
  } else {
    tiK = netinc - beruf - 2900; tiB = netinc - beruf - 1800;
    fed = chDbstSingle(tiB);
    e = prog(floor(tiK/100)*100, ZH_GRUND); personal = 24;
  }
  // The steps to the cantonal taxable income (the federal one differs a little).
  lines.push(minus(L('chBeruf', 'Professional expenses (3%, 2,000 to 4,000)', beruf, 'base', 'zh', 'secondary', F)));
  lines.push(minus(L('chIns', 'Insurance premium deduction', married ? 5800 + 1300*kids : 2900, 'base', 'zh', 'secondary', F)));
  if(kids) lines.push(minus(L('chKidDed', 'Child deduction', 9400*kids, 'base', 'zh', 'secondary', F)));
  // The cantonal, communal and church taxes are each a share of one simple tax: each line's
  // brackets are the simple tax's, at the rate times that share.
  const zhX = married ? floor(max(0, tiK)/100)*100 : floor(tiK/100)*100, zhBr = married ? ZH_VERH : ZH_GRUND;
  const zh = (l, mult) => bands(l, zhX, zhBr, { mult, restLabel: 'Rounding' });
  lines.push(zh(L('chKant', 'Canton of Zurich tax (95% of the simple tax)', e*0.95, 'tax', 'zh', 'official', F), 0.95));
  lines.push(zh(L('chGem', 'Communal tax (' + (gem*100).toFixed(0) + '% of the simple tax)', e*gem, 'tax', 'zh', 'official', F), gem));
  if(church) lines.push(zh(L('chKirche', 'Church tax (10% of the simple tax)', e*church, 'tax', 'zh', 'secondary', F), church));
  lines.push(L('chPers', 'Personal tax', personal, 'tax', 'zh', 'secondary', F));
  const fedL = L('chBund', 'Federal tax (DBST)' + (kids ? ', after 263 a child' : ''), fed, 'tax', 'estv', 'official', F);
  const fedX = floor(max(0, tiB)/100)*100;
  // Above the top point the federal tax is 11.5% of all the income, not a bracket: that line stands alone.
  lines.push(fedX >= (married ? 941400 : 794000) ? fedL : bands(fedL, fedX, ptsBr(married ? CH_DBST_M : CH_DBST_S),
    { adj: [['Less 263 a child', -263*kids]], restLabel: 'Rounding, and no federal tax below 25' }));
  lines.push(inGroup(L('chKvg', 'Health insurance (KVG) is a private premium, not included', 0, 'info', 'estv', 'official', F), 'social'));
  const notes = [];
  if(!married && g > 110000 && g < 130000) notes.push('One cantonal comparison read about 1.6% less tax near 120,000. Not yet resolved against the Kanton Zürich calculator.');
  return finish(g, lines, { taxable: max(0, tiK), taxableLabel: 'Taxable income, canton of Zurich', notes });
}

/* ════════════════════════════ FR 2026 ═══════════════════════════════════ */
const PASS_FR = 48060;
const FR_BR = [[11600,0],[29579,.11],[84577,.30],[181917,.41],[null,.45]];
function frSteps(nt, parts, baseParts){
  const tq = prog(nt/parts, FR_BR)*parts;
  const tBase = prog(nt/baseParts, FR_BR)*baseParts;
  const capped = max(tq, tBase - 1807*2*(parts - baseParts));
  const [decLim, decK] = baseParts === 1 ? [897, 1982] : [1483, 3277];
  const t = capped < decK ? max(0, capped - (decLim - 0.4525*capped)) : capped;
  return { tq, capped, t };
}
function frTax(nt, parts, baseParts){ return frSteps(nt, parts, baseParts).t; }
function fr(g, k){
  const F = '1 Jan 2026', lines = [];
  const cadre = k.frCadre === 'cadre', married = !!k.frMarried, kids = max(0, floor(+k.frKids || 0));
  const baseParts = married ? 2 : 1, parts = baseParts + 0.5*min(kids, 2) + max(0, kids - 2);
  const t1 = min(g, PASS_FR), t2 = max(0, min(g, 8*PASS_FR) - PASS_FR);
  const vieil = 0.069*t1 + 0.004*g, aa = 0.0315*t1 + 0.0864*t2, ceg = 0.0086*t1 + 0.0108*t2;
  const cet = g > PASS_FR ? 0.0014*min(g, 8*PASS_FR) : 0, apec = cadre ? 0.00024*min(g, 4*PASS_FR) : 0;
  const csgBase = 0.9825*min(g, 4*PASS_FR) + max(0, g - 4*PASS_FR);
  const csgD = 0.068*csgBase, csgN = 0.029*csgBase;
  lines.push(minus(L('frVieil', 'Old-age insurance (6.90% to the cap, 0.40% on all)', vieil, 'social', 'urssaf', 'secondary', F)));
  lines.push(minus(L('frAa', 'AGIRC-ARRCO supplementary pension', aa, 'social', 'urssaf', 'secondary', F)));
  lines.push(minus(L('frCeg', 'CEG general balance contribution', ceg, 'social', 'urssaf', 'secondary', F)));
  if(cet) lines.push(minus(L('frCet', 'CET technical balance contribution (0.14%)', cet, 'social', 'urssaf', 'secondary', F)));
  if(apec) lines.push(minus(L('frApec', 'APEC (cadres, 0.024%)', apec, 'social', 'urssaf', 'secondary', F)));
  lines.push(minus(L('frCsgD', 'CSG, deductible (6.8%)', csgD, 'social', 'urssaf', 'secondary', F)));
  lines.push(L('frCsgN', 'CSG non-deductible and CRDS (2.9%)', csgN, 'social', 'urssaf', 'secondary', F));
  const mut = max(0, +k.frMutuelle || 0);
  if(mut) lines.push(minus(L('frMut', 'Company health and protection cover, your share', mut, 'social', 'spec', 'assumption', F)));
  const ded = vieil + aa + ceg + cet + apec + csgD + mut;
  let ni = g - ded;
  const rfr = ni - min(max(0.10*ni, 509), 14555);
  if(k.frImp){
    lines.push(minus(L('frImpEx', 'Impatriate regime, exempt share (30% forfait)', max(0, ni*0.30), 'deduction', 'legifr', 'official', F)));
    ni = ni*0.70;
  }
  const abat = min(max(0.10*ni, 509), 14555), nt = ni - abat;
  lines.push(minus(L('frAbat', 'Professional expenses deduction (10%)', abat, 'deduction', 'frsp', 'official', F)));
  const frs = frSteps(nt, parts, baseParts), ir = frs.t;
  // The scale applies per part: its brackets, times the number of parts, on the whole income.
  lines.push(bands(L('frIr', 'Income tax (' + parts + ' part' + (parts > 1 ? 's' : '') + ')', ir, 'tax', 'frsp', 'official', F), nt, FR_BR,
    { scale: parts, adj: [['Plus the cap on what the extra parts save', frs.capped - frs.tq], ['Less the décote (low-tax relief)', frs.t - frs.capped]] }));
  // CEHR above RFR 250,000 (single) / 500,000 (joint): 3% then 4%.
  const [c1, c2] = married ? [500000, 1000000] : [250000, 500000];
  const cehr = 0.03*max(0, min(rfr, c2) - c1) + 0.04*max(0, rfr - c2);
  if(cehr > 0) lines.push(L('frCehr', 'High income contribution (CEHR, 3% then 4%)', cehr, 'tax', 'cehr', 'official', F));
  // CDHR: a 20% floor on the average rate above the same thresholds. Its own
  // reductions only lower it, so a case under the floor by this plain test pays none.
  if(rfr > c1 && 0.20*rfr - (ir + cehr) > 0)
    return NS('At this income the 20% minimum tax (CDHR) may apply, and its reductions are not loaded.');
  return finish(g, lines, { taxable: max(0, nt), taxableLabel: 'Net taxable income', rfr });
}

/* ════════════════════════════ ES 2026 (Madrid) ══════════════════════════ */
const ES_STATE = [[12450,.095],[20200,.12],[35200,.15],[60000,.185],[300000,.225],[null,.245]];
const ES_MAD = [[13362.22,.085],[19004.63,.107],[35425.68,.128],[57320.40,.174],[null,.205]];
function esArt20(rn){
  if(rn <= 14852) return 7302;
  if(rn <= 17673.52) return 7302 - 1.75*(rn - 14852);
  if(rn < 19747.5) return 2364.34 - 1.14*(rn - 17673.52);
  return 0;
}
function esSmi(g){ if(g <= 17094) return 590.89; if(g < 20048.45) return 590.89 - 0.2*(g - 17094); return 0; }
function es(g, k){
  const F = '1 Jan 2026', lines = [];
  const rate = k.esTemp ? 0.0655 : 0.065;
  const ss = rate*min(g, 12*5101.20);
  lines.push(L('esSs', 'Social security (' + (rate*100).toFixed(2) + '%, base cap 5,101.20 a month)', ss, 'social', 'segsoc', 'official', F));
  if(k.esRegime === 'beckham'){
    lines.push(bands(L('esBeck', 'Beckham regime (24% to 600,000, 47% above)', 0.24*min(g, 600000) + 0.47*max(0, g - 600000), 'tax', 'aeat', 'secondary', F), g, [[600000,.24],[null,.47]]));
    return finish(g, lines, { taxable: g });
  }
  lines[0].base = -1;   // social security comes off the work income
  const kids = max(0, floor(+k.esKids || 0));
  const rn = g - ss, a20 = esArt20(rn), base = max(0, rn - 2000 - a20);
  const stK = [0, 2400, 5100, 9100], mdK = [0, 2575.85, 5473.68, 9873.68];
  const stMin = 5550 + (kids <= 3 ? stK[kids] : 9100 + 4500*(kids - 3));
  const mdMin = 5956.65 + (kids <= 3 ? mdK[kids] : 9873.68 + 4950*(kids - 3));
  const st = max(0, prog(base, ES_STATE) - prog(stMin, ES_STATE));
  const md = max(0, prog(base, ES_MAD) - prog(mdMin, ES_MAD));
  const smi = min(st + md, esSmi(g));
  lines.push(minus(L('esOther', 'Other expenses (2,000)', 2000, 'deduction', 'aeat', 'official', F)));
  if(a20) lines.push(minus(L('esArt20', 'Reduction for work income (Art. 20)', a20, 'deduction', 'aeat', 'official', F)));
  // The SMI deduction comes off the state share first, then Madrid's.
  const offSt = min(st, smi), offMd = smi - offSt;
  lines.push(bands(L('esState', 'IRPF, state share', st - offSt, 'tax', 'aeat', 'secondary', F), base, ES_STATE,
    { adj: [['Less the tax on the personal and family minimum', -prog(stMin, ES_STATE)], ['Less the minimum wage deduction (SMI)', -offSt]] }));
  lines.push(bands(L('esMad', 'IRPF, Madrid share', md - offMd, 'tax', 'madrid', 'secondary', F), base, ES_MAD,
    { adj: [['Less the tax on the personal and family minimum', -prog(mdMin, ES_MAD)], ['Less the minimum wage deduction (SMI)', -offMd]] }));
  if(smi) lines.push(L('esSmi', 'Minimum wage deduction (SMI), inside the IRPF', smi, 'credit', 'aeat', 'official', F));
  return finish(g, lines, { taxable: base });
}

/* ════════════════════════════ PT 2026 (mainland) ════════════════════════ */
const PT_BR = [[8342,.122],[12587,.152],[17838,.207],[23089,.236],[29397,.306],[43090,.346],[46566,.431],[86634,.446],[null,.48]];
const PT_IAS = 537.13, PT_VR = max(12880, 1.5*14*PT_IAS), PT_LDG = 250, PT_T1 = 0.122, PT_LIM1 = 8342;
const PT_L = PT_VR - PT_LDG/(PT_T1*3.60) + PT_LIM1/3.60;
function ptMinimo(gross, de){
  if(gross > 2.2*14*PT_IAS) return 0;
  let a;
  if(gross <= PT_VR) a = PT_VR - (de + PT_LDG/PT_T1);
  else if(gross <= PT_L) a = PT_VR - 2.60*(gross - PT_VR) - (de + PT_LDG/PT_T1);
  else a = PT_L - PT_LIM1 - 1.35*(gross - PT_L) - de;
  return min(max(0, a), max(0, gross - de));
}
function ptDependants(ages){
  let d = 0;
  ages.slice().sort((x, y) => y - x).forEach((a, i) => { d += i === 0 ? (a <= 3 ? 726 : 600) : (a <= 6 ? 900 : 600); });
  return d;
}
function ptExpenses(col, health, education, rent, nDep){
  const raw = min(0.15*health, 1000) + min(0.30*education, 800) + min(0.15*rent, 900);
  if(col <= 8342) return raw;
  let cap = col >= 80000 ? 1000 : 2500 - 1500*(col - 8342)/(80000 - 8342);
  if(nDep >= 3) cap *= 1 + 0.05*nDep;
  return min(raw, cap);
}
// Dependants come in as three counts; the oldest-first order is all the rule needs.
function ptAges(k){
  const out = [];
  for(let i = 0; i < (+k.ptDepOld || 0); i++) out.push(10);
  for(let i = 0; i < (+k.ptDepMid || 0); i++) out.push(5);
  for(let i = 0; i < (+k.ptDepYoung || 0); i++) out.push(2);
  return out;
}
function pt(g, k){
  const F = '1 Jan 2026', lines = [];
  const ss = 0.11*g;
  lines.push(L('ptSs', 'Social security (11%)', ss, 'social', 'ptat', 'official', F));
  lines.push(L('ptEr', 'Employer social security (23.75%), on top', 0.2375*g, 'employer', 'ptat', 'official', F));
  if(k.ptRegime === 'nonres'){ lines.push(L('ptNr', 'IRS, non-resident (25% flat)', 0.25*g, 'tax', 'ptat', 'secondary', F)); return finish(g, lines, { taxable: g }); }
  if(k.ptRegime === 'ifici'){ lines.push(L('ptIfici', 'IRS, IFICI regime (20% flat)', 0.20*g, 'tax', 'ptat', 'secondary', F)); return finish(g, lines, { taxable: g }); }
  let ex = 0;
  const yr = clamp(floor(+k.ptJovemYear || 1), 1, 10);
  if(k.ptRegime === 'jovem'){
    const pct = yr === 1 ? 1 : yr <= 4 ? .75 : yr <= 7 ? .5 : .25;
    ex = min(pct*g, 29542.15);
    lines.push(minus(L('ptJovem', 'IRS Jovem exempt share (year ' + yr + ', ' + pct*100 + '%)', ex, 'deduction', 'ptat', 'secondary', F)));
  }
  const gi = g - ex, de = max(4587.09, ss), mn = ptMinimo(g, de);
  const col = max(0, gi - de - mn);
  lines.push(minus(L('ptDe', 'Specific deduction', de, 'deduction', 'ptat', 'secondary', F)));
  if(mn) lines.push(minus(L('ptMin', 'Subsistence minimum (mínimo de existência)', mn, 'deduction', 'ptat', 'official', F)));
  const scale = prog(col, PT_BR), solid = 0.025*max(0, min(col, 250000) - 80000) + 0.05*max(0, col - 250000);
  const ages = ptAges(k);
  const coleta = clamp(k.ptColeta == null ? 250 : +k.ptColeta, 0, 250);
  const deps = ptDependants(ages), exps = ptExpenses(col, +k.ptHealth || 0, +k.ptEdu || 0, +k.ptRent || 0, ages.length);
  const credits = coleta + deps + exps;
  const t = max(0, scale + solid - credits);
  const offScale = min(scale, credits);
  lines.push(bands(L('ptIrs', 'IRS, after deductions from tax', scale - offScale, 'tax', 'ptat', 'official', F), col, PT_BR,
    { adj: [['Less the deductions from tax', -offScale]] }));
  if(solid) lines.push(bands(L('ptSolid', 'Solidarity surcharge (2.5% above 80,000, 5% above 250,000)', max(0, solid - (credits - offScale)), 'tax', 'ptat', 'official', F),
    col, [[80000,0],[250000,.025],[null,.05]], { adj: [['Less the deductions from tax left over', -(credits - offScale)]] }));
  if(credits && t + credits > 0) lines.push(L('ptCred', 'Deductions from tax (family expenses' + (deps ? ', dependants' : '') + (exps ? ', health, education, rent' : '') + '), inside the tax above', min(credits, scale + solid), 'credit', 'ptded', 'secondary', F));
  return finish(g, lines, { taxable: col });
}

/* ════════════════════════════ JP 2026 (Tokyo) ═══════════════════════════ */
const JP_GRADES_H = [[63000,58000],[73000,68000],[83000,78000],[93000,88000],[101000,98000],[107000,104000],[114000,110000],[122000,118000],[130000,126000],[138000,134000],[146000,142000],[155000,150000],[165000,160000],[175000,170000],[185000,180000],[195000,190000],[210000,200000],[230000,220000],[250000,240000],[270000,260000],[290000,280000],[310000,300000],[330000,320000],[350000,340000],[370000,360000],[395000,380000],[425000,410000],[455000,440000],[485000,470000],[515000,500000],[545000,530000],[575000,560000],[605000,590000],[635000,620000],[665000,650000],[695000,680000],[730000,710000],[770000,750000],[810000,790000],[855000,830000],[905000,880000],[955000,930000],[1005000,980000],[1055000,1030000],[1115000,1090000],[1175000,1150000],[1235000,1210000],[1295000,1270000],[1355000,1330000],[null,1390000]];
function jpGrade(m){ for(const [up, std] of JP_GRADES_H) if(up == null || m < up) return std; }
function jpR(x){ const f = floor(x); return x - f > 0.5 ? f + 1 : f; }
function jpEmpDed(g){
  if(g <= 2200000) return 740000;
  if(g <= 3600000) return 0.30*g + 80000;
  if(g <= 6600000) return 0.20*g + 440000;
  if(g <= 8500000) return 0.10*g + 1100000;
  return 1950000;
}
function jpBasic(ti){
  for(const [up, d] of [[4890000,1040000],[6550000,670000],[23500000,620000],[24000000,480000],[24500000,320000],[25000000,160000]]) if(ti <= up) return d;
  return 0;
}
const JP_BR = [[1950000,.05,0],[3300000,.10,97500],[6950000,.20,427500],[9000000,.23,636000],[18000000,.33,1536000],[40000000,.40,2796000],[null,.45,4796000]];
function jpNat(ti){ ti = floor(ti/1000)*1000; for(const [up, r, d] of JP_BR) if(up == null || ti <= up) return max(0, ti*r - d); }
function jp(g, k){
  const F = 'Apr 2026', lines = [], m = g/12;
  const care = !!k.jpCare, months = +k.jpSupport === 9 ? 9 : 12;
  const sh = jpGrade(m), sp = min(max(sh, 88000), 650000);
  const health = 12*jpR(sh*(0.04925 + (care ? 0.0081 : 0))), pension = 12*jpR(sp*0.0915), emp = 12*jpR(m*0.005), support = months*jpR(sh*0.00115);
  lines.push(L('jpHealth', 'Health insurance' + (care ? ' with long-term care' : ''), health, 'social', 'kyokai', 'official', F));
  lines.push(L('jpSupport', 'Child-support levy (from April 2026 wages)', support, 'social', 'kyokai', 'official', F));
  lines.push(L('jpPension', 'Employees\' pension (9.15%)', pension, 'social', 'kyokai', 'official', F));
  lines.push(L('jpEi', 'Employment insurance (0.5%)', emp, 'social', 'kyokai', 'secondary', F));
  const soc = health + pension + emp + support;
  if(k.jpRes === 'nonres'){
    lines.push(L('jpNr', 'Income tax, non-resident (20.42%, final)', floor(0.2042*g), 'tax', 'nta', 'official', F));
    return finish(g, lines, { taxable: g });
  }
  const kyuyo = g - jpEmpDed(g);
  lines.forEach(l => { if(l.kind === 'social') l.base = -1; });   // social insurance comes off the taxable pay
  lines.push(minus(L('jpEmpDed', 'Employment income deduction', jpEmpDed(g), 'deduction', 'nta', 'official', F)));
  lines.push(minus(L('jpBasic', 'Basic deduction, national tax', jpBasic(kyuyo), 'base', 'nta', 'official', F)));
  const jti = floor(max(0, kyuyo - soc - jpBasic(kyuyo))/1000)*1000, itx = floor(jpNat(jti)*1.021/100)*100;
  lines.push(bands(L('jpIt', 'National income tax with reconstruction surtax', itx, 'tax', 'nta', 'official', F), jti, plainBr(JP_BR),
    { adj: [['Plus the reconstruction surtax (2.1%)', 0.021*jpNat(jti)]], restLabel: 'Rounding (income to 1,000, tax down to 100)' }));
  if(k.jpRes !== 'y1'){
    const ti = floor(max(0, kyuyo - soc - 430000)/1000)*1000;
    const rt = floor(max(0, ti*0.06 - 1500)/100)*100 + floor(max(0, ti*0.04 - 1000)/100)*100 + 5000;
    lines.push(L('jpRt', 'Resident tax (10% and per-capita levy)', rt, 'tax', 'nta', 'secondary', F));
  } else lines.push(inGroup(L('jpRtNone', 'No resident tax in the first year (it follows last year\'s income)', 0, 'info', 'nta', 'official', F), 'tax'));
  return finish(g, lines, { taxable: max(0, kyuyo - soc - jpBasic(kyuyo)), taxableLabel: 'Taxable income, national tax' });
}

/* ════════════════════════════ KR 2026 ═══════════════════════════════════ */
function krDed(g){
  let d;
  if(g <= 5e6) d = 0.70*g;
  else if(g <= 15e6) d = 3.5e6 + 0.40*(g - 5e6);
  else if(g <= 45e6) d = 7.5e6 + 0.15*(g - 15e6);
  else if(g <= 100e6) d = 12e6 + 0.05*(g - 45e6);
  else d = 14.75e6 + 0.02*(g - 100e6);
  return min(d, 20e6);
}
const KR_BR = [[14e6,.06,0],[50e6,.15,1.26e6],[88e6,.24,5.76e6],[150e6,.35,15.44e6],[300e6,.38,19.94e6],[500e6,.40,25.94e6],[1e9,.42,35.94e6],[null,.45,65.94e6]];
function krTax(bb){ for(const [up, r, d] of KR_BR) if(up == null || bb <= up) return max(0, bb*r - d); }
function krCredit(tax, g){
  const c = tax <= 1.3e6 ? 0.55*tax : 715000 + 0.30*(tax - 1.3e6);
  let cap;
  if(g <= 33e6) cap = 740000;
  else if(g <= 70e6) cap = max(660000, 740000 - (g - 33e6)*0.008);
  else if(g <= 120e6) cap = max(500000, 660000 - (g - 70e6)*0.5);
  else cap = max(200000, 500000 - (g - 120e6)*0.5);
  return min(c, cap);
}
function kr(g, k){
  const F = '1 Jan 2026', lines = [], m = g/12;
  const nps = 6*0.0475*min(m, 6.37e6) + 6*0.0475*min(m, 6.59e6), hi = 0.03595*g, ltc = hi*0.1314, ei = 0.009*g;
  lines.push(L('krNps', 'National pension (4.75%, cap rises 1 Jul)', nps, 'social', 'nps', 'secondary', F));
  lines.push(L('krHi', 'Health insurance (3.595%)', hi, 'social', 'nps', 'official', F));
  lines.push(L('krLtc', 'Long-term care (13.14% of health)', ltc, 'social', 'nps', 'official', F));
  lines.push(L('krEi', 'Employment insurance (0.9%)', ei, 'social', 'nps', 'secondary', F));
  const soc = nps + hi + ltc + ei;
  let t, taxable;
  if(k.krMethod === 'flat'){ t = 0.19*g; taxable = g; }
  else {
    const persons = 1 + max(0, floor(+k.krDeps || 0));
    taxable = max(0, g - krDed(g) - 1.5e6*persons - soc);
    lines.forEach(l => { if(l.kind === 'social') l.base = -1; });   // social insurance comes off the taxable pay
    lines.push(minus(L('krDed', 'Earned income deduction', krDed(g), 'deduction', 'nts', 'secondary', F)));
    lines.push(minus(L('krPers', 'Basic deduction (1.5 million a person)', 1.5e6*persons, 'base', 'nts', 'secondary', F)));
    const raw = krTax(taxable), cr = krCredit(raw, g);
    t = max(0, raw - cr);
    if(cr > 0) lines.push(L('krCr', 'Earned income tax credit, inside the tax', min(cr, raw), 'credit', 'nts', 'secondary', F));
  }
  const krL = L('krTax', k.krMethod === 'flat' ? 'National income tax, 19% flat election' : 'National income tax', t, 'tax', 'nts', 'secondary', F);
  lines.push(k.krMethod === 'flat' ? krL : bands(krL, taxable, plainBr(KR_BR), { adj: [['Less the earned income tax credit', -krCredit(krTax(taxable), g)]] }));
  lines.push(L('krLocal', 'Local income tax (10% of national)', t*0.1, 'tax', 'nts', 'secondary', F));
  return finish(g, lines, { taxable });
}

/* ════════════════════════════ CA 2026 ═══════════════════════════════════ */
const FED_CA = [[58523,.14],[117045,.205],[181440,.26],[258482,.29],[null,.33]];
const ON_BR = [[53891,.0505],[107785,.0915],[150000,.1116],[220000,.1216],[null,.1316]];
const BC_BR = [[50363,.056],[100728,.077],[115648,.105],[140430,.1229],[190405,.147],[265545,.168],[null,.205]];
const AB_BR = [[61200,.08],[154259,.10],[185111,.12],[246813,.13],[370220,.14],[null,.15]];
const QC_BR = [[54345,.14],[108680,.19],[132245,.24],[null,.2575]];
function caOhp(ti){
  if(ti <= 20000) return 0;
  if(ti <= 36000) return min(300, 0.06*(ti - 20000));
  if(ti <= 48000) return min(450, 300 + 0.06*(ti - 36000));
  if(ti <= 72000) return min(600, 450 + 0.25*(ti - 48000));
  if(ti <= 200000) return min(750, 600 + 0.25*(ti - 72000));
  return min(900, 750 + 0.25*(ti - 200000));
}
const caFedBpa = ti => ti <= 181440 ? 16452 : max(14829, 16452 - (ti - 181440)*(16452 - 14829)/(258482 - 181440));
const caFedCr = (g, ti, base, ei, extra) => 0.14*(caFedBpa(ti) + min(1501, g) + base + ei + (extra || 0));
function caFed(g, ti, base, ei, extra){ return max(0, prog(ti, FED_CA) - caFedCr(g, ti, base, ei, extra)); }
const CA_FED_CR = 'Less the federal credits at 14% (basic personal amount, CPP, EI, Canada employment)';
function ca(g, k){
  const F = '1 Jan 2026', lines = [], prov = k.caProv || 'ON';
  if(prov === 'QC'){
    const qpp = 0.063*max(0, min(g, 74600) - 3500), qpp2 = 0.04*max(0, min(g, 85000) - 74600);
    const ei = 0.013*min(g, 68900), qpip = 0.0043*min(g, 103000);
    const enh = qpp/6.3, base = qpp - enh, ti = g - enh - qpp2;
    const fed = caFed(g, ti, base, ei, qpip)*(1 - 0.165);
    const wd = min(0.06*g, 1450), qc = max(0, prog(ti - wd, QC_BR) - 0.14*18952);
    lines.push(L('caQpp', 'QPP (6.30%)', qpp, 'social', 'rq', 'official', F));
    lines.push(minus(L('caQppEnh', 'Enhanced QPP (the top 1%), deductible', enh, 'base', 'rq', 'official', F)));
    if(qpp2) lines.push(minus(L('caQpp2', 'QPP2 (4%)', qpp2, 'social', 'rq', 'official', F)));
    lines.push(L('caEi', 'EI, Quebec rate (1.30%)', ei, 'social', 'cra', 'official', F));
    lines.push(L('caQpip', 'QPIP (0.430%)', qpip, 'social', 'rq', 'official', F));
    const fed0 = caFed(g, ti, base, ei, qpip);
    lines.push(bands(L('caFed', 'Federal tax, after the 16.5% Quebec abatement', fed, 'tax', 'cra', 'secondary', F), ti, FED_CA,
      { adj: [['Less the federal credits at 14% (basic personal amount, QPP, EI, QPIP, Canada employment)', -caFedCr(g, ti, base, ei, qpip)], ['Less the Quebec abatement (16.5%)', -0.165*fed0]] }));
    lines.push(bands(L('caQc', 'Quebec income tax', qc, 'tax', 'rq', 'official', F), ti - wd, QC_BR,
      { adj: [['Less the basic personal credit (14% of 18,952)', -0.14*18952]] }));
    lines.push(L('caQcWd', 'Deduction for workers (6%, max 1,450), inside the Quebec tax above', wd, 'deduction', 'rq', 'official', F));
    return finish(g, lines, { taxable: ti, taxableLabel: 'Taxable income, federal', notes: ['The Quebec work premium, solidarity credit and RAMQ drug insurance premium are not included.'] });
  }
  const cpp = 0.0595*max(0, min(g, 74600) - 3500), cpp2 = 0.04*max(0, min(g, 85000) - 74600), ei = 0.0163*min(g, 68900);
  const enh = cpp/5.95, base = cpp - enh, ti = g - enh - cpp2;
  lines.push(L('caCpp', 'CPP (5.95%)', cpp, 'social', 'cra', 'secondary', F));
  lines.push(minus(L('caCppEnh', 'Enhanced CPP (the top 1%), deductible', enh, 'base', 'cra', 'secondary', F)));
  if(cpp2) lines.push(minus(L('caCpp2', 'CPP2 (4%)', cpp2, 'social', 'cra', 'secondary', F)));
  lines.push(L('caEi', 'EI (1.63%)', ei, 'social', 'cra', 'secondary', F));
  const fed = caFed(g, ti, base, ei);
  lines.push(bands(L('caFed', 'Federal income tax', fed, 'tax', 'cra', 'official', F), ti, FED_CA, { adj: [[CA_FED_CR, -caFedCr(g, ti, base, ei)]] }));
  if(prov === 'ON'){
    const kids = max(0, floor(+k.caKids || 0));
    const onCr = 0.0505*(12989 + base + ei);
    let on = max(0, prog(ti, ON_BR) - onCr);
    const sur = 0.20*max(0, on - 5818) + 0.36*max(0, on - 7446);
    on += sur;
    const otr = min(on, max(0, 2*(300 + 554*kids) - on));
    on -= otr;
    const lift = max(0, min(0.0505*g, 875) - 0.05*max(0, ti - 32500));
    const afterLift = max(0, on - lift);
    lines.push(bands(L('caOn', 'Ontario income tax' + (sur ? ' with surtax' : ''), afterLift, 'tax', 'cra', 'official', F), ti, ON_BR,
      { adj: [['Less the Ontario credits at 5.05% (basic personal amount, CPP, EI)', -onCr], ['Plus the Ontario surtax', sur],
        ['Less the Ontario Tax Reduction', -otr], ['Less the LIFT credit', -(on - afterLift)]] }));
    if(otr > 0) lines.push(L('caOtr', 'Ontario Tax Reduction, inside the Ontario tax', otr, 'credit', 'eyon', 'secondary', F));
    if(on - afterLift > 0) lines.push(L('caLift', 'LIFT credit, inside the Ontario tax', on - afterLift, 'credit', 'ontario', 'official', F));
    lines.push(L('caOhp', 'Ontario Health Premium', caOhp(ti), 'tax', 'ontario', 'official', F));
  } else if(prov === 'BC'){
    const bcCr = 0.056*(13216 + base + ei);
    let bc = max(0, prog(ti, BC_BR) - bcCr);
    const red = max(0, 690 - 0.0356*max(0, ti - 25570));
    lines.push(bands(L('caBc', 'British Columbia income tax', max(0, bc - red), 'tax', 'bc', 'official', F), ti, BC_BR,
      { adj: [['Less the BC credits at 5.6% (basic personal amount, CPP, EI)', -bcCr], ['Less the BC tax reduction', -red]] }));
    if(red > 0 && bc > 0) lines.push(L('caBcRed', 'BC tax reduction credit, inside the tax', min(red, bc), 'credit', 'bc', 'official', F));
  } else {
    lines.push(bands(L('caAb', 'Alberta income tax', max(0, prog(ti, AB_BR) - 0.08*(22769 + base + ei)), 'tax', 'cra', 'official', F), ti, AB_BR,
      { adj: [['Less the Alberta credits at 8% (basic personal amount, CPP, EI)', -0.08*(22769 + base + ei)]] }));
  }
  return finish(g, lines, { taxable: ti });
}

/* ════════════════════════════ HK YA2026/27 ══════════════════════════════ */
function hk(g, k){
  const F = '1 Apr 2026', lines = [], m = g/12;
  const mpfOn = k.hkMpf !== false;
  const mpf = 12*(!mpfOn || m < 7100 ? 0 : 0.05*min(m, 30000));
  if(mpfOn) lines.push(minus(L('hkMpf', 'MPF, employee share (5%, max 1,500 a month)', mpf, 'social', 'mpfa', 'official', F)));
  const net = g - min(mpf, 18000);
  const allow = (k.hkMarried ? 290000 : 145000) + 140000*max(0, floor(+k.hkKids || 0));
  const HK_BR = [[50000,.02],[100000,.06],[150000,.10],[200000,.14],[null,.17]], progt = prog(max(0, net - allow), HK_BR);
  const std = 0.15*min(net, 5e6) + 0.16*max(0, net - 5e6);
  const stdWins = progt > std;
  const hl = L('hkTax', stdWins ? 'Salaries tax, standard rate on net income (15%, 16% above 5M)' : 'Salaries tax, progressive rates', min(progt, std), 'tax', 'ird', 'secondary', F);
  lines.push(stdWins ? bands(hl, net, [[5e6,.15],[null,.16]]) : bands(hl, max(0, net - allow), HK_BR));
  const al = L('hkAllow', stdWins ? 'Allowances (basic, married, children), not used at the standard rate' : 'Allowances (basic, married, children)', allow, 'deduction', 'ird', 'official', F);
  lines.push(stdWins ? al : minus(al));
  return finish(g, lines, stdWins ? { taxable: net, taxableLabel: 'Net income, standard rate' } : { taxable: max(0, net - allow), taxableLabel: 'Net chargeable income' });
}

/* ════════════════════════════ CN-SH 2026 ════════════════════════════════ */
const CN_BR = [[36000,.03,0],[144000,.10,2520],[300000,.20,16920],[420000,.25,31920],[660000,.30,52920],[960000,.35,85920],[null,.45,181920]];
function cnIit(t){ for(const [up, r, d] of CN_BR) if(up == null || t <= up) return max(0, t*r - d); }
function cn(g, k){
  const F = '1 Jan 2026', lines = [], m = g/12;
  const hf = (k.cnHf == null ? 7 : +k.cnHf)/100;
  let soc = 0, house = 0;
  for(let mo = 0; mo < 12; mo++){
    const [lo, hi] = mo < 6 ? [7460, 37302] : [7546, 37731];
    soc += clamp(m, lo, hi)*(0.08 + 0.02 + 0.005);
    house += clamp(m, 2740, hi)*hf;
  }
  lines.push(minus(L('cnSoc', 'Pension, medical and unemployment (10.5%)', soc, 'social', 'shhrss', 'secondary', F)));
  lines.push(minus(L('cnHf', 'Housing fund (' + +(hf*100).toFixed(1) + '%)', house, 'social', 'shhrss', 'official', F)));
  lines.push(minus(L('cnBasic', 'Basic deduction (5,000 a month)', 60000, 'base', 'cn', 'official', F)));
  const expat = k.cnRes === 'expat';
  const allow = expat ? max(0, +k.cnAllow || 0) : 0, special = expat ? 0 : max(0, +k.cnSpecial || 0);
  if(allow) lines.push(minus(L('cnAllow', 'Tax-free expat allowances', allow, 'deduction', 'cn', 'official', F)));
  if(special) lines.push(minus(L('cnSpecial', 'Special additional deductions', special, 'deduction', 'cn', 'secondary', F)));
  const ti = max(0, g - 60000 - soc - house - allow - special);
  lines.push(bands(L('cnIit', 'Individual income tax', cnIit(ti), 'tax', 'cn', 'secondary', F), ti, plainBr(CN_BR)));
  return finish(g, lines, { taxable: ti });
}

/* ════════════════════════════ TW income 2026 ════════════════════════════ */
const TW_BR = [[610000,.05,0],[1380000,.12,42700],[2770000,.20,153100],[5190000,.30,430100],[null,.40,949100]];
function twTax(n){ for(const [up, r, d] of TW_BR) if(up == null || n <= up) return max(0, n*r - d); }
function tw(g, k){
  const F = '1 Jan 2026', lines = [], m = g/12;
  lines.push(L('twLi', 'Labour insurance, employee share', 12*0.125*0.20*min(m, 45800), 'social', 'twins', 'secondary', F));
  lines.push(L('twNhi', 'National health insurance, employee share', 12*0.0517*0.30*min(m, 219500), 'social', 'twins', 'secondary', F));
  if(k.twRes === 'nonres'){
    const r = m <= 44250 ? 0.06 : 0.18;
    lines.push(L('twNr', 'Withholding, non-resident (' + r*100 + '%, final)', r*g, 'tax', 'mof', 'official', F));
    return finish(g, lines, { taxable: g });
  }
  const married = k.twStatus === 'married', kids = max(0, floor(+k.twKids || 0));
  const ex = 101000*(married ? 2 : 1) + 151500*kids, std = married ? 272000 : 136000;
  const sal = g - min(g, 227000), excl = k.twGold ? 0.5*max(0, sal - 3e6) : 0;
  const nti = max(0, sal - excl - ex - std);
  lines.push(minus(L('twSal', 'Salary special deduction', min(g, 227000), 'deduction', 'mof', 'official', F)));
  if(excl) lines.push(minus(L('twGold', 'Gold Card exclusion (50% above 3M)', excl, 'deduction', 'mof', 'official', F)));
  lines.push(minus(L('twEx', 'Exemptions and standard deduction', ex + std, 'deduction', 'mof', 'official', F)));
  lines.push(bands(L('twTax', 'Individual income tax', twTax(nti), 'tax', 'mof', 'secondary', F), nti, plainBr(TW_BR)));
  return finish(g, lines, { taxable: nti, taxableLabel: 'Net taxable income' });
}

/* ════════════════════════════ Gulf states ═══════════════════════════════ */
function gulf(country){
  return function(g, k){
    const F = '2026', lines = [], share = clamp(k.gulfWagePct == null ? 100 : +k.gulfWagePct, 0, 100)/100;
    const w = g*share, m = w/12, nat = k.gulfNat === 'national';
    const add = (id, label, amt, src, status, from) => lines.push(L(id, label, amt, 'social', src, status || 'secondary', from || F));
    lines.push(inGroup(L('gulfTax', 'No personal income tax on employment', 0, 'info', country === 'OM' ? 'spf' : 'spec', 'secondary', F), 'tax'));
    if(country === 'AE'){
      if(nat){ add('aeGpssa', 'GPSSA pension (11%, cap 70,000 a month)', 12*0.11*min(m, 70000), 'gpssa');
        lines.push(L('aeEr', 'Employer 12.5% and government 2.5%, on top', 12*0.15*min(m, 70000), 'employer', 'gpssa', 'secondary', F)); }
      else lines.push(inGroup(L('aeEx', 'No pension contribution for expatriates (end-of-service gratuity instead)', 0, 'info', 'gpssa', 'secondary', F), 'social'));
    } else if(country === 'QA'){
      if(nat){ add('qaPen', 'GRSIA pension (7%, cap 100,000 a month)', 12*0.07*min(m, 100000), 'grsia');
        lines.push(L('qaEr', 'Employer 14%, on top', 12*0.14*min(m, 100000), 'employer', 'grsia', 'secondary', F)); }
      else lines.push(inGroup(L('qaEx', 'No pension contribution for expatriates', 0, 'info', 'grsia', 'secondary', F), 'social'));
    } else if(country === 'SA'){
      const mm = min(m, 45000);
      if(nat && k.saScheme === 'new') add('saGosi', 'GOSI, new entrant (10.25% to June, 10.75% from July)', 6*0.1025*mm + 6*0.1075*mm, 'gosi', 'secondary', '1 Jul 2026');
      else if(nat) add('saGosi', 'GOSI annuities and SANED (9.75%)', 12*0.0975*mm, 'gosi');
      else lines.push(L('saEr', 'Employer occupational hazards (2%), on top', 12*0.02*mm, 'employer', 'gosi', 'secondary', F));
    } else if(country === 'BH'){
      add('bhSio', nat ? 'SIO pension and unemployment (8%)' : 'SIO unemployment insurance (1%)', 12*(nat ? 0.08 : 0.01)*min(m, 4000), 'sio', 'secondary', '1 Jan 2026');
    } else if(country === 'KW'){
      if(nat) add('kwPifss', 'PIFSS (8% to 2,750 a month, 2.5% to 1,500)', 12*(0.08*min(m, 2750) + 0.025*min(m, 1500)), 'pifss');
      else lines.push(inGroup(L('kwEx', 'No social insurance for expatriates', 0, 'info', 'pifss', 'secondary', F), 'social'));
    } else if(country === 'OM'){
      if(nat) add('omSpf', 'Social Protection Fund (8%, cap 3,000 a month)', 12*0.08*min(m, 3000), 'spf');
      else lines.push(inGroup(L('omEx', 'No social insurance for expatriates', 0, 'info', 'spf', 'secondary', F), 'social'));
      lines.push(inGroup(L('omPit', 'Personal income tax (5% above 42,000) starts 1 Jan 2028', 0, 'info', 'spf', 'official', '1 Jan 2028'), 'tax'));
    }
    return finish(g, lines, { taxable: null });   // no income tax, so no taxable income to work out
  };
}

/* ════════════════════════════ The jurisdictions ═════════════════════════ */
/* knobs: the fields this country reads (ids are the page's field handles).
   cur: ISO code, sym: the symbol the page shows. */
const C = {
  AU: { name: 'Australia', cur: 'AUD', sym: 'A$', year: '2026-27 (from 1 Jul 2026)', place: '', fn: au },
  SG: { name: 'Singapore', cur: 'SGD', sym: 'S$', year: 'YA2027 (income 2026)', place: '', fn: sg },
  GB: { name: 'United Kingdom', cur: 'GBP', sym: '£', year: '2026/27 (from 6 Apr 2026)', place: '', fn: uk },
  DE: { name: 'Germany', cur: 'EUR', sym: '€', year: '2026', place: '', fn: de },
  US: { name: 'United States', cur: 'USD', sym: 'US$', year: '2026', place: '', fn: us },
  CA: { name: 'Canada', cur: 'CAD', sym: 'C$', year: '2026', place: '', fn: ca },
  FR: { name: 'France', cur: 'EUR', sym: '€', year: '2026 salary (LF2026 scale)', place: '', fn: fr },
  NL: { name: 'Netherlands', cur: 'EUR', sym: '€', year: '2026', place: '', fn: nl },
  BE: { name: 'Belgium', cur: 'EUR', sym: '€', year: 'Income 2026', place: '', fn: be },
  CH: { name: 'Switzerland', cur: 'CHF', sym: 'CHF', year: '2026', place: 'Canton of Zurich', fn: ch },
  IT: { name: 'Italy', cur: 'EUR', sym: '€', year: '2026', place: 'Milan, Lombardy', fn: it },
  ES: { name: 'Spain', cur: 'EUR', sym: '€', year: '2026', place: 'Madrid', fn: es },
  PT: { name: 'Portugal', cur: 'EUR', sym: '€', year: 'Income 2026 (mainland)', place: 'Mainland', fn: pt },
  NO: { name: 'Norway', cur: 'NOK', sym: 'kr', year: '2026', place: '', fn: no },
  SE: { name: 'Sweden', cur: 'SEK', sym: 'kr', year: '2026', place: '', fn: se },
  FI: { name: 'Finland', cur: 'EUR', sym: '€', year: '2026', place: '', fn: fi },
  EE: { name: 'Estonia', cur: 'EUR', sym: '€', year: '2026', place: '', fn: ee },
  JP: { name: 'Japan', cur: 'JPY', sym: '¥', year: '2026', place: 'Tokyo', fn: jp },
  KR: { name: 'South Korea', cur: 'KRW', sym: '₩', year: '2026', place: '', fn: kr },
  CN: { name: 'China', cur: 'CNY', sym: 'CN¥', year: '2026', place: 'Shanghai', fn: cn },
  TW: { name: 'Taiwan (China)', cur: 'TWD', sym: 'NT$', year: 'Income 2026', place: '', fn: tw },
  HK: { name: 'Hong Kong (China)', cur: 'HKD', sym: 'HK$', year: '2026/27 (from 1 Apr 2026)', place: '', fn: hk },
  ID: { name: 'Indonesia', cur: 'IDR', sym: 'Rp', year: '2026', place: '', fn: idn },
  MY: { name: 'Malaysia', cur: 'MYR', sym: 'RM', year: 'YA2026', place: '', fn: my },
  TH: { name: 'Thailand', cur: 'THB', sym: '฿', year: '2026', place: '', fn: th },
  AE: { name: 'United Arab Emirates', cur: 'AED', sym: 'AED', year: '2026', place: '', fn: gulf('AE') },
  SA: { name: 'Saudi Arabia', cur: 'SAR', sym: 'SAR', year: '2026', place: '', fn: gulf('SA') },
  QA: { name: 'Qatar', cur: 'QAR', sym: 'QAR', year: '2026', place: '', fn: gulf('QA') },
  BH: { name: 'Bahrain', cur: 'BHD', sym: 'BHD', year: '2026', place: '', fn: gulf('BH') },
  KW: { name: 'Kuwait', cur: 'KWD', sym: 'KWD', year: '2026', place: '', fn: gulf('KW') },
  OM: { name: 'Oman', cur: 'OMR', sym: 'OMR', year: '2026', place: '', fn: gulf('OM') }
};

/* Display-only exchange rates, units per US dollar (open.er-api.com, 10 Nov 2026).
   Every sum is worked out in local currency; these only restate it. */
const FX_DATE = '10 Nov 2026';
const FX = { USD: 1, AUD: 1.448015, SGD: 1.279506, GBP: 0.744696, EUR: 0.892449, IDR: 18083.724904, THB: 33.475647, MYR: 4.059352,
  CAD: 1.411275, JPY: 158.023471, KRW: 1344.786283, CNY: 6.686583, TWD: 32.780875, HKD: 7.84232, AED: 3.6725, QAR: 3.64,
  SAR: 3.75, BHD: 0.376, KWD: 0.310638, OMR: 0.384497, NOK: 9.405633, SEK: 9.811535, CHF: 0.81965 };
const convert = (amt, from, to) => amt/FX[from]*FX[to];

/* ════════════════════════════ compute and solve ═════════════════════════ */
function compute(country, gross, knobs){
  const c = C[country];
  if(!c) return NS('Unknown country.');
  const g = max(0, +gross || 0);
  const r = c.fn(g, knobs || {});
  if(r.notSupported) return r;
  r.country = country; r.cur = c.cur;
  // Gross here is what the reader entered; a Dutch holiday allowance on top shows as its own line.
  if(r.entered == null) r.entered = g;
  return r;
}

/* Net to gross: the lowest gross whose net meets the target. A coarse scan
   finds the first step that reaches it (net is not monotonic everywhere: the
   NY recapture, Milan's surtax edge), then bisection closes to 0.5. */
function solveGross(country, target, knobs){
  target = max(0, +target || 0);
  if(target === 0) return { gross: 0 };
  const probe = g => compute(country, g, knobs);
  let hi = max(1000, target*1.2), r = probe(hi), guard = 0;
  // A floor guard (Belgium's minimum wage, Finland's key employee) can leave
  // the first probes unsupported; a ceiling guard (Norway's PAYE) cannot be climbed past.
  while((r.notSupported || r.net < target) && guard++ < 80){
    if(r.notSupported && probe(hi*0.999).notSupported === false) return r;
    hi *= 1.5; r = probe(hi);
  }
  if(r.notSupported) return r;
  if(r.net < target) return NS('No gross pay reaches that take-home pay.');
  // Below the first supported step a probe counts as "not enough yet".
  const reaches = g => { const v = probe(g); return v.notSupported ? false : v.net >= target; };
  const STEPS = 400;
  let lo = 0, up = hi;
  for(let i = 1; i <= STEPS; i++){
    const g = hi*i/STEPS;
    if(reaches(g)){ up = g; lo = hi*(i - 1)/STEPS; break; }
  }
  for(let it = 0; it < 100 && up - lo > 0.5; it++){
    const mid = (lo + up)/2;
    if(reaches(mid)) up = mid; else lo = mid;
  }
  // The answer sits on a floor guard: the true gross is below the range the rules cover.
  const below = probe(max(0, up - 1));
  if(below.notSupported && probe(up).net > target + 1) return below;
  return { gross: up };
}

// Share of the next 1% of pay that goes to tax and contributions.
function marginal(country, g, knobs, base){
  const d = max(1, g*0.01), r = compute(country, g + d, knobs);
  if(r.notSupported || base.notSupported) return null;
  return 1 - (r.net - base.net)/d;
}

const api = { C, SRC, FX, FX_DATE, US_STATES, US_ST_GATED, US_NO_TAX, US_LOCAL, compute, solveGross, marginal, convert,
  _: { prog, deEst, deSoli, auLito, auMedicare, nyRecaptureTax, beCsssQ, beBonusM, beFedTax, itDetr, chDbstSingle, chDbstMarried,
       jpGrade, jpNat, jpEmpDed, jpBasic, krDed, krTax, krCredit, caOhp, cnIit, twTax, ptMinimo, ptDependants, ptExpenses, esArt20, esSmi, frTax, seGa, seJsa, ilTax } };
global.GSCEngine = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
