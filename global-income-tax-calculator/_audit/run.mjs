// Global Income Tax Calculator: engine audit.
//
// 1. Golden values. Every case the spec v11 reference model generates
//    (golden-v11.json, written by gsc_reference_model.py in this folder) is
//    replayed through engine.js: income tax, employee contributions and net,
//    to ±1 unit of local currency. The few cases this tool changes on purpose
//    (Illinois loaded, France above RFR 250,000, no Australian work deduction) are checked against an
//    independent replay of the new rule instead, and listed as such.
// 2. Layer A anchors from spec §5.1, through the engine's own pieces.
// 3. Lines add up: tax, contribution, other and benefit lines sum to the
//    totals, every line names a known source and a status, nothing is NaN.
// 4. Layer D properties: net to gross round trips (50 targets a preset),
//    non-negativity, caps that hold.
//
// Run: node global-income-tax-calculator/_audit/run.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const E = require(join(HERE, '..', 'engine.js'));
const GOLD = JSON.parse(readFileSync(join(HERE, 'golden-v11.json'), 'utf8'));

let pass = 0, fail = 0;
const fails = [];
const check = (name, ok, detail, quiet) => {
  if(!ok || !quiet) console.log((ok ? '  PASS  ' : '✗ FAIL  ') + name + (detail ? '  — ' + detail : ''));
  if(ok) pass++; else { fail++; fails.push(name); }
};
const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;
const fmt = v => typeof v === 'number' ? v.toFixed(2) : String(v);

/* ── 1. Golden cases ──────────────────────────────────────────────────────── */
const US = (st, fs, extra) => ['US', Object.assign({ usState: st, usFiling: fs }, extra || {})];
const GULF = { AE_expat: ['AE', { gulfNat: 'expat' }], AE_national: ['AE', { gulfNat: 'national' }], QA_national: ['QA', { gulfNat: 'national' }],
  SA_national_legacy: ['SA', { gulfNat: 'national', saScheme: 'legacy' }], SA_national_new_2026: ['SA', { gulfNat: 'national', saScheme: 'new' }],
  BH_expat: ['BH', { gulfNat: 'expat' }], BH_national: ['BH', { gulfNat: 'national' }], OM_national: ['OM', { gulfNat: 'national' }], KW_national: ['KW', { gulfNat: 'national' }] };
