// Phase 2 — drive the REAL Finance vs Cash page and record what it produces.
//
// Everything reported here is READ OFF THE PAGE: its comparison table, its
// amortisation schedule, its KPI tiles, its banners, and the chart configs the
// driver's Chart.js stub records. Nothing is recomputed from the model. The
// only arithmetic is on figures already read back, and the contract marks those
// keys "runner-computed".
import { boot, fileUrl, contract, money, emit, runCase } from './_driver.mjs';

const C = contract('financingvscash');
const byId = Object.fromEntries(C.cases.map(c => [c.id, c]));

const { browser, page, errors } = await boot();
await page.goto(fileUrl('financingvscash/index.html'), { waitUntil: 'load' });
await page.waitForTimeout(400);

/* ── page helpers (all operate on the real DOM) ─────────────────────────── */

async function setField(id, value) {
  return page.evaluate(({ id, value }) => {
    const el = document.getElementById(id);
    if (!el) throw new Error('missing element #' + id);
    if (el.type === 'checkbox') {
      if (el.checked !== !!value) el.click();
      return el.checked;
    }
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    if (el.tagName.toLowerCase() === 'input' && el.type === 'text') el.dispatchEvent(new Event('blur', { bubbles: true }));
    return el.value;
  }, { id, value: String(value) });
}

/** Reset the page and empty the scenario list, so a case starts from nothing. */
async function cleanState() {
  await page.evaluate(() => {
    const r = document.getElementById('resetBtn'); if (r) r.click();
  });
  await page.waitForTimeout(150);
  // Delete every scenario using its own delete control, newest first.
  for (let guard = 0; guard < 30; guard++) {
    const left = await page.evaluate(() => {
      const dels = document.querySelectorAll('#scenarioList .sc-btn.del');
      if (!dels.length) return 0;
      dels[dels.length - 1].click();
      return document.querySelectorAll('#scenarioList .scenario-card').length;
    });
    if (left === 0) break;
  }
  await page.waitForTimeout(120);
}

async function applyBase(base = {}) {
  // Inflation toggle first: #inflationRate only exists while it is on.
  if ('#inflationToggle' in base) await setField('inflationToggle', base['#inflationToggle']);
  for (const [sel, v] of Object.entries(base)) {
    if (sel === '#inflationToggle') continue;
    await setField(sel.slice(1), v);
  }
  await page.waitForTimeout(150);
}

async function addScenario(sc) {
  await page.evaluate(() => document.getElementById('addScenarioBtn').click());
  await page.waitForTimeout(80);
  // Frequency before term: changing frequency re-derives the term.
  if ('#scFreq' in sc) await setField('scFreq', sc['#scFreq']);
  for (const [sel, v] of Object.entries(sc)) {
    if (sel === '#scFreq') continue;
    await setField(sel.slice(1), v);
  }
  await page.evaluate(() => document.getElementById('saveScenarioBtn').click());
  await page.waitForTimeout(150);
}

async function applyState({ base, scenarios }) {
  await cleanState();
  await applyBase(base);
  for (const sc of (scenarios || [])) await addScenario(sc);
  await page.waitForTimeout(250);
}

/** The Scenario Comparison table as {rowLabel: {columnHeader: cellText}}. */
async function compTable() {
  return page.evaluate(() => {
    const t = document.querySelector('#compTableWrap table');
    if (!t) return null;
    const heads = [...t.querySelectorAll('thead th')].map(th => th.textContent.trim());
    const out = {};
    for (const tr of t.querySelectorAll('tbody tr')) {
      const tds = [...tr.children].map(td => td.textContent.trim());
      if (!tds.length) continue;
      const row = {};
      for (let i = 1; i < tds.length; i++) row[heads[i] || ('col' + i)] = tds[i];
      out[tds[0]] = row;
    }
    return out;
  });
}

const cell = (tbl, row, col) => (tbl && tbl[row] && tbl[row][col] !== undefined) ? tbl[row][col] : null;
const cellNum = (tbl, row, col) => { const v = cell(tbl, row, col); return v === null ? null : money(v); };

