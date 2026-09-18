// Freeze / verify the expectation files.
//   node _qa/eval/check-freeze.mjs --write   record digests (phase 1 -> phase 2 handoff)
//   node _qa/eval/check-freeze.mjs           verify nothing moved since
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const QA = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLAN = join(QA, 'plan');
const LOCK = join(PLAN, 'FREEZE.sha256');
const write = process.argv.includes('--write');

const files = readdirSync(PLAN).filter(f => f.endsWith('.expected.json')).sort();
const digests = Object.fromEntries(files.map(f =>
  [f, createHash('sha256').update(readFileSync(join(PLAN, f))).digest('hex')]));

if (write) {
  const prev = existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, 'utf8')) : { frozen: {} };
  const frozen = { ...prev.frozen };
  let added = 0;
  for (const [f, d] of Object.entries(digests)) {
    if (frozen[f] && frozen[f].sha256 !== d) {
      console.error(`REFUSED: ${f} is already frozen and has changed. Freezing it again would let an expectation be rewritten after seeing the engine.`);
      process.exit(2);
    }
    if (!frozen[f]) { frozen[f] = { sha256: d, frozen_utc: new Date().toISOString() }; added++; }
  }
  writeFileSync(LOCK, JSON.stringify({ frozen }, null, 2));
  console.log(`froze ${added} new expectation file(s); ${Object.keys(frozen).length} total`);
  process.exit(0);
}

if (!existsSync(LOCK)) { console.error('no FREEZE.sha256 — expectations were never frozen'); process.exit(1); }
const { frozen } = JSON.parse(readFileSync(LOCK, 'utf8'));
let bad = 0;
for (const [f, d] of Object.entries(digests)) {
  if (!frozen[f]) { console.error(`UNFROZEN  ${f}`); bad++; }
  else if (frozen[f].sha256 !== d) { console.error(`MUTATED   ${f}  (frozen ${frozen[f].frozen_utc})`); bad++; }
  else console.log(`ok        ${f}  frozen ${frozen[f].frozen_utc}`);
}
for (const f of Object.keys(frozen)) if (!digests[f]) { console.error(`MISSING   ${f}`); bad++; }
process.exit(bad ? 1 : 0);
