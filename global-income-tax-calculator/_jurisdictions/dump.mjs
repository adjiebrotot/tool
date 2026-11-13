import { PAGES } from './scenarios.mjs';
import { run, E } from './compute.mjs';
const only = process.argv[2];
for(const p of PAGES){
  if(only && p.slug !== only) continue;
  for(const ex of p.ex){
    const r = run(p.cc, ex);
    console.log(`\n## ${p.slug} / ${ex.key}  gross ${ex.amount} ${r.cur} -> net ${Math.round(r.net)} (${(r.net/ex.amount*100).toFixed(1)}%), marginal ${(r.marginal*100).toFixed(1)}%`);
    for(const l of r.lines) console.log(`  [${l.kind}] ${l.label}: ${Math.round(l.amount*100)/100}`);
    for(const n of r.notes||[]) console.log('  note: ' + (typeof n === 'string' ? n : JSON.stringify(n)));
  }
}
