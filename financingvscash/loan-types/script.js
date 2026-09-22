/* ============================================================================
   Loan Types Explained — page script

   Every figure drawn here comes out of the same arithmetic the Finance vs Cash
   engine runs (see the FINANCIAL ENGINE block in ../script.js, sections 2, 3
   and 8 to 13), including its two rate conventions.

   The worked examples are the tool's own Quick Start presets, not invented
   ones, so a reader can click Quick Start and watch the same figures appear.
   Each example therefore carries the convention ITS preset carries: effective
   annual everywhere, except the flat-rate deals, which quote a rate per month
   and so are nominal, exactly as QUICK_START_SCENARIOS.motorbike sets it.

   Nothing is fetched and nothing is stored. The charts are plain inline SVG,
   sized from the container so their labels stay at real pixels instead of being
   scaled down to nothing on a phone.
============================================================================ */

/* ── Theme ────────────────────────────────────────────────────────────────── */
(function initTheme() {
  const btn = document.getElementById('themeToggle');
  const apply = (light) => {
    document.body.classList.toggle('light', light);
    btn.textContent = light ? '🌙 Dark' : '☀️ Light';
  };
  apply(localStorage.getItem('fvc-theme') !== 'dark');
  btn.addEventListener('click', () => {
    const next = !document.body.classList.contains('light');
    apply(next);
    localStorage.setItem('fvc-theme', next ? 'light' : 'dark');
  });
})();

/* ── Cards and FAQ ────────────────────────────────────────────────────────── */
function toggleSection(id) {
  const card = document.getElementById(id);
  if (!card) return;
  const header = card.querySelector('.section-header');
  const body = card.querySelector('.section-body');
  if (!body) return;
  const collapsed = header.classList.contains('collapsed');
  header.classList.toggle('collapsed', !collapsed);
  body.classList.toggle('hidden', !collapsed);
  if (collapsed) renderAll();
}

function toggleFaq(questionEl) {
  const answer = questionEl.nextElementSibling;
  const open = answer.classList.contains('open');
  answer.classList.toggle('open', !open);
  questionEl.classList.toggle('open', !open);
}

/* ============================================================================
   THE ENGINE
============================================================================ */

/* The two conventions the tool offers, and the reason a loan-types page needs
   both: a yearly rate compounds down, but a rate a lender states per month is
   already a period rate and dividing is what the contract means. */
function toPeriodRate(annualPct, convention) {
  const a = (Number(annualPct) || 0) / 100;
  return convention === 'nominal' ? a / 12 : Math.pow(1 + a, 1 / 12) - 1;
}

function annuityPmt(bal, r, m) {
  if (m <= 0) return bal;
  if (bal <= 0) return 0;
  if (r === 0) return bal / m;
  const f = Math.pow(1 + r, m);
  return bal * (r * f) / (f - 1);
}
/* An instalment sized to leave exactly `res` outstanding after m periods. */
function annuityPmtToResidual(bal, r, m, res) {
  if (m <= 0) return bal;
  const pv = r === 0 ? res : res / Math.pow(1 + r, m);
  return annuityPmt(bal - pv, r, m);
}

/* Terminal balance after a stream of payments at period rate r. Multiplying
   only, so it stays finite at the bottom of the bisection bracket. */
function terminalBalance(principal, payments, r) {
  let bal = principal;
  for (let i = 0; i < payments.length; i++) bal = bal * (1 + r) - payments[i];
  return bal;
}
/* The rate a payment stream implies. Strictly increasing in r for non-negative
   payments, so bisection always lands on the one root. */