/** Select a scenario's amortisation tab by name and return its rows. */
async function amort(name) {
  const ok = await page.evaluate(n => {
    const tabs = [...document.querySelectorAll('#amortTabs .tab-btn')];
    const t = tabs.find(b => b.textContent.trim() === n);
    if (!t) return false;
    t.click();
    return true;
  }, name);
  if (!ok) return null;
  await page.waitForTimeout(120);
  return page.evaluate(() => {
    const t = document.querySelector('#amortTableWrap table');
    if (!t) return null;
    const rows = [];
    for (const tr of t.querySelectorAll('tbody tr')) {
      const tds = [...tr.children];
      if (tds.length !== 6) continue;                    // skip the fee/total footnote rows
      const first = tds[0].textContent.trim();
      if (!/^[\d,.]+$/.test(first)) continue;            // skip the "Total" row
      rows.push(tds.map(td => td.textContent.trim()));
    }
    return rows;
  });
}

const amortNums = rows => (rows || []).map(r => ({
  num: money(r[0]), startBal: money(r[1]), interest: money(r[2]),
  principal: money(r[3]), payment: money(r[4]), endBal: money(r[5]),
}));

async function kpis() {
  return page.evaluate(() => {
    const g = id => { const e = document.getElementById(id); return e ? e.textContent.trim() : null; };
    const vis = id => { const e = document.getElementById(id); return e && e.style.display !== 'none' ? e.textContent.trim() : ''; };
    return {
      best: g('kpiBest'), bestSub: g('kpiBestSub'), netBenefit: g('kpiNetBenefit'),
      interest: g('kpiInterest'), cashWealth: g('kpiCashWealth'),
      warn: vis('warnBanner'), negCarry: vis('negCarryBanner'),
      legend: g('chartLegend'), amortTabs: g('amortTabs'),
      compWrapText: (document.getElementById('compTableWrap') || {}).textContent || '',
    };
  });
}

/** Main chart datasets as recorded by the stub: label -> [{x,y}]. */
async function chartSeries(canvasId = 'chartCanvas') {
  return page.evaluate(id => {
    const c = window.Chart.getChart(document.getElementById(id));
    if (!c) return null;
    const labels = c.data.labels || null;
    const out = {};
    for (let i = 0; i < (c.data.datasets || []).length; i++) {
      const ds = c.data.datasets[i];
      out[ds.label || ('ds' + i)] = (ds.data || []).map((p, j) => (p && typeof p === 'object')
        ? { x: p.x, y: p.y }
        : { x: labels ? Number(labels[j]) : null, y: p });
    }
    return out;
  }, canvasId);
}

/** How many NaN/Infinity/"NaN" strings the rendered page is showing. */
async function nanCount() {
  return page.evaluate(() => {
    const txt = document.body.innerText || '';
    return (txt.match(/NaN|Infinity|-0(?![\d.])/g) || []).length;
  });
}

const sum = (xs, f) => xs.reduce((a, r) => a + f(r), 0);

/** Switch the chart to the page's own Investment Value metric and read a series.
    Far more faithful than reconstructing it from wealth plus a loan balance. */
async function investSeries(label) {
  await setField('chartMetric', 'investmentValue');
  await page.waitForTimeout(200);
  const s = await chartSeries();
  await setField('chartMetric', 'wealth');
  await page.waitForTimeout(200);
  const hit = s && (s[label] || Object.entries(s).find(([k]) => k.startsWith(label))?.[1]);
  return hit ? hit.map(p => p.y) : null;
}

/* ── cases ──────────────────────────────────────────────────────────────── */

const cases = {};

