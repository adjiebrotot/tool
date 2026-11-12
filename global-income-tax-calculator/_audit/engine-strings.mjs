// Every piece of text the engine (engine.js) can put on the page, collected by running each
// country through every option the form offers for it.
//
// Imported by labels-id.mjs (the check that each one has its Indonesian) and by
// _jurisdictions/labels.mjs (which writes ../labels-id.js). Each string is returned with
// the country it came from and its role: 'label' (a line, a bracket adjustment, a
// rounding row, a taxable income's name), 'note', 'reason' (a case not worked out),
// 'year', 'place' and 'from' (when a rule took effect).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const TOOL = join(HERE, '..');
const require = createRequire(import.meta.url);
export const E = require(join(TOOL, 'engine.js'));
const DEF = JSON.parse(readFileSync(join(TOOL, '_jurisdictions', 'page-defaults.json'), 'utf8'));

// The form, read from index.html: each field's kind, its options or bounds, and the countries it shows for.
export function formFields(){
  const html = readFileSync(join(TOOL, 'index.html'), 'utf8');
  const scope = html.slice(html.indexOf('id="jobScope"'), html.indexOf('</aside>'));
  const out = [];
  // A row: <div class="field-row|toggle-row" data-show=".." data-if=".."> ... a select or an input ... </div>
  const rowRe = /<(div|p) class="(?:field-row|toggle-row)"([^>]*)>([\s\S]*?)(?=<div class="(?:field-row|toggle-row)"|<p class="field-sub"|<\/div>\s*<\/div>\s*<p class="empty-note"|<\/div>\s*<div class="field-group">|$)/g;
  let m;
  while((m = rowRe.exec(scope))){
    const attrs = m[2], body = m[3];
    const show = (/data-show="([^"]*)"/.exec(attrs) || [])[1];
    const sel = /<select[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/select>/.exec(body);
    if(sel){
      const opts = [...sel[2].matchAll(/<option value="([^"]*)"/g)].map(x => x[1]);
      out.push({ id: sel[1], kind: 'select', opts, show: show ? show.split(/\s+/) : null });
      continue;
    }
    const inp = /<input[^>]*\bid="([^"]+)"[^>]*>/.exec(body);
    if(!inp) continue;
    const tag = inp[0], id = inp[1];
    if(/type="checkbox"/.test(tag)) out.push({ id, kind: 'check', show: show ? show.split(/\s+/) : null });
    else out.push({ id, kind: 'number', min: +(/data-min="([^"]*)"/.exec(tag) || [])[1], max: +(/data-max="([^"]*)"/.exec(tag) || [])[1], show: show ? show.split(/\s+/) : null });
  }
  return out;
}

const NUM = new Set(['amount','deAddOn','usLocal','nlPension','seMun','seBurial','fiMun','fiChurch','beMun','chNbu','chCommune','frMutuelle','ptHealth','ptEdu','ptRent','ptColeta','cnAllow','cnSpecial','gulfWagePct']);
const knobs = job => Object.fromEntries(Object.entries(job).map(([h, v]) => [h, NUM.has(h) ? Number(String(v).replace(/,/g, '')) || 0 : v]));

// Pay levels in US dollars a year, restated in each currency.
// A log grid fine enough (about 14% apart) to land inside every band a note or a guard is about.
const PAY_USD = [0].concat(Array.from({ length: 80 }, (_, i) => Math.round(50*Math.pow(1.14, i))));

export function collect(){
  const fields = formFields().filter(f => f.id !== 'country' && f.id !== 'dir' && f.id !== 'period');
  const found = new Map();   // key cc|role|text -> { cc, role, text }
  const add = (cc, role, text) => { if(text) found.set(cc + '|' + role + '|' + text, { cc, role, text }); };
  for(const cc of Object.keys(E.C)){
    const c = E.C[cc];
    add(cc, 'year', c.year); add(cc, 'place', c.place);
    const mine = fields.filter(f => f.show && f.show.includes(cc));
    const variants = f => f.kind === 'select' ? f.opts : f.kind === 'check' ? [true, false]
      : [f.min, f.max, (f.min + f.max)/2, DEF[f.id] != null ? Number(String(DEF[f.id]).replace(/,/g, '')) : f.min].map(String);
    // Every option alone, then every pair of fields (each option of one with each of the other).
    const jobs = [{}];
    // A saved job can hold a US state the form no longer offers (its rules are not loaded): the reason shows instead.
    if(cc === 'US') Object.keys(E.US_ST_GATED || {}).forEach(st => jobs.push({ usState: st }));
    mine.forEach(f => variants(f).forEach(v => jobs.push({ [f.id]: v })));
    for(let i = 0; i < mine.length; i++) for(let j = i + 1; j < mine.length; j++)
      variants(mine[i]).forEach(a => variants(mine[j]).forEach(b => jobs.push({ [mine[i].id]: a, [mine[j].id]: b })));
    for(const extra of jobs){
      const k = knobs({ ...DEF, country: cc, ...extra });
      for(const usd of PAY_USD){
        const g = E.convert(usd, 'USD', c.cur);
        const r = E.compute(cc, g, k);
        if(r.notSupported){ add(cc, 'reason', r.reason); continue; }
        (r.lines || []).forEach(l => {
          add(cc, 'label', l.label); add(cc, 'from', l.from);
          if(l.brackets){ l.brackets.adj.forEach(a => add(cc, 'label', a.label)); if(l.brackets.rest) add(cc, 'label', l.brackets.restLabel); }
        });
        add(cc, 'label', r.taxableLabel);
        (r.notes || []).forEach(n => add(cc, 'note', n));
      }
      // Net to gross reaches the reasons a solve can give (a ceiling it cannot climb past).
      for(const usd of [1000, 50000, 400000, 2000000]){
        const s = E.solveGross(cc, E.convert(usd, 'USD', c.cur), k);
        if(s.notSupported) add(cc, 'reason', s.reason);
      }
    }
  }
  return [...found.values()];
}
