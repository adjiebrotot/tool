// Roll every verdict into one table + a findings list, sorted by severity.
// Usage: node _qa/eval/report.mjs [--md _qa/results/REPORT.md]
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const QA = join(dirname(fileURLToPath(import.meta.url)), '..');
const RES = join(QA, 'results');
if (!existsSync(RES)) { console.error('no results yet'); process.exit(1); }

const files = readdirSync(RES).filter(f => f.endsWith('.verdict.json')).sort();
const SEV = { blocker: 0, major: 1, minor: 2, undefined: 3 };
const rows = [], tally = {};

for (const f of files) {
  const v = JSON.parse(readFileSync(join(RES, f), 'utf8'));
  tally[v.tool] = { PASS: 0, FAIL: 0, XFAIL: 0, XPASS: 0, ERROR: 0 };
  for (const r of v.rows) { tally[v.tool][r.status]++; rows.push({ tool: v.tool, ...r }); }
}

const lines = [];
const say = s => { lines.push(s); console.log(s); };

say('# Financial tools — regression run\n');
say(`Run assembled ${new Date().toISOString()}.\n`);
say('| Tool | Pass | Fail | Known-bad confirmed | Known-bad now passing | Could not run |');
say('| --- | ---: | ---: | ---: | ---: | ---: |');
let g = { PASS: 0, FAIL: 0, XFAIL: 0, XPASS: 0, ERROR: 0 };
for (const [tool, t] of Object.entries(tally)) {
  say(`| ${tool} | ${t.PASS} | ${t.FAIL} | ${t.XFAIL} | ${t.XPASS} | ${t.ERROR} |`);
  for (const k of Object.keys(g)) g[k] += t[k];
}
say(`| **total** | **${g.PASS}** | **${g.FAIL}** | **${g.XFAIL}** | **${g.XPASS}** | **${g.ERROR}** |`);

const notable = rows.filter(r => r.status !== 'PASS')
  .sort((a, b) => (SEV[a.severity] - SEV[b.severity]) || a.tool.localeCompare(b.tool));

if (notable.length) {
  say('\n## Findings\n');
  for (const r of notable) {
    const head = { FAIL: 'FAIL', XFAIL: 'CONFIRMED DEFECT', XPASS: 'PREDICTED DEFECT ABSENT', ERROR: 'NOT RUN' }[r.status];
    say(`### ${r.tool} ${r.id} — ${head}${r.severity ? ` (${r.severity})` : ''}`);
    if (r.basis) say(`\n*Expected on the basis of:* ${r.basis}`);
    if (r.detail) say(`\n${r.detail}`);
    for (const k of (r.checks || []).filter(k => !k.ok)) {
      say(`\n- \`${k.key}\` expected ${k.op} \`${JSON.stringify(k.expected)}\`, observed \`${JSON.stringify(k.actual)}\`${k.note ? ` (${k.note})` : ''}`);
      if (k.why) say(`  - ${k.why}`);
    }
    if (r.notes) say(`\n*Runner notes:* ${r.notes}`);
    say('');
  }
}

const mdIdx = process.argv.indexOf('--md');
if (mdIdx > -1) { writeFileSync(process.argv[mdIdx + 1] || join(RES, 'REPORT.md'), lines.join('\n')); }