const MAP = {
  'AU': n => ['AU', { auRes: n, auCover: true }],
  'SG': n => ['SG', { ep: { sgRes: 'ep' }, citizen55: { sgRes: 'citizen', sgAge: '55' }, pr1: { sgRes: 'pr1' }, pr2: { sgRes: 'pr2' } }[n]],
  'UK': n => ['GB', { ukRegion: n === 'SCO' ? 'sco' : 'ruk' }],
  'DE': n => ['DE', { I: { deClass: 'I' }, III: { deClass: 'III', deKids: true }, I_church9: { deClass: 'I', deChurch: 9 } }[n]],
  'US-TX': n => US('TX', n),
  'US-CA': n => US('CA', n === 'MFJ' ? 'MFJ' : 'S'),
  'US-NY': n => US('NY', n.endsWith('MFJ') ? 'MFJ' : 'S', { usNyc: n.startsWith('NYC') }),
  'US-TX NRA': n => US('TX', 'S', { usRes: 'nra', usFicaExempt: n.includes('ficaExempt') }),
  'US-states (v11)': n => { const [st, fs] = n.split('_'); return US(st, fs); },
  'ID (gross/month)': n => ['ID', { TK0: { idMarried: false, idDeps: 0 }, K2: { idMarried: true, idDeps: 2 }, nonresident: { idRes: 'nonres' } }[n]],
  'TH': n => ['TH', n === 'single' ? {} : { thSpouse: true, thKids: 2 }],
  'MY': n => ['MY', { myRes: { citizen: 'citizen', expat_resident: 'expat', expat_nonresident: 'nonres' }[n] }],
  'NL (gross incl. holiday pay)': n => ['NL', { nlHoliday: false, nlRuling: n === 'ruling30' }],
  'NO': n => ['NO', { noRes: n === 'PAYE25' ? 'paye' : 'res' }],
  'SE': n => ['SE', { seRes: n === 'SINK' ? 'sink' : 'res' }],
  'EE': n => ['EE', { eeP2: n === 'pillarII_off' ? 0 : 2 }],
  'FI': n => ['FI', { 'Helsinki5.30': {}, Helsinki_church1: { fiChurch: 1 }, keyEmployee: { fiRes: 'key' } }[n]],
  'BE': n => ['BE', { single_7pct: {}, expat35: { beExpat: true }, married_sole_earner: { beStatus: 'married' }, single_2kids: { beKids: 2 },
    married_sole_earner_2kids: { beStatus: 'married', beKids: 2 }, married_sole_earner_5kids: { beStatus: 'married', beKids: 5 },
    single_parent_2kids: { beKids: 2, beSingleParent: true } }[n]],
  'IT': n => ['IT', { itImp: { Milan: 'none', impatriate50: 'imp50', impatriate60_child: 'imp60' }[n] }],
  'CH-ZH (city, single, age 35-44)': n => ['CH', { B_permit_single: {}, B_permit_single_church10: { chChurch: true }, married: { chStatus: 'married' },
    married_2kids: { chStatus: 'married', chKids: 2 } }[n]],
  'FR': n => ['FR', { single_noncadre: {}, single_cadre: { frCadre: 'cadre' }, married2kids_cadre: { frCadre: 'cadre', frMarried: true, frKids: 2 },
    single_cadre_impatriate30: { frCadre: 'cadre', frImp: true } }[n]],
  'ES (Madrid)': n => ['ES', { resident_single: {}, resident_2kids: { esKids: 2 }, beckham: { esRegime: 'beckham' } }[n]],
  'PT': n => ['PT', { resident: {}, IRSJovem_y3: { ptRegime: 'jovem', ptJovemYear: 3 }, IFICI: { ptRegime: 'ifici' }, nonresident: { ptRegime: 'nonres' },
    resident_2deps_8y_2y: { ptDepOld: 1, ptDepYoung: 1 }, resident_health2000_edu1000: { ptHealth: 2000, ptEdu: 1000 } }[n]],
  'JP (Tokyo, <40)': n => ['JP', { jpRes: { year2plus: 'y2', year1_noResidentTax: 'y1', nonresident: 'nonres' }[n] }],
  'KR': n => ['KR', { krMethod: n === 'flat19' ? 'flat' : 'prog' }],
  'CA-ON': () => ['CA', { caProv: 'ON' }], 'CA-BC': () => ['CA', { caProv: 'BC' }], 'CA-AB': () => ['CA', { caProv: 'AB' }], 'CA-QC': () => ['CA', { caProv: 'QC' }],
  'HK': n => ['HK', { single_MPF: {}, single_MPFexempt: { hkMpf: false }, married2kids_MPF: { hkMarried: true, hkKids: 2 } }[n]],
  'CN-SH': n => ['CN', n === 'local_hf7' ? {} : { cnRes: 'expat', cnAllow: 120000 }],
  'TW': n => ['TW', { resident_single: {}, resident_married2kids: { twStatus: 'married', twKids: 2 }, nonresident: { twRes: 'nonres' }, resident_single_goldcard: { twGold: true } }[n]],
  'Gulf': n => GULF[n]
};

/* Cases this tool changes on purpose, each held to an independent replay. */
const usFedS = g => { const t = g - 16100, br = [[12400,.10],[50400,.12],[105700,.22],[201775,.24],[256225,.32],[640600,.35],[Infinity,.37]];
  let s = 0, lo = 0; for(const [up, r] of br){ if(t > lo) s += (Math.min(t, up) - lo)*r; lo = up; } return s; };
const fica = g => 0.062*Math.min(g, 184500) + 0.0145*g + 0.009*Math.max(0, g - 200000);
// Australia, residents: no standard deduction for work expenses (claimed at tax time, and
// different for everyone), so the tax is on the salary as paid. Resident rates, LITO, and for a
// citizen or permanent resident the 2% Medicare levy with its low-income phase-in (ATO).
const auRes = (g, pr) => {
  let t = 0, lo = 0; for(const [up, r] of [[18200,0],[45000,.15],[135000,.30],[190000,.37],[Infinity,.45]]){ if(g > lo) t += (Math.min(g, up) - lo)*r; lo = up; }
  const lito = g <= 37500 ? 700 : g <= 45000 ? 700 - 0.05*(g - 37500) : g <= 66667 ? Math.max(0, 325 - 0.015*(g - 45000)) : 0;
  const med = !pr || g <= 28011 ? 0 : g <= 35013 ? 0.10*(g - 28011) : 0.02*g;
  return { incomeTax: Math.max(0, t - lito) + med, social: 0 };
};
const CHANGED = {
  'AU|pr|60000': () => auRes(60000, true),
  'AU|pr|120000': () => auRes(120000, true),
  'AU|pr|300000': () => auRes(300000, true),
  'AU|temp|60000': () => auRes(60000, false),
  'AU|temp|120000': () => auRes(120000, false),
  'AU|temp|300000': () => auRes(300000, false),
  // Illinois: 4.95% on wages less a 2,925 exemption (IDOR Q&A 851; IL Comptroller bulletin 1-26).
  'US-states (v11)|IL_S_gated|80000': () => ({ incomeTax: usFedS(80000) + 0.0495*(80000 - 2925), social: fica(80000) }),
  // France at gross 320,000 (single cadre): CEHR 3% on RFR above 250,000, written out from service-public's table.
  'FR|single_cadre|320000': () => {
    const g = 320000, P = 48060, t1 = Math.min(g, P), t2 = Math.min(g, 8*P) - P;
    const csgBase = 0.9825*4*P + (g - 4*P);
    const ded = 0.069*t1 + 0.004*g + 0.0315*t1 + 0.0864*t2 + 0.0086*t1 + 0.0108*t2 + 0.0014*g + 0.00024*4*P + 0.068*csgBase;
    const ni = g - ded, nt = ni - 14555;             // the 10% deduction is at its 14,555 cap here
    // income tax per part on the 2026 scale, written as base amounts per band
    const ir = nt <= 181917 ? NaN : 1977.69 + 16499.40 + 39909.40 + 0.45*(nt - 181917);
    const cehr = 0.03*(nt - 250000);
    return { incomeTax: ir + cehr, social: ded + 0.029*csgBase };
  }
};

