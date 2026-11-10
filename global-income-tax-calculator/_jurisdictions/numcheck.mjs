// Flags numbers in a worked example's prose that the engine did not produce for that
// example (gross, a line, take-home, its monthly figure, a share of gross or the marginal
// rate), so a typo or a stale figure in the writers' text shows up before publishing.
//   node global-income-tax-calculator/_jurisdictions/numcheck.mjs [slug]
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES } from './scenarios.mjs';
import { run } from './compute.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
const only = process.argv[2];
let bad = 0;
for(const p of PAGES){
  if(only && p.slug !== only) continue;
  for(const lang of ['en', 'id']){
    const f = join(HERE, 'content', `${p.slug}.${lang}.json`);
    if(!existsSync(f)) continue;
    const c = JSON.parse(readFileSync(f, 'utf8'));
    for(const ex of p.ex){
      const e = (c.examples || []).find(x => x.key === ex.key); if(!e) continue;
      const r = run(p.cc, ex);
      const ok = new Set();
      const add = v => { if(v == null || !isFinite(v)) return; ok.add(Math.round(v)); ok.add(Math.round(v * 100) / 100); ok.add(Math.round(Math.abs(v))); };
      add(ex.amount); add(ex.amount / 12); add(r.net); add(r.net / 12); add(r.tax); add(r.social); add(r.tax + r.social + r.other); add(r.incomeTax); add(ex.amount - r.net); add((ex.amount - r.net) / 12);
      if(r.taxable != null) add(r.taxable);
      for(const l of r.lines){ add(l.amount); add(l.amount / 12); }
      for(let i = 0; i < r.lines.length; i++) for(let j = i + 1; j < r.lines.length; j++) add(r.lines[i].amount + r.lines[j].amount);
      add(ex.amount - r.lines.filter(l => l.kind === 'deduction').reduce((a, l) => a + l.amount, 0));
      const pcts = new Set([(r.net / ex.amount * 100).toFixed(1), (100 - r.net / ex.amount * 100).toFixed(1), r.marginal == null ? '' : (r.marginal * 100).toFixed(1)]);
      const text = String((e.intro || '') + ' ' + (e.after || '') + ' ' + e.title).replace(/<[^>]+>/g, ' ');
      // Big money-looking numbers only (4+ digits); thresholds quoted from the law are reported for a look, not failed.
      const nums = text.match(/\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d{4,}/g) || [];
      for(const n of nums){
        const v = lang === 'id' ? +n.replace(/\./g, '').replace(',', '.') : +n.replace(/,/g, '');
        if(ok.has(Math.round(v)) || [...ok].some(o => Math.abs(o - v) <= 1)) continue;
        console.log(`${p.slug}.${lang} ${ex.key}: ${n} (not an engine figure; fine if it is a rule's threshold)`); bad++;
      }
      for(const m of text.matchAll(/(\d+[.,]\d)\s?%/g)){
        const s = m[1].replace(',', '.');
        if(!pcts.has(s)) { console.log(`${p.slug}.${lang} ${ex.key}: ${m[1]}% (check)`); }
      }
    }
  }
}
console.log(bad ? `${bad} numbers to look at.` : 'All example numbers match the engine.');
