// Join frozen expectations against observed engine output and score them.
// Usage: node _qa/eval/evaluate.mjs <tool> [<tool> ...]   (no args = every tool)
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const QA = join(dirname(fileURLToPath(import.meta.url)), '..');
const num = v => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[−–]/g, '-').replace(/[^0-9.eE+\-]/g, '')));

function compare(op, actual, value, tol) {
  switch (op) {
    case '==': return { ok: actual === value || String(actual) === String(value) };
    case '!=': return { ok: actual !== value && String(actual) !== String(value) };
    case '~=': {
      const a = num(actual), b = num(value);
      if (!Number.isFinite(a)) return { ok: false, note: `not numeric: ${JSON.stringify(actual)}` };
      const d = Math.abs(a - b);
      return { ok: d <= (tol ?? 0), note: `Δ=${d.toPrecision(4)} (tol ${tol})` };
    }
    case '<': return { ok: num(actual) < num(value) };
    case '<=': return { ok: num(actual) <= num(value) };
    case '>': return { ok: num(actual) > num(value) };
    case '>=': return { ok: num(actual) >= num(value) };
    case 'between': return { ok: num(actual) >= num(value[0]) && num(actual) <= num(value[1]) };
    case 'in': return { ok: value.some(v => String(v) === String(actual)) };
    case 'is-null': return { ok: actual === null || actual === undefined || actual === '' };
    case 'not-null': return { ok: !(actual === null || actual === undefined || actual === '') };
    case 'matches': return { ok: new RegExp(value, 'i').test(String(actual ?? '')) };
    case 'monotonic-asc': {
      const xs = (actual || []).map(num);
      return { ok: xs.every((v, i) => i === 0 || v >= xs[i - 1] - (tol ?? 0)) };
    }
    case 'monotonic-desc': {
      const xs = (actual || []).map(num);
      return { ok: xs.every((v, i) => i === 0 || v <= xs[i - 1] + (tol ?? 0)) };
    }
    default: return { ok: false, note: `unknown op ${op}` };
  }
}

const tools = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(join(QA, 'plan')).filter(f => f.endsWith('.expected.json')).map(f => f.replace('.expected.json', ''));

let grand = { pass: 0, fail: 0, xfail: 0, xpass: 0, error: 0 };

for (const tool of tools) {
  const planPath = join(QA, 'plan', `${tool}.expected.json`);
  const actPath = join(QA, 'results', `${tool}.actual.json`);
  if (!existsSync(planPath)) { console.error(`! no plan for ${tool}`); continue; }
  if (!existsSync(actPath)) { console.error(`! no actual for ${tool} (runner not executed)`); continue; }
  const plan = JSON.parse(readFileSync(planPath, 'utf8'));
  const act = JSON.parse(readFileSync(actPath, 'utf8'));
  const observed = act.cases || {};
  const rows = [];

  for (const c of plan.cases) {
    const got = observed[c.id];
    if (!got) {
      rows.push({ id: c.id, severity: c.severity, status: 'ERROR', detail: 'case not executed by the runner' });
      grand.error++; continue;
    }
    if (got.error) {
      rows.push({ id: c.id, severity: c.severity, status: 'ERROR', detail: got.error });
      grand.error++; continue;
    }
    const checks = c.expect.map(e => {
      const actual = (got.observed || {})[e.key];
      const r = compare(e.op, actual, e.value, e.tol);
      return { key: e.key, op: e.op, expected: e.value, actual, ok: r.ok, note: r.note, why: e.why };
    });
    const allOk = checks.every(k => k.ok);
    // expect_outcome:"fail" marks a property the current build is predicted to
    // break. Satisfying it is XPASS (good news, and still a change to review).
    let status;
    if (c.expect_outcome === 'fail') { status = allOk ? 'XPASS' : 'XFAIL'; allOk ? grand.xpass++ : grand.xfail++; }
    else { status = allOk ? 'PASS' : 'FAIL'; allOk ? grand.pass++ : grand.fail++; }
    rows.push({ id: c.id, severity: c.severity, status, basis: c.basis, checks, notes: got.notes });
  }

  const out = { tool, evaluated_utc: new Date().toISOString(), plan_authored: plan.authored_utc, ran_utc: act.ran_utc, rows };
  writeFileSync(join(QA, 'results', `${tool}.verdict.json`), JSON.stringify(out, null, 2));

  console.log(`\n══ ${tool} ══`);
  for (const r of rows) {
    const mark = { PASS: ' PASS ', FAIL: '✗FAIL ', XFAIL: '✗XFAIL', XPASS: '!XPASS', ERROR: '!ERROR' }[r.status];
    console.log(`  ${mark}  ${r.id}${r.severity ? ' [' + r.severity + ']' : ''}`);
    if (r.detail) console.log(`          ${r.detail}`);
    for (const k of (r.checks || [])) {
      if (!k.ok || r.status === 'XFAIL') {
        console.log(`          ${k.ok ? 'ok  ' : 'BAD '} ${k.key} ${k.op} ${JSON.stringify(k.expected)} | got ${JSON.stringify(k.actual)}${k.note ? '  ' + k.note : ''}`);
      }
    }
  }
}

console.log(`\nTOTAL  pass ${grand.pass}  fail ${grand.fail}  xfail ${grand.xfail}  xpass ${grand.xpass}  error ${grand.error}`);