let goldN = 0, goldNs = 0, changedN = 0;
for(const [key, want] of Object.entries(GOLD)){
  const [group, name, gs] = key.split('|');
  const mapper = MAP[group];
  if(!mapper){ check('golden ' + key + ' has a mapping', false); continue; }
  const [country, knobs] = mapper(name) || [];
  if(!country){ check('golden ' + key + ' maps to a case', false); continue; }
  const gross = group.startsWith('ID') ? +gs*12 : +gs;
  const got = E.compute(country, gross, knobs);
  if(CHANGED[key]){
    changedN++;
    const exp = CHANGED[key]();
    const ok = !got.notSupported && near(got.incomeTax, exp.incomeTax) && near(got.social, exp.social);
    check('changed on purpose: ' + key + ' (v11: ' + (want === 'NOT_SUPPORTED' ? 'NOT_SUPPORTED' : JSON.stringify(want)) + ')', ok,
      got.notSupported ? got.reason : 'tax ' + fmt(got.incomeTax) + ' vs replay ' + fmt(exp.incomeTax) + ', social ' + fmt(got.social) + ' vs ' + fmt(exp.social));
    continue;
  }
  goldN++;
  if(want === 'NOT_SUPPORTED'){
    goldNs++;
    check('golden ' + key + ' NOT_SUPPORTED', !!got.notSupported, got.notSupported ? '' : 'got net ' + fmt(got.net), true);
    continue;
  }
  if(got.notSupported){ check('golden ' + key, false, 'NOT_SUPPORTED: ' + got.reason); continue; }
  // The Dutch cases are gross including holiday pay, as the model takes it.
  const ok = near(got.incomeTax, want.incomeTax) && near(got.social, want.social) && near(got.net, want.net);
  check('golden ' + key, ok, ok ? '' : 'tax ' + fmt(got.incomeTax) + '/' + want.incomeTax + ' social ' + fmt(got.social) + '/' + want.social + ' net ' + fmt(got.net) + '/' + want.net, true);
}
console.log(`  golden: ${goldN} cases replayed (${goldNs} NOT_SUPPORTED), ${changedN} changed on purpose`);

