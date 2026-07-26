// Pisah vs Gabung — PKP rounding audit (UU PPh Pasal 17 ayat (4)).
// Taxable income is rounded DOWN to whole thousands of rupiah before the
// progressive rates apply. This drives the real page and compares the exported
// CSV against a replay written from the statute, not from the tool's code.
//
// The subtlety worth keeping: the proportional income split leaves binary noise
// (a 35% split of 2,700,000,000 yields 944,999,999.9999999, which is
// arithmetically 945,000,000). Flooring that raw value would drop a full
// Rp 1,000 of PKP and overcharge the taxpayer, so the arithmetic value has to
// be resolved first. This file fails if that handling regresses.
//
// Run: node floor.mjs
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = pathToFileURL(join(HERE, '..', 'index.html')).href;

const CHART_STUB = `
window.__charts = [];
class Chart {
  constructor(ctx, cfg){ this.config=cfg; this.data=(cfg&&cfg.data)||{datasets:[]}; this.options=(cfg&&cfg.options)||{}; window.__charts.push(this); }
  update(){} destroy(){} resetZoom(){}
}
Chart.register=function(){};
window.Chart=Chart;`;

const SLABS = [
  { upTo:   60_000_000, rate: 0.05 },
  { upTo:  250_000_000, rate: 0.15 },
  { upTo:  500_000_000, rate: 0.25 },
  { upTo: 5_000_000_000, rate: 0.30 },
  { upTo: Infinity,      rate: 0.35 },
];
const PTKP_H = 54_000_000 + 4_500_000;   // K/0
const PTKP_W = 54_000_000;               // TK/0
const PTKP_G = 54_000_000 + 4_500_000 + 54_000_000;  // K/I/0

const floorPkp = v => Math.floor(Math.max(0, Math.round(v*100)/100) / 1000) * 1000;

function progressive(pkp){
  if (!(pkp > 0)) return 0;
  let t = 0, lower = 0;
  for (const s of SLABS){
    if (pkp <= lower) break;
    t += (Math.min(pkp, s.upTo) - lower) * s.rate;
    lower = s.upTo;
  }
  return t;
}

let pass=0, fail=0;
const check=(name,ok,detail)=>{ console.log((ok?'  PASS  ':'✗ FAIL  ')+name+(detail?'  — '+detail:'')); ok?pass++:fail++; };

const browser = await chromium.launch({args:['--allow-file-access-from-files']});
const page = await browser.newPage();
await page.route('**/*', route=>{
  const u=route.request().url();
  if(u.startsWith('file://')) return route.continue();
  if(/chart\.umd/.test(u)) return route.fulfill({contentType:'application/javascript', body:CHART_STUB});
  return route.fulfill({contentType:'application/javascript', body:'/* stub */'});
});
await page.addInitScript(()=>{ try{ localStorage.clear(); localStorage.setItem('pvg-tour-v1-seen','1'); }catch(e){} });
await page.goto(PAGE, {waitUntil:'load'});
await page.waitForTimeout(250);

const setField = (id, value) => page.evaluate(([i,v])=>{
  const el=document.getElementById(i); el.value=v;
  el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
}, [id, value]);

const DED = 6_000_000;
await setField('totalSalaryInput','700,000,000');
await setField('splitPct','35');
await setField('deductionInput','6,000,000');
await page.waitForTimeout(250);

const csv = await page.evaluate(()=>{
  let out=null; const orig=URL.createObjectURL;
  URL.createObjectURL=b=>{out=b; return 'blob:stub';}; URL.revokeObjectURL=()=>{};
  document.getElementById('downloadBtn').click();
  URL.createObjectURL=orig;
  return out?out.text():null;
});
const lines = csv.trim().split('\n');
const head  = lines[1].split(',');
const rows  = lines.slice(2).map(l=>Object.fromEntries(l.split(',').map((v,i)=>[head[i],v])));
const num = v => Number(v);

