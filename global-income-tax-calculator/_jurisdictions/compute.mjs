// Runs each page's worked examples through engine.js exactly as the calculator page would:
// the page's default job (page-defaults.json, dumped from the live form) plus the example's inputs.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
export const E = require(join(HERE, '..', 'engine.js'));
const DEF = JSON.parse(readFileSync(join(HERE, 'page-defaults.json'), 'utf8'));
// Fields the page formats as numbers (knobsOf in script.js parses these).
const NUM = new Set(['amount','deAddOn','usLocal','nlPension','seMun','seBurial','fiMun','fiChurch','beMun','chNbu','chCommune','frMutuelle','ptHealth','ptEdu','ptRent','ptColeta','cnAllow','cnSpecial','gulfWagePct']);
export function jobOf(cc, ex){
  const job = { ...DEF, country: cc, dir: 'gross', period: 'yearly', amount: String(ex.amount), ...Object.fromEntries(Object.entries(ex.inputs).map(([k, v]) => [k, typeof v === 'number' ? String(v) : v])) };
  const k = {};
  for(const [h, v] of Object.entries(job)) k[h] = NUM.has(h) ? Number(String(v).replace(/,/g, '')) || 0 : v;
  return k;
}
export function run(cc, ex){
  const k = jobOf(cc, ex);
  const r = E.compute(cc, ex.amount, k);
  if(r.notSupported) throw new Error(cc + ' ' + ex.key + ': ' + r.reason);
  r.marginal = E.marginal(cc, ex.amount, k, r);
  return r;
}
// The #load link that opens the calculator on this example (SharedAgent in shared.js).
export function loadLink(cc, ex, note){
  const parts = ['load', 'v=1', 'country=' + cc, 'dir=gross', 'amount=' + ex.amount, 'period=yearly'];
  for(const [h, v] of Object.entries(ex.inputs)) parts.push(h + '=' + encodeURIComponent(String(v)));
  if(note) parts.push('note=' + encodeURIComponent(note));
  return '#' + parts.join('&');
}