/* ── 2. Layer A anchors (spec §5.1) ───────────────────────────────────────── */
const _ = E._;
const A = (name, got, want, tol = 1) => check('anchor ' + name, near(got, want, tol), fmt(got) + ' vs ' + want);
A('AU-A1 resident tax 45,000', _.prog(45000, [[18200,0],[45000,.15],[135000,.30],[190000,.37],[null,.45]]), 4020);
A('AU-A2 resident tax 190,000', _.prog(190000, [[18200,0],[45000,.15],[135000,.30],[190000,.37],[null,.45]]), 51370);
A('DE-A1 soli on ESt 21,932', _.deSoli(21932, false), 188.26);
A('JP-A1 employment deduction 2M', _.jpEmpDed(2e6), 740000);
A('JP-A2 employment deduction 10M', _.jpEmpDed(10e6), 1950000);
A('JP-A3 national tax 4,000,000', _.jpNat(4e6), 372500);
A('JP-A4 basic deduction 4,890,000', _.jpBasic(4890000), 1040000);
A('JP-A4 basic deduction 4,890,001', _.jpBasic(4890001), 670000);
A('KR-A1 national tax 70M', _.krTax(70e6), 11040000);
A('KR-A3 earned income deduction 33.8M', _.krDed(33.8e6), 10320000);
A('KR-A4 earned income credit', _.krCredit(3448696, 50e6), 660000);
A('CN-A1 IIT 100,000', _.cnIit(100000), 7480);
A('FR-A1 tax 30,000, 1 part', _.frTax(30000, 1, 1), 2103.99);
A('FR-A2 tax 60,000, 2 parts', _.frTax(60000, 2, 2), 4207.98);
A('PT-A1 scale 20,000', _.prog(20000, [[8342,.122],[12587,.152],[17838,.207],[23089,.236],[29397,.306],[43090,.346],[46566,.431],[86634,.446],[null,.48]]), 3260.15);
A('ES-A1 Art. 20 at 14,000', _.esArt20(14000), 7302);
A('ES-A1 Art. 20 at 16,000', _.esArt20(16000), 5293);
A('ES-A1 Art. 20 at 19,000', _.esArt20(19000), 852.15);
A('ES-A1 Art. 20 at 20,000', _.esArt20(20000), 0);
A('ES-A3 SMI deduction 18,000', _.esSmi(18000), 409.69);
A('CA-A3 Ontario Health Premium 60k', _.caOhp(60000), 600);
A('CA-A3 Ontario Health Premium 98,873', _.caOhp(98873), 750);
A('PT-A3 minimo at 15,000', _.ptMinimo(15000, 4587.09), 1196.72);
A('PT-A3 minimo at 12,880', _.ptMinimo(12880, 4587.09), 6243.73);
A('PT-A3 minimo above 16,543.60', _.ptMinimo(16543.61, 4587.09), 0);
A('IT-A1 IRPEF 60,000', _.prog(60000, [[28000,.23],[50000,.33],[null,.43]]), 18000);
A('IT-A5 IRPEF 200,000', _.prog(200000, [[28000,.23],[50000,.33],[null,.43]]), 78200);
A('CH-A3 DBST single 67,927', _.chDbstSingle(67927), 906.03);
A('CH-A5 DBST single 84,491', _.chDbstSingle(84491), 1654.75);
A('CH DBST married 150,400', _.chDbstMarried(150400), 5452);
A('CH DBST married 941,300', _.chDbstMarried(941300), 108249);
A('BE-A1 tax-free reduction', _.prog(11550, [[16720,.25],[29510,.40],[51070,.45],[null,.50]]), 2887.50);
A('BE-A2 CSSS quarter 10,500', _.beCsssQ(10500), 74.21);
A('BE-A3 CSSS quarter cap', _.beCsssQ(20000), 182.82);
{ const [a, bb] = _.beBonusM(2500); A('BE-A4 employment bonus S=2,500', a + bb, 245.72); }
{ const [a, bb] = _.beBonusM(3000); A('BE-A4 employment bonus S=3,000', a + bb, 110.54); }
A('TW-A1 single 1.2M', E.compute('TW', 1.2e6, {}).incomeTax, 45620);
A('TW-A2 non-resident 100,000 a month', E.compute('TW', 1.2e6, { twRes: 'nonres' }).lines.find(l => l.id === 'twNr').amount/12, 18000);
A('TW-A2 non-resident 40,000 a month', E.compute('TW', 480000, { twRes: 'nonres' }).lines.find(l => l.id === 'twNr').amount/12, 2400);
A('JP-A5 non-resident 1,000,000', E.compute('JP', 1e6, { jpRes: 'nonres' }).incomeTax, 204200);
A('US-NY-A1 PFL 50,000', E.compute('US', 50000, { usState: 'NY' }).lines.find(l => l.id === 'usNyPfl').amount, 216);
A('US-NY-A1 PFL 200,000', E.compute('US', 200000, { usState: 'NY' }).lines.find(l => l.id === 'usNyPfl').amount, 411.91);
A('US-NY DBL max 31.20', E.compute('US', 200000, { usState: 'NY' }).lines.find(l => l.id === 'usNyDbl').amount, 31.20, 0.001);
A('US-CA-A1 MFJ taxable 125,000', _.prog(125000, [[22912,.01],[54314,.02],[85722,.04],[118996,.06],[150394,.08],[768218,.093],[921854,.103],[1536426,.113],[null,.123]]), 4590.24, 0.01);
A('HK-A1 MPF 20k a month', E.compute('HK', 240000, {}).social/12, 1000);
A('HK-A1 MPF 45k a month', E.compute('HK', 540000, {}).social/12, 1500);
A('HK-A1 MPF 6k a month', E.compute('HK', 72000, {}).social/12, 0);
A('KW-A1 PIFSS 2,000 a month', E.compute('KW', 24000, { gulfNat: 'national' }).social/12, 197.50);
A('SA-A1 GOSI legacy 50,000 a month', E.compute('SA', 600000, { gulfNat: 'national' }).social/12, 4387.50);
A('AE-A1 GPSSA 20,000 a month', E.compute('AE', 240000, { gulfNat: 'national' }).social/12, 2200);
A('OM-A1 SPF 4,000 a month', E.compute('OM', 48000, { gulfNat: 'national' }).social/12, 240);
A('MY-A1 tax after rebate, chargeable 28,650', Math.max(0, _.prog(28650, [[5000,0],[20000,.01],[35000,.03],[50000,.06],[null,.11]]) - 400), 9.50);
A('ID effective-date: JP and JHT and Kes at 15M a month', E.compute('ID', 180e6, {}).social, 6359578);
// A9: QPP+QPP2 / EI / QPIP at 100,000
{ const r = E.compute('CA', 100000, { caProv: 'QC' }), v = id => (r.lines.find(l => l.id === id) || { amount: 0 }).amount;
  A('CA-A9 QPP+QPP2 at 100,000', v('caQpp') + v('caQpp2'), 4895.30); A('CA-A9 EI at 100,000', v('caEi'), 895.70); A('CA-A9 QPIP at 100,000', v('caQpip'), 430.00); }