await runCase(cases, 'N1', async () => {
  await applyState(byId.N1.setup);
  const t = await compTable(), k = await kpis();
  const rows = amortNums(await amort('N1'));
  const last = rows[rows.length - 1] || {};
  const series = await chartSeries();
  const inv = (series && (series['N1'] || series['N1 Investment'])) || null;
  const end_wealth = cellNum(t, 'Ending Wealth', 'N1');
  const final_loan_balance = last.endBal ?? null;
  const invSeries = await investSeries('N1');
  const end_invest = invSeries && invSeries.length ? invSeries[invSeries.length - 1] : null;
  return {
    payment: cellNum(t, 'Periodic Payment', 'N1'),
    n_rows: rows.length,
    interest_p1: rows[0] ? rows[0].interest : null,
    sum_principal: sum(rows, r => r.principal),
    sum_interest: sum(rows, r => r.interest),
    final_loan_balance,
    balance_after_30: rows[29] ? rows[29].endBal : null,
    end_invest,
    end_wealth,
    nb_table: cellNum(t, 'Net Benefit vs Cash', 'N1'),
    wealth_identity_residual: (end_wealth !== null && end_invest !== null)
      ? end_wealth - (end_invest - (final_loan_balance || 0)) : null,
    kpi_best: k.best, kpi_net_benefit: money(k.netBenefit),
    kpi_interest: money(k.interest), kpi_cash_wealth: money(k.cashWealth),
    nan_count: await nanCount(),
  };
});

// F1 and F1-alt share one state; run it once and report the same observables
// under both ids, since they are two rival readings of the same measurement.
const f1 = await (async () => {
  await applyState(byId.F1.setup);
  const t = await compTable();
  const rF1 = amortNums(await amort('F1'));
  const rF1z = amortNums(await amort('F1z'));
  const series = await chartSeries();
  const zs = series && series['F1z'];
  return {
    payment_F1: cellNum(t, 'Periodic Payment', 'F1'),
    interest_p1_F1: rF1[0] ? rF1[0].interest : null,
    sum_interest_F1: sum(rF1, r => r.interest),
    payment_F1z: cellNum(t, 'Periodic Payment', 'F1z'),
    end_invest_F1z: await (async () => { const v = await investSeries('F1z'); return v && v.length ? v[v.length - 1] : null; })(),
    end_wealth_F1z: cellNum(t, 'Ending Wealth', 'F1z'),
  };
})();
await runCase(cases, 'F1', async () => f1);
await runCase(cases, 'F1-alt', async () => f1);
cases['F1'].notes = 'Payment read from the Periodic Payment row of the comparison table, which the page renders with currencyExact. Interest figures come from the amortisation schedule rows.';
cases['F1-alt'].notes = 'Same measurement as F1; the two cases are rival conventions scored against one observation.';

await runCase(cases, 'F2', async () => {
  await applyState(byId.F2.setup);
  const t = await compTable(), k = await kpis();
  const rows = amortNums(await amort('F2'));
  const invSeries = (await investSeries('F2')) || [];
  return {
    payment: cellNum(t, 'Periodic Payment', 'F2'),
    n_rows: rows.length,
    total_fees: cellNum(t, 'Total Fees Paid', 'F2'),
    invest_p1: invSeries[1] ?? null,
    invest_p3: invSeries[3] ?? null,
    n_negative_rows: invSeries.filter(v => v < 0).length,
    min_invest: invSeries.length ? Math.min(...invSeries) : null,
    end_invest: invSeries.length ? invSeries[invSeries.length - 1] : null,
    end_wealth: cellNum(t, 'Ending Wealth', 'F2'),
    kpi_net_benefit: money(k.netBenefit), kpi_best: k.best,
    kpi_cash_wealth: money(k.cashWealth),
    nan_count: await nanCount(),
  };
});
cases['F2'].notes = "Invested balance read directly from the page's own Investment Value chart metric, not reconstructed.";