function solvePeriodRate(principal, payments) {
  if (!(principal > 0) || !payments || !payments.length) return null;
  let lo = -0.9999, hi = 1, guard = 0;
  if (!(terminalBalance(principal, payments, lo) < 0)) return null;
  while (!(terminalBalance(principal, payments, hi) > 0) && guard++ < 80) hi *= 2;
  if (!(terminalBalance(principal, payments, hi) > 0)) return null;
  for (let i = 0; i < 200 && hi - lo > 1e-14; i++) {
    const mid = (lo + hi) / 2;
    if (terminalBalance(principal, payments, mid) > 0) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

/* One builder for all seven structures, so every row has the same shape and the
   charts never branch on the loan type. */
const zero = (v, eps) => Math.abs(v) < eps ? 0 : v;

function buildSchedule(cfg) {
  const n = cfg.stream ? cfg.stream.length : cfg.n;
  const P = cfg.P;
  const type = cfg.type;
  const k = Math.min(n, cfg.k || 0);
  const R = type === 'balloon' ? P * (cfg.residualPct || 0) / 100 : 0;
  const implied = type === 'knownPayment' ? solvePeriodRate(P, cfg.stream) : null;
  const r = type === 'knownPayment' ? implied : toPeriodRate(cfg.annual, cfg.conv);

  const rows = [];
  let bal = P, totalInt = 0;

  if (type === 'flat') {
    const prinPer = P / n, intPer = P * r;
    for (let i = 1; i <= n; i++) {
      const prin = (i === n) ? bal : prinPer;
      const endBal = (i === n) ? 0 : Math.max(0, bal - prinPer);
      rows.push({ i, startBal: bal, interest: intPer, principal: prin, payment: prin + intPer, endBal });
      totalInt += intPer; bal = endBal;
    }
  } else {
    for (let i = 1; i <= n; i++) {
      const interest = bal * r;
      let payment, principal, endBal;
      if (i === n) {
        /* Whatever the structure, the last period settles the debt exactly. */
        payment = interest + bal; principal = bal; endBal = 0;
      } else {
        if (type === 'annuity') payment = annuityPmt(bal, r, n - i + 1);
        else if (type === 'interestOnly') payment = i <= k ? interest : annuityPmt(bal, r, n - i + 1);
        else if (type === 'balloon') payment = annuityPmtToResidual(bal, r, n - i + 1, R);
        else if (type === 'bullet') payment = 0;
        else if (type === 'deferred') payment = i <= k ? 0 : annuityPmt(bal, r, n - i + 1);
        else payment = cfg.stream[i - 1];
        principal = payment - interest;
        if (principal > bal) principal = bal;
        endBal = Math.max(0, bal - principal);
      }
      rows.push({ i, startBal: bal, interest, principal, payment, endBal });
      totalInt += interest; bal = endBal;
    }
  }

  const totalPaid = rows.reduce((s, p) => s + p.payment, 0);
  const irr = solvePeriodRate(P, rows.map(p => p.payment));
  const firstNonZero = rows.find(p => p.payment > 0.005);
  return {
    rows, n, P, periodRate: r, residual: R,
    totalInterest: zero(totalInt, 5e-3),
    totalPaid,
    first: rows[0].payment,
    afterK: k > 0 && rows[k] ? rows[k].payment : (firstNonZero ? firstNonZero.payment : 0),
    balAfterK: k > 0 && rows[k - 1] ? rows[k - 1].endBal : P,
    final: rows[n - 1].payment,
    /* A plan that is exactly 0% solves to a rate a hair either side of zero.
       That is the answer, so it is reported as the zero it is. */
    ear: irr === null ? null : zero((Math.pow(1 + irr, 12) - 1) * 100, 5e-3)
  };
}

/* ============================================================================
   THE WORKED EXAMPLES
   Each key matches a data-chart slot and the data-fig figures in the markup.
============================================================================ */

const rep = (v, c) => Array(c).fill(v);

const EXAMPLES = {
  /* Quick Start > Car, "5yr loan, 10% down": $45,000 less 10% down. */
  'ex-amort':         { type: 'annuity',      P: 40500,    annual: 8.4,  n: 60 },
  /* Quick Start > Motorbike: Rp 35,000,000 less 20% down, 0.9% a MONTH flat,
     which is why this one is nominal and the preset sets it that way. */
  'ex-flat-id':       { type: 'flat',         P: 28000000, annual: 10.8, n: 36, conv: 'nominal', cur: 'Rp ', dp: 0 },
  /* A Murabaha margin is quoted per period too, so it reads as nominal. */
  'ex-flat-murabaha': { type: 'flat',         P: 50000,    annual: 5,    n: 48, conv: 'nominal' },
  /* Quick Start > House, the 30-year loan, switched to interest-only for 5 years. */
  'ex-io-prop':       { type: 'interestOnly', P: 520000,   annual: 6.1,  n: 360, k: 60 },
  'ex-io-bridge':     { type: 'interestOnly', P: 80000,    annual: 10,   n: 12, k: 12 },
  /* Quick Start > Car, "5yr with 35% balloon": the same loan as ex-amort. */
  'ex-balloon':       { type: 'balloon',      P: 40500,    annual: 8.4,  n: 60, residualPct: 35 },
  /* Quick Start > Phone: $1,800, three plans that quote an instalment only. */
  'ex-known-zero':    { type: 'knownPayment', P: 1800,     stream: rep(150, 12) },
  'ex-known-24':      { type: 'knownPayment', P: 1800,     stream: rep(82, 24) },
  'ex-known-36':      { type: 'knownPayment', P: 1800,     stream: rep(57, 36) },
  'ex-bullet':        { type: 'bullet',       P: 100000,   annual: 12,   n: 24 },
  /* Quick Start > Deferred: $6,000, 12 months of nothing, then 24 payments. */
  'ex-deferred':      { type: 'deferred',     P: 6000,     annual: 19.9, n: 36, k: 12 }
};

/* One loan, six structures: the Quick Start car loan, $40,500 over 60 monthly
   payments at 8.4% a year, so the comparison is one click away in the tool. */
const COMPARISON = [
  { key: 'cmp-annuity',      label: 'Amortizing',     colour: 'var(--lt-1)', dash: '',        cfg: { type: 'annuity',      P: 40500, annual: 8.4, n: 60 } },
  { key: 'cmp-flat',         label: 'Flat rate',      colour: 'var(--lt-2)', dash: '7 3',     cfg: { type: 'flat',         P: 40500, annual: 8.4, n: 60 } },
  { key: 'cmp-interestOnly', label: 'Interest-only',  colour: 'var(--lt-3)', dash: '2 3',     cfg: { type: 'interestOnly', P: 40500, annual: 8.4, n: 60, k: 60 } },
  { key: 'cmp-balloon',      label: 'Balloon 35%',    colour: 'var(--lt-4)', dash: '10 4',    cfg: { type: 'balloon',      P: 40500, annual: 8.4, n: 60, residualPct: 35 } },
  { key: 'cmp-bullet',       label: 'Bullet',         colour: 'var(--lt-5)', dash: '4 3 1 3', cfg: { type: 'bullet',       P: 40500, annual: 8.4, n: 60 } },
  { key: 'cmp-deferred',     label: 'Deferred 12 mo', colour: 'var(--lt-6)', dash: '9 3 2 3', cfg: { type: 'deferred',     P: 40500, annual: 8.4, n: 60, k: 12 } }
];

/* The mini curves on the "at a glance" grid. Shapes, not amounts, so they all
   run on the same car loan and only the structure differs. */
const SPARKS = {
  annuity:       { type: 'annuity',      P: 40500, annual: 8.4, n: 60 },
  flat:          { type: 'flat',         P: 40500, annual: 8.4, n: 60 },
  interestOnly:  { type: 'interestOnly', P: 40500, annual: 8.4, n: 60, k: 30 },
  balloon:       { type: 'balloon',      P: 40500, annual: 8.4, n: 60, residualPct: 35 },
  knownPayment:  { type: 'knownPayment', P: 1800,  stream: rep(82, 24) },
  bullet:        { type: 'bullet',       P: 40500, annual: 8.4, n: 60 },
  deferred:      { type: 'deferred',     P: 40500, annual: 8.4, n: 60, k: 15 }
};

const CACHE = {};
function scheduleFor(key) {
  if (!CACHE[key]) CACHE[key] = buildSchedule(EXAMPLES[key]);
  return CACHE[key];
}

/* ============================================================================
   FORMATTING
============================================================================ */

const curOf = key => (EXAMPLES[key] && EXAMPLES[key].cur) || '$';
const dpOf  = key => (EXAMPLES[key] && EXAMPLES[key].dp !== undefined) ? EXAMPLES[key].dp : 2;

function money(v, cur, dp) {
  if (Math.abs(v) < 0.005) v = 0;
  const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  return (v < 0 ? '-' : '') + (cur === undefined ? '$' : cur) + s;
}
/* Axis labels have to fit, so they lose the cents and gain a suffix. They must
   not lose anything else: a gridline at 12,500 printed as "$13k" is a label
   that lies about where it is, so a decimal is kept wherever dropping it would
   move the number. */
function compact(v, cur) {
  const a = Math.abs(v), c = cur === undefined ? '$' : cur;
  const unit = (div, suffix) => {
    const x = v / div;
    return c + (Number.isInteger(x) ? String(x) : String(Math.round(x * 10) / 10)) + suffix;
  };
  if (a >= 1e9) return unit(1e9, 'b');
  if (a >= 1e6) return unit(1e6, 'm');
  if (a >= 1e3) return unit(1e3, 'k');
  return c + (Number.isInteger(v) ? v : Math.round(v * 10) / 10);
}

/* The y axis needs as much room as its longest label, and no more. DM Sans
   digits run about 6.2px wide at the 10px these are drawn at. */
function padForTicks(ticks, cur) {
  const longest = ticks.reduce((n, t) => Math.max(n, compact(t, cur).length), 1);
  return Math.min(96, Math.max(40, Math.round(14 + longest * 6.2)));
}
/* A round step, so gridlines land on numbers a reader recognises. */
const STEP_LADDER = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 10];
function niceStep(rough) {
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  return (STEP_LADDER.find(v => norm <= v) || 10) * mag;
}
/* The top gridline has to sit at or above the tallest thing drawn, or a bar
   gets clipped by an axis that never admits to it. Rounding a step up can
   overshoot by almost a whole step, though, which leaves a chart drawn in the
   bottom two thirds of its own box. So try a few tick counts and keep whichever
   ceiling sits closest to the data. */
function yTicks(max, count) {
  if (!(max > 0)) return [0, 1];
  let best = null;
  for (let c = count; c <= count + 2; c++) {
    const step = niceStep(max / c);
    const top = Math.ceil(max / step - 1e-9) * step;
    if (!best || top < best.top) best = { step, top };
  }
  const out = [];
  for (let i = 0; i * best.step <= best.top + best.step * 1e-6; i++) out.push(i * best.step);
  return out;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ============================================================================
   SVG BUILDING BLOCKS
============================================================================ */

const AXIS_FILL = 'var(--chart-text)';
const GRID = 'var(--chart-grid)';

function plot(w, h, pad) {
  return { w, h, pad, x0: pad.l, x1: w - pad.r, y0: pad.t, y1: h - pad.b,
           iw: w - pad.l - pad.r, ih: h - pad.t - pad.b };
}
function gridAndY(p, ticks, cur) {
  let s = '';
  for (const t of ticks) {
    const y = p.y1 - (t / ticks[ticks.length - 1]) * p.ih;
    s += `<line x1="${p.x0}" y1="${y.toFixed(1)}" x2="${p.x1}" y2="${y.toFixed(1)}" stroke="${GRID}" stroke-width="1"${t === 0 ? '' : ' stroke-dasharray="2 4"'}/>`;
    s += `<text x="${p.x0 - 6}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="${AXIS_FILL}">${esc(compact(t, cur))}</text>`;
  }
  return s;
}
/* Month labels, thinned until they stop colliding at the width we actually have. */
function xAxis(p, n, unit) {
  const every = [1, 2, 3, 6, 12, 24, 36, 60, 120].find(e => (n / e) * 30 <= p.iw) || n;
  let s = '';
  for (let i = 0; i <= n; i += every) {
    const x = p.x0 + (i / n) * p.iw;
    s += `<text x="${x.toFixed(1)}" y="${p.y1 + 14}" text-anchor="middle" font-size="10" fill="${AXIS_FILL}">${i}</text>`;
  }
  /* The unit sits under the y-axis labels, where no month number can land on it. */
  s += `<text x="${p.x0 - 6}" y="${p.y1 + 14}" text-anchor="end" font-size="10" fill="${AXIS_FILL}" opacity="0.75">${esc(unit || 'month')}</text>`;
  return s;
}
function linePath(pts) {
  return pts.map((pt, i) => (i ? 'L' : 'M') + pt[0].toFixed(1) + ' ' + pt[1].toFixed(1)).join(' ');
}

/* The balance series: what you owe on day one, then after every payment. */
function balanceSeries(sch) {
  const pts = [[0, sch.P]];
  for (const row of sch.rows) pts.push([row.i, row.endBal]);
  return pts;
}
function toXY(series, p, n, yMax) {
  return series.map(([i, v]) => [p.x0 + (i / n) * p.iw, p.y1 - (v / yMax) * p.ih]);
}

/* ============================================================================
   CHARTS
============================================================================ */

/* What you still owe, as a filled curve. */
function chartBalance(w, key, opts) {
  const sch = scheduleFor(key), cur = curOf(key), dp = dpOf(key);
  const series = balanceSeries(sch);
  const peak = Math.max(...series.map(s => s[1]));
  const ticks = yTicks(peak, 4);
  const yMax = ticks[ticks.length - 1];
  const p = plot(w, 210, { l: padForTicks(ticks, cur), r: 12, t: 12, b: 26 });
  const xy = toXY(series, p, sch.n, yMax);

  let s = `<svg width="${w}" height="${p.h}" viewBox="0 0 ${w} ${p.h}" role="img" aria-label="Outstanding balance by month">`;
  s += gridAndY(p, ticks, cur);
  s += `<path d="${linePath(xy)} L ${p.x1.toFixed(1)} ${p.y1} L ${p.x0.toFixed(1)} ${p.y1} Z" fill="var(--c-balance)" opacity="0.14"/>`;
  if (opts && opts.ref === 'straight') {
    /* A straight run-off from P to zero, so the bow in the real curve is
       something the reader can see rather than take on trust. */
    const refXY = toXY([[0, sch.P], [sch.n, 0]], p, sch.n, yMax);
    s += `<path d="${linePath(refXY)}" fill="none" stroke="var(--muted)" stroke-width="1.4" stroke-dasharray="5 4" opacity="0.85"/>`;
  }
  s += `<path d="${linePath(xy)}" fill="none" stroke="var(--c-balance)" stroke-width="2" stroke-linejoin="round"/>`;
  /* A marker on the peak when it is not the starting balance, which is the
     whole story on a bullet and on a deferred start. */
  let peakIdx = 0;
  series.forEach((pt, i) => { if (pt[1] > series[peakIdx][1] + 0.005) peakIdx = i; });
  if (peakIdx > 0) {
    const [px, py] = xy[peakIdx];
    s += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3.2" fill="var(--c-balance)"/>`;
    /* Above the marker, never beside it: the curve runs through the line the
       label would otherwise sit on, and a struck-through number reads as a
       mistake. */
    const anchor = px > p.x0 + p.iw * 0.6 ? 'end' : 'start';
    s += `<text x="${(px + (anchor === 'end' ? -7 : 7)).toFixed(1)}" y="${Math.max(p.y0 + 10, py - 8).toFixed(1)}" text-anchor="${anchor}" font-size="10.5" fill="var(--c-balance)" font-weight="600">${esc(money(series[peakIdx][1], cur, dp))}</text>`;
  }
  s += xAxis(p, sch.n, 'month');
  s += `<title>Outstanding balance, month 0 to ${sch.n}</title></svg>`;
  return s;
}

/* Where each payment goes: principal at the bottom, interest on top. */
function chartSplit(w, key) {
  const sch = scheduleFor(key), cur = curOf(key), dp = dpOf(key);
  const pays = sch.rows.map(r => r.payment).filter(v => v > 0).sort((a, b) => a - b);
  const median = pays.length ? pays[Math.floor(pays.length / 2)] : 0;
  const maxPay = Math.max(...sch.rows.map(r => r.payment));
  /* A final settlement dwarfs 47 instalments, so the axis is capped and the tall
     bar is drawn clipped with its real value printed on it. */
  const capped = maxPay > median * 4 && median > 0;
  const ticks = yTicks(capped ? median * 1.55 : maxPay, 4);
  const yMax = ticks[ticks.length - 1];
  const p = plot(w, 210, { l: padForTicks(ticks, cur), r: 12, t: 14, b: 26 });

  let s = `<svg width="${w}" height="${p.h}" viewBox="0 0 ${w} ${p.h}" role="img" aria-label="Interest and principal in each payment">`;
  s += gridAndY(p, ticks, cur);

  const bw = p.iw / sch.n;
  if (sch.n <= 84) {
    const gap = Math.min(Math.max(bw > 4 ? 1 : 0, bw * 0.16), 10);
    for (const row of sch.rows) {
      /* A period with nothing due draws nothing. A payment that does not even
         cover the interest is all interest, and the debt grows underneath it. */
      if (!(row.payment > 0.005)) continue;
      const x = p.x0 + (row.i - 1) * bw + gap / 2;
      const wid = Math.max(0.6, bw - gap);
      const prin = Math.max(0, Math.min(row.principal, yMax));
      const hPrin = prin / yMax * p.ih;
      const hInt = Math.min(Math.max(0, row.payment - prin), yMax - prin) / yMax * p.ih;
      const tip = `Month ${row.i}: pay ${money(row.payment, cur, dp)} = ${money(Math.max(0, row.principal), cur, dp)} principal + ${money(row.interest, cur, dp)} interest`;
      s += `<g><title>${esc(tip)}</title>`;
      if (hPrin > 0) s += `<rect x="${x.toFixed(1)}" y="${(p.y1 - hPrin).toFixed(1)}" width="${wid.toFixed(1)}" height="${hPrin.toFixed(1)}" fill="var(--c-principal)"/>`;
      if (hInt > 0) s += `<rect x="${x.toFixed(1)}" y="${(p.y1 - hPrin - hInt).toFixed(1)}" width="${wid.toFixed(1)}" height="${hInt.toFixed(1)}" fill="var(--c-interest)"/>`;
      s += `</g>`;
      if (capped && row.payment > yMax) {
        /* A torn top edge, so a clipped bar never reads as a real height. */
        const tx = x, tw = wid;
        s += `<path d="M${tx.toFixed(1)} ${p.y0 + 5} l${(tw / 4).toFixed(1)} -5 l${(tw / 4).toFixed(1)} 5 l${(tw / 4).toFixed(1)} -5 l${(tw / 4).toFixed(1)} 5" fill="none" stroke="var(--card)" stroke-width="3"/>`;
        /* Beside the bar, on whichever side has room for it. */
        const nearRight = tx + tw > p.x0 + p.iw * 0.8;
        const lx = nearRight ? tx - 6 : tx + tw + 6;
        s += `<text x="${lx.toFixed(1)}" y="${(p.y0 + 16).toFixed(1)}" text-anchor="${nearRight ? 'end' : 'start'}" font-size="10.5" font-weight="600" fill="var(--c-interest)">${esc(money(row.payment, cur, dp))}</text>`;
      }
    }
  } else {
    /* Three hundred and sixty bars is a smear, so long loans get stacked areas. */
    const prinPts = [], totPts = [];
    sch.rows.forEach(row => {
      const x = p.x0 + (row.i / sch.n) * p.iw;
      prinPts.push([x, p.y1 - Math.max(0, Math.min(row.principal, yMax)) / yMax * p.ih]);
      totPts.push([x, p.y1 - Math.max(0, Math.min(row.payment, yMax)) / yMax * p.ih]);
    });
    s += `<path d="${linePath(totPts)} L ${p.x1.toFixed(1)} ${p.y1} L ${p.x0.toFixed(1)} ${p.y1} Z" fill="var(--c-interest)" opacity="0.85"/>`;
    s += `<path d="${linePath(prinPts)} L ${p.x1.toFixed(1)} ${p.y1} L ${p.x0.toFixed(1)} ${p.y1} Z" fill="var(--c-principal)" opacity="0.95"/>`;
  }
  s += xAxis(p, sch.n, 'month');
  s += `</svg>`;
  return s;
}

/* The flat-rate trick: what you owe, against what you are charged on. */
function chartFlatGap(w, key) {
  const sch = scheduleFor(key), cur = curOf(key);
  const ticks = yTicks(sch.P, 4);
  const yMax = ticks[ticks.length - 1];
  const p = plot(w, 210, { l: padForTicks(ticks, cur), r: 12, t: 12, b: 26 });
  const owe = toXY(balanceSeries(sch), p, sch.n, yMax);
  const charged = toXY([[0, sch.P], [sch.n, sch.P]], p, sch.n, yMax);

  let s = `<svg width="${w}" height="${p.h}" viewBox="0 0 ${w} ${p.h}" role="img" aria-label="Balance owed against the amount interest is charged on">`;
  s += gridAndY(p, ticks, cur);
  s += `<path d="${linePath(charged)} L ${owe[owe.length - 1][0].toFixed(1)} ${owe[owe.length - 1][1].toFixed(1)} ${linePath(owe.slice().reverse()).replace('M', 'L')} Z" fill="var(--c-interest)" opacity="0.16"/>`;
  s += `<path d="${linePath(owe)}" fill="none" stroke="var(--c-balance)" stroke-width="2"/>`;
  s += `<path d="${linePath(charged)}" fill="none" stroke="var(--c-interest)" stroke-width="2" stroke-dasharray="6 4"/>`;
  if (p.iw > 420) {
    const midX = p.x0 + p.iw * 0.52, midY = p.y1 - (sch.P * 0.72 / yMax) * p.ih;
    s += `<text x="${midX.toFixed(1)}" y="${midY.toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="600" fill="var(--c-interest)">interest charged on this gap too</text>`;
  }
  s += xAxis(p, sch.n, 'month');
  s += `</svg>`;
  return s;
}

/* A residual loan against the same loan without one. */
function chartBalloon(w, key) {
  const cfg = EXAMPLES[key], cur = curOf(key), dp = dpOf(key);
  const withRes = scheduleFor(key);
  const without = buildSchedule({ type: 'annuity', P: cfg.P, annual: cfg.annual, n: cfg.n, conv: cfg.conv });
  const ticks = yTicks(cfg.P, 4);
  const yMax = ticks[ticks.length - 1];
  const p = plot(w, 210, { l: padForTicks(ticks, cur), r: 12, t: 12, b: 26 });
  const a = toXY(balanceSeries(withRes), p, cfg.n, yMax);
  const b = toXY(balanceSeries(without), p, cfg.n, yMax);

  let s = `<svg width="${w}" height="${p.h}" viewBox="0 0 ${w} ${p.h}" role="img" aria-label="Balance with and without a residual">`;
  s += gridAndY(p, ticks, cur);
  s += `<path d="${linePath(a)} ${linePath(b.slice().reverse()).replace('M', 'L')} Z" fill="var(--c-residual)" opacity="0.18"/>`;
  s += `<path d="${linePath(b)}" fill="none" stroke="var(--lt-6)" stroke-width="2" stroke-dasharray="6 4"/>`;
  s += `<path d="${linePath(a)}" fill="none" stroke="var(--c-balance)" stroke-width="2"/>`;
  /* The cliff: the balance still standing when the last instalment falls due. */
  const lastBefore = withRes.rows[cfg.n - 2].endBal;
  const cx = p.x0 + ((cfg.n - 1) / cfg.n) * p.iw, cy = p.y1 - (lastBefore / yMax) * p.ih;
  s += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3.2" fill="var(--c-balance)"/>`;
  const resLabel = p.iw > 380 ? money(lastBefore, cur, dp) + ' still owed' : money(lastBefore, cur, 0);
  /* Below and left of the marker, inside the shaded gap, where neither curve runs. */
  s += `<text x="${(cx - 8).toFixed(1)}" y="${(cy + 17).toFixed(1)}" text-anchor="end" font-size="10.5" font-weight="600" fill="var(--c-balance)">${esc(resLabel)}</text>`;
  s += xAxis(p, cfg.n, 'month');
  s += `</svg>`;
  return s;
}

/* Six structures, one set of axes. */
function chartMulti(w) {
  const built = COMPARISON.map(c => ({ ...c, sch: buildSchedule(c.cfg) }));
  const peak = Math.max(...built.map(b => Math.max(...balanceSeries(b.sch).map(s => s[1]))));
  const ticks = yTicks(peak, 4);
  const yMax = ticks[ticks.length - 1];
  const p = plot(w, 240, { l: padForTicks(ticks, '$'), r: 12, t: 12, b: 26 });

  let s = `<svg width="${w}" height="${p.h}" viewBox="0 0 ${w} ${p.h}" role="img" aria-label="Outstanding balance under six loan structures">`;
  s += gridAndY(p, ticks, '$');
  for (const b of built) {
    const xy = toXY(balanceSeries(b.sch), p, b.sch.n, yMax);
    s += `<path d="${linePath(xy)}" fill="none" stroke="${b.colour}" stroke-width="2" stroke-linejoin="round"${b.dash ? ` stroke-dasharray="${b.dash}"` : ''}><title>${esc(b.label)}</title></path>`;
  }
  s += xAxis(p, 60, 'month');
  s += `</svg>`;
  return s;
}

/* Total interest, one bar each, so the six totals can be read off at a glance. */
function chartBars(w) {
  const built = COMPARISON.map(c => ({ ...c, sch: buildSchedule(c.cfg) }))
                          .sort((a, b) => a.sch.totalInterest - b.sch.totalInterest);
  const rowH = 30, padL = 118, padR = 14, padT = 6;
  const h = padT + built.length * rowH + 6;
  const max = Math.max(...built.map(b => b.sch.totalInterest));
  const iw = Math.max(40, w - padL - padR - 66);

  let s = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Total interest by loan structure">`;
  built.forEach((b, idx) => {
    const y = padT + idx * rowH;
    const bw = (b.sch.totalInterest / max) * iw;
    s += `<text x="${padL - 8}" y="${y + 15}" text-anchor="end" font-size="11.5" fill="var(--text)">${esc(b.label)}</text>`;
    s += `<rect x="${padL}" y="${y + 4}" width="${bw.toFixed(1)}" height="15" rx="3" fill="${b.colour}" opacity="0.9"><title>${esc(b.label + ': ' + money(b.sch.totalInterest, '$', 2))}</title></rect>`;
    s += `<text x="${(padL + bw + 7).toFixed(1)}" y="${y + 15.5}" font-size="11" font-family="DM Mono, monospace" fill="var(--muted)">${esc(money(b.sch.totalInterest, '$', 0))}</text>`;
  });
  s += `</svg>`;
  return s;
}

/* A shape, nothing more: no axes, no labels. */
function chartSpark(w, name) {
  const sch = buildSchedule(SPARKS[name]);
  const h = 42, pad = 3;
  const series = balanceSeries(sch);
  const peak = Math.max(...series.map(s => s[1])) || 1;
  const xy = series.map(([i, v]) => [pad + (i / sch.n) * (w - pad * 2), (h - pad) - (v / peak) * (h - pad * 2)]);
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false">`
       + `<path d="${linePath(xy)} L ${(w - pad).toFixed(1)} ${h - pad} L ${pad} ${h - pad} Z" fill="var(--c-balance)" opacity="0.13"/>`
       + `<path d="${linePath(xy)}" fill="none" stroke="var(--c-balance)" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
}

/* ============================================================================
   RENDER
============================================================================ */

const RENDERERS = {
  balance: (w, key, opts) => chartBalance(w, key, opts),
  split:   (w, key) => chartSplit(w, key),
  flatgap: (w, key) => chartFlatGap(w, key),
  balloon: (w, key) => chartBalloon(w, key),
  multi:   (w) => chartMulti(w),
  bars:    (w) => chartBars(w)
};

function renderAll() {
  document.querySelectorAll('.chart-slot').forEach(slot => {
    /* A collapsed card measures zero wide, so it is drawn when it opens. */
    const w = Math.round(slot.clientWidth);
    if (!w) return;
    if (slot.dataset.renderedAt === String(w)) return;
    const fn = RENDERERS[slot.dataset.view];
    if (!fn) return;
    slot.innerHTML = fn(w, slot.dataset.chart, slot.dataset);
    slot.dataset.renderedAt = String(w);
  });
  document.querySelectorAll('.shape-spark').forEach(slot => {
    const w = Math.round(slot.clientWidth);
    if (!w || slot.dataset.renderedAt === String(w)) return;
    slot.innerHTML = chartSpark(w, slot.dataset.spark);
    slot.dataset.renderedAt = String(w);
  });
}

function renderCmpLegend() {
  const host = document.getElementById('cmpLegend');
  if (!host) return;
  host.innerHTML = COMPARISON.map(c =>
    `<span><i style="background:${c.dash ? 'none' : c.colour};border-top:3px ${c.dash ? 'dashed' : 'solid'} ${c.colour};height:0"></i>${esc(c.label)}</span>`
  ).join('');
}

/* A link to #type-4 has to open the card it points at, because most of them
   start closed. */
function openCardFromHash() {
  const id = (location.hash || '').replace('#', '');
  if (!id) return;
  const card = document.getElementById(id);
  if (!card || !card.classList.contains('section-card')) return;
  card.querySelector('.section-header')?.classList.remove('collapsed');
  card.querySelector('.section-body')?.classList.remove('hidden');
  renderAll();
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const OPEN_AT_LOAD = ['reading', 'shapes', 'type-1'];

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.section-card').forEach(card => {
    if (OPEN_AT_LOAD.includes(card.id)) return;
    card.querySelector('.section-header')?.classList.add('collapsed');
    card.querySelector('.section-body')?.classList.add('hidden');
  });
  renderCmpLegend();
  renderAll();
  openCardFromHash();
});

window.addEventListener('hashchange', openCardFromHash);

let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(renderAll, 140);
});

/* The audit harness drives the real page, so it reads the engine from here
   rather than re-declaring it. */
window.__LOAN_TYPES = { buildSchedule, EXAMPLES, COMPARISON, scheduleFor };