/* New since v11: the rules this tool adds, against their own sources. */
// Illinois: the exemption goes in full above AGI 250,000 (IDOR: "not allowed if ... exceeds").
A('IL tax at 250,000 (exemption kept)', _.ilTax(250000, 'S'), 0.0495*(250000 - 2925), 0.01);
A('IL tax at 250,001 (no exemption)', _.ilTax(250001, 'S'), 0.0495*250001, 0.01);
A('IL tax MFJ at 400,000 (two exemptions)', _.ilTax(400000, 'MFJ'), 0.0495*(400000 - 5850), 0.01);
// Ontario: EY's Budget 2026 summary says no Ontario tax up to taxable 18,930 and the reduction
// is clawed back to 24,870. With the basic personal amount alone, the "2 x" shape gives exactly that.
{ const onTax = ti => { const on = Math.max(0, 0.0505*(ti - 12989)); return on - Math.min(on, Math.max(0, 2*300 - on)); };
  A('ON 2x reduction: no tax at 18,930', onTax(18930), 0, 0.05);
  A('ON 2x reduction: clawback ends at 24,870', onTax(24870), 0.0505*(24870 - 12989), 0.05);
  A('ON 2x reduction: 10.1% in the clawback band', (onTax(22000) - onTax(21000))/1000, 0.101, 0.0001); }
// France: service-public's own worked example, CEHR at RFR 400,000 single = 4,500.
{ const cehr = (rfr, married) => { const [c1, c2] = married ? [500000, 1000000] : [250000, 500000];
    return 0.03*Math.max(0, Math.min(rfr, c2) - c1) + 0.04*Math.max(0, rfr - c2); };
  A('FR CEHR, service-public example (RFR 400,000 single)', cehr(400000, false), 4500);
  A('FR CEHR, couple at 1.2M', cehr(1.2e6, true), 0.03*500000 + 0.04*200000); }