await runCase(cases, 'F3', async () => {
  await applyState(byId.F3.setup);
  const t = await compTable(), k = await kpis();
  const series = await chartSeries();
  return {
    warn_text: k.warn,
    kpi_best: k.best,
    kpi_net_benefit: money(k.netBenefit),
    affordable_end_wealth: cellNum(t, 'Ending Wealth', 'affordable'),
    toobig_row_numeric_wealth: cellNum(t, 'Ending Wealth', 'toobig'),
    chart_has_affordable_series: !!(series && Object.keys(series).some(l => /affordable/i.test(l))),
    chart_has_toobig_series: !!(series && Object.keys(series).some(l => /toobig/i.test(l))),
    legend_text: k.legend,
    amort_tabs_text: k.amortTabs,
    nan_count: await nanCount(),
  };
});

await runCase(cases, 'F4', async () => {
  const out = {};
  for (const st of byId.F4.setup.states) {
    await applyState(st);
    const t = await compTable(), k = await kpis();
    if (st.state === 'neg') {
      out.neg_nb_a5 = cellNum(t, 'Net Benefit vs Cash', 'a5');
      out.neg_nb_b5d20 = cellNum(t, 'Net Benefit vs Cash', 'b5d20');
      out.neg_nb_c35 = cellNum(t, 'Net Benefit vs Cash', 'c35');
      out.neg_nb_c35_minus_a5 = out.neg_nb_c35 - out.neg_nb_a5;
      out.neg_nb_b5d20_minus_a5 = out.neg_nb_b5d20 - out.neg_nb_a5;
      out.neg_fees_a5 = cellNum(t, 'Total Fees Paid', 'a5');
      out.neg_kpi_best = k.best;
      out.neg_kpi_net_benefit = money(k.netBenefit);
      out.neg_negcarry_text = k.negCarry;
    } else {
      out.par_nb = cellNum(t, 'Net Benefit vs Cash', 'dpar');
      out.par_end_wealth = cellNum(t, 'Ending Wealth', 'dpar');
      out.par_kpi_net_benefit = money(k.netBenefit);
    }
  }
  return out;
});

await runCase(cases, 'F5', async () => {
  await applyState(byId.F5.setup);
  const t = await compTable(), k = await kpis();
  const rA = amortNums(await amort('A')), rB = amortNums(await amort('B')), rC = amortNums(await amort('C'));
  const series = await chartSeries();
  const lastX = lbl => { const s = series && series[lbl]; return s && s.length ? s[s.length - 1].x : null; };
  const lastY = lbl => { const s = series && series[lbl]; return s && s.length ? s[s.length - 1].y : null; };
  const out = {
    kpi_cash_wealth: money(k.cashWealth),
    n_rows_A: rA.length, n_rows_B: rB.length, n_rows_C: rC.length,
    payment_A: cellNum(t, 'Periodic Payment', 'A'),
    payment_B: cellNum(t, 'Periodic Payment', 'B'),
    payment_C: cellNum(t, 'Periodic Payment', 'C'),
    end_wealth_A: cellNum(t, 'Ending Wealth', 'A'),
    end_wealth_B: cellNum(t, 'Ending Wealth', 'B'),
    end_wealth_C: cellNum(t, 'Ending Wealth', 'C'),
    last_x_A: lastX('A'), last_x_B: lastX('B'), last_x_C: lastX('C'),
    chart_last_y_A: lastY('A'), chart_last_y_B: lastY('B'),
  };
  out.x_ratio_B_A = (out.last_x_A ? out.last_x_B / out.last_x_A : null);
  out.x_ratio_C_A = (out.last_x_A ? out.last_x_C / out.last_x_A : null);
  // Frequency edit re-derives the term: open A, cycle the frequency, cancel.
  await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#scenarioList .scenario-card')];
    const a = cards.find(c => c.textContent.includes('A'));
    (a.querySelector('.sc-btn[data-action="edit"]') || a).click();
  });
  await page.waitForTimeout(120);
  for (const [freq, tk, lk] of [['weekly', 'term_after_weekly', 'label_after_weekly'],
  ['fortnightly', 'term_after_fortnightly', 'label_after_fortnightly'],
  ['yearly', 'term_after_yearly', 'label_after_yearly'],
  ['monthly', 'term_after_monthly', 'label_after_monthly']]) {
    await setField('scFreq', freq);
    await page.waitForTimeout(80);
    out[tk] = money(await page.evaluate(() => document.getElementById('scTerm').value));
    out[lk] = await page.evaluate(() => { const e = document.getElementById('termLabel'); return e ? e.textContent.trim() : null; });
  }
  await page.evaluate(() => document.getElementById('cancelScenarioBtn').click());
  await page.waitForTimeout(120);
  return out;
});
cases['F5'].notes = 'Chart x values are read from the recorded dataset points; the page plots x as a linear Years axis.';

