// Global Income Tax Calculator: every piece of engine text has its Indonesian.
//
// The Indonesian page (id/) words the engine's lines through labels-id.js, made by
// _jurisdictions/labels.mjs from the content files' lineLabels. This runs every country
// through every option the form offers (each alone and in pairs, at 80 pay levels, and net
// to gross), collects each label, bracket adjustment, note, reason, tax year and place the
// engine writes (engine-strings.mjs), and fails on any without an Indonesian, on a
// translation with an em-dash, and on a labels-id.js older than its content files.
//
// Run: node global-income-tax-calculator/_audit/labels-id.mjs
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collect } from './engine-strings.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

let pass = 0, fail = 0;
const check = (name, ok, detail) => { console.log((ok ? '  PASS  ' : '✗ FAIL  ') + name + (detail ? '  — ' + detail : '')); ok ? pass++ : fail++; };

let fresh = true, out = '';
try { out = execFileSync(process.execPath, [join(HERE, '..', '_jurisdictions', 'labels.mjs'), '--check'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
catch(e){ fresh = false; out = String(e.stderr || e.stdout || e.message); }
check('labels-id.js matches the content files', fresh, fresh ? '' : out.trim().split('\n').slice(-3).join(' | '));

const { tr, data } = require(join(HERE, '..', 'labels-id.js'));
const all = collect().filter(s => s.role !== 'from');   // a rule's date is worded by script.js (fromWords)
const missing = [], dashed = [];
for(const s of all){
  const t = tr(s.text, s.cc);
  if(t == null) missing.push(s);
  else if(/—/.test(t)) dashed.push(s.cc + ': ' + t);
}
const roles = [...new Set(all.map(s => s.role))];
roles.forEach(role => {
  const of = all.filter(s => s.role === role), miss = missing.filter(s => s.role === role);
  check(`every ${role} the engine writes has its Indonesian (${of.length})`, !miss.length,
    miss.slice(0, 40).map(s => `${s.cc}: ${s.text}`).join(' | ') + (miss.length > 40 ? ` | ... ${miss.length - 40} more` : ''));
});
check('no em-dash in the Indonesian', !dashed.length, dashed.slice(0, 5).join(' | '));
// The figures come back as the English wrote them: a template keeps every number of the label.
const lost = all.filter(s => { const t = tr(s.text, s.cc); if((data.lit[s.cc] || {})[s.text] != null) return false;   // worded as a whole, on purpose
  return t && (s.text.match(/\d+(?:,\d{3})*(?:\.\d+)?/g) || []).some(n => !t.includes(n)); });
check('a translated label keeps every figure of the English', !lost.length, lost.slice(0, 8).map(s => `${s.cc}: ${s.text} -> ${tr(s.text, s.cc)}`).join(' | '));

console.log(`\nlabels-id: ${pass} passed, ${fail} failed`);
if(fail){
  console.log('\nWithout Indonesian (add each to that country\'s content/<slug>.id.json lineLabels, then run _jurisdictions/labels.mjs):');
  const seen = new Set();
  missing.forEach(s => { const k = s.cc + s.text; if(!seen.has(k)){ seen.add(k); console.log(`  ${s.cc}\t${s.role}\t${s.text}`); } });
}
process.exit(fail ? 1 : 0);