/* ── 3. Lines add up, sources and statuses known ─────────────────────────── */
const SAMPLE = [
  ['AU', 120000, { auRes: 'pr', auCover: false }], ['AU', 120000, { auRes: 'pr', auSuper: true }], ['SG', 120000, { sgRes: 'citizen' }], ['SG', 120000, { sgRes: 'nonres' }],
  ['GB', 80000, { ukLoan: 'plan2', ukPg: true }], ['DE', 85000, { deClass: 'III', deChurch: 9 }], ['US', 250000, { usState: 'NY', usNyc: true, usFiling: 'MFJ' }],
  ['US', 180000, { usState: 'MD', usLocal: 3.2 }], ['US', 180000, { usState: 'CA', usRes: 'nra' }], ['US', 300000, { usState: 'IL' }], ['ID', 480e6, { idMarried: true, idDeps: 3 }],
  ['TH', 1.2e6, { thSpouse: true, thKids: 1, thKidsNew: 1 }], ['MY', 120000, { myRes: 'expat', myLindung: true }], ['NL', 80000, { nlRuling: true, nlHoliday: true, nlPension: 4 }],
  ['NO', 700000, { noRes: 'paye', noNi: false }], ['SE', 900000, {}], ['EE', 48000, { eePension: true }], ['FI', 72000, { fiChurch: 1 }], ['BE', 90000, { beStatus: 'married', beKids: 3 }],
  ['IT', 18000, {}], ['CH', 200000, { chStatus: 'married', chKids: 2, chChurch: true }], ['FR', 120000, { frCadre: 'cadre', frMarried: true, frKids: 3, frMutuelle: 600 }],
  ['ES', 40000, { esKids: 4, esTemp: true }], ['PT', 60000, { ptRegime: 'jovem', ptJovemYear: 5, ptDepYoung: 2, ptRent: 6000 }], ['JP', 8e6, { jpCare: true, jpSupport: 9 }],
  ['KR', 100e6, { krDeps: 2 }], ['CA', 100000, { caProv: 'ON', caKids: 2 }], ['CA', 60000, { caProv: 'BC' }], ['CA', 60000, { caProv: 'AB' }], ['CA', 60000, { caProv: 'QC' }],
  ['HK', 720000, { hkMarried: true, hkKids: 1 }], ['CN', 480000, { cnRes: 'expat', cnAllow: 100000 }], ['TW', 6e6, { twGold: true }], ['SA', 300000, { gulfNat: 'national', saScheme: 'new', gulfWagePct: 70 }],
  ['BH', 120000, { gulfNat: 'expat' }], ['OM', 60000, {}], ['FR', 600000, { frCadre: 'cadre' }], ['FR', 1500000, { frCadre: 'cadre', frMarried: true, frKids: 2 }]
];
let lineIssues = 0;
for(const [c, g, k] of SAMPLE){
  const r = E.compute(c, g, k);
  if(r.notSupported){ check('lines: ' + c + ' ' + g + ' ' + JSON.stringify(k) + ' supported', false, r.reason); continue; }
  const sum = kind => r.lines.filter(l => l.kind === kind).reduce((a, l) => a + l.amount, 0);
  const ok = near(sum('tax'), r.tax, 1e-6) && near(sum('social'), r.social, 1e-6) && near(r.net, r.gross - r.tax - r.social - r.other + r.benefit, 1e-6)
    && r.lines.every(l => isFinite(l.amount) && E.SRC[l.src] && ['official', 'secondary', 'assumption'].includes(l.status) && l.label)
    && r.lines.filter(l => ['tax', 'social', 'other', 'benefit'].includes(l.kind)).every(l => l.amount >= -1e-9);
  if(!ok) lineIssues++;
  check('lines add up: ' + c + ' ' + g + ' ' + JSON.stringify(k), ok, '', true);
}
console.log(`  lines: ${SAMPLE.length - lineIssues}/${SAMPLE.length} sample cases add up with known sources`);

/* ── 3b. Taxable income adds up: the page's first block is gross pay plus
   the lines marked base (+1 added, -1 taken off), floored at 0, and it must
   land on r.taxable. Every sample case, at seven pay levels from a fifth to
   five times its own. ─────────────────────────────────────────────────────── */
{ let bad = 0, n = 0; const misses = [];
  for(const [c, g0, k] of SAMPLE) for(const f of [0.2, 0.5, 0.8, 1, 1.5, 2.5, 5]){
    const r = E.compute(c, g0*f, k);
    if(r.notSupported || r.taxable == null) continue;   // the Gulf states: no income tax
    n++;
    const built = Math.max(0, r.gross + r.lines.reduce((a, l) => a + (l.base ? l.base*l.amount : 0), 0));
    const ok = near(built, r.taxable, 0.01) && r.lines.every(l => !l.base || l.base === 1 || l.base === -1);
    if(!ok){ bad++; if(misses.length < 4) misses.push(c + ' ' + Math.round(g0*f) + ' built ' + built.toFixed(2) + ' vs ' + Number(r.taxable).toFixed(2)); }
  }
  check('taxable income: gross and the base lines land on r.taxable (' + n + ' cases)', bad === 0, misses.join(' | '));
  console.log(`  taxable income: ${n - bad}/${n} cases add up from gross`); }