await runCase(cases, 'F6', async () => {
  await applyState(byId.F6.setup);
  const t = await compTable(), k = await kpis();
  const out = {
    fees_pct: cellNum(t, 'Total Fees Paid', 'pct'),
    fees_flat: cellNum(t, 'Total Fees Paid', 'flat'),
    interest_pct: cellNum(t, 'Total Interest Paid', 'pct'),
    interest_flat: cellNum(t, 'Total Interest Paid', 'flat'),
    cost_pct: cellNum(t, 'Total Financing Cost', 'pct'),
    cost_flat: cellNum(t, 'Total Financing Cost', 'flat'),
    payment_pct: cellNum(t, 'Periodic Payment', 'pct'),
    end_wealth_pct: cellNum(t, 'Ending Wealth', 'pct'),
    end_wealth_flat: cellNum(t, 'Ending Wealth', 'flat'),
    nb_pct: cellNum(t, 'Net Benefit vs Cash', 'pct'),
    kpi_interest: money(k.interest),
  };
  out.wealth_diff_pct_flat = out.end_wealth_pct - out.end_wealth_flat;
  return out;
});

await runCase(cases, 'F7', async () => {
  const out = {};
  for (const st of byId.F7.setup.states) {
    await applyState(st);
    const t = await compTable(), k = await kpis();
    const nm = st.scenarios[0]['#scName'];
    if (st.state === 'a') {
      const rows = amortNums(await amort(nm));
      out.a_payment = cellNum(t, 'Periodic Payment', nm);
      out.a_interest = cellNum(t, 'Total Interest Paid', nm);
      out.a_end_wealth = cellNum(t, 'Ending Wealth', nm);
      out.a_nb = cellNum(t, 'Net Benefit vs Cash', nm);
      out.a_kpi_cash_wealth = money(k.cashWealth);
      out.a_kpi_best = k.best;
      out.a_nan_count = await nanCount();
      out.a_n_rows = rows.length;
    } else if (st.state === 'b') {
      const rows = amortNums(await amort(nm));
      out.b_payment = cellNum(t, 'Periodic Payment', nm);
      out.b_interest = cellNum(t, 'Total Interest Paid', nm);
      out.b_sum_principal = sum(rows, r => r.principal);
      out.b_end_wealth = cellNum(t, 'Ending Wealth', nm);
      out.b_nb = cellNum(t, 'Net Benefit vs Cash', nm);
    } else if (st.state === 'c') {
      const eff = await page.evaluate(() => {
        const card = document.querySelector('#scenarioList .scenario-card');
        return card ? card.textContent.trim() : null;
      });
      const m = /(\d+)\s+(months|weeks|fortnights|years)/i.exec(eff || '');
      out.c_term_effective = m ? Number(m[1]) : null;
      // Classify rather than dump the card text: did the page take the 0,
      // clamp it to its stated minimum, or refuse the edit outright?
      out.c_state = eff === null ? 'rejected'
        : out.c_term_effective === 0 ? 'accepted'
          : out.c_term_effective === 1 ? 'clamped'
            : 'rejected';
      out.c_card_text = eff;
      out.c_nan_count = await nanCount();
    } else if (st.state === 'd') {
      out.d_warn_text = k.warn; out.d_nan_count = await nanCount();
    } else if (st.state === 'e') {
      out.e_warn_text = k.warn; out.e_nan_count = await nanCount();
    }
  }
  return out;
});