/* 1. Every exported row matches a statutory replay that floors. */
let worst=0, worstRow=null, detail='';
for(const r of rows){
  const hG=num(r.HusbandGross), wG=num(r.WifeGross), totalG=hG+wG;
  const hDed = totalG>0 ? DED*(hG/totalG) : 0, wDed = DED-hDed;
  const taxH = progressive(floorPkp(Math.max(0,hG-hDed) - PTKP_H));
  const taxW = progressive(floorPkp(Math.max(0,wG-wDed) - PTKP_W));
  const gab  = progressive(floorPkp(Math.max(0,hG+wG-DED) - PTKP_G));
  const e = Math.max(Math.abs(taxH+taxW-num(r.TotalTax_Pisah)), Math.abs(gab-num(r.TotalTax_Gabung)));
  if(e>worst){ worst=e; worstRow=r.Salary_Mio;
    detail=`pisah app=${num(r.TotalTax_Pisah)} ref=${taxH+taxW} | gabung app=${num(r.TotalTax_Gabung)} ref=${gab}`; }
}
check(`all ${rows.length} exported rows match a replay that floors PKP`, worst<1e-6,
      worst<1e-6 ? 'max err 0' : `max err ${worst} at ${worstRow}M  ${detail}`);

/* 2. The floor is genuinely in force on every taxable base. */
const notWhole = rows.filter(r =>
  num(r.TaxableH_Pisah)%1000!==0 || num(r.TaxableW_Pisah)%1000!==0 || num(r.Taxable_Gabung)%1000!==0);
check('every taxable base is a whole multiple of Rp 1,000', notWhole.length===0,
      notWhole.length ? `${notWhole.length} unfloored, first at ${notWhole[0].Salary_Mio}M: ${notWhole[0].TaxableH_Pisah}/${notWhole[0].TaxableW_Pisah}/${notWhole[0].Taxable_Gabung}`
                      : `${rows.length} rows x 3 bases`);

/* 3. Flooring must not disturb the accounting identities. */
const bad=[];
for(const r of rows){
  const tH=num(r.TaxH_Pisah), tW=num(r.TaxW_Pisah), tot=num(r.TotalTax_Pisah);
  if(Math.abs(tH+tW-tot)>1e-6) bad.push(`${r.Salary_Mio}M: TaxH+TaxW=${tH+tW} vs ${tot}`);
  const d=num(r.Difference), g=num(r.TotalTax_Gabung);
  if(Math.abs(g-tot-d)>1e-6) bad.push(`${r.Salary_Mio}M: Gabung-Pisah=${g-tot} vs Difference=${d}`);
  const hg=num(r.HusbandGross), wg=num(r.WifeGross), ded=num(r.Deduction), net=num(r.NetIncome);
  if(Math.abs(hg+wg-ded-net)>1e-6) bad.push(`${r.Salary_Mio}M: Gross-Ded=${hg+wg-ded} vs Net=${net}`);
}
check('accounting identities hold after flooring', bad.length===0, bad.slice(0,3).join(' | ') || `${rows.length} rows clean`);

/* 4. Flooring can only lower the tax, never raise it. */
const raised=[];
for(const r of rows){
  const hG=num(r.HusbandGross), wG=num(r.WifeGross), totalG=hG+wG;
  const hDed = totalG>0 ? DED*(hG/totalG) : 0;
  const raw = Math.max(0, Math.max(0,hG-hDed) - PTKP_H);
  if(progressive(floorPkp(raw)) - progressive(raw) > 1e-6) raised.push(`${r.Salary_Mio}M`);
}
check('flooring never increases the tax', raised.length===0, raised.slice(0,3).join(', ') || 'monotone across all rows');

/* 5. The statutory case that motivated the rule. */
await page.evaluate(()=>document.getElementById('modeBtnSplit').click());
await setField('husbandSalaryInput','58,500,999');
await setField('wifeSalaryInput','0');
await setField('husbandDeductionInput','0');
await setField('wifeDeductionInput','0');
await page.waitForTimeout(250);
const kpi = await page.evaluate(()=>(document.getElementById('kpiPisah')||{}).textContent);
check('gross 58,500,999 gives Rp 0 (PKP 999 floors to 0), not Rp 50',
      /Rp\s*0(\b|$)/.test(String(kpi).trim()), `KPI Pisah reads ${JSON.stringify(kpi)}`);

console.log(`\npisahvsgabung PKP rounding audit: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail?1:0);