/* ── 3c. Tax by bracket adds up: a tax line's brackets (each the slice of the
   base between its edges at its rate), its credits and surcharges, and the
   rounding left over make the line. The brackets run from 0 to the base
   without a gap, and only rounding is left: at most 1 unit, 3 in Germany
   (income and tax to whole euros), 100 in Japan (tax down to 100 yen).
   Every sample case, at the same seven pay levels. ───────────────────────── */
{ let bad = 0, n = 0; const misses = [];
  const REST = { DE: 3, JP: 100 };
  for(const [c, g0, k] of SAMPLE) for(const f of [0.2, 0.5, 0.8, 1, 1.5, 2.5, 5]){
    const r = E.compute(c, g0*f, k);
    if(r.notSupported) continue;
    for(const l of r.lines.filter(l => l.brackets)){
      n++;
      const b = l.brackets, sum = b.rows.reduce((a, x) => a + x.amount, 0) + b.adj.reduce((a, x) => a + x.amount, 0) + b.rest;
      let lo = 0, gap = false;
      for(const x of b.rows){ if(!near(x.lo, lo, 1e-6) || x.hi < x.lo || x.amount < -1e-9) gap = true; lo = x.hi; }
      const ok = near(sum, l.amount, 1e-6) && !gap && near(lo, b.base, 1e-6) && Math.abs(b.rest) <= (REST[c] || 1);
      if(!ok){ bad++; if(misses.length < 4) misses.push(c + ' ' + l.id + ' ' + Math.round(g0*f) + ' rest ' + b.rest.toFixed(2)); }
    }
  }
  check('tax by bracket: brackets, credits and rounding make each line (' + n + ' lines)', bad === 0 && n > 0, misses.join(' | '));
  console.log(`  tax by bracket: ${n - bad}/${n} lines add up from their brackets`); }

/* ── 4. Layer D: round trips, non-negativity, caps ───────────────────────── */
let seed = 12345;
const rnd = () => { seed = (seed*1103515245 + 12345) % 2147483648; return seed/2147483648; };
const PRESETS = [
  ['AU', {}], ['SG', { sgRes: 'citizen' }], ['GB', { ukRegion: 'sco' }], ['DE', {}], ['US', { usState: 'NY', usFiling: 'S' }], ['US', { usState: 'NY', usFiling: 'MFJ', usNyc: true }],
  ['US', { usState: 'CA', usFiling: 'MFJ' }], ['US', { usState: 'IL' }], ['US', { usState: 'TX', usRes: 'nra' }], ['ID', { idMarried: true, idDeps: 2 }],
  ['TH', {}], ['MY', {}], ['NL', { nlRuling: true, nlHoliday: true }], ['NO', {}], ['SE', {}], ['EE', {}], ['FI', { fiChurch: 1 }], ['BE', { beStatus: 'married', beKids: 2 }],
  ['IT', { itImp: 'imp50' }], ['CH', { chStatus: 'married', chKids: 2 }], ['FR', { frCadre: 'cadre' }], ['FR', { frImp: true, frCadre: 'cadre' }], ['ES', { esKids: 2 }],
  ['PT', { ptRegime: 'jovem', ptJovemYear: 2 }], ['JP', {}], ['KR', {}], ['CA', { caProv: 'ON' }], ['CA', { caProv: 'QC' }], ['HK', {}], ['CN', {}], ['TW', { twGold: true }],
  ['AE', { gulfNat: 'national' }], ['SA', { gulfNat: 'national', saScheme: 'new' }]
];
const SCALE = { ID: 3e6*12/40, JP: 100, KR: 1000, TW: 30, TH: 30, NO: 10, SE: 10, CN: 7, HK: 8, IN: 1 };
/* Where the law steps net pay UP (Italy's art. 13 credit at R = 15,000, the
   +65 band), some take-home figures have no gross at all. There the solver must
   return the lowest gross that reaches the target: net there meets it, and a
   unit less falls short. That counts as a pass and is reported as a step. */
let steps = 0;
for(const [c, k] of PRESETS){
  let worst = 0, n = 0, negatives = 0, unsupported = 0;
  for(let i = 0; i < 50; i++){
    const target = (20000 + rnd()*280000)*(SCALE[c] || 1);
    const s = E.solveGross(c, target, k);
    if(s.notSupported){ unsupported++; continue; }
    const r = E.compute(c, s.gross, k);
    if(r.notSupported){ unsupported++; continue; }
    let d = Math.abs(r.net - target);
    if(d > 1 && r.net >= target){
      const before = E.compute(c, s.gross - 1, k);
      if(!before.notSupported && before.net < target){ steps++; d = 0; }
    }
    worst = Math.max(worst, d); n++;
    if(r.net < 0 || (r.tax < -1e-9 && c !== 'IT')) negatives++;
  }
  check('round trip ' + c + ' ' + JSON.stringify(k), n >= 45 && worst <= 1 && negatives === 0,
    n + ' targets, worst |net - target| ' + worst.toFixed(3) + (unsupported ? ', ' + unsupported + ' unsupported' : '') + (negatives ? ', ' + negatives + ' negative' : ''), true);
}
console.log('  round trips: ' + PRESETS.length + ' presets × 50 targets (' + steps + ' land on a statutory step, at the lowest gross that reaches them)');
{ // Belgium below the minimum wage: a take-home only a lower gross gives is unsupported, never a wrong gross.
  const low = E.solveGross('BE', 5000, {});
  check('BE take-home below the minimum-wage range is NOT_SUPPORTED', !!low.notSupported);
  const ok = E.solveGross('BE', 30000, {});
  check('BE take-home 30,000 solves', !ok.notSupported && Math.abs(E.compute('BE', ok.gross, {}).net - 30000) <= 1);
  const pay = E.solveGross('NO', 600000, { noRes: 'paye' });
  check('NO PAYE take-home above what 725,050 gives is NOT_SUPPORTED', !!pay.notSupported);
}