await runCase(cases, 'F8', async () => {
  const out = {};
  for (const st of byId.F8.setup.states) {
    await applyState(st);
    const t = await compTable(), k = await kpis();
    if (st.state === 's1') {
      out.s1_kpi_cash_wealth = money(k.cashWealth);
    } else {
      out.s2_kpi_cash_wealth = money(k.cashWealth);
      out.s2_end_wealth_full = cellNum(t, 'Ending Wealth', 'full');
      out.s2_end_wealth_zero = cellNum(t, 'Ending Wealth', 'zero');
      out.s2_nb_zero = cellNum(t, 'Net Benefit vs Cash', 'zero');
      const rz = amortNums(await amort('zero'));
      out.s2_final_loan_zero = rz.length ? rz[rz.length - 1].endBal : null;
      const z = await investSeries('zero');
      out.s2_end_invest_zero = z && z.length ? z[z.length - 1] : null;
    }
  }
  return out;
});

await runCase(cases, 'F9', async () => {
  await applyState({ base: byId.F9.setup.base, scenarios: byId.F9.setup.scenarios });
  const s = byId.F9.setup.sensitivity;
  await page.evaluate(() => { const b = document.getElementById('mode2d'); if (b) b.click(); });
  await page.waitForTimeout(100);
  await page.evaluate(nm => {
    const sel = document.getElementById('sensScenario');
    const opt = [...sel.options].find(o => o.textContent.trim() === nm);
    if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
  }, s['#sensScenario']);
  for (const k of ['#sensObjective', '#sensVarX', '#sensXStart', '#sensXEnd', '#sensSteps']) {
    if (k in s) await setField(k.slice(1), s[k]);
  }
  await page.evaluate(() => document.getElementById('runSensBtn').click());
  await page.waitForTimeout(700);
  const series = await chartSeries('sensCanvas');
  const first = series ? Object.values(series)[0] : null;
  if (!first) throw new Error('sensitivity chart produced no dataset');
  const xs = first.map(p => p.x), ys = first.map(p => p.y);
  const firstNullIdx = ys.findIndex(v => v === null || v === undefined || Number.isNaN(v));
  const finite = ys.map((v, i) => ({ v, i })).filter(o => Number.isFinite(o.v));
  return {
    sweep_x: xs, sweep_y: ys, n_points: ys.length,
    x_first: xs[0] ?? null, y_first: ys[0] ?? null,
    last_finite_x: finite.length ? xs[finite[finite.length - 1].i] : null,
    first_null_x: firstNullIdx >= 0 ? xs[firstNullIdx] : null,
    n_finite_after_first_null: firstNullIdx >= 0 ? finite.filter(o => o.i > firstNullIdx).length : 0,
    y_last_finite: finite.length ? finite[finite.length - 1].v : null,
    nan_count: await nanCount(),
  };
});

await runCase(cases, 'F10', async () => {
  await applyState(byId.F10.setup);
  const t = await compTable(), k = await kpis();
  const out = {
    nb_A12: cellNum(t, 'Net Benefit vs Cash', 'A12'),
    nb_B60: cellNum(t, 'Net Benefit vs Cash', 'B60'),
    real_nb_A12: cellNum(t, 'Inflation-Adj Net Benefit', 'A12'),
    real_nb_B60: cellNum(t, 'Inflation-Adj Net Benefit', 'B60'),
    end_wealth_A12: cellNum(t, 'Ending Wealth', 'A12'),
    end_wealth_B60: cellNum(t, 'Ending Wealth', 'B60'),
    kpi_cash_wealth: money(k.cashWealth),
    note_text: await page.evaluate(() => {
      const p = document.querySelector('#compTableWrap p.muted');
      return p ? p.textContent.trim() : '';
    }),
  };
  out.real_ratio_A12 = out.nb_A12 ? out.real_nb_A12 / out.nb_A12 : null;
  out.real_ratio_B60 = out.nb_B60 ? out.real_nb_B60 / out.nb_B60 : null;
  return out;
});

emit('financingvscash', cases, { page_errors: errors.slice(0, 20) });
await browser.close();
