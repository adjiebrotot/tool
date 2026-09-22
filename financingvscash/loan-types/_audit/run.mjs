/* ============================================================================
   Loan Types Explained — audit harness

   The page prints worked numbers in its prose and in its key-figure cards, and
   a reader is meant to be able to take those numbers to a calculator. So they
   have to be right, and they have to stay right if the page is edited.

   This drives the real page in headless Chromium and checks three things:

     1. Every [data-fig] figure written into the markup matches an INDEPENDENT
        replay of the documented mathematics, written here from the formulas the
        page itself prints, not imported from the page's script.
     2. The page's own engine agrees with that replay, schedule row by schedule
        row, so the charts cannot drift from the prose.
     3. The page renders: no errors, every chart slot holds one SVG, and the
        bars in a split chart account for every period that has a payment.

   Run: node financingvscash/loan-types/_audit/run.mjs
============================================================================ */

import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  console.log((ok ? '  PASS  ' : '✗ FAIL  ') + name + (detail ? '  — ' + detail : ''));
  ok ? pass++ : fail++;
};

/* ────────────────────────────────────────────────────────────────────────────
   THE INDEPENDENT REPLAY

   Written from the formulas printed on the page, in the page's own words:

     r          = (1 + annual)^(1/12) - 1                  (effective, default)
     r          = annual rate / 12                          (nominal, flat quotes)
     annuity    PMT = P r(1+r)^n / ((1+r)^n - 1)
     each row   interest = balance x r, principal = PMT - interest
     flat       interest = P x r every period, principal = P / n
     IO         PMT = balance x r for k periods, then the annuity on what is left
     balloon    PMT = (P - R/(1+r)^n) x r(1+r)^n / ((1+r)^n - 1), final = PMT + R
     bullet     final = P (1+r)^n
     deferred   balance grows to P (1+r)^k, then the annuity over n - k
     known      solve r from balance_i = balance_(i-1)(1+r) - payment_i, end 0
     effective  (1 + irr)^12 - 1, irr from the actual payment stream

   Deliberately a second implementation: no shared helpers with the page, and
   the annuity is written from the closed form each time rather than reused.
──────────────────────────────────────────────────────────────────────────── */

const pow = (x, k) => Math.pow(x, k);

function annuity(balance, r, periods) {
  if (periods <= 0) return balance;
  if (balance <= 0) return 0;
  if (r === 0) return balance / periods;
  return balance * r * pow(1 + r, periods) / (pow(1 + r, periods) - 1);
}

function periodRate(annual, convention) {
  return convention === 'nominal' ? annual / 1200 : pow(1 + annual / 100, 1 / 12) - 1;
}

function replay(spec) {
  const n = spec.stream ? spec.stream.length : spec.n;
  const k = Math.min(n, spec.k || 0);
  const R = spec.type === 'balloon' ? spec.P * (spec.residualPct || 0) / 100 : 0;
  const r = spec.type === 'knownPayment'
    ? solve(spec.P, spec.stream)
    : periodRate(spec.annual, spec.conv);

  const rows = [];
  let balance = spec.P, interestTotal = 0;

  for (let i = 1; i <= n; i++) {
    let payment;
    const interest = spec.type === 'flat' ? spec.P * r : balance * r;

    if (spec.type === 'flat') {
      payment = (i === n) ? balance + interest : spec.P / n + interest;
    } else if (i === n) {
      payment = balance + interest;
    } else if (spec.type === 'annuity') {
      payment = annuity(balance, r, n - i + 1);
    } else if (spec.type === 'interestOnly') {
      payment = i <= k ? interest : annuity(balance, r, n - i + 1);
    } else if (spec.type === 'balloon') {
      payment = annuity(balance - R / pow(1 + r, n - i + 1), r, n - i + 1);
    } else if (spec.type === 'bullet') {
      payment = 0;
    } else if (spec.type === 'deferred') {
      payment = i <= k ? 0 : annuity(balance, r, n - i + 1);
    } else {
      payment = spec.stream[i - 1];
    }

    let principal = payment - interest;
    if (principal > balance) principal = balance;
    const endBalance = (i === n) ? 0 : Math.max(0, balance - principal);
    rows.push({ i, payment, interest, principal, endBalance });
    interestTotal += interest;
    balance = endBalance;
  }

  const irr = solve(spec.P, rows.map(row => row.payment));
  const firstPaying = rows.find(row => row.payment > 0.005);
  return {
    rows,
    first: rows[0].payment,
    final: rows[n - 1].payment,
    afterK: k > 0 && rows[k] ? rows[k].payment : (firstPaying ? firstPaying.payment : 0),
    balAfterK: k > 0 && rows[k - 1] ? rows[k - 1].endBalance : spec.P,
    interest: interestTotal,
    paid: rows.reduce((sum, row) => sum + row.payment, 0),
    ear: (pow(1 + irr, 12) - 1) * 100
  };
}