const capChk = (name, fn) => { let ok = true; for(const g of [1e5, 3e5, 1e6, 5e6]) ok = ok && fn(g); check('cap holds: ' + name, ok, '', true); };
const line = (c, g, k, id) => (E.compute(c, g, k).lines.find(l => l.id === id) || { amount: 0 }).amount;
capChk('SG CPF 8,000 a month', g => line('SG', g, { sgRes: 'citizen' }, 'sgCpf') <= 0.20*8000*12 + 1e-6);
capChk('DE pension 101,400', g => line('DE', g, {}, 'deRv') <= 0.093*101400 + 1e-6);
capChk('KR NPS 6.59M', g => line('KR', g*100, {}, 'krNps') <= 12*0.0475*6.59e6 + 1e-6);
capChk('CA CPP, CPP2, EI', g => line('CA', g, {}, 'caCpp') <= 0.0595*(74600 - 3500) + 1e-6 && line('CA', g, {}, 'caCpp2') <= 0.04*(85000 - 74600) + 1e-6 && line('CA', g, {}, 'caEi') <= 0.0163*68900 + 1e-6);
capChk('ON LIFT 875 and BC reduction 690', g => line('CA', g/5, { caProv: 'ON' }, 'caLift') <= 875 + 1e-6 && line('CA', g/5, { caProv: 'BC' }, 'caBcRed') <= 690 + 1e-6);
capChk('HK MPF 1,500 a month', g => E.compute('HK', g, {}).social <= 18000 + 1e-6);
capChk('FR T1 and CSG', g => line('FR', g, {}, 'frVieil') <= 0.069*48060 + 0.004*g + 1e-6);
capChk('ES SS base 5,101.20 a month', g => line('ES', g, {}, 'esSs') <= 0.065*12*5101.20 + 1e-6);
capChk('IT INPS 122,295', g => line('IT', g, {}, 'itInps') <= 0.0919*122295 + 0.01*(122295 - 56224) + 1e-6);
capChk('CH ALV 148,200 and BVG 64,260', g => line('CH', g, {}, 'chAlv') <= 0.011*148200 + 1e-6 && line('CH', g, {}, 'chBvg') <= 0.05*64260 + 1e-6);
capChk('BE CSSS 731.28 a year', g => line('BE', g, {}, 'beCsss') <= 731.28 + 1e-6);
capChk('US PFL 411.91', g => line('US', g, { usState: 'NY' }, 'usNyPfl') <= 411.91 + 1e-6);
capChk('TW labour insurance and NHI', g => line('TW', g*10, {}, 'twLi') <= 12*0.025*45800 + 1e-6 && line('TW', g*10, {}, 'twNhi') <= 12*0.0517*0.3*219500 + 1e-6);
capChk('BH 4,000 a month', g => E.compute('BH', g, { gulfNat: 'national' }).social <= 12*0.08*4000 + 1e-6);
capChk('JP pension 650k a month', g => line('JP', g*100, {}, 'jpPension') <= 12*jpRound(650000*0.0915) + 1e-6);
function jpRound(x){ const f = Math.floor(x); return x - f > 0.5 ? f + 1 : f; }

/* Guards: a gated state or a range guard returns NOT_SUPPORTED, never a number. */
for(const st of Object.keys(E.US_ST_GATED)) check('gated state ' + st + ' is NOT_SUPPORTED', !!E.compute('US', 80000, { usState: st }).notSupported, '', true);
check('BE below 12 x minimum wage is NOT_SUPPORTED', !!E.compute('BE', 26000, {}).notSupported);
check('FI key employee below 69,600 is NOT_SUPPORTED', !!E.compute('FI', 69000, { fiRes: 'key' }).notSupported);
check('NO PAYE above 725,050 is NOT_SUPPORTED', !!E.compute('NO', 725051, { noRes: 'paye' }).notSupported);
check('solveGross through a gated state is NOT_SUPPORTED', !!E.solveGross('US', 60000, { usState: 'OH' }).notSupported);

console.log(`\n${pass} passed, ${fail} failed`);
if(fail){ console.log('Failures:\n  ' + fails.slice(0, 40).join('\n  ')); process.exit(1); }
