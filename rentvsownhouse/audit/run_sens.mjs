import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const url = pathToFileURL(join(HERE,'..','sensitivity','index.html')).href;
const b = await chromium.launch(); const p = await b.newPage();
p.on('pageerror',()=>{});
await p.goto(url,{waitUntil:'networkidle'});
await p.evaluate(()=>{ window.__csv=null; const o=RVOExport.downloadCSV; RVOExport.downloadCSV=(f,t)=>{window.__csv=t;}; });
const clean=s=>(s||'').split('\n').filter(l=>!l.startsWith('#')).join('\n');
async function grab(which){
  await p.evaluate(w=>{window.__csv=null; document.querySelector(`.btn-scen-action.dl-${w}[data-si="0"]`).click();}, which);
  await p.waitForTimeout(30);
  return await p.evaluate(()=>window.__csv);
}
mkdirSync(join(HERE,'sens_out'),{recursive:true});
writeFileSync(join(HERE,'sens_out','base_own.csv'), clean(await grab('own')));
writeFileSync(join(HERE,'sens_out','base_rent.csv'), clean(await grab('rent')));
console.log('sensitivity base case exported');
await b.close();