/* The rate a stream implies, found by bisection on the closing balance. Written
   against the discounted form here rather than the page's forward recursion, so
   an error in one would not hide in the other. */
function closingGap(P, payments, r) {
  let pv = 0;
  for (let i = 0; i < payments.length; i++) pv += payments[i] / pow(1 + r, i + 1);
  return P - pv;                       /* zero when the stream repays exactly */
}
function solve(P, payments) {
  /* closingGap rises with r: deeply negative when the stream overpays at a zero
     rate, positive once the rate is high enough to swallow it. So a stream that
     repays MORE than the principal has its root above zero, and one that repays
     less has it below. */
  let lo = 1e-12, hi = 4;
  if (closingGap(P, payments, lo) > 0) { lo = -0.9; hi = 0; }
  for (let i = 0; i < 400; i++) {
    const mid = (lo + hi) / 2;
    if (closingGap(P, payments, mid) > 0) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

/* ────────────────────────────────────────────────────────────────────────────
   THE SPECS, restated from the page's prose rather than read from its script.
──────────────────────────────────────────────────────────────────────────── */

const fill = (v, c) => Array(c).fill(v);

const SPECS = {
  /* Quick Start > Car, "5yr loan, 10% down": $45,000 less 10% at 8.4%. */
  'ex-amort':         { type: 'annuity',      P: 40500,    annual: 8.4,  n: 60 },
  /* Quick Start > Motorbike: Rp 35,000,000 less 20% at 0.9% a month flat.
     The preset switches Rate Convention to Nominal, so the replay does too. */
  'ex-flat-id':       { type: 'flat',         P: 28000000, annual: 10.8, n: 36, conv: 'nominal' },
  /* "$50,000 machine sold for $60,000 in 48 instalments", a flat 5% a year. */
  'ex-flat-murabaha': { type: 'flat',         P: 50000,    annual: 5,    n: 48, conv: 'nominal' },
  /* Quick Start > House, the 30-year loan, with 5 years interest-only. */
  'ex-io-prop':       { type: 'interestOnly', P: 520000,   annual: 6.1,  n: 360, k: 60 },
  /* "$80,000 at 10% for 12 months", interest-only throughout. */
  'ex-io-bridge':     { type: 'interestOnly', P: 80000,    annual: 10,   n: 12, k: 12 },
  /* Quick Start > Car, "5yr with 35% balloon": the same loan as ex-amort. */
  'ex-balloon':       { type: 'balloon',      P: 40500,    annual: 8.4,  n: 60, residualPct: 35 },
  /* Quick Start > Phone: an $1,800 phone on three plans that quote no rate. */
  'ex-known-zero':    { type: 'knownPayment', P: 1800,     stream: fill(150, 12) },
  'ex-known-24':      { type: 'knownPayment', P: 1800,     stream: fill(82, 24) },
  'ex-known-36':      { type: 'knownPayment', P: 1800,     stream: fill(57, 36) },
  /* "$100,000 at 12% for 24 months", settled in one payment. */
  'ex-bullet':        { type: 'bullet',       P: 100000,   annual: 12,   n: 24 },
  /* Quick Start > Deferred: $6,000, 12 months of nothing, then 24 payments. */
  'ex-deferred':      { type: 'deferred',     P: 6000,     annual: 19.9, n: 36, k: 12 },

  /* "The Same Loan, Six Ways": the car loan, $40,500 over 60 at 8.4%. */
  'cmp-annuity':      { type: 'annuity',      P: 40500, annual: 8.4, n: 60 },
  'cmp-flat':         { type: 'flat',         P: 40500, annual: 8.4, n: 60 },
  'cmp-interestOnly': { type: 'interestOnly', P: 40500, annual: 8.4, n: 60, k: 60 },
  'cmp-balloon':      { type: 'balloon',      P: 40500, annual: 8.4, n: 60, residualPct: 35 },
  'cmp-bullet':       { type: 'bullet',       P: 40500, annual: 8.4, n: 60 },
  'cmp-deferred':     { type: 'deferred',     P: 40500, annual: 8.4, n: 60, k: 12 }
};

/* The scenarios the prose compares each example AGAINST. Named so the claims
   below read as arithmetic rather than as magic constants. */
const AGAINST = {
  car3yr:     { type: 'annuity', P: 40500,    annual: 8.4,  n: 36 },
  car5yr:     { type: 'annuity', P: 40500,    annual: 8.4,  n: 60 },
  motorbike:  { type: 'annuity', P: 28000000, annual: 10.8, n: 36, conv: 'nominal' },
  house30:    { type: 'annuity', P: 520000,   annual: 6.1,  n: 360 },
  bullet24:   { type: 'annuity', P: 100000,   annual: 12,   n: 24 },
  deferred36: { type: 'annuity', P: 6000,     annual: 19.9, n: 36 }
};

/* Money is printed rounded, so a difference a reader works out by subtracting
   two printed figures is a difference of ROUNDED values. That is the number
   the prose has to carry, not the unrounded one. */
const r2 = v => Math.round(v * 100) / 100;
const diff = (a, b) => r2(r2(a) - r2(b));

/* Claims the prose makes in passing, each one an arithmetic statement about two
   scenarios. Written out so a later edit to the copy cannot quietly go stale. */
const PROSE_CLAIMS = [
  { what: 'the 3-year car loan is $1,270.86 a month',
    value: () => r2(replay(AGAINST.car3yr).first), expect: 1270.86 },
  { what: 'the 3-year car loan costs $5,250.97 of interest',
    value: () => r2(replay(AGAINST.car3yr).interest), expect: 5250.97 },
  { what: 'month one of the car loan charges $273.14 of interest',
    value: () => r2(replay(SPECS['ex-amort']).rows[0].interest), expect: 273.14 },
  { what: 'month one of the car loan clears $549.86 of principal',
    value: () => r2(replay(SPECS['ex-amort']).rows[0].principal), expect: 549.86 },
  { what: 'the last car payment is $5.51 interest',
    value: () => r2(replay(SPECS['ex-amort']).rows[59].interest), expect: 5.51 },

  { what: 'the motorbike on an amortizing loan is Rp 914,034 a month',
    value: () => Math.round(replay(AGAINST.motorbike).first), expect: 914034 },
  { what: 'the motorbike on an amortizing loan costs Rp 4,905,238 of interest',
    value: () => Math.round(replay(AGAINST.motorbike).interest), expect: 4905238 },
  { what: 'the flat quote costs Rp 4,166,762 more',
    value: () => Math.round(replay(SPECS['ex-flat-id']).interest)
               - Math.round(replay(AGAINST.motorbike).interest), expect: 4166762 },
  { what: 'the flat motorbike charges Rp 252,000 of interest a month',
    value: () => Math.round(replay(SPECS['ex-flat-id']).rows[0].interest), expect: 252000 },

  { what: 'the plain 30-year house loan is $3,096.24 a month',
    value: () => r2(replay(AGAINST.house30).first), expect: 3096.24 },
  { what: 'the plain 30-year house loan costs $594,645.74 of interest',
    value: () => r2(replay(AGAINST.house30).interest), expect: 594645.74 },
  { what: 'the interest-only start costs $38,684.31 extra',
    value: () => diff(replay(SPECS['ex-io-prop']).interest, replay(AGAINST.house30).interest),
    expect: 38684.31 },
  { what: 'the interest-only start saves $524.05 a month',
    value: () => diff(replay(AGAINST.house30).first, replay(SPECS['ex-io-prop']).first), expect: 524.05 },
  { what: 'those savings come to $31,443.00 over five years',
    value: () => r2(diff(replay(AGAINST.house30).first, replay(SPECS['ex-io-prop']).first) * 60),
    expect: 31443.00 },

  { what: 'the residual saves $192.45 a month',
    value: () => diff(replay(AGAINST.car5yr).first, replay(SPECS['ex-balloon']).first), expect: 192.45 },
  { what: 'those savings come to $11,547.00 over five years',
    value: () => r2(diff(replay(AGAINST.car5yr).first, replay(SPECS['ex-balloon']).first) * 60),
    expect: 11547.00 },
  { what: 'the residual costs $2,627.94 of extra interest',
    value: () => diff(replay(SPECS['ex-balloon']).interest, replay(AGAINST.car5yr).interest),
    expect: 2627.94 },
  { what: 'the residual itself is $14,175',
    value: () => r2(40500 * 0.35), expect: 14175 },

  { what: '12 x $150 really is interest free',
    value: () => r2(replay(SPECS['ex-known-zero']).interest), expect: 0 },
  { what: 'month one of the 24-month phone plan charges $13.08',
    value: () => r2(replay(SPECS['ex-known-24']).rows[0].interest), expect: 13.08 },
  { what: 'month one of the 36-month phone plan charges $13.07',
    value: () => r2(replay(SPECS['ex-known-36']).rows[0].interest), expect: 13.07 },
  { what: 'month one of the 36-month phone plan clears only $43.93',
    value: () => r2(replay(SPECS['ex-known-36']).rows[0].principal), expect: 43.93 },
  { what: 'the smallest instalment carries the biggest bill',
    value: () => r2(replay(SPECS['ex-known-36']).interest - replay(SPECS['ex-known-24']).interest),
    expect: 84 },

  { what: 'an amortizing loan against the bullet costs $4,678.75 a month',
    value: () => r2(replay(AGAINST.bullet24).first), expect: 4678.75 },
  { what: 'an amortizing loan against the bullet costs $12,290.02 of interest',
    value: () => r2(replay(AGAINST.bullet24).interest), expect: 12290.02 },
  { what: 'the bullet costs $13,149.98 more than amortizing',
    value: () => diff(replay(SPECS['ex-bullet']).interest, replay(AGAINST.bullet24).interest),
    expect: 13149.98 },

  { what: 'the deferred loan without a holiday is $217.78 a month',
    value: () => r2(replay(AGAINST.deferred36).first), expect: 217.78 },
  { what: 'the deferred loan without a holiday costs $1,840.02 of interest',
    value: () => r2(replay(AGAINST.deferred36).interest), expect: 1840.02 },
  { what: 'the holiday costs $803.61',
    value: () => diff(replay(SPECS['ex-deferred']).interest, replay(AGAINST.deferred36).interest),
    expect: 803.61 },
  { what: 'the holiday capitalises $1,194.00 of interest',
    value: () => diff(replay(SPECS['ex-deferred']).balAfterK, 6000), expect: 1194.00 },

  { what: 'the flat rate and the pure interest-only loan cost the same $16,388.24',
    value: () => r2(replay(SPECS['cmp-flat']).interest - replay(SPECS['cmp-interestOnly']).interest),
    expect: 0 },
  { what: 'the $40,500 flat loan charges $273.14 of interest a month',
    value: () => r2(replay(SPECS['cmp-flat']).rows[0].interest), expect: 273.14 },
  { what: 'the cheapest structure costs less than half of the dearest',
    value: () => replay(SPECS['cmp-annuity']).interest < replay(SPECS['cmp-bullet']).interest / 2 ? 1 : 0,
    expect: 1 }
];

/* ────────────────────────────────────────────────────────────────────────────
   SERVE AND DRIVE THE REAL PAGE
──────────────────────────────────────────────────────────────────────────── */

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
               '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
               '.png': 'image/png', '.jpg': 'image/jpeg', '.xml': 'application/xml', '.txt': 'text/plain' };
const server = createServer((req, res) => {
  const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  let file = join(ROOT, rel);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;

const browser = await pw.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
/* Offline: the only third party is the font stylesheet and the analytics tag. */
await ctx.route('**', route => route.request().url().startsWith(ORIGIN)
  ? route.continue()
  : route.fulfill({ status: 200, contentType: 'text/css', body: '' }));

const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
page.on('console', m => { if (m.type() === 'error') pageErrors.push(m.text()); });
await page.goto(ORIGIN + '/financingvscash/loan-types/', { waitUntil: 'networkidle' });
await page.waitForTimeout(250);

console.log('\n── Page health ───────────────────────────────────────────────');
check('no page errors', pageErrors.length === 0, pageErrors.join(' | '));

/* Open every card so every chart is asked to draw itself. */
await page.evaluate(() => {
  document.querySelectorAll('.section-card').forEach(card => {
    card.querySelector('.section-header')?.classList.remove('collapsed');
    card.querySelector('.section-body')?.classList.remove('hidden');
  });
  window.renderAll();
});
await page.waitForTimeout(250);

const slots = await page.$$eval('.chart-slot', els => els.map(el => ({
  chart: el.dataset.chart, view: el.dataset.view,
  svgs: el.querySelectorAll('svg').length,
  groups: el.querySelectorAll('g').length
})));
check('every chart slot holds exactly one SVG',
  slots.length > 0 && slots.every(s => s.svgs === 1),
  slots.filter(s => s.svgs !== 1).map(s => s.chart + '/' + s.view).join(', '));
const sparks = await page.$$eval('.shape-spark', els => els.map(el => el.querySelectorAll('svg').length));
check('all seven shape sparklines drew', sparks.length === 7 && sparks.every(n => n === 1), sparks.join(','));

/* A split chart draws one group per period that actually has a payment. */
console.log('\n── Charts against the replay ─────────────────────────────────');
for (const slot of slots.filter(s => s.view === 'split')) {
  const spec = SPECS[slot.chart];
  if (!spec) { check('split chart ' + slot.chart + ' has a spec', false); continue; }
  const rows = replay(spec).rows;
  if (rows.length > 84) continue;                    /* long loans draw areas */
  const paying = rows.filter(row => row.payment > 0.005).length;
  check(`${slot.chart}: ${paying} bars, one per paying period`, slot.groups === paying,
        'drew ' + slot.groups);
}

/* ────────────────────────────────────────────────────────────────────────────
   THE PAGE ENGINE AGAINST THE REPLAY
──────────────────────────────────────────────────────────────────────────── */

console.log('\n── Page engine against the replay ────────────────────────────');
const engine = await page.evaluate(keys => {
  const api = window.__LOAN_TYPES;
  const all = Object.assign({}, api.EXAMPLES);
  api.COMPARISON.forEach(c => { all[c.key] = c.cfg; });
  const out = {};
  for (const key of keys) {
    const s = api.buildSchedule(all[key]);
    out[key] = {
      first: s.first, final: s.final, afterK: s.afterK, balAfterK: s.balAfterK,
      interest: s.totalInterest, paid: s.totalPaid, ear: s.ear,
      rows: s.rows.map(r => [r.payment, r.interest, r.principal, r.endBal])
    };
  }
  return out;
}, Object.keys(SPECS));

for (const key of Object.keys(SPECS)) {
  const mine = replay(SPECS[key]);
  const theirs = engine[key];
  if (!theirs) { check(key + ': page engine has the scenario', false); continue; }
  let worst = 0, where = '';
  mine.rows.forEach((row, idx) => {
    const t = theirs.rows[idx];
    [['payment', row.payment, t[0]], ['interest', row.interest, t[1]],
     ['principal', row.principal, t[2]], ['balance', row.endBalance, t[3]]]
      .forEach(([field, a, b]) => {
        const d = Math.abs(a - b);
        if (d > worst) { worst = d; where = `row ${idx + 1} ${field}: ${a} vs ${b}`; }
      });
  });
  const tol = Math.max(1e-6, SPECS[key].P * 1e-9);
  check(`${key}: every schedule row matches (${mine.rows.length} rows)`, worst <= tol,
        worst > tol ? where : `worst ${worst.toExponential(2)}`);
  check(`${key}: effective rate matches`, Math.abs(mine.ear - theirs.ear) < 1e-6,
        `${mine.ear} vs ${theirs.ear}`);
}

/* ────────────────────────────────────────────────────────────────────────────
   THE PRINTED FIGURES AGAINST THE REPLAY
──────────────────────────────────────────────────────────────────────────── */

console.log('\n── Printed figures against the replay ────────────────────────');
const figures = await page.$$eval('[data-fig]', els =>
  els.map(el => [el.dataset.fig, el.textContent.trim()]));
check('the page prints figures to check', figures.length >= 50, figures.length + ' found');

for (const [ref, text] of figures) {
  const [key, field] = ref.split('.');
  const spec = SPECS[key];
  if (!spec) { check(ref + ': has a spec to check against', false, 'text ' + text); continue; }
  const expected = replay(spec)[field];
  if (expected === undefined) { check(ref + ': names a known figure', false); continue; }

  const digits = text.replace(/[^0-9.]/g, '');
  const shown = parseFloat(digits.replace(/(\..*)\./g, '$1'));
  const printed = parseFloat(text.replace(/[^0-9.\-]/g, ''));
  const dp = (text.split('.')[1] || '').replace(/[^0-9]/g, '').length;
  const rounded = Math.round(expected * Math.pow(10, dp)) / Math.pow(10, dp);
  check(`${ref} prints ${text}`, Math.abs(printed - rounded) < Math.pow(10, -dp) / 2 + 1e-9,
        'replay says ' + rounded + (Number.isNaN(shown) ? '' : ''));
}

console.log('\n── Claims made in the prose ──────────────────────────────────');
for (const claim of PROSE_CLAIMS) {
  const got = Math.round(claim.value() * 100) / 100;
  check(claim.what, Math.abs(got - claim.expect) < 0.005, 'replay says ' + got);
}

/* The FAQ answers and the structured data repeat those figures, so the numbers
   that appear in both places have to be the ones the replay produces. */
console.log('\n── Figures repeated in the FAQ and the structured data ───────');
/* The FAQ answers and the structured data repeat figures the cards already
   print. A reader who reads only the FAQ still has to be told the truth, so
   each literal is held to the replay AND has to actually be in the copy. The
   page text is read with textContent, because a collapsed FAQ answer is still
   part of what the page says. */
const bodyText = await page.evaluate(() => document.body.textContent.replace(/\s+/g, ' '));
const ldText = await page.$$eval('script[type="application/ld+json"]', els =>
  els.map(e => e.textContent).join(' ').replace(/\s+/g, ' '));

const group = (v, dp) => v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
const REPEATED = [
  ['8,879.82',    () => replay(SPECS['cmp-annuity']).interest, 2],
  ['16,388.24',   () => replay(SPECS['cmp-flat']).interest, 2],
  ['15.25',       () => replay(SPECS['cmp-flat']).ear, 2],
  ['8.40',        () => replay(SPECS['cmp-annuity']).ear, 2],
  ['21.03',       () => replay(SPECS['ex-flat-id']).ear, 2],
  ['9,072,000',   () => replay(SPECS['ex-flat-id']).interest, 0],
  ['4,905,238',   () => replay(AGAINST.motorbike).interest, 0],
  ['9.08',        () => replay(SPECS['ex-known-24']).ear, 2],
  ['9.07',        () => replay(SPECS['ex-known-36']).ear, 2],
  ['823.00',      () => replay(SPECS['ex-amort']).first, 2],
  ['630.55',      () => replay(SPECS['ex-balloon']).first, 2],
  ['11,507.76',   () => replay(SPECS['ex-balloon']).interest, 2],
  ['14,805.55',   () => replay(SPECS['ex-balloon']).final, 2],
  ['7,194.00',    () => replay(SPECS['ex-deferred']).balAfterK, 2],
  ['360.15',      () => replay(SPECS['ex-deferred']).afterK, 2],
  ['2,643.63',    () => replay(SPECS['ex-deferred']).interest, 2],
  ['125,440.00',  () => replay(SPECS['ex-bullet']).final, 2],
  ['594,645.74',  () => replay(AGAINST.house30).interest, 2],
  ['3,096.24',    () => replay(AGAINST.house30).first, 2],
  ['217.78',      () => replay(AGAINST.deferred36).first, 2],
  ['1,840.02',    () => replay(AGAINST.deferred36).interest, 2],
  ['12,290.02',   () => replay(AGAINST.bullet24).interest, 2]
];
for (const [literal, value, dp] of REPEATED) {
  check(`"${literal}" is what the replay produces`, group(value(), dp) === literal,
    'replay says ' + group(value(), dp));
  check(`"${literal}" appears in the page copy`, bodyText.includes(literal), '');
}
check('the structured data repeats the flat-rate effective rate', ldText.includes('21.03'));
check('the structured data repeats the deferred balance', ldText.includes('7,194.00'));
check('the structured data repeats the residual payment', ldText.includes('14,805.55'));

/* Every card names the markets the structure is sold in. A definition without
   one is an edit that lost it. */
console.log('\n── Jurisdictions and Quick Start pointers ────────────────────');
const wheres = await page.$$eval('.section-card[id^="type-"]', cards => cards.map(c => ({
  id: c.id,
  rows: c.querySelectorAll('.where-row').length,
  chips: c.querySelectorAll('.where-chip').length
})));
check('all seven loan-type cards are present', wheres.length === 7, wheres.length + ' found');
for (const w of wheres) {
  check(`${w.id} names where it is used`, w.rows === 1 && w.chips >= 3,
    w.rows + ' rows, ' + w.chips + ' chips');
}
const badges = await page.$$eval('.qs-badge', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
check('every example says which Quick Start preset it is', badges.length >= 7, badges.length + ' badges');

/* And the tool has to point back here, next to the control it explains. */
const toolLink = await page.evaluate(async origin => {
  const html = await (await fetch(origin + '/financingvscash/')).text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const row = doc.getElementById('scLoanTypeRow');
  const link = row && row.querySelector('a[href="loan-types/"]');
  return { row: !!row, link: !!link, text: link ? link.textContent.trim() : '' };
}, ORIGIN);
check('the tool links here from under the Loan Type control',
  toolLink.row && toolLink.link, JSON.stringify(toolLink));

await browser.close();
server.close();

console.log('\n══════════════════════════════════════════════════════════════');
console.log(`  ${pass} passed, ${fail} failed`);
console.log('══════════════════════════════════════════════════════════════');
process.exit(fail ? 1 : 0);
